import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog } from '../ui'
import { AccountError, signIn, type LinkedAccount } from './account'
import { AuthFrame, FormError } from './AuthFrame'
import { PIN_MIN, verifyPin } from './pin'
import { PinPad } from './PinPad'
import type { StaffMember } from './session'
import type { StaffProfile } from './staff'

const MAX_TRIES = 5
const LOCKOUT_MS = 30_000
const clock = () => Date.now()

/** Who's at the till? Pick your name, enter your PIN. Works offline. */
export function LockScreen({
  account,
  staff,
  onUnlock,
  onResetPin,
}: {
  account: LinkedAccount
  staff: StaffProfile[]
  onUnlock: (s: StaffMember) => void
  onResetPin: () => void
}) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(staff.length === 1 ? staff[0].id : null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tries, setTries] = useState<Record<string, number>>({})
  const [lockedUntil, setLockedUntil] = useState(0)
  const [now, setNow] = useState(clock)
  const [forgotOpen, setForgotOpen] = useState(false)

  const selected = staff.find((s) => s.id === selectedId) ?? null
  const waitSec = Math.max(0, Math.ceil((lockedUntil - now) / 1000))

  useEffect(() => {
    if (lockedUntil <= clock()) return
    const timer = setInterval(() => setNow(clock()), 500)
    return () => clearInterval(timer)
  }, [lockedUntil])

  const pick = (id: string) => {
    setSelectedId(id)
    setPin('')
    setError(null)
  }

  const unlock = async () => {
    if (!selected || busy || waitSec > 0 || pin.length < PIN_MIN) return
    setBusy(true)
    const ok = await verifyPin(pin, selected.pin_hash)
    setBusy(false)
    if (ok) {
      setTries((m) => ({ ...m, [selected.id]: 0 }))
      onUnlock({ id: selected.id, name: selected.name, role: selected.role })
      return
    }
    const n = (tries[selected.id] ?? 0) + 1
    setTries((m) => ({ ...m, [selected.id]: n >= MAX_TRIES ? 0 : n }))
    setPin('')
    if (n >= MAX_TRIES) {
      const at = clock()
      setLockedUntil(at + LOCKOUT_MS)
      setNow(at)
      setError(t('auth.lock.tooMany', { count: LOCKOUT_MS / 1000 }))
    } else {
      setError(t('auth.lock.wrong', { count: MAX_TRIES - n }))
    }
  }

  // Only the account holder can reset their PIN here, with the account password.
  const canReset = !selected || selected.user_id === account.userId

  return (
    <AuthFrame title={account.shopName || t('auth.lock.title')} subtitle={t('auth.lock.subtitle', { counter: account.devicePrefix })} wide>
      <div className="lock">
        <div className="lock__people" role="radiogroup" aria-label={t('auth.lock.who')}>
          {staff.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={s.id === selectedId}
              className={`person ${s.id === selectedId ? 'is-selected' : ''}`}
              onClick={() => pick(s.id)}
            >
              <span className="person__avatar" aria-hidden>
                {s.name.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <span className="person__text">
                <strong>{s.name}</strong>
                <span className="muted small">{t(`auth.role.${s.role}`)}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="lock__pin">
          {selected ? (
            <>
              <p className="pin-stage">{t('auth.lock.enterPin', { name: selected.name })}</p>
              <PinPad
                value={pin}
                onChange={(update) => (setPin(update), setError(null))}
                onSubmit={unlock}
                error={waitSec > 0 ? t('auth.lock.wait', { count: waitSec }) : error}
                disabled={busy || waitSec > 0}
              />
              <Button variant="primary" size="lg" block onClick={unlock} disabled={busy || waitSec > 0 || pin.length < PIN_MIN}>
                {t('auth.lock.unlock')}
              </Button>
            </>
          ) : (
            <p className="muted lock__hint">{t('auth.lock.who')}</p>
          )}
          <div className="auth__links">
            {canReset ? (
              <button type="button" className="link" onClick={() => setForgotOpen(true)}>
                {t('auth.lock.forgot')}
              </button>
            ) : (
              <span className="muted small">{t('auth.lock.askOwner')}</span>
            )}
          </div>
        </div>
      </div>

      <ForgotPinDialog
        open={forgotOpen}
        email={account.email}
        onClose={() => setForgotOpen(false)}
        onVerified={() => {
          setForgotOpen(false)
          onResetPin()
        }}
      />
    </AuthFrame>
  )
}

/** Checks the account password (needs the internet) before a PIN reset. */
function ForgotPinDialog({ open, email, onClose, onVerified }: { open: boolean; email: string; onClose: () => void; onVerified: () => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      setPassword('')
      onVerified()
    } catch (err) {
      setError(err instanceof AccountError ? t(`auth.err.${err.key}`, { defaultValue: t('auth.err.generic') }) : t('auth.err.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('auth.lock.forgotTitle')} labelledBy="forgot-pin-title">
      <form className="auth__form" onSubmit={submit}>
        <p className="muted">{t('auth.lock.forgotBody', { email })}</p>
        <label className="field">
          <span className="field__label">{t('auth.password')}</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <FormError message={error} />
        <Button type="submit" variant="primary" block disabled={busy || !password}>
          {busy ? t('auth.working') : t('auth.lock.forgotSubmit')}
        </Button>
      </form>
    </Dialog>
  )
}
