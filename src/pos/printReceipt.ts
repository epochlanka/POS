import { getSetting } from '../db/database'
import type { CartItem } from '../db/sales'
import { lineTotal, type Cents } from '../lib/money'
import { printerTransport } from '../platform'
import { EscPosBuilder } from '../printing/escpos'
import { renderReceipt, type PaperWidth, type Receipt } from '../printing/receipt'

export interface ReceiptPrinter {
  id: string
  width: PaperWidth
}

/** The printer chosen in Settings → Printer, if any. */
export async function receiptPrinter(): Promise<ReceiptPrinter | null> {
  const id = await getSetting('printer_id')
  if (!id) return null
  return { id, width: (Number(await getSetting('paper_width')) || 384) as PaperWidth }
}

export async function buildReceipt(sale: {
  billNo: string
  createdAt: Date
  items: CartItem[]
  subtotal: Cents
  discount: Cents
  total: Cents
  payments: { method: string; amount: Cents }[]
  change: Cents
  cashier?: string
}): Promise<Receipt> {
  return {
    shopName: (await getSetting('shop_name')) || 'My Shop',
    shopAddress: (await getSetting('shop_address')) || undefined,
    shopPhone: (await getSetting('shop_phone')) || undefined,
    billNo: sale.billNo,
    cashier: sale.cashier,
    date: sale.createdAt,
    lines: sale.items.map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unitPrice, total: lineTotal(i.unitPrice, i.qty, i.discount) })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    payments: sale.payments,
    change: sale.change,
    footer: 'ස්තූතියි! · நன்றி! · Thank you!',
  }
}

/**
 * Prints a receipt and/or opens the cash drawer through the receipt printer.
 * Throws if no printer is set up or printing fails.
 */
export async function printToReceiptPrinter(opts: { receipt?: Receipt; openDrawer?: boolean }): Promise<void> {
  const printer = await receiptPrinter()
  if (!printer) throw new Error('No receipt printer set up')
  const transport = printerTransport()
  await transport.listPrinters() // refresh the list the desktop app allows printing to
  const b = new EscPosBuilder().init()
  if (opts.openDrawer) b.openDrawer()
  if (opts.receipt) {
    const { bitmap } = await renderReceipt(opts.receipt, printer.width)
    b.raster(bitmap).feed(4).cut()
  }
  await transport.print(printer.id, b.build())
}
