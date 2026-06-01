import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/session"
import { sendPushToUser } from "@/lib/push"

/** Dispara uma notificação de teste para o user atual. */
export async function POST() {
  try {
    const user = await requireAuth()
    void sendPushToUser(user.id, {
      title: "LocaTech — teste de notificação",
      body: `Funcionou, ${user.name}! Você receberá alertas operacionais por aqui.`,
      url: "/dashboard",
      tag: "test",
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
