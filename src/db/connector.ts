import type { CommonPowerSyncDatabase, PowerSyncBackendConnector } from '@powersync/web'
import { UpdateType } from '@powersync/web'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const POWERSYNC_URL = import.meta.env.VITE_POWERSYNC_URL as string | undefined

/** False until .env is filled in. The app then runs fully offline. */
export const cloudConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && POWERSYNC_URL)

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
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
