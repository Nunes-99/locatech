import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { z } from "zod"

const updateRentalSchema = z.object({
  expectedEndDate: z.string().optional(),
  deliveryAddress: z.string().optional(),
  depositAmount: z.number().optional(),
  notes: z.string().optional(),
  status: z.enum(["QUOTE", "CONFIRMED", "IN_PROGRESS", "OVERDUE", "RETURNED", "COMPLETED", "CANCELLED"]).optional(),
  paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE"]).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const { id } = await params

    const rental = await prisma.rental.findFirst({
      where: { id, companyId },
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
    const companyId = await requireCompanyId()
    const { id } = await params
    const body = await request.json()
    const data = updateRentalSchema.parse(body)

    const existing = await prisma.rental.findFirst({
      where: { id, companyId },
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

    const rental = await prisma.$transaction(async (tx) => {
      const updated = await tx.rental.update({
        where: { id },
        data: {
          ...data,
          expectedEndDate: data.expectedEndDate ? new Date(data.expectedEndDate) : undefined,
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

      // Se cancelado, liberar equipamentos
      if (data.status === "CANCELLED" && existing.status !== "CANCELLED") {
        for (const item of existing.items) {
          await tx.equipment.update({
            where: { id: item.equipmentId },
            data: { status: "AVAILABLE" },
          })
        }
      }

      return updated
    })

    return NextResponse.json(rental)
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
    console.error("Error updating rental:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar locação" },
      { status: 500 }
    )
  }
}
