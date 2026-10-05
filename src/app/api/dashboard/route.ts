import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import type { RentalStatus } from "@prisma/client"

export async function GET(_request: NextRequest) {
  try {
    const companyId = await requireCompanyId()

    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
    const daquiDoisDias = new Date(agora.getTime() + 2 * 24 * 60 * 60 * 1000)
    // Orçamento e cancelada não são faturamento
    const faturavel = { companyId, deletedAt: null, status: { notIn: ["QUOTE", "CANCELLED"] as RentalStatus[] } }
    // Só o necessário para a tela (nada de CPF/telefone do cliente no JSON)
    const resumoLocacao = {
      id: true,
      contractNumber: true,
      status: true,
      startDate: true,
      expectedEndDate: true,
      total: true,
      customer: { select: { name: true } },
      items: { select: { equipment: { select: { name: true } } } },
    } as const

    const [
      equipmentStats,
      rentalStats,
      customerStats,
      maintenanceStats,
      recentRentals,
      upcomingMaintenances,
      overdueRentals,
      faturamentoMes,
      faturamentoMesAnterior,
      clientesAtivos,
      vencendo,
    ] = await Promise.all([
      prisma.equipment.groupBy({
        by: ["status"],
        where: { companyId },
        _count: true,
      }),

      prisma.rental.groupBy({
        by: ["status"],
        where: { companyId, deletedAt: null },
        _count: true,
        _sum: { total: true },
      }),

      prisma.customer.aggregate({
        where: { companyId },
        _count: true,
        _sum: { totalSpent: true, totalPending: true },
      }),

      prisma.maintenance.groupBy({
        by: ["status"],
        where: { companyId, deletedAt: null },
        _count: true,
        _sum: { totalCost: true },
      }),

      prisma.rental.findMany({
        where: { companyId, deletedAt: null },
        select: resumoLocacao,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      prisma.maintenance.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: "SCHEDULED",
          scheduledDate: {
            gte: new Date(),
          },
        },
        select: {
          id: true,
          type: true,
          scheduledDate: true,
          equipment: { select: { name: true, code: true } },
        },
        orderBy: { scheduledDate: "asc" },
        take: 5,
      }),

      prisma.rental.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: "OVERDUE",
        },
        select: resumoLocacao,
        orderBy: { expectedEndDate: "asc" },
        take: 10,
      }),

      prisma.rental.aggregate({
        where: { ...faturavel, startDate: { gte: inicioMes } },
        _sum: { total: true },
      }),

      prisma.rental.aggregate({
        where: { ...faturavel, startDate: { gte: inicioMesAnterior, lt: inicioMes } },
        _sum: { total: true },
      }),

      prisma.rental.findMany({
        where: { companyId, deletedAt: null, status: { in: ["IN_PROGRESS", "OVERDUE"] } },
        select: { customerId: true },
        distinct: ["customerId"],
      }),

      prisma.rental.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: "IN_PROGRESS",
          expectedEndDate: { gte: agora, lte: daquiDoisDias },
        },
        select: resumoLocacao,
        orderBy: { expectedEndDate: "asc" },
        take: 5,
      }),
    ])

    const mes = Number(faturamentoMes._sum.total || 0)
    const mesAnterior = Number(faturamentoMesAnterior._sum.total || 0)

    const equipmentTotal = equipmentStats.reduce((sum, s) => sum + s._count, 0)
    const equipmentAvailable = equipmentStats.find(s => s.status === "AVAILABLE")?._count || 0
    const equipmentRented = equipmentStats.find(s => s.status === "RENTED")?._count || 0
    const equipmentMaintenance = equipmentStats.find(s => s.status === "MAINTENANCE")?._count || 0

    const rentalsActive = rentalStats
      .filter(s => ["IN_PROGRESS", "OVERDUE"].includes(s.status))
      .reduce((sum, s) => sum + s._count, 0)
    const rentalsOverdue = rentalStats.find(s => s.status === "OVERDUE")?._count || 0
    const rentalsTotal = rentalStats.reduce((sum, s) => sum + s._count, 0)
    const revenueTotal = rentalStats.reduce((sum, s) => sum + Number(s._sum.total || 0), 0)

    const maintenanceScheduled = maintenanceStats.find(s => s.status === "SCHEDULED")?._count || 0
    const maintenanceInProgress = maintenanceStats.find(s => s.status === "IN_PROGRESS")?._count || 0
    const maintenanceCost = maintenanceStats.reduce((sum, s) => sum + Number(s._sum.totalCost || 0), 0)

    return NextResponse.json({
      equipment: {
        total: equipmentTotal,
        available: equipmentAvailable,
        rented: equipmentRented,
        maintenance: equipmentMaintenance,
        utilizationRate: equipmentTotal > 0
          ? Math.round((equipmentRented / equipmentTotal) * 100)
          : 0,
      },
      rentals: {
        total: rentalsTotal,
        active: rentalsActive,
        overdue: rentalsOverdue,
        revenue: revenueTotal,
      },
      revenue: {
        month: mes,
        previousMonth: mesAnterior,
        // null quando não há base de comparação (mês anterior zerado)
        variation: mesAnterior > 0 ? Math.round(((mes - mesAnterior) / mesAnterior) * 1000) / 10 : null,
      },
      customers: {
        total: customerStats._count,
        withActiveRentals: clientesAtivos.length,
        totalSpent: customerStats._sum.totalSpent || 0,
        pendingAmount: customerStats._sum.totalPending || 0,
      },
      maintenance: {
        scheduled: maintenanceScheduled,
        inProgress: maintenanceInProgress,
        totalCost: maintenanceCost,
      },
      recentRentals,
      upcomingMaintenances,
      overdueRentals,
      endingSoon: vencendo,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("Error fetching dashboard:", error)
    return NextResponse.json(
      { error: "Erro ao buscar dados do dashboard" },
      { status: 500 }
    )
  }
}
