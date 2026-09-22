# RAUMWERK – Projektkontext für Claude Code

## Was ist das
RAUMWERK ist eine Raum- und Einrichtungsplanungs-App für Privatpersonen (Web, später native App via Capacitor). Nutzer planen Räume, legen eigene Möbel maßgenau an, verschieben/drehen sie und vergleichen Einrichtungsvarianten. Claim: „Plane. Probiere. Vergleiche.“

MVP-Fokus: präzise 2D-Raumplanung. Kein 3D, keine KI, kein Produktkatalog, kein Raum-/Möbelscan im MVP.

## Tech-Stack
- Vanilla JS, kein Framework (bewusste Entscheidung, kein React-Native-Rewrite geplant)
- Dateien: `index.html`, `style.css`, `js/*.js` (aufgeteilt nach Zuständigkeit, siehe Liste unten)
- Speicherung: `localStorage`, mit `schemaVersion`-Feld und automatischer Migration alter Datenstände
- Deployment: GitHub Pages (Phase A des Veröffentlichungsplans)
- Nächster geplanter Meilenstein nach dem aktuellen Datenmodell-Umbau: Verpacken als native App (Capacitor) für App Store / Google Play, ohne Neuentwicklung

### Dateiübersicht
- `index.html` – HTML-Grundgerüst, Sidebar-/Toolbar-Markup, SVG-Canvas, lädt `style.css` und alle `js/*.js` in Reihenfolge
- `style.css` – gesamtes Styling der App (Layout, Sidebar, Toolbar, SVG-Elemente)
- `js/constants.js` – globale Konstanten (Farbpalette, Wandstärke `WALL_T`, Andock-Radius `SNAP`) und UI-Selektions-State
- `js/migration.js` – Schema-Versionierung (`SCHEMA_VERSION`) und Migrationskette für ältere `localStorage`-Datenstände
- `js/geometry.js` – Polygon-Shape-Datenmodell (Vertices + Wand-IDs), Wandgeometrie- und Andock-Berechnungen
- `js/store.js` – Projekt-/Raum-/Varianten-Datenmodell, `localStorage`-Speichern/Laden, Export
- `js/undo.js` – Undo/Redo-Stack (nur Session, max. 50 Schritte)
- `js/floor.js` – Bodenbelag-SVG-Generierung (Raster/Muster)
- `js/svg-elements.js` – SVG-Bausteine für Wände, Türen/Fenster, Möbel-Icons
- `js/render.js` – DOM-Referenzen, Kamera/Viewport, Haupt-Render-Funktion, Selektion
- `js/measure-tool.js` – freies Maßband-Werkzeug (nur Session, nicht gespeichert)
- `js/interaction.js` – Pointer-Interaktionen: Vertex-Drag, Möbel-/Öffnungs-Drag, Öffnungs-Platzierung
- `js/ui.js` – UI-Rendering & Event-Wiring: Sidebar-Listen, Formulare, Stockwerk-Verwaltung, Varianten-UI

## Zentrale Architekturentscheidungen
- **Wände haben stabile IDs** (kein Index) – Türen/Fenster bleiben so auch nach Formänderungen korrekt zugeordnet
- **Raum als Vieleck** möglich (optional, Rechteck bleibt Standard-Einstieg über Breite/Tiefe), Winkel-Wände per Eckenziehen (15°-Einrasten) oder Zahleneingabe (Länge + Winkel)
- **Varianten-Modell**: Ein Raum hat eine Form (Wände) und eine Liste an Öffnungen (Türen/Fenster) – diese sind über alle Varianten hinweg identisch. Nur Möbel und Bodenbelag unterscheiden sich pro Variante. Mindestens eine Variante bleibt immer bestehen.
- **Türen/Fenster** werden per Drag-and-Drop auf eine beliebige Wand platziert (automatische Wanderkennung, kein Dropdown), docken an die nähere Ecke an
- **Möbel** (aktuell nur Typ A: selbst angelegt mit Name/Breite/Tiefe) docken an Wände/andere Möbel an; beim Andocken an schräge Wände wird deren Neigung automatisch übernommen
- Typ B (Möbel aus Produktkatalog, Affiliate) ist bewusst Zukunftsmusik – nicht implementieren, nur Datenmodell-Feld dafür vorsehen falls relevant

