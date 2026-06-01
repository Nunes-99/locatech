"use client"

import { useState, useEffect } from "react"
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Wrench,
  CheckCircle,
  Calendar,
  DollarSign,
  Package,
  Loader2,
  Trash2,
  XCircle,
  Play,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
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
import { toast } from "sonner"

interface Equipment {
  id: string
  code: string
  name: string
  status: string
}

interface Maintenance {
  id: string
  equipmentId: string
  equipment: Equipment
  type: "PREVENTIVE" | "CORRECTIVE" | "INSPECTION"
  title: string
  description?: string
  laborCost: number
  partsCost: number
  totalCost: number
  scheduledDate?: string
  startedAt?: string
  completedAt?: string
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  notes?: string
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

function getTipoBadge(tipo: string) {
  switch (tipo) {
    case "PREVENTIVE":
      return <Badge className="bg-blue-100 text-blue-800">Preventiva</Badge>
    case "CORRECTIVE":
      return <Badge className="bg-yellow-100 text-yellow-800">Corretiva</Badge>
    case "INSPECTION":
      return <Badge variant="secondary">Inspecao</Badge>
    default:
      return <Badge variant="secondary">{tipo}</Badge>
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "SCHEDULED":
      return <Badge className="bg-purple-100 text-purple-800">Agendada</Badge>
    case "IN_PROGRESS":
      return <Badge className="bg-blue-100 text-blue-800">Em andamento</Badge>
    case "COMPLETED":
      return <Badge className="bg-green-100 text-green-800">Concluida</Badge>
    case "CANCELLED":
      return <Badge variant="secondary">Cancelada</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function ManutencoesPage() {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tipoFilter, setTipoFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedMaintenance, setSelectedMaintenance] = useState<Maintenance | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    equipmentId: "",
    type: "PREVENTIVE" as "PREVENTIVE" | "CORRECTIVE" | "INSPECTION",
    title: "",
    description: "",
    laborCost: 0,
    partsCost: 0,
    scheduledDate: "",
    notes: "",
  })

  useEffect(() => {
    fetchData()
  }, [statusFilter, tipoFilter])

