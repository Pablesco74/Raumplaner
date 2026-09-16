// ---------- Polygon-Shape: Datenmodell + Helfer (TA 1) ----------
  // Ein Raum-Shape besteht aus Vertices (CW-Windung in Screen-Coords)
  // und parallelen wallIds. Wand i geht von vertex[i] → vertex[(i+1)%n].

  /** Erzeugt ein Rechteck-Shape aus Breite/Tiefe. */
  function shapeFromRect(w, d) {
    return {
      vertices: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d }],
      wallIds: [1, 2, 3, 4]
    };
  }

  /** Baut ein Rechteck-Shape mit neuen Maßen, behält aber die vorhandenen wallIds. */
  function rebuildRectShape(w, d, existingShape) {
    const wallIds = (existingShape && existingShape.wallIds && existingShape.wallIds.length === 4)
      ? existingShape.wallIds.slice()
      : [1, 2, 3, 4];
    return {
      vertices: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d }],
      wallIds: wallIds
    };
  }

  /** Stellt sicher, dass ein Raum-Objekt ein Shape hat. Erzeugt es aus room.{w,d} falls nötig. */
  function ensureShape(roomObj) {
    if (roomObj.shape) return roomObj.shape;
    const { w, d } = roomObj.room;
    roomObj.shape = shapeFromRect(w, d);
    if (!roomObj.nextWallId) roomObj.nextWallId = 5;
    return roomObj.shape;
  }

  /** Geometrie einer Wand im Polygon (Index-basiert).
   *  Gibt start, end, tangent, normal (Innennormale = links der Laufrichtung bei CW),
   *  length und wallId zurück. */
  function getWallSegment(shape, idx) {
    const n = shape.vertices.length;
    const start = shape.vertices[idx];
    const end = shape.vertices[(idx + 1) % n];
    const dx = end.x - start.x, dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const tangent = length > 0 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 };
    // CW-Windung: Innennormale = links der Laufrichtung = (-ty, tx)
    const normal = { x: -tangent.y, y: tangent.x };
    return { start, end, tangent, normal, length, wallId: shape.wallIds[idx] };
  }

  /** Findet den Wall-Index zu einer wallId. Gibt -1 zurück wenn nicht gefunden. */
  function wallIndexById(shape, wallId) {
    return shape.wallIds.indexOf(wallId);
  }

  /** Splittet eine Wand am gegebenen Punkt. Längeres Segment behält die Original-ID,
   *  kürzeres bekommt die neue ID. Modifiziert shape in-place. */
  function splitWall(shape, wallIndex, point, nextWallIdFn) {
    const n = shape.vertices.length;
    const start = shape.vertices[wallIndex];
    const end = shape.vertices[(wallIndex + 1) % n];
    const originalId = shape.wallIds[wallIndex];

    const distToStart = Math.hypot(point.x - start.x, point.y - start.y);
    const distToEnd = Math.hypot(point.x - end.x, point.y - end.y);

    const newId = nextWallIdFn();
    let id1, id2;
    if (distToStart >= distToEnd) {
      id1 = originalId;
      id2 = newId;
    } else {
      id1 = newId;
      id2 = originalId;
    }

    shape.vertices.splice(wallIndex + 1, 0, { x: point.x, y: point.y });
    shape.wallIds.splice(wallIndex, 1, id1, id2);

    return shape;
  }

  /** Berechnet die Fläche des Polygons (positiv für CW in Screen-Coords). */
  function shapeArea(shape) {
    const verts = shape.vertices;
    const n = verts.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += verts[i].x * verts[j].y;
      area -= verts[j].x * verts[i].y;
    }
    return area / 2;
  }

  /** Prüft, ob ein Shape ein achsenparalleles Rechteck ist (4 Vertices, rechte Winkel). */
  function isAxisAlignedRect(shape) {
    if (!shape || shape.vertices.length !== 4) return false;
    const v = shape.vertices;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const dx = Math.abs(v[j].x - v[i].x);
      const dy = Math.abs(v[j].y - v[i].y);
      if (dx > 0.1 && dy > 0.1) return false;
    }
    return true;
  }

