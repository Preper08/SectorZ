/* Dead SectorZ — prop sprites (furniture, trees, street furniture, base objects) built from shaded faces */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, O = DSZ.O, G3 = DSZ.G3;
  const Props = DSZ.Props = {};
  // furniture Z-heights are defined for the 1.0 character scale; characters draw at 0.90
  // (CH_SCALE in js/render.js), so prop z values shrink by the same factor to keep the
  // furniture/character proportions consistent. x/y footprints are untouched.
  const PROP_Z = 0.9;
  const B = (x0, y0, z0, x1, y1, z1, c, o) => G3.box(x0, y0, z0 * PROP_Z, x1, y1, z1 * PROP_Z, c, o);
  const cache = new Map();
  const PALETTE = [[150, 110, 70], [110, 80, 54], [168, 140, 100], [90, 84, 78]];
  const FAB = [[120, 60, 56], [60, 84, 110], [86, 110, 78], [150, 130, 90], [96, 70, 100], [70, 70, 76]];
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const grime = (x, w, h, a) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,8,6,' + (a || 0.35) + ')'); x.fillStyle = g; x.fillRect(0, 0, w, h); };
  const planks = (x, w, h, n, vert) => { x.fillStyle = 'rgba(0,0,0,0.38)'; for (let i = 1; i < n; i++) { if (vert) x.fillRect(w * i / n, 0, 1.2, h); else x.fillRect(0, h * i / n, w, 1.2); } x.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < n; i++) { if (vert) x.fillRect(w * i / n + 1.4, 0, 1, h); else x.fillRect(0, h * i / n + 1.4, w, 1); } };
  const goods = (seed, rows) => (x, w, h) => {
    const r = U.mulberry32(seed); x.fillStyle = 'rgba(14,14,16,0.9)'; x.fillRect(0, 0, w, h);
    for (let row = 0; row < rows; row++) {
      const y = h * (row + 0.15) / rows, hh = h / rows * 0.7;
      x.fillStyle = 'rgba(90,92,98,0.9)'; x.fillRect(0, y + hh, w, 2);
      for (let px = 1; px < w - 3;) { const bw = 3 + r() * 6, bh = hh * (0.55 + r() * 0.45); if (r() < 0.82) { const c = [[200, 60, 50], [60, 120, 190], [220, 190, 60], [80, 160, 90], [220, 220, 210], [200, 120, 50], [150, 80, 150]][(r() * 7) | 0]; x.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; x.fillRect(px, y + hh - bh, bw, bh); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(px + bw - 1, y + hh - bh, 1, bh); } px += bw + 1; }
    }
    grime(x, w, h, 0.3);
  };
  const doors2 = (x, w, h) => { x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 1.3; x.strokeRect(2, 2, w / 2 - 3, h - 4); x.strokeRect(w / 2 + 1, 2, w / 2 - 3, h - 4); x.fillStyle = 'rgba(220,220,225,0.7)'; x.fillRect(w / 2 - 4, h * 0.4, 2, 6); x.fillRect(w / 2 + 2, h * 0.4, 2, 6); grime(x, w, h, 0.3); };
  const drawers = (n) => (x, w, h) => { for (let i = 0; i < n; i++) { const y = h * i / n; x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1.2; x.strokeRect(2, y + 2, w - 4, h / n - 3); x.fillStyle = 'rgba(210,210,215,0.7)'; x.fillRect(w / 2 - 5, y + h / n / 2 - 1, 10, 2); } grime(x, w, h, 0.25); };

  const B3 = {};
  B3[O.CRATE] = (o) => { const c = PALETTE[o.v & 3]; const f = B(-0.4, -0.4, 0, 0.4, 0.4, 0.62, c); for (const s of f) { if (s.role !== 'top') s.d = (x, w, h) => { planks(x, w, h, 4, false); x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.moveTo(w, 0); x.lineTo(0, h); x.stroke(); grime(x, w, h, 0.3); }; else s.d = (x, w, h) => planks(x, w, h, 5, true); } return f; };
  B3[O.SHELF] = (o) => { const f = B(-0.18, -0.47, 0, 0.18, 0.47, 1.45, [96, 98, 104]); for (const s of f) { if (s.role === 'px' || s.role === 'nx') s.d = goods(o.v * 13 + (s.role === 'px' ? 1 : 2) + (o.x | 0) * 7 + (o.y | 0) * 3, 4); else if (s.role === 'top') s.d = (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, w, h); }; } return f; };
  B3[O.FRIDGE] = () => { const f = B(-0.3, -0.3, 0, 0.3, 0.3, 1.45, [206, 208, 206]); for (const s of f) if (s.role === 'px') s.d = (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(0, h * 0.34, w, 1.6); x.fillStyle = 'rgba(80,80,86,0.9)'; x.fillRect(w * 0.1, h * 0.12, 2.5, h * 0.18); x.fillRect(w * 0.1, h * 0.42, 2.5, h * 0.3); grime(x, w, h, 0.4); }; return f; };
  B3[O.KCAB] = () => { const f = B(-0.3, -0.47, 0, 0.3, 0.47, 0.88, [140, 112, 80], { top: [170, 164, 150] }); for (const s of f) if (s.role === 'px') s.d = doors2; return f; };
  B3[O.COUNTER] = () => { const f = B(-0.32, -0.47, 0, 0.32, 0.47, 0.92, [120, 96, 70], { top: [188, 182, 170] }); for (const s of f) if (s.role === 'px') s.d = doors2; return f; };
  B3[O.SINK] = () => { const f = B(-0.3, -0.45, 0, 0.3, 0.45, 0.9, [180, 182, 184], { top: [200, 204, 206] }); f.push(...B(0.0, -0.18, 0.9, 0.22, 0.18, 0.96, [120, 126, 132])); for (const s of f) if (s.role === 'px') s.d = doors2; return f; };
  B3[O.BED] = (o) => { const m = FAB[o.v % FAB.length]; const f = B(-0.5, -0.46, 0, 0.5, 0.46, 0.22, [98, 72, 48]); f.push(...B(-0.47, -0.43, 0.22, 0.47, 0.43, 0.38, m), ...B(-0.46, -0.3, 0.38, -0.22, 0.3, 0.46, [226, 224, 216]), ...B(-0.52, -0.46, 0, -0.45, 0.46, 0.72, [86, 62, 40])); f.push(...B(-0.0, -0.43, 0.38, 0.47, 0.43, 0.42, mul(m, 0.85))); return f; };
  B3[O.TABLE] = (o) => { const f = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) f.push(...B(sx * 0.38 - 0.04, sy * 0.38 - 0.04, 0, sx * 0.38 + 0.04, sy * 0.38 + 0.04, 0.7, [84, 62, 42])); f.push(...B(-0.46, -0.46, 0.7, 0.46, 0.46, 0.78, PALETTE[o.v & 3], { top: mul(PALETTE[o.v & 3], 1.12) })); return f; };
  B3[O.CHAIR] = () => { const f = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) f.push(...B(sx * 0.15 - 0.025, sy * 0.15 - 0.025, 0, sx * 0.15 + 0.025, sy * 0.15 + 0.025, 0.4, [80, 58, 40])); f.push(...B(-0.19, -0.19, 0.4, 0.19, 0.19, 0.45, [120, 90, 60]), ...B(-0.19, -0.19, 0.45, -0.15, 0.19, 0.9, [110, 82, 56])); return f; };
  B3[O.COUCH] = (o) => { const m = FAB[o.v % FAB.length]; const f = B(-0.4, -0.5, 0, 0.4, 0.5, 0.38, m); f.push(...B(-0.4, -0.5, 0.38, -0.2, 0.5, 0.82, mul(m, 0.9)), ...B(-0.4, -0.5, 0.3, 0.4, -0.36, 0.58, mul(m, 0.8)), ...B(-0.4, 0.36, 0.3, 0.4, 0.5, 0.58, mul(m, 0.8))); for (const s of f) if (s.role === 'top') s.d = (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(w / 2, 0, 1.5, h); grime(x, w, h, 0.2); }; return f; };
  B3[O.WARDROBE] = () => { const f = B(-0.25, -0.46, 0, 0.25, 0.46, 1.7, [112, 80, 52]); for (const s of f) if (s.role === 'px') s.d = doors2; return f; };
  B3[O.TOILET] = () => B(-0.22, -0.17, 0, 0.18, 0.17, 0.38, [226, 226, 222]).concat(B(-0.3, -0.16, 0.38, -0.16, 0.16, 0.85, [218, 218, 214]));
  B3[O.DUMPSTER] = (o) => { const c = [[40, 82, 56], [48, 62, 96], [90, 40, 36]][o.v % 3]; const f = B(-0.4, -0.5, 0, 0.4, 0.5, 0.95, c); f.push(...B(-0.43, -0.53, 0.95, 0.43, 0.53, 1.04, mul(c, 0.8))); for (const s of f) if (s.role === 'px' || s.role === 'py' || s.role === 'ny') s.d = (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 1; i < 6; i++) x.fillRect(w * i / 6, 0, 1.5, h); x.fillStyle = 'rgba(120,60,20,0.3)'; x.fillRect(w * 0.2, h * 0.5, w * 0.3, h * 0.4); grime(x, w, h, 0.5); }; return f; };
  B3[O.BARREL] = (o) => { const c = [[40, 72, 120], [140, 44, 36], [60, 100, 64], [100, 90, 70]][o.v & 3]; return G3.prism(0, 0, 0, 0.88, 0.27, 10, c, { top: mul(c, 1.2) }); };
  B3[O.TRASHCAN] = () => G3.prism(0, 0, 0, 0.72, 0.24, 9, [96, 100, 104], { top: [74, 78, 82], r1: 0.27 });
  B3[O.LOCKER] = () => { const f = B(-0.22, -0.4, 0, 0.22, 0.4, 1.7, [92, 106, 116]); for (const s of f) if (s.role === 'px') s.d = (x, w, h) => { x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1.2; x.strokeRect(1, 1, w / 2 - 1, h - 2); x.strokeRect(w / 2 + 1, 1, w / 2 - 2, h - 2); x.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 4; i++) { x.fillRect(5, 5 + i * 3, w / 2 - 10, 1); x.fillRect(w / 2 + 5, 5 + i * 3, w / 2 - 10, 1); } grime(x, w, h, 0.35); }; return f; };
  B3[O.DESK] = (o) => { const f = B(-0.36, -0.46, 0, 0.36, 0.46, 0.76, [110, 84, 56], { top: [150, 120, 84] }); for (const s of f) if (s.role === 'px') s.d = drawers(3); return f; };
  B3[O.MEDCAB] = () => { const f = B(-0.14, -0.3, 0.9, 0.14, 0.3, 1.6, [226, 228, 228]); for (const s of f) if (s.role === 'px') s.d = (x, w, h) => { x.fillStyle = '#c03030'; x.fillRect(w / 2 - 1.5, h * 0.3, 3, h * 0.4); x.fillRect(w / 2 - 5, h * 0.45, 10, 3); grime(x, w, h, 0.3); }; return f; };
  B3[O.BENCH] = () => { const f = []; for (const sy of [-1, 1]) f.push(...B(-0.14, sy * 0.4 - 0.03, 0, 0.14, sy * 0.4 + 0.03, 0.4, [50, 50, 54])); f.push(...B(-0.17, -0.47, 0.4, 0.17, 0.47, 0.46, [120, 84, 50]), ...B(-0.2, -0.47, 0.46, -0.16, 0.47, 0.82, [120, 84, 50])); return f; };
  B3[O.GENERATOR] = (o) => o.pump ? (() => { const f = B(-0.18, -0.18, 0, 0.18, 0.18, 1.25, [200, 50, 44]); f.push(...B(-0.22, -0.22, 0, 0.22, 0.22, 0.1, [90, 90, 94]), ...B(-0.2, -0.2, 1.25, 0.2, 0.2, 1.34, [60, 60, 66])); for (const s of f) if (s.role === 'px' || s.role === 'py') s.d = (x, w, h) => { x.fillStyle = '#101810'; x.fillRect(w * 0.2, h * 0.16, w * 0.6, h * 0.16); x.fillStyle = '#3ae050'; x.fillRect(w * 0.26, h * 0.2, w * 0.35, h * 0.08); x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(0, h * 0.5, w, 2); }; return f; })() : (() => { const f = B(-0.35, -0.3, 0, 0.35, 0.3, 0.7, [214, 130, 40]); f.push(...B(-0.3, -0.25, 0.7, 0.3, 0.25, 0.82, [40, 40, 44])); for (const s of f) if (s.role === 'px') s.d = (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 4; i++) x.fillRect(w * 0.1, h * (0.2 + i * 0.16), w * 0.8, 2); grime(x, w, h, 0.4); }; return f; })();
  B3[O.HYDRANT] = () => G3.prism(0, 0, 0, 0.5, 0.12, 8, [190, 40, 36], { top: [210, 60, 50], r1: 0.1 }).concat(G3.prism(0, 0, 0.3, 0.38, 0.17, 8, [180, 38, 34]));
  B3[O.MAILBOX] = () => B(-0.025, -0.025, 0, 0.025, 0.025, 0.8, [70, 70, 74]).concat(B(-0.14, -0.1, 0.8, 0.14, 0.1, 1.0, [60, 82, 140]));
  B3[O.BARRIER] = () => { const f = B(-0.18, -0.5, 0, 0.18, 0.5, 0.7, [176, 174, 168]); for (const s of f) if (s.role === 'px' || s.role === 'nx') s.d = (x, w, h) => { x.fillStyle = '#d84a28'; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * w / 4, h * 0.3); x.lineTo(i * w / 4 + w / 8, h * 0.3); x.lineTo(i * w / 4 + w / 8 - 4, h * 0.6); x.lineTo(i * w / 4 - 4, h * 0.6); x.fill(); } grime(x, w, h, 0.4); }; return f; };
  B3[O.TV] = () => B(-0.2, -0.3, 0, 0.2, 0.3, 0.45, [90, 66, 46]).concat(B(-0.08, -0.32, 0.45, 0.1, 0.32, 0.88, [18, 18, 20]));
  B3[O.BOOKSHELF] = (o) => { const f = B(-0.18, -0.46, 0, 0.18, 0.46, 1.6, [96, 68, 44]); for (const s of f) if (s.role === 'px') s.d = goods(o.v * 11 + 5, 5); return f; };
  B3[O.WORKBENCH] = () => { const f = B(-0.3, -0.48, 0, 0.3, 0.48, 0.82, [118, 90, 60], { top: [150, 120, 84] }); f.push(...B(-0.1, -0.3, 0.82, 0.05, -0.1, 0.9, [190, 40, 40]), ...B(0.0, 0.1, 0.82, 0.14, 0.3, 0.86, [100, 100, 106])); return f; };
  B3[O.CHECKOUT] = () => { const f = B(-0.28, -0.46, 0, 0.28, 0.46, 0.9, [90, 94, 100], { top: [60, 62, 66] }); f.push(...B(-0.1, 0.0, 0.9, 0.1, 0.2, 1.06, [30, 32, 36])); return f; };
  B3[O.PILLAR] = () => B(-0.3, -0.3, 0, 0.3, 0.3, 2.3, [128, 126, 120]);
  B3[O.PALLET] = () => { const f = []; for (let i = 0; i < 3; i++) f.push(...B(-0.44, -0.44 + i * 0.36, 0, 0.44, -0.44 + i * 0.36 + 0.14, 0.1, [136, 104, 68])); f.push(...B(-0.44, -0.44, 0.1, 0.44, 0.44, 0.15, [150, 118, 78])); return f; };
  B3[O.CONTAINER] = (o) => { const c = [[150, 52, 44], [48, 84, 130], [64, 112, 74], [140, 100, 50]][o.v & 3]; const f = B(-0.5, -0.5, 0, 0.5, 0.5, 1.6, c); for (const s of f) if (s.role !== 'top') s.d = (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < w; i += 6) x.fillRect(i, 0, 2, h); x.fillStyle = 'rgba(120,60,20,0.28)'; x.fillRect(w * 0.3, h * 0.2, w * 0.2, h * 0.6); grime(x, w, h, 0.5); }; return f; };
  B3[O.GRAVE] = (o) => { const f = B(-0.3, -0.12, 0, 0.3, 0.12, 0.06, [76, 70, 54]); if (o.v & 1) f.push(...B(-0.28, -0.16, 0, -0.2, 0.16, 0.5, [150, 150, 146])); else { f.push(...B(-0.3, -0.03, 0.06, -0.26, 0.03, 0.62, [136, 136, 130]), ...B(-0.3, -0.14, 0.4, -0.26, 0.14, 0.46, [136, 136, 130])); } return f; };
  B3[O.TENT] = () => { const f = G3.prism(0, 0, 0, 0.9, 0.5, 4, [92, 100, 62], { rot: Math.PI / 4, r1: 0.04, top: [80, 90, 56] }); return f; };
  B3[O.WRECKFIRE] = () => G3.prism(0, 0, 0, 0.9, 0.27, 10, [100, 58, 40], { top: [20, 14, 10] });
  B3[O.SIGN] = (o) => B(-0.02, -0.02, 0, 0.02, 0.02, 1.7, [80, 80, 84]).concat(B(-0.02, -0.34, 1.34, 0.02, 0.34, 1.76, [40, 100, 140]));
  B3[O.TRAFFIC] = (o) => { const f = B(-0.03, -0.03, 0, 0.03, 0.03, 2.8, [60, 62, 66]); f.push(...B(-0.1, -0.1, 2.5, 0.1, 0.1, 3.18, [30, 30, 34])); for (const s of f) if (s.role === 'px' || s.role === 'py') s.d = (x, w, h) => { if (w < 4) return; x.fillStyle = '#6a1010'; x.beginPath(); x.arc(w / 2, h * 0.2, w * 0.28, 0, 7); x.fill(); x.fillStyle = '#4a4410'; x.beginPath(); x.arc(w / 2, h * 0.5, w * 0.28, 0, 7); x.fill(); x.fillStyle = '#103a14'; x.beginPath(); x.arc(w / 2, h * 0.8, w * 0.28, 0, 7); x.fill(); }; return f; };
  B3[O.STREETLAMP] = (o) => { const f = B(-0.04, -0.04, 0, 0.04, 0.04, 3.1, [58, 60, 64]); f.push(...B(-0.04, -0.04, 3.04, 0.5, 0.04, 3.12, [58, 60, 64]), ...B(0.35, -0.1, 2.96, 0.6, 0.1, 3.06, o.dead ? [60, 60, 56] : [250, 226, 160])); f.push(...B(-0.12, -0.12, 0, 0.12, 0.12, 0.2, [50, 52, 56])); return f; };
  // base building
  B3[O.BSTORAGE] = () => { const f = B(-0.38, -0.42, 0, 0.38, 0.42, 0.55, [120, 86, 54], { top: [140, 104, 66] }); for (const s of f) if (s.role === 'px' || s.role === 'py' || s.role === 'ny') s.d = (x, w, h) => { planks(x, w, h, 3, false); x.fillStyle = 'rgba(180,184,190,0.8)'; x.fillRect(0, h * 0.4, w, 3); x.fillRect(w / 2 - 3, h * 0.35, 6, 9); }; return f; };
  B3[O.BWORKBENCH] = () => { const f = B(-0.32, -0.48, 0, 0.32, 0.48, 0.84, [132, 96, 60], { top: [166, 130, 88] }); f.push(...B(-0.28, -0.1, 0.84, -0.1, 0.1, 0.92, [200, 60, 40]), ...B(0.05, 0.12, 0.84, 0.22, 0.34, 0.9, [90, 94, 100])); for (const s of f) if (s.role === 'px') s.d = (x, w, h) => { planks(x, w, h, 2, true); }; return f; };
  B3[O.BFIRE] = () => { const f = []; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; f.push(...B(Math.cos(a) * 0.3 - 0.07, Math.sin(a) * 0.3 - 0.07, 0, Math.cos(a) * 0.3 + 0.07, Math.sin(a) * 0.3 + 0.07, 0.1, [96, 94, 90])); } f.push(...B(-0.25, -0.05, 0.04, 0.25, 0.05, 0.14, [74, 46, 28]), ...B(-0.05, -0.25, 0.04, 0.05, 0.25, 0.14, [64, 40, 24])); return f; };
  B3[O.BBED] = (o) => { const f = B(-0.5, -0.44, 0, 0.5, 0.44, 0.18, [120, 90, 58]); f.push(...B(-0.46, -0.4, 0.18, 0.46, 0.4, 0.3, [82, 96, 80]), ...B(-0.44, -0.28, 0.3, -0.2, 0.28, 0.36, [220, 218, 208])); return f; };
  B3[O.BLAMP] = () => { const f = B(-0.03, -0.03, 0, 0.03, 0.03, 1.7, [100, 70, 44]); f.push(...B(-0.1, -0.1, 1.7, 0.1, 0.1, 1.95, [255, 220, 150])); return f; };
  B3[O.BBARR] = (o) => { const f = []; for (let i = 0; i < 5; i++) { const y = -0.4 + i * 0.2; f.push(...G3.prism(0, y, 0, 0.7, 0.04, 4, [130, 100, 66], { r1: 0.005, top: [130, 100, 66] })); } f.push(...B(-0.04, -0.45, 0.15, 0.04, 0.45, 0.22, [100, 76, 50])); return f; };
  B3[O.BRAIN] = () => G3.prism(0, 0, 0, 0.8, 0.3, 10, [60, 90, 130], { top: [30, 60, 90] });
  B3[O.BFURNACE] = () => { const f = B(-0.36, -0.36, 0, 0.36, 0.36, 0.8, [120, 114, 108]); f.push(...G3.prism(0.15, 0.15, 0.8, 1.7, 0.1, 8, [100, 96, 92])); for (const s of f) if (s.role === 'px') s.d = (x, w, h) => { x.fillStyle = '#100808'; x.fillRect(w * 0.25, h * 0.4, w * 0.5, h * 0.35); x.fillStyle = 'rgba(255,120,30,0.65)'; x.fillRect(w * 0.3, h * 0.55, w * 0.4, h * 0.15); grime(x, w, h, 0.4); }; return f; };
  // fences (axis chosen in get())
  function fenceFaces(o, d) {
    const wood = o.t === O.FENCE || o.t === O.BFENCE || o.t === O.BGATE, f = [];
    const axisX = !((o.f | 0) & 1);
    const p = (a0, a1, b0, b1, z0, z1, c, op) => axisX ? B(a0, b0, z0, a1, b1, z1, c, op) : B(b0, a0, z0, b1, a1, z1, c, op);
    if (wood) {
      const c = o.t === O.FENCE ? [150, 144, 132] : [140, 100, 62];
      for (const px of [-0.46, 0.0, 0.46]) f.push(...p(px - 0.04, px + 0.04, -0.04, 0.04, 0, 1.0, mul(c, 0.8)));
      f.push(...p(-0.5, 0.5, -0.03, 0.03, 0.2, 0.3, c), ...p(-0.5, 0.5, -0.03, 0.03, 0.62, 0.72, c));
      for (let i = 0; i < 8; i++) if ((i + (o.v | 0)) % 5 !== 4) f.push(...p(-0.5 + i * 0.125 + 0.01, -0.5 + i * 0.125 + 0.11, -0.02, 0.02, 0.05, 0.92 - ((i * 7 + (o.v | 0)) % 3) * 0.06, c, { noEdge: true }));
    } else {
      for (const px of [-0.48, 0.48]) f.push(...p(px - 0.025, px + 0.025, -0.025, 0.025, 0, 1.1, [120, 124, 130]));
      f.push(...p(-0.5, 0.5, -0.02, 0.02, 1.06, 1.1, [120, 124, 130]));
      const m = p(-0.5, 0.5, -0.008, 0.008, 0.06, 1.05, [150, 156, 164], { top: [150, 156, 164] });
      for (const s of m) s.d = (x, w, h) => { x.strokeStyle = 'rgba(30,32,36,0.55)'; x.lineWidth = 0.8; for (let i = -h; i < w + h; i += 5) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.moveTo(i + h, 0); x.lineTo(i, h); x.stroke(); } }; f.push(...m);
    }
    return f;
  }

  // ---- canvas-drawn organics
  function tree(o) {
    const v = (o.v | 0) & 3, r = U.mulberry32((o.t * 101 + v * 977) | 0), pine = o.t === O.TREE_PINE, dead = o.t === O.TREE_DEAD;
    const W = 150, H = pine ? 230 : 200, [c, x] = U.canvas2d(W, H), cx = W / 2, by = H - 24;
    // trunk
    const trunk = (w, h, col) => { const g = x.createLinearGradient(cx - w, 0, cx + w, 0); g.addColorStop(0, 'rgb(' + col[0] * 1.2 + ',' + col[1] * 1.2 + ',' + col[2] * 1.2 + ')'); g.addColorStop(1, 'rgb(' + col[0] * 0.5 + ',' + col[1] * 0.5 + ',' + col[2] * 0.5 + ')'); x.fillStyle = g; x.beginPath(); x.moveTo(cx - w, by); x.quadraticCurveTo(cx - w * 0.7, by - h * 0.5, cx - w * 0.5, by - h); x.lineTo(cx + w * 0.5, by - h); x.quadraticCurveTo(cx + w * 0.7, by - h * 0.5, cx + w, by); x.fill(); x.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 12; i++) x.fillRect(cx - w + r() * w * 2, by - r() * h, 1, 6 + r() * 14); };
    const leafBlob = (px, py, rad, base, n) => {
      const g = x.createRadialGradient(px - rad * 0.3, py - rad * 0.4, rad * 0.1, px, py, rad);
      g.addColorStop(0, 'rgb(' + (base[0] * 1.35 | 0) + ',' + (base[1] * 1.35 | 0) + ',' + (base[2] * 1.3 | 0) + ')'); g.addColorStop(0.7, 'rgb(' + base[0] + ',' + base[1] + ',' + base[2] + ')'); g.addColorStop(1, 'rgb(' + (base[0] * 0.5 | 0) + ',' + (base[1] * 0.55 | 0) + ',' + (base[2] * 0.5 | 0) + ')');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill();
      for (let i = 0; i < n; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * rad * 0.92; x.fillStyle = r() < 0.5 ? 'rgba(10,22,8,0.35)' : 'rgba(170,200,90,0.22)'; x.beginPath(); x.arc(px + Math.cos(a) * d, py + Math.sin(a) * d * 0.9, 1.5 + r() * 3.2, 0, 7); x.fill(); }
    };
    if (pine) {
      trunk(5, 60, [78, 52, 34]);
      const base = [[26, 58, 36], [30, 64, 40], [24, 52, 34], [34, 66, 38]][v];
      for (let i = 0; i < 6; i++) {
        const y = by - 34 - i * 24, wd = 56 - i * 8.5 + r() * 4;
        const g = x.createLinearGradient(cx - wd, y, cx + wd, y); g.addColorStop(0, 'rgb(' + base[0] * 1.5 + ',' + base[1] * 1.5 + ',' + base[2] * 1.4 + ')'); g.addColorStop(0.55, 'rgb(' + base[0] + ',' + base[1] + ',' + base[2] + ')'); g.addColorStop(1, 'rgb(' + base[0] * 0.45 + ',' + base[1] * 0.5 + ',' + base[2] * 0.45 + ')');
        x.fillStyle = g; x.beginPath(); x.moveTo(cx, y - 42);
        for (let k = 0; k <= 8; k++) { const t = k / 8; x.lineTo(cx + wd * t + (r() - 0.5) * 4, y - 42 + 56 * t + Math.sin(t * 9) * 3); }
        x.quadraticCurveTo(cx, y + 20, cx - wd, y + 14);
        for (let k = 8; k >= 0; k--) { const t = k / 8; x.lineTo(cx - wd * t + (r() - 0.5) * 4, y - 42 + 56 * t + Math.sin(t * 9) * 3); }
        x.fill();
        for (let k = 0; k < 40; k++) { const t = r(), px = cx + (r() - 0.5) * wd * 1.7 * t, py = y - 42 + 56 * t * (0.8 + r() * 0.3); x.strokeStyle = r() < 0.5 ? 'rgba(8,20,10,0.5)' : 'rgba(120,160,80,0.28)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 10, py + 3 + r() * 5); x.stroke(); }
      }
    } else if (dead) {
      trunk(5, 70, [62, 52, 44]);
      const br = (px, py, a, l, w, d) => { const ex = px + Math.cos(a) * l, ey = py + Math.sin(a) * l; x.strokeStyle = 'rgb(58,48,40)'; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo((px + ex) / 2 + (r() - 0.5) * 10, (py + ey) / 2 + (r() - 0.5) * 10, ex, ey); x.stroke(); x.strokeStyle = 'rgba(160,140,120,0.25)'; x.lineWidth = w * 0.3; x.beginPath(); x.moveTo(px - 1, py); x.lineTo(ex - 1, ey); x.stroke(); if (d > 0) { br(ex, ey, a - 0.5 - r() * 0.4, l * 0.7, w * 0.65, d - 1); br(ex, ey, a + 0.5 + r() * 0.4, l * 0.7, w * 0.65, d - 1); } };
      br(cx, by - 66, -Math.PI / 2 - 0.1, 50, 5, 3); br(cx, by - 50, -Math.PI / 2 - 0.9, 38, 4, 2); br(cx, by - 44, -Math.PI / 2 + 0.9, 36, 4, 2);
    } else {
      trunk(7, 62, [82, 62, 44]);
      const base = [[52, 88, 40], [60, 96, 44], [74, 90, 38], [58, 82, 46]][v];
      const pts = []; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + r(), d = 24 + r() * 8; pts.push([cx + Math.cos(a) * d, by - 108 + Math.sin(a) * d * 0.55, 26 + r() * 10]); }
      pts.sort((a, b) => a[1] - b[1]); for (const p of pts) leafBlob(p[0], p[1], p[2], base, 20); leafBlob(cx, by - 112, 30, base, 22);
    }
    return { c, ox: cx, oy: by };
  }
  function bush(o) {
    const r = U.mulberry32(o.v * 31 + 5), [c, x] = U.canvas2d(60, 44);
    for (let i = 0; i < 6; i++) { const px = 14 + r() * 32, py = 20 + r() * 12, rad = 9 + r() * 6; const g = x.createRadialGradient(px - 3, py - 4, 1, px, py, rad); g.addColorStop(0, 'rgb(86,130,60)'); g.addColorStop(0.7, 'rgb(44,82,38)'); g.addColorStop(1, 'rgb(22,44,22)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill(); }
    for (let i = 0; i < 40; i++) { x.fillStyle = r() < 0.5 ? 'rgba(10,24,8,0.4)' : 'rgba(180,210,100,0.2)'; x.beginPath(); x.arc(10 + r() * 40, 10 + r() * 26, 1 + r() * 2, 0, 7); x.fill(); }
    return { c, ox: 30, oy: 34 };
  }
  function rock(o) {
    const r = U.mulberry32(o.v * 17 + 3), [c, x] = U.canvas2d(80, 60), pts = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; pts.push([40 + Math.cos(a) * (26 + r() * 8), 36 + Math.sin(a) * (14 + r() * 5) - (Math.sin(a) < 0 ? 8 + r() * 6 : 0)]); }
    const g = x.createLinearGradient(20, 10, 60, 50); g.addColorStop(0, '#9a9a98'); g.addColorStop(1, '#40403e'); x.fillStyle = g; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1; x.stroke(); for (let i = 0; i < 10; i++) { x.strokeStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); const px = 20 + r() * 40, py = 18 + r() * 24; x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 14, py + (r() - 0.5) * 8); x.stroke(); }
    x.fillStyle = 'rgba(60,100,40,0.5)'; x.beginPath(); x.ellipse(36, 36, 14, 4, 0, 0, 7); x.fill();
    return { c, ox: 40, oy: 40 };
  }

  Props.get = function (o) {
    const t = o.t, d = DSZ.OBJDEF[t];
    const isTree = d.tree, ang = ((o.f | 0) & 3) * Math.PI / 2;
    const key = t + '|' + ((d.fence || t === O.BARRIER || t === O.CONTAINER) ? (o.f & 1) : (o.f & 3)) + '|' + (o.v & 3) + (o.dead ? 'd' : '') + (o.pump ? 'p' : '') + (o.t === O.BGATE && o.open ? 'o' : '');
    let s = cache.get(key);
    if (s) return s;
    if (isTree) s = tree(o);
    else if (t === O.BUSH) s = bush(o);
    else if (t === O.ROCK) s = rock(o);
    else {
      let faces;
      if (d.fence) faces = fenceFaces(o);
      else if (B3[t]) faces = B3[t](o);
      else faces = B(-0.4, -0.4, 0, 0.4, 0.4, 0.8, [160, 80, 160]);
      const a = (t === O.BARRIER || t === O.CONTAINER) ? ((o.f & 1) ? Math.PI / 2 : 0) : (d.fence ? 0 : ang);
      s = G3.render(faces, a);
    }
    cache.set(key, s); return s;
  };
})();
