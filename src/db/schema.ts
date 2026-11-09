import { column, Schema, Table } from '@powersync/web'

/**
 * Client-side (SQLite) schema. Every device keeps a full local copy of its
 * shop's data, and checkout only ever reads and writes this local database.
 * PowerSync syncs it with Postgres in the background.
 *
 * Must stay in step with supabase/migrations/. Money columns are integer cents.
 */

const categories = new Table(
  {
    shop_id: column.text,
    name: column.text,
    name_si: column.text,
    name_ta: column.text,
    sort_order: column.integer, // owner sets the order of the POS chips
  },
  { indexes: { by_order: ['sort_order'] } },
)

const products = new Table(
  {
    shop_id: column.text,
    category_id: column.text,
    name: column.text,
    name_si: column.text,
    name_ta: column.text,
    tracks_batches: column.integer, // 0/1
    is_active: column.integer,
    created_at: column.text,
  },
  { indexes: { by_name: ['name'] } },
)

const product_variants = new Table(
  {
    shop_id: column.text,
    product_id: column.text,
    label: column.text, // e.g. "500g", "Red / M"
    sku: column.text,
    barcode: column.text,
    cost_price: column.integer,
    sell_price: column.integer,
    low_stock_level: column.real,
    is_active: column.integer,
  },
  { indexes: { by_barcode: ['barcode'], by_product: ['product_id'] } },
)

/**
 * Stock is never stored as one number. Every change is a row here
 * (+50 received, -1 sold, -2 damaged) and current stock is SUM(qty).
 * Offline counters can't overwrite each other: sync just adds their rows.
 * Rows are append-only — mistakes are fixed with a new correcting row.
 */
const stock_movements = new Table(
  {
    shop_id: column.text,
    branch_id: column.text,
    variant_id: column.text,
    batch_id: column.text,
    qty: column.real,
    kind: column.text, // sale | return | receive | adjust | transfer_in | transfer_out | opening
    ref_id: column.text, // sale id, GRN id, adjustment id...
    unit_cost: column.integer,
    user_id: column.text,
    device_id: column.text,
    created_at: column.text,
  },
  { indexes: { by_variant: ['variant_id', 'branch_id'] } },
)

const sales = new Table(
  {
    shop_id: column.text,
    branch_id: column.text,
    device_id: column.text,
    bill_no: column.text,
    customer_id: column.text,
    cashier_id: column.text,
    shift_id: column.text,
    subtotal: column.integer,
    discount: column.integer,
    total: column.integer,
    status: column.text, // completed | voided
    created_at: column.text,
  },
  { indexes: { by_created: ['created_at'] } },
)

const sale_lines = new Table(
  {
    shop_id: column.text,
    sale_id: column.text,
    variant_id: column.text,
    batch_id: column.text,
    name: column.text, // copied at sale time so old bills never change
    qty: column.real,
    unit_price: column.integer,
    unit_cost: column.integer,
    discount: column.integer,
    total: column.integer,
  },
  { indexes: { by_sale: ['sale_id'] } },
)

const sale_payments = new Table(
  {
    shop_id: column.text,
    sale_id: column.text,
    method: column.text, // cash | card | lankaqr | credit
    amount: column.integer,
    reference: column.text,
    created_at: column.text,
  },
  { indexes: { by_sale: ['sale_id'] } },
)

/** Settings for this device only; never synced. */
const device_settings = new Table(
  {
    value: column.text,
  },
  { localOnly: true },
)

/**
 * Bills parked so the cashier can serve the next customer. Kept on this
 * device only (they belong to this counter), and survive restarts.
 */
const held_bills = new Table(
  {
    label: column.text, // H-01
    note: column.text, // "Blue shirt man"
    cart_json: column.text,
    total: column.integer,
    item_count: column.integer,
    held_by: column.text,
    created_at: column.text,
  },
  { localOnly: true },
)

export const AppSchema = new Schema({
  categories,
  products,
  product_variants,
  stock_movements,
  sales,
  sale_lines,
  sale_payments,
  device_settings,
  held_bills,
})

export type Database = (typeof AppSchema)['types']
export type ProductRow = Database['products']
export type VariantRow = Database['product_variants']
