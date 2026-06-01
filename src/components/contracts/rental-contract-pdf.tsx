"use client"

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer"

function makeStyles(primaryColor: string) {
  return StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    textAlign: "center",
  },
  headerLogoRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
  },
  logo: {
    width: 80,
    height: 80,
    objectFit: "contain",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    color: primaryColor,
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 10,
  },
  contractNumber: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 20,
    color: primaryColor,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: primaryColor,
    color: primaryColor,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 120,
    fontWeight: "bold",
    color: "#333",
  },
  value: {
    flex: 1,
  },
  table: {
    marginTop: 10,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  tableHeaderCell: {
    fontWeight: "bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tableCell: {
    fontSize: 9,
  },
  col1: { width: "15%" },
  col2: { width: "35%" },
  col3: { width: "15%", textAlign: "right" },
  col4: { width: "15%", textAlign: "center" },
  col5: { width: "20%", textAlign: "right" },
  totals: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  totalLabel: {
    width: 120,
    textAlign: "right",
    marginRight: 10,
  },
  totalValue: {
    width: 80,
    textAlign: "right",
  },
  grandTotal: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 8,
  },
  terms: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  termsTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 8,
  },
  termsText: {
    fontSize: 8,
    lineHeight: 1.5,
    color: "#374151",
    marginBottom: 5,
  },
  signatures: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBox: {
    width: "45%",
    textAlign: "center",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#000",
    marginTop: 50,
    paddingTop: 8,
  },
  signatureName: {
    fontSize: 10,
    fontWeight: "bold",
  },
  signatureRole: {
    fontSize: 9,
    color: "#666",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#999",
  },
  })
}

interface RentalItem {
  equipmentCode: string
  equipmentName: string
  dailyRate: number
  days: number
  subtotal: number
}

