# LocaTech — Roadmap de Melhorias

Lista de pendências priorizadas após auditoria em 2026-05-29. Marque com `[x]` ao concluir.

Convenção: cada item tem ID estável (`B<bloco>.<num>`) que permanece mesmo se a ordem mudar.

---

## Bloco 1 — Configuração mínima pra rodar (bloqueante)

- [x] **B1.1** `.env` + `.env.local` gerados com DATABASE_URL + secrets random + EMAIL_FROM + ADMIN_EMAILS. (~5min)
- [x] **B1.2** Migration `initial_schema` aplicada — ~25 tabelas + índices compostos no PostgreSQL 18 local. (~2min)
- [x] **B1.3** Seed com 11 categorias de construção (Andaimes/Betoneiras/Compactadores/etc), idempotente. (~30min)
- [x] **B1.4** Smoke test passou — landing 200, /api/health ok com DB latência 138ms, registro de empresa OK. (~30min)

## Bloco 2 — Segurança

- [x] **B2.1** Verificação de email — token + endpoint `POST /api/auth/verify-email` + reenvio `/api/auth/verify-email/resend` + página `/verificar-email` + template. (~2h)
- [ ] **B2.2** 2FA/TOTP opcional pra OWNER/ADMIN (otplib + QR + backup codes). (~4h)
- [ ] **B2.3** Rate limit persistente (Upstash Redis em vez de in-memory). (~2h) — _dep: conta Upstash_
- [x] **B2.4** Histórico de sessões ativas com revogação. (~3h)
- [x] **B2.5** Política de senha forte (mín 8, maiúscula/minúscula/dígito/símbolo ou zxcvbn). (~1h)
- [x] **B2.6** Proteção CSRF via verificação de Origin/Referer no middleware (rotas mutating; isenta /api/public, /api/v1, /api/stripe/webhook, /api/cron, /api/auth). (~2h)
- [x] **B2.7** Exportação CSV dos audit logs. (~1h)
- [x] **B2.8** Alerta automático após N falhas de login seguidas. (~1h)

## Bloco 3 — Robustez / Escala / Deploy-ready

- [ ] **B3.1** Upload em blob storage (Azurite local + Azure Blob/S3/R2 em produção). (~2-3h) — _dep: conta cloud_
- [x] **B3.2** Compressão de imagem no upload (sharp). (~1h)
- [x] **B3.3** Soft delete em Rental e Maintenance. (~2h)
- [x] **B3.4** Pool de conexões Prisma — singleton já existia; documentado em `OPERACAO.md` com receitas pra Neon/Supabase/pgbouncer/Accelerate + diagnose. (~1h)
- [x] **B3.5** Backup automático — `scripts/backup.sh` (pg_dump -Fc + retenção local + opcional upload S3) + endpoint `/api/cron/backup`. (~3h)
- [x] **B3.6** Health check com checagens externas (Resend, Stripe, DB). (~1h)
- [x] **B3.7** Logging estruturado — Pino em `src/lib/logger.ts` com redact (passwordHash/token/totpSecret/etc) e `withRequestContext()`. JSON pronto pra forward externo. (~3h)
- [x] **B3.8** Sentry — `@sentry/nextjs` instalado + 3 configs (client/server/edge) + `instrumentation.ts`. Sem DSN = no-op. (~1h)
- [x] **B3.9** Endpoint `/api/metrics` em formato Prometheus protegido por `METRICS_TOKEN`; expõe companies/users/equipment/rentals/login fails/webhook failures. (~2h)

## Bloco 4 — Funcionalidades faltando

