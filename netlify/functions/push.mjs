// Flight reminders (Web Push). The app sends its push subscription and the reminders it wants
// (time, title, text: flight number, route, check-in and departure times, aircraft). Nothing else is stored:
// no roster link, no crew names. push-send.mjs delivers them when they are due.
//   GET  /api/push?key                → { publicKey }  (VAPID key the browser subscribes with)
//   POST /api/push { id, enabled:false }                       → reminders off, record deleted
//   POST /api/push { id, subscription, items:[{at,title,body,tag}], test? } → saved (test: one sent now)
import { getStore } from "@netlify/blobs";
import { vapidKeys, vapidPublic, sendPush } from "../lib/webpush.mjs";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } });
  const store = getStore("push");
  const jwk = await vapidKeys(store);
  if (req.method === "GET") return json({ publicKey: vapidPublic(jwk) });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let b; try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const id = clean(b.id, 40);
  if (!/^[a-z0-9-]{8,40}$/i.test(id)) return json({ error: "bad id" }, 400);
  const key = "dev-" + id;
  if (b.enabled === false) { await store.delete(key); return json({ ok: true, enabled: false }); }

  const sub = b.subscription;
  if (!sub || typeof sub.endpoint !== "string" || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth)
    return json({ error: "bad subscription" }, 400);
  const now = Date.now();
  const items = (Array.isArray(b.items) ? b.items : [])
    .map((x) => ({ at: Number(x.at), title: clean(x.title, 80), body: clean(x.body, 200), tag: clean(x.tag, 80) }))
    .filter((x) => x.at > now - 36e5 && x.at < now + 31 * 864e5 && x.title && x.tag)
    .slice(0, 60);
  const prev = (await store.get(key, { type: "json" })) || {};
  const sent = (prev.sent || []).filter((t) => items.some((x) => x.tag === t)); // keep only tags still relevant
  await store.setJSON(key, { id, sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, items, sent, updatedAt: new Date().toISOString() });

  if (b.test) {
    // The app sends a complete sample reminder (fictitious flight) so the user sees the real notification.
    const t = b.test && typeof b.test === "object" ? b.test : {};
    const payload = { title: clean(t.title, 80) || "ACI LOG · test", body: clean(t.body, 200) || "Les alertes de vol sont actives sur cet appareil ✈︎", tag: "test-" + Date.now() };
    const status = await sendPush(sub, payload, jwk).catch(() => 0);
    return json({ ok: status >= 200 && status < 300, status, count: items.length });
  }
  return json({ ok: true, count: items.length });
};

export const config = { path: "/api/push" };
