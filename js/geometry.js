// ---------- Geometrie: Wände, Öffnungen, AABB, Snapping ----------
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

  function wallBandRect(wall, s0, s1, dims) {
    const { w, d } = dims;
    switch (wall) {
      case "top":    return { x: s0, y: -WALL_T, width: s1 - s0, height: WALL_T };
      case "bottom": return { x: s0, y: d, width: s1 - s0, height: WALL_T };
      case "left":   return { x: -WALL_T, y: s0, width: WALL_T, height: s1 - s0 };
      case "right":  return { x: w, y: s0, width: WALL_T, height: s1 - s0 };
    }
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
