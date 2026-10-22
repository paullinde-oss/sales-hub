// ─── Dropbox (browser-only OAuth with PKCE — no app secret needed) ──────────
// Each person who syncs connects their own Dropbox once; the refresh token is
// kept only in that browser's localStorage, never in Firestore or the repo.

export const DROPBOX_APP_KEY = "r3savrbntlaxnne";
const LS_REFRESH = "bmp_dropbox_refresh";
const LS_ACCESS = "bmp_dropbox_access";
const SS_VERIFIER = "bmp_dropbox_verifier";
export const SS_OPEN_TAB = "bmp_open_tab";

export const redirectUri = () => window.location.origin + window.location.pathname;

const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function isDropboxConnected() {
  try { return !!localStorage.getItem(LS_REFRESH); } catch { return false; }
}
export function disconnectDropbox() {
  try { localStorage.removeItem(LS_REFRESH); localStorage.removeItem(LS_ACCESS); } catch {}
}

export async function startDropboxAuth() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  sessionStorage.setItem(SS_VERIFIER, verifier);
  sessionStorage.setItem(SS_OPEN_TAB, "sales");
  const p = new URLSearchParams({
    client_id: DROPBOX_APP_KEY, response_type: "code", code_challenge: challenge,
    code_challenge_method: "S256", token_access_type: "offline", redirect_uri: redirectUri(),
  });
  window.location.href = "https://www.dropbox.com/oauth2/authorize?" + p.toString();
}

// Called once at startup: if Dropbox just sent us back with ?code=…, trade it for tokens.
export async function completeDropboxAuth() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const verifier = sessionStorage.getItem(SS_VERIFIER);
  if (!code || !verifier) return;
  window.history.replaceState({}, "", redirectUri());
  sessionStorage.removeItem(SS_VERIFIER);
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ code, grant_type: "authorization_code", code_verifier: verifier, client_id: DROPBOX_APP_KEY, redirect_uri: redirectUri() }),
  });
  if (!res.ok) { console.error("Dropbox sign-in failed", await res.text()); return; }
  const j = await res.json();
  localStorage.setItem(LS_REFRESH, j.refresh_token);
  localStorage.setItem(LS_ACCESS, JSON.stringify({ token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 }));
}

async function accessToken() {
  try {
    const a = JSON.parse(localStorage.getItem(LS_ACCESS) || "null");
    if (a && a.exp > Date.now()) return a.token;
  } catch {}
  const refresh = localStorage.getItem(LS_REFRESH);
  if (!refresh) throw new Error("Dropbox isn't connected in this browser.");
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: DROPBOX_APP_KEY }),
  });
  if (!res.ok) {
    if (res.status === 400 || res.status === 401) disconnectDropbox();
    throw new Error("Dropbox sign-in expired — please connect Dropbox again.");
  }
  const j = await res.json();
  localStorage.setItem(LS_ACCESS, JSON.stringify({ token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 }));
  return j.access_token;
}

// Team accounts keep shared folders under the team root namespace, not the member's home.
let pathRootHeader = undefined;
async function pathRoot(token) {
  if (pathRootHeader !== undefined) return pathRootHeader;
  pathRootHeader = null;
  try {
    const r = await fetch("https://api.dropboxapi.com/2/users/get_current_account", { method: "POST", headers: { Authorization: "Bearer " + token } });
    const j = await r.json();
    const ri = j.root_info;
    if (ri && ri.root_namespace_id && ri.root_namespace_id !== ri.home_namespace_id)
      pathRootHeader = JSON.stringify({ ".tag": "root", root: ri.root_namespace_id });
  } catch {}
  return pathRootHeader;
}

async function rpc(endpoint, body, useRoot = true) {
  const token = await accessToken();
  const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const root = useRoot ? await pathRoot(token) : null;
  if (root) headers["Dropbox-API-Path-Root"] = root;
  const r = await fetch("https://api.dropboxapi.com/2/" + endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text(); const e = new Error(t); e.status = r.status; throw e; }
  return r.json();
}

// Recursively list every PDF under a folder. Tries the team root first, then the personal home.
export async function listPdfs(folderPath) {
  const path = folderPath.replace(/\\/g, "/").replace(/\/+$/, "");
  let first, useRoot = true;
  try { first = await rpc("files/list_folder", { path, recursive: true, limit: 2000 }, true); }
  catch (e) {
    if (e.status !== 409) throw e;
    useRoot = false;
    first = await rpc("files/list_folder", { path, recursive: true, limit: 2000 }, false);
  }
  const out = [...first.entries];
  let cur = first;
  while (cur.has_more) { cur = await rpc("files/list_folder/continue", { cursor: cur.cursor }, useRoot); out.push(...cur.entries); }
  return out
    .filter(e => e[".tag"] === "file" && /\.pdf$/i.test(e.name))
    .map(e => ({ id: e.id, rev: e.rev, name: e.name, path: e.path_display, modified: e.server_modified, useRoot }));
}

export async function downloadFile(file) {
  const token = await accessToken();
  const headers = { Authorization: "Bearer " + token, "Dropbox-API-Arg": JSON.stringify({ path: file.id }) };
  const root = file.useRoot ? await pathRoot(token) : null;
  if (root) headers["Dropbox-API-Path-Root"] = root;
  const r = await fetch("https://content.dropboxapi.com/2/files/download", { method: "POST", headers });
  if (!r.ok) throw new Error(`Couldn't download ${file.name} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}
