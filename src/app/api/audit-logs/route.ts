import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { AuditAction } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("audit.view")
    const companyId = user.companyId
    const { searchParams } = new URL(request.url)

    const entity = searchParams.get("entity")?.trim() || undefined
    const action = searchParams.get("action") as AuditAction | null
    const userId = searchParams.get("userId") || undefined
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)))

    const where = {
      companyId,
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(userId ? { userId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json(logs, {
      headers: {
        "X-Total-Count": String(total),
        "X-Page": String(page),
        "X-Page-Size": String(pageSize),
        "X-Total-Pages": String(Math.ceil(total / pageSize)),
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado") return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("Error fetching audit logs:", error)
    return NextResponse.json({ error: "Erro ao buscar logs" }, { status: 500 })
  }
}
