# ACI LOG: notes for Claude

- `index.html` is the single source of the app (GitHub Pages, installed on the owner's iPhone).
- After every change to `index.html`: push to `main` (the Actions workflow republishes the site),
  then run `python3 scripts/to_preview.py` and republish the preview with the Artifact tool at
  https://claude.ai/artifact/XxnyVKZDYKVChvHfioBZpp so the owner sees it beside the chat.
- The preview runs the same code in "IN_CLAUDE" mode and reads roster/METAR/TAF from the artifact's
  own store, fed by an hourly scheduled task. The phone version reads encrypted `data.json`.
- Shared version: https://aci-log.netlify.app serves the same files plus `netlify/functions` (roster and
  METAR/TAF relay, same origin). Colleagues paste their own Aircalin iCal link; it stays on their device.
  The owner's key mode (encrypted `data.json` on GitHub Pages) still works.
  The owner's app may also run in link mode on GitHub Pages: it then calls the Netlify relays cross-origin,
  so /api/roster allows https://thibsnc.github.io and /api/wx allows any origin (CORS). Keep that when editing them.
- Netlify free plan: 300 credits/month, 15 per production deploy; when they run out the shared site is paused
  (never billed). `netlify.toml` skips every build unless the commit message contains `[netlify]`.
  Only add `[netlify]` when the owner asks to update the shared version (colleagues), not on routine changes.
  After each `[netlify]` deploy, tell the owner it cost 15 credits and how many remain this month
  (read it with the Netlify connector when connected; otherwise say where to look: Team settings → Billing → Usage).
  Then write the published version to the preview's store (ArtifactData set `meta/shared` = {n, date} from
  version.json): the preview cannot fetch aci-log.netlify.app itself.
- Usage tracking (shared version only): on aci-log.netlify.app, after the roster link, the app asks first/last name
  once (stored as `who`), then POSTs /api/usage at most every 6 h (device id, name, trigram, version; never the link).
  `netlify/functions/usage.mjs` keeps one Netlify Blobs record per device. The owner's Réglages lists users via GET
  with header x-admin = SHA-256("aci-log-admin:"+access key) first 24 hex chars, checked against the Netlify env var
  ADMIN_CODE (the owner sets it; changing it needs a `[netlify]` deploy). package.json holds @netlify/blobs.
- Version shown in Réglages: run `python3 scripts/bump.py` once per change set to index.html (updates
  APP_VERSION and version.json). The owner's app compares it with https://aci-log.netlify.app/version.json.
- Before every push, verify: fetch the roster from the artifact store (ArtifactData get `roster/current`,
  `out_dir` in the scratchpad), save its `ics` field to a scratch .ics file, run `python3 scripts/verify.py <file.ics>`.
  It must end with "OK" (no JavaScript error); read the per-flight times and the integrity report, fix anything wrong.
  Never put the roster file in the repo.
- The app itself re-runs `checkRoster()` on every roster update and shows the result under the summary tiles.
- Never commit the roster link or the access key: they live only in GitHub Actions secrets.
- The owner writes in French and uses an iPhone set to English: give iOS labels in English.
