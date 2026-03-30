import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/notifications/email"
import crypto from "crypto"

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

    await sendEmail({
      to: email,
      subject: "Redefinição de Senha - LocaTech",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>LocaTech</h1>
            </div>
            <div class="content">
              <h2>Olá, ${user.name}!</h2>
              <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
              <p>Clique no botão abaixo para criar uma nova senha:</p>
              <p style="text-align: center;">
                <a href="${resetLink}" class="button">Redefinir Senha</a>
              </p>
              <p><strong>Este link expira em 1 hora.</strong></p>
              <p>Se você não solicitou a redefinição de senha, ignore este e-mail.</p>
            </div>
            <div class="footer">
              <p>Este é um e-mail automático. Por favor, não responda.</p>
              <p>LocaTech - Sistema de Gestão para Locadoras</p>
            </div>
          </div>
        </body>
        </html>
      `,
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
