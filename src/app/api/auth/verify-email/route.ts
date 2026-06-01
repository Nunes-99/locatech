import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logAuthEvent } from "@/lib/audit"
import { getClientIp } from "@/lib/rate-limit"
import { PrismaClient } from "@prisma/client"
import { z } from "zod"
import crypto from "crypto"

const baseClient: PrismaClient = (prisma as unknown as { $extends: unknown }) as PrismaClient

const verifySchema = z.object({
  token: z.string().min(20),
})

/**
 * Verifica o token enviado no email e marca `emailVerified` no usuário.
 *
 * Idempotente: se o token já foi usado, retorna sucesso (cliente pode ter
 * dado F5 na página de confirmação).
 *
 * Token cru vai no link do email; no DB guardamos só o hash. Hash incoming
 * e compara contra `emailVerifyToken`.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = verifySchema.parse(body)

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    const user = await prisma.user.findUnique({
      where: { emailVerifyToken: hashedToken },
      select: {
        id: true,
        email: true,
        name: true,
        companyId: true,
        emailVerified: true,
        emailVerifyTokenExpiry: true,
      },
    })

    // Resposta unificada pra inválido/expirado — evita um atacante distinguir
    // "token real mas expirado" de "token nunca existiu" via leak de email.
    if (!user || (user.emailVerifyTokenExpiry && user.emailVerifyTokenExpiry < new Date())) {
      return NextResponse.json(
        { error: "Token inválido ou expirado. Solicite um novo email de verificação após o login." },
        { status: 400 }
      )
    }

    // Já verificado → idempotente
    if (user.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerifyToken: null,
        emailVerifyTokenExpiry: null,
      },
    })

    await logAuthEvent(baseClient, {
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "EMAIL_VERIFIED",
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent") || undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 })
    }
    console.error("[verify-email] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
