# BMP Supplies Sales Hub — How It Works

A plain guide to what the Sales Hub is, its areas, and how they connect. Written for people and
for AI assistants ("bots") that need to understand the system.

---

## 1. What it is

The Sales Hub is BMP Supplies' internal sales website (https://saleshub.bmpsupplies.com).
BMP Supplies makes and sells erosion & sediment control products (blankets, wattles,
turbidity curtains, etc.) from two locations: **Brooks** and **Calgary**, Alberta.

The hub is where the team **makes quotes**, **tracks the sales pipeline and leads**, **sees actual
sales** (from order confirmations), and looks up **prices, stock and shipping**.

**People**
- **Paul** — owner and admin. Manages users, the password and settings.
- **John** — the only sales rep. Sees only his own accounts in Sales Summary and doesn't see Leads.
- **Mark, Grant, Jeff** — full access. Their names on customer accounts mean "who holds/looks
  after the account" (shown as **Held by**), not sales rep.
- **Leon** — Grant's AI tool that creates the order confirmation PDFs the hub reads.

**Signing in:** first name + one shared master password (set by Paul in Users & Access).

---

## 2. The big picture — how data flows

```
 Quotes ──────────────► Pipeline (quote follow-up & status) ──► Pipeline & Leads Dashboard
   │   (new-lead quotes) ─► Leads (Lead Tracking)
   │
   │                Order confirmation PDFs in Dropbox (made by Leon)
   │                          │  read automatically
   ▼                          ▼
 Quote Matches  ◄──────  Sales Summary (orders → sales, accounts, reports)
 (order ↔ quote; "Mark Quote Won" updates the quote to the real order)

 Products & Price List ──► used by Quotes (prices) and Sales Summary (clean SKU names)
 Stock Levels / Package Dimensions ◄── Google Sheets
```

- A **quote** is made in Quotes. It then appears in the **Pipeline**, where it's followed up
  and eventually closed as Won, Lost or Cold.
- If a quote is marked **New Lead**, it's also copied into **Leads**, and status changes stay in
  sync between the quote and the lead.
- When the customer actually orders, the **order confirmation (OC)** PDF lands in Dropbox. The
  **Sales Summary** reads it and records the sale.
- **Quote Matches** pairs orders with the quotes they likely came from. Marking a match **Won**
  closes the quote and updates its lines and total to what was actually ordered (including
  freight).

---

## 3. The areas (left-hand menu)

Every area has the same top bar: the area name, then buttons for its sections.

### Quotes
- Create, edit, duplicate, delete, print/PDF and email quotes. Numbers look like **BMP44241**.
- Each quote has: customer name & company, currency (CAD/USD), line items (SKU, description,
  qty, unit price, % change), notes, internal notes, valid-for days (default 30), and status.
- **New Lead** tick + lead type/source → the quote is also added to Leads.
- **Quote list** (left panel), searchable by name, company, date, made by, quote #, SKU, description:
  - **This Week**, then one folder per month of the current fiscal year.
  - Each **finished fiscal year** folds into one folder (e.g. **FY2026**) with month folders inside.
  - Cards show: quote # · name · company · total + currency.
- Print tip: choose **"Save as PDF"** as the print destination so the file name fills in
  automatically.

### Sales Summary
Real sales, built from order confirmation PDFs.
- **Source:** Dropbox folders `/Brooks Division/Brooks BOL/Brooks Order Confirmations` and
  `/Calgary BOL/Calgary Order Confirmations` (subfolders included).
- **When it reads:** when someone with Dropbox connected opens Sales Summary (if the last sync
  was more than 12 hours ago), or clicks **↻ Refresh**. Only new or changed PDFs are read.
- **Order numbers:** **BRO…** = Brooks, **CAL…** = Calgary. Numbers run in sequence, so a gap means a
  missing order. Settings → Missing order numbers lists them; cancelled numbers can be marked "Not used".
- **Sections:**
  - **Dashboard** — this week (Mon–Fri), today, month and fiscal year to date, daily sales.
  - **Orders** — every order, filterable; corrections can be made per order.
  - **Accounts** — every customer, with a page showing this year vs last year, logo, and a
    Year in Review PDF.
  - **Reports** — sales (John's sales, by customer, by product/SKU, customer × product,
    monthly vs last year, by location, Distributors vs End Users, by city), quotes & pipeline
    (win rate, win rate Distributors vs End Users, open pipeline, won quotes → orders), leads,
    and forecasting (forecast, customers due to reorder, product trends, inactive accounts).
    Click a column heading to sort; use "Filter rows…" to narrow down.
  - **Quote Matches** — suggested order ↔ quote pairs, offered only when the totals are within $3,000.
    Quotes already marked Won are skipped.
  - **Settings** (admin) — Dropbox, folders, start date, USD→CAD rate, customer accounts,
    SKU clean-up, missing order numbers, logo key.
