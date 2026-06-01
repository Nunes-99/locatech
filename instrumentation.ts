/**
 * Next.js instrumentation — roda no startup do servidor (Node ou Edge).
 *
 * Carrega config do Sentry baseado no runtime detectado. Sem DSN, é no-op.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}
