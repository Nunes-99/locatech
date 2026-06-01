import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"

/**
 * LGPD — exportação dos dados de um cliente.
 *
 * Retorna em JSON estruturado tudo o que a empresa locadora tem sobre o cliente:
 *   - dados cadastrais
 *   - todas as locações (qualquer status, inclusive soft-deleted)
 *   - itens das locações
 *   - histórico de manutenção dos equipamentos que ele alugou (filtrado pelo período em que esteve com o equipamento)
 *   - logs de auditoria que tocam neste cliente
 *
 * Apenas OWNER/ADMIN podem disparar (sensível). O cliente final solicita à locadora.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("customer.view")
    const companyId = user.companyId
    const { id } = await params

    const [customer, company] = await Promise.all([
      prisma.customer.findFirst({ where: { id, companyId } }),
      prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, document: true, dpoEmail: true, dpoName: true, email: true },
      }),
    ])
    if (!customer) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    }

    const rentals = await prisma.rental.findMany({
      where: { customerId: id, companyId },
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        companyId,
        entity: "Customer",
        entityId: id,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    const payload = {
      generatedAt: new Date().toISOString(),
      generatedBy: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
      },
      legalNotice:
        "Documento gerado em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018). Contém todos os dados pessoais que esta empresa possui sobre o titular. Use com responsabilidade.",
      controller: {
        companyId,
        companyName: company?.name ?? user.companyName,
        companyDocument: company?.document ?? null,
        companyEmail: company?.email ?? null,
        dpo: {
          name: company?.dpoName ?? null,
          email: company?.dpoEmail ?? null,
        },
      },
      subject: {
        id: customer.id,
        name: customer.name,
        document: customer.document,
        documentType: customer.documentType,
        phone: customer.phone,
        email: customer.email,
        address: {
          street: customer.address,
          city: customer.city,
          state: customer.state,
          zipCode: customer.zipCode,
        },
        credit: {
          score: customer.creditScore,
          limit: customer.creditLimit ? Number(customer.creditLimit) : null,
        },
        status: {
          isBlocked: customer.isBlocked,
          blockReason: customer.blockReason,
        },
        metrics: {
          totalRentals: customer.totalRentals,
          totalSpent: Number(customer.totalSpent),
          totalPending: Number(customer.totalPending),
        },
        notes: customer.notes,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      rentals: rentals.map((r) => ({
        id: r.id,
        contractNumber: r.contractNumber,
        startDate: r.startDate,
        expectedEndDate: r.expectedEndDate,
        actualEndDate: r.actualEndDate,
        status: r.status,
        type: r.type,
        deliveryAddress: r.deliveryAddress,
        values: {
          subtotal: Number(r.subtotal),
          deliveryFee: Number(r.deliveryFee),
          discount: Number(r.discount),
          total: Number(r.total),
          depositAmount: Number(r.depositAmount),
          depositPaid: r.depositPaid,
          depositReturned: r.depositReturned,
          lateDays: r.lateDays,
          lateFee: Number(r.lateFee),
        },
        payment: {
          status: r.paymentStatus,
          method: r.paymentMethod,
          paidAt: r.paidAt,
        },
        notes: r.notes,
        contractUrl: r.contractUrl,
        items: r.items.map((it) => ({
          equipmentCode: it.equipmentCode,
          equipmentName: it.equipmentName,
          dailyRate: Number(it.dailyRate),
          quantity: it.quantity,
          days: it.days,
          subtotal: Number(it.subtotal),
          returnCondition: it.returnCondition,
          damageNotes: it.damageNotes,
          damageValue: Number(it.damageValue),
        })),
        createdAt: r.createdAt,
        deletedAt: r.deletedAt,
      })),
      auditLogs: auditLogs.map((log) => ({
        date: log.createdAt,
        action: log.action,
        actor: { name: log.userName, email: log.userEmail },
        ipAddress: log.ipAddress,
        changes: log.changes,
      })),
    }

    const filename = `dados-cliente-${customer.document}-${new Date().toISOString().split("T")[0]}.json`

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado")
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("[lgpd export] error:", error)
    return NextResponse.json({ error: "Erro ao exportar dados" }, { status: 500 })
  }
}
