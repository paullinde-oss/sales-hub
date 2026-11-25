// ─── Costs & Margins → Volume & break-even ───────────────────────────────────
// Blankets and wattles carry a fixed overhead per unit (Brooks G&A share ÷ target volume). This tab shows
// how many have actually sold this period (from the orders) against the TIPPING POINT — the volume where the
// year's overhead is covered and every unit after it carries none — and the profit per truckload of each SKU,
// before and after the overhead is covered (Canada and USA).
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Loader } from "../Loader";
import { listenOrders } from "../sales/orderStore";
import { enrichOrders, fyOf, fyStart, fyEnd, today } from "../sales/salesUtils";
import { DEFAULT_ACCOUNTS } from "../sales/accounts";
import * as M from "./model";

const GREEN = "#34c77b", RED = "#e8472c", AMBER = "#e8a23a";
const money = (v, dp = 0) => v == null || !isFinite(v) ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-CA", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const int = v => v == null || !isFinite(v) ? "—" : Math.round(v).toLocaleString("en-CA");
const num = v => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : null; };

export default function VolumeView({ T, db, R, book, priceOf, productsCAD, change }) {
  const [raw, setRaw] = useState(null), [stored, setStored] = useState(null);
  useEffect(() => onSnapshot(doc(db, "config", "salesSettings"), s => setStored(s.exists() ? s.data() : {}), () => setStored({})), [db]);
  useEffect(() => listenOrders(db, (orders, n, fresh) => { if (fresh || orders.length) setRaw(orders); }, () => setRaw([])), [db]);
  const orders = useMemo(() => raw && stored ? enrichOrders(raw, { accounts: stored.accounts?.length ? stored.accounts : DEFAULT_ACCOUNTS, aliases: stored.aliases || {}, skuMap: stored.skuMap || {}, custTypes: stored.custTypes || {} }, productsCAD) : null, [raw, stored, productsCAD]);

  const t = today(), fyNow = fyOf(t);
  const periods = useMemo(() => {
    const fys = [...new Set((orders || []).map(o => fyOf(o.date)))].sort((a, b) => b - a);
    if (!fys.includes(fyNow)) fys.unshift(fyNow);
    const yrs = [...new Set((orders || []).map(o => +o.date.slice(0, 4)))].sort((a, b) => b - a);
    return [...fys.map(fy => ({ k: "fy" + fy, label: `FY${fy} (Dec–Nov)`, from: fyStart(fy), to: fyEnd(fy) })), ...yrs.map(y => ({ k: "cy" + y, label: `${y} (Jan–Dec)`, from: `${y}-01-01`, to: `${y}-12-31` }))];
  }, [orders, fyNow]);
  const [pk, setPk] = useState("fy" + fyNow);
  const period = periods.find(p => p.k === pk) || periods[0];

  // Units sold per SKU in the period
  const sold = useMemo(() => {
    const m = new Map();
    (orders || []).filter(o => period && o.date >= period.from && o.date <= period.to).forEach(o => (o.lines || []).forEach(l => {
      const k = M.skuKey(l.sku); if (k && l.qty) m.set(k, (m.get(k) || 0) + l.qty);
    }));
    return m;
  }, [orders, period]);

  if (!orders) return <Loader T={T} label="Counting what's been sold…" />;
  const elapsed = period ? Math.min(1, Math.max(0, (Date.parse(t) - Date.parse(period.from)) / (Date.parse(period.to) - Date.parse(period.from) + 864e5))) : 1;
  const card = { background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: 14 };
  const truckOf = sku => { const p = productsCAD.find(x => M.skuKey(x.sku) === M.skuKey(sku)); return num(p?.truckQty ?? p?.truck); };

  const lineFor = method => book.lines.filter(l => l.method === method);
  const Gauge = ({ label, unit, method, rate, tipping, pool, target }) => {
    const ls = lineFor(method), keys = new Set(ls.flatMap(l => l.skus.map(s => M.skuKey(s.sku))).filter(Boolean));
    const units = [...keys].reduce((s, k) => s + (sold.get(k) || 0), 0);
    const covered = tipping ? Math.min(1, units / tipping) : null;
    const onPace = covered != null ? covered >= elapsed : null;
    return <div style={{ ...card, flex: "1 1 420px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 10 }}>{ls.length ? `${ls.map(l => l.name).join(", ")} · ${money(rate, 2)} overhead per ${unit}` : `No product line uses the ${unit} rate yet`}</div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 10 }}>
        {[["Sold", int(units) + " " + unit + "s"], ["Tipping point", tipping ? int(tipping) + " " + unit + "s" : "—"], ["Overhead covered", money(units * rate)], ["Still to cover", pool != null ? money(Math.max(0, pool - units * rate)) : "—"], ["Your target", target ? int(target) : "—"]]
          .map(([k, v]) => <div key={k}><div style={{ fontSize: 10, color: T.tableHeadText, textTransform: "uppercase", letterSpacing: ".04em" }}>{k}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div></div>)}
      </div>
      {tipping ? <>
        <div style={{ position: "relative", height: 16, background: T.tableHead, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ width: `${covered * 100}%`, height: "100%", background: covered >= 1 ? GREEN : onPace ? GREEN : AMBER }} />
          {elapsed < 1 && <div title="How far through the period we are" style={{ position: "absolute", top: -2, bottom: -2, left: `${elapsed * 100}%`, width: 2, background: T.text }} />}
        </div>
        <div style={{ fontSize: 12, marginTop: 6, color: covered >= 1 ? GREEN : onPace ? T.text : AMBER }}>
          {covered >= 1 ? `✓ Overhead covered — every ${unit} after ${int(tipping)} carries no overhead (${int(units - tipping)} so far).`
            : `${Math.round(covered * 100)}% of the overhead covered, ${Math.round(elapsed * 100)}% of the way through the period — ${onPace ? "on pace" : "behind pace"}. ${int(tipping - units)} more ${unit}s to the tipping point.`}
        </div>
      </> : <div style={{ fontSize: 12, color: AMBER }}>Fill in Brooks G&amp;A on Overhead &amp; targets to see the tipping point.</div>}
    </div>;
  };

  // Profit per truckload for the blanket + wattle lines
  const rows = book.lines.filter(l => ["blanket", "wattle"].includes(l.method)).flatMap(l => l.skus.filter(s => s.sku).map(s => {
    const ca = M.computeSku(l, s, { rates: R, shared: book.shared, market: "ca", priceOf, level: "price" });
    const us = M.computeSku(l, s, { rates: R, shared: book.shared, market: "us", priceOf });
    const listedPer = truckOf(s.sku), per = listedPer || num(s.perTruck), u = sold.get(M.skuKey(s.sku)) || 0;
    const truck = r => r.profit != null && per ? r.profit * per : null, after = r => r.profit != null && per ? (r.profit + r.overhead) * per : null;
    return { l, s, per, listedPer, u, ca: [truck(ca), after(ca)], us: [truck(us), after(us)] };
  })).sort((a, b) => (b.ca[1] ?? -1e9) - (a.ca[1] ?? -1e9));
  const td = { padding: "5px 8px", borderBottom: `1px solid ${T.border}`, fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const cell = v => <td style={{ ...td, color: v < 0 ? RED : undefined }}>{money(v)}</td>;

  return <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
      <b style={{ fontSize: 12 }}>Period</b>
      <select value={period?.k} onChange={e => setPk(e.target.value)} style={{ height: 28, fontSize: 12 }}>{periods.map(p => <option key={p.k} value={p.k}>{p.label}</option>)}</select>
      <span style={{ fontSize: 11, color: T.tableHeadText }}>Units sold come from the order confirmations (Brooks + Calgary, corrections included).</span>
    </div>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
      <Gauge label="Erosion blankets" unit="roll" method="blanket" rate={R.blanketRate} tipping={R.blanketTipping} pool={R.blanketPool} target={num(book.settings.brooks?.blanketTarget)} />
      <Gauge label="Straw wattles" unit="wattle" method="wattle" rate={R.wattleRate} tipping={R.wattleTipping} pool={R.wattlePool} target={num(book.settings.brooks?.wattleTarget)} />
    </div>
    <div style={{ ...card, padding: 0, overflowX: "auto" }}>
      <div style={{ padding: "12px 14px 4px", fontSize: 14, fontWeight: 700 }}>Profit per truckload</div>
      <div style={{ padding: "0 14px 10px", fontSize: 11, color: T.tableHeadText, lineHeight: 1.6 }}>
        Profit per unit × units on a truck (Truck qty from the price list, or type it in the amber box). <b>With overhead</b> = after the full fully-loaded cost. <b>Overhead covered</b> = once the year's tipping point is passed, the overhead per unit is already paid, so each truck earns this much more. USA uses the USA price list, commission, tariff and FOB shipping.
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%", color: T.text }}>
        <thead>
          <tr>{["", "", "", "", "Canada", "", "USA", ""].map((h, i) => <th key={i} style={{ ...td, fontSize: 10, color: T.tableHeadText, background: T.tableHead, textAlign: i >= 4 ? "center" : "left", borderBottom: "none" }} colSpan={1}>{h}</th>)}</tr>
          <tr>{["SKU", "Description", "Per truck", "Sold (≈ trucks)", "With overhead", "Overhead covered", "With overhead", "Overhead covered"].map((h, i) => <th key={i} style={{ ...td, fontSize: 10, textTransform: "uppercase", color: T.tableHeadText, background: T.tableHead, textAlign: i < 2 ? "left" : "right" }}>{h}</th>)}</tr>
        </thead>
        <tbody>{rows.map(({ l, s, per, listedPer, u, ca, us }) => <tr key={s.id}>
          <td style={{ ...td, textAlign: "left", fontFamily: "monospace", fontSize: 11 }}>{s.sku}</td>
          <td style={{ ...td, textAlign: "left", color: T.subtext, whiteSpace: "normal" }}>{s.desc} <span style={{ fontSize: 10, color: T.tableHeadText }}>· {l.name}</span></td>
          <td style={td}>{listedPer ? int(listedPer) : <input type="number" value={s.perTruck ?? ""} placeholder="?" title="Not on the price list — type how many fit on a truck (saved with Save changes)"
            onChange={e => change(b => { const x = b.lines.find(y => y.id === l.id)?.skus.find(y => y.id === s.id); if (x) x.perTruck = e.target.value === "" ? null : +e.target.value; })}
            style={{ width: 64, height: 24, fontSize: 12, textAlign: "right", border: `1px solid ${AMBER}`, background: T.inputBg || T.cardBg, color: T.text }} />}</td>
          <td style={td}>{int(u)}{per ? <span style={{ color: T.tableHeadText }}> ({(u / per).toFixed(1)})</span> : ""}</td>
          {cell(ca[0])}{cell(ca[1])}{cell(us[0])}{cell(us[1])}
        </tr>)}</tbody>
      </table>
      {!rows.length && <div style={{ padding: 14, fontSize: 12, color: T.tableHeadText }}>No blanket or wattle product lines yet.</div>}
    </div>
  </div>;
}
