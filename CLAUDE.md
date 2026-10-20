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
- Netlify: the owner upgraded to a paid plan on 2026-10-20 (695 credits left that day); 15 credits per production deploy. `netlify.toml` skips every build unless the commit message contains `[netlify]`.
  Only add `[netlify]` when the owner asks to update the shared version (colleagues), not on routine changes.
  ALWAYS ASK FIRST: even when a change looks like it needs the shared version (server functions, a fix for colleagues),
  finish it on the owner's app, then ask "Je publie pour les collègues (15 crédits) ?" and wait for a yes.
  Never push a `[netlify]` commit on your own initiative.
  After each `[netlify]` deploy, tell the owner it cost 15 credits and how many remain this month
  (read it with the Netlify connector when connected; otherwise say where to look: Team settings → Billing → Usage).
  Then write the published version to the preview's store (ArtifactData set `meta/shared` = {n, date} from
  version.json): the preview cannot fetch aci-log.netlify.app itself.
- Usage tracking (shared version only): on aci-log.netlify.app, after the roster link, the app asks first/last name
  once (stored as `who`), then POSTs /api/usage at most every 6 h (device id, name, trigram, version; never the link).
  `netlify/functions/usage.mjs` keeps one Netlify Blobs record per device. The owner's Réglages lists users via GET
  with header x-admin = SHA-256("aci-log-admin:"+access key) first 24 hex chars, checked against the Netlify env var
  ADMIN_CODE (the owner sets it; changing it needs a `[netlify]` deploy). package.json holds @netlify/blobs.
- Flight reminders (Réglages → Alertes): Web Push. The app subscribes (VAPID key from GET /api/push?key) and POSTs
  {id, subscription, items:[{at,title,body,tag}]} to /api/push (one item per duty, before the first check-in);
  `netlify/functions/push-send.mjs` (scheduled every 5 min) sends due items. Encryption/VAPID are hand-written in
  `netlify/lib/webpush.mjs` (checked against the RFC 8291 test vector); VAPID keys live in Netlify Blobs ("push/vapid").
  iPhone: only for the app installed on the home screen, iOS 16.4+. Push changes need a `[netlify]` deploy.
- Family view (Réglages → Famille): the app POSTs a simplified schedule (flight duties with route, flight numbers and
  times, layovers, ground days, days off; never crew names or the roster link) to /api/family with a public token t and a
  private key k (only SHA-256(k) is stored, Netlify Blobs store "family"). `famille.html#t=…` reads it (GET) and computes
  "where is he now / back home at". Synced on every roster change. Changes to it need a `[netlify]` deploy.
- Version shown in Réglages: run `python3 scripts/bump.py "Précis : titre" "Phrase simple et brève"` once per change set to index.html
  (the second argument is the plain one-line description users read first, in "tu", no jargon; everyone can tap their version to see the list)
  (updates APP_VERSION, adds the line to CHANGELOG, shown when the owner taps his version, and writes version.json).
  Write it for colleagues: they see it in a "Nouveautés" sheet after updating. Add `--admin` for owner-only changes (hidden from them). The owner's app compares it with https://aci-log.netlify.app/version.json.
- Before every push, verify: fetch the roster from the artifact store (ArtifactData get `roster/current`,
  `out_dir` in the scratchpad), save its `ics` field to a scratch .ics file, run `python3 scripts/verify.py <file.ics>`.
  It must end with "OK" (no JavaScript error); read the per-flight times and the integrity report, fix anything wrong.
  Never put the roster file in the repo.
- The app itself re-runs `checkRoster()` on every roster update and shows the result under the summary tiles.
- Never commit the roster link or the access key: they live only in GitHub Actions secrets.
- The owner writes in French and uses an iPhone set to English: give iOS labels in English.
