import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { z } from "zod"

const updateSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  document: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  logoUrl: z.string().url().optional().nullable(),
  primaryColor: z.string().optional(),
  lateFeePercent: z.number().min(0).max(100).optional(),
  defaultRentalDays: z.number().int().min(1).optional(),
  workingHours: z.any().optional(),
})

export async function GET() {
  try {
    const companyId = await requireCompanyId()

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        document: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        logoUrl: true,
        primaryColor: true,
        lateFeePercent: true,
        defaultRentalDays: true,
        workingHours: true,
        plan: true,
        planExpiresAt: true,
      },
    })

    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error("Error fetching company settings:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar configurações" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const body = await request.json()
    const data = updateSettingsSchema.parse(body)

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...data,
        document: data.document?.replace(/\D/g, "") || undefined,
        phone: data.phone?.replace(/\D/g, "") || undefined,
        zipCode: data.zipCode?.replace(/\D/g, "") || undefined,
      },
    })

    return NextResponse.json(company)
  } catch (error) {
    console.error("Error updating company settings:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao atualizar configurações" },
      { status: 500 }
    )
  }
}
