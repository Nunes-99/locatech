"use client"

import { useState, useEffect, useCallback } from "react"
import { Shield, AlertTriangle, Loader2, Monitor, LogOut, Bell, BellOff } from "lucide-react"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { signOut } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface AccessLogEntry {
  id: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

function summarizeUA(ua: string | null): string {
  if (!ua) return "Desconhecido"
  if (/Edg\//.test(ua)) return "Edge"
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome"
  if (/Firefox\//.test(ua)) return "Firefox"
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari"
  if (/PostmanRuntime/.test(ua)) return "Postman"
  if (/curl/.test(ua)) return "curl"
  return ua.slice(0, 40)
}

function summarizeOS(ua: string | null): string {
  if (!ua) return ""
  if (/Windows/.test(ua)) return "Windows"
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS"
  if (/Linux/.test(ua) && !/Android/.test(ua)) return "Linux"
  if (/Android/.test(ua)) return "Android"
  if (/iPhone|iPad|iOS/.test(ua)) return "iOS"
  return ""
}

export default function SegurancaPage() {
  const [logs, setLogs] = useState<AccessLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const push = usePushNotifications()

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/auth/sessions")
      if (!response.ok) throw new Error("Erro ao buscar sessões")
      const data = await response.json()
      setLogs(data)
    } catch (error) {
      console.error(error)
      toast.error("Erro ao carregar sessões recentes")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  async function handleRevokeAll() {
    setRevoking(true)
    try {
      const response = await fetch("/api/auth/sessions", { method: "DELETE" })
      if (!response.ok) throw new Error("Falha ao revogar")
      toast.success("Sessões revogadas. Desconectando...")
      // Pequeno delay pra usuário ler o toast
      setTimeout(() => signOut({ callbackUrl: "/login" }), 1500)
    } catch (error) {
      console.error(error)
      toast.error("Não foi possível revogar as sessões")
      setRevoking(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Segurança</h1>
          <p className="text-sm text-muted-foreground">
            Sessões recentes e ações de segurança da sua conta.
          </p>
        </div>
      </div>

      {push.supported && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações push
            </CardTitle>
            <CardDescription>
              Receba alertas operacionais (locações novas, atrasos, manutenções)
              direto no navegador, mesmo sem o LocaTech aberto.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {push.subscribed ? (
              <>
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700 dark:bg-green-900/40 dark:text-green-200">
                  Ativadas neste navegador
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => push.sendTest()}
                >
                  Enviar teste
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={push.loading}
                  onClick={async () => {
                    await push.disable()
                    toast.success("Notificações desativadas")
                  }}
                >
                  <BellOff className="mr-2 h-4 w-4" /> Desativar
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                disabled={push.loading || push.permission === "denied"}
                onClick={async () => {
                  const r = await push.enable()
                  if (r.ok) toast.success("Notificações ativadas")
                  else toast.error(r.error || "Falha ao ativar")
                }}
              >
                <Bell className="mr-2 h-4 w-4" />
                {push.permission === "denied" ? "Permissão bloqueada" : "Ativar notificações"}
              </Button>
            )}
            {push.permission === "denied" && (
              <span className="text-xs text-muted-foreground">
                Libere as permissões no menu do navegador pra reativar.
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Acessos recentes</CardTitle>
          <CardDescription>
            Últimas 20 entradas bem-sucedidas com seu e-mail. Se notar algo suspeito,
            encerre todas as sessões abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum acesso registrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Dispositivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.ipAddress || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        {summarizeUA(log.userAgent)}
                        {summarizeOS(log.userAgent) && (
                          <span className="text-muted-foreground">
                            · {summarizeOS(log.userAgent)}
                          </span>
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

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Encerrar todas as sessões
          </CardTitle>
          <CardDescription>
            Invalida todos os tokens de acesso emitidos até agora — incluindo o seu navegador
            atual. Use se desconfiar que alguém tem acesso à sua conta. Você precisará entrar
            novamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={revoking}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Encerrar todas as sessões
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar revogação</DialogTitle>
            <DialogDescription>
              Todas as sessões ativas serão invalidadas, inclusive a sua. Você precisará fazer
              login novamente. Deseja prosseguir?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={revoking}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false)
                handleRevokeAll()
              }}
              loading={revoking}
            >
              Sim, encerrar tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
