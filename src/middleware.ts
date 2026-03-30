import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    // User is authenticated, allow request
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
)

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/equipamentos/:path*",
    "/clientes/:path*",
    "/locacoes/:path*",
    "/manutencoes/:path*",
    "/financeiro/:path*",
    "/relatorios/:path*",
    "/configuracoes/:path*",
  ],
}
