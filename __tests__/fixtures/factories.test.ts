import {
  buildCompany,
  buildUser,
  buildCategory,
  buildEquipment,
  buildCustomer,
  buildRental,
  buildRentalItem,
  resetFactoryCounter,
} from "./factories"

describe("factories", () => {
  beforeEach(() => resetFactoryCounter())

  it("buildCompany produz objeto com defaults sensatos", () => {
    const c = buildCompany()
    expect(c.name).toBe("Locadora Teste")
    expect(c.plan).toBe("FREE")
    expect(c.publicCatalog).toBe(false)
    expect(c.primaryColor).toBe("#2563EB")
    expect(c.id).toMatch(/^test-/)
  })

  it("aceita overrides", () => {
    const c = buildCompany({ name: "Custom", plan: "PRO" })
    expect(c.name).toBe("Custom")
    expect(c.plan).toBe("PRO")
  })

  it("buildUser default é OPERATOR com termos aceitos", () => {
    const u = buildUser()
    expect(u.role).toBe("OPERATOR")
    expect(u.termsAcceptedAt).toBeInstanceOf(Date)
    expect(u.termsVersion).toBe("2026-05-29")
  })

  it("buildEquipment default é AVAILABLE", () => {
    expect(buildEquipment().status).toBe("AVAILABLE")
  })

  it("buildCustomer default é CPF não-bloqueado com score REGULAR", () => {
    const c = buildCustomer()
    expect(c.documentType).toBe("CPF")
    expect(c.isBlocked).toBe(false)
    expect(c.creditScore).toBe("REGULAR")
  })

  it("buildRental default é CONFIRMED com pagamento pendente", () => {
    const r = buildRental()
    expect(r.status).toBe("CONFIRMED")
    expect(r.paymentStatus).toBe("PENDING")
    expect(r.deletedAt).toBeNull()
    expect(r.handoverToken).toBeNull()
  })

  it("buildRentalItem default tem 1 quantidade e 7 dias", () => {
    const item = buildRentalItem()
    expect(item.quantity).toBe(1)
    expect(item.days).toBe(7)
  })

  it("IDs são únicos a cada chamada", () => {
    const a = buildCompany().id
    const b = buildCompany().id
    const c = buildUser().id
    expect(new Set([a, b, c]).size).toBe(3)
  })

  it("buildCategory ligada a uma company via companyId", () => {
    const cat = buildCategory({ companyId: "specific-co" })
    expect(cat.companyId).toBe("specific-co")
  })
})
