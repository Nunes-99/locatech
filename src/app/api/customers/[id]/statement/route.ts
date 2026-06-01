import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"

/**
 * Extrato financeiro do cliente.
 *
 * Retorna:
 *   - dados básicos do cliente
 *   - todas as locações (incluindo histórico, exceto soft-deleted)
 *   - totais agregados (já existem em Customer.totalSpent/totalPending, mas recalcula
 *     do zero pra garantir consistência quando há ajustes manuais)
 *   - lista cronológica de eventos pra exibir como timeline
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("customer.view")
    const companyId = user.companyId
    const { id } = await params

    const customer = await prisma.customer.findFirst({
      where: { id, companyId },
    })

    if (!customer) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    }

    const rentals = await prisma.rental.findMany({
      where: { customerId: id, companyId, deletedAt: null },
      include: {
        items: {
          select: {
            id: true,
            equipmentCode: true,
            equipmentName: true,
            quantity: true,
            days: true,
            subtotal: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    let totalPaid = 0
    let totalPending = 0
    let totalOverdue = 0
    let totalLateFees = 0
    let activeDeposits = 0
    const statusCount: Record<string, number> = {}

    for (const r of rentals) {
      statusCount[r.status] = (statusCount[r.status] ?? 0) + 1
      const total = Number(r.total)
      const late = Number(r.lateFee)
      totalLateFees += late

      if (r.paymentStatus === "PAID") {
        totalPaid += total
      } else if (r.paymentStatus === "OVERDUE") {
        totalOverdue += total
      } else if (
        r.paymentStatus === "PENDING" ||
        r.paymentStatus === "PARTIAL"
      ) {
        totalPending += total
      }

      // Caução em locações ativas (ainda não devolvida)
      if (
        ["CONFIRMED", "IN_PROGRESS", "OVERDUE"].includes(r.status) &&
        r.depositPaid &&
        !r.depositReturned
      ) {
        activeDeposits += Number(r.depositAmount)
      }
    }

    // Timeline cronológica — útil pra renderizar como histórico visual
    const events: Array<{
      date: string
      type: "RENTAL_CREATED" | "RENTAL_STARTED" | "RENTAL_RETURNED" | "PAID"
      rentalId: string
      contractNumber: number
      amount?: number
      detail?: string
    }> = []

    for (const r of rentals) {
      events.push({
        date: r.createdAt.toISOString(),
        type: "RENTAL_CREATED",
        rentalId: r.id,
        contractNumber: r.contractNumber,
        amount: Number(r.total),
        detail: `${r.items.length} item(ns)`,
      })
      if (r.startDate.getTime() !== r.createdAt.getTime()) {
        events.push({
          date: r.startDate.toISOString(),
          type: "RENTAL_STARTED",
          rentalId: r.id,
          contractNumber: r.contractNumber,
        })
      }
      if (r.actualEndDate) {
        events.push({
          date: r.actualEndDate.toISOString(),
          type: "RENTAL_RETURNED",
          rentalId: r.id,
          contractNumber: r.contractNumber,
        })
      }
      if (r.paidAt) {
        events.push({
          date: r.paidAt.toISOString(),
          type: "PAID",
          rentalId: r.id,
          contractNumber: r.contractNumber,
          amount: Number(r.total),
          detail: r.paymentMethod || undefined,
        })
      }
    }
    events.sort((a, b) => (a.date < b.date ? 1 : -1))

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        document: customer.document,
        documentType: customer.documentType,
        phone: customer.phone,
        email: customer.email,
        creditScore: customer.creditScore,
        creditLimit: customer.creditLimit,
        isBlocked: customer.isBlocked,
        blockReason: customer.blockReason,
      },
      summary: {
        rentalsCount: rentals.length,
        totalPaid,
        totalPending,
        totalOverdue,
        totalLateFees,
        activeDeposits,
        currentBalance: totalPending + totalOverdue, // o que o cliente deve hoje
        statusCount,
      },
      rentals: rentals.map((r) => ({
        id: r.id,
        contractNumber: r.contractNumber,
        startDate: r.startDate,
        expectedEndDate: r.expectedEndDate,
        actualEndDate: r.actualEndDate,
        status: r.status,
        paymentStatus: r.paymentStatus,
        paymentMethod: r.paymentMethod,
        subtotal: Number(r.subtotal),
        deliveryFee: Number(r.deliveryFee),
        discount: Number(r.discount),
        lateFee: Number(r.lateFee),
        total: Number(r.total),
        depositAmount: Number(r.depositAmount),
        depositPaid: r.depositPaid,
        depositReturned: r.depositReturned,
        itemsCount: r.items.length,
        items: r.items,
        createdAt: r.createdAt,
      })),
      events,
    })
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado") return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("Error building statement:", error)
    return NextResponse.json({ error: "Erro ao gerar extrato" }, { status: 500 })
  }
}
