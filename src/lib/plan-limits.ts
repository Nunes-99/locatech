import { CompanyPlan } from "@prisma/client"

export const PLAN_LIMITS = {
  FREE: {
    maxEquipment: 20,
    maxUsers: 1,
    maxCustomers: 50,
    features: {
      whatsapp: false,
      email: false,
      advancedReports: false,
      exportPdf: true,
      exportExcel: false,
      customBranding: false,
      api: false,
    },
  },
  STARTER: {
    maxEquipment: 100,
    maxUsers: 3,
    maxCustomers: 500,
    features: {
      whatsapp: true,
      email: true,
      advancedReports: true,
      exportPdf: true,
      exportExcel: true,
      customBranding: false,
      api: false,
    },
  },
  PRO: {
    maxEquipment: Infinity,
    maxUsers: 10,
    maxCustomers: Infinity,
    features: {
      whatsapp: true,
      email: true,
      advancedReports: true,
      exportPdf: true,
      exportExcel: true,
      customBranding: true,
      api: true,
    },
  },
} as const

export const PLAN_PRICES = {
  FREE: 0,
  STARTER: 79.90,
  PRO: 149.90,
}

export const PLAN_NAMES = {
  FREE: "Gratuito",
  STARTER: "Starter",
  PRO: "Profissional",
}

export function getPlanLimits(plan: CompanyPlan) {
  return PLAN_LIMITS[plan]
}

export function canAddEquipment(plan: CompanyPlan, currentCount: number): boolean {
  const limits = getPlanLimits(plan)
  return currentCount < limits.maxEquipment
}

export function canAddUser(plan: CompanyPlan, currentCount: number): boolean {
  const limits = getPlanLimits(plan)
  return currentCount < limits.maxUsers
}

export function canAddCustomer(plan: CompanyPlan, currentCount: number): boolean {
  const limits = getPlanLimits(plan)
  return currentCount < limits.maxCustomers
}

export function hasFeature(
  plan: CompanyPlan,
  feature: keyof typeof PLAN_LIMITS.FREE.features
): boolean {
  const limits = getPlanLimits(plan)
  return limits.features[feature]
}

export function getUpgradeMessage(
  plan: CompanyPlan,
  resource: "equipment" | "users" | "customers"
): string {
  const limits = getPlanLimits(plan)
  const resourceNames = {
    equipment: "equipamentos",
    users: "usuários",
    customers: "clientes",
  }

  if (plan === "FREE") {
    return `Você atingiu o limite de ${resourceNames[resource]} do plano Gratuito. Faça upgrade para o plano Starter para expandir seu negócio.`
  }

  if (plan === "STARTER") {
    return `Você atingiu o limite de ${resourceNames[resource]} do plano Starter. Faça upgrade para o plano Profissional para limites ilimitados.`
  }

  return "Limite atingido"
}

export function getUsagePercentage(current: number, max: number): number {
  if (max === Infinity) return 0
  return Math.min((current / max) * 100, 100)
}
