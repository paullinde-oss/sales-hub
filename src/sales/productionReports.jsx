// ─── Reports → Production ────────────────────────────────────────────────────
// Six reports for planning what to make, all in QUANTITIES (each product's own unit: rolls, 50 ft
// sections, pieces…), from order confirmations (Brooks + Calgary, bills of lading included).
// CUSTOM / LABELS lines are left out (not made or stocked ahead). Pick any mix of categories and SKUs.
//   units    — Units sold by month (fiscal year Dec → Nov, or chosen months; optional compare to last year)
//   plan     — Next-year build plan (month-by-month average of past years × this year's growth)
//   season   — Seasonality (share of the year's volume in each month)
//   stock    — Stock vs demand (stock sheets ÷ average monthly sales; flags shortfalls before the busy months)
//   quotes   — Upcoming demand from open quotes (quoted qty × win rate)
//   pallets  — Pallets & truckloads shipped by month
import { useEffect, useMemo, useState } from "react";
import { ReportTable, Kpis } from "./pipelineReports";
import { fyOf, today, fmtMonth } from "./salesUtils";
import { isGenericSku } from "./skus";
import { Loader } from "../Loader";

export const PRODUCTION_REPORTS = ["punits", "pplan", "pseason", "pstock", "pquotes", "ppallets"];
const GREEN = "#2fa866", RED = "#e8472c", AMBER = "#c8a030";
const up = s => String(s || "").trim().toUpperCase();
const skip = sku => !sku || isGenericSku(sku) || /^(CUSTOM|LABELS?)$/i.test(sku);
const qtyTxt = n => (n ? (Math.round(n * 10) / 10).toLocaleString("en-CA") : "—");
const pct = (a, b) => (b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : "—");
// Fiscal months, Dec → Nov, as "YYYY-MM"
const fyMonths = fy => Array.from({ length: 12 }, (_, i) => { const d = new Date(fy - 1, 11 + i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
const monLabel = ym => fmtMonth(ym + "-01").split(" ")[0];

// ── Which products: any mix of categories and SKUs (nothing picked = everything) ──
function useProductPick() {
  const [picks, setPicks] = useState([]);
  return { picks, setPicks };
}
function ProductPicker({ T, picks, setPicks, products, categories, skusSeen }) {
  const cats = [...new Set(Object.values(categories).filter(Boolean))].sort();
  const names = new Map(products.map(p => [up(p.sku), p.product || p.description || ""]));
  const skus = [...new Set([...products.map(p => up(p.sku)), ...skusSeen])].filter(s => !skip(s)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const label = p => (p.startsWith("cat:") ? `📁 ${p.slice(4)}` : p.slice(4));
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <select value="" onChange={e => { const v = e.target.value; if (v && !picks.includes(v)) setPicks([...picks, v]); }} style={{ fontSize: 12, height: 28, minWidth: 260 }}>
        <option value="">{picks.length ? "＋ Add a category or SKU…" : "All products — or pick categories / SKUs…"}</option>
        <optgroup label="Categories (all SKUs in it)">{cats.map(c => <option key={c} value={"cat:" + c}>{c}</option>)}</optgroup>
        <optgroup label="SKUs (A–Z)">{skus.map(s => <option key={s} value={"sku:" + s}>{s}{names.get(s) ? ` — ${names.get(s)}` : ""}</option>)}</optgroup>
      </select>
      {picks.map(p => (
        <span key={p} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: T.tag, border: `1px solid ${T.tagBorder}`, color: T.tagText, display: "inline-flex", gap: 6, alignItems: "center" }}>
          {label(p)}<a style={{ cursor: "pointer" }} onClick={() => setPicks(picks.filter(x => x !== p))}>×</a>
        </span>
      ))}
      {picks.length > 0 && <a style={{ fontSize: 11, cursor: "pointer", color: T.subtext }} onClick={() => setPicks([])}>clear</a>}
    </span>
  );
}
const makeFilter = (picks, catOf) => {
  if (!picks.length) return () => true;
  const cats = new Set(picks.filter(p => p.startsWith("cat:")).map(p => p.slice(4)));
  const skus = new Set(picks.filter(p => p.startsWith("sku:")).map(p => p.slice(4)));
  return sku => skus.has(up(sku)) || cats.has(catOf(sku));
};

// qty by SKU by month ("YYYY-MM") from orders
function qtyByMonth(orders) {
  const m = new Map(); // SKU → Map(ym → qty)
  orders.forEach(o => (o.lines || []).forEach(l => {
    const sku = up(l.sku); if (skip(sku) || !(l.qty > 0)) return;
    const ym = o.date.slice(0, 7);
    if (!m.has(sku)) m.set(sku, new Map());
    const s = m.get(sku); s.set(ym, (s.get(ym) || 0) + l.qty);
  }));
  return m;
}
const sumMonths = (s, months) => months.reduce((t, ym) => t + (s?.get(ym) || 0), 0);

// Rows grouped by category with a subtotal per category; each item: { sku, cells: [...] } with numeric values from index `from`
function grouped(items, catOf, numFrom, fmt = qtyTxt) {
  const by = new Map();
  items.forEach(it => { const c = catOf(it.sku); if (!by.has(c)) by.set(c, []); by.get(c).push(it); });
  const rows = [];
  [...by.keys()].sort().forEach(c => {
    const list = by.get(c).sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
    const n = list[0].vals.length;
    const tot = Array.from({ length: n }, (_, i) => list.reduce((t, it) => t + (Number(it.vals[i]) || 0), 0));
    rows.push({ group: true, bg: "rgba(200,169,110,.12)", cells: [`${c} (${list.length})`, ...Array(numFrom - 1).fill(""), ...tot.map(fmt)] });
    list.forEach(it => rows.push({ cells: [`   ${it.sku}`, ...it.lead, ...it.vals.map(fmt)] }));
  });
  return rows;
}

export function ProductionReport({ T, rep, orders, products = [], categories = {}, quotes = [], loadStock }) {
  const catMap = useMemo(() => { const m = new Map(); Object.entries(categories).forEach(([s, c]) => m.set(up(s), c)); return m; }, [categories]);
  const catOf = sku => catMap.get(up(sku)) || (products.some(p => up(p.sku) === up(sku)) ? "Uncategorized" : "Not on the price list");
  const prod = useMemo(() => new Map(products.map(p => [up(p.sku), p])), [products]);
  const nameOf = sku => prod.get(up(sku))?.product || prod.get(up(sku))?.description || "";
  const byMonth = useMemo(() => qtyByMonth(orders), [orders]);
  const skusSeen = useMemo(() => [...byMonth.keys()], [byMonth]);
  const pick = useProductPick();
  const keep = makeFilter(pick.picks, catOf);
  const curFy = fyOf(today());
  const fys = [...new Set(orders.map(o => fyOf(o.date)))].sort((a, b) => b - a);
  const [fy, setFy] = useState(curFy);
  const [months, setMonths] = useState([]); // [] = full year
  const [compare, setCompare] = useState(false);
  const [bySku, setBySku] = useState(false);
  const [adjust, setAdjust] = useState(0);
  const [stock, setStock] = useState(null);
  useEffect(() => { if (rep === "pstock" && !stock && loadStock) loadStock().then(setStock).catch(() => setStock({ map: new Map() })); }, [rep]); // eslint-disable-line
  useEffect(() => { setMonths([]); }, [fy]);

  const picker = <ProductPicker T={T} {...pick} products={products} categories={categories} skusSeen={skusSeen} />;
  const fySelect = <select value={fy} onChange={e => setFy(+e.target.value)} style={{ fontSize: 12, height: 28 }}>{(fys.length ? fys : [curFy]).map(y => <option key={y} value={y}>Fiscal {y}{y === curFy ? " (so far)" : ""}</option>)}</select>;
  const allFy = fyMonths(fy);
  const pastFys = fys.filter(f => f <= curFy);

  // ── 1. Units sold by month ──
  if (rep === "punits") {
    const cols = months.length ? allFy.filter(m => months.includes(m)) : allFy;
    const prevCols = cols.map(ym => `${+ym.slice(0, 4) - 1}${ym.slice(4)}`);
    const items = [...byMonth.entries()].filter(([s]) => keep(s)).map(([sku, s]) => {
      const vals = cols.map(ym => s.get(ym) || 0), total = vals.reduce((a, b) => a + b, 0), prev = sumMonths(s, prevCols);
      return { sku, lead: [nameOf(sku)], vals: compare ? [...vals, total, prev] : [...vals, total], total, prev };
    }).filter(it => it.total || (compare && it.prev));
    let rows = grouped(items, catOf, 2);
    if (compare) rows = rows.map(r => { const n = r.cells.length; const t = Number(String(r.cells[n - 2]).replace(/[^0-9.]/g, "")) || 0, p = Number(String(r.cells[n - 1]).replace(/[^0-9.]/g, "")) || 0; return { ...r, cells: [...r.cells, { text: pct(t, p), color: t >= p ? GREEN : RED }] }; });
    const grand = items.reduce((t, it) => t + it.total, 0);
    return <ReportTable T={T} title="Units sold by month" sub={`Fiscal ${fy}${months.length ? " · " + cols.map(monLabel).join(", ") : " (Dec – Nov)"}`}
      note="Quantities sold on order confirmations (Brooks + Calgary, bills of lading included), in each product's own unit. CUSTOM items are left out. Pick categories and/or SKUs, the whole fiscal year or particular months."
      controls={<>{fySelect}{picker}
        <span style={{ display: "inline-flex", gap: 3, flexWrap: "wrap" }}>
          <button className="btn" style={{ fontSize: 10, padding: "2px 7px", borderColor: !months.length ? T.gold : undefined }} onClick={() => setMonths([])}>Full year</button>
          {allFy.map(ym => <button key={ym} className="btn" style={{ fontSize: 10, padding: "2px 7px", borderColor: months.includes(ym) ? T.gold : undefined, background: months.includes(ym) ? T.activeBg : undefined }} onClick={() => setMonths(months.includes(ym) ? months.filter(x => x !== ym) : [...months, ym])}>{monLabel(ym)}</button>)}
        </span>
        <label style={{ fontSize: 11 }}><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> Compare to previous year</label></>}
      summary={<Kpis T={T} items={[["Units sold", qtyTxt(grand)], ["SKUs", items.length]]} />}
      headers={["SKU / category", "Product", ...cols.map(monLabel), "Total", ...(compare ? [`FY${fy - 1} same months`, "Change"] : [])]}
      right={Array.from({ length: cols.length + (compare ? 3 : 1) }, (_, i) => i + 2)} rows={rows} />;
  }

  // ── 2. Next-year build plan ──
  if (rep === "pplan") {
    const next = curFy + 1, nextMonths = fyMonths(next);
    // For each calendar month: the average of that month over past fiscal years in which it's over
    const hist = pastFys.slice(0, 3);
    const items = [...byMonth.entries()].filter(([s]) => keep(s)).map(([sku, s]) => {
      const avg = nextMonths.map(ym => { const mm = ym.slice(5); const vals = hist.map(f => fyMonths(f).find(x => x.slice(5) === mm)).filter(x => x && x < today().slice(0, 7)).map(x => s.get(x) || 0); return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0; });
      // Growth: this fiscal year so far vs the same months last year
      const doneNow = fyMonths(curFy).filter(x => x < today().slice(0, 7)), donePrev = doneNow.map(x => `${+x.slice(0, 4) - 1}${x.slice(4)}`);
      const a = sumMonths(s, doneNow), b = sumMonths(s, donePrev);
      const growth = b ? Math.min(2, Math.max(0.5, a / b)) : 1;
      const k = growth * (1 + adjust / 100);
      const plan = avg.map(v => Math.round(v * k));
      const total = plan.reduce((x, y) => x + y, 0);
      const histTotals = hist.map(f => sumMonths(s, fyMonths(f)));
      return { sku, lead: [nameOf(sku), ...histTotals.map(qtyTxt), b ? `${growth >= 1 ? "+" : ""}${Math.round((growth - 1) * 100)}%` : "—"], vals: [...plan, total], total };
    }).filter(it => it.total);
    const rows = grouped(items, catOf, 3 + hist.length);
    return <ReportTable T={T} title={`Build plan — Fiscal ${next}`} sub={`Suggested quantities to make, Dec ${next - 1} – Nov ${next}`}
      note={`Each month = the average of that month in ${hist.map(f => "FY" + f).join(" & ")} (finished months only), × this year's growth (FY${curFy} so far vs the same months of FY${curFy - 1}, kept between −50% and +100%)${adjust ? `, then ${adjust > 0 ? "+" : ""}${adjust}% your adjustment` : ""}. A starting point — adjust for what you know.`}
      controls={<>{picker}<label style={{ fontSize: 11 }}>Adjust everything by <input type="number" value={adjust} onChange={e => setAdjust(Number(e.target.value) || 0)} style={{ width: 60, height: 26 }} /> %</label></>}
      summary={<Kpis T={T} items={[["Suggested units", qtyTxt(items.reduce((t, it) => t + it.total, 0))], ["SKUs", items.length]]} />}
      headers={["SKU / category", "Product", ...hist.map(f => `FY${f}${f === curFy ? " so far" : ""}`), "Growth", ...nextMonths.map(monLabel), `FY${next} plan`]}
      right={Array.from({ length: hist.length + 14 }, (_, i) => i + 2)} rows={rows} />;
  }

  // ── 3. Seasonality ──
  if (rep === "pseason") {
    const hist = pastFys.slice(0, 3);
    const MM = fyMonths(curFy).map(x => x.slice(5));
    const shareOf = s => {
      // Per month: average share of the fiscal year's volume (only full fiscal years, or the current one if it's all we have)
      const years = hist.filter(f => f < curFy || hist.length === 1);
      const tots = MM.map(() => 0); let n = 0;
      years.forEach(f => { const ms = fyMonths(f), t = sumMonths(s, ms); if (!t) return; n++; ms.forEach((ym, i) => { tots[i] += (s.get(ym) || 0) / t; }); });
      return n ? tots.map(v => (v / n) * 100) : null;
    };
    const groups = new Map();
    [...byMonth.entries()].filter(([s]) => keep(s)).forEach(([sku, s]) => {
      const key = bySku ? sku : catOf(sku);
      if (!groups.has(key)) groups.set(key, new Map());
      const g = groups.get(key); s.forEach((v, ym) => g.set(ym, (g.get(ym) || 0) + v));
    });
    const rows = [...groups.entries()].map(([k, s]) => { const sh = shareOf(s); if (!sh) return null; const peak = sh.indexOf(Math.max(...sh));
      return { cells: [k, ...sh.map(v => ({ text: v >= 0.5 ? Math.round(v) + "%" : "—", color: v >= 15 ? GREEN : v >= 10 ? AMBER : undefined })), monLabel(fyMonths(curFy)[peak])] }; }).filter(Boolean)
      .sort((a, b) => String(a.cells[0]).localeCompare(String(b.cells[0])));
    const years = hist.filter(f => f < curFy || hist.length === 1);
    return <ReportTable T={T} title="Seasonality" sub={`Share of each year's volume by month · ${years.map(f => "FY" + f).join(", ")}`}
      note={`What share of the fiscal year's units sell in each month (Dec → Nov), averaged over ${years.map(f => "FY" + f).join(" & ")}. Green = a busy month (15%+), amber = 10%+. Build stock ahead of the green months.`}
      controls={<>{picker}<label style={{ fontSize: 11 }}><input type="checkbox" checked={bySku} onChange={e => setBySku(e.target.checked)} /> By SKU (instead of category)</label></>}
      headers={[bySku ? "SKU" : "Category", ...MM.map(m => monLabel(`2000-${m}`)), "Busiest"]} right={Array.from({ length: 12 }, (_, i) => i + 1)} rows={rows} />;
  }

  // ── 4. Stock vs demand ──
  if (rep === "pstock") {
    if (!stock) return <Loader T={T} label="Reading the stock sheets…" />;
    const last12 = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1 - i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
    const next3 = Array.from({ length: 3 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i - 12); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }); // same 3 months last year
    const stockSku = s => String(s || "").replace(/^BMP-?/i, "").trim().toUpperCase();
    const skus = new Set([...byMonth.keys(), ...products.map(p => up(p.sku))].filter(s => !skip(s) && keep(s)));
    const items = [...skus].map(sku => {
      const s = byMonth.get(sku), sold = sumMonths(s, last12), avg = sold / 12, coming = sumMonths(s, next3);
      const entries = stock.map.get(stockSku(sku)) || [];
      const have = entries.reduce((t, e) => t + (Number(e.units ?? e.n) || 0), 0), listed = entries.length > 0;
      if (!listed && !sold) return null;
      const months = avg ? have / avg : null;
      const flag = !listed ? { text: "Not on stock sheets", color: undefined } : have <= 0 ? { text: "Out of stock", color: RED } : coming > have ? { text: `Short for the next 3 months (need ~${qtyTxt(coming)})`, color: RED } : months != null && months < 2 ? { text: "Under 2 months left", color: AMBER } : { text: "OK", color: GREEN };
      return { sku, cells: [sku, nameOf(sku), catOf(sku), listed ? qtyTxt(have) : "—", qtyTxt(avg), qtyTxt(coming), months == null ? "—" : { text: months.toFixed(1), color: months < 2 ? RED : months < 4 ? AMBER : GREEN }, flag], sev: !listed ? 9 : have <= 0 ? 0 : coming > have ? 1 : months != null && months < 2 ? 2 : 5 };
    }).filter(Boolean).sort((a, b) => a.sev - b.sev || a.sku.localeCompare(b.sku, undefined, { numeric: true }));
    return <ReportTable T={T} title="Stock vs demand" sub={`Stock today vs sales · ${new Date().toLocaleDateString("en-CA")}`}
      note="Stock = the Calgary and Brooks stock sheets now (blankets in rolls). Average monthly sales = the last 12 full months. Next 3 months = what sold in the same 3 months last year. Shortages are listed first."
      controls={<>{picker}<button className="btn" onClick={() => { setStock(null); loadStock().then(setStock); }}>⟳ Re-read stock</button></>}
      summary={<Kpis T={T} items={[["Short / out", items.filter(i => i.sev <= 1).length, "", RED], ["Under 2 months", items.filter(i => i.sev === 2).length, "", AMBER], ["SKUs", items.length]]} />}
      headers={["SKU", "Product", "Category", "In stock", "Avg / month", "Next 3 months (last yr)", "Months left", "Status"]} right={[3, 4, 5, 6]} rows={items.map(i => ({ cells: i.cells }))} />;
  }

  // ── 5. Upcoming demand from open quotes ──
  if (rep === "pquotes") {
    const st = q => (["won", "lost", "cold"].includes(q.quoteStatus) ? q.quoteStatus : "open");
    const saved = (quotes || []).filter(q => q.saved !== false);
    const since = new Date(); since.setFullYear(since.getFullYear() - 1);
    const decided = saved.filter(q => st(q) !== "open" && new Date(q.savedDate || 0) >= since);
    const winRate = decided.length ? decided.filter(q => st(q) === "won").length / decided.length : 0.3;
    const open = saved.filter(q => st(q) === "open");
    const agg = new Map();
    open.forEach(q => {
      const nOpt = Array.isArray(q.options) && q.options.length ? q.options.length : 0;
      (q.lineItems || []).forEach(li => {
        const sku = up(li.sku); if (skip(sku) || !keep(sku)) return;
        const qty = parseFloat(li.qty) || 0; if (!qty) return;
        const share = nOpt && li.option ? 1 / nOpt : 1; // one option of several is chosen
        const a = agg.get(sku) || { quoted: 0, expected: 0, quotes: new Set() };
        a.quoted += qty * share; a.expected += qty * share * winRate; a.quotes.add(q.id); agg.set(sku, a);
      });
    });
    const items = [...agg.entries()].map(([sku, a]) => ({ sku, lead: [nameOf(sku), a.quotes.size], vals: [a.quoted, a.expected] }));
    const rows = grouped(items, catOf, 3);
    return <ReportTable T={T} title="Upcoming demand from open quotes" sub={`${open.length} open quotes · win rate ${Math.round(winRate * 100)}%`}
      note={`Quantities on quotes still open (in progress / followed up), × the win rate over the last 12 months (${Math.round(winRate * 100)}% of decided quotes were won). With options, each option counts as 1 ÷ the number of options (only one is chosen).`}
      controls={picker}
      summary={<Kpis T={T} items={[["Open quotes", open.length], ["Win rate (12 months)", Math.round(winRate * 100) + "%"], ["Expected units", qtyTxt(items.reduce((t, i) => t + i.vals[1], 0))]]} />}
      headers={["SKU / category", "Product", "Quotes", "Quoted qty", "Expected (× win rate)"]} right={[2, 3, 4]} rows={rows} />;
  }

  // ── 6. Pallets & truckloads by month ──
  if (rep === "ppallets") {
    const PALLETS_PER_TRUCK = 26;
    const missing = new Set();
    const per = sku => { const p = prod.get(up(sku)); const pal = parseFloat(p?.pallet) || 0, trk = parseFloat(p?.truckQty ?? p?.truck) || 0; if (!pal) missing.add(sku); return { pal, trk }; };
    const groups = new Map();
    [...byMonth.entries()].filter(([s]) => keep(s)).forEach(([sku, s]) => {
      const { pal, trk } = per(sku); if (!pal) return;
      const key = bySku ? sku : catOf(sku);
      if (!groups.has(key)) groups.set(key, { pallets: allFy.map(() => 0), trucks: allFy.map(() => 0) });
      const g = groups.get(key);
      allFy.forEach((ym, i) => { const q = s.get(ym) || 0; if (!q) return; const pals = q / pal; g.pallets[i] += pals; g.trucks[i] += trk ? q / trk : pals / PALLETS_PER_TRUCK; });
    });
    const fmt1 = n => (n ? (Math.round(n * 10) / 10).toLocaleString("en-CA") : "—");
    const rows = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).flatMap(([k, g]) => {
      const tp = g.pallets.reduce((a, b) => a + b, 0), tt = g.trucks.reduce((a, b) => a + b, 0);
      return tp ? [{ cells: [k, "Pallets", ...g.pallets.map(fmt1), fmt1(tp)] }, { cells: ["", "Truckloads", ...g.trucks.map(fmt1), fmt1(tt)] }] : [];
    });
    const totP = [...groups.values()].reduce((t, g) => t + g.pallets.reduce((a, b) => a + b, 0), 0), totT = [...groups.values()].reduce((t, g) => t + g.trucks.reduce((a, b) => a + b, 0), 0);
    return <ReportTable T={T} title="Pallets & truckloads shipped" sub={`Fiscal ${fy} (Dec – Nov)`}
      note={`Pallets = units ÷ the product's pallet quantity on the price list. Truckloads = units ÷ its truck quantity, or ${PALLETS_PER_TRUCK} pallets per truck where no truck quantity is set. Approximate — partial pallets count as fractions.${missing.size ? ` ${missing.size} SKU(s) have no pallet quantity on the price list and are left out.` : ""}`}
      controls={<>{fySelect}{picker}<label style={{ fontSize: 11 }}><input type="checkbox" checked={bySku} onChange={e => setBySku(e.target.checked)} /> By SKU</label></>}
      summary={<Kpis T={T} items={[["Pallets", fmt1(totP)], ["Truckloads", fmt1(totT)]]} />}
      headers={[bySku ? "SKU" : "Category", "", ...allFy.map(monLabel), "Total"]} right={Array.from({ length: 13 }, (_, i) => i + 2)} rows={rows} />;
  }
  return null;
}
