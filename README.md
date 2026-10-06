# AIRBUS LOG

Application web personnelle (installable sur iPhone) pour consulter son roster équipage :
liste et calendrier, METAR/TAF, export logbook (LogTen Pro, PILOTLOG) et statistiques.

- `index.html` : l'application (hébergée par GitHub Pages).
- `manifest.webmanifest`, `sw.js`, `icons/` : installation sur l'écran d'accueil et usage hors ligne.
- `worker/` : Cloudflare Worker qui relaie le flux du roster et la météo aéronautique.

Aucune donnée personnelle n'est stockée dans ce dépôt : le lien du roster et la clé d'accès
sont des secrets configurés dans Cloudflare, et la clé est saisie une fois dans l'app.
