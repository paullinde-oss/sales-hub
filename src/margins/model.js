// ─── Costs & Margins — the maths (Grant's approach, 2026) ────────────────────
// Per SKU:  Materials + Labour = cost of production (M+L)
//           + Overhead (by the product line's method) + Extra (shipping in, etc.) = FULLY LOADED COST
//           Net margin = (price − fully loaded cost) ÷ price, against the line's target tier.
// Overhead methods:  company % of M+L (G&A ÷ revenue, multi-year weighted) · blanket $ per roll and
// wattle $ per wattle (share of Brooks G&A ÷ target volume — same machine, same time for every SKU) ·
// a fixed $ per unit · none.  USA view adds commission % and tariff % of the price + FOB shipping $.
// NO real cost numbers in this file (the code is public) — everything comes from the locked book.

export const METHODS = [
  ["company", "Company rate — % of materials + labour"],
  ["blanket", "Blanket rate — $ per roll"],
  ["wattle", "Wattle rate — $ per wattle"],
  ["fixed", "Fixed $ per unit (this line only)"],
  ["none", "No overhead"],
];
export const TIERS = [["exclusive", "Exclusive / proprietary"], ["manufactured", "Standard manufactured"], ["commodity", "Commodity / imported"]];
export const PRICE_LEVELS = [["price", "Collect / unit"], ["palletPrice", "Pallet / LTL"], ["prepaid", "Prepaid"], ["prepaidPallet", "Prepaid pallet"], ["truckPrice", "FTL"]];

export const uid = () => Math.random().toString(36).slice(2, 10);
const num = v => { if (v === "" || v == null) return null; const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : null; };
// Exact SKU match — dots matter (TBC2.550… = 2.5' is not TBC2550… = 25'); "BMP-" / dashes / spaces ignored
export const skuKey = s => String(s || "").toUpperCase().replace(/[\s\-_]/g, "").replace(/^BMP(?=[A-Z])/, "");

export const emptyBook = () => ({
  settings: {
    company: { years: [], rate: null },              // years: [{ id, year, revenue, ga }]; rate = % used
    brooks: { ga: null, blanketShare: 75, blanketTarget: null, blanketRate: null, wattleTarget: null, wattleRate: null },
    tiers: { exclusive: 50, manufactured: 30, commodity: 20 },
    usdRate: null,
    labourHelper: { employees: null, wage: null, hours: 8, rollsPerDay: null },
  },
  shared: [],   // shared prices: [{ id, name, price }]
  lines: [],    // product lines: [{ id, name, method, fixed, tier, labour (default), usa: { commission, tariff }, skus: [...] }]
  log: [],
});

// ── The yearly rates ─────────────────────────────────────────────────────────
export function rates(settings = {}) {
  const ys = (settings.company?.years || []).filter(y => num(y.revenue) && num(y.ga) != null);
  const rev = ys.reduce((s, y) => s + num(y.revenue), 0), ga = ys.reduce((s, y) => s + num(y.ga), 0);
  const companyCalc = rev ? (ga / rev) * 100 : null;
  const b = settings.brooks || {}, share = num(b.blanketShare) ?? 75, bga = num(b.ga);
  const blanketPool = bga != null ? bga * share / 100 : null, wattlePool = bga != null ? bga * (100 - share) / 100 : null;
  const blanketCalc = blanketPool != null && num(b.blanketTarget) ? blanketPool / num(b.blanketTarget) : null;
  const wattleCalc = wattlePool != null && num(b.wattleTarget) ? wattlePool / num(b.wattleTarget) : null;
  const companyPct = num(settings.company?.rate) ?? (companyCalc != null ? Math.round(companyCalc) : 0);
  const blanketRate = num(b.blanketRate) ?? blanketCalc ?? 0, wattleRate = num(b.wattleRate) ?? wattleCalc ?? 0;
  return {
    companyCalc, companyPct, blanketCalc, blanketRate, wattleCalc, wattleRate, blanketPool, wattlePool,
    blanketTipping: blanketPool != null && blanketRate ? blanketPool / blanketRate : null,
    wattleTipping: wattlePool != null && wattleRate ? wattlePool / wattleRate : null,
    usdRate: num(settings.usdRate) || 1.38,
    tiers: { exclusive: 50, manufactured: 30, commodity: 20, ...(settings.tiers || {}) },
  };
}
export function labourPerRoll(h = {}) {
  const e = num(h.employees), w = num(h.wage), hrs = num(h.hours), r = num(h.rollsPerDay);
  return e && w && hrs && r ? (e * w * hrs) / r : null;
}

