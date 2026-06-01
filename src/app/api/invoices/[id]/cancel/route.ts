import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { getInvoiceProvider } from "@/lib/invoices"
import { z } from "zod"

const cancelSchema = z.object({
  reason: z.string().min(5).max(255),
})

/**
 * Cancela nota fiscal via provider. Em produção, isso aciona a SEFAZ —
 * cuidado com prazo legal (geralmente 24h pra NFS-e municipal).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("financial.view")
    const { id } = await params
    const body = await request.json()
    const { reason } = cancelSchema.parse(body)

    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 })
    }
    if (invoice.status !== "ISSUED") {
      return NextResponse.json(
        { error: `Não dá pra cancelar uma nota com status ${invoice.status}` },
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
    const result = await provider.cancel({ providerId: invoice.providerId, reason })

    if (!result.success) {
      return NextResponse.json(
        { error: "Provider rejeitou o cancelamento", detail: result.providerMessage },
        { status: 502 }
      )
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason,
        providerMessage: result.providerMessage ?? invoice.providerMessage,
      },
    })

    return NextResponse.json(updated)
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
    console.error("[invoice cancel] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
