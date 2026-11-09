import { useState } from 'react'
import { DashboardScreen } from './dashboard/DashboardScreen'
import { PosScreen } from './pos/PosScreen'
import { ComingSoon } from './screens/ComingSoon'
import { SettingsScreen } from './screens/SettingsScreen'
import { AppShell } from './shell/AppShell'
import type { ScreenId } from './shell/nav'
import { useConnection } from './shell/useConnection'
import { ToastProvider } from './ui/toast'
import './screens/screens.css'

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('pos')
  const connection = useConnection()

  return (
    <ToastProvider>
      <AppShell screen={screen} onNavigate={setScreen}>
        {screen === 'pos' ? (
          <PosScreen connection={connection} />
        ) : screen === 'dashboard' ? (
          <DashboardScreen connection={connection} onNavigate={setScreen} />
        ) : screen === 'settings' ? (
          <SettingsScreen />
        ) : (
          <ComingSoon screen={screen} onOpenPos={() => setScreen('pos')} />
        )}
      </AppShell>
    </ToastProvider>
  )
}
