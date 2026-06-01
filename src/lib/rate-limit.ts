interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterSeconds?: number
}

export function rateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    }
  }

  bucket.count += 1
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt }
}

/**
 * Resolve o IP do cliente confiando em headers que o proxy preenche.
 *
 * Ordem de precedência:
 *   1. `cf-connecting-ip` — definido apenas pela Cloudflare; cliente não pode forjar
 *   2. `x-real-ip` — definido pelo Nginx/proxy reverso confiável
 *   3. `x-forwarded-for` — pegamos o ÚLTIMO endereço (o que o proxy adicionou),
 *      não o primeiro. O primeiro pode vir do header bruto que o cliente mandou.
 *
 * Pré-requisito de deploy: rodar atrás de um proxy confiável (Vercel, Nginx,
 * Cloudflare) configurado pra adicionar/sobrescrever os headers acima. Sem
 * proxy, qualquer atacante pode forjar `X-Forwarded-For` e bypassar rate limit
 * IP-based.
 */
export function getClientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")
  if (cf) return cf.trim()

  const real = headers.get("x-real-ip")
  if (real) return real.trim()

  const xff = headers.get("x-forwarded-for")
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean)
    // último = mais próximo do servidor, adicionado pelo último proxy confiável
    if (parts.length > 0) return parts[parts.length - 1]!
  }

  return "unknown"
}

// Limpeza periódica (evita memory leak em runtime persistente)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key)
    }
  }, 60 * 1000).unref?.()
}
