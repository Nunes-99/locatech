# 🏗️ LOCATECH - Sistema de Gestão para Locadoras de Equipamentos

## 📋 VISÃO GERAL

### O Problema
- Locadoras controlam equipamentos em **caderno ou Excel**
- Não sabem o que está alugado em tempo real
- Esquecem de cobrar devoluções atrasadas
- Contratos manuais, propensos a erros
- Perdem dinheiro com manutenções não planejadas

### A Solução
Sistema completo para locadoras com:
- 📦 Controle de estoque e disponibilidade
- 📋 Contratos de locação automáticos (PDF)
- 📅 Calendário visual de locações
- 💰 Cálculo automático de diárias e multas
- 🔧 Controle de manutenções
- 📊 Relatórios de faturamento

### Público-Alvo
```
🏗️ Locadoras de construção (andaimes, betoneiras, ferramentas)
🎉 Locadoras de eventos (mesas, cadeiras, tendas, som)
🚜 Locadoras agrícolas (tratores, implementos)
🎬 Locadoras audiovisual (câmeras, iluminação)
🏥 Locadoras de equipamentos médicos
🎿 Locadoras de esportes (bicicletas, pranchas)
```

---

## 🛠️ STACK TÉCNICA (100% GRATUITA)

### Frontend
```
Framework:        Next.js 14 (App Router)
Linguagem:        TypeScript
Estilização:      Tailwind CSS + shadcn/ui
Calendário:       react-big-calendar
Gráficos:         recharts
Tabelas:          @tanstack/react-table
PDF:              @react-pdf/renderer
```

### Backend
```
API:              Next.js API Routes
ORM:              Prisma
Banco:            PostgreSQL (Supabase free)
Auth:             NextAuth.js
Storage:          Cloudflare R2 (10GB grátis)
```

### Integrações
```
WhatsApp:         Baileys (open source, grátis)
Email:            Resend (3k/mês grátis)
Pagamentos:       Stripe / MercadoPago
```

### Hospedagem
```
Frontend:         Vercel (grátis)
Banco:            Supabase (500MB grátis)
Storage:          Cloudflare R2 (10GB grátis)
```

---

## 🗄️ SCHEMA DO BANCO DE DADOS (RESUMIDO)

```prisma
// Principais entidades

model Company {
  id                String   @id @default(uuid())
  name              String
  document          String   @unique  // CNPJ
  phone             String
  plan              CompanyPlan @default(FREE)
  
  users             User[]
  categories        EquipmentCategory[]
  equipment         Equipment[]
  customers         Customer[]
  rentals           Rental[]
}

model Equipment {
  id                String   @id @default(uuid())
  companyId         String
  categoryId        String
  
  code              String   // AND-001
  name              String
  brand             String?
  
  dailyRate         Decimal
  weeklyRate        Decimal?
  monthlyRate       Decimal?
  depositAmount     Decimal?
  
  status            EquipmentStatus @default(AVAILABLE)
  // AVAILABLE, RENTED, MAINTENANCE, RESERVED
  
  totalRentals      Int      @default(0)
  totalRevenue      Decimal  @default(0)
}

model Customer {
  id                String   @id @default(uuid())
  companyId         String
  
  name              String
  document          String   // CPF ou CNPJ
  phone             String
  email             String?
  address           String?
  
  creditScore       CustomerCreditScore @default(REGULAR)
  totalRentals      Int      @default(0)
  totalSpent        Decimal  @default(0)
}

model Rental {
  id                String   @id @default(uuid())
  companyId         String
  customerId        String
  contractNumber    Int
  
  startDate         DateTime
  expectedEndDate   DateTime
  actualEndDate     DateTime?
  
  status            RentalStatus @default(CONFIRMED)
  // QUOTE, CONFIRMED, IN_PROGRESS, OVERDUE, RETURNED, COMPLETED
  
  subtotal          Decimal
  deliveryFee       Decimal  @default(0)
  discount          Decimal  @default(0)
  total             Decimal
  
  depositAmount     Decimal  @default(0)
  depositPaid       Boolean  @default(false)
  
  lateDays          Int      @default(0)
  lateFee           Decimal  @default(0)
  
  contractUrl       String?  // PDF do contrato
  
  items             RentalItem[]
}

model RentalItem {
  id                String   @id @default(uuid())
  rentalId          String
  equipmentId       String
  
  equipmentCode     String
  equipmentName     String
  dailyRate         Decimal
  quantity          Int      @default(1)
  days              Int
  subtotal          Decimal
}

model Maintenance {
  id                String   @id @default(uuid())
  companyId         String
  equipmentId       String
  
  type              MaintenanceType  // PREVENTIVE, CORRECTIVE
  title             String
  description       String?
  
  laborCost         Decimal  @default(0)
  partsCost         Decimal  @default(0)
  totalCost         Decimal
  
  scheduledDate     DateTime?
  completedAt       DateTime?
  status            MaintenanceStatus @default(SCHEDULED)
}
```

