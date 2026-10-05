import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, getSession, requirePermission } from "@/lib/session"
import { Role } from "@/lib/permissions"
import { z } from "zod"

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(["OWNER", "ADMIN", "OPERATOR"]).optional(),
})

/**
 * Regras de escalation:
 *   - Só OWNER pode atribuir role=OWNER (e só transferindo a posse — não cria 2 OWNERs).
 *   - OWNER pode atribuir qualquer role.
 *   - ADMIN só pode atribuir OPERATOR (ou manter ADMIN dele).
 *   - Ninguém pode mudar o próprio role (anti-self-promotion).
 *
 * Antes (BUG): ADMIN podia mudar qualquer user (não OWNER) pra qualquer role,
 * incluindo OWNER → 2 OWNERs ou auto-promoção pra OWNER.
 */
function canAssignRole(
  currentRole: Role,
  newRole: Role,
  isSelf: boolean,
  targetIsOwner: boolean
): { allowed: boolean; reason?: string } {
  if (isSelf) {
    return { allowed: false, reason: "Você não pode alterar seu próprio papel" }
  }
  if (targetIsOwner && currentRole !== "OWNER") {
    return { allowed: false, reason: "Apenas o proprietário pode editar o próprio papel" }
  }
  if (newRole === "OWNER" && currentRole !== "OWNER") {
    return { allowed: false, reason: "Apenas o proprietário atual pode designar outro proprietário" }
  }
  if (currentRole === "ADMIN" && newRole === "ADMIN") {
    // ADMIN promovendo outro user pra ADMIN — política conservadora: só OWNER.
    return { allowed: false, reason: "Apenas o proprietário pode criar ADMINs" }
  }
  return { allowed: true }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = (await requirePermission("user.view")).companyId

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
    if (error instanceof Error && error.message === "Acesso negado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
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

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const currentRole = session.user.role as Role
    if (!["OWNER", "ADMIN"].includes(currentRole)) {
      return NextResponse.json(
        { error: "Sem permissão para editar usuários" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = updateUserSchema.parse(body)

    const existingUser = await prisma.user.findFirst({
      where: { id: params.id, companyId },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    // Validação de mudança de role — esta é A camada crítica de RBAC.
    if (data.role && data.role !== existingUser.role) {
      const check = canAssignRole(
        currentRole,
        data.role as Role,
        existingUser.id === session.user.id,
        existingUser.role === "OWNER"
      )
      if (!check.allowed) {
        return NextResponse.json({ error: check.reason }, { status: 403 })
      }
    }

    // Editar campos não-role de outros usuários: ADMIN pode editar OPERATOR.
    // OWNER edita qualquer um. Ninguém edita OWNER (exceto outro OWNER).
    if (existingUser.role === "OWNER" && currentRole !== "OWNER") {
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

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Apenas o proprietário pode remover usuários" },
        { status: 403 }
      )
    }

    const existingUser = await prisma.user.findFirst({
      where: { id: params.id, companyId },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    if (existingUser.id === session.user.id) {
      return NextResponse.json(
        { error: "Não é possível remover seu próprio usuário" },
        { status: 400 }
      )
    }

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
