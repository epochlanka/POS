import { describe, expect, it } from 'vitest'
import { addDays, addMonths, dayKey, monthKey, pctChange } from '../src/lib/dates'
import { formatCompact, formatRupees } from '../src/lib/money'

describe('formatCompact', () => {
  it('shortens large amounts', () => {
    expect(formatCompact(95000)).toBe('950')
    expect(formatCompact(8_430_000)).toBe('84.3K')
    expect(formatCompact(1_000_000)).toBe('10K')
    expect(formatCompact(21_840_000)).toBe('218K')
    expect(formatCompact(20_000_000)).toBe('200K')
    expect(formatCompact(214_000_000)).toBe('2.14M')
  })
})

describe('formatRupees', () => {
  it('rounds to whole rupees', () => {
    expect(formatRupees(8_425_049)).toBe('84,250')
  })
})

describe('dates', () => {
  it('builds local calendar keys across month and year ends', () => {
    expect(dayKey(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01')
    expect(monthKey(addMonths(new Date(2026, 11, 15), 1))).toBe('2027-01')
  })

  it('computes change only when there is a base', () => {
    expect(pctChange(112, 100)).toBe(12)
    expect(pctChange(50, 0)).toBeNull()
  })
})
