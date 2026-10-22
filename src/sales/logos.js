// ─── Customer logos ──────────────────────────────────────────────────────────
// Kept in Firestore "customerLogos" as small data-URL images (resized to ≤320px)
// so they show everywhere without extra storage setup. Sources:
//   • Dropbox "Customer Logos" folder — file name matched to the customer name
//   • Manual upload on the customer's page (never overwritten by the Dropbox sync)
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { listFiles, downloadFile } from "./dropbox";
import { matchAccount, normName } from "./accounts";

export const logoDocId = key => encodeURIComponent(key).slice(0, 700);

export function useLogos(db) {
  const [logos, setLogos] = useState({});
  useEffect(() => onSnapshot(collection(db, "customerLogos"),
    s => setLogos(Object.fromEntries(s.docs.map(d => [d.data().key, d.data()]))),
    e => console.warn("logo read error", e)), [db]);
  return logos;
}

// Shrink an image Blob/File to a data URL no wider/taller than `max`
export function resizeImage(blob, max = 320) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      // WebP keeps transparent backgrounds and stays small; browsers that can't
      // write WebP hand back a PNG instead, which is fine too
      resolve(c.toDataURL("image/webp", 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Not a readable image")); };
    img.src = url;
  });
}

export async function saveLogo(db, key, dataUrl, source, extra = {}) {
  await setDoc(doc(db, "customerLogos", logoDocId(key)), { key, dataUrl, source, updatedAt: new Date().toISOString(), ...extra });
}
export const removeLogo = (db, key) => deleteDoc(doc(db, "customerLogos", logoDocId(key)));

// Pull logos from the Dropbox folder for customers that don't have a manual one
export async function syncLogos({ db, folder, accounts, aliases, customerKeys, logos, onProgress = () => {} }) {
  if (!folder) return { added: 0, skipped: 0, unmatched: [] };
  const files = await listFiles(folder, /\.(png|jpe?g|webp|gif)$/i);
  const known = new Map(customerKeys.map(k => [normName(k).trim(), k]));
  const res = { added: 0, skipped: 0, unmatched: [] };
  let i = 0;
  for (const f of files) {
    onProgress({ stage: "Customer logos…", done: ++i, total: files.length });
    const base = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\blogo\b/ig, "").trim();
    const acct = matchAccount(base, accounts, aliases);
    const key = acct ? acct.name : known.get(normName(base).trim());
    if (!key) { res.unmatched.push(f.name); continue; }
    const cur = logos[key];
    if (cur && (cur.source === "manual" || cur.file?.rev === f.rev)) { res.skipped++; continue; }
    try {
      const bytes = await downloadFile(f);
      const type = /png$/i.test(f.name) ? "image/png" : /webp$/i.test(f.name) ? "image/webp" : /gif$/i.test(f.name) ? "image/gif" : "image/jpeg";
      const dataUrl = await resizeImage(new Blob([bytes], { type }));
      await saveLogo(db, key, dataUrl, "dropbox", { file: { id: f.id, rev: f.rev, name: f.name } });
      res.added++;
    } catch (e) { res.unmatched.push(`${f.name} (${e.message})`); }
  }
  return res;
}
