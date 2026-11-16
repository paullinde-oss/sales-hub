// ─── BMP "stripes" loader (the same one Leon shows) + logo helpers ───────────
// Five bars in the BMP logo's proportions (78 × 10 px, 4 px apart) fill left to right, one after
// another, with "Loading..." underneath. Colours are Leon's night theme (dark) and its light theme,
// picked from the hub's own Light/Dark setting. Respects "reduce motion" (bars show full).
// Also used before the app starts: the same markup sits in index.html inside #root.
import logoPng from "./assets/bmp-logo.png";

export const BMP_LOGO = logoPng;
const isDark = T => { const h = String(T?.bg || "#fff").replace("#", ""); const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 128; };
export const onDark = T => (isDark(T) ? { filter: "invert(1)" } : {});

const DARK = { card: "#161513", edge: "#2A2724", bar: "#EDEAE5", text: "#A09A91" };
const LIGHT = { card: "#FFFFFF", edge: "#E7E3DB", bar: "#1C1A17", text: "#595349" };

// The animation (added to the page once)
const CSS = `
.bmp-ld-f{display:block;height:100%;transform:scaleX(0);transform-origin:left center;animation:bmpldfill 1.5s ease-in-out infinite}
.bmp-ld-b:nth-child(2) .bmp-ld-f{animation-delay:.12s}
.bmp-ld-b:nth-child(3) .bmp-ld-f{animation-delay:.24s}
.bmp-ld-b:nth-child(4) .bmp-ld-f{animation-delay:.36s}
.bmp-ld-b:nth-child(5) .bmp-ld-f{animation-delay:.48s}
@keyframes bmpldfill{0%{transform:scaleX(0)}55%,85%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}}
@media (prefers-reduced-motion: reduce){.bmp-ld-f{animation:none;transform:scaleX(1)}}`;
if (typeof document !== "undefined" && !document.getElementById("bmp-ld-css")) {
  const s = document.createElement("style"); s.id = "bmp-ld-css"; s.textContent = CSS; document.head.appendChild(s);
}

// The five bars. w/h/gap in px — full size is 78 × 10 with 4 px gaps; inline is a small version.
export function Stripes({ T, w = 78, h = 10, gap = 4 }) {
  const c = isDark(T) ? DARK : LIGHT;
  return (
    <span style={{ display: "inline-block", lineHeight: 0 }} aria-hidden="true">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className="bmp-ld-b" style={{ display: "block", width: w, height: h, marginTop: i ? gap : 0, background: c.edge, overflow: "hidden" }}>
          <span className="bmp-ld-f" style={{ background: c.bar }} />
        </span>
      ))}
    </span>
  );
}

// <Loader T={T} label="Loading sales data…" />  → the card, centred in the space it's given
// <Loader T={T} inline label="Saving…" />       → small bars beside the text, for status lines
export function Loader({ T, label = "Loading...", inline = false }) {
  const c = isDark(T) ? DARK : LIGHT;
  if (inline) return (
    <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Stripes T={T} w={18} h={2.5} gap={1.5} />{label && <span>{label}</span>}
    </span>
  );
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32, flex: 1 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "28px 38px", background: c.card, border: `1px solid ${c.edge}`, borderRadius: 10 }}>
        <Stripes T={T} />
        <div style={{ fontFamily: 'ui-sans-serif,"Segoe UI",system-ui,-apple-system,sans-serif', fontSize: 13, color: c.text, letterSpacing: ".04em" }}>{label || "Loading..."}</div>
      </div>
    </div>
  );
}
