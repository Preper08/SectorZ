/* Dead SectorZ — procedural wall faces (flat elevation art, sheared into iso faces) */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, C = DSZ.C;
  const WH = C.WH, AW = 64;
  const Walls = DSZ.Walls = {};
  const cache = new Map();

  const COL = {
    siding_w: [186, 184, 176], siding_b: [128, 150, 170], siding_g: [120, 146, 118], siding_y: [190, 172, 118], siding_r: [150, 82, 70],
    brick_r: [128, 66, 52], brick_b: [104, 72, 56], block: [128, 128, 124], stucco: [186, 170, 140], metal: [112, 122, 130], barn: [120, 52, 44],
    bwood: [150, 108, 66], bmetal: [118, 124, 132],
    int_cream: [196, 184, 150], int_green: [134, 156, 128], int_blue: [128, 146, 168], int_tile: [200, 204, 204], int_conc: [120, 120, 118], int_dark: [96, 82, 78]
  };
  Walls.mats = Object.keys(COL);
  const rgb = (c, k) => 'rgb(' + Math.min(255, c[0] * k | 0) + ',' + Math.min(255, c[1] * k | 0) + ',' + Math.min(255, c[2] * k | 0) + ')';

  function weather(x, rng, str, bottomGrime) {
    for (let i = 0; i < 26 * str; i++) { // rain streaks
      const px = rng() * AW, w = 0.6 + rng() * 2, h = 12 + rng() * 60, py = rng() * (WH - h);
      const g = x.createLinearGradient(0, py, 0, py + h);
      g.addColorStop(0, 'rgba(10,8,6,0)'); g.addColorStop(0.3, 'rgba(10,8,6,' + (0.06 + rng() * 0.1) + ')'); g.addColorStop(1, 'rgba(10,8,6,0)');
      x.fillStyle = g; x.fillRect(px, py, w, h);
    }
    for (let i = 0; i < 160 * str; i++) { x.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,' + rng() * 0.12 + ')' : 'rgba(255,255,255,' + rng() * 0.07 + ')'; x.fillRect(rng() * AW, rng() * WH, 1 + rng() * 2, 1 + rng() * 2); }
    if (bottomGrime !== false) {
      const g = x.createLinearGradient(0, WH - 32, 0, WH); g.addColorStop(0, 'rgba(24,18,12,0)'); g.addColorStop(1, 'rgba(24,18,12,0.5)'); x.fillStyle = g; x.fillRect(0, WH - 32, AW, 32);
      for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(40,60,30,' + (0.1 + rng() * 0.2) + ')'; x.beginPath(); x.ellipse(rng() * AW, WH - rng() * 8, 3 + rng() * 6, 1 + rng() * 4, 0, 0, 7); x.fill(); }
    }
    const g2 = x.createLinearGradient(0, 0, 0, 16); g2.addColorStop(0, 'rgba(0,0,0,0.38)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g2; x.fillRect(0, 0, AW, 16);
  }

  function baseArt(x, mat, rng) {
    const c = COL[mat] || COL.block, v = 0.9 + rng() * 0.2;
    x.fillStyle = rgb(c, v); x.fillRect(0, 0, AW, WH);
    if (mat.indexOf('siding') === 0) {
      for (let y = 0; y < WH; y += 8) {
        x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(0, y + 6, AW, 2);
        x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, y, AW, 1.5);
        if (rng() < 0.2) { x.fillStyle = 'rgba(' + (rng() < 0.5 ? '0,0,0' : '255,255,255') + ',0.07)'; x.fillRect(0, y + 1, AW, 5); }
      }
      for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(230,226,214,0.35)'; const px = rng() * 56, py = rng() * (WH - 14); x.beginPath(); x.moveTo(px, py); x.lineTo(px + 4 + rng() * 6, py + rng() * 2); x.lineTo(px + 3 + rng() * 5, py + 4 + rng() * 6); x.lineTo(px, py + 3); x.fill(); } // peeling
    } else if (mat.indexOf('brick') === 0 || mat === 'store_brick') {
      x.fillStyle = 'rgba(40,34,30,0.9)'; x.fillRect(0, 0, AW, WH);
      for (let r = 0, y = 0; y < WH; r++, y += 6) for (let bx = (r & 1) ? -8 : 0; bx < AW; bx += 16) {
        const k = 0.72 + rng() * 0.5; x.fillStyle = rgb(c, k); x.fillRect(bx + 0.5, y + 0.5, 15, 5);
        x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(bx + 0.5, y + 0.5, 15, 1);
        if (rng() < 0.05) { x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(bx + 3, y + 1, 9, 4); }
      }
    } else if (mat === 'block') {
      for (let y = 0; y < WH; y += 12) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, y, AW, 1.5); for (let bx = (y / 12 & 1) ? 0 : 16; bx < AW; bx += 32) x.fillRect(bx, y, 1.5, 12); }
    } else if (mat === 'metal' || mat === 'bmetal') {
      for (let px = 0; px < AW; px += 4) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, 0, 1.4, WH); x.fillStyle = 'rgba(255,255,255,0.13)'; x.fillRect(px + 2, 0, 1.2, WH); }
      for (let i = 0; i < 7; i++) { const px = rng() * AW, g = x.createLinearGradient(0, 0, 0, WH); g.addColorStop(0, 'rgba(120,60,24,0)'); g.addColorStop(0.5, 'rgba(120,60,24,0.35)'); g.addColorStop(1, 'rgba(120,60,24,0)'); x.fillStyle = g; x.fillRect(px, 0, 2 + rng() * 5, WH); }
    } else if (mat === 'barn') {
      for (let px = 0; px < AW; px += 10) { x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(px, 0, 1.5, WH); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(px + 2, 0, 1, WH); }
    } else if (mat === 'bwood') {
      for (let y = 0; y < WH; y += 11) { x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(0, y + 9, AW, 2); x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, y, AW, 1); x.fillStyle = rgb(c, 0.85 + rng() * 0.3); x.globalAlpha = 0.4; x.fillRect(0, y + 1, AW, 8); x.globalAlpha = 1; }
      x.fillStyle = 'rgba(40,28,16,0.8)'; for (let y = 4; y < WH; y += 11) { x.fillRect(4, y, 2, 2); x.fillRect(58, y, 2, 2); }
    } else if (mat === 'stucco') {
      for (let i = 0; i < 400; i++) { x.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'; x.fillRect(rng() * AW, rng() * WH, 2, 2); }
      if (rng() < 0.6) { x.strokeStyle = 'rgba(30,24,20,0.6)'; x.lineWidth = 1; x.beginPath(); let px = rng() * AW, py = 0; x.moveTo(px, py); while (py < WH * 0.7) { px += (rng() - 0.5) * 6; py += 4 + rng() * 5; x.lineTo(px, py); } x.stroke(); }
    } else if (mat === 'int_tile') {
      x.fillStyle = rgb(c, 1); x.fillRect(0, 0, AW, WH);
      for (let y = 0; y < WH; y += 16) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, y, AW, 1); } for (let px = 0; px < AW; px += 16) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(px, 0, 1, WH); }
    } else if (mat.indexOf('int_') === 0) {
      for (let px = 0; px < AW; px += 8) { x.fillStyle = 'rgba(255,255,255,' + (px % 16 ? 0.05 : 0) + ')'; x.fillRect(px, 0, 8, WH); }
      x.fillStyle = rgb(c, 0.6); x.fillRect(0, WH - 30, AW, 30);            // wainscot
      x.fillStyle = rgb(c, 0.4); x.fillRect(0, WH - 31, AW, 2);
      x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, WH - 6, AW, 6);        // baseboard
      x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, WH - 6, AW, 1);
    }
    weather(x, rng, mat.indexOf('int_') === 0 ? 0.6 : 1, mat.indexOf('int_') !== 0);
  }

  function glassGrad(x, y0, y1, lit) {
    const g = x.createLinearGradient(0, y0, 0, y1);
    if (lit) { g.addColorStop(0, 'rgb(226,176,90)'); g.addColorStop(1, 'rgb(168,112,52)'); }
    else { g.addColorStop(0, 'rgb(18,26,34)'); g.addColorStop(1, 'rgb(48,62,74)'); }
    return g;
  }
  function windowArt(x, rng, v, trim) {
    const wx = 14, wy = 24, ww = 36, wh = 40;
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
    x.fillStyle = trim; x.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
    x.fillStyle = glassGrad(x, wy, wy + wh, v === 3); x.fillRect(wx, wy, ww, wh);
    if (v === 2) { x.fillStyle = 'rgba(120,70,70,0.85)'; x.fillRect(wx, wy, 12, wh * 0.8); x.fillRect(wx + ww - 12, wy, 12, wh * 0.8); x.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) x.fillRect(wx + i * 3, wy, 1, wh * 0.8); }
    const rg = x.createLinearGradient(wx, wy, wx + ww, wy + wh); rg.addColorStop(0, 'rgba(255,255,255,0.0)'); rg.addColorStop(0.45, 'rgba(255,255,255,0.16)'); rg.addColorStop(0.6, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(wx, wy, ww, wh);
    x.fillStyle = trim; x.fillRect(wx + ww / 2 - 1, wy, 2, wh); x.fillRect(wx, wy + wh / 2 - 1, ww, 2);
    if (v === 1) { // broken
      x.fillStyle = 'rgba(0,0,0,0.85)'; x.beginPath(); x.moveTo(wx + 2, wy + 2); x.lineTo(wx + 16, wy + 6); x.lineTo(wx + 10, wy + 18); x.lineTo(wx + 22, wy + 24); x.lineTo(wx + 6, wy + 30); x.lineTo(wx + 2, wy + 20); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 0.8; for (let i = 0; i < 9; i++) { x.beginPath(); const px = wx + 8 + rng() * 20, py = wy + 8 + rng() * 20; x.moveTo(px, py); x.lineTo(px + (rng() - 0.5) * 22, py + (rng() - 0.5) * 22); x.stroke(); }
    }
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(wx - 5, wy + wh + 1, ww + 10, 3); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(wx - 5, wy + wh + 4, ww + 10, 2);
  }
  function boardedArt(x, rng, trim) {
    windowArt(x, rng, 0, trim);
    for (let i = 0; i < 3; i++) {
      const y = 28 + i * 13, a = (rng() - 0.5) * 0.18;
      x.save(); x.translate(32, y + 5); x.rotate(a);
      x.fillStyle = 'rgb(' + (110 + rng() * 30 | 0) + ',' + (80 + rng() * 20 | 0) + ',50)'; x.fillRect(-26, -5, 52, 10);
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(-26, 4, 52, 1.5); x.fillStyle = 'rgba(30,20,10,0.9)'; x.fillRect(-22, -1, 2, 2); x.fillRect(20, -1, 2, 2); x.restore();
    }
  }
  function doorArt(x, rng, v, open) {
    const dx = 10, dy = 16, dw = 44, dh = WH - 16;
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(dx - 4, dy - 4, dw + 8, dh + 4);
    x.fillStyle = v === 1 ? '#c9c6bc' : '#4a3a2a'; x.fillRect(dx - 3, dy - 3, dw + 6, dh + 3);
    if (open) {
      const g = x.createLinearGradient(0, dy, 0, dy + dh); g.addColorStop(0, '#0a0a0c'); g.addColorStop(1, '#1b1814'); x.fillStyle = g; x.fillRect(dx, dy, dw, dh);
      x.fillStyle = '#5a4630'; x.beginPath(); x.moveTo(dx, dy); x.lineTo(dx + 9, dy + 4); x.lineTo(dx + 9, dy + dh - 2); x.lineTo(dx, dy + dh); x.fill();
      return;
    }
    const cols = ['#6b4a2a', '#d7d4c8', '#3f5a3e', '#6a7076'], base = cols[v & 3];
    x.fillStyle = base; x.fillRect(dx, dy, dw, dh);
    x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(dx + 5, dy + 6, 15, 24); x.fillRect(dx + 24, dy + 6, 15, 24); x.fillRect(dx + 5, dy + 36, 15, 28); x.fillRect(dx + 24, dy + 36, 15, 28);
    x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(dx + 5, dy + 6, 15, 1); x.fillRect(dx + 24, dy + 6, 15, 1); x.fillRect(dx + 5, dy + 36, 15, 1); x.fillRect(dx + 24, dy + 36, 15, 1);
    x.fillStyle = '#b8a24a'; x.beginPath(); x.arc(dx + dw - 7, dy + dh * 0.55, 2.4, 0, 7); x.fill();
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(dx, dy + dh - 6, dw, 6);
    const g = x.createLinearGradient(dx, 0, dx + dw, 0); g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); x.fillStyle = g; x.fillRect(dx, dy, dw, dh);
  }
  function storeArt(x, rng, v) {
    const bands = ['#7a2a2a', '#2a5a7a', '#2a6a44', '#8a6a1c', '#4a3a6a'];
    x.fillStyle = bands[v % bands.length]; x.fillRect(0, 6, AW, 18);
    x.fillStyle = 'rgba(255,255,255,0.3)'; for (let i = 0; i < 3; i++) x.fillRect(8 + i * 18, 12, 12 + rng() * 4, 5);
    x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(0, 22, AW, 3);
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(3, 30, 58, 58);
    x.fillStyle = '#26282a'; x.fillRect(4, 31, 56, 56);
    x.fillStyle = glassGrad(x, 34, 84, false); x.fillRect(7, 34, 50, 50);
    const rg = x.createLinearGradient(7, 34, 57, 84); rg.addColorStop(0.25, 'rgba(255,255,255,0)'); rg.addColorStop(0.4, 'rgba(255,255,255,0.15)'); rg.addColorStop(0.5, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(7, 34, 50, 50);
    x.fillStyle = '#26282a'; x.fillRect(31, 34, 2, 50);
    if (v & 4) { x.fillStyle = 'rgba(0,0,0,0.9)'; x.beginPath(); x.moveTo(7, 34); x.lineTo(32, 44); x.lineTo(18, 60); x.lineTo(7, 52); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 0.8; for (let i = 0; i < 8; i++) { const px = 20 + rng() * 30, py = 40 + rng() * 36; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rng() - 0.5) * 24, py + (rng() - 0.5) * 24); x.stroke(); } }
  }
  function garageArt(x, rng) {
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(2, 18, 60, WH - 18);
    x.fillStyle = '#9a9a94'; x.fillRect(4, 20, 56, WH - 20);
    for (let y = 22; y < WH; y += 9) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(4, y + 7, 56, 2); x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(4, y, 56, 1); }
  }

  Walls.art = function (mat, kind, v) {
    const [c, x] = U.canvas2d(AW, WH);
    const rng = U.mulberry32((mat.length * 7919 + v * 104729 + kind.length * 31337) >>> 0);
    baseArt(x, mat, rng);
    const trim = mat.indexOf('int_') === 0 ? '#554a40' : (v & 1 ? '#d8d4c6' : '#2e2a26');
    if (kind === 'window') windowArt(x, rng, v & 3, trim);
    else if (kind === 'boarded') boardedArt(x, rng, trim);
    else if (kind === 'door') doorArt(x, rng, v & 3, false);
    else if (kind === 'doorOpen') doorArt(x, rng, v & 3, true);
    else if (kind === 'store') storeArt(x, rng, v);
    else if (kind === 'garage') garageArt(x, rng);
    return c;
  };

  // Face sprite (32 x WH+16): side 'L' faces +y, 'R' faces +x
  Walls.get = function (mat, kind, side, v) {
    const key = mat + '|' + kind + '|' + side + '|' + v;
    let f = cache.get(key);
    if (f) return f;
    const art = Walls.art(mat, kind, v);
    const [c, x] = U.canvas2d(32, WH + 16);
    x.imageSmoothingQuality = 'high';
    if (side === 'L') x.setTransform(0.5, 0.25, 0, 1, 0, 0); else x.setTransform(0.5, -0.25, 0, 1, 0, 16);
    x.drawImage(art, 0, 0);
    x.setTransform(1, 0, 0, 1, 0, 0);
    // directional shading
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = side === 'L' ? 'rgba(10,14,24,0.16)' : 'rgba(6,8,18,0.46)';
    x.fillRect(0, 0, 32, WH + 16);
    const g = x.createLinearGradient(0, 0, 0, WH + 16); g.addColorStop(0, 'rgba(0,0,0,0.2)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
    x.fillStyle = g; x.fillRect(0, 0, 32, WH + 16);
    x.globalCompositeOperation = 'source-over';
    f = c; cache.set(key, f); return f;
  };

  const topCache = new Map();
  Walls.top = function (color) {
    let t = topCache.get(color);
    if (t) return t;
    const [c, x] = U.canvas2d(64, 32);
    x.fillStyle = color; x.beginPath(); x.moveTo(32, 0); x.lineTo(64, 16); x.lineTo(32, 32); x.lineTo(0, 16); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.1)'; x.lineWidth = 1; x.stroke();
    topCache.set(color, c); return c;
  };
})();
