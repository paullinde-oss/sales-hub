// ─── Prospecting: reading & writing ──────────────────────────────────────────
//   prospects/{id}            — one per prospect (browser copy via cachedCollection)
//   prospectActivities/{id}   — the timeline (browser copy too)
//   prospectInbox/{auto id}   — requests from the Grok bot ({ json: "…" }); handled and removed by the hub
//   config/prospectingBot     — bot switches + what the bot reads back in ONE read:
//        listJson   (every prospect, short form), avoidJson (customers + open leads — don't prospect),
//        recentJson (results of its last 100 requests)
// The hub handles the inbox whenever someone with Prospecting access has it open.
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { listenCollection, putDoc, dropDoc } from "../cachedCollection";
import { listenOrders } from "../sales/orderStore";
import { DEFAULT_ACCOUNTS, normName } from "../sales/accounts";
import * as R from "./rules";

const BOT_DOC = ["config", "prospectingBot"];
const compact = p => ({ id: p.id, name: R.fullName(p), title: p.title || "", company: p.company_name || "", email: p.email || "", linkedin_url: p.linkedin_url || "",
  region: p.region || "", status: p.status, icp_fit: p.icp_fit, touch_count: p.touch_count || 0, next_touch_at: p.next_touch_at || "",
  do_not_contact: !!p.do_not_contact, owner: p.owner || "", converted: !!p.converted_lead_id });

