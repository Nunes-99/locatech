import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"

export async function GET() {
  try {
    const companyId = await requireCompanyId()

    const [company, equipmentCount, userCount, customerCount] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { plan: true, planExpiresAt: true },
      }),
      prisma.equipment.count({
        where: { companyId, status: { not: "RETIRED" } },
      }),
      prisma.user.count({
        where: { companyId },
      }),
      prisma.customer.count({
        where: { companyId, isBlocked: false },
      }),
    ])

    return NextResponse.json({
      plan: company?.plan || "FREE",
      planExpiresAt: company?.planExpiresAt,
      equipmentCount,
      userCount,
      customerCount,
    })
  } catch (error) {
    console.error("Error fetching company usage:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar dados da empresa" },
      { status: 500 }
    )
  }
}
