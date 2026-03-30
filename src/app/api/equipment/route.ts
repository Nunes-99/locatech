import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { z } from "zod"

const createEquipmentSchema = z.object({
  categoryId: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
  dailyRate: z.number().positive(),
  weeklyRate: z.number().positive().optional().nullable(),
  monthlyRate: z.number().positive().optional().nullable(),
  depositAmount: z.number().positive().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchaseValue: z.number().positive().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get("categoryId")
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    const equipment = await prisma.equipment.findMany({
      where: {
        companyId,
        ...(categoryId ? { categoryId } : {}),
        ...(status ? { status: status as any } : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
                { brand: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        category: true,
      },
      orderBy: { code: "asc" },
    })

    return NextResponse.json(equipment)
  } catch (error) {
    console.error("Error fetching equipment:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar equipamentos" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const body = await request.json()
    const data = createEquipmentSchema.parse(body)

    // Verificar se código já existe
    const existing = await prisma.equipment.findUnique({
      where: {
        companyId_code: {
          companyId,
          code: data.code,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Já existe um equipamento com este código" },
        { status: 400 }
      )
    }

    const equipment = await prisma.equipment.create({
      data: {
        ...data,
        companyId,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json(equipment, { status: 201 })
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
    console.error("Error creating equipment:", error)
    return NextResponse.json(
      { error: "Erro ao criar equipamento" },
      { status: 500 }
    )
  }
}