---

## 🎨 TELAS PRINCIPAIS

### Dashboard
```
┌─────────────────────────────────────────────────┐
│  📊 Dashboard                                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ 📦 45   │ │ 📋 12   │ │ 💰 8.4k │          │
│  │ Equip.  │ │ Locações│ │ A Receber│          │
│  └─────────┘ └─────────┘ └─────────┘          │
│                                                 │
│  ⚠️ ALERTAS                                    │
│  • 3 locações atrasadas                        │
│  • 2 equipamentos para manutenção              │
│                                                 │
│  📋 LOCAÇÕES RECENTES                          │
│  #042 │ João Silva │ Betoneira │ 🟢 Ativa      │
│  #041 │ Const. ABC │ Andaimes  │ 🔴 Atrasada   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Catálogo de Equipamentos
```
┌─────────────────────────────────────────────────┐
│  📦 Equipamentos              [+ Novo]          │
├─────────────────────────────────────────────────┤
│  🔍 Buscar...    [Categoria ▼] [Status ▼]      │
│                                                 │
│  🏗️ ANDAIMES (5 itens)                         │
│  ┌───────────────────────────────────────────┐ │
│  │ AND-001 │ Andaime 1,5m   │ 🟢 Disponível  │ │
│  │ R$ 25/dia               │ [Alugar]       │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │ AND-002 │ Andaime 1,5m   │ 🔴 Locado     │ │
│  │ R$ 25/dia │ até 20/01   │ [Ver locação] │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  🔧 BETONEIRAS (3 itens)                       │
│  ┌───────────────────────────────────────────┐ │
│  │ BET-001 │ Betoneira 400L │ 🟡 Manutenção │ │
│  │ R$ 80/dia               │ prev: 18/01   │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Nova Locação (Wizard)
```
┌─────────────────────────────────────────────────┐
│  📋 Nova Locação                                │
├─────────────────────────────────────────────────┤
│                                                 │
│  PASSO 1: CLIENTE                              │
│  [Buscar cliente...        ] [+ Novo]          │
│  ✅ João Silva │ CPF: 123.456.789-00           │
│                                                 │
│  PASSO 2: EQUIPAMENTOS                         │
│  [Adicionar equipamento...]                    │
│  • BET-001 │ Betoneira 400L │ 5 dias │ R$ 400 │
│  • AND-001 │ Andaime 1,5m x4│ 5 dias │ R$ 500 │
│                                                 │
│  PASSO 3: PERÍODO                              │
│  Retirada: [15/01/2024]  Devolução: [20/01]   │
│  Tipo: ○ Retira  ● Entregamos (+R$ 50)        │
│                                                 │
│  PASSO 4: RESUMO                               │
│  Equipamentos:      R$ 900,00                  │
│  Entrega:            R$ 50,00                  │
│  Caução (10%):       R$ 90,00                  │
│  ─────────────────────────────                  │
│  TOTAL:           R$ 1.040,00                  │
│                                                 │
│  [✅ Confirmar Locação]                        │
└─────────────────────────────────────────────────┘
```

### Calendário
```
┌─────────────────────────────────────────────────┐
│  📅 Calendário               [< Jan 2024 >]    │
├─────────────────────────────────────────────────┤
│  DOM  SEG  TER  QUA  QUI  SEX  SAB            │
│  ───  ───  ───  ───  ───  ───  ───            │
│       1    2    3    4    5    6              │
│  7    8    9    10   11   12   13             │
│                 ████ ████ ████ ████ ← #41     │
│  14   15   16   17   18   19   20             │
│  ████ ████ ████ ████ ████           ← #42     │
│       ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓      ← #43     │
│  21   22   23   24   25   26   27             │
│  28   29   30   31                            │
│                                                 │
│  🟢 Disponível  🔴 Locado  🔵 Manutenção       │
└─────────────────────────────────────────────────┘
```

---

## 📄 CONTRATO PDF (EXEMPLO)

