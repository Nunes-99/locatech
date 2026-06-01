# LocaTech — Próximos passos

> **NF-e em standby** (2026-06-01): o user está construindo um projeto dedicado
> de NF-e e quando terminar vai usar como base aqui. Por isso B9.3, B9.16 e
> B9.17 foram removidos desta lista. O módulo fiscal do LocaTech continua
> funcionando com **MockProvider** até a integração vir.

Cada item lista exatamente o que **você** precisa fazer, o que **me mandar de volta**,
e o que **eu implemento** depois. Tempos são pra você (não pra mim).

---

## ⚡ Ordem recomendada (7 itens ativos)

```
1. B6.3 Vercel              — quando for testar deploy
2. B3.1 Cloudflare R2       — antes de ir pra Vercel/serverless real
3. B2.3 Upstash             — junto com B3.1 se for serverless
4. B4.16 boletos/Pix        — quando primeira locadora real assinar
5. B4.13 WhatsApp           — junto com primeira locadora
6. B4.14 SMS                — provavelmente nunca (WhatsApp cobre)
7. B4.10 fotos no checklist — cascata de B3.1, não exige ação direta
```

---

## 1. B6.3 — Vercel (deploy preview por PR)

**Por que importa:** cada push numa branch vira uma URL pública pra testar antes
de merge. Hoje você só consegue testar local.

**Custo:** grátis no plano Hobby (limites altíssimos pra projeto solo).

**Tempo seu:** ~5 minutos.

### Passos

1. Abrir https://vercel.com e clicar em "Sign Up" — usar **Continue with GitHub**
2. Autorizar Vercel a acessar seu GitHub
3. No dashboard, clicar em **"Add New... → Project"**
4. Escolher o repo `Nunes-99/locatech` e clicar em **Import**
5. Na tela de config:
   - Framework Preset: Next.js (auto-detectado)
   - Root Directory: `./`
   - Build Command: deixar default (`next build`)
6. Em **Environment Variables**, colar tudo que está no seu `.env.local`,
   **mudando `NEXTAUTH_URL` pra `https://locatech-NOMEDOPROJETO.vercel.app`**
   (você vê a URL após o primeiro deploy)
7. Clicar **Deploy**
8. Aguardar ~3 min do primeiro deploy

### O que me mandar

```
URL_DE_PRODUCAO = https://...vercel.app  (pra eu atualizar NEXTAUTH_URL e webhook URLs)
```

### O que eu faço depois (~30min)

- Configurar `vercel.json` com env vars de runtime e Cron definitivo
- Documentar quais env vars são `Production` vs `Preview` no dashboard
- Configurar Stripe webhook pra apontar pra URL de produção

**⚠️ ATENÇÃO:** upload de imagens (`/api/upload`) **vai quebrar em Vercel**
porque escreve em filesystem. Antes de promover Vercel pra produção real, faça
B3.1 primeiro (próximo item).

---

## 2. B3.1 — Cloudflare R2 (storage de imagens)

**Por que importa:** Vercel/Lambda têm filesystem **efêmero** — todo upload se
perde no próximo deploy. Solução: subir imagens pra blob storage externo.
Cloudflare R2 é S3-compatible, gratuito até 10 GB, **sem cobrar egress**.

**Custo:** **grátis até 10 GB de storage** (= ~50.000 fotos de equipamento) +
1 milhão de operações/mês.

**Tempo seu:** ~10 minutos.

### Passos

1. Abrir https://dash.cloudflare.com — criar conta (Free plan)
2. Menu lateral → **R2 Object Storage** → "Get Started"
3. Aceitar termos (não exige cartão)
4. Clicar **Create bucket**:
   - Nome: `locatech-uploads`
   - Location: **EEUR (Europe)** ou **WNAM (North America)** — escolha mais perto
   - Storage class: Standard
5. Bucket criado → aba **Settings** → **Public access** → habilitar Public R2.dev URL
6. Voltar ao menu R2 → **Manage R2 API Tokens** (canto superior direito)
7. **Create API Token**:
   - Token name: `locatech-app`
   - Permissions: **Object Read & Write**
   - Specify bucket: `locatech-uploads`
   - TTL: Forever
8. Copiar Access Key ID, Secret Access Key, Endpoint, Public URL

### O que me mandar

```
R2_ACCESS_KEY_ID       = <copiar>
R2_SECRET_ACCESS_KEY   = <copiar>
R2_ENDPOINT            = https://<accountid>.r2.cloudflarestorage.com
R2_BUCKET              = locatech-uploads
R2_PUBLIC_URL          = https://pub-xxx.r2.dev
```

### O que eu faço depois (~2h)

- Refatorar `/api/upload/route.ts` pra usar `@aws-sdk/client-s3` apontando pro R2
- Migrar imagens existentes em `public/uploads/` pro R2
- Atualizar refs no banco (Equipment.imageUrl, Company.logoUrl, signatures)
- Manter filesystem como fallback em dev
- Habilita B4.10 (checklist com fotos)

---

## 3. B2.3 — Upstash Redis (rate limit serverless)

**Por que importa:** o rate limit atual é in-memory — em Vercel cada cold start
zera. Upstash dá Redis serverless pra persistir.

