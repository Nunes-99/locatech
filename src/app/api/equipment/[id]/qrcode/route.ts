import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import QRCode from "qrcode"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const { id } = await params

    const equipment = await prisma.equipment.findFirst({
      where: { id, companyId },
      select: { id: true, code: true, name: true },
    })

    if (!equipment) {
      return NextResponse.json({ error: "Equipamento não encontrado" }, { status: 404 })
    }

    // URL pública (ou interna do admin) que o QR aponta
    const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin
    const target = `${baseUrl}/equipamentos/${equipment.id}`

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "png"

    if (format === "svg") {
      const svg = await QRCode.toString(target, { type: "svg", width: 320, margin: 1 })
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Content-Disposition": `inline; filename="qr-${equipment.code}.svg"`,
          "Cache-Control": "private, max-age=300",
        },
      })
    }

    const buffer = await QRCode.toBuffer(target, { width: 512, margin: 1 })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="qr-${equipment.code}.png"`,
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("Error generating QR code:", error)
    return NextResponse.json({ error: "Erro ao gerar QR Code" }, { status: 500 })
  }
}
