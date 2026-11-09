import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSetting, setSetting } from '../db/database'
import { LANGUAGES } from '../i18n'
import { Button, Segmented } from '../ui'
import { useToast } from '../ui/toast'
import { PrinterTestScreen } from './PrinterTestScreen'

const SHOP_FIELDS = ['shop_name', 'shop_address', 'shop_phone'] as const

export function SettingsScreen() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [shop, setShop] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all(SHOP_FIELDS.map(async (k) => [k, (await getSetting(k)) ?? ''] as const)).then((pairs) => setShop(Object.fromEntries(pairs)))
  }, [])

  const saveShop = async () => {
    for (const k of SHOP_FIELDS) await setSetting(k, shop[k]?.trim() ?? '')
    toast(t('settings.saved'))
  }

  return (
    <div className="page">
      <div className="page__head">
        <h1>{t('nav.settings')}</h1>
      </div>

      <section className="card settings-section">
        <h2>{t('settings.language')}</h2>
        <Segmented value={i18n.language} onChange={(l) => i18n.changeLanguage(l)} options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
      </section>

      <section className="card settings-section">
        <h2>{t('settings.shop')}</h2>
        <p className="muted small">{t('settings.shopHint')}</p>
        {SHOP_FIELDS.map((k) => (
          <label key={k} className="field">
            <span className="field__label">{t(`settings.${k}`)}</span>
            <input value={shop[k] ?? ''} onChange={(e) => setShop((s) => ({ ...s, [k]: e.target.value }))} />
          </label>
        ))}
        <div>
          <Button variant="primary" onClick={saveShop}>
            {t('common.save')}
          </Button>
        </div>
      </section>

      <section className="card settings-section">
        <PrinterTestScreen />
      </section>
    </div>
  )
}
