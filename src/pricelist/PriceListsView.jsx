// ─── Products & Price List → Price Lists ─────────────────────────────────────
// Current version (what quotes use), drafts being built for the next list, and history.
// Only people with "Edit price lists" in Users & Access get here (Paul, Mark, Jeff by default).
import { useEffect, useMemo, useRef, useState } from "react";
import { listenPriceLists, updateVersion, setUpCurrent, startDraft, deleteDraft, makeActive, publishCustomerPrices, path, pathParts } from "./store";
import { PRICE_FIELDS, FIELD_LABEL, versionProducts, customerLists, pctFor, priceNum, up, fmtEffective, yearOf, DEFAULT_NOTES, readPriceCSV } from "./priceLists";
import { buildPriceListHTML, pdfFileName } from "./pdf";
import { downloadCSV } from "../sales/salesUtils";
import { doc, setDoc } from "firebase/firestore";
import CostsView, { CostGate, marginColor } from "./CostsView";
import Projection from "./Projection";
import { costOf, marginPct } from "./costs";

const fmt = v => { const n = priceNum(v); return n === null || n <= 0 ? "—" : "$" + n.toLocaleString("en-CA", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
const when = iso => iso ? new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
const GREEN = "#4f9a5a", RED = "#c8553f";

function Card({ T, title, right, children, pad = 14 }) {
  return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, marginBottom: 14 }}>
      {(title || right) && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: T.tableHeadText, fontWeight: 600 }}>{title}</div><div style={{ flex: 1 }} />{right}
      </div>}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

export default function PriceListsView({ T, db, products, categories = {}, subCategories = {}, subCatDefs = {}, categoryOrder = [], loginName, logo, usdRate, costs, canCosts }) {
  const [lists, setLists] = useState(null);
  const [openId, setOpenId] = useState(null);
  useEffect(() => listenPriceLists(db, setLists, () => setLists([])), [db]);
  if (!lists) return <div style={{ padding: 24, fontSize: 12, color: T.tableHeadText }}>Loading price lists…</div>;
  const current = lists.find(v => v.status === "current");
  const drafts = lists.filter(v => v.status === "draft").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const history = lists.filter(v => v.status === "archived").sort((a, b) => ((a.activatedAt || "") < (b.activatedAt || "") ? 1 : -1));
  const open = lists.find(v => v.id === openId);
  const common = { T, db, products, categories, subCategories, subCatDefs, categoryOrder, loginName, logo, current, costs, canCosts };

  if (open) return <VersionEditor {...common} v={open} back={() => setOpenId(null)} />;
  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <div style={{ maxWidth: 1100 }}>
        {!current ? <SetUp {...common} usdRate={usdRate} /> : <>
          <Card T={T} title="Current price list — what quotes use" right={<button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} onClick={async () => {
            const y = (+yearOf(current) || new Date().getFullYear()) + 1;
            const name = prompt("Name for the new price list:", `${y} V1`); if (!name) return;
            const eff = prompt("Effective date (YYYY-MM-DD):", `${y}-01-01`); if (!eff) return;
            setOpenId(await startDraft(db, current, { name, effectiveDate: eff, by: loginName }));
          }}>＋ Start a new price list</button>}>
            <VersionRow T={T} v={current} onOpen={() => setOpenId(current.id)} />
          </Card>
          <Card T={T} title={`Drafts (${drafts.length})`}>
            {!drafts.length ? <div style={{ fontSize: 12, color: T.tableHeadText }}>No drafts. Start a new price list to build next year's prices while the current one stays in use.</div>
              : drafts.map(v => <VersionRow key={v.id} T={T} v={v} onOpen={() => setOpenId(v.id)} />)}
          </Card>
          <Card T={T} title={`History (${history.length})`}>
            {!history.length ? <div style={{ fontSize: 12, color: T.tableHeadText }}>Past price lists appear here once a new one is made active.</div>
              : history.map(v => <VersionRow key={v.id} T={T} v={v} onOpen={() => setOpenId(v.id)} />)}
          </Card>
        </>}
      </div>
    </div>
  );
}

function VersionRow({ T, v, onOpen }) {
  const tag = { current: ["CURRENT", GREEN], draft: ["DRAFT", "#c8a030"], archived: ["HISTORY", "#888"] }[v.status];
  return (
    <div onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 4px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", color: tag[1], border: `1px solid ${tag[1]}`, padding: "1px 6px", borderRadius: 2 }}>{tag[0]}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: T.text, minWidth: 110 }}>{v.name}</span>
      <span style={{ fontSize: 12, color: T.subtext }}>Effective {fmtEffective(v.effectiveDate)}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: T.tableHeadText }}>Last edited by {v.updatedBy || "—"} · {when(v.updatedAt)}</span>
      <button className="btn">Open →</button>
    </div>
  );
}

function SetUp({ T, db, loginName, usdRate }) {
  const [name, setName] = useState("2026 V2");
  const [eff, setEff] = useState("2026-05-21");
  return (
    <Card T={T} title="Set up price lists (one time)">
      <div style={{ fontSize: 12, color: T.subtext, lineHeight: 1.6, marginBottom: 12 }}>
        First, name the price list the hub uses today. It becomes the <b>Current</b> version. Its customer-facing list starts with the 108 SKUs
        on your 2026 V2 master, and the notes page starts with your current notes. After that you can start next year's list as a draft.
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 11 }}>Name <input value={name} onChange={e => setName(e.target.value)} style={{ height: 28, width: 110 }} /></label>
        <label style={{ fontSize: 11 }}>Effective <input type="date" value={eff} onChange={e => setEff(e.target.value)} style={{ height: 28 }} /></label>
        <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} onClick={() => setUpCurrent(db, { name, effectiveDate: eff, by: loginName, usdMultiplier: usdRate || 0.95 })}>Set up</button>
      </div>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
