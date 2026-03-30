import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"
import { CompanyPlan } from "@prisma/client"

// Initialize Stripe only if API key is available
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    })
  : null

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ""

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 503 }
      )
    }

    const body = await request.text()
    const signature = request.headers.get("stripe-signature")!

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error("Webhook signature verification failed:", err)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const { companyId, plan } = session.metadata || {}

        if (companyId && plan) {
          // Calculate expiration date (1 month from now)
          const planExpiresAt = new Date()
          planExpiresAt.setMonth(planExpiresAt.getMonth() + 1)

          await prisma.company.update({
            where: { id: companyId },
            data: {
              plan: plan as CompanyPlan,
              planExpiresAt,
            },
          })

          console.log(`Company ${companyId} upgraded to ${plan}`)
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any
        const { companyId, plan } = subscription.metadata || {}

        if (companyId && subscription.status === "active") {
          const planExpiresAt = new Date((subscription.current_period_end || 0) * 1000)

          await prisma.company.update({
            where: { id: companyId },
            data: {
              plan: plan as CompanyPlan,
              planExpiresAt,
            },
          })
        }
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any
        const { companyId } = subscription.metadata || {}

        if (companyId) {
          await prisma.company.update({
            where: { id: companyId },
            data: {
              plan: "FREE",
              planExpiresAt: null,
            },
          })

          console.log(`Company ${companyId} downgraded to FREE`)
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any
          const { companyId } = subscription.metadata || {}

          if (companyId) {
            // Could send a notification here about failed payment
            console.log(`Payment failed for company ${companyId}`)
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Webhook error" }, { status: 500 })
  }
}
