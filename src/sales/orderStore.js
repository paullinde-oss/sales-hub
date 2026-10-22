// ─── Where synced orders are stored ──────────────────────────────────────────
// Each order is saved in two places:
//   • salesOrders/{orderNo} — one document per order (the full record)
//   • orderPacks/p0…p47     — the same orders grouped into 48 documents
// The hub reads the 48 packs instead of every order, so opening Sales Summary
// costs ~48 database reads instead of one per order (Firebase's free plan allows
// 50,000 reads a day). Writes go to both through the helpers below.
// Each pack holds up to 1 MB: 48 of them fit roughly 30,000 orders (~40 years at
// today's volume). Changing PACKS means using a new collection name and rebuilding.
import { doc, collection, setDoc, updateDoc, deleteDoc, deleteField, getDocs, onSnapshot, FieldPath } from "firebase/firestore";

export const PACKS = 48;
const PACK_COLLECTION = "orderPacks";
const packId = no => { let h = 0; for (const c of String(no)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return "p" + (h % PACKS); };
const packRef = (db, no) => doc(db, PACK_COLLECTION, packId(no));
const clean = v => JSON.parse(JSON.stringify(v ?? null)); // drops undefined values Firestore rejects

// Save an order (fields are merged, like setDoc with merge: an existing "override" is kept)
export async function writeOrder(db, no, data) {
  await setDoc(doc(db, "salesOrders", no), data, { merge: true });
  await setDoc(packRef(db, no), {}, { merge: true });
  const args = [];
  for (const [k, v] of Object.entries(data)) if (v !== undefined) args.push(new FieldPath("orders", no, k), clean(v));
  if (args.length) await updateDoc(packRef(db, no), ...args);
}

export async function removeOrder(db, no) {
  await deleteDoc(doc(db, "salesOrders", no));
  await setDoc(packRef(db, no), {}, { merge: true });
  await updateDoc(packRef(db, no), new FieldPath("orders", no), deleteField());
}

// Live list of all orders, read from the packs
export function listenOrders(db, onOrders, onError) {
  return onSnapshot(collection(db, PACK_COLLECTION), s => {
    const all = [];
    s.docs.forEach(d => Object.entries(d.data().orders || {}).forEach(([no, o]) => all.push({ ...o, orderNo: no })));
    onOrders(all, s.docs.length);
  }, onError);
}

// One-time: copy every order document into the packs (reads each order once)
export async function buildPacks(db) {
  const snap = await getDocs(collection(db, "salesOrders"));
  const packs = {};
  snap.docs.forEach(d => { (packs[packId(d.id)] ||= {})[d.id] = d.data(); });
  for (let i = 0; i < PACKS; i++) await setDoc(doc(db, PACK_COLLECTION, "p" + i), { orders: packs["p" + i] || {} });
  return snap.size;
}
