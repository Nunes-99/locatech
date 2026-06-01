# LocaTech — Manual de Operação

Procedimentos para quem opera o LocaTech em produção (proprietário/admin do SaaS, não os usuários das locadoras).

---

## Visão geral da arquitetura

- **App**: Next.js 14 (App Router) — uma única deployment serve todas as empresas (multi-tenant por `companyId`).
- **Banco**: PostgreSQL (Prisma como ORM). Schema único, isolamento lógico via `companyId` em cada tabela.
- **Autenticação**: NextAuth com JWT (sem tabela de sessões para reduzir DB hit por request).
- **Upload**: hoje em `public/uploads/` (filesystem). **Quebra em serverless** — antes de subir em Vercel, migrar pra blob storage (item B3.1 do roadmap).
- **Crons**: 3 endpoints em `/api/cron/*` chamados pela Vercel Cron (config em `vercel.json`).
- **Pagamento**: Stripe Checkout + webhook para evento `checkout.session.completed`.
- **Email**: Resend (API REST simples, fallback silencioso se `RESEND_API_KEY` ausente).

---

## Pool de conexões PostgreSQL

O singleton em `src/lib/prisma.ts` evita criar múltiplos clients no mesmo runtime,
mas em **serverless** (Vercel, Lambda) cada invocação pode ser um runtime novo,
multiplicando conexões. Postgres aguenta ~100 conexões diretas por default; com
50 deploys ativos × 5 conexões = 250, esgota fácil.

**Recomendações por hospedagem:**

- **Vercel Postgres / Neon / Supabase**: já vêm com pgbouncer transparente.
  Use a connection string `pooled` (porta 6543 no Neon, `?pgbouncer=true` no
  Supabase). Adicione na URL:
  ```
  ?connection_limit=5&pool_timeout=30
  ```
- **Postgres self-hosted**: instale pgbouncer separadamente (mode `transaction`),
  aponte `DATABASE_URL` pra ele, e configure no pgbouncer:
  ```
  pool_mode = transaction
  default_pool_size = 25
  max_client_conn = 500
  ```
- **Prisma Accelerate** (alternativa gerenciada): basta trocar `DATABASE_URL`
  por uma URL `prisma://` e o pooling + cache fica por conta deles.

**Sintomas de pool exausto:**
- `Error: Too many connections` ou `connection limit exceeded`
- Latência repentina nas rotas que tocam o DB
- Apps Vercel travando ao escalar

Diagnose rápida:
```sql
SELECT state, COUNT(*) FROM pg_stat_activity WHERE datname = 'locatech' GROUP BY state;
```

---

## Configuração de produção (`.env`)

Variáveis obrigatórias:

| Variável | Descrição | Sem ela |
|---|---|---|
| `DATABASE_URL` | PostgreSQL com `?schema=public&sslmode=require` em produção | App não sobe |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Login falha |
| `NEXTAUTH_URL` | URL canônica do app (ex: `https://locatech.com.br`) | Reset password manda link errado |
| `CRON_SECRET` | `openssl rand -hex 32` | Crons retornam 401 |
| `STRIPE_SECRET_KEY` | `sk_live_...` | `/upgrade` quebra |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (do endpoint configurado) | Webhook rejeita |
| `STRIPE_STARTER_PRICE_ID` | `price_...` do Starter mensal | Checkout falha |
| `STRIPE_PRO_PRICE_ID` | `price_...` do Pro mensal | Checkout falha |
| `RESEND_API_KEY` | `re_...` | Emails apenas logam warning |

---

## Onboarding de uma nova empresa cliente

**Cadastro normal (recomendado):** o cliente entra em `/cadastro`, preenche os dados e cria a conta como `OWNER`. O sistema cria a `Company` e o `User` em uma transação. Plano default: `FREE`.

**Cadastro manual (suporte/migração):** quando precisa criar via SQL:

