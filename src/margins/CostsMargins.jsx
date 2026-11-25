// ─── Costs & Margins (left-hand area; everyone with "Costs & margins" — not John) ─────────────────
// Grant's approach: per SKU Materials + Labour → + Overhead (by product line) + Extra = Fully loaded cost;
// Net margin vs the line's target. Tabs: Product costs · Overview · Overhead & targets · Change log.
// One locked book (store.js); Save also rewrites the hub's cost list so reports/product pages use it.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "../Loader";
import { CostGate } from "../pricelist/CostsView";
import * as M from "./model";
import { readWorkbook } from "./importExcel";

const GREEN = "#34c77b", RED = "#e8472c", AMBER = "#e8a23a";
const clone = o => JSON.parse(JSON.stringify(o));
const money = (v, dp = 2) => v == null || !isFinite(v) ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-CA", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = v => v == null || !isFinite(v) ? "—" : `${v.toFixed(1)}%`;
const numIn = v => v === "" ? "" : isNaN(+v) ? v : +v;
const tierLabel = t => (M.TIERS.find(x => x[0] === t) || [, t])[1];
let DRAFT = null; // unsaved changes survive switching tabs/areas (memory only, never stored)

export default function CostsMargins({ T, section, setSection, mbook, costs, loginName, productsCAD = [], productsUSD = [], categories = {}, focusSku, onFocusDone }) {
  if (costs.status !== "ready") return <div style={{ padding: 16 }}><CostGate T={T} costs={costs}>{null}</CostGate></div>;
  if (mbook.status === "locked") return <div style={{ padding: 16, fontSize: 12, color: T.tableHeadText }}>Costs are locked on this computer — sign out and back in with your own password.</div>;
  if (mbook.status !== "ready") return <Loader T={T} label="Loading costs…" />;
  return <Book T={T} section={section} setSection={setSection} mbook={mbook} costs={costs} loginName={loginName} productsCAD={productsCAD} productsUSD={productsUSD} categories={categories} focusSku={focusSku} onFocusDone={onFocusDone} />;
}

function Book({ T, section, setSection, mbook, costs, loginName, productsCAD, productsUSD, categories, focusSku, onFocusDone }) {
  const draft = DRAFT && DRAFT.by === loginName ? DRAFT : null;
  const [book, setBook] = useState(() => draft ? draft.book : clone(mbook.book));
  const [dirty, setDirty] = useState(() => !!draft);
  const [msg, setMsg] = useState("");
  useEffect(() => { DRAFT = dirty ? { by: loginName, book } : null; }, [book, dirty, loginName]);
  useEffect(() => { if (!dirty) setBook(clone(mbook.book)); }, [mbook.book]); // eslint-disable-line
  useEffect(() => {
    const warn = e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const change = fn => { setBook(b => { const n = clone(b); fn(n); return n; }); setDirty(true); };
  const R = useMemo(() => M.rates(book.settings), [book.settings]);
  const priceOf = useMemo(() => {
    const ca = new Map(productsCAD.map(p => [M.skuKey(p.sku), p])), us = new Map(productsUSD.map(p => [M.skuKey(p.sku), p]));
    return (sku, mkt, level = "price") => {
      const p = (mkt === "us" ? us : ca).get(M.skuKey(sku)), v = p ? parseFloat(String(p[level] ?? "").replace(/[^0-9.\-]/g, "")) : NaN;
      return isNaN(v) || !v ? null : mkt === "us" ? v * R.usdRate : v;
    };
  }, [productsCAD, productsUSD, R.usdRate]);
  const ctx = { R, priceOf, book, change, productsCAD, categories, T };

  // Keep the hub's cost list = what this book gives (only once there are product lines — never wipe it blind)
  const syncing = useRef(false);
  useEffect(() => {
    const b = mbook.book;
    if (syncing.current || !b?.lines?.length || !productsCAD.length) return;
    const next = M.costList(b, costs.costs || {}, priceOf, "Costs & Margins");
    if (!M.costListDiffers(costs.costs || {}, next)) return;
    syncing.current = true;
    costs.save(next, loginName).catch(e => console.warn("Couldn't update the cost list:", e)).finally(() => { syncing.current = false; });
  }, [mbook.book, costs.costs, productsCAD]); // eslint-disable-line

  const save = async () => {
    setMsg("Saving…");
    try {
      const at = new Date().toISOString();
      const log = [...(book.log || []), ...M.describeChanges(mbook.book, book).map(([where, what, from, to]) => ({ at, by: loginName, where, what, from, to }))];
      const next = { ...book, log };
      await mbook.save(next, loginName);
      await costs.save(M.costList(next, costs.costs || {}, priceOf, loginName, at), loginName);
      setBook(next); setDirty(false); setMsg("Saved ✓"); setTimeout(() => setMsg(""), 2500);
    } catch (e) { setMsg(""); alert("Couldn't save: " + e.message); }
  };
  const undo = () => { if (confirm("Undo all changes since the last save?")) { setBook(clone(mbook.book)); setDirty(false); } };

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: `1px solid ${T.border}`, background: dirty ? "rgba(232,162,58,.10)" : "transparent", minHeight: 38, flexWrap: "wrap" }}>
        {dirty ? <span style={{ fontSize: 12, color: AMBER, fontWeight: 600 }}>● Unsaved changes</span> : <span style={{ fontSize: 11, color: T.tableHeadText }}>{mbook.at ? `Last saved ${new Date(mbook.at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${mbook.by ? " by " + mbook.by : ""}` : "Nothing saved yet"}</span>}
        {msg && <span style={{ fontSize: 12, color: T.gold, fontWeight: 600 }}>{msg}</span>}
        <div style={{ flex: 1 }} />
        {dirty && <button className="btn" onClick={undo}>Undo changes</button>}
        <button className="btn-gold" style={{ padding: "6px 16px", fontSize: 11, opacity: dirty ? 1 : .5 }} disabled={!dirty || msg === "Saving…"} onClick={save}>{dirty ? "Save changes" : "Saved"}</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex" }}>
        {section === "overview" ? <Overview {...ctx} openSku={(lineId, skuId) => { setSection("costs"); setTimeout(() => window.dispatchEvent(new CustomEvent("bmp-margin-open", { detail: { lineId, skuId } })), 0); }} />
          : section === "settings" ? <Settings {...ctx} />
          : section === "log" ? <ChangeLog T={T} log={book.log || []} />
          : <ProductCosts {...ctx} focusSku={focusSku} onFocusDone={onFocusDone} />}
      </div>
    </div>
  );
}

