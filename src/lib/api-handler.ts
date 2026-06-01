import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { runWithAuditContext, AuditContext } from "./audit-context"
import { canPerform, Permission } from "./permissions"

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
  }
}

export const Unauthorized = () => new HttpError(401, "Não autorizado")
export const Forbidden = (msg = "Acesso negado") => new HttpError(403, msg)
export const NotFound = (msg = "Não encontrado") => new HttpError(404, msg)
export const BadRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details)
export const Conflict = (msg: string) => new HttpError(409, msg)

export interface ApiSession {
  id: string
  name: string
  email: string
  role: "OWNER" | "ADMIN" | "OPERATOR"
  companyId: string
  companyName: string
}

interface HandlerContext<TParams extends Record<string, string> = Record<string, string>> {
  session: ApiSession
  params: TParams
  request: NextRequest
}

type Handler<TParams extends Record<string, string> = Record<string, string>> = (
  ctx: HandlerContext<TParams>
) => Promise<NextResponse | unknown>

interface RouteOptions {
  requireAuth?: boolean
  permission?: Permission
}

function getClientIp(request: NextRequest): string | undefined {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]!.trim()
  return request.headers.get("x-real-ip") || undefined
}

export function apiRoute<TParams extends Record<string, string> = Record<string, string>>(
  handler: Handler<TParams>,
  options: RouteOptions = {}
) {
  const { requireAuth = true, permission } = options

  return async function (
    request: NextRequest,
    routeContext?: { params: Promise<TParams> }
  ): Promise<NextResponse> {
    try {
      let session: ApiSession | null = null

      if (requireAuth) {
        const raw = await getServerSession(authOptions)
        if (!raw?.user) {
          throw Unauthorized()
        }
        session = raw.user as unknown as ApiSession
      }

      if (permission && session && !canPerform(session.role, permission)) {
        throw Forbidden(`Sua função (${session.role}) não permite esta ação`)
      }

      const params = (await routeContext?.params) ?? ({} as TParams)

      const auditCtx: AuditContext = session
        ? {
            userId: session.id,
            userEmail: session.email,
            userName: session.name,
            companyId: session.companyId,
            ipAddress: getClientIp(request),
            userAgent: request.headers.get("user-agent") || undefined,
          }
        : {
            ipAddress: getClientIp(request),
            userAgent: request.headers.get("user-agent") || undefined,
          }

      const result = await runWithAuditContext(auditCtx, () =>
        Promise.resolve(handler({ session: session!, params, request }))
      )

      if (result instanceof NextResponse) return result
      return NextResponse.json(result)
    } catch (error) {
      return handleError(error)
    }
  }
}

export function handleError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, ...(error.details ? { details: error.details } : {}) },
      { status: error.status }
    )
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Dados inválidos", details: error.errors },
      { status: 400 }
    )
  }
  if (error instanceof Error && error.message === "Não autorizado") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  console.error("[api] unexpected error:", error)
  return NextResponse.json(
    { error: "Erro interno do servidor" },
    { status: 500 }
  )
}
