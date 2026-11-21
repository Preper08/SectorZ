/* Dead SectorZ — procedural town generation (roads, blocks, props, cars, spawns) */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, O = DSZ.O, G = DSZ.G, W = DSZ.World, C = DSZ.C, Bld = DSZ.Bld, D = DSZ.OBJDEF;
  const Gen = DSZ.Gen = { carSpecs: [], zombieSpawns: [], playerSpawn: [30, 30], marks: new Map(), poi: [] };
  let rng;

  function R(n) { return (rng() * n) | 0; }
  function fill(x, y, w, h, g) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (W.inb(i, j)) W.ground[W.idx(i, j)] = g; }
  function mark(x, y, w, h, col, a) {
    const m = { x, y, w, h, col, a: a === undefined ? 0.78 : a };
    const cs = C.CH;
    for (let cy = Math.floor(y / cs); cy <= Math.floor((y + h) / cs); cy++) for (let cx = Math.floor(x / cs); cx <= Math.floor((x + w) / cs); cx++) {
      const k = cy * 1000 + cx; let l = Gen.marks.get(k); if (!l) { l = []; Gen.marks.set(k, l); } l.push(m);
    }
  }
  function free(x, y) { return W.inb(x, y) && !W.getObj(x, y); }
  function put(x, y, t, extra) { if (!free(x, y)) return null; const o = Object.assign({ t, f: R(4), v: R(4) }, extra || {}); W.setObj(x, y, o); return o; }
  function tree(x, y) { return put(x, y, U.weighted(rng, [[O.TREE_PINE, 4], [O.TREE_OAK, 4], [O.TREE_DEAD, 1.2]]), { s: 0.85 + rng() * 0.4 }); }
  function lampAt(x, y, working, col) {
    const o = put(x, y, O.STREETLAMP); if (!o) return;
    if (working) o.light = W.addLight({ x: x + 0.5, y: y + 0.5, r: 8.5, col: col || [255, 206, 138], a: 0.95, kind: 'lamp', flick: rng() < 0.35 ? 1 : 0, seed: rng() * 100, h: 3 });
    o.dead = !working;
  }
  Gen.addCar = function (x, y, ang, state, kind) {
    for (const c of Gen.carSpecs) if (Math.hypot(c.x - x, c.y - y) < 4.4) return null;
    const spec = { x, y, ang, state: state || 'wreck', kind: kind || U.pick(rng, ['sedan', 'sedan', 'hatch', 'van', 'pickup', 'taxi']), color: R(10), seed: R(99999) };
    Gen.carSpecs.push(spec); return spec;
  };
  function addZ(x, y, type) { Gen.zombieSpawns.push([x, y, type || U.weighted(rng, [['walker', 82], ['runner', 8], ['brute', 5], ['crawler', 5]])]); }

  const SHOPS = ['grocery', 'pharmacy', 'hardware', 'clothing', 'general', 'electronics', 'diner'];

  // ---------------------------------------------------------------- base terrain & roads
  function terrain() {
    const x0 = 11, x1 = C.W - 11;
    for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) W.ground[W.idx(x, y)] = (x < x0 || y < x0 || x >= x1 || y >= x1) ? G.FOREST : G.GRASS;
    const cs = []; for (let i = 0; i < 5; i++) cs.push(C.STREET0 + i * C.SP);
    Gen.centers = cs;
    const ya = 4, yb = C.H - 4;
    for (const c of cs) {
      for (let t = ya; t < yb; t++) {
        for (let s = -5; s < -3; s++) { fill(c + s, t, 1, 1, G.SIDEWALK); fill(t, c + s, 1, 1, G.SIDEWALK); }
        for (let s = 3; s < 5; s++) { fill(c + s, t, 1, 1, G.SIDEWALK); fill(t, c + s, 1, 1, G.SIDEWALK); }
      }
    }
    for (const c of cs) for (let t = ya; t < yb; t++) for (let s = -3; s < 3; s++) {
      fill(c + s, t, 1, 1, G.ASPHALT); fill(t, c + s, 1, 1, G.ASPHALT);
      W.roadMask[W.idx(c + s, t)] = 1; W.roadMask[W.idx(t, c + s)] = 1;
    }
    // paint
    const inInter = t => { for (const c of cs) if (Math.abs(t - c) < 5.8) return true; return false; };
    for (const c of cs) {
      for (let t = ya + 3; t < yb - 3; t += 1) {
        if (inInter(t)) continue;
        mark(c - 0.14, t, 0.09, 1.02, '#d8b030', 0.85); mark(c + 0.06, t, 0.09, 1.02, '#d8b030', 0.85);
        mark(t, c - 0.14, 1.02, 0.09, '#d8b030', 0.85); mark(t, c + 0.06, 1.02, 0.09, '#d8b030', 0.85);
        mark(c - 2.72, t, 0.08, 1.02, '#d8d8d0', 0.6); mark(c + 2.64, t, 0.08, 1.02, '#d8d8d0', 0.6);
        mark(t, c - 2.72, 1.02, 0.08, '#d8d8d0', 0.6); mark(t, c + 2.64, 1.02, 0.08, '#d8d8d0', 0.6);
      }
    }
    for (const cx of cs) for (const cy of cs) {
      for (let k = 0; k < 6; k++) { // zebra bars on all four arms
        const o = -2.75 + k * 1.0;
        mark(cx + o, cy - 5.3, 0.55, 1.9, '#dcdcd4', 0.8); mark(cx + o, cy + 3.4, 0.55, 1.9, '#dcdcd4', 0.8);
        mark(cx - 5.3, cy + o, 1.9, 0.55, '#dcdcd4', 0.8); mark(cx + 3.4, cy + o, 1.9, 0.55, '#dcdcd4', 0.8);
      }
      // stop lines
      mark(cx - 3, cy - 5.9, 3, 0.25, '#dcdcd4', 0.75); mark(cx, cy + 5.65, 3, 0.25, '#dcdcd4', 0.75);
      mark(cx - 5.9, cy, 0.25, 3, '#dcdcd4', 0.75); mark(cx + 5.65, cy - 3, 0.25, 3, '#dcdcd4', 0.75);
    }
  }

  function forest() {
    const x0 = 11, x1 = C.W - 11;
    for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
      const edge = Math.min(x, y, C.W - 1 - x, C.H - 1 - y);
      if (W.ground[W.idx(x, y)] !== G.FOREST) continue;
      if (W.roadMask[W.idx(x, y)]) continue;
      const p = edge < 3 ? 1 : 0.22 + (x < x0 || y < x0 || x >= x1 || y >= x1 ? 0.12 : 0);
      if (rng() < p) tree(x, y);
      else if (rng() < 0.05) put(x, y, O.BUSH);
      else if (rng() < 0.012) put(x, y, O.ROCK);
    }
    // road ends: barricades
    for (const c of Gen.centers) {
      for (const e of [7, C.H - 8]) {
        for (let s = -3; s < 3; s++) { if (rng() < 0.85) { put(c + s, e, O.BARRIER); put(e, c + s, O.BARRIER); } }
        Gen.addCar(c - 1, e + (e < 20 ? 3 : -3), 0.3, 'wreck', 'taxi'); Gen.addCar(e + (e < 20 ? 3 : -3), c + 1, 1.9, 'wreck', 'sedan');
      }
      // trees can't block roads at the very ends
    }
  }

  // ---------------------------------------------------------------- blocks
  function houseLot(lx, ly, row, col, rows) {
    const hw = 8 + R(3), hh = 7 + R(2);
    const hx = lx + 1 + R(Math.max(1, 13 - hw - 1));
    const hy = row === 0 ? ly + 3 : ly + 13 - 3 - hh;
    const door = row === 0 ? 'N' : 'S';
    const b = Bld.make({ x: hx, y: hy, w: hw, h: hh, kind: 'house', door, rng, name: 'House' });
    b.lit = rng() < 0.12;
    if (b.lit) { for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { const o = W.getObj(x, y); if (o && o.t === O.WINDOW) { o.v = 3; } } }
    const [dx, dy] = b.frontDoor;
    // path to sidewalk
    if (row === 0) { for (let y = ly - 1; y < dy; y++) { W.ground[W.idx(dx, y)] = G.CONCRETE; } }
    else { for (let y = dy + 1; y <= ly + 13; y++) { W.ground[W.idx(dx, y)] = G.CONCRETE; } }
    // driveway
    if (rng() < 0.65) {
      let sx = (hx - lx >= 3) ? hx - 3 : (lx + 13 - (hx + hw) >= 3 ? hx + hw + 1 : -1);
      if (sx >= 0) {
        const y0 = row === 0 ? ly : hy + 1, y1 = row === 0 ? hy + hh - 2 : ly + 13;
        for (let y = y0; y <= y1; y++) { fill(sx, y, 2, 1, G.CONCRETE); }
        if (rng() < 0.6) { const cy2 = row === 0 ? ly + 3 + R(3) : ly + 13 - 4 - R(3); Gen.addCar(sx + 1, cy2 + 0.5, Math.PI / 2 + (rng() - 0.5) * 0.2, rng() < 0.3 ? 'ok' : 'wreck'); }
      }
    }
    // yard
    for (let i = 0; i < 6; i++) { const x = lx + R(13), y = ly + R(13); if (W.room[W.idx(x, y)] === 0 && W.ground[W.idx(x, y)] === G.GRASS) { if (rng() < 0.5) tree(x, y); else put(x, y, O.BUSH); } }
    const mbx = dx + 1, mby = row === 0 ? ly : ly + 12;
    if (free(mbx, mby) && W.ground[W.idx(mbx, mby)] === G.GRASS) put(mbx, mby, O.MAILBOX, { loot: 'mail' });
    if (rng() < 0.5) put(row === 0 ? hx + hw - 1 : hx, row === 0 ? hy - 1 : hy + hh, O.TRASHCAN, { loot: 'trash' });
    // zombies
    const n = R(3) + (rng() < 0.3 ? 1 : 0);
    for (let i = 0; i < n; i++) { const p = Bld.randomInterior(b, rng); if (p) addZ(p[0], p[1]); }
    if (rng() < 0.4) addZ(lx + 2 + rng() * 9, ly + 2 + rng() * 9);
    return b;
  }

  function resBlock(bx, by) {
    fill(bx, by, 26, 26, G.GRASS);
    const houses = [];
    for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) houses.push(houseLot(bx + col * 13, by + row * 13, row, col));
    // fences
    for (let y = by + 3; y < by + 23; y++) for (const x of [bx, bx + 12, bx + 25]) { if (rng() < 0.82 && free(x, y) && W.ground[W.idx(x, y)] === G.GRASS) put(x, y, O.FENCE, { f: 3 }); }
    for (let x = bx + 1; x < bx + 25; x++) { const y = by + 12; if (rng() < 0.8 && free(x, y) && W.ground[W.idx(x, y)] === G.GRASS && x !== bx + 12) put(x, y, O.FENCE, { f: 0 }); }
    return houses;
  }

  function commBlock(bx, by, types) {
    fill(bx, by, 26, 26, G.PARKING); fill(bx, by + 10, 26, 6, G.PARKING);
    let idx = 0;
    for (const row of [0, 1]) {
      let cx = bx;
      while (cx + 8 <= bx + 26) {
        let w = 8 + R(5); if (cx + w + 8 > bx + 26) w = bx + 26 - cx;
        const type = types ? types[idx % types.length] : U.pick(rng, SHOPS);
        const isDiner = type === 'diner';
        const b = Bld.make({ x: cx, y: row === 0 ? by : by + 16, w, h: 10, kind: isDiner ? 'diner' : 'shop', shop: type, door: row === 0 ? 'N' : 'S', rng, floor: G.TILE, name: type, locked: rng() < 0.2, mat: U.pick(rng, ['brick_r', 'brick_b', 'stucco', 'block']), roof: '#33353a' });
        b.flat = true;
        // back door
        const by2 = row === 0 ? b.y + b.h - 1 : b.y;
        const bxx = b.x + 2 + R(Math.max(1, w - 4)); const bw = W.getObj(bxx, by2);
        if (bw && bw.t === O.WALL) { bw.t = O.DOOR; bw.open = false; bw.locked = rng() < 0.7; bw.v = 3; W.refresh(bxx, by2); b.doors.push([bxx, by2]); }
        const n = 1 + R(3); for (let i = 0; i < n; i++) { const p = Bld.randomInterior(b, rng); if (p) addZ(p[0], p[1]); }
        cx += w; idx++;
        // sidewalk in front
        fill(b.x, row === 0 ? by - 1 : by + 26, w, 1, G.SIDEWALK);
      }
    }
    // alley props
    for (let i = 0; i < 4; i++) { const x = bx + 2 + R(22), y = rng() < 0.5 ? by + 10 : by + 15; put(x, y, O.DUMPSTER, { loot: 'trash' }); }
    for (let i = 0; i < 3; i++) put(bx + 2 + R(22), by + 11 + R(4), O.BARREL, { loot: 'industrial' });
    for (let i = 0; i < 5; i++) Gen.addCar(bx + 2 + rng() * 22, by + 11.5 + rng() * 3, rng() < 0.5 ? 0 : Math.PI + (rng() - 0.5) * 0.4, 'wreck');
    lampAt(bx + 6, by + 12, rng() < 0.7); lampAt(bx + 19, by + 13, rng() < 0.7);
    for (let i = 0; i < 6; i++) addZ(bx + 2 + rng() * 22, by + 11 + rng() * 4);
  }

  function superBlock(bx, by) {
    fill(bx, by, 26, 26, G.PARKING);
    const b = Bld.make({ x: bx + 1, y: by + 1, w: 24, h: 13, kind: 'super', shop: 'grocery', door: 'S', rng, floor: G.TILE, name: 'Supermarket', mat: 'block', roof: '#3a3c40', locked: false });
    b.flat = true; b.big = true;
    for (let i = 0; i < 8; i++) { const p = Bld.randomInterior(b, rng); if (p) addZ(p[0], p[1]); }
    // parking lines + cars
    for (let y = by + 16; y <= by + 22; y += 4) for (let x = bx + 2; x < bx + 24; x += 3) {
      mark(x, y, 0.08, 3, '#d8d8d0', 0.55);
      if (rng() < 0.42) Gen.addCar(x + 1.5, y + 1.6, Math.PI / 2 + (rng() - 0.5) * 0.15, rng() < 0.15 ? 'ok' : 'wreck');
    }
    for (let i = 0; i < 8; i++) put(bx + 2 + R(22), by + 15 + R(10), O.CRATE, { loot: 'trash' });
    for (let i = 0; i < 12; i++) addZ(bx + 2 + rng() * 22, by + 15 + rng() * 10);
    lampAt(bx + 6, by + 15, true); lampAt(bx + 20, by + 15, true); lampAt(bx + 6, by + 24, rng() < 0.5); lampAt(bx + 20, by + 24, true);
    fill(bx + 1, by + 14, 24, 1, G.SIDEWALK);
  }

  function civicBlock(bx, by, kind) {
    fill(bx, by, 26, 26, G.CONCRETE);
    fill(bx, by + 17, 26, 9, G.PARKING);
    const big = kind === 'hospital';
    const b = Bld.make({ x: bx + 2, y: by + 2, w: big ? 22 : 20, h: big ? 15 : 13, kind, door: 'S', rng, floor: G.LINO, name: kind === 'police' ? 'Police Station' : 'Hospital', mat: kind === 'police' ? 'brick_b' : 'stucco', imat: 'int_blue', roof: '#44484e', locked: false });
    b.flat = true; b.big = true; b.name = kind === 'police' ? 'Police Station' : 'General Hospital';
    for (let i = 0; i < 10; i++) { const p = Bld.randomInterior(b, rng); if (p) addZ(p[0], p[1]); }
    for (let x = bx + 2; x < bx + 24; x += 4) { mark(x, by + 19, 0.08, 4, '#d8d8d0', 0.6); if (rng() < 0.6) Gen.addCar(x + 2, by + 21.5, Math.PI / 2, kind === 'police' ? 'police' : 'van'); }
    for (let i = 0; i < 6; i++) tree(bx + R(26), by + R(2) + 24);
    lampAt(bx + 4, by + 18, true, [200, 220, 255]); lampAt(bx + 22, by + 18, true, [200, 220, 255]);
    for (let i = 0; i < 9; i++) addZ(bx + 2 + rng() * 22, by + 18 + rng() * 7);
    if (kind === 'police') { put(bx + 12, by + 16, O.BARRIER); put(bx + 14, by + 16, O.BARRIER); }
    Gen.poi.push({ name: b.name, x: b.x + b.w / 2, y: b.y + b.h / 2 });
  }

  function churchBlock(bx, by) {
    fill(bx, by, 26, 26, G.GRASS);
    const b = Bld.make({ x: bx + 6, y: by + 1, w: 14, h: 16, kind: 'church', door: 'S', rng, floor: G.WOOD, name: 'Church', mat: 'stucco', imat: 'int_cream', roof: '#403632', locked: false });
    fill(bx + 12, by + 17, 2, 9, G.CONCRETE);
    for (let y = by + 19; y < by + 25; y += 2) for (let x = bx + 1; x < bx + 25; x += 2) { if (x >= bx + 10 && x <= bx + 15) continue; if (rng() < 0.8) { put(x, y, O.GRAVE, { v: R(4) }); if (rng() < 0.18) addZ(x + 0.5, y + 0.5, 'walker'); } }
    for (let i = 0; i < 10; i++) { const x = bx + R(26), y = by + 17 + R(9); if (free(x, y)) { if (rng() < 0.6) tree(x, y); else put(x, y, O.BUSH); } }
    for (let i = 0; i < 6; i++) { const p = Bld.randomInterior(b, rng); if (p) addZ(p[0], p[1]); }
    Gen.poi.push({ name: 'Church', x: b.x + b.w / 2, y: b.y + b.h / 2 });
  }

  function indBlock(bx, by) {
    fill(bx, by, 26, 26, G.CONCRETE);
    const b = Bld.make({ x: bx + 1, y: by + 1, w: 24, h: 12, kind: 'warehouse', door: 'S', rng, floor: G.CONC_IN, name: 'Warehouse', mat: 'metal', imat: 'int_conc', roof: '#4a4e52', locked: true });
    b.flat = true; b.big = true;
    for (let i = 0; i < 6; i++) { const p = Bld.randomInterior(b, rng); if (p) addZ(p[0], p[1]); }
    // container yard
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { if (rng() < 0.2) continue; const x = bx + 2 + c * 6, y = by + 16 + r * 3; for (let k = 0; k < 4; k++) put(x + k, y, O.CONTAINER, { v: (c + r) % 4 }); }
    for (let i = 0; i < 10; i++) put(bx + R(26), by + 14 + R(12), rng() < 0.5 ? O.BARREL : O.PALLET, { loot: 'industrial' });
    for (let x = bx; x < bx + 26; x++) { if (x >= bx + 10 && x <= bx + 13) continue; put(x, by + 25, O.FENCE_CL, { f: 0 }); }
    for (let y = by + 14; y < by + 26; y++) { put(bx, y, O.FENCE_CL, { f: 3 }); put(bx + 25, y, O.FENCE_CL, { f: 3 }); }
    lampAt(bx + 4, by + 14, true, [255, 220, 150]); lampAt(bx + 21, by + 14, rng() < 0.6, [255, 220, 150]);
    put(bx + 14, by + 20, O.WRECKFIRE, {});
    const wf = W.getObj(bx + 14, by + 20); if (wf) wf.light = W.addLight({ x: bx + 14.5, y: by + 20.5, r: 7, col: [255, 140, 50], a: 1.0, kind: 'fire', flick: 2, seed: rng() * 100, h: 1 });
    for (let i = 0; i < 8; i++) addZ(bx + 2 + rng() * 22, by + 14 + rng() * 11);
    Gen.poi.push({ name: 'Warehouse', x: b.x + b.w / 2, y: b.y + b.h / 2 });
  }

  function parkBlock(bx, by) {
    fill(bx, by, 26, 26, G.GRASS);
    fill(bx + 12, by, 2, 26, G.SIDEWALK); fill(bx, by + 12, 26, 2, G.SIDEWALK);
    for (let i = 0; i < 48; i++) { const x = bx + R(26), y = by + R(26); if (free(x, y) && W.ground[W.idx(x, y)] === G.GRASS) { if (rng() < 0.7) tree(x, y); else put(x, y, O.BUSH); } }
    for (let i = 0; i < 8; i++) { put(bx + 11 + (i % 2) * 3, by + 1 + i * 3, O.BENCH, { f: i % 2 ? 2 : 0 }); }
    put(bx + 12, by + 12, O.ROCK); lampAt(bx + 11, by + 11, rng() < 0.8, [200, 220, 255]); lampAt(bx + 14, by + 14, rng() < 0.7, [200, 220, 255]);
    for (let i = 0; i < 10; i++) addZ(bx + 2 + rng() * 22, by + 2 + rng() * 22);
    Gen.poi.push({ name: 'Park', x: bx + 13, y: by + 13 });
  }

  function gasBlock(bx, by) {
    fill(bx, by, 26, 26, G.GRASS); fill(bx, by, 26, 13, G.CONCRETE);
    const b = Bld.make({ x: bx + 3, y: by + 1, w: 10, h: 7, kind: 'gasstore', shop: 'gas', door: 'S', rng, floor: G.TILE, name: 'Gas Station', mat: 'stucco', roof: '#6a2a2a', locked: false });
    b.flat = true;
    for (let x = bx + 15; x <= bx + 23; x += 4) for (const y of [by + 3, by + 7]) put(x, y, O.GENERATOR, { v: 9, pump: true });
    Gen.addCar(bx + 16, by + 10, 0.2, 'wreck'); Gen.addCar(bx + 22, by + 6, 1.4, 'ok', 'sedan');
    const d = Bld.make({ x: bx + 6, y: by + 15, w: 14, h: 9, kind: 'diner', shop: 'diner', door: 'N', rng, floor: G.LINO, name: 'Diner', mat: 'siding_r', roof: '#3a3030', locked: false });
    for (let i = 0; i < 12; i++) { const x = bx + R(26), y = by + 13 + R(13); if (free(x, y) && W.ground[W.idx(x, y)] === G.GRASS) { if (rng() < 0.5) tree(x, y); else put(x, y, O.BUSH); } }
    lampAt(bx + 14, by + 9, true, [255, 230, 170]); lampAt(bx + 24, by + 9, true, [255, 230, 170]);
    for (let i = 0; i < 6; i++) addZ(bx + 2 + rng() * 22, by + 2 + rng() * 20);
    const p = Bld.randomInterior(b, rng); if (p) addZ(p[0], p[1]);
    Gen.poi.push({ name: 'Gas Station', x: b.x + b.w / 2, y: b.y + b.h / 2 });
  }

  // ---------------------------------------------------------------- streets: props & cars
  function streets() {
    const cs = Gen.centers, ya = 6, yb = C.H - 6;
    const nearInter = t => { for (const c of cs) if (Math.abs(t - c) < 6.5) return true; return false; };
    for (const c of cs) {
      for (let t = ya + 6; t < yb - 6; t += 6) {
        if (nearInter(t)) continue;
        const side = ((t / 6) | 0) & 1;
        const working = rng() < 0.55;
        lampAt(side ? c + 3 : c - 4, t, working, rng() < 0.25 ? [200, 225, 255] : [255, 206, 138]);
        lampAt(t, side ? c + 3 : c - 4, rng() < 0.55, rng() < 0.25 ? [200, 225, 255] : [255, 206, 138]);
        if (rng() < 0.18) { put(c - 5, t + 2, O.HYDRANT); }
        if (rng() < 0.18) { put(t + 2, c + 4, O.TRASHCAN, { loot: 'trash' }); }
        if (rng() < 0.15) { put(c + 4, t + 3, O.BENCH, { f: 2 }); }
      }
    }
    for (const cx of cs) for (const cy of cs) {
      for (const [ox, oy] of [[-4, -4], [3, -4], [-4, 3], [3, 3]]) {
        const o = put(cx + ox, cy + oy, O.TRAFFIC, { phase: R(3) });
        if (o) { o.light = W.addLight({ x: cx + ox + 0.5, y: cy + oy + 0.5, r: 3.6, col: [255, 60, 40], a: 0.55, kind: 'traffic', flick: 0, seed: rng() * 100, h: 3 }); }
      }
      // pile-up
      if (rng() < 0.5) {
        const n = 1 + R(3);
        for (let i = 0; i < n; i++) Gen.addCar(cx + (rng() - 0.5) * 5, cy + (rng() - 0.5) * 5, rng() * 6.28, rng() < 0.2 ? 'burnt' : 'wreck');
        if (rng() < 0.4) { put(cx + 1, cy + 1, O.WRECKFIRE, {}); const wf = W.getObj(cx + 1, cy + 1); if (wf) wf.light = W.addLight({ x: cx + 1.5, y: cy + 1.5, r: 8, col: [255, 140, 50], a: 1.0, kind: 'fire', flick: 2, seed: rng() * 100, h: 1 }); }
      }
      for (let i = 0; i < 4; i++) addZ(cx + (rng() - 0.5) * 8, cy + (rng() - 0.5) * 8);
    }
    // abandoned traffic along roads
    for (let i = 0; i < 70; i++) {
      const c = U.pick(rng, cs), t = ya + 8 + rng() * (yb - ya - 16);
      if (nearInter(t)) continue;
      const lane = rng() < 0.5 ? -1.5 : 1.5, vert = rng() < 0.5;
      const st = rng() < 0.12 ? 'ok' : (rng() < 0.18 ? 'burnt' : 'wreck');
      if (vert) Gen.addCar(c + lane + (rng() - 0.5) * 0.4, t, (lane < 0 ? -Math.PI / 2 : Math.PI / 2) + (rng() - 0.5) * 0.3, st);
      else Gen.addCar(t, c + lane + (rng() - 0.5) * 0.4, (lane < 0 ? Math.PI : 0) + (rng() - 0.5) * 0.3, st);
    }
    // road zombies
    for (let i = 0; i < 26; i++) { const c = U.pick(rng, cs), t = ya + rng() * (yb - ya); if (rng() < 0.5) addZ(c + (rng() - 0.5) * 5, t); else addZ(t, c + (rng() - 0.5) * 5); }
  }

  Gen.generate = function (seed) {
    rng = U.mulberry32(seed);
    Gen.carSpecs = []; Gen.zombieSpawns = []; Gen.marks = new Map(); Gen.poi = [];
    W.init(seed);
    terrain();
    // blocks: [row][col] types
    const layout = [
      ['res', 'res', 'comm', 'res'],
      ['res', 'police', 'comm', 'park'],
      ['ind', 'comm', 'super', 'res'],
      ['gas', 'church', 'res', 'hospital']
    ];
    Gen.blocks = [];
    let startHouse = null;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const bx = Gen.centers[i] + 5, by = Gen.centers[j] + 5, t = layout[j][i];
      Gen.blocks.push({ x: bx, y: by, type: t });
      if (t === 'res') { const hs = resBlock(bx, by); if (!startHouse && i === 0 && j === 0) startHouse = hs[0]; }
      else if (t === 'comm') commBlock(bx, by);
      else if (t === 'super') superBlock(bx, by);
      else if (t === 'police' || t === 'hospital') civicBlock(bx, by, t);
      else if (t === 'church') churchBlock(bx, by);
      else if (t === 'ind') indBlock(bx, by);
      else if (t === 'park') parkBlock(bx, by);
      else if (t === 'gas') gasBlock(bx, by);
    }
    // guarantee a gun shop
    for (const b of W.blds) if (b && b.kind === 'shop' && b.shop === 'hardware') { b.shop = 'guns'; b.name = 'guns'; for (const p of b.props) if (p.t === O.SHELF) p.loot = 'guns'; break; }
    // guarantee a clothing shop. Shop types are picked at random, so a town could come out with
    // no clothier at all and clothing then depended on the handful of wardrobes. A general store
    // is the safest one to convert: it uses the same 'store' shelves as any other shop, so only
    // its name, shop tag and shelf loot table change. Same approach as the gun shop above.
    if (!W.blds.some(b => b && b.kind === 'shop' && b.shop === 'clothing')) {
      let target = W.blds.find(b => b && b.kind === 'shop' && b.shop === 'general');
      if (!target) target = W.blds.find(b => b && b.kind === 'shop' && b.shop !== 'guns' && b.shop !== 'hardware');
      if (target) { target.shop = 'clothing'; target.name = 'clothing'; for (const p of target.props) if (p.t === O.SHELF) p.loot = 'clothing'; }
    }
    // Landmarks. The six civic sites are pushed by their own blocks; the shops worth finding get
    // a label too, but only when the building actually exists. The gun shop is the one that is
    // not guaranteed - the conversion above only fires if a hardware store was rolled, which is
    // most towns but not all - so a missing label there is the truth, not a bug.
    const landmark = (b, name) => { if (b) Gen.poi.push({ name, x: b.x + b.w / 2, y: b.y + b.h / 2, minor: true }); };
    landmark(W.blds.find(b => b && b.kind === 'super'), 'Supermarket');
    landmark(W.blds.find(b => b && b.kind === 'shop' && b.shop === 'guns'), 'Gun Shop');
    landmark(W.blds.find(b => b && b.kind === 'shop' && b.shop === 'clothing'), 'Clothing');
    for (const b of W.blds) if (b && b.kind === 'diner') landmark(b, 'Diner');
    streets();
    forest();
    // A door must lead somewhere. Interior partitions are handled per building (Bld.repairDoors),
    // but street/yard props (trash cans, hydrants, etc) are placed after the buildings and can
    // still end up blocking a door. Clear any non-wall object that leaves a door boxed in, so no
    // door is ever a dead end.
    for (let y = 1; y < C.H - 1; y++) for (let x = 1; x < C.W - 1; x++) {
      const o = W.getObj(x, y); if (!o || !D[o.t].door) continue;
      const s = (ax, ay) => W.isSolid(ax, ay);
      if ((!s(x - 1, y) && !s(x + 1, y)) || (!s(x, y - 1) && !s(x, y + 1))) continue;
      for (const [ax, ay] of [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]]) {
        const wo = W.getObj(ax, ay);
        if (wo && !D[wo.t].wall && !D[wo.t].door) { W.removeObj(ax, ay); if ((!s(x - 1, y) && !s(x + 1, y)) || (!s(x, y - 1) && !s(x, y + 1))) break; }
      }
    }
    // player spawn
    const sh = startHouse || W.blds[1];
    sh.locked = false; const fd = W.getObj(sh.frontDoor[0], sh.frontDoor[1]); if (fd) { fd.locked = false; fd.open = false; }
    const sp = Bld.playerSpawn(sh, rng) || [sh.x + 2.5, sh.y + 2.5];
    Gen.playerSpawn = sp; Gen.startHouse = sh;
    Gen.zombieSpawns = Gen.zombieSpawns.filter(z => Math.hypot(z[0] - sp[0], z[1] - sp[1]) > 22);
    // forest zombies
    for (let i = 0; i < 22; i++) { const x = rng() < 0.5 ? 2 + rng() * 9 : C.W - 11 + rng() * 9, y = 20 + rng() * (C.H - 40); if (!W.isSolid(Math.floor(x), Math.floor(y))) addZ(x, y); }
    // remove cars overlapping solid tiles / buildings
    Gen.carSpecs = Gen.carSpecs.filter(c => { const tx = Math.floor(c.x), ty = Math.floor(c.y); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (W.isSolid(tx + dx, ty + dy) || W.room[W.idx(tx + dx, ty + dy)]) return false; return W.inb(tx, ty); });
    Gen.zombieSpawns = Gen.zombieSpawns.filter(z => W.inb(Math.floor(z[0]), Math.floor(z[1])) && !W.isSolid(Math.floor(z[0]), Math.floor(z[1])));
    // difficulty: scale the world's zombie population. Density 1 leaves the list exactly
    // as generated (so Normal and old saves are byte-for-byte the same). Below 1 we drop a
    // deterministic subset; above 1 we add jittered copies of existing spots. Uses the same
    // seeded rng, so a given seed always yields the same population for a given difficulty.
    const zd = DSZ.DIFFCUR ? DSZ.DIFFCUR.zDensity : 1;
    if (zd !== 1 && Gen.zombieSpawns.length) {
      const list = Gen.zombieSpawns;
      if (zd < 1) { const keep = []; for (const z of list) if (rng() < zd) keep.push(z); Gen.zombieSpawns = keep.length ? keep : list.slice(0, 1); }
      else { const target = Math.round(list.length * zd), add = []; for (let i = 0; i < target - list.length; i++) { const z = list[(rng() * list.length) | 0]; const nx = z[0] + (rng() - 0.5) * 5, ny = z[1] + (rng() - 0.5) * 5; if (W.inb(Math.floor(nx), Math.floor(ny)) && !W.isSolid(Math.floor(nx), Math.floor(ny))) add.push([nx, ny, z[2]]); } for (const z of add) list.push(z); }
    }
    // window lights for lit houses
    for (const b of W.blds) if (b && b.lit) {
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { const o = W.getObj(x, y); if (o && o.t === O.WINDOW && o.v === 3) { const ox = x === b.x ? -1 : (x === b.x + b.w - 1 ? 1 : 0), oy = y === b.y ? -1 : (y === b.y + b.h - 1 ? 1 : 0); W.addLight({ x: x + 0.5 + ox * 1.2, y: y + 0.5 + oy * 1.2, r: 4.2, col: [255, 180, 90], a: 0.8, kind: 'window', flick: 3, seed: rng() * 100, h: 1.6 }); } }
    }
    // The police holding cell is trimmed here, at the very end, where nothing downstream reads
    // the generator any more. Shrinking it inside Bld.furnish was not safe: adding wall tiles
    // changes how many attempts Bld.randomInterior needs to find a free tile for a zombie, and
    // every extra attempt consumes draws, which reshuffles every building generated afterwards.
    // At this point the cost is zero for the rest of the world.
    shrinkPoliceCell();
    return Gen;
  };

  // Narrow the first holding cell of the police station so it reads as a cell rather than as
  // another office-sized room, and fit a cot, a toilet and a sink inside it. Runs after the
  // whole town exists, takes nothing from rng, and only touches that one building.
  function shrinkPoliceCell() {
    const pol = W.blds.find(b => b && b.kind === 'police');
    if (!pol) return;
    // bld.js has already re-typed the first holding cell to 'cell' and the second to 'bath',
    // so the room to trim is the one now called 'cell'.
    const R2 = pol.rooms.find(r => r.type === 'cell');
    if (!R2) return;
    const orig = { x0: R2.x0, y0: R2.y0, x1: R2.x1, y1: R2.y1 };
    const door = pol.doors.find(d =>
      ((d[0] === orig.x0 - 1 || d[0] === orig.x1 + 1) && d[1] >= orig.y0 && d[1] <= orig.y1) ||
      ((d[1] === orig.y0 - 1 || d[1] === orig.y1 + 1) && d[0] >= orig.x0 && d[0] <= orig.x1));
    const fillWall = (ax0, ay0, ax1, ay1) => {
      for (let y = ay0; y <= ay1; y++) for (let x = ax0; x <= ax1; x++)
        W.setObj(x, y, { t: O.WALL, mat: pol.imat, imat: pol.imat, v: (x * 7 + y * 13) & 3, b: pol.id });
    };
    // Cut a strip off the side furthest from the door, leaving a room at least 3 tiles across
    // on the door axis so the doorway is still usable and the player can walk in.
    if (door) {
      const doorInSideWall = door[0] === orig.x0 - 1 || door[0] === orig.x1 + 1;
      if (doorInSideWall) {
        const h = orig.y1 - orig.y0 + 1, target = Math.max(3, h - 2), cut = h - target;
        if (cut > 0) {
          if ((orig.y1 - door[1]) < (door[1] - orig.y0)) { fillWall(orig.x0, orig.y0, orig.x1, orig.y0 + cut - 1); R2.y0 += cut; }
          else { fillWall(orig.x0, orig.y1 - cut + 1, orig.x1, orig.y1); R2.y1 -= cut; }
        }
      } else {
        const w = orig.x1 - orig.x0 + 1, target = Math.max(3, w - 2), cut = w - target;
        if (cut > 0) {
          if ((orig.x1 - door[0]) < (door[0] - orig.x0)) { fillWall(orig.x0, orig.y0, orig.x0 + cut - 1, orig.y1); R2.x0 += cut; }
          else { fillWall(orig.x1 - cut + 1, orig.y0, orig.x1, orig.y1); R2.x1 -= cut; }
        }
      }
    }
    // clear the old fixtures, including any the new wall has just covered
    for (const p of pol.props.slice()) {
      if (p.t !== O.BED && p.t !== O.TOILET && p.t !== O.SINK) continue;
      if (p.x < orig.x0 || p.x > orig.x1 || p.y < orig.y0 || p.y > orig.y1) continue;
      W.removeObj(p.x, p.y); pol.props.splice(pol.props.indexOf(p), 1);
    }
    for (let y = R2.y0; y <= R2.y1; y++) for (let x = R2.x0; x <= R2.x1; x++) W.ground[W.idx(x, y)] = G.TILE;
    // a doorway tile inside the trimmed room, kept free so the door still opens into it
    let doorTile = null;
    if (door) {
      if (door[0] === R2.x0 - 1) doorTile = [R2.x0, door[1]];
      else if (door[0] === R2.x1 + 1) doorTile = [R2.x1, door[1]];
      else if (door[1] === R2.y0 - 1) doorTile = [door[0], R2.y0];
      else if (door[1] === R2.y1 + 1) doorTile = [door[0], R2.y1];
    }
    const inb = (x, y) => x >= R2.x0 && x <= R2.x1 && y >= R2.y0 && y <= R2.y1;
    const free = [];
    for (let y = R2.y0; y <= R2.y1; y++) for (let x = R2.x0; x <= R2.x1; x++)
      if (!W.getObj(x, y) && !(doorTile && doorTile[0] === x && doorTile[1] === y)) free.push([x, y]);
    const key = (x, y) => x + ',' + y;
    // A trio of fixtures is only accepted if every one of them can be walked up to from the
    // door - a cot wedged into a corner with walls on two sides cannot be slept in - and if the
    // door still reaches every remaining free tile over unoccupied floor.
    const touches = (occ, x, y) => {
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < R2.x0 || nx > R2.x1 || ny < R2.y0 || ny > R2.y1) continue;
        if (occ.has(key(nx, ny)) || W.getObj(nx, ny)) continue;
        n++;
      }
      return n;
    };
    // The cot needs at least two walkable sides. With only one, the doorway's own prompt wins
    // the focus contest on that single tile and the bed can never be used, which is what
    // happened on the first attempt: the cot sat in a corner and "Open door" always beat
    // "Sleep". Toilet and sink read fine with one side, so they only need one.
    const usable = (occ, spots) => {
      if (touches(occ, spots[0][0], spots[0][1]) < 2) return false;
      for (let i = 1; i < spots.length; i++) if (touches(occ, spots[i][0], spots[i][1]) < 1) return false;
      let start = doorTile && !occ.has(key(doorTile[0], doorTile[1])) ? doorTile : null;
      if (!start) {
        for (const [x, y] of free) if (!occ.has(key(x, y))) { start = [x, y]; break; }
      }
      if (!start) return false;
      const seen = new Set([key(start[0], start[1])]), q = [start];
      while (q.length) {
        const [x, y] = q.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!inb(nx, ny)) continue;
          const k = key(nx, ny);
          if (seen.has(k) || occ.has(k) || W.getObj(nx, ny)) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      for (const [x, y] of free) if (!occ.has(key(x, y)) && !seen.has(key(x, y))) return false;
      return true;
    };
    let trio = null;
    for (let a = 0; a < free.length && !trio; a++)
      for (let c = a + 1; c < free.length && !trio; c++)
        for (let d = c + 1; d < free.length && !trio; d++) {
          const spots = [free[a], free[c], free[d]];
          const occ = new Set(spots.map(s => key(s[0], s[1])));
          if (usable(occ, spots)) trio = spots;
        }
    if (trio) {
      const add = (xy, t, extra) => {
        const o = Object.assign({ t, f: 0, b: pol.id, v: 0 }, extra || {});
        W.setObj(xy[0], xy[1], o); pol.props.push(o);
      };
      add(trio[0], O.BED, { loot: 'cell', prison: true });
      add(trio[1], O.TOILET);
      add(trio[2], O.SINK);
    }
    R2.type = 'cell';
  }
})();
