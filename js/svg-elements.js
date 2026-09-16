// ---------- SVG-Bausteine: Wände, Öffnungen, Möbel-Icons ----------
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
  function jambTick(seg, s) {
    const p = pointAt(seg, s);
    const p2 = { x: p.x - seg.normal.x * WALL_T, y: p.y - seg.normal.y * WALL_T };
    return `<line x1="${p.x}" y1="${p.y}" x2="${p2.x}" y2="${p2.y}" stroke="#FFFFFF" stroke-width="1.5"/>`;
  }

  function openingSvg(opening, shape) {
    const span = openingSpan(opening, shape);
    if (!span) return '';
    const { seg, s0, s1 } = span;
    const P0 = pointAt(seg, s0);
    const P1 = pointAt(seg, s1);
    const color = opening.type === "door" ? "#1B4E8F" : "#2F80C8";
    let out = jambTick(seg, s0) + jambTick(seg, s1);
    if (opening.type === "window-double") {
      const sm = (s0 + s1) / 2;
      const Pm = pointAt(seg, sm);
      const halfW = (s1 - s0) / 2;
      out += jambTick(seg, sm);
      out += leafAndArcSvg(P0, Pm, seg.normal, halfW, color);
      out += leafAndArcSvg(P1, Pm, seg.normal, halfW, color);
    } else {
      const hinge = opening.hingeAtStart ? P0 : P1;
      const other = opening.hingeAtStart ? P1 : P0;
      out += leafAndArcSvg(hinge, other, seg.normal, s1 - s0, color);
    }
    return out;
  }

  function wallsSvg(R) {
    const shape = R.shape;
    const outer = outerWallVertices(shape);
    const outerPath = verticesToPath(outer);
    const innerPath = verticesToPath(shape.vertices);
    let out = `<path d="${outerPath} ${innerPath}" fill="#1F3A5C" fill-rule="evenodd"/>`;
    R.openings.forEach(o => {
      const span = openingSpan(o, shape);
      if (!span) return;
      out += `<path d="${wallCutoutPath(span.seg, span.s0, span.s1)}" fill="#FFFFFF"/>`;
    });
    return out;
  }

  function openingGroupInner(opening, shape) {
    const selected = opening.id === selectedOpeningId;
    const hitPoly = openingHitPoly(opening, shape);
    if (!hitPoly) return '';
    const hitPoints = hitPoly.map(p => `${p.x},${p.y}`).join(' ');
    let s = `<polygon points="${hitPoints}" fill="transparent" pointer-events="all"/>`;
    if (selected) {
      const span = openingSpan(opening, shape);
      if (span) {
        s += `<path d="${wallCutoutPath(span.seg, span.s0, span.s1)}" fill="none" stroke="#1B4E8F" stroke-width="2.5" stroke-dasharray="3 2"/>`;
      }
    }
    s += openingSvg(opening, shape);
    return s;
  }

  function refreshOpeningVisual(o) {
    const R = currentRoom();
    if (!R) return;
    const g = svg.querySelector(`g[data-opening-id="${o.id}"]`);
    if (g) g.innerHTML = openingGroupInner(o, R.shape);
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
    const fontSize = Math.min(Math.max(7, Math.min(item.w, item.d) * 0.13), 12);
    const lx = item.x + 3;
    const ly = item.y + item.d - 4;
    const counterRot = item.rot ? ` transform="rotate(${-item.rot} ${lx} ${ly})"` : '';
    const label = `<text x="${lx}" y="${ly}" text-anchor="start" fill="#2C2C2A" fill-opacity="0.8" font-size="${fontSize}" font-weight="600" pointer-events="none"${counterRot}>${escapeXml(item.name)}</text>`;

    const selOutline = selected
      ? `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.d}" fill="none" stroke="#1B4E8F" stroke-width="2.5" rx="3"/>`
      : "";
    const lockIcon = item.locked
      ? `<text x="${item.x + item.w - 3}" y="${item.y + 3 + Math.min(11, Math.min(item.w, item.d) * 0.16)}" text-anchor="end" font-size="${Math.min(11, Math.max(8, Math.min(item.w, item.d) * 0.16))}">🔒</text>`
      : "";
    return body + selOutline + furnitureDoorsSvg(item) + lockIcon + label;
  }
