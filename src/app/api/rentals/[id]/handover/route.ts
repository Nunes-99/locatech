import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import crypto from "crypto"

/**
 * Gera (ou regenera) o token de entrega da locação.
 *
 * Fluxo:
 *   1. Operador clica em "Gerar QR de entrega" → POST aqui → recebe URL pública
 *   2. Cliente escaneia o QR no celular → abre `/entrega/[token]`
 *   3. Cliente revisa itens + assina (B4.9) + confirma
 *   4. Status da locação muda CONFIRMED → IN_PROGRESS
 *
 * Token tem validade de 24h por padrão. Regerar invalida o anterior.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("rental.update")
    const { id } = await params

    const rental = await prisma.rental.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      select: { id: true, status: true, handoverConfirmedAt: true },
    })
    if (!rental) {
      return NextResponse.json({ error: "Locação não encontrada" }, { status: 404 })
    }
    if (!["QUOTE", "CONFIRMED"].includes(rental.status)) {
      return NextResponse.json(
        {
          error: `Não dá pra gerar QR de entrega numa locação com status ${rental.status}`,
        },
        { status: 400 }
      )
    }
    // Bloqueia re-emissão se entrega já foi confirmada — sem isso, qualquer
    // operador podia "regenerar QR" e re-abrir a entrega de um contrato já
    // confirmado pelo cliente, invalidando o registro original (anulava
    // signature/IP capturados). Pra refazer, agora requer fluxo manual de
    // anular a confirmação (não exposto via API ainda).
    if (rental.handoverConfirmedAt) {
      return NextResponse.json(
        {
          error:
            "Entrega já foi confirmada pelo cliente. Regerar invalidaria o registro original — contate o suporte.",
        },
        { status: 409 }
      )
    }

    const token = `lt_ho_${crypto.randomBytes(24).toString("base64url")}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.rental.update({
      where: { id },
      data: {
        handoverToken: token,
        handoverTokenExpiresAt: expiresAt,
        handoverConfirmedAt: null,
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin
    const publicUrl = `${baseUrl.replace(/\/$/, "")}/entrega/${token}`

    return NextResponse.json({ token, expiresAt, url: publicUrl })
  } catch (error) {
    return handle(error)
  }
}

function handle(error: unknown): NextResponse {
  if (error instanceof Error) {
    const status = (error as Error & { status?: number }).status
    if (error.message === "Não autorizado")
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    if (status === 403 || error.message === "Acesso negado")
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  console.error("[handover token] error:", error)
  return NextResponse.json({ error: "Erro interno" }, { status: 500 })
}
