#!/usr/bin/env python3
"""Bump the app version: python3 scripts/bump.py  (1.0 -> 1.1, today's date in Nouméa).

Updates APP_VERSION in index.html and writes version.json, which the owner's app reads
from the shared Netlify site to show which version colleagues have."""
import datetime, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, "index.html")
s = open(p, encoding="utf-8").read()
m = re.search(r'const APP_VERSION = \{ n:"(\d+)\.(\d+)", date:"[\d-]+" \};', s)
n = f"{m.group(1)}.{int(m.group(2)) + 1}"
today = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=11)).date().isoformat()
s = s[:m.start()] + f'const APP_VERSION = {{ n:"{n}", date:"{today}" }};' + s[m.end():]
open(p, "w", encoding="utf-8").write(s)
json.dump({"n": n, "date": today}, open(os.path.join(ROOT, "version.json"), "w"))
print(n, today)
