// ─── Prospecting: the rules (no Firebase here, so they can be tested on their own) ───
// Prospects live in Firestore `prospects/{id}`, their history in `prospectActivities/{id}`
// (both kept in each browser via cachedCollection). The Grok bot never writes those directly:
// it drops requests into `prospectInbox`, and the hub runs each one through processInbox()
// below — same duplicate check, customer/lead block and status guard as a person gets.
import { normName, matchAccount } from "../sales/accounts.js";

export const STATUSES = ["new", "enriched", "drafted", "approved", "sent", "replied", "meeting", "no", "on_hold"];
export const STATUS_LABEL = { new: "New", enriched: "Enriched", drafted: "Drafted", approved: "Approved", sent: "Sent", replied: "Replied", meeting: "Meeting", no: "No", on_hold: "On hold" };
export const STATUS_COLOR = { new: "#8a8f98", enriched: "#5b8def", drafted: "#9b6dd6", approved: "#c8a96e", sent: "#3a9bd9", replied: "#34c77b", meeting: "#1f9d55", no: "#e8472c", on_hold: "#e8a23a" };
export const BOT_MAX_STATUS = "approved"; // the bot can go up to here; Sent and later need a person (unless allowed)
export const ACTIVITY_TYPES = ["researched", "drafted", "approved", "sent", "follow_up_sent", "reply_received", "meeting_booked", "marked_no", "note", "converted"];
export const ACTIVITY_LABEL = { researched: "Researched", drafted: "Drafted", approved: "Approved", sent: "First touch sent", follow_up_sent: "Follow-up sent", reply_received: "Reply received", meeting_booked: "Meeting booked", marked_no: "Marked No", note: "Note", converted: "Converted to lead" };
export const CHANNELS = ["email", "linkedin", "x", "other"];
export const CHANNEL_LABEL = { email: "Email", linkedin: "LinkedIn", x: "X", other: "Other" };
export const FITS = ["strong", "maybe", "weak"];
export const MAX_TOUCHES = 4;
export const FOLLOW_UP_DAYS = [3, 7, 14]; // next touch due this many days after touch 1, 2, 3
export const LEAD_SOURCE = "Outreach/Prospecting";

// Every field a prospect has, in CSV / table order
export const FIELDS = ["first_name", "last_name", "title", "company_name", "company_website", "company_type", "region", "city",
  "email", "phone", "linkedin_url", "x_handle", "icp_fit", "fit_reason", "channel", "status", "touch_count", "last_touch_at",
  "next_touch_at", "source_urls", "notes", "do_not_contact", "owner"];
// What an edit (person or bot) may change directly — touches change only through activities
export const EDITABLE = FIELDS.filter(f => !["touch_count", "last_touch_at", "status"].includes(f));
export const FIELD_LABEL = { first_name: "First name", last_name: "Last name", title: "Title", company_name: "Company", company_website: "Website",
  company_type: "Company type", region: "Region", city: "City", email: "Email", phone: "Phone", linkedin_url: "LinkedIn", x_handle: "X handle",
  icp_fit: "Fit", fit_reason: "Why they fit", channel: "Channel", status: "Status", touch_count: "Touches", last_touch_at: "Last touch",
  next_touch_at: "Next touch", source_urls: "Sources", notes: "Notes", do_not_contact: "Do not contact", owner: "Owner" };

