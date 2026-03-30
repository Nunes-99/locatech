import {
  PLAN_LIMITS,
  PLAN_PRICES,
  PLAN_NAMES,
  getPlanLimits,
  canAddEquipment,
  canAddUser,
  canAddCustomer,
  hasFeature,
  getUpgradeMessage,
  getUsagePercentage,
} from "@/lib/plan-limits"

describe("Plan Limits", () => {
  describe("PLAN_LIMITS", () => {
    it("should have correct limits for FREE plan", () => {
      expect(PLAN_LIMITS.FREE.maxEquipment).toBe(20)
      expect(PLAN_LIMITS.FREE.maxUsers).toBe(1)
      expect(PLAN_LIMITS.FREE.maxCustomers).toBe(50)
    })

    it("should have correct limits for STARTER plan", () => {
      expect(PLAN_LIMITS.STARTER.maxEquipment).toBe(100)
      expect(PLAN_LIMITS.STARTER.maxUsers).toBe(3)
      expect(PLAN_LIMITS.STARTER.maxCustomers).toBe(500)
    })

    it("should have correct limits for PRO plan", () => {
      expect(PLAN_LIMITS.PRO.maxEquipment).toBe(Infinity)
      expect(PLAN_LIMITS.PRO.maxUsers).toBe(10)
      expect(PLAN_LIMITS.PRO.maxCustomers).toBe(Infinity)
    })
  })

  describe("PLAN_PRICES", () => {
    it("should have correct prices", () => {
      expect(PLAN_PRICES.FREE).toBe(0)
      expect(PLAN_PRICES.STARTER).toBe(79.90)
      expect(PLAN_PRICES.PRO).toBe(149.90)
    })
  })

  describe("PLAN_NAMES", () => {
    it("should have correct names", () => {
      expect(PLAN_NAMES.FREE).toBe("Gratuito")
      expect(PLAN_NAMES.STARTER).toBe("Starter")
      expect(PLAN_NAMES.PRO).toBe("Profissional")
    })
  })

  describe("getPlanLimits", () => {
    it("should return correct limits for each plan", () => {
      expect(getPlanLimits("FREE")).toEqual(PLAN_LIMITS.FREE)
      expect(getPlanLimits("STARTER")).toEqual(PLAN_LIMITS.STARTER)
      expect(getPlanLimits("PRO")).toEqual(PLAN_LIMITS.PRO)
    })
  })

  describe("canAddEquipment", () => {
    it("should return true when under limit", () => {
      expect(canAddEquipment("FREE", 10)).toBe(true)
      expect(canAddEquipment("STARTER", 50)).toBe(true)
      expect(canAddEquipment("PRO", 1000)).toBe(true)
    })

    it("should return false when at or over limit", () => {
      expect(canAddEquipment("FREE", 20)).toBe(false)
      expect(canAddEquipment("FREE", 25)).toBe(false)
      expect(canAddEquipment("STARTER", 100)).toBe(false)
    })
  })

  describe("canAddUser", () => {
    it("should return true when under limit", () => {
      expect(canAddUser("FREE", 0)).toBe(true)
      expect(canAddUser("STARTER", 2)).toBe(true)
      expect(canAddUser("PRO", 9)).toBe(true)
    })

    it("should return false when at or over limit", () => {
      expect(canAddUser("FREE", 1)).toBe(false)
      expect(canAddUser("STARTER", 3)).toBe(false)
      expect(canAddUser("PRO", 10)).toBe(false)
    })
  })

  describe("canAddCustomer", () => {
    it("should return true when under limit", () => {
      expect(canAddCustomer("FREE", 25)).toBe(true)
      expect(canAddCustomer("STARTER", 250)).toBe(true)
      expect(canAddCustomer("PRO", 10000)).toBe(true)
    })

    it("should return false when at or over limit", () => {
      expect(canAddCustomer("FREE", 50)).toBe(false)
      expect(canAddCustomer("STARTER", 500)).toBe(false)
    })
  })

  describe("hasFeature", () => {
    it("should return correct feature availability for FREE plan", () => {
      expect(hasFeature("FREE", "whatsapp")).toBe(false)
      expect(hasFeature("FREE", "email")).toBe(false)
      expect(hasFeature("FREE", "exportPdf")).toBe(true)
      expect(hasFeature("FREE", "exportExcel")).toBe(false)
    })

    it("should return correct feature availability for STARTER plan", () => {
      expect(hasFeature("STARTER", "whatsapp")).toBe(true)
      expect(hasFeature("STARTER", "email")).toBe(true)
      expect(hasFeature("STARTER", "exportExcel")).toBe(true)
      expect(hasFeature("STARTER", "api")).toBe(false)
    })

    it("should return correct feature availability for PRO plan", () => {
      expect(hasFeature("PRO", "whatsapp")).toBe(true)
      expect(hasFeature("PRO", "customBranding")).toBe(true)
      expect(hasFeature("PRO", "api")).toBe(true)
    })
  })

  describe("getUpgradeMessage", () => {
    it("should return correct message for FREE plan", () => {
      const message = getUpgradeMessage("FREE", "equipment")
      expect(message).toContain("Gratuito")
      expect(message).toContain("Starter")
    })

    it("should return correct message for STARTER plan", () => {
      const message = getUpgradeMessage("STARTER", "users")
      expect(message).toContain("Starter")
      expect(message).toContain("Profissional")
    })

    it("should return generic message for PRO plan", () => {
      const message = getUpgradeMessage("PRO", "customers")
      expect(message).toBe("Limite atingido")
    })
  })

  describe("getUsagePercentage", () => {
    it("should calculate percentage correctly", () => {
      expect(getUsagePercentage(10, 20)).toBe(50)
      expect(getUsagePercentage(20, 20)).toBe(100)
      expect(getUsagePercentage(25, 20)).toBe(100) // Capped at 100
    })

    it("should return 0 for infinite max", () => {
      expect(getUsagePercentage(1000, Infinity)).toBe(0)
    })
  })
})
