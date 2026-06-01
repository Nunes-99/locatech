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

    // Normaliza email pra evitar contas duplicadas tipo "Foo@x.com" e "foo@x.com"
    const normalizedEmail = String(email).toLowerCase().trim()

    // Check if email already exists. NÃO revela ao cliente — devolve mensagem
    // genérica pra evitar enumeração de emails. Em paralelo, dispara email
    // "você já tem uma conta" pro endereço — assim o usuário legítimo é
    // informado se foi ele que tentou.
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      // (TODO: enviar email "já tem conta" — fica como melhoria futura)
      return NextResponse.json(
        { error: "Não foi possível concluir o cadastro. Verifique os dados ou tente fazer login." },
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
      // Geramos o token CRU, mandamos por email, e guardamos só o HASH no DB.
      // Vazamento do DB não permite hijack do fluxo de verificação.
      const rawVerifyToken = crypto.randomBytes(32).toString("hex")
      const hashedVerifyToken = crypto
        .createHash("sha256")
        .update(rawVerifyToken)
        .digest("hex")
      const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

      // Create user as OWNER
      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
          role: "OWNER",
          companyId: company.id,
          termsAcceptedAt: new Date(),
          termsVersion: TERMS_VERSION,
          emailVerifyToken: hashedVerifyToken,
          emailVerifyTokenExpiry: verifyExpiry,
        },
      })

      return { company, user, rawVerifyToken }
    })

    // Email de boas-vindas (não-bloqueante)
    sendTemplated(normalizedEmail, getWelcomeEmail, {
      userName: name,
      companyName,
      loginUrl: `${process.env.NEXTAUTH_URL || ""}/login`,
    }).catch((err) => console.error("[register] welcome email failed:", err))

    // Email de verificação (com link contendo o token cru)
    // O token armazenado no DB é o hash SHA-256 — só o link tem o token cru
    const verifyLink = `${process.env.NEXTAUTH_URL || ""}/verificar-email?token=${result.rawVerifyToken}`
    sendTemplated(normalizedEmail, getEmailVerifyEmail, {
      userName: name,
      verifyLink,
      companyName,
    }).catch((err) => console.error("[register] verify email failed:", err))

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
