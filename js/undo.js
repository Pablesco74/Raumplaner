// ---------- Undo / Redo (AUFGABE 4) ----------
// Vollständige Store-Snapshots, max 50 Einträge, Ctrl+Z / Ctrl+Y,
// nur Session (nicht in localStorage gespeichert).

const UNDO_MAX = 50;
const undoStack = [];
let redoStack = [];

let _undoSuppress = false; // unterdrückt Snapshots während undo/redo

// Zustand nach der zuletzt abgeschlossenen Aktion (bzw. nach dem letzten
// undo/redo) - die Basislinie, die beim NÄCHSTEN saveStoreNow() auf den
// Undo-Stack gepusht wird. saveStoreNow() wird immer NACH einer Mutation
// aufgerufen; ein Snapshot des dann schon veränderten store wäre also
// bereits der neue (Post-Aktion-)Zustand - ein Undo-Klick würde dann nur
// genau diesen (identischen) Zustand zurückschreiben und sichtbar nichts
// bewirken, erst der ZWEITE Klick hätte einen Effekt. _lastSnapshot hält
// stattdessen den Zustand VOR der jeweils nächsten Aktion vor, damit der
// erste Undo-Klick bereits die zuletzt abgeschlossene Aktion rückgängig
// macht.
let _lastSnapshot = null;

function updateUndoButtons() {
  var empty = undoStack.length === 0;
  var noRedo = redoStack.length === 0;
  ["undoBtn", "undoBtnBar"].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.disabled = empty;
  });
  ["redoBtn", "redoBtnBar"].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.disabled = noRedo;
  });
}

function undoSnapshot() {
  if (_undoSuppress) return;
  if (_lastSnapshot !== null) {
    undoStack.push(_lastSnapshot);
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    // Jede neue Aktion löscht den Redo-Stack
    redoStack = [];
  }
  _lastSnapshot = JSON.stringify(store);
  updateUndoButtons();
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
  updateUndoButtons();
}

function undo() {
  if (undoStack.length === 0) return;
  const prev = undoStack.pop();
  // Aktuell bekannter Zustand wandert auf den Redo-Stack
  if (_lastSnapshot !== null) redoStack.push(_lastSnapshot);
  _lastSnapshot = prev;
  undoApply(prev);
}

function redo() {
  if (redoStack.length === 0) return;
  const next = redoStack.pop();
  if (_lastSnapshot !== null) undoStack.push(_lastSnapshot);
  _lastSnapshot = next;
  undoApply(next);
}

// Button-Klicks
document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("redoBtn").addEventListener("click", redo);

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