// ── One SKU ──────────────────────────────────────────────────────────────────
// A value is a number, or { shared: id, qty } (a shared price × qty)
export function valueOf(v, shared = []) {
  if (v && typeof v === "object" && v.shared) { const s = shared.find(x => x.id === v.shared); return s ? (num(s.price) || 0) * (num(v.qty) ?? 1) : null; }
  return num(v);
}
export function materialsOf(sku, shared) {
  if (Array.isArray(sku.items) && sku.items.length) return sku.items.reduce((s, it) => s + (it.shared ? valueOf({ shared: it.shared, qty: it.qty }, shared) || 0 : (num(it.price) || 0) * (num(it.qty) ?? 1)), 0);
  return num(sku.materials);
}

/**
 * Work out a SKU.  ctx: { rates, shared, market: "ca"|"us", priceOf(sku, market, level) → CAD price or null, level }
 * Returns { materials, labour, ml, overhead, extra, usa, cost (fully loaded), price, profit, margin, markup, target, status }
 */
export function computeSku(line, sku, ctx) {
  const R = ctx.rates, shared = ctx.shared || [];
  const materials = materialsOf(sku, shared);
  const labour = sku.labour !== "" && sku.labour != null ? valueOf(sku.labour, shared) : valueOf(line.labour, shared);
  const ml = (materials || 0) + (labour || 0);
  const overhead = { company: ml * (R.companyPct || 0) / 100, blanket: R.blanketRate || 0, wattle: R.wattleRate || 0, fixed: num(line.fixed) || 0, none: 0 }[line.method || "company"] ?? 0;
  const extra = num(sku.extra) || 0;
  let cost = ml + overhead + extra;
  const listed = ctx.priceOf ? ctx.priceOf(sku.sku, ctx.market || "ca", ctx.level || "price") : null;
  const manual = num((sku.manualPrice || {})[(ctx.market || "ca") === "us" ? "us" : ctx.level || "price"]);
  const price = listed ?? (manual != null ? ((ctx.market === "us" ? manual * R.usdRate : manual)) : null);
  let usa = null;
  if (ctx.market === "us") {
    const u = sku.usa || {}, d = line.usa || {};
    const commissionPct = num(u.commission) ?? num(d.commission) ?? 0, tariffPct = num(u.tariff) ?? num(d.tariff) ?? 0, fob = num(u.fob) ?? num(d.fob) ?? 0;
    usa = { commission: price ? price * commissionPct / 100 : 0, tariff: price ? price * tariffPct / 100 : 0, fob, commissionPct, tariffPct };
    cost += usa.commission + usa.tariff + usa.fob;
  }
  const has = materials != null || labour != null;
  const target = num(sku.target) ?? R.tiers?.[line.tier || "manufactured"] ?? 30;
  const profit = price != null && has ? price - cost : null;
  const margin = price ? (profit != null ? (profit / price) * 100 : null) : null;
  const markup = has && cost > 0 && profit != null ? (profit / cost) * 100 : null;
  const status = !has ? "nocost" : price == null ? "noprice" : margin < 0 ? "loss" : margin < target ? "under" : margin < target + 5 ? "close" : "ok";
  return { materials, labour, ml, overhead, extra, usa, cost: has ? cost : null, price, profit, margin, markup, target, status };
}
export const STATUS = {
  loss: { label: "Losing money", color: "#e8472c", rank: 0 }, under: { label: "Under target", color: "#e8472c", rank: 1 },
  nocost: { label: "No cost yet", color: "#e8a23a", rank: 2 }, noprice: { label: "No price", color: "#e8a23a", rank: 3 },
  close: { label: "Within 5 pts", color: "#e8a23a", rank: 4 }, ok: { label: "OK", color: "#34c77b", rank: 5 },
};

// ── The book → the hub's cost list (config/productCosts; used by reports, product pages, price lists) ──
// Canada fully loaded cost. Keeps the "__" settings already stored there (Income Statement link…).
export function costList(book, oldMap = {}, priceOf, by = "", at = new Date().toISOString()) {
  const R = rates(book.settings), out = {};
  Object.entries(oldMap || {}).forEach(([k, v]) => { if (k.startsWith("__") && k !== "__targets") out[k] = v; });
  (book.lines || []).forEach(line => (line.skus || []).forEach(s => {
    const key = String(s.sku || "").trim().toUpperCase(); if (!key || out[key]) return;
    const r = computeSku(line, s, { rates: R, shared: book.shared, market: "ca", priceOf, level: "price" });
    if (r.cost == null) return;
    const cost = Math.round(r.cost * 100) / 100, old = oldMap?.[key], source = `Costs & Margins › ${line.name}`;
    out[key] = old && Math.abs((old.cost || 0) - cost) < 0.005 && old.source === source && old.target === r.target ? old
      : { cost, ml: Math.round(r.ml * 100) / 100, overhead: Math.round(r.overhead * 100) / 100, target: r.target, source, at, by };
  }));
  return out;
}
export function costListDiffers(a = {}, b = {}) {
  const ks = o => Object.keys(o).filter(k => !k.startsWith("__")).sort();
  const ka = ks(a), kb = ks(b);
  return ka.join("|") !== kb.join("|") || ka.some(k => Math.abs((a[k]?.cost || 0) - (b[k]?.cost || 0)) >= 0.005 || a[k]?.target !== b[k]?.target);
}

