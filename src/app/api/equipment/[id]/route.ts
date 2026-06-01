import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, requirePermission } from "@/lib/session"
import { z } from "zod"
import { Prisma, EquipmentStatus } from "@prisma/client"

function unauthorizedResponse(error: Error) {
  const status = (error as Error & { status?: number }).status
  if (error.message === "Não autorizado") return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  if (status === 403 || error.message === "Acesso negado")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  return null
}

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
  status: z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED"]).optional(),
})

/**
 * Transições permitidas via PUT manual. RENTED e RESERVED são controlados
 * pelo fluxo de locação (POST /api/rentals + return) — operador NÃO pode
 * setar manualmente, senão quebra invariantes (equipamento "AVAILABLE" no
 * sistema mas com rental IN_PROGRESS referenciando ele).
 */
const ALLOWED_EQUIPMENT_TRANSITIONS: Record<EquipmentStatus, EquipmentStatus[]> = {
  AVAILABLE: ["MAINTENANCE", "RETIRED"],
  MAINTENANCE: ["AVAILABLE", "RETIRED"],
  RENTED: [], // não muda manualmente; só via flow de devolução
  RESERVED: [], // idem
  RETIRED: [], // terminal
}

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
    const user = await requirePermission("equipment.update")
    const companyId = user.companyId
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

    // Valida transição de status — bloqueia voltas inválidas e mudanças manuais
    // em RENTED/RESERVED (esses são controlados pelo fluxo de locação).
    if (data.status && data.status !== existing.status) {
      const allowed = ALLOWED_EQUIPMENT_TRANSITIONS[existing.status] || []
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          {
            error:
              `Transição inválida: ${existing.status} → ${data.status}. ` +
              (existing.status === "RENTED" || existing.status === "RESERVED"
                ? "Status RENTED/RESERVED é gerenciado pelo fluxo de locação (POST /api/rentals e POST /api/rentals/[id]/return)."
                : `Permitidas: ${allowed.length ? allowed.join(", ") : "(nenhuma — estado final)"}.`),
          },
          { status: 409 }
        )
      }
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

    // Histórico de preços: registra mudanças em dailyRate/weeklyRate/monthlyRate
    const priceChanged =
      (data.dailyRate !== undefined && !existing.dailyRate.equals(new Prisma.Decimal(data.dailyRate))) ||
      (data.weeklyRate !== undefined &&
        !(existing.weeklyRate ?? new Prisma.Decimal(0)).equals(new Prisma.Decimal(data.weeklyRate ?? 0))) ||
      (data.monthlyRate !== undefined &&
        !(existing.monthlyRate ?? new Prisma.Decimal(0)).equals(new Prisma.Decimal(data.monthlyRate ?? 0)))

    if (priceChanged) {
      await prisma.equipmentPriceHistory.create({
        data: {
          companyId,
          equipmentId: id,
          oldDailyRate: existing.dailyRate,
          newDailyRate: data.dailyRate !== undefined ? new Prisma.Decimal(data.dailyRate) : existing.dailyRate,
          oldWeeklyRate: existing.weeklyRate,
          newWeeklyRate:
            data.weeklyRate !== undefined && data.weeklyRate !== null
              ? new Prisma.Decimal(data.weeklyRate)
              : existing.weeklyRate,
          oldMonthlyRate: existing.monthlyRate,
          newMonthlyRate:
            data.monthlyRate !== undefined && data.monthlyRate !== null
              ? new Prisma.Decimal(data.monthlyRate)
              : existing.monthlyRate,
          changedBy: user.id,
          changedByName: user.name,
        },
      })
    }

    return NextResponse.json(equipment)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error) {
      const r = unauthorizedResponse(error)
      if (r) return r
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
    const user = await requirePermission("equipment.delete")
    const companyId = user.companyId
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
    if (error instanceof Error) {
      const r = unauthorizedResponse(error)
      if (r) return r
    }
    console.error("Error deleting equipment:", error)
    return NextResponse.json(
      { error: "Erro ao desativar equipamento" },
      { status: 500 }
    )
  }
}
