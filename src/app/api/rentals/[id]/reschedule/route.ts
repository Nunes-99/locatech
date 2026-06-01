import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { z } from "zod"

const rescheduleSchema = z.object({
  daysDiff: z.number().int(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await requireCompanyId()
    const body = await request.json()
    const { daysDiff } = rescheduleSchema.parse(body)

    // Find the rental
    const rental = await prisma.rental.findFirst({
      where: {
        id: params.id,
        companyId,
        deletedAt: null,
      },
    })

    if (!rental) {
      return NextResponse.json(
        { error: "Locacao nao encontrada" },
        { status: 404 }
      )
    }

    // Only allow rescheduling confirmed rentals
    if (rental.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Apenas locacoes confirmadas podem ser reagendadas" },
        { status: 400 }
      )
    }

    // Calculate new dates
    const currentStartDate = new Date(rental.startDate)
    const currentEndDate = new Date(rental.expectedEndDate)

    const newStartDate = new Date(currentStartDate)
    newStartDate.setDate(newStartDate.getDate() + daysDiff)

    const newEndDate = new Date(currentEndDate)
    newEndDate.setDate(newEndDate.getDate() + daysDiff)

    // Don't allow rescheduling to the past
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    if (newStartDate < now) {
      return NextResponse.json(
        { error: "Nao e possivel reagendar para uma data passada" },
        { status: 400 }
      )
    }

    // Update the rental
    const updatedRental = await prisma.rental.update({
      where: { id: params.id },
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
        { error: "Dados invalidos" },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Nao autorizado") {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao reagendar locacao" },
      { status: 500 }
    )
  }
}
