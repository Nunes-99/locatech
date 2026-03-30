import { NextRequest, NextResponse } from "next/server"
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

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim())
  const isAdmin = user?.email && (adminEmails.includes(user.email) || user.role === "OWNER")

  if (!isAdmin) {
    throw new Error("Acesso negado")
  }

  return session.user.id
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")

    const companies = await prisma.company.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { document: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: {
            users: true,
            equipment: true,
            customers: true,
            rentals: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return NextResponse.json(companies)
  } catch (error) {
    console.error("Error fetching companies:", error)
    if (error instanceof Error) {
      if (error.message === "Não autorizado" || error.message === "Acesso negado") {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
    }
    return NextResponse.json(
      { error: "Erro ao buscar empresas" },
      { status: 500 }
    )
  }
}
