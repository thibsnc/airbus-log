// METAR and TAF for a short list of ICAO stations, from aviationweather.gov.
export default async (req) => {
  const ids = (new URL(req.url).searchParams.get("ids") || "NWWW")
    .toUpperCase().split(",").filter((c) => /^[A-Z]{4}$/.test(c)).slice(0, 20).join(",") || "NWWW";
  const h = { headers: { "User-Agent": "aci-log" }, signal: AbortSignal.timeout(15000) };
  try {
    const [metar, taf] = await Promise.all([
      fetch(`https://aviationweather.gov/api/data/metar?ids=${ids}&format=raw`, h).then((r) => r.text()),
      fetch(`https://aviationweather.gov/api/data/taf?ids=${ids}&format=raw`, h).then((r) => r.text()),
    ]);
    return new Response(JSON.stringify({ metar, taf, fetchedAt: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=120", "Netlify-CDN-Cache-Control": "public, max-age=300" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "weather unavailable" }), { status: 502, headers: { "Content-Type": "application/json" } });
  }
};

export const config = { path: "/api/wx" };
