import Link from "next/link"
import {
  Building2,
  Package,
  Users,
  ClipboardList,
  Calendar,
  Wrench,
  BarChart3,
  ShieldCheck,
  ArrowRight,
} from "lucide-react"

export const metadata = {
  title: "Demonstração — LocaTech",
  description: "Conheça o LocaTech: gestão completa para locadoras de equipamentos.",
}

const SECTIONS = [
  {
    icon: Package,
    title: "Equipamentos",
    items: [
      "CRUD com foto, código próprio, marca, modelo, número de série",
      "Preços diferenciados por diária, semana e mês + caução",
      "Status em tempo real: Disponível, Locado, Manutenção, Reservado, Baixado",
      "Importação em massa via CSV (até 200 linhas por arquivo)",
      "QR code próprio pra cada equipamento",
      "Histórico de mudanças de preço gravado automaticamente",
    ],
  },
  {
    icon: Users,
    title: "Clientes",
    items: [
      "CRUD com validação automática de CPF/CNPJ",
      "Busca de endereço por CEP (ViaCEP)",
      "Score de crédito (Excelente, Bom, Regular, Ruim, Bloqueado)",
      "Bloqueio com motivo registrado",
      "Métricas: total locado, valor pendente, número de contratos",
    ],
  },
  {
    icon: ClipboardList,
    title: "Locações",
    items: [
      "Workflow: Orçamento → Confirmado → Em Andamento → Devolvido → Concluído",
      "Cálculo automático: diárias × valor + desconto + taxa de entrega + caução",
      "Entrega (com endereço) ou Retirada",
      "Múltiplas formas de pagamento (Pix, Cartão, Boleto, Transferência, Dinheiro)",
      "Devolução com registro de danos (descrição + custo)",
      "Contrato em PDF gerado automaticamente",
    ],
  },
  {
    icon: Calendar,
    title: "Calendário Visual",
    items: [
      "Visualização mensal/semanal/diária de todas as locações",
      "Cores por status (azul = início, verde = devolução, vermelho = atrasado)",
      "Drag-and-drop para reagendar locação",
    ],
  },
  {
    icon: Wrench,
    title: "Manutenções",
    items: [
      "Preventiva, Corretiva ou Inspeção",
      "Agendamento com data prevista, início e fim",
      "Custos separados (mão de obra + peças)",
      "Criação automática quando equipamento atinge 100 locações ou 365 dias alugado",
    ],
  },
  {
    icon: BarChart3,
    title: "Financeiro & Relatórios",
    items: [
      "Dashboard com receita do mês, pendente, vencido, manutenções",
      "Gráficos de área (faturamento ao longo do tempo) e pizza (status de pagamento)",
      "Multas por atraso calculadas automaticamente diariamente",
      "Relatórios por equipamento, cliente, locação ou financeiro",
      "Exportação CSV/Excel",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Segurança & Auditoria",
    items: [
      "Multi-tenant com isolamento total por empresa",
      "3 níveis de permissão: Proprietário, Administrador, Operador",
      "Auditoria automática de todas as operações (quem fez o quê, quando, de onde)",
      "Log de acessos com IP e user-agent",
      "Rate limit em tentativas de login",
      "Recuperação de senha por e-mail com token de 1 hora",
    ],
  },
]

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">LocaTech</span>
          </Link>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-slate-900 md:text-5xl">
          Como funciona o LocaTech
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Tour pelas funcionalidades. Crie uma conta gratuita para explorar
          em primeira mão — sem cartão de crédito, sem limite de tempo.
        </p>
        <div className="mt-6">
          <Link
            href="/cadastro"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white hover:bg-primary/90"
          >
            Criar conta grátis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Sections */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid gap-6 md:grid-cols-2">
          {SECTIONS.map((section) => {
            const Icon = section.icon
            return (
              <div
                key={section.title}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-semibold">{section.title}</h2>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-16 text-center text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold">Pronto para começar?</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Cadastro grátis pra sempre no plano Free (20 equipamentos, 1 usuário).
            Faça upgrade quando o negócio crescer.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/cadastro"
              className="rounded-lg bg-primary px-6 py-3 font-semibold hover:bg-primary/90"
            >
              Começar agora
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-white/30 px-6 py-3 font-semibold hover:bg-white/10"
            >
              Voltar à home
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
