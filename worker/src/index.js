// airbus log API: relays the private roster feed and METAR/TAF to the app.
// Secrets (set in Cloudflare, never in this repo): ICS_URL, APP_KEY.
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-store",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (!env.APP_KEY || url.searchParams.get("key") !== env.APP_KEY) {
      return new Response("unauthorized", { status: 401, headers: cors });
    }
    if (url.pathname === "/roster") {
      const r = await fetch(env.ICS_URL);
      return new Response(await r.text(), {
        status: r.status,
        headers: { ...cors, "Content-Type": "text/calendar; charset=utf-8" },
      });
    }
    if (url.pathname === "/wx") {
      const ids = (url.searchParams.get("ids") || "NWWW").replace(/[^A-Za-z0-9,]/g, "").toUpperCase();
      const h = { headers: { "User-Agent": "airbus-log" } };
      const [metar, taf] = await Promise.all([
        fetch(`https://aviationweather.gov/api/data/metar?ids=${ids}&format=raw`, h).then((r) => r.text()),
        fetch(`https://aviationweather.gov/api/data/taf?ids=${ids}&format=raw`, h).then((r) => r.text()),
      ]);
      return new Response(JSON.stringify({ metar, taf, fetchedAt: new Date().toISOString() }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response("airbus log api", { headers: cors });
  },
};
