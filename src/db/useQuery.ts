import { useEffect, useState } from 'react'
import type { SyncStatus } from '@powersync/web'
import { db } from './database'

/** Runs a SQL query and re-runs it whenever the tables it reads change. */
export function useQuery<T>(sql: string, params: unknown[] = []): T[] {
  return useQueryState<T>(sql, params).rows
}

/** Like useQuery, plus `loaded` so "no rows" can be told apart from "not read yet". */
export function useQueryState<T>(sql: string, params: unknown[] = []): { rows: T[]; loaded: boolean } {
  const key = JSON.stringify(params)
  const [state, setState] = useState<{ rows: T[]; for: string | null }>({ rows: [], for: null })
  const queryId = sql + key
  useEffect(() => {
    const abort = new AbortController()
    db.watch(
      sql,
      JSON.parse(key),
      {
        onResult: (r) => setState({ rows: (r.rows?._array ?? []) as T[], for: sql + key }),
        onError: (e) => console.error('Query failed:', sql, e),
      },
      { signal: abort.signal, throttleMs: 50 },
    )
    return () => abort.abort()
  }, [sql, key])
  return state.for === queryId ? { rows: state.rows, loaded: true } : { rows: state.rows, loaded: false }
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState(db.currentStatus)
  useEffect(() => db.registerListener({ statusChanged: setStatus }), [])
  return status
}
