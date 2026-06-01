"use client"

import { useState, useEffect, useCallback } from "react"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wrench,
  PiggyBank,
  Trophy,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface MonthRow {
  month: string
  revenue: number
  cost: number
  profit: number
  margin: number
  rentals: number
}

interface EquipmentRow {
  equipmentId: string
  code: string
  name: string
  brand: string | null
  revenue: number
  cost: number
  profit: number
  margin: number
  rentals: number
}

interface ProfitData {
  period: { months: number; since: string }
  totals: {
    revenue: number
    cost: number
    profit: number
    margin: number
    rentals: number
    averageTicket: number
  }
  evolution: MonthRow[]
  topByRevenue: EquipmentRow[]
  topByMargin: EquipmentRow[]
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const PERCENT = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(n)

function formatMonth(key: string): string {
  const [year, month] = key.split("-")
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
}

export default function LucroPage() {
  const [data, setData] = useState<ProfitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState("12")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/financial/profit?months=${months}`)
      if (!response.ok) {
        if (response.status === 403) {
          toast.error("Sem permissão para ver dados financeiros")
          return
        }
        throw new Error("Erro ao buscar dados")
      }
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error(error)
      toast.error("Erro ao carregar dados de lucro")
    } finally {
      setLoading(false)
    }
  }, [months])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) return null

  const evolutionChart = data.evolution.map((m) => ({
    label: formatMonth(m.month),
    Receita: m.revenue,
    Custo: m.cost,
    Lucro: m.profit,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lucro</h1>
          <p className="text-sm text-muted-foreground">
            Receita, custos de manutenção, lucro bruto e margem.
          </p>
        </div>
        <Select value={months} onValueChange={setMonths}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Últimos 12 meses</SelectItem>
            <SelectItem value="24">Últimos 24 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard
          title="Receita"
          value={BRL.format(data.totals.revenue)}
          icon={<DollarSign className="h-5 w-5" />}
          color="text-green-600"
        />
        <KpiCard
          title="Custos (manutenção)"
          value={BRL.format(data.totals.cost)}
          icon={<Wrench className="h-5 w-5" />}
          color="text-orange-600"
        />
        <KpiCard
          title="Lucro Bruto"
          value={BRL.format(data.totals.profit)}
          icon={data.totals.profit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          color={data.totals.profit >= 0 ? "text-blue-600" : "text-red-600"}
        />
        <KpiCard
          title="Margem"
          value={PERCENT(data.totals.margin)}
          icon={<PiggyBank className="h-5 w-5" />}
          color="text-purple-600"
          subtitle={`Ticket médio ${BRL.format(data.totals.averageTicket)} · ${data.totals.rentals} locações`}
        />
      </div>

      {/* Gráfico evolução */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={evolutionChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(v) => BRL.format(v as number).replace("R$", "").trim()} />
              <Tooltip
                formatter={(value: number) => BRL.format(value)}
              />
              <Legend />
              <Bar dataKey="Receita" fill="#22c55e" />
              <Bar dataKey="Custo" fill="#f97316" />
              <Line type="monotone" dataKey="Lucro" stroke="#2563eb" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top tabelas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              Top 10 por Receita
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TopTable rows={data.topByRevenue} sortLabel="Receita" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              Top 10 por Margem
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TopTable rows={data.topByMargin} sortLabel="Margem" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string
  value: string
  icon: React.ReactNode
  color: string
  subtitle?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className={color}>{icon}</span>
        </div>
        <div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div>
        {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
      </CardContent>
    </Card>
  )
}

function TopTable({ rows, sortLabel }: { rows: EquipmentRow[]; sortLabel: string }) {
  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Sem dados no período selecionado.
      </div>
    )
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Equipamento</TableHead>
          <TableHead className="text-right">Receita</TableHead>
          <TableHead className="text-right">Custo</TableHead>
          <TableHead className="text-right">Lucro</TableHead>
          <TableHead className="text-right">Margem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.equipmentId}>
            <TableCell>
              <div className="font-medium">{r.code}</div>
              <div className="text-xs text-muted-foreground">{r.name}</div>
            </TableCell>
            <TableCell className="text-right">{BRL.format(r.revenue)}</TableCell>
            <TableCell className="text-right text-orange-600">{BRL.format(r.cost)}</TableCell>
            <TableCell className={`text-right font-medium ${r.profit >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {BRL.format(r.profit)}
            </TableCell>
            <TableCell className="text-right">{PERCENT(r.margin)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
