import { db } from '../db/database'
import { useQueryState } from '../db/useQuery'
import type { Role } from './account'
import { hashPin } from './pin'

export interface StaffProfile {
  id: string
  name: string
  role: Role
  user_id: string | null
  pin_hash: string
}

const ROLE_ORDER = "CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END"

/** Active staff of the linked shop, owners first. Works offline. */
export function useStaffList(shopId: string | null) {
  return useQueryState<StaffProfile>(
    `SELECT id, name, role, user_id, pin_hash FROM staff WHERE shop_id = ? AND is_active = 1 ORDER BY ${ROLE_ORDER}, name`,
    [shopId ?? ''],
  )
}

/**
 * Creates or updates a PIN profile. An account holder's own profile uses
 * their user id as its id, so setting it up again on a second device (before
 * sync brings the first one down) updates the same row instead of adding a
 * duplicate.
 */
export async function saveStaffPin(p: { id: string; shopId: string; userId: string | null; name: string; role: Role; pin: string }) {
  const pinHash = await hashPin(p.pin)
  await db.writeTransaction(async (tx) => {
    const existing = await tx.getOptional('SELECT id FROM staff WHERE id = ?', [p.id])
    if (existing) {
      await tx.execute('UPDATE staff SET name = ?, pin_hash = ?, is_active = 1 WHERE id = ?', [p.name.trim(), pinHash, p.id])
    } else {
      await tx.execute('INSERT INTO staff (id, shop_id, user_id, name, role, pin_hash, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)', [
        p.id,
        p.shopId,
        p.userId,
        p.name.trim(),
        p.role,
        pinHash,
        new Date().toISOString(),
      ])
    }
  })
}
