"use client"

import { useState, useCallback } from "react"
import { fetchAddressByCep, AddressData } from "@/lib/viacep"

interface UseViaCepResult {
  address: AddressData | null
  loading: boolean
  error: string | null
  searchCep: (cep: string) => Promise<AddressData | null>
  reset: () => void
}

export function useViaCep(): UseViaCepResult {
  const [address, setAddress] = useState<AddressData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchCep = useCallback(async (cep: string): Promise<AddressData | null> => {
    const cleanCep = cep.replace(/\D/g, "")

    if (cleanCep.length !== 8) {
      setError("CEP deve ter 8 dígitos")
      return null
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetchAddressByCep(cleanCep)

      if (!result) {
        setError("CEP não encontrado")
        setAddress(null)
        return null
      }

      setAddress(result)
      return result
    } catch {
      setError("Erro ao buscar CEP")
      setAddress(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setAddress(null)
    setError(null)
    setLoading(false)
  }, [])

  return {
    address,
    loading,
    error,
    searchCep,
    reset,
  }
}
