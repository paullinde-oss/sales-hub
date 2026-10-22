// ─── Dropbox → Firestore sync of order confirmations ────────────────────────
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { listPdfs, downloadFile } from "./dropbox";
import { parseOrderPdf, parseLongDate, orderNoFrom } from "./ocParser";

let pdfjsPromise = null;
export async function loadPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = Promise.all([
    import("pdfjs-dist/build/pdf"),
    import("pdfjs-dist/build/pdf.worker.min.js?url"),
  ]).then(([lib, worker]) => {
    const pdfjs = lib.default?.getDocument ? lib.default : lib;
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

// Skip files we can tell are older than the sync start date without downloading them
function obviouslyTooOld(file, since) {
  const d = parseLongDate(file.name.replace(/_/g, " "));
  if (d) return d < since;
  const years = [...file.path.matchAll(/\b(20\d\d)\b/g)].map(m => +m[1]);
  if (years.length) return Math.max(...years) < +since.slice(0, 4);
  return false;
}

/**
 * opts: { db, folders, since, seen, existing, loginName, onProgress }
 *   seen     — { fileId: rev } already processed
 *   existing — { orderNo: order } currently in Firestore
 * Returns { added, updated, skipped, errors: [{file, error}], seen }
 */
export async function syncOrders({ db, folders, since, seen = {}, existing = {}, loginName, onProgress = () => {}, onSeen = null }) {
  onProgress({ stage: "Listing Dropbox folders…", done: 0, total: 0 });
  // A missing folder shouldn't stop the others from syncing — report it and carry on
  let files = [];
  const folderErrors = [];
  for (const f of folders.filter(Boolean)) {
    try { files.push(...await listPdfs(f)); }
    catch (e) { folderErrors.push({ file: f, error: /not_found/.test(e.message) ? "Folder not found — use Browse in Sales Summary → Settings to pick it" : String(e.message).slice(0, 160) }); }
  }
  if (folderErrors.length && !files.length) {
    const e = new Error(`Couldn't open ${folderErrors.map(x => `"${x.file}"`).join(" or ")} in Dropbox. Go to Sales Summary → Settings and use "Browse Dropbox" to pick the right folder.`);
    throw e;
  }
  // A folder listed inside another listed folder would otherwise be read twice
  files = [...new Map(files.map(f => [f.id, f])).values()];
  const todo = files
    .filter(f => seen[f.id] !== f.rev && !obviouslyTooOld(f, since))
    // oldest first so a revised OC overwrites the earlier version
    .sort((a, b) => (a.modified < b.modified ? -1 : 1));

  // issues: files we couldn't turn into an order (shown under "Missing order numbers"); resolved: ones that now read fine
  const res = { added: 0, updated: 0, skipped: 0, errors: [...folderErrors], seen: {}, scanned: files.length, issues: {}, resolved: {}, removed: [], listing: {} };
  // Every BRO/CAL number that has a PDF, with the date in its file name — used by "Missing order numbers"
  for (const f of files) { const no = orderNoFrom(f.name); if (no) res.listing[no] = parseLongDate(f.name.replace(/_/g, " ")) || "?"; }
  const issue = (file, reason) => { res.issues[file.id] = { name: file.name, path: file.path, reason, at: new Date().toISOString() }; };
  const formats = Object.fromEntries(Object.entries(existing).map(([k, o]) => [k, o.format]));
  // Which order each file was saved as before, so a re-read under a different number/date can clean up
  const byFile = {};
  Object.entries(existing).forEach(([no, o]) => { if (o.file?.id) byFile[o.file.id] = no; });
  const dropStale = async (file, keepNo) => {
    const old = byFile[file.id];
    if (old && old !== keepNo) { await deleteDoc(doc(db, "salesOrders", old)).catch(() => {}); delete formats[old]; res.removed.push(old); }
  };
  // Orders saved earlier from PDFs whose file name dates them before the start date: take them out
  for (const f of files) if (byFile[f.id] && obviouslyTooOld(f, since)) await dropStale(f, null);
  if (!todo.length) { onProgress({ stage: "Up to date", done: 0, total: 0 }); return res; }

  const pdfjs = await loadPdfjs();
  let done = 0, pending = {};
  const worker = async () => {
    while (todo.length) {
      const file = todo.shift();
      let tooOld = false;
      try {
        const data = await downloadFile(file);
        const o = await parseOrderPdf(pdfjs, data, file.name.replace(/_/g, " "));
        if (o && o.date && o.nameDate && o.date !== o.nameDate && Math.abs(new Date(o.date) - new Date(o.nameDate)) > 7 * 864e5) {
          // PDF and file name disagree by more than a week (e.g. a stale date left on the OC):
          // trust whichever is closer to when the PDF was saved
          const saved = new Date(file.modified || Date.now());
          const pick = Math.abs(new Date(o.nameDate) - saved) < Math.abs(new Date(o.date) - saved) ? o.nameDate : o.date;
          o.warnings = [...(o.warnings || []), `Dates disagree — OC says ${o.date}, file name says ${o.nameDate}; using ${pick}`];
          o.date = pick;
        }
        if (o && !o.date && file.modified) {
          // No usable date on the OC or in the file name: fall back to when the PDF was saved
          o.date = file.modified.slice(0, 10);
          o.warnings = [...(o.warnings || []).filter(w => !/order date/i.test(w)), "No order date on the OC — using the date the PDF was saved. Fix it under Corrections if needed."];
        }
        if (!o) { res.skipped++; issue(file, "Doesn't look like an order confirmation or bill of lading"); }
        else if (!o.orderNo) { res.skipped++; issue(file, "No BRO/CAL number found in the PDF or file name"); }
        else if (o.date && o.date < since) {
          res.skipped++; await dropStale(file, null);
          tooOld = true; // not marked done: if the start date moves earlier, it gets read then
        }
        else if (o.format === "bol" && formats[o.orderNo] === "oc") { res.skipped++; } // keep the priced OC
        else {
          await dropStale(file, o.orderNo);
          const isNew = !formats[o.orderNo];
          formats[o.orderNo] = o.format;
          await setDoc(doc(db, "salesOrders", o.orderNo), {
            ...o,
            file: { id: file.id, rev: file.rev, name: file.name, path: file.path },
            syncedAt: new Date().toISOString(), syncedBy: loginName || "",
          }, { merge: true });
          isNew ? res.added++ : res.updated++;
          res.resolved[file.id] = true;
        }
        if (!tooOld) {
          res.seen[file.id] = file.rev;
          pending[file.id] = file.rev;
          if (onSeen && Object.keys(pending).length >= 25) { const b = pending; pending = {}; await onSeen(b).catch(() => {}); }
        }
      } catch (e) {
        res.errors.push({ file: file.path, error: String(e.message || e) });
        issue(file, "Couldn't be read: " + String(e.message || e).slice(0, 160));
      }
      done++;
      onProgress({ stage: "Reading order confirmations…", done, total: done + todo.length, file: file.name });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return res;
}
