import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"

export async function GET(request: NextRequest) {
  try {
    const companyId = (await requirePermission("financial.view")).companyId
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "month" // week, month, year

    // Calcular datas do periodo
    const now = new Date()
    let startDate: Date

    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Buscar locacoes do periodo
    const rentals = await prisma.rental.findMany({
      where: {
        companyId,
        deletedAt: null,
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        total: true,
        depositAmount: true,
        lateFee: true,
        createdAt: true,
      },
    })

    // Buscar manutencoes do periodo
    const maintenances = await prisma.maintenance.findMany({
      where: {
        companyId,
        deletedAt: null,
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        totalCost: true,
        status: true,
        createdAt: true,
      },
    })

    // Buscar dados da empresa
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        totalRentals: true,
        totalRevenue: true,
      },
    })

    // Calcular metricas
    const totalReceitas = rentals
      .filter(r => r.paymentStatus === "PAID")
      .reduce((sum, r) => sum + Number(r.total) + Number(r.lateFee), 0)

    const totalPendente = rentals
      .filter(r => r.paymentStatus === "PENDING" || r.paymentStatus === "PARTIAL")
      .reduce((sum, r) => sum + Number(r.total), 0)

    const totalVencido = rentals
      .filter(r => r.paymentStatus === "OVERDUE")
      .reduce((sum, r) => sum + Number(r.total), 0)

    const totalManutencoes = maintenances
      .filter(m => m.status === "COMPLETED")
      .reduce((sum, m) => sum + Number(m.totalCost), 0)

    const totalCaucao = rentals
      .filter(r => ["IN_PROGRESS", "OVERDUE"].includes(r.status))
      .reduce((sum, r) => sum + Number(r.depositAmount), 0)

    // Agrupar por status de pagamento
    const porStatus = {
      paid: rentals.filter(r => r.paymentStatus === "PAID").length,
      pending: rentals.filter(r => r.paymentStatus === "PENDING").length,
      partial: rentals.filter(r => r.paymentStatus === "PARTIAL").length,
      overdue: rentals.filter(r => r.paymentStatus === "OVERDUE").length,
    }

    // Receitas por dia (ultimos 7 dias)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000)
      return date.toISOString().split("T")[0]
    })

    const receitasPorDia = last7Days.map(day => {
      const dayRentals = rentals.filter(r => {
        const rentalDate = new Date(r.createdAt).toISOString().split("T")[0]
        return rentalDate === day && r.paymentStatus === "PAID"
      })
      return {
        date: day,
        total: dayRentals.reduce((sum, r) => sum + Number(r.total), 0),
      }
    })

    // Resumo geral
    const summary = {
      period,
      totalReceitas,
      totalPendente,
      totalVencido,
      totalManutencoes,
      totalCaucao,
      lucroLiquido: totalReceitas - totalManutencoes,
      locacoesNovas: rentals.length,
      locacoesAtivas: rentals.filter(r => ["IN_PROGRESS", "OVERDUE"].includes(r.status)).length,
      ticketMedio: rentals.length > 0 ? totalReceitas / rentals.filter(r => r.paymentStatus === "PAID").length : 0,
      porStatus,
      receitasPorDia,
      totalHistorico: Number(company?.totalRevenue || 0),
      locacoesHistorico: company?.totalRentals || 0,
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error("Error fetching financial data:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    if (error instanceof Error && error.message === "Acesso negado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar dados financeiros" },
      { status: 500 }
    )
  }
}
