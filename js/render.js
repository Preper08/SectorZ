/* Dead SectorZ — isometric renderer: baked ground chunks, depth-sorted sprites, roof/wall cutaway,
   sun & lamp shadows, ray-cast dynamic lighting at reduced resolution, vision mask, post FX. */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, C = DSZ.C, W = DSZ.World, O = DSZ.O, D = DSZ.OBJDEF, G = DSZ.G;
  const R = DSZ.Render = { zoom: 1, VW: 0, VH: 0, scale: 1, stats: { items: 0, lights: 0, chunks: 0 } };
  const CH = C.CH, ZU = 39.2, SC = 45.25;
  let cv, ctx, lm, lctx, LW = 0, LH = 0, tmp, tctx;
  let camIx = 0, camIy = 0, zoom = 1, T = 0;
  const chunks = new Map();
  let bakeBudget = 3;
  const order = [], pool = [];
  let np = 0;

  // ---------------------------------------------------------------- setup
  R.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d', { alpha: false });
    [lm, lctx] = U.canvas2d(8, 8); [tmp, tctx] = U.canvas2d(640, 480);
    R.resize();
    makeFx();
  };
  R.resize = function () {
    const s = R.scale, w = Math.max(320, Math.floor(window.innerWidth * s)), h = Math.max(240, Math.floor(window.innerHeight * s));
    cv.width = w; cv.height = h; R.VW = w; R.VH = h;
    cv.style.width = '100%'; cv.style.height = '100%';
    const ls = DSZ.settings.lightRes;
    LW = Math.ceil(w * ls); LH = Math.ceil(h * ls); lm.width = LW; lm.height = LH;
    R.vig = null; R.grainBig = null;
    // low-res vignette baked into the lightmap (same look, no extra full-screen pass)
    const [vc, vx] = U.canvas2d(LW, LH);
    const vg = vx.createRadialGradient(LW / 2, LH / 2, LH * 0.3, LW / 2, LH / 2, LW * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.65, 'rgba(0,0,0,0.28)'); vg.addColorStop(1, 'rgba(0,0,0,0.78)');
    vx.fillStyle = vg; vx.fillRect(0, 0, LW, LH); R.vigL = vc;
  };
  R.setScale = function (s) { R.scale = s; R.resize(); };

  let grain, tufts = [], roofTiles = {}, sprites = {};
  function makeFx() {
    [grain] = U.canvas2d(128, 128); const gx = grain.getContext('2d'), id = gx.createImageData(128, 128);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 200; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    gx.putImageData(id, 0, 0);
    // grass tufts
    for (let k = 0; k < 6; k++) {
      const [c, x] = U.canvas2d(24, 18), r = U.mulberry32(k * 77 + 1);
      for (let i = 0; i < 16; i++) { const px = 4 + r() * 16, l = 5 + r() * 9, a = -Math.PI / 2 + (r() - 0.5) * 0.9; x.strokeStyle = r() < 0.5 ? 'rgba(' + (70 + r() * 30 | 0) + ',' + (110 + r() * 40 | 0) + ',50,0.9)' : 'rgba(30,50,24,0.8)'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(px, 17); x.quadraticCurveTo(px + Math.cos(a) * l * 0.4, 17 + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, 17 + Math.sin(a) * l); x.stroke(); }
      tufts.push(c);
    }
    // soft round sprites
    const mk = (n, stops) => { const [c, x] = U.canvas2d(n, n), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); for (const s of stops) g.addColorStop(s[0], s[1]); x.fillStyle = g; x.fillRect(0, 0, n, n); return c; };
    sprites.smoke = mk(64, [[0, 'rgba(180,180,180,0.55)'], [0.5, 'rgba(140,140,140,0.25)'], [1, 'rgba(120,120,120,0)']]);
    sprites.glow = mk(64, [[0, 'rgba(255,255,255,0.9)'], [0.25, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    sprites.fire = mk(64, [[0, 'rgba(255,240,180,0.95)'], [0.3, 'rgba(255,150,40,0.7)'], [0.7, 'rgba(200,50,10,0.25)'], [1, 'rgba(120,20,0,0)']]);
    sprites.flare = mk(128, [[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,255,255,0.55)'], [0.4, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]);
    sprites.blood = mk(32, [[0, 'rgba(120,6,6,0.95)'], [0.6, 'rgba(90,4,4,0.6)'], [1, 'rgba(70,0,0,0)']]);
  }
  const lightCache = {};
  function lightSprite(col) {
    const k = (col[0] >> 3) + ',' + (col[1] >> 3) + ',' + (col[2] >> 3); let s = lightCache[k]; if (s) return s;
    const [c, x] = U.canvas2d(128, 128), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    const rr = col[0] | 0, gg = col[1] | 0, bb = col[2] | 0;
    g.addColorStop(0, 'rgba(' + rr + ',' + gg + ',' + bb + ',1)'); g.addColorStop(0.18, 'rgba(' + rr + ',' + gg + ',' + bb + ',0.78)');
    g.addColorStop(0.45, 'rgba(' + rr + ',' + gg + ',' + bb + ',0.34)'); g.addColorStop(0.75, 'rgba(' + rr + ',' + gg + ',' + bb + ',0.09)'); g.addColorStop(1, 'rgba(' + rr + ',' + gg + ',' + bb + ',0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); lightCache[k] = c; return c;
  }
  const silCache = new WeakMap();
  function sil(spr) {
    let s = silCache.get(spr.c); if (s) return s;
    const [c, x] = U.canvas2d(spr.c.width, spr.c.height); x.drawImage(spr.c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    silCache.set(spr.c, c); return c;
  }
  const whiteCache = new WeakMap();
  function whiteSil(spr) {
    let s = whiteCache.get(spr.c); if (s) return s;
    const [c, x] = U.canvas2d(spr.c.width, spr.c.height); x.drawImage(spr.c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    whiteCache.set(spr.c, c); return c;
  }

  // ---------------------------------------------------------------- time of day
  const AMB = [[0, [18, 22, 48]], [4.5, [20, 26, 54]], [6, [150, 104, 98]], [8, [226, 214, 204]], [12, [255, 252, 244]], [16, [246, 232, 208]], [18, [255, 156, 92]], [19.6, [88, 60, 100]], [21, [26, 28, 58]], [24, [18, 22, 48]]];
  R.ambient = function (h) {
    for (let i = 0; i < AMB.length - 1; i++) {
      const a = AMB[i], b = AMB[i + 1];
      if (h >= a[0] && h <= b[0]) { const t = (h - a[0]) / (b[0] - a[0]); return [U.lerp(a[1][0], b[1][0], t), U.lerp(a[1][1], b[1][1], t), U.lerp(a[1][2], b[1][2], t)]; }
    }
    return AMB[0][1];
  };
  R.daylight = function (h) { const a = R.ambient(h); return U.clamp((a[0] + a[1] + a[2]) / 3 / 235, 0, 1); };
  function sunShadow(S) {
    const h = S.hour, dl = R.daylight(h), tt = U.clamp((h - 5.5) / 13, 0, 1);
    let a, f, str;
    if (h > 5.5 && h < 18.5) { a = Math.PI / 4 + (h - 12) * 0.19 + 0.2; const alt = (8 + 54 * Math.sin(Math.PI * tt)) * Math.PI / 180; f = Math.min(5, 1 / Math.tan(alt)); str = 0.14 + 0.3 * dl; }
    else { a = 2.7; f = 1.4; str = 0.12; }
    const dx = Math.cos(a), dy = Math.sin(a);
    return { dx, dy, sx: (dx - dy) * 32 / ZU * f, sy: (dx + dy) * 16 / ZU * f, str, dl };
  }

  // ---------------------------------------------------------------- ground chunks
  function chunkKey(cx, cy) { return cy * 1000 + cx; }
  function chunkRect(cx, cy) {
    const x0 = cx * CH, y0 = cy * CH, pad = 6;
    return { ox: (x0 - (y0 + CH)) * 32 - pad, oy: (x0 + y0) * 16 - pad, w: CH * 64 + pad * 2, h: CH * 32 + pad * 2 + 4 };
  }
  function bakeChunk(cx, cy) {
    const x0 = cx * CH, y0 = cy * CH, pad = 6;
    const ox = (x0 - (y0 + CH)) * 32 - pad, oy = (x0 + y0) * 16 - pad;
    const w = CH * 64 + pad * 2, h = CH * 32 + pad * 2 + 4;
    const [c, x] = U.canvas2d(w, h);
    for (let ty = y0; ty < y0 + CH; ty++) for (let tx = x0; tx < x0 + CH; tx++) {
      const g = W.groundAt(tx, ty), info = DSZ.GINFO[g], tex = DSZ.Tex.ground[info.tex];
      const hs = U.hash2(tx, ty, 5), hs2 = U.hash2(tx, ty, 9);
      const sx = Math.floor(hs * (256 - 64) / info.step) * info.step, sy = Math.floor(hs2 * (256 - 64) / info.step) * info.step;
      x.setTransform(0.5, 0.25, -0.5, 0.25, (tx - ty) * 32 - ox, (tx + ty) * 16 - oy);
      x.drawImage(tex, sx, sy, 64, 64, -0.35, -0.35, 64.7, 64.7);
      // per-tile tint variance
      x.setTransform(1, 0, 0, 1, (tx - ty) * 32 - ox, (tx + ty) * 16 - oy);
      const v = (U.hash2(tx, ty, 21) - 0.5);
      x.fillStyle = v < 0 ? 'rgba(0,0,0,' + (-v * 0.2) + ')' : 'rgba(255,255,255,' + (v * 0.06) + ')';
      x.beginPath(); x.moveTo(0, -0.3); x.lineTo(32.4, 16); x.lineTo(0, 32.3); x.lineTo(-32.4, 16); x.fill();
      // tufts / litter
      if (g === G.GRASS || g === G.FOREST) {
        const n = g === G.FOREST ? 2 : 1 + (hs2 < 0.4 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const u = U.hash2(tx, ty, 30 + i), vv = U.hash2(tx, ty, 40 + i), k = (U.hash2(tx, ty, 50 + i) * 6) | 0;
          const px = (u - vv) * 28, py = (u + vv) * 14 + 2;
          x.globalAlpha = 0.9; x.drawImage(tufts[k], px - 12, py - 16);
        }
        x.globalAlpha = 1;
      }
    }
    // road paint
    const marks = DSZ.Gen.marks.get(cy * 1000 + cx);
    if (marks) {
      x.setTransform(32, 16, -32, 16, -ox, -oy);
      for (const m of marks) {
        const a = m.a * (0.75 + U.hash2((m.x * 10) | 0, (m.y * 10) | 0, 3) * 0.25);
        x.globalAlpha = a; x.fillStyle = m.col; x.fillRect(m.x, m.y, m.w, m.h);
      }
      x.globalAlpha = 1;
    }
    // contact shadow under walls / big props
    x.setTransform(32, 16, -32, 16, -ox, -oy);
    for (let ty = y0; ty < y0 + CH; ty++) for (let tx = x0; tx < x0 + CH; tx++) {
      const o = W.getObj(tx, ty), od = o && D[o.t];
      if (od && (od.wall || od.tall === undefined && od.h > 60 && !od.thin)) {
        for (const [nx, ny, ex, ey, ew, eh] of [[1, 0, tx + 1, ty, 0.5, 1], [0, 1, tx, ty + 1, 1, 0.5]]) {
          const n = W.getObj(tx + nx, ty + ny); if (n && D[n.t].wall) continue;
          const g = x.createLinearGradient(ex, ey, ex + (nx ? 0.55 : 0), ey + (ny ? 0.55 : 0)); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = g; x.fillRect(ex, ey, nx ? 0.55 : 1, ny ? 0.55 : 1);
        }
      }
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    return { c, ox, oy, t: T };
  }
  R.dirtyAt = function (tx, ty) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) chunks.delete(chunkKey(Math.floor((tx + dx) / CH), Math.floor((ty + dy) / CH)));
  };
  R.dirtyAll = function () { chunks.clear(); };

  // ---------------------------------------------------------------- helpers
  const iso = (wx, wy) => [(wx - wy) * 32, (wx + wy) * 16];
  R.toScreen = function (wx, wy, z) { const i = iso(wx, wy); return [(i[0] - camIx) * zoom + R.VW / 2, (i[1] - (z || 0) * ZU - camIy) * zoom + R.VH / 2]; };
  R.toScreenCss = function (wx, wy, z) { const p = R.toScreen(wx, wy, z); const k = cv.clientWidth / R.VW; return [p[0] * k, p[1] * k]; };
  R.screenToWorld = function (sx, sy) { // sx, sy in CSS px
    const k = R.VW / (cv.clientWidth || R.VW), px = sx * k, py = sy * k;
    const ix = (px - R.VW / 2) / zoom + camIx, iy = (py - R.VH / 2) / zoom + camIy;
    return U.fromIso(ix, iy);
  };
  function pushItem(k, t, a, b, c) { let it = pool[np]; if (!it) it = pool[np] = {}; np++; it.k = k; it.t = t; it.a = a; it.b = b; it.c = c; order.push(it); }

  // ---------------------------------------------------------------- frame
  R.frame = function (S, dt) {
    T = S.time; zoom = S.cam.zoom * (R.zoomBoost || 1);
    const shake = S.cam.shake || 0, sxk = shake ? (Math.random() - 0.5) * shake * 6 : 0, syk = shake ? (Math.random() - 0.5) * shake * 6 : 0;
    const ci = iso(S.cam.x, S.cam.y); camIx = ci[0] + sxk; camIy = ci[1] + syk;
    const VW = R.VW, VH = R.VH;
    // exact screen-space culling bounds (iso pixels), with margins for tall/wide sprites
    const iz = 1 / zoom;
    const svx0 = camIx - VW / 2 * iz, svx1 = camIx + VW / 2 * iz;
    const svy0 = camIy - VH / 2 * iz, svy1 = camIy + VH / 2 * iz;
    const MX = 160, MT = 280, MB = 60;
    const amb = R.ambient(S.hour), dl = R.daylight(S.hour), sun = sunShadow(S), p = S.player;
    const pb = W.buildingAt(Math.floor(p.x), Math.floor(p.y));
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#07080a'; ctx.fillRect(0, 0, VW, VH);
    ctx.setTransform(zoom, 0, 0, zoom, VW / 2 - camIx * zoom, VH / 2 - camIy * zoom);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    // view bounds (iso space)
    const vx0 = camIx - VW / 2 / zoom - 80, vx1 = camIx + VW / 2 / zoom + 80, vy0 = camIy - VH / 2 / zoom - 40, vy1 = camIy + VH / 2 / zoom + 240;
    // world bbox
    const cs = [U.fromIso(vx0, vy0), U.fromIso(vx1, vy0), U.fromIso(vx0, vy1), U.fromIso(vx1, vy1)];
    let tx0 = 1e9, ty0 = 1e9, tx1 = -1e9, ty1 = -1e9; for (const c of cs) { tx0 = Math.min(tx0, c[0]); tx1 = Math.max(tx1, c[0]); ty0 = Math.min(ty0, c[1]); ty1 = Math.max(ty1, c[1]); }
    tx0 = Math.max(0, Math.floor(tx0) - 2); ty0 = Math.max(0, Math.floor(ty0) - 2); tx1 = Math.min(C.W - 1, Math.ceil(tx1) + 2); ty1 = Math.min(C.H - 1, Math.ceil(ty1) + 2);
    R.view = { tx0, ty0, tx1, ty1 };
    // ---- ground chunks
    bakeBudget = 3; let drawn = 0;
    for (let cy = Math.floor(ty0 / CH); cy <= Math.floor(ty1 / CH); cy++) for (let cx = Math.floor(tx0 / CH); cx <= Math.floor(tx1 / CH); cx++) {
      if (cx < 0 || cy < 0 || cx * CH >= C.W || cy * CH >= C.H) continue;
      const rc = chunkRect(cx, cy);
      const csx = (rc.ox - camIx) * zoom + VW / 2, csy = (rc.oy - camIy) * zoom + VH / 2;
      const cw = rc.w * zoom, chh = rc.h * zoom;
      const onScreen = !(csx >= VW || csx + cw <= 0 || csy >= VH || csy + chh <= 0);
      // only bake chunks that are on (or just outside) the screen - no wasted bakes far off-view
      const near = !(csx >= VW + 260 || csx + cw <= -260 || csy >= VH + 260 || csy + chh <= -260);
      if (!onScreen && !near) continue;
      const k = chunkKey(cx, cy); let ch = chunks.get(k);
      if (!ch) { if (!near || bakeBudget <= 0) continue; bakeBudget--; ch = bakeChunk(cx, cy); chunks.set(k, ch); }
      else { chunks.delete(k); chunks.set(k, ch); }
      if (!onScreen) continue;
      // draw only the part of the chunk that is actually inside the viewport
      const ix0 = ch.ox > svx0 ? ch.ox : svx0, iy0 = ch.oy > svy0 ? ch.oy : svy0;
      const ix1 = (ch.ox + rc.w) < svx1 ? (ch.ox + rc.w) : svx1, iy1 = (ch.oy + rc.h) < svy1 ? (ch.oy + rc.h) : svy1;
      if (ix1 <= ix0 || iy1 <= iy0) continue;
      ctx.drawImage(ch.c, ix0 - ch.ox, iy0 - ch.oy, ix1 - ix0, iy1 - iy0, ix0, iy0, ix1 - ix0, iy1 - iy0);
      drawn++;
    }
    if (chunks.size > 110) { let n = chunks.size - 90; for (const k of chunks.keys()) { chunks.delete(k); if (--n <= 0) break; } }
    R.stats.chunks = drawn;
    // ---- decals (blood, scorch, skid)
    for (const d of S.decals) {
      if (d.x < tx0 - 2 || d.x > tx1 + 2 || d.y < ty0 - 2 || d.y > ty1 + 2) continue;
      const i = iso(d.x, d.y), rad = d.r * 32;
      ctx.globalAlpha = d.a * (d.fade === undefined ? 1 : d.fade);
      if (d.type === 'blood') { ctx.drawImage(sprites.blood, i[0] - rad, i[1] - rad * 0.5, rad * 2, rad); }
      else if (d.type === 'scorch') { ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.beginPath(); ctx.ellipse(i[0], i[1], rad, rad * 0.5, 0, 0, 7); ctx.fill(); }
      else if (d.type === 'skid') { ctx.strokeStyle = 'rgba(8,8,8,0.8)'; ctx.lineWidth = 3; const j = iso(d.x2, d.y2); ctx.beginPath(); ctx.moveTo(i[0], i[1]); ctx.lineTo(j[0], j[1]); ctx.stroke(); }
      else if (d.type === 'water') { ctx.fillStyle = 'rgba(80,100,120,0.25)'; ctx.beginPath(); ctx.ellipse(i[0], i[1], rad, rad * 0.5, 0, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    // ---- collect visible renderables
    order.length = 0; np = 0;
    const px = p.x, py = p.y, pkey = px + py;
    // roof / wall fade targets
    const insideB = pb;
    for (const b of W.blds) if (b) { const tgt = (insideB === b) ? 0 : 1; b.roofA = b.roofA === undefined ? 1 : b.roofA + (tgt - b.roofA) * Math.min(1, dt * 6); }
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * C.W + tx, o = W.obj[i];
      // screen-space cull: skip tiles whose sprites cannot reach the viewport
      const sx = (tx - ty) * 32, sy = (tx + ty) * 16;
      const onScreen = sx > svx0 - MX && sx < svx1 + MX && sy > svy0 - MT && sy < svy1 + MB;
      if (o) {
        const d = D[o.t];
        // cutaway: walls in front of the player when inside their building
        if (d.wall && insideB && o.b === insideB.id && tx + ty > pkey - 0.4 && Math.abs(tx - px) < 11 && Math.abs(ty - py) < 11) o.ft = 0.14;
        else if (d.tall && tx + ty > pkey + 0.5 && tx + ty < pkey + 6 && Math.abs((tx - ty) - (px - py)) < 2.4) o.ft = 0.38;
        else o.ft = 1;
        o.fa = o.fa === undefined ? o.ft : o.fa + (o.ft - o.fa) * Math.min(1, dt * 9);
        if (onScreen) pushItem(tx + ty + 1, 0, o, tx, ty);
      }
      if (onScreen) {
        const rb = W.room[i];
        if (rb && W.blds[rb].roofA > 0.02) pushItem(tx + ty + 1.02, 1, W.blds[rb], tx, ty);
      }
    }
    // entities: same screen-space cull (their sprites are anchored at the ground point)
    const entOn = (ex, ey, mx, my) => { const ex2 = (ex - ey) * 32, ey2 = (ex + ey) * 16; return ex2 > svx0 - mx && ex2 < svx1 + mx && ey2 > svy0 - my && ey2 < svy1 + MB; };
    for (const z of S.zombies) { if (z.x < tx0 - 3 || z.x > tx1 + 3 || z.y < ty0 - 3 || z.y > ty1 + 3) continue; if (!entOn(z.x, z.y, 170, 260)) continue; pushItem(z.dead ? z.x + z.y - 0.6 : z.x + z.y, 2, z); }
    for (const c of S.cars) { if (c.x < tx0 - 4 || c.x > tx1 + 4 || c.y < ty0 - 4 || c.y > ty1 + 4) continue; if (!entOn(c.x, c.y, 200, 240)) continue; pushItem(c.x + c.y + 0.0, 3, c); }
    for (const d of S.drops) { if (d.x < tx0 - 2 || d.x > tx1 + 2 || d.y < ty0 - 2 || d.y > ty1 + 2) continue; if (!entOn(d.x, d.y, 90, 90)) continue; pushItem(d.x + d.y - 0.5, 4, d); }
    if (!p.driving) pushItem(p.x + p.y + 0.01, 5, p);
    for (const pt of S.particles) { if (pt.x < tx0 - 2 || pt.x > tx1 + 2 || pt.y < ty0 - 2 || pt.y > ty1 + 2) continue; if (!entOn(pt.x, pt.y, 120, 160)) continue; pushItem(pt.x + pt.y + 0.5, 6, pt); }
    // ---- shadows (ground pass)
    drawShadows(S, sun, tx0, ty0, tx1, ty1);
    // ---- sorted draw
    order.sort((a, b) => a.k - b.k);
    R.stats.items = order.length;
    for (let i = 0; i < order.length; i++) {
      const it = order[i];
      switch (it.t) {
        case 0: drawObj(it.a, it.b, it.c, S); break;
        case 1: drawRoof(it.a, it.b, it.c); break;
        case 2: drawZombie(it.a, S); break;
        case 3: drawCar(it.a, S); break;
        case 4: drawDrop(it.a, S); break;
        case 5: drawPlayer(S); break;
        case 6: drawParticle(it.a, S); break;
      }
    }
    // bullets / tracers
    ctx.globalCompositeOperation = 'lighter';
    for (const b of S.bullets) {
      const a = iso(b.x0, b.y0), c = iso(b.x1, b.y1), t = 1 - b.t / b.max;
      ctx.strokeStyle = 'rgba(255,230,160,' + (0.8 * t) + ')'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(a[0], a[1] - 26); ctx.lineTo(c[0], c[1] - 26); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // focus highlight + build ghost
    drawFocus(S);
    drawBuildGhost(S);
    // ---- lighting
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawLighting(S, amb, dl, pb, tx0, ty0, tx1, ty1);
    // ---- emissive glows (lamps/fire flares) in world space
    ctx.setTransform(zoom, 0, 0, zoom, VW / 2 - camIx * zoom, VH / 2 - camIy * zoom);
    drawFlares(S, dl);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawPost(S, dl);
  };

  // ---------------------------------------------------------------- shadows
  function drawShadows(S, sun, tx0, ty0, tx1, ty1) {
    ctx.save();
    const str = sun.str;
    // building shadows (convex hull of footprint + extruded footprint)
    for (const b of W.blds) {
      if (!b || b.x > tx1 + 30 || b.y > ty1 + 30 || b.x + b.w < tx0 - 30 || b.y + b.h < ty0 - 30) continue;
      const pts = []; const hgt = C.WH;
      for (const [cx, cy] of [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]) { const i = iso(cx, cy); pts.push([i[0], i[1]]); pts.push([i[0] + sun.sx * hgt, i[1] + sun.sy * hgt]); }
      const hull = convexHull(pts);
      ctx.fillStyle = 'rgba(4,6,14,' + (str * 0.95) + ')'; ctx.beginPath(); hull.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    for (const it of order) {
      if (it.t === 0) {
        const o = it.a, d = D[o.t]; if (d.wall || d.low && d.h < 40 || d.thin && d.h < 100 || d.h < 24 || !d.solid && !d.tree) continue;
        // props hidden under an opaque roof are not visible, so their shadow is not either
        if (o.b) { const b = W.blds[o.b]; if (b && b.roofA > 0.98 && (d.h || 30) < C.WH) continue; }
        const s = DSZ.Props.get(o), tx = it.b, ty = it.c;
        shadowSprite(s, (tx - ty) * 32, (tx + ty + 1) * 16, sun, str * 0.9, d.tree ? 0.9 : 0.75);
      } else if (it.t === 2) {
        const z = it.a; if (z.dead && z.deadT > 0) continue; const s = z.sprite; if (!s) continue; const i = iso(z.x, z.y);
        shadowSprite(s, i[0], i[1], sun, str * 0.9, 0.7 * (z.sc || 1), z.alpha === undefined ? 1 : z.alpha);
      } else if (it.t === 3) {
        const c = it.a, s = DSZ.CarArt.get(c.kind, c.color, c.state, c.ang), i = iso(c.x, c.y);
        shadowSprite(s, i[0], i[1], sun, str * 0.9, 0.9);
      } else if (it.t === 5) {
        const s = S.player.sprite; if (s) { const i = iso(S.player.x, S.player.y); shadowSprite(s, i[0], i[1], sun, str * 0.9, 0.75); }
      }
    }
    // lamp shadows on entities (nearest bright light)
    for (const it of order) {
      if (it.t !== 2 && it.t !== 5) continue;
      const e = it.t === 5 ? S.player : it.a; if (!e.sprite || e.dead && e.deadT > 0) continue;
      let best = null, bi = 0.18;
      for (const L of W.lights) { if (L.kind === 'window' || L.kind === 'traffic') continue; const dx = e.x - L.x, dy = e.y - L.y, d = Math.hypot(dx, dy); if (d > L.r) continue; const v = (1 - d / L.r) * L.a; if (v > bi) { bi = v; best = L; } }
      if (!best) continue;
      const dx = e.x - best.x, dy = e.y - best.y, d = Math.hypot(dx, dy) || 1, f = Math.min(2.4, 0.5 + d / (best.h || 3) * 0.9);
      const dxn = dx / d, dyn = dy / d, ls = { sx: (dxn - dyn) * 32 / ZU * f, sy: (dxn + dyn) * 16 / ZU * f };
      const i = iso(e.x, e.y);
      shadowSprite(e.sprite, i[0], i[1], ls, bi * 0.55 * (1 - sun.dl * 0.7), 0.7);
    }
  }
  function shadowSprite(s, ax, ay, sun, alpha, hscale, extra) {
    if (alpha < 0.02) return;
    const sl = sil(s);
    ctx.save(); ctx.globalAlpha = Math.min(0.7, alpha) * (extra === undefined ? 1 : extra);
    // local coords (u,v) with anchor at s.ox,s.oy ; height = -v
    ctx.transform(1, 0, -sun.sx * hscale, -sun.sy * hscale * 1.0, ax, ay);
    ctx.drawImage(sl, -s.ox, -s.oy);
    ctx.restore();
  }
  function convexHull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = []; for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    const up = []; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    lo.pop(); up.pop(); return lo.concat(up);
  }

  // ---------------------------------------------------------------- objects
  function drawObj(o, tx, ty, S) {
    const d = D[o.t], a = o.fa === undefined ? 1 : o.fa;
    if (d.wall) { drawWall(o, d, tx, ty, a); return; }
    const s = DSZ.Props.get(o), cx = (tx - ty) * 32, cy = (tx + ty + 1) * 16;
    if (a < 0.99) ctx.globalAlpha = a;
    if (d.tree) { const sc = o.s || 1; if (sc !== 1) { ctx.drawImage(s.c, cx - s.ox * sc, cy - s.oy * sc + 8, s.c.width * sc, s.c.height * sc); } else ctx.drawImage(s.c, cx - s.ox, cy - s.oy + 8); }
    else if (o.t === O.BUSH || o.t === O.ROCK) ctx.drawImage(s.c, cx - s.ox, cy - s.oy + 8);
    else {
      let sc = s;
      if (o.t === O.BGATE && o.open) { ctx.globalAlpha = a * 0.35; }
      ctx.drawImage(sc.c, cx - sc.ox, cy - sc.oy);
    }
    ctx.globalAlpha = 1;
    // dynamic bits: fire
    if (d.fire) {
      const f = 0.85 + 0.15 * Math.sin(T * 19 + tx * 3.1) + 0.1 * Math.sin(T * 31 + ty);
      const h = o.t === O.BFURNACE ? 40 : (o.t === O.WRECKFIRE ? 34 : 6);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9 * f;
      const sz = (o.t === O.BFIRE ? 30 : 40) * f; ctx.drawImage(sprites.fire, cx - sz / 2, cy - h - sz * 0.8, sz, sz * 1.2);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (o.t === O.TRAFFIC && !o.dead) { const ph = ((S.time * 0.3 + (o.phase | 0)) | 0) % 3; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = ph === 0 ? 'rgba(255,50,40,0.9)' : (ph === 1 ? 'rgba(255,200,40,0.9)' : 'rgba(60,255,90,0.9)'); const hs = (S.time * 0.5 + tx) % 7 < 2; if (!hs) { ctx.beginPath(); ctx.arc(cx + 3, cy - 3 * 39.2 + 20 + ph * 7, 2.2, 0, 7); ctx.fill(); } ctx.globalCompositeOperation = 'source-over'; }
  }
  function wallMat(o) { return o.t === O.BWALL_W || o.t === O.BDOOR || o.t === O.BWINDOW ? 'bwood' : (o.t === O.BWALL_M ? 'bmetal' : o.mat); }
  function wallKind(o) {
    switch (o.t) {
      case O.DOOR: return o.open ? 'doorOpen' : 'door';
      case O.BDOOR: return o.open ? 'doorOpen' : 'door';
      case O.WINDOW: return o.boarded ? 'boarded' : 'window';
      case O.BWINDOW: return 'boarded';
      case O.STORE: return 'store';
      case O.GARAGE: return 'garage';
      default: return 'plain';
    }
  }
  function drawWall(o, d, tx, ty, a) {
    const wh = C.WH, Wl = DSZ.Walls;
    const nS = W.getObj(tx, ty + 1), nE = W.getObj(tx + 1, ty);
    const wallS = nS && D[nS.t].wall && !(nS.fa < 0.5 && o.fa >= 0.5), wallE = nE && D[nE.t].wall && !(nE.fa < 0.5 && o.fa >= 0.5);
    let v = o.v | 0; if (o.t === O.WINDOW && o.broken) v = 1;
    const kind = wallKind(o), mat0 = wallMat(o), ex = (tx - ty) * 32, ey = (tx + ty) * 16;
    if (a < 0.99) ctx.globalAlpha = a;
    const inner = (nx, ny) => { if (!o.b || o.t >= O.BWALL_W) return false; const i = ny * C.W + nx; return W.inb(nx, ny) && W.room[i] === o.b; };
    if (!wallS) { const mat = (inner(tx, ty + 1) || o.inner) ? (o.imat || mat0) : mat0; const f = Wl.get(mat, kind, 'L', v); ctx.drawImage(f, ex - 32, ey + 16 - wh); }
    if (!wallE) { const mat = (inner(tx + 1, ty) || o.inner) ? (o.imat || mat0) : mat0; const f = Wl.get(mat, kind, 'R', v); ctx.drawImage(f, ex, ey + 16 - wh); }
    const b = o.b && o.t < O.BWALL_W ? W.blds[o.b] : null;
    if (!b || b.roofA < 0.98 || o.fa < 0.9) { ctx.drawImage(Wl.top(o.t >= O.BWALL_W ? (o.t === O.BWALL_M ? '#7a8088' : '#8a6a44') : '#5a5650'), ex - 32, ey - wh); }
    ctx.globalAlpha = 1;
    if (o.t === O.WINDOW && v === 3 && !o.broken) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 * a; ctx.drawImage(sprites.glow, ex - 22, ey - 60, 44, 44); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    if (o.hit > 0) { o.hit -= 0.06; ctx.globalAlpha = Math.min(0.5, o.hit); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(ex, ey - wh + 16); ctx.lineTo(ex + 32, ey - wh + 32); ctx.lineTo(ex + 32, ey + 16); ctx.lineTo(ex, ey + 32); ctx.lineTo(ex - 32, ey + 16); ctx.lineTo(ex - 32, ey - wh + 32); ctx.fill(); ctx.globalAlpha = 1; }
  }
  const roofPat = {};
  function roofTile(color, v) {
    const k = color + v; let c = roofPat[k]; if (c) return c;
    const [cc, x] = U.canvas2d(66, 34), r = U.mulberry32(v * 77 + color.length);
    x.fillStyle = color; x.beginPath(); x.moveTo(33, 0); x.lineTo(66, 17); x.lineTo(33, 34); x.lineTo(0, 17); x.closePath(); x.fill();
    x.save(); x.clip();
    for (let i = 0; i < 70; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,' + (0.04 + r() * 0.1) + ')' : 'rgba(255,255,255,' + (0.02 + r() * 0.05) + ')'; x.fillRect(r() * 66, r() * 34, 2 + r() * 8, 1 + r() * 2); }
    x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(0, 3 + i * 6); x.lineTo(66, 3 + i * 6 + 0.0); x.stroke(); }
    x.restore();
    roofPat[k] = cc; return cc;
  }
  function drawRoof(b, tx, ty) {
    const ex = (tx - ty) * 32, ey = (tx + ty) * 16, wh = C.WH;
    ctx.globalAlpha = b.roofA;
    const edge = tx === b.x || ty === b.y || tx === b.x + b.w - 1 || ty === b.y + b.h - 1;
    // cache the 4 roof tile variants per building (no per-tile key building)
    let rt = b._rt;
    if (!rt) { rt = b._rt = [roofTile(b.roof, 0), roofTile(b.roof, 1), roofTile(b.roof, 2), roofTile(b.roof, 3)]; }
    ctx.drawImage(rt[(tx * 7 + ty * 13) & 3], ex - 33, ey - wh - 1);
    if (edge) { ctx.globalAlpha = b.roofA * 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(ex, ey - wh); ctx.lineTo(ex + 32, ey - wh + 16); ctx.lineTo(ex, ey - wh + 32); ctx.lineTo(ex - 32, ey - wh + 16); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- entities
  const CH_SCALE = 0.9; // characters drawn at 90% so cars, doors and props read correctly
  function drawZombie(z, S) {
    const Fig = DSZ.Fig, s = Fig.get(z.spec, z.ang, z.pose); z.sprite = s;
    const i = iso(z.x, z.y), sc = (z.sc || 1) * CH_SCALE;
    ctx.globalAlpha = z.alpha === undefined ? 1 : z.alpha;
    if (sc !== 1) { ctx.save(); ctx.translate(i[0], i[1]); ctx.scale(sc, sc); ctx.drawImage(s.c, -s.ox, -s.oy); ctx.restore(); }
    else ctx.drawImage(s.c, i[0] - s.ox, i[1] - s.oy);
    if (z.flash > 0) { ctx.globalAlpha = Math.min(1, z.flash) * 0.75; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(whiteSil(s), i[0] - s.ox, i[1] - s.oy); ctx.globalCompositeOperation = 'source-over'; }
    if (z.burn > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8; const f = 0.8 + 0.2 * Math.sin(T * 25 + z.seed); ctx.drawImage(sprites.fire, i[0] - 16 * f, i[1] - 52 * f, 32 * f, 44 * f); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = 1;
  }
  function drawCar(c, S) {
    const s = DSZ.CarArt.get(c.kind, c.color, c.state, c.ang), i = iso(c.x, c.y - 0);
    const lift = (c.bounce || 0);
    ctx.drawImage(s.c, i[0] - s.ox, i[1] - s.oy - lift);
    if (c.fire) { const f = 0.85 + 0.15 * Math.sin(T * 21 + c.seed); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; for (let k = -1; k <= 1; k++) { const sz = 44 * f; ctx.drawImage(sprites.fire, i[0] + k * 14 - sz / 2, i[1] - 36 - sz * 0.8 - (k & 1) * 6, sz, sz * 1.3); } ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    if (c.flash > 0) { ctx.globalAlpha = c.flash * 0.5; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(whiteSil(s), i[0] - s.ox, i[1] - s.oy); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  }
  function drawDrop(d, S) {
    const i = iso(d.x, d.y), ic = DSZ.Icons.get(d.item.id), bob = Math.sin(T * 3 + d.x * 5) * 1.5;
    ctx.globalAlpha = 0.45; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(i[0], i[1], 9, 4.5, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1; const s = 26; ctx.drawImage(ic, i[0] - s / 2, i[1] - s + 2 - 4 - bob, s, s);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16 + 0.08 * Math.sin(T * 4 + d.y); ctx.drawImage(sprites.glow, i[0] - 18, i[1] - 24, 36, 36); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  function drawPlayer(S) {
    const p = S.player; const spec = DSZ.Fig.playerSpec(p.look || {}); const s = DSZ.Fig.get(spec, p.ang, p.pose); p.sprite = s;
    const i = iso(p.x, p.y);
    ctx.save(); ctx.translate(i[0], i[1]); ctx.scale(CH_SCALE, CH_SCALE); ctx.drawImage(s.c, -s.ox, -s.oy); ctx.restore();
    // held item (hand anchor scaled with the sprite)
    const it = p.heldDef;
    if (it) {
      const hx = i[0] + s.hand[0] * CH_SCALE, hy = i[1] + s.hand[1] * CH_SCALE;
      drawHeld(it, p, hx, hy, S);
    }
    if (p.flash > 0) { ctx.globalAlpha = p.flash * 0.35; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(whiteSil(s), i[0] - s.ox, i[1] - s.oy); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    if (p.hurt > 0) { ctx.globalAlpha = Math.min(0.5, p.hurt); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#f00'; ctx.drawImage(whiteSil(s), i[0] - s.ox, i[1] - s.oy); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  }
  // weapon definition table: each entry holds the displayed length (world units),
  // stroke thickness and a draw function receiving the weapon-space helpers.
  // Adding a weapon = a new entry; visual dims are separate from gameplay range/damage.
  // entries receive (W) = { segT, P0, seg, hl, ctx, TOT, th, col, dark, wood, tipx, tipy, p, it }
  const WEAPON_FIGS = {
    // guns -----------------------------------------------------------------
    pistol: { len: 0.2, th: 2.6, draw: W => {
      const { segT, P0, seg, hl, ctx, TOT, col, dark } = W;
      segT(TOT * 0.1, TOT * 0.92, -0.8, -0.8, 2.9, col); // slide
      segT(TOT * 0.92, TOT * 1.02, -0.8, -0.8, 1.6, dark); // muzzle
      const g0 = P0(TOT * 0.12, 0.8), g1 = P0(TOT * 0.02, 5.2);
      seg(g0[0], g0[1], g1[0], g1[1], 2.6, dark); // grip
      ctx.fillStyle = dark; ctx.fillRect(P0(TOT * 0.55, -1.9)[0] - 0.9, P0(TOT * 0.55, -1.9)[1] - 1, 1.8, 1.8); // rear sight
      hl(P0(TOT * 0.2, -0.9)[0], P0(TOT * 0.2, -0.9)[1], P0(TOT * 0.85, -0.9)[0], P0(TOT * 0.85, -0.9)[1], 0.8);
    } },
    smg: { len: 0.42, th: 2.6, draw: W => {
      const { segT, P0, seg, hl, ctx, TOT, col, dark } = W;
      segT(TOT * -0.16, TOT * 0.8, 0, 0, 3.2, col); // boxy receiver
      segT(TOT * 0.8, TOT * 1.02, 0, 0, 1.6, dark); // short barrel
      const m0 = P0(TOT * 0.3, 2.2), m1 = P0(TOT * 0.34, 7.2);
      seg(m0[0], m0[1], m1[0], m1[1], 2.1, dark); // straight magazine
      const g0 = P0(TOT * -0.02, 1.5), g1 = P0(TOT * -0.06, 5.2);
      seg(g0[0], g0[1], g1[0], g1[1], 2.3, dark); // grip
      segT(TOT * -0.34, TOT * -0.16, 0, 0, 1.8, dark); // stock stub
      ctx.fillStyle = dark; ctx.fillRect(P0(TOT * 0.6, -2)[0] - 1, P0(TOT * 0.6, -2)[1] - 1, 2, 2); // sight
      hl(P0(TOT * 0, -0.9)[0], P0(TOT * 0, -0.9)[1], P0(TOT * 0.75, -0.9)[0], P0(TOT * 0.75, -0.9)[1], 0.9);
    } },
    shotgun: { len: 0.5, th: 3, draw: W => {
      const { segT, P0, hl, TOT, col, dark, wood } = W;
      segT(TOT * -0.3, TOT * 0.78, 0, 0, 3.4, col); // receiver
      segT(TOT * 0.78, TOT * 1.04, 0, 0, 1.7, dark); // barrel
      segT(TOT * 0.78, TOT * 1.0, 2.2, 2.5, 1.7, dark); // tube magazine under the barrel
      segT(TOT * -0.28, TOT * -0.06, -0.4, -0.4, 4.3, wood); // wooden butt
      segT(TOT * 0.36, TOT * 0.54, 1.8, 2.7, 2.5, wood); // wooden pump
      hl(P0(TOT * -0.05, -1)[0], P0(TOT * -0.05, -1)[1], P0(TOT * 0.7, -1)[0], P0(TOT * 0.7, -1)[1], 1);
    } },
    rifle: { len: 0.54, th: 3, draw: W => {
      const { segT, P0, seg, hl, ctx, TOT, col, dark, wood } = W;
      segT(TOT * -0.26, TOT * 0.58, 0, 0, 3.2, wood); // wooden stock
      segT(TOT * 0.58, TOT * 0.92, 0, 0, 2.7, col); // steel action
      segT(TOT * 0.92, TOT * 1.1, 0, 0, 1.5, dark); // barrel
      const g0 = P0(TOT * -0.02, 1.1), g1 = P0(TOT * -0.06, 4.5);
      seg(g0[0], g0[1], g1[0], g1[1], 2.4, dark); // grip
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(P0(TOT * 0.64, -1.9)[0], P0(TOT * 0.64, -1.9)[1], 1.3, 0, 7); ctx.fill(); // bolt handle
      hl(P0(TOT * -0.05, -0.8)[0], P0(TOT * -0.05, -0.8)[1], P0(TOT * 0.88, -0.8)[0], P0(TOT * 0.88, -0.8)[1], 0.9);
    } },
    // melee ----------------------------------------------------------------
    knife: { len: 0.34, th: 2.8, draw: W => {
      const { segT, P0, hl, ctx, TOT } = W;
      segT(TOT * -0.08, TOT * 0.2, 0, 0, 2.8, '#3a2a1e'); // handle
      segT(TOT * 0.2, TOT * 0.24, -1.5, -1.5, 1.4, '#888'); // guard
      segT(TOT * 0.24, TOT * 0.94, 0, 0, 2, '#c8ccd0'); // blade
      const t0 = P0(TOT * 0.94, -1.2), tm = P0(TOT * 1.06, 0.3), t1 = P0(TOT * 0.94, 1.2);
      ctx.fillStyle = '#c8ccd0'; ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(tm[0], tm[1]); ctx.lineTo(t1[0], t1[1]); ctx.closePath(); ctx.fill(); // tip
      hl(P0(TOT * 0.3, 0)[0], P0(TOT * 0.3, 0)[1], P0(TOT * 0.9, 0)[0], P0(TOT * 0.9, 0)[1], 0.7);
    } },
    machete: { len: 0.55, th: 2.8, draw: W => {
      const { segT, P0, hl, ctx, TOT } = W;
      segT(TOT * -0.1, TOT * 0.13, 0, 0, 3.2, '#2a2018'); // handle
      segT(TOT * 0.13, TOT * 0.16, -1.7, -1.7, 1.5, '#888'); // guard
      segT(TOT * 0.16, TOT * 1.0, 0, 0, 3.5, '#b0b6ba'); // broad blade
      const t0 = P0(TOT * 1.0, -1.8), tm = P0(TOT * 1.12, 0.6), t1 = P0(TOT * 1.0, 1.8);
      ctx.fillStyle = '#b0b6ba'; ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(tm[0], tm[1]); ctx.lineTo(t1[0], t1[1]); ctx.closePath(); ctx.fill(); // angled tip
      hl(P0(TOT * 0.2, 0)[0], P0(TOT * 0.2, 0)[1], P0(TOT * 0.96, 0)[0], P0(TOT * 0.96, 0)[1], 0.9);
    } },
    axe: { len: 0.52, th: 2.8, draw: W => {
      const { segT, P0, hl, ctx, TOT, px, py, nx, ny, tipx, tipy } = W;
      segT(TOT * -0.14, TOT * 0.9, 0, 0, 2.6, '#8a6a40'); // handle ends just below the head
      const h2 = P0(TOT * 0.9, 0);
      ctx.fillStyle = '#c84034'; ctx.beginPath(); // head: red wedge perpendicular to the handle
      ctx.moveTo(h2[0] + px * 3, h2[1] + py * 3);
      ctx.lineTo(h2[0] + nx * 7.5 + px * 1.5, h2[1] + ny * 7.5 + py * 1.5);
      ctx.lineTo(h2[0] + nx * 7.5 + px * -2.5, h2[1] + ny * 7.5 + py * -2.5);
      ctx.lineTo(h2[0] + px * -3, h2[1] + py * -3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,180,150,0.35)'; ctx.beginPath(); // bevelled edge look
      ctx.moveTo(h2[0] + nx * 7.5 + px * 1.5, h2[1] + ny * 7.5 + py * 1.5);
      ctx.lineTo(h2[0] + nx * 4 + px * 0, h2[1] + ny * 4 + py * 0);
      ctx.lineTo(h2[0] + nx * 7.5 + px * -2.5, h2[1] + ny * 7.5 + py * -2.5);
      ctx.closePath(); ctx.fill();
      hl(P0(TOT * 0.05, -0.7)[0], P0(TOT * 0.05, -0.7)[1], P0(TOT * 0.6, -0.7)[0], P0(TOT * 0.6, -0.7)[1], 0.8);
    } },
    crowbar: { len: 0.62, th: 2.8, draw: W => {
      const { segT, P0, seg, hl, TOT, col } = W;
      segT(TOT * -0.06, TOT * 0.7, 0, 0, 2.8, col); // shaft
      segT(TOT * 0.7, TOT * 0.98, 0, -0.3, 2.6, col);
      const e1 = P0(TOT * 0.98, -0.3), e2 = P0(TOT * 0.9, -3.4), e3 = P0(TOT * 0.82, -4.4);
      seg(e1[0], e1[1], e2[0], e2[1], 2.6, col); // hook bend
      seg(e2[0], e2[1], e3[0], e3[1], 2.5, col);
      segT(TOT * -0.06, TOT * -0.03, 0, 1.8, 3, col); // chisel end
      hl(P0(TOT * 0.05, -0.8)[0], P0(TOT * 0.05, -0.8)[1], P0(TOT * 0.68, -0.8)[0], P0(TOT * 0.68, -0.8)[1], 0.8);
    } },
    pipe: { len: 0.62, th: 2.8, draw: W => {
      const { segT, P0, hl, TOT, col } = W;
      segT(TOT * -0.06, TOT * 0.86, 0, 0, 3.8, col); // heavy tube
      segT(TOT * 0.86, TOT * 1.0, 0, 0, 4.8, '#5c626a'); // wider flange end
      hl(P0(TOT * 0.05, -1.1)[0], P0(TOT * 0.05, -1.1)[1], P0(TOT * 0.82, -1.1)[0], P0(TOT * 0.82, -1.1)[1], 1);
    } },
    hammer: { len: 0.34, th: 2.8, draw: W => {
      const { segT, P0, hl, ctx, TOT, fx, fy } = W;
      segT(TOT * -0.06, TOT * 0.76, 0, 0, 2.6, '#946a3c'); // handle
      const h2 = P0(TOT * 0.85, 0);
      ctx.fillStyle = '#8a9096'; ctx.beginPath();
      ctx.ellipse(h2[0], h2[1], 2.6, 4.9, Math.atan2(fy, fx) + Math.PI / 2, 0, 7); ctx.fill(); // steel head
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      hl(P0(TOT * 0.05, -0.6)[0], P0(TOT * 0.05, -0.6)[1], P0(TOT * 0.58, -0.6)[0], P0(TOT * 0.58, -0.6)[1], 0.7);
    } },
    spear: { len: 1.05, th: 2.4, draw: W => {
      const { segT, P0, hl, ctx, TOT, nx, ny } = W;
      segT(TOT * -0.12, TOT * 0.84, 0, 0, 2.2, '#a07c48'); // long shaft
      const t0 = P0(TOT * 0.84, 0), tm = P0(TOT * 1.08, 0);
      ctx.fillStyle = '#c0c6ca'; ctx.beginPath();
      ctx.moveTo(t0[0] + nx * -2.2, t0[1] + ny * -2.2); ctx.lineTo(tm[0], tm[1]); ctx.lineTo(t0[0] + nx * 2.2, t0[1] + ny * 2.2); ctx.closePath(); ctx.fill(); // leaf tip
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.9; ctx.stroke();
      hl(P0(TOT * 0, -0.6)[0], P0(TOT * 0, -0.6)[1], P0(TOT * 0.78, -0.6)[0], P0(TOT * 0.78, -0.6)[1], 0.7);
    } },
    bat: { len: 0.72, th: 2.8, draw: W => {
      const { segT, P0, hl, TOT, th, col } = W;
      segT(TOT * -0.1, TOT * 0.22, 0, 0, th * 0.85, '#3a2a1c'); // grip
      segT(TOT * 0.22, TOT * 0.68, 0, 0, th * 1.1, col); // taper
      segT(TOT * 0.68, TOT * 1.0, 0, 0, th * 1.45, col); // barrel end
      hl(P0(TOT * 0.28, -1)[0], P0(TOT * 0.28, -1)[1], P0(TOT * 0.95, -1)[0], P0(TOT * 0.95, -1)[1], 1);
    } },
    // light ----------------------------------------------------------------
    flashlight: { len: 0.2, th: 3.2, draw: W => {
      const { segT, P0, hl, TOT, col } = W;
      segT(TOT * -0.18, TOT * 0.68, 0, 0, 3.2, col); // body
      segT(TOT * 0.68, TOT * 1.0, 0, 0, 4.2, '#d8c040'); // head / lens
      hl(P0(TOT * -0.12, -0.8)[0], P0(TOT * -0.12, -0.8)[1], P0(TOT * 0.6, -0.8)[0], P0(TOT * 0.6, -0.8)[1], 0.8);
    } }
  };

  function drawHeld(it, p, hx, hy, S) {
    // 3D direction from hand along facing, with elevation
    const a = p.ang, ca = Math.cos(a), sa = Math.sin(a);
    let el = 0, L = 0.5, th = 3.4, col = '#2a2a2e', col2 = '#555';
    const wf = WEAPON_FIGS[it.id];
    if (wf) {
      L = wf.len; th = wf.th;
      if (it.type === 'gun') { col = it.col || '#333'; el = 0; }
      else if (it.type === 'melee') {
        col = it.col || '#aaa';
        if (p.pose.arms === 'swing') { const t = p.pose.af / 4; el = t < 0.4 ? 0.2 + t * 3 : (t < 0.7 ? 1.4 - (t - 0.4) * 5.5 : -0.3); } else el = 0.3; // carry angle closer to the body
      }
      else if (it.type === 'light') { col = it.col || '#d8c040'; el = 0; }
    }
    else if (it.type === 'gun') { L = it.w >= 4 ? 0.62 : 0.4; th = it.w >= 4 ? 3 : 2.6; col = it.col || '#333'; el = 0; }
    else if (it.type === 'melee') {
      L = it.range * 0.45; th = 2.8; col = it.col || '#aaa';
      if (p.pose.arms === 'swing') { const t = p.pose.af / 4; el = t < 0.4 ? 0.2 + t * 3 : (t < 0.7 ? 1.4 - (t - 0.4) * 5.5 : -0.3); } else el = 0.3;
    }
    else if (it.type === 'light') { L = 0.2; th = 3.2; col = it.col || '#d8c040'; el = 0; }
    else return;
    const dx = ca * Math.cos(el) * L, dy = sa * Math.cos(el) * L, dz = Math.sin(el) * L;
    const tipx = hx + (dx - dy) * 32, tipy = hy + (dx + dy) * 16 - dz * ZU;
    const bx = hx - (dx - dy) * 32 * 0.18, by = hy - (dx + dy) * 16 * 0.18 + dz * ZU * 0.18;
    ctx.lineCap = 'round';
    const seg = (x1, y1, x2, y2, w, c) => { ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = w + 1.5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    const hl = (x1, y1, x2, y2, w) => { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1 - 0.8); ctx.lineTo(x2, y2 - 0.8); ctx.stroke(); };
    const fx = (dx - dy) * 32, fy = (dx + dy) * 16; // unit step along the weapon axis in screen space
    const fl = Math.hypot(fx, fy) || 1, px = fx / fl, py = fy / fl; // unit direction along the weapon
    const nx = -py, ny = px; // unit normal (to the right of the weapon axis on screen)
    // point at distance t (px) along the axis from the hand, offset n px to the side
    const P0 = (t, n) => [hx + px * t + nx * (n || 0), hy + py * t + ny * (n || 0)];
    const segT = (t0, t1, n0, n1, w, c) => { const A2 = P0(t0, n0), B2 = P0(t1, n1); seg(A2[0], A2[1], B2[0], B2[1], w, c); };
    // full screen-space length of the weapon (behind-hand part + held part) in px
    const TOT = Math.hypot(tipx - bx, tipy - by) / 0.82;
    const dark = '#1e1e22';
    if (it.type === 'gun') {
      const wood = '#6a4a2a';
      if (wf) wf.draw({ segT, P0, seg, hl, ctx, TOT, th, col, dark, wood, px, py, nx, ny, fx, fy, tipx, tipy, p, it });
      else { seg(bx, by, tipx, tipy, th, col); hl(bx, by, tipx, tipy, th * 0.3); } // unknown gun fallback
      if (p.muzzle > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(sprites.flare, tipx - 24, tipy - 24, 48, 48); ctx.globalCompositeOperation = 'source-over'; }
      return;
    }
    if (it.type === 'melee') {
      if (wf) wf.draw({ segT, P0, seg, hl, ctx, TOT, th, col, dark, wood: '#6a4a2a', px, py, nx, ny, fx, fy, tipx, tipy, p, it });
      else { seg(bx, by, tipx, tipy, th, col); hl(bx, by, tipx, tipy, th * 0.3); } // unknown melee fallback
      return;
    }
    if (it.type === 'light') {
      if (wf) wf.draw({ segT, P0, seg, hl, ctx, TOT, th, col, dark, wood: '#6a4a2a', px, py, nx, ny, fx, fy, tipx, tipy, p, it });
      else { seg(bx, by, tipx, tipy, th, col); hl(bx, by, tipx, tipy, th * 0.3); }
      if (p.lightOn) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8; ctx.drawImage(sprites.glow, tipx - 10, tipy - 10, 20, 20); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      return;
    }
    seg(bx, by, tipx, tipy, th, col);
    hl(bx, by, tipx, tipy, th * 0.3);
  }
  function drawParticle(pt, S) {
    const i = iso(pt.x, pt.y), y = i[1] - pt.z * ZU, t = pt.life / pt.max;
    switch (pt.type) {
      case 'smoke': { const sz = pt.size * (1.4 - t * 0.9); ctx.globalAlpha = Math.min(1, t * 1.4) * pt.a; ctx.drawImage(sprites.smoke, i[0] - sz / 2, y - sz / 2, sz, sz); ctx.globalAlpha = 1; break; }
      case 'fire': { const sz = pt.size * (0.5 + t); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = t * 0.9; ctx.drawImage(sprites.fire, i[0] - sz / 2, y - sz / 2, sz, sz); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; break; }
      case 'blood': ctx.fillStyle = 'rgba(' + (110 + (pt.seed * 40 | 0)) + ',6,6,' + Math.min(1, t * 2 + 0.2) + ')'; ctx.fillRect(i[0] - pt.size / 2, y - pt.size / 2, pt.size, pt.size); break;
      case 'spark': ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,' + (150 + (t * 80 | 0)) + ',60,' + t + ')'; ctx.fillRect(i[0] - 1, y - 1, 2, 2); ctx.globalCompositeOperation = 'source-over'; break;
      case 'casing': ctx.fillStyle = '#d8b050'; ctx.fillRect(i[0] - 1, y - 0.5, 2.4, 1.4); break;
      case 'debris': ctx.fillStyle = pt.col || '#7a5a3a'; ctx.fillRect(i[0] - pt.size / 2, y - pt.size / 2, pt.size, pt.size * 0.7); break;
      case 'dust': ctx.globalAlpha = t * 0.35; ctx.drawImage(sprites.smoke, i[0] - pt.size / 2, y - pt.size / 2, pt.size, pt.size); ctx.globalAlpha = 1; break;
      case 'splash': ctx.strokeStyle = 'rgba(200,220,255,' + (t * 0.5) + ')'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(i[0], y, (1 - t) * 5 + 1, (1 - t) * 2.5 + 0.5, 0, 0, 7); ctx.stroke(); break;
      case 'text': ctx.font = 'bold ' + (pt.size || 13) + 'px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,' + t + ')'; ctx.fillText(pt.text, i[0] + 1, y + 1); ctx.fillStyle = pt.col || 'rgba(255,255,255,1)'; ctx.globalAlpha = Math.min(1, t * 2); ctx.fillText(pt.text, i[0], y); ctx.globalAlpha = 1; break;
    }
  }
  function drawFocus(S) {
    const f = S.focus; if (!f || f.kind === 'none') return;
    ctx.globalCompositeOperation = 'lighter'; const i = iso(f.x, f.y);
    const pul = 0.35 + 0.2 * Math.sin(T * 5);
    ctx.strokeStyle = 'rgba(255,230,160,' + pul + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(i[0], i[1] - 16 + 16 - 16); ctx.ellipse(i[0], i[1], 26, 13, 0, 0, 7); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawBuildGhost(S) {
    const b = S.build; if (!b || !b.active || !b.tile) return;
    const [tx, ty] = b.tile, def = b.def, i = iso(tx + 0.5, ty + 0.5), ok = b.ok;
    ctx.save();
    ctx.globalAlpha = 0.9; ctx.fillStyle = ok ? 'rgba(80,220,120,0.28)' : 'rgba(240,70,60,0.32)'; ctx.strokeStyle = ok ? 'rgba(120,255,160,0.9)' : 'rgba(255,100,90,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(i[0], i[1] - 16); ctx.lineTo(i[0] + 32, i[1]); ctx.lineTo(i[0], i[1] + 16); ctx.lineTo(i[0] - 32, i[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    const o = { t: def.obj, f: b.rot | 0, v: 0, mat: null };
    const od = D[def.obj];
    if (od.wall) {
      const mat = def.obj === O.BWALL_M ? 'bmetal' : 'bwood', wh = C.WH, Wl = DSZ.Walls, ex = (tx - ty) * 32, ey = (tx + ty) * 16;
      ctx.globalAlpha = ok ? 0.65 : 0.45; const kind = def.obj === O.BDOOR ? 'door' : (def.obj === O.BWINDOW ? 'boarded' : 'plain');
      ctx.drawImage(Wl.get(mat, kind, 'L', 0), ex - 32, ey + 16 - wh); ctx.drawImage(Wl.get(mat, kind, 'R', 0), ex, ey + 16 - wh); ctx.drawImage(Wl.top(def.obj === O.BWALL_M ? '#7a8088' : '#8a6a44'), ex - 32, ey - wh);
    } else { const s = DSZ.Props.get(o); ctx.globalAlpha = ok ? 0.7 : 0.45; ctx.drawImage(s.c, i[0] - s.ox, i[1] - s.oy); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- lighting
  function lmPos(wx, wy) { const i = iso(wx, wy), ls = DSZ.settings.lightRes; return [((i[0] - camIx) * zoom + R.VW / 2) * ls, ((i[1] - camIy) * zoom + R.VH / 2) * ls]; }
  const rays = new Float32Array(260);
  // draw one light into the lightmap; a0,a1 = angular limits (null = full circle)
  function castLight(x, y, r, col, inten, a0, a1, nrays, ext, shadowed) {
    const ls = DSZ.settings.lightRes, rx = r * SC * zoom * ls, ry = r * SC * 0.5 * zoom * ls;
    const c = lmPos(x, y);
    if (c[0] + rx < 0 || c[0] - rx > LW || c[1] + ry < 0 || c[1] - ry > LH) return;
    const bw = Math.ceil(rx * 2) + 4, bh = Math.ceil(ry * 2) + 4;
    if (bw > tmp.width || bh > tmp.height) { tmp.width = Math.max(tmp.width, bw); tmp.height = Math.max(tmp.height, bh); tctx = tmp.getContext('2d'); }
    tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, bw, bh);
    tctx.globalAlpha = 1; tctx.drawImage(lightSprite(col), 2, 2, rx * 2, ry * 2);
    const ox = c[0] - bw / 2, oy = c[1] - bh / 2, full = a0 === null || a0 === undefined;
    if (shadowed !== false) {
      const n = nrays || 56, s0 = full ? 0 : a0, s1 = full ? Math.PI * 2 : a1;
      W.fan(x, y, r, s0, s1, n + 1, rays);
      tctx.globalCompositeOperation = 'destination-in'; tctx.beginPath();
      const tc = [bw / 2, bh / 2];
      if (!full) tctx.moveTo(tc[0], tc[1]);
      for (let i = 0; i <= n; i++) {
        const a = s0 + (s1 - s0) * (i / n), d = Math.min(r, rays[i] + (rays[i] < r - 0.01 ? ext : 0));
        const q = lmPos(x + Math.cos(a) * d, y + Math.sin(a) * d);
        const px = q[0] - ox, py = q[1] - oy;
        if (i === 0 && full) tctx.moveTo(px, py); else tctx.lineTo(px, py);
      }
      tctx.closePath(); tctx.fillStyle = '#fff'; tctx.fill();
    } else if (!full) {
      tctx.globalCompositeOperation = 'destination-in'; tctx.beginPath(); tctx.moveTo(bw / 2, bh / 2);
      for (let i = 0; i <= 18; i++) { const a = a0 + (a1 - a0) * i / 18, q = lmPos(x + Math.cos(a) * r, y + Math.sin(a) * r); tctx.lineTo(q[0] - ox, q[1] - oy); }
      tctx.closePath(); tctx.fillStyle = '#fff'; tctx.fill();
    }
    lctx.globalCompositeOperation = 'lighter'; lctx.globalAlpha = Math.min(1.4, inten);
    lctx.drawImage(tmp, 0, 0, bw, bh, ox, oy, bw, bh); lctx.globalAlpha = 1;
    R.stats.lights++;
  }
  function drawLighting(S, amb, dl, pb, tx0, ty0, tx1, ty1) {
    R.stats.lights = 0;
    const p = S.player, rain = S.weather.rain, flash = S.weather.flash || 0;
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1;
    const k = 1 - rain * 0.22, fl = flash * 120;
    lctx.fillStyle = 'rgb(' + Math.min(255, amb[0] * k + fl | 0) + ',' + Math.min(255, amb[1] * k + fl | 0) + ',' + Math.min(255, amb[2] * k + fl * 1.1 | 0) + ')'; lctx.fillRect(0, 0, LW, LH);
    // interior ambient: buildings are darker inside than the street
    const ls = DSZ.settings.lightRes;
    const indoor = [Math.min(amb[0], 70 + amb[0] * 0.18), Math.min(amb[1], 66 + amb[1] * 0.18), Math.min(amb[2], 76 + amb[2] * 0.2)];
    for (const b of W.blds) {
      if (!b || b.x > tx1 + 4 || b.y > ty1 + 4 || b.x + b.w < tx0 - 4 || b.y + b.h < ty0 - 4) continue;
      const cs = [lmPos(b.x, b.y), lmPos(b.x + b.w, b.y), lmPos(b.x + b.w, b.y + b.h), lmPos(b.x, b.y + b.h)];
      const wh = C.WH * zoom * ls;
      lctx.fillStyle = 'rgb(' + indoor[0] * (1 - 0 | 0) + ',' + (indoor[1] | 0) + ',' + (indoor[2] | 0) + ')';
      lctx.beginPath(); lctx.moveTo(cs[0][0], cs[0][1]); for (let i = 1; i < 4; i++) lctx.lineTo(cs[i][0], cs[i][1]); lctx.closePath(); lctx.fill();
      // the roof/wall block above the footprint takes the interior tone too (so roofs & inner wall faces read dark)
      if (b.roofA > 0.5) { lctx.beginPath(); lctx.moveTo(cs[0][0], cs[0][1] - wh); lctx.lineTo(cs[1][0], cs[1][1] - wh); lctx.lineTo(cs[1][0], cs[1][1]); lctx.lineTo(cs[2][0], cs[2][1]); lctx.lineTo(cs[3][0], cs[3][1]); lctx.lineTo(cs[3][0], cs[3][1] - wh); lctx.closePath(); lctx.fillStyle = 'rgb(' + Math.min(255, amb[0] * 0.92 | 0) + ',' + Math.min(255, amb[1] * 0.92 | 0) + ',' + Math.min(255, amb[2] * 0.95 | 0) + ')'; lctx.fill(); if (pb !== b) { lctx.fillStyle = 'rgb(' + Math.min(255, amb[0] * 0.92 | 0) + ',' + Math.min(255, amb[1] * 0.92 | 0) + ',' + Math.min(255, amb[2] * 0.95 | 0) + ')'; lctx.beginPath(); lctx.moveTo(cs[0][0], cs[0][1] - wh); lctx.lineTo(cs[1][0], cs[1][1] - wh); lctx.lineTo(cs[2][0], cs[2][1] - wh); lctx.lineTo(cs[3][0], cs[3][1] - wh); lctx.closePath(); lctx.fill(); } }
    }
    const night = 1 - dl;
    // collect lights
    const L = []; const px = p.x, py = p.y;
    if (dl < 0.92 || true) for (const l of W.lights) {
      if (l.x < tx0 - 12 || l.x > tx1 + 12 || l.y < ty0 - 12 || l.y > ty1 + 12) continue;
      if (dl > 0.82 && l.kind !== 'fire') continue;
      L.push(l);
    }
    L.sort((a, b) => ((a.x - px) ** 2 + (a.y - py) ** 2) - ((b.x - px) ** 2 + (b.y - py) ** 2));
    let shadowCount = 0;
    for (const l of L) {
      let f = 1;
      if (l.flick === 1) { const n = U.vnoise(T * 7 + l.seed, l.seed, 3); f = n > 0.78 ? 0.25 + 0.3 * Math.sin(T * 60 + l.seed) ** 2 : 1; }
      else if (l.flick === 2) f = 0.82 + 0.14 * Math.sin(T * 17 + l.seed) + 0.1 * Math.sin(T * 29 + l.seed * 2);
      else if (l.flick === 3) f = 0.75 + 0.25 * U.vnoise(T * 5 + l.seed, 2, 4);
      const sh = shadowCount < 14; if (sh) shadowCount++;
      castLight(l.x, l.y, l.r, l.col, l.a * f * (l.kind === 'fire' ? 1.1 : 1), null, null, l.r > 6 ? 56 : 40, 1.0, sh);
    }
    for (const g of S.glowLights) { const t = g.t / g.max; castLight(g.x, g.y, g.r * (1 + (1 - t) * 0.2), g.col, g.a * t, null, null, 36, 1, true); }
    // cars: headlights + brake/interior
    for (const c of S.cars) {
      if (!c.lightsOn || Math.abs(c.x - px) > 40 || Math.abs(c.y - py) > 40) continue;
      const ca = Math.cos(c.ang), sa = Math.sin(c.ang), fx = c.x + ca * 1.0, fy = c.y + sa * 1.0;
      castLight(fx, fy, 15, [255, 244, 210], 1.05, c.ang - 0.42, c.ang + 0.42, 44, 1, true);
      castLight(fx, fy, 6, [255, 240, 200], 0.55, c.ang - 0.95, c.ang + 0.95, 30, 1, true);
      if (c.braking || c.rev) castLight(c.x - ca * 1.2, c.y - sa * 1.2, 3.2, c.rev ? [255, 255, 255] : [255, 30, 20], 0.5, null, null, 16, 1, false);
    }
    // player lights
    if (!p.driving || true) {
      // personal glow (so the player is never in total black)
      castLight(p.x, p.y, 2.6, [120, 126, 150], 0.34 + night * 0.18, null, null, 28, 1, true);
      const lt = p.lightDef;
      if (lt && p.lightOn) {
        const fl = lt.type === 'light' && lt.cone < 6 ? 1 - (p.lightFlick || 0) : 0.85 + 0.15 * Math.sin(T * 14);
        if (lt.cone < 6) {
          const ox = p.x + Math.cos(p.aimAng) * 0.35, oy = p.y + Math.sin(p.aimAng) * 0.35, half = lt.cone / 2;
          castLight(ox, oy, lt.range, [255, 248, 224], 1.2 * fl, p.aimAng - half * 0.55, p.aimAng + half * 0.55, 64, 1.3, true);
          castLight(ox, oy, lt.range * 0.62, [255, 244, 214], 0.6 * fl, p.aimAng - half * 1.3, p.aimAng + half * 1.3, 52, 1.3, true);
          castLight(ox, oy, 4.2, [255, 240, 210], 0.35 * fl, null, null, 28, 1, true);
        } else castLight(p.x, p.y, lt.range, lt.id === 'torch' ? [255, 160, 70] : [255, 190, 100], 0.95 * fl, null, null, 56, 1, true);
      }
    }
    if (S.muzzle > 0) castLight(p.x + Math.cos(p.aimAng) * 0.8, p.y + Math.sin(p.aimAng) * 0.8, 6.5, [255, 210, 130], S.muzzle * 1.6, null, null, 32, 1, true);
    // ---- vision mask (outside the player's line of sight is dark)
    const vr = 26, nR = 150; W.fan(p.x, p.y, vr, 0, Math.PI * 2, nR + 1, rays.length >= nR + 1 ? rays : new Float32Array(nR + 1));
    const vis = 0.5 + night * 0.28 + (S.weather.rain * 0.04);
    lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1;
    lctx.fillStyle = 'rgba(2,3,8,' + vis + ')'; lctx.beginPath(); lctx.rect(-4, -4, LW + 8, LH + 8);
    const eye = pb ? 0.0 : 0.0;
    for (let i = 0; i <= nR; i++) {
      const a = i / nR * Math.PI * 2, d = rays[i] + (rays[i] < vr - 0.01 ? 3.2 : 0), q = lmPos(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      i ? lctx.lineTo(q[0], q[1]) : lctx.moveTo(q[0], q[1]);
    }
    lctx.closePath(); lctx.fill('evenodd');
    // vignette is baked into the lightmap (one less full-screen pass, identical result)
    if (R.vigL) { lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1; lctx.drawImage(R.vigL, 0, 0); }
    // ---- composite
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(lm, 0, 0, LW, LH, 0, 0, R.VW, R.VH);
    if (DSZ.settings.bloom) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.11 + night * 0.05; ctx.drawImage(lm, 0, 0, LW, LH, 0, 0, R.VW, R.VH); ctx.globalAlpha = 1; }
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawFlares(S, dl) {
    if (dl > 0.8) return;
    ctx.globalCompositeOperation = 'lighter';
    const v = R.view, a = (1 - dl);
    for (const l of W.lights) {
      if (l.kind !== 'lamp' && l.kind !== 'fire' && l.kind !== 'traffic') continue;
      if (l.x < v.tx0 || l.x > v.tx1 || l.y < v.ty0 || l.y > v.ty1) continue;
      const i = iso(l.x, l.y); let f = 1;
      if (l.flick === 1) { const n = U.vnoise(T * 7 + l.seed, l.seed, 3); f = n > 0.78 ? 0.2 : 1; }
      if (l.kind === 'lamp') { const sz = 70 * f; ctx.globalAlpha = 0.55 * a * f; ctx.drawImage(sprites.flare, i[0] + 0.5 * 32 * 0.7 - sz / 2, i[1] - 2.98 * ZU - sz / 2 + 10, sz, sz); }
      else if (l.kind === 'traffic') continue;
    }
    for (const c of S.cars) {
      if (!c.lightsOn) continue; const ca = Math.cos(c.ang), sa = Math.sin(c.ang);
      for (const s of [-0.32, 0.32]) { const wx = c.x + ca * 1.12 - sa * s, wy = c.y + sa * 1.12 + ca * s, i = iso(wx, wy); ctx.globalAlpha = 0.9; ctx.drawImage(sprites.flare, i[0] - 22, i[1] - 0.45 * ZU - 22, 44, 44); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- post
  function drawPost(S, dl) {
    const VW = R.VW, VH = R.VH, p = S.player;
    // rain
    if (S.weather.rain > 0.05) {
      ctx.strokeStyle = 'rgba(170,190,220,' + (0.16 + S.weather.rain * 0.18) + ')'; ctx.lineWidth = 1; ctx.beginPath();
      const n = (60 + S.weather.rain * 170) | 0;
      for (let i = 0; i < n; i++) { const sx = ((i * 97.13 + T * 400) % (VW + 100)) - 20, sy = ((i * 53.7 + T * 1200 + (i % 7) * 31) % (VH + 60)) - 20; ctx.moveTo(sx, sy); ctx.lineTo(sx - 5, sy + 14); }
      ctx.stroke();
    }
    // vignette is applied inside the lightmap (see drawLighting)
    // low-health / bleeding tint
    if (p.hp < 40) { ctx.fillStyle = 'rgba(120,0,0,' + ((40 - p.hp) / 40 * 0.25 * (0.7 + 0.3 * Math.sin(T * 5))) + ')'; ctx.fillRect(0, 0, VW, VH); }
    if (p.hurt > 0) { ctx.fillStyle = 'rgba(150,0,0,' + Math.min(0.35, p.hurt * 0.5) + ')'; ctx.fillRect(0, 0, VW, VH); }
    // film grain (pre-tiled into one canvas, then offset per frame - same animated grain, one draw)
    if (DSZ.settings.grain) {
      if (!R.grainBig || R.grainBig.width !== VW + 128 || R.grainBig.height !== VH + 128) {
        const [gc, gx] = U.canvas2d(VW + 128, VH + 128);
        for (let yy = 0; yy < gc.height; yy += 128) for (let xx = 0; xx < gc.width; xx += 128) gx.drawImage(grain, xx, yy);
        R.grainBig = gc;
      }
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.09;
      const ox = (Math.random() * 128) | 0, oy = (Math.random() * 128) | 0;
      ctx.drawImage(R.grainBig, -ox, -oy);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // desaturate slightly in a cold teal grade at night (cheap colour tint)
    ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(20,40,70,' + (0.18 * (1 - dl)) + ')'; ctx.fillRect(0, 0, VW, VH); ctx.globalCompositeOperation = 'source-over';
    // letterbox bars for the cinematic look in the reference
    const bar = Math.max(0, (S.cinema || 0)) * VH * 0.05; if (bar > 1) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, bar); ctx.fillRect(0, VH - bar, VW, bar); }
  }
})();
