import { Prisma, PrismaClient, AuditAction } from "@prisma/client"
import { getAuditContext } from "./audit-context"

const AUDITED_MODELS = new Set([
  "Equipment",
  "EquipmentCategory",
  "Customer",
  "Rental",
  "RentalItem",
  "Maintenance",
  "User",
  "Company",
  "ApiKey",
  "Webhook",
  "Store",
  "Invoice",
  "CompanyTaxConfig",
])

/**
 * Campos sensíveis que NÃO podem aparecer em audit log mesmo quando o registro
 * é capturado por inteiro. Cobrem: hashes de senha/token, secrets TOTP em
 * claro, hashes de API key, credenciais de provider fiscal, secrets de webhook.
 */
const SENSITIVE_FIELDS = new Set([
  "passwordHash",
  "resetToken",
  "resetTokenExpiry",
  "emailVerifyToken",
  "totpSecret",
  "totpPendingSecret",
  "totpBackupCodes",
  "keyHash",
  "secret",
  "providerCredentials",
])

function sanitize(data: unknown): unknown {
  if (data === null || data === undefined) return data
  if (Array.isArray(data)) return data.map(sanitize)
  if (typeof data !== "object") return data
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key)) {
      result[key] = "[REDACTED]"
    } else {
      result[key] = sanitize(value)
    }
  }
  return result
}

function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changed: Record<string, { before: unknown; after: unknown }> = {}
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of allKeys) {
    if (SENSITIVE_FIELDS.has(key)) continue
    const a = before[key]
    const b = after[key]
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changed[key] = { before: a, after: b }
    }
  }
  return changed
}

export function auditExtension(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args)
          if (AUDITED_MODELS.has(model)) {
            await writeAudit(client, model, "CREATE", (result as any)?.id, {
              after: sanitize(result),
            })
          }
          return result
        },
        async update({ model, args, query }) {
          let before: any = null
          if (AUDITED_MODELS.has(model) && (args as any).where) {
            try {
              before = await (client as any)[lowerFirst(model)].findUnique({
                where: (args as any).where,
              })
            } catch {
              // ignore
            }
          }
          const result = await query(args)
          if (AUDITED_MODELS.has(model) && before) {
            await writeAudit(client, model, "UPDATE", (result as any)?.id, {
              changes: diff(sanitize(before) as any, sanitize(result) as any),
            })
          }
          return result
        },
        async delete({ model, args, query }) {
          let before: any = null
          if (AUDITED_MODELS.has(model) && (args as any).where) {
            try {
              before = await (client as any)[lowerFirst(model)].findUnique({
                where: (args as any).where,
              })
            } catch {
              // ignore
            }
          }
          const result = await query(args)
          if (AUDITED_MODELS.has(model) && before) {
            await writeAudit(client, model, "DELETE", before.id, {
              before: sanitize(before),
            })
          }
          return result
        },
        async updateMany({ model, args, query }) {
          const result = await query(args)
          if (AUDITED_MODELS.has(model)) {
            // updateMany não retorna IDs afetados, só count. Registramos uma
            // entrada agregada com o where e o count — não ideal pra forense
            // detalhada, mas pelo menos a operação fica rastreada.
            await writeAuditBulk(client, model, "UPDATE", {
              bulk: true,
              where: sanitize((args as any).where),
              data: sanitize((args as any).data),
              count: (result as { count?: number })?.count ?? null,
            })
          }
          return result
        },
        async deleteMany({ model, args, query }) {
          const result = await query(args)
          if (AUDITED_MODELS.has(model)) {
            await writeAuditBulk(client, model, "DELETE", {
              bulk: true,
              where: sanitize((args as any).where),
              count: (result as { count?: number })?.count ?? null,
            })
          }
          return result
        },
        async createMany({ model, args, query }) {
          const result = await query(args)
          if (AUDITED_MODELS.has(model)) {
            await writeAuditBulk(client, model, "CREATE", {
              bulk: true,
              count: (result as { count?: number })?.count ?? null,
            })
          }
          return result
        },
      },
    },
  })
}

/**
 * Grava entrada agregada pra operações bulk. Usa entityId="*" pra sinalizar
 * que o registro cobre múltiplos IDs (o where + count contém o detalhe).
 */
async function writeAuditBulk(
  client: PrismaClient,
  entity: string,
  action: AuditAction,
  changes: Record<string, unknown>
) {
  const ctx = getAuditContext()
  if (!ctx || !ctx.companyId) return
  try {
    await client.auditLog.create({
      data: {
        companyId: ctx.companyId,
        userId: ctx.userId || null,
        userEmail: ctx.userEmail || null,
        userName: ctx.userName || null,
        action,
        entity,
        entityId: "*",
        changes: changes as Prisma.InputJsonValue,
        ipAddress: ctx.ipAddress || null,
        userAgent: ctx.userAgent || null,
      },
    })
  } catch (error) {
    console.error("[audit] failed to write bulk log:", error)
  }
}

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

async function writeAudit(
  client: PrismaClient,
  entity: string,
  action: AuditAction,
  entityId: string | undefined,
  changes: Record<string, unknown>
) {
  const ctx = getAuditContext()
  if (!ctx || !ctx.companyId || !entityId) return

  try {
    await client.auditLog.create({
      data: {
        companyId: ctx.companyId,
        userId: ctx.userId || null,
        userEmail: ctx.userEmail || null,
        userName: ctx.userName || null,
        action,
        entity,
        entityId,
        changes: changes as Prisma.InputJsonValue,
        ipAddress: ctx.ipAddress || null,
        userAgent: ctx.userAgent || null,
      },
    })
  } catch (error) {
    // Auditoria nunca pode quebrar a operação principal
    console.error("[audit] failed to write log:", error)
  }
}

/**
 * Helper explícito para registrar eventos de autenticação
 * (login, logout, mudança de senha, etc).
 */
export async function logAuthEvent(
  client: PrismaClient,
  data: {
    companyId: string
    userId?: string
    userEmail: string
    userName?: string
    action: AuditAction
    ipAddress?: string
    userAgent?: string
  }
) {
  try {
    await client.auditLog.create({
      data: {
        companyId: data.companyId,
        userId: data.userId || null,
        userEmail: data.userEmail,
        userName: data.userName || null,
        action: data.action,
        entity: "Auth",
        entityId: data.userId || data.userEmail,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    })
  } catch (error) {
    console.error("[audit] failed to write auth event:", error)
  }
}
