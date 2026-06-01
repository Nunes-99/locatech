import crypto from "crypto"

/**
 * Criptografia simétrica AES-256-GCM com chave da env `APP_ENCRYPTION_KEY`.
 *
 * Usada pra proteger campos sensíveis em repouso (Webhook.secret,
 * CompanyTaxConfig.providerCredentials) — DB dump não expõe os valores.
 *
 * Formato do ciphertext: `enc:v1:<base64(iv | ct | tag)>`
 *
 * Detecção automática via prefixo: valores legados em plaintext (sem prefixo)
 * continuam sendo lidos sem decrypt, então rotação/configuração da key não
 * quebra registros anteriores. **Recomenda-se reencriptar via migration.**
 *
 * Sem `APP_ENCRYPTION_KEY`: `encryptString` retorna o plaintext inalterado
 * (modo dev). Em produção, **defina a key** com `openssl rand -hex 32`.
 */

const ALGO = "aes-256-gcm"
const IV_LEN = 12 // bytes; padrão GCM
const TAG_LEN = 16
const PREFIX = "enc:v1:"

function loadKey(): Buffer | null {
  const raw = process.env.APP_ENCRYPTION_KEY
  if (!raw) return null
  let key: Buffer
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    key = Buffer.from(raw, "hex")
  } else {
    key = Buffer.from(raw, "base64")
  }
  if (key.length !== 32) {
    throw new Error(
      "APP_ENCRYPTION_KEY inválida — precisa ser 32 bytes (hex 64 chars ou base64 44 chars). " +
        "Gere com `openssl rand -hex 32`."
    )
  }
  return key
}

export function isEncryptionConfigured(): boolean {
  return !!process.env.APP_ENCRYPTION_KEY
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX)
}

/**
 * Criptografa string. Se a key não estiver configurada, devolve plaintext
 * (modo dev sem warning — produção deve ter sempre).
 */
export function encryptString(plaintext: string): string {
  const key = loadKey()
  if (!key) return plaintext // modo dev sem chave

  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, ct, tag]).toString("base64")
}

/**
 * Decripta string. Se não tem o prefixo `enc:v1:`, assume legado plaintext
 * e devolve sem alteração.
 *
 * Throws se ciphertext está marcado como encriptado mas a key está ausente
 * ou o tag GCM falha (tampering).
 */
export function decryptString(value: string): string {
  if (!isEncrypted(value)) return value

  const key = loadKey()
  if (!key) {
    throw new Error(
      "Valor criptografado encontrado mas APP_ENCRYPTION_KEY ausente — não é possível descriptografar."
    )
  }

  const buf = Buffer.from(value.slice(PREFIX.length), "base64")
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("Ciphertext inválido (tamanho insuficiente)")
  }
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(buf.length - TAG_LEN)
  const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return pt.toString("utf8")
}

/**
 * Helper pra JSONs (providerCredentials).
 */
export function encryptJson(obj: unknown): string {
  return encryptString(JSON.stringify(obj))
}

export function decryptJson<T = unknown>(value: string): T {
  return JSON.parse(decryptString(value)) as T
}
