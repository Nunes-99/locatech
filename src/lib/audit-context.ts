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

export function setAuditContextField<K extends keyof AuditContext>(
  key: K,
  value: AuditContext[K]
): void {
  const ctx = storage.getStore()
  if (ctx) {
    ctx[key] = value
  }
}
