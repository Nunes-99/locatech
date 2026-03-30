import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { z } from "zod"

const returnSchema = z.object({
  returnNotes: z.string().optional(),
  damageDescription: z.string().optional(),
  damageCost: z.number().optional(),
  additionalDays: z.number().optional(),
  additionalCost: z.number().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const { id } = await params
    const body = await request.json()
    const data = returnSchema.parse(body)

    const rental = await prisma.rental.findFirst({
      where: { id, companyId },
      include: {
        items: true,
        customer: true,
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
    const additionalTotal = (data.additionalCost || 0) + (data.damageCost || 0)
    const newTotal = Number(rental.total) + additionalTotal

    const updatedRental = await prisma.$transaction(async (tx) => {
      // Atualizar locação
      const updated = await tx.rental.update({
        where: { id },
        data: {
          status: "RETURNED",
          actualEndDate: now,
          internalNotes: data.returnNotes ? `${rental.internalNotes || ""}\n\nNotas da devolução: ${data.returnNotes}${data.damageDescription ? `\nDanos: ${data.damageDescription}` : ""}`.trim() : undefined,
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

    return NextResponse.json(updatedRental)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("Error returning rental:", error)
    return NextResponse.json(
      { error: "Erro ao registrar devolução" },
      { status: 500 }
    )
  }
}
