// ---------- Bodenbelag-SVG ----------
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
