import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { canAddEquipment, getUpgradeMessage } from "@/lib/plan-limits"
import { splitCsvLine, parseCsvHeader, readCsvCell, parseCsvNumber } from "@/lib/csv"
import { z } from "zod"

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

const REQUIRED = ["categoryName", "code", "name", "dailyRate"] as const
const MAX_ROWS = 5000

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
      return NextResponse.json(
        { error: "CSV precisa ter cabeçalho + ao menos 1 linha" },
        { status: 400 }
      )
    }
    if (lines.length - 1 > MAX_ROWS) {
      return NextResponse.json(
        { error: `Limite de ${MAX_ROWS} linhas por importação` },
        { status: 413 }
      )
    }

    let headerIndex: Record<string, number>
    try {
      headerIndex = parseCsvHeader(lines[0], HEADERS, REQUIRED)
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 })
    }

    const [company, currentCount, categories, existingEquip] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId }, select: { plan: true } }),
      prisma.equipment.count({ where: { companyId } }),
      prisma.equipmentCategory.findMany({ where: { companyId } }),
      prisma.equipment.findMany({ where: { companyId }, select: { code: true } }),
    ])
    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
    }

    const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))
    const knownCodes = new Set(existingEquip.map((e) => e.code))
    const newCategoriesNeeded = new Map<string, string>() // lower → original name

    type Valid = z.infer<typeof rowSchema>
    const validRows: { line: number; data: Valid }[] = []
    const errors: { line: number; error: string }[] = []

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1
      const cells = splitCsvLine(lines[i])

      const raw = {
        categoryName: readCsvCell(cells, headerIndex, "categoryName")?.trim(),
        code: readCsvCell(cells, headerIndex, "code")?.trim(),
        name: readCsvCell(cells, headerIndex, "name")?.trim(),
        brand: readCsvCell(cells, headerIndex, "brand")?.trim() || undefined,
        model: readCsvCell(cells, headerIndex, "model")?.trim() || undefined,
        serialNumber: readCsvCell(cells, headerIndex, "serialNumber")?.trim() || undefined,
        description: readCsvCell(cells, headerIndex, "description")?.trim() || undefined,
        dailyRate: parseCsvNumber(readCsvCell(cells, headerIndex, "dailyRate")),
        weeklyRate: parseCsvNumber(readCsvCell(cells, headerIndex, "weeklyRate")),
        monthlyRate: parseCsvNumber(readCsvCell(cells, headerIndex, "monthlyRate")),
        depositAmount: parseCsvNumber(readCsvCell(cells, headerIndex, "depositAmount")),
      }

      const parsed = rowSchema.safeParse(raw)
      if (!parsed.success) {
        errors.push({
          line: lineNum,
          error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
        })
        continue
      }
      const data = parsed.data

      if (knownCodes.has(data.code)) {
        errors.push({ line: lineNum, error: `Código "${data.code}" já existe (ou duplicado no CSV)` })
        continue
      }
      knownCodes.add(data.code)

      // Rastreia categorias que ainda não existem — criadas em batch na tx
      const catLower = data.categoryName.toLowerCase()
      if (!catByName.has(catLower)) {
        newCategoriesNeeded.set(catLower, data.categoryName)
      }

      validRows.push({ line: lineNum, data })
    }

    if (!canAddEquipment(company.plan, currentCount + validRows.length)) {
      errors.push({
        line: 0,
        error: getUpgradeMessage(company.plan, "equipment"),
      })
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Importação cancelada — nenhuma linha foi salva. Corrija os erros e reenvie.",
          processed: lines.length - 1,
          created: 0,
          errors,
        },
        { status: 422 }
      )
    }

    // Tudo atômico: cria categorias novas + equipamentos
    const created = await prisma.$transaction(async (tx) => {
      for (const [lower, originalName] of newCategoriesNeeded) {
        const cat = await tx.equipmentCategory.create({
          data: { companyId, name: originalName },
        })
        catByName.set(lower, cat)
      }

      const ids: string[] = []
      for (const row of validRows) {
        const category = catByName.get(row.data.categoryName.toLowerCase())!
        const eq = await tx.equipment.create({
          data: {
            companyId,
            categoryId: category.id,
            code: row.data.code,
            name: row.data.name,
            brand: row.data.brand ?? null,
            model: row.data.model ?? null,
            serialNumber: row.data.serialNumber ?? null,
            description: row.data.description ?? null,
            dailyRate: row.data.dailyRate,
            weeklyRate: row.data.weeklyRate ?? null,
            monthlyRate: row.data.monthlyRate ?? null,
            depositAmount: row.data.depositAmount ?? null,
          },
        })
        ids.push(eq.id)
      }
      return ids
    })

    return NextResponse.json({
      success: true,
      processed: lines.length - 1,
      created: created.length,
      errors: [],
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
