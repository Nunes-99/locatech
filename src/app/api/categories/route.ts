import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { z } from "zod"

const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
})

export async function GET() {
  try {
    const companyId = await requireCompanyId()

    const categories = await prisma.equipmentCategory.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { equipment: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching categories:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar categorias" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const body = await request.json()
    const data = createCategorySchema.parse(body)

    // Verificar se nome já existe
    const existing = await prisma.equipmentCategory.findUnique({
      where: {
        companyId_name: { companyId, name: data.name },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Já existe uma categoria com este nome" },
        { status: 400 }
      )
    }

    const category = await prisma.equipmentCategory.create({
      data: {
        ...data,
        companyId,
      },
    })

    return NextResponse.json(category, { status: 201 })
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
    console.error("Error creating category:", error)
    return NextResponse.json(
      { error: "Erro ao criar categoria" },
      { status: 500 }
    )
  }
}
