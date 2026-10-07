# AIRBUS LOG

Application web personnelle (installable sur iPhone) pour consulter son roster équipage :
liste et calendrier, METAR/TAF, export logbook (LogTen Pro, PILOTLOG) et statistiques.

- `index.html` : l'application (hébergée par GitHub Pages).
- `manifest.webmanifest`, `sw.js`, `icons/` : installation sur l'écran d'accueil et usage hors ligne.
- `scripts/build-site.mjs` et `.github/workflows/publish.yml` : toutes les 30 minutes, GitHub Actions
  récupère le roster et les METAR/TAF, les chiffre (AES-GCM) et publie `data.json` avec l'app.

Aucune donnée personnelle n'est stockée dans ce dépôt : le lien du roster et la clé d'accès
sont des secrets GitHub Actions (`ICS_URL`, `APP_KEY`). Les données publiées sont chiffrées :
seule la clé saisie dans l'app permet de les lire.
