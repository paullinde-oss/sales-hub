// ─── Users & permissions ────────────────────────────────────────────────────
// Stored in Firestore at config/users as { list: [user, …] }. Until Paul saves
// the list for the first time, DEFAULT_USERS applies.
//   tabs        — which left-hand tabs the person can open
//   salesScope  — "all" (every customer) or "own" (only accounts where they're the rep)
//   admin       — can open the Admin tab (users, password) and Sales Summary settings
//   priceDrafts — can see and edit price list drafts (Products & Price List → Price Lists)
//   costs       — can see product costs and margins
// These rules decide what the app shows; they are not database-level security.
import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

// The six areas on the left (Users & Access is admin-only). "leads" is a separate tick that
// shows the Leads section inside Pipeline & Leads.
export const ALL_TABS = [
  { id: "quotes",   label: "Quotes" },
  { id: "sales",    label: "Sales Summary" },
  { id: "pipeline", label: "Pipeline & Leads" },
  { id: "leads",    label: "↳ Leads section", sub: true },
  { id: "products", label: "Products & Price List" },
  // Stock Levels was folded into Products & Price List (Stock column), Nov 2026
  { id: "shipping", label: "Shipping" },
];
const ALL_IDS = ALL_TABS.map(t => t.id);

// Saved user lists from before the tabs were grouped used separate ids for Load Calculator,
// DIMS and Lead Tracking — read them as the new areas
export function userTabs(user) {
  const t = new Set(user?.tabs || []);
  if (t.has("loadcalc") || t.has("dims")) t.add("shipping");
  if (t.has("leads")) t.add("pipeline");
  return [...t].filter(x => ALL_IDS.includes(x));
}

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

const LEGACY = { loadcalc: "shipping", dims: "shipping" };
export const canSee = (user, tab) => !!user && (tab === "admin" ? !!user.admin : userTabs(user).includes(LEGACY[tab] || tab));

// Price list drafts and costs: an explicit tick wins; until one is saved, Paul's defaults apply
const PRICE_EDITORS = ["paul", "mark", "jeff"], COST_VIEWERS = ["paul", "mark", "jeff", "grant"];
const firstName = u => String(u?.name || "").trim().toLowerCase();
export const canEditPriceLists = u => !!u && (u.priceDrafts ?? PRICE_EDITORS.includes(firstName(u)));
export const canSeeCosts = u => !!u && (u.costs ?? COST_VIEWERS.includes(firstName(u)));
