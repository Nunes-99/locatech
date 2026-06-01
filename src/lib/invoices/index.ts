import type { InvoiceProvider } from "./types"
import { MockProvider } from "./providers/mock"
import { buildFocusProvider } from "./providers/focus"
import { decryptJson } from "../crypto"
import type { CompanyTaxConfig, InvoiceProviderType } from "@prisma/client"

export * from "./types"

/**
 * Lê `providerCredentials` da CompanyTaxConfig. Aceita 3 formatos:
 *   - `{ enc: "enc:v1:..." }` — novo (criptografado AES-256-GCM)
 *   - `{ token: "...", ... }` — legado plaintext (compat)
 *   - null/{} — não configurado
 */
function readProviderCredentials(
  raw: unknown
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {}
  const obj = raw as Record<string, unknown>
  if (typeof obj.enc === "string") {
    try {
      return decryptJson<Record<string, string>>(obj.enc)
    } catch (err) {
      console.error("[invoices] falha decriptando providerCredentials:", err)
      return {}
    }
  }
  // Formato legado: campos diretos no JSON.
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => typeof v === "string")
  ) as Record<string, string>
}

/**
 * Fábrica que devolve a implementação certa baseada na configuração da empresa.
 *
 * Para providers que precisam de credenciais, lê de `providerCredentials` (JSON).
 * Se faltar credencial, faz fallback pro MockProvider e loga warning.
 */
export function getInvoiceProvider(config: CompanyTaxConfig | null): InvoiceProvider {
  if (!config) return MockProvider

  switch (config.provider as InvoiceProviderType) {
    case "MOCK":
      return MockProvider

    case "FOCUS_NFE": {
      const creds = readProviderCredentials(config.providerCredentials)
      const token = creds.token
      if (!token) {
        console.warn(`[invoices] Focus NF-e sem token configurado — usando Mock`)
        return MockProvider
      }
      return buildFocusProvider({ token, env: config.providerEnv })
    }

    case "PLUG_NOTAS":
    case "E_NOTAS":
      console.warn(`[invoices] Provider ${config.provider} ainda não implementado — usando Mock`)
      return MockProvider

    default:
      return MockProvider
  }
}

export { MockProvider }
