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

    const normalizedEmail = String(email).toLowerCase().trim()
    const ip = getClientIp(request.headers)

    // Dois rate limits independentes:
    //   - Por IP (3/hora): impede um IP só de spamar muitos emails
    //   - Por EMAIL (5/dia): impede botnet de floodar caixa de um alvo
    const rlIp = rateLimit({
      key: `forgot:ip:${ip}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    })
    if (!rlIp.allowed) {
      return NextResponse.json(
        { error: `Muitas solicitações. Tente novamente em ${Math.ceil((rlIp.retryAfterSeconds || 60) / 60)} min.` },
        { status: 429 }
      )
    }
    const rlEmail = rateLimit({
      key: `forgot:email:${normalizedEmail}`,
      limit: 5,
      windowMs: 24 * 60 * 60 * 1000,
    })
    if (!rlEmail.allowed) {
      // Resposta genérica — não revela se o email existe
      return NextResponse.json({ message: "E-mail enviado" })
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { company: { select: { name: true } } },
    })

    if (user) {
      // Token cru vai no email; hash SHA-256 vai pro DB. Dump do DB não
      // permite hijack — atacante precisaria do email pra usar o token.
      const rawToken = crypto.randomBytes(32).toString("hex")
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex")
      const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hora

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: hashedToken, resetTokenExpiry },
      })

      const resetLink = `${process.env.NEXTAUTH_URL}/redefinir-senha?token=${rawToken}`

      // Fire-and-forget — sem await. Sem isso, response time variava em
      // ~500ms entre "user existe" e "user não existe" (envio síncrono via
      // Resend), criando timing oracle pra enumeração de emails mesmo com
      // resposta unificada.
      void sendTemplated(normalizedEmail, getPasswordResetEmail, {
        userName: user.name,
        resetLink,
        companyName: user.company.name,
      }).catch((err) => console.error("[forgot-password] email failed:", err))

      void logAuthEvent(baseClient, {
        companyId: user.companyId,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        action: "PASSWORD_RESET_REQUESTED",
        ipAddress: ip,
        userAgent: request.headers.get("user-agent") || undefined,
      }).catch((err) => console.error("[forgot-password] audit failed:", err))
    }

    // Sempre devolve sucesso pra evitar enumeração — agora também com
    // tempo constante (sem await em sendTemplated/logAuthEvent).
    return NextResponse.json({ message: "E-mail enviado" })
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "Erro ao processar solicitação" },
      { status: 500 }
    )
  }
}
