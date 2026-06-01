import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

async function requireAdmin(): Promise<{ id: string; email: string; name: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Não autorizado")
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!user) throw new Error("Não autorizado")
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean)
  if (!adminEmails.includes(user.email)) throw new Error("Acesso negado")
  return { id: user.id, email: user.email, name: user.name }
}

const updateSchema = z.object({
  plan: z.enum(["FREE", "STARTER", "PRO"]).optional(),
  planExpiresAt: z.string().optional().nullable(),
  /** Suspende a empresa revogando todas as sessões dos usuários. */
  suspend: z.boolean().optional(),
  /** Cancela a suspensão. */
  reactivate: z.boolean().optional(),
})

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            equipment: true,
            customers: true,
            rentals: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            tokensInvalidatedAt: true,
            createdAt: true,
          },
        },
      },
    })

    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
    }

    return NextResponse.json(company)
  } catch (error) {
    return handle(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const company = await prisma.company.findUnique({ where: { id } })
    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (data.plan) updates.plan = data.plan
    if (data.planExpiresAt !== undefined) {
      updates.planExpiresAt = data.planExpiresAt ? new Date(data.planExpiresAt) : null
    }

    // Suspender = força logout de todos os usuários da empresa
    if (data.suspend) {
      await prisma.user.updateMany({
        where: { companyId: id },
        data: { tokensInvalidatedAt: new Date() },
      })
    }

    if (Object.keys(updates).length > 0) {
      await prisma.company.update({ where: { id }, data: updates })
    }

    // Notificar (audit log já é capturado pelo Prisma extension via updateMany de User)
    console.log(`[admin] ${admin.email} altered company ${id}:`, {
      ...data,
      timestamp: new Date().toISOString(),
    })

    const updated = await prisma.company.findUnique({ where: { id } })
    return NextResponse.json({
      success: true,
      company: updated,
      suspended: !!data.suspend,
    })
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
    if (error.message === "Não autorizado")
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    if (error.message === "Acesso negado")
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  console.error("[admin company patch] error:", error)
  return NextResponse.json({ error: "Erro interno" }, { status: 500 })
}
