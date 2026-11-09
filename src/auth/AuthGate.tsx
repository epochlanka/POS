import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authConfigured } from '../db/connector'
import { linkedAccount, type LinkedAccount } from './account'
import { LockScreen } from './LockScreen'
import { Onboarding } from './Onboarding'
import { SessionContext, type Session, type StaffMember } from './session'
import { SetupPin } from './SetupPin'
import { useStaffList } from './staff'
import './auth.css'

type Phase = { kind: 'loading' } | { kind: 'local' } | { kind: 'onboarding' } | { kind: 'linked'; account: LinkedAccount }

/**
 * What stands between opening the app and the till:
 *   no Supabase settings → straight in (offline demo, no login)
 *   device not linked   → owner signs in and picks/creates the shop (online)
 *   no PIN profile yet  → owner sets their name and PIN
 *   otherwise           → PIN lock; it locks again on restart and on "Lock"
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(authConfigured ? { kind: 'loading' } : { kind: 'local' })
  const [staff, setStaff] = useState<StaffMember | null>(null)
  const [resettingPin, setResettingPin] = useState(false)

  const refresh = () => linkedAccount().then((account) => setPhase(account ? { kind: 'linked', account } : { kind: 'onboarding' }))
  useEffect(() => {
    if (authConfigured) refresh()
  }, [])

  const account = phase.kind === 'linked' ? phase.account : null
  const people = useStaffList(account?.shopId ?? null)
  const session = useMemo<Session>(() => ({ staff, lock: () => setStaff(null) }), [staff])

  if (phase.kind === 'local') return <SessionContext value={session}>{children}</SessionContext>
  if (phase.kind === 'loading') return <div className="auth" />
  if (phase.kind === 'onboarding') return <Onboarding onLinked={refresh} />
  if (!account || !people.loaded) return <div className="auth" />

  const unlock = (s: StaffMember) => {
    setResettingPin(false)
    setStaff(s)
  }

  if (people.rows.length === 0 || resettingPin) {
    const own = people.rows.find((p) => p.id === account.userId)
    return (
      <SetupPin
        account={account}
        initialName={own?.name}
        reset={resettingPin}
        onDone={unlock}
        onCancel={resettingPin ? () => setResettingPin(false) : undefined}
      />
    )
  }
  if (!staff) return <LockScreen account={account} staff={people.rows} onUnlock={unlock} onResetPin={() => setResettingPin(true)} />

  // Keyed by person so each one starts on their own home screen.
  return (
    <SessionContext value={session}>
      <Fragment key={staff.id}>{children}</Fragment>
    </SessionContext>
  )
}
