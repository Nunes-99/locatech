import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateMaintenanceSchema = z.object({
  type: z.enum(["PREVENTIVE", "CORRECTIVE", "INSPECTION"]).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  scheduledDate: z.string().optional(),
  startDate: z.string().optional(),
  completedDate: z.string().optional(),
  laborCost: z.number().optional(),
  partsCost: z.number().optional(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  notes: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const maintenance = await prisma.maintenance.findUnique({
      where: { id },
      include: {
        equipment: true,
      },
    })

    if (!maintenance) {
      return NextResponse.json(
        { error: "Manutenção não encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json(maintenance)
  } catch (error) {
    console.error("Error fetching maintenance:", error)
    return NextResponse.json(
      { error: "Erro ao buscar manutenção" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateMaintenanceSchema.parse(body)

    const existing = await prisma.maintenance.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Manutenção não encontrada" },
        { status: 404 }
      )
    }

    const laborCost = data.laborCost ?? Number(existing.laborCost)
    const partsCost = data.partsCost ?? Number(existing.partsCost)
    const totalCost = Number(laborCost) + Number(partsCost)

    // Destructure to remove date strings and use proper field names
    const { scheduledDate, startDate, completedDate, ...restData } = data

    const maintenance = await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenance.update({
        where: { id },
        data: {
          ...restData,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
          startedAt: startDate ? new Date(startDate) : undefined,
          completedAt: completedDate ? new Date(completedDate) : undefined,
          totalCost,
        },
        include: {
          equipment: true,
        },
      })

      // Se manutenção foi iniciada, atualizar status do equipamento
      if (data.status === "IN_PROGRESS" && existing.status === "SCHEDULED") {
        await tx.equipment.update({
          where: { id: existing.equipmentId },
          data: { status: "MAINTENANCE" },
        })
      }

      // Se manutenção foi concluída, atualizar equipamento para disponível
      if (data.status === "COMPLETED" && existing.status !== "COMPLETED") {
        await tx.equipment.update({
          where: { id: existing.equipmentId },
          data: {
            status: "AVAILABLE",
          },
        })
      }

      return updated
    })

    return NextResponse.json(maintenance)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error updating maintenance:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar manutenção" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.maintenance.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Manutenção não encontrada" },
        { status: 404 }
      )
    }

    if (existing.status === "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Não é possível excluir manutenção em andamento" },
        { status: 400 }
      )
    }

    await prisma.maintenance.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Manutenção excluída com sucesso" })
  } catch (error) {
    console.error("Error deleting maintenance:", error)
    return NextResponse.json(
      { error: "Erro ao excluir manutenção" },
      { status: 500 }
    )
  }
}
