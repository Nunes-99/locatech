import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, requirePermission } from "@/lib/session"
import { canPerform } from "@/lib/permissions"
import { maybeAutoIssue } from "@/lib/invoices/issue"
import { RentalStatus, PaymentStatus } from "@prisma/client"
import { z } from "zod"

const updateRentalSchema = z.object({
  expectedEndDate: z.string().optional(),
  deliveryAddress: z.string().optional(),
  depositAmount: z.number().optional(),
  notes: z.string().optional(),
  status: z.enum(["QUOTE", "CONFIRMED", "IN_PROGRESS", "OVERDUE", "RETURNED", "COMPLETED", "CANCELLED"]).optional(),
  paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE", "REFUNDED"]).optional(),
})

/**
 * Matriz de transições de status permitidas via PUT.
 *
 * Notas importantes:
 *   - Não há caminho pra `RETURNED` via PUT — `RETURNED` só é setado pelo
 *     endpoint dedicado POST /api/rentals/[id]/return (que devolve
 *     equipamento, calcula lateFee, baixa caução).
 *   - `RETURNED → COMPLETED` via PUT é permitido como passo de fechamento
 *     administrativo (sem side effects além de marcar finalizado).
 *   - `COMPLETED` e `CANCELLED` são terminais.
 *   - `CANCELLED` requer permissão extra `rental.cancel`.
 */
const ALLOWED_STATUS_TRANSITIONS: Record<RentalStatus, RentalStatus[]> = {
  QUOTE: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["OVERDUE", "CANCELLED"],
  OVERDUE: ["IN_PROGRESS", "CANCELLED"],
  RETURNED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
}

/**
 * Transições permitidas pra paymentStatus. PAID é terminal aqui — reembolsos
 * passam por um fluxo dedicado (a fazer) que registra movimento de caixa.
 */
const ALLOWED_PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["PARTIAL", "PAID", "OVERDUE"],
  PARTIAL: ["PAID"],
  OVERDUE: ["PARTIAL", "PAID"],
  PAID: ["REFUNDED"],
  REFUNDED: [],
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const { id } = await params

    const rental = await prisma.rental.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        customer: true,
        items: {
          include: {
            equipment: true,
          },
        },
      },
    })

    if (!rental) {
      return NextResponse.json(
        { error: "Locação não encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json(rental)
  } catch (error) {
    console.error("Error fetching rental:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar locação" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("rental.update")
    const companyId = user.companyId
    const { id } = await params
    const body = await request.json()
    const data = updateRentalSchema.parse(body)

    const existing = await prisma.rental.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        items: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Locação não encontrada" },
        { status: 404 }
      )
    }

    // Valida transição de status
    if (data.status && data.status !== existing.status) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status as RentalStatus] || []
      if (!allowed.includes(data.status as RentalStatus)) {
        return NextResponse.json(
          {
            error: `Transição inválida: ${existing.status} → ${data.status}. ` +
              `Permitidas: ${allowed.length ? allowed.join(", ") : "(nenhuma — estado final)"}.` +
              (data.status === "RETURNED" || data.status === "COMPLETED"
                ? " Use POST /api/rentals/[id]/return."
                : ""),
          },
          { status: 409 }
        )
      }
      // Cancelar locação exige permissão extra
      if (data.status === "CANCELLED" && !canPerform(user.role, "rental.cancel")) {
        return NextResponse.json(
          { error: "Permissão insuficiente pra cancelar locações" },
          { status: 403 }
        )
      }
    }

    // Valida transição de paymentStatus
    if (data.paymentStatus && data.paymentStatus !== existing.paymentStatus) {
      const allowed =
        ALLOWED_PAYMENT_TRANSITIONS[existing.paymentStatus as PaymentStatus] || []
      if (!allowed.includes(data.paymentStatus as PaymentStatus)) {
        return NextResponse.json(
          {
            error: `Transição de pagamento inválida: ${existing.paymentStatus} → ${data.paymentStatus}. ` +
              `Permitidas: ${allowed.length ? allowed.join(", ") : "(nenhuma — estado final)"}.`,
          },
          { status: 409 }
        )
      }
    }

    const rental = await prisma.$transaction(async (tx) => {
      const updated = await tx.rental.update({
        where: { id },
        data: {
          ...data,
          expectedEndDate: data.expectedEndDate ? new Date(data.expectedEndDate) : undefined,
          ...(data.paymentStatus === "PAID" && existing.paymentStatus !== "PAID"
            ? { paidAt: new Date() }
            : {}),
        },
        include: {
          customer: true,
          items: {
            include: {
              equipment: true,
            },
          },
        },
      })

      // Se cancelado, liberar equipamentos — só desocupa os que estavam em RENTED
      // dessa locação (updateMany com guarda evita pisar em equipamento que já
      // foi para MAINTENANCE/DAMAGED por outro fluxo).
      if (data.status === "CANCELLED" && existing.status !== "CANCELLED") {
        for (const item of existing.items) {
          await tx.equipment.updateMany({
            where: {
              id: item.equipmentId,
              companyId,
              status: "RENTED",
            },
            data: { status: "AVAILABLE" },
          })
        }
      }

      return updated
    })

    // Se pagamento foi marcado como PAID, dispara auto-emit (idempotente)
    if (data.paymentStatus === "PAID" && existing.paymentStatus !== "PAID") {
      void maybeAutoIssue(rental.id, companyId).catch((err) =>
        console.error("[rental PUT] maybeAutoIssue falhou:", err)
      )
    }

    return NextResponse.json(rental)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error) {
      if (error.message === "Não autorizado") {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      }
      if (error.message === "Acesso negado") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
      }
    }
    console.error("Error updating rental:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar locação" },
      { status: 500 }
    )
  }
}
