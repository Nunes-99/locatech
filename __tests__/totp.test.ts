/**
 * @jest-environment node
 *
 * Cobre só `src/lib/backup-codes.ts` (lógica pura).
 *
 * As funções `generateTotpSecret`/`buildOtpAuthUrl`/`verifyTotpCode` dependem
 * de `otplib`, que vem com `@scure/base` ESM-only — incompatível com a config
 * default do Jest do Next sem extra transform setup. Essas funções têm
 * cobertura via E2E (Playwright) quando o app estiver rodando.
 */
import { generateBackupCodes, consumeBackupCode } from "@/lib/backup-codes"

describe("generateBackupCodes", () => {
  it("gera 10 códigos por default", () => {
    const codes = generateBackupCodes()
    expect(codes).toHaveLength(10)
  })

  it("aceita quantidade custom", () => {
    expect(generateBackupCodes(5)).toHaveLength(5)
    expect(generateBackupCodes(20)).toHaveLength(20)
  })

  it("códigos têm 8 caracteres hex", () => {
    const codes = generateBackupCodes(3)
    for (const c of codes) {
      expect(c).toMatch(/^[a-f0-9]{8}$/)
    }
  })

  it("códigos são únicos (entropia adequada)", () => {
    const codes = generateBackupCodes(50)
    expect(new Set(codes).size).toBe(50)
  })

  it("códigos diferentes entre chamadas", () => {
    const a = generateBackupCodes(5)
    const b = generateBackupCodes(5)
    expect(new Set([...a, ...b]).size).toBe(10)
  })
})

describe("consumeBackupCode", () => {
  const codes = ["abc12345", "def67890", "12ab34cd"]

  it("retorna matched=true e remove o código consumido", () => {
    const r = consumeBackupCode("def67890", codes)
    expect(r.matched).toBe(true)
    expect(r.remaining).toHaveLength(2)
    expect(r.remaining).not.toContain("def67890")
    expect(r.remaining).toContain("abc12345")
    expect(r.remaining).toContain("12ab34cd")
  })

  it("retorna matched=false quando código não existe", () => {
    const r = consumeBackupCode("notfound", codes)
    expect(r.matched).toBe(false)
    expect(r.remaining).toEqual(codes)
  })

  it("é case-insensitive", () => {
    const r = consumeBackupCode("ABC12345", codes)
    expect(r.matched).toBe(true)
    expect(r.remaining).not.toContain("abc12345")
  })

  it("trim de espaços", () => {
    const r = consumeBackupCode("  abc12345  ", codes)
    expect(r.matched).toBe(true)
  })

  it("remove espaços internos", () => {
    const r = consumeBackupCode("abc 12345", codes)
    expect(r.matched).toBe(true)
  })

  it("lista vazia retorna matched=false", () => {
    const r = consumeBackupCode("abc12345", [])
    expect(r.matched).toBe(false)
    expect(r.remaining).toEqual([])
  })

  it("não muta a lista original", () => {
    const original = [...codes]
    consumeBackupCode("abc12345", codes)
    expect(codes).toEqual(original)
  })
})
