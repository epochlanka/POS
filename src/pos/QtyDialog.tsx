import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, NumPad } from '../ui'
import type { CartLine } from './cart'

/** Number pad for large or decimal (weighed) quantities. */
export function QtyDialog({ line, onClose, onSet }: { line: CartLine | null; onClose: () => void; onSet: (qty: number) => void }) {
  return (
    <Dialog open={!!line} onClose={onClose} title={line?.name} labelledBy="qty-title">
      {line && <QtyBody key={line.variantId} line={line} onClose={onClose} onSet={onSet} />}
    </Dialog>
  )
}

function QtyBody({ line, onClose, onSet }: { line: CartLine; onClose: () => void; onSet: (qty: number) => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const qty = Number(value)
  const valid = value !== '' && Number.isFinite(qty) && qty >= 0
  return (
    <>
      <div className="qty-meta">
        <span className="muted">{t('pos.qty.current', { qty: line.qty })}</span>
        <span className="muted">{t('pos.stockN', { count: line.stock })}</span>
      </div>
      <div className="numpad-display" aria-live="polite">{value || <span className="muted">{line.qty}</span>}</div>
      <NumPad value={value} onChange={setValue} />
      <Button
        variant="primary"
        size="lg"
        block
        disabled={!valid}
        onClick={() => {
          onSet(qty)
          onClose()
        }}
      >
        {qty === 0 && valid ? t('pos.qty.remove') : t('pos.qty.set')}
      </Button>
    </>
  )
}
