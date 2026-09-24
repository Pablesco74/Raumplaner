// ---------- Globale Konstanten + Hilfsfunktionen ----------
const palette = [
    { fill: "#E8A33D", text: "#4A2E06" },
    { fill: "#5DCAA5", text: "#04342C" },
    { fill: "#F0997B", text: "#4A1B0C" },
    { fill: "#ED93B1", text: "#4B1528" },
    { fill: "#85B7EB", text: "#042C53" },
    { fill: "#C0DD97", text: "#173404" }
  ];

  const NS = "http://www.w3.org/2000/svg";
  const WALL_T = 12;   // Wandstärke in cm
  const SNAP = 15;     // Andock-Bereich in cm
  let selectedId = null; // UI-only, nicht Teil der gespeicherten Struktur
  let selectedOpeningId = null; // UI-only, ausgewählte Tür/Fenster
  let shapeEditMode = "numbers"; // UI-only, "numbers" | "drag" - Umschalter im Raum-Tab (Aufgabe 5)

  function escapeXml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
