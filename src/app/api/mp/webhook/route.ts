import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CompanyPlan } from "@prisma/client"
import {
  mpPreapproval,
  isMpConfigured,
  verifyMpWebhookSignature,
} from "@/lib/payments/mercadopago"

export const dynamic = "force-dynamic"

/**
 * Webhook do Mercado Pago.
 *
 * MP envia notificação com `{ action, type, data: { id } }` — payload mínimo.
 * Em vez de confiar no body, **buscamos o recurso pela API do MP** usando o ID
 * recebido. Isso garante que ataques de replay com body forjado não funcionem.
 *
 * Tipos relevantes:
 *   - `preapproval` / `subscription_preapproval` — status da assinatura mudou
 *   - `subscription_authorized_payment` — cobrança recorrente processada
 *   - `payment` — pagamento avulso (ignorado aqui — não usamos)
 *
 * Status do preapproval → ação:
 *   - `authorized` → empresa ativa no plano (extends planExpiresAt 30 dias)
 *   - `paused`     → mantém plano até fim do período
 *   - `cancelled`  → downgrade pra FREE
 */
export async function POST(request: NextRequest) {
  try {
    if (!isMpConfigured() || !mpPreapproval) {
      return NextResponse.json({ error: "MP não configurado" }, { status: 503 })
    }

    const rawBody = await request.text()
    const signatureHeader = request.headers.get("x-signature")
    const requestId = request.headers.get("x-request-id")

    let payload: { type?: string; action?: string; data?: { id?: string | number } }
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
    }

    const dataId = payload?.data?.id ? String(payload.data.id) : null
    if (!dataId) {
      return NextResponse.json({ received: true, ignored: "sem data.id" })
    }

    const secret = process.env.MP_WEBHOOK_SECRET
    if (secret) {
      const valid = verifyMpWebhookSignature({
        signatureHeader,
        requestId,
        dataId,
        secret,
      })
      if (!valid) {
        console.warn("MP webhook signature inválida", { dataId, requestId })
        return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
      }
    }

    const type = payload.type || payload.action || ""

    if (type.includes("preapproval") || type.includes("subscription")) {
      const preapproval = await mpPreapproval.get({ id: dataId })
      if (!preapproval) {
        return NextResponse.json({ received: true, ignored: "preapproval não encontrado" })
      }

      const externalRef = preapproval.external_reference || ""
      const [companyId, planRaw] = externalRef.split(":")
      const plan = planRaw as CompanyPlan | undefined

      if (!companyId) {
        return NextResponse.json({ received: true, ignored: "external_reference sem companyId" })
      }

      const status = preapproval.status
      const payerId = preapproval.payer_id ? String(preapproval.payer_id) : null

      if (status === "authorized" && plan) {
        const planExpiresAt = new Date()
        planExpiresAt.setMonth(planExpiresAt.getMonth() + 1)

        await prisma.company.update({
          where: { id: companyId },
          data: {
            plan,
            planExpiresAt,
            mpPreapprovalId: dataId,
            ...(payerId ? { mpPayerId: payerId } : {}),
          },
        })
        console.log(`MP: company ${companyId} → ${plan} (preapproval ${dataId})`)
      } else if (status === "cancelled") {
        await prisma.company.update({
          where: { id: companyId },
          data: { plan: "FREE", planExpiresAt: null },
        })
        console.log(`MP: company ${companyId} → FREE (preapproval cancelada)`)
      } else if (status === "paused") {
        console.log(`MP: company ${companyId} pausou assinatura (mantém plano até expirar)`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("MP webhook error:", error)
    return NextResponse.json({ error: "Erro no webhook" }, { status: 500 })
  }
}
