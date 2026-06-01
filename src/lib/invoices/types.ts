/**
 * Tipos compartilhados pelo módulo fiscal. Independem de provider.
 */

import type { InvoiceType, InvoicePurpose, TaxRegime } from "@prisma/client"

export interface IssueInvoiceInput {
  /// Identificador local da nota (ID interno). O provider deve ecoar.
  localId: string

  type: InvoiceType
  amount: number
  description: string

  /// Propósito da nota (apenas relevante pra NFE_55). Default no provider deve ser SERVICO.
  purpose?: InvoicePurpose
  /// CFOP — apenas pra NFE_55. Ex: "5917" (remessa interna), "1917" (retorno interno).
  cfop?: string
  /// Texto descrevendo a natureza da operação (ex: "Remessa para locação").
  natureOperation?: string

  /// CNPJ emissor + IM + alíquota — geralmente vêm de CompanyTaxConfig
  emitter: {
    cnpj: string
    inscricaoMunicipal?: string | null
    taxRegime: TaxRegime
    serviceCode?: string | null
    issRate: number
  }

  /// Dados do tomador (cliente final)
  recipient: {
    name: string
    document: string
    documentType: "CPF" | "CNPJ"
    email?: string | null
    phone?: string | null
    address?: {
      street?: string | null
      city?: string | null
      state?: string | null
      zipCode?: string | null
    }
  }

  /// Itens da nota (mesmo se for NFS-e — vão na descrição/discriminação)
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
}

export interface IssueInvoiceResult {
  /// ID externo no provider.
  providerId: string
  /// Status retornado imediatamente. Pode ser PROCESSING (aguardando SEFAZ).
  status: "PROCESSING" | "ISSUED" | "REJECTED" | "ERROR"
  number?: string
  series?: string
  xmlUrl?: string
  pdfUrl?: string
  providerStatus?: string
  providerMessage?: string
}

export interface CancelInvoiceInput {
  providerId: string
  reason: string
}

export interface CancelInvoiceResult {
  success: boolean
  providerMessage?: string
}

export interface CorrectionInput {
  providerId: string
  /// Texto da correção. SEFAZ exige 15-1000 chars.
  correctionText: string
}

export interface CorrectionResult {
  success: boolean
  /// Número sequencial da CCe atribuído pelo provider (1 = primeira, 2 = segunda, etc).
  sequence?: number
  providerId?: string
  providerMessage?: string
}

export interface QueryInvoiceResult {
  status: "PROCESSING" | "ISSUED" | "REJECTED" | "CANCELLED" | "ERROR"
  number?: string
  series?: string
  xmlUrl?: string
  pdfUrl?: string
  providerMessage?: string
}

export interface WebhookPayload {
  /// ID local mapeado pelo provider (idealmente passamos no issue como reference)
  localId?: string
  /// ID do provider
  providerId: string
  status: QueryInvoiceResult["status"]
  number?: string
  xmlUrl?: string
  pdfUrl?: string
  message?: string
}

export interface InvoiceProvider {
  name: string
  issue(input: IssueInvoiceInput): Promise<IssueInvoiceResult>
  cancel(input: CancelInvoiceInput): Promise<CancelInvoiceResult>
  query(providerId: string): Promise<QueryInvoiceResult>
  /// Emite Carta de Correção Eletrônica (CCe) — disponível para NF-e modelo 55.
  /// NFS-e raramente suporta — depende da prefeitura. Provider sinaliza com success=false.
  correct?(input: CorrectionInput): Promise<CorrectionResult>
  /// Faz parse do payload do webhook + valida signature se aplicável.
  parseWebhook(headers: Headers, rawBody: string): Promise<WebhookPayload>
}
