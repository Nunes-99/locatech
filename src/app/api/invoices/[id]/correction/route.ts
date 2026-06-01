import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { getInvoiceProvider } from "@/lib/invoices"
import { z } from "zod"

/**
 * Emite Carta de Correção Eletrônica (CCe) para uma nota.
 *
 * Regras SEFAZ:
 *   - Só pra notas ISSUED
 *   - Mínimo 15 caracteres no texto, máximo 1000
 *   - Não pode mudar valor, fornecedor, destinatário ou data de emissão
 *   - NF-e 55 suporta CCe; NFS-e raramente (varia por município)
 *
 * O cliente envia { correctionText }. Sequência é controlada pelo provider.
 */
const correctionSchema = z.object({
  correctionText: z
    .string()
    .min(15, "Texto deve ter no mínimo 15 caracteres (regra SEFAZ)")
    .max(1000, "Texto deve ter no máximo 1000 caracteres"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("financial.view")
    const { id } = await params
    const body = await request.json()
    const { correctionText } = correctionSchema.parse(body)

    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 })
    }
    if (invoice.status !== "ISSUED") {
      return NextResponse.json(
        { error: "Só dá pra corrigir notas em status ISSUED" },
        { status: 400 }
      )
    }
    if (!invoice.providerId) {
      return NextResponse.json(
        { error: "Nota sem providerId — não foi enviada pro provider" },
        { status: 400 }
      )
    }

    const taxConfig = await prisma.companyTaxConfig.findUnique({
      where: { companyId: user.companyId },
    })
    const provider = getInvoiceProvider(taxConfig)

    if (!provider.correct) {
      return NextResponse.json(
        { error: `Provider ${provider.name} não suporta CCe` },
        { status: 400 }
      )
    }

    const result = await provider.correct({
      providerId: invoice.providerId,
      correctionText,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: "Provider rejeitou a CCe", detail: result.providerMessage },
        { status: 502 }
      )
    }

    const correction = await prisma.invoiceCorrection.create({
      data: {
        invoiceId: id,
        sequence: result.sequence ?? 1,
        correctionText,
        providerId: result.providerId,
        status: "ISSUED",
        providerMessage: result.providerMessage,
        appliedBy: user.id,
        appliedByName: user.name,
      },
    })

    return NextResponse.json(correction, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Dados inválidos", details: error.errors },
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
    console.error("[invoice correct] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