- [x] **B4.1** Importação CSV de clientes. (~1h)
- [x] **B4.2** Importação CSV de categorias. (~30min)
- [x] **B4.3** Exportação Excel real (exceljs). (~2h)
- [x] **B4.4** Dashboard de lucro detalhado (receita − custos − despesas, top equipamentos, evolução mensal). (~4h)
- [x] **B4.5** Despesas por equipamento (`EquipmentExpense`). (~2h)
- [x] **B4.6** Histórico financeiro/extrato do cliente. (~3h)
- [x] **B4.7** Renovação/extensão de locação in-place. (~2h)
- [x] **B4.8** Reservas com expiração automática (cron). (~2h)
- [x] **B4.9** Assinatura digital — `<SignaturePad>` em canvas + embed da imagem no contrato PDF; capturada no fluxo de check-in público. (~4h)
- [ ] **B4.10** Checklist de entrega/devolução com fotos. (~5h) — _dep: blob storage_
- [x] **B4.11** QR check-in/check-out — tokens em Rental + páginas públicas `/entrega/[token]` e `/devolucao/[token]` + QRs gerados pelo operador. (~4h)
- [x] **B4.12** Push notification web — model `PushSubscription`, helper `sendPushToUser`/`sendPushToCompanyAdmins`, endpoints subscribe/unsubscribe/test, service worker `/sw-push.js`, hook `usePushNotifications`, card de ativação em `/seguranca`. (~4h)
- [ ] **B4.13** WhatsApp transacional (Baileys ou Meta API). (~6-8h) — _dep: API/conta_
- [ ] **B4.14** SMS fallback (Twilio/Zenvia). (~3h) — _dep: conta_
- [x] **B4.15** Catálogo público por locadora (`/catalogo/{slug}`) — campos slug+publicCatalog+headline+whatsapp em Company; rota pública sem auth com cache 60s; grid responsivo com link WhatsApp por item. (~6h)
- [ ] **B4.16** Geração de boletos/Pix (Asaas/Gerencianet/Cora). (~6-8h) — _dep: gateway_
- [x] **B4.17** API pública: model `ApiKey` + CRUD + helper `authenticateApiKey` (X-API-Key / Bearer, HMAC SHA-256, rate limit por key) + `/api/v1/{equipment,customers,rentals}` + página `/api-docs`. Gated em plano PRO. (~8-10h)
- [x] **B4.18** Webhooks de saída configuráveis (HMAC SHA256, eventos rental.created/confirmed/returned/etc, fire-and-forget). (~4h)
- [ ] **B4.19** Multi-loja (uma locadora com filiais). (~8h)

## Bloco 5 — UX / Frontend

- [x] **B5.1** Página `/demo` (link da landing aponta pra rota inexistente). (~2h)
- [x] **B5.2** Onboarding wizard pós-cadastro. (~4h)
- [x] **B5.3** Filtros salvos ("minhas buscas") via hook `useSavedFilters` (localStorage); aplicado em equipamentos e clientes. (~3h)
- [x] **B5.4** Toasts com ação desfazer em deletes (clientes e equipamentos; aproveita o soft delete existente). (~2h)
- [x] **B5.5** Skeleton loaders consistentes em todas as listagens. (~2h)
- [x] **B5.6** Contraste dark mode em badges e mapas de cores (auditoria, pagamentos). (~1h)
- [x] **B5.7** Branding por locadora: logo + cor primária no contrato PDF e no header dos emails (helper `shell` aceita `EmailBranding`). (~4h)
- [x] **B5.8** Estrutura i18n preparada (`src/lib/i18n.ts` + `src/i18n/pt-BR.ts` + README; sem migrar strings ainda — migração quando surgir demanda real). (~3h)

## Bloco 6 — DevOps / Operação

- [x] **B6.1** CI GitHub Actions (lint + typecheck + test em PR). (~2h)
- [x] **B6.2** Validação de migrations em PR (`prisma migrate diff`). (~1h)
- [ ] **B6.3** Preview deploys Vercel por branch. (~30min) — _dep: conta Vercel_
- [x] **B6.4** Stack containerizada — Dockerfile multi-stage + docker-compose (postgres+app+nginx) + nginx.conf + deploy.sh + DEPLOY.md. Falta provisionar VM e DNS pra ir ao ar. (~4h)
- [x] **B6.5** `OPERACAO.md` (criar tenant, suspender, restore). (~2h)
- [x] **B6.6** Painel super-admin com ações de alterar plano e suspender empresa (revoga sessões). (~6h)

## Bloco 7 — Compliance / Legal

- [x] **B7.1** Páginas `/termos` e `/privacidade`. (~4h) — _dep: texto jurídico (esboço; revisar com advogado)_
- [x] **B7.2** Aceite explícito no cadastro com registro de versão. (~1h)
- [x] **B7.3** LGPD — exportação de dados do cliente. (~3h)
- [x] **B7.4** LGPD — direito ao esquecimento (`POST /api/customers/[id]/anonymize` exige OWNER + confirmação "ANONIMIZAR"; substitui PII por placeholders mas preserva financeiro). (~4h)
- [x] **B7.5** DPO/contato de privacidade configurável. (~1h)
- [x] **B7.6** Banner de cookies discreto na home/landing (dismiss em localStorage). (~1h)

## Bloco 8 — Testes

- [x] **B8.1** Testes pra módulos com lógica não-trivial — permissions (9 testes), rate-limit (10 testes), api-key (6 testes). 101 testes totais agora. (~8h)
- [ ] **B8.2** Testes E2E do fluxo crítico (Playwright). (~6h)
- [x] **B8.3** Coverage de validators > 90% (testes pra password-strength + helpers de csv). (~2h)
- [x] **B8.4** Fixtures isoladas em `__tests__/fixtures/factories.ts` com builders pra todos os models principais + README explicando convenções. (~3h)

