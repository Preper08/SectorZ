/* Dead SectorZ — grid inventory (Unturned-style), equipment, hotbar, crafting logic. No DOM here. */
(function () {
  'use strict';
  const DSZ = window.DSZ, I = DSZ.ITEMS;
  const Inv = DSZ.Inv = {};

  Inv.make = function (id, q, extra) {
    const d = I[id]; if (!d) throw new Error('unknown item ' + id);
    const it = { id, q: q || 1, uid: ++Inv.uid };
    if (d.dur) it.dur = d.dur;
    if (d.type === 'gun') it.mag = 0;
    if (id === 'gascan') it.fuel = 0;
    if (id === 'flashlight') it.bat = 100;
    if (id === 'torch' || id === 'lantern') it.burn = d.burn;
    if (d.rot) it.age = 0;
    return Object.assign(it, extra || {});
  };
  Inv.uid = 0;
  Inv.def = it => I[it.id];
  Inv.size = it => { const d = I[it.id]; return it.rot ? [d.h, d.w] : [d.w, d.h]; };
  Inv.grid = (w, h) => ({ w, h, items: [] });

  Inv.fits = function (g, it, x, y, ignore) {
    const [w, h] = Inv.size(it);
    if (x < 0 || y < 0 || x + w > g.w || y + h > g.h) return false;
    for (const o of g.items) {
      if (o === ignore || o === it) continue;
      const [ow, oh] = Inv.size(o);
      if (x < o.x + ow && x + w > o.x && y < o.y + oh && y + h > o.y) return false;
    }
    return true;
  };
  Inv.itemAt = function (g, x, y, ignore) {
    for (const o of g.items) { if (o === ignore) continue; const [ow, oh] = Inv.size(o); if (x >= o.x && x < o.x + ow && y >= o.y && y < o.y + oh) return o; }
    return null;
  };
  Inv.place = function (g, it, x, y) { it.x = x; it.y = y; if (g.items.indexOf(it) < 0) g.items.push(it); return it; };
  Inv.remove = function (g, it) { const i = g.items.indexOf(it); if (i >= 0) g.items.splice(i, 1); };
  Inv.canStack = (a, b) => a.id === b.id && I[a.id].stack > 1 && a.q < I[a.id].stack && !a.dur && !b.dur;
  // merge into stacks, then first free slots. returns remaining quantity (0 = fully added).
  // A quantity above the item's stack limit is split into several stacks; placing one
  // oversized item used to let 100 rounds or 4 bandages live in a single slot.
  Inv.addTo = function (g, it) {
    const d = I[it.id], max = d.stack > 1 ? d.stack : 1;
    if (max > 1) for (const o of g.items) { if (it.q <= 0) break; if (o.id === it.id && o.q < max) { const m = Math.min(max - o.q, it.q); o.q += m; it.q -= m; } }
    if (it.q <= 0) return 0;
    while (it.q > 0) {
      const q = Math.min(max, it.q);
      const piece = q === it.q ? it : Object.assign({}, it, { q, uid: ++Inv.uid });
      piece.q = q;
      let placed = false;
      for (const rot of d.w === d.h ? [false] : [false, true]) {
        piece.rot = rot;
        for (let y = 0; y < g.h && !placed; y++) for (let x = 0; x < g.w; x++) {
          if (Inv.fits(g, piece, x, y)) { Inv.place(g, piece, x, y); placed = true; break; }
        }
        if (placed) break;
      }
      if (!placed) { piece.rot = false; break; }
      if (piece === it) return 0;
      it.q -= q;
    }
    it.rot = false;
    return it.q;
  };

  // ---- player inventory
  // Storage capacity comes from equipment: the bag plus every worn garment that defines
  // cols/rows. BODY shirts/jackets, the VEST and the LEGS all hold pockets; the t-shirt is
  // the only body item with none, and head/feet never store. Total room is the SUM of all
  // equipped grids. Fill order is bag first, then legs, body, vest (big items land in the bag).
  Inv.STORE = ['bag', 'legs', 'body', 'vest'];
  Inv.newPlayer = function () {
    // starter outfit assigned here once (game.js does not re-equip the base clothing):
    // t-shirt (no pockets) + shorts (2x1 pocket), bare feet, no vest
    const P = { pockets: null, grids: { bag: null, legs: null, body: null, vest: null }, equip: { head: null, body: Inv.make('tshirt'), vest: null, legs: Inv.make('shorts'), feet: null, bag: null, light: null }, hot: [null, null, null, null, null, null], sel: -1 };
    Inv.refreshAll(P);
    return P;
  };
  Inv.gridOf = function (P, slot) { return P.grids ? (P.grids[slot] || null) : null; };
  // ordered list of the non-empty storage grids (bag first). Total capacity = the sum of these.
  Inv.grids = function (P) { const out = []; for (const s of Inv.STORE) { const g = Inv.gridOf(P, s); if (g) out.push(g); } return out; };
  Inv.give = function (P, it) { // returns leftover item or null
    for (const g of Inv.grids(P)) { if (Inv.addTo(g, it) === 0) return null; }
    return it;
  };
  Inv.all = function (P) {
    const out = []; for (const g of Inv.grids(P)) for (const it of g.items) out.push(it);
    for (const it of P.hot) if (it) out.push(it);
    for (const k in P.equip) if (P.equip[k]) out.push(P.equip[k]);
    return out;
  };
  Inv.count = function (P, id) {
    let n = 0;
    for (const slot of Inv.STORE) {
      const g = Inv.gridOf(P, slot); if (!g) continue;
      for (const it of g.items) if (it.id === id) n += it.q;
    }
    for (const it of P.hot) if (it && it.id === id) n += it.q;
    for (const k in P.equip) { const it = P.equip[k]; if (it && it.id === id) n += it.q; }
    return n;
  };
  // Only what is carried, not what is worn. Crafting an ingredient that is currently equipped
  // would pass the recipe check and then consume nothing, because take() never touches the
  // equipment slots. Recipes that accept clothing use this.
  Inv.countStored = function (P, id) {
    let n = 0;
    for (const slot of Inv.STORE) {
      const g = Inv.gridOf(P, slot); if (!g) continue;
      for (const it of g.items) if (it.id === id) n += it.q;
    }
    for (const it of P.hot) if (it && it.id === id) n += it.q;
    return n;
  };
  Inv.has = (P, id) => Inv.count(P, id) > 0;
  Inv.take = function (P, id, n) {
    let need = n;
    const stores = [...Inv.grids(P).map(g => g.items), P.hot];
    for (const st of stores) {
      for (let i = st.length - 1; i >= 0 && need > 0; i--) {
        const it = st[i]; if (!it || it.id !== id) continue;
        const m = Math.min(it.q, need); it.q -= m; need -= m;
        if (it.q <= 0) { if (st === P.hot) st[i] = null; else st.splice(i, 1); }
      }
    }
    return need === 0;
  };
  Inv.removeItem = function (P, it) {
    for (const g of Inv.grids(P)) { const i = g.items.indexOf(it); if (i >= 0) { g.items.splice(i, 1); return true; } }
    for (let i = 0; i < P.hot.length; i++) if (P.hot[i] === it) { P.hot[i] = null; return true; }
    for (const k in P.equip) if (P.equip[k] === it) { P.equip[k] = null; if (Inv.STORE.indexOf(k) >= 0) Inv.refreshSlot(P, k); return true; }
    return false;
  };
  // rebuild the storage grid that follows one equipment slot. If the new garment holds less
  // than the old one, the overflow is pushed to the other grids and finally to dropFn so that
  // nothing is ever silently lost.
  Inv.refreshSlot = function (P, slot, dropFn) {
    if (!P.grids) P.grids = { bag: null, legs: null, body: null, vest: null };
    const it = P.equip[slot], d = it && I[it.id];
    const cap = d && d.cols && d.rows ? [d.cols, d.rows] : null;
    const old = P.grids[slot];
    if (!cap) {
      P.grids[slot] = null;
      if (old) for (const o of old.items) { const left = Inv.give(P, o); if (left && dropFn) dropFn(left); }
      return;
    }
    if (!old || old.w !== cap[0] || old.h !== cap[1]) {
      const ng = Inv.grid(cap[0], cap[1]);
      P.grids[slot] = ng;
      if (old) for (const o of old.items) { if (Inv.addTo(ng, o) !== 0) { const left = Inv.give(P, o); if (left && dropFn) dropFn(left); } }
    }
  };
  // refresh every storage slot (used on load / migration)
  Inv.refreshAll = function (P, dropFn) { for (const s of Inv.STORE) Inv.refreshSlot(P, s, dropFn); };
  // Old saves (and old containers) can carry a quantity above the item's stack limit in a
  // single slot, because addTo used to place the whole amount at once. Split the excess back
  // into legal stacks: first free cells in the same grid, then the other grids, then the
  // ground. Items are moved, never copied or silently deleted.
  Inv.repairStacks = function (P, dropFn) {
    for (const s of Inv.STORE) {
      const g = Inv.gridOf(P, s); if (!g || !g.items) continue;
      for (const it of g.items.slice()) {
        const max = I[it.id].stack > 1 ? I[it.id].stack : 1;
        if (it.q <= max) continue;
        const over = it.q - max;
        it.q = max;
        const rest = Object.assign({}, it, { q: over, uid: ++Inv.uid, x: 0, y: 0, rot: false });
        if (Inv.addTo(g, rest) !== 0) {
          const left = Inv.give(P, rest);
          if (left && dropFn) dropFn(left);
        }
      }
    }
    for (const it of P.hot) {
      if (!it) continue;
      const max = I[it.id].stack > 1 ? I[it.id].stack : 1;
      if (it.q <= max) continue;
      const over = it.q - max;
      it.q = max;
      const left = Inv.give(P, Object.assign({}, it, { q: over, uid: ++Inv.uid }));
      if (left && dropFn) dropFn(left);
    }
  };
  // An item definition can change size between builds - the torso garments went from a
  // one-wide flannel to two tiles wide, which turns a legal old layout into an illegal one.
  // Positions are saved, footprints are not, so a bag saved under the old rule can hold two
  // items that overlap under the new one. Re-pack only the grids that actually overlap, so a
  // player's carefully arranged bag is never touched when nothing changed.
  Inv.repairOverlaps = function (P, dropFn) {
    Inv.repairStacks(P, dropFn);
    for (const s of Inv.STORE) {
      const g = Inv.gridOf(P, s); if (!g || !g.items || g.items.length < 2) continue;
      let bad = false;
      for (let i = 0; i < g.items.length && !bad; i++) {
        const a = g.items[i], [aw, ah] = Inv.size(a);
        if (a.x < 0 || a.y < 0 || a.x + aw > g.w || a.y + ah > g.h) { bad = true; break; }
        for (let j = i + 1; j < g.items.length; j++) {
          const b = g.items[j], [bw, bh] = Inv.size(b);
          if (a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + bh && a.y + ah > b.y) { bad = true; break; }
        }
      }
      if (!bad) continue;
      const stray = g.items.slice();
      g.items.length = 0;
      for (const it of stray) {
        if (Inv.addTo(g, it) !== 0) {
          // nowhere left in this garment: try the other grids, then the ground
          const left = Inv.give(P, it);
          if (left && dropFn) dropFn(left);
        }
      }
    }
  };
  // backwards-compatible aliases (bag / legs were the original drivers)
  Inv.refreshBag = function (P, dropFn) { Inv.refreshSlot(P, 'bag', dropFn); };
  Inv.refreshPants = function (P, dropFn) { Inv.refreshSlot(P, 'legs', dropFn); };
  // old saves: add the new LEGS/VEST slots, move a vest stuck in the body slot to the vest slot,
  // and give legacy characters the starter clothing they never had. The old fixed 6x2 'pockets'
  // grid is absorbed: its items move into the storage grids, then the field is dropped. The old
  // flat bagGrid / pantsGrid fields migrate into the new P.grids map.
  Inv.migrateEquip = function (P, dropFn) {
    let changed = false;
    if (!('legs' in P.equip)) { P.equip.legs = null; changed = true; }
    if (!('vest' in P.equip)) { P.equip.vest = null; changed = true; }
    // a vest equipped in the body slot (old system) moves to the vest slot without duplication
    const bodyIt = P.equip.body;
    if (bodyIt && I[bodyIt.id].slot === 'vest' && !P.equip.vest) { P.equip.vest = bodyIt; P.equip.body = null; changed = true; }
    // legacy characters wore an implicit t-shirt/shorts: make it explicit
    if (!P.equip.body) { P.equip.body = Inv.make('tshirt'); changed = true; }
    if (!P.equip.legs) { P.equip.legs = Inv.make('shorts'); changed = true; }
    // migrate the old flat grids into the new per-slot map
    if (!P.grids) { P.grids = { bag: P.bagGrid || null, legs: P.pantsGrid || null, body: null, vest: null }; changed = true; }
    // absorb the legacy fixed pockets grid into the new storage, then drop the field
    if (P.pockets && P.pockets.items && P.pockets.items.length) {
      const stray = P.pockets.items.slice(); P.pockets = null; changed = true;
      for (const it of stray) { const left = Inv.give(P, it); if (left && dropFn) dropFn(left); }
    } else if (P.pockets) { P.pockets = null; changed = true; }
    if (changed) Inv.refreshAll(P, dropFn);
    return changed;
  };
  Inv.equip = function (P, it, dropFn) { // equip clothing / bag / light; returns true
    const d = I[it.id]; let slot = null;
    if (d.type === 'clothes') slot = d.slot; else if (d.type === 'bag') slot = 'bag'; else if (d.type === 'light') slot = 'light';
    if (!slot) return false;
    Inv.removeItem(P, it);
    const prev = P.equip[slot]; P.equip[slot] = it;
    if (Inv.STORE.indexOf(slot) >= 0) Inv.refreshSlot(P, slot, dropFn); // capacity follows the garment
    if (prev) { const left = Inv.give(P, prev); if (left && dropFn) dropFn(left); }
    return true;
  };
  Inv.unequip = function (P, slot, dropFn) {
    const it = P.equip[slot]; if (!it) return false;
    if (Inv.STORE.indexOf(slot) >= 0) { P.equip[slot] = null; Inv.refreshSlot(P, slot, dropFn); const left = Inv.give(P, it); if (left && dropFn) dropFn(left); return true; }
    const left = Inv.give(P, it); if (left) return false;
    P.equip[slot] = null; return true;
  };
  Inv.armor = function (P) { let a = 0; for (const k of ['head', 'body', 'vest', 'legs', 'feet']) { const it = P.equip[k]; if (it) a += I[it.id].def || 0; } return a; };
  function itemWeight(it) { const d = I[it.id]; return d.w * d.h * 0.4 + (it.q - 1) * 0.1; }
  Inv.weight = function (P) {
    let w = 0;
    for (const slot of Inv.STORE) {
      const g = Inv.gridOf(P, slot); if (!g) continue;
      for (const it of g.items) w += itemWeight(it);
    }
    for (const it of P.hot) if (it) w += itemWeight(it);
    for (const k in P.equip) if (P.equip[k]) w += itemWeight(P.equip[k]);
    return w;
  };

  // ---- containers
  Inv.fillContainer = function (o, rng) {
    const d = DSZ.OBJDEF[o.t].cont; if (!d) return null;
    if (o.grid) return o.grid;
    let w = d.w, h = d.h, g;
    if (d.loot || o.loot) {
      const list = DSZ.rollLoot(rng, o.loot || d.loot, 0).slice()
        .sort((a, b) => I[b.id].w * I[b.id].h - I[a.id].w * I[a.id].h);
      // A locker is 4x4 but the armory rolls 5x2 rifles and several other items; anything that
      // does not fit was silently dropped. Pack biggest first, then grow the grid like corpse
      // loot does. Grow HEIGHT first (addTo rotates long items), so a locker becomes taller,
      // not an implausible 11-column-wide shelf; width only grows after that limit.
      const baseH = h, maxH = 12, maxW = Math.max(12, d.w);
      for (;;) {
        g = Inv.grid(w, h);
        let full = false;
        for (const r of list) { if (Inv.addTo(g, Inv.make(r.id, r.q, r)) !== 0) { full = true; break; } }
        if (!full) break;
        if (h < maxH) h++;
        else if (w < maxW) { w++; h = baseH; }
        else break;
      }
    } else g = Inv.grid(w, h);
    o.grid = g;
    return g;
  };

  // ---- crafting
  Inv.stations = function (S) {
    const p = S.player, st = { bench: false, fire: false };
    const W = DSZ.World;
    for (let y = Math.floor(p.y) - 3; y <= Math.floor(p.y) + 3; y++) for (let x = Math.floor(p.x) - 3; x <= Math.floor(p.x) + 3; x++) {
      const o = W.getObj(x, y); if (!o) continue; const d = DSZ.OBJDEF[o.t];
      if (!d.station) continue; if (Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) > 3.4) continue;
      if (d.station === 'bench') st.bench = true; else if (d.station === 'fire') st.fire = true; else if (d.station === 'furnace') { st.fire = true; st.bench = true; }
    }
    return st;
  };
  Inv.recipeState = function (P, r, st) {
    const missing = []; let ok = true;
    for (const [id, q] of r.in) { if (q <= 0) continue; const have = Inv.countStored(P, id); if (have < q) { ok = false; missing.push([id, q - have]); } }
    if (r.station && !st[r.station]) { ok = false; missing.push([r.station === 'bench' ? '#Workbench' : '#Fire', 1]); }
    if (r.needs && !Inv.has(P, r.needs)) { ok = false; missing.push([r.needs, 1]); }
    return { ok, missing };
  };
  Inv.craft = function (P, r, st, dropFn) {
    const s = Inv.recipeState(P, r, st); if (!s.ok) return false;
    for (const [id, q] of r.in) if (q > 0) Inv.take(P, id, q);
    const it = Inv.make(r.out[0], r.out[1]);
    if (it.id === 'gascan') it.fuel = 0;
    const left = Inv.give(P, it); if (left && dropFn) dropFn(left);
    return true;
  };
  // build cost
  Inv.canBuild = function (P, def) { for (const [id, q] of def.cost) if (Inv.count(P, id) < q) return false; return true; };
  Inv.payBuild = function (P, def) { for (const [id, q] of def.cost) Inv.take(P, id, q); };
  Inv.refundBuild = function (P, def, ratio, dropFn) { for (const [id, q] of def.cost) { const n = Math.floor(q * ratio); if (n > 0) { const left = Inv.give(P, Inv.make(id, n)); if (left && dropFn) dropFn(left); } } };
})();
