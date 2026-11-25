// ─── Costs & Margins storage: config/marginBook = { v: 2, box, updatedAt, updatedBy } ──
// The whole book (yearly rates, shared prices, product lines + SKUs, change log) is encrypted with the
// cost key, like the cost list (config/productCosts) — the code and database are public, so costs are
// never stored readable. Signing in unlocks the key (no separate password).
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState, useCallback } from "react";
import { getCostKey, sealLocked, openLocked } from "../pricelist/costs";
import { emptyBook } from "./model";

export const MAX_LOG = 800;
const DOC = ["config", "marginBook"];

// status: "loading" | "locked" | "ready" | "hidden"
export function useMarginBook(db, allowed) {
  const [docData, setDocData] = useState(undefined);
  const [state, setState] = useState({ status: "loading", book: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!allowed) { setState({ status: "hidden", book: null }); return; }
    return onSnapshot(doc(db, ...DOC), s => setDocData(s.exists() ? s.data() : null), () => setDocData(null));
  }, [db, allowed]);
  useEffect(() => { const f = () => setTick(t => t + 1); window.addEventListener("bmp-cost-key", f); return () => window.removeEventListener("bmp-cost-key", f); }, []);
  useEffect(() => {
    if (!allowed || docData === undefined) return;
    if (!getCostKey()) { setState({ status: "locked", book: null }); return; }
    const base = emptyBook();
    if (!docData || docData.v !== 2) { setState({ status: "ready", book: base, at: null }); return; }
    openLocked(docData.box).then(book => setState({ status: "ready", book: { ...base, ...book, settings: { ...base.settings, ...(book.settings || {}) } }, at: docData.updatedAt, by: docData.updatedBy }))
      .catch(() => setState({ status: "locked", book: null }));
  }, [docData, allowed, tick]);
  const save = useCallback(async (book, by) => {
    const clean = { ...book, log: (book.log || []).slice(-MAX_LOG) };
    await setDoc(doc(db, ...DOC), { v: 2, box: await sealLocked(clean), updatedAt: new Date().toISOString(), updatedBy: by || "" });
  }, [db]);
  return { ...state, save };
}
