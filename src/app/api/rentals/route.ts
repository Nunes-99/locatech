import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, requirePermission } from "@/lib/session"
import { dispatchWebhooks } from "@/lib/webhooks"
import { Prisma, RentalStatus, RentalType } from "@prisma/client"
import { z } from "zod"
import { contarDiarias } from "@/lib/diarias"

function authErrorResponse(error: Error): NextResponse | null {
  const status = (error as Error & { status?: number }).status
  if (error.message === "Não autorizado") return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  if (status === 403 || error.message === "Acesso negado")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  return null
}

const createRentalSchema = z.object({
  customerId: z.string().uuid(),
  startDate: z.string(),
  expectedEndDate: z.string(),
  type: z.enum(["DELIVERY", "PICKUP"]),
  deliveryAddress: z.string().optional(),
  depositAmount: z.number().optional(),
  notes: z.string().optional(),
  /** Se true, cria como orçamento (QUOTE) com data de expiração baseada em `Company.quoteValidDays`. */
  asQuote: z.boolean().optional(),
  items: z.array(
    z.object({
      equipmentId: z.string().uuid(),
      days: z.number().int().positive(),
      dailyRate: z.number().positive(),
    })
  ),
})

interface CreateRentalTxArgs {
  companyId: string
  customerId: string
  startDate: Date
  expectedEndDate: Date
  type: RentalType
  deliveryAddress?: string
  subtotal: number
  deliveryFee: number
  total: number
  depositAmount: number
  notes?: string
  status: RentalStatus
  quoteExpiresAt: Date | null
  rentalItems: Array<{
    equipmentId: string
    equipmentCode: string
    equipmentName: string
    dailyRate: number
    quantity: number
    days: number
    subtotal: number
  }>
}

/**
 * Roda o create + side effects dentro de uma transação. Aceita `tx` do Prisma
 * (transaction client). O `contractNumber` é calculado DENTRO da tx pra que,
 * se duas POSTs concorrentes pegarem o mesmo número, a unique constraint
 * dispare P2002 e a tx que perdeu a corrida possa retry com número novo.
 */
async function createRentalTx(tx: Prisma.TransactionClient, args: CreateRentalTxArgs) {
  // Próximo número dentro da tx — ainda pode colidir com outra tx em flight,
  // mas o unique constraint + retry-loop cuidam disso na chamada externa.
  const lastInTx = await tx.rental.findFirst({
    where: { companyId: args.companyId },
    orderBy: { contractNumber: "desc" },
    select: { contractNumber: true },
  })
  const contractNumber = (lastInTx?.contractNumber || 0) + 1

  const newRental = await tx.rental.create({
    data: {
      companyId: args.companyId,
      customerId: args.customerId,
      contractNumber,
      startDate: args.startDate,
      expectedEndDate: args.expectedEndDate,
      type: args.type,
      deliveryAddress: args.deliveryAddress,
      subtotal: args.subtotal,
      deliveryFee: args.deliveryFee,
      total: args.total,
      depositAmount: args.depositAmount,
      notes: args.notes,
      status: args.status,
      quoteExpiresAt: args.quoteExpiresAt,
      items: {
        create: args.rentalItems,
      },
    },
    include: {
      customer: true,
      items: {
        include: { equipment: true },
      },
    },
  })

  // Aloca cada equipamento condicionalmente — impede race onde 2 locações
  // simultâneas pegam o mesmo item. updateMany retorna count: só vale se = 1.
  // Orçamento NÃO prende o equipamento: só ao ser confirmado (PUT). Antes ele
  // ficava RENTED e, se o orçamento expirasse, preso para sempre.
  for (const item of args.status === "QUOTE" ? [] : args.rentalItems) {
    const claimed = await tx.equipment.updateMany({
      where: {
        id: item.equipmentId,
        companyId: args.companyId,
        status: "AVAILABLE",
      },
      data: {
        status: "RENTED",
        totalRentals: { increment: 1 },
      },
    })
    if (claimed.count !== 1) {
      throw new Error(`Equipamento ${item.equipmentId} indisponível (concorrência)`)
    }
  }

  await tx.customer.update({
    where: { id: args.customerId },
    data: { totalRentals: { increment: 1 } },
  })

  await tx.company.update({
    where: { id: args.companyId },
    data: { totalRentals: { increment: 1 } },
  })

  return newRental
}