interface RentalContractData {
  contractNumber: number
  companyName: string
  companyDocument?: string
  companyAddress?: string
  companyPhone?: string
  /** URL absoluta da logo (PNG/JPG); o renderer baixa e embute no PDF. */
  companyLogoUrl?: string
  /** Hex (#RRGGBB) usado em títulos e bordas das seções. */
  companyPrimaryColor?: string
  /** Data URL ou URL absoluta da assinatura do cliente (PNG). Se presente, embute. */
  customerSignatureUrl?: string
  customerSignedAt?: string
  customerName: string
  customerDocument: string
  customerPhone: string
  customerAddress?: string
  startDate: string
  expectedEndDate: string
  type: "DELIVERY" | "PICKUP"
  deliveryAddress?: string
  items: RentalItem[]
  subtotal: number
  deliveryFee: number
  depositAmount: number
  total: number
  notes?: string
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

export function RentalContractPDF({ data }: { data: RentalContractData }) {
  const today = new Date().toLocaleDateString("pt-BR")
  const styles = makeStyles(data.companyPrimaryColor || "#2563EB")

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {data.companyLogoUrl ? (
            <View style={styles.headerLogoRow}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={data.companyLogoUrl} style={styles.logo} />
            </View>
          ) : null}
          <Text style={styles.title}>{data.companyName}</Text>
          <Text style={styles.subtitle}>Sistema de Locacao de Equipamentos</Text>
          <Text style={styles.contractNumber}>
            CONTRATO DE LOCACAO N. LOC-{data.contractNumber.toString().padStart(4, "0")}
          </Text>
        </View>

        {/* Company Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOCADORA</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Razao Social:</Text>
            <Text style={styles.value}>{data.companyName}</Text>
          </View>
          {data.companyDocument && (
            <View style={styles.row}>
              <Text style={styles.label}>CNPJ:</Text>
              <Text style={styles.value}>{data.companyDocument}</Text>
            </View>
          )}
          {data.companyAddress && (
            <View style={styles.row}>
              <Text style={styles.label}>Endereco:</Text>
              <Text style={styles.value}>{data.companyAddress}</Text>
            </View>
          )}
          {data.companyPhone && (
            <View style={styles.row}>
              <Text style={styles.label}>Telefone:</Text>
              <Text style={styles.value}>{data.companyPhone}</Text>
            </View>
          )}
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOCATARIO</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome:</Text>
            <Text style={styles.value}>{data.customerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>CPF/CNPJ:</Text>
            <Text style={styles.value}>{data.customerDocument}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Telefone:</Text>
            <Text style={styles.value}>{data.customerPhone}</Text>
          </View>
          {data.customerAddress && (
            <View style={styles.row}>
              <Text style={styles.label}>Endereco:</Text>
              <Text style={styles.value}>{data.customerAddress}</Text>
            </View>
          )}
        </View>

        {/* Rental Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DADOS DA LOCACAO</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Periodo:</Text>
            <Text style={styles.value}>
              {formatDate(data.startDate)} a {formatDate(data.expectedEndDate)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tipo:</Text>
            <Text style={styles.value}>
              {data.type === "DELIVERY" ? "Entrega no local" : "Retirada na loja"}
            </Text>
          </View>
          {data.type === "DELIVERY" && data.deliveryAddress && (
            <View style={styles.row}>
              <Text style={styles.label}>End. Entrega:</Text>
              <Text style={styles.value}>{data.deliveryAddress}</Text>
            </View>
          )}
        </View>

        {/* Equipment Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EQUIPAMENTOS</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.col1]}>Codigo</Text>
              <Text style={[styles.tableHeaderCell, styles.col2]}>Descricao</Text>
              <Text style={[styles.tableHeaderCell, styles.col3]}>Valor/Dia</Text>
              <Text style={[styles.tableHeaderCell, styles.col4]}>Dias</Text>
              <Text style={[styles.tableHeaderCell, styles.col5]}>Subtotal</Text>
            </View>
            {data.items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.col1]}>{item.equipmentCode}</Text>
                <Text style={[styles.tableCell, styles.col2]}>{item.equipmentName}</Text>
                <Text style={[styles.tableCell, styles.col3]}>{formatCurrency(item.dailyRate)}</Text>
                <Text style={[styles.tableCell, styles.col4]}>{item.days}</Text>
                <Text style={[styles.tableCell, styles.col5]}>{formatCurrency(item.subtotal)}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>{formatCurrency(data.subtotal)}</Text>
            </View>
            {data.deliveryFee > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Taxa de Entrega:</Text>
                <Text style={styles.totalValue}>{formatCurrency(data.deliveryFee)}</Text>
              </View>
            )}
            {data.depositAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Caucao:</Text>
                <Text style={styles.totalValue}>{formatCurrency(data.depositAmount)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={styles.totalLabel}>TOTAL:</Text>
              <Text style={styles.totalValue}>{formatCurrency(data.total)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OBSERVACOES</Text>
            <Text>{data.notes}</Text>
          </View>
        )}

        {/* Terms */}
        <View style={styles.terms}>
          <Text style={styles.termsTitle}>TERMOS E CONDICOES</Text>
          <Text style={styles.termsText}>
            1. O LOCATARIO se compromete a devolver os equipamentos no prazo estipulado e nas mesmas condicoes em que foram entregues.
          </Text>
          <Text style={styles.termsText}>
            2. Quaisquer danos causados aos equipamentos serao de responsabilidade do LOCATARIO, que devera arcar com os custos de reparo ou substituicao.
          </Text>
          <Text style={styles.termsText}>
            3. A caucao sera devolvida integralmente apos a devolucao dos equipamentos em perfeito estado, descontados eventuais danos ou valores pendentes.
          </Text>
          <Text style={styles.termsText}>
            4. O atraso na devolucao dos equipamentos acarretara cobranca adicional proporcional ao valor diario de locacao.
          </Text>
          <Text style={styles.termsText}>
            5. Este contrato entra em vigor na data de sua assinatura e permanece valido ate a devolucao dos equipamentos e quitacao de todos os valores.
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.signatures}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{data.companyName}</Text>
              <Text style={styles.signatureRole}>LOCADORA</Text>
            </View>
          </View>
          <View style={styles.signatureBox}>
            {data.customerSignatureUrl ? (
              <View style={{ alignItems: "center" }}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image
                  src={data.customerSignatureUrl}
                  style={{ width: 160, height: 60, objectFit: "contain" }}
                />
                <View style={{ borderTopWidth: 1, borderTopColor: "#000", paddingTop: 4, width: 200 }}>
                  <Text style={styles.signatureName}>{data.customerName}</Text>
                  <Text style={styles.signatureRole}>
                    LOCATARIO
                    {data.customerSignedAt
                      ? ` — assinado em ${new Date(data.customerSignedAt).toLocaleDateString("pt-BR")}`
                      : ""}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.signatureLine}>
                <Text style={styles.signatureName}>{data.customerName}</Text>
                <Text style={styles.signatureRole}>LOCATARIO</Text>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Documento gerado em {today} - LocaTech - Sistema de Locacao de Equipamentos
        </Text>
      </Page>
    </Document>
  )
}
