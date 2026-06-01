import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { rateLimit, getClientIp } from "./rate-limit"
import { logAuthEvent } from "./audit"
import { PrismaClient } from "@prisma/client"

// Acesso direto ao client base para escrever logs (sem disparar extension de auditoria)
const baseClient: PrismaClient = (prisma as unknown as { $extends: unknown }) as PrismaClient

/**
 * Hash bcrypt fake (cost 12 — mesmo da senha real). Usado pra equalizar timing
 * entre "usuário não existe" e "senha errada". Sem isso, atacante consegue
 * enumerar emails pelo delay (5ms vs ~200ms).
 *
 * Gerado uma vez por módulo. O valor não importa — só precisa ser um hash
 * bcrypt válido que NUNCA bate com nenhuma senha real.
 */
const DUMMY_PASSWORD_HASH =
  "$2a$12$abcdefghijklmnopqrstuuOJqfqxxxXxxXxxXxxXxxXxxXxxXxxXxxX"

async function recordAccessLog(data: {
  email: string
  userId?: string
  companyId?: string
  success: boolean
  failureReason?: string
  ipAddress?: string
  userAgent?: string
}) {
  try {
    await baseClient.accessLog.create({ data })

    // Alerta: se há 5+ falhas pro mesmo email em 15 min, notifica OWNER da empresa
    if (!data.success && data.companyId && data.userId) {
      const since = new Date(Date.now() - 15 * 60 * 1000)
      const failures = await baseClient.accessLog.count({
        where: {
          email: data.email,
          success: false,
          createdAt: { gte: since },
        },
      })

      // Notifica apenas no exato 5º (evita spam de notificações em rajada)
      if (failures === 5) {
        try {
          await baseClient.notification.create({
            data: {
              companyId: data.companyId,
              userId: null, // pra todos OWNER/ADMIN da empresa
              title: "Tentativas de login suspeitas",
              message: `Detectamos 5 tentativas de login falhadas para ${data.email} nos últimos 15 minutos. Verifique se foi você ou se há tentativa de invasão.`,
              type: "WARNING",
              link: "/auditoria?action=LOGIN_FAILED",
            },
          })
        } catch (err) {
          console.error("[auth] failed to create alert notification:", err)
        }
      }
    }
  } catch (error) {
    console.error("[auth] failed to record access log:", error)
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
        totpCode: { label: "Código 2FA", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Credenciais inválidas")
        }

        // Captura IP/UA (headers do next/headers funciona em route handlers do NextAuth)
        let ipAddress: string | undefined
        let userAgent: string | undefined
        try {
          const h = headers()
          ipAddress = getClientIp(h as unknown as Headers)
          userAgent = (h as any).get?.("user-agent") || undefined
        } catch {
          // headers() pode não estar disponível em alguns contextos
        }

        const email = credentials.email.toLowerCase().trim()

        // Rate limit: 5 tentativas por minuto por IP+email
        const rl = rateLimit({
          key: `login:${ipAddress || "unknown"}:${email}`,
          limit: 5,
          windowMs: 60 * 1000,
        })
        if (!rl.allowed) {
          await recordAccessLog({
            email,
            success: false,
            failureReason: "RATE_LIMITED",
            ipAddress,
            userAgent,
          })
          throw new Error(`Muitas tentativas. Tente novamente em ${rl.retryAfterSeconds}s`)
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { company: true },
        })

        // Equaliza timing entre "user existe" e "user não existe": sempre roda
        // bcrypt.compare (cost 12 = ~200ms). Sem isso, atacante enumera emails
        // medindo o delay.
        if (!user || !user.passwordHash) {
          await bcrypt.compare(credentials.password, DUMMY_PASSWORD_HASH)
          await recordAccessLog({
            email,
            success: false,
            failureReason: "USER_NOT_FOUND",
            ipAddress,
            userAgent,
          })
          throw new Error("Credenciais inválidas")
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          await recordAccessLog({
            email,
            userId: user.id,
            companyId: user.companyId,
            success: false,
            failureReason: "INVALID_PASSWORD",
            ipAddress,
            userAgent,
          })
          throw new Error("Credenciais inválidas")
        }

        // Etapa 2FA — se o user tem TOTP ativado, exigir o código
        if (user.totpEnabledAt && user.totpSecret) {
          const totpCode = (credentials.totpCode || "").trim()
          if (!totpCode) {
            // Sinaliza pro frontend que precisa do código (NextAuth não tem multi-step nativo;
            // a UI pode interceptar essa mensagem específica e mostrar campo de código).
            throw new Error("TOTP_REQUIRED")
          }

          // Aceita TOTP de 6 dígitos OU backup code de 8 hex chars
          const { verifyTotpCode, consumeBackupCode } = await import("./totp")
          let totpOk = false
          if (/^\d{6}$/.test(totpCode)) {
            totpOk = await verifyTotpCode(totpCode, user.totpSecret)
          } else if (user.totpBackupCodes.length > 0) {
            const r = consumeBackupCode(totpCode, user.totpBackupCodes)
            if (r.matched) {
              await prisma.user.update({
                where: { id: user.id },
                data: { totpBackupCodes: r.remaining },
              })
              totpOk = true
            }
          }

          if (!totpOk) {
            await recordAccessLog({
              email,
              userId: user.id,
              companyId: user.companyId,
              success: false,
              failureReason: "INVALID_TOTP",
              ipAddress,
              userAgent,
            })
            throw new Error("Código 2FA inválido")
          }
        }

        await recordAccessLog({
          email,
          userId: user.id,
          companyId: user.companyId,
          success: true,
          ipAddress,
          userAgent,
        })

        await logAuthEvent(baseClient, {
          companyId: user.companyId,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          action: "LOGIN",
          ipAddress,
          userAgent,
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company.name,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.companyId = (user as any).companyId
        token.companyName = (user as any).companyName
      }
      return token
    },
    async session({ session, token }) {
      // Validação de revogação global: se o user tiver tokensInvalidatedAt > iat do JWT,
      // o token é inválido. Custo: 1 SELECT por request. Aceitável pra B2B.
      if (token?.id && token?.iat) {
        try {
          const u = await baseClient.user.findUnique({
            where: { id: token.id as string },
            select: { tokensInvalidatedAt: true },
          })
          if (
            u?.tokensInvalidatedAt &&
            Math.floor(u.tokensInvalidatedAt.getTime() / 1000) > (token.iat as number)
          ) {
            // Sessão revogada — devolve session sem user pra forçar logout no client
            return { ...session, user: undefined as any }
          }
        } catch (err) {
          console.error("[auth] token revocation check failed:", err)
        }
      }

      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.companyId = token.companyId as string
        session.user.companyName = token.companyName as string
      }
      return session
    },
  },
}

// Helper to hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

// Helper to verify password
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}
