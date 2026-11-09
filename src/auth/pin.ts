/**
 * Till PINs. Stored only as PBKDF2-SHA256 hashes with a random salt per
 * profile: "pbkdf2$<iterations>$<salt b64>$<hash b64>".
 *
 * A 4–6 digit PIN can't resist someone who copies the database and tries
 * every value, so PINs only guard the till against the person standing at
 * it (with an attempt limit). Real protection of the shop's data is the
 * owner's account password and row-level security on the server.
 */

const ITERATIONS = 100_000
export const PIN_MIN = 4
export const PIN_MAX = 6

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
  return new Uint8Array(bits)
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error(`PIN must be ${PIN_MIN}–${PIN_MAX} digits`)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(pin, salt, ITERATIONS))}`
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split('$')
  if (scheme !== 'pbkdf2' || !iter || !salt || !hash) return false
  const got = await derive(pin, unb64(salt), Number(iter))
  const want = unb64(hash)
  if (got.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i]
  return diff === 0
}
