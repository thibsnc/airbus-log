#!/usr/bin/env python3
"""Bump the app version: python3 scripts/bump.py "Short description of the change"
(1.0 -> 1.1, today's date in Nouméa).

Updates APP_VERSION in index.html, adds the description at the top of CHANGELOG (shown in
Réglages → Version when the owner taps his version) and writes version.json, which the owner's
app reads from the shared Netlify site to show which version colleagues have."""
import datetime, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, "index.html")
s = open(p, encoding="utf-8").read()
m = re.search(r'const APP_VERSION = \{ n:"(\d+)\.(\d+)", date:"[\d-]+" \};', s)
n = f"{m.group(1)}.{int(m.group(2)) + 1}"
today = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=11)).date().isoformat()
s = s[:m.start()] + f'const APP_VERSION = {{ n:"{n}", date:"{today}" }};' + s[m.end():]
text = " ".join(sys.argv[1:]).strip()
if not text:
    sys.exit("Give a short description: python3 scripts/bump.py \"Calendrier : …\"")
c = re.search(r"const CHANGELOG = (\[.*?\]);\n", s)
log = json.loads(c.group(1))
log.insert(0, {"n": n, "date": today, "t": text})
s = s[:c.start()] + "const CHANGELOG = " + json.dumps(log, ensure_ascii=False) + ";\n" + s[c.end():]
open(p, "w", encoding="utf-8").write(s)
json.dump({"n": n, "date": today}, open(os.path.join(ROOT, "version.json"), "w"))
print(n, today)
