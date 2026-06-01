import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logAuthEvent } from "@/lib/audit"
import { PrismaClient } from "@prisma/client"
import { z } from "zod"

const baseClient: PrismaClient = (prisma as unknown as { $extends: unknown }) as PrismaClient

const verifySchema = z.object({
  token: z.string().min(20),
})

/**
 * Verifica o token enviado no email e marca `emailVerified` no usuário.
 *
 * Idempotente: se o token já foi usado, retorna sucesso (o cliente pode ter dado
 * F5 na página de confirmação).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = verifySchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { emailVerifyToken: token },
      select: {
        id: true,
        email: true,
        name: true,
        companyId: true,
        emailVerified: true,
        emailVerifyTokenExpiry: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 })
    }

    // Já verificado → idempotente, devolve sucesso
    if (user.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true })
    }

    if (user.emailVerifyTokenExpiry && user.emailVerifyTokenExpiry < new Date()) {
      return NextResponse.json(
        { error: "Token expirado. Solicite um novo email de verificação." },
        { status: 410 }
      )
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
      action: "PASSWORD_RESET_COMPLETED", // reusa enum existente; semantica é "verificação"
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
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
