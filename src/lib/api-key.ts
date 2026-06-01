import crypto from "crypto"
import { prisma } from "./prisma"
import { Permission, canPerform } from "./permissions"
import { rateLimit } from "./rate-limit"

/**
 * API key flow:
 *   1. Empresa cria via POST /api/api-keys → recebe `keyValue` cru UMA vez
 *   2. Para autenticar, envia header `X-API-Key: <key>` ou `Authorization: Bearer <key>`
 *   3. Server hasheia com SHA-256 e busca em `ApiKey.keyHash`
 *
 * Keys são prefixadas com `lt_live_` pra facilitar reconhecimento.
 */

export const API_KEY_PREFIX = "lt_live_"

export function generateApiKey(): { raw: string; hash: string; last4: string } {
  const randomPart = crypto.randomBytes(24).toString("base64url")
  const raw = `${API_KEY_PREFIX}${randomPart}`
  const hash = crypto.createHash("sha256").update(raw).digest("hex")
  const last4 = raw.slice(-4)
  return { raw, hash, last4 }
}

export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex")
}

export interface ApiKeyContext {
  companyId: string
  apiKeyId: string
  permissions: string[]
  rateLimit: number
}

/**
 * Extrai e valida API key da request. Joga erro com status apropriado se falhar.
 *
 * Também aplica rate limit por key. O default é 60 req/min mas cada key
 * pode ter o seu (`ApiKey.rateLimit`).
 */
export async function authenticateApiKey(headers: Headers): Promise<ApiKeyContext> {
  const headerKey = headers.get("x-api-key")
  const bearer = headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const raw = headerKey || bearer

  if (!raw || !raw.startsWith(API_KEY_PREFIX)) {
    throw apiKeyError(401, "API key ausente. Use header X-API-Key ou Authorization: Bearer.")
  }

  const hash = hashApiKey(raw)
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: {
      id: true,
      companyId: true,
      permissions: true,
      rateLimit: true,
      isActive: true,
      expiresAt: true,
    },
  })

  if (!apiKey || !apiKey.isActive) {
    throw apiKeyError(401, "API key inválida ou desativada")
  }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw apiKeyError(401, "API key expirada")
  }

  // Rate limit por key
  const rl = rateLimit({
    key: `apikey:${apiKey.id}`,
    limit: apiKey.rateLimit,
    windowMs: 60 * 1000,
  })
  if (!rl.allowed) {
    throw apiKeyError(429, `Rate limit excedido (${apiKey.rateLimit}/min). Tente em ${rl.retryAfterSeconds}s.`)
  }

  // Marca uso (não bloqueia)
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch((err) => console.error("[apikey] failed to update lastUsedAt:", err))

  return {
    companyId: apiKey.companyId,
    apiKeyId: apiKey.id,
    permissions: apiKey.permissions,
    rateLimit: apiKey.rateLimit,
  }
}

export function requireApiPermission(ctx: ApiKeyContext, permission: Permission): void {
  // Se a key tem permissões custom, valida pela lista; senão usa null = "tudo".
  if (ctx.permissions.length === 0) return // legacy: keys sem permissions = full access
  if (!ctx.permissions.includes(permission) && !canPerform("OWNER", permission)) {
    throw apiKeyError(403, `Esta API key não tem permissão para '${permission}'`)
  }
}

class ApiKeyHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = "ApiKeyHttpError"
  }
}

function apiKeyError(status: number, msg: string): ApiKeyHttpError {
  return new ApiKeyHttpError(status, msg)
}

export function isApiKeyError(error: unknown): error is ApiKeyHttpError {
  return error instanceof ApiKeyHttpError
}
