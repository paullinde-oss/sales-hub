// ─── Price list versions ─────────────────────────────────────────────────────
// Each yearly (or mid-year) price list is a document in Firestore "priceLists":
//   status "current" (what quotes use — also copied to config/productsCAD), "draft" (being built
//   on the side by Paul / Mark / Jeff) or "archived" (history, read-only).
// A draft stores only its decisions — % increases by category or SKU, exact prices, which SKUs
// are on the customer-facing list, notes, customer price lists — and works them out on top of the
// live current product list, so SKUs added during the year carry into it automatically.
// When it's made active, the worked-out prices are frozen into the document.

export const PRICE_FIELDS = ["price", "palletPrice", "prepaid", "prepaidPallet", "truckPrice"];
export const FIELD_LABEL = { price: "Price / Package", palletPrice: "Pallet / LTL", prepaid: "Prepaid", prepaidPallet: "Prepaid Pallet", truckPrice: "FTL" };

const num = v => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : n; };
export const priceNum = num;
export const roundDollar = n => Math.round(n);
export const up = s => String(s || "").trim().toUpperCase();

// SKUs on the customer price list as of 2026 V2 (from Paul's master spreadsheet)
export const MASTER_2026_V2_SKUS = ["4CBD2416HF", "4CBD2416LF", "4CBD2424HF", "4CBD2424LF", "4CBD21DIAHF", "4CBD24DIAHF", "SSC2118HF", "DDS2424OF", "DGD3648", "CBW8009", "CIF6048", "OOF2230", "OOF4806", "SPB1206G", "SBG2509", "SBG0506", "SBG0510", "SBG0515", "SBG1010", "SBG1015", "SBG1020", "SBG2020", "SBG2030", "HN2027", "HN3927", "HN7945", "HNL2027", "HNL3927", "HNL7954", "SCB0404", "SCB0406", "SCB0708", "TBC0550T1IND", "TBC7550T1IND", "TBC1050T1IND", "TBC0550T1DOT", "TBC7550T1DOT", "TBC1050T1DOT", "TBC0550T2IND", "TBC7550T2IND", "TBC1050T2IND", "TBC0550T2DOT", "TBC7550T2DOT", "TBC1050T2DOT", "TBC0550T3DOT", "TBC7550T3DOT", "TBC1050T3DOT", "OCB1850", "OCB1250", "BAK14LBS", "BAK25LBS", "BAK40LBS", "TOWBRI12", "TOWBRI24", "BMP-SSNS08", "BMP-SSNS16", "BMP-SSNS08JR", "BMP-SSNS16JR", "BMP-SDNS08", "BMP-SDNS16", "BMP-SDNS08JR", "BMP-SDNS16JR", "BMP-SDNSC08", "BMP-SDNSC16", "BMP-SDNSC08JR", "BMP-SDNSC16JR", "BMP-SDNC08", "BMP-SDNC16", "BMP-SDNC08JR", "BMP-SDNC16JR", "BMP-BDNS08", "BMP-BDNS16", "BMP-BDNS08JR", "BMP-BDNS16JR", "BMP-BDNSC08", "BMP-BDNSC16", "BMP-BDNSC08JR", "BMP-BDNSC16JR", "BMP-BDNC08", "BMP-BDNC16", "BMP-BDNC08JR", "BMP-BDNC16JR", "BMPSTK06", "BMPSTK12", "BMPSTP06", "BMP-SDNAE08", "BMP-SDNAE16", "BMP-BSNAE08", "BMP-BSNAE16", "BMP-BDNAE08", "BMP-BDNAE16", "BMP-HVDNAE", "BAEW0925", "BAEW1220", "BMP-TRMP08", "BMP-TRMP16", "BMP-TRMPC08", "BMP-TRMPC16", "BMP-TRMPS08", "BMP-TRMPS16", "STW0925", "STW1220", "RDSTW0925", "RDSTW1220", "BSTW0925", "BSTW1220", "BMPSTK18", "BMPSTK24"];

