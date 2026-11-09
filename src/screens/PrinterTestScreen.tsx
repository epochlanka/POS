import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toCents } from '../lib/money'
import { currentPlatform, printerTransport, type PrinterInfo } from '../platform'
import { EscPosBuilder } from '../printing/escpos'
import { renderReceipt, type PaperWidth, type Receipt } from '../printing/receipt'

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

export function PrinterTestScreen() {
  const { t } = useTranslation()
  const platform = currentPlatform()
  const transport = printerTransport()
  const [printers, setPrinters] = useState<PrinterInfo[] | null>(null)
  const [selected, setSelected] = useState('')
  const [width, setWidth] = useState<PaperWidth>(384)
  const [status, setStatus] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)

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
    setStatus('')
    try {
      const list = await transport.listPrinters()
      setPrinters(list)
      if (list[0]) setSelected(list[0].id)
    } catch (e) {
      setStatus((e as Error).message)
    }
  }

  const send = async (withReceipt: boolean) => {
    setStatus('')
    try {
      const b = new EscPosBuilder().init()
      if (withReceipt) {
        const { bitmap } = await renderReceipt(sampleReceipt(), width)
        b.raster(bitmap).feed(4).cut()
      } else {
        b.openDrawer()
      }
      await transport.print(selected, b.build())
      setStatus(t('printer.printed'))
    } catch (e) {
      setStatus((e as Error).message)
    }
  }

  return (
    <div className="printer-test">
      <div className="printer-controls">
        <h2>{t('printer.title')}</h2>
        <p className="muted">{t('printer.intro')}</p>
        {platform === 'web' && <p className="message">{t('printer.webOnly')}</p>}

        <label>
          {t('printer.paper')}{' '}
          <select value={width} onChange={(e) => setWidth(Number(e.target.value) as PaperWidth)}>
            <option value={384}>58 mm</option>
            <option value={576}>80 mm</option>
          </select>
        </label>

        <button onClick={scan} disabled={platform === 'web'}>{t('printer.scan')}</button>
        {printers?.length === 0 && <p className="muted">{t('printer.none')}</p>}
        {printers && printers.length > 0 && (
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {printers.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        )}
        <div className="pay-buttons">
          <button className="primary" disabled={!selected} onClick={() => send(true)}>{t('printer.print')}</button>
          <button disabled={!selected} onClick={() => send(false)}>{t('printer.drawer')}</button>
        </div>
        {status && <p className="message">{status}</p>}
      </div>
      <div ref={previewRef} className="receipt-paper" />
    </div>
  )
}
