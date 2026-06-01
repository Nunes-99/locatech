import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { hasFeature } from "@/lib/plan-limits"
import { issueInvoiceForRental } from "@/lib/invoices/issue"

/**
 * Emite NFS-e para uma locação concluída.
 *
 * Lógica idempotente e envio de email pra cliente moram em `issueInvoiceForRental`.
 * Esta rota apenas faz auth + plano + delega.
 */
export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("rental.view")
    const { id } = await params

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { plan: true },
    })
    if (!company || !hasFeature(company.plan, "invoices")) {
      return NextResponse.json(
        { error: "Emissão de NF disponível apenas nos planos Starter e Profissional" },
        { status: 402 }
      )
    }

    const result = await issueInvoiceForRental({
      rentalId: id,
      companyId: user.companyId,
      issuedByUserId: user.id,
      issuedByName: user.name,
    })

    if (result.status === "skipped") {
      return NextResponse.json(
        { error: result.reason, invoiceId: result.invoiceId },
        { status: 409 }
      )
    }
    if (result.status === "error") {
      return NextResponse.json(
        { error: "Falha ao emitir nota", detail: result.reason, invoiceId: result.invoiceId },
        { status: 502 }
      )
    }

    // Busca a invoice criada pra devolver completa
    const invoice = await prisma.invoice.findUnique({ where: { id: result.invoiceId! } })
    return NextResponse.json(invoice)
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado")
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("[invoice issue] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
