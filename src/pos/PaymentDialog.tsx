import { useEffect, useEffectEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banknote, CircleCheck, CreditCard, Printer, QrCode } from 'lucide-react'
import { completeSale, type Payment } from '../db/sales'
import { formatLKR, toCents, type Cents } from '../lib/money'
import { Button, Dialog, NumPad, Pill } from '../ui'
import { useToast } from '../ui/toast'
import { quickCashAmounts, toSaleItems, totals, type CartState } from './cart'
import { buildReceipt, printToReceiptPrinter, receiptPrinter } from './printReceipt'

type Method = Extract<Payment['method'], 'cash' | 'card' | 'lankaqr'>

interface Done {
  billNo: string
  total: Cents
  received: Cents
  change: Cents
  method: Method
  drawerOpened: boolean
  print: () => Promise<void>
}

const METHODS: { id: Method; icon: typeof Banknote }[] = [
  { id: 'cash', icon: Banknote },
  { id: 'card', icon: CreditCard },
  { id: 'lankaqr', icon: QrCode },
]

/**
 * Payment → confirmation. The sale is saved (and the cart cleared through
 * onCompleted) the moment the cashier presses Complete; the confirmation
 * screen only shows the change and offers a receipt.
 */
export function PaymentDialog({
  open,
  cart,
  offline,
  onClose,
  onCompleted,
}: {
  open: boolean
  cart: CartState
  offline: boolean
  onClose: () => void
  onCompleted: () => void
}) {
  const { t } = useTranslation()
  const [done, setDone] = useState<Done | null>(null)
  const close = () => {
    setDone(null)
    onClose()
  }
  return (
    <Dialog open={open} onClose={close} wide={!done} title={done ? undefined : t('pos.pay.title')} labelledBy="pay-title">
      {open && !done && (
        <PayBody
          cart={cart}
          offline={offline}
          onDone={(d) => {
            setDone(d)
            onCompleted()
          }}
        />
      )}
      {open && done && <DoneBody done={done} onNewSale={close} />}
    </Dialog>
  )
}

function PayBody({ cart, offline, onDone }: { cart: CartState; offline: boolean; onDone: (d: Done) => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { total, billDiscount } = totals(cart)
  const [method, setMethod] = useState<Method>('cash')
  const [cashRaw, setCashRaw] = useState('')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)

  const received = method === 'cash' ? (cashRaw ? toCents(Number(cashRaw)) : total) : total
  const balance = received - total
  const canComplete = !busy && total >= 0 && cart.lines.length > 0 && received >= total

  const complete = async () => {
    if (!canComplete) return
    setBusy(true)
    try {
      const items = toSaleItems(cart)
      const sale = await completeSale(items, [{ method, amount: received, reference: reference.trim() || undefined }], billDiscount)
      const printer = await receiptPrinter()
      const payments = [{ method: t(`pos.method.${method}`), amount: received }]
      const receipt = () => buildReceipt({ ...sale, items, payments })

      let drawerOpened = false
      if (printer && method === 'cash') {
        try {
          await printToReceiptPrinter({ openDrawer: true })
          drawerOpened = true
        } catch (e) {
          toast(t('pos.pay.drawerFailed', { error: (e as Error).message }), 'error')
        }
      }
      onDone({
        billNo: sale.billNo,
        total: sale.total,
        received,
        change: sale.change,
        method,
        drawerOpened,
        print: async () => printToReceiptPrinter({ receipt: await receipt() }),
      })
    } catch (e) {
      toast((e as Error).message, 'error')
      setBusy(false)
    }
  }

  return (
    <div className="pay">
      <section className="pay__left">
        <span className="field__label">{t('pos.pay.amountDue')}</span>
        <div className="pay__due money">{formatLKR(total)}</div>
        <div className="pay__methods">
          {METHODS.map(({ id, icon: Icon }) => (
            <Button key={id} size="lg" block variant={method === id ? 'primary' : 'secondary'} onClick={() => setMethod(id)} aria-pressed={method === id}>
              <Icon size={20} aria-hidden />
              {t(`pos.method.${id}`)}
            </Button>
          ))}
        </div>
        {/* Credit and split payment need customer accounts (Phase 07). */}
      </section>

      <section className="pay__right">
        {method === 'cash' ? (
          <>
            <span className="field__label">{t('pos.pay.cashReceived')}</span>
            <div className="numpad-display">{cashRaw ? formatLKR(toCents(Number(cashRaw))) : <span className="muted">{formatLKR(total)}</span>}</div>
            <div className="pay__quick">
              {quickCashAmounts(total).map((amount, i) => (
                <Button key={amount} selected={received === amount && (i > 0 || !cashRaw)} onClick={() => setCashRaw(i === 0 ? '' : String(amount / 100))}>
                  {i === 0 ? t('pos.pay.exact') : formatLKR(amount).replace(/\.00$/, '')}
                </Button>
              ))}
            </div>
            <NumPad value={cashRaw} onChange={setCashRaw} />
          </>
        ) : (
          <>
            {method === 'lankaqr' && offline && <p className="notice notice--warning">{t('pos.pay.qrOffline')}</p>}
            <p className="muted">{t(method === 'card' ? 'pos.pay.cardHint' : 'pos.pay.qrHint')}</p>
            <label className="field">
              <span className="field__label">{t('pos.pay.reference')}</span>
              <input value={reference} maxLength={40} onChange={(e) => setReference(e.target.value)} placeholder={t('pos.pay.referencePlaceholder')} />
            </label>
          </>
        )}

        <div className="pay__balance">
          <span>{balance < 0 ? t('pos.pay.short') : t('pos.pay.balance')}</span>
          <strong className={`money ${balance < 0 ? 'is-short' : ''}`}>{formatLKR(Math.abs(balance))}</strong>
        </div>
        <Button variant="primary" size="lg" block disabled={!canComplete} onClick={complete}>
          {t('pos.pay.complete')} <kbd>Enter</kbd>
        </Button>
        <EnterToComplete onEnter={complete} />
      </section>
    </div>
  )
}

