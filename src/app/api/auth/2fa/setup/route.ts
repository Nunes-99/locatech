import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import {
  generateTotpSecret,
  buildOtpAuthUrl,
  verifyTotpCode,
} from "@/lib/totp"
import { generateBackupCodes } from "@/lib/backup-codes"
import { logAuthEvent } from "@/lib/audit"
import { PrismaClient } from "@prisma/client"
import { z } from "zod"

const baseClient: PrismaClient = (prisma as unknown as { $extends: unknown }) as PrismaClient

/**
 * Fluxo 2FA setup (versão endurecida):
 *
 *   1. POST sem body → server gera secret novo, **grava em `totpPendingSecret`**
 *      (não retorna ao cliente como string verificável depois — só pra montar QR).
 *      Retorna `otpauthUrl` + `secret` pro QR code.
 *   2. POST com `{code}` → server lê `totpPendingSecret` do DB e valida o código
 *      contra ele. Se OK, move pra `totpSecret` e gera backup codes.
 *
 * Por que: na versão antiga o servidor aceitava `secret` do body na ativação.
 * Atacante com sessão podia montar setup, gerar código a partir DO PRÓPRIO
 * secret e enviar ambos — o servidor confiava e atrelava 2FA ao secret do
 * atacante. Agora o servidor controla o secret end-to-end.
 */
const activateSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Código deve ter 6 dígitos"),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json().catch(() => ({}))

    // Modo 1: gerar secret e gravar como pending
    if (!body.code) {
      const secret = generateTotpSecret()
      await prisma.user.update({
        where: { id: user.id },
        data: { totpPendingSecret: secret },
      })
      const otpauthUrl = buildOtpAuthUrl(secret, user.email)
      return NextResponse.json({ secret, otpauthUrl })
    }

    // Modo 2: ativar (lê secret do DB, ignora qualquer secret do body)
    const { code } = activateSchema.parse(body)

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { totpPendingSecret: true, totpEnabledAt: true },
    })
    if (!dbUser?.totpPendingSecret) {
      return NextResponse.json(
        { error: "Setup 2FA não iniciado. Gere um QR code primeiro." },
        { status: 400 }
      )
    }
    if (dbUser.totpEnabledAt) {
      return NextResponse.json(
        { error: "2FA já está ativada nesta conta." },
        { status: 409 }
      )
    }

    if (!(await verifyTotpCode(code, dbUser.totpPendingSecret))) {
      return NextResponse.json(
        { error: "Código inválido. Verifique o relógio do dispositivo e tente novamente." },
        { status: 400 }
      )
    }

    const { plain: plainBackupCodes, hashed: hashedBackupCodes } = generateBackupCodes(10)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: dbUser.totpPendingSecret,
        totpPendingSecret: null,
        totpEnabledAt: new Date(),
        totpBackupCodes: hashedBackupCodes,
      },
    })

    await logAuthEvent(baseClient, {
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "TWO_FA_ENABLED",
      userAgent: request.headers.get("user-agent") || undefined,
    })

    return NextResponse.json({
      success: true,
      backupCodes: plainBackupCodes,
      message:
        "2FA ativada. Guarde os códigos de backup em local seguro — eles permitem login se você perder o dispositivo. Cada código só funciona uma vez.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("[2fa setup] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
