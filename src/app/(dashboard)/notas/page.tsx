"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  FileText,
  Loader2,
  Download,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Settings,
  PenLine,
  BarChart3,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Invoice {
  id: string
  type: string
  status: string
  number: string | null
  amount: number
  description: string
  pdfUrl: string | null
  xmlUrl: string | null
  providerMessage: string | null
  issuedAt: string | null
  cancelledAt: string | null
  createdAt: string
  rental: { contractNumber: number; customer: { name: string } } | null
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  ISSUED: "Emitida",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
  ERROR: "Erro",
}
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  PROCESSING: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  ISSUED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
}

export default function NotasPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter !== "all") params.set("status", statusFilter)
      params.set("page", String(page))

      const response = await fetch(`/api/invoices?${params}`)
      if (!response.ok) {
        if (response.status === 403) {
          toast.error("Sem permissão")
          return
        }
        throw new Error()
      }
      setInvoices(await response.json())
      setTotalPages(Number(response.headers.get("X-Total-Pages") || "1"))
    } catch (err) {
      toast.error("Erro ao carregar notas")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page])

  useEffect(() => {
    const t = setTimeout(fetchInvoices, 300)
    return () => clearTimeout(t)
  }, [fetchInvoices])

  async function cancelInvoice(id: string) {
    const reason = prompt(
      "Motivo do cancelamento (mínimo 5 chars):",
      "Cancelado por solicitação do cliente"
    )
    if (!reason || reason.length < 5) return
    try {
      const r = await fetch(`/api/invoices/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "Falha")
      toast.success("Nota cancelada")
      fetchInvoices()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cancelar")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Notas Fiscais</h1>
            <p className="text-sm text-muted-foreground">
              Histórico de emissões e status atual.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/notas/dashboard">
              <BarChart3 className="mr-2 h-4 w-4" /> Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/configuracoes/fiscal">
              <Settings className="mr-2 h-4 w-4" /> Configuração fiscal
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
          <Input
            placeholder="Buscar por número ou contrato"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v)
              setPage(1)
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma nota emitida ainda. Vá em uma locação concluída e clique em "Emitir NF".
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Emitida em</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">
                      {inv.number || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {inv.rental ? `#${inv.rental.contractNumber}` : "—"}
                    </TableCell>
                    <TableCell>{inv.rental?.customer.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{BRL.format(inv.amount)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[inv.status]}>
                        {STATUS_LABELS[inv.status]}
                      </Badge>
                      {inv.providerMessage && (
                        <div
                          className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground"
                          title={inv.providerMessage}
                        >
                          {inv.providerMessage}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {inv.issuedAt
                        ? format(new Date(inv.issuedAt), "dd/MM/yy HH:mm", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {inv.pdfUrl && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            title="Baixar PDF"
                          >
                            <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {inv.status === "ISSUED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const text = prompt(
                                "Texto da Carta de Correção (15-1000 caracteres):"
                              )
                              if (!text || text.length < 15) {
                                if (text !== null) toast.error("Mínimo 15 caracteres")
                                return
                              }
                              try {
                                const r = await fetch(`/api/invoices/${inv.id}/correction`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ correctionText: text }),
                                })
                                const j = await r.json()
                                if (!r.ok) throw new Error(j.error || "Falha")
                                toast.success("CCe registrada")
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Erro")
                              }
                            }}
                            title="Carta de Correção (CCe)"
                            className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            <PenLine className="h-4 w-4" />
                          </Button>
                        )}
                        {inv.status === "ISSUED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelInvoice(inv.id)}
                            title="Cancelar nota"
                            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
    </div>
  )
}
