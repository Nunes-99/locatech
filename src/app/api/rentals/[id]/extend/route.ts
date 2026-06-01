import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { z } from "zod"

const extendSchema = z.object({
  /** Quantidade de dias adicionais a estender o contrato. */
  additionalDays: z.number().int().positive().max(365),
  /** Forçar valor extra manual em vez de recalcular (ex: cortesia, desconto). */
  manualAdditionalAmount: z.number().min(0).optional(),
  /** Observação livre (vai pra internalNotes com timestamp). */
  reason: z.string().max(500).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("rental.update")
    const companyId = user.companyId
    const { id } = await params
    const body = await request.json()
    const { additionalDays, manualAdditionalAmount, reason } = extendSchema.parse(body)

    const rental = await prisma.rental.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true },
    })

    if (!rental) {
      return NextResponse.json({ error: "Locação não encontrada" }, { status: 404 })
    }

    // Só faz sentido estender locações que estão em andamento, confirmadas ou atrasadas.
    // Devolvidas/concluídas/canceladas precisariam de nova locação.
    if (!["CONFIRMED", "IN_PROGRESS", "OVERDUE"].includes(rental.status)) {
      return NextResponse.json(
        {
          error: `Não é possível estender uma locação com status ${rental.status}. Crie uma nova locação.`,
        },
        { status: 400 }
      )
    }

    // Recalcula o valor extra: soma das (dailyRate * quantity * additionalDays) dos itens,
    // a menos que o operador tenha passado um valor manual.
    let additionalAmount = 0
    if (manualAdditionalAmount !== undefined) {
      additionalAmount = manualAdditionalAmount
    } else {
      for (const item of rental.items) {
        additionalAmount += Number(item.dailyRate) * item.quantity * additionalDays
      }
    }

    const newExpectedEndDate = new Date(rental.expectedEndDate)
    newExpectedEndDate.setDate(newExpectedEndDate.getDate() + additionalDays)

    // Determina o lateFee/lateDays APÓS a extensão. Se estava OVERDUE e a
    // nova data é futura, a extensão "perdoa" o atraso → zera. Caso contrário,
    // mantém. Compute aqui e use o MESMO valor em newTotal e no update — antes
    // havia bug: newTotal somava o lateFee antigo mas o update zerava, total
    // não batia com sum-of-parts.
    const willClearLateFee =
      rental.status === "OVERDUE" && newExpectedEndDate > new Date()
    const newLateFee = willClearLateFee ? 0 : Number(rental.lateFee)
    const newLateDays = willClearLateFee ? 0 : rental.lateDays

    const newSubtotal = Number(rental.subtotal) + additionalAmount
    const newTotal =
      newSubtotal +
      Number(rental.deliveryFee) -
      Number(rental.discount) +
      newLateFee

    const noteLine = `[${new Date().toLocaleString("pt-BR")}] Locação estendida em ${additionalDays} dia(s) por ${user.name}. Valor extra: R$ ${additionalAmount.toFixed(2)}.${
      reason ? ` Motivo: ${reason}` : ""
    }`

    const updatedRental = await prisma.$transaction(async (tx) => {
      const updated = await tx.rental.update({
        where: { id },
        data: {
          expectedEndDate: newExpectedEndDate,
          subtotal: newSubtotal,
          total: newTotal,
          internalNotes: rental.internalNotes
            ? `${rental.internalNotes}\n${noteLine}`
            : noteLine,
          // Se estava OVERDUE e a nova data é futura, volta pra IN_PROGRESS
          status: willClearLateFee ? "IN_PROGRESS" : rental.status,
          lateFee: newLateFee,
          lateDays: newLateDays,
        },
        include: {
          customer: true,
          items: {
            include: { equipment: true },
          },
        },
      })

      // Atualiza cada item: soma os dias e o subtotal proporcional
      for (const item of rental.items) {
        const itemAdditional =
          manualAdditionalAmount !== undefined
            ? 0 // se valor manual, não distribui pelos itens — fica só no rental
            : Number(item.dailyRate) * item.quantity * additionalDays

        await tx.rentalItem.update({
          where: { id: item.id },
          data: {
            days: item.days + additionalDays,
            subtotal: Number(item.subtotal) + itemAdditional,
          },
        })
      }

      return updated
    })

    return NextResponse.json({
      ...updatedRental,
      _extension: {
        additionalDays,
        additionalAmount,
        newExpectedEndDate: newExpectedEndDate.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado") return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("Error extending rental:", error)
    return NextResponse.json(
      { error: "Erro ao estender locação" },
      { status: 500 }
    )
  }
}
