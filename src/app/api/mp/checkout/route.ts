import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession, requirePermission } from "@/lib/session"
import { mpPreapproval, isMpConfigured } from "@/lib/payments/mercadopago"
import { PLAN_PRICES } from "@/lib/plan-limits"
import { rateLimit } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    if (!isMpConfigured() || !mpPreapproval) {
      return NextResponse.json(
        { error: "Mercado Pago não configurado" },
        { status: 503 }
      )
    }

    const companyId = (await requirePermission("company.update")).companyId

    const rl = rateLimit({
      key: `mp-checkout:${companyId}`,
      limit: 5,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Tente em ${rl.retryAfterSeconds}s.` },
        { status: 429 }
      )
    }

    const session = await getSession()
    const { plan } = await request.json()

    if (!["STARTER", "PRO"].includes(plan)) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
    }

    const price = PLAN_PRICES[plan as "STARTER" | "PRO"]
    if (!price || price <= 0) {
      return NextResponse.json({ error: "Plano sem preço configurado" }, { status: 400 })
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true, mpPreapprovalId: true },
    })
    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
    }

    // Se a empresa já tem assinatura no MP, checa o status antes de criar
    // outra. Sem essa proteção, clique duplo no botão "Assinar" criaria duas
    // preapprovals e o cliente acabaria pagando 2x.
    if (company.mpPreapprovalId) {
      try {
        const existing = await mpPreapproval.get({ id: company.mpPreapprovalId })
        if (existing && existing.status === "authorized") {
          return NextResponse.json(
            {
              error: "Você já tem uma assinatura ativa. Gerencie em /seguranca.",
              preapprovalId: existing.id,
            },
            { status: 409 }
          )
        }
        // Se estiver "pending", reaproveita o init_point pra não criar duplicata
        if (existing && existing.status === "pending" && existing.init_point) {
          return NextResponse.json({
            url: existing.init_point,
            preapprovalId: existing.id,
            reused: true,
          })
        }
        // Outros status (cancelled, paused) — segue e cria nova
      } catch (err) {
        // Se o MP retornar erro consultando, log e segue (não bloqueia upgrade)
        console.warn("[mp checkout] falha consultando preapproval existente:", err)
      }
    }

    const payerEmail = company.email || session?.user?.email
    if (!payerEmail) {
      return NextResponse.json(
        { error: "Empresa precisa de email cadastrado pra contratar" },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

    const preapproval = await mpPreapproval.create({
      body: {
        reason: `LocaTech ${plan} - Assinatura mensal`,
        external_reference: `${companyId}:${plan}`,
        payer_email: payerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: price,
          currency_id: "BRL",
        },
        back_url: `${baseUrl}/upgrade/success`,
        status: "pending",
      },
    })

    if (!preapproval.init_point) {
      return NextResponse.json(
        { error: "Mercado Pago não retornou URL de checkout" },
        { status: 502 }
      )
    }

    return NextResponse.json({ url: preapproval.init_point, preapprovalId: preapproval.id })
  } catch (error) {
    console.error("Error creating MP preapproval:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    if (error instanceof Error && error.message === "Acesso negado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    return NextResponse.json(
      { error: "Erro ao iniciar assinatura no Mercado Pago" },
      { status: 500 }
    )
  }
}
