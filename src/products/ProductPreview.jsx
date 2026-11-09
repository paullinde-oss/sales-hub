// ─── Product preview pop-up, SKU links and the "Website page" picker ─────────
// See webPages.js for how a SKU finds its page on bmpsupplies.com.
import { useEffect, useMemo, useRef, useState } from "react";
import { useProductPages, previewFor, resolveSku, setSkuPage, setPreviewOpener, openPreview, FAMILIES, skuKey, pageUrl, SITE } from "./webPages";

// A SKU you can click for the website preview. Renders as plain text styling of the caller.
export function SkuLink({ sku, product, style, children }) {
  if (!sku) return <span style={style}>{children ?? "—"}</span>;
  return (
    <span role="button" tabIndex={0} title="Show product from the website"
      onClick={e => { e.stopPropagation(); openPreview(sku, e.currentTarget, product); }}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPreview(sku, e.currentTarget, product); } }}
      style={{ cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3, ...style }}>
      {children ?? sku}
    </span>
  );
}

// Small ⓘ button for places where the SKU is an editable box (quote lines being edited)
export function SkuInfoButton({ sku, product, T }) {
  if (!String(sku || "").trim()) return null;
  return (
    <button type="button" title="Show product from the website" onClick={e => { e.stopPropagation(); openPreview(sku, e.currentTarget, product); }}
      style={{ background: "transparent", border: "none", color: T?.accent || "#c8a96e", cursor: "pointer", padding: "0 3px", fontSize: 13, lineHeight: 1, flexShrink: 0 }}>ⓘ</button>
  );
}

const W = 320;
// Mount once near the top of the app. products = the Products list (fallback name/description).
export function ProductPreviewHost({ T, products }) {
  const [open, setOpen] = useState(null);
  const data = useProductPages();
  const boxRef = useRef(null);
  useEffect(() => { setPreviewOpener(setOpen); return () => setPreviewOpener(null); }, []);
  useEffect(() => {
    if (!open) return;
    const key = e => { if (e.key === "Escape") setOpen(null); };
    const close = () => setOpen(null);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("resize", close); };
  }, [open]);
  const product = useMemo(() => {
    if (!open) return null;
    if (open.product) return open.product;
    const k = skuKey(open.sku);
    return (products || []).find(p => skuKey(p.sku) === k) || null;
  }, [open, products]);
  if (!open) return null;

  const p = previewFor(open.sku, data, product);
  const vw = window.innerWidth, vh = window.innerHeight, phone = vw < 520;
  // Next to the SKU on a computer; a sheet at the bottom on a phone
  const pos = phone || !open.rect
    ? { left: 8, right: 8, bottom: 8 }
    : (() => {
        const left = Math.max(8, Math.min(open.rect.left, vw - W - 8));
        const below = vh - open.rect.bottom;
        return below > 360 || below > open.rect.top ? { left, top: open.rect.bottom + 6, maxHeight: below - 14 } : { left, bottom: vh - open.rect.top + 6, maxHeight: open.rect.top - 14 };
      })();

  return (
    <div onMouseDown={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: phone ? "rgba(0,0,0,.45)" : "transparent" }}>
      <div ref={boxRef} role="dialog" aria-label={`${p.sku} on the website`} onMouseDown={e => e.stopPropagation()}
        style={{ position: "fixed", ...pos, width: phone ? "auto" : W, overflowY: "auto", background: T.cardBg, color: T.text, border: `1px solid ${T.borderMid}`, borderRadius: 6, boxShadow: "0 8px 30px rgba(0,0,0,.35)", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        {p.image
          ? <div style={{ background: "#fff", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "center", borderRadius: "6px 6px 0 0" }}>
              <img src={p.image} alt={p.name} style={{ display: "block", maxWidth: "100%", height: 180, objectFit: "contain" }} onError={e => { e.currentTarget.parentElement.style.display = "none"; }} />
            </div>
          : null}
        <div style={{ padding: "12px 14px 14px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: T.accent }}>{p.sku}</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setOpen(null)} aria-label="Close" style={{ background: "transparent", border: "none", color: T.tableHeadText, cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>{p.name || "—"}</div>
          {p.desc && <div style={{ fontSize: 12, color: T.subtext, lineHeight: 1.5, marginBottom: 12, maxHeight: 130, overflow: "hidden" }}>{p.desc}</div>}
          {p.slug
            ? <>
                <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(null)}
                  style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "8px 12px", fontSize: 12, fontWeight: 600, letterSpacing: ".04em", borderRadius: 3, background: "#c8a96e", color: "#0a0a0a" }}>View more ↗</a>
                {!p.fromSite && <div style={{ fontSize: 10, color: T.tableHeadText, marginTop: 8 }}>Photo and website description appear after the weekly website read.</div>}
              </>
            : <div style={{ fontSize: 11, color: T.tableHeadText }}>No website page for this product{p.how === "picked" ? " (set on Products & Price List → Website pages)" : p.family ? "" : " — not part of a known product family"}. Pick one on Products & Price List → Website pages.</div>}
        </div>
      </div>
    </div>
  );
}

