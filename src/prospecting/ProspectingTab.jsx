// ─── Prospecting (Paul, Mark, Grant, Jeff — Users & Access → Prospecting) ─────
// Summary strip, filterable/sortable list, detail drawer with timeline, bulk actions, CSV in/out,
// and the Grok bot page (switches, recent results, the instructions to paste into the bot).
import { useMemo, useRef, useState } from "react";
import { Loader } from "../Loader";
import * as R from "./rules";
import { botGuide, curlExamples } from "./botGuide";

const fmtDate = iso => { if (!iso) return "—"; const d = new Date(String(iso).length === 10 ? iso + "T12:00:00" : iso); return isNaN(d) ? iso : d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }); };
const fmtWhen = iso => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); };
const who = n => n === "api" ? "Grok bot" : n || "—";

function Badge({ status }) {
  const c = R.STATUS_COLOR[status] || "#888";
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600, background: c + "22", color: c, border: `1px solid ${c}55`, whiteSpace: "nowrap" }}>{R.STATUS_LABEL[status] || status}</span>;
}
const FIT_COLOR = { strong: "#34c77b", maybe: "#e8a23a", weak: "#8a8f98" };

export default function ProspectingTab({ T, pro, section, loginName, owners, onOpenCustomer, onOpenLead }) {
  if (pro.loading) return <Loader T={T} label="Loading prospects…" />;
  return section === "bot" ? <BotPage T={T} pro={pro} /> : <ProspectList T={T} pro={pro} loginName={loginName} owners={owners} onOpenCustomer={onOpenCustomer} onOpenLead={onOpenLead} />;
}

