"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Package,
  Users,
  ClipboardList,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Wrench,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OnboardingChecklist } from "@/components/onboarding/checklist"

// Antes a tela inteira era "dados simulados" (48 equipamentos, 156 clientes,
// contratos de 2024) — o cliente via números que não eram dele. Agora tudo
// vem de /api/dashboard.

type ResumoLocacao = {
  id: string
  contractNumber: number
  status: string
  startDate: string
  expectedEndDate: string
  total: number | string
  customer: { name: string } | null
  items: { equipment: { name: string } | null }[]
}

type Dados = {
  equipment: { total: number; available: number; rented: number; maintenance: number }
  rentals: { total: number; active: number; overdue: number }
  // null quando o usuário não tem acesso ao financeiro (operador)
  revenue: { month: number; previousMonth: number; variation: number | null } | null
  customers: { total: number; withActiveRentals: number; pendingAmount: number | string | null }
  recentRentals: ResumoLocacao[]
  upcomingMaintenances: {
    id: string
    scheduledDate: string
    equipment: { name: string; code: string } | null
  }[]
  overdueRentals: ResumoLocacao[]
  endingSoon: ResumoLocacao[]
}

function formatCurrency(value: number | string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

function diasEntre(de: Date, ate: Date): number {
  return Math.max(0, Math.round((ate.getTime() - de.getTime()) / 86_400_000))
}

function getStatusBadge(status: string) {
  switch (status) {
    case "QUOTE":
      return <Badge variant="secondary">Orçamento</Badge>
    case "CONFIRMED":
      return <Badge variant="warning">Confirmada</Badge>
    case "IN_PROGRESS":
      return <Badge variant="info">Em andamento</Badge>
    case "OVERDUE":
      return <Badge variant="destructive">Atrasada</Badge>
    case "RETURNED":
      return <Badge variant="success">Devolvida</Badge>
    case "COMPLETED":
      return <Badge variant="success">Concluída</Badge>
    case "CANCELLED":
      return <Badge variant="secondary">Cancelada</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

type Alerta = { id: string; tipo: "atrasado" | "manutencao" | "vencimento"; mensagem: string; detalhe: string; href: string }

function montarAlertas(d: Dados): Alerta[] {
  const hoje = new Date()
  return [
    ...d.overdueRentals.map((r) => ({
      id: `atraso-${r.id}`,
      tipo: "atrasado" as const,
      mensagem: `Contrato #${r.contractNumber} atrasado há ${diasEntre(new Date(r.expectedEndDate), hoje)} dia(s)`,
      detalhe: r.customer?.name ?? "",
      href: "/locacoes",
    })),
    ...d.endingSoon.map((r) => ({
      id: `vence-${r.id}`,
      tipo: "vencimento" as const,
      mensagem: `Contrato #${r.contractNumber} vence em ${formatDate(r.expectedEndDate)}`,
      detalhe: r.customer?.name ?? "",
      href: "/locacoes",
    })),
    ...d.upcomingMaintenances.map((m) => ({
      id: `manut-${m.id}`,
      tipo: "manutencao" as const,
      mensagem: `Manutenção agendada para ${formatDate(m.scheduledDate)}`,
      detalhe: m.equipment ? `${m.equipment.name} (${m.equipment.code})` : "",
      href: "/manutencoes",
    })),
  ]
}

export default function DashboardPage() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async () => {
    setErro(false)
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      setDados(await res.json())
    } catch {
      setErro(true)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const alertas = dados ? montarAlertas(dados) : []
  const variacao = dados?.revenue?.variation ?? null

  return (
    <div className="space-y-6">
      <OnboardingChecklist />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral da sua locadora de equipamentos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/relatorios">Relatórios</Link>
          </Button>
          <Button asChild>
            <Link href="/locacoes?nova=1">Nova Locação</Link>
          </Button>
        </div>
      </div>

      {erro && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-red-800">Não foi possível carregar o painel</p>
              <p className="text-sm text-red-700">Confira a conexão e tente de novo.</p>
            </div>
            <Button variant="outline" onClick={carregar}>
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      )}

      {!dados && !erro && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      )}

      {dados && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/equipamentos">
              <Card className="h-full transition-colors hover:border-slate-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Equipamentos</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dados.equipment.total}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="text-green-600">{dados.equipment.available} disponíveis</span>
                    <span className="text-blue-600">{dados.equipment.rented} alugados</span>
                    <span className="text-yellow-600">{dados.equipment.maintenance} em manutenção</span>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/clientes">
              <Card className="h-full transition-colors hover:border-slate-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dados.customers.total}</div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {dados.customers.withActiveRentals} com locações ativas
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/locacoes">
              <Card className="h-full transition-colors hover:border-slate-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Locações Ativas</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dados.rentals.active}</div>
                  {dados.rentals.overdue > 0 && (
                    <p className="mt-2 text-xs text-red-600">{dados.rentals.overdue} atrasadas</p>
                  )}
                </CardContent>
              </Card>
            </Link>

            {dados.revenue && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento (Mês)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dados.revenue.month)}</div>
                <div className="mt-2 flex items-center gap-1 text-xs">
                  {variacao === null ? (
                    <span className="text-muted-foreground">sem movimento no mês anterior</span>
                  ) : variacao >= 0 ? (
                    <>
                      <ArrowUpRight className="h-3 w-3 text-green-600" />
                      <span className="text-green-600">
                        +{variacao.toLocaleString("pt-BR")}% vs mês anterior
                      </span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="h-3 w-3 text-red-600" />
                      <span className="text-red-600">{variacao.toLocaleString("pt-BR")}% vs mês anterior</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            )}
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Locações Recentes</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/locacoes">Ver todas</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {dados.recentRentals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma locação ainda.{" "}
                    <Link href="/locacoes?nova=1" className="font-medium text-primary underline">
                      Criar a primeira
                    </Link>
                  </p>
                ) : (
                  <div className="space-y-4">
                    {dados.recentRentals.map((locacao) => (
                      <div
                        key={locacao.id}
                        className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{locacao.contractNumber}</span>
                            {getStatusBadge(locacao.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{locacao.customer?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {locacao.items
                              .map((i) => i.equipment?.name)
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <p className="font-medium">{formatCurrency(locacao.total)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(locacao.startDate)} - {formatDate(locacao.expectedEndDate)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Alertas
                </CardTitle>
                <Badge variant={alertas.length > 0 ? "warning" : "secondary"}>{alertas.length}</Badge>
              </CardHeader>
              <CardContent>
                {alertas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nada pendente. 🎉</p>
                ) : (
                  <div className="space-y-4">
                    {alertas.map((alerta) => (
                      <Link
                        key={alerta.id}
                        href={alerta.href}
                        className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50"
                      >
                        {alerta.tipo === "atrasado" && <Clock className="h-5 w-5 flex-shrink-0 text-red-500" />}
                        {alerta.tipo === "manutencao" && <Wrench className="h-5 w-5 flex-shrink-0 text-yellow-500" />}
                        {alerta.tipo === "vencimento" && <Clock className="h-5 w-5 flex-shrink-0 text-blue-500" />}
                        <div className="space-y-1">
                          <p className="text-sm">{alerta.mensagem}</p>
                          <p className="text-xs text-muted-foreground">{alerta.detalhe}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Disponíveis</p>
                  <p className="text-2xl font-bold">{dados.equipment.available}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Alugados</p>
                  <p className="text-2xl font-bold">{dados.equipment.rented}</p>
                </div>
              </CardContent>
            </Card>

            {dados.customers.pendingAmount !== null && (
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                  <DollarSign className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">A receber</p>
                  <p className="text-2xl font-bold">{formatCurrency(dados.customers.pendingAmount)}</p>
                </div>
              </CardContent>
            </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}
