import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Endpoint **público** (sem auth) do catálogo da locadora.
 * Só retorna dados quando `publicCatalog=true` e `slug` está setado.
 * Lista apenas equipamentos com status AVAILABLE ou RESERVED.
 *
 * Cache: 60s nas respostas pra reduzir custo de DB em catálogos hot.
 */
export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim() || undefined
    const categoryId = searchParams.get("categoryId") || undefined

    const company = await prisma.company.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        publicCatalog: true,
        catalogHeadline: true,
        whatsappContact: true,
        // phone/email omitidos da resposta pública — antes scrappers extraíam
        // dados de contato da empresa direto do JSON. Pra contato público
        // use `whatsappContact` (campo dedicado opt-in).
        city: true,
        state: true,
      },
    })

    if (!company || !company.publicCatalog) {
      return NextResponse.json({ error: "Catálogo não encontrado" }, { status: 404 })
    }

    const [categories, equipment] = await Promise.all([
      prisma.equipmentCategory.findMany({
        where: {
          companyId: company.id,
          equipment: { some: { status: { in: ["AVAILABLE", "RESERVED"] } } },
        },
        select: { id: true, name: true, icon: true },
        orderBy: { name: "asc" },
      }),
      prisma.equipment.findMany({
        where: {
          companyId: company.id,
          status: { in: ["AVAILABLE", "RESERVED"] },
          ...(categoryId ? { categoryId } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { code: { contains: search, mode: "insensitive" } },
                  { brand: { contains: search, mode: "insensitive" } },
                  { model: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          code: true,
          name: true,
          brand: true,
          model: true,
          description: true,
          imageUrl: true,
          dailyRate: true,
          weeklyRate: true,
          monthlyRate: true,
          status: true,
          category: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
        take: 200,
      }),
    ])

    return NextResponse.json(
      {
        company: {
          name: company.name,
          logoUrl: company.logoUrl,
          primaryColor: company.primaryColor,
          headline: company.catalogHeadline,
          whatsapp: company.whatsappContact,
          location: [company.city, company.state].filter(Boolean).join(" - "),
        },
        categories,
        equipment: equipment.map((e) => ({
          ...e,
          dailyRate: Number(e.dailyRate),
          weeklyRate: e.weeklyRate ? Number(e.weeklyRate) : null,
          monthlyRate: e.monthlyRate ? Number(e.monthlyRate) : null,
        })),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60",
        },
      }
    )
  } catch (error) {
    console.error("[public catalog] error:", error)
    return NextResponse.json({ error: "Erro ao carregar catálogo" }, { status: 500 })
  }
}
