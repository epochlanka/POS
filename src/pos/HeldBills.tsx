import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import type { HeldBillRow } from '../db/heldBills'
import { useQuery } from '../db/useQuery'
import { formatLKR } from '../lib/money'
import { Button, Dialog, EmptyState } from '../ui'

/** Asks for an optional note ("Blue shirt man") before parking the bill. */
export function HoldDialog({ open, onClose, onHold }: { open: boolean; onClose: () => void; onHold: (note: string) => void }) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const submit = () => {
    onHold(note)
    setNote('')
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('pos.hold.title')}
      labelledBy="hold-title"
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={submit}>
            {t('pos.hold.confirm')}
          </Button>
        </>
      }
    >
      <label className="field">
        <span className="field__label">{t('pos.hold.note')}</span>
        <input
          autoFocus
          value={note}
          maxLength={60}
          placeholder={t('pos.hold.notePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </label>
    </Dialog>
  )
}

export function HeldBillsDialog({
  open,
  onClose,
  onResume,
  onDelete,
  hasOpenBill,
}: {
  open: boolean
  onClose: () => void
  onResume: (id: string) => void
  onDelete: (id: string) => void
  hasOpenBill: boolean
}) {
  const { t } = useTranslation()
  const bills = useQuery<HeldBillRow>('SELECT * FROM held_bills ORDER BY created_at')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  return (
    <Dialog open={open} onClose={onClose} title={t('pos.held.title', { count: bills.length })} labelledBy="held-title">
      {hasOpenBill && bills.length > 0 && <p className="notice notice--info">{t('pos.held.willHoldCurrent')}</p>}
      {bills.length === 0 ? (
        <EmptyState title={t('pos.held.none')}>{t('pos.held.noneHint')}</EmptyState>
      ) : (
        <ul className="held-list">
          {bills.map((b) => (
            <li key={b.id} className="held-bill card">
              <div className="held-bill__info">
                <strong>
                  {b.label}
                  {b.note && ` · “${b.note}”`}
                </strong>
                <span className="muted small">
                  {t('pos.held.meta', {
                    count: b.item_count,
                    time: new Date(b.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                  })}
                </span>
              </div>
              <span className="money held-bill__total">{formatLKR(b.total)}</span>
              <div className="held-bill__actions">
                {confirmDelete === b.id ? (
                  <>
                    <Button onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        onDelete(b.id)
                        setConfirmDelete(null)
                      }}
                    >
                      {t('pos.held.delete')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" icon aria-label={t('pos.held.delete')} onClick={() => setConfirmDelete(b.id)}>
                      <Trash2 size={18} />
                    </Button>
                    <Button variant="primary" onClick={() => onResume(b.id)}>
                      {t('pos.held.resume')}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
