/**
 * @jest-environment node
 *
 * Roda em node porque importa cadeia que toca PrismaClient. O default jsdom
 * faz o Prisma carregar a build de browser e quebrar antes mesmo do teste rodar.
 */
import { generateApiKey, hashApiKey, API_KEY_PREFIX } from "@/lib/api-key"

describe("generateApiKey", () => {
  it("gera key com prefixo correto", () => {
    const { raw } = generateApiKey()
    expect(raw.startsWith(API_KEY_PREFIX)).toBe(true)
  })

  it("gera valores únicos a cada chamada", () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.raw).not.toBe(b.raw)
    expect(a.hash).not.toBe(b.hash)
  })

  it("hash é determinístico", () => {
    const { raw, hash } = generateApiKey()
    expect(hashApiKey(raw)).toBe(hash)
  })

  it("last4 é os 4 últimos chars da key crua", () => {
    const { raw, last4 } = generateApiKey()
    expect(last4).toBe(raw.slice(-4))
    expect(last4).toHaveLength(4)
  })

  it("hash não é reversível", () => {
    const { raw, hash } = generateApiKey()
    expect(hash).not.toBe(raw)
    expect(hash).toHaveLength(64) // SHA-256 hex
  })

  it("keys diferentes produzem hashes diferentes (sanity)", () => {
    expect(hashApiKey("lt_live_abc")).not.toBe(hashApiKey("lt_live_def"))
  })
})
