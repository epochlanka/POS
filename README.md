# Lanka POS

Offline-first retail POS for Sri Lankan shops. One React + TypeScript
codebase runs on:

| Target | How |
|---|---|
| Android phones and tablets | Capacitor (`android/`) |
| Linux and Windows PCs | Electron (`electron/`) |
| Browser (owner reports, development) | Vite |

## How it works

- **Offline first.** Every device has its own SQLite database (PowerSync). The billing screen only ever reads and writes that local database, so checkout keeps working when the internet drops. PowerSync syncs it with Supabase (Postgres) in the background.
- **Stock is a ledger.** Stock is never stored as one number. Every change is a row in `stock_movements` (+50 received, −1 sold), and current stock is `SUM(qty)`. Offline counters can't overwrite each other's changes.
- **Money is integer cents**, so totals never drift.
- **Bill numbers carry the counter's prefix** (`C1-000123`), so offline counters never clash.
- **Receipts are printed as images** (ESC/POS raster). Cheap thermal printers have no Sinhala or Tamil fonts, so the app draws the receipt with bundled Noto fonts and sends a bitmap.

## Project layout

```
src/
  auth/        sign-in, shop setup, device linking, till PIN lock
  dashboard/   owner dashboard and sales chart
  pos/         billing screen: cart, discounts, hold, payment
  shell/       app frame and navigation
  ui/          shared components; styles/ holds the design tokens
  db/          local database schema, checkout logic, Supabase sync connector
  printing/    receipt renderer (canvas → 1-bit bitmap) and ESC/POS builder
  platform/    printer access per platform (Electron, Android, browser)
  screens/     Settings, printer test, placeholder screens
  i18n/        English, Sinhala, Tamil strings
electron/      desktop shell: window, app:// protocol, USB/serial printing
android/       generated Capacitor Android project
supabase/      Postgres schema and row-level security
powersync/     sync rules (which data goes to which device)
build/linux/   .deb install scripts and udev rule for printer access
tests/         unit tests (vitest)
```

## Development

```bash
npm install
npm run dev            # browser at http://localhost:5173
npm test               # unit tests
npm run dev:electron   # desktop app with hot reload
```

On Ubuntu, Electron may stop with *"The SUID sandbox helper binary was found, but is not configured correctly"*. Fix it once:

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

(Repeat after reinstalling Electron. Installed `.deb` packages handle this themselves.)

### Desktop packages

```bash
npm run dist:linux     # release/*.deb and release/*.AppImage
npm run dist:win       # release/*.exe (best run on Windows)
```

The `.deb` installs a udev rule (`build/linux/70-lanka-pos-printers.rules`) so the logged-in user can print to USB, USB-serial and Bluetooth (rfcomm) printers without root.

### Android

Needs Android Studio (Android SDK + JDK 21).

```bash
npm run android:sync   # build web app and copy it into android/
npm run android:open   # open in Android Studio, then Run
```

### Accounts and cloud sync

Without a `.env`, the app runs as an offline demo shop with no login (in development it adds demo products and sales).

1. **Sign-in:** create a Supabase project, run `supabase/migrations/*.sql` in order, and put the project URL and publishable key in `.env` (see `.env.example`). The app then asks the owner to sign in, set up the shop and choose a till PIN.
2. **Sync:** create a PowerSync instance connected to that database, paste in `powersync/sync-rules.yaml`, and add `VITE_POWERSYNC_URL` to `.env`.

See [PROGRESS.md](PROGRESS.md) for what's built and what's next.

⚠️ Before turning on sync, build sign-in and shop selection. Right now each device makes up a local shop ID, and the server would reject its uploads.

## Phase 0 status

| Check | Status |
|---|---|
| Sinhala/Tamil receipt rendered as a bitmap | ✅ done (Printer test screen shows a preview) |
| USB printing on Linux (`/dev/usb/lp*`) | ✅ code written, needs a real printer |
| Serial / Bluetooth rfcomm printing on Linux and Windows | ✅ code written, needs a real printer |
| Windows USB printers via the print spooler | ⏳ TODO |
| Android Bluetooth printing | ⏳ TODO: small in-house Capacitor plugin (Kotlin, SPP) |
| Offline sync between two devices | ⏳ needs Supabase + PowerSync set up |

Sinhala and Tamil interface strings are first drafts and need review by a native speaker.
