"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Building2,
  Plus,
  Loader2,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Package,
  ClipboardList,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"

interface Store {
  id: string
  name: string
  code: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  isActive: boolean
  createdAt: string
  _count: { equipment: number; rentals: number }
}

const DEFAULT_FORM = {
  name: "",
  code: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
}

export default function LojasPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  const fetchStores = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/stores")
      if (!r.ok) throw new Error()
      setStores(await r.json())
    } catch {
      toast.error("Erro ao carregar lojas")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStores()
  }, [fetchStores])

  function openCreate() {
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setDialogOpen(true)
  }

  function openEdit(store: Store) {
    setEditingId(store.id)
    setForm({
      name: store.name,
      code: store.code,
      phone: store.phone || "",
      email: store.email || "",
      address: store.address || "",
      city: store.city || "",
      state: store.state || "",
      zipCode: store.zipCode || "",
    })
    setDialogOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const url = editingId ? `/api/stores/${editingId}` : "/api/stores"
      const method = editingId ? "PATCH" : "POST"

      // Update não aceita "code" — só o create
      const body: any = { ...form }
      if (editingId) delete body.code

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "Falha")
      toast.success(editingId ? "Loja atualizada" : "Loja criada")
      setDialogOpen(false)
      fetchStores()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(store: Store) {
    try {
      const r = await fetch(`/api/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !store.isActive }),
      })
      if (!r.ok) throw new Error()
      toast.success(store.isActive ? "Loja desativada" : "Loja reativada")
      fetchStores()
    } catch {
      toast.error("Erro ao alterar status")
    }
  }

  async function remove(store: Store) {
    if (!confirm(`Excluir "${store.name}" (${store.code})? Esta ação é irreversível.`)) return
    try {
      const r = await fetch(`/api/stores/${store.id}`, { method: "DELETE" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || "Falha")
      toast.success("Loja excluída")
      fetchStores()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Lojas / Filiais</h1>
            <p className="text-sm text-muted-foreground">
              Divida seu estoque e operação entre filiais quando crescer.
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nova loja
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stores.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <h2 className="mt-3 text-lg font-medium">Nenhuma loja cadastrada</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Empresas com uma só unidade não precisam de filiais. Crie só quando
                tiver mais de um endereço com estoque separado.
              </p>
              <Button onClick={openCreate} className="mt-4">
                <Plus className="mr-2 h-4 w-4" /> Criar primeira loja
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Vinculados</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-mono font-medium">{store.code}</TableCell>
                    <TableCell>{store.name}</TableCell>
                    <TableCell className="text-sm">
                      {[store.city, store.state].filter(Boolean).join(" - ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="inline-flex items-center gap-1 mr-2">
                        <Package className="h-3 w-3" /> {store._count.equipment}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" /> {store._count.rentals}
                      </span>
                    </TableCell>
                    <TableCell>
                      {store.isActive ? (
                        <Badge variant="success">Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(store)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(store)}>
                        {store.isActive ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => remove(store)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar loja" : "Nova loja"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="name" required>
                  Nome
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Filial Centro"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="code" required>
                  Código
                </Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  disabled={!!editingId}
                  required
                  placeholder="MATRIZ"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state">UF</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })}
                  maxLength={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
