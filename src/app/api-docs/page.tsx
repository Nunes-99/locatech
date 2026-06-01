import Link from "next/link"

export const metadata = {
  title: "API LocaTech — Documentação",
  description: "Referência da API REST do LocaTech.",
}

export default function ApiDocsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm text-primary hover:underline">
          ← Voltar
        </Link>
      </div>

      <article className="prose prose-slate dark:prose-invert max-w-none">
        <h1>API LocaTech v1</h1>
        <p className="text-sm text-muted-foreground">
          Disponível no plano Profissional. Endpoints REST para integrar o LocaTech
          com seu ERP, BI, automações, etc.
        </p>

        <h2>Autenticação</h2>
        <p>Toda chamada precisa de uma API key, gerada em <code>Configurações → API</code>.</p>
        <p>Envie no header de uma das duas formas:</p>
        <pre>
          {`X-API-Key: lt_live_xxxxxxxxxxxxxxxx

# ou

Authorization: Bearer lt_live_xxxxxxxxxxxxxxxx`}
        </pre>

        <h2>Rate limit</h2>
        <p>
          Default: <strong>60 requisições por minuto</strong> por API key. Cada key
          pode ter um limite custom configurado. Quando ultrapassado, a API retorna
          HTTP <code>429</code> com o tempo de espera.
        </p>

        <h2>Endpoints</h2>

        <h3>GET /api/v1/equipment</h3>
        <p>Lista equipamentos da empresa.</p>
        <p>
          <strong>Query params:</strong> <code>status</code> (AVAILABLE, RENTED, MAINTENANCE, RESERVED, RETIRED),{" "}
          <code>categoryId</code>, <code>page</code>, <code>pageSize</code> (máx 100).
        </p>
        <pre>
          {`curl https://locatech.com.br/api/v1/equipment?status=AVAILABLE&page=1 \\
  -H "X-API-Key: lt_live_..."`}
        </pre>

        <h3>GET /api/v1/customers</h3>
        <p>Lista clientes da empresa.</p>
        <p>
          <strong>Query params:</strong> <code>search</code>, <code>isBlocked</code> (true|false),{" "}
          <code>page</code>, <code>pageSize</code>.
        </p>
        <pre>
          {`curl https://locatech.com.br/api/v1/customers?search=joao \\
  -H "X-API-Key: lt_live_..."`}
        </pre>

        <h3>GET /api/v1/rentals</h3>
        <p>Lista locações da empresa.</p>
        <p>
          <strong>Query params:</strong> <code>status</code>, <code>customerId</code>,{" "}
          <code>fromDate</code>, <code>toDate</code>, <code>page</code>, <code>pageSize</code>.
        </p>
        <pre>
          {`curl "https://locatech.com.br/api/v1/rentals?status=IN_PROGRESS&fromDate=2026-01-01" \\
  -H "X-API-Key: lt_live_..."`}
        </pre>

        <h2>Formato da resposta</h2>
        <pre>
          {`{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 137,
    "totalPages": 3
  }
}`}
        </pre>

        <h2>Códigos de erro</h2>
        <ul>
          <li><code>401</code> — API key ausente, inválida, desativada ou expirada</li>
          <li><code>402</code> — Empresa não está no plano Profissional</li>
          <li><code>403</code> — API key sem permissão para a operação</li>
          <li><code>429</code> — Rate limit excedido</li>
          <li><code>500</code> — Erro interno</li>
        </ul>

        <h2>Webhooks</h2>
        <p>
          Em vez de fazer polling nos endpoints, você pode receber notificações em tempo
          real configurando webhooks em <code>Configurações → Webhooks</code>. Cada delivery
          é assinada com HMAC SHA256 — valide o header{" "}
          <code>X-LocaTech-Signature</code> antes de processar.
        </p>

        <hr />
        <p className="text-sm text-muted-foreground">
          Versão atual: <strong>v1</strong>. Mudanças breaking serão anunciadas via email aos
          owners e mantidas em paralelo por pelo menos 6 meses.
        </p>
      </article>
    </main>
  )
}
