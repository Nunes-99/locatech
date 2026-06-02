import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { canAddCustomer, getUpgradeMessage } from "@/lib/plan-limits"
import { Prisma } from "@prisma/client"
import { z } from "zod"

const createCustomerSchema = z.object({
  name: z.string().min(1),
  document: z.string().min(11),
  documentType: z.enum(["CPF", "CNPJ"]),
  phone: z.string().min(10),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  creditScore: z.enum(["EXCELLENT", "GOOD", "REGULAR", "BAD", "BLOCKED"]).optional(),
  creditLimit: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const creditScore = searchParams.get("creditScore")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10) || 50)
    )

    const where: Prisma.CustomerWhereInput = {
      companyId,
      isBlocked: false,
      ...(creditScore && creditScore !== "all" ? { creditScore: creditScore as any } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { document: { contains: search } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ])

    return NextResponse.json(customers, {
      headers: {
        "X-Total-Count": String(total),
        "X-Page": String(page),
        "X-Page-Size": String(pageSize),
        "X-Total-Pages": String(Math.ceil(total / pageSize)),
      },
    })
  } catch (error) {
    console.error("Error fetching customers:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar clientes" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const body = await request.json()
    const data = createCustomerSchema.parse(body)

    // Plan limit — antes só checado no import CSV
    const [company, currentCount] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId }, select: { plan: true } }),
      prisma.customer.count({ where: { companyId } }),
    ])
    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
    }
    if (!canAddCustomer(company.plan, currentCount)) {
      return NextResponse.json(
        { error: getUpgradeMessage(company.plan, "customers") },
        { status: 402 }
      )
    }

    // Verificar se documento já existe
    const existing = await prisma.customer.findUnique({
      where: {
        companyId_document: {
          companyId,
          document: data.document,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Já existe um cliente com este documento" },
        { status: 400 }
      )
    }

    const customer = await prisma.customer.create({
      data: {
        ...data,
        companyId,
      },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("Error creating customer:", error)
    return NextResponse.json(
      { error: "Erro ao criar cliente" },
      { status: 500 }
    )
  }
}
