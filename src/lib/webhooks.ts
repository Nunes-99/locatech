import crypto from "crypto"
import { prisma } from "./prisma"
import { decryptString } from "./crypto"

/**
 * Eventos disparáveis. Adicione novos eventos aqui e nos pontos de chamada
 * (geralmente após uma operação concluída — locação criada, devolvida, etc).
 */
export const WEBHOOK_EVENTS = [
  "rental.created",
  "rental.confirmed",
  "rental.returned",
  "rental.cancelled",
  "rental.overdue",
  "rental.extended",
  "customer.created",
  "customer.blocked",
  "equipment.created",
  "equipment.retired",
  "maintenance.scheduled",
  "maintenance.completed",
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

interface DispatchOptions {
  companyId: string
  event: WebhookEvent
  /** Payload do evento — será JSON-serialized. Inclua só dados não-sensíveis. */
  data: Record<string, unknown>
}

/**
 * Dispara webhooks de saída para um evento.
 *
 * Não-bloqueante: roda em background. Sempre chame com `void` ou `.catch()` — falhas
 * de webhook NUNCA devem quebrar a operação principal.
 *
 * Timeout: 5s por endpoint. Sem retry automático (subscriber é responsável por
 * idempotência via `delivery_id`).
 */
export async function dispatchWebhooks(opts: DispatchOptions): Promise<void> {
  const { companyId, event, data } = opts

  let webhooks: Array<{ id: string; url: string; secret: string }>
  try {
    webhooks = await prisma.webhook.findMany({
      where: {
        companyId,
        isActive: true,
        events: { has: event },
      },
      select: { id: true, url: true, secret: true },
    })
  } catch (err) {
    console.error("[webhooks] failed to load:", err)
    return
  }

  if (webhooks.length === 0) return

  const deliveryId = crypto.randomUUID()
  const timestamp = Math.floor(Date.now() / 1000)
  const body = JSON.stringify({
    id: deliveryId,
    event,
    timestamp,
    data,
  })

  // Fire-and-forget — não esperamos resposta antes de retornar
  for (const webhook of webhooks) {
    void deliverOne(webhook, body, deliveryId, event, timestamp).catch((err) => {
      console.error(`[webhooks] delivery ${webhook.id} failed:`, err)
    })
  }
}

async function deliverOne(
  webhook: { id: string; url: string; secret: string },
  body: string,
  deliveryId: string,
  event: string,
  timestamp: number
): Promise<void> {
  // Assinatura HMAC SHA256 sobre o body. Subscriber deve recomputar e comparar.
  // decryptString é no-op se o secret estiver em plaintext (legado) ou se a
  // env APP_ENCRYPTION_KEY não estiver configurada.
  let secretPlain: string
  try {
    secretPlain = decryptString(webhook.secret)
  } catch (err) {
    console.error(`[webhooks] falha decriptando secret ${webhook.id}:`, err)
    return
  }
  const signature = crypto
    .createHmac("sha256", secretPlain)
    .update(body)
    .digest("hex")

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-LocaTech-Event": event,
        "X-LocaTech-Delivery": deliveryId,
        "X-LocaTech-Timestamp": String(timestamp),
        "X-LocaTech-Signature": `sha256=${signature}`,
        "User-Agent": "LocaTech-Webhooks/1.0",
      },
      body,
      signal: AbortSignal.timeout(5000),
    })

    if (response.ok) {
      await prisma.webhook
        .update({
          where: { id: webhook.id },
          data: {
            lastSuccessAt: new Date(),
            successCount: { increment: 1 },
            lastFailureError: null,
          },
        })
        .catch(() => {})
    } else {
      await prisma.webhook
        .update({
          where: { id: webhook.id },
          data: {
            lastFailureAt: new Date(),
            failureCount: { increment: 1 },
            lastFailureError: `HTTP ${response.status}`,
          },
        })
        .catch(() => {})
    }
  } catch (err) {
    await prisma.webhook
      .update({
        where: { id: webhook.id },
        data: {
          lastFailureAt: new Date(),
          failureCount: { increment: 1 },
          lastFailureError: (err as Error).message.slice(0, 500),
        },
      })
      .catch(() => {})
  }
}
