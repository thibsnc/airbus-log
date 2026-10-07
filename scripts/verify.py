#!/usr/bin/env python3
"""Check ACI LOG against a roster before publishing.

Usage: python3 scripts/verify.py ROSTER.ics

Loads index.html in headless Chromium with that roster, renders every view, and prints:
  - JavaScript errors (any error fails the run),
  - each flight with its UTC times, duration and flight time,
  - the app's own integrity report (the same one shown on the phone).
The roster file stays outside the repository: it is private.
"""
import http.server, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    ics = open(sys.argv[1], encoding="utf-8").read()
    src = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    i = src.rindex("})();")
    hook = "\nwindow.__api={get state(){return state},parseICS,load,render,flightCard,blockOf,checkRoster,get integ(){return integ},renderLog,renderStats};\n"
    test = os.path.join(ROOT, ".verify.html")
    open(test, "w", encoding="utf-8").write(src[:i] + hook + src[i:])

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
        def log_message(self, *a): pass
    srv = socketserver.TCPServer(("127.0.0.1", 0), Quiet)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    errors = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={"width": 390, "height": 844})
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
            pg.goto(f"http://127.0.0.1:{port}/.verify.html")
            pg.wait_for_timeout(500)
            res = pg.evaluate("""(ics)=>{
              const A=window.__api; document.getElementById('keyscreen').hidden=true;
              A.load(ics,new Date().toISOString(),true);
              for(const v of ['band','cal','log','stats','band']){ A.state.view=v; A.render(); }
              const legs=A.state.events.filter(e=>e.cat==='vol'||e.cat==='mep').map(e=>{
                const d=document.createElement('div'); d.innerHTML=A.flightCard(e); const b=A.blockOf(e);
                const z=t=>new Date(t).toISOString().slice(5,16).replace('T',' ');
                return `${e.cat==='mep'?'MEP':'FLT'} ${e.flight.padEnd(6)} ${(e.from+'-'+e.to).padEnd(8)} ${z(e.dep)}Z → ${z(e.arr)}Z  durée ${d.querySelector('.fc-dur').textContent.padEnd(6)} flight time ${b.min/60|0}h${String(b.min%60).padStart(2,'0')}${b.real?' (réel)':''}`; });
              return { n:A.state.events.length, legs, issues:A.integ.issues };
            }""", ics)
            b.close()
    finally:
        srv.shutdown()
        os.remove(test)

    print(f"{res['n']} activités lues")
    print("\n".join(res["legs"]))
    print("\nVérification :")
    if not res["issues"]:
        print("  rien à signaler")
    for it in res["issues"]:
        print(f"  [{it['lvl']}] {it['label']} : {it['msg']}")
    if errors:
        print("\nERREURS JavaScript :\n  " + "\n  ".join(errors))
        sys.exit(1)
    print("\nOK : aucune erreur JavaScript")

if __name__ == "__main__":
    main()
