// ─── Wrapped card artwork: 1080×1080 SVG → PNG (LinkedIn carousel size) ──────
import { HOMES, cityKey } from "./wrapped";

const S = 1080;
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#c8a96e", INK = "#111111";

function wrap(text, maxChars) {
  const words = String(text || "").split(/\s+/).filter(Boolean), lines = [];
  let cur = "";
  words.forEach(w => { if ((cur + " " + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); });
  if (cur) lines.push(cur);
  return lines;
}

// Card colours alternate: gold covers/outro, otherwise dark with every third card gold
export const themeOf = (card, i) => (card.id === "cover" || card.id === "outro" || i % 3 === 2 ? "gold" : "dark");

export function cardSVG(card, i, { year, logo, map = "" }) {
  const gold = !card.map && themeOf(card, i) === "gold"; // the map is always on a dark card
  const bg = gold ? GOLD : INK, fg = gold ? INK : "#ffffff", accent = gold ? "#3a2c10" : GOLD;
  const logoEl = logo ? `<image href="${logo}" x="70" y="62" height="62" width="190" preserveAspectRatio="xMinYMid meet" ${gold ? "" : `filter="url(#inv)"`}/>` : `<text x="70" y="104" font-family="${FONT}" font-size="34" font-weight="700" letter-spacing="6" fill="${fg}">BMP SUPPLIES</text>`;
  const footer = `<text x="${S / 2}" y="${S - 56}" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="700" letter-spacing="8" fill="${accent}">BMP SUPPLIES · ${year} WRAPPED</text>`;
  const defs = `<defs><filter id="inv"><feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"/></filter></defs>`;
  if (card.map) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${defs}<rect width="${S}" height="${S}" fill="${INK}"/>${logoEl}
      <text x="70" y="200" font-family="${FONT}" font-size="54" font-weight="700" fill="#fff">${esc(card.text)}</text>
      ${map}${footer}</svg>`;
  }
  const big = String(card.big || "");
  const bigSize = Math.max(64, Math.min(190, Math.floor(940 / (0.58 * Math.max(1, big.length)))));
  const bigLines = big.length > 22 ? wrap(big, 18) : [big];
  const bs = bigLines.length > 1 ? Math.min(bigSize * 1.7, 96) : bigSize;
  const textLines = wrap(card.text, 30), subLines = wrap(card.sub, 40);
  let y = 330;
  const parts = [`<text x="${S / 2}" y="${y}" text-anchor="middle" font-size="150">${esc(card.emoji || "")}</text>`];
  y += 70 + bs * 0.9;
  bigLines.forEach((l, k) => parts.push(`<text x="${S / 2}" y="${y + k * bs * 1.05}" text-anchor="middle" font-family="${FONT}" font-size="${bs}" font-weight="800" fill="${fg}">${esc(l)}</text>`));
  y += (bigLines.length - 1) * bs * 1.05 + 80;
  textLines.forEach((l, k) => parts.push(`<text x="${S / 2}" y="${y + k * 62}" text-anchor="middle" font-family="${FONT}" font-size="50" font-weight="600" fill="${fg}">${esc(l)}</text>`));
  y += textLines.length * 62 + 40;
  subLines.forEach((l, k) => parts.push(`<text x="${S / 2}" y="${y + k * 48}" text-anchor="middle" font-family="${FONT}" font-size="36" fill="${accent}">${esc(l)}</text>`));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${defs}<rect width="${S}" height="${S}" fill="${bg}"/>${logoEl}${parts.join("")}${footer}</svg>`;
}

// The map: Canada + US outlines, state lines, a gold dot per city, white stars for Brooks & Calgary
export async function mapSVG(cities, pos) {
  const [{ geoConicConformal, geoPath }, { feature, mesh }, world, us] = await Promise.all([
    import("d3-geo"), import("topojson-client"), import("world-atlas/countries-50m.json"), import("us-atlas/states-10m.json"),
  ]);
  const w = world.default || world, u = us.default || us;
  const countries = feature(w, w.objects.countries).features.filter(f => ["124", "840", "484"].includes(String(f.id)));
  const states = mesh(u, u.objects.states, (a, b) => a !== b);
  // Frame: southern Canada / lower 48 plus wherever we actually shipped
  const pts = Object.values(pos);
  const lats = [...pts.map(p => p[0]), 30, 61], lons = [...pts.map(p => p[1]), -128, -62];
  const box = { type: "Feature", geometry: { type: "MultiPoint", coordinates: [[Math.min(...lons) - 3, Math.min(...lats) - 2], [Math.max(...lons) + 3, Math.max(...lats) + 2]] } };
  const proj = geoConicConformal().parallels([35, 60]).rotate([100, 0]).fitExtent([[60, 250], [S - 60, S - 110]], box);
  const path = geoPath(proj);
  const land = countries.map(f => `<path d="${path(f)}" fill="${String(f.id) === "484" ? "#1a1a1a" : "#242424"}" stroke="#3a3a3a" stroke-width="1.5"/>`).join("");
  const lines = `<path d="${path(states)}" fill="none" stroke="#333" stroke-width="1"/>`;
  const dots = cities.map(c => { const p = pos[cityKey(c)]; if (!p) return ""; const [x, y] = proj([p[1], p[0]]) || []; return x ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.min(16, 7 + Math.sqrt(c.orders) * 1.2).toFixed(1)}" fill="${GOLD}" fill-opacity=".9" stroke="#111" stroke-width="2"/>` : ""; }).join("");
  const home = Object.values(HOMES).map(([la, lo]) => { const [x, y] = proj([lo, la]); return `<text x="${x}" y="${y + 12}" text-anchor="middle" font-size="34" fill="#fff">★</text>`; }).join("");
  return `<g><clipPath id="mc"><rect x="40" y="230" width="${S - 80}" height="${S - 330}"/></clipPath><g clip-path="url(#mc)">${land}${lines}${dots}${home}</g>
    <text x="70" y="${S - 112}" font-family="${FONT}" font-size="24" fill="#999"><tspan fill="${GOLD}">●</tspan> delivery city   <tspan fill="#fff">★</tspan> Brooks &amp; Calgary</text>
    <text x="${S - 70}" y="${S - 112}" text-anchor="end" font-family="${FONT}" font-size="16" fill="#555">Map data © OpenStreetMap contributors</text></g>`;
}

// SVG → PNG
export function svgToCanvas(svg, size = S) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = size; c.height = size; c.getContext("2d").drawImage(img, 0, 0, size, size); resolve(c); };
    img.onerror = reject;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
export function download(canvas, name) {
  return new Promise(res => canvas.toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); res(); }, 400); }, "image/png"));
}
// One tall image for email: cards two across
export async function emailGraphic(svgs) {
  const cell = 540, cols = 2, rows = Math.ceil(svgs.length / cols), c = document.createElement("canvas");
  c.width = cell * cols; c.height = cell * rows; const g = c.getContext("2d"); g.fillStyle = INK; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < svgs.length; i++) { const cv = await svgToCanvas(svgs[i], cell); g.drawImage(cv, (i % cols) * cell, Math.floor(i / cols) * cell); }
  return c;
}
// Images used inside the SVG must be data URLs so they survive conversion to PNG
export async function toDataURL(url) {
  if (!url || url.startsWith("data:")) return url;
  const b = await (await fetch(url)).blob();
  return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
}
