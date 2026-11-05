// ─── Price list versions in Firestore ────────────────────────────────────────
// priceLists/{id} — one document per version (see priceLists.js). config/customerPrices holds the
// customer price lists of the current version, which quotes use ({ lists, usdMultiplier, version }).
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, arrayUnion, deleteField, FieldPath, getDoc, getDocs } from "firebase/firestore";
import { versionProducts, customerLists, MASTER_2026_V2_SKUS, DEFAULT_NOTES, up } from "./priceLists";

const COL = "priceLists";
const now = () => new Date().toISOString();
const clean = v => JSON.parse(JSON.stringify(v ?? null));

export function listenPriceLists(db, cb, onError) {
  return onSnapshot(collection(db, COL), s => cb(s.docs.map(d => ({ ...d.data(), id: d.id }))), onError);
}
export function listenCustomerPrices(db, cb) {
  return onSnapshot(doc(db, "config", "customerPrices"), s => cb(s.exists() ? s.data() : {}), () => cb({}));
}

// Field paths: names like "Misc. BMP Products" or "White Cap" can contain dots and spaces, so
// nested fields are written as path("customers", name, "prices", sku) rather than dotted strings
const SEP = "\u0001";
export const path = (...parts) => parts.join(SEP);
export const pathParts = k => k.split(SEP);

// Every change is stamped with who and when, and added to the version's change log.
// A null value removes the field.
export function updateVersion(db, id, patch, by, what) {
  const entry = { at: now(), by: by || "", what: String(what || "").slice(0, 300) };
  const args = [];
  Object.entries(patch).forEach(([k, v]) => args.push(new FieldPath(...pathParts(k)), v === null || v === undefined ? deleteField() : clean(v)));
  args.push("updatedAt", entry.at, "updatedBy", entry.by, "log", arrayUnion(entry));
  return updateDoc(doc(db, COL, id), ...args);
}

// One-time: name the list quotes use today (e.g. "2026 V2")
export async function setUpCurrent(db, { name, effectiveDate, by, usdMultiplier }) {
  const id = "v" + Date.now();
  const at = now();
  await setDoc(doc(db, COL, id), clean({
    name, effectiveDate, status: "current", usdMultiplier,
    onList: Object.fromEntries(MASTER_2026_V2_SKUS.map(s => [up(s), true])),
    notes: DEFAULT_NOTES, customers: {}, rules: { categories: {}, skus: {} }, overrides: {},
    createdAt: at, createdBy: by, updatedAt: at, updatedBy: by, activatedAt: at, activatedBy: by,
    log: [{ at, by, what: `Set up ${name} as the current price list` }],
  }));
  return id;
}

// New draft copied from the current version: same customer list, notes and customer prices
export async function startDraft(db, current, { name, effectiveDate, by }) {
  const id = "v" + Date.now();
  const at = now();
  const customers = {};
  Object.entries(current.customers || {}).forEach(([n, l]) => { customers[n] = { terms: l.terms || [n], prices: l.prices || {} }; });
  await setDoc(doc(db, COL, id), clean({
    name, effectiveDate, status: "draft", basedOn: current.id, basedOnName: current.name,
    usdMultiplier: 0.95, // Paul: USD price = CAD × multiplier (about what US customers pay now); editable
    onList: current.onList || {}, notes: current.notes || DEFAULT_NOTES, customers,
    rules: { categories: {}, skus: {} }, overrides: {},
    createdAt: at, createdBy: by, updatedAt: at, updatedBy: by,
    log: [{ at, by, what: `Started ${name} from ${current.name}` }],
  }));
  return id;
}

export const deleteDraft = (db, id) => deleteDoc(doc(db, COL, id));

// Keep config/customerPrices (what quotes read) in step with the current version
export const publishCustomerPrices = (db, v, catOf) =>
  setDoc(doc(db, "config", "customerPrices"), clean({ lists: customerLists(v, catOf), usdMultiplier: v.usdMultiplier ?? null, version: v.name, at: now() }));

// Make a draft the current price list: its worked-out prices become the product list quotes use,
// the old current version is frozen into history
export async function makeActive(db, draft, current, liveProducts, categories, by) {
  const at = now();
  const catOf = sku => categories[sku] || "Uncategorized";
  const products = versionProducts(draft, liveProducts, categories);
  const customers = customerLists(draft, catOf);
  if (current) await updateDoc(doc(db, COL, current.id), { ...clean({ status: "archived", products: liveProducts, archivedAt: at, archivedBy: by }), log: arrayUnion({ at, by, what: `Replaced by ${draft.name}` }) });
  await setDoc(doc(db, "config", "productsCAD"), clean({ items: products }));
  await updateDoc(doc(db, COL, draft.id), { ...clean({ status: "current", customers, activatedAt: at, activatedBy: by, updatedAt: at, updatedBy: by }), log: arrayUnion({ at, by, what: `Made active — quotes now use ${draft.name}` }) });
  await publishCustomerPrices(db, { ...draft, status: "current", customers }, catOf);
}

// ── Scheduled go-live ────────────────────────────────────────────────────────
// A draft marked "scheduled" becomes the current list on its effective date (Alberta time).
// The hourly GitHub job (scripts/autosync.mjs) calls activateDue; it works the same in a browser.
export const albertaToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Edmonton" });
export async function activateDue(db, by = "Scheduled go-live") {
  const lists = (await getDocs(collection(db, COL))).docs.map(d => ({ ...d.data(), id: d.id }));
  const due = lists.filter(v => v.status === "draft" && v.scheduled && v.effectiveDate && v.effectiveDate <= albertaToday())
    .sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : 1));
  const done = [];
  for (const draft of due.slice(-1)) { // if several are due, the latest effective one wins
    const current = lists.find(v => v.status === "current");
    const live = (await getDoc(doc(db, "config", "productsCAD"))).data()?.items || [];
    const categories = (await getDoc(doc(db, "config", "categories"))).data()?.map || {};
    if (!live.length) throw new Error("Product list is empty — not activating " + draft.name);
    await makeActive(db, draft, current, live, categories, by);
    await updateDoc(doc(db, COL, draft.id), { scheduled: false });
    done.push(draft.name);
  }
  return done;
}
