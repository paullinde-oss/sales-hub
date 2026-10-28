// ─── Click-to-sort column headings + a text filter for report tables ────────
// Cells are often already formatted ("$12,345", "▼ 12%", "Oct 3, 2026"), so sorting reads
// numbers back out of them; anything else sorts as text. Total rows stay at the bottom.
import { useState } from "react";

const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
function sortVal(v) {
  if (v == null) return null;
  const s = String(typeof v === "object" ? v.text : v).trim();
  if (!s || s === "—" || s === "-") return null;
  const d = s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})$/) || s.match(/^([A-Za-z]{3})[a-z]* (\d{4})$/);
  if (d && MONTHS.includes(d[1].toLowerCase())) return d[3] ? +d[3] * 1e4 + (MONTHS.indexOf(d[1].toLowerCase()) + 1) * 100 + +d[2] : +d[2] * 1e4 + (MONTHS.indexOf(d[1].toLowerCase()) + 1) * 100;
  if (/^\d{4}-\d\d(-\d\d)?$/.test(s)) return +s.replace(/-/g, "").padEnd(8, "0");
  const n = s.replace(/[$,%\s]|CAD|USD|×/g, "").replace(/^▲/, "").replace(/^▼/, "-");
  if (/^-?\d+(\.\d+)?$/.test(n)) return parseFloat(n);
  return s.toLowerCase();
}

export function useTableSort() {
  const [sort, setSort] = useState(null); // { col, dir: 1 | -1 }
  const [q, setQ] = useState("");
  const toggle = col => setSort(s => (s && s.col === col ? (s.dir === -1 ? { col, dir: 1 } : null) : { col, dir: -1 }));
  const arrow = col => (sort && sort.col === col ? (sort.dir === -1 ? " ▼" : " ▲") : "");
  // cellsOf(row) → array of cells; isTotal(row) → keep at the bottom
  const apply = (rows, cellsOf, isTotal = () => false) => {
    const text = c => String(typeof c === "object" && c !== null ? c.text : c ?? "").toLowerCase();
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let body = rows.filter(r => !isTotal(r)), tail = rows.filter(isTotal);
    if (words.length) body = body.filter(r => { const t = cellsOf(r).map(text).join(" "); return words.every(w => t.includes(w)); });
    if (sort) body = [...body].sort((a, b) => {
      const x = sortVal(cellsOf(a)[sort.col]), y = sortVal(cellsOf(b)[sort.col]);
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1; // blanks last
      if (typeof x !== typeof y) return typeof x === "number" ? -1 : 1;
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
    return [...body, ...(words.length ? [] : tail)];
  };
  return { sort, q, setQ, toggle, arrow, apply, reset: () => { setSort(null); setQ(""); } };
}
