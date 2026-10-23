// ─── SKU standardising ───────────────────────────────────────────────────────
// Order confirmations spell the same product many ways (BMP-BDNSC0401, BDNSC0401,
// "CUSTOM" + a description…). Every order line is matched to the Products list:
//   1. a saved choice from Settings → Product SKU clean-up (skuMap) wins
//   2. an exact SKU on the Products list is kept
//   3. small differences are matched automatically: case, spaces, dashes, a "BMP-" prefix
//   4. anything else is left as-is and listed for review, with the closest suggestions

// Part numbers that don't identify a product on their own; these are matched by description
const GENERIC = /^(?:|custom|misc|-|#n\/a|n\/a|tbd|other|item)$/i;
export const isGenericSku = s => GENERIC.test(String(s || "").trim());

const squash = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const noPrefix = s => squash(s).replace(/^BMP/, "");
const descKey = d => String(d || "").toLowerCase().replace(/\s+/g, " ").trim();
// The key a clean-up choice is saved under
export const lineKey = l => (isGenericSku(l.sku) ? `desc:${descKey(l.desc)}` : `sku:${squash(l.sku)}`);

// products: the Products list. orderLines: every product line on synced orders, so SKUs that
// aren't on the Products list (e.g. a customer-specific one) can still be grouped and suggested.
export function buildCatalog(products, orderLines = []) {
  const list = (products || []).filter(p => p && p.sku).map(p => ({ sku: String(p.sku).trim(), name: p.product || "", desc: p.description || p.product || "", source: "Products list" }));
  const exact = new Map(), loose = new Map();
  for (const p of list) {
    exact.set(p.sku.toUpperCase(), p);
    loose.set(squash(p.sku), p);
    if (!loose.has(noPrefix(p.sku))) loose.set(noPrefix(p.sku), p);
  }
  // SKUs used on orders but not on the Products list: group spellings that differ only by
  // case, spaces, dashes or a "BMP-" prefix, using the most common spelling
  const counts = new Map();
  for (const l of orderLines) {
    const raw = String(l.sku || "").trim();
    if (!raw || isGenericSku(raw) || /^[\d,.]+$/.test(raw) || exact.has(raw.toUpperCase()) || loose.has(squash(raw)) || loose.has(noPrefix(raw))) continue;
    const k = noPrefix(raw);
    const g = counts.get(k) || new Map();
    const e = g.get(raw) || { n: 0, desc: l.desc || "" };
    e.n++; g.set(raw, e); counts.set(k, g);
  }
  const used = [];
  for (const [k, g] of counts) {
    const [sku, e] = [...g.entries()].sort((a, b) => b[1].n - a[1].n || a[0].length - b[0].length)[0];
    const p = { sku, name: "", desc: e.desc, source: "used on orders" };
    used.push(p); loose.set(k, p);
  }
  return { list, used, all: [...list, ...used], exact, loose };
}

// Returns { sku, desc, origSku, skuStatus: "catalog" | "auto" | "mapped" | "kept" | "unmatched" }
export function standardiseLine(l, catalog, skuMap = {}) {
  const raw = String(l.sku || "").trim();
  // A saved choice for this exact spelling, or for the group of spellings it belongs to
  const grouped = !isGenericSku(raw) && (catalog.loose.get(squash(raw)) || catalog.loose.get(noPrefix(raw)));
  const choice = skuMap[lineKey(l)] || (grouped ? skuMap[`sku:${squash(grouped.sku)}`] : undefined);
  if (choice) {
    // "Keep as its own SKU" — other spellings of it still report under the one SKU
    if (choice === "__keep") return grouped && grouped.sku !== raw ? { ...l, sku: grouped.sku, origSku: raw, skuStatus: "kept" } : { ...l, skuStatus: "kept" };
    const p = catalog.exact.get(choice.toUpperCase());
    return { ...l, sku: p ? p.sku : choice, desc: p?.desc || l.desc, origSku: raw, skuStatus: "mapped" };
  }
  if (raw === "LABELS") return { ...l, skuStatus: "kept" }; // grouped labels / label fees
  if (isGenericSku(raw)) return { ...l, skuStatus: "unmatched" };
  const hit = catalog.exact.get(raw.toUpperCase());
  if (hit) return { ...l, sku: hit.sku, skuStatus: "catalog" };
  const auto = catalog.loose.get(squash(raw)) || catalog.loose.get(noPrefix(raw));
  if (auto && auto.source === "Products list") return { ...l, sku: auto.sku, desc: auto.desc || l.desc, origSku: raw, skuStatus: "auto" };
  // Not on the Products list: still grouped with its other spellings, and listed for review
  if (auto) return { ...l, sku: auto.sku, origSku: auto.sku !== raw ? raw : undefined, skuStatus: "unmatched" };
  return { ...l, skuStatus: catalog.list.length ? "unmatched" : "catalog" };
}

// ── Suggestions ─────────────────────────────────────────────────────────────
function editSimilarity(a, b) {
  if (!a || !b) return 0;
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
// Words and sizes in a description: "Grass Seed Germinator Blanket (4' x 50')" → grass seed germinator blanket 4 50
const tokens = s => new Set(String(s || "").toLowerCase().replace(/(\d)\s*['"]/g, "$1 ").match(/[a-z]{3,}|\d+(?:\.\d+)?/g) || []);
function overlap(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0; A.forEach(t => { if (B.has(t)) n++; });
  return n / Math.min(A.size, B.size);
}

// Best Products-list matches for a line, best first: [{ sku, desc, score }]
export function suggestSkus(l, catalog, max = 5) {
  const generic = isGenericSku(l.sku);
  return catalog.all.filter(p => squash(p.sku) !== squash(l.sku)).map(p => {
    const s1 = generic ? 0 : Math.max(editSimilarity(squash(l.sku), squash(p.sku)), editSimilarity(noPrefix(l.sku), noPrefix(p.sku)));
    const s2 = Math.max(overlap(l.desc, p.desc), overlap(l.desc, p.name));
    return { sku: p.sku, desc: p.desc || p.name, source: p.source, score: (generic ? s2 : s1 * 0.6 + s2 * 0.4) - (p.source === "Products list" ? 0 : 0.02) };
  }).filter(x => x.score > 0.25).sort((a, b) => b.score - a.score).slice(0, max);
}
