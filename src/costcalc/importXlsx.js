// ─── Cost Calculator: build calculators from the Excel cost calculators ──────
// Runs in the browser on files Paul uploads (cost data never goes into the public code).
// Two layouts are understood:
//  • "column" sheets (Turbidity Curtains, Donuts, Dewatering Bags): row 1 = one column per size,
//    column A = cost lines; "Total Materials:" / "Total Labour" split the sections; overhead
//    "=B26*0.25" → 25% of the Price row (or of Materials + Labour, whichever row it points at).
//  • "block" sheets (Erosion Control Blankets): a "BMP - SDNS08" heading per blanket (label column +
//    value column), Canada section then a USA section; labour/overhead come from the
//    LABOUR AND OVERHEAD LOOKUP tab; cells like "=E5/2" become links to the other blanket.
// Custom one-offs are skipped (any sheet or column with "custom" in its name, Data, Sheet1).
import { uid } from "./model";

const DEPTH = { "2.5": "0250", "5": "0550", "7.5": "7550", "10": "1050", "12.5": "1250", "15": "1550", "17.5": "1750", "20": "2050", "25": "2550", "30": "3050", "40": "4050" };
const CURTAIN_TYPE = { "type 1 industrial": "T1IND", "type 1 dot": "T1DOT", "type 2 dot": "T2DOT", "type 2 industrial": "T2IND", "type 3 dot": "T3DOT" };
const SKIP_SHEET = /^(data|sheet\d*|currency rates|labour and overhead lookup|donuts)$|custom|xr5/i;
const norm = s => String(s ?? "").replace(/\s+/g, " ").trim();
const isNum = v => typeof v === "number" && isFinite(v);
const round = v => Math.round(v * 10000) / 10000;

function sheetCells(XLSX, ws) {
  const r = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const get = (R, C) => ws[XLSX.utils.encode_cell({ r: R, c: C })];
  return { r, get };
}
// "B26*0.25" → { col, row, op, k }; "E5/2" etc.; "E5" alone
function parseRef(XLSX, f) {
  const m = String(f || "").replace(/\$/g, "").match(/^([A-Z]+)(\d+)(?:\s*([*\/])\s*([\d.]+))?$/);
  if (!m) return null;
  const col = XLSX.utils.decode_col(m[1]), row = +m[2] - 1;
  let k = 1; if (m[3] === "*") k = +m[4]; if (m[3] === "/") k = 1 / +m[4];
  return { col, row, k };
}
const classify = label => {
  const l = label.toLowerCase();
  if (/^total materials and labour/.test(l)) return "tml";
  if (/^total materials/.test(l)) return "tm";
  if (/^total labou?r/.test(l)) return "tl";
  if (/^total cost/.test(l)) return "tc";
  if (/^price/.test(l)) return "price";
  if (/profit|margin|usa price|exchange rate|^size:?$/.test(l)) return "skip";
  return "line";
};
const otherName = label => /overhead/i.test(label) ? "Overhead" : /commis/i.test(label) ? "Sales commission" : /tar+if/i.test(label) ? "Tariffs" : /shipping/i.test(label) ? "Shipping" : label;

