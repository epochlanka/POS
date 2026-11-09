import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // PowerSync's web database runs SQLite (WASM) in web workers.
  optimizeDeps: {
    exclude: ['@powersync/web', '@journeyapps/wa-sqlite'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
