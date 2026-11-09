import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Store } from 'lucide-react'
import { LANGUAGES } from '../i18n'

/** Full-screen frame for sign-in, setup and the PIN lock. */
export function AuthFrame({ title, subtitle, children, wide }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  const { i18n } = useTranslation()
  return (
    <div className="auth">
      <header className="auth__top">
        <div className="auth__brand">
          <span className="rail__logo" aria-hidden>
            <Store size={18} />
          </span>
          <span>Lanka POS</span>
        </div>
        <div className="auth__langs" role="group" aria-label="Language">
          {LANGUAGES.map((l) => (
            <button key={l.code} type="button" aria-pressed={i18n.language === l.code} onClick={() => i18n.changeLanguage(l.code)}>
              {l.label}
            </button>
          ))}
        </div>
      </header>
      <main className={`auth__card card ${wide ? 'auth__card--wide' : ''}`}>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </main>
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p className="notice notice--danger" role="alert">
      {message}
    </p>
  ) : null
}
