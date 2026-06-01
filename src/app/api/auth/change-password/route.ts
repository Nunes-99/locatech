import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { checkPasswordStrength } from "@/lib/validators"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { logAuthEvent } from "@/lib/audit"
import { PrismaClient } from "@prisma/client"
import { z } from "zod"
import bcrypt from "bcryptjs"

const baseClient: PrismaClient = (prisma as unknown as { $extends: unknown }) as PrismaClient

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Rate limit por user — impede brute force do `currentPassword` quando
    // atacante já tem o cookie de sessão mas não sabe a senha.
    const rl = rateLimit({
      key: `change-pwd:${session.user.id}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Tente em ${rl.retryAfterSeconds}s.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword } = changePasswordSchema.parse(body)

    const pwd = checkPasswordStrength(newPassword)
    if (!pwd.ok) {
      return NextResponse.json(
        { error: pwd.errors.join(". ") },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, companyId: true, passwordHash: true },
    })

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Usuário não encontrado ou sem senha definida" },
        { status: 404 }
      )
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Senha atual incorreta" },
        { status: 400 }
      )
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12)

    // Mudança de senha → invalida sessões antigas. Se o user mudou senha por
    // suspeita de comprometimento, atacante perde acesso imediatamente.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        tokensInvalidatedAt: new Date(),
      },
    })

    await logAuthEvent(baseClient, {
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "PASSWORD_CHANGED",
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent") || undefined,
    })

    return NextResponse.json({
      success: true,
      message: "Senha alterada com sucesso. Outras sessões foram desconectadas.",
    })
  } catch (error) {
    console.error("Error changing password:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Erro ao alterar senha" },
      { status: 500 }
    )
  }
}
