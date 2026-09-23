// ---------- Vergleichsmodus (Aufgabe 2) ----------
  // Reiner Ansichtsmodus: zwei Panels, unabhängige Variantenauswahl,
  // gemeinsame Zoom/Pan-Transformation. Keine Bearbeitung möglich.
  // Session-only State, nicht Teil der gespeicherten Raumdaten.

  const compareView = document.getElementById("compareView");
  const comparePanelA = document.getElementById("comparePanelA");
  const comparePanelB = document.getElementById("comparePanelB");
  const compareSelA = document.getElementById("compareSelA");
  const compareSelB = document.getElementById("compareSelB");

  let compareCamera = { scale: 1, x: 0, y: 0 };
  let compareState = { variantIdxA: 0, variantIdxB: 0 };

  function populateCompareVariantSelect(selEl, R, selectedIdx) {
    selEl.innerHTML = R.variants.map(function(v, idx) {
      return `<option value="${idx}"${idx === selectedIdx ? ' selected' : ''}>${escapeXml(v.name)}</option>`;
    }).join('');
  }

  function renderComparePanel(svgEl, R, variant) {
    const w = R.room.w, d = R.room.d;
    svgEl.innerHTML = "";

    const defs = document.createElementNS(NS, "defs");
    const clipId = "floor-clip-" + svgEl.id;
    const clipPath = document.createElementNS(NS, "clipPath");
    clipPath.id = clipId;
    const clipPoly = document.createElementNS(NS, "polygon");
    clipPoly.setAttribute("points", R.shape.vertices.map(v => `${v.x},${v.y}`).join(' '));
    clipPath.appendChild(clipPoly);
    defs.appendChild(clipPath);
    svgEl.appendChild(defs);

    const floorGroup = document.createElementNS(NS, "g");
    floorGroup.setAttribute("clip-path", `url(#${clipId})`);
    floorGroup.innerHTML = floorSvg(w, d, variant.floorType);
    svgEl.appendChild(floorGroup);

    const wallsGroup = document.createElementNS(NS, "g");
    wallsGroup.innerHTML = wallsSvg(R);
    svgEl.appendChild(wallsGroup);

    R.openings.forEach(o => {
      const g = document.createElementNS(NS, "g");
      g.innerHTML = openingGroupInner(o, R.shape, true);
      svgEl.appendChild(g);
    });

    variant.items.forEach(item => {
      const cx = item.x + item.w / 2, cy = item.y + item.d / 2;
      const g = document.createElementNS(NS, "g");
      g.setAttribute("transform", `rotate(${item.rot} ${cx} ${cy})`);
      g.innerHTML = furnitureGroupInner(item, true);
      svgEl.appendChild(g);
    });
  }

  function applyCompareCamera(R) {
    const base = baseViewBox(R);
    const viewW = base.w / compareCamera.scale;
    const viewH = base.d / compareCamera.scale;
    const viewX = base.x + compareCamera.x;
    const viewY = base.y + compareCamera.y;
    const vb = `${viewX} ${viewY} ${viewW} ${viewH}`;
    comparePanelA.setAttribute("viewBox", vb);
    comparePanelB.setAttribute("viewBox", vb);
  }

  function compareRoom() {
    const R = currentRoom();
    return (R && R.id === compareState.roomId) ? R : null;
  }

  function renderCompareView() {
    const R = currentRoom();
    if (!R) return;
    ensureVariants(R);
    if (compareState.variantIdxA >= R.variants.length) compareState.variantIdxA = 0;
    if (compareState.variantIdxB >= R.variants.length) compareState.variantIdxB = 0;
    populateCompareVariantSelect(compareSelA, R, compareState.variantIdxA);
    populateCompareVariantSelect(compareSelB, R, compareState.variantIdxB);
    renderComparePanel(comparePanelA, R, R.variants[compareState.variantIdxA]);
    renderComparePanel(comparePanelB, R, R.variants[compareState.variantIdxB]);
    applyCompareCamera(R);
  }

  compareSelA.addEventListener("change", function() {
    const R = compareRoom();
    if (!R) return;
    compareState.variantIdxA = Number(compareSelA.value);
    renderComparePanel(comparePanelA, R, R.variants[compareState.variantIdxA]);
    applyCompareCamera(R);
  });
  compareSelB.addEventListener("change", function() {
    const R = compareRoom();
    if (!R) return;
    compareState.variantIdxB = Number(compareSelB.value);
    renderComparePanel(comparePanelB, R, R.variants[compareState.variantIdxB]);
    applyCompareCamera(R);
  });

  function openCompareMode() {
    const R = currentRoom();
    if (!R) return;
    closeSheet();
    saveCurrentVariant(R);
    compareState.roomId = R.id;
    compareState.variantIdxA = R.currentVariantIdx || 0;
    compareState.variantIdxB = R.currentVariantIdx || 0;
    compareCamera = { scale: 1, x: 0, y: 0 };
    document.getElementById("editorView").style.display = "none";
    compareView.style.display = "";
    renderCompareView();
  }

  function exitCompareMode() {
    compareView.style.display = "none";
    document.getElementById("editorView").style.display = "";
  }

  document.getElementById("compareBtn").addEventListener("click", openCompareMode);
  document.getElementById("compareExitBtn").addEventListener("click", exitCompareMode);

  // ---------- Zoom (Mausrad/Pinch) & Pan (Ziehen), synchron auf beide Panels ----------
  function compareZoomAt(svgEl, R, clientX, clientY, factor) {
    const svgRect = svgEl.getBoundingClientRect();
    if (svgRect.width === 0 || svgRect.height === 0) return;
    const vb = svgEl.viewBox.baseVal;
    const fx = (clientX - svgRect.left) / svgRect.width;
    const fy = (clientY - svgRect.top) / svgRect.height;
    const roomX = vb.x + fx * vb.width;
    const roomY = vb.y + fy * vb.height;
    const newScale = Math.max(0.4, Math.min(8, compareCamera.scale * factor));
    const base = baseViewBox(R);
    const newViewW = base.w / newScale, newViewH = base.d / newScale;
    compareCamera.scale = newScale;
    compareCamera.x = (roomX - fx * newViewW) - base.x;
    compareCamera.y = (roomY - fy * newViewH) - base.y;
    applyCompareCamera(R);
  }

  function attachComparePanZoom(svgEl) {
    const pointers = new Map();
    let panState = null;
    let pinchState = null;

    svgEl.addEventListener("wheel", (evt) => {
      const R = compareRoom();
      if (!R) return;
      evt.preventDefault();
      const factor = evt.deltaY < 0 ? 1.12 : 1 / 1.12;
      compareZoomAt(svgEl, R, evt.clientX, evt.clientY, factor);
    }, { passive: false });

    svgEl.addEventListener("contextmenu", (evt) => evt.preventDefault());

    svgEl.addEventListener("pointerdown", (evt) => {
      const R = compareRoom();
      if (!R) return;
      evt.preventDefault();
      pointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
      svgEl.setPointerCapture(evt.pointerId);
      if (pointers.size === 1) {
        panState = { startX: evt.clientX, startY: evt.clientY, startCamX: compareCamera.x, startCamY: compareCamera.y };
        pinchState = null;
      } else if (pointers.size === 2) {
        const pts = [...pointers.values()];
        const svgRect = svgEl.getBoundingClientRect();
        const vb = svgEl.viewBox.baseVal;
        const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
        pinchState = {
          startDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          startScale: compareCamera.scale,
          anchorRoomX: vb.x + ((midX - svgRect.left) / svgRect.width) * vb.width,
          anchorRoomY: vb.y + ((midY - svgRect.top) / svgRect.height) * vb.height
        };
        panState = null;
      }
    });

    svgEl.addEventListener("pointermove", (evt) => {
      if (!pointers.has(evt.pointerId)) return;
      pointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
      const R = compareRoom();
      if (!R) return;
      if (pointers.size === 1 && panState) {
        const svgRect = svgEl.getBoundingClientRect();
        const vb = svgEl.viewBox.baseVal;
        const scaleFactor = vb.width / svgRect.width;
        compareCamera.x = panState.startCamX - (evt.clientX - panState.startX) * scaleFactor;
        compareCamera.y = panState.startCamY - (evt.clientY - panState.startY) * scaleFactor;
        applyCompareCamera(R);
      } else if (pointers.size === 2 && pinchState) {
        const pts = [...pointers.values()];
        const newDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
        const factor = newDist / pinchState.startDist;
        const newScale = Math.max(0.4, Math.min(8, pinchState.startScale * factor));
        const base = baseViewBox(R);
        const newViewW = base.w / newScale, newViewH = base.d / newScale;
        const svgRect = svgEl.getBoundingClientRect();
        const fx = (midX - svgRect.left) / svgRect.width, fy = (midY - svgRect.top) / svgRect.height;
        compareCamera.scale = newScale;
        compareCamera.x = (pinchState.anchorRoomX - fx * newViewW) - base.x;
        compareCamera.y = (pinchState.anchorRoomY - fy * newViewH) - base.y;
        applyCompareCamera(R);
      }
    });

    function endPointer(evt) {
      pointers.delete(evt.pointerId);
      if (pointers.size === 0) {
        panState = null;
        pinchState = null;
      } else if (pointers.size === 1) {
        const remaining = [...pointers.values()][0];
        panState = { startX: remaining.x, startY: remaining.y, startCamX: compareCamera.x, startCamY: compareCamera.y };
        pinchState = null;
      }
    }
    svgEl.addEventListener("pointerup", endPointer);
    svgEl.addEventListener("pointercancel", endPointer);
  }

  attachComparePanZoom(comparePanelA);
  attachComparePanZoom(comparePanelB);