const TABS = [["increases", "Increases"], ["prices", "Review prices"], ["margins", "Margins & projection"], ["customers", "Customer price lists"], ["notes", "Notes page"], ["output", "PDF & CSV"], ["log", "Change log"]];

function VersionEditor(props) {
  const { T, db, v, back, products, categories, current, loginName } = props;
  const [tab, setTab] = useState(v.status === "draft" ? "increases" : "prices");
  const draft = v.status === "draft";
  const editable = v.status !== "archived"; // current: on-list ticks, notes and customer prices; draft: everything
  const save = (patch, what) => updateVersion(db, v.id, patch, loginName, what);
  const catOf = sku => categories[sku] || "Uncategorized";
  const priced = useMemo(() => versionProducts(v, products, categories), [v, products, categories]);
  const base = useMemo(() => {
    if (!draft) return null; // compare drafts against the current list
    return new Map((products || []).map(p => [up(p.sku), p]));
  }, [draft, products]);
  const [restore, setRestore] = useState(false);
  const tabs = TABS.filter(([k]) => (k !== "increases" || draft) && (k !== "margins" || draft || props.canCosts));
  const ctx = { ...props, draft, editable, save, catOf, priced, base };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
        <button className="btn" onClick={back}>← All price lists</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{v.name}</span>
        {<button className="btn" style={{ padding: "2px 8px" }} title="Rename" onClick={() => { const n = prompt("Name:", v.name); if (n && n !== v.name) save({ name: n }, `Renamed to ${n}`); }}>✎</button>}
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: draft ? "#c8a030" : v.status === "current" ? GREEN : "#888" }}>{v.status.toUpperCase()}</span>
        <label style={{ fontSize: 11, color: T.subtext }}>Effective <input type="date" value={v.effectiveDate || ""} onChange={e => save({ effectiveDate: e.target.value }, `Effective date → ${e.target.value}`)} style={{ height: 26 }} /></label>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: T.tableHeadText }}>Last edited by <b style={{ color: T.text }}>{v.updatedBy || "—"}</b> · {when(v.updatedAt)}</span>
        {v.status === "archived" && <button className="btn" onClick={() => setRestore(true)} title="Put this version's exact prices back on the current list">↺ Restore these prices…</button>}
        {v.status !== "current" && <button className="btn-del" onClick={async () => { if (confirm(`Delete ${draft ? "the draft" : "the saved price list"} ${v.name}? This can't be undone.`)) { await deleteDraft(db, v.id); back(); } }}>Delete {draft ? "draft" : "from history"}</button>}
        {draft && <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} onClick={async () => {
          const changes = priced.reduce((nn, p) => nn + PRICE_FIELDS.filter(f => priceNum(base?.get(up(p.sku))?.[f]) !== priceNum(p[f])).length, 0);
          if (!confirm(`Make ${v.name} the current price list?\n\n${changes} prices will change (increases and whole-dollar rounding) — these become the prices quotes use. Quotes already made keep their prices. ${current ? current.name + " moves to History, where it can be restored." : ""}`)) return;
          await makeActive(db, v, current, products, categories, loginName); back();
        }}>Make active</button>}
      </div>
      <div style={{ display: "flex", gap: 4, padding: "8px 16px", borderBottom: `1px solid ${T.border}`, background: T.panelBg, flexWrap: "wrap" }}>
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ background: tab === k ? T.activeBg : "transparent", border: `1px solid ${tab === k ? T.borderLight : "transparent"}`, color: tab === k ? T.gold : T.subtext, padding: "5px 11px", fontSize: 11, borderRadius: 2 }}>{l}</button>)}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {tab === "increases" ? <Increases {...ctx} />
          : tab === "prices" ? <Prices {...ctx} />
          : tab === "margins" ? <Margins {...ctx} />
          : tab === "customers" ? <Customers {...ctx} />
          : tab === "notes" ? <Notes {...ctx} />
          : tab === "output" ? <Output {...ctx} />
          : <Log {...ctx} />}
      </div>
      {restore && <RestorePrices T={T} db={db} v={v} live={products} current={current} loginName={loginName} onClose={() => setRestore(false)} />}
    </div>
  );
}

