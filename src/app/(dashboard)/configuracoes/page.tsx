"use client"

import { useState, useEffect, useRef } from "react"
import {
  Building2,
  User,
  Bell,
  CreditCard,
  Shield,
  Save,
  Upload,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CepInput } from "@/components/ui/cep-input"
import { toast } from "sonner"
import { useSession } from "next-auth/react"

const ESTADOS_BR = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
]

export default function ConfiguracoesPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [savingCompany, setSavingCompany] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })

  const [companyData, setCompanyData] = useState({
    name: "",
    document: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    lateFeePercent: "2",
    defaultRentalDays: "1",
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const inputLogo = useRef<HTMLInputElement>(null)

  // "Carregar Logo" não fazia nada; o logo aparece nos e-mails e documentos
  async function enviarLogo(arquivo: File) {
    if (arquivo.size > 2 * 1024 * 1024) {
      toast.error("O logo pode ter no máximo 2MB")
      return
    }
    setEnviandoLogo(true)
    try {
      const corpo = new FormData()
      corpo.append("file", arquivo)
      const up = await fetch("/api/upload", { method: "POST", body: corpo })
      const dados = await up.json()
      if (!up.ok) throw new Error(dados.error || "Falha no envio")
      const salvo = await fetch("/api/company/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: dados.url }),
      })
      if (!salvo.ok) throw new Error((await salvo.json()).error || "Falha ao salvar")
      setLogoUrl(dados.url)
      toast.success("Logo atualizado")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o logo")
    } finally {
      setEnviandoLogo(false)
      if (inputLogo.current) inputLogo.current.value = ""
    }
  }

  useEffect(() => {
    fetchCompanyData()
  }, [])

  const fetchCompanyData = async () => {
    try {
      const response = await fetch("/api/company/settings")
      if (response.ok) {
        const data = await response.json()
        setCompanyData({
          name: data.name || "",
          document: data.document || "",
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          zipCode: data.zipCode || "",
          lateFeePercent: String(data.lateFeePercent || 2),
          defaultRentalDays: String(data.defaultRentalDays || 1),
        })
        setLogoUrl(data.logoUrl || null)
      }
    } catch (error) {
      console.error("Error fetching company data:", error)
      toast.error("Erro ao carregar dados da empresa")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingCompany(true)

    try {
      const response = await fetch("/api/company/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...companyData,
          lateFeePercent: parseFloat(companyData.lateFeePercent),
          defaultRentalDays: parseInt(companyData.defaultRentalDays),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }

      toast.success("Dados da empresa salvos com sucesso!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar")
    } finally {
      setSavingCompany(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("As senhas não coincidem")
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres")
      return
    }

    setSavingPassword(true)

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }

      toast.success("Senha alterada com sucesso!")
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar senha")
    } finally {
      setSavingPassword(false)
    }
  }

  const handleAddressFound = (address: { street: string; city: string; state: string }) => {
    setCompanyData((prev) => ({
      ...prev,
      address: address.street,
      city: address.city,
      state: address.state,
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do sistema
        </p>
      </div>

      <Tabs defaultValue="empresa" className="space-y-6">
        <TabsList>
          <TabsTrigger value="empresa" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="usuario" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Usuário
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
        </TabsList>

        {/* Empresa */}
        <TabsContent value="empresa">
          <Card>
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>
                Informações que aparecerão nos contratos e documentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveCompany} className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Logo da empresa" className="h-full w-full object-contain" />
                    ) : (
                      <Building2 className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <input
                      ref={inputLogo}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const arquivo = e.target.files?.[0]
                        if (arquivo) enviarLogo(arquivo)
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={enviandoLogo}
                      onClick={() => inputLogo.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {logoUrl ? "Trocar logo" : "Carregar Logo"}
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PNG ou JPG, máximo 2MB
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Nome da Empresa</Label>
                    <Input
                      id="companyName"
                      value={companyData.name}
                      onChange={(e) =>
                        setCompanyData({ ...companyData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyDocument">CNPJ</Label>
                    <Input
                      id="companyDocument"
                      value={companyData.document}
                      onChange={(e) =>
                        setCompanyData({ ...companyData, document: e.target.value })
                      }
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Telefone</Label>
                    <Input
                      id="companyPhone"
                      value={companyData.phone}
                      onChange={(e) =>
                        setCompanyData({ ...companyData, phone: e.target.value })
                      }
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">E-mail</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={companyData.email}
                      onChange={(e) =>
                        setCompanyData({ ...companyData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyZipCode">CEP</Label>
                    <CepInput
                      id="companyZipCode"
                      value={companyData.zipCode}
                      onChange={(value) =>
                        setCompanyData({ ...companyData, zipCode: value })
                      }
                      onAddressFound={handleAddressFound}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyAddress">Endereço</Label>
                    <Input
                      id="companyAddress"
                      value={companyData.address}
                      onChange={(e) =>
                        setCompanyData({ ...companyData, address: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyCity">Cidade</Label>
                    <Input
                      id="companyCity"
                      value={companyData.city}
                      onChange={(e) =>
                        setCompanyData({ ...companyData, city: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyState">Estado</Label>
                    <Select
                      value={companyData.state}
                      onValueChange={(value) =>
                        setCompanyData({ ...companyData, state: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BR.map((estado) => (
                          <SelectItem key={estado.value} value={estado.value}>
                            {estado.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" loading={savingCompany}>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usuário */}
        <TabsContent value="usuario">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Perfil do Usuário</CardTitle>
                <CardDescription>
                  Suas informações pessoais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={session?.user?.name || ""}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    value={session?.user?.email || ""}
                    disabled
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Para alterar seus dados, acesse a página de Usuários
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Segurança
                </CardTitle>
                <CardDescription>
                  Altere sua senha de acesso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Senha Atual</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showPasswords.current ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, currentPassword: e.target.value })
                        }
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({ ...showPasswords, current: !showPasswords.current })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova Senha</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPasswords.new ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, newPassword: e.target.value })
                        }
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({ ...showPasswords, new: !showPasswords.new })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showPasswords.confirm ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                        }
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" variant="outline" className="w-full" loading={savingPassword}>
                    Alterar Senha
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notificacoes">
          <Card>
            <CardHeader>
              <CardTitle>Notificações</CardTitle>
              <CardDescription>O que o LocaTech avisa automaticamente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {/* Antes havia caixas de marcar (inclusive WhatsApp, que ainda não
                  existe) que não eram gravadas em lugar nenhum. */}
              <ul className="list-disc space-y-2 pl-5">
                <li>Para o cliente, por e-mail: lembrete 1 e 3 dias antes da devolução e aviso de atraso.</li>
                <li>Para a equipe, no sino do topo: locações atrasadas, orçamentos expirados e manutenções.</li>
                <li>No celular: ative as notificações do navegador no sino do topo.</li>
              </ul>
              <p className="text-muted-foreground">
                Escolher quais avisos receber e lembretes por WhatsApp ainda não estão disponíveis.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pagamentos */}
        <TabsContent value="pagamentos">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Pagamento</CardTitle>
              <CardDescription>
                Configure taxas e valores padrão
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="defaultRentalDays">Dias de Locação Padrão</Label>
                  <Input
                    id="defaultRentalDays"
                    type="number"
                    min="1"
                    value={companyData.defaultRentalDays}
                    onChange={(e) =>
                      setCompanyData({
                        ...companyData,
                        defaultRentalDays: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Período padrão para novas locações
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lateFeePercent">Multa por Atraso (%)</Label>
                  <Input
                    id="lateFeePercent"
                    type="number"
                    min="0"
                    step="0.1"
                    value={companyData.lateFeePercent}
                    onChange={(e) =>
                      setCompanyData({
                        ...companyData,
                        lateFeePercent: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentual cobrado por dia de atraso
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveCompany} loading={savingCompany}>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
