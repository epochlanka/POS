import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { User } from '@supabase/supabase-js'
import { Eye, EyeOff, Store } from 'lucide-react'
import { Button } from '../ui'
import {
  AccountError,
  createShop,
  currentUser,
  linkDevice,
  myShops,
  resendSignUpCode,
  resetPassword,
  sendPasswordReset,
  signIn,
  signOut,
  signUp,
  verifySignUpCode,
  type MyShop,
} from './account'
import { AuthFrame, FormError } from './AuthFrame'

type Step = 'signin' | 'signup' | 'verify' | 'forgot' | 'reset' | 'shop'

const MIN_PASSWORD = 8

/** Turns any error into a translated message. */
function useErrorText() {
  const { t } = useTranslation()
  return (e: unknown) => {
    if (e instanceof AccountError) return t(`auth.err.${e.key}`, { defaultValue: t('auth.err.generic') })
    return t('auth.err.generic')
  }
}

/**
 * First run on a device: owner signs in (or creates an account), then picks
 * or creates their shop. Needs the internet; everything after works offline.
 */
export function Onboarding({ onLinked }: { onLinked: () => void }) {
  const [step, setStep] = useState<Step>('signin')
  const [email, setEmail] = useState('')
  const [user, setUser] = useState<User | null>(null)

  // Signed in earlier but the app closed before a shop was chosen.
  useEffect(() => {
    currentUser().then((u) => {
      if (u) {
        setUser(u)
        setStep('shop')
      }
    })
  }, [])

  const signedIn = (u: User) => {
    setUser(u)
    setStep('shop')
  }

  switch (step) {
    case 'signin':
      return <SignIn email={email} setEmail={setEmail} onDone={signedIn} go={setStep} />
    case 'signup':
      return <SignUp email={email} setEmail={setEmail} onDone={signedIn} onNeedsCode={() => setStep('verify')} go={setStep} />
    case 'verify':
      return <VerifyEmail email={email} onDone={signedIn} go={setStep} />
    case 'forgot':
      return <Forgot email={email} setEmail={setEmail} onSent={() => setStep('reset')} go={setStep} />
    case 'reset':
      return <Reset email={email} onDone={signedIn} go={setStep} />
    case 'shop':
      return user ? <ShopStep user={user} onLinked={onLinked} onSignOut={() => setStep('signin')} /> : null
  }
}

/* ---------------------------------------------------------------- fields */

function EmailField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  return (
    <label className="field">
      <span className="field__label">{t('auth.email')}</span>
      <input type="email" required autoComplete="email" inputMode="email" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function PasswordField({ value, onChange, isNew, label }: { value: string; onChange: (v: string) => void; isNew?: boolean; label?: string }) {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  return (
    <label className="field">
      <span className="field__label">{label ?? t('auth.password')}</span>
      <span className="password">
        <input
          type={show ? 'text' : 'password'}
          required
          minLength={isNew ? MIN_PASSWORD : undefined}
          autoComplete={isNew ? 'new-password' : 'current-password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="password__toggle" onClick={() => setShow((s) => !s)} aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {isNew && <span className="muted small">{t('auth.passwordRule', { count: MIN_PASSWORD })}</span>}
    </label>
  )
}

function CodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  return (
    <label className="field">
      <span className="field__label">{t('auth.code')}</span>
      <input
        className="code-input"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6,10}"
        maxLength={10}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      />
    </label>
  )
}

function OfflineNote() {
  const { t } = useTranslation()
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
    }
  }, [])
  return online ? null : <p className="notice notice--warning">{t('auth.needsInternet')}</p>
}

/** Form wrapper: busy flag and error message shared by every step. */
function useSubmit() {
  const errorText = useErrorText()
  const [busy, setBusy] = useState(false)
  // The error itself is kept, not its text, so it follows a language switch.
  const [failure, setFailure] = useState<{ err: unknown } | null>(null)
  const run = (fn: () => Promise<void>) => async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      await fn()
    } catch (err) {
      if (!(err instanceof AccountError)) console.error(err)
      setFailure({ err })
    } finally {
      setBusy(false)
    }
  }
  return { busy, error: failure ? errorText(failure.err) : null, run }
}

/* ---------------------------------------------------------------- steps */

interface StepProps {
  go: (s: Step) => void
}

