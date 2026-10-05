"use client"

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Phone,
  Mail,
  MapPin,
  Users,
  UserCheck,
  UserX,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MaskedInput } from "@/components/ui/masked-input"
import { validateDocument } from "@/lib/validators"
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
import { useAuth } from "@/hooks/use-auth"
import { canPerform, type Role } from "@/lib/permissions"
import { formatCurrency } from "@/lib/utils"

interface Customer {
  id: string
  name: string
  document: string
  documentType: string
  phone: string
  email?: string
  city?: string
  state?: string
  creditScore: string
  totalRentals: number
  totalSpent: number
  totalPending: number
  isBlocked: boolean
}

function getCreditBadge(score: string) {
  switch (score) {
    case "EXCELLENT":
      return <Badge variant="success">Excelente</Badge>
    case "GOOD":
      return <Badge variant="info">Bom</Badge>
    case "REGULAR":
      return <Badge variant="warning">Regular</Badge>
    case "BAD":
      return <Badge variant="destructive">Ruim</Badge>
    case "BLOCKED":
      return <Badge variant="destructive">Bloqueado</Badge>
    default:
      return <Badge variant="secondary">{score}</Badge>
  }
}

export default function ClientesPage() {
  const { user } = useAuth()
  const podeExcluir = !!user && canPerform(user.role as Role, "customer.delete")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useSavedFilters("clientes", {
    search: "",
    creditFilter: "all" as string,
  })
  const search = filters.search
  const creditFilter = filters.creditFilter
  const setSearch = (v: string) => setFilters((p) => ({ ...p, search: v }))
  const setCreditFilter = (v: string) => setFilters((p) => ({ ...p, creditFilter: v }))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    document: "",
    documentType: "CPF",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    notes: "",
  })

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (creditFilter !== "all") params.set("creditScore", creditFilter)

      const response = await fetch(`/api/customers?${params}`)
      if (response.ok) {
        const data = await response.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error("Error fetching customers:", error)
      toast.error("Erro ao carregar clientes")
    } finally {
      setLoading(false)
    }
  }, [search, creditFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate document before submitting
    const cleanedDocument = formData.document.replace(/\D/g, "")
    if (!validateDocument(cleanedDocument, formData.documentType as "CPF" | "CNPJ")) {
      toast.error(`${formData.documentType} inválido`)
      return
    }

    setSaving(true)

    try {
      const payload = {
        name: formData.name,
        document: cleanedDocument,
        documentType: formData.documentType,
        phone: formData.phone.replace(/\D/g, ""),
        email: formData.email || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zipCode: formData.zipCode?.replace(/\D/g, "") || null,
        notes: formData.notes || null,
      }

      const url = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : "/api/customers"
      const method = editingCustomer ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erro ao salvar")
      }

      toast.success(editingCustomer ? "Cliente atualizado!" : "Cliente criado!")
      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      document: customer.document,
      documentType: customer.documentType,
      phone: customer.phone,
      email: customer.email || "",
      address: "",
      city: customer.city || "",
      state: customer.state || "",
      zipCode: "",
      notes: "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente remover este cliente?")) return

    try {
      const response = await fetch(`/api/customers/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }
      toast.success("Cliente removido", {
        description: "Você tem alguns segundos para desfazer.",
        duration: 10000,
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              const undo = await fetch(`/api/customers/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isBlocked: false, blockReason: null }),
              })
              if (!undo.ok) throw new Error()
              toast.success("Remoção desfeita")
              fetchData()
            } catch {
              toast.error("Não foi possível desfazer")
            }
          },
        },
      })
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover")
    }
  }

  const resetForm = () => {
    setEditingCustomer(null)
    setFormData({
      name: "",
      document: "",
      documentType: "CPF",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      notes: "",
    })
  }

  const openNewDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const stats = {
    total: customers.length,
    active: customers.filter((c) => !c.isBlocked).length,
    blocked: customers.filter((c) => c.isBlocked).length,
    withPending: customers.filter((c) => Number(c.totalPending) > 0).length,
  }

  if (loading) {
    return <SkeletonTable rows={8} />
    // (loader original substituído por skeleton)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie os clientes da sua locadora
          </p>
        </div>
        <Button onClick={openNewDialog} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <Users className="h-5 w-5 text-slate-600" />
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
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <UserX className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.blocked}</p>
                <p className="text-xs text-muted-foreground">Bloqueados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.withPending}</p>
                <p className="text-xs text-muted-foreground">Com pendência</p>
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
                placeholder="Buscar por nome, documento ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={creditFilter} onValueChange={setCreditFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Score de Crédito" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="EXCELLENT">Excelente</SelectItem>
                <SelectItem value="GOOD">Bom</SelectItem>
                <SelectItem value="REGULAR">Regular</SelectItem>
                <SelectItem value="BAD">Ruim</SelectItem>
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
                <TableHead>Cliente</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Locações</TableHead>
                <TableHead>Total Gasto</TableHead>
                <TableHead>Pendente</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id} className={customer.isBlocked ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{customer.name}</span>
                        {customer.isBlocked && (
                          <Badge variant="destructive" className="text-xs">
                            Bloqueado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          {customer.documentType}
                        </span>
                        <p>{customer.document}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {customer.phone}
                        </div>
                        {customer.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.city && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {customer.city}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{customer.totalRentals}</TableCell>
                    <TableCell>{formatCurrency(Number(customer.totalSpent))}</TableCell>
                    <TableCell>
                      {Number(customer.totalPending) > 0 ? (
                        <span className="text-red-600 font-medium">
                          {formatCurrency(Number(customer.totalPending))}
                        </span>
                      ) : (
                        <span className="text-green-600">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getCreditBadge(customer.creditScore)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/clientes/${customer.id}/extrato`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver extrato e locações
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(customer)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          {podeExcluir && (
                            <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(customer.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remover
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name" required>Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo ou razão social"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="documentType" required>Tipo de Documento</Label>
                <Select
                  value={formData.documentType}
                  onValueChange={(v) => setFormData({ ...formData, documentType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CPF">CPF</SelectItem>
                    <SelectItem value="CNPJ">CNPJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="document" required>Documento</Label>
                <MaskedInput
                  id="document"
                  mask="document"
                  documentType={formData.documentType as "CPF" | "CNPJ"}
                  value={formData.document}
                  onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                  placeholder={formData.documentType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
                  showValidation
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" required>Telefone</Label>
                <MaskedInput
                  id="phone"
                  mask="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, complemento"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">CEP</Label>
                <MaskedInput
                  id="zipCode"
                  mask="cep"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                {editingCustomer ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
