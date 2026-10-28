// ─── Pipeline, lead and forecasting reports ─────────────────────────────────
// Built from the Quote Maker quotes, Lead Tracking leads (+ ad spend) and the
// synced order confirmations. Each report renders its own controls and table.
import { useState, useMemo } from "react";
import {
  today, addDays, fyOf, fyStart, fyEnd, daysBetween, parseYmd, ymd, fmtDate, fmtMonth, fmtMoney, fmtQty,
  sumOrders, displayValue, groupBy, downloadCSV, quoteDate, presetRange, PRESETS,
} from "./salesUtils";
import { useTableSort } from "./tableSort";
import { customerOf } from "./accounts";

const GREEN = "#5a9e5a", RED = "#c86a5a";
const STATUS_LABEL = { won: "Won", lost: "Lost", cold: "Went cold", inprogress: "Open" };
const qStatus = q => (["won", "lost", "cold"].includes(q.quoteStatus) ? q.quoteStatus : "inprogress");
export const quoteValue = (q, rate) => {
  const v = (q.lineItems || []).reduce((s, li) => s + (parseFloat(li.unitPrice) || 0) * (parseInt(li.qty) || 0), 0);
  return q.currency === "USD" ? v * rate : v;
};
const pct = (a, b) => (b ? (a / b) * 100 : null);
const fmtPct = p => (p == null ? "—" : `${p.toFixed(0)}%`);
const chg = (a, b) => (b ? `${a >= b ? "▲" : "▼"} ${Math.abs(((a - b) / b) * 100).toFixed(0)}%` : a ? "new" : "");
const leadDate = l => { const d = l.lastContact ? new Date(l.lastContact) : null; return d && !isNaN(d) ? ymd(d) : ""; };
// Win rate counts decided quotes only: won ÷ (won + lost + went cold)
const winRate = g => pct(g.won, g.won + g.lost + g.cold);

