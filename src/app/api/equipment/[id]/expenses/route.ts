import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { z } from "zod"

const createSchema = z.object({
  type: z.enum(["FUEL", "TRANSPORT", "CLEANING", "CONSUMABLE", "TAX", "OTHER"]),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  incurredAt: z.string(),
  notes: z.string().max(2000).optional(),
})

async function ensureOwnership(equipmentId: string, companyId: string) {
  const eq = await prisma.equipment.findFirst({
    where: { id: equipmentId, companyId },
    select: { id: true },
  })
  if (!eq) throw new Error("EQUIPMENT_NOT_FOUND")
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("equipment.view")
    const { id } = await params
    await ensureOwnership(id, user.companyId)

    const expenses = await prisma.equipmentExpense.findMany({
      where: { equipmentId: id, companyId: user.companyId },
      orderBy: { incurredAt: "desc" },
    })

    return NextResponse.json(expenses)
  } catch (error) {
    return handle(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("equipment.update")
    const { id } = await params
    await ensureOwnership(id, user.companyId)

    const body = await request.json()
    const data = createSchema.parse(body)

    const expense = await prisma.equipmentExpense.create({
      data: {
        companyId: user.companyId,
        equipmentId: id,
        type: data.type,
        description: data.description,
        amount: data.amount,
        incurredAt: new Date(data.incurredAt),
        notes: data.notes ?? null,
        registeredBy: user.id,
        registeredByName: user.name,
      },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    return handle(error)
  }
}

function handle(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Dados inválidos", details: error.errors },
      { status: 400 }
    )
  }
  if (error instanceof Error) {
    if (error.message === "EQUIPMENT_NOT_FOUND")
      return NextResponse.json({ error: "Equipamento não encontrado" }, { status: 404 })
    const status = (error as Error & { status?: number }).status
    if (error.message === "Não autorizado")
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    if (status === 403 || error.message === "Acesso negado")
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  console.error("[expenses] error:", error)
  return NextResponse.json({ error: "Erro interno" }, { status: 500 })
}
