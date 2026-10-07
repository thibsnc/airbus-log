// Builds the static site in _site/ and adds data.json:
// roster (iCal) + METAR/TAF, encrypted with AES-GCM using a key derived from APP_KEY.
// Secrets come from GitHub Actions (ICS_URL, APP_KEY) and never appear in the repository.
import { mkdir, cp, writeFile, readFile } from "node:fs/promises";

const OUT = "_site";
const FILES = ["index.html", "manifest.webmanifest", "sw.js", ".nojekyll"];
const FAVOURITES = ["NFFN", "NLWW", "NVVV", "NWWW", "NZAA", "YBBN", "YMML", "YSSY"];
const ICAO = { NOU: "NWWW", GEA: "NWWM", NAN: "NFFN", SUV: "NFNA", WLS: "NLWW", FUT: "NLWF", AKL: "NZAA", SYD: "YSSY", BNE: "YBBN", MEL: "YMML", PPT: "NTAA", VLI: "NVVV", NRT: "RJAA", HND: "RJTT", KIX: "RJBB", CDG: "LFPG", BKK: "VTBS", SIN: "WSSS", HKG: "VHHH", LAX: "KLAX" };

async function get(url) {
  const r = await fetch(url, { headers: { "User-Agent": "airbus-log" }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} for ${url.split("?")[0]}`);
  return r.text();
}

function upcomingStations(ics) {
  const now = Date.now(), set = new Set(FAVOURITES);
  const text = ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  for (const block of text.split("BEGIN:VEVENT").slice(1)) {
    const start = /DTSTART[^:]*:(\d{8}T\d{6})/.exec(block);
    const sum = /SUMMARY[^:]*:(.*)/.exec(block);
    if (!start || !sum) continue;
    const s = start[1];
    const t = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13));
    if (t < now - 12 * 3600e3 || t > now + 48 * 3600e3) continue;
    const route = /\b([A-Z]{3})\/([A-Z]{3})\b/.exec(sum[1]);
    if (route) for (const c of [route[1], route[2]]) if (ICAO[c]) set.add(ICAO[c]);
  }
  return [...set].sort();
}

async function encrypt(payload, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(payload))));
  const b64 = (u) => Buffer.from(u).toString("base64");
  return { v: 1, kdf: "PBKDF2-SHA256-150000", salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

await mkdir(OUT, { recursive: true });
for (const f of FILES) await cp(f, `${OUT}/${f}`);
await cp("icons", `${OUT}/icons`, { recursive: true });

const { ICS_URL, APP_KEY } = process.env;
if (!ICS_URL || !APP_KEY) {
  console.log("ICS_URL or APP_KEY secret missing: publishing the app without data.json");
} else {
  let ics = null, metar = "", taf = "";
  try { ics = await get(ICS_URL); if (!ics.includes("BEGIN:VCALENDAR")) throw new Error("not an iCalendar"); }
  catch (e) { console.log("Roster fetch failed:", e.message); ics = null; }
  const ids = upcomingStations(ics || "").join(",");
  try {
    [metar, taf] = await Promise.all([
      get(`https://aviationweather.gov/api/data/metar?ids=${ids}&format=raw`),
      get(`https://aviationweather.gov/api/data/taf?ids=${ids}&format=raw`),
    ]);
  } catch (e) { console.log("Weather fetch failed:", e.message); }
  const payload = { ics, metar, taf, stations: ids, fetchedAt: new Date().toISOString() };
  await writeFile(`${OUT}/data.json`, JSON.stringify(await encrypt(payload, APP_KEY)));
  console.log(`data.json written: roster ${ics ? "ok" : "missing"}, stations ${ids}`);
}
