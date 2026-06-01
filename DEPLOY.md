# LocaTech - Guia de Deploy

## Pre-requisitos

- Node.js 18+
- PostgreSQL 15+
- Conta na Vercel (ou outro provedor)
- Conta no Mercado Pago (para pagamentos recorrentes — cartão, Pix, boleto)
- Conta no Resend (para emails)

---

## 1. Configuracao do Banco de Dados

### Opcao A: Usar Vercel Postgres
1. Criar projeto na Vercel
2. Adicionar Vercel Postgres no dashboard
3. Copiar a `DATABASE_URL` gerada

### Opcao B: Usar outro provedor (Supabase, Railway, etc)
1. Criar instancia PostgreSQL
2. Obter a connection string no formato:
   ```
   postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
   ```

---

## 2. Variaveis de Ambiente

Criar as seguintes variaveis no painel do provedor de hospedagem:

### Obrigatorias

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="gerar-com-openssl-rand-base64-32"
NEXTAUTH_URL="https://seu-dominio.com"
```

### Opcionais (funcionalidades extras)

```env
# Mercado Pago (Pagamentos/Planos)
MP_ACCESS_TOKEN="APP_USR-..."
MP_WEBHOOK_SECRET="..."

# Resend (Emails)
RESEND_API_KEY="re_..."

# Cron Jobs (seguranca)
CRON_SECRET="gerar-string-aleatoria-32-chars"

# Admin (emails com acesso ao painel admin)
ADMIN_EMAILS="admin@empresa.com,outro@empresa.com"

# Push Notifications (opcional)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
```

---

## 3. Configuracao do Mercado Pago

### 3.1 Pegar credenciais

1. Acessar https://www.mercadopago.com.br/developers/panel
2. Criar uma aplicação (ou usar uma existente)
3. Em **Credentials → Production**, copiar o **Access Token** (`APP_USR-...`)
   - Pra testes, use o de **Test mode** (`TEST-...`)
4. Colar em `MP_ACCESS_TOKEN`

> Diferente do Stripe, MP não exige criar Product/Price antecipadamente.
> O preço da assinatura vai no próprio request do `preapproval` — vem de
> `src/lib/plan-limits.ts:PLAN_PRICES`.

### 3.2 Configurar Webhook

1. No painel MP, ir em **Your integrations → [sua app] → Webhooks**
2. Em **Configuration**, adicionar URL: `https://seu-dominio.com/api/mp/webhook`
3. Selecionar eventos:
   - **Assinaturas (preapproval)**
   - **Pagamentos avulsos de assinatura (subscription authorized payment)**
4. Copiar o **Secret key** gerado e colar em `MP_WEBHOOK_SECRET`
   - Isso é o que valida o `x-signature` HMAC e impede webhooks forjados

---

## 4. Configuracao do Resend

1. Criar conta em https://resend.com
2. Verificar dominio de email
3. Gerar API Key
4. Copiar para `RESEND_API_KEY`

---

## 5. Deploy na Vercel

### 5.1 Via CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### 5.2 Via GitHub

1. Conectar repositorio ao Vercel
2. Configurar variaveis de ambiente no dashboard
3. Deploy automatico a cada push

---

## 6. Pos-Deploy

### 6.1 Executar migracoes do banco

```bash
npx prisma db push
```

Ou via Vercel:
```bash
vercel env pull .env.local
npx prisma db push
```

### 6.2 Criar usuario admin inicial

Acessar `/cadastro` e criar primeira conta. O primeiro usuario sera automaticamente OWNER da empresa.

### 6.3 Verificar Cron Jobs

Os cron jobs estao configurados em `vercel.json`:
- `/api/cron/late-fees` - Calculo de multas (diario)
- `/api/cron/overdue-reminders` - Lembretes de atraso (diario)
- `/api/cron/maintenance-alerts` - Alertas de manutencao (diario)

---

## 7. Checklist Final

- [ ] Banco de dados configurado e acessivel
- [ ] Variaveis de ambiente configuradas
- [ ] Build executando sem erros
- [ ] Webhook do Mercado Pago configurado (se usar pagamentos)
- [ ] Resend configurado (se usar emails)
- [ ] Primeiro usuario criado
- [ ] Cron jobs funcionando
- [ ] SSL/HTTPS ativo
- [ ] Dominio configurado

---

## 8. Comandos Uteis

```bash
# Desenvolvimento local
npm run dev

# Build de producao
npm run build

# Executar testes
npm test

# Verificar tipos
npx tsc --noEmit

# Abrir Prisma Studio (visualizar banco)
npm run db:studio

# Gerar icones PWA
node scripts/generate-icons.js
```

---

## 9. Troubleshooting

### Erro de conexao com banco
- Verificar se DATABASE_URL esta correta
- Verificar se IP esta liberado no firewall do banco

### Emails nao enviando
- Verificar se RESEND_API_KEY esta configurada
- Verificar se dominio esta verificado no Resend

### Pagamentos nao funcionando
- Verificar se STRIPE_SECRET_KEY esta em modo live
- Verificar se webhook esta configurado corretamente
- Verificar notificações no painel do Mercado Pago (Activity / Webhooks)

### Cron jobs nao executando
- Verificar se CRON_SECRET esta configurado
- Verificar logs na Vercel

---

## 10. Suporte

Para problemas ou duvidas:
1. Verificar logs na Vercel
2. Verificar console do navegador
3. Verificar Prisma Studio para dados do banco

---

*Documento criado em: 02/01/2026*
*Versao do projeto: 0.1.0*
