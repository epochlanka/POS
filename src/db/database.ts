import { PowerSyncDatabase } from '@powersync/capacitor'
import { newId } from '../lib/ids'
import { supabase, SupabaseConnector, syncConfigured } from './connector'
import { AppSchema } from './schema'

// On Android this uses native SQLite; in the browser and in Electron it uses
// SQLite compiled to WASM, stored in IndexedDB.
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'lanka-pos.sqlite' },
})

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.getOptional<{ value: string }>('SELECT value FROM device_settings WHERE id = ?', [key])
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.execute('INSERT OR REPLACE INTO device_settings (id, value) VALUES (?, ?)', [key, value])
}

export interface DeviceContext {
  shopId: string
  branchId: string
  deviceId: string
  devicePrefix: string
}

/**
 * Identity of this device. Signed-in devices get these from linkDevice()
 * (src/auth/account.ts). In offline demo mode (no Supabase settings) a local
 * shop is made up on first use.
 */
export async function deviceContext(): Promise<DeviceContext> {
  const ensure = async (key: string, make: () => string) => {
    let v = await getSetting(key)
    if (!v) {
      v = make()
      await setSetting(key, v)
    }
    return v
  }
  return {
    shopId: await ensure('shop_id', newId),
    branchId: await ensure('branch_id', newId),
    deviceId: await ensure('device_id', newId),
    devicePrefix: await ensure('device_prefix', () => 'C1'),
  }
}

/** Starts syncing if the cloud is set up. Safe to call again after sign-in. */
export async function connectSync(): Promise<void> {
  if (syncConfigured && supabase) await db.connect(new SupabaseConnector(supabase))
}

export async function initDatabase(): Promise<void> {
  await db.init()
  await connectSync()
}
