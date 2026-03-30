import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, getSession } from "@/lib/session"
import { z } from "zod"

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(["OWNER", "ADMIN", "OPERATOR"]).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await requireCompanyId()

    const user = await prisma.user.findFirst({
      where: {
        id: params.id,
        companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        emailVerified: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error fetching user:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar usuário" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await requireCompanyId()
    const session = await getSession()

    // Only OWNER and ADMIN can update users
    const currentUser = await prisma.user.findUnique({
      where: { id: session?.user?.id },
      select: { role: true },
    })

    if (!currentUser || !["OWNER", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Sem permissão para editar usuários" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = updateUserSchema.parse(body)

    // Verify user belongs to company
    const existingUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        companyId,
      },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    // Can't change OWNER role unless you're the owner
    if (existingUser.role === "OWNER" && currentUser.role !== "OWNER") {
      return NextResponse.json(
        { error: "Não é possível editar o proprietário" },
        { status: 403 }
      )
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error updating user:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao atualizar usuário" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await requireCompanyId()
    const session = await getSession()

    // Only OWNER can delete users
    const currentUser = await prisma.user.findUnique({
      where: { id: session?.user?.id },
      select: { role: true },
    })

    if (!currentUser || currentUser.role !== "OWNER") {
      return NextResponse.json(
        { error: "Apenas o proprietário pode remover usuários" },
        { status: 403 }
      )
    }

    // Verify user belongs to company
    const existingUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        companyId,
      },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    // Can't delete yourself
    if (existingUser.id === session?.user?.id) {
      return NextResponse.json(
        { error: "Não é possível remover seu próprio usuário" },
        { status: 400 }
      )
    }

    // Can't delete OWNER
    if (existingUser.role === "OWNER") {
      return NextResponse.json(
        { error: "Não é possível remover o proprietário" },
        { status: 400 }
      )
    }

    await prisma.user.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao remover usuário" },
      { status: 500 }
    )
  }
}
