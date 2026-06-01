import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { canAddEquipment, getUpgradeMessage } from "@/lib/plan-limits"
import { z } from "zod"

// Schema de cada linha
const rowSchema = z.object({
  categoryName: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  description: z.string().optional(),
  dailyRate: z.number().positive(),
  weeklyRate: z.number().positive().optional(),
  monthlyRate: z.number().positive().optional(),
  depositAmount: z.number().positive().optional(),
})

const HEADERS = [
  "categoryName",
  "code",
  "name",
  "brand",
  "model",
  "serialNumber",
  "description",
  "dailyRate",
  "weeklyRate",
  "monthlyRate",
  "depositAmount",
] as const

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((ch === "," || ch === ";") && !inQuotes) {
      out.push(cur)
      cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

function parseNumber(v: string | undefined): number | undefined {
  if (v === undefined || v === "") return undefined
  // aceita "1.234,56" e "1234.56"
  const normalized = v.includes(",") && !v.includes(".") ? v.replace(",", ".") : v.replace(/\./g, "").replace(",", ".")
  const n = Number(normalized)
  return isNaN(n) ? undefined : n
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("equipment.import")
    const companyId = user.companyId

    const body = await request.json()
    const csv = typeof body?.csv === "string" ? (body.csv as string) : ""
    if (!csv.trim()) {
      return NextResponse.json({ error: "CSV vazio" }, { status: 400 })
    }

    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV precisa ter cabeçalho + ao menos 1 linha" }, { status: 400 })
    }

    const headerCells = splitCsvLine(lines[0]).map((c) => c.toLowerCase())
    const headerIndex: Record<string, number> = {}
    for (const h of HEADERS) {
      const idx = headerCells.indexOf(h.toLowerCase())
      if (idx !== -1) headerIndex[h] = idx
    }

    const required = ["categoryName", "code", "name", "dailyRate"]
    const missing = required.filter((r) => headerIndex[r] === undefined)
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Cabeçalho ausente das colunas obrigatórias: ${missing.join(", ")}` },
        { status: 400 }
      )
    }

    // Carrega plano e contagem atual
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { plan: true },
    })
    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
    }
    const currentCount = await prisma.equipment.count({ where: { companyId } })

    // Pré-carrega categorias da empresa (case-insensitive)
    const categories = await prisma.equipmentCategory.findMany({ where: { companyId } })
    const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))

    const errors: { line: number; error: string }[] = []
    const created: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1
      const cells = splitCsvLine(lines[i])

      const get = (key: string) => {
        const idx = headerIndex[key]
        return idx === undefined ? undefined : cells[idx]
      }

      const raw = {
        categoryName: get("categoryName")?.trim(),
        code: get("code")?.trim(),
        name: get("name")?.trim(),
        brand: get("brand")?.trim() || undefined,
        model: get("model")?.trim() || undefined,
        serialNumber: get("serialNumber")?.trim() || undefined,
        description: get("description")?.trim() || undefined,
        dailyRate: parseNumber(get("dailyRate")),
        weeklyRate: parseNumber(get("weeklyRate")),
        monthlyRate: parseNumber(get("monthlyRate")),
        depositAmount: parseNumber(get("depositAmount")),
      }

      const parsed = rowSchema.safeParse(raw)
      if (!parsed.success) {
        errors.push({ line: lineNum, error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") })
        continue
      }
      const data = parsed.data

      if (!canAddEquipment(company.plan, currentCount + created.length)) {
        errors.push({ line: lineNum, error: getUpgradeMessage(company.plan, "equipment") })
        break
      }

      // Resolve categoria (criar se não existir)
      let category = catByName.get(data.categoryName.toLowerCase())
      if (!category) {
        try {
          category = await prisma.equipmentCategory.create({
            data: { companyId, name: data.categoryName },
          })
          catByName.set(data.categoryName.toLowerCase(), category)
        } catch (err) {
          errors.push({ line: lineNum, error: `Falha ao criar categoria "${data.categoryName}"` })
          continue
        }
      }

      // Verifica duplicidade de código
      const dup = await prisma.equipment.findUnique({
        where: { companyId_code: { companyId, code: data.code } },
      })
      if (dup) {
        errors.push({ line: lineNum, error: `Código "${data.code}" já existe` })
        continue
      }

      try {
        const eq = await prisma.equipment.create({
          data: {
            companyId,
            categoryId: category.id,
            code: data.code,
            name: data.name,
            brand: data.brand,
            model: data.model,
            serialNumber: data.serialNumber,
            description: data.description,
            dailyRate: data.dailyRate,
            weeklyRate: data.weeklyRate ?? null,
            monthlyRate: data.monthlyRate ?? null,
            depositAmount: data.depositAmount ?? null,
          },
        })
        created.push(eq.id)
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
    console.error("Error importing equipment:", error)
    return NextResponse.json(
      { error: "Erro ao importar equipamentos" },
      { status: 500 }
    )
  }
}