```sql
-- 1. Criar empresa
INSERT INTO "Company" (id, name, plan, "primaryColor", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'Locadora Exemplo', 'STARTER', '#2563EB', now(), now())
RETURNING id;

-- 2. Criar usuário OWNER (hash bcrypt cost 12 da senha)
-- gerar hash: node -e "console.log(require('bcryptjs').hashSync('senha123', 12))"
INSERT INTO "User" (id, "companyId", email, "passwordHash", name, role,
                    "termsAcceptedAt", "termsVersion", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), '<id-empresa>', 'owner@empresa.com', '<hash>',
        'Nome do Owner', 'OWNER', now(), '2026-05-29', now(), now());
```

---

## Suspender uma empresa

Há dois jeitos, dependendo de quão restritivo precisa ser:

**Soft (preserva login, bloqueia operação):**
```sql
UPDATE "Company" SET "planExpiresAt" = '2020-01-01' WHERE id = '<id>';
```
Faz `company.usage` retornar plano expirado. A UI mostra aviso. *Não* impede login.

**Hard (revoga todas as sessões):**
```sql
UPDATE "User" SET "tokensInvalidatedAt" = now() WHERE "companyId" = '<id>';
```
Próximo request com JWT antigo é rejeitado. Reativar = reverter para `NULL`.

**Excluir definitivamente (use com extremo cuidado, irreversível):**
```sql
DELETE FROM "Company" WHERE id = '<id>';
```
Cascade apaga todos os usuários, equipamentos, clientes, locações, etc. **Faça backup antes.**

---

## Backup

### Manual (pg_dump)
```bash
pg_dump "$DATABASE_URL" -Fc -f locatech-$(date +%F).dump
```

### Restore
```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" locatech-2026-05-29.dump
```

### Automático (recomendado)
Configurar:
- **Neon/Supabase**: já tem backup automático diário no plano pago.
- **Self-hosted**: cron diário rodando `pg_dump` e enviando para S3/R2/Oracle Object Storage.

Ver `vercel.json` para crons já configurados (multas, manutenções, lembretes).

---

## Crons configurados

Os crons rodam via Vercel Cron (definidos em `vercel.json`). Em outras hospedagens, agende manualmente.

| Endpoint | Frequência | O que faz |
|---|---|---|
| `/api/cron/late-fees` | Diário 08:00 | Calcula multa por atraso e envia email ao cliente |
| `/api/cron/maintenance-alerts` | Diário 07:00 | Cria manutenção preventiva automática + alerta admins |
| `/api/cron/overdue-reminders` | Diário 09:00 | Lembrete de devolução + notificação in-app |

**Todos exigem header `Authorization: Bearer $CRON_SECRET`**. Em desenvolvimento, chame manualmente:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/late-fees
```

---

## Auditoria e investigação

Toda operação CRUD em entidades de negócio (Equipment, Customer, Rental, etc) é gravada em `AuditLog`. Tentativas de login (sucesso e falha) em `AccessLog`.

**UI**: `/auditoria` (visível para `OWNER` e `ADMIN`). Filtros por entidade, ação, usuário, período. Botão "Exportar CSV" baixa até 5000 linhas filtradas.

**Investigar incidente** (ex: cliente reclama que dado foi alterado):
```sql
SELECT "createdAt", "userName", action, entity, "entityId", changes
FROM "AuditLog"
WHERE "companyId" = '<id-empresa>'
  AND entity = 'Customer'
  AND "entityId" = '<id-cliente>'
ORDER BY "createdAt" DESC;
```

**Detectar brute force ativo:**
```sql
SELECT email, COUNT(*) as tentativas, MAX("createdAt") as ultima
FROM "AccessLog"
WHERE success = false
  AND "createdAt" > now() - interval '1 hour'
GROUP BY email
HAVING COUNT(*) >= 10
ORDER BY tentativas DESC;
```

Acima de 5 falhas em 15min para o mesmo email, o sistema cria automaticamente uma `Notification` do tipo `WARNING` para a empresa.

---

## Migrations

```bash
# Criar nova migration após mudar schema.prisma
npx prisma migrate dev --name nome_descritivo

