"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { CheckCircle2, AlertCircle, Loader2, Package } from "lucide-react"
import { SignaturePad } from "@/components/signature-pad"

interface HandoverData {
  company: { name: string; logoUrl: string | null; primaryColor: string | null }
  customer: { name: string; document: string }
  rental: {
    id: string
    contractNumber: number
    startDate: string
    expectedEndDate: string
    total: number
    depositAmount: number
    type: "DELIVERY" | "PICKUP"
    deliveryAddress: string | null
  }
  items: Array<{
    equipmentCode: string
    equipmentName: string
    quantity: number
    days: number
    subtotal: number
  }>
  expiresAt: string | null
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export default function HandoverPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const [data, setData] = useState<HandoverData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/public/handover/${params.token}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error || `Erro ${r.status}`)
        }
        return r.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [params.token])

  async function confirm() {
    setSubmitting(true)
    try {
      const r = await fetch(`/api/public/handover/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl: signature }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || "Falha ao confirmar")
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-3 text-lg font-semibold">Não foi possível abrir</h1>
          <p className="mt-1 text-sm text-slate-600">{error}</p>
          <p className="mt-3 text-xs text-slate-500">
            Procure o operador da locadora pra gerar um novo QR.
          </p>
        </div>
      </div>
    )
  }

  if (done || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
          <h1 className="mt-3 text-lg font-semibold">Entrega confirmada!</h1>
          <p className="mt-1 text-sm text-slate-600">
            Obrigado por confirmar. Em caso de dúvidas, contate a locadora.
          </p>
        </div>
      </div>
    )
  }

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
            <p className="text-xs text-white/80">Confirmação de entrega</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Contrato #{data.rental.contractNumber}</h2>
          <p className="text-sm text-slate-600">
            Locatário: <strong>{data.customer.name}</strong>{" "}
            <span className="text-slate-400">({data.customer.document})</span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-xs text-slate-500">Início</div>
              <div>{new Date(data.rental.startDate).toLocaleDateString("pt-BR")}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Devolução prevista</div>
              <div>{new Date(data.rental.expectedEndDate).toLocaleDateString("pt-BR")}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Total</div>
              <div className="font-semibold">{BRL.format(data.rental.total)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Caução</div>
              <div>{BRL.format(data.rental.depositAmount)}</div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold">Equipamentos a receber</h3>
          <ul className="divide-y">
            {data.items.map((item, i) => (
              <li key={i} className="flex items-start justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{item.equipmentName}</div>
                  <div className="text-xs text-slate-500">
                    {item.equipmentCode} · {item.quantity}× · {item.days} dia(s)
                  </div>
                </div>
                <span className="text-sm">{BRL.format(item.subtotal)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Assinatura do locatário</h3>
          <p className="mt-1 text-xs text-slate-500">
            Sua assinatura registra o recebimento dos equipamentos descritos acima.
          </p>
          <SignaturePad onChange={setSignature} className="mt-3" />
        </section>

        <button
          type="button"
          onClick={confirm}
          disabled={submitting}
          style={{ backgroundColor: primary }}
          className="w-full rounded-lg px-4 py-3 font-semibold text-white shadow disabled:opacity-60"
        >
          {submitting ? "Confirmando..." : "Confirmar recebimento"}
        </button>

        <p className="px-2 text-center text-xs text-slate-500">
          Ao confirmar, você declara ter recebido os equipamentos listados em bom estado.
        </p>
      </div>
    </main>
  )
}
