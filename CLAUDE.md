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
- Never commit the roster link or the access key: they live only in GitHub Actions secrets.
- The owner writes in French and uses an iPhone set to English: give iOS labels in English.
