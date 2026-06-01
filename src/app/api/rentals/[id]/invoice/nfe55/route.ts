import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { hasFeature } from "@/lib/plan-limits"
import { getInvoiceProvider } from "@/lib/invoices"
import type { InvoicePurpose } from "@prisma/client"
import { z } from "zod"

/**
 * Emite NF-e modelo 55 de **Remessa** ou **Retorno** vinculada a uma locação.
 *
 * Diferente da NFS-e (que cobra o serviço da locação), a NF-e 55 documenta
 * a **circulação física** do equipamento entre a locadora e o cliente:
 *   - REMESSA_LOCACAO: saída do equipamento → CFOP 5917 (mesmo estado) ou 6917 (outro estado)
 *   - RETORNO_LOCACAO: volta do equipamento → CFOP 1917 (mesmo estado) ou 2917 (outro estado)
 *
 * Útil em estados que fiscalizam fortemente (SP, MG, RJ) e quando o cliente é PJ
 * que precisa lançar a entrada de equipamento na escrita fiscal.
 *
 * **NÃO substitui** a NFS-e — são notas complementares. Algumas locadoras só usam NFS-e
 * (locação pura sem trânsito formal); outras emitem ambas.
 */
const schema = z.object({
  purpose: z.enum(["REMESSA_LOCACAO", "RETORNO_LOCACAO"]),
  /// Permite override do CFOP padrão (raro — normalmente é deduzido pelo estado origem/destino).
  cfopOverride: z.string().optional(),
})

function deduceCfop(
  purpose: "REMESSA_LOCACAO" | "RETORNO_LOCACAO",
  sameState: boolean
): string {
  if (purpose === "REMESSA_LOCACAO") return sameState ? "5917" : "6917"
  return sameState ? "1917" : "2917"
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("rental.view")
    const { id } = await params
    const body = await request.json()
    const { purpose, cfopOverride } = schema.parse(body)

    const [company, taxConfig, rental] = await Promise.all([
      prisma.company.findUnique({
        where: { id: user.companyId },
        select: { plan: true, state: true },
      }),
      prisma.companyTaxConfig.findUnique({ where: { companyId: user.companyId } }),
      prisma.rental.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
        include: { customer: true, items: true, company: { select: { name: true, state: true } } },
      }),
    ])

    if (!company || !hasFeature(company.plan, "invoices")) {
      return NextResponse.json(
        { error: "NF-e disponível apenas nos planos Starter e Profissional" },
        { status: 402 }
      )
    }
    if (!taxConfig) {
      return NextResponse.json(
        { error: "Configure dados fiscais em /configuracoes/fiscal primeiro" },
        { status: 400 }
      )
    }
    if (!rental) {
      return NextResponse.json({ error: "Locação não encontrada" }, { status: 404 })
    }
    if (!taxConfig.inscricaoEstadual) {
      return NextResponse.json(
        { error: "Inscrição estadual é obrigatória pra emitir NF-e modelo 55" },
        { status: 400 }
      )
    }

    // CFOP: se origem e destino são mesmo estado → operação interna
    const sameState =
      !!company.state && !!rental.customer.state && company.state === rental.customer.state
    const cfop = cfopOverride || deduceCfop(purpose, sameState)
    const natureOperation =
      purpose === "REMESSA_LOCACAO" ? "Remessa para locação" : "Retorno de locação"

    const description = `${natureOperation} — Contrato #${rental.contractNumber}. Itens: ${rental.items
      .map((i) => `${i.equipmentName} (${i.equipmentCode}) ${i.quantity}×`)
      .join("; ")}`

    // Valor da NF-e 55 de remessa/retorno = valor de mercado dos equipamentos.
    // Como não temos isso explícito, usamos a soma dos purchaseValue se disponível,
    // senão fallback pro valor da locação (não-ideal mas evita zero).
    const equipmentIds = rental.items.map((i) => i.equipmentId)
    const equipmentValues = await prisma.equipment.findMany({
      where: { id: { in: equipmentIds } },
      select: { id: true, purchaseValue: true },
    })
    const valueMap = new Map(equipmentValues.map((e) => [e.id, e.purchaseValue]))
    let amount = 0
    for (const item of rental.items) {
      const pv = valueMap.get(item.equipmentId)
      amount += pv ? Number(pv) * item.quantity : Number(item.subtotal)
    }
    if (amount === 0) amount = Number(rental.total)

    const invoice = await prisma.invoice.create({
      data: {
        companyId: user.companyId,
        rentalId: rental.id,
        type: "NFE_55",
        purpose: purpose as InvoicePurpose,
        status: "PENDING",
        amount,
        description,
        taxRegime: taxConfig.taxRegime,
        issuedBy: user.id,
        issuedByName: user.name,
      },
    })

    const provider = getInvoiceProvider(taxConfig)
    try {
      const result = await provider.issue({
        localId: invoice.id,
        type: "NFE_55",
        purpose: purpose as InvoicePurpose,
        cfop,
        natureOperation,
        amount,
        description,
        emitter: {
          cnpj: taxConfig.cnpj,
          inscricaoMunicipal: taxConfig.inscricaoMunicipal,
          taxRegime: taxConfig.taxRegime,
          serviceCode: null,
          issRate: 0,
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
          unitPrice: amount / Math.max(1, rental.items.length),
          total: amount / Math.max(1, rental.items.length),
        })),
      })

      const finalStatus =
        result.status === "ISSUED"
          ? "ISSUED"
          : result.status === "REJECTED"
            ? "REJECTED"
            : result.status === "ERROR"
              ? "ERROR"
              : "PROCESSING"

      const updated = await prisma.invoice.update({
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
        },
      })

      return NextResponse.json({ ...updated, cfop, natureOperation })
    } catch (providerError) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "ERROR",
          providerMessage: (providerError as Error).message.slice(0, 500),
        },
      })
      return NextResponse.json(
        {
          error: "Falha ao comunicar com o provider",
          detail: (providerError as Error).message,
          invoiceId: invoice.id,
        },
        { status: 502 }
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado")
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("[nfe55] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
