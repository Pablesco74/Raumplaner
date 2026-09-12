// ---------- DOM-Referenzen + Kamera + Haupt-Render + Selektion ----------
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

  function svgPointFor(el, evt) {
    const pt = el.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(el.getScreenCTM().inverse());
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

    updateFurnitureLabels();
    updateRotateButton();
    updateMeasureGuides();
    updateOpeningMeasure();
    applyCamera();
    saveStore();
  }

  // ---------- unrotierte Möbel-Labels ----------
  function updateFurnitureLabels() {
    let group = svg.querySelector("#furnitureLabelsGroup");
    if (!group) { group = document.createElementNS(NS, "g"); group.id = "furnitureLabelsGroup"; svg.appendChild(group); }
    const R = currentRoom();
    if (!R || R.items.length === 0) { group.innerHTML = ""; return; }
    group.innerHTML = R.items.map(item => furnitureLabelSvg(item)).join("");
  }

  // ---------- selection ----------
  function refreshItemVisual(item) {
    const g = svg.querySelector(`g[data-id="${item.id}"]`);
    if (g) g.innerHTML = furnitureGroupInner(item);
    updateFurnitureLabels();
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
