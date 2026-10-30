// ─── One full sync run: Dropbox PDFs → orders, plus the bookkeeping around it ─
// Shared by Sales Summary (↻ Refresh / auto-sync when opened) and the hourly automatic
// sync on GitHub (scripts/autosync.mjs), so both follow exactly the same rules.
import { doc, setDoc, deleteField } from "firebase/firestore";
import { syncOrders } from "./sync";

// Bump when the PDF reading changes in a way that should fix orders already synced:
// the next sync then re-reads every PDF in the date range (corrections are kept)
export const PARSER_VERSION = 3; // (problem PDFs listed under Missing order numbers are always retried)
export const SYNC_DEFAULTS = {
  since: "2025-12-01",
  folders: [
    "/Brooks Division/Brooks BOL/Brooks Order Confirmations",
    "/Calgary BOL/Calgary Order Confirmations",
  ],
};

/**
 * settings: merged sales settings; seen / oldFiles: config/salesSyncSeen files / old;
 * issues: config/salesSyncIssues files; rawOrders: every stored order (must be fully loaded).
 * Returns syncOrders' result.
 */
export async function runFullSync({ db, settings, seen, oldFiles, issues, rawOrders, loginName, onProgress, pdfjs }) {
  const existing = Object.fromEntries(rawOrders.map(o => [o.orderNo, o]));
  // Re-read PDFs that came in without a usable date (e.g. "January 0, 1900") or customer name
  const badDate = new Set(rawOrders.filter(o => !/^20\d\d-/.test(o.override?.date || o.date || "") || !(o.customer || "").trim()).map(o => o.file?.id).filter(Boolean));
  // Record finished files every 25 so an interrupted sync picks up where it left off
  const saveSeen = batch => setDoc(doc(db, "config", "salesSyncSeen"), { files: batch }, { merge: true });
  const saveOld = batch => setDoc(doc(db, "config", "salesSyncSeen"), { old: batch }, { merge: true });
  // One-time: PDFs skipped before problem files were tracked get one more look, so gaps show a real reason
  const orderFiles = new Set(rawOrders.map(o => o.file?.id).filter(Boolean));
  const reread = (settings.parserVersion || 0) < PARSER_VERSION;
  // Start date moved earlier since the last sync: PDFs skipped as "too old" back then get another look
  const sinceMovedBack = !settings.syncedSince || settings.since < settings.syncedSince;
  const retry = id => reread || badDate.has(id) || !!issues[id] || ((!settings.issuesTracked || sinceMovedBack) && !orderFiles.has(id));
  const r = await syncOrders({ db, folders: settings.folders, since: settings.since, seen: Object.fromEntries(Object.entries(seen).filter(([id]) => !retry(id))), old: sinceMovedBack ? {} : oldFiles, existing, loginName, onProgress, onSeen: saveSeen, pdfjs });
  if (Object.keys(r.seen).length) await saveSeen(r.seen);
  if (Object.keys(r.old).length) await saveOld(r.old);
  if (Object.keys(r.listing).length) await setDoc(doc(db, "config", "salesSyncFiles"), { numbers: r.listing, at: new Date().toISOString() });
  if (Object.keys(r.issues).length || Object.keys(r.resolved).length)
    await setDoc(doc(db, "config", "salesSyncIssues"), { files: { ...r.issues, ...Object.fromEntries(Object.keys(r.resolved).map(id => [id, deleteField()])) } }, { merge: true });
  const lastSync = { at: new Date().toISOString(), by: loginName || "", added: r.added, updated: r.updated, errors: r.errors.length, scanned: r.scanned };
  await setDoc(doc(db, "config", "salesSettings"), { lastSync, issuesTracked: true, parserVersion: PARSER_VERSION, syncedSince: settings.since }, { merge: true });
  return r;
}
