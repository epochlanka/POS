import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled so text renders the same on every device, offline too.
// Space Grotesk (headings, money) and Inter (body) cover English; Noto covers
// Sinhala and Tamil, on screen and on printed receipts.
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/noto-sans/400.css'
import '@fontsource/noto-sans/700.css'
import '@fontsource/noto-sans-sinhala/400.css'
import '@fontsource/noto-sans-sinhala/700.css'
import '@fontsource/noto-sans-tamil/400.css'
import '@fontsource/noto-sans-tamil/700.css'
import './styles/tokens.css'
import './styles/base.css'
import './i18n'
import App from './App.tsx'
import { cloudConfigured } from './db/connector'
import { initDatabase } from './db/database'
import { seedDemoData, seedDemoHistory } from './db/sales'

async function start() {
  await initDatabase()
  // Demo products only in development without a cloud backend, so they are
  // never uploaded to a real shop's data.
  if (import.meta.env.DEV && !cloudConfigured) {
    await seedDemoData()
    await seedDemoHistory()
  }

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