export const DEFAULT_NOTES = {
  intro: "Thank you for being a valued BMP Supplies partner. This price list is intended for your organization only — please do not share it outside your organization.",
  links: [
    { label: "Product documents & spec sheets (Download Centre)", url: "https://www.bmpsupplies.com/download-centre" },
    { label: "Turbidity Curtain selector tool", url: "https://www.bmpsupplies.com/turbidity-curtains-selector-tool" },
    { label: "Compare Turbidity Curtain specifications", url: "https://www.bmpsupplies.com/turbidity-curtains-compare" },
  ],
  boxes: [
    { title: "Catch Basin Protection", items: ["Minimum orders of $1,000", "Prices are per individual item", "No split packages"] },
    { title: "Spill Solutions", items: ["HydroNest products: contact BMP to request a freight quote"] },
    { title: "Turbidity Curtains", items: ["Custom lengths, depths, and materials available, made to specification", "For more than one pallet, please contact sales@bmpsupplies.com for a quote"] },
    { title: "Erosion Control Blankets", items: ["Pricing is for single FTL or LTL orders only. For multiple truckloads please contact sales@bmpsupplies.com", "To receive FTL pricing, at least half the truck must be filled with Erosion Control Blankets"] },
    { title: "Straw Wattles", items: ["All straw is weed-free certified"] },
    { title: "Truckload (FTL) Quantities", items: ["ECB 8' wide rolls — 24 pallets per truckload (600 rolls)", "9\" diameter wattles — 26 pallets per truckload (364 logs)", "12\" diameter wattles — 26 pallets per truckload (312 logs)"] },
  ],
};

// % increase for one SKU: a SKU-specific % wins over its category's %
export function pctFor(v, sku, cat) {
  const s = v.rules?.skus?.[up(sku)];
  if (s !== undefined && s !== null && s !== "") return Number(s) || 0;
  return Number(v.rules?.categories?.[cat] ?? 0) || 0;
}

// One price: an exact price typed in wins; otherwise base × (1 + %), rounded to the whole dollar
// (Paul: whole dollars from the 2027 list on — so prices with no increase are rounded too)
function newPrice(base, pct, exact) {
  if (exact !== undefined && exact !== null && exact !== "") return num(exact);
  const b = num(base);
  if (b === null || b <= 0) return base === undefined ? "" : base;
  return roundDollar(b * (1 + (pct || 0) / 100));
}

// The version's products with its prices worked out: the live list for the current version, the
// frozen list for history, and for drafts the live list with the draft's increases applied.
export function versionProducts(v, liveProducts, categories = {}) {
  if (v.status === "current") return liveProducts || []; // the current list is edited live on the Products page
  if (v.status !== "draft") return Array.isArray(v.products) ? v.products : [];
  return (liveProducts || []).map(p => {
    const cat = categories[p.sku] || p.category || "Uncategorized";
    const pct = pctFor(v, p.sku, cat), ov = v.overrides?.[up(p.sku)] || {};
    const out = { ...p };
    PRICE_FIELDS.forEach(f => { out[f] = newPrice(p[f], pct, ov[f]); });
    return out;
  });
}

// Customer price lists (e.g. White Cap) live in each version: { name: { terms, prices: { SKU: { field: price } } } }.
// Only prices that differ from the master are stored. A draft copies them from the current
// version and gives them the same % increase as the master SKU, unless an exact price is typed
// (customers[name].exact[SKU][field]).
export function customerLists(v, catOf = () => "") {
  const all = v.customers || {};
  if (v.status !== "draft") return all;
  const out = {};
  Object.entries(all).forEach(([name, l]) => {
    const prices = {};
    const skus = new Set([...Object.keys(l.prices || {}), ...Object.keys(l.exact || {})]);
    skus.forEach(sku => {
      const base = (l.prices || {})[sku] || {}, ex = (l.exact || {})[sku] || {};
      prices[sku] = {};
      new Set([...Object.keys(base), ...Object.keys(ex)]).forEach(f => { prices[sku][f] = newPrice(base[f], pctFor(v, sku, catOf(sku)), ex[f]); });
    });
    out[name] = { terms: l.terms || [name], prices };
  });
  return out;
}

// Does a company name belong to one of the customer price lists?
const norm = s => " " + String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim() + " ";
export function customerListFor(lists, company) {
  const c = norm(company);
  if (!c.trim()) return null;
  for (const [name, l] of Object.entries(lists || {})) {
    if ((l.terms || [name]).some(t => norm(t).trim() && c.includes(norm(t)))) return { name, prices: l.prices || {} };
  }
  return null;
}

