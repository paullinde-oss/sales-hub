// ─── Customer-facing price list (HTML printed to PDF) ────────────────────────
// Page 1: all the notes (Paul: people only glance, so everything important goes up front).
// Then one section per category, with the price columns that category uses — named like the
// master spreadsheet (Collect/Prepaid Package & Pallet, FTL/LTL, Price per section …).
import { PRICE_FIELDS, priceNum } from "./priceLists";

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Column set for a category, based on which prices its products actually have
function columns(prods) {
  const has = f => prods.some(p => (priceNum(p[f]) || 0) > 0);
  const qty = [];
  if (prods.some(p => p.pkg)) qty.push(["pkg", "Package Qty"]);
  if (prods.some(p => p.pallet)) qty.push(["pallet", "Pallet Qty"]);
  let price;
  if (has("truckPrice")) price = [["truckPrice", "FTL Price"], ...(has("palletPrice") ? [["palletPrice", "LTL Price"]] : [])];
  else if (has("prepaid") || has("prepaidPallet")) price = [["price", "Collect — Package"], ["palletPrice", "Collect — Pallet"], ["prepaid", "Prepaid — Package"], ["prepaidPallet", "Prepaid — Pallet"]];
  else price = [["price", has("palletPrice") ? "Price / Package" : "Price"], ...(has("palletPrice") ? [["palletPrice", "Pallet Price"]] : [])];
  return { qty, price };
}

export function buildPriceListHTML({ products, categories = {}, subCategories = {}, subCatDefs = {}, categoryOrder = [], notes = {}, year, versionLabel, effectiveText, customerName, currency = "CAD", usdMultiplier = 1, logo }) {
  const conv = v => { const n = priceNum(v); if (n === null || n <= 0) return null; return currency === "USD" ? Math.round(n * usdMultiplier) : n; };
  const money = v => { const n = conv(v); return n === null ? "—" : "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  // Categories in the Products page order
  const catOf = p => categories[p.sku] || p.category || "Other";
  const present = [...new Set(products.map(catOf))];
  const order = [...(categoryOrder || []).filter(c => present.includes(c)), ...present.filter(c => !(categoryOrder || []).includes(c)).sort()];

  const table = prods => {
    const { qty, price } = columns(prods);
    const th = (t, w, al = "center") => `<th style="padding:5px 6px;text-align:${al};font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:#fff;font-weight:700;border:1px solid #333;${w ? `width:${w};` : ""}">${t}</th>`;
    const head = th("SKU", "105px", "left") + th("Product Description", "", "left") + qty.map(([, l]) => th(l, "62px")).join("") + price.map(([, l]) => th(l, "78px")).join("");
    const td = "font-size:9.5px;padding:4px 6px;border:1px solid #ddd;vertical-align:middle";
    const rows = prods.map((p, i) => `<tr style="background:${i % 2 ? "#f6f6f4" : "#fff"}">
      <td style="${td};font-family:monospace;font-size:9px;white-space:nowrap">${esc(p.sku)}</td>
      <td style="${td}">${esc(p.description || p.product)}</td>
      ${qty.map(([f]) => `<td style="${td};text-align:center">${esc(p[f] || "—")}</td>`).join("")}
      ${price.map(([f]) => `<td style="${td};text-align:right;white-space:nowrap">${money(p[f])}</td>`).join("")}
    </tr>`).join("");
    return `<table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr style="background:#1a1a1a">${head}</tr></thead><tbody>${rows}</tbody></table>`;
  };

  const sections = order.map(cat => {
    const prods = products.filter(p => catOf(p) === cat);
    if (!prods.length) return "";
    const defs = subCatDefs?.[cat] || [];
    const groups = defs.length ? [...defs.map(sub => ({ sub, prods: prods.filter(p => subCategories[p.sku] === sub) })), { sub: null, prods: prods.filter(p => !defs.includes(subCategories[p.sku])) }].filter(g => g.prods.length) : [{ sub: null, prods }];
    return `<div style="margin-bottom:14px;break-inside:avoid-page">
      <div style="background:#1a1a1a;color:#fff;text-align:center;padding:7px;font-size:14px;font-weight:700;letter-spacing:.03em">${esc(cat)}</div>
      ${groups.map(g => (g.sub ? `<div style="background:#3a3a3a;color:#fff;padding:4px 8px;font-size:10.5px;font-weight:700">${esc(g.sub)}</div>` : "") + table(g.prods)).join("")}
    </div>`;
  }).join("");

  const header = (big) => `<div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:${big ? 10 : 6}px;margin-bottom:${big ? 14 : 10}px;border-bottom:2px solid #1a1a1a">
    <img src="${logo}" style="height:${big ? 58 : 40}px;width:auto" alt="BMP Supplies"/>
    <div style="text-align:right;line-height:1.35">
      <div style="font-size:${big ? 30 : 22}px;font-weight:700">Price List — ${esc(year)}</div>
      <div style="font-size:10px;color:#555">${esc(versionLabel)} · Effective ${esc(effectiveText)} · All prices in ${currency}</div>
      ${customerName ? `<div style="font-size:11px;font-weight:700;margin-top:2px">Prepared for ${esc(customerName)}</div>` : ""}
    </div>
  </div>`;

  const box = b => `<div style="border:1px solid #bbb;break-inside:avoid;margin-bottom:10px">
    <div style="background:#1a1a1a;color:#fff;padding:5px 10px;font-size:11.5px;font-weight:700">${esc(b.title)}</div>
    <ul style="margin:0;padding:7px 12px 7px 26px;font-size:11px;line-height:1.65;color:#222">${(b.items || []).filter(Boolean).map(i => `<li>${esc(i)}</li>`).join("")}</ul>
  </div>`;
  const notesPage = `<div style="break-after:page">
    ${header(true)}
    ${notes.intro ? `<div style="background:#f4f4f2;border-left:4px solid #1a1a1a;padding:10px 14px;font-size:12px;line-height:1.6;margin-bottom:14px">${esc(notes.intro)}</div>` : ""}
    <div style="font-size:15px;font-weight:700;margin:4px 0 10px;letter-spacing:.02em">Important notes</div>
    <div style="column-count:2;column-gap:14px">${(notes.boxes || []).map(box).join("")}</div>
    ${(notes.links || []).length ? `<div style="margin-top:8px;font-size:11px;line-height:1.8">${notes.links.map(l => `<div>• ${esc(l.label)}: <a href="${esc(l.url)}">${esc(l.url)}</a></div>`).join("")}</div>` : ""}
    <div style="margin-top:14px;font-size:10px;color:#555">Prices are in ${currency}, before tax, and subject to change without notice. Questions: sales@bmpsupplies.com · 604.542.0222 · bmpsupplies.com</div>
  </div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Price List</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a1a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:10px}
  @page{size:11in 8.5in;margin:10mm 10mm 12mm}
  @media print{body{padding:0}}
  a{color:#1a5fa8}
</style></head><body>
${notesPage}
${header(false)}
${sections}
<div style="margin-top:8px;font-size:8.5px;color:#888;text-align:center">BMP Supplies · Price List ${esc(year)} ${esc(versionLabel)} · Effective ${esc(effectiveText)} · bmpsupplies.com</div>
</body></html>`;
}

export const pdfFileName = (year, customerName) => `BMP Supplies - ${year} Price List${customerName ? ` - ${customerName}` : ""}`.replace(/[\\/:*?"<>|]+/g, "-");
export { PRICE_FIELDS };
