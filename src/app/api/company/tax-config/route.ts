import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { hasFeature } from "@/lib/plan-limits"
import { z } from "zod"

const taxConfigSchema = z.object({
  cnpj: z.string().min(14).max(20),
  inscricaoMunicipal: z.string().optional().nullable(),
  inscricaoEstadual: z.string().optional().nullable(),
  taxRegime: z.enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MEI"]),
  serviceCode: z.string().optional().nullable(),
  issRate: z.number().min(0).max(100),
  provider: z.enum(["MOCK", "FOCUS_NFE", "PLUG_NOTAS", "E_NOTAS"]),
  providerCredentials: z.record(z.string()).optional().nullable(),
  providerEnv: z.enum(["sandbox", "production"]),
  autoIssueOnRentalCompletion: z.boolean(),
})

export async function GET() {
  try {
    const user = await requirePermission("company.update")
    const config = await prisma.companyTaxConfig.findUnique({
      where: { companyId: user.companyId },
    })
    if (!config) {
      return NextResponse.json(null)
    }
    // Não expõe credenciais cruas — só indica se está configurado
    const { providerCredentials, ...rest } = config
    return NextResponse.json({
      ...rest,
      issRate: Number(config.issRate),
      hasCredentials: !!providerCredentials && Object.keys(providerCredentials as object).length > 0,
    })
  } catch (error) {
    return handle(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requirePermission("company.update")

    // Gate de plano: emissão de NF só em STARTER/PRO
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { plan: true },
    })
    if (!company || !hasFeature(company.plan, "invoices")) {
      return NextResponse.json(
        {
          error:
            "Emissão de notas fiscais disponível apenas nos planos Starter e Profissional. Faça upgrade em /upgrade.",
        },
        { status: 402 }
      )
    }

    const body = await request.json()
    const data = taxConfigSchema.parse(body)

    const creds = data.providerCredentials // pode ser undefined/null/Record
    const config = await prisma.companyTaxConfig.upsert({
      where: { companyId: user.companyId },
      create: {
        companyId: user.companyId,
        cnpj: data.cnpj,
        inscricaoMunicipal: data.inscricaoMunicipal ?? null,
        inscricaoEstadual: data.inscricaoEstadual ?? null,
        taxRegime: data.taxRegime,
        serviceCode: data.serviceCode ?? null,
        issRate: data.issRate,
        provider: data.provider,
        ...(creds ? { providerCredentials: creds } : {}),
        providerEnv: data.providerEnv,
        autoIssueOnRentalCompletion: data.autoIssueOnRentalCompletion,
      },
      update: {
        cnpj: data.cnpj,
        inscricaoMunicipal: data.inscricaoMunicipal ?? null,
        inscricaoEstadual: data.inscricaoEstadual ?? null,
        taxRegime: data.taxRegime,
        serviceCode: data.serviceCode ?? null,
        issRate: data.issRate,
        provider: data.provider,
        // Só atualiza credenciais se vier valor truthy — assim a UI pode salvar
        // outras configurações sem precisar re-enviar a credencial cada vez.
        ...(creds ? { providerCredentials: creds } : {}),
        providerEnv: data.providerEnv,
        autoIssueOnRentalCompletion: data.autoIssueOnRentalCompletion,
      },
    })

    return NextResponse.json({ success: true, id: config.id })
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
  console.error("[tax-config] error:", error)
  return NextResponse.json({ error: "Erro interno" }, { status: 500 })
}
