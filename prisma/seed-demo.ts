/**
 * Seed demo completo — cria empresa "LocaTech Demo" com admin, categorias,
 * equipamentos, clientes e locações pra demonstração/portfolio.
 *
 * Rode com: npx tsx prisma/seed-demo.ts
 *
 * Idempotente: se a empresa "demo@locatech.local" já existir, apenas reporta
 * o que foi criado anteriormente.
 */

import { PrismaClient, EquipmentStatus, RentalStatus, RentalType, PaymentStatus, PaymentMethod, CustomerCreditScore, DocumentType, UserRole, CompanyPlan } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const DEMO_EMAIL = "demo@locatech.local"
const DEMO_PASSWORD = "DemoFreela@2026"
const DEMO_COMPANY_NAME = "LocaTech Demo"
const DEMO_COMPANY_DOCUMENT = "12345678000190"

const CATEGORIES = [
  { name: "Andaimes", icon: "🏗️", description: "Andaimes fachadeiros, tubulares, multidirecionais" },
  { name: "Betoneiras", icon: "🧱", description: "Misturadores de cimento, betoneiras de 120L a 600L" },
  { name: "Compactadores", icon: "⚙️", description: "Placas vibratórias, compactadores de solo, sapinhos" },
  { name: "Cortadoras", icon: "🪚", description: "Cortadoras de piso, serras de bancada, policortes" },
  { name: "Furadeiras / Martelos", icon: "🔨", description: "Marteletes, rompedores, perfuratrizes" },
  { name: "Geradores", icon: "⚡", description: "Geradores a diesel/gasolina, soldas, transformadores" },
  { name: "Vibradores", icon: "📳", description: "Vibradores de concreto, agulhas, motores" },
  { name: "Pintura", icon: "🎨", description: "Compressores, pistolas de pintura, lixadeiras" },
  { name: "Limpeza", icon: "🧹", description: "Lavadoras de alta pressão, aspiradores industriais" },
  { name: "Acessórios", icon: "🛠️", description: "Carrinhos, baldes, padiolas, ferramentas manuais" },
] as const

