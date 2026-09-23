// ---------- Zentrales Speicher-Modul ----------
  // Einziger Ort im Code, der direkt mit localStorage spricht. Der Rest der
  // App (store.js, migration.js) läuft ausschließlich über die Funktionen
  // hier. Bei einem späteren Wechsel auf eine andere Speicher-Technologie
  // (z.B. IndexedDB) muss nur diese Datei angepasst werden.
  //
  // Es gibt aktuell keine pro-Projekt-Ablage: der komplette Store (alle
  // Projekte, aktuelle Auswahl, nextIds, schemaVersion) wird als ein JSON-
  // Objekt unter einem einzigen Key gespeichert.

  const STORAGE_KEY = "raumplaner_store";

  /** Lädt den kompletten gespeicherten Store (inkl. schemaVersion). Gibt null zurück, wenn nichts gespeichert ist oder das JSON beschädigt ist. */
  function ladeGespeichertenStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* beschädigtes JSON */ }
    return null;
  }

  /** Speichert den kompletten Store (inkl. schemaVersion) synchron. */
  function speichereStore(storeData) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(storeData)); } catch (e) {}
  }

  /** Löscht den gespeicherten Store vollständig (z.B. beim Reset nach beschädigten Daten). */
  function loescheGespeichertenStore() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }
