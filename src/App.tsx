import { useState } from 'react'
import { canManage, useSession } from './auth/session'
import { DashboardScreen } from './dashboard/DashboardScreen'
import { PosScreen } from './pos/PosScreen'
import { ComingSoon } from './screens/ComingSoon'
import { SettingsScreen } from './screens/SettingsScreen'
import { AppShell } from './shell/AppShell'
import { navFor, type ScreenId } from './shell/nav'
import { useConnection } from './shell/useConnection'
import { ToastProvider } from './ui/toast'
import './screens/screens.css'

export default function App() {
  const session = useSession()
  // Owners land on the dashboard, cashiers on the till. Offline demo: the till.
  const [requested, setScreen] = useState<ScreenId>(session.staff && canManage(session) ? 'dashboard' : 'pos')
  const connection = useConnection()
  // A cashier who follows a link to a manager screen (e.g. a dashboard tile) stays on the till.
  const screen = navFor(canManage(session)).some((n) => n.id === requested) ? requested : 'pos'

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
