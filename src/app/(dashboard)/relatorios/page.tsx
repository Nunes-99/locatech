"use client"

import { useState, useEffect } from "react"
import {
  BarChart3,
  Package,
  Users,
  FileText,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Clock,
  DollarSign,
  Wrench,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  BarChart,
  Bar,
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

interface OverviewData {
  kpis: {
    equipamentos: number
    clientes: number
    locacoesAtivas: number
    manutencoesAtivas: number
    receitaTotal: number
    receitaMes: number
    taxaOcupacao: number
    taxaPagamento: number
  }
  alerts: {
    overdueRentals: number
    pendingPayments: number
    maintenancesPending: number
  }
}

interface EquipmentReport {
  total: number
  porStatus: {
    available: number
    rented: number
    maintenance: number
    reserved: number
  }
  taxaOcupacao: number
  topEquipamentos: Array<{
    id: string
    code: string
    name: string
    category: string
    totalRentals: number
    totalRevenue: number
    status: string
  }>
}

interface CustomersReport {
  total: number
  porCreditScore: {
    excellent: number
    good: number
    regular: number
    bad: number
  }
  topClientes: Array<{
    id: string
    name: string
    document: string
    totalRentals: number
    totalSpent: number
    totalPending: number
    creditScore: string
  }>
  comPendencias: number
  totalPendente: number
}

interface RentalsReport {
  total: number
  mesAtual: number
  anoAtual: number
  porStatus: Record<string, number>
  porMes: Array<{
    month: string
    locacoes: number
    receita: number
  }>
  receitaTotal: number
  receitaMesAtual: number
  taxaAtraso: number
  ultimasLocacoes: Array<{
    id: string
    contractNumber: number
    customer: string
    total: number
    status: string
    createdAt: string
  }>
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

const STATUS_COLORS = {
  AVAILABLE: "#22c55e",
  RENTED: "#3b82f6",
  MAINTENANCE: "#eab308",
  RESERVED: "#8b5cf6",
}

function getStatusBadge(status: string) {
  switch (status) {
    case "AVAILABLE":
      return <Badge className="bg-green-100 text-green-800">Disponivel</Badge>
    case "RENTED":
      return <Badge className="bg-blue-100 text-blue-800">Locado</Badge>
    case "MAINTENANCE":
      return <Badge className="bg-yellow-100 text-yellow-800">Manutencao</Badge>
    case "IN_PROGRESS":
      return <Badge className="bg-blue-100 text-blue-800">Em andamento</Badge>
    case "COMPLETED":
      return <Badge className="bg-green-100 text-green-800">Concluido</Badge>
    case "OVERDUE":
      return <Badge variant="destructive">Atrasado</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getCreditBadge(score: string) {
  switch (score) {
    case "EXCELLENT":
      return <Badge className="bg-green-100 text-green-800">Excelente</Badge>
    case "GOOD":
      return <Badge className="bg-blue-100 text-blue-800">Bom</Badge>
    case "REGULAR":
      return <Badge className="bg-yellow-100 text-yellow-800">Regular</Badge>
    case "BAD":
      return <Badge variant="destructive">Ruim</Badge>
    default:
      return <Badge variant="secondary">{score}</Badge>
  }
}

export default function RelatoriosPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [equipmentReport, setEquipmentReport] = useState<EquipmentReport | null>(null)
  const [customersReport, setCustomersReport] = useState<CustomersReport | null>(null)
  const [rentalsReport, setRentalsReport] = useState<RentalsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    fetchOverview()
  }, [])

  async function fetchOverview() {
    try {
      const response = await fetch("/api/reports?type=overview")
      if (response.ok) {
        const data = await response.json()
        setOverview(data)
      }
    } catch (error) {
      toast.error("Erro ao carregar relatorios")
    } finally {
      setLoading(false)
    }
  }

  async function fetchEquipmentReport() {
    if (equipmentReport) return
    try {
      const response = await fetch("/api/reports?type=equipment")
      if (response.ok) {
        const data = await response.json()
        setEquipmentReport(data)
      }
    } catch (error) {
      toast.error("Erro ao carregar relatorio")
    }
  }

  async function fetchCustomersReport() {
    if (customersReport) return
    try {
      const response = await fetch("/api/reports?type=customers")
      if (response.ok) {
        const data = await response.json()
        setCustomersReport(data)
      }
    } catch (error) {
      toast.error("Erro ao carregar relatorio")
    }
  }

  async function fetchRentalsReport() {
    if (rentalsReport) return
    try {
      const response = await fetch("/api/reports?type=rentals")
      if (response.ok) {
        const data = await response.json()
        setRentalsReport(data)
      }
    } catch (error) {
      toast.error("Erro ao carregar relatorio")
    }
  }

  function handleTabChange(value: string) {
    setActiveTab(value)
    if (value === "equipment") fetchEquipmentReport()
    if (value === "customers") fetchCustomersReport()
    if (value === "rentals") fetchRentalsReport()
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatorios</h1>
        <p className="text-muted-foreground">
          Analise o desempenho da sua empresa
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Visao Geral
          </TabsTrigger>
          <TabsTrigger value="equipment" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Equipamentos
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="rentals" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Locacoes
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {overview && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                        <Package className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{overview.kpis.equipamentos}</p>
                        <p className="text-xs text-muted-foreground">Equipamentos</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                        <Users className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{overview.kpis.clientes}</p>
                        <p className="text-xs text-muted-foreground">Clientes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                        <FileText className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{overview.kpis.locacoesAtivas}</p>
                        <p className="text-xs text-muted-foreground">Locacoes Ativas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                        <Wrench className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{overview.kpis.manutencoesAtivas}</p>
                        <p className="text-xs text-muted-foreground">Em Manutencao</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Financial KPIs */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Receitas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Receita Total</span>
                        <span className="text-xl font-bold">{formatCurrency(overview.kpis.receitaTotal)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Receita do Mes</span>
                        <span className="text-xl font-bold text-green-600">{formatCurrency(overview.kpis.receitaMes)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Taxa de Pagamento</span>
                        <span className="text-xl font-bold">{overview.kpis.taxaPagamento.toFixed(1)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Alertas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Locacoes Atrasadas</span>
                        <span className={`text-xl font-bold ${overview.alerts.overdueRentals > 0 ? "text-red-600" : ""}`}>
                          {overview.alerts.overdueRentals}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Pagamentos Pendentes</span>
                        <span className={`text-xl font-bold ${overview.alerts.pendingPayments > 0 ? "text-yellow-600" : ""}`}>
                          {overview.alerts.pendingPayments}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Manutencoes Agendadas</span>
                        <span className="text-xl font-bold">{overview.alerts.maintenancesPending}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Equipment Tab */}
        <TabsContent value="equipment" className="space-y-6">
          {equipmentReport && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total de Equipamentos</p>
                    <p className="text-2xl font-bold">{equipmentReport.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Taxa de Ocupacao</p>
                    <p className="text-2xl font-bold">{equipmentReport.taxaOcupacao.toFixed(1)}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Disponiveis</p>
                    <p className="text-2xl font-bold text-green-600">{equipmentReport.porStatus.available}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Status dos Equipamentos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Disponiveis", value: equipmentReport.porStatus.available, color: STATUS_COLORS.AVAILABLE },
                              { name: "Locados", value: equipmentReport.porStatus.rented, color: STATUS_COLORS.RENTED },
                              { name: "Manutencao", value: equipmentReport.porStatus.maintenance, color: STATUS_COLORS.MAINTENANCE },
                              { name: "Reservados", value: equipmentReport.porStatus.reserved, color: STATUS_COLORS.RESERVED },
                            ].filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="value"
                          >
                            {[
                              { color: STATUS_COLORS.AVAILABLE },
                              { color: STATUS_COLORS.RENTED },
                              { color: STATUS_COLORS.MAINTENANCE },
                              { color: STATUS_COLORS.RESERVED },
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Equipamentos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipamento</TableHead>
                          <TableHead className="text-right">Locacoes</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {equipmentReport.topEquipamentos.slice(0, 5).map((eq) => (
                          <TableRow key={eq.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{eq.code}</p>
                                <p className="text-sm text-muted-foreground">{eq.name}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{eq.totalRentals}</TableCell>
                            <TableCell className="text-right">{formatCurrency(eq.totalRevenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          {customersReport && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total de Clientes</p>
                    <p className="text-2xl font-bold">{customersReport.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Com Pendencias</p>
                    <p className="text-2xl font-bold text-yellow-600">{customersReport.comPendencias}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Pendente</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(customersReport.totalPendente)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Credito Excelente</p>
                    <p className="text-2xl font-bold text-green-600">{customersReport.porCreditScore.excellent}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Clientes por Faturamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Credito</TableHead>
                        <TableHead className="text-right">Locacoes</TableHead>
                        <TableHead className="text-right">Total Gasto</TableHead>
                        <TableHead className="text-right">Pendente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customersReport.topClientes.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{customer.name}</p>
                              <p className="text-sm text-muted-foreground">{customer.document}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getCreditBadge(customer.creditScore)}</TableCell>
                          <TableCell className="text-right">{customer.totalRentals}</TableCell>
                          <TableCell className="text-right">{formatCurrency(customer.totalSpent)}</TableCell>
                          <TableCell className="text-right">
                            {customer.totalPending > 0 ? (
                              <span className="text-red-600">{formatCurrency(customer.totalPending)}</span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Rentals Tab */}
        <TabsContent value="rentals" className="space-y-6">
          {rentalsReport && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total de Locacoes</p>
                    <p className="text-2xl font-bold">{rentalsReport.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Receita Total</p>
                    <p className="text-2xl font-bold">{formatCurrency(rentalsReport.receitaTotal)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Receita do Mes</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(rentalsReport.receitaMesAtual)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Taxa de Atraso</p>
                    <p className={`text-2xl font-bold ${rentalsReport.taxaAtraso > 10 ? "text-red-600" : ""}`}>
                      {rentalsReport.taxaAtraso.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Locacoes por Mes (Ultimos 12 meses)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rentalsReport.porMes}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                        <Tooltip
                          formatter={(value: number, name: string) =>
                            name === "receita" ? formatCurrency(value) : value
                          }
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="locacoes" name="Locacoes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ultimas Locacoes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contrato</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentalsReport.ultimasLocacoes.map((rental) => (
                        <TableRow key={rental.id}>
                          <TableCell className="font-medium">
                            LOC-{rental.contractNumber.toString().padStart(4, "0")}
                          </TableCell>
                          <TableCell>{rental.customer}</TableCell>
                          <TableCell>{formatDate(rental.createdAt)}</TableCell>
                          <TableCell>{getStatusBadge(rental.status)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(rental.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
