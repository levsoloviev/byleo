// byleo.org signup — Cloudflare Worker (the site itself is on GitHub Pages, which can't keep secrets).
// The opt-in page POSTs { email } here; via the systeme.io public API the worker
//   1. finds the contact by email, or creates it;
//   2. adds the tag (default "yoga-nidra-optin"), creating the tag the first time.
// A systeme.io automation rule ("tag added" → enrol in the free course / send the email) does the rest.
//
// Worker settings (Cloudflare → Workers → this worker → Settings → Variables and Secrets):
//   SYSTEME_API_KEY   Secret, required — the systeme.io public API key. Never put it in the page or the repo.
//   ALLOWED_ORIGINS   optional — comma-separated sites allowed to call this worker
//                     (default "https://byleo.org,https://www.byleo.org,https://levsoloviev.github.io")
//   SYSTEME_TAG_NAME  optional — tag to add (default "yoga-nidra-optin")
//   SYSTEME_TAG_ID    optional — the tag's numeric id, to skip looking it up by name
//   SYSTEME_API_BASE  optional — only for local tests (default "https://api.systeme.io")

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DEFAULT_ORIGINS = "https://byleo.org,https://www.byleo.org,https://levsoloviev.github.io";

const corsHeaders = (request, env) => {
  const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map((s) => s.trim());
  const origin = request.headers.get("Origin") || "";
  const h = { "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" };
  if (allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
};

const json = (body, status, cors) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors } });

const api = (env) => {
  const base = (env.SYSTEME_API_BASE || "https://api.systeme.io").replace(/\/$/, "");
  return async (path, init = {}) => {
    const res = await fetch(`${base}/api${path}`, {
      ...init,
      headers: { "X-API-Key": env.SYSTEME_API_KEY, Accept: "application/json", "Content-Type": "application/json", ...(init.headers || {}) },
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data };
  };
};

const findContact = async (call, email) => {
  const r = await call(`/contacts?email=${encodeURIComponent(email)}&limit=10`);
  if (r.status !== 200) throw new Error(`find contact: ${r.status}`);
  return (r.data?.items || []).find((c) => String(c.email).toLowerCase() === email) || null;
};

const tagIdFor = async (call, env) => {
  if (env.SYSTEME_TAG_ID) return Number(env.SYSTEME_TAG_ID);
  const name = env.SYSTEME_TAG_NAME || "yoga-nidra-optin";
  const r = await call(`/tags?query=${encodeURIComponent(name)}&limit=100`);
  if (r.status !== 200) throw new Error(`list tags: ${r.status}`);
  const found = (r.data?.items || []).find((t) => t.name === name);
  if (found) return found.id;
  const created = await call(`/tags`, { method: "POST", body: JSON.stringify({ name }) });
  if (created.status !== 201 && created.status !== 200) throw new Error(`create tag: ${created.status}`);
  return created.data.id;
};

const subscribe = async (request, env, cors) => {
  if (!env.SYSTEME_API_KEY) return json({ ok: false, error: "not configured" }, 500, cors);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad request" }, 400, cors);
  }
  // honeypot filled in → a bot; answer as if all went well and do nothing
  if (body?.website) return json({ ok: true }, 200, cors);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ ok: false, error: "invalid email" }, 400, cors);

  const call = api(env);
  try {
    let contact = await findContact(call, email);
    if (!contact) {
      const created = await call(`/contacts`, { method: "POST", body: JSON.stringify({ email, locale: "en" }) });
      if (created.status === 201 || created.status === 200) contact = created.data;
      else contact = await findContact(call, email); // e.g. created a moment ago by a double click
      if (!contact) throw new Error(`create contact: ${created.status}`);
    }
    const tagId = await tagIdFor(call, env);
    if (!(contact.tags || []).some((t) => t.id === tagId)) {
      const tagged = await call(`/contacts/${contact.id}/tags`, { method: "POST", body: JSON.stringify({ tagId }) });
      if (![200, 201, 204].includes(tagged.status)) throw new Error(`add tag: ${tagged.status}`);
    }
    return json({ ok: true }, 200, cors);
  } catch (e) {
    console.error("subscribe failed", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "upstream" }, 502, cors);
  }
};

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "POST") return subscribe(request, env, cors);
    return new Response("byleo.org signup", { status: 200, headers: { "Content-Type": "text/plain" } });
  },
};
