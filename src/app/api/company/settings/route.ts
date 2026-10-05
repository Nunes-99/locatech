import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, requirePermission } from "@/lib/session"
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
  // URL completa ou o caminho devolvido pelo /api/upload ("/uploads/...")
  logoUrl: z
    .string()
    .refine((v) => /^https?:\/\//.test(v) || /^\/uploads\/[\w.-]+$/.test(v), "Logo inválido")
    .optional()
    .nullable(),
  primaryColor: z.string().optional(),
  lateFeePercent: z.number().min(0).max(100).optional(),
  defaultRentalDays: z.number().int().min(1).optional(),
  quoteValidDays: z.number().int().min(1).max(90).optional(),
  workingHours: z.any().optional(),
  // LGPD
  dpoEmail: z.string().email().optional().nullable(),
  dpoName: z.string().optional().nullable(),
  // Catálogo público
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug aceita apenas letras minúsculas, números e hífens")
    .min(3)
    .max(50)
    .optional()
    .nullable(),
  publicCatalog: z.boolean().optional(),
  catalogHeadline: z.string().max(200).optional().nullable(),
  whatsappContact: z.string().optional().nullable(),
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
        quoteValidDays: true,
        workingHours: true,
        plan: true,
        planExpiresAt: true,
        dpoEmail: true,
        dpoName: true,
        slug: true,
        publicCatalog: true,
        catalogHeadline: true,
        whatsappContact: true,
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
    const user = await requirePermission("company.update")
    const companyId = user.companyId
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
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado") return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    return NextResponse.json(
      { error: "Erro ao atualizar configurações" },
      { status: 500 }
    )
  }
}
