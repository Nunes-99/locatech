import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendTemplated, getPasswordResetEmail } from "@/lib/notifications/email"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { logAuthEvent } from "@/lib/audit"
import { PrismaClient } from "@prisma/client"
import crypto from "crypto"

const baseClient: PrismaClient = (prisma as unknown as { $extends: unknown }) as PrismaClient

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: "E-mail é obrigatório" },
        { status: 400 }
      )
    }

    // Rate limit: 3 pedidos por hora por IP
    const ip = getClientIp(request.headers)
    const rl = rateLimit({
      key: `forgot:${ip}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitas solicitações. Tente novamente em ${Math.ceil((rl.retryAfterSeconds || 60) / 60)} min.` },
        { status: 429 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: { select: { name: true } } },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ message: "E-mail enviado" })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour

    // Save token to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    })

    // Send email with reset link
    const resetLink = `${process.env.NEXTAUTH_URL}/redefinir-senha?token=${resetToken}`

    await sendTemplated(email, getPasswordResetEmail, {
      userName: user.name,
      resetLink,
      companyName: user.company.name,
    })

    await logAuthEvent(baseClient, {
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "PASSWORD_RESET_REQUESTED",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
    })

    return NextResponse.json({ message: "E-mail enviado" })
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "Erro ao processar solicitação" },
      { status: 500 }
    )
  }
}
