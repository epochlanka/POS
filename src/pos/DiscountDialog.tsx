import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatLKR, toCents } from '../lib/money'
import { Button, Dialog, Segmented } from '../ui'
import { CASHIER_DISCOUNT_LIMIT_PCT, discountCents, discountPct, lineGross, totals, type CartState, type Discount } from './cart'

type Target = 'item' | 'bill'

/**
 * Item or whole-bill discount, as % or LKR. Above the cashier limit it needs
 * a manager PIN, which arrives with staff accounts (Phase 08); until then
 * larger discounts are blocked.
 */
export function DiscountDialog({
  open,
  cart,
  selectedId,
  onClose,
  onApply,
}: {
  open: boolean
  cart: CartState
  selectedId?: string
  onClose: () => void
  onApply: (target: Target, discount: Discount | undefined) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onClose={onClose} title={t('pos.discount.title')} labelledBy="discount-title">
      {open && <DiscountBody cart={cart} selectedId={selectedId} onClose={onClose} onApply={onApply} />}
    </Dialog>
  )
}

function DiscountBody({
  cart,
  selectedId,
  onClose,
  onApply,
}: {
  cart: CartState
  selectedId?: string
  onClose: () => void
  onApply: (target: Target, discount: Discount | undefined) => void
}) {
  const { t } = useTranslation()
  const line = cart.lines.find((l) => l.variantId === selectedId)
  const [target, setTarget] = useState<Target>(line ? 'item' : 'bill')
  const existing = target === 'item' ? line?.discount : cart.billDiscount
  const [kind, setKind] = useState<Discount['kind']>(existing?.kind ?? 'pct')
  const [raw, setRaw] = useState(existing ? String(existing.kind === 'pct' ? existing.value : existing.value / 100) : '')

  const base = target === 'item' && line ? lineGross(line) : totals({ ...cart, billDiscount: undefined }).subtotal
  const value = Number(raw)
  const discount: Discount | undefined =
    raw === '' || !Number.isFinite(value) || value <= 0 ? undefined : kind === 'pct' ? { kind, value } : { kind, value: toCents(value) }
  const pct = discountPct(base, discount)
  const overLimit = pct > CASHIER_DISCOUNT_LIMIT_PCT + 1e-9
  const after = base - discountCents(base, discount)

  const switchTarget = (next: Target) => {
    setTarget(next)
    const d = next === 'item' ? line?.discount : cart.billDiscount
    setKind(d?.kind ?? 'pct')
    setRaw(d ? String(d.kind === 'pct' ? d.value : d.value / 100) : '')
  }

  return (
    <>
      <Segmented<Target>
        value={target}
        onChange={switchTarget}
        options={[
          { value: 'item', label: line ? t('pos.discount.thisItem') : t('pos.discount.noItem') },
          { value: 'bill', label: t('pos.discount.wholeBill') },
        ]}
      />
      {target === 'item' && line && <p className="muted small">{line.name}</p>}
      {target === 'item' && !line ? (
        <p className="muted">{t('pos.discount.pickItem')}</p>
      ) : (
        <>
          <Segmented<Discount['kind']>
            value={kind}
            onChange={(k) => {
              setKind(k)
              setRaw('')
            }}
            options={[
              { value: 'pct', label: '%' },
              { value: 'amount', label: 'LKR' },
            ]}
          />
          <div className="discount-row">
            {kind === 'pct' &&
              [5, 10, 15].map((p) => (
                <Button key={p} selected={raw === String(p)} onClick={() => setRaw(String(p))}>
                  {p}%
                </Button>
              ))}
            <input
              inputMode="decimal"
              aria-label={t('pos.discount.custom')}
              placeholder={t('pos.discount.custom')}
              value={raw}
              onChange={(e) => setRaw(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </div>
          <div className="discount-summary">
            <span className="muted">
              {target === 'item' ? t('pos.discount.item') : t('pos.discount.bill')} <span className="money">LKR {formatLKR(base)}</span> →
            </span>
            <strong className="money">{formatLKR(after)}</strong>
          </div>
          {overLimit && <p className="notice notice--warning">{t('pos.discount.needsManager', { limit: CASHIER_DISCOUNT_LIMIT_PCT })}</p>}
        </>
      )}
      <div className="dialog-actions">
        {existing && (
          <Button
            variant="ghost"
            onClick={() => {
              onApply(target, undefined)
              onClose()
            }}
          >
            {t('pos.discount.remove')}
          </Button>
        )}
        <span className="spacer" />
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="primary"
          disabled={!discount || overLimit || (target === 'item' && !line)}
          onClick={() => {
            onApply(target, discount)
            onClose()
          }}
        >
          {t('common.apply')}
        </Button>
      </div>
    </>
  )
}
