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
  // Only the tiles directly in front of or behind a door are passage tiles. A piece diagonal to
  // a doorway still leaves the door usable, and repair needs those diagonal tiles when a room is
  // narrow. Placement keeps the wider clearance; repair uses this tighter test.
  function blocksDoor(b, x, y) {
    for (const d of b.doors) if (Math.abs(d[0] - x) + Math.abs(d[1] - y) === 1) return true;
    return false;
  }
  // ---------------------------------------------------------------- prop placement
  // Placement deliberately keeps its original random draws. Rejecting a tile here would change
  // how many draws later pieces (and later buildings) consume, which reshuffles the whole town,
  // so pieces that end up unreachable are repaired after generation instead (see repairProps).
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

  // ---------------------------------------------------------------- interaction repair
  // Interaction needs a walkable tile beside a piece: findFocus reaches 1.7 tiles from the
  // centre, so a diagonal neighbour counts too. Furniture is placed wall-first and then filled
  // in, and in a two-tile-deep room that can seal the middle pieces in - the tile in front of
  // one piece is the next piece's tile. A closer neighbour can also steal the prompt for good.
  // Placement keeps its original draws, so instead of rejecting a piece we repair afterwards:
  // an interactive piece with no usable approach is moved to a free tile in the same room, or
  // removed if the room has no usable spot left.
  const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const AROUND = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  // the side a wall sits on, matching ringTiles: 0 west, 1 north, 2 east, 3 south
  const WALL_SIDE = [[-1, 0], [0, -1], [1, 0], [0, 1]];
  function isInteractive(t) {
    const d = D[t];
    return !!(d && (d.cont || d.bed || d.station === 'fire' || d.station === 'furnace' || t === O.TV || t === O.SINK || t === O.BRAIN));
  }
  function freeAt(x, y) { return W.inb(x, y) && !W.getObj(x, y) && !W.isSolid(x, y); }
  function tileKey(x, y) { return x + ',' + y; }
  function approachIn(reach, x, y) {
    for (const d of AROUND) if (reach.has(tileKey(x + d[0], y + d[1]))) return true;
    return false;
  }
  // Free tiles a walking player can reach inside a building. Doors count as passable even when
  // closed, since the player can open them. Movement is orthogonal because a body cannot squeeze
  // through the zero-width gap between two diagonally touching solid tiles.
  function reachableSet(b) {
    const seen = new Set(), reach = new Set(), q = [];
    const inb = (x, y) => x >= b.x && x <= b.x + b.w - 1 && y >= b.y && y <= b.y + b.h - 1;
    const passable = (x, y) => { if (!inb(x, y)) return false; const o = W.getObj(x, y); return o ? (!!D[o.t].door || !D[o.t].solid) : !W.isSolid(x, y); };
    const push = (x, y) => {
      const k = tileKey(x, y); if (seen.has(k)) return; seen.add(k);
      const o = W.getObj(x, y);
      if (!o || !D[o.t].door) reach.add(k);
      q.push([x, y]);
    };
    for (const d of b.doors) for (const n of ORTHO) { const x = d[0] + n[0], y = d[1] + n[1]; if (passable(x, y)) push(x, y); }
    while (q.length) {
      const [x, y] = q.pop();
      for (const n of ORTHO) { const nx = x + n[0], ny = y + n[1]; if (passable(nx, ny)) push(nx, ny); }
    }
    return reach;
  }
  function roomOf(b, x, y) {
    for (const r of b.rooms) if (r && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r;
    return null;
  }
  // The wall side a piece would lean against at (x, y), or -1 when it stands free.
  function wallSideAt(x, y, prefer) {
    if (prefer >= 0) { const d = WALL_SIDE[prefer]; if (wallAt(x + d[0], y + d[1])) return prefer; }
    for (let f = 0; f < 4; f++) { const d = WALL_SIDE[f]; if (wallAt(x + d[0], y + d[1])) return f; }
    return -1;
  }
  // Moving one piece must not take the last reachable neighbour from a piece that had one.
  function preserves(b, before, after, skip) {
    for (const o of b.props) {
      if (o === skip || !D[o.t].solid || !isInteractive(o.t)) continue;
      if (approachIn(before, o.x, o.y) && !approachIn(after, o.x, o.y)) return false;
    }
    return true;
  }
  // Reachability alone is not enough: a closer container or door can steal the interaction
  // prompt for good. The player is not glued to tile centres though - standing near the edge of
  // a tile changes the distances and often makes the intended piece win again. Sample a few
  // legal positions in each reachable tile and check that the piece can actually win the prompt
  // from at least one of them, using findFocus's distance/angle scoring. Transient competitors
  // (drops, zombies, cars) are ignored; they move.
  const SAMPLE = [0.1, 0.35, 0.65, 0.9];
  function focusWins(reach, qx, qy, self) {
    const cx = qx + 0.5, cy = qy + 0.5, range = self.t === O.SINK ? 1.5 : 1.7;
    for (let ty = qy - 2; ty <= qy + 2; ty++) for (let tx = qx - 2; tx <= qx + 2; tx++) {
      if (!reach.has(tileKey(tx, ty))) continue;
      for (const oy of SAMPLE) for (const ox of SAMPLE) {
        const px = tx + ox, py = ty + oy;
        if (W.hitCircle(px, py, 0.27)) continue;
        const dq = Math.hypot(cx - px, cy - py);
        if (dq > range) continue;
        const aim = Math.atan2(cy - py, cx - px);
        let wins = true;
        for (let y = Math.floor(py) - 2; y <= Math.floor(py) + 2 && wins; y++) for (let x = Math.floor(px) - 2; x <= Math.floor(px) + 2; x++) {
          const o = W.getObj(x, y);
          if (!o || o === self) continue;
          const d = D[o.t], ox2 = x + 0.5, oy2 = y + 0.5;
          const dr = Math.hypot(ox2 - px, oy2 - py);
          const door = d.door, r = door ? 1.9 : (o.t === O.SINK ? 1.5 : (d.bed || d.cont || o.t === O.TV || o.t === O.BRAIN ? 1.7 : (d.station === 'fire' || d.station === 'furnace' ? 1.8 : o.pump ? 1.6 : 0)));
          if (!r || dr > r) continue;
          const a = Math.abs(U.angDiff(aim, Math.atan2(oy2 - py, ox2 - px)));
          if (dr + (dr > 0.9 ? a * 0.5 : 0) + (door ? 0.2 : (o.t === O.TV || o.t === O.COMPUTERDESK ? -0.1 : 0)) < dq) { wins = false; break; }
        }
        if (wins) return true;
      }
    }
    return false;
  }
  function relocate(b, o, banned) {
    const room = roomOf(b, o.x, o.y) || { x0: b.x + 1, y0: b.y + 1, x1: b.x + b.w - 2, y1: b.y + b.h - 2 };
    const oldF = o.f, oldX = o.x, oldY = o.y;
    const wallMounted = wallSideAt(oldX, oldY, oldF) === oldF;
    W.setObj(oldX, oldY, null);                        // the old tile is free while we search
    const before = reachableSet(b);
    const wall = [], free = [];
    for (let y = room.y0; y <= room.y1; y++) for (let x = room.x0; x <= room.x1; x++) {
      if ((x === oldX && y === oldY) || !freeAt(x, y) || blocksDoor(b, x, y)) continue;
      if (banned && banned.has(tileKey(x, y))) continue;
      const side = wallSideAt(x, y, wallMounted ? oldF : -1);
      (side >= 0 ? wall : free).push([x, y, side]);
    }
    // Prefer the wall the piece used to lean on, then any other wall, then open floor.
    const order = [];
    if (wallMounted) for (const c of wall) if (c[2] === oldF) order.push(c);
    if (wallMounted) for (const c of wall) if (c[2] !== oldF) order.push(c);
    for (const c of free) order.push(c);
    for (const c of wall) if (!order.includes(c)) order.push(c);
    for (const c of order) {
      o.f = c[2] >= 0 ? c[2] : oldF;
      W.setObj(c[0], c[1], o);
      const after = reachableSet(b);
      if (approachIn(after, c[0], c[1]) && focusWins(after, c[0], c[1], o) && preserves(b, before, after, o)) return true;
      W.setObj(c[0], c[1], null);
    }
    // Nowhere usable: the piece has to go, or it would be a container that can never be opened.
    const i = b.props.indexOf(o); if (i >= 0) b.props.splice(i, 1);
    return false;
  }
  // Move or remove every interactive piece that cannot actually be used from any reachable tile.
  Bld.repairProps = function (spawns) {
    const banned = new Set();
    if (spawns) for (const z of spawns) banned.add(tileKey(Math.floor(z[0]), Math.floor(z[1])));
    for (const b of W.blds) {
      if (!b) continue;
      for (let pass = 0; pass < 8; pass++) {
        let changed = 0;
        for (const o of b.props.slice()) {
          if (!D[o.t].solid || !isInteractive(o.t)) continue;
          const reach = reachableSet(b);
          if (approachIn(reach, o.x, o.y) && focusWins(reach, o.x, o.y, o)) continue;
          relocate(b, o, banned); changed++;
        }
        if (!changed) break;
      }
    }
  };

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

  // A door must connect the two spaces on either side of the wall it sits in. The recursive
  // room split can drop a perpendicular partition right against a door, box the door in, or
  // even line up several doors into a dead stack. For any door with no clear opposite pair,
  // remove ONE blocking neighbour so it always leads somewhere. Only this building's own
  // interior wall or a redundant interior door is removed - never a perimeter wall or the
  // front door - so the building envelope and its entrance are preserved.
  function repairDoors(b) {
    const passable = (x, y) => { const S = (ax, ay) => W.isSolid(ax, ay); return (!S(x - 1, y) && !S(x + 1, y)) || (!S(x, y - 1) && !S(x, y + 1)); };
    const onEdge = (x, y) => x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1;
    const front = b.frontDoor;
    for (const d of b.doors) {
      const x = d[0], y = d[1];
      if (!W.getObj(x, y) || passable(x, y)) continue;
      const S = (ax, ay) => W.isSolid(ax, ay);
      // prefer opening the straight neighbour opposite an already-open side, then any neighbour
      const ordered = [];
      if (!S(x, y - 1)) ordered.push([x, y + 1]);
      if (!S(x, y + 1)) ordered.push([x, y - 1]);
      if (!S(x - 1, y)) ordered.push([x + 1, y]);
      if (!S(x + 1, y)) ordered.push([x - 1, y]);
      for (const dd of [[0, -1], [0, 1], [-1, 0], [1, 0]]) ordered.push([x + dd[0], y + dd[1]]);
      for (const [ax, ay] of ordered) {
        const o = W.getObj(ax, ay); if (!o) continue;
        const ownWall = o.t === O.WALL && o.b === b.id && !onEdge(ax, ay);
        const redundantDoor = D[o.t].door && o.b === b.id && !onEdge(ax, ay) && !(front && front[0] === ax && front[1] === ay);
        if (ownWall || redundantDoor) { W.setObj(ax, ay, null); if (passable(x, y)) break; }
      }
    }
  }

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
    } else if (kind === 'police' || kind === 'hospital' || kind === 'military') {
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
    repairDoors(b);
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
        else { floorRect(r, G.CARPET); put(b, r, rng, O.BED, { loot: 'bedroom' }); put(b, r, rng, O.WARDROBE, { loot: 'clothes' }); if (rng() < 0.5) put(b, r, rng, O.DESK, { loot: 'office' }); }
      }
      // Guarantee a bedroom in every house. Two separate problems had to be covered:
      //   - houses with one or two rooms spend them all on living and kitchen, so no room is ever
      //     typed 'bed' and the town ends up with almost no wardrobes;
      //   - even when a room is typed 'bed', put() can fail to find a free wall tile in a small
      //     room, so the furniture silently goes missing.
      // Both are handled by checking what was actually placed and topping it up, rather than by
      // re-typing rooms (which would trade a kitchen's four containers for a wardrobe).
      const hasProp = t => b.props.some(p => p.t === t);
      const wanted = [];
      if (!hasProp(O.BED)) wanted.push([O.BED, { loot: 'bedroom' }]);
      if (!hasProp(O.WARDROBE)) wanted.push([O.WARDROBE, { loot: 'clothes' }]);
      for (const w of wanted) {
        // smallest rooms first, so a spare bedroom reads better than cluttering the living room
        let placed = false;
        for (const r of sorted.slice().reverse()) { if (put(b, r, rng, w[0], w[1])) { placed = true; break; } }
        // last resort: any free interior tile, in case no room has a usable wall run left
        if (!placed) for (const r of sorted) { if (putFree(b, r, rng, w[0], w[1])) break; }
      }
      // Attic crate: an occasional crate of stored odds and ends. This used to be placed inside
      // the bedroom branch, so houses without a bedroom never had one at all. Any room will do.
      if (rng() < 0.4) {
        for (const r of sorted) { if (put(b, r, rng, O.CRATE, { loot: 'attic' })) break; }
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
        else if (r.type === 'office') { put(b, r, rng, O.COMPUTERDESK, { loot: 'police' }); put(b, r, rng, O.DESK, { loot: 'office' }); put(b, r, rng, O.LOCKER, { loot: 'locker' }); }
        else { put(b, r, rng, O.BED, { loot: 'cell' }); put(b, r, rng, O.TOILET); }
      }
      // The furnishing above is deliberately the layout this building always produced, so the
      // shared generator stream is consumed exactly as before and every building created later
      // in the world keeps its old shape. The two holding cells are re-typed here and given a
      // tiled floor, which costs no draws; the first cell is then narrowed and its three
      // fixtures replaced at the very end of world generation, by shrinkPoliceCell() in gen.js.
      // That has to happen last: adding wall tiles changes how many attempts randomInterior
      // needs to find a free tile for a zombie, and each extra attempt consumes draws that
      // would reshuffle every building generated after the station.
      const cellsRooms = rooms.filter(r => r.type === 'cells');
      cellsRooms.forEach((r, i) => {
        floorRect(r, G.TILE);
        const bed = b.props.find(p => p.t === O.BED && p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1);
        if (i === 0) { r.type = 'cell'; if (bed) bed.prison = true; }
        else {
          r.type = 'bath';
          if (bed) { bed.t = O.SINK; delete bed.loot; delete bed.grid; delete bed.searched; W.refresh(bed.x, bed.y); }
        }
      });
    } else if (kind === 'military') {
      rooms.forEach(r => r.area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1));
      const sorted = rooms.slice().sort((a, c) => c.area - a.area);
      sorted.forEach((r, i) => { r.type = i === 0 ? 'command' : (i === 1 ? 'armory' : 'barracks'); });
      for (const r of rooms) {
        floorRect(r, r.type === 'command' ? G.LINO : G.CONC_IN);
        if (r.type === 'command') {
          put(b, r, rng, O.COMPUTERDESK, { loot: 'office' }); put(b, r, rng, O.DESK, { loot: 'office' });
          put(b, r, rng, O.LOCKER, { loot: 'military' }); putFree(b, r, rng, O.CHAIR);
        } else if (r.type === 'armory') {
          for (let i = 0; i < 4; i++) put(b, r, rng, O.LOCKER, { loot: 'military' });
          for (let i = 0; i < 2; i++) put(b, r, rng, O.CRATE, { loot: 'military' });
          put(b, r, rng, O.WORKBENCH, { loot: 'tools' });
        } else {
          put(b, r, rng, O.BED, { loot: 'military' });
          put(b, r, rng, O.WARDROBE, { loot: 'military' });
          put(b, r, rng, O.LOCKER, { loot: 'military' });
        }
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

  // Careful spawn picker, used only for the player.
  //
  // randomInterior rejects wall tiles but happily returns a spot wedged between furniture:
  // a 1x1 nook between a wardrobe and two walls passes isSolid and leaves nowhere to walk.
  // It also allows standing on the tile of a non-solid prop (a chair, a toilet, the bathtub),
  // which looks like the player spawned inside the object.
  //
  // This keeps the same first pick when that pick is already good, so the generated world and
  // every rng() call stay exactly as they were - only a bad pick is replaced. The replacement
  // scans the building in a fixed order, so it is deterministic and consumes no randomness.
  const PLAYER_R = 0.27;
  // How many of the four axis directions the player could walk in from this tile centre.
  function openDirs(cx, cy) {
    const s = 0.45;
    let n = 0;
    if (!W.hitCircle(cx + s, cy, PLAYER_R)) n++;
    if (!W.hitCircle(cx - s, cy, PLAYER_R)) n++;
    if (!W.hitCircle(cx, cy + s, PLAYER_R)) n++;
    if (!W.hitCircle(cx, cy - s, PLAYER_R)) n++;
    return n;
  }
  // A tile is a safe standing spot when nothing solid pushes on the player, the tile itself
  // carries no prop, and at least two axis directions are walkable (never a dead end).
  Bld.standable = function (x, y) {
    if (!W.inb(x, y) || W.isSolid(x, y) || W.getObj(x, y)) return false;
    const cx = x + 0.5, cy = y + 0.5;
    if (W.hitCircle(cx, cy, PLAYER_R)) return false;
    return openDirs(cx, cy) >= 2;
  };
  // Nearest standable tile around a point, searched by widening rings so the result is the
  // closest possible replacement. Used to rescue a player position saved inside geometry.
  // When a building is given, only its interior is considered, so a player saved in a bad spot
  // inside a house is moved within that house instead of through the wall and out of it.
  //
  // A rescue must also land somewhere the player can leave. A saved position inside a pocket that
  // furniture sealed off is technically standable, so without this the same bug reappeared on
  // load: the game "fixed" the position by choosing the very pocket the player was stuck in.
  Bld.nearbyStandable = function (cx, cy, maxR, b) {
    const tx = Math.floor(cx), ty = Math.floor(cy);
    const inside = (x, y) => !b || (x > b.x && x < b.x + b.w - 1 && y > b.y && y < b.y + b.h - 1);
    const reach = b ? doorRegion(b) : null;
    const ok = (x, y) => Bld.standable(x, y) && (!reach || reach.has(W.idx(x, y)));
    if (inside(tx, ty) && ok(tx, ty)) return [tx + 0.5, ty + 0.5];
    for (let r = 1; r <= (maxR || 6); r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!inside(tx + dx, ty + dy)) continue;
        if (!ok(tx + dx, ty + dy)) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = [tx + dx + 0.5, ty + dy + 0.5]; }
      }
      if (best) return best;
    }
    return null;
  };
  Bld.playerSpawn = function (b, rng) {
    const first = Bld.randomInterior(b, rng);
    // Fallback: walk the interior in a fixed order and take the roomiest tile. Prefer a tile
    // with all four directions open, then any standable tile, then give up and keep the old pick.
    //
    // Only tiles the player can actually walk to from the front door are eligible. A house is
    // split into rooms and furnished by two independent passes, and nothing reconciles them: a
    // wardrobe can seal the only gap between two rooms, leaving the bedroom reachable from the
    // hallway but the hallway itself cut off from the entrance. About 4% of worlds started the
    // player in exactly such a pocket - standable, two directions open, and completely walled off
    // from the door. The room is never trapped by the walls alone, only by furniture standing on
    // the one tile that connected it, so the check has to be a flood fill over the room the door
    // opens into rather than another local look at the tile itself.
    //
    // The flood is built before the first pick is judged, so it is computed once either way. The
    // random pick itself is still taken first and unchanged, so every rng() draw stays exactly
    // where it was and the rest of the world is untouched.
    const reach = doorRegion(b);
    if (first && Bld.standable(Math.floor(first[0]), Math.floor(first[1]))
        && reach.has(W.idx(Math.floor(first[0]), Math.floor(first[1])))) return first;
    let bestFour = null, bestAny = null;
    for (let y = b.y + 1; y < b.y + b.h - 1; y++) {
      for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
        if (!reach.has(W.idx(x, y))) continue;         // door region only: it must be escapable
        if (W.isSolid(x, y) || W.getObj(x, y)) continue;
        const cx = x + 0.5, cy = y + 0.5;
        if (W.hitCircle(cx, cy, PLAYER_R)) continue;
        const open = openDirs(cx, cy);
        if (open === 4) { if (!bestFour) bestFour = [cx, cy]; }
        else if (open >= 2 && !bestAny) bestAny = [cx, cy];
      }
    }
    if (bestFour || bestAny) return bestFour || bestAny;
    // Nothing in the door region passed the two-direction test. The door still opens into a real
    // room (checked across 300 worlds), so fall back to its roomiest tile even if it is a nook -
    // an awkward start you can still walk out of beats a comfortable one you cannot.
    let fallback = null;
    for (const i of reach) {
      const x = i % W.w, y = (i - x) / W.w;
      if (W.isSolid(x, y) || W.getObj(x, y)) continue;
      const cx = x + 0.5, cy = y + 0.5;
      if (W.hitCircle(cx, cy, PLAYER_R)) continue;
      const open = openDirs(cx, cy);
      if (!fallback || open > fallback[2]) fallback = [cx, cy, open];
    }
    return fallback ? [fallback[0], fallback[1]] : (first || [b.x + 2.5, b.y + 2.5]);
  };
  // Every tile the player can walk to from a building's front door, as a set of W.idx values.
  // Doors count as passable no matter which way they are swung, because the player can open them;
  // solids and furniture block. Only the interior rectangle is searched, so the flood cannot leak
  // out into the street around the outside of the walls.
  function doorRegion(b) {
    const out = new Set();
    if (!b || !b.frontDoor) return out;
    const x0 = b.x, y0 = b.y, x1 = b.x + b.w - 1, y1 = b.y + b.h - 1;
    const stack = [b.frontDoor[0], b.frontDoor[1]];
    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const i = W.idx(x, y);
      if (out.has(i)) continue;
      const o = W.getObj(x, y);
      if (!(o && D[o.t].door)) {
        if (W.isSolid(x, y)) continue;
        if (W.hitCircle(x + 0.5, y + 0.5, PLAYER_R)) continue;
      }
      out.add(i);
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    return out;
  }
  // Is the player boxed in where they stand? Not "is this tile standable" - that only asks
  // whether the tile itself is free - but "can I go anywhere at all from here". A player can
  // seal themselves in by walling all four sides of their own tile: tileFree only checks that the
  // tile being built on is empty and not under the player, so four walls around yourself are all
  // legal. The same shape appears when the generator's furniture closes a room, or when a
  // building collapses into rubble around you. In every one of those cases the symptom is
  // identical: four blocked directions and no way to open one.
  //
  // Returns true when no direction gives any movement, which is the only condition worth
  // rescuing from - a cramped corner with one open side is playable and should not teleport.
  Bld.boxedIn = function (px, py, r) {
    r = r || PLAYER_R;
    if (W.hitCircle(px, py, r)) return false;        // overlapping something: unstick() handles that
    // Ask the collision routine itself instead of probing a fixed step. A probe has to guess a
    // distance, and any guess is wrong somewhere: too small and a wall 0.23 tiles away is not
    // reached, too large and a narrow doorway looks sealed. Walking the player forward in the
    // same small increments the game moves them (speed * dt is roughly 0.04-0.08 per frame) and
    // seeing whether they actually get anywhere is the honest question - and the answer is what
    // the player would experience holding that key.
    const step = 0.05, tries = 10;
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let x = px, y = py;
      for (let i = 0; i < tries; i++) {
        const m = W.moveCircle(x, y, d[0] * step, d[1] * step, r);
        const dx = m.x - x, dy = m.y - y;
        if (dx * dx + dy * dy < 1e-9) break;          // this direction is spent
        x = m.x; y = m.y;
      }
      if (Math.hypot(x - px, y - py) > 0.25) return false;   // a real way out
    }
    return true;
  };

  // Nearest spot the player can actually stand and move from, searched by widening rings over
  // the whole grid rather than one building: this is the last-resort rescue, used only when the
  // player is already fully sealed, so leaving the room is the entire point.
  Bld.escapeSpot = function (px, py, maxR) {
    const tx = Math.floor(px), ty = Math.floor(py);
    for (let r = 1; r <= (maxR || 14); r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx, y = ty + dy;
        if (!W.inb(x, y) || W.isSolid(x, y) || W.getObj(x, y)) continue;
        const cx = x + 0.5, cy = y + 0.5;
        if (W.hitCircle(cx, cy, PLAYER_R)) continue;
        if (Bld.boxedIn(cx, cy, PLAYER_R)) continue;   // must not drop them into another sealed nook
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = [cx, cy]; }
      }
      if (best) return best;
    }
    return null;
  };
})();
