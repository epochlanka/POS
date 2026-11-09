import { useEffect, useState } from 'react'
import { cloudConfigured } from '../db/connector'
import { db } from '../db/database'
import { useSyncStatus } from '../db/useQuery'

export type ConnectionState =
  | { kind: 'local' } // cloud not set up yet: everything stays on this device
  | { kind: 'online' }
  | { kind: 'syncing'; pendingBills: number }
  | { kind: 'offline'; pendingBills: number }

/** Bills saved on this device but not uploaded yet. */
async function countPendingBills(): Promise<number> {
  try {
    // ps_crud is PowerSync's upload queue; each row's data says which table it's for.
    const row = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM ps_crud WHERE json_extract(data, '$.type') = 'sales'")
    return row.n
  } catch {
    return (await db.getUploadQueueStats()).count
  }
}

export function useConnection(): ConnectionState {
  const status = useSyncStatus()
  const [pending, setPending] = useState(0)

  useEffect(() => {
    if (!cloudConfigured) return
    let alive = true
    const tick = () => countPendingBills().then((n) => alive && setPending(n))
    tick()
    const timer = setInterval(tick, 3000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  if (!cloudConfigured) return { kind: 'local' }
  if (!status.connected) return { kind: 'offline', pendingBills: pending }
  if (pending > 0 || status.dataFlowStatus.uploading || status.dataFlowStatus.downloading) return { kind: 'syncing', pendingBills: pending }
  return { kind: 'online' }
}
