"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Hook compartilhado pra persistir filtros de listagem em localStorage.
 *
 * Uso típico:
 *
 *   const [filters, setFilters] = useSavedFilters("equipamentos", {
 *     status: "all",
 *     categoryId: "all",
 *     search: "",
 *   })
 *
 * Trate `filters` igual ao state normal — o hook cuida de hidratar do localStorage
 * no mount e gravar no unmount/mudança. Resetar todos os campos limpa o storage.
 */
export function useSavedFilters<T extends Record<string, unknown>>(
  key: string,
  defaults: T
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = `locatech-filters-${key}`
  const [state, setState] = useState<T>(defaults)
  const hydrated = useRef(false)

  // Hidrata na montagem (apenas client-side)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        // Mantém apenas as chaves conhecidas — protege de schema obsoleto
        const merged = { ...defaults }
        for (const k of Object.keys(defaults)) {
          if (k in parsed) (merged as Record<string, unknown>)[k] = parsed[k]
        }
        setState(merged as T)
      }
    } catch {
      // localStorage indisponível (modo privado, etc) — usa defaults
    }
    hydrated.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Grava em cada mudança após hidratar
  useEffect(() => {
    if (!hydrated.current) return
    try {
      // Não persiste se igual ao default — evita poluir storage
      const isAllDefault = Object.entries(defaults).every(
        ([k, v]) => JSON.stringify(state[k as keyof T]) === JSON.stringify(v)
      )
      if (isAllDefault) {
        localStorage.removeItem(storageKey)
      } else {
        localStorage.setItem(storageKey, JSON.stringify(state))
      }
    } catch {
      // ignore
    }
  }, [state, defaults, storageKey])

  const reset = useCallback(() => {
    setState(defaults)
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
  }, [defaults, storageKey])

  return [state, setState, reset]
}
