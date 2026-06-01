import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, requirePermission } from "@/lib/session"
import { z } from "zod"

function authErrorResponse(error: Error): NextResponse | null {
  const status = (error as Error & { status?: number }).status
  if (error.message === "Não autorizado") return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  if (status === 403 || error.message === "Acesso negado")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  return null
}

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  document: z.string().min(11).optional(),
  documentType: z.enum(["CPF", "CNPJ"]).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  creditLimit: z.number().positive().optional().nullable(),
  creditScore: z.enum(["EXCELLENT", "GOOD", "REGULAR", "BAD", "BLOCKED"]).optional(),
  notes: z.string().optional().nullable(),
  isBlocked: z.boolean().optional(),
  blockReason: z.string().optional().nullable(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const { id } = await params

    // Não retorna campos sensíveis das locações no GET do cliente:
    //   - customerSignatureUrl/customerSignedIp são biometria/PII e devem
    //     ficar restritos ao detalhe da locação (já gated)
    //   - internalNotes pode conter dados internos da operação
    //   - handoverToken/returnToken são tokens ativos
    const customer = await prisma.customer.findFirst({
      where: { id, companyId },
      include: {
        rentals: {
          select: {
            id: true,
            contractNumber: true,
            startDate: true,
            expectedEndDate: true,
            actualEndDate: true,
            status: true,
            type: true,
            total: true,
            depositAmount: true,
            paymentStatus: true,
            paymentMethod: true,
            lateDays: true,
            lateFee: true,
            createdAt: true,
            items: {
              select: {
                id: true,
                equipmentCode: true,
                equipmentName: true,
                quantity: true,
                days: true,
                dailyRate: true,
                subtotal: true,
                equipment: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    status: true,
                  },
                },
              },
            },
          },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!customer) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error("Error fetching customer:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar cliente" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("customer.update")
    const companyId = user.companyId
    const { id } = await params
    const body = await request.json()
    const data = updateCustomerSchema.parse(body)

    // Bloquear cliente requer permissão extra
    if (data.isBlocked !== undefined) {
      const blockUser = await requirePermission("customer.block").catch(() => null)
      if (!blockUser) {
        return NextResponse.json(
          { error: "Sem permissão para bloquear/desbloquear clientes" },
          { status: 403 }
        )
      }
    }

    const existing = await prisma.customer.findFirst({
      where: { id, companyId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    // Se documento foi alterado, verificar duplicidade
    if (data.document && data.document !== existing.document) {
      const duplicate = await prisma.customer.findUnique({
        where: {
          companyId_document: {
            companyId,
            document: data.document,
          },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "Já existe um cliente com este documento" },
          { status: 400 }
        )
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data,
    })

    return NextResponse.json(customer)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error) {
      const r = authErrorResponse(error)
      if (r) return r
    }
    console.error("Error updating customer:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar cliente" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("customer.delete")
    const companyId = user.companyId
    const { id } = await params

    const existing = await prisma.customer.findFirst({
      where: { id, companyId },
      include: {
        rentals: {
          where: {
            status: { in: ["IN_PROGRESS", "CONFIRMED", "OVERDUE"] },
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    if (existing.rentals.length > 0) {
      return NextResponse.json(
        { error: "Cliente possui locações ativas" },
        { status: 400 }
      )
    }

    // Soft delete - mark as blocked
    await prisma.customer.update({
      where: { id },
      data: { isBlocked: true, blockReason: "Cliente removido do sistema" },
    })

    return NextResponse.json({ message: "Cliente removido com sucesso" })
  } catch (error) {
    if (error instanceof Error) {
      const r = authErrorResponse(error)
      if (r) return r
    }
    console.error("Error deleting customer:", error)
    return NextResponse.json(
      { error: "Erro ao excluir cliente" },
      { status: 500 }
    )
  }
}
