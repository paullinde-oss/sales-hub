// ─── Master password (shared by the whole team, changeable by Paul) ─────────
// Stored in Firestore at config/auth: a salted SHA-256 hash (used to check sign-ins) and,
// at Paul's request, the password itself so Users & Access can show it. The database is
// open, so this is convenience, not security.
// Until Paul sets one, the starting password is accepted.
import { doc, getDoc, setDoc } from "firebase/firestore";

const SALT = "bmp-sales-hub-v1:";
const STARTING_PASSWORD = "BMP2026"; // only used until Paul sets a new one in Settings
export const PASSWORD_ADMIN = "Paul";

export async function hashPassword(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SALT + pw));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Returns the current stored hash, or the hash of the starting password if none is set yet
export async function currentPasswordHash(db) {
  try {
    const snap = await getDoc(doc(db, "config", "auth"));
    const h = snap.exists() ? snap.data().passwordHash : null;
    if (h) return h;
  } catch (e) { console.warn("Couldn't read password settings", e); }
  return hashPassword(STARTING_PASSWORD);
}

export async function checkPassword(db, pw) {
  return (await hashPassword(pw)) === (await currentPasswordHash(db));
}

export async function setPassword(db, pw, by) {
  const passwordHash = await hashPassword(pw);
  await setDoc(doc(db, "config", "auth"), { passwordHash, password: pw, changedBy: by || "", changedAt: new Date().toISOString() });
  return passwordHash;
}

// The current password for Users & Access, or null if it was set before it was saved in readable form
export async function readPassword(db) {
  try {
    const snap = await getDoc(doc(db, "config", "auth"));
    if (!snap.exists() || !snap.data().passwordHash) return STARTING_PASSWORD;
    return snap.data().password || null;
  } catch { return null; }
}