// ── Restore a saved version's exact prices onto the current list ─────────────
// e.g. a list made active by mistake rounded the prices — the version it replaced still holds them
function RestorePrices({ T, db, v, live, current, loginName, onClose }) {
  const saved = new Map((v.products || []).map(p => [up(p.sku), p]));
  const changes = [];
  (live || []).forEach(p => {
    const o = saved.get(up(p.sku)); if (!o) return;
    PRICE_FIELDS.forEach(f => { const a = priceNum(o[f]), b = priceNum(p[f]); if (a !== null && b !== null && a !== b) changes.push({ sku: p.sku, f, now: b, was: a, rounded: Math.round(a) === b }); });
  });
  const [sel, setSel] = useState(() => new Set(changes.filter(c => c.rounded).map(c => c.sku + "|" + c.f)));
  const [busy, setBusy] = useState(false);
  const toggle = k => setSel(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const apply = async () => {
    setBusy(true);
    const items = live.map(p => { const q = { ...p }; changes.forEach(c => { if (c.sku === p.sku && sel.has(c.sku + "|" + c.f)) q[c.f] = saved.get(up(p.sku))[c.f]; }); return q; });
    await setDoc(doc(db, "config", "productsCAD"), JSON.parse(JSON.stringify({ items })));
    if (current) await updateVersion(db, current.id, {}, loginName, `Restored ${sel.size} prices from ${v.name}`);
    setBusy(false); onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Restore prices from {v.name}</div>
        <div style={{ fontSize: 12, color: T.subtext, marginBottom: 10, lineHeight: 1.5 }}>{changes.length} prices on the current list differ from {v.name}. Ticked by default: the ones that look like they were only <b>rounded</b> to the whole dollar. Anything you changed on purpose is unticked — tick it to restore it too.</div>
        <div style={{ maxHeight: 380, overflow: "auto", border: `1px solid ${T.border}` }}>
          <table className="data-table"><thead><tr><th><input type="checkbox" checked={sel.size === changes.length && changes.length > 0} onChange={e => setSel(new Set(e.target.checked ? changes.map(c => c.sku + "|" + c.f) : []))} /></th><th>SKU</th><th>Price</th><th style={{ textAlign: "right" }}>Now</th><th style={{ textAlign: "right" }}>Restore to</th><th /></tr></thead>
            <tbody>{changes.map(c => { const k = c.sku + "|" + c.f; return <tr key={k}><td><input type="checkbox" checked={sel.has(k)} onChange={() => toggle(k)} /></td><td style={{ fontFamily: "monospace", fontSize: 11 }}>{c.sku}</td><td>{FIELD_LABEL[c.f]}</td><td style={{ textAlign: "right" }}>{fmt(c.now)}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(c.was)}</td><td style={{ fontSize: 10, color: T.tableHeadText }}>{c.rounded ? "rounded" : "changed"}</td></tr>; })}</tbody></table>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-gold" disabled={!sel.size || busy} onClick={apply}>{busy ? "Restoring…" : `Restore ${sel.size} price${sel.size === 1 ? "" : "s"}`}</button>
        </div>
      </div>
    </div>
  );
}

// ── Increases: % by category, USD multiplier ────────────────────────────────
function Increases({ T, v, save, products, categories, categoryOrder, base, priced }) {
  const cats = useMemo(() => {
    const present = [...new Set((products || []).map(p => categories[p.sku] || "Uncategorized"))];
    return [...categoryOrder.filter(c => present.includes(c)), ...present.filter(c => !categoryOrder.includes(c)).sort()];
  }, [products, categories, categoryOrder]);
  const [edit, setEdit] = useState({});
  const pctOf = c => edit[c] ?? (v.rules?.categories?.[c] ?? "");
  const commit = c => { const val = edit[c]; if (val === undefined) return; const n = val === "" ? null : Number(val); setEdit(e => { const x = { ...e }; delete x[c]; return x; }); save({ [path("rules", "categories", c)]: n }, `${c}: ${n === null ? "no increase" : n + "%"}`); };
  const skuRules = Object.keys(v.rules?.skus || {}).filter(k => v.rules.skus[k] !== null && v.rules.skus[k] !== "").length;
  const exact = Object.keys(v.overrides || {}).length;
  return <>
    <Card T={T} title="Price increase by category">
      <div style={{ fontSize: 12, color: T.subtext, marginBottom: 10, lineHeight: 1.5 }}>The % applies to every price of every SKU in the category (package, pallet, prepaid, FTL/LTL), rounded to the whole dollar. Set a different % for a single SKU, or type an exact price, under <b>Review prices</b>.</div>
      <table className="data-table" style={{ maxWidth: 640 }}>
        <thead><tr><th>Category</th><th style={{ textAlign: "right" }}>SKUs</th><th style={{ textAlign: "right" }}>Increase %</th></tr></thead>
        <tbody>{cats.map(c => <tr key={c}>
          <td>{c}</td><td style={{ textAlign: "right" }}>{products.filter(p => (categories[p.sku] || "Uncategorized") === c).length}</td>
          <td style={{ textAlign: "right" }}><input type="number" step="0.5" value={pctOf(c)} placeholder="0" onChange={e => setEdit(x => ({ ...x, [c]: e.target.value }))} onBlur={() => commit(c)} onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} style={{ width: 80, height: 26, textAlign: "right" }} /> %</td>
        </tr>)}</tbody>
      </table>
      <div style={{ fontSize: 11, color: T.tableHeadText, marginTop: 10 }}>{skuRules} SKU-specific % · {exact} SKUs with exact prices typed in</div>
    </Card>
    <Card T={T} title="US dollar prices">
      <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, color: T.subtext, flexWrap: "wrap" }}>
        USD price = CAD price × <input type="number" step="0.01" defaultValue={v.usdMultiplier ?? 0.95} onBlur={e => save({ usdMultiplier: Number(e.target.value) || 0.95 }, `USD multiplier → ${e.target.value}`)} style={{ width: 80, height: 26 }} />, rounded to the whole dollar.
        <span style={{ fontSize: 11, color: T.tableHeadText }}>Used for USD PDFs and CSVs of this list, and for USD quotes once it's active.</span>
      </div>
    </Card>
    <Summary T={T} priced={priced} base={base} categories={categories} />
  </>;
}

