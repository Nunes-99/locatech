// Validação de CPF
export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "")

  if (cleaned.length !== 11) return false

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleaned)) return false

  // Validação do primeiro dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i)
  }
  let digit1 = 11 - (sum % 11)
  if (digit1 >= 10) digit1 = 0

  if (parseInt(cleaned[9]) !== digit1) return false

  // Validação do segundo dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i)
  }
  let digit2 = 11 - (sum % 11)
  if (digit2 >= 10) digit2 = 0

  return parseInt(cleaned[10]) === digit2
}

// Validação de CNPJ
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "")

  if (cleaned.length !== 14) return false

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleaned)) return false

  // Validação do primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i]
  }
  let digit1 = 11 - (sum % 11)
  if (digit1 >= 10) digit1 = 0

  if (parseInt(cleaned[12]) !== digit1) return false

  // Validação do segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  sum = 0
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i]
  }
  let digit2 = 11 - (sum % 11)
  if (digit2 >= 10) digit2 = 0

  return parseInt(cleaned[13]) === digit2
}

// Validação de documento (CPF ou CNPJ)
export function validateDocument(doc: string, type: "CPF" | "CNPJ"): boolean {
  return type === "CPF" ? validateCPF(doc) : validateCNPJ(doc)
}

// Máscaras
export function maskCPF(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11)
  return cleaned
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

export function maskCNPJ(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 14)
  return cleaned
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
}

export function maskPhone(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11)
  if (cleaned.length <= 10) {
    return cleaned
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
  }
  return cleaned
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
}

export function maskCEP(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 8)
  return cleaned.replace(/(\d{5})(\d)/, "$1-$2")
}

export function maskCurrency(value: string): string {
  const cleaned = value.replace(/\D/g, "")
  const number = parseInt(cleaned || "0") / 100
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function unmaskCurrency(value: string): number {
  const cleaned = value.replace(/\D/g, "")
  return parseInt(cleaned || "0") / 100
}

// ============================================
// SENHA — força mínima
// ============================================
//
// Regras: 8+ caracteres, ao menos 1 letra e 1 dígito.
// Não exige símbolo (compromisso entre segurança e usabilidade — para SaaS B2B
// que cobra mensalmente, atrito demais na criação de conta vira churn).

export const TERMS_VERSION = "2026-05-29"

export interface PasswordCheck {
  ok: boolean
  errors: string[]
  strength: 0 | 1 | 2 | 3 | 4 // 0=muito fraca, 4=forte
}

export function checkPasswordStrength(pwd: string): PasswordCheck {
  const errors: string[] = []
  if (pwd.length < 8) errors.push("Mínimo 8 caracteres")
  if (!/[a-zA-Z]/.test(pwd)) errors.push("Inclua ao menos uma letra")
  if (!/\d/.test(pwd)) errors.push("Inclua ao menos um número")

  let strength: PasswordCheck["strength"] = 0
  if (pwd.length >= 8) strength++
  if (pwd.length >= 12) strength++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) strength++
  if (/[^A-Za-z0-9]/.test(pwd)) strength++
  if (strength > 4) strength = 4

  return { ok: errors.length === 0, errors, strength: strength as PasswordCheck["strength"] }
}

export const STRENGTH_LABELS = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"] as const
export const STRENGTH_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-500",
] as const
