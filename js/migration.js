// ---------- Schema-Versionierung + Migration ----------
// Wird VOR store.js geladen. Definiert die aktuelle Schemaversion,
// die Migrationskette und die Fehlerbehandlung für beschädigte Daten.

const SCHEMA_VERSION = 2;
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
  }
  // Zukünftige Migrationen hier ergänzen:
  // 2: function(data) { ...; data.schemaVersion = 3; return data; },
  // 3: function(data) { ...; data.schemaVersion = 4; return data; },
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
  try { localStorage.removeItem("raumplaner_store"); } catch(e) {}
  location.reload();
}
