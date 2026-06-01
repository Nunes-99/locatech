import type {
  InvoiceProvider,
  IssueInvoiceInput,
  IssueInvoiceResult,
  CancelInvoiceInput,
  CancelInvoiceResult,
  QueryInvoiceResult,
  WebhookPayload,
} from "../types"

/**
 * FocusNFeProvider — implementação parcial (stub) pro Focus NF-e.
 *
 * **Status**: estrutura pronta, mas precisa de conta + sandbox token pra
 * funcionar. Como o esqueleto está aqui, basta:
 *   1. Criar conta em https://focusnfe.com.br
 *   2. Adquirir token sandbox
 *   3. Configurar em `CompanyTaxConfig.providerCredentials.token`
 *   4. Trocar `MOCK` por `FOCUS_NFE` no `CompanyTaxConfig.provider`
 *   5. Implementar os métodos `issue/cancel/query` chamando a API REST do Focus
 *
 * Documentação: https://focusnfe.com.br/doc/
 *
 * Padrão de chamada típico (NFS-e):
 *   POST https://api.focusnfe.com.br/v2/nfse?ref={localId}
 *   Authorization: Token token="{providerToken}"
 *   body: { prestador, tomador, servico }
 */
export function buildFocusProvider(credentials: { token: string; env: string }): InvoiceProvider {
  const baseUrl =
    credentials.env === "production"
      ? "https://api.focusnfe.com.br"
      : "https://homologacao.focusnfe.com.br"

  const headers = {
    Authorization: `Token token="${credentials.token}"`,
    "Content-Type": "application/json",
  }

  return {
    name: "focus-nfe",

    async issue(input: IssueInvoiceInput): Promise<IssueInvoiceResult> {
      // TODO: mapear input pro payload exato da Focus
      // Aqui só esqueleto pra mostrar o shape esperado
      throw new Error(
        "Focus NF-e provider não implementado. Use o MockProvider em dev ou implemente conforme https://focusnfe.com.br/doc/"
      )

      // Implementação real seria algo como:
      // const ref = input.localId
      // const response = await fetch(`${baseUrl}/v2/nfse?ref=${ref}`, {
      //   method: "POST",
      //   headers,
      //   body: JSON.stringify({
      //     prestador: { cnpj: input.emitter.cnpj, inscricao_municipal: input.emitter.inscricaoMunicipal },
      //     tomador: { cpf_cnpj: input.recipient.document, razao_social: input.recipient.name, email: input.recipient.email },
      //     servico: {
      //       valor_servicos: input.amount,
      //       discriminacao: input.description,
      //       codigo_tributario_municipio: input.emitter.serviceCode,
      //       aliquota: input.emitter.issRate,
      //     },
      //   }),
      // })
      // ...parse resposta...
    },

    async cancel(input: CancelInvoiceInput): Promise<CancelInvoiceResult> {
      throw new Error("Focus NF-e cancel: não implementado (esqueleto)")
    },

    async query(providerId: string): Promise<QueryInvoiceResult> {
      throw new Error("Focus NF-e query: não implementado (esqueleto)")
    },

    verifyWebhook(_headers: Headers, _rawBody: string, clientIp: string): boolean {
      // Focus não assina o webhook — autenticação é por IP allowlist.
      // Configure `INVOICE_WEBHOOK_ALLOWED_IPS` com os IPs documentados em
      // https://focusnfe.com.br/doc/#nfe_webhooks (separados por vírgula).
      const allowed = (process.env.INVOICE_WEBHOOK_ALLOWED_IPS || "")
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean)

      if (allowed.length === 0) {
        // Sem allowlist configurada: bloqueia tudo. Falha-seguro.
        console.error("[focus webhook] INVOICE_WEBHOOK_ALLOWED_IPS não configurado")
        return false
      }
      return allowed.includes(clientIp)
    },

    async parseWebhook(_headers: Headers, rawBody: string): Promise<WebhookPayload> {
      const data = JSON.parse(rawBody)
      return {
        localId: data.ref,
        providerId: data.ref || data.cnpj_emissor,
        status: mapFocusStatus(data.status),
        number: data.numero,
        xmlUrl: data.url_xml,
        pdfUrl: data.url_pdf,
        message: data.mensagem_sefaz,
      }
    },
  }
}

function mapFocusStatus(focus: string | undefined): WebhookPayload["status"] {
  switch (focus) {
    case "autorizado":
      return "ISSUED"
    case "cancelado":
      return "CANCELLED"
    case "erro_autorizacao":
    case "rejeitado":
      return "REJECTED"
    case "processando_autorizacao":
      return "PROCESSING"
    default:
      return "ERROR"
  }
}
