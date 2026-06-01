import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"

export async function GET(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "overview" // overview, equipment, customers, rentals

    // Datas para periodos
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    if (type === "equipment") {
      // Relatorio de equipamentos
      const equipment = await prisma.equipment.findMany({
        where: { companyId, status: { not: "RETIRED" } },
        include: {
          category: true,
        },
      })

      const report = {
        total: equipment.length,
        porStatus: {
          available: equipment.filter(e => e.status === "AVAILABLE").length,
          rented: equipment.filter(e => e.status === "RENTED").length,
          maintenance: equipment.filter(e => e.status === "MAINTENANCE").length,
          reserved: equipment.filter(e => e.status === "RESERVED").length,
        },
        taxaOcupacao: equipment.length > 0
          ? (equipment.filter(e => e.status === "RENTED").length / equipment.length) * 100
          : 0,
        topEquipamentos: equipment
          .sort((a, b) => b.totalRentals - a.totalRentals)
          .slice(0, 10)
          .map(e => ({
            id: e.id,
            code: e.code,
            name: e.name,
            category: e.category.name,
            totalRentals: e.totalRentals,
            totalRevenue: Number(e.totalRevenue),
            totalDaysRented: e.totalDaysRented,
            status: e.status,
          })),
        porCategoria: equipment.reduce((acc, e) => {
          const cat = e.category.name
          if (!acc[cat]) acc[cat] = { count: 0, rented: 0 }
          acc[cat].count++
          if (e.status === "RENTED") acc[cat].rented++
          return acc
        }, {} as Record<string, { count: number; rented: number }>),
      }

      return NextResponse.json(report)
    }

    if (type === "customers") {
      // Relatorio de clientes
      const customers = await prisma.customer.findMany({
        where: { companyId, isBlocked: false },
      })

      const report = {
        total: customers.length,
        porCreditScore: {
          excellent: customers.filter(c => c.creditScore === "EXCELLENT").length,
          good: customers.filter(c => c.creditScore === "GOOD").length,
          regular: customers.filter(c => c.creditScore === "REGULAR").length,
          bad: customers.filter(c => c.creditScore === "BAD").length,
        },
        topClientes: customers
          .sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent))
          .slice(0, 10)
          .map(c => ({
            id: c.id,
            name: c.name,
            document: c.document,
            totalRentals: c.totalRentals,
            totalSpent: Number(c.totalSpent),
            totalPending: Number(c.totalPending),
            creditScore: c.creditScore,
          })),
        comPendencias: customers.filter(c => Number(c.totalPending) > 0).length,
        totalPendente: customers.reduce((sum, c) => sum + Number(c.totalPending), 0),
      }

      return NextResponse.json(report)
    }

    if (type === "rentals") {
      // Relatorio de locacoes
      const rentals = await prisma.rental.findMany({
        where: { companyId, deletedAt: null },
        include: {
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      const thisMonth = rentals.filter(r => r.createdAt >= startOfMonth)
      const thisYear = rentals.filter(r => r.createdAt >= startOfYear)

      // Agrupar por mes (ultimos 12 meses)
      const porMes = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
        const nextDate = new Date(now.getFullYear(), now.getMonth() - 10 + i, 1)
        const monthRentals = rentals.filter(r =>
          r.createdAt >= date && r.createdAt < nextDate
        )
        return {
          month: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          locacoes: monthRentals.length,
          receita: monthRentals.reduce((sum, r) => sum + Number(r.total), 0),
        }
      })

      const report = {
        total: rentals.length,
        mesMesAtual: thisMonth.length,
        anoAtual: thisYear.length,
        porStatus: {
          quote: rentals.filter(r => r.status === "QUOTE").length,
          confirmed: rentals.filter(r => r.status === "CONFIRMED").length,
          inProgress: rentals.filter(r => r.status === "IN_PROGRESS").length,
          overdue: rentals.filter(r => r.status === "OVERDUE").length,
          returned: rentals.filter(r => r.status === "RETURNED").length,
          completed: rentals.filter(r => r.status === "COMPLETED").length,
          cancelled: rentals.filter(r => r.status === "CANCELLED").length,
        },
        porMes,
        receitaTotal: rentals.reduce((sum, r) => sum + Number(r.total), 0),
        receitaMesAtual: thisMonth.reduce((sum, r) => sum + Number(r.total), 0),
        taxaAtraso: rentals.length > 0
          ? (rentals.filter(r => r.status === "OVERDUE").length / rentals.length) * 100
          : 0,
        ultimasLocacoes: rentals.slice(0, 10).map(r => ({
          id: r.id,
          contractNumber: r.contractNumber,
          customer: r.customer.name,
          total: Number(r.total),
          status: r.status,
          createdAt: r.createdAt,
        })),
      }

      return NextResponse.json(report)
    }

    // Overview geral
    const [equipment, customers, rentals, maintenances, company] = await Promise.all([
      prisma.equipment.count({ where: { companyId, status: { not: "RETIRED" } } }),
      prisma.customer.count({ where: { companyId, isBlocked: false } }),
      prisma.rental.findMany({
        where: { companyId, deletedAt: null },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
        },
      }),
      prisma.maintenance.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, status: true, totalCost: true },
      }),
      prisma.company.findUnique({
        where: { id: companyId },
        select: { totalRentals: true, totalRevenue: true },
      }),
    ])

    const thisMonthRentals = rentals.filter(r => r.createdAt >= startOfMonth)

    const overview = {
      kpis: {
        equipamentos: equipment,
        clientes: customers,
        locacoesAtivas: rentals.filter(r => ["IN_PROGRESS", "OVERDUE"].includes(r.status)).length,
        manutencoesAtivas: maintenances.filter(m => m.status === "IN_PROGRESS").length,
        receitaTotal: Number(company?.totalRevenue || 0),
        receitaMes: thisMonthRentals
          .filter(r => r.paymentStatus === "PAID")
          .reduce((sum, r) => sum + Number(r.total), 0),
        taxaOcupacao: equipment > 0
          ? (rentals.filter(r => r.status === "IN_PROGRESS").length / equipment) * 100
          : 0,
        taxaPagamento: rentals.length > 0
          ? (rentals.filter(r => r.paymentStatus === "PAID").length / rentals.length) * 100
          : 0,
      },
      alerts: {
        overdueRentals: rentals.filter(r => r.status === "OVERDUE").length,
        pendingPayments: rentals.filter(r => r.paymentStatus === "PENDING").length,
        maintenancesPending: maintenances.filter(m => m.status === "SCHEDULED").length,
      },
    }

    return NextResponse.json(overview)
  } catch (error) {
    console.error("Error fetching reports:", error)
    if (error instanceof Error && error.message === "Nao autorizado") {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar relatorios" },
      { status: 500 }
    )
  }
}
