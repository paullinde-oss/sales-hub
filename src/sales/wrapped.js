// ─── "BMP Supplies Wrapped" — the company's year in fun facts ────────────────
// Spotify-Wrapped style cards for LinkedIn / email / the team: no dollar figures, just what we did.
// Everything is worked out from synced order confirmations (+ quotes) for one calendar year.
import { orderCurrency } from "./salesUtils";

const up = s => String(s || "").trim().toUpperCase();
const n0 = n => Math.round(n).toLocaleString("en-CA");
const n1 = n => (n >= 10 ? n0(n) : n.toFixed(1).replace(/\.0$/, ""));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Home bases (for "furthest delivery")
export const HOMES = { Brooks: [50.5642, -111.8989], Calgary: [51.0447, -114.0719] };
export function km([a, b], [c, d]) {
  const R = 6371, r = x => (x * Math.PI) / 180, dLat = r(c - a), dLon = r(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Erosion control blankets / mats: SKU ends in 08 / 16 (8' / 16' wide), JR = jumbo roll
function rollSy(sku) {
  const m = up(sku).match(/^BMP-?[A-Z]+(08|16)(JR)?$/);
  if (!m) return null;
  return (m[1] === "16" ? 200 : 100) * (m[2] ? 5 : 1);
}
const wattleFt = sku => { const s = up(sku); return /W-?0925/.test(s) ? 25 : /W-?1220/.test(s) ? 20 : null; };
const isCurtain = sku => /^(TBC|OCB)/.test(up(sku)); // 50' sections
const isDonut = sku => /^4CBD/.test(up(sku));

// Fun comparisons
const CFL_FIELD_SY = 150 * 65;    // Canadian football field incl. end zones, sq yd
const CALGARY_EDMONTON_KM = 300;
const CN_TOWER_M = 553;
const BROOKS_CALGARY_KM = 190;

/**
 * orders: enriched orders (cust, city, region, country, lines…) · quotes: Quote Maker quotes
 * products: current product list (for pallet sizes, names) · year: calendar year
 */
export function wrappedFacts({ orders, quotes = [], products = [], year }) {
  const from = `${year}-01-01`, to = `${year}-12-31`;
  const yo = orders.filter(o => o.date >= from && o.date <= to);
  const before = orders.filter(o => o.date < from);
  const prodBy = new Map(products.map(p => [up(p.sku), p]));
  const f = { year, orders: yo.length, hasEarlierData: before.length > 0 };

  // Where it went
  const cities = new Map(), provinces = new Set(), states = new Set();
  yo.forEach(o => {
    if (!o.city) return;
    const k = `${o.city}|${o.region || ""}|${o.country || ""}`;
    const c = cities.get(k) || { city: o.city, region: o.region || "", country: o.country || "", orders: 0 };
    c.orders++; cities.set(k, c);
    if (o.region) (o.country === "US" ? states : provinces).add(o.region);
  });
  f.cities = [...cities.values()].sort((a, b) => b.orders - a.orders);
  f.provinces = [...provinces]; f.states = [...states];
  f.usOrders = yo.filter(o => o.country === "US" || orderCurrency(o) === "USD").length;

  // How much
  let sy = 0, rolls = 0, wft = 0, logs = 0, sections = 0, donuts = 0, pallets = 0, units = 0;
  const prodCount = new Map();
  yo.forEach(o => (o.lines || []).forEach(l => {
    const q = l.qty || 0, sku = up(l.sku); if (!q || !sku) return;
    units += q;
    const r = rollSy(sku); if (r) { sy += r * q; rolls += q; }
    const w = wattleFt(sku); if (w) { wft += w * q; logs += q; }
    if (isCurtain(sku)) sections += q;
    if (isDonut(sku)) donuts += q;
    const pal = parseFloat(prodBy.get(sku)?.pallet); if (pal > 0) pallets += q / pal;
    if (!/^(CUSTOM|LABELS)$/.test(sku)) { const c = prodCount.get(sku) || { sku, orders: new Set(), qty: 0, desc: l.desc }; c.orders.add(o.orderNo); c.qty += q; prodCount.set(sku, c); }
  }));
  Object.assign(f, { sy, rolls, wft, logs, sections, donuts, pallets, units });
  const top = [...prodCount.values()].sort((a, b) => b.orders.size - a.orders.size || b.qty - a.qty)[0];
  f.topProduct = top ? { sku: top.sku, name: prodBy.get(top.sku)?.description || prodBy.get(top.sku)?.product || top.desc || top.sku, orders: top.orders.size } : null;

  // People & rhythm
  const custs = new Set(yo.map(o => o.cust?.key).filter(Boolean)), seen = new Set(before.map(o => o.cust?.key));
  f.customers = custs.size; f.newCustomers = [...custs].filter(k => !seen.has(k)).length;
  const byMonth = Array(12).fill(0), byDay = new Map();
  yo.forEach(o => { byMonth[+o.date.slice(5, 7) - 1]++; byDay.set(o.date, (byDay.get(o.date) || 0) + 1); });
  const bm = byMonth.indexOf(Math.max(...byMonth));
  f.busiestMonth = yo.length ? { name: MONTHS[bm], orders: byMonth[bm] } : null;
  const bd = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
  f.busiestDay = bd ? { date: bd[0], orders: bd[1] } : null;
  const loc = { BRO: 0, CAL: 0 }; yo.forEach(o => { const l = o.location || String(o.orderNo).slice(0, 3); if (loc[l] !== undefined) loc[l]++; });
  f.brooks = loc.BRO; f.calgary = loc.CAL;
  f.quotes = quotes.filter(q => { const d = q.savedDate ? new Date(q.savedDate) : null; return q.saved !== false && d && !isNaN(d) && d.getFullYear() === year; }).length;
  return f;
}

// The cards, in order. Each: { id, emoji, big, text, sub } (sub = the fun comparison)
export function buildCards(f, geo = {}) {
  const Y = f.year, cards = [];
  const add = (id, emoji, big, text, sub) => cards.push({ id, emoji, big: String(big), text, sub: sub || "" });
  add("cover", "🎉", `${Y}`, "BMP Supplies Wrapped", "Our year, by the numbers");
  if (f.cities.length) add("cities", "📍", n0(f.cities.length), `cities received BMP products`,
    [f.provinces.length && `${f.provinces.length} province${f.provinces.length > 1 ? "s" : ""}`, f.states.length && `${f.states.length} state${f.states.length > 1 ? "s" : ""}`].filter(Boolean).join(" · "));
  if (f.cities.length) cards.push({ id: "map", map: true, emoji: "🗺️", big: "", text: `Where our products went in ${Y}`, sub: "" });
  if (f.cities[0]) add("topcity", "🏙️", `${f.cities[0].city}${f.cities[0].region ? ", " + f.cities[0].region : ""}`, "was our most-shipped-to city", `${n0(f.cities[0].orders)} deliveries`);
  if (geo.furthest) add("furthest", "🧭", `${n0(geo.furthest.km)} km`, `our furthest delivery — ${geo.furthest.label}`, `That's ${n1(geo.furthest.km / BROOKS_CALGARY_KM)}× the drive from Brooks to Calgary`);
  if (f.usOrders) add("border", "🌎", n0(f.usOrders), "times our products crossed the border", f.states.length ? `to ${f.states.length} US state${f.states.length > 1 ? "s" : ""}` : "");
  if (f.rolls) add("blankets", "🌱", n0(f.rolls), "rolls of erosion control blankets", `Enough to cover ${n0(f.sy / CFL_FIELD_SY)} Canadian football fields (${n0(f.sy * 0.836127 / 10000)} hectares)`);
  if (f.wft) { const k = f.wft * 0.3048 / 1000; add("wattles", "🌾", `${n0(k)} km`, `of straw wattles (${n0(f.logs)} logs)`, k >= CALGARY_EDMONTON_KM / 2 ? `Laid end to end: Calgary → Edmonton ${n1(k / CALGARY_EDMONTON_KM)} times` : `That's ${n1(k / 0.4)} laps of an Olympic running track… in wattles`); }
  if (f.sections) { const m = f.sections * 50 * 0.3048; add("curtains", "🌊", `${n1(m / 1000)} km`, `of turbidity curtain & boom (${n0(f.sections)} sections)`, `As tall as ${n1(m / CN_TOWER_M)} CN Towers stacked up`); }
  if (f.donuts) add("donuts", "🍩", n0(f.donuts), "catch basin donuts", "The only donuts that didn't make it to the break room");
  if (f.pallets >= 1) add("pallets", "🚛", n0(f.pallets), "pallets shipped", `About ${n0(f.pallets / 24)} full truckloads`);
  add("orders", "📦", n0(f.orders), "orders shipped", f.busiestMonth ? `${f.busiestMonth.name} was our busiest month (${n0(f.busiestMonth.orders)} orders)` : "");
  if (f.busiestDay) add("busiestday", "⚡", new Date(f.busiestDay.date + "T12:00").toLocaleDateString("en-CA", { month: "long", day: "numeric" }), "was our busiest day", `${n0(f.busiestDay.orders)} orders in one day`);
  if (f.customers) add("customers", "🤝", n0(f.customers), "customers we worked with", f.hasEarlierData && f.newCustomers ? `including ${n0(f.newCustomers)} new ones — welcome!` : "Thank you, every one of you");
  if (f.quotes) add("quotes", "📄", n0(f.quotes), "quotes sent", "Our team's keyboards would like a vacation");
  if (f.brooks + f.calgary) { const b = Math.round((f.brooks / (f.brooks + f.calgary)) * 100); add("locations", "🏭", `${b}% / ${100 - b}%`, "Brooks / Calgary", "Two locations, one team"); }
  if (f.topProduct) add("topproduct", "⭐", f.topProduct.name, "was our most-ordered product", `on ${n0(f.topProduct.orders)} orders`);
  return cards;
}

export function finalCards(cards, settings = {}, year) {
  const hidden = settings.hidden || {}, edits = settings.edits || {};
  const custom = (settings.custom || []).map(c => ({ ...c, custom: true }));
  const all = [...cards.map(c => ({ ...c, ...(edits[c.id] || {}) })), ...custom];
  all.push({ id: "outro", emoji: "🙏", big: "Thank you", text: `to our customers, partners and team for an amazing ${year}`, sub: `Here's to ${year + 1} · bmpsupplies.com`, ...(edits.outro || {}) });
  return all.map(c => ({ ...c, hidden: !!hidden[c.id] }));
}

// ── Where cities are on the map ──────────────────────────────────────────────
// OpenStreetMap's free lookup (once per city, then saved in config/geoCache). If it can't be
// reached, the dot goes at the middle of the province / state instead.
const CENTROIDS = {
  AB: [53.9, -116.6], BC: [53.7, -127.6], SK: [52.9, -106.5], MB: [53.8, -98.8], ON: [50.0, -85.3], QC: [52.9, -73.5], NB: [46.6, -66.5], NS: [45.0, -63.0], PE: [46.5, -63.4], NL: [53.1, -57.7], YT: [64.3, -135.0], NT: [64.8, -124.8], NU: [70.3, -83.1],
  AL: [32.8, -86.8], AK: [64.2, -149.5], AZ: [34.0, -111.1], AR: [34.8, -92.2], CA: [36.8, -119.4], CO: [39.0, -105.5], CT: [41.6, -72.7], DE: [39.0, -75.5], FL: [27.8, -81.7], GA: [32.2, -82.9], HI: [19.9, -155.6], ID: [44.1, -114.7], IL: [40.0, -89.2], IN: [39.8, -86.1], IA: [42.0, -93.6], KS: [38.5, -98.4], KY: [37.8, -84.3], LA: [31.0, -92.0], ME: [45.3, -69.4], MD: [39.0, -76.6], MA: [42.4, -71.4], MI: [44.3, -85.6], MN: [46.7, -94.7], MS: [32.7, -89.7], MO: [38.5, -92.5], MT: [46.9, -110.4], NE: [41.5, -99.9], NV: [38.8, -116.4], NH: [43.2, -71.6], NJ: [40.1, -74.4], NM: [34.5, -106.0], NY: [43.0, -75.5], NC: [35.6, -79.4], ND: [47.5, -100.5], OH: [40.4, -82.9], OK: [35.6, -97.5], OR: [44.0, -120.6], PA: [41.2, -77.2], RI: [41.7, -71.5], SC: [33.9, -80.9], SD: [44.4, -100.2], TN: [35.9, -86.4], TX: [31.0, -99.0], UT: [39.3, -111.7], VT: [44.0, -72.7], VA: [37.5, -78.9], WA: [47.4, -120.7], WV: [38.6, -80.6], WI: [44.6, -89.9], WY: [43.0, -107.6],
};
const cityKey = c => `${c.city}|${c.region}|${c.country}`;
export async function locateCities(cities, cache = {}, { onProgress = () => {}, onFound = () => {}, saveCache = async () => {}, stopped = () => false } = {}) {
  const out = {}, todo = [];
  cities.forEach(c => { const k = cityKey(c); if (cache[k]) out[k] = cache[k]; else { todo.push(c); if (CENTROIDS[c.region]) out[k] = CENTROIDS[c.region]; } });
  let fresh = {}, blocked = false;
  const flush = async () => { if (Object.keys(fresh).length) { const f = fresh; fresh = {}; try { await saveCache(f); } catch { /* try again next time */ } } };
  for (let i = 0; i < todo.length && !blocked; i++) {
    if (stopped()) break;
    const c = todo[i], k = cityKey(c);
    onProgress(i + 1, todo.length);
    try {
      const q = encodeURIComponent(`${c.city}, ${c.region}, ${c.country === "US" ? "USA" : "Canada"}`);
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`, { headers: { Accept: "application/json" } });
      if (r.status === 429 || r.status === 403) blocked = true; // too many lookups — keep the province/state spots for now
      const j = r.ok ? await r.json() : [];
      if (j[0]) { const pos = [+(+j[0].lat).toFixed(4), +(+j[0].lon).toFixed(4)]; out[k] = pos; fresh[k] = pos; onFound(k, pos); }
    } catch { blocked = true; /* offline — keep the province/state spots */ }
    if ((i + 1) % 10 === 0) await flush(); // save as we go, so nothing is lost if the page is closed
    await new Promise(res => setTimeout(res, 1100)); // OpenStreetMap asks for 1 lookup per second
  }
  await flush();
  return out;
}

export function furthest(cities, pos) {
  let best = null;
  cities.forEach(c => {
    const p = pos[cityKey(c)]; if (!p) return;
    const d = Math.min(km(p, HOMES.Brooks), km(p, HOMES.Calgary));
    if (!best || d > best.km) best = { km: d, label: `${c.city}${c.region ? ", " + c.region : ""}` };
  });
  return best && best.km > 50 ? best : null;
}
export { cityKey, CENTROIDS };
