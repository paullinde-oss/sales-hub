// ─── Weekly website read (runs on GitHub Actions — .github/workflows/productpages.yml) ─
// Reads every product page on bmpsupplies.com (Wix) and saves its name, short description,
// photo and link in Firestore config/productPages.pages, for the SKU preview pop-up in the hub.
// Only `pages` and `fetch` are written — hand-picked SKU pages (`links`) are never touched.
// If the website can't be read, the previous copy is kept and the error is shown in the hub
// (Products & Price List → Website pages). Run by hand: npm run productpages
// Bundled with esbuild first because the app code uses browser-style imports.
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, terminate } from "firebase/firestore";
import { firebaseConfig } from "../src/firebaseConfig.js";
import { SITE, DOC, FAMILIES, pageUrl } from "../src/products/webPages.js";

const UA = "Mozilla/5.0 (compatible; BMP-Sales-Hub/1.0; weekly product page read)";
const get = async url => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xml" }, redirect: "follow" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return await r.text();
    } catch (e) { if (i === 2) throw new Error(`${url}: ${e.message || e}`); await new Promise(res => setTimeout(res, 2000 * (i + 1))); }
  }
};

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", deg: "°", sup2: "²", frac12: "½", reg: "®", trade: "™", copy: "©", hellip: "…" };
const decode = s => String(s || "")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z0-9]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const text = s => decode(String(s || "").replace(/<br\s*\/?>/gi, " ").replace(/<\/(p|li|div|h\d)>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
// Short description: the first sentences, up to ~320 characters
const short = s => {
  const t = text(s);
  if (t.length <= 320) return t;
  const cut = t.slice(0, 320), end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "));
  return end > 120 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
};
const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i"));
  const c = m && m[0].match(/content=["']([^"']*)["']/i);
  return c ? decode(c[1]).trim() : "";
};

// Product data from the page's JSON-LD (Wix adds a schema.org Product block), else Open Graph tags
function readPage(html, url) {
  let ld = null;
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      const all = [j, ...(Array.isArray(j) ? j : []), ...(j["@graph"] || [])];
      ld = all.find(x => x && /Product/i.test([].concat(x["@type"] || []).join())) || ld;
    } catch { /* not JSON */ }
  }
  const img = ld?.image ? [].concat(ld.image)[0] : null;
  const image = (typeof img === "string" ? img : img?.contentUrl || img?.url) || meta(html, "og:image");
  const name = text(ld?.name) || meta(html, "og:title").replace(/\s*\|\s*[^|]*$/, "") || text((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]).replace(/\s*\|\s*[^|]*$/, "");
  const desc = short(ld?.description || meta(html, "og:description") || meta(html, "description"));
  return { url, name, desc, image: image || "" };
}

// Every product page the website lists: the store sitemap(s), plus pages the family rules name
async function productUrls() {
  const urls = new Set();
  const index = await get(`${SITE}/sitemap.xml`);
  const maps = [...(index || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => decode(m[1]).trim());
  const storeMaps = maps.filter(u => /store-products|product/i.test(u) && u.endsWith(".xml"));
  for (const sm of storeMaps.length ? storeMaps : maps.filter(u => u.endsWith(".xml"))) {
    const xml = await get(sm);
    [...(xml || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => decode(m[1]).trim()).filter(u => u.includes("/product-page/")).forEach(u => urls.add(u));
  }
  maps.filter(u => u.includes("/product-page/")).forEach(u => urls.add(u));
  FAMILIES.forEach(f => f.slug && urls.add(pageUrl(f.slug)));
  return [...urls];
}

const db = getFirestore(initializeApp(firebaseConfig));
const ref = doc(db, ...DOC);
const save = async patch => {
  try { await updateDoc(ref, patch); }
  catch (e) { if (e?.code === "not-found") await setDoc(ref, patch); else throw e; }
};

try {
  const urls = await productUrls();
  console.log(`${urls.length} product pages listed on ${SITE}`);
  const pages = {}, missing = [];
  for (const url of urls) {
    const slug = decodeURIComponent(url.split("/product-page/")[1] || "").replace(/[/?#].*$/, "");
    if (!slug) continue;
    const html = await get(url);
    if (!html) { missing.push(slug); continue; }
    pages[slug] = readPage(html, `${SITE}/product-page/${slug}`);
    console.log(`  ${slug} — ${pages[slug].name}${pages[slug].image ? "" : " (no photo)"}`);
  }
  if (!Object.keys(pages).length) throw new Error("No product pages could be read from the website");
  // Rules that point at a page the website doesn't have (renamed/removed product) — fix in webPages.js
  const broken = FAMILIES.filter(f => f.slug && !pages[f.slug]);
  broken.forEach(f => console.log(`  ⚠ Family "${f.label}" points at ${f.slug}, which isn't on the website`));
  missing.forEach(s => console.log(`  ⚠ ${s}: page not found`));
  await save({ pages, fetch: { at: new Date().toISOString(), ok: true, count: Object.keys(pages).length, error: "" } });
  console.log(`Saved ${Object.keys(pages).length} product pages.`);
  await terminate(db);
  process.exit(0);
} catch (e) {
  console.error("Website read failed:", e.message || e);
  // Keep the previous copy of the pages; just record the failure for the hub to show
  const prev = await getDoc(ref).then(s => (s.exists() ? s.data().fetch : null)).catch(() => null);
  await save({ fetch: { ...(prev || {}), at: new Date().toISOString(), ok: false, error: String(e.message || e).slice(0, 300) } }).catch(() => {});
  process.exit(1);
}
