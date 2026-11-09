import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronUp, PauseCircle } from 'lucide-react'
import { deviceContext } from '../db/database'
import { deleteHeldBill, holdBill, loadOpenBill, resumeBill, saveOpenBill } from '../db/heldBills'
import { formatLKR } from '../lib/money'
import { ConnectionPill } from '../shell/ConnectionPill'
import type { ConnectionState } from '../shell/useConnection'
import { Button, Chip, Dialog, EmptyState, Pill } from '../ui'
import { useToast } from '../ui/toast'
import { cartReducer, emptyCart, totals, type Discount } from './cart'
import { CartPanel } from './CartPanel'
import { localName, stockLevel, usePosCategories, usePosProducts, useHeldBillCount, type PosProduct } from './data'
import { DiscountDialog } from './DiscountDialog'
import { HeldBillsDialog, HoldDialog } from './HeldBills'
import { PaymentDialog } from './PaymentDialog'
import { QtyDialog } from './QtyDialog'
import { SearchBox } from './SearchBox'
import './pos.css'

type DialogId = 'pay' | 'discount' | 'hold' | 'held' | 'clear' | 'cart' | null

// Only refocus the search box on devices with a mouse/keyboard: on phones it
// would pop up the on-screen keyboard after every tap.
const finePointer = () => window.matchMedia('(pointer: fine)').matches

