import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Cron diário: cancela orçamentos (status=QUOTE) cujo `quoteExpiresAt` já passou.
 *
 * Frequência recomendada: 1x/dia. Não é crítico — pode atrasar algumas horas sem prejuízo.
 *
 * Auditoria: a auditoria automática do Prisma extension captura o UPDATE de cada rental,
 * então não precisa registrar evento manualmente aqui.
 */
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { verifyCronSecret } = await import("@/lib/cron-auth")
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()

    const expired = await prisma.rental.findMany({
      where: {
        status: "QUOTE",
        deletedAt: null,
        quoteExpiresAt: { lt: now },
      },
      // pega internalNotes pra fazer append sem sobrescrever notas do operador
      select: { id: true, companyId: true, contractNumber: true, internalNotes: true },
    })

    const cancelledIds: string[] = []
    for (const rental of expired) {
      const expiredLine = `[${now.toLocaleString("pt-BR")}] Orçamento expirado automaticamente.`
      const newNotes = rental.internalNotes
        ? `${rental.internalNotes}\n${expiredLine}`
        : expiredLine

      await prisma.rental.update({
        where: { id: rental.id },
        data: {
          status: "CANCELLED",
          internalNotes: newNotes,
        },
      })

      // Notificação in-app pra empresa saber
      try {
        await prisma.notification.create({
          data: {
            companyId: rental.companyId,
            title: "Orçamento expirado",
            message: `Orçamento #${rental.contractNumber} foi cancelado automaticamente por expiração.`,
            type: "INFO",
            link: "/locacoes",
          },
        })
      } catch (err) {
        console.error("[expire-quotes] failed to create notification:", err)
      }

      cancelledIds.push(rental.id)
    }

    return NextResponse.json({
      success: true,
      expired: cancelledIds.length,
      ids: cancelledIds,
    })
  } catch (error) {
    console.error("[expire-quotes] error:", error)
    return NextResponse.json({ error: "Erro ao expirar orçamentos" }, { status: 500 })
  }
}
