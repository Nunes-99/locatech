import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const data = subscribeSchema.parse(body)
    const userAgent = request.headers.get("user-agent") || undefined

    // Upsert pelo endpoint — mesmo browser/device atualizando keys
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: {
        userId: user.id,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent,
      },
      update: {
        userId: user.id,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent,
        invalid: false,
      },
    })

    return NextResponse.json({ id: sub.id, success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("[push subscribe] error:", error)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get("endpoint")
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint é obrigatório" }, { status: 400 })
    }

    // Só apaga se for do próprio user (privacidade)
    const sub = await prisma.pushSubscription.findUnique({ where: { endpoint } })
    if (sub && sub.userId === user.id) {
      await prisma.pushSubscription.delete({ where: { endpoint } })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("[push unsubscribe] error:", error)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
