import crypto from "crypto"

/**
 * Backup codes pra 2FA. Separado de `totp.ts` porque é lógica pura (sem otplib)
 * e isso permite testar em Jest sem precisar configurar transform de módulos ESM.
 *
 * Modelo de armazenamento: SHA-256 dos códigos. O cliente recebe os códigos em
 * claro UMA VEZ na ativação; nunca mais conseguimos recuperá-los. Sem hash, um
 * dump do banco daria acesso 2FA imediato.
 */

const HASH_ALGO = "sha256"

function hashCode(code: string): string {
  const normalized = code.trim().toLowerCase().replace(/\s/g, "")
  return crypto.createHash(HASH_ALGO).update(normalized).digest("hex")
}

/**
 * Gera N códigos de backup. Retorna os códigos em claro (pra exibir ao user)
 * e os hashes (pra armazenar no DB). NÃO armazene `plain` — descarte após o
 * primeiro retorno ao cliente.
 */
export function generateBackupCodes(n = 10): { plain: string[]; hashed: string[] } {
  const plain: string[] = []
  const hashed: string[] = []
  for (let i = 0; i < n; i++) {
    const code = crypto.randomBytes(4).toString("hex")
    plain.push(code)
    hashed.push(hashCode(code))
  }
  return { plain, hashed }
}

/**
 * Verifica se um código bate com algum dos backup codes hashed do user.
 * Retorna `{matched, remaining}` com a lista atualizada (sem o hash usado).
 */
export function consumeBackupCode(
  code: string,
  hashedCodes: string[]
): { matched: boolean; remaining: string[] } {
  if (!code || !code.trim()) return { matched: false, remaining: hashedCodes }
  const incoming = hashCode(code)
  const idx = hashedCodes.findIndex((stored) => {
    if (stored.length !== incoming.length) return false
    try {
      return crypto.timingSafeEqual(Buffer.from(stored, "hex"), Buffer.from(incoming, "hex"))
    } catch {
      return false
    }
  })
  if (idx === -1) return { matched: false, remaining: hashedCodes }
  const remaining = hashedCodes.filter((_, i) => i !== idx)
  return { matched: true, remaining }
}
