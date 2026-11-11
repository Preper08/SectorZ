/* Dead SectorZ — DOM UI: HUD, grid inventory with drag & drop, crafting, build bar, maps, menus */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, C = DSZ.C, W = DSZ.World, O = DSZ.O, I = DSZ.ITEMS, Inv = DSZ.Inv, A = DSZ.Audio, In = DSZ.Input;
  const $ = id => document.getElementById(id);
  const UI = DSZ.UI = { open: { win: false, tab: 'inv', map: false, menu: false, settings: false, controls: false, title: true, death: false }, loot: null, drag: null };
  const CELL = 44;
  let S = null, els = {}, imgCache = {}, craftTab = 'Survival', craftSel = null, hudT = 0, hotSig = '', toastSig = '', hovered = null, mmCanvas = null, mapRendered = null;

  const img = id => { let u = imgCache[id]; if (!u) u = imgCache[id] = DSZ.Icons.get(id).toDataURL(); return u; };
  UI.img = img;
  UI.blockMouse = () => UI.open.win || UI.open.map || UI.open.menu || UI.open.settings || UI.open.controls || UI.open.title || UI.open.death;
  UI.blockKeys = () => UI.open.menu || UI.open.settings || UI.open.controls || UI.open.title || UI.open.death;
  UI.isModal = () => UI.open.menu || UI.open.settings || UI.open.title || UI.open.death || UI.open.controls;

  // ------------------------------------------------------------------ init
  UI.init = function () {
    for (const id of ['hud', 'win', 'tip', 'dragghost', 'mapwin', 'pause', 'settings', 'controls', 'death', 'title', 'loading', 'cursor', 'vitals', 'clk', 'dayl', 'wx', 'toasts', 'prompt', 'progress', 'proglabel', 'hotbar', 'buildbar', 'fps', 'equip', 'condition', 'g-pants', 'pantstitle', 'g-bag', 'bagtitle', 'g-loot', 'lootcol', 'loottitle', 'crafttabs', 'craftlist', 'craftdetail', 'tab-inv', 'tab-craft', 'tab-admin', 'admin-search', 'admin-list', 'tab-admin-btn', 'bigmap', 'mm', 'setbody', 'ctlbody', 'lbar', 'ltxt', 'deathwhy', 'deathstats', 'takeall', 'ver']) els[id] = $(id);
    els.ver.textContent = 'v' + C.VERSION;
    // tabs
    document.querySelectorAll('#win .tabs button').forEach(b => b.addEventListener('click', () => UI.showTab(b.dataset.tab)));
    $('winx').onclick = () => UI.closeWin(); $('mapx').onclick = () => UI.closeMap();
    $('takeall').onclick = takeAll;
    $('m-resume').onclick = () => UI.toggleMenu(false);
    $('m-save').onclick = () => { if (DSZ.Game.save(S)) DSZ.Game.toast(S, 'Game saved'); };
    $('m-settings').onclick = () => { UI.open.menu = false; els.pause.classList.add('hidden'); UI.showSettings(true); };
    $('m-quit').onclick = () => { DSZ.Game.save(S); DSZ.Main.toTitle(); };
    $('set-x').onclick = () => UI.showSettings(false); $('ctl-x').onclick = () => UI.showControls(false);
    $('d-again').onclick = () => DSZ.Main.startNew(); $('d-title').onclick = () => DSZ.Main.toTitle();
    $('t-new').onclick = () => { A.init(); DSZ.Main.startNew(); }; $('t-continue').onclick = () => { A.init(); DSZ.Main.cont(); };
    $('t-controls').onclick = () => UI.showControls(true); $('t-settings').onclick = () => UI.showSettings(true);
    document.querySelectorAll('button').forEach(b => b.addEventListener('mouseenter', () => { if (A.ready) A.play('click', null, null, 0.25); }));
    // hotbar
    for (let i = 0; i < 6; i++) { const d = document.createElement('div'); d.className = 'hslot'; d.dataset.slot = i; d.innerHTML = '<span class="k">' + (i + 1) + '</span>'; d.addEventListener('mousedown', e => hotDown(e, i)); d.addEventListener('contextmenu', e => { e.preventDefault(); const it = S.player.inv.hot[i]; if (it) { DSZ.Game.useItem(S, it); } }); d.addEventListener('mouseenter', () => { const it = S.player.inv.hot[i]; if (it) showTip(it, d); }); d.addEventListener('mouseleave', hideTip); els.hotbar.appendChild(d); }
    // mouse for drag
    window.addEventListener('mousemove', e => { els.cursor.style.left = e.clientX + 'px'; els.cursor.style.top = e.clientY + 'px'; dragMove(e); if (!els.tip.classList.contains('hidden')) posTip(e); });
    window.addEventListener('mouseup', dragUp);
    els.cursor.classList.remove('hidden');
    buildSettings(); buildControls();
    DSZ.on('death', s => UI.showDeath(s));
  };
  UI.setState = s => { S = s; hotSig = ''; toastSig = ''; mapRendered = null; mmCanvas = null; };

  // ------------------------------------------------------------------ windows
  UI.showTab = function (t) {
    UI.open.tab = t; document.querySelectorAll('#win .tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    els['tab-admin-btn'].classList.toggle('hidden', !DSZ.settings.godmode); // admin tab exists only in god mode
    els['tab-inv'].classList.toggle('hidden', t !== 'inv'); els['tab-craft'].classList.toggle('hidden', t !== 'craft'); els['tab-admin'].classList.toggle('hidden', t !== 'admin');
    if (t === 'craft') renderCraft(); else if (t === 'admin') renderAdmin(); else renderInv();
  };
  UI.openWin = function (tab) { UI.open.win = true; els.win.classList.remove('hidden'); UI.showTab(tab || UI.open.tab || 'inv'); A.play('click', null, null, 0.4); };
  UI.closeWin = function () { cancelDrag(); UI.open.win = false; UI.loot = null; els.win.classList.add('hidden'); hideTip(); els.lootcol.classList.add('hidden'); };
  UI.toggleWin = function (tab) { if (UI.open.win && UI.open.tab === tab) UI.closeWin(); else UI.openWin(tab); };
  UI.openLoot = function (title, grid, owner) { UI.loot = { title, grid, owner }; UI.openWin('inv'); };
  UI.openMap = function () { if (!Inv.has(S.player.inv, 'map')) { DSZ.Game.toast(S, 'You need a Town Map.'); return; } UI.open.map = true; els.mapwin.classList.remove('hidden'); drawBigMap(); };
  UI.closeMap = function () { UI.open.map = false; els.mapwin.classList.add('hidden'); };
  UI.toggleMenu = function (v) { v = v === undefined ? !UI.open.menu : v; UI.open.menu = v; els.pause.classList.toggle('hidden', !v); if (S) S.paused = v; if (v) { cancelDrag(); A.engine(false); } };
  UI.showSettings = function (v) { UI.open.settings = v; els.settings.classList.toggle('hidden', !v); if (v) buildSettings(); else if (!UI.open.title && S && S.state === 'play') { UI.toggleMenu(true); } };
  UI.showControls = function (v) { UI.open.controls = v; els.controls.classList.toggle('hidden', !v); };
  UI.showTitle = function (v) {
    UI.open.title = v; els.title.classList.toggle('hidden', !v); els.hud.classList.toggle('hidden', v);
    $('t-continue').disabled = !DSZ.Game.hasSave(); if (v) { els.win.classList.add('hidden'); UI.open.win = false; UI.open.menu = false; els.pause.classList.add('hidden'); UI.open.death = false; els.death.classList.add('hidden'); }
  };
  UI.showLoading = function (v, txt, p) { $('loading').classList.toggle('hidden', !v); if (txt) $('ltxt').textContent = txt; if (p !== undefined) $('lbar').style.width = (p * 100) + '%'; };
  UI.showDeath = function (s) {
    UI.open.death = true; UI.closeWin(); UI.closeMap(); els.death.classList.remove('hidden'); DSZ.Game.deleteSave();
    const why = { bite: 'Torn apart by the dead.', blast: 'Caught in an explosion.', crash: 'Killed in a crash.', hunger: 'You starved to death.', thirst: 'You died of thirst.', bleeding: 'You bled out.', infection: 'The infection took you.' }[s.deathCause] || 'You did not make it.';
    els.deathwhy.textContent = why;
    const hrs = ((s.day - 1) * 24 + s.hour - C.START_HOUR);
    els.deathstats.innerHTML = '<span>Time survived</span><span>' + Math.floor(hrs / 24) + ' d ' + Math.floor(hrs % 24) + ' h</span><span>Zombies killed</span><span>' + s.stats.kills + '</span><span>Containers searched</span><span>' + s.stats.looted + '</span><span>Structures built</span><span>' + s.stats.built + '</span><span>Distance on foot</span><span>' + s.stats.distance.toFixed(1) + ' km</span>';
  };
  UI.hideDeath = function () { UI.open.death = false; els.death.classList.add('hidden'); };

  // ------------------------------------------------------------------ tooltip
  function itemTip(it) {
    const d = I[it.id], rows = [];
    const add = (k, v) => rows.push('<span>' + k + '</span><span>' + v + '</span>');
    if (d.dmg) add('Damage', d.pellets ? d.dmg + ' x' + d.pellets : d.dmg);
    if (d.range && d.type === 'melee') add('Reach', d.range.toFixed(1));
    if (d.type === 'gun') { add('Magazine', it.mag + ' / ' + d.mag); add('Ammo', I[d.ammo].name); add('Range', d.range); }
    if (it.dur !== undefined && d.dur) add('Condition', Math.max(0, Math.round(it.dur / d.dur * 100)) + '%');
    if (d.food) add('Food', '+' + d.food); if (d.water) add('Water', (d.water > 0 ? '+' : '') + d.water); if (d.heal) add('Health', '+' + d.heal);
    if (d.def) add('Protection', d.def);
    if (d.type === 'light' && it.bat !== undefined) add('Battery', Math.round(it.bat) + '%'); if (it.burn !== undefined) add('Burn time', Math.round(it.burn) + 's');
    if (it.fuel !== undefined && d.type === 'fuel') add('Fuel', Math.round(it.fuel) + ' / ' + d.maxfuel);
    if (d.sick) add('Risk', 'Sickness');
    if (d.cols) add(d.slot === 'legs' ? 'Pockets' : 'Storage', d.cols + ' × ' + d.rows);
    if (d.quiet !== undefined) add('Noise', d.quiet);
    add('Size', d.w + ' × ' + d.h);
    return '<div class="t">' + d.type + '</div><b>' + d.name + (it.q > 1 ? ' ×' + it.q : '') + '</b>' + (d.desc ? '<div class="d">' + d.desc + '</div>' : '') + '<div class="s">' + rows.join('') + '</div>';
  }
  function showTip(it, el) { els.tip.innerHTML = itemTip(it); els.tip.classList.remove('hidden'); const r = el.getBoundingClientRect(); placeTip(r.right + 8, r.top); }
  function placeTip(x, y) { const t = els.tip, w = t.offsetWidth, h = t.offsetHeight; t.style.left = Math.min(window.innerWidth - w - 6, x) + 'px'; t.style.top = Math.min(window.innerHeight - h - 6, y) + 'px'; }
  function posTip(e) { if (hovered) placeTip(e.clientX + 16, e.clientY + 14); }
  function hideTip() { hovered = null; els.tip.classList.add('hidden'); }

  // ------------------------------------------------------------------ inventory rendering
  function gridEl(name) { return name === 'bag' ? els['g-bag'] : name === 'pants' ? els['g-pants'] : els['g-loot']; }
  function gridObj(name) { const P = S.player.inv; return name === 'bag' ? P.bagGrid : name === 'pants' ? P.pantsGrid : (UI.loot && UI.loot.grid); }
  function itemEl(it, name) {
    const d = I[it.id], [w, h] = Inv.size(it), e = document.createElement('div'); e.className = 'gi';
    e.style.cssText = 'left:' + (it.x * CELL) + 'px;top:' + (it.y * CELL) + 'px;width:' + (w * CELL) + 'px;height:' + (h * CELL) + 'px';
    let html = '<img src="' + img(it.id) + '"' + (it.rot ? ' style="transform:rotate(90deg);width:' + (h * 88 / w) + '%;height:' + (w * 88 / h) + '%"' : '') + '>';
    if (it.q > 1) html += '<span class="q">' + it.q + '</span>';
    if (d.type === 'gun') html += '<span class="q" style="left:3px;right:auto">' + it.mag + '</span>';
    if (it.dur !== undefined && d.dur) { const f = U.clamp(it.dur / d.dur, 0, 1); html += '<div class="dur"><i style="width:' + (f * 100) + '%;background:' + (f < 0.3 ? 'var(--bad)' : f < 0.6 ? 'var(--accent)' : 'var(--good)') + '"></i></div>'; }
    if (d.type === 'light' && it.bat !== undefined) html += '<div class="dur"><i style="width:' + it.bat + '%"></i></div>';
    if (d.type === 'fuel') html += '<div class="dur"><i style="width:' + (it.fuel / d.maxfuel * 100) + '%;background:#c8483c"></i></div>';
    e.innerHTML = html;
    e.addEventListener('mousedown', ev => { if (ev.button === 0) startDrag(ev, it, { type: 'grid', name, x: it.x, y: it.y, rot: !!it.rot }); });
    e.addEventListener('contextmenu', ev => { ev.preventDefault(); quick(it, name); });
    e.addEventListener('dblclick', () => quick(it, name));
    e.addEventListener('mouseenter', () => { hovered = it; showTip(it, e); }); e.addEventListener('mouseleave', hideTip);
    return e;
  }
  function renderGrid(name) {
    const el = gridEl(name), g = gridObj(name); if (!g) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.style.width = (g.w * CELL + 2) + 'px'; el.style.height = (g.h * CELL + 2) + 'px'; el.innerHTML = '';
    for (const it of g.items) el.appendChild(itemEl(it, name));
  }
  const EQ = [['head', 'Head'], ['body', 'Body'], ['vest', 'Vest'], ['legs', 'Legs'], ['feet', 'Feet'], ['bag', 'Bag'], ['light', 'Light']];
  function renderEquip() {
    const P = S.player.inv; els.equip.innerHTML = '';
    for (const [k, lab] of EQ) {
      const s = document.createElement('div'); s.className = 'eqslot'; s.dataset.eq = k; s.innerHTML = '<span class="lbl">' + lab + '</span>';
      const it = P.equip[k];
      if (it) { const im = document.createElement('img'); im.src = img(it.id); im.draggable = false; im.addEventListener('mousedown', e => { if (e.button === 0) startDrag(e, it, { type: 'equip', slot: k }); }); im.addEventListener('contextmenu', e => { e.preventDefault(); quick(it, 'equip'); }); s.addEventListener('mouseenter', () => { hovered = it; showTip(it, s); }); s.addEventListener('mouseleave', hideTip); s.appendChild(im); }
      els.equip.appendChild(s);
    }
    const hint = document.createElement('div'); hint.style.cssText = 'font-size:12px;color:var(--dim);margin-top:4px;width:276px'; hint.textContent = 'Drag items between grids. Right-click to use / equip / move. R rotates while dragging. Weapons go on the hotbar.'; els.equip.appendChild(hint);
  }
  function renderCondition() {
    const p = S.player, hrs = ((S.day - 1) * 24 + S.hour - C.START_HOUR);
    const rows = [['Health', Math.round(p.hp) + ' / 100'], ['Hunger', Math.round(p.food) + '%'], ['Thirst', Math.round(p.water) + '%'], ['Energy', Math.round(p.energy) + '%'], ['Protection', Inv.armor(p.inv)], ['Carry weight', Inv.weight(p.inv).toFixed(1) + ' kg'], ['Infection', p.infection > 0 ? (p.infection > 30 ? Math.round(p.infection) + '%' : 'Unknown') : 'None'], ['Survived', Math.floor(hrs / 24) + 'd ' + Math.floor(hrs % 24) + 'h'], ['Zombies killed', S.stats.kills]];
    els.condition.innerHTML = '<div class="cond">' + rows.map(r => '<span>' + r[0] + '</span><span>' + r[1] + '</span>').join('') + '</div>';
  }
  function renderInv() {
    if (!S) return; renderEquip(); renderCondition();
    const P = S.player.inv;
    // the pants pockets replace the old fixed 'Pockets' grid: the section title becomes
    // the main storage header while trousers are worn, and hides when they are not
    els['pantstitle'].classList.toggle('hidden', !P.pantsGrid);
    els['pantstitle'].textContent = P.equip.legs ? I[P.equip.legs.id].name + ' pockets  ' + P.pantsGrid.w + '×' + P.pantsGrid.h : 'Pockets';
    els['g-pants'].classList.toggle('hidden', !P.pantsGrid);
    renderGrid('pants');
    els['bagtitle'].style.display = P.bagGrid ? '' : 'none'; els['bagtitle'].textContent = P.equip.bag ? I[P.equip.bag.id].name + '  ' + P.bagGrid.w + '×' + P.bagGrid.h : 'Bag'; renderGrid('bag');
    if (UI.loot) { els.lootcol.classList.remove('hidden'); els.loottitle.textContent = UI.loot.title; renderGrid('loot'); } else els.lootcol.classList.add('hidden');
    renderHot(true);
  }

  // -------------------------------------------------- admin backpack (god mode only)
  const ADMIN_TYPES = [['melee', 'Melee'], ['gun', 'Guns'], ['ammo', 'Ammo'], ['food', 'Food'], ['drink', 'Drinks'], ['med', 'Medical'], ['clothes', 'Clothes'], ['bag', 'Bags'], ['light', 'Light'], ['tool', 'Tools'], ['fuel', 'Fuel'], ['mat', 'Materials'], ['misc', 'Misc']];
  let adminQ = '';
  function renderAdmin() {
    const tabBtn = els['tab-admin-btn'];
    tabBtn.classList.toggle('hidden', !DSZ.settings.godmode); // god mode off = no admin access
    if (!DSZ.settings.godmode) { UI.showTab('inv'); return; }
    if (!els['admin-search'].dataset.bound) {
      els['admin-search'].dataset.bound = '1';
      els['admin-search'].addEventListener('input', () => { adminQ = els['admin-search'].value.toLowerCase(); renderAdminList(); });
    }
    renderAdminList();
  }
  function renderAdminList() {
    const box = els['admin-list']; box.innerHTML = '';
    const q = adminQ.trim();
    let shown = 0;
    for (const [type, label] of ADMIN_TYPES) {
      const defs = Object.values(I).filter(d => d.type === type && !d.hidden && (!q || d.name.toLowerCase().includes(q) || d.id.includes(q)));
      if (!defs.length) continue;
      const cat = document.createElement('div'); cat.className = 'admincat'; cat.textContent = label + (q ? ' (' + defs.length + ')' : '');
      box.appendChild(cat);
      for (const d of defs) {
        shown++;
        const e = document.createElement('div'); e.className = 'adminitem';
        e.innerHTML = '<img src="' + img(d.id) + '"><div><b>' + d.name + '</b><small>' + d.type + '</small></div>';
        e.addEventListener('click', () => adminGive(d.id));
        e.addEventListener('mouseenter', () => { const fake = { id: d.id, q: 1 }; hovered = fake; showTip(fake, e); });
        e.addEventListener('mouseleave', hideTip);
        box.appendChild(e);
      }
    }
    if (!shown) { const d = document.createElement('div'); d.className = 'admincat'; d.textContent = 'No items match "' + q + '"'; box.appendChild(d); }
  }
  function adminGive(id) {
    const d = I[id];
    const it = Inv.make(id, d.stack > 1 ? d.stack : 1);
    if (d.type === 'gun') it.mag = d.mag;
    if (id === 'gascan') it.fuel = d.maxfuel || 100;
    if (id === 'flashlight') it.bat = 100;
    const left = Inv.give(S.player.inv, it);
    if (left) { DSZ.Game.toast(S, 'Inventory full - item dropped at your feet.'); DSZ.Game.dropItem(S, S.player.x, S.player.y, left); A.play('thud', S.player.x, S.player.y, 0.5); }
    else { A.play('pickup'); DSZ.Game.toast(S, 'Admin: +' + d.name); }
    UI.refresh();
  }
  UI.refresh = () => { if (UI.open.win) { if (UI.open.tab === 'inv') renderInv(); else renderCraft(); } renderHot(true); };
  function renderHot(force) {
    if (!S) return; const P = S.player.inv, p = S.player;
    const sig = P.sel + '|' + P.hot.map(it => it ? it.id + it.q + (it.mag !== undefined ? it.mag : '') + (it.dur !== undefined ? (it.dur | 0) : '') : '-').join(',') + '|' + Inv.count(P, 'ammo9') + Inv.count(P, 'shell') + Inv.count(P, 'ammo762');
    if (!force && sig === hotSig) return; hotSig = sig;
    els.hotbar.querySelectorAll('.hslot').forEach((d, i) => {
      const it = P.hot[i]; d.classList.toggle('sel', P.sel === i);
      d.querySelectorAll('img,.q,.dur').forEach(n => n.remove());
      if (it) {
        const def = I[it.id], im = document.createElement('img'); im.src = img(it.id); im.draggable = false; d.appendChild(im);
        let q = ''; if (def.type === 'gun') q = it.mag + '/' + Inv.count(P, def.ammo); else if (it.q > 1) q = it.q;
        if (q !== '') { const s = document.createElement('span'); s.className = 'q'; s.textContent = q; d.appendChild(s); }
        if (it.dur !== undefined && def.dur) { const f = U.clamp(it.dur / def.dur, 0, 1), b = document.createElement('div'); b.className = 'dur'; b.innerHTML = '<i style="width:' + f * 100 + '%"></i>'; d.appendChild(b); }
      }
    });
  }

  // ------------------------------------------------------------------ drag & drop
  function hotDown(e, i) {
    if (e.button !== 0) return; const P = S.player.inv, it = P.hot[i];
    if (!UI.open.win || !it) { P.sel = P.sel === i ? -1 : i; A.play('click'); S.build.active = false; renderHot(true); return; }
    startDrag(e, it, { type: 'hot', idx: i });
  }
  function startDrag(e, it, origin) {
    if (UI.drag) return; e.preventDefault(); hideTip();
    const P = S.player.inv;
    if (origin.type === 'grid') Inv.remove(gridObj(origin.name), it); else if (origin.type === 'hot') { P.hot[origin.idx] = null; if (P.sel === origin.idx) P.sel = -1; } else if (origin.type === 'equip') { P.equip[origin.slot] = null; if (origin.slot === 'bag') { /* keep grid contents until drop resolves */ } }
    UI.drag = { it, origin, startRot: !!it.rot };
    const g = els.dragghost; g.classList.remove('hidden'); sizeGhost(); dragMove(e); renderInv();
  }
  function sizeGhost() { const d = UI.drag; if (!d) return; const [w, h] = Inv.size(d.it), g = els.dragghost; g.style.width = w * CELL + 'px'; g.style.height = h * CELL + 'px'; g.innerHTML = '<img src="' + img(d.it.id) + '"' + (d.it.rot ? ' style="transform:rotate(90deg)"' : '') + '>'; }
  function clearHL() { document.querySelectorAll('.cellhl').forEach(n => n.remove()); document.querySelectorAll('.eqslot.hl').forEach(n => n.classList.remove('hl')); }
  function target(e) {
    const t = document.elementFromPoint(e.clientX, e.clientY); if (!t) return null;
    const grid = t.closest && t.closest('.grid'); if (grid) { const name = grid.id === 'g-bag' ? 'bag' : grid.id === 'g-pants' ? 'pants' : 'loot'; return { type: 'grid', name, el: grid }; }
    const hs = t.closest && t.closest('.hslot'); if (hs) return { type: 'hot', idx: +hs.dataset.slot, el: hs };
    const eq = t.closest && t.closest('.eqslot'); if (eq) return { type: 'equip', slot: eq.dataset.eq, el: eq };
    if (t.closest && t.closest('#win')) return { type: 'panel' };
    return { type: 'world' };
  }
  function dragMove(e) {
    const d = UI.drag; if (!d) return; const g = els.dragghost, [w, h] = Inv.size(d.it);
    g.style.left = (e.clientX - w * CELL / 2) + 'px'; g.style.top = (e.clientY - h * CELL / 2) + 'px';
    clearHL(); const t = target(e); if (!t) return;
    if (t.type === 'grid') {
      const gr = gridObj(t.name); if (!gr) return; const r = t.el.getBoundingClientRect();
      const gx = Math.round((e.clientX - r.left - w * CELL / 2) / CELL), gy = Math.round((e.clientY - r.top - h * CELL / 2) / CELL);
      const stack = Inv.itemAt(gr, U.clamp(gx, 0, gr.w - 1), U.clamp(gy, 0, gr.h - 1)); const ok = Inv.fits(gr, d.it, gx, gy) || (stack && Inv.canStack(stack, d.it));
      const hl = document.createElement('div'); hl.className = 'cellhl ' + (ok ? 'ok' : 'no'); hl.style.cssText = 'left:' + (gx * CELL) + 'px;top:' + (gy * CELL) + 'px;width:' + (w * CELL) + 'px;height:' + (h * CELL) + 'px'; t.el.appendChild(hl);
    } else if (t.type === 'equip') { const def = I[d.it.id]; const slot = def.type === 'clothes' ? def.slot : def.type === 'bag' ? 'bag' : def.type === 'light' ? 'light' : null; if (slot === t.slot) t.el.classList.add('hl'); }
  }
  function dragUp(e) {
    const d = UI.drag; if (!d || e.button !== 0) return; const t = target(e); const P = S.player.inv; let placed = false;
    const it = d.it, def = I[it.id];
    if (t && t.type === 'grid') {
      const gr = gridObj(t.name);
      if (gr) {
        const r = t.el.getBoundingClientRect(), [w, h] = Inv.size(it), gx = Math.round((e.clientX - r.left - w * CELL / 2) / CELL), gy = Math.round((e.clientY - r.top - h * CELL / 2) / CELL);
        if (Inv.fits(gr, it, gx, gy)) { Inv.place(gr, it, gx, gy); placed = true; }
        else { const st = Inv.itemAt(gr, U.clamp(gx, 0, gr.w - 1), U.clamp(gy, 0, gr.h - 1)); if (st && Inv.canStack(st, it)) { const m = Math.min(I[st.id].stack - st.q, it.q); st.q += m; it.q -= m; if (it.q <= 0) placed = true; } }
      }
    } else if (t && t.type === 'hot') {
      const old = P.hot[t.idx]; P.hot[t.idx] = it; placed = true; if (old) { const left = Inv.give(P, old); if (left) { P.hot[t.idx] = old; placed = false; } }
      if (placed && P.sel < 0 && def.type !== 'food') P.sel = t.idx;
    } else if (t && t.type === 'equip') {
      const slot = def.type === 'clothes' ? def.slot : def.type === 'bag' ? 'bag' : def.type === 'light' ? 'light' : null;
      if (slot === t.slot) { const prev = P.equip[slot]; P.equip[slot] = it; if (slot === 'bag') { Inv.refreshBag(P, DSZ.Game.dropFn(S)); } if (prev) { const left = Inv.give(P, prev); if (left) DSZ.Game.dropItem(S, S.player.x, S.player.y, left); } placed = true; DSZ.Game.refreshEquipVisuals(S); }
    } else if (t && t.type === 'world') { DSZ.Game.dropItem(S, S.player.x + Math.cos(S.player.ang) * 0.8, S.player.y + Math.sin(S.player.ang) * 0.8, it); placed = true; A.play('click'); }
    if (!placed) revert(d);
    else if (d.origin.type === 'equip' && d.origin.slot === 'bag') { Inv.refreshBag(P, DSZ.Game.dropFn(S)); }
    if (d.origin.type === 'equip') DSZ.Game.refreshEquipVisuals(S);
    UI.drag = null; els.dragghost.classList.add('hidden'); clearHL(); UI.refresh(); A.play('click', null, null, 0.3);
  }
  function revert(d) {
    const P = S.player.inv, o = d.origin, it = d.it; it.rot = d.startRot;
    if (o.type === 'grid') { const g = gridObj(o.name); if (g && Inv.fits(g, it, o.x, o.y)) Inv.place(g, it, o.x, o.y); else { const left = Inv.give(P, it); if (left) DSZ.Game.dropItem(S, S.player.x, S.player.y, left); } }
    else if (o.type === 'hot') { if (!P.hot[o.idx]) P.hot[o.idx] = it; else { const left = Inv.give(P, it); if (left) DSZ.Game.dropItem(S, S.player.x, S.player.y, left); } }
    else if (o.type === 'equip') { P.equip[o.slot] = it; }
  }
  function cancelDrag() { const d = UI.drag; if (!d) return; revert(d); UI.drag = null; els.dragghost.classList.add('hidden'); clearHL(); }
  function quick(it, from) {
    const P = S.player.inv, G = DSZ.Game; hideTip();
    if (from === 'equip') { const slot = Object.keys(P.equip).find(k => P.equip[k] === it); if (!Inv.unequip(P, slot, G.dropFn(S))) G.toast(S, 'No room'); G.refreshEquipVisuals(S); }
    else if (from === 'loot') { Inv.remove(UI.loot.grid, it); const left = Inv.give(P, it); if (left) { Inv.place(UI.loot.grid, left, left.x || 0, left.y || 0); Inv.addTo(UI.loot.grid, left); G.toast(S, 'Not enough space'); } else A.play('pickup'); }
    else if (UI.loot && (from === 'pants' || from === 'bag') && !(I[it.id].type === 'food' && false)) { Inv.remove(gridObj(from), it); if (Inv.addTo(UI.loot.grid, it) !== 0) { Inv.addTo(gridObj(from), it); G.toast(S, 'Container is full'); } else A.play('click'); }
    else { G.useItem(S, it); }
    UI.refresh();
  }
  function takeAll() { if (!UI.loot) return; const g = UI.loot.grid; for (const it of g.items.slice()) { Inv.remove(g, it); const left = Inv.give(S.player.inv, it); if (left) { Inv.addTo(g, left); } } A.play('pickup'); UI.refresh(); }

  // ------------------------------------------------------------------ crafting
  function renderCraft() {
    if (!S) return; const P = S.player.inv, st = Inv.stations(S), tabs = [...new Set(DSZ.RECIPES.map(r => r.tab))];
    els.crafttabs.innerHTML = '<h4>Categories</h4>';
    for (const t of tabs) { const b = document.createElement('button'); b.textContent = t; b.className = t === craftTab ? 'on' : ''; b.onclick = () => { craftTab = t; craftSel = null; renderCraft(); }; els.crafttabs.appendChild(b); }
    const stat = document.createElement('div'); stat.style.cssText = 'margin-top:12px;font-size:13px;color:var(--dim)'; stat.innerHTML = 'Nearby<br><b style="color:' + (st.bench ? 'var(--good)' : 'var(--dim)') + '">' + (st.bench ? '● Workbench' : '○ Workbench') + '</b><br><b style="color:' + (st.fire ? 'var(--good)' : 'var(--dim)') + '">' + (st.fire ? '● Fire' : '○ Fire') + '</b>'; els.crafttabs.appendChild(stat);
    els.craftlist.innerHTML = '';
    const list = DSZ.RECIPES.filter(r => r.tab === craftTab); if (!craftSel || craftSel.tab !== craftTab) craftSel = list[0];
    for (const r of list) {
      const s = Inv.recipeState(P, r, st), d = document.createElement('div'); d.className = 'rcp' + (r === craftSel ? ' sel' : '') + (s.ok ? '' : ' no');
      d.innerHTML = '<img src="' + img(r.out[0]) + '">' + (r.out[1] > 1 ? '<span class="q">' + r.out[1] + '</span>' : '') + (s.ok ? '<i class="ok"></i>' : '');
      d.onclick = () => { craftSel = r; renderCraft(); A.play('click', null, null, 0.3); }; d.onmouseenter = () => { els.tip.innerHTML = '<b>' + I[r.out[0]].name + '</b><div class="d">' + (r.desc || I[r.out[0]].desc || '') + '</div>'; els.tip.classList.remove('hidden'); const rc = d.getBoundingClientRect(); placeTip(rc.right + 8, rc.top); }; d.onmouseleave = hideTip;
      els.craftlist.appendChild(d);
    }
    const r = craftSel; if (!r) { els.craftdetail.innerHTML = ''; return; }
    const s = Inv.recipeState(P, r, st), od = I[r.out[0]];
    let html = '<h4>Recipe</h4><h3>' + od.name + (r.out[1] > 1 ? ' ×' + r.out[1] : '') + '</h3><div class="d">' + (r.desc || od.desc || '') + '</div><h4>Requires</h4>';
    for (const [id, q] of r.in) { if (q <= 0) continue; const have = Inv.count(P, id); html += '<div class="ing"><img src="' + img(id) + '"><span>' + I[id].name + '</span><b class="' + (have >= q ? 'ok' : 'no') + '">' + have + ' / ' + q + '</b></div>'; }
    if (r.needs) html += '<div class="ing"><img src="' + img(r.needs) + '"><span>' + I[r.needs].name + ' (tool)</span><b class="' + (Inv.has(P, r.needs) ? 'ok' : 'no') + '">' + (Inv.has(P, r.needs) ? 'have' : 'missing') + '</b></div>';
    if (r.station) html += '<div class="ing"><span style="padding-left:6px">' + (r.station === 'bench' ? 'Workbench nearby' : 'Fire nearby') + '</span><b class="' + (st[r.station] ? 'ok' : 'no') + '">' + (st[r.station] ? 'yes' : 'no') + '</b></div>';
    html += '<button class="btn" id="docraft" style="margin-top:10px;width:100%"' + (s.ok ? '' : ' disabled') + '>Craft</button>';
    els.craftdetail.innerHTML = html;
    const btn = $('docraft'); if (btn) btn.onclick = () => { if (Inv.craft(P, r, Inv.stations(S), DSZ.Game.dropFn(S))) { A.play('craft'); DSZ.Game.toast(S, 'Crafted ' + od.name); renderCraft(); renderHot(true); } };
  }

  // ------------------------------------------------------------------ build bar
  let buildSig = '';
  function renderBuild() {
    const b = S.build, bar = els.buildbar; if (!b.active) { bar.classList.add('hidden'); buildSig = ''; return; }
    const P = S.player.inv, sig = b.tab + '|' + (b.def && b.def.id) + '|' + DSZ.BUILD.map(d => Inv.canBuild(P, d) ? 1 : 0).join('') + '|' + (b.why || ''); if (sig === buildSig) { bar.classList.remove('hidden'); return; } buildSig = sig;
    bar.classList.remove('hidden');
    const tabs = [...new Set(DSZ.BUILD.map(d => d.tab))];
    let html = '<div class="btabs">' + tabs.map(t => '<button data-t="' + t + '" class="' + (t === b.tab ? 'on' : '') + '">' + t + '</button>').join('') + '</div><div class="bgrid">';
    for (const d of DSZ.BUILD.filter(d => d.tab === b.tab)) { const ok = Inv.canBuild(P, d); html += '<div class="bitem' + (b.def === d ? ' on' : '') + (ok ? '' : ' no') + '" data-id="' + d.id + '"><b>' + d.name + '</b><small>' + d.cost.map(c => (Inv.count(P, c[0]) >= c[1] ? '' : '⚠ ') + c[1] + '× ' + I[c[0]].name).join(', ') + '</small></div>'; }
    html += '</div><div class="bhelp">LMB place &nbsp;·&nbsp; RMB / X deconstruct (70% refund) &nbsp;·&nbsp; R rotate &nbsp;·&nbsp; B exit &nbsp;·&nbsp; needs a hammer' + (b.def ? ' &nbsp;·&nbsp; <i>' + (b.def.desc || '') + '</i>' : '') + (b.why ? ' &nbsp;·&nbsp; <b style="color:var(--bad)">' + b.why + '</b>' : '') + '</div>';
    bar.innerHTML = html;
    bar.querySelectorAll('.btabs button').forEach(x => x.onclick = () => { b.tab = x.dataset.t; b.def = DSZ.BUILD.find(d => d.tab === b.tab); buildSig = ''; A.play('click', null, null, 0.3); });
    bar.querySelectorAll('.bitem').forEach(x => x.onclick = () => { b.def = DSZ.BUILD.find(d => d.id === x.dataset.id); buildSig = ''; A.play('click', null, null, 0.3); });
  }

  // ------------------------------------------------------------------ minimap / map
  function buildWorldMap() {
    const [c, x] = U.canvas2d(C.W, C.H), id = x.createImageData(C.W, C.H), d = id.data;
    const G = DSZ.G, col = { [G.GRASS]: [48, 74, 44], [G.FOREST]: [28, 48, 32], [G.ASPHALT]: [72, 74, 80], [G.SIDEWALK]: [120, 118, 110], [G.CONCRETE]: [104, 104, 100], [G.PARKING]: [60, 62, 68], [G.DIRT]: [88, 70, 50], [G.GRAVEL]: [100, 96, 88] };
    for (let y = 0; y < C.H; y++) for (let xx = 0; xx < C.W; xx++) {
      const i = y * C.W + xx, b = W.room[i]; let k;
      if (b) { const bl = W.blds[b], o = W.obj[i]; k = o && DSZ.OBJDEF[o.t].wall ? [150, 128, 96] : (bl.kind === 'house' ? [96, 80, 64] : bl.kind === 'police' ? [70, 92, 140] : bl.kind === 'hospital' ? [200, 90, 90] : [110, 100, 86]); }
      else { k = col[W.ground[i]] || [60, 70, 60]; const o = W.obj[i]; if (o && DSZ.OBJDEF[o.t].tree) k = [22, 40, 26]; }
      d[i * 4] = k[0]; d[i * 4 + 1] = k[1]; d[i * 4 + 2] = k[2]; d[i * 4 + 3] = 255;
    }
    x.putImageData(id, 0, 0); return c;
  }
  function drawMini() {
    if (!mmCanvas) mmCanvas = buildWorldMap();
    const cv = els.mm, x = cv.getContext('2d'), p = S.player, k = 2.6, s = Math.SQRT1_2;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#0a0b0d'; x.fillRect(0, 0, 200, 200);
    x.setTransform(k * s, k * s, -k * s, k * s, 100, 100); x.imageSmoothingEnabled = false; x.drawImage(mmCanvas, -p.x, -p.y);
    // entities
    for (const z of S.zombies) { if (z.dead || Math.abs(z.x - p.x) > 30 || Math.abs(z.y - p.y) > 30) continue; if (Math.hypot(z.x - p.x, z.y - p.y) > 22 && z.state !== 'chase') continue; x.fillStyle = z.state === 'chase' ? '#ff4a3a' : 'rgba(200,70,60,0.65)'; x.fillRect(z.x - p.x - 0.5, z.y - p.y - 0.5, 1.1, 1.1); }
    for (const c of S.cars) { if (Math.abs(c.x - p.x) > 30 || Math.abs(c.y - p.y) > 30) continue; x.fillStyle = c.drivable ? '#7ad0ff' : 'rgba(180,180,190,0.7)'; x.fillRect(c.x - p.x - 0.8, c.y - p.y - 0.8, 1.6, 1.6); }
    for (const dr of S.drops) { if (Math.abs(dr.x - p.x) > 30 || Math.abs(dr.y - p.y) > 30) continue; x.fillStyle = '#ffd070'; x.fillRect(dr.x - p.x - 0.4, dr.y - p.y - 0.4, 0.9, 0.9); }
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 1.5; x.beginPath(); const a = (p.aimAng) + Math.PI / 4 - Math.PI / 2 + Math.PI / 2; x.moveTo(100 + Math.cos(a - 0.0) * 6, 100 + Math.sin(a) * 6); x.lineTo(100 + Math.cos(a + 2.5) * 5, 100 + Math.sin(a + 2.5) * 5); x.lineTo(100 + Math.cos(a - 2.5) * 5, 100 + Math.sin(a - 2.5) * 5); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.5)'; x.font = 'bold 11px Rajdhani, sans-serif'; x.fillText('N', 94, 190 - 178 + 12); // approximate orientation marker
  }
  function drawBigMap() {
    if (!mmCanvas) mmCanvas = buildWorldMap(); const cv = els.bigmap, x = cv.getContext('2d'), k = cv.width / C.W, p = S.player;
    x.imageSmoothingEnabled = false; x.drawImage(mmCanvas, 0, 0, cv.width, cv.height);
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.font = 'bold 13px Rajdhani, sans-serif'; x.textAlign = 'center'; x.strokeStyle = 'rgba(0,0,0,0.9)'; x.lineWidth = 3;
    for (const q of DSZ.Gen.poi) { x.strokeText(q.name, q.x * k, q.y * k); x.fillText(q.name, q.x * k, q.y * k); }
    for (const c of S.cars) if (c.drivable) { x.fillStyle = '#7ad0ff'; x.fillRect(c.x * k - 3, c.y * k - 3, 6, 6); }
    x.fillStyle = '#ffdd55'; x.beginPath(); x.arc(p.x * k, p.y * k, 5, 0, 7); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 2; x.stroke();
  }

  // ------------------------------------------------------------------ settings / controls
  function buildSettings() {
    const s = DSZ.settings, b = els.setbody; b.innerHTML = '';
    const row = (label, el) => { const r = document.createElement('div'); r.className = 'setrow'; r.innerHTML = '<span>' + label + '</span>'; r.appendChild(el); b.appendChild(r); };
    const slider = (key, min, max, step, cb) => { const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = s[key]; i.oninput = () => { s[key] = +i.value; DSZ.saveSettings(); cb && cb(); }; return i; };
    const sel = (key, opts, cb) => { const e = document.createElement('select'); opts.forEach(o => { const op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; e.appendChild(op); }); e.value = String(s[key]); e.onchange = () => { s[key] = isNaN(+e.value) || e.value === '' || e.value === 'auto' ? e.value : +e.value; if (typeof opts[0][0] === 'boolean') s[key] = e.value === 'true'; DSZ.saveSettings(); cb && cb(); }; return e; };
    const tog = (key, cb) => sel(key, [[true, 'On'], [false, 'Off']], () => { s[key] = String(s[key]) === 'true'; DSZ.saveSettings(); cb && cb(); });
    row('Master volume', slider('volume', 0, 1, 0.05, () => A.setVolume())); row('Ambience & music', slider('music', 0, 1, 0.05, () => A.setVolume()));
    row('Render resolution', sel('quality', [['auto', 'Auto (adaptive)'], ['1', '100%'], ['0.85', '85%'], ['0.7', '70%'], ['0.55', '55%']], () => DSZ.Main.applyQuality()));
    row('Lighting quality', sel('lightRes', [[0.2, 'Low'], [0.28, 'Medium'], [0.36, 'High'], [0.5, 'Ultra']], () => DSZ.Render.resize()));
    row('Film grain', tog('grain')); row('Bloom', tog('bloom')); row('UI blur', tog('blur', () => document.body.classList.toggle('noblur', !s.blur))); row('Show FPS', tog('showFps', () => els.fps.classList.toggle('hidden', !s.showFps)));
    row('God mode (admin)', tog('godmode', () => { if (S && s.godmode && DSZ.Game.godKit) DSZ.Game.godKit(S); if (S) DSZ.Game.toast(S, s.godmode ? 'God mode ON - immortal, infinite items.' : 'God mode OFF.'); }));
  }
  function buildControls() {
    const rows = [['W A S D', 'Move'], ['Mouse', 'Aim'], ['Left click', 'Attack / fire / use'], ['Right click', 'Steady aim'], ['Shift', 'Run'], ['Z', 'Sneak'], ['Ctrl', 'Crouch (toggle)'], ['E', 'Interact · search · open · enter car'], ['Hold E', 'Pry locked door (crowbar/axe)'], ['1 – 6', 'Select hotbar item'], ['Tab / I', 'Inventory'], ['C', 'Crafting'], ['B', 'Base building'], ['F', 'Toggle flashlight'], ['R', 'Reload · rotate'], ['G', 'Refuel vehicle'], ['Q', 'Drop selected item'], ['M', 'Map (needs a Town Map)'], ['Mouse wheel', 'Zoom'], ['Car: W/S A/D', 'Drive · steer'], ['Car: Space', 'Handbrake'], ['Car: L / H', 'Headlights · horn'], ['Esc', 'Pause']];
    els.ctlbody.innerHTML = '<div class="ctl">' + rows.map(r => '<b>' + r[0] + '</b><span>' + r[1] + '</span>').join('') + '</div>';
  }

  // ------------------------------------------------------------------ per-frame HUD
  const vrows = {};
  UI.update = function (state, dt) {
    S = state; if (!S) return;
    const p = S.player;
    els.cursor.classList.toggle('ui', UI.blockMouse());
    if (!UI.open.title) {
      // key handling
      if (!UI.open.death && !UI.open.settings && !UI.open.controls) {
        if (In.pressed('Escape')) { if (UI.drag) cancelDrag(); else if (UI.open.map) UI.closeMap(); else if (UI.open.win) UI.closeWin(); else if (S.build.active) { DSZ.Game.setBuild(S, false); } else UI.toggleMenu(); }
        else if (!UI.open.menu) {
          if (In.pressed('Tab') || In.pressed('KeyI')) UI.toggleWin('inv');
          if (In.pressed('KeyC')) UI.toggleWin('craft');
          if (In.pressed('KeyM')) { if (UI.open.map) UI.closeMap(); else UI.openMap(); }
          if (In.pressed('KeyB') && !p.driving) { if (UI.open.win) UI.closeWin(); DSZ.Game.setBuild(S, !S.build.active); A.play('click'); }
          if (UI.drag && In.pressed('KeyR')) { UI.drag.it.rot = !UI.drag.it.rot; sizeGhost(); }
        }
      } else if (In.pressed('Escape')) { if (UI.open.settings) UI.showSettings(false); else if (UI.open.controls) UI.showControls(false); }
    } else if (In.pressed('Escape')) { if (UI.open.settings) UI.showSettings(false); if (UI.open.controls) UI.showControls(false); }
    hudT -= dt; const slow = hudT <= 0; if (slow) hudT = 0.12;
    if (UI.open.title) return;
    // vitals
    const vals = { hp: p.hp, food: p.food, water: p.water, stamina: p.stamina, energy: p.energy };
    els.vitals.querySelectorAll('.vrow').forEach(r => { const k = r.dataset.k, v = Math.round(vals[k]); if (vrows[k] !== v) { vrows[k] = v; r.querySelector('i').style.width = Math.max(0, v) + '%'; r.querySelector('b').textContent = v; r.classList.toggle('low', v < 22 && k !== 'stamina'); } });
    renderHot(false);
    if (slow) {
      let st = ''; if (DSZ.settings.godmode) st += '<span class="warn">GOD MODE</span>'; if (p.bleed > 0) st += '<span>Bleeding</span>'; if (p.infection > 30) st += '<span>Infected</span>'; else if (p.infection > 0) st += '<span class="warn">Feverish</span>'; if (p.broken) st += '<span>Broken leg</span>'; if (p.food < 25) st += '<span class="warn">Hungry</span>'; if (p.water < 25) st += '<span class="warn">Thirsty</span>'; if (p.energy < 20) st += '<span class="warn">Tired</span>'; if (p.reload > 0) st += '<span class="warn">Reloading</span>';
      if (els.vitals.querySelector('#status').innerHTML !== st) els.vitals.querySelector('#status').innerHTML = st;
      const h = Math.floor(S.hour), m = Math.floor((S.hour - h) * 60); els.clk.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); els.dayl.textContent = 'Day ' + S.day;
      els.wx.textContent = S.weather.rain > 0.7 ? 'Storm' : (S.weather.rain > 0.15 ? 'Rain' : (DSZ.Render.daylight(S.hour) < 0.3 ? 'Night' : 'Clear'));
      drawMini();
      const sig = S.toasts.map(t => t.text + t.kind).join('|'); if (sig !== toastSig) { toastSig = sig; els.toasts.innerHTML = S.toasts.map(t => '<div class="toast ' + t.kind + '">' + t.text + '</div>').join(''); }
      if (UI.open.win) { if (UI.open.tab === 'inv' && !UI.drag) { renderCondition(); } else if (UI.open.tab === 'craft') { /* re-render lightly */ if (!UI.drag) renderCraft(); } if (UI.open.tab === 'inv' && !UI.drag) { const sg = invSig(); if (sg !== UI._isig) { UI._isig = sg; renderInv(); } } }
      if (UI.open.map) drawBigMap();
      if (UI.loot && UI.open.win && UI.loot.owner) { const o = UI.loot.owner, ox = o.x !== undefined ? (o.t !== undefined && o.hp !== undefined ? o.x + 0.5 : o.x) : p.x, oy = o.y !== undefined ? (o.t !== undefined && o.hp !== undefined ? o.y + 0.5 : o.y) : p.y; if (Math.hypot(ox - p.x, oy - p.y) > 3.6) { UI.closeWin(); } }
    }
    // prompt
    const f = S.focus, pr = els.prompt;
    if (f && !UI.open.win && !S.search && !S.prying && !UI.open.death) { const sp = DSZ.Render.toScreenCss(f.x, f.y, 1.7); pr.classList.remove('hidden'); if (pr.textContent !== f.label) pr.textContent = f.label; pr.style.left = sp[0] + 'px'; pr.style.top = sp[1] + 'px'; } else pr.classList.add('hidden');
    // progress
    const pg = els.progress, pgs = S.search || S.prying || (S.sleeping && { t: S.sleeping.t, total: 8, label: 'Sleeping' }) || (p.reload > 0 && { t: 1 - p.reload / (p.reloadItem ? I[p.reloadItem.id].reload : 1), total: 1, label: 'Reloading' });
    if (pgs) { pg.classList.remove('hidden'); els.proglabel.textContent = pgs.label || (S.prying ? 'Prying door open' : 'Searching'); pg.querySelector('i').style.width = Math.min(100, pgs.t / pgs.total * 100) + '%'; } else pg.classList.add('hidden');
    renderBuild();
    if (S.sleeping) { /* handled in render via fade */ }
  };
  function invSig() { const P = S.player.inv; const f = g => g ? g.items.map(i => i.id + i.q + i.x + i.y + (i.mag || '') + (i.dur ? (i.dur | 0) : '')).join(',') : ''; return f(P.pantsGrid) + '|' + f(P.bagGrid) + '|' + (UI.loot ? f(UI.loot.grid) : '') + '|' + Object.values(P.equip).map(i => i ? i.id : '-').join(''); }
  UI.fps = t => { if (DSZ.settings.showFps) els.fps.textContent = t; };
})();
