"use client"

import { forwardRef, useCallback } from "react"
import { Input } from "./input"
import { maskCPF, maskCNPJ, maskPhone, maskCEP, validateCPF, validateCNPJ } from "@/lib/validators"

export type MaskType = "cpf" | "cnpj" | "phone" | "cep" | "document"

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  mask: MaskType
  documentType?: "CPF" | "CNPJ"
  onValueChange?: (value: string, isValid: boolean) => void
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  showValidation?: boolean
}

export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, documentType = "CPF", onValueChange, onChange, showValidation = false, className, ...props }, ref) => {
    const getMaskFunction = useCallback(() => {
      switch (mask) {
        case "cpf":
          return maskCPF
        case "cnpj":
          return maskCNPJ
        case "phone":
          return maskPhone
        case "cep":
          return maskCEP
        case "document":
          return documentType === "CPF" ? maskCPF : maskCNPJ
        default:
          return (v: string) => v
      }
    }, [mask, documentType])

    const getValidationFunction = useCallback(() => {
      switch (mask) {
        case "cpf":
          return validateCPF
        case "cnpj":
          return validateCNPJ
        case "document":
          return documentType === "CPF" ? validateCPF : validateCNPJ
        default:
          return () => true
      }
    }, [mask, documentType])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const maskFn = getMaskFunction()
      const validateFn = getValidationFunction()

      const rawValue = e.target.value.replace(/\D/g, "")
      const maskedValue = maskFn(rawValue)

      e.target.value = maskedValue

      const isValid = validateFn(rawValue)

      onChange?.(e)
      onValueChange?.(rawValue, isValid)
    }

    const isValid = useCallback(() => {
      if (!showValidation || !props.value) return true
      const validateFn = getValidationFunction()
      const rawValue = String(props.value).replace(/\D/g, "")
      return validateFn(rawValue)
    }, [showValidation, props.value, getValidationFunction])

    return (
      <Input
        ref={ref}
        {...props}
        onChange={handleChange}
        className={`${className} ${showValidation && props.value && !isValid() ? "border-red-500 focus-visible:ring-red-500" : ""}`}
      />
    )
  }
)

MaskedInput.displayName = "MaskedInput"