export function PosScreen({ connection }: { connection: ConnectionState }) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const products = usePosProducts()
  const categories = usePosCategories()
  const heldCount = useHeldBillCount()

  const [cart, dispatch] = useReducer(cartReducer, emptyCart)
  const [loaded, setLoaded] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>()
  const [qtyLineId, setQtyLineId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogId>(null)
  const [counter, setCounter] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const focusSearch = useCallback(() => {
    if (finePointer()) searchRef.current?.focus()
  }, [])

  // Restore the bill that was open before a restart or power cut.
  useEffect(() => {
    loadOpenBill().then((saved) => {
      if (saved?.lines.length) dispatch({ type: 'load', state: saved })
      setLoaded(true)
    })
    deviceContext().then((c) => setCounter(c.devicePrefix))
  }, [])
  useEffect(() => {
    if (loaded) saveOpenBill(cart)
  }, [cart, loaded])

  const add = useCallback(
    (p: PosProduct) => {
      dispatch({
        type: 'add',
        line: { variantId: p.variant_id, name: localName(p, i18n.language), unitPrice: p.sell_price, unitCost: p.cost_price, stock: p.stock },
      })
      setSelectedId(p.variant_id)
      if (p.stock <= 0) toast(t('pos.soldOutWarning', { name: localName(p, i18n.language) }))
      focusSearch()
    },
    [i18n.language, toast, t, focusSearch],
  )

  const closeDialog = () => {
    setDialog(null)
    setTimeout(focusSearch, 0)
  }

  const { total, itemCount } = totals(cart)
  const hasLines = cart.lines.length > 0

  const doHold = async (note: string) => {
    const label = await holdBill(cart, note)
    dispatch({ type: 'clear' })
    setSelectedId(undefined)
    closeDialog()
    toast(t('pos.hold.done', { label }))
  }

  const doResume = async (id: string) => {
    if (hasLines) {
      const label = await holdBill(cart, '')
      toast(t('pos.hold.done', { label }))
    }
    const resumed = await resumeBill(id)
    dispatch({ type: 'load', state: resumed })
    setSelectedId(resumed.lastAddedId)
    closeDialog()
  }

  const applyDiscount = (target: 'item' | 'bill', discount: Discount | undefined) => {
    if (target === 'item' && selectedId) dispatch({ type: 'lineDiscount', variantId: selectedId, discount })
    else dispatch({ type: 'billDiscount', discount })
  }

  // Keyboard: F2 search · F4 hold · F8 discount · F12 pay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return
      const actions: Record<string, () => void> = {
        F2: () => searchRef.current?.focus(),
        F4: () => hasLines && setDialog('hold'),
        F8: () => hasLines && setDialog('discount'),
        F12: () => hasLines && setDialog('pay'),
      }
      const action = actions[e.key]
      if (action) {
        e.preventDefault()
        action()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasLines])

  const shown = category ? products.filter((p) => p.category_id === category) : products
  const qtyLine = cart.lines.find((l) => l.variantId === qtyLineId) ?? null

  const cartPanel = (
    <CartPanel
      cart={cart}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onStep={(id, delta) => {
        const line = cart.lines.find((l) => l.variantId === id)
        if (line) dispatch({ type: 'setQty', variantId: id, qty: line.qty + delta })
      }}
      onQtyTap={setQtyLineId}
      onHold={() => setDialog('hold')}
      onDiscount={() => setDialog('discount')}
      onClear={() => setDialog('clear')}
      onPay={() => setDialog('pay')}
    />
  )

  return (
    <div className="pos-screen">
      <header className="pos-top">
        <SearchBox ref={searchRef} products={products} onPick={add} onNotFound={(q) => toast(t('pos.notFound', { code: q }), 'error')} />
        <Button onClick={() => setDialog('held')} className="pos-top__held" aria-label={t('pos.held.button')}>
          <PauseCircle size={18} aria-hidden />
          <span className="hide-sm">{t('pos.held.button')}</span>
          {heldCount > 0 && <Pill tone="warning">{heldCount}</Pill>}
        </Button>
        {/* Returns & exchanges come next (POS screens 14–15). */}
        <div className="pos-top__right">
          <ConnectionPill state={connection} />
          {counter && <span className="muted small hide-sm">{t('pos.counter', { prefix: counter })}</span>}
        </div>
      </header>

      {connection.kind === 'offline' && (
        <div className="offline-strip" role="status">
          <span>{t('pos.offlineStrip')}</span>
          <strong>{t('pos.pendingN', { count: connection.pendingBills })}</strong>
        </div>
      )}

      <section className="catalog" aria-label={t('pos.products')}>
        <div className="chips" role="group" aria-label={t('pos.categories')}>
          <Chip selected={category === null} onClick={() => setCategory(null)}>
            {t('pos.all')}
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} selected={category === c.id} onClick={() => setCategory(c.id)}>
              {localName(c, i18n.language)}
            </Chip>
          ))}
        </div>

        {shown.length === 0 ? (
          <EmptyState title={t('pos.noProducts')}>{t('pos.noProductsHint')}</EmptyState>
        ) : (
          <div className="tiles">
            {shown.map((p) => (
              <ProductTile key={p.variant_id} product={p} lang={i18n.language} onAdd={() => add(p)} />
            ))}
          </div>
        )}
      </section>

      <div className="cart-slot">{cartPanel}</div>

      {/* Phones: sticky bar that opens the bill as a sheet. */}
      <button type="button" className="cart-bar" onClick={() => setDialog('cart')} disabled={!hasLines}>
        <span>{hasLines ? t('pos.itemsN', { count: itemCount }) : t('pos.empty')}</span>
        <strong className="money">LKR {formatLKR(total)}</strong>
        <ChevronUp size={20} aria-hidden />
      </button>
      <Dialog open={dialog === 'cart'} onClose={closeDialog} wide>
        <div className="cart-sheet">{cartPanel}</div>
      </Dialog>

      <QtyDialog
        line={qtyLine}
        onClose={() => {
          setQtyLineId(null)
          setTimeout(focusSearch, 0)
        }}
        onSet={(qty) => qtyLine && dispatch({ type: 'setQty', variantId: qtyLine.variantId, qty })}
      />
      <DiscountDialog open={dialog === 'discount'} cart={cart} selectedId={selectedId} onClose={closeDialog} onApply={applyDiscount} />
      <HoldDialog open={dialog === 'hold'} onClose={closeDialog} onHold={doHold} />
      <HeldBillsDialog
        open={dialog === 'held'}
        hasOpenBill={hasLines}
        onClose={closeDialog}
        onResume={doResume}
        onDelete={(id) => deleteHeldBill(id).then(() => toast(t('pos.held.deleted')))}
      />
      <PaymentDialog
        open={dialog === 'pay'}
        cart={cart}
        offline={connection.kind === 'offline'}
        onClose={closeDialog}
        onCompleted={() => {
          dispatch({ type: 'clear' })
          setSelectedId(undefined)
        }}
      />
      <Dialog
        open={dialog === 'clear'}
        onClose={closeDialog}
        title={t('pos.clearConfirm.title')}
        labelledBy="clear-title"
        footer={
          <>
            <Button onClick={closeDialog}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => {
                dispatch({ type: 'clear' })
                setSelectedId(undefined)
                closeDialog()
              }}
            >
              {t('pos.clearConfirm.confirm')}
            </Button>
          </>
        }
      >
        <p>{t('pos.clearConfirm.body', { count: cart.lines.length, total: formatLKR(total) })}</p>
      </Dialog>
    </div>
  )
}

function ProductTile({ product: p, lang, onAdd }: { product: PosProduct; lang: string; onAdd: () => void }) {
  const { t } = useTranslation()
  const level = stockLevel(p)
  return (
    <button type="button" className={`tile ${level === 'out' ? 'tile--out' : ''}`} onClick={onAdd}>
      <span className="tile__name">{localName(p, lang)}</span>
      <span className="tile__foot">
        <span className="tile__price money">{formatLKR(p.sell_price)}</span>
        {level === 'out' ? (
          <Pill tone="danger">{t('pos.out')}</Pill>
        ) : level === 'low' ? (
          <Pill tone="warning">{t('pos.left', { count: p.stock })}</Pill>
        ) : (
          <Pill tone="success">{t('pos.stockN', { count: p.stock })}</Pill>
        )}
      </span>
    </button>
  )
}
