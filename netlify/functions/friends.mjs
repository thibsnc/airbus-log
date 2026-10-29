// Friend requests between app users (Amis tab).
// A asks B; B gets a notification (Web Push when B turned alerts on, and a pop-up in the app) and accepts or not.
// On acceptance B's phone sends A its roster link ENCRYPTED for A's phone (ECDH P-256 + AES-GCM, keys made on
// each phone): this server only relays ciphertext and never sees a roster link. "Both ways" makes A's phone send
// its own link to B the same way, automatically.
// Every call is signed by the device: id + secret, checked against the hash kept in the "users" store (usage.mjs).
//   POST /api/friends { id, sec, act:"dir" }                         → { users:[{id,first,last,trig}] }
//   POST /api/friends { id, sec, act:"req", to }                     → request sent
//   POST /api/friends { id, sec, act:"inbox" }                       → { incoming, outgoing, links, owed }
//   POST /api/friends { id, sec, act:"answer", from, accept, mutual, iv, ct }
//   POST /api/friends { id, sec, act:"deliver", to, iv, ct }         → my link for someone I owe it to
//   POST /api/friends { id, sec, act:"remove", other }              → friendship removed both ways
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import { vapidKeys, sendPush } from "../lib/webpush.mjs";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const ID = /^[a-z0-9-]{8,40}$/i;
const B64 = /^[A-Za-z0-9+/=_-]{8,4000}$/;
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const pub = (u) => ({ id: u.id, first: u.first, last: u.last, trig: u.trig || "" });
const qk = (to, from) => `q-${to}-${from}`; // request addressed to <to>, made by <from>
const dk = (to, from) => `d-${to}-${from}`; // <from>'s encrypted link, readable by <to>

async function notify(id, payload) {
  try {
    const ps = getStore("push");
    const rec = await ps.get("dev-" + id, { type: "json" });
    if (!rec || !rec.sub) return;
    const jwk = await vapidKeys(ps);
    await sendPush(rec.sub, payload, jwk);
  } catch { /* a notification that cannot be sent is not an error: the app shows the request on its next opening */ }
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const id = String(b.id || ""), sec = String(b.sec || "");
  if (!ID.test(id) || sec.length < 16) return json({ error: "auth" }, 401);
  const users = getStore("users"), fs = getStore("friends");
  const me = await users.get(id, { type: "json" });
  if (!me || !me.sh || me.sh !== sha(sec) || !me.pub) return json({ error: "auth" }, 401);
  const user = async (x) => (ID.test(String(x || "")) ? await users.get(String(x), { type: "json" }) : null);
  const now = new Date().toISOString();
  const name = `${me.first} ${String(me.last || "").toUpperCase()}`.trim();

  if (b.act === "dir") {
    const { blobs } = await users.list();
    const out = [];
    for (const { key } of blobs) {
      if (key === id) continue;
      const u = await users.get(key, { type: "json" });
      if (u && u.pub && u.first) out.push(pub(u));
    }
    out.sort((a, c) => String(a.last).localeCompare(String(c.last)) || String(a.first).localeCompare(String(c.first)));
    return json({ users: out });
  }

  if (b.act === "req") {
    const to = await user(b.to);
    if (!to || !to.pub || to.id === id) return json({ error: "unknown user" }, 404);
    const prev = await fs.get(qk(to.id, id), { type: "json" });
    if (prev && prev.status === "accepted") return json({ ok: true, status: "accepted" });
    await fs.setJSON(qk(to.id, id), { to: to.id, from: id, status: "pending", at: now });
    await notify(to.id, { title: "ACI LOG · demande d'ami", body: `${name} veut ajouter ton planning dans ses amis.`, tag: "fr-" + id });
    return json({ ok: true, status: "pending" });
  }

  if (b.act === "inbox") {
    const toMe = (await fs.list({ prefix: `q-${id}-` })).blobs;
    const incoming = [], owed = [], links = [], outgoing = [];
    for (const { key } of toMe) {
      const q = await fs.get(key, { type: "json" }); if (!q) continue;
      const u = await user(q.from); if (!u) continue;
      if (q.status === "pending") incoming.push({ ...pub(u), pub: u.pub, at: q.at });
      if (q.status === "auto") owed.push({ ...pub(u), pub: u.pub }); // I asked them; they want mine too
    }
    const { blobs: all } = await fs.list({ prefix: "q-" });
    for (const { key } of all) {
      if (!key.endsWith("-" + id) || key.startsWith(`q-${id}-`)) continue;
      const q = await fs.get(key, { type: "json" }); if (!q || q.from !== id) continue;
      outgoing.push({ to: q.to, status: q.status });
    }
    for (const { key } of (await fs.list({ prefix: `d-${id}-` })).blobs) {
      const d = await fs.get(key, { type: "json" }); if (!d) continue;
      const u = await user(d.from); if (!u) continue;
      links.push({ ...pub(u), pub: u.pub, iv: d.iv, ct: d.ct, at: d.at });
    }
    return json({ incoming, outgoing, links, owed });
  }

  if (b.act === "answer") {
    const from = await user(b.from);
    if (!from) return json({ error: "unknown user" }, 404);
    const q = await fs.get(qk(id, from.id), { type: "json" });
    if (!q || q.status !== "pending") return json({ error: "no request" }, 404);
    if (!b.accept) { await fs.delete(qk(id, from.id)); return json({ ok: true, status: "declined" }); }
    if (!B64.test(String(b.iv || "")) || !B64.test(String(b.ct || ""))) return json({ error: "bad payload" }, 400);
    await fs.setJSON(dk(from.id, id), { to: from.id, from: id, iv: String(b.iv), ct: String(b.ct), at: now });
    await fs.setJSON(qk(id, from.id), { ...q, status: "accepted", answeredAt: now });
    if (b.mutual) await fs.setJSON(qk(from.id, id), { to: from.id, from: id, status: "auto", at: now });
    await notify(from.id, { title: "ACI LOG · ami accepté", body: `${name} a accepté : son planning est dans ton onglet Amis.`, tag: "fra-" + id });
    return json({ ok: true, status: "accepted" });
  }

  if (b.act === "deliver") {
    const to = await user(b.to);
    if (!to) return json({ error: "unknown user" }, 404);
    const q = await fs.get(qk(id, to.id), { type: "json" });
    if (!q || q.status !== "auto") return json({ error: "not owed" }, 403);
    if (!B64.test(String(b.iv || "")) || !B64.test(String(b.ct || ""))) return json({ error: "bad payload" }, 400);
    await fs.setJSON(dk(to.id, id), { to: to.id, from: id, iv: String(b.iv), ct: String(b.ct), at: now });
    await fs.setJSON(qk(id, to.id), { ...q, status: "accepted", answeredAt: now });
    return json({ ok: true });
  }

  if (b.act === "remove") {
    const o = String(b.other || "");
    if (!ID.test(o)) return json({ error: "bad id" }, 400);
    for (const k of [qk(id, o), qk(o, id), dk(id, o), dk(o, id)]) await fs.delete(k);
    return json({ ok: true });
  }

  return json({ error: "action" }, 400);
};

export const config = { path: "/api/friends" };