- **Top-bar options:** show all in CAD (USD converted), CAD only, or USD only; include/exclude freight.

### Pipeline & Leads
- **Dashboard:**
  - Pipeline row: open quotes and their value, quotes this week and month, win rate this fiscal
    year, quotes needing a follow-up, quotes going cold soon, and a "follow up next" list.
  - Leads row (only for people allowed to see leads): new leads this month, open leads, leads won,
    conversion rate, top lead source, cost per lead.
- **Pipeline:** one tab per person who made quotes. Open quotes move between folders on their
  own, based on days since the last activity (saved or a logged follow-up). With the default
  "Month" setting:
  - **Recent** (< 7 days) → **Check In Soon** (7–14) → **Follow Up Now** (14+).
  - **Overdue / Expires Soon**: the quote expires within 7 days (30-day validity by default).
  - **Followed Up**: a follow-up was logged recently. Logging one resets the clock and the expiry.
  - **Closed:** **Won** / **Lost** are set by hand. **Cold** happens automatically at 60 days, or by hand.
  - The Week / Month / Year buttons make quotes move faster or slower.
- **Leads (Lead Tracking):** leads by calendar year, with company, contact, type, source,
  potential value, status, last contact, quote #, products and notes. Also holds yearly ad spend
  (Google Ads and other marketing), used for cost per lead. Hidden for John.

### Products & Price List
- The master list of products: SKU, name, description, category / sub-category, and prices
  (CAD, plus USD worked out from the exchange rate).
- Quotes use it for SKUs and prices.
- Sales Summary uses it to standardise SKUs on orders.
- Renaming a SKU here also renames it on past orders.

### Stock Levels
- Live stock read from Google Sheets: Calgary stock, Turbidity Curtains, and ECB/Wattles
  (pallets/rolls/trucks).
- Read-only in the hub; update the Google Sheets themselves.
- **↻ Refresh** to reload.

### Shipping
- **Load Calculator** — plan a truck load (flat-bed or dry van) for blankets and wattles. Shows the
  deck layout, how full the truck is, and what else fits.
- **Turbidity Curtain Shipping** — freight cost tables by origin (Calgary/Brooks) and destination,
  with a markup option.
- **Package Dimensions (DIMS)** — size and weight of each product's packaging. Synced from a
  Google Sheet; rows can also be added or imported.

### Users & Access (admin only)
- Add or remove users.
- Tick which areas each person sees: Quotes, Sales Summary, Pipeline & Leads (with a separate
  "Leads section" tick), Products & Price List, Stock Levels, Shipping.
- Sales data scope: "All customers" or "Own accounts only".
- Admin tick.
- **Master password:** view the current one (Show) or change it. Changing it signs everyone out.

---

## 4. Business rules (important for anyone interpreting the numbers)

- **Fiscal year = Dec 1 – Nov 30.** FY2026 = Dec 1, 2025 – Nov 30, 2026.
- **Sales are before tax.** GST/PST/HST are never counted as sales.
- **Freight:** every variant ("FRT", "Shipping to…", etc.) is grouped as "Freight". It counts in
  sales unless "Include freight" is turned off.
- **Fees** (processing, expedited, duty recovery) count as sales, grouped together.
- **Labels** are a product ("LABELS"). **"Credit Applied"** is negative.
- **Currency:** CAD and USD are kept separate. Combined totals convert USD to CAD at the rate in
  Settings. US ship-to addresses are USD.
- **Customer types:** customers on the account list with a holder are **Distributors**; everyone
  else is an **End User** (can be changed per account).
- **"CUSTOM" SKU** can be anything, so it's matched by description.
- **Ship-to cities** roll up to one name each (e.g. every Calgary variant → "Calgary, AB").
- **Win rate** = won ÷ (won + lost + went cold). Open quotes aren't counted.
- **Year in Review PDF** name: `Customer — FY2026 BMP Supplies Year in Review`.

---

## 5. Where things are stored (technical, brief)

- **Firebase Firestore** (project `bmp-sales-hub`): quotes, leads, orders, settings, users,
  password, uploaded customer logos.
- Each browser keeps its own copy of quotes, leads and orders and only downloads changes. This
  keeps it fast and within Firebase's free limit of 50,000 reads a day.
- **Dropbox:** order confirmation PDFs. Each browser connects to Dropbox once.
- **Google Sheets:** stock levels and package dimensions.
- **Code:** GitHub `paullinde-oss/sales-hub`. Changes pushed to `main` go live in about 2 minutes.
  Developer notes are in `CLAUDE.md`.
- Access rules are app-level (what each person sees), not database security.
