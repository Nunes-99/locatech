import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CompanyPlan } from "@prisma/client"
import {
  mpPreapproval,
  mpPayment,
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
 * Tipos que processamos:
 *   - `preapproval` / `subscription_preapproval` — status da assinatura mudou
 *     (authorized → ativa, cancelled → downgrade, paused → mantém)
 *   - `subscription_authorized_payment` — cobrança recorrente mensal foi
 *     aprovada; renova `planExpiresAt` por mais 30 dias
 *
 * Sem o tratamento de `subscription_authorized_payment`, `planExpiresAt`
 * expira 30 dias após a 1ª autorização mesmo com o cliente pagando todo mês.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isMpConfigured() || !mpPreapproval || !mpPayment) {
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

    // Mudança de status da assinatura (criação, cancelamento, pausa)
    if (type === "preapproval" || type === "subscription_preapproval") {
      await handlePreapprovalEvent(dataId)
      return NextResponse.json({ received: true })
    }

    // Cobrança recorrente processada — renova validade do plano
    if (type === "subscription_authorized_payment") {
      await handleAuthorizedPaymentEvent(dataId)
      return NextResponse.json({ received: true })
    }

    // Outros tipos (payment avulso, etc) — não usamos
    return NextResponse.json({ received: true, ignored: type })
  } catch (error) {
    console.error("MP webhook error:", error)
    return NextResponse.json({ error: "Erro no webhook" }, { status: 500 })
  }
}

async function handlePreapprovalEvent(dataId: string) {
  if (!mpPreapproval) return
  const preapproval = await mpPreapproval.get({ id: dataId })
  if (!preapproval) return

  const externalRef = preapproval.external_reference || ""
  const [companyId, planRaw] = externalRef.split(":")
  const plan = planRaw as CompanyPlan | undefined

  if (!companyId) return

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

/**
 * Processa notificação de cobrança recorrente aprovada (mensalidade).
 *
 * Fluxo:
 *   1. Busca o pagamento pelo ID recebido
 *   2. Extrai o `preapproval_id` do pagamento (vincula à assinatura)
 *   3. Acha a Company pelo `mpPreapprovalId`
 *   4. Se status do pagamento for `approved`, estende `planExpiresAt` por +30d
 */
async function handleAuthorizedPaymentEvent(paymentId: string) {
  if (!mpPayment) return

  const payment = (await mpPayment.get({ id: paymentId })) as unknown as Record<string, unknown>
  if (!payment) return

  const status = payment.status as string | undefined
  if (status !== "approved") {
    console.log(`MP: pagamento ${paymentId} status=${status} (ignorado)`)
    return
  }

  // O preapproval_id pode vir em campos diferentes dependendo do tipo
  const preapprovalId =
    (payment.preapproval_id as string | undefined) ||
    (payment.metadata as Record<string, unknown> | undefined)?.preapproval_id as string | undefined

  if (!preapprovalId) {
    console.log(`MP: pagamento ${paymentId} sem preapproval_id (ignorado)`)
    return
  }

  const company = await prisma.company.findUnique({
    where: { mpPreapprovalId: preapprovalId },
    select: { id: true, planExpiresAt: true },
  })
  if (!company) {
    console.warn(`MP: pagamento ${paymentId} ref preapproval ${preapprovalId} sem company`)
    return
  }

  // Idempotência: MP entrega webhooks "at least once" — pode mandar o mesmo
  // payment_id várias vezes em retries. Se o `planExpiresAt` atual ainda
  // cobre mais de 25 dias à frente, este webhook é claramente uma duplicata
  // (cobrança mensal aprovada só renova quando o ciclo está quase no fim).
  // Sem essa guarda, replays estendiam o plano em +30d a cada notificação.
  const now = Date.now()
  const REPLAY_THRESHOLD_MS = 25 * 24 * 60 * 60 * 1000
  if (
    company.planExpiresAt &&
    company.planExpiresAt.getTime() > now + REPLAY_THRESHOLD_MS
  ) {
    console.log(
      `MP: pagamento ${paymentId} ignorado (plano ainda cobre >25d à frente — provável replay)`
    )
    return
  }

  // Estende +30 dias a partir do planExpiresAt atual OU de agora, o que for
  // maior. Evita encurtar janela se renovação chegar antes do vencimento.
  const base =
    company.planExpiresAt && company.planExpiresAt > new Date()
      ? new Date(company.planExpiresAt)
      : new Date()
  base.setMonth(base.getMonth() + 1)

  await prisma.company.update({
    where: { id: company.id },
    data: { planExpiresAt: base },
  })
  console.log(`MP: company ${company.id} renovada até ${base.toISOString()}`)
}
