"use client"

import { useState, useEffect, useRef, forwardRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, Check, X } from "lucide-react"
import { useViaCep } from "@/hooks/use-viacep"
import { formatCep, AddressData } from "@/lib/viacep"
import { cn } from "@/lib/utils"

interface CepInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onAddressFound?: (address: AddressData) => void
  onChange?: (value: string) => void
  autoSearch?: boolean
}

export const CepInput = forwardRef<HTMLInputElement, CepInputProps>(
  ({ onAddressFound, onChange, autoSearch = true, className, value, ...props }, ref) => {
    const [inputValue, setInputValue] = useState((value as string) || "")
    const { loading, error, address, searchCep } = useViaCep()

    useEffect(() => {
      if (value !== undefined) {
        setInputValue(value as string)
      }
    }, [value])

    // Avisa a página uma vez por endereço encontrado. Com o callback nas
    // dependências, a página (que passa uma função nova a cada render) entrava
    // em loop infinito ao carregar um CEP salvo — Configurações nem abria.
    const avisarRef = useRef(onAddressFound)
    avisarRef.current = onAddressFound
    useEffect(() => {
      if (address) avisarRef.current?.(address)
    }, [address])

    // Auto search when CEP is complete — uma busca por CEP, não por render
    const ultimoBuscado = useRef("")
    useEffect(() => {
      if (!autoSearch) return
      const cleanCep = inputValue.replace(/\D/g, "")
      if (cleanCep.length === 8 && cleanCep !== ultimoBuscado.current) {
        ultimoBuscado.current = cleanCep
        searchCep(cleanCep)
      }
    }, [inputValue, autoSearch, searchCep])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCep(e.target.value)
      setInputValue(formatted)
      onChange?.(formatted)
    }

    const handleSearch = () => {
      searchCep(inputValue)
    }

    const getStatus = () => {
      if (loading) return "loading"
      if (error) return "error"
      if (address) return "success"
      return "idle"
    }

    const status = getStatus()

    return (
      <div className="relative">
        <Input
          ref={ref}
          value={inputValue}
          onChange={handleChange}
          placeholder="00000-000"
          maxLength={9}
          className={cn(
            "pr-10",
            status === "error" && "border-red-500 focus-visible:ring-red-500",
            status === "success" && "border-green-500 focus-visible:ring-green-500",
            className
          )}
          {...props}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {status === "loading" && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {status === "success" && (
            <Check className="h-4 w-4 text-green-500" />
          )}
          {status === "error" && (
            <X className="h-4 w-4 text-red-500" />
          )}
          {!autoSearch && status === "idle" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleSearch}
              disabled={loading}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
      </div>
    )
  }
)

CepInput.displayName = "CepInput"
