import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { logAuthEvent } from "@/lib/audit"
import { checkPasswordStrength } from "@/lib/validators"
import { PrismaClient } from "@prisma/client"

const baseClient: PrismaClient = (prisma as unknown as { $extends: unknown }) as PrismaClient

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 tentativas por 10min por IP
    const ip = getClientIp(request.headers)
    const rl = rateLimit({
      key: `reset:${ip}`,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${rl.retryAfterSeconds}s` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { token, password } = resetPasswordSchema.parse(body)

    const pwd = checkPasswordStrength(password)
    if (!pwd.ok) {
      return NextResponse.json(
        { error: pwd.errors.join(". ") },
        { status: 400 }
      )
    }

    // Token cru veio no link; no DB guardamos só o hash. Hash incoming e
    // compara contra `resetToken` (que já é o hash).
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: { gt: new Date() },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Token inválido ou expirado" },
        { status: 400 }
      )
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12)

    // Atualiza senha, limpa token de reset e invalida sessões antigas.
    // Reset de senha quase sempre indica suspeita de comprometimento —
    // forçamos logout em todos os dispositivos.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        tokensInvalidatedAt: new Date(),
      },
    })

    await logAuthEvent(baseClient, {
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "PASSWORD_RESET_COMPLETED",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
    })

    return NextResponse.json({ message: "Senha redefinida com sucesso" })
  } catch (error) {
    console.error("Reset password error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Erro ao redefinir senha" },
      { status: 500 }
    )
  }
}
