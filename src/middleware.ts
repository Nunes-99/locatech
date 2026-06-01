import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "next-auth/middleware"
import { checkCsrf } from "@/lib/csrf"

// Páginas que exigem autenticação (proteção pelo NextAuth)
const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/equipamentos",
  "/clientes",
  "/locacoes",
  "/manutencoes",
  "/financeiro",
  "/relatorios",
  "/configuracoes",
  "/usuarios",
  "/auditoria",
  "/calendario",
  "/lucro",
  "/seguranca",
  "/notas",
  "/lojas",
]

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((p) => pathname.startsWith(p))
}

const authMiddleware = (withAuth as any)(
  function (req: NextRequest) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }: { token: unknown }) => !!token,
    },
    pages: { signIn: "/login" },
  }
)

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. CSRF check em rotas API mutating (POST/PUT/PATCH/DELETE)
  //    exceto endpoints públicos, webhooks e crons (geridos pelo csrf.ts)
  if (pathname.startsWith("/api/")) {
    const csrf = checkCsrf(req)
    if (!csrf.allowed) {
      return NextResponse.json(
        { error: "CSRF check failed", reason: csrf.reason },
        { status: 403 }
      )
    }
    return NextResponse.next()
  }

  // 2. Auth check em páginas protegidas
  if (isProtectedPage(pathname)) {
    return authMiddleware(req)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Páginas protegidas
    "/dashboard/:path*",
    "/equipamentos/:path*",
    "/clientes/:path*",
    "/locacoes/:path*",
    "/manutencoes/:path*",
    "/financeiro/:path*",
    "/relatorios/:path*",
    "/configuracoes/:path*",
    "/usuarios/:path*",
    "/auditoria/:path*",
    "/calendario/:path*",
    "/lucro/:path*",
    "/seguranca/:path*",
    "/notas/:path*",
    "/lojas/:path*",
    // API routes — pra CSRF check
    "/api/:path*",
  ],
}
