// ─── Sales Summary tab ───────────────────────────────────────────────────────
// Order confirmations synced from Dropbox → Firestore "salesOrders", summarised
// by day / week / month / fiscal year, by customer account, SKU, rep and location.
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, deleteField } from "firebase/firestore";
import { DEFAULT_ACCOUNTS, REPS, SALES_REP, normName } from "./accounts";
import { isDropboxConnected, startDropboxAuth, disconnectDropbox, redirectUri, browseFolder, accountInfo } from "./dropbox";
import { syncOrders } from "./sync";
import { useLogos, syncLogos, resizeImage, saveLogo, removeLogo } from "./logos";
import { yearCompare, openYearEndReport } from "./yearEndReport";
import {
  today, mondayOf, addDays, monthStart, monthEnd, fyOf, fyStart, fyEnd, daysBetween, parseYmd,
  fmtDate, fmtShort, fmtMonth, weekdayName, presetRange, PRESETS,
  fmtMoney, fmtQty, orderCurrency, orderAmount, sumOrders, displayValue,
  enrichOrders, filterOrders, groupBy, downloadCSV, findQuoteMatches,
} from "./salesUtils";

const DEFAULT_SETTINGS = {
  accounts: DEFAULT_ACCOUNTS,
  aliases: {},
  custTypes: {},
  usdToCad: 1.37,
  since: "2025-12-01",
  folders: [
    "/Brooks Division/Brooks BOL/Brooks Order Confirmations",
    "/Calgary BOL/Calgary Order Confirmations",
  ],
  logoFolder: "/Documents/Marketing/Customer Logos",
  quoteLinks: {},
  dismissedMatches: {},
  lastSync: null,
};
const AUTO_SYNC_HOURS = 12;
// Bump when the PDF reading changes in a way that should fix orders already synced:
// the next Refresh then re-reads every PDF in the date range (corrections are kept)
const PARSER_VERSION = 3; // (problem PDFs listed under Missing order numbers are always retried)
const VIEWS = [
  ["dashboard", "Dashboard"], ["orders", "Orders"], ["accounts", "Accounts"],
  ["reports", "Reports"], ["quotes", "Quote Matches"], ["settings", "Settings"],
];

