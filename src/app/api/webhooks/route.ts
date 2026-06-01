import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { WEBHOOK_EVENTS } from "@/lib/webhooks"
import { z } from "zod"
import crypto from "crypto"

const createSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().refine((u) => /^https?:\/\//.test(u), "URL precisa ser http ou https"),
  events: z.array(z.enum(WEBHOOK_EVENTS as unknown as [string, ...string[]])).min(1),
})

export async function GET() {
  try {
    const user = await requirePermission("company.update")
    const webhooks = await prisma.webhook.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(webhooks)
  } catch (error) {
    return handle(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("company.update")
    const body = await request.json()
    const data = createSchema.parse(body)

    const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`

    const webhook = await prisma.webhook.create({
      data: {
        companyId: user.companyId,
        name: data.name,
        url: data.url,
        events: data.events,
        secret,
      },
    })

    // Retorna o secret apenas no momento do create — depois fica oculto
    return NextResponse.json(webhook, { status: 201 })
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
  console.error("[webhooks api] error:", error)
  return NextResponse.json({ error: "Erro interno" }, { status: 500 })
}
