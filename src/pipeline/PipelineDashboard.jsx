// ─── Pipeline & Leads → Dashboard ────────────────────────────────────────────
// One glance at the quote pipeline (from Quote Maker) and, for people allowed to see
// them, the leads (Lead Tracking + ad spend). Values are in CAD (USD quotes converted).
import { useMemo } from "react";
import { fmtMoney, quoteDate, today, fyOf, fyStart } from "../sales/salesUtils";

const GREEN = "#5a9e5a", RED = "#c86a5a";
const day = 864e5;
const status = q => (["won", "lost", "cold"].includes(q.quoteStatus) ? q.quoteStatus : "open");
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const lastActivity = q => Math.max(new Date(q.savedDate || 0).getTime() || 0, ...(q.followUps || []).map(f => new Date(f.date || f.at || 0).getTime() || 0));

function Tile({ T, label, value, sub, color, onClick }) {
  return (
    <div onClick={onClick} style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: "12px 14px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: T.tableHeadText }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color || T.text, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.subtext, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
const Row = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>{children}</div>;
const Heading = ({ T, children, right }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "18px 0 8px" }}>
    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: T.tableHeadText, fontWeight: 600 }}>{children}</div>
    <div style={{ flex: 1 }} />{right}
  </div>
);

export default function PipelineDashboard({ T, quotes, leads, adSpend, canSeeLeads, usdToCad = 1.37, ownOnly, loginName, go }) {
  const d = useMemo(() => {
    const now = Date.now(), t = today();
    const value = q => (q.lineItems || []).reduce((s, li) => s + (parseFloat(li.unitPrice) || 0) * (parseInt(li.qty) || 0), 0) * (q.currency === "USD" ? usdToCad : 1);
    const qs = (quotes || []).filter(q => q.saved && (!ownOnly || q.savedBy === loginName)).map(q => ({ q, date: quoteDate(q), v: value(q), s: status(q), age: (now - lastActivity(q)) / day }));
    const monStart = (() => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; })();
    const week = qs.filter(x => x.date && new Date(x.date + "T00:00") >= monStart);
    const month = qs.filter(x => x.date && x.date.slice(0, 7) === t.slice(0, 7));
    const fy = fyOf(t), fyQ = qs.filter(x => x.date && x.date >= fyStart(fy) && x.date <= t);
    // Like the Pipeline, an open quote 60+ days old counts as gone cold
    const savedAge = x => (now - new Date(x.q.savedDate || 0).getTime()) / day;
    qs.forEach(x => { if (x.s === "open" && savedAge(x) >= 60) x.s = "cold"; });
    const open = qs.filter(x => x.s === "open");
    const sum = l => l.reduce((s, x) => s + x.v, 0);
    const won = fyQ.filter(x => x.s === "won"), decided = fyQ.filter(x => x.s !== "open");
    const followUp = open.filter(x => x.age >= 14);
    const goingCold = open.filter(x => savedAge(x) >= 45 && savedAge(x) < 60);
    // Leads (calendar year, like Lead Tracking)
    const yr = String(new Date().getFullYear());
    const yl = (leads || []).filter(l => String(l.year) === yr);
    const ls = l => (["won", "lost", "cold"].includes(l.status) ? l.status : "open");
    const lDate = l => { const x = l.lastContact ? new Date(l.lastContact) : null; return x && !isNaN(x) ? x : null; };
    const leadsMonth = yl.filter(l => { const x = lDate(l); return x && x.getMonth() === new Date().getMonth() && x.getFullYear() === +yr; });
    const lWon = yl.filter(l => ls(l) === "won"), lDecided = yl.filter(l => ls(l) !== "open");
    const bySource = {}; yl.forEach(l => { const k = l.leadSource || "Unknown"; bySource[k] = (bySource[k] || 0) + 1; });
    const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];
    const spend = (s => (parseFloat(s.google) || 0) + (parseFloat(s.other) || 0))(adSpend?.[yr] || {});
    return {
      week, month, open, openV: sum(open), wonFy: won, wonFyV: sum(won), winRate: pct(won.length, decided.length), fy, followUp, goingCold,
      yr, yl, leadsMonth, lOpen: yl.filter(l => ls(l) === "open"), lWon, lWonV: lWon.reduce((s, l) => s + (parseFloat(l.potentialValue) || 0), 0),
      lConv: pct(lWon.length, lDecided.length), topSource, spend, cpl: yl.length && spend ? spend / yl.length : null,
    };
  }, [quotes, leads, adSpend, usdToCad, ownOnly, loginName]);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <div style={{ maxWidth: 1200 }}>
        <Heading T={T} right={<button className="btn" onClick={() => go("pipeline")}>Open Pipeline →</button>}>Pipeline{ownOnly ? " — your quotes" : ""}</Heading>
        <Row>
          <Tile T={T} label="Open quotes" value={d.open.length} sub={`${fmtMoney(d.openV)} still in play`} onClick={() => go("pipeline")} />
          <Tile T={T} label="Quotes this week" value={d.week.length} sub={fmtMoney(d.week.reduce((s, x) => s + x.v, 0))} />
          <Tile T={T} label="Quotes this month" value={d.month.length} sub={fmtMoney(d.month.reduce((s, x) => s + x.v, 0))} />
          <Tile T={T} label={`Win rate FY${d.fy}`} value={d.winRate == null ? "—" : `${d.winRate}%`} sub={`${d.wonFy.length} won · ${fmtMoney(d.wonFyV)}`} color={d.winRate == null ? undefined : d.winRate >= 40 ? GREEN : d.winRate < 20 ? RED : undefined} />
          <Tile T={T} label="Need a follow-up" value={d.followUp.length} sub="open, no activity in 14+ days" color={d.followUp.length ? RED : undefined} onClick={() => go("pipeline")} />
          <Tile T={T} label="Going cold soon" value={d.goingCold.length} sub="45–59 days old (cold at 60)" onClick={() => go("pipeline")} />
        </Row>

        {canSeeLeads && <>
          <Heading T={T} right={<button className="btn" onClick={() => go("leads")}>Open Leads →</button>}>Leads — {d.yr}</Heading>
          <Row>
            <Tile T={T} label="New leads this month" value={d.leadsMonth.length} sub={`${d.yl.length} this year`} />
            <Tile T={T} label="Open leads" value={d.lOpen.length} onClick={() => go("leads")} />
            <Tile T={T} label="Leads won" value={d.lWon.length} sub={fmtMoney(d.lWonV) + " potential value"} />
            <Tile T={T} label="Conversion" value={d.lConv == null ? "—" : `${d.lConv}%`} sub="won ÷ (won + lost + cold)" color={d.lConv == null ? undefined : d.lConv >= 40 ? GREEN : d.lConv < 20 ? RED : undefined} />
            <Tile T={T} label="Top lead source" value={d.topSource ? d.topSource[0] : "—"} sub={d.topSource ? `${d.topSource[1]} leads` : ""} />
            <Tile T={T} label="Cost per lead" value={d.cpl == null ? "—" : fmtMoney(d.cpl)} sub={d.spend ? `${fmtMoney(d.spend)} ad spend this year` : "add ad spend in Leads"} />
          </Row>
        </>}

        {d.followUp.length > 0 && <>
          <Heading T={T}>Follow up next</Heading>
          <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Quote</th><th>Company</th><th>By</th><th style={{ textAlign: "right" }}>Value</th><th style={{ textAlign: "right" }}>Days since last activity</th></tr></thead>
              <tbody>{[...d.followUp].sort((a, b) => b.v - a.v).slice(0, 10).map(x => (
                <tr key={x.q.id} onClick={() => go("pipeline")} style={{ cursor: "pointer" }}>
                  <td style={{ color: T.gold, fontWeight: 600 }}>{x.q.quoteNum}</td><td>{x.q.company || x.q.name || "—"}</td><td>{x.q.savedBy || "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmtMoney(x.v)}</td><td style={{ textAlign: "right" }}>{Math.floor(x.age)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </>}
      </div>
    </div>
  );
}
