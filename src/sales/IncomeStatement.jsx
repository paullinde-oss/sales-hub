// ─── Reports → Income Statement ──────────────────────────────────────────────
// Shows ONLY the numbers in the Google Sheet tab "Income Statement" (Sage 50 figures kept there).
// The sheet's published-CSV link is stored inside the encrypted cost store (costs.__incomeSheet), so it
// never appears in the public code or readable in the database; the figures are read fresh each time
// and never saved in the hub. Cost viewers only (Users & Access → Costs & margins).
// Sheet layout used: A1 title, A2 source line, A4:G5 summary boxes (labels / values), and the data
// table in AA:AJ — Account, FY…, FY…, $ Change, % Change, FY…, FY…, RowType, ShowInSummary, Section.
import { useEffect, useRef, useState } from "react";

const AA = 26; // column AA
function parseCSV(text) {
  const rows = []; let row = [], val = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { val += '"'; i++; } else q = false; } else val += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(val); val = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(val); rows.push(row); row = []; val = ""; }
    else val += c;
  }
  if (val || row.length) { row.push(val); rows.push(row); }
  return rows;
}
const num = v => { const s = String(v ?? "").trim(); if (!s || /[a-z]/i.test(s)) return null; const n = parseFloat(s.replace(/[$,\s]/g, "")); return isNaN(n) ? null : n; };
const money = v => { const n = num(v); if (n == null) return String(v ?? "").trim(); return (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const pct = v => { const s = String(v ?? "").trim(); if (!s || /%|pts/.test(s)) return s; const n = num(s); return n == null ? s : (n * 100).toFixed(1) + "%"; };

const NAVY = "#0d1b33", SLATE = "#46536a", GREEN_BG = "#d5f5e3", GREEN = "#137a3c", BLUE_BG = "#dbe7fb";

export default function IncomeStatement({ T, costs, loginName }) {
  const link = costs?.costs?.__incomeSheet || "";
  const [sheet, setSheet] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState("none");
  const [draft, setDraft] = useState("");
  const [editLink, setEditLink] = useState(false);
  const box = useRef(null);
  // Print / PDF: just the report (buttons left out), landscape, colours kept
  const print = () => {
    const el = box.current?.cloneNode(true); if (!el) return;
    el.querySelectorAll("[data-noprint]").forEach(n => n.remove());
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${(sheet?.title || "Income Statement").replace(/[<>|]/g, "-")}</title>
      <style>@page{size:landscape;margin:10mm}body{font-family:'Helvetica Neue',Arial,sans-serif;margin:0;background:#fff;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}select{display:none}</style></head><body>${el.outerHTML}</body></html>`);
    w.document.close(); setTimeout(() => w.print(), 300);
  };

  const load = async () => {
    if (!link) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(link + (link.includes("?") ? "&" : "?") + "ts=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error(`the sheet answered ${r.status}`);
      const t = parseCSV(await r.text());
      const rows = t.slice(1).map(r => r.slice(AA, AA + 10)).filter(r => String(r[0] || "").length || r[7])
        .map(r => ({ account: r[0], v: r.slice(1, 7), type: String(r[7] || "").trim(), summary: String(r[8] || "").trim().toUpperCase() === "TRUE", section: String(r[9] || "").trim() }));
      if (!rows.length) throw new Error("no rows found in columns AA–AJ");
      setSheet({
        title: t[0]?.[0] || "Income Statement", source: t[1]?.[0] || "",
        heads: (t[0] || []).slice(AA, AA + 7),
        kpis: (t[3] || []).slice(0, 7).map((l, i) => [l, t[4]?.[i] || ""]).filter(k => k[0]),
        rows,
      });
    } catch (e) { setErr(`Couldn't read the Income Statement sheet (${e.message}). Check the link is still published (File → Share → Publish to web).`); }
    setBusy(false);
  };
  useEffect(() => { load(); }, [link]); // eslint-disable-line

  const saveLink = async () => {
    const u = draft.trim();
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\/.+output=csv/.test(u)) return alert("Paste the 'Publish to web' link for the Income Statement tab, as CSV (it ends in output=csv).");
    await costs.save({ ...costs.costs, __incomeSheet: u }, loginName);
    setDraft(""); setEditLink(false);
  };

  if (!link || editLink) return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: 16, maxWidth: 720 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Connect the Income Statement sheet</div>
      <div style={{ fontSize: 12, color: T.subtext, lineHeight: 1.6, marginBottom: 10 }}>
        In Google Sheets: File → Share → <b>Publish to web</b> → choose the <b>Income Statement</b> tab and <b>CSV</b>, then paste the link here.
        It's saved locked (only people with Costs &amp; margins can open it — never in the public code), and the numbers are read fresh from the sheet each time.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv" style={{ flex: 1, height: 30, fontSize: 12 }} />
        <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} onClick={saveLink}>Save</button>
        {editLink && <button className="btn" onClick={() => setEditLink(false)}>Cancel</button>}
      </div>
    </div>
  );

  const sections = sheet ? [...new Set(sheet.rows.map(r => r.section).filter(Boolean))] : [];
  const shown = sheet ? sheet.rows.filter(r => r.summary || (detail === "all" ? !!r.section : r.section === detail)) : [];
  const cell = { padding: "7px 10px", borderBottom: `1px solid ${T.border}`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textAlign: "right" };
  const rowStyle = r => {
    switch (r.type) {
      case "major": return { background: SLATE, color: "#fff", fontWeight: 700 };
      case "section": return { fontWeight: 700, color: T.text, background: T.tableHead };
      case "subtotal": return { fontWeight: 700 };
      case "derived": case "grand": return { fontWeight: 700, background: T.tableHead };
      case "gm": return { fontWeight: 700, background: GREEN_BG, color: GREEN };
      case "metric": return { color: T.subtext };
      case "groupsum": return { fontStyle: "italic", fontWeight: 600 };
      case "sub": return { fontSize: 11, color: T.subtext };
      default: return {};
    }
  };
  const isNet = r => /^NET INCOME/i.test(String(r.account).trim());

  return (
    <div ref={box} style={{ flex: 1, minWidth: 0 }}>
      <div style={{ background: NAVY, color: "#fff", padding: "10px 14px", borderRadius: "3px 3px 0 0", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>{sheet?.title || "Income Statement"}</div>
        <span data-noprint style={{ display: "contents" }}><button className="btn" style={{ background: "transparent", color: "#fff", borderColor: "#ffffff55" }} disabled={busy} onClick={load}>{busy ? "Reading…" : "⟳ Refresh"}</button>
        <button className="btn" style={{ background: "transparent", color: "#fff", borderColor: "#ffffff55" }} onClick={print}>Print / PDF</button>
        <button className="btn" style={{ background: "transparent", color: "#ffffffaa", borderColor: "#ffffff33" }} title="Change the sheet link" onClick={() => setEditLink(true)}>Sheet link</button></span>
      </div>
      {sheet?.source && <div style={{ fontSize: 11, fontStyle: "italic", color: T.subtext, padding: "6px 14px", background: T.tableHead }}>{sheet.source}</div>}
      {err && <div style={{ fontSize: 12, color: "#e8472c", padding: 12 }}>{err}</div>}
      {!sheet && !err && <div style={{ fontSize: 12, color: T.tableHeadText, padding: 12 }}>Reading the sheet…</div>}
      {sheet && <>
        {/* Summary boxes — straight from the sheet's A4:G5 */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, gap: 2, margin: "10px 0" }}>
          {sheet.kpis.map(([l, v], i) => {
            const net = /NET/i.test(l), gm = /GROSS/i.test(l);
            const bg = net ? NAVY : gm ? GREEN_BG : BLUE_BG, fg = net ? "#fff" : gm ? GREEN : NAVY;
            return <div key={i} style={{ background: bg, color: fg, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em" }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{v}</div>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12 }}>
          <b>Show detail for</b>
          <select value={detail} onChange={e => setDetail(e.target.value)} style={{ fontSize: 12, height: 28 }}>
            <option value="none">None (totals only)</option>
            <option value="all">All sections</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={{ fontSize: 11, color: T.tableHeadText }}>Gross margin = Total Revenue − (Materials + Labour COGS).</span>
        </div>
        <div style={{ overflowX: "auto", border: `1px solid ${T.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: T.text }}>
            <thead><tr>{sheet.heads.map((h, i) => <th key={i} style={{ background: NAVY, color: "#fff", padding: "8px 10px", textAlign: i ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
            <tbody>{shown.map((r, i) => {
              if (r.type === "spacer") return <tr key={i}><td colSpan={7} style={{ height: 14 }} /></tr>;
              const st = isNet(r) ? { background: NAVY, color: "#fff", fontWeight: 700 } : rowStyle(r);
              const indent = (String(r.account).match(/^\s*/)[0].length) * 4;
              const metric = r.type === "metric";
              return <tr key={i} style={st}>
                <td style={{ ...cell, textAlign: "left", paddingLeft: 10 + indent }}>{String(r.account).trim()}</td>
                {r.v.map((v, j) => <td key={j} style={cell}>{metric ? v : j === 3 ? pct(v) : money(v)}</td>)}
              </tr>;
            })}</tbody>
          </table>
        </div>
      </>}
    </div>
  );
}
