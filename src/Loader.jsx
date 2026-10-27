// ─── BMP loading animation + logo (black artwork; flipped to white on dark themes) ──
import loadingGif from "./assets/bmp-loading.gif";
import logoPng from "./assets/bmp-logo.png";

export const BMP_LOGO = logoPng;
const isDark = T => { const h = String(T?.bg || "#fff").replace("#", ""); const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 128; };
export const onDark = T => (isDark(T) ? { filter: "invert(1)" } : {});

export function Loader({ T, label, size = 56, inline = false }) {
  const img = <img src={loadingGif} alt="Loading" style={{ width: size, height: size, ...onDark(T) }} />;
  if (inline) return <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{img}{label && <span>{label}</span>}</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 32, color: T?.tableHeadText || "#888", fontSize: 12 }}>
      {img}{label && <div>{label}</div>}
    </div>
  );
}
