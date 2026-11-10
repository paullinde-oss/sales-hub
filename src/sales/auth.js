// ─── Sign-in: every person has their own password ───────────────────────────
// Paul (admin) sets each person's password in Users & Access; people can change their own.
// Stored in Firestore at config/logins as { users: { "<name lowercase>": entry } }, where entry =
//   { salt, hash }          — PBKDF2 of the password (never the password itself: the database is open)
//   { wrapSalt, wrap }      — only for "Costs & margins" people: the cost key, locked with their password
//   { setBy, setAt }
// The cost key (random, see costs.js) encrypts config/productCosts. Signing in unlocks it with the
// person's own password, so cost viewers need no second password.
// The old shared master password (config/auth) works only until Paul clicks "Switch everyone to
// personal passwords" (config/auth.masterOff = true).
import { doc, getDoc, setDoc, updateDoc, onSnapshot, deleteField, FieldPath } from "firebase/firestore";
import { wrapCostKey, unwrapCostKey, getCostKey, setCostKey } from "../pricelist/costs";

const SALT = "bmp-sales-hub-v1:";
const STARTING_PASSWORD = "BMP2026";
const ITER = 150000;
const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
export const userKey = name => String(name || "").trim().toLowerCase();

// Old master password hash (kept only for the switch-over)
export async function hashPassword(pw) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(SALT + pw)));
}
async function masterState(db) {
  try {
    const s = await getDoc(doc(db, "config", "auth"));
    const d = s.exists() ? s.data() : {};
    return { off: !!d.masterOff, hash: d.passwordHash || await hashPassword(STARTING_PASSWORD) };
  } catch { return { off: false, hash: await hashPassword(STARTING_PASSWORD) }; }
}
async function pwHash(pw, saltB64) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: unb64(saltB64), iterations: ITER, hash: "SHA-256" }, base, 256));
}
async function readLogins(db) {
  const s = await getDoc(doc(db, "config", "logins"));
  return (s.exists() && s.data().users) || {};
}
export function listenLogins(db, cb) {
  return onSnapshot(doc(db, "config", "logins"), s => cb((s.exists() && s.data().users) || {}), () => cb(null));
}
export function listenMaster(db, cb) {
  return onSnapshot(doc(db, "config", "auth"), s => cb({ off: !!(s.exists() && s.data().masterOff) }), () => cb(null));
}

// → { ok, token } — token is remembered on this computer; it stops working if the password is changed
export async function signIn(db, name, pw) {
  const k = userKey(name), entry = (await readLogins(db))[k];
  if (entry?.hash) {
    if ((await pwHash(pw, entry.salt)) !== entry.hash) return { ok: false };
    if (entry.wrap) { try { setCostKey(await unwrapCostKey(entry.wrap, pw, entry.wrapSalt)); } catch { setCostKey(""); } }
    else setCostKey("");
    return { ok: true, token: "u:" + entry.hash };
  }
  const m = await masterState(db);
  if (!m.off && (await hashPassword(pw)) === m.hash) return { ok: true, token: m.hash, master: true };
  return { ok: false, noPassword: m.off };
}

// Is the remembered sign-in still good? (false after a password reset or the switch-over)
export function tokenValid(token, name, logins, master) {
  if (!token || !logins || !master) return true; // not loaded yet — don't sign anyone out
  const entry = logins[userKey(name)];
  if (entry?.hash) return token === "u:" + entry.hash;
  return !master.off && !token.startsWith("u:");
}

async function makeEntry(pw, by, giveCosts, costKey) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const entry = { salt, hash: await pwHash(pw, salt), setBy: by || "", setAt: new Date().toISOString() };
  if (giveCosts && costKey) { const wrapSalt = b64(crypto.getRandomValues(new Uint8Array(16))); entry.wrapSalt = wrapSalt; entry.wrap = await wrapCostKey(costKey, pw, wrapSalt); }
  return entry;
}
async function putEntry(db, k, entry) {
  await setDoc(doc(db, "config", "logins"), {}, { merge: true });
  await updateDoc(doc(db, "config", "logins"), new FieldPath("users", k), entry);
}

// Admin sets someone's password. costKey = the admin's unlocked cost key (needed to give cost access).
// Returns the new token when the admin set their own password (so they stay signed in).
export async function setUserPassword(db, name, pw, { by, giveCosts, costKey }) {
  const k = userKey(name);
  const entry = await makeEntry(pw, by, giveCosts, costKey);
  await putEntry(db, k, entry);
  return "u:" + entry.hash;
}
// A person changes their own password (keeps their cost access)
export async function changeOwnPassword(db, name, oldPw, newPw) {
  const k = userKey(name), entry = (await readLogins(db))[k];
  if (!entry?.hash || (await pwHash(oldPw, entry.salt)) !== entry.hash) throw new Error("Your current password isn't right.");
  let key = getCostKey();
  if (entry.wrap && !key) { try { key = await unwrapCostKey(entry.wrap, oldPw, entry.wrapSalt); } catch { key = ""; } }
  const next = await makeEntry(newPw, entry.setBy || name, !!entry.wrap, key);
  next.setBy = entry.setBy || ""; next.setAt = entry.setAt || ""; next.changedAt = new Date().toISOString();
  await putEntry(db, k, next);
  return "u:" + next.hash;
}
// Take away cost access without changing the password
export async function removeCostAccess(db, name) {
  await updateDoc(doc(db, "config", "logins"), new FieldPath("users", userKey(name), "wrap"), deleteField(), new FieldPath("users", userKey(name), "wrapSalt"), deleteField());
}
export async function removeLogin(db, name) {
  await updateDoc(doc(db, "config", "logins"), new FieldPath("users", userKey(name)), deleteField());
}
// The hard switch: the shared master password stops working, and its readable copy is deleted
export async function turnOffMaster(db, by) {
  await setDoc(doc(db, "config", "auth"), { masterOff: true, password: deleteField(), passwordHash: deleteField(), offBy: by || "", offAt: new Date().toISOString() }, { merge: true });
}
