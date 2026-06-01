import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, getSession } from "@/lib/session"
import { mpPreapproval, isMpConfigured } from "@/lib/payments/mercadopago"
import { PLAN_PRICES } from "@/lib/plan-limits"

export async function POST(request: NextRequest) {
  try {
    if (!isMpConfigured() || !mpPreapproval) {
      return NextResponse.json(
        { error: "Mercado Pago não configurado" },
        { status: 503 }
      )
    }

    const companyId = await requireCompanyId()
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
      select: { name: true, email: true },
    })
    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
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
    return NextResponse.json(
      { error: "Erro ao iniciar assinatura no Mercado Pago" },
      { status: 500 }
    )
  }
}
