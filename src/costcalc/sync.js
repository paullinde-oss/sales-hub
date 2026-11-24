// ─── Calculators → the product cost list (config/productCosts) ───────────────
// Since Nov 2026 the Cost Calculator is the ONLY source of product costs (Paul): the cost list is
// exactly what the calculators that "Set product costs" work out (Canada), plus the "__" settings
// kept in the same locked store (category targets, Income Statement link). Typed / imported costs are gone.
import { costsFromBook, rateValues } from "./model";

// Exact SKU match — dots matter (TBC2.550T1DOT = 2.5' is not TBC2550T1DOT = 25')
export const calcSkuKey = s => String(s || "").toUpperCase().replace(/[\s\-_]/g, "").replace(/^BMP(?=[A-Z])/, "");
const up = s => String(s || "").trim().toUpperCase();

export function priceLookup(productsCAD, productsUSD, usdRate) {
  const ca = new Map(productsCAD.map(p => [calcSkuKey(p.sku), p])), us = new Map(productsUSD.map(p => [calcSkuKey(p.sku), p]));
  return (sku, mkt, field = "price") => {
    const p = (mkt === "us" ? us : ca).get(calcSkuKey(sku));
    const v = p ? parseFloat(String(p[field] ?? "").replace(/[^0-9.\-]/g, "")) : NaN;
    return isNaN(v) || !v ? null : mkt === "us" ? v * usdRate : v;
  };
}

/** The cost list the calculators give. Unchanged costs keep their old date/who. */
export function costMapFromBook(book, oldMap = {}, productsCAD = [], productsUSD = [], hubUsdRate, by = "", at = new Date().toISOString()) {
  const rates = { ...book.rates, usdRate: book.rates?.usdRate || hubUsdRate || 1.38 };
  const priceOf = priceLookup(productsCAD, productsUSD, rateValues(rates).usdRate);
  const fromCalc = costsFromBook({ ...book, rates }, (s, m) => priceOf(s, m, "price"));
  const real = new Map(productsCAD.map(p => [calcSkuKey(p.sku), p.sku]));
  const map = {};
  Object.entries(oldMap || {}).forEach(([k, v]) => { if (k.startsWith("__")) map[k] = v; });
  Object.entries(fromCalc).forEach(([sku, v]) => {
    const key = up(real.get(calcSkuKey(sku)) || sku), old = oldMap?.[key];
    map[key] = old && Math.abs((old.cost || 0) - v.cost) < 0.005 && old.source === v.source ? old : { ...v, at, by };
  });
  return map;
}

/** True when the stored list differs from what the calculators give (a typed cost, a stale number…) */
export function costsDiffer(a = {}, b = {}) {
  const skus = o => Object.keys(o).filter(k => !k.startsWith("__")).sort();
  const ka = skus(a), kb = skus(b);
  if (ka.join("|") !== kb.join("|")) return true;
  return ka.some(k => Math.abs((a[k]?.cost || 0) - (b[k]?.cost || 0)) >= 0.005 || a[k]?.source !== b[k]?.source);
}
