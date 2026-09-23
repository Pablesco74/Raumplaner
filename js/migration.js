// ---------- Schema-Versionierung + Migration ----------
// Wird VOR store.js geladen. Definiert die aktuelle Schemaversion,
// die Migrationskette und die Fehlerbehandlung für beschädigte Daten.

const SCHEMA_VERSION = 4;
let _migrationFailed = false;

// Migrationskette: jede Funktion transformiert Version N → N+1.
// Neue Migrationen einfach als nächsten Eintrag ergänzen, ohne
// bestehende Schritte anzufassen.
const MIGRATIONS = {
  // Version 1 → 2: floor-Feld an jedem Raum (Aufgabe 5)
  1: function(data) {
    if (data.projects) {
      data.projects.forEach(function(p) {
        if (p.rooms) {
          p.rooms.forEach(function(r) {
            if (r.floor == null) r.floor = 0;
          });
        }
      });
    }
    data.schemaVersion = 2;
    return data;
  },
  // Version 2 → 3: Openings: wall/corner/dist/hinge → wallId/pos/hingeAtStart
  2: function(data) {
    var wallMap = { top: 0, right: 1, bottom: 2, left: 3 };
    var wallCorners = {
      top:    { corners: ["links", "rechts"], startIsFirst: true },
      right:  { corners: ["oben", "unten"],   startIsFirst: true },
      bottom: { corners: ["links", "rechts"], startIsFirst: false },
      left:   { corners: ["oben", "unten"],   startIsFirst: false }
    };
    if (data.projects) {
      data.projects.forEach(function(p) {
        if (p.rooms) {
          p.rooms.forEach(function(r) {
            if (!r.shape) {
              var w = r.room ? r.room.w : 400;
              var d = r.room ? r.room.d : 300;
              r.shape = {
                vertices: [{x:0,y:0},{x:w,y:0},{x:w,y:d},{x:0,y:d}],
                wallIds: [1,2,3,4]
              };
            }
            if (!r.nextWallId) {
              var maxId = 4;
              for (var k = 0; k < r.shape.wallIds.length; k++) {
                if (r.shape.wallIds[k] > maxId) maxId = r.shape.wallIds[k];
              }
              r.nextWallId = maxId + 1;
            }
            if (r.openings) {
              r.openings = r.openings.map(function(o) {
                if (o.wallId != null) return o;
                var wallName = o.wall || "top";
                var wallIdx = wallMap[wallName];
                if (wallIdx == null) wallIdx = 0;
                var wallId = r.shape.wallIds[wallIdx];
                var v = r.shape.vertices;
                var n = v.length;
                var start = v[wallIdx];
                var end = v[(wallIdx + 1) % n];
                var segLength = Math.hypot(end.x - start.x, end.y - start.y);
                var wc = wallCorners[wallName] || wallCorners.top;
                var corner = o.corner || wc.corners[0];
                var dist = o.dist || 0;
                var isFirst = (corner === wc.corners[0]);
                var isAtStart = wc.startIsFirst ? isFirst : !isFirst;
                var pos = isAtStart ? dist : segLength - dist - o.width;
                var hinge = o.hinge || corner;
                var hingeIsFirst = (hinge === wc.corners[0]);
                var hingeAtStart = wc.startIsFirst ? hingeIsFirst : !hingeIsFirst;
                return {
                  id: o.id,
                  wallId: wallId,
                  type: o.type,
                  width: o.width,
                  pos: pos,
                  hingeAtStart: hingeAtStart
                };
              });
            }
          });
        }
      });
    }
    data.schemaVersion = 3;
    return data;
  },
  // Version 3 → 4: Variant system + polygon shape consolidation
  3: function(data) {
    if (data.projects) {
      data.projects.forEach(function(p) {
        if (p.rooms) {
          p.rooms.forEach(function(r) {
            if (!r.shape) {
              var w = r.room ? r.room.w : 400;
              var d = r.room ? r.room.d : 300;
              r.shape = {
                vertices: [{x:0,y:0},{x:w,y:0},{x:w,y:d},{x:0,y:d}],
                wallIds: [1,2,3,4]
              };
            }
            if (!r.nextWallId) {
              var maxId = 4;
              for (var k = 0; k < r.shape.wallIds.length; k++) {
                if (r.shape.wallIds[k] > maxId) maxId = r.shape.wallIds[k];
              }
              r.nextWallId = maxId + 1;
            }
            if (!r.variants || r.variants.length === 0) {
              r.variants = [{
                id: 1,
                name: "Variante 1",
                items: r.items || [],
                floorType: r.floorType || "raster",
                nextId: r.nextId || 1,
                nextColor: r.nextColor || 0
              }];
              r.currentVariantIdx = 0;
              r.nextVariantId = 2;
            }
          });
        }
      });
    }
    data.schemaVersion = 4;
    return data;
  }
};

/**
 * Wendet alle nötigen Migrationsschritte auf die Daten an.
 * Wirft bei fehlenden Migrationen oder Zukunftsversionen einen Fehler.
 */
function migrateStore(data) {
  var version = data.schemaVersion || 1;

  // Bereits aktuell
  if (version === SCHEMA_VERSION) return data;

  // Zukunftsversion – nicht downgraden
  if (version > SCHEMA_VERSION) {
    throw new Error(
      "Die Daten haben Version " + version + ", die App kennt nur bis " +
      "Version " + SCHEMA_VERSION + ". Bitte aktualisiere die App."
    );
  }

  // Kette durchlaufen
  while (version < SCHEMA_VERSION) {
    var fn = MIGRATIONS[version];
    if (!fn) {
      throw new Error(
        "Keine Migration von Version " + version + " → " + (version + 1) + " vorhanden."
      );
    }
    data = fn(data);
    version = data.schemaVersion;
  }

  return data;
}

// ---------- Fehleranzeige bei beschädigten Daten ----------
var _brokenData = null;

function showMigrationError(msg, rawData) {
  _migrationFailed = true;
  _brokenData = rawData;

  // Normale Views ausblenden
  var landing = document.getElementById("landingView");
  var editor = document.getElementById("editorView");
  var toggle = document.getElementById("drawerToggle");
  if (landing) landing.style.display = "none";
  if (editor) editor.style.display = "none";
  if (toggle) toggle.style.display = "none";

  // Fehlerview zeigen
  var errView = document.getElementById("migrationError");
  if (errView) {
    errView.style.display = "block";
    var msgEl = document.getElementById("migrationErrorMsg");
    if (msgEl) msgEl.textContent = msg;
  }

  // Buttons verdrahten
  var exportBtn = document.getElementById("migrationExportBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportBrokenData);

  var resetBtn = document.getElementById("migrationResetBtn");
  if (resetBtn) resetBtn.addEventListener("click", function() {
    if (confirm("Alle gespeicherten Daten werden unwiderruflich gelöscht. Fortfahren?")) {
      resetAndRestart();
    }
  });
}

function exportBrokenData() {
  var data = _brokenData || {};
  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "raumplaner-backup.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function resetAndRestart() {
  loescheGespeichertenStore();
  location.reload();
}
