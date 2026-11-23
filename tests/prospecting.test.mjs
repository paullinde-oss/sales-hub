// Prospecting rules — run with: npm test
// (bundled with esbuild first because the app code uses browser-style imports)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as R from "../src/prospecting/rules.js";

const NOW = Date.parse("2026-11-23T18:00:00Z");
const user = { name: "Paul" }, bot = { api: true };
const base = (x = {}) => ({ ...R.blankProspect(), id: "p1", first_name: "Jane", last_name: "Doe", company_name: "Acme Supply Ltd", email: "Jane@Acme.com", linkedin_url: "https://www.linkedin.com/in/janedoe/", ...x });
const ctx = (prospects = [], extra = {}) => ({ accounts: [{ name: "White Cap", terms: ["whitecap"] }], aliases: {}, customers: new Map([["prairie geo", "Prairie Geo Inc."]]), leads: [{ id: 77, company: "Northern Builders Ltd", status: "inprogress" }, { id: 78, company: "Old Lead Co", status: "lost" }], prospects, ...extra });

// ── Dedupe ──
test("duplicate by email (any case)", () => {
  const d = R.findDuplicate({ email: " JANE@acme.com " }, [base()]);
  assert.equal(d.by, "email"); assert.equal(d.match.id, "p1");
});
test("duplicate by LinkedIn when emails differ", () => {
  const d = R.findDuplicate({ email: "other@x.com", linkedin_url: "linkedin.com/in/JaneDoe?trk=abc" }, [base()]);
  assert.equal(d.by, "LinkedIn");
});
test("duplicate by name + company (Ltd / punctuation ignored)", () => {
  const d = R.findDuplicate({ first_name: "jane", last_name: "doe", company_name: "Acme Supply" }, [base({ email: "", linkedin_url: "" })]);
  assert.equal(d.by, "name + company");
});
test("no duplicate for a different person at the same company", () => {
  assert.equal(R.findDuplicate({ first_name: "Bob", last_name: "Smith", company_name: "Acme Supply" }, [base()]), null);
});
test("creating a duplicate warns, force adds it", () => {
  const r = R.createProspect({ first_name: "Jane", last_name: "Doe", email: "jane@acme.com", company_name: "Acme" }, user, ctx([base()]), {}, NOW);
  assert.ok(r.error && r.duplicate);
  const f = R.createProspect({ first_name: "Jane", last_name: "Doe", email: "jane@acme.com", company_name: "Acme" }, user, ctx([base()]), { force: true }, NOW);
  assert.ok(f.prospect && !f.error);
});

// ── Customer / open lead block ──
test("blocked: account on the Sales Summary list", () => {
  const r = R.createProspect({ first_name: "A", company_name: "White Cap Calgary" }, user, ctx(), {}, NOW);
  assert.equal(r.block.kind, "customer"); assert.equal(r.block.name, "White Cap");
});
test("blocked: company we have orders from", () => {
  assert.equal(R.findBlock("Prairie Geo Inc", ctx()).kind, "customer");
});
test("blocked: a branch of a customer, not a different company that merely contains the word", () => {
  const c = ctx({}, {}); c.customers = new Map([["ufa", "UFA"], ["prairie geo", "Prairie Geo Inc."]]);
  assert.equal(R.findBlock("UFA Brooks", c).name, "UFA");
  assert.equal(R.findBlock("Sufa Holdings", c), null);
  assert.equal(R.findBlock("Big Prairie Geo Services", c).kind, "customer"); // a 6+ letter customer name inside counts
});
test("blocked: open lead (with its id), but not a lost one", () => {
  const b = R.findBlock("Northern Builders", ctx());
  assert.equal(b.kind, "lead"); assert.equal(b.id, 77);
  assert.equal(R.findBlock("Old Lead Co", ctx()), null);
});
test("force never skips the block", () => {
  assert.ok(R.createProspect({ first_name: "A", company_name: "White Cap" }, user, ctx(), { force: true }, NOW).block);
});

