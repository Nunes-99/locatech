import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey, isApiKeyError, requireApiPermission } from "@/lib/api-key"

/**
 * GET /api/v1/customers
 * Lista clientes da empresa.
 * Query params: search, isBlocked, page, pageSize (max 100).
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await authenticateApiKey(request.headers)
    requireApiPermission(ctx, "customer.view")
    const { searchParams } = new URL(request.url)

    const search = searchParams.get("search")?.trim() || undefined
    const isBlocked = searchParams.get("isBlocked")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)))

    const where = {
      companyId: ctx.companyId,
      ...(isBlocked !== null ? { isBlocked: isBlocked === "true" } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { document: { contains: search } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          document: true,
          documentType: true,
          phone: true,
          email: true,
          city: true,
          state: true,
          creditScore: true,
          isBlocked: true,
          totalRentals: true,
          totalSpent: true,
          totalPending: true,
          createdAt: true,
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ])

    return NextResponse.json(
      {
        data: data.map((c) => ({
          ...c,
          totalSpent: Number(c.totalSpent),
          totalPending: Number(c.totalPending),
        })),
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    if (isApiKeyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[v1 customers] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