// Average % change per category (draft vs current)
function Summary({ T, priced, base, categories }) {
  const rows = useMemo(() => {
    const m = new Map();
    priced.forEach(p => {
      const b = base?.get(up(p.sku)); if (!b) return;
      PRICE_FIELDS.forEach(f => { const o = priceNum(b[f]), n = priceNum(p[f]); if (!o || !n) return; const c = categories[p.sku] || "Uncategorized"; const r = m.get(c) || { o: 0, n: 0, changed: new Set() }; r.o += o; r.n += n; if (o !== n) r.changed.add(p.sku); m.set(c, r); });
    });
    return [...m.entries()];
  }, [priced, base, categories]);
  return (
    <Card T={T} title="Effect on prices">
      <table className="data-table"><thead><tr><th>Category</th><th style={{ textAlign: "right" }}>SKUs changing</th><th style={{ textAlign: "right" }}>Average change</th></tr></thead>
        <tbody>{rows.map(([c, r]) => { const pct = r.o ? ((r.n - r.o) / r.o) * 100 : 0; return <tr key={c}><td>{c}</td><td style={{ textAlign: "right" }}>{r.changed.size}</td><td style={{ textAlign: "right", color: pct > 0 ? GREEN : pct < 0 ? RED : undefined, fontWeight: 600 }}>{pct ? `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%` : "—"}</td></tr>; })}</tbody>
      </table>
      <div style={{ fontSize: 11, color: T.tableHeadText, marginTop: 8 }}>Projections from last year's orders and margins come with the cost & margin step.</div>
    </Card>
  );
}

