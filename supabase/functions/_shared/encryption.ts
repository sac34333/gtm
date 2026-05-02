/**
 * AES-256-GCM encryption/decryption for API keys stored in the database.
 * Uses the ENCRYPTION_KEY environment variable (32-byte base64-encoded key).
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12 // 96 bits for GCM

async function getKey(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', raw, { name: ALGORITHM }, false, ['encrypt', 'decrypt'])
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a base64-encoded string: iv (12 bytes) + ciphertext.
 */
export async function encrypt(plaintext: string): Promise<string> {
  const keyBase64 = Deno.env.get('ENCRYPTION_KEY')
  if (!keyBase64) throw new Error('ENCRYPTION_KEY not set')

  const key = await getKey(keyBase64)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(plaintext)

  const cipherBuffer = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded)

  // Combine iv + ciphertext
  const combined = new Uint8Array(IV_LENGTH + cipherBuffer.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipherBuffer), IV_LENGTH)

  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypts a base64-encoded string produced by encrypt().
 */
export async function decrypt(ciphertext: string): Promise<string> {
  const keyBase64 = Deno.env.get('ENCRYPTION_KEY')
  if (!keyBase64) throw new Error('ENCRYPTION_KEY not set')

  const key = await getKey(keyBase64)
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))

  const iv = combined.slice(0, IV_LENGTH)
  const data = combined.slice(IV_LENGTH)

  const plainBuffer = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, data)
  return new TextDecoder().decode(plainBuffer)
}
