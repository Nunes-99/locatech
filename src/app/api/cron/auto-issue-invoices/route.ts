import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { issueInvoiceForRental } from "@/lib/invoices/issue"

/**
 * Cron de catch-up: pra locações COMPLETED/RETURNED + PAID que ainda não têm nota,
 * em empresas com `autoIssueOnRentalCompletion = true`, dispara emissão.
 *
 * O trigger inline (no return + payment change) cobre o caso normal — este cron
 * é safety net pra casos onde o trigger falhou (provider fora do ar, etc).
 *
 * Frequência sugerida: diário às 10h.
 */
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { verifyCronSecret } = await import("@/lib/cron-auth")
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Empresas com auto-emit ativo
    const configs = await prisma.companyTaxConfig.findMany({
      where: { autoIssueOnRentalCompletion: true },
      select: { companyId: true },
    })
    const companyIds = configs.map((c) => c.companyId)
    if (companyIds.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: "Nenhuma empresa com auto-emit" })
    }

    // Locações elegíveis: pagas, devolvidas/concluídas, sem nota ativa
    const candidates = await prisma.rental.findMany({
      where: {
        companyId: { in: companyIds },
        deletedAt: null,
        paymentStatus: "PAID",
        status: { in: ["RETURNED", "COMPLETED"] },
        invoices: {
          none: { status: { in: ["PENDING", "PROCESSING", "ISSUED"] } },
        },
      },
      select: { id: true, companyId: true },
      take: 100,
    })

    const results = await Promise.all(
      candidates.map((r) =>
        issueInvoiceForRental({
          rentalId: r.id,
          companyId: r.companyId,
          issuedByName: "Sistema (auto cron)",
        }).catch((err) => ({
          status: "error" as const,
          reason: (err as Error).message,
        }))
      )
    )

    const ok = results.filter((r) => r.status === "ok").length
    const errors = results.filter((r) => r.status === "error").length
    const skipped = results.filter((r) => r.status === "skipped").length

    return NextResponse.json({
      success: true,
      candidates: candidates.length,
      ok,
      skipped,
      errors,
    })
  } catch (error) {
    console.error("[auto-issue cron] error:", error)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
