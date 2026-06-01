"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Circle, X, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Status {
  completed: boolean
  progress: number
  total: number
  steps: {
    companyProfile: boolean
    firstCategory: boolean
    firstEquipment: boolean
    firstCustomer: boolean
    firstRental: boolean
  }
}

const STEPS: Array<{
  key: keyof Status["steps"]
  title: string
  description: string
  href: string
}> = [
  {
    key: "companyProfile",
    title: "Complete o cadastro da empresa",
    description: "CNPJ, telefone e endereço aparecem nos contratos.",
    href: "/configuracoes",
  },
  {
    key: "firstCategory",
    title: "Crie uma categoria de equipamentos",
    description: "Andaimes, betoneiras, compactadores… organize por tipo.",
    href: "/equipamentos",
  },
  {
    key: "firstEquipment",
    title: "Cadastre o primeiro equipamento",
    description: "Adicione código, valor da diária e foto.",
    href: "/equipamentos",
  },
  {
    key: "firstCustomer",
    title: "Cadastre o primeiro cliente",
    description: "CPF/CNPJ é validado e o CEP busca endereço sozinho.",
    href: "/clientes",
  },
  {
    key: "firstRental",
    title: "Registre a primeira locação",
    description: "Selecione equipamentos, defina prazo e gere o contrato.",
    href: "/locacoes",
  },
]

const LOCAL_STORAGE_KEY = "locatech-onboarding-dismissed"

export function OnboardingChecklist() {
  const [status, setStatus] = useState<Status | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setDismissed(localStorage.getItem(LOCAL_STORAGE_KEY) === "1")
    fetch("/api/onboarding/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatus(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleDismiss() {
    localStorage.setItem(LOCAL_STORAGE_KEY, "1")
    setDismissed(true)
  }

  if (loading || !status || status.completed || dismissed) return null

  const percent = Math.round((status.progress / status.total) * 100)

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm dark:from-blue-950/30 dark:to-transparent">
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Configure sua locadora em 5 passos</h2>
              <p className="text-sm text-muted-foreground">
                {status.progress} de {status.total} concluídos · {percent}%
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Ocultar"
            title="Ocultar (você pode retomar quando quiser)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/30">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>

        <ul className="space-y-2">
          {STEPS.map((step) => {
            const done = status.steps[step.key]
            return (
              <li
                key={step.key}
                className={`flex items-start gap-3 rounded-lg p-2 transition-colors ${
                  done ? "opacity-60" : "hover:bg-blue-100/40 dark:hover:bg-blue-900/20"
                }`}
              >
                <div className="mt-0.5">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className={done ? "line-through" : "font-medium"}>{step.title}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
                {!done && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={step.href}>Ir</Link>
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
