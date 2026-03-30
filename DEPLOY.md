# LocaTech - Guia de Deploy

## Pre-requisitos

- Node.js 18+
- PostgreSQL 15+
- Conta na Vercel (ou outro provedor)
- Conta no Stripe (para pagamentos)
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
# Stripe (Pagamentos/Planos)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_STARTER_PRICE_ID="price_..."
STRIPE_PRO_PRICE_ID="price_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

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

## 3. Configuracao do Stripe

### 3.1 Criar produtos no Stripe Dashboard

1. Acessar https://dashboard.stripe.com/products
2. Criar produto "Starter" com preco mensal R$ 79,90
3. Criar produto "Pro" com preco mensal R$ 149,90
4. Copiar os Price IDs para as variaveis de ambiente

### 3.2 Configurar Webhook

1. Acessar https://dashboard.stripe.com/webhooks
2. Adicionar endpoint: `https://seu-dominio.com/api/stripe/webhook`
3. Selecionar eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copiar o Webhook Secret para `STRIPE_WEBHOOK_SECRET`

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
- [ ] Stripe webhook configurado (se usar pagamentos)
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
- Verificar logs no Stripe Dashboard

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
