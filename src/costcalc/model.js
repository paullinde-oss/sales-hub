// ─── Cost Calculator: data model and maths ───────────────────────────────────
// Everything is stored ENCRYPTED with the cost key (see store.js) — it's cost data.
//
// book = {
//   rates: { usdRate, blanket: { employees, wage, hours, rollsPerDay, overhead: [[rollsPerDay, $/roll], …] },
//            custom: [{ id, name, value }] },
//   calcs: [calc], log: [{ at, by, calc, what, from, to }]
// }
// calc = { id, family, name, priceField, columns: [{ id, label, sku }], lines: [line], manualPrice: { ca: {colId: $}, us: {colId: $ USD} } }
// line = { id, section: "materials" | "labour" | "other", name, basis: "$" | "pctPrice" | "pctCost",
//          market: "both" | "ca" | "us", values: { colId: cell } }
// cell = number                         — dollars (or the % for a % line)
//      | { link: { col, line }, factor } — another cell × factor (e.g. 70% of the straw in SDNS08)
//      | { rate: "blanketLabour" | "blanketOverhead" | "<custom id>", factor }
//      | { fixed: $ }                    — a plain dollar amount on a % line (one-off override)
// Price: the current price list (CAD for Canada; USA = USD price list × the USD rate), or a typed price
// when the SKU isn't on the list. Margin = profit ÷ price (markup = profit ÷ cost shown small).

export const SECTIONS = [["materials", "Materials"], ["labour", "Labour"], ["other", "Overhead & other costs"]];
export const uid = () => Math.random().toString(36).slice(2, 9);
const num = v => (typeof v === "number" && isFinite(v) ? v : 0);

export function rateValues(rates) {
  const b = rates?.blanket || {};
  const out = { usdRate: num(rates?.usdRate) || 1.38 };
  const rolls = num(b.rollsPerDay);
  out.blanketLabour = rolls ? (num(b.employees) * num(b.wage) * num(b.hours)) / rolls : 0;
  // Overhead per roll: the table row for this many rolls a day (closest row at or below it)
  const table = (b.overhead || []).filter(r => r && num(r[0])).sort((x, y) => y[0] - x[0]);
  const row = table.find(r => r[0] <= rolls) || table[table.length - 1];
  out.blanketOverhead = row ? num(row[1]) : 0;
  (rates?.custom || []).forEach(r => { out[r.id] = num(r.value); });
  return out;
}
export const RATE_LABELS = { blanketLabour: "Blanket labour per roll", blanketOverhead: "Blanket overhead per roll", usdRate: "USD rate" };

const lineIn = (line, market) => !line.market || line.market === "both" || line.market === market;

// Work out one calculator for one market ("ca" | "us"). priceOf(sku, market) → CAD price or null.
export function compute(calc, rates, market, priceOf) {
  const R = rateValues(rates);
  const lines = calc.lines.filter(l => lineIn(l, market));
  const byId = new Map(calc.lines.map(l => [l.id, l]));
  const cols = {};
  for (const col of calc.columns) {
    const manual = calc.manualPrice?.[market]?.[col.id];
    const listed = col.sku ? priceOf(col.sku, market) : null;
    const price = listed != null ? listed : (num(manual) ? (market === "us" ? manual * R.usdRate : manual) : null);
    const memo = new Map();
    // Value of a cell in dollars-or-percent (as typed / linked)
    const raw = (lineId, colId, depth = 0) => {
      const key = lineId + "|" + colId;
      if (memo.has(key)) return memo.get(key);
      const ln = byId.get(lineId), c = ln?.values?.[colId];
      let v = 0;
      if (depth > 20) v = 0; // a loop of links — stop
      else if (typeof c === "number") v = c;
      else if (c && c.link) v = raw(c.link.line, c.link.col, depth + 1) * (c.factor ?? 1);
      else if (c && c.rate) v = num(R[c.rate]) * (c.factor ?? 1);
      else if (c && typeof c.fixed === "number") v = c.fixed;
      memo.set(key, v);
      return v;
    };
    const cells = {};
    let materials = 0, labour = 0;
    lines.forEach(l => { if (l.section !== "other") { const v = raw(l.id, col.id); cells[l.id] = v; if (l.section === "labour") labour += v; else materials += v; } });
    const base = materials + labour;
    let other = 0;
    lines.filter(l => l.section === "other").forEach(l => {
      const c = l.values?.[col.id];
      let v;
      if (l.basis === "pctPrice" && !(c && typeof c.fixed === "number")) v = (raw(l.id, col.id) / 100) * (price || 0);
      else if (l.basis === "pctCost" && !(c && typeof c.fixed === "number")) v = (raw(l.id, col.id) / 100) * base;
      else v = raw(l.id, col.id);
      cells[l.id] = v; other += v;
    });
    const total = base + other;
    const profit = price != null ? price - total : null;
    cols[col.id] = {
      cells, materials, labour, base, other, total, price, listed: listed != null,
      profit, margin: price ? (profit / price) * 100 : null, markup: total ? (profit / total) * 100 : null,
      beforeOverhead: price != null ? price - base : null,
    };
  }
  return cols;
}

// Canada totals for every SKU in the book → the hub's product costs
export function costsFromBook(book, priceOf) {
  const out = {};
  (book.calcs || []).filter(c => c.forCosts !== false).forEach(calc => {
    const r = compute(calc, book.rates, "ca", priceOf);
    calc.columns.forEach(col => { if (col.sku && r[col.id]?.total > 0 && !out[col.sku.toUpperCase()]) out[col.sku.toUpperCase()] = { cost: Math.round(r[col.id].total * 100) / 100, source: `Cost Calculator › ${calc.family} › ${calc.name}` }; });
  });
  return out;
}

// Plain-language description of a cell (for the change log and tooltips)
export function describeCell(calc, cell) {
  if (cell == null || cell === "") return "blank";
  if (typeof cell === "number") return String(Math.round(cell * 10000) / 10000);
  if (cell.fixed != null) return `$${cell.fixed} (fixed)`;
  if (cell.rate) return `${RATE_LABELS[cell.rate] || cell.rate}${cell.factor != null && cell.factor !== 1 ? " × " + cell.factor : ""}`;
  if (cell.link) {
    const col = calc.columns.find(c => c.id === cell.link.col), ln = calc.lines.find(l => l.id === cell.link.line);
    return `${ln?.name || "?"} of ${col?.sku || col?.label || "?"}${cell.factor != null && cell.factor !== 1 ? " × " + cell.factor : ""}`;
  }
  return "?";
}

export function newCalc(family, name) {
  const c1 = uid();
  return {
    id: uid(), family, name, priceField: "price", columns: [{ id: c1, label: "New size", sku: "" }],
    lines: [
      { id: uid(), section: "materials", name: "Material", basis: "$", market: "both", values: {} },
      { id: uid(), section: "labour", name: "Labour", basis: "$", market: "both", values: {} },
      { id: uid(), section: "other", name: "Overhead", basis: "pctPrice", market: "both", values: { [c1]: 25 } },
      { id: uid(), section: "other", name: "Sales commission", basis: "$", market: "both", values: {} },
      { id: uid(), section: "other", name: "Shipping", basis: "$", market: "both", values: {} },
    ], manualPrice: { ca: {}, us: {} },
  };
}
// Empty on purpose: real rates are cost data and the code is public — they come from the Excel import
export const DEFAULT_RATES = { usdRate: 1.38, blanket: { employees: 0, wage: 0, hours: 8, rollsPerDay: 0, overhead: [] }, custom: [] };
