import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId é obrigatório" },
        { status: 400 }
      )
    }

    // Buscar estatísticas em paralelo
    const [
      equipmentStats,
      rentalStats,
      customerStats,
      maintenanceStats,
      recentRentals,
      upcomingMaintenances,
      overdueRentals,
    ] = await Promise.all([
      // Estatísticas de equipamentos
      prisma.equipment.groupBy({
        by: ["status"],
        where: { companyId },
        _count: true,
      }),

      // Estatísticas de locações
      prisma.rental.groupBy({
        by: ["status"],
        where: { companyId },
        _count: true,
        _sum: { total: true },
      }),

      // Estatísticas de clientes
      prisma.customer.aggregate({
        where: { companyId },
        _count: true,
        _sum: { totalSpent: true, totalPending: true },
      }),

      // Estatísticas de manutenções
      prisma.maintenance.groupBy({
        by: ["status"],
        where: { companyId },
        _count: true,
        _sum: { totalCost: true },
      }),

      // Locações recentes
      prisma.rental.findMany({
        where: { companyId },
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

      // Manutenções próximas
      prisma.maintenance.findMany({
        where: {
          companyId,
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

      // Locações atrasadas
      prisma.rental.findMany({
        where: {
          companyId,
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

    // Processar estatísticas de equipamentos
    const equipmentTotal = equipmentStats.reduce((sum, s) => sum + s._count, 0)
    const equipmentAvailable = equipmentStats.find(s => s.status === "AVAILABLE")?._count || 0
    const equipmentRented = equipmentStats.find(s => s.status === "RENTED")?._count || 0
    const equipmentMaintenance = equipmentStats.find(s => s.status === "MAINTENANCE")?._count || 0

    // Processar estatísticas de locações
    const rentalsActive = rentalStats
      .filter(s => ["IN_PROGRESS", "OVERDUE"].includes(s.status))
      .reduce((sum, s) => sum + s._count, 0)
    const rentalsOverdue = rentalStats.find(s => s.status === "OVERDUE")?._count || 0
    const rentalsTotal = rentalStats.reduce((sum, s) => sum + s._count, 0)
    const revenueTotal = rentalStats.reduce((sum, s) => sum + Number(s._sum.total || 0), 0)

    // Processar estatísticas de manutenções
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
    console.error("Error fetching dashboard:", error)
    return NextResponse.json(
      { error: "Erro ao buscar dados do dashboard" },
      { status: 500 }
    )
  }
}
