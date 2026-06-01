/**
 * CSRF — proteção por verificação de Origin/Referer.
 *
 * Estratégia escolhida: comparar Origin (ou Referer como fallback) com o host
 * da request. É leve, sem state, e cobre o caso típico de ataque cross-origin.
 *
 * NextAuth já mitiga via SameSite=Lax nos cookies de sessão, mas redundância
 * em camadas é boa prática — defense in depth.
 *
 * Esta proteção NÃO se aplica a:
 *   - Endpoints públicos (`/api/public/*`, `/api/v1/*`) — esses usam outros mecanismos
 *     (API keys, tokens de uso único)
 *   - Webhooks externos entrando (`/api/stripe/webhook`) — Stripe valida via
 *     assinatura HMAC
 *   - Crons (`/api/cron/*`) — protegidos por `CRON_SECRET`
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

const EXEMPT_PATH_PREFIXES = [
  "/api/public/",
  "/api/v1/",
  "/api/stripe/webhook",
  "/api/cron/",
  // NextAuth lida com seu próprio CSRF
  "/api/auth/",
]

export interface CsrfCheckResult {
  allowed: boolean
  reason?: string
}

export function checkCsrf(request: Request): CsrfCheckResult {
  if (SAFE_METHODS.has(request.method)) {
    return { allowed: true }
  }

  const url = new URL(request.url)
  for (const prefix of EXEMPT_PATH_PREFIXES) {
    if (url.pathname.startsWith(prefix)) return { allowed: true }
  }

  const host = url.host
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")

  // Tenta Origin primeiro (mais confiável que Referer)
  if (origin) {
    try {
      const originHost = new URL(origin).host
      if (originHost === host) return { allowed: true }
      return { allowed: false, reason: `Origin "${originHost}" não é do mesmo host ("${host}")` }
    } catch {
      return { allowed: false, reason: "Origin header inválido" }
    }
  }

  // Fallback: Referer
  if (referer) {
    try {
      const refererHost = new URL(referer).host
      if (refererHost === host) return { allowed: true }
      return { allowed: false, reason: `Referer "${refererHost}" não é do mesmo host` }
    } catch {
      return { allowed: false, reason: "Referer header inválido" }
    }
  }

  // Nenhum header de Origin/Referer — bloqueia. Browsers modernos sempre enviam
  // pelo menos um deles. Ausência sugere fetch sem proteção (atacante ou bot).
  return { allowed: false, reason: "Origin/Referer ausentes em request mutating" }
}
