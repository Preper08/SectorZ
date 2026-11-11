/* Dead SectorZ — procedural item icons (64x64, drawn once and cached) */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U;
  const Icons = DSZ.Icons = {};
  const cache = {};
  const hex = c => c;
  function shade(col, k) { const m = /^#([0-9a-f]{6})$/i.exec(col); if (!m) return col; const n = parseInt(m[1], 16); const r = Math.min(255, (n >> 16 & 255) * k | 0), g = Math.min(255, (n >> 8 & 255) * k | 0), b = Math.min(255, (n & 255) * k | 0); return 'rgb(' + r + ',' + g + ',' + b + ')'; }
  function grad(x, x0, y0, x1, y1, c, a, b) { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, shade(c, a)); g.addColorStop(1, shade(c, b)); return g; }
  function rr(x, px, py, w, h, r, fill, stroke) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); x.fillStyle = fill; x.fill(); x.strokeStyle = stroke || 'rgba(0,0,0,0.55)'; x.lineWidth = 1.5; x.stroke(); }
  function capsule(x, x0, y0, x1, y1, w, col) { x.lineCap = 'round'; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = w + 2.5; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); x.strokeStyle = shade(col, 0.8); x.lineWidth = w; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); x.strokeStyle = shade(col, 1.2); x.lineWidth = w * 0.5; x.beginPath(); x.moveTo(x0 - 0.8, y0 - 0.8); x.lineTo(x1 - 0.8, y1 - 0.8); x.stroke(); }
  function circ(x, cx, cy, r, fill) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = fill; x.fill(); x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 1.5; x.stroke(); }
  function poly(x, pts, fill) { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fillStyle = fill; x.fill(); x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 1.5; x.stroke(); }
  function gloss(x, px, py, w, h) { x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(px, py, w, h); }

  const draw = {
    bat: (x, c) => { x.lineCap = 'round'; capsule(x, 14, 52, 50, 14, 5, c); capsule(x, 36, 28, 52, 12, 9, c); capsule(x, 12, 54, 18, 48, 6, '#222'); },
    crowbar: (x, c) => { capsule(x, 14, 52, 46, 18, 4.5, c); capsule(x, 46, 18, 54, 26, 4.5, c); capsule(x, 14, 52, 11, 55, 6, c); },
    knife: (x, c) => { poly(x, [[28, 40], [50, 12], [53, 15], [36, 46]], grad(x, 28, 40, 53, 15, '#c8ccd0', 1.2, 0.7)); capsule(x, 26, 44, 14, 56, 6, '#3a2a1e'); x.fillStyle = '#888'; x.fillRect(24, 40, 8, 3); },
    machete: (x, c) => { poly(x, [[22, 44], [52, 8], [58, 16], [34, 50]], grad(x, 22, 44, 58, 16, '#b0b6ba', 1.2, 0.65)); capsule(x, 20, 48, 10, 58, 6, '#2a2018'); },
    axe: (x, c) => { capsule(x, 14, 54, 46, 16, 5, '#8a6a40'); poly(x, [[34, 8], [54, 14], [50, 34], [40, 26], [32, 22]], grad(x, 34, 8, 54, 34, '#c84034', 1.1, 0.6)); },
    pipe: (x, c) => { capsule(x, 12, 54, 52, 14, 6.5, '#7c828a'); capsule(x, 10, 56, 14, 52, 8, '#5c626a'); },
    hammer: (x, c) => { capsule(x, 14, 54, 42, 22, 4.5, '#946a3c'); poly(x, [[34, 10], [58, 22], [54, 30], [30, 18]], grad(x, 34, 10, 54, 30, '#8a9096', 1.2, 0.6)); },
    spear: (x, c) => { capsule(x, 10, 56, 48, 14, 3.5, '#a07c48'); poly(x, [[44, 20], [58, 4], [54, 24]], grad(x, 44, 4, 58, 24, '#c0c6ca', 1.2, 0.7)); },
    pistol: (x, c) => { rr(x, 12, 20, 38, 12, 3, grad(x, 0, 20, 0, 32, '#555', 1.3, 0.7)); poly(x, [[20, 30], [34, 30], [30, 52], [20, 52]], grad(x, 20, 30, 34, 52, '#3a3a3e', 1.3, 0.7)); x.fillStyle = '#111'; x.fillRect(48, 23, 6, 5); x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(14, 22, 32, 2); },
    smg: (x, c) => { rr(x, 8, 20, 46, 13, 3, grad(x, 0, 20, 0, 33, '#444', 1.3, 0.7)); poly(x, [[20, 31], [30, 31], [28, 56], [20, 56]], '#2c2c30'); poly(x, [[38, 31], [44, 31], [44, 44], [38, 44]], '#222'); x.fillStyle = '#111'; x.fillRect(52, 24, 8, 4); rr(x, 2, 22, 10, 8, 2, '#333'); },
    shotgun: (x, c) => { capsule(x, 6, 42, 58, 22, 5.5, '#4a4a50'); poly(x, [[2, 38], [24, 36], [28, 46], [4, 54]], grad(x, 2, 38, 28, 54, '#6a4a2a', 1.2, 0.7)); poly(x, [[30, 36], [42, 32], [44, 38], [32, 42]], '#5a3c22'); },
    rifle: (x, c) => { capsule(x, 6, 44, 60, 22, 4.5, '#3a3a40'); poly(x, [[2, 40], [26, 36], [30, 48], [4, 56]], grad(x, 2, 36, 30, 56, '#6a4a2a', 1.2, 0.7)); capsule(x, 26, 30, 44, 24, 5, '#222'); },
    ammo9: (x, c) => { for (let i = 0; i < 4; i++) { const px = 12 + i * 11; rr(x, px, 24, 8, 26, 2, grad(x, px, 0, px + 8, 0, '#d0a840', 1.3, 0.7)); poly(x, [[px, 24], [px + 8, 24], [px + 6, 14], [px + 2, 14]], '#b87c38'); } },
    ammo762: (x, c) => { for (let i = 0; i < 3; i++) { const px = 14 + i * 14; rr(x, px, 22, 9, 32, 2, grad(x, px, 0, px + 9, 0, '#c0983c', 1.3, 0.7)); poly(x, [[px, 22], [px + 9, 22], [px + 6.5, 8], [px + 2.5, 8]], '#9c6c34'); } },
    shell: (x, c) => { for (let i = 0; i < 3; i++) { const px = 12 + i * 14; rr(x, px, 18, 11, 34, 3, grad(x, px, 0, px + 11, 0, '#d03c30', 1.3, 0.6)); rr(x, px, 44, 11, 8, 2, '#c8a040'); } },
    beans: (x, c) => { rr(x, 16, 16, 32, 40, 3, grad(x, 16, 0, 48, 0, '#aab0b8', 1.3, 0.6)); x.fillStyle = '#c8742c'; x.fillRect(16, 26, 32, 20); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(32, 36, 8, 5, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(16, 26, 32, 2); },
    soup: (x, c) => { rr(x, 16, 16, 32, 40, 3, grad(x, 16, 0, 48, 0, '#aab0b8', 1.3, 0.6)); x.fillStyle = '#c43c2c'; x.fillRect(16, 26, 32, 20); x.fillStyle = '#e8e0d0'; x.fillRect(22, 30, 20, 3); x.fillRect(22, 36, 14, 3); },
    bread: (x, c) => { poly(x, [[10, 40], [14, 26], [34, 20], [54, 26], [56, 42], [30, 50]], grad(x, 10, 20, 56, 50, '#d8a868', 1.2, 0.7)); x.strokeStyle = 'rgba(100,60,20,0.6)'; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(20 + i * 11, 26); x.lineTo(24 + i * 11, 36); x.stroke(); } },
    chips: (x, c) => { poly(x, [[14, 14], [50, 14], [54, 54], [10, 54]], grad(x, 14, 14, 54, 54, '#e0c040', 1.2, 0.7)); x.fillStyle = '#c03030'; x.beginPath(); x.ellipse(32, 34, 10, 8, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(14, 14, 36, 4); },
    cereal: (x, c) => { rr(x, 16, 8, 32, 50, 2, grad(x, 16, 0, 48, 0, '#e8a030', 1.2, 0.7)); x.fillStyle = '#2a6ac8'; x.beginPath(); x.arc(32, 28, 9, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillRect(22, 44, 20, 4); },
    candy: (x, c) => { rr(x, 10, 24, 44, 18, 3, '#8a4a2a'); x.fillStyle = '#d83a3a'; x.fillRect(20, 24, 24, 18); x.fillStyle = '#fff'; x.fillRect(24, 30, 16, 4); },
    apple: (x, c) => { circ(x, 32, 36, 16, grad(x, 20, 20, 44, 52, '#c43030', 1.3, 0.6)); capsule(x, 32, 22, 34, 12, 2.2, '#5a3a1a'); poly(x, [[36, 16], [46, 12], [42, 22]], '#4a8a38'); },
    meat: (x, c) => { poly(x, [[10, 34], [18, 18], [42, 14], [56, 30], [48, 50], [22, 52]], grad(x, 10, 14, 56, 52, '#c04a46', 1.2, 0.65)); x.fillStyle = '#e8d8cc'; x.beginPath(); x.ellipse(36, 32, 8, 6, 0.5, 0, 7); x.fill(); },
    cooked: (x, c) => { poly(x, [[10, 34], [18, 18], [42, 14], [56, 30], [48, 50], [22, 52]], grad(x, 10, 14, 56, 52, '#9c5a36', 1.2, 0.55)); x.strokeStyle = 'rgba(40,20,10,0.6)'; x.lineWidth = 2.5; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(20 + i * 10, 22); x.lineTo(28 + i * 10, 44); x.stroke(); } },
    mre: (x, c) => { rr(x, 8, 16, 48, 32, 3, grad(x, 8, 16, 56, 48, '#6a7a46', 1.2, 0.6)); x.fillStyle = '#d8d0a0'; x.fillRect(14, 24, 28, 6); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(14, 34, 20, 3); },
    water: (x, c) => { rr(x, 22, 14, 20, 42, 6, 'rgba(120,190,230,0.75)'); rr(x, 26, 6, 12, 10, 2, '#3a7ab8'); x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(26, 22, 4, 28); x.fillStyle = 'rgba(40,120,190,0.5)'; x.fillRect(23, 30, 18, 24); },
    dirtywater: (x, c) => { rr(x, 22, 14, 20, 42, 6, 'rgba(140,130,70,0.8)'); rr(x, 26, 6, 12, 10, 2, '#6a6a38'); x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(26, 22, 4, 28); },
    bottle: (x, c) => { rr(x, 22, 14, 20, 42, 6, 'rgba(180,210,225,0.45)'); rr(x, 26, 6, 12, 10, 2, 'rgba(150,180,200,0.6)'); x.fillStyle = 'rgba(255,255,255,0.45)'; x.fillRect(26, 22, 4, 28); },
    soda: (x, c) => { rr(x, 20, 12, 24, 44, 4, grad(x, 20, 0, 44, 0, '#d03040', 1.3, 0.6)); x.fillStyle = '#ddd'; x.fillRect(20, 12, 24, 5); x.fillRect(20, 51, 24, 5); x.fillStyle = '#fff'; x.fillRect(24, 28, 16, 6); },
    juice: (x, c) => { rr(x, 18, 14, 28, 40, 3, grad(x, 18, 0, 46, 0, '#e8883c', 1.3, 0.7)); x.fillStyle = '#fff'; x.beginPath(); x.arc(32, 34, 8, 0, 7); x.fill(); capsule(x, 38, 14, 44, 6, 2, '#ddd'); },
    bandage: (x, c) => { circ(x, 32, 34, 16, '#ece8dc'); circ(x, 32, 34, 7, '#6a5a48'); x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(32, 34, 9 + i * 2.5, 0, 7); x.stroke(); } poly(x, [[46, 30], [58, 42], [52, 46], [42, 36]], '#ece8dc'); },
    rags: (x, c) => { for (let i = 0; i < 3; i++) poly(x, [[10 + i * 8, 20 + i * 6], [40 + i * 8, 16 + i * 4], [44 + i * 6, 44 + i * 4], [14 + i * 6, 46 + i * 4]], grad(x, 10, 20, 50, 50, i === 1 ? '#a89478' : '#90805e', 1.2 - i * 0.1, 0.7)); },
    cloth: (x, c) => { poly(x, [[8, 22], [56, 16], [54, 48], [10, 50]], grad(x, 8, 16, 56, 50, '#b0a890', 1.2, 0.7)); x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = 1; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(10 + i * 6, 20); x.lineTo(12 + i * 6, 50); x.stroke(); } },
    painkillers: (x, c) => { rr(x, 20, 18, 24, 38, 4, '#e07c2c'); rr(x, 20, 12, 24, 10, 3, '#f0f0f0'); x.fillStyle = '#fff'; x.fillRect(24, 30, 16, 14); x.fillStyle = '#c03030'; x.fillRect(28, 34, 8, 6); },
    antibiotics: (x, c) => { rr(x, 20, 18, 24, 38, 4, '#3a78c0'); rr(x, 20, 12, 24, 10, 3, '#f0f0f0'); x.fillStyle = '#fff'; x.fillRect(24, 30, 16, 14); x.fillStyle = '#2a58a0'; x.fillRect(28, 34, 8, 6); },
    medkit: (x, c) => { rr(x, 8, 18, 48, 34, 4, grad(x, 8, 18, 56, 52, '#e04040', 1.3, 0.7)); rr(x, 24, 12, 16, 8, 2, '#a02828'); x.fillStyle = '#fff'; x.fillRect(28, 26, 8, 18); x.fillRect(23, 31, 18, 8); },
    splint: (x, c) => { capsule(x, 16, 54, 48, 10, 8, '#b89460'); x.strokeStyle = '#ece8dc'; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(22 + i * 8, 46 - i * 10); x.lineTo(30 + i * 8, 40 - i * 10 + 4); x.stroke(); } },
    wood: (x, c) => { poly(x, [[8, 44], [14, 36], [56, 14], [58, 22], [14, 52]], grad(x, 8, 14, 58, 52, '#b88852', 1.25, 0.65)); x.strokeStyle = 'rgba(60,30,10,0.4)'; x.lineWidth = 1; x.beginPath(); x.moveTo(16, 44); x.lineTo(52, 24); x.stroke(); },
    log: (x, c) => { poly(x, [[10, 40], [42, 14], [56, 24], [24, 52]], grad(x, 10, 14, 56, 52, '#8a5a34', 1.2, 0.6)); circ(x, 50, 20, 9, '#c8a068'); x.strokeStyle = 'rgba(90,50,20,0.6)'; x.lineWidth = 1; x.beginPath(); x.arc(50, 20, 5, 0, 7); x.stroke(); },
    stick: (x, c) => { capsule(x, 12, 54, 52, 12, 3.5, '#8a6a3c'); capsule(x, 32, 34, 44, 40, 2, '#8a6a3c'); },
    nails: (x, c) => { for (let i = 0; i < 7; i++) { const px = 12 + (i % 4) * 11 + (i > 3 ? 5 : 0), py = 16 + (i > 3 ? 20 : 0); capsule(x, px, py + 22, px, py + 2, 1.6, '#9a9a9a'); x.fillStyle = '#aaa'; x.fillRect(px - 3.5, py - 1, 7, 3); } },
    scrap: (x, c) => { poly(x, [[8, 30], [24, 12], [40, 20], [30, 44]], grad(x, 8, 12, 40, 44, '#8a8f96', 1.3, 0.6)); poly(x, [[30, 36], [50, 22], [58, 40], [44, 56], [26, 52]], grad(x, 26, 22, 58, 56, '#6a6f76', 1.3, 0.6)); x.fillStyle = 'rgba(160,80,30,0.4)'; x.fillRect(34, 34, 12, 6); },
    metalplate: (x, c) => { poly(x, [[8, 22], [48, 10], [58, 40], [18, 54]], grad(x, 8, 10, 58, 54, '#8a929c', 1.3, 0.55)); for (const p of [[16, 24], [46, 16], [52, 38], [22, 48]]) circ(x, p[0], p[1], 2, '#ccc'); },
    sheetmetal: (x, c) => { poly(x, [[6, 20], [50, 8], [58, 42], [14, 56]], grad(x, 6, 8, 58, 56, '#7c848e', 1.35, 0.55)); x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(12 + i * 6, 52 - i * 7); x.lineTo(20 + i * 6, 14 + ((i * 3) % 4) - i * 0); x.stroke(); } },
    tape: (x, c) => { circ(x, 32, 34, 18, '#8a8a90'); circ(x, 32, 34, 8, '#2a2a2e'); x.strokeStyle = 'rgba(255,255,255,0.3)'; x.lineWidth = 2; x.beginPath(); x.arc(32, 34, 13, -2.6, -1.2); x.stroke(); },
    wire: (x, c) => { for (let i = 0; i < 4; i++) { x.strokeStyle = i & 1 ? '#c08040' : '#8a5a28'; x.lineWidth = 3; x.beginPath(); x.ellipse(32, 34, 20 - i * 3, 14 - i * 2, 0, 0, 7); x.stroke(); } },
    cement: (x, c) => { rr(x, 8, 18, 48, 36, 5, grad(x, 8, 18, 56, 54, '#a0a09a', 1.3, 0.65)); x.fillStyle = '#d8d0a0'; x.fillRect(16, 28, 32, 14); x.fillStyle = '#444'; x.fillRect(20, 32, 24, 3); },
    battery: (x, c) => { rr(x, 18, 12, 28, 44, 4, grad(x, 18, 0, 46, 0, '#3ca048', 1.2, 0.6)); x.fillStyle = '#d8c040'; x.fillRect(22, 12, 20, 12); x.fillStyle = '#ccc'; x.fillRect(28, 6, 8, 6); x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif'; x.textAlign = 'center'; x.fillText('+', 32, 44); },
    gascan: (x, c) => { rr(x, 12, 18, 40, 40, 4, grad(x, 12, 18, 52, 58, '#d03c30', 1.25, 0.65)); poly(x, [[16, 18], [34, 18], [34, 8], [24, 6], [16, 12]], '#a02a24'); x.fillStyle = '#ddd'; x.fillRect(38, 24, 8, 8); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(20, 32, 24, 3); },
    lighter: (x, c) => { rr(x, 22, 22, 20, 34, 4, grad(x, 22, 22, 42, 56, '#d8a830', 1.3, 0.6)); x.fillStyle = '#aaa'; x.fillRect(22, 14, 20, 10); x.fillStyle = '#ff8a30'; x.beginPath(); x.ellipse(32, 10, 3, 5, 0, 0, 7); x.fill(); },
    matches: (x, c) => { rr(x, 12, 26, 40, 24, 3, '#c04a30'); x.fillStyle = '#ddd'; x.fillRect(14, 30, 36, 8); for (let i = 0; i < 4; i++) { capsule(x, 18 + i * 8, 24, 18 + i * 8, 12, 2, '#d8c8a0'); circ(x, 18 + i * 8, 11, 2.5, '#c03020'); } },
    rope: (x, c) => { for (let i = 0; i < 4; i++) { x.strokeStyle = shade('#b8a070', 1.1 - i * 0.1); x.lineWidth = 5; x.beginPath(); x.ellipse(32, 34, 20 - i * 3.5, 15 - i * 2.8, 0, 0, 7); x.stroke(); } },
    flashlight: (x, c) => { capsule(x, 18, 46, 40, 24, 11, '#3a3a40'); poly(x, [[38, 14], [58, 28], [48, 40], [30, 26]], grad(x, 30, 14, 58, 40, '#d8c040', 1.25, 0.6)); x.fillStyle = 'rgba(255,255,230,0.9)'; x.beginPath(); x.ellipse(50, 29, 4, 7, 0.9, 0, 7); x.fill(); },
    torch: (x, c) => { capsule(x, 14, 56, 42, 22, 5, '#8a6a3c'); poly(x, [[34, 24], [46, 12], [52, 26], [42, 34]], '#4a3a2a'); x.fillStyle = '#ff9a30'; x.beginPath(); x.ellipse(46, 12, 6, 10, 0.4, 0, 7); x.fill(); x.fillStyle = '#ffe080'; x.beginPath(); x.ellipse(46, 14, 3, 5, 0.4, 0, 7); x.fill(); },
    lantern: (x, c) => { rr(x, 18, 18, 28, 34, 4, 'rgba(255,190,90,0.6)'); x.fillStyle = '#3a3a3e'; x.fillRect(16, 14, 32, 6); x.fillRect(16, 50, 32, 6); capsule(x, 20, 14, 32, 4, 2, '#333'); capsule(x, 44, 14, 32, 4, 2, '#333'); x.fillStyle = '#ffc060'; x.beginPath(); x.ellipse(32, 34, 6, 10, 0, 0, 7); x.fill(); },
    map: (x, c) => { poly(x, [[8, 18], [24, 14], [40, 18], [56, 14], [56, 48], [40, 52], [24, 48], [8, 52]], grad(x, 8, 14, 56, 52, '#d4c49a', 1.15, 0.75)); x.strokeStyle = '#6a8a50'; x.lineWidth = 2; x.beginPath(); x.moveTo(14, 38); x.quadraticCurveTo(28, 20, 40, 34); x.quadraticCurveTo(46, 40, 52, 26); x.stroke(); x.fillStyle = '#c03030'; x.beginPath(); x.arc(40, 34, 2.5, 0, 7); x.fill(); },
    radio: (x, c) => { rr(x, 6, 18, 52, 32, 4, grad(x, 6, 18, 58, 50, '#5a5a60', 1.3, 0.6)); circ(x, 22, 34, 9, '#222'); x.fillStyle = '#222'; x.fillRect(36, 24, 16, 8); x.fillStyle = '#4ac860'; x.fillRect(38, 26, 12, 4); capsule(x, 50, 18, 56, 4, 1.5, '#888'); },
    keys: (x, c) => { x.strokeStyle = '#d8c040'; x.lineWidth = 3; x.beginPath(); x.arc(22, 22, 9, 0, 7); x.stroke(); capsule(x, 28, 28, 54, 54, 4, '#c8b038'); x.fillStyle = '#c8b038'; x.fillRect(44, 48, 6, 5); x.fillRect(50, 44, 5, 5); },
    sparkplug: (x, c) => { capsule(x, 32, 12, 32, 50, 7, '#d0d0d0'); x.fillStyle = '#444'; x.fillRect(28, 12, 8, 12); },
    tire: (x, c) => { circ(x, 32, 34, 22, '#1c1c20'); circ(x, 32, 34, 11, '#8a8f96'); circ(x, 32, 34, 4, '#444'); },
    fusebox: (x, c) => { rr(x, 20, 22, 24, 22, 3, '#ddd'); x.fillStyle = '#c8c040'; x.fillRect(24, 28, 16, 10); capsule(x, 20, 33, 12, 33, 2, '#999'); capsule(x, 44, 33, 52, 33, 2, '#999'); },
    chemicals: (x, c) => { poly(x, [[24, 12], [40, 12], [40, 28], [52, 52], [12, 52], [24, 28]], 'rgba(120,230,90,0.7)'); x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(26, 14, 4, 18); },
    jacket: (x, c) => { poly(x, [[18, 12], [46, 12], [58, 26], [52, 36], [46, 30], [46, 54], [18, 54], [18, 30], [12, 36], [6, 26]], grad(x, 6, 12, 58, 54, '#4a5a6a', 1.25, 0.65)); x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(32, 14); x.lineTo(32, 54); x.stroke(); },
    hoodie: (x, c) => { poly(x, [[18, 14], [46, 14], [58, 28], [52, 38], [46, 32], [46, 54], [18, 54], [18, 32], [12, 38], [6, 28]], grad(x, 6, 12, 58, 54, '#7a5a5a', 1.25, 0.65)); x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.arc(32, 16, 9, 0, 3.14); x.fill(); rr(x, 24, 38, 16, 10, 2, 'rgba(0,0,0,0.2)'); },
    vest: (x, c) => { poly(x, [[18, 10], [28, 14], [36, 14], [46, 10], [52, 22], [48, 54], [16, 54], [12, 22]], grad(x, 12, 10, 52, 54, '#3a4046', 1.35, 0.6)); x.strokeStyle = 'rgba(255,255,255,0.15)'; x.lineWidth = 2; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(16, 24 + i * 7); x.lineTo(48, 24 + i * 7); x.stroke(); } x.fillStyle = '#d8c040'; x.fillRect(26, 28, 12, 6); },
    helmet: (x, c) => { x.beginPath(); x.arc(32, 36, 22, Math.PI, 0); x.lineTo(54, 44); x.lineTo(10, 44); x.closePath(); x.fillStyle = grad(x, 10, 14, 54, 44, '#5a6440', 1.3, 0.6); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 1.5; x.stroke(); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(18, 22, 14, 4); },
    cap: (x, c) => { x.beginPath(); x.arc(30, 38, 18, Math.PI, 0); x.closePath(); x.fillStyle = grad(x, 12, 20, 48, 38, '#4a6a8a', 1.3, 0.6); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 1.5; x.stroke(); poly(x, [[34, 36], [58, 38], [56, 44], [32, 42]], '#3a5a7a'); },
    boots: (x, c) => { poly(x, [[18, 10], [34, 10], [34, 38], [56, 42], [56, 54], [14, 54], [14, 30]], grad(x, 14, 10, 56, 54, '#6a4a2e', 1.3, 0.6)); x.fillStyle = '#222'; x.fillRect(14, 50, 42, 5); },
    // t-shirt: classic tee silhouette - body + short sleeves + neckline
    tshirt: (x, c) => { poly(x, [[20, 14], [26, 10], [38, 10], [44, 14], [54, 22], [50, 34], [44, 30], [44, 54], [20, 54], [20, 30], [14, 34], [10, 22]], grad(x, 10, 12, 50, 54, c || '#5a7a9a', 1.25, 0.65)); x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 1.5; x.beginPath(); x.arc(32, 13, 7, 0.15, Math.PI - 0.15); x.stroke(); x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(24, 18, 4, 32); },
    // shorts: waistband + two short legs with a middle seam
    shorts: (x, c) => { poly(x, [[16, 18], [48, 18], [50, 30], [42, 54], [34, 54], [32, 36], [30, 54], [22, 54], [14, 30]], grad(x, 14, 18, 50, 54, c || '#54627e', 1.25, 0.65)); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(16, 18, 32, 5); x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(17, 19, 30, 2); },
    // trousers: two full-length legs with a waistband
    trousers: (x, c) => { poly(x, [[16, 16], [48, 16], [50, 28], [46, 54], [35, 54], [32, 30], [29, 54], [18, 54], [14, 28]], grad(x, 14, 16, 50, 54, c || '#4a4f60', 1.25, 0.65)); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(16, 16, 32, 5); x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(17, 17, 30, 2); },
    // cargo pants: full-length + side pocket flaps on both legs
    cargopants: (x, c) => { poly(x, [[16, 16], [48, 16], [50, 28], [46, 54], [35, 54], [32, 30], [29, 54], [18, 54], [14, 28]], grad(x, 14, 16, 50, 54, c || '#5a6248', 1.25, 0.65)); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(16, 16, 32, 5); rr(x, 8, 30, 12, 14, 2, grad(x, 8, 30, 20, 44, '#4c543c', 1.15, 0.6)); rr(x, 44, 30, 12, 14, 2, grad(x, 44, 30, 56, 44, '#4c543c', 1.15, 0.6)); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(9, 33, 10, 2); x.fillRect(45, 33, 10, 2); },
    // sneakers: low shoe with a light sole and lace hints
    sneakers: (x, c) => { poly(x, [[12, 34], [30, 30], [46, 32], [54, 40], [54, 48], [10, 48]], grad(x, 10, 30, 54, 48, c || '#8a8a8a', 1.2, 0.65)); x.fillStyle = '#d8d8d4'; x.fillRect(10, 46, 44, 6); x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1.2; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(20 + i * 6, 32); x.lineTo(24 + i * 6, 40); x.stroke(); } },
    // running shoes: slim profile, white sole, side stripe
    runners: (x, c) => { poly(x, [[12, 36], [30, 32], [46, 34], [54, 42], [54, 48], [10, 48]], grad(x, 10, 32, 54, 48, c || '#c8c8d0', 1.2, 0.65)); x.fillStyle = '#f0f0ee'; x.fillRect(10, 47, 44, 4); poly(x, [[14, 40], [50, 38], [52, 44], [12, 44]], '#d04040'); x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(26, 34); x.lineTo(34, 42); x.stroke(); },
    backpack: (x, c) => { rr(x, 12, 12, 40, 46, 10, grad(x, 12, 12, 52, 58, '#5c6a46', 1.3, 0.6)); rr(x, 18, 36, 28, 16, 3, 'rgba(0,0,0,0.25)'); x.fillStyle = '#ccc'; x.fillRect(30, 40, 4, 4); x.strokeStyle = '#3a4a2a'; x.lineWidth = 3; x.beginPath(); x.arc(32, 14, 8, Math.PI, 0); x.stroke(); },
    bigpack: (x, c) => { rr(x, 10, 8, 44, 52, 10, grad(x, 10, 8, 54, 60, '#8a4a30', 1.3, 0.6)); rr(x, 16, 38, 32, 16, 3, 'rgba(0,0,0,0.25)'); rr(x, 16, 16, 32, 14, 3, 'rgba(0,0,0,0.2)'); },
    fannypack: (x, c) => { rr(x, 8, 24, 48, 22, 10, grad(x, 8, 24, 56, 46, '#4a4a52', 1.3, 0.6)); x.strokeStyle = '#ccc'; x.lineWidth = 2; x.beginPath(); x.moveTo(12, 30); x.lineTo(52, 30); x.stroke(); },
    plank_bundle: (x, c) => { for (let i = 0; i < 4; i++) poly(x, [[8, 22 + i * 8], [56, 14 + i * 8], [56, 20 + i * 8], [8, 28 + i * 8]], grad(x, 8, 0, 56, 0, '#b88852', 1.2 - i * 0.08, 0.7)); }
  };

  Icons.get = function (id) {
    let c = cache[id]; if (c) return c;
    const def = DSZ.ITEMS[id]; const [cv, x] = U.canvas2d(64, 64);
    x.lineJoin = 'round'; x.lineCap = 'round';
    const f = draw[id];
    if (f) f(x, def ? def.col : '#aaa');
    else {
      // generic crate-ish fallback by colour
      rr(x, 12, 14, 40, 40, 6, grad(x, 12, 14, 52, 54, def ? def.col : '#888', 1.3, 0.6));
      x.fillStyle = 'rgba(255,255,255,0.7)'; x.font = 'bold 20px Rajdhani, sans-serif'; x.textAlign = 'center'; x.fillText((def ? def.name : id)[0], 32, 42);
    }
    cache[id] = cv; return cv;
  };
})();
