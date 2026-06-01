import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"

/**
 * Status do onboarding. Derivado — sem campo persistente.
 * Banner some quando todos os steps estiverem prontos.
 */
export async function GET() {
  try {
    const user = await requireAuth()
    const companyId = user.companyId

    const [company, categoriesCount, equipmentCount, customersCount, rentalsCount] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, document: true, phone: true, email: true, address: true },
      }),
      prisma.equipmentCategory.count({ where: { companyId } }),
      prisma.equipment.count({ where: { companyId } }),
      prisma.customer.count({ where: { companyId } }),
      prisma.rental.count({ where: { companyId, deletedAt: null } }),
    ])

    const steps = {
      companyProfile:
        !!company &&
        !!company.document &&
        !!company.phone &&
        !!company.address,
      firstCategory: categoriesCount > 0,
      firstEquipment: equipmentCount > 0,
      firstCustomer: customersCount > 0,
      firstRental: rentalsCount > 0,
    }

    const total = Object.keys(steps).length
    const done = Object.values(steps).filter(Boolean).length

    return NextResponse.json({
      completed: done === total,
      progress: done,
      total,
      steps,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("[onboarding status] error:", error)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
