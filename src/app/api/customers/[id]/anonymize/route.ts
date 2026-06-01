import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/session"
import { z } from "zod"

/**
 * LGPD — Direito ao Esquecimento (Art. 18, VI da Lei 13.709/2018).
 *
 * Anonimiza dados pessoais do cliente preservando o histórico fiscal/financeiro,
 * que tem prazo legal de guarda de 5 anos (CC Art. 206 + Decreto-Lei 486/69).
 *
 * Após anonimização:
 *   - Nome, documento, telefone, email, endereço e notas viram placeholders
 *   - O `document` continua único (concatena com sufixo aleatório)
 *   - Locações, items, pagamentos e valores permanecem intocados
 *   - Cliente fica bloqueado pra impedir reuso acidental
 *
 * **Não-reversível.** Exige OWNER + confirmação textual no body.
 *
 * AuditLog entries antigas não são apagadas — auditoria é base legal "legítimo
 * interesse" pra segurança. Mas registramos um evento explícito de anonimização.
 */
const bodySchema = z.object({
  /** O cliente deve digitar literalmente "ANONIMIZAR" pra confirmar. */
  confirm: z.literal("ANONIMIZAR"),
  /** Quem solicitou (titular, ordem judicial, etc) — fica em audit log. */
  requestedBy: z.string().min(1).max(200).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("customer.delete") // só OWNER/ADMIN
    if (user.role !== "OWNER") {
      // Restrição extra — só OWNER pode disparar esquecimento
      return NextResponse.json(
        { error: "Apenas o proprietário da conta pode anonimizar clientes" },
        { status: 403 }
      )
    }

    const companyId = user.companyId
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const data = bodySchema.parse(body)

    const customer = await prisma.customer.findFirst({
      where: { id, companyId },
    })
    if (!customer) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    }

    // Evita anonimizar duas vezes
    if (customer.name.startsWith("[ANONIMIZADO]")) {
      return NextResponse.json(
        { error: "Cliente já está anonimizado" },
        { status: 400 }
      )
    }

    const shortId = customer.id.slice(0, 8)
    const timestamp = new Date()
    // Documento anônimo único — usa o id como sufixo (UUID nunca colide).
    // Se o campo é VARCHAR(14) (CPF), trunca; UUID base sem hífen tem 32 chars
    // então mesmo "ANON" + 10 chars do id já é único per-company.
    const idClean = customer.id.replaceAll("-", "")
    const anonymizedDoc = `ANON${idClean.slice(0, 10)}`

    const anonymized = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          name: `[ANONIMIZADO] Cliente #${shortId}`,
          document: anonymizedDoc,
          documentType: "CPF",
          phone: "00000000000",
          email: null,
          address: null,
          city: null,
          state: null,
          zipCode: null,
          notes: `Dados pessoais anonimizados em ${timestamp.toISOString()} a pedido do titular (LGPD Art. 18). Histórico financeiro preservado por obrigação legal.`,
          isBlocked: true,
          blockReason: "Anonimizado por solicitação LGPD",
        },
      })

      // Scrub PII em todas as locações do cliente. A assinatura digital é PII
      // sensível (biometria comportamental), endereço de entrega idem.
      // Mantém valores financeiros e timestamps — obrigação legal de guarda.
      await tx.rental.updateMany({
        where: { customerId: id, companyId },
        data: {
          customerSignatureUrl: null,
          customerSignedIp: null,
          deliveryAddress: null,
          notes: null,
          internalNotes: null,
          contractUrl: null,
        },
      })

      return updated
    })

    // Registro explícito de anonimização (a auditoria automática já capturaria a UPDATE,
    // mas queremos uma entrada destacada e com motivo)
    try {
      await prisma.auditLog.create({
        data: {
          companyId,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          action: "DELETE", // LGPD considera anonimização equivalente a exclusão de dados pessoais
          entity: "Customer",
          entityId: id,
          changes: {
            lgpd: true,
            reason: "right_to_be_forgotten",
            requestedBy: data.requestedBy ?? null,
            anonymizedAt: timestamp.toISOString(),
          },
        },
      })
    } catch (err) {
      console.error("[anonymize] failed to write explicit audit:", err)
    }

    return NextResponse.json({
      success: true,
      message: "Cliente anonimizado com sucesso. Histórico financeiro preservado.",
      customerId: anonymized.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            "Confirmação inválida. Para confirmar, envie {\"confirm\": \"ANONIMIZAR\"} no body.",
        },
        { status: 400 }
      )
    }
    if (error instanceof Error) {
      const status = (error as Error & { status?: number }).status
      if (error.message === "Não autorizado")
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      if (status === 403 || error.message === "Acesso negado")
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
    console.error("[anonymize] error:", error)
    return NextResponse.json({ error: "Erro ao anonimizar" }, { status: 500 })
  }
}
