import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getInvoiceProvider } from "@/lib/invoices"

/**
 * Webhook receptor — provider notifica mudança de status da nota.
 *
 * Identifica a empresa pelo `localId` ou `providerId` (a Invoice tem ambos).
 * NÃO autentica via session — confiar no parser do provider (signature/IP whitelist).
 * Por isso é isento de CSRF check (configurado em `src/lib/csrf.ts`).
 *
 * Em produção real, idealmente cada provider teria seu sub-path com validação
 * específica. Aqui assumimos que o provider está no `CompanyTaxConfig` da empresa
 * cujo `localId` aponta — escala bem porque cada provider envia pra um endpoint próprio
 * configurado lá no painel deles.
 */
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    // Tenta identificar localId no body (tenta JSON parsing rápido)
    let localId: string | undefined
    try {
      const json = JSON.parse(rawBody)
      localId = json.localId || json.ref || json.reference
    } catch {
      // body pode não ser JSON puro (alguns providers mandam form-urlencoded)
    }

    if (!localId) {
      console.error("[invoice webhook] sem localId no payload")
      return NextResponse.json({ error: "Payload sem identificador" }, { status: 400 })
    }

    // Carrega invoice + tax config
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
    const payload = await provider.parseWebhook(request.headers, rawBody)

    const status =
      payload.status === "ISSUED"
        ? "ISSUED"
        : payload.status === "REJECTED"
          ? "REJECTED"
          : payload.status === "CANCELLED"
            ? "CANCELLED"
            : payload.status === "ERROR"
              ? "ERROR"
              : "PROCESSING"

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status,
        number: payload.number ?? invoice.number,
        xmlUrl: payload.xmlUrl ?? invoice.xmlUrl,
        pdfUrl: payload.pdfUrl ?? invoice.pdfUrl,
        providerMessage: payload.message ?? invoice.providerMessage,
        issuedAt:
          status === "ISSUED" && !invoice.issuedAt ? new Date() : invoice.issuedAt,
      },
    })

    return NextResponse.json({ success: true, status })
  } catch (error) {
    console.error("[invoice webhook] error:", error)
    return NextResponse.json(
      { error: "Erro processando webhook", detail: (error as Error).message },
      { status: 500 }
    )
  }
}
