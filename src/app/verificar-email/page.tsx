"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react"

function VerifyEmailInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [state, setState] = useState<"loading" | "ok" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setState("error")
      setMessage("Link inválido — token ausente.")
      return
    }
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (r.ok) {
          setState("ok")
          setMessage(j.alreadyVerified ? "Seu email já estava confirmado." : "Email confirmado com sucesso!")
        } else {
          setState("error")
          setMessage(j.error || "Não foi possível verificar.")
        }
      })
      .catch(() => {
        setState("error")
        setMessage("Erro de conexão. Tente novamente.")
      })
  }, [token])

  return (
    <div className="w-full max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
      {state === "loading" && (
        <>
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <h1 className="mt-3 text-lg font-semibold">Verificando…</h1>
        </>
      )}

      {state === "ok" && (
        <>
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h1 className="mt-3 text-lg font-semibold">{message}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Você já pode acessar todas as funcionalidades do LocaTech.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary/90"
          >
            Ir pro dashboard
          </Link>
        </>
      )}

      {state === "error" && (
        <>
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-3 text-lg font-semibold">Não foi possível verificar</h1>
          <p className="mt-1 text-sm text-slate-600">{message}</p>
          <Link
            href="/login"
            className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Mail className="h-4 w-4" /> Pedir novo email após login
          </Link>
        </>
      )}
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          </div>
        }
      >
        <VerifyEmailInner />
      </Suspense>
    </main>
  )
}
