// ─── Cost Calculator (left-hand area; "Costs & margins" people only) ─────────
// One calculator per product type (e.g. Turbidity Curtains › Type 2 DOT) with a column per size/SKU,
// like the Excel calculators. Edit, then Save: the totals become the hub's product costs (Canada),
// and every change goes in the change log. Everything is locked with the cost key.
import { Fragment, useEffect, useMemo, useState } from "react";
import { SECTIONS, compute, costsFromBook, describeCell, newCalc, rateValues, uid, RATE_LABELS } from "./model";
import { importWorkbook } from "./importXlsx";
import { PRICE_FIELDS, FIELD_LABEL, up } from "../pricelist/priceLists";

const GREEN = "#34c77b", RED = "#e8472c", AMBER = "#e8a23a";
const clone = o => JSON.parse(JSON.stringify(o));
const money = v => v == null || !isFinite(v) ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const skuKey = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^BMP(?=[A-Z])/, "");
const BASIS = [["$", "$"], ["pctPrice", "% of price"], ["pctCost", "% of materials + labour"]];
const MARKET = [["both", "Canada & USA"], ["ca", "Canada only"], ["us", "USA only"]];

export default function CostCalculator({ T, book: stored, saveBook, costs, loginName, productsCAD = [], productsUSD = [], hubUsdRate, focusSku, onFocusDone }) {
  const [book, setBook] = useState(() => clone(stored.book));
  const [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState(() => stored.book.calcs[0]?.id || "start");
  const [market, setMarket] = useState("ca");
  const [busy, setBusy] = useState("");
  const [linkEdit, setLinkEdit] = useState(null); // { lineId, colId }
  const [hiCol, setHiCol] = useState(null);
  // Someone else saved while we have no unsaved changes → take their version
  useEffect(() => { if (!dirty) setBook(clone(stored.book)); }, [stored.book]); // eslint-disable-line
  useEffect(() => {
    const warn = e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  // Opened from a product page: jump to that SKU's calculator and column
  useEffect(() => {
    if (!focusSku) return;
    const k = skuKey(focusSku);
    const c = book.calcs.find(c => c.columns.some(col => skuKey(col.sku) === k));
    if (c) { setSel(c.id); setHiCol(c.columns.find(col => skuKey(col.sku) === k).id); }
    onFocusDone?.();
  }, [focusSku]); // eslint-disable-line

  const rates = useMemo(() => ({ ...book.rates, usdRate: book.rates?.usdRate || hubUsdRate || 1.38 }), [book.rates, hubUsdRate]);
  const R = rateValues(rates);
  const findProduct = (list, sku) => { const k = skuKey(sku); return list.find(p => skuKey(p.sku) === k); };
  const calc = book.calcs.find(c => c.id === sel);
  const priceOf = (sku, mkt, field = calc?.priceField || "price") => {
    const p = findProduct(mkt === "us" ? productsUSD : productsCAD, sku);
    const v = p ? parseFloat(String(p[field] ?? "").replace(/[^0-9.\-]/g, "")) : NaN;
    return isNaN(v) || !v ? null : mkt === "us" ? v * R.usdRate : v;
  };
  const results = calc ? compute(calc, rates, market, (s, m) => priceOf(s, m)) : {};

  // ── editing helpers ──
  const change = fn => { setBook(b => { const n = clone(b); fn(n); return n; }); setDirty(true); };
  const editCalc = fn => change(n => { const c = n.calcs.find(x => x.id === sel); if (c) fn(c, n); });
  const setCell = (lineId, colId, v) => editCalc(c => { const l = c.lines.find(x => x.id === lineId); if (v === "" || v == null) delete l.values[colId]; else l.values[colId] = v; });
  const families = [...new Set(book.calcs.map(c => c.family))];

  // ── save: change log + product costs ──
  const save = async () => {
    setBusy("Saving…");
    try {
      const before = stored.book, log = [...(book.log || [])], at = new Date().toISOString();
      const add = (calcName, what, from, to) => log.push({ at, by: loginName, calc: calcName, what, from, to });
      const oldById = new Map(before.calcs.map(c => [c.id, c]));
      book.calcs.forEach(c => {
        const o = oldById.get(c.id);
        if (!o) { add(`${c.family} › ${c.name}`, "Calculator added", "", ""); return; }
        const title = `${c.family} › ${c.name}`;
        c.lines.forEach(l => {
          const ol = o.lines.find(x => x.id === l.id);
          if (!ol) { add(title, `Line added: ${l.name}`, "", ""); return; }
          if (ol.name !== l.name) add(title, "Line renamed", ol.name, l.name);
          if (ol.basis !== l.basis) add(title, `${l.name}: type`, ol.basis, l.basis);
          c.columns.forEach(col => {
            const a = describeCell(o, ol.values[col.id]), b = describeCell(c, l.values[col.id]);
            if (a !== b) add(title, `${l.name} · ${col.sku || col.label}`, a, b);
          });
        });
        o.lines.filter(ol => !c.lines.some(l => l.id === ol.id)).forEach(ol => add(title, `Line removed: ${ol.name}`, "", ""));
        c.columns.filter(col => !o.columns.some(x => x.id === col.id)).forEach(col => add(title, `Size added: ${col.label}`, "", col.sku || ""));
        o.columns.filter(col => !c.columns.some(x => x.id === col.id)).forEach(col => add(title, `Size removed: ${col.label}`, col.sku || "", ""));
        c.columns.forEach(col => { const x = o.columns.find(y => y.id === col.id); if (x && x.sku !== col.sku) add(title, `SKU for ${col.label}`, x.sku, col.sku); });
      });
      before.calcs.filter(o => !book.calcs.some(c => c.id === o.id)).forEach(o => add(`${o.family} › ${o.name}`, "Calculator deleted", "", ""));
      if (JSON.stringify(before.rates) !== JSON.stringify(book.rates)) add("Shared rates", "Rates changed", "", "");
      const next = { ...book, log };
      await saveBook(next, loginName);
      // Totals → product costs (Canada), so margins everywhere use them
      const fromCalc = costsFromBook({ ...next, rates }, (s, m) => priceOf(s, m, "price"));
      const map = { ...(costs.costs || {}) };
      const k2 = new Map(productsCAD.map(p => [skuKey(p.sku), p.sku]));
      Object.entries(fromCalc).forEach(([sku, v]) => { const real = k2.get(skuKey(sku)) || sku; map[up(real)] = { ...v, at, by: loginName }; });
      await costs.save(map, loginName);
      setBook(next); setDirty(false); setBusy("Saved ✓"); setTimeout(() => setBusy(""), 2000);
    } catch (e) { setBusy(""); alert("Couldn't save: " + e.message); }
  };

  const doImport = async files => {
    setBusy("Reading the Excel files…");
    try {
      const results = [];
      const csv = files.filter(f => /\.csv$/i.test(f.name));
      if (csv.length) { setBusy(""); return alert("Please pick the Excel files (.xlsx) — a .csv only holds one tab, so the other types would be missing. Each Excel file has all its types (every curtain type, every blanket) and they all load at once."); }
      for (const f of files) results.push(await importWorkbook(await f.arrayBuffer(), f.name));
      const n = results.reduce((s, r) => s + r.calcs.length, 0);
      change(b => {
        results.forEach(r => {
          r.calcs.forEach(c => { b.calcs = b.calcs.filter(x => !(x.family === c.family && x.name === c.name)); b.calcs.push(c); });
          if (r.blanket) b.rates.blanket = { ...b.rates.blanket, ...r.blanket };
          if (r.usdRate) b.rates.usdRate = r.usdRate;
        });
        b.log = [...(b.log || []), { at: new Date().toISOString(), by: loginName, calc: "Import", what: `Imported ${files.map(f => f.name).join(", ")}`, from: "", to: "" }];
      });
      const first = results.flatMap(r => r.calcs)[0];
      if (first) setSel(first.id);
      setBusy(`Imported ${n} calculator${n === 1 ? "" : "s"} — check them, then click Save.`);
    } catch (e) { setBusy(""); alert("Couldn't read that file: " + e.message); }
  };

  const card = { background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3 };
  const inp = { height: 26, fontSize: 12, padding: "0 6px", background: T.inputBg || T.cardBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 2 };
  const ImportButton = ({ big }) => (
    <label className={big ? "btn-gold" : "btn"} style={{ cursor: "pointer", ...(big ? { padding: "8px 16px", fontSize: 12, display: "inline-block" } : {}) }}>
      ⬆ Import from Excel
      <input type="file" accept=".xlsx,.xls,.csv" multiple style={{ display: "none" }} onChange={e => { const f = [...e.target.files]; e.target.value = ""; if (f.length) doImport(f); }} />
    </label>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      {/* Left: calculators by family */}
      <div style={{ width: 230, flexShrink: 0, borderRight: `1px solid ${T.border}`, overflowY: "auto", padding: "12px 0", background: T.sidebarBg || T.cardBg }}>
        {families.map(f => (
          <div key={f} style={{ marginBottom: 10 }}>
            <div style={{ padding: "0 14px 4px", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: T.gold }}>{f}</div>
            {book.calcs.filter(c => c.family === f).map(c => (
              <button key={c.id} onClick={() => { setSel(c.id); setHiCol(null); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 14px 6px 20px", border: "none", borderLeft: `2px solid ${sel === c.id ? T.gold : "transparent"}`, background: sel === c.id ? T.activeBg : "transparent", color: sel === c.id ? T.text : T.subtext, fontSize: 12, cursor: "pointer" }}>{c.name}</button>
            ))}
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${T.border}`, margin: "6px 0", paddingTop: 6 }}>
          {[["start", "⬆ Import from Excel"], ["rates", "⚙ Shared rates"], ["log", "🕘 Change log"]].map(([k, l]) => (
            <button key={k} onClick={() => setSel(k)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 14px", border: "none", borderLeft: `2px solid ${sel === k ? T.gold : "transparent"}`, background: sel === k ? T.activeBg : "transparent", color: sel === k ? T.text : T.subtext, fontSize: 12, cursor: "pointer" }}>{l}</button>
          ))}
          <button onClick={() => {
            const family = prompt("Product family (e.g. Turbidity Curtains):", calc?.family || ""); if (!family) return;
            const name = prompt("Calculator name (e.g. Type 2 DOT):"); if (!name) return;
            const c = newCalc(family.trim(), name.trim()); change(b => b.calcs.push(c)); setSel(c.id);
          }} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 14px", border: "none", background: "transparent", color: T.subtext, fontSize: 12, cursor: "pointer" }}>＋ New calculator</button>
        </div>
      </div>

      {/* Right */}
      <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {calc ? <>
            <input value={calc.family} onChange={e => editCalc(c => { c.family = e.target.value; })} style={{ ...inp, width: 190, fontWeight: 600 }} title="Product family" />
            <span style={{ color: T.tableHeadText }}>›</span>
            <input value={calc.name} onChange={e => editCalc(c => { c.name = e.target.value; })} style={{ ...inp, width: 190, fontWeight: 600 }} title="Calculator name" />
            <div style={{ display: "inline-flex", border: `1px solid ${T.border}`, borderRadius: 2, marginLeft: 8 }}>
              {[["ca", "🇨🇦 Canada"], ["us", "🇺🇸 USA"]].map(([k, l]) => <button key={k} onClick={() => setMarket(k)} style={{ border: "none", padding: "4px 10px", fontSize: 11, cursor: "pointer", background: market === k ? T.gold : "transparent", color: market === k ? "#111" : T.subtext }}>{l}</button>)}
            </div>
            <label style={{ fontSize: 11, color: T.subtext }}>Price: <select value={calc.priceField || "price"} onChange={e => editCalc(c => { c.priceField = e.target.value; })} style={{ ...inp, height: 26 }}>{PRICE_FIELDS.map(f => <option key={f} value={f}>{FIELD_LABEL[f]}</option>)}</select></label>
          </> : <div style={{ fontSize: 15, fontWeight: 600 }}>{sel === "rates" ? "Shared rates" : sel === "log" ? "Change log" : "Cost Calculator"}</div>}
          <div style={{ flex: 1 }} />
          <ImportButton />
          {dirty && <button className="btn" onClick={() => { if (confirm("Undo all changes since the last save?")) { setBook(clone(stored.book)); setDirty(false); } }}>Undo changes</button>}
          <button className="btn-gold" style={{ padding: "6px 16px", fontSize: 11, opacity: dirty ? 1 : .5 }} disabled={!dirty || busy === "Saving…"} onClick={save}>{dirty ? "Save changes" : "Saved"}</button>
        </div>

        {busy && <div style={{ fontSize: 12, color: T.gold, fontWeight: 600, margin: "-4px 0 10px" }}>{busy}</div>}
        {(!book.calcs.length || sel === "start") && sel !== "rates" && sel !== "log" && (
          <div style={{ ...card, padding: 20, maxWidth: 680 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{book.calcs.length ? "Import from Excel" : "Set up the Cost Calculator"}</div>
            {book.calcs.length > 0 && <div style={{ fontSize: 12, color: AMBER, marginBottom: 8 }}>A type that's already here with the same name (e.g. Turbidity Curtains › Type 2 DOT) is replaced by the one in the file.</div>}
            <div style={{ fontSize: 12, color: T.subtext, lineHeight: 1.6, marginBottom: 14 }}>
              Click below and pick your Excel cost calculators (.xlsx) — select all four at once (Turbidity Curtains, Erosion Control Blankets, Donuts, Dewatering Bags).
              <b>You don't need to create anything first:</b> every standard type in each file (all the curtain types, all the blankets…) is built automatically, with the same lines and numbers; custom one-offs are left out.
              Nothing is saved until you check them and click <b>Save changes</b>.
            </div>
            <ImportButton big />
          </div>
        )}

        {sel === "rates" && <RatesView T={T} rates={book.rates} R={R} hubUsdRate={hubUsdRate} onChange={fn => change(b => fn(b.rates))} inp={inp} card={card} />}
        {sel === "log" && <LogView T={T} log={book.log || []} card={card} />}

        {calc && (
          <>
            <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 8, lineHeight: 1.5 }}>
              Type costs per {/blanket/i.test(calc.family) ? "roll" : /curtain|boom/i.test(calc.family) ? "50 ft section" : "unit"}. <b>⇉</b> copies the first size's value to every size. <b>↪</b> links a cell to another cell (or a shared rate) — it updates when that one changes.
              Prices come from the current price list{market === "us" ? ` (USA price list × ${R.usdRate.toFixed(4)} = CAD)` : ""}; type one only for sizes that aren't on it.
              Margin = profit ÷ price{market === "ca" ? "; the Canada total becomes the product cost when you save" : ""}.
            </div>
            <div style={{ ...card, overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, color: T.text, minWidth: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", left: 0, zIndex: 2, background: T.tableHead, padding: "6px 8px", textAlign: "left", minWidth: 240 }}>Cost line</th>
                    {calc.columns.map(col => {
                      const onList = col.sku && findProduct(productsCAD, col.sku);
                      return (
                        <th key={col.id} style={{ background: hiCol === col.id ? "rgba(200,169,110,.25)" : T.tableHead, padding: "6px 6px", minWidth: 118, verticalAlign: "top" }}>
                          <input value={col.label} onChange={e => editCalc(c => { c.columns.find(x => x.id === col.id).label = e.target.value; })} style={{ ...inp, width: 108, fontWeight: 600 }} />
                          <div style={{ display: "flex", gap: 3, marginTop: 3, alignItems: "center" }}>
                            <input list="cc-skus" value={col.sku || ""} placeholder="SKU" onChange={e => editCalc(c => { c.columns.find(x => x.id === col.id).sku = e.target.value.trim().toUpperCase(); })} style={{ ...inp, width: 86, fontSize: 10, fontFamily: "monospace", borderColor: col.sku ? (onList ? GREEN : AMBER) : T.border }} title={col.sku ? (onList ? "On the Products list" : "Not on the Products list") : "Which SKU this size is"} />
                            <button title="Remove this size" onClick={() => { if (confirm(`Remove ${col.label}?`)) editCalc(c => { c.columns = c.columns.filter(x => x.id !== col.id); c.lines.forEach(l => delete l.values[col.id]); }); }} style={{ border: "none", background: "transparent", color: T.tableHeadText, cursor: "pointer", fontSize: 12 }}>×</button>
                          </div>
                        </th>
                      );
                    })}
                    <th style={{ background: T.tableHead, padding: 6 }}>
                      <button className="btn" style={{ fontSize: 10, padding: "3px 8px", whiteSpace: "nowrap" }} onClick={() => editCalc(c => {
                        const last = c.columns[c.columns.length - 1], id = uid();
                        c.columns.push({ id, label: "New size", sku: "" });
                        if (last) c.lines.forEach(l => { if (l.values[last.id] != null) l.values[id] = clone(l.values[last.id]); });
                      })}>＋ Size</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SECTIONS.map(([sec, secLabel]) => {
                    const lines = calc.lines.filter(l => l.section === sec && (sec !== "other" || !l.market || l.market === "both" || l.market === market));
                    const totalRow = sec === "materials" ? ["Total materials", "materials"] : sec === "labour" ? ["Total labour", "labour"] : ["Total overhead & other", "other"];
                    return (
                      <Fragment key={sec}>
                        <tr><td colSpan={calc.columns.length + 2} style={{ background: T.border, padding: "5px 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>
                          {secLabel}
                          <button className="btn" style={{ marginLeft: 10, fontSize: 10, padding: "1px 8px", textTransform: "none", letterSpacing: 0 }} onClick={() => editCalc(c => { c.lines.push({ id: uid(), section: sec, name: "New line", basis: "$", market: sec === "other" ? market : "both", values: {} }); })}>＋ Add line</button>
                        </td></tr>
                        {lines.map(l => (
                          <tr key={l.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={{ position: "sticky", left: 0, background: T.cardBg, padding: "3px 8px", zIndex: 1 }}>
                              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <input value={l.name} onChange={e => editCalc(c => { c.lines.find(x => x.id === l.id).name = e.target.value; })} style={{ ...inp, flex: 1, minWidth: 110 }} />
                                <button title="Copy the first size's value to every size" onClick={() => editCalc(c => { const ln = c.lines.find(x => x.id === l.id), v = ln.values[c.columns[0]?.id]; c.columns.slice(1).forEach(col => { if (v == null) delete ln.values[col.id]; else ln.values[col.id] = clone(v); }); })} style={{ border: "none", background: "transparent", color: T.subtext, cursor: "pointer" }}>⇉</button>
                                <button title="Remove this line" onClick={() => { if (confirm(`Remove "${l.name}"?`)) editCalc(c => { c.lines = c.lines.filter(x => x.id !== l.id); }); }} style={{ border: "none", background: "transparent", color: T.tableHeadText, cursor: "pointer" }}>×</button>
                              </div>
                              {sec === "other" && <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                                <select value={l.basis || "$"} onChange={e => editCalc(c => { c.lines.find(x => x.id === l.id).basis = e.target.value; })} style={{ ...inp, height: 22, fontSize: 10 }}>{BASIS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                                <select value={l.market || "both"} onChange={e => editCalc(c => { c.lines.find(x => x.id === l.id).market = e.target.value; })} style={{ ...inp, height: 22, fontSize: 10 }}>{MARKET.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                              </div>}
                            </td>
                            {calc.columns.map(col => {
                              const cell = l.values[col.id], linked = cell && typeof cell === "object" && (cell.link || cell.rate), fixed = cell && cell.fixed != null;
                              const val = results[col.id]?.cells?.[l.id];
                              const pct = l.basis !== "$" && !fixed;
                              return (
                                <td key={col.id} style={{ padding: "3px 4px", background: hiCol === col.id ? "rgba(200,169,110,.08)" : undefined, verticalAlign: "top" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                    {linked
                                      ? <button title={describeCell(calc, cell)} onClick={() => setLinkEdit({ lineId: l.id, colId: col.id })} style={{ ...inp, width: 92, textAlign: "right", fontStyle: "italic", color: T.accent || T.gold, cursor: "pointer", background: "transparent" }}>↪ {money(val)}</button>
                                      : <input type="number" step="any" value={fixed ? cell.fixed : typeof cell === "number" ? cell : ""} placeholder={pct ? "%" : "0"}
                                          onChange={e => { const v = e.target.value; setCell(l.id, col.id, v === "" ? "" : pct || l.basis === "$" ? parseFloat(v) : { fixed: parseFloat(v) }); }}
                                          style={{ ...inp, width: 92, textAlign: "right" }} />}
                                    <button title="Link to another cell or a shared rate" onClick={() => setLinkEdit({ lineId: l.id, colId: col.id })} style={{ border: "none", background: "transparent", color: T.tableHeadText, cursor: "pointer", fontSize: 11, padding: 0 }}>↪</button>
                                  </div>
                                  {pct && typeof cell === "number" && <div style={{ fontSize: 9, color: T.tableHeadText, textAlign: "right", paddingRight: 14 }}>{cell}% = {money(val)}</div>}
                                </td>
                              );
                            })}
                            <td />
                          </tr>
                        ))}
                        <tr style={{ background: T.tableHead }}>
                          <td style={{ position: "sticky", left: 0, background: T.tableHead, padding: "4px 8px", fontWeight: 600 }}>{totalRow[0]}</td>
                          {calc.columns.map(col => <td key={col.id} style={{ padding: "4px 18px 4px 4px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{money(results[col.id]?.[totalRow[1]])}</td>)}
                          <td />
                        </tr>
                        {sec === "labour" && <tr><td style={{ position: "sticky", left: 0, background: T.cardBg, padding: "4px 8px", color: T.subtext }}>Materials + labour</td>{calc.columns.map(col => <td key={col.id} style={{ padding: "4px 18px 4px 4px", textAlign: "right", color: T.subtext, fontVariantNumeric: "tabular-nums" }}>{money(results[col.id]?.base)}</td>)}<td /></tr>}
                      </Fragment>
                    );
                  })}
                  {/* Results */}
                  {[
                    ["TOTAL COST", r => money(r.total), { fontWeight: 700, fontSize: 13 }],
                    ["Price", null, {}],
                    ["Profit", r => <span style={{ color: r.profit == null ? undefined : r.profit >= 0 ? GREEN : RED }}>{money(r.profit)}</span>, { fontWeight: 600 }],
                    ["Margin", r => r.margin == null ? "—" : <span><b style={{ color: r.margin >= 30 ? GREEN : r.margin >= 15 ? AMBER : RED }}>{r.margin.toFixed(1)}%</b><span style={{ fontSize: 9, color: T.tableHeadText }}> · markup {r.markup.toFixed(0)}%</span></span>, {}],
                  ].map(([label, fn, st]) => (
                    <tr key={label} style={{ borderTop: `1px solid ${T.border}`, ...(label === "TOTAL COST" ? { background: "rgba(200,169,110,.15)" } : {}) }}>
                      <td style={{ position: "sticky", left: 0, background: label === "TOTAL COST" ? T.tableHead : T.cardBg, padding: "6px 8px", ...st }}>{label}{label === "Price" && <span style={{ fontSize: 9, color: T.tableHeadText }}> ({FIELD_LABEL[calc.priceField || "price"]}{market === "us" ? ", USD → CAD" : ""})</span>}</td>
                      {calc.columns.map(col => {
                        const r = results[col.id] || {};
                        if (label !== "Price") return <td key={col.id} style={{ padding: "6px 18px 6px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums", ...st }}>{fn(r)}</td>;
                        return <td key={col.id} style={{ padding: "4px 4px", textAlign: "right" }}>
                          {r.listed ? <span title="From the current price list" style={{ fontVariantNumeric: "tabular-nums" }}>{money(r.price)}</span>
                            : <span title={`Not on the price list — type a ${market === "us" ? "USD" : "CAD"} price`}><input type="number" step="any" placeholder={market === "us" ? "US$" : "$"} value={calc.manualPrice?.[market]?.[col.id] ?? ""} onChange={e => editCalc(c => { c.manualPrice = c.manualPrice || { ca: {}, us: {} }; c.manualPrice[market] = c.manualPrice[market] || {}; if (e.target.value === "") delete c.manualPrice[market][col.id]; else c.manualPrice[market][col.id] = parseFloat(e.target.value); })} style={{ ...inp, width: 92, textAlign: "right", borderColor: AMBER }} /></span>}
                        </td>;
                      })}
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="cc-skus">{productsCAD.map(p => <option key={p.sku} value={p.sku}>{p.product}</option>)}</datalist>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button className="btn-del" onClick={() => { if (confirm(`Delete the ${calc.name} calculator? (Product costs it already set stay until you change them.)`)) { change(b => { b.calcs = b.calcs.filter(c => c.id !== calc.id); }); setSel(book.calcs.find(c => c.id !== calc.id)?.id || "rates"); } }}>Delete this calculator</button>
            </div>
          </>
        )}
      </div>
      {linkEdit && calc && <LinkModal T={T} calc={calc} R={R} target={linkEdit} inp={inp} onClose={() => setLinkEdit(null)} onSet={v => { setCell(linkEdit.lineId, linkEdit.colId, v); setLinkEdit(null); }} />}
    </div>
  );
}

// ↪ Link a cell to another cell in this calculator, or to a shared rate
function LinkModal({ T, calc, R, target, inp, onClose, onSet }) {
  const cur = calc.lines.find(l => l.id === target.lineId)?.values?.[target.colId];
  const [kind, setKind] = useState(cur?.rate ? "rate" : "link");
  const [col, setCol] = useState(cur?.link?.col || calc.columns.find(c => c.id !== target.colId)?.id || calc.columns[0]?.id);
  const [line, setLine] = useState(cur?.link?.line || target.lineId);
  const [rate, setRate] = useState(cur?.rate || "blanketLabour");
  const [factor, setFactor] = useState(cur?.factor ?? 1);
  const rateKeys = Object.keys(R).filter(k => k !== "usdRate");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Link this cell</div>
        <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 12 }}>
          <label><input type="radio" checked={kind === "link"} onChange={() => setKind("link")} /> Another cell</label>
          <label><input type="radio" checked={kind === "rate"} onChange={() => setKind("rate")} /> A shared rate</label>
        </div>
        {kind === "link" ? <>
          <label style={{ display: "block", fontSize: 11, color: T.subtext, marginBottom: 6 }}>Line<select value={line} onChange={e => setLine(e.target.value)} style={{ ...inp, display: "block", width: "100%" }}>{calc.lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label style={{ display: "block", fontSize: 11, color: T.subtext, marginBottom: 6 }}>Size<select value={col} onChange={e => setCol(e.target.value)} style={{ ...inp, display: "block", width: "100%" }}>{calc.columns.map(c => <option key={c.id} value={c.id}>{c.label}{c.sku ? ` (${c.sku})` : ""}</option>)}</select></label>
        </> : <label style={{ display: "block", fontSize: 11, color: T.subtext, marginBottom: 6 }}>Rate<select value={rate} onChange={e => setRate(e.target.value)} style={{ ...inp, display: "block", width: "100%" }}>{rateKeys.map(k => <option key={k} value={k}>{RATE_LABELS[k] || k} — ${R[k].toFixed(4)}</option>)}</select></label>}
        <label style={{ display: "block", fontSize: 11, color: T.subtext, marginBottom: 12 }}>× factor (e.g. 0.7 for 70%, 0.5 for half)<input type="number" step="any" value={factor} onChange={e => setFactor(e.target.value)} style={{ ...inp, display: "block", width: 120 }} /></label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {cur && typeof cur === "object" && (cur.link || cur.rate) && <button className="btn" onClick={() => onSet("")}>Remove link</button>}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-gold" onClick={() => {
            const f = parseFloat(factor); const k = isNaN(f) ? 1 : f;
            if (kind === "link") { if (col === target.colId && line === target.lineId) return alert("A cell can't link to itself."); onSet({ link: { col, line }, factor: k }); }
            else onSet({ rate, factor: k });
          }}>Link</button>
        </div>
      </div>
    </div>
  );
}

function RatesView({ T, rates, R, hubUsdRate, onChange, inp, card }) {
  const b = rates.blanket || {};
  const field = (label, val, set, hint) => <label style={{ display: "block", fontSize: 12, color: T.subtext, marginBottom: 8 }}>{label}<input type="number" step="any" value={val ?? ""} onChange={e => set(e.target.value === "" ? 0 : parseFloat(e.target.value))} style={{ ...inp, width: 110, marginLeft: 8 }} />{hint && <span style={{ fontSize: 10, color: T.tableHeadText, marginLeft: 8 }}>{hint}</span>}</label>;
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ ...card, padding: 16, minWidth: 340 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Blanket production (labour & overhead per roll)</div>
        {field("Rolls per day", b.rollsPerDay, v => onChange(r => { r.blanket.rollsPerDay = v; }))}
        {field("Employees working per day", b.employees, v => onChange(r => { r.blanket.employees = v; }))}
        {field("Wage per hour ($)", b.wage, v => onChange(r => { r.blanket.wage = v; }))}
        {field("Hours per day", b.hours, v => onChange(r => { r.blanket.hours = v; }))}
        <div style={{ fontSize: 12, margin: "10px 0", padding: 8, background: T.tableHead }}>
          Labour per roll = employees × wage × hours ÷ rolls = <b>${R.blanketLabour.toFixed(4)}</b><br />
          Overhead per roll (table below, at {b.rollsPerDay || 0} rolls/day) = <b>${R.blanketOverhead.toFixed(2)}</b>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Overhead table — rolls per day → overhead per roll</div>
        {(b.overhead || []).map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
            <input type="number" value={row[0]} onChange={e => onChange(r => { r.blanket.overhead[i][0] = parseFloat(e.target.value) || 0; })} style={{ ...inp, width: 80 }} />
            <input type="number" step="any" value={row[1]} onChange={e => onChange(r => { r.blanket.overhead[i][1] = parseFloat(e.target.value) || 0; })} style={{ ...inp, width: 80 }} />
            <button className="btn-del" style={{ padding: "0 6px" }} onClick={() => onChange(r => { r.blanket.overhead.splice(i, 1); })}>×</button>
          </div>
        ))}
        <button className="btn" style={{ fontSize: 10, marginTop: 4 }} onClick={() => onChange(r => { r.blanket.overhead = [...(r.blanket.overhead || []), [0, 0]]; })}>＋ Row</button>
      </div>
      <div style={{ ...card, padding: 16, minWidth: 300 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Other rates</div>
        {field("USD rate (CAD per US$1)", rates.usdRate, v => onChange(r => { r.usdRate = v; }), hubUsdRate ? `hub setting: ${hubUsdRate.toFixed(4)}` : "")}
        <div style={{ fontSize: 11, fontWeight: 600, margin: "10px 0 4px" }}>Your own rates (link cells to them with ↪)</div>
        {(rates.custom || []).map((c, i) => (
          <div key={c.id} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
            <input value={c.name} onChange={e => onChange(r => { r.custom[i].name = e.target.value; })} style={{ ...inp, width: 160 }} />
            <input type="number" step="any" value={c.value} onChange={e => onChange(r => { r.custom[i].value = parseFloat(e.target.value) || 0; })} style={{ ...inp, width: 90 }} />
            <button className="btn-del" style={{ padding: "0 6px" }} onClick={() => onChange(r => { r.custom.splice(i, 1); })}>×</button>
          </div>
        ))}
        <button className="btn" style={{ fontSize: 10, marginTop: 4 }} onClick={() => onChange(r => { r.custom = [...(r.custom || []), { id: "r" + uid(), name: "New rate", value: 0 }]; })}>＋ Rate</button>
      </div>
    </div>
  );
}

function LogView({ T, log, card }) {
  const rows = [...log].reverse();
  return (
    <div style={{ ...card, overflowX: "auto" }}>
      {!rows.length ? <div style={{ padding: 14, fontSize: 12, color: T.tableHeadText }}>No changes yet.</div> : (
        <table className="data-table">
          <thead><tr><th>When</th><th>Who</th><th>Calculator</th><th>What</th><th>From</th><th>To</th></tr></thead>
          <tbody>{rows.slice(0, 400).map((e, i) => <tr key={i}><td style={{ whiteSpace: "nowrap" }}>{new Date(e.at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}</td><td>{e.by}</td><td>{e.calc}</td><td>{e.what}</td><td style={{ color: T.subtext }}>{e.from}</td><td>{e.to}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}
