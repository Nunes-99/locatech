# E2E Tests — Playwright

Testes end-to-end usando Playwright. Hoje cobrem apenas páginas públicas como
smoke test — quando o ambiente de teste com banco estiver configurado, adicionar
specs cobrindo o fluxo principal (cadastro → criar equipamento → criar locação →
devolver → emitir NF).

## Rodar localmente

```bash
# 1. Sobe o app
npm run dev

# 2. Em outro terminal
npm run test:e2e          # roda headless
npm run test:e2e:ui       # roda no Playwright UI (debug)
```

## Variáveis

- `E2E_BASE_URL` — default `http://localhost:3000`. Aponta pra outro env (staging, preview Vercel) pra testar lá.

## Próximas specs (quando banco de teste estiver pronto)

- `auth.spec.ts` — cadastro completo + login + 2FA setup
- `equipment.spec.ts` — CRUD + import CSV
- `customer.spec.ts` — CRUD + busca CEP
- `rental.spec.ts` — fluxo completo (criar → confirmar → handover QR → devolver → emitir NF)
- `catalog.spec.ts` — catálogo público

## Estratégia de DB pra E2E

Recomendado:
1. PostgreSQL separado pra testes (`locatech_test`)
2. Variável `DATABASE_URL` apontando pra ele no `.env.test`
3. `globalSetup` no playwright.config zera o DB e roda seed antes de cada suite
4. Webhook stubs/mocks pra Stripe/Resend (já que não queremos efeitos reais)

## CI

Em GitHub Actions, descomente `webServer` em `playwright.config.ts` — ele sobe
o app automaticamente. Workflow exemplo já pode ser adicionado em `.github/workflows/e2e.yml`
quando o banco de teste estiver pronto.
