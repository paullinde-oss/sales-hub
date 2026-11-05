// ─── Year in Review (customer-facing, two pages) ─────────────────────────────
// Calendar year vs the year before (Paul: "2027 compared to 2026", not fiscal). Made for
// distributors, so it shows dollars. Page 1: totals, month by month, spending by category.
// Page 2: top 10 products, products new this year, "popular with distributors like you".
// Freight is left out everywhere (totals, months, categories, products).
// Opens a print window → "Save as PDF"; file name "Customer — 2026 BMP Supplies Year in Review".
import { fmtMoney, fmtQty, orderAmount, orderCurrency, today } from "./salesUtils";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);
const up = s => String(s || "").trim().toUpperCase();
const NOT_PRODUCT = /^(CUSTOM|LABELS|FREIGHT|FRT)$/i;
const GOLD = "#a07828", GREEN = "#3d7f3d", RED = "#b0503f", GREY = "#d6d3cc";

const change = (a, b, big) => {
  const p = pct(a, b);
  if (p === null) return a ? `<span class="chg up">new</span>` : "";
  return `<span class="chg ${p >= 0 ? "up" : "down"}${big ? " big" : ""}">${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(0)}%</span>`;
};

// The period: a full calendar year, or (for the year in progress) Jan 1 → today vs the same dates last year
export function reviewPeriod(year) {
  const t = today(), inProgress = t < `${year}-12-31` && t >= `${year}-01-01`;
  const end = inProgress ? t : `${year}-12-31`;
  return { year, inProgress, from: `${year}-01-01`, to: end, pfrom: `${year - 1}-01-01`, pto: `${year - 1}${end.slice(4)}` };
}

function numbers(c, per, ctx) {
  const cur = c.orders.filter(o => o.date >= per.from && o.date <= per.to);
  const prev = c.orders.filter(o => o.date >= per.pfrom && o.date <= per.pto);
  const curs = new Set([...cur, ...prev].map(orderCurrency));
  const currency = curs.size === 1 ? [...curs][0] : "CAD";
  const conv = (amt, o) => (curs.size > 1 && orderCurrency(o) === "USD" ? amt * ctx.usdToCad : amt);
  const sum = list => {
    const r = { total: 0, orders: list.length, months: Array(12).fill(0), cats: new Map(), skus: new Map() };
    list.forEach(o => {
      const amt = conv(orderAmount(o, false), o); // without freight (Paul: freight isn't part of this report)
      r.total += amt; r.months[+o.date.slice(5, 7) - 1] += amt;
      (o.lines || []).forEach(l => {
        const a = conv(l.amount || 0, o), k = l.sku && !NOT_PRODUCT.test(l.sku) ? up(l.sku) : `desc:${l.desc}`;
        const cat = ctx.categories[l.sku] || ctx.categories[up(l.sku)] || "Other products";
        r.cats.set(cat, (r.cats.get(cat) || 0) + a);
        const g = r.skus.get(k) || { sku: l.sku && !NOT_PRODUCT.test(l.sku) ? l.sku : "", desc: l.desc || "", qty: 0, sales: 0 };
        g.qty += l.qty || 0; g.sales += a; r.skus.set(k, g);
      });
    });
    r.avg = r.orders ? r.total / r.orders : 0;
    return r;
  };
  return { currency, mixed: curs.size > 1, cur: sum(cur), prev: sum(prev) };
}

// "Popular with distributors like you": products that other distributors who buy the same
// things also buy, which this customer hasn't bought in the last two years. Only products on
// the current product list; other customers are never named.
function recommend(c, per, ctx, n = 3) {
  const since = per.pfrom, mine = new Set();
  c.orders.filter(o => o.date >= since).forEach(o => (o.lines || []).forEach(l => l.sku && mine.add(up(l.sku))));
  if (!mine.size) return [];
  const byCust = new Map();
  ctx.allOrders.filter(o => o.date >= since && o.cust?.type === "Distributor" && o.cust.key !== c.key).forEach(o => {
    const s = byCust.get(o.cust.key) || new Map();
    (o.lines || []).forEach(l => { const k = up(l.sku); if (k && !NOT_PRODUCT.test(k)) s.set(k, (s.get(k) || 0) + (l.qty || 0)); });
    byCust.set(o.cust.key, s);
  });
  const score = new Map();
  byCust.forEach(skus => {
    const overlap = [...skus.keys()].filter(k => mine.has(k)).length;
    if (!overlap) return;
    skus.forEach((qty, k) => {
      if (mine.has(k) || !ctx.productBy.has(k)) return;
      const s = score.get(k) || { k, score: 0, buyers: 0, qty: 0 };
      s.score += overlap; s.buyers++; s.qty += qty; score.set(k, s);
    });
  });
  return [...score.values()].filter(s => s.buyers >= 2).sort((a, b) => b.score - a.score || b.qty - a.qty).slice(0, n)
    .map(s => ({ ...s, p: ctx.productBy.get(s.k) }));
}

