import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { verifyTotpCode } from "@/lib/totp"
import { consumeBackupCode } from "@/lib/backup-codes"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { logAuthEvent } from "@/lib/audit"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { z } from "zod"

const baseClient: PrismaClient = (prisma as unknown as { $extends: unknown }) as PrismaClient

/**
 * Desativa 2FA. Exige confirmação dupla:
 *   - Código TOTP atual (ou backup code)
 *   - Senha atual
 *
 * Após desativação:
 *   - totpSecret/totpEnabledAt/totpBackupCodes/totpPendingSecret limpos
 *   - sessões antigas invalidadas (defesa contra atacante que rebaixou 2FA
 *     mantendo a sessão)
 *   - audit log TWO_FA_DISABLED
 *
 * Rate limit: 5 tentativas / 15min / user — sem isso, atacante com sessão+senha
 * pode brute-forçar os 1M valores TOTP (3M com epochTolerance).
 */
const schema = z.object({
  code: z.string().min(6),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireAuth()

    const rl = rateLimit({
      key: `2fa-disable:${sessionUser.id}`,
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
    const { code, password } = schema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        companyId: true,
        passwordHash: true,
        totpSecret: true,
        totpBackupCodes: true,
      },
    })

    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Usuário sem senha definida" }, { status: 400 })
    }
    if (!user.totpSecret) {
      return NextResponse.json({ error: "2FA não está ativa" }, { status: 400 })
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash)
    if (!passwordOk) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 400 })
    }

    // Aceita TOTP de 6 dígitos OU backup code (hashed)
    let totpOk = false
    if (/^\d{6}$/.test(code.trim())) {
      totpOk = await verifyTotpCode(code, user.totpSecret)
    } else if (user.totpBackupCodes.length > 0) {
      const r = consumeBackupCode(code, user.totpBackupCodes)
      totpOk = r.matched
      // Se usou backup code, removeria do array — mas estamos desativando
      // tudo logo abaixo, então não precisa atualizar separadamente.
    }
    if (!totpOk) {
      return NextResponse.json({ error: "Código 2FA inválido" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        totpSecret: null,
        totpEnabledAt: null,
        totpBackupCodes: [],
        totpPendingSecret: null,
        // Invalida sessões — se atacante desativou 2FA, perde acesso.
        tokensInvalidatedAt: new Date(),
      },
    })

    await logAuthEvent(baseClient, {
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "TWO_FA_DISABLED",
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent") || undefined,
    })

    return NextResponse.json({
      success: true,
      message: "2FA desativada. Sessões antigas foram revogadas — faça login novamente.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos" },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("[2fa disable] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
