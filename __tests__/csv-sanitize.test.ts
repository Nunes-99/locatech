/**
 * @jest-environment node
 */
import { sanitizeCsvCell, csvRow } from "@/lib/csv"

describe("sanitizeCsvCell", () => {
  it("retorna string vazia pra null/undefined", () => {
    expect(sanitizeCsvCell(null)).toBe("")
    expect(sanitizeCsvCell(undefined)).toBe("")
  })

  it("converte tipos primitivos pra string", () => {
    expect(sanitizeCsvCell(42)).toBe("42")
    expect(sanitizeCsvCell(true)).toBe("true")
  })

  it("prefixa valores começando com = (proteção fórmula)", () => {
    expect(sanitizeCsvCell("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1")
    expect(sanitizeCsvCell("=HYPERLINK(\"evil\")")).toBe("'=HYPERLINK(\"evil\")")
  })

  it("prefixa valores começando com + - @ (proteção fórmula)", () => {
    expect(sanitizeCsvCell("+1234")).toBe("'+1234")
    expect(sanitizeCsvCell("-foo")).toBe("'-foo")
    expect(sanitizeCsvCell("@SUM")).toBe("'@SUM")
  })

  it("prefixa valores começando com TAB ou CR (proteção fórmula)", () => {
    expect(sanitizeCsvCell("\tfoo")).toBe("'\tfoo")
    expect(sanitizeCsvCell("\rfoo")).toBe("'\rfoo")
  })

  it("não altera valores seguros", () => {
    expect(sanitizeCsvCell("João Silva")).toBe("João Silva")
    expect(sanitizeCsvCell("123 Main St")).toBe("123 Main St")
    expect(sanitizeCsvCell("foo=bar")).toBe("foo=bar") // = no meio é OK
  })
})

describe("csvRow", () => {
  it("monta linha CSV simples", () => {
    expect(csvRow(["a", "b", "c"])).toBe("a,b,c")
  })

  it("escapa células com vírgula (encapsula em aspas)", () => {
    expect(csvRow(["a,b", "c"])).toBe('"a,b",c')
  })

  it("escapa células com aspas (duplica aspas e encapsula)", () => {
    expect(csvRow(['John "Big" Doe', "foo"])).toBe('"John ""Big"" Doe",foo')
  })

  it("escapa células com quebra de linha", () => {
    expect(csvRow(["line1\nline2", "foo"])).toBe('"line1\nline2",foo')
  })

  it("sanitiza fórmula injection EM CONJUNTO com escape", () => {
    expect(csvRow(["=evil()"])).toBe("'=evil()")
    expect(csvRow(["=evil,injection"])).toBe('"\'=evil,injection"')
  })

  it("trata null/undefined como string vazia", () => {
    expect(csvRow([null, undefined, "x"])).toBe(",,x")
  })

  it("converte tipos primitivos", () => {
    expect(csvRow([42, true, "str"])).toBe("42,true,str")
  })
})