// Plain-language list of what changed between two books (for the change log)
export function describeChanges(before, after) {
  const out = [], f = v => v == null || v === "" ? "blank" : typeof v === "object" ? (v.shared ? "shared price" : JSON.stringify(v)) : String(v);
  const S0 = before.settings || {}, S1 = after.settings || {};
  if (JSON.stringify(S0.company) !== JSON.stringify(S1.company)) out.push(["Overhead & targets", "Company rate / years", f(S0.company?.rate), f(S1.company?.rate)]);
  if (JSON.stringify(S0.brooks) !== JSON.stringify(S1.brooks)) out.push(["Overhead & targets", "Brooks rates", `${f(S0.brooks?.blanketRate)}/roll, ${f(S0.brooks?.wattleRate)}/wattle`, `${f(S1.brooks?.blanketRate)}/roll, ${f(S1.brooks?.wattleRate)}/wattle`]);
  if (JSON.stringify(S0.tiers) !== JSON.stringify(S1.tiers)) out.push(["Overhead & targets", "Margin targets", JSON.stringify(S0.tiers || {}), JSON.stringify(S1.tiers || {})]);
  if (f(S0.usdRate) !== f(S1.usdRate)) out.push(["Overhead & targets", "USD rate", f(S0.usdRate), f(S1.usdRate)]);
  const sh0 = new Map((before.shared || []).map(s => [s.id, s]));
  (after.shared || []).forEach(s => { const o = sh0.get(s.id); if (!o) out.push(["Shared prices", `Added ${s.name}`, "", f(s.price)]); else if (o.price !== s.price || o.name !== s.name) out.push(["Shared prices", s.name, f(o.price), f(s.price)]); });
  (before.shared || []).filter(o => !(after.shared || []).some(s => s.id === o.id)).forEach(o => out.push(["Shared prices", `Removed ${o.name}`, f(o.price), ""]));
  const l0 = new Map((before.lines || []).map(l => [l.id, l]));
  (after.lines || []).forEach(l => {
    const o = l0.get(l.id); if (!o) { out.push([l.name, "Product line added", "", `${(l.skus || []).length} SKUs`]); return; }
    ["name", "method", "fixed", "tier"].forEach(k => { if (f(o[k]) !== f(l[k])) out.push([l.name, k === "method" ? "Overhead method" : k === "tier" ? "Target" : k === "fixed" ? "Fixed overhead" : "Name", f(o[k]), f(l[k])]); });
    if (f(o.labour) !== f(l.labour)) out.push([l.name, "Labour (all SKUs)", f(o.labour), f(l.labour)]);
    if (JSON.stringify(o.usa || {}) !== JSON.stringify(l.usa || {})) out.push([l.name, "USA defaults", JSON.stringify(o.usa || {}), JSON.stringify(l.usa || {})]);
    const s0 = new Map((o.skus || []).map(s => [s.id, s]));
    (l.skus || []).forEach(s => {
      const p = s0.get(s.id), name = s.sku || s.desc || "SKU";
      if (!p) { out.push([l.name, `Added ${name}`, "", ""]); return; }
      ["sku", "desc", "materials", "labour", "extra", "target", "perTruck"].forEach(k => { if (f(p[k]) !== f(s[k])) out.push([l.name, `${name} · ${k}`, f(p[k]), f(s[k])]); });
      if (JSON.stringify(p.items || []) !== JSON.stringify(s.items || [])) out.push([l.name, `${name} · materials breakdown`, "", ""]);
      if (JSON.stringify(p.usa || {}) !== JSON.stringify(s.usa || {})) out.push([l.name, `${name} · USA costs`, JSON.stringify(p.usa || {}), JSON.stringify(s.usa || {})]);
      if (JSON.stringify(p.manualPrice || {}) !== JSON.stringify(s.manualPrice || {})) out.push([l.name, `${name} · typed price`, JSON.stringify(p.manualPrice || {}), JSON.stringify(s.manualPrice || {})]);
    });
    (o.skus || []).filter(p => !(l.skus || []).some(s => s.id === p.id)).forEach(p => out.push([l.name, `Removed ${p.sku || p.desc}`, "", ""]));
  });
  (before.lines || []).filter(o => !(after.lines || []).some(l => l.id === o.id)).forEach(o => out.push([o.name, "Product line removed", "", ""]));
  return out;
}