// 20 equipamentos espalhados pelas categorias
const EQUIPMENTS = [
  { catIdx: 0, code: "AND-001", name: "Andaime Fachadeiro 1,5m", brand: "Mills", model: "F-150", dailyRate: 8, weekly: 45, monthly: 160, deposit: 200 },
  { catIdx: 0, code: "AND-002", name: "Andaime Tubular Completo", brand: "Mills", model: "T-200", dailyRate: 12, weekly: 70, monthly: 240, deposit: 300 },
  { catIdx: 1, code: "BET-001", name: "Betoneira 400L Tri", brand: "CSM", model: "B-400", dailyRate: 90, weekly: 500, monthly: 1700, deposit: 800 },
  { catIdx: 1, code: "BET-002", name: "Betoneira 150L Mono", brand: "Menegotti", model: "M-150", dailyRate: 60, weekly: 340, monthly: 1200, deposit: 600 },
  { catIdx: 2, code: "COM-001", name: "Placa Vibratória 100kg", brand: "Wacker", model: "DPU-2540", dailyRate: 120, weekly: 700, monthly: 2400, deposit: 1500 },
  { catIdx: 2, code: "COM-002", name: "Compactador Sapinho", brand: "Bomag", model: "BT-65", dailyRate: 140, weekly: 800, monthly: 2700, deposit: 1800 },
  { catIdx: 3, code: "COR-001", name: "Cortadora de Piso 14\"", brand: "Husqvarna", model: "FS-413", dailyRate: 80, weekly: 460, monthly: 1600, deposit: 700 },
  { catIdx: 3, code: "COR-002", name: "Serra Mármore 5\"", brand: "Makita", model: "4101-RH", dailyRate: 35, weekly: 200, monthly: 700, deposit: 250 },
  { catIdx: 4, code: "FUR-001", name: "Martelete SDS-Max 11kg", brand: "Bosch", model: "GBH-11DE", dailyRate: 70, weekly: 400, monthly: 1400, deposit: 600 },
  { catIdx: 4, code: "FUR-002", name: "Rompedor Pneumático", brand: "Atlas Copco", model: "RH-571", dailyRate: 95, weekly: 540, monthly: 1900, deposit: 900 },
  { catIdx: 4, code: "FUR-003", name: "Furadeira de Impacto 1/2\"", brand: "DeWalt", model: "DW-511", dailyRate: 25, weekly: 140, monthly: 480, deposit: 200 },
  { catIdx: 5, code: "GER-001", name: "Gerador Diesel 6kVA", brand: "Toyama", model: "TDG-7000", dailyRate: 180, weekly: 1050, monthly: 3600, deposit: 2000 },
  { catIdx: 5, code: "GER-002", name: "Gerador Gasolina 3kVA", brand: "Branco", model: "B4T-4000", dailyRate: 120, weekly: 700, monthly: 2400, deposit: 1200 },
  { catIdx: 5, code: "GER-003", name: "Solda Inversora 250A", brand: "ESAB", model: "Origo-273", dailyRate: 70, weekly: 400, monthly: 1400, deposit: 800 },
  { catIdx: 6, code: "VIB-001", name: "Vibrador de Concreto 38mm", brand: "Wacker", model: "M-2000", dailyRate: 65, weekly: 370, monthly: 1300, deposit: 500 },
  { catIdx: 6, code: "VIB-002", name: "Vibrador de Concreto 49mm", brand: "Wacker", model: "M-3000", dailyRate: 85, weekly: 490, monthly: 1700, deposit: 700 },
  { catIdx: 7, code: "PIN-001", name: "Compressor 10pés 100L", brand: "Schulz", model: "MSV-10/100", dailyRate: 95, weekly: 540, monthly: 1900, deposit: 900 },
  { catIdx: 7, code: "PIN-002", name: "Lixadeira Orbital", brand: "Bosch", model: "GEX-125", dailyRate: 22, weekly: 130, monthly: 440, deposit: 180 },
  { catIdx: 8, code: "LIM-001", name: "Lavadora Alta Pressão 2200psi", brand: "Karcher", model: "HD-585", dailyRate: 110, weekly: 630, monthly: 2200, deposit: 1000 },
  { catIdx: 9, code: "ACE-001", name: "Carrinho de Mão Reforçado", brand: "Tramontina", model: "60L", dailyRate: 8, weekly: 45, monthly: 160, deposit: 100 },
]

