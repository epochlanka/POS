import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Change before the first Play Store upload: it can never change afterwards.
  appId: 'lk.lankapos.app',
  appName: 'Lanka POS',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
}

export default config
