// ─── Customer logos ──────────────────────────────────────────────────────────
// Kept in Firestore "customerLogos" as small data-URL images (resized to ≤320px)
// so they show everywhere without extra storage setup. Sources:
//   • Manual upload on the customer's page
// (Logos from logo.dev aren't stored here — see logoDevUrl below.)
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";

export const logoDocId = key => encodeURIComponent(key).slice(0, 700);

export function useLogos(db) {
  const [logos, setLogos] = useState({});
  useEffect(() => onSnapshot(collection(db, "customerLogos"),
    s => setLogos(Object.fromEntries(s.docs.map(d => d.data()).filter(d => d.source !== "dropbox").map(d => [d.key, d]))), // old Dropbox logos are no longer used
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

// ─── logo.dev ────────────────────────────────────────────────────────────────
// Logos are loaded straight from logo.dev's CDN using the account's website and
// the publishable key (pk_…) saved in Sales Summary → Settings. Uploaded logos win.
export const domainOf = url => String(url || "").trim().toLowerCase()
  .replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0];
export const logoDevUrl = (website, key, size = 200) => {
  const d = domainOf(website);
  return d && key ? `https://img.logo.dev/${encodeURIComponent(d)}?token=${encodeURIComponent(key)}&size=${size}&format=png&retina=true` : "";
};
