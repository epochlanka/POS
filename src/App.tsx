import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cloudConfigured } from './db/connector'
import { useSyncStatus } from './db/useQuery'
import { LANGUAGES } from './i18n'
import { PosScreen } from './screens/PosScreen'
import { PrinterTestScreen } from './screens/PrinterTestScreen'

type Screen = 'pos' | 'printer'

function SyncBadge() {
  const { t } = useTranslation()
  const status = useSyncStatus()
  if (!cloudConfigured) return <span className="badge">{t('status.local')}</span>
  if (!status.connected) return <span className="badge warn">{t('status.offline')}</span>
  if (status.dataFlowStatus.uploading || status.dataFlowStatus.downloading) return <span className="badge">{t('status.syncing')}</span>
  return <span className="badge ok">{t('status.synced')}</span>
}

export default function App() {
  const { t, i18n } = useTranslation()
  const [screen, setScreen] = useState<Screen>('pos')

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">Lanka POS</strong>
        <nav>
          <button className={screen === 'pos' ? 'tab active' : 'tab'} onClick={() => setScreen('pos')}>{t('nav.pos')}</button>
          <button className={screen === 'printer' ? 'tab active' : 'tab'} onClick={() => setScreen('printer')}>{t('nav.printer')}</button>
        </nav>
        <div className="topbar-right">
          <SyncBadge />
          <select value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)} aria-label="Language">
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      </header>
      <main>{screen === 'pos' ? <PosScreen /> : <PrinterTestScreen />}</main>
    </div>
  )
}