function SignIn({ email, setEmail, onDone, go }: StepProps & { email: string; setEmail: (v: string) => void; onDone: (u: User) => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const { busy, error, run } = useSubmit()
  return (
    <AuthFrame title={t('auth.signIn.title')} subtitle={t('auth.signIn.subtitle')}>
      <OfflineNote />
      <form className="auth__form" onSubmit={run(async () => onDone(await signIn(email, password)))}>
        <EmailField value={email} onChange={setEmail} />
        <PasswordField value={password} onChange={setPassword} />
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" block disabled={busy}>
          {busy ? t('auth.working') : t('auth.signIn.submit')}
        </Button>
      </form>
      <div className="auth__links">
        <button type="button" className="link" onClick={() => go('forgot')}>
          {t('auth.forgot.link')}
        </button>
        <span>
          {t('auth.signIn.noAccount')}{' '}
          <button type="button" className="link" onClick={() => go('signup')}>
            {t('auth.signUp.link')}
          </button>
        </span>
      </div>
    </AuthFrame>
  )
}

function SignUp({
  email,
  setEmail,
  onDone,
  onNeedsCode,
  go,
}: StepProps & { email: string; setEmail: (v: string) => void; onDone: (u: User) => void; onNeedsCode: () => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const { busy, error, run } = useSubmit()
  const submit = run(async () => {
    if (password.length < MIN_PASSWORD) throw new AccountError('weak_password')
    const user = await signUp(email, password)
    if (user) onDone(user)
    else onNeedsCode()
  })
  return (
    <AuthFrame title={t('auth.signUp.title')} subtitle={t('auth.signUp.subtitle')}>
      <OfflineNote />
      <form className="auth__form" onSubmit={submit}>
        <EmailField value={email} onChange={setEmail} />
        <PasswordField value={password} onChange={setPassword} isNew />
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" block disabled={busy}>
          {busy ? t('auth.working') : t('auth.signUp.submit')}
        </Button>
      </form>
      <div className="auth__links">
        <span>
          {t('auth.signUp.haveAccount')}{' '}
          <button type="button" className="link" onClick={() => go('signin')}>
            {t('auth.signIn.link')}
          </button>
        </span>
      </div>
    </AuthFrame>
  )
}

function VerifyEmail({ email, onDone, go }: StepProps & { email: string; onDone: (u: User) => void }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [resent, setResent] = useState(false)
  const { busy, error, run } = useSubmit()
  return (
    <AuthFrame title={t('auth.verify.title')} subtitle={t('auth.verify.subtitle', { email })}>
      <form className="auth__form" onSubmit={run(async () => onDone(await verifySignUpCode(email, code)))}>
        <CodeField value={code} onChange={setCode} />
        <FormError message={error} />
        {resent && <p className="notice notice--info">{t('auth.verify.resent')}</p>}
        <Button type="submit" variant="primary" size="lg" block disabled={busy || code.length < 6}>
          {busy ? t('auth.working') : t('auth.verify.submit')}
        </Button>
      </form>
      <p className="muted small">{t('auth.verify.linkHint')}</p>
      <div className="auth__links">
        <button
          type="button"
          className="link"
          disabled={busy}
          onClick={run(async () => {
            await resendSignUpCode(email)
            setResent(true)
          })}
        >
          {t('auth.verify.resend')}
        </button>
        <button type="button" className="link" onClick={() => go('signin')}>
          {t('auth.signIn.link')}
        </button>
      </div>
    </AuthFrame>
  )
}

function Forgot({ email, setEmail, onSent, go }: StepProps & { email: string; setEmail: (v: string) => void; onSent: () => void }) {
  const { t } = useTranslation()
  const { busy, error, run } = useSubmit()
  return (
    <AuthFrame title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      <OfflineNote />
      <form
        className="auth__form"
        onSubmit={run(async () => {
          await sendPasswordReset(email)
          onSent()
        })}
      >
        <EmailField value={email} onChange={setEmail} />
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" block disabled={busy}>
          {busy ? t('auth.working') : t('auth.forgot.submit')}
        </Button>
      </form>
      <div className="auth__links">
        <button type="button" className="link" onClick={() => go('signin')}>
          {t('auth.back')}
        </button>
      </div>
    </AuthFrame>
  )
}

function Reset({ email, onDone, go }: StepProps & { email: string; onDone: (u: User) => void }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useSubmit()
  const submit = run(async () => {
    if (password.length < MIN_PASSWORD) throw new AccountError('weak_password')
    onDone(await resetPassword(email, code, password))
  })
  return (
    <AuthFrame title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle', { email })}>
      <form className="auth__form" onSubmit={submit}>
        <CodeField value={code} onChange={setCode} />
        <PasswordField value={password} onChange={setPassword} isNew label={t('auth.reset.newPassword')} />
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" block disabled={busy || code.length < 6}>
          {busy ? t('auth.working') : t('auth.reset.submit')}
        </Button>
      </form>
      <div className="auth__links">
        <button type="button" className="link" onClick={() => go('forgot')}>
          {t('auth.verify.resend')}
        </button>
        <button type="button" className="link" onClick={() => go('signin')}>
          {t('auth.back')}
        </button>
      </div>
    </AuthFrame>
  )
}

/* ---------------------------------------------------------------- shop */

function ShopStep({ user, onLinked, onSignOut }: { user: User; onLinked: () => void; onSignOut: () => void }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [shops, setShops] = useState<MyShop[] | null>(null)
  const [loadFailure, setLoadFailure] = useState<{ err: unknown } | null>(null)
  const loadError = loadFailure ? errorText(loadFailure.err) : null
  const [chosen, setChosen] = useState<string | 'new'>('new')
  const [form, setForm] = useState({ name: '', address: '', phone: '' })
  const { busy, error, run } = useSubmit()

  const load = () => {
    setLoadFailure(null)
    myShops()
      .then((list) => {
        setShops(list)
        const usable = list.find((s) => s.role !== 'cashier')
        setChosen(usable ? usable.id : 'new')
      })
      .catch((err) => setLoadFailure({ err }))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  const submit = run(async () => {
    const shop = chosen === 'new' ? await createShop(form.name, form.address, form.phone) : shops!.find((s) => s.id === chosen)!
    await linkDevice(shop, user)
    onLinked()
  })

  const switchAccount = async () => {
    await signOut()
    onSignOut()
  }

  if (loadError)
    return (
      <AuthFrame title={t('auth.shop.title')}>
        <FormError message={loadError} />
        <Button variant="primary" size="lg" block onClick={load}>
          {t('auth.retry')}
        </Button>
      </AuthFrame>
    )
  if (!shops)
    return (
      <AuthFrame title={t('auth.shop.title')}>
        <p className="muted">{t('auth.working')}</p>
      </AuthFrame>
    )

  const field = (k: keyof typeof form, required = false) => (
    <label className="field">
      <span className="field__label">{t(`settings.shop_${k}`)}</span>
      <input required={required} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} autoComplete="off" />
    </label>
  )

  return (
    <AuthFrame title={shops.length ? t('auth.shop.pickTitle') : t('auth.shop.createTitle')} subtitle={t('auth.shop.subtitle', { email: user.email })}>
      <form className="auth__form" onSubmit={submit}>
        {shops.length > 0 && (
          <div className="shop-choices" role="radiogroup" aria-label={t('auth.shop.pickTitle')}>
            {shops.map((s) => (
              <label key={s.id} className={`shop-choice ${chosen === s.id ? 'is-selected' : ''} ${s.role === 'cashier' ? 'is-disabled' : ''}`}>
                <input type="radio" name="shop" checked={chosen === s.id} disabled={s.role === 'cashier'} onChange={() => setChosen(s.id)} />
                <Store size={20} aria-hidden />
                <span>
                  <strong>{s.name}</strong>
                  <span className="muted small">{t(`auth.role.${s.role}`)}</span>
                </span>
              </label>
            ))}
            <label className={`shop-choice ${chosen === 'new' ? 'is-selected' : ''}`}>
              <input type="radio" name="shop" checked={chosen === 'new'} onChange={() => setChosen('new')} />
              <span>
                <strong>{t('auth.shop.createNew')}</strong>
              </span>
            </label>
          </div>
        )}
        {chosen === 'new' && (
          <>
            {field('name', true)}
            {field('address')}
            {field('phone')}
            <p className="muted small">{t('settings.shopHint')}</p>
          </>
        )}
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" block disabled={busy}>
          {busy ? t('auth.working') : chosen === 'new' ? t('auth.shop.create') : t('auth.shop.use')}
        </Button>
      </form>
      <div className="auth__links">
        <button type="button" className="link" onClick={switchAccount}>
          {t('auth.signOutOther')}
        </button>
      </div>
    </AuthFrame>
  )
}
