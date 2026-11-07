/* Dead SectorZ — procedural ground textures (seamless, high detail) */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U;

  DSZ.G = { GRASS: 0, DIRT: 1, ASPHALT: 2, SIDEWALK: 3, CONCRETE: 4, GRAVEL: 5, WOOD: 6, TILE: 7, CARPET: 8, LINO: 9, CONC_IN: 10, FOREST: 11, PARKING: 12, BWOOD: 13, BMETAL: 14, MUD: 15 };
  const G = DSZ.G;
  // random: offset the texture slice randomly per tile; step: slice alignment grid
  DSZ.GINFO = [
    { name: 'grass', tex: 'grass', random: true, step: 8 },
    { name: 'dirt', tex: 'dirt', random: true, step: 8 },
    { name: 'asphalt', tex: 'asphalt', random: true, step: 8 },
    { name: 'sidewalk', tex: 'sidewalk', random: true, step: 64 },
    { name: 'concrete', tex: 'concrete', random: true, step: 64 },
    { name: 'gravel', tex: 'gravel', random: true, step: 8 },
    { name: 'wood', tex: 'wood', random: true, step: 64 },
    { name: 'tile', tex: 'tile', random: true, step: 64 },
    { name: 'carpet', tex: 'carpet', random: true, step: 8 },
    { name: 'lino', tex: 'lino', random: true, step: 64 },
    { name: 'conc_in', tex: 'concin', random: true, step: 64 },
    { name: 'forest', tex: 'forest', random: true, step: 8 },
    { name: 'parking', tex: 'parking', random: true, step: 8 },
    { name: 'bwood', tex: 'bwood', random: true, step: 64 },
    { name: 'bmetal', tex: 'bmetal', random: true, step: 64 },
    { name: 'mud', tex: 'mud', random: true, step: 8 }
  ];

  const S = 256;
  const Tex = DSZ.Tex = { ground: {}, S };
  const out = [0, 0, 0];

  function gen(fn) {
    const [c, x] = U.canvas2d(S, S);
    const id = x.createImageData(S, S), d = id.data;
    for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
      fn(xx, y, out);
      const i = (y * S + xx) * 4;
      d[i] = out[0] < 0 ? 0 : out[0] > 255 ? 255 : out[0];
      d[i + 1] = out[1] < 0 ? 0 : out[1] > 255 ? 255 : out[1];
      d[i + 2] = out[2] < 0 ? 0 : out[2] > 255 ? 255 : out[2];
      d[i + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    return [c, x];
  }
  const nz = (x, y, sc, seed, oct) => U.fbm(x / S * sc, y / S * sc, seed, oct || 2, sc);

  function wrap(ctx, fn) { for (let dx = -S; dx <= S; dx += S) for (let dy = -S; dy <= S; dy += S) { ctx.save(); ctx.translate(dx, dy); fn(); ctx.restore(); } }
  function wrapAt(ctx, x, y, r, fn) { // draw object at (x,y) with wrap if near edge
    for (let dx = -S; dx <= S; dx += S) {
      if ((dx < 0 && x > r) || (dx > 0 && x < S - r)) continue;
      for (let dy = -S; dy <= S; dy += S) {
        if ((dy < 0 && y > r) || (dy > 0 && y < S - r)) continue;
        fn(x + dx, y + dy);
      }
    }
  }
  function crack(ctx, rng, x, y, ang, len, w, col, depth) {
    const pts = [[x, y]]; let a = ang;
    for (let i = 0; i < len; i++) {
      a += (rng() - 0.5) * 0.9; const l = 3 + rng() * 6;
      x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]);
      if (depth < 2 && rng() < 0.07) crack(ctx, rng, x, y, a + (rng() < 0.5 ? 1 : -1) * (0.5 + rng() * 0.8), (len - i) * 0.5 | 0, w * 0.7, col, depth + 1);
    }
    wrap(ctx, () => {
      ctx.beginPath(); ctx.moveTo(pts[0][0] + 1, pts[0][1] + 1);
      for (const p of pts) ctx.lineTo(p[0] + 1, p[1] + 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = w; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    });
  }
  function stains(ctx, rng, n, rmin, rmax, col, a) {
    for (let i = 0; i < n; i++) {
      const x = rng() * S, y = rng() * S, r = rmin + rng() * (rmax - rmin);
      wrapAt(ctx, x, y, r, (px, py) => {
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, 'rgba(' + col + ',' + (a * (0.5 + rng() * 0.5)) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, r, r * (0.5 + rng() * 0.5), rng() * 3, 0, 7); ctx.fill();
      });
    }
  }
  function specks(ctx, rng, n, cols, rmax) {
    for (let i = 0; i < n; i++) {
      const x = rng() * S, y = rng() * S, r = 0.4 + rng() * rmax;
      ctx.fillStyle = cols[(rng() * cols.length) | 0];
      wrapAt(ctx, x, y, r + 1, (px, py) => { ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); });
    }
  }

  function makeGrass() {
    const [c, x] = gen((px, py, o) => {
      const a = nz(px, py, 6, 11, 3), b = nz(px, py, 28, 12, 2), m = nz(px, py, 3, 13, 2);
      const dry = Math.max(0, m - 0.55) * 2.2;
      o[0] = 44 + a * 30 + b * 16 + dry * 40;
      o[1] = 62 + a * 40 + b * 20 + dry * 20;
      o[2] = 36 + a * 18 + b * 8 + dry * 4;
    });
    const rng = U.mulberry32(777);
    for (let i = 0; i < 5200; i++) {
      const px = rng() * S, py = rng() * S, l = 3 + rng() * 7, a = -Math.PI / 2 + (rng() - 0.5) * 1.1, lite = rng();
      x.strokeStyle = lite < 0.35 ? 'rgba(20,34,16,' + (0.3 + rng() * 0.3) + ')' : 'rgba(' + (95 + rng() * 40 | 0) + ',' + (125 + rng() * 50 | 0) + ',' + (60 + rng() * 25 | 0) + ',' + (0.25 + rng() * 0.3) + ')';
      x.lineWidth = 0.8 + rng() * 0.6;
      wrapAt(x, px, py, l, (qx, qy) => { x.beginPath(); x.moveTo(qx, qy); x.quadraticCurveTo(qx + Math.cos(a) * l * 0.5 + (rng() - 0.5) * 2, qy + Math.sin(a) * l * 0.6, qx + Math.cos(a) * l, qy + Math.sin(a) * l); x.stroke(); });
    }
    stains(x, rng, 18, 10, 36, '70,56,38', 0.28);
    specks(x, rng, 90, ['rgba(200,190,90,0.7)', 'rgba(230,230,230,0.55)', 'rgba(150,110,170,0.5)'], 1.4);
    return c;
  }
  function makeDirt() {
    const [c, x] = gen((px, py, o) => {
      const a = nz(px, py, 5, 21, 3), b = nz(px, py, 40, 22, 2);
      o[0] = 82 + a * 40 + b * 18; o[1] = 64 + a * 32 + b * 14; o[2] = 46 + a * 22 + b * 10;
    });
    const rng = U.mulberry32(901);
    specks(x, rng, 700, ['rgba(40,30,22,0.6)', 'rgba(150,130,104,0.5)', 'rgba(110,98,84,0.6)'], 1.8);
    stains(x, rng, 12, 14, 40, '40,30,20', 0.3);
    return c;
  }
  function makeMud() {
    const [c, x] = gen((px, py, o) => {
      const a = nz(px, py, 4, 31, 3);
      o[0] = 52 + a * 28; o[1] = 42 + a * 22; o[2] = 32 + a * 16;
    });
    const rng = U.mulberry32(31);
    stains(x, rng, 20, 12, 36, '20,16,12', 0.35);
    specks(x, rng, 300, ['rgba(120,100,80,0.4)', 'rgba(20,18,14,0.5)'], 1.6);
    return c;
  }
  function makeAsphalt(dark) {
    const k = dark ? 0.78 : 1;
    const [c, x] = gen((px, py, o) => {
      const a = nz(px, py, 4, 41, 3), b = nz(px, py, 22, 42, 2), f = nz(px, py, 90, 43, 1);
      const v = (40 + a * 26 + b * 12 + f * 14) * k;
      o[0] = v * 0.97; o[1] = v * 1.0; o[2] = v * 1.08;
    });
    const rng = U.mulberry32(dark ? 4242 : 4141);
    stains(x, rng, 14, 18, 60, '12,12,14', 0.35);          // oil
    stains(x, rng, 8, 30, 80, '86,88,92', 0.12);           // pale patches
    specks(x, rng, 2600, ['rgba(120,124,130,0.55)', 'rgba(20,20,22,0.6)', 'rgba(90,92,96,0.5)'], 1.0);
    for (let i = 0; i < 9; i++) crack(x, rng, rng() * S, rng() * S, rng() * 6.28, 18 + rng() * 40, 0.9 + rng() * 0.9, 'rgba(8,8,10,0.9)', 0);
    // patch rectangles (repairs)
    for (let i = 0; i < 3; i++) {
      const px = rng() * S, py = rng() * S, w = 30 + rng() * 40, h = 20 + rng() * 30;
      wrapAt(x, px, py, 60, (qx, qy) => { x.fillStyle = 'rgba(14,14,16,0.45)'; x.fillRect(qx, qy, w, h); x.strokeStyle = 'rgba(5,5,6,0.6)'; x.lineWidth = 1.2; x.strokeRect(qx, qy, w, h); });
    }
    return c;
  }
  function makeSidewalk() {
    const [c, x] = gen((px, py, o) => {
      const a = nz(px, py, 8, 51, 3), b = nz(px, py, 50, 52, 2);
      const slab = (U.hash2((px / 64) | 0, (py / 64) | 0, 53) - 0.5) * 16;
      const v = 112 + a * 30 + b * 14 + slab;
      o[0] = v; o[1] = v * 0.99; o[2] = v * 0.96;
    });
    const rng = U.mulberry32(5151);
    stains(x, rng, 22, 10, 40, '50,46,40', 0.22);
    specks(x, rng, 900, ['rgba(60,58,54,0.5)', 'rgba(170,166,158,0.5)'], 1.1);
    for (let i = 0; i < 10; i++) crack(x, rng, rng() * S, rng() * S, rng() * 6.28, 8 + rng() * 22, 0.8, 'rgba(24,22,20,0.85)', 1);
    // slab joints
    x.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      const p = i * 64;
      x.strokeStyle = 'rgba(18,16,14,0.8)'; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, S); x.moveTo(0, p); x.lineTo(S, p); x.stroke();
      x.strokeStyle = 'rgba(200,196,188,0.18)'; x.lineWidth = 1; x.beginPath(); x.moveTo(p + 2, 0); x.lineTo(p + 2, S); x.moveTo(0, p + 2); x.lineTo(S, p + 2); x.stroke(); x.lineWidth = 2;
    }
    // weeds in joints
    for (let i = 0; i < 90; i++) {
      const horiz = rng() < 0.5, p = ((rng() * 4) | 0) * 64, t = rng() * S;
      const px = horiz ? t : p, py = horiz ? p : t;
      x.strokeStyle = 'rgba(' + (60 + rng() * 40 | 0) + ',' + (90 + rng() * 50 | 0) + ',40,0.8)'; x.lineWidth = 1;
      for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rng() - 0.5) * 6, py - 2 - rng() * 5); x.stroke(); }
    }
    return c;
  }
  function makeConcrete() {
    const [c, x] = gen((px, py, o) => {
      const a = nz(px, py, 6, 61, 3), b = nz(px, py, 60, 62, 2);
      const slab = (U.hash2((px / 128) | 0, (py / 128) | 0, 63) - 0.5) * 12;
      const v = 92 + a * 34 + b * 14 + slab; o[0] = v; o[1] = v; o[2] = v * 1.02;
    });
    const rng = U.mulberry32(6161);
    stains(x, rng, 18, 14, 50, '30,28,26', 0.3); specks(x, rng, 1200, ['rgba(50,50,52,0.5)', 'rgba(150,150,150,0.4)'], 1.2);
    for (let i = 0; i < 7; i++) crack(x, rng, rng() * S, rng() * S, rng() * 6.28, 14 + rng() * 30, 0.9, 'rgba(14,14,16,0.85)', 1);
    x.strokeStyle = 'rgba(20,20,22,0.7)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, 128); x.lineTo(S, 128); x.moveTo(128, 0); x.lineTo(128, S); x.moveTo(0, 0); x.lineTo(S, 0); x.moveTo(0, 0); x.lineTo(0, S); x.stroke();
    return c;
  }
  function makeGravel() {
    const [c, x] = gen((px, py, o) => { const a = nz(px, py, 10, 71, 3); const v = 96 + a * 50; o[0] = v; o[1] = v * 0.97; o[2] = v * 0.9; });
    const rng = U.mulberry32(7171);
    for (let i = 0; i < 2600; i++) {
      const px = rng() * S, py = rng() * S, r = 1 + rng() * 2.6, v = 60 + rng() * 110;
      wrapAt(x, px, py, r + 2, (qx, qy) => {
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.ellipse(qx + 0.8, qy + 0.8, r, r * 0.8, 0, 0, 7); x.fill();
        x.fillStyle = 'rgb(' + v + ',' + (v * 0.97 | 0) + ',' + (v * 0.9 | 0) + ')'; x.beginPath(); x.ellipse(qx, qy, r, r * 0.8, rng() * 3, 0, 7); x.fill();
      });
    }
    return c;
  }
  function makeWood(light) {
    const [c, x] = gen((px, py, o) => {
      const plank = (py / 16) | 0, t = (U.hash2(plank, ((px + plank * 37) / 96) | 0, 81) - 0.5) * 30;
      const grain = U.vnoise(px * 0.05, py * 0.9, 82, 0) * 22 + U.vnoise(px * 0.2, py * 0.3, 83) * 10;
      const edge = (py % 16 < 1.5) ? -34 : 0;
      const k = light ? 1.25 : 1;
      o[0] = (96 + t + grain + edge) * k; o[1] = (66 + t * 0.8 + grain * 0.8 + edge) * k; o[2] = (40 + t * 0.5 + grain * 0.5 + edge) * k;
    });
    const rng = U.mulberry32(light ? 8282 : 8181);
    stains(x, rng, 14, 14, 44, '24,16,10', 0.3);
    for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(30,20,14,0.6)'; const px = ((rng() * 16) | 0) * 16 + 8, py = ((rng() * 16) | 0) * 16 + 3; x.fillRect(px, py, 2, 2); x.fillRect(px + 22, py + 8, 2, 2); }
    for (let i = 0; i < 6; i++) crack(x, rng, rng() * S, rng() * S, rng() * 6.28, 6 + rng() * 10, 0.8, 'rgba(10,6,4,0.7)', 2);
    return c;
  }
  function makeTile() {
    const [c, x] = gen((px, py, o) => {
      const gx = (px / 32) | 0, gy = (py / 32) | 0, ck = (gx + gy) & 1;
      const n = nz(px, py, 14, 91, 2) * 22, v = (ck ? 150 : 182) + n;
      const g = (px % 32 < 1.2 || py % 32 < 1.2) ? -70 : 0;
      o[0] = v + g; o[1] = v * 0.98 + g; o[2] = v * 0.93 + g;
    });
    const rng = U.mulberry32(9191);
    stains(x, rng, 16, 12, 44, '60,48,36', 0.3);
    for (let i = 0; i < 8; i++) crack(x, rng, rng() * S, rng() * S, rng() * 6.28, 8 + rng() * 14, 0.8, 'rgba(30,24,20,0.7)', 2);
    return c;
  }
  function makeLino() {
    const [c, x] = gen((px, py, o) => {
      const ck = (((px / 32) | 0) + ((py / 32) | 0)) & 1, n = nz(px, py, 12, 95, 2) * 16;
      const v = ck ? 62 + n : 150 + n; o[0] = v; o[1] = v * 1.02; o[2] = v * 0.98;
    });
    const rng = U.mulberry32(9595); stains(x, rng, 20, 10, 40, '20,18,14', 0.34); specks(x, rng, 300, ['rgba(20,20,20,0.5)'], 1.4);
    return c;
  }
  function makeCarpet() {
    const [c, x] = gen((px, py, o) => {
      const a = nz(px, py, 12, 101, 2), f = U.vnoise(px * 0.9, py * 0.9, 102) * 22;
      const pat = (((px / 16) | 0) + ((py / 16) | 0)) & 1 ? 6 : 0;
      o[0] = 82 + a * 26 + f + pat; o[1] = 62 + a * 20 + f * 0.8 + pat; o[2] = 60 + a * 20 + f * 0.8 + pat;
    });
    const rng = U.mulberry32(10101); stains(x, rng, 22, 12, 46, '30,16,14', 0.34); return c;
  }
  function makeConcIn() {
    const [c, x] = gen((px, py, o) => { const a = nz(px, py, 6, 111, 3), b = nz(px, py, 40, 112, 2); const v = 70 + a * 30 + b * 12; o[0] = v; o[1] = v; o[2] = v * 1.03; });
    const rng = U.mulberry32(11111); stains(x, rng, 22, 12, 50, '20,20,20', 0.35); specks(x, rng, 900, ['rgba(30,30,32,0.5)', 'rgba(130,130,134,0.4)'], 1.1);
    for (let i = 0; i < 6; i++) crack(x, rng, rng() * S, rng() * S, rng() * 6.28, 14 + rng() * 28, 0.9, 'rgba(8,8,10,0.85)', 1);
    return c;
  }
  function makeForest() {
    const [c, x] = gen((px, py, o) => {
      const a = nz(px, py, 7, 121, 3), b = nz(px, py, 30, 122, 2);
      o[0] = 38 + a * 26 + b * 12; o[1] = 44 + a * 28 + b * 10; o[2] = 26 + a * 14 + b * 6;
    });
    const rng = U.mulberry32(12121);
    for (let i = 0; i < 700; i++) { // leaves / needles
      const px = rng() * S, py = rng() * S, l = 2 + rng() * 5, a = rng() * 6.28;
      x.strokeStyle = rng() < 0.5 ? 'rgba(' + (110 + rng() * 40 | 0) + ',' + (80 + rng() * 30 | 0) + ',30,0.5)' : 'rgba(20,24,14,0.6)'; x.lineWidth = 1;
      wrapAt(x, px, py, l, (qx, qy) => { x.beginPath(); x.moveTo(qx, qy); x.lineTo(qx + Math.cos(a) * l, qy + Math.sin(a) * l); x.stroke(); });
    }
    stains(x, rng, 20, 14, 44, '14,18,10', 0.4);
    return c;
  }
  function makeBWood() { return makeWood(true); }
  function makeBMetal() {
    const [c, x] = gen((px, py, o) => {
      const a = nz(px, py, 8, 131, 2); const brush = U.vnoise(px * 0.8, py * 0.04, 132) * 14; const v = 100 + a * 24 + brush;
      const j = (px % 64 < 1.5 || py % 64 < 1.5) ? -45 : 0; o[0] = v + j; o[1] = v * 1.02 + j; o[2] = v * 1.06 + j;
    });
    const rng = U.mulberry32(13131);
    for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 4; gy++) for (const [ax, ay] of [[6, 6], [58, 6], [6, 58], [58, 58]]) {
      const px = gx * 64 + ax, py = gy * 64 + ay;
      x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.arc(px + 1, py + 1, 2.4, 0, 7); x.fill();
      x.fillStyle = 'rgba(190,196,204,0.8)'; x.beginPath(); x.arc(px, py, 2, 0, 7); x.fill();
    }
    stains(x, rng, 16, 14, 40, '70,40,20', 0.25); // rust
    return c;
  }

  Tex.init = function () {
    const mk = {
      grass: makeGrass, dirt: makeDirt, asphalt: () => makeAsphalt(false), parking: () => makeAsphalt(true), sidewalk: makeSidewalk,
      concrete: makeConcrete, gravel: makeGravel, wood: () => makeWood(false), tile: makeTile, carpet: makeCarpet, lino: makeLino,
      concin: makeConcIn, forest: makeForest, bwood: makeBWood, bmetal: makeBMetal, mud: makeMud
    };
    for (const k in mk) Tex.ground[k] = mk[k]();
  };

  // soft round shadow blob sprite & misc shared canvases
  Tex.blob = (function () {
    const [c, x] = U.canvas2d(64, 32);
    const g = x.createRadialGradient(32, 16, 0, 32, 16, 30);
    g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.6, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.save(); x.scale(1, 0.5); x.translate(0, 16); x.beginPath(); x.arc(32, 16, 30, 0, 7); x.fill(); x.restore();
    return c;
  })();
})();
