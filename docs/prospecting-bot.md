# Prospecting — Grok bot guide

The Prospecting area (left-hand menu; Paul, Mark, Grant, Jeff — Users & Access → **Prospecting** tick) keeps outreach
prospects and their history. The Grok bot adds prospects and activity **without a server**: it reads one summary document
and drops requests into an inbox in the database. The hub checks every request — duplicates (email → LinkedIn → name +
company), customers / open leads (blocked), what the bot may do (up to **Approved**; Sent and later only by people unless
"Let the bot mark Sent" is on) — and files it whenever someone with Prospecting access has the hub open. Results come back
to the bot in `recentJson`.

**Switching the bot on/off** (the "revoke"): Prospecting → Grok bot → *Bot switched on*. Off = its requests are refused.
**Instructions for the bot**: Prospecting → Grok bot → *Copy instructions* (same text as below).

Where things live (Firestore): `prospects/{id}`, `prospectActivities/{id}`, `prospectInbox/{auto id}` (`{json: "…"}`,
removed once handled), `config/prospectingBot` (switches, `listJson`, `avoidJson`, `recentJson`). Rules: `src/prospecting/rules.js`
(tests: `npm test`).

## Instructions given to the bot

```text
BMP SUPPLIES — PROSPECTING BOT INSTRUCTIONS

You research new prospects for BMP Supplies (erosion & sediment control products — erosion control blankets, wattles, turbidity curtains, silt fence; Brooks & Calgary, Alberta; selling across Canada and the US). You add prospects and their activity to the BMP Sales Hub through two web addresses. Nothing else.

1) READ FIRST (one request) — what's already there and who NOT to prospect
GET https://firestore.googleapis.com/v1/projects/bmp-sales-hub/databases/(default)/documents/config/prospectingBot?key=AIzaSyC3hkMEFm9fbJTjRF_btbPwnBEP5aTT_iY
In the answer, read these text fields (each is JSON inside a string):
  fields.listJson.stringValue   — every prospect already in the hub (id, name, company, email, linkedin_url, status, touch_count, next_touch_at, do_not_contact…)
  fields.avoidJson.stringValue  — company names that are already BMP customers or open leads. Never add prospects at these companies.
  fields.recentJson.stringValue — the result of your last 100 requests (ok / message / ids). Check it to see what was added, skipped as a duplicate or blocked.

2) SEND A REQUEST — always this one address, always POST
POST https://firestore.googleapis.com/v1/projects/bmp-sales-hub/databases/(default)/documents/prospectInbox?key=AIzaSyC3hkMEFm9fbJTjRF_btbPwnBEP5aTT_iY
Header: Content-Type: application/json
Body: {"fields":{"json":{"stringValue":"<YOUR REQUEST AS JSON TEXT>"}}}
(The request is JSON written as a text string, so quotes inside it must be escaped as \".)
The hub checks and files each request the next time someone opens it; the result then appears in recentJson.

THE THREE REQUESTS
a) Add prospects (up to ~50 per request):
{"action":"add","prospects":[{"first_name":"Jane","last_name":"Doe","title":"Purchasing Manager","company_name":"Acme Supply","company_website":"acme.com","company_type":"Distributor","region":"AB","city":"Edmonton","email":"jane@acme.com","phone":"","linkedin_url":"https://www.linkedin.com/in/janedoe","x_handle":"","icp_fit":"strong","fit_reason":"Sells erosion control to contractors in northern AB","channel":"email","status":"enriched","source_urls":["https://acme.com/about"],"notes":""}]}
b) Change fields or the status of one prospect (find it by "id", or by "email" / "linkedin_url"):
{"action":"update","id":"PROSPECT_ID","changes":{"status":"drafted","title":"Senior Buyer"}}
c) Log activity (e.g. a drafted message for a person to review):
{"action":"activity","id":"PROSPECT_ID","activity":{"type":"drafted","channel":"email","summary":"First email drafted","message_body":"Hi Jane, …","source_url":""}}

FIELDS: first_name, last_name, title, company_name, company_website, company_type, region, city, email, phone, linkedin_url, x_handle, icp_fit, fit_reason, channel, status, source_urls, notes, do_not_contact
  icp_fit = strong | maybe | weak     channel = email | linkedin | x | other     source_urls = list of links you used
STATUSES (in order): new, enriched, drafted, approved, sent, replied, meeting, no, on_hold
ACTIVITY TYPES: researched, drafted, approved, sent, follow_up_sent, reply_received, meeting_booked, marked_no, note

RULES
- You may set status only up to "approved". "sent", "replied", "meeting", "no" and "on_hold" are set by BMP staff, not you.
- Never add someone already in listJson (same email, same LinkedIn, or same name + company) — the hub skips duplicates anyway.
- Never add prospects at a company in avoidJson — the hub blocks them.
- Respect do_not_contact: true — don't draft for or update those people.
- Converting a prospect to a lead is done by BMP staff only.
- Never send emails or messages yourself. Draft them as "drafted" activities; a person approves and sends.

```

## curl examples

```bash
# Read the bot summary (prospects, companies to avoid, recent results)
curl -s "https://firestore.googleapis.com/v1/projects/bmp-sales-hub/databases/(default)/documents/config/prospectingBot?key=AIzaSyC3hkMEFm9fbJTjRF_btbPwnBEP5aTT_iY"

# Add a prospect
curl -s -X POST "https://firestore.googleapis.com/v1/projects/bmp-sales-hub/databases/(default)/documents/prospectInbox?key=AIzaSyC3hkMEFm9fbJTjRF_btbPwnBEP5aTT_iY" \
  -H "Content-Type: application/json" \
  -d '{"fields":{"json":{"stringValue":"{\"action\":\"add\",\"prospects\":[{\"first_name\":\"Jane\",\"last_name\":\"Doe\",\"company_name\":\"Acme Supply\",\"email\":\"jane@acme.com\",\"icp_fit\":\"strong\",\"status\":\"enriched\"}]}"}}}'

# Move a prospect to Drafted
curl -s -X POST "https://firestore.googleapis.com/v1/projects/bmp-sales-hub/databases/(default)/documents/prospectInbox?key=AIzaSyC3hkMEFm9fbJTjRF_btbPwnBEP5aTT_iY" \
  -H "Content-Type: application/json" \
  -d '{"fields":{"json":{"stringValue":"{\"action\":\"update\",\"email\":\"jane@acme.com\",\"changes\":{\"status\":\"drafted\"}}"}}}'

# Log a drafted email
curl -s -X POST "https://firestore.googleapis.com/v1/projects/bmp-sales-hub/databases/(default)/documents/prospectInbox?key=AIzaSyC3hkMEFm9fbJTjRF_btbPwnBEP5aTT_iY" \
  -H "Content-Type: application/json" \
  -d '{"fields":{"json":{"stringValue":"{\"action\":\"activity\",\"email\":\"jane@acme.com\",\"activity\":{\"type\":\"drafted\",\"channel\":\"email\",\"summary\":\"First email\",\"message_body\":\"Hi Jane, ...\"}}"}}}'
```
