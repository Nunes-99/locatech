import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { splitCsvLine, parseCsvHeader, readCsvCell } from "@/lib/csv"
import { z } from "zod"

const HEADERS = ["name", "description", "icon"] as const
const REQUIRED = ["name"] as const

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
    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()))

    const errors: { line: number; error: string }[] = []
    const created: string[] = []

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

      if (existingNames.has(data.name.toLowerCase())) {
        errors.push({ line: lineNum, error: `Categoria "${data.name}" já existe` })
        continue
      }

      try {
        const cat = await prisma.equipmentCategory.create({
          data: {
            companyId,
            name: data.name,
            description: data.description ?? null,
            icon: data.icon ?? null,
          },
        })
        created.push(cat.id)
        existingNames.add(data.name.toLowerCase())
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
    console.error("Error importing categories:", error)
    return NextResponse.json({ error: "Erro ao importar categorias" }, { status: 500 })
  }
}
