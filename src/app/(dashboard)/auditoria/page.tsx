"use client"

import { useState, useEffect, useCallback } from "react"
import { ShieldCheck, Loader2, ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface AuditLog {
  id: string
  userEmail: string | null
  userName: string | null
  action: string
  entity: string
  entityId: string
  changes: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_COMPLETED",
  "PASSWORD_CHANGED",
]

const ENTITIES = [
  "Equipment",
  "EquipmentCategory",
  "Customer",
  "Rental",
  "RentalItem",
  "Maintenance",
  "User",
  "Company",
  "Auth",
]

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  LOGIN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  LOGOUT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  LOGIN_FAILED: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  PASSWORD_RESET_REQUESTED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  PASSWORD_RESET_COMPLETED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  PASSWORD_CHANGED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({
    entity: "",
    action: "",
    from: "",
    to: "",
  })
  const [selected, setSelected] = useState<AuditLog | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.entity) params.set("entity", filters.entity)
      if (filters.action) params.set("action", filters.action)
      if (filters.from) params.set("from", filters.from)
      if (filters.to) params.set("to", filters.to)
      params.set("page", String(page))
      params.set("pageSize", "50")

      const response = await fetch(`/api/audit-logs?${params.toString()}`)
      if (!response.ok) {
        if (response.status === 403) {
          toast.error("Você não tem permissão para ver os logs de auditoria")
          setLogs([])
          return
        }
        throw new Error("Erro ao buscar logs")
      }
      const data = await response.json()
      setLogs(data)
      setTotalPages(Number(response.headers.get("X-Total-Pages") || "1"))
    } catch (error) {
      console.error(error)
      toast.error("Erro ao carregar logs")
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Auditoria</h1>
            <p className="text-sm text-muted-foreground">
              Histórico de alterações e eventos de segurança
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            const params = new URLSearchParams()
            if (filters.entity) params.set("entity", filters.entity)
            if (filters.action) params.set("action", filters.action)
            if (filters.from) params.set("from", filters.from)
            if (filters.to) params.set("to", filters.to)
            window.location.href = `/api/audit-logs/export?${params.toString()}`
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-5">
          <div>
            <Label>Entidade</Label>
            <Select
              value={filters.entity || "all"}
              onValueChange={(v) => {
                setFilters((f) => ({ ...f, entity: v === "all" ? "" : v }))
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ENTITIES.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ação</Label>
            <Select
              value={filters.action || "all"}
              onValueChange={(v) => {
                setFilters((f) => ({ ...f, action: v === "all" ? "" : v }))
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>De</Label>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => {
                setFilters((f) => ({ ...f, from: e.target.value }))
                setPage(1)
              }}
            />
          </div>
          <div>
            <Label>Até</Label>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => {
                setFilters((f) => ({ ...f, to: e.target.value }))
                setPage(1)
              }}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setFilters({ entity: "", action: "", from: "", to: "" })
                setPage(1)
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum registro encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{log.userName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{log.userEmail || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={actionColors[log.action] || "bg-gray-100 text-gray-800"}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{log.entity}</span>
                      <div className="text-xs text-muted-foreground">{log.entityId.slice(0, 8)}…</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.ipAddress || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelected(log)}>
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do log</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">Quando:</span>{" "}
                {format(new Date(selected.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
              </div>
              <div>
                <span className="font-semibold">Usuário:</span> {selected.userName} (
                {selected.userEmail})
              </div>
              <div>
                <span className="font-semibold">Ação:</span> {selected.action}
              </div>
              <div>
                <span className="font-semibold">Entidade:</span> {selected.entity} #{selected.entityId}
              </div>
              <div>
                <span className="font-semibold">IP:</span> {selected.ipAddress || "—"}
              </div>
              <div>
                <span className="font-semibold">User Agent:</span>{" "}
                <span className="break-all">{selected.userAgent || "—"}</span>
              </div>
              {selected.changes ? (
                <div>
                  <div className="font-semibold">Alterações:</div>
                  <pre className="mt-1 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                    {JSON.stringify(selected.changes, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
