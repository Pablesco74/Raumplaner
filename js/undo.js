// ---------- Undo / Redo (AUFGABE 4) ----------
// Vollständige Store-Snapshots, max 50 Einträge, Ctrl+Z / Ctrl+Y,
// nur Session (nicht in localStorage gespeichert).

const UNDO_MAX = 50;
const undoStack = [];
let redoStack = [];

let _undoSuppress = false; // unterdrückt Snapshots während undo/redo

function undoSnapshot() {
  if (_undoSuppress) return;
  // Vollständigen Store-Zustand als JSON-String speichern
  undoStack.push(JSON.stringify(store));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  // Jede neue Aktion löscht den Redo-Stack
  redoStack = [];
}

// Hook in saveStoreNow() registrieren
_undoHook = undoSnapshot;

function undoApply(json) {
  const restored = JSON.parse(json);
  // Store-Referenz überschreiben
  store = restored;
  // UI-Selektion zurücksetzen
  selectedId = null;
  selectedOpeningId = null;
  camera = { scale: 1, x: 0, y: 0 };
  // Snapshot-Hook unterdrücken während der Wiederherstellung
  _undoSuppress = true;
  // UI komplett neu aufbauen
  if (document.getElementById("editorView").style.display !== "none") {
    fullRefresh();
  } else {
    renderLandingProjects();
  }
  // localStorage aktualisieren (damit der Zustand konsistent ist)
  saveStoreNow();
  _undoSuppress = false;
}

function undo() {
  if (undoStack.length === 0) return;
  // Aktuellen Zustand auf Redo-Stack
  redoStack.push(JSON.stringify(store));
  const prev = undoStack.pop();
  undoApply(prev);
}

function redo() {
  if (redoStack.length === 0) return;
  // Aktuellen Zustand auf Undo-Stack (ohne Redo zu löschen)
  undoStack.push(JSON.stringify(store));
  const next = redoStack.pop();
  undoApply(next);
}

// Keyboard-Shortcuts
document.addEventListener("keydown", (evt) => {
  // Nicht reagieren, wenn ein Input/Textarea/contentEditable fokussiert ist
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement && document.activeElement.contentEditable === "true")) return;

  if ((evt.ctrlKey || evt.metaKey) && !evt.shiftKey && evt.key === "z") {
    evt.preventDefault();
    undo();
  } else if ((evt.ctrlKey || evt.metaKey) && (evt.key === "y" || (evt.shiftKey && evt.key === "Z"))) {
    evt.preventDefault();
    redo();
  }
});
