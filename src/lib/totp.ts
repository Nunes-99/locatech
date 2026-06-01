import { generateSecret, generateURI, verify } from "otplib"
export { generateBackupCodes, consumeBackupCode } from "./backup-codes"

/**
 * Helpers TOTP (RFC 6238) — usados pra 2FA.
 *
 * otplib v13 usa API funcional: generateSecret/generateURI/verify.
 * `verify` retorna VerifyResult ({valid: boolean, ...}), não boolean direto.
 *
 * Usamos `epochTolerance` (em segundos) pra aceitar codes com clock drift.
 * 30s cobre janela atual + 1 anterior + 1 próximo (mesmo efeito que "window: 1"
 * de versões antigas).
 */

const TOLERANCE_SECONDS = 30

/** Gera um novo secret base32 pra um user. */
export function generateTotpSecret(): string {
  return generateSecret({ length: 20 })
}

/** URL otpauth:// pra exibir como QR code no app autenticador. */
export function buildOtpAuthUrl(secret: string, accountLabel: string, issuer = "LocaTech"): string {
  return generateURI({
    strategy: "totp",
    issuer,
    label: accountLabel,
    secret,
    digits: 6,
    period: 30,
  })
}

/** Verifica se o `code` (6 dígitos) bate com o `secret` no momento atual. */
export async function verifyTotpCode(code: string, secret: string): Promise<boolean> {
  const cleaned = code.trim().replace(/\s/g, "")
  if (!/^\d{6}$/.test(cleaned)) return false
  try {
    const result = await verify({
      token: cleaned,
      secret,
      epochTolerance: TOLERANCE_SECONDS,
    })
    return result.valid
  } catch {
    return false
  }
}

// backup-codes em src/lib/backup-codes.ts (separado pra facilitar testes sem ESM issue)
