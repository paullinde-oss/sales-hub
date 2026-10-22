// ─── Ship-to city clean-up ───────────────────────────────────────────────────
// OCs write the same place many ways: "Calgary, AB", "CALGARY, AB", "Calgary, Alberta",
// "Calgary (pickup)", "Customer Pickup Curtains Calgary - Anchor Shipping from Brooks"…
// This rolls them all up to one "City, PR" so reports group them together.

const REGION_CODES = {
  alberta: "AB", "british columbia": "BC", saskatchewan: "SK", manitoba: "MB", ontario: "ON", quebec: "QC", "québec": "QC",
  "new brunswick": "NB", "nova scotia": "NS", "prince edward island": "PE", newfoundland: "NL", "newfoundland and labrador": "NL",
  yukon: "YT", "northwest territories": "NT", nunavut: "NU",
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
const regionCode = r => { const s = String(r || "").trim(); return /^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : REGION_CODES[s.toLowerCase()] || s; };

// "FORT ST. JOHN" / "fort st john" → "Fort St. John"
const titleCase = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim()
  .replace(/\b(st|mt|ft)\b\.?/g, m => m.replace(".", "") + ".")
  .replace(/(^|[\s\-'(])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const stripNoise = s => String(s || "").replace(/\(?\s*pick\s*-?\s*up\s*\)?/ig, " ").replace(/\s+/g, " ").trim();
const keyOf = s => titleCase(stripNoise(s)).replace(/\./g, "").toLowerCase();
// Looks like a real place name, not a sentence ("Customer Pickup Curtains …")
const looksLikeCity = s => /^[A-Za-z][A-Za-z .'\-]{1,30}$/.test(s) && s.split(" ").length <= 4;

export function normalizeCities(orders) {
  // 1. Learn the places from orders whose city was read cleanly, and each one's usual province/state
  const seen = new Map(); // key → { name, regions: Map(code → count), n }
  for (const o of orders) {
    const c = titleCase(stripNoise(o.city)), r = regionCode(o.region);
    if (!c || !looksLikeCity(c) || !/^[A-Z]{2}$/.test(r)) continue;
    const k = keyOf(c);
    const e = seen.get(k) || { name: c, regions: new Map(), n: 0 };
    e.regions.set(r, (e.regions.get(r) || 0) + 1); e.n++;
    seen.set(k, e);
  }
  const usualRegion = e => [...e.regions.entries()].sort((a, b) => b[1] - a[1])[0][0];
  // Longest names first so "North Vancouver" wins over "Vancouver"
  const known = [...seen.entries()].filter(([k]) => k.length >= 3).sort((a, b) => b[0].length - a[0].length);
  const findIn = text => {
    const t = " " + String(text || "").toLowerCase().replace(/\./g, "").replace(/[^a-z\s'-]/g, " ").replace(/\s+/g, " ") + " ";
    let best = null, at = Infinity;
    for (const [k, e] of known) { const i = t.indexOf(" " + k + " "); if (i >= 0 && i < at) { best = e; at = i; } }
    return best; // the place mentioned first
  };

  // 2. Rewrite every order's city/region to the clean form
  return orders.map(o => {
    const raw = stripNoise(o.city);
    let e = raw && seen.get(keyOf(raw));
    if (!e) e = findIn(raw) || findIn(o.shipTo); // a known place mentioned in the city text, else in the ship-to address
    if (e) return { ...o, city: e.name, region: usualRegion(e) };
    if (!raw) return o;
    return { ...o, city: titleCase(raw), region: regionCode(o.region) };
  });
}
