"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Cookie, X } from "lucide-react"

const STORAGE_KEY = "locatech-cookies-accepted"

/**
 * Banner discreto de cookies/privacidade.
 *
 * Hoje o LocaTech usa só cookies estritamente necessários (sessão NextAuth),
 * então legalmente nem precisaria de banner. Mas exibimos um aviso curto
 * pra cumprir as expectativas de transparência e para ficar pronto caso
 * alguma analytics (GA, Meta Pixel) seja ativada no futuro.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY)
      if (!accepted) setVisible(true)
    } catch {
      // localStorage indisponível — não mostrar (sem como persistir consentimento)
    }
  }, [])

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {
      // ignore
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso sobre cookies"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Cookie className="hidden h-6 w-6 flex-shrink-0 text-amber-600 sm:block" aria-hidden />
        <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">
          Usamos cookies estritamente necessários (sessão e preferências) para o sistema funcionar.{" "}
          <Link
            href="/privacidade"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Ver política de privacidade
          </Link>
          .
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={accept}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            Entendi
          </button>
          <button
            type="button"
            onClick={accept}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
