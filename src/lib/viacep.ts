export interface ViaCepResponse {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  ibge: string
  gia: string
  ddd: string
  siafi: string
  erro?: boolean
}

export interface AddressData {
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
}

export async function fetchAddressByCep(cep: string): Promise<AddressData | null> {
  // Remove non-numeric characters
  const cleanCep = cep.replace(/\D/g, "")

  if (cleanCep.length !== 8) {
    return null
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)

    if (!response.ok) {
      throw new Error("Failed to fetch address")
    }

    const data: ViaCepResponse = await response.json()

    if (data.erro) {
      return null
    }

    return {
      cep: data.cep,
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf,
    }
  } catch (error) {
    console.error("Error fetching address from ViaCEP:", error)
    return null
  }
}

export function formatCep(value: string): string {
  const cleanValue = value.replace(/\D/g, "")
  if (cleanValue.length <= 5) {
    return cleanValue
  }
  return `${cleanValue.slice(0, 5)}-${cleanValue.slice(5, 8)}`
}
