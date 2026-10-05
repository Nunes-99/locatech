import { contarDiarias, diasDeAtraso } from "@/lib/diarias"

// Datas como o formulário manda: "AAAA-MM-DD" vira meia-noite UTC
const data = (iso: string) => new Date(iso)
// Instante em Brasília (UTC-3)
const brasilia = (iso: string) => new Date(`${iso}-03:00`)

describe("contarDiarias", () => {
  it("conta as diárias entre as datas do formulário", () => {
    expect(contarDiarias(data("2026-10-01"), data("2026-10-31"))).toBe(30)
    expect(contarDiarias(data("2026-10-01"), data("2026-10-02"))).toBe(1)
  })

  it("fração de dia conta como diária cheia e nunca menos de 1", () => {
    expect(contarDiarias(new Date("2026-10-01T08:00Z"), new Date("2026-10-02T10:00Z"))).toBe(2)
    expect(contarDiarias(new Date("2026-10-01T08:00Z"), new Date("2026-10-01T09:00Z"))).toBe(1)
  })
})

describe("diasDeAtraso", () => {
  it("devolver no próprio dia combinado não é atraso (era cobrado 1 dia)", () => {
    expect(diasDeAtraso(data("2026-10-10"), brasilia("2026-10-10T10:00:00"))).toBe(0)
    expect(diasDeAtraso(data("2026-10-10"), brasilia("2026-10-10T23:30:00"))).toBe(0)
  })

  it("conta dias de calendário em Brasília", () => {
    expect(diasDeAtraso(data("2026-10-10"), brasilia("2026-10-11T08:00:00"))).toBe(1)
    expect(diasDeAtraso(data("2026-10-10"), brasilia("2026-10-13T15:00:00"))).toBe(3)
  })

  it("21h em Brasília já é outro dia em UTC, mas não aqui", () => {
    // 2026-10-10 22:00 em Brasília = 2026-10-11 01:00 UTC
    expect(diasDeAtraso(data("2026-10-10"), brasilia("2026-10-10T22:00:00"))).toBe(0)
  })

  it("devolução antecipada não gera atraso negativo", () => {
    expect(diasDeAtraso(data("2026-10-10"), brasilia("2026-10-08T12:00:00"))).toBe(0)
  })
})