function monthChart(cur, prev, year) {
  const W = 700, H = 170, padB = 20, max = Math.max(1, ...cur, ...prev), bw = W / 12;
  const bars = MON.map((m, i) => {
    const h1 = (prev[i] / max) * (H - padB - 6), h2 = (cur[i] / max) * (H - padB - 6), x = i * bw;
    return `<rect x="${x + bw * .16}" y="${H - padB - h1}" width="${bw * .32}" height="${h1}" rx="2" fill="${GREY}"/>
      <rect x="${x + bw * .52}" y="${H - padB - h2}" width="${bw * .32}" height="${h2}" rx="2" fill="${GOLD}"/>
      <text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle" font-size="10" fill="#777">${m}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block"><line x1="0" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="#ccc"/>${bars}</svg>
    <div class="legend"><span><i style="background:${GREY}"></i>${year - 1}</span><span><i style="background:${GOLD}"></i>${year}</span></div>`;
}

function categoryBars(d, money) {
  const cats = [...new Set([...d.cur.cats.keys(), ...d.prev.cats.keys()])]
    .map(c => ({ c, a: d.cur.cats.get(c) || 0, b: d.prev.cats.get(c) || 0 })).filter(x => x.a > 0 || x.b > 0).sort((x, y) => y.a - x.a || y.b - x.b).slice(0, 7);
  const max = Math.max(1, ...cats.map(x => Math.max(x.a, x.b)));
  return cats.map(x => `<div class="cat">
    <div class="cn">${esc(x.c)}</div>
    <div class="cb"><div class="bar prev" style="width:${(x.b / max) * 100}%"></div><div class="bar" style="width:${(x.a / max) * 100}%"></div></div>
    <div class="cv">${money(x.a)}</div><div class="cc">${change(x.a, x.b)}</div>
  </div>`).join("");
}

function report(c, per, ctx) {
  const d = numbers(c, per, ctx), Y = per.year;
  const money = n => fmtMoney(n, 0), money2 = n => fmtMoney(n, 2);
  const label = per.inProgress ? `${Y} so far (Jan 1 – ${new Date(per.to + "T12:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })})` : `${Y}`;
  const plabel = per.inProgress ? `same dates in ${Y - 1}` : `${Y - 1}`;
  const logo = ctx.logos[c.key]?.dataUrl;
  const head = `<div class="hdr">
    ${logo ? `<img class="clogo" src="${esc(logo)}"/>` : `<div class="clogo ph">${esc(c.name.slice(0, 2).toUpperCase())}</div>`}
    <div class="ht"><div class="eyebrow">${per.inProgress ? `${Y} year to date` : `${Y} Year in Review`}</div><h1>${esc(c.name)}</h1><div class="sub">${label} compared with ${plabel} · ${d.currency}${d.mixed ? " (USD converted)" : ""}</div></div>
    ${ctx.bmpLogo ? `<img class="bmp" src="${ctx.bmpLogo}"/>` : `<div class="bmpt">BMP SUPPLIES</div>`}
  </div>`;
  const skuCountNow = [...d.cur.skus.values()].filter(s => s.sku).length, skuCountPrev = [...d.prev.skus.values()].filter(s => s.sku).length;
  const kpi = (l, v, sub) => `<div class="kpi"><div class="kl">${l}</div><div class="kv">${v}</div><div class="kc">${sub}</div></div>`;
  const ch = pct(d.cur.total, d.prev.total);
  const page1 = `<div class="page">${head}
    <div class="kpis">
      ${kpi("Total purchases", money(d.cur.total), `${change(d.cur.total, d.prev.total, true)} <span>vs ${money(d.prev.total)}</span>`)}
      ${kpi("Orders placed", d.cur.orders, `${change(d.cur.orders, d.prev.orders)} <span>vs ${d.prev.orders}</span>`)}
      ${kpi("Average order", money(d.cur.avg), `${change(d.cur.avg, d.prev.avg)} <span>vs ${money(d.prev.avg)}</span>`)}
      ${kpi("Products purchased", skuCountNow, `<span>${skuCountPrev} in ${Y - 1}</span>`)}
    </div>
    ${d.prev.total ? `<div class="headline">${ch >= 0 ? `Your purchases with BMP Supplies grew <b>${Math.abs(ch).toFixed(0)}%</b>` : `Your purchases with BMP Supplies were <b>${Math.abs(ch).toFixed(0)}%</b> lower`} compared with ${plabel}.</div>` : ""}
    <h2>Month by month</h2>${monthChart(d.cur.months, d.prev.months, Y)}
    <h2>Spending by product category</h2><div class="cats">${categoryBars(d, money)}</div>
    <div class="legend" style="margin-top:4px"><span><i style="background:${GREY}"></i>${Y - 1}</span><span><i style="background:${GOLD}"></i>${Y}</span></div>
  </div>`;

  const top = [...d.cur.skus.values()].filter(s => s.sales > 0).sort((a, b) => b.sales - a.sales).slice(0, 10);
  const prevBy = d.prev.skus;
  const added = [...d.cur.skus.entries()].filter(([k, s]) => s.sku && s.sales > 0 && !prevBy.get(k)).map(([, s]) => s).sort((a, b) => b.sales - a.sales).slice(0, 6);
  const recs = recommend(c, per, ctx);
  const page2 = `<div class="page">${head}
    <h2>Your top products in ${Y}</h2>
    <table><thead><tr><th>Product</th><th class="r">Qty</th><th class="r">Spent</th><th class="r">vs ${Y - 1}</th></tr></thead><tbody>
      ${top.map((s, i) => { const p = [...prevBy.values()].find(x => x.sku && x.sku === s.sku) || prevBy.get(`desc:${s.desc}`); return `<tr><td><span class="rank">${i + 1}</span> <b>${esc(s.desc || s.sku)}</b>${s.sku ? ` <span class="small">${esc(s.sku)}</span>` : ""}</td><td class="r">${fmtQty(s.qty)}</td><td class="r">${money(s.sales)}</td><td class="r">${p ? change(s.qty, p.qty) : `<span class="chg up">new</span>`}</td></tr>`; }).join("")}
    </tbody></table>
    ${added.length ? `<h2>New for you this year</h2><div class="pills">${added.map(s => `<div class="pill"><b>${esc(s.desc || s.sku)}</b><span>${esc(s.sku)} · ${money(s.sales)}</span></div>`).join("")}</div>` : ""}
    ${recs.length ? `<h2>Popular with distributors like you</h2><div class="note">Products often ordered by distributors who buy the same products you do — ask us about pricing and availability.</div>
      <div class="recs">${recs.map(r => `<div class="rec"><div class="rt">${esc(r.p.description || r.p.product || r.k)}</div><div class="rs">${esc(r.p.sku)}${r.p.category ? "" : ""}</div></div>`).join("")}</div>` : ""}
    <div class="thanks"><b>Thank you for your business in ${Y}.</b> We appreciate the partnership and look forward to working with you in ${Y + 1}.<br/>Questions or a quote: sales@bmpsupplies.com · 604.542.0222 · bmpsupplies.com</div>
  </div>`;
  return page1 + page2;
}

const CSS = `
  @page { size: letter; margin: 12mm; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { page-break-after: always; } .page:last-child { page-break-after: auto; }
  .hdr { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid ${GOLD}; padding-bottom: 10px; margin-bottom: 14px; }
  .clogo { width: 96px; height: 60px; object-fit: contain; } .clogo.ph { display: flex; align-items: center; justify-content: center; background: #f2efe8; color: ${GOLD}; font-size: 22px; font-weight: 700; border-radius: 4px; }
  .ht { flex: 1; } .eyebrow { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: ${GOLD}; font-weight: 700; }
  h1 { font-size: 24px; margin: 2px 0; } .sub { color: #666; font-size: 11px; } .bmp { height: 36px; } .bmpt { font-weight: 700; letter-spacing: .12em; color: ${GOLD}; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .1em; color: #555; margin: 18px 0 8px; border-bottom: 1px solid #e6e3dc; padding-bottom: 4px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .kpi { border: 1px solid #e3e0d8; border-radius: 6px; padding: 12px; background: #faf9f6; }
  .kl { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #777; } .kv { font-size: 24px; font-weight: 700; margin: 4px 0; } .kc { font-size: 10px; color: #777; } .kc span { color: #888; }
  .chg { font-weight: 700; font-size: 10px; white-space: nowrap; } .chg.big { font-size: 12px; } .chg.up { color: ${GREEN}; } .chg.down { color: ${RED}; }
  .headline { margin: 12px 0 0; font-size: 13px; line-height: 1.5; background: #f6f2e8; border-left: 4px solid ${GOLD}; padding: 9px 12px; }
  .legend { display: flex; gap: 14px; font-size: 10px; color: #555; margin-top: 2px; } .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
  .cat { display: grid; grid-template-columns: 170px 1fr 80px 54px; align-items: center; gap: 10px; margin: 7px 0; }
  .cn { font-weight: 600; font-size: 11px; } .cb { position: relative; height: 22px; } .bar { height: 10px; background: ${GOLD}; border-radius: 0 3px 3px 0; margin: 1px 0; } .bar.prev { background: ${GREY}; }
  .cv { text-align: right; font-weight: 700; } .cc { text-align: right; }
  table { width: 100%; border-collapse: collapse; } th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #666; background: #f2f2f0; padding: 6px; }
  td { padding: 6px; border-bottom: 1px solid #eee; } .r { text-align: right; white-space: nowrap; } .small { font-size: 9px; color: #888; }
  .rank { display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 9px; background: #f2efe8; color: ${GOLD}; font-size: 10px; font-weight: 700; }
  .pills { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; } .pill { border: 1px solid #e3e0d8; border-radius: 6px; padding: 8px 10px; background: #faf9f6; } .pill b { display: block; font-size: 11px; } .pill span { font-size: 10px; color: #777; }
  .recs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; } .rec { border: 1px solid ${GOLD}; border-radius: 6px; padding: 10px 12px; background: #fdfbf6; } .rt { font-weight: 700; font-size: 11.5px; } .rs { font-size: 10px; color: #777; margin-top: 3px; }
  .note { color: #777; font-size: 10px; margin: -2px 0 8px; }
  .thanks { margin-top: 22px; padding: 12px 14px; background: #1a1a1a; color: #eee; border-radius: 6px; font-size: 11px; line-height: 1.6; } .thanks b { color: #e0c48a; }
  .toolbar { position: sticky; top: 0; background: #111; color: #eee; padding: 8px 14px; display: flex; gap: 10px; align-items: center; font-size: 12px; }
  .toolbar button { background: #c8a96e; border: none; padding: 6px 14px; font-weight: 600; cursor: pointer; }
  .wrap { max-width: 8in; margin: 0 auto; padding: 16px; } @media print { .toolbar { display: none; } .wrap { padding: 0; max-width: none; } }
`;

/**
 * customers: [{ key, name, orders }] · year: calendar year · allOrders: every (enriched) order, for
 * recommendations · products: current product list · categories: { sku: category }
 */
export function buildYearInReviewHTML({ customers, year, allOrders, products = [], categories = {}, usdToCad = 1.37, logos = {}, bmpLogo = "" }) {
  const per = reviewPeriod(year);
  const productBy = new Map(products.filter(p => p.sku).map(p => [up(p.sku), { ...p, category: categories[p.sku] }]));
  const ctx = { allOrders, categories, usdToCad, logos, bmpLogo, productBy };
  const safe = n => String(n).replace(/[\\/:*?"<>|]+/g, "-").trim();
  const title = customers.length === 1 ? `${safe(customers[0].name)} — ${year} BMP Supplies Year in Review` : `${year} BMP Supplies Year in Review — ${customers.length} customers`;
  const body = customers.map(c => report(c, per, ctx)).join("");
  return { title, html: `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
    <div class="toolbar">${esc(title)}<div style="flex:1"></div>Choose “Save as PDF” as the printer. <button onclick="window.print()">Save as PDF / Print</button></div>
    <div class="wrap">${body}</div></body></html>` };
}

export function openYearInReview(args) {
  const w = window.open("", "_blank");
  if (!w) { alert("Your browser blocked the report window. Allow pop-ups for the Sales Hub and try again."); return; }
  const { title, html } = buildYearInReviewHTML(args);
  w.document.write(html.replace("</body>", `<script>window.onload = () => setTimeout(() => window.print(), 500);<\/script></body>`));
  w.document.close(); w.document.title = title;
}
