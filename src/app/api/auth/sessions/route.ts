import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"

export async function GET() {
  try {
    const user = await requireAuth()

    const logs = await prisma.accessLog.findMany({
      where: { userId: user.id, success: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    })

    return NextResponse.json(logs)
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("Error listing sessions:", error)
    return NextResponse.json({ error: "Erro ao listar sessões" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const user = await requireAuth()

    await prisma.user.update({
      where: { id: user.id },
      data: { tokensInvalidatedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      message: "Todas as sessões foram revogadas. Você será desconectado.",
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("Error revoking sessions:", error)
    return NextResponse.json({ error: "Erro ao revogar sessões" }, { status: 500 })
  }
}
