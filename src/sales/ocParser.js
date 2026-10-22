// ─── Order Confirmation PDF parser ────────────────────────────────────────────
// Reads the PDFs Leon produces and returns a plain order object. Two layouts:
//   • "ORDER CONFRIMATION" (Brooks OCs) — full pricing, freight, Total Before Tax
//   • "BILL OF LADING AND PACKING SLIP" (Calgary "FOR PRINT") — SKUs/qty only
// pdfjsLib is passed in so the same code runs in the browser and in Node tests.

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

const money = s => {
  const n = parseFloat(String(s).replace(/[$,\s]/g, ""));
  return isNaN(n) ? null : n;
};
const isMoney = s => /^\(?-?\$?\s*-?[\d,]+\.\d{2}\)?$/.test(String(s).trim());
const CHARGE_RE = /freight|shipping|delivery|fuel|surcharge|discount|handling|restock/i;
const isInt = s => /^-?[\d,]+(\.\d+)?$/.test(String(s).trim());

// "October 14, 2026" / "Friday, October 9, 2026" → "2026-10-14"
export function parseLongDate(s) {
  const m = String(s || "").toLowerCase().match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!m) return "";
  const mo = MONTHS.indexOf(m[1]) + 1;
  // A blank date in Leon's template prints as "January 0, 1900" — treat it as missing
  if (+m[3] < 2000 || +m[2] < 1 || +m[2] > 31) return "";
  return `${m[3]}-${String(mo).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
}

export function orderNoFrom(s) {
  const m = String(s || "").toUpperCase().match(/\b(BRO|CAL)\s?-?(\d{3,7})\b/);
  return m ? `${m[1]}${m[2]}` : "";
}

// Group text items into visual rows (same baseline, within 3pt), left → right.
export async function pdfToRows(pdfjsLib, data) {
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  const rows = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items
      .filter(it => it.str && it.str.trim())
      .map(it => ({ x: it.transform[4], y: it.transform[5], w: it.width, str: it.str.trim() }))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const pageRows = [];
    for (const it of items) {
      const row = pageRows.find(r => Math.abs(r.y - it.y) <= 3);
      if (row) row.items.push(it); else pageRows.push({ page: p, y: it.y, items: [it] });
    }
    pageRows.forEach(r => { r.items.sort((a, b) => a.x - b.x); r.text = r.items.map(i => i.str).join("  "); });
    pageRows.sort((a, b) => b.y - a.y);
    rows.push(...pageRows);
  }
  doc.destroy && doc.destroy();
  return rows;
}

// Value printed right after a label on the same row, e.g. "Sold To:  Terrafix"
function valueAfter(rows, re) {
  for (const r of rows) {
    const idx = r.items.findIndex(i => re.test(i.str));
    if (idx < 0) continue;
    const it = r.items[idx];
    const inline = it.str.replace(re, "").replace(/^[:#\s.]+/, "").trim();
    if (inline) return inline;
    // next item to the right that is reasonably close (labels are in two columns)
    const next = r.items.slice(idx + 1).find(n => n.x > it.x && n.x - (it.x + it.w) < 160);
    if (next) return next.str.trim();
  }
  return "";
}

function parseOCLayout(rows) {
  const o = {
    format: "oc",
    orderNo: orderNoFrom(valueAfter(rows, /^BOL No\.?/i)),
    date: parseLongDate(valueAfter(rows, /^Date of Order:?/i)),
    po: valueAfter(rows, /^Purchase Order #:?/i),
    pallets: parseInt(valueAfter(rows, /^Total Pallets:?/i)) || parseInt(valueAfter(rows, /^Number of Packages:?/i)) || null,
    freightTerms: valueAfter(rows, /^Freight Terms:?/i),
    customer: valueAfter(rows, /^Sold To:?/i),
    shipTo: valueAfter(rows, /^Ship To:?/i),
    lines: [], charges: [], total: null, hasPricing: true,
  };
  const hi = rows.findIndex(r => /Description/i.test(r.text) && /Part No/i.test(r.text) && /Amount/i.test(r.text));
  // "Total Pallets" on Brooks OCs, "Number of Packages" on Calgary OCs
  const header = hi >= 0 ? rows[hi] : null;
  const colX = name => { const it = header?.items.find(i => new RegExp(name, "i").test(i.str)); return it ? it.x : null; };
  const partX = colX("^Part"), qtyX = colX("^Qty");

  for (let i = (hi >= 0 ? hi + 1 : 0); i < rows.length; i++) {
    const r = rows[i];
    if (/TERMS\s*&\s*CONDITIONS/i.test(r.text)) break;
    const cells = r.items.map(c => c.str).filter(s => s !== "$");
    if (/Total Before Tax/i.test(r.text)) {
      const m = cells.filter(isMoney); o.total = m.length ? money(m[m.length - 1]) : null;
      continue;
    }
    // Charge rows: "(4420-0005) Freight to Delivery Address:  $  1,090.00"
    //              "Freight to Ship To Address  $  -"   (Calgary OCs; "-" = nothing charged)
    const labelIdx = cells.findIndex(c => /:\s*$/.test(c) || CHARGE_RE.test(c));
    const after = labelIdx >= 0 ? cells.slice(labelIdx + 1) : [];
    if (labelIdx >= 0 && cells.filter(isMoney).length < 2 && (after.some(isMoney) || after.some(c => /^-$/.test(c.trim())) || r.items.some(c => c.str === "$"))) {
      const label = cells[labelIdx].replace(/^\([\d-]+\)\s*/, "").replace(/:\s*$/, "").trim();
      const amt = after.some(isMoney) ? money(after.filter(isMoney).pop()) : 0;
      o.charges.push({ label, amount: amt });
      continue;
    }
    // Charge label with its amount on the next line, e.g. "(4420-0005) Freight to Delivery Address:" / "$ 600.00"
    if (labelIdx >= 0 && !cells.some(isMoney) && (/^\(\d{4}-\d{4}\)/.test(cells[0] || "") || /:\s*$/.test(cells[labelIdx]))) {
      const next = rows[i + 1];
      const nextCells = next ? next.items.map(c => c.str).filter(x => x !== "$") : [];
      const amtOnly = nextCells.length && nextCells.every(c => isMoney(c) || /^-$/.test(c.trim()));
      const label = cells[labelIdx].replace(/^\([\d-]+\)\s*/, "").replace(/:\s*$/, "").trim();
      o.charges.push({ label, amount: amtOnly && nextCells.some(isMoney) ? money(nextCells.filter(isMoney).pop()) : 0 });
      if (amtOnly) i++;
      continue;
    }
    if (hi < 0) continue;
    const moneys = cells.filter(isMoney);
    if (moneys.length >= 2) {
      // Description | Part No. | Qty | Price | Amount
      const amount = money(moneys[moneys.length - 1]);
      const price = money(moneys[moneys.length - 2]);
      const items = r.items.filter(c => c.str !== "$" && !isMoney(c.str));
      let qty = null, sku = "", desc = [];
      for (const c of items) {
        if (qtyX != null && Math.abs(c.x - qtyX) < 30 && isInt(c.str)) qty = money(c.str);
        else if (partX != null && c.x >= partX - 40 && (qtyX == null || c.x < qtyX - 15)) { if (!isInt(c.str)) sku = c.str; } // a bare number isn't a part number
        else desc.push(c.str);
      }
      if (qty == null) { const q = items.filter(c => isInt(c.str)).pop(); if (q) { qty = money(q.str); desc = desc.filter(d => d !== q.str); } }
      o.lines.push({ sku: sku.toUpperCase(), desc: desc.join(" ").trim(), qty: qty ?? 0, price: price ?? 0, amount: amount ?? 0 });
    } else if (o.lines.length && cells.length && !o.charges.length && o.total == null && !/^\(\d{4}-\d{4}\)/.test(cells[0])) {
      // wrapped description line
      const last = o.lines[o.lines.length - 1];
      last.desc = (last.desc + " " + cells.join(" ")).trim();
    }
  }
  return o;
}

function parseBOLLayout(rows) {
  const o = {
    format: "bol",
    orderNo: "",
    date: parseLongDate(valueAfter(rows, /^Order Date:?/i)),
    po: valueAfter(rows, /^Purchase Order No\.?/i),
    pallets: null,
    freightTerms: "",
    customer: valueAfter(rows, /^Buyer:?/i),
    shipTo: valueAfter(rows, /^Ship To \/ Consignee:?/i),
    lines: [], charges: [], total: null, hasPricing: false,
  };
  for (const r of rows) { const n = orderNoFrom(r.text); if (n) { o.orderNo = n; break; } }
  // Only read the first copy of the BOL (Leon prints several copies per file)
  const hi = rows.findIndex(r => /PART NUMBER/i.test(r.text));
  if (hi < 0) return o;
  const header = rows[hi];
  const partX = header.items.find(i => /PART NUMBER/i.test(i.str))?.x ?? 160;
  const descX = header.items.find(i => /DESCRIPTION/i.test(i.str))?.x ?? 330;
  const ftX = header.items.find(i => /Freight Terms/i.test(i.str))?.x ?? 510;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    if (/TOTAL PACKAGES/i.test(r.text)) break;
    if (/^(Prepaid|Collect)/i.test(r.items[0]?.str) && r.items[0].x > ftX - 40) { o.freightTerms = r.text.trim(); continue; }
    if (!isInt(r.items[0]?.str)) continue; // item rows start with the package count
    const sku = r.items.find(c => c.x >= partX - 30 && c.x < partX + 80 && /[A-Z0-9]/i.test(c.str) && !isInt(c.str));
    if (!sku) continue;
    const nums = r.items.filter(c => c.x > sku.x + sku.w - 5 && c.x < descX - 40 && isInt(c.str));
    const desc = r.items.filter(c => c.x >= descX - 120 && c.x < ftX - 40 && !isInt(c.str) && c !== sku).map(c => c.str).join(" ");
    o.lines.push({ sku: sku.str.toUpperCase(), desc, qty: nums.length ? money(nums[0].str) : 0, price: 0, amount: 0 });
  }
  if (!o.freightTerms) {
    const ft = rows.slice(hi, hi + 6).flatMap(r => r.items).find(c => /^(Prepaid|Collect)/i.test(c.str));
    if (ft) o.freightTerms = ft.str;
  }
  return o;
}

// "City, PROV A1A 1A1" / "City, ST 12345" → { city, region, country }
export function parseAddress(addr) {
  const s = String(addr || "");
  const ca = s.match(/,?\s*([A-Za-z .'-]+?),?\s+(AB|BC|SK|MB|ON|QC|NB|NS|PE|NL|YT|NT|NU|Alberta|British Columbia|Saskatchewan|Manitoba|Ontario|Quebec|New Brunswick|Nova Scotia)\b,?\s*([A-Z]\d[A-Z]\s?\d[A-Z]\d)?/i);
  const us = s.match(/,?\s*([A-Za-z .'-]+?),?\s+([A-Z]{2})\s+(\d{5})(-\d{4})?\b/);
  if (us && !/^(AB|BC|SK|MB|ON|QC|NB|NS|PE|NL|YT|NT|NU)$/.test(us[2])) {
    return { city: lastWords(us[1]), region: us[2], country: "US" };
  }
  if (/\bUSA\b|United States/i.test(s)) return { city: "", region: "", country: "US" };
  if (ca) return { city: lastWords(ca[1]), region: ca[2].length === 2 ? ca[2].toUpperCase() : ca[2], country: "CA" };
  if (/[A-Z]\d[A-Z]\s?\d[A-Z]\d/i.test(s)) return { city: "", region: "", country: "CA" };
  return { city: "", region: "", country: "" };
}
// "9222 40 Street SE, Calgary" → "Calgary"; drop leading street bits
function lastWords(s) {
  const parts = String(s).split(",").map(x => x.trim()).filter(Boolean);
  let c = parts[parts.length - 1] || "";
  c = c.replace(/^.*\b(St|Street|Rd|Road|Ave|Avenue|Dr|Drive|Cres|Blvd|Way|Hwy|SE|SW|NE|NW|E|W|N|S)\.?\s+/i, "");
  return c.trim();
}

// Main entry: returns an order object (or null if it doesn't look like an OC/BOL)
export async function parseOrderPdf(pdfjsLib, data, fileName = "") {
  const rows = await pdfToRows(pdfjsLib, data);
  const all = rows.map(r => r.text).join("\n");
  let o;
  if (/ORDER\s+CONF(IR|RI)MATION/i.test(all) || /Total Before Tax/i.test(all)) o = parseOCLayout(rows);
  else if (/BILL OF LADING/i.test(all)) o = parseBOLLayout(rows);
  else return null;

  // The file name's number wins if the PDF disagrees, so two files can't overwrite one order
  const nameNo = orderNoFrom(fileName), docNo = o.orderNo;
  if (nameNo) o.orderNo = nameNo;
  if (!o.date) {
    const m = String(fileName).match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i);
    if (m) o.date = parseLongDate(m[0]);
  }
  o.location = o.orderNo.slice(0, 3);
  const addr = parseAddress(o.shipTo);
  o.city = addr.city; o.region = addr.region; o.country = addr.country;
  if (!o.city && /pick\s*-?\s*up/i.test(o.shipTo)) { // "Customer Pickup - Calgary Branch"
    o.city = o.location === "BRO" ? "Brooks (pickup)" : "Calgary (pickup)"; o.region = "AB"; o.country = "CA";
  }
  o.currency = addr.country === "US" ? "USD" : "CAD";
  o.productTotal = round2(o.lines.reduce((s, l) => s + (l.amount || 0), 0));
  o.freight = round2(o.charges.filter(c => /freight|shipping|delivery/i.test(c.label)).reduce((s, c) => s + (c.amount || 0), 0));
  o.otherCharges = round2(o.charges.filter(c => !/freight|shipping|delivery/i.test(c.label)).reduce((s, c) => s + (c.amount || 0), 0));
  if (o.total == null) o.total = round2(o.productTotal + o.freight + o.otherCharges);
  o.warnings = [];
  if (nameNo && docNo && nameNo !== docNo) o.warnings.push(`The OC says ${docNo} but the file is named ${nameNo}`);
  if (!o.orderNo) o.warnings.push("No order number found");
  if (!o.date) o.warnings.push("No order date found");
  if (!o.customer) o.warnings.push("No customer found");
  if (!o.lines.length) o.warnings.push("No line items found");
  if (o.hasPricing && Math.abs(o.productTotal + o.freight + o.otherCharges - o.total) > 0.05)
    o.warnings.push(`Line items + charges (${(o.productTotal + o.freight + o.otherCharges).toFixed(2)}) don't add up to Total Before Tax (${o.total.toFixed(2)})`);
  if (!o.hasPricing) o.warnings.push("Bill of lading — no pricing on this document");
  return o;
}
const round2 = n => Math.round((n || 0) * 100) / 100;
