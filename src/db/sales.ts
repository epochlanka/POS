import { formatBillNo, newId } from '../lib/ids'
import { lineTotal, type Cents } from '../lib/money'
import { db, deviceContext } from './database'

export interface CartItem {
  variantId: string
  name: string
  qty: number
  unitPrice: Cents
  unitCost: Cents
  discount: Cents
}

export interface Payment {
  method: 'cash' | 'card' | 'lankaqr' | 'credit'
  amount: Cents
  reference?: string
}

export function cartTotals(items: CartItem[], billDiscount: Cents = 0) {
  const subtotal = items.reduce((s, i) => s + lineTotal(i.unitPrice, i.qty, i.discount), 0)
  return { subtotal, discount: billDiscount, total: subtotal - billDiscount }
}

/**
 * Records a sale entirely in the local database: the bill, its lines, its
 * payments and one stock movement per line, in a single transaction. Works
 * with no internet; sync uploads it later.
 */
export async function completeSale(items: CartItem[], payments: Payment[], billDiscount: Cents = 0, cashierId?: string) {
  if (items.length === 0) throw new Error('Cart is empty')
  const ctx = await deviceContext()
  const { subtotal, discount, total } = cartTotals(items, billDiscount)
  const paid = payments.reduce((s, p) => s + p.amount, 0)
  if (paid < total) throw new Error('Payment is less than the total')

  const saleId = newId()
  const now = new Date().toISOString()

  const billNo = await db.writeTransaction(async (tx) => {
    const seqRow = await tx.getOptional<{ value: string }>("SELECT value FROM device_settings WHERE id = 'bill_seq'")
    const seq = Number(seqRow?.value ?? '0') + 1
    await tx.execute("INSERT OR REPLACE INTO device_settings (id, value) VALUES ('bill_seq', ?)", [String(seq)])
    const billNo = formatBillNo(ctx.devicePrefix, seq)

    await tx.execute(
      `INSERT INTO sales (id, shop_id, branch_id, device_id, bill_no, cashier_id, subtotal, discount, total, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
      [saleId, ctx.shopId, ctx.branchId, ctx.deviceId, billNo, cashierId ?? null, subtotal, discount, total, now],
    )

    for (const i of items) {
      await tx.execute(
        `INSERT INTO sale_lines (id, shop_id, sale_id, variant_id, name, qty, unit_price, unit_cost, discount, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), ctx.shopId, saleId, i.variantId, i.name, i.qty, i.unitPrice, i.unitCost, i.discount, lineTotal(i.unitPrice, i.qty, i.discount)],
      )
      await tx.execute(
        `INSERT INTO stock_movements (id, shop_id, branch_id, variant_id, qty, kind, ref_id, unit_cost, user_id, device_id, created_at)
         VALUES (?, ?, ?, ?, ?, 'sale', ?, ?, ?, ?, ?)`,
        [newId(), ctx.shopId, ctx.branchId, i.variantId, -i.qty, saleId, i.unitCost, cashierId ?? null, ctx.deviceId, now],
      )
    }

    // Cash overpayment is recorded as the amount kept, not the note handed over.
    let remaining = total
    for (const p of payments) {
      const kept = p.method === 'cash' ? Math.min(p.amount, Math.max(remaining, 0)) : p.amount
      remaining -= kept
      await tx.execute(
        `INSERT INTO sale_payments (id, shop_id, sale_id, method, amount, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId(), ctx.shopId, saleId, p.method, kept, p.reference ?? null, now],
      )
    }
    return billNo
  })

  return { saleId, billNo, subtotal, discount, total, change: paid - total, createdAt: new Date(now) }
}

/** Demo products for development, so the POS screen has something to sell. */
export async function seedDemoData() {
  const existing = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM products')
  if (existing.n > 0) return
  const ctx = await deviceContext()
  const now = new Date().toISOString()
  const demo: [string, string, string, string, number, number, number][] = [
    // name, sinhala, tamil, barcode, cost, price, opening stock
    ['Full Cream Milk Powder 400g', 'කිරිපිටි 400g', 'பால் மா 400g', '4792000000011', 98000, 112000, 24],
    ['Basmati Rice 1kg', 'බාස්මතී සහල් 1kg', 'பாஸ்மதி அரிசி 1kg', '4792000000028', 52000, 61000, 40],
    ['Ceylon Tea 200g', 'තේ 200g', 'தேநீர் 200g', '4792000000035', 68000, 79000, 30],
    ['Coconut Oil 750ml', 'පොල්තෙල් 750ml', 'தேங்காய் எண்ணெய் 750ml', '4792000000042', 61000, 72000, 18],
    ['Dhal 500g', 'පරිප්පු 500g', 'பருப்பு 500g', '4792000000059', 19000, 23500, 50],
    ['Sugar 1kg', 'සීනි 1kg', 'சீனி 1kg', '4792000000066', 24000, 28000, 3],
  ]
  await db.writeTransaction(async (tx) => {
    for (const [name, si, ta, barcode, cost, price, stock] of demo) {
      const productId = newId()
      const variantId = newId()
      await tx.execute(
        `INSERT INTO products (id, shop_id, name, name_si, name_ta, tracks_batches, is_active, created_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?)`,
        [productId, ctx.shopId, name, si, ta, now],
      )
      await tx.execute(
        `INSERT INTO product_variants (id, shop_id, product_id, label, barcode, cost_price, sell_price, low_stock_level, is_active)
         VALUES (?, ?, ?, '', ?, ?, ?, 5, 1)`,
        [variantId, ctx.shopId, productId, barcode, cost, price],
      )
      await tx.execute(
        `INSERT INTO stock_movements (id, shop_id, branch_id, variant_id, qty, kind, unit_cost, device_id, created_at)
         VALUES (?, ?, ?, ?, ?, 'opening', ?, ?, ?)`,
        [newId(), ctx.shopId, ctx.branchId, variantId, stock, cost, ctx.deviceId, now],
      )
    }
  })
}
