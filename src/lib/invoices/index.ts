import type { InvoiceProvider } from "./types"
import { MockProvider } from "./providers/mock"
import { buildFocusProvider } from "./providers/focus"
import type { CompanyTaxConfig, InvoiceProviderType } from "@prisma/client"

export * from "./types"

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
      const creds = (config.providerCredentials as Record<string, string> | null) ?? {}
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
