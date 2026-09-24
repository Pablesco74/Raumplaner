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

  /** Wandrichtung in Grad (0° = rechts, 90° = unten). */
  function wallDirectionDeg(shape, idx) {
    var seg = getWallSegment(shape, idx);
    return Math.atan2(seg.tangent.y, seg.tangent.x) * 180 / Math.PI;
  }

  /** Innenwinkel am Vertex in Grad. */
  function interiorAngleDeg(shape, vertexIdx) {
    var n = shape.vertices.length;
    if (n < 3) return 0;
    var prevIdx = (vertexIdx - 1 + n) % n;
    var dir1 = wallDirectionDeg(shape, prevIdx) * Math.PI / 180;
    var dir2 = wallDirectionDeg(shape, vertexIdx) * Math.PI / 180;
    var turn = dir2 - dir1;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn <= -Math.PI) turn += 2 * Math.PI;
    return Math.round((Math.PI - turn) * 180 / Math.PI);
  }

  /** Ändert die Länge einer Wand — nur der End-Vertex verschiebt sich. */
  function setWallLength(shape, wallIdx, newLength) {
    var seg = getWallSegment(shape, wallIdx);
    var diff = newLength - seg.length;
    var endIdx = (wallIdx + 1) % shape.vertices.length;
    shape.vertices[endIdx] = {
      x: Math.round(shape.vertices[endIdx].x + seg.tangent.x * diff),
      y: Math.round(shape.vertices[endIdx].y + seg.tangent.y * diff)
    };
  }

  /** Entfernt einen Vertex (min. 3 Ecken bleiben). Gibt die gelöschte wallId zurück. */
  function removeShapeVertex(shape, vertexIdx) {
    if (shape.vertices.length <= 3) return null;
    var removedWallId = shape.wallIds[vertexIdx];
    shape.vertices.splice(vertexIdx, 1);
    shape.wallIds.splice(vertexIdx, 1);
    return removedWallId;
  }

  /** Fügt einen Vertex in die Mitte der gegebenen Wand ein. */
  function addVertexOnWall(shape, wallIdx, nextWallIdFn) {
    var seg = getWallSegment(shape, wallIdx);
    var midPoint = {
      x: Math.round((seg.start.x + seg.end.x) / 2),
      y: Math.round((seg.start.y + seg.end.y) / 2)
    };
    return splitWall(shape, wallIdx, midPoint, nextWallIdFn);
  }

  /** Winkel-Snap: projiziert rawPos auf nächsten 15°-Strahl ab anchor. */
  function snapVertexAngle(rawPos, anchorPos) {
    var dx = rawPos.x - anchorPos.x, dy = rawPos.y - anchorPos.y;
    var rawAngle = Math.atan2(dy, dx);
    var snapInc = Math.PI / 12;
    var snappedAngle = Math.round(rawAngle / snapInc) * snapInc;
    if (Math.abs(rawAngle - snappedAngle) > snapInc / 3) return rawPos;
    var dist = Math.hypot(dx, dy);
    return {
      x: Math.round(anchorPos.x + Math.cos(snappedAngle) * dist),
      y: Math.round(anchorPos.y + Math.sin(snappedAngle) * dist)
    };
  }

  /** Aktualisiert room.room.{w,d} aus dem Bounding-Box des Shapes. */
  function updateRoomDimsFromShape(room) {
    var bbox = shapeBBox(room.shape);
    room.room.w = Math.round(bbox.maxX - bbox.minX);
    room.room.d = Math.round(bbox.maxY - bbox.minY);
  }

  /** Findet die nächstgelegene Wand zu einem Punkt (Punkt-zu-Segment-Abstand). */
  function nearestWallForPoint(shape, point) {
    var bestIdx = 0, bestDist = Infinity, bestPos = 0;
    for (var i = 0; i < shape.vertices.length; i++) {
      var seg = getWallSegment(shape, i);
      var dx = point.x - seg.start.x, dy = point.y - seg.start.y;
      var t = dx * seg.tangent.x + dy * seg.tangent.y;
      var ct = Math.max(0, Math.min(seg.length, t));
      var px = seg.start.x + seg.tangent.x * ct;
      var py = seg.start.y + seg.tangent.y * ct;
      var dist = Math.hypot(point.x - px, point.y - py);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        bestPos = ct;
      }
    }
    return { wallIdx: bestIdx, wallId: shape.wallIds[bestIdx], pos: bestPos, distance: bestDist };
  }

  // ---------- bounding box + snapping ----------
  /** Die vier Eckpunkte eines (ggf. rotierten) Möbelstücks in Raumkoordinaten. */
  function itemCorners(item) {
    const cx = item.x + item.w / 2;
    const cy = item.y + item.d / 2;
    const rad = item.rot * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return [
      [-item.w / 2, -item.d / 2], [item.w / 2, -item.d / 2],
      [item.w / 2, item.d / 2], [-item.w / 2, item.d / 2]
    ].map(([lx, ly]) => ({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos }));
  }

  function getAABB(item) {
    const corners = itemCorners(item);
    return {
      minX: Math.min(...corners.map(c => c.x)), maxX: Math.max(...corners.map(c => c.x)),
      minY: Math.min(...corners.map(c => c.y)), maxY: Math.max(...corners.map(c => c.y))
    };
  }

  /** Ray-Casting Punkt-in-Polygon-Test. */
  function pointInPolygon(x, y, vertices) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y, xj = vertices[j].x, yj = vertices[j].y;
      const intersects = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  /** Liegt das (ggf. rotierte) Möbelstück vollständig innerhalb der Raumform? */
  function itemFitsInShape(item, shape) {
    return itemCorners(item).every(c => pointInPolygon(c.x, c.y, shape.vertices));
  }

  /**
   * Verschiebt ein Möbelstück, das nach einer Formänderung ganz oder
   * teilweise außerhalb der Raumfläche liegt, auf dem kürzesten Weg
   * Richtung Raummitte an die nächste Position, an der es wieder
   * vollständig innerhalb liegt (Aufgabe 6). Rotation bleibt erhalten.
   * Gibt true zurück, wenn das Möbelstück verschoben wurde.
   */
  function repositionItemIntoShape(item, shape) {
    if (itemFitsInShape(item, shape)) return false;
    const n = shape.vertices.length;
    const centroid = shape.vertices.reduce(
      (acc, v) => ({ x: acc.x + v.x / n, y: acc.y + v.y / n }), { x: 0, y: 0 }
    );
    const x0 = item.x, y0 = item.y;
    const dx = centroid.x - (x0 + item.w / 2), dy = centroid.y - (y0 + item.d / 2);
    const steps = 40;
    let result = { x: x0 + dx, y: y0 + dy }; // Fallback: Raummitte, falls nichts dazwischen passt
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const candidate = { x: x0 + dx * t, y: y0 + dy * t };
      if (itemFitsInShape({ x: candidate.x, y: candidate.y, w: item.w, d: item.d, rot: item.rot }, shape)) {
        result = candidate;
        break;
      }
    }
    item.x = Math.round(result.x);
    item.y = Math.round(result.y);
    return true;
  }

  function distPointToSegment(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) return { dist: Math.hypot(px - ax, py - ay), cx: ax, cy: ay, t: 0 };
    var t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    var cx = ax + t * dx, cy = ay + t * dy;
    return { dist: Math.hypot(px - cx, py - cy), cx: cx, cy: cy, t: t };
  }

  function signedDistToWallLine(px, py, seg) {
    var dx = px - seg.start.x, dy = py - seg.start.y;
    return dx * seg.normal.x + dy * seg.normal.y;
  }

  function nearestWallToAABBSide(box, shape, side) {
    var testPoints;
    if (side === "left")   testPoints = [{ x: box.minX, y: (box.minY + box.maxY) / 2 }];
    else if (side === "right")  testPoints = [{ x: box.maxX, y: (box.minY + box.maxY) / 2 }];
    else if (side === "top")    testPoints = [{ x: (box.minX + box.maxX) / 2, y: box.minY }];
    else                        testPoints = [{ x: (box.minX + box.maxX) / 2, y: box.maxY }];
    var bestDist = Infinity, bestWallIdx = -1, bestClosest = null;
    var n = shape.vertices.length;
    for (var i = 0; i < n; i++) {
      var seg = getWallSegment(shape, i);
      for (var j = 0; j < testPoints.length; j++) {
        var r = distPointToSegment(testPoints[j].x, testPoints[j].y,
          seg.start.x, seg.start.y, seg.end.x, seg.end.y);
        if (r.dist < bestDist) {
          bestDist = r.dist;
          bestWallIdx = i;
          bestClosest = { x: r.cx, y: r.cy };
        }
      }
    }
    return { dist: bestDist, wallIdx: bestWallIdx, closest: bestClosest };
  }

  function applySnapping(item, R) {
    var shape = R.shape;
    var n = shape.vertices.length;
    var box = getAABB(item);
    var cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
    var snapped = false;

    var bestDist = Infinity, bestShift = null;
    for (var i = 0; i < n; i++) {
      var seg = getWallSegment(shape, i);
      var sides = [
        { px: box.minX, py: cy, axis: "x", edge: box.minX },
        { px: box.maxX, py: cy, axis: "x", edge: box.maxX },
        { px: cx, py: box.minY, axis: "y", edge: box.minY },
        { px: cx, py: box.maxY, axis: "y", edge: box.maxY }
      ];
      for (var j = 0; j < 4; j++) {
        var s = sides[j];
        var r = distPointToSegment(s.px, s.py, seg.start.x, seg.start.y, seg.end.x, seg.end.y);
        if (r.dist <= SNAP && r.dist < bestDist) {
          bestDist = r.dist;
          bestShift = { dx: r.cx - s.px, dy: r.cy - s.py };
        }
      }
    }
    if (bestShift) {
      item.x += bestShift.dx;
      item.y += bestShift.dy;
      snapped = true;
    }

    box = getAABB(item);
    for (var k = 0; k < R.items.length; k++) {
      var other = R.items[k];
      if (other.id === item.id) continue;
      var ob = getAABB(other);
      var vOverlap = box.minY < ob.maxY && box.maxY > ob.minY;
      var hOverlap = box.minX < ob.maxX && box.maxX > ob.minX;
      if (vOverlap) {
        if (Math.abs(box.maxX - ob.minX) <= SNAP) { item.x += (ob.minX - box.maxX); }
        else if (Math.abs(box.minX - ob.maxX) <= SNAP) { item.x += (ob.maxX - box.minX); }
      }
      if (hOverlap) {
        if (Math.abs(box.maxY - ob.minY) <= SNAP) { item.y += (ob.minY - box.maxY); }
        else if (Math.abs(box.minY - ob.maxY) <= SNAP) { item.y += (ob.maxY - box.minY); }
      }
      box = getAABB(item);
    }
    item.x = Math.round(item.x);
    item.y = Math.round(item.y);
    return snapped;
  }

  function autoRotateToWall(item, R) {
    var shape = R.shape;
    var n = shape.vertices.length;
    var box = getAABB(item);
    var bestDist = Infinity, bestWallIdx = -1;
    var testPoints = [
      { x: box.minX, y: (box.minY + box.maxY) / 2 },
      { x: box.maxX, y: (box.minY + box.maxY) / 2 },
      { x: (box.minX + box.maxX) / 2, y: box.minY },
      { x: (box.minX + box.maxX) / 2, y: box.maxY }
    ];
    for (var i = 0; i < n; i++) {
      var seg = getWallSegment(shape, i);
      for (var j = 0; j < testPoints.length; j++) {
        var r = distPointToSegment(testPoints[j].x, testPoints[j].y,
          seg.start.x, seg.start.y, seg.end.x, seg.end.y);
        if (r.dist < bestDist) { bestDist = r.dist; bestWallIdx = i; }
      }
    }
    if (bestDist > SNAP || bestWallIdx < 0) return false;
    var seg = getWallSegment(shape, bestWallIdx);
    var wallAngle = Math.atan2(seg.tangent.y, seg.tangent.x) * 180 / Math.PI;
    var snapRot = Math.round(wallAngle / 90) * 90;
    if (Math.abs(wallAngle - snapRot) < 1) return false;
    var candidate = Math.round(wallAngle);
    while (candidate < 0) candidate += 360;
    candidate = candidate % 360;
    if (item.rot === candidate) return false;
    item.rot = candidate;
    return true;
  }

  function nearestEdges(item, R) {
    var shape = R.shape;
    var box = getAABB(item);
    var cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;

    var leftRes = nearestWallToAABBSide(box, shape, "left");
    var rightRes = nearestWallToAABBSide(box, shape, "right");
    var topRes = nearestWallToAABBSide(box, shape, "top");
    var bottomRes = nearestWallToAABBSide(box, shape, "bottom");

    var leftGap = leftRes.dist, leftTarget = leftRes.closest ? leftRes.closest.x : 0;
    var rightGap = rightRes.dist, rightTarget = rightRes.closest ? rightRes.closest.x : box.maxX;
    var topGap = topRes.dist, topTarget = topRes.closest ? topRes.closest.y : 0;
    var bottomGap = bottomRes.dist, bottomTarget = bottomRes.closest ? bottomRes.closest.y : box.maxY;

    R.items.forEach(function(other) {
      if (other.id === item.id) return;
      var ob = getAABB(other);
      var vOverlap = box.minY < ob.maxY && box.maxY > ob.minY;
      var hOverlap = box.minX < ob.maxX && box.maxX > ob.minX;
      if (vOverlap) {
        var gapL = box.minX - ob.maxX;
        if (gapL >= 0 && gapL < leftGap) { leftGap = gapL; leftTarget = ob.maxX; }
        var gapR = ob.minX - box.maxX;
        if (gapR >= 0 && gapR < rightGap) { rightGap = gapR; rightTarget = ob.minX; }
      }
      if (hOverlap) {
        var gapT = box.minY - ob.maxY;
        if (gapT >= 0 && gapT < topGap) { topGap = gapT; topTarget = ob.maxY; }
        var gapB = ob.minY - box.maxY;
        if (gapB >= 0 && gapB < bottomGap) { bottomGap = gapB; bottomTarget = ob.minY; }
      }
    });
    var horiz = (leftGap <= rightGap)
      ? { gap: leftGap, from: box.minX, to: leftTarget }
      : { gap: rightGap, from: box.maxX, to: rightTarget };
    var vert = (topGap <= bottomGap)
      ? { gap: topGap, from: box.minY, to: topTarget }
      : { gap: bottomGap, from: box.maxY, to: bottomTarget };
    return { horiz: horiz, vert: vert, box: box };
  }
