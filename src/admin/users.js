// ─── Users & permissions ────────────────────────────────────────────────────
// Stored in Firestore at config/users as { list: [user, …] }. Until Paul saves
// the list for the first time, DEFAULT_USERS applies.
//   tabs        — which left-hand tabs the person can open
//   salesScope  — "all" (every customer) or "own" (only accounts where they're the rep)
//   admin       — can open the Admin tab (users, password) and Sales Summary settings
// These rules decide what the app shows; they are not database-level security.
import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

export const ALL_TABS = [
  { id: "quotes",   label: "Quote Maker" },
  { id: "sales",    label: "Sales Summary" },
  { id: "pipeline", label: "Pipeline" },
  { id: "shipping", label: "Shipping" },
  { id: "products", label: "Products" },
  { id: "stock",    label: "Stock Levels" },
  { id: "loadcalc", label: "Load Calculator" },
  { id: "leads",    label: "Lead Tracking" },
  { id: "dims",     label: "DIMS" },
];
const ALL_IDS = ALL_TABS.map(t => t.id);

export const DEFAULT_USERS = [
  { name: "Paul",  tabs: ALL_IDS, salesScope: "all", admin: true },
  { name: "Mark",  tabs: ALL_IDS, salesScope: "all", admin: false },
  { name: "Grant", tabs: ALL_IDS, salesScope: "all", admin: false },
  { name: "Jeff",  tabs: ALL_IDS, salesScope: "all", admin: false },
  { name: "John",  tabs: ALL_IDS.filter(t => t !== "leads"), salesScope: "own", admin: false },
];

export function useUsers(db) {
  const [users, setUsers] = useState(null);
  useEffect(() => onSnapshot(doc(db, "config", "users"),
    s => setUsers(s.exists() && Array.isArray(s.data().list) && s.data().list.length ? s.data().list : DEFAULT_USERS),
    () => setUsers(DEFAULT_USERS)), [db]);
  return users;
}

export const saveUsers = (db, list) => setDoc(doc(db, "config", "users"), { list });

export const findUser = (users, name) =>
  (users || []).find(u => u.name.toLowerCase() === String(name || "").trim().toLowerCase()) || null;

export const canSee = (user, tab) => !!user && (tab === "admin" ? !!user.admin : (user.tabs || []).includes(tab));
