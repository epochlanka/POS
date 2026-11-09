import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui'
import type { LinkedAccount } from './account'
import { AuthFrame } from './AuthFrame'
import { isValidPin, PIN_MAX, PIN_MIN } from './pin'
import { PinPad } from './PinPad'
import type { StaffMember } from './session'
import { saveStaffPin } from './staff'

/**
 * The account holder's own till profile: their name (printed on receipts)
 * and a PIN, entered twice. Also used to reset a forgotten PIN after the
 * account password has been checked.
 */
export function SetupPin({
  account,
  initialName,
  reset,
  onDone,
  onCancel,
}: {
  account: LinkedAccount
  initialName?: string
  reset?: boolean
  onDone: (staff: StaffMember) => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialName ?? account.email.split('@')[0] ?? '')
  const [stage, setStage] = useState<'first' | 'confirm'>('first')
  const [first, setFirst] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const next = async () => {
    if (busy) return
    if (!name.trim()) return setError(t('auth.pin.needName'))
    if (!isValidPin(pin)) return setError(t('auth.pin.rule', { min: PIN_MIN, max: PIN_MAX }))
    if (stage === 'first') {
      setFirst(pin)
      setPin('')
      setError(null)
      setStage('confirm')
      return
    }
    if (pin !== first) {
      setPin('')
      setFirst('')
      setStage('first')
      return setError(t('auth.pin.mismatch'))
    }
    setBusy(true)
    try {
      // The account holder's profile id is their user id (see saveStaffPin).
      await saveStaffPin({ id: account.userId, shopId: account.shopId, userId: account.userId, name, role: account.role, pin })
      onDone({ id: account.userId, name: name.trim(), role: account.role })
    } catch (e) {
      console.error(e)
      setError(t('auth.err.generic'))
      setBusy(false)
    }
  }

  return (
    <AuthFrame
      title={reset ? t('auth.pin.resetTitle') : t('auth.pin.setupTitle')}
      subtitle={t('auth.pin.setupSubtitle', { shop: account.shopName })}
    >
      <div className="auth__form">
        <label className="field">
          <span className="field__label">{t('auth.pin.yourName')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" disabled={stage === 'confirm'} />
          <span className="muted small">{t('auth.pin.nameHint')}</span>
        </label>
        <p className="pin-stage" aria-live="polite">
          {stage === 'first' ? t('auth.pin.choose', { min: PIN_MIN, max: PIN_MAX }) : t('auth.pin.again')}
        </p>
        <PinPad value={pin} onChange={(update) => (setPin(update), setError(null))} onSubmit={next} error={error} disabled={busy} />
        <Button variant="primary" size="lg" block onClick={next} disabled={busy || pin.length < PIN_MIN}>
          {stage === 'first' ? t('auth.pin.next') : t('auth.pin.save')}
        </Button>
        {onCancel && (
          <Button variant="ghost" block onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        )}
      </div>
    </AuthFrame>
  )
}
