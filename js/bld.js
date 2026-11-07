/* Dead SectorZ — procedural building interiors (rooms, doors, windows, furniture) */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, O = DSZ.O, G = DSZ.G, W = DSZ.World, D = DSZ.OBJDEF;
  const Bld = DSZ.Bld = {};

  const EXT = ['siding_w', 'siding_b', 'siding_g', 'siding_y', 'siding_r', 'brick_r', 'brick_b', 'stucco'];
  const INT = ['int_cream', 'int_green', 'int_blue', 'int_dark'];
  const ROOF = ['#3a3836', '#4a3430', '#2f3a33', '#40434a', '#4d4237', '#38303a'];
  Bld.EXT = EXT; Bld.ROOF = ROOF;

  function wall(x, y, b, mat, imat, rng) { W.setObj(x, y, { t: O.WALL, mat, imat, v: (rng() * 4) | 0, b: b.id }); }
  function isWallT(t) { return t === O.WALL || t === O.DOOR || t === O.WINDOW || t === O.STORE || t === O.GARAGE; }
  function wallAt(x, y) { const o = W.getObj(x, y); return !!(o && isWallT(o.t)); }

  // a free interior tile with an adjacent wall, outside door clearance
  function ringTiles(b, r) {
    const out = [];
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      if (W.getObj(x, y) || nearDoor(b, x, y)) continue;
      let n = 0, dir = -1;
      if (wallAt(x + 1, y)) { n++; dir = 2; } // wall to the east: front faces west
      if (wallAt(x, y + 1)) { n++; dir = 3; }
      if (wallAt(x - 1, y)) { n++; dir = 0; }
      if (wallAt(x, y - 1)) { n++; dir = 1; }
      if (n > 0) out.push([x, y, dir, n]);
    }
    return out;
  }
  function nearDoor(b, x, y) {
    for (const d of b.doors) if (Math.abs(d[0] - x) <= 1 && Math.abs(d[1] - y) <= 1) return true;
    return false;
  }
  function put(b, r, rng, type, opts) {
    const c = ringTiles(b, r).filter(t => t[3] === 1 || (opts && opts.corner));
    if (!c.length) return null;
    const t = c[(rng() * c.length) | 0];
    const o = Object.assign({ t: type, f: t[2], b: b.id, v: (rng() * 4) | 0 }, opts || {});
    W.setObj(t[0], t[1], o); b.props.push(o);
    return o;
  }
  function putFree(b, r, rng, type, opts) {
    const c = [];
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (!W.getObj(x, y) && !nearDoor(b, x, y)) c.push([x, y]);
    if (!c.length) return null;
    const t = c[(rng() * c.length) | 0];
    const o = Object.assign({ t: type, f: (rng() * 4) | 0, b: b.id, v: (rng() * 4) | 0 }, opts || {});
    W.setObj(t[0], t[1], o); b.props.push(o);
    return o;
  }

  function split(b, r, rng, depth, minSize, out) {
    const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
    const canX = w >= minSize * 2 + 1, canY = h >= minSize * 2 + 1;
    if (depth <= 0 || (!canX && !canY) || (w * h < 26 && rng() < 0.7)) { out.push(r); return; }
    const vertical = canX && (!canY || w >= h ? rng() < 0.8 : rng() < 0.25);
    if (vertical) {
      const s = r.x0 + minSize + ((rng() * (w - minSize * 2)) | 0);
      for (let y = r.y0; y <= r.y1; y++) wall(s, y, b, b.imat, b.imat, rng);
      const dy = r.y0 + 1 + ((rng() * (h - 2)) | 0);
      W.setObj(s, dy, { t: O.DOOR, mat: b.imat, imat: b.imat, v: 0, b: b.id, open: rng() < 0.5, locked: false, inner: true });
      W.refresh(s, dy); b.doors.push([s, dy]);
      split(b, { x0: r.x0, y0: r.y0, x1: s - 1, y1: r.y1 }, rng, depth - 1, minSize, out);
      split(b, { x0: s + 1, y0: r.y0, x1: r.x1, y1: r.y1 }, rng, depth - 1, minSize, out);
    } else {
      const s = r.y0 + minSize + ((rng() * (h - minSize * 2)) | 0);
      for (let x = r.x0; x <= r.x1; x++) wall(x, s, b, b.imat, b.imat, rng);
      const dx = r.x0 + 1 + ((rng() * (w - 2)) | 0);
      W.setObj(dx, s, { t: O.DOOR, mat: b.imat, imat: b.imat, v: 0, b: b.id, open: rng() < 0.5, locked: false, inner: true });
      W.refresh(dx, s); b.doors.push([dx, s]);
      split(b, { x0: r.x0, y0: r.y0, x1: r.x1, y1: s - 1 }, rng, depth - 1, minSize, out);
      split(b, { x0: r.x0, y0: s + 1, x1: r.x1, y1: r.y1 }, rng, depth - 1, minSize, out);
    }
  }

  function floorRect(r, g) { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) W.ground[W.idx(x, y)] = g; }

  Bld.make = function (o) {
    const rng = o.rng, id = W.blds.length;
    const b = {
      id, x: o.x, y: o.y, w: o.w, h: o.h, kind: o.kind, shop: o.shop || null, name: o.name || o.kind, door: o.door,
      mat: o.mat || U.pick(rng, EXT), imat: o.imat || U.pick(rng, INT), roof: o.roof || U.pick(rng, ROOF),
      doors: [], props: [], rooms: [], lit: false, power: false, flat: !!o.flat
    };
    W.blds.push(b);
    const x0 = o.x, y0 = o.y, x1 = o.x + o.w - 1, y1 = o.y + o.h - 1;
    const floorBase = o.floor === undefined ? G.WOOD : o.floor;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = W.idx(x, y); W.room[i] = id; W.ground[i] = floorBase; W.setObj(x, y, null);
    }
    // perimeter
    for (let x = x0; x <= x1; x++) { wall(x, y0, b, b.mat, b.imat, rng); wall(x, y1, b, b.mat, b.imat, rng); }
    for (let y = y0; y <= y1; y++) { wall(x0, y, b, b.mat, b.imat, rng); wall(x1, y, b, b.mat, b.imat, rng); }
    // front door
    let dx, dy;
    if (o.door === 'N' || o.door === 'S') { dx = x0 + 2 + ((rng() * Math.max(1, o.w - 5)) | 0); dy = o.door === 'N' ? y0 : y1; }
    else { dy = y0 + 2 + ((rng() * Math.max(1, o.h - 5)) | 0); dx = o.door === 'W' ? x0 : x1; }
    const locked = o.locked !== undefined ? o.locked : rng() < 0.3;
    W.setObj(dx, dy, { t: o.garage ? O.DOOR : O.DOOR, mat: b.mat, imat: b.imat, v: (rng() * 4) | 0, b: id, open: false, locked, front: true });
    b.doors.push([dx, dy]); b.frontDoor = [dx, dy];
    const inner = { x0: x0 + 1, y0: y0 + 1, x1: x1 - 1, y1: y1 - 1 };

    // layout
    let rooms = [];
    const kind = o.kind;
    if (kind === 'house') {
      split(b, inner, rng, 3, 3, rooms);
    } else if (kind === 'shop' || kind === 'super' || kind === 'diner' || kind === 'gasstore') {
      // sales floor + back room
      const depthDir = o.door;
      let sales, back;
      if (depthDir === 'N') { const s = y0 + Math.max(4, Math.round(o.h * 0.68)); sales = { x0: inner.x0, y0: inner.y0, x1: inner.x1, y1: s - 1 }; back = { x0: inner.x0, y0: s + 1, x1: inner.x1, y1: inner.y1 }; for (let x = inner.x0; x <= inner.x1; x++) wall(x, s, b, b.imat, b.imat, rng); const px = inner.x0 + 1 + ((rng() * (o.w - 4)) | 0); W.setObj(px, s, { t: O.DOOR, mat: b.imat, imat: b.imat, v: 3, b: id, open: false, locked: false, inner: true }); b.doors.push([px, s]); }
      else { const s = y1 - Math.max(4, Math.round(o.h * 0.68)); sales = { x0: inner.x0, y0: s + 1, x1: inner.x1, y1: inner.y1 }; back = { x0: inner.x0, y0: inner.y0, x1: inner.x1, y1: s - 1 }; for (let x = inner.x0; x <= inner.x1; x++) wall(x, s, b, b.imat, b.imat, rng); const px = inner.x0 + 1 + ((rng() * (o.w - 4)) | 0); W.setObj(px, s, { t: O.DOOR, mat: b.imat, imat: b.imat, v: 3, b: id, open: false, locked: false, inner: true }); b.doors.push([px, s]); }
      b.sales = sales; b.back = back;
      rooms = [sales, back]; sales.type = 'sales'; back.type = 'back';
    } else if (kind === 'police' || kind === 'hospital') {
      split(b, inner, rng, 3, 4, rooms);
    } else if (kind === 'warehouse') {
      rooms = [inner]; inner.type = 'warehouse';
      // small office in a corner
      const ox = inner.x0, oy = o.door === 'N' ? inner.y1 - 4 : inner.y0;
      for (let x = ox; x <= ox + 5; x++) wall(x, o.door === 'N' ? oy : oy + 4, b, b.imat, b.imat, rng);
      for (let y = oy; y <= oy + 4; y++) wall(ox + 5, y, b, b.imat, b.imat, rng);
      const ddx = ox + 2, ddy = o.door === 'N' ? oy : oy + 4;
      W.setObj(ddx, ddy, { t: O.DOOR, mat: b.imat, imat: b.imat, v: 3, b: id, open: false, locked: rng() < 0.5, inner: true }); b.doors.push([ddx, ddy]);
      b.office = { x0: ox, y0: oy + (o.door === 'N' ? 1 : 0), x1: ox + 4, y1: oy + (o.door === 'N' ? 3 : 3), type: 'office' };
    } else if (kind === 'church') {
      rooms = [inner]; inner.type = 'church';
    } else {
      split(b, inner, rng, 2, 3, rooms);
    }
    b.rooms = rooms;

    // windows on exterior walls
    const wk = (kind === 'shop' || kind === 'super' || kind === 'diner' || kind === 'gasstore') ? 'front' : 'normal';
    const sidesDone = [];
    function tryWin(x, y, front) {
      const w = W.getObj(x, y);
      if (!w || w.t !== O.WALL) return;
      for (const d of b.doors) if (Math.abs(d[0] - x) + Math.abs(d[1] - y) <= 1) return;
      // must be straight wall segment and not meet a partition wall
      const h = wallAt(x - 1, y) && wallAt(x + 1, y), v = wallAt(x, y - 1) && wallAt(x, y + 1);
      if (!(h ^ v)) return;
      if (h) { const iy = y === y0 ? y + 1 : y - 1; if (wallAt(x, iy)) return; if (wallAt(x - 1, iy) || wallAt(x + 1, iy)) { /* ok */ } }
      else { const ix = x === x0 ? x + 1 : x - 1; if (wallAt(ix, y)) return; }
      const kindT = front ? O.STORE : O.WINDOW;
      w.t = kindT; w.v = front ? ((rng() * 8) | 0) : ((rng() < 0.18 ? 1 : (rng() < 0.2 ? 2 : 0)));
      w.hp = D[kindT].hp; W.refresh(x, y);
    }
    for (let x = x0 + 2; x <= x1 - 2; x++) {
      const front = wk === 'front' && o.door === 'N' ? 'N' : wk === 'front' && o.door === 'S' ? 'S' : '';
      if ((x - x0) % 3 === 1 || front) { tryWin(x, y0, front === 'N'); }
      if ((x - x0) % 3 === 1 || front) { tryWin(x, y1, front === 'S'); }
    }
    if (kind !== 'warehouse') for (let y = y0 + 2; y <= y1 - 2; y++) {
      if ((y - y0) % 3 === 1) { tryWin(x0, y, false); tryWin(x1, y, false); }
    }

    // interior content
    Bld.furnish(b, rooms, rng, o);
    // roof boundaries
    return b;
  };

  Bld.furnish = function (b, rooms, rng, o) {
    const kind = b.kind;
    if (kind === 'house') {
      rooms.forEach(r => r.area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1));
      const sorted = rooms.slice().sort((a, c) => c.area - a.area);
      sorted.forEach((r, i) => {
        if (i === 0) r.type = 'living'; else if (i === 1) r.type = 'kitchen'; else if (i === sorted.length - 1 && sorted.length > 3) r.type = 'bath'; else r.type = 'bed';
      });
      for (const r of rooms) {
        const t = r.type;
        if (t === 'living') { floorRect(r, rng() < 0.5 ? G.WOOD : G.CARPET); put(b, r, rng, O.COUCH, { loot: 'living' }); put(b, r, rng, O.TV); put(b, r, rng, O.BOOKSHELF, { loot: 'books' }); putFree(b, r, rng, O.TABLE); if (rng() < 0.6) put(b, r, rng, O.BOOKSHELF, { loot: 'books' }); }
        else if (t === 'kitchen') { floorRect(r, G.LINO); put(b, r, rng, O.FRIDGE, { loot: 'fridge' }); put(b, r, rng, O.KCAB, { loot: 'kitchen' }); put(b, r, rng, O.KCAB, { loot: 'kitchen' }); put(b, r, rng, O.COUNTER, { loot: 'kitchen' }); put(b, r, rng, O.SINK); if (rng() < 0.7) putFree(b, r, rng, O.TABLE); if (rng() < 0.7) putFree(b, r, rng, O.CHAIR); }
        else if (t === 'bath') { floorRect(r, G.TILE); put(b, r, rng, O.TOILET); put(b, r, rng, O.SINK); put(b, r, rng, O.MEDCAB, { loot: 'medical' }); }
        else { floorRect(r, G.CARPET); put(b, r, rng, O.BED, { loot: 'bedroom' }); put(b, r, rng, O.WARDROBE, { loot: 'clothes' }); if (rng() < 0.5) put(b, r, rng, O.DESK, { loot: 'office' }); if (rng() < 0.4) put(b, r, rng, O.CRATE, { loot: 'attic' }); }
      }
    } else if (kind === 'shop' || kind === 'super' || kind === 'diner' || kind === 'gasstore') {
      const s = b.sales, bk = b.back, st = b.shop || 'general';
      floorRect(s, kind === 'diner' ? G.LINO : G.TILE); floorRect(bk, G.CONC_IN);
      const loot = ({ grocery: 'grocery', pharmacy: 'pharmacy', hardware: 'hardware', clothing: 'clothing', guns: 'guns', general: 'store', diner: 'kitchen', gas: 'gas', electronics: 'electronics' })[st] || 'store';
      if (kind === 'diner') {
        put(b, s, rng, O.COUNTER, { loot: 'kitchen' }); put(b, s, rng, O.FRIDGE, { loot: 'fridge' }); put(b, s, rng, O.KCAB, { loot: 'kitchen' });
        for (let i = 0; i < 4; i++) { const t = putFree(b, s, rng, O.TABLE); if (t) { W.setObj(t.x + 1, t.y, W.getObj(t.x + 1, t.y) || { t: O.CHAIR, f: 2, b: b.id, v: 0 }); } }
      } else {
        // shelf rows with aisles
        const hor = true;
        const y0 = s.y0 + 1, y1 = s.y1 - 1;
        const dz = b.frontDoor;
        for (let y = (b.door === 'N' ? s.y0 + 2 : s.y0 + 1); y <= s.y1 - 1; y += 3) {
          for (let x = s.x0 + 1; x <= s.x1 - 1; x++) {
            if (Math.abs(x - dz[0]) <= 1 && Math.abs(y - dz[1]) < 4) continue;
            if ((x - s.x0) % 5 === 4) continue;
            if (W.getObj(x, y) || nearDoor(b, x, y)) continue;
            if (rng() < 0.9) { const o2 = { t: O.SHELF, f: b.door === 'N' ? 1 : 3, b: b.id, v: (rng() * 4) | 0, loot }; W.setObj(x, y, o2); b.props.push(o2); }
          }
        }
        // checkout near front
        const cx = Math.min(s.x1, Math.max(s.x0, dz[0] + 2)), cy = b.door === 'N' ? s.y0 : s.y1;
        if (!W.getObj(cx, cy)) { const c = { t: O.CHECKOUT, f: 1, b: b.id, v: 0, loot: 'register' }; W.setObj(cx, cy, c); b.props.push(c); }
      }
      // back room
      for (let i = 0; i < 3 + ((rng() * 3) | 0); i++) put(b, bk, rng, O.CRATE, { loot: loot === 'guns' ? 'guns' : 'storage' });
      put(b, bk, rng, O.LOCKER, { loot: 'locker' }); if (rng() < 0.5) put(b, bk, rng, O.DESK, { loot: 'office' });
    } else if (kind === 'police') {
      rooms.forEach(r => r.area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1));
      const sorted = rooms.slice().sort((a, c) => c.area - a.area);
      sorted.forEach((r, i) => { r.type = i === 0 ? 'lobby' : (i === 1 ? 'armory' : (i % 2 ? 'office' : 'cells')); });
      for (const r of rooms) {
        floorRect(r, G.LINO);
        if (r.type === 'lobby') { put(b, r, rng, O.DESK, { loot: 'police' }); putFree(b, r, rng, O.CHAIR); putFree(b, r, rng, O.CHAIR); put(b, r, rng, O.BENCH); }
        else if (r.type === 'armory') { for (let i = 0; i < 3; i++) put(b, r, rng, O.LOCKER, { loot: 'armory' }); put(b, r, rng, O.CRATE, { loot: 'armory' }); }
        else if (r.type === 'office') { put(b, r, rng, O.DESK, { loot: 'police' }); put(b, r, rng, O.DESK, { loot: 'office' }); put(b, r, rng, O.LOCKER, { loot: 'locker' }); }
        else { put(b, r, rng, O.BED, { loot: 'cell' }); put(b, r, rng, O.TOILET); }
      }
    } else if (kind === 'hospital') {
      rooms.forEach(r => r.area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1));
      const sorted = rooms.slice().sort((a, c) => c.area - a.area);
      sorted.forEach((r, i) => { r.type = i === 0 ? 'waiting' : (i === 1 ? 'pharmacy' : 'ward'); });
      for (const r of rooms) {
        floorRect(r, G.TILE);
        if (r.type === 'waiting') { put(b, r, rng, O.BENCH); put(b, r, rng, O.BENCH); put(b, r, rng, O.DESK, { loot: 'office' }); put(b, r, rng, O.MEDCAB, { loot: 'medical' }); }
        else if (r.type === 'pharmacy') { for (let i = 0; i < 3; i++) put(b, r, rng, O.MEDCAB, { loot: 'hospital' }); put(b, r, rng, O.SHELF, { loot: 'pharmacy' }); put(b, r, rng, O.FRIDGE, { loot: 'hospital' }); }
        else { put(b, r, rng, O.BED, { loot: 'ward' }); if (rng() < 0.6) put(b, r, rng, O.BED, { loot: 'ward' }); put(b, r, rng, O.MEDCAB, { loot: 'medical' }); put(b, r, rng, O.SINK); }
      }
    } else if (kind === 'warehouse') {
      const r = rooms[0]; floorRect(r, G.CONC_IN);
      if (b.office) { floorRect(b.office, G.LINO); put(b, b.office, rng, O.DESK, { loot: 'office' }); put(b, b.office, rng, O.LOCKER, { loot: 'locker' }); }
      for (let i = 0; i < 16; i++) putFree(b, r, rng, rng() < 0.5 ? O.CRATE : (rng() < 0.5 ? O.PALLET : O.BARREL), { loot: 'industrial' });
      for (let i = 0; i < 4; i++) put(b, r, rng, O.SHELF, { loot: 'industrial' });
      put(b, r, rng, O.WORKBENCH, { loot: 'tools' }); put(b, r, rng, O.GENERATOR);
    } else if (kind === 'church') {
      const r = rooms[0]; floorRect(r, G.WOOD);
      for (let y = r.y0 + 2; y <= r.y1 - 3; y += 2) for (let x = r.x0 + 1; x <= r.x1 - 1; x++) { if (Math.abs(x - (r.x0 + r.x1) / 2) < 1.5) continue; if (!W.getObj(x, y) && !nearDoor(b, x, y)) W.setObj(x, y, { t: O.BENCH, f: 1, b: b.id, v: 0 }); }
      put(b, r, rng, O.CRATE, { loot: 'church' }); put(b, r, rng, O.WARDROBE, { loot: 'church' });
    } else {
      for (const r of rooms) { r.type = 'office'; floorRect(r, G.CARPET); put(b, r, rng, O.DESK, { loot: 'office' }); put(b, r, rng, O.LOCKER, { loot: 'locker' }); }
    }
    for (const r of rooms) if (r.type) b.rooms.push && 0;
  };

  // pick random free interior tile (for zombie spawns)
  Bld.randomInterior = function (b, rng) {
    for (let k = 0; k < 40; k++) {
      const x = b.x + 1 + ((rng() * (b.w - 2)) | 0), y = b.y + 1 + ((rng() * (b.h - 2)) | 0);
      if (!W.isSolid(x, y)) return [x + 0.5, y + 0.5];
    }
    return null;
  };
})();