export default function SalesSummary({ T, db, quotes, updateQuoteStatus, loginName, user, bmpLogo }) {
  // "own" scope (e.g. John) only sees accounts where they're the rep; admins also get Settings
  const ownOnly = user?.salesScope === "own";
  const isAdmin = !!user?.admin;
  const canSync = !ownOnly;
  const logos = useLogos(db);
  const [rawOrders, setRawOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [stored, setStored] = useState(null);
  const [seen, setSeen] = useState({});
  const [view, setView] = useState("dashboard");
  const [accountKey, setAccountKey] = useState(null);
  const [sync, setSync] = useState(null); // { stage, done, total } while running
  const [syncMsg, setSyncMsg] = useState(null);
  const [connected, setConnected] = useState(isDropboxConnected());
  const [currencyMode, setCurrencyMode] = useState("combined");
  const [includeFreight, setIncludeFreight] = useState(true);
  const autoTried = useRef(false);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [view, accountKey]);

  // During a big sync every saved order fires this listener; redrawing hundreds of
  // orders each time made the whole page sluggish, so updates are batched to every 2s.
  useEffect(() => {
    let timer = null, latest = null, first = true;
    const flush = () => { timer = null; setRawOrders(latest.docs.map(d => ({ ...d.data(), orderNo: d.id }))); setLoaded(true); };
    const unsub = onSnapshot(collection(db, "salesOrders"), s => {
      latest = s;
      if (first) { first = false; flush(); } else if (!timer) timer = setTimeout(flush, 2000);
    }, e => { console.warn("salesOrders read error", e); setLoaded(true); });
    return () => { unsub(); clearTimeout(timer); };
  }, [db]);
  useEffect(() => onSnapshot(doc(db, "config", "salesSettings"), s => setStored(s.exists() ? s.data() : {}), () => setStored({})), [db]);
  useEffect(() => onSnapshot(doc(db, "config", "salesSyncSeen"), s => setSeen(s.exists() ? (s.data().files || {}) : {})), [db]);
  const [issues, setIssues] = useState({});
  const [listing, setListing] = useState(null); // { BRO10301: "2025-06-02", … } every numbered PDF in the folders
  useEffect(() => onSnapshot(doc(db, "config", "salesSyncFiles"), s => setListing(s.exists() ? (s.data().numbers || {}) : null)), [db]);
  useEffect(() => onSnapshot(doc(db, "config", "salesSyncIssues"), s => setIssues(s.exists() ? (s.data().files || {}) : {})), [db]);

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(stored || {}) }), [stored]);
  const saveSettings = useCallback(patch => setDoc(doc(db, "config", "salesSettings"), patch, { merge: true }).catch(e => alert("Couldn't save settings: " + e.message)), [db]);
  const orders = useMemo(() => enrichOrders(rawOrders, settings).filter(o => !ownOnly || o.cust.rep === loginName).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.orderNo < b.orderNo ? 1 : -1)), [rawOrders, settings, ownOnly, loginName]);
  const opts = useMemo(() => ({ includeFreight, usdToCad: Number(settings.usdToCad) || 1.37, mode: currencyMode }), [includeFreight, settings.usdToCad, currencyMode]);
  const matches = useMemo(() => findQuoteMatches(orders, quotes, settings), [orders, quotes, settings]);

  const runSync = useCallback(async (auto = false) => {
    if (sync) return;
    if (!isDropboxConnected()) { setConnected(false); if (!auto) startDropboxAuth(); return; }
    setSyncMsg(null);
    setSync({ stage: "Starting…", done: 0, total: 0 });
    try {
      const existing = Object.fromEntries(rawOrders.map(o => [o.orderNo, o]));
      // Re-read PDFs that came in without a usable date (e.g. "January 0, 1900")
      const badDate = new Set(rawOrders.filter(o => !/^20\d\d-/.test(o.override?.date || o.date || "")).map(o => o.file?.id).filter(Boolean));
      // Record finished files every 25 so an interrupted sync (tab closed, laptop asleep) picks up where it left off
      const saveSeen = batch => setDoc(doc(db, "config", "salesSyncSeen"), { files: batch }, { merge: true });
      // One-time: PDFs skipped before problem files were tracked get one more look, so gaps show a real reason
      const orderFiles = new Set(rawOrders.map(o => o.file?.id).filter(Boolean));
      const reread = (settings.parserVersion || 0) < PARSER_VERSION;
      // Start date moved earlier since the last sync: PDFs skipped as "too old" back then get another look
      const sinceMovedBack = !settings.syncedSince || settings.since < settings.syncedSince;
      const retry = id => reread || badDate.has(id) || !!issues[id] || ((!settings.issuesTracked || sinceMovedBack) && !orderFiles.has(id));
      const r = await syncOrders({ db, folders: settings.folders, since: settings.since, seen: Object.fromEntries(Object.entries(seen).filter(([id]) => !retry(id))), existing, loginName, onProgress: setSync, onSeen: saveSeen });
      if (Object.keys(r.seen).length) await saveSeen(r.seen);
      if (Object.keys(r.listing).length) await setDoc(doc(db, "config", "salesSyncFiles"), { numbers: r.listing, at: new Date().toISOString() });
      if (Object.keys(r.issues).length || Object.keys(r.resolved).length)
        await setDoc(doc(db, "config", "salesSyncIssues"), { files: { ...r.issues, ...Object.fromEntries(Object.keys(r.resolved).map(id => [id, deleteField()])) } }, { merge: true });
      let logoNote = "";
      try {
        const lr = await syncLogos({ db, folder: settings.logoFolder, accounts: settings.accounts, aliases: settings.aliases, customerKeys: [...new Set(orders.map(o => o.cust.key))], logos, onProgress: setSync });
        if (lr.added) logoNote = ` ${lr.added} customer logo${lr.added > 1 ? "s" : ""} added.`;
      } catch (e) { logoNote = ` (Couldn't read the logo folder: ${String(e.message).slice(0, 120)})`; }
      const lastSync = { at: new Date().toISOString(), by: loginName || "", added: r.added, updated: r.updated, errors: r.errors.length, scanned: r.scanned };
      await saveSettings({ lastSync, issuesTracked: true, parserVersion: PARSER_VERSION, syncedSince: settings.since });
      setSyncMsg({ ok: !r.errors.length, text: `Synced ${r.scanned} PDFs — ${r.added} new, ${r.updated} updated${r.removed.length ? `, ${r.removed.length} out-of-range or duplicate removed` : ""}${r.errors.length ? `, ${r.errors.length} couldn't be read` : ""}.${logoNote}`, errors: r.errors });
    } catch (e) {
      setConnected(isDropboxConnected());
      setSyncMsg({ ok: false, text: String(e.message || e) });
    }
    setSync(null);
  }, [sync, rawOrders, orders, logos, settings, seen, issues, db, loginName, saveSettings]);

  // Auto-sync once a day-ish for whoever has Dropbox connected
  useEffect(() => {
    if (autoTried.current || !stored || !connected || !canSync) return;
    autoTried.current = true;
    const last = stored.lastSync?.at ? new Date(stored.lastSync.at) : null;
    if (!last || Date.now() - last > AUTO_SYNC_HOURS * 3600e3) runSync(true);
  }, [stored, connected, runSync]);

  const openAccount = key => { setAccountKey(key); setView("accounts"); };
  const gaps = useMemo(() => findGaps(rawOrders, issues, settings, listing), [rawOrders, issues, settings, listing]);
  const ctx = { T, db, orders, settings, saveSettings, opts, currencyMode, openAccount, loginName, logos, bmpLogo, ownOnly };
  const views = VIEWS.filter(([id]) => id !== "settings" || isAdmin);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderBottom: `1px solid ${T.border}`, background: T.panelBg, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", marginRight: 12, color: T.text }}>SALES SUMMARY</div>
        {views.map(([id, label]) => (
          <button key={id} onClick={() => { setView(id); if (id === "accounts") setAccountKey(null); }}
            style={{ background: view === id ? T.activeBg : "transparent", border: `1px solid ${view === id ? T.borderLight : "transparent"}`, color: view === id ? T.gold : T.subtext, padding: "5px 11px", fontSize: 11, borderRadius: 2, letterSpacing: ".03em" }}>
            {label}{id === "quotes" && matches.length ? <span style={{ marginLeft: 6, background: T.gold, color: "#0a0a0a", borderRadius: 8, padding: "0 6px", fontSize: 9, fontWeight: 700 }}>{matches.length}</span> : null}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <select value={currencyMode} onChange={e => setCurrencyMode(e.target.value)} style={{ fontSize: 11, height: 26 }} title="How totals are shown">
          <option value="combined">All in CAD (USD converted)</option>
          <option value="CAD">CAD orders only</option>
          <option value="USD">USD orders only</option>
        </select>
        <label style={{ fontSize: 11, color: T.subtext, display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={includeFreight} onChange={e => setIncludeFreight(e.target.checked)} /> Include freight
        </label>
        {ownOnly && <span style={{ fontSize: 10, color: T.tableHeadText }}>Showing your accounts only</span>}
        <div style={{ fontSize: 10, color: T.tableHeadText, textAlign: "right", lineHeight: 1.3, minWidth: 120 }}>
          {sync ? <span style={{ color: T.gold }}>{sync.stage}{sync.total ? ` ${sync.done}/${sync.total}` : ""}</span>
            : settings.lastSync ? <>Last synced {timeAgo(settings.lastSync.at)}<br />by {settings.lastSync.by || "—"}</> : "Never synced"}
        </div>
        {canSync && <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} disabled={!!sync} onClick={() => runSync(false)}>
          {sync ? "Syncing…" : connected ? "↻ Refresh" : "Connect Dropbox"}
        </button>}
      </div>
      {sync && sync.total > 0 && (
        <div style={{ height: 3, background: T.border }}><div style={{ height: 3, width: `${(sync.done / sync.total) * 100}%`, background: T.gold, transition: "width .2s" }} /></div>
      )}
      {syncMsg && (
        <div style={{ padding: "6px 16px", fontSize: 11, background: syncMsg.ok ? "rgba(90,158,90,.12)" : "rgba(200,106,90,.12)", color: syncMsg.ok ? "#5a9e5a" : "#c86a5a", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            {syncMsg.text}
            {syncMsg.errors?.length > 0 && <details style={{ marginTop: 4 }}><summary style={{ cursor: "pointer" }}>Show files</summary>
              {syncMsg.errors.map((e, i) => <div key={i} style={{ fontSize: 10, color: T.subtext }}>{e.file} — {e.error}</div>)}</details>}
          </div>
          <button onClick={() => setSyncMsg(null)} style={{ background: "none", border: "none", color: "inherit", fontSize: 13 }}>×</button>
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {!loaded || !stored ? <Empty T={T}>Loading sales data…</Empty>
          : !orders.length && view !== "settings" ? (
            <Empty T={T}>
              <div style={{ fontSize: 14, color: T.text, marginBottom: 8 }}>No order confirmations yet</div>
              <div style={{ marginBottom: 14 }}>{connected ? "Click Refresh to read your order confirmations from Dropbox." : "Connect Dropbox to pull in your order confirmations. You only need to do this once per computer."}</div>
              {canSync && <button className="btn-gold" onClick={() => runSync(false)}>{connected ? "↻ Refresh now" : "Connect Dropbox"}</button>}
            </Empty>
          )
          : view === "dashboard" ? <>
              {isAdmin && gaps.length > 0 && (
                <div onClick={() => setView("settings")} style={{ cursor: "pointer", marginBottom: 12, padding: "8px 12px", fontSize: 12, border: "1px solid #6a5420", background: "rgba(200,160,48,.10)", color: "#c8a030", borderRadius: 3, maxWidth: 1400 }}>
                  ⚠ {gaps.length} order number{gaps.length > 1 ? "s are" : " is"} missing: {gaps.slice(0, 6).map(g => g.no).join(", ")}{gaps.length > 6 ? "…" : ""} — click to see why (Settings → Missing order numbers)
                </div>
              )}
              <Dashboard {...ctx} />
            </>
          : view === "orders" ? <OrdersView {...ctx} />
          : view === "accounts" ? (accountKey ? <AccountDetail {...ctx} accountKey={accountKey} back={() => setAccountKey(null)} /> : <AccountsView {...ctx} />)
          : view === "reports" ? <ReportsView {...ctx} />
          : view === "quotes" ? <QuoteMatchesView {...ctx} matches={matches} quotes={quotes} updateQuoteStatus={updateQuoteStatus} />
          : isAdmin ? <SettingsView {...ctx} connected={connected} setConnected={setConnected} seenCount={Object.keys(seen).length} gaps={gaps} issues={issues} /> : null}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Dashboard — defaults to the current Mon–Fri week
// ═════════════════════════════════════════════════════════════════════════════
function Dashboard({ T, orders, opts, currencyMode, openAccount }) {
  const [weekStart, setWeekStart] = useState(mondayOf(today()));
  const [selDay, setSelDay] = useState(null);
  const now = today();
  const thisWeek = mondayOf(now);
  const isCurrent = weekStart === thisWeek;
  const weekEnd = addDays(weekStart, 6);
  const ref = isCurrent ? now : addDays(weekStart, 4); // "to date" anchor
  const fy = fyOf(ref);
  const pool = useMemo(() => orders.filter(o => currencyMode === "combined" || orderCurrency(o) === currencyMode), [orders, currencyMode]);
  const inRange = (a, b) => pool.filter(o => o.date >= a && o.date <= b);

  const weekOrders = inRange(weekStart, weekEnd);
  // compare like-for-like: this week so far vs the same days last week
  const prevWeek = inRange(addDays(weekStart, -7), isCurrent ? addDays(now, -7) : addDays(weekStart, -1));
  const monthOrders = inRange(monthStart(ref), isCurrent ? now : monthEnd(ref));
  const fyOrders = inRange(fyStart(fy), ref);
  const lastFyOrders = inRange(fyStart(fy - 1), addDays(ref, -365));

  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(weekStart, i))
    .filter((d, i) => i < 5 || weekOrders.some(o => o.date === d));
  const daySums = days.map(d => ({ d, orders: weekOrders.filter(o => o.date === d), sum: sumOrders(weekOrders.filter(o => o.date === d), opts) }));

  const wk = sumOrders(weekOrders, opts);
  const tiles = [
    isCurrent && { label: "Today", sub: fmtDate(now), sum: sumOrders(inRange(now, now), opts) },
    { label: isCurrent ? "This week" : "Week", sub: `${fmtShort(weekStart)} – ${fmtShort(addDays(weekStart, 4))}`, sum: wk, cmp: sumOrders(prevWeek, opts), cmpLabel: isCurrent ? "vs same days last week" : "vs previous week" },
    { label: fmtMonth(ref), sub: isCurrent ? "Month to date" : "Full month", sum: sumOrders(monthOrders, opts) },
    { label: `Fiscal ${fy}`, sub: `Dec 1 – ${fmtShort(ref)}`, sum: sumOrders(fyOrders, opts), cmp: sumOrders(lastFyOrders, opts), cmpLabel: `vs FY${fy - 1} same point` },
  ].filter(Boolean);

  const detailOrders = selDay ? weekOrders.filter(o => o.date === selDay) : weekOrders;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1400 }}>
      {/* Week navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="btn" onClick={() => { setWeekStart(addDays(weekStart, -7)); setSelDay(null); }}>◀ Prev week</button>
        <input type="date" value={weekStart} onChange={e => { if (e.target.value) { setWeekStart(mondayOf(e.target.value)); setSelDay(null); } }} style={{ height: 28, fontSize: 12 }} title="Jump to any week" />
        <button className="btn" disabled={isCurrent} style={{ opacity: isCurrent ? .4 : 1 }} onClick={() => { setWeekStart(addDays(weekStart, 7)); setSelDay(null); }}>Next week ▶</button>
        {!isCurrent && <button className="btn" onClick={() => { setWeekStart(thisWeek); setSelDay(null); }}>This week</button>}
        <div style={{ fontSize: 15, fontWeight: 600, marginLeft: 8, color: T.text }}>Week of {fmtDate(weekStart)}</div>
      </div>

      {/* Tiles */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`, gap: 12 }}>
        {tiles.map(t => <Tile key={t.label} T={T} {...t} mode={currencyMode} />)}
      </div>

      {/* Daily breakdown */}
      <Card T={T} title="Daily sales" right={selDay ? <button className="btn" onClick={() => setSelDay(null)}>Show whole week</button> : <span style={{ fontSize: 10, color: T.tableHeadText }}>Click a day to see its orders</span>}>
        <DayBars T={T} days={daySums} mode={currencyMode} sel={selDay} onSel={d => setSelDay(selDay === d ? null : d)} />
      </Card>

      <Card T={T} title={selDay ? `Orders on ${weekdayName(selDay)} ${fmtDate(selDay)}` : "Orders this week"}>
        <OrderTable T={T} orders={detailOrders} opts={opts} openAccount={openAccount} compact />
      </Card>

      <Breakdown T={T} orders={pool} opts={opts} mode={currencyMode} weekStart={weekStart} refDate={ref} openAccount={openAccount} />
    </div>
  );
}

function Tile({ T, label, sub, sum, cmp, cmpLabel, mode }) {
  const v = displayValue(sum, mode);
  const pv = cmp ? displayValue(cmp, mode) : null;
  const pct = pv ? ((v - pv) / pv) * 100 : null;
  return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: T.tableHeadText }}>{label}</div>
      <div style={{ fontSize: 10, color: T.tableHeadText, marginBottom: 6 }}>{sub}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: T.text, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(v)}</div>
      <div style={{ fontSize: 11, color: T.subtext, marginTop: 4 }}>
        {sum.count} order{sum.count === 1 ? "" : "s"}
        {mode === "combined" && (sum.usd > 0) && <> · CAD {fmtMoney(sum.cad)} · USD {fmtMoney(sum.usd)}</>}
      </div>
      {pct != null && isFinite(pct) && (
        <div style={{ fontSize: 11, marginTop: 4, color: pct >= 0 ? "#5a9e5a" : "#c86a5a" }}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% <span style={{ color: T.tableHeadText }}>{cmpLabel}</span></div>
      )}
      {sum.noPrice > 0 && <div style={{ fontSize: 10, color: "#c8a030", marginTop: 4 }}>⚠ {sum.noPrice} order{sum.noPrice > 1 ? "s" : ""} with no pricing</div>}
    </div>
  );
}

function DayBars({ T, days, mode, sel, onSel }) {
  const max = Math.max(1, ...days.map(d => displayValue(d.sum, mode)));
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 190, padding: "4px 4px 0" }}>
      {days.map(({ d, sum }) => {
        const v = displayValue(sum, mode);
        const h = Math.max(v ? 4 : 0, (v / max) * 130);
        const active = !sel || sel === d;
        return (
          <button key={d} onClick={() => onSel(d)} title={`${weekdayName(d)} ${fmtDate(d)}: ${fmtMoney(v)} · ${sum.count} orders`}
            style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", padding: 0, opacity: active ? 1 : .35 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{v ? fmtMoney(v) : "—"}</div>
            <div style={{ width: "62%", maxWidth: 90, height: h, background: T.gold, borderRadius: "4px 4px 0 0" }} />
            <div style={{ borderTop: `1px solid ${T.borderMid}`, width: "100%", paddingTop: 6, marginTop: 0 }}>
              <div style={{ fontSize: 11, color: sel === d ? T.gold : T.subtext, fontWeight: 600 }}>{weekdayName(d)}</div>
              <div style={{ fontSize: 10, color: T.tableHeadText }}>{fmtShort(d)} · {sum.count} order{sum.count === 1 ? "" : "s"}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const GROUPS = [["customer", "Customer"], ["product", "Product / SKU"], ["rep", "Account holder"], ["type", "Distributor / End User"], ["location", "Location (BRO/CAL)"], ["city", "Ship-to city"], ["month", "Month"]];

function Breakdown({ T, orders, opts, mode, weekStart, refDate, openAccount }) {
  const [period, setPeriod] = useState("selweek");
  const [custom, setCustom] = useState([monthStart(refDate), refDate]);
  const [by, setBy] = useState("customer");
  const [top, setTop] = useState(10);
  const range = period === "selweek" ? [weekStart, addDays(weekStart, 6)]
    : period === "custom" ? custom : presetRange(period, refDate);
  const rows = groupBy(orders.filter(o => o.date >= range[0] && o.date <= range[1]), by, opts);
  const shown = top === "all" ? rows : rows.slice(0, top);
  const max = Math.max(1, ...shown.map(r => displayValue(r, mode)));
  const total = rows.reduce((s, r) => s + displayValue(r, mode), 0);
  return (
    <Card T={T} title="Breakdown" right={
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={{ fontSize: 11, height: 26 }}>
          <option value="selweek">Selected week</option>
          {PRESETS.filter(p => !["week"].includes(p[0])).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {period === "custom" && <DateRange value={custom} onChange={setCustom} />}
        <span style={{ fontSize: 11, color: T.tableHeadText }}>by</span>
        <select value={by} onChange={e => setBy(e.target.value)} style={{ fontSize: 11, height: 26 }}>
          {GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span style={{ fontSize: 11, color: T.tableHeadText }}>show</span>
        <select value={top} onChange={e => setTop(e.target.value === "all" ? "all" : +e.target.value)} style={{ fontSize: 11, height: 26 }}>
          {[5, 10, 25, 50].map(n => <option key={n} value={n}>Top {n}</option>)}<option value="all">All</option>
        </select>
      </div>}>
      <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 8 }}>{fmtDate(range[0])} – {fmtDate(range[1])} · {rows.length} {by === "product" ? "products" : "rows"} · total {fmtMoney(total)}</div>
      {!rows.length ? <div style={{ fontSize: 12, color: T.tableHeadText, padding: 12 }}>No orders in this period.</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {shown.map(r => {
            const v = displayValue(r, mode);
            const clickable = by === "customer";
            return (
              <div key={r.key} onClick={clickable ? () => openAccount(r.key) : undefined} title={`${r.label}: ${fmtMoney(v, 2)} · ${r.count} orders${r.qty ? ` · qty ${fmtQty(r.qty)}` : ""}`}
                style={{ display: "grid", gridTemplateColumns: "minmax(140px, 260px) 1fr 110px 70px", gap: 10, alignItems: "center", fontSize: 12, cursor: clickable ? "pointer" : "default", padding: "2px 0" }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.text }}>
                  {r.label}{r.desc && by === "product" ? <span style={{ color: T.tableHeadText }}> · {r.desc}</span> : null}
                </div>
                <div style={{ background: T.border, height: 10, borderRadius: 2 }}><div style={{ width: `${(v / max) * 100}%`, height: 10, background: T.gold, borderRadius: "0 4px 4px 0" }} /></div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.text }}>{fmtMoney(v)}</div>
                <div style={{ textAlign: "right", fontSize: 10, color: T.tableHeadText }}>{by === "product" ? `qty ${fmtQty(r.qty)}` : `${r.count} ord`}</div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Orders — every OC with filters
// ═════════════════════════════════════════════════════════════════════════════
function useFilters(initialPreset = "fytd") {
  const [preset, setPreset] = useState(initialPreset);
  const [custom, setCustom] = useState(presetRange("fytd"));
  const [f, setF] = useState({ customer: "", sku: "", orderNo: "", location: "all", rep: "all", type: "all", text: "" });
  const range = preset === "custom" ? custom : presetRange(preset);
  return { preset, setPreset, custom, setCustom, f, setF, filters: { ...f, from: range[0], to: range[1] }, range };
}

function FilterBar({ T, orders, fl, show = ["customer", "sku", "orderNo", "location", "rep", "type"] }) {
  const { preset, setPreset, custom, setCustom, f, setF } = fl;
  const customers = useMemo(() => {
    const m = new Map(); orders.forEach(o => m.set(o.cust.key, o.cust.name));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const st = { fontSize: 11, height: 28 };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      <select value={preset} onChange={e => setPreset(e.target.value)} style={st}>
        {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {preset === "custom" && <DateRange value={custom} onChange={setCustom} />}
      {show.includes("customer") && <select value={f.customer} onChange={e => set("customer", e.target.value)} style={{ ...st, maxWidth: 220 }}>
        <option value="">All customers</option>
        {customers.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
      </select>}
      {show.includes("sku") && <input placeholder="SKU or product" value={f.sku} onChange={e => set("sku", e.target.value)} style={{ ...st, width: 130 }} />}
      {show.includes("orderNo") && <input placeholder="Order # / PO (BRO, CAL…)" value={f.orderNo} onChange={e => set("orderNo", e.target.value)} style={{ ...st, width: 170 }} />}
      {show.includes("location") && <select value={f.location} onChange={e => set("location", e.target.value)} style={st}>
        <option value="all">BRO + CAL</option><option value="BRO">Brooks (BRO)</option><option value="CAL">Calgary (CAL)</option>
      </select>}
      {show.includes("rep") && <select value={f.rep} onChange={e => set("rep", e.target.value)} style={st}>
        <option value="all">All account holders</option>{REPS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>}
      {show.includes("type") && <select value={f.type} onChange={e => set("type", e.target.value)} style={st}>
        <option value="all">Distributors + End Users</option><option value="Distributor">Distributors</option><option value="End User">End Users</option>
      </select>}
      <button className="btn" onClick={() => { setF({ customer: "", sku: "", orderNo: "", location: "all", rep: "all", type: "all", text: "" }); setPreset("fytd"); }}>Clear</button>
    </div>
  );
}

function DateRange({ value, onChange }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <input type="date" value={value[0]} onChange={e => onChange([e.target.value, value[1]])} style={{ fontSize: 11, height: 26 }} />
      <span style={{ fontSize: 11 }}>to</span>
      <input type="date" value={value[1]} onChange={e => onChange([value[0], e.target.value])} style={{ fontSize: 11, height: 26 }} />
    </span>
  );
}

function OrdersView({ T, db, orders, opts, currencyMode, openAccount, settings, saveSettings }) {
  const fl = useFilters("fytd");
  const list = filterOrders(orders, { ...fl.filters, currency: currencyMode });
  const sum = sumOrders(list, opts);
  const exportCsv = () => downloadCSV(`orders-${fl.range[0]}-to-${fl.range[1]}.csv`,
    ["Date", "Order #", "Location", "Customer account", "Sold To (as on OC)", "Rep", "Type", "Ship-to city", "PO", "SKU", "Description", "Qty", "Price", "Line amount", "Currency", "Freight", "Order total before tax"],
    list.flatMap(o => (o.lines?.length ? o.lines : [{}]).map((l, i) => [o.date, o.orderNo, o.location, o.cust.name, o.customer, o.cust.rep, o.cust.type, [o.city, o.region].filter(Boolean).join(", "), o.po, l.sku, l.desc, l.qty, l.price, l.amount, orderCurrency(o), i === 0 ? o.freight : "", i === 0 ? orderAmount(o, true) : ""])));
  return (
    <div style={{ maxWidth: 1500 }}>
      <FilterBar T={T} orders={orders} fl={fl} />
      <div style={{ display: "flex", gap: 16, alignItems: "baseline", marginBottom: 10, fontSize: 12, color: T.subtext }}>
        <span><b style={{ color: T.text, fontSize: 16 }}>{fmtMoney(displayValue(sum, currencyMode), 2)}</b> {currencyMode === "combined" ? "CAD (combined)" : currencyMode}</span>
        <span>{sum.count} orders</span>
        {currencyMode === "combined" && <span>CAD {fmtMoney(sum.cad, 2)} · USD {fmtMoney(sum.usd, 2)}</span>}
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={exportCsv}>Export CSV</button>
      </div>
      <Card T={T} pad={0}><OrderTable T={T} db={db} orders={list} opts={opts} openAccount={openAccount} settings={settings} saveSettings={saveSettings} editable /></Card>
    </div>
  );
}

function OrderTable({ T, db, orders, opts, openAccount, compact, editable, settings, saveSettings }) {
  const [open, setOpen] = useState(null);
  const [limit, setLimit] = useState(200);
  if (!orders.length) return <div style={{ fontSize: 12, color: T.tableHeadText, padding: 12 }}>No orders.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead><tr>
          <th>Date</th><th>Order #</th><th>Customer</th>{!compact && <th>Held by</th>}<th>Ship to</th>{!compact && <th>PO</th>}<th>Products</th><th style={{ textAlign: "right" }}>Amount</th>
        </tr></thead>
        <tbody>
          {orders.slice(0, limit).map(o => {
            const cur = orderCurrency(o), amt = orderAmount(o, opts.includeFreight);
            const noPrice = !o.hasPricing && (o.override?.total == null || o.override.total === "");
            return [
              <tr key={o.orderNo} onClick={() => setOpen(open === o.orderNo ? null : o.orderNo)} style={{ cursor: "pointer" }}>
                <td style={{ whiteSpace: "nowrap" }}>{fmtShort(o.date)}{!compact && <span style={{ color: T.tableHeadText }}> {o.date?.slice(0, 4)}</span>}</td>
                <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{o.orderNo}</td>
                <td><a onClick={e => { e.stopPropagation(); openAccount(o.cust.key); }} style={{ color: T.text, textDecoration: "underline", textDecorationColor: T.borderLight, cursor: "pointer" }}>{o.cust.name}</a>
                  {!o.cust.matched && <span className="pill" style={{ marginLeft: 6, background: T.tag, color: T.tagText, border: `1px solid ${T.tagBorder}` }}>{o.cust.type}</span>}</td>
                {!compact && <td style={{ color: T.subtext }}>{o.cust.rep}</td>}
                <td style={{ color: T.subtext, whiteSpace: "nowrap" }}>{[o.city, o.region].filter(Boolean).join(", ")}</td>
                {!compact && <td style={{ color: T.subtext }}>{o.po}</td>}
                <td style={{ color: T.subtext, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(o.lines || []).map(l => `${l.sku} ×${fmtQty(l.qty)}`).join(", ")}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                  {noPrice ? <span style={{ color: "#c8a030" }} title="Bill of lading only — no pricing">no price</span> : fmtMoney(amt, 2)}
                  <span style={{ color: cur === "USD" ? T.gold : T.muted, fontSize: 10, marginLeft: 4 }}>{cur}</span>
                </td>
              </tr>,
              open === o.orderNo && <tr key={o.orderNo + "-d"}><td colSpan={compact ? 6 : 8} style={{ background: T.panelBg, padding: 14 }}>
                <OrderDetail T={T} db={db} o={o} editable={editable} settings={settings} saveSettings={saveSettings} />
              </td></tr>,
            ];
          })}
        </tbody>
      </table>
      {orders.length > limit && <div style={{ padding: 10, textAlign: "center" }}><button className="btn" onClick={() => setLimit(limit + 500)}>Show more ({orders.length - limit} more)</button></div>}
    </div>
  );
}

function OrderDetail({ T, db, o, editable }) {
  const [ov, setOv] = useState({ customer: o.override?.customer || "", currency: o.override?.currency || "", total: o.override?.total ?? "", date: o.override?.date || "" });
  const save = () => setDoc(doc(db, "salesOrders", o.orderNo), { override: { customer: ov.customer.trim(), currency: ov.currency, total: ov.total === "" ? "" : Number(ov.total), date: ov.date || "" } }, { merge: true });
  const remove = () => { if (confirm(`Remove ${o.orderNo} from Sales Summary? (It will come back on the next sync if the PDF is still in Dropbox and is changed.)`)) deleteDoc(doc(db, "salesOrders", o.orderNo)); };
  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 12 }}>
      <div style={{ flex: "2 1 420px" }}>
        <table className="data-table" style={{ background: T.cardBg }}>
          <thead><tr><th>SKU</th><th>Description</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Price</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>
            {(o.lines || []).map((l, i) => <tr key={i}><td>{l.sku}</td><td>{l.desc}</td><td style={{ textAlign: "right" }}>{fmtQty(l.qty)}</td><td style={{ textAlign: "right" }}>{o.hasPricing ? fmtMoney(l.price, 2) : "—"}</td><td style={{ textAlign: "right" }}>{o.hasPricing ? fmtMoney(l.amount, 2) : "—"}</td></tr>)}
            {(o.charges || []).map((c, i) => <tr key={"c" + i}><td></td><td style={{ color: T.subtext }}>{c.label}</td><td></td><td></td><td style={{ textAlign: "right" }}>{fmtMoney(c.amount, 2)}</td></tr>)}
            {o.hasPricing && <tr><td></td><td style={{ fontWeight: 600 }}>Total before tax</td><td></td><td></td><td style={{ textAlign: "right", fontWeight: 600 }}>{fmtMoney(o.total, 2)} {orderCurrency(o)}</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 4, color: T.subtext }}>
        <div><b style={{ color: T.text }}>Sold to (on OC):</b> {o.customer}</div>
        <div><b style={{ color: T.text }}>Ship to:</b> {o.shipTo}</div>
        <div><b style={{ color: T.text }}>PO:</b> {o.po} · <b style={{ color: T.text }}>Freight terms:</b> {o.freightTerms || "—"}{o.pallets ? ` · ${o.pallets} pallets` : ""}</div>
        <div><b style={{ color: T.text }}>Account:</b> {o.cust.name} · {o.cust.rep} · {o.cust.type}</div>
        <div style={{ fontSize: 10, color: T.tableHeadText, wordBreak: "break-all" }}>Dropbox: {o.file?.path}</div>
        {(o.warnings || []).map((w, i) => <div key={i} style={{ color: "#c8a030", fontSize: 11 }}>⚠ {w}</div>)}
        {editable && (
          <div style={{ marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: T.tableHeadText }}>Corrections</div>
            <input placeholder="Customer name (if the OC name is wrong)" value={ov.customer} onChange={e => setOv({ ...ov, customer: e.target.value })} style={{ height: 26, fontSize: 11 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <select value={ov.currency} onChange={e => setOv({ ...ov, currency: e.target.value })} style={{ height: 26, fontSize: 11 }}>
                <option value="">Currency: auto ({o.currency})</option><option value="CAD">CAD</option><option value="USD">USD</option>
              </select>
              <input type="date" value={ov.date || o.date} onChange={e => setOv({ ...ov, date: e.target.value })} title="Order date" style={{ height: 26, fontSize: 11 }} />
              <input type="number" placeholder={o.hasPricing ? "Override total" : "Enter order total"} value={ov.total} onChange={e => setOv({ ...ov, total: e.target.value })} style={{ height: 26, fontSize: 11, width: 130 }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn" onClick={save}>Save corrections</button>
              <button className="btn-del" onClick={remove}>Remove order</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Save an edited account list. `renames` = [[oldName, newName]]: OC-name assignments
// and logos follow the account to its new name, and the old name keeps matching OCs.
async function saveAccounts({ db, settings, saveSettings, logos, accounts, renames = [] }) {
  const map = new Map(renames.filter(([a, b]) => a && b && a !== b));
  const next = accounts.map(a => {
    const old = [...map.entries()].find(([, nw]) => nw === a.name)?.[0];
    if (!old) return a;
    const terms = a.terms || [];
    return { ...a, terms: terms.some(t => normName(t) === normName(old)) ? terms : [...terms, old] };
  });
  const aliases = Object.fromEntries(Object.entries(settings.aliases || {}).map(([k, v]) => [k, map.get(v) || v]));
  await saveSettings({ accounts: next, aliases });
  for (const [oldName, newName] of map) {
    const l = logos?.[oldName];
    if (l && !logos[newName]) { await saveLogo(db, newName, l.dataUrl, l.source, l.file ? { file: l.file } : {}); await removeLogo(db, oldName); }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Accounts — grouped by rep, click into a customer
// ═════════════════════════════════════════════════════════════════════════════
function AccountsView({ T, orders, settings, opts, currencyMode, openAccount, logos, ownOnly, loginName }) {
  const fys = useMemo(() => [...new Set(orders.map(o => fyOf(o.date)))].sort((a, b) => b - a), [orders]);
  const [fy, setFy] = useState(fyOf(today()));
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState("all");
  const pool = orders.filter(o => currencyMode === "combined" || orderCurrency(o) === currencyMode);

  // Every account from the list, plus every unmatched customer that has ordered
  const rows = useMemo(() => {
    const m = new Map();
    settings.accounts.filter(a => !ownOnly || a.rep === loginName).forEach(a => m.set(a.name, { key: a.name, name: a.name, rep: a.rep || "Unassigned", type: a.type, cur: [], prev: [], last: "" }));
    pool.forEach(o => {
      let r = m.get(o.cust.key);
      if (!r) { r = { key: o.cust.key, name: o.cust.name, rep: o.cust.rep, type: o.cust.type, cur: [], prev: [], last: "" }; m.set(o.cust.key, r); }
      const f = fyOf(o.date);
      if (f === fy) r.cur.push(o); else if (f === fy - 1) r.prev.push(o);
      if (o.date > r.last) r.last = o.date;
    });
    return [...m.values()].map(r => ({ ...r, curSum: sumOrders(r.cur, opts), prevSum: sumOrders(r.prev, opts) }));
  }, [settings.accounts, pool, fy, opts, ownOnly, loginName]);

  const filtered = rows.filter(r => (!q || r.name.toLowerCase().includes(q.toLowerCase())) && (typeF === "all" || r.type === typeF));
  const reps = [...REPS.filter(r => r !== "Unassigned"), "Unassigned"];
  return (
    <div style={{ maxWidth: 1300 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <input placeholder="Search customers" value={q} onChange={e => setQ(e.target.value)} style={{ height: 28, fontSize: 12, width: 220 }} />
        <select value={fy} onChange={e => setFy(+e.target.value)} style={{ height: 28, fontSize: 12 }}>
          {[...new Set([fyOf(today()), ...fys])].sort((a, b) => b - a).map(y => <option key={y} value={y}>Fiscal {y} (Dec {y - 1} – Nov {y})</option>)}
        </select>
        <select value={typeF} onChange={e => setTypeF(e.target.value)} style={{ height: 28, fontSize: 12 }}>
          <option value="all">Distributors + End Users</option><option value="Distributor">Distributors</option><option value="End User">End Users</option>
        </select>
      </div>
      {reps.map(rep => {
        const rs = filtered.filter(r => r.rep === rep).sort((a, b) => displayValue(b.curSum, currencyMode) - displayValue(a.curSum, currencyMode) || a.name.localeCompare(b.name));
        if (!rs.length) return null;
        const tot = rs.reduce((s, r) => s + displayValue(r.curSum, currencyMode), 0);
        const ptot = rs.reduce((s, r) => s + displayValue(r.prevSum, currencyMode), 0);
        return (
          <Card key={rep} T={T} title={rep === "Unassigned" ? "Unassigned / End Users" : `${rep}'s accounts`} right={<span style={{ fontSize: 12, color: T.subtext }}>FY{fy}: <b style={{ color: T.text }}>{fmtMoney(tot)}</b> · FY{fy - 1}: {fmtMoney(ptot)}</span>} pad={0} style={{ marginBottom: 14 }}>
            <table className="data-table">
              <thead><tr><th>Customer</th><th>Type</th><th style={{ textAlign: "right" }}>FY{fy}</th><th style={{ textAlign: "right" }}>Orders</th><th style={{ textAlign: "right" }}>FY{fy - 1}</th><th style={{ textAlign: "right" }}>Change</th><th>Last order</th></tr></thead>
              <tbody>{rs.map(r => {
                const v = displayValue(r.curSum, currencyMode), p = displayValue(r.prevSum, currencyMode);
                const ch = p ? ((v - p) / p) * 100 : null;
                return (
                  <tr key={r.key} onClick={() => openAccount(r.key)} style={{ cursor: "pointer" }}>
                    <td style={{ fontWeight: 500 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 34, height: 22, background: logos[r.key] ? "#fff" : "transparent", borderRadius: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {logos[r.key] && <img src={logos[r.key].dataUrl} alt="" style={{ maxWidth: 32, maxHeight: 20, objectFit: "contain" }} />}
                        </span>{r.name}
                      </span>
                    </td>
                    <td style={{ color: T.subtext }}>{r.type}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v ? fmtMoney(v) : "—"}</td>
                    <td style={{ textAlign: "right", color: T.subtext }}>{r.cur.length || ""}</td>
                    <td style={{ textAlign: "right", color: T.subtext, fontVariantNumeric: "tabular-nums" }}>{p ? fmtMoney(p) : "—"}</td>
                    <td style={{ textAlign: "right", color: ch == null ? T.muted : ch >= 0 ? "#5a9e5a" : "#c86a5a" }}>{ch == null ? "" : `${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch).toFixed(0)}%`}</td>
                    <td style={{ color: T.subtext }}>{r.last ? `${fmtDate(r.last)} (${daysBetween(r.last, today())}d ago)` : "—"}</td>
                  </tr>);
              })}</tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}

function AccountDetail({ T, db, orders, settings, saveSettings, opts, currencyMode, accountKey, back, openAccount, logos, bmpLogo, ownOnly }) {
  const acct = settings.accounts.find(a => a.name === accountKey);
  const allMine = orders.filter(o => o.cust.key === accountKey);
  const mine = allMine.filter(o => currencyMode === "combined" || orderCurrency(o) === currencyMode);
  const name = acct?.name || mine[0]?.cust.name || accountKey;
  const fys = [...new Set([fyOf(today()), ...mine.map(o => fyOf(o.date))])].sort((a, b) => b - a);
  const [fy, setFy] = useState(fyOf(today()));
  const [cmpFull, setCmpFull] = useState(false);
  const fileRef = useRef(null);
  const fyOrders = mine.filter(o => fyOf(o.date) === fy);
  const products = groupBy(fyOrders, "product", opts);
  const allProducts = groupBy(mine, "product", opts);
  const months = Array.from({ length: 12 }, (_, i) => { const dt = parseYmd(fyStart(fy)); dt.setMonth(dt.getMonth() + i); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`; });
  const monthVals = months.map(m => ({ m, v: displayValue(sumOrders(fyOrders.filter(o => o.date.slice(0, 7) === m.slice(0, 7)), opts), currencyMode), pv: displayValue(sumOrders(mine.filter(o => o.date.slice(0, 7) === `${+m.slice(0, 4) - 1}${m.slice(4, 7)}`), opts), currencyMode) }));
  const maxM = Math.max(1, ...monthVals.flatMap(x => [x.v, x.pv]));
  const raws = [...new Set(allMine.map(o => o.customer))];
  const unmatched = !acct;
  const custType = acct ? acct.type : (settings.custTypes?.[accountKey] || "End User");
  const logo = logos[accountKey];
  const cmp = yearCompare(mine, fy, opts.usdToCad, { samePeriod: cmpFull ? false : undefined });
  const prevLabel = cmp.inProgress && !cmpFull ? `same period FY${fy - 1}` : `FY${fy - 1}`;
  const changes = [
    ...cmp.more.map(s => ({ ...s, tag: "More" })), ...cmp.less.map(s => ({ ...s, tag: "Less" })),
    ...cmp.added.map(s => ({ ...s, tag: "New" })), ...cmp.dropped.map(s => ({ ...s, tag: "Not reordered" })),
  ].sort((a, b) => Math.abs(b.sales - b.psales) - Math.abs(a.sales - a.psales));

  const setAcct = patch => saveSettings({ accounts: settings.accounts.map(a => a.name === accountKey ? { ...a, ...patch } : a) });
  const setType = t => acct ? setAcct({ type: t }) : saveSettings({ custTypes: { ...(settings.custTypes || {}), [accountKey]: t } });
  const assignTo = target => {
    if (!target) return;
    if (target === "__new") {
      const rep = prompt(`Create a new account "${name}". Which rep owns it? (${REPS.join(", ")})`, "Unassigned");
      if (rep == null) return;
      saveSettings({ accounts: [...settings.accounts, { name, rep: REPS.find(r => r.toLowerCase() === rep.trim().toLowerCase()) || "Unassigned", type: custType, terms: [] }], aliases: { ...settings.aliases, ...Object.fromEntries(raws.map(r => [normName(r).trim(), name])) } });
      return;
    }
    saveSettings({ aliases: { ...settings.aliases, ...Object.fromEntries(raws.map(r => [normName(r).trim(), target])) } });
    openAccount(target);
  };
  const [edit, setEdit] = useState(null); // { name, rep, type, terms } while editing
  const startEdit = () => setEdit({ name, rep: acct?.rep || "Unassigned", type: custType, terms: (acct?.terms || []).join(", ") });
  const saveEdit = async () => {
    const nm = edit.name.trim();
    if (!nm) return alert("The account needs a name.");
    if (nm !== name && settings.accounts.some(a => a.name.toLowerCase() === nm.toLowerCase())) return alert(`There's already an account called "${nm}". Use "Assign to an account" to merge into it.`);
    const terms = edit.terms.split(",").map(t => t.trim()).filter(Boolean);
    if (acct) {
      await saveAccounts({ db, settings, saveSettings, logos, accounts: settings.accounts.map(a => a.name === accountKey ? { ...a, name: nm, rep: edit.rep, type: edit.type, terms } : a), renames: [[accountKey, nm]] });
    } else {
      // Not on the list yet: create the account and point this customer's OC names at it
      await saveSettings({ accounts: [...settings.accounts, { name: nm, rep: edit.rep, type: edit.type, terms }], aliases: { ...settings.aliases, ...Object.fromEntries(raws.map(r => [normName(r).trim(), nm])) } });
      const l = logos[accountKey];
      if (l && !logos[nm]) { await saveLogo(db, nm, l.dataUrl, l.source); await removeLogo(db, accountKey); }
    }
    setEdit(null);
    if (nm !== accountKey) openAccount(nm);
  };
  // Fold this account into another: its names/spellings move over so its OCs count there from now on
  const mergeInto = async target => {
    const tgt = settings.accounts.find(a => a.name === target);
    if (!tgt || !acct) return;
    if (!confirm(`Merge "${name}" into "${target}"?\n\nAll of ${name}'s orders will count toward ${target}, and "${name}" will be removed from the account list.`)) return;
    const terms = [...new Set([...(tgt.terms || []), acct.name, ...(acct.terms || [])])];
    const aliases = Object.fromEntries(Object.entries(settings.aliases || {}).map(([k, v]) => [k, v === acct.name ? target : v]));
    await saveSettings({ accounts: settings.accounts.filter(a => a.name !== acct.name).map(a => a.name === target ? { ...a, terms } : a), aliases });
    const l = logos[acct.name];
    if (l) { if (!logos[target]) await saveLogo(db, target, l.dataUrl, l.source); await removeLogo(db, acct.name); }
    openAccount(target);
  };
  const upload = async e => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { await saveLogo(db, accountKey, await resizeImage(f), "manual", { fileName: f.name }); }
    catch (err) { alert("Couldn't use that image: " + err.message); }
  };
  const report = () => openYearEndReport({ customers: [{ key: accountKey, name, rep: acct?.rep || "Unassigned", type: custType, orders: allMine }], fy, usdToCad: opts.usdToCad, logos, bmpLogo });
  const kpi = (label, v, pv, fmt) => {
    const p = pv ? ((v - pv) / pv) * 100 : null;
    return (
      <div style={{ padding: "4px 16px 4px 0" }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: T.tableHeadText }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: T.text, fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</div>
        <div style={{ fontSize: 11, color: p == null ? T.tableHeadText : p >= 0 ? "#5a9e5a" : "#c86a5a" }}>{p == null ? `${prevLabel}: ${fmt(pv || 0)}` : `${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(0)}% vs ${fmt(pv)}`}</div>
      </div>
    );
  };
  const editable = !ownOnly;

  return (
    <div style={{ maxWidth: 1300, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button className="btn" onClick={back}>← All accounts</button>
        <div onClick={() => editable && fileRef.current?.click()} title={editable ? (logo ? "Click to replace the logo" : "Click to add a logo (PNG or JPG)") : ""}
          style={{ width: 84, height: 56, border: `1px ${logo ? "solid" : "dashed"} ${T.borderLight}`, borderRadius: 4, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: editable ? "pointer" : "default", overflow: "hidden", flexShrink: 0 }}>
          {logo ? <img src={logo.dataUrl} alt="" style={{ maxWidth: "92%", maxHeight: "88%", objectFit: "contain" }} /> : <span style={{ fontSize: 10, color: "#999", textAlign: "center" }}>{editable ? "+ Add logo" : name.slice(0, 2).toUpperCase()}</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={upload} />
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: T.text }}>{name}</div>
          <div style={{ fontSize: 11, color: T.tableHeadText }}>
            {custType} · {acct?.rep || "Unassigned"}
            {logo && editable && <> · <a style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => confirm("Remove this logo?") && removeLogo(db, accountKey)}>remove logo</a></>}
            {logo?.source === "dropbox" && <> · logo from Dropbox</>}
          </div>
        </div>
        {editable && <button className="btn" onClick={startEdit}>✎ Edit account</button>}
        {editable && <>
          <select value={acct?.rep || "Unassigned"} disabled={!acct} onChange={e => setAcct({ rep: e.target.value })} style={{ height: 26, fontSize: 11 }} title={acct ? "Account holder" : "Create an account to set a rep"}>
            {REPS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={custType} onChange={e => setType(e.target.value)} style={{ height: 26, fontSize: 11 }}>
            <option>Distributor</option><option>End User</option>
          </select>
          {acct && (
            <select value="" onChange={e => mergeInto(e.target.value)} style={{ height: 26, fontSize: 11 }} title="Combine this account with another one">
              <option value="">Merge into…</option>
              {[...settings.accounts].filter(a => a.name !== acct.name).sort((x, y) => x.name.localeCompare(y.name)).map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          )}
          {unmatched && (
            <select value="" onChange={e => assignTo(e.target.value)} style={{ height: 26, fontSize: 11 }}>
              <option value="">Assign to an account…</option>
              <option value="__new">+ Make this its own account</option>
              {[...settings.accounts].sort((x, y) => x.name.localeCompare(y.name)).map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          )}
        </>}
        <div style={{ flex: 1 }} />
        <select value={fy} onChange={e => setFy(+e.target.value)} style={{ height: 28, fontSize: 12 }}>
          {fys.map(y => <option key={y} value={y}>Fiscal {y}</option>)}
        </select>
        <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} onClick={report}>Year-End Report (PDF)</button>
      </div>
      {raws.length > 0 && <div style={{ fontSize: 11, color: T.tableHeadText }}>Names on OCs: {raws.join(" · ")}</div>}

      {edit && (
        <Card T={T} title={acct ? "Edit account" : "Create account for this customer"}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 3fr", gap: 10, alignItems: "end" }}>
            <label style={{ fontSize: 10, color: T.tableHeadText, textTransform: "uppercase", letterSpacing: ".06em" }}>Account name
              <input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} style={{ display: "block", width: "100%", height: 28, fontSize: 12, marginTop: 4 }} /></label>
            <label style={{ fontSize: 10, color: T.tableHeadText, textTransform: "uppercase", letterSpacing: ".06em" }}>Held by
              <select value={edit.rep} onChange={e => setEdit({ ...edit, rep: e.target.value })} style={{ display: "block", width: "100%", height: 28, fontSize: 12, marginTop: 4 }}>{REPS.map(r => <option key={r}>{r}</option>)}</select></label>
            <label style={{ fontSize: 10, color: T.tableHeadText, textTransform: "uppercase", letterSpacing: ".06em" }}>Type
              <select value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value })} style={{ display: "block", width: "100%", height: 28, fontSize: 12, marginTop: 4 }}><option>Distributor</option><option>End User</option></select></label>
            <label style={{ fontSize: 10, color: T.tableHeadText, textTransform: "uppercase", letterSpacing: ".06em" }}>Also matches these names on OCs (comma separated)
              <input value={edit.terms} onChange={e => setEdit({ ...edit, terms: e.target.value })} placeholder="e.g. emco corporation, emco waterworks" style={{ display: "block", width: "100%", height: 28, fontSize: 12, marginTop: 4 }} /></label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} onClick={saveEdit}>Save</button>
            <button className="btn" onClick={() => setEdit(null)}>Cancel</button>
            <span style={{ fontSize: 11, color: T.tableHeadText }}>Renaming keeps the logo, and OCs with the old name still count toward this account.</span>
          </div>
        </Card>
      )}

      <Card T={T} title={`FY${fy}${cmp.inProgress ? " to date" : ""} vs ${prevLabel}`} right={
        <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 11, color: T.subtext }}>
          {cmp.inProgress && <label style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={cmpFull} onChange={e => setCmpFull(e.target.checked)} /> Compare with all of FY{fy - 1}</label>}
          <span>{cmp.currency}{cmp.mixed ? " (USD converted)" : ""}</span>
        </div>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
          {kpi("Purchases", cmp.cur.total, cmp.prev.total, n => fmtMoney(n))}
          {kpi("Orders", cmp.cur.orders, cmp.prev.orders, n => String(n))}
          {kpi("Average order", cmp.cur.avg, cmp.prev.avg, n => fmtMoney(n))}
          {kpi("Units", cmp.cur.units, cmp.prev.units, fmtQty)}
          {kpi("Different products", cmp.top.filter(s => s.qty).length, cmp.more.length + cmp.less.length + cmp.same.length + cmp.dropped.length, n => String(n))}
        </div>
      </Card>

      <Card T={T} title={`Monthly sales — FY${fy} vs FY${fy - 1}`} right={<Legend T={T} items={[[T.gold, `FY${fy}`], [T.tableHeadText, `FY${fy - 1}`]]} />}>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 150 }}>
          {monthVals.map(({ m, v, pv }) => (
            <div key={m} title={`${fmtMonth(m)}: ${fmtMoney(v)} · prior year ${fmtMoney(pv)}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 120, width: "100%", justifyContent: "center" }}>
                <div style={{ width: "34%", height: (pv / maxM) * 120, background: T.tableHeadText, borderRadius: "3px 3px 0 0" }} />
                <div style={{ width: "34%", height: (v / maxM) * 120, background: T.gold, borderRadius: "3px 3px 0 0" }} />
              </div>
              <div style={{ fontSize: 10, color: T.tableHeadText, borderTop: `1px solid ${T.borderMid}`, width: "100%", textAlign: "center", paddingTop: 3 }}>{fmtMonth(m).slice(0, 3)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card T={T} title={`Ordering more or less — FY${fy} vs ${prevLabel}`} pad={0} right={<span style={{ fontSize: 11, color: T.subtext }}>{cmp.more.length} more · {cmp.less.length} less · {cmp.added.length} new · {cmp.dropped.length} not reordered</span>}>
        {!changes.length ? <div style={{ fontSize: 12, color: T.tableHeadText, padding: 12 }}>No changes to compare yet.</div> : (
          <table className="data-table">
            <thead><tr><th></th><th>SKU</th><th>Description</th><th style={{ textAlign: "right" }}>Qty {prevLabel.replace("same period ", "")}</th><th style={{ textAlign: "right" }}>Qty FY{fy}</th><th style={{ textAlign: "right" }}>Change</th><th style={{ textAlign: "right" }}>Sales {prevLabel.replace("same period ", "")}</th><th style={{ textAlign: "right" }}>Sales FY{fy}</th></tr></thead>
            <tbody>{changes.map(s => {
              const up = s.tag === "More" || s.tag === "New";
              return (
                <tr key={s.sku + s.desc}>
                  <td><span className="pill" style={{ background: up ? "rgba(90,158,90,.14)" : "rgba(200,106,90,.14)", color: up ? "#5a9e5a" : "#c86a5a" }}>{up ? "▲" : "▼"} {s.tag}</span></td>
                  <td style={{ fontWeight: 500 }}>{s.sku}</td><td style={{ color: T.subtext }}>{s.desc}</td>
                  <td style={{ textAlign: "right" }}>{s.pqty ? fmtQty(s.pqty) : "—"}</td><td style={{ textAlign: "right" }}>{s.qty ? fmtQty(s.qty) : "—"}</td>
                  <td style={{ textAlign: "right", color: up ? "#5a9e5a" : "#c86a5a" }}>{s.qty - s.pqty >= 0 ? "+" : "−"}{fmtQty(Math.abs(s.qty - s.pqty))}{s.pqty && s.qty ? ` (${(((s.qty - s.pqty) / s.pqty) * 100).toFixed(0)}%)` : ""}</td>
                  <td style={{ textAlign: "right" }}>{fmtMoney(s.psales)}</td><td style={{ textAlign: "right" }}>{fmtMoney(s.sales)}</td>
                </tr>);
            })}</tbody>
          </table>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {fys.slice(0, 4).map(y => {
          const s = sumOrders(mine.filter(o => fyOf(o.date) === y), opts);
          return <Tile key={y} T={T} label={`Fiscal ${y}`} sub={y === fyOf(today()) ? "To date" : `Dec ${y - 1} – Nov ${y}`} sum={s} mode={currencyMode} />;
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: 14 }}>
        <Card T={T} title={`What they ordered — FY${fy}`} pad={0}><ProductTable T={T} rows={products} mode={currencyMode} /></Card>
        <Card T={T} title="What they ordered — all years" pad={0}><ProductTable T={T} rows={allProducts} mode={currencyMode} /></Card>
      </div>
      <Card T={T} title={`Orders (${mine.length})`} pad={0}><OrderTable T={T} db={db} orders={mine} opts={opts} openAccount={() => {}} editable={editable} /></Card>
    </div>
  );
}

function ProductTable({ T, rows, mode }) {
  if (!rows.length) return <div style={{ fontSize: 12, color: T.tableHeadText, padding: 12 }}>Nothing ordered.</div>;
  return (
    <table className="data-table">
      <thead><tr><th>SKU</th><th>Description</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Sales</th><th style={{ textAlign: "right" }}>Orders</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.key}><td style={{ fontWeight: 500 }}>{r.label}</td><td style={{ color: T.subtext }}>{r.desc}</td><td style={{ textAlign: "right" }}>{r.qty ? fmtQty(r.qty) : ""}</td><td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(displayValue(r, mode))}</td><td style={{ textAlign: "right", color: T.subtext }}>{r.count}</td></tr>)}</tbody>
    </table>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Reports
// ═════════════════════════════════════════════════════════════════════════════
const REPORTS = [
  ["yearend", "Year-End customer reports (PDF)"],
  ["salesrep", `${SALES_REP}'s sales`],
  ["customer", "Sales by customer"],
  ["product", "Sales by product / SKU"],
  ["custprod", "Customer × product (who ordered what)"],
  ["monthly", "Monthly sales — fiscal year vs last year"],
  ["location", "Sales by location (BRO vs CAL)"],
  ["type", "Distributors vs End Users"],
  ["city", "Sales by ship-to city"],
  ["inactive", "Accounts that haven't ordered lately"],
];

function ReportsView({ T, orders, settings, opts, currencyMode, openAccount, logos, bmpLogo }) {
  const [rep, setRep] = useState("salesrep");
  const fl = useFilters("fytd");
  const [fy, setFy] = useState(fyOf(today()));
  const [days, setDays] = useState(60);
  const list = filterOrders(orders, { ...fl.filters, currency: currencyMode });
  const cur = currencyMode === "combined" ? "CAD (combined)" : currencyMode;
  const money = r => displayValue(r, currencyMode);

  let headers = [], rows = [], csvRows = [];
  if (rep === "salesrep") {
    // John's accounts for the chosen period, against the same dates a year earlier
    const shift = d => `${+d.slice(0, 4) - 1}${d.slice(4)}`;
    const mineNow = list.filter(o => o.cust.rep === SALES_REP);
    const minePrev = filterOrders(orders, { ...fl.filters, from: shift(fl.filters.from), to: shift(fl.filters.to), currency: currencyMode }).filter(o => o.cust.rep === SALES_REP);
    const g = groupBy(mineNow, "customer", opts), pg = new Map(groupBy(minePrev, "customer", opts).map(r => [r.key, r]));
    pg.forEach((r, k) => { if (!g.some(x => x.key === k)) g.push({ ...r, cad: 0, usd: 0, combined: 0, count: 0, prevOnly: true }); });
    const total = g.reduce((s, r) => s + money(r), 0), ptotal = minePrev.length ? [...pg.values()].reduce((s, r) => s + money(r), 0) : 0;
    const ch = (a, b) => (b ? `${a >= b ? "+" : "−"}${Math.abs(((a - b) / b) * 100).toFixed(0)}%` : a ? "new" : "");
    headers = ["Customer", "Type", "Orders", `Sales ${cur}`, "Sales same dates last year", "Change", "% of total"];
    rows = g.map(r => { const p = pg.get(r.key); const pv = p ? money(p) : 0; return [r.label, r.type, r.count, fmtMoney(money(r), 2), fmtMoney(pv, 2), ch(money(r), pv), total ? ((money(r) / total) * 100).toFixed(1) + "%" : ""]; });
    csvRows = g.map(r => { const p = pg.get(r.key); const pv = p ? money(p) : 0; return [r.label, r.type, r.count, money(r).toFixed(2), pv.toFixed(2), ch(money(r), pv), total ? ((money(r) / total) * 100).toFixed(1) : ""]; });
    rows.push(["Total", "", mineNow.length, fmtMoney(total, 2), fmtMoney(ptotal, 2), ch(total, ptotal), ""]);
  } else if (["customer", "product", "location", "type", "city"].includes(rep)) {
    const g = groupBy(list, rep, opts);
    const total = g.reduce((s, r) => s + money(r), 0);
    headers = [REPORTS.find(r => r[0] === rep)[1].replace("Sales by ", "").replace(/^\w/, c => c.toUpperCase()), ...(rep === "product" ? ["Description", "Qty"] : []), ...(rep === "customer" ? ["Held by", "Type"] : []), "Orders", `Sales ${cur}`, "% of total"];
    rows = g.map(r => [r.label, ...(rep === "product" ? [r.desc, fmtQty(r.qty)] : []), ...(rep === "customer" ? [r.rep, r.type] : []), r.count, fmtMoney(money(r), 2), total ? ((money(r) / total) * 100).toFixed(1) + "%" : ""]);
    csvRows = g.map(r => [r.label, ...(rep === "product" ? [r.desc, r.qty] : []), ...(rep === "customer" ? [r.rep, r.type] : []), r.count, money(r).toFixed(2), total ? ((money(r) / total) * 100).toFixed(1) : ""]);
    rows.push(["Total", ...(rep === "product" ? ["", ""] : []), ...(rep === "customer" ? ["", ""] : []), list.length, fmtMoney(total, 2), ""]);
  } else if (rep === "custprod") {
    const m = new Map();
    list.forEach(o => (o.lines || []).forEach(l => {
      const k = o.cust.key + "|" + l.sku;
      let r = m.get(k); if (!r) { r = { cust: o.cust.name, rep: o.cust.rep, sku: l.sku, desc: l.desc, qty: 0, cad: 0, usd: 0, combined: 0, orders: new Set(), last: "" }; m.set(k, r); }
      const c = orderCurrency(o); r.qty += l.qty || 0; if (c === "USD") r.usd += l.amount || 0; else r.cad += l.amount || 0;
      r.combined += c === "USD" ? (l.amount || 0) * opts.usdToCad : (l.amount || 0); r.orders.add(o.orderNo); if (o.date > r.last) r.last = o.date;
    }));
    const g = [...m.values()].sort((a, b) => a.cust.localeCompare(b.cust) || money(b) - money(a));
    headers = ["Customer", "Held by", "SKU", "Description", "Qty", "Orders", "Last ordered", `Sales ${cur}`];
    rows = g.map(r => [r.cust, r.rep, r.sku, r.desc, fmtQty(r.qty), r.orders.size, fmtDate(r.last), fmtMoney(money(r), 2)]);
    csvRows = g.map(r => [r.cust, r.rep, r.sku, r.desc, r.qty, r.orders.size, r.last, money(r).toFixed(2)]);
  } else if (rep === "monthly") {
    const pool = filterOrders(orders, { ...fl.filters, from: "", to: "", currency: currencyMode });
    headers = ["Month", `FY${fy} ${cur}`, `FY${fy - 1} ${cur}`, "Change", `FY${fy} orders`, `FY${fy - 1} orders`];
    let a = 0, b = 0;
    for (let i = 0; i < 12; i++) {
      const d = parseYmd(fyStart(fy)); d.setMonth(d.getMonth() + i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const pym = `${d.getFullYear() - 1}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const s1 = sumOrders(pool.filter(o => o.date.slice(0, 7) === ym), opts), s2 = sumOrders(pool.filter(o => o.date.slice(0, 7) === pym), opts);
      const v1 = money(s1), v2 = money(s2); a += v1; b += v2;
      const ch = v2 ? (((v1 - v2) / v2) * 100).toFixed(0) + "%" : "";
      rows.push([fmtMonth(ym + "-01"), fmtMoney(v1, 2), fmtMoney(v2, 2), ch, s1.count, s2.count]);
      csvRows.push([ym, v1.toFixed(2), v2.toFixed(2), ch, s1.count, s2.count]);
    }
    rows.push(["Total", fmtMoney(a, 2), fmtMoney(b, 2), b ? (((a - b) / b) * 100).toFixed(0) + "%" : "", "", ""]);
  } else if (rep === "inactive") {
    const last = new Map();
    orders.forEach(o => { const r = last.get(o.cust.key); if (!r || o.date > r.date) last.set(o.cust.key, { date: o.date, cust: o.cust }); });
    settings.accounts.forEach(a => { if (!last.has(a.name)) last.set(a.name, { date: "", cust: { key: a.name, name: a.name, rep: a.rep, type: a.type } }); });
    const fySum = new Map(groupBy(orders.filter(o => fyOf(o.date) === fyOf(today())), "customer", opts).map(r => [r.key, r]));
    const lastFy = new Map(groupBy(orders.filter(o => fyOf(o.date) === fyOf(today()) - 1), "customer", opts).map(r => [r.key, r]));
    const g = [...last.values()].filter(r => !r.date || daysBetween(r.date, today()) >= days)
      .filter(r => (fl.f.rep === "all" || r.cust.rep === fl.f.rep) && (fl.f.type === "all" || r.cust.type === fl.f.type))
      .sort((a, b) => (a.date || "0") < (b.date || "0") ? 1 : -1);
    headers = ["Customer", "Rep", "Type", "Last order", "Days since", "Sales this FY", "Sales last FY"];
    rows = g.map(r => [r.cust.name, r.cust.rep, r.cust.type, r.date ? fmtDate(r.date) : "No orders on file", r.date ? daysBetween(r.date, today()) : "", fySum.get(r.cust.key) ? fmtMoney(money(fySum.get(r.cust.key))) : "", lastFy.get(r.cust.key) ? fmtMoney(money(lastFy.get(r.cust.key))) : ""]);
    csvRows = g.map(r => [r.cust.name, r.cust.rep, r.cust.type, r.date, r.date ? daysBetween(r.date, today()) : "", fySum.get(r.cust.key) ? money(fySum.get(r.cust.key)).toFixed(2) : "", lastFy.get(r.cust.key) ? money(lastFy.get(r.cust.key)).toFixed(2) : ""]);
  }
  const fys = [...new Set([fyOf(today()), ...orders.map(o => fyOf(o.date))])].sort((a, b) => b - a);
  const title = REPORTS.find(r => r[0] === rep)[1];
  const custCol = (rep === "customer" || rep === "custprod" || rep === "inactive") ? 0 : -1;
  const keyFor = label => orders.find(o => o.cust.name === label)?.cust.key || label;

  return (
    <div style={{ display: "flex", gap: 16, maxWidth: 1500 }}>
      <div style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {REPORTS.map(([k, l]) => (
          <button key={k} onClick={() => setRep(k)} style={{ textAlign: "left", background: rep === k ? T.activeBg : "transparent", border: "none", borderLeft: `2px solid ${rep === k ? T.gold : "transparent"}`, color: rep === k ? T.text : T.subtext, padding: "8px 10px", fontSize: 12 }}>{l}</button>
        ))}
      </div>
      {rep === "yearend" ? <YearEndPicker T={T} orders={orders} settings={settings} opts={opts} logos={logos} bmpLogo={bmpLogo} openAccount={openAccount} /> :
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{title}</div>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={() => downloadCSV(`${rep}-report.csv`, headers, csvRows)}>Export CSV</button>
          <button className="btn" onClick={() => printReport(title, rep === "monthly" ? `Fiscal ${fy} vs ${fy - 1}` : rep === "inactive" ? `No orders in ${days}+ days` : `${fmtDate(fl.range[0])} – ${fmtDate(fl.range[1])}`, headers, rows)}>Print / PDF</button>
        </div>
        {rep === "monthly" ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <select value={fy} onChange={e => setFy(+e.target.value)} style={{ fontSize: 11, height: 28 }}>{fys.map(y => <option key={y} value={y}>Fiscal {y}</option>)}</select>
            <FilterBar T={T} orders={orders} fl={fl} show={["customer", "sku", "location", "rep", "type"]} />
          </div>
        ) : rep === "inactive" ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", fontSize: 12 }}>
            No orders in the last <input type="number" value={days} onChange={e => setDays(+e.target.value || 0)} style={{ width: 70, height: 28 }} /> days
            <select value={fl.f.rep} onChange={e => fl.setF(p => ({ ...p, rep: e.target.value }))} style={{ fontSize: 11, height: 28 }}><option value="all">All account holders</option>{REPS.map(r => <option key={r}>{r}</option>)}</select>
            <select value={fl.f.type} onChange={e => fl.setF(p => ({ ...p, type: e.target.value }))} style={{ fontSize: 11, height: 28 }}><option value="all">Distributors + End Users</option><option>Distributor</option><option>End User</option></select>
          </div>
        ) : <FilterBar T={T} orders={rep === "salesrep" ? orders.filter(o => o.cust.rep === SALES_REP) : orders} fl={fl} show={rep === "salesrep" ? ["customer", "sku", "location", "type"] : ["customer", "sku", "location", "rep", "type"]} />}
        <Card T={T} pad={0}>
          {!rows.length ? <div style={{ fontSize: 12, color: T.tableHeadText, padding: 12 }}>No data for these filters.</div> : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr>{headers.map((h, i) => <th key={i} style={{ textAlign: i > 0 && /Sales|Qty|Orders|%|Change|Days|FY/.test(h) ? "right" : "left" }}>{h}</th>)}</tr></thead>
                <tbody>{rows.map((r, i) => (
                  <tr key={i} style={{ fontWeight: r[0] === "Total" ? 600 : 400 }}>
                    {r.map((c, j) => <td key={j} onClick={j === custCol && r[0] !== "Total" ? () => openAccount(keyFor(c)) : undefined}
                      style={{ textAlign: j > 0 && /Sales|Qty|Orders|%|Change|Days|FY/.test(headers[j]) ? "right" : "left", cursor: j === custCol ? "pointer" : "default", fontVariantNumeric: "tabular-nums" }}>{c}</td>)}
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </Card>
      </div>}
    </div>
  );
}

// Pick customers and a fiscal year → one PDF with a "Year in Review" for each
function YearEndPicker({ T, orders, settings, opts, logos, bmpLogo, openAccount }) {
  const fys = [...new Set([fyOf(today()), ...orders.map(o => fyOf(o.date))])].sort((a, b) => b - a);
  const [fy, setFy] = useState(today() < `${fyOf(today())}-11-15` ? fyOf(today()) - 1 : fyOf(today()));
  const [typeF, setTypeF] = useState("Distributor");
  const [repF, setRepF] = useState("all");
  const [sel, setSel] = useState({});
  const rows = useMemo(() => {
    const m = new Map();
    orders.forEach(o => {
      let r = m.get(o.cust.key);
      if (!r) { r = { key: o.cust.key, name: o.cust.name, rep: o.cust.rep, type: o.cust.type, orders: [] }; m.set(o.cust.key, r); }
      r.orders.push(o);
    });
    return [...m.values()].map(r => ({ ...r, cur: sumOrders(r.orders.filter(o => fyOf(o.date) === fy), opts).combined, prev: sumOrders(r.orders.filter(o => fyOf(o.date) === fy - 1), opts).combined }))
      .filter(r => (r.cur || r.prev) && (typeF === "all" || r.type === typeF) && (repF === "all" || r.rep === repF))
      .sort((a, b) => b.cur - a.cur);
  }, [orders, fy, typeF, repF, opts]);
  const chosen = rows.filter(r => sel[r.key]);
  const make = list => openYearEndReport({ customers: list, fy, usdToCad: opts.usdToCad, logos, bmpLogo });
  const all = rows.length && chosen.length === rows.length;
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Year-End customer reports</div>
        <div style={{ flex: 1 }} />
        <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11, opacity: chosen.length ? 1 : .5 }} disabled={!chosen.length} onClick={() => make(chosen)}>Create PDF for {chosen.length || ""} selected</button>
      </div>
      <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 10, lineHeight: 1.5 }}>
        Each customer gets a "Year in Review": totals and month-by-month purchases vs the year before, top products, a page showing what they ordered more or less of, and their order history.
        The report opens in a new window — choose "Save as PDF" in the print dialog.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select value={fy} onChange={e => setFy(+e.target.value)} style={{ fontSize: 11, height: 28 }}>{fys.map(y => <option key={y} value={y}>Fiscal {y} (Dec {y - 1} – Nov {y})</option>)}</select>
        <select value={typeF} onChange={e => setTypeF(e.target.value)} style={{ fontSize: 11, height: 28 }}><option value="Distributor">Distributors</option><option value="End User">End Users</option><option value="all">Distributors + End Users</option></select>
        <select value={repF} onChange={e => setRepF(e.target.value)} style={{ fontSize: 11, height: 28 }}><option value="all">All account holders</option>{REPS.map(r => <option key={r}>{r}</option>)}</select>
      </div>
      <Card T={T} pad={0}>
        {!rows.length ? <div style={{ fontSize: 12, color: T.tableHeadText, padding: 12 }}>No customers with purchases in FY{fy} or FY{fy - 1}.</div> : (
          <table className="data-table">
            <thead><tr>
              <th style={{ width: 30 }}><input type="checkbox" checked={!!all} onChange={() => setSel(all ? {} : Object.fromEntries(rows.map(r => [r.key, true])))} /></th>
              <th>Customer</th><th>Held by</th><th style={{ textAlign: "right" }}>FY{fy} (CAD)</th><th style={{ textAlign: "right" }}>FY{fy - 1} (CAD)</th><th style={{ textAlign: "right" }}>Change</th><th></th>
            </tr></thead>
            <tbody>{rows.map(r => {
              const ch = r.prev ? ((r.cur - r.prev) / r.prev) * 100 : null;
              return (
                <tr key={r.key}>
                  <td><input type="checkbox" checked={!!sel[r.key]} onChange={() => setSel(p => ({ ...p, [r.key]: !p[r.key] }))} /></td>
                  <td><a style={{ cursor: "pointer" }} onClick={() => openAccount(r.key)}>{r.name}</a></td>
                  <td style={{ color: T.subtext }}>{r.rep}</td>
                  <td style={{ textAlign: "right" }}>{fmtMoney(r.cur)}</td><td style={{ textAlign: "right", color: T.subtext }}>{fmtMoney(r.prev)}</td>
                  <td style={{ textAlign: "right", color: ch == null ? T.tableHeadText : ch >= 0 ? "#5a9e5a" : "#c86a5a" }}>{ch == null ? "new" : `${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch).toFixed(0)}%`}</td>
                  <td><button className="btn" onClick={() => make([r])}>PDF</button></td>
                </tr>);
            })}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function printReport(title, sub, headers, rows) {
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<html><head><title>${esc(title)}</title><style>body{font-family:Helvetica,Arial,sans-serif;font-size:11px;padding:24px}h1{font-size:16px;margin:0}div{color:#777;margin:4px 0 14px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f2f2f0;font-size:10px;text-transform:uppercase}</style></head><body><h1>BMP Supplies — ${esc(title)}</h1><div>${esc(sub)} · printed ${new Date().toLocaleDateString("en-CA")}</div><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

// ═════════════════════════════════════════════════════════════════════════════
// Quote matches — orders that look like they came from a quote in the hub
// ═════════════════════════════════════════════════════════════════════════════
function QuoteMatchesView({ T, matches, settings, saveSettings, opts, quotes, updateQuoteStatus, openAccount, orders }) {
  const link = (m, markWon) => {
    if (markWon && m.quote.quoteStatus !== "won") updateQuoteStatus(m.quote, "won");
    saveSettings({ quoteLinks: { ...(settings.quoteLinks || {}), [m.order.orderNo]: String(m.quote.id) } });
  };
  const dismiss = m => saveSettings({ dismissedMatches: { ...(settings.dismissedMatches || {}), [`${m.order.orderNo}|${m.quote.id}`]: true } });
  const linked = Object.entries(settings.quoteLinks || {}).map(([no, qid]) => ({ order: orders.find(o => o.orderNo === no), quote: quotes.find(q => String(q.id) === qid), no }))
    .filter(x => x.order).sort((a, b) => (a.order.date < b.order.date ? 1 : -1));
  const unlink = no => saveSettings({ quoteLinks: { [no]: deleteField() } });
  const qTotal = q => (q.lineItems || []).reduce((s, li) => s + (parseFloat(li.unitPrice) || 0) * (parseInt(li.qty) || 0), 0);

  return (
    <div style={{ maxWidth: 1200, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 12, color: T.subtext, lineHeight: 1.5 }}>
        These orders look like they came from a quote in the Quote Maker — same customer, the same SKUs, and quoted before the order date.
        Mark the quote <b>Won</b> to keep Pipeline and Lead Tracking accurate, or dismiss it if it's not the same deal.
      </div>
      {!matches.length && <Empty T={T}>No possible quote matches right now.</Empty>}
      {matches.map(m => (
        <div key={m.order.orderNo + m.quote.id} style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 16, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", color: T.tableHeadText, letterSpacing: ".06em" }}>Order</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{m.order.orderNo} · <a style={{ cursor: "pointer" }} onClick={() => openAccount(m.order.cust.key)}>{m.order.cust.name}</a></div>
            <div style={{ fontSize: 11, color: T.subtext }}>{fmtDate(m.order.date)} · {fmtMoney(orderAmount(m.order, opts.includeFreight), 2)} {orderCurrency(m.order)}</div>
            <div style={{ fontSize: 11, color: T.tableHeadText }}>{(m.order.lines || []).map(l => `${l.sku} ×${fmtQty(l.qty)}`).join(", ")}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", color: T.tableHeadText, letterSpacing: ".06em" }}>Possible quote · {Math.round(m.score * 100)}% match</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{m.quote.quoteNum} · {m.quote.company || m.quote.name} <span className="pill" style={{ background: T.tag, color: T.tagText, border: `1px solid ${T.tagBorder}` }}>{m.quote.quoteStatus || "inprogress"}</span></div>
            <div style={{ fontSize: 11, color: T.subtext }}>{m.quoteDate ? fmtDate(m.quoteDate) : m.quote.savedDate} · {fmtMoney(qTotal(m.quote), 2)} {m.quote.currency || ""} · by {m.quote.savedBy || "—"}</div>
            <div style={{ fontSize: 11, color: T.tableHeadText }}>{m.reasons.join(" · ")}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button className="btn-gold" style={{ padding: "6px 12px", fontSize: 11 }} onClick={() => link(m, true)}>{m.quote.quoteStatus === "won" ? "Link (already Won)" : "Mark quote Won"}</button>
            <button className="btn" onClick={() => dismiss(m)}>Not a match</button>
          </div>
        </div>
      ))}
      {linked.length > 0 && (
        <Card T={T} title={`Linked orders & quotes (${linked.length})`} pad={0}>
          <table className="data-table">
            <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Quote</th><th>Quote status</th><th></th></tr></thead>
            <tbody>{linked.map(x => <tr key={x.no}><td>{x.no}</td><td>{fmtDate(x.order.date)}</td><td>{x.order.cust.name}</td><td>{x.quote ? `${x.quote.quoteNum} · ${x.quote.company || x.quote.name}` : "(quote deleted)"}</td><td>{x.quote?.quoteStatus || ""}</td><td><button className="btn-del" onClick={() => unlink(x.no)}>Unlink</button></td></tr>)}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Settings
// ═════════════════════════════════════════════════════════════════════════════
function SettingsView({ T, db, orders, settings, saveSettings, connected, setConnected, seenCount, loginName, openAccount, logos, gaps = [], issues = {} }) {
  const [folders, setFolders] = useState(settings.folders.join("\n"));
  const [since, setSince] = useState(settings.since);
  const [rate, setRate] = useState(settings.usdToCad);
  const withOrig = list => list.map(a => ({ ...a, _orig: a.name }));
  const [accts, setAccts] = useState(withOrig(settings.accounts));
  const [dirty, setDirty] = useState(false);
  const [logoFolder, setLogoFolder] = useState(settings.logoFolder || "");
  const [picker, setPicker] = useState(null); // "oc" | "logo" while the folder browser is open
  const [logoRun, setLogoRun] = useState(null); // { busy, text, unmatched }
  const runLogos = async () => {
    setLogoRun({ busy: true, text: "Reading the logo folder…" });
    try {
      const r = await syncLogos({ db, folder: logoFolder.trim() || settings.logoFolder, accounts: settings.accounts, aliases: settings.aliases,
        customerKeys: [...new Set(orders.map(o => o.cust.key))], logos,
        onProgress: p => setLogoRun({ busy: true, text: `Reading logos… ${p.done}/${p.total}` }) });
      setLogoRun({ busy: false, text: `${r.added} logo${r.added === 1 ? "" : "s"} added, ${r.skipped} already up to date${r.unmatched.length ? `, ${r.unmatched.length} file${r.unmatched.length === 1 ? "" : "s"} didn't match a customer` : ""}.`, unmatched: r.unmatched });
    } catch (e) {
      setLogoRun({ busy: false, text: /not_found/.test(e.message) ? "Logo folder not found — use 📁 Browse to pick it." : "Couldn't read the logo folder: " + String(e.message).slice(0, 160) });
    }
  };
  useEffect(() => { if (!dirty) setAccts(withOrig(settings.accounts)); }, [settings.accounts, dirty]);

  const unmatched = useMemo(() => {
    const m = new Map();
    orders.filter(o => !o.cust.matched).forEach(o => { const r = m.get(o.cust.key) || { key: o.cust.key, name: o.cust.name, n: 0, type: o.cust.type }; r.n++; m.set(o.cust.key, r); });
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [orders]);

  const upd = (i, patch) => { setDirty(true); setAccts(a => a.map((x, j) => (j === i ? { ...x, ...patch } : x))); };
  const saveAccts = async () => {
    const list = accts.filter(a => a.name.trim()).map(a => ({ ...a, name: a.name.trim() }));
    const names = list.map(a => a.name.toLowerCase());
    if (new Set(names).size !== names.length) return alert("Two accounts have the same name — please make them different.");
    await saveAccounts({ db, settings, saveSettings, logos, accounts: list.map(({ _orig, ...a }) => a), renames: list.filter(a => a._orig && a._orig !== a.name).map(a => [a._orig, a.name]) });
    setDirty(false);
  };
  const lbl = { fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: T.tableHeadText, marginBottom: 4 };

  return (
    <div style={{ maxWidth: 1100, display: "flex", flexDirection: "column", gap: 14 }}>
      <Card T={T} title="Dropbox">
        <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, marginBottom: 12 }}>
          <span style={{ color: connected ? "#5a9e5a" : "#c8a030" }}>●</span>
          {connected ? "Dropbox is connected on this computer." : "Dropbox isn't connected on this computer."}
          {connected ? <button className="btn" onClick={() => { disconnectDropbox(); setConnected(false); }}>Disconnect</button>
            : <button className="btn-gold" style={{ padding: "5px 12px", fontSize: 11 }} onClick={startDropboxAuth}>Connect Dropbox</button>}
        </div>
        <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 12, lineHeight: 1.5 }}>
          Only one person needs Dropbox connected for everyone to see the numbers — synced orders are shared with the whole team.
          Redirect URI to register in the Dropbox app settings: <code style={{ color: T.text }}>{redirectUri()}</code>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}>
          <div><div style={lbl}>Order confirmation folders (one per line, path inside Dropbox)</div>
            <textarea value={folders} onChange={e => setFolders(e.target.value)} rows={3} style={{ width: "100%", fontSize: 12 }} />
            {connected && <button className="btn" style={{ marginTop: 4 }} onClick={() => setPicker("oc")}>📁 Browse Dropbox to add a folder…</button>}
            <div style={{ ...lbl, marginTop: 10 }}>Customer logo folder (file names matched to customer names)</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={logoFolder} onChange={e => setLogoFolder(e.target.value)} style={{ flex: 1, height: 28, fontSize: 12 }} />
              {connected && <button className="btn" onClick={() => setPicker("logo")}>📁 Browse…</button>}
              {connected && <button className="btn" disabled={logoRun?.busy} onClick={runLogos}>Sync logos now</button>}
            </div>
            {logoRun && <div style={{ fontSize: 11, color: T.subtext, marginTop: 6, lineHeight: 1.5 }}>
              {logoRun.text}
              {logoRun.unmatched?.length > 0 && <details style={{ marginTop: 2 }}><summary style={{ cursor: "pointer" }}>Files that didn't match — rename the file to the customer's account name, or upload the logo on the customer's page</summary>
                <div style={{ color: T.tableHeadText }}>{logoRun.unmatched.join(" · ")}</div></details>}
            </div>}</div>
          <div><div style={lbl}>Read orders dated on or after</div>
            <input type="date" value={since} onChange={e => setSince(e.target.value)} style={{ height: 28, fontSize: 12 }} />
            <div style={{ fontSize: 10, color: T.tableHeadText, marginTop: 4 }}>Quick pick (saves right away):</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3 }}>
              {[2024, 2025, 2026].map(y => {
                const d = `${y - 1}-12-01`;
                return <button key={y} className="btn" style={{ padding: "3px 8px", fontSize: 10, borderColor: since === d ? T.gold : undefined }}
                  onClick={() => { setSince(d); saveSettings({ since: d }); }}>From FY{y}</button>;
              })}
            </div>
            <div style={{ fontSize: 10, color: T.tableHeadText, marginTop: 4 }}>Saved: {fmtDate(settings.since)}</div></div>
          <div><div style={lbl}>USD → CAD rate (for combined totals)</div>
            <input type="number" step="0.0001" value={rate} onChange={e => setRate(e.target.value)} style={{ height: 28, fontSize: 12, width: 100 }} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <button className="btn" onClick={() => saveSettings({ folders: folders.split("\n").map(s => s.trim()).filter(Boolean), logoFolder: logoFolder.trim(), since, usdToCad: Number(rate) || 1.37 })}>Save</button>
          <span style={{ fontSize: 11, color: T.tableHeadText }}>{orders.length} orders on file · {seenCount} PDFs read so far</span>
          <div style={{ flex: 1 }} />
          <button className="btn-del" onClick={() => { if (confirm("Re-read every PDF on the next Refresh? Corrections you've made are kept.")) setDoc(doc(db, "config", "salesSyncSeen"), { files: {} }); }}>Re-read all PDFs on next refresh</button>
        </div>
      </Card>

      {picker && <FolderPicker T={T} title={picker === "oc" ? "Pick an Order Confirmations folder" : "Pick the Customer Logos folder"}
        onClose={() => setPicker(null)}
        onPick={path => {
          // picked folders are saved straight away so the next Refresh uses them
          if (picker === "oc") {
            const list = [...folders.split("\n").map(x => x.trim()).filter(Boolean), path].filter((x, i, a) => a.indexOf(x) === i);
            setFolders(list.join("\n")); saveSettings({ folders: list });
          } else { setLogoFolder(path); saveSettings({ logoFolder: path }); }
          setPicker(null);
        }} />}

      <Card T={T} title={`Missing order numbers (${gaps.length})`} right={
        Object.keys(issues).length > 0 && <button className="btn" onClick={() => setDoc(doc(db, "config", "salesSyncSeen"), { files: Object.fromEntries(Object.keys(issues).map(id => [id, deleteField()])) }, { merge: true }).then(() => alert("Those PDFs will be tried again on the next Refresh."))}>Retry problem PDFs on next refresh</button>}>
        <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 8 }}>
          BRO and CAL numbers between the first and latest order on file that the hub doesn't have. If a number was cancelled or never used, mark it "Not used" and it won't be flagged again.
        </div>
        {!gaps.length ? <div style={{ fontSize: 12, color: "#5a9e5a" }}>✓ No gaps — every BRO and CAL number up to the latest one is here.</div> : (
          <table className="data-table">
            <thead><tr><th>Order #</th><th>Between</th><th>Why it's missing</th><th></th></tr></thead>
            <tbody>{gaps.slice(0, 300).map(g => (
              <tr key={g.no}>
                <td style={{ fontWeight: 600 }}>{g.no}</td>
                <td style={{ color: T.subtext, whiteSpace: "nowrap" }}>{g.between}</td>
                <td style={{ color: g.file ? "#c86a5a" : T.subtext }}>{g.reason}{g.file && <div style={{ fontSize: 10, color: T.tableHeadText, wordBreak: "break-all" }}>{g.file}</div>}</td>
                <td><button className="btn" onClick={() => saveSettings({ voidNumbers: { [g.no]: true } })}>Not used</button></td>
              </tr>))}</tbody>
          </table>
        )}
      </Card>

      {unmatched.length > 0 && (
        <Card T={T} title={`Customers not on any account list (${unmatched.length})`}>
          <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 8 }}>These are treated as unassigned End Users. Click one to assign it to an account or change its type.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {unmatched.map(u => <button key={u.key} className="btn" onClick={() => openAccount(u.key)}>{u.name} <span style={{ color: T.tableHeadText }}>· {u.n} · {u.type}</span></button>)}
          </div>
        </Card>
      )}

      <Card T={T} title="Customer accounts" right={<div style={{ display: "flex", gap: 6 }}>
        <button className="btn" onClick={() => { setDirty(true); setAccts([{ name: "", rep: "Unassigned", type: "Distributor", terms: [] }, ...accts]); }}>+ Add account</button>
        <button className="btn-gold" style={{ padding: "5px 14px", fontSize: 11, opacity: dirty ? 1 : .5 }} disabled={!dirty} onClick={saveAccts}>Save accounts</button>
      </div>}>
        <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 8 }}>"Also matches" are other spellings that appear on OCs (comma separated). The longest match wins, so "Core and Main Earth Savers" goes to Earth Savers, not Core and Main.</div>
        <table className="data-table">
          <thead><tr><th>Account</th><th>Held by</th><th>Type</th><th>Also matches</th><th></th></tr></thead>
          <tbody>{accts.map((a, i) => (
            <tr key={i}>
              <td><input value={a.name} onChange={e => upd(i, { name: e.target.value })} style={{ width: "100%", height: 24, fontSize: 12 }} /></td>
              <td><select value={a.rep} onChange={e => upd(i, { rep: e.target.value })} style={{ height: 24, fontSize: 11 }}>{REPS.map(r => <option key={r}>{r}</option>)}</select></td>
              <td><select value={a.type} onChange={e => upd(i, { type: e.target.value })} style={{ height: 24, fontSize: 11 }}><option>Distributor</option><option>End User</option></select></td>
              <td><input value={(a.terms || []).join(", ")} onChange={e => upd(i, { terms: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} style={{ width: "100%", height: 24, fontSize: 11 }} /></td>
              <td><button className="btn-del" onClick={() => { setDirty(true); setAccts(accts.filter((_, j) => j !== i)); }}>×</button></td>
            </tr>))}</tbody>
        </table>
      </Card>

    </div>
  );
}

// BRO/CAL numbers missing between the first and latest order on file, with the likeliest reason
function findGaps(rawOrders, issues, settings, listing) {
  const voided = settings.voidNumbers || {};
  const since = settings.since || "";
  const issueList = Object.values(issues || {});
  const out = [];
  for (const prefix of ["BRO", "CAL"]) {
    // Only orders in the synced date range; a stray early number would otherwise flag hundreds of older orders
    const have = new Map(rawOrders.filter(o => o.orderNo?.startsWith(prefix) && (!o.date || o.date >= since)).map(o => [+o.orderNo.slice(3), o]));
    if (have.size < 2) continue;
    const nums = [...have.keys()].sort((a, b) => a - b);
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] > 200) continue; // a jump this big is a numbering change, not missing orders
      for (let n = nums[i - 1] + 1; n < nums[i]; n++) {
        const no = prefix + n;
        if (voided[no]) continue;
        const named = listing ? listing[no] : undefined;
        if (named && named !== "?" && named < since) continue; // its PDF is dated before the start date — not missing
        const iss = issueList.find(x => x.name && x.name.toUpperCase().replace(/[\s_-]/g, "").includes(no));
        const a = have.get(nums[i - 1]), b = have.get(nums[i]);
        out.push({
          no, between: `${a.orderNo} (${fmtShort(a.date || "")}) – ${b.orderNo} (${fmtShort(b.date || "")})`,
          reason: iss ? iss.reason
            : named ? `PDF found${named !== "?" ? ` (dated ${fmtDate(named)})` : ""} but not synced yet — click ↻ Refresh. If it's still here after a Refresh, click Retry problem PDFs.`
            : listing ? "No PDF with this number in the Dropbox folders (not saved yet, misnamed, or in another folder)"
            : "Not found — click Refresh so the hub can check the folders",
          file: iss?.path || "",
        });
      }
    }
  }
  return out;
}

// Browse the folders the hub can see in Dropbox and pick one
function FolderPicker({ T, title, onPick, onClose }) {
  const [path, setPath] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [who, setWho] = useState(null);
  useEffect(() => { accountInfo().then(setWho); }, []);
  useEffect(() => {
    let live = true;
    setData(null); setErr("");
    browseFolder(path).then(d => live && setData(d)).catch(e => live && setErr(String(e.message).slice(0, 200)));
    return () => { live = false; };
  }, [path]);
  const parts = path.split("/").filter(Boolean);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{title}</div>
        {who && <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 10 }}>Signed in to Dropbox as {who.name?.display_name} ({who.email}){who.team ? ` · team: ${who.team.name}` : ""}</div>}
        <div style={{ fontSize: 12, marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
          <a style={{ cursor: "pointer", color: T.gold }} onClick={() => setPath("")}>Dropbox</a>
          {parts.map((p, i) => <span key={i}> / <a style={{ cursor: "pointer", color: T.gold }} onClick={() => setPath("/" + parts.slice(0, i + 1).join("/"))}>{p}</a></span>)}
        </div>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 2, height: 320, overflowY: "auto", background: T.panelBg }}>
          {err ? <div style={{ padding: 12, fontSize: 12, color: "#c86a5a" }}>{err}</div>
            : !data ? <div style={{ padding: 12, fontSize: 12, color: T.tableHeadText }}>Loading…</div>
            : !data.folders.length ? <div style={{ padding: 12, fontSize: 12, color: T.tableHeadText, lineHeight: 1.5 }}>
                No folders here{data.files ? ` (${data.files} files)` : ""}.
                {!path && <><br /><br />If you expected to see your Dropbox folders, the Dropbox app is probably set to <b>App folder</b> access. In dropbox.com/developers/apps, create the app again with <b>Full Dropbox</b> access, tick files.metadata.read and files.content.read, add the same redirect URIs, and send me the new App key.</>}
              </div>
            : data.folders.map(f => (
              <div key={f.path} onClick={() => setPath(f.path)} style={{ padding: "7px 12px", fontSize: 12, cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                onMouseOver={e => e.currentTarget.style.background = T.rowHover} onMouseOut={e => e.currentTarget.style.background = "transparent"}>📁 {f.name}</div>
            ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.tableHeadText, flex: 1 }}>{data && path ? `${data.folders.length} folders · ${data.files} files in this folder` : ""}</span>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11, opacity: path ? 1 : .5 }} disabled={!path} onClick={() => onPick(path)}>Use this folder</button>
        </div>
      </div>
    </div>
  );
}

// ── Small shared pieces ──────────────────────────────────────────────────────
function Card({ T, title, right, children, pad = 14, style }) {
  return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, ...style }}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: T.tableHeadText, fontWeight: 600 }}>{title}</div>
          <div style={{ flex: 1 }} />{right}
        </div>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}
function Legend({ T, items }) {
  return <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.subtext }}>{items.map(([c, l]) => <span key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />{l}</span>)}</div>;
}
function Empty({ T, children }) {
  return <div style={{ textAlign: "center", padding: "60px 20px", color: T.tableHeadText, fontSize: 12 }}>{children}</div>;
}
function timeAgo(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
