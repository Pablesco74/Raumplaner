// ---------- Vertex-Drag (TA 4) ----------
  let vertexDragging = null;

  function startVertexDrag(evt) {
    evt.stopPropagation();
    if (measureToolActive) return;
    const R = currentRoom();
    if (!R) return;
    const idx = Number(evt.currentTarget.dataset.vertex);
    const p = svgPoint(evt);
    vertexDragging = { idx: idx, offsetX: p.x - R.shape.vertices[idx].x, offsetY: p.y - R.shape.vertices[idx].y };
    evt.currentTarget.setPointerCapture(evt.pointerId);
    svg.addEventListener("pointermove", onVertexDrag);
    svg.addEventListener("pointerup", endVertexDrag);
    svg.addEventListener("pointercancel", endVertexDrag);
  }

  function onVertexDrag(evt) {
    if (!vertexDragging) return;
    const R = currentRoom();
    if (!R) return;
    const p = svgPoint(evt);
    var rawX = p.x - vertexDragging.offsetX;
    var rawY = p.y - vertexDragging.offsetY;
    var n = R.shape.vertices.length;
    var prevIdx = (vertexDragging.idx - 1 + n) % n;
    var anchor = R.shape.vertices[prevIdx];
    var snapped = snapVertexAngle({ x: rawX, y: rawY }, anchor);
    R.shape.vertices[vertexDragging.idx] = { x: Math.round(snapped.x), y: Math.round(snapped.y) };
    updateRoomDimsFromShape(R);
    render();
    renderShapeTable();
  }

  function endVertexDrag() {
    vertexDragging = null;
    svg.removeEventListener("pointermove", onVertexDrag);
    svg.removeEventListener("pointerup", endVertexDrag);
    svg.removeEventListener("pointercancel", endVertexDrag);
    const R = currentRoom();
    if (R) {
      R.openings = R.openings.filter(function(o) { return openingFits(o, R.shape); });
    }
    render();
    renderOpeningList();
    renderShapeTable();
    renderRoomSidebarList();
    saveStoreNow();
  }

