// ─── Import Grant's spreadsheets into Costs & Margins (in the browser; nothing leaves the computer) ──
// 1. "BMP Combined Cost Calculator" — SUMMARY tab: one row per SKU under a heading per product line
//    (Materials, Labour, Overhead, Price, BC Prepaid). Each line's own tab says its overhead method
//    (% of M+L, $ per roll, $ per wattle) and holds shipping for imported SKUs.
// 2. The erosion blanket working file — Standard/Bio tabs with a column per SKU: itemised materials (Canada)
//    and the USA block (commission, FOB shipping, tariff). Used to add material breakdowns + USA costs.
import { uid, skuKey } from "./model";

const n = v => { if (v == null || v === "") return null; if (typeof v === "number") return v; const x = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isFinite(x) ? x : null; };
const txt = v => String(v ?? "").trim();
const cleanSku = s => txt(s).toUpperCase().replace(/\s*-\s*/g, "-").replace(/\s+/g, "");

function grid(XLSX, ws) {
  const r = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const cell = (R, C) => ws[XLSX.utils.encode_cell({ r: R, c: C })];
  return { r, cell, v: (R, C) => cell(R, C)?.v, f: (R, C) => cell(R, C)?.f || "" };
}
const tierFor = (name, minMargin) => /donut|hydro ?nest/i.test(name) ? "exclusive" : /dewater|wattle/i.test(name) || (minMargin != null && minMargin <= 0.2) ? "commodity" : "manufactured";

export async function readWorkbook(arrayBuffer, fileName) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(arrayBuffer, { type: "array", cellFormula: true });
  const summary = wb.SheetNames.find(s => /^summary$/i.test(s.trim()));
  if (summary) return readCombined(XLSX, wb, summary, fileName);
  const blanket = readBlanketWorking(XLSX, wb, fileName);
  if (blanket.skus.length) return blanket;
  return { kind: "unknown", fileName };
}

// ── 1. Combined Cost Calculator ──────────────────────────────────────────────
function readCombined(XLSX, wb, summaryName, fileName) {
  const g = grid(XLSX, wb.Sheets[summaryName]);
  const lines = [], settings = {};
  let cur = null;
  // Column positions from the heading row (SKU / Product / Materials / Labour / Overhead / Price / BC Prepaid)
  let col = { sku: 1, desc: 2, mat: 3, lab: 4, oh: 6, price: 8, prepaid: 11 };
  for (let R = g.r.s.r; R <= g.r.e.r; R++) {
    const a = txt(g.v(R, 0)), b = txt(g.v(R, 1));
    if (/^tab$/i.test(a) && /^sku$/i.test(b)) {
      for (let C = 0; C <= g.r.e.c; C++) {
        const h = txt(g.v(R, C)).toLowerCase().replace(/\s+/g, " ");
        if (/^sku$/.test(h)) col.sku = C; else if (/^product/.test(h)) col.desc = C; else if (/^materials/.test(h)) col.mat = C; else if (/^labour/.test(h)) col.lab = C;
        else if (/^overhead/.test(h)) col.oh = C; else if (/prepaid/.test(h) && /price/.test(h)) col.prepaid = C; else if (/^price/.test(h)) col.price = C;
      }
      continue;
    }
    if (a && !b && !n(g.v(R, col.mat))) { cur = { id: uid(), name: a, skus: [], _rows: [] }; lines.push(cur); continue; }
    if (!cur || !b) continue;
    const mat = n(g.v(R, col.mat)), lab = n(g.v(R, col.lab));
    if (mat == null && lab == null) continue; // accessories with no cost data
    const price = n(g.v(R, col.price)), prepaid = n(g.v(R, col.prepaid));
    const ref = (g.f(R, col.desc) || g.f(R, col.mat)).match(/'?([^'!]+)'?!\$?[A-Z]+\$?(\d+)/); // detail-tab row, e.g. 'Dewatering Bags'!B7
    cur.skus.push({ id: uid(), sku: cleanSku(b), desc: txt(g.v(R, col.desc)), materials: mat, labour: lab, extra: null,
      manualPrice: { ...(price != null ? { price } : {}), ...(prepaid != null ? { prepaid } : {}) }, _detailRow: ref ? +ref[2] - 1 : null, _ohFormula: g.f(R, col.oh) });
  }
  // Each line's own tab: overhead method + rate, target, shipping column, USD rate
  lines.forEach(line => {
    const tab = wb.SheetNames.find(s => s.trim().toLowerCase() === line.name.toLowerCase());
    let label = "", rate = null, minMargin = null, shipCol = null, headRow = null;
    if (tab) {
      const d = grid(XLSX, wb.Sheets[tab]);
      label = txt(d.v(1, 1)); rate = n(d.v(1, 2)); minMargin = n(d.v(1, 5));
      for (let R = 0; R <= Math.min(d.r.e.r, 15); R++) {
        if (/usd exchange rate/i.test(txt(d.v(R, 0)))) settings.usdRate = settings.usdRate || n(d.v(R, 2));
        if (/^sku$/i.test(txt(d.v(R, 0)))) { headRow = R; for (let C = 0; C <= d.r.e.c; C++) if (/^shipping/i.test(txt(d.v(R, C)))) shipCol = C; }
      }
      if (shipCol != null) line.skus.forEach(s => {
        let R = s._detailRow;
        if (R == null || cleanSku(d.v(R, 0)) !== s.sku) for (let x = (headRow ?? 0) + 1; x <= d.r.e.r; x++) if (cleanSku(d.v(x, 0)) === s.sku) { R = x; break; }
        if (R != null) { const v = n(d.v(R, shipCol)); if (v) s.extra = v; }
      });
    }
    const allPct = line.skus.length && line.skus.every(s => /\*\s*0?\.\d+/.test(s._ohFormula));
    line.method = /per roll/i.test(label) ? "blanket" : /wattle/i.test(label) || (/wattle/i.test(line.name) && /fixed/i.test(label)) ? "wattle" : /fixed/i.test(label) ? "fixed" : "company";
    if (line.method === "fixed") line.fixed = rate;
    if (line.method === "blanket" && rate) settings.blanketRate = settings.blanketRate ?? rate;
    if (line.method === "wattle" && rate) settings.wattleRate = settings.wattleRate ?? rate;
    if (line.method === "company" && rate != null && rate < 1.5 && (allPct || !line.skus.length || true)) settings.companyRate = settings.companyRate ?? Math.round(rate * 1000) / 10;
    line.tier = tierFor(line.name, minMargin);
    line.skus.forEach(s => { delete s._detailRow; delete s._ohFormula; });
    delete line._rows;
  });
  return { kind: "combined", fileName, lines: lines.filter(l => l.skus.length), settings };
}

