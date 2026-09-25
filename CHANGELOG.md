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

## 2026-09-24
- Bug-Fix (Nachbesserung des vorherigen Eintrags): Bei nicht-quadratischen Möbeln (z. B. Standardmaße 160×80) landete der fixierte Label-Ankerpunkt nach einer 90°/270°-Drehung außerhalb der jetzt hochkant stehenden Box, da die lokale Ecke des unrotierten Rechtecks nicht mehr innerhalb der (seitenvertauschten) sichtbaren Fläche lag. Label wird jetzt anhand der bereits rotierten Bounding-Box (`getAABB`) positioniert und als eigenständiges, nicht rotiertes Element außerhalb der Möbelgruppe gerendert - bleibt dadurch bei jeder Rotation und jedem Seitenverhältnis innerhalb der sichtbaren Möbelfläche.
- Bug-Fix: Eingabefeld der editierbaren Maßlinien (Möbel-Kantenabstand, Tür/Fenster-Eckabstand) erschien oft weit von der angeklickten Maßzahl versetzt. Ursache: Die Bildschirmposition wurde manuell mit `scale = svgRect.width / viewBox.width` berechnet - das ignoriert, dass das SVG bei abweichendem Seitenverhältnis (Raum vs. Canvas-Panel) per `preserveAspectRatio="xMidYMid meet"` tatsächlich anhand der kleineren Skalierung (oft die Höhe) rendert und zentriert (Letterboxing). Nutzt jetzt `getScreenCTM()` wie der Rest der App (z. B. `svgPoint()`), das das automatisch korrekt berücksichtigt.
- Dateien: js/svg-elements.js, js/render.js, js/interaction.js, js/compare.js

## 2026-09-24
- Raum-Tab: klar sichtbarer Umschalter "Zahleneingabe" / "Ecke ziehen" für die Raumform-Bearbeitung ergänzt (Aufgabe 5). Vorher erschienen die ziehbaren Eckpunkte immer, sobald der Raum-Tab offen war, ohne erkennbaren Modus. Jetzt zeigt "Zahleneingabe" die bestehende Längen/Winkel-Tabelle, "Ecke ziehen" blendet die Tabelle aus und zeigt stattdessen die ziehbaren Eckpunkte im Grundriss (15°-Einrasten bleibt wie gehabt). Beide Modi bearbeiten dieselbe Raumform, kein separater Einstiegsbildschirm.
- Dateien: index.html, style.css, js/constants.js, js/render.js, js/ui.js

## 2026-09-24
- Möbel werden nach einer Raumform-Änderung (Zahleneingabe, Ecke ziehen, Ecke hinzufügen/entfernen, Breite/Tiefe-Feld) automatisch neu platziert, wenn sie dadurch ganz oder teilweise außerhalb der neuen Raumfläche liegen (Aufgabe 6). Minimale Verschiebung Richtung Raummitte bis zur nächsten gültigen Position, Ausrichtung/Rotation bleibt erhalten. Gilt variantenübergreifend, da die Raumform pro Raum (nicht pro Variante) gilt. Neue Geometrie-Helfer `pointInPolygon`/`itemFitsInShape`/`repositionItemIntoShape` (js/geometry.js) und `repositionItemsAfterShapeChange` (js/store.js), Tests ergänzt.
- Dateien: js/geometry.js, js/store.js, js/ui.js, js/interaction.js, tests/furniture-reposition.test.js (neu)

## 2026-09-25
- Bug-Fix: In mobilen Browsern (v. a. wenn Adressleiste/Navigationsleiste sichtbar sind) war die untere Toolbar (Messen/Möbel/Türen/Raum, Undo/Redo) nicht sichtbar bzw. lag außerhalb des sichtbaren Bereichs. Ursache: `height: 100vh` bezieht sich auf die *Layout*-Viewport-Höhe, die größer sein kann als der tatsächlich sichtbare Bereich, wenn mobiles Browser-Chrome (Adressleiste, Navigationsleiste) eingeblendet ist - das schob die per Flexbox unten angeordnete Toolbar unter den sichtbaren Fold. `#editorView` und `.compare-view` nutzen jetzt `height: 100dvh` (mit `100vh`-Fallback für ältere Browser ohne `dvh`-Unterstützung), das die tatsächlich sichtbare Viewport-Höhe berücksichtigt.
- Dateien: style.css
