import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import QRCode from "qrcode"

/**
 * Retorna o QR code (PNG/SVG) do token de entrega da locação.
 *
 * Usa o token já gerado em `Rental.handoverToken`. Se ainda não existir token
 * válido, devolve 400 — o operador precisa POSTar em /handover primeiro.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("rental.update")
    const { id } = await params

    const rental = await prisma.rental.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      select: { handoverToken: true, handoverTokenExpiresAt: true },
    })

    if (!rental?.handoverToken) {
      return NextResponse.json(
        { error: "Token não gerado. Use POST /handover primeiro." },
        { status: 400 }
      )
    }
    if (rental.handoverTokenExpiresAt && rental.handoverTokenExpiresAt < new Date()) {
      return NextResponse.json({ error: "Token expirou. Gere outro." }, { status: 410 })
    }

    const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin
    const target = `${baseUrl.replace(/\/$/, "")}/entrega/${rental.handoverToken}`

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "png"

    if (format === "svg") {
      const svg = await QRCode.toString(target, { type: "svg", width: 360, margin: 1 })
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "private, no-store",
        },
      })
    }

    const buffer = await QRCode.toBuffer(target, { width: 512, margin: 1 })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Não autorizado")
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("[handover qr] error:", error)
    return NextResponse.json({ error: "Erro ao gerar QR" }, { status: 500 })
  }
}