**Custo:** grátis até 10.000 requests/dia + 256 MB.

**Tempo seu:** ~5 minutos.

### Passos

1. Abrir https://upstash.com → **Sign Up with Google/GitHub**
2. Dashboard → **Create Database**
   - Name: `locatech-ratelimit`
   - Type: **Regional**
   - Region: **sa-east-1** (São Paulo) ou **us-east-1**
   - TLS: Enabled
3. Clicar **Create**
4. Aba **REST API** — copiar URL e TOKEN

### O que me mandar

```
UPSTASH_REDIS_REST_URL    = https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN  = <token longo>
```

### O que eu faço depois (~1h)

- Trocar `src/lib/rate-limit.ts` por `@upstash/ratelimit` quando env vars
  estiverem setadas (fallback in-memory em dev)
- Nenhum chamador muda — interface fica idêntica

---

## 4. B4.16 — Boleto/Pix (gateway de pagamento brasileiro)

**Por que importa:** Stripe não emite boleto nem Pix nativamente no BR. Locadora
de construção tem maioria de cliente PJ que paga via boleto.

**Custo:** Asaas R$ 1,99/boleto, R$ 0,49/Pix; sem mensalidade.

**Tempo seu:** ~30 min (incluindo verificação de CNPJ).

### Passos (Asaas)

1. https://asaas.com → **Criar conta grátis**
2. Preencher cadastro com CPF ou CNPJ
3. Confirmar email + telefone
4. Validar identidade (selfie + documento) — até 24h
5. Após aprovado, menu **Integrações → API**
6. Gerar **API Key de Sandbox**

### O que me mandar

```
ASAAS_API_KEY_SANDBOX  = $aact_YTU5YTE0M2M2N...
ASAAS_API_KEY_PROD     = (depois)
```

### O que eu faço depois (~6h)

- `src/lib/payments/asaas.ts` com client REST
- `/api/rentals/[id]/payment-link` gera boleto/Pix
- Webhook `/api/payments/asaas/webhook` recebe confirmação
- Botão "Gerar boleto" no dropdown da `/locacoes`
- `Rental.paymentStatus = PAID` automático
- Email pro cliente com link

---

## 5. B4.13 — WhatsApp Business

**Opção A — Meta WhatsApp Business API (oficial, pago):** ~R$ 0,12/conversa.

1. Conta Facebook Business + Meta for Developers
2. https://developers.facebook.com/apps/ → Create App → Business
3. Produto **WhatsApp** → configurar Phone Number ID
4. Gerar **Permanent Access Token** (System User)
5. Webhook `https://SEU_DOMINIO/api/integrations/whatsapp/webhook`

Me mandar:
```
WHATSAPP_ACCESS_TOKEN  = EAA...
WHATSAPP_PHONE_ID      = 123456789
WHATSAPP_VERIFY_TOKEN  = (string aleatória)
```

**Opção B — Baileys (não-oficial, grátis):** instável, mas funciona. Pareia via
QR. Só confirma "vamos com Baileys" e eu implemento.

### O que eu faço depois (~6-8h)

- Cliente WhatsApp + templates (confirmação, lembrete 24h, atraso)
- Webhook recebe mensagem → registra interação
- Botão "Enviar via WhatsApp" no dropdown da locação
- Cron de lembretes

---

## 6. B4.14 — SMS (Twilio)

**Honestamente:** provavelmente skip. WhatsApp cobre quase 100% do público BR.

Se decidir:
1. https://twilio.com → trial US$ 15 grátis
2. Comprar número brasileiro (~US$ 1/mês)
3. Copiar Account SID + Auth Token

```
TWILIO_ACCOUNT_SID  = AC...
TWILIO_AUTH_TOKEN   = ...
TWILIO_PHONE_NUMBER = +5511...
```

---

## 7. B4.10 — Checklist com fotos

**Depende de B3.1.** Você não faz nada — quando R2 estiver setado eu sigo direto:
upload de fotos em `/entrega/[token]` e `/devolucao/[token]`, vincula ao
`RentalItem`, PDF do contrato embeda miniaturas.

**Tempo eu:** ~5h depois de B3.1.

---

## Em standby (até o seu projeto de NF-e ficar pronto)

- **B9.3** Focus NF-e provider — virá do seu projeto separado
- **B9.16** PlugNotas/eNotas — idem
- **B9.17** Testes E2E fiscais — depende de provider real

LocaTech continua com **MockProvider** (emite notas fake) até a integração.
Quando terminar o outro projeto, me avise e integramos.

---

## Resumo executivo

| Prioridade | Item | Seu tempo | Custo |
|---|---|---|---|
| 1 | Vercel | 5 min | Grátis |
| 2 | Cloudflare R2 | 10 min | Grátis até 10 GB |
| 3 | Upstash Redis | 5 min | Grátis até 10k req/dia |
| 4 | Asaas (boletos) | 30 min | R$ 1,99/boleto |
| 5 | WhatsApp Meta | ~1h | R$ 0,12/conversa |
| 6 | Twilio SMS | 20 min | Provavelmente skip |
| 7 | Checklist fotos | 0 (cascata) | — |

**Total: ~1-2h espalhadas em 1 semana.** Cria conta, manda o bloco `VAR=valor`,
eu implemento na hora.
