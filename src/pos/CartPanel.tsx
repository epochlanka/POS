import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import { formatLKR } from '../lib/money'
import { Button, EmptyState } from '../ui'
import { lineGross, lineNet, totals, type CartState } from './cart'

export function CartPanel({
  cart,
  selectedId,
  onSelect,
  onStep,
  onQtyTap,
  onHold,
  onDiscount,
  onClear,
  onPay,
}: {
  cart: CartState
  selectedId?: string
  onSelect: (variantId: string) => void
  onStep: (variantId: string, delta: number) => void
  onQtyTap: (variantId: string) => void
  onHold: () => void
  onDiscount: () => void
  onClear: () => void
  onPay: () => void
}) {
  const { t } = useTranslation()
  const { discountTotal, total, itemCount } = totals(cart)
  const empty = cart.lines.length === 0
  const listRef = useRef<HTMLUListElement>(null)

  // Keep the last-added line in view.
  useEffect(() => {
    listRef.current?.querySelector('[data-last="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cart.lastAddedId, cart.lines.length])

  return (
    <aside className="cart" aria-label={t('pos.currentBill')}>
      <header className="cart__head">
        <div>
          <h2>{t('pos.currentBill')}</h2>
          <span className="muted small">{t('pos.walkIn')}</span>
        </div>
        {/* "+ Customer" arrives with customer accounts (Phase 07). */}
      </header>

      {empty ? (
        <EmptyState icon={<ShoppingCart size={40} />} title={t('pos.empty')}>
          {t('pos.emptyHint')}
        </EmptyState>
      ) : (
        <ul className="cart__lines" ref={listRef}>
          {cart.lines.map((l) => {
            const gross = lineGross(l)
            const net = lineNet(l)
            return (
              <li
                key={l.variantId}
                className="cart-line"
                data-last={l.variantId === cart.lastAddedId}
                aria-selected={l.variantId === selectedId}
                onClick={() => onSelect(l.variantId)}
              >
                <div className="cart-line__info">
                  <span className="cart-line__name">{l.name}</span>
                  <span className="muted small money">
                    {l.qty} × {formatLKR(l.unitPrice)}
                    {net !== gross && (
                      <span className="cart-line__disc">
                        {' · −'}
                        {l.discount?.kind === 'pct' ? `${l.discount.value}%` : formatLKR(gross - net)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="cart-line__qty" onClick={(e) => e.stopPropagation()}>
                  <Button icon aria-label={t('pos.less', { name: l.name })} onClick={() => onStep(l.variantId, -1)}>
                    <Minus size={18} />
                  </Button>
                  <button type="button" className="cart-line__qtyval money" onClick={() => onQtyTap(l.variantId)} aria-label={t('pos.qty.edit', { name: l.name })}>
                    {l.qty}
                  </button>
                  <Button icon aria-label={t('pos.more', { name: l.name })} onClick={() => onStep(l.variantId, 1)}>
                    <Plus size={18} />
                  </Button>
                </div>
                <span className="cart-line__total money">{formatLKR(net)}</span>
              </li>
            )
          })}
        </ul>
      )}

      <footer className="cart__foot">
        <dl className="cart__totals">
          <dt>{t('pos.items')}</dt>
          <dd className="money">{itemCount}</dd>
          <dt>{t('pos.subtotal')}</dt>
          {/* Before any discounts, so Subtotal − Discount = Total on screen. */}
          <dd className="money">{formatLKR(total + discountTotal)}</dd>
          <dt>{t('pos.discountLabel')}</dt>
          <dd className="money">{discountTotal ? `−${formatLKR(discountTotal)}` : formatLKR(0)}</dd>
          <dt className="cart__total-label">{t('pos.total')}</dt>
          <dd className="cart__total money">LKR {formatLKR(total)}</dd>
        </dl>
        <div className="cart__actions">
          <Button disabled={empty} onClick={onHold}>
            {t('pos.hold.button')} <kbd>F4</kbd>
          </Button>
          <Button disabled={empty} onClick={onDiscount}>
            {t('pos.discount.button')} <kbd>F8</kbd>
          </Button>
          <Button disabled={empty} onClick={onClear}>
            {t('pos.clear')}
          </Button>
        </div>
        <Button variant="primary" size="lg" block disabled={empty} onClick={onPay} className="cart__pay">
          {t('pos.payTotal', { total: formatLKR(total) })} <kbd>F12</kbd>
        </Button>
      </footer>
    </aside>
  )
}
