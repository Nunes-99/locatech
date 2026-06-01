import { splitCsvLine, parseCsvNumber, parseCsvHeader, readCsvCell } from "@/lib/csv"

describe("splitCsvLine", () => {
  it("splits comma-separated values", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"])
  })

  it("splits semicolon-separated values (BR locale)", () => {
    expect(splitCsvLine("a;b;c")).toEqual(["a", "b", "c"])
  })

  it("trims whitespace", () => {
    expect(splitCsvLine("a, b , c")).toEqual(["a", "b", "c"])
  })

  it("preserves separators inside quoted strings", () => {
    expect(splitCsvLine('"Hello, world",x,y')).toEqual(["Hello, world", "x", "y"])
  })

  it("handles escaped quotes inside quoted strings", () => {
    expect(splitCsvLine('"He said ""hi""",x')).toEqual(['He said "hi"', "x"])
  })

  it("handles empty fields", () => {
    expect(splitCsvLine("a,,c")).toEqual(["a", "", "c"])
  })

  it("handles a single cell", () => {
    expect(splitCsvLine("single")).toEqual(["single"])
  })
})

describe("parseCsvNumber", () => {
  it("returns undefined for empty or missing input", () => {
    expect(parseCsvNumber(undefined)).toBeUndefined()
    expect(parseCsvNumber("")).toBeUndefined()
  })

  it("parses plain integer", () => {
    expect(parseCsvNumber("42")).toBe(42)
  })

  it("parses dot decimal (US format)", () => {
    expect(parseCsvNumber("1234.56")).toBe(1234.56)
  })

  it("parses comma decimal (BR format)", () => {
    expect(parseCsvNumber("1234,56")).toBe(1234.56)
  })

  it("parses thousand separator + comma decimal", () => {
    expect(parseCsvNumber("1.234,56")).toBe(1234.56)
  })

  it("returns undefined for non-numeric strings", () => {
    expect(parseCsvNumber("abc")).toBeUndefined()
  })
})

describe("parseCsvHeader", () => {
  const KNOWN = ["name", "code", "rate"] as const
  const REQUIRED = ["name", "code"] as const

  it("maps columns regardless of case", () => {
    const idx = parseCsvHeader("Name,Code,Rate", KNOWN, REQUIRED)
    expect(idx.name).toBe(0)
    expect(idx.code).toBe(1)
    expect(idx.rate).toBe(2)
  })

  it("allows columns in any order", () => {
    const idx = parseCsvHeader("rate,code,name", KNOWN, REQUIRED)
    expect(idx.name).toBe(2)
    expect(idx.code).toBe(1)
    expect(idx.rate).toBe(0)
  })

  it("permits missing optional columns", () => {
    const idx = parseCsvHeader("name,code", KNOWN, REQUIRED)
    expect(idx.rate).toBeUndefined()
  })

  it("throws when a required column is missing", () => {
    expect(() => parseCsvHeader("name,rate", KNOWN, REQUIRED)).toThrow(/code/)
  })
})

describe("readCsvCell", () => {
  it("returns the value at the mapped index", () => {
    const idx = { name: 0, code: 1 }
    expect(readCsvCell(["Joao", "C-001"], idx, "name")).toBe("Joao")
    expect(readCsvCell(["Joao", "C-001"], idx, "code")).toBe("C-001")
  })

  it("returns undefined for unknown keys", () => {
    expect(readCsvCell(["a", "b"], { name: 0 }, "missing")).toBeUndefined()
  })
})
