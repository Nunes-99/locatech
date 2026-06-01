"use client"

import { useState, useEffect } from "react"
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"

/**
 * Card de 2FA na página /seguranca.
 *
 * Estados:
 *   - Inativo → botão "Ativar"; abre dialog de setup com QR code (otpauth URL embed
 *     em image via api.qrserver.com pra evitar mais uma dep) + campo de código
 *   - Ativo → mostra desde quando; botão "Desativar" pede senha + código
 */
interface Status {
  enabled: boolean
  enabledAt: string | null
  backupCodesRemaining: number
}

export function TwoFactorCard() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [setupOpen, setSetupOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    try {
      const r = await fetch("/api/auth/2fa/status")
      if (r.ok) setStatus(await r.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Autenticação em 2 fatores (2FA)
          </CardTitle>
          <CardDescription>
            Exige um código de 6 dígitos do seu app autenticador (Authy, Google Authenticator,
            1Password) a cada login. Recomendado para contas OWNER.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : status?.enabled ? (
            <>
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700 dark:bg-green-900/40 dark:text-green-200">
                Ativada {status.enabledAt ? "desde " + new Date(status.enabledAt).toLocaleDateString("pt-BR") : ""}
              </span>
              <span className="text-xs text-muted-foreground">
                {status.backupCodesRemaining} código(s) de backup disponíveis
              </span>
              <Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>
                <ShieldOff className="mr-2 h-4 w-4" /> Desativar 2FA
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setSetupOpen(true)}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Ativar 2FA
            </Button>
          )}
        </CardContent>
      </Card>

      <SetupDialog
        open={setupOpen}
        onClose={() => {
          setSetupOpen(false)
          fetchStatus()
        }}
      />
      <DisableDialog
        open={disableOpen}
        onClose={() => {
          setDisableOpen(false)
          fetchStatus()
        }}
      />
    </>
  )
}

function SetupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"qr" | "verify" | "backup">("qr")
  const [secret, setSecret] = useState("")
  const [otpauthUrl, setOtpauthUrl] = useState("")
  const [code, setCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open && step === "qr" && !secret) {
      generateSecret()
    }
    if (!open) {
      setStep("qr")
      setSecret("")
      setOtpauthUrl("")
      setCode("")
      setBackupCodes([])
    }
  }, [open])

  async function generateSecret() {
    setLoading(true)
    try {
      const r = await fetch("/api/auth/2fa/setup", { method: "POST" })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "Falha")
      setSecret(j.secret)
      setOtpauthUrl(j.otpauthUrl)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
      onClose()
    } finally {
      setLoading(false)
    }
  }

  async function activate() {
    setLoading(true)
    try {
      const r = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, code }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "Falha")
      setBackupCodes(j.backupCodes)
      setStep("backup")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "qr" && "Configure seu app autenticador"}
            {step === "verify" && "Confirme com o código"}
            {step === "backup" && "Guarde seus códigos de backup"}
          </DialogTitle>
          <DialogDescription>
            {step === "qr" &&
              "Escaneie o QR code no Authy, Google Authenticator ou similar. Depois digite o código de 6 dígitos."}
            {step === "backup" &&
              "Salve estes códigos em local seguro — eles permitem entrar se você perder o celular. Cada código serve uma única vez."}
          </DialogDescription>
        </DialogHeader>

        {step === "qr" && otpauthUrl && (
          <div className="space-y-3">
            <div className="flex justify-center rounded-lg border bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`}
                alt="QR Code"
                width={200}
                height={200}
              />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Não consegue escanear? Digite manualmente:</p>
              <code className="mt-1 inline-block break-all rounded bg-slate-100 px-2 py-1 font-mono text-xs dark:bg-slate-800">
                {secret}
              </code>
            </div>
            <div>
              <Label htmlFor="totp-code">Código de 6 dígitos do app</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoComplete="one-time-code"
              />
            </div>
          </div>
        )}

        {step === "backup" && (
          <div className="space-y-3">
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>Salve agora.</strong> Estes códigos não serão exibidos novamente.
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {backupCodes.map((c) => (
                <li
                  key={c}
                  className="rounded border bg-slate-100 px-3 py-2 text-center font-mono text-sm dark:bg-slate-800"
                >
                  {c}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(backupCodes.join("\n"))
                setCopied(true)
                toast.success("Códigos copiados")
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              Copiar todos
            </Button>
          </div>
        )}

        <DialogFooter>
          {step === "qr" && (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={activate} loading={loading} disabled={code.length !== 6}>
                Confirmar e ativar
              </Button>
            </>
          )}
          {step === "backup" && (
            <Button onClick={onClose}>Concluir</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DisableDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setPassword("")
      setCode("")
    }
  }, [open])

  async function submit() {
    setLoading(true)
    try {
      const r = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, code }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "Falha")
      toast.success("2FA desativada")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desativar 2FA</DialogTitle>
          <DialogDescription>
            Confirme sua senha e um código TOTP atual (ou backup code) pra desativar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="d-pwd">Senha atual</Label>
            <Input
              id="d-pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="d-code">Código TOTP ou backup</Label>
            <Input
              id="d-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={submit} loading={loading} disabled={!password || !code}>
            Desativar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
