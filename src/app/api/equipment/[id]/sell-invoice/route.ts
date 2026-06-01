import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { hasFeature } from "@/lib/plan-limits"
import { getInvoiceProvider } from "@/lib/invoices"
import { z } from "zod"

/**
 * Emite NF-e modelo 55 de venda quando se dá baixa em um equipamento.
 *
 * CFOPs típicos:
 *   - 5102 (venda interna pra outro contribuinte)
 *   - 6102 (venda interestadual)
 *   - 5101 (venda da produção; menos comum em locadora)
 *
 * Fluxo:
 *   1. Operador escolhe equipamento + comprador + valor + opcional descrição extra
 *   2. Emite NF-e 55 com purpose=VENDA
 *   3. Se `markAsRetired=true`, marca Equipment.status=RETIRED
 *
 * Diferente da remessa/retorno (que é trânsito), esta nota documenta transferência
 * de propriedade — equipamento sai do estoque.
 */
const schema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  /// Se true, status do equipamento passa a RETIRED após sucesso.
  markAsRetired: z.boolean().default(true),
  cfopOverride: z.string().optional(),
})

function deduceCfop(sameState: boolean): string {
  return sameState ? "5102" : "6102"
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("equipment.update")
    const { id } = await params
    const body = await request.json()
    const data = schema.parse(body)

    const [company, taxConfig] = await Promise.all([
      prisma.company.findUnique({
        where: { id: user.companyId },
        select: { plan: true, state: true },
      }),
      prisma.companyTaxConfig.findUnique({ where: { companyId: user.companyId } }),
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
    if (!taxConfig.inscricaoEstadual) {
      return NextResponse.json(
        { error: "Inscrição estadual é obrigatória pra emitir NF-e modelo 55" },
        { status: 400 }
      )
    }

    const [equipment, customer] = await Promise.all([
      prisma.equipment.findFirst({
        where: { id, companyId: user.companyId },
      }),
      prisma.customer.findFirst({
        where: { id: data.customerId, companyId: user.companyId },
      }),
    ])

    if (!equipment) {
      return NextResponse.json({ error: "Equipamento não encontrado" }, { status: 404 })
    }
    if (equipment.status === "RENTED") {
      return NextResponse.json(
        { error: "Equipamento está locado no momento. Aguarde a devolução." },
        { status: 400 }
      )
    }
    if (!customer) {
      return NextResponse.json({ error: "Cliente comprador não encontrado" }, { status: 404 })
    }

    const sameState =
      !!company.state && !!customer.state && company.state === customer.state
    const cfop = data.cfopOverride || deduceCfop(sameState)
    const natureOperation = "Venda de bem do ativo imobilizado"

    const description =
      data.description ||
      `Venda de equipamento: ${equipment.name} (código ${equipment.code}${equipment.serialNumber ? `, série ${equipment.serialNumber}` : ""}).`

    const invoice = await prisma.invoice.create({
      data: {
        companyId: user.companyId,
        type: "NFE_55",
        purpose: "VENDA",
        status: "PENDING",
        amount: data.amount,
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
        purpose: "VENDA",
        cfop,
        natureOperation,
        amount: data.amount,
        description,
        emitter: {
          cnpj: taxConfig.cnpj,
          inscricaoMunicipal: taxConfig.inscricaoMunicipal,
          taxRegime: taxConfig.taxRegime,
          serviceCode: null,
          issRate: 0,
        },
        recipient: {
          name: customer.name,
          document: customer.document,
          documentType: customer.documentType as "CPF" | "CNPJ",
          email: customer.email,
          phone: customer.phone,
          address: {
            street: customer.address,
            city: customer.city,
            state: customer.state,
            zipCode: customer.zipCode,
          },
        },
        items: [
          {
            description: `${equipment.name} (${equipment.code})`,
            quantity: 1,
            unitPrice: data.amount,
            total: data.amount,
          },
        ],
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

      // Marca equipamento como baixado apenas se nota foi autorizada
      if (data.markAsRetired && finalStatus === "ISSUED") {
        await prisma.equipment.update({
          where: { id },
          data: { status: "RETIRED" },
        })
      }

      return NextResponse.json({ ...updated, cfop, natureOperation, equipmentRetired: data.markAsRetired && finalStatus === "ISSUED" })
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
    console.error("[sell-invoice] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
