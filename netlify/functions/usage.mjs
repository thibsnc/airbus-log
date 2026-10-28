// Who uses the shared version. POST: an app on aci-log.netlify.app says "I'm here" (name, trigram, version).
// GET: the owner's app lists users; needs the x-admin header to match the ADMIN_CODE environment variable.
// Roster links are never sent here.
import { getStore } from "@netlify/blobs";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type,x-admin", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
// Device kind sent by the app; older versions don't send it, so it is guessed from the browser's User-Agent
// (an iPad in desktop mode looks like a Mac there).
const DEVS = new Set(["iPhone", "iPad", "Android", "Tablette Android", "Mac", "PC"]);
const devOf = (sent, ua) => {
  if (DEVS.has(sent)) return sent;
  ua = String(ua || "");
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android" : "Tablette Android";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Windows|Linux|CrOS/.test(ua)) return "PC";
  return "";
};
const env = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const store = getStore("users");

  if (req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const id = clean(b.id, 40);
    if (!/^[a-z0-9-]{8,40}$/i.test(id)) return json({ error: "bad id" }, 400);
    const first = clean(b.first, 40), last = clean(b.last, 40);
    if (!first || !last) return json({ error: "name required" }, 400);
    const now = new Date().toISOString();
    const prev = (await store.get(id, { type: "json" })) || {};
    await store.setJSON(id, {
      id, first, last, trig: clean(b.trig, 3).toUpperCase(), version: clean(b.version, 10), standalone: !!b.standalone,
      dev: devOf(clean(b.dev, 20), req.headers.get("user-agent")) || prev.dev || "",
      firstSeen: prev.firstSeen || now, lastSeen: now, opens: (prev.opens || 0) + 1,
    });
    return json({ ok: true });
  }

  if (req.method === "GET") {
    const want = env("ADMIN_CODE");
    if (!want) return json({ error: "not configured" }, 503);
    if (req.headers.get("x-admin") !== want) return json({ error: "forbidden" }, 401);
    const { blobs } = await store.list();
    const users = [];
    for (const { key } of blobs) { const r = await store.get(key, { type: "json" }); if (r) users.push(r); }
    users.sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
    return json({ users });
  }
  return json({ error: "method" }, 405);
};

export const config = { path: "/api/usage" };
