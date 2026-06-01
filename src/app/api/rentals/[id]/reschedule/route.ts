import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { z } from "zod"

const rescheduleSchema = z.object({
  daysDiff: z.number().int(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const { id } = await params
    const body = await request.json()
    const { daysDiff } = rescheduleSchema.parse(body)

    const rental = await prisma.rental.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    })

    if (!rental) {
      return NextResponse.json(
        { error: "Locação não encontrada" },
        { status: 404 }
      )
    }

    if (rental.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Apenas locações confirmadas podem ser reagendadas" },
        { status: 400 }
      )
    }

    const currentStartDate = new Date(rental.startDate)
    const currentEndDate = new Date(rental.expectedEndDate)

    const newStartDate = new Date(currentStartDate)
    newStartDate.setDate(newStartDate.getDate() + daysDiff)

    const newEndDate = new Date(currentEndDate)
    newEndDate.setDate(newEndDate.getDate() + daysDiff)

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    if (newStartDate < now) {
      return NextResponse.json(
        { error: "Não é possível reagendar para uma data passada" },
        { status: 400 }
      )
    }

    const updatedRental = await prisma.rental.update({
      where: { id },
      data: {
        startDate: newStartDate,
        expectedEndDate: newEndDate,
      },
    })

    return NextResponse.json(updatedRental)
  } catch (error) {
    console.error("Error rescheduling rental:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos" },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao reagendar locação" },
      { status: 500 }
    )
  }
}
