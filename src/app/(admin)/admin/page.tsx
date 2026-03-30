"use client"

import { useState, useEffect } from "react"
import {
  Building2,
  Users,
  Package,
  DollarSign,
  TrendingUp,
  Loader2,
  Search,
  Eye,
  MoreVertical,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface Company {
  id: string
  name: string
  document?: string
  email?: string
  plan: string
  planExpiresAt?: string
  totalRentals: number
  totalRevenue: number
  createdAt: string
  _count: {
    users: number
    equipment: number
    customers: number
    rentals: number
  }
}

interface AdminStats {
  totalCompanies: number
  totalUsers: number
  totalEquipment: number
  totalRevenue: number
  planDistribution: {
    FREE: number
    STARTER: number
    PRO: number
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function getPlanBadge(plan: string) {
  switch (plan) {
    case "FREE":
      return <Badge variant="secondary">Grátis</Badge>
    case "STARTER":
      return <Badge variant="info">Starter</Badge>
    case "PRO":
      return <Badge variant="success">Pro</Badge>
    default:
      return <Badge variant="secondary">{plan}</Badge>
  }
}

export default function AdminPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetchData()
  }, [search])

  async function fetchData() {
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)

      const [companiesRes, statsRes] = await Promise.all([
        fetch(`/api/admin/companies?${params}`),
        fetch("/api/admin/stats"),
      ])

      if (companiesRes.ok) {
        const data = await companiesRes.json()
        setCompanies(data)
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Error fetching admin data:", error)
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
        <p className="text-muted-foreground">
          Gerenciamento global do sistema LocaTech
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalCompanies}</p>
                  <p className="text-xs text-muted-foreground">Empresas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalEquipment}</p>
                  <p className="text-xs text-muted-foreground">Equipamentos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Receita Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Plan Distribution */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição de Planos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-600">{stats.planDistribution.FREE}</p>
                <p className="text-sm text-muted-foreground">Grátis</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{stats.planDistribution.STARTER}</p>
                <p className="text-sm text-muted-foreground">Starter</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">{stats.planDistribution.PRO}</p>
                <p className="text-sm text-muted-foreground">Pro</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empresas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Companies Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Usuários</TableHead>
                <TableHead>Equipamentos</TableHead>
                <TableHead>Locações</TableHead>
                <TableHead>Receita</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma empresa encontrada
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{company.name}</p>
                        <p className="text-sm text-muted-foreground">{company.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getPlanBadge(company.plan)}
                        {company.planExpiresAt && (
                          <span className="text-xs text-muted-foreground">
                            até {new Date(company.planExpiresAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{company._count.users}</TableCell>
                    <TableCell>{company._count.equipment}</TableCell>
                    <TableCell>{company._count.rentals}</TableCell>
                    <TableCell>{formatCurrency(Number(company.totalRevenue))}</TableCell>
                    <TableCell>
                      {new Date(company.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
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
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Alterar plano
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Suspender
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
    </div>
  )
}
