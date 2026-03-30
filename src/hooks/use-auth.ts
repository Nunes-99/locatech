"use client"

import { useSession } from "next-auth/react"

export interface User {
  id: string
  name: string
  email: string
  role: string
  companyId: string
  companyName: string
}

export function useAuth() {
  const { data: session, status } = useSession()

  const user = session?.user as User | undefined

  return {
    user,
    isAuthenticated: !!user,
    isLoading: status === "loading",
    isOwner: user?.role === "OWNER",
    isAdmin: user?.role === "ADMIN" || user?.role === "OWNER",
    isOperator: user?.role === "OPERATOR",
    companyId: user?.companyId,
    companyName: user?.companyName,
  }
}

export function useRequireAuth() {
  const auth = useAuth()

  if (!auth.isLoading && !auth.isAuthenticated) {
    throw new Error("Você precisa estar autenticado")
  }

  return auth
}

export function useRequireRole(roles: string[]) {
  const auth = useRequireAuth()

  if (auth.user && !roles.includes(auth.user.role)) {
    throw new Error("Você não tem permissão para acessar esta página")
  }

  return auth
}
