/* Dead SectorZ — tiny software "3D" face renderer: builds iso sprites from shaded polygons.
   Local axes: x = forward, y = right, z = up (in tile units). Used for cars, furniture, props. */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U;
  const ZU = 39.2, VX = 0.612, VY = 0.612, VZ = 0.5;
  const LL = Math.hypot(-0.45, -0.28, 0.85), LX = -0.45 / LL, LY = -0.28 / LL, LZ = 0.85 / LL;
  const G3 = DSZ.G3 = { ZU, K: 48 };

  const sh = (c, s) => 'rgb(' + Math.max(0, Math.min(255, c[0] * s | 0)) + ',' + Math.max(0, Math.min(255, c[1] * s | 0)) + ',' + Math.max(0, Math.min(255, c[2] * s | 0)) + ')';
  G3.shade = sh;

  // box faces (outward, image-oriented: p0 top-left, p1 top-right, p2 bottom-right, p3 bottom-left)
  G3.box = function (x0, y0, z0, x1, y1, z1, c, o) {
    o = o || {};
    const K = G3.K, L = x1 - x0, Wd = y1 - y0, H = z1 - z0;
    const tc = o.top || c, sc = o.side || c;
    return [
      { role: 'top', n: [0, 0, 1], p: [[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], c: tc, dw: Math.round(Wd * K), dh: Math.round(L * K) },
      { role: 'px', n: [1, 0, 0], p: [[x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0]], c: sc, dw: Math.round(Wd * K), dh: Math.round(H * K) },
      { role: 'nx', n: [-1, 0, 0], p: [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], c: sc, dw: Math.round(Wd * K), dh: Math.round(H * K) },
      { role: 'py', n: [0, 1, 0], p: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], c: sc, dw: Math.round(L * K), dh: Math.round(H * K) },
      { role: 'ny', n: [0, -1, 0], p: [[x1, y0, z1], [x0, y0, z1], [x0, y0, z0], [x1, y0, z0]], c: sc, dw: Math.round(L * K), dh: Math.round(H * K) }
    ];
  };
  // arbitrary convex polygon (normal computed, flipped to point away from cen)
  G3.poly = function (pts, c, cen, o) {
    const a = pts[0], b = pts[1], d = pts[2];
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let mx = 0, my = 0, mz = 0; for (const p of pts) { mx += p[0]; my += p[1]; mz += p[2]; } mx /= pts.length; my /= pts.length; mz /= pts.length;
    if ((mx - cen[0]) * nx + (my - cen[1]) * ny + (mz - cen[2]) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    return Object.assign({ n: [nx, ny, nz], p: pts, c }, o || {});
  };
  // frustum between two rectangles -> 5 faces (top + 4 sides)
  G3.frustum = function (b, t, c, o) {
    // b,t = [x0,x1,y0,y1,z]
    const B = [[b[0], b[2], b[4]], [b[1], b[2], b[4]], [b[1], b[3], b[4]], [b[0], b[3], b[4]]];
    const T = [[t[0], t[2], t[4]], [t[1], t[2], t[4]], [t[1], t[3], t[4]], [t[0], t[3], t[4]]];
    const cen = [(b[0] + b[1] + t[0] + t[1]) / 4, (b[2] + b[3]) / 2, (b[4] + t[4]) / 2];
    o = o || {};
    return [
      G3.poly([T[0], T[1], T[2], T[3]], o.top || c, cen, { role: 'top' }),
      G3.poly([B[1], B[2], T[2], T[1]], o.front || c, cen, { role: 'front', glass: o.glassF }),
      G3.poly([B[3], B[0], T[0], T[3]], o.back || c, cen, { role: 'back', glass: o.glassB }),
      G3.poly([B[0], B[1], T[1], T[0]], o.side || c, cen, { role: 'sideL', glass: o.glassS }),
      G3.poly([B[2], B[3], T[3], T[2]], o.side || c, cen, { role: 'sideR', glass: o.glassS })
    ];
  };
  // cylinder-ish prism approximated by N-gon sides + top (vertical axis)
  G3.prism = function (cx, cy, z0, z1, r, n, c, o) {
    o = o || {}; const f = [], cen = [cx, cy, (z0 + z1) / 2];
    const top = []; for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + (o.rot || 0); top.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z1]); }
    f.push(G3.poly(top, o.top || c, cen, { role: 'top' }));
    for (let i = 0; i < n; i++) {
      const a0 = i / n * 6.2832 + (o.rot || 0), a1 = (i + 1) / n * 6.2832 + (o.rot || 0);
      const r1 = o.r1 === undefined ? r : o.r1;
      f.push(G3.poly([[cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z0], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z0], [cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1, z1], [cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1, z1]], c, cen, { role: 'side' }));
    }
    return f;
  };

  // render face list at rotation `ang` (radians) → {c, ox, oy}
  G3.render = function (faces, ang, opt) {
    opt = opt || {};
    const ca = Math.cos(ang), sa = Math.sin(ang), K = G3.K;
    const tv = faces.map(f => {
      const pts = f.p.map(p => { const wx = p[0] * ca - p[1] * sa, wy = p[0] * sa + p[1] * ca; return [(wx - wy) * 32, (wx + wy) * 16 - p[2] * ZU, wx, wy, p[2]]; });
      const nx = f.n[0] * ca - f.n[1] * sa, ny = f.n[0] * sa + f.n[1] * ca, nz = f.n[2];
      let dx = 0, dy = 0, dz = 0; for (const p of pts) { dx += p[2]; dy += p[3]; dz += p[4]; }
      dx /= pts.length; dy /= pts.length; dz /= pts.length;
      return { f, pts, n: [nx, ny, nz], vis: f.dbl || (nx * VX + ny * VY + nz * VZ) > 0.001, depth: dx * VX + dy * VY + dz * VZ };
    }).filter(t => t.vis);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const t of tv) for (const p of t.pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    if (opt.bounds) { x0 = Math.min(x0, opt.bounds[0]); y0 = Math.min(y0, opt.bounds[1]); x1 = Math.max(x1, opt.bounds[2]); y1 = Math.max(y1, opt.bounds[3]); }
    const pad = 3, w = Math.ceil(x1 - x0) + pad * 2, h = Math.ceil(y1 - y0) + pad * 2;
    const [c, x] = U.canvas2d(Math.max(2, w), Math.max(2, h));
    const ox = pad - x0, oy = pad - y0;
    x.translate(ox, oy);
    tv.sort((a, b) => a.depth - b.depth);
    for (const t of tv) {
      const f = t.f, pts = t.pts, n = t.n;
      let s = 0.4 + 0.74 * Math.max(0, n[0] * LX + n[1] * LY + n[2] * LZ);
      if (f.k) s *= f.k;
      const path = () => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); };
      let minY = 1e9, maxY = -1e9; for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
      const g = x.createLinearGradient(0, minY, 0, maxY + 0.01);
      const ao = f.ao === undefined ? 0.22 : f.ao;
      g.addColorStop(0, sh(f.c, s * (1 + ao * 0.35))); g.addColorStop(1, sh(f.c, s * (1 - ao)));
      path(); x.fillStyle = g; x.fill();
      if (f.glass) {
        // frame already filled with body colour; inset glass pane
        let mx = 0, my = 0; for (const p of pts) { mx += p[0]; my += p[1]; } mx /= pts.length; my /= pts.length;
        const k = f.inset || 0.82;
        x.beginPath(); pts.forEach((p, i) => { const px = mx + (p[0] - mx) * k, py = my + (p[1] - my) * k; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath();
        const gg = x.createLinearGradient(mx - 20, minY, mx + 20, maxY);
        const gc = f.glassCol || [26, 36, 46];
        gg.addColorStop(0, sh(gc, 1.9)); gg.addColorStop(0.5, sh(gc, 1.0)); gg.addColorStop(1, sh(gc, 0.6));
        x.fillStyle = gg; x.fill();
        x.save(); x.clip(); x.fillStyle = 'rgba(255,255,255,0.13)'; x.beginPath(); x.moveTo(mx - 30, maxY); x.lineTo(mx - 6, minY); x.lineTo(mx + 6, minY); x.lineTo(mx - 18, maxY); x.fill();
        if (f.crack) { x.strokeStyle = 'rgba(230,240,255,0.55)'; x.lineWidth = 0.7; const r = U.mulberry32(f.crack); for (let i = 0; i < 7; i++) { x.beginPath(); const px = mx + (r() - 0.5) * 20, py = my + (r() - 0.5) * 8; x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 24, py + (r() - 0.5) * 12); x.stroke(); } }
        x.restore();
      }
      if (f.d && f.dw) {
        x.save(); path(); x.clip();
        const p0 = pts[0], p1 = pts[1], p3 = pts[3];
        x.transform((p1[0] - p0[0]) / f.dw, (p1[1] - p0[1]) / f.dw, (p3[0] - p0[0]) / f.dh, (p3[1] - p0[1]) / f.dh, p0[0], p0[1]);
        f.d(x, f.dw, f.dh, s);
        x.restore();
      }
      if (!opt.noEdge) {
        path(); x.strokeStyle = 'rgba(0,0,0,0.38)'; x.lineWidth = 0.8; x.lineJoin = 'round'; x.stroke();
      }
    }
    return { c, ox, oy };
  };
  G3.rgb = (c, s) => sh(c, s);
})();
