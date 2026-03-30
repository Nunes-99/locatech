import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, getSession } from "@/lib/session"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await requireCompanyId()
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Verify notification belongs to user/company
    const notification = await prisma.notification.findFirst({
      where: {
        id: params.id,
        companyId,
        OR: [
          { userId: session.user.id },
          { userId: null },
        ],
      },
    })

    if (!notification) {
      return NextResponse.json(
        { error: "Notificação não encontrada" },
        { status: 404 }
      )
    }

    const body = await request.json()

    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: {
        read: body.read ?? true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating notification:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar notificação" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await requireCompanyId()
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Verify notification belongs to user/company
    const notification = await prisma.notification.findFirst({
      where: {
        id: params.id,
        companyId,
        OR: [
          { userId: session.user.id },
          { userId: null },
        ],
      },
    })

    if (!notification) {
      return NextResponse.json(
        { error: "Notificação não encontrada" },
        { status: 404 }
      )
    }

    await prisma.notification.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting notification:", error)
    return NextResponse.json(
      { error: "Erro ao excluir notificação" },
      { status: 500 }
    )
  }
}