// ── Dates (Alberta) ──────────────────────────────────────────────────────────
export const today = (now = new Date()) => new Date(now).toLocaleDateString("en-CA", { timeZone: "America/Edmonton" });
export const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isoDate = v => { const s = String(v ?? "").trim(); if (!s) return ""; if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); const d = new Date(s); return isNaN(d) ? "" : d.toISOString().slice(0, 10); };
export const nextTouchAfter = (touches, fromIso) => touches >= MAX_TOUCHES ? "" : addDays(fromIso, FOLLOW_UP_DAYS[Math.min(touches, FOLLOW_UP_DAYS.length) - 1] ?? 7);
export const newId = (prefix = "p") => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const fullName = p => [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
export const isReadOnly = p => !!p?.converted_lead_id;

// ── Cleaning what comes in (form, CSV or bot) ────────────────────────────────
export const normEmail = e => String(e || "").trim().toLowerCase().replace(/^mailto:/, "");
export const normLinkedIn = u => String(u || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^(www\.|[a-z]{2}\.)/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
const bool = v => v === true || /^(true|yes|y|1|x)$/i.test(String(v ?? "").trim());
const pick = (v, list, dflt) => { const s = String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_"); return list.includes(s) ? s : dflt; };

export function cleanProspect(raw = {}) {
  const p = {};
  for (const f of FIELDS) if (raw[f] !== undefined) p[f] = raw[f];
  // A single "name" field is split into first / last
  if (!p.first_name && !p.last_name && raw.name) { const parts = String(raw.name).trim().split(/\s+/); p.first_name = parts.shift() || ""; p.last_name = parts.join(" "); }
  for (const f of ["first_name", "last_name", "title", "company_name", "company_website", "company_type", "region", "city", "phone", "fit_reason", "notes", "owner"])
    if (p[f] !== undefined) p[f] = String(p[f] ?? "").trim();
  if (p.email !== undefined) p.email = normEmail(p.email);
  if (p.linkedin_url !== undefined) p.linkedin_url = String(p.linkedin_url || "").trim();
  if (p.x_handle !== undefined) p.x_handle = String(p.x_handle || "").trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
  if (p.icp_fit !== undefined) p.icp_fit = pick(p.icp_fit, FITS, "maybe");
  if (p.channel !== undefined) p.channel = pick(p.channel, CHANNELS, "email");
  if (p.status !== undefined) p.status = pick(p.status, STATUSES, "new");
  if (p.touch_count !== undefined) p.touch_count = Math.max(0, Math.min(MAX_TOUCHES, parseInt(p.touch_count) || 0));
  for (const f of ["last_touch_at", "next_touch_at"]) if (p[f] !== undefined) p[f] = isoDate(p[f]);
  if (p.source_urls !== undefined) p.source_urls = (Array.isArray(p.source_urls) ? p.source_urls : String(p.source_urls || "").split(/\s*[|\n,]\s*|\s+(?=https?:)/))
    .map(s => String(s).trim()).filter(Boolean);
  if (p.do_not_contact !== undefined) p.do_not_contact = bool(p.do_not_contact);
  return p;
}

export function blankProspect(extra = {}) {
  return { first_name: "", last_name: "", title: "", company_name: "", company_website: "", company_type: "", region: "", city: "",
    email: "", phone: "", linkedin_url: "", x_handle: "", icp_fit: "maybe", fit_reason: "", channel: "email", status: "new",
    touch_count: 0, last_touch_at: "", next_touch_at: "", source_urls: [], notes: "", do_not_contact: false, owner: "",
    converted_lead_id: "", ...extra };
}

// ── Duplicates: email, then LinkedIn, then name + company ────────────────────
export function findDuplicate(p, list, ignoreId = null) {
  const email = normEmail(p.email), li = normLinkedIn(p.linkedin_url);
  const nm = normName(fullName(p)).trim(), co = normName(p.company_name).trim();
  const others = (list || []).filter(x => x && x.id !== ignoreId);
  if (email) { const m = others.find(x => normEmail(x.email) === email); if (m) return { by: "email", match: m }; }
  if (li) { const m = others.find(x => normLinkedIn(x.linkedin_url) === li); if (m) return { by: "LinkedIn", match: m }; }
  if (nm && co) { const m = others.find(x => normName(fullName(x)).trim() === nm && normName(x.company_name).trim() === co); if (m) return { by: "name + company", match: m }; }
  return null;
}

// ── Already a customer or an open lead? ──────────────────────────────────────
// ctx: { accounts: [{name, terms}], aliases, customers: Map(normalised name → shown name), leads: [lead] }
const OPEN_LEAD = l => l && !["won", "lost", "cold"].includes(l.status);
// Same company: same normalised name, or one is the start of the other ("UFA" / "UFA Brooks"), or
// a longer name (6+ letters) inside the other as whole words
const sameCompany = (a, b) => {
  if (!a || !b) return false; if (a === b) return true;
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  return (s.length >= 3 && l.startsWith(s + " ")) || (s.length >= 6 && (" " + l + " ").includes(" " + s + " "));
};
export function findBlock(company, ctx = {}) {
  const raw = String(company || "").trim(); if (!raw) return null;
  const n = normName(raw).trim(); if (!n) return null;
  const acct = matchAccount(raw, ctx.accounts || [], ctx.aliases || {});
  if (acct) return { kind: "customer", name: acct.name, key: acct.name };
  const cust = ctx.customers?.get?.(n);
  if (cust) return { kind: "customer", name: cust, key: n };
  for (const [k, name] of ctx.customers || []) if (sameCompany(n, k)) return { kind: "customer", name, key: k };
  const lead = (ctx.leads || []).find(l => OPEN_LEAD(l) && sameCompany(n, normName(l.company).trim()));
  if (lead) return { kind: "lead", name: lead.company, id: lead.id };
  return null;
}
export const blockMessage = b => !b ? "" : b.kind === "customer" ? `${b.name} is already a customer` : `${b.name} is already an open lead`;

// ── Status changes and activities ────────────────────────────────────────────
// actor: { name: "Paul" } for a signed-in person, { api: true } for the bot. opts: { botCanSend }
const idx = s => STATUSES.indexOf(s);
const isBot = a => !a || a.api;
export const actorName = a => isBot(a) ? "api" : a.name;
function guardStatus(p, to, actor, opts = {}) {
  if (isReadOnly(p)) return "This prospect was converted to a lead — it's read-only now.";
  if (!STATUSES.includes(to)) return `"${to}" isn't a status (use ${STATUSES.join(", ")}).`;
  if (isBot(actor) && idx(to) > idx(BOT_MAX_STATUS) && !opts.botCanSend) return `The bot can only move prospects up to Approved — "${STATUS_LABEL[to]}" needs a person (or switch on "Let the bot mark Sent" in the hub).`;
  if (p.do_not_contact && ["approved", "sent"].includes(to)) return "Marked do-not-contact — it can't be approved or sent.";
  return null;
}
const STATUS_ACTIVITY = { new: "note", enriched: "researched", drafted: "drafted", approved: "approved", sent: "sent", replied: "reply_received", meeting: "meeting_booked", no: "marked_no", on_hold: "note" };

function makeActivity(p, type, actor, now, extra = {}) {
  return { id: extra.id || newId("a"), prospectId: p.id, type, channel: extra.channel || p.channel || "other", occurred_at: extra.occurred_at || new Date(now).toISOString(),
    summary: extra.summary || "", message_body: extra.message_body || "", source_url: extra.source_url || "", created_by: actorName(actor),
    ...(extra.status_from ? { status_from: extra.status_from, status_to: extra.status_to } : {}) };
}
// A touch going out: count it and set when the next one is due
function touched(p, now) {
  const t = Math.min(MAX_TOUCHES, (p.touch_count || 0) + 1), d = today(now);
  return { touch_count: t, last_touch_at: d, next_touch_at: nextTouchAfter(t, d) };
}

/** Change a prospect's status. Returns { prospect, activity } or { error }. Every real change gets an activity row. */
export function changeStatus(p, to, actor, opts = {}, now = Date.now(), extra = {}) {
  const err = guardStatus(p, to, actor, opts); if (err) return { error: err };
  if (p.status === to) return { prospect: p, activity: null };
  if (to === "sent" && (p.touch_count || 0) >= MAX_TOUCHES) return { error: `Already ${MAX_TOUCHES} touches — that's the most a prospect gets.` };
  let type = STATUS_ACTIVITY[to], patch = { status: to };
  if (to === "sent") { patch = { ...patch, ...touched(p, now) }; if ((p.touch_count || 0) > 0) type = "follow_up_sent"; }
  if (["replied", "meeting", "no"].includes(to)) patch.next_touch_at = "";
  const prospect = { ...p, ...patch, updated_at: new Date(now).toISOString() };
  const activity = makeActivity(p, type, actor, now, { ...extra, status_from: p.status || "new", status_to: to,
    summary: extra.summary || `Status ${STATUS_LABEL[p.status] || "—"} → ${STATUS_LABEL[to]}` });
  return { prospect, activity };
}

// Which status an activity moves a prospect to (only ever forward)
const ACTIVITY_STATUS = { researched: "enriched", drafted: "drafted", approved: "approved", sent: "sent", follow_up_sent: "sent", reply_received: "replied", meeting_booked: "meeting", marked_no: "no" };

/** Log an activity. Moves the status along where it makes sense. Returns { prospect, activity } or { error }. */
export function logActivity(p, a, actor, opts = {}, now = Date.now()) {
  if (isReadOnly(p)) return { error: "This prospect was converted to a lead — it's read-only now." };
  let type = String(a.type || "note").trim().toLowerCase();
  if (!ACTIVITY_TYPES.includes(type)) return { error: `"${a.type}" isn't an activity type (use ${ACTIVITY_TYPES.filter(t => t !== "converted").join(", ")}).` };
  if (type === "converted") return { error: "Use Convert to Lead to convert a prospect." };
  const target = ACTIVITY_STATUS[type];
  if (target) { const err = guardStatus(p, target, actor, opts); if (err) return { error: err }; }
  let patch = {};
  if (type === "sent" || type === "follow_up_sent") {
    if ((p.touch_count || 0) >= MAX_TOUCHES) return { error: `Already ${MAX_TOUCHES} touches — that's the most a prospect gets.` };
    type = (p.touch_count || 0) > 0 ? "follow_up_sent" : "sent";
    patch = touched(p, a.occurred_at || now);
  }
  if (["reply_received", "meeting_booked", "marked_no"].includes(type)) patch.next_touch_at = "";
  // Status only moves forward (a late "researched" note won't pull a Sent prospect back to Enriched);
  // replies / meetings / No always apply, On hold is left alone for notes
  const cur = p.status || "new";
  const move = target && target !== cur && (["replied", "meeting", "no"].includes(target) ? !(target === "replied" && cur === "meeting") : idx(target) > idx(cur) && !["replied", "meeting", "no"].includes(cur));
  if (move) patch.status = target;
  const prospect = { ...p, ...patch, updated_at: new Date(now).toISOString() };
  const activity = makeActivity(p, type, actor, now, { ...a, type, ...(move ? { status_from: cur, status_to: target } : {}),
    summary: a.summary || (move ? `Status ${STATUS_LABEL[cur]} → ${STATUS_LABEL[target]}` : ACTIVITY_LABEL[type]) });
  return { prospect, activity };
}

/** Edit fields (not status/touches). Returns { prospect } or { error }. */
export function editProspect(p, changes, actor, now = Date.now()) {
  if (isReadOnly(p)) return { error: "This prospect was converted to a lead — it's read-only now." };
  const c = cleanProspect(changes), patch = {};
  for (const f of EDITABLE) if (c[f] !== undefined) patch[f] = c[f];
  if (isBot(actor) && p.do_not_contact && patch.do_not_contact === false) delete patch.do_not_contact; // only a person can lift do-not-contact
  return { prospect: { ...p, ...patch, updated_at: new Date(now).toISOString() } };
}

// ── Convert to Lead ──────────────────────────────────────────────────────────
const leadType = t => /distribut|dealer|supplier|wholesal|reseller|rental/i.test(t || "") ? "Distributor" : "End User";
const leadDate = now => new Date(now).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Edmonton" });
/** People only; status Replied or Meeting. Returns { lead, prospect, activity } or { error }. */
export function convertToLead(p, actor, now = Date.now(), leadId = now) {
  if (isBot(actor)) return { error: "Only a signed-in person can convert a prospect to a lead." };
  if (isReadOnly(p)) return { error: "Already converted to a lead." };
  if (!["replied", "meeting"].includes(p.status)) return { error: "Only prospects who replied or booked a meeting can be converted." };
  const contactBits = [p.title, p.email, p.phone, [p.city, p.region].filter(Boolean).join(", "), p.linkedin_url, p.x_handle && "X: @" + p.x_handle].filter(Boolean);
  const notes = [contactBits.join(" · "), p.notes, (p.source_urls || []).length ? "Sources: " + p.source_urls.join(" ") : ""].filter(Boolean).join("\n");
  const lead = { id: leadId, company: p.company_name || fullName(p), contact: fullName(p), type: leadType(p.company_type), leadSource: LEAD_SOURCE,
    potentialValue: 0, status: "inprogress", lastContact: leadDate(now), productsQuoted: "", notes, quoteNumber: "",
    year: Number(today(now).slice(0, 4)), isLead: true, prospectId: p.id, email: p.email || "", phone: p.phone || "", region: p.region || "", city: p.city || "", heldBy: p.owner || "" };
  const prospect = { ...p, converted_lead_id: String(leadId), converted_at: new Date(now).toISOString(), converted_by: actor.name, updated_at: new Date(now).toISOString() };
  const activity = makeActivity(p, "converted", actor, now, { summary: `Converted to lead (${lead.company})` });
  return { lead, prospect, activity };
}

// ── New prospect (person, CSV or bot) ────────────────────────────────────────
/** Returns { prospect, activity } or { error, duplicate, block }. force skips the duplicate warning (never the block). */
export function createProspect(raw, actor, ctx, opts = {}, now = Date.now()) {
  const c = cleanProspect(raw);
  if (!fullName(c) && !c.email && !c.linkedin_url && !c.company_name) return { error: "A prospect needs at least a name, email, LinkedIn or company." };
  const block = findBlock(c.company_name, ctx);
  if (block) return { error: blockMessage(block) + " — not added.", block };
  const duplicate = findDuplicate(c, ctx.prospects);
  if (duplicate && !opts.force) return { error: `Looks like ${fullName(duplicate.match) || duplicate.match.company_name || "an existing prospect"} (same ${duplicate.by}).`, duplicate };
  const status = c.status || "new";
  const err = guardStatus({}, status, actor, opts); if (err) return { error: err };
  const at = new Date(now).toISOString();
  const prospect = { ...blankProspect(), ...c, id: opts.id || newId(), status, created_at: at, updated_at: at, created_by: actorName(actor),
    ...(opts.example ? { example: true } : {}) };
  if (!prospect.owner && !isBot(actor)) prospect.owner = actor.name;
  const activity = makeActivity(prospect, isBot(actor) ? "researched" : "note", actor, now, { id: opts.id ? opts.id + "-a0" : undefined,
    summary: isBot(actor) ? ("Found by the Grok bot" + (c.fit_reason ? " — " + c.fit_reason : "")) : opts.how || `Added by ${actor.name}`,
    source_url: (c.source_urls || [])[0] || "" });
  return { prospect, activity };
}

// ── The bot's inbox ──────────────────────────────────────────────────────────
// Each inbox document has one text field "json" holding one request:
//   { "action": "add", "prospects": [ {...}, ... ] }
//   { "action": "update", "id": "…" (or "email" / "linkedin_url"), "changes": { ...fields, "status": "drafted" } }
//   { "action": "activity", "id": "…" (or "email" / "linkedin_url"), "activity": { "type": "drafted", "summary": "…", "message_body": "…" } }
// state: { prospects: [..], ctx: block context }. opts: { botOn, botCanSend }.
// Returns { prospects: [changed/new], activities: [new], results: [per request] } — ids are fixed per inbox
// document, so two browsers handling the same request write the same thing.
export function processInbox(items, state, opts = {}, now = Date.now()) {
  const list = [...(state.prospects || [])];
  const byId = new Map(list.map(p => [p.id, p]));
  const changed = new Map(), activities = [], results = [];
  const actor = { api: true };
  const save = (p, act) => { byId.set(p.id, p); changed.set(p.id, p); const i = list.findIndex(x => x.id === p.id); if (i >= 0) list[i] = p; else list.push(p); if (act) activities.push(act); };
  const find = req => {
    if (req.id && byId.has(String(req.id))) return byId.get(String(req.id));
    const e = normEmail(req.email), li = normLinkedIn(req.linkedin_url);
    return (e && list.find(p => normEmail(p.email) === e)) || (li && list.find(p => normLinkedIn(p.linkedin_url) === li)) || null;
  };
  for (const item of items) {
    const res = { inbox: item.id, at: new Date(now).toISOString(), ok: false, message: "", ids: [] };
    results.push(res);
    let req;
    try { req = typeof item.json === "string" ? JSON.parse(item.json) : (item.json || item); } catch (e) { res.message = "Couldn't read the JSON: " + e.message; continue; }
    res.action = req.action || "";
    if (!opts.botOn) { res.message = "The Grok bot is switched off in the hub (Prospecting → Grok bot)."; continue; }
    if (req.action === "add") {
      const rows = Array.isArray(req.prospects) ? req.prospects : req.prospect ? [req.prospect] : [];
      if (!rows.length) { res.message = 'No "prospects" list in the request.'; continue; }
      const notes = [];
      rows.forEach((raw, i) => {
        const r = createProspect(raw, actor, { ...state.ctx, prospects: list }, { ...opts, id: `${item.id}-${i}` }, now);
        const who = fullName(cleanProspect(raw)) || raw.email || raw.company_name || `#${i + 1}`;
        if (r.error) { notes.push(`${who}: ${r.error}${r.duplicate ? ` Not added (existing id ${r.duplicate.match.id}).` : ""}`); return; }
        save(r.prospect, r.activity); res.ids.push(r.prospect.id);
      });
      res.ok = res.ids.length > 0;
      res.message = `Added ${res.ids.length} of ${rows.length}.` + (notes.length ? " " + notes.join(" ") : "");
    } else if (req.action === "update" || req.action === "activity") {
      const p = find(req);
      if (!p) { res.message = "No prospect with that id / email / LinkedIn."; continue; }
      res.ids = [p.id];
      let cur = p, act = null;
      if (req.action === "update") {
        const ch = { ...(req.changes || {}) }; const to = ch.status !== undefined ? String(ch.status).trim().toLowerCase().replace(/[\s-]+/g, "_") : null; delete ch.status;
        const e = editProspect(cur, ch, actor, now); if (e.error) { res.message = e.error; continue; }
        cur = e.prospect;
        if (to && to !== cur.status) {
          const s = changeStatus(cur, to, actor, opts, now, { id: `${item.id}-a`, summary: req.summary, message_body: req.message_body, source_url: req.source_url });
          if (s.error) { res.message = s.error; continue; }
          cur = s.prospect; act = s.activity;
        }
      } else {
        const a = logActivity(cur, { ...(req.activity || {}), id: `${item.id}-a` }, actor, opts, now);
        if (a.error) { res.message = a.error; continue; }
        cur = a.prospect; act = a.activity;
      }
      save(cur, act); res.ok = true; res.message = act ? ACTIVITY_LABEL[act.type] + " logged." : "Updated.";
    } else res.message = `Unknown action "${req.action}" (use add, update or activity).`;
  }
  return { prospects: [...changed.values()], activities, results };
}

// ── Summary strip ────────────────────────────────────────────────────────────
export function summarize(prospects, activities, now = Date.now()) {
  const t = today(now), d = new Date(t + "T12:00:00Z");
  const weekStart = addDays(t, -((d.getUTCDay() + 6) % 7)), monthStart = t.slice(0, 8) + "01";
  const day = a => today(a.occurred_at || 0);
  const byStatus = Object.fromEntries(STATUSES.map(s => [s, 0]));
  prospects.forEach(p => { byStatus[p.status || "new"] = (byStatus[p.status || "new"] || 0) + 1; });
  const count = (type, from) => activities.filter(a => a.type === type && (!from || day(a) >= from)).length;
  return {
    total: prospects.length, byStatus,
    firstWeek: count("sent", weekStart), firstMonth: count("sent", monthStart),
    repliesMonth: count("reply_received", monthStart), replies: count("reply_received"),
    meetingsMonth: count("meeting_booked", monthStart), meetings: count("meeting_booked"),
    conversionsMonth: count("converted", monthStart), conversions: count("converted"),
    overdue: prospects.filter(p => isOverdue(p, t)).length,
  };
}
export const isOverdue = (p, t = today()) => p.status === "sent" && !p.do_not_contact && !isReadOnly(p) && !!p.next_touch_at && p.next_touch_at < t && (p.touch_count || 0) < MAX_TOUCHES;

// ── CSV ──────────────────────────────────────────────────────────────────────
const csvCell = v => { const s = Array.isArray(v) ? v.join(" | ") : v === true ? "yes" : v === false ? "" : String(v ?? ""); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function toCSV(prospects) {
  const cols = ["id", ...FIELDS, "converted_lead_id", "created_at", "created_by"];
  return [cols.join(","), ...prospects.map(p => cols.map(c => csvCell(p[c])).join(","))].join("\r\n");
}
export function parseCSV(text) {
  const rows = []; let row = [], val = "", q = false;
  text = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { val += '"'; i++; } else q = false; } else val += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(val); val = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(val); rows.push(row); row = []; val = ""; }
    else val += c;
  }
  if (val || row.length) { row.push(val); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim()));
}
const HEADER_ALIASES = { first: "first_name", firstname: "first_name", last: "last_name", lastname: "last_name", surname: "last_name", name: "name", full_name: "name",
  job_title: "title", position: "title", company: "company_name", organization: "company_name", organisation: "company_name", website: "company_website", url: "company_website",
  type: "company_type", province: "region", state: "region", e_mail: "email", email_address: "email", phone_number: "phone", linkedin: "linkedin_url", linkedin_profile: "linkedin_url",
  x: "x_handle", twitter: "x_handle", fit: "icp_fit", icp: "icp_fit", reason: "fit_reason", sources: "source_urls", source: "source_urls", source_url: "source_urls",
  dnc: "do_not_contact", touches: "touch_count", last_touch: "last_touch_at", next_touch: "next_touch_at" };
