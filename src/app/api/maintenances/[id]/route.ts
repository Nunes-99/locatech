import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId } from "@/lib/session"
import { MaintenanceStatus } from "@prisma/client"
import { z } from "zod"

const updateMaintenanceSchema = z.object({
  type: z.enum(["PREVENTIVE", "CORRECTIVE", "INSPECTION"]).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  laborCost: z.number().min(0).optional(),
  partsCost: z.number().min(0).optional(),
  scheduledDate: z.string().optional().nullable(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  notes: z.string().optional().nullable(),
})

/**
 * Transições forward-only. Não permite voltar de COMPLETED pra IN_PROGRESS,
 * etc. Sem isso, era possível "reabrir" manutenção concluída e bagunçar o
 * status do equipamento.
 */
const ALLOWED_MAINTENANCE_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const { id } = await params

    const maintenance = await prisma.maintenance.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        equipment: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            category: true,
          },
        },
      },
    })

    if (!maintenance) {
      return NextResponse.json(
        { error: "Manutencao nao encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json(maintenance)
  } catch (error) {
    console.error("Error fetching maintenance:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar manutencao" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const { id } = await params
    const body = await request.json()
    const data = updateMaintenanceSchema.parse(body)

    const existing = await prisma.maintenance.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { equipment: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Manutencao nao encontrada" },
        { status: 404 }
      )
    }

    // Valida transição de status — forward-only.
    if (data.status && data.status !== existing.status) {
      const allowed = ALLOWED_MAINTENANCE_TRANSITIONS[existing.status as MaintenanceStatus] || []
      if (!allowed.includes(data.status as MaintenanceStatus)) {
        return NextResponse.json(
          {
            error: `Transicao invalida: ${existing.status} -> ${data.status}. ` +
              `Permitidas: ${allowed.length ? allowed.join(", ") : "(nenhuma — estado final)"}.`,
          },
          { status: 409 }
        )
      }
    }

    // Calcular novo custo total se laborCost ou partsCost foram alterados
    const laborCost = data.laborCost ?? existing.laborCost.toNumber()
    const partsCost = data.partsCost ?? existing.partsCost.toNumber()
    const totalCost = laborCost + partsCost

    const maintenance = await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenance.update({
        where: { id },
        data: {
          ...data,
          laborCost,
          partsCost,
          totalCost,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : existing.scheduledDate,
          startedAt: data.status === "IN_PROGRESS" && !existing.startedAt ? new Date() : existing.startedAt,
          completedAt: data.status === "COMPLETED" && !existing.completedAt ? new Date() : existing.completedAt,
        },
        include: {
          equipment: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
            },
          },
        },
      })

      // Atualizar status do equipamento baseado no status da manutencao
      if (data.status === "IN_PROGRESS" && existing.status !== "IN_PROGRESS") {
        await tx.equipment.update({
          where: { id: existing.equipmentId },
          data: { status: "MAINTENANCE" },
        })
      }

      // Se a manutencao foi concluida ou cancelada, liberar o equipamento
      if ((data.status === "COMPLETED" || data.status === "CANCELLED") &&
          existing.status === "IN_PROGRESS") {
        await tx.equipment.update({
          where: { id: existing.equipmentId },
          data: { status: "AVAILABLE" },
        })
      }

      return updated
    })

    return NextResponse.json(maintenance)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados invalidos", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("Error updating maintenance:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar manutencao" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const { id } = await params

    const existing = await prisma.maintenance.findFirst({
      where: { id, companyId, deletedAt: null },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Manutencao nao encontrada" },
        { status: 404 }
      )
    }

    // Nao permitir deletar manutencao em andamento
    if (existing.status === "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Nao e possivel excluir manutencao em andamento" },
        { status: 400 }
      )
    }

    // Soft delete: preserva histórico
    await prisma.maintenance.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ message: "Manutencao excluida com sucesso" })
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    console.error("Error deleting maintenance:", error)
    return NextResponse.json(
      { error: "Erro ao excluir manutencao" },
      { status: 500 }
    )
  }
}
