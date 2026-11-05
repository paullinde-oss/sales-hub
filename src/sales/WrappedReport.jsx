// ─── Reports → BMP Supplies Wrapped ──────────────────────────────────────────
// Pick a year → fun-fact cards (no dollars) to post on LinkedIn, email out and share with the team.
// Each card can be hidden or reworded, and you can add your own; choices are saved per year in
// config/wrapped. City positions for the map are saved in config/geoCache.
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc, updateDoc, FieldPath } from "firebase/firestore";
import { wrappedFacts, buildCards, finalCards, locateCities, furthest } from "./wrapped";
import { cardSVG, mapSVG, svgToCanvas, download, emailGraphic, toDataURL } from "./wrappedArt";
import logoUrl from "../assets/bmp-logo.png";
import { today } from "./salesUtils";

export default function WrappedReport({ T, db, orders, quotes = [], products = [] }) {
  const thisYear = +today().slice(0, 4);
  const years = [...new Set([thisYear, ...orders.map(o => +o.date.slice(0, 4))])].filter(Boolean).sort((a, b) => b - a);
  const [year, setYear] = useState(+today().slice(5, 7) >= 11 ? thisYear : thisYear - 1);
  const [all, setAll] = useState({});
  const [geoCache, setGeoCache] = useState(null);
  const [pos, setPos] = useState({});
  const [mapArt, setMapArt] = useState("");
  const [placing, setPlacing] = useState("");
  const [logo, setLogo] = useState("");
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState("");
  useEffect(() => onSnapshot(doc(db, "config", "wrapped"), s => setAll(s.exists() ? s.data() : {}), () => setAll({})), [db]);
  useEffect(() => onSnapshot(doc(db, "config", "geoCache"), s => setGeoCache(s.exists() ? s.data().map || {} : {}), () => setGeoCache({})), [db]);
  useEffect(() => { toDataURL(logoUrl).then(setLogo).catch(() => {}); }, []);

  const facts = useMemo(() => wrappedFacts({ orders, quotes, products, year }), [orders, quotes, products, year]);
  // Place the cities on the map (first time: ~1 second per new city, then saved)
  useEffect(() => {
    if (geoCache === null || !facts.cities.length) { setPos({}); return; }
    let stop = false;
    const missing = facts.cities.filter(c => !geoCache[`${c.city}|${c.region}|${c.country}`]).length;
    locateCities(facts.cities, geoCache, i => !stop && setPlacing(`Placing cities on the map… ${i} of ${missing}`),
      fresh => setDoc(doc(db, "config", "geoCache"), { map: fresh }, { merge: true }))
      .then(p => { if (!stop) { setPos(p); setPlacing(""); } });
    return () => { stop = true; };
  }, [facts, geoCache === null]); // eslint-disable-line
  useEffect(() => { let ok = true; if (Object.keys(pos).length) mapSVG(facts.cities, pos).then(m => ok && setMapArt(m)).catch(e => console.warn("map", e)); return () => { ok = false; }; }, [pos, facts]);

  const settings = all[String(year)] || {};
  const cards = finalCards(buildCards(facts, { furthest: furthest(facts.cities, pos) }), settings, year);
  const shown = cards.filter(c => !c.hidden);
  const svgOf = (c, i) => cardSVG(c, i, { year, logo, map: c.map ? mapArt : "" });
  const save = async next => {
    await setDoc(doc(db, "config", "wrapped"), {}, { merge: true });
    await updateDoc(doc(db, "config", "wrapped"), new FieldPath(String(year)), JSON.parse(JSON.stringify(next)));
  };
  const toggle = id => save({ ...settings, hidden: { ...(settings.hidden || {}), [id]: !settings.hidden?.[id] } });
  const fileName = (c, i) => `BMP Supplies ${year} Wrapped - ${String(i + 1).padStart(2, "0")} ${c.id}.png`;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>🎉 BMP Supplies Wrapped</div>
        <select value={year} onChange={e => setYear(+e.target.value)} style={{ fontSize: 12, height: 28 }}>{years.map(y => <option key={y} value={y}>{y}{y === thisYear ? " (so far)" : ""}</option>)}</select>
        <div style={{ flex: 1 }} />
        <button className="btn" disabled={!!busy} onClick={async () => { setBusy("Making the email graphic…"); const c = await emailGraphic(shown.map(svgOf)); await download(c, `BMP Supplies ${year} Wrapped - email.png`); setBusy(""); }}>⬇ Email graphic (one image)</button>
        <button className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }} disabled={!!busy} onClick={async () => {
          for (let i = 0; i < shown.length; i++) { setBusy(`Saving card ${i + 1} of ${shown.length}…`); await download(await svgToCanvas(svgOf(shown[i], i)), fileName(shown[i], i)); }
          setBusy("");
        }}>⬇ Download all {shown.length} cards</button>
      </div>
      <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 12, lineHeight: 1.5 }}>
        Fun facts from {year}'s order confirmations and quotes — no dollar figures. Cards are 1080×1080 (LinkedIn carousel size); the email graphic puts them two across in one image.
        Untick a card to leave it out, click ✎ to reword it, or add your own (trade shows, new hires…). {placing && <b style={{ color: T.gold }}>{placing}</b>}{busy && <b style={{ color: T.gold }}> {busy}</b>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {cards.map((c, i) => {
          const idx = shown.indexOf(c);
          return (
            <div key={c.id} style={{ opacity: c.hidden ? .35 : 1 }}>
              <div style={{ borderRadius: 6, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,.25)", aspectRatio: "1 / 1" }}
                dangerouslySetInnerHTML={{ __html: svgOf(c, idx >= 0 ? idx : i).replace(/width="1080" height="1080"/, 'width="100%" height="100%"') }} />
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                <label style={{ fontSize: 11, flex: 1 }}><input type="checkbox" checked={!c.hidden} onChange={() => toggle(c.id)} /> Include</label>
                {!c.map && <button className="btn" style={{ padding: "2px 8px" }} onClick={() => setEdit({ ...c })}>✎</button>}
                {c.custom && <button className="btn-del" style={{ padding: "2px 8px" }} onClick={() => save({ ...settings, custom: (settings.custom || []).filter(x => x.id !== c.id) })}>×</button>}
                <button className="btn" style={{ padding: "2px 8px" }} disabled={c.hidden || (c.map && !mapArt)} onClick={async () => download(await svgToCanvas(svgOf(c, idx)), fileName(c, idx))}>⬇ PNG</button>
              </div>
            </div>
          );
        })}
        <div onClick={() => setEdit({ id: "custom" + Date.now(), emoji: "✨", big: "", text: "", sub: "", custom: true, isNew: true })}
          style={{ aspectRatio: "1 / 1", border: `2px dashed ${T.borderMid}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.subtext, fontSize: 13, textAlign: "center", padding: 20 }}>
          ＋ Add your own card<br /><span style={{ fontSize: 11, color: T.tableHeadText }}>e.g. trade shows, new hires, a new warehouse</span>
        </div>
      </div>
      {edit && <div className="modal-overlay" onClick={() => setEdit(null)}>
        <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{edit.isNew ? "Add your own card" : "Edit card"}</div>
          {[["emoji", "Emoji"], ["big", "Big number / headline"], ["text", "Line under it"], ["sub", "Small line (the fun comparison)"]].map(([k, l]) => (
            <label key={k} style={{ display: "block", fontSize: 11, color: T.subtext, marginBottom: 8 }}>{l}
              <input value={edit[k] || ""} onChange={e => setEdit({ ...edit, [k]: e.target.value })} style={{ display: "block", width: "100%", height: 30, fontSize: 13, marginTop: 3 }} /></label>
          ))}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            {!edit.custom && settings.edits?.[edit.id] && <button className="btn" onClick={() => { const e = { ...(settings.edits || {}) }; delete e[edit.id]; save({ ...settings, edits: e }); setEdit(null); }}>Back to original wording</button>}
            <button className="btn" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn-gold" onClick={() => {
              const card = { emoji: edit.emoji || "", big: edit.big || "", text: edit.text || "", sub: edit.sub || "" };
              if (edit.custom) { const list = (settings.custom || []).filter(x => x.id !== edit.id); save({ ...settings, custom: [...list, { id: edit.id, ...card }] }); }
              else save({ ...settings, edits: { ...(settings.edits || {}), [edit.id]: card } });
              setEdit(null);
            }}>Save</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
