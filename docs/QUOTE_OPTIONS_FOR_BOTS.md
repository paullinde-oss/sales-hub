# Update for quoting assistants: Quote Options in the BMP Sales Hub

**What's new:** a single quote can now offer the customer **up to 5 alternatives** ("options"). The
customer chooses **one**. Use options whenever you'd otherwise write "Option A or Option B" in one
quote. Don't make separate quotes for each alternative, and don't add the alternatives together on
one total.

---

## When to use options
- The customer asked for prices on alternatives: different products (e.g. coir vs straw vs jute
  blanket), different grades or sizes, different quantities, or with/without an add-on.
- **Only one option will be bought.** If the customer will buy several items together, those are
  normal lines, not options.
- If there's only one choice, don't use options. A normal quote stays exactly as before.

## How an option quote is structured
- **Option 1 … Option 5:** each has its own line items and an optional short name, e.g.
  "Coir blanket" or "12-inch wattles". Keep names short and descriptive.
- **Common to all options:** lines that apply whichever option is chosen, typically **freight**,
  labels, fees or accessories needed in every case. These are **added to every option's total**.
  Put them here once; don't repeat them inside each option.
- **There is no grand total.** Each option shows its own total (its lines + the common lines). The
  printed quote and email list every option's total and say "Please choose one option."
- At least **2** options are needed for a quote to count as an option quote. At most **5**.

### Example
| Block | Line | Qty | Unit | Line total |
|---|---|---|---|---|
| Option 1 — Coir | Coir blanket 8' x 112.5' | 10 | $100 | $1,000 |
| Option 2 — Straw | Straw blanket 8' x 112.5' | 10 | $80 | $800 |
| Option 3 — Jute | Jute blanket 8' x 112.5' | 10 | $60 | $600 |
| Common to all options | Freight to Red Deer, AB | 1 | $500 | $500 |

Option totals: **Option 1 = $1,500 · Option 2 = $1,300 · Option 3 = $1,100**. Not $3,400.

## In the Sales Hub screen
1. Create the quote and enter the first option's lines as usual.
2. Click **"+ Add options"** under the line items. The existing lines become Option 1 and an empty
   Option 2 appears.
3. Use **"+ Add line to Option X"** inside each block, and **"+ Add option 3/4/5"** for more.
4. Put shared lines (freight etc.) in **"Common to all options"** with "+ Add line to Common".
5. Optionally type a name in each option's name box.
6. Each line has a small dropdown (Opt 1 / Opt 2 / … / Common) to move it to another block.
   "Remove option" deletes an option and its lines.
7. Save as usual.

## If you create quotes as data (Firestore `quotes` collection)
A quote document is unchanged except for these fields:

```json
{
  "options": [ { "name": "Coir" }, { "name": "Straw" }, { "name": "Jute" } ],
  "lineItems": [
    { "id": 1, "sku": "BMP-BDNC08", "description": "Coir blanket 8' x 112.5'", "qty": 10, "unitPrice": 100, "increase": 0, "basePrice": 100, "option": 1 },
    { "id": 2, "sku": "BMP-BDNS08", "description": "Straw blanket 8' x 112.5'", "qty": 10, "unitPrice": 80,  "increase": 0, "basePrice": 80,  "option": 2 },
    { "id": 3, "sku": "BMP-BDNJ08", "description": "Jute blanket 8' x 112.5'",  "qty": 10, "unitPrice": 60,  "increase": 0, "basePrice": 60,  "option": 3 },
    { "id": 4, "sku": "", "description": "Freight to Red Deer, AB", "qty": 1, "unitPrice": 500, "increase": 0, "basePrice": 500, "option": 0 }
  ]
}
```
- `options`: an array of 2–5 objects (`name` may be ""). Its **length** is the number of options.
  Leave `options` out (or set it to `null`) for a normal quote.
- `lineItems[].option`: **1–5** = belongs to that option; **0** = common to all options. On an
  option quote every line should have `option` set. A line without it is treated as Option 1.
- Line total = `unitPrice × qty`. Option total = its lines + all `option: 0` lines.
- The SKUs above are only illustrative. Always use real SKUs from the Products & Price List.
- All other quote fields (`quoteNum`, `name`, `email`, `company`, `currency`, `quoteStatus`,
  `savedBy`, `savedDate`, `saved`, `validFor`, notes …) work exactly as before.
- **Always write through the hub's normal save path or include `_updated: serverTimestamp()`.**
  Every browser only downloads quotes whose `_updated` changed, so a quote written without it may not
  show up for others.
- Don't set `wonOption` when creating a quote. It's filled in when the quote is won (below).

## How results are recorded (for reference)
- **Won:** a person marks the quote won and the hub asks **which option** the customer chose. That
  is stored as `wonOption` (1–5). From then on the quote's value is that option's total.
- When an order confirmation is matched to the quote (**Quote Matches → Mark quote won**), the hub
  pre-selects the option closest to the order total. The quote's lines are then replaced by what was
  actually ordered. The offered options are kept in `quotedOptions` / `quotedLineItems`, and
  `options` becomes `null`.
- **Lost / Cold / Open:** no option is chosen. The quote's value is the **average** of its option
  totals.
- **Counting:** an option quote is still **one quote**: one win or one loss in win rates, never 3.
  Dollar figures (pipeline value, won $, lead potential value) use the rule above, so options never
  inflate totals.
- **Quote Matches:** an order is suggested as a match if **any one** option's total is within $3,000
  of the order.

## Quick rules
1. One customer request with alternatives → **one quote with options**, not several quotes.
2. Shared costs (freight etc.) → **Common to all options**, entered once.
3. Never present a combined total of all options.
4. Name options clearly so the customer and the team can say "they took Option 2 — Straw".
5. Max 5 options. If there's only one choice, don't use options.
