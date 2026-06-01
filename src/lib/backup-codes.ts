import crypto from "crypto"

/**
 * Backup codes pra 2FA — separado de `totp.ts` porque é lógica pura (sem otplib)
 * e isso permite testar em Jest sem precisar configurar transform de módulos ESM.
 */

/** Gera N códigos de backup hex 8 chars. */
export function generateBackupCodes(n = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < n; i++) {
    codes.push(crypto.randomBytes(4).toString("hex"))
  }
  return codes
}

/**
 * Verifica se um código bate com algum dos backup codes do user.
 * Retorna `{matched: true, remaining: [...]}` com a lista atualizada (sem o usado).
 */
export function consumeBackupCode(
  code: string,
  codes: string[]
): { matched: boolean; remaining: string[] } {
  const normalized = code.trim().toLowerCase().replace(/\s/g, "")
  const idx = codes.findIndex((c) => c.toLowerCase() === normalized)
  if (idx === -1) return { matched: false, remaining: codes }
  const remaining = codes.filter((_, i) => i !== idx)
  return { matched: true, remaining }
}
