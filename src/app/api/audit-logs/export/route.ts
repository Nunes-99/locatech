import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { AuditAction } from "@prisma/client"
import { csvRow } from "@/lib/csv"

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

    // Limite duro para evitar OOM (5000 linhas é mais que suficiente para auditoria filtrada)
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
    })

    const headers = [
      "Quando",
      "Usuário",
      "Email",
      "Ação",
      "Entidade",
      "ID da entidade",
      "IP",
      "User Agent",
      "Alterações (JSON)",
    ]

    // csvRow sanitiza cada célula contra CSV injection (Excel/Sheets executam
    // fórmulas se a célula começa com =/+/-/@). Atacante com nome
    // "=HYPERLINK('evil')" detonava quando admin abria o export.
    const rows = [csvRow(headers)]
    for (const log of logs) {
      rows.push(
        csvRow([
          log.createdAt.toISOString(),
          log.userName,
          log.userEmail,
          log.action,
          log.entity,
          log.entityId,
          log.ipAddress,
          log.userAgent,
          log.changes ? JSON.stringify(log.changes) : "",
        ])
      )
    }

    const csv = "﻿" + rows.join("\r\n") // BOM pra Excel reconhecer UTF-8
    const filename = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Total-Exported": String(logs.length),
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado") return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("Error exporting audit logs:", error)
    return NextResponse.json({ error: "Erro ao exportar logs" }, { status: 500 })
  }
}
