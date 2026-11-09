import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Ellipsis, Lock, Store } from 'lucide-react'
import { canManage, useSession } from '../auth/session'
import { Dialog } from '../ui'
import { navFor, type ScreenId } from './nav'
import './shell.css'

/**
 * App frame. Dark side rail at 900px and wider; bottom bar with five items
 * plus a "More" sheet below that.
 */
export function AppShell({ screen, onNavigate, children }: { screen: ScreenId; onNavigate: (s: ScreenId) => void; children: ReactNode }) {
  const { t } = useTranslation()
  const session = useSession()
  const { staff, lock } = session
  const [moreOpen, setMoreOpen] = useState(false)
  const nav = navFor(canManage(session))
  const inMore = !nav.find((n) => n.id === screen)?.phoneBar

  const go = (id: ScreenId) => {
    setMoreOpen(false)
    onNavigate(id)
  }

  return (
    <div className="shell">
      <nav className="rail" aria-label={t('nav.main')}>
        <div className="rail__brand">
          <span className="rail__logo" aria-hidden>
            <Store size={18} />
          </span>
          <span className="rail__name">Lanka POS</span>
        </div>
        <ul>
          {nav.map(({ id, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                className="rail__item"
                aria-current={screen === id ? 'page' : undefined}
                onClick={() => go(id)}
                title={t(`nav.${id}`)}
              >
                <Icon size={20} aria-hidden />
                <span>{t(`nav.${id}`)}</span>
              </button>
            </li>
          ))}
        </ul>
        {staff && (
          <div className="rail__user">
            <span className="rail__avatar" aria-hidden>
              {staff.name.charAt(0).toUpperCase()}
            </span>
            <span className="rail__who">
              <strong>{staff.name}</strong>
              <span>{t(`auth.role.${staff.role}`)}</span>
            </span>
            <button type="button" className="rail__item rail__lock" onClick={lock} title={t('auth.lock.action')}>
              <Lock size={20} aria-hidden />
              <span>{t('auth.lock.action')}</span>
            </button>
          </div>
        )}
      </nav>

      <div className="shell__main">{children}</div>

      <nav className="bottombar" aria-label={t('nav.main')}>
        {nav.filter((n) => n.phoneBar).map(({ id, icon: Icon }) => (
          <button key={id} type="button" className="bottombar__item" aria-current={screen === id ? 'page' : undefined} onClick={() => go(id)}>
            <Icon size={22} aria-hidden />
            <span>{t(`nav.${id}Short`, { defaultValue: t(`nav.${id}`) })}</span>
          </button>
        ))}
        <button type="button" className="bottombar__item" aria-current={inMore ? 'page' : undefined} onClick={() => setMoreOpen(true)}>
          <Ellipsis size={22} aria-hidden />
          <span>{t('nav.more')}</span>
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title={t('nav.more')} labelledBy="more-title">
        <ul className="more-list">
          {nav.filter((n) => !n.phoneBar).map(({ id, icon: Icon }) => (
            <li key={id}>
              <button type="button" className="more-list__item" aria-current={screen === id ? 'page' : undefined} onClick={() => go(id)}>
                <Icon size={20} aria-hidden />
                {t(`nav.${id}`)}
              </button>
            </li>
          ))}
          {staff && (
            <li className="more-list__user">
              <button
                type="button"
                className="more-list__item"
                onClick={() => {
                  setMoreOpen(false)
                  lock()
                }}
              >
                <Lock size={20} aria-hidden />
                {t('auth.lock.actionAs', { name: staff.name })}
              </button>
            </li>
          )}
        </ul>
      </Dialog>
    </div>
  )
}
