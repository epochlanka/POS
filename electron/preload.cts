import { contextBridge, ipcRenderer } from 'electron'

// The only desktop features the web app can reach. Must match DesktopBridge
// in src/platform/index.ts.
contextBridge.exposeInMainWorld('lankaPos', {
  platform: process.platform,
  listPrinters: () => ipcRenderer.invoke('printer:list'),
  print: (printerId: string, data: Uint8Array) => ipcRenderer.invoke('printer:print', printerId, data),
})
