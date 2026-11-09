import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSetting, setSetting } from '../db/database'
import { toCents } from '../lib/money'
import { currentPlatform, printerTransport, type PrinterInfo } from '../platform'
import { EscPosBuilder } from '../printing/escpos'
import { renderReceipt, type PaperWidth, type Receipt } from '../printing/receipt'
import { Button, Pill, Segmented } from '../ui'
import { useToast } from '../ui/toast'

// Phase 0 check: mixed English / Sinhala / Tamil text, printed as an image.
const sampleReceipt = (): Receipt => ({
  shopName: 'Sample Stores / නියැදි වෙළඳසැල',
  shopAddress: 'No. 12, Main Street, Kandy · கண்டி',
  shopPhone: '077 123 4567',
  billNo: 'C1-000001',
  date: new Date(),
  cashier: 'Nimal',
  lines: [
    { name: 'සීනි 1kg (Sugar)', qty: 2, unitPrice: toCents(280), total: toCents(560) },
    { name: 'பருப்பு 500g (Dhal)', qty: 1, unitPrice: toCents(235), total: toCents(235) },
    { name: 'Ceylon Tea 200g', qty: 1, unitPrice: toCents(790), total: toCents(790) },
  ],
  subtotal: toCents(1585),
  discount: toCents(85),
  total: toCents(1500),
  payments: [{ method: 'Cash / මුදල් / பணம்', amount: toCents(2000) }],
  change: toCents(500),
  footer: 'ස්තූතියි! නැවත එන්න · நன்றி! மீண்டும் வருக · Thank you!',
})

/** Receipt printer setup: find a printer, test it, and use it for receipts. */
export function PrinterTestScreen() {
  const { t } = useTranslation()
  const toast = useToast()
  const platform = currentPlatform()
  const transport = printerTransport()
  const [printers, setPrinters] = useState<PrinterInfo[] | null>(null)
  const [selected, setSelected] = useState('')
  const [width, setWidth] = useState<PaperWidth>(384)
  const [saved, setSaved] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([getSetting('printer_id'), getSetting('paper_width')]).then(([id, w]) => {
      setSaved(id || null)
      if (id) setSelected(id)
      if (w) setWidth(Number(w) as PaperWidth)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    renderReceipt(sampleReceipt(), width).then(({ canvas }) => {
      if (cancelled || !previewRef.current) return
      canvas.className = 'receipt-preview'
      previewRef.current.replaceChildren(canvas)
    })
    return () => {
      cancelled = true
    }
  }, [width])

  const scan = async () => {
    try {
      const list = await transport.listPrinters()
      setPrinters(list)
      if (list.length && !list.some((p) => p.id === selected)) setSelected(list[0].id)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const send = async (withReceipt: boolean) => {
    try {
      await transport.listPrinters()
      const b = new EscPosBuilder().init()
      if (withReceipt) {
        const { bitmap } = await renderReceipt(sampleReceipt(), width)
        b.raster(bitmap).feed(4).cut()
      } else {
        b.openDrawer()
      }
      await transport.print(selected, b.build())
      toast(t('printer.printed'))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const useForReceipts = async () => {
    await setSetting('printer_id', selected)
    await setSetting('paper_width', String(width))
    setSaved(selected)
    toast(t('printer.savedDefault'))
  }

  return (
    <div className="printer-test">
      <div className="printer-controls">
        <h2>{t('printer.title')}</h2>
        <p className="muted">{t('printer.intro')}</p>
        {platform === 'web' && <p className="notice notice--info">{t('printer.webOnly')}</p>}
        {saved && (
          <p>
            <Pill tone="success" dot>
              {t('printer.current', { id: saved })}
            </Pill>
          </p>
        )}

        <div className="field">
          <span className="field__label">{t('printer.paper')}</span>
          <Segmented<string>
            value={String(width)}
            onChange={(w) => setWidth(Number(w) as PaperWidth)}
            options={[
              { value: '384', label: '58 mm' },
              { value: '576', label: '80 mm' },
            ]}
          />
        </div>

        <Button onClick={scan} disabled={platform === 'web'}>
          {t('printer.scan')}
        </Button>
        {printers?.length === 0 && <p className="muted">{t('printer.none')}</p>}
        {printers && printers.length > 0 && (
          <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label={t('printer.title')}>
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
        <div className="printer-actions">
          <Button variant="primary" disabled={!selected} onClick={() => send(true)}>
            {t('printer.print')}
          </Button>
          <Button disabled={!selected} onClick={() => send(false)}>
            {t('printer.drawer')}
          </Button>
          <Button disabled={!selected || selected === saved} onClick={useForReceipts}>
            {t('printer.useForReceipts')}
          </Button>
        </div>
      </div>
      <div ref={previewRef} className="receipt-paper" aria-label={t('printer.preview')} />
    </div>
  )
}
