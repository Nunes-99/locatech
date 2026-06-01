import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { logAuthEvent } from "@/lib/audit"
import { PrismaClient } from "@prisma/client"

const baseClient: PrismaClient = (prisma as unknown as { $extends: unknown }) as PrismaClient

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

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Rate limit pra evitar abuso (revoke + login + revoke loop)
    const rl = rateLimit({
      key: `sessions-revoke:${user.id}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitos pedidos. Tente em ${Math.ceil((rl.retryAfterSeconds || 60) / 60)} min.` },
        { status: 429 }
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { tokensInvalidatedAt: new Date() },
    })

    await logAuthEvent(baseClient, {
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "SESSIONS_REVOKED",
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent") || undefined,
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
