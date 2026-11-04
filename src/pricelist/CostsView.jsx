// ─── Costs & margins ─────────────────────────────────────────────────────────
// Used two ways: Products & Price List → "Costs & Margins" (cost per SKU, margins on the current
// prices) and inside a draft price list (margins at the new prices + projection from real orders).
// Only people with "Costs & margins" in Users & Access; the costs themselves are encrypted (costs.js).
import { useMemo, useRef, useState, useEffect } from "react";
import { readCalculator, estimateBlankets, costOf, lowestMargin, marginPct } from "./costs";
import { PRICE_FIELDS, FIELD_LABEL, priceNum, up, parseCSV } from "./priceLists";
import { listFiles, downloadFile, isDropboxConnected } from "../sales/dropbox";

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

export function CostGate({ T, costs, loginName, children }) {
  const [a, setA] = useState(""), [b, setB] = useState(""), [msg, setMsg] = useState("");
  if (costs.status === "loading") return <div style={{ fontSize: 12, color: T.tableHeadText }}>Loading costs…</div>;
  if (costs.status === "hidden") return <div style={{ fontSize: 12, color: T.tableHeadText }}>Costs and margins are only shown to people with "Costs & margins" in Users & Access.</div>;
  if (costs.status === "ready") return children;
  const box = { background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: 16, maxWidth: 620 };
  if (costs.status === "none") return (
    <div style={box}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Set up the cost password</div>
      <div style={{ fontSize: 12, color: T.subtext, lineHeight: 1.6, marginBottom: 12 }}>Costs are locked with their own password, separate from the hub's sign-in password, so they stay private even though the database is open. Give it only to the people who should see costs (Paul, Mark, Jeff, Grant). Each person types it once per computer. If it's ever forgotten, set up a new one and refresh the costs from the calculators.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="password" placeholder="Cost password" value={a} onChange={e => setA(e.target.value)} style={{ height: 30 }} />
        <input type="password" placeholder="Type it again" value={b} onChange={e => setB(e.target.value)} style={{ height: 30 }} />
        <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} onClick={async () => {
          if (a.length < 6) return setMsg("Use at least 6 characters."); if (a !== b) return setMsg("The two don't match.");
          await costs.save({}, loginName, a);
        }}>Set password</button>
        {msg && <span style={{ fontSize: 11, color: RED }}>{msg}</span>}
      </div>
    </div>
  );
  return (
    <div style={box}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>🔒 Costs are locked on this computer</div>
      <div style={{ fontSize: 12, color: T.subtext, marginBottom: 12 }}>Type the cost password once — this computer will remember it.</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="password" placeholder="Cost password" value={a} onChange={e => setA(e.target.value)} onKeyDown={e => e.key === "Enter" && costs.unlock(a)} style={{ height: 30 }} />
        <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} onClick={() => costs.unlock(a)}>Unlock</button>
        {costs.error && <span style={{ fontSize: 11, color: RED }}>{costs.error}</span>}
      </div>
    </div>
  );
}

