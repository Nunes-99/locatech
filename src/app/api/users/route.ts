import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, getSession, requirePermission } from "@/lib/session"
import { canAddUser, getUpgradeMessage } from "@/lib/plan-limits"
import { Role } from "@/lib/permissions"
import { z } from "zod"
import bcrypt from "bcryptjs"

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(["OWNER", "ADMIN", "OPERATOR"]),
})

export async function GET() {
  try {
    const companyId = (await requirePermission("user.view")).companyId

    const users = await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        emailVerified: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    if (error instanceof Error && error.message === "Acesso negado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar usuários" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const currentRole = session.user.role as Role
    if (!["OWNER", "ADMIN"].includes(currentRole)) {
      return NextResponse.json(
        { error: "Sem permissão para criar usuários" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = createUserSchema.parse(body)

    // RBAC de criação:
    //   - OWNER pode criar qualquer role (mas criar outro OWNER é não-padrão;
    //     deveria ser via "transferir posse" futuramente).
    //   - ADMIN só pode criar OPERATOR.
    if (currentRole === "ADMIN" && data.role !== "OPERATOR") {
      return NextResponse.json(
        { error: "ADMIN só pode criar usuários OPERATOR" },
        { status: 403 }
      )
    }
    if (data.role === "OWNER" && currentRole !== "OWNER") {
      return NextResponse.json(
        { error: "Apenas o proprietário pode designar outro proprietário" },
        { status: 403 }
      )
    }

    // Plan limit — antes podia ser bypassado criando 1 a 1 via UI
    const [company, userCount] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId }, select: { plan: true } }),
      prisma.user.count({ where: { companyId } }),
    ])
    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
    }
    if (!canAddUser(company.plan, userCount)) {
      return NextResponse.json(
        { error: getUpgradeMessage(company.plan, "users") },
        { status: 402 }
      )
    }

    const normalizedEmail = data.email.toLowerCase().trim()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Não foi possível criar — verifique os dados" },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: normalizedEmail,
        phone: data.phone,
        passwordHash,
        role: data.role,
        companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error("Error creating user:", error)
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
      { error: "Erro ao criar usuário" },
      { status: 500 }
    )
  }
}
