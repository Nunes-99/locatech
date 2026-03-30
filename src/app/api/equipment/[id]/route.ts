import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { z } from "zod"

const updateEquipmentSchema = z.object({
  categoryId: z.string().uuid().optional(),
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  dailyRate: z.number().positive().optional(),
  weeklyRate: z.number().positive().optional().nullable(),
  monthlyRate: z.number().positive().optional().nullable(),
  depositAmount: z.number().positive().optional().nullable(),
  status: z.enum(["AVAILABLE", "RENTED", "MAINTENANCE", "RESERVED", "RETIRED"]).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const { id } = await params

    const equipment = await prisma.equipment.findFirst({
      where: { id, companyId },
      include: {
        category: true,
        rentalItems: {
          include: {
            rental: {
              include: {
                customer: true,
              },
            },
          },
          take: 10,
          orderBy: { rental: { createdAt: "desc" } },
        },
        maintenances: {
          take: 5,
          orderBy: { scheduledDate: "desc" },
        },
      },
    })

    if (!equipment) {
      return NextResponse.json(
        { error: "Equipamento não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(equipment)
  } catch (error) {
    console.error("Error fetching equipment:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar equipamento" },
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
    const data = updateEquipmentSchema.parse(body)

    const existing = await prisma.equipment.findFirst({
      where: { id, companyId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Equipamento não encontrado" },
        { status: 404 }
      )
    }

    // Se código foi alterado, verificar duplicidade
    if (data.code && data.code !== existing.code) {
      const duplicate = await prisma.equipment.findUnique({
        where: {
          companyId_code: {
            companyId,
            code: data.code,
          },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "Já existe um equipamento com este código" },
          { status: 400 }
        )
      }
    }

    const equipment = await prisma.equipment.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    })

    return NextResponse.json(equipment)
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
    console.error("Error updating equipment:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar equipamento" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const { id } = await params

    const existing = await prisma.equipment.findFirst({
      where: { id, companyId },
      include: {
        rentalItems: {
          where: {
            rental: {
              status: { in: ["IN_PROGRESS", "CONFIRMED"] },
            },
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Equipamento não encontrado" },
        { status: 404 }
      )
    }

    if (existing.rentalItems.length > 0) {
      return NextResponse.json(
        { error: "Equipamento possui locações ativas" },
        { status: 400 }
      )
    }

    await prisma.equipment.update({
      where: { id },
      data: { status: "RETIRED" },
    })

    return NextResponse.json({ message: "Equipamento desativado com sucesso" })
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("Error deleting equipment:", error)
    return NextResponse.json(
      { error: "Erro ao desativar equipamento" },
      { status: 500 }
    )
  }
}
