// ─── Product costs (for margins) ─────────────────────────────────────────────
// Costs are the most sensitive numbers in the hub and the database is open to anyone who knows
// how to look, so they're stored ENCRYPTED in config/productCosts ({ v: 2, box }) with a random
// "cost key". Each person with "Costs & margins" has a copy of that key locked with their own
// sign-in password (config/logins, see sales/auth.js); signing in unlocks it and keeps it on that
// computer only (localStorage bmp_cost_key). No separate cost password.
//   map: { SKU: { cost, at, by, source }, __targets: {...}, __incomeSheet: "<published CSV link>" }
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { useEffect, useState, useCallback } from "react";
import { up, priceNum, PRICE_FIELDS } from "./priceLists";

const LS = "bmp_cost_key";
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const getCostKey = () => { try { return localStorage.getItem(LS) || ""; } catch { return ""; } };
export const setCostKey = k => { try { k ? localStorage.setItem(LS, k) : localStorage.removeItem(LS); } catch {} try { localStorage.removeItem("bmp_cost_pass"); } catch {} try { window.dispatchEvent(new Event("bmp-cost-key")); } catch {} };
const aesKey = (raw, uses) => crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, uses);
async function passKey(pass, saltB64) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: unb64(saltB64), iterations: 200000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function sealWith(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv: b64(iv), data: b64(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes)) };
}
const openWith = async (key, box) => new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, key, unb64(box.data)));
// The cost key locked / unlocked with a person's password
export const wrapCostKey = async (keyB64, pass, saltB64) => sealWith(await passKey(pass, saltB64), unb64(keyB64));
export const unwrapCostKey = async (box, pass, saltB64) => b64(await openWith(await passKey(pass, saltB64), box));
const sealCosts = async (costs, keyB64) => sealWith(await aesKey(unb64(keyB64), ["encrypt"]), enc.encode(JSON.stringify(costs)));
const openCosts = async (box, keyB64) => JSON.parse(dec.decode(await openWith(await aesKey(unb64(keyB64), ["decrypt"]), box)));

// For Users & Access: the cost key to give someone. First time ever: makes a new key and an empty,
// locked cost list (the old list locked with the forgotten cost password is replaced).
export async function costKeyToGive(db, by) {
  const s = await getDoc(doc(db, "config", "productCosts"));
  const d = s.exists() ? s.data() : null;
  const mine = getCostKey();
  if (d?.v === 2) {
    if (!mine) throw new Error("Your computer doesn't have the costs unlocked — sign out and back in with your own password first.");
    try { await openCosts(d.box, mine); return mine; } catch { throw new Error("The costs on this computer are out of date — sign out and back in with your own password first."); }
  }
  const key = b64(crypto.getRandomValues(new Uint8Array(32)));
  await setDoc(doc(db, "config", "productCosts"), { v: 2, box: await sealCosts({}, key), updatedAt: new Date().toISOString(), updatedBy: by || "" });
  setCostKey(key);
  return key;
}

// status: "loading" | "none" (not set up yet) | "locked" (this computer has no key) | "ready" | "hidden"
export function useCosts(db, allowed) {
  const [docData, setDocData] = useState(undefined);
  const [state, setState] = useState({ status: "loading", costs: {}, error: "" });
  const [keyTick, setKeyTick] = useState(0);
  useEffect(() => {
    if (!allowed) { setState({ status: "hidden", costs: {} }); return; }
    return onSnapshot(doc(db, "config", "productCosts"), s => setDocData(s.exists() ? s.data() : null), () => setDocData(null));
  }, [db, allowed]);
  // Signing in stores the key — look again
  useEffect(() => { const f = () => setKeyTick(t => t + 1); window.addEventListener("bmp-cost-key", f); return () => window.removeEventListener("bmp-cost-key", f); }, []);
  useEffect(() => {
    if (!allowed || docData === undefined) return;
    if (!docData || docData.v !== 2) { setState({ status: "none", costs: {} }); return; }
    const k = getCostKey();
    if (!k) { setState({ status: "locked", costs: {} }); return; }
    openCosts(docData.box, k).then(costs => setState({ status: "ready", costs, error: "", at: docData.updatedAt, by: docData.updatedBy }))
      .catch(() => setState({ status: "locked", costs: {} }));
  }, [docData, allowed, keyTick]);

  // Save the whole cost list (re-encrypted with the cost key)
  const save = useCallback(async (costs, by) => {
    const k = getCostKey();
    if (!k || docData?.v !== 2) throw new Error("Costs aren't unlocked on this computer.");
    await setDoc(doc(db, "config", "productCosts"), { v: 2, box: await sealCosts(costs, k), updatedAt: new Date().toISOString(), updatedBy: by || "" });
    setState({ status: "ready", costs, error: "" });
  }, [db, docData]);
  return { ...state, save };
}

