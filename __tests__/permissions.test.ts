import { canPerform, permissionsFor, requirePermission, Permission } from "@/lib/permissions"

describe("canPerform", () => {
  it("OWNER tem todas as permissões críticas", () => {
    const critical: Permission[] = [
      "equipment.delete",
      "customer.delete",
      "rental.delete",
      "user.delete",
      "audit.view",
      "company.update",
    ]
    for (const p of critical) {
      expect(canPerform("OWNER", p)).toBe(true)
    }
  })

  it("ADMIN pode tudo de OWNER exceto deletar usuários", () => {
    expect(canPerform("ADMIN", "user.create")).toBe(true)
    expect(canPerform("ADMIN", "user.update")).toBe(true)
    expect(canPerform("ADMIN", "user.delete")).toBe(false)
  })

  it("OPERATOR não pode deletar nem gerenciar usuários", () => {
    expect(canPerform("OPERATOR", "equipment.delete")).toBe(false)
    expect(canPerform("OPERATOR", "customer.delete")).toBe(false)
    expect(canPerform("OPERATOR", "rental.delete")).toBe(false)
    expect(canPerform("OPERATOR", "user.create")).toBe(false)
    expect(canPerform("OPERATOR", "audit.view")).toBe(false)
  })

  it("OPERATOR pode operações do dia-a-dia", () => {
    expect(canPerform("OPERATOR", "equipment.view")).toBe(true)
    expect(canPerform("OPERATOR", "equipment.create")).toBe(true)
    expect(canPerform("OPERATOR", "customer.create")).toBe(true)
    expect(canPerform("OPERATOR", "rental.create")).toBe(true)
    expect(canPerform("OPERATOR", "rental.return")).toBe(true)
  })

  it("retorna false pra role desconhecida", () => {
    expect(canPerform("HACKER", "equipment.view")).toBe(false)
  })

  it("permissionsFor retorna lista completa do role", () => {
    expect(permissionsFor("OWNER").length).toBeGreaterThan(20)
    expect(permissionsFor("ADMIN").length).toBeGreaterThan(15)
    expect(permissionsFor("OPERATOR").length).toBeGreaterThan(5)
    expect(permissionsFor("UNKNOWN")).toEqual([])
  })

  it("requirePermission joga erro com status 403 quando negado", () => {
    expect(() => requirePermission("OPERATOR", "equipment.delete")).toThrow(/função/i)
    try {
      requirePermission("OPERATOR", "equipment.delete")
    } catch (err) {
      expect((err as Error & { status?: number }).status).toBe(403)
    }
  })

  it("requirePermission não joga erro quando permitido", () => {
    expect(() => requirePermission("OWNER", "equipment.delete")).not.toThrow()
  })

  it("apenas OWNER pode deletar usuários", () => {
    expect(canPerform("OWNER", "user.delete")).toBe(true)
    expect(canPerform("ADMIN", "user.delete")).toBe(false)
    expect(canPerform("OPERATOR", "user.delete")).toBe(false)
  })

  it("apenas OWNER/ADMIN podem ver auditoria", () => {
    expect(canPerform("OWNER", "audit.view")).toBe(true)
    expect(canPerform("ADMIN", "audit.view")).toBe(true)
    expect(canPerform("OPERATOR", "audit.view")).toBe(false)
  })
})
