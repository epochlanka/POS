import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCompact, formatLKR } from '../lib/money'
import type { Bucket } from './queries'

const HEIGHT = 200
const PAD = { top: 22, right: 4, bottom: 26, left: 44 }
const MAX_BAR = 24

/** Rounds up to a clean axis maximum (1, 2, 5 × 10ⁿ) whose half is also clean. */
function niceMax(v: number): number {
  if (v <= 0) return 100_000 // LKR 1,000 in cents, so an empty chart still has an axis
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 2, 5, 10]) if (m * exp >= v) return m * exp
  return 10 * exp
}

/** Column with a 4px rounded top and a square base on the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

/**
 * Single-series column chart. Emphasis form: the current period in the
 * accent green, earlier periods in a lighter step of the same green.
 */
export function SalesChart({ buckets, label }: { buckets: Bucket[]; label: string }) {
  const { t } = useTranslation()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const max = niceMax(Math.max(0, ...buckets.map((b) => b.value)))
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const slot = buckets.length ? plotW / buckets.length : 0
  const barW = Math.min(MAX_BAR, Math.max(4, slot * 0.62))
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH
  const ticks = [0, max / 2, max]
  // Thin out x labels when slots are narrow; always keep the current one.
  const every = slot >= 34 ? 1 : slot >= 18 ? 2 : 3
  const activeBucket = active !== null ? buckets[active] : null

  return (
    <div className="chart">
      <div ref={wrapRef} className="chart__plot" onPointerLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={label}>
            {ticks.map((tk) => (
              <g key={tk}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(tk)} y2={y(tk)} className="chart__grid" />
                <text x={PAD.left - 8} y={y(tk)} className="chart__tick" textAnchor="end" dominantBaseline="middle">
                  {formatCompact(tk)}
                </text>
              </g>
            ))}

            {buckets.map((b, i) => {
              const cx = PAD.left + slot * i + slot / 2
              const h = (b.value / max) * plotH
              const showLabel = b.current || i % every === 0
              return (
                <g key={b.key}>
                  {h > 0 && (
                    <path
                      d={columnPath(cx - barW / 2, y(b.value), barW, h)}
                      className={`chart__bar ${b.current ? 'is-current' : ''} ${active === i ? 'is-active' : ''}`}
                    />
                  )}
                  {/* Value on the current period's cap only — the axis and tooltip carry the rest. */}
                  {b.current && b.value > 0 && (
                    <text x={cx} y={y(b.value) - 6} textAnchor="middle" className="chart__value">
                      {formatCompact(b.value)}
                    </text>
                  )}
                  {showLabel && (
                    <text x={cx} y={HEIGHT - 6} textAnchor="middle" className={`chart__xlabel ${b.current ? 'is-current' : ''}`}>
                      {b.label}
                    </text>
                  )}
                  {/* Hit target: the whole column slot, bigger than the bar. */}
                  <rect
                    x={PAD.left + slot * i}
                    y={PAD.top}
                    width={slot}
                    height={plotH}
                    className="chart__hit"
                    tabIndex={0}
                    aria-label={`${b.title}: LKR ${formatLKR(b.value)}`}
                    onPointerEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                  />
                </g>
              )
            })}
            <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} className="chart__baseline" />
          </svg>
        )}

        {activeBucket && (
          <div
            className="chart__tooltip"
            role="status"
            style={{
              left: Math.min(Math.max(PAD.left + slot * (active ?? 0) + slot / 2, 70), width - 70),
              top: Math.max(4, y(activeBucket.value) - 58),
            }}
          >
            <strong className="money">LKR {formatLKR(activeBucket.value)}</strong>
            <span>{activeBucket.title}</span>
          </div>
        )}
      </div>

      <details className="chart__table">
        <summary>{t('dash.viewTable')}</summary>
        <table>
          <caption className="visually-hidden">{label}</caption>
          <thead>
            <tr>
              <th scope="col">{t('dash.period')}</th>
              <th scope="col">{t('dash.sales')}</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.key}>
                <td>{b.title}</td>
                <td className="money">{formatLKR(b.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