// ── Margins ──────────────────────────────────────────────────────────────────
export const costOf = (costs, sku) => priceNum(costs?.[up(sku)]?.cost);
export const marginPct = (price, cost) => { const p = priceNum(price); return p && cost ? ((p - cost) / p) * 100 : null; };
// Lowest margin across a product's prices (its best discount — usually FTL or pallet)
export function lowestMargin(p, cost) {
  const ms = PRICE_FIELDS.map(f => marginPct(p[f], cost)).filter(m => m !== null);
  return ms.length ? Math.min(...ms) : null;
}

// ── Reading the cost calculators (Excel) ─────────────────────────────────────
// Erosion Control Blanket calculator: sheets "Standard (Poly)" / "Biodegradable (Jute)" have a
// row of SKU headings ("BMP - BDNS08") with a "Total Cost:" row below each (Canada section first).
// Turbidity Curtain calculator: one sheet per type with columns "5' Depth", "7.5' Depth" … and a
// "Total Cost:" row; the SKU is TBC + depth code + 50 (ft) + type, e.g. TBC0550T3DOT.
const DEPTH = { "2.5": "0250", "5": "0550", "7.5": "7550", "10": "1050", "12.5": "1250", "15": "1550", "20": "2050", "25": "2550", "30": "3050" };
const CURTAIN_TYPE = { "type 1 industrial": "T1IND", "type 1 dot": "T1DOT", "type 2 dot": "T2DOT", "type 2 industrial": "T2IND", "type 3 dot": "T3DOT" };
const BOOMS = [[/^18"/, "OCB1850"], [/^12"/, "OCB1250"]];
const isTotal = c => typeof c === "string" && /^total cost:?$/i.test(c.trim());

export async function readCalculator(arrayBuffer, fileName, knownSkus) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const known = new Set([...knownSkus].map(up));
  const found = {};
  const add = (sku, v, sheet) => { const k = up(sku); if (known.has(k) && typeof v === "number" && v > 0 && !found[k]) found[k] = { cost: Math.round(v * 100) / 100, source: `${fileName} › ${sheet}` }; };
  wb.SheetNames.forEach(name => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
    const n = name.trim().toLowerCase();
    if (/^standard \(poly\)$|^biodegradable \(jute\)$/.test(n)) {
      // first SKU heading row = Canada section
      const hi = rows.findIndex(r => r.some(c => typeof c === "string" && /^BMP\s*-\s*[A-Z0-9]+$/i.test(c.trim())));
      if (hi < 0) return;
      rows[hi].forEach((c, col) => {
        if (typeof c !== "string" || !/^BMP\s*-\s*[A-Z0-9]+$/i.test(c.trim())) return;
        const sku = c.replace(/\s+/g, "").toUpperCase();
        for (let i = hi + 1; i < rows.length; i++) { if (isTotal(rows[i][col])) { add(sku, rows[i][col + 1], name); break; } }
      });
    } else if (CURTAIN_TYPE[n]) {
      const head = rows[0] || [], ti = rows.findIndex(r => isTotal(r[0]));
      if (ti < 0) return;
      head.forEach((h, col) => { const m = typeof h === "string" && h.trim().match(/^([\d.]+)'\s*Depth$/i); if (m && DEPTH[m[1]]) add(`TBC${DEPTH[m[1]]}${CURTAIN_TYPE[n]}`, rows[ti][col], name); });
    } else if (n === "oil booms") {
      const head = rows[0] || [], ti = rows.findIndex(r => isTotal(r[0]));
      if (ti < 0) return;
      head.forEach((h, col) => { const b = typeof h === "string" && BOOMS.find(([re]) => re.test(h.trim())); if (b) add(b[1], rows[ti][col], name); });
    }
  });
  return found;
}

// 16' and jumbo blankets aren't in the calculator: estimate them from the 8' roll of the same
// blanket (16' = 2 × 8', 8' jumbo = 5 × 8', 16' jumbo = 10 × 8'), clearly marked as estimates
export function estimateBlankets(found, knownSkus) {
  const out = {};
  [...knownSkus].map(up).forEach(sku => {
    const m = sku.match(/^(BMP-[A-Z]+)(08|16)(JR)?$/); if (!m || found[sku]) return;
    const base = found[`${m[1]}08`]; if (!base || (m[2] === "08" && !m[3])) return;
    const f = (m[2] === "16" ? 2 : 1) * (m[3] ? 5 : 1);
    out[sku] = { cost: Math.round(base.cost * f * 100) / 100, source: `estimate: ${m[1]}08 × ${f}`, estimate: true };
  });
  return out;
}

// ── Other locked cost data (the Cost Calculator) — same cost key as the cost list ──
export const sealLocked = async obj => sealCosts(obj, getCostKey());
export const openLocked = async box => openCosts(box, getCostKey());
