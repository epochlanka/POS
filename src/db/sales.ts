import { formatBillNo, newId } from '../lib/ids'
import { lineTotal, type Cents } from '../lib/money'
import { db, deviceContext, getSetting } from './database'

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

/** Demo catalogue for development, so the POS screen has something to sell. */
export async function seedDemoData() {
  const existing = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM categories')
  if (existing.n > 0) return
  const ctx = await deviceContext()
  const now = new Date().toISOString()

  const categories: [string, string, string][] = [
    ['Grocery', 'සිල්ලර', 'மளிகை'],
    ['Drinks', 'බීම', 'பானங்கள்'],
    ['Snacks', 'කෙටි කෑම', 'சிற்றுண்டி'],
    ['Household', 'ගෘහ භාණ්ඩ', 'வீட்டுப் பொருட்கள்'],
    ['Cosmetics', 'රූපලාවන්ය', 'அழகுசாதனம்'],
  ]
  // name, sinhala, tamil, category, barcode, cost, price (cents), opening stock
  const products: [string, string, string, string, string, number, number, number][] = [
    ['Red Dhal 1kg', 'රතු පරිප්පු 1kg', 'சிவப்பு பருப்பு 1kg', 'Grocery', '4790123000112', 36000, 42000, 6],
    ['Coconut Oil 1L', 'පොල්තෙල් 1L', 'தேங்காய் எண்ணெய் 1L', 'Grocery', '4790123000129', 74000, 85000, 22],
    ['Basmati Rice 5kg', 'බාස්මතී සහල් 5kg', 'பாஸ்மதி அரிசி 5kg', 'Grocery', '4790123000136', 215000, 245000, 64],
    ['Sugar 1kg', 'සීනි 1kg', 'சீனி 1kg', 'Grocery', '4790123000143', 26000, 30000, 0],
    ['Tea Leaves 200g', 'තේ කොළ 200g', 'தேயிலை 200g', 'Drinks', '4790123000150', 33000, 39000, 40],
    ['Soft Drink 1.5L', 'බීම 1.5L', 'குளிர்பானம் 1.5L', 'Drinks', '4790123000167', 35000, 42000, 35],
    ['Fresh Milk 1L', 'දියර කිරි 1L', 'பால் 1L', 'Drinks', '4790123000174', 49000, 56000, 8],
    ['Biscuits 200g', 'බිස්කට් 200g', 'பிஸ்கட் 200g', 'Snacks', '4790123000181', 27000, 32000, 51],
    ['Murukku 100g', 'මුරුක්කු 100g', 'முறுக்கு 100g', 'Snacks', '4790123000198', 14000, 18000, 27],
    ['Soap Bar 100g', 'සබන් 100g', 'சோப்பு 100g', 'Household', '4790123000204', 9000, 11000, 86],
    ['Dishwash 500ml', 'පිඟන් සෝදන දියර 500ml', 'பாத்திரம் கழுவும் திரவம் 500ml', 'Household', '4790123000211', 40000, 48000, 12],
    ['Face Cream 50g', 'මුහුණු ක්‍රීම් 50g', 'முகக் கிரீம் 50g', 'Cosmetics', '4790123000228', 78000, 95000, 4],
  ]

  await db.writeTransaction(async (tx) => {
    const catIds = new Map<string, string>()
    for (const [i, [name, si, ta]] of categories.entries()) {
      const id = newId()
      catIds.set(name, id)
      await tx.execute(
        'INSERT INTO categories (id, shop_id, name, name_si, name_ta, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [id, ctx.shopId, name, si, ta, i],
      )
    }
    for (const [name, si, ta, cat, barcode, cost, price, stock] of products) {
      const productId = newId()
      const variantId = newId()
      await tx.execute(
        `INSERT INTO products (id, shop_id, category_id, name, name_si, name_ta, tracks_batches, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)`,
        [productId, ctx.shopId, catIds.get(cat), name, si, ta, now],
      )
      await tx.execute(
        `INSERT INTO product_variants (id, shop_id, product_id, label, barcode, cost_price, sell_price, low_stock_level, is_active)
         VALUES (?, ?, ?, '', ?, ?, ?, 10, 1)`,
        [variantId, ctx.shopId, productId, barcode, cost, price],
      )
      if (stock > 0) {
        await tx.execute(
          `INSERT INTO stock_movements (id, shop_id, branch_id, variant_id, qty, kind, unit_cost, device_id, created_at)
           VALUES (?, ?, ?, ?, ?, 'opening', ?, ?, ?)`,
          [newId(), ctx.shopId, ctx.branchId, variantId, stock, cost, ctx.deviceId, now],
        )
      }
    }
  })
}

/**
 * Demo sales history (about 13 months) so the dashboard charts have data in
 * development. Development only, never with a cloud backend. These demo
 * bills don't write stock movements, so stock counts aren't reduced by them.
 */
export async function seedDemoHistory() {
  if (await getSetting('demo_history_v1')) return
  const ctx = await deviceContext()
  const variants = await db.getAll<{ id: string; name: string; sell_price: number; cost_price: number }>(
    'SELECT v.id, p.name, v.sell_price, v.cost_price FROM product_variants v JOIN products p ON p.id = v.product_id',
  )
  if (variants.length === 0) return

  // Small seeded random generator so every developer sees the same history.
  let seed = 42
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  const methods = ['cash', 'cash', 'cash', 'card', 'lankaqr'] as const

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let n = 0
  await db.writeTransaction(async (tx) => {
    for (let daysAgo = 400; daysAgo >= 1; daysAgo--) {
      const day = new Date(today)
      day.setDate(day.getDate() - daysAgo)
      const weekend = day.getDay() === 0 || day.getDay() === 6
      const growth = 1 + (400 - daysAgo) / 400 // the shop grows over the year
      const bills = Math.round((3 + rand() * 5) * growth * (weekend ? 1.4 : 1))
      for (let b = 0; b < bills; b++) {
        const at = new Date(day)
        at.setHours(7 + Math.floor(rand() * 14), Math.floor(rand() * 60))
        const saleId = newId()
        const lines = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({ v: pick(variants), qty: 1 + Math.floor(rand() * 2) }))
        const total = lines.reduce((s, l) => s + l.v.sell_price * l.qty, 0)
        n++
        await tx.execute(
          `INSERT INTO sales (id, shop_id, branch_id, device_id, bill_no, subtotal, discount, total, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'completed', ?)`,
          [saleId, ctx.shopId, ctx.branchId, ctx.deviceId, `DEMO-${String(n).padStart(5, '0')}`, total, total, at.toISOString()],
        )
        for (const l of lines) {
          await tx.execute(
            `INSERT INTO sale_lines (id, shop_id, sale_id, variant_id, name, qty, unit_price, unit_cost, discount, total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [newId(), ctx.shopId, saleId, l.v.id, l.v.name, l.qty, l.v.sell_price, l.v.cost_price, l.v.sell_price * l.qty],
          )
        }
        await tx.execute(
          'INSERT INTO sale_payments (id, shop_id, sale_id, method, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [newId(), ctx.shopId, saleId, pick([...methods]), total, at.toISOString()],
        )
      }
    }
    await tx.execute("INSERT OR REPLACE INTO device_settings (id, value) VALUES ('demo_history_v1', '1')")
  })
}
