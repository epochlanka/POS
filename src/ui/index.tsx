import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import './ui.css'

/* ---------------------------------------------------------------- Button */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function Button({
  variant = 'secondary',
  size = 'md',
  block,
  selected,
  icon,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'md' | 'lg'
  block?: boolean
  selected?: boolean
  icon?: boolean
}) {
  const cls = [
    'btn',
    variant !== 'secondary' && `btn--${variant}`,
    size === 'lg' && 'btn--lg',
    block && 'btn--block',
    selected && 'btn--selected',
    icon && 'btn--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button type="button" className={cls} {...rest} />
}

/* ---------------------------------------------------------------- Pill */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/** Status label: always colour plus a word, never colour alone. */
export function Pill({ tone, dot, children, onClick }: { tone: Tone; dot?: boolean; children: ReactNode; onClick?: () => void }) {
  const content = (
    <>
      {dot && <span className="pill__dot" aria-hidden />}
      {children}
    </>
  )
  return onClick ? (
    <button type="button" className={`pill pill--${tone}`} onClick={onClick}>
      {content}
    </button>
  ) : (
    <span className={`pill pill--${tone}`}>{content}</span>
  )
}

/* ---------------------------------------------------------------- Chip */

export function Chip({ selected, children, onClick }: { selected: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="chip" aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- Dialog */

/**
 * Modal built on the native <dialog> element (Esc closes, focus stays
 * inside, renders above everything). Becomes a bottom sheet on phones.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  labelledBy?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={wide ? 'dialog dialog--wide' : 'dialog'}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // backdrop click
      }}
    >
      {open && (
        <div className="dialog__inner">
          {title && (
            <div className="dialog__head">
              <h2 id={labelledBy}>{title}</h2>
              <Button variant="ghost" icon onClick={onClose} aria-label="Close">
                <X size={20} />
              </Button>
            </div>
          )}
          <div className="dialog__body">{children}</div>
          {footer && <div className="dialog__foot">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

/* ---------------------------------------------------------------- NumPad */

/** Touch keypad that edits a decimal string. `digits` keeps every key as typed (PINs: "0123"). */
export function NumPad({
  value,
  onChange,
  decimals = true,
  digits = false,
}: {
  value: string
  onChange: (v: string) => void
  decimals?: boolean
  digits?: boolean
}) {
  const press = (k: string) => {
    if (k === 'back') return onChange(value.slice(0, -1))
    if (k === '.') {
      if (!decimals || value.includes('.')) return
      return onChange((value || '0') + '.')
    }
    const [, frac] = value.split('.')
    if (frac !== undefined && frac.length >= 3) return
    onChange(value === '0' && !digits ? k : value + k)
  }
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimals && !digits ? '.' : '', '0', 'back']
  return (
    <div className="numpad">
      {keys.map((k, i) =>
        k === '' ? (
          <span key={`blank-${i}`} />
        ) : (
          <button key={k} type="button" onClick={() => press(k)} aria-label={k === 'back' ? 'Backspace' : k}>
            {k === 'back' ? '⌫' : k}
          </button>
        ),
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Empty state */

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}
