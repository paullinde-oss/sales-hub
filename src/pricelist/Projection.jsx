// ─── Projection: what the new price list would have brought in ───────────────
// Takes real product lines from synced orders in a period, and re-prices them with each SKU's
// average % change (draft vs current prices). With costs: gross profit before and after.
// Customer-specific prices (White Cap) get the same % as the master SKU, so the % applies to what
// they actually paid. Freight, fees and tax aren't product lines, so they're left out.
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { listenOrders } from "../sales/orderStore";
import { enrichOrders, orderCurrency, today, addDays, fyOf, fyStart, fyEnd, fmtMoney } from "../sales/salesUtils";
import { DEFAULT_ACCOUNTS } from "../sales/accounts";
import { PRICE_FIELDS, priceNum, up } from "./priceLists";
import { costOf } from "./costs";

const GREEN = "#4f9a5a", RED = "#c8553f";

export default function Projection({ T, db, current, draft, categories = {}, costs, showCosts }) {
  const [raw, setRaw] = useState(null);
  const [settings, setSettings] = useState(null);
  const [period, setPeriod] = useState("12m");
  useEffect(() => listenOrders(db, all => setRaw(all), () => setRaw([])), [db]);
  useEffect(() => onSnapshot(doc(db, "config", "salesSettings"), s => setSettings(s.exists() ? s.data() : {}), () => setSettings({})), [db]);

  const t = today(), fy = fyOf(t);
  const periods = { "12m": ["Last 12 months", addDays(t, -365), t], cur: [`FY${fy} so far`, fyStart(fy), t], prev: [`FY${fy - 1}`, fyStart(fy - 1), fyEnd(fy - 1)] };
  const [label, from, to] = periods[period];

  const res = useMemo(() => {
    if (!raw || !settings) return null;
    const orders = enrichOrders(raw, { accounts: DEFAULT_ACCOUNTS, ...settings }, current);
    const rate = Number(settings.usdToCad) || 1.37;
    // average % change per SKU across its prices
    const oldBy = new Map(current.map(p => [up(p.sku), p])), ratio = new Map();
    draft.forEach(p => {
      const o = oldBy.get(up(p.sku)); if (!o) return;
      const rs = PRICE_FIELDS.map(f => [priceNum(o[f]), priceNum(p[f])]).filter(([a, b]) => a > 0 && b > 0).map(([a, b]) => b / a);
      if (rs.length) ratio.set(up(p.sku), rs.reduce((s, x) => s + x, 0) / rs.length);
    });
    const byCat = new Map(), tot = { now: 0, next: 0, costed: 0, cost: 0, nowC: 0, nextC: 0, lines: 0, priced: 0 };
    orders.filter(o => o.date >= from && o.date <= to).forEach(o => {
      const cur = orderCurrency(o);
      (o.lines || []).forEach(l => {
        const amt = (l.amount || 0) * (cur === "USD" ? rate : 1); if (!amt) return;
        const sku = up(l.sku), r = ratio.get(sku) ?? 1, c = costOf(costs, sku);
        const cat = categories[l.sku] || categories[sku] || "Not on the product list";
        const g = byCat.get(cat) || { now: 0, next: 0, nowC: 0, nextC: 0, cost: 0 };
        g.now += amt; g.next += amt * r; tot.now += amt; tot.next += amt * r; tot.lines++;
        if (ratio.has(sku)) tot.priced += amt;
        if (c && l.qty) { const lc = c * l.qty; g.cost += lc; g.nowC += amt; g.nextC += amt * r; tot.cost += lc; tot.nowC += amt; tot.nextC += amt * r; tot.costed += amt; }
        byCat.set(cat, g);
      });
    });
    return { tot, cats: [...byCat.entries()].sort((a, b) => b[1].now - a[1].now) };
  }, [raw, settings, current, draft, from, to, costs, categories]);

  const ch = (a, b) => (a ? `${b >= a ? "+" : "−"}${fmtMoney(Math.abs(b - a))} (${b >= a ? "+" : "−"}${Math.abs(((b - a) / a) * 100).toFixed(1)}%)` : "—");
  const gm = (rev, cost) => (rev ? ((rev - cost) / rev) * 100 : null);
  const box = (title, value, sub, color) => (
    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: "10px 14px", flex: 1, minWidth: 220 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: T.tableHeadText }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: color || T.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.subtext }}>{sub}</div>}
    </div>
  );
  if (!res) return <div style={{ fontSize: 12, color: T.tableHeadText }}>Loading orders…</div>;
  const { tot } = res;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12 }}>If customers buy the same as</span>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={{ height: 28, fontSize: 12 }}>{Object.entries(periods).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <span style={{ fontSize: 11, color: T.tableHeadText }}>Product sales only (no freight, fees or tax), CAD with USD converted. {tot.now ? `${Math.round((tot.priced / tot.now) * 100)}% of those sales are SKUs on this price list.` : ""}</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {box(`Product sales — ${label}`, fmtMoney(tot.now), `${tot.lines} order lines`)}
        {box("Same orders at the new prices", fmtMoney(tot.next), ch(tot.now, tot.next), tot.next >= tot.now ? GREEN : RED)}
        {showCosts && box("Gross profit (where costs are known)", tot.costed ? `${fmtMoney(tot.nowC - tot.cost)} → ${fmtMoney(tot.nextC - tot.cost)}` : "—",
          tot.costed ? `Margin ${gm(tot.nowC, tot.cost).toFixed(1)}% → ${gm(tot.nextC, tot.cost).toFixed(1)}% · costs cover ${Math.round((tot.costed / (tot.now || 1)) * 100)}% of sales` : "Add costs to see profit", tot.costed ? GREEN : undefined)}
      </div>
      <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>Category</th><th style={{ textAlign: "right" }}>Sales {label}</th><th style={{ textAlign: "right" }}>At new prices</th><th style={{ textAlign: "right" }}>Change</th>
            {showCosts && <><th style={{ textAlign: "right" }}>Margin now</th><th style={{ textAlign: "right" }}>Margin at new prices</th></>}</tr></thead>
          <tbody>{res.cats.map(([c, g]) => <tr key={c}>
            <td>{c}</td><td style={{ textAlign: "right" }}>{fmtMoney(g.now)}</td><td style={{ textAlign: "right" }}>{fmtMoney(g.next)}</td>
            <td style={{ textAlign: "right", color: g.next > g.now ? GREEN : g.next < g.now ? RED : undefined }}>{g.next === g.now ? "—" : ch(g.now, g.next)}</td>
            {showCosts && <><td style={{ textAlign: "right" }}>{g.nowC ? `${gm(g.nowC, g.cost).toFixed(1)}%` : "—"}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{g.nextC ? `${gm(g.nextC, g.cost).toFixed(1)}%` : "—"}</td></>}
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
