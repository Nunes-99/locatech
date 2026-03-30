"use client"

import { useState, useEffect } from "react"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PiggyBank,
  Wrench,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

interface FinancialData {
  period: string
  totalReceitas: number
  totalPendente: number
  totalVencido: number
  totalManutencoes: number
  totalCaucao: number
  lucroLiquido: number
  locacoesNovas: number
  locacoesAtivas: number
  ticketMedio: number
  porStatus: {
    paid: number
    pending: number
    partial: number
    overdue: number
  }
  receitasPorDia: Array<{
    date: string
    total: number
  }>
  totalHistorico: number
  locacoesHistorico: number
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

const COLORS = ["#22c55e", "#eab308", "#3b82f6", "#ef4444"]

export default function FinanceiroPage() {
  const [data, setData] = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("month")

  useEffect(() => {
    fetchData()
  }, [period])

  async function fetchData() {
    try {
      const response = await fetch(`/api/financial?period=${period}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error("Error fetching financial data:", error)
      toast.error("Erro ao carregar dados financeiros")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Erro ao carregar dados</p>
      </div>
    )
  }

  const pieData = [
    { name: "Pago", value: data.porStatus.paid, color: "#22c55e" },
    { name: "Pendente", value: data.porStatus.pending, color: "#eab308" },
    { name: "Parcial", value: data.porStatus.partial, color: "#3b82f6" },
    { name: "Vencido", value: data.porStatus.overdue, color: "#ef4444" },
  ].filter(item => item.value > 0)

  const periodLabels: Record<string, string> = {
    week: "Esta Semana",
    month: "Este Mes",
    year: "Este Ano",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-muted-foreground">
            Acompanhe as financas da sua empresa
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mes</SelectItem>
            <SelectItem value="year">Este Ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-green-600" />
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold">{formatCurrency(data.totalReceitas)}</p>
              <p className="text-xs text-muted-foreground">Receitas ({periodLabels[period]})</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold">{formatCurrency(data.totalPendente)}</p>
              <p className="text-xs text-muted-foreground">Pendente</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              {data.totalVencido > 0 && (
                <ArrowDownRight className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold">{formatCurrency(data.totalVencido)}</p>
              <p className="text-xs text-muted-foreground">Vencido</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold">{formatCurrency(data.lucroLiquido)}</p>
              <p className="text-xs text-muted-foreground">Lucro Liquido</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Wallet className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{formatCurrency(data.ticketMedio)}</p>
                <p className="text-xs text-muted-foreground">Ticket Medio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                <PiggyBank className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{formatCurrency(data.totalCaucao)}</p>
                <p className="text-xs text-muted-foreground">Caucoes Retidas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <Wrench className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{formatCurrency(data.totalManutencoes)}</p>
                <p className="text-xs text-muted-foreground">Custo Manutencoes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100">
                <TrendingUp className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{data.locacoesNovas}</p>
                <p className="text-xs text-muted-foreground">Novas Locacoes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Receitas - Ultimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.receitasPorDia}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={formatDate}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    fill="url(#colorTotal)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-muted-foreground">Sem dados no periodo</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historical Data */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totais Historicos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Receita Total</span>
                <span className="text-xl font-bold">{formatCurrency(data.totalHistorico)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Locacoes Realizadas</span>
                <span className="text-xl font-bold">{data.locacoesHistorico}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ticket Medio Historico</span>
                <span className="text-xl font-bold">
                  {formatCurrency(data.locacoesHistorico > 0 ? data.totalHistorico / data.locacoesHistorico : 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo do Periodo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Locacoes Ativas</span>
                <span className="text-xl font-bold">{data.locacoesAtivas}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pagamentos Realizados</span>
                <span className="text-xl font-bold text-green-600">{data.porStatus.paid}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pagamentos Pendentes</span>
                <span className="text-xl font-bold text-yellow-600">
                  {data.porStatus.pending + data.porStatus.partial}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pagamentos Vencidos</span>
                <span className="text-xl font-bold text-red-600">{data.porStatus.overdue}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
