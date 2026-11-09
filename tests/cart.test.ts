import { describe, expect, it } from 'vitest'
import { cartReducer, discountCents, emptyCart, quickCashAmounts, toSaleItems, totals, type CartLine } from '../src/pos/cart'

const dhal: Omit<CartLine, 'qty'> = { variantId: 'v1', name: 'Red Dhal 1kg', unitPrice: 42000, unitCost: 36000, stock: 6 }
const tea: Omit<CartLine, 'qty'> = { variantId: 'v2', name: 'Tea 200g', unitPrice: 39000, unitCost: 30000, stock: 40 }

describe('cartReducer', () => {
  it('adds, merges repeats and tracks the last added line', () => {
    let s = cartReducer(emptyCart, { type: 'add', line: dhal })
    s = cartReducer(s, { type: 'add', line: tea })
    s = cartReducer(s, { type: 'add', line: dhal })
    expect(s.lines.map((l) => [l.variantId, l.qty])).toEqual([['v1', 2], ['v2', 1]])
    expect(s.lastAddedId).toBe('v1')
  })

  it('removes a line when quantity goes to zero', () => {
    let s = cartReducer(emptyCart, { type: 'add', line: dhal })
    s = cartReducer(s, { type: 'setQty', variantId: 'v1', qty: 0 })
    expect(s.lines).toEqual([])
  })

  it('keeps weighed quantities clean', () => {
    let s = cartReducer(emptyCart, { type: 'add', line: dhal, qty: 0.1 })
    s = cartReducer(s, { type: 'add', line: dhal, qty: 0.2 })
    expect(s.lines[0].qty).toBe(0.3)
  })
})

describe('discounts and totals', () => {
  it('applies line and bill discounts', () => {
    let s = cartReducer(emptyCart, { type: 'add', line: dhal, qty: 2 }) // 840.00
    s = cartReducer(s, { type: 'add', line: tea }) // 390.00
    s = cartReducer(s, { type: 'lineDiscount', variantId: 'v2', discount: { kind: 'pct', value: 10 } }) // -39.00
    s = cartReducer(s, { type: 'billDiscount', discount: { kind: 'amount', value: 1000 } }) // -10.00
    expect(totals(s)).toEqual({ subtotal: 119100, billDiscount: 1000, discountTotal: 4900, total: 118100, itemCount: 3 })
    expect(toSaleItems(s).map((i) => i.discount)).toEqual([0, 3900])
  })

  it('never discounts more than the amount', () => {
    expect(discountCents(5000, { kind: 'amount', value: 9000 })).toBe(5000)
    expect(discountCents(5000, { kind: 'pct', value: 150 })).toBe(5000)
  })
})

describe('quickCashAmounts', () => {
  it('offers exact amount and likely notes', () => {
    expect(quickCashAmounts(237100)).toEqual([237100, 250000, 300000, 500000])
  })

  it('always offers amounts above the total', () => {
    expect(quickCashAmounts(100000)).toEqual([100000, 150000, 200000, 500000])
    expect(quickCashAmounts(6000)).toEqual([6000, 10000, 50000, 100000])
  })
})