// ── Review prices: every SKU, old → new, SKU %, exact prices, customer-list tick ─
function Prices({ T, v, draft, editable, save, priced, base, categories, categoryOrder, costs, canCosts }) {
  const costReady = canCosts && costs?.status === "ready", costMap = costs?.costs || {};
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [onlyList, setOnlyList] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const cats = ["All", ...categoryOrder.filter(c => priced.some(p => categories[p.sku] === c)), ...[...new Set(priced.map(p => categories[p.sku] || "Uncategorized"))].filter(c => !categoryOrder.includes(c))];
  const fields = PRICE_FIELDS.filter(f => priced.some(p => (priceNum(p[f]) || 0) > 0));
  const isOn = sku => (v.onList || {})[up(sku)] === true;
  const rows = priced.filter(p => (cat === "All" || (categories[p.sku] || "Uncategorized") === cat)
    && (!q || `${p.sku} ${p.description} ${p.product}`.toLowerCase().includes(q.toLowerCase()))
    && (!onlyList || isOn(p.sku))
    && (!onlyChanged || fields.some(f => base && priceNum(base.get(up(p.sku))?.[f]) !== priceNum(p[f]))));
  const listCount = priced.filter(p => isOn(p.sku)).length;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ height: 28, fontSize: 11 }}>{cats.map(c => <option key={c}>{c}</option>)}</select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search SKU or description…" style={{ height: 28, fontSize: 11, width: 220 }} />
        <label style={{ fontSize: 11 }}><input type="checkbox" checked={onlyList} onChange={e => setOnlyList(e.target.checked)} /> On customer list only</label>
        {draft && <label style={{ fontSize: 11 }}><input type="checkbox" checked={onlyChanged} onChange={e => setOnlyChanged(e.target.checked)} /> Changed only</label>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: T.tableHeadText }}>{listCount} of {priced.length} SKUs on the customer list</span>
      </div>
      <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 8 }}>
        {draft ? <>Old → <b>new</b>. Type in a <b>SKU %</b> to give one SKU a different increase, or type straight into a price for an exact price (shown <span style={{ color: T.gold, fontWeight: 700 }}>gold</span>). Clear it to go back to the %.</> : v.status === "current" ? "Prices of the current list are edited on the Products page. Tick which SKUs appear on the customer price list." : "History — read only."}
      </div>
      <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr>
            <th title="On the customer-facing price list">On list</th><th>SKU</th><th>Description</th>
            {draft && <th style={{ textAlign: "right" }}>SKU %</th>}
            {fields.map(f => <th key={f} style={{ textAlign: "right", whiteSpace: "nowrap" }}>{FIELD_LABEL[f]}</th>)}
          </tr></thead>
          <tbody>{rows.map(p => {
            const b = base?.get(up(p.sku)), sp = v.rules?.skus?.[up(p.sku)], ov = v.overrides?.[up(p.sku)] || {};
            const catPct = v.rules?.categories?.[categories[p.sku] || ""];
            return <tr key={p.sku}>
              <td style={{ textAlign: "center" }}><input type="checkbox" disabled={!editable} checked={isOn(p.sku)} onChange={e => save({ [path("onList", up(p.sku))]: e.target.checked }, `${p.sku} ${e.target.checked ? "added to" : "removed from"} the customer list`)} /></td>
              <td style={{ fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap" }}>{p.sku}</td>
              <td style={{ fontSize: 11, maxWidth: 320 }}>{p.description || p.product}</td>
              {draft && <td style={{ textAlign: "right" }}><PctInput value={sp} placeholder={catPct ? String(catPct) : "0"} onCommit={n => save({ [path("rules", "skus", up(p.sku))]: n }, `${p.sku}: ${n === null ? "back to category %" : n + "%"}`)} /></td>}
              {fields.map(f => {
                const o = b ? priceNum(b[f]) : null, n = priceNum(p[f]), exact = ov[f] !== undefined && ov[f] !== null && ov[f] !== "";
                if (!draft) return <td key={f} style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmt(p[f])}</td>;
                if (!o && !n && !exact) return <td key={f} style={{ textAlign: "right", color: T.tableHeadText }}>—</td>;
                const ch = o && n ? ((n - o) / o) * 100 : 0;
                return <td key={f} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <span style={{ color: T.tableHeadText, fontSize: 10 }}>{fmt(o)} → </span>
                  <PriceInput value={n} exact={exact} T={T} onCommit={val => save({ [path("overrides", up(p.sku), f)]: val }, `${p.sku} ${FIELD_LABEL[f]}: ${val === null ? "back to %" : "$" + val}`)} />
                  {ch ? <div style={{ fontSize: 9, color: ch > 0 ? GREEN : RED }}>{ch > 0 ? "+" : ""}{ch.toFixed(1)}%</div> : null}
                  {costReady && costOf(costMap, p.sku) && n ? (() => { const m = marginPct(n, costOf(costMap, p.sku)); return <div style={{ fontSize: 9, fontWeight: 600, color: marginColor(m, costMap.__targets?.[categories[p.sku] || "Uncategorized"]) || T.subtext }}>margin {m.toFixed(1)}%</div>; })() : null}
                </td>;
              })}
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

function PctInput({ value, placeholder, onCommit }) {
  const [t, setT] = useState(value ?? "");
  useEffect(() => setT(value ?? ""), [value]);
  return <input type="number" step="0.5" value={t} placeholder={placeholder} onChange={e => setT(e.target.value)}
    onBlur={() => { const n = t === "" ? null : Number(t); if (n !== (value ?? null)) onCommit(n); }} onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} style={{ width: 58, height: 24, textAlign: "right", fontSize: 11 }} />;
}
function PriceInput({ value, exact, onCommit, T }) {
  const [t, setT] = useState(value ?? "");
  useEffect(() => setT(value ?? ""), [value]);
  return <input type="number" step="1" value={t} onChange={e => setT(e.target.value)} title={exact ? "Exact price typed in — clear it to use the % again" : "Type to set an exact price"}
    onBlur={() => { if (String(t) === String(value ?? "")) return; onCommit(t === "" ? null : Number(t)); }} onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
    style={{ width: 72, height: 24, textAlign: "right", fontSize: 11, fontWeight: 600, color: exact ? T.gold : undefined, borderColor: exact ? T.gold : undefined }} />;
}

// ── Margins & projection ─────────────────────────────────────────────────────
function Margins({ T, db, v, draft, priced, products, categories, categoryOrder, costs, canCosts, loginName }) {
  return <>
    {draft && <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Projection from real orders</div>
      <Projection T={T} db={db} current={products} draft={priced} categories={categories} costs={canCosts && costs?.status === "ready" ? costs.costs : {}} showCosts={canCosts && costs?.status === "ready"} />
    </div>}
    {canCosts && <>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Costs & margins by SKU</div>
      <CostGate T={T} costs={costs} loginName={loginName}>
        <CostsView T={T} costs={costs} loginName={loginName} products={products} draftProducts={draft ? priced : null} categories={categories} categoryOrder={categoryOrder} />
      </CostGate>
    </>}
  </>;
}

// ── Customer price lists (White Cap, US customers …) ─────────────────────────
function Customers({ T, db, v, draft, editable, save, priced, catOf, base }) {
  const lists = customerLists(v, catOf);
  const names = Object.keys(v.customers || {}).sort();
  const [sel, setSel] = useState(names[0] || "");
  const [addSku, setAddSku] = useState("");
  const [imp, setImp] = useState(null); // CSV import preview
  const fileRef = useRef(null);
  const l = (v.customers || {})[sel];
  const shown = lists[sel];
  const bySku = new Map(priced.map(p => [up(p.sku), p]));
  const fieldsOf = sku => PRICE_FIELDS.filter(f => (priceNum(bySku.get(sku)?.[f]) || 0) > 0);
  const persist = async (patch, what) => {
    await save(patch, what);
    if (v.status === "current") { // quotes read the current version's customer prices
      const next = JSON.parse(JSON.stringify(v));
      Object.entries(patch).forEach(([k, val]) => { const ks = pathParts(k); let o = next; ks.slice(0, -1).forEach(x => { o[x] = o[x] || {}; o = o[x]; }); if (val === null) delete o[ks.at(-1)]; else o[ks.at(-1)] = val; });
      await publishCustomerPrices(db, next, catOf);
    }
  };
  const key = (sku, f) => draft ? path("customers", sel, "exact", sku, f) : path("customers", sel, "prices", sku, f);
  return (
    <div>
      <div style={{ fontSize: 12, color: T.subtext, lineHeight: 1.6, marginBottom: 12, maxWidth: 900 }}>
        Special prices for one customer. Only the SKUs listed here differ; everything else uses the master price. Quotes for a matching company use these prices automatically.
        {draft && " In this draft they get the same % increase as the master SKU, unless you type an exact price."}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <select value={sel} onChange={e => setSel(e.target.value)} style={{ height: 28, fontSize: 12, minWidth: 200 }}>
          {!names.length && <option value="">No customer price lists yet</option>}
          {names.map(n => <option key={n}>{n}</option>)}
        </select>
        {editable && <button className="btn" onClick={() => {
          const n = prompt("Customer name (as it should appear on the PDF):"); if (!n) return;
          const terms = prompt("Words that identify this customer on a quote's company name (comma separated):", n); if (terms === null) return;
          persist({ [path("customers", n)]: { terms: terms.split(",").map(s => s.trim()).filter(Boolean), prices: {} } }, `Added customer price list: ${n}`); setSel(n);
        }}>＋ Add customer</button>}
        {editable && l && <button className="btn-del" onClick={() => { if (confirm(`Remove the ${sel} price list?`)) { persist({ [path("customers", sel)]: null }, `Removed customer price list: ${sel}`); setSel(""); } }}>Remove</button>}
      </div>
      {l && <>
        <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 8 }}>Matches quotes whose company contains: <b style={{ color: T.text }}>{(l.terms || [sel]).join(", ")}</b>
          {editable && <button className="btn" style={{ marginLeft: 8, padding: "1px 8px" }} onClick={() => { const t = prompt("Words that identify this customer (comma separated):", (l.terms || [sel]).join(", ")); if (t !== null) persist({ [path("customers", sel, "terms")]: t.split(",").map(s => s.trim()).filter(Boolean) }, `${sel}: match words → ${t}`); }}>Edit</button>}</div>
        <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, overflowX: "auto" }}>
          <table className="data-table">
            <thead><tr><th>SKU</th><th>Description</th>{PRICE_FIELDS.map(f => <th key={f} style={{ textAlign: "right" }}>{FIELD_LABEL[f]}</th>)}{editable && <th />}</tr></thead>
            <tbody>{Object.keys(shown?.prices || {}).sort().map(sku => {
              const m = bySku.get(sku), used = fieldsOf(sku);
              return <tr key={sku}>
                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{sku}</td><td style={{ fontSize: 11 }}>{m?.description || "—"}</td>
                {PRICE_FIELDS.map(f => {
                  const val = shown.prices[sku]?.[f];
                  if (!used.includes(f) && (val === undefined || val === "")) return <td key={f} style={{ color: T.tableHeadText, textAlign: "right" }}>—</td>;
                  const master = priceNum(m?.[f]), own = priceNum(val);
                  return <td key={f} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {editable ? <PriceInput T={T} value={own ?? ""} exact={draft && l.exact?.[sku]?.[f] != null} onCommit={n => persist({ [key(sku, f)]: n }, `${sel} ${sku} ${FIELD_LABEL[f]}: ${n === null ? "master price" : "$" + n}`)} /> : fmt(val)}
                    <div style={{ fontSize: 9, color: T.tableHeadText }}>master {fmt(master)}{own && master ? ` · ${own < master ? "−" : "+"}${Math.abs(((own - master) / master) * 100).toFixed(1)}%` : ""}</div>
                  </td>;
                })}
                {editable && <td><button className="btn-del" onClick={() => persist({ [path("customers", sel, "prices", sku)]: null, ...(draft ? { [path("customers", sel, "exact", sku)]: null } : {}) }, `${sel}: ${sku} back to master prices`)}>×</button></td>}
              </tr>;
            })}</tbody>
          </table>
        </div>
        {editable && <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} onClick={() => fileRef.current?.click()}>⬆ Import {sel}'s prices from CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={async e => {
            const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
            // Compare against the master prices this list starts from (for a draft: the current list,
            // so a customer's old prices then get the same % increase as everything else)
            const ref = draft && base ? base : bySku;
            const { rows, unknown } = readPriceCSV(await f.text(), [...ref.values()]);
            // Keep only prices that differ from the master; SKUs that match the master go back to master pricing
            const diff = [], same = [];
            rows.forEach(r => {
              const m = ref.get(r.sku); const d = {};
              Object.entries(r.prices).forEach(([fld, val]) => { if (Math.abs((priceNum(m?.[fld]) || 0) - val) > 0.004) d[fld] = val; });
              if (Object.keys(d).length) diff.push({ sku: r.sku, prices: { ...Object.fromEntries(PRICE_FIELDS.filter(x => (priceNum(m[x]) || 0) > 0).map(x => [x, priceNum(m[x])])), ...d }, changed: d, master: m }); else same.push(r.sku);
            });
            setImp({ file: f.name, diff, same, unknown, total: rows.length });
          }} />
          <span style={{ fontSize: 11, color: T.tableHeadText, flexBasis: "100%" }}>Use your price list spreadsheet (File → Save As → CSV, just the {sel} tab) or a CSV exported from the hub. Only prices that differ from the master are kept.</span>
          <input list="pl-skus" value={addSku} onChange={e => setAddSku(e.target.value)} placeholder="Add a SKU with a special price…" style={{ height: 28, width: 260, fontSize: 12 }} />
          <datalist id="pl-skus">{priced.map(p => <option key={p.sku} value={p.sku}>{p.description}</option>)}</datalist>
          <button className="btn" onClick={() => {
            const sku = up(addSku); const m = bySku.get(sku); if (!m) return alert("That SKU isn't on the product list.");
            const prices = Object.fromEntries(fieldsOf(sku).map(f => [f, priceNum(m[f])]));
            persist({ [path("customers", sel, "prices", sku)]: prices }, `${sel}: added ${sku}`); setAddSku("");
          }}>Add</button>
          <span style={{ fontSize: 11, color: T.tableHeadText }}>Starts at the master prices — then change the ones that differ.</span>
        </div>}
      </>}
      {imp && <ImportPreview T={T} imp={imp} sel={sel} bySku={bySku} onCancel={() => setImp(null)} onImport={async () => {
        const where = draft ? "exact" : "prices";
        const patch = {};
        imp.diff.forEach(r => { patch[path("customers", sel, "prices", r.sku)] = r.prices; if (draft && l?.exact?.[r.sku]) patch[path("customers", sel, "exact", r.sku)] = null; });
        imp.same.forEach(sku => { if (l?.prices?.[sku]) patch[path("customers", sel, "prices", sku)] = null; if (draft && l?.exact?.[sku]) patch[path("customers", sel, "exact", sku)] = null; });
        await persist(patch, `${sel}: imported ${imp.diff.length} special prices from ${imp.file}`); setImp(null); void where;
      }} />}
    </div>
  );
}

