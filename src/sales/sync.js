// ─── Dropbox → Firestore sync of order confirmations ────────────────────────
import { doc, setDoc } from "firebase/firestore";
import { listPdfs, downloadFile } from "./dropbox";
import { parseOrderPdf, parseLongDate } from "./ocParser";

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
  const todo = files
    .filter(f => seen[f.id] !== f.rev && !obviouslyTooOld(f, since))
    // oldest first so a revised OC overwrites the earlier version
    .sort((a, b) => (a.modified < b.modified ? -1 : 1));

  const res = { added: 0, updated: 0, skipped: 0, errors: [...folderErrors], seen: {}, scanned: files.length };
  if (!todo.length) { onProgress({ stage: "Up to date", done: 0, total: 0 }); return res; }

  const pdfjs = await loadPdfjs();
  const formats = Object.fromEntries(Object.entries(existing).map(([k, o]) => [k, o.format]));
  let done = 0, pending = {};
  const worker = async () => {
    while (todo.length) {
      const file = todo.shift();
      try {
        const data = await downloadFile(file);
        const o = await parseOrderPdf(pdfjs, data, file.name.replace(/_/g, " "));
        if (!o || !o.orderNo) { res.skipped++; }
        else if (o.date && o.date < since) { res.skipped++; }
        else if (o.format === "bol" && formats[o.orderNo] === "oc") { res.skipped++; } // keep the priced OC
        else {
          const isNew = !formats[o.orderNo];
          formats[o.orderNo] = o.format;
          await setDoc(doc(db, "salesOrders", o.orderNo), {
            ...o,
            file: { id: file.id, rev: file.rev, name: file.name, path: file.path },
            syncedAt: new Date().toISOString(), syncedBy: loginName || "",
          }, { merge: true });
          isNew ? res.added++ : res.updated++;
        }
        res.seen[file.id] = file.rev;
        pending[file.id] = file.rev;
        if (onSeen && Object.keys(pending).length >= 25) { const b = pending; pending = {}; await onSeen(b).catch(() => {}); }
      } catch (e) {
        res.errors.push({ file: file.path, error: String(e.message || e) });
      }
      done++;
      onProgress({ stage: "Reading order confirmations…", done, total: done + todo.length, file: file.name });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return res;
}