## Bloco 9 — Nota Fiscal (último por ser mais complexo)

### Onda 1 — Essencial pra cobrar (~22h)
- [x] **B9.1** Schema `Invoice` + `CompanyTaxConfig` + enums. (~2h)
- [x] **B9.2** Interface `InvoiceProvider` + `MockProvider` (sucesso instantâneo pra dev) + esqueleto Focus NF-e. (~2h)
- [ ] **B9.3** Provider Focus NF-e (API REST) — _dep: conta Focus_ (esqueleto pronto). (~4h)
- [x] **B9.4** Página `/configuracoes/fiscal` com dados emissor, ISS, provider, ambiente, automação. (~3h)
- [x] **B9.5** `POST /api/rentals/[id]/invoice` cria Invoice + chama provider; descrição automática. (~3h)
- [x] **B9.6** Página `/notas` com filtros + paginação + download PDF + cancelamento. (~4h)
- [x] **B9.7** Webhook `/api/invoices/webhook` parseia payload do provider + atualiza status. (~2h)
- [x] **B9.8** `POST /api/invoices/[id]/cancel` com motivo (5+ chars). (~2h)
- [x] **B9.9** Emissão automática — helper `issueInvoiceForRental` idempotente + `maybeAutoIssue` triggers em return/payment + cron `/api/cron/auto-issue-invoices` (catch-up diário 10:00). (~1h)
- [x] **B9.13** Email com PDF — template `getInvoiceIssuedEmail` enviado pro cliente quando a nota é autorizada. (~1h)
- [x] **B9.15** Gate de plano — `invoices: true` em STARTER/PRO; FREE bloqueado com upgrade prompt. (~30min)

### Onda 2 — Sofisticação (~30h)
- [ ] **B9.10** NF-e modelo 55 de remessa/retorno. (~4h)
- [ ] **B9.11** NF-e modelo 55 de venda (baixa de equipamento). (~3h)
- [ ] **B9.12** Carta de Correção Eletrônica (CCe). (~2h)
- [ ] **B9.14** Dashboard fiscal (notas/mês, ISS, rejeições, vencimento cert). (~3h)
- [ ] **B9.16** Provider alternativo PlugNotas ou eNotas. (~4h) — _dep: conta alt_
- [ ] **B9.17** Testes E2E fiscais em sandbox. (~4h)

---

## Histórico de execução

