"use client"

import { useState } from "react"
import {
  Package,
  Users,
  ClipboardList,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OnboardingChecklist } from "@/components/onboarding/checklist"

// Dados simulados
const stats = {
  totalEquipamentos: 48,
  disponíveis: 32,
  alugados: 14,
  manutencao: 2,
  totalClientes: 156,
  clientesAtivos: 42,
  locacoesAtivas: 14,
  locacoesAtrasadas: 3,
  faturamentoMes: 45890.0,
  faturamentoVariacao: 12.5,
  receitaPendente: 8450.0,
}

const locacoesRecentes = [
  {
    id: "1",
    contrato: "LOC-2024-0156",
    cliente: "João Silva",
    equipamentos: ["Betoneira 400L", "Vibrador de Concreto"],
    dataInicio: "2024-01-15",
    dataFim: "2024-01-20",
    valor: 850.0,
    status: "EM_ANDAMENTO",
  },
  {
    id: "2",
    contrato: "LOC-2024-0155",
    cliente: "Maria Santos",
    equipamentos: ["Andaime Fachadeiro 10m"],
    dataInicio: "2024-01-14",
    dataFim: "2024-01-28",
    valor: 1200.0,
    status: "EM_ANDAMENTO",
  },
  {
    id: "3",
    contrato: "LOC-2024-0154",
    cliente: "Pedro Costa",
    equipamentos: ["Compactador de Solo", "Martelete"],
    dataInicio: "2024-01-10",
    dataFim: "2024-01-15",
    valor: 680.0,
    status: "ATRASADO",
  },
  {
    id: "4",
    contrato: "LOC-2024-0153",
    cliente: "Ana Oliveira",
    equipamentos: ["Serra Circular"],
    dataInicio: "2024-01-12",
    dataFim: "2024-01-14",
    valor: 180.0,
    status: "DEVOLVIDO",
  },
]

const alertas = [
  {
    id: "1",
    tipo: "atrasado",
    mensagem: "Locação LOC-2024-0154 atrasada há 2 dias",
    cliente: "Pedro Costa",
  },
  {
    id: "2",
    tipo: "manutencao",
    mensagem: "Betoneira BT-003 precisa de manutenção preventiva",
    equipamento: "BT-003",
  },
  {
    id: "3",
    tipo: "vencimento",
    mensagem: "Locação LOC-2024-0155 vence em 2 dias",
    cliente: "Maria Santos",
  },
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

function getStatusBadge(status: string) {
  switch (status) {
    case "EM_ANDAMENTO":
      return <Badge variant="info">Em andamento</Badge>
    case "ATRASADO":
      return <Badge variant="destructive">Atrasado</Badge>
    case "DEVOLVIDO":
      return <Badge variant="success">Devolvido</Badge>
    case "RESERVADO":
      return <Badge variant="warning">Reservado</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <OnboardingChecklist />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral da sua locadora de equipamentos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Exportar Relatório</Button>
          <Button>Nova Locação</Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Equipamentos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Equipamentos
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEquipamentos}</div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-green-600">{stats.disponíveis} disponíveis</span>
              <span className="text-blue-600">{stats.alugados} alugados</span>
              <span className="text-yellow-600">{stats.manutencao} manutenção</span>
            </div>
          </CardContent>
        </Card>

        {/* Clientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClientes}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.clientesAtivos} com locações ativas
            </p>
          </CardContent>
        </Card>

        {/* Locações Ativas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Locações Ativas
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.locacoesAtivas}</div>
            {stats.locacoesAtrasadas > 0 && (
              <p className="text-xs text-red-600 mt-2">
                {stats.locacoesAtrasadas} atrasadas
              </p>
            )}
          </CardContent>
        </Card>

        {/* Faturamento */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Faturamento (Mês)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.faturamentoMes)}
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs">
              {stats.faturamentoVariacao > 0 ? (
                <>
                  <ArrowUpRight className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">
                    +{stats.faturamentoVariacao}% vs mês anterior
                  </span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3 text-red-600" />
                  <span className="text-red-600">
                    {stats.faturamentoVariacao}% vs mês anterior
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Locações Recentes */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Locações Recentes</CardTitle>
            <Button variant="ghost" size="sm">
              Ver todas
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {locacoesRecentes.map((locacao) => (
                <div
                  key={locacao.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{locacao.contrato}</span>
                      {getStatusBadge(locacao.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {locacao.cliente}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {locacao.equipamentos.join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(locacao.valor)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(locacao.dataInicio)} - {formatDate(locacao.dataFim)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Alertas
            </CardTitle>
            <Badge variant="warning">{alertas.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  {alerta.tipo === "atrasado" && (
                    <Clock className="h-5 w-5 text-red-500 flex-shrink-0" />
                  )}
                  {alerta.tipo === "manutencao" && (
                    <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  )}
                  {alerta.tipo === "vencimento" && (
                    <Clock className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  )}
                  <div className="space-y-1">
                    <p className="text-sm">{alerta.mensagem}</p>
                    <p className="text-xs text-muted-foreground">
                      {alerta.cliente || alerta.equipamento}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Disponíveis</p>
              <p className="text-2xl font-bold">{stats.disponíveis}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Alugados</p>
              <p className="text-2xl font-bold">{stats.alugados}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
              <DollarSign className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Receita Pendente</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.receitaPendente)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
