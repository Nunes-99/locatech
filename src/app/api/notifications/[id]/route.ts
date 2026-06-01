import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, getSession } from "@/lib/session"

/**
 * Quando uma notificação tem `userId = null`, ela é "company-wide" (todos os
 * usuários da empresa veem). Antes: qualquer OPERATOR podia marcar como lida
 * ou DELETE — afetando todos os outros operadores.
 *
 * Agora:
 *   - PATCH (marcar lida): só permite atualizar notificações ENDEREÇADAS ao
 *     próprio user. Notificações company-wide são informativas; "marcar lida"
 *     deveria ser per-user (pra isso precisaríamos de uma tabela de leitura
 *     separada — fora de escopo). Por enquanto, bloqueamos.
 *   - DELETE: idem — só permite deletar notificações próprias. Company-wide
 *     são deletadas por OWNER/ADMIN se forem realmente lixo (a fazer rota
 *     separada se virar caso de uso).
 */
function isOwnNotification(
  notification: { userId: string | null },
  userId: string
): boolean {
  return notification.userId === userId
}

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

    const notification = await prisma.notification.findFirst({
      where: { id: params.id, companyId },
      select: { id: true, userId: true },
    })

    if (!notification) {
      return NextResponse.json(
        { error: "Notificação não encontrada" },
        { status: 404 }
      )
    }

    if (!isOwnNotification(notification, session.user.id)) {
      return NextResponse.json(
        { error: "Notificações company-wide não podem ser marcadas como lidas individualmente" },
        { status: 403 }
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

    const notification = await prisma.notification.findFirst({
      where: { id: params.id, companyId },
      select: { id: true, userId: true },
    })

    if (!notification) {
      return NextResponse.json(
        { error: "Notificação não encontrada" },
        { status: 404 }
      )
    }

    if (!isOwnNotification(notification, session.user.id)) {
      // Notificações company-wide só OWNER/ADMIN podem deletar.
      const role = session.user.role
      if (role !== "OWNER" && role !== "ADMIN") {
        return NextResponse.json(
          { error: "Apenas OWNER/ADMIN podem excluir notificações company-wide" },
          { status: 403 }
        )
      }
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
