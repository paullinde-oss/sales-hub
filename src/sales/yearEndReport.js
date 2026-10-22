// ─── Year-End customer report ("Year in Review") ─────────────────────────────
// Builds a print-ready HTML document (one customer per section, each section a few
// letter-size pages) and opens the browser's print dialog → "Save as PDF".
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

function monthChart(cur, prev, fy) {
  const W = 680, H = 190, padL = 8, padB = 22, max = Math.max(1, ...cur, ...prev);
  const bw = (W - padL * 2) / 12;
  const bars = MON.map((m, i) => {
    const x = padL + i * bw, h1 = (prev[i] / max) * (H - padB - 18), h2 = (cur[i] / max) * (H - padB - 18);
    return `<rect x="${x + bw * .14}" y="${H - padB - h1}" width="${bw * .33}" height="${h1}" rx="2" fill="#d6d3cc"><title>${m} FY${fy - 1}: ${fmtMoney(prev[i])}</title></rect>
      <rect x="${x + bw * .5}" y="${H - padB - h2}" width="${bw * .33}" height="${h2}" rx="2" fill="#a07828"><title>${m} FY${fy}: ${fmtMoney(cur[i])}</title></rect>
      <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#777">${m}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block"><line x1="0" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="#ccc"/>${bars}</svg>`;
}

function section(c, d, bmpLogo, logo) {
  const { fy } = d, money = n => fmtMoney(n, 0), money2 = n => fmtMoney(n, 2);
  const curLabel = d.inProgress ? `FY${fy} to date (Dec 1 – ${fmtDate(d.curTo).replace(/, \d{4}$/, "")})` : `Fiscal ${fy} (Dec 1, ${fy - 1} – Nov 30, ${fy})`;
  const prevLabel = d.inProgress ? `same period FY${fy - 1}` : `FY${fy - 1}`;
  const ch = pct(d.cur.total, d.prev.total);
  const kpi = (label, v, pv, fmt) => `<div class="kpi"><div class="kl">${label}</div><div class="kv">${fmt(v)}</div><div class="kc ${pv == null ? "" : v >= pv ? "up" : "down"}">${pv == null ? "&nbsp;" : `${fmtPct(pct(v, pv))} vs ${fmt(pv)}`}</div></div>`;
  const header = `<div class="hdr">${logo ? `<img class="clogo" src="${logo}"/>` : `<div class="clogo ph">${esc(c.name.slice(0, 2).toUpperCase())}</div>`}
      <div class="ht"><div class="eyebrow">Year in Review · ${esc(curLabel)}</div><h1>${esc(c.name)}</h1><div class="sub">${esc(c.type)}${c.rep && c.rep !== "Unassigned" ? ` · Account manager: ${esc(c.rep)}` : ""} · Amounts in ${d.currency}${d.mixed ? " (USD converted)" : ""}, before tax</div></div>
      ${bmpLogo ? `<img class="bmp" src="${bmpLogo}"/>` : `<div class="bmpt">BMP SUPPLIES</div>`}</div>`;
  const top = d.top.slice(0, 15);
  const share = s => (d.cur.products ? ((s / d.cur.products) * 100).toFixed(1) + "%" : "");
  const cmpRows = (list, sign) => list.map(s => `<tr><td><b>${esc(s.sku)}</b></td><td>${esc(s.desc)}</td><td class="r">${fmtQty(s.pqty)}</td><td class="r">${fmtQty(s.qty)}</td><td class="r ${sign}">${s.qty - s.pqty >= 0 ? "+" : "−"}${fmtQty(Math.abs(s.qty - s.pqty))}</td><td class="r ${sign}">${fmtPct(pct(s.qty, s.pqty))}</td><td class="r">${money(s.psales)}</td><td class="r">${money(s.sales)}</td></tr>`).join("");
  const cmpTable = (title, list, sign, note) => list.length ? `<h3>${title} <span class="n">${list.length}</span></h3>${note ? `<div class="note">${note}</div>` : ""}
      <table><thead><tr><th>SKU</th><th>Product</th><th class="r">Qty ${prevLabel.replace("same period ", "")}</th><th class="r">Qty FY${fy}</th><th class="r">Change</th><th class="r">%</th><th class="r">Sales ${prevLabel.replace("same period ", "")}</th><th class="r">Sales FY${fy}</th></tr></thead><tbody>${cmpRows(list, sign)}</tbody></table>` : "";

  return `
  <section class="page">
    ${header}
    <div class="kpis">
      ${kpi("Total purchases", d.cur.total, d.prev.orders ? d.prev.total : null, money)}
      ${kpi("Orders", d.cur.orders, d.prev.orders ? d.prev.orders : null, n => String(n))}
      ${kpi("Average order", d.cur.avg, d.prev.orders ? d.prev.avg : null, money)}
      ${kpi("Units purchased", d.cur.units, d.prev.orders ? d.prev.units : null, fmtQty)}
    </div>
    <div class="headline">${d.prev.orders
      ? `Purchases ${ch >= 0 ? "grew" : "were down"} <b>${fmtPct(ch).replace(/^[+−]/, "")}</b> compared with ${esc(prevLabel)} (${money(d.prev.total)} → ${money(d.cur.total)}).`
      : `First fiscal year on record with BMP Supplies.`}
      ${d.top[0] ? ` Top product: <b>${esc(d.top[0].desc || d.top[0].sku)}</b>.` : ""}</div>
    <h2>Purchases by month</h2>
    <div class="legend"><span><i style="background:#a07828"></i>FY${fy}</span><span><i style="background:#d6d3cc"></i>FY${fy - 1}</span></div>
    ${monthChart(d.cur.months, d.prev.months, fy)}
    <h2>What you purchased in FY${fy}</h2>
    <table><thead><tr><th>SKU</th><th>Product</th><th class="r">Qty</th><th class="r">Orders</th><th class="r">Sales</th><th class="r">Share</th></tr></thead>
      <tbody>${top.map(s => `<tr><td><b>${esc(s.sku)}</b></td><td>${esc(s.desc)}</td><td class="r">${fmtQty(s.qty)}</td><td class="r">${s.orders}</td><td class="r">${money(s.sales)}</td><td class="r">${share(s.sales)}</td></tr>`).join("")}
      ${d.top.length > 15 ? `<tr><td colspan="6" class="note">+ ${d.top.length - 15} more products</td></tr>` : ""}
      ${d.cur.freight ? `<tr><td></td><td>Freight</td><td></td><td></td><td class="r">${money(d.cur.freight)}</td><td></td></tr>` : ""}</tbody></table>
    ${d.cur.noPrice ? `<div class="note">${d.cur.noPrice} order(s) had no pricing on file and are counted at $0.</div>` : ""}
  </section>
  <section class="page">
    ${header}
    <h2>Compared with ${esc(prevLabel)}</h2>
    <div class="cmpgrid">
      <div><b>${d.more.length}</b> products ordered more</div><div><b>${d.less.length}</b> ordered less</div>
      <div><b>${d.added.length}</b> new this year</div><div><b>${d.dropped.length}</b> not reordered</div>
    </div>
    ${cmpTable("Ordered more", d.more, "up")}
    ${cmpTable("Ordered less", d.less, "down")}
    ${cmpTable("New this year", d.added, "up")}
    ${cmpTable(`Not reordered in FY${fy}`, d.dropped, "down", "Products purchased last year that haven't been ordered this year.")}
    ${cmpTable("Same quantity", d.same, "")}
    ${!d.prev.orders ? `<div class="note">No purchases on file for ${esc(prevLabel)}, so there's nothing to compare yet.</div>` : ""}
  </section>
  <section class="page">
    ${header}
    <h2>Order history — FY${fy}</h2>
    <table><thead><tr><th>Date</th><th>Order #</th><th>PO</th><th>Ship to</th><th>Products</th><th class="r">Amount</th></tr></thead>
      <tbody>${[...d.curOrders].sort((x, y) => (x.date < y.date ? -1 : 1)).map(o => `<tr><td>${fmtDate(o.date)}</td><td>${esc(o.orderNo)}</td><td>${esc(o.po)}</td><td>${esc([o.city, o.region].filter(Boolean).join(", "))}</td><td class="small">${esc((o.lines || []).map(l => `${l.sku} ×${fmtQty(l.qty)}`).join(", "))}</td><td class="r">${money2(orderAmount(o, true))} ${orderCurrency(o)}</td></tr>`).join("")}</tbody></table>
    <div class="foot">Thank you for your business. — BMP Supplies Inc. · 1.855.422.0066 · bmpsupplies.com</div>
  </section>`;
}

const CSS = `
  @page { size: letter; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { page-break-after: always; padding: 4px 0; }
  .page:last-child { page-break-after: auto; }
  .hdr { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #a07828; padding-bottom: 12px; margin-bottom: 16px; }
  .clogo { width: 92px; height: 64px; object-fit: contain; }
  .clogo.ph { display: flex; align-items: center; justify-content: center; background: #f2efe8; color: #a07828; font-size: 22px; font-weight: 700; border-radius: 4px; }
  .ht { flex: 1; } .eyebrow { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #a07828; font-weight: 600; }
  h1 { font-size: 24px; margin: 2px 0; } .sub { color: #666; font-size: 11px; }
  .bmp { height: 34px; } .bmpt { font-weight: 700; letter-spacing: .12em; color: #a07828; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #555; margin: 20px 0 8px; }
  h3 { font-size: 12px; margin: 16px 0 6px; } h3 .n { color: #999; font-weight: 400; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .kpi { border: 1px solid #e3e0d8; border-radius: 4px; padding: 10px 12px; background: #faf9f6; }
  .kl { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #777; } .kv { font-size: 20px; font-weight: 600; margin: 3px 0; }
  .kc { font-size: 10px; color: #777; } .kc.up, td.up { color: #3d7f3d; } .kc.down, td.down { color: #b0503f; }
  .headline { margin: 14px 0 0; font-size: 12px; line-height: 1.5; background: #f6f2e8; border-left: 3px solid #a07828; padding: 8px 12px; }
  .legend { display: flex; gap: 14px; font-size: 10px; color: #555; margin-bottom: 4px; } .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #666; background: #f2f2f0; padding: 5px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; } .r { text-align: right; white-space: nowrap; } .small { font-size: 10px; color: #555; }
  tr { page-break-inside: avoid; }
  .cmpgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 6px; } .cmpgrid div { background: #faf9f6; border: 1px solid #e3e0d8; padding: 8px; border-radius: 4px; } .cmpgrid b { font-size: 16px; color: #a07828; }
  .note { color: #888; font-size: 10px; margin: 4px 0; }
  .foot { margin-top: 24px; color: #999; font-size: 10px; text-align: center; }
  .toolbar { position: sticky; top: 0; background: #111; color: #eee; padding: 8px 14px; display: flex; gap: 10px; align-items: center; font-size: 12px; }
  .toolbar button { background: #c8a96e; border: none; padding: 6px 14px; font-weight: 600; cursor: pointer; }
  .wrap { max-width: 8in; margin: 0 auto; padding: 16px; }
  @media print { .toolbar { display: none; } .wrap { padding: 0; max-width: none; } }
`;

/**
 * customers: [{ name, rep, type, key, orders }]  (orders = all of that customer's orders)
 */
export function openYearEndReport({ customers, fy, usdToCad, logos = {}, bmpLogo = "" }) {
  const w = window.open("", "_blank");
  if (!w) { alert("Your browser blocked the report window. Allow pop-ups for the Sales Hub and try again."); return; }
  const body = customers.map(c => section(c, yearCompare(c.orders, fy, usdToCad), bmpLogo, logos[c.key]?.dataUrl)).join("");
  // The browser uses the page title as the suggested file name when saving as PDF
  const safe = n => String(n).replace(/[\\/:*?"<>|]+/g, "-").trim();
  const title = customers.length === 1
    ? `${safe(customers[0].name)} — FY${fy} BMP Supplies Year in Review`
    : `FY${fy} BMP Supplies Year in Review — ${customers.length} customers`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
    <div class="toolbar">${esc(title)}<div style="flex:1"></div>Choose “Save as PDF” as the printer to save a PDF. <button onclick="window.print()">Save as PDF / Print</button></div>
    <div class="wrap">${body}</div>
    <script>window.onload = () => setTimeout(() => window.print(), 400);<\/script></body></html>`);
  w.document.close();
  w.document.title = title;
}

