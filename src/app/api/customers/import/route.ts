import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { canAddCustomer, getUpgradeMessage } from "@/lib/plan-limits"
import { validateDocument } from "@/lib/validators"
import { splitCsvLine, parseCsvHeader, readCsvCell, parseCsvNumber } from "@/lib/csv"
import { z } from "zod"

const HEADERS = [
  "name",
  "document",
  "documentType",
  "phone",
  "email",
  "address",
  "city",
  "state",
  "zipCode",
  "creditLimit",
  "notes",
] as const

const REQUIRED = ["name", "document", "phone"] as const

const rowSchema = z.object({
  name: z.string().min(1),
  document: z.string().min(11),
  documentType: z.enum(["CPF", "CNPJ"]).default("CPF"),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  creditLimit: z.number().positive().optional(),
  notes: z.string().optional(),
})

function inferDocumentType(doc: string): "CPF" | "CNPJ" {
  const digits = doc.replace(/\D/g, "")
  return digits.length === 14 ? "CNPJ" : "CPF"
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("customer.create")
    const companyId = user.companyId

    const body = await request.json()
    const csv = typeof body?.csv === "string" ? (body.csv as string) : ""
    if (!csv.trim()) {
      return NextResponse.json({ error: "CSV vazio" }, { status: 400 })
    }

    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV precisa ter cabeçalho + ao menos 1 linha" },
        { status: 400 }
      )
    }

    let headerIndex: Record<string, number>
    try {
      headerIndex = parseCsvHeader(lines[0], HEADERS, REQUIRED)
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 })
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { plan: true },
    })
    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
    }
    const currentCount = await prisma.customer.count({ where: { companyId } })

    const errors: { line: number; error: string }[] = []
    const created: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1
      const cells = splitCsvLine(lines[i])

      const docRaw = readCsvCell(cells, headerIndex, "document")?.trim() || ""
      const doc = docRaw.replace(/\D/g, "")
      const docTypeRaw = readCsvCell(cells, headerIndex, "documentType")?.trim().toUpperCase()
      const documentType =
        docTypeRaw === "CPF" || docTypeRaw === "CNPJ"
          ? (docTypeRaw as "CPF" | "CNPJ")
          : inferDocumentType(doc)

      const raw = {
        name: readCsvCell(cells, headerIndex, "name")?.trim(),
        document: doc,
        documentType,
        phone: readCsvCell(cells, headerIndex, "phone")?.replace(/\D/g, ""),
        email: readCsvCell(cells, headerIndex, "email")?.trim() || undefined,
        address: readCsvCell(cells, headerIndex, "address")?.trim() || undefined,
        city: readCsvCell(cells, headerIndex, "city")?.trim() || undefined,
        state: readCsvCell(cells, headerIndex, "state")?.trim() || undefined,
        zipCode: readCsvCell(cells, headerIndex, "zipCode")?.replace(/\D/g, "") || undefined,
        creditLimit: parseCsvNumber(readCsvCell(cells, headerIndex, "creditLimit")),
        notes: readCsvCell(cells, headerIndex, "notes")?.trim() || undefined,
      }

      const parsed = rowSchema.safeParse(raw)
      if (!parsed.success) {
        errors.push({
          line: lineNum,
          error: parsed.error.errors
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join("; "),
        })
        continue
      }
      const data = parsed.data

      if (!validateDocument(data.document, data.documentType)) {
        errors.push({ line: lineNum, error: `${data.documentType} inválido: ${data.document}` })
        continue
      }

      if (!canAddCustomer(company.plan, currentCount + created.length)) {
        errors.push({ line: lineNum, error: getUpgradeMessage(company.plan, "customers") })
        break
      }

      const dup = await prisma.customer.findUnique({
        where: { companyId_document: { companyId, document: data.document } },
      })
      if (dup) {
        errors.push({ line: lineNum, error: `Documento ${data.document} já cadastrado` })
        continue
      }

      try {
        const customer = await prisma.customer.create({
          data: {
            companyId,
            name: data.name,
            document: data.document,
            documentType: data.documentType,
            phone: data.phone!,
            email: data.email ?? null,
            address: data.address ?? null,
            city: data.city ?? null,
            state: data.state ?? null,
            zipCode: data.zipCode ?? null,
            creditLimit: data.creditLimit ?? null,
            notes: data.notes ?? null,
          },
        })
        created.push(customer.id)
      } catch (err) {
        errors.push({ line: lineNum, error: (err as Error).message })
      }
    }

    return NextResponse.json({
      success: true,
      processed: lines.length - 1,
      created: created.length,
      errors,
    })
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado") return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("Error importing customers:", error)
    return NextResponse.json(
      { error: "Erro ao importar clientes" },
      { status: 500 }
    )
  }
}
