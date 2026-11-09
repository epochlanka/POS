import { useEffect, useState } from 'react'
import type { SyncStatus } from '@powersync/web'
import { db } from './database'

/** Runs a SQL query and re-runs it whenever the tables it reads change. */
export function useQuery<T>(sql: string, params: unknown[] = []): T[] {
  const [rows, setRows] = useState<T[]>([])
  const key = JSON.stringify(params)
  useEffect(() => {
    const abort = new AbortController()
    db.watch(
      sql,
      JSON.parse(key),
      {
        onResult: (r) => setRows((r.rows?._array ?? []) as T[]),
        onError: (e) => console.error('Query failed:', sql, e),
      },
      { signal: abort.signal, throttleMs: 50 },
    )
    return () => abort.abort()
  }, [sql, key])
  return rows
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState(db.currentStatus)
  useEffect(() => db.registerListener({ statusChanged: setStatus }), [])
  return status
}
