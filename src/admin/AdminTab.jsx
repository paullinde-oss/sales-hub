// ─── Admin tab: users, what they can see, and each person's password ────────
import { useState, useEffect } from "react";
import { ALL_TABS, saveUsers, userTabs, canEditPriceLists, canSeeCosts } from "./users";
import { setUserPassword, removeCostAccess, removeLogin, turnOffMaster, userKey } from "../sales/auth";
import { costKeyToGive } from "../pricelist/costs";

export default function AdminTab({ T, db, users, loginName, logins = {}, masterOff = false, onOwnToken }) {
  const [list, setList] = useState(users);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [setting, setSetting] = useState(null); // { name, pw, msg }
  const [pwMsg, setPwMsg] = useState("");
  useEffect(() => { if (!dirty) setList(users.map(u => ({ ...u, tabs: userTabs(u) }))); }, [users, dirty]);
  const L = logins || {};
  const entryOf = u => L[userKey(u.name)];
  // Set a person's password; people with Costs & margins also get the cost key (locked with that password)
  const doSet = async () => {
    const { name, pw } = setting;
    if (String(pw).length < 6) return setSetting({ ...setting, msg: "Use at least 6 characters." });
    const u = users.find(x => userKey(x.name) === userKey(name)) || list.find(x => userKey(x.name) === userKey(name));
    try {
      setSetting({ ...setting, msg: "Saving…" });
      const giveCosts = canSeeCosts(u);
      const costKey = giveCosts ? await costKeyToGive(db, loginName) : null;
      const token = await setUserPassword(db, name, pw, { by: loginName, giveCosts, costKey });
      if (userKey(name) === userKey(loginName)) onOwnToken?.(token);
      setSetting(null);
      setPwMsg(`${name}'s password is set${giveCosts ? " (with costs & margins)" : ""}. Tell them what it is — the hub can't show it again.`);
    } catch (e) { setSetting({ ...setting, msg: e.message }); }
  };

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
    try {
      await saveUsers(db, clean);
      // Keep passwords in step: removed people lose their password; people no longer on Costs & margins lose the cost key
      for (const k of Object.keys(L)) {
        const u = clean.find(x => userKey(x.name) === k);
        if (!u) await removeLogin(db, k);
        else if (L[k].wrap && !canSeeCosts(u)) await removeCostAccess(db, u.name);
      }
      const needCosts = clean.filter(u => canSeeCosts(u) && L[userKey(u.name)]?.hash && !L[userKey(u.name)]?.wrap).map(u => u.name);
      setDirty(false);
      setMsg("Saved. Changes apply the next time each person loads the hub." + (needCosts.length ? ` To give ${needCosts.join(", ")} costs & margins, set their password again.` : ""));
    }
    catch (e) { setMsg("Couldn't save: " + e.message); }
  };
  const missing = users.filter(u => !entryOf(u)?.hash).map(u => u.name);
  const th = { textAlign: "center", whiteSpace: "normal", lineHeight: 1.3, minWidth: 64, maxWidth: 110, verticalAlign: "bottom", padding: "8px 6px" };
  const card = { background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 3, marginBottom: 16 };
  const head = { padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: T.tableHeadText, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <div>
        <div style={card}>
          <div style={head}>
            Users<div style={{ flex: 1 }} />
            <button className="btn" onClick={() => { setDirty(true); setList([...list, { name: "", tabs: ["quotes"], salesScope: "own", admin: false }]); }}>+ Add user</button>
            <button className="btn-gold" style={{ padding: "5px 14px", fontSize: 11, opacity: dirty ? 1 : .5 }} disabled={!dirty} onClick={save}>Save users</button>
          </div>
          <div style={{ padding: "10px 14px", fontSize: 11, color: T.tableHeadText, lineHeight: 1.5 }}>
            People sign in with their first name and <b>their own password</b> (set it with "Set password"; they can change it from the 🔑 button at the top). Tick the areas each person can see. "↳ Leads section" shows Lead Tracking inside Pipeline &amp; Leads (and lead numbers on its dashboard).
            <b> Sales data</b>: "All customers" or "Own accounts only" (only customers where they're the rep in Sales Summary → Settings → Customer accounts).
            <b> Edit price lists</b>: see and build new price list drafts. <b>Costs &amp; margins</b>: product costs, margins and the Income Statement (opened by their own password).<b> Admin</b> can open this page and Sales Summary settings.
            {msg && <div style={{ marginTop: 6, color: T.text }}>{msg}</div>}
            {pwMsg && <div style={{ marginTop: 6, color: "#34c77b", fontWeight: 600 }}>{pwMsg}</div>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr>
                <th>Name</th>
                {ALL_TABS.map(t => <th key={t.id} style={{ ...th, fontStyle: t.sub ? "italic" : "normal" }}>{t.label}</th>)}
                <th style={th}>Sales data</th><th style={th}>Edit price lists</th><th style={th}>Costs &amp; margins</th><th style={th}>Admin</th><th style={{ ...th, textAlign: "left" }}>Password</th><th></th>
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
                  <td style={{ textAlign: "center" }}><input type="checkbox" checked={canEditPriceLists(u)} onChange={e => upd(i, { priceDrafts: e.target.checked })} /></td>
                  <td style={{ textAlign: "center" }}><input type="checkbox" checked={canSeeCosts(u)} onChange={e => upd(i, { costs: e.target.checked })} /></td>
                  <td style={{ textAlign: "center" }}><input type="checkbox" checked={!!u.admin} onChange={e => upd(i, { admin: e.target.checked })} /></td>
                  <td style={{ whiteSpace: "nowrap", fontSize: 11 }}>
                    {setting && userKey(setting.name) === userKey(u.name)
                      ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <input autoFocus value={setting.pw} onChange={e => setSetting({ ...setting, pw: e.target.value, msg: "" })} onKeyDown={e => e.key === "Enter" && doSet()} placeholder="New password" style={{ width: 130, height: 26, fontSize: 12 }} />
                          <button className="btn-gold" style={{ padding: "3px 10px", fontSize: 11 }} onClick={doSet}>Save</button>
                          <button className="btn" style={{ padding: "3px 8px" }} onClick={() => setSetting(null)}>Cancel</button>
                          {setting.msg && <span style={{ color: T.subtext, whiteSpace: "normal", maxWidth: 220 }}>{setting.msg}</span>}
                        </span>
                      : <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                          {entryOf(u)?.hash
                            ? <span style={{ color: "#34c77b" }} title={`Set by ${entryOf(u).setBy || "—"}${entryOf(u).changedAt ? " · changed by them" : ""}`}>✓ Set{canSeeCosts(u) && !entryOf(u).wrap ? <span style={{ color: "#e8a23a" }}> · set again for costs</span> : ""}</span>
                            : <span style={{ color: "#e8472c" }}>No password</span>}
                          <button className="btn" style={{ padding: "2px 8px", fontSize: 11 }} disabled={!u.name.trim() || dirty} title={dirty ? "Save users first" : ""} onClick={() => { setPwMsg(""); setSetting({ name: u.name.trim(), pw: "", msg: "" }); }}>{entryOf(u)?.hash ? "Reset" : "Set password"}</button>
                        </span>}
                  </td>
                  <td><button className="btn-del" onClick={() => { setDirty(true); setList(list.filter((_, j) => j !== i)); }}>×</button></td>
                </tr>))}</tbody>
            </table>
          </div>
        </div>

        <div style={card}>
          <div style={head}>Shared master password</div>
          <div style={{ padding: 14, fontSize: 12, color: T.subtext, lineHeight: 1.6 }}>
            {masterOff
              ? <>Switched off — everyone signs in with their own password. If someone forgets theirs, click <b>Reset</b> on their row and give them a new one.</>
              : <>
                  The old shared password still works until you switch it off. Set a password for everyone first{missing.length ? <> — still missing: <b style={{ color: "#e8472c" }}>{missing.join(", ")}</b></> : " — everyone has one"}.
                  <div style={{ marginTop: 10 }}>
                    <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11, opacity: missing.length ? .5 : 1 }} disabled={!!missing.length} onClick={async () => {
                      if (!confirm("Switch everyone to their own password now? The shared master password will stop working straight away.")) return;
                      await turnOffMaster(db, loginName);
                    }}>Switch everyone to personal passwords</button>
                  </div>
                </>}
          </div>
        </div>
      </div>
    </div>
  );
}
