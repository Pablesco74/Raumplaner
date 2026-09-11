// ---------- Projekt/Raum-Datenmodell + localStorage ----------
  function makeRoom(name) {
    return {
      id: store.nextRoomId++,
      name: name || "Neuer Raum",
      room: { w: 400, d: 300 },
      items: [],
      openings: [],
      nextId: 1,
      nextOpeningId: 1,
      nextColor: 0,
      floorType: "raster"
    };
  }
  function makeProject(name) {
    const room = makeRoom("Raum 1");
    return { id: store.nextProjectId++, name: name || "Neues Projekt", rooms: [room] };
  }

  const LS_KEY = "raumplaner_store";

  // ---------- localStorage Speichern / Laden ----------
  let _saveTimer = null;
  function saveStore() {
    // Debounced: bei schnellen Änderungen (Drag) nicht jeden Frame schreiben
    if (_saveTimer) return;
    _saveTimer = setTimeout(() => {
      _saveTimer = null;
      try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch (e) { /* quota o. Ä. – stille Fehler */ }
    }, 200);
  }
  function saveStoreNow() {
    if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
    try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch (e) { /* stille Fehler */ }
  }
  function loadStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
          return parsed;
        }
      }
    } catch (e) { /* beschädigte Daten – Fallback auf Default */ }
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

  let store = { projects: [], currentProjectId: null, currentRoomId: null, nextProjectId: 1, nextRoomId: 1 };
  (function bootstrap() {
    const saved = loadStore();
    if (saved) {
      store = saved;
      // Sicherstellen, dass aktuelle IDs gültig sind
      if (!store.currentProjectId || !store.projects.find(p => p.id === store.currentProjectId)) {
        store.currentProjectId = store.projects[0].id;
      }
      ensureCurrentRoom();
    } else {
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