// ── Cost list, calculator refresh, category targets, margins at current (and draft) prices ─────
export default function CostsView({ T, costs, loginName, products, draftProducts = null, categories = {}, categoryOrder = [] }) {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const fileRef = useRef(null), csvRef = useRef(null);
  const map = costs.costs || {};
  const targets = map.__targets || {};
  const catOf = p => categories[p.sku] || "Uncategorized";
  const draftBy = useMemo(() => new Map((draftProducts || []).map(p => [up(p.sku), p])), [draftProducts]);
  const cats = ["All", ...categoryOrder.filter(c => products.some(p => catOf(p) === c)), ...[...new Set(products.map(catOf))].filter(c => !categoryOrder.includes(c))];
  const rows = products.filter(p => (cat === "All" || catOf(p) === cat) && (!q || `${p.sku} ${p.description}`.toLowerCase().includes(q.toLowerCase())) && (!missingOnly || !costOf(map, p.sku)));
  const withCost = products.filter(p => costOf(map, p.sku)).length;
  const saveMap = (next, what) => costs.save(next, loginName).catch(e => alert("Couldn't save costs: " + e.message));
  const setCost = (sku, v) => {
    const next = { ...map };
    if (v === null || v === "") delete next[up(sku)]; else next[up(sku)] = { cost: Number(v), at: new Date().toISOString(), by: loginName, source: "typed in" };
    saveMap(next);
  };

  // Calculators → preview of changed costs
  const fromCalculators = async files => {
    setBusy("Reading calculators…");
    try {
      const skus = products.map(p => p.sku);
      let found = {};
      for (const f of files) Object.assign(found, await readCalculator(f.data, f.name, skus));
      const est = estimateBlankets(found, skus);
      const changes = [...Object.entries(found), ...Object.entries(est)].map(([sku, n]) => ({ sku, ...n, old: costOf(map, sku), keep: !(n.estimate && costOf(map, sku) && map[sku]?.source === "typed in") }))
        .filter(c => c.old === null || Math.abs(c.old - c.cost) > 0.004);
      setPreview({ changes, files: files.map(f => f.name), found: Object.keys(found).length, est: Object.keys(est).length });
    } catch (e) { alert("Couldn't read the calculators: " + e.message); }
    setBusy("");
  };
  const fromDropbox = async () => {
    if (!isDropboxConnected()) return alert("Dropbox isn't connected on this computer. Connect it in Sales Summary → Settings, or use \"Upload calculator files\" instead.");
    setBusy("Looking in Dropbox…");
    try {
      const list = (await listFiles(CALC_FOLDER, /\.xlsx?$/i)).filter(f => /blanket|curtain/i.test(f.name));
      if (!list.length) { setBusy(""); return alert(`No blanket or curtain calculators found in Dropbox ${CALC_FOLDER}.`); }
      const files = [];
      for (const f of list) files.push({ name: f.name, data: await downloadFile(f) });
      await fromCalculators(files);
    } catch (e) { setBusy(""); alert(/not_found/.test(e.message) ? `Couldn't find the folder ${CALC_FOLDER} in Dropbox. Use "Upload calculator files" instead.` : "Dropbox: " + e.message); }
  };

  const target = c => targets[c] ?? "";
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} disabled={!!busy} onClick={fromDropbox}>↻ Refresh costs from calculators</button>
        <button className="btn" disabled={!!busy} onClick={() => fileRef.current?.click()}>⬆ Upload calculator files</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple style={{ display: "none" }} onChange={async e => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) await fromCalculators(await Promise.all(fs.map(async f => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })))); }} />
        <button className="btn" onClick={() => csvRef.current?.click()}>⬆ Import costs CSV</button>
        <input ref={csvRef} type="file" accept=".csv" style={{ display: "none" }} onChange={async e => {
          const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
          const rows = parseCSV(await f.text()); const known = new Set(products.map(p => up(p.sku)));
          const changes = rows.map(r => ({ sku: up(r[0]), cost: priceNum(r[1]) })).filter(r => known.has(r.sku) && r.cost > 0).map(r => ({ ...r, source: f.name, old: costOf(map, r.sku), keep: true })).filter(c => c.old === null || Math.abs(c.old - c.cost) > 0.004);
          setPreview({ changes, files: [f.name], found: changes.length, est: 0 });
        }} />
        {busy && <span style={{ fontSize: 11, color: T.gold }}>{busy}</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: T.tableHeadText }}>{withCost} of {products.length} SKUs have a cost{costs.at ? ` · last saved ${when(costs.at)}${costs.by ? " by " + costs.by : ""}` : ""}</span>
        <button className="btn" title="Lock costs again on this computer" onClick={costs.forget}>🔒 Lock</button>
      </div>
      <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 10, lineHeight: 1.5 }}>
        Refresh reads the Erosion Control Blanket and Turbidity Curtain calculators from Dropbox <b>{CALC_FOLDER}</b> (the Canada "Total Cost"). Costs for other SKUs can be typed in or imported from a CSV (SKU, Cost).
        Margin = (price − cost) ÷ price, shown for the <b>lowest</b> price of each SKU (its biggest discount — usually FTL or pallet). Hover for every price.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ height: 28, fontSize: 11 }}>{cats.map(c => <option key={c}>{c}</option>)}</select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search SKU…" style={{ height: 28, fontSize: 11, width: 180 }} />
        <label style={{ fontSize: 11 }}><input type="checkbox" checked={missingOnly} onChange={e => setMissingOnly(e.target.checked)} /> Missing cost only</label>
        {cat !== "All" && <label style={{ fontSize: 11, marginLeft: 10 }}>Target margin for {cat}: <input type="number" defaultValue={target(cat)} key={cat} onBlur={e => { const v = e.target.value === "" ? undefined : Number(e.target.value); const t = { ...targets }; if (v === undefined) delete t[cat]; else t[cat] = v; saveMap({ ...map, __targets: t }); }} style={{ width: 60, height: 26 }} /> %</label>}
      </div>
      <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>SKU</th><th>Description</th><th style={{ textAlign: "right" }}>Cost</th><th>Cost source</th><th style={{ textAlign: "right" }}>Margin now</th>{draftProducts && <><th style={{ textAlign: "right" }}>Margin at new prices</th><th style={{ textAlign: "right" }}>Change</th></>}</tr></thead>
          <tbody>{rows.map(p => {
            const c = costOf(map, p.sku), info = map[up(p.sku)], d = draftBy.get(up(p.sku));
            const m0 = lowestMargin(p, c), m1 = d ? lowestMargin(d, c) : null, t = targets[catOf(p)];
            const tip = pp => PRICE_FIELDS.filter(f => priceNum(pp[f])).map(f => `${FIELD_LABEL[f]} ${money(priceNum(pp[f]))}: ${pctTxt(marginPct(pp[f], c))}`).join("\n");
            return <tr key={p.sku}>
              <td style={{ fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap" }}>{p.sku}</td>
              <td style={{ fontSize: 11, maxWidth: 300 }}>{p.description || p.product}</td>
              <td style={{ textAlign: "right" }}><CostInput value={c} onCommit={v => setCost(p.sku, v)} /></td>
              <td style={{ fontSize: 10, color: info?.estimate || /estimate/.test(info?.source || "") ? AMBER : T.tableHeadText }}>{info ? `${info.source || ""}${info.at ? " · " + when(info.at) : ""}` : ""}</td>
              <td title={c ? tip(p) : ""} style={{ textAlign: "right", fontWeight: 600, color: marginColor(m0, t) }}>{pctTxt(m0)}</td>
              {draftProducts && <><td title={c && d ? tip(d) : ""} style={{ textAlign: "right", fontWeight: 600, color: marginColor(m1, t) }}>{pctTxt(m1)}</td>
                <td style={{ textAlign: "right", fontSize: 11, color: m0 !== null && m1 !== null ? (m1 >= m0 ? GREEN : RED) : undefined }}>{m0 !== null && m1 !== null ? `${m1 >= m0 ? "+" : ""}${(m1 - m0).toFixed(1)} pts` : ""}</td></>}
            </tr>;
          })}</tbody>
        </table>
      </div>
      {preview && <CostPreview T={T} preview={preview} onCancel={() => setPreview(null)} onApply={async sel => {
        const next = { ...map }, at = new Date().toISOString();
        preview.changes.filter(c => sel.has(c.sku)).forEach(c => { next[c.sku] = { cost: c.cost, at, by: loginName, source: c.source, ...(c.estimate ? { estimate: true } : {}) }; });
        await saveMap(next); setPreview(null);
      }} />}
    </div>
  );
}

