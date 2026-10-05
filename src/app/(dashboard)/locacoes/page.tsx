"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Eye,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  RotateCcw,
  Calendar,
  DollarSign,
  Loader2,
  Package,
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SkeletonTable } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

interface Equipment {
  id: string
  code: string
  name: string
  dailyRate: number
  status: string
}

interface Customer {
  id: string
  name: string
  document: string
  phone: string
  isBlocked: boolean
}

interface RentalItem {
  id: string
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  dailyRate: number
  days: number
  subtotal: number
  equipment: Equipment
}

interface Rental {
  id: string
  contractNumber: number
  customerId: string
  customer: Customer
  startDate: string
  expectedEndDate: string
  actualEndDate?: string
  type: "DELIVERY" | "PICKUP"
  deliveryAddress?: string
  status: "QUOTE" | "CONFIRMED" | "IN_PROGRESS" | "OVERDUE" | "RETURNED" | "COMPLETED" | "CANCELLED"
  paymentStatus: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE"
  subtotal: number
  deliveryFee: number
  total: number
  depositAmount: number
  notes?: string
  items: RentalItem[]
  createdAt: string
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

function getStatusBadge(status: string) {
  switch (status) {
    case "QUOTE":
      return <Badge variant="secondary">Orcamento</Badge>
    case "CONFIRMED":
      return <Badge className="bg-blue-100 text-blue-800">Confirmado</Badge>
    case "IN_PROGRESS":
      return <Badge className="bg-blue-100 text-blue-800">Em andamento</Badge>
    case "OVERDUE":
      return <Badge variant="destructive">Atrasado</Badge>
    case "RETURNED":
      return <Badge className="bg-yellow-100 text-yellow-800">Devolvido</Badge>
    case "COMPLETED":
      return <Badge className="bg-green-100 text-green-800">Concluido</Badge>
    case "CANCELLED":
      return <Badge variant="secondary">Cancelado</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getPaymentBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>
    case "PARTIAL":
      return <Badge className="bg-blue-100 text-blue-800">Parcial</Badge>
    case "PAID":
      return <Badge className="bg-green-100 text-green-800">Pago</Badge>
    case "OVERDUE":
      return <Badge variant="destructive">Vencido</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function LocacoesPage() {
  return (
    <Suspense>
      <LocacoesPageConteudo />
    </Suspense>
  )
}

function LocacoesPageConteudo() {
  const [rentals, setRentals] = useState<Rental[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("todas")

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false)
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    customerId: "",
    startDate: "",
    expectedEndDate: "",
    type: "PICKUP" as "DELIVERY" | "PICKUP",
    deliveryAddress: "",
    depositAmount: 0,
    notes: "",
    items: [] as { equipmentId: string; days: number; dailyRate: number }[],
  })

  // Return form state
  const [returnData, setReturnData] = useState({
    returnNotes: "",
    damageDescription: "",
    damageCost: 0,
    additionalCost: 0,
  })

  // Atalho "Nova Locação" do dashboard chega com ?nova=1
  const searchParams = useSearchParams()
  const router = useRouter()
  useEffect(() => {
    if (searchParams.get("nova") === "1") {
      setIsCreateDialogOpen(true)
      router.replace("/locacoes")
    }
  }, [searchParams, router])

  useEffect(() => {
    fetchData()
  }, [statusFilter])

  async function fetchData() {
    try {
      const [rentalsRes, customersRes, equipmentRes] = await Promise.all([
        fetch(`/api/rentals${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
        fetch("/api/customers"),
        fetch("/api/equipment"),
      ])

      if (rentalsRes.ok) {
        const data = await rentalsRes.json()
        setRentals(data)
      }
      if (customersRes.ok) {
        const data = await customersRes.json()
        setCustomers(data.filter((c: Customer) => !c.isBlocked))
      }
      if (equipmentRes.ok) {
        const data = await equipmentRes.json()
        setEquipment(data.filter((e: Equipment) => e.status === "AVAILABLE"))
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }

  const filteredRentals = rentals.filter((rental) => {
    const matchesSearch =
      rental.contractNumber.toString().includes(search) ||
      rental.customer.name.toLowerCase().includes(search.toLowerCase())

    if (activeTab === "ativas") {
      return matchesSearch && ["IN_PROGRESS", "OVERDUE"].includes(rental.status)
    }
    if (activeTab === "atrasadas") {
      return matchesSearch && rental.status === "OVERDUE"
    }
    if (activeTab === "finalizadas") {
      return matchesSearch && ["RETURNED", "COMPLETED"].includes(rental.status)
    }
    return matchesSearch
  })

  const stats = {
    total: rentals.length,
    ativas: rentals.filter((r) => ["IN_PROGRESS", "OVERDUE"].includes(r.status)).length,
    atrasadas: rentals.filter((r) => r.status === "OVERDUE").length,
    valorTotal: rentals.reduce((sum, r) => sum + r.total, 0),
  }

  function resetForm() {
    setFormData({
      customerId: "",
      startDate: "",
      expectedEndDate: "",
      type: "PICKUP",
      deliveryAddress: "",
      depositAmount: 0,
      notes: "",
      items: [],
    })
  }

  function addEquipmentToRental(equipmentId: string) {
    const eq = equipment.find((e) => e.id === equipmentId)
    if (!eq || formData.items.some((i) => i.equipmentId === equipmentId)) return

    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { equipmentId, days: 1, dailyRate: eq.dailyRate },
      ],
    })
  }

  function removeEquipmentFromRental(equipmentId: string) {
    setFormData({
      ...formData,
      items: formData.items.filter((i) => i.equipmentId !== equipmentId),
    })
  }

  // Diárias saem das datas (como no servidor): antes cada item tinha um campo
  // "dias" que começava em 1 e, esquecido, cobrava 1 diária por 30 dias de aluguel
  function diariasDoPeriodo(): number | null {
    if (!formData.startDate || !formData.expectedEndDate) return null
    const ms = new Date(formData.expectedEndDate).getTime() - new Date(formData.startDate).getTime()
    if (!(ms > 0)) return null
    return Math.max(1, Math.ceil(ms / 86_400_000))
  }

  function calculateSubtotal(): number {
    const diarias = diariasDoPeriodo() ?? 0
    return formData.items.reduce((sum, item) => sum + item.dailyRate * diarias, 0)
  }

  async function handleCreateRental(e: React.FormEvent) {
    e.preventDefault()
    if (formData.items.length === 0) {
      toast.error("Adicione pelo menos um equipamento")
      return
    }
    const diarias = diariasDoPeriodo()
    if (diarias === null) {
      toast.error("A data fim precisa ser depois da data de início")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          items: formData.items.map((i) => ({ ...i, days: diarias })),
        }),
      })

      if (response.ok) {
        toast.success("Locação criada com sucesso!")
        setIsCreateDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Erro ao criar locacao")
      }
    } catch (error) {
      toast.error("Erro ao criar locacao")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateStatus(rental: Rental, newStatus: string) {
    try {
      const response = await fetch(`/api/rentals/${rental.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        toast.success("Status atualizado!")
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Erro ao atualizar status")
      }
    } catch (error) {
      toast.error("Erro ao atualizar status")
    }
  }

  async function handleUpdatePayment(rental: Rental, paymentStatus: string) {
    try {
      const response = await fetch(`/api/rentals/${rental.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus }),
      })

      if (response.ok) {
        toast.success("Pagamento atualizado!")
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Erro ao atualizar pagamento")
      }
    } catch (error) {
      toast.error("Erro ao atualizar pagamento")
    }
  }

  async function handleReturn(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRental) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/rentals/${selectedRental.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(returnData),
      })

      if (response.ok) {
        toast.success("Devolucao registrada com sucesso!")
        setIsReturnDialogOpen(false)
        setReturnData({ returnNotes: "", damageDescription: "", damageCost: 0, additionalCost: 0 })
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Erro ao registrar devolucao")
      }
    } catch (error) {
      toast.error("Erro ao registrar devolucao")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownloadContract(rentalId: string, contractNumber: number) {
    try {
      toast.info("Gerando contrato PDF...")
      const response = await fetch(`/api/rentals/${rentalId}/contract`)

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `contrato-LOC-${contractNumber.toString().padStart(4, "0")}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        toast.success("Contrato gerado com sucesso!")
      } else {
        const error = await response.json()
        toast.error(error.error || "Erro ao gerar contrato")
      }
    } catch (error) {
      toast.error("Erro ao gerar contrato")
    }
  }

  if (loading) {
    return <SkeletonTable rows={8} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locacoes</h1>
          <p className="text-muted-foreground">
            Gerencie as locacoes de equipamentos
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Locacao
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <FileText className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.ativas}</p>
                <p className="text-xs text-muted-foreground">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.atrasadas}</p>
                <p className="text-xs text-muted-foreground">Atrasadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</p>
                <p className="text-xs text-muted-foreground">Valor Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="ativas">Ativas ({stats.ativas})</TabsTrigger>
          <TabsTrigger value="atrasadas">Atrasadas ({stats.atrasadas})</TabsTrigger>
          <TabsTrigger value="finalizadas">Finalizadas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por contrato ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="QUOTE">Orcamento</SelectItem>
                <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                <SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
                <SelectItem value="OVERDUE">Atrasado</SelectItem>
                <SelectItem value="RETURNED">Devolvido</SelectItem>
                <SelectItem value="COMPLETED">Concluido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Equipamentos</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRentals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    Nenhuma locacao encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredRentals.map((rental) => (
                  <TableRow key={rental.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">LOC-{rental.contractNumber.toString().padStart(4, "0")}</span>
                        {rental.type === "DELIVERY" ? (
                          <Truck className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <RotateCcw className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{rental.customer.name}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {rental.items.map((item) => (
                          <div key={item.id} className="text-sm">
                            <span className="text-muted-foreground">
                              {item.equipmentCode}
                            </span>{" "}
                            - {item.equipmentName}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(rental.startDate)} - {formatDate(rental.expectedEndDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{formatCurrency(rental.total)}</p>
                        {rental.depositAmount > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Caucao: {formatCurrency(rental.depositAmount)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(rental.status)}</TableCell>
                    <TableCell>{getPaymentBadge(rental.paymentStatus)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedRental(rental)
                            setIsViewDialogOpen(true)
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadContract(rental.id, rental.contractNumber)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Gerar Contrato PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {rental.status === "QUOTE" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(rental, "CONFIRMED")}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Confirmar Locacao
                            </DropdownMenuItem>
                          )}
                          {rental.status === "CONFIRMED" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(rental, "IN_PROGRESS")}>
                              <Clock className="mr-2 h-4 w-4" />
                              Iniciar Locacao
                            </DropdownMenuItem>
                          )}
                          {["IN_PROGRESS", "OVERDUE"].includes(rental.status) && (
                            <DropdownMenuItem onClick={() => {
                              setSelectedRental(rental)
                              setIsReturnDialogOpen(true)
                            }}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Registrar Devolucao
                            </DropdownMenuItem>
                          )}
                          {rental.status === "RETURNED" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(rental, "COMPLETED")}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Finalizar Locacao
                            </DropdownMenuItem>
                          )}
                          {rental.paymentStatus !== "PAID" && (
                            <DropdownMenuItem onClick={() => handleUpdatePayment(rental, "PAID")}>
                              <DollarSign className="mr-2 h-4 w-4" />
                              Registrar Pagamento
                            </DropdownMenuItem>
                          )}
                          {["RETURNED", "COMPLETED"].includes(rental.status) && (
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  const r = await fetch(`/api/rentals/${rental.id}/invoice`, {
                                    method: "POST",
                                  })
                                  const j = await r.json().catch(() => ({}))
                                  if (r.status === 402) {
                                    toast.error("Emissão de NF disponível só nos planos Starter/Pro")
                                    return
                                  }
                                  if (r.status === 409) {
                                    toast.info(j.error || "Nota já existe")
                                    return
                                  }
                                  if (!r.ok) throw new Error(j.error || j.detail || "Falha")
                                  toast.success(
                                    `Nota emitida${j.number ? ` (#${j.number})` : ""}. Veja em /notas.`
                                  )
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Erro")
                                }
                              }}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Emitir Nota Fiscal
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {!["COMPLETED", "CANCELLED"].includes(rental.status) && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleUpdateStatus(rental, "CANCELLED")}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancelar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Rental Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Locacao</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar uma nova locacao
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRental}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerId">Cliente *</Label>
                  <Select
                    value={formData.customerId}
                    onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} - {customer.document}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "DELIVERY" | "PICKUP") => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PICKUP">Retirada na loja</SelectItem>
                      <SelectItem value="DELIVERY">Entrega</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Data Inicio *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedEndDate">Data Fim Prevista *</Label>
                  <Input
                    id="expectedEndDate"
                    type="date"
                    value={formData.expectedEndDate}
                    min={formData.startDate || undefined}
                    onChange={(e) => setFormData({ ...formData, expectedEndDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              {formData.startDate && formData.expectedEndDate && (
                <p className={diariasDoPeriodo() === null ? "text-sm text-red-600" : "text-sm text-muted-foreground"}>
                  {diariasDoPeriodo() === null
                    ? "A data fim precisa ser depois da data de início."
                    : `${diariasDoPeriodo()} ${diariasDoPeriodo() === 1 ? "diária" : "diárias"} pelo período escolhido.`}
                </p>
              )}

              {formData.type === "DELIVERY" && (
                <div className="space-y-2">
                  <Label htmlFor="deliveryAddress">Endereco de Entrega</Label>
                  <Input
                    id="deliveryAddress"
                    value={formData.deliveryAddress}
                    onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                    placeholder="Endereco completo para entrega"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="depositAmount">Caucao (R$)</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.depositAmount}
                  onChange={(e) => setFormData({ ...formData, depositAmount: parseFloat(e.target.value) || 0 })}
                />
              </div>

              {/* Equipment Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Equipamentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Adicionar Equipamento</Label>
                    <Select onValueChange={addEquipmentToRental}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um equipamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {equipment
                          .filter((e) => !formData.items.some((i) => i.equipmentId === e.id))
                          .map((eq) => (
                            <SelectItem key={eq.id} value={eq.id}>
                              {eq.code} - {eq.name} ({formatCurrency(eq.dailyRate)}/dia)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.items.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipamento</TableHead>
                          <TableHead>Valor/Dia</TableHead>
                          <TableHead>Dias</TableHead>
                          <TableHead>Subtotal</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.items.map((item) => {
                          const eq = equipment.find((e) => e.id === item.equipmentId)
                          return (
                            <TableRow key={item.equipmentId}>
                              <TableCell>
                                {eq?.code} - {eq?.name}
                              </TableCell>
                              <TableCell>{formatCurrency(item.dailyRate)}</TableCell>
                              <TableCell>{diariasDoPeriodo() ?? "—"}</TableCell>
                              <TableCell>{formatCurrency(item.dailyRate * (diariasDoPeriodo() ?? 0))}</TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeEquipmentFromRental(item.equipmentId)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}

                  <div className="flex justify-end border-t pt-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Subtotal</p>
                      <p className="text-xl font-bold">{formatCurrency(calculateSubtotal())}</p>
                      {formData.type === "DELIVERY" && (
                        <p className="text-sm text-muted-foreground">+ Taxa de entrega: R$ 50,00</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="notes">Observacoes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observacoes sobre a locacao"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !formData.customerId || formData.items.length === 0}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Locacao
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Rental Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Locacao</DialogTitle>
            <DialogDescription>
              {selectedRental && `Contrato LOC-${selectedRental.contractNumber.toString().padStart(4, "0")}`}
            </DialogDescription>
          </DialogHeader>
          {selectedRental && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedRental.customer.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRental.customer.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex gap-2">
                    {getStatusBadge(selectedRental.status)}
                    {getPaymentBadge(selectedRental.paymentStatus)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Periodo</p>
                  <p className="font-medium">
                    {formatDate(selectedRental.startDate)} - {formatDate(selectedRental.expectedEndDate)}
                  </p>
                  {selectedRental.actualEndDate && (
                    <p className="text-sm text-green-600">
                      Devolvido em: {formatDate(selectedRental.actualEndDate)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="font-medium flex items-center gap-2">
                    {selectedRental.type === "DELIVERY" ? (
                      <>
                        <Truck className="h-4 w-4" /> Entrega
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4" /> Retirada
                      </>
                    )}
                  </p>
                  {selectedRental.deliveryAddress && (
                    <p className="text-sm text-muted-foreground">{selectedRental.deliveryAddress}</p>
                  )}
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Equipamentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Codigo</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Valor/Dia</TableHead>
                        <TableHead>Dias</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRental.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.equipmentCode}</TableCell>
                          <TableCell>{item.equipmentName}</TableCell>
                          <TableCell>{formatCurrency(item.dailyRate)}</TableCell>
                          <TableCell>{item.days}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <div className="text-right space-y-1">
                  <p className="text-sm">Subtotal: {formatCurrency(selectedRental.subtotal)}</p>
                  {selectedRental.deliveryFee > 0 && (
                    <p className="text-sm">Taxa de entrega: {formatCurrency(selectedRental.deliveryFee)}</p>
                  )}
                  {selectedRental.depositAmount > 0 && (
                    <p className="text-sm">Caucao: {formatCurrency(selectedRental.depositAmount)}</p>
                  )}
                  <p className="text-xl font-bold">Total: {formatCurrency(selectedRental.total)}</p>
                </div>
              </div>

              {selectedRental.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observacoes</p>
                  <p>{selectedRental.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Devolucao</DialogTitle>
            <DialogDescription>
              {selectedRental && `Contrato LOC-${selectedRental.contractNumber.toString().padStart(4, "0")}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReturn}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="returnNotes">Observacoes da Devolucao</Label>
                <Textarea
                  id="returnNotes"
                  value={returnData.returnNotes}
                  onChange={(e) => setReturnData({ ...returnData, returnNotes: e.target.value })}
                  placeholder="Observacoes sobre a devolucao"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="damageDescription">Descricao de Danos</Label>
                <Textarea
                  id="damageDescription"
                  value={returnData.damageDescription}
                  onChange={(e) => setReturnData({ ...returnData, damageDescription: e.target.value })}
                  placeholder="Descreva os danos encontrados, se houver"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="damageCost">Custo de Danos (R$)</Label>
                  <Input
                    id="damageCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={returnData.damageCost}
                    onChange={(e) => setReturnData({ ...returnData, damageCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="additionalCost">Custo Adicional (R$)</Label>
                  <Input
                    id="additionalCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={returnData.additionalCost}
                    onChange={(e) => setReturnData({ ...returnData, additionalCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {selectedRental && (returnData.damageCost > 0 || returnData.additionalCost > 0) && (
                <div className="rounded-lg bg-yellow-50 p-4">
                  <p className="text-sm text-yellow-800">
                    Novo total: {formatCurrency(selectedRental.total + returnData.damageCost + returnData.additionalCost)}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsReturnDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Devolucao
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
