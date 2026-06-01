"use client"

import { useEffect, useState, useCallback } from "react"
import { FileText, Save, Loader2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface TaxConfig {
  cnpj: string
  inscricaoMunicipal: string
  inscricaoEstadual: string
  taxRegime: string
  serviceCode: string
  issRate: number
  provider: string
  providerEnv: string
  autoIssueOnRentalCompletion: boolean
  hasCredentials?: boolean
}

const DEFAULT_CONFIG: TaxConfig = {
  cnpj: "",
  inscricaoMunicipal: "",
  inscricaoEstadual: "",
  taxRegime: "SIMPLES_NACIONAL",
  serviceCode: "17.05",
  issRate: 5,
  provider: "MOCK",
  providerEnv: "sandbox",
  autoIssueOnRentalCompletion: false,
}

export default function ConfiguracoesFiscalPage() {
  const [config, setConfig] = useState<TaxConfig>(DEFAULT_CONFIG)
  const [providerToken, setProviderToken] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [planLocked, setPlanLocked] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/company/tax-config")
      if (response.status === 402) {
        setPlanLocked(true)
        return
      }
      if (!response.ok) throw new Error()
      const data = await response.json()
      if (data) {
        setConfig({
          cnpj: data.cnpj || "",
          inscricaoMunicipal: data.inscricaoMunicipal || "",
          inscricaoEstadual: data.inscricaoEstadual || "",
          taxRegime: data.taxRegime,
          serviceCode: data.serviceCode || "",
          issRate: data.issRate,
          provider: data.provider,
          providerEnv: data.providerEnv,
          autoIssueOnRentalCompletion: data.autoIssueOnRentalCompletion,
          hasCredentials: data.hasCredentials,
        })
      }
    } catch (err) {
      toast.error("Erro ao carregar configuração fiscal")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: any = { ...config }
      if (providerToken) {
        body.providerCredentials = { token: providerToken }
      }
      delete body.hasCredentials

      const response = await fetch("/api/company/tax-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Falha")
      toast.success("Configuração fiscal salva")
      setProviderToken("")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (planLocked) {
    return (
      <div className="max-w-2xl">
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-700" />
              <div>
                <h2 className="font-semibold">Recurso do plano pago</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Emissão de notas fiscais está disponível nos planos Starter e Profissional.
                </p>
                <Button asChild className="mt-3" size="sm">
                  <a href="/upgrade">Ver planos</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Configuração Fiscal</h1>
          <p className="text-sm text-muted-foreground">
            Dados do emissor e provider pra emissão de NFS-e e NF-e.
          </p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Dados do emissor</CardTitle>
            <CardDescription>
              Informações que vão pro cabeçalho da nota.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="cnpj" required>CNPJ</Label>
              <Input
                id="cnpj"
                value={config.cnpj}
                onChange={(e) => setConfig({ ...config, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="im">Inscrição Municipal</Label>
              <Input
                id="im"
                value={config.inscricaoMunicipal}
                onChange={(e) => setConfig({ ...config, inscricaoMunicipal: e.target.value })}
                placeholder="Obrigatório pra NFS-e"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ie">Inscrição Estadual</Label>
              <Input
                id="ie"
                value={config.inscricaoEstadual}
                onChange={(e) => setConfig({ ...config, inscricaoEstadual: e.target.value })}
                placeholder="Opcional (NF-e modelo 55)"
              />
            </div>
            <div className="space-y-1">
              <Label>Regime tributário</Label>
              <Select
                value={config.taxRegime}
                onValueChange={(v) => setConfig({ ...config, taxRegime: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIMPLES_NACIONAL">Simples Nacional</SelectItem>
                  <SelectItem value="LUCRO_PRESUMIDO">Lucro Presumido</SelectItem>
                  <SelectItem value="LUCRO_REAL">Lucro Real</SelectItem>
                  <SelectItem value="MEI">MEI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="service-code">Código do Serviço (LC 116)</Label>
              <Input
                id="service-code"
                value={config.serviceCode}
                onChange={(e) => setConfig({ ...config, serviceCode: e.target.value })}
                placeholder="17.05 (locação de bens móveis)"
              />
              <p className="text-xs text-muted-foreground">
                Padrão pra locação: <code>17.05</code>
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="iss">Alíquota ISS (%)</Label>
              <Input
                id="iss"
                type="number"
                step="0.01"
                value={config.issRate}
                onChange={(e) => setConfig({ ...config, issRate: parseFloat(e.target.value) || 0 })}
                min="0"
                max="100"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider de emissão</CardTitle>
            <CardDescription>
              O LocaTech não emite direto na SEFAZ — usa um intermediário.{" "}
              <strong>Mock</strong> é pra teste; outros precisam de conta + token.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Provider</Label>
              <Select
                value={config.provider}
                onValueChange={(v) => setConfig({ ...config, provider: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MOCK">Mock (teste/dev)</SelectItem>
                  <SelectItem value="FOCUS_NFE">Focus NF-e</SelectItem>
                  <SelectItem value="PLUG_NOTAS">PlugNotas (em breve)</SelectItem>
                  <SelectItem value="E_NOTAS">eNotas (em breve)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ambiente</Label>
              <Select
                value={config.providerEnv}
                onValueChange={(v) => setConfig({ ...config, providerEnv: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {config.provider !== "MOCK" && (
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="token">
                  Token do provider {config.hasCredentials && "(já configurado — preencha apenas pra trocar)"}
                </Label>
                <Input
                  id="token"
                  type="password"
                  value={providerToken}
                  onChange={(e) => setProviderToken(e.target.value)}
                  placeholder={config.hasCredentials ? "•••••••• salvo" : "Cole o token do provider"}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Automação</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoIssueOnRentalCompletion}
                onChange={(e) =>
                  setConfig({ ...config, autoIssueOnRentalCompletion: e.target.checked })
                }
                className="mt-1 h-4 w-4"
              />
              <div>
                <div className="font-medium text-sm">
                  Emitir nota automaticamente ao concluir locação paga
                </div>
                <div className="text-xs text-muted-foreground">
                  Quando uma locação é devolvida e marcada como PAID, dispara emissão da NF-S.
                </div>
              </div>
            </label>
          </CardContent>
        </Card>

        <Button type="submit" loading={saving}>
          <Save className="mr-2 h-4 w-4" />
          Salvar configuração
        </Button>
      </form>
    </div>
  )
}
