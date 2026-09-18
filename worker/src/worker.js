/**
 * Zurc Catalog — publishing service.
 *
 * The catalogue itself is a static site on GitHub Pages. This Worker is the
 * only thing that can write to it: the studio sends a password, gets a
 * short-lived session back, and publishes through here. The GitHub token
 * stays a server-side secret and never reaches the browser.
 *
 * Required secrets:   STUDIO_PASSWORD, GITHUB_TOKEN, SESSION_SECRET
 * Required vars:      REPO ("owner/name"), ALLOWED_ORIGIN
 */

const SESSION_DAYS = 30;
const ALLOWED_METHODS = ["GET", "PUT", "DELETE"];

/* ---------- small helpers ---------- */

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
/** Compare without leaking where the difference is. */
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- sessions ---------- */

async function issueSession(secret) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const payload = b64url(enc.encode(JSON.stringify({ exp })));
  const sig = b64url(await hmac(secret, payload));
  return { session: payload + "." + sig, exp };
}

async function validSession(secret, token) {
  if (typeof token !== "string" || token.indexOf(".") < 0) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  let expected;
  try {
    expected = await hmac(secret, payload);
  } catch { return false; }
  let given;
  try { given = unb64url(sig); } catch { return false; }
  if (!sameBytes(expected, given)) return false;
  try {
    const { exp } = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    return typeof exp === "number" && exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

/* ---------- responses ---------- */

function cors(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || "";
  const list = allowed.split(",").map((s) => s.trim()).filter(Boolean);
  const ok = list.includes(origin) ? origin : list[0] || "";
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Methods": "GET,PUT,DELETE,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

/* ---------- the one repo this service may touch ---------- */

function allowedPath(env, path) {
  const repo = String(env.REPO || "").trim();
  if (!repo) return false;
  const [owner, name] = repo.split("/");
  if (!owner || !name) return false;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("^repos/" + esc(owner) + "/" + esc(name) + "(?:/contents(?:/.*)?)?$");
  return re.test(path);
}

/* ---------- worker ---------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    for (const key of ["STUDIO_PASSWORD", "GITHUB_TOKEN", "SESSION_SECRET", "REPO"]) {
      if (!env[key]) return json({ error: "Service is not configured (" + key + ")." }, 500, headers);
    }

    /* password -> session */
    if (url.pathname === "/login") {
      if (request.method !== "POST") return json({ error: "Use POST." }, 405, headers);
      let body;
      try { body = await request.json(); } catch { body = {}; }
      const given = enc.encode(String(body.password ?? ""));
      const want = enc.encode(String(env.STUDIO_PASSWORD));
      if (!sameBytes(given, want)) {
        await sleep(400); /* slow down guessing a little */
        return json({ error: "That password did not work." }, 401, headers);
      }
      const { session, exp } = await issueSession(env.SESSION_SECRET);
      return json({ session, exp }, 200, headers);
    }

    /* everything else is a proxied GitHub call */
    if (!url.pathname.startsWith("/gh/")) return json({ error: "Not found." }, 404, headers);

    const auth = request.headers.get("Authorization") || "";
    const session = auth.replace(/^Bearer\s+/i, "");
    if (!(await validSession(env.SESSION_SECRET, session))) {
      return json({ error: "Please sign in again." }, 401, headers);
    }
    if (!ALLOWED_METHODS.includes(request.method)) {
      return json({ error: "That method is not allowed." }, 405, headers);
    }

    const ghPath = url.pathname.slice("/gh/".length);
    if (!allowedPath(env, ghPath)) {
      return json({ error: "That path is not allowed." }, 403, headers);
    }

    const upstream = "https://api.github.com/" + ghPath + url.search;
    const init = {
      method: request.method,
      headers: {
        Authorization: "Bearer " + env.GITHUB_TOKEN,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "zurc-catalog-studio",
        "Content-Type": "application/json"
      }
    };
    if (request.method !== "GET") init.body = await request.text();

    const res = await fetch(upstream, init);
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json", ...headers }
    });
  }
};
