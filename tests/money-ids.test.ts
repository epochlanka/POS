import { describe, expect, it } from 'vitest'
import { formatBillNo } from '../src/lib/ids'
import { formatLKR, lineTotal, toCents } from '../src/lib/money'

describe('money', () => {
  it('converts rupees to cents without float drift', () => {
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents(1234.56)).toBe(123456)
  })

  it('formats LKR with thousands separators', () => {
    expect(formatLKR(123456789)).toBe('1,234,567.89')
    expect(formatLKR(-500)).toBe('-5.00')
  })

  it('handles fractional quantities', () => {
    expect(lineTotal(28000, 0.5)).toBe(14000)
    expect(lineTotal(28000, 2, 1000)).toBe(55000)
  })
})

describe('bill numbers', () => {
  it('includes the device prefix', () => {
    expect(formatBillNo('C1', 123)).toBe('C1-000123')
  })

  it('rejects bad input', () => {
    expect(() => formatBillNo('c1', 1)).toThrow()
    expect(() => formatBillNo('C1', 0)).toThrow()
  })
})
