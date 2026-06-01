"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Wrench,
  Package,
  Loader2,
  Upload,
  Image as ImageIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { SkeletonTable } from "@/components/ui/skeleton"
import { useSavedFilters } from "@/hooks/use-saved-filters"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"

interface Category {
  id: string
  name: string
  description?: string
  _count?: { equipment: number }
}

interface Equipment {
  id: string
  code: string
  name: string
  brand?: string
  model?: string
  imageUrl?: string
  dailyRate: number
  status: string
  totalRentals: number
  category: Category
  categoryId: string
}

function getStatusBadge(status: string) {
  switch (status) {
    case "AVAILABLE":
      return <Badge variant="success">Disponível</Badge>
    case "RENTED":
      return <Badge variant="info">Alugado</Badge>
    case "MAINTENANCE":
      return <Badge variant="warning">Manutenção</Badge>
    case "RESERVED":
      return <Badge variant="purple">Reservado</Badge>
    case "RETIRED":
      return <Badge variant="secondary">Inativo</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function EquipamentosPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  // Filtros persistidos por usuário (localStorage) — preserva entre sessões
  const [filters, setFilters] = useSavedFilters("equipamentos", {
    search: "",
    categoryFilter: "all" as string,
    statusFilter: "all" as string,
  })
  const search = filters.search
  const categoryFilter = filters.categoryFilter
  const statusFilter = filters.statusFilter
  const setSearch = (v: string) => setFilters((p) => ({ ...p, search: v }))
  const setCategoryFilter = (v: string) => setFilters((p) => ({ ...p, categoryFilter: v }))
  const setStatusFilter = (v: string) => setFilters((p) => ({ ...p, statusFilter: v }))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    categoryId: "",
    code: "",
    name: "",
    brand: "",
    model: "",
    imageUrl: "",
    dailyRate: "",
    weeklyRate: "",
    monthlyRate: "",
    depositAmount: "",
    description: "",
  })
  const [uploading, setUploading] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter)
      if (statusFilter !== "all") params.set("status", statusFilter)

      const [equipRes, catRes] = await Promise.all([
        fetch(`/api/equipment?${params}`),
        fetch("/api/categories"),
      ])

      if (equipRes.ok) {
        const data = await equipRes.json()
        setEquipment(data)
      }
      if (catRes.ok) {
        const data = await catRes.json()
        setCategories(data)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formDataUpload = new FormData()
      formDataUpload.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erro ao fazer upload")
      }

      const { url } = await response.json()
      setFormData((prev) => ({ ...prev, imageUrl: url }))
      toast.success("Imagem enviada com sucesso!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar imagem")
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const payload = {
        categoryId: formData.categoryId,
        code: formData.code,
        name: formData.name,
        brand: formData.brand || null,
        model: formData.model || null,
        imageUrl: formData.imageUrl || null,
        dailyRate: parseFloat(formData.dailyRate),
        weeklyRate: formData.weeklyRate ? parseFloat(formData.weeklyRate) : null,
        monthlyRate: formData.monthlyRate ? parseFloat(formData.monthlyRate) : null,
        depositAmount: formData.depositAmount ? parseFloat(formData.depositAmount) : null,
        description: formData.description || null,
      }

      const url = editingEquipment
        ? `/api/equipment/${editingEquipment.id}`
        : "/api/equipment"
      const method = editingEquipment ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erro ao salvar")
      }

      toast.success(editingEquipment ? "Equipamento atualizado!" : "Equipamento criado!")
      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (eq: Equipment) => {
    setEditingEquipment(eq)
    setFormData({
      categoryId: eq.categoryId,
      code: eq.code,
      name: eq.name,
      brand: eq.brand || "",
      model: eq.model || "",
      imageUrl: eq.imageUrl || "",
      dailyRate: String(eq.dailyRate),
      weeklyRate: "",
      monthlyRate: "",
      depositAmount: "",
      description: "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente desativar este equipamento?")) return

    try {
      const response = await fetch(`/api/equipment/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }
      toast.success("Equipamento desativado", {
        description: "Você tem alguns segundos para desfazer.",
        duration: 10000,
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              const undo = await fetch(`/api/equipment/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "AVAILABLE" }),
              })
              if (!undo.ok) throw new Error()
              toast.success("Equipamento reativado")
              fetchData()
            } catch {
              toast.error("Não foi possível desfazer")
            }
          },
        },
      })
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao desativar")
    }
  }

  const resetForm = () => {
    setEditingEquipment(null)
    setFormData({
      categoryId: "",
      code: "",
      name: "",
      brand: "",
      model: "",
      imageUrl: "",
      dailyRate: "",
      weeklyRate: "",
      monthlyRate: "",
      depositAmount: "",
      description: "",
    })
  }

  const openNewDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const stats = {
    total: equipment.length,
    available: equipment.filter((e) => e.status === "AVAILABLE").length,
    rented: equipment.filter((e) => e.status === "RENTED").length,
    maintenance: equipment.filter((e) => e.status === "MAINTENANCE").length,
  }

  if (loading) {
    return <SkeletonTable rows={8} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipamentos</h1>
          <p className="text-muted-foreground">
            Gerencie o estoque de equipamentos da locadora
          </p>
        </div>
        <Button onClick={openNewDialog} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Equipamento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <Package className="h-5 w-5 text-slate-600" />
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.available}</p>
                <p className="text-xs text-muted-foreground">Disponíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.rented}</p>
                <p className="text-xs text-muted-foreground">Alugados</p>
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
                <p className="text-2xl font-bold">{stats.maintenance}</p>
                <p className="text-xs text-muted-foreground">Manutenção</p>
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
                placeholder="Buscar por código ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="AVAILABLE">Disponível</SelectItem>
                <SelectItem value="RENTED">Alugado</SelectItem>
                <SelectItem value="MAINTENANCE">Manutenção</SelectItem>
                <SelectItem value="RESERVED">Reservado</SelectItem>
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
                <TableHead>Código</TableHead>
                <TableHead>Equipamento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Marca/Modelo</TableHead>
                <TableHead>Diária</TableHead>
                <TableHead>Locações</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum equipamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                equipment.map((eq) => (
                  <TableRow key={eq.id}>
                    <TableCell className="font-medium">{eq.code}</TableCell>
                    <TableCell>{eq.name}</TableCell>
                    <TableCell>{eq.category?.name}</TableCell>
                    <TableCell>
                      {eq.brand} {eq.model}
                    </TableCell>
                    <TableCell>{formatCurrency(Number(eq.dailyRate))}</TableCell>
                    <TableCell>{eq.totalRentals}</TableCell>
                    <TableCell>{getStatusBadge(eq.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(eq)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Wrench className="mr-2 h-4 w-4" />
                            Manutenção
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(eq.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Desativar
                          </DropdownMenuItem>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEquipment ? "Editar Equipamento" : "Novo Equipamento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoryId" required>Categoria</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="code" required>Código</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="BET-001"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" required>Nome do Equipamento</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Betoneira 400L"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Marca</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="CSM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="CS 400"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Imagem do Equipamento</Label>
              <div className="flex items-center gap-4">
                {formData.imageUrl ? (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, imageUrl: "" })}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-gray-50">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <label className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span className="text-sm">
                        {uploading ? "Enviando..." : "Escolher imagem"}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG ou WebP. Max 5MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dailyRate" required>Diária (R$)</Label>
                <Input
                  id="dailyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.dailyRate}
                  onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                  placeholder="120.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weeklyRate">Semanal (R$)</Label>
                <Input
                  id="weeklyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.weeklyRate}
                  onChange={(e) => setFormData({ ...formData, weeklyRate: e.target.value })}
                  placeholder="700.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlyRate">Mensal (R$)</Label>
                <Input
                  id="monthlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monthlyRate}
                  onChange={(e) => setFormData({ ...formData, monthlyRate: e.target.value })}
                  placeholder="2500.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depositAmount">Caução (R$)</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.depositAmount}
                  onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                  placeholder="500.00"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                {editingEquipment ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
