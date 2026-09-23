# Changelog

Format pro Eintrag: Datum – was wurde geändert – betroffene Dateien.

<!--
Beispiel:
## 2026-09-22
- Andock-Logik für schräge Wände korrigiert
- Dateien: js/interaction.js, js/geometry.js
-->

## 2026-09-22
- CLAUDE.md vervollständigt: Tech-Stack-Dateiliste ergänzt, Testing-Abschnitt um gewähltes Framework ergänzt
- CHANGELOG.md angelegt
- Leichtgewichtiges Test-Setup eingerichtet (Node `node:test`, vm-basierter Script-Loader, ein Beispieltest)
- Dateien: CLAUDE.md, CHANGELOG.md, package.json, tests/helpers/load-scripts.js, tests/geometry.example.test.js

## 2026-09-23
- GitHub-Actions-Workflow eingerichtet, führt `npm test` bei Push auf main und bei Pull Requests aus
- Dateien: .github/workflows/test.yml, CLAUDE.md

## 2026-09-23
- localStorage-Zugriffe hinter neuem Modul js/storage.js gekapselt (reines Refactoring, keine Verhaltensänderung); store.js und migration.js sprechen jetzt nur noch über storage.js mit dem Speicher
- Dateien: js/storage.js (neu), js/store.js, js/migration.js, index.html, CLAUDE.md

## 2026-09-23
- Vergleichsmodus implementiert: "Vergleichen"-Button (bisher ohne Funktion) öffnet eine eigene Ansicht mit zwei nebeneinander liegenden, reinen Lese-Panels; pro Panel unabhängige Variantenauswahl, gemeinsame Zoom/Pan-Transformation (bleibt beim Variantenwechsel erhalten), Bearbeitung deaktiviert, eigener Button zum Verlassen
- Dateien: js/compare.js (neu), js/svg-elements.js, index.html, style.css

## 2026-09-23
- "+ Neue Variante" übernimmt jetzt standardmäßig Möbel + Bodenbelag der aktuell aktiven Variante; separater "Duplizieren"-Button entfernt, da nicht mehr nötig. Neuer Variantenname weiterhin fortlaufend "Variante N" (höchste bestehende Nummer im Raum + 1, unabhängig vom Namen der Quellvariante). Tests für Duplizierung und Nummerierung ergänzt.
- Dateien: js/store.js, js/ui.js, index.html, tests/variants.test.js (neu)
