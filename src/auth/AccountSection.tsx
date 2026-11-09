import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog } from '../ui'
import { linkedAccount, unlinkDevice, unsyncedChanges, type LinkedAccount } from './account'

/** Settings → Account: who this device is signed in as, and signing out. */
export function AccountSection() {
  const { t } = useTranslation()
  const [account, setAccount] = useState<LinkedAccount | null>(null)
  const [confirm, setConfirm] = useState<{ pending: number } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    linkedAccount().then(setAccount)
  }, [])
  if (!account) return null

  const askSignOut = async () => setConfirm({ pending: await unsyncedChanges() })
  const signOut = async () => {
    setBusy(true)
    await unlinkDevice()
    window.location.reload()
  }

  return (
    <section className="card settings-section">
      <h2>{t('auth.account.title')}</h2>
      <dl className="account-facts">
        <div>
          <dt>{t('auth.email')}</dt>
          <dd>{account.email}</dd>
        </div>
        <div>
          <dt>{t('auth.account.shop')}</dt>
          <dd>
            {account.shopName} · {t(`auth.role.${account.role}`)}
          </dd>
        </div>
        <div>
          <dt>{t('auth.account.counter')}</dt>
          <dd>{account.devicePrefix}</dd>
        </div>
      </dl>
      <div>
        <Button variant="danger" onClick={askSignOut}>
          {t('auth.account.signOut')}
        </Button>
      </div>

      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={t('auth.account.signOutTitle')}
        labelledBy="signout-title"
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={signOut} disabled={busy}>
              {t('auth.account.signOutConfirm')}
            </Button>
          </>
        }
      >
        <p>{t('auth.account.signOutBody')}</p>
        {confirm && confirm.pending > 0 && <p className="notice notice--danger">{t('auth.account.unsynced', { count: confirm.pending })}</p>}
      </Dialog>
    </section>
  )
}
