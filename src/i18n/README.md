# i18n — estrutura preparada

Este diretório guarda os dicionários de tradução. Hoje só **pt-BR** está ativo —
estrutura existe pra facilitar adicionar outros idiomas no futuro sem refactor grande.

## Como adicionar um idioma

1. Crie `src/i18n/en-US.ts` com a mesma forma de `pt-BR.ts`:
   ```ts
   export const enUS: Record<string, string> = {
     "common.save": "Save",
     // ...todas as chaves
   }
   ```
2. Em `src/lib/i18n.ts`, importe e adicione ao map `LOCALES`.
3. Implemente a seleção (cookie, header, query string ou subdomain).

## Uso

```ts
import { t } from "@/lib/i18n"

t("common.save")                                         // "Salvar"
t("rental.contractNumber", { number: 42 })               // "Contrato #42"
t("rental.daysRemaining", { count: 3 })                  // "Faltam 3 dia(s) pra devolver"
```

## Status atual

A maioria das strings das páginas existentes ainda está em PT-BR direto (sem
`t()`). Isso é proposital: migrar tudo agora seria muita churn sem ganho imediato.
Quando um cliente real pedir inglês/espanhol, faremos o sweep page by page.
