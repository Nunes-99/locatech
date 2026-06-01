import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { WEBHOOK_EVENTS } from "@/lib/webhooks"
import { encryptString } from "@/lib/crypto"
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
      // Secret nunca volta no GET — só na resposta do create.
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        lastSuccessAt: true,
        lastFailureAt: true,
        lastFailureError: true,
        successCount: true,
        failureCount: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json(webhooks, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    return handle(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("company.update")
    const body = await request.json()
    const data = createSchema.parse(body)

    const rawSecret = `whsec_${crypto.randomBytes(24).toString("hex")}`

    const webhook = await prisma.webhook.create({
      data: {
        companyId: user.companyId,
        name: data.name,
        url: data.url,
        events: data.events,
        // Armazenado criptografado (AES-256-GCM) se APP_ENCRYPTION_KEY estiver
        // setado. Sem a key, ainda persiste em plaintext (dev fallback).
        secret: encryptString(rawSecret),
      },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
      },
    })

    // Retorna o secret CRU UMA VEZ — depois só sai criptografado do DB.
    return NextResponse.json(
      {
        ...webhook,
        secret: rawSecret,
        warning: "Guarde este secret — não será exibido novamente.",
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    )
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
