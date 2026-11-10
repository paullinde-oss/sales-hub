// ─── Product page: everything the hub knows about one SKU (information only) ─
// Opened from the SKU pop-up ("Open product page"). Name, description and photo come from the
// website (bmpsupplies.com); prices from the current price list; packaging and dimensions from DIMS;
// stock from the stock sheets; sales from order confirmations; quotes from the Quote Maker; and, for
// "Costs & margins" people, the cost (Cost Calculator) and margins.
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useProductPages, previewFor, skuKey } from "./webPages";
import { PRICE_FIELDS, FIELD_LABEL } from "../pricelist/priceLists";
import { costOf, marginPct } from "../pricelist/costs";
import { listenOrders } from "../sales/orderStore";
import { DEFAULT_ACCOUNTS } from "../sales/accounts";
import { enrichOrders, orderCurrency, fyOf, fyStart, today, fmtDate, fmtMoney } from "../sales/salesUtils";

let opener = null;
export const setProductPageOpener = f => { opener = f; };
export const openProductPage = sku => { if (opener && sku) opener(sku); };

const num = v => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) || !n ? null : n; };
const money = v => v == null ? "—" : "$" + v.toLocaleString(undefined, { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });

export function ProductPageHost(props) {
  const [sku, setSku] = useState(null);
  useEffect(() => { setProductPageOpener(setSku); return () => setProductPageOpener(null); }, []);
  useEffect(() => { if (!sku) return; const k = e => e.key === "Escape" && setSku(null); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [sku]);
  if (!sku) return null;
  return <ProductPage {...props} sku={sku} onClose={() => setSku(null)} />;
}

function ProductPage({ T, db, sku, onClose, productsCAD = [], productsUSD = [], categories = {}, quotes = [], extras, user, loginName, usdToCad = 1.37, canCosts, costs, onCostCalc }) {
  const data = useProductPages();
  const k = skuKey(sku);
  const product = productsCAD.find(p => skuKey(p.sku) === k) || null;
  const usd = productsUSD.find(p => skuKey(p.sku) === k) || null;
  const p = previewFor(sku, data, product);
  const realSku = product?.sku || sku;
  const [more, setMore] = useState(null);
  useEffect(() => { let ok = true; setMore(null); extras?.(realSku).then(m => ok && setMore(m)).catch(() => ok && setMore({})); return () => { ok = false; }; }, [realSku]); // eslint-disable-line
  // Orders (the hub's browser copy — only changes are read) and the settings that standardise SKUs
  const [raw, setRaw] = useState(null), [settings, setSettings] = useState(null);
  useEffect(() => listenOrders(db, all => setRaw(all), () => setRaw([])), [db]);
  useEffect(() => onSnapshot(doc(db, "config", "salesSettings"), s => setSettings(s.exists() ? s.data() : {}), () => setSettings({})), [db]);
  const ownOnly = user?.salesScope === "own";

  const sales = useMemo(() => {
    if (!raw || !settings) return null;
    const orders = enrichOrders(raw, { accounts: DEFAULT_ACCOUNTS, aliases: {}, custTypes: {}, ...settings }, productsCAD).filter(o => !ownOnly || o.cust?.rep === loginName);
    const fy = fyOf(today()), from = fyStart(fy), prevFrom = fyStart(fy - 1);
    const t = today(), prevTo = `${+t.slice(0, 4) - 1}${t.slice(4)}`;
    const blank = () => ({ qty: 0, amt: 0, orders: new Set(), custs: new Map() });
    const cur = blank(), prev = blank(), prevSame = blank();
    let last = null;
    orders.forEach(o => (o.lines || []).forEach(l => {
      if (skuKey(l.sku) !== k) return;
      const amt = (l.amount || 0) * (orderCurrency(o) === "USD" ? usdToCad : 1);
      const into = g => { g.qty += l.qty || 0; g.amt += amt; g.orders.add(o.orderNo); const n = o.cust?.name || o.customer; g.custs.set(n, (g.custs.get(n) || 0) + amt); };
      if (o.date >= from) into(cur);
      else if (o.date >= prevFrom) { into(prev); if (o.date <= prevTo) into(prevSame); }
      if (!last || o.date > last.date) last = { date: o.date, orderNo: o.orderNo, cust: o.cust?.name || o.customer };
    }));
    return { fy, cur, prev, prevSame, last };
  }, [raw, settings, k, ownOnly, loginName]); // eslint-disable-line

  const quoteInfo = useMemo(() => {
    const qs = (quotes || []).filter(q => q.saved !== false && (!ownOnly || q.savedBy === loginName));
    const withSku = qs.filter(q => (q.lineItems || []).some(li => skuKey(li.sku) === k));
    const status = q => q.quoteStatus || "inprogress";
    const open = withSku.filter(q => ["inprogress", "followed"].includes(status(q)));
    const lineVal = q => (q.lineItems || []).filter(li => skuKey(li.sku) === k).reduce((s, li) => s + (parseFloat(li.qty) || 0) * (parseFloat(li.unitPrice) || 0) * (q.currency === "USD" ? usdToCad : 1), 0);
    return { total: withSku.length, open: open.length, openVal: open.reduce((s, q) => s + lineVal(q), 0), won: withSku.filter(q => status(q) === "won").length, lost: withSku.filter(q => ["lost", "cold"].includes(status(q))).length };
  }, [quotes, k, ownOnly, loginName]);

  const cost = canCosts && costs?.status === "ready" ? costOf(costs.costs, realSku) : null;
  const costSrc = cost != null ? costs.costs[String(realSku).toUpperCase()]?.source : "";
  const card = { background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 4, padding: 14, marginBottom: 12 };
  const head = { fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: T.gold, fontWeight: 700, marginBottom: 8 };
  const muted = { fontSize: 12, color: T.tableHeadText };
  const top = g => [...g.custs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const chg = (a, b) => (b ? `${a >= b ? "▲" : "▼"} ${Math.abs(((a - b) / b) * 100).toFixed(0)}%` : "");

  return (
    <div onMouseDown={onClose} style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(0,0,0,.45)", display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto", padding: "30px 16px" }}>
      <div onMouseDown={e => e.stopPropagation()} role="dialog" aria-label={`${realSku} product page`}
        style={{ width: "100%", maxWidth: 1100, background: T.bg, color: T.text, borderRadius: 6, boxShadow: "0 10px 40px rgba(0,0,0,.4)", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${T.border}`, background: T.panelBg, borderRadius: "6px 6px 0 0", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: T.accent || T.gold }}>{realSku}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{p.name || product?.product || realSku}</div>
            <div style={muted}>{categories[realSku] || "Uncategorized"}{!product && " · not on the Products list"}</div>
          </div>
          {p.url && <a className="btn" href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>View on website ↗</a>}
          {canCosts && <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} onClick={() => { onClose(); onCostCalc?.(realSku); }}>🧮 Cost Calculator</button>}
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: T.subtext, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, padding: 18 }}>
          {/* Left: photo + description + packaging */}
          <div>
            {p.image ? <div style={{ ...card, background: "#fff", padding: 8, display: "flex", justifyContent: "center" }}><img src={p.image} alt={p.name} style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain" }} /></div>
              : <div style={{ ...card, ...muted, textAlign: "center", padding: 30 }}>{p.slug ? "Photo appears after the weekly website read." : "No website page for this product."}</div>}
            <div style={card}>
              <div style={head}>Description</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: T.subtext, whiteSpace: "pre-line" }}>{p.desc || product?.description || "—"}</div>
              {!p.fromSite && p.desc && <div style={{ ...muted, fontSize: 10, marginTop: 6 }}>From the Products list (the website's copy appears after the weekly read).</div>}
            </div>
            <div style={card}>
              <div style={head}>Packaging & dimensions (DIMS)</div>
              {!more ? <div style={muted}>Loading…</div> : !more.dims ? <div style={muted}>Couldn't read the DIMS sheet</div> : !more.dims.length ? <div style={muted}>Not on the DIMS sheet</div> : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr style={{ color: T.tableHeadText, fontSize: 10, textTransform: "uppercase" }}><th style={{ textAlign: "left" }}>Unit</th><th style={{ textAlign: "right" }}>Pieces</th><th style={{ textAlign: "right" }}>L × W × H</th><th style={{ textAlign: "right" }}>Weight</th><th style={{ textAlign: "left", paddingLeft: 8 }}>Location</th></tr></thead>
                  <tbody>{more.dims.map((d, i) => <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "5px 0", fontWeight: 600 }}>{d.section ? d.section[0] + d.section.slice(1).toLowerCase() : d.type || "—"}</td>
                    <td style={{ textAlign: "right" }}>{d.pieces || "—"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{[d.L, d.W, d.H].filter(Boolean).map(v => /["″]$/.test(v) ? v : v + '"').join(" × ") || "—"}</td>
                    <td style={{ textAlign: "right" }}>{d.weight ? d.weight + (/[a-z]/i.test(d.weight) ? "" : " lb") : "—"}</td>
                    <td style={{ paddingLeft: 8, color: T.subtext }}>{d.location || ""}</td></tr>)}</tbody>
                </table>)}
            </div>
          </div>

          {/* Right: prices, stock, sales, quotes, cost */}
          <div>
            <div style={card}>
              <div style={head}>Current price list</div>
              {!product && !usd ? <div style={muted}>Not on the current price list</div> : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ color: T.tableHeadText, fontSize: 10, textTransform: "uppercase" }}><th style={{ textAlign: "left" }} /><th style={{ textAlign: "right" }}>CAD</th><th style={{ textAlign: "right" }}>USD</th>{cost != null && <th style={{ textAlign: "right" }}>Margin</th>}</tr></thead>
                  <tbody>{PRICE_FIELDS.filter(f => num(product?.[f]) || num(usd?.[f])).map(f => {
                    const m = cost != null ? marginPct(product?.[f], cost) : null;
                    return <tr key={f} style={{ borderTop: `1px solid ${T.border}` }}><td style={{ padding: "5px 0", color: T.subtext }}>{FIELD_LABEL[f]}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(num(product?.[f]))}</td><td style={{ textAlign: "right" }}>{money(num(usd?.[f]))}</td>{cost != null && <td style={{ textAlign: "right", color: m == null ? undefined : m >= 30 ? "#34c77b" : m >= 15 ? "#e8a23a" : "#e8472c" }}>{m == null ? "—" : m.toFixed(1) + "%"}</td>}</tr>;
                  })}</tbody>
                </table>)}
            </div>

            {canCosts && <div style={card}>
              <div style={head}>Cost</div>
              {costs?.status !== "ready" ? <div style={muted}>Costs are locked — sign in again with your own password.</div>
                : cost == null ? <div style={muted}>No cost yet. Open the <b>Cost Calculator</b> to add one.</div>
                : <div style={{ fontSize: 13 }}><b style={{ fontSize: 18 }}>{money(cost)}</b> <span style={muted}>per unit · {costSrc || "cost list"}</span></div>}
            </div>}

            <div style={card}>
              <div style={head}>Stock</div>
              {!more ? <div style={muted}>Loading…</div> : !more.stock ? <div style={muted}>Couldn't read the stock sheets</div> : !more.stock.rows.length ? <div style={muted}>Not on the stock sheets</div>
                : more.stock.rows.map(r => <div key={r.sheet} style={{ display: "flex", gap: 10, fontSize: 13, marginBottom: 3 }}>
                    <span style={{ flex: 1, color: T.subtext }}>{r.sheet}</span>
                    <b style={{ color: r.main.n == null ? T.subtext : r.main.n <= 0 ? "#e8472c" : "#34c77b" }}>{r.main.n == null ? r.main.value || "—" : r.main.n <= 0 ? "Out of stock" : `${r.main.value}${r.main.label === "Rolls" ? " rolls" : ""} in stock`}</b>
                    {r.extra.length > 0 && <span style={{ ...muted, fontSize: 11 }}>{r.extra.map(c => `${c.label} ${c.value}`).join(" · ")}</span>}
                  </div>)}
            </div>

            <div style={card}>
              <div style={head}>Sales{ownOnly ? " (your accounts)" : ""}</div>
              {!sales ? <div style={muted}>Loading orders…</div> : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
                    {[[`FY${sales.fy} so far`, sales.cur, sales.prevSame], [`FY${sales.fy - 1}`, sales.prev, null]].map(([l, g, cmp]) => (
                      <div key={l} style={{ gridColumn: "span 1" }}>
                        <div style={{ ...muted, fontSize: 10, textTransform: "uppercase" }}>{l}</div>
                        <div style={{ fontSize: 17, fontWeight: 700 }}>{fmtMoney(g.amt)}</div>
                        <div style={muted}>{g.qty.toLocaleString()} units · {g.orders.size} order{g.orders.size === 1 ? "" : "s"}</div>
                        {cmp && cmp.amt > 0 && <div style={{ fontSize: 11, color: g.amt >= cmp.amt ? "#34c77b" : "#e8472c" }}>{chg(g.amt, cmp.amt)} vs same point last year</div>}
                      </div>
                    ))}
                    <div>
                      <div style={{ ...muted, fontSize: 10, textTransform: "uppercase" }}>Last ordered</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{sales.last ? fmtDate(sales.last.date) : "—"}</div>
                      {sales.last && <div style={muted}>{sales.last.orderNo} · {sales.last.cust}</div>}
                    </div>
                  </div>
                  {top(sales.cur.amt ? sales.cur : sales.prev).length > 0 && <>
                    <div style={{ ...muted, fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>Top customers ({sales.cur.amt ? `FY${sales.fy}` : `FY${sales.fy - 1}`})</div>
                    {top(sales.cur.amt ? sales.cur : sales.prev).map(([n, v]) => <div key={n} style={{ display: "flex", fontSize: 12, padding: "2px 0" }}><span style={{ flex: 1 }}>{n}</span><b>{fmtMoney(v)}</b></div>)}
                  </>}
                  <div style={{ ...muted, fontSize: 10, marginTop: 6 }}>From order confirmations, before tax; USD converted to CAD.</div>
                </>)}
            </div>

            <div style={card}>
              <div style={head}>Quotes</div>
              <div style={{ display: "flex", gap: 18, fontSize: 13, flexWrap: "wrap" }}>
                <span><b>{quoteInfo.open}</b> open{quoteInfo.openVal ? ` · ${fmtMoney(quoteInfo.openVal)} of this product` : ""}</span>
                <span><b>{quoteInfo.won}</b> won</span>
                <span><b>{quoteInfo.lost}</b> lost / cold</span>
                <span style={muted}>{quoteInfo.total} quote{quoteInfo.total === 1 ? "" : "s"} in all</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
