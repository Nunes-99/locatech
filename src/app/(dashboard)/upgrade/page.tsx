"use client"

import { useState, useEffect } from "react"
import { Check, Loader2, Zap, Crown, Rocket } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { PLAN_LIMITS, PLAN_PRICES, PLAN_NAMES } from "@/lib/plan-limits"

interface CompanyInfo {
  plan: "FREE" | "STARTER" | "PRO"
  equipmentCount: number
  userCount: number
  customerCount: number
}

const PLAN_ICONS = {
  FREE: Zap,
  STARTER: Rocket,
  PRO: Crown,
}

const PLAN_COLORS = {
  FREE: "bg-slate-100 text-slate-600",
  STARTER: "bg-blue-100 text-blue-600",
  PRO: "bg-purple-100 text-purple-600",
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export default function UpgradePage() {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)

  useEffect(() => {
    fetchCompanyInfo()
  }, [])

  async function fetchCompanyInfo() {
    try {
      const response = await fetch("/api/company/usage")
      if (response.ok) {
        const data = await response.json()
        setCompanyInfo(data)
      }
    } catch (error) {
      console.error("Error fetching company info:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpgrade(plan: "STARTER" | "PRO") {
    setUpgrading(plan)
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })

      if (!response.ok) {
        throw new Error("Erro ao iniciar checkout")
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      toast.error("Erro ao iniciar processo de upgrade")
      setUpgrading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const currentPlan = companyInfo?.plan || "FREE"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Escolha seu Plano</h1>
        <p className="text-muted-foreground mt-2">
          Desbloqueie recursos avançados e expanda seu negócio
        </p>
      </div>

      {/* Current Usage */}
      {companyInfo && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-lg">Seu Uso Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{companyInfo.equipmentCount}</p>
                <p className="text-sm text-muted-foreground">
                  de {PLAN_LIMITS[currentPlan].maxEquipment === Infinity ? "∞" : PLAN_LIMITS[currentPlan].maxEquipment} equipamentos
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold">{companyInfo.userCount}</p>
                <p className="text-sm text-muted-foreground">
                  de {PLAN_LIMITS[currentPlan].maxUsers} usuários
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold">{companyInfo.customerCount}</p>
                <p className="text-sm text-muted-foreground">
                  de {PLAN_LIMITS[currentPlan].maxCustomers === Infinity ? "∞" : PLAN_LIMITS[currentPlan].maxCustomers} clientes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
        {(["FREE", "STARTER", "PRO"] as const).map((plan) => {
          const Icon = PLAN_ICONS[plan]
          const limits = PLAN_LIMITS[plan]
          const price = PLAN_PRICES[plan]
          const isCurrentPlan = currentPlan === plan
          const isDowngrade = (currentPlan === "PRO" && plan !== "PRO") ||
                              (currentPlan === "STARTER" && plan === "FREE")

          return (
            <Card
              key={plan}
              className={`relative ${isCurrentPlan ? "border-2 border-primary" : ""} ${
                plan === "PRO" ? "shadow-lg" : ""
              }`}
            >
              {plan === "PRO" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-purple-600 to-blue-600">
                    Mais Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pt-8">
                <div className={`mx-auto w-12 h-12 rounded-full ${PLAN_COLORS[plan]} flex items-center justify-center mb-4`}>
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle>{PLAN_NAMES[plan]}</CardTitle>
                <CardDescription>
                  {plan === "FREE" && "Para começar"}
                  {plan === "STARTER" && "Para crescer"}
                  {plan === "PRO" && "Para profissionais"}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {price === 0 ? "Grátis" : formatCurrency(price)}
                  </span>
                  {price > 0 && <span className="text-muted-foreground">/mês</span>}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>
                      {limits.maxEquipment === Infinity ? "Equipamentos ilimitados" : `${limits.maxEquipment} equipamentos`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>{limits.maxUsers} usuário{limits.maxUsers > 1 ? "s" : ""}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>
                      {limits.maxCustomers === Infinity ? "Clientes ilimitados" : `${limits.maxCustomers} clientes`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Contratos PDF</span>
                  </li>
                  {limits.features.whatsapp && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span>WhatsApp automático</span>
                    </li>
                  )}
                  {limits.features.email && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Notificações por email</span>
                    </li>
                  )}
                  {limits.features.advancedReports && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Relatórios avançados</span>
                    </li>
                  )}
                  {limits.features.exportExcel && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Exportar para Excel</span>
                    </li>
                  )}
                  {limits.features.customBranding && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Marca personalizada</span>
                    </li>
                  )}
                  {limits.features.api && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Acesso à API</span>
                    </li>
                  )}
                </ul>
              </CardContent>

              <CardFooter>
                {isCurrentPlan ? (
                  <Button className="w-full" disabled variant="outline">
                    Plano Atual
                  </Button>
                ) : isDowngrade ? (
                  <Button className="w-full" disabled variant="outline">
                    Plano Inferior
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan === "PRO" ? "default" : "outline"}
                    onClick={() => handleUpgrade(plan as "STARTER" | "PRO")}
                    disabled={upgrading !== null}
                  >
                    {upgrading === plan ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {plan === "FREE" ? "Voltar para Grátis" : "Fazer Upgrade"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* FAQ */}
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Perguntas Frequentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium">Posso cancelar a qualquer momento?</h4>
            <p className="text-sm text-muted-foreground">
              Sim, você pode cancelar seu plano a qualquer momento. Seu acesso continua até o fim do período pago.
            </p>
          </div>
          <div>
            <h4 className="font-medium">Como funciona o trial?</h4>
            <p className="text-sm text-muted-foreground">
              Novos usuários têm 14 dias de teste gratuito do plano Starter.
            </p>
          </div>
          <div>
            <h4 className="font-medium">Aceita quais formas de pagamento?</h4>
            <p className="text-sm text-muted-foreground">
              Aceitamos cartão de crédito, débito, PIX e boleto bancário.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
