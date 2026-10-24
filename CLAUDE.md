# BMP Supplies — Sales Hub

Internal sales tool for BMP Supplies Inc. (Brooks & Calgary, Alberta): Quote Maker, Pipeline,
Products/price list, Stock, Load Calculator, Lead Tracking, DIMS, Shipping, and the
**Sales Summary** (order confirmations → sales reporting). Owner: **Paul** (admin).

Live: https://saleshub.bmpsupplies.com (also https://paullinde-oss.github.io/sales-hub/)

## Working with Paul
- Paul is not a developer. Explain in plain business language, keep answers short, avoid jargon.
- **Push straight to `main`** (Paul's standing instruction). Pushing to `main` auto-deploys via
  GitHub Actions → GitHub Pages in ~2 min. Check with `gh run list --repo paullinde-oss/sales-hub`.
- Always `npm run build` before pushing, and test changes before deploying (see Testing).
- Don't commit `node_modules/`, `dist/`, `package-lock.json` (in `.gitignore`).

## Stack & layout
- React 18 + Vite 5, Firebase Firestore (project `bmp-sales-hub`, **free Spark plan**), pdfjs-dist 3.11.174.
- `src/SalesHub.jsx` — the original app (one very large file: all the older tabs, login, layout).
- `src/admin/` — Admin tab: users, per-user tab access, sales-data scope, master password.
- `src/sales/` — Sales Summary:
  - `SalesSummary.jsx` — the tab UI (Dashboard, Orders, Accounts, Reports, Quote Matches, Settings)
  - `sync.js` — Dropbox → Firestore sync; `dropbox.js` — Dropbox OAuth (PKCE, browser only) + API
  - `ocParser.js` — reads the PDFs; `cleanOrder()` sorts lines into product/freight/fee/tax/credit
  - `orderStore.js` — order storage (see "Firestore & read limits")
  - `salesUtils.js` — dates/fiscal year, money, filters, grouping, quote matching, `enrichOrders()`
  - `accounts.js` — customer accounts & name matching; `cities.js` — ship-to city clean-up
  - `skus.js` — SKU standardising against the Products list
  - `pipelineReports.jsx` — quote/lead/forecast reports; `yearEndReport.js` — Year in Review PDFs
  - `logos.js` — customer logos (logo.dev + manual uploads); `auth.js` — master password

## Business rules Paul has confirmed
- **Fiscal year runs Dec 1 – Nov 30.** FY2026 = Dec 1, 2025 – Nov 30, 2026.
- Dashboard defaults to the current **Mon–Fri week**.
- **Sales = before tax.** Keep CAD and USD separate; combined totals convert USD→CAD
  (rate in Sales Summary → Settings). US ship-to addresses are USD.
- Order numbers: **BRO…** (Brooks) and **CAL…** (Calgary). Numbers are sequential — a gap below the
  latest number means a missed order (Settings → Missing order numbers; cancelled ones → "Not used").
- **John is the only sales rep.** Other names on accounts (Mark, Paul, Grant, Jeff) are just who's
  responsible — shown as "Held by", never "Rep". Reports: "John's sales", not "sales by rep".
- Accounts with a holder are **Distributors**; customers not on the list default to **End User**
  (editable). Account list started from Paul's list in `accounts.js` (DEFAULT_ACCOUNTS) and is now
  edited in the app (stored in Firestore).
- Users & access (Admin tab): Paul admin; Mark, Grant, Jeff full access; **John sees only his own
  accounts** in Sales Summary and no Lead Tracking. Sign-in = first name + shared master password
  (only Paul changes it). This is app-level access only, not real security (Firestore is open).
- Order line clean-up (in `cleanOrder`): **GST/PST/HST (and "GTS") are tax — never sales**, removed
  from totals if a PDF added them in. FRT / "Shipping to…" / 4420-0005 etc. are all **"Freight"**.
  Processing fees, expedited service, import duty recovery are **fees** (count in sales, grouped).
  **Labels / Label Fees** are charged items → one product "LABELS". **"Credit Applied" is negative.**
  BRO10480's blank line = tax; BRO10881's blank $350 line = freight.
- **"CUSTOM" SKU can be anything** — match those lines by description, never treat as one product.
- SKUs are standardised to the **Products list** (Settings → Product SKU clean-up for the rest).
  Renaming a SKU on the Products tab also maps past orders' old SKU to the new one.
- Ship-to cities roll up to one "City, PR" (e.g. every Calgary variant → "Calgary, AB").
- Quote Matches: only suggest when the quote total is **within $3,000** of the order; skip quotes
  already marked Won.
- Year in Review PDF file name: `Customer — FY2026 BMP Supplies Year in Review`.
- Must keep working for many years: nothing hard-coded to a year; FY lists grow from the data.

## Dropbox & order confirmations
- Dropbox app **"BMP Sales Hub Connector"** (Full Dropbox), app key in `dropbox.js`. Each browser
  connects itself; refresh token stays in that browser's localStorage. Redirect URIs registered for
  both site URLs.
- Folders (set in the app): `/Brooks Division/Brooks BOL/Brooks Order Confirmations` and
  `/Calgary BOL/Calgary Order Confirmations` — read recursively, so yearly subfolders
  (e.g. "… – 2025") are included automatically. Start date setting (currently FY2025 = Dec 1, 2024).
- PDFs are made by **Leon** (Grant's Claude tool). Layouts seen: Brooks OC ("ORDER CONFRIMATION",
  sic), newer Calgary OC, older OCs (Yd²/M² columns, "Disclaimer:", "Frieght Charges"), Calgary
  bills of lading ("FOR PRINT", no prices — a priced OC always wins), and occasionally a customer PO
  or Square invoice (read from file name + pre-tax Subtotal, flagged).
- File name wins over the PDF for the order number; dates: if PDF and file name differ by >7 days,
  use the one closer to the Dropbox save time. "January 0, 1900" = blank date.
- Sync runs when someone with Dropbox connected opens Sales Summary (if last sync >12 h) or clicks
  ↻ Refresh. It only reads new/changed PDFs. **Never sync unless orders, settings and sync history
  have loaded** (a blind sync can let a BOL overwrite its priced OC).
- Bump `PARSER_VERSION` in `SalesSummary.jsx` only when a parsing fix must be re-applied to every
  synced PDF (it forces a full re-read on the next Refresh).

## Firestore & read limits (important)
- Free plan = **50,000 reads/day**, resets midnight Pacific (1 am Alberta). It has been hit twice.
  Paul has been advised to move to the pay-as-you-go **Blaze** plan with a small budget alert.
- Orders are stored twice: `salesOrders/{orderNo}` and grouped in **`orderPacks/p0…p47`**; the app
  reads only the 48 packs. Always write via `writeOrder` / `removeOrder` in `orderStore.js`.
- Other docs: `config/salesSettings` (accounts, aliases, skuMap, logo key, folders, since…),
  `config/salesSyncSeen` (files done / too-old files), `config/salesSyncFiles`, `config/salesSyncIssues`,
  `config/users`, `config/auth` (password hash), `customerLogos/*` (manual uploads).
- The original app still reads **every quote** on load (`quotes` collection) — will grow; if reads
  become a problem, pack quotes like orders or move to Blaze.
- Avoid reading the live database from scripts unless needed; one full read of orders ≈ 48 reads
  (packs) — never page through `salesOrders` (≈1,500+ reads).

## Logos
logo.dev CDN: each account's **Website** + publishable key (`pk_…`, saved in Settings). An uploaded
logo on a customer page wins. Dropbox logos were dropped.

## Testing
- No test suite. Test UI changes with Playwright against a Vite dev server whose
  `firebase/firestore` import is aliased to an in-memory mock, seeded with fake orders — never test
  against the live database. Parser changes: run sample PDFs through `parseOrderPdf` with
  `pdfjs-dist/legacy/build/pdf.js` in Node. Bundle with esbuild when Node ESM import paths complain.
- Chromium for Playwright is preinstalled in the cloud environment (`PLAYWRIGHT_BROWSERS_PATH`).
