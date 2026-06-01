import { rateLimit, getClientIp } from "@/lib/rate-limit"

describe("rateLimit", () => {
  // Cada teste usa uma chave única pra não interferir
  it("permite até o limite", () => {
    const key = `test-${Date.now()}-A`
    for (let i = 0; i < 5; i++) {
      const r = rateLimit({ key, limit: 5, windowMs: 60_000 })
      expect(r.allowed).toBe(true)
    }
  })

  it("bloqueia depois do limite", () => {
    const key = `test-${Date.now()}-B`
    for (let i = 0; i < 3; i++) {
      rateLimit({ key, limit: 3, windowMs: 60_000 })
    }
    const r = rateLimit({ key, limit: 3, windowMs: 60_000 })
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
    expect(r.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("decrementa remaining a cada chamada", () => {
    const key = `test-${Date.now()}-C`
    const a = rateLimit({ key, limit: 10, windowMs: 60_000 })
    const b = rateLimit({ key, limit: 10, windowMs: 60_000 })
    const c = rateLimit({ key, limit: 10, windowMs: 60_000 })
    expect(a.remaining).toBe(9)
    expect(b.remaining).toBe(8)
    expect(c.remaining).toBe(7)
  })

  it("expira janela após windowMs (simulado com window curtíssimo)", async () => {
    const key = `test-${Date.now()}-D`
    rateLimit({ key, limit: 1, windowMs: 50 })
    const blocked = rateLimit({ key, limit: 1, windowMs: 50 })
    expect(blocked.allowed).toBe(false)
    await new Promise((r) => setTimeout(r, 80))
    const afterReset = rateLimit({ key, limit: 1, windowMs: 50 })
    expect(afterReset.allowed).toBe(true)
  })

  it("isola chaves diferentes", () => {
    const key1 = `test-${Date.now()}-E1`
    const key2 = `test-${Date.now()}-E2`
    for (let i = 0; i < 3; i++) rateLimit({ key: key1, limit: 3, windowMs: 60_000 })
    expect(rateLimit({ key: key1, limit: 3, windowMs: 60_000 }).allowed).toBe(false)
    expect(rateLimit({ key: key2, limit: 3, windowMs: 60_000 }).allowed).toBe(true)
  })
})

describe("getClientIp", () => {
  function makeHeaders(record: Record<string, string>): Headers {
    return new Headers(record)
  }

  it("usa x-forwarded-for quando presente", () => {
    const h = makeHeaders({ "x-forwarded-for": "1.2.3.4" })
    expect(getClientIp(h)).toBe("1.2.3.4")
  })

  it("pega o ÚLTIMO IP da chain x-forwarded-for (o que o proxy confiável adicionou)", () => {
    // O primeiro IP pode ter sido injetado pelo próprio cliente — não confiar.
    // O último (mais à direita) é o que o último proxy de confiança colocou.
    const h = makeHeaders({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" })
    expect(getClientIp(h)).toBe("9.10.11.12")
  })

  it("faz fallback pra x-real-ip quando XFF ausente", () => {
    const h = makeHeaders({ "x-real-ip": "10.0.0.1" })
    expect(getClientIp(h)).toBe("10.0.0.1")
  })

  it("cf-connecting-ip tem prioridade sobre x-real-ip e XFF", () => {
    const h = makeHeaders({
      "cf-connecting-ip": "203.0.113.1",
      "x-real-ip": "10.0.0.1",
      "x-forwarded-for": "1.2.3.4",
    })
    expect(getClientIp(h)).toBe("203.0.113.1")
  })

  it("x-real-ip tem prioridade sobre XFF", () => {
    const h = makeHeaders({
      "x-real-ip": "10.0.0.1",
      "x-forwarded-for": "1.2.3.4",
    })
    expect(getClientIp(h)).toBe("10.0.0.1")
  })

  it("devolve unknown quando nenhum header está presente", () => {
    const h = makeHeaders({})
    expect(getClientIp(h)).toBe("unknown")
  })

  it("trim de espaços no último IP", () => {
    const h = makeHeaders({ "x-forwarded-for": "1.2.3.4 ,  5.6.7.8  " })
    expect(getClientIp(h)).toBe("5.6.7.8")
  })
})