function ImportPreview({ T, imp, sel, bySku, onCancel, onImport }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Import {sel} prices from {imp.file}</div>
        <div style={{ fontSize: 12, color: T.subtext, marginBottom: 10 }}>Read {imp.total} SKUs: <b>{imp.diff.length} differ</b> from the master, {imp.same.length} match it (they'll use master prices){imp.unknown.length ? `, ${imp.unknown.length} not on the product list (skipped: ${imp.unknown.slice(0, 8).join(", ")}${imp.unknown.length > 8 ? "…" : ""})` : ""}.</div>
        <div style={{ maxHeight: 380, overflow: "auto", border: `1px solid ${T.border}` }}>
          <table className="data-table"><thead><tr><th>SKU</th><th>Price</th><th style={{ textAlign: "right" }}>Master</th><th style={{ textAlign: "right" }}>{sel}</th><th style={{ textAlign: "right" }}>Difference</th></tr></thead>
            <tbody>{imp.diff.flatMap(r => Object.entries(r.changed).map(([f, val], i) => {
              const m = priceNum(r.master?.[f]) || 0, d = m ? ((val - m) / m) * 100 : 0;
              return <tr key={r.sku + f}><td style={{ fontFamily: "monospace", fontSize: 11 }}>{i ? "" : r.sku}</td><td>{FIELD_LABEL[f]}</td><td style={{ textAlign: "right" }}>{fmt(m)}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(val)}</td><td style={{ textAlign: "right", color: d < 0 ? GREEN : RED }}>{d ? `${d > 0 ? "+" : ""}${d.toFixed(1)}%` : ""}</td></tr>;
            }))}</tbody></table>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn-gold" disabled={!imp.diff.length && !imp.same.length} onClick={onImport}>Import {imp.diff.length} special price{imp.diff.length === 1 ? "" : "s"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Notes page (first page of the PDF) ───────────────────────────────────────
function Notes({ T, v, editable, save }) {
  const notes = v.notes || DEFAULT_NOTES;
  const [n, setN] = useState(notes);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setN(v.notes || DEFAULT_NOTES); }, [v.notes]); // eslint-disable-line
  const ch = next => { setN(next); setDirty(true); };
  const ta = { width: "100%", fontSize: 12, lineHeight: 1.5 };
  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: T.subtext }}>Everything here prints on page 1 of the price list. One note per line.</div>
        <span style={{ flex: 1 }} />
        {editable && <button className="btn-gold" disabled={!dirty} style={{ padding: "6px 14px", fontSize: 11, opacity: dirty ? 1 : .5 }} onClick={async () => { await save({ notes: n }, "Notes page updated"); setDirty(false); }}>Save notes</button>}
      </div>
      <Card T={T} title="Opening message"><textarea disabled={!editable} rows={3} value={n.intro || ""} onChange={e => ch({ ...n, intro: e.target.value })} style={ta} /></Card>
      {(n.boxes || []).map((b, i) => (
        <Card key={i} T={T} title={editable ? <input value={b.title} onChange={e => ch({ ...n, boxes: n.boxes.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} style={{ height: 26, fontSize: 12, fontWeight: 600, width: 300 }} /> : b.title}
          right={editable && <span style={{ display: "flex", gap: 4 }}>
            <button className="btn" disabled={!i} onClick={() => { const bx = [...n.boxes]; [bx[i - 1], bx[i]] = [bx[i], bx[i - 1]]; ch({ ...n, boxes: bx }); }}>↑</button>
            <button className="btn-del" onClick={() => ch({ ...n, boxes: n.boxes.filter((_, j) => j !== i) })}>Remove</button></span>}>
          <textarea disabled={!editable} rows={Math.max(2, (b.items || []).length + 1)} value={(b.items || []).join("\n")} onChange={e => ch({ ...n, boxes: n.boxes.map((x, j) => j === i ? { ...x, items: e.target.value.split("\n") } : x) })} style={ta} />
        </Card>
      ))}
      {editable && <button className="btn" style={{ marginBottom: 14 }} onClick={() => ch({ ...n, boxes: [...(n.boxes || []), { title: "New section", items: [""] }] })}>＋ Add a notes section</button>}
      <Card T={T} title="Links (label | web address, one per line)">
        <textarea disabled={!editable} rows={4} value={(n.links || []).map(l => `${l.label} | ${l.url}`).join("\n")} onChange={e => ch({ ...n, links: e.target.value.split("\n").map(x => { const [label, url] = x.split("|").map(s => (s || "").trim()); return { label, url: url || "" }; }) })} style={ta} />
      </Card>
    </div>
  );
}

