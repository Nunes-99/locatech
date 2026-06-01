import { prisma } from "@/lib/prisma"
import { getInvoiceProvider } from "./index"
import {
  sendTemplated,
  getInvoiceIssuedEmail,
} from "@/lib/notifications/email"

export interface IssueResult {
  status: "ok" | "skipped" | "error"
  invoiceId?: string
  reason?: string
}

/**
 * Emite NFS-e pra uma locação específica.
 *
 * Compartilhado entre:
 *   - rota explícita `/api/rentals/[id]/invoice`
 *   - trigger inline ao concluir devolução paga
 *   - cron diário de catch-up
 *
 * Idempotência: se já existe Invoice ISSUED ou PROCESSING pra a locação,
 * faz skip e retorna `{status: "skipped"}`. Quem chama decide se loga.
 *
 * Envia email com PDF ao cliente automaticamente quando status final = ISSUED.
 */
export async function issueInvoiceForRental(opts: {
  rentalId: string
  companyId: string
  /** Quem disparou. Pra trigger automático, passe "system" ou similar. */
  issuedByUserId?: string
  issuedByName?: string
}): Promise<IssueResult> {
  const { rentalId, companyId } = opts

  // Idempotência
  const existing = await prisma.invoice.findFirst({
    where: {
      rentalId,
      status: { in: ["PENDING", "PROCESSING", "ISSUED"] },
    },
    select: { id: true, status: true },
  })
  if (existing) {
    return { status: "skipped", invoiceId: existing.id, reason: `Já existe invoice (${existing.status})` }
  }

  const taxConfig = await prisma.companyTaxConfig.findUnique({
    where: { companyId },
  })
  if (!taxConfig) {
    return { status: "error", reason: "Configuração fiscal ausente" }
  }

  const rental = await prisma.rental.findFirst({
    where: { id: rentalId, companyId, deletedAt: null },
    include: { customer: true, items: true, company: { select: { name: true, primaryColor: true, logoUrl: true } } },
  })
  if (!rental) {
    return { status: "error", reason: "Locação não encontrada" }
  }

  const description = `Locação de equipamentos — Contrato #${rental.contractNumber} (${rental.startDate.toLocaleDateString("pt-BR")} a ${(rental.actualEndDate || rental.expectedEndDate).toLocaleDateString("pt-BR")}). Itens: ${rental.items
    .map((i) => `${i.equipmentName} (${i.equipmentCode}) ${i.quantity}× ${i.days}d`)
    .join("; ")}`

  const invoice = await prisma.invoice.create({
    data: {
      companyId,
      rentalId,
      type: "NFSE",
      status: "PENDING",
      amount: rental.total,
      description,
      serviceCode: taxConfig.serviceCode,
      taxRegime: taxConfig.taxRegime,
      issuedBy: opts.issuedByUserId,
      issuedByName: opts.issuedByName ?? "Sistema (automático)",
    },
  })

  const provider = getInvoiceProvider(taxConfig)
  try {
    const result = await provider.issue({
      localId: invoice.id,
      type: "NFSE",
      amount: Number(rental.total),
      description,
      emitter: {
        cnpj: taxConfig.cnpj,
        inscricaoMunicipal: taxConfig.inscricaoMunicipal,
        taxRegime: taxConfig.taxRegime,
        serviceCode: taxConfig.serviceCode,
        issRate: Number(taxConfig.issRate),
      },
      recipient: {
        name: rental.customer.name,
        document: rental.customer.document,
        documentType: rental.customer.documentType as "CPF" | "CNPJ",
        email: rental.customer.email,
        phone: rental.customer.phone,
        address: {
          street: rental.customer.address,
          city: rental.customer.city,
          state: rental.customer.state,
          zipCode: rental.customer.zipCode,
        },
      },
      items: rental.items.map((i) => ({
        description: `${i.equipmentName} (${i.equipmentCode})`,
        quantity: i.quantity,
        unitPrice: Number(i.dailyRate) * i.days,
        total: Number(i.subtotal),
      })),
    })

    const issAmount =
      Number(taxConfig.issRate) > 0
        ? (Number(rental.total) * Number(taxConfig.issRate)) / 100
        : null

    const finalStatus =
      result.status === "ISSUED"
        ? "ISSUED"
        : result.status === "REJECTED"
          ? "REJECTED"
          : result.status === "ERROR"
            ? "ERROR"
            : "PROCESSING"

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        providerId: result.providerId,
        status: finalStatus,
        number: result.number,
        series: result.series,
        xmlUrl: result.xmlUrl,
        pdfUrl: result.pdfUrl,
        providerStatus: result.providerStatus,
        providerMessage: result.providerMessage,
        issuedAt: finalStatus === "ISSUED" ? new Date() : null,
        issAmount,
      },
    })

    // Email pro cliente se a nota foi autorizada e tem email cadastrado
    if (finalStatus === "ISSUED" && rental.customer.email) {
      void sendTemplated(rental.customer.email, getInvoiceIssuedEmail, {
        customerName: rental.customer.name,
        contractNumber: rental.contractNumber,
        invoiceNumber: result.number ?? invoice.id.slice(0, 8),
        amount: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
          Number(rental.total)
        ),
        pdfUrl: result.pdfUrl,
        xmlUrl: result.xmlUrl,
        companyName: rental.company.name,
      })
    }

    return { status: "ok", invoiceId: invoice.id }
  } catch (providerError) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "ERROR",
        providerMessage: (providerError as Error).message.slice(0, 500),
      },
    })
    return {
      status: "error",
      invoiceId: invoice.id,
      reason: (providerError as Error).message,
    }
  }
}

/**
 * Dispara emissão automática se a empresa configurou `autoIssueOnRentalCompletion`.
 * Fire-and-forget — sempre chame com void; nunca quebra o fluxo principal.
 */
export async function maybeAutoIssue(rentalId: string, companyId: string): Promise<void> {
  try {
    const config = await prisma.companyTaxConfig.findUnique({
      where: { companyId },
      select: { autoIssueOnRentalCompletion: true },
    })
    if (!config?.autoIssueOnRentalCompletion) return

    const rental = await prisma.rental.findUnique({
      where: { id: rentalId },
      select: { paymentStatus: true, status: true },
    })
    if (!rental) return

    const eligible =
      rental.paymentStatus === "PAID" &&
      ["RETURNED", "COMPLETED"].includes(rental.status)
    if (!eligible) return

    const result = await issueInvoiceForRental({
      rentalId,
      companyId,
      issuedByName: "Sistema (automático)",
    })
    if (result.status === "error") {
      console.error(`[auto-invoice] falha na locação ${rentalId}:`, result.reason)
    }
  } catch (err) {
    console.error("[auto-invoice] erro inesperado:", err)
  }
}
