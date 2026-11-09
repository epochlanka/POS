import { app, BrowserWindow, ipcMain, net, protocol } from 'electron'
import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

interface PrinterInfo {
  id: string
  label: string
  kind: 'usb-lp' | 'serial' | 'bluetooth'
}

const DEV_URL = process.env.VITE_DEV_SERVER_URL
const DIST = path.join(__dirname, '..', 'dist')

// Serve the built app from app://pos/ rather than file://, so IndexedDB, web
// workers and WASM (used by the offline database) behave like a normal site.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// Only printers returned by the last scan may be written to.
let knownPrinters = new Map<string, PrinterInfo>()

async function listPrinters(): Promise<PrinterInfo[]> {
  const found: PrinterInfo[] = []

  // Linux USB printers that use the kernel's usblp driver: /dev/usb/lp0, lp1...
  // Access is granted by the udev rule shipped in build/linux/.
  if (process.platform === 'linux') {
    try {
      for (const name of await readdir('/dev/usb')) {
        if (/^lp\d+$/.test(name)) {
          found.push({ id: `/dev/usb/${name}`, label: `USB printer (${name})`, kind: 'usb-lp' })
        }
      }
    } catch {
      // No /dev/usb: no USB printers connected.
    }
  }

  // Serial ports: USB-serial printers, Windows COM ports, and Bluetooth
  // printers bound with rfcomm on Linux (/dev/rfcomm0).
  try {
    const { SerialPort } = await import('serialport')
    for (const p of await SerialPort.list()) {
      const bt = /rfcomm/i.test(p.path) || /bluetooth/i.test(p.pnpId ?? '')
      found.push({
        id: p.path,
        label: `${p.manufacturer ?? (bt ? 'Bluetooth' : 'Serial')} (${p.path})`,
        kind: bt ? 'bluetooth' : 'serial',
      })
    }
  } catch (err) {
    console.error('Serial port scan failed:', err)
  }

  // TODO(Phase 0): Windows USB printers installed through the print spooler
  // (needs RAW printing via the Windows spooler API).

  knownPrinters = new Map(found.map((p) => [p.id, p]))
  return found
}

async function printRaw(printerId: string, data: Uint8Array): Promise<void> {
  const printer = knownPrinters.get(printerId)
  if (!printer) throw new Error('Unknown printer. Scan for printers again.')

  if (printer.kind === 'usb-lp') {
    await writeFile(printer.id, data)
    return
  }

  const { SerialPort } = await import('serialport')
  const port = new SerialPort({ path: printer.id, baudRate: 9600, autoOpen: false })
  await new Promise<void>((res, rej) => port.open((e) => (e ? rej(e) : res())))
  try {
    await new Promise<void>((res, rej) => port.write(Buffer.from(data), (e) => (e ? rej(e) : res())))
    await new Promise<void>((res, rej) => port.drain((e) => (e ? rej(e) : res())))
  } finally {
    await new Promise<void>((res) => port.close(() => res()))
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Lanka POS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.removeMenu()

  // Keep navigation inside the app.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(DEV_URL ?? 'app://')) e.preventDefault()
  })

  if (DEV_URL) {
    win.loadURL(DEV_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadURL('app://pos/index.html')
  }
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url)
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)))
    if (!file.startsWith(DIST + path.sep)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })

  ipcMain.handle('printer:list', () => listPrinters())
  ipcMain.handle('printer:print', (_e, id: string, data: Uint8Array) => printRaw(id, data))

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
