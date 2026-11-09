# Progress

Status of Lanka POS as of 9 November 2026.

## Done

### 1. Project setup
- One React + TypeScript codebase. Capacitor builds the Android app; Electron builds the Windows and Linux apps (`.deb`, AppImage, `.exe`).
- Offline-first database: every device has its own SQLite database (PowerSync). Sales, stock and settings are read and written locally, so the till works without internet.
- Stock is a ledger (`stock_movements`, current stock = `SUM(qty)`), money is integer cents, and bill numbers carry the counter prefix (`C1-000123`).
- Receipts are drawn as images with bundled Noto fonts and sent as ESC/POS raster, so Sinhala and Tamil print on cheap thermal printers. USB and serial printing works on Linux and Windows desktop; the `.deb` installs a udev rule for printer access.
- English, Sinhala and Tamil throughout. The Sinhala and Tamil text are drafts and need review by native speakers.

### 2. Design system
Built from the UI concepts (`design/ui-concepts/`):
- **Colours and type:** green brand colour, dark side rail, Space Grotesk and Inter fonts, Noto for Sinhala and Tamil.
- **Touch targets:** 44px everywhere, 56px on the till.
- **Status:** always shown as a colour plus a word.
- **Components** (`src/ui/`): buttons, pills, chips, segmented controls, dialogs (bottom sheets on phones), number pad, empty states, toasts.
- **Layout:** side rail on PCs and tablets, bottom bar with a "More" sheet on phones.

### 3. POS (billing) screen
- **Finding products:** product grid with category chips, plus search and barcode scan. An unknown barcode shows a clear message.
- **Cart:** quantities, item and whole-bill discounts (% or LKR, 10% cashier limit), and a stock warning when a product is sold out.
- **Hold and resume:** bills can be held and resumed. The open bill survives a restart or power cut.
- **Payment:** cash with quick-cash note buttons and change, plus card, LankaQR and credit. Receipt printing and cash drawer.
- **Keyboard shortcuts:** F2 search, F4 hold, F8 discount, F12 pay.

### 4. Owner dashboard
- **Today at a glance:** sales, bill count and average bill, estimated profit and margin, low and out-of-stock counts.
- **Sales chart:** by hour, 7 days or 12 months, with hover and keyboard tooltips and a "View as table" option. Comparisons are like-for-like: the same time last week, or last month to the same date.
- **Cards:** needs attention, recent sales, quick actions, sales by payment method, profit summary (best-margin categories), stock summary.
- **Demo data:** in development without Supabase settings, about 13 months of demo sales are added so the charts have data.

### 5. Accounts, shop setup and till PIN
- **Owner accounts:** email and password (Supabase Auth). Sign-up confirmation and password reset use an emailed code.
- **Shop setup:** pick an existing shop or create a new one. `create_shop` makes the shop, its "Main" branch and the owner membership.
- **Device linking:** each device registers as a counter (C1, C2…). Only the first sign-in needs internet; after that everything works offline.
- **Till PIN:** each person has a profile with a 4–6 digit PIN, stored as a PBKDF2 hash in a synced `staff` table.
  - The lock screen asks who's at the till; five wrong tries locks it for 30 seconds.
  - "Forgot PIN?" lets the owner reset their PIN with the account password.
  - The shell has a Lock button.
- **Roles:**
  - Cashiers only see selling screens; owners and managers see everything and land on the dashboard.
  - Each sale records its cashier, and receipts print the cashier's name.
- **Settings:** language, shop details (also saved to the cloud), account and counter info, "Sign out of this device" (warns about unsynced changes), printer test.

### 6. Supabase backend
- **Project:** `xodjqtiddctclttgmfnw`, region ap-southeast-2 (Sydney).
- **Database:** all migrations in `supabase/migrations/` are applied.
  - 14 tables, each with row-level security.
  - Logged-out (anon) users have no access.
  - A `powersync` publication lists the tables that sync.
- **App connection:** `.env` holds the project URL and publishable key. It is git-ignored; `.env.example` shows the format.

### Checks
- 24 unit tests pass (money, ids, ESC/POS, cart, dates, PINs). Type check and build are clean. Lint has one known warning in `src/ui/toast.tsx`.
- Screens were checked in headless Chrome at phone, tablet and desktop widths.

## To do on the Supabase dashboard
1. **Reset the database password and delete the secret key.** Both were shared in a chat. The app only needs the URL and the publishable key.
2. **Authentication → Emails → Templates:** add `Your code: {{ .Token }}` to "Reset password" (required for password reset in the app) and to "Confirm signup" (optional; without it, users click the link and then sign in).
3. **Authentication → Emails → SMTP:** set up your own email provider before real shops sign up. Supabase's built-in email only sends a few messages per hour.

## Next steps
1. **Products and stock.**
   - Add and edit products, variants, barcodes, prices and categories.
   - Import from a spreadsheet.
   - Receive stock and record opening stock.
   - Stock adjustments, with low-stock levels and batches/expiry.
2. **Staff.** Add cashiers and managers with PINs, deactivate staff and reset PINs. Use a manager PIN to approve discounts above the cashier limit, and auto-lock the till after inactivity.
3. **Cloud sync.** Create a free PowerSync instance and connect it to Supabase. Paste in `powersync/sync-rules.yaml` and add `VITE_POWERSYNC_URL` to `.env`. Then test two counters syncing, including offline sales uploading later.
4. **Returns and exchanges, and voiding bills** (owner or manager only).
5. **Customers and credit:** customer accounts, credit sales, payments and overdue alerts.
6. **Purchases and suppliers:** GRNs and supplier balances.
7. **Reports and day-end:** shift open and close, cash count and Z-report, sales and stock reports, export.
8. **Printing on more platforms:** Android Bluetooth printer plugin and the Windows print spooler.
9. **Before release:**
   - Native-speaker review of the Sinhala and Tamil text.
   - Decide the product name (Lanka POS or Kade POS).
   - App icons and installers, plus backups.
   - Consider moving Supabase to the Mumbai region for lower latency from Sri Lanka.
