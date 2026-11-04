// ─── Product costs (for margins) ─────────────────────────────────────────────
// Costs are the most sensitive numbers in the hub and the database is open to anyone who knows
// how to look, so they're stored ENCRYPTED in config/productCosts. The key comes from a separate
// "cost password" that only cost viewers (Users & Access → Costs & margins) know; it's typed once
// per computer and kept only in that browser. Forgotten password → re-import from the calculators.
//   map: { SKU: { cost, at, by, source } }  (cost in CAD per unit — per roll, section, package …)
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState, useCallback } from "react";
import { up, priceNum, PRICE_FIELDS } from "./priceLists";

const LS = "bmp_cost_pass";
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function keyFrom(pass, salt) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function seal(obj, pass, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(pass, salt), enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), data: b64(data) };
}
async function open(box, pass, salt) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, await keyFrom(pass, salt), unb64(box.data));
  return JSON.parse(dec.decode(plain));
}
const readPass = () => { try { return localStorage.getItem(LS) || ""; } catch { return ""; } };
const writePass = p => { try { p ? localStorage.setItem(LS, p) : localStorage.removeItem(LS); } catch {} };

// status: "loading" | "none" (never set up) | "locked" (need the cost password) | "ready" | "hidden"
export function useCosts(db, allowed) {
  const [docData, setDocData] = useState(undefined);
  const [state, setState] = useState({ status: "loading", costs: {}, error: "" });
  useEffect(() => {
    if (!allowed) { setState({ status: "hidden", costs: {} }); return; }
    return onSnapshot(doc(db, "config", "productCosts"), s => setDocData(s.exists() ? s.data() : null), () => setDocData(null));
  }, [db, allowed]);
  const tryOpen = useCallback(async (pass, d = docData) => {
    if (!d) return false;
    try { const costs = await open(d.box, pass, unb64(d.salt)); writePass(pass); setState({ status: "ready", costs, error: "", at: d.updatedAt, by: d.updatedBy }); return true; }
    catch { return false; }
  }, [docData]);
  useEffect(() => {
    if (!allowed || docData === undefined) return;
    if (docData === null) { setState({ status: "none", costs: {} }); return; }
    const p = readPass();
    (async () => { if (!(p && await tryOpen(p, docData))) setState(s => ({ ...s, status: "locked", costs: {} })); })();
  }, [docData, allowed]); // eslint-disable-line

  const unlock = async pass => { const ok = await tryOpen(pass); if (!ok) setState(s => ({ ...s, error: "That cost password didn't work." })); return ok; };
  // Save the whole cost list (re-encrypted). setUp: first time, choose the cost password.
  const save = async (costs, by, setUpPass) => {
    const pass = setUpPass || readPass();
    if (!pass) throw new Error("Unlock costs first.");
    const salt = docData?.salt ? unb64(docData.salt) : crypto.getRandomValues(new Uint8Array(16));
    const box = await seal(costs, pass, salt);
    await setDoc(doc(db, "config", "productCosts"), { salt: b64(salt), box, updatedAt: new Date().toISOString(), updatedBy: by || "" });
    if (setUpPass) writePass(setUpPass);
    setState({ status: "ready", costs, error: "" });
  };
  const forget = () => { writePass(""); setState(s => ({ ...s, status: "locked", costs: {} })); };
  return { ...state, unlock, save, forget };
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
