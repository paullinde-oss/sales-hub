// ─── Collections kept in the browser, reading only what changed ─────────────
// Firebase's free plan allows 50,000 reads a day. Reading every quote (or lead, or
// order pack) each time someone opens the hub adds up, so each browser keeps its own
// copy in IndexedDB and, on open, asks Firebase only for documents changed since it
// last looked. Opening the hub then costs a few reads instead of thousands, and
// changes made by others still arrive live.
//
// For this to work every write must go through putDoc / dropDoc (or stamp()) so the
// document carries an "_updated" server time. Deletes leave a small "_deleted" marker
// so other browsers learn about them. Once a week each browser re-reads everything
// as a safety net.
import { collection, doc, query, where, onSnapshot, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";

const FULL_CHECK_DAYS = 7;
const CACHE_VERSION = 1;

// ── IndexedDB (one record per collection) ────────────────────────────────────
let dbPromise = null;
function idb() {
  if (!dbPromise) dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open("bmp-hub-cache", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("collections");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}
async function loadCache(name) {
  const d = await idb(); if (!d) return null;
  return new Promise((resolve) => {
    try {
      const req = d.transaction("collections").objectStore("collections").get(name);
      req.onsuccess = () => resolve(req.result?.v === CACHE_VERSION ? req.result : null);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function saveCache(name, entry) {
  const d = await idb(); if (!d) return;
  try { d.transaction("collections", "readwrite").objectStore("collections").put({ ...entry, v: CACHE_VERSION }, name); }
  catch (e) { console.warn("Couldn't save local copy of " + name, e); }
}

// ── Writing ──────────────────────────────────────────────────────────────────
const active = {}; // collection name → open listener, so this browser's own writes show at once

export const stamp = data => ({ ...data, _updated: serverTimestamp() });

// Show a change this browser is saving (by batch) straight away
export const applyLocal = (name, id, data) => active[name]?.apply(String(id), data);

export function putDoc(db, name, id, data) {
  active[name]?.apply(String(id), data);
  return setDoc(doc(db, name, String(id)), stamp(data));
}
export function dropDoc(db, name, id) {
  active[name]?.apply(String(id), null);
  return setDoc(doc(db, name, String(id)), stamp({ _deleted: true }));
}
// For batched writes: batch.set(ref, stamp(data)) / batch.set(ref, deletedMarker())
export const deletedMarker = () => stamp({ _deleted: true });

// ── Reading ──────────────────────────────────────────────────────────────────
const millis = v => (v && typeof v.toMillis === "function" ? v.toMillis() : 0);
function plain(data) { const { _updated, _deleted, ...rest } = data; return rest; }

/**
 * Live list of a collection. onDocs([{ id, data }], { fresh }) is called with the whole
 * list (from the local copy first, then again whenever something changes).
 * Returns an unsubscribe function.
 */
export function listenCollection(db, name, onDocs, onError) {
  let docs = {}, last = 0, fullAt = 0, unsub = null, stopped = false, saveTimer = null, gotServer = false;
  // fresh: false while showing only the local copy, true once Firebase has answered
  const emit = () => onDocs(Object.entries(docs).map(([id, data]) => ({ id, data })), { fresh: gotServer });
  const persist = () => {
    if (!gotServer) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveCache(name, { docs, last, fullAt }), 1000);
  };
  const me = {
    apply(id, data) {
      if (data) docs[id] = plain(JSON.parse(JSON.stringify(data))); else delete docs[id];
      queueMicrotask(emit); // may be called from inside a React state update
    },
  };
  active[name] = me;

  loadCache(name).then((c) => {
    if (stopped) return;
    // Firebase answers from a consistent moment, so anything saved at or before the newest
    // change already seen was included then; only later changes are asked for.
    const usable = c && c.last && Date.now() - c.fullAt < FULL_CHECK_DAYS * 864e5;
    if (usable) { docs = c.docs || {}; last = c.last; fullAt = c.fullAt; emit(); }
    const q = usable
      ? query(collection(db, name), where("_updated", ">", Timestamp.fromMillis(last)))
      : collection(db, name);
    unsub = onSnapshot(q, (snap) => {
      // Offline: wait for Firebase's real answer rather than trusting an empty one
      if (!gotServer && snap.metadata?.fromCache) return;
      const changes = gotServer ? snap.docChanges() : snap.docs.map(d => ({ type: "added", doc: d }));
      if (!gotServer && !usable) { docs = {}; fullAt = Date.now(); }
      changes.forEach((ch) => {
        const id = ch.doc.id;
        // While only asking for changes, a document "leaves" the answer for a moment while
        // this browser's own save is on its way (it's then shown via applyLocal); a real
        // removal only matters on a full read
        if (ch.type === "removed") { if (!usable) delete docs[id]; return; }
        const data = ch.doc.data();
        if (!ch.doc.metadata?.hasPendingWrites) last = Math.max(last, millis(data._updated));
        if (data._deleted) delete docs[id]; else docs[id] = plain(data);
      });
      // First full read before anything carries a time: count from a day back
      if (!last) last = Date.now() - 864e5;
      gotServer = true;
      emit(); persist();
    }, onError);
  });

  return () => {
    stopped = true;
    if (unsub) unsub();
    if (active[name] === me) delete active[name];
    if (gotServer) { clearTimeout(saveTimer); saveCache(name, { docs, last, fullAt }); }
  };
}