// Every page the weekly job found, plus pages named by the rules (in case the job hasn't run yet)
export function pageOptions(data) {
  const m = new Map();
  Object.entries(data?.pages || {}).forEach(([slug, pg]) => m.set(slug, pg.name || slug));
  FAMILIES.forEach(f => { if (f.slug && !m.has(f.slug)) m.set(f.slug, f.slug.replace(/-/g, " ")); });
  return [...m.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// "Website page" picker for one SKU. Saves straight away.
export function WebsitePagePicker({ sku, loginName, T, data: given, compact }) {
  const live = useProductPages();
  const data = given || live;
  const [busy, setBusy] = useState(false);
  if (!skuKey(sku)) return null;
  const r = resolveSku(sku, data);
  const famSlug = r.family?.slug || "";
  const opts = pageOptions(data);
  const nameOf = slug => opts.find(o => o.slug === slug)?.name || slug;
  const value = r.how === "picked" ? (r.slug || "__none") : "__rule";
  const change = async v => {
    setBusy(true);
    try { await setSkuPage(sku, v === "__rule" ? null : v === "__none" ? "" : v, loginName); }
    catch (e) { alert("Couldn't save the website page: " + (e.message || e)); }
    setBusy(false);
  };
  return (
    <select value={value} disabled={busy} onChange={e => change(e.target.value)} title="Website page shown when this SKU is clicked"
      style={{ width: "100%", fontSize: compact ? 10 : 11, height: compact ? 24 : 26, color: r.how === "picked" ? T.accent : T.text, maxWidth: compact ? undefined : 320 }}>
      <option value="__rule">Automatic — {famSlug ? nameOf(famSlug) : "no page"}</option>
      <option value="__none">No website page</option>
      <optgroup label="Website pages">
        {opts.map(o => <option key={o.slug} value={o.slug}>{o.name}</option>)}
      </optgroup>
    </select>
  );
}

// Products & Price List → Website pages: every SKU on the Products list, the page it opens and how
// it was matched, with the picker to correct it.
export function WebsitePagesView({ T, products, loginName }) {
  const data = useProductPages();
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all");
  const rows = useMemo(() => (products || []).filter(p => p?.sku).map(p => ({ p, r: resolveSku(p.sku, data) })), [products, data]);
  const counts = { none: rows.filter(x => !x.r.slug).length, picked: rows.filter(x => x.r.how === "picked").length };
  const visible = rows.filter(({ p, r }) =>
    (show === "all" || (show === "none" && !r.slug) || (show === "picked" && r.how === "picked"))
    && (!q || `${p.sku} ${p.product} ${p.description}`.toLowerCase().includes(q.toLowerCase())));
  const pages = data?.pages || {};
  const used = new Set(rows.map(x => x.r.slug).filter(Boolean));
  const unused = Object.entries(pages).filter(([slug]) => !used.has(slug));
  const f = data?.fetch;
  const howLabel = { picked: "Picked by hand", rule: "Family rule", none: "No page" };
  const howColor = { picked: T.accent, rule: "#5a9e5a", none: "#c86a5a" };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16, fontSize: 12 }}>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ color: T.subtext, lineHeight: 1.6, marginBottom: 12 }}>
          Clicking a SKU anywhere in the hub (Products, quote lines, orders) shows the product's photo and description from{" "}
          <a href={SITE} target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>bmpsupplies.com</a> with a "View more" button.
          SKUs are matched to a page by product family — the size digits don't matter. If a SKU opens the wrong page, pick the right one here.
        </div>
        <div style={{ fontSize: 11, color: f?.ok === false ? "#c86a5a" : T.tableHeadText, marginBottom: 14 }}>
          {f?.at
            ? <>Website last read {new Date(f.at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })} — {f.ok ? `${f.count} product pages found.` : `failed: ${f.error || "unknown error"} (the previous copy is kept).`} Read again automatically every week.</>
            : <>The website hasn't been read yet — photos and website descriptions appear after the first weekly read. "View more" links work already.</>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <input placeholder="Search SKU or product" value={q} onChange={e => setQ(e.target.value)} style={{ width: 220, height: 28, fontSize: 12 }} />
          {[["all", `All (${rows.length})`], ["none", `No page (${counts.none})`], ["picked", `Picked by hand (${counts.picked})`]].map(([id, l]) => (
            <button key={id} className="btn" onClick={() => setShow(id)} style={{ fontSize: 11, borderColor: show === id ? T.gold : undefined, color: show === id ? T.gold : undefined }}>{l}</button>
          ))}
        </div>
        <table className="data-table" style={{ background: T.cardBg, width: "100%" }}>
          <thead><tr><th style={{ width: 120 }}>SKU</th><th>Product</th><th style={{ width: 230 }}>Family</th><th style={{ width: 110 }}>Matched by</th><th style={{ width: 300 }}>Website page</th><th style={{ width: 40 }} /></tr></thead>
          <tbody>
            {visible.map(({ p, r }) => (
              <tr key={p.sku}>
                <td><SkuLink sku={p.sku} product={p} style={{ fontFamily: "monospace", fontSize: 11, color: T.accent, whiteSpace: "nowrap" }} /></td>
                <td style={{ color: T.subtext }}>{p.product}</td>
                <td style={{ color: T.tableHeadText, fontSize: 11 }}>{r.family?.label || "—"}</td>
                <td><span style={{ fontSize: 10, color: howColor[r.how] }}>{howLabel[r.how]}</span></td>
                <td><WebsitePagePicker sku={p.sku} loginName={loginName} T={T} data={data} compact /></td>
                <td>{r.slug && <a href={pages[r.slug]?.url || pageUrl(r.slug)} target="_blank" rel="noopener noreferrer" title="Open the page" style={{ color: T.accent, textDecoration: "none" }}>↗</a>}</td>
              </tr>
            ))}
            {!visible.length && <tr><td colSpan={6} style={{ color: T.tableHeadText }}>Nothing to show.</td></tr>}
          </tbody>
        </table>
        {unused.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, color: T.tableHeadText, marginBottom: 6 }}>Pages on the website that no Products-list SKU opens ({unused.length}):</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {unused.map(([slug, pg]) => <a key={slug} href={pg.url || pageUrl(slug)} target="_blank" rel="noopener noreferrer" className="pill" style={{ fontSize: 11, color: T.subtext, textDecoration: "none", border: `1px solid ${T.border}`, padding: "2px 8px", borderRadius: 10 }}>{pg.name || slug} ↗</a>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
