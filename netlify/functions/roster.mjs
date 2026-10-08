// Relays a crew member's own Aircalin iCal roster to the app (the portal does not allow
// browsers to read it directly). The link is sent in the POST body and is never stored or logged.
// The owner's app on GitHub Pages also reads, through here, the links friends gave him (Amis tab):
// only that origin is allowed cross-origin.
const OWNER_ORIGIN = "https://thibsnc.github.io";

export default async (req) => {
  const origin = req.headers.get("origin");
  const cors = origin === OWNER_ORIGIN
    ? { "Access-Control-Allow-Origin": OWNER_ORIGIN, "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin" }
    : {};
  const headers = { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Max-Age": "86400" } });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers });
  let url;
  try { ({ url } = await req.json()); } catch { return new Response("bad request", { status: 400, headers }); }
  let u;
  try { u = new URL(String(url).trim()); } catch { return new Response("not a link", { status: 400, headers }); }
  if (u.protocol !== "https:" || u.hostname !== "alexis.aircalin.nc" || !u.pathname.startsWith("/crew-web/ics")) {
    return new Response("not an Aircalin roster link", { status: 400, headers });
  }
  try {
    const r = await fetch(u, { headers: { "User-Agent": "aci-log" }, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    if (!r.ok || !text.includes("BEGIN:VCALENDAR")) return new Response("roster unavailable", { status: 502, headers });
    return new Response(text, { headers: { ...cors, "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
  } catch {
    return new Response("roster unavailable", { status: 502, headers });
  }
};

export const config = { path: "/api/roster" };
