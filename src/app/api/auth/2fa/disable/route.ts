import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { verifyTotpCode } from "@/lib/totp"
import bcrypt from "bcryptjs"
import { z } from "zod"

/**
 * Desativa 2FA. Exige confirmação dupla:
 *   - Código TOTP atual (ou backup code)
 *   - Senha atual
 *
 * Isso protege contra alguém que pegou a sessão mas não conhece senha+device.
 */
const schema = z.object({
  code: z.string().min(6),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireAuth()
    const body = await request.json()
    const { code, password } = schema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { passwordHash: true, totpSecret: true, totpBackupCodes: true },
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

    const totpOk =
      (await verifyTotpCode(code, user.totpSecret)) ||
      user.totpBackupCodes.includes(code.trim().toLowerCase())
    if (!totpOk) {
      return NextResponse.json({ error: "Código 2FA inválido" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        totpSecret: null,
        totpEnabledAt: null,
        totpBackupCodes: [],
      },
    })

    return NextResponse.json({ success: true })
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
