// ─── Sales Summary: dates, money, grouping, quote matching ──────────────────
import { normName, matchAccount, customerOf } from "./accounts";
import { cleanOrder } from "./ocParser";
import { normalizeCities } from "./cities";
import { buildCatalog, standardiseLine, lineKey } from "./skus";

// ── Dates (all order dates are "YYYY-MM-DD" strings in local time) ─────────
export const pad = n => String(n).padStart(2, "0");
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const today = () => ymd(new Date());
export const mondayOf = s => { const d = parseYmd(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return ymd(d); };
export const monthStart = s => s.slice(0, 8) + "01";
export const monthEnd = s => { const d = parseYmd(monthStart(s)); d.setMonth(d.getMonth() + 1); d.setDate(0); return ymd(d); };
// Fiscal year ends Nov 30: FY2026 = Dec 1 2025 → Nov 30 2026
export const fyOf = s => { const d = parseYmd(s); return d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear(); };
export const fyStart = fy => `${fy - 1}-12-01`;
export const fyEnd = fy => `${fy}-11-30`;
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = s => { if (!s) return ""; const d = parseYmd(s); return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
export const fmtShort = s => { if (!s) return ""; const d = parseYmd(s); return `${MON[d.getMonth()]} ${d.getDate()}`; };
export const fmtMonth = s => { const d = parseYmd(s); return `${MON[d.getMonth()]} ${d.getFullYear()}`; };
export const weekdayName = s => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parseYmd(s).getDay()];

// Preset ranges used by every filter bar
export function presetRange(key, ref = today()) {
  const fy = fyOf(ref);
  switch (key) {
    case "today": return [ref, ref];
    case "week": { const m = mondayOf(ref); return [m, addDays(m, 6)]; }
    case "lastweek": { const m = addDays(mondayOf(ref), -7); return [m, addDays(m, 6)]; }
    case "month": return [monthStart(ref), monthEnd(ref)];
    case "lastmonth": { const p = addDays(monthStart(ref), -1); return [monthStart(p), monthEnd(p)]; }
    case "fytd": return [fyStart(fy), ref];
    case "fy": return [fyStart(fy), fyEnd(fy)];
    case "lastfy": return [fyStart(fy - 1), fyEnd(fy - 1)];
    case "ytd": return [ref.slice(0, 4) + "-01-01", ref];
    case "all": return ["2000-01-01", "2100-12-31"];
    default: return null;
  }
}
export const PRESETS = [
  ["week", "This week"], ["lastweek", "Last week"], ["month", "This month"], ["lastmonth", "Last month"],
  ["fytd", "Fiscal YTD"], ["fy", "This fiscal year"], ["lastfy", "Last fiscal year"], ["ytd", "Calendar YTD"],
  ["all", "All time"], ["custom", "Custom…"],
];

// ── Money ───────────────────────────────────────────────────────────────────
export const fmtMoney = (n, dp = 0) => (n < 0 ? "-$" : "$") + Math.abs(n || 0).toLocaleString("en-CA", { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const fmtQty = n => (n || 0).toLocaleString("en-CA", { maximumFractionDigits: 2 });

export const orderCurrency = o => o.override?.currency || o.currency || "CAD";
// Sales = Total Before Tax (incl. freight) unless "include freight" is off
export function orderAmount(o, includeFreight = true) {
  if (o.override?.total != null && o.override.total !== "") {
    const t = Number(o.override.total);
    return includeFreight ? t : Math.max(0, t - (o.freight || 0));
  }
  return includeFreight ? (o.total || 0) : (o.productTotal || 0) + (o.otherCharges || 0);
}
export const toCad = (amt, cur, rate) => (cur === "USD" ? amt * rate : amt);

// { cad, usd, combined, count } for a set of orders
export function sumOrders(orders, opts) {
  const r = { cad: 0, usd: 0, combined: 0, count: 0, noPrice: 0 };
  for (const o of orders) {
    const a = orderAmount(o, opts.includeFreight), c = orderCurrency(o);
    if (c === "USD") r.usd += a; else r.cad += a;
    r.combined += toCad(a, c, opts.usdToCad);
    r.count++;
    if (!o.hasPricing && (o.override?.total == null || o.override.total === "")) r.noPrice++;
  }
  return r;
}
// Value shown in single-number views, per the currency mode
export function displayValue(sum, mode) { return mode === "CAD" ? sum.cad : mode === "USD" ? sum.usd : sum.combined; }
export const inCurrencyMode = (o, mode) => mode === "combined" || orderCurrency(o) === mode;

// ── Enrichment: attach customer/account info used everywhere ────────────────
export function enrichOrders(orders, settings, products = []) {
  const accounts = settings.accounts, aliases = settings.aliases || {}, custTypes = settings.custTypes || {};
  // A corrected date wins; orders still without a valid date are left out of the date-based views
  // Fill in a missing/unreadable part number from other orders with the same product description
  const skuByDesc = new Map();
  orders.forEach(o => (o.lines || []).forEach(l => { if (l.sku && l.desc && !/^[\d,.]+$/.test(l.sku)) skuByDesc.set(l.desc.trim().toLowerCase(), l.sku); }));
  const fixLines = lines => (lines || []).map(l => (!l.sku || /^[\d,.]+$/.test(l.sku)) && skuByDesc.has((l.desc || "").trim().toLowerCase()) ? { ...l, sku: skuByDesc.get(l.desc.trim().toLowerCase()) } : l);
  // Match every product line to the Products list (Settings → Product SKU clean-up)
  const skuMap = settings.skuMap || {};
  // Lines marked in the clean-up as not a product at all (tax / freight / fee)
  const kindOverride = l => { const v = skuMap[lineKey(l)]; return ["__tax", "__freight", "__fee"].includes(v) ? v.slice(2) : null; };
  const cleaned = orders.map(o => cleanOrder(o, kindOverride)); // freight/tax/fees typed in as line items on older OCs
  const catalog = buildCatalog(products, cleaned.flatMap(o => o.lines || []));
  return normalizeCities(cleaned) // "CALGARY", "Calgary, Alberta", "Calgary (pickup)" → "Calgary, AB"
    // Fill in a blank/numeric SKU from other orders with the same description first, then standardise it
    .map(o => ({ ...o, lines: fixLines(o.lines).map(l => standardiseLine(l, catalog, skuMap)) }))
    .map(o => ({ ...o, date: o.override?.date || o.date || "", cust: customerOf(o, accounts, aliases, custTypes) }))
    .filter(o => /^20\d\d-\d\d-\d\d$/.test(o.date));
}

export function filterOrders(orders, f) {
  const sku = (f.sku || "").trim().toUpperCase();
  const ord = (f.orderNo || "").trim().toUpperCase();
  const text = (f.text || "").trim().toLowerCase();
  return orders.filter(o => {
    if (f.from && o.date < f.from) return false;
    if (f.to && o.date > f.to) return false;
    if (f.location && f.location !== "all" && o.location !== f.location) return false;
    if (f.customer && o.cust.key !== f.customer) return false;
    if (f.rep && f.rep !== "all" && o.cust.rep !== f.rep) return false;
    if (f.type && f.type !== "all" && o.cust.type !== f.type) return false;
    if (f.currency && f.currency !== "combined" && orderCurrency(o) !== f.currency) return false;
    if (ord && !String(o.orderNo).toUpperCase().includes(ord) && !String(o.po || "").toUpperCase().includes(ord)) return false;
    if (sku && !(o.lines || []).some(l => (l.sku || "").includes(sku) || (l.desc || "").toUpperCase().includes(sku))) return false;
    if (text && !`${o.cust.name} ${o.customer} ${o.city} ${o.orderNo} ${o.po}`.toLowerCase().includes(text)) return false;
    return true;
  });
}

// Group orders (or their lines, for products) into ranked rows
export function groupBy(orders, by, opts) {
  const m = new Map();
  const add = (key, label, extra, amt, cur, qty, orderNo) => {
    let g = m.get(key);
    if (!g) { g = { key, label, ...extra, cad: 0, usd: 0, combined: 0, qty: 0, orders: new Set() }; m.set(key, g); }
    if (cur === "USD") g.usd += amt; else g.cad += amt;
    g.combined += toCad(amt, cur, opts.usdToCad);
    g.qty += qty || 0;
    g.orders.add(orderNo);
  };
  for (const o of orders) {
    const cur = orderCurrency(o);
    if (by === "product") {
      for (const l of o.lines || []) add(l.sku || l.desc, l.sku || "(no SKU)", { desc: l.desc }, l.amount || 0, cur, l.qty, o.orderNo);
      if (opts.includeFreight && o.freight) add("__freight", "Freight", { desc: "Freight charged on OCs" }, o.freight, cur, 0, o.orderNo);
      // Fees (processing, expedited, import duty…) tracked as their own rows; credits shown so totals add up
      for (const c of o.charges || []) if (c.kind === "fee" || c.kind === "credit") add("__" + c.kind + ":" + c.label, c.label, { desc: c.kind === "fee" ? "Fee" : "Credit" }, c.amount || 0, cur, 0, o.orderNo);
      continue;
    }
    const amt = orderAmount(o, opts.includeFreight);
    if (by === "customer") add(o.cust.key, o.cust.name, { rep: o.cust.rep, type: o.cust.type }, amt, cur, 0, o.orderNo);
    else if (by === "rep") add(o.cust.rep, o.cust.rep, {}, amt, cur, 0, o.orderNo);
    else if (by === "location") add(o.location, o.location === "BRO" ? "Brooks (BRO)" : o.location === "CAL" ? "Calgary (CAL)" : o.location || "?", {}, amt, cur, 0, o.orderNo);
    else if (by === "type") add(o.cust.type, o.cust.type, {}, amt, cur, 0, o.orderNo);
    else if (by === "city") add(`${o.city}|${o.region}`, [o.city, o.region].filter(Boolean).join(", ") || "Unknown", {}, amt, cur, 0, o.orderNo);
    else if (by === "month") add(o.date.slice(0, 7), fmtMonth(o.date), {}, amt, cur, 0, o.orderNo);
  }
  return [...m.values()].map(g => ({ ...g, count: g.orders.size })).sort((a, b) => b.combined - a.combined);
}

// ── CSV ─────────────────────────────────────────────────────────────────────
export function downloadCSV(filename, headers, rows) {
  const esc = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers, ...rows].map(r => r.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── Quote ↔ order matching ──────────────────────────────────────────────────
const STOP = new Set(["the", "and", "of", "supply", "supplies", "safety", "environmental", "env", "inc", "ltd"]);
const tokens = s => normName(s).trim().split(" ").filter(t => t.length > 1 && !STOP.has(t));

export function quoteDate(q) {
  const d = q.savedDate ? new Date(q.savedDate) : null;
  if (d && !isNaN(d)) return ymd(d);
  const id = Number(q.id);
  if (id > 1e12) return ymd(new Date(id));
  return "";
}

function nameScore(orderName, quoteName, accounts, aliases) {
  if (!orderName || !quoteName) return 0;
  const a1 = matchAccount(orderName, accounts, aliases), a2 = matchAccount(quoteName, accounts, aliases);
  if (a1 && a2) return a1.name === a2.name ? 1 : 0;
  const t1 = tokens(orderName), t2 = tokens(quoteName);
  if (!t1.length || !t2.length) return 0;
  const inter = t1.filter(t => t2.includes(t)).length;
  return inter / Math.min(t1.length, t2.length);
}

const MATCH_TOLERANCE = 3000; // CAD
// Returns [{ order, quote, score, reasons }] best-first
export function findQuoteMatches(orders, quotes, settings) {
  const links = settings.quoteLinks || {}, dismissed = settings.dismissedMatches || {};
  const linkedQuotes = new Set(Object.values(links).map(String));
  // Quotes already marked Won are left out — they've been dealt with
  const qs = (quotes || []).filter(q => q.saved !== false && q.quoteStatus !== "won" && (q.lineItems || []).length).map(q => ({
    q, date: quoteDate(q), name: q.company || q.name || "",
    skus: new Set((q.lineItems || []).map(li => String(li.sku || "").toUpperCase().trim()).filter(Boolean)),
    total: (q.lineItems || []).reduce((s, li) => s + (parseFloat(li.unitPrice) || 0) * (parseInt(li.qty) || 0), 0),
    currency: q.currency || "CAD",
  }));
  const rate = Number(settings.usdToCad) || 1.37;
  const inCad = (amt, cur) => (cur === "USD" ? amt * rate : amt);
  const out = [];
  for (const o of orders) {
    if (links[o.orderNo] || !o.hasPricing) continue; // no pricing on a BOL, so nothing to compare
    const oskus = [...new Set((o.lines || []).map(l => l.sku).filter(Boolean))];
    let best = null;
    for (const x of qs) {
      if (linkedQuotes.has(String(x.q.id)) || dismissed[`${o.orderNo}|${x.q.id}`]) continue;
      if (x.date && o.date) {
        const gap = daysBetween(x.date, o.date);
        if (gap < -3 || gap > 240) continue; // quote must come before (or right around) the order
      }
      // Dollar amounts must be close (within $3,000), with or without freight
      const oc = orderCurrency(o);
      const qv = inCad(x.total, x.currency);
      const diff = Math.min(Math.abs(qv - inCad(o.productTotal || 0, oc)), Math.abs(qv - inCad(o.total || 0, oc)));
      if (!x.total || diff > MATCH_TOLERANCE) continue;
      const ns = Math.max(nameScore(o.customer, x.name, settings.accounts, settings.aliases), nameScore(o.cust.name, x.name, settings.accounts, settings.aliases));
      const hit = oskus.filter(s => x.skus.has(s)).length;
      const ss = oskus.length ? hit / oskus.length : 0;
      const score = ns * 0.55 + ss * 0.45;
      if (ns < 0.5 || score < 0.6) continue;
      const reasons = [];
      reasons.push(ns >= 1 ? "Same customer" : "Similar customer name");
      if (oskus.length) reasons.push(`${hit} of ${oskus.length} SKU${oskus.length > 1 ? "s" : ""} on the quote`);
      reasons.push(diff < 1 ? "Same dollar amount" : `Amounts within ${fmtMoney(diff)}`);
      if (x.date && o.date) reasons.push(`Quoted ${daysBetween(x.date, o.date)} days before order`);
      const cand = { order: o, quote: x.q, quoteDate: x.date, score, reasons };
      if (!best || score > best.score) best = cand;
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.score - a.score || (b.order.date > a.order.date ? 1 : -1));
}
