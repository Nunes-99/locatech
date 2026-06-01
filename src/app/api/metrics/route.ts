import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Endpoint de métricas internas — formato Prometheus text exposition.
 *
 * Protegido por `METRICS_TOKEN` (Bearer). Sem o env var, retorna 503.
 *
 * Saída no formato Prometheus (https://prometheus.io/docs/instrumenting/exposition_formats/)
 * pra facilitar scraping. Cada métrica tem TYPE e HELP comments.
 *
 * Cuidado: queries simples por desempenho. Não é dashboard analytico — é health.
 */
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const expected = process.env.METRICS_TOKEN
  if (!expected) {
    return new NextResponse("metrics endpoint not configured", { status: 503 })
  }
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${expected}`) {
    return new NextResponse("unauthorized", { status: 401 })
  }

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [
      companies,
      users,
      equipment,
      customers,
      rentalsActive,
      rentalsOverdue,
      rentals24h,
      loginFails24h,
      loginSuccess24h,
      webhookFailures24h,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.equipment.count(),
      prisma.customer.count(),
      prisma.rental.count({
        where: { status: { in: ["IN_PROGRESS", "OVERDUE"] }, deletedAt: null },
      }),
      prisma.rental.count({
        where: { status: "OVERDUE", deletedAt: null },
      }),
      prisma.rental.count({ where: { createdAt: { gte: since24h } } }),
      prisma.accessLog.count({ where: { success: false, createdAt: { gte: since24h } } }),
      prisma.accessLog.count({ where: { success: true, createdAt: { gte: since24h } } }),
      prisma.webhook.aggregate({
        _sum: { failureCount: true },
        where: { lastFailureAt: { gte: since24h } },
      }),
    ])

    const planDist = await prisma.company.groupBy({
      by: ["plan"],
      _count: { plan: true },
    })

    const lines: string[] = []

    // Companies
    lines.push("# HELP locatech_companies_total Total de empresas cadastradas")
    lines.push("# TYPE locatech_companies_total gauge")
    lines.push(`locatech_companies_total ${companies}`)

    // Por plano
    lines.push("# HELP locatech_companies_by_plan Empresas agrupadas por plano")
    lines.push("# TYPE locatech_companies_by_plan gauge")
    for (const pc of planDist) {
      lines.push(`locatech_companies_by_plan{plan="${pc.plan}"} ${pc._count.plan}`)
    }

    // Users, equipment, customers
    lines.push("# TYPE locatech_users_total gauge")
    lines.push(`locatech_users_total ${users}`)
    lines.push("# TYPE locatech_equipment_total gauge")
    lines.push(`locatech_equipment_total ${equipment}`)
    lines.push("# TYPE locatech_customers_total gauge")
    lines.push(`locatech_customers_total ${customers}`)

    // Rentals
    lines.push("# HELP locatech_rentals_active Locações em andamento ou atrasadas")
    lines.push("# TYPE locatech_rentals_active gauge")
    lines.push(`locatech_rentals_active ${rentalsActive}`)
    lines.push("# TYPE locatech_rentals_overdue gauge")
    lines.push(`locatech_rentals_overdue ${rentalsOverdue}`)
    lines.push("# HELP locatech_rentals_created_24h Locações criadas nas últimas 24h")
    lines.push("# TYPE locatech_rentals_created_24h counter")
    lines.push(`locatech_rentals_created_24h ${rentals24h}`)

    // Segurança
    lines.push("# HELP locatech_login_failures_24h Tentativas de login falhadas (24h)")
    lines.push("# TYPE locatech_login_failures_24h counter")
    lines.push(`locatech_login_failures_24h ${loginFails24h}`)
    lines.push("# TYPE locatech_login_successes_24h counter")
    lines.push(`locatech_login_successes_24h ${loginSuccess24h}`)

    // Webhooks
    lines.push("# HELP locatech_webhook_failures_24h Falhas acumuladas em webhooks (24h)")
    lines.push("# TYPE locatech_webhook_failures_24h counter")
    lines.push(`locatech_webhook_failures_24h ${webhookFailures24h._sum.failureCount ?? 0}`)

    // Process
    if (typeof process.uptime === "function") {
      lines.push("# HELP locatech_process_uptime_seconds Uptime do processo")
      lines.push("# TYPE locatech_process_uptime_seconds gauge")
      lines.push(`locatech_process_uptime_seconds ${Math.round(process.uptime())}`)
    }

    return new NextResponse(lines.join("\n") + "\n", {
      headers: {
        "Content-Type": "text/plain; version=0.0.4",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[metrics] error:", error)
    return new NextResponse(`# scrape error: ${(error as Error).message}\n`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    })
  }
}
