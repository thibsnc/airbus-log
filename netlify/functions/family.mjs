// Family view: a read-only schedule a crew member shares with their family (famille.html#t=…).
// The app sends a simplified schedule (days, destinations, departure and return times, flight numbers):
// no crew names, no roster link, no technical details. Read with the public token, written only with the
// private key that created it (its SHA-256 is stored).
//   GET  /api/family?t=TOKEN                       → { name, updatedAt, segs:[…] }
//   POST /api/family { t, k, name, segs }          → saved
//   POST /api/family { t, k, enabled:false }       → deleted
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);
const TOK = /^[A-Za-z0-9_-]{20,48}$/;
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const KINDS = new Set(["vol", "sol", "off", "esc"]);

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } });
  const store = getStore("family");

  if (req.method === "GET") {
    const t = new URL(req.url).searchParams.get("t") || "";
    if (!TOK.test(t)) return json({ error: "bad token" }, 400);
    const rec = await store.get("f-" + t, { type: "json" });
    if (!rec) return json({ error: "not found" }, 404);
    return json({ name: rec.name, updatedAt: rec.updatedAt, segs: rec.segs });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let b; try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const t = String(b.t || ""), k = String(b.k || "");
  if (!TOK.test(t) || !TOK.test(k)) return json({ error: "bad token" }, 400);
  const key = "f-" + t;
  const prev = await store.get(key, { type: "json" });
  if (prev && prev.kh !== sha(k)) return json({ error: "forbidden" }, 403);
  if (b.enabled === false) { if (prev) await store.delete(key); return json({ ok: true, enabled: false }); }

  const now = Date.now();
  const segs = (Array.isArray(b.segs) ? b.segs : []).slice(0, 120).map((s) => ({
    kind: KINDS.has(s.kind) ? s.kind : "sol",
    start: Number(s.start), end: Number(s.end),
    title: clean(s.title, 80), sub: clean(s.sub, 120), at: clean(s.at, 4).toUpperCase(),
    legs: (Array.isArray(s.legs) ? s.legs : []).slice(0, 8).map((l) => ({
      from: clean(l.from, 4).toUpperCase(), to: clean(l.to, 4).toUpperCase(), flight: clean(l.flight, 8).toUpperCase(),
      dep: Number(l.dep), arr: Number(l.arr),
    })),
  })).filter((s) => s.start > 0 && s.end >= s.start && s.end > now - 3 * 864e5 && s.start < now + 120 * 864e5);
  await store.setJSON(key, { kh: prev ? prev.kh : sha(k), name: clean(b.name, 40), segs, updatedAt: new Date().toISOString() });
  return json({ ok: true, count: segs.length });
};

export const config = { path: "/api/family" };
