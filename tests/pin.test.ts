import { describe, expect, it } from 'vitest'
import { hashPin, isValidPin, verifyPin } from '../src/auth/pin'

describe('till PINs', () => {
  it('accepts 4–6 digits only', () => {
    expect(isValidPin('0123')).toBe(true)
    expect(isValidPin('123456')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('1234567')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
  })

  it('verifies the right PIN, keeps leading zeros, and rejects others', async () => {
    const stored = await hashPin('0123')
    expect(stored).toMatch(/^pbkdf2\$100000\$/)
    expect(stored).not.toContain('0123$')
    expect(await verifyPin('0123', stored)).toBe(true)
    expect(await verifyPin('123', stored)).toBe(false)
    expect(await verifyPin('0124', stored)).toBe(false)
  })

  it('salts each hash', async () => {
    expect(await hashPin('4321')).not.toBe(await hashPin('4321'))
  })

  it('rejects malformed stored values', async () => {
    expect(await verifyPin('1234', 'plain')).toBe(false)
  })
})
