import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { z } from "zod"

const createMaintenanceSchema = z.object({
  equipmentId: z.string().uuid(),
  type: z.enum(["PREVENTIVE", "CORRECTIVE", "INSPECTION"]),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  laborCost: z.number().min(0).optional(),
  partsCost: z.number().min(0).optional(),
  scheduledDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const equipmentId = searchParams.get("equipmentId")
    const type = searchParams.get("type")

    const maintenances = await prisma.maintenance.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(status && status !== "all" ? { status: status as any } : {}),
        ...(equipmentId ? { equipmentId } : {}),
        ...(type && type !== "all" ? { type: type as any } : {}),
      },
      include: {
        equipment: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { scheduledDate: "desc" },
    })

    return NextResponse.json(maintenances)
  } catch (error) {
    console.error("Error fetching maintenances:", error)
    if (error instanceof Error && error.message === "Nao autorizado") {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar manutencoes" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const body = await request.json()
    const data = createMaintenanceSchema.parse(body)

    // Verificar se equipamento existe e pertence a empresa
    const equipment = await prisma.equipment.findFirst({
      where: { id: data.equipmentId, companyId },
    })

    if (!equipment) {
      return NextResponse.json(
        { error: "Equipamento nao encontrado" },
        { status: 404 }
      )
    }

    const laborCost = data.laborCost || 0
    const partsCost = data.partsCost || 0
    const totalCost = laborCost + partsCost

    // Criar manutencao
    const maintenance = await prisma.$transaction(async (tx) => {
      const newMaintenance = await tx.maintenance.create({
        data: {
          companyId,
          equipmentId: data.equipmentId,
          type: data.type,
          title: data.title,
          description: data.description,
          laborCost,
          partsCost,
          totalCost,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
          notes: data.notes,
          status: "SCHEDULED",
        },
        include: {
          equipment: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
            },
          },
        },
      })

      // Se for manutencao corretiva imediata, atualizar status do equipamento
      if (data.type === "CORRECTIVE" && !data.scheduledDate) {
        await tx.equipment.update({
          where: { id: data.equipmentId },
          data: { status: "MAINTENANCE" },
        })

        await tx.maintenance.update({
          where: { id: newMaintenance.id },
          data: { status: "IN_PROGRESS", startedAt: new Date() },
        })
      }

      return newMaintenance
    })

    return NextResponse.json(maintenance, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados invalidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Nao autorizado") {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }
    console.error("Error creating maintenance:", error)
    return NextResponse.json(
      { error: "Erro ao criar manutencao" },
      { status: 500 }
    )
  }
}
