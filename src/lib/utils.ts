import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("pt-BR").format(d)
}

export function formatDocument(document: string, type: "CPF" | "CNPJ"): string {
  const cleaned = document.replace(/\D/g, "")
  if (type === "CPF" && cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`
  }
  if (type === "CNPJ" && cleaned.length === 14) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`
  }
  return document
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

export function calculateLateFee(
  expectedEndDate: Date,
  actualEndDate: Date,
  dailyRate: number,
  lateFeePercent: number
): { lateDays: number; lateFee: number } {
  const diffTime = actualEndDate.getTime() - expectedEndDate.getTime()
  const lateDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  const lateFee = lateDays * dailyRate * (lateFeePercent / 100)
  return { lateDays, lateFee }
}
