import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getInvoiceProvider } from "@/lib/invoices"
import { getClientIp } from "@/lib/rate-limit"
import { InvoiceStatus } from "@prisma/client"

/**
 * Webhook receptor — provider notifica mudança de status da nota.
 *
 * Fluxo endurecido:
 *   1. Identifica `localId` no body
 *   2. Carrega Invoice + tax config
 *   3. Chama `provider.verifyWebhook` — IP allowlist / HMAC / etc
 *   4. Aplica state machine: bloqueia voltas inválidas (ISSUED→ERROR, etc)
 *   5. Não sobrescreve `xmlUrl`/`pdfUrl` se já preenchidos (defesa contra replay
 *      forjando URLs)
 *
 * Por que: na versão anterior, qualquer POST com `localId` válido podia
 * mover uma nota ISSUED de volta pra ERROR ou substituir as URLs por
 * conteúdo do atacante.
 */
export const dynamic = "force-dynamic"

const INVALID_TRANSITIONS = new Set<string>([
  // status atual → status alvo proibidos
  "ISSUED:PROCESSING",
  "ISSUED:ERROR",
  "ISSUED:REJECTED",
  "CANCELLED:ISSUED",
  "CANCELLED:PROCESSING",
])

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const clientIp = getClientIp(request.headers)

    let localId: string | undefined
    try {
      const json = JSON.parse(rawBody)
      localId = json.localId || json.ref || json.reference
    } catch {
      // pode não ser JSON puro
    }

    if (!localId) {
      console.error("[invoice webhook] sem localId no payload")
      return NextResponse.json({ error: "Payload sem identificador" }, { status: 400 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: localId },
      include: {
        company: {
          include: { taxConfig: true },
        },
      },
    })

    if (!invoice) {
      console.warn(`[invoice webhook] invoice ${localId} não encontrada`)
      return NextResponse.json({ error: "Invoice não encontrada" }, { status: 404 })
    }

    const provider = getInvoiceProvider(invoice.company.taxConfig)

    // Validação de autenticidade ANTES de parsear/processar
    if (!provider.verifyWebhook(request.headers, rawBody, clientIp)) {
      console.warn(
        `[invoice webhook] verifyWebhook negou: provider=${provider.name} ip=${clientIp}`
      )
      return NextResponse.json({ error: "Webhook não autenticado" }, { status: 401 })
    }

    const payload = await provider.parseWebhook(request.headers, rawBody)

    const newStatus: InvoiceStatus =
      payload.status === "ISSUED"
        ? "ISSUED"
        : payload.status === "REJECTED"
          ? "REJECTED"
          : payload.status === "CANCELLED"
            ? "CANCELLED"
            : payload.status === "ERROR"
              ? "ERROR"
              : "PROCESSING"

    // State machine: bloqueia transições inválidas
    if (INVALID_TRANSITIONS.has(`${invoice.status}:${newStatus}`)) {
      console.warn(
        `[invoice webhook] transição inválida ignorada: ${invoice.status} → ${newStatus} (invoice ${invoice.id})`
      )
      return NextResponse.json({ ignored: true, reason: "transição inválida" })
    }

    // URLs imutáveis após primeira atribuição (defesa contra replay com URLs forjadas)
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: newStatus,
        number: payload.number ?? invoice.number,
        xmlUrl: invoice.xmlUrl ?? payload.xmlUrl,
        pdfUrl: invoice.pdfUrl ?? payload.pdfUrl,
        providerMessage: payload.message ?? invoice.providerMessage,
        issuedAt:
          newStatus === "ISSUED" && !invoice.issuedAt ? new Date() : invoice.issuedAt,
      },
    })

    return NextResponse.json({ success: true, status: newStatus })
  } catch (error) {
    console.error("[invoice webhook] error:", error)
    return NextResponse.json(
      { error: "Erro processando webhook", detail: (error as Error).message },
      { status: 500 }
    )
  }
}
