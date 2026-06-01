import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import ExcelJS from "exceljs"

export const dynamic = "force-dynamic"

interface ReportData {
  headers: string[]
  // Cells can carry their natural type (number/Date/string) for proper Excel formatting.
  rows: Array<Array<string | number | Date | null>>
  // Per-column hints (currency, date) used to apply number formats in the XLSX path.
  columnFormat?: Array<"currency" | "date" | "integer" | undefined>
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toLocaleDateString("pt-BR")
  return String(value)
    .replace(/"/g, '""')
}

function toCSV({ headers, rows }: ReportData): string {
  const lines = [headers.map((h) => `"${csvEscape(h)}"`).join(",")]
  for (const row of rows) {
    lines.push(row.map((c) => `"${csvEscape(c)}"`).join(","))
  }
  return "﻿" + lines.join("\r\n") // BOM pra Excel reconhecer UTF-8
}

async function toXLSX(
  { headers, rows, columnFormat }: ReportData,
  sheetName: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "LocaTech"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31)) // limite do Excel

  // Cabeçalho
  sheet.addRow(headers)
  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  }
  header.alignment = { vertical: "middle", horizontal: "left" }
  header.height = 22

  // Dados
  for (const row of rows) sheet.addRow(row)

  // Formato por coluna
  if (columnFormat) {
    columnFormat.forEach((fmt, i) => {
      const col = sheet.getColumn(i + 1)
      if (fmt === "currency") col.numFmt = '"R$" #,##0.00'
      else if (fmt === "date") col.numFmt = "dd/mm/yyyy"
      else if (fmt === "integer") col.numFmt = "0"
    })
  }

  // Auto-fit aproximado: max(header.length, maior valor da coluna)
  sheet.columns.forEach((col, i) => {
    let max = headers[i]?.length ?? 10
    for (const row of rows) {
      const v = row[i]
      const len = v instanceof Date ? 10 : String(v ?? "").length
      if (len > max) max = len
    }
    col.width = Math.min(60, Math.max(10, max + 2))
  })

  sheet.views = [{ state: "frozen", ySplit: 1 }]

  const ab = await workbook.xlsx.writeBuffer()
  return Buffer.from(ab)
}

async function buildEquipmentReport(companyId: string): Promise<ReportData> {
  const equipment = await prisma.equipment.findMany({
    where: { companyId, status: { not: "RETIRED" } },
    include: { category: true },
    orderBy: { code: "asc" },
  })
  return {
    headers: [
      "Código",
      "Nome",
      "Categoria",
      "Marca",
      "Modelo",
      "Diária",
      "Status",
      "Total Locações",
      "Receita Total",
    ],
    rows: equipment.map((e) => [
      e.code,
      e.name,
      e.category.name,
      e.brand || "",
      e.model || "",
      Number(e.dailyRate),
      e.status,
      e.totalRentals,
      Number(e.totalRevenue),
    ]),
    columnFormat: [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "currency",
      undefined,
      "integer",
      "currency",
    ],
  }
}

async function buildCustomersReport(companyId: string): Promise<ReportData> {
  const customers = await prisma.customer.findMany({
    where: { companyId, isBlocked: false },
    orderBy: { name: "asc" },
  })
  return {
    headers: [
      "Nome",
      "Documento",
      "Tipo",
      "Telefone",
      "Email",
      "Cidade",
      "Score de Crédito",
      "Total Locações",
      "Total Gasto",
      "Pendente",
    ],
    rows: customers.map((c) => [
      c.name,
      c.document,
      c.documentType,
      c.phone,
      c.email || "",
      c.city || "",
      c.creditScore,
      c.totalRentals,
      Number(c.totalSpent),
      Number(c.totalPending),
    ]),
    columnFormat: [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "integer",
      "currency",
      "currency",
    ],
  }
}

async function buildRentalsReport(companyId: string): Promise<ReportData> {
  const rentals = await prisma.rental.findMany({
    where: { companyId, deletedAt: null },
    include: {
      customer: { select: { name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  })
  return {
    headers: [
      "Contrato",
      "Cliente",
      "Data Início",
      "Data Fim Prevista",
      "Data Fim Real",
      "Status",
      "Subtotal",
      "Taxa Entrega",
      "Desconto",
      "Multa",
      "Total",
      "Status Pagamento",
    ],
    rows: rentals.map((r) => [
      r.contractNumber,
      r.customer.name,
      new Date(r.startDate),
      new Date(r.expectedEndDate),
      r.actualEndDate ? new Date(r.actualEndDate) : "",
      r.status,
      Number(r.subtotal),
      Number(r.deliveryFee),
      Number(r.discount),
      Number(r.lateFee),
      Number(r.total),
      r.paymentStatus,
    ]),
    columnFormat: [
      "integer",
      undefined,
      "date",
      "date",
      "date",
      undefined,
      "currency",
      "currency",
      "currency",
      "currency",
      "currency",
      undefined,
    ],
  }
}

async function buildFinancialReport(companyId: string): Promise<ReportData> {
  const rentals = await prisma.rental.findMany({
    where: { companyId, deletedAt: null },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })
  return {
    headers: ["Data", "Contrato", "Cliente", "Valor", "Status Pagamento", "Método Pagamento"],
    rows: rentals.map((r) => [
      new Date(r.createdAt),
      r.contractNumber,
      r.customer.name,
      Number(r.total),
      r.paymentStatus,
      r.paymentMethod || "",
    ]),
    columnFormat: ["date", "integer", undefined, "currency", undefined, undefined],
  }
}

export async function GET(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "equipment"
    const format = searchParams.get("format") || "csv"

    let data: ReportData
    let filename: string
    let sheetName: string

    switch (type) {
      case "customers":
        data = await buildCustomersReport(companyId)
        filename = "relatorio-clientes"
        sheetName = "Clientes"
        break
      case "rentals":
        data = await buildRentalsReport(companyId)
        filename = "relatorio-locacoes"
        sheetName = "Locações"
        break
      case "financial":
        data = await buildFinancialReport(companyId)
        filename = "relatorio-financeiro"
        sheetName = "Financeiro"
        break
      default:
        data = await buildEquipmentReport(companyId)
        filename = "relatorio-equipamentos"
        sheetName = "Equipamentos"
    }

    if (format === "xlsx") {
      const buffer = await toXLSX(data, sheetName)
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      })
    }

    const csv = toCSV(data)
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    })
  } catch (error) {
    console.error("Error exporting report:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao exportar relatório" },
      { status: 500 }
    )
  }
}
