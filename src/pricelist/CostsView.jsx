// ─── Costs & margins ─────────────────────────────────────────────────────────
// Used two ways: Products & Price List → "Costs & Margins" (cost per SKU, margins on the current
// prices) and inside a draft price list (margins at the new prices + projection from real orders).
// Only people with "Costs & margins" in Users & Access; the costs themselves are encrypted (costs.js).
import { useMemo, useRef, useState, useEffect } from "react";
import { Loader } from "../Loader";
import { costOf, lowestMargin, marginPct } from "./costs";
import { PRICE_FIELDS, FIELD_LABEL, priceNum, up } from "./priceLists";

const GREEN = "#4f9a5a", RED = "#c8553f", AMBER = "#c8a030";
const money = v => (v === null || v === undefined || v === "" ? "—" : "$" + Number(v).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pctTxt = m => (m === null || m === undefined ? "—" : `${m.toFixed(1)}%`);
const when = iso => (iso ? new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "");
export const CALC_FOLDER = "/Documents/Cost Calculators";

// Colour a margin against the category's target (if one is set): red below, amber within 5 points, green above
export function marginColor(m, target) {
  if (m === null || m === undefined) return undefined;
  if (target === null || target === undefined || target === "") return m < 0 ? RED : undefined;
  return m < target ? RED : m < target + 5 ? AMBER : GREEN;
}

export function CostGate({ T, costs, children }) {
  if (costs.status === "loading") return <Loader T={T} label="Loading costs…" />;
  if (costs.status === "hidden") return <div style={{ fontSize: 12, color: T.tableHeadText }}>Costs and margins are only shown to people with "Costs &amp; margins" in Users &amp; Access.</div>;
  if (costs.status === "ready") return children;
  const box = { background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: 16, maxWidth: 620 };
  return (
    <div style={box}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>🔒 Costs are locked</div>
      <div style={{ fontSize: 12, color: T.subtext, lineHeight: 1.6 }}>
        {costs.status === "none"
          ? <>Costs open with each person's own password. They switch on the first time an admin sets a password for someone with "Costs &amp; margins" in <b>Users &amp; Access</b>.</>
          : <>Costs open automatically when you sign in with your own password. <b>Sign out and sign back in</b> with your password — if they're still locked, ask Paul to set your password again in Users &amp; Access.</>}
      </div>
    </div>
  );
}

// ── Cost list, calculator refresh, category targets, margins at current (and draft) prices ─────
export default function CostsView({ T, costs, loginName, products, draftProducts = null, categories = {}, categoryOrder = [], onOpenCalc = null }) {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [problems, setProblems] = useState(false); // no cost, or lowest margin under the category target / below zero
  const map = costs.costs || {};
  const targets = map.__targets || {};
  const catOf = p => categories[p.sku] || "Uncategorized";
  const draftBy = useMemo(() => new Map((draftProducts || []).map(p => [up(p.sku), p])), [draftProducts]);
  const cats = ["All", ...categoryOrder.filter(c => products.some(p => catOf(p) === c)), ...[...new Set(products.map(catOf))].filter(c => !categoryOrder.includes(c))];
  const rows = products.filter(p => (cat === "All" || catOf(p) === cat) && (!q || `${p.sku} ${p.description}`.toLowerCase().includes(q.toLowerCase())) && (!missingOnly || !costOf(map, p.sku)) && (!problems || isProblem(p)));
  const withCost = products.filter(p => costOf(map, p.sku)).length;
  function isProblem(p) { const c = costOf(map, p.sku); if (!c) return true; const m = lowestMargin(p, c), t = targets[catOf(p)]; return m !== null && (m < 0 || (t !== undefined && t !== "" && m < t)); }
  const saveMap = (next, what) => costs.save(next, loginName).catch(e => alert("Couldn't save costs: " + e.message));
  const target = c => targets[c] ?? "";
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: T.tableHeadText }}>{withCost} of {products.length} SKUs have a cost{costs.at ? ` · last saved ${when(costs.at)}${costs.by ? " by " + costs.by : ""}` : ""}</span>
      </div>
      <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 10, lineHeight: 1.5 }}>
        Every cost is the <b>fully loaded cost</b> from <b>Costs &amp; Margins</b> (left-hand menu) — change it there. Targets come from each product line there.
        Margin = (price − cost) ÷ price, shown for the <b>lowest</b> price of each SKU (its biggest discount — usually FTL or pallet). Hover for every price.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ height: 28, fontSize: 11 }}>{cats.map(c => <option key={c}>{c}</option>)}</select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search SKU…" style={{ height: 28, fontSize: 11, width: 180 }} />
        <label style={{ fontSize: 11 }}><input type="checkbox" checked={missingOnly} onChange={e => setMissingOnly(e.target.checked)} /> Missing cost only</label>
        <label style={{ fontSize: 11 }} title="No cost yet, or the lowest price is under the category's target margin (or loses money)"><input type="checkbox" checked={problems} onChange={e => setProblems(e.target.checked)} /> Problems only ({products.filter(isProblem).length})</label>
        {cat !== "All" && <label style={{ fontSize: 11, marginLeft: 10 }}>Target margin for {cat}: <input type="number" defaultValue={target(cat)} key={cat} onBlur={e => { const v = e.target.value === "" ? undefined : Number(e.target.value); const t = { ...targets }; if (v === undefined) delete t[cat]; else t[cat] = v; saveMap({ ...map, __targets: t }); }} style={{ width: 60, height: 26 }} /> %</label>}
      </div>
      <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>SKU</th><th>Description</th><th style={{ textAlign: "right" }}>Cost</th><th>Cost source</th><th style={{ textAlign: "right" }}>Margin now</th>{draftProducts && <><th style={{ textAlign: "right" }}>Margin at new prices</th><th style={{ textAlign: "right" }}>Change</th></>}</tr></thead>
          <tbody>{rows.map(p => {
            const c = costOf(map, p.sku), info = map[up(p.sku)], d = draftBy.get(up(p.sku));
            const m0 = lowestMargin(p, c), m1 = d ? lowestMargin(d, c) : null, t = info?.target ?? targets[catOf(p)];
            const tip = pp => PRICE_FIELDS.filter(f => priceNum(pp[f])).map(f => `${FIELD_LABEL[f]} ${money(priceNum(pp[f]))}: ${pctTxt(marginPct(pp[f], c))}`).join("\n");
            return <tr key={p.sku}>
              <td style={{ fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap" }}>{p.sku}</td>
              <td style={{ fontSize: 11, maxWidth: 300 }}>{p.description || p.product}</td>
              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{c ? money(c) : <span style={{ color: AMBER, fontWeight: 400, fontSize: 11 }}>no calculator</span>}</td>
              <td style={{ fontSize: 10, color: T.tableHeadText }}>{info ? <>{onOpenCalc ? <a href="#" onClick={e => { e.preventDefault(); onOpenCalc(p.sku); }} style={{ color: T.gold }}>{String(info.source || "").replace(/^Cost Calculator › /, "")}</a> : String(info.source || "").replace(/^Cost Calculator › /, "")}{info.at ? " · " + when(info.at) : ""}</> : ""}</td>
              <td title={c ? tip(p) : ""} style={{ textAlign: "right", fontWeight: 600, color: marginColor(m0, t) }}>{pctTxt(m0)}</td>
              {draftProducts && <><td title={c && d ? tip(d) : ""} style={{ textAlign: "right", fontWeight: 600, color: marginColor(m1, t) }}>{pctTxt(m1)}</td>
                <td style={{ textAlign: "right", fontSize: 11, color: m0 !== null && m1 !== null ? (m1 >= m0 ? GREEN : RED) : undefined }}>{m0 !== null && m1 !== null ? `${m1 >= m0 ? "+" : ""}${(m1 - m0).toFixed(1)} pts` : ""}</td></>}
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
