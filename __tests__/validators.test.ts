import {
  validateCPF,
  validateCNPJ,
  validateDocument,
  maskCPF,
  maskCNPJ,
  maskPhone,
  maskCEP,
  maskCurrency,
  unmaskCurrency,
} from "@/lib/validators"

describe("CPF Validation", () => {
  it("should validate a valid CPF", () => {
    expect(validateCPF("529.982.247-25")).toBe(true)
    expect(validateCPF("52998224725")).toBe(true)
  })

  it("should reject an invalid CPF", () => {
    expect(validateCPF("123.456.789-00")).toBe(false)
    expect(validateCPF("12345678900")).toBe(false)
  })

  it("should reject CPF with all same digits", () => {
    expect(validateCPF("111.111.111-11")).toBe(false)
    expect(validateCPF("000.000.000-00")).toBe(false)
  })

  it("should reject CPF with wrong length", () => {
    expect(validateCPF("123.456.789")).toBe(false)
    expect(validateCPF("123.456.789-001")).toBe(false)
  })
})

describe("CNPJ Validation", () => {
  it("should validate a valid CNPJ", () => {
    expect(validateCNPJ("11.222.333/0001-81")).toBe(true)
    expect(validateCNPJ("11222333000181")).toBe(true)
  })

  it("should reject an invalid CNPJ", () => {
    expect(validateCNPJ("11.222.333/0001-00")).toBe(false)
    expect(validateCNPJ("12345678000100")).toBe(false)
  })

  it("should reject CNPJ with all same digits", () => {
    expect(validateCNPJ("11.111.111/1111-11")).toBe(false)
    expect(validateCNPJ("00.000.000/0000-00")).toBe(false)
  })

  it("should reject CNPJ with wrong length", () => {
    expect(validateCNPJ("11.222.333/0001")).toBe(false)
    expect(validateCNPJ("11.222.333/0001-811")).toBe(false)
  })
})

describe("validateDocument", () => {
  it("should validate CPF when type is CPF", () => {
    expect(validateDocument("52998224725", "CPF")).toBe(true)
    expect(validateDocument("12345678900", "CPF")).toBe(false)
  })

  it("should validate CNPJ when type is CNPJ", () => {
    expect(validateDocument("11222333000181", "CNPJ")).toBe(true)
    expect(validateDocument("12345678000100", "CNPJ")).toBe(false)
  })
})

describe("Masks", () => {
  describe("maskCPF", () => {
    it("should mask CPF correctly", () => {
      expect(maskCPF("52998224725")).toBe("529.982.247-25")
      expect(maskCPF("529982")).toBe("529.982")
      expect(maskCPF("529")).toBe("529")
    })

    it("should handle partial input", () => {
      expect(maskCPF("5299822")).toBe("529.982.2")
    })
  })

  describe("maskCNPJ", () => {
    it("should mask CNPJ correctly", () => {
      expect(maskCNPJ("11222333000181")).toBe("11.222.333/0001-81")
      expect(maskCNPJ("112223")).toBe("11.222.3")
    })
  })

  describe("maskPhone", () => {
    it("should mask landline phone correctly", () => {
      expect(maskPhone("1133334444")).toBe("(11) 3333-4444")
    })

    it("should mask mobile phone correctly", () => {
      expect(maskPhone("11999998888")).toBe("(11) 99999-8888")
    })

    it("should handle partial input", () => {
      expect(maskPhone("11999")).toBe("(11) 999")
    })
  })

  describe("maskCEP", () => {
    it("should mask CEP correctly", () => {
      expect(maskCEP("01310100")).toBe("01310-100")
      expect(maskCEP("01310")).toBe("01310")
    })
  })

  describe("maskCurrency", () => {
    it("should format currency correctly", () => {
      expect(maskCurrency("10000")).toBe("100,00")
      expect(maskCurrency("1234567")).toBe("12.345,67")
    })

    it("should handle empty input", () => {
      expect(maskCurrency("")).toBe("0,00")
    })
  })

  describe("unmaskCurrency", () => {
    it("should unmask currency correctly", () => {
      expect(unmaskCurrency("R$ 100,00")).toBe(100)
      expect(unmaskCurrency("R$ 12.345,67")).toBe(12345.67)
    })

    it("should handle empty input", () => {
      expect(unmaskCurrency("")).toBe(0)
    })
  })
})
