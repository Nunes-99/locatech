import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey, isApiKeyError, requireApiPermission } from "@/lib/api-key"

/**
 * GET /api/v1/rentals
 * Lista locações da empresa.
 * Query params: status, customerId, fromDate, toDate, page, pageSize (max 100).
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await authenticateApiKey(request.headers)
    requireApiPermission(ctx, "rental.view")
    const { searchParams } = new URL(request.url)

    const status = searchParams.get("status") || undefined
    const customerId = searchParams.get("customerId") || undefined
    const fromDate = searchParams.get("fromDate")
    const toDate = searchParams.get("toDate")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)))

    const where = {
      companyId: ctx.companyId,
      deletedAt: null,
      ...(status ? { status: status as any } : {}),
      ...(customerId ? { customerId } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
    }

    const [data, total] = await Promise.all([
      prisma.rental.findMany({
        where,
        select: {
          id: true,
          contractNumber: true,
          customerId: true,
          startDate: true,
          expectedEndDate: true,
          actualEndDate: true,
          status: true,
          type: true,
          total: true,
          paymentStatus: true,
          lateDays: true,
          lateFee: true,
          createdAt: true,
          items: {
            select: {
              equipmentCode: true,
              equipmentName: true,
              quantity: true,
              days: true,
              subtotal: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.rental.count({ where }),
    ])

    return NextResponse.json(
      {
        data: data.map((r) => ({
          ...r,
          total: Number(r.total),
          lateFee: Number(r.lateFee),
          items: r.items.map((it) => ({ ...it, subtotal: Number(it.subtotal) })),
        })),
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    if (isApiKeyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[v1 rentals] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