// ---------- Geometrie: Öffnungen + Wände (wallId-basiert, TA 2) ----------

  function pointAt(seg, s) {
    return { x: seg.start.x + seg.tangent.x * s, y: seg.start.y + seg.tangent.y * s };
  }

  function openingSpan(opening, shape) {
    const idx = wallIndexById(shape, opening.wallId);
    if (idx < 0) return null;
    const seg = getWallSegment(shape, idx);
    return { seg: seg, s0: opening.pos, s1: opening.pos + opening.width };
  }

  function openingFits(opening, shape) {
    const idx = wallIndexById(shape, opening.wallId);
    if (idx < 0) return false;
    const seg = getWallSegment(shape, idx);
    return opening.pos >= -0.5 && opening.width > 0 && opening.pos + opening.width <= seg.length + 0.5;
  }

  function wallCutoutPath(seg, s0, s1) {
    const p0 = pointAt(seg, s0), p1 = pointAt(seg, s1);
    const ox = -seg.normal.x, oy = -seg.normal.y;
    return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p1.x + ox * WALL_T} ${p1.y + oy * WALL_T} L ${p0.x + ox * WALL_T} ${p0.y + oy * WALL_T} Z`;
  }

  function openingHitPoly(opening, shape) {
    const span = openingSpan(opening, shape);
    if (!span) return null;
    const { seg, s0, s1 } = span;
    const margin = 22;
    const p0 = pointAt(seg, s0), p1 = pointAt(seg, s1);
    const nx = seg.normal.x, ny = seg.normal.y;
    const ox = -nx, oy = -ny;
    return [
      { x: p0.x + nx * margin, y: p0.y + ny * margin },
      { x: p1.x + nx * margin, y: p1.y + ny * margin },
      { x: p1.x + ox * WALL_T, y: p1.y + oy * WALL_T },
      { x: p0.x + ox * WALL_T, y: p0.y + oy * WALL_T }
    ];
  }

  function outerWallVertices(shape) {
    const n = shape.vertices.length;
    const outer = [];
    for (let i = 0; i < n; i++) {
      const V = shape.vertices[i];
      const prevSeg = getWallSegment(shape, (i - 1 + n) % n);
      const nextSeg = getWallSegment(shape, i);
      const on1x = -prevSeg.normal.x, on1y = -prevSeg.normal.y;
      const on2x = -nextSeg.normal.x, on2y = -nextSeg.normal.y;
      const mx = on1x + on2x, my = on1y + on2y;
      const mLen = Math.hypot(mx, my);
      if (mLen < 0.001) {
        outer.push({ x: V.x + on1x * WALL_T, y: V.y + on1y * WALL_T });
      } else {
        const mNx = mx / mLen, mNy = my / mLen;
        const dot = on1x * mNx + on1y * mNy;
        const scale = Math.min(WALL_T / Math.max(dot, 0.05), WALL_T * 4);
        outer.push({ x: V.x + mNx * scale, y: V.y + mNy * scale });
      }
    }
    return outer;
  }

  function verticesToPath(verts) {
    return verts.map(function(v, i) { return (i === 0 ? 'M' : 'L') + ' ' + v.x + ' ' + v.y; }).join(' ') + ' Z';
  }

  function shapeBBox(shape) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < shape.vertices.length; i++) {
      var v = shape.vertices[i];
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }

  /** Für Rechteck-Räume: UI-Info pro Wand (Label, Ecken-Namen, Richtungszuordnung). */
  function rectWallUiInfo(shape) {
    if (!isAxisAlignedRect(shape) || shape.wallIds.length !== 4) return null;
    return [
      { wallId: shape.wallIds[0], label: "Oben",   corners: ["links", "rechts"], startIsFirst: true },
      { wallId: shape.wallIds[1], label: "Rechts", corners: ["oben", "unten"],   startIsFirst: true },
      { wallId: shape.wallIds[2], label: "Unten",  corners: ["links", "rechts"], startIsFirst: false },
      { wallId: shape.wallIds[3], label: "Links",  corners: ["oben", "unten"],   startIsFirst: false }
    ];
  }

  function cornerDistToPos(wallId, shape, corner, dist, width) {
    var info = rectWallUiInfo(shape);
    var idx = wallIndexById(shape, wallId);
    if (idx < 0) return dist;
    var seg = getWallSegment(shape, idx);
    if (info) {
      var w = info.find(function(i) { return i.wallId === wallId; });
      if (w) {
        var isFirst = (corner === w.corners[0]);
        var isAtStart = w.startIsFirst ? isFirst : !isFirst;
        return isAtStart ? dist : seg.length - dist - width;
      }
    }
    return (corner === "Start") ? dist : seg.length - dist - width;
  }

  function posToCornerDist(opening, shape) {
    var idx = wallIndexById(shape, opening.wallId);
    if (idx < 0) return { corner: "?", dist: opening.pos };
    var seg = getWallSegment(shape, idx);
    var dS = opening.pos, dE = seg.length - opening.pos - opening.width;
    var info = rectWallUiInfo(shape);
    if (info) {
      var w = info.find(function(i) { return i.wallId === opening.wallId; });
      if (w) {
        if (dS <= dE) return { corner: w.startIsFirst ? w.corners[0] : w.corners[1], dist: Math.round(dS) };
        return { corner: w.startIsFirst ? w.corners[1] : w.corners[0], dist: Math.round(dE) };
      }
    }
    return dS <= dE ? { corner: "Start", dist: Math.round(dS) } : { corner: "Ende", dist: Math.round(dE) };
  }

  function hingeCornerToAtStart(wallId, shape, hingeCorner) {
    var info = rectWallUiInfo(shape);
    if (info) {
      var w = info.find(function(i) { return i.wallId === wallId; });
      if (w) {
        var isFirst = (hingeCorner === w.corners[0]);
        return w.startIsFirst ? isFirst : !isFirst;
      }
    }
    return (hingeCorner === "Start");
  }

  function hingeAtStartToCorner(opening, shape) {
    var info = rectWallUiInfo(shape);
    if (info) {
      var w = info.find(function(i) { return i.wallId === opening.wallId; });
      if (w) {
        if (opening.hingeAtStart) return w.startIsFirst ? w.corners[0] : w.corners[1];
        return w.startIsFirst ? w.corners[1] : w.corners[0];
      }
    }
    return opening.hingeAtStart ? "Start" : "Ende";
  }

  function wallLabelForId(wallId, shape) {
    var info = rectWallUiInfo(shape);
    if (info) {
      var w = info.find(function(i) { return i.wallId === wallId; });
      if (w) return w.label;
    }
    var idx = wallIndexById(shape, wallId);
    if (idx < 0) return "Wand ?";
    var seg = getWallSegment(shape, idx);
    return "Wand " + (idx + 1) + " (" + Math.round(seg.length) + " cm)";
  }

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
