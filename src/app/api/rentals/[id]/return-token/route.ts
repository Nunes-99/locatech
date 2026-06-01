import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import QRCode from "qrcode"
import crypto from "crypto"

/**
 * POST → gera token de devolução
 * GET  → retorna QR (PNG por default, ?format=svg)
 *
 * Token aponta pra página pública /devolucao/[token] onde o cliente registra
 * condição dos equipamentos e confirma.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("rental.return")
    const { id } = await params

    const rental = await prisma.rental.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      select: { status: true },
    })
    if (!rental) {
      return NextResponse.json({ error: "Locação não encontrada" }, { status: 404 })
    }
    if (!["IN_PROGRESS", "OVERDUE"].includes(rental.status)) {
      return NextResponse.json(
        { error: `Não dá pra gerar QR de devolução num status ${rental.status}` },
        { status: 400 }
      )
    }

    const token = `lt_rt_${crypto.randomBytes(24).toString("base64url")}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.rental.update({
      where: { id },
      data: {
        returnToken: token,
        returnTokenExpiresAt: expiresAt,
        returnConfirmedAt: null,
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin
    const publicUrl = `${baseUrl.replace(/\/$/, "")}/devolucao/${token}`

    return NextResponse.json({ token, expiresAt, url: publicUrl })
  } catch (error) {
    return handle(error)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("rental.view")
    const { id } = await params

    const rental = await prisma.rental.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      select: { returnToken: true, returnTokenExpiresAt: true },
    })
    if (!rental?.returnToken) {
      return NextResponse.json(
        { error: "Token não gerado. Use POST primeiro." },
        { status: 400 }
      )
    }
    if (rental.returnTokenExpiresAt && rental.returnTokenExpiresAt < new Date()) {
      return NextResponse.json({ error: "Token expirou" }, { status: 410 })
    }

    const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin
    const target = `${baseUrl.replace(/\/$/, "")}/devolucao/${rental.returnToken}`
    const buffer = await QRCode.toBuffer(target, { width: 512, margin: 1 })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    })
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
  console.error("[return-token] error:", error)
  return NextResponse.json({ error: "Erro interno" }, { status: 500 })
}

export const dynamic = "force-dynamic"
