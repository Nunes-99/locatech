import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("company.update")
    const { id } = await params

    const existing = await prisma.apiKey.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ error: "API key não encontrada" }, { status: 404 })
    }

    // Em vez de delete, desativa — preserva histórico de logs/rate-limit que possam referenciar
    await prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado")
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("[api-key delete] error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
