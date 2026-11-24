// ─── Margin reports (Sales Summary → Reports → Margins) ──────────────────────
// Gross profit on real orders: product lines × the SKU's cost from Costs & Margins (encrypted,
// only for people with "Costs & margins"). Freight, fees and tax are left out — they're not
// products. Lines whose SKU has no cost yet are counted separately so the coverage is clear.
// Everything is in CAD (USD orders converted at the Settings rate), as costs are in CAD.
import { useMemo, useState } from "react";
import { fmtMoney, fmtMonth, fmtDate, orderCurrency, fyOf, fyStart, fyEnd, today } from "./salesUtils";
import { ReportTable, Kpis, RangePicker, useRange } from "./pipelineReports";
import { costOf } from "../pricelist/costs";
import { up, PRICE_FIELDS } from "../pricelist/priceLists";

const GREEN = "#4f9a5a", RED = "#c8553f", AMBER = "#c8a030";
const pct = (a, b) => (b ? (a / b) * 100 : null);
const fmtPct = p => (p === null ? "—" : `${p.toFixed(1)}%`);

// All product lines in the range with sales (CAD), cost and profit
function useLines(orders, costs, rate, from, to, categories) {
  return useMemo(() => {
    const out = [];
    orders.filter(o => o.date >= from && o.date <= to).forEach(o => {
      const r = orderCurrency(o) === "USD" ? rate : 1;
      (o.lines || []).forEach(l => {
        const sales = (l.amount || 0) * r; if (!sales) return;
        const c = costOf(costs, l.sku), qty = l.qty || 0;
        out.push({ o, l, sku: up(l.sku), desc: l.desc, qty, sales, cost: c && qty ? c * qty : null, cat: categories[l.sku] || categories[up(l.sku)] || "Not on the product list" });
      });
    });
    return out;
  }, [orders, costs, rate, from, to, categories]);
}

function tally(list) {
  const g = { sales: 0, qty: 0, costedSales: 0, cost: 0, n: 0, orders: new Set() };
  list.forEach(x => { g.sales += x.sales; g.qty += x.qty; g.orders.add(x.o.orderNo); if (x.cost !== null) { g.costedSales += x.sales; g.cost += x.cost; } });
  g.profit = g.costedSales - g.cost; g.margin = pct(g.profit, g.costedSales); g.coverage = pct(g.costedSales, g.sales);
  return g;
}

export const MARGIN_REPORTS = ["mproduct", "mcustomer", "mcategory", "mmonth"];
const TITLES = { mproduct: "Profit by product (SKU)", mcustomer: "Profit by customer", mcategory: "Profit by category", mmonth: "Profit by month" };

