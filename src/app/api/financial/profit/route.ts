import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"

/**
 * Dashboard de lucro detalhado.
 *
 * Modelo de custo simplificado (assumido pelo schema atual):
 *   - Receita = soma de `total + lateFee` das locações com `paymentStatus = PAID`
 *     no período (data de devolução / actualEndDate, ou createdAt se ainda em andamento).
 *   - Custos diretos = soma de `Maintenance.totalCost` no período (status COMPLETED).
 *   - Lucro bruto = receita - custos.
 *   - Margem = lucro / receita.
 *
 * Aquisição (Equipment.purchaseValue) não entra como custo porque é despesa única.
 * Pra trabalhar com amortização seria preciso adicionar `usefulLifeMonths` ao schema.
 */

function startOfMonthsAgo(monthsAgo: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("financial.view")
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const monthsParam = parseInt(searchParams.get("months") || "12", 10)
    const months = Math.min(36, Math.max(1, monthsParam))

    const since = startOfMonthsAgo(months - 1)

    // Receita: locações pagas no período. Usar actualEndDate quando disponível,
    // senão createdAt (cobre orçamentos pagos antecipadamente também).
    const rentals = await prisma.rental.findMany({
      where: {
        companyId,
        deletedAt: null,
        paymentStatus: "PAID",
        OR: [
          { actualEndDate: { gte: since } },
          { AND: [{ actualEndDate: null }, { createdAt: { gte: since } }] },
        ],
      },
      select: {
        id: true,
        contractNumber: true,
        total: true,
        lateFee: true,
        createdAt: true,
        actualEndDate: true,
        items: {
          select: {
            equipmentId: true,
            equipmentCode: true,
            equipmentName: true,
            subtotal: true,
          },
        },
      },
    })

    const maintenances = await prisma.maintenance.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: "COMPLETED",
        OR: [{ completedAt: { gte: since } }, { AND: [{ completedAt: null }, { createdAt: { gte: since } }] }],
      },
      select: {
        id: true,
        equipmentId: true,
        totalCost: true,
        completedAt: true,
        createdAt: true,
      },
    })

    const expenses = await prisma.equipmentExpense.findMany({
      where: {
        companyId,
        incurredAt: { gte: since },
      },
      select: {
        id: true,
        equipmentId: true,
        amount: true,
        incurredAt: true,
      },
    })

    // Agrupa por mês YYYY-MM
    function monthKey(d: Date): string {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    }

    const byMonth: Record<string, { revenue: number; cost: number; rentals: number }> = {}
    for (let i = months - 1; i >= 0; i--) {
      byMonth[monthKey(startOfMonthsAgo(i))] = { revenue: 0, cost: 0, rentals: 0 }
    }

    for (const r of rentals) {
      const dt = r.actualEndDate ?? r.createdAt
      const key = monthKey(dt)
      if (byMonth[key]) {
        byMonth[key].revenue += Number(r.total) + Number(r.lateFee)
        byMonth[key].rentals += 1
      }
    }
    for (const m of maintenances) {
      const dt = m.completedAt ?? m.createdAt
      const key = monthKey(dt)
      if (byMonth[key]) byMonth[key].cost += Number(m.totalCost)
    }
    for (const e of expenses) {
      const key = monthKey(e.incurredAt)
      if (byMonth[key]) byMonth[key].cost += Number(e.amount)
    }

    const evolution = Object.entries(byMonth).map(([month, v]) => ({
      month,
      revenue: v.revenue,
      cost: v.cost,
      profit: v.revenue - v.cost,
      margin: v.revenue > 0 ? (v.revenue - v.cost) / v.revenue : 0,
      rentals: v.rentals,
    }))

    // Por equipamento: agrega receita (RentalItem) e custo (Maintenance)
    const revByEquip = new Map<
      string,
      { code: string; name: string; revenue: number; rentals: number }
    >()
    for (const r of rentals) {
      for (const item of r.items) {
        const cur = revByEquip.get(item.equipmentId) ?? {
          code: item.equipmentCode,
          name: item.equipmentName,
          revenue: 0,
          rentals: 0,
        }
        cur.revenue += Number(item.subtotal)
        cur.rentals += 1
        revByEquip.set(item.equipmentId, cur)
      }
    }

    const costByEquip = new Map<string, number>()
    for (const m of maintenances) {
      costByEquip.set(m.equipmentId, (costByEquip.get(m.equipmentId) ?? 0) + Number(m.totalCost))
    }
    for (const e of expenses) {
      costByEquip.set(e.equipmentId, (costByEquip.get(e.equipmentId) ?? 0) + Number(e.amount))
    }

    const equipmentIds = new Set([...revByEquip.keys(), ...costByEquip.keys()])
    const equipmentDetails = equipmentIds.size
      ? await prisma.equipment.findMany({
          where: { id: { in: Array.from(equipmentIds) } },
          select: { id: true, code: true, name: true, brand: true },
        })
      : []
    const detailById = new Map(equipmentDetails.map((e) => [e.id, e]))

    const perEquipment = Array.from(equipmentIds).map((id) => {
      const rev = revByEquip.get(id)
      const cost = costByEquip.get(id) ?? 0
      const detail = detailById.get(id)
      const revenue = rev?.revenue ?? 0
      const profit = revenue - cost
      return {
        equipmentId: id,
        code: rev?.code ?? detail?.code ?? "—",
        name: rev?.name ?? detail?.name ?? "—",
        brand: detail?.brand ?? null,
        revenue,
        cost,
        profit,
        margin: revenue > 0 ? profit / revenue : 0,
        rentals: rev?.rentals ?? 0,
      }
    })

    const topByRevenue = [...perEquipment].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    const topByMargin = [...perEquipment]
      .filter((e) => e.revenue > 0)
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 10)

    // Totais
    const totalRevenue = evolution.reduce((s, m) => s + m.revenue, 0)
    const totalCost = evolution.reduce((s, m) => s + m.cost, 0)
    const totalProfit = totalRevenue - totalCost
    const totalRentals = evolution.reduce((s, m) => s + m.rentals, 0)

    return NextResponse.json({
      period: { months, since: since.toISOString() },
      totals: {
        revenue: totalRevenue,
        cost: totalCost,
        profit: totalProfit,
        margin: totalRevenue > 0 ? totalProfit / totalRevenue : 0,
        rentals: totalRentals,
        averageTicket: totalRentals > 0 ? totalRevenue / totalRentals : 0,
      },
      evolution,
      topByRevenue,
      topByMargin,
    })
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado") return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("Error computing profit:", error)
    return NextResponse.json({ error: "Erro ao calcular lucro" }, { status: 500 })
  }
}
