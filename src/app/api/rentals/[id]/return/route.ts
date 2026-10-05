import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, requirePermission } from "@/lib/session"
import { sendTemplated, getRentalReturnedEmail } from "@/lib/notifications/email"
import { dispatchWebhooks } from "@/lib/webhooks"
import { z } from "zod"
import { diasDeAtraso } from "@/lib/diarias"

const returnSchema = z.object({
  returnNotes: z.string().optional(),
  damageDescription: z.string().optional(),
  // Nada negativo: dano de -500 virava desconto e fechava a locação com total negativo
  damageCost: z.number().min(0).optional(),
  additionalDays: z.number().int().min(0).optional(),
  additionalCost: z.number().min(0).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("rental.return")
    const companyId = user.companyId
    const { id } = await params
    const body = await request.json()
    const data = returnSchema.parse(body)

    const rental = await prisma.rental.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        items: true,
        customer: true,
        company: { select: { name: true, lateFeePercent: true } },
      },
    })

    if (!rental) {
      return NextResponse.json(
        { error: "Locação não encontrada" },
        { status: 404 }
      )
    }

    if (!["IN_PROGRESS", "OVERDUE"].includes(rental.status)) {
      return NextResponse.json(
        { error: "Esta locação não está ativa" },
        { status: 400 }
      )
    }

    const now = new Date()

    // Calcula multa por atraso baseada no actualEndDate vs expectedEndDate.
    // Antes: o cron `late-fees` rodava diariamente e atualizava `rental.lateFee`,
    // mas se o cliente devolveu antes do cron rodar OU se a janela de atraso
    // foi curta (poucas horas), a multa saía como 0. Agora calculamos no
    // momento da devolução pra garantir cobrança correta.
    // Atraso em DIAS DE CALENDÁRIO (horário de Brasília) contra a data prevista.
    // A data vem do formulário como "AAAA-MM-DD" e é gravada à meia-noite UTC —
    // 21h do dia anterior aqui. Comparar instantes cobrava 1 dia de multa de quem
    // devolvia NO dia combinado; e 3 dias e uns minutos viravam 4.
    const lateDays = diasDeAtraso(new Date(rental.expectedEndDate), now)
    let lateFee = 0
    if (lateDays > 0) {
      const lateFeePercent = Number(rental.company.lateFeePercent) // % ao dia
      const dailyFee = (Number(rental.total) * lateFeePercent) / 100
      lateFee = dailyFee * lateDays
    }

    const additionalTotal = (data.additionalCost || 0) + (data.damageCost || 0)
    const newTotal = Number(rental.total) + additionalTotal + lateFee

    const updatedRental = await prisma.$transaction(async (tx) => {
      // Atualizar locação — também grava lateDays/lateFee se houve atraso.
      // Re-lemos internalNotes do DB dentro da tx pra evitar overwrite caso
      // o operador tenha editado entre o load inicial e o commit.
      const fresh = await tx.rental.findUnique({
        where: { id },
        select: { internalNotes: true },
      })
      const noteAddition = data.returnNotes
        ? `\n\nNotas da devolução: ${data.returnNotes}${data.damageDescription ? `\nDanos: ${data.damageDescription}` : ""}`
        : ""

      const updated = await tx.rental.update({
        where: { id },
        data: {
          status: "RETURNED",
          actualEndDate: now,
          lateDays,
          lateFee,
          internalNotes: noteAddition ? `${fresh?.internalNotes || ""}${noteAddition}`.trim() : undefined,
          total: newTotal,
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

      // Liberar equipamentos
      for (const item of rental.items) {
        await tx.equipment.update({
          where: { id: item.equipmentId },
          data: {
            status: "AVAILABLE",
            totalRevenue: { increment: item.subtotal },
          },
        })
      }

      // Atualizar total gasto do cliente
      await tx.customer.update({
        where: { id: rental.customerId },
        data: {
          totalSpent: { increment: newTotal },
        },
      })

      // Atualizar receita da empresa
      await tx.company.update({
        where: { id: rental.companyId },
        data: {
          totalRevenue: { increment: newTotal },
        },
      })

      return updated
    })

    // Webhook de saída + email de confirmação (ambos fire-and-forget)
    void dispatchWebhooks({
      companyId,
      event: "rental.returned",
      data: {
        rentalId: rental.id,
        contractNumber: rental.contractNumber,
        customerId: rental.customerId,
        returnedAt: now.toISOString(),
        total: newTotal,
        damage: !!data.damageCost,
        damageCost: data.damageCost ?? 0,
      },
    })

    // Email de confirmação de devolução (não-bloqueante)
    if (rental.customer.email) {
      const formatBRL = (n: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
      sendTemplated(rental.customer.email, getRentalReturnedEmail, {
        customerName: rental.customer.name,
        contractNumber: rental.contractNumber,
        returnDate: now.toLocaleDateString("pt-BR"),
        total: formatBRL(newTotal),
        hasDamage: !!data.damageCost && data.damageCost > 0,
        damageValue: data.damageCost ? formatBRL(data.damageCost) : undefined,
        companyName: rental.company.name,
      }).catch((err) => console.error("[return] email failed:", err))
    }

    return NextResponse.json(updatedRental)
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
    console.error("Error returning rental:", error)
    return NextResponse.json(
      { error: "Erro ao registrar devolução" },
      { status: 500 }
    )
  }
}