// ── Every status change logs an activity ──
test("status change writes an activity with from/to", () => {
  const r = R.changeStatus(base(), "drafted", user, {}, NOW);
  assert.equal(r.prospect.status, "drafted");
  assert.equal(r.activity.type, "drafted"); assert.equal(r.activity.status_from, "new"); assert.equal(r.activity.status_to, "drafted");
  assert.equal(r.activity.created_by, "Paul"); assert.equal(r.activity.prospectId, "p1");
});
test("same status = no change, no activity", () => {
  const r = R.changeStatus(base({ status: "drafted" }), "drafted", user, {}, NOW);
  assert.equal(r.activity, null);
});
test("Sent counts a touch and sets the next one", () => {
  const r = R.changeStatus(base({ status: "approved" }), "sent", user, {}, NOW);
  assert.equal(r.prospect.touch_count, 1); assert.equal(r.prospect.last_touch_at, "2026-11-23"); assert.equal(r.prospect.next_touch_at, "2026-11-26");
  assert.equal(r.activity.type, "sent");
  const f = R.logActivity(r.prospect, { type: "follow_up_sent" }, user, {}, NOW);
  assert.equal(f.prospect.touch_count, 2); assert.equal(f.activity.type, "follow_up_sent");
});
test("no more than 4 touches", () => {
  assert.ok(R.logActivity(base({ status: "sent", touch_count: 4 }), { type: "follow_up_sent" }, user, {}, NOW).error);
});
test("a reply moves the status to Replied and clears the next touch", () => {
  const r = R.logActivity(base({ status: "sent", touch_count: 1, next_touch_at: "2026-11-26" }), { type: "reply_received", summary: "Interested" }, user, {}, NOW);
  assert.equal(r.prospect.status, "replied"); assert.equal(r.prospect.next_touch_at, ""); assert.equal(r.activity.status_to, "replied");
});

// ── The Sent guard ──
test("the bot can go up to Approved", () => {
  assert.equal(R.changeStatus(base(), "approved", bot, {}, NOW).prospect.status, "approved");
});
test("the bot can't mark Sent (or later) by default", () => {
  for (const s of ["sent", "replied", "meeting", "no", "on_hold"]) assert.ok(R.changeStatus(base(), s, bot, {}, NOW).error, s);
  assert.ok(R.logActivity(base({ status: "approved" }), { type: "sent" }, bot, {}, NOW).error);
  assert.ok(R.createProspect({ first_name: "X", company_name: "Y Co", status: "sent" }, bot, ctx(), {}, NOW).error);
});
test("…unless 'Let the bot mark Sent' is on", () => {
  assert.equal(R.changeStatus(base({ status: "approved" }), "sent", bot, { botCanSend: true }, NOW).prospect.status, "sent");
});
test("a person can mark Sent", () => {
  assert.equal(R.changeStatus(base({ status: "approved" }), "sent", user, {}, NOW).prospect.status, "sent");
});
test("do-not-contact can't be approved or sent", () => {
  assert.ok(R.changeStatus(base({ do_not_contact: true }), "approved", user, {}, NOW).error);
  assert.ok(R.changeStatus(base({ do_not_contact: true, status: "approved" }), "sent", user, {}, NOW).error);
});

// ── Conversion ──
test("convert: only Replied / Meeting", () => {
  assert.ok(R.convertToLead(base({ status: "sent" }), user, NOW).error);
});
test("convert: people only", () => {
  assert.ok(R.convertToLead(base({ status: "replied" }), bot, NOW).error);
});
test("convert creates a linked lead, logs it and locks the prospect", () => {
  const p = base({ status: "meeting", title: "Buyer", region: "AB", city: "Edmonton", company_type: "Distributor", notes: "Met at show", source_urls: ["https://acme.com"], owner: "Mark" });
  const r = R.convertToLead(p, user, NOW, 555);
  assert.equal(r.lead.leadSource, "Outreach/Prospecting"); assert.equal(r.lead.company, "Acme Supply Ltd"); assert.equal(r.lead.contact, "Jane Doe");
  assert.equal(r.lead.type, "Distributor"); assert.equal(r.lead.status, "inprogress"); assert.equal(r.lead.prospectId, "p1"); assert.equal(r.lead.year, 2026);
  assert.match(r.lead.notes, /jane@acme\.com/i); assert.match(r.lead.notes, /Met at show/); assert.match(r.lead.notes, /acme\.com/);
  assert.equal(r.prospect.converted_lead_id, "555"); assert.equal(r.activity.type, "converted");
  assert.ok(R.isReadOnly(r.prospect));
  assert.ok(R.changeStatus(r.prospect, "no", user, {}, NOW).error);
  assert.ok(R.editProspect(r.prospect, { notes: "x" }, user, NOW).error);
  assert.ok(R.logActivity(r.prospect, { type: "note" }, user, {}, NOW).error);
  assert.ok(R.convertToLead(r.prospect, user, NOW).error);
});

