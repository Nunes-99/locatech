import { MercadoPagoConfig, PreApproval, Payment } from "mercadopago"
import crypto from "crypto"

const accessToken = process.env.MP_ACCESS_TOKEN

export const mpClient = accessToken
  ? new MercadoPagoConfig({
      accessToken,
      options: { timeout: 5000 },
    })
  : null

export const mpPreapproval = mpClient ? new PreApproval(mpClient) : null
export const mpPayment = mpClient ? new Payment(mpClient) : null

export function isMpConfigured(): boolean {
  return mpClient !== null
}

/**
 * Valida a assinatura `x-signature` do webhook do MP.
 *
 * Formato esperado do header: `ts=1234567890,v1=hash`
 * Template do HMAC: `id:{data.id};request-id:{x-request-id};ts:{ts};`
 * Hash: HMAC-SHA256(template, MP_WEBHOOK_SECRET)
 *
 * Ref: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export function verifyMpWebhookSignature(params: {
  signatureHeader: string | null
  requestId: string | null
  dataId: string
  secret: string
}): boolean {
  const { signatureHeader, requestId, dataId, secret } = params
  if (!signatureHeader || !requestId || !secret) return false

  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split("=").map((s) => s.trim())
    if (k && v) acc[k] = v
    return acc
  }, {})

  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const template = `id:${dataId};request-id:${requestId};ts:${ts};`
  const expected = crypto.createHmac("sha256", secret).update(template).digest("hex")

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"))
  } catch {
    return false
  }
}