// ── Shared table with CSV / print ───────────────────────────────────────────
function ReportTable({ T, title, sub, note, headers, rows, csvRows, right = [], controls, summary }) {
  const isRight = i => right.includes(i);
  const ts = useTableSort();
  const shown = ts.apply(rows, r => r.cells, r => r.bold);
  const print = () => {
    const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html><head><title>${esc(title)}</title><style>body{font-family:Helvetica,Arial,sans-serif;font-size:11px;padding:24px}h1{font-size:16px;margin:0}div{color:#777;margin:4px 0 14px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f2f2f0;font-size:10px;text-transform:uppercase}.r{text-align:right}</style></head><body><h1>BMP Supplies — ${esc(title)}</h1><div>${esc(sub || "")} · printed ${new Date().toLocaleDateString("en-CA")}</div><table><thead><tr>${headers.map((h, i) => `<th class="${isRight(i) ? "r" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${shown.map(r => `<tr>${r.cells.map((c, i) => `<td class="${isRight(i) ? "r" : ""}">${esc(typeof c === "object" && c !== null ? c.text : c)}</td>`).join("")}</tr>`).join("")}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{title}</div>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => downloadCSV(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, headers, csvRows || shown.map(r => r.cells.map(c => (typeof c === "object" && c !== null ? c.text : c))))}>Export CSV</button>
        <button className="btn" onClick={print}>Print / PDF</button>
      </div>
      {note && <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 10, lineHeight: 1.5 }}>{note}</div>}
      {controls && <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>{controls}</div>}
      {summary}
      {rows.length > 3 && <div style={{ marginBottom: 8 }}><input value={ts.q} onChange={e => ts.setQ(e.target.value)} placeholder="Filter rows…" style={{ fontSize: 11, height: 26, width: 220 }} /> <span style={{ fontSize: 10, color: T.tableHeadText }}>Click a column heading to sort</span></div>}
      <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, overflowX: "auto" }}>
        {!rows.length ? <div style={{ fontSize: 12, color: T.tableHeadText, padding: 12 }}>Nothing to show for these settings.</div> : (
          <table className="data-table">
            <thead><tr>{headers.map((h, i) => <th key={i} onClick={() => ts.toggle(i)} title="Click to sort" style={{ textAlign: isRight(i) ? "right" : "left", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>{h}{ts.arrow(i)}</th>)}</tr></thead>
            <tbody>{shown.map((r, i) => (
              <tr key={i} onClick={r.onClick} style={{ fontWeight: r.bold ? 600 : 400, cursor: r.onClick ? "pointer" : "default", background: r.bg }}>
                {r.cells.map((c, j) => {
                  const o = typeof c === "object" && c !== null ? c : { text: c };
                  return <td key={j} style={{ textAlign: isRight(j) ? "right" : "left", color: o.color, fontVariantNumeric: "tabular-nums", whiteSpace: j === 0 ? "normal" : "nowrap" }}>{o.text}</td>;
                })}
              </tr>))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpis({ T, items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(170px, 1fr))`, gap: 10, marginBottom: 12 }}>
      {items.map(([label, value, sub, color]) => (
        <div key={label} style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: T.tableHeadText }}>{label}</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: T.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: color || T.subtext }}>{sub}</div>}
        </div>
      ))}
    </div>
  );
}

function RangePicker({ preset, setPreset, custom, setCustom }) {
  return <>
    <select value={preset} onChange={e => setPreset(e.target.value)} style={{ fontSize: 11, height: 28 }}>
      {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
    {preset === "custom" && <span style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 11 }}>
      <input type="date" value={custom[0]} onChange={e => setCustom([e.target.value, custom[1]])} style={{ fontSize: 11, height: 26 }} /> to
      <input type="date" value={custom[1]} onChange={e => setCustom([custom[0], e.target.value])} style={{ fontSize: 11, height: 26 }} />
    </span>}
  </>;
}
const useRange = (initial = "fytd") => {
  const [preset, setPreset] = useState(initial);
  const [custom, setCustom] = useState(presetRange("fytd"));
  const range = preset === "custom" ? custom : presetRange(preset);
  return { preset, setPreset, custom, setCustom, range };
};
const shiftYear = d => `${+d.slice(0, 4) - 1}${d.slice(4)}`;

// Visible quotes with a date, value (CAD) and status; John-type users see only their own
function useQuotes(quotes, rate, ownOnly, loginName) {
  return useMemo(() => (quotes || [])
    .filter(q => q.saved !== false && (q.lineItems || []).length && (!ownOnly || q.savedBy === loginName))
    .map(q => ({ q, date: quoteDate(q), value: quoteValue(q, rate), status: qStatus(q), by: q.savedBy || "—", kind: q.isNewLead ? "New lead (End User)" : "Existing customer / distributor" }))
    .filter(x => x.date), [quotes, rate, ownOnly, loginName]);
}

function tally(list) {
  const g = { n: 0, won: 0, lost: 0, cold: 0, open: 0, value: 0, wonValue: 0, decidedValue: 0 };
  for (const x of list) {
    g.n++; g.value += x.value;
    if (x.status === "won") { g.won++; g.wonValue += x.value; }
    else if (x.status === "lost") g.lost++;
    else if (x.status === "cold") g.cold++;
    else g.open++;
    if (x.status !== "inprogress") g.decidedValue += x.value;
  }
  return g;
}

// ═════════════════════════════════════════════════════════════════════════════
export function QuoteWinRateReport({ T, quotes, settings, ownOnly, loginName, initialBy = "by", title = "Quote win rate" }) {
  const rate = Number(settings.usdToCad) || 1.37;
  const all = useQuotes(quotes, rate, ownOnly, loginName);
  const rg = useRange("fytd");
  const [by, setBy] = useState(initialBy);
  // Distributor / End User the same way Sales Summary decides it for orders (account list + Settings)
  const typeOf = useMemo(() => {
    const cache = new Map();
    return q => { const name = q.company || q.name || "Unknown"; if (!cache.has(name)) cache.set(name, customerOf({ customer: name }, settings.accounts || [], settings.aliases || {}, settings.custTypes || {}).type === "Distributor" ? "Distributors" : "End Users"); return cache.get(name); };
  }, [settings.accounts, settings.aliases, settings.custTypes]);
  const [from, to] = rg.range;
  const cur = all.filter(x => x.date >= from && x.date <= to);
  const prev = all.filter(x => x.date >= shiftYear(from) && x.date <= shiftYear(to));
  const keyOf = x => by === "by" ? x.by : by === "month" ? x.date.slice(0, 7) : by === "kind" ? x.kind : by === "type" ? typeOf(x.q) : by === "currency" ? (x.q.currency || "CAD") : "All quotes";
  const labelOf = k => by === "month" ? fmtMonth(k + "-01") : k;
  const groups = [...new Set(cur.map(keyOf))].sort((a, b) => (by === "month" ? (a < b ? -1 : 1) : 0));
  const row = (label, list, prevList, bold) => {
    const g = tally(list), p = prevList ? tally(prevList) : null, wr = winRate(g), pwr = p ? winRate(p) : null;
    return { bold, cells: [label, g.n, g.won, g.lost, g.cold, g.open,
      { text: fmtPct(wr), color: wr == null ? undefined : wr >= 50 ? GREEN : wr < 25 ? RED : undefined },
      pwr == null ? "—" : fmtPct(pwr),
      fmtMoney(g.value), fmtMoney(g.wonValue), fmtPct(pct(g.wonValue, g.decidedValue)), g.n ? fmtMoney(g.value / g.n) : "—"] };
  };
  const rows = groups.map(k => row(labelOf(k), cur.filter(x => keyOf(x) === k), by === "month" ? null : prev.filter(x => keyOf(x) === k)));
  rows.push(row("Total", cur, prev, true));
  const t = tally(cur), pt = tally(prev);
  const linked = Object.values(settings.quoteLinks || {}).length;
  const typeKpis = by === "type" && (() => {
    const d = tally(cur.filter(x => typeOf(x.q) === "Distributors")), e = tally(cur.filter(x => typeOf(x.q) === "End Users"));
    const dw = winRate(d), ew = winRate(e);
    const better = dw == null || ew == null ? "" : dw === ew ? "Same win rate" : `${dw > ew ? "Distributors" : "End Users"} win ${Math.abs(dw - ew).toFixed(0)} points more often`;
    return [
      ["Distributor win rate", fmtPct(dw), `${d.won} won · ${d.lost} lost · ${d.cold} went cold`, dw != null && ew != null ? (dw >= ew ? GREEN : RED) : undefined],
      ["End User win rate", fmtPct(ew), `${e.won} won · ${e.lost} lost · ${e.cold} went cold`, dw != null && ew != null ? (ew >= dw ? GREEN : RED) : undefined],
      ["Difference", better || "—", "won ÷ (won + lost + went cold)"],
      ["Avg quote", `${d.n ? fmtMoney(d.value / d.n) : "—"} / ${e.n ? fmtMoney(e.value / e.n) : "—"}`, "Distributors / End Users"],
      ["Won $", `${fmtMoney(d.wonValue)} / ${fmtMoney(e.wonValue)}`, "Distributors / End Users"],
    ];
  })();
  return <ReportTable T={T} title={title}
    sub={`Quotes dated ${fmtDate(from)} – ${fmtDate(to)}`}
    note="Win rate = won ÷ (won + lost + went cold). Open quotes aren't counted until they're decided. “Last year” is the same dates one year earlier. Quote values are converted to CAD. Marking quotes Won from Quote Matches keeps this accurate."
    controls={<>
      <RangePicker {...rg} />
      <span style={{ fontSize: 11 }}>by</span>
      <select value={by} onChange={e => setBy(e.target.value)} style={{ fontSize: 11, height: 28 }}>
        <option value="by">Quoted by</option><option value="month">Month</option><option value="type">Distributors vs End Users</option><option value="kind">New lead vs existing customer</option><option value="currency">Currency</option><option value="all">All together</option>
      </select>
    </>}
    summary={<Kpis T={T} items={typeKpis || [
      ["Quotes sent", t.n, `last year same dates: ${pt.n}`],
      ["Win rate", fmtPct(winRate(t)), winRate(pt) == null ? "" : `last year: ${fmtPct(winRate(pt))}`, winRate(t) != null && winRate(pt) != null ? (winRate(t) >= winRate(pt) ? GREEN : RED) : undefined],
      ["Value quoted", fmtMoney(t.value), pt.value ? `${chg(t.value, pt.value)} vs last year` : ""],
      ["Value won", fmtMoney(t.wonValue), pt.wonValue ? `${chg(t.wonValue, pt.wonValue)} vs last year` : ""],
      ["Still open", `${t.open} · ${fmtMoney(cur.filter(x => x.status === "inprogress").reduce((s, x) => s + x.value, 0))}`, `${linked} quotes linked to orders`],
    ]} />}
    headers={["Group", "Quotes", "Won", "Lost", "Went cold", "Open", "Win rate", "Win rate last yr", "Quoted $", "Won $", "$ win rate", "Avg quote"]}
    right={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]} rows={rows} />;
}

// ═════════════════════════════════════════════════════════════════════════════
export function OpenPipelineReport({ T, quotes, settings, ownOnly, loginName }) {
  const rate = Number(settings.usdToCad) || 1.37;
  const all = useQuotes(quotes, rate, ownOnly, loginName);
  const [maxAge, setMaxAge] = useState(180);
  // Each person's win rate over the last 12 months drives the chance on their open quotes
  const yearAgo = addDays(today(), -365);
  const rateBy = {};
  const overall = winRate(tally(all.filter(x => x.date >= yearAgo))) ?? 0;
  [...new Set(all.map(x => x.by))].forEach(b => { const g = tally(all.filter(x => x.by === b && x.date >= yearAgo)); const d = g.won + g.lost + g.cold; rateBy[b] = d >= 5 ? winRate(g) : overall; });
  // Older quotes rarely close — scale the chance down with age
  const ageFactor = d => (d <= 30 ? 1 : d <= 60 ? 0.75 : d <= 90 ? 0.5 : 0.25);
  const open = all.filter(x => x.status === "inprogress").map(x => {
    const age = daysBetween(x.date, today());
    const chance = (rateBy[x.by] ?? overall) * ageFactor(age);
    return { ...x, age, chance, expected: x.value * chance / 100 };
  }).filter(x => x.age <= maxAge).sort((a, b) => b.expected - a.expected);
  const buckets = [["0–30 days", 0, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["Over 90 days", 91, 1e9]].map(([l, a, b]) => {
    const xs = open.filter(x => x.age >= a && x.age <= b);
    return [l, xs.length, xs.reduce((s, x) => s + x.value, 0), xs.reduce((s, x) => s + x.expected, 0)];
  });
  const tv = open.reduce((s, x) => s + x.value, 0), te = open.reduce((s, x) => s + x.expected, 0);
  return <ReportTable T={T} title="Open pipeline & expected wins"
    sub={`Open quotes up to ${maxAge} days old`}
    note={`Expected value = quote value × chance of winning. The chance is each person's win rate over the last 12 months (overall ${fmtPct(overall)} when they have fewer than 5 decided quotes), reduced as the quote ages: full under 30 days, 75% at 31–60, 50% at 61–90, 25% after. Marking old quotes Lost or Cold in Pipeline keeps this realistic.`}
    controls={<><span style={{ fontSize: 11 }}>Include quotes up to</span>
      <select value={maxAge} onChange={e => setMaxAge(+e.target.value)} style={{ fontSize: 11, height: 28 }}>{[30, 60, 90, 180, 365, 100000].map(d => <option key={d} value={d}>{d > 9999 ? "any age" : `${d} days old`}</option>)}</select></>}
    summary={<>
      <Kpis T={T} items={[["Open quotes", open.length], ["Open value", fmtMoney(tv)], ["Expected wins", fmtMoney(te), "weighted by win chance"], ["Overall win rate", fmtPct(overall), "last 12 months"]]} />
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {buckets.map(([l, n, v, e]) => <div key={l} style={{ flex: "1 1 160px", background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: "8px 12px", fontSize: 11, color: T.subtext }}>
          <b style={{ color: T.text }}>{l}</b><br />{n} quotes · {fmtMoney(v)}<br />expected {fmtMoney(e)}</div>)}
      </div>
    </>}
    headers={["Customer", "Quote #", "Quoted by", "Quote date", "Age (days)", "Value (CAD)", "Win chance", "Expected"]}
    right={[4, 5, 6, 7]}
    rows={open.map(x => ({ cells: [x.q.company || x.q.name || "—", x.q.quoteNum || "", x.by, fmtDate(x.date), { text: x.age, color: x.age > 90 ? RED : undefined }, fmtMoney(x.value), fmtPct(x.chance), fmtMoney(x.expected)] }))} />;
}

// ═════════════════════════════════════════════════════════════════════════════
export function QuoteToOrderReport({ T, quotes, orders, settings, ownOnly, loginName }) {
  const rate = Number(settings.usdToCad) || 1.37;
  const byId = new Map((quotes || []).map(q => [String(q.id), q]));
  const byNo = new Map(orders.map(o => [o.orderNo, o]));
  const toCad = o => (o.override?.currency || o.currency) === "USD" ? (o.total || 0) * rate : (o.total || 0);
  const links = Object.entries(settings.quoteLinks || {}).map(([no, qid]) => ({ o: byNo.get(no), q: byId.get(qid) }))
    .filter(x => x.o && x.q && (!ownOnly || x.q.savedBy === loginName))
    .map(x => { const qd = quoteDate(x.q); return { ...x, qd, days: qd ? daysBetween(qd, x.o.date) : null, qv: quoteValue(x.q, rate), ov: toCad(x.o) }; })
    .sort((a, b) => (a.o.date < b.o.date ? 1 : -1));
  const ds = links.map(x => x.days).filter(d => d != null && d >= 0).sort((a, b) => a - b);
  const median = ds.length ? ds[Math.floor(ds.length / 2)] : null;
  const tq = links.reduce((s, x) => s + x.qv, 0), to = links.reduce((s, x) => s + x.ov, 0);
  return <ReportTable T={T} title="Won quotes → orders"
    note="Quotes linked to an order in Quote Matches: how long it took from quote to order, and how the order compared with what was quoted."
    summary={<Kpis T={T} items={[["Linked quotes", links.length], ["Typical time to order", median == null ? "—" : `${median} days`, "median"], ["Quoted", fmtMoney(tq)], ["Ordered", fmtMoney(to), tq ? `${chg(to, tq)} vs quoted` : ""]]} />}
    headers={["Customer", "Quote #", "Quoted by", "Quote date", "Order #", "Order date", "Days to order", "Quoted (CAD)", "Ordered (CAD)", "Difference"]}
    right={[6, 7, 8, 9]}
    rows={links.map(x => ({ cells: [x.o.cust?.name || x.o.customer, x.q.quoteNum || "", x.q.savedBy || "—", fmtDate(x.qd), x.o.orderNo, fmtDate(x.o.date), x.days ?? "—", fmtMoney(x.qv), fmtMoney(x.ov), { text: `${x.ov - x.qv >= 0 ? "+" : "−"}${fmtMoney(Math.abs(x.ov - x.qv))}`, color: x.ov >= x.qv ? GREEN : RED }] }))} />;
}

// ═════════════════════════════════════════════════════════════════════════════
export function LeadReport({ T, leads, adSpend, orders, opts }) {
  const years = [...new Set([String(new Date().getFullYear()), ...(leads || []).map(l => String(l.year || "")).filter(Boolean)])].sort().reverse();
  const [year, setYear] = useState(years[0]);
  const [by, setBy] = useState("source");
  const yl = (leads || []).filter(l => String(l.year) === year);
  const pl = (leads || []).filter(l => String(l.year) === String(+year - 1));
  const keyOf = l => by === "source" ? (l.leadSource || "Unknown") : by === "type" ? (l.type || "Unknown") : by === "month" ? (leadDate(l).slice(0, 7) || "No date") : (STATUS_LABEL[l.status] || "Open");
  const t = list => {
    const g = { n: list.length, won: 0, lost: 0, cold: 0, open: 0, pot: 0, wonVal: 0 };
    list.forEach(l => { const s = ["won", "lost", "cold"].includes(l.status) ? l.status : "open"; g[s]++; const v = parseFloat(l.potentialValue) || 0; g.pot += v; if (s === "won") g.wonVal += v; });
    return g;
  };
  const conv = g => pct(g.won, g.won + g.lost + g.cold);
  const spendOf = y => { const s = adSpend?.[y] || {}; return (parseFloat(s.google) || 0) + (parseFloat(s.other) || 0); };
  const spend = spendOf(year), pspend = spendOf(String(+year - 1));
  const g = t(yl), pg = t(pl);
  // Real End User sales from synced orders in the same calendar year
  const euSales = displayValue(sumOrders(orders.filter(o => o.cust?.type === "End User" && o.date.slice(0, 4) === year), opts), "combined");
  const keys = [...new Set(yl.map(keyOf))].sort();
  const row = (label, list, plist, bold) => {
    const a = t(list), b = plist ? t(plist) : null;
    return { bold, cells: [by === "month" && label !== "Total" && label !== "No date" ? fmtMonth(label + "-01") : label, a.n, b ? b.n : "—", a.won, a.lost, a.cold, a.open,
      { text: fmtPct(conv(a)), color: conv(a) == null ? undefined : conv(a) >= 40 ? GREEN : conv(a) < 20 ? RED : undefined }, b ? fmtPct(conv(b)) : "—", fmtMoney(a.pot), fmtMoney(a.wonVal)] };
  };
  const rows = keys.map(k => row(k, yl.filter(l => keyOf(l) === k), by === "month" ? null : pl.filter(l => keyOf(l) === k)));
  rows.push(row("Total", yl, pl, true));
  return <ReportTable T={T} title={`Lead tracking — ${year}`}
    sub={`Leads for ${year} compared with ${+year - 1}`}
    note="From Lead Tracking. Conversion = won ÷ (won + lost + went cold). Values are each lead's potential value. Ad spend comes from Lead Tracking; End User sales are actual orders from End User customers in the Sales Summary for the same calendar year."
    controls={<>
      <select value={year} onChange={e => setYear(e.target.value)} style={{ fontSize: 11, height: 28 }}>{years.map(y => <option key={y}>{y}</option>)}</select>
      <span style={{ fontSize: 11 }}>by</span>
      <select value={by} onChange={e => setBy(e.target.value)} style={{ fontSize: 11, height: 28 }}>
        <option value="source">Lead source</option><option value="type">Distributor / End User</option><option value="month">Month (last contact)</option><option value="status">Status</option>
      </select>
    </>}
    summary={<Kpis T={T} items={[
      ["Leads", g.n, `${+year - 1}: ${pg.n}`],
      ["Conversion", fmtPct(conv(g)), conv(pg) == null ? "" : `${+year - 1}: ${fmtPct(conv(pg))}`, conv(g) != null && conv(pg) != null ? (conv(g) >= conv(pg) ? GREEN : RED) : undefined],
      ["Won value", fmtMoney(g.wonVal), pg.wonVal ? `${chg(g.wonVal, pg.wonVal)} vs ${+year - 1}` : ""],
      ["Ad spend", fmtMoney(spend), pspend ? `${+year - 1}: ${fmtMoney(pspend)}` : ""],
      ["Cost per lead", g.n && spend ? fmtMoney(spend / g.n) : "—", g.won && spend ? `${fmtMoney(spend / g.won)} per win` : ""],
      ["End User sales", fmtMoney(euSales), spend ? `${(euSales / spend).toFixed(1)}× ad spend` : "from order confirmations"],
    ]} />}
    headers={["Group", "Leads", `Leads ${+year - 1}`, "Won", "Lost", "Went cold", "Open", "Conversion", `Conv. ${+year - 1}`, "Potential $", "Won $"]}
    right={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} rows={rows} />;
}

// ═════════════════════════════════════════════════════════════════════════════
export function SalesForecastReport({ T, orders, opts, currencyMode, quotes, settings, ownOnly, loginName }) {
  const fy = fyOf(today()), now = today();
  const val = list => displayValue(sumOrders(list, opts), currencyMode);
  const pool = orders.filter(o => currencyMode === "combined" || (o.override?.currency || o.currency) === currencyMode);
  const ytd = val(pool.filter(o => o.date >= fyStart(fy) && o.date <= now));
  const lytd = val(pool.filter(o => o.date >= fyStart(fy - 1) && o.date <= addDays(now, -365)));
  const growth = lytd ? ytd / lytd : null;
  const [mode, setMode] = useState("growth");
  const factor = mode === "flat" ? 1 : growth ?? 1;
  const rate = Number(settings.usdToCad) || 1.37;
  const months = Array.from({ length: 12 }, (_, i) => { const d = parseYmd(fyStart(fy)); d.setMonth(d.getMonth() + i); return ymd(d).slice(0, 7); });
  const curMonth = now.slice(0, 7);
  let projected = 0;
  const rows = months.map(m => {
    const pm = `${+m.slice(0, 4) - 1}${m.slice(4)}`;
    const last = val(pool.filter(o => o.date.slice(0, 7) === pm));
    const actual = val(pool.filter(o => o.date.slice(0, 7) === m));
    const done = m < curMonth, isCur = m === curMonth;
    const fc = done ? null : Math.max(actual, last * factor);
    projected += done ? actual : fc;
    return { bg: isCur ? "rgba(200,169,110,.08)" : undefined, cells: [fmtMonth(m + "-01") + (isCur ? " (this month)" : ""), fmtMoney(last), done || isCur ? fmtMoney(actual) : "—", fc == null ? "—" : fmtMoney(fc), done ? { text: chg(actual, last), color: actual >= last ? GREEN : RED } : ""] };
  });
  const lastFyTotal = val(pool.filter(o => o.date >= fyStart(fy - 1) && o.date <= fyEnd(fy - 1)));
  rows.push({ bold: true, cells: ["Fiscal year", fmtMoney(lastFyTotal), fmtMoney(ytd), fmtMoney(projected), lastFyTotal ? { text: chg(projected, lastFyTotal), color: projected >= lastFyTotal ? GREEN : RED } : ""] });
  // Weighted open quotes on top, using the overall 12-month win rate
  const all = (quotes || []).filter(q => q.saved !== false && (!ownOnly || q.savedBy === loginName)).map(q => ({ date: quoteDate(q), value: quoteValue(q, rate), status: qStatus(q) })).filter(x => x.date);
  const wr = (winRate(tally(all.filter(x => x.date >= addDays(now, -365)))) ?? 0) / 100;
  const openVal = all.filter(x => x.status === "inprogress" && daysBetween(x.date, now) <= 90).reduce((s, x) => s + x.value, 0);
  return <ReportTable T={T} title={`Sales forecast — FY${fy}`}
    sub={`Projection as of ${fmtDate(now)}`}
    note={`Months still to come are forecast from the same month last year × this year's pace (FY${fy} to date vs the same dates last year). This month shows whichever is higher: actual so far or the forecast. Open quotes from the last 90 days, weighted by the 12-month win rate, are shown separately as possible upside.`}
    controls={<select value={mode} onChange={e => setMode(e.target.value)} style={{ fontSize: 11, height: 28 }}>
      <option value="growth">Forecast at this year's pace ({growth ? `${((growth - 1) * 100).toFixed(0)}% vs last year` : "no last-year data"})</option>
      <option value="flat">Forecast flat (same as last year)</option>
    </select>}
    summary={<Kpis T={T} items={[
      [`FY${fy} to date`, fmtMoney(ytd), lytd ? `${chg(ytd, lytd)} vs same dates last year` : "", ytd >= lytd ? GREEN : RED],
      ["Projected full year", fmtMoney(projected), lastFyTotal ? `FY${fy - 1} was ${fmtMoney(lastFyTotal)}` : ""],
      ["Open-quote upside", fmtMoney(openVal * wr), `${fmtMoney(openVal)} open × ${fmtPct(wr * 100)} win rate`],
      ["With upside", fmtMoney(projected + openVal * wr)],
    ]} />}
    headers={["Month", `FY${fy - 1} actual`, `FY${fy} actual`, `FY${fy} forecast`, "vs last year"]}
    right={[1, 2, 3, 4]} rows={rows} />;
}

// ═════════════════════════════════════════════════════════════════════════════
export function ReorderReport({ T, orders, opts, currencyMode, openAccount }) {
  const [show, setShow] = useState("due");
  const now = today();
  const rows = useMemo(() => {
    const m = new Map();
    orders.forEach(o => { const r = m.get(o.cust.key) || { cust: o.cust, dates: new Set(), list: [] }; r.dates.add(o.date); r.list.push(o); m.set(o.cust.key, r); });
    return [...m.values()].map(r => {
      const ds = [...r.dates].sort();
      if (ds.length < 3) return null;
      const gaps = ds.slice(1).map((d, i) => daysBetween(ds[i], d)).sort((a, b) => a - b);
      const typical = gaps[Math.floor(gaps.length / 2)]; // median days between orders
      const last = ds[ds.length - 1], since = daysBetween(last, now), next = addDays(last, typical);
      if (since > 540) return null; // gone quiet for 18+ months — see "Accounts that haven't ordered lately"
      const avg = displayValue(sumOrders(r.list, opts), currencyMode) / r.list.length;
      const status = since > typical * 1.5 ? "Overdue" : since >= typical - 14 ? "Due now" : "On track";
      return { r, typical, last, since, next, avg, status, n: ds.length };
    }).filter(Boolean).sort((a, b) => (b.since / b.typical) - (a.since / a.typical));
  }, [orders, opts, currencyMode, now]);
  const list = rows.filter(x => show === "all" || (show === "due" ? x.status !== "On track" : x.status === "Overdue"));
  const color = s => (s === "Overdue" ? RED : s === "Due now" ? "#c8a030" : GREEN);
  return <ReportTable T={T} title="Customers due to reorder"
    note="For customers with at least 3 order dates: the typical (median) number of days between their orders, and when the next one would be expected. “Due now” = within two weeks of their usual timing; “Overdue” = 50% past it. A good call list."
    controls={<select value={show} onChange={e => setShow(e.target.value)} style={{ fontSize: 11, height: 28 }}>
      <option value="due">Due now + overdue</option><option value="overdue">Overdue only</option><option value="all">All regular customers</option>
    </select>}
    summary={<Kpis T={T} items={[
      ["Overdue", rows.filter(x => x.status === "Overdue").length, "", RED],
      ["Due now", rows.filter(x => x.status === "Due now").length],
      ["Expected value (due + overdue)", fmtMoney(rows.filter(x => x.status !== "On track").reduce((s, x) => s + x.avg, 0)), "one typical order each"],
    ]} />}
    headers={["Customer", "Type", "Held by", "Status", "Orders on file", "Usually orders every", "Last order", "Days since", "Expected by", "Typical order"]}
    right={[4, 5, 7, 9]}
    rows={list.map(x => ({ onClick: () => openAccount(x.r.cust.key), cells: [x.r.cust.name, x.r.cust.type, x.r.cust.rep, { text: x.status, color: color(x.status) }, x.n, `${x.typical} days`, fmtDate(x.last), x.since, fmtDate(x.next), fmtMoney(x.avg)] }))} />;
}

// ═════════════════════════════════════════════════════════════════════════════
export function ProductTrendsReport({ T, orders, opts, currencyMode }) {
  const fy = fyOf(today()), now = today();
  const [show, setShow] = useState("all");
  const cur = groupBy(orders.filter(o => o.date >= fyStart(fy) && o.date <= now), "product", { ...opts, includeFreight: false });
  const prev = new Map(groupBy(orders.filter(o => o.date >= fyStart(fy - 1) && o.date <= addDays(now, -365)), "product", { ...opts, includeFreight: false }).map(r => [r.key, r]));
  prev.forEach((r, k) => { if (!cur.some(x => x.key === k)) cur.push({ ...r, cad: 0, usd: 0, combined: 0, qty: 0, count: 0 }); });
  const rows = cur.map(r => { const p = prev.get(r.key); return { r, p, v: displayValue(r, currencyMode), pv: p ? displayValue(p, currencyMode) : 0, pq: p?.qty || 0 }; })
    .filter(x => show === "all" || (show === "up" ? x.v > x.pv : show === "down" ? x.v < x.pv : show === "new" ? !x.pv && x.v : false))
    .sort((a, b) => Math.abs(b.v - b.pv) - Math.abs(a.v - a.pv));
  return <ReportTable T={T} title={`Product trends — FY${fy} to date vs same dates last year`}
    note="Which products are growing or shrinking, sorted by the biggest dollar change. Freight is left out."
    controls={<select value={show} onChange={e => setShow(e.target.value)} style={{ fontSize: 11, height: 28 }}>
      <option value="all">All products</option><option value="up">Growing</option><option value="down">Declining</option><option value="new">New this year</option>
    </select>}
    headers={["SKU", "Description", `Qty FY${fy - 1}`, `Qty FY${fy}`, `Sales FY${fy - 1}`, `Sales FY${fy}`, "Change $", "Change %"]}
    right={[2, 3, 4, 5, 6, 7]}
    rows={rows.map(x => ({ cells: [x.r.label, x.r.desc || "", fmtQty(x.pq), fmtQty(x.r.qty), fmtMoney(x.pv), fmtMoney(x.v),
      { text: `${x.v - x.pv >= 0 ? "+" : "−"}${fmtMoney(Math.abs(x.v - x.pv))}`, color: x.v >= x.pv ? GREEN : RED }, { text: chg(x.v, x.pv), color: x.v >= x.pv ? GREEN : RED }] }))} />;
}
