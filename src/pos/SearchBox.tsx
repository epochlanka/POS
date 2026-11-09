import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScanBarcode, Search } from 'lucide-react'
import { formatLKR } from '../lib/money'
import { Pill } from '../ui'
import { localName, searchProducts, stockLevel, type PosProduct } from './data'

/**
 * Barcode / name search. Scanners type the code and press Enter. Typing
 * shows live results: ↑↓ to move, Enter to add, Esc to close.
 */
export const SearchBox = forwardRef<
  HTMLInputElement,
  { products: PosProduct[]; onPick: (p: PosProduct) => void; onNotFound: (query: string) => void }
>(function SearchBox({ products, onPick, onNotFound }, ref) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const results = searchProducts(products, query).slice(0, 8)
  const open = query.trim().length > 0

  const pick = (p: PosProduct) => {
    onPick(p)
    setQuery('')
    setActive(0)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Escape') {
      setQuery('')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const q = query.trim()
      if (!q) return
      const hit = results[active] ?? results[0]
      if (hit) pick(hit)
      else {
        onNotFound(q)
        setQuery('')
      }
    }
  }

  return (
    <div className="search">
      <Search size={18} className="search__icon" aria-hidden />
      <input
        ref={ref}
        type="search"
        className="search__input"
        placeholder={t('pos.search')}
        aria-label={t('pos.search')}
        role="combobox"
        aria-expanded={open}
        aria-controls="search-results"
        aria-activedescendant={open && results[active] ? `sr-${results[active].variant_id}` : undefined}
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
      />
      <kbd className="search__kbd">F2</kbd>
      {open && (
        <div className="search__results card" id="search-results" role="listbox">
          {results.length === 0 ? (
            <div className="search__empty muted">
              <ScanBarcode size={18} aria-hidden /> {t('pos.noResults')}
            </div>
          ) : (
            results.map((p, i) => {
              const level = stockLevel(p)
              return (
                <div
                  key={p.variant_id}
                  id={`sr-${p.variant_id}`}
                  role="option"
                  aria-selected={i === active}
                  className="search__row"
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()} // keep focus in the input
                  onClick={() => pick(p)}
                >
                  <div>
                    <div className="search__name">{localName(p, i18n.language)}</div>
                    <div className="muted small">
                      {p.barcode} · {p.category ?? t('pos.other')}
                    </div>
                  </div>
                  {level === 'out' ? <Pill tone="danger">{t('pos.out')}</Pill> : <span className="money">{formatLKR(p.sell_price)}</span>}
                </div>
              )
            })
          )}
          <div className="search__hint muted small">{t('pos.searchHint')}</div>
        </div>
      )}
    </div>
  )
})
