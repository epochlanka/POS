import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { completeSale, cartTotals, type CartItem, type Payment } from '../db/sales'
import { useQuery } from '../db/useQuery'
import { formatLKR, lineTotal, toCents } from '../lib/money'

interface ProductHit {
  variant_id: string
  name: string
  name_si: string | null
  name_ta: string | null
  barcode: string | null
  sell_price: number
  cost_price: number
  low_stock_level: number | null
  stock: number
}

// Stock is the sum of all movements for the variant (see db/schema.ts).
const PRODUCTS_SQL = `
  SELECT v.id AS variant_id, p.name, p.name_si, p.name_ta, v.barcode, v.sell_price, v.cost_price, v.low_stock_level,
         COALESCE((SELECT SUM(m.qty) FROM stock_movements m WHERE m.variant_id = v.id), 0) AS stock
  FROM product_variants v JOIN products p ON p.id = v.product_id
  WHERE v.is_active = 1 AND p.is_active = 1
  ORDER BY p.name`

export function PosScreen() {
  const { t, i18n } = useTranslation()
  const products = useQuery<ProductHit>(PRODUCTS_SQL)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [cash, setCash] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const displayName = (p: ProductHit) =>
    (i18n.language === 'si' && p.name_si) || (i18n.language === 'ta' && p.name_ta) || p.name

  const hits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) => p.barcode === q || [p.name, p.name_si, p.name_ta].some((n) => n?.toLowerCase().includes(q)),
    )
  }, [products, search])

  const add = (p: ProductHit) => {
    setMessage(null)
    setCart((c) => {
      const existing = c.find((i) => i.variantId === p.variant_id)
      if (existing) return c.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i))
      return [...c, { variantId: p.variant_id, name: displayName(p), qty: 1, unitPrice: p.sell_price, unitCost: p.cost_price, discount: 0 }]
    })
  }

  const setQty = (variantId: string, qty: number) =>
    setCart((c) => (qty <= 0 ? c.filter((i) => i.variantId !== variantId) : c.map((i) => (i.variantId === variantId ? { ...i, qty } : i))))

  // Barcode scanners type the code and press Enter.
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const exact = products.find((p) => p.barcode === search.trim())
    const pick = exact ?? (hits.length === 1 ? hits[0] : undefined)
    if (pick) {
      add(pick)
      setSearch('')
    }
  }

  const { subtotal, total } = cartTotals(cart)
  const cashCents = cash ? toCents(Number(cash)) : 0

  const pay = async (method: Payment['method']) => {
    try {
      const amount = method === 'cash' ? cashCents || total : total
      const sale = await completeSale(cart, [{ method, amount }])
      setCart([])
      setCash('')
      setMessage({
        kind: 'ok',
        text: t('pos.done', { billNo: sale.billNo }) + (sale.change > 0 ? ` · ${t('pos.change')}: ${formatLKR(sale.change)}` : ''),
      })
      // TODO: print the receipt automatically when a default printer is set.
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message })
    }
    searchRef.current?.focus()
  }

  return (
    <div className="pos">
      <section className="pos-products">
        <input
          ref={searchRef}
          className="search"
          autoFocus
          placeholder={t('pos.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onSearchKey}
        />
        <div className="product-grid">
          {hits.map((p) => (
            <button key={p.variant_id} className="product" onClick={() => add(p)}>
              <span className="product-name">{displayName(p)}</span>
              <span className="product-price">{formatLKR(p.sell_price)}</span>
              <span className={p.stock <= (p.low_stock_level ?? 0) ? 'product-stock low' : 'product-stock'}>
                {t('pos.inStock', { qty: p.stock })}
              </span>
            </button>
          ))}
          {hits.length === 0 && <p className="muted">{t('pos.noResults')}</p>}
        </div>
      </section>

      <aside className="pos-bill">
        <h2>{t('pos.bill')}</h2>
        <ul className="bill-lines">
          {cart.length === 0 && <li className="muted">{t('pos.empty')}</li>}
          {cart.map((i) => (
            <li key={i.variantId}>
              <div className="line-name">{i.name}</div>
              <div className="line-controls">
                <button onClick={() => setQty(i.variantId, i.qty - 1)} aria-label="−">−</button>
                <span>{i.qty}</span>
                <button onClick={() => setQty(i.variantId, i.qty + 1)} aria-label="+">+</button>
                <span className="line-total">{formatLKR(lineTotal(i.unitPrice, i.qty, i.discount))}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="totals">
          <div><span>{t('pos.subtotal')}</span><span>{formatLKR(subtotal)}</span></div>
          <div className="grand"><span>{t('pos.total')}</span><span>{formatLKR(total)}</span></div>
          <label className="cash">
            <span>{t('pos.cashGiven')}</span>
            <input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value.replace(/[^\d.]/g, ''))} />
          </label>
          {cashCents > total && <div><span>{t('pos.change')}</span><span>{formatLKR(cashCents - total)}</span></div>}
        </div>

        {message && <p className={`message ${message.kind}`}>{message.text}</p>}

        <div className="pay-buttons">
          <button className="primary" disabled={!cart.length} onClick={() => pay('cash')}>{t('pos.payCash')}</button>
          <button disabled={!cart.length} onClick={() => pay('card')}>{t('pos.payCard')}</button>
          <button disabled={!cart.length} onClick={() => pay('lankaqr')}>{t('pos.payQr')}</button>
          <button className="ghost" disabled={!cart.length} onClick={() => setCart([])}>{t('pos.clear')}</button>
        </div>
      </aside>
    </div>
  )
}
