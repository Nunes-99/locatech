import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { z } from "zod"

const createRentalSchema = z.object({
  customerId: z.string().uuid(),
  startDate: z.string(),
  expectedEndDate: z.string(),
  type: z.enum(["DELIVERY", "PICKUP"]),
  deliveryAddress: z.string().optional(),
  depositAmount: z.number().optional(),
  notes: z.string().optional(),
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
    const companyId = await requireCompanyId()
    const body = await request.json()
    const data = createRentalSchema.parse(body)

    // Buscar último número de contrato
    const lastRental = await prisma.rental.findFirst({
      where: { companyId },
      orderBy: { contractNumber: "desc" },
      select: { contractNumber: true },
    })
    const contractNumber = (lastRental?.contractNumber || 0) + 1

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
      const equipment = await prisma.equipment.findUnique({
        where: { id: item.equipmentId },
      })

      if (!equipment) {
        return NextResponse.json(
          { error: `Equipamento ${item.equipmentId} não encontrado` },
          { status: 400 }
        )
      }

      if (equipment.status !== "AVAILABLE") {
        return NextResponse.json(
          { error: `Equipamento ${equipment.code} não está disponível` },
          { status: 400 }
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

      // Atualizar status dos equipamentos
      for (const item of data.items) {
        await tx.equipment.update({
          where: { id: item.equipmentId },
          data: {
            status: "RENTED",
            totalRentals: { increment: 1 },
          },
        })
      }

      // Atualizar métricas do cliente
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

    return NextResponse.json(rental, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("Error creating rental:", error)
    return NextResponse.json(
      { error: "Erro ao criar locação" },
      { status: 500 }
    )
  }
}
