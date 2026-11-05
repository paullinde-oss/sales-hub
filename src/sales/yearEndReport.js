// ─── Fiscal-year comparison for one customer (used on the customer page) ─────
// The customer-facing "Year in Review" PDF is in yearInReview.js (calendar years).
import { fyStart, fyEnd, today, addDays, parseYmd, fmtDate, fmtMoney, fmtQty, orderAmount, orderCurrency } from "./salesUtils";

const MON = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);
const fmtPct = p => (p == null ? "—" : `${p >= 0 ? "+" : "−"}${Math.abs(p).toFixed(0)}%`);
const fiscalMonth = s => { const m = parseYmd(s).getMonth(); return m === 11 ? 0 : m + 1; };

// All the numbers for one customer and fiscal year. Also used on the customer page.
export function yearCompare(orders, fy, usdToCad, { samePeriod } = {}) {
  const now = today();
  const inProgress = now < fyEnd(fy);
  const curTo = inProgress ? now : fyEnd(fy);
  const prevTo = (samePeriod ?? inProgress) ? addDays(curTo, -365) : fyEnd(fy - 1);
  const cur = orders.filter(o => o.date >= fyStart(fy) && o.date <= curTo);
  const prev = orders.filter(o => o.date >= fyStart(fy - 1) && o.date <= prevTo);
  const both = [...cur, ...prev];
  const curs = new Set(both.map(orderCurrency));
  const currency = curs.size === 1 ? [...curs][0] : "CAD";
  const conv = (amt, o) => (curs.size > 1 && orderCurrency(o) === "USD" ? amt * usdToCad : amt);

  const summarise = list => {
    const r = { total: 0, products: 0, freight: 0, orders: list.length, units: 0, months: Array(12).fill(0), noPrice: 0 };
    for (const o of list) {
      r.total += conv(orderAmount(o, true), o);
      r.products += conv((o.productTotal || 0) + (o.otherCharges || 0), o);
      r.freight += conv(o.freight || 0, o);
      r.months[fiscalMonth(o.date)] += conv(orderAmount(o, true), o);
      for (const l of o.lines || []) r.units += l.qty || 0;
      if (!o.hasPricing && (o.override?.total == null || o.override.total === "")) r.noPrice++;
    }
    r.avg = r.orders ? r.total / r.orders : 0;
    return r;
  };
  const bySku = list => {
    const m = new Map();
    for (const o of list) for (const l of o.lines || []) {
      const k = l.sku || l.desc;
      const g = m.get(k) || { sku: l.sku || "", desc: l.desc || "", qty: 0, sales: 0, orders: new Set() };
      g.qty += l.qty || 0; g.sales += conv(l.amount || 0, o); g.orders.add(o.orderNo);
      m.set(k, g);
    }
    return m;
  };
  const a = bySku(cur), b = bySku(prev);
  const skus = [...new Set([...a.keys(), ...b.keys()])].map(k => {
    const x = a.get(k), y = b.get(k);
    return { sku: (x || y).sku, desc: (x || y).desc, qty: x?.qty || 0, sales: x?.sales || 0, orders: x?.orders.size || 0, pqty: y?.qty || 0, psales: y?.sales || 0, porders: y?.orders.size || 0 };
  });
  return {
    fy, currency, mixed: curs.size > 1, inProgress, curTo, prevTo, cur: summarise(cur), prev: summarise(prev), curOrders: cur, prevOrders: prev,
    top: skus.filter(s => s.qty || s.sales).sort((x, y) => y.sales - x.sales || y.qty - x.qty),
    more: skus.filter(s => s.qty && s.pqty && s.qty > s.pqty).sort((x, y) => (y.qty - y.pqty) / y.pqty - (x.qty - x.pqty) / x.pqty),
    less: skus.filter(s => s.qty && s.pqty && s.qty < s.pqty).sort((x, y) => (x.qty - x.pqty) / x.pqty - (y.qty - y.pqty) / y.pqty),
    same: skus.filter(s => s.qty && s.pqty && s.qty === s.pqty),
    added: skus.filter(s => s.qty && !s.pqty).sort((x, y) => y.sales - x.sales),
    dropped: skus.filter(s => !s.qty && s.pqty).sort((x, y) => y.psales - x.psales),
  };
}