// 20 clientes plausíveis brasileiros
const CUSTOMERS = [
  { name: "Construtora Horizonte Ltda", doc: "11222333000144", type: "CNPJ" as const, phone: "11987001001", credit: "EXCELLENT" as const, city: "São Paulo", state: "SP" },
  { name: "Empreiteira Solar SP", doc: "22333444000155", type: "CNPJ" as const, phone: "11987001002", credit: "GOOD" as const, city: "São Paulo", state: "SP" },
  { name: "Edificações JC", doc: "33444555000166", type: "CNPJ" as const, phone: "11987001003", credit: "EXCELLENT" as const, city: "Guarulhos", state: "SP" },
  { name: "Reformas Premium", doc: "44555666000177", type: "CNPJ" as const, phone: "11987001004", credit: "GOOD" as const, city: "Osasco", state: "SP" },
  { name: "Engebras Construções", doc: "55666777000188", type: "CNPJ" as const, phone: "11987001005", credit: "REGULAR" as const, city: "Campinas", state: "SP" },
  { name: "MR Engenharia", doc: "66777888000199", type: "CNPJ" as const, phone: "11987001006", credit: "EXCELLENT" as const, city: "São Paulo", state: "SP" },
  { name: "Carlos Roberto Silva", doc: "12345678901", type: "CPF" as const, phone: "11987002001", credit: "GOOD" as const, city: "São Paulo", state: "SP" },
  { name: "Mariana Souza Almeida", doc: "23456789012", type: "CPF" as const, phone: "11987002002", credit: "EXCELLENT" as const, city: "São Bernardo do Campo", state: "SP" },
  { name: "Pedro Henrique Costa", doc: "34567890123", type: "CPF" as const, phone: "11987002003", credit: "GOOD" as const, city: "Santo André", state: "SP" },
  { name: "Ana Beatriz Mendes", doc: "45678901234", type: "CPF" as const, phone: "11987002004", credit: "REGULAR" as const, city: "São Paulo", state: "SP" },
  { name: "Rafael Oliveira", doc: "56789012345", type: "CPF" as const, phone: "11987002005", credit: "GOOD" as const, city: "Diadema", state: "SP" },
  { name: "Juliana Santos", doc: "67890123456", type: "CPF" as const, phone: "11987002006", credit: "EXCELLENT" as const, city: "São Paulo", state: "SP" },
  { name: "Lucas Ferreira", doc: "78901234567", type: "CPF" as const, phone: "11987002007", credit: "REGULAR" as const, city: "Mauá", state: "SP" },
  { name: "Camila Ribeiro", doc: "89012345678", type: "CPF" as const, phone: "11987002008", credit: "GOOD" as const, city: "São Paulo", state: "SP" },
  { name: "Bruno Martins", doc: "90123456789", type: "CPF" as const, phone: "11987002009", credit: "REGULAR" as const, city: "Suzano", state: "SP" },
  { name: "Fernanda Lima", doc: "01234567890", type: "CPF" as const, phone: "11987002010", credit: "GOOD" as const, city: "São Paulo", state: "SP" },
  { name: "Obras & Cia ME", doc: "77888999000111", type: "CNPJ" as const, phone: "11987001007", credit: "REGULAR" as const, city: "São Paulo", state: "SP" },
  { name: "Reformas Express", doc: "88999000000122", type: "CNPJ" as const, phone: "11987001008", credit: "GOOD" as const, city: "Mogi das Cruzes", state: "SP" },
  { name: "Thiago Pereira Andrade", doc: "11223344556", type: "CPF" as const, phone: "11987002011", credit: "EXCELLENT" as const, city: "São Paulo", state: "SP" },
  { name: "Patrícia Gomes", doc: "22334455667", type: "CPF" as const, phone: "11987002012", credit: "GOOD" as const, city: "Guarulhos", state: "SP" },
]

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

