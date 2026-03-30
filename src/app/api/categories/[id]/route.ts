import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { z } from "zod"

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const { id } = await params

    const category = await prisma.equipmentCategory.findFirst({
      where: { id, companyId },
      include: {
        equipment: true,
        _count: {
          select: { equipment: true },
        },
      },
    })

    if (!category) {
      return NextResponse.json(
        { error: "Categoria não encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error("Error fetching category:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar categoria" },
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
    const data = updateCategorySchema.parse(body)

    const existing = await prisma.equipmentCategory.findFirst({
      where: { id, companyId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Categoria não encontrada" },
        { status: 404 }
      )
    }

    // Se nome foi alterado, verificar duplicidade
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.equipmentCategory.findFirst({
        where: {
          companyId,
          name: data.name,
          NOT: { id },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "Já existe uma categoria com este nome" },
          { status: 400 }
        )
      }
    }

    const category = await prisma.equipmentCategory.update({
      where: { id },
      data,
    })

    return NextResponse.json(category)
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
    console.error("Error updating category:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar categoria" },
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

    const existing = await prisma.equipmentCategory.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: { equipment: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Categoria não encontrada" },
        { status: 404 }
      )
    }

    if (existing._count.equipment > 0) {
      return NextResponse.json(
        { error: "Categoria possui equipamentos vinculados" },
        { status: 400 }
      )
    }

    await prisma.equipmentCategory.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Categoria excluída com sucesso" })
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("Error deleting category:", error)
    return NextResponse.json(
      { error: "Erro ao excluir categoria" },
      { status: 500 }
    )
  }
}