// ── column layout ──
function columnSheet(XLSX, ws, family, name, skuFor) {
  const { r, get } = sheetCells(XLSX, ws);
  // Column headings: row 1, or the "Size:" row when row 1 is just the title
  let headRow = 0;
  const heads = R => { const out = []; for (let C = 1; C <= r.e.c; C++) { const v = get(R, C)?.v; if (v != null && norm(v)) out.push([C, norm(v)]); } return out; };
  if (!heads(0).length) for (let R = 1; R <= Math.min(r.e.r, 6); R++) if (/^size/i.test(norm(get(R, 0)?.v))) { headRow = R; break; }
  const columns = [], colOf = new Map();
  let lastDepth = "";
  heads(headRow).forEach(([C, h]) => {
    if (/custom|as of|^\d{4}/i.test(h)) return;
    const d = h.match(/^([\d.]+)'\s*depth/i); if (d) lastDepth = d[1];
    const label = /^w\/\s*/i.test(h) && lastDepth ? `${lastDepth}' ${h}` : h;
    const col = { id: uid(), label, sku: skuFor(h) || "" };
    columns.push(col); colOf.set(C, col.id);
  });
  if (!columns.length) return null;
  const rowsInfo = [];
  for (let R = headRow + 1; R <= r.e.r; R++) { const label = norm(get(R, 0)?.v); if (label) rowsInfo.push({ R, label, kind: classify(label) }); }
  const priceRow = rowsInfo.find(x => x.kind === "price")?.R, tmlRow = rowsInfo.find(x => x.kind === "tml")?.R;
  const lines = [], lineOfRow = new Map(), manual = {};
  let section = "materials";
  for (const x of rowsInfo) {
    if (x.kind === "tm") { section = "labour"; continue; }
    if (x.kind === "tl") { section = "other"; continue; }
    if (x.kind === "tml") { section = "other"; continue; }
    if (x.kind === "tc") { section = "done"; continue; }
    if (x.kind === "price") { for (const [C, id] of colOf) { const v = get(x.R, C)?.v; if (isNum(v)) manual[id] = v; } continue; }
    if (x.kind !== "line" || section === "done") continue;
    const line = { id: uid(), section, name: section === "other" ? otherName(x.label) : x.label, basis: "$", market: "both", values: {} };
    // A % line: overhead / commission written as a formula on the Price row or Materials + Labour row
    for (const [C, id] of colOf) {
      const c = get(x.R, C);
      const ref = c?.f ? parseRef(XLSX, c.f) : null;
      if (section === "other" && ref && (ref.row === priceRow || ref.row === tmlRow) && ref.col === C) {
        line.basis = ref.row === priceRow ? "pctPrice" : "pctCost";
        line.values[id] = round(ref.k * 100);
      } else if (isNum(c?.v)) line.values[id] = round(c.v);
    }
    // Keep a plain amount on a % line as a fixed override
    if (line.basis !== "$") for (const [C, id] of colOf) { const c = get(x.R, C); if (!c?.f && isNum(c?.v)) line.values[id] = { fixed: round(c.v) }; }
    lineOfRow.set(x.R, line.id);
    lines.push(line);
  }
  // Same-sheet links like "=E6*0.7"
  for (const ln of lines) {
    const R = [...lineOfRow].find(([, id]) => id === ln.id)?.[0];
    for (const [C, id] of colOf) {
      const c = get(R, C), ref = c?.f ? parseRef(XLSX, c.f) : null;
      if (ln.basis === "$" && ref && colOf.has(ref.col) && lineOfRow.has(ref.row) && !(ref.col === C && ref.row === R))
        ln.values[id] = { link: { col: colOf.get(ref.col), line: lineOfRow.get(ref.row) }, factor: round(ref.k) };
    }
  }
  // Drop lines that are empty everywhere
  const used = lines.filter(l => Object.values(l.values).some(v => (isNum(v) ? v !== 0 : true)) || l.section === "other");
  return { id: uid(), family, name, priceField: "price", columns, lines: used, manualPrice: { ca: manual, us: {} } };
}

// ── block layout (blankets) ──
const SKU_RE = /BMP\s*-\s*([A-Z0-9]+)/i;
function blockSheet(XLSX, ws, family, name) {
  const { r, get } = sheetCells(XLSX, ws);
  const headRows = [];
  for (let R = 0; R <= r.e.r; R++) for (let C = 0; C <= r.e.c; C++) { const v = get(R, C)?.v; if (typeof v === "string" && SKU_RE.test(v)) { if (!headRows.includes(R)) headRows.push(R); } }
  if (!headRows.length) return null;
  const caRow = headRows[0], usRow = headRows.find(R => R > caRow + 5);
  const blocks = R => { const out = []; for (let C = 0; C <= r.e.c; C++) { const v = get(R, C)?.v; const m = typeof v === "string" && v.match(SKU_RE); if (m) out.push({ C, sku: "BMP-" + m[1].toUpperCase() }); } return out; };
  const caBlocks = blocks(caRow);
  const columns = caBlocks.map(b => ({ id: uid(), label: b.sku.replace(/^BMP-/, ""), sku: b.sku }));
  const colOfValueCol = new Map(caBlocks.map((b, i) => [b.C + 1, columns[i].id]));
  const lines = [], byName = new Map(), lineOfRow = new Map();
  const getLine = (section, nm, market, R, C) => {
    const key = section + "|" + nm + "|" + market;
    if (!byName.has(key)) { const l = { id: uid(), section, name: nm, basis: "$", market, values: {} }; byName.set(key, l); lines.push(l); }
    if (R != null && market !== "us") lineOfRow.set(R + "|" + C, byName.get(key).id); // row + value column: each blanket has its own lines
    return byName.get(key);
  };
  const manual = { ca: {}, us: {} };
  const walk = (startRow, blks, market) => {
    blks.forEach((b, i) => {
      const colId = columns.find(c => c.sku === b.sku)?.id; if (!colId) return;
      let section = "materials", priceR = null;
      for (let R = startRow + 1; R <= r.e.r; R++) { if (/^price/i.test(norm(get(R, b.C)?.v))) { priceR = R; break; } if (headRows.includes(R)) break; }
      for (let R = startRow + 1; R <= r.e.r; R++) {
        if (R !== startRow && headRows.includes(R)) break;
        const label = norm(get(R, b.C)?.v); if (!label) continue;
        const kind = classify(label), cell = get(R, b.C + 1);
        if (kind === "tm") { section = "labour"; continue; }
        if (kind === "tl" || kind === "tml") { section = "other"; continue; }
        if (kind === "tc") { section = "done"; continue; }
        if (kind === "price") { if (isNum(cell?.v) && !cell.f) manual[market][colId] = cell.v; continue; }
        if (/^usa price in usd/i.test(label) && isNum(cell?.v)) { manual.us[colId] = cell.v; continue; }
        if (kind !== "line" || section === "done") continue;
        if (market === "us" && section !== "other") continue; // USA uses the same materials and labour
        const lineMarket = section === "other" ? market : "both";
        const ln = getLine(section, section === "other" ? otherName(label) : label, lineMarket, R, b.C + 1);
        const f = String(cell?.f || "");
        if (/LABOUR AND OVERHEAD LOOKUP/i.test(f)) ln.values[colId] = { rate: /A\$?33/.test(f) || /labou?r/i.test(label) ? "blanketLabour" : "blanketOverhead" };
        else if (f && priceR != null && parseRef(XLSX, f)?.row === priceR) { ln.basis = "pctPrice"; ln.values[colId] = round(parseRef(XLSX, f).k * 100); }
        else if (isNum(cell?.v)) ln.values[colId] = round(cell.v);
        if (f && market === "ca") ln._f = { ...(ln._f || {}), [colId]: f };
      }
    });
  };
  walk(caRow, caBlocks, "ca");
  if (usRow != null) walk(usRow, blocks(usRow), "us");
  // Links between blankets (e.g. Single Net mesh = Double Net ÷ 2)
  lines.forEach(ln => {
    Object.entries(ln._f || {}).forEach(([colId, f]) => {
      const ref = parseRef(XLSX, f);
      const target = ref && lineOfRow.get(ref.row + "|" + ref.col);
      if (target && colOfValueCol.has(ref.col)) ln.values[colId] = { link: { col: colOfValueCol.get(ref.col), line: target }, factor: round(ref.k) };
    });
    delete ln._f;
  });
  return { id: uid(), family, name, priceField: "price", columns, lines, manualPrice: manual };
}

// Shared blanket rates from the LABOUR AND OVERHEAD LOOKUP tab, and the USD rate
function blanketRates(XLSX, wb) {
  const ws = wb.Sheets[wb.SheetNames.find(n => /labour and overhead lookup/i.test(n))];
  if (!ws) return null;
  const { r, get } = sheetCells(XLSX, ws);
  const out = { overhead: [] };
  let mode = "";
  for (let R = 0; R <= r.e.r; R++) {
    const a = norm(get(R, 0)?.v);
    if (/^table 1/i.test(a)) mode = "oh"; else if (/^table 2/i.test(a)) mode = "lab"; else if (/^standard|^biodeg|^current|^change/i.test(a)) mode = "";
    const b = get(R, 1)?.v, c = get(R, 2);
    if (mode === "oh" && isNum(b) && isNum(c?.v)) out.overhead.push([b, c.v]);
    if (mode === "lab" && c?.f && !out.wage) { const m = String(c.f).match(/\*\s*([\d.]+)\s*\*\s*([\d.]+)\s*\)/); if (m) { out.wage = +m[1]; out.hours = +m[2]; } }
    const fl = norm(get(R, 5)?.v);
    if (/rolls per day/i.test(fl) && isNum(get(R + 1, 5)?.v)) out.rollsPerDay = get(R + 1, 5).v;
    if (/employee/i.test(fl) && isNum(get(R + 1, 5)?.v)) out.employees = get(R + 1, 5).v;
  }
  return out;
}
function usdRate(XLSX, wb) {
  const ws = wb.Sheets[wb.SheetNames.find(n => /currency rates/i.test(n))];
  const v = ws && ws.B7 && ws.B7.v;
  return isNum(v) && v > 1 && v < 2 ? round(v) : null;
}