/** CSV text → raw prospect objects (header row names the columns; common names understood) */
export function csvToProspects(text) {
  const rows = parseCSV(text); if (rows.length < 2) return [];
  const keys = rows[0].map(h => { const k = String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); return FIELDS.includes(k) || k === "id" ? k : HEADER_ALIASES[k] || null; });
  return rows.slice(1).map(r => { const o = {}; keys.forEach((k, i) => { if (k && k !== "id" && String(r[i] ?? "").trim() !== "") o[k] = r[i]; }); return o; });
}

// ── The 5 example prospects (clearly marked; "Delete examples" removes them) ─
export const EXAMPLES = [
  { first_name: "Sample", last_name: "Contact", title: "Purchasing Manager", company_name: "EXAMPLE – Prairie Erosion Supply", company_website: "example.com", company_type: "Distributor", region: "SK", city: "Regina", email: "sample1@example.com", icp_fit: "strong", fit_reason: "Example: sells erosion control to contractors across SK", channel: "email", status: "new", notes: "Example prospect — delete me" },
  { first_name: "Demo", last_name: "Person", title: "Project Manager", company_name: "EXAMPLE – Northern Pipeline Contractors", company_type: "Contractor", region: "AB", city: "Fort McMurray", linkedin_url: "https://www.linkedin.com/in/example-demo", icp_fit: "maybe", fit_reason: "Example: pipeline right-of-way work needs ECBs", channel: "linkedin", status: "enriched", notes: "Example prospect — delete me" },
  { first_name: "Test", last_name: "Buyer", title: "Owner", company_name: "EXAMPLE – Coastal Landscape Co.", company_type: "End User", region: "BC", city: "Nanaimo", email: "sample3@example.com", icp_fit: "weak", fit_reason: "Example: small landscaper, occasional wattles", channel: "email", status: "drafted", notes: "Example prospect — delete me" },
  { first_name: "Example", last_name: "Lead", title: "Environmental Coordinator", company_name: "EXAMPLE – Great Lakes Marine Works", company_type: "Contractor", region: "ON", city: "Thunder Bay", email: "sample4@example.com", icp_fit: "strong", fit_reason: "Example: in-water work needs turbidity curtains", channel: "email", status: "approved", notes: "Example prospect — delete me" },
  { first_name: "Placeholder", last_name: "Name", title: "Branch Manager", company_name: "EXAMPLE – Midwest Geo Distributors", company_type: "Distributor", region: "ND", city: "Fargo", x_handle: "example_geo", icp_fit: "maybe", fit_reason: "Example: US distributor, would buy in USD", channel: "x", status: "sent", touch_count: 1, notes: "Example prospect — delete me" },
];
