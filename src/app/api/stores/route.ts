import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1).max(100),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/i, "Código aceita letras, números, _ e -"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
})

export async function GET() {
  try {
    const user = await requirePermission("company.view")
    const stores = await prisma.store.findMany({
      where: { companyId: user.companyId },
      include: {
        _count: { select: { equipment: true, rentals: true } },
      },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(stores)
  } catch (error) {
    return handle(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("company.update")
    const body = await request.json()
    const data = createSchema.parse(body)

    const existing = await prisma.store.findUnique({
      where: { companyId_code: { companyId: user.companyId, code: data.code.toUpperCase() } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Código "${data.code}" já existe nesta empresa` },
        { status: 400 }
      )
    }

    const store = await prisma.store.create({
      data: {
        companyId: user.companyId,
        name: data.name,
        code: data.code.toUpperCase(),
        phone: data.phone ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        zipCode: data.zipCode ?? null,
      },
    })

    return NextResponse.json(store, { status: 201 })
  } catch (error) {
    return handle(error)
  }
}

function handle(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: error.errors[0]?.message || "Dados inválidos", details: error.errors },
      { status: 400 }
    )
  }
  if (error instanceof Error) {
    const status = (error as Error & { status?: number }).status
    if (error.message === "Não autorizado")
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    if (status === 403 || error.message === "Acesso negado")
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  console.error("[stores] error:", error)
  return NextResponse.json({ error: "Erro interno" }, { status: 500 })
}
