export type Role = "OWNER" | "ADMIN" | "OPERATOR"

export type Permission =
  // Equipamentos
  | "equipment.view"
  | "equipment.create"
  | "equipment.update"
  | "equipment.delete"
  | "equipment.import"
  // Categorias
  | "category.manage"
  // Clientes
  | "customer.view"
  | "customer.create"
  | "customer.update"
  | "customer.delete"
  | "customer.block"
  // Locações
  | "rental.view"
  | "rental.create"
  | "rental.update"
  | "rental.return"
  | "rental.cancel"
  | "rental.delete"
  // Manutenção
  | "maintenance.view"
  | "maintenance.manage"
  // Financeiro
  | "financial.view"
  | "financial.export"
  // Relatórios
  | "report.view"
  | "report.export"
  // Usuários
  | "user.view"
  | "user.create"
  | "user.update"
  | "user.delete"
  // Empresa
  | "company.view"
  | "company.update"
  // Auditoria
  | "audit.view"
  // Admin global (super admin)
  | "admin.access"

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    "equipment.view", "equipment.create", "equipment.update", "equipment.delete", "equipment.import",
    "category.manage",
    "customer.view", "customer.create", "customer.update", "customer.delete", "customer.block",
    "rental.view", "rental.create", "rental.update", "rental.return", "rental.cancel", "rental.delete",
    "maintenance.view", "maintenance.manage",
    "financial.view", "financial.export",
    "report.view", "report.export",
    "user.view", "user.create", "user.update", "user.delete",
    "company.view", "company.update",
    "audit.view",
  ],
  ADMIN: [
    "equipment.view", "equipment.create", "equipment.update", "equipment.delete", "equipment.import",
    "category.manage",
    "customer.view", "customer.create", "customer.update", "customer.delete", "customer.block",
    "rental.view", "rental.create", "rental.update", "rental.return", "rental.cancel",
    "maintenance.view", "maintenance.manage",
    "financial.view", "financial.export",
    "report.view", "report.export",
    "user.view", "user.create", "user.update",
    "company.view", "company.update",
    "audit.view",
  ],
  OPERATOR: [
    "equipment.view", "equipment.create", "equipment.update",
    "customer.view", "customer.create", "customer.update",
    "rental.view", "rental.create", "rental.update", "rental.return",
    "maintenance.view",
    "report.view",
    "company.view",
  ],
}

export function canPerform(role: Role | string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as Role]
  if (!perms) return false
  return perms.includes(permission)
}

export function permissionsFor(role: Role | string): Permission[] {
  return ROLE_PERMISSIONS[role as Role] ?? []
}

export function requirePermission(role: Role | string, permission: Permission): void {
  if (!canPerform(role, permission)) {
    const err = new Error(`Sua função (${role}) não permite esta ação`)
    ;(err as Error & { status?: number }).status = 403
    throw err
  }
}
