import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import bcrypt from "bcryptjs"

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = resetPasswordSchema.parse(body)

    // Find user with valid token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Token inválido ou expirado" },
        { status: 400 }
      )
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12)

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    return NextResponse.json({ message: "Senha redefinida com sucesso" })
  } catch (error) {
    console.error("Reset password error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Erro ao redefinir senha" },
      { status: 500 }
    )
  }
}