// ── PDF & CSV ────────────────────────────────────────────────────────────────
function Output({ T, v, draft, priced, base, categories, subCategories, subCatDefs, categoryOrder, catOf, logo }) {
  const lists = customerLists(v, catOf);
  const [cust, setCust] = useState("");     // "" = general list
  const [typed, setTyped] = useState("");   // a customer without a special list (name on the PDF only)
  const [cur, setCur] = useState("CAD");
  const frame = useRef(null);
  const year = yearOf(v);
  const custName = cust === "__other" ? typed.trim() : cust;
  const special = cust && cust !== "__other" ? lists[cust] : null;
  const listProducts = useMemo(() => {
    const on = priced.filter(p => (v.onList || {})[up(p.sku)] === true);
    if (!special) return on;
    return on.map(p => { const o = special.prices?.[up(p.sku)]; return o ? { ...p, ...o } : p; });
  }, [priced, v.onList, special]);
  const html = useMemo(() => buildPriceListHTML({
    products: listProducts, categories, subCategories, subCatDefs, categoryOrder, notes: v.notes || DEFAULT_NOTES,
    year, versionLabel: (v.name || "").replace(year, "").trim() || v.name, effectiveText: fmtEffective(v.effectiveDate),
    customerName: custName, currency: cur, usdMultiplier: v.usdMultiplier ?? 0.95, logo,
  }), [listProducts, v, custName, cur, year, categories, subCategories, subCatDefs, categoryOrder, logo]);
  useEffect(() => { const d = frame.current?.contentDocument; if (d) { d.open(); d.write(html); d.close(); } }, [html]);
  const fileName = pdfFileName(year, custName) + (cur === "USD" ? " (USD)" : "");
  const print = () => {
    const w = frame.current?.contentWindow; if (!w) return;
    const old = document.title; w.document.title = fileName; document.title = fileName;
    w.focus(); w.print(); setTimeout(() => { document.title = old; }, 1000);
  };
  const conv = x => { const n = priceNum(x); if (n === null) return ""; return cur === "USD" ? Math.round(n * (v.usdMultiplier ?? 0.95)) : n; };
  const csv = which => {
    const rows = which === "customer" ? listProducts : priced.map(p => { const o = special?.prices?.[up(p.sku)]; return o ? { ...p, ...o } : p; });
    if (which === "compare") {
      const h = ["SKU", "Description", "Category", ...PRICE_FIELDS.flatMap(f => [`${FIELD_LABEL[f]} old`, `${FIELD_LABEL[f]} new`])];
      downloadCSV(`${pdfFileName(year)} - old vs new.csv`, h, priced.map(p => { const b = base?.get(up(p.sku)) || {}; return [p.sku, p.description, categories[p.sku] || "", ...PRICE_FIELDS.flatMap(f => [conv(b[f]), conv(p[f])])]; }));
      return;
    }
    const h = ["SKU", "Product", "Description", "Category", "Package Qty", "Pallet Qty", ...PRICE_FIELDS.map(f => `${FIELD_LABEL[f]} (${cur})`)];
    downloadCSV(`${fileName}${which === "customer" ? "" : " - all SKUs"}.csv`, h, rows.map(p => [p.sku, p.product, p.description, categories[p.sku] || "", p.pkg || "", p.pallet || "", ...PRICE_FIELDS.map(f => conv(p[f]))]));
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontSize: 12 }}>Customer:</span>
        <select value={cust} onChange={e => setCust(e.target.value)} style={{ height: 30, fontSize: 12, minWidth: 220 }}>
          <option value="">General price list (no customer name)</option>
          {Object.keys(lists).sort().map(n => <option key={n} value={n}>{n} — their own prices</option>)}
          <option value="__other">Another customer (name on the PDF only)…</option>
        </select>
        {cust === "__other" && <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="e.g. Bunzl Safety" style={{ height: 30, fontSize: 12, width: 200 }} />}
        <select value={cur} onChange={e => setCur(e.target.value)} style={{ height: 30, fontSize: 12 }}><option>CAD</option><option>USD</option></select>
        <button className="btn-gold" style={{ padding: "7px 16px", fontSize: 11 }} onClick={print}>🖨 Save PDF</button>
        <button className="btn" onClick={() => csv("customer")}>CSV — customer list</button>
        <button className="btn" onClick={() => csv("all")}>CSV — all SKUs</button>
        {draft && <button className="btn" onClick={() => csv("compare")}>CSV — old vs new</button>}
      </div>
      <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 10 }}>File name: <b style={{ color: T.text }}>{fileName}.pdf</b> · In the print window choose <b>Save as PDF</b> and <b>Landscape</b>.{draft && " This is a draft — you can send it before making it active."}</div>
      <div style={{ background: "#555", padding: 12, borderRadius: 3 }}>
        <iframe ref={frame} title="Price list preview" style={{ width: "100%", height: 760, border: "none", background: "#fff" }} />
      </div>
    </div>
  );
}

function Log({ T, v }) {
  const log = [...(v.log || [])].sort((a, b) => (a.at < b.at ? 1 : -1));
  return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, maxWidth: 900 }}>
      <table className="data-table"><thead><tr><th>When</th><th>Who</th><th>What changed</th></tr></thead>
        <tbody>{log.map((e, i) => <tr key={i}><td style={{ whiteSpace: "nowrap" }}>{when(e.at)}</td><td>{e.by}</td><td>{e.what}</td></tr>)}</tbody></table>
    </div>
  );
}
