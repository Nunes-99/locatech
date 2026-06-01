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
import crypto from "crypto"

function hash(code: string): string {
  return crypto.createHash("sha256").update(code.trim().toLowerCase()).digest("hex")
}

describe("generateBackupCodes", () => {
  it("gera 10 códigos por default", () => {
    const { plain, hashed } = generateBackupCodes()
    expect(plain).toHaveLength(10)
    expect(hashed).toHaveLength(10)
  })

  it("aceita quantidade custom", () => {
    expect(generateBackupCodes(5).plain).toHaveLength(5)
    expect(generateBackupCodes(20).plain).toHaveLength(20)
  })

  it("códigos em claro têm 8 caracteres hex", () => {
    const { plain } = generateBackupCodes(3)
    for (const c of plain) {
      expect(c).toMatch(/^[a-f0-9]{8}$/)
    }
  })

  it("hashes têm 64 caracteres hex (SHA-256)", () => {
    const { hashed } = generateBackupCodes(3)
    for (const h of hashed) {
      expect(h).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it("códigos em claro são únicos (entropia adequada)", () => {
    const { plain } = generateBackupCodes(50)
    expect(new Set(plain).size).toBe(50)
  })

  it("códigos diferentes entre chamadas", () => {
    const a = generateBackupCodes(5).plain
    const b = generateBackupCodes(5).plain
    expect(new Set([...a, ...b]).size).toBe(10)
  })

  it("cada hashed corresponde ao plain via SHA-256", () => {
    const { plain, hashed } = generateBackupCodes(5)
    plain.forEach((p, i) => {
      expect(hashed[i]).toBe(hash(p))
    })
  })
})

describe("consumeBackupCode", () => {
  const plainCodes = ["abc12345", "def67890", "12ab34cd"]
  const hashedCodes = plainCodes.map(hash)

  it("retorna matched=true e remove o hash consumido", () => {
    const r = consumeBackupCode("def67890", hashedCodes)
    expect(r.matched).toBe(true)
    expect(r.remaining).toHaveLength(2)
    expect(r.remaining).not.toContain(hash("def67890"))
    expect(r.remaining).toContain(hash("abc12345"))
    expect(r.remaining).toContain(hash("12ab34cd"))
  })

  it("retorna matched=false quando código não existe", () => {
    const r = consumeBackupCode("notfound", hashedCodes)
    expect(r.matched).toBe(false)
    expect(r.remaining).toEqual(hashedCodes)
  })

  it("é case-insensitive (input em maiúsculo casa com hash do minúsculo)", () => {
    const r = consumeBackupCode("ABC12345", hashedCodes)
    expect(r.matched).toBe(true)
    expect(r.remaining).not.toContain(hash("abc12345"))
  })

  it("trim de espaços", () => {
    const r = consumeBackupCode("  abc12345  ", hashedCodes)
    expect(r.matched).toBe(true)
  })

  it("remove espaços internos", () => {
    const r = consumeBackupCode("abc 12345", hashedCodes)
    expect(r.matched).toBe(true)
  })

  it("lista vazia retorna matched=false", () => {
    const r = consumeBackupCode("abc12345", [])
    expect(r.matched).toBe(false)
    expect(r.remaining).toEqual([])
  })

  it("não muta a lista original", () => {
    const original = [...hashedCodes]
    consumeBackupCode("abc12345", hashedCodes)
    expect(hashedCodes).toEqual(original)
  })

  it("código vazio retorna matched=false", () => {
    const r = consumeBackupCode("", hashedCodes)
    expect(r.matched).toBe(false)
  })
})