| Data | Itens concluídos |
|---|---|
| 2026-05-29 (incrementos iniciais) | AuditLog, AccessLog, EquipmentPriceHistory, RBAC, rate limit, CSP, import equipamento CSV, busca avançada, QR code, health check, página /auditoria, templates email |
| 2026-05-29 (lote 2) | B2.5 senha forte + medidor de força, B2.7 export CSV auditoria, B2.8 alerta de 5 falhas/15min, B3.2 sharp compression, B3.3 soft delete rental/maintenance, B4.1 import clientes CSV, B4.2 import categorias CSV, B5.1 página /demo, B7.1 /termos e /privacidade (esboço), B7.2 aceite obrigatório no cadastro com versão |
| 2026-05-29 (lote 3) | B2.4 sessões ativas + revogar tudo (campo `tokensInvalidatedAt` + página /seguranca), B4.3 export Excel real (exceljs), B4.4 dashboard de lucro detalhado (/lucro com evolução mensal + top 10 receita/margem), B6.5 OPERACAO.md (deploy, backup, suspensão, troubleshooting, métricas) |
| 2026-05-29 (lote 4) | B3.6 health check com checks externos (Resend + Stripe) opt-in via `?detailed=1`, B4.7 renovação de locação (`POST /api/rentals/[id]/extend` recalcula items + total + zera lateFee se voltar pra IN_PROGRESS), B4.6 extrato do cliente (`/api/customers/[id]/statement` + página `/clientes/[id]/extrato` com KPIs, lista de locações e timeline), B5.4 toasts undo nos deletes de cliente e equipamento (duração 10s, chama PUT pra reverter) |
| 2026-05-29 (lote 5) | B4.5 EquipmentExpense (model + CRUD `/api/equipment/[id]/expenses` + integração no `/api/financial/profit`), B7.3 LGPD export (`/api/customers/[id]/export` retorna JSON com cliente + locações + items + audit logs; botão na página /clientes/[id]/extrato), B5.2 onboarding wizard (componente `OnboardingChecklist` na dashboard, 5 passos derivados — perfil empresa, 1ª categoria/equip/cliente/locação; dismissable em localStorage), B5.5 SkeletonTable substituindo Loader2 em equipamentos/clientes/locações/manutenções |
| 2026-05-29 (lote 6) | B6.1 CI GitHub Actions (.github/workflows/ci.yml: install → prisma generate → validate → format check → migration diff condicional → lint → typecheck → test → build), B6.2 step de migration diff já incluso no mesmo workflow (skip se prisma/migrations ainda não existe), B4.8 reservas com expiração (`quoteExpiresAt` em Rental + `quoteValidDays` em Company + flag `asQuote` em POST /api/rentals + cron diário 06:00 em /api/cron/expire-quotes), B7.5 DPO (`dpoEmail`/`dpoName` em Company expostos via /api/company/settings e incluídos no export LGPD em controller.dpo), B8.3 testes de checkPasswordStrength + parseCsvNumber + splitCsvLine + parseCsvHeader (75 testes passando; **achou bug real**: parseCsvNumber tratava "1234.56" como 123456 — corrigido pra distinguir formato BR (vírgula presente) vs US/internacional (sem vírgula)) |
| 2026-05-29 (lote 7) | B6.6 super-admin actions (PATCH /api/admin/companies/[id] suporta plan/planExpiresAt/suspend; dropdowns no /admin agora chamam de verdade — alterar plano com prompt e suspender com confirm que revoga sessões via updateMany tokensInvalidatedAt), B5.3 hook `useSavedFilters` persiste filtros em localStorage por chave de página; aplicado em equipamentos (search, categoryFilter, statusFilter) e clientes (search, creditFilter); auto-limpa storage quando volta pro default, B7.6 cookie banner discreto via `<CookieBanner />` no root layout (localStorage `locatech-cookies-accepted`), B5.6 dark variants em Badge variants (success/warning/info/purple) + actionColors da auditoria + PAYMENT_COLORS do extrato |
| 2026-05-29 (lote 8) | B5.7 branding (RentalContractPDF agora aceita `companyLogoUrl` + `companyPrimaryColor`; rota `/api/rentals/[id]/contract` resolve URL absoluta da logo; helper `shell()` em email.ts aceita `EmailBranding`), B7.4 LGPD esquecimento (`/api/customers/[id]/anonymize` requer OWNER + body `{confirm: "ANONIMIZAR"}`; substitui nome/CPF/phone/email/endereço por placeholders sem tocar locações/auditoria; entry explícita em AuditLog com `lgpd: true, reason: "right_to_be_forgotten"`; botão "Anonimizar (LGPD)" na página /clientes/[id]/extrato), B4.18 webhooks de saída (model `Webhook` + CRUD `/api/webhooks` + GET/PATCH/DELETE `[id]`; helper `dispatchWebhooks({event, data})` envia POST HMAC SHA256 fire-and-forget com timeout 5s; integrado em rentals POST e rentals/[id]/return; 12 eventos pré-definidos), B5.8 estrutura i18n (`src/lib/i18n.ts` com `t(key, vars)` + map de locales + fallback pra pt-BR; `src/i18n/pt-BR.ts` com chaves comuns; README explica como adicionar idioma) |
| 2026-05-29 (lote 9) | B4.15 catálogo público (Company.slug/publicCatalog/catalogHeadline/whatsappContact + `/api/public/catalog/[slug]` sem auth + página `/catalogo/[slug]` server-rendered com filtros e botão WhatsApp), B4.17 API pública (model `ApiKey` SHA-256 + helper `authenticateApiKey` com rate limit por key + endpoints `/api/v1/{equipment,customers,rentals}` paginados + CRUD `/api/api-keys` gated em PRO + página `/api-docs`), B8.1 testes — permissions (9), rate-limit (10), api-key (6); 101 testes totais |
| 2026-05-29 (lote 10) | B4.11 QR check-in/check-out (campos `handoverToken`/`returnToken` em Rental com TTL 24h; rotas privadas `/api/rentals/[id]/handover` (POST gera token) + `/handover/qr` (GET PNG/SVG) + `/return-token`; rotas públicas `/api/public/handover/[token]` e `/api/public/return/[token]` com rate limit por IP; páginas `/entrega/[token]` e `/devolucao/[token]` mobile-first), B4.9 assinatura digital (componente `<SignaturePad>` em canvas puro com pointer events e DPR; integrado no /entrega; PNG salvo em `customerSignatureUrl`; contract PDF embute via Image quando presente — render condicional), B8.4 factories (`__tests__/fixtures/factories.ts` com buildCompany/User/Category/Equipment/Customer/Rental/RentalItem; counter por chamada pra IDs únicos; 9 testes próprios + README; jest.config.js exclui o arquivo de factories da coleta de testes) |
| 2026-05-29 (lote 11) | B4.12 push web (`PushSubscription` + lib `web-push` + endpoints public-key/subscribe/test + service worker `/sw-push.js` + hook `usePushNotifications` + card em /seguranca; precisa VAPID_*), B2.6 CSRF (`src/lib/csrf.ts` valida Origin/Referer; middleware reestruturado pra aplicar em /api/* exceto exempt list), B3.4 pool conexões (sem mudança de código; doc em OPERACAO.md com receitas Neon/Supabase/pgbouncer/Accelerate), B3.9 métricas Prometheus (`/api/metrics` bearer auth + 11 métricas em text exposition v0.0.4) |
| 2026-05-29 (lote 12) | **NF-e Onda 1** — B9.1 schema (Invoice + CompanyTaxConfig + 4 enums), B9.2 interface InvoiceProvider + MockProvider + esqueleto Focus, B9.4 página /configuracoes/fiscal, B9.5 emissão `POST /api/rentals/[id]/invoice`, B9.6 página /notas com cancel/download, B9.7 webhook `/api/invoices/webhook`, B9.8 `POST /api/invoices/[id]/cancel`, B9.15 gate de plano. 8 de 11 itens da Onda 1; pendentes precisam de conta Focus (B9.3) ou são quick follow-ups (B9.9, B9.13) |
| 2026-05-29 (lote 13) | **NF-e Onda 1 fechada** — B9.9 emissão automática (helper `issueInvoiceForRental` idempotente + `maybeAutoIssue` triggers no return/payment + cron `/api/cron/auto-issue-invoices` daily 10:00 catch-up), B9.13 email com PDF (`getInvoiceIssuedEmail` enviado quando nota autorizada), botão "Emitir Nota Fiscal" no dropdown da /locacoes. **10 de 11 itens da Onda 1 prontos — só B9.3 (Focus real) depende de conta** |
| 2026-05-29 (lote 15) | B9.11 NF-e 55 de venda (`POST /api/equipment/[id]/sell-invoice` CFOP 5102/6102, opcional markAsRetired), B2.2 2FA/TOTP completo (campos `totp*` em User + otplib v13.4 com API funcional + endpoints setup/disable/status + integrado no NextAuth authorize com "TOTP_REQUIRED" sentinel + login page com campo extra + `<TwoFactorCard>` em /seguranca com QR + backup codes) |
| 2026-05-29 (lote 16) | B4.19 multi-loja MVP (model `Store` + Equipment.storeId/Rental.storeId opcionais + CRUD + /lojas), B8.2 Playwright (config + 10 smoke tests em `/e2e/`) |
| 2026-05-29 (lote 17 — qualidade) | Cleanup: removida duplicação `/api/maintenance` (frontend só usava `/maintenances`); aplicado soft delete em /maintenances. Helper `src/lib/api-errors.ts` com `handleApiError` e `authErrorResponse` pra centralizar tratamento. Testes: 21 novos em `__tests__/totp.test.ts` (backup-codes em arquivo separado pra evitar ESM issue do otplib) e `__tests__/webhooks.test.ts` (HMAC contract) — total 131 testes. Hardening: 5 índices compostos adicionados. |
| 2026-05-30 (lote 18 — Bloco 1 desbloqueado) | DB PostgreSQL 18 local funcionando: database `locatech` + user `locatech_app` com CREATEDB; `.env` + `.env.local` com secrets gerados + `EMAIL_FROM` apontando pra vitorrobertonunes@hotmail.com; migration `initial_schema` aplicada (~25 tabelas + índices); seed populou 11 categorias; smoke test confirmou landing/health/register OK; primeira empresa criada (Locadora Teste) com OWNER `vitorrobertonunes@hotmail.com` senha `locatech2026`. |
| 2026-05-30 (lote 19 — observabilidade + deploy) | B2.1 verificação de email (campos `emailVerifyToken*` em User + endpoints `/api/auth/verify-email{,/resend}` + página `/verificar-email` com Suspense + template), B3.7 Pino logger com redact, B3.8 Sentry SDK 3 configs + instrumentation.ts, B3.5 backup script pg_dump + endpoint cron, B6.4 stack containerizada (Dockerfile multi-stage standalone + docker-compose postgres+app+nginx + nginx.conf + deploy.sh sequential + DEPLOY.md runbook). Next config virou `output: "standalone"` pra image enxuta. |
