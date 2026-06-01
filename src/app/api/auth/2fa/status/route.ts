import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"

export async function GET() {
  try {
    const sessionUser = await requireAuth()
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { totpEnabledAt: true, totpBackupCodes: true },
    })
    return NextResponse.json({
      enabled: !!user?.totpEnabledAt,
      enabledAt: user?.totpEnabledAt ?? null,
      backupCodesRemaining: user?.totpBackupCodes.length ?? 0,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
