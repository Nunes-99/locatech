import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("company.update")
    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const existing = await prisma.store.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 })
    }

    const updated = await prisma.store.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    return handle(error)
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("company.update")
    const { id } = await params

    const existing = await prisma.store.findFirst({
      where: { id, companyId: user.companyId },
      include: { _count: { select: { equipment: true, rentals: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 })
    }

    // Não permite hard delete se há equipamento/locação vinculados.
    // Sugere desativação como alternativa.
    if (existing._count.equipment > 0 || existing._count.rentals > 0) {
      return NextResponse.json(
        {
          error: `Loja tem ${existing._count.equipment} equipamento(s) e ${existing._count.rentals} locação(ões) vinculados. Desative em vez de excluir.`,
        },
        { status: 400 }
      )
    }

    await prisma.store.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handle(error)
  }
}

function handle(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Dados inválidos", details: error.errors },
      { status: 400 }
    )
  }
  if (error instanceof Error) {
    const status = (error as Error & { status?: number }).status
    if (error.message === "Não autorizado")
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    if (status === 403 || error.message === "Acesso negado")
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  console.error("[store update] error:", error)
  return NextResponse.json({ error: "Erro interno" }, { status: 500 })
}
