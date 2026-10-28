// ─── Admin tab: users, what they can see, and the master password ───────────
import { useState, useEffect } from "react";
import { ALL_TABS, saveUsers, userTabs } from "./users";
import { setPassword, readPassword } from "../sales/auth";

export default function AdminTab({ T, db, users, loginName }) {
  const [list, setList] = useState(users);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [pw, setPw] = useState({ a: "", b: "", msg: "" });
  useEffect(() => { if (!dirty) setList(users.map(u => ({ ...u, tabs: userTabs(u) }))); }, [users, dirty]);
  const [current, setCurrent] = useState(undefined);
  const [showPw, setShowPw] = useState(false);
  useEffect(() => { readPassword(db).then(setCurrent); }, [db]);

  const upd = (i, patch) => { setDirty(true); setMsg(""); setList(l => l.map((u, j) => (j === i ? { ...u, ...patch } : u))); };
  const toggleTab = (i, tab) => {
    const tabs = list[i].tabs || [];
    let next = tabs.includes(tab) ? tabs.filter(t => t !== tab) : [...tabs, tab];
    if (tab === "pipeline" && !next.includes("pipeline")) next = next.filter(t => t !== "leads"); // Leads lives inside Pipeline & Leads
    if (tab === "leads" && next.includes("leads") && !next.includes("pipeline")) next.push("pipeline");
    upd(i, { tabs: next });
  };
  const save = async () => {
    const clean = list.map(u => ({ ...u, name: u.name.trim() })).filter(u => u.name);
    const names = clean.map(u => u.name.toLowerCase());
    if (new Set(names).size !== names.length) return setMsg("Two users have the same name.");
    if (!clean.some(u => u.admin)) return setMsg("At least one person needs admin access.");
    if (!clean.some(u => u.name.toLowerCase() === loginName.toLowerCase() && u.admin)) return setMsg("You can't remove your own admin access.");
    try { await saveUsers(db, clean); setDirty(false); setMsg("Saved. Changes apply the next time each person loads the hub."); }
    catch (e) { setMsg("Couldn't save: " + e.message); }
  };
  const changePw = async () => {
    if (pw.a.length < 6) return setPw({ ...pw, msg: "Use at least 6 characters." });
    if (pw.a !== pw.b) return setPw({ ...pw, msg: "The two passwords don't match." });
    try { await setPassword(db, pw.a, loginName); setCurrent(pw.a); setPw({ a: "", b: "", msg: "Password changed. Everyone (including you) will be asked to sign in with the new password." }); }
    catch (e) { setPw({ ...pw, msg: "Couldn't save: " + e.message }); }
  };
  const card = { background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, marginBottom: 16 };
  const head = { padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: T.tableHeadText, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <div style={{ maxWidth: 1200 }}>
        <div style={card}>
          <div style={head}>
            Users<div style={{ flex: 1 }} />
            <button className="btn" onClick={() => { setDirty(true); setList([...list, { name: "", tabs: ["quotes"], salesScope: "own", admin: false }]); }}>+ Add user</button>
            <button className="btn-gold" style={{ padding: "5px 14px", fontSize: 11, opacity: dirty ? 1 : .5 }} disabled={!dirty} onClick={save}>Save users</button>
          </div>
          <div style={{ padding: "10px 14px", fontSize: 11, color: T.tableHeadText, lineHeight: 1.5 }}>
            People sign in with their first name and the master password. Tick the areas each person can see. "↳ Leads section" shows Lead Tracking inside Pipeline &amp; Leads (and lead numbers on its dashboard).
            <b> Sales data</b>: "All customers" or "Own accounts only" (only customers where they're the rep in Sales Summary → Settings → Customer accounts).
            <b> Admin</b> can open this page and Sales Summary settings.
            {msg && <div style={{ marginTop: 6, color: T.text }}>{msg}</div>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr>
                <th>Name</th>
                {ALL_TABS.map(t => <th key={t.id} style={{ textAlign: "center", whiteSpace: "nowrap", fontStyle: t.sub ? "italic" : "normal" }}>{t.label}</th>)}
                <th>Sales data</th><th style={{ textAlign: "center" }}>Admin</th><th></th>
              </tr></thead>
              <tbody>{list.map((u, i) => (
                <tr key={i}>
                  <td><input value={u.name} onChange={e => upd(i, { name: e.target.value })} placeholder="First name" style={{ width: 110, height: 26, fontSize: 12 }} /></td>
                  {ALL_TABS.map(t => <td key={t.id} style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={(u.tabs || []).includes(t.id)} onChange={() => toggleTab(i, t.id)} />
                  </td>)}
                  <td><select value={u.salesScope || "own"} onChange={e => upd(i, { salesScope: e.target.value })} style={{ height: 26, fontSize: 11 }}>
                    <option value="all">All customers</option><option value="own">Own accounts only</option>
                  </select></td>
                  <td style={{ textAlign: "center" }}><input type="checkbox" checked={!!u.admin} onChange={e => upd(i, { admin: e.target.checked })} /></td>
                  <td><button className="btn-del" onClick={() => { setDirty(true); setList(list.filter((_, j) => j !== i)); }}>×</button></td>
                </tr>))}</tbody>
            </table>
          </div>
        </div>

        <div style={card}>
          <div style={head}>Master password</div>
          <div style={{ padding: "12px 14px 0", display: "flex", gap: 10, alignItems: "center", fontSize: 12, color: T.subtext }}>
            Current password:
            {current === undefined ? <span style={{ color: T.tableHeadText }}>…</span>
              : current === null ? <span style={{ color: T.tableHeadText, fontSize: 11 }}>not shown — it was set before the hub saved it in readable form. Set it again below (it can be the same one) and it'll show here.</span>
              : <><span style={{ fontFamily: "monospace", fontSize: 13, color: T.text, letterSpacing: ".04em" }}>{showPw ? current : "•".repeat(Math.max(6, current.length))}</span>
                  <button className="btn" style={{ padding: "3px 10px" }} onClick={() => setShowPw(v => !v)}>{showPw ? "Hide" : "Show"}</button></>}
          </div>
          <div style={{ padding: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="password" placeholder="New password" value={pw.a} onChange={e => setPw({ ...pw, a: e.target.value, msg: "" })} style={{ height: 28, fontSize: 12 }} />
            <input type="password" placeholder="Type it again" value={pw.b} onChange={e => setPw({ ...pw, b: e.target.value, msg: "" })} style={{ height: 28, fontSize: 12 }} />
            <button className="btn" onClick={changePw}>Change password</button>
            {pw.msg && <span style={{ fontSize: 11, color: T.subtext }}>{pw.msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