export function MarginReport({ T, rep, orders, settings, costs, categories = {} }) {
  const rg = useRange("fytd");
  const [from, to] = rg.range;
  const [costedOnly, setCostedOnly] = useState(false);
  const rate = Number(settings.usdToCad) || 1.37;
  const lines = useLines(orders, costs, rate, from, to, categories);
  const targets = costs.__targets || {};
  const keyOf = { mproduct: x => x.sku, mcustomer: x => x.o.cust.key, mcategory: x => x.cat, mmonth: x => x.o.date.slice(0, 7) }[rep];
  const groups = useMemo(() => {
    const m = new Map();
    lines.forEach(x => { const k = keyOf(x); (m.get(k) || m.set(k, []).get(k)).push(x); });
    return [...m.entries()].map(([k, list]) => ({ k, list, g: tally(list), first: list[0] }));
  }, [lines, rep]); // eslint-disable-line
  const all = tally(lines);
  let shown = groups.filter(x => !costedOnly || x.g.cost);
  shown = rep === "mmonth" ? shown.sort((a, b) => (a.k < b.k ? -1 : 1)) : shown.sort((a, b) => (!!b.g.cost - !!a.g.cost) || b.g.profit - a.g.profit || b.g.sales - a.g.sales); // with a cost first, by profit
  const label = x => rep === "mproduct" ? x.k : rep === "mcustomer" ? x.first.o.cust.name : rep === "mmonth" ? fmtMonth(x.k + "-01") : x.k;
  const mCell = (m, cat) => ({ text: fmtPct(m), color: m === null ? undefined : m < 0 ? RED : cat && targets[cat] !== undefined ? (m < targets[cat] ? RED : m < targets[cat] + 5 ? AMBER : GREEN) : undefined });
  const headers = [rep === "mproduct" ? "SKU" : rep === "mcustomer" ? "Customer" : rep === "mcategory" ? "Category" : "Month",
    ...(rep === "mproduct" ? ["Description", "Qty"] : []), ...(rep === "mcustomer" ? ["Type"] : []),
    "Sales (CAD)", "Cost", "Gross profit", "Margin", ...(rep === "mproduct" ? ["Avg price", "Unit cost"] : ["Sales with a cost"])];
  const rows = shown.map(x => {
    const g = x.g, cat = rep === "mproduct" ? x.first.cat : rep === "mcategory" ? x.k : null;
    return { onClick: undefined, cells: [label(x),
      ...(rep === "mproduct" ? [x.first.desc || "", g.qty.toLocaleString("en-CA")] : []), ...(rep === "mcustomer" ? [x.first.o.cust.type] : []),
      fmtMoney(g.sales), g.cost ? fmtMoney(g.cost) : { text: "no cost", color: T.tableHeadText }, g.cost ? { text: fmtMoney(g.profit), color: g.profit < 0 ? RED : undefined } : "—", mCell(g.cost ? g.margin : null, cat),
      ...(rep === "mproduct" ? [g.qty ? fmtMoney(g.sales / g.qty, 2) : "—", g.cost && g.qty ? fmtMoney(g.cost / g.qty, 2) : "—"] : [fmtPct(g.coverage)])] };
  });
  rows.push({ bold: true, cells: ["Total", ...(rep === "mproduct" ? ["", all.qty.toLocaleString("en-CA")] : []), ...(rep === "mcustomer" ? [""] : []),
    fmtMoney(all.sales), fmtMoney(all.cost), fmtMoney(all.profit), fmtPct(all.margin), ...(rep === "mproduct" ? ["", ""] : [fmtPct(all.coverage)])] });
  const right = headers.map((h, i) => (/Sales|Cost|profit|Margin|Qty|price|cost/i.test(h) && i > 0 ? i : -1)).filter(i => i >= 0);
  const best = [...groups].filter(x => x.g.cost && x.g.costedSales > 0);
  return <ReportTable T={T} title={TITLES[rep]} sub={`${fmtDate(from)} – ${fmtDate(to)} · product lines only, CAD`}
    note="Gross profit = sales − (units × cost from Products & Price List → Costs & Margins). Freight, fees and tax aren't included. Lines for SKUs without a cost are left out of profit and margin — “Sales with a cost” shows how much of the sales the margin is based on. Margins are coloured against a category's target where one is set."
    controls={<><RangePicker {...rg} /><label style={{ fontSize: 11 }}><input type="checkbox" checked={costedOnly} onChange={e => setCostedOnly(e.target.checked)} /> Only rows with a cost</label></>}
    summary={<Kpis T={T} items={[
      ["Product sales", fmtMoney(all.sales), `${all.orders.size} orders`],
      ["Gross profit", fmtMoney(all.profit), `on ${fmtMoney(all.costedSales)} of sales with a cost`, all.profit >= 0 ? GREEN : RED],
      ["Margin", fmtPct(all.margin), "where costs are known"],
      ["Costs cover", fmtPct(all.coverage), all.coverage !== null && all.coverage < 80 ? "of sales — add more costs for a fuller picture" : "of sales", all.coverage !== null && all.coverage < 80 ? AMBER : undefined],
      ...(best.length && rep !== "mmonth" ? [["Best margin", label(best.sort((a, b) => b.g.margin - a.g.margin)[0]), fmtPct(best[0].g.margin)]] : []),
    ]} />}
    headers={headers} right={right} rows={rows} />;
}