// Products with a customer's special prices laid over the master prices
export function withCustomerPrices(products, list) {
  if (!list) return products;
  const p = list.prices || {};
  return products.map(x => { const o = p[up(x.sku)]; return o ? { ...x, ...o, customerPrice: true } : x; });
}

// SKU → is it on the customer-facing price list?
export const onList = (v, sku) => (v.onList || {})[up(sku)] === true;

export const fmtEffective = iso => { if (!iso) return ""; const d = new Date(iso + "T12:00:00"); return isNaN(d) ? iso : d.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" }); };
export const yearOf = v => String(v.year || (v.effectiveDate || "").slice(0, 4) || new Date().getFullYear());

// ── Customer price list import (CSV) ─────────────────────────────────────────
// Accepts either the hub's own CSV export (columns by heading) or Paul's price list spreadsheet
// saved as CSV (a row per SKU: quantities, then the prices in the sheet's order —
// FTL then LTL for blankets/wattles; Collect Package, Collect Pallet, Prepaid Package, Prepaid Pallet
// for catch basin etc.; one price for curtains/TRMs).
export function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(x => x.trim()));
}

const HEAD = [["truckPrice", /ftl/i], ["prepaidPallet", /prepaid\s*pallet/i], ["prepaid", /prepaid/i], ["palletPrice", /pallet\s*\/\s*ltl|ltl|pallet price/i], ["price", /price/i]];
// products: the version's master products. Returns { rows: [{ sku, prices }], unknown: [sku…] }
export function readPriceCSV(text, products) {
  const rows = parseCSV(text);
  const bySku = new Map(products.map(p => [up(p.sku), p]));
  const out = [], unknown = [];
  // Hub export: a header row naming the price columns
  const hi = rows.findIndex(r => r.some(c => /^sku$/i.test(c)) && r.some(c => /price|ftl|ltl|prepaid/i.test(c)) && r.some(c => /\(cad\)|\(usd\)|price \/ package/i.test(c)));
  if (hi >= 0) {
    const h = rows[hi], skuCol = h.findIndex(c => /^sku$/i.test(c));
    const cols = h.map(c => (/qty/i.test(c) ? null : HEAD.find(([, re]) => re.test(c))?.[0] || null));
    rows.slice(hi + 1).forEach(r => {
      const sku = up(r[skuCol]); if (!sku) return;
      if (!bySku.has(sku)) { unknown.push(sku); return; }
      const prices = {};
      cols.forEach((f, i) => { if (f) { const n = num(r[i]); if (n !== null && n > 0) prices[f] = n; } });
      if (Object.keys(prices).length) out.push({ sku, prices });
    });
    return { rows: out, unknown };
  }
  // Price list spreadsheet layout
  rows.forEach(r => {
    const i = r.findIndex(c => bySku.has(up(c)));
    if (i < 0) { const c = r.find(x => /^[A-Z0-9][A-Z0-9-]{4,}$/.test(x) && /\d/.test(x) && /[A-Z]/.test(x)); if (c && r.slice(r.indexOf(c) + 1).some(x => num(x) > 0)) unknown.push(c); return; }
    const p = bySku.get(up(r[i]));
    const nums = r.slice(i + 1).map(num).filter(n => n !== null && n > 0);
    const used = PRICE_FIELDS.filter(f => (num(p[f]) || 0) > 0);
    if (!nums.length || !used.length) return;
    const distinct = new Set(used.map(f => num(p[f])));
    let prices = {};
    if (distinct.size === 1) used.forEach(f => { prices[f] = nums[nums.length - 1]; }); // one price (curtains, TRMs, HydroNest)
    else {
      const order = used.includes("truckPrice") ? ["truckPrice", "palletPrice"].filter(f => used.includes(f)) : ["price", "palletPrice", "prepaid", "prepaidPallet"].filter(f => used.includes(f));
      const vals = nums.slice(-order.length);
      if (vals.length < order.length) return;
      order.forEach((f, k) => { prices[f] = vals[k]; });
    }
    out.push({ sku: up(p.sku), prices });
  });
  return { rows: out, unknown: [...new Set(unknown)] };
}
