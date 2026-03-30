import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, getSession } from "@/lib/session"
import Stripe from "stripe"

// Initialize Stripe only if API key is available
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    })
  : null

const PRICE_IDS = {
  STARTER: process.env.STRIPE_STARTER_PRICE_ID!,
  PRO: process.env.STRIPE_PRO_PRICE_ID!,
}

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 503 }
      )
    }

    const companyId = await requireCompanyId()
    const session = await getSession()
    const { plan } = await request.json()

    if (!["STARTER", "PRO"].includes(plan)) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
    }

    // Get company info
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true },
    })

    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 })
    }

    // Create Stripe checkout session
    const customerEmail = company.email || session?.user?.email || undefined
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: customerEmail ?? undefined,
      line_items: [
        {
          price: PRICE_IDS[plan as keyof typeof PRICE_IDS],
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/upgrade`,
      metadata: {
        companyId,
        plan,
      },
      subscription_data: {
        metadata: {
          companyId,
          plan,
        },
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error("Error creating checkout session:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao criar sessão de checkout" },
      { status: 500 }
    )
  }
}
