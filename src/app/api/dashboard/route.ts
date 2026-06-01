import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"

export async function GET(_request: NextRequest) {
  try {
    const companyId = await requireCompanyId()

    const [
      equipmentStats,
      rentalStats,
      customerStats,
      maintenanceStats,
      recentRentals,
      upcomingMaintenances,
      overdueRentals,
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
        include: {
          customer: true,
          items: {
            include: {
              equipment: true,
            },
          },
        },
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
        include: {
          equipment: true,
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
        include: {
          customer: true,
          items: {
            include: {
              equipment: true,
            },
          },
        },
        take: 10,
      }),
    ])

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
      customers: {
        total: customerStats._count,
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
