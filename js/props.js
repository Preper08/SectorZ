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

  // ---- shared TV screen content: a dead "emergency broadcast" (CRT). Drawn tiny on the world
  // prop and enlarged + animated in the interaction popup, so both show the same channel.
  // t = seconds (animation), seed = per-TV offset so different sets look distinct.
  let tvNoise = null;
  function tvNoiseTile() {
    if (tvNoise) return tvNoise;
    const [c, x] = U.canvas2d(64, 64), id = x.createImageData(64, 64), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    x.putImageData(id, 0, 0); tvNoise = c; return c;
  }
  // ---- TV channels. Channel 1 is the existing dead emergency broadcast (unchanged).
  // Channels 2-4 are drawn by Props.tvDrawChannel below; the world prop always shows
  // channel 1 so the tiny in-world screens keep their original look.
  Props.TV_CHANNELS = 4;
  Props.TV_CHANNEL_NAMES = ['Emergency Broadcast', 'Commentary', 'No Signal', 'Terminal'];

  // Channel 2: BREAKING NEWS. A full newsroom set - a wall of glowing monitors, a commentator
  // at the desk, a shaky live field inset with smoke and fire glow, a pulsing red banner, an
  // animated lower third and a scrolling ticker. Purely visual, no gameplay effect. In-world
  // (tiny) screens use a compact variant so the world props stay cheap and readable.
  function tvChannel2(x, w, h, t, seed) {
    const small = h < 60;
    x.save();
    // ---------- newsroom backdrop
    const bg = x.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#121822'); bg.addColorStop(1, '#07090d');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);

    if (!small) {
      // wall of glowing monitors behind the presenter (right half of the frame)
      const mc = 4, mr = 2, mw = w * 0.062, mhh = h * 0.072;
      for (let r = 0; r < mr; r++) for (let c = 0; c < mc; c++) {
        const mx = w * 0.475 + c * mw * 1.22, my = h * 0.155 + r * mhh * 1.32;
        const fl = 0.5 + 0.5 * Math.sin(t * 2.6 + c * 1.9 + r * 2.2 + seed);
        x.fillStyle = 'rgba(74,116,168,' + (0.09 + fl * 0.15).toFixed(3) + ')';
        x.fillRect(mx, my, mw, mhh);
        x.strokeStyle = 'rgba(8,10,14,0.85)'; x.lineWidth = Math.max(1, w * 0.0018);
        x.strokeRect(mx, my, mw, mhh);
      }

      // ---------- live field inset (LEFT side): handheld street shot, smoke and fire
      const ix = w * 0.045, iy = h * 0.145, iw = w * 0.375, ih = h * 0.33;
      const shake = (Math.sin(t * 7.3) + Math.sin(t * 11.7) * 0.6) * w * 0.0022;
      x.save(); x.beginPath(); x.rect(ix, iy, iw, ih); x.clip();
      const st = x.createLinearGradient(0, iy, 0, iy + ih);
      st.addColorStop(0, '#2b3138'); st.addColorStop(0.55, '#3b3026'); st.addColorStop(1, '#191411');
      x.fillStyle = st; x.fillRect(ix, iy, iw, ih);
      // distant building blocks
      x.fillStyle = 'rgba(18,20,26,0.8)';
      for (let i = 0; i < 6; i++) { const bw = iw / 8, bh = ih * (0.22 + ((i * 41 + seed) % 34) / 100); x.fillRect(ix + i * bw * 1.2 + shake, iy + ih - bh, bw, bh); }
      // fire glow from the street
      const fg = x.createRadialGradient(ix + iw * 0.33, iy + ih * 0.80, 2, ix + iw * 0.33, iy + ih * 0.80, iw * 0.45);
      fg.addColorStop(0, 'rgba(255,152,52,' + (0.46 + 0.16 * Math.sin(t * 9)).toFixed(3) + ')');
      fg.addColorStop(1, 'rgba(255,120,40,0)');
      x.fillStyle = fg; x.fillRect(ix, iy, iw, ih);
      // drifting smoke columns
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.09 + i * 0.21 + seed * 0.01) % 1;
        x.fillStyle = 'rgba(124,126,132,' + (0.15 * (1 - ph)).toFixed(3) + ')';
        x.beginPath(); x.arc(ix + iw * (0.18 + i * 0.16) + shake * 3, iy + ih * (0.82 - ph * 0.72), iw * (0.05 + ph * 0.1), 0, 7); x.fill();
      }
      // running silhouettes
      x.fillStyle = 'rgba(11,11,13,0.85)';
      for (let i = 0; i < 3; i++) {
        const px = ix + ((t * (26 + i * 9) + i * 95) % (iw + 40)) - 20;
        const hy = iy + ih * 0.70;
        x.fillRect(px, hy, iw * 0.021, ih * 0.2);
        x.beginPath(); x.arc(px + iw * 0.0105, hy - ih * 0.03, iw * 0.017, 0, 7); x.fill();
      }
      x.restore();
      // inset frame + LIVE badge
      x.strokeStyle = 'rgba(200,72,60,0.92)'; x.lineWidth = Math.max(2, w * 0.0038);
      x.strokeRect(ix, iy, iw, ih);
      x.fillStyle = 'rgba(10,12,16,0.86)'; x.fillRect(ix + iw * 0.03, iy + ih * 0.055, iw * 0.235, ih * 0.165);
      x.globalAlpha = (Math.sin(t * 4.2 + seed) > 0) ? 1 : 0.25;
      x.fillStyle = '#e0403a'; x.beginPath(); x.arc(ix + iw * 0.058, iy + ih * 0.137, iw * 0.019, 0, 7); x.fill();
      x.globalAlpha = 1;
      x.fillStyle = 'rgba(238,238,244,0.95)'; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.font = 'bold ' + Math.round(h * 0.032) + 'px Rajdhani, sans-serif';
      x.fillText('LIVE', ix + iw * 0.09, iy + ih * 0.135);
      // location caption on the inset
      x.fillStyle = 'rgba(8,10,14,0.8)'; x.fillRect(ix + iw * 0.03, iy + ih - ih * 0.155, iw * 0.52, ih * 0.13);
      x.fillStyle = 'rgba(220,216,208,0.9)'; x.font = 'bold ' + Math.round(h * 0.028) + 'px Rajdhani, sans-serif';
      x.fillText('DOWNTOWN · 5TH & MAIN', ix + iw * 0.05, iy + ih - ih * 0.09);

      // ---------- presenter (right side of frame; desk is drawn later, over the lower body)
      const cx = w * 0.715, cy = h * 0.335, hr = Math.min(w, h) * 0.115;
      // everything below is anchored to the head so the body always meets the neck
      const sy = cy + hr * 0.90;                 // shoulder line, just under the chin
      const bw = hr * 1.55;                      // half-width of the shoulders
      const deskY = h * 0.615;
      // shoulders in a suit
      x.fillStyle = '#242a36';
      x.beginPath();
      x.moveTo(cx - bw, deskY);
      x.quadraticCurveTo(cx - bw * 0.92, sy + hr * 0.10, cx - hr * 0.42, sy);
      x.lineTo(cx + hr * 0.42, sy);
      x.quadraticCurveTo(cx + bw * 0.92, sy + hr * 0.10, cx + bw, deskY);
      x.closePath(); x.fill();
      // shirt V
      x.fillStyle = '#d8dce2';
      x.beginPath();
      x.moveTo(cx - hr * 0.40, sy + hr * 0.02); x.lineTo(cx + hr * 0.40, sy + hr * 0.02);
      x.lineTo(cx + hr * 0.22, sy + hr * 0.75); x.lineTo(cx - hr * 0.22, sy + hr * 0.75);
      x.closePath(); x.fill();
      // tie
      x.fillStyle = '#8e2f2c';
      x.beginPath();
      x.moveTo(cx - hr * 0.10, sy + hr * 0.08); x.lineTo(cx + hr * 0.10, sy + hr * 0.08);
      x.lineTo(cx + hr * 0.15, sy + hr * 0.78); x.lineTo(cx - hr * 0.15, sy + hr * 0.78);
      x.closePath(); x.fill();
      // lapels
      x.fillStyle = '#1b202a';
      x.beginPath();
      x.moveTo(cx - hr * 0.42, sy); x.lineTo(cx - hr * 0.12, sy + hr * 0.80); x.lineTo(cx - hr * 0.42, sy + hr * 0.80);
      x.closePath(); x.fill();
      x.beginPath();
      x.moveTo(cx + hr * 0.42, sy); x.lineTo(cx + hr * 0.12, sy + hr * 0.80); x.lineTo(cx + hr * 0.42, sy + hr * 0.80);
      x.closePath(); x.fill();
      // head
      x.fillStyle = '#c8a688'; x.beginPath(); x.arc(cx, cy, hr, 0, 7); x.fill();
      // neck
      x.fillStyle = '#b08f72'; x.fillRect(cx - hr * 0.24, cy + hr * 0.72, hr * 0.48, hr * 0.32);
      // hair
      x.fillStyle = '#2b211a'; x.beginPath();
      x.arc(cx, cy - hr * 0.24, hr * 1.03, Math.PI * 1.06, Math.PI * 1.94); x.fill();
      // eyes (blink)
      const blink = (t * 0.42 % 1) < 0.045;
      x.fillStyle = '#20242c';
      if (blink) { x.fillRect(cx - hr * 0.46, cy - hr * 0.09, hr * 0.22, Math.max(1, hr * 0.045)); x.fillRect(cx + hr * 0.24, cy - hr * 0.09, hr * 0.22, Math.max(1, hr * 0.045)); }
      else { x.beginPath(); x.arc(cx - hr * 0.35, cy - hr * 0.07, hr * 0.095, 0, 7); x.fill(); x.beginPath(); x.arc(cx + hr * 0.35, cy - hr * 0.07, hr * 0.095, 0, 7); x.fill(); }
      // brows
      x.strokeStyle = '#2b211a'; x.lineWidth = Math.max(1, hr * 0.1);
      x.beginPath(); x.moveTo(cx - hr * 0.48, cy - hr * 0.26); x.lineTo(cx - hr * 0.2, cy - hr * 0.29);
      x.moveTo(cx + hr * 0.2, cy - hr * 0.29); x.lineTo(cx + hr * 0.48, cy - hr * 0.26); x.stroke();
      // talking mouth
      const speak = (Math.sin(t * 9.2 + seed) * 0.5 + 0.5) * (Math.sin(t * 2.3) > -0.35 ? 1 : 0);
      const mh = Math.max(hr * 0.045, hr * 0.2 * speak);
      x.fillStyle = '#5a2a2e'; x.beginPath();
      if (x.ellipse) x.ellipse(cx, cy + hr * 0.42, hr * 0.22, mh, 0, 0, 7); else x.arc(cx, cy + hr * 0.42, hr * 0.2, 0, 7);
      x.fill();
      // ---------- desk (drawn over the lower body so the presenter reads as seated behind it)
      const dy = deskY;
      x.fillStyle = '#241d18'; x.fillRect(0, dy, w, h - dy);
      const dt2 = x.createLinearGradient(0, dy, 0, dy + h * 0.06);
      dt2.addColorStop(0, 'rgba(126,104,80,0.55)'); dt2.addColorStop(1, 'rgba(126,104,80,0)');
      x.fillStyle = dt2; x.fillRect(0, dy, w, h * 0.06);
      x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(0, dy, w, Math.max(1, h * 0.004));
      // desk front branding
      x.fillStyle = 'rgba(200,60,48,0.20)'; x.fillRect(w * 0.045, dy + h * 0.075, w * 0.20, h * 0.10);
      x.fillStyle = 'rgba(255,255,255,0.10)'; x.font = 'bold ' + Math.round(h * 0.038) + 'px Rajdhani, sans-serif';
      x.textAlign = 'left'; x.textBaseline = 'middle';
      x.fillText('CH 7', w * 0.062, dy + h * 0.125);
      // presenter's hand resting on the desk, tapping while he talks
      const tapY = Math.abs(Math.sin(t * 3.1 + seed * 0.5)) * h * 0.008;
      x.fillStyle = '#c8a688';
      x.beginPath(); x.ellipse ? x.ellipse(cx + hr * 1.6, dy + h * 0.028 - tapY, hr * 0.30, hr * 0.19, -0.2, 0, 7) : x.arc(cx + hr * 1.6, dy + h * 0.028, hr * 0.24, 0, 7); x.fill();
      // papers on the desk
      x.fillStyle = 'rgba(226,222,212,0.88)';
      x.fillRect(cx + hr * 2.35, dy + h * 0.012, w * 0.075, h * 0.032);
      x.fillStyle = 'rgba(180,176,168,0.75)';
      for (let i = 1; i <= 3; i++) x.fillRect(cx + hr * 2.45, dy + h * 0.012 + i * h * 0.007, w * 0.055, Math.max(1, h * 0.0025));

      // ---------- BREAKING NEWS banner (top)
      const bh = h * 0.098;
      x.fillStyle = '#a51f1a'; x.fillRect(0, 0, w, bh);
      x.fillStyle = '#d0271f'; x.fillRect(w * 0.155, 0, w * 0.845, bh);   // lighter sweep panel
      // shimmer sweep
      const shx = ((t * 0.35) % 1) * (w * 1.4) - w * 0.2;
      const shg = x.createLinearGradient(shx, 0, shx + w * 0.18, 0);
      shg.addColorStop(0, 'rgba(255,255,255,0)'); shg.addColorStop(0.5, 'rgba(255,255,255,0.16)'); shg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = shg; x.fillRect(0, 0, w, bh);
      // LIVE block on the left
      x.fillStyle = '#0b0d11'; x.fillRect(0, 0, w * 0.145, bh);
      x.globalAlpha = (Math.sin(t * 5) > 0) ? 1 : 0.3;
      x.fillStyle = '#e0403a'; x.beginPath(); x.arc(w * 0.035, bh * 0.5, bh * 0.17, 0, 7); x.fill();
      x.globalAlpha = 1;
      x.fillStyle = 'rgba(240,240,246,0.95)'; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.font = 'bold ' + Math.round(bh * 0.42) + 'px Rajdhani, sans-serif';
      x.fillText('LIVE', w * 0.058, bh * 0.52);
      // headline
      x.fillStyle = '#ffffff'; x.font = 'bold ' + Math.round(bh * 0.55) + 'px Rajdhani, sans-serif';
      x.fillText('BREAKING NEWS', w * 0.175, bh * 0.54);
      // pulsing underline
      x.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.1));
      x.fillStyle = '#ffffff'; x.fillRect(w * 0.175, bh * 0.84, w * 0.36, Math.max(1.5, bh * 0.055));
      x.globalAlpha = 1;
      // clock
      const mins = Math.floor((t * 0.6) % 60), hrs = 21 + Math.floor((t * 0.6) / 60) % 6;
      x.fillStyle = 'rgba(255,255,255,0.9)'; x.textAlign = 'right';
      x.font = 'bold ' + Math.round(bh * 0.42) + 'px Rajdhani, sans-serif';
      x.fillText('21:' + String(mins).padStart(2, '0'), w - w * 0.03, bh * 0.54);

      // ---------- animated lower third (slides in from the left, sits above the desk)
      const cyc = (t + seed * 0.31) % 11;
      let lt = 0;
      if (cyc < 0.45) lt = cyc / 0.45; else if (cyc < 8.7) lt = 1; else lt = Math.max(0, 1 - (cyc - 8.7) / 0.55);
      if (lt > 0.01) {
        const ly = h * 0.40, lh = h * 0.10, off = (1 - lt) * w * 0.52;
        x.fillStyle = 'rgba(8,10,14,0.88)'; x.fillRect(w * 0.035 - off, ly, w * 0.38, lh);
        x.fillStyle = '#c8271f'; x.fillRect(w * 0.035 - off, ly, w * 0.007, lh);
        x.fillStyle = 'rgba(255,255,255,0.96)'; x.textAlign = 'left'; x.textBaseline = 'middle';
        x.font = 'bold ' + Math.round(h * 0.045) + 'px Rajdhani, sans-serif';
        x.fillText('NORAK VALE', w * 0.052 - off, ly + lh * 0.34);
        x.fillStyle = 'rgba(192,192,200,0.9)'; x.font = Math.round(h * 0.03) + 'px Rajdhani, sans-serif';
        x.fillText('OUTBREAK DESK', w * 0.052 - off, ly + lh * 0.72);
      }

      // ---------- scrolling ticker along the bottom
      const tk = h * 0.105, ty = h - tk;
      x.fillStyle = 'rgba(6,8,12,0.94)'; x.fillRect(0, ty, w, tk);
      x.fillStyle = '#c8271f'; x.fillRect(0, ty, w * 0.115, tk);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'bold ' + Math.round(tk * 0.46) + 'px Rajdhani, sans-serif';
      x.fillText('NEWS', w * 0.0575, ty + tk * 0.54);
      x.save(); x.beginPath(); x.rect(w * 0.12, ty, w * 0.88, tk); x.clip();
      x.fillStyle = 'rgba(242,234,208,0.94)'; x.textAlign = 'left';
      x.font = 'bold ' + Math.round(tk * 0.5) + 'px Rajdhani, sans-serif';
      const msg = '  BREAKING: VIOLENT INCIDENTS REPORTED DOWNTOWN   \u2022   RESIDENTS TOLD TO STAY INDOORS AND LOCK THEIR DOORS   \u2022   CHECKPOINTS ON ROUTE 9   \u2022   DO NOT APPROACH THE INFECTED   \u2022   ';
      const tw = x.measureText(msg).width;
      const scroll = (t * 62) % (tw + w * 0.88);
      x.fillText(msg, w * 0.12 - scroll, ty + tk * 0.54);
      x.fillText(msg, w * 0.12 - scroll + tw, ty + tk * 0.54);
      x.restore();

      // ---------- CRT treatment
      x.fillStyle = 'rgba(0,0,0,0.20)';
      for (let yy = 0; yy < h; yy += 3) x.fillRect(0, yy, w, 1);
      const vg = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
      x.fillStyle = vg; x.fillRect(0, 0, w, h);
      // faint flicker
      const fl2 = 0.96 + 0.04 * Math.sin(t * 13);
      x.fillStyle = 'rgba(0,0,0,' + ((1 - fl2) * 0.5).toFixed(3) + ')'; x.fillRect(0, 0, w, h);
    } else {
      // compact variant for the tiny in-world screens
      x.fillStyle = '#a51f1a'; x.fillRect(0, 0, w, h * 0.3);
      const cxs = w * 0.32, cys = h * 0.66, hr2 = Math.min(w, h) * 0.22;
      x.fillStyle = '#242a36'; x.fillRect(w * 0.05, h * 0.86, w * 0.5, h * 0.14);
      x.fillStyle = '#c8a688'; x.beginPath(); x.arc(cxs, cys, hr2, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,150,50,0.5)'; x.fillRect(w * 0.68, h * 0.4, w * 0.26, h * 0.4);
      x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(0, h * 0.86, w, h * 0.14);
    }
    x.restore();
  }

  // Channel 3: dead air. No picture, no signal at all - just a dark screen and the set's own
  // faint glow, so it reads as "this channel is empty".
  function tvChannel3(x, w, h, t, seed) {
    x.fillStyle = '#05070a'; x.fillRect(0, 0, w, h);
    const small = h < 60;
    // very faint horizontal interference, no image content
    x.globalAlpha = small ? 0.05 : 0.09;
    x.fillStyle = '#9fb4c8';
    for (let i = 0; i < 5; i++) { const yy = ((t * (12 + i * 3) + i * 37 + seed) % (h + 20)) - 10; x.fillRect(0, yy, w, 1); }
    x.globalAlpha = 1;
    if (!small) {
      x.fillStyle = 'rgba(150,158,168,0.35)'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'bold ' + Math.round(h * 0.06) + 'px Rajdhani, sans-serif';
      x.fillText('NO SIGNAL', w / 2, h / 2);
    }
    // vignette so the dark screen still looks like glass
    const vg = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.85)'); x.fillStyle = vg; x.fillRect(0, 0, w, h);
  }

  // Channel 4: a captured computer terminal - green phosphor text on black, a live "intrusion"
  // scrolling past, and the attacker's handle burned into the foreground. Retro monospace, with
  // a blinking block cursor, scanlines and a slight phosphor burn. Purely visual.
  const TV4_HANDLE = 'PAJTI';
  function tvChannel4(x, w, h, t, seed) {
    const small = h < 60;
    const MONO = 'bold {S}px "Courier New", Consolas, monospace';
    const fs = (s) => MONO.replace('{S}', Math.round(s));
    // black glass with a faint green cast
    x.save();
    x.fillStyle = '#020604'; x.fillRect(0, 0, w, h);

    if (!small) {
      const lh = h * 0.045;                       // line height
      const fsz = h * 0.036;                      // font size
      const pad = w * 0.045;
      x.font = fs(fsz); x.textAlign = 'left'; x.textBaseline = 'middle';

      // A scripted intrusion transcript, revealed line by line on a loop.
      const lines = [
        ['> CONNECTING TO NODE 07 ......', '#2f8f4a'],
        ['> HANDSHAKE OK', '#2f8f4a'],
        ['> BYPASSING FIREWALL [########] 100%', '#43d06a'],
        ['!! INTRUSION DETECTED ON SUBNET 10.0.7', '#e0d24a'],
        ['> ESCALATING PRIVILEGES', '#43d06a'],
        ['> DUMPING PATIENT RECORDS  4,182 FILES', '#43d06a'],
        ['> OVERWRITING BACKUPS ...', '#e0d24a'],
        ['!! ALL NODES COMPROMISED', '#e05a4a'],
        ['> LEAVING SIGNATURE', '#2f8f4a'],
        ['> CONNECTION CLOSED', '#2f8f4a']
      ];
      const CYCLE = 15;                            // seconds per full transcript
      const local = (t + seed * 0.37) % CYCLE;
      const perLine = CYCLE / (lines.length + 3);
      const shown = Math.min(lines.length, Math.floor(local / perLine) + 1);
      const top = h * 0.165;
      for (let i = 0; i < shown; i++) {
        const y = top + i * lh;
        if (y > h * 0.555) break;
        const txt = lines[i][0], col = lines[i][1];
        // newest line types itself in, older lines are complete
        const isLast = i === shown - 1;
        const n = isLast ? Math.max(1, Math.floor(txt.length * Math.min(1, (local % perLine) / (perLine * 0.65)))) : txt.length;
        x.globalAlpha = 1 - i * 0.045;
        x.fillStyle = col;
        x.fillText(txt.slice(0, n), pad, y);
        x.globalAlpha = 1;
      }
      // blinking block cursor after the last line (only inside the log area)
      const cy = top + (shown - 1) * lh;
      const lastTxt = lines[Math.min(shown - 1, lines.length - 1)][0];
      const cw = x.measureText(lastTxt).width;
      if (cy < h * 0.555 && Math.sin(t * 6) > -0.2) {
        x.fillStyle = '#43d06a';
        x.fillRect(pad + cw + fsz * 0.2, cy - fsz * 0.42, fsz * 0.5, fsz * 0.84);
      }

      // header line
      x.fillStyle = 'rgba(47,143,74,0.75)'; x.font = fs(fsz * 0.8);
      x.fillText('TERM-07 / ROOT SHELL            ' + (Math.sin(t * 0.7) > -0.6 ? 'REC *' : '      '), pad, h * 0.085);
      x.fillRect(pad, h * 0.115, w - pad * 2, Math.max(1, h * 0.004));

      // ---- the signature: PAJTI..., huge, on a dark band so the log above stays readable
      const bandTop = h * 0.585, bandBot = h * 0.845;
      x.fillStyle = 'rgba(1,6,3,0.92)'; x.fillRect(0, bandTop, w, bandBot - bandTop);
      x.fillStyle = 'rgba(67,208,106,0.38)';
      x.fillRect(0, bandTop, w, Math.max(1, h * 0.0032));
      x.fillRect(0, bandBot - Math.max(1, h * 0.0032), w, Math.max(1, h * 0.0032));
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 1.6 + seed * 0.2));
      const BIG_TEXT = TV4_HANDLE + '...';
      // auto-fit: pick the largest size that still leaves margins on both sides
      let big = Math.round(h * 0.30);
      x.font = fs(big);
      const maxW = w * 0.88;
      const tw0 = x.measureText(BIG_TEXT).width;
      if (tw0 > maxW) { big = Math.floor(big * maxW / tw0); x.font = fs(big); }
      const bigY = bandTop + (bandBot - bandTop) * 0.46;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      // phosphor glow layers
      x.fillStyle = 'rgba(40,190,90,' + (0.10 * pulse).toFixed(3) + ')';
      x.fillText(BIG_TEXT, w / 2, bigY);
      x.fillStyle = 'rgba(60,230,110,' + (0.20 * pulse).toFixed(3) + ')';
      x.fillText(BIG_TEXT, w / 2, bigY);
      // core glyphs, glitching horizontally in short bursts
      const glitch = (Math.sin(t * 9.1) > 0.93) ? (Math.random() - 0.5) * w * 0.02 : 0;
      x.fillStyle = '#7dff9e';
      x.fillText(BIG_TEXT, w / 2 + glitch, bigY);
      // RGB split on the glitch frames
      if (glitch !== 0) {
        x.globalAlpha = 0.5; x.fillStyle = '#ff4a6a';
        x.fillText(BIG_TEXT, w / 2 + glitch - w * 0.004, bigY);
        x.fillStyle = '#4ad8ff';
        x.fillText(BIG_TEXT, w / 2 + glitch + w * 0.004, bigY);
        x.globalAlpha = 1;
      }
      // caption under the handle
      x.textAlign = 'center';
      x.font = fs(h * 0.033); x.fillStyle = 'rgba(120,230,150,0.62)';
      x.fillText('WE ARE BACK', w / 2, bandBot - h * 0.045);

      // scanlines + phosphor vignette + flicker
      x.fillStyle = 'rgba(0,0,0,0.34)';
      for (let yy = 0; yy < h; yy += 3) x.fillRect(0, yy, w, 1);
      const vg = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.26, w / 2, h / 2, Math.max(w, h) * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.78)');
      x.fillStyle = vg; x.fillRect(0, 0, w, h);
      const fl = 0.9 + 0.1 * Math.sin(t * 17);
      x.fillStyle = 'rgba(0,0,0,' + ((1 - fl) * 0.35).toFixed(3) + ')'; x.fillRect(0, 0, w, h);
      // rolling bright bar, like a failing CRT
      const by = ((t * 0.22) % 1) * (h + 30) - 15;
      const bg = x.createLinearGradient(0, by - 10, 0, by + 10);
      bg.addColorStop(0, 'rgba(90,255,140,0)'); bg.addColorStop(0.5, 'rgba(90,255,140,0.08)'); bg.addColorStop(1, 'rgba(90,255,140,0)');
      x.fillStyle = bg; x.fillRect(0, by - 10, w, 20);
    } else {
      // compact variant: green block glyphs only
      x.fillStyle = 'rgba(40,150,70,0.5)'; x.fillRect(0, 0, w, h * 0.18);
      x.fillStyle = '#7dff9e'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'bold ' + Math.max(5, Math.round(h * 0.34)) + 'px monospace';
      x.fillText(TV4_HANDLE, w / 2, h * 0.56);
    }
    x.restore();
  }

  // Public entry point for the enlarged popup: channel 1 keeps the original broadcast art.
  Props.tvDrawChannel = function (x, w, h, t, seed, ch) {
    if (ch === 2) return tvChannel2(x, w, h, t || 0, seed || 0);
    if (ch === 3) return tvChannel3(x, w, h, t || 0, seed || 0);
    if (ch === 4) return tvChannel4(x, w, h, t || 0, seed || 0);
    return Props.tvDraw(x, w, h, t, seed);
  };

  // ------------------------------------------------------------------ computer screen
  // The office computer on the police desk shows a small terminal: a suspect board, a city
  // map built from the real building footprints, and a case note. Drawn entirely on canvas,
  // so it reuses the same popup machinery as the TV and costs no extra DOM.
  Props.PC_TABS = ['SUSPECTS', 'CITY MAP', 'CASE FILE'];

  const PC_SUSPECTS = [
    { name: 'LEON VASQUEZ', status: 'WANTED', col: '#e05a4a', note: 'Armed robbery, assault on an officer. Last seen north of the river.' },
    { name: 'MARA KOVAC', status: 'IN CUSTODY', col: '#4ad07a', note: 'Possession. Picked up at the gas station, talking freely.' },
    { name: 'IVAN HORVAT', status: 'WANTED', col: '#e05a4a', note: 'Homicide. Dropped out of sight the night the roadblock fell.' },
    { name: 'ANA MILIC', status: 'MISSING', col: '#e8b04a', note: 'Reported missing three days ago. Last address on Elm Street.' },
    { name: 'DUSAN PETROVIC', status: 'RELEASED', col: '#7a8a92', note: 'Questioned over the warehouse fire. No charge.' },
    { name: 'SOFIA BRANKOVIC', status: 'WANTED', col: '#e05a4a', note: 'Forgery, fraud. Believed to be travelling with Vasquez.' }
  ];

  let pcMapCache = null;
  function pcBuildMap() {
    if (pcMapCache) return pcMapCache;
    const C = DSZ.C, W = DSZ.World, k = 2;
    const [c, x] = U.canvas2d(C.W * k, C.H * k);
    x.fillStyle = '#0a0f14'; x.fillRect(0, 0, C.W * k, C.H * k);
    // streets first, so buildings sit on top of them
    x.fillStyle = '#19212a';
    for (let y = 0; y < C.H; y++) for (let xx = 0; xx < C.W; xx++)
      if (W.roadMask[y * C.W + xx]) x.fillRect(xx * k, y * k, k, k);
    // building footprints, coloured by what they are
    const K = { police: '#4a7ad0', hospital: '#b8534a', shop: '#3f7350', super: '#3f7350', diner: '#7a6634',
                warehouse: '#525a64', church: '#6f5a80', gasstore: '#7a5430', house: '#33404c' };
    for (const b of W.blds) {
      if (!b) continue;
      x.fillStyle = K[b.kind] || '#33404c';
      x.fillRect(b.x * k, b.y * k, b.w * k, b.h * k);
      x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1;
      x.strokeRect(b.x * k + 0.5, b.y * k + 0.5, b.w * k - 1, b.h * k - 1);
    }
    pcMapCache = { c, k };
    return pcMapCache;
  }

  Props.pcResetMap = function () { pcMapCache = null; };

  Props.pcDraw = function (x, w, h, t, tab) {
    t = t || 0;
    const MONO = '"Courier New", Consolas, monospace';
    const font = (s, b) => (b ? 'bold ' : '') + Math.max(6, Math.round(s)) + 'px ' + MONO;
    const AMBER = '#e8b04a', GREEN = '#4ad07a', DIM = '#6d7d86', RED = '#e05a4a', TEXT = '#c2cdd4';
    const S = DSZ.Game && DSZ.Game.S;
    let clock = '03:00';
    if (S) {
      const hh = Math.floor(S.hour) % 24, mm = Math.floor((S.hour % 1) * 60);
      clock = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    }

    x.save();
    x.fillStyle = '#070b0f'; x.fillRect(0, 0, w, h);
    // faint CRT scanlines over everything
    x.fillStyle = 'rgba(0,0,0,0.20)';
    for (let yy = 0; yy < h; yy += 3) x.fillRect(0, yy, w, 1);

    const headH = Math.round(h * 0.105);
    // ---- header bar
    x.fillStyle = '#0d141a'; x.fillRect(0, 0, w, headH);
    x.fillStyle = 'rgba(74,122,208,0.55)'; x.fillRect(0, headH - 2, w, 2);
    x.textAlign = 'left'; x.textBaseline = 'middle';
    x.font = font(h * 0.030, true); x.fillStyle = '#9ec0e8';
    x.fillText('NORLEY VALE POLICE', Math.round(w * 0.028), headH * 0.5);
    x.font = font(h * 0.022); x.fillStyle = DIM;
    x.fillText('TERMINAL 03', Math.round(w * 0.028) + Math.round(w * 0.235), headH * 0.5);
    x.textAlign = 'right';
    x.font = font(h * 0.026, true); x.fillStyle = AMBER;
    x.fillText(clock, w - Math.round(w * 0.028), headH * 0.5);
    x.textAlign = 'left';

    const top = headH + Math.round(h * 0.045);
    const pad = Math.round(w * 0.035);
    const bodyW = w - pad * 2;

    if (tab === 1) {
      // ---------------- CITY MAP
      x.font = font(h * 0.026, true); x.fillStyle = TEXT;
      x.fillText('CITY OVERVIEW', pad, top);
      // legend on the right of the title row
      const leg = [['POLICE', '#4a7ad0'], ['HOSPITAL', '#b8534a'], ['STORES', '#3f7350'], ['WAREHOUSE', '#525a64']];
      let lx = w - pad;
      x.textAlign = 'right'; x.font = font(h * 0.019);
      for (let i = leg.length - 1; i >= 0; i--) {
        x.fillStyle = leg[i][1]; x.fillRect(lx - 9, top - 4, 7, 7);
        x.fillStyle = DIM; x.fillText(leg[i][0], lx - 13, top);
        lx -= 13 + x.measureText(leg[i][0]).width + 14;
      }
      x.textAlign = 'left';

      const map = pcBuildMap();
      const C = DSZ.C;
      const availW = bodyW, availH = h - top - Math.round(h * 0.10);
      const sc = Math.min(availW / (C.W * map.k), availH / (C.H * map.k));
      const dw = C.W * map.k * sc, dh = C.H * map.k * sc;
      const dx = pad + (availW - dw) / 2, dy = top + Math.round(h * 0.045);
      x.imageSmoothingEnabled = false;
      x.drawImage(map.c, dx, dy, dw, dh);
      x.strokeStyle = 'rgba(74,122,208,0.4)'; x.lineWidth = 1;
      x.strokeRect(dx + 0.5, dy + 0.5, dw - 1, dh - 1);

      // points of interest
      x.font = font(h * 0.017, true); x.textAlign = 'center'; x.textBaseline = 'bottom';
      for (const q of DSZ.Gen.poi || []) {
        const px = dx + q.x * map.k * sc, py = dy + q.y * map.k * sc;
        x.fillStyle = '#dfe8f0';
        x.fillText(q.name.toUpperCase(), px, py - 2);
      }
      // player position
      if (S && S.player) {
        const px = dx + S.player.x * map.k * sc, py = dy + S.player.y * map.k * sc;
        const bl = (Math.sin(t * 4) * 0.5 + 0.5);
        x.strokeStyle = 'rgba(255,221,85,' + (0.4 + bl * 0.6).toFixed(2) + ')';
        x.lineWidth = 2; x.beginPath(); x.arc(px, py, 5 + bl * 3, 0, 7); x.stroke();
        x.fillStyle = '#ffdd55'; x.beginPath(); x.arc(px, py, 2.6, 0, 7); x.fill();
      }
      x.textAlign = 'left'; x.textBaseline = 'middle';
    } else if (tab === 2) {
      // ---------------- CASE FILE
      x.font = font(h * 0.026, true); x.fillStyle = TEXT;
      x.fillText('CASE 14-087  ·  THE NORLEY VALE INCIDENT', pad, top);
      const lines = [
        ['OPENED', '21:40, the night the roadblock fell.', DIM],
        ['LEAD', 'Leon Vasquez. Prints on the warehouse door, and a witness', TEXT],
        ['', 'puts him north of the river two nights later.', TEXT],
        ['STATUS', 'At large. Considered armed.', RED],
        ['', '', TEXT],
        ['NOTE', 'The town was cut off before we could call anything in.', DIM],
        ['', 'Everything in this file is now the only record that exists.', DIM],
        ['', '', TEXT],
        ['EVIDENCE', '12 boxes, sealed. Untouched since the evacuation.', TEXT],
        ['', 'This terminal still has power. The phone does not.', DIM]
      ];
      let y = top + Math.round(h * 0.075);
      const lh = Math.round(h * 0.052);
      for (const [k, v, col] of lines) {
        if (k) { x.font = font(h * 0.022, true); x.fillStyle = AMBER; x.fillText(k, pad, y); }
        x.font = font(h * 0.022); x.fillStyle = col;
        x.fillText(v, pad + Math.round(w * 0.105), y);
        y += lh;
      }
      // blinking cursor, because the machine is still waiting
      if (Math.sin(t * 3) > 0) {
        x.fillStyle = GREEN;
        const cw = Math.round(w * 0.012);
        x.fillRect(pad, y - Math.round(h * 0.018), cw, Math.round(h * 0.026));
      }
    } else {
      // ---------------- SUSPECTS
      x.font = font(h * 0.026, true); x.fillStyle = TEXT;
      x.fillText('SUSPECT DATABASE', pad, top);
      x.font = font(h * 0.019); x.fillStyle = DIM;
      x.textAlign = 'right';
      x.fillText(PC_SUSPECTS.length + ' RECORDS', w - pad, top);
      x.textAlign = 'left';

      const hdrY = top + Math.round(h * 0.055);
      x.font = font(h * 0.018, true); x.fillStyle = '#54646e';
      x.fillText('NAME', pad, hdrY);
      x.fillText('STATUS', pad + Math.round(w * 0.26), hdrY);
      x.fillText('NOTES', pad + Math.round(w * 0.42), hdrY);
      x.fillStyle = 'rgba(84,100,110,0.4)';
      x.fillRect(pad, hdrY + Math.round(h * 0.020), bodyW, 1);

      const rowH = Math.round(h * 0.083);
      let ry = hdrY + Math.round(h * 0.045);
      for (let i = 0; i < PC_SUSPECTS.length; i++) {
        const s = PC_SUSPECTS[i];
        // Leon is the live lead: give him a band so the eye lands on him
        if (s.name.indexOf('LEON') === 0) {
          const pulse = 0.10 + 0.06 * (Math.sin(t * 2.2) * 0.5 + 0.5);
          x.fillStyle = 'rgba(224,90,74,' + pulse.toFixed(3) + ')';
          x.fillRect(pad - 6, ry - rowH * 0.44, bodyW + 12, rowH * 0.88);
          x.fillStyle = RED; x.fillRect(pad - 6, ry - rowH * 0.44, 2, rowH * 0.88);
        }
        x.font = font(h * 0.021, true); x.fillStyle = s.name.indexOf('LEON') === 0 ? '#ffffff' : TEXT;
        x.fillText(s.name, pad, ry);
        x.font = font(h * 0.018, true); x.fillStyle = s.col;
        x.fillText(s.status, pad + Math.round(w * 0.26), ry);
        x.font = font(h * 0.016); x.fillStyle = DIM;
        // wrap the note to the remaining width
        const maxW = bodyW - Math.round(w * 0.42);
        const words = s.note.split(' ');
        let line = '', ly = ry - Math.round(h * 0.010);
        for (const wd of words) {
          const test = line ? line + ' ' + wd : wd;
          if (x.measureText(test).width > maxW && line) { x.fillText(line, pad + Math.round(w * 0.42), ly); line = wd; ly += Math.round(h * 0.021); }
          else line = test;
        }
        if (line) x.fillText(line, pad + Math.round(w * 0.42), ly);
        ry += rowH;
      }
    }

    // ---- footer status bar
    const fy = h - Math.round(h * 0.055);
    x.fillStyle = '#0d141a'; x.fillRect(0, fy, w, h - fy);
    x.fillStyle = 'rgba(74,122,208,0.35)'; x.fillRect(0, fy, w, 1);
    x.textBaseline = 'middle';
    x.font = font(h * 0.018);
    x.fillStyle = GREEN; x.fillText('● ONLINE', pad, fy + (h - fy) * 0.5);
    x.fillStyle = DIM;
    x.fillText('NVPB INTERNAL — AUTHORISED PERSONNEL ONLY', pad + Math.round(w * 0.11), fy + (h - fy) * 0.5);
    x.textAlign = 'right';
    x.fillText('SECTOR Z', w - pad, fy + (h - fy) * 0.5);
    x.textAlign = 'left';

    x.restore();
  };

  Props.tvDraw = function (x, w, h, t, seed) {
    t = t || 0; seed = seed || 0;
    const small = h < 60, nz = tvNoiseTile();
    x.save();
    x.fillStyle = '#0a1018'; x.fillRect(0, 0, w, h);            // dark blue-grey screen base
    // test-pattern bars, bled out but visible
    const bars = ['#8a3030', '#8a7a2c', '#2c8a3c', '#2c7a8a', '#463490', '#8a3468', '#6a6a6a', '#2a2a32'], bw = w / bars.length;
    x.globalAlpha = small ? 0.16 : 0.28; for (let i = 0; i < bars.length; i++) { x.fillStyle = bars[i]; x.fillRect(i * bw, 0, Math.ceil(bw), h); } x.globalAlpha = 1;
    // animated static
    x.globalAlpha = small ? 0.2 : 0.4; const ox = (t * 120 + seed * 7) % 64, oy = (t * 180) % 64;
    for (let yy = -64; yy < h; yy += 64) for (let xx = -64; xx < w; xx += 64) x.drawImage(nz, xx - ox, yy - oy); x.globalAlpha = 1;
    // occasional glitch tear
    if (((t * 6 + seed) | 0) % 5 === 0) { const ty = (Math.sin(t * 1.7 + seed) * 0.5 + 0.5) * h, th = Math.max(2, (h * 0.03) | 0); x.globalAlpha = small ? 0.3 : 0.55; x.drawImage(nz, 0, 0, 64, 64, (Math.sin(t * 3 + seed) * 0.5) * w * 0.08, ty, w, th); x.globalAlpha = 1; }
    // scanlines
    x.fillStyle = 'rgba(0,0,0,0.32)'; for (let yy = 0; yy < h; yy += 3) x.fillRect(0, yy, w, 1);
    // rolling bright band
    const bandY = ((t * 0.32 + seed * 0.13) % 1) * (h + 40) - 20, bg = x.createLinearGradient(0, bandY - 14, 0, bandY + 14);
    bg.addColorStop(0, 'rgba(255,255,255,0)'); bg.addColorStop(0.5, 'rgba(180,215,255,0.14)'); bg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = bg; x.fillRect(0, bandY - 14, w, 28);
    // flicker + vignette
    const fl = 0.9 + 0.1 * Math.sin(t * 11 + seed) * Math.sin(t * 3.3); x.fillStyle = 'rgba(0,0,0,' + ((1 - fl) * (small ? 1 : 0.6)).toFixed(3) + ')'; x.fillRect(0, 0, w, h);
    const vg = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.24, w / 2, h / 2, Math.max(w, h) * 0.66);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + (small ? 0.8 : 0.62) + ')'); x.fillStyle = vg; x.fillRect(0, 0, w, h);
    if (!small) {
      // LIVE indicator
      x.globalAlpha = (Math.sin(t * 4 + seed) > 0) ? 1 : 0.2; x.fillStyle = '#e0403a'; x.beginPath(); x.arc(w - 18, 20, 5.5, 0, 7); x.fill(); x.globalAlpha = 1;
      x.fillStyle = 'rgba(235,235,240,0.9)'; x.font = 'bold ' + Math.round(h * 0.05) + 'px Rajdhani, sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle'; x.fillText('LIVE', w - 30, 21);
      // scrolling news crawl along the bottom
      const bandH = Math.max(20, h * 0.11); x.fillStyle = 'rgba(6,8,12,0.72)'; x.fillRect(0, h - bandH, w, bandH);
      x.fillStyle = 'rgba(240,232,205,0.92)'; x.font = 'bold ' + Math.round(h * 0.058) + 'px Rajdhani, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
      const msg = '  EMERGENCY BROADCAST SYSTEM   ·   QUARANTINE IN EFFECT   ·   DO NOT APPROACH THE INFECTED   ·   STAY INDOORS   ·   ';
      const tw = x.measureText(msg).width, sx = w - ((t * 46) % (tw + w)); x.fillText(msg, sx, h - bandH * 0.42);
    }
    x.restore();
  };

  const B3 = {};
  B3[O.CRATE] = (o) => { const c = PALETTE[o.v & 3]; const f = B(-0.4, -0.4, 0, 0.4, 0.4, 0.62, c); for (const s of f) { if (s.role !== 'top') s.d = (x, w, h) => { planks(x, w, h, 4, false); x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.moveTo(w, 0); x.lineTo(0, h); x.stroke(); grime(x, w, h, 0.3); }; else s.d = (x, w, h) => planks(x, w, h, 5, true); } return f; };
  B3[O.SHELF] = (o) => { const f = B(-0.18, -0.47, 0, 0.18, 0.47, 1.45, [96, 98, 104]); for (const s of f) { if (s.role === 'px' || s.role === 'nx') s.d = goods(o.v * 13 + (s.role === 'px' ? 1 : 2) + (o.x | 0) * 7 + (o.y | 0) * 3, 4); else if (s.role === 'top') s.d = (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, w, h); }; } return f; };
  B3[O.FRIDGE] = () => { const f = B(-0.3, -0.3, 0, 0.3, 0.3, 1.45, [206, 208, 206]); for (const s of f) if (s.role === 'px') s.d = (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(0, h * 0.34, w, 1.6); x.fillStyle = 'rgba(80,80,86,0.9)'; x.fillRect(w * 0.1, h * 0.12, 2.5, h * 0.18); x.fillRect(w * 0.1, h * 0.42, 2.5, h * 0.3); grime(x, w, h, 0.4); }; return f; };
  B3[O.KCAB] = () => { const f = B(-0.3, -0.47, 0, 0.3, 0.47, 0.88, [140, 112, 80], { top: [170, 164, 150] }); for (const s of f) if (s.role === 'px') s.d = doors2; return f; };
  B3[O.COUNTER] = () => { const f = B(-0.32, -0.47, 0, 0.32, 0.47, 0.92, [120, 96, 70], { top: [188, 182, 170] }); for (const s of f) if (s.role === 'px') s.d = doors2; return f; };
  B3[O.SINK] = () => { const f = B(-0.3, -0.45, 0, 0.3, 0.45, 0.9, [180, 182, 184], { top: [200, 204, 206] }); f.push(...B(0.0, -0.18, 0.9, 0.22, 0.18, 0.96, [120, 126, 132])); for (const s of f) if (s.role === 'px') s.d = doors2; return f; };
  // A prison cot for holding cells: bare steel frame, thin grey mattress, no colourful
  // bedding. Selected with o.prison on a normal O.BED tile, so the cell still behaves exactly
  // like a bed (it is still solid and still hides cell loot underneath) and no new object id
  // has to be spent on a second bed type.
  const prisonCot = () => {
    const f = [];
    f.push(...B(-0.48, -0.33, 0.32, 0.48, 0.33, 0.38, [96, 100, 104], { top: [116, 120, 124] }));
    for (const sx of [-1, 1]) for (const sy of [-1, 1])
      f.push(...B(sx * 0.44 - 0.022, sy * 0.29 - 0.022, 0, sx * 0.44 + 0.022, sy * 0.29 + 0.022, 0.32, [86, 90, 94]));
    f.push(...B(-0.46, -0.31, 0.38, 0.46, 0.31, 0.44, [138, 140, 138]));      // thin mattress
    f.push(...B(-0.44, -0.29, 0.44, -0.30, 0.29, 0.50, [156, 152, 144]));     // pillow
    f.push(...B(-0.52, -0.33, 0.38, -0.47, 0.33, 0.72, [92, 96, 100], { top: [112, 116, 120] })); // headboard
    return f;
  };
  B3[O.BED] = (o) => { if (o.prison) return prisonCot(); const m = FAB[o.v % FAB.length]; const f = B(-0.5, -0.46, 0, 0.5, 0.46, 0.22, [98, 72, 48]); f.push(...B(-0.47, -0.43, 0.22, 0.47, 0.43, 0.38, m), ...B(-0.46, -0.3, 0.38, -0.22, 0.3, 0.46, [226, 224, 216]), ...B(-0.52, -0.46, 0, -0.45, 0.46, 0.72, [86, 62, 40])); f.push(...B(-0.0, -0.43, 0.38, 0.47, 0.43, 0.42, mul(m, 0.85))); return f; };
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
  // Screen of the office computer: dark glass with a green phosphor cast and a few lines of
  // text, baked into the sprite. It is furniture, so it never animates - the TV is the only
  // prop that gets a live screen.
  const screenPx = (x, w, h) => {
    x.fillStyle = '#050a06'; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(80,200,120,0.22)'); g.addColorStop(1, 'rgba(20,80,46,0.10)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(130,230,160,0.85)';
    for (let i = 0; i < 5; i++) x.fillRect(w * 0.12, h * (0.22 + i * 0.13), w * (0.34 + ((i * 37) % 30) / 100), Math.max(1, h * 0.05));
    x.strokeStyle = 'rgba(0,0,0,0.7)'; x.lineWidth = 1.5; x.strokeRect(0.75, 0.75, w - 1.5, h - 1.5);
  };
  // A proper office desk: a thin laminate top on a steel frame, open underneath, with a
  // drawer pedestal under one end only. The first attempt reused the wooden drawer-chest
  // carcass from O.DESK, which read as a filing cabinet rather than a desk to sit at.
  B3[O.COMPUTERDESK] = () => {
    const f = [];
    // thin top with a slight overhang past the frame
    f.push(...B(-0.43, -0.46, 0.70, 0.43, 0.46, 0.765, [158, 154, 142], { top: [184, 180, 166] }));
    // steel frame: four square-section legs, leaving the knee space open
    for (const sx of [-1, 1]) for (const sy of [-1, 1])
      f.push(...B(sx * 0.37 - 0.024, sy * 0.41 - 0.024, 0, sx * 0.37 + 0.024, sy * 0.41 + 0.024, 0.70, [100, 104, 108]));
    // drawer pedestal under the right end, flush with the top
    const ped = B(0.16, -0.37, 0.05, 0.40, 0.37, 0.70, [140, 136, 124], { top: [158, 154, 142] });
    for (const s of ped) if (s.role === 'px') s.d = drawers(3);
    f.push(...ped);
    // monitor, set back from the user side, on a short neck so it does not float
    f.push(...B(-0.06, -0.22, 0.765, 0.10, -0.06, 0.82, [120, 122, 118]));
    const mon = B(-0.10, -0.28, 0.82, 0.14, 0.06, 1.20, [128, 128, 122], { top: [148, 148, 140] });
    for (const s of mon) if (s.role === 'px') s.d = screenPx;
    f.push(...mon);
    // keyboard, sitting proud of the desktop so its top face is visible from above
    f.push(...B(0.13, -0.22, 0.765, 0.29, 0.04, 0.815, [126, 124, 116], { top: [148, 146, 138] }));
    return f;
  };
  B3[O.MEDCAB] = () => { const f = B(-0.14, -0.3, 0.9, 0.14, 0.3, 1.6, [226, 228, 228]); for (const s of f) if (s.role === 'px') s.d = (x, w, h) => { x.fillStyle = '#c03030'; x.fillRect(w / 2 - 1.5, h * 0.3, 3, h * 0.4); x.fillRect(w / 2 - 5, h * 0.45, 10, 3); grime(x, w, h, 0.3); }; return f; };
  B3[O.BENCH] = () => { const f = []; for (const sy of [-1, 1]) f.push(...B(-0.14, sy * 0.4 - 0.03, 0, 0.14, sy * 0.4 + 0.03, 0.4, [50, 50, 54])); f.push(...B(-0.17, -0.47, 0.4, 0.17, 0.47, 0.46, [120, 84, 50]), ...B(-0.2, -0.47, 0.46, -0.16, 0.47, 0.82, [120, 84, 50])); return f; };
  B3[O.GENERATOR] = (o) => o.pump ? (() => { const f = B(-0.18, -0.18, 0, 0.18, 0.18, 1.25, [200, 50, 44]); f.push(...B(-0.22, -0.22, 0, 0.22, 0.22, 0.1, [90, 90, 94]), ...B(-0.2, -0.2, 1.25, 0.2, 0.2, 1.34, [60, 60, 66])); for (const s of f) if (s.role === 'px' || s.role === 'py') s.d = (x, w, h) => { x.fillStyle = '#101810'; x.fillRect(w * 0.2, h * 0.16, w * 0.6, h * 0.16); x.fillStyle = '#3ae050'; x.fillRect(w * 0.26, h * 0.2, w * 0.35, h * 0.08); x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(0, h * 0.5, w, 2); }; return f; })() : (() => { const f = B(-0.35, -0.3, 0, 0.35, 0.3, 0.7, [214, 130, 40]); f.push(...B(-0.3, -0.25, 0.7, 0.3, 0.25, 0.82, [40, 40, 44])); for (const s of f) if (s.role === 'px') s.d = (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 4; i++) x.fillRect(w * 0.1, h * (0.2 + i * 0.16), w * 0.8, 2); grime(x, w, h, 0.4); }; return f; })();
  B3[O.HYDRANT] = () => G3.prism(0, 0, 0, 0.5, 0.12, 8, [190, 40, 36], { top: [210, 60, 50], r1: 0.1 }).concat(G3.prism(0, 0, 0.3, 0.38, 0.17, 8, [180, 38, 34]));
  B3[O.MAILBOX] = () => B(-0.025, -0.025, 0, 0.025, 0.025, 0.8, [70, 70, 74]).concat(B(-0.14, -0.1, 0.8, 0.14, 0.1, 1.0, [60, 82, 140]));
  B3[O.BARRIER] = () => { const f = B(-0.18, -0.5, 0, 0.18, 0.5, 0.7, [176, 174, 168]); for (const s of f) if (s.role === 'px' || s.role === 'nx') s.d = (x, w, h) => { x.fillStyle = '#d84a28'; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * w / 4, h * 0.3); x.lineTo(i * w / 4 + w / 8, h * 0.3); x.lineTo(i * w / 4 + w / 8 - 4, h * 0.6); x.lineTo(i * w / 4 - 4, h * 0.6); x.fill(); } grime(x, w, h, 0.4); }; return f; };
  B3[O.TV] = () => {
    const cab = B(-0.2, -0.3, 0, 0.2, 0.3, 0.45, [90, 66, 46]);
    const body = B(-0.08, -0.32, 0.45, 0.1, 0.32, 0.88, [18, 18, 20]);
    // the +x face of the set is the screen: give it the shared broadcast content
    for (const f of body) if (f.role === 'px') f.d = (x, w, h) => Props.tvDraw(x, w, h, 0, 0);
    return cab.concat(body);
  };
  // ---- Screen of the world TV set, as a screen-space quad.
  // The set's picture is the +x face of its body box B(-0.08, -0.32, 0.45, 0.1, 0.32, 0.88), and the
  // whole sprite is baked once with a frozen timestamp, so the screen in the world can never animate
  // on its own. This projects that face with the exact transform G3.render used to bake the sprite.
  // drawObj places the sprite at ((tx-ty)*32, (tx+ty+1)*16), which is also the origin the projection
  // is relative to, so the quad needs no knowledge of the sprite's own offset and lands pixel-exact.
  // Returns null when the face points away from the camera, because then the baked art does not
  // show it either.
  const TV_SCREEN = { x: 0.1, y0: -0.32, y1: 0.32, z0: 0.45 * PROP_Z, z1: 0.88 * PROP_Z };
  const VX = 0.612, VY = 0.612, VZ = 0.5;
  const tvQuad = [[0, 0], [0, 0], [0, 0], [0, 0]];
  Props.tvScreenQuad = function (o, tx, ty) {
    const ang = (o.f | 0) & 3, ca = Math.cos(ang * Math.PI / 2), sa = Math.sin(ang * Math.PI / 2);
    if (ca * VX + sa * VY <= 0.001) return null;              // screen faces away from the viewer
    const ZU = G3.ZU, ax = (tx - ty) * 32, ay = (tx + ty + 1) * 16;
    const P = tvQuad, S = TV_SCREEN;
    P[0][0] = S.x; P[0][1] = S.y1; P[0][2] = S.z1;
    P[1][0] = S.x; P[1][1] = S.y0; P[1][2] = S.z1;
    P[2][0] = S.x; P[2][1] = S.y0; P[2][2] = S.z0;
    P[3][0] = S.x; P[3][1] = S.y1; P[3][2] = S.z0;
    for (let i = 0; i < 4; i++) {
      const p = P[i], wx = p[0] * ca - p[1] * sa, wy = p[0] * sa + p[1] * ca;
      p[0] = ax + (wx - wy) * 32;
      p[1] = ay + (wx + wy) * 16 - p[2] * ZU;
    }
    return P;
  };
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

  const lastProps = new WeakMap();
  Props.get = function (o) {
    const t = o.t, d = DSZ.OBJDEF[t];
    const f = (d.fence || t === O.BARRIER || t === O.CONTAINER) ? (o.f & 1) : (o.f & 3), v = o.v & 3;
    const flags = (o.dead ? 1 : 0) | (o.pump ? 2 : 0) | (t === O.BGATE && o.open ? 4 : 0);
    let last = lastProps.get(o);
    if (last && last.t === t && last.f === f && last.v === v && last.flags === flags) return last.sprite;
    const key = t + '|' + f + '|' + v + (o.dead ? 'd' : '') + (o.pump ? 'p' : '') + (o.prison ? 'j' : '') + (t === O.BGATE && o.open ? 'o' : '');
    let s = cache.get(key);
    if (!s) {
      if (d.tree) s = tree(o);
      else if (t === O.BUSH) s = bush(o);
      else if (t === O.ROCK) s = rock(o);
      else {
        let faces;
        if (d.fence) faces = fenceFaces(o);
        else if (B3[t]) faces = B3[t](o);
        else faces = B(-0.4, -0.4, 0, 0.4, 0.4, 0.8, [160, 80, 160]);
        const ang = ((o.f | 0) & 3) * Math.PI / 2;
        const a = (t === O.BARRIER || t === O.CONTAINER) ? ((o.f & 1) ? Math.PI / 2 : 0) : (d.fence ? 0 : ang);
        s = G3.render(faces, a);
      }
      cache.set(key, s);
    }
    if (!last) { last = {}; lastProps.set(o, last); }
    last.t = t; last.f = f; last.v = v; last.flags = flags; last.sprite = s;
    return s;
  };
})();
