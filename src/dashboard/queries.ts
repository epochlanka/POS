import { useEffect, useState } from 'react'
import { useQuery } from '../db/useQuery'
import { addDays, addMonths, dayKey, monthKey, sqliteLocalModifier, startOfDay, startOfMonth } from '../lib/dates'

/**
 * Dashboard numbers, all computed from the local database so they work
 * offline and update the moment a sale is saved.
 */

const COMPLETED = "s.status = 'completed'"

/**
 * Local midnight today plus the current hour, refreshed every minute so the
 * dashboard rolls over at midnight and the current-hour bar moves on.
 */
export interface Clock {
  today: Date
  hour: number
  /** Current time, to the minute. Comparisons run "up to this time" in the earlier period. */
  now: Date
}

export function useClock(): Clock {
  const read = (): Clock => {
    const now = new Date()
    now.setSeconds(0, 0)
    return { today: startOfDay(now), hour: now.getHours(), now }
  }
  const [clock, setClock] = useState(read)
  useEffect(() => {
    const timer = setInterval(() => setClock(read()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return clock
}

interface Totals {
  bills: number
  revenue: number
  cost: number
}

const TOTALS_SQL = `
  SELECT COUNT(*) AS bills,
         COALESCE(SUM(s.total), 0) AS revenue,
         COALESCE(SUM((SELECT SUM(COALESCE(l.unit_cost, 0) * l.qty) FROM sale_lines l WHERE l.sale_id = s.id)), 0) AS cost
  FROM sales s
  WHERE ${COMPLETED} AND s.created_at >= ? AND s.created_at < ?`

function useTotals(from: Date, to: Date): Totals {
  return useQuery<Totals>(TOTALS_SQL, [from.toISOString(), to.toISOString()])[0] ?? { bills: 0, revenue: 0, cost: 0 }
}

/**
 * Today, plus the same weekday last week up to the same time of day, so a
 * morning isn't compared with a whole day.
 */
export function useTodayTotals({ today, now }: Clock) {
  const current = useTotals(today, addDays(today, 1))
  const lastWeek = useTotals(addDays(today, -7), new Date(now.getTime() - 7 * 86_400_000))
  return { current, lastWeek }
}

export function useHasAnySales(): boolean {
  return (useQuery<{ n: number }>("SELECT COUNT(*) AS n FROM sales WHERE status = 'completed'")[0]?.n ?? 0) > 0
}

export interface PaymentSplit {
  method: string
  amount: number
}

export function usePaymentSplit(today: Date): PaymentSplit[] {
  return useQuery<PaymentSplit>(
    `SELECT p.method, SUM(p.amount) AS amount
     FROM sale_payments p JOIN sales s ON s.id = p.sale_id
     WHERE ${COMPLETED} AND s.created_at >= ? AND s.created_at < ?
     GROUP BY p.method ORDER BY amount DESC`,
    [today.toISOString(), addDays(today, 1).toISOString()],
  )
}

export interface CategoryMargin {
  id: string | null
  name: string | null
  name_si: string | null
  name_ta: string | null
  revenue: number
  profit: number
}

/** Margin by category today. Before bill-level discounts, so an estimate. */
export function useCategoryMargins(today: Date): CategoryMargin[] {
  return useQuery<CategoryMargin>(
    `SELECT c.id, c.name, c.name_si, c.name_ta,
            SUM(l.total) AS revenue,
            SUM(l.total - COALESCE(l.unit_cost, 0) * l.qty) AS profit
     FROM sale_lines l
     JOIN sales s ON s.id = l.sale_id
     LEFT JOIN product_variants v ON v.id = l.variant_id
     LEFT JOIN products p ON p.id = v.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE ${COMPLETED} AND s.created_at >= ? AND s.created_at < ?
     GROUP BY c.id
     HAVING SUM(l.total) > 0
     ORDER BY profit * 1.0 / SUM(l.total) DESC
     LIMIT 3`,
    [today.toISOString(), addDays(today, 1).toISOString()],
  )
}

export interface StockSummary {
  products: number
  low: number
  out: number
  value: number
}

export function useStockSummary(): StockSummary {
  return (
    useQuery<StockSummary>(`
      WITH st AS (
        SELECT v.cost_price, COALESCE(v.low_stock_level, 0) AS low_level,
               COALESCE((SELECT SUM(m.qty) FROM stock_movements m WHERE m.variant_id = v.id), 0) AS stock
        FROM product_variants v JOIN products p ON p.id = v.product_id
        WHERE v.is_active = 1 AND p.is_active = 1
      )
      SELECT COUNT(*) AS products,
             COALESCE(SUM(stock <= 0), 0) AS out,
             COALESCE(SUM(stock > 0 AND stock <= low_level), 0) AS low,
             COALESCE(SUM(CASE WHEN stock > 0 THEN stock * cost_price ELSE 0 END), 0) AS value
      FROM st`)[0] ?? { products: 0, low: 0, out: 0, value: 0 }
  )
}

export interface RecentSale {
  id: string
  bill_no: string
  total: number
  created_at: string
  items: number
  method: string | null
  methods: number
}

export function useRecentSales(limit = 6): RecentSale[] {
  return useQuery<RecentSale>(
    `SELECT s.id, s.bill_no, s.total, s.created_at,
            (SELECT COUNT(*) FROM sale_lines l WHERE l.sale_id = s.id) AS items,
            (SELECT p.method FROM sale_payments p WHERE p.sale_id = s.id ORDER BY p.amount DESC LIMIT 1) AS method,
            (SELECT COUNT(*) FROM sale_payments p WHERE p.sale_id = s.id) AS methods
     FROM sales s
     WHERE ${COMPLETED}
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [limit],
  )
}

/* ---------------------------------------------------------------- Sales trend */

export type TrendRange = 'day' | 'week' | 'month'

export interface Bucket {
  key: string
  label: string
  /** Long label for tooltips and the table view. */
  title: string
  value: number
  current: boolean
}

export interface Trend {
  buckets: Bucket[]
  total: number
  /** The same span just before, for "+8% vs previous" — null if not comparable. */
  previousTotal: number | null
}

function useBucketed(format: string, from: Date, to: Date) {
  return useQuery<{ k: string; v: number }>(
    `SELECT strftime('${format}', s.created_at, ?) AS k, SUM(s.total) AS v
     FROM sales s
     WHERE ${COMPLETED} AND s.created_at >= ? AND s.created_at < ?
     GROUP BY k`,
    [sqliteLocalModifier(from), from.toISOString(), to.toISOString()],
  )
}

/** The same moment one month earlier, kept inside that month (31 Mar → 28/29 Feb). */
function sameTimeLastMonth(now: Date): Date {
  const lastMonth = addMonths(startOfMonth(now), -1)
  const daysInLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate()
  return new Date(lastMonth.getFullYear(), lastMonth.getMonth(), Math.min(now.getDate(), daysInLastMonth), now.getHours(), now.getMinutes())
}

/**
 * day: today by hour (7am–9pm, wider if there were sales outside it).
 * week: last 7 days, compared with the 7 days before up to the same time.
 * month: last 12 months; headline is this month so far, compared with last
 * month up to the same date and time.
 */
export function useSalesTrend(range: TrendRange, clock: Clock, lang: string, todayLabel: string): Trend {
  const { today, hour: nowHour, now } = clock
  const locale = lang === 'si' ? 'si-LK' : lang === 'ta' ? 'ta-LK' : 'en-GB'
  const thisMonth = startOfMonth(today)

  const spans = {
    day: { format: '%H', from: today, to: addDays(today, 1) },
    week: { format: '%Y-%m-%d', from: addDays(today, -6), to: addDays(today, 1) },
    month: { format: '%Y-%m', from: addMonths(thisMonth, -11), to: addMonths(thisMonth, 1) },
  }[range]
  const previousSpan = {
    day: { from: today, to: today }, // no comparison in day view (the KPI row has it)
    week: { from: addDays(today, -13), to: new Date(now.getTime() - 7 * 86_400_000) },
    month: { from: addMonths(thisMonth, -1), to: sameTimeLastMonth(now) },
  }[range]
  const previous = useTotals(previousSpan.from, previousSpan.to)
  const rows = useBucketed(spans.format, spans.from, spans.to)
  const byKey = new Map(rows.map((r) => [r.k, r.v]))
  const sum = (keys: string[]) => keys.reduce((s, k) => s + (byKey.get(k) ?? 0), 0)

  if (range === 'day') {
    const hours = rows.map((r) => Number(r.k))
    const first = Math.min(7, ...hours)
    const last = Math.max(21, ...hours)
    const buckets: Bucket[] = []
    for (let h = first; h <= last; h++) {
      const key = String(h).padStart(2, '0')
      buckets.push({
        key,
        label: String(h),
        title: `${key}:00–${key}:59`,
        value: byKey.get(key) ?? 0,
        current: h === nowHour,
      })
    }
    return { buckets, total: sum(buckets.map((b) => b.key)), previousTotal: null }
  }

  if (range === 'week') {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
    const buckets = days.map((d, i) => ({
      key: dayKey(d),
      label: i === 6 ? todayLabel : d.toLocaleDateString(locale, { weekday: 'short' }),
      title: d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' }),
      value: byKey.get(dayKey(d)) ?? 0,
      current: i === 6,
    }))
    return { buckets, total: sum(buckets.map((b) => b.key)), previousTotal: previous.revenue }
  }

  const months = Array.from({ length: 12 }, (_, i) => addMonths(thisMonth, i - 11))
  const buckets = months.map((m, i) => ({
    key: monthKey(m),
    label: m.toLocaleDateString(locale, { month: 'short' }),
    title: m.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
    value: byKey.get(monthKey(m)) ?? 0,
    current: i === 11,
  }))
  return { buckets, total: byKey.get(monthKey(thisMonth)) ?? 0, previousTotal: previous.revenue }
}