// ── 2. Erosion blanket working file ──────────────────────────────────────────
function readBlanketWorking(XLSX, wb, fileName) {
  const skus = {}, sheetItems = [];
  wb.SheetNames.forEach(name => {
    const g = grid(XLSX, wb.Sheets[name]);
    let usaRow = null;
    for (let R = g.r.s.r; R <= g.r.e.r; R++) for (let C = 0; C <= Math.min(g.r.e.c, 3); C++) if (/united states/i.test(txt(g.v(R, C)))) { usaRow = usaRow ?? R; }
    for (let R = g.r.s.r; R <= g.r.e.r; R++) for (let C = g.r.s.c; C <= g.r.e.c; C++) {
      const h = txt(g.v(R, C));
      if (!/^BMP\s*-\s*[A-Z0-9.]+$/i.test(h)) continue;
      const sku = cleanSku(h), market = usaRow != null && R > usaRow ? "us" : "ca";
      const rec = skus[skuKey(sku)] ||= { sku, desc: "", items: [], usa: null, labour: null, sheet: name };
      if (market === "ca" && txt(g.v(R + 1, C)) && !rec.desc) rec.desc = txt(g.v(R + 1, C)).replace(/\s+/g, " ");
      let inMaterials = true, price = null, commission = null, fob = null, tariff = null;
      const items = [];
      for (let x = R + 2; x <= Math.min(R + 32, g.r.e.r); x++) {
        const label = txt(g.v(x, C)), val = n(g.v(x, C + 1));
        if (!label) continue;
        if (/^BMP\s*-/i.test(label)) break;
        if (/^total materials/i.test(label)) { inMaterials = false; continue; }
        if (inMaterials) { if (val) items.push({ name: label, qty: 1, price: Math.round(val * 10000) / 10000 }); continue; }
        if (/warehouse labour/i.test(label) && val != null) rec.labour = rec.labour ?? Math.round(val * 100) / 100;
        else if (/commis/i.test(label)) commission = val;
        else if (/shipping/i.test(label)) fob = val;
        else if (/tar+if/i.test(label)) tariff = val;
        else if (/^price:?$/i.test(label)) { price = val; break; }
      }
      if (market === "ca") { rec.items = items; sheetItems.push({ sheet: name, key: skuKey(sku), items }); }
      else rec.usa = { commission: price && commission ? Math.round(commission / price * 1000) / 10 : 0, tariff: price && tariff ? Math.round(tariff / price * 1000) / 10 : 0, fob: fob || 0 };
    }
  });
  // Shared prices: a material with the same name AND price on 2+ SKUs (e.g. Jute) becomes one shared price,
  // so changing it once updates every SKU that uses it. Names used at two prices get the tab name added.
  const shared = [], groups = {};
  sheetItems.forEach(s => s.items.forEach(it => { (groups[it.name + "|" + it.price] ||= []).push({ sheet: s.sheet, it }); }));
  const multi = Object.values(groups).filter(l => l.length >= 2);
  const names = {}; multi.forEach(l => { names[l[0].it.name] = (names[l[0].it.name] || 0) + 1; });
  multi.forEach(list => {
    const nm = list[0].it.name, sheets = [...new Set(list.map(x => x.sheet.replace(/\s*\(.*\)/, "")))];
    const sh = { id: uid(), name: names[nm] > 1 ? `${nm} (${sheets.join(" + ")})` : nm, price: list[0].it.price };
    shared.push(sh);
    list.forEach(x => { x.it.shared = sh.id; delete x.it.price; });
  });
  return { kind: "blanket", fileName, skus: Object.values(skus), shared };
}
