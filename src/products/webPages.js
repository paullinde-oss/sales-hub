// ─── Product pages on the website (bmpsupplies.com) ──────────────────────────
// Clicking a SKU in the hub shows the product's photo, name and short description from its
// page on our Wix website, with a "View more" button that opens the page.
//
// • The website is read once a week by a GitHub job (scripts/productPages.mjs,
//   .github/workflows/productpages.yml) and saved in Firestore config/productPages:
//     pages: { slug: { url, name, desc, image } }   ← written by the weekly job only
//     fetch: { at, ok, count, error }               ← how the last weekly read went
//     links: { SKUKEY: slug | "" }                  ← hand-picked pages (Products & Price List →
//                                                     Website pages, or a product's ✏ Edit row);
//                                                     "" = "no website page" for that SKU
// • A SKU finds its page by product FAMILY, not exact SKU: the digits are just sizes, so any
//   TBC…T1IND is the Type 1 Industrial turbidity curtain page. FAMILIES below lists one rule per
//   family on the Products list. A hand-picked page always wins over the rule.
import { useEffect, useState } from "react";
import { getFirestore, doc, onSnapshot, updateDoc, setDoc, deleteField } from "firebase/firestore";

export const SITE = "https://www.bmpsupplies.com";
export const pageUrl = slug => `${SITE}/product-page/${slug}`;
export const DOC = ["config", "productPages"];

// SKU → matching key: upper case, letters and digits only, no "BMP" prefix.
// "BMP- BDNS08JR" → "BDNS08JR", "TBC2.550T1IND" → "TBC2550T1IND", "BMPSTK06" → "STK06"
export const skuKey = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^BMP(?=[A-Z])/, "");

// One rule per product family. `re` is tested against skuKey(sku); the first rule that matches
// wins, so more specific families come before broader ones. `slug` is the product page on the
// website (www.bmpsupplies.com/product-page/<slug>); "" = the family has no page on the website.
export const FAMILIES = [
  // Catch basin protection
  { id: "cbd-round-hf", label: "CB Donut — round, high flow", re: /^4CBD\d+DIAHF/, slug: "" },
  { id: "cbd-hf", label: "CB Donut — high flow", re: /^4CBD\d+HF/, slug: "" },
  { id: "cbd-lf", label: "CB Donut — low flow", re: /^4CBD\d+LF/, slug: "" },
  { id: "silt-sack", label: "Silt Sack", re: /^SSC\d/, slug: "" },
  { id: "cb-sack", label: "CB Sack with overflow", re: /^DDS\d/, slug: "" },
  { id: "drain-guard", label: "Drain Guard", re: /^DGD\d/, slug: "" },
  { id: "cb-log", label: "Catch Basin Log", re: /^CBW\d/, slug: "" },
  { id: "curb-inlet", label: "CB Sock — curb inlet filter", re: /^CIF\d/, slug: "" },
  { id: "oil-mat", label: "CB Mat — oil only", re: /^OOF22/, slug: "" },
  { id: "oil-tube", label: "CB Tube — oil only", re: /^OOF48/, slug: "" },
  // Spill & dewatering
  { id: "spring-berm", label: "Spring Berm", re: /^SPB\d/, slug: "" },
  { id: "silt-bag", label: "Dewatering Silt Bag", re: /^SBG\d/, slug: "" },
  { id: "hydronest-liner", label: "HydroNest Liner", re: /^HNL\d/, slug: "" },
  { id: "hydronest", label: "HydroNest Containment Berm", re: /^HN\d/, slug: "" },
  { id: "spill-berm", label: "Spill Containment Berm", re: /^SCB\d/, slug: "" },
  // Turbidity curtains & accessories (size digits in the middle, type at the end)
  { id: "tbc-t1-ind", label: "Turbidity Curtain — Type 1 Industrial", re: /^TBC\d+T1IND$/, slug: "type-1-industrial-turbidity-curtain" },
  { id: "tbc-t1-dot", label: "Turbidity Curtain — Type 1 DOT", re: /^TBC\d+T1DOT$/, slug: "" },
  { id: "tbc-t2-ind", label: "Turbidity Curtain — Type 2 Industrial", re: /^TBC\d+T2IND$/, slug: "" },
  { id: "tbc-t2-dot", label: "Turbidity Curtain — Type 2 DOT", re: /^TBC\d+T2DOT$/, slug: "" },
  { id: "tbc-t3-dot", label: "Turbidity Curtain — Type 3 DOT", re: /^TBC\d+T3DOT$/, slug: "" },
  { id: "boom", label: "Containment Boom", re: /^OCB\d/, slug: "" },
  { id: "anchor-kit", label: "Anchor Kit", re: /^BAK\d/, slug: "" },
  { id: "tow-bridle", label: "Tow Bridle", re: /^TOWBRI\d/, slug: "" },
  // Erosion control blankets (8'/16' rolls, JR = jumbo roll)
  { id: "ssns", label: "Blanket — Standard single net straw", re: /^SSNS\d/, slug: "" },
  { id: "sdns", label: "Blanket — Standard double net straw", re: /^SDNS\d/, slug: "" },
  { id: "sdnsc", label: "Blanket — Standard double net straw/coconut", re: /^SDNSC\d/, slug: "" },
  { id: "sdnc", label: "Blanket — Standard double net coconut", re: /^SDNC\d/, slug: "" },
  { id: "bdns", label: "Blanket — Bio double net straw", re: /^BDNS\d/, slug: "" },
  { id: "bdnsc", label: "Blanket — Bio double net straw/coconut", re: /^BDNSC\d/, slug: "" },
  { id: "bdnc", label: "Blanket — Bio double net coconut", re: /^BDNC\d/, slug: "bio-double-net-coconut" },
  { id: "sdnae", label: "Blanket — Standard double net aspen excelsior", re: /^SDNAE\d/, slug: "" },
  { id: "bsnae", label: "Blanket — Bio single net aspen excelsior", re: /^BSNAE\d/, slug: "" },
  { id: "bdnae", label: "Blanket — Bio double net aspen excelsior", re: /^BDNAE\d/, slug: "" },
  { id: "hvdnae", label: "Blanket — High velocity aspen excelsior", re: /^HVDNAE/, slug: "" },
  { id: "ecb-stake", label: "ECB Stake (6\" / 12\")", re: /^STK(06|12)$/, slug: "" },
  { id: "ecb-staple", label: "ECB U Staple", re: /^STP\d/, slug: "" },
  // Turf reinforcement mats
  { id: "trm-p", label: "TRM — polypropylene", re: /^TRMP\d/, slug: "" },
  { id: "trm-pc", label: "TRM — polypropylene/coconut", re: /^TRMPC\d/, slug: "" },
  { id: "trm-ps", label: "TRM — polypropylene/straw", re: /^TRMPS\d/, slug: "" },
  // Wattles, blocs, stakes
  { id: "bio-ae-wattle", label: "Aspen Excelsior Wattle — biodegradable (burlap)", re: /^BAEW\d/, slug: "" },
  { id: "ae-wattle", label: "Aspen Excelsior Wattle", re: /^AEW\d/, slug: "" },
  { id: "ae-bloc", label: "Aspen Excelsior Bloc", re: /^AEB\d/, slug: "" },
  { id: "straw-wattle", label: "Straw Wattle — standard", re: /^STW\d/, slug: "" },
  { id: "rd-straw-wattle", label: "Straw Wattle — rapid degradable", re: /^RDSTW\d/, slug: "" },
  { id: "bio-straw-wattle", label: "Straw Wattle — biodegradable (burlap)", re: /^BSTW\d/, slug: "" },
  { id: "wattle-stake", label: "Wattle Stake (18\" / 24\")", re: /^STK(18|24)$/, slug: "" },
];

