import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth"
import { sendTemplated, getWelcomeEmail, getEmailVerifyEmail } from "@/lib/notifications/email"
import { checkPasswordStrength, TERMS_VERSION } from "@/lib/validators"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyName, name, email, password, acceptedTerms } = body

    // Validations
    if (!companyName || !name || !email || !password) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios" },
        { status: 400 }
      )
    }

    if (!acceptedTerms) {
      return NextResponse.json(
        { error: "É necessário aceitar os Termos de Uso e a Política de Privacidade" },
        { status: 400 }
      )
    }

    const pwd = checkPasswordStrength(password)
    if (!pwd.ok) {
      return NextResponse.json(
        { error: pwd.errors.join(". ") },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Este e-mail já está cadastrado" },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create company and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create company
      const company = await tx.company.create({
        data: {
          name: companyName,
          plan: "FREE",
        },
      })

      // Token de verificação de email (24h de validade)
      const verifyToken = crypto.randomBytes(32).toString("hex")
      const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

      // Create user as OWNER
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "OWNER",
          companyId: company.id,
          termsAcceptedAt: new Date(),
          termsVersion: TERMS_VERSION,
          emailVerifyToken: verifyToken,
          emailVerifyTokenExpiry: verifyExpiry,
        },
      })

      return { company, user }
    })

    // Email de boas-vindas (não-bloqueante)
    sendTemplated(email, getWelcomeEmail, {
      userName: name,
      companyName,
      loginUrl: `${process.env.NEXTAUTH_URL || ""}/login`,
    }).catch((err) => console.error("[register] welcome email failed:", err))

    // Email de verificação (com link contendo o token gravado no User)
    // Buscamos o token criado dentro da transação anônima — mais simples re-fetch aqui
    prisma.user
      .findUnique({ where: { id: result.user.id }, select: { emailVerifyToken: true } })
      .then((u) => {
        if (!u?.emailVerifyToken) return
        const verifyLink = `${process.env.NEXTAUTH_URL || ""}/verificar-email?token=${u.emailVerifyToken}`
        return sendTemplated(email, getEmailVerifyEmail, {
          userName: name,
          verifyLink,
          companyName,
        })
      })
      .catch((err) => console.error("[register] verify email failed:", err))

    return NextResponse.json(
      {
        message: "Conta criada com sucesso",
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Erro ao criar conta. Tente novamente." },
      { status: 500 }
    )
  }
}
