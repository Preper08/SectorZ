/* Dead SectorZ — vehicle sprite generation (rendered from shaded 3D faces, 48 headings, lazily cached) */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, G3 = DSZ.G3;
  const CarArt = DSZ.CarArt = { NANG: 48 };
  const COLORS = [[168, 44, 38], [44, 76, 128], [196, 196, 190], [36, 36, 40], [126, 130, 134], [64, 106, 74], [204, 166, 54], [118, 66, 38], [176, 96, 44], [96, 46, 96]];
  const KINDS = {
    sedan: { L: 2.3, W: 0.98, hh: 0.5, cab: [-0.62, 0.5, -0.4, 0.2], ch: 0.82, wb: 0.72 },
    hatch: { L: 2.0, W: 0.94, hh: 0.5, cab: [-0.86, 0.46, -0.66, 0.22], ch: 0.86, wb: 0.62 },
    taxi: { L: 2.3, W: 0.98, hh: 0.5, cab: [-0.62, 0.5, -0.4, 0.2], ch: 0.82, wb: 0.72, taxi: true, fixed: [226, 184, 40] },
    police: { L: 2.35, W: 1.0, hh: 0.5, cab: [-0.62, 0.52, -0.4, 0.22], ch: 0.82, wb: 0.74, police: true, fixed: [32, 40, 56] },
    van: { L: 2.6, W: 1.04, hh: 0.64, cab: [-1.2, 0.95, -1.18, 0.55], ch: 1.18, wb: 0.84, van: true },
    pickup: { L: 2.55, W: 1.04, hh: 0.56, cab: [-0.15, 0.78, -0.02, 0.5], ch: 0.92, wb: 0.82, pickup: true }
  };
  CarArt.kinds = KINDS;

  function body(kind, col, state) {
    const K = KINDS[kind], faces = [], L = K.L / 2, Wd = K.W / 2;
    let c = K.fixed || COLORS[col % COLORS.length];
    if (state === 'burnt') c = [30, 26, 24];
    else if (state === 'wreck') c = [c[0] * 0.78, c[1] * 0.76, c[2] * 0.72];
    const dark = [20, 20, 22], rust = [120, 62, 30], glassCol = state === 'burnt' ? [8, 8, 8] : (state === 'wreck' ? [38, 48, 52] : [26, 38, 50]);
    const wr = state === 'wreck' || state === 'burnt', seed = (kind.length * 977 + col * 131) | 0;
    // wheels
    const wy = Wd + 0.02, ww = 0.13, wl = 0.3, wz = state === 'wreck' ? 0.28 : 0.3, wb = K.wb;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const flat = wr && ((sx + sy + seed) & 1);
      faces.push(...G3.box(sx * wb - wl / 2, sy > 0 ? wy - ww : -wy, 0, sx * wb + wl / 2, sy > 0 ? wy : -wy + ww, flat ? wz * 0.6 : wz, [16, 16, 18], { top: [30, 30, 34], noEdge: true }));
    }
    // lower body
    const lb = G3.box(-L, -Wd, 0.1, L, Wd, K.hh, c, { top: [c[0] * 1.12, c[1] * 1.12, c[2] * 1.12] });
    const trim = (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, h * 0.62, w, 1.5); x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(0, h * 0.62 + 1.5, w, 1); };
    const stains = (x, w, h) => {
      if (!wr) return; const r = U.mulberry32(seed + w);
      for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(' + (state === 'burnt' ? '60,30,10' : '120,62,30') + ',' + (0.18 + r() * 0.25) + ')'; x.beginPath(); x.ellipse(r() * w, h * (0.4 + r() * 0.6), 4 + r() * 16, 2 + r() * 6, 0, 0, 7); x.fill(); }
      const g = x.createLinearGradient(0, h * 0.5, 0, h); g.addColorStop(0, 'rgba(30,24,16,0)'); g.addColorStop(1, 'rgba(30,24,16,0.55)'); x.fillStyle = g; x.fillRect(0, h * 0.5, w, h * 0.5);
      if (state === 'wreck' && r() < 0.6) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(r() * w * 0.7, h * 0.15, 3 + r() * 14, 2); }
    };
    for (const f of lb) {
      if (f.role === 'px') f.d = (x, w, h) => { // front: grille + headlights
        x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(w * 0.28, h * 0.3, w * 0.44, h * 0.3);
        x.fillStyle = 'rgba(180,180,190,0.35)'; for (let i = 0; i < 4; i++) x.fillRect(w * 0.3, h * 0.34 + i * 3, w * 0.4, 1);
        const lit = state === 'ok';
        for (const sx of [0.06, 0.74]) { x.fillStyle = lit ? '#fff4c8' : (state === 'burnt' ? '#111' : '#8a8a80'); x.fillRect(w * sx, h * 0.28, w * 0.2, h * 0.28); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(w * sx, h * 0.5, w * 0.2, 2); }
        x.fillStyle = 'rgba(0,0,0,0.65)'; x.fillRect(0, h * 0.72, w, h * 0.28); x.fillStyle = 'rgba(190,190,196,0.35)'; x.fillRect(0, h * 0.72, w, 1.5);
        if (K.police) { x.fillStyle = '#e8e8ee'; x.fillRect(w * 0.3, h * 0.12, w * 0.4, 3); }
        stains(x, w, h);
      };
      else if (f.role === 'nx') f.d = (x, w, h) => { // rear: tail lights + plate
        for (const sx of [0.04, 0.76]) { x.fillStyle = state === 'burnt' ? '#2a1010' : '#8a1818'; x.fillRect(w * sx, h * 0.22, w * 0.2, h * 0.3); x.fillStyle = 'rgba(255,120,100,0.35)'; x.fillRect(w * sx, h * 0.22, w * 0.2, 2); }
        x.fillStyle = '#d8d8c8'; x.fillRect(w * 0.36, h * 0.46, w * 0.28, h * 0.2); x.fillStyle = '#222'; for (let i = 0; i < 5; i++) x.fillRect(w * 0.39 + i * w * 0.045, h * 0.52, 2, h * 0.08);
        x.fillStyle = 'rgba(0,0,0,0.65)'; x.fillRect(0, h * 0.74, w, h * 0.26); stains(x, w, h);
      };
      else if (f.role === 'py' || f.role === 'ny') f.d = (x, w, h) => {
        trim(x, w, h);
        // doors
        x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1.2; const d1 = w * (K.van ? 0.4 : 0.3), d2 = w * (K.van ? 0.62 : 0.56);
        x.beginPath(); x.moveTo(d1, 0); x.lineTo(d1, h * 0.86); x.moveTo(d2, 0); x.lineTo(d2, h * 0.86); x.stroke();
        x.fillStyle = 'rgba(210,210,216,0.5)'; x.fillRect(d1 + 4, h * 0.3, 7, 2); x.fillRect(d2 + 4, h * 0.3, 7, 2);
        // wheel arches
        x.fillStyle = 'rgba(0,0,0,0.85)'; for (const sx of [-1, 1]) { const cx = w / 2 + sx * K.wb * G3.K * (f.role === 'py' ? 1 : -1); x.beginPath(); x.arc(cx, h, wl * G3.K * 0.68, Math.PI, 0); x.fill(); }
        if (K.taxi) { x.fillStyle = 'rgba(0,0,0,0.75)'; for (let i = 0; i < 9; i++) if (i & 1) x.fillRect(w * 0.18 + i * 6, h * 0.5, 6, 6); }
        if (K.police) { x.fillStyle = '#e8e8ee'; x.fillRect(w * 0.2, h * 0.1, w * 0.62, h * 0.36); x.fillStyle = '#2a3042'; x.fillRect(w * 0.26, h * 0.18, w * 0.5, 3); }
        if (K.van) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(w * 0.12, h * 0.1, w * 0.2, h * 0.4); }
        stains(x, w, h);
      };
      faces.push(f);
    }
    // cabin
    const cb = K.cab, cz = K.hh, ch = K.ch;
    if (K.van) {
      const cf = G3.box(cb[0], -Wd * 0.96, cz, 1.0, Wd * 0.96, ch, c, { top: [c[0] * 1.08, c[1] * 1.08, c[2] * 1.08] });
      for (const f of cf) { if (f.role === 'px') { f.glass = true; f.glassCol = glassCol; f.inset = 0.86; if (state === 'wreck') f.crack = seed + 5; } else if (f.role === 'py' || f.role === 'ny') { f.d = (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(w * 0.7, h * 0.18, w * 0.26, h * 0.5); x.fillStyle = glassCol.length ? G3.shade(glassCol, 1.4) : '#222'; x.fillRect(w * 0.72, h * 0.22, w * 0.22, h * 0.42); stains(x, w, h); }; } else if (f.role === 'nx') { f.d = (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(w * 0.1, h * 0.1, w * 0.36, h * 0.3); x.fillRect(w * 0.54, h * 0.1, w * 0.36, h * 0.3); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(w / 2 - 1, 0, 2, h); stains(x, w, h); }; } faces.push(f); }
    } else if (K.pickup) {
      const cab = G3.frustum([cb[0], cb[1], -Wd * 0.94, Wd * 0.94, cz], [cb[2], cb[3], -Wd * 0.84, Wd * 0.84, ch], c, { top: [c[0] * 1.1, c[1] * 1.1, c[2] * 1.1], glassF: true, glassB: true, glassS: true });
      for (const f of cab) if (f.glass) { f.glassCol = glassCol; if (state === 'wreck') f.crack = seed + f.role.length; }
      faces.push(...cab);
      // bed rails
      const bx0 = -L, bx1 = cb[0] - 0.02;
      faces.push(...G3.box(bx0, -Wd, cz, bx1, -Wd + 0.08, cz + 0.2, c), ...G3.box(bx0, Wd - 0.08, cz, bx1, Wd, cz + 0.2, c), ...G3.box(bx0, -Wd, cz, bx0 + 0.07, Wd, cz + 0.2, c));
      faces.push(...G3.box(bx0 + 0.07, -Wd + 0.08, cz - 0.02, bx1, Wd - 0.08, cz + 0.02, [34, 32, 30], { noEdge: true }));
    } else {
      const cab = G3.frustum([cb[0], cb[1], -Wd * 0.9, Wd * 0.9, cz], [cb[2], cb[3], -Wd * 0.78, Wd * 0.78, ch], c, { top: [c[0] * 1.12, c[1] * 1.12, c[2] * 1.12], glassF: true, glassB: true, glassS: true });
      for (const f of cab) if (f.glass) { f.glassCol = glassCol; f.inset = state === 'burnt' ? 0.9 : 0.8; if (state === 'wreck') f.crack = seed + f.role.length * 3; }
      faces.push(...cab);
      if (K.taxi) faces.push(...G3.box((cb[2] + cb[3]) / 2 - 0.12, -0.14, ch, (cb[2] + cb[3]) / 2 + 0.12, 0.14, ch + 0.1, [240, 236, 200]));
      if (K.police) { const lx = (cb[2] + cb[3]) / 2; faces.push(...G3.box(lx - 0.07, -0.26, ch, lx + 0.07, 0.0, ch + 0.08, [200, 40, 40]), ...G3.box(lx - 0.07, 0.0, ch, lx + 0.07, 0.26, ch + 0.08, [50, 80, 220])); }
    }
    return faces;
  }

  const cache = new Map();
  CarArt.get = function (kind, col, state, ang) {
    const n = CarArt.NANG, ai = ((Math.round(ang / (Math.PI * 2) * n) % n) + n) % n;
    const key = kind + '|' + col + '|' + state + '|' + ai;
    let s = cache.get(key);
    if (s) return s;
    const K = KINDS[kind];
    const faces = body(kind, col, state);
    s = G3.render(faces, ai / n * Math.PI * 2);
    // ground shadow
    cache.set(key, s); return s;
  };
  CarArt.pre = function () { return null; };
})();
