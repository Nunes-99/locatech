import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Gestão Completa para{" "}
          <span className="text-primary">Locadoras</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Controle equipamentos, clientes, contratos e manutenções
          em um único sistema. Chega de cadernos e planilhas!
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/cadastro"
            className="bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors"
          >
            Começar Grátis
          </Link>
          <Link
            href="/demo"
            className="border border-primary text-primary px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            Ver Demo
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Tudo que sua locadora precisa
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon="📦"
            title="Controle de Estoque"
            description="Saiba em tempo real o que está disponível, locado ou em manutenção."
          />
          <FeatureCard
            icon="📋"
            title="Contratos Automáticos"
            description="Gere contratos PDF profissionais com um clique."
          />
          <FeatureCard
            icon="📅"
            title="Calendário Visual"
            description="Visualize todas as locações e devoluções em um calendário intuitivo."
          />
          <FeatureCard
            icon="💰"
            title="Financeiro Completo"
            description="Controle receitas, cobranças e multas por atraso automaticamente."
          />
          <FeatureCard
            icon="🔧"
            title="Manutenções"
            description="Agende e controle manutenções preventivas e corretivas."
          />
          <FeatureCard
            icon="📊"
            title="Relatórios"
            description="Dashboards e relatórios para tomar decisões baseadas em dados."
          />
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Planos para Todos os Tamanhos
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PricingCard
              name="Grátis"
              price="R$ 0"
              features={[
                "20 equipamentos",
                "1 usuário",
                "Contratos PDF",
                "Calendário básico",
              ]}
              cta="Começar Grátis"
            />
            <PricingCard
              name="Starter"
              price="R$ 79,90"
              period="/mês"
              features={[
                "100 equipamentos",
                "3 usuários",
                "WhatsApp integrado",
                "Relatórios avançados",
                "Suporte por email",
              ]}
              cta="Assinar Starter"
              highlighted
            />
            <PricingCard
              name="Pro"
              price="R$ 149,90"
              period="/mês"
              features={[
                "Equipamentos ilimitados",
                "10 usuários",
                "API de integração",
                "Marca própria",
                "Suporte prioritário",
              ]}
              cta="Assinar Pro"
            />
          </div>
        </div>
      </section>

      {/* Target Audience */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Ideal para
        </h2>
        <div className="flex flex-wrap justify-center gap-4">
          {[
            "🏗️ Locadoras de Construção",
            "🎉 Locadoras de Eventos",
            "🚜 Locadoras Agrícolas",
            "🎬 Locadoras Audiovisual",
            "🏥 Equipamentos Médicos",
            "🎿 Locadoras de Esportes",
          ].map((item, i) => (
            <span
              key={i}
              className="bg-white px-6 py-3 rounded-full border border-gray-200 text-gray-700"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            © 2024 LocaTech. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

function PricingCard({
  name,
  price,
  period,
  features,
  cta,
  highlighted,
}: {
  name: string
  price: string
  period?: string
  features: string[]
  cta: string
  highlighted?: boolean
}) {
  return (
    <div
      className={`p-6 rounded-xl ${
        highlighted
          ? "bg-primary text-white shadow-xl scale-105"
          : "bg-white border border-gray-200"
      }`}
    >
      <h3 className={`text-xl font-semibold mb-2 ${highlighted ? "text-white" : "text-gray-900"}`}>
        {name}
      </h3>
      <div className="mb-4">
        <span className="text-3xl font-bold">{price}</span>
        {period && <span className="text-sm opacity-80">{period}</span>}
      </div>
      <ul className="space-y-2 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2">
            <span>✓</span>
            <span className={highlighted ? "text-white/90" : "text-gray-600"}>{feature}</span>
          </li>
        ))}
      </ul>
      <button
        className={`w-full py-2 rounded-lg font-semibold transition-colors ${
          highlighted
            ? "bg-white text-primary hover:bg-gray-100"
            : "bg-primary text-white hover:bg-primary-600"
        }`}
      >
        {cta}
      </button>
    </div>
  )
}