export async function GET(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const customerId = searchParams.get("customerId")
    const search = searchParams.get("search")
    // Paginação — cap em 100 pra impedir tenants grandes de OOMar o server.
    // Default 50 cobre primeira tela. Frontend pode iterar `?page=2`.
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10) || 50)
    )

    const where: Prisma.RentalWhereInput = {
      companyId,
      deletedAt: null,
      ...(status && status !== "all" ? { status: status as any } : {}),
      ...(customerId ? { customerId } : {}),
      ...(search
        ? {
            OR: [
              { customer: { name: { contains: search, mode: "insensitive" as const } } },
              { contractNumber: { equals: parseInt(search) || -1 } },
            ],
          }
        : {}),
    }

    const [rentals, total] = await Promise.all([
      prisma.rental.findMany({
        where,
        include: {
          customer: true,
          items: { include: { equipment: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.rental.count({ where }),
    ])

    return NextResponse.json(rentals, {
      headers: {
        "X-Total-Count": String(total),
        "X-Page": String(page),
        "X-Page-Size": String(pageSize),
        "X-Total-Pages": String(Math.ceil(total / pageSize)),
      },
    })
  } catch (error) {
    console.error("Error fetching rentals:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar locações" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("rental.create")
    const companyId = user.companyId
    const body = await request.json()
    const data = createRentalSchema.parse(body)

    const inicio = new Date(data.startDate)
    const fim = new Date(data.expectedEndDate)
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      return NextResponse.json({ error: "Datas inválidas" }, { status: 400 })
    }
    if (fim <= inicio) {
      return NextResponse.json(
        { error: "A devolução prevista precisa ser depois da retirada" },
        { status: 400 }
      )
    }
    const diarias = contarDiarias(inicio, fim)

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, companyId },
      select: { id: true },
    })
    if (!customer) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    let subtotal = 0
    const rentalItems: CreateRentalTxArgs["rentalItems"] = []

    for (const item of data.items) {
      const equipment = await prisma.equipment.findFirst({
        where: { id: item.equipmentId, companyId },
      })

      if (!equipment) {
        return NextResponse.json(
          { error: `Equipamento ${item.equipmentId} não encontrado` },
          { status: 404 }
        )
      }

      if (!data.asQuote && equipment.status !== "AVAILABLE") {
        return NextResponse.json(
          { error: `Equipamento ${equipment.code} não está disponível` },
          { status: 409 }
        )
      }

      const itemSubtotal = item.dailyRate * diarias

      rentalItems.push({
        equipmentId: item.equipmentId,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        dailyRate: item.dailyRate,
        quantity: 1,
        days: diarias,
        subtotal: itemSubtotal,
      })

      subtotal += itemSubtotal
    }

    const deliveryFee = data.type === "DELIVERY" ? 50 : 0 // TODO: configurável
    const total = subtotal + deliveryFee

    let quoteExpiresAt: Date | null = null
    if (data.asQuote) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { quoteValidDays: true },
      })
      const validDays = company?.quoteValidDays ?? 7
      quoteExpiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000)
    }

    const txArgs: CreateRentalTxArgs = {
      companyId,
      customerId: data.customerId,
      startDate: inicio,
      expectedEndDate: fim,
      type: data.type,
      deliveryAddress: data.deliveryAddress,
      subtotal,
      deliveryFee,
      total,
      depositAmount: data.depositAmount || 0,
      notes: data.notes,
      status: data.asQuote ? "QUOTE" : "CONFIRMED",
      quoteExpiresAt,
      rentalItems,
    }

    // Retry-on-P2002 do contractNumber. Sem isso, duas POSTs concorrentes
    // viam o mesmo lastRental e a segunda quebrava com 500 opaco. Agora
    // recalculamos dentro da tx e fazemos retry com pequeno backoff.
    const MAX_RETRIES = 5
    let attempt = 0
    let rental: Awaited<ReturnType<typeof createRentalTx>> | null = null

    while (attempt < MAX_RETRIES) {
      try {
        rental = await prisma.$transaction((tx) =>
          // O tx do client estendido tem tipo mais largo que Prisma.TransactionClient;
          // os métodos usados são equivalentes na runtime, então cast é seguro.
          createRentalTx(tx as unknown as Prisma.TransactionClient, txArgs)
        )
        break
      } catch (e) {
        const code = (e as { code?: string }).code
        const meta = (e as { meta?: { target?: string[] | string } }).meta
        const target = Array.isArray(meta?.target) ? meta?.target : meta?.target ? [meta.target] : []
        const isContractCollision =
          code === "P2002" && target.some((t) => String(t).includes("contractNumber"))
        attempt++
        if (!isContractCollision || attempt >= MAX_RETRIES) {
          throw e
        }
        await new Promise((r) => setTimeout(r, 25 * attempt))
      }
    }

    if (!rental) {
      return NextResponse.json(
        { error: "Não foi possível gerar número de contrato após múltiplas tentativas" },
        { status: 503 }
      )
    }

    void dispatchWebhooks({
      companyId,
      event: data.asQuote ? "rental.created" : "rental.confirmed",
      data: {
        rentalId: rental.id,
        contractNumber: rental.contractNumber,
        customerId: rental.customerId,
        total: Number(rental.total),
        startDate: rental.startDate,
        expectedEndDate: rental.expectedEndDate,
        status: rental.status,
      },
    })

    return NextResponse.json(rental, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    const authError = error instanceof Error ? authErrorResponse(error) : null
    if (authError) return authError
    if (error instanceof Error && /indisponível \(concorrência\)/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error("Error creating rental:", error)
    return NextResponse.json(
      { error: "Erro ao criar locação" },
      { status: 500 }
    )
  }
}
