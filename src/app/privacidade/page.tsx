import Link from "next/link"

export const metadata = {
  title: "Política de Privacidade — LocaTech",
  description: "Como tratamos dados pessoais e cookies.",
}

const VERSION = "2026-05-29"

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-primary hover:underline">
          ← Voltar
        </Link>
      </div>

      <article className="prose prose-slate dark:prose-invert max-w-none">
        <h1>Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground">Versão {VERSION}</p>

        <p className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          <strong>Aviso:</strong> Esboço inicial — revisar com advogado/DPO antes de uso em
          produção. Cobre boas práticas mas não substitui aconselhamento jurídico.
        </p>

        <h2>1. Quem somos</h2>
        <p>
          LocaTech é operado pela empresa fornecedora do serviço (a ser identificada nesta
          seção quando publicado em produção). Atuamos como <strong>operadora</strong> dos
          dados que cada locadora cadastrada nos confia.
        </p>

        <h2>2. Que dados coletamos</h2>
        <ul>
          <li>
            <strong>Dados da empresa cliente (locadora):</strong> nome, CNPJ, e-mail,
            telefone, endereço, dados bancários para faturamento.
          </li>
          <li>
            <strong>Dados dos usuários internos (funcionários da locadora):</strong> nome,
            e-mail, telefone, hash da senha, função.
          </li>
          <li>
            <strong>Dados de clientes finais (locatários):</strong> nome, CPF/CNPJ,
            telefone, e-mail, endereço, histórico de locações. <em>Coletados pela locadora</em>{" "}
            — somos operadores; a locadora é a controladora destes dados.
          </li>
          <li>
            <strong>Dados de uso:</strong> logs de acesso, IP, user agent, ações realizadas
            (auditoria).
          </li>
        </ul>

        <h2>3. Para que usamos</h2>
        <ul>
          <li>Prestação do serviço contratado</li>
          <li>Comunicação transacional (confirmações, alertas, lembretes)</li>
          <li>Cobrança e emissão de recibos</li>
          <li>Suporte técnico</li>
          <li>Auditoria e segurança</li>
          <li>Cumprimento de obrigações legais</li>
        </ul>

        <h2>4. Compartilhamento</h2>
        <p>
          Compartilhamos dados estritamente quando necessário para a operação:
        </p>
        <ul>
          <li>
            <strong>Stripe</strong> (processamento de pagamento) — dados de cartão e cobrança
          </li>
          <li>
            <strong>Resend</strong> (envio de e-mails transacionais)
          </li>
          <li>
            <strong>Provedor de NF-e</strong> quando o cliente emite nota fiscal pela
            plataforma
          </li>
          <li>
            <strong>Hospedagem em nuvem</strong> (Vercel/AWS/Oracle) — armazenamento e
            execução
          </li>
        </ul>
        <p>
          Não vendemos dados para terceiros. Não usamos seus dados para treinamento de
          modelos de IA.
        </p>

        <h2>5. Direitos do Titular (LGPD)</h2>
        <p>Você tem direito a:</p>
        <ul>
          <li>Acessar seus dados</li>
          <li>Corrigir dados incompletos ou desatualizados</li>
          <li>Solicitar exportação em formato estruturado</li>
          <li>Solicitar exclusão (anonimização preservando histórico financeiro/fiscal)</li>
          <li>Revogar consentimento</li>
        </ul>
        <p>
          Para exercer qualquer direito, envie pedido para o e-mail de privacidade abaixo.
          Respondemos em até 15 dias.
        </p>

        <h2>6. Retenção</h2>
        <p>
          Dados de locações são retidos enquanto a empresa cliente mantém a conta ativa.
          Após cancelamento, mantemos por 5 anos para fins fiscais e de auditoria (prazo
          legal de guarda de documentos contábeis).
        </p>

        <h2>7. Segurança</h2>
        <p>Aplicamos práticas técnicas e organizacionais:</p>
        <ul>
          <li>Senhas armazenadas com bcrypt (cost 12)</li>
          <li>HTTPS obrigatório em produção</li>
          <li>Rate limiting em endpoints de autenticação</li>
          <li>Auditoria de todas as operações sensíveis</li>
          <li>Headers de segurança (CSP, HSTS, X-Frame-Options)</li>
          <li>Multi-tenancy com isolamento por <code>companyId</code> em todas as consultas</li>
        </ul>

        <h2>8. Cookies</h2>
        <p>
          Usamos cookies estritamente necessários para autenticação (sessão NextAuth). Não
          usamos cookies de marketing nem rastreamento de terceiros sem consentimento.
        </p>

        <h2>9. Crianças</h2>
        <p>
          A Plataforma não é destinada a menores de 18 anos. Não coletamos intencionalmente
          dados de menores.
        </p>

        <h2>10. Alterações</h2>
        <p>
          Alterações materiais serão comunicadas por e-mail aos administradores das contas.
        </p>

        <hr />
        <p className="text-sm">
          <strong>Encarregado pelo Tratamento de Dados (DPO):</strong>{" "}
          <a href="mailto:privacidade@locatech.com.br" className="text-primary hover:underline">
            privacidade@locatech.com.br
          </a>
        </p>
      </article>
    </main>
  )
}
