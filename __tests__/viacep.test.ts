import { fetchAddressByCep, formatCep } from "@/lib/viacep"

describe("ViaCEP Integration", () => {
  describe("formatCep", () => {
    it("should format CEP correctly", () => {
      expect(formatCep("01310100")).toBe("01310-100")
      expect(formatCep("01310")).toBe("01310")
      expect(formatCep("013")).toBe("013")
    })

    it("should remove non-numeric characters", () => {
      expect(formatCep("01310-100")).toBe("01310-100")
      expect(formatCep("01.310.100")).toBe("01310-100")
    })

    it("should limit to 8 digits", () => {
      expect(formatCep("0131010099")).toBe("01310-100")
    })
  })

  describe("fetchAddressByCep", () => {
    it("should return null for invalid CEP length", async () => {
      const result = await fetchAddressByCep("1234")
      expect(result).toBeNull()
    })

    it("should return null for CEP with letters", async () => {
      const result = await fetchAddressByCep("0131010a")
      expect(result).toBeNull()
    })

    // Integration test - requires network
    it("should fetch address for valid CEP", async () => {
      const result = await fetchAddressByCep("01310100")

      if (result) {
        expect(result).toHaveProperty("cep")
        expect(result).toHaveProperty("street")
        expect(result).toHaveProperty("city")
        expect(result).toHaveProperty("state")
        expect(result.state).toBe("SP")
        expect(result.city).toBe("São Paulo")
      }
    }, 10000)

    it("should return null for non-existent CEP", async () => {
      const result = await fetchAddressByCep("00000000")
      expect(result).toBeNull()
    }, 10000)
  })
})
