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

/** Line total for a quantity (may be fractional, e.g. 0.5 kg) at a unit price. */
export function lineTotal(unitPrice: Cents, qty: number, discount: Cents = 0): Cents {
  return Math.round(unitPrice * qty) - discount
}
