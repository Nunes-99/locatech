import Link from "next/link"

export const metadata = {
  title: "Termos de Uso — LocaTech",
  description: "Termos e condições de uso da plataforma LocaTech.",
}

const VERSION = "2026-05-29"

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-primary hover:underline">
          ← Voltar
        </Link>
      </div>

      <article className="prose prose-slate dark:prose-invert max-w-none">
        <h1>Termos de Uso</h1>
        <p className="text-sm text-muted-foreground">Versão {VERSION}</p>

        <p className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          <strong>Aviso:</strong> Este texto é um esboço inicial e deve ser revisado por
          advogado antes de uso em produção. Os termos abaixo seguem boas práticas mas
          não substituem aconselhamento jurídico.
        </p>

        <h2>1. Aceitação</h2>
        <p>
          Ao criar uma conta no LocaTech ("Plataforma"), você ("Usuário") declara que leu,
          entendeu e concorda integralmente com estes Termos de Uso. Se não concorda, não
          deve utilizar a Plataforma.
        </p>

        <h2>2. Descrição do Serviço</h2>
        <p>
          O LocaTech é uma plataforma SaaS (Software como Serviço) destinada à gestão de
          locadoras de equipamentos, oferecendo controle de estoque, clientes, contratos,
          manutenção, finanças e relatórios.
        </p>

        <h2>3. Cadastro</h2>
        <p>
          O cadastro requer informações verdadeiras e atualizadas. O Usuário é responsável
          pela confidencialidade da senha e por todas as atividades realizadas em sua conta.
          Notifique imediatamente caso suspeite de acesso não autorizado.
        </p>

        <h2>4. Planos e Pagamento</h2>
        <p>
          A Plataforma oferece planos Gratuito, Starter e Profissional, cujos preços e
          limites estão descritos na página inicial. Pagamentos são processados via Mercado Pago
          (cartão, Pix ou boleto).
          Cancelamentos podem ser feitos a qualquer momento, sem reembolso proporcional do
          mês corrente.
        </p>

        <h2>5. Uso Aceitável</h2>
        <p>É vedado:</p>
        <ul>
          <li>Usar a Plataforma para fins ilícitos</li>
          <li>Tentar acessar dados de outros usuários ou empresas</li>
          <li>Realizar engenharia reversa, scraping em massa ou ataque de qualquer natureza</li>
          <li>Revender o acesso sem autorização</li>
        </ul>

        <h2>6. Dados e Privacidade</h2>
        <p>
          O tratamento de dados pessoais é regido pela{" "}
          <Link href="/privacidade" className="text-primary hover:underline">
            Política de Privacidade
          </Link>{" "}
          e segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
        </p>

        <h2>7. Propriedade Intelectual</h2>
        <p>
          Os dados inseridos pelo Usuário (equipamentos, clientes, locações) são de sua
          propriedade. A marca, código-fonte e arquitetura da Plataforma são de propriedade
          do LocaTech.
        </p>

        <h2>8. Disponibilidade</h2>
        <p>
          A Plataforma se esforça para manter disponibilidade contínua, mas não garante
          operação 100% ininterrupta. Janelas de manutenção serão comunicadas com
          antecedência sempre que possível.
        </p>

        <h2>9. Limitação de Responsabilidade</h2>
        <p>
          A Plataforma não se responsabiliza por prejuízos indiretos, lucros cessantes ou
          danos decorrentes de uso indevido, decisões de negócio do Usuário ou falhas de
          infraestrutura de terceiros (provedor de hospedagem, gateway de pagamento, etc).
        </p>

        <h2>10. Alterações</h2>
        <p>
          Estes Termos podem ser revisados a qualquer momento. Alterações materiais serão
          comunicadas por e-mail. O uso continuado após a comunicação implica aceite.
        </p>

        <h2>11. Foro</h2>
        <p>
          Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da
          comarca da sede da empresa operadora do LocaTech para dirimir eventuais
          controvérsias.
        </p>

        <hr />
        <p className="text-sm text-muted-foreground">
          Contato:{" "}
          <a href="mailto:contato@locatech.com.br" className="text-primary hover:underline">
            contato@locatech.com.br
          </a>
        </p>
      </article>
    </main>
  )
}
