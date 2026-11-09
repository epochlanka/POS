import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChartColumn, PackagePlus, PauseCircle, ShoppingCart, Store, Truck } from 'lucide-react'
import { getSetting } from '../db/database'
import { pctChange } from '../lib/dates'
import { formatLKR, formatRupees } from '../lib/money'
import { localName, stockLevel, useHeldBillCount, usePosProducts } from '../pos/data'
import { ConnectionPill } from '../shell/ConnectionPill'
import type { ScreenId } from '../shell/nav'
import type { ConnectionState } from '../shell/useConnection'
import { Button, EmptyState, Pill, Segmented, type Tone } from '../ui'
import { SalesChart } from './SalesChart'
import {
  useCategoryMargins,
  useHasAnySales,
  usePaymentSplit,
  useRecentSales,
  useSalesTrend,
  useStockSummary,
  useClock,
  useTodayTotals,
  type Clock,
  type TrendRange,
} from './queries'
import './dashboard.css'

const METHOD_TONE: Record<string, Tone> = { cash: 'neutral', card: 'neutral', lankaqr: 'info', credit: 'warning' }

/** A one-glance view of today: money in, profit, stock problems and what to do next. */
export function DashboardScreen({ connection, onNavigate }: { connection: ConnectionState; onNavigate: (s: ScreenId) => void }) {
  const { t, i18n } = useTranslation()
  const clock = useClock()
  const { today } = clock
  const [shopName, setShopName] = useState('')
  useEffect(() => {
    getSetting('shop_name').then((n) => setShopName(n || t('dash.myShop')))
  }, [t])

  const { current, lastWeek } = useTodayTotals(clock)
  const hasAnySales = useHasAnySales()
  const stock = useStockSummary()
  const heldCount = useHeldBillCount()

  const profit = current.revenue - current.cost
  const margin = current.revenue > 0 ? (profit / current.revenue) * 100 : null
  const delta = pctChange(current.revenue, lastWeek.revenue)
  const weekday = today.toLocaleDateString(dateLocale(i18n.language), { weekday: 'short' })

  return (
    <div className="page dash">
      <header className="dash__head">
        <div>
          <h1>{shopName}</h1>
          <p className="muted">{today.toLocaleDateString(dateLocale(i18n.language), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <ConnectionPill state={connection} />
      </header>

      {/* KPI row */}
      <section className="kpis" aria-label={t('dash.today')}>
        <Kpi label={t('dash.todaySales')} value={`LKR ${formatRupees(current.revenue)}`}>
          {delta !== null ? (
            <Pill tone={delta >= 0 ? 'success' : 'warning'}>{t('dash.vsLast', { pct: `${delta >= 0 ? '+' : '−'}${Math.abs(delta)}%`, day: weekday })}</Pill>
          ) : (
            <span className="muted small">{t('dash.noCompare', { day: weekday })}</span>
          )}
        </Kpi>
        <Kpi label={t('dash.transactions')} value={String(current.bills)}>
          <span className="muted small">
            {current.bills > 0 ? t('dash.avgBill', { amount: formatRupees(current.revenue / current.bills) }) : t('dash.noBillsYet')}
          </span>
        </Kpi>
        <Kpi label={t('dash.grossProfit')} value={`LKR ${formatRupees(profit)}`}>
          <span className="muted small">{margin !== null ? t('dash.margin', { pct: margin.toFixed(1) }) : t('dash.estimated')}</span>
        </Kpi>
        <Kpi label={t('dash.stock')} value={stock.products.toLocaleString('en-LK')} onClick={() => onNavigate('inventory')}>
          <span className="kpi__pills">
            {stock.low > 0 && <Pill tone="warning">{t('dash.lowN', { count: stock.low })}</Pill>}
            {stock.out > 0 && <Pill tone="danger">{t('dash.outN', { count: stock.out })}</Pill>}
            {stock.low === 0 && stock.out === 0 && <Pill tone="success">{t('dash.allStocked')}</Pill>}
          </span>
        </Kpi>
      </section>

      {hasAnySales ? (
        <>
          <div className="dash__row dash__row--wide">
            <TrendCard clock={clock} />
            <AttentionCard onNavigate={onNavigate} />
          </div>
          <div className="dash__row dash__row--wide">
            <RecentCard />
            <QuickActions heldCount={heldCount} onNavigate={onNavigate} />
          </div>
          <div className="dash__row dash__row--thirds">
            <PaymentsCard today={today} />
            <ProfitCard today={today} revenue={current.revenue} cost={current.cost} />
            <StockCard stock={stock} onNavigate={onNavigate} />
          </div>
        </>
      ) : (
        <div className="dash__row dash__row--wide">
          <section className="card dash-card">
            <EmptyState icon={<Store size={48} />} title={t('dash.empty.title')}>
              {t('dash.empty.body')}
            </EmptyState>
            <div className="dash-empty__actions">
              <Button variant="primary" size="lg" onClick={() => onNavigate('pos')}>
                {t('dash.empty.firstSale')}
              </Button>
              <Button size="lg" onClick={() => onNavigate('products')}>
                {t('dash.empty.import')}
              </Button>
            </div>
          </section>
          <AttentionCard onNavigate={onNavigate} />
        </div>
      )}
    </div>
  )
}

function dateLocale(lang: string) {
  return lang === 'si' ? 'si-LK' : lang === 'ta' ? 'ta-LK' : 'en-GB'
}

function Kpi({ label, value, children, onClick }: { label: string; value: string; children?: React.ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value figure">{value}</span>
      <span className="kpi__foot">{children}</span>
    </>
  )
  return onClick ? (
    <button type="button" className="card kpi kpi--link" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="card kpi">{body}</div>
  )
}

function TrendCard({ clock }: { clock: Clock }) {
  const { t, i18n } = useTranslation()
  const [range, setRange] = useState<TrendRange>('week')
  const trend = useSalesTrend(range, clock, i18n.language, t('dash.todayShort'))
  const delta = trend.previousTotal !== null ? pctChange(trend.total, trend.previousTotal) : null
  return (
    <section className="card dash-card">
      <header className="dash-card__head">
        <h2>{t('dash.salesTrend')}</h2>
        <Segmented<TrendRange>
          value={range}
          onChange={setRange}
          options={[
            { value: 'day', label: t('dash.range.day') },
            { value: 'week', label: t('dash.range.week') },
            { value: 'month', label: t('dash.range.month') },
          ]}
        />
      </header>
      <div className="trend__summary">
        <span className="figure trend__total">LKR {formatRupees(trend.total)}</span>
        <span className="muted small">{t(`dash.trendLabel.${range}`)}</span>
        {delta !== null && (
          <Pill tone={delta >= 0 ? 'success' : 'warning'}>
            {t(`dash.trendVs.${range}`, { pct: `${delta >= 0 ? '+' : '−'}${Math.abs(delta)}%` })}
          </Pill>
        )}
      </div>
      <SalesChart buckets={trend.buckets} label={t(`dash.chartLabel.${range}`)} />
    </section>
  )
}

function AttentionCard({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { t, i18n } = useTranslation()
  const products = usePosProducts()
  const items = products
    .map((p) => ({ p, level: stockLevel(p) }))
    .filter((x) => x.level !== 'ok')
    .sort((a, b) => (a.level === b.level ? a.p.stock - b.p.stock : a.level === 'out' ? -1 : 1))
  const shown = items.slice(0, 6)
  return (
    <section className="card dash-card">
      <header className="dash-card__head">
        <h2>{t('dash.attention')}</h2>
        {items.length > 0 && <Pill tone="neutral">{items.length}</Pill>}
      </header>
      {shown.length === 0 ? (
        <p className="muted">{t('dash.attentionNone')}</p>
      ) : (
        <ul className="attention">
          {shown.map(({ p, level }) => (
            <li key={p.variant_id}>
              <span>{localName(p, i18n.language)}</span>
              {level === 'out' ? <Pill tone="danger">{t('pos.out')}</Pill> : <Pill tone="warning">{t('pos.left', { count: p.stock })}</Pill>}
            </li>
          ))}
        </ul>
      )}
      {/* Expiring batches and overdue credit join this list with Inventory and Customers. */}
      {items.length > shown.length && (
        <button type="button" className="link dash-card__more" onClick={() => onNavigate('inventory')}>
          {t('dash.seeAllN', { count: items.length })}
        </button>
      )}
    </section>
  )
}

function RecentCard() {
  const { t } = useTranslation()
  const sales = useRecentSales(6)
  return (
    <section className="card dash-card dash-card--flush">
      <header className="dash-card__head">
        <h2>{t('dash.recent')}</h2>
      </header>
      <table className="recent">
        <thead>
          <tr>
            <th scope="col">{t('dash.bill')}</th>
            <th scope="col">{t('dash.time')}</th>
            <th scope="col">{t('dash.payment')}</th>
            <th scope="col" className="num">
              {t('dash.amount')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{s.bill_no}</strong>
                <span className="muted small recent__items"> · {t('pos.itemsN', { count: s.items })}</span>
              </td>
              <td className="muted">{new Date(s.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
              <td>
                {s.method && (
                  <Pill tone={METHOD_TONE[s.method] ?? 'neutral'}>{s.methods > 1 ? t('dash.split') : t(`pos.method.${s.method}`)}</Pill>
                )}
              </td>
              <td className="num money">{formatLKR(s.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function QuickActions({ heldCount, onNavigate }: { heldCount: number; onNavigate: (s: ScreenId) => void }) {
  const { t } = useTranslation()
  const actions: { id: ScreenId; label: string; icon: typeof ShoppingCart; primary?: boolean }[] = [
    { id: 'pos', label: t('dash.actions.newSale'), icon: ShoppingCart, primary: true },
    { id: 'products', label: t('dash.actions.addProduct'), icon: PackagePlus },
    { id: 'inventory', label: t('dash.actions.stockIn'), icon: Truck },
    { id: 'reports', label: t('dash.actions.reports'), icon: ChartColumn },
  ]
  return (
    <section className="card dash-card">
      <header className="dash-card__head">
        <h2>{t('dash.quickActions')}</h2>
      </header>
      <div className="quick">
        {actions.map(({ id, label, icon: Icon, primary }) => (
          <button key={id} type="button" className={`quick__tile ${primary ? 'is-primary' : ''}`} onClick={() => onNavigate(id)}>
            <Icon size={22} aria-hidden />
            {label}
          </button>
        ))}
        {heldCount > 0 && (
          <button type="button" className="quick__tile" onClick={() => onNavigate('pos')}>
            <PauseCircle size={22} aria-hidden />
            {t('dash.actions.heldN', { count: heldCount })}
          </button>
        )}
      </div>
    </section>
  )
}

function PaymentsCard({ today }: { today: Date }) {
  const { t } = useTranslation()
  const split = usePaymentSplit(today)
  const total = split.reduce((s, p) => s + p.amount, 0)
  return (
    <section className="card dash-card">
      <header className="dash-card__head">
        <h2>{t('dash.byPayment')}</h2>
      </header>
      {split.length === 0 ? (
        <p className="muted">{t('dash.noBillsYet')}</p>
      ) : (
        // Ranked bars, one hue: the label and amount carry identity, the bar only magnitude.
        <ul className="split">
          {split.map((p) => (
            <li key={p.method}>
              <div className="split__row">
                <span>{t(`pos.method.${p.method}`)}</span>
                <span className="money">{formatLKR(p.amount)}</span>
              </div>
              <div className="split__track" role="presentation">
                <div className="split__fill" style={{ width: `${total ? (p.amount / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ProfitCard({ today, revenue, cost }: { today: Date; revenue: number; cost: number }) {
  const { t, i18n } = useTranslation()
  const categories = useCategoryMargins(today)
  const profit = revenue - cost
  return (
    <section className="card dash-card">
      <header className="dash-card__head">
        <h2>{t('dash.grossProfit')}</h2>
        <Pill tone="neutral">{t('dash.estimated')}</Pill>
      </header>
      <dl className="figures">
        <div>
          <dt>{t('dash.revenue')}</dt>
          <dd className="figure">{formatRupees(revenue)}</dd>
        </div>
        <div>
          <dt>{t('dash.cost')}</dt>
          <dd className="figure">{formatRupees(cost)}</dd>
        </div>
        <div>
          <dt>{t('dash.profit')}</dt>
          <dd className="figure is-accent">{formatRupees(profit)}</dd>
        </div>
        <div>
          <dt>{t('dash.marginLabel')}</dt>
          <dd className="figure">{revenue > 0 ? `${((profit / revenue) * 100).toFixed(1)}%` : '—'}</dd>
        </div>
      </dl>
      {categories.length > 0 && (
        <>
          <h3 className="field__label">{t('dash.topMargin')}</h3>
          <ul className="margins">
            {categories.map((c) => (
              <li key={c.id ?? 'none'}>
                <span>{c.name ? localName({ name: c.name, name_si: c.name_si, name_ta: c.name_ta }, i18n.language) : t('pos.other')}</span>
                <span className="money">{Math.round((c.profit / c.revenue) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function StockCard({ stock, onNavigate }: { stock: ReturnType<typeof useStockSummary>; onNavigate: (s: ScreenId) => void }) {
  const { t } = useTranslation()
  return (
    <section className="card dash-card">
      <header className="dash-card__head">
        <h2>{t('dash.stock')}</h2>
        <button type="button" className="link" onClick={() => onNavigate('inventory')}>
          {t('nav.inventory')} →
        </button>
      </header>
      <div className="stock-tiles">
        <button type="button" className="stock-tile" onClick={() => onNavigate('inventory')}>
          <span>{t('dash.products')}</span>
          <strong className="figure">{stock.products.toLocaleString('en-LK')}</strong>
        </button>
        <button type="button" className="stock-tile is-warning" onClick={() => onNavigate('inventory')}>
          <span>{t('dash.low')}</span>
          <strong className="figure">{stock.low}</strong>
        </button>
        <button type="button" className="stock-tile is-danger" onClick={() => onNavigate('inventory')}>
          <span>{t('dash.out')}</span>
          <strong className="figure">{stock.out}</strong>
        </button>
      </div>
      <div className="stock-value">
        <span>{t('dash.stockValue')}</span>
        <strong className="figure">LKR {formatRupees(stock.value)}</strong>
      </div>
      {/* "Expiring in 30 days" appears once batches and expiry dates exist (Inventory). */}
    </section>
  )
}
