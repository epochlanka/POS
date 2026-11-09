import { formatLKR, type Cents } from '../lib/money'
import type { MonoBitmap } from './escpos'

export interface ReceiptLine {
  name: string
  qty: number
  unitPrice: Cents
  total: Cents
}

export interface Receipt {
  shopName: string
  shopAddress?: string
  shopPhone?: string
  billNo: string
  date: Date
  cashier?: string
  lines: ReceiptLine[]
  subtotal: Cents
  discount: Cents
  total: Cents
  payments: { method: string; amount: Cents }[]
  change: Cents
  footer?: string
}

/** Printable width in dots: 384 for 58mm paper, 576 for 80mm paper (at 203 dpi). */
export type PaperWidth = 384 | 576

// The browser picks a font per character, so one string can mix English,
// Sinhala and Tamil. Fonts are bundled with the app (see main.tsx), never
// taken from the operating system.
const FONT_STACK = '"Noto Sans", "Noto Sans Sinhala", "Noto Sans Tamil", sans-serif'

export async function ensureReceiptFonts(): Promise<void> {
  await Promise.all([
    document.fonts.load(`20px "Noto Sans"`, 'A'),
    document.fonts.load(`20px "Noto Sans Sinhala"`, 'අ'),
    document.fonts.load(`20px "Noto Sans Tamil"`, 'அ'),
    document.fonts.load(`bold 20px "Noto Sans"`, 'A'),
  ])
}

interface Ctx {
  g: CanvasRenderingContext2D
  width: number
  y: number
  pad: number
}

function font(size: number, bold = false) {
  return `${bold ? 'bold ' : ''}${size}px ${FONT_STACK}`
}

function text(c: Ctx, s: string, opts: { size?: number; bold?: boolean; align?: 'left' | 'center' | 'right' } = {}) {
  const size = opts.size ?? 22
  c.g.font = font(size, opts.bold)
  c.g.textAlign = opts.align ?? 'left'
  const x = opts.align === 'center' ? c.width / 2 : opts.align === 'right' ? c.width - c.pad : c.pad
  for (const line of wrap(c.g, s, c.width - c.pad * 2)) {
    c.y += size * 1.3
    c.g.fillText(line, x, c.y)
  }
}

function row(c: Ctx, left: string, right: string, opts: { size?: number; bold?: boolean } = {}) {
  const size = opts.size ?? 22
  c.g.font = font(size, opts.bold)
  const rightW = c.g.measureText(right).width
  const lines = wrap(c.g, left, c.width - c.pad * 2 - rightW - 12)
  lines.forEach((line, i) => {
    c.y += size * 1.3
    c.g.textAlign = 'left'
    c.g.fillText(line, c.pad, c.y)
    if (i === lines.length - 1) {
      c.g.textAlign = 'right'
      c.g.fillText(right, c.width - c.pad, c.y)
    }
  })
}

function rule(c: Ctx) {
  c.y += 10
  c.g.fillRect(c.pad, c.y, c.width - c.pad * 2, 2)
  c.y += 4
}

function wrap(g: CanvasRenderingContext2D, s: string, maxWidth: number): string[] {
  const words = s.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const next = current ? `${current} ${w}` : w
    if (g.measureText(next).width <= maxWidth || !current) current = next
    else {
      lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function draw(c: Ctx, r: Receipt) {
  text(c, r.shopName, { size: 30, bold: true, align: 'center' })
  if (r.shopAddress) text(c, r.shopAddress, { size: 20, align: 'center' })
  if (r.shopPhone) text(c, r.shopPhone, { size: 20, align: 'center' })
  rule(c)
  row(c, `Bill: ${r.billNo}`, r.date.toLocaleDateString('en-GB'), { size: 20 })
  row(c, r.cashier ? `Cashier: ${r.cashier}` : '', r.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), { size: 20 })
  rule(c)
  for (const l of r.lines) {
    text(c, l.name, { size: 22 })
    row(c, `  ${l.qty} x ${formatLKR(l.unitPrice)}`, formatLKR(l.total), { size: 20 })
  }
  rule(c)
  row(c, 'Subtotal', formatLKR(r.subtotal))
  if (r.discount) row(c, 'Discount', `-${formatLKR(r.discount)}`)
  row(c, 'TOTAL (LKR)', formatLKR(r.total), { size: 28, bold: true })
  for (const p of r.payments) row(c, p.method, formatLKR(p.amount), { size: 20 })
  if (r.change) row(c, 'Change', formatLKR(r.change), { size: 20 })
  rule(c)
  if (r.footer) text(c, r.footer, { size: 22, align: 'center' })
  c.y += 10
}

/**
 * Draws the receipt on a canvas. Returns the canvas (for an on-screen preview)
 * and a 1-bit bitmap ready for EscPosBuilder.raster().
 */
export async function renderReceipt(r: Receipt, width: PaperWidth = 384): Promise<{ canvas: HTMLCanvasElement; bitmap: MonoBitmap }> {
  await ensureReceiptFonts()

  // First pass on a tall scratch canvas to measure the height.
  const measure = document.createElement('canvas')
  measure.width = width
  measure.height = 4000
  const m: Ctx = { g: measure.getContext('2d')!, width, y: 0, pad: 4 }
  draw(m, r)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.ceil(m.y)
  const g = canvas.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.fillStyle = '#000'
  draw({ g, width, y: 0, pad: 4 }, r)

  return { canvas, bitmap: toMono(g, canvas.width, canvas.height) }
}

/** Plain threshold: right for text and lines. Logos/photos would need dithering. */
export function toMono(g: CanvasRenderingContext2D, width: number, height: number, threshold = 160): MonoBitmap {
  const { data } = g.getImageData(0, 0, width, height)
  const bits = new Uint8Array(width * height)
  for (let i = 0; i < bits.length; i++) {
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    bits[i] = lum < threshold ? 1 : 0
  }
  return { width, height, bits }
}
