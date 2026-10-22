// ─── Customer accounts: who owns which customer, and how OC names map to them ─
// "terms" are matched as whole words against the normalised "Sold To" name;
// the longest matching term wins (so "Core and Main Earth Savers" beats "Core and Main").
// Everything here is editable in Sales Summary → Settings; this is just the starting list.

const A = (name, rep, terms, type = "Distributor") => ({ name, rep, type, terms });

export const DEFAULT_ACCOUNTS = [
  // Mark
  A("White Cap", "Mark", ["white cap", "whitecap"]),
  A("Titan Environmental", "Mark", ["titan environmental", "titan"]),
  A("Layfield", "Mark", ["layfield"]),
  A("EMCO", "Mark", ["emco"]),
  A("ACF West (USA)", "Mark", ["acf west", "acf"]),
  A("Brogan Safety", "Mark", ["brogan"]),
  A("Cascade Geosynthetics (USA)", "Mark", ["cascade geosynthetics", "cascade geosythitics"]),
  A("Cascade Geotechnical (CAN)", "Mark", ["cascade geotechnical", "cascade geotech"]),
  A("Cherokee (USA)", "Mark", ["cherokee"]),
  A("GE Environmental", "Mark", ["ge environmental"]),
  A("Hanes Geo (USA)", "Mark", ["hanes geo", "hanes"]),
  A("Keymay", "Mark", ["keymay"]),
  A("Centerfield Supply", "Mark", ["centerfield"]),
  A("Ono Work and Safety", "Mark", ["ono work", "ono"]),
  A("Rocky Mountain Env./Spill Depot", "Mark", ["rocky mountain env", "rocky mountain environmental", "spill depot"]),
  A("Western Tank and Lining", "Mark", ["western tank"]),
  A("Spill Solutions/ESP", "Mark", ["spill solutions", "esp"]),
  A("Raider Hansen", "Mark", ["raider hansen"]),
  A("Pacific Spill Supply", "Mark", ["pacific spill"]),
  A("Kasa Supply", "Mark", ["kasa"]),
  A("Trident Safety", "Mark", ["trident"]),
  A("As-Built", "Mark", ["as built", "asbuilt"]),
  A("Zorbie", "Mark", ["zorbie"]),
  // Paul
  A("Cross Country", "Paul", ["cross country"]),
  A("Terrafix", "Paul", ["terrafix"]),
  A("Iconix", "Paul", ["iconix"]),
  A("Greg/GDL", "Paul", ["gdl", "greg"]),
  A("Geo Mods", "Paul", ["geo mods", "geomods"]),
  A("Assured First Aid", "Paul", ["assured first aid", "assured"]),
  A("Beaver Plastics", "Paul", ["beaver plastics"]),
  A("Bunzl", "Paul", ["bunzl"]),
  A("Agassiz Seed", "Paul", ["agassiz"]),
  A("EFAS Safety", "Paul", ["efas"]),
  A("Landloc Env.", "Paul", ["landloc"]),
  A("Nutech Safety", "Paul", ["nutech"]),
  A("Kleener Image Supplies", "Paul", ["kleener"]),
  A("City of Calgary", "Paul", ["city of calgary"]),
  A("Terraquavie", "Paul", ["terraquavie", "terraquaive"]),
  A("Wolseley", "Paul", ["wolseley"]),
  A("Andrew Sheret", "Paul", ["andrew sheret", "sheret"]),
  A("Crowle", "Paul", ["crowle"]),
  A("Calgary Fasteners & Tools", "Paul", ["calgary fasteners"]),
  A("Leo's Tools", "Paul", ["leos tools", "leo s tools"]),
  A("Spinpro", "Paul", ["spinpro", "spin pro"]),
  A("Norweld Industries", "Paul", ["norweld"]),
  // John
  A("Reed and Graham", "John", ["reed and graham", "reed graham"]),
  A("Stevenson Supply", "John", ["stevenson supply", "stevenson"]),
  A("Core and Main", "John", ["core and main", "core main"]),
  A("Core and Main (Earth Savers)", "John", ["earth savers", "earthsavers", "core and main earth savers"]),
  A("Ferguson Waterworks", "John", ["ferguson"]),
];

export const REPS = ["Mark", "Paul", "John", "Grant", "Jeff", "Unassigned"];

export const normName = s => " " + String(s || "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/['’]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\b(inc|ltd|llc|corp|corporation|co|company|limited)\b/g, " ")
  .replace(/\s+/g, " ")
  .trim() + " ";

// aliases: { normalisedRawName: accountName } — manual assignments win over terms
export function matchAccount(rawName, accounts, aliases = {}) {
  const n = normName(rawName);
  const aliased = aliases[n.trim()];
  if (aliased) { const a = accounts.find(x => x.name === aliased); if (a) return a; }
  let best = null, bestLen = 0;
  for (const a of accounts) {
    for (const t of [a.name, ...(a.terms || [])]) {
      const tn = normName(t);
      if (tn.trim() && n.includes(tn) && tn.length > bestLen) { best = a; bestLen = tn.length; }
    }
  }
  return best;
}

// The customer line every report groups by
export function customerOf(order, accounts, aliases, custTypes = {}) {
  const raw = (order.override?.customer || order.customer || "Unknown").trim();
  const acct = matchAccount(raw, accounts, aliases);
  if (acct) return { key: acct.name, name: acct.name, rep: acct.rep || "Unassigned", type: acct.type || "Distributor", matched: true };
  const key = normName(raw).trim() || "unknown";
  return { key, name: raw, rep: "Unassigned", type: custTypes[key] || "End User", matched: false };
}
