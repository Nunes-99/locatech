import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { z } from "zod"

async function loadByToken(token: string) {
  return prisma.rental.findUnique({
    where: { returnToken: token },
    include: {
      customer: { select: { name: true } },
      company: { select: { name: true, logoUrl: true, primaryColor: true } },
      items: {
        select: {
          id: true,
          equipmentCode: true,
          equipmentName: true,
          quantity: true,
        },
      },
    },
  })
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
  if (rental.returnTokenExpiresAt && rental.returnTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "Token expirado" }, { status: 410 })
  }
  if (rental.returnConfirmedAt) {
    return NextResponse.json(
      { error: "Devolução já registrada", confirmedAt: rental.returnConfirmedAt },
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
    },
    items: rental.items,
  })
}

const confirmSchema = z.object({
  /** Reportes por item (id → condição). Se vazio, assume OK em tudo. */
  conditions: z
    .array(
      z.object({
        itemId: z.string(),
        condition: z.enum(["OK", "DAMAGED"]),
        notes: z.string().max(500).optional(),
      })
    )
    .optional(),
  customerNotes: z.string().max(2000).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getClientIp(request.headers)
    const rl = rateLimit({
      key: `return-confirm:${ip}`,
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
    if (rental.returnTokenExpiresAt && rental.returnTokenExpiresAt < new Date()) {
      return NextResponse.json({ error: "Token expirado" }, { status: 410 })
    }
    if (rental.returnConfirmedAt) {
      return NextResponse.json({ error: "Devolução já registrada" }, { status: 410 })
    }

    const now = new Date()
    const hasDamage = data.conditions?.some((c) => c.condition === "DAMAGED") ?? false

    // Antes (CRITICAL bug): atacante com 1 token de devolução podia POSTar
    // `conditions: [{itemId: <id de OUTRA locação>, condition: "DAMAGED", notes: "..."}]`
    // e flagar items de qualquer outra empresa como danificados — write
    // cross-tenant sem auth. Agora restringimos ao set de itemIds que vêm
    // com o rental carregado pelo token.
    const validItemIds = new Set(rental.items.map((i) => i.id))

    await prisma.$transaction(async (tx) => {
      if (data.conditions) {
        for (const c of data.conditions) {
          if (!validItemIds.has(c.itemId)) {
            // Silenciosamente pula em vez de 400 — atacante não consegue
            // confirmar quais IDs existem via probing. Em dev, log.
            console.warn(
              `[return confirm] itemId ${c.itemId} não pertence ao rental ${rental.id}, ignorado`
            )
            continue
          }
          // updateMany com rentalId no where = defesa dupla (set check + DB guard)
          await tx.rentalItem.updateMany({
            where: { id: c.itemId, rentalId: rental.id },
            data: {
              returnCondition: c.condition,
              damageNotes: c.notes ?? null,
            },
          })
        }
      }

      // Marca o token como usado mas NÃO finaliza a locação automaticamente.
      // O operador valida danos + cobrança + libera caução manualmente via /api/rentals/[id]/return.
      // Este endpoint só registra o input do cliente.
      await tx.rental.update({
        where: { id: rental.id },
        data: {
          returnConfirmedAt: now,
          returnToken: null,
          returnTokenExpiresAt: null,
          internalNotes: data.customerNotes
            ? `${rental.internalNotes ?? ""}\n[Cliente em ${now.toLocaleString("pt-BR")}]: ${data.customerNotes}`.trim()
            : rental.internalNotes,
        },
      })
    })

    return NextResponse.json({
      success: true,
      hasDamage,
      message:
        "Devolução registrada. O operador irá conferir os equipamentos e finalizar o contrato.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    console.error("[return confirm] error:", error)
    return NextResponse.json({ error: "Erro ao confirmar" }, { status: 500 })
  }
}
