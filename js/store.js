// ---------- Projekt/Raum-Datenmodell + localStorage ----------
  function makeVariant(name) {
    return { id: 1, name: name || "Variante 1", items: [], floorType: "raster", nextId: 1, nextColor: 0 };
  }
  function makeRoom(name, floor) {
    const w = 400, d = 300;
    const v = makeVariant("Variante 1");
    return {
      id: store.nextRoomId++,
      name: name || "Neuer Raum",
      room: { w, d },
      shape: shapeFromRect(w, d),
      nextWallId: 5,
      items: v.items,
      openings: [],
      nextId: v.nextId,
      nextOpeningId: 1,
      nextColor: v.nextColor,
      floorType: v.floorType,
      floor: floor || 0,
      variants: [v],
      currentVariantIdx: 0,
      nextVariantId: 2
    };
  }

  function ensureVariants(room) {
    if (room.variants && room.variants.length > 0) return;
    room.variants = [{
      id: 1,
      name: "Variante 1",
      items: room.items,
      floorType: room.floorType,
      nextId: room.nextId,
      nextColor: room.nextColor
    }];
    room.currentVariantIdx = 0;
    room.nextVariantId = 2;
  }

  function saveCurrentVariant(room) {
    ensureVariants(room);
    var v = room.variants[room.currentVariantIdx || 0];
    if (!v) return;
    v.items = room.items;
    v.floorType = room.floorType;
    v.nextId = room.nextId;
    v.nextColor = room.nextColor;
  }

  function loadVariant(room, idx) {
    ensureVariants(room);
    if (idx < 0 || idx >= room.variants.length) return;
    saveCurrentVariant(room);
    room.currentVariantIdx = idx;
    var v = room.variants[idx];
    room.items = v.items;
    room.floorType = v.floorType;
    room.nextId = v.nextId;
    room.nextColor = v.nextColor;
  }

  function addVariant(room, name) {
    ensureVariants(room);
    saveCurrentVariant(room);
    var newId = room.nextVariantId || (Math.max(0, ...room.variants.map(function(v){return v.id;})) + 1);
    room.nextVariantId = newId + 1;
    var v = { id: newId, name: name || ("Variante " + (room.variants.length + 1)), items: [], floorType: room.floorType, nextId: 1, nextColor: 0 };
    room.variants.push(v);
    loadVariant(room, room.variants.length - 1);
    return v;
  }

  function duplicateVariant(room) {
    ensureVariants(room);
    saveCurrentVariant(room);
    var src = room.variants[room.currentVariantIdx || 0];
    var newId = room.nextVariantId || (Math.max(0, ...room.variants.map(function(v){return v.id;})) + 1);
    room.nextVariantId = newId + 1;
    var v = {
      id: newId,
      name: src.name + " (Kopie)",
      items: JSON.parse(JSON.stringify(src.items)),
      floorType: src.floorType,
      nextId: src.nextId,
      nextColor: src.nextColor
    };
    room.variants.push(v);
    loadVariant(room, room.variants.length - 1);
    return v;
  }

  function deleteVariant(room, idx) {
    ensureVariants(room);
    if (room.variants.length <= 1) return false;
    room.variants.splice(idx, 1);
    if (room.currentVariantIdx >= room.variants.length) room.currentVariantIdx = room.variants.length - 1;
    loadVariant(room, room.currentVariantIdx);
    return true;
  }

  function floorLabel(n) {
    if (n === 0) return "EG";
    if (n < 0) return (n === -1) ? "UG" : `${Math.abs(n)}. UG`;
    return `${n}. OG`;
  }
  function makeProject(name) {
    const room = makeRoom("Raum 1");
    return { id: store.nextProjectId++, name: name || "Neues Projekt", rooms: [room] };
  }

  const LS_KEY = "raumplaner_store";

  // ---------- localStorage Speichern / Laden ----------
  let _saveTimer = null;
  function syncAllVariants() {
    store.projects.forEach(function(p) {
      p.rooms.forEach(function(r) { if (r.variants) saveCurrentVariant(r); });
    });
  }
  function saveStore() {
    if (_saveTimer) return;
    _saveTimer = setTimeout(() => {
      _saveTimer = null;
      syncAllVariants();
      try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch (e) {}
    }, 200);
  }
  let _undoHook = null;
  function saveStoreNow() {
    if (_undoHook) _undoHook();
    if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
    syncAllVariants();
    try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch (e) {}
  }
  function loadRawStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* beschädigtes JSON */ }
    return null;
  }
  function exportStoreAsFile() {
    const json = JSON.stringify(store, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "raumplaner-export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  let store = { projects: [], currentProjectId: null, currentRoomId: null, nextProjectId: 1, nextRoomId: 1, schemaVersion: SCHEMA_VERSION };
  (function bootstrap() {
    let raw = loadRawStore();

    if (raw) {
      // Grundstruktur prüfen
      if (!raw.projects || !Array.isArray(raw.projects) || raw.projects.length === 0) {
        showMigrationError(
          "Die gespeicherten Daten sind beschädigt oder unvollständig " +
          "(kein gültiges Projekt-Array gefunden). Du kannst die Rohdaten " +
          "als Backup exportieren oder alles löschen und neu anfangen.",
          raw
        );
        return;
      }
      // Migration anwenden
      try {
        raw = migrateStore(raw);
      } catch (e) {
        showMigrationError(
          "Die gespeicherten Daten konnten nicht migriert werden: " +
          e.message + " Du kannst die Rohdaten als Backup exportieren " +
          "oder alles löschen und neu anfangen.",
          raw
        );
        return;
      }
      store = raw;
      // Shapes für alle geladenen Räume sicherstellen (Kompatibilität)
      store.projects.forEach(p => {
        p.rooms.forEach(r => {
          ensureShape(r);
          if (!r.nextWallId) r.nextWallId = Math.max(5, ...r.shape.wallIds) + 1;
          ensureVariants(r);
        });
      });
      // Sicherstellen, dass aktuelle IDs gültig sind
      if (!store.currentProjectId || !store.projects.find(p => p.id === store.currentProjectId)) {
        store.currentProjectId = store.projects[0].id;
      }
      ensureCurrentRoom();
      // Migrierte Daten (mit aktueller schemaVersion) sofort zurückschreiben
      saveStoreNow();
    } else {
      // Kein gespeicherter Stand — frisch starten
      const room = makeRoom("Wohnzimmer");
      const project = makeProject("Meine Wohnung");
      project.rooms = [room];
      store.projects = [project];
      store.currentProjectId = project.id;
      store.currentRoomId = room.id;
      saveStoreNow();
    }
  })();

  function currentProject() { return store.projects.find(p => p.id === store.currentProjectId); }
  function currentRoom() {
    const p = currentProject();
    return p ? p.rooms.find(r => r.id === store.currentRoomId) : null;
  }
  function ensureCurrentRoom() {
    const p = currentProject();
    if (!p) return;
    if (!p.rooms.find(r => r.id === store.currentRoomId)) {
      if (p.rooms.length === 0) {
        const r = makeRoom("Raum 1");
        p.rooms.push(r);
        store.currentRoomId = r.id;
      } else {
        store.currentRoomId = p.rooms[0].id;
      }
    }
  }
