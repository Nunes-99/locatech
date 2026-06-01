/**
 * Estrutura mínima de i18n. Hoje só pt-BR. Quando precisar adicionar outro idioma:
 *   1. Crie `messages/en-US.ts` (ou import dinâmico)
 *   2. Adicione ao map `LOCALES`
 *   3. Decida estratégia de seleção (cookie, header Accept-Language, query, etc)
 *
 * A função `t()` aceita chaves planas (ex: `t("common.save")`) e interpolação simples
 * de variáveis (ex: `t("rental.daysRemaining", { count: 3 })`).
 *
 * Uso típico (server ou client component):
 *
 *   import { t } from "@/lib/i18n"
 *   const label = t("common.save") // "Salvar" em pt-BR
 *
 * Esta é a fundação — strings das páginas existentes ficam em PT-BR direto até
 * surgir demanda real por outro idioma (não vale gastar tempo migrando agora).
 */

import { ptBR } from "@/i18n/pt-BR"

export type Locale = "pt-BR" | "en-US"

const LOCALES: Record<Locale, Record<string, string>> = {
  "pt-BR": ptBR,
  // "en-US": enUS,  // descomentar quando criar o arquivo
} as any

let currentLocale: Locale = "pt-BR"

export function setLocale(locale: Locale) {
  currentLocale = locale
}

export function getLocale(): Locale {
  return currentLocale
}

/**
 * Lookup de uma chave de mensagem com fallback graciosos.
 *
 * Ordem de fallback:
 *   1. Idioma atual
 *   2. pt-BR (sempre completo — fonte da verdade)
 *   3. A própria chave (sinaliza chave faltante mas não quebra UI)
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const bundle = LOCALES[currentLocale] ?? LOCALES["pt-BR"]
  let template = bundle[key] ?? LOCALES["pt-BR"][key] ?? key

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      template = template.replace(new RegExp(`\\{${k}\\}`, "g"), String(v))
    }
  }

  return template
}
