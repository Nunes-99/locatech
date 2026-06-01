import crypto from "crypto"
import type {
  InvoiceProvider,
  IssueInvoiceInput,
  IssueInvoiceResult,
  CancelInvoiceInput,
  CancelInvoiceResult,
  CorrectionInput,
  CorrectionResult,
  QueryInvoiceResult,
  WebhookPayload,
} from "../types"

/**
 * MockProvider — fake provider pra desenvolvimento e teste.
 *
 * Sempre retorna sucesso imediato com número aleatório e URLs `about:blank`.
 * NÃO usar em produção. Existe pra permitir testar o fluxo end-to-end sem
 * precisar de credenciais reais do Focus/PlugNotas/eNotas.
 */
export const MockProvider: InvoiceProvider = {
  name: "mock",

  async issue(input: IssueInvoiceInput): Promise<IssueInvoiceResult> {
    const providerId = `mock-${crypto.randomBytes(8).toString("hex")}`
    const number = String(Math.floor(100000 + Math.random() * 900000))
    return {
      providerId,
      status: "ISSUED",
      number,
      series: "1",
      xmlUrl: `about:blank#xml-${providerId}`,
      pdfUrl: `about:blank#pdf-${providerId}`,
      providerStatus: "AUTHORIZED",
      providerMessage: `Nota emitida com sucesso (mock). Valor: R$ ${input.amount.toFixed(2)}`,
    }
  },

  async cancel(input: CancelInvoiceInput): Promise<CancelInvoiceResult> {
    return {
      success: true,
      providerMessage: `Nota ${input.providerId} cancelada (mock). Motivo: ${input.reason}`,
    }
  },

  async correct(input: CorrectionInput): Promise<CorrectionResult> {
    return {
      success: true,
      sequence: 1,
      providerId: `mock-cce-${crypto.randomBytes(4).toString("hex")}`,
      providerMessage: `CCe registrada (mock): "${input.correctionText.slice(0, 50)}..."`,
    }
  },

  async query(providerId: string): Promise<QueryInvoiceResult> {
    return {
      status: "ISSUED",
      number: providerId.replace("mock-", ""),
      providerMessage: "Consultado via mock",
    }
  },

  async parseWebhook(_headers: Headers, rawBody: string): Promise<WebhookPayload> {
    try {
      const data = JSON.parse(rawBody)
      return {
        localId: data.localId,
        providerId: data.providerId || `mock-${Date.now()}`,
        status: (data.status as WebhookPayload["status"]) || "ISSUED",
        number: data.number,
        xmlUrl: data.xmlUrl,
        pdfUrl: data.pdfUrl,
        message: data.message || "Mock webhook",
      }
    } catch {
      throw new Error("Mock webhook: body não é JSON válido")
    }
  },
}
