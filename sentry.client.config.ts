import * as Sentry from "@sentry/nextjs"

/**
 * Sentry no client (browser).
 *
 * Ativado apenas quando `NEXT_PUBLIC_SENTRY_DSN` está configurado.
 * Sem DSN, o SDK não envia nada (chamadas viram no-op).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    // Não logar PII no Sentry (LGPD)
    sendDefaultPii: false,
  })
}
