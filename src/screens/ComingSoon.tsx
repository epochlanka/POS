import { useTranslation } from 'react-i18next'
import { Construction } from 'lucide-react'
import { EmptyState } from '../ui'
import type { ScreenId } from '../shell/nav'

/** Placeholder for modules that aren't built yet. Says what to do instead. */
export function ComingSoon({ screen, onOpenPos }: { screen: ScreenId; onOpenPos: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="page">
      <div className="page__head">
        <h1>{t(`nav.${screen}`)}</h1>
      </div>
      <div className="card">
        <EmptyState icon={<Construction size={40} />} title={t('soon.title')}>
          {t('soon.body')}{' '}
          <button type="button" className="link" onClick={onOpenPos}>
            {t('soon.openPos')}
          </button>
        </EmptyState>
      </div>
    </div>
  )
}
