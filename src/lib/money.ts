/**
 * All money is stored as integer cents (1 LKR = 100 cents) so totals never
 * drift because of floating-point rounding.
 */
export type Cents = number

export function toCents(rupees: number): Cents {
  return Math.round(rupees * 100)
}

export function formatLKR(cents: Cents): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const rupees = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  return `${sign}${rupees.toLocaleString('en-LK')}.${rest}`
}

/** Whole rupees with separators, for headline figures: 84,250. */
export function formatRupees(cents: Cents): string {
  return Math.round(cents / 100).toLocaleString('en-LK')
}

/** Short form for axes and tight spaces: 950 · 84.3K · 2.14M. */
export function formatCompact(cents: Cents): string {
  const r = cents / 100
  const abs = Math.abs(r)
  if (abs >= 1_000_000) return `${trim(r / 1_000_000, abs >= 10_000_000 ? 1 : 2)}M`
  if (abs >= 1_000) return `${trim(r / 1_000, abs >= 100_000 ? 0 : 1)}K`
  return String(Math.round(r))
}

function trim(n: number, digits: number): string {
  const s = n.toFixed(digits)
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

/** Line total for a quantity (may be fractional, e.g. 0.5 kg) at a unit price. */
export function lineTotal(unitPrice: Cents, qty: number, discount: Cents = 0): Cents {
  return Math.round(unitPrice * qty) - discount
}
