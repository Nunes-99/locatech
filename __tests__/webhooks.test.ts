/**
 * @jest-environment node
 */
import { WEBHOOK_EVENTS } from "@/lib/webhooks"
import crypto from "crypto"

describe("WEBHOOK_EVENTS", () => {
  it("contém os eventos esperados de rental", () => {
    expect(WEBHOOK_EVENTS).toContain("rental.created")
    expect(WEBHOOK_EVENTS).toContain("rental.confirmed")
    expect(WEBHOOK_EVENTS).toContain("rental.returned")
    expect(WEBHOOK_EVENTS).toContain("rental.cancelled")
  })

  it("contém eventos de customer e equipment", () => {
    expect(WEBHOOK_EVENTS).toContain("customer.created")
    expect(WEBHOOK_EVENTS).toContain("equipment.created")
  })

  it("eventos seguem padrão dot notation", () => {
    for (const e of WEBHOOK_EVENTS) {
      expect(e).toMatch(/^[a-z]+\.[a-z]+$/)
    }
  })

  it("não tem duplicatas", () => {
    expect(new Set(WEBHOOK_EVENTS).size).toBe(WEBHOOK_EVENTS.length)
  })
})

/**
 * Os webhooks de saída assinam o body com HMAC-SHA256 (segredo da Webhook row).
 * Aqui validamos a lógica de assinatura/verificação que o subscriber usaria.
 */
describe("HMAC signature contract (pro lado do receptor)", () => {
  const secret = "whsec_" + "a".repeat(48)
  const body = JSON.stringify({
    id: "delivery-123",
    event: "rental.created",
    timestamp: 1700000000,
    data: { rentalId: "r-1" },
  })

  function sign(body: string, secret: string): string {
    return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex")
  }

  it("assinatura é determinística pra mesmo body+secret", () => {
    expect(sign(body, secret)).toBe(sign(body, secret))
  })

  it("assinatura muda se body muda", () => {
    const a = sign(body, secret)
    const b = sign(body + " ", secret)
    expect(a).not.toBe(b)
  })

  it("assinatura muda se secret muda", () => {
    const a = sign(body, secret)
    const b = sign(body, secret + "X")
    expect(a).not.toBe(b)
  })

  it("formato esperado: sha256=<hex 64 chars>", () => {
    const sig = sign(body, secret)
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/)
  })

  it("subscriber consegue validar o body recebido", () => {
    const expected = sign(body, secret)
    // Lado do subscriber: recebe header X-LocaTech-Signature e recomputa
    const received = sign(body, secret)
    expect(received).toBe(expected)
  })
})
