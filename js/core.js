/* Dead SectorZ — core: namespace, constants, math/noise utilities, event bus */
(function () {
  'use strict';
  const DSZ = window.DSZ = {};

  DSZ.C = {
    TW: 64, TH: 32,          // iso tile size in px (zoom 1)
    WH: 92,                  // wall height in px
    W: 176, H: 176,          // world size in tiles
    CH: 8,                   // chunk size in tiles
    STREET0: 16, SP: 36,     // first street centre, spacing between streets
    ROAD: 6, SIDE: 2,        // road width, sidewalk width
    DAY_LEN: 1500,           // seconds per full in-game day
    START_HOUR: 17.2,
    VERSION: '0.1.0'
  };

  const U = DSZ.U = {};
  U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = t => t * t * (3 - 2 * t);
  U.dist = (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0);
  U.angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  U.rgba = (r, g, b, a) => 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + (a === undefined ? 1 : a) + ')';
  U.mix = (c0, c1, t) => [U.lerp(c0[0], c1[0], t), U.lerp(c0[1], c1[1], t), U.lerp(c0[2], c1[2], t)];

  // seeded RNG
  U.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash2 = function (x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  U.pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  U.shuffle = (rng, arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
  U.weighted = function (rng, table) { // table: [[value, weight], ...]
    let tot = 0; for (const e of table) tot += e[1];
    let r = rng() * tot;
    for (const e of table) { r -= e[1]; if (r <= 0) return e[0]; }
    return table[table.length - 1][0];
  };

  // value noise (smooth), optionally periodic
  U.vnoise = function (x, y, seed, period) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    let x0 = xi, x1 = xi + 1, y0 = yi, y1 = yi + 1;
    if (period) {
      x0 = ((x0 % period) + period) % period; x1 = ((x1 % period) + period) % period;
      y0 = ((y0 % period) + period) % period; y1 = ((y1 % period) + period) % period;
    }
    const a = U.hash2(x0, y0, seed), b = U.hash2(x1, y0, seed), c = U.hash2(x0, y1, seed), d = U.hash2(x1, y1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  U.fbm = function (x, y, seed, oct, period) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * U.vnoise(x * f, y * f, seed + i * 31, period ? period * f : 0);
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  };

  // canvas helper
  U.canvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    return c;
  };
  U.canvas2d = function (w, h) {
    const c = U.canvas(w, h);
    return [c, c.getContext('2d')];
  };

  // iso projection (no camera)
  U.toIso = (wx, wy) => [(wx - wy) * 32, (wx + wy) * 16];
  U.fromIso = (sx, sy) => { const a = sx / 32, b = sy / 16; return [(a + b) / 2, (b - a) / 2]; };

  // tiny event bus
  const handlers = {};
  DSZ.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
  DSZ.emit = (ev, a, b, c) => { const h = handlers[ev]; if (h) for (let i = 0; i < h.length; i++) h[i](a, b, c); };

  DSZ.settings = {
    renderScale: 1, lightRes: 0.25, blur: true, grain: true, bloom: true, shadows: true,
    volume: 0.7, music: 0.5, quality: 'auto', showFps: false, godmode: false
  };
  try {
    const s = JSON.parse(localStorage.getItem('dsz_settings') || 'null');
    if (s) Object.assign(DSZ.settings, s);
  } catch (e) { /* ignore */ }
  DSZ.saveSettings = () => { try { localStorage.setItem('dsz_settings', JSON.stringify(DSZ.settings)); } catch (e) { /* ignore */ } };
  // settings are saved on every change; this is just a safety net so nothing is ever lost
  window.addEventListener('beforeunload', DSZ.saveSettings);
})();
