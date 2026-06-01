import { checkPasswordStrength, STRENGTH_LABELS } from "@/lib/validators"

describe("checkPasswordStrength", () => {
  it("rejects passwords shorter than 8 chars", () => {
    const r = checkPasswordStrength("abc12")
    expect(r.ok).toBe(false)
    expect(r.errors).toContain("Mínimo 8 caracteres")
  })

  it("requires at least one letter", () => {
    const r = checkPasswordStrength("12345678")
    expect(r.ok).toBe(false)
    expect(r.errors).toContain("Inclua ao menos uma letra")
  })

  it("requires at least one digit", () => {
    const r = checkPasswordStrength("abcdefgh")
    expect(r.ok).toBe(false)
    expect(r.errors).toContain("Inclua ao menos um número")
  })

  it("accepts a minimum-valid password (8 chars + letter + digit)", () => {
    const r = checkPasswordStrength("abc12345")
    expect(r.ok).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  it("rates a long password with mixed case and symbol as strong", () => {
    const r = checkPasswordStrength("MyStr0ng!Pass2026")
    expect(r.ok).toBe(true)
    expect(r.strength).toBeGreaterThanOrEqual(3)
  })

  it("rates a barely-valid password as weak", () => {
    const r = checkPasswordStrength("abc12345")
    expect(r.ok).toBe(true)
    expect(r.strength).toBeLessThanOrEqual(2)
  })

  it("exposes labels covering all strength levels", () => {
    expect(STRENGTH_LABELS.length).toBe(5)
  })

  it("treats empty string as invalid with multiple errors", () => {
    const r = checkPasswordStrength("")
    expect(r.ok).toBe(false)
    expect(r.errors.length).toBeGreaterThanOrEqual(2)
  })
})
