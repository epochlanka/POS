import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Ellipsis, Store } from 'lucide-react'
import { Dialog } from '../ui'
import { NAV, type ScreenId } from './nav'
import './shell.css'

/**
 * App frame. Dark side rail at 900px and wider; bottom bar with five items
 * plus a "More" sheet below that.
 */
export function AppShell({ screen, onNavigate, children }: { screen: ScreenId; onNavigate: (s: ScreenId) => void; children: ReactNode }) {
  const { t } = useTranslation()
  const [moreOpen, setMoreOpen] = useState(false)
  const inMore = !NAV.find((n) => n.id === screen)?.phoneBar

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
          {NAV.map(({ id, icon: Icon }) => (
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
      </nav>

      <div className="shell__main">{children}</div>

      <nav className="bottombar" aria-label={t('nav.main')}>
        {NAV.filter((n) => n.phoneBar).map(({ id, icon: Icon }) => (
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
          {NAV.filter((n) => !n.phoneBar).map(({ id, icon: Icon }) => (
            <li key={id}>
              <button type="button" className="more-list__item" aria-current={screen === id ? 'page' : undefined} onClick={() => go(id)}>
                <Icon size={20} aria-hidden />
                {t(`nav.${id}`)}
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  )
}
