"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  FileText,
  TrendingUp,
  XCircle,
  Clock,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Settings,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

interface MonthRow {
  month: string
  total: number
  iss: number
  issued: number
  rejected: number
  cancelled: number
  pending: number
}

interface TopInvoice {
  id: string
  number: string | null
  amount: number
  status: string
  issuedAt: string | null
  contractNumber: number | null
  customerName: string | null
}

interface Dashboard {
  period: { months: number; since: string }
  taxConfig: {
    cnpj: string
    provider: string
    providerEnv: string
    autoIssue: boolean
  } | null
  totals: {
    invoicesCount: number
    issued: number
    rejected: number
    cancelled: number
    pending: number
    totalAmount: number
    totalIss: number
    rejectionRate: number
  }
  byType: { NFSE: number; NFE_55: number }
  evolution: MonthRow[]
  topInvoices: TopInvoice[]
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const PERCENT = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(n)

function formatMonth(key: string): string {
  const [year, month] = key.split("-")
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  })
}

export default function FiscalDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState("12")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/invoices/dashboard?months=${months}`)
      if (!response.ok) {
        if (response.status === 403) {
          toast.error("Sem permissão")
          return
        }
        throw new Error("Erro")
      }
      setData(await response.json())
    } catch {
      toast.error("Erro ao carregar dashboard fiscal")
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

  const chartData = data.evolution.map((m) => ({
    label: formatMonth(m.month),
    Emitidas: m.issued,
    Rejeitadas: m.rejected,
    Valor: m.total,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/notas">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Dashboard Fiscal</h1>
            <p className="text-sm text-muted-foreground">
              Visão das notas emitidas, ISS retido e status do provider.
            </p>
          </div>
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

      {!data.taxConfig && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:bg-yellow-950/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              Configuração fiscal ausente.{" "}
              <Link href="/configuracoes/fiscal" className="font-medium underline">
                Configure agora
              </Link>{" "}
              pra começar a emitir notas.
            </div>
          </div>
        </div>
      )}

      {data.taxConfig && (
        <Card className="border-blue-200 bg-blue-50/40 dark:bg-blue-950/20">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <Settings className="h-4 w-4 text-blue-700" />
            <span>
              Provider: <strong>{data.taxConfig.provider}</strong>
            </span>
            <Badge variant={data.taxConfig.providerEnv === "production" ? "success" : "warning"}>
              {data.taxConfig.providerEnv}
            </Badge>
            {data.taxConfig.autoIssue && (
              <Badge variant="info">Emissão automática ON</Badge>
            )}
            <span className="text-muted-foreground">CNPJ: {data.taxConfig.cnpj}</span>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi
          label="Notas emitidas"
          value={String(data.totals.issued)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="text-green-600"
        />
        <Kpi
          label="Valor total"
          value={BRL.format(data.totals.totalAmount)}
          icon={<TrendingUp className="h-4 w-4" />}
          color="text-blue-600"
        />
        <Kpi
          label="ISS retido"
          value={BRL.format(data.totals.totalIss)}
          icon={<FileText className="h-4 w-4" />}
          color="text-purple-600"
        />
        <Kpi
          label="Taxa de rejeição"
          value={PERCENT(data.totals.rejectionRate)}
          icon={<XCircle className="h-4 w-4" />}
          color={data.totals.rejectionRate > 0.05 ? "text-red-600" : "text-slate-600"}
          subtitle={`${data.totals.rejected} rejeitadas · ${data.totals.cancelled} canceladas`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi
          label="NFS-e"
          value={String(data.byType.NFSE)}
          icon={<FileText className="h-4 w-4" />}
        />
        <Kpi
          label="NF-e 55"
          value={String(data.byType.NFE_55)}
          icon={<FileText className="h-4 w-4" />}
        />
        <Kpi
          label="Pendentes"
          value={String(data.totals.pending)}
          icon={<Clock className="h-4 w-4" />}
          color="text-yellow-600"
        />
        <Kpi
          label="Total no período"
          value={String(data.totals.invoicesCount)}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis yAxisId="count" />
              <YAxis yAxisId="value" orientation="right" tickFormatter={(v) => BRL.format(v as number).replace("R$", "").trim()} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === "Valor" ? BRL.format(value) : value
                }
              />
              <Legend />
              <Bar yAxisId="count" dataKey="Emitidas" fill="#22c55e" />
              <Bar yAxisId="count" dataKey="Rejeitadas" fill="#ef4444" />
              <Line yAxisId="value" type="monotone" dataKey="Valor" stroke="#2563eb" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top notas */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 notas por valor</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.topInvoices.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sem notas no período.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.number || "—"}</TableCell>
                    <TableCell>{inv.contractNumber ? `#${inv.contractNumber}` : "—"}</TableCell>
                    <TableCell>{inv.customerName || "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {BRL.format(inv.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{inv.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Kpi({
  label,
  value,
  icon,
  color = "text-slate-700",
  subtitle,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color?: string
  subtitle?: string
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={color}>{icon}</span>
        </div>
        <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
        {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
      </CardContent>
    </Card>
  )
}