// ── The bot's inbox ──
test("inbox: add skips duplicates and customers, ids are fixed per request", () => {
  const items = [{ id: "in1", json: JSON.stringify({ action: "add", prospects: [
    { first_name: "New", last_name: "Person", company_name: "Fresh Co", email: "new@fresh.com", icp_fit: "strong", source_urls: ["https://fresh.com"] },
    { first_name: "Jane", last_name: "Doe", email: "jane@acme.com" },
    { first_name: "Al", company_name: "Whitecap" }] }) }];
  const out = R.processInbox(items, { prospects: [base()], ctx: ctx() }, { botOn: true }, NOW);
  assert.equal(out.prospects.length, 1); assert.equal(out.prospects[0].id, "in1-0"); assert.equal(out.prospects[0].created_by, "api");
  assert.equal(out.activities[0].type, "researched");
  assert.match(out.results[0].message, /Added 1 of 3/);
});
test("inbox: update by email, status guard applies to the bot", () => {
  const ok = R.processInbox([{ id: "in2", json: JSON.stringify({ action: "update", email: "jane@acme.com", changes: { status: "drafted", title: "Buyer" } }) }], { prospects: [base()], ctx: ctx() }, { botOn: true }, NOW);
  assert.equal(ok.prospects[0].status, "drafted"); assert.equal(ok.prospects[0].title, "Buyer"); assert.equal(ok.activities.length, 1);
  const no = R.processInbox([{ id: "in3", json: JSON.stringify({ action: "update", id: "p1", changes: { status: "sent" } }) }], { prospects: [base()], ctx: ctx() }, { botOn: true }, NOW);
  assert.equal(no.prospects.length, 0); assert.equal(no.results[0].ok, false);
});
test("inbox: refused when the bot is switched off", () => {
  const out = R.processInbox([{ id: "in4", json: '{"action":"add","prospects":[{"first_name":"A","company_name":"B"}]}' }], { prospects: [], ctx: ctx() }, { botOn: false }, NOW);
  assert.equal(out.prospects.length, 0); assert.match(out.results[0].message, /switched off/);
});
test("inbox: bad JSON is reported, not thrown", () => {
  const out = R.processInbox([{ id: "in5", json: "{nope" }], { prospects: [], ctx: ctx() }, { botOn: true }, NOW);
  assert.equal(out.results[0].ok, false);
});

// ── CSV ──
test("CSV export → import round trip", () => {
  const p = base({ notes: 'Said "call me", later', source_urls: ["https://a.com", "https://b.com"], do_not_contact: true });
  const back = R.cleanProspect(R.csvToProspects(R.toCSV([p]))[0]);
  assert.equal(back.email, "jane@acme.com"); assert.equal(back.notes, 'Said "call me", later');
  assert.deepEqual(back.source_urls, ["https://a.com", "https://b.com"]); assert.equal(back.do_not_contact, true);
});
test("CSV with everyday headings", () => {
  const r = R.csvToProspects("Name,Company,E-mail,LinkedIn,Province\nBob Smith,Smith Co,bob@smith.com,linkedin.com/in/bob,SK\n");
  const c = R.cleanProspect(r[0]);
  assert.equal(c.first_name, "Bob"); assert.equal(c.last_name, "Smith"); assert.equal(c.company_name, "Smith Co"); assert.equal(c.region, "SK");
});

// ── Summary strip ──
test("summary counts and overdue follow-ups", () => {
  const ps = [base({ status: "sent", touch_count: 1, next_touch_at: "2026-11-20" }), base({ id: "p2", status: "new" })];
  const acts = [{ type: "sent", occurred_at: "2026-11-23T15:00:00Z" }, { type: "reply_received", occurred_at: "2026-10-02T15:00:00Z" }];
  const s = R.summarize(ps, acts, NOW);
  assert.equal(s.byStatus.sent, 1); assert.equal(s.byStatus.new, 1); assert.equal(s.firstWeek, 1); assert.equal(s.repliesMonth, 0); assert.equal(s.replies, 1); assert.equal(s.overdue, 1);
});
