import type { CartItem } from '../db/sales'
import type { Cents } from '../lib/money'

/** A discount is either a percentage or a fixed LKR amount (in cents). */
export type Discount = { kind: 'pct'; value: number } | { kind: 'amount'; value: Cents }

export interface CartLine {
  variantId: string
  name: string
  qty: number
  unitPrice: Cents
  unitCost: Cents
  stock: number
  discount?: Discount
}

export interface CartState {
  lines: CartLine[]
  billDiscount?: Discount
  lastAddedId?: string
}

export const emptyCart: CartState = { lines: [] }

/** Discounts above this need a manager (Phase 08 adds the PIN override). */
export const CASHIER_DISCOUNT_LIMIT_PCT = 10

export type CartAction =
  | { type: 'add'; line: Omit<CartLine, 'qty'>; qty?: number }
  | { type: 'setQty'; variantId: string; qty: number }
  | { type: 'remove'; variantId: string }
  | { type: 'lineDiscount'; variantId: string; discount?: Discount }
  | { type: 'billDiscount'; discount?: Discount }
  | { type: 'load'; state: CartState }
  | { type: 'clear' }

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const qty = action.qty ?? 1
      const existing = state.lines.find((l) => l.variantId === action.line.variantId)
      const lines = existing
        ? state.lines.map((l) => (l === existing ? { ...l, qty: round3(l.qty + qty) } : l))
        : [...state.lines, { ...action.line, qty }]
      return { ...state, lines, lastAddedId: action.line.variantId }
    }
    case 'setQty':
      if (action.qty <= 0) return cartReducer(state, { type: 'remove', variantId: action.variantId })
      return { ...state, lines: state.lines.map((l) => (l.variantId === action.variantId ? { ...l, qty: round3(action.qty) } : l)) }
    case 'remove':
      return {
        ...state,
        lines: state.lines.filter((l) => l.variantId !== action.variantId),
        lastAddedId: state.lastAddedId === action.variantId ? undefined : state.lastAddedId,
      }
    case 'lineDiscount':
      return { ...state, lines: state.lines.map((l) => (l.variantId === action.variantId ? { ...l, discount: action.discount } : l)) }
    case 'billDiscount':
      return { ...state, billDiscount: action.discount }
    case 'load':
      return action.state
    case 'clear':
      return emptyCart
  }
}

/** Quantities allow grams (0.001 kg) but no float noise like 0.30000000000000004. */
function round3(n: number) {
  return Math.round(n * 1000) / 1000
}

/** Discount in cents for a base amount; never more than the base. */
export function discountCents(base: Cents, d?: Discount): Cents {
  if (!d || base <= 0) return 0
  const raw = d.kind === 'pct' ? Math.round((base * d.value) / 100) : d.value
  return Math.max(0, Math.min(base, raw))
}

/** Percentage a discount represents, used for the cashier limit. */
export function discountPct(base: Cents, d?: Discount): number {
  if (!d || base <= 0) return 0
  return d.kind === 'pct' ? d.value : (d.value / base) * 100
}

export function lineGross(l: CartLine): Cents {
  return Math.round(l.unitPrice * l.qty)
}

export function lineNet(l: CartLine): Cents {
  return lineGross(l) - discountCents(lineGross(l), l.discount)
}

export function totals(state: CartState) {
  const subtotal = state.lines.reduce((s, l) => s + lineNet(l), 0)
  const lineDiscounts = state.lines.reduce((s, l) => s + discountCents(lineGross(l), l.discount), 0)
  const billDiscount = discountCents(subtotal, state.billDiscount)
  const itemCount = state.lines.reduce((s, l) => s + (Number.isInteger(l.qty) ? l.qty : 1), 0)
  return {
    subtotal,
    billDiscount,
    discountTotal: lineDiscounts + billDiscount,
    total: subtotal - billDiscount,
    itemCount,
  }
}

/** Lines in the shape completeSale() expects, with discounts resolved to cents. */
export function toSaleItems(state: CartState): CartItem[] {
  return state.lines.map((l) => ({
    variantId: l.variantId,
    name: l.name,
    qty: l.qty,
    unitPrice: l.unitPrice,
    unitCost: l.unitCost,
    discount: discountCents(lineGross(l), l.discount),
  }))
}

/**
 * Buttons on the cash keypad: the exact amount, then what a customer is
 * likely to hand over — the next multiple of common notes above the total
 * (e.g. 2,371 → 2,500 · 3,000 · 5,000).
 */
export function quickCashAmounts(total: Cents): Cents[] {
  if (total <= 0) return []
  const rupees = total / 100
  const notes = rupees < 500 ? [100, 500, 1000] : [500, 1000, 5000]
  const options = new Set<number>()
  for (const note of notes) options.add((Math.floor(rupees / note) + 1) * note * 100)
  return [total, ...[...options].sort((a, b) => a - b)]
}