// One workbook → { calcs, rates? }
export async function importWorkbook(arrayBuffer, fileName) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(arrayBuffer, { type: "array", cellFormula: true });
  const fn = fileName.toLowerCase();
  const family = /blanket/.test(fn) ? "Erosion Control Blankets" : /turbidity|curtain/.test(fn) ? "Turbidity Curtains" : /donut/.test(fn) ? "Catch Basin Donuts" : /dewater/.test(fn) ? "Dewatering Bags" : fileName.replace(/\.xlsx?$/i, "").replace(/[_-]+/g, " ");
  const calcs = [];
  for (const sheet of wb.SheetNames) {
    const n = sheet.trim();
    const isRevisedDonuts = /^donuts - revised/i.test(n);
    if (SKIP_SHEET.test(n) && !isRevisedDonuts) continue;
    const ws = wb.Sheets[sheet];
    let calc = null;
    if (family === "Erosion Control Blankets") {
      if (/four foot/i.test(n) || /standard|biodeg/i.test(n)) calc = blockSheet(XLSX, ws, family, /four foot/i.test(n) ? "4 ft blankets" : n);
    } else {
      const type = CURTAIN_TYPE[n.toLowerCase()];
      const skuFor = h => {
        const s = norm(h);
        if (type) { const d = s.match(/^([\d.]+)'\s*depth$/i); return d && DEPTH[d[1]] ? `TBC${DEPTH[d[1]]}${type}` : ""; }
        if (/oil boom/i.test(n)) return /^18"/.test(s) ? "OCB1850" : /^12"/.test(s) ? "OCB1250" : "";
        if (/^[A-Z0-9-]{6,}$/.test(s)) return s; // the heading is the SKU itself (donuts)
        return "";
      };
      calc = columnSheet(XLSX, ws, family, isRevisedDonuts ? "Donuts" : n, skuFor);
    }
    if (calc && calc.columns.length && calc.lines.length) calcs.push(calc);
  }
  const blanket = blanketRates(XLSX, wb), rate = usdRate(XLSX, wb);
  return { calcs, blanket, usdRate: rate };
}
