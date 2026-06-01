import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import {
  generateTotpSecret,
  buildOtpAuthUrl,
  verifyTotpCode,
  generateBackupCodes,
} from "@/lib/totp"
import { z } from "zod"

/**
 * Fluxo 2FA setup:
 *   1. POST sem body → server gera secret novo, retorna otpauthUrl + secret base32
 *      (cliente mostra QR code). Secret NÃO é salvo ainda — fica em sessão volátil
 *      via campo `totpSecret` mas com `totpEnabledAt = null`.
 *   2. POST com `{secret, code}` → valida que o código bate; se sim, ativa 2FA
 *      e devolve backup codes (exibidos uma vez).
 */

const activateSchema = z.object({
  secret: z.string().min(16),
  code: z.string().regex(/^\d{6}$/, "Código deve ter 6 dígitos"),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json().catch(() => ({}))

    // Modo 1: gerar secret
    if (!body.secret) {
      const secret = generateTotpSecret()
      const otpauthUrl = buildOtpAuthUrl(secret, user.email)
      return NextResponse.json({ secret, otpauthUrl })
    }

    // Modo 2: ativar
    const { secret, code } = activateSchema.parse(body)
    if (!(await verifyTotpCode(code, secret))) {
      return NextResponse.json(
        { error: "Código inválido. Verifique o relógio do dispositivo e tente novamente." },
        { status: 400 }
      )
    }

    const backupCodes = generateBackupCodes(10)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: secret,
        totpEnabledAt: new Date(),
        totpBackupCodes: backupCodes,
      },
    })

    return NextResponse.json({
      success: true,
      backupCodes,
      message:
        "2FA ativada. Guarde os códigos de backup em local seguro — eles permitem login se você perder o dispositivo.",
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
