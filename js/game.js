/* Dead SectorZ — game state & player logic: survival, control, interaction, building, saving */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, C = DSZ.C, W = DSZ.World, O = DSZ.O, D = DSZ.OBJDEF, I = DSZ.ITEMS, Inv = DSZ.Inv, E = DSZ.Ents, A = DSZ.Audio, In = DSZ.Input;
  const Game = DSZ.Game = { S: null };
  const rnd = () => Math.random();

  // ---------------------------------------------------------------- new game
  Game.newGame = function (seed, saved) {
    seed = seed || ((Math.random() * 1e9) | 0);
    DSZ.Gen.generate(seed);
    const Gn = DSZ.Gen;
    const S = Game.S = {
      seed, time: 0, hour: C.START_HOUR, day: 1, cam: { x: 0, y: 0, zoom: 1, tz: 1, shake: 0 }, player: null, zombies: [], cars: [], drops: [], particles: [], decals: [], bullets: [], glowLights: [], noiseEvents: [],
      weather: { rain: 0, target: 0, t: 60 + Math.random() * 60, flash: 0, thunder: 0, lt: 30 }, stats: { kills: 0, distance: 0, looted: 0, built: 0 }, muzzle: 0, focus: null, build: { active: false, def: null, tile: null, ok: false, rot: 0, tab: 'Walls' },
      carInput: { thr: 0, str: 0, hand: false }, toasts: [], state: 'play', search: null, prying: null, sleeping: null, spawnT: 20, saveT: 60, cinema: 0, paused: false, mouse: { wx: 0, wy: 0 }
    };
    const sp = Gn.playerSpawn;
    const p = S.player = {
      x: sp[0], y: sp[1], ang: 1, aimAng: 1, hp: 100, food: 82, water: 78, stamina: 100, energy: 90, infection: 0, bleed: 0, broken: false, dead: false, driving: null,
      pose: { arms: 'walk', af: 0, legs: 'idle', lf: 0 }, look: {}, heldDef: null, lightDef: null, lightOn: false, lightFlick: 0, flash: 0, hurt: 0, muzzle: 0, moving: false, running: false, aiming: false, sneak: false, crouch: false, strength: 0,
      inv: Inv.newPlayer(), ph: 0, atk: 0, atkT: 0, atkDone: true, cool: 0, reload: 0, stepT: 0, use: null, sprite: null, vx: 0, vy: 0, speed: 0
    };
    // starter kit (bare hands: the bat is a world pickup now)
    const P = p.inv;
    Inv.equip(P, Inv.make('fannypack'));
    P.equip.light = Inv.make('flashlight', 1, { bat: 100 });
    Inv.give(P, Inv.make('hammer')); Inv.give(P, Inv.make('bandage', 2)); Inv.give(P, Inv.make('water')); Inv.give(P, Inv.make('beans'));
    P.sel = -1;
    // world population
    for (const z of Gn.zombieSpawns) E.spawnZombie(S, z[0], z[1], z[2]);
    for (const c of Gn.carSpecs) E.spawnCar(S, c);
    // guarantee a drivable car near the start
    let best = null, bd = 1e9; for (const c of S.cars) { const d = Math.hypot(c.x - sp[0], c.y - sp[1]); if (d < bd && d > 4 && c.kind !== 'police' && !W.insideBuilding(c.x, c.y)) { bd = d; best = c; } }
    if (best) { best.state = 'ok'; best.drivable = true; best.dead = false; best.hp = 140; best.fuel = 38; best.color = best.color % 10; }
    for (const c of S.cars) if (c.state === 'ok' && c !== best && Math.random() < 0.4) c.fuel = 5 + Math.random() * 25;
    S.cam.x = p.x; S.cam.y = p.y;
    Game.refreshEquipVisuals(S);
    if (saved) Game.applySave(S, saved);
    // new games start bare-handed: the bat lies on the floor near the spawn.
    // Loaded saves keep whatever the player already has (no duplicates, no extra spawns).
    else Game.placeStarterBat(S);
    // god mode (admin): fill the inventory when it is enabled before the game starts
    if (DSZ.settings.godmode) Game.godKit(S);
    Game.toast(S, 'Find supplies. Stay quiet. Survive the night.');
    DSZ.emit('newgame', S);
    return S;
  };

  Game.toast = function (S, text, kind) { S = S || Game.S; if (!S) return; S.toasts.push({ text, kind: kind || '', t: 4.5 }); if (S.toasts.length > 6) S.toasts.shift(); };
  Game.dropItem = function (S, x, y, item) { S.drops.push({ x: x + (Math.random() - 0.5) * 0.6, y: y + (Math.random() - 0.5) * 0.6, item }); };
  Game.dropFn = S => it => Game.dropItem(S, S.player.x, S.player.y, it);
  // Put the starting baseball bat on the floor near the player spawn. Skipped when the
  // player already owns one or one is already lying in the world (old saves / reloads).
  Game.placeStarterBat = function (S) {
    const p = S.player;
    if (Inv.has(p.inv, 'bat')) return;
    if (S.drops.some(d => d.item && d.item.id === 'bat')) return;
    const bx = Math.floor(p.x), by = Math.floor(p.y), inHouse = W.insideBuilding(p.x, p.y);
    let spot = null;
    for (const r of [2, 3, 1, 4]) {
      for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = bx + dx, ty = by + dy;
        if (!W.inb(tx, ty) || W.isSolid(tx, ty)) continue;
        if (inHouse && !W.insideBuilding(tx + 0.5, ty + 0.5)) continue;
        spot = [tx + 0.5, ty + 0.5];
      }
      if (spot) break;
    }
    if (!spot) spot = [p.x, p.y];
    Game.dropItem(S, spot[0], spot[1], Inv.make('bat', 1, { dur: 55 }));
  };
  // a just-picked weapon goes straight into the hotbar so it is ready to use
  Game.equipPicked = function (S, it) {
    const P = S.player.inv;
    const at = P.hot.indexOf(it);
    if (at >= 0) { P.sel = at; return; }
    const slot = P.hot.indexOf(null);
    if (slot < 0) return; // hotbar full - it stays in the inventory
    Inv.removeItem(P, it);
    P.hot[slot] = it; P.sel = slot;
  };
  // God mode (admin): give the player a full loadout. Only tops up what is missing,
  // so it is safe to call on every god-mode enable or game start.
  Game.godKit = function (S) {
    const p = S.player, P = p.inv;
    if (!P.equip.bag || P.equip.bag.id !== 'bigpack') Inv.equip(P, Inv.make('bigpack'), Game.dropFn(S));
    const ensure = (id, q, extra) => { const have = Inv.count(P, id); if (have < q) Inv.give(P, Inv.make(id, q - have, extra)); };
    ensure('pistol', 1, { mag: 12 }); ensure('shotgun', 1, { mag: 6 }); ensure('rifle', 1, { mag: 5 });
    ensure('machete', 1); ensure('crowbar', 1); ensure('axe', 1);
    ensure('ammo9', 40); ensure('shell', 20); ensure('ammo762', 20);
    ensure('medkit', 2); ensure('bandage', 5); ensure('antibiotics', 3); ensure('painkillers', 3); ensure('splint', 2);
    ensure('mre', 4); ensure('beans', 4); ensure('water', 4); ensure('soda', 4);
    ensure('hammer', 1); ensure('nails', 30); ensure('wood', 6); ensure('scrap', 12); ensure('tape', 3);
    ensure('gascan', 1, { fuel: 100 }); ensure('battery', 3); ensure('flashlight', 1, { bat: 100 }); ensure('map', 1); ensure('lighter', 1);
    // admin loadout wears the full combat outfit: kevlar vest, cargo pants, boots
    if (!P.equip.vest) Inv.equip(P, Inv.make('vest'), Game.dropFn(S));
    if (!P.equip.legs || P.equip.legs.id !== 'cargopants') Inv.equip(P, Inv.make('cargopants'), Game.dropFn(S));
    if (!P.equip.feet || P.equip.feet.id !== 'boots') Inv.equip(P, Inv.make('boots'), Game.dropFn(S));
    if (P.equip.light && P.equip.light.bat !== undefined) P.equip.light.bat = 100;
    // put the main weapons into empty hotbar slots (1-4)
    const kit = ['pistol', 'shotgun', 'rifle', 'machete'];
    for (let i = 0; i < P.hot.length; i++) {
      if (P.hot[i]) continue;
      const id = kit.find(k => Inv.count(P, k) > 0 && !P.hot.some(x => x && x.id === k));
      if (!id) break;
      const it = Inv.all(P).find(x => x.id === id);
      if (it) { Inv.removeItem(P, it); P.hot[i] = it; }
    }
    Game.toast(S, 'God mode: inventory filled - items are infinite.');
  };

  // ---------------------------------------------------------------- equipment visuals
  const CLOTH_COL = { jacket: [74, 90, 106], hoodie: [106, 74, 74], vest: [58, 64, 70], helmet: [76, 86, 54], cap: [74, 106, 138], boots: [90, 64, 40], backpack: [92, 106, 70], bigpack: [138, 74, 48], fannypack: [74, 74, 82], tshirt: [90, 122, 154], shorts: [84, 98, 126], trousers: [74, 79, 96], cargopants: [90, 98, 72], sneakers: [138, 138, 138] };
  // p.look carries only what the figure renderer consumes: an id per equipment slot
  // (selects the draw entry in CLOTHING/VEST/HEADWEAR/FOOTWEAR/LEGS_FIGS) and its colour
  Game.refreshEquipVisuals = function (S) {
    const p = S.player, e = p.inv.equip, L = {};
    if (e.body) { L.bodyId = e.body.id; L.bodyCol = CLOTH_COL[e.body.id] || [90, 90, 90]; }
    if (e.vest) { L.vestId = e.vest.id; L.vestCol = CLOTH_COL[e.vest.id] || [58, 64, 70]; }
    if (e.head) { L.headId = e.head.id; L.headCol = CLOTH_COL[e.head.id] || [80, 80, 80]; }
    if (e.feet) { L.feetId = e.feet.id; L.feetCol = CLOTH_COL[e.feet.id]; }
    if (e.legs) { L.legsId = e.legs.id; L.legsCol = CLOTH_COL[e.legs.id] || [84, 98, 126]; }
    if (e.bag) { L.bagId = e.bag.id; L.bagCol = CLOTH_COL[e.bag.id]; }
    p.look = L;
    const lt = e.light; p.lightDef = lt ? Object.assign({}, I[lt.id], { id: lt.id }) : null;
    if (!lt) p.lightOn = false;
  };
  function held(S) { const P = S.player.inv; return P.sel >= 0 ? P.hot[P.sel] : null; }
  Game.held = held;

  // ---------------------------------------------------------------- damage / death
  Game.hurtPlayer = function (S, dmg, sx, sy, type, src) {
    const p = S.player; if (p.dead) return;
    if (DSZ.settings.godmode) return; // admin: take no damage at all
    const armor = Inv.armor(p.inv), red = type === 'bite' ? Math.min(0.8, armor / 100 * 0.85) : (type === 'blast' || type === 'crash' ? Math.min(0.4, armor / 150) : 0);
    dmg *= (1 - red);
    p.hp -= dmg; p.hurt = 0.55; S.cam.shake = Math.min(1.2, (S.cam.shake || 0) + 0.35);
    A.play('hurt', p.x, p.y, 1); if (type === 'bite') A.play('bite', p.x, p.y, 1);
    E.blood(S, p.x, p.y, Math.atan2(p.y - sy, p.x - sx), 6, 0.3);
    if (type === 'bite') {
      if (Math.random() < 0.3 * (1 - red)) { p.bleed = Math.min(3, p.bleed + 1); Game.toast(S, 'You are bleeding!', 'bad'); }
      if (Math.random() < 0.16 * (1 - red) && p.infection <= 0) { p.infection = 5; Game.toast(S, 'You were bitten... infected.', 'bad'); }
    }
    if (type === 'crash' && dmg > 18 && Math.random() < 0.35 && !p.broken) { p.broken = true; Game.toast(S, 'Your leg is broken!', 'bad'); }
    if (p.hp <= 0) Game.die(S, type);
  };
  Game.die = function (S, cause) {
    const p = S.player; if (p.dead) return; p.dead = true; p.hp = 0; S.state = 'dead'; S.deathCause = cause;
    if (p.driving) Game.exitCar(S, true);
    E.blood(S, p.x, p.y, 0, 18, 1.0); A.engine(false);
    DSZ.emit('death', S);
  };

  // ---------------------------------------------------------------- items
  Game.useItem = function (S, it) {
    const p = S.player, d = I[it.id], P = p.inv; if (p.dead) return false;
    const consume = () => { if (DSZ.settings.godmode) return; it.q -= 1; if (it.q <= 0) Inv.removeItem(P, it); }; // god mode: items are never used up
    switch (d.type) {
      case 'food': case 'drink': {
        p.food = Math.min(100, p.food + (d.food || 0)); p.water = Math.min(100, p.water + (d.water || 0));
        if (d.sick && Math.random() < 0.6) { p.infection = Math.max(p.infection, 0) + d.sick * 0.4; Game.toast(S, 'That made you queasy.', 'bad'); }
        if (d.heal) p.hp = Math.min(100, p.hp + d.heal);
        A.play(d.drinkSnd || d.eatSnd || 'eat'); consume();
        if (d.empty) Game.giveOrDrop(S, Inv.make(d.empty)); Game.toast(S, (d.type === 'food' ? 'Ate ' : 'Drank ') + d.name); return true;
      }
      case 'med': {
        if (d.fix) { if (!p.broken) { Game.toast(S, 'No fracture to treat.'); return false; } p.broken = false; }
        if (d.cure) { p.infection = Math.max(0, p.infection - 70); if (p.infection < 20) p.infection = 0; }
        if (d.bleed) p.bleed = Math.max(0, p.bleed - (d.id === 'medkit' ? 3 : 1));
        if (d.heal) p.hp = Math.min(100, p.hp + d.heal);
        if (d.pain) p.hp = Math.min(100, p.hp + 6);
        A.play(d.snd || 'bandage'); consume(); Game.toast(S, 'Used ' + d.name); return true;
      }
      case 'clothes': case 'bag': case 'light': { Inv.equip(P, it, Game.dropFn(S)); Game.refreshEquipVisuals(S); A.play('click'); return true; }
      case 'melee': case 'gun': {
        let slot = P.hot.indexOf(null); if (P.hot.indexOf(it) >= 0) { P.sel = P.hot.indexOf(it); return true; }
        if (slot < 0) { Game.toast(S, 'Hotbar full'); return false; }
        Inv.removeItem(P, it); P.hot[slot] = it; P.sel = slot; A.play('click'); return true;
      }
      case 'tool': if (d.id === 'map') { DSZ.UI && DSZ.UI.openMap(); return true; } return false;
      case 'mat': if (d.id === 'battery') { const fl = P.equip.light; if (fl && fl.bat !== undefined && fl.bat < 90) { fl.bat = 100; consume(); Game.toast(S, 'Flashlight recharged'); A.play('click'); return true; } } return false;
      case 'fuel': return Game.refuelNearby(S, it);
      default: return false;
    }
  };
  Game.giveOrDrop = function (S, it) { const left = Inv.give(S.player.inv, it); if (left) Game.dropItem(S, S.player.x, S.player.y, left); };
  Game.refuelNearby = function (S, it) {
    const p = S.player; if (!it) { for (const x of Inv.all(p.inv)) if (x.id === 'gascan' && x.fuel > 0) { it = x; break; } }
    if (!it || !(it.fuel > 0)) { Game.toast(S, 'You need a gas can with fuel.'); return false; }
    let car = p.driving; if (!car) for (const c of S.cars) if (c.drivable && Math.hypot(c.x - p.x, c.y - p.y) < 3) { car = c; break; }
    if (!car) { Game.toast(S, 'No vehicle nearby.'); return false; }
    const amt = Math.min(it.fuel, car.maxfuel - car.fuel); if (amt <= 0.5) { Game.toast(S, 'Tank is full.'); return false; }
    it.fuel -= amt; if (DSZ.settings.godmode) it.fuel = Math.max(it.fuel, it.maxfuel || 100); // god mode: endless fuel
    car.fuel += amt; A.play('drink'); Game.toast(S, 'Added ' + Math.round(amt) + ' fuel'); return true;
  };
  Game.toggleLight = function (S) {
    const p = S.player, L = p.inv.equip.light; if (!L) { Game.toast(S, 'No light equipped.'); return; }
    if (!p.lightOn) {
      if (L.bat !== undefined && L.bat <= 0) { const b = Inv.count(p.inv, 'battery'); if (b > 0) { Inv.take(p.inv, 'battery', 1); L.bat = 100; Game.toast(S, 'Changed batteries'); } else { Game.toast(S, 'Batteries are dead.'); return; } }
      if (L.burn !== undefined && L.burn <= 0) { Game.toast(S, 'It has burned out.'); return; }
      if ((L.id === 'torch' || L.id === 'lantern') && !(Inv.has(p.inv, 'lighter') || Inv.has(p.inv, 'matches'))) { Game.toast(S, 'You need a lighter or matches.'); return; }
    }
    p.lightOn = !p.lightOn; A.play('click');
  };
  Game.dropSelected = function (S) { const P = S.player.inv; if (P.sel >= 0 && P.hot[P.sel]) { Game.dropItem(S, S.player.x + Math.cos(S.player.ang) * 0.8, S.player.y + Math.sin(S.player.ang) * 0.8, P.hot[P.sel]); P.hot[P.sel] = null; P.sel = -1; } };
  Game.reload = function (S) {
    const p = S.player, it = held(S); if (!it || I[it.id].type !== 'gun' || p.reload > 0) return;
    const d = I[it.id]; if (it.mag >= d.mag) return; const have = Inv.count(p.inv, d.ammo);
    if (have <= 0) { Game.toast(S, 'No ammo (' + I[d.ammo].name + ')'); return; }
    p.reload = d.reload; p.reloadItem = it; A.play('reload', p.x, p.y, 0.8);
  };

  // ---------------------------------------------------------------- base building
  Game.setBuild = function (S, on) {
    const b = S.build; b.active = on; if (on) { b.def = b.def || DSZ.BUILD[0]; b.tile = null; } else b.tile = null;
  };
  Game.placeBase = function (S, def, tx, ty, rot) {
    const o = { t: def.obj, f: rot & 3, v: 0, base: true, b: 0 }, d = D[def.obj];
    if (d.door) { o.open = false; o.locked = false; }
    if (d.cont) o.grid = Inv.grid(d.cont.w, d.cont.h);
    if (d.fire) { o.fuel = def.obj === O.BFIRE ? 90 : 60; o.lit = o.fuel > 0; }
    W.setObj(tx, ty, o);
    if (d.light || d.fire) Game.attachBaseLight(o);
    DSZ.Render.dirtyAt(tx, ty); return o;
  };
  Game.attachBaseLight = function (o) {
    const x = o.x + 0.5, y = o.y + 0.5;
    if (o.t === O.BFIRE) o.light = W.addLight({ x, y, r: 8, col: [255, 150, 60], a: 1.05, kind: 'fire', flick: 2, seed: Math.random() * 99, h: 1 });
    else if (o.t === O.BFURNACE) o.light = W.addLight({ x, y, r: 6, col: [255, 130, 50], a: 0.9, kind: 'fire', flick: 2, seed: Math.random() * 99, h: 1 });
    else if (o.t === O.BLAMP) o.light = W.addLight({ x, y, r: 8.5, col: [255, 210, 140], a: 0.95, kind: 'lamp', flick: 0, seed: Math.random() * 99, h: 2 });
  };
  Game.destroyBase = function (S, o) {
    const x = o.x, y = o.y; W.removeObj(x, y); DSZ.Render.dirtyAt(x, y); E.debris(S, x + 0.5, y + 0.5, 1, 18, '#8a6a44'); A.play('doorBreak', x + 0.5, y + 0.5, 1);
    if (o.grid) for (const it of o.grid.items) Game.dropItem(S, x + 0.5, y + 0.5, it);
  };
  function tileFree(S, tx, ty) {
    if (!W.inb(tx, ty) || W.getObj(tx, ty)) return false;
    const g = W.groundAt(tx, ty); if (g === DSZ.G.ASPHALT) return false;
    const p = S.player; if (Math.abs(p.x - (tx + 0.5)) < 0.75 && Math.abs(p.y - (ty + 0.5)) < 0.75) return false;
    for (const z of S.zombies) if (!z.dead && Math.abs(z.x - (tx + 0.5)) < 0.7 && Math.abs(z.y - (ty + 0.5)) < 0.7) return false;
    for (const c of S.cars) { if (Math.abs(c.x - tx) > 3 || Math.abs(c.y - ty) > 3) continue; for (const q of E.carCircles(c, [])) if (Math.hypot(q[0] - tx - 0.5, q[1] - ty - 0.5) < 1.0) return false; }
    return true;
  }
  function updateBuild(S, dt) {
    const b = S.build, p = S.player; if (!b.active || DSZ.UI.blockMouse()) { b.tile = null; return; }
    const tx = Math.floor(S.mouse.wx), ty = Math.floor(S.mouse.wy); b.tile = [tx, ty];
    const near = Math.hypot(tx + 0.5 - p.x, ty + 0.5 - p.y) < 5.5;
    b.ok = near && tileFree(S, tx, ty) && Inv.canBuild(p.inv, b.def) && Inv.has(p.inv, 'hammer');
    b.why = !near ? 'Too far' : (!Inv.has(p.inv, 'hammer') ? 'Need a hammer' : (!Inv.canBuild(p.inv, b.def) ? 'Missing materials' : (!tileFree(S, tx, ty) ? 'Blocked' : '')));
    if (In.pressed('KeyR')) b.rot = (b.rot + 1) & 3;
    if (In.mouse.clicked && b.ok) {
      if (!DSZ.settings.godmode) Inv.payBuild(p.inv, b.def); // god mode: build for free
      Game.placeBase(S, b.def, tx, ty, b.rot); A.play('build', tx + 0.5, ty + 0.5, 1); E.debris(S, tx + 0.5, ty + 0.5, 0.6, 8, '#8a6a44'); E.noise(S, tx + 0.5, ty + 0.5, 12); S.stats.built++;
    } else if (In.mouse.clicked && !b.ok && b.why) Game.toast(S, b.why);
    if (In.mouse.rclicked || In.pressed('KeyX')) {
      const o = W.getObj(tx, ty); if (o && o.base && near) {
        const def = DSZ.BUILD.find(d => d.obj === o.t); if (def) Inv.refundBuild(p.inv, def, 0.7, Game.dropFn(S));
        if (o.grid) for (const it of o.grid.items) Game.dropItem(S, tx + 0.5, ty + 0.5, it);
        W.removeObj(tx, ty); DSZ.Render.dirtyAt(tx, ty); A.play('build', tx + 0.5, ty + 0.5, 0.8);
      }
    }
  }

  // ---------------------------------------------------------------- interaction
  function findFocus(S) {
    const p = S.player; if (p.driving) return { kind: 'car', ref: p.driving, x: p.driving.x, y: p.driving.y, label: 'E  Exit vehicle' + (p.driving.fuel < p.driving.maxfuel - 5 && Inv.has(p.inv, 'gascan') ? '    G  Refuel' : '') };
    let best = null, bs = 1e9;
    const consider = (kind, ref, x, y, label, maxd, bias) => { const d = Math.hypot(x - p.x, y - p.y); if (d > maxd) return; const a = Math.abs(U.angDiff(p.aimAng, Math.atan2(y - p.y, x - p.x))); const s = d + (d > 0.9 ? a * 0.5 : 0) + (bias || 0); if (s < bs) { bs = s; best = { kind, ref, x, y, label }; } };
    for (const d of S.drops) consider('drop', d, d.x, d.y, 'E  Pick up ' + I[d.item.id].name + (d.item.q > 1 ? ' x' + d.item.q : ''), 1.5, -0.3);
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) {
      const o = W.getObj(x, y); if (!o) continue; const d = D[o.t], cx = x + 0.5, cy = y + 0.5;
      if (d.door) { const lab = o.open ? 'E  Close door' : (o.locked ? 'E  Locked' + (Inv.has(p.inv, 'crowbar') || Inv.has(p.inv, 'axe') ? ' (hold to pry)' : '') : 'E  Open door'); if (o.t === O.BGATE) consider('door', o, cx, cy, o.open ? 'E  Close gate' : 'E  Open gate', 1.9); else consider('door', o, cx, cy, lab, 1.9, 0.2); }
      else if (d.cont) { const open = o.base || o.grid; consider('cont', o, cx, cy, (o.base ? 'E  Open ' : (o.searched ? 'E  Open ' : 'E  Search ')) + d.cont.name, 1.7); }
      else if (d.bed) consider('bed', o, cx, cy, 'E  Sleep', 1.7);
      else if (d.station === 'fire' || d.station === 'furnace') consider('fire', o, cx, cy, o.lit ? 'E  Add fuel (' + Math.round(o.fuel) + 's)' : 'E  Light fire (needs log/sticks)', 1.8);
      else if (o.t === O.BRAIN) consider('rain', o, cx, cy, 'E  Collect water (' + Math.floor(o.water || 0) + ')', 1.8);
      else if (o.t === O.SINK) consider('sink', o, cx, cy, 'E  Fill bottle', 1.5);
      else if (o.pump) consider('pump', o, cx, cy, 'E  Siphon fuel' + (o.fuelLeft === undefined || o.fuelLeft > 0 ? '' : ' (empty)'), 1.6);
    }
    for (const z of S.zombies) if (z.dead && z.deadT <= 0 && Math.hypot(z.x - p.x, z.y - p.y) < 1.5) consider('corpse', z, z.x, z.y, z.grid || z.searched ? 'E  Open corpse' : 'E  Search body', 1.5, 0.1);
    for (const c of S.cars) { if (Math.abs(c.x - p.x) > 3.2 || Math.abs(c.y - p.y) > 3.2) continue; const dd = Math.min(...E.carCircles(c, []).map(q => Math.hypot(q[0] - p.x, q[1] - p.y) - 0.5)); if (dd < 1.4) { const label = c.drivable ? 'E  Drive' + (c.fuel < c.maxfuel - 5 && Inv.has(p.inv, 'gascan') ? '    G  Refuel' : '') : (c.dead ? 'Burnt out' : 'E  Search vehicle'); if (!(c.dead && !c.drivable)) consider('car', c, c.x, c.y, label, 3, dd * 0.6); } }
    return best;
  }
  function doInteract(S) {
    const f = S.focus, p = S.player; if (!f) return;
    switch (f.kind) {
      case 'drop': {
        const it = f.ref.item, left = Inv.give(p.inv, it);
        if (!left) {
          S.drops.splice(S.drops.indexOf(f.ref), 1); A.play('pickup');
          if (it.id === 'bat') Game.equipPicked(S, it); // ready to swing right away
          Game.toast(S, 'Picked up ' + I[it.id].name + (it.q > 1 ? ' x' + it.q : ''));
        } else { Game.toast(S, 'Not enough space'); }
        break;
      }
      case 'door': {
        const o = f.ref;
        if (!o.open && o.locked) {
          if (Inv.has(p.inv, 'crowbar') || Inv.has(p.inv, 'axe')) { S.prying = { o, t: 0, total: 2.4 }; Game.toast(S, 'Prying the door...'); } else { A.play('thud', f.x, f.y, 0.6); E.noise(S, f.x, f.y, 6); Game.toast(S, 'Locked. Smash it or find a crowbar.'); }
        } else { o.open = !o.open; W.refresh(o.x, o.y); A.play('door', f.x, f.y, 0.9); E.noise(S, f.x, f.y, 4); }
        break;
      }
      case 'cont': case 'corpse': {
        const o = f.ref; const isC = f.kind === 'corpse';
        const isNew = isC ? !o.grid : (!o.grid && !o.base);
        if (o.base || o.grid || (isC && o.grid)) { DSZ.UI.openLoot(isC ? 'Corpse' : D[o.t].cont.name, o.grid || (o.grid = Inv.grid(D[o.t].cont.w, D[o.t].cont.h)), o); break; }
        S.search = { kind: f.kind, o, t: 0, total: isC ? 0.9 : 0.5 + (D[o.t].cont.w * D[o.t].cont.h) * 0.045 };
        break;
      }
      case 'car': {
        const c = f.ref; if (p.driving) { Game.exitCar(S); break; }
        if (c.drivable) Game.enterCar(S, c); else { // search the wreck
          if (c.grid) DSZ.UI.openLoot('Vehicle', c.grid, c); else S.search = { kind: 'car', o: c, t: 0, total: 1.4 };
        }
        break;
      }
      case 'bed': Game.trySleep(S); break;
      case 'fire': {
        const o = f.ref; let burned = false;
        const wood = Inv.has(p.inv, 'log') ? 'log' : (Inv.has(p.inv, 'stick') ? 'stick' : null);
        if (!o.lit && !(Inv.has(p.inv, 'lighter') || Inv.has(p.inv, 'matches'))) { Game.toast(S, 'You need a lighter or matches.'); break; }
        if (wood) { Inv.take(p.inv, wood, 1); o.fuel += I[wood].fuel; burned = true; Game.toast(S, 'Added ' + I[wood].name); A.play('ignite', f.x, f.y, 0.8); if (!o.lit) { o.lit = true; if (!o.light) Game.attachBaseLight(o); } } else Game.toast(S, 'You need logs or sticks.');
        break;
      }
      case 'rain': {
        const o = f.ref; const b = Inv.count(p.inv, 'bottle'); const n = Math.min(b, Math.floor(o.water || 0));
        if (n > 0) { Inv.take(p.inv, 'bottle', n); o.water -= n; Game.giveOrDrop(S, Inv.make('water', n)); A.play('drink'); Game.toast(S, 'Collected ' + n + ' water'); } else Game.toast(S, b ? 'Nothing collected yet. Wait for rain.' : 'You need empty bottles.');
        break;
      }
      case 'sink': { const b = Inv.count(p.inv, 'bottle'); if (b > 0) { Inv.take(p.inv, 'bottle', 1); Game.giveOrDrop(S, Inv.make('dirtywater')); A.play('drink'); Game.toast(S, 'Filled bottle (dirty). Boil it.'); } else Game.toast(S, 'You need an empty bottle.'); break; }
      case 'pump': {
        const o = f.ref; if (o.fuelLeft === undefined) o.fuelLeft = 10 + Math.random() * 30;
        const can = Inv.all(p.inv).find(x => x.id === 'gascan' && x.fuel < 100);
        if (!can) { Game.toast(S, 'You need a gas can.'); break; } if (o.fuelLeft <= 0.5) { Game.toast(S, 'The pump is dry.'); break; }
        const amt = Math.min(o.fuelLeft, 100 - can.fuel); can.fuel += amt; o.fuelLeft -= amt; A.play('drink'); Game.toast(S, 'Siphoned ' + Math.round(amt) + ' fuel'); break;
      }
    }
  }
  Game.enterCar = function (S, c) {
    const p = S.player; p.driving = c; c.engineOn = c.fuel > 0; p.x = c.x; p.y = c.y; A.play('door', c.x, c.y, 0.8);
    Game.toast(S, c.fuel > 0 ? 'W/S drive   A/D steer   Space handbrake   L lights   H horn   E exit' : 'No fuel. Find a gas can.');
    if (c.fuel > 0) { A.play('click'); E.noise(S, c.x, c.y, 14); }
  };
  Game.exitCar = function (S, eject) {
    const p = S.player, c = p.driving; if (!c) return;
    const ca = Math.cos(c.ang), sa = Math.sin(c.ang); let ok = false;
    for (const side of [-1, 1, -1.6, 1.6, 2.2, -2.2]) { const x = c.x - sa * side * 1.2, y = c.y + ca * side * 1.2; if (!W.hitCircle(x, y, 0.3)) { p.x = x; p.y = y; ok = true; break; } }
    if (!ok) { const f = W.freeNear(c.x, c.y, 4); p.x = f[0]; p.y = f[1]; }
    p.driving = null; c.engineOn = false; c.lightsOn = false; A.engine(false); A.play('door', c.x, c.y, 0.8);
  };
  Game.trySleep = function (S) {
    const p = S.player;
    for (const z of S.zombies) if (!z.dead && z.state === 'chase' && Math.hypot(z.x - p.x, z.y - p.y) < 25) { Game.toast(S, 'You cannot sleep with zombies hunting you.', 'bad'); return; }
    if (p.energy > 85) { Game.toast(S, 'You are not tired.'); return; }
    S.sleeping = { t: 0, startHour: S.hour, safe: 0 }; A.play('sleep');
  };

  // ---------------------------------------------------------------- per-frame player update
  function updatePlayer(S, dt) {
    const p = S.player, P = p.inv, ui = DSZ.UI;
    p.flash = Math.max(0, p.flash - dt * 4); p.hurt = Math.max(0, p.hurt - dt); p.muzzle = Math.max(0, p.muzzle - dt);
    S.muzzle = Math.max(0, S.muzzle - dt);
    // aim
    const mw = DSZ.Render.screenToWorld(In.mouse.x, In.mouse.y); S.mouse.wx = mw[0]; S.mouse.wy = mw[1];
    if (!p.driving) { p.aimAng = Math.atan2(mw[1] - p.y, mw[0] - p.x); const da = U.angDiff(p.ang, p.aimAng); p.ang += da * Math.min(1, dt * 18); }
    // held/loadout
    const h = held(S); p.heldDef = h ? I[h.id] : null;
    // god mode: the held weapon never degrades, jams or runs dry
    if (DSZ.settings.godmode && h) { const hd = I[h.id]; if (h.dur !== undefined && hd.dur) h.dur = hd.dur; if (hd.mag) h.mag = hd.mag; }
    p.aiming = In.mouse.rdown && !ui.blockMouse() && !S.build.active;
    // ---- driving
    if (p.driving) {
      const c = p.driving, k = S.carInput; k.thr = (In.down('KeyW') || In.down('ArrowUp') ? 1 : 0) - (In.down('KeyS') || In.down('ArrowDown') ? 1 : 0); k.str = (In.down('KeyD') || In.down('ArrowRight') ? 1 : 0) - (In.down('KeyA') || In.down('ArrowLeft') ? 1 : 0); k.hand = In.down('Space');
      if (In.pressed('KeyL')) { c.lightsOn = !c.lightsOn; A.play('click'); }
      if (In.pressed('KeyH')) { A.play('horn', c.x, c.y, 1.2, 70); E.noise(S, c.x, c.y, 45); }
      if (In.pressed('KeyG')) Game.refuelNearby(S);
      if (c.engineOn) { A.engine(true, Math.min(1, Math.abs(c.speed) / 12 + (k.thr ? 0.18 : 0.05)), 1); if (c.fuel <= 0) c.engineOn = false; } else A.engine(false);
      if (In.pressed('KeyE') && !ui.blockKeys()) Game.exitCar(S);
      p.x = c.x; p.y = c.y; p.moving = false; p.crouch = false; p.pose.crouch = false; p.pose.legs = 'idle'; S.stats.distance += Math.abs(c.speed) * dt / 1000; return;
    }
    // ---- movement
    let ix = (In.down('KeyD') || In.down('ArrowRight') ? 1 : 0) - (In.down('KeyA') || In.down('ArrowLeft') ? 1 : 0), iy = (In.down('KeyS') || In.down('ArrowDown') ? 1 : 0) - (In.down('KeyW') || In.down('ArrowUp') ? 1 : 0);
    if (S.sleeping || S.search && false) { ix = iy = 0; }
    let mx = 0, my = 0; const il = Math.hypot(ix, iy);
    if (il > 0) { ix /= il; iy /= il; mx = ix / 64 + iy / 32; my = iy / 32 - ix / 64; const l = Math.hypot(mx, my); mx /= l; my /= l; }
    p.sneak = In.down('ControlLeft') || In.down('KeyZ');
    // crouch: toggle with Left/Right Ctrl (walk speed and collision radius are unchanged; only the pose gets lower)
    if ((In.pressed('ControlLeft') || In.pressed('ControlRight')) && !ui.blockKeys()) p.crouch = !p.crouch;
    const wantRun = In.down('ShiftLeft') && il > 0 && p.stamina > 4 && !p.sneak && !p.crouch && !p.broken;
    p.running = wantRun;
    let spd = p.running ? 4.8 : (p.sneak ? 1.5 : 2.6);
    if (p.crouch) spd *= 0.7; // crouch = 70% of normal walk speed
    if (p.broken) spd *= 0.5; if (p.use) spd *= 0.6; if (p.atkT > 0) spd *= 0.65; if (p.stamina < 12) spd *= 0.8;
    const wt = Inv.weight(P); if (wt > 40) spd *= Math.max(0.6, 1 - (wt - 40) / 120);
    p.vx += (mx * spd - p.vx) * Math.min(1, dt * 14); p.vy += (my * spd - p.vy) * Math.min(1, dt * 14);
    const sp = Math.hypot(p.vx, p.vy); p.moving = sp > 0.3;
    if (sp > 0.01) { const r = W.moveCircle(p.x, p.y, p.vx * dt, p.vy * dt, 0.27); p.x = r.x; p.y = r.y; E.pushFromCars(S, p, 0.27); S.stats.distance += sp * dt / 1000; }
    if (p.running && p.moving) p.stamina = Math.max(0, p.stamina - 13 * dt); else p.stamina = Math.min(100, p.stamina + (p.moving ? 6 : 14) * dt);
    if (p.moving) { p.stepT -= dt * sp / 2.4; if (p.stepT <= 0) { p.stepT = 1; const shoe = P.equip.feet ? I[P.equip.feet.id] : null; const base = shoe && shoe.quiet !== undefined ? shoe.quiet : 4; const nz = p.running ? 9 : (p.sneak ? 1.2 : (p.crouch ? Math.min(2.2, base * 0.55) : base)); A.play(p.running ? 'stepRun' : 'step', p.x, p.y, p.sneak ? 0.3 : (p.crouch ? 0.4 : 0.6), 20); E.noise(S, p.x, p.y, nz); } }
    p.ph += sp * dt * 5.3;
    // ---- pose
    const gun = p.heldDef && p.heldDef.type === 'gun', mel = p.heldDef && p.heldDef.type === 'melee';
    p.pose.legs = p.moving ? (p.running ? 'run' : 'walk') : 'idle'; p.pose.lf = Math.floor(p.ph) & 7; p.pose.crouch = p.crouch;
    if (p.atkT > 0 && mel) { p.pose.arms = 'swing'; p.pose.af = Math.min(4, Math.floor((1 - p.atkT / p.atkTotal) * 5)); }
    else if (gun) { p.pose.arms = 'aim'; p.pose.af = 0; } else if (P.equip.light && p.lightOn && !mel) { p.pose.arms = 'light'; } else if (mel && p.aiming) { p.pose.arms = 'walk'; } else p.pose.arms = 'walk';
    // ---- hotbar select
    if (!ui.blockKeys()) for (let i = 0; i < 6; i++) if (In.pressed('Digit' + (i + 1))) { P.sel = P.sel === i ? -1 : i; A.play('click'); S.build.active = false; }
    if (In.mouse.wheel && !ui.blockMouse() && !In.down('ControlLeft')) S.cam.tz = U.clamp(S.cam.tz - In.mouse.wheel * 0.08, 0.7, 1.5);
    if (!ui.blockKeys()) {
      if (In.pressed('KeyF')) Game.toggleLight(S);
      if (In.pressed('KeyR') && !S.build.active) Game.reload(S);
      if (In.pressed('KeyQ')) Game.dropSelected(S);
      if (In.pressed('KeyG')) Game.refuelNearby(S);
    }
    // reload progress
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { const it = p.reloadItem, d = I[it.id]; const need = d.mag - it.mag, have = Inv.count(P, d.ammo), n = Math.min(need, have); Inv.take(P, d.ammo, n); it.mag += n; Game.toast(S, 'Reloaded'); } if (held(S) !== p.reloadItem) p.reload = 0; }
    // ---- attacks
    p.cool = Math.max(0, p.cool - dt);
    const canAct = !ui.blockMouse() && !S.build.active && !S.sleeping && !p.dead;
    if (p.atkT > 0) { p.atkT -= dt; if (!p.atkDone && p.atkT < p.atkTotal * 0.55) { p.atkDone = true; E.melee(S, p, p.atkDef, p.atkItem); if (p.atkItem && p.atkItem.dur !== undefined && p.atkItem.dur <= 0) { Game.toast(S, I[p.atkItem.id].name + ' broke!', 'bad'); Inv.removeItem(P, p.atkItem); } } }
    if (canAct && p.cool <= 0 && p.reload <= 0) {
      const wantsFire = p.heldDef && p.heldDef.auto ? In.mouse.down : In.mouse.clicked;
      if (wantsFire && In.mouse.down) {
        if (!h) { // fists
          const fd = I.fists; p.cool = fd.rate; p.atkT = p.atkTotal = 0.3; p.atkDone = false; p.atkDef = fd; p.atkItem = null; p.stamina = Math.max(0, p.stamina - fd.stam); }
        else if (gun) {
          if (h.mag > 0) { h.mag--; p.cool = p.heldDef.rate; E.shoot(S, p, p.heldDef, h); h.dur -= 0.12; if (h.dur <= 0) { Game.toast(S, 'Weapon jammed beyond repair!', 'bad'); Inv.removeItem(P, h); } }
          else { A.play('empty', p.x, p.y, 0.6); p.cool = 0.3; if (Inv.count(P, p.heldDef.ammo) > 0) Game.reload(S); else Game.toast(S, 'Out of ammo'); }
        } else if (mel) { if (p.stamina > p.heldDef.stam * 0.5) { p.cool = p.heldDef.rate; p.atkT = p.atkTotal = Math.min(0.45, p.heldDef.rate * 0.7); p.atkDone = false; p.atkDef = p.heldDef; p.atkItem = h; p.stamina = Math.max(0, p.stamina - p.heldDef.stam); } }
        else if (p.heldDef.type === 'food' || p.heldDef.type === 'drink' || p.heldDef.type === 'med') { if (In.mouse.clicked) { Game.useItem(S, h); if (!P.hot[P.sel]) P.sel = -1; p.cool = 0.5; } }
      }
    }
    // ---- interaction
    S.focus = (p.dead || S.build.active) ? null : findFocus(S);
    if (S.search) {
      const s = S.search, d = Math.hypot((s.o.x !== undefined ? s.o.x + (s.kind === 'cont' ? 0.5 : 0) : 0) - p.x, (s.o.y !== undefined ? s.o.y + (s.kind === 'cont' ? 0.5 : 0) : 0) - p.y);
      if (d > 2.6 || p.moving && s.t > 0.05 && Math.hypot(p.vx, p.vy) > 1.4) { S.search = null; }
      else { s.t += dt; if (s.t >= s.total) { Game.finishSearch(S, s); S.search = null; } }
    } else if (S.prying) {
      const s = S.prying; if (!In.down('KeyE') || Math.hypot(s.o.x + 0.5 - p.x, s.o.y + 0.5 - p.y) > 2.4) { S.prying = null; }
      else { s.t += dt; if (Math.random() < dt * 4) { A.play('thud', s.o.x + 0.5, s.o.y + 0.5, 0.5); E.noise(S, s.o.x + 0.5, s.o.y + 0.5, 12); } if (s.t >= s.total) { s.o.locked = false; s.o.open = true; W.refresh(s.o.x, s.o.y); A.play('doorBreak', s.o.x + 0.5, s.o.y + 0.5, 1); E.noise(S, s.o.x + 0.5, s.o.y + 0.5, 22); Game.toast(S, 'Door forced open'); S.prying = null; } }
    } else if (In.pressed('KeyE') && !ui.blockKeys()) doInteract(S);
    if (In.down('KeyE') && S.focus && S.focus.kind === 'door' && S.focus.ref.locked && !S.focus.ref.open && !S.prying && In.down('KeyE') && !In.pressed('KeyE') && (Inv.has(P, 'crowbar') || Inv.has(P, 'axe'))) S.prying = { o: S.focus.ref, t: 0, total: 2.4 };
  }
  Game.finishSearch = function (S, s) {
    const o = s.o;
    if (s.kind === 'cont') { o.searched = true; const g = Inv.fillContainer(o, rnd); S.stats.looted++; DSZ.UI.openLoot(D[o.t].cont.name, g, o); }
    else if (s.kind === 'corpse') { o.searched = true; o.grid = Inv.grid(4, 3); for (const r of DSZ.rollLoot(rnd, 'zombie', 0)) Inv.addTo(o.grid, Inv.make(r.id, r.q, r)); DSZ.UI.openLoot('Corpse', o.grid, o); }
    else { o.grid = Inv.grid(5, 3); for (const r of DSZ.rollLoot(rnd, rnd() < 0.5 ? 'car' : 'cartrunk', 0)) Inv.addTo(o.grid, Inv.make(r.id, r.q, r)); DSZ.UI.openLoot('Vehicle', o.grid, o); }
    A.play('pickup');
  };

  // ---------------------------------------------------------------- survival stats, world systems
  function updateSurvival(S, dt) {
    const p = S.player, P = p.inv; if (p.dead) return;
    // god mode: no needs, no bleed/infection, full stamina (settings > God mode)
    const god = DSZ.settings.godmode;
    if (god) { p.bleed = 0; p.infection = 0; p.stamina = 100; }
    const sleepMul = S.sleeping ? 0.4 : 1;
    if (!god) {
      p.food = Math.max(0, p.food - 0.042 * dt * sleepMul * (p.running ? 1.5 : 1)); p.water = Math.max(0, p.water - 0.066 * dt * sleepMul * (p.running ? 1.6 : 1)); p.energy = Math.max(0, p.energy - 0.012 * dt * (S.sleeping ? 0 : 1));
      let dmg = 0; if (p.food <= 0) dmg += 0.25; if (p.water <= 0) dmg += 0.4; if (p.energy <= 0) dmg += 0.1; if (p.bleed > 0) { dmg += 0.55 * p.bleed; p.bleed = Math.max(0, p.bleed - 0.012 * dt); if (Math.random() < dt * 1.2) E.blood(S, p.x, p.y, Math.random() * 6.28, 1, 0.1); }
      if (p.infection > 0) { p.infection = Math.min(100, p.infection + 0.07 * dt); if (p.infection > 45) dmg += (p.infection - 45) * 0.01; if (p.infection >= 100) { Game.die(S, 'infection'); return; } }
      if (dmg > 0) { p.hp -= dmg * dt; if (p.hp <= 0) { Game.die(S, p.water <= 0 ? 'thirst' : (p.food <= 0 ? 'hunger' : (p.bleed > 0 ? 'bleeding' : 'infection'))); return; } }
    }
    else if (p.food > 45 && p.water > 45 && p.hp < 100 && p.infection < 20) p.hp = Math.min(100, p.hp + (S.sleeping ? 0.8 : 0.16) * dt);
    if (p.food < 15 && !p.warnedF) { p.warnedF = 1; Game.toast(S, 'You are starving.', 'bad'); } if (p.food > 25) p.warnedF = 0;
    if (p.water < 15 && !p.warnedW) { p.warnedW = 1; Game.toast(S, 'You are dehydrated.', 'bad'); } if (p.water > 25) p.warnedW = 0;
    if (p.energy < 15 && !p.warnedE) { p.warnedE = 1; Game.toast(S, 'You are exhausted. Find a bed.', 'bad'); } if (p.energy > 25) p.warnedE = 0;
    // light fuel/battery (god mode: lights never die)
    const L = P.equip.light;
    if (L && p.lightOn && !god) {
      if (L.bat !== undefined) { L.bat -= dt * 0.28; p.lightFlick = L.bat < 14 ? (Math.random() < 0.12 ? 0.6 : 0) : 0; if (L.bat <= 0) { L.bat = 0; p.lightOn = false; Game.toast(S, 'Flashlight died.'); } }
      if (L.burn !== undefined) { L.burn -= dt; if (L.burn <= 0) { L.burn = 0; p.lightOn = false; Game.toast(S, 'Your light burned out.'); if (L.id === 'torch') { P.equip.light = null; Game.refreshEquipVisuals(S); } } }
    }
    // base fires / rain collectors
    S.baseT = (S.baseT || 0) - dt;
    if (S.baseT <= 0) {
      S.baseT = 1; const tx = Math.floor(p.x), ty = Math.floor(p.y);
      for (let y = ty - 20; y <= ty + 20; y++) for (let x = tx - 20; x <= tx + 20; x++) {
        const o = W.getObj(x, y); if (!o || !o.base) continue;
        if (o.fuel !== undefined) { if (o.lit) { o.fuel -= 1; if (o.fuel <= 0) { o.lit = false; o.fuel = 0; if (o.light) { W.removeLight(o.light); o.light = null; } } } }
        if (o.t === O.BRAIN && S.weather.rain > 0.2) o.water = Math.min(8, (o.water || 0) + 0.12 * S.weather.rain);
      }
    }
    // ambient base fire smoke
    // toasts decay
    for (let i = S.toasts.length - 1; i >= 0; i--) { S.toasts[i].t -= dt; if (S.toasts[i].t <= 0) S.toasts.splice(i, 1); }
  }
  function updateWorld(S, dt) {
    const w = S.weather;
    S.time += dt; S.hour += dt * 24 / C.DAY_LEN * (S.sleeping ? 1 : 1); if (S.hour >= 24) { S.hour -= 24; S.day++; Game.toast(S, 'Day ' + S.day); }
    w.t -= dt; if (w.t <= 0) { w.t = 90 + Math.random() * 180; w.target = U.weighted(Math.random, [[0, 5], [0.45, 2], [1, 2]]); }
    w.rain += (w.target - w.rain) * Math.min(1, dt * 0.2);
    w.flash = Math.max(0, w.flash - dt * 2.2);
    if (w.rain > 0.7) { w.lt -= dt; if (w.lt <= 0) { w.lt = 12 + Math.random() * 30; w.flash = 1; w.thunder = 0.4 + Math.random() * 1.5; } }
    if (w.thunder > 0) { w.thunder -= dt; if (w.thunder <= 0) { A.play('explosion', S.player.x, S.player.y, 0.5, 400); } }
    const night = 1 - DSZ.Render.daylight(S.hour); A.setAmbient(night, w.rain);
    A.setListener(S.player.x, S.player.y);
    // rain splashes
    if (w.rain > 0.1 && Math.random() < dt * w.rain * 40) { const a = Math.random() * 6.28, d = Math.random() * 10; E.particle(S, { type: 'splash', x: S.player.x + Math.cos(a) * d, y: S.player.y + Math.sin(a) * d, z: 0, vx: 0, vy: 0, vz: 0, life: 0.35 }); }
    // dynamic zombie spawns around the player
    S.spawnT -= dt;
    if (S.spawnT <= 0) {
      S.spawnT = 14 - night * 6 + Math.random() * 8; const p = S.player;
      if (S.zombies.length < 520 && (S.activeZ || 0) < 55 + night * 25) {
        for (let k = 0; k < 14; k++) {
          const a = Math.random() * 6.28, d = 26 + Math.random() * 10, x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
          if (!W.inb(Math.floor(x), Math.floor(y)) || W.isSolid(Math.floor(x), Math.floor(y)) || W.insideBuilding(x, y) || W.los(p.x, p.y, x, y) && d < 30) continue;
          const type = U.weighted(Math.random, [['walker', 80], ['runner', 6 + night * 10], ['brute', 3], ['crawler', 4]]);
          const z = E.spawnZombie(S, x, y, type); z.state = 'investigate'; z.tx = p.x + (Math.random() - 0.5) * 8; z.ty = p.y + (Math.random() - 0.5) * 8; z.alert = 14; z.sleeper = false; break;
        }
      }
    }
  }
  function updateSleep(S, dt) {
    const s = S.sleeping; if (!s) return; const p = S.player;
    // fast-forward: ~1 game hour per real second
    const steps = 20, step = dt * 60 / steps * 1.0;
    s.t += dt; S.hour += (dt * 60) * (24 / C.DAY_LEN); if (S.hour >= 24) { S.hour -= 24; S.day++; }
    p.energy = Math.min(100, p.energy + 14 * dt); p.hp = Math.min(100, p.hp + 3 * dt * (p.food > 20 && p.water > 20 ? 1 : 0));
    p.crouch = false; p.pose.crouch = false; // standing up resets the crouch toggle
    S.weather.rain += (S.weather.target - S.weather.rain) * Math.min(1, dt * 2);
    for (const z of S.zombies) if (!z.dead && z.state === 'chase' && Math.hypot(z.x - p.x, z.y - p.y) < 14) { S.sleeping = null; Game.toast(S, 'Something woke you up!', 'bad'); return; }
    if (p.energy >= 100 || s.t > 8) { S.sleeping = null; Game.toast(S, 'You wake up refreshed.'); }
  }
  function updateCamera(S, dt) {
    const p = S.player, cam = S.cam;
    const look = p.aiming ? 0.42 : 0.2; let tx = p.x, ty = p.y;
    if (!p.driving && !DSZ.UI.blockMouse()) { tx += (S.mouse.wx - p.x) * look; ty += (S.mouse.wy - p.y) * look; }
    if (p.driving) { tx += p.driving.vx * 0.35; ty += p.driving.vy * 0.35; }
    const k = Math.min(1, dt * (p.driving ? 3.5 : 6)); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    const tz = cam.tz * (p.driving ? 0.88 : 1); cam.zoom += (tz - cam.zoom) * Math.min(1, dt * 3);
    cam.shake = Math.max(0, cam.shake - dt * 3);
  }

  // ---------------------------------------------------------------- main update
  Game.update = function (S, dt) {
    if (S.paused) return;
    if (S.state === 'dead') { updateWorldLite(S, dt); return; }
    updateWorld(S, dt);
    updatePlayer(S, dt);
    updateBuild(S, dt);
    updateSurvival(S, dt);
    updateSleep(S, dt);
    E.updateZombies(S, dt); E.updateCars(S, dt); E.updateParticles(S, dt);
    updateCamera(S, dt);
    // autosave is spread over several frames so it never stalls the game loop
    S.saveT -= dt; if (S.saveT <= 0) { S.saveT = 60; Game.saveBegin(S); }
    Game.saveStep(4);
  };
  function updateWorldLite(S, dt) { S.time += dt; S.hour += dt * 24 / C.DAY_LEN; E.updateParticles(S, dt); E.updateZombies(S, dt); E.updateCars(S, dt); updateCamera(S, dt); S.cam.zoom += (1.25 - S.cam.zoom) * dt; }

  // ---------------------------------------------------------------- save / load
  let saveJob = null;
  function scanSaveRows(S, y0, y1, mods, base) {
    for (let y = y0; y < y1; y++) for (let x = 0; x < C.W; x++) {
      const o = W.obj[y * C.W + x]; if (!o) continue;
      if (o.base) { base.push({ t: o.t, x, y, f: o.f, open: o.open, hp: o.hp, fuel: o.fuel, lit: o.lit, water: o.water, grid: o.grid }); }
      else if (o.grid || o.searched || o.broken || o.chop || o.open !== undefined && o.open !== o.open0 || o.hp !== undefined && o.maxhp && o.hp < o.maxhp) mods.push({ x, y, grid: o.grid, searched: o.searched, broken: o.broken, open: o.open, locked: o.locked, hp: o.hp, chop: o.chop });
    }
  }
  function savePayload(S, mods, base) {
    const p = S.player;
    return {
      v: 1, seed: S.seed, hour: S.hour, day: S.day, stats: S.stats, weather: { rain: S.weather.rain, target: S.weather.target },
      player: { x: p.x, y: p.y, hp: p.hp, food: p.food, water: p.water, stamina: p.stamina, energy: p.energy, infection: p.infection, bleed: p.bleed, broken: p.broken, inv: p.inv, lightOn: p.lightOn },
      mods, base, removed: W.removed, drops: S.drops, cars: S.cars.map(c => ({ x: c.x, y: c.y, ang: c.ang, state: c.state, hp: c.hp, fuel: c.fuel, drivable: c.drivable, dead: c.dead, grid: c.grid, kind: c.kind, color: c.color, lightsOn: c.lightsOn }))
    };
  }
  Game.save = function (S) {
    S = S || Game.S; if (!S || S.state !== 'play') return false;
    saveJob = null;
    try {
      const mods = [], base = [];
      scanSaveRows(S, 0, C.H, mods, base);
      localStorage.setItem('dsz_save', JSON.stringify(savePayload(S, mods, base))); S.lastSave = Date.now(); return true;
    } catch (e) { console.warn('save failed', e); return false; }
  };
  // non-blocking autosave: spread the world scan over several frames, then write once
  Game.saveBegin = function (S) {
    S = S || Game.S; if (!S || S.state !== 'play') return false;
    saveJob = { S, y: 0, mods: [], base: [] };
    return true;
  };
  Game.saveStep = function (rows) {
    const j = saveJob; if (!j) return false;
    if (j.S !== Game.S || j.S.state !== 'play') { saveJob = null; return false; }
    const n = rows || 4, y1 = Math.min(C.H, j.y + n);
    scanSaveRows(j.S, j.y, y1, j.mods, j.base);
    j.y = y1;
    if (j.y < C.H) return false;
    try {
      localStorage.setItem('dsz_save', JSON.stringify(savePayload(j.S, j.mods, j.base)));
      j.S.lastSave = Date.now();
    } catch (e) { console.warn('save failed', e); }
    saveJob = null; return true;
  };
  Game.hasSave = () => { try { return !!localStorage.getItem('dsz_save'); } catch (e) { return false; } };
  Game.readSave = () => { try { return JSON.parse(localStorage.getItem('dsz_save')); } catch (e) { return null; } };
  Game.deleteSave = () => { try { localStorage.removeItem('dsz_save'); } catch (e) { /* */ } };
  Game.applySave = function (S, d) {
    const p = S.player; S.hour = d.hour; S.day = d.day; Object.assign(S.stats, d.stats); S.weather.rain = d.weather.rain; S.weather.target = d.weather.target;
    Object.assign(p, d.player); p.inv = d.player.inv; Inv.migrateEquip(p.inv, Game.dropFn(S)); Inv.refreshBag(p.inv); p.dead = false; p.vx = p.vy = 0;
    for (const idx of d.removed || []) { const x = idx % C.W, y = (idx / C.W) | 0; const o = W.getObj(x, y); if (o && !o.base) { W.removeObj(x, y); } }
    for (const m of d.mods || []) { const o = W.getObj(m.x, m.y); if (!o) continue; if (m.grid) o.grid = m.grid; if (m.searched) o.searched = true; if (m.broken) o.broken = true; if (m.open !== undefined) o.open = m.open; if (m.locked !== undefined) o.locked = m.locked; if (m.hp !== undefined) o.hp = m.hp; if (m.chop) o.chop = m.chop; W.refresh(m.x, m.y); }
    for (const b of d.base || []) { const o = { t: b.t, f: b.f, v: 0, base: true, b: 0, open: b.open, hp: b.hp, fuel: b.fuel, lit: b.lit, water: b.water, grid: b.grid }; W.setObj(b.x, b.y, o); if (D[b.t].fire && b.lit || b.t === O.BLAMP) Game.attachBaseLight(o); }
    S.drops = d.drops || []; S.cars.length = 0; for (const c of d.cars || []) { const car = E.spawnCar(S, { x: c.x, y: c.y, ang: c.ang, kind: c.kind, color: c.color, state: c.state, seed: 1 }); Object.assign(car, { hp: c.hp, fuel: c.fuel, drivable: c.drivable, dead: c.dead, grid: c.grid, lightsOn: c.lightsOn }); }
    S.cam.x = p.x; S.cam.y = p.y; Game.refreshEquipVisuals(S); DSZ.Render.dirtyAll();
  };
})();