// ── Price list margin check: every product on the current price list, its cost from the calculators
// and the margin at each price level, against the category's target. Problems first.
export function PriceMarginCheck({ T, products = [], categories = {}, costs = {} }) {
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [cat, setCat] = useState("All");
  const targets = costs.__targets || {};
  const catOf = p => categories[p.sku] || categories[up(p.sku)] || "Uncategorized";
  const num = v => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) || !n ? null : n; };
  const all = useMemo(() => products.filter(p => p.sku).map(p => {
    const c = costOf(costs, p.sku), t = targets[catOf(p)], tgt = t === undefined || t === "" ? null : Number(t);
    const ms = PRICE_FIELDS.map(f => { const pr = num(p[f]); return pr && c ? ((pr - c) / pr) * 100 : null; });
    const have = ms.filter(m => m !== null), low = have.length ? Math.min(...have) : null;
    const under = PRICE_FIELDS.filter((f, i) => ms[i] !== null && tgt !== null && ms[i] < tgt).map(f => SHORT[f]);
    const losing = PRICE_FIELDS.filter((f, i) => ms[i] !== null && ms[i] < 0).map(f => SHORT[f]);
    const status = !c ? { rank: 1, text: "No cost — needs a calculator", color: AMBER }
      : losing.length ? { rank: 0, text: `Loses money at ${losing.join(", ")}`, color: RED }
      : under.length ? { rank: 0.5, text: `Under the ${tgt}% target at ${under.join(", ")}`, color: RED }
      : tgt !== null && low !== null && low < tgt + 5 ? { rank: 2, text: "Within 5 points of target", color: AMBER }
      : { rank: 3, text: tgt === null ? "OK (no target set)" : "OK", color: GREEN };
    return { p, c, ms, low, tgt, status, cat: catOf(p) };
  }), [products, costs, categories]); // eslint-disable-line
  const cats = ["All", ...[...new Set(all.map(x => x.cat))].sort()];
  const shown = all.filter(x => (cat === "All" || x.cat === cat) && (!problemsOnly || x.status.rank < 2))
    .sort((a, b) => a.status.rank - b.status.rank || (a.low ?? 999) - (b.low ?? 999) || a.p.sku.localeCompare(b.p.sku));
  const mc = (m, tgt) => ({ text: fmtPct(m), color: m === null ? undefined : m < 0 || (tgt !== null && m < tgt) ? RED : tgt !== null && m < tgt + 5 ? AMBER : undefined });
  const headers = ["SKU", "Description", "Category", "Cost", ...PRICE_FIELDS.map(f => SHORT[f]), "Target", "Check"];
  const rows = shown.map(x => ({ cells: [x.p.sku, x.p.description || x.p.product || "", x.cat, x.c ? fmtMoney(x.c, 2) : { text: "—", color: AMBER },
    ...x.ms.map(m => mc(m, x.tgt)), x.tgt !== null ? `${x.tgt}%` : "—", { text: x.status.text, color: x.status.color }] }));
  const n = k => all.filter(k).length;
  const costed = all.filter(x => x.low !== null);
  return <ReportTable T={T} title="Price list margin check" sub="Current CAD price list · costs from Costs & Margins → Calculators"
    note="Margin = (price − cost) ÷ price at each price level. Red = under the category's target (set on Costs & Margins → Overview) or losing money; amber = within 5 points of the target, or no cost yet (make a calculator for it). Problems are listed first."
    controls={<><select value={cat} onChange={e => setCat(e.target.value)} style={{ height: 28, fontSize: 11 }}>{cats.map(c => <option key={c}>{c}</option>)}</select>
      <label style={{ fontSize: 11 }}><input type="checkbox" checked={problemsOnly} onChange={e => setProblemsOnly(e.target.checked)} /> Problems only</label></>}
    summary={<Kpis T={T} items={[
      ["Products", String(all.length), `${costed.length} with a cost`],
      ["Losing money", String(n(x => x.status.rank === 0)), "at some price level", n(x => x.status.rank === 0) ? RED : GREEN],
      ["Under target", String(n(x => x.status.rank === 0.5)), "at some price level", n(x => x.status.rank === 0.5) ? RED : GREEN],
      ["No cost yet", String(n(x => !x.c)), "need a calculator", n(x => !x.c) ? AMBER : GREEN],
      ["Avg lowest margin", fmtPct(costed.length ? costed.reduce((s, x) => s + x.low, 0) / costed.length : null), "biggest discount, products with a cost"],
    ]} />}
    headers={headers} right={[3, 4, 5, 6, 7, 8, 9]} rows={rows} />;
}
const SHORT = { price: "Unit", palletPrice: "Pallet", prepaid: "Prepaid", prepaidPallet: "Prepaid pallet", truckPrice: "FTL" };
