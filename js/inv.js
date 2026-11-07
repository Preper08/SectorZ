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
  // merge into stacks, then first free slot. returns remaining quantity (0 = fully added)
  Inv.addTo = function (g, it) {
    const d = I[it.id];
    if (d.stack > 1) for (const o of g.items) { if (it.q <= 0) break; if (o.id === it.id && o.q < d.stack) { const m = Math.min(d.stack - o.q, it.q); o.q += m; it.q -= m; } }
    if (it.q <= 0) return 0;
    for (const rot of d.w === d.h ? [false] : [false, true]) {
      it.rot = rot;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (Inv.fits(g, it, x, y)) { Inv.place(g, it, x, y); return 0; }
    }
    it.rot = false; return it.q;
  };

  // ---- player inventory
  Inv.newPlayer = function () {
    return { pockets: Inv.grid(6, 2), bag: null, bagGrid: null, equip: { head: null, body: null, feet: null, bag: null, light: null }, hot: [null, null, null, null, null, null], sel: -1 };
  };
  Inv.grids = P => P.bagGrid ? [P.pockets, P.bagGrid] : [P.pockets];
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
  Inv.count = function (P, id) { let n = 0; for (const it of Inv.all(P)) if (it.id === id) n += it.q; return n; };
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
    for (const k in P.equip) if (P.equip[k] === it) { P.equip[k] = null; if (k === 'bag') Inv.refreshBag(P); return true; }
    return false;
  };
  Inv.refreshBag = function (P, dropFn) {
    const b = P.equip.bag, d = b && I[b.id];
    const old = P.bagGrid;
    if (!b) { P.bagGrid = null; if (old) for (const it of old.items) { const left = Inv.give(P, it); if (left && dropFn) dropFn(left); } return; }
    if (!old || old.w !== d.cols || old.h !== d.rows) {
      const ng = Inv.grid(d.cols, d.rows);
      if (old) for (const it of old.items) { if (Inv.addTo(ng, it) !== 0) { const left = Inv.give(P, it); if (left && dropFn) dropFn(left); } }
      P.bagGrid = ng;
    }
  };
  Inv.equip = function (P, it, dropFn) { // equip clothing / bag / light; returns true
    const d = I[it.id]; let slot = null;
    if (d.type === 'clothes') slot = d.slot; else if (d.type === 'bag') slot = 'bag'; else if (d.type === 'light') slot = 'light';
    if (!slot) return false;
    Inv.removeItem(P, it);
    const prev = P.equip[slot]; P.equip[slot] = it;
    if (slot === 'bag') { P.equip.bag = null; const keep = P.bagGrid; P.equip.bag = it; Inv.refreshBag(P, dropFn); }
    if (prev) { const left = Inv.give(P, prev); if (left && dropFn) dropFn(left); }
    return true;
  };
  Inv.unequip = function (P, slot, dropFn) {
    const it = P.equip[slot]; if (!it) return false;
    if (slot === 'bag') { P.equip.bag = null; Inv.refreshBag(P, dropFn); const left = Inv.give(P, it); if (left && dropFn) dropFn(left); return true; }
    const left = Inv.give(P, it); if (left) return false;
    P.equip[slot] = null; return true;
  };
  Inv.armor = function (P) { let a = 0; for (const k of ['head', 'body', 'feet']) { const it = P.equip[k]; if (it) a += I[it.id].def || 0; } return a; };
  Inv.weight = function (P) { let w = 0; for (const it of Inv.all(P)) { const d = I[it.id]; w += d.w * d.h * 0.4 + (it.q - 1) * 0.1; } return w; };

  // ---- containers
  Inv.fillContainer = function (o, rng) {
    const d = DSZ.OBJDEF[o.t].cont; if (!d) return null;
    if (o.grid) return o.grid;
    const g = Inv.grid(d.w, d.h); o.grid = g;
    if (d.loot || o.loot) {
      const list = DSZ.rollLoot(rng, o.loot || d.loot, 0);
      for (const r of list) { const it = Inv.make(r.id, r.q, r); Inv.addTo(g, it); }
    }
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
    for (const [id, q] of r.in) { if (q <= 0) continue; const have = Inv.count(P, id); if (have < q) { ok = false; missing.push([id, q - have]); } }
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
