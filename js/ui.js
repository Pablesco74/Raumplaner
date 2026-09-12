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
    saveStoreNow();
  });
  setupInlineEdit(editorRoomNameEl, () => currentRoom() ? currentRoom().name : "", (val) => {
    if (currentRoom()) currentRoom().name = val;
    syncEditorHeader();
    renderRoomSidebarList();
    saveStoreNow();
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

    // Räume nach Etage gruppieren (absteigend: höchstes Stockwerk zuerst)
    const byFloor = {};
    proj.rooms.forEach(r => {
      const f = (r.floor != null) ? r.floor : 0;
      if (!byFloor[f]) byFloor[f] = [];
      byFloor[f].push(r);
    });
    const sortedFloors = Object.keys(byFloor).map(Number).sort((a, b) => b - a);
    const hasMultipleFloors = sortedFloors.length > 1;

    let html = "";
    sortedFloors.forEach(f => {
      if (hasMultipleFloors) {
        html += `<div class="floor-group-label">${floorLabel(f)}</div>`;
      }
      byFloor[f].forEach(r => {
        html += `
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
        `;
      });
    });
    listEl2.innerHTML = html;

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
            saveStoreNow();
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
          saveStoreNow();
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
        saveStoreNow();
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
      saveStoreNow();
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
    saveStoreNow();
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
    clearMeasureToolLines();
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

  // ---------- Messwerkzeug Toggle ----------
  document.getElementById("measureToolBtn").addEventListener("click", toggleMeasureTool);

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
      saveStoreNow();
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
          saveStoreNow();
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
        saveStoreNow();
        showEditor();
      });
    });
    container.querySelectorAll("[data-addroom]").forEach(btn => {
      btn.addEventListener("click", () => {
        const proj = store.projects.find(x => x.id === Number(btn.dataset.addroom));
        proj.rooms.push(makeRoom("Neuer Raum"));
        saveStoreNow();
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
        saveStoreNow();
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
    saveStoreNow();
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
    saveStoreNow();
  });

  document.getElementById("landingExportBtn").addEventListener("click", exportStoreAsFile);

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
        saveStoreNow();
        renderLandingProjects();
        showLandingMsg("Datei geladen.");
      } catch (err) {
        showLandingMsg("Datei konnte nicht geladen werden: " + err.message);
      }
      landingImportFile.value = "";
    };
    reader.readAsText(file);
  });

  // Sicherheitsnetz: beim Schließen des Tabs sofort speichern
  window.addEventListener("beforeunload", saveStoreNow);

  showLanding();