/** Enter completes the payment from anywhere in the dialog. */
function EnterToComplete({ onEnter }: { onEnter: () => void }) {
  const enter = useEffectEvent(onEnter)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        enter()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return null
}

function DoneBody({ done, onNewSale }: { done: Done; onNewSale: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [printing, setPrinting] = useState(false)
  const [hasPrinter, setHasPrinter] = useState(false)
  const [autoClose, setAutoClose] = useState(done.change === 0)
  const newSale = useEffectEvent(onNewSale)

  useEffect(() => {
    receiptPrinter().then((p) => setHasPrinter(!!p))
  }, [])

  // With no change to hand back, return to an empty bill after 3 seconds.
  useEffect(() => {
    if (!autoClose) return
    const timer = setTimeout(() => newSale(), 3000)
    return () => clearTimeout(timer)
  }, [autoClose])

  const print = async () => {
    setAutoClose(false)
    setPrinting(true)
    try {
      await done.print()
      toast(t('pos.done.printed'))
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="done" onPointerDown={() => setAutoClose(false)}>
      {done.change > 0 ? (
        <>
          <span className="field__label">{t('pos.done.giveChange')}</span>
          <div className="done__change money">LKR {formatLKR(done.change)}</div>
          <dl className="done__rows">
            <dt>{t('pos.total')}</dt>
            <dd className="money">{formatLKR(done.total)}</dd>
            <dt>{t('pos.pay.cashReceived')}</dt>
            <dd className="money">{formatLKR(done.received)}</dd>
          </dl>
        </>
      ) : (
        <>
          <CircleCheck size={64} className="done__icon" aria-hidden />
          <h2>{t('pos.done.title')}</h2>
        </>
      )}
      <p className="muted">{t('pos.done.meta', { billNo: done.billNo, total: formatLKR(done.total), method: t(`pos.method.${done.method}`) })}</p>
      {done.drawerOpened && <Pill tone="success">{t('pos.done.drawerOpened')}</Pill>}
      <div className="done__actions">
        {hasPrinter && (
          <Button size="lg" onClick={print} disabled={printing}>
            <Printer size={18} aria-hidden /> {t('pos.done.print')}
          </Button>
        )}
        <Button variant="primary" size="lg" onClick={onNewSale} autoFocus>
          {t('pos.done.newSale')}
        </Button>
      </div>
      {!hasPrinter && <p className="muted small">{t('pos.done.noPrinter')}</p>}
    </div>
  )
}
