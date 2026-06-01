import { AsyncLocalStorage } from "async_hooks"

export interface AuditContext {
  userId?: string
  userEmail?: string
  userName?: string
  companyId?: string
  ipAddress?: string
  userAgent?: string
}

const storage = new AsyncLocalStorage<AuditContext>()

export function getAuditContext(): AuditContext | undefined {
  return storage.getStore()
}

export function runWithAuditContext<T>(context: AuditContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn)
}

/**
 * Liga o contexto pra TODO o restante da execução async atual (sem precisar
 * de wrapper). Use no início do handler — `requireAuth()` faz isso. Próximas
 * queries do Prisma na mesma cadeia async vão ver o contexto.
 *
 * Cada request HTTP gera sua própria cadeia async, então não há vazamento
 * entre requests concorrentes.
 */
export function enterAuditContext(context: AuditContext): void {
  storage.enterWith(context)
}

export function setAuditContextField<K extends keyof AuditContext>(
  key: K,
  value: AuditContext[K]
): void {
  const ctx = storage.getStore()
  if (ctx) {
    ctx[key] = value
  }
}
