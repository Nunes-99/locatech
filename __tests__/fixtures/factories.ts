/**
 * Factories pra montar entidades de teste consistentes. Não conecta no banco —
 * só produz objetos válidos do tipo do Prisma client pra usar em testes unitários
 * ou em mocks.
 *
 * Princípios:
 *   - Cada factory tem defaults aceitáveis (sucesso por padrão)
 *   - Aceita overrides parciais via spread
 *   - IDs são determinísticos por chamada (counter por tipo) — facilita asserts
 *
 * Pra testes de integração que mexem no banco, use estas factories como base
 * e passe ao `prisma.X.create({ data })`.
 */

import type {
  Company,
  User,
  Customer,
  Equipment,
  EquipmentCategory,
  Rental,
  RentalItem,
} from "@prisma/client"

let counter = 0
const nextId = () => `test-${++counter}-${Date.now().toString(36)}`

/** Reseta o contador entre testes pra IDs ficarem previsíveis. */
export function resetFactoryCounter() {
  counter = 0
}

const baseTimestamps = () => ({
  createdAt: new Date("2026-01-15T10:00:00.000Z"),
  updatedAt: new Date("2026-01-15T10:00:00.000Z"),
})

export function buildCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: nextId(),
    name: "Locadora Teste",
    document: null,
    phone: null,
    email: null,
    slug: null,
    publicCatalog: false,
    catalogHeadline: null,
    whatsappContact: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
    workingHours: null,
    defaultRentalDays: 1,
    lateFeePercent: "2" as unknown as Company["lateFeePercent"],
    quoteValidDays: 7,
    dpoEmail: null,
    dpoName: null,
    logoUrl: null,
    primaryColor: "#2563EB",
    plan: "FREE",
    planExpiresAt: null,
    totalRentals: 0,
    totalRevenue: "0" as unknown as Company["totalRevenue"],
    ...baseTimestamps(),
    ...overrides,
  }
}

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: nextId(),
    companyId: "company-test-1",
    email: `user-${counter}@test.com`,
    passwordHash: "$2a$12$FAKEHASHFAKEHASHFAKEHASHFAKEHASHFAKEHASHFAKEHASHFAKEHA",
    name: "Usuário Teste",
    phone: null,
    role: "OPERATOR",
    emailVerified: null,
    resetToken: null,
    resetTokenExpiry: null,
    emailVerifyToken: null,
    emailVerifyTokenExpiry: null,
    termsAcceptedAt: new Date("2026-01-15T10:00:00.000Z"),
    termsVersion: "2026-05-29",
    tokensInvalidatedAt: null,
    totpSecret: null,
    totpEnabledAt: null,
    totpBackupCodes: [],
    ...baseTimestamps(),
    ...overrides,
  }
}

export function buildCategory(overrides: Partial<EquipmentCategory> = {}): EquipmentCategory {
  return {
    id: nextId(),
    companyId: "company-test-1",
    name: "Categoria Teste",
    description: null,
    icon: null,
    ...baseTimestamps(),
    ...overrides,
  }
}

export function buildEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: nextId(),
    companyId: "company-test-1",
    categoryId: "category-test-1",
    code: `EQ-${counter}`,
    name: "Equipamento Teste",
    brand: null,
    model: null,
    serialNumber: null,
    description: null,
    imageUrl: null,
    storeId: null,
    dailyRate: "100" as unknown as Equipment["dailyRate"],
    weeklyRate: null,
    monthlyRate: null,
    depositAmount: null,
    status: "AVAILABLE",
    purchaseDate: null,
    purchaseValue: null,
    totalRentals: 0,
    totalRevenue: "0" as unknown as Equipment["totalRevenue"],
    totalDaysRented: 0,
    ...baseTimestamps(),
    ...overrides,
  }
}

export function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: nextId(),
    companyId: "company-test-1",
    name: "Cliente Teste",
    document: `${counter.toString().padStart(11, "0")}`,
    documentType: "CPF",
    phone: "11999999999",
    email: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
    creditScore: "REGULAR",
    creditLimit: null,
    notes: null,
    totalRentals: 0,
    totalSpent: "0" as unknown as Customer["totalSpent"],
    totalPending: "0" as unknown as Customer["totalPending"],
    isBlocked: false,
    blockReason: null,
    ...baseTimestamps(),
    ...overrides,
  }
}

export function buildRental(overrides: Partial<Rental> = {}): Rental {
  return {
    id: nextId(),
    companyId: "company-test-1",
    customerId: "customer-test-1",
    storeId: null,
    contractNumber: counter,
    startDate: new Date("2026-02-01T08:00:00.000Z"),
    expectedEndDate: new Date("2026-02-08T18:00:00.000Z"),
    actualEndDate: null,
    status: "CONFIRMED",
    type: "PICKUP",
    deliveryAddress: null,
    subtotal: "700" as unknown as Rental["subtotal"],
    deliveryFee: "0" as unknown as Rental["deliveryFee"],
    discount: "0" as unknown as Rental["discount"],
    total: "700" as unknown as Rental["total"],
    depositAmount: "200" as unknown as Rental["depositAmount"],
    depositPaid: false,
    depositReturned: false,
    lateDays: 0,
    lateFee: "0" as unknown as Rental["lateFee"],
    paymentStatus: "PENDING",
    paymentMethod: null,
    paidAt: null,
    contractUrl: null,
    notes: null,
    internalNotes: null,
    quoteExpiresAt: null,
    handoverToken: null,
    handoverTokenExpiresAt: null,
    handoverConfirmedAt: null,
    returnToken: null,
    returnTokenExpiresAt: null,
    returnConfirmedAt: null,
    customerSignatureUrl: null,
    customerSignedAt: null,
    customerSignedIp: null,
    deletedAt: null,
    ...baseTimestamps(),
    ...overrides,
  }
}

export function buildRentalItem(overrides: Partial<RentalItem> = {}): RentalItem {
  return {
    id: nextId(),
    rentalId: "rental-test-1",
    equipmentId: "equipment-test-1",
    equipmentCode: "EQ-1",
    equipmentName: "Equipamento Teste",
    dailyRate: "100" as unknown as RentalItem["dailyRate"],
    quantity: 1,
    days: 7,
    subtotal: "700" as unknown as RentalItem["subtotal"],
    returnCondition: null,
    damageNotes: null,
    damageValue: "0" as unknown as RentalItem["damageValue"],
    ...overrides,
  }
}
