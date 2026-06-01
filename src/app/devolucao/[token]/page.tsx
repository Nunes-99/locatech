"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, AlertCircle, Loader2, Package } from "lucide-react"

interface ReturnData {
  company: { name: string; logoUrl: string | null; primaryColor: string | null }
  customer: { name: string }
  rental: { id: string; contractNumber: number; startDate: string; expectedEndDate: string }
  items: Array<{ id: string; equipmentCode: string; equipmentName: string; quantity: number }>
}

type Condition = "OK" | "DAMAGED"

export default function ReturnPage() {
  const params = useParams<{ token: string }>()
  const [data, setData] = useState<ReturnData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [conditions, setConditions] = useState<Record<string, { condition: Condition; notes: string }>>({})
  const [notes, setNotes] = useState("")

  useEffect(() => {
    fetch(`/api/public/return/${params.token}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error || `Erro ${r.status}`)
        }
        return r.json()
      })
      .then((d: ReturnData) => {
        setData(d)
        // Default: tudo OK
        const init: typeof conditions = {}
        for (const item of d.items) init[item.id] = { condition: "OK", notes: "" }
        setConditions(init)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [params.token])

  async function submit() {
    setSubmitting(true)
    try {
      const conditionsPayload = Object.entries(conditions).map(([itemId, v]) => ({
        itemId,
        condition: v.condition,
        notes: v.notes || undefined,
      }))
      const r = await fetch(`/api/public/return/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditions: conditionsPayload, customerNotes: notes || undefined }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || "Falha")
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    )

  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-3 text-lg font-semibold">Não foi possível abrir</h1>
          <p className="mt-1 text-sm text-slate-600">{error}</p>
        </div>
      </div>
    )

  if (done || !data)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
          <h1 className="mt-3 text-lg font-semibold">Devolução registrada</h1>
          <p className="mt-1 text-sm text-slate-600">
            Obrigado! O operador irá conferir os equipamentos e finalizar o contrato.
          </p>
        </div>
      </div>
    )

  const primary = data.company.primaryColor || "#2563EB"

  return (
    <main className="min-h-screen bg-slate-50">
      <header style={{ backgroundColor: primary }} className="text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {data.company.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={data.company.logoUrl}
              alt={data.company.name}
              className="h-10 w-10 rounded bg-white object-contain p-1"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded bg-white/20">
              <Package className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold">{data.company.name}</h1>
            <p className="text-xs text-white/80">Devolução · Contrato #{data.rental.contractNumber}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            Olá, <strong>{data.customer.name}</strong>! Marque a condição de cada equipamento
            que você está devolvendo. O operador irá conferir e finalizar o contrato.
          </p>
        </section>

        <ul className="space-y-2">
          {data.items.map((item) => {
            const v = conditions[item.id] ?? { condition: "OK" as Condition, notes: "" }
            return (
              <li key={item.id} className="rounded-lg border bg-white p-3 shadow-sm">
                <div className="font-medium">{item.equipmentName}</div>
                <div className="mb-2 text-xs text-slate-500">
                  {item.equipmentCode} · {item.quantity}×
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setConditions((p) => ({ ...p, [item.id]: { ...v, condition: "OK" } }))
                    }
                    className={`flex-1 rounded border px-3 py-2 text-sm ${
                      v.condition === "OK"
                        ? "border-green-600 bg-green-50 text-green-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    ✓ Em ordem
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConditions((p) => ({ ...p, [item.id]: { ...v, condition: "DAMAGED" } }))
                    }
                    className={`flex-1 rounded border px-3 py-2 text-sm ${
                      v.condition === "DAMAGED"
                        ? "border-red-600 bg-red-50 text-red-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    ! Com avarias
                  </button>
                </div>
                {v.condition === "DAMAGED" && (
                  <textarea
                    placeholder="Descreva o problema"
                    value={v.notes}
                    onChange={(e) =>
                      setConditions((p) => ({
                        ...p,
                        [item.id]: { ...v, notes: e.target.value },
                      }))
                    }
                    className="mt-2 w-full rounded border border-slate-200 p-2 text-sm"
                    rows={2}
                  />
                )}
              </li>
            )
          })}
        </ul>

        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <label className="text-sm font-semibold">Observações finais (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Algum comentário pra a locadora?"
            className="mt-2 w-full rounded border border-slate-200 p-2 text-sm"
            rows={3}
          />
        </section>

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          style={{ backgroundColor: primary }}
          className="w-full rounded-lg px-4 py-3 font-semibold text-white shadow disabled:opacity-60"
        >
          {submitting ? "Enviando..." : "Confirmar devolução"}
        </button>
      </div>
    </main>
  )
}
