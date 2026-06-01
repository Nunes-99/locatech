import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, requirePermission } from "@/lib/session"
import { z } from "zod"

function authErrorResponse(error: Error): NextResponse | null {
  const status = (error as Error & { status?: number }).status
  if (error.message === "Não autorizado") return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  if (status === 403 || error.message === "Acesso negado")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  return null
}

const createEquipmentSchema = z.object({
  categoryId: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
  dailyRate: z.number().positive(),
  weeklyRate: z.number().positive().optional().nullable(),
  monthlyRate: z.number().positive().optional().nullable(),
  depositAmount: z.number().positive().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchaseValue: z.number().positive().optional().nullable(),
})

const ALLOWED_SORT: Record<string, "code" | "name" | "dailyRate" | "totalRevenue" | "totalRentals" | "createdAt"> = {
  code: "code",
  name: "name",
  dailyRate: "dailyRate",
  totalRevenue: "totalRevenue",
  totalRentals: "totalRentals",
  createdAt: "createdAt",
}

export async function GET(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const { searchParams } = new URL(request.url)

    const categoryId = searchParams.get("categoryId") || undefined
    const status = searchParams.get("status") || undefined
    const search = searchParams.get("search")?.trim() || undefined
    const brand = searchParams.get("brand")?.trim() || undefined
    const minRate = searchParams.get("minRate")
    const maxRate = searchParams.get("maxRate")
    const availableFromRaw = searchParams.get("availableFrom")
    const availableToRaw = searchParams.get("availableTo")
    const sortByRaw = searchParams.get("sortBy") || "code"
    const sortDir = (searchParams.get("sortDir") || "asc") === "desc" ? "desc" : "asc"
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") || "100", 10)))

    const sortBy = ALLOWED_SORT[sortByRaw] || "code"

    // Filtro por disponibilidade em um range de datas — exclui equipamentos com locação ativa nesse período
    let excludeIds: string[] | undefined
    if (availableFromRaw && availableToRaw) {
      const from = new Date(availableFromRaw)
      const to = new Date(availableToRaw)
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        const conflicting = await prisma.rentalItem.findMany({
          where: {
            rental: {
              companyId,
              status: { in: ["CONFIRMED", "IN_PROGRESS", "OVERDUE"] },
              startDate: { lte: to },
              expectedEndDate: { gte: from },
            },
          },
          select: { equipmentId: true },
        })
        excludeIds = Array.from(new Set(conflicting.map((c) => c.equipmentId)))
      }
    }

    const where: any = {
      companyId,
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(brand ? { brand: { contains: brand, mode: "insensitive" } } : {}),
      ...(minRate || maxRate
        ? {
            dailyRate: {
              ...(minRate ? { gte: Number(minRate) } : {}),
              ...(maxRate ? { lte: Number(maxRate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { brand: { contains: search, mode: "insensitive" } },
              { model: { contains: search, mode: "insensitive" } },
              { serialNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(excludeIds && excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    }

    const [equipment, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        include: { category: true },
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.equipment.count({ where }),
    ])

    return NextResponse.json(equipment, {
      headers: {
        "X-Total-Count": String(total),
        "X-Page": String(page),
        "X-Page-Size": String(pageSize),
        "X-Total-Pages": String(Math.ceil(total / pageSize)),
      },
    })
  } catch (error) {
    console.error("Error fetching equipment:", error)
    if (error instanceof Error) {
      const r = authErrorResponse(error)
      if (r) return r
    }
    return NextResponse.json(
      { error: "Erro ao buscar equipamentos" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("equipment.create")
    const companyId = user.companyId
    const body = await request.json()
    const data = createEquipmentSchema.parse(body)

    // Verificar se código já existe
    const existing = await prisma.equipment.findUnique({
      where: {
        companyId_code: {
          companyId,
          code: data.code,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Já existe um equipamento com este código" },
        { status: 400 }
      )
    }

    const equipment = await prisma.equipment.create({
      data: {
        ...data,
        companyId,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json(equipment, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error) {
      const r = authErrorResponse(error)
      if (r) return r
    }
    console.error("Error creating equipment:", error)
    return NextResponse.json(
      { error: "Erro ao criar equipamento" },
      { status: 500 }
    )
  }
}