// ── The list ─────────────────────────────────────────────────────────────────
function ProspectList({ T, pro, loginName, owners, onOpenCustomer, onOpenLead }) {
  const { prospects, activities, actions } = pro;
  const [q, setQ] = useState(""), [fStatus, setFStatus] = useState(""), [fFit, setFFit] = useState(""), [fChan, setFChan] = useState(""), [fOwner, setFOwner] = useState("");
  const [showConv, setShowConv] = useState(true);
  const [sort, setSort] = useState({ k: "updated_at", d: -1 });
  const [sel, setSel] = useState(new Set());
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false), [importing, setImporting] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const t = R.today();
  const sum = useMemo(() => R.summarize(prospects, activities), [prospects, activities]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    let l = prospects.filter(p =>
      (!fStatus || (fStatus === "overdue" ? R.isOverdue(p, t) : fStatus === "dnc" ? p.do_not_contact : p.status === fStatus)) &&
      (!fFit || p.icp_fit === fFit) && (!fChan || p.channel === fChan) && (!fOwner || (p.owner || "") === (fOwner === "—" ? "" : fOwner)) &&
      (showConv || !p.converted_lead_id) &&
      (!s || [R.fullName(p), p.title, p.company_name, p.email, p.region, p.city, p.notes, p.fit_reason, p.linkedin_url].some(v => String(v || "").toLowerCase().includes(s))));
    const val = p => sort.k === "name" ? R.fullName(p).toLowerCase() : sort.k === "status" ? R.STATUSES.indexOf(p.status) : sort.k === "touch_count" ? p.touch_count || 0
      : sort.k === "icp_fit" ? R.FITS.indexOf(p.icp_fit) : String(p[sort.k] || "").toLowerCase();
    return [...l].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.d; });
  }, [prospects, q, fStatus, fFit, fChan, fOwner, showConv, sort, t]);

  const open = prospects.find(p => p.id === openId);
  const selected = prospects.filter(p => sel.has(p.id));
  const doBulk = async change => { const errs = await actions.bulk(selected, change); setBulkMsg(errs.length ? `${selected.length - errs.length} changed. Not changed: ${errs.join(" · ")}` : `${selected.length} changed.`); };
  const exportCSV = () => {
    const blob = new Blob(["﻿" + R.toCSV(shown)], { type: "text/csv" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `BMP Prospects ${t}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const th = k => ({ onClick: () => setSort(s => ({ k, d: s.k === k ? -s.d : k === "updated_at" ? -1 : 1 })), style: { cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" } });
  const arrow = k => sort.k === k ? (sort.d > 0 ? " ▲" : " ▼") : "";
  const exCount = prospects.filter(p => p.example).length;
  const tile = (label, v, sub, onClick, warn) => (
    <div onClick={onClick} style={{ background: T.cardBg, border: `1px solid ${warn && v ? "#e8472c88" : T.border}`, borderRadius: 3, padding: "8px 12px", minWidth: 110, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 10, color: T.tableHeadText, letterSpacing: ".04em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: warn && v ? "#e8472c" : T.text, fontVariantNumeric: "tabular-nums" }}>{v}</div>
      {sub && <div style={{ fontSize: 10, color: T.tableHeadText }}>{sub}</div>}
    </div>);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
      {/* Summary strip */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tile("First touches", sum.firstWeek, `this week · ${sum.firstMonth} this month`)}
        {tile("Replies", sum.repliesMonth, `this month · ${sum.replies} all time`, () => setFStatus("replied"))}
        {tile("Meetings", sum.meetingsMonth, `this month · ${sum.meetings} all time`, () => setFStatus("meeting"))}
        {tile("Converted to leads", sum.conversionsMonth, `this month · ${sum.conversions} all time`)}
        {tile("Overdue follow-ups", sum.overdue, "click to show", () => setFStatus("overdue"), true)}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" style={{ fontSize: 11, padding: "3px 10px", ...(fStatus === "" ? { borderColor: T.gold, color: T.gold } : {}) }} onClick={() => setFStatus("")}>All {sum.total}</button>
        {R.STATUSES.map(s => <button key={s} className="btn" onClick={() => setFStatus(fStatus === s ? "" : s)}
          style={{ fontSize: 11, padding: "3px 10px", ...(fStatus === s ? { borderColor: R.STATUS_COLOR[s], color: R.STATUS_COLOR[s] } : {}) }}>
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4, background: R.STATUS_COLOR[s], marginRight: 5 }} />{R.STATUS_LABEL[s]} <b>{sum.byStatus[s] || 0}</b></button>)}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, company, email, notes…" style={{ width: 260, height: 30, fontSize: 12 }} />
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ height: 30, fontSize: 12 }}>
          <option value="">Every status</option>{R.STATUSES.map(s => <option key={s} value={s}>{R.STATUS_LABEL[s]}</option>)}
          <option value="overdue">Overdue follow-ups</option><option value="dnc">Do not contact</option>
        </select>
        <select value={fFit} onChange={e => setFFit(e.target.value)} style={{ height: 30, fontSize: 12 }}><option value="">Any fit</option>{R.FITS.map(f => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)} fit</option>)}</select>
        <select value={fChan} onChange={e => setFChan(e.target.value)} style={{ height: 30, fontSize: 12 }}><option value="">Any channel</option>{R.CHANNELS.map(c => <option key={c} value={c}>{R.CHANNEL_LABEL[c]}</option>)}</select>
        <select value={fOwner} onChange={e => setFOwner(e.target.value)} style={{ height: 30, fontSize: 12 }}><option value="">Any owner</option>{owners.map(o => <option key={o}>{o}</option>)}<option value="—">No owner</option></select>
        <label style={{ fontSize: 11, color: T.subtext, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={showConv} onChange={e => setShowConv(e.target.checked)} />Show converted</label>
        <div style={{ flex: 1 }} />
        {exCount > 0 && <button className="btn" title="Remove the 5 example prospects" onClick={() => confirm(`Delete the ${exCount} example prospects?`) && actions.deleteExamples()}>Delete examples ({exCount})</button>}
        <button className="btn" onClick={() => setImporting(true)}>Import CSV</button>
        <button className="btn" onClick={exportCSV} title="Exports the prospects shown">Export CSV</button>
        <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} onClick={() => setAdding(true)}>+ Add prospect</button>
      </div>

      {/* Bulk actions */}
      {sel.size > 0 && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: T.activeBg, border: `1px solid ${T.borderLight}`, padding: "6px 10px", borderRadius: 3, fontSize: 12 }}>
        <b>{sel.size} selected</b>
        <select value="" onChange={e => e.target.value && doBulk({ status: e.target.value })} style={{ height: 28, fontSize: 12 }}><option value="">Change status…</option>{R.STATUSES.map(s => <option key={s} value={s}>{R.STATUS_LABEL[s]}</option>)}</select>
        <select value="" onChange={e => e.target.value && doBulk({ owner: e.target.value === "—" ? "" : e.target.value })} style={{ height: 28, fontSize: 12 }}><option value="">Set owner…</option>{owners.map(o => <option key={o}>{o}</option>)}<option value="—">No owner</option></select>
        <button className="btn" onClick={() => doBulk({ do_not_contact: true })}>Mark do-not-contact</button>
        <button className="btn" onClick={() => { setSel(new Set()); setBulkMsg(""); }}>Clear</button>
        {bulkMsg && <span style={{ color: T.subtext, fontSize: 11 }}>{bulkMsg}</span>}
      </div>}

      {/* Table */}
      <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, background: T.cardBg }}>
        <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
          <thead><tr>
            <th style={{ width: 28 }}><input type="checkbox" checked={shown.length > 0 && shown.every(p => sel.has(p.id))} onChange={e => setSel(e.target.checked ? new Set(shown.map(p => p.id)) : new Set())} /></th>
            <th {...th("name")}>Name{arrow("name")}</th><th {...th("company_name")}>Company{arrow("company_name")}</th><th {...th("region")}>Region{arrow("region")}</th>
            <th {...th("icp_fit")}>Fit{arrow("icp_fit")}</th><th {...th("channel")}>Channel{arrow("channel")}</th><th {...th("status")}>Status{arrow("status")}</th>
            <th {...th("touch_count")}>Touches{arrow("touch_count")}</th><th {...th("last_touch_at")}>Last touch{arrow("last_touch_at")}</th><th {...th("next_touch_at")}>Next touch{arrow("next_touch_at")}</th>
            <th {...th("owner")}>Owner{arrow("owner")}</th><th {...th("updated_at")}>Updated{arrow("updated_at")}</th>
          </tr></thead>
          <tbody>
            {shown.map(p => {
              const od = R.isOverdue(p, t);
              return <tr key={p.id} onClick={() => setOpenId(p.id)} style={{ cursor: "pointer", opacity: p.converted_lead_id || p.do_not_contact ? .6 : 1, background: p.id === openId ? T.activeBg : undefined }}>
                <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.has(p.id)} onChange={e => { const n = new Set(sel); e.target.checked ? n.add(p.id) : n.delete(p.id); setSel(n); }} /></td>
                <td><div style={{ fontWeight: 600 }}>{R.fullName(p) || "—"}{p.example && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", border: `1px dashed ${T.gold}`, color: T.gold, borderRadius: 2 }}>EXAMPLE</span>}{p.do_not_contact && <span title="Do not contact" style={{ marginLeft: 6, color: "#e8472c" }}>⛔</span>}</div>
                  <div style={{ fontSize: 10, color: T.tableHeadText }}>{p.title}</div></td>
                <td>{p.company_name}{p.company_type && <div style={{ fontSize: 10, color: T.tableHeadText }}>{p.company_type}</div>}</td>
                <td>{[p.city, p.region].filter(Boolean).join(", ")}</td>
                <td><span style={{ color: FIT_COLOR[p.icp_fit], fontWeight: 600, textTransform: "capitalize" }}>{p.icp_fit}</span></td>
                <td>{R.CHANNEL_LABEL[p.channel] || p.channel}</td>
                <td><Badge status={p.status} />{p.converted_lead_id && <div style={{ fontSize: 10, color: "#1f9d55", marginTop: 2 }}>→ Lead</div>}</td>
                <td style={{ textAlign: "center" }}>{p.touch_count || 0}/{R.MAX_TOUCHES}</td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDate(p.last_touch_at)}</td>
                <td style={{ whiteSpace: "nowrap", color: od ? "#e8472c" : undefined, fontWeight: od ? 700 : 400 }}>{p.next_touch_at ? fmtDate(p.next_touch_at) : "—"}{od && " ⚠"}</td>
                <td>{p.owner || "—"}</td>
                <td style={{ whiteSpace: "nowrap", color: T.tableHeadText }}>{fmtDate(p.updated_at)}</td>
              </tr>;
            })}
            {!shown.length && <tr><td colSpan={12} style={{ padding: 20, textAlign: "center", color: T.tableHeadText }}>{prospects.length ? "No prospects match these filters." : "No prospects yet — add one, import a CSV, or let the Grok bot send some."}</td></tr>}
          </tbody>
        </table>
      </div>

      {open && <Drawer T={T} p={open} pro={pro} owners={owners} close={() => setOpenId(null)} onOpenLead={onOpenLead} />}
      {adding && <AddModal T={T} pro={pro} owners={owners} loginName={loginName} close={() => setAdding(false)} openExisting={id => { setAdding(false); setOpenId(id); }} onOpenCustomer={onOpenCustomer} onOpenLead={onOpenLead} />}
      {importing && <ImportModal T={T} pro={pro} close={() => setImporting(false)} />}
    </div>
  );
}

// ── Where a blocked prospect already is ──────────────────────────────────────
function BlockNote({ T, block, onOpenCustomer, onOpenLead }) {
  if (!block) return null;
  return <div style={{ background: "#e8472c18", border: "1px solid #e8472c55", borderRadius: 3, padding: "8px 10px", fontSize: 12, color: T.text }}>
    ⛔ <b>{block.name}</b> is already {block.kind === "customer" ? "a customer" : "an open lead"} — not added.{" "}
    <button className="btn" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => block.kind === "customer" ? onOpenCustomer(block.key) : onOpenLead(block.id)}>
      {block.kind === "customer" ? "Open the customer →" : "Open the lead →"}</button>
  </div>;
}

// ── Fields (shared by Add and the drawer) ────────────────────────────────────
function Fields({ T, v, set, owners, readOnly }) {
  const inp = (f, w) => <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 10, color: T.tableHeadText, gridColumn: w ? `span ${w}` : undefined }}>
    {R.FIELD_LABEL[f]}<input disabled={readOnly} value={v[f] ?? ""} onChange={e => set({ [f]: e.target.value })} style={{ height: 28, fontSize: 12 }} /></label>;
  const sel = (f, list, labels) => <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 10, color: T.tableHeadText }}>
    {R.FIELD_LABEL[f]}<select disabled={readOnly} value={v[f] ?? ""} onChange={e => set({ [f]: e.target.value })} style={{ height: 28, fontSize: 12 }}>{list.map(x => <option key={x} value={x}>{labels ? labels[x] || x || "—" : x}</option>)}</select></label>;
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
    {inp("first_name")}{inp("last_name")}{inp("title")}{inp("company_name")}{inp("company_website")}{inp("company_type")}{inp("city")}{inp("region")}
    {inp("email")}{inp("phone")}{inp("linkedin_url")}{inp("x_handle")}
    {sel("icp_fit", R.FITS, { strong: "Strong", maybe: "Maybe", weak: "Weak" })}{sel("channel", R.CHANNELS, R.CHANNEL_LABEL)}
    {sel("owner", ["", ...owners])}
    <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: v.do_not_contact ? "#e8472c" : T.subtext, paddingTop: 14 }}>
      <input type="checkbox" disabled={readOnly} checked={!!v.do_not_contact} onChange={e => set({ do_not_contact: e.target.checked })} />Do not contact</label>
    <label style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 2, fontSize: 10, color: T.tableHeadText }}>{R.FIELD_LABEL.fit_reason}
      <input disabled={readOnly} value={v.fit_reason ?? ""} onChange={e => set({ fit_reason: e.target.value })} style={{ height: 28, fontSize: 12 }} /></label>
    <label style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 2, fontSize: 10, color: T.tableHeadText }}>Notes
      <textarea disabled={readOnly} value={v.notes ?? ""} onChange={e => set({ notes: e.target.value })} rows={3} style={{ fontSize: 12, resize: "vertical" }} /></label>
  </div>;
}

// ── Add one ──────────────────────────────────────────────────────────────────
function AddModal({ T, pro, owners, loginName, close, openExisting, onOpenCustomer, onOpenLead }) {
  const [v, setV] = useState(R.blankProspect({ owner: owners.includes(loginName) ? loginName : "" }));
  const [res, setRes] = useState(null);
  const set = c => { setV(x => ({ ...x, ...c })); setRes(null); };
  const save = async force => { const r = await pro.actions.add(v, { force }); if (r.error) setRes(r); else close(); };
  // Warn as they type, before saving
  const live = useMemo(() => ({ block: R.findBlock(v.company_name, pro.ctx), dup: R.findDuplicate(v, pro.prospects) }), [v, pro.ctx, pro.prospects]);
  return <Modal T={T} title="Add a prospect" close={close}>
    <Fields T={T} v={v} set={set} owners={owners} />
    <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 10, color: T.tableHeadText, marginTop: 8 }}>Source links (one per line)
      <textarea value={(v.source_urls || []).join("\n")} onChange={e => set({ source_urls: e.target.value.split("\n") })} rows={2} style={{ fontSize: 12 }} /></label>
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
      <BlockNote T={T} block={live.block} onOpenCustomer={onOpenCustomer} onOpenLead={onOpenLead} />
      {!live.block && live.dup && <div style={{ background: "#e8a23a18", border: "1px solid #e8a23a66", borderRadius: 3, padding: "8px 10px", fontSize: 12 }}>
        ⚠ Possible duplicate: <b>{R.fullName(live.dup.match) || live.dup.match.company_name}</b> ({live.dup.match.company_name}) has the same {live.dup.by}.{" "}
        <button className="btn" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => openExisting(live.dup.match.id)}>Open it</button></div>}
      {res?.error && !res.block && !res.duplicate && <div style={{ color: "#e8472c", fontSize: 12 }}>{res.error}</div>}
    </div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
      <button className="btn" onClick={close}>Cancel</button>
      {live.dup && !live.block ? <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} onClick={() => save(true)}>Add anyway</button>
        : <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11, opacity: live.block ? .4 : 1 }} disabled={!!live.block} onClick={() => save(false)}>Add prospect</button>}
    </div>
  </Modal>;
}

// ── CSV import ───────────────────────────────────────────────────────────────
function ImportModal({ T, pro, close }) {
  const [rows, setRows] = useState(null), [dupsToo, setDupsToo] = useState(false), [msg, setMsg] = useState("");
  const file = useRef(null);
  const read = async f => {
    const raws = R.csvToProspects(await f.text());
    if (!raws.length) { setMsg("No rows found — the first row should be the column names (First name, Last name, Company, Email…)."); return; }
    setMsg(""); setRows(raws);
  };
  const checked = useMemo(() => rows ? pro.actions.previewImport(rows, dupsToo) : null, [rows, dupsToo, pro.prospects, pro.ctx]); // eslint-disable-line
  const ok = checked?.filter(r => !r.result.error) || [];
  const go = async () => { const n = await pro.actions.importRows(checked); setMsg(`Added ${n} prospect${n === 1 ? "" : "s"}.`); setRows(null); if (file.current) file.current.value = ""; };
  return <Modal T={T} title="Import prospects from CSV" close={close} wide>
    <div style={{ fontSize: 12, color: T.subtext, lineHeight: 1.6, marginBottom: 8 }}>
      First row = column names. Understood: {R.FIELDS.filter(f => !["touch_count", "last_touch_at", "next_touch_at"].includes(f)).map(f => R.FIELD_LABEL[f]).join(", ")} (or one "Name" column).
      Duplicates (same email, LinkedIn, or name + company) are skipped unless you tick below; customers and open leads are never added. An exported file can be re-imported.
    </div>
    <input ref={file} type="file" accept=".csv,text/csv" onChange={e => e.target.files[0] && read(e.target.files[0])} />
    {msg && <div style={{ marginTop: 8, fontSize: 12, color: T.text }}>{msg}</div>}
    {checked && <>
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, margin: "10px 0" }}><input type="checkbox" checked={dupsToo} onChange={e => setDupsToo(e.target.checked)} />Add possible duplicates too</label>
      <div style={{ maxHeight: 340, overflow: "auto", border: `1px solid ${T.border}` }}>
        <table className="data-table" style={{ width: "100%", fontSize: 11 }}><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Result</th></tr></thead>
          <tbody>{checked.map((r, i) => { const c = R.cleanProspect(r.raw); return <tr key={i}>
            <td>{R.fullName(c) || "—"}</td><td>{c.company_name}</td><td>{c.email}</td>
            <td style={{ color: r.result.error ? (r.result.block ? "#e8472c" : "#e8a23a") : "#34c77b" }}>{r.result.error ? r.result.error : "Will add"}</td></tr>; })}</tbody></table>
      </div>
    </>}
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
      <button className="btn" onClick={close}>Close</button>
      {checked && <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11, opacity: ok.length ? 1 : .4 }} disabled={!ok.length} onClick={go}>Add {ok.length} prospect{ok.length === 1 ? "" : "s"}</button>}
    </div>
  </Modal>;
}

// ── Detail drawer ────────────────────────────────────────────────────────────
function Drawer({ T, p, pro, owners, close, onOpenLead }) {
  const ro = R.isReadOnly(p);
  const [v, setV] = useState(p), [dirty, setDirty] = useState(false), [err, setErr] = useState(""), [saved, setSaved] = useState("");
  const [lastId, setLastId] = useState(p.id);
  if (lastId !== p.id) { setLastId(p.id); setV(p); setDirty(false); setErr(""); setSaved(""); }
  else if (!dirty && v.updated_at !== p.updated_at) setV(p);
  const [act, setAct] = useState({ type: "note", channel: p.channel || "email", summary: "", message_body: "", source_url: "", occurred_at: "" });
  const [newLink, setNewLink] = useState("");
  const timeline = pro.activities.filter(a => a.prospectId === p.id).sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));
  const flash = m => { setSaved(m); setTimeout(() => setSaved(""), 2500); };
  const did = async (promise, ok) => { const e = await promise; if (e) setErr(e); else { setErr(""); flash(ok); } };
  const saveFields = async () => { const e = await pro.actions.edit(p, v); if (e) setErr(e); else { setDirty(false); setErr(""); flash("Saved ✓"); } };
  const dupe = R.findDuplicate(v, pro.prospects, p.id);
  const canConvert = ["replied", "meeting"].includes(p.status) && !ro;
  const sendLog = async () => {
    const a = { ...act, occurred_at: act.occurred_at ? new Date(act.occurred_at + "T12:00:00").toISOString() : undefined };
    const e = await pro.actions.log(p, a); if (e) setErr(e); else { setErr(""); flash("Logged ✓"); setAct({ ...act, summary: "", message_body: "", source_url: "", occurred_at: "" }); }
  };
  const lbl = { fontSize: 10, color: T.tableHeadText, display: "flex", flexDirection: "column", gap: 2 };

  return <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(560px, 100vw)", background: T.panelBg, borderLeft: `1px solid ${T.border}`, boxShadow: "-8px 0 24px #0004", zIndex: 900, display: "flex", flexDirection: "column" }}>
    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{R.fullName(p) || p.company_name || "Prospect"} {p.example && <span style={{ fontSize: 10, color: T.gold }}>(EXAMPLE)</span>}</div>
        <div style={{ fontSize: 12, color: T.subtext }}>{[p.title, p.company_name].filter(Boolean).join(" · ")}</div>
        <div style={{ fontSize: 10, color: T.tableHeadText, marginTop: 2 }}>Added {fmtDate(p.created_at)} by {who(p.created_by)} · touches {p.touch_count || 0}/{R.MAX_TOUCHES}{p.next_touch_at ? ` · next touch ${fmtDate(p.next_touch_at)}` : ""}</div>
      </div>
      <button className="btn" onClick={close}>✕</button>
    </div>
    <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {ro && <div style={{ background: "#1f9d5518", border: "1px solid #1f9d5566", borderRadius: 3, padding: "8px 10px", fontSize: 12 }}>
        ✓ Converted to a lead {fmtDate(p.converted_at)}{p.converted_by ? ` by ${p.converted_by}` : ""} — this prospect is read-only now.{" "}
        <button className="btn" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => onOpenLead(p.converted_lead_id)}>Open the lead →</button></div>}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: T.subtext }}>Status</span>
        <select disabled={ro} value={p.status} onChange={e => did(pro.actions.setStatus(p, e.target.value), "Status changed ✓")} style={{ height: 30, fontSize: 12 }}>
          {R.STATUSES.map(s => <option key={s} value={s}>{R.STATUS_LABEL[s]}</option>)}</select>
        <Badge status={p.status} />
        <div style={{ flex: 1 }} />
        {!ro && <button className="btn-gold" style={{ padding: "6px 12px", fontSize: 11, opacity: canConvert ? 1 : .4 }} disabled={!canConvert}
          title={canConvert ? "Creates a lead (source Outreach / Prospecting) and locks this prospect" : "Available once they've replied or booked a meeting"}
          onClick={() => confirm(`Convert ${R.fullName(p) || p.company_name} to a lead? The prospect becomes read-only.`) && did(pro.actions.convert(p), "Converted ✓")}>Convert to Lead →</button>}
      </div>
      {(err || saved) && <div style={{ fontSize: 12, color: err ? "#e8472c" : "#34c77b", fontWeight: 600 }}>{err || saved}</div>}

      <Fields T={T} v={v} set={c => { setV(x => ({ ...x, ...c })); setDirty(true); }} owners={owners} readOnly={ro} />
      {dupe && <div style={{ fontSize: 11, color: "#e8a23a" }}>⚠ Same {dupe.by} as {R.fullName(dupe.match) || dupe.match.company_name}.</div>}
      {!ro && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11, opacity: dirty ? 1 : .4 }} disabled={!dirty} onClick={saveFields}>Save changes</button>
        {dirty && <button className="btn" onClick={() => { setV(p); setDirty(false); }}>Undo</button>}
        <div style={{ flex: 1 }} />
        <button className="btn-del" style={{ fontSize: 11 }} onClick={() => confirm("Delete this prospect and its history?") && pro.actions.remove(p).then(close)}>Delete</button>
      </div>}

      {/* Source links */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 4 }}>Source links</div>
        {(p.source_urls || []).map((u, i) => <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          <a href={/^https?:/.test(u) ? u : "https://" + u} target="_blank" rel="noreferrer" style={{ color: T.gold, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{u}</a>
          {!ro && <button className="btn-del" onClick={() => pro.actions.edit(p, { source_urls: p.source_urls.filter((_, j) => j !== i) })}>×</button>}</div>)}
        {!(p.source_urls || []).length && <div style={{ fontSize: 11, color: T.tableHeadText }}>None yet.</div>}
        {!ro && <div style={{ display: "flex", gap: 6, marginTop: 4 }}><input value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="https://…" style={{ flex: 1, height: 26, fontSize: 12 }} />
          <button className="btn" disabled={!newLink.trim()} onClick={() => { pro.actions.edit(p, { source_urls: [...(p.source_urls || []), newLink.trim()] }); setNewLink(""); }}>Add link</button></div>}
        {(p.linkedin_url || p.x_handle || p.company_website) && <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11 }}>
          {p.linkedin_url && <a href={/^https?:/.test(p.linkedin_url) ? p.linkedin_url : "https://" + p.linkedin_url} target="_blank" rel="noreferrer" style={{ color: T.gold }}>LinkedIn ↗</a>}
          {p.x_handle && <a href={`https://x.com/${p.x_handle}`} target="_blank" rel="noreferrer" style={{ color: T.gold }}>X ↗</a>}
          {p.company_website && <a href={/^https?:/.test(p.company_website) ? p.company_website : "https://" + p.company_website} target="_blank" rel="noreferrer" style={{ color: T.gold }}>Website ↗</a>}</div>}
      </div>

      {/* Log activity */}
      {!ro && <div style={{ border: `1px solid ${T.border}`, borderRadius: 3, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Log activity</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <label style={lbl}>What<select value={act.type} onChange={e => setAct({ ...act, type: e.target.value })} style={{ height: 28, fontSize: 12 }}>
            {R.ACTIVITY_TYPES.filter(x => x !== "converted").map(x => <option key={x} value={x}>{x === "sent" && (p.touch_count || 0) > 0 ? "Follow-up sent" : R.ACTIVITY_LABEL[x]}</option>)}</select></label>
          <label style={lbl}>Channel<select value={act.channel} onChange={e => setAct({ ...act, channel: e.target.value })} style={{ height: 28, fontSize: 12 }}>{R.CHANNELS.map(c => <option key={c} value={c}>{R.CHANNEL_LABEL[c]}</option>)}</select></label>
          <label style={lbl}>When<input type="date" value={act.occurred_at} max={R.today()} onChange={e => setAct({ ...act, occurred_at: e.target.value })} style={{ height: 28, fontSize: 12 }} /></label>
        </div>
        <input value={act.summary} onChange={e => setAct({ ...act, summary: e.target.value })} placeholder="Summary" style={{ height: 28, fontSize: 12 }} />
        <textarea value={act.message_body} onChange={e => setAct({ ...act, message_body: e.target.value })} placeholder="Message (optional)" rows={3} style={{ fontSize: 12, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 6 }}><input value={act.source_url} onChange={e => setAct({ ...act, source_url: e.target.value })} placeholder="Link (optional)" style={{ flex: 1, height: 28, fontSize: 12 }} />
          <button className="btn-gold" style={{ padding: "5px 14px", fontSize: 11 }} onClick={sendLog}>Log it</button></div>
      </div>}

      {/* Timeline */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 6 }}>Timeline</div>
        {timeline.map(a => <TimelineRow key={a.id} T={T} a={a} />)}
        {!timeline.length && <div style={{ fontSize: 11, color: T.tableHeadText }}>Nothing yet.</div>}
      </div>
    </div>
  </div>;
}

function TimelineRow({ T, a }) {
  const [open, setOpen] = useState(a.type === "drafted");
  const [copied, setCopied] = useState(false);
  return <div style={{ borderLeft: `2px solid ${a.status_to ? R.STATUS_COLOR[a.status_to] : T.border}`, padding: "4px 0 8px 10px", marginLeft: 4 }}>
    <div style={{ fontSize: 12, color: T.text }}><b>{R.ACTIVITY_LABEL[a.type] || a.type}</b>{a.channel && a.channel !== "other" ? ` · ${R.CHANNEL_LABEL[a.channel]}` : ""}{a.summary && a.summary !== R.ACTIVITY_LABEL[a.type] ? ` — ${a.summary}` : ""}</div>
    <div style={{ fontSize: 10, color: T.tableHeadText }}>{fmtWhen(a.occurred_at)} · {who(a.created_by)}{a.source_url && <> · <a href={a.source_url} target="_blank" rel="noreferrer" style={{ color: T.gold }}>link ↗</a></>}</div>
    {a.message_body && <div style={{ marginTop: 4 }}>
      <button className="btn" style={{ padding: "1px 8px", fontSize: 10 }} onClick={() => setOpen(!open)}>{open ? "Hide message" : "Show message"}</button>
      {open && <><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12, background: T.cardBg, border: `1px solid ${T.border}`, padding: 8, margin: "4px 0", color: T.text }}>{a.message_body}</pre>
        <button className="btn" style={{ padding: "1px 8px", fontSize: 10 }} onClick={() => { navigator.clipboard?.writeText(a.message_body); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied ✓" : "Copy message"}</button></>}
    </div>}
  </div>;
}

function Modal({ T, title, close, wide, children }) {
  return <div onClick={close} style={{ position: "fixed", inset: 0, background: "#0008", zIndex: 950, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflow: "auto" }}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.panelBg, border: `1px solid ${T.border}`, borderRadius: 4, width: wide ? "min(900px, 100%)" : "min(620px, 100%)", padding: 16, color: T.text }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}><div style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{title}</div><button className="btn" onClick={close}>✕</button></div>
      {children}
    </div>
  </div>;
}

// ── Grok bot page ────────────────────────────────────────────────────────────
function BotPage({ T, pro }) {
  const { bot, inbox, opts, actions } = pro;
  const [copied, setCopied] = useState("");
  let recent = []; try { recent = JSON.parse(bot.recentJson || "[]"); } catch { /* none */ }
  const guide = botGuide(opts), curl = curlExamples();
  const copy = (txt, k) => { navigator.clipboard?.writeText(txt); setCopied(k); setTimeout(() => setCopied(""), 1500); };
  const box = { background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: 14 };
  return <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={box}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Grok bot</div>
      <div style={{ fontSize: 12, color: T.subtext, lineHeight: 1.6, marginBottom: 10 }}>
        The bot drops its requests into an inbox; the hub checks each one (duplicates, customers / open leads, what the bot is allowed to do) and files it whenever someone with Prospecting access has the hub open.
        Turning the bot off makes the hub refuse its requests — that's the "revoke".
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 6 }}>
        <input type="checkbox" checked={opts.botOn} onChange={e => actions.setBot({ botOn: e.target.checked })} /><b>Bot switched on</b> <span style={{ fontSize: 11, color: T.tableHeadText }}>(off = its requests are refused)</span></label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <input type="checkbox" checked={opts.botCanSend} onChange={e => actions.setBot({ botCanSend: e.target.checked })} /><b>Let the bot mark Sent</b> <span style={{ fontSize: 11, color: T.tableHeadText }}>(and Replied / Meeting / No / On hold — normally only people do; converting is always people only)</span></label>
      <div style={{ fontSize: 11, color: T.tableHeadText, marginTop: 10 }}>
        Waiting in the inbox: <b>{inbox.length}</b> · last handled: {bot.lastInboxAt ? fmtWhen(bot.lastInboxAt) : "never"} · bot summary updated: {bot.listAt ? fmtWhen(bot.listAt) : "—"}</div>
    </div>

    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>Recent bot requests</div></div>
      {recent.length ? <div style={{ maxHeight: 300, overflow: "auto" }}><table className="data-table" style={{ width: "100%", fontSize: 11 }}>
        <thead><tr><th>When</th><th>Request</th><th>Result</th></tr></thead>
        <tbody>{recent.map((r, i) => <tr key={i}><td style={{ whiteSpace: "nowrap" }}>{fmtWhen(r.at)}</td><td>{r.action || "—"}</td>
          <td style={{ color: r.ok ? T.text : "#e8472c" }}>{r.ok ? "✓ " : "✗ "}{r.message}</td></tr>)}</tbody></table></div>
        : <div style={{ fontSize: 12, color: T.tableHeadText }}>Nothing from the bot yet.</div>}
    </div>

    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>Instructions to paste into Grok</div>
        <button className="btn-gold" style={{ padding: "5px 12px", fontSize: 11 }} onClick={() => copy(guide, "g")}>{copied === "g" ? "Copied ✓" : "Copy instructions"}</button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, lineHeight: 1.5, background: T.bg, border: `1px solid ${T.border}`, padding: 10, maxHeight: 360, overflow: "auto", color: T.text }}>{guide}</pre>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 8px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>Test commands (curl)</div>
        <button className="btn" onClick={() => copy(curl, "c")}>{copied === "c" ? "Copied ✓" : "Copy"}</button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, lineHeight: 1.5, background: T.bg, border: `1px solid ${T.border}`, padding: 10, maxHeight: 260, overflow: "auto", color: T.text }}>{curl}</pre>
    </div>
  </div>;
}
