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

## 2026-09-24
- Sidebar "Räume": Eingabefelder für Raummaße umbrechen jetzt (flex-wrap) statt über den rechten Rand hinauszulaufen
- Redundante Rand-Buttons (Tür/Fenster-Drag-Palette, Messwerkzeug-Icon oben rechts am Grundriss) entfernt - beide Funktionen bereits über die Tabs "Türen" bzw. "Messen" erreichbar; zugehörigen toten Drag-and-Drop-Code für die Öffnungs-Palette entfernt
- Bug-Fix "Ecke ziehen": Das Vollbild-Overlay des Bottom Sheets blockierte Zeiger-Events auf dem Grundriss, sobald der Raum-Tab geöffnet war (Ecken ließen sich nicht mehr greifen); Overlay lässt Zeiger-Events jetzt durch, während der Raum-Tab aktiv ist
- Dateien: style.css, index.html, js/interaction.js, js/ui.js

## 2026-09-24
- Bug-Fix: Maßlinien (Möbel-Kantenabstand, Tür/Fenster-Eckabstand) waren zwar als "editierbar" angelegt, aber ein Klick auf die Maßzahl blurte das gerade geöffnete Eingabefeld sofort wieder (Klickziel war ein nicht fokussierbares SVG-Element) und committete ungewollt den unveränderten Wert, bevor eine Eingabe möglich war - wirkte dadurch wie eine reine Anzeige. `preventDefault()` auf dem auslösenden `pointerdown` verhindert den vorzeitigen Fokusverlust; Eingabefeld bleibt jetzt offen, Enter/Fokus-Verlust übernimmt den neuen Wert, Escape verwirft ihn. Betrifft Möbel-Kantenabstand und Tür/Fenster-Eckabstand gleichermaßen.
- Dateien: js/interaction.js

## 2026-09-24
- Bug-Fix: Möbel-Namenslabel wanderte beim Drehen des Möbelstücks zu einer anderen Ecke (teils außerhalb des Möbelkörpers), statt an Ort und Stelle zu bleiben. Ursache: Die Gegenrotation des Labels lief um den eigenen Textanker statt um dieselbe Möbelmitte wie die Rotation der Elterngruppe. Gegenrotation läuft jetzt um denselben Drehpunkt - Label bleibt fest an seiner lokalen Position, unabhängig von der Rotation.
- Dateien: js/svg-elements.js