const card = T => ({ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3 });
const inpS = T => ({ height: 26, fontSize: 12, padding: "0 6px", background: T.inputBg || T.cardBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 2 });

// ── Product costs ────────────────────────────────────────────────────────────
function ProductCosts({ T, R, priceOf, book, change, productsCAD, categories, focusSku, onFocusDone }) {
  const [sel, setSel] = useState(() => book.lines[0]?.id || null);
  const [market, setMarket] = useState("ca");
  const [level, setLevel] = useState("price");
  const [open, setOpen] = useState({});     // sku id → materials breakdown shown
  const [hi, setHi] = useState(null);
  const [importing, setImporting] = useState(null);
  const [busy, setBusy] = useState("");
  const line = book.lines.find(l => l.id === sel) || book.lines[0];
  const inp = inpS(T);
  const listed = useMemo(() => new Set(productsCAD.map(p => M.skuKey(p.sku))), [productsCAD]);
  const jump = (lineId, skuId) => { setSel(lineId); setHi(skuId); setTimeout(() => document.getElementById("mrow-" + skuId)?.scrollIntoView({ block: "center", behavior: "smooth" }), 80); };
  useEffect(() => { const f = e => jump(e.detail.lineId, e.detail.skuId); window.addEventListener("bmp-margin-open", f); return () => window.removeEventListener("bmp-margin-open", f); }, []);
  useEffect(() => {
    if (!focusSku) return;
    const k = M.skuKey(focusSku);
    for (const l of book.lines) { const s = l.skus.find(x => M.skuKey(x.sku) === k); if (s) { jump(l.id, s.id); break; } }
    onFocusDone?.();
  }, [focusSku]); // eslint-disable-line

  const edit = fn => change(b => { const l = b.lines.find(x => x.id === line.id); if (l) fn(l, b); });
  const editSku = (id, fn) => edit(l => { const s = l.skus.find(x => x.id === id); if (s) fn(s); });
  const addSku = (fromId) => {
    const id = M.uid();
    edit(l => { const from = l.skus.find(x => x.id === fromId); const s = from ? { ...clone(from), id, sku: "", desc: (from.desc || "") + " (copy)", manualPrice: {} } : { id, sku: "", desc: "", materials: null, labour: null, extra: null };
      if (from) l.skus.splice(l.skus.indexOf(from) + 1, 0, s); else l.skus.push(s); });
    setHi(id); setTimeout(() => document.getElementById("mrow-" + id)?.querySelector("input")?.focus(), 80);
  };
  const newLine = () => {
    const name = prompt("Name of the product line (e.g. Spill Berms):"); if (!name?.trim()) return;
    const l = { id: M.uid(), name: name.trim(), method: "company", tier: "manufactured", skus: [] };
    change(b => b.lines.push(l)); setSel(l.id);
  };

  // Import
  const onFiles = async files => {
    setBusy("Reading…");
    try {
      const res = [];
      for (const f of files) res.push(await readWorkbook(await f.arrayBuffer(), f.name));
      const bad = res.filter(r => r.kind === "unknown");
      if (bad.length === res.length) { setBusy(""); return alert("These don't look like the Combined Cost Calculator or the blanket working file — nothing to import."); }
      setImporting({ results: res.filter(r => r.kind !== "unknown"), pick: Object.fromEntries(res.flatMap(r => (r.lines || []).map(l => [l.id, true]))) });
    } catch (e) {
      alert(/dynamically imported module|Failed to fetch|Importing a module script|Loading chunk/i.test(e.message || "") ? "The hub was updated since you opened this page. Refresh the page (F5), then import again." : "Couldn't read that file: " + e.message);
    }
    setBusy("");
  };
  const finishImport = () => {
    const { results: raw, pick } = importing;
    const results = clone(raw); // the import box's copies stay untouched
    const notes = results.map(r => r.kind === "combined" ? `${r.lines.filter(l => pick[l.id]).length} product lines from ${r.fileName}` : `material breakdowns for ${r.skus.length} blanket SKUs (${r.shared.length} shared prices)`);
    change(b => {
      results.forEach(r => {
        if (r.kind === "combined") {
          r.lines.filter(l => pick[l.id]).forEach(l => { b.lines = b.lines.filter(x => x.name.toLowerCase() !== l.name.toLowerCase()); b.lines.push(l); });
          const s = b.settings;
          if (s.company.rate == null && r.settings.companyRate != null) s.company.rate = r.settings.companyRate;
          if (s.brooks.blanketRate == null && r.settings.blanketRate != null) s.brooks.blanketRate = r.settings.blanketRate;
          if (s.brooks.wattleRate == null && r.settings.wattleRate != null) s.brooks.wattleRate = r.settings.wattleRate;
          if (s.usdRate == null && r.settings.usdRate) s.usdRate = r.settings.usdRate;
        } else if (r.kind === "blanket") {
          r.shared.forEach(sh => { const same = b.shared.find(x => x.name === sh.name && x.price === sh.price); if (same) r.skus.forEach(s => s.items.forEach(it => { if (it.shared === sh.id) it.shared = same.id; })); else b.shared.push(sh); });
          const missing = [];
          r.skus.forEach(rec => {
            const l = b.lines.find(x => x.skus.some(s => M.skuKey(s.sku) === M.skuKey(rec.sku)));
            const s = l?.skus.find(x => M.skuKey(x.sku) === M.skuKey(rec.sku));
            if (s) { if (rec.items.length) s.items = rec.items; if (rec.usa) s.usa = rec.usa; } else missing.push(rec);
          });
          if (missing.length) {
            let l = b.lines.find(x => /blanket/i.test(x.name));
            if (!l) { l = { id: M.uid(), name: "Erosion Blankets", method: "blanket", tier: "manufactured", skus: [] }; b.lines.push(l); }
            missing.forEach(rec => l.skus.push({ id: M.uid(), sku: rec.sku, desc: rec.desc, items: rec.items, labour: rec.labour, usa: rec.usa || undefined }));
          }
        }
      });
    });
    setImporting(null);
    setBusy(`Imported ${notes.join(" + ")} — check them, then click Save changes.`);
  };
  const importBtn = big => (
    <label className={big ? "btn-gold" : "btn"} style={{ cursor: "pointer", ...(big ? { padding: "8px 16px", fontSize: 12, display: "inline-block" } : {}) }}>
      ⬆ Import from Excel
      <input type="file" accept=".xlsx,.xls" multiple style={{ display: "none" }} onChange={e => { const f = [...e.target.files]; e.target.value = ""; if (f.length) onFiles(f); }} />
    </label>);

  const rows = line ? line.skus.map(s => ({ s, r: M.computeSku(line, s, { rates: R, shared: book.shared, market, priceOf, level }) })) : [];
  const dupes = new Set(); { const seen = new Set(); book.lines.forEach(l => l.skus.forEach(s => { const k = M.skuKey(s.sku); if (k) { if (seen.has(k)) dupes.add(k); seen.add(k); } })); }
  const ohText = l => ({ company: `${R.companyPct}% of M+L`, blanket: `${money(R.blanketRate)} per roll`, wattle: `${money(R.wattleRate)} per wattle`, fixed: `${money(+l.fixed || 0)} per unit`, none: "none" })[l.method || "company"];
  const problems = l => l.skus.filter(s => { const r = M.computeSku(l, s, { rates: R, shared: book.shared, market: "ca", priceOf, level: "price" }); return ["loss", "under"].includes(r.status); }).length;
  const th = { padding: "6px 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: T.tableHeadText, background: T.tableHead, textAlign: "right", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 1 };
  const td = { padding: "4px 6px", borderBottom: `1px solid ${T.border}`, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const usa = market === "us";

  return (<>
    {/* Left: product lines */}
    <div style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${T.border}`, overflowY: "auto", padding: "10px 0", background: T.cardBg }}>
      <div style={{ padding: "0 14px 6px", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: T.gold }}>Product lines</div>
      {book.lines.map(l => { const p = problems(l); return (
        <button key={l.id} onClick={() => { setSel(l.id); setHi(null); }} style={{ display: "flex", width: "100%", alignItems: "center", gap: 6, textAlign: "left", padding: "6px 14px", border: "none", borderLeft: `2px solid ${line?.id === l.id ? T.gold : "transparent"}`, background: line?.id === l.id ? T.activeBg : "transparent", color: T.text, fontSize: 12, cursor: "pointer" }}>
          <span style={{ flex: 1 }}>{l.name}</span>
          {p > 0 && <span title={`${p} under target`} style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠{p}</span>}
          <span style={{ fontSize: 10, color: T.tableHeadText }}>{l.skus.length}</span>
        </button>); })}
      <div style={{ borderTop: `1px solid ${T.border}`, margin: "8px 0", paddingTop: 6 }}>
        <button onClick={newLine} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 14px", border: "none", background: "transparent", color: T.subtext, fontSize: 12, cursor: "pointer" }}>＋ New product line</button>
        <div style={{ padding: "6px 14px" }}>{importBtn(false)}</div>
      </div>
    </div>

    {/* Right */}
    <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: 16 }}>
      {busy && <div style={{ fontSize: 12, color: T.gold, fontWeight: 600, marginBottom: 10 }}>{busy}</div>}
      {!line ? (
        <div style={{ ...card(T), padding: 20, maxWidth: 680 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Start with Grant's spreadsheets</div>
          <div style={{ fontSize: 12, color: T.subtext, lineHeight: 1.7, marginBottom: 14 }}>
            Import the <b>BMP Combined Cost Calculator</b> — every product line and SKU comes in with its materials, labour, overhead method and prices.
            Then import the <b>erosion blanket working file</b> to add the blankets' itemised materials (jute, straw, coconut…) and USA costs.
            You can pick both files at once. Nothing is saved until you click <b>Save changes</b>.
          </div>
          {importBtn(true)} <button className="btn" style={{ marginLeft: 8 }} onClick={newLine}>＋ Start a product line by hand</button>
        </div>
      ) : (<>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <input value={line.name} onChange={e => edit(l => { l.name = e.target.value; })} style={{ ...inp, width: 200, fontWeight: 700, fontSize: 14, height: 30 }} title="Product line name" />
          <label style={{ fontSize: 11, color: T.subtext }}>Overhead <select value={line.method || "company"} onChange={e => edit(l => { l.method = e.target.value; })} style={inp}>{M.METHODS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {line.method === "fixed" && <label style={{ fontSize: 11, color: T.subtext }}>$ <input type="number" step="0.01" value={line.fixed ?? ""} onChange={e => edit(l => { l.fixed = numIn(e.target.value); })} style={{ ...inp, width: 70 }} /></label>}
          <span style={{ fontSize: 11, color: T.gold, fontWeight: 600 }}>= {ohText(line)}</span>
          <label style={{ fontSize: 11, color: T.subtext, marginLeft: 8 }}>Target <select value={line.tier || "manufactured"} onChange={e => edit(l => { l.tier = e.target.value; })} style={inp}>{M.TIERS.map(([k, v]) => <option key={k} value={k}>{v} — {R.tiers[k]}%</option>)}</select></label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ display: "inline-flex", border: `1px solid ${T.border}`, borderRadius: 2 }}>
            {[["ca", "🇨🇦 Canada"], ["us", "🇺🇸 USA"]].map(([k, l]) => <button key={k} onClick={() => setMarket(k)} style={{ border: "none", padding: "4px 10px", fontSize: 11, cursor: "pointer", background: market === k ? T.gold : "transparent", color: market === k ? "#111" : T.subtext }}>{l}</button>)}
          </div>
          {!usa && <label style={{ fontSize: 11, color: T.subtext }}>Price <select value={level} onChange={e => setLevel(e.target.value)} style={inp}>{M.PRICE_LEVELS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
          {usa && <span style={{ fontSize: 11, color: T.subtext }}>USA price list × {R.usdRate} · for every SKU unless set on the row: commission <input type="number" step="0.1" value={line.usa?.commission ?? ""} placeholder="0" onChange={e => edit(l => { l.usa = { ...(l.usa || {}), commission: numIn(e.target.value) }; })} style={{ ...inp, width: 52 }} />% · tariff <input type="number" step="0.1" value={line.usa?.tariff ?? ""} placeholder="0" onChange={e => edit(l => { l.usa = { ...(l.usa || {}), tariff: numIn(e.target.value) }; })} style={{ ...inp, width: 52 }} />% · FOB shipping $<input type="number" step="0.01" value={line.usa?.fob ?? ""} placeholder="0" onChange={e => edit(l => { l.usa = { ...(l.usa || {}), fob: numIn(e.target.value) }; })} style={{ ...inp, width: 60 }} /></span>}
          <label style={{ fontSize: 11, color: T.subtext }} title="Labour for every SKU in this line that has none of its own">Labour for all SKUs <LabourPick T={T} value={line.labour} shared={book.shared} onChange={v => edit(l => { l.labour = v; })} /></label>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={() => addSku(null)}>＋ Add SKU</button>
        </div>

        <div style={{ ...card(T), overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, color: T.text, minWidth: "100%" }}>
            <thead><tr>
              <th style={{ ...th, textAlign: "left" }}>SKU</th><th style={{ ...th, textAlign: "left" }}>Description</th>
              <th style={th}>Materials</th><th style={th}>Labour</th><th style={th} title="Shipping in / other per-unit costs">Extra $</th>
              <th style={th}>Overhead</th>{usa && <><th style={th}>Comm. %</th><th style={th}>Tariff %</th><th style={th}>FOB $</th></>}
              <th style={{ ...th, color: T.text }}>Fully loaded</th><th style={th}>{usa ? "USA price (CAD)" : "Price"}</th><th style={th}>Profit</th><th style={{ ...th, color: T.text }}>Net margin</th><th style={th}></th>
            </tr></thead>
            <tbody>{rows.map(({ s, r }) => {
              const st = M.STATUS[r.status], k = M.skuKey(s.sku), onList = k && listed.has(k), lp = priceOf(s.sku, market, usa ? "price" : level);
              return <Fragment key={s.id}>
                <tr id={"mrow-" + s.id} style={{ background: hi === s.id ? "rgba(200,169,110,.18)" : undefined }}>
                  <td style={{ ...td, textAlign: "left" }}>
                    <input list="m-skus" value={s.sku || ""} placeholder="SKU" onChange={e => editSku(s.id, x => { x.sku = e.target.value.trim().toUpperCase(); const p = productsCAD.find(p => M.skuKey(p.sku) === M.skuKey(e.target.value)); if (p && !x.desc) x.desc = p.description || p.product || ""; })}
                      title={!s.sku ? "Type or pick a SKU" : dupes.has(k) ? "This SKU is costed twice — the first one is used" : onList ? "On the price list" : "Not on the price list — type a price"}
                      style={{ ...inp, width: 120, fontFamily: "monospace", fontSize: 11, borderColor: !s.sku ? T.border : dupes.has(k) ? RED : onList ? GREEN : AMBER }} />
                  </td>
                  <td style={{ ...td, textAlign: "left" }}><input value={s.desc || ""} onChange={e => editSku(s.id, x => { x.desc = e.target.value; })} style={{ ...inp, width: 230 }} /></td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <button title={s.items?.length ? "Show / hide the materials breakdown" : "Itemise materials (jute, straw…)"} onClick={() => setOpen(o => ({ ...o, [s.id]: !o[s.id] }))} style={{ border: "none", background: "transparent", color: s.items?.length ? T.gold : T.tableHeadText, cursor: "pointer", fontSize: 11, padding: 0 }}>{open[s.id] ? "▾" : "▸"}</button>
                      {s.items?.length ? <span style={{ width: 70, display: "inline-block", fontWeight: 600, cursor: "pointer" }} onClick={() => setOpen(o => ({ ...o, [s.id]: !o[s.id] }))}>{money(r.materials)}</span>
                        : <input type="number" step="0.01" value={s.materials ?? ""} onChange={e => editSku(s.id, x => { x.materials = numIn(e.target.value); })} style={{ ...inp, width: 70, textAlign: "right" }} />}
                    </span>
                  </td>
                  <td style={td}><LabourPick T={T} value={s.labour} shared={book.shared} placeholder={r.labour != null && (s.labour == null || s.labour === "") ? r.labour.toFixed(2) : ""} onChange={v => editSku(s.id, x => { x.labour = v; })} /></td>
                  <td style={td}><input type="number" step="0.01" value={s.extra ?? ""} onChange={e => editSku(s.id, x => { x.extra = numIn(e.target.value); })} style={{ ...inp, width: 60, textAlign: "right" }} /></td>
                  <td style={{ ...td, color: T.subtext }}>{r.materials != null || r.labour != null ? money(r.overhead) : "—"}</td>
                  {usa && <>{["commission", "tariff", "fob"].map(f => <td key={f} style={td}><input type="number" step="0.01" value={s.usa?.[f] ?? ""} placeholder={String(line.usa?.[f] ?? 0)} onChange={e => editSku(s.id, x => { x.usa = { ...(x.usa || {}), [f]: numIn(e.target.value) }; })} style={{ ...inp, width: 54, textAlign: "right" }} /></td>)}</>}
                  <td style={{ ...td, fontWeight: 700 }} title={r.cost != null ? `M+L ${money(r.ml)} + overhead ${money(r.overhead)}${r.extra ? ` + extra ${money(r.extra)}` : ""}${r.usa ? ` + commission ${money(r.usa.commission)} + tariff ${money(r.usa.tariff)} + FOB ${money(r.usa.fob)}` : ""}` : ""}>{money(r.cost)}</td>
                  <td style={td}>{lp != null ? money(lp) : <span title={usa ? "Not on the USA price list — type the USD price" : "Not on the price list — type a price"}>{usa ? "US$" : "$"}<input type="number" step="0.01" value={s.manualPrice?.[usa ? "us" : level] ?? ""} onChange={e => editSku(s.id, x => { x.manualPrice = { ...(x.manualPrice || {}), [usa ? "us" : level]: numIn(e.target.value) }; })} style={{ ...inp, width: 64, textAlign: "right", borderColor: AMBER }} /></span>}</td>
                  <td style={{ ...td, color: r.profit < 0 ? RED : undefined }}>{money(r.profit)}</td>
                  <td style={{ ...td }} title={st ? `${st.label} · target ${r.target}%${r.markup != null ? ` · markup ${r.markup.toFixed(0)}%` : ""}` : ""}><b style={{ color: st?.color }}>{pct(r.margin)}</b> <span style={{ fontSize: 10, color: st?.color }}>{r.status === "ok" ? "✓" : r.status === "close" ? "~" : ["loss", "under"].includes(r.status) ? "⚠" : ""}</span></td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button title="Copy this SKU (new row right after it)" onClick={() => addSku(s.id)} style={{ border: "none", background: "transparent", color: T.tableHeadText, cursor: "pointer" }}>⧉</button>
                    <button title="Remove this SKU" onClick={() => confirm(`Remove ${s.sku || "this SKU"}?`) && edit(l => { l.skus = l.skus.filter(x => x.id !== s.id); })} style={{ border: "none", background: "transparent", color: T.tableHeadText, cursor: "pointer" }}>×</button>
                  </td>
                </tr>
                {open[s.id] && <tr><td colSpan={usa ? 14 : 11} style={{ padding: "6px 10px 10px 40px", background: T.tableHead }}>
                  <Breakdown T={T} sku={s} shared={book.shared} onChange={fn => editSku(s.id, fn)} />
                </td></tr>}
              </Fragment>;
            })}</tbody>
          </table>
          {!rows.length && <div style={{ padding: 16, fontSize: 12, color: T.tableHeadText }}>No SKUs yet — click ＋ Add SKU.</div>}
        </div>
        <datalist id="m-skus">{productsCAD.map(p => <option key={p.sku} value={p.sku}>{p.description || p.product}</option>)}</datalist>
        <div style={{ fontSize: 11, color: T.tableHeadText, marginTop: 8, lineHeight: 1.6 }}>
          Fully loaded cost = materials + labour + overhead + extra{usa ? " + USA commission, tariff and FOB shipping" : ""}. Net margin = (price − fully loaded cost) ÷ price, against the
          <b> {tierLabel(line.tier || "manufactured")}</b> target of <b>{R.tiers[line.tier || "manufactured"]}%</b> (red = under, amber = within 5 points). Hover a margin for the markup. SKU box: green = on the price list, amber = type a price.
        </div>
        <div style={{ marginTop: 14 }}><button className="btn-del" onClick={() => confirm(`Delete the ${line.name} product line and its ${line.skus.length} SKUs?`) && change(b => { b.lines = b.lines.filter(x => x.id !== line.id); })}>Delete this product line</button></div>
      </>)}
    </div>

    {importing && <div className="modal-overlay" onClick={() => setImporting(null)}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Import</div>
        {importing.results.map((r, i) => <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{r.fileName}</div>
          {r.kind === "combined" ? <>
            <div style={{ fontSize: 11, color: T.subtext, margin: "2px 0 6px" }}>Product lines to bring in (one with the same name as an existing line replaces it). Rates found: {r.settings.companyRate ?? "—"}% · ${r.settings.blanketRate ?? "—"}/roll · ${r.settings.wattleRate ?? "—"}/wattle (only filled in where you haven't set your own).</div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>{r.lines.map(l => <label key={l.id} style={{ display: "flex", gap: 8, fontSize: 12, padding: "2px 0", alignItems: "center" }}>
              <input type="checkbox" checked={!!importing.pick[l.id]} onChange={e => setImporting(m => ({ ...m, pick: { ...m.pick, [l.id]: e.target.checked } }))} />
              <span style={{ flex: 1 }}>{l.name} <span style={{ color: T.tableHeadText }}>· {l.skus.length} SKUs · {(M.METHODS.find(x => x[0] === l.method) || [, ""])[1].split(" — ")[0]}</span></span>
              <select value={l.tier} onChange={e => { l.tier = e.target.value; setImporting(m => ({ ...m })); }} style={{ ...inp, height: 22, fontSize: 11 }}>{M.TIERS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              {book.lines.some(x => x.name.toLowerCase() === l.name.toLowerCase()) && <span style={{ fontSize: 10, color: AMBER }}>replaces</span>}
            </label>)}</div>
          </> : <div style={{ fontSize: 11, color: T.subtext }}>Erosion blanket working file — {r.skus.length} SKUs: itemised materials ({r.shared.length} shared prices like {r.shared.slice(0, 3).map(s => s.name).join(", ")}) and USA commission / FOB shipping. Added to the matching blanket SKUs.</div>}
        </div>)}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}><button className="btn" onClick={() => setImporting(null)}>Cancel</button><button className="btn-gold" onClick={finishImport}>Import</button></div>
      </div>
    </div>}
  </>);
}

// Labour: a number, or a shared price (e.g. "Blanket labour per roll")
function LabourPick({ T, value, shared, onChange, placeholder = "" }) {
  const inp = inpS(T), isShared = value && typeof value === "object" && value.shared;
  return <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
    {isShared ? <span style={{ fontSize: 11, color: T.gold, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }} title="Shared price">{shared.find(s => s.id === value.shared)?.name || "?"}</span>
      : <input type="number" step="0.01" value={value ?? ""} placeholder={placeholder} onChange={e => onChange(numIn(e.target.value))} style={{ ...inp, width: 64, textAlign: "right" }} />}
    {shared.length > 0 && <select value={isShared ? value.shared : ""} title="Use a shared price" onChange={e => onChange(e.target.value ? { shared: e.target.value, qty: 1 } : null)} style={{ ...inp, width: 18, padding: 0 }}>
      <option value="">{isShared ? "Type a number" : "—"}</option>{shared.map(s => <option key={s.id} value={s.id}>{s.name} ({money(+s.price)})</option>)}</select>}
  </span>;
}

// Itemised materials under a row
function Breakdown({ T, sku, shared, onChange }) {
  const inp = inpS(T), items = sku.items || [];
  const set = (i, patch) => onChange(s => { s.items = (s.items || []).map((x, j) => j === i ? { ...x, ...patch } : x); });
  const total = M.materialsOf(sku, shared);
  return <div>
    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Materials breakdown <span style={{ fontWeight: 400, color: T.tableHeadText }}>— pick a shared price to have it update everywhere it's used</span></div>
    {items.map((it, i) => { const sh = it.shared && shared.find(s => s.id === it.shared); return (
      <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3, fontSize: 12 }}>
        <input value={it.name || ""} onChange={e => set(i, { name: e.target.value })} placeholder="Material" style={{ ...inp, width: 170 }} />
        <span style={{ color: T.tableHeadText }}>qty</span><input type="number" step="0.01" value={it.qty ?? 1} onChange={e => set(i, { qty: numIn(e.target.value) })} style={{ ...inp, width: 56, textAlign: "right" }} />
        <span style={{ color: T.tableHeadText }}>×</span>
        <select value={it.shared || ""} onChange={e => set(i, e.target.value ? { shared: e.target.value, price: undefined } : { shared: undefined, price: sh ? +sh.price : it.price })} style={{ ...inp, width: 150 }}>
          <option value="">Own price</option>{shared.map(s => <option key={s.id} value={s.id}>{s.name} ({money(+s.price)})</option>)}</select>
        {!it.shared && <input type="number" step="0.01" value={it.price ?? ""} onChange={e => set(i, { price: numIn(e.target.value) })} style={{ ...inp, width: 70, textAlign: "right" }} />}
        <span style={{ width: 70, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money((sh ? +sh.price : +it.price || 0) * (it.qty ?? 1))}</span>
        <button className="btn-del" onClick={() => onChange(s => { s.items = s.items.filter((_, j) => j !== i); })}>×</button>
      </div>); })}
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
      <button className="btn" style={{ fontSize: 11 }} onClick={() => onChange(s => { s.items = [...(s.items || []), { name: "", qty: 1, price: items.length ? null : s.materials ?? null }]; })}>＋ Add material</button>
      {items.length > 0 && <>
        <span style={{ fontSize: 12 }}>Total <b>{money(total)}</b></span>
        <button className="btn" style={{ fontSize: 11 }} onClick={() => confirm("Replace the breakdown with its total as one number?") && onChange(s => { s.materials = Math.round(total * 100) / 100; s.items = []; })}>Use one number instead</button>
      </>}
    </div>
  </div>;
}

// ── Overview: every SKU against its target ───────────────────────────────────
function Overview({ T, R, priceOf, book, change, productsCAD, categories, openSku }) {
  const [lineF, setLineF] = useState("All"), [only, setOnly] = useState(false), [q, setQ] = useState(""), [level, setLevel] = useState("price"), [showMissing, setShowMissing] = useState(false);
  const inp = inpS(T);
  const all = useMemo(() => book.lines.flatMap(l => l.skus.map(s => ({ l, s, r: M.computeSku(l, s, { rates: R, shared: book.shared, market: "ca", priceOf, level }) }))), [book, R, priceOf, level]);
  const shown = all.filter(x => (lineF === "All" || x.l.id === lineF) && (!only || M.STATUS[x.r.status].rank < 2) && (!q || `${x.s.sku} ${x.s.desc}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => M.STATUS[a.r.status].rank - M.STATUS[b.r.status].rank || (a.r.margin ?? 999) - (b.r.margin ?? 999));
  const n = st => all.filter(x => x.r.status === st).length;
  const costed = new Set(all.map(x => M.skuKey(x.s.sku)).filter(Boolean));
  const missing = productsCAD.filter(p => p.sku && !costed.has(M.skuKey(p.sku)));
  const withM = all.filter(x => x.r.margin != null), avg = withM.length ? withM.reduce((s, x) => s + x.r.margin, 0) / withM.length : null;
  const kpi = (l, v, sub, c) => <div style={{ ...card(T), padding: "8px 12px", minWidth: 130 }}><div style={{ fontSize: 10, color: T.tableHeadText, textTransform: "uppercase", letterSpacing: ".04em" }}>{l}</div><div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div><div style={{ fontSize: 10, color: T.tableHeadText }}>{sub}</div></div>;
  const td = { padding: "5px 8px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontVariantNumeric: "tabular-nums" };
  const [addTo, setAddTo] = useState({});
  return <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      {kpi("SKUs costed", all.length, `${missing.length} on the price list not costed yet`)}
      {kpi("Losing money", n("loss"), "at this price level", n("loss") ? RED : GREEN)}
      {kpi("Under target", n("under"), "at this price level", n("under") ? RED : GREEN)}
      {kpi("No cost / no price", n("nocost") + n("noprice"), "to fill in", n("nocost") + n("noprice") ? AMBER : GREEN)}
      {kpi("Average net margin", pct(avg), "SKUs with a cost and price")}
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
      <select value={lineF} onChange={e => setLineF(e.target.value)} style={inp}><option value="All">Every product line</option>{book.lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      <select value={level} onChange={e => setLevel(e.target.value)} style={inp}>{M.PRICE_LEVELS.map(([k, v]) => <option key={k} value={k}>Price: {v}</option>)}</select>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search SKU…" style={{ ...inp, width: 180 }} />
      <label style={{ fontSize: 12 }}><input type="checkbox" checked={only} onChange={e => setOnly(e.target.checked)} /> Problems only</label>
      <div style={{ flex: 1 }} />
      <button className="btn" onClick={() => setShowMissing(!showMissing)}>{showMissing ? "Hide" : "Show"} not costed yet ({missing.length})</button>
    </div>
    {showMissing && <div style={{ ...card(T), padding: 10, marginBottom: 12, maxHeight: 280, overflow: "auto" }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>On the price list but not costed yet</div>
      {missing.map(p => <div key={p.sku} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "2px 0" }}>
        <span style={{ fontFamily: "monospace", width: 140 }}>{p.sku}</span><span style={{ flex: 1, color: T.subtext }}>{p.description || p.product}</span>
        <span style={{ fontSize: 10, color: T.tableHeadText }}>{categories[p.sku] || ""}</span>
        <select value={addTo[p.sku] || ""} onChange={e => setAddTo(a => ({ ...a, [p.sku]: e.target.value }))} style={{ ...inp, height: 22, fontSize: 11 }}><option value="">Add to…</option>{book.lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <button className="btn" disabled={!addTo[p.sku]} onClick={() => { const id = M.uid(); change(b => { b.lines.find(l => l.id === addTo[p.sku])?.skus.push({ id, sku: p.sku, desc: p.description || p.product || "" }); }); openSku(addTo[p.sku], id); }}>Add</button>
      </div>)}
      {!missing.length && <div style={{ fontSize: 12, color: GREEN }}>Every product on the price list is costed. 🎉</div>}
    </div>}
    <div style={{ ...card(T), overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", color: T.text }}>
        <thead><tr>{["Product line", "SKU", "Description", "Fully loaded", "Price", "Profit", "Net margin", "Target", "Check"].map((h, i) => <th key={h} style={{ ...td, fontSize: 10, textTransform: "uppercase", color: T.tableHeadText, background: T.tableHead, textAlign: i >= 3 && i <= 7 ? "right" : "left" }}>{h}</th>)}</tr></thead>
        <tbody>{shown.map(({ l, s, r }) => { const st = M.STATUS[r.status]; return <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => openSku(l.id, s.id)} title="Open in Product costs">
          <td style={td}>{l.name}</td><td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{s.sku || "—"}</td><td style={{ ...td, color: T.subtext }}>{s.desc}</td>
          <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{money(r.cost)}</td><td style={{ ...td, textAlign: "right" }}>{money(r.price)}</td>
          <td style={{ ...td, textAlign: "right", color: r.profit < 0 ? RED : undefined }}>{money(r.profit)}</td>
          <td style={{ ...td, textAlign: "right", fontWeight: 700, color: st.color }}>{pct(r.margin)}</td><td style={{ ...td, textAlign: "right" }}>{r.target}%</td>
          <td style={{ ...td, color: st.color }}>{st.label}</td>
        </tr>; })}</tbody>
      </table>
      {!shown.length && <div style={{ padding: 16, fontSize: 12, color: T.tableHeadText }}>{all.length ? "Nothing matches." : "No product costs yet — import Grant's spreadsheet on Product costs."}</div>}
    </div>
  </div>;
}

// ── Overhead & targets (reviewed yearly — Grant; Paul, Mark, Jeff can change) ──
function Settings({ T, R, book, change }) {
  const inp = inpS(T), S = book.settings;
  const set = fn => change(b => fn(b.settings, b));
  const box = { ...card(T), padding: 14, marginBottom: 12 };
  const h = t => <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{t}</div>;
  const note = t => <div style={{ fontSize: 11, color: T.tableHeadText, lineHeight: 1.6, marginBottom: 8 }}>{t}</div>;
  const field = (label, value, onChange, opts = {}) => <label style={{ display: "inline-flex", flexDirection: "column", gap: 2, fontSize: 10, color: T.tableHeadText, marginRight: 12, marginBottom: 6 }}>{label}
    <input type="number" step={opts.step || "any"} value={value ?? ""} placeholder={opts.placeholder || ""} onChange={e => onChange(numIn(e.target.value))} style={{ ...inp, width: opts.w || 110, textAlign: "right" }} /></label>;
  const usedRow = (label, calc, used, onUse, onChange, fmt, unit) => <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12, marginTop: 4 }}>
    <span>Calculated: <b>{calc != null ? fmt(calc) : "—"}</b></span>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><b>{label} used:</b><input type="number" step="any" value={used ?? ""} placeholder={calc != null ? String(Math.round(calc * 100) / 100) : ""} onChange={e => onChange(numIn(e.target.value))} style={{ ...inp, width: 80, textAlign: "right", borderColor: T.gold }} />{unit}</span>
    {calc != null && <button className="btn" style={{ fontSize: 11 }} onClick={onUse}>Use calculated</button>}
  </div>;
  const helper = S.labourHelper || {}, lpr = M.labourPerRoll(helper);
  const usedBy = id => book.lines.reduce((n, l) => n + l.skus.filter(s => (s.items || []).some(it => it.shared === id) || s.labour?.shared === id).length + (l.labour?.shared === id ? l.skus.length : 0), 0);
  return <div style={{ flex: 1, overflow: "auto", padding: 16, maxWidth: 980 }}>
    <div style={box}>
      {h("Company overhead rate — % of materials + labour")}
      {note(<>Used by every product line set to "Company rate". = total G&A ÷ total revenue over the years below (a weighted average, so one odd year doesn't swing it). Owner salaries stay in G&A. Review once a year.</>)}
      <table style={{ borderCollapse: "collapse", fontSize: 12, marginBottom: 6 }}>
        <thead><tr style={{ fontSize: 10, color: T.tableHeadText, textTransform: "uppercase" }}><th style={{ textAlign: "left", padding: 4 }}>Fiscal year</th><th style={{ padding: 4 }}>Revenue</th><th style={{ padding: 4 }}>G&amp;A</th><th style={{ padding: 4 }}>G&amp;A ÷ revenue</th><th></th></tr></thead>
        <tbody>{(S.company.years || []).map(y => <tr key={y.id}>
          <td style={{ padding: 3 }}><input value={y.year ?? ""} onChange={e => set(s => { s.company.years.find(x => x.id === y.id).year = e.target.value; })} style={{ ...inp, width: 70 }} /></td>
          <td style={{ padding: 3 }}><input type="number" value={y.revenue ?? ""} onChange={e => set(s => { s.company.years.find(x => x.id === y.id).revenue = numIn(e.target.value); })} style={{ ...inp, width: 120, textAlign: "right" }} /></td>
          <td style={{ padding: 3 }}><input type="number" value={y.ga ?? ""} onChange={e => set(s => { s.company.years.find(x => x.id === y.id).ga = numIn(e.target.value); })} style={{ ...inp, width: 120, textAlign: "right" }} /></td>
          <td style={{ padding: 3, textAlign: "right" }}>{+y.revenue && y.ga != null ? pct(+y.ga / +y.revenue * 100) : "—"}</td>
          <td><button className="btn-del" onClick={() => set(s => { s.company.years = s.company.years.filter(x => x.id !== y.id); })}>×</button></td>
        </tr>)}</tbody>
      </table>
      <button className="btn" style={{ fontSize: 11 }} onClick={() => set(s => { s.company.years.push({ id: M.uid(), year: "", revenue: null, ga: null }); })}>＋ Add a year</button>
      {usedRow("Rate", R.companyCalc, S.company.rate, () => set(s => { s.company.rate = Math.round(R.companyCalc); }), v => set(s => { s.company.rate = v; }), v => pct(v), "%")}
    </div>

    <div style={box}>
      {h("Brooks fixed overhead — blankets $ per roll, wattles $ per wattle")}
      {note(<>Every blanket (and every wattle) runs on the same machine in the same time, so each carries the same overhead whatever it's made of. = Brooks G&amp;A (facility costs only — <b>not</b> owner salaries, they're in the company rate) × the line's share of the building ÷ the volume you expect to sell. The <b>tipping point</b> is when that year's overhead is fully covered — every roll after it carries none.</>)}
      {field("Brooks G&A for the year ($)", S.brooks.ga, v => set(s => { s.brooks.ga = v; }), { w: 130 })}
      {field("Blanket share of the building (%)", S.brooks.blanketShare, v => set(s => { s.brooks.blanketShare = v; }), { w: 80 })}
      <span style={{ fontSize: 11, color: T.tableHeadText, marginRight: 12 }}>Wattles: {100 - (+S.brooks.blanketShare || 0)}%</span>
      <div style={{ display: "flex", gap: 30, flexWrap: "wrap", marginTop: 6 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Erosion blankets</div>
          {field("Rolls you expect to sell", S.brooks.blanketTarget, v => set(s => { s.brooks.blanketTarget = v; }))}
          {usedRow("Rate", R.blanketCalc, S.brooks.blanketRate, () => set(s => { s.brooks.blanketRate = Math.round(R.blanketCalc * 100) / 100; }), v => set(s => { s.brooks.blanketRate = v; }), v => money(v) + "/roll", "$/roll")}
          <div style={{ fontSize: 12, marginTop: 6 }}>Tipping point: <b>{R.blanketTipping ? Math.ceil(R.blanketTipping).toLocaleString() + " rolls" : "—"}</b></div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Straw wattles</div>
          {field("Wattles you expect to sell", S.brooks.wattleTarget, v => set(s => { s.brooks.wattleTarget = v; }))}
          {usedRow("Rate", R.wattleCalc, S.brooks.wattleRate, () => set(s => { s.brooks.wattleRate = Math.round(R.wattleCalc * 100) / 100; }), v => set(s => { s.brooks.wattleRate = v; }), v => money(v) + "/wattle", "$/wattle")}
          <div style={{ fontSize: 12, marginTop: 6 }}>Tipping point: <b>{R.wattleTipping ? Math.ceil(R.wattleTipping).toLocaleString() + " wattles" : "—"}</b></div>
        </div>
      </div>
    </div>

    <div style={box}>
      {h("Net margin targets")}
      {note("Each product line picks one. Below target shows red; within 5 points shows amber. Exclusive products shouldn't be discounted to win volume; commodity products are the floor.")}
      {M.TIERS.map(([k, v]) => <span key={k}>{field(`${v} (%)`, S.tiers?.[k] ?? R.tiers[k], val => set(s => { s.tiers = { ...(s.tiers || {}), [k]: val }; }), { w: 80 })}</span>)}
      <div>{field("USD exchange rate (CAD per US$1) — for the USA view", S.usdRate, v => set(s => { s.usdRate = v; }), { w: 90, placeholder: "1.38" })}</div>
    </div>

    <div style={box}>
      {h("Shared prices")}
      {note("Material (or labour) prices used by many SKUs — change one here and every SKU using it updates. Pick them in a SKU's materials breakdown (▸) or as its labour.")}
      {(book.shared || []).map(s => <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, fontSize: 12 }}>
        <input value={s.name} onChange={e => change(b => { b.shared.find(x => x.id === s.id).name = e.target.value; })} style={{ ...inp, width: 240 }} />
        $<input type="number" step="0.01" value={s.price ?? ""} onChange={e => change(b => { b.shared.find(x => x.id === s.id).price = numIn(e.target.value); })} style={{ ...inp, width: 80, textAlign: "right" }} />
        <span style={{ fontSize: 11, color: T.tableHeadText, width: 110 }}>used by {usedBy(s.id)} SKU{usedBy(s.id) === 1 ? "" : "s"}</span>
        <button className="btn-del" disabled={usedBy(s.id) > 0} title={usedBy(s.id) ? "Still used — change those SKUs first" : "Remove"} onClick={() => change(b => { b.shared = b.shared.filter(x => x.id !== s.id); })}>×</button>
      </div>)}
      <button className="btn" style={{ fontSize: 11 }} onClick={() => change(b => { b.shared.push({ id: M.uid(), name: "New material", price: null }); })}>＋ Add a shared price</button>
      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 12, paddingTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Blanket labour per roll</div>
        {note("Employees × wage × hours ÷ rolls a day. Save it as a shared price, then set it as \"Labour for all SKUs\" on the blanket line.")}
        {field("Employees", helper.employees, v => set(s => { s.labourHelper = { ...helper, employees: v }; }), { w: 70 })}
        {field("Wage ($/hour)", helper.wage, v => set(s => { s.labourHelper = { ...helper, wage: v }; }), { w: 70 })}
        {field("Hours a day", helper.hours, v => set(s => { s.labourHelper = { ...helper, hours: v }; }), { w: 70 })}
        {field("Rolls a day", helper.rollsPerDay, v => set(s => { s.labourHelper = { ...helper, rollsPerDay: v }; }), { w: 70 })}
        <span style={{ fontSize: 12 }}>= <b>{lpr != null ? money(lpr) : "—"}</b> per roll </span>
        {lpr != null && <button className="btn" style={{ fontSize: 11, marginLeft: 6 }} onClick={() => change(b => { const v = Math.round(lpr * 100) / 100, ex = b.shared.find(x => x.name === "Blanket labour per roll"); if (ex) ex.price = v; else b.shared.push({ id: M.uid(), name: "Blanket labour per roll", price: v }); })}>Save as shared price</button>}
      </div>
    </div>
  </div>;
}

function ChangeLog({ T, log }) {
  const rows = [...log].reverse().slice(0, 500);
  const td = { padding: "5px 8px", borderBottom: `1px solid ${T.border}`, fontSize: 12, verticalAlign: "top" };
  return <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
    <div style={{ ...card(T), overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", color: T.text }}>
        <thead><tr>{["When", "Who", "Where", "What", "From", "To"].map(h => <th key={h} style={{ ...td, fontSize: 10, textTransform: "uppercase", color: T.tableHeadText, background: T.tableHead, textAlign: "left" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((e, i) => <tr key={i}><td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(e.at).toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td><td style={td}>{e.by}</td><td style={td}>{e.where}</td><td style={td}>{e.what}</td><td style={{ ...td, color: T.tableHeadText, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{e.from}</td><td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{e.to}</td></tr>)}</tbody>
      </table>
      {!rows.length && <div style={{ padding: 16, fontSize: 12, color: T.tableHeadText }}>No changes saved yet.</div>}
    </div>
  </div>;
}
