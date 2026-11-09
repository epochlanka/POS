import { useQuery } from '../db/useQuery'

export interface PosProduct {
  variant_id: string
  name: string
  name_si: string | null
  name_ta: string | null
  category_id: string | null
  category: string | null
  barcode: string | null
  sell_price: number
  cost_price: number
  low_stock_level: number | null
  stock: number
}

export interface PosCategory {
  id: string
  name: string
  name_si: string | null
  name_ta: string | null
  count: number
}

// Stock is the sum of all movements for the variant (see db/schema.ts).
const PRODUCTS_SQL = `
  SELECT v.id AS variant_id, p.name, p.name_si, p.name_ta, p.category_id, c.name AS category,
         v.barcode, v.sell_price, v.cost_price, v.low_stock_level,
         COALESCE((SELECT SUM(m.qty) FROM stock_movements m WHERE m.variant_id = v.id), 0) AS stock
  FROM product_variants v
  JOIN products p ON p.id = v.product_id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE v.is_active = 1 AND p.is_active = 1
  ORDER BY p.name`

const CATEGORIES_SQL = `
  SELECT c.id, c.name, c.name_si, c.name_ta,
         (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS count
  FROM categories c
  ORDER BY c.sort_order, c.name`

export const usePosProducts = () => useQuery<PosProduct>(PRODUCTS_SQL)
export const usePosCategories = () => useQuery<PosCategory>(CATEGORIES_SQL)
export const useHeldBillCount = () => useQuery<{ n: number }>('SELECT COUNT(*) AS n FROM held_bills')[0]?.n ?? 0

/** Name in the current UI language, falling back to English. */
export function localName(item: { name: string; name_si: string | null; name_ta: string | null }, lang: string): string {
  if (lang === 'si' && item.name_si) return item.name_si
  if (lang === 'ta' && item.name_ta) return item.name_ta
  return item.name
}

export type StockLevel = 'out' | 'low' | 'ok'

export function stockLevel(p: Pick<PosProduct, 'stock' | 'low_stock_level'>): StockLevel {
  if (p.stock <= 0) return 'out'
  if (p.stock <= (p.low_stock_level ?? 0)) return 'low'
  return 'ok'
}

/** Search by name in any language, or by exact/partial barcode. */
export function searchProducts(products: PosProduct[], query: string): PosProduct[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const exact = products.filter((p) => p.barcode === q)
  if (exact.length) return exact
  return products.filter(
    (p) => [p.name, p.name_si, p.name_ta].some((n) => n?.toLowerCase().includes(q)) || (q.length >= 4 && p.barcode?.includes(q)),
  )
}
