import { newId } from '../lib/ids'
import { totals, type CartState } from '../pos/cart'
import { db, getSetting, setSetting } from './database'

export interface HeldBillRow {
  id: string
  label: string
  note: string | null
  cart_json: string
  total: number
  item_count: number
  held_by: string | null
  created_at: string
}

/** Parks the current bill. Labels run H-01, H-02... and restart when none are held. */
export async function holdBill(cart: CartState, note: string, heldBy?: string): Promise<string> {
  const { total, itemCount } = totals(cart)
  return db.writeTransaction(async (tx) => {
    const { n } = await tx.get<{ n: number }>('SELECT COUNT(*) AS n FROM held_bills')
    const seqRow = await tx.getOptional<{ value: string }>("SELECT value FROM device_settings WHERE id = 'held_seq'")
    const seq = n === 0 ? 1 : Number(seqRow?.value ?? '0') + 1
    await tx.execute("INSERT OR REPLACE INTO device_settings (id, value) VALUES ('held_seq', ?)", [String(seq)])
    const label = `H-${String(seq).padStart(2, '0')}`
    await tx.execute(
      `INSERT INTO held_bills (id, label, note, cart_json, total, item_count, held_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), label, note.trim() || null, JSON.stringify(cart), total, itemCount, heldBy ?? null, new Date().toISOString()],
    )
    return label
  })
}

/** Takes a held bill back out (removing it from the list) and returns its cart. */
export async function resumeBill(id: string): Promise<CartState> {
  return db.writeTransaction(async (tx) => {
    const row = await tx.get<HeldBillRow>('SELECT * FROM held_bills WHERE id = ?', [id])
    await tx.execute('DELETE FROM held_bills WHERE id = ?', [id])
    return JSON.parse(row.cart_json) as CartState
  })
}

export async function deleteHeldBill(id: string): Promise<void> {
  await db.execute('DELETE FROM held_bills WHERE id = ?', [id])
}

// The bill being rung up is saved as it changes, so a power cut or app
// restart doesn't lose it.
export async function loadOpenBill(): Promise<CartState | null> {
  const raw = await getSetting('open_bill')
  if (!raw) return null
  try {
    return JSON.parse(raw) as CartState
  } catch {
    return null
  }
}

export async function saveOpenBill(cart: CartState): Promise<void> {
  await setSetting('open_bill', cart.lines.length ? JSON.stringify(cart) : '')
}