export function useProspecting({ db, enabled, leads, loginName }) {
  const [prospects, setProspects] = useState({ list: [], fresh: false });
  const [activities, setActivities] = useState([]);
  const [bot, setBot] = useState(null);           // config/prospectingBot ({} when missing)
  const [inbox, setInbox] = useState([]);
  const [sales, setSales] = useState(null);       // config/salesSettings
  const [customers, setCustomers] = useState(null); // Map(normalised name → name) from orders

  useEffect(() => {
    if (!enabled) return;
    const u = [
      listenCollection(db, "prospects", (docs, { fresh }) => setProspects({ list: docs.map(d => ({ ...d.data, id: d.id })), fresh }), e => console.warn("Prospects:", e)),
      listenCollection(db, "prospectActivities", docs => setActivities(docs.map(d => ({ ...d.data, id: d.id }))), e => console.warn("Prospect activity:", e)),
      onSnapshot(doc(db, ...BOT_DOC), s => setBot(s.exists() ? s.data() : {}), () => setBot({})),
      onSnapshot(collection(db, "prospectInbox"), s => setInbox(s.docs.map(d => ({ ...d.data(), id: d.id }))), e => console.warn("Prospect inbox:", e)),
      onSnapshot(doc(db, "config", "salesSettings"), s => setSales(s.exists() ? s.data() : {}), () => setSales({})),
      listenOrders(db, (orders, n, fresh) => {
        const m = new Map();
        orders.forEach(o => { const raw = String(o.override?.customer || o.customer || "").trim(); const k = normName(raw).trim(); if (k && !m.has(k)) m.set(k, raw); });
        if (fresh || m.size) setCustomers(m);
      }, e => { console.warn("Orders for prospecting:", e); setCustomers(new Map()); }),
    ];
    return () => u.forEach(f => f && f());
  }, [db, enabled]);

  const ctx = useMemo(() => ({
    accounts: sales?.accounts?.length ? sales.accounts : DEFAULT_ACCOUNTS, aliases: sales?.aliases || {},
    customers: customers || new Map(), leads: leads || [], prospects: prospects.list,
  }), [sales, customers, leads, prospects.list]);
  const ready = enabled && prospects.fresh && !!bot && !!sales && !!customers;
  const opts = useMemo(() => ({ botOn: bot?.botOn !== false, botCanSend: !!bot?.botCanSend }), [bot]);
  const me = { name: loginName };

  // Writing
  const write = useCallback(async ({ prospect, activity, lead }) => {
    const { id, ...p } = prospect;
    await putDoc(db, "prospects", id, { ...p, id });
    if (activity) { const { id: aid, ...a } = activity; await putDoc(db, "prospectActivities", aid, a); }
    if (lead) await putDoc(db, "leads", String(lead.id), lead);
  }, [db]);
  const run = async r => { if (r.error) return r.error; await write(r); return null; };

  const actions = {
    add: (raw, o = {}) => { const r = R.createProspect(raw, me, ctx, { ...opts, ...o }); return r.error ? r : write(r).then(() => r); },
    edit: (p, changes) => run(R.editProspect(p, changes, me)),
    setStatus: (p, to, extra) => run(R.changeStatus(p, to, me, opts, Date.now(), extra)),
    log: (p, a) => run(R.logActivity(p, a, me, opts)),
    convert: p => run(R.convertToLead(p, me, Date.now(), Date.now())),
    remove: async p => { await dropDoc(db, "prospects", p.id); for (const a of activities.filter(a => a.prospectId === p.id)) await dropDoc(db, "prospectActivities", a.id); },
    // Bulk: { status } | { owner } | { do_not_contact: true }
    bulk: async (list, change) => {
      const errs = [];
      for (const p of list) {
        const r = change.status ? R.changeStatus(p, change.status, me, opts) : R.editProspect(p, change, me);
        if (r.error) errs.push(`${R.fullName(p) || p.company_name}: ${r.error}`); else if (r.prospect !== p) await write(r);
      }
      return errs;
    },
    // CSV import: rows already checked by previewImport; adds the "add" ones
    importRows: async rows => { let n = 0; for (const r of rows) if (r.result && !r.result.error) { await write(r.result); n++; } return n; },
    previewImport: (raws, force = false) => {
      const list = [...ctx.prospects];
      return raws.map(raw => { const result = R.createProspect(raw, me, { ...ctx, prospects: list }, { ...opts, force, how: `Imported from CSV by ${loginName}` }); if (!result.error) list.push(result.prospect); return { raw, result }; });
    },
    deleteExamples: async () => { for (const p of prospects.list.filter(p => p.example)) await actions.remove(p); },
    setBot: patch => setDoc(doc(db, ...BOT_DOC), patch, { merge: true }),
  };

  // ── The bot's inbox: handled as soon as everything it's checked against has loaded ──
  const busy = useRef(false), done = useRef(new Set());
  useEffect(() => {
    if (!ready || busy.current) return;
    const items = inbox.filter(i => !done.current.has(i.id)).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (!items.length) return;
    busy.current = true;
    (async () => {
      try {
        const out = R.processInbox(items, { prospects: prospects.list, ctx }, opts);
        for (const p of out.prospects) { const { id, ...d } = p; await putDoc(db, "prospects", id, { ...d, id }); }
        for (const a of out.activities) { const { id, ...d } = a; await putDoc(db, "prospectActivities", id, d); }
        let recent = []; try { recent = JSON.parse(bot.recentJson || "[]"); } catch { /* start fresh */ }
        await setDoc(doc(db, ...BOT_DOC), { recentJson: JSON.stringify([...out.results.reverse(), ...recent].slice(0, 100)), lastInboxAt: new Date().toISOString() }, { merge: true });
        for (const i of items) { done.current.add(i.id); await deleteDoc(doc(db, "prospectInbox", i.id)).catch(() => {}); }
      } catch (e) { console.warn("Couldn't handle the bot's requests:", e); }
      busy.current = false;
    })();
  }, [ready, inbox, prospects.list, ctx, opts, bot, db]);

  // ── The 5 example prospects, once ──
  const seeding = useRef(false);
  useEffect(() => {
    if (!ready || bot.examplesSeeded || seeding.current) return;
    seeding.current = true;
    (async () => {
      await setDoc(doc(db, ...BOT_DOC), { examplesSeeded: true, botOn: bot.botOn ?? true, botCanSend: bot.botCanSend ?? false }, { merge: true });
      const t = R.today();
      for (const [i, ex] of R.EXAMPLES.entries()) {
        const extra = ex.status === "sent" ? { last_touch_at: R.addDays(t, -6), next_touch_at: R.addDays(t, -3) } : {};
        const r = R.createProspect({ ...ex, ...extra, owner: loginName }, me, { prospects: [] }, { force: true, example: true, id: `example-${i + 1}`, how: "Example prospect added with the Prospecting tab" });
        if (!r.error) await write(r);
      }
    })();
  }, [ready, bot]); // eslint-disable-line

  // ── Keep the bot's one-read summary current (only when something changed) ──
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const listJson = JSON.stringify(prospects.list.map(compact).sort((a, b) => a.id.localeCompare(b.id)));
      const avoid = new Set([...ctx.accounts.map(a => a.name), ...ctx.customers.values(), ...(ctx.leads || []).filter(l => l && !["won", "lost", "cold"].includes(l.status)).map(l => l.company)].map(s => String(s || "").trim()).filter(Boolean));
      const avoidJson = JSON.stringify([...avoid].sort());
      if (listJson !== bot.listJson || avoidJson !== bot.avoidJson) setDoc(doc(db, ...BOT_DOC), { listJson, avoidJson, listAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, [ready, prospects.list, ctx, bot?.listJson, bot?.avoidJson]); // eslint-disable-line

  return { ready, loading: enabled && !prospects.fresh, prospects: prospects.list, activities, bot: bot || {}, inbox, ctx, opts, actions };
}
