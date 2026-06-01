import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { generateApiKey } from "@/lib/api-key"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.string().optional().nullable(),
})

export async function GET() {
  try {
    const user = await requirePermission("company.update")
    const keys = await prisma.apiKey.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        name: true,
        keyLast4: true,
        permissions: true,
        rateLimit: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(keys)
  } catch (error) {
    return handle(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("company.update")

    // Checa se a empresa está no plano PRO (API só nesse plano, conforme plan-limits)
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { plan: true },
    })
    if (company?.plan !== "PRO") {
      return NextResponse.json(
        {
          error:
            "API pública disponível apenas no plano Profissional. Faça upgrade em /upgrade.",
        },
        { status: 402 }
      )
    }

    const body = await request.json()
    const data = createSchema.parse(body)

    const { raw, hash, last4 } = generateApiKey()

    const apiKey = await prisma.apiKey.create({
      data: {
        companyId: user.companyId,
        name: data.name,
        keyHash: hash,
        keyLast4: last4,
        permissions: data.permissions ?? [],
        rateLimit: data.rateLimit ?? 60,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        keyLast4: true,
        rateLimit: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    // Retorna o valor cru APENAS aqui. Cliente precisa salvar.
    return NextResponse.json(
      { ...apiKey, key: raw, warning: "Guarde esta key — ela não será exibida novamente." },
      { status: 201 }
    )
  } catch (error) {
    return handle(error)
  }
}

function handle(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Dados inválidos", details: error.errors },
      { status: 400 }
    )
  }
  if (error instanceof Error) {
    const status = (error as Error & { status?: number }).status
    if (error.message === "Não autorizado")
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    if (status === 403 || error.message === "Acesso negado")
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  console.error("[api-keys] error:", error)
  return NextResponse.json({ error: "Erro interno" }, { status: 500 })
}
