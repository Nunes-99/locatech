import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, requirePermission } from "@/lib/session"
import { dispatchWebhooks } from "@/lib/webhooks"
import { z } from "zod"

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

export async function GET(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const customerId = searchParams.get("customerId")
    const search = searchParams.get("search")

    const rentals = await prisma.rental.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(status && status !== "all" ? { status: status as any } : {}),
        ...(customerId ? { customerId } : {}),
        ...(search
          ? {
              OR: [
                { customer: { name: { contains: search, mode: "insensitive" } } },
                { contractNumber: { equals: parseInt(search) || -1 } },
              ],
            }
          : {}),
      },
      include: {
        customer: true,
        items: {
          include: {
            equipment: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(rentals)
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

    // Buscar último número de contrato
    const lastRental = await prisma.rental.findFirst({
      where: { companyId },
      orderBy: { contractNumber: "desc" },
      select: { contractNumber: true },
    })
    const contractNumber = (lastRental?.contractNumber || 0) + 1

    // Valida que o cliente pertence à mesma empresa antes de seguir
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

    // Calcular valores
    let subtotal = 0
    const rentalItems: Array<{
      equipmentId: string
      equipmentCode: string
      equipmentName: string
      dailyRate: number
      quantity: number
      days: number
      subtotal: number
    }> = []

    for (const item of data.items) {
      // findFirst com companyId — impede locação referenciar equipamento de outro tenant
      const equipment = await prisma.equipment.findFirst({
        where: { id: item.equipmentId, companyId },
      })

      if (!equipment) {
        return NextResponse.json(
          { error: `Equipamento ${item.equipmentId} não encontrado` },
          { status: 404 }
        )
      }

      if (equipment.status !== "AVAILABLE") {
        return NextResponse.json(
          { error: `Equipamento ${equipment.code} não está disponível` },
          { status: 409 }
        )
      }

      const itemSubtotal = item.dailyRate * item.days

      rentalItems.push({
        equipmentId: item.equipmentId,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        dailyRate: item.dailyRate,
        quantity: 1,
        days: item.days,
        subtotal: itemSubtotal,
      })

      subtotal += itemSubtotal
    }

    const deliveryFee = data.type === "DELIVERY" ? 50 : 0 // TODO: configurável
    const total = subtotal + deliveryFee

    // Determina data de expiração se for orçamento
    let quoteExpiresAt: Date | null = null
    if (data.asQuote) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { quoteValidDays: true },
      })
      const validDays = company?.quoteValidDays ?? 7
      quoteExpiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000)
    }

    // Criar locação em transação
    const rental = await prisma.$transaction(async (tx) => {
      // Criar locação
      const newRental = await tx.rental.create({
        data: {
          companyId,
          customerId: data.customerId,
          contractNumber,
          startDate: new Date(data.startDate),
          expectedEndDate: new Date(data.expectedEndDate),
          type: data.type,
          deliveryAddress: data.deliveryAddress,
          subtotal,
          deliveryFee,
          total,
          depositAmount: data.depositAmount || 0,
          notes: data.notes,
          status: data.asQuote ? "QUOTE" : "CONFIRMED",
          quoteExpiresAt,
          items: {
            create: rentalItems,
          },
        },
        include: {
          customer: true,
          items: {
            include: {
              equipment: true,
            },
          },
        },
      })

      // Atualizar status dos equipamentos com checagem condicional dentro da
      // transação — impede race onde 2 locações simultâneas pegam o mesmo
      // equipamento. updateMany retorna count: só vale se for 1.
      for (const item of data.items) {
        const claimed = await tx.equipment.updateMany({
          where: {
            id: item.equipmentId,
            companyId,
            status: "AVAILABLE",
          },
          data: {
            status: "RENTED",
            totalRentals: { increment: 1 },
          },
        })
        if (claimed.count !== 1) {
          // Aborta a transação — outro request já alocou o equipamento
          throw new Error(`Equipamento ${item.equipmentId} indisponível (concorrência)`)
        }
      }

      // Atualizar métricas do cliente — companyId garantido pelo findFirst prévio
      await tx.customer.update({
        where: { id: data.customerId },
        data: {
          totalRentals: { increment: 1 },
        },
      })

      // Atualizar métricas da empresa
      await tx.company.update({
        where: { id: companyId },
        data: {
          totalRentals: { increment: 1 },
        },
      })

      return newRental
    })

    // Dispara webhook fire-and-forget (não bloqueia resposta)
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
