import { useTranslation } from 'react-i18next'
import { Pill } from '../ui'
import type { ConnectionState } from './useConnection'

/** Always visible in the top bar: green Online, blue Syncing, amber Offline. */
export function ConnectionPill({ state }: { state: ConnectionState }) {
  const { t } = useTranslation()
  switch (state.kind) {
    case 'local':
      return <Pill tone="neutral" dot>{t('conn.local')}</Pill>
    case 'online':
      return <Pill tone="success" dot>{t('conn.online')}</Pill>
    case 'syncing':
      return <Pill tone="info" dot>{t('conn.syncing', { count: state.pendingBills })}</Pill>
    case 'offline':
      return <Pill tone="warning" dot>{t('conn.offline', { count: state.pendingBills })}</Pill>
  }
}
