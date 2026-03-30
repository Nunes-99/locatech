import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./prisma"

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
  companyId: string
  companyName: string
}

export async function getSession() {
  return await getServerSession(authOptions)
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return null
  }

  return session.user as SessionUser
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("Não autorizado")
  }

  return user
}

export async function requireCompanyId(): Promise<string> {
  const user = await requireAuth()
  return user.companyId
}

export async function requireRole(roles: string[]): Promise<SessionUser> {
  const user = await requireAuth()

  if (!roles.includes(user.role)) {
    throw new Error("Acesso negado")
  }

  return user
}

export async function getCompanyWithUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { company: true },
  })

  return user
}

// Multi-tenant query helper
export function withCompanyId<T extends Record<string, unknown>>(
  companyId: string,
  query: T
): T & { companyId: string } {
  return { ...query, companyId }
}
