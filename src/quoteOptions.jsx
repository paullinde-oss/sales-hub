// ─── Quote options ("Option 1 / Option 2 / …" in one quote) ─────────────────
// A quote can offer up to 5 alternatives. quote.options = [{ name }, …] (2–5 entries)
// switches it on; each line item has li.option = 1…5, or 0 for "Common to all options"
// (e.g. freight), which is added to every option's total. The customer picks one option,
// so a quote never has one grand total:
//   • won  → the option they chose (quote.wonOption)
//   • open / lost / cold → the average of the options
// Everything that needs a quote's dollar value uses quoteValue() so options don't inflate
// totals or win-rate dollars.
import { useEffect, useState } from "react";

export const MAX_OPTIONS = 5;
export const lineAmount = li => (parseFloat(li.unitPrice) || 0) * (parseInt(li.qty) || 0);
export const hasOptions = q => Array.isArray(q?.options) && q.options.length >= 2;
const optOf = li => { const n = parseInt(li.option); return isNaN(n) ? 1 : n; }; // unlabelled lines → Option 1

export const optionLabel = (q, n) => {
  if (n === 0) return "Common to all options";
  const name = (q.options?.[n - 1]?.name || "").trim();
  return `Option ${n}${name ? ` — ${name}` : ""}`;
};

// Lines of one option (n ≥ 1) or the common lines (n = 0)
export const linesOf = (q, n) => (q.lineItems || []).filter(li => optOf(li) === n);

// [{ n, label, lines, subtotal, total }] — total includes the common lines
export function optionTotals(q) {
  if (!hasOptions(q)) return [];
  const common = linesOf(q, 0).reduce((s, li) => s + lineAmount(li), 0);
  return q.options.map((_, i) => {
    const lines = linesOf(q, i + 1);
    const subtotal = lines.reduce((s, li) => s + lineAmount(li), 0);
    return { n: i + 1, label: optionLabel(q, i + 1), lines, subtotal, total: subtotal + common };
  });
}
export const commonTotal = q => linesOf(q, 0).reduce((s, li) => s + lineAmount(li), 0);

// The quote's dollar value for reports, pipeline, cards and leads (in the quote's currency)
export function quoteValue(q) {
  if (!hasOptions(q)) return (q?.lineItems || []).reduce((s, li) => s + lineAmount(li), 0);
  const t = optionTotals(q);
  if (q.quoteStatus === "won" && q.wonOption) { const w = t.find(o => o.n === q.wonOption); if (w) return w.total; }
  return t.length ? t.reduce((s, o) => s + o.total, 0) / t.length : 0;
}

// Short money text for cards/lists: "$9,800–$12,400 · 3 options", or the won option's total
export function valueText(q, fmt) {
  if (!hasOptions(q)) return fmt(quoteValue(q));
  const t = optionTotals(q).map(o => o.total);
  if (q.quoteStatus === "won" && q.wonOption) return `${fmt(quoteValue(q))} · Option ${q.wonOption}`;
  const lo = Math.min(...t), hi = Math.max(...t);
  return `${lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`} · ${t.length} options`;
}

// Option whose total is closest to an amount (used to pre-pick the won option from an order)
export function closestOption(q, amount) {
  const t = optionTotals(q);
  return t.length ? t.reduce((b, o) => (Math.abs(o.total - amount) < Math.abs(b.total - amount) ? o : b)).n : null;
}

// Turn options on: existing lines become Option 1, plus an empty Option 2
export function enableOptions(q, newLine) {
  return { ...q, options: [{ name: "" }, { name: "" }], lineItems: [...(q.lineItems || []).map(li => ({ ...li, option: 1 })), { ...newLine(), option: 2 }] };
}
// Remove option n (its lines go too); with one option left, options switch off
export function removeOption(q, n) {
  const options = q.options.filter((_, i) => i !== n - 1);
  let lineItems = (q.lineItems || []).filter(li => optOf(li) !== n).map(li => (optOf(li) > n ? { ...li, option: optOf(li) - 1 } : li));
  if (options.length < 2) return { ...q, options: null, lineItems: lineItems.map(({ option, ...li }) => li) };
  return { ...q, options, lineItems };
}

// ── "Which option did they choose?" — one box for the whole app ─────────────
// pickWonOption(quote, preselect?) → Promise<option number | null (cancelled)>
let listener = null;
export function pickWonOption(q, preselect = null) {
  if (!hasOptions(q)) return Promise.resolve(null);
  if (!listener) { const n = window.prompt(`Which option did ${q.company || q.name || "the customer"} choose? (1–${q.options.length})`, preselect || 1); const v = parseInt(n); return Promise.resolve(v >= 1 && v <= q.options.length ? v : null); }
  return new Promise(resolve => listener({ q, preselect, resolve }));
}

export function WonOptionPicker({ T, fmt = v => "$" + Math.round(v).toLocaleString("en-CA") }) {
  const [ask, setAsk] = useState(null);
  const [sel, setSel] = useState(null);
  useEffect(() => { listener = a => { setAsk(a); setSel(a.preselect); }; return () => { listener = null; }; }, []);
  if (!ask) return null;
  const done = v => { ask.resolve(v); setAsk(null); };
  const opts = optionTotals(ask.q);
  return (
    <div className="modal-overlay" onClick={() => done(null)}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Which option did they choose?</div>
        <div style={{ fontSize: 12, color: T.subtext, marginBottom: 14 }}>{ask.q.quoteNum} · {ask.q.company || ask.q.name}{ask.preselect ? " — pre-selected the option closest to the order" : ""}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {opts.map(o => (
            <label key={o.n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: `1px solid ${sel === o.n ? T.gold : T.border}`, borderRadius: 3, cursor: "pointer", fontSize: 13 }}>
              <input type="radio" checked={sel === o.n} onChange={() => setSel(o.n)} />
              <span style={{ flex: 1 }}>{o.label}</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(o.total)} {ask.q.currency}</span>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={() => done(null)}>Cancel</button>
          <button className="btn-gold" disabled={!sel} style={{ opacity: sel ? 1 : .5 }} onClick={() => done(sel)}>Mark won</button>
        </div>
      </div>
    </div>
  );
}
