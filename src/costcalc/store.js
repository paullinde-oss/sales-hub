// ─── Cost Calculator storage: config/costCalcs = { v: 2, box, updatedAt, updatedBy } ──
// The whole book (calculators, shared rates, change log) is encrypted with the cost key, like the cost list.
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState, useCallback } from "react";
import { getCostKey, sealLocked, openLocked } from "../pricelist/costs";
import { DEFAULT_RATES } from "./model";

const EMPTY = () => ({ rates: JSON.parse(JSON.stringify(DEFAULT_RATES)), calcs: [], log: [] });
export const MAX_LOG = 600;

// status: "loading" | "locked" | "ready" | "hidden"
export function useCostBook(db, allowed) {
  const [docData, setDocData] = useState(undefined);
  const [state, setState] = useState({ status: "loading", book: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!allowed) { setState({ status: "hidden", book: null }); return; }
    return onSnapshot(doc(db, "config", "costCalcs"), s => setDocData(s.exists() ? s.data() : null), () => setDocData(null));
  }, [db, allowed]);
  useEffect(() => { const f = () => setTick(t => t + 1); window.addEventListener("bmp-cost-key", f); return () => window.removeEventListener("bmp-cost-key", f); }, []);
  useEffect(() => {
    if (!allowed || docData === undefined) return;
    if (!getCostKey()) { setState({ status: "locked", book: null }); return; }
    if (!docData || docData.v !== 2) { setState({ status: "ready", book: EMPTY(), at: null }); return; }
    openLocked(docData.box).then(book => setState({ status: "ready", book: { ...EMPTY(), ...book }, at: docData.updatedAt, by: docData.updatedBy }))
      .catch(() => setState({ status: "locked", book: null }));
  }, [docData, allowed, tick]);
  const save = useCallback(async (book, by) => {
    const clean = { ...book, log: (book.log || []).slice(-MAX_LOG) };
    await setDoc(doc(db, "config", "costCalcs"), { v: 2, box: await sealLocked(clean), updatedAt: new Date().toISOString(), updatedBy: by || "" });
  }, [db]);
  return { ...state, save };
}