function CostInput({ value, onCommit }) {
  const [t, setT] = useState(value ?? "");
  useEffect(() => setT(value ?? ""), [value]);
  return <input type="number" step="0.01" value={t} onChange={e => setT(e.target.value)} onBlur={() => { if (String(t) !== String(value ?? "")) onCommit(t === "" ? null : Number(t)); }} onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} style={{ width: 90, height: 24, textAlign: "right", fontSize: 11 }} />;
}

function CostPreview({ T, preview, onCancel, onApply }) {
  const [sel, setSel] = useState(() => new Set(preview.changes.filter(c => c.keep).map(c => c.sku)));
  const toggle = sku => setSel(s => { const n = new Set(s); n.has(sku) ? n.delete(sku) : n.add(sku); return n; });
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 780 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Cost changes from {preview.files.join(", ")}</div>
        <div style={{ fontSize: 12, color: T.subtext, marginBottom: 10 }}>Found {preview.found} SKU costs{preview.est ? ` plus ${preview.est} estimated 16'/jumbo blanket costs` : ""}. {preview.changes.length ? `${preview.changes.length} are new or different — untick any you don't want.` : "Everything already matches."}</div>
        <div style={{ maxHeight: 400, overflow: "auto", border: `1px solid ${T.border}` }}>
          <table className="data-table"><thead><tr><th /><th>SKU</th><th style={{ textAlign: "right" }}>Current cost</th><th style={{ textAlign: "right" }}>New cost</th><th>From</th></tr></thead>
            <tbody>{preview.changes.map(c => <tr key={c.sku}>
              <td><input type="checkbox" checked={sel.has(c.sku)} onChange={() => toggle(c.sku)} /></td>
              <td style={{ fontFamily: "monospace", fontSize: 11 }}>{c.sku}</td>
              <td style={{ textAlign: "right" }}>{money(c.old)}</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{money(c.cost)}</td>
              <td style={{ fontSize: 10, color: c.estimate ? AMBER : T.tableHeadText }}>{c.source}</td>
            </tr>)}</tbody></table>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn-gold" disabled={!sel.size} onClick={() => onApply(sel)}>Update {sel.size} cost{sel.size === 1 ? "" : "s"}</button>
        </div>
      </div>
    </div>
  );
}