export const familyOf = sku => { const k = skuKey(sku); return k ? FAMILIES.find(f => f.re.test(k)) || null : null; };

// Which page a SKU shows, and why.
// → { slug, how: "picked" | "rule" | "none", family }   (slug "" = no page)
export function resolveSku(sku, data) {
  const k = skuKey(sku), family = familyOf(sku);
  const picked = data?.links?.[k];
  if (k && picked !== undefined) return { slug: picked || "", how: "picked", family };
  if (family?.slug) return { slug: family.slug, how: "rule", family };
  return { slug: "", how: "none", family };
}

// Everything the pop-up needs: website copy when the weekly job has read the page, otherwise the
// Products list's own name/description with a link to the page.
export function previewFor(sku, data, product) {
  const r = resolveSku(sku, data);
  const page = r.slug ? data?.pages?.[r.slug] : null;
  return {
    ...r, sku,
    url: r.slug ? page?.url || pageUrl(r.slug) : "",
    name: page?.name || product?.product || r.family?.label || "",
    desc: page?.desc || product?.description || "",
    image: page?.image || "",
    fromSite: !!page,
  };
}

// ── Shared live copy of config/productPages (one listener for the whole app) ─
let state = null, unsub = null;
const subs = new Set();
function start() {
  if (unsub) return;
  try {
    unsub = onSnapshot(doc(getFirestore(), ...DOC), s => { state = s.exists() ? s.data() : {}; subs.forEach(f => f(state)); },
      e => { console.warn("Website product pages unavailable", e); state = state || {}; subs.forEach(f => f(state)); });
  } catch (e) { console.warn(e); state = {}; }
}
export function useProductPages() {
  const [d, setD] = useState(state);
  useEffect(() => { start(); subs.add(setD); if (state) setD(state); return () => { subs.delete(setD); }; }, []);
  return d;
}

// Pick a page for one SKU by hand. slug: a page slug, "" = no website page, null = back to the rule.
export async function setSkuPage(sku, slug, by) {
  const k = skuKey(sku);
  if (!k) return;
  const ref = doc(getFirestore(), ...DOC);
  const patch = { [`links.${k}`]: slug === null ? deleteField() : slug, [`linkLog.${k}`]: slug === null ? deleteField() : { by: by || "", at: new Date().toISOString() } };
  try { await updateDoc(ref, patch); }
  catch (e) {
    if (e?.code !== "not-found") throw e;
    if (slug === null) return;
    await setDoc(ref, { links: { [k]: slug }, linkLog: { [k]: { by: by || "", at: new Date().toISOString() } } }, { merge: true });
  }
}
// A SKU was renamed on the Products tab: its hand-picked page follows it
export async function moveSkuPage(oldSku, newSku, data) {
  const o = skuKey(oldSku), n = skuKey(newSku);
  if (!o || !n || o === n || data?.links?.[o] === undefined) return;
  await updateDoc(doc(getFirestore(), ...DOC), { [`links.${n}`]: data.links[o], [`links.${o}`]: deleteField() });
}

// ── The pop-up is opened from anywhere via openPreview(); one <ProductPreviewHost/> shows it ─
let opener = null;
export const setPreviewOpener = f => { opener = f; };
export const openPreview = (sku, anchor, product) => { if (opener && sku) opener({ sku, rect: anchor?.getBoundingClientRect?.() || null, product }); };