async function main() {
  console.log("Seed demo iniciando...")

  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (existing) {
    console.log(`⚠ Usuário ${DEMO_EMAIL} já existe (companyId=${existing.companyId}). Nada a fazer.`)
    return
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)

  const company = await prisma.company.create({
    data: {
      name: DEMO_COMPANY_NAME,
      document: DEMO_COMPANY_DOCUMENT,
      email: "contato@locatech-demo.com.br",
      phone: "11987650000",
      slug: "locatech-demo",
      publicCatalog: true,
      catalogHeadline: "Aluguel de equipamentos pra obra — entrega rápida em toda Grande SP",
      whatsappContact: "5511987650000",
      address: "Av. Paulista, 1000",
      city: "São Paulo",
      state: "SP",
      zipCode: "01310-100",
      plan: CompanyPlan.PRO,
      primaryColor: "#2563EB",
    },
  })
  console.log(`✓ Empresa: ${company.name} (${company.id})`)

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: DEMO_EMAIL,
      passwordHash,
      name: "Vitor Demo",
      phone: "11987650001",
      role: UserRole.OWNER,
      emailVerified: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "v1",
    },
  })
  console.log(`✓ Usuário OWNER: ${user.email}`)

  const categories = await Promise.all(
    CATEGORIES.map((c) =>
      prisma.equipmentCategory.create({
        data: {
          companyId: company.id,
          name: c.name,
          icon: c.icon,
          description: c.description,
        },
      })
    )
  )
  console.log(`✓ ${categories.length} categorias`)

  const equipments = await Promise.all(
    EQUIPMENTS.map((e) =>
      prisma.equipment.create({
        data: {
          companyId: company.id,
          categoryId: categories[e.catIdx].id,
          code: e.code,
          name: e.name,
          brand: e.brand,
          model: e.model,
          dailyRate: e.dailyRate,
          weeklyRate: e.weekly,
          monthlyRate: e.monthly,
          depositAmount: e.deposit,
          status: EquipmentStatus.AVAILABLE,
        },
      })
    )
  )
  console.log(`✓ ${equipments.length} equipamentos`)

  const customers = await Promise.all(
    CUSTOMERS.map((c) =>
      prisma.customer.create({
        data: {
          companyId: company.id,
          name: c.name,
          document: c.doc,
          documentType: c.type === "CNPJ" ? DocumentType.CNPJ : DocumentType.CPF,
          phone: c.phone,
          email: c.name.split(" ")[0].toLowerCase() + "@exemplo.com",
          city: c.city,
          state: c.state,
          creditScore: c.credit as CustomerCreditScore,
        },
      })
    )
  )
  console.log(`✓ ${customers.length} clientes`)

  // Locações distribuídas: ~5 orçamentos, 8 em andamento, 3 atrasadas, 14 concluídas, 2 canceladas
  const rng = seededRandom(42)
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  type RentalPlan = {
    status: RentalStatus
    paymentStatus: PaymentStatus
    daysOffsetStart: number // negativo = passado
    duration: number // dias
    actualEndDelta: number | null // dias de diff com expectedEnd (0=na data, +=atraso, -=adiantado)
  }

  const plans: RentalPlan[] = [
    // Orçamentos pendentes (futuro)
    ...Array.from({ length: 5 }, () => ({ status: RentalStatus.QUOTE, paymentStatus: PaymentStatus.PENDING, daysOffsetStart: Math.floor(rng() * 10) + 2, duration: Math.floor(rng() * 14) + 3, actualEndDelta: null })),
    // Confirmadas (futuro próximo)
    ...Array.from({ length: 4 }, () => ({ status: RentalStatus.CONFIRMED, paymentStatus: PaymentStatus.PARTIAL, daysOffsetStart: Math.floor(rng() * 5) + 1, duration: Math.floor(rng() * 10) + 3, actualEndDelta: null })),
    // Em andamento
    ...Array.from({ length: 8 }, () => ({ status: RentalStatus.IN_PROGRESS, paymentStatus: PaymentStatus.PAID, daysOffsetStart: -Math.floor(rng() * 10) - 1, duration: Math.floor(rng() * 14) + 5, actualEndDelta: null })),
    // Atrasadas (expectedEnd no passado, ainda não devolveu)
    ...Array.from({ length: 3 }, () => ({ status: RentalStatus.OVERDUE, paymentStatus: PaymentStatus.OVERDUE, daysOffsetStart: -Math.floor(rng() * 20) - 14, duration: Math.floor(rng() * 7) + 5, actualEndDelta: null })),
    // Concluídas (passadas, pagas)
    ...Array.from({ length: 14 }, () => ({ status: RentalStatus.COMPLETED, paymentStatus: PaymentStatus.PAID, daysOffsetStart: -Math.floor(rng() * 60) - 7, duration: Math.floor(rng() * 14) + 2, actualEndDelta: Math.floor(rng() * 3) - 1 })),
    // Canceladas
    ...Array.from({ length: 2 }, () => ({ status: RentalStatus.CANCELLED, paymentStatus: PaymentStatus.REFUNDED, daysOffsetStart: -Math.floor(rng() * 30), duration: 5, actualEndDelta: null })),
  ]

  let contractNumber = 1001
  let createdRentals = 0
  let totalRevenue = 0

  for (const plan of plans) {
    const startDate = new Date(startOfToday)
    startDate.setDate(startDate.getDate() + plan.daysOffsetStart)
    const expectedEndDate = new Date(startDate)
    expectedEndDate.setDate(expectedEndDate.getDate() + plan.duration)

    // 1 a 3 itens por locação
    const numItems = Math.floor(rng() * 3) + 1
    const chosenEquipments = new Set<string>()
    const items: Array<{ equipment: typeof equipments[0]; days: number; quantity: number; subtotal: number }> = []

    for (let i = 0; i < numItems; i++) {
      let attempts = 0
      let eq = pickRandom(equipments, rng)
      while (chosenEquipments.has(eq.id) && attempts < 5) {
        eq = pickRandom(equipments, rng)
        attempts++
      }
      if (chosenEquipments.has(eq.id)) continue
      chosenEquipments.add(eq.id)

      const quantity = 1
      const days = plan.duration
      const dailyRate = Number(eq.dailyRate)
      const subtotal = dailyRate * quantity * days
      items.push({ equipment: eq, days, quantity, subtotal })
    }

    if (items.length === 0) continue

    const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0)
    const deliveryFee = Math.floor(rng() * 80) + 40
    const discount = plan.status === RentalStatus.COMPLETED && rng() < 0.3 ? Math.floor(subtotal * 0.05) : 0
    const lateDays = plan.status === RentalStatus.OVERDUE ? Math.abs(plan.daysOffsetStart) - plan.duration : 0
    const lateFee = lateDays > 0 ? Math.floor(subtotal * 0.02 * lateDays) : 0
    const total = subtotal + deliveryFee - discount + lateFee
    const depositAmount = items.reduce((acc, it) => acc + Number(it.equipment.depositAmount || 0), 0)
    const customer = pickRandom(customers, rng)

    let actualEndDate: Date | null = null
    if (plan.status === RentalStatus.COMPLETED && plan.actualEndDelta !== null) {
      actualEndDate = new Date(expectedEndDate)
      actualEndDate.setDate(actualEndDate.getDate() + plan.actualEndDelta)
    }

    const paidAt = plan.paymentStatus === PaymentStatus.PAID
      ? (actualEndDate || new Date(startDate.getTime() + 24 * 60 * 60 * 1000))
      : null

    const quoteExpiresAt = plan.status === RentalStatus.QUOTE
      ? new Date(startDate.getTime() - 1 * 24 * 60 * 60 * 1000)
      : null

    const paymentMethod = plan.paymentStatus === PaymentStatus.PAID
      ? pickRandom([PaymentMethod.PIX, PaymentMethod.CREDIT_CARD, PaymentMethod.BANK_SLIP, PaymentMethod.TRANSFER], rng)
      : null

    const rental = await prisma.rental.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        contractNumber: contractNumber++,
        startDate,
        expectedEndDate,
        actualEndDate,
        status: plan.status,
        type: rng() > 0.5 ? RentalType.DELIVERY : RentalType.PICKUP,
        deliveryAddress: customer.city ? `${customer.city}, ${customer.state}` : null,
        subtotal,
        deliveryFee,
        discount,
        total,
        depositAmount,
        depositPaid: plan.paymentStatus !== PaymentStatus.PENDING,
        depositReturned: plan.status === RentalStatus.COMPLETED,
        lateDays,
        lateFee,
        paymentStatus: plan.paymentStatus,
        paymentMethod,
        paidAt,
        quoteExpiresAt,
        items: {
          create: items.map((it) => ({
            equipmentId: it.equipment.id,
            equipmentCode: it.equipment.code,
            equipmentName: it.equipment.name,
            dailyRate: it.equipment.dailyRate,
            quantity: it.quantity,
            days: it.days,
            subtotal: it.subtotal,
          })),
        },
      },
    })

    if (plan.status === RentalStatus.COMPLETED) {
      totalRevenue += total
    }

    // Marca equipamentos como RENTED quando há locação ativa
    if (plan.status === RentalStatus.IN_PROGRESS || plan.status === RentalStatus.OVERDUE) {
      for (const it of items) {
        await prisma.equipment.update({
          where: { id: it.equipment.id },
          data: { status: EquipmentStatus.RENTED },
        }).catch(() => {/* já marcado por outra locação */})
      }
    }

    createdRentals++
  }
  console.log(`✓ ${createdRentals} locações (contratos #1001 a #${contractNumber - 1})`)

  // Atualiza métrica da empresa
  await prisma.company.update({
    where: { id: company.id },
    data: {
      totalRentals: createdRentals,
      totalRevenue,
    },
  })

  console.log("\n========================================")
  console.log("✓ Seed demo concluído!")
  console.log(`  Login URL:  http://localhost:3000`)
  console.log(`  Email:      ${DEMO_EMAIL}`)
  console.log(`  Senha:      ${DEMO_PASSWORD}`)
  console.log(`  Empresa:    ${company.name} (slug: ${company.slug})`)
  console.log(`  Catálogo:   http://localhost:3000/catalogo/${company.slug}`)
  console.log("========================================\n")
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("✗ Seed falhou:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
