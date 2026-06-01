import crypto from "crypto"

/**
 * Valida o header Authorization de uma chamada de cron, fazendo comparação
 * timing-safe contra `process.env.CRON_SECRET`.
 *
 * Antes (Lote anterior): `authHeader !== "Bearer " + secret` usava `!==`,
 * vulnerável a timing attack. Na prática, o secret tem entropia alta o
 * suficiente pra atacante não conseguir extrair via timing (≥ 24 bytes),
 * mas é defesa em camadas barata.
 *
 * Retorna `true` se autorizado; `false` se header inválido ou ausente.
 */
export function verifyCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !authHeader) return false

  const expected = `Bearer ${secret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false

  try {
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
