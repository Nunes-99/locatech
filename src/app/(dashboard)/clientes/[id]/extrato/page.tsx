"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  AlertCircle,
  DollarSign,
  CreditCard,
  Clock,
  ShieldAlert,
  Loader2,
  Receipt,
  CheckCircle2,
  XCircle,
  Download,
  EyeOff,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencido",
  REFUNDED: "Reembolsado",
}

const PAYMENT_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  PARTIAL: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  PAID: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  OVERDUE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  REFUNDED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
}

const STATUS_LABELS: Record<string, string> = {
  QUOTE: "Orçamento",
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "Em andamento",
  OVERDUE: "Atrasada",
  RETURNED: "Devolvida",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
}

const EVENT_LABELS: Record<string, string> = {
  RENTAL_CREATED: "Locação criada",
  RENTAL_STARTED: "Início da locação",
  RENTAL_RETURNED: "Devolução registrada",
  PAID: "Pagamento confirmado",
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  RENTAL_CREATED: <Receipt className="h-4 w-4 text-blue-600" />,
  RENTAL_STARTED: <Clock className="h-4 w-4 text-cyan-600" />,
  RENTAL_RETURNED: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  PAID: <DollarSign className="h-4 w-4 text-emerald-600" />,
}

interface Statement {
  customer: {
    id: string
    name: string
    document: string
    documentType: string
    phone: string
    email: string | null
    creditScore: string
    creditLimit: number | null
    isBlocked: boolean
    blockReason: string | null
  }
  summary: {
    rentalsCount: number
    totalPaid: number
    totalPending: number
    totalOverdue: number
    totalLateFees: number
    activeDeposits: number
    currentBalance: number
    statusCount: Record<string, number>
  }
  rentals: Array<{
    id: string
    contractNumber: number
    startDate: string
    expectedEndDate: string
    actualEndDate: string | null
    status: string
    paymentStatus: string
    paymentMethod: string | null
    total: number
    lateFee: number
    depositAmount: number
    depositPaid: boolean
    depositReturned: boolean
    itemsCount: number
    createdAt: string
  }>
  events: Array<{
    date: string
    type: string
    rentalId: string
    contractNumber: number
    amount?: number
    detail?: string
  }>
}

export default function ExtratoClientePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<Statement | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/customers/${params.id}/statement`)
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Cliente não encontrado")
          router.push("/clientes")
          return
        }
        if (response.status === 403) {
          toast.error("Sem permissão")
          return
        }
        throw new Error("Erro ao buscar extrato")
      }
      setData(await response.json())
    } catch (error) {
      console.error(error)
      toast.error("Erro ao carregar extrato")
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

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

  const { customer, summary, rentals, events } = data

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <h1 className="text-2xl font-bold">Extrato do cliente</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = `/api/customers/${params.id}/export`
            }}
            title="Exporta todos os dados pessoais e contratos deste cliente (LGPD)."
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar dados (LGPD)
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={async () => {
              const confirmation = prompt(
                'ATENÇÃO — operação irreversível.\n\n' +
                  'Os dados pessoais do cliente (nome, CPF, telefone, e-mail, endereço) serão substituídos por placeholders. ' +
                  'O histórico financeiro permanece intacto por obrigação legal.\n\n' +
                  'Para confirmar, digite ANONIMIZAR:'
              )
              if (confirmation !== "ANONIMIZAR") {
                if (confirmation !== null) toast.error("Confirmação inválida")
                return
              }
              try {
                const res = await fetch(`/api/customers/${params.id}/anonymize`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ confirm: "ANONIMIZAR" }),
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || "Falha")
                toast.success("Cliente anonimizado")
                fetchData()
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Falha ao anonimizar")
              }
            }}
            title="Substitui dados pessoais por placeholders preservando histórico (Art. 18 LGPD)."
          >
            <EyeOff className="mr-2 h-4 w-4" />
            Anonimizar (LGPD)
          </Button>
        </div>
      </div>

      {/* Cliente */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> {customer.name}
              </CardTitle>
              {/* div, não CardDescription (<p>): tem blocos dentro e <div> em <p> quebra a hidratação */}
              <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                <div>
                  {customer.documentType}: <span className="font-mono">{customer.document}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {customer.phone}
                  </span>
                  {customer.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {customer.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline">{customer.creditScore}</Badge>
              {customer.isBlocked && (
                <Badge className="bg-red-100 text-red-800">
                  <ShieldAlert className="mr-1 h-3 w-3" /> Bloqueado
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        {customer.isBlocked && customer.blockReason && (
          <CardContent>
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <strong>Motivo do bloqueio:</strong> {customer.blockReason}
            </div>
          </CardContent>
        )}
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard
          label="Locações"
          value={String(summary.rentalsCount)}
          icon={<Receipt className="h-4 w-4" />}
        />
        <KpiCard
          label="Total pago"
          value={BRL.format(summary.totalPaid)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="text-green-600"
        />
        <KpiCard
          label="Pendente"
          value={BRL.format(summary.totalPending)}
          icon={<Clock className="h-4 w-4" />}
          color="text-yellow-600"
        />
        <KpiCard
          label="Vencido"
          value={BRL.format(summary.totalOverdue)}
          icon={<AlertCircle className="h-4 w-4" />}
          color="text-red-600"
        />
        <KpiCard
          label="Caução ativa"
          value={BRL.format(summary.activeDeposits)}
          icon={<CreditCard className="h-4 w-4" />}
          color="text-purple-600"
        />
      </div>

      {summary.currentBalance > 0 && (
        <div className="rounded border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
          <strong>Saldo devedor atual:</strong> {BRL.format(summary.currentBalance)} (pendente +
          vencido). Multas acumuladas: {BRL.format(summary.totalLateFees)}.
        </div>
      )}

      {/* Locações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de locações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rentals.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Este cliente ainda não tem locações.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/locacoes`}
                        className="font-medium text-primary hover:underline"
                      >
                        #{r.contractNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(r.startDate), "dd/MM/yy", { locale: ptBR })}
                      {" → "}
                      {format(new Date(r.actualEndDate || r.expectedEndDate), "dd/MM/yy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>{r.itemsCount}</TableCell>
                    <TableCell className="font-medium">{BRL.format(r.total)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{STATUS_LABELS[r.status] || r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={PAYMENT_COLORS[r.paymentStatus] || ""}>
                        {PAYMENT_LABELS[r.paymentStatus] || r.paymentStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Eventos</CardTitle>
          <CardDescription>Linha do tempo dos últimos eventos do cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground">Sem eventos.</div>
          ) : (
            <ol className="space-y-3">
              {events.slice(0, 50).map((e, i) => (
                <li key={i} className="flex items-start gap-3 border-b pb-3 last:border-0">
                  <div className="mt-0.5">{EVENT_ICONS[e.type] || <XCircle className="h-4 w-4" />}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{EVENT_LABELS[e.type] || e.type}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(e.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Contrato #{e.contractNumber}
                      {e.amount !== undefined && ` · ${BRL.format(e.amount)}`}
                      {e.detail && ` · ${e.detail}`}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  color = "text-slate-700",
}: {
  label: string
  value: string
  icon: React.ReactNode
  color?: string
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={color}>{icon}</span>
        </div>
        <div className={`mt-1 text-lg font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