```
┌─────────────────────────────────────────────────┐
│           CONTRATO DE LOCAÇÃO Nº 2024-0042     │
│                                                 │
│  LOCADORA EXEMPLO LTDA                          │
│  CNPJ: 12.345.678/0001-90                      │
│                                                 │
│  ───────────────────────────────────────────── │
│  LOCATÁRIO                                      │
│  Nome: João Silva                               │
│  CPF: 123.456.789-00                           │
│  Telefone: (11) 99999-9999                     │
│  ───────────────────────────────────────────── │
│  PERÍODO: 15/01/2024 a 20/01/2024 (5 dias)    │
│  ───────────────────────────────────────────── │
│  EQUIPAMENTOS                                   │
│  ┌───────────────────────────────────────────┐ │
│  │ Código  │ Descrição      │ Diária │ Total │ │
│  │ BET-001 │ Betoneira 400L │ R$ 80  │ R$400 │ │
│  │ AND-001 │ Andaime 1,5m x4│ R$ 100 │ R$500 │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Subtotal:        R$ 900,00                    │
│  Entrega:          R$ 50,00                    │
│  Caução:           R$ 90,00                    │
│  TOTAL:         R$ 1.040,00                    │
│  ───────────────────────────────────────────── │
│  TERMOS:                                        │
│  1. Multa de 2% ao dia por atraso             │
│  2. Danos serão cobrados à parte              │
│  3. Caução devolvida após conferência         │
│  ───────────────────────────────────────────── │
│                                                 │
│  _____________        _____________            │
│  LOCADORA             LOCATÁRIO                │
└─────────────────────────────────────────────────┘
```

---

## 💰 MODELO DE NEGÓCIO

### Planos

| Plano | Preço | Equipamentos | Usuários | Recursos |
|-------|-------|--------------|----------|----------|
| **Free** | R$ 0 | 20 | 1 | Básico |
| **Starter** | R$ 79,90/mês | 100 | 3 | + WhatsApp, Relatórios |
| **Pro** | R$ 149,90/mês | Ilimitado | 10 | + API, Marca própria |

### Projeção de Receita

```
Mês 1:   10 clientes  = R$ 470/mês
Mês 6:   80 clientes  = R$ 3.900/mês
Mês 12: 250 clientes  = R$ 15.500/mês
Mês 24: 800 clientes  = R$ 50.500/mês
```

---

## 🚀 ROADMAP (14 SEMANAS)

| Fase | Semanas | Entregas |
|------|---------|----------|
| **MVP** | 1-3 | CRUD equipamentos, clientes, locações |
| **Core** | 4-6 | Calendário, devoluções, multas |
| **Manutenção** | 7-8 | Controle de manutenções, alertas |
| **Notificações** | 9-10 | WhatsApp, Email |
| **Financeiro** | 11-12 | Relatórios, pagamentos |
| **Monetização** | 13-14 | Planos, checkout, landing page |

---

## 📦 INSTALAÇÃO

```bash
# 1. Criar projeto
npx create-next-app@latest locatech --typescript --tailwind --app

cd locatech

# 2. Dependências
npm install @prisma/client next-auth @auth/prisma-adapter
npm install zustand zod react-hook-form @hookform/resolvers
npm install date-fns @tanstack/react-table recharts
npm install react-big-calendar @react-pdf/renderer
npm install lucide-react

# 3. shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card dialog input select table tabs badge calendar

# 4. Prisma
npx prisma init

# 5. Banco local (Docker)
docker run --name locatech-db \
  -e POSTGRES_PASSWORD=dev123 \
  -e POSTGRES_DB=locatech \
  -p 5432:5432 \
  -d postgres:15

# 6. .env.local
echo 'DATABASE_URL="postgresql://postgres:dev123@localhost:5432/locatech"' > .env.local
echo 'NEXTAUTH_SECRET="super-secret"' >> .env.local
echo 'NEXTAUTH_URL="http://localhost:3000"' >> .env.local

# 7. Criar tabelas
npx prisma db push

# 8. Rodar
npm run dev
```

---

## 🧪 TESTE GRATUITO

### Local (R$ 0)
- PostgreSQL via Docker
- Next.js em localhost
- Todas as funcionalidades

### Produção (R$ 0)
- **Vercel**: hospedagem grátis
- **Supabase**: banco grátis (500MB)
- **Cloudflare R2**: PDFs grátis (10GB)
- **Resend**: emails grátis (3k/mês)

### Limitações do Free Tier
```
✅ 20 equipamentos
✅ 50 clientes
✅ Locações ilimitadas
✅ Contratos PDF
❌ WhatsApp automático
❌ Relatórios avançados
❌ Múltiplos usuários
```

---

## 🎯 DIFERENCIAIS

1. **Preço acessível** para pequenas locadoras
2. **Foco no nicho** (não é ERP genérico)
3. **WhatsApp integrado** nativamente
4. **Contratos PDF** automáticos
5. **Calendário visual** intuitivo
6. **Mobile-first** (PWA)

---

## ✅ PRÓXIMOS PASSOS

1. Visitar 3 locadoras locais
2. Validar a dor e o preço
3. Desenvolver MVP (3 semanas)
4. Testar com 3 clientes piloto
5. Iterar baseado no feedback
6. Lançar oficialmente
