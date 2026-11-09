import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled so Sinhala and Tamil render the same on every device,
// on screen and on printed receipts.
import '@fontsource/noto-sans/400.css'
import '@fontsource/noto-sans/700.css'
import '@fontsource/noto-sans-sinhala/400.css'
import '@fontsource/noto-sans-sinhala/700.css'
import '@fontsource/noto-sans-tamil/400.css'
import '@fontsource/noto-sans-tamil/700.css'
import './index.css'
import './i18n'
import App from './App.tsx'
import { cloudConfigured } from './db/connector'
import { initDatabase } from './db/database'
import { seedDemoData } from './db/sales'

async function start() {
  await initDatabase()
  // Demo products only in development without a cloud backend, so they are
  // never uploaded to a real shop's data.
  if (import.meta.env.DEV && !cloudConfigured) await seedDemoData()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

start().catch((err) => {
  console.error(err)
  document.getElementById('root')!.textContent = `Could not open the local database: ${err.message}`
})
