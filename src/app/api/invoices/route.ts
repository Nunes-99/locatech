import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("financial.view")
    const { searchParams } = new URL(request.url)

    const status = searchParams.get("status") || undefined
    const search = searchParams.get("search")?.trim() || undefined
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)))

    const where = {
      companyId: user.companyId,
      ...(status ? { status: status as any } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search } },
              { providerId: { contains: search } },
              { rental: { contractNumber: { equals: parseInt(search) || -1 } } },
            ],
          }
        : {}),
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          rental: { select: { contractNumber: true, customer: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ])

    return NextResponse.json(
      invoices.map((inv) => ({
        ...inv,
        amount: Number(inv.amount),
        issAmount: inv.issAmount ? Number(inv.issAmount) : null,
      })),
      {
        headers: {
          "X-Total-Count": String(total),
          "X-Page": String(page),
          "X-Page-Size": String(pageSize),
          "X-Total-Pages": String(Math.ceil(total / pageSize)),
        },
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado")
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("[invoices list] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
