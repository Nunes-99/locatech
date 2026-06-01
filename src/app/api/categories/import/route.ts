import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { splitCsvLine, parseCsvHeader, readCsvCell } from "@/lib/csv"
import { z } from "zod"

const HEADERS = ["name", "description", "icon"] as const
const REQUIRED = ["name"] as const
const MAX_ROWS = 5000

const rowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("category.manage")
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

    const existing = await prisma.equipmentCategory.findMany({
      where: { companyId },
      select: { name: true },
    })
    const knownNames = new Set(existing.map((c) => c.name.toLowerCase()))

    // Pre-validação completa: sem nada gravado no DB. Se qualquer linha tem
    // erro, voltamos sem persistir nada (atomicidade).
    type Valid = z.infer<typeof rowSchema>
    const validRows: { line: number; data: Valid }[] = []
    const errors: { line: number; error: string }[] = []

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1
      const cells = splitCsvLine(lines[i])
      const raw = {
        name: readCsvCell(cells, headerIndex, "name")?.trim(),
        description: readCsvCell(cells, headerIndex, "description")?.trim() || undefined,
        icon: readCsvCell(cells, headerIndex, "icon")?.trim() || undefined,
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
      const lower = data.name.toLowerCase()
      if (knownNames.has(lower)) {
        errors.push({ line: lineNum, error: `Categoria "${data.name}" já existe (ou duplicada no CSV)` })
        continue
      }
      knownNames.add(lower) // detecta dup dentro do próprio CSV
      validRows.push({ line: lineNum, data })
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

    // Insert atômico — se qualquer create falhar, rollback completo.
    const created = await prisma.$transaction(async (tx) => {
      const ids: string[] = []
      for (const row of validRows) {
        const cat = await tx.equipmentCategory.create({
          data: {
            companyId,
            name: row.data.name,
            description: row.data.description ?? null,
            icon: row.data.icon ?? null,
          },
        })
        ids.push(cat.id)
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
    console.error("Error importing categories:", error)
    return NextResponse.json({ error: "Erro ao importar categorias" }, { status: 500 })
  }
}
