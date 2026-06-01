import pino from "pino"

/**
 * Logger estruturado com Pino.
 *
 * - Em desenvolvimento: pretty print (legível)
 * - Em produção: JSON puro (parseável por Logtail/Datadog/Loki)
 *
 * Uso:
 *
 *   import { logger } from "@/lib/logger"
 *
 *   logger.info({ userId, action: "login" }, "user logged in")
 *   logger.error({ err }, "failed to send email")
 *   logger.child({ requestId }) // logger contextual
 *
 * Configuração externa:
 *   LOG_LEVEL=debug|info|warn|error|silent (default: info em prod, debug em dev)
 */

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug")

// Em dev pretty-print só funciona se pino-pretty estiver instalado.
// Como não queremos adicionar mais uma dep só pra dev UX, ficamos com JSON
// mesmo em dev — é menos bonito mas zero side-effect na build.
export const logger = pino({
  level,
  // Redact comum: campos sensíveis nunca aparecem no log
  redact: {
    paths: [
      "*.passwordHash",
      "*.password",
      "*.token",
      "*.totpSecret",
      "*.providerCredentials",
      "*.secret",
      "*.creditCard",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  base: {
    env: process.env.NODE_ENV,
  },
})

/**
 * Logger contextual pra um request. Adicione no início do handler:
 *
 *   const log = withRequestContext(request)
 *   log.info({ rentalId }, "...")
 */
export function withRequestContext(request: Request) {
  return logger.child({
    method: request.method,
    url: new URL(request.url).pathname,
    requestId: request.headers.get("x-request-id") || undefined,
  })
}