// ---------- Zoom (Mausrad) & Pan (rechte Maustaste / Touch) ----------
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
    if (evt.target !== svg) return;
    if (evt.pointerType === "mouse") {
      if (evt.button === 2) {
        evt.preventDefault();
        mousePan = { startX: evt.clientX, startY: evt.clientY, startCamX: camera.x, startCamY: camera.y };
        svg.setPointerCapture(evt.pointerId);
        svg.style.cursor = "grabbing";
      } else if (evt.button === 0) {
        if (measureToolActive) { measureToolClick(evt); return; }
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
      if (singleTouchPan && !singleTouchPan.moved) {
        if (measureToolActive) { measureToolClick(evt); }
        else deselect();
      }
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

  // ---------- Werkzeug-Leiste (drehen, sperren, löschen) ----------
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
      saveStoreNow();
    } else if (tool === "lock") {
      item.locked = !item.locked;
      refreshItemVisual(item);
      const gEl = svg.querySelector(`g[data-id="${item.id}"]`);
      if (gEl) gEl.style.cursor = item.locked ? "pointer" : "grab";
      updateRotateButton();
      saveStoreNow();
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
      g.addEventListener("pointerdown", (evt) => {
        // preventDefault: verhindert, dass der Browser das gerade fokussierte
        // measureInput sofort wieder blurt (Klickziel ist ein nicht
        // fokussierbares SVG-<g>, sonst schließt sich das Feld augenblicklich).
        evt.preventDefault();
        evt.stopPropagation();
        openMeasureEditor(g.dataset.axis, item, R);
      });
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
    const span = openingSpan(o, R.shape);
    if (!span) { group.innerHTML = ""; return; }
    const { seg, s0, s1 } = span;
    const dStart = s0;
    const dEnd = seg.length - s1;
    const nearerToStart = dStart <= dEnd;
    const cornerS = nearerToStart ? 0 : seg.length;
    const nearS = nearerToStart ? s0 : s1;
    const dist = nearerToStart ? dStart : dEnd;
    if (dist < 0.5) { group.innerHTML = ""; return; }
    const offset = 24;
    const p1 = pointAt(seg, cornerS);
    const p2 = pointAt(seg, nearS);
    const o1 = { x: p1.x + seg.normal.x * offset, y: p1.y + seg.normal.y * offset };
    const o2 = { x: p2.x + seg.normal.x * offset, y: p2.y + seg.normal.y * offset };
    const mid = { x: (o1.x + o2.x) / 2, y: (o1.y + o2.y) / 2 };
    let s = `<line x1="${o1.x}" y1="${o1.y}" x2="${o2.x}" y2="${o2.y}" stroke="#1B4E8F" stroke-width="0.8" stroke-dasharray="2 2"/>`;
    s += `<line x1="${p1.x}" y1="${p1.y}" x2="${o1.x}" y2="${o1.y}" stroke="#1B4E8F" stroke-width="0.6" stroke-dasharray="1 2"/>`;
    s += `<line x1="${p2.x}" y1="${p2.y}" x2="${o2.x}" y2="${o2.y}" stroke="#1B4E8F" stroke-width="0.6" stroke-dasharray="1 2"/>`;
    s += `<g class="opening-measure-label" style="cursor:pointer">
      <rect x="${mid.x - 15}" y="${mid.y - 8}" width="30" height="16" rx="3" fill="#FFFFFF" stroke="#1B4E8F" stroke-width="0.8"/>
      <text x="${mid.x}" y="${mid.y + 3.5}" text-anchor="middle" font-size="9" fill="#1B4E8F" font-family="Courier New, monospace">${Math.round(dist)}</text>
    </g>`;
    group.innerHTML = s;
    group.querySelector(".opening-measure-label").addEventListener("pointerdown", (evt) => {
      evt.preventDefault();
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
    const R = currentRoom();
    const span = openingSpan(o, R.shape);
    const dist = span ? Math.round(Math.min(span.s0, span.seg.length - span.s1)) : 0;
    measureInput.value = dist;
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
    const span = openingSpan(o, R.shape);
    if (!span) return;
    const { seg } = span;
    const p = svgPoint(evt);
    const dx = p.x - seg.start.x, dy = p.y - seg.start.y;
    const pointerS = dx * seg.tangent.x + dy * seg.tangent.y;
    openingDragging = { id, offsetS: pointerS - o.pos };
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
    const idx = wallIndexById(R.shape, o.wallId);
    if (idx < 0) return;
    const seg = getWallSegment(R.shape, idx);
    const p = svgPoint(evt);
    const dx = p.x - seg.start.x, dy = p.y - seg.start.y;
    const pointerS = dx * seg.tangent.x + dy * seg.tangent.y;
    let newPos = pointerS - openingDragging.offsetS;
    newPos = Math.max(0, Math.min(seg.length - o.width, newPos));
    o.pos = Math.round(newPos);
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
    saveStoreNow();
  }

  // ---------- Öffnungen per Drag & Drop auf Grundriss platzieren (TA 3) ----------
  let openingPlacement = null;

  function defaultOpeningWidth(type) {
    return type === 'window-double' ? 120 : 90;
  }

  function startOpeningPlacement(evt) {
    evt.preventDefault();
    if (measureToolActive) return;
    const type = evt.currentTarget.dataset.paletteType;
    const width = defaultOpeningWidth(type);
    openingPlacement = { type, width };
    document.addEventListener('pointermove', onOpeningPlacement);
    document.addEventListener('pointerup', endOpeningPlacement);
    document.addEventListener('pointercancel', cancelOpeningPlacement);
    document.body.style.cursor = 'crosshair';
  }

  function onOpeningPlacement(evt) {
    if (!openingPlacement) return;
    const R = currentRoom();
    if (!R) { removeOpeningPreview(); return; }
    const svgRect = svg.getBoundingClientRect();
    if (evt.clientX < svgRect.left || evt.clientX > svgRect.right ||
        evt.clientY < svgRect.top || evt.clientY > svgRect.bottom) {
      removeOpeningPreview();
      return;
    }
    const point = svgPoint(evt);
    const result = nearestWallForPoint(R.shape, point);
    const seg = getWallSegment(R.shape, result.wallIdx);
    const width = openingPlacement.width;
    const pos = Math.round(Math.max(0, Math.min(seg.length - width, result.pos - width / 2)));
    const preview = { wallId: result.wallId, type: openingPlacement.type, width: width, pos: pos, hingeAtStart: true };
    renderOpeningPreview(preview, R.shape);
  }

  function endOpeningPlacement(evt) {
    cleanupOpeningPlacement();
    const R = currentRoom();
    if (!R || !openingPlacement) { openingPlacement = null; return; }
    const svgRect = svg.getBoundingClientRect();
    if (evt.clientX < svgRect.left || evt.clientX > svgRect.right ||
        evt.clientY < svgRect.top || evt.clientY > svgRect.bottom) {
      openingPlacement = null;
      return;
    }
    const point = svgPoint(evt);
    const result = nearestWallForPoint(R.shape, point);
    const seg = getWallSegment(R.shape, result.wallIdx);
    const width = openingPlacement.width;
    const pos = Math.round(Math.max(0, Math.min(seg.length - width, result.pos - width / 2)));
    const candidate = { wallId: result.wallId, type: openingPlacement.type, width: width, pos: pos, hingeAtStart: true };
    if (openingFits(candidate, R.shape)) {
      candidate.id = R.nextOpeningId++;
      R.openings.push(candidate);
      render();
      renderOpeningList();
      selectOpening(candidate.id);
      saveStoreNow();
    }
    openingPlacement = null;
  }

  function cancelOpeningPlacement() {
    cleanupOpeningPlacement();
    openingPlacement = null;
  }

  function cleanupOpeningPlacement() {
    document.removeEventListener('pointermove', onOpeningPlacement);
    document.removeEventListener('pointerup', endOpeningPlacement);
    document.removeEventListener('pointercancel', cancelOpeningPlacement);
    document.body.style.cursor = '';
    removeOpeningPreview();
  }

  function renderOpeningPreview(opening, shape) {
    removeOpeningPreview();
    const span = openingSpan(opening, shape);
    if (!span) return;
    const g = document.createElementNS(NS, 'g');
    g.id = 'openingPlacementPreview';
    g.style.opacity = '0.5';
    g.style.pointerEvents = 'none';
    g.innerHTML = '<path d="' + wallCutoutPath(span.seg, span.s0, span.s1) + '" fill="#FFFFFF"/>' + openingSvg(opening, shape);
    svg.appendChild(g);
  }

  function removeOpeningPreview() {
    const el = svg.querySelector('#openingPlacementPreview');
    if (el) el.remove();
  }

  document.querySelectorAll('[data-palette-type]').forEach(function(btn) {
    btn.addEventListener('pointerdown', startOpeningPlacement);
  });

  function commitMeasureInput() {
    if (measureInput.style.display === "none") return;
    const R = currentRoom();
    if (measureInput.dataset.mode === "opening") {
      const o = R ? R.openings.find(x => x.id === Number(measureInput.dataset.openingId)) : null;
      if (o) {
        const span = openingSpan(o, R.shape);
        if (span) {
          const { seg, s0, s1 } = span;
          const nearerToStart = s0 <= seg.length - s1;
          const newDist = Math.max(0, Number(measureInput.value) || 0);
          const prevPos = o.pos;
          o.pos = nearerToStart ? newDist : seg.length - newDist - o.width;
          if (!openingFits(o, R.shape)) { o.pos = prevPos; }
        }
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
      saveStoreNow();
    }
    measureInput.style.display = "none";
  }
  measureInput.addEventListener("pointerdown", (evt) => evt.stopPropagation());
  measureInput.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") commitMeasureInput();
    else if (evt.key === "Escape") measureInput.style.display = "none";
  });
  measureInput.addEventListener("blur", commitMeasureInput);

  // ---------- dragging ----------
  let dragging = null;
  function startDrag(evt) {
    evt.stopPropagation();
    if (measureToolActive) return; // Messmodus: kein Drag
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
    const bbox = shapeBBox(R.shape);
    item.x = Math.max(bbox.minX - margin, Math.min(bbox.maxX + margin - item.w, item.x));
    item.y = Math.max(bbox.minY - margin, Math.min(bbox.maxY + margin - item.d, item.y));
    autoRotateToWall(item, R);
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
    saveStoreNow();
  }
