import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey, isApiKeyError } from "@/lib/api-key"

/**
 * GET /api/v1/equipment
 * Lista equipamentos da empresa autenticada pela API key.
 * Query params: status, categoryId, page, pageSize (max 100).
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await authenticateApiKey(request.headers)
    const { searchParams } = new URL(request.url)

    const status = searchParams.get("status") || undefined
    const categoryId = searchParams.get("categoryId") || undefined
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)))

    const where = {
      companyId: ctx.companyId,
      ...(status ? { status: status as any } : {}),
      ...(categoryId ? { categoryId } : {}),
    }

    const [data, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          brand: true,
          model: true,
          serialNumber: true,
          dailyRate: true,
          weeklyRate: true,
          monthlyRate: true,
          status: true,
          createdAt: true,
        },
        orderBy: { code: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.equipment.count({ where }),
    ])

    return NextResponse.json(
      {
        data: data.map((e) => ({
          ...e,
          dailyRate: Number(e.dailyRate),
          weeklyRate: e.weeklyRate ? Number(e.weeklyRate) : null,
          monthlyRate: e.monthlyRate ? Number(e.monthlyRate) : null,
        })),
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    )
  } catch (error) {
    if (isApiKeyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[v1 equipment] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