## Bewusst zurückgestellt (nicht implementieren ohne Rücksprache)
- 3D-Ansicht
- KI-Funktionen jeder Art
- Automatische Grundriss-Erkennung aus Fotos
- React-Native-Neuentwicklung
- Zusammenhängende Etagen-Form (geteilte Wände zwischen Nachbarräumen) – Räume bleiben vorerst einzelne andockende Rechtecke in der Wohnungsübersicht
- UX-Konzept-Umsetzung (Werkzeugleiste, Bottom Sheets, Sidebar-Neustrukturierung) – Konzept ist akzeptiert, aber Umsetzungszeitpunkt offen

## Arbeitsweise
- Teilaufgaben klein und einzeln testbar halten – ein Task = eine testbare Einheit = ein Commit
- Undo/Redo-Stack ist gedeckelt auf 50 Schritte, reine Sitzungs-Funktion (nicht Teil der gespeicherten Raumdaten)
- Freies Maßband ist ebenfalls nicht Teil der gespeicherten Raumdaten
- Variablen-/Kommentar-Sprache: am bestehenden Code orientieren, keine neue Konvention einführen

## Git-Workflow
- Für jede Teilaufgabe einen eigenen Feature-Branch anlegen, dort entwickeln und testen
- Erst nach erfolgreichem Test in `main` mergen – `main` bleibt so immer in einem funktionierenden, deploybaren Zustand (läuft live über GitHub Pages)
- Branch nach dem Merge löschen, wenn nicht mehr gebraucht

## Testing
- Automatisierte Tests gezielt für fehleranfällige/komplexe Logik, nicht für alles – Priorität:
  - Andock-Logik (v. a. Übernahme der Wandneigung bei schrägen Wänden)
  - Varianten-Datenmodell (geteilte Form/Öffnungen vs. varianten-spezifische Möbel/Boden)
  - Wand-ID-Zuordnung bei Formänderungen (Winkel-Wände)
- Einfache UI-Interaktionen (Verschieben, Klicks, Zoom) weiterhin manuell im Browser testen
- **Framework**: Node.js eingebauter Test-Runner (`node:test` + `node:assert/strict`), keine zusätzliche Abhängigkeit nötig (Node ≥ 18). Passt zum Vanilla-JS-Ansatz ohne Build-Tooling.
- Die `js/*.js`-Dateien sind klassische Browser-`<script>`-Dateien ohne Module-Exports. `tests/helpers/load-scripts.js` lädt die benötigten Dateien per `vm`-Kontext (mit minimalen Stubs für `document`/`localStorage`) und macht ihre Top-Level-Funktionen für Tests zugänglich, ohne den Produktionscode zu verändern.
- Lokal ausführen: `npm test` (bzw. `node --test`, aus dem Projekt-Root)
- Tests liegen in `tests/`, Namensschema `*.test.js`

## Changelog-Pflicht
Nach jeder abgeschlossenen Teilaufgabe einen kurzen Eintrag in `CHANGELOG.md` (Root) ergänzen: Datum, was wurde geändert, betroffene Dateien. Kurz und stichpunktartig, kein Roman.

## Offene Punkte (nicht entscheiden, nur vormerken)
- Projekt/Raum-Struktur eventuell später umkehren: Räume frei erstellbar, werden automatisch zu Projekt sobald mehrere zusammengehören
- Zeitpunkt für UX-Konzept-Umsetzung
- Zeitpunkt für zusammenhängende Etagen-Form
- Framework-Frage im Auge behalten: aktuell bewusst Vanilla JS (kein Wechsel geplant). Falls das Synchron-Halten der zwei Varianten-Ansichten im Vergleichsmodus fummelig/fehleranfällig wird, ist das ein guter Anlass, einen Framework-Einsatz (z. B. nur für diesen Bereich) neu zu bewerten – nicht von sich aus vorschlagen, nur bei konkreten Anzeichen ansprechen
