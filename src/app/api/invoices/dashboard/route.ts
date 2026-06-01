import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"

/**
 * Dashboard fiscal — KPIs e evolução pra notas emitidas.
 *
 * Períodos suportados: 3, 6, 12, 24 meses (default 12).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("financial.view")
    const { searchParams } = new URL(request.url)
    const months = Math.min(36, Math.max(1, parseInt(searchParams.get("months") || "12", 10)))

    const since = new Date()
    since.setMonth(since.getMonth() - (months - 1))
    since.setDate(1)
    since.setHours(0, 0, 0, 0)

    const [invoices, taxConfig] = await Promise.all([
      prisma.invoice.findMany({
        where: { companyId: user.companyId, createdAt: { gte: since } },
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          issAmount: true,
          number: true,
          createdAt: true,
          issuedAt: true,
          rental: { select: { contractNumber: true, customer: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.companyTaxConfig.findUnique({ where: { companyId: user.companyId } }),
    ])

    function monthKey(d: Date): string {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    }

    const byMonth: Record<string, {
      total: number
      iss: number
      issued: number
      rejected: number
      cancelled: number
      pending: number
    }> = {}
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      d.setDate(1)
      byMonth[monthKey(d)] = {
        total: 0,
        iss: 0,
        issued: 0,
        rejected: 0,
        cancelled: 0,
        pending: 0,
      }
    }

    for (const inv of invoices) {
      const k = monthKey(inv.createdAt)
      const bucket = byMonth[k]
      if (!bucket) continue
      bucket.total += Number(inv.amount)
      if (inv.issAmount) bucket.iss += Number(inv.issAmount)
      switch (inv.status) {
        case "ISSUED":
          bucket.issued++
          break
        case "REJECTED":
        case "ERROR":
          bucket.rejected++
          break
        case "CANCELLED":
          bucket.cancelled++
          break
        case "PENDING":
        case "PROCESSING":
          bucket.pending++
          break
      }
    }

    const evolution = Object.entries(byMonth).map(([month, v]) => ({
      month,
      ...v,
    }))

    // Totais
    const totals = {
      invoicesCount: invoices.length,
      issued: invoices.filter((i) => i.status === "ISSUED").length,
      rejected: invoices.filter((i) => i.status === "REJECTED" || i.status === "ERROR").length,
      cancelled: invoices.filter((i) => i.status === "CANCELLED").length,
      pending: invoices.filter((i) => i.status === "PENDING" || i.status === "PROCESSING").length,
      totalAmount: invoices.reduce((s, i) => s + Number(i.amount), 0),
      totalIss: invoices.reduce((s, i) => s + Number(i.issAmount || 0), 0),
    }

    // Rejection rate
    const denominator = totals.issued + totals.rejected
    const rejectionRate = denominator > 0 ? totals.rejected / denominator : 0

    // Top 10 notas por valor
    const topInvoices = [...invoices]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 10)
      .map((inv) => ({
        id: inv.id,
        number: inv.number,
        amount: Number(inv.amount),
        status: inv.status,
        issuedAt: inv.issuedAt,
        contractNumber: inv.rental?.contractNumber ?? null,
        customerName: inv.rental?.customer.name ?? null,
      }))

    // Por tipo
    const byType = {
      NFSE: invoices.filter((i) => i.type === "NFSE").length,
      NFE_55: invoices.filter((i) => i.type === "NFE_55").length,
    }

    return NextResponse.json({
      period: { months, since: since.toISOString() },
      taxConfig: taxConfig
        ? {
            cnpj: taxConfig.cnpj,
            provider: taxConfig.provider,
            providerEnv: taxConfig.providerEnv,
            autoIssue: taxConfig.autoIssueOnRentalCompletion,
          }
        : null,
      totals: { ...totals, rejectionRate },
      byType,
      evolution,
      topInvoices,
    })
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado")
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("[invoice dashboard] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
