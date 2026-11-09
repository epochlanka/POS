import { useEffect, useEffectEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { NumPad } from '../ui'
import { PIN_MAX } from './pin'

/**
 * PIN entry: dots plus the touch keypad. Number keys and Backspace on a
 * physical keyboard work too; Enter submits.
 */
export function PinPad({
  value,
  onChange,
  onSubmit,
  error,
  disabled,
}: {
  value: string
  /** Gets an updater, so fast typing never builds on a stale value. */
  onChange: (update: (prev: string) => string) => void
  onSubmit: () => void
  error?: string | null
  disabled?: boolean
}) {
  const { t } = useTranslation()

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (disabled || document.querySelector('dialog[open]')) return
    if (e.target instanceof HTMLInputElement) return
    if (/^\d$/.test(e.key)) onChange((v) => (v + e.key).slice(0, PIN_MAX))
    else if (e.key === 'Backspace') onChange((v) => v.slice(0, -1))
    else if (e.key === 'Enter') onSubmit()
    else return
    e.preventDefault()
  })
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="pinpad">
      <div className={`pin-dots ${error ? 'is-error' : ''}`} role="img" aria-label={t('auth.pin.entered', { count: value.length })}>
        {Array.from({ length: PIN_MAX }, (_, i) => (
          <span key={i} className={i < value.length ? 'is-filled' : ''} />
        ))}
      </div>
      <p className="pin-error" role="alert">
        {error ?? ''}
      </p>
      <NumPad value={value} digits onChange={(v) => !disabled && onChange(() => v.replace(/\D/g, '').slice(0, PIN_MAX))} />
    </div>
  )
}