# Aplicar em produção (sem prompt)
npx prisma migrate deploy

# Rollback (sem auto — Prisma não suporta down; é manual)
# Reverter editando schema.prisma e criando nova migration "revert_XXX"
```

**Antes de aplicar em produção:** sempre revisar o SQL gerado em `prisma/migrations/<timestamp>/migration.sql`. Cuidado com:
- `DROP COLUMN` (perde dados)
- `ALTER COLUMN ... NOT NULL` sem default em tabela com linhas (falha)
- Renomear coluna (Prisma faz como DROP + CREATE — perde dados)

---

## Stripe — fluxo de cobrança

1. Cliente clica em "Assinar" em `/upgrade`
2. `POST /api/stripe/checkout` cria `checkout.session` e devolve URL
3. Cliente paga no hosted checkout do Stripe
4. Stripe envia `checkout.session.completed` para `/api/stripe/webhook`
5. Webhook atualiza `Company.plan` e `Company.planExpiresAt`

**Quando uma assinatura falha (cartão recusado):**
- Webhook `invoice.payment_failed` é recebido
- Sistema *não* cancela imediatamente (cliente tem janela do Stripe pra atualizar cartão)
- Após N tentativas (configuração no Stripe), webhook `customer.subscription.deleted` → rebaixar para FREE

**Reembolso/cancelamento:** fazer no dashboard do Stripe → webhook propaga.

---

## Troubleshooting comum

### "Não autorizado" em todas as rotas após reset de banco
Sessão antiga JWT aponta pra usuário que não existe mais. **Solução**: logout + login.

### Email não envia
1. Verificar `RESEND_API_KEY` no `.env`.
2. Verificar domínio verificado no Resend (`onboarding@resend.dev` funciona em sandbox).
3. Ver logs do servidor — sistema avisa `"Resend API key not configured, skipping email send"` se falta a key.

### Upload retorna 500
1. Verificar se `public/uploads/` tem permissão de escrita (em Linux: `chown -R node:node public/uploads`).
2. **Em serverless (Vercel)**: filesystem é efêmero — implementar B3.1 (blob storage) antes de subir.

### Build da Vercel falha em `npx prisma generate`
Adicionar ao `package.json`:
```json
"scripts": {
  "postinstall": "prisma generate",
  "build": "prisma generate && next build"
}
```

### Cron retorna 401 em produção
1. Verificar `CRON_SECRET` configurada na Vercel.
2. Em `vercel.json`, o header `Authorization` é injetado automaticamente pela Vercel Cron — não precisa configurar à mão.

### Locação não conta na receita da empresa
A receita só é incrementada em `Company.totalRevenue` no momento da **devolução** (`POST /api/rentals/[id]/return`), não no momento da criação. Isso é proposital — locação em andamento ainda pode ser cancelada.

---

## Métricas que vale acompanhar

| Métrica | SQL | Frequência |
|---|---|---|
| Empresas ativas (logaram nos últimos 30 dias) | `SELECT COUNT(DISTINCT "companyId") FROM "AccessLog" WHERE success = true AND "createdAt" > now() - interval '30 days'` | Diária |
| MRR (Monthly Recurring Revenue) | `SELECT plan, COUNT(*) FROM "Company" WHERE plan != 'FREE' AND "planExpiresAt" > now() GROUP BY plan` | Diária |
| Conversão FREE → STARTER | comparar com baseline mensal | Mensal |
| Falhas de login | `SELECT COUNT(*) FROM "AccessLog" WHERE success=false AND "createdAt" > now() - interval '1 day'` | Diária |
| Erros 5xx | logs do hosting (Vercel Logs, Datadog, etc) | Tempo real |

---

## Contatos

- **Repositório**: `Nunes-99/locatech`
- **DNS**: a configurar quando deployar em produção
- **DPO/Privacidade**: `privacidade@locatech.com.br` (configurar real ao publicar)
- **Suporte**: `contato@locatech.com.br` (configurar real ao publicar)
