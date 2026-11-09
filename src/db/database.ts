import { PowerSyncDatabase } from '@powersync/capacitor'
import { newId } from '../lib/ids'
import { cloudConfigured, supabase, SupabaseConnector } from './connector'
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
 * Identity of this device. Until sign-up exists, a local shop is created so
 * the app works with no account. TODO: replace with the shop/branch the user
 * picks after logging in, and a prefix (C1, C2...) assigned by the server.
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

export async function initDatabase(): Promise<void> {
  await db.init()
  if (cloudConfigured && supabase) {
    await db.connect(new SupabaseConnector(supabase))
  }
}
