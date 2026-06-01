import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const user = await requirePermission("equipment.update")
    const { id, expenseId } = await params

    const expense = await prisma.equipmentExpense.findFirst({
      where: { id: expenseId, equipmentId: id, companyId: user.companyId },
    })
    if (!expense) {
      return NextResponse.json({ error: "Despesa não encontrada" }, { status: 404 })
    }

    await prisma.equipmentExpense.delete({ where: { id: expenseId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado")
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("[expense delete] error:", error)
    return NextResponse.json({ error: "Erro ao remover despesa" }, { status: 500 })
  }
}
