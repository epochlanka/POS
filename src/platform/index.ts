import { Capacitor } from '@capacitor/core'

export interface PrinterInfo {
  id: string
  label: string
  kind: 'usb-lp' | 'serial' | 'bluetooth'
}

/** Implemented by electron/preload.cts. */
export interface DesktopBridge {
  platform: 'linux' | 'win32' | 'darwin'
  listPrinters(): Promise<PrinterInfo[]>
  print(printerId: string, data: Uint8Array): Promise<void>
}

declare global {
  interface Window {
    lankaPos?: DesktopBridge
  }
}

export type Platform = 'electron' | 'android' | 'web'

export function currentPlatform(): Platform {
  if (window.lankaPos) return 'electron'
  if (Capacitor.getPlatform() === 'android') return 'android'
  return 'web'
}

export interface PrinterTransport {
  listPrinters(): Promise<PrinterInfo[]>
  print(printerId: string, data: Uint8Array): Promise<void>
}

const electronTransport = (bridge: DesktopBridge): PrinterTransport => ({
  listPrinters: () => bridge.listPrinters(),
  print: (id, data) => bridge.print(id, data),
})

// Phase 0 task: Android Bluetooth Classic (SPP) printing. Most cheap
// printers are Bluetooth Classic, not BLE. Plan: a small in-house Capacitor
// plugin (~100 lines of Kotlin using BluetoothSocket + the SPP UUID) instead
// of an unvetted third-party plugin.
const androidTransport: PrinterTransport = {
  async listPrinters() {
    return []
  },
  async print() {
    throw new Error('Android Bluetooth printing is not implemented yet (Phase 0).')
  },
}

// In a plain browser there is no printer access; the UI shows a preview.
const webTransport: PrinterTransport = {
  async listPrinters() {
    return []
  },
  async print() {
    throw new Error('Printing needs the desktop or Android app.')
  },
}

export function printerTransport(): PrinterTransport {
  switch (currentPlatform()) {
    case 'electron':
      return electronTransport(window.lankaPos!)
    case 'android':
      return androidTransport
    default:
      return webTransport
  }
}