  async function fetchData() {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (tipoFilter !== "all") params.append("type", tipoFilter)

      const [maintenancesRes, equipmentRes] = await Promise.all([
        fetch(`/api/maintenances?${params.toString()}`),
        fetch("/api/equipment"),
      ])

      if (maintenancesRes.ok) {
        const data = await maintenancesRes.json()
        setMaintenances(data)
      }
      if (equipmentRes.ok) {
        const data = await equipmentRes.json()
        setEquipment(data)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }

  const filteredMaintenances = maintenances.filter((m) => {
    const matchesSearch =
      m.equipment.code.toLowerCase().includes(search.toLowerCase()) ||
      m.equipment.name.toLowerCase().includes(search.toLowerCase()) ||
      m.title.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  const stats = {
    agendadas: maintenances.filter((m) => m.status === "SCHEDULED").length,
    emAndamento: maintenances.filter((m) => m.status === "IN_PROGRESS").length,
    concluidas: maintenances.filter((m) => m.status === "COMPLETED").length,
    custoTotal: maintenances.reduce((sum, m) => sum + m.totalCost, 0),
  }

  function resetForm() {
    setFormData({
      equipmentId: "",
      type: "PREVENTIVE",
      title: "",
      description: "",
      laborCost: 0,
      partsCost: 0,
      scheduledDate: "",
      notes: "",
    })
  }

  function openEditDialog(maintenance: Maintenance) {
    setSelectedMaintenance(maintenance)
    setFormData({
      equipmentId: maintenance.equipmentId,
      type: maintenance.type,
      title: maintenance.title,
      description: maintenance.description || "",
      laborCost: maintenance.laborCost,
      partsCost: maintenance.partsCost,
      scheduledDate: maintenance.scheduledDate
        ? maintenance.scheduledDate.split("T")[0]
        : "",
      notes: maintenance.notes || "",
    })
    setIsEditDialogOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch("/api/maintenances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success("Manutencao criada com sucesso!")
        setIsCreateDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Erro ao criar manutencao")
      }
    } catch (error) {
      toast.error("Erro ao criar manutencao")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMaintenance) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/maintenances/${selectedMaintenance.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success("Manutencao atualizada!")
        setIsEditDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Erro ao atualizar manutencao")
      }
    } catch (error) {
      toast.error("Erro ao atualizar manutencao")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateStatus(maintenance: Maintenance, newStatus: string) {
    try {
      const response = await fetch(`/api/maintenances/${maintenance.id}`, {
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

  async function handleDelete(maintenance: Maintenance) {
    if (!confirm("Tem certeza que deseja excluir esta manutencao?")) return

    try {
      const response = await fetch(`/api/maintenances/${maintenance.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Manutencao excluida!")
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Erro ao excluir manutencao")
      }
    } catch (error) {
      toast.error("Erro ao excluir manutencao")
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
          <h1 className="text-2xl font-bold text-gray-900">Manutencoes</h1>
          <p className="text-muted-foreground">
            Gerencie as manutencoes dos equipamentos
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Manutencao
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.agendadas}</p>
                <p className="text-xs text-muted-foreground">Agendadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Wrench className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emAndamento}</p>
                <p className="text-xs text-muted-foreground">Em andamento</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.concluidas}</p>
                <p className="text-xs text-muted-foreground">Concluidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                <DollarSign className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.custoTotal)}</p>
                <p className="text-xs text-muted-foreground">Custo Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por equipamento ou descricao..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="PREVENTIVE">Preventiva</SelectItem>
                <SelectItem value="CORRECTIVE">Corretiva</SelectItem>
                <SelectItem value="INSPECTION">Inspecao</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="SCHEDULED">Agendada</SelectItem>
                <SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
                <SelectItem value="COMPLETED">Concluida</SelectItem>
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
                <TableHead>Equipamento</TableHead>
                <TableHead>Manutencao</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Custos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaintenances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Nenhuma manutencao encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredMaintenances.map((maintenance) => (
                  <TableRow key={maintenance.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{maintenance.equipment.code}</p>
                          <p className="text-sm text-muted-foreground">
                            {maintenance.equipment.name}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{maintenance.title}</p>
                        {maintenance.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {maintenance.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getTipoBadge(maintenance.type)}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {maintenance.scheduledDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDate(maintenance.scheduledDate)}
                          </div>
                        )}
                        {maintenance.completedAt && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            {formatDate(maintenance.completedAt)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <p>Mao de obra: {formatCurrency(maintenance.laborCost)}</p>
                        <p>Pecas: {formatCurrency(maintenance.partsCost)}</p>
                        <p className="font-medium">
                          Total: {formatCurrency(maintenance.totalCost)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(maintenance.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(maintenance)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {maintenance.status === "SCHEDULED" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(maintenance, "IN_PROGRESS")}>
                              <Play className="mr-2 h-4 w-4" />
                              Iniciar
                            </DropdownMenuItem>
                          )}
                          {maintenance.status === "IN_PROGRESS" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(maintenance, "COMPLETED")}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Concluir
                            </DropdownMenuItem>
                          )}
                          {maintenance.status !== "IN_PROGRESS" && maintenance.status !== "COMPLETED" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDelete(maintenance)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </>
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

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Manutencao</DialogTitle>
            <DialogDescription>
              Agende uma nova manutencao para um equipamento
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="equipmentId">Equipamento *</Label>
                <Select
                  value={formData.equipmentId}
                  onValueChange={(value) => setFormData({ ...formData, equipmentId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o equipamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipment.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.code} - {eq.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "PREVENTIVE" | "CORRECTIVE" | "INSPECTION") =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PREVENTIVE">Preventiva</SelectItem>
                      <SelectItem value="CORRECTIVE">Corretiva</SelectItem>
                      <SelectItem value="INSPECTION">Inspecao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduledDate">Data Agendada</Label>
                  <Input
                    id="scheduledDate"
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Titulo *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Revisao trimestral"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descricao</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva os servicos a serem realizados"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="laborCost">Custo Mao de Obra (R$)</Label>
                  <Input
                    id="laborCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.laborCost}
                    onChange={(e) => setFormData({ ...formData, laborCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partsCost">Custo Pecas (R$)</Label>
                  <Input
                    id="partsCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.partsCost}
                    onChange={(e) => setFormData({ ...formData, partsCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm text-muted-foreground">Custo Total</p>
                <p className="text-xl font-bold">{formatCurrency(formData.laborCost + formData.partsCost)}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observacoes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observacoes adicionais"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !formData.equipmentId || !formData.title}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Manutencao
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Manutencao</DialogTitle>
            <DialogDescription>
              Atualize os dados da manutencao
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-equipment">Equipamento</Label>
                <Input
                  id="edit-equipment"
                  value={selectedMaintenance ? `${selectedMaintenance.equipment.code} - ${selectedMaintenance.equipment.name}` : ""}
                  disabled
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Tipo *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "PREVENTIVE" | "CORRECTIVE" | "INSPECTION") =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PREVENTIVE">Preventiva</SelectItem>
                      <SelectItem value="CORRECTIVE">Corretiva</SelectItem>
                      <SelectItem value="INSPECTION">Inspecao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-scheduledDate">Data Agendada</Label>
                  <Input
                    id="edit-scheduledDate"
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-title">Titulo *</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Descricao</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-laborCost">Custo Mao de Obra (R$)</Label>
                  <Input
                    id="edit-laborCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.laborCost}
                    onChange={(e) => setFormData({ ...formData, laborCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-partsCost">Custo Pecas (R$)</Label>
                  <Input
                    id="edit-partsCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.partsCost}
                    onChange={(e) => setFormData({ ...formData, partsCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm text-muted-foreground">Custo Total</p>
                <p className="text-xl font-bold">{formatCurrency(formData.laborCost + formData.partsCost)}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Observacoes</Label>
                <Textarea
                  id="edit-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !formData.title}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alteracoes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
