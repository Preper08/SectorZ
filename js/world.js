/* Dead SectorZ — world grid, object definitions, collision and line-of-sight */
(function () {
  'use strict';
  const DSZ = window.DSZ, C = DSZ.C, U = DSZ.U;

  const O = DSZ.O = {
    NONE: 0, WALL: 1, DOOR: 2, WINDOW: 3, STORE: 4, GARAGE: 5,
    FENCE: 6, FENCE_CL: 7, TREE_PINE: 8, TREE_OAK: 9, TREE_DEAD: 10, BUSH: 11, ROCK: 12,
    CRATE: 13, SHELF: 14, FRIDGE: 15, KCAB: 16, BED: 17, TABLE: 18, CHAIR: 19, COUCH: 20, WARDROBE: 21, TOILET: 22,
    COUNTER: 23, DUMPSTER: 24, STREETLAMP: 25, TRAFFIC: 26, BARREL: 27, LOCKER: 28, DESK: 29, MEDCAB: 30, BENCH: 31,
    GENERATOR: 32, SIGN: 33, HYDRANT: 34, MAILBOX: 35, BARRIER: 36, TV: 37, SINK: 38, BOOKSHELF: 39, WORKBENCH: 40,
    TRASHCAN: 42, PILLAR: 43, CHECKOUT: 44, PALLET: 45, CONTAINER: 46, GRAVE: 47, TENT: 48, WRECKFIRE: 49,
    BWALL_W: 50, BWALL_M: 51, BDOOR: 52, BWINDOW: 53, BSTORAGE: 54, BWORKBENCH: 55, BFIRE: 56, BBED: 57, BLAMP: 58, BFENCE: 59, BGATE: 60, BBARR: 61, BRAIN: 62, BFURNACE: 63
  };

  // solid: blocks movement, opaque: blocks sight, h: visual height px, cont: container size [w,h] + loot table
  const D = DSZ.OBJDEF = [];
  function def(id, name, o) { D[id] = Object.assign({ name, solid: true, opaque: false, h: 30, hp: 100 }, o); }
  def(O.WALL, 'Wall', { opaque: true, wall: true, h: 92, hp: 400 });
  def(O.DOOR, 'Door', { opaque: true, wall: true, door: true, h: 92, hp: 140 });
  def(O.WINDOW, 'Window', { wall: true, h: 92, hp: 30, window: true });
  def(O.STORE, 'Storefront', { wall: true, h: 92, hp: 60, window: true });
  def(O.GARAGE, 'Garage door', { opaque: true, wall: true, h: 92, hp: 300 });
  def(O.FENCE, 'Fence', { h: 34, hp: 80, low: true, fence: true });
  def(O.FENCE_CL, 'Chainlink fence', { h: 38, hp: 120, low: true, fence: true });
  def(O.TREE_PINE, 'Pine', { h: 150, hp: 400, tall: true, opaque: true, tree: true });
  def(O.TREE_OAK, 'Oak', { h: 140, hp: 400, tall: true, opaque: true, tree: true });
  def(O.TREE_DEAD, 'Dead tree', { h: 110, hp: 300, tall: true, tree: true });
  def(O.BUSH, 'Bush', { solid: false, h: 22, hp: 20, bush: true });
  def(O.ROCK, 'Boulder', { h: 28, hp: 999 });
  def(O.CRATE, 'Crate', { h: 30, cont: { w: 6, h: 4, loot: 'crate', name: 'Crate' } });
  def(O.SHELF, 'Shelf', { h: 62, cont: { w: 7, h: 4, loot: 'store', name: 'Shelves' } });
  def(O.FRIDGE, 'Fridge', { h: 64, cont: { w: 5, h: 4, loot: 'fridge', name: 'Fridge' } });
  def(O.KCAB, 'Kitchen cabinet', { h: 40, cont: { w: 5, h: 3, loot: 'kitchen', name: 'Cabinet' } });
  def(O.BED, 'Bed', { solid: true, h: 24, cont: { w: 5, h: 3, loot: 'bedroom', name: 'Under the bed' }, bed: true });
  def(O.TABLE, 'Table', { h: 26 });
  def(O.CHAIR, 'Chair', { solid: false, h: 22 });
  def(O.COUCH, 'Couch', { h: 26, cont: { w: 4, h: 3, loot: 'living', name: 'Couch' } });
  def(O.WARDROBE, 'Wardrobe', { h: 66, cont: { w: 6, h: 4, loot: 'clothes', name: 'Wardrobe' } });
  def(O.TOILET, 'Toilet', { h: 22, solid: false });
  def(O.COUNTER, 'Counter', { h: 34, cont: { w: 5, h: 3, loot: 'kitchen', name: 'Counter' } });
  def(O.DUMPSTER, 'Dumpster', { h: 44, cont: { w: 6, h: 4, loot: 'trash', name: 'Dumpster' } });
  def(O.STREETLAMP, 'Street lamp', { h: 120, hp: 200, light: true, thin: true });
  def(O.TRAFFIC, 'Traffic light', { h: 120, hp: 200, thin: true });
  def(O.BARREL, 'Barrel', { h: 34, cont: { w: 4, h: 3, loot: 'industrial', name: 'Barrel' } });
  def(O.LOCKER, 'Locker', { h: 66, cont: { w: 4, h: 4, loot: 'locker', name: 'Locker' } });
  def(O.DESK, 'Desk', { h: 28, cont: { w: 5, h: 3, loot: 'office', name: 'Desk' } });
  def(O.MEDCAB, 'Medicine cabinet', { h: 56, cont: { w: 5, h: 3, loot: 'medical', name: 'Medicine cabinet' } });
  def(O.BENCH, 'Bench', { solid: false, h: 20 });
  def(O.GENERATOR, 'Generator', { h: 34 });
  def(O.SIGN, 'Sign', { solid: false, h: 70, thin: true });
  def(O.HYDRANT, 'Hydrant', { h: 26, thin: true });
  def(O.MAILBOX, 'Mailbox', { h: 30, thin: true, cont: { w: 3, h: 2, loot: 'mail', name: 'Mailbox' } });
  def(O.BARRIER, 'Barrier', { h: 30, hp: 600 });
  def(O.TV, 'TV', { h: 26 });
  def(O.SINK, 'Sink', { h: 32, solid: true });
  def(O.BOOKSHELF, 'Bookshelf', { h: 66, cont: { w: 6, h: 3, loot: 'books', name: 'Bookshelf' } });
  def(O.WORKBENCH, 'Workbench', { h: 32, cont: { w: 6, h: 3, loot: 'tools', name: 'Workbench' } });
  def(O.TRASHCAN, 'Trash can', { h: 28, solid: true, cont: { w: 3, h: 3, loot: 'trash', name: 'Trash can' } });
  def(O.PILLAR, 'Pillar', { h: 92, opaque: true, hp: 999 });
  def(O.CHECKOUT, 'Checkout', { h: 32, cont: { w: 4, h: 2, loot: 'register', name: 'Register' } });
  def(O.PALLET, 'Pallet', { h: 24, solid: false });
  def(O.CONTAINER, 'Shipping container', { h: 64, opaque: true, hp: 999 });
  def(O.GRAVE, 'Grave', { h: 18, solid: false });
  def(O.TENT, 'Tent', { h: 44 });
  def(O.WRECKFIRE, 'Burning barrel', { h: 34, light: true, fire: true });
  // base building
  def(O.BWALL_W, 'Wood wall', { opaque: true, wall: true, base: true, h: 92, hp: 300 });
  def(O.BWALL_M, 'Metal wall', { opaque: true, wall: true, base: true, h: 92, hp: 800 });
  def(O.BDOOR, 'Base door', { opaque: true, wall: true, base: true, door: true, h: 92, hp: 350 });
  def(O.BWINDOW, 'Barricaded window', { wall: true, base: true, window: true, h: 92, hp: 220 });
  def(O.BSTORAGE, 'Storage chest', { base: true, h: 30, hp: 200, cont: { w: 8, h: 6, loot: null, name: 'Storage chest' } });
  def(O.BWORKBENCH, 'Workbench', { base: true, h: 34, hp: 200, station: 'bench' });
  def(O.BFIRE, 'Campfire', { base: true, h: 18, hp: 80, solid: false, light: true, fire: true, station: 'fire' });
  def(O.BBED, 'Bed', { base: true, h: 22, hp: 100, bed: true, solid: false });
  def(O.BLAMP, 'Lamp post', { base: true, h: 70, hp: 80, light: true, thin: true });
  def(O.BFENCE, 'Wood fence', { base: true, h: 38, hp: 180, low: true, fence: true });
  def(O.BGATE, 'Gate', { base: true, h: 38, hp: 220, low: true, fence: true, door: true });
  def(O.BBARR, 'Spike barricade', { base: true, h: 24, hp: 160, low: true, spikes: true });
  def(O.BRAIN, 'Rain collector', { base: true, h: 34, hp: 80, station: 'rain', cont: { w: 3, h: 2, loot: null, name: 'Rain collector' } });
  def(O.BFURNACE, 'Furnace', { base: true, h: 40, hp: 240, light: true, fire: true, station: 'furnace' });

  const W = DSZ.World = {
    w: C.W, h: C.H, ground: null, obj: null, solid: null, opaque: null, room: null, blds: [], lights: [], cars: [], drops: [],
    seed: 1, roads: null,
    init(seed) {
      const n = this.w * this.h;
      this.seed = seed;
      this.ground = new Uint8Array(n); this.obj = new Array(n).fill(null);
      this.solid = new Uint8Array(n); this.opaque = new Uint8Array(n); this.room = new Uint16Array(n);
      this.roadMask = new Uint8Array(n); // 1 = road (cars may drive), 2 = intersection/lines helper
      this.blds = [null]; this.lights = []; this.cars = []; this.drops = []; this.removed = [];
      this.fade = new Float32Array(n);
    },
    idx(x, y) { return y * this.w + x; },
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; },
    getObj(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? null : this.obj[y * this.w + x]; },
    isSolid(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? true : this.solid[y * this.w + x] === 1; },
    isOpaque(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? true : this.opaque[y * this.w + x] === 1; },
    refresh(x, y) {
      const i = y * this.w + x, o = this.obj[i];
      if (!o) { this.solid[i] = 0; this.opaque[i] = 0; return; }
      const d = D[o.t];
      const open = (d.door && o.open);
      this.solid[i] = (d.solid && !open && !o.broken) ? 1 : 0;
      this.opaque[i] = (d.opaque && !open) ? 1 : 0;
      if (o.broken && d.window) this.solid[i] = 0;
    },
    setObj(x, y, o) {
      if (!this.inb(x, y)) return;
      if (o) { o.x = x; o.y = y; if (o.hp === undefined) o.hp = D[o.t].hp; o.maxhp = o.maxhp || o.hp; }
      this.obj[y * this.w + x] = o;
      this.refresh(x, y);
    },
    removeObj(x, y) {
      const o = this.getObj(x, y);
      if (!o) return;
      if (o.light) this.removeLight(o.light);
      if (!o.base) (this.removed || (this.removed = [])).push(y * this.w + x);
      this.obj[y * this.w + x] = null; this.refresh(x, y);
    },
    addLight(l) { this.lights.push(l); return l; },
    removeLight(l) { const i = this.lights.indexOf(l); if (i >= 0) this.lights.splice(i, 1); },
    groundAt(x, y) { return this.inb(x, y) ? this.ground[y * this.w + x] : DSZ.G.FOREST; },
    buildingAt(x, y) { return this.inb(x, y) ? this.blds[this.room[y * this.w + x]] || null : null; },

    // circle-vs-tile collision: returns true if circle overlaps any solid tile
    hitCircle(px, py, r) {
      const x0 = Math.floor(px - r), x1 = Math.floor(px + r), y0 = Math.floor(py - r), y1 = Math.floor(py + r);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!this.isSolid(tx, ty)) continue;
        const cx = U.clamp(px, tx, tx + 1), cy = U.clamp(py, ty, ty + 1), dx = px - cx, dy = py - cy;
        if (dx * dx + dy * dy < r * r) return true;
      }
      return false;
    },
    // move circle with axis-separated sliding. returns {x,y,hitX,hitY}
    moveCircle(px, py, dx, dy, r) {
      let nx = px + dx, hx = false, hy = false;
      if (this.hitCircle(nx, py, r)) { nx = px; hx = true; }
      let ny = py + dy;
      if (this.hitCircle(nx, ny, r)) { ny = py; hy = true; }
      return { x: nx, y: ny, hitX: hx, hitY: hy };
    },
    // DDA raycast. returns distance to first opaque tile hit, or null if clear to max. (origin tile ignored)
    raycast(x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      if (len < 1e-6) return null;
      const rx = dx / len, ry = dy / len;
      let mx = Math.floor(x0), my = Math.floor(y0);
      const sx = rx > 0 ? 1 : -1, sy = ry > 0 ? 1 : -1;
      const tdx = rx === 0 ? 1e30 : Math.abs(1 / rx), tdy = ry === 0 ? 1e30 : Math.abs(1 / ry);
      let tmx = rx === 0 ? 1e30 : ((rx > 0 ? mx + 1 - x0 : x0 - mx) * tdx);
      let tmy = ry === 0 ? 1e30 : ((ry > 0 ? my + 1 - y0 : y0 - my) * tdy);
      let t = 0;
      while (t < len) {
        if (tmx < tmy) { t = tmx; tmx += tdx; mx += sx; } else { t = tmy; tmy += tdy; my += sy; }
        if (t >= len) break;
        if (this.isOpaque(mx, my)) return t;
      }
      return null;
    },
    los(x0, y0, x1, y1) { return this.raycast(x0, y0, x1, y1) === null; },
    // same as raycast but blocks on SOLID tiles (for bullets: windows/fences block movement but not sight)
    raycastSolid(x0, y0, x1, y1, ignoreLow) {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      if (len < 1e-6) return null;
      const rx = dx / len, ry = dy / len;
      let mx = Math.floor(x0), my = Math.floor(y0);
      const sx = rx > 0 ? 1 : -1, sy = ry > 0 ? 1 : -1;
      const tdx = rx === 0 ? 1e30 : Math.abs(1 / rx), tdy = ry === 0 ? 1e30 : Math.abs(1 / ry);
      let tmx = rx === 0 ? 1e30 : ((rx > 0 ? mx + 1 - x0 : x0 - mx) * tdx);
      let tmy = ry === 0 ? 1e30 : ((ry > 0 ? my + 1 - y0 : y0 - my) * tdy);
      let t = 0;
      while (t < len) {
        if (tmx < tmy) { t = tmx; tmx += tdx; mx += sx; } else { t = tmy; tmy += tdy; my += sy; }
        if (t >= len) break;
        if (this.isSolid(mx, my)) {
          const o = this.getObj(mx, my);
          if (ignoreLow && o && D[o.t].low) continue;
          return { t, tx: mx, ty: my };
        }
      }
      return null;
    },
    // building footprint test
    insideBuilding(x, y) { const tx = Math.floor(x), ty = Math.floor(y); return this.inb(tx, ty) && this.room[ty * this.w + tx] > 0; },
    // nearest free tile around a point (used for spawns)
    freeNear(x, y, maxr) {
      for (let r = 0; r <= maxr; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy;
        if (!this.isSolid(tx, ty)) return [tx + 0.5, ty + 0.5];
      }
      return [x, y];
    }
  };

  // visibility fan: fills dist[] with distance (0..range) for each ray between a0..a1
  W.fan = function (ox, oy, range, a0, a1, n, dist) {
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i / (n - 1 || 1));
      const ex = ox + Math.cos(a) * range, ey = oy + Math.sin(a) * range;
      const t = W.raycast(ox, oy, ex, ey);
      dist[i] = t === null ? range : Math.min(range, t + 0.12);
    }
    return dist;
  };
})();
