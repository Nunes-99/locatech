import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, getSession } from "@/lib/session"

export async function POST() {
  try {
    const companyId = await requireCompanyId()
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    await prisma.notification.updateMany({
      where: {
        companyId,
        OR: [
          { userId: session.user.id },
          { userId: null },
        ],
        read: false,
      },
      data: {
        read: true,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error marking notifications as read:", error)
    return NextResponse.json(
      { error: "Erro ao marcar notificações como lidas" },
      { status: 500 }
    )
  }
}
