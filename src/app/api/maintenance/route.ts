import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createMaintenanceSchema = z.object({
  companyId: z.string().uuid(),
  equipmentId: z.string().uuid(),
  type: z.enum(["PREVENTIVE", "CORRECTIVE", "INSPECTION"]),
  title: z.string().min(1),
  description: z.string().optional(),
  scheduledDate: z.string(),
  laborCost: z.number().optional(),
  partsCost: z.number().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const equipmentId = searchParams.get("equipmentId")
    const status = searchParams.get("status")
    const type = searchParams.get("type")

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId é obrigatório" },
        { status: 400 }
      )
    }

    const maintenances = await prisma.maintenance.findMany({
      where: {
        companyId,
        ...(equipmentId ? { equipmentId } : {}),
        ...(status ? { status: status as any } : {}),
        ...(type ? { type: type as any } : {}),
      },
      include: {
        equipment: true,
      },
      orderBy: { scheduledDate: "desc" },
    })

    return NextResponse.json(maintenances)
  } catch (error) {
    console.error("Error fetching maintenances:", error)
    return NextResponse.json(
      { error: "Erro ao buscar manutenções" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createMaintenanceSchema.parse(body)

    // Verificar se equipamento existe
    const equipment = await prisma.equipment.findUnique({
      where: { id: data.equipmentId },
    })

    if (!equipment) {
      return NextResponse.json(
        { error: "Equipamento não encontrado" },
        { status: 400 }
      )
    }

    const totalCost = (data.laborCost || 0) + (data.partsCost || 0)

    const maintenance = await prisma.maintenance.create({
      data: {
        companyId: data.companyId,
        equipmentId: data.equipmentId,
        type: data.type,
        title: data.title,
        description: data.description,
        scheduledDate: new Date(data.scheduledDate),
        laborCost: data.laborCost || 0,
        partsCost: data.partsCost || 0,
        totalCost,
        notes: data.notes,
      },
      include: {
        equipment: true,
      },
    })

    return NextResponse.json(maintenance, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error creating maintenance:", error)
    return NextResponse.json(
      { error: "Erro ao criar manutenção" },
      { status: 500 }
    )
  }
}
