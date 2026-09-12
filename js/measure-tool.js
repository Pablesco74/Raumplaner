// ---------- Freies Messwerkzeug (AUFGABE 3) ----------
// Toggle-Modus: Klick-zu-Klick-Messlinien, Snap an Ecken, mehrere
// Messungen, Antippen zum Löschen, nicht gespeichert, deaktiviert Möbel-Drag.

let measureToolActive = false;
let measureToolPending = null; // erster Klickpunkt (oder null)
const measureToolLines = [];   // [{p1, p2, id}]
let measureToolNextId = 1;

const MEASURE_SNAP_DIST = 12; // Pixel in SVG-Koordinaten

function measureToolSnapPoints() {
  const R = currentRoom();
  if (!R) return [];
  const { w, d } = R.room;
  // Raumecken
  const pts = [
    { x: 0, y: 0 }, { x: w, y: 0 },
    { x: w, y: d }, { x: 0, y: d }
  ];
  // Möbelecken (nach Rotation = AABB-Ecken)
  R.items.forEach(item => {
    const box = getAABB(item);
    pts.push(
      { x: box.minX, y: box.minY }, { x: box.maxX, y: box.minY },
      { x: box.maxX, y: box.maxY }, { x: box.minX, y: box.maxY }
    );
  });
  // Öffnungs-Endpunkte
  R.openings.forEach(o => {
    const { geom, s0, s1 } = openingSpan(o, R.room);
    pts.push(pointAt(geom, s0));
    pts.push(pointAt(geom, s1));
  });
  return pts;
}

function measureToolSnap(raw) {
  const pts = measureToolSnapPoints();
  let best = null, bestDist = MEASURE_SNAP_DIST;
  for (const p of pts) {
    const dist = Math.hypot(p.x - raw.x, p.y - raw.y);
    if (dist < bestDist) { bestDist = dist; best = p; }
  }
  return best || { x: Math.round(raw.x), y: Math.round(raw.y) };
}

function renderMeasureToolLines() {
  let group = svg.querySelector("#measureToolGroup");
  if (!group) {
    group = document.createElementNS(NS, "g");
    group.id = "measureToolGroup";
    svg.appendChild(group);
  }
  let s = "";
  measureToolLines.forEach(line => {
    const dist = Math.hypot(line.p2.x - line.p1.x, line.p2.y - line.p1.y);
    const mx = (line.p1.x + line.p2.x) / 2;
    const my = (line.p1.y + line.p2.y) / 2;
    s += `<g class="measure-tool-line" data-mtid="${line.id}" style="cursor:pointer">
      <line x1="${line.p1.x}" y1="${line.p1.y}" x2="${line.p2.x}" y2="${line.p2.y}"
            stroke="#E8A33D" stroke-width="1.5" stroke-dasharray="5 3"/>
      <circle cx="${line.p1.x}" cy="${line.p1.y}" r="3" fill="#E8A33D"/>
      <circle cx="${line.p2.x}" cy="${line.p2.y}" r="3" fill="#E8A33D"/>
      <rect x="${mx - 20}" y="${my - 9}" width="40" height="18" rx="3"
            fill="#FFFFFF" stroke="#E8A33D" stroke-width="0.8"/>
      <text x="${mx}" y="${my + 3.5}" text-anchor="middle" font-size="10"
            fill="#E8A33D" font-family="Courier New, monospace" font-weight="600">${Math.round(dist)}</text>
    </g>`;
  });
  // Zeige den Pending-Punkt
  if (measureToolPending) {
    s += `<circle cx="${measureToolPending.x}" cy="${measureToolPending.y}" r="4" fill="#E8A33D" opacity="0.7"/>`;
  }
  group.innerHTML = s;

  // Klick zum Löschen
  group.querySelectorAll("[data-mtid]").forEach(g => {
    g.addEventListener("pointerdown", (evt) => {
      evt.stopPropagation();
      const id = Number(g.dataset.mtid);
      const idx = measureToolLines.findIndex(l => l.id === id);
      if (idx >= 0) measureToolLines.splice(idx, 1);
      renderMeasureToolLines();
    });
  });
}

function measureToolClick(evt) {
  if (!measureToolActive) return;
  const raw = svgPoint(evt);
  const pt = measureToolSnap(raw);

  if (!measureToolPending) {
    measureToolPending = pt;
  } else {
    // Zweiter Klick → Linie fertigstellen
    if (Math.hypot(pt.x - measureToolPending.x, pt.y - measureToolPending.y) > 1) {
      measureToolLines.push({ p1: measureToolPending, p2: pt, id: measureToolNextId++ });
    }
    measureToolPending = null;
  }
  renderMeasureToolLines();
}

function toggleMeasureTool() {
  measureToolActive = !measureToolActive;
  measureToolPending = null;

  // Toggle-Button visuell aktualisieren
  const btn = document.getElementById("measureToolBtn");
  if (btn) {
    btn.classList.toggle("active", measureToolActive);
    btn.title = measureToolActive ? "Messwerkzeug deaktivieren" : "Messwerkzeug aktivieren";
  }

  // Cursor
  svg.style.cursor = measureToolActive ? "crosshair" : "";

  // Bei Deaktivierung: Linien bleiben, aber Pending wird gelöscht
  renderMeasureToolLines();
}

// Wird beim Raumwechsel aufgerufen, um transiente Messlinien zu löschen
function clearMeasureToolLines() {
  measureToolLines.length = 0;
  measureToolPending = null;
  renderMeasureToolLines();
}
