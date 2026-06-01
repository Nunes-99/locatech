import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { sendTemplated, getEmailVerifyEmail } from "@/lib/notifications/email"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import crypto from "crypto"

/**
 * Reenviar email de verificação. Rate-limitado por user pra evitar abuso.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireAuth()

    const rl = rateLimit({
      key: `verify-email-resend:${sessionUser.id}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitos pedidos. Aguarde ${Math.ceil((rl.retryAfterSeconds || 60) / 60)} min.` },
        { status: 429 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, email: true, name: true, emailVerified: true, company: { select: { name: true } } },
    })
    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    if (user.emailVerified) return NextResponse.json({ message: "Email já verificado" })

    const token = crypto.randomBytes(32).toString("hex")
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: token, emailVerifyTokenExpiry: expiry },
    })

    const verifyLink = `${process.env.NEXTAUTH_URL || ""}/verificar-email?token=${token}`

    await sendTemplated(user.email, getEmailVerifyEmail, {
      userName: user.name,
      verifyLink,
      companyName: user.company.name,
    })

    return NextResponse.json({ success: true, message: "Email de verificação enviado" })
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("[resend verify] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
