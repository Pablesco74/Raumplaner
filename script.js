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

  // ---------- Projekt/Raum-Datenmodell ----------
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

  let store = { projects: [], currentProjectId: null, currentRoomId: null, nextProjectId: 1, nextRoomId: 1 };
  (function bootstrap() {
    const room = makeRoom("Wohnzimmer");
    const project = makeProject("Meine Wohnung");
    project.rooms = [room];
    store.projects = [project];
    store.currentProjectId = project.id;
    store.currentRoomId = room.id;
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

  const svg = document.getElementById("plan");
  const canvasWrap = document.querySelector(".canvas-wrap");
  const listEl = document.getElementById("furnitureList");
  const openingListEl = document.getElementById("openingList");

  function svgPoint(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM().inverse();
    return pt.matrixTransform(ctm);
  }

  function escapeXml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ---------- floor ----------
  function pickGridStep(maxDim) {
    const steps = [10, 20, 25, 50, 100, 200, 250, 500, 1000];
    for (const s of steps) { if (maxDim / s <= 12) return s; }
    return 1000;
  }
  function gridFloorSvg(w, d) {
    const step = pickGridStep(Math.max(w, d));
    let s = "";
    for (let gx = 0; gx <= w; gx += step) {
      s += `<line x1="${gx}" y1="0" x2="${gx}" y2="${d}" stroke="#DCE4EE" stroke-width="0.7"/>`;
    }
    for (let gy = 0; gy <= d; gy += step) {
      s += `<line x1="0" y1="${gy}" x2="${w}" y2="${gy}" stroke="#DCE4EE" stroke-width="0.7"/>`;
    }
    return s;
  }
  function woodFloorSvg(w, d) {
    const plankH = 20, plankLen = 100;
    let s = `<rect x="0" y="0" width="${w}" height="${d}" fill="#C7996E"/>`;
    let row = 0;
    for (let y = 0; y < d; y += plankH, row++) {
      const rowH = Math.min(plankH, d - y);
      s += `<line x1="0" y1="${y + rowH}" x2="${w}" y2="${y + rowH}" stroke="#9C7148" stroke-width="0.8"/>`;
      const offset = (row % 2 === 0) ? 0 : plankLen / 2;
      for (let x = offset; x < w; x += plankLen) {
        s += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + rowH}" stroke="#9C7148" stroke-width="0.6"/>`;
      }
    }
    return s;
  }
  function tileFloorSvg(w, d) {
    const tile = 40;
    let s = `<rect x="0" y="0" width="${w}" height="${d}" fill="#DCE1DA"/>`;
    for (let x = 0; x <= w; x += tile) s += `<line x1="${x}" y1="0" x2="${x}" y2="${d}" stroke="#AEB8AC" stroke-width="0.8"/>`;
    for (let y = 0; y <= d; y += tile) s += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#AEB8AC" stroke-width="0.8"/>`;
    return s;
  }
  function carpetFloorSvg(w, d) {
    const m = Math.min(w, d) * 0.06 + 8;
    let s = `<rect x="0" y="0" width="${w}" height="${d}" fill="#5B3A34"/>`;
    s += `<rect x="${m}" y="${m}" width="${Math.max(w - 2 * m, 0)}" height="${Math.max(d - 2 * m, 0)}" fill="none" stroke="#8A6A5E" stroke-width="1.5" stroke-dasharray="2 3" rx="4"/>`;
    return s;
  }
  function floorSvg(w, d, floorType) {
    switch (floorType) {
      case "holz": return woodFloorSvg(w, d);
      case "fliese": return tileFloorSvg(w, d);
      case "teppich": return carpetFloorSvg(w, d);
      case "leer": return "";
      default: return gridFloorSvg(w, d);
    }
  }

  // ---------- wall geometry (dims = {w,d}) ----------
  function wallGeometry(wall, dims) {
    const { w, d } = dims;
    switch (wall) {
      case "top":    return { start: {x:0,y:0}, end: {x:w,y:0}, tangent:{x:1,y:0}, normal:{x:0,y:1}, length:w, corners:["links","rechts"] };
      case "bottom": return { start: {x:0,y:d}, end: {x:w,y:d}, tangent:{x:1,y:0}, normal:{x:0,y:-1}, length:w, corners:["links","rechts"] };
      case "left":   return { start: {x:0,y:0}, end: {x:0,y:d}, tangent:{x:0,y:1}, normal:{x:1,y:0}, length:d, corners:["oben","unten"] };
      case "right":  return { start: {x:w,y:0}, end: {x:w,y:d}, tangent:{x:0,y:1}, normal:{x:-1,y:0}, length:d, corners:["oben","unten"] };
    }
  }
  function pointAt(geom, s) { return { x: geom.start.x + geom.tangent.x * s, y: geom.start.y + geom.tangent.y * s }; }

  function openingSpan(opening, dims) {
    const geom = wallGeometry(opening.wall, dims);
    let s0, s1;
    if (opening.corner === geom.corners[0]) { s0 = opening.dist; s1 = s0 + opening.width; }
    else { s1 = geom.length - opening.dist; s0 = s1 - opening.width; }
    return { geom, s0, s1 };
  }

  function arcSweepFlag(center, p1, p2) {
    const a = { x: p1.x - center.x, y: p1.y - center.y };
    const b = { x: p2.x - center.x, y: p2.y - center.y };
    return (a.x * b.y - a.y * b.x) > 0 ? 1 : 0;
  }
  function leafAndArcSvg(hinge, other, normal, width, color) {
    const openEnd = { x: hinge.x + normal.x * width, y: hinge.y + normal.y * width };
    const sweep = arcSweepFlag(hinge, openEnd, other);
    return `
      <line x1="${hinge.x}" y1="${hinge.y}" x2="${openEnd.x}" y2="${openEnd.y}" stroke="${color}" stroke-width="1.5"/>
      <path d="M ${openEnd.x} ${openEnd.y} A ${width} ${width} 0 0 ${sweep} ${other.x} ${other.y}" stroke="${color}" stroke-width="1" stroke-dasharray="4 3" fill="none"/>
    `;
  }
  function jambTick(geom, s) {
    const p = pointAt(geom, s);
    const p2 = { x: p.x - geom.normal.x * WALL_T, y: p.y - geom.normal.y * WALL_T };
    return `<line x1="${p.x}" y1="${p.y}" x2="${p2.x}" y2="${p2.y}" stroke="#FFFFFF" stroke-width="1.5"/>`;
  }
  function wallBandRect(wall, s0, s1, dims) {
    const { w, d } = dims;
    switch (wall) {
      case "top":    return { x: s0, y: -WALL_T, width: s1 - s0, height: WALL_T };
      case "bottom": return { x: s0, y: d, width: s1 - s0, height: WALL_T };
      case "left":   return { x: -WALL_T, y: s0, width: WALL_T, height: s1 - s0 };
      case "right":  return { x: w, y: s0, width: WALL_T, height: s1 - s0 };
    }
  }
  function openingSvg(opening, dims) {
    const { geom, s0, s1 } = openingSpan(opening, dims);
    const P0 = pointAt(geom, s0);
    const P1 = pointAt(geom, s1);
    const color = opening.type === "door" ? "#1B4E8F" : "#2F80C8";
    let out = jambTick(geom, s0) + jambTick(geom, s1);
    if (opening.type === "window-double") {
      const sm = (s0 + s1) / 2;
      const Pm = pointAt(geom, sm);
      const halfW = (s1 - s0) / 2;
      out += jambTick(geom, sm);
      out += leafAndArcSvg(P0, Pm, geom.normal, halfW, color);
      out += leafAndArcSvg(P1, Pm, geom.normal, halfW, color);
    } else {
      const hinge = opening.hinge === geom.corners[0] ? P0 : P1;
      const other = opening.hinge === geom.corners[0] ? P1 : P0;
      out += leafAndArcSvg(hinge, other, geom.normal, s1 - s0, color);
    }
    return out;
  }
  function wallsSvg(R) {
    const dims = R.room;
    const { w, d } = dims;
    let out = `<path d="M ${-WALL_T} ${-WALL_T} H ${w + WALL_T} V ${d + WALL_T} H ${-WALL_T} Z
                       M 0 0 H ${w} V ${d} H 0 Z" fill="#1F3A5C" fill-rule="evenodd"/>`;
    ["top", "right", "bottom", "left"].forEach(wall => {
      R.openings.filter(o => o.wall === wall).forEach(o => {
        const { s0, s1 } = openingSpan(o, dims);
        const r = wallBandRect(wall, s0, s1, dims);
        out += `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="#FFFFFF"/>`;
      });
    });
    return out;
  }
  function openingFits(o, dims) {
    const geom = wallGeometry(o.wall, dims);
    return o.dist >= 0 && o.width > 0 && o.dist + o.width <= geom.length;
  }
  function openingHitRect(opening, dims) {
    const { s0, s1 } = openingSpan(opening, dims);
    const band = wallBandRect(opening.wall, s0, s1, dims);
    const margin = 22;
    switch (opening.wall) {
      case "top":    return { x: band.x, y: band.y, width: band.width, height: band.height + margin };
      case "bottom": return { x: band.x, y: band.y - margin, width: band.width, height: band.height + margin };
      case "left":   return { x: band.x, y: band.y, width: band.width + margin, height: band.height };
      case "right":  return { x: band.x - margin, y: band.y, width: band.width + margin, height: band.height };
    }
  }
  function openingGroupInner(opening, dims) {
    const selected = opening.id === selectedOpeningId;
    const hit = openingHitRect(opening, dims);
    let s = `<rect x="${hit.x}" y="${hit.y}" width="${hit.width}" height="${hit.height}" fill="transparent" pointer-events="all"/>`;
    if (selected) {
      const { s0, s1 } = openingSpan(opening, dims);
      const band = wallBandRect(opening.wall, s0, s1, dims);
      s += `<rect x="${band.x - 2}" y="${band.y - 2}" width="${band.width + 4}" height="${band.height + 4}" fill="none" stroke="#1B4E8F" stroke-width="1.5" stroke-dasharray="3 2" rx="2"/>`;
    }
    s += openingSvg(opening, dims);
    return s;
  }
  function refreshOpeningVisual(o) {
    const R = currentRoom();
    if (!R) return;
    const g = svg.querySelector(`g[data-opening-id="${o.id}"]`);
    if (g) g.innerHTML = openingGroupInner(o, R.room);
  }

  // ---------- furniture recognition + illustration ----------
  function recognizeFurnitureType(name) {
    const n = name.toLowerCase();
    if (/bett/.test(n)) return "bed";
    if (/(sofa|couch)/.test(n)) return "sofa";
    if (/tisch/.test(n)) return "table";
    if (/(stuhl|sessel)/.test(n)) return "chair";
    if (/(schrank|kommode)/.test(n)) return "wardrobe";
    return "generic";
  }
  function genericIcon(item) {
    return `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.d}" fill="${item.color.fill}" stroke="#0A2038" stroke-width="1.5" rx="2"/>`;
  }
  function bedIcon(item) {
    const landscape = item.w >= item.d;
    const mattress = "#EDE6D6", mattressEdge = "#B9AA86";
    const blanket = item.color.fill, blanketEdge = item.color.text;
    let s = `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.d}" fill="${mattress}" stroke="${mattressEdge}" stroke-width="1.2" rx="3"/>`;
    if (landscape) {
      const pillowW = Math.max(item.w * 0.18, 14);
      s += `<rect x="${item.x + 3}" y="${item.y + item.d * 0.08}" width="${pillowW - 6}" height="${item.d * 0.84}" rx="5" fill="#FFFFFF" stroke="#D8D2C2" stroke-width="1"/>`;
      const blanketX = item.x + pillowW;
      s += `<rect x="${blanketX}" y="${item.y + 2}" width="${Math.max(item.w - pillowW - 4, 0)}" height="${item.d - 4}" rx="4" fill="${blanket}" stroke="${blanketEdge}" stroke-width="1"/>`;
      s += `<line x1="${blanketX + (item.w - pillowW) * 0.12}" y1="${item.y + 3}" x2="${blanketX + (item.w - pillowW) * 0.12}" y2="${item.y + item.d - 3}" stroke="${blanketEdge}" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.6"/>`;
    } else {
      const pillowH = Math.max(item.d * 0.18, 14);
      s += `<rect x="${item.x + item.w * 0.08}" y="${item.y + 3}" width="${item.w * 0.84}" height="${pillowH - 6}" rx="5" fill="#FFFFFF" stroke="#D8D2C2" stroke-width="1"/>`;
      const blanketY = item.y + pillowH;
      s += `<rect x="${item.x + 2}" y="${blanketY}" width="${item.w - 4}" height="${Math.max(item.d - pillowH - 4, 0)}" rx="4" fill="${blanket}" stroke="${blanketEdge}" stroke-width="1"/>`;
      s += `<line x1="${item.x + 3}" y1="${blanketY + (item.d - pillowH) * 0.12}" x2="${item.x + item.w - 3}" y2="${blanketY + (item.d - pillowH) * 0.12}" stroke="${blanketEdge}" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.6"/>`;
    }
    return s;
  }
  function sofaIcon(item) {
    const landscape = item.w >= item.d;
    const fill = item.color.fill, edge = item.color.text;
    let s = `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.d}" fill="${fill}" stroke="${edge}" stroke-width="1.3" rx="4"/>`;
    const base = landscape ? item.d : item.w;
    const thick = Math.max(base * 0.28, 10);
    if (landscape) {
      s += `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${thick}" fill="rgba(0,0,0,0.18)" rx="4"/>`;
      const cushions = Math.min(4, Math.max(1, Math.round(item.w / 70)));
      for (let i = 1; i < cushions; i++) {
        const cx2 = item.x + (item.w / cushions) * i;
        s += `<line x1="${cx2}" y1="${item.y + thick}" x2="${cx2}" y2="${item.y + item.d}" stroke="${edge}" stroke-width="0.8" opacity="0.5"/>`;
      }
    } else {
      s += `<rect x="${item.x}" y="${item.y}" width="${thick}" height="${item.d}" fill="rgba(0,0,0,0.18)" rx="4"/>`;
      const cushions = Math.min(4, Math.max(1, Math.round(item.d / 70)));
      for (let i = 1; i < cushions; i++) {
        const cy2 = item.y + (item.d / cushions) * i;
        s += `<line x1="${item.x + thick}" y1="${cy2}" x2="${item.x + item.w}" y2="${cy2}" stroke="${edge}" stroke-width="0.8" opacity="0.5"/>`;
      }
    }
    return s;
  }
  function tableIcon(item) {
    const fill = "#C9A876", edge = "#8C6A3F";
    return `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.d}" fill="${fill}" stroke="${edge}" stroke-width="1.3" rx="3"/>
            <rect x="${item.x + 5}" y="${item.y + 5}" width="${Math.max(item.w - 10, 0)}" height="${Math.max(item.d - 10, 0)}" fill="none" stroke="${edge}" stroke-width="0.6" opacity="0.6" rx="2"/>`;
  }
  function chairIcon(item) {
    const fill = item.color.fill, edge = item.color.text;
    const landscape = item.w >= item.d;
    const base = landscape ? item.d : item.w;
    const backThick = Math.max(base * 0.22, 6);
    let s = `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.d}" fill="${fill}" stroke="${edge}" stroke-width="1.2" rx="3"/>`;
    if (landscape) s += `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${backThick}" fill="rgba(0,0,0,0.22)" rx="3"/>`;
    else s += `<rect x="${item.x}" y="${item.y}" width="${backThick}" height="${item.d}" fill="rgba(0,0,0,0.22)" rx="3"/>`;
    return s;
  }
  function wardrobeIcon(item) {
    const fill = "#B98B5E", edge = "#7A5936";
    const cx = item.x + item.w / 2, cy = item.y + item.d / 2;
    return `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.d}" fill="${fill}" stroke="${edge}" stroke-width="1.3" rx="2"/>
            <line x1="${cx}" y1="${item.y + 3}" x2="${cx}" y2="${item.y + item.d - 3}" stroke="${edge}" stroke-width="1"/>
            <circle cx="${cx - 6}" cy="${cy}" r="2" fill="${edge}"/>
            <circle cx="${cx + 6}" cy="${cy}" r="2" fill="${edge}"/>`;
  }
  function furnitureDoorsSvg(item) {
    if (!item.doors) return "";
    const frontY = item.y + item.d;
    const P0 = { x: item.x, y: frontY };
    const P1 = { x: item.x + item.w, y: frontY };
    const normal = { x: 0, y: 1 };
    const color = "#16243B";
    if (item.doors === 2) {
      const Pm = { x: item.x + item.w / 2, y: frontY };
      const halfW = item.w / 2;
      return leafAndArcSvg(P0, Pm, normal, halfW, color) + leafAndArcSvg(P1, Pm, normal, halfW, color);
    }
    return leafAndArcSvg(P0, P1, normal, item.w, color);
  }
  function furnitureGroupInner(item) {
    const selected = item.id === selectedId;
    const type = recognizeFurnitureType(item.name);
    let body;
    switch (type) {
      case "bed": body = bedIcon(item); break;
      case "sofa": body = sofaIcon(item); break;
      case "table": body = tableIcon(item); break;
      case "chair": body = chairIcon(item); break;
      case "wardrobe": body = wardrobeIcon(item); break;
      default: body = genericIcon(item);
    }
    const cx = item.x + item.w / 2, cy = item.y + item.d / 2;
    let label;
    if (type === "generic") {
      const fontSize = Math.min(Math.max(8, Math.min(item.w, item.d) * 0.16), 16);
      label = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="${item.color.text}" font-size="${fontSize}" font-weight="600">${escapeXml(item.name)}</text>`;
    } else {
      const fontSize = Math.min(Math.max(7, Math.min(item.w, item.d) * 0.11), 10);
      label = `<text x="${item.x + 4}" y="${item.y + item.d - 4}" text-anchor="start" fill="#2C2C2A" fill-opacity="0.8" font-size="${fontSize}" font-weight="600">${escapeXml(item.name)}</text>`;
    }
    const selOutline = selected
      ? `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.d}" fill="none" stroke="#1B4E8F" stroke-width="2.5" rx="3"/>`
      : "";
    const lockIcon = item.locked
      ? `<text x="${item.x + item.w - 3}" y="${item.y + 3 + Math.min(11, Math.min(item.w, item.d) * 0.16)}" text-anchor="end" font-size="${Math.min(11, Math.max(8, Math.min(item.w, item.d) * 0.16))}">🔒</text>`
      : "";
    return body + label + selOutline + furnitureDoorsSvg(item) + lockIcon;
  }

  // ---------- main render ----------
  let camera = { scale: 1, x: 0, y: 0 };
  function baseViewBox(R) {
    const { w, d } = R.room;
    const pad = WALL_T + 26;
    return { x: -pad, y: -pad, w: w + pad * 2, d: d + pad * 2 };
  }
  function applyCamera() {
    const R = currentRoom();
    if (!R) return;
    const base = baseViewBox(R);
    const viewW = base.w / camera.scale;
    const viewH = base.d / camera.scale;
    const viewX = base.x + camera.x;
    const viewY = base.y + camera.y;
    svg.setAttribute("viewBox", `${viewX} ${viewY} ${viewW} ${viewH}`);
    // Bewusst KEIN updateRotateButton()/updateMeasureGuides() hier: die Knöpfe
    // sollen beim Zoomen/Verschieben des Hintergrunds an ihrer Bildschirmposition
    // bleiben, nicht mitwandern. Sie werden nur neu platziert, wenn sich das
    // ausgewählte Möbelstück selbst bewegt/dreht oder die Auswahl wechselt.
  }
  function zoomAt(clientX, clientY, factor) {
    const R = currentRoom();
    if (!R) return;
    const svgRect = svg.getBoundingClientRect();
    if (svgRect.width === 0 || svgRect.height === 0) return;
    const vb = svg.viewBox.baseVal;
    const fx = (clientX - svgRect.left) / svgRect.width;
    const fy = (clientY - svgRect.top) / svgRect.height;
    const roomX = vb.x + fx * vb.width;
    const roomY = vb.y + fy * vb.height;
    const newScale = Math.max(0.4, Math.min(8, camera.scale * factor));
    const base = baseViewBox(R);
    const newViewW = base.w / newScale, newViewH = base.d / newScale;
    camera.scale = newScale;
    camera.x = (roomX - fx * newViewW) - base.x;
    camera.y = (roomY - fy * newViewH) - base.y;
    applyCamera();
  }

  function render() {
    const R = currentRoom();
    if (!R) return;
    const { w, d } = R.room;
    svg.innerHTML = "";

    const floorGroup = document.createElementNS(NS, "g");
    floorGroup.innerHTML = floorSvg(w, d, R.floorType);
    svg.appendChild(floorGroup);

    const wallsGroup = document.createElementNS(NS, "g");
    wallsGroup.id = "wallsGroup";
    wallsGroup.innerHTML = wallsSvg(R);
    svg.appendChild(wallsGroup);

    R.openings.forEach(o => {
      const g = document.createElementNS(NS, "g");
      g.dataset.openingId = o.id;
      g.style.cursor = "grab";
      g.innerHTML = openingGroupInner(o, R.room);
      g.addEventListener("pointerdown", startOpeningDrag);
      svg.appendChild(g);
    });

    const dimFontSize = Math.max(10, Math.min(w, d) * 0.035);
    const labelOffset = WALL_T + 14;
    const wLabel = document.createElementNS(NS, "text");
    wLabel.setAttribute("x", w / 2); wLabel.setAttribute("y", -labelOffset);
    wLabel.setAttribute("text-anchor", "middle");
    wLabel.setAttribute("fill", "#6B7A90");
    wLabel.setAttribute("font-family", "Courier New, monospace");
    wLabel.setAttribute("font-size", dimFontSize);
    wLabel.textContent = w + " cm";
    svg.appendChild(wLabel);

    const dLabel = document.createElementNS(NS, "text");
    dLabel.setAttribute("x", -labelOffset); dLabel.setAttribute("y", d / 2);
    dLabel.setAttribute("text-anchor", "end");
    dLabel.setAttribute("fill", "#6B7A90");
    dLabel.setAttribute("font-family", "Courier New, monospace");
    dLabel.setAttribute("font-size", dimFontSize);
    dLabel.setAttribute("transform", `rotate(-90 ${-labelOffset} ${d / 2})`);
    dLabel.textContent = d + " cm";
    svg.appendChild(dLabel);

    R.items.forEach(item => {
      const cx = item.x + item.w / 2;
      const cy = item.y + item.d / 2;
      const g = document.createElementNS(NS, "g");
      g.setAttribute("transform", `rotate(${item.rot} ${cx} ${cy})`);
      g.style.cursor = item.locked ? "pointer" : "grab";
      g.dataset.id = item.id;
      g.innerHTML = furnitureGroupInner(item);
      g.addEventListener("pointerdown", startDrag);
      svg.appendChild(g);
    });

    updateRotateButton();
    updateMeasureGuides();
    updateOpeningMeasure();
    applyCamera();
  }

  // ---------- selection ----------
  function refreshItemVisual(item) {
    const g = svg.querySelector(`g[data-id="${item.id}"]`);
    if (g) g.innerHTML = furnitureGroupInner(item);
  }
  function refreshAllVisuals() {
    const R = currentRoom();
    if (!R) return;
    R.items.forEach(refreshItemVisual);
    R.openings.forEach(refreshOpeningVisual);
  }
  function selectItem(id) {
    selectedId = id;
    selectedOpeningId = null;
    refreshAllVisuals();
    updateRotateButton();
    updateMeasureGuides();
    updateOpeningMeasure();
  }
  function selectOpening(id) {
    selectedOpeningId = id;
    selectedId = null;
    refreshAllVisuals();
    updateRotateButton();
    updateMeasureGuides();
    updateOpeningMeasure();
  }
  function deselect() {
    if (selectedId === null && selectedOpeningId === null) return;
    selectedId = null;
    selectedOpeningId = null;
    refreshAllVisuals();
    updateRotateButton();
    updateMeasureGuides();
    updateOpeningMeasure();
  }
  // ---------- zoom (mouse wheel) & pan (right mouse button / touch) ----------
  let mousePan = null;
  const activeTouches = new Map();
  let singleTouchPan = null;
  let pinchState = null;

  canvasWrap.addEventListener("wheel", (evt) => {
    evt.preventDefault();
    const factor = evt.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(evt.clientX, evt.clientY, factor);
  }, { passive: false });

  svg.addEventListener("contextmenu", (evt) => evt.preventDefault());

  function touchDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  svg.addEventListener("pointerdown", (evt) => {
    if (evt.target !== svg) return; // Klick/Touch auf Möbel etc. wird dort selbst behandelt
    if (evt.pointerType === "mouse") {
      if (evt.button === 2) {
        evt.preventDefault();
        mousePan = { startX: evt.clientX, startY: evt.clientY, startCamX: camera.x, startCamY: camera.y };
        svg.setPointerCapture(evt.pointerId);
        svg.style.cursor = "grabbing";
      } else if (evt.button === 0) {
        deselect();
      }
      return;
    }
    // Touch / Pen
    activeTouches.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
    svg.setPointerCapture(evt.pointerId);
    if (activeTouches.size === 1) {
      singleTouchPan = { startX: evt.clientX, startY: evt.clientY, startCamX: camera.x, startCamY: camera.y, moved: false };
      pinchState = null;
    } else if (activeTouches.size === 2) {
      const pts = [...activeTouches.values()];
      const svgRect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
      pinchState = {
        startDist: touchDist(pts[0], pts[1]),
        startScale: camera.scale,
        anchorRoomX: vb.x + ((midX - svgRect.left) / svgRect.width) * vb.width,
        anchorRoomY: vb.y + ((midY - svgRect.top) / svgRect.height) * vb.height
      };
      singleTouchPan = null;
    }
  });

  svg.addEventListener("pointermove", (evt) => {
    if (evt.pointerType === "mouse") {
      if (!mousePan) return;
      const svgRect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const scaleFactor = vb.width / svgRect.width;
      camera.x = mousePan.startCamX - (evt.clientX - mousePan.startX) * scaleFactor;
      camera.y = mousePan.startCamY - (evt.clientY - mousePan.startY) * scaleFactor;
      applyCamera();
      return;
    }
    if (!activeTouches.has(evt.pointerId)) return;
    activeTouches.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });

    if (activeTouches.size === 1 && singleTouchPan) {
      const dx = evt.clientX - singleTouchPan.startX;
      const dy = evt.clientY - singleTouchPan.startY;
      if (!singleTouchPan.moved && Math.hypot(dx, dy) > 6) singleTouchPan.moved = true;
      if (singleTouchPan.moved) {
        const svgRect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const scaleFactor = vb.width / svgRect.width;
        camera.x = singleTouchPan.startCamX - dx * scaleFactor;
        camera.y = singleTouchPan.startCamY - dy * scaleFactor;
        applyCamera();
      }
    } else if (activeTouches.size === 2 && pinchState) {
      const pts = [...activeTouches.values()];
      const R = currentRoom();
      if (!R) return;
      const newDist = touchDist(pts[0], pts[1]);
      const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
      const factor = newDist / pinchState.startDist;
      const newScale = Math.max(0.4, Math.min(8, pinchState.startScale * factor));
      const base = baseViewBox(R);
      const newViewW = base.w / newScale, newViewH = base.d / newScale;
      const svgRect = svg.getBoundingClientRect();
      const fx = (midX - svgRect.left) / svgRect.width;
      const fy = (midY - svgRect.top) / svgRect.height;
      camera.scale = newScale;
      camera.x = (pinchState.anchorRoomX - fx * newViewW) - base.x;
      camera.y = (pinchState.anchorRoomY - fy * newViewH) - base.y;
      applyCamera();
    }
  });

  function endMousePan() { mousePan = null; svg.style.cursor = ""; }
  svg.addEventListener("pointerup", (evt) => {
    if (evt.pointerType === "mouse") { if (mousePan) endMousePan(); return; }
    if (!activeTouches.has(evt.pointerId)) return;
    activeTouches.delete(evt.pointerId);
    if (activeTouches.size === 0) {
      if (singleTouchPan && !singleTouchPan.moved) deselect();
      singleTouchPan = null;
      pinchState = null;
    } else if (activeTouches.size === 1) {
      const remaining = [...activeTouches.values()][0];
      singleTouchPan = { startX: remaining.x, startY: remaining.y, startCamX: camera.x, startCamY: camera.y, moved: true };
      pinchState = null;
    }
  });
  svg.addEventListener("pointercancel", (evt) => {
    if (evt.pointerType === "mouse") { endMousePan(); return; }
    activeTouches.delete(evt.pointerId);
    singleTouchPan = null;
    pinchState = null;
  });

  // ---------- Werkzeug-Leiste (drehen, sperren, löschen) – als Teil der Zeichnung ----------
  // Wird als SVG-Gruppe direkt neben dem Möbelstück gezeichnet, damit sie beim
  // Zoomen/Verschieben des Hintergrunds automatisch mit dem Möbelstück mitwandert
  // (fester Abstand) und sich NICHT unabhängig vom Hintergrund bewegt.
  function furnitureToolbarSvg(item, R) {
    const box = getAABB(item);
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    const onLeftHalf = cx < R.room.w / 2;
    const btnR = 15, gap = 7, margin = 20;
    const anchorX = onLeftHalf ? box.maxX + margin + btnR : box.minX - margin - btnR;
    const step = btnR * 2 + gap;
    const stackHeight = step * 2 + btnR * 2;
    const firstY = cy - stackHeight / 2 + btnR;
    const buttons = [
      { tool: "rotate", y: firstY, fill: "#E8A33D", fg: "#4A2E06", icon: "⟳", stroke: "none" },
      { tool: "lock", y: firstY + step, fill: item.locked ? "#E8A33D" : "#FFFFFF", fg: item.locked ? "#4A2E06" : "#16243B", icon: item.locked ? "🔒" : "🔓", stroke: item.locked ? "none" : "#B9C7DA" },
      { tool: "delete", y: firstY + step * 2, fill: "#C0392B", fg: "#FFFFFF", icon: "🗑", stroke: "none" }
    ];
    let s = "";
    buttons.forEach(b => {
      s += `<g class="tool-btn-svg" data-tool="${b.tool}" style="cursor:pointer">
        <circle cx="${anchorX}" cy="${b.y}" r="${btnR}" fill="${b.fill}" stroke="${b.stroke}" stroke-width="1"/>
        <text x="${anchorX}" y="${b.y + 5}" text-anchor="middle" font-size="15" fill="${b.fg}">${b.icon}</text>
      </g>`;
    });
    return s;
  }
  function handleToolClick(tool, itemId) {
    const R = currentRoom();
    const item = R ? R.items.find(i => i.id === itemId) : null;
    if (!item) return;
    if (tool === "rotate") {
      item.rot = (item.rot + 90) % 360;
      refreshItemVisual(item);
      const gEl = svg.querySelector(`g[data-id="${item.id}"]`);
      if (gEl) gEl.setAttribute("transform", `rotate(${item.rot} ${item.x + item.w / 2} ${item.y + item.d / 2})`);
      updateMeasureGuides();
      renderFurnitureList();
      updateRotateButton();
    } else if (tool === "lock") {
      item.locked = !item.locked;
      refreshItemVisual(item);
      const gEl = svg.querySelector(`g[data-id="${item.id}"]`);
      if (gEl) gEl.style.cursor = item.locked ? "pointer" : "grab";
      updateRotateButton();
    } else if (tool === "delete") {
      R.items = R.items.filter(i => i.id !== item.id);
      selectedId = null;
      render();
      renderFurnitureList();
    }
  }
  function updateRotateButton() {
    let group = svg.querySelector("#toolbarGroup");
    if (!group) { group = document.createElementNS(NS, "g"); group.id = "toolbarGroup"; svg.appendChild(group); }
    const R = currentRoom();
    const item = R ? R.items.find(i => i.id === selectedId) : null;
    if (!item) { group.innerHTML = ""; return; }
    group.innerHTML = furnitureToolbarSvg(item, R);
    group.querySelectorAll("[data-tool]").forEach(g => {
      g.addEventListener("pointerdown", (evt) => evt.stopPropagation());
      g.addEventListener("click", () => handleToolClick(g.dataset.tool, item.id));
    });
  }

  // ---------- measurement guides (Abstand zur nächsten Kante) ----------

  function nearestEdges(item, R) {
    const box = getAABB(item);
    const w = R.room.w, d = R.room.d;
    let leftGap = box.minX - 0, leftTarget = 0;
    let rightGap = w - box.maxX, rightTarget = w;
    let topGap = box.minY - 0, topTarget = 0;
    let bottomGap = d - box.maxY, bottomTarget = d;
    R.items.forEach(other => {
      if (other.id === item.id) return;
      const ob = getAABB(other);
      const vOverlap = box.minY < ob.maxY && box.maxY > ob.minY;
      const hOverlap = box.minX < ob.maxX && box.maxX > ob.minX;
      if (vOverlap) {
        const gapL = box.minX - ob.maxX;
        if (gapL >= 0 && gapL < leftGap) { leftGap = gapL; leftTarget = ob.maxX; }
        const gapR = ob.minX - box.maxX;
        if (gapR >= 0 && gapR < rightGap) { rightGap = gapR; rightTarget = ob.minX; }
      }
      if (hOverlap) {
        const gapT = box.minY - ob.maxY;
        if (gapT >= 0 && gapT < topGap) { topGap = gapT; topTarget = ob.maxY; }
        const gapB = ob.minY - box.maxY;
        if (gapB >= 0 && gapB < bottomGap) { bottomGap = gapB; bottomTarget = ob.minY; }
      }
    });
    const horiz = (leftGap <= rightGap)
      ? { gap: leftGap, from: box.minX, to: leftTarget }
      : { gap: rightGap, from: box.maxX, to: rightTarget };
    const vert = (topGap <= bottomGap)
      ? { gap: topGap, from: box.minY, to: topTarget }
      : { gap: bottomGap, from: box.maxY, to: bottomTarget };
    return { horiz, vert, box };
  }

  function measurementLinesSvg(item, R) {
    const { horiz, vert, box } = nearestEdges(item, R);
    const cy = (box.minY + box.maxY) / 2;
    const cx = (box.minX + box.maxX) / 2;
    let s = "";
    if (horiz.gap > 0.5) {
      const y = cy;
      const x1 = Math.min(horiz.from, horiz.to), x2 = Math.max(horiz.from, horiz.to);
      const mid = (x1 + x2) / 2;
      s += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#1B4E8F" stroke-width="0.8" stroke-dasharray="2 2"/>`;
      s += `<line x1="${x1}" y1="${y - 4}" x2="${x1}" y2="${y + 4}" stroke="#1B4E8F" stroke-width="0.8"/>`;
      s += `<line x1="${x2}" y1="${y - 4}" x2="${x2}" y2="${y + 4}" stroke="#1B4E8F" stroke-width="0.8"/>`;
      s += `<g class="measure-label" data-axis="h" style="cursor:pointer">
        <rect x="${mid - 15}" y="${y - 8}" width="30" height="16" rx="3" fill="#FFFFFF" stroke="#1B4E8F" stroke-width="0.8"/>
        <text x="${mid}" y="${y + 3.5}" text-anchor="middle" font-size="9" fill="#1B4E8F" font-family="Courier New, monospace">${Math.round(horiz.gap)}</text>
      </g>`;
    }
    if (vert.gap > 0.5) {
      const x = cx;
      const y1 = Math.min(vert.from, vert.to), y2 = Math.max(vert.from, vert.to);
      const mid = (y1 + y2) / 2;
      s += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#1B4E8F" stroke-width="0.8" stroke-dasharray="2 2"/>`;
      s += `<line x1="${x - 4}" y1="${y1}" x2="${x + 4}" y2="${y1}" stroke="#1B4E8F" stroke-width="0.8"/>`;
      s += `<line x1="${x - 4}" y1="${y2}" x2="${x + 4}" y2="${y2}" stroke="#1B4E8F" stroke-width="0.8"/>`;
      s += `<g class="measure-label" data-axis="v" style="cursor:pointer">
        <rect x="${x - 15}" y="${mid - 8}" width="30" height="16" rx="3" fill="#FFFFFF" stroke="#1B4E8F" stroke-width="0.8"/>
        <text x="${x}" y="${mid + 3.5}" text-anchor="middle" font-size="9" fill="#1B4E8F" font-family="Courier New, monospace">${Math.round(vert.gap)}</text>
      </g>`;
    }
    return s;
  }

  function updateMeasureGuides() {
    let group = svg.querySelector("#measureGroup");
    if (!group) { group = document.createElementNS(NS, "g"); group.id = "measureGroup"; svg.appendChild(group); }
    const R = currentRoom();
    const item = R ? R.items.find(i => i.id === selectedId) : null;
    if (!item) { group.innerHTML = ""; measureInput.style.display = "none"; return; }
    group.innerHTML = measurementLinesSvg(item, R);
    group.querySelectorAll(".measure-label").forEach(g => {
      g.addEventListener("pointerdown", (evt) => { evt.stopPropagation(); openMeasureEditor(g.dataset.axis, item, R); });
    });
  }

  function openMeasureEditor(axis, item, R) {
    const guides = nearestEdges(item, R);
    const g = axis === "h" ? guides.horiz : guides.vert;
    const svgRect = svg.getBoundingClientRect();
    const wrapRect = canvasWrap.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scale = svgRect.width / vb.width;
    const box = guides.box;
    let midRoomX, midRoomY;
    if (axis === "h") { midRoomX = (g.from + g.to) / 2; midRoomY = (box.minY + box.maxY) / 2; }
    else { midRoomX = (box.minX + box.maxX) / 2; midRoomY = (g.from + g.to) / 2; }
    const screenX = svgRect.left + (midRoomX - vb.x) * scale;
    const screenY = svgRect.top + (midRoomY - vb.y) * scale;
    measureInput.style.left = (screenX - wrapRect.left - 26) + "px";
    measureInput.style.top = (screenY - wrapRect.top - 11) + "px";
    measureInput.style.display = "block";
    measureInput.value = Math.round(g.gap);
    measureInput.dataset.mode = "furniture";
    measureInput.dataset.axis = axis;
    measureInput.dataset.itemId = item.id;
    measureInput.focus();
    measureInput.select();
  }

  // ---------- Türen/Fenster: verschieben + Maß zur nächsten Ecke ----------
  function updateOpeningMeasure() {
    let group = svg.querySelector("#openingMeasureGroup");
    if (!group) { group = document.createElementNS(NS, "g"); group.id = "openingMeasureGroup"; svg.appendChild(group); }
    const R = currentRoom();
    const o = R ? R.openings.find(x => x.id === selectedOpeningId) : null;
    if (!o) { group.innerHTML = ""; return; }
    const dims = R.room;
    const geom = wallGeometry(o.wall, dims);
    const { s0, s1 } = openingSpan(o, dims);
    const cornerS = (o.corner === geom.corners[0]) ? 0 : geom.length;
    const nearS = (o.corner === geom.corners[0]) ? s0 : s1;
    if (Math.abs(nearS - cornerS) < 0.5) { group.innerHTML = ""; return; }
    const offset = 24;
    const p1 = pointAt(geom, cornerS);
    const p2 = pointAt(geom, nearS);
    const o1 = { x: p1.x + geom.normal.x * offset, y: p1.y + geom.normal.y * offset };
    const o2 = { x: p2.x + geom.normal.x * offset, y: p2.y + geom.normal.y * offset };
    const mid = { x: (o1.x + o2.x) / 2, y: (o1.y + o2.y) / 2 };
    let s = `<line x1="${o1.x}" y1="${o1.y}" x2="${o2.x}" y2="${o2.y}" stroke="#1B4E8F" stroke-width="0.8" stroke-dasharray="2 2"/>`;
    s += `<line x1="${p1.x}" y1="${p1.y}" x2="${o1.x}" y2="${o1.y}" stroke="#1B4E8F" stroke-width="0.6" stroke-dasharray="1 2"/>`;
    s += `<line x1="${p2.x}" y1="${p2.y}" x2="${o2.x}" y2="${o2.y}" stroke="#1B4E8F" stroke-width="0.6" stroke-dasharray="1 2"/>`;
    s += `<g class="opening-measure-label" style="cursor:pointer">
      <rect x="${mid.x - 15}" y="${mid.y - 8}" width="30" height="16" rx="3" fill="#FFFFFF" stroke="#1B4E8F" stroke-width="0.8"/>
      <text x="${mid.x}" y="${mid.y + 3.5}" text-anchor="middle" font-size="9" fill="#1B4E8F" font-family="Courier New, monospace">${Math.round(o.dist)}</text>
    </g>`;
    group.innerHTML = s;
    group.querySelector(".opening-measure-label").addEventListener("pointerdown", (evt) => {
      evt.stopPropagation();
      openOpeningMeasureEditor(o, mid);
    });
  }

  function openOpeningMeasureEditor(o, midRoomPoint) {
    const svgRect = svg.getBoundingClientRect();
    const wrapRect = canvasWrap.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scale = svgRect.width / vb.width;
    const screenX = svgRect.left + (midRoomPoint.x - vb.x) * scale;
    const screenY = svgRect.top + (midRoomPoint.y - vb.y) * scale;
    measureInput.style.left = (screenX - wrapRect.left - 26) + "px";
    measureInput.style.top = (screenY - wrapRect.top - 11) + "px";
    measureInput.style.display = "block";
    measureInput.value = Math.round(o.dist);
    measureInput.dataset.mode = "opening";
    measureInput.dataset.openingId = o.id;
    measureInput.focus();
    measureInput.select();
  }

  let openingDragging = null;
  function startOpeningDrag(evt) {
    evt.stopPropagation();
    const R = currentRoom();
    if (!R) return;
    const id = Number(evt.currentTarget.dataset.openingId);
    const o = R.openings.find(x => x.id === id);
    if (!o) return;
    selectOpening(id);
    const geom = wallGeometry(o.wall, R.room);
    const p = svgPoint(evt);
    const pointerS = geom.tangent.x !== 0 ? (p.x - geom.start.x) : (p.y - geom.start.y);
    const { s0 } = openingSpan(o, R.room);
    openingDragging = { id, offsetS: pointerS - s0 };
    evt.currentTarget.setPointerCapture(evt.pointerId);
    evt.currentTarget.style.cursor = "grabbing";
    svg.addEventListener("pointermove", onOpeningDrag);
    svg.addEventListener("pointerup", endOpeningDrag);
    svg.addEventListener("pointercancel", endOpeningDrag);
  }
  function onOpeningDrag(evt) {
    if (!openingDragging) return;
    const R = currentRoom();
    const o = R ? R.openings.find(x => x.id === openingDragging.id) : null;
    if (!o) return;
    const geom = wallGeometry(o.wall, R.room);
    const p = svgPoint(evt);
    const pointerS = geom.tangent.x !== 0 ? (p.x - geom.start.x) : (p.y - geom.start.y);
    let s0 = pointerS - openingDragging.offsetS;
    s0 = Math.max(0, Math.min(geom.length - o.width, s0));
    const distFromStart = s0;
    const distFromEnd = geom.length - (s0 + o.width);
    if (distFromStart <= distFromEnd) { o.corner = geom.corners[0]; o.dist = Math.round(distFromStart); }
    else { o.corner = geom.corners[1]; o.dist = Math.round(distFromEnd); }
    const wg = svg.querySelector("#wallsGroup");
    if (wg) wg.innerHTML = wallsSvg(R);
    refreshOpeningVisual(o);
    updateOpeningMeasure();
  }
  function endOpeningDrag(evt) {
    openingDragging = null;
    svg.removeEventListener("pointermove", onOpeningDrag);
    svg.removeEventListener("pointerup", endOpeningDrag);
    svg.removeEventListener("pointercancel", endOpeningDrag);
    if (evt && evt.currentTarget && evt.currentTarget.style) evt.currentTarget.style.cursor = "grab";
    renderOpeningList();
  }

  function commitMeasureInput() {
    if (measureInput.style.display === "none") return;
    const R = currentRoom();
    if (measureInput.dataset.mode === "opening") {
      const o = R ? R.openings.find(x => x.id === Number(measureInput.dataset.openingId)) : null;
      if (o) {
        const prev = o.dist;
        o.dist = Math.max(0, Number(measureInput.value) || 0);
        if (!openingFits(o, R.room)) { o.dist = prev; }
        render();
        renderOpeningList();
      }
      measureInput.style.display = "none";
      return;
    }
    const item = R ? R.items.find(i => i.id === Number(measureInput.dataset.itemId)) : null;
    if (item) {
      const axis = measureInput.dataset.axis;
      const newGap = Math.max(0, Number(measureInput.value) || 0);
      const guides = nearestEdges(item, R);
      const g = axis === "h" ? guides.horiz : guides.vert;
      const delta = (g.to <= g.from) ? (g.to + newGap - g.from) : (g.to - newGap - g.from);
      if (axis === "h") item.x = Math.round(item.x + delta);
      else item.y = Math.round(item.y + delta);
      refreshItemVisual(item);
      const gEl = svg.querySelector(`g[data-id="${item.id}"]`);
      if (gEl) gEl.setAttribute("transform", `rotate(${item.rot} ${item.x + item.w / 2} ${item.y + item.d / 2})`);
      updateRotateButton();
      updateMeasureGuides();
      renderFurnitureList();
    }
    measureInput.style.display = "none";
  }
  measureInput.addEventListener("pointerdown", (evt) => evt.stopPropagation());
  measureInput.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") commitMeasureInput();
    else if (evt.key === "Escape") measureInput.style.display = "none";
  });
  measureInput.addEventListener("blur", commitMeasureInput);

  // ---------- bounding box + snapping ----------
  function getAABB(item) {
    const cx = item.x + item.w / 2;
    const cy = item.y + item.d / 2;
    const rad = item.rot * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const corners = [
      [-item.w / 2, -item.d / 2], [item.w / 2, -item.d / 2],
      [item.w / 2, item.d / 2], [-item.w / 2, item.d / 2]
    ].map(([lx, ly]) => ({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos }));
    return {
      minX: Math.min(...corners.map(c => c.x)), maxX: Math.max(...corners.map(c => c.x)),
      minY: Math.min(...corners.map(c => c.y)), maxY: Math.max(...corners.map(c => c.y))
    };
  }
  function applySnapping(item, R) {
    const { w, d } = R.room;
    let box = getAABB(item);
    let snappedX = false, snappedY = false;
    if (Math.abs(box.minX - 0) <= SNAP) { item.x += (0 - box.minX); snappedX = true; }
    else if (Math.abs(box.maxX - w) <= SNAP) { item.x += (w - box.maxX); snappedX = true; }
    if (Math.abs(box.minY - 0) <= SNAP) { item.y += (0 - box.minY); snappedY = true; }
    else if (Math.abs(box.maxY - d) <= SNAP) { item.y += (d - box.maxY); snappedY = true; }

    box = getAABB(item);
    for (const other of R.items) {
      if (other.id === item.id) continue;
      const ob = getAABB(other);
      const vOverlap = box.minY < ob.maxY && box.maxY > ob.minY;
      const hOverlap = box.minX < ob.maxX && box.maxX > ob.minX;
      if (!snappedX && vOverlap) {
        if (Math.abs(box.maxX - ob.minX) <= SNAP) { item.x += (ob.minX - box.maxX); snappedX = true; }
        else if (Math.abs(box.minX - ob.maxX) <= SNAP) { item.x += (ob.maxX - box.minX); snappedX = true; }
      }
      if (!snappedY && hOverlap) {
        if (Math.abs(box.maxY - ob.minY) <= SNAP) { item.y += (ob.minY - box.maxY); snappedY = true; }
        else if (Math.abs(box.minY - ob.maxY) <= SNAP) { item.y += (ob.maxY - box.minY); snappedY = true; }
      }
      if (snappedX && snappedY) break;
      box = getAABB(item);
    }
    item.x = Math.round(item.x);
    item.y = Math.round(item.y);
  }

  // ---------- dragging ----------
  let dragging = null;
  function startDrag(evt) {
    evt.stopPropagation();
    const R = currentRoom();
    if (!R) return;
    const id = Number(evt.currentTarget.dataset.id);
    const item = R.items.find(i => i.id === id);
    if (!item) return;
    selectItem(id);
    if (item.locked) return;
    const p = svgPoint(evt);
    dragging = { id, offsetX: p.x - item.x, offsetY: p.y - item.y };
    evt.currentTarget.setPointerCapture(evt.pointerId);
    evt.currentTarget.style.cursor = "grabbing";
    svg.addEventListener("pointermove", onDrag);
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
  }
  function onDrag(evt) {
    if (!dragging) return;
    const R = currentRoom();
    if (!R) return;
    const item = R.items.find(i => i.id === dragging.id);
    if (!item) return;
    const p = svgPoint(evt);
    item.x = Math.round(p.x - dragging.offsetX);
    item.y = Math.round(p.y - dragging.offsetY);
    const margin = Math.max(item.w, item.d);
    item.x = Math.max(-margin, Math.min(R.room.w + margin - item.w, item.x));
    item.y = Math.max(-margin, Math.min(R.room.d + margin - item.d, item.y));
    applySnapping(item, R);
    refreshItemVisual(item);
    const g = svg.querySelector(`g[data-id="${item.id}"]`);
    if (g) g.setAttribute("transform", `rotate(${item.rot} ${item.x + item.w / 2} ${item.y + item.d / 2})`);
    updateRotateButton();
    updateMeasureGuides();
  }
  function endDrag(evt) {
    dragging = null;
    svg.removeEventListener("pointermove", onDrag);
    svg.removeEventListener("pointerup", endDrag);
    svg.removeEventListener("pointercancel", endDrag);
    if (evt && evt.currentTarget && evt.currentTarget.style) evt.currentTarget.style.cursor = "grab";
  }

  // ---------- furniture list panel ----------
  function renderFurnitureList() {
    const R = currentRoom();
    if (!R || R.items.length === 0) {
      listEl.innerHTML = '<p class="empty">Noch keine Möbel. Trage oben Name und Maße ein und füge sie hinzu.</p>';
      return;
    }
    listEl.innerHTML = "";
    R.items.forEach(item => {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-head">
          <span class="swatch" style="background:${item.color.fill}"></span>
          <span class="item-name">${escapeXml(item.name)}</span>
          <span class="item-dims">${item.w} × ${item.d} cm</span>
        </div>
        <div class="item-controls">
          <button class="mini-rotate-btn" data-rotstep="${item.id}">⟳</button>
          <span class="item-dims">${item.rot}°</span>
          <button class="del-btn" data-del="${item.id}">Entfernen</button>
        </div>
      `;
      listEl.appendChild(row);
    });

    listEl.querySelectorAll("[data-rotstep]").forEach(btn => {
      btn.addEventListener("click", () => {
        const R2 = currentRoom();
        const item = R2.items.find(i => i.id === Number(btn.dataset.rotstep));
        if (!item) return;
        item.rot = (item.rot + 90) % 360;
        refreshItemVisual(item);
        const g = svg.querySelector(`g[data-id="${item.id}"]`);
        if (g) g.setAttribute("transform", `rotate(${item.rot} ${item.x + item.w / 2} ${item.y + item.d / 2})`);
        updateRotateButton();
        updateMeasureGuides();
        renderFurnitureList();
      });
    });
    listEl.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const R2 = currentRoom();
        const id = Number(btn.dataset.del);
        R2.items = R2.items.filter(i => i.id !== id);
        if (selectedId === id) selectedId = null;
        render();
        renderFurnitureList();
      });
    });
  }

  // ---------- opening (door/window) list panel ----------
  function renderOpeningList() {
    const R = currentRoom();
    if (!R || R.openings.length === 0) {
      openingListEl.innerHTML = '<p class="empty">Noch keine Türen oder Fenster.</p>';
      return;
    }
    const wallLabel = { top: "Oben", right: "Rechts", bottom: "Unten", left: "Links" };
    const typeLabel = { door: "Tür", "window-single": "Fenster (einfach)", "window-double": "Fenster (doppelt)" };
    openingListEl.innerHTML = "";
    R.openings.forEach(o => {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-head">
          <span class="item-name">${typeLabel[o.type]} · ${wallLabel[o.wall]}</span>
        </div>
        <div class="item-controls">
          <label>Breite</label>
          <input type="number" data-owidth="${o.id}" value="${o.width}" min="20" max="500" step="1">
          <label>Abstand v. ${o.corner}</label>
          <input type="number" data-odist="${o.id}" value="${o.dist}" min="0" max="1500" step="1">
          <button class="del-btn" data-odel="${o.id}">Entfernen</button>
        </div>
      `;
      openingListEl.appendChild(row);
    });

    openingListEl.querySelectorAll("[data-owidth]").forEach(input => {
      input.addEventListener("change", () => {
        const R2 = currentRoom();
        const o = R2.openings.find(x => x.id === Number(input.dataset.owidth));
        if (!o) return;
        const prev = o.width;
        o.width = Math.max(20, Number(input.value) || prev);
        if (!openingFits(o, R2.room)) { o.width = prev; input.value = prev; return; }
        render();
      });
    });
    openingListEl.querySelectorAll("[data-odist]").forEach(input => {
      input.addEventListener("change", () => {
        const R2 = currentRoom();
        const o = R2.openings.find(x => x.id === Number(input.dataset.odist));
        if (!o) return;
        const prev = o.dist;
        o.dist = Math.max(0, Number(input.value) || 0);
        if (!openingFits(o, R2.room)) { o.dist = prev; input.value = prev; return; }
        render();
      });
    });
    openingListEl.querySelectorAll("[data-odel]").forEach(btn => {
      btn.addEventListener("click", () => {
        const R2 = currentRoom();
        const id = Number(btn.dataset.odel);
        R2.openings = R2.openings.filter(o => o.id !== id);
        render();
        renderOpeningList();
      });
    });
  }

  // ---------- opening add form ----------
  const oWallSel = document.getElementById("oWall");
  const oTypeSel = document.getElementById("oType");
  const oCornerSel = document.getElementById("oCorner");
  const oHingeSel = document.getElementById("oHinge");
  const oHingeField = document.getElementById("oHingeField");
  const oError = document.getElementById("oError");

  function refreshCornerOptions() {
    const geom = wallGeometry(oWallSel.value, currentRoom().room);
    const corners = geom.corners;
    oCornerSel.innerHTML = corners.map(c => `<option value="${c}">${c}</option>`).join("");
    oHingeSel.innerHTML = corners.map(c => `<option value="${c}">${c}</option>`).join("");
  }
  function refreshHingeVisibility() {
    oHingeField.style.display = oTypeSel.value === "window-double" ? "none" : "flex";
  }
  oWallSel.addEventListener("change", refreshCornerOptions);
  oTypeSel.addEventListener("change", refreshHingeVisibility);
  refreshCornerOptions();
  refreshHingeVisibility();

  document.getElementById("addOpening").addEventListener("click", () => {
    const R = currentRoom();
    const wall = oWallSel.value;
    const type = oTypeSel.value;
    const width = Math.max(20, Number(document.getElementById("oWidth").value) || 90);
    const corner = oCornerSel.value;
    const dist = Math.max(0, Number(document.getElementById("oDist").value) || 0);
    const hinge = type === "window-double" ? corner : oHingeSel.value;

    const candidate = { wall, type, width, corner, dist, hinge };
    if (!openingFits(candidate, R.room)) {
      const geom = wallGeometry(wall, R.room);
      oError.textContent = `Passt nicht: Abstand + Breite überschreitet die Wandlänge (${geom.length} cm).`;
      oError.style.display = "block";
      return;
    }
    oError.style.display = "none";
    candidate.id = R.nextOpeningId++;
    R.openings.push(candidate);
    render();
    renderOpeningList();
  });

  // ---------- furniture add ----------
  document.getElementById("addFurniture").addEventListener("click", () => {
    const R = currentRoom();
    const nameInput = document.getElementById("fName");
    const wInput = document.getElementById("fW");
    const dInput = document.getElementById("fD");
    const doorsSel = document.getElementById("fDoors");
    const name = nameInput.value.trim() || "Möbelstück";
    const w = Math.max(1, Math.min(1000, Number(wInput.value) || 50));
    const d = Math.max(1, Math.min(1000, Number(dInput.value) || 50));
    const doors = Number(doorsSel.value) || 0;
    const color = palette[R.nextColor % palette.length];
    R.nextColor++;
    R.items.push({
      id: R.nextId++, name, w, d,
      x: Math.round((R.room.w - w) / 2), y: Math.round((R.room.d - d) / 2),
      rot: 0, doors, color, locked: false
    });
    nameInput.value = "";
    doorsSel.value = "0";
    render();
    renderFurnitureList();
  });

  document.getElementById("floorType").addEventListener("change", (evt) => {
    currentRoom().floorType = evt.target.value;
    render();
  });

  // ---------- inline name editing (Doppelklick, sofort gespeichert) ----------
  function selectAllText(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function setupInlineEdit(el, getValue, setValue) {
    el.addEventListener("dblclick", () => {
      el.contentEditable = "true";
      el.focus();
      selectAllText(el);
    });
    el.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") { evt.preventDefault(); el.blur(); }
      else if (evt.key === "Escape") { el.textContent = getValue(); el.blur(); }
    });
    el.addEventListener("blur", () => {
      el.contentEditable = "false";
      const text = el.textContent.trim();
      if (text) setValue(text);
      else el.textContent = getValue();
    });
  }
  const editorProjectNameEl = document.getElementById("editorProjectName");
  const editorRoomNameEl = document.getElementById("editorRoomName");
  setupInlineEdit(editorProjectNameEl, () => currentProject() ? currentProject().name : "", (val) => {
    if (currentProject()) currentProject().name = val;
    syncEditorHeader();
  });
  setupInlineEdit(editorRoomNameEl, () => currentRoom() ? currentRoom().name : "", (val) => {
    if (currentRoom()) currentRoom().name = val;
    syncEditorHeader();
    renderRoomSidebarList();
  });
  function syncEditorHeader() {
    const proj = currentProject(), R = currentRoom();
    editorProjectNameEl.textContent = proj ? proj.name : "";
    editorRoomNameEl.textContent = R ? R.name : "";
  }

  // ---------- Räume-Seitenleiste ----------
  function renderRoomSidebarList() {
    const proj = currentProject();
    const listEl2 = document.getElementById("roomSidebarList");
    if (!proj) { listEl2.innerHTML = ""; return; }
    listEl2.innerHTML = proj.rooms.map(r => `
      <div class="room-row${r.id === store.currentRoomId ? " active" : ""}" data-roomrow="${r.id}">
        <span class="room-row-name" data-roomrowname="${r.id}">${escapeXml(r.name)}</span>
        <button class="del-btn" data-roomrowdel="${r.id}">🗑</button>
        <div class="room-row-dims">
          <input type="number" data-roomw="${r.id}" value="${r.room.w}" min="50" max="1500" step="1">
          <span>×</span>
          <input type="number" data-roomd="${r.id}" value="${r.room.d}" min="50" max="1500" step="1">
          <span>cm</span>
        </div>
      </div>
    `).join("");

    listEl2.querySelectorAll("[data-roomrow]").forEach(row => {
      const rid = Number(row.dataset.roomrow);
      let clickTimer = null;
      row.addEventListener("click", (evt) => {
        if (evt.target.closest("[data-roomrowdel]") || evt.target.closest(".room-row-dims")) return;
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
        clickTimer = setTimeout(() => {
          clickTimer = null;
          if (rid !== store.currentRoomId) {
            store.currentRoomId = rid;
            selectedId = null;
            camera = { scale: 1, x: 0, y: 0 };
            fullRefresh();
          }
        }, 260);
      });
      row.addEventListener("dblclick", (evt) => {
        if (evt.target.closest("[data-roomrowdel]") || evt.target.closest(".room-row-dims")) return;
        evt.preventDefault();
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
        const span = row.querySelector("[data-roomrowname]");
        span.contentEditable = "true";
        span.focus();
        selectAllText(span);
        const commit = () => {
          span.contentEditable = "false";
          const text = span.textContent.trim();
          const room = proj.rooms.find(r => r.id === rid);
          if (text && room) room.name = text;
          renderRoomSidebarList();
          syncEditorHeader();
        };
        span.addEventListener("blur", commit, { once: true });
        span.addEventListener("keydown", (e2) => { if (e2.key === "Enter") { e2.preventDefault(); span.blur(); } });
      });
    });
    listEl2.querySelectorAll("[data-roomrowdel]").forEach(btn => {
      armConfirm(btn, "🗑", () => {
        const proj2 = currentProject();
        if (proj2.rooms.length <= 1) { showRoomSidebarMsg("Ein Projekt braucht mindestens einen Raum."); return; }
        const rid = Number(btn.dataset.roomrowdel);
        proj2.rooms = proj2.rooms.filter(r => r.id !== rid);
        if (store.currentRoomId === rid) {
          store.currentRoomId = proj2.rooms[0].id;
          selectedId = null;
          camera = { scale: 1, x: 0, y: 0 };
        }
        fullRefresh();
      });
    });
    function applyRoomDimChange(rid) {
      const proj2 = currentProject();
      const room = proj2.rooms.find(r => r.id === rid);
      if (!room) return;
      const wInput = listEl2.querySelector(`[data-roomw="${rid}"]`);
      const dInput = listEl2.querySelector(`[data-roomd="${rid}"]`);
      const w = Math.max(50, Math.min(1500, Number(wInput.value) || room.room.w));
      const d = Math.max(50, Math.min(1500, Number(dInput.value) || room.room.d));
      room.room = { w, d };
      room.openings = room.openings.filter(o => openingFits(o, room.room));
      if (rid === store.currentRoomId) {
        camera = { scale: 1, x: 0, y: 0 };
        render();
        renderOpeningList();
      }
      renderRoomSidebarList();
    }
    listEl2.querySelectorAll("[data-roomw], [data-roomd]").forEach(input => {
      input.addEventListener("pointerdown", (evt) => evt.stopPropagation());
      input.addEventListener("change", () => {
        applyRoomDimChange(Number(input.dataset.roomw || input.dataset.roomd));
      });
    });
  }
  function showRoomSidebarMsg(text) {
    const el = document.getElementById("roomSidebarMsg");
    el.textContent = text;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 3000);
  }
  document.getElementById("sidebarAddRoom").addEventListener("click", () => {
    const proj = currentProject();
    const r = makeRoom("Neuer Raum");
    proj.rooms.push(r);
    store.currentRoomId = r.id;
    selectedId = null;
    camera = { scale: 1, x: 0, y: 0 };
    fullRefresh();
  });

  // ---------- sync UI when switching project/room ----------
  function syncRoomBarInputs() {
    const R = currentRoom();
    if (!R) return;
    document.getElementById("floorType").value = R.floorType;
    refreshCornerOptions();
  }
  function fullRefresh() {
    syncEditorHeader();
    renderRoomSidebarList();
    syncRoomBarInputs();
    render();
    renderFurnitureList();
    renderOpeningList();
  }

  function toggleForm(id, show) {
    document.getElementById(id).classList.toggle("show", show);
  }

  function armConfirm(btn, defaultText, onConfirm) {
    let armed = false, timer = null;
    btn.addEventListener("click", () => {
      if (!armed) {
        armed = true;
        btn.textContent = "Wirklich?";
        btn.classList.add("armed");
        timer = setTimeout(() => { armed = false; btn.textContent = defaultText; btn.classList.remove("armed"); }, 2500);
      } else {
        clearTimeout(timer);
        armed = false;
        btn.textContent = defaultText;
        btn.classList.remove("armed");
        onConfirm();
      }
    });
  }

  // ---------- drawer ----------
  const drawer = document.getElementById("drawer");
  const drawerOverlay = document.getElementById("drawerOverlay");
  const drawerToggle = document.getElementById("drawerToggle");
  function openDrawer() { drawer.classList.add("open"); drawerOverlay.classList.add("open"); drawerToggle.textContent = "‹"; }
  function closeDrawer() { drawer.classList.remove("open"); drawerOverlay.classList.remove("open"); drawerToggle.textContent = "›"; }
  drawerToggle.addEventListener("click", () => { drawer.classList.contains("open") ? closeDrawer() : openDrawer(); });
  drawerOverlay.addEventListener("click", closeDrawer);

  window.addEventListener("resize", updateRotateButton);

  // ---------- landing page (Projekte + Räume-Übersicht) ----------
  const landingView = document.getElementById("landingView");
  const editorView = document.getElementById("editorView");

  function showLanding() {
    closeDrawer();
    editorView.style.display = "none";
    landingView.style.display = "block";
    drawerToggle.style.display = "none";
    renderLandingProjects();
  }
  function showEditor() {
    landingView.style.display = "none";
    editorView.style.display = "flex";
    drawerToggle.style.display = "flex";
    camera = { scale: 1, x: 0, y: 0 };
    fullRefresh();
  }
  document.getElementById("backToLanding").addEventListener("click", showLanding);

  function showLandingMsg(text) {
    const el = document.getElementById("landingMsg");
    el.textContent = text;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 3000);
  }

  let renameTarget = { type: null, projectId: null, roomId: null };
  function openLandingRename(type, projectId, roomId) {
    renameTarget = { type, projectId, roomId };
    const proj = store.projects.find(p => p.id === projectId);
    const name = type === "project" ? proj.name : proj.rooms.find(r => r.id === roomId).name;
    document.getElementById("landingRenameName").value = name;
    toggleForm("landingRenameForm", true);
    document.getElementById("landingRenameName").focus();
    document.getElementById("landingRenameName").select();
  }

  // ---------- Wohnungsübersicht (Räume anordnen & aneinander andocken) ----------
  const APT_SNAP = 20;

  function ensureRoomLayout(proj) {
    if (!proj.layout) proj.layout = {};
    proj.rooms.forEach((r, idx) => {
      if (!proj.layout[r.id]) {
        let x = 0;
        for (let i = 0; i < idx; i++) {
          const r2 = proj.rooms[i];
          const p2 = proj.layout[r2.id];
          if (p2) x = Math.max(x, p2.x + r2.room.w + 40);
        }
        proj.layout[r.id] = { x, y: 0 };
      }
    });
  }

  function svgPointFor(el, evt) {
    const pt = el.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(el.getScreenCTM().inverse());
  }

  function renderApartmentPreview(proj, svgEl) {
    ensureRoomLayout(proj);
    const pad = 30;
    const maxX = Math.max(...proj.rooms.map(r => proj.layout[r.id].x + r.room.w), 100);
    const maxY = Math.max(...proj.rooms.map(r => proj.layout[r.id].y + r.room.d), 100);
    const minX = Math.min(...proj.rooms.map(r => proj.layout[r.id].x), 0);
    const minY = Math.min(...proj.rooms.map(r => proj.layout[r.id].y), 0);
    svgEl.setAttribute("viewBox", `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`);
    svgEl.innerHTML = "";

    proj.rooms.forEach(r => {
      const pos = proj.layout[r.id];
      const g = document.createElementNS(NS, "g");
      g.dataset.roomId = r.id;
      g.style.cursor = "grab";
      const fontSize = Math.max(9, Math.min(r.room.w, r.room.d) * 0.09);
      g.innerHTML = `
        <rect x="${pos.x}" y="${pos.y}" width="${r.room.w}" height="${r.room.d}" fill="#EEF3FA" stroke="#1B4E8F" stroke-width="2" rx="2"/>
        <text x="${pos.x + r.room.w / 2}" y="${pos.y + r.room.d / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" fill="#16243B" font-weight="600">${escapeXml(r.name)}</text>
      `;
      g.addEventListener("pointerdown", (evt) => startApartmentDrag(evt, proj, r, svgEl));
      svgEl.appendChild(g);
    });
  }

  function startApartmentDrag(evt, proj, room, svgEl) {
    evt.stopPropagation();
    const g = evt.currentTarget;
    const pos = proj.layout[room.id];
    const p0 = svgPointFor(svgEl, evt);
    const offset = { x: p0.x - pos.x, y: p0.y - pos.y };
    g.setPointerCapture(evt.pointerId);

    function onMove(e2) {
      const p2 = svgPointFor(svgEl, e2);
      let nx = Math.round(p2.x - offset.x), ny = Math.round(p2.y - offset.y);
      const box = { minX: nx, maxX: nx + room.room.w, minY: ny, maxY: ny + room.room.d };
      let snappedX = false, snappedY = false;
      proj.rooms.forEach(other => {
        if (other.id === room.id) return;
        const op = proj.layout[other.id];
        const ob = { minX: op.x, maxX: op.x + other.room.w, minY: op.y, maxY: op.y + other.room.d };
        const vOverlap = box.minY < ob.maxY && box.maxY > ob.minY;
        const hOverlap = box.minX < ob.maxX && box.maxX > ob.minX;
        if (!snappedX && vOverlap) {
          if (Math.abs(box.maxX - ob.minX) <= APT_SNAP) { nx += (ob.minX - box.maxX); snappedX = true; }
          else if (Math.abs(box.minX - ob.maxX) <= APT_SNAP) { nx += (ob.maxX - box.minX); snappedX = true; }
        }
        if (!snappedY && hOverlap) {
          if (Math.abs(box.maxY - ob.minY) <= APT_SNAP) { ny += (ob.minY - box.maxY); snappedY = true; }
          else if (Math.abs(box.minY - ob.maxY) <= APT_SNAP) { ny += (ob.maxY - box.minY); snappedY = true; }
        }
      });
      pos.x = nx; pos.y = ny;
      g.querySelector("rect").setAttribute("x", nx);
      g.querySelector("rect").setAttribute("y", ny);
      const txt = g.querySelector("text");
      txt.setAttribute("x", nx + room.room.w / 2);
      txt.setAttribute("y", ny + room.room.d / 2);
    }
    function onUp() {
      svgEl.removeEventListener("pointermove", onMove);
      svgEl.removeEventListener("pointerup", onUp);
      svgEl.removeEventListener("pointercancel", onUp);
      g.style.cursor = "grab";
      renderApartmentPreview(proj, svgEl);
    }
    g.style.cursor = "grabbing";
    svgEl.addEventListener("pointermove", onMove);
    svgEl.addEventListener("pointerup", onUp);
    svgEl.addEventListener("pointercancel", onUp);
  }

  function renderLandingProjects() {
    const container = document.getElementById("projectCards");
    if (store.projects.length === 0) {
      container.innerHTML = '<p class="empty">Noch keine Projekte. Leg oben eine neue Wohnung an.</p>';
      return;
    }
    container.innerHTML = store.projects.map(p => {
      const roomsHtml = p.rooms.map(r => `
        <button class="room-chip" data-openroom="${p.id}:${r.id}" data-roomdbl="${p.id}:${r.id}">
          <span>${escapeXml(r.name)}</span>
          <span class="room-chip-dims">${r.room.w} × ${r.room.d} cm · ${r.items.length} Möbel</span>
        </button>
      `).join("");
      return `
        <div class="project-card">
          <div class="project-card-head">
            <h2 data-projtitle="${p.id}" title="Doppelklick zum Umbenennen">${escapeXml(p.name)}</h2>
            <div class="switch-row">
              <button class="icon-btn" data-toggleapt="${p.id}">🏠 Wohnungsübersicht</button>
              <button class="icon-btn" data-openproj="${p.id}">Öffnen</button>
              <button class="icon-btn danger" data-delproj="${p.id}">🗑</button>
            </div>
          </div>
          <div class="room-chip-list">
            ${roomsHtml}
            <button class="room-chip add-chip" data-addroom="${p.id}">+ Raum</button>
          </div>
          <div class="apt-preview-wrap" id="apt-wrap-${p.id}">
            <svg class="apt-preview" id="apt-svg-${p.id}" viewBox="0 0 100 100"></svg>
            <p class="apt-hint">Räume ziehen, um die Wohnung anzuordnen – nahe beieinander liegende Räume docken aneinander an.</p>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll("[data-openroom]").forEach(btn => {
      let clickTimer = null;
      btn.addEventListener("click", () => {
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
        clickTimer = setTimeout(() => {
          clickTimer = null;
          const [pid, rid] = btn.dataset.openroom.split(":").map(Number);
          store.currentProjectId = pid;
          store.currentRoomId = rid;
          selectedId = null;
          showEditor();
        }, 260);
      });
      btn.addEventListener("dblclick", (evt) => {
        evt.preventDefault();
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
        const [pid, rid] = btn.dataset.roomdbl.split(":").map(Number);
        openLandingRename("room", pid, rid);
      });
    });
    container.querySelectorAll("[data-projtitle]").forEach(h2 => {
      h2.addEventListener("dblclick", () => openLandingRename("project", Number(h2.dataset.projtitle)));
    });
    container.querySelectorAll("[data-openproj]").forEach(btn => {
      btn.addEventListener("click", () => {
        store.currentProjectId = Number(btn.dataset.openproj);
        ensureCurrentRoom();
        selectedId = null;
        showEditor();
      });
    });
    container.querySelectorAll("[data-addroom]").forEach(btn => {
      btn.addEventListener("click", () => {
        const proj = store.projects.find(x => x.id === Number(btn.dataset.addroom));
        proj.rooms.push(makeRoom("Neuer Raum"));
        renderLandingProjects();
      });
    });
    container.querySelectorAll("[data-toggleapt]").forEach(btn => {
      btn.addEventListener("click", () => {
        const pid = Number(btn.dataset.toggleapt);
        const wrap = document.getElementById("apt-wrap-" + pid);
        const willShow = !wrap.classList.contains("show");
        wrap.classList.toggle("show", willShow);
        if (willShow) {
          const proj = store.projects.find(p => p.id === pid);
          const svgEl = document.getElementById("apt-svg-" + pid);
          renderApartmentPreview(proj, svgEl);
        }
      });
    });
    container.querySelectorAll("[data-delproj]").forEach(btn => {
      armConfirm(btn, "🗑", () => {
        if (store.projects.length <= 1) { showLandingMsg("Es muss mindestens ein Projekt geben."); return; }
        const pid = Number(btn.dataset.delproj);
        store.projects = store.projects.filter(p => p.id !== pid);
        if (store.currentProjectId === pid) { store.currentProjectId = store.projects[0].id; ensureCurrentRoom(); }
        renderLandingProjects();
      });
    });
  }

  document.getElementById("landingNewProjectBtn").addEventListener("click", () => {
    document.getElementById("landingNewProjectName").value = "";
    toggleForm("landingNewProjectForm", true);
  });
  document.getElementById("landingNewProjectCancel").addEventListener("click", () => toggleForm("landingNewProjectForm", false));
  document.getElementById("landingNewProjectConfirm").addEventListener("click", () => {
    const name = document.getElementById("landingNewProjectName").value.trim();
    const p = makeProject(name);
    store.projects.push(p);
    store.currentProjectId = p.id;
    store.currentRoomId = p.rooms[0].id;
    selectedId = null;
    toggleForm("landingNewProjectForm", false);
    showEditor();
  });

  document.getElementById("landingRenameCancel").addEventListener("click", () => toggleForm("landingRenameForm", false));
  document.getElementById("landingRenameConfirm").addEventListener("click", () => {
    const name = document.getElementById("landingRenameName").value.trim();
    if (name) {
      const proj = store.projects.find(p => p.id === renameTarget.projectId);
      if (proj) {
        if (renameTarget.type === "project") proj.name = name;
        else if (renameTarget.type === "room") {
          const room = proj.rooms.find(r => r.id === renameTarget.roomId);
          if (room) room.name = name;
        }
      }
    }
    toggleForm("landingRenameForm", false);
    renderLandingProjects();
  });

  const landingImportFile = document.getElementById("landingImportFile");
  document.getElementById("landingImportTrigger").addEventListener("click", () => landingImportFile.click());
  landingImportFile.addEventListener("change", () => {
    const file = landingImportFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || !Array.isArray(parsed.projects) || parsed.projects.length === 0) throw new Error("Kein gültiges Projekt gefunden.");
        store = parsed;
        if (!store.currentProjectId || !store.projects.find(p => p.id === store.currentProjectId)) {
          store.currentProjectId = store.projects[0].id;
        }
        ensureCurrentRoom();
        selectedId = null;
        renderLandingProjects();
        showLandingMsg("Datei geladen.");
      } catch (err) {
        showLandingMsg("Datei konnte nicht geladen werden: " + err.message);
      }
      landingImportFile.value = "";
    };
    reader.readAsText(file);
  });

  showLanding();
