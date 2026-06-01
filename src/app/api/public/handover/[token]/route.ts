import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { dispatchWebhooks } from "@/lib/webhooks"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { z } from "zod"

/**
 * Endpoints **públicos** (sem auth) usados pela página `/entrega/[token]`.
 *
 * GET   → retorna dados da locação pro cliente conferir
 * POST  → cliente confirma + assina (opcional). Marca handoverConfirmedAt e muda
 *         status pra IN_PROGRESS.
 */

async function loadByToken(token: string) {
  const rental = await prisma.rental.findUnique({
    where: { handoverToken: token },
    include: {
      customer: { select: { name: true, document: true } },
      company: { select: { name: true, logoUrl: true, primaryColor: true } },
      items: {
        select: {
          equipmentCode: true,
          equipmentName: true,
          quantity: true,
          days: true,
          subtotal: true,
        },
      },
    },
  })
  return rental
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const rental = await loadByToken(token)
  if (!rental) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 })
  }
  if (rental.handoverTokenExpiresAt && rental.handoverTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "Token expirado" }, { status: 410 })
  }
  if (rental.handoverConfirmedAt) {
    return NextResponse.json(
      { error: "Entrega já confirmada", confirmedAt: rental.handoverConfirmedAt },
      { status: 410 }
    )
  }

  return NextResponse.json({
    company: rental.company,
    customer: rental.customer,
    rental: {
      id: rental.id,
      contractNumber: rental.contractNumber,
      startDate: rental.startDate,
      expectedEndDate: rental.expectedEndDate,
      total: Number(rental.total),
      depositAmount: Number(rental.depositAmount),
      type: rental.type,
      deliveryAddress: rental.deliveryAddress,
    },
    items: rental.items.map((i) => ({ ...i, subtotal: Number(i.subtotal) })),
    expiresAt: rental.handoverTokenExpiresAt,
  })
}

const confirmSchema = z.object({
  /** PNG base64 data URL da assinatura (opcional). */
  signatureDataUrl: z.string().startsWith("data:image/").optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Rate limit: 10 confirmações por hora por IP — protege contra brute force de tokens
    const ip = getClientIp(request.headers)
    const rl = rateLimit({
      key: `handover-confirm:${ip}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Aguarde ${rl.retryAfterSeconds}s.` },
        { status: 429 }
      )
    }

    const { token } = await params
    const body = await request.json().catch(() => ({}))
    const data = confirmSchema.parse(body)

    const rental = await loadByToken(token)
    if (!rental) {
      return NextResponse.json({ error: "Token inválido" }, { status: 404 })
    }
    if (rental.handoverTokenExpiresAt && rental.handoverTokenExpiresAt < new Date()) {
      return NextResponse.json({ error: "Token expirado" }, { status: 410 })
    }
    if (rental.handoverConfirmedAt) {
      return NextResponse.json({ error: "Entrega já confirmada" }, { status: 410 })
    }

    const now = new Date()
    await prisma.rental.update({
      where: { id: rental.id },
      data: {
        handoverConfirmedAt: now,
        status: "IN_PROGRESS",
        customerSignatureUrl: data.signatureDataUrl ?? rental.customerSignatureUrl,
        customerSignedAt: data.signatureDataUrl ? now : rental.customerSignedAt,
        customerSignedIp: data.signatureDataUrl ? ip : rental.customerSignedIp,
        // Token usado — invalida pra evitar reuso
        handoverToken: null,
        handoverTokenExpiresAt: null,
      },
    })

    void dispatchWebhooks({
      companyId: rental.companyId,
      event: "rental.confirmed",
      data: {
        rentalId: rental.id,
        contractNumber: rental.contractNumber,
        confirmedAt: now.toISOString(),
        signed: !!data.signatureDataUrl,
      },
    })

    return NextResponse.json({ success: true, confirmedAt: now })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    console.error("[handover confirm] error:", error)
    return NextResponse.json({ error: "Erro ao confirmar" }, { status: 500 })
  }
}
