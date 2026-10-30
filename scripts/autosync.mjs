// ─── Automatic hourly sync (runs on GitHub Actions — .github/workflows/autosync.yml) ─
// Reads new/changed order confirmation PDFs from Dropbox into the hub, exactly like
// ↻ Refresh in Sales Summary, so orders stay current even when nobody has the hub open.
// Needs the DROPBOX_REFRESH_TOKEN secret (Sales Summary → Settings → Automatic sync).
// Bundled with esbuild first (npm run autosync) because the app code uses browser-style imports.
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, getDocs, setDoc, collection, terminate } from "firebase/firestore";
import { firebaseConfig } from "../src/firebaseConfig.js";
import { runFullSync, SYNC_DEFAULTS } from "../src/sales/syncRunner.js";

const token = process.env.DROPBOX_REFRESH_TOKEN;
if (!token) { console.log("No DROPBOX_REFRESH_TOKEN secret set — automatic sync is not set up yet. Skipping."); process.exit(0); }
// dropbox.js keeps its tokens in localStorage (browser); give it an in-memory one here
const mem = { bmp_dropbox_refresh: token };
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };

const db = getFirestore(initializeApp(firebaseConfig));
const data = async (id) => { const s = await getDoc(doc(db, "config", id)); return s.exists() ? s.data() : {}; };

try {
  const stored = await data("salesSettings");
  const settings = { ...SYNC_DEFAULTS, ...stored };
  const seenDoc = await data("salesSyncSeen");
  const issues = (await data("salesSyncIssues")).files || {};
  // Every stored order, from the 48 pack documents (~48 reads)
  const packs = await getDocs(collection(db, "orderPacks"));
  if (!packs.size) throw new Error("No order packs found — open Sales Summary once as admin first. Not syncing blind.");
  const rawOrders = [];
  packs.docs.forEach(d => Object.entries(d.data().orders || {}).forEach(([no, o]) => rawOrders.push({ ...o, orderNo: no })));
  console.log(`Loaded ${rawOrders.length} orders, ${Object.keys(seenDoc.files || {}).length} PDFs already read.`);

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.js");
  const lib = pdfjs.default?.getDocument ? pdfjs.default : pdfjs;
  let last = "";
  const r = await runFullSync({
    db, settings, seen: seenDoc.files || {}, oldFiles: seenDoc.old || {}, issues, rawOrders, loginName: "Auto-sync", pdfjs: lib,
    onProgress: p => { const line = `${p.stage}${p.total ? ` ${p.done}/${p.total}` : ""}`; if (line !== last && (!p.total || p.done % 10 === 0 || p.done === p.total)) { console.log(line); last = line; } },
  });
  console.log(`Done: ${r.scanned} PDFs in Dropbox — ${r.added} new, ${r.updated} updated, ${r.removed.length} removed, ${r.errors.length} couldn't be read.`);
  r.errors.forEach(e => console.log("  ✗", e.file, "—", e.error));
  await setDoc(doc(db, "config", "salesSettings"), { autoSync: { at: new Date().toISOString(), ok: true, added: r.added, updated: r.updated } }, { merge: true });
  await terminate(db);
  process.exit(0);
} catch (e) {
  console.error("Automatic sync failed:", e.message || e);
  await setDoc(doc(db, "config", "salesSettings"), { autoSync: { at: new Date().toISOString(), ok: false, error: String(e.message || e).slice(0, 300) } }, { merge: true }).catch(() => {});
  process.exit(1);
}
