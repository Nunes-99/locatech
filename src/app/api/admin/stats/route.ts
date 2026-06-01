import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

async function requireAdmin() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error("Não autorizado")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, role: true },
  })

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
  // Super-admin é controlado SÓ por ADMIN_EMAILS. OWNER de locadora não tem
  // privilégio global — só sobre a própria empresa.
  if (!user?.email || !adminEmails.includes(user.email)) {
    throw new Error("Acesso negado")
  }

  return session.user.id
}

export async function GET() {
  try {
    await requireAdmin()

    const [
      totalCompanies,
      totalUsers,
      totalEquipment,
      companies,
      planCounts,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.equipment.count({ where: { status: { not: "RETIRED" } } }),
      prisma.company.aggregate({ _sum: { totalRevenue: true } }),
      prisma.company.groupBy({
        by: ["plan"],
        _count: { plan: true },
      }),
    ])

    const planDistribution = {
      FREE: 0,
      STARTER: 0,
      PRO: 0,
    }

    for (const pc of planCounts) {
      if (pc.plan in planDistribution) {
        planDistribution[pc.plan as keyof typeof planDistribution] = pc._count.plan
      }
    }

    return NextResponse.json({
      totalCompanies,
      totalUsers,
      totalEquipment,
      totalRevenue: Number(companies._sum.totalRevenue || 0),
      planDistribution,
    })
  } catch (error) {
    console.error("Error fetching admin stats:", error)
    if (error instanceof Error) {
      if (error.message === "Não autorizado") {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message === "Acesso negado") {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    return NextResponse.json(
      { error: "Erro ao buscar estatísticas" },
      { status: 500 }
    )
  }
}
