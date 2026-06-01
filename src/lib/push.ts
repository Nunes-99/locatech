import webpush from "web-push"
import { prisma } from "./prisma"
import { PrismaClient } from "@prisma/client"

/**
 * Web Push helper.
 *
 * Configure as env vars antes de usar:
 *   VAPID_PUBLIC_KEY=<base64url>
 *   VAPID_PRIVATE_KEY=<base64url>
 *   VAPID_SUBJECT=mailto:contato@suaempresa.com
 *
 * Gerar par de chaves: `npx web-push generate-vapid-keys`
 *
 * O envio é silencioso se as keys não estiverem configuradas (warning no console).
 */

let vapidConfigured = false

function ensureVapid(): boolean {
  if (vapidConfigured) return true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!pub || !priv || !subject) {
    return false
  }
  try {
    webpush.setVapidDetails(subject, pub, priv)
    vapidConfigured = true
    return true
  } catch (err) {
    console.error("[push] failed to configure VAPID:", err)
    return false
  }
}

export function getPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null
}

interface PushPayload {
  title: string
  body: string
  /** URL relativa pra abrir no click (default /). */
  url?: string
  /** Tag pra agrupar notifications similares. */
  tag?: string
  /** Ícone customizado (URL). */
  icon?: string
}

const baseClient: PrismaClient = (prisma as unknown as { $extends: unknown }) as PrismaClient

/**
 * Envia push para todas as subscriptions de um usuário.
 *
 * Fire-and-forget — sempre chame com `void`. Falhas são loggadas e subscriptions
 * mortas (410/404) são marcadas como inválidas pra serem limpas depois.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureVapid()) {
    console.warn("[push] VAPID keys not configured, skipping send")
    return
  }

  const subs = await baseClient.pushSubscription.findMany({
    where: { userId, invalid: false },
  })

  if (subs.length === 0) return

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/dashboard",
    tag: payload.tag,
    icon: payload.icon ?? "/icons/icon-192x192.png",
  })

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 } // 1h
        )
        baseClient.pushSubscription
          .update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } })
          .catch(() => {})
      } catch (err: any) {
        // 404 ou 410 = subscription morta
        const statusCode = err?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          baseClient.pushSubscription
            .update({ where: { id: sub.id }, data: { invalid: true } })
            .catch(() => {})
        } else {
          console.error(`[push] send failed for sub ${sub.id}:`, err?.message || err)
        }
      }
    })
  )
}

/** Envia push para todos os OWNER/ADMIN de uma empresa (notificações operacionais). */
export async function sendPushToCompanyAdmins(
  companyId: string,
  payload: PushPayload
): Promise<void> {
  const admins = await baseClient.user.findMany({
    where: { companyId, role: { in: ["OWNER", "ADMIN"] } },
    select: { id: true },
  })
  await Promise.all(admins.map((u) => sendPushToUser(u.id, payload)))
}
