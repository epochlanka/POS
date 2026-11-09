import type { CommonPowerSyncDatabase, PowerSyncBackendConnector } from '@powersync/web'
import { UpdateType } from '@powersync/web'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const POWERSYNC_URL = import.meta.env.VITE_POWERSYNC_URL as string | undefined

/**
 * Supabase URL + key set: owners sign in and devices are linked to a shop.
 * Without them the app runs as a single offline demo shop with no login.
 */
export const authConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/** PowerSync URL also set: the local database syncs with the cloud. */
export const syncConfigured = authConfigured && Boolean(POWERSYNC_URL)

export const supabase: SupabaseClient | null = authConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      // No redirect-based flows: sign-up and password reset use emailed codes.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null

// Postgres errors that will never succeed on retry (bad data, permission
// denied). Retrying them forever would block every later upload, so they are
// logged and skipped. TODO: keep them in a local "failed uploads" table so
// nothing is lost silently.
const FATAL_PG_CODES = [/^22...$/, /^23...$/, /^42501$/]

// Tables the server must never update or delete rows in (append-only).
const INSERT_ONLY = new Set(['stock_movements', 'sale_lines', 'sale_payments'])

export class SupabaseConnector implements PowerSyncBackendConnector {
  private client: SupabaseClient
  constructor(client: SupabaseClient) {
    this.client = client
  }

  async fetchCredentials() {
    const { data, error } = await this.client.auth.getSession()
    if (error) throw error
    if (!data.session) return null
    return { endpoint: POWERSYNC_URL!, token: data.session.access_token }
  }

  async uploadData(db: CommonPowerSyncDatabase): Promise<void> {
    const tx = await db.getNextCrudTransaction()
    if (!tx) return

    for (const op of tx.crud) {
      const table = this.client.from(op.table)
      let result
      if (op.op === UpdateType.PUT) {
        result = INSERT_ONLY.has(op.table)
          ? await table.upsert({ ...op.opData, id: op.id }, { ignoreDuplicates: true })
          : await table.upsert({ ...op.opData, id: op.id })
      } else if (op.op === UpdateType.PATCH) {
        result = await table.update(op.opData!).eq('id', op.id)
      } else {
        result = await table.delete().eq('id', op.id)
      }

      if (result.error) {
        const code = result.error.code ?? ''
        if (FATAL_PG_CODES.some((re) => re.test(code))) {
          console.error('Upload rejected by server, skipping:', op, result.error)
          continue
        }
        throw result.error // network/temporary: PowerSync retries later
      }
    }
    await tx.complete()
  }
}
