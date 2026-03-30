import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"

// Helper to convert data to CSV
function toCSV(headers: string[], rows: string[][]): string {
  const headerRow = headers.join(",")
  const dataRows = rows.map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  )
  return [headerRow, ...dataRows].join("\n")
}

export async function GET(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "equipment"
    const format = searchParams.get("format") || "csv"

    let data: { headers: string[]; rows: string[][] } = { headers: [], rows: [] }
    let filename = "relatorio"

    if (type === "equipment") {
      const equipment = await prisma.equipment.findMany({
        where: { companyId, status: { not: "RETIRED" } },
        include: { category: true },
        orderBy: { code: "asc" },
      })

      data = {
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
          Number(e.dailyRate).toFixed(2),
          e.status,
          String(e.totalRentals),
          Number(e.totalRevenue).toFixed(2),
        ]),
      }
      filename = "relatorio-equipamentos"
    }

    if (type === "customers") {
      const customers = await prisma.customer.findMany({
        where: { companyId, isBlocked: false },
        orderBy: { name: "asc" },
      })

      data = {
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
          String(c.totalRentals),
          Number(c.totalSpent).toFixed(2),
          Number(c.totalPending).toFixed(2),
        ]),
      }
      filename = "relatorio-clientes"
    }

    if (type === "rentals") {
      const rentals = await prisma.rental.findMany({
        where: { companyId },
        include: {
          customer: { select: { name: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500, // Limit to last 500 rentals
      })

      data = {
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
          String(r.contractNumber),
          r.customer.name,
          new Date(r.startDate).toLocaleDateString("pt-BR"),
          new Date(r.expectedEndDate).toLocaleDateString("pt-BR"),
          r.actualEndDate ? new Date(r.actualEndDate).toLocaleDateString("pt-BR") : "",
          r.status,
          Number(r.subtotal).toFixed(2),
          Number(r.deliveryFee).toFixed(2),
          Number(r.discount).toFixed(2),
          Number(r.lateFee).toFixed(2),
          Number(r.total).toFixed(2),
          r.paymentStatus,
        ]),
      }
      filename = "relatorio-locacoes"
    }

    if (type === "financial") {
      const rentals = await prisma.rental.findMany({
        where: { companyId },
        include: {
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      data = {
        headers: [
          "Data",
          "Contrato",
          "Cliente",
          "Valor",
          "Status Pagamento",
          "Método Pagamento",
        ],
        rows: rentals.map((r) => [
          new Date(r.createdAt).toLocaleDateString("pt-BR"),
          String(r.contractNumber),
          r.customer.name,
          Number(r.total).toFixed(2),
          r.paymentStatus,
          r.paymentMethod || "",
        ]),
      }
      filename = "relatorio-financeiro"
    }

    // Generate CSV
    const csv = toCSV(data.headers, data.rows)

    // Return as file download
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
