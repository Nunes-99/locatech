import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { WEBHOOK_EVENTS } from "@/lib/webhooks"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS as unknown as [string, ...string[]])).min(1).optional(),
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

    const existing = await prisma.webhook.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Webhook não encontrado" }, { status: 404 })
    }

    const updated = await prisma.webhook.update({ where: { id }, data })
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

    const existing = await prisma.webhook.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Webhook não encontrado" }, { status: 404 })
    }

    await prisma.webhook.delete({ where: { id } })
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
  console.error("[webhook patch] error:", error)
  return NextResponse.json({ error: "Erro interno" }, { status: 500 })
}
