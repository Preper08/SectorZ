/* Dead SectorZ — DOM UI: HUD, grid inventory with drag & drop, crafting, build bar, maps, menus */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, C = DSZ.C, W = DSZ.World, O = DSZ.O, I = DSZ.ITEMS, Inv = DSZ.Inv, A = DSZ.Audio, In = DSZ.Input;
  const $ = id => document.getElementById(id);
  const UI = DSZ.UI = { open: { win: false, tab: 'inv', map: false, menu: false, settings: false, controls: false, title: true, death: false, tv: false }, loot: null, drag: null };
  // Grid cell size. Normally 44px, but it shrinks (down to CELL_MIN) when a big bag plus an
  // open container would make the window wider than the screen and push the loot column out
  // of view. Every grid layout and every drag/drop calculation below uses CELL, so changing
  // it scales the whole inventory consistently. fitCell() picks the value on each render.
  const CELL_MAX = 44, CELL_MIN = 20;
  let CELL = CELL_MAX;
  let vitalNodes = [];
  let S = null, els = {}, imgCache = {}, craftTab = 'Survival', craftSel = null, hudT = 0, hotSig = '', toastSig = '', hovered = null, mmCanvas = null, mapRendered = null;
  // PROTOTYPE: original parents of the nodes borrowed by the unified Player tab.
  let playerHomes = null;

  const img = (id, tint) => { const key = tint ? id + '|' + tint : id; let u = imgCache[key]; if (!u) u = imgCache[key] = DSZ.Icons.get(id, tint).toDataURL(); return u; };
  UI.img = img;
  UI.blockMouse = () => UI.open.win || UI.open.map || UI.open.menu || UI.open.settings || UI.open.controls || UI.open.title || UI.open.death || UI.open.tv;
  UI.blockKeys = () => UI.open.menu || UI.open.settings || UI.open.controls || UI.open.title || UI.open.death || UI.open.tv;
  UI.isModal = () => UI.open.menu || UI.open.settings || UI.open.title || UI.open.death || UI.open.controls || UI.open.tv;

  // ------------------------------------------------------------------ init
  UI.init = function () {
    for (const id of ['hud', 'win', 'tip', 'dragghost', 'mapwin', 'pause', 'settings', 'controls', 'death', 'title', 'loading', 'cursor', 'vitals', 'clk', 'dayl', 'wx', 'nightw', 'toasts', 'prompt', 'progress', 'proglabel', 'hotbar', 'buildbar', 'fps', 'equip', 'condition', 'gridcol', 'g-loot', 'lootcol', 'loottitle', 'crafttabs', 'craftlist', 'craftdetail', 'tab-inv', 'tab-craft', 'tab-char', 'tab-admin', 'tab-player', 'pcharhost', 'peqhost', 'pinvhost', 'pcondhost', 'chardollcol', 'chareqcol', 'charlookcol', 'condition', 'admin-search', 'admin-list', 'tab-admin-btn', 'char-preview', 'charequip', 'skin-sw', 'hair-sw', 'char-bald', 'char-rot', 'char-pose', 'bigmap', 'mm', 'setbody', 'ctlbody', 'lbar', 'ltxt', 'deathwhy', 'deathstats', 'takeall', 'ver', 'tvwin', 'tvx', 'tvclose', 'tvscreen', 'tvch', 'diffbtns', 'dlab', 'pcwin', 'pcx', 'pcclose', 'pcscreen', 'pcmode', 'pctabs', 'doghud', 'dogtier', 'dogbond', 'dognote', 'carhud', 'carname', 'carkmh', 'carhp', 'carhpv', 'carfuel', 'carfuelv', 'carsirenrow', 'carsiren', 'tvttl']) els[id] = $(id);
    vitalNodes = Array.from(els.vitals.querySelectorAll('.vrow'), row => ({ row, key: row.dataset.k, bar: row.querySelector('i'), value: row.querySelector('b') }));
    els.status = $('status'); els.progressBar = els.progress.querySelector('i');
    els.eqcol = $('eqcol');
    els.ver.textContent = 'v' + C.VERSION;
    els.tvx.onclick = () => UI.closeTV(); els.tvclose.onclick = () => UI.closeTV();
  els.pcx.onclick = () => UI.closePC(); els.pcclose.onclick = () => UI.closePC();
    // tabs
    document.querySelectorAll('#win .tabs button').forEach(b => b.addEventListener('click', () => UI.showTab(b.dataset.tab)));
    els['char-rot'].onclick = () => { charAng += Math.PI / 8; renderChar(); A.play('click'); };
    els['char-pose'].onclick = () => { charPose = (charPose + 1) % CHAR_POSES.length; els['char-pose'].textContent = 'Pose: ' + CHAR_POSES[charPose]; renderChar(); A.play('click'); };
    els['char-bald'].onclick = () => { if (!S) return; const ap = S.player.appearance || {}; DSZ.Game.setAppearance(S, 'bald', !ap.bald); renderChar(); A.play('click'); };
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
    // difficulty picker on the title screen: sets the setting used by the next New game.
    // Continue ignores it and uses whatever the save stored.
    const syncDiff = () => { els.diffbtns.querySelectorAll('.diff').forEach(b => b.classList.toggle('on', b.dataset.diff === DSZ.settings.difficulty)); };
    els.diffbtns.querySelectorAll('.diff').forEach(b => b.onclick = () => { DSZ.settings.difficulty = b.dataset.diff; DSZ.saveSettings(); syncDiff(); });
    UI.syncDiff = syncDiff;
    document.querySelectorAll('button').forEach(b => b.addEventListener('mouseenter', () => { if (A.ready) A.play('click', null, null, 0.25); }));
    // hotbar
    for (let i = 0; i < 6; i++) { const d = document.createElement('div'); d.className = 'hslot'; d.dataset.slot = i; d.innerHTML = '<span class="k">' + (i + 1) + '</span>'; d.addEventListener('mousedown', e => hotDown(e, i)); d.addEventListener('contextmenu', e => { e.preventDefault(); const it = S.player.inv.hot[i]; if (!it) return; if (UI.open.win) storeFromHot(it); else DSZ.Game.useItem(S, it); }); d.addEventListener('mouseenter', () => { const it = S.player.inv.hot[i]; if (it) showTip(it, d); }); d.addEventListener('mouseleave', hideTip); els.hotbar.appendChild(d); }
    // mouse for drag
    window.addEventListener('mousemove', e => { els.cursor.style.left = e.clientX + 'px'; els.cursor.style.top = e.clientY + 'px'; dragMove(e); if (!els.tip.classList.contains('hidden')) posTip(e); });
    window.addEventListener('mouseup', dragUp);
    // Re-fit the inventory when the window is resized, so an open container never drifts
    // off screen after the player resizes the game.
    window.addEventListener('resize', () => { fitHud(); if (UI.open.win && (UI.open.tab === 'inv' || UI.open.tab === 'char' || UI.open.tab === 'player')) { renderInv(); if (UI.open.tab !== 'inv') renderChar(); } if (UI.open.pc) UI.resizePC(); });
    els.cursor.classList.remove('hidden');
    buildSettings(); buildControls();
    DSZ.on('death', s => UI.showDeath(s));
  };
  UI.setState = s => { S = s; hotSig = ''; toastSig = ''; mapRendered = null; mmCanvas = null; fitHud(); };

  // ------------------------------------------------------------------ windows
  // The Player screen owns the existing doll/equipment/inventory/condition nodes. They are the
  // same elements the old Inventory/Character tabs used - nothing is cloned and no inventory
  // logic is duplicated. The old tab buttons are gone; any code asking for 'inv'/'char' lands
  // on this screen instead.
  function setPlayerLayout(on) {
    if (!playerHomes) playerHomes = ['chardollcol', 'chareqcol', 'charlookcol', 'gridcol', 'condition'].map(id => ({ el: els[id], home: els[id].parentNode, next: els[id].nextSibling }));
    if (on) {
      els.pcharhost.appendChild(els.chardollcol);
      els.pcharhost.appendChild(els.charlookcol);
      els.peqhost.insertBefore(els.chareqcol, els.pcondhost);
      els.pcondhost.appendChild(els.condition);
      els.pinvhost.appendChild(els.gridcol);
    } else {
      for (const h of playerHomes) {
        if (h.el.parentNode === h.home) continue;
        if (h.next && h.next.parentNode === h.home) h.home.insertBefore(h.el, h.next); else h.home.appendChild(h.el);
      }
    }
  }
  UI.showTab = function (t) {
    if (t === 'inv' || t === 'char') t = 'player'; // old screens folded into the unified one
    const prev = UI.open.tab;
    if (prev === 'player' && t !== 'player') setPlayerLayout(false);
    if (t === 'player' && prev !== 'player') setPlayerLayout(true);
    UI.open.tab = t; els.win.classList.toggle('player-open', t === 'player'); els.hud.classList.toggle('player-open', t === 'player'); document.querySelectorAll('#win .tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    els['tab-admin-btn'].classList.toggle('hidden', !DSZ.settings.godmode); // admin tab exists only in god mode
    els['tab-inv'].classList.toggle('hidden', t !== 'inv'); els['tab-craft'].classList.toggle('hidden', t !== 'craft'); els['tab-char'].classList.toggle('hidden', t !== 'char'); els['tab-admin'].classList.toggle('hidden', t !== 'admin'); els['tab-player'].classList.toggle('hidden', t !== 'player');
    if (t === 'craft') renderCraft(); else if (t === 'admin') renderAdmin(); else if (t === 'char') renderChar(); else if (t === 'player') { renderInv(); renderChar(); } else renderInv();
  };
  UI.openWin = function (tab) { UI.open.win = true; els.win.classList.remove('hidden'); hotbarLift(); UI.showTab(tab || UI.open.tab || 'player'); A.play('click', null, null, 0.4); };
  UI.closeWin = function () { cancelDrag(); if (UI.open.tab === 'player') { setPlayerLayout(false); UI.open.tab = 'inv'; } els.hud.classList.remove('player-open'); UI.open.win = false; UI.loot = null; els.win.classList.add('hidden'); hideTip(); els.lootcol.classList.add('hidden'); hotbarLift(); };
  UI.toggleWin = function (tab) { if (UI.open.win && UI.open.tab === tab) UI.closeWin(); else UI.openWin(tab); };
  UI.openLoot = function (title, grid, owner) { UI.loot = { title, grid, owner }; UI.openWin('inv'); };
  // ---- interactive TV: a large popup showing the enlarged broadcast of the set we are at.
  // movement and gameplay keys are blocked while open (UI.blockKeys/blockMouse); the mouse stays
  // available for the Close button. Closing restores play with the player state untouched.
  // Stop every TV audio bed. All beds are independent oscillators, so each one must be told
  // explicitly - missing a call here is what let the channel-2 bed outlive the window earlier.
  function tvAudioOff() { if (A.tvStatic) A.tvStatic(false); if (A.tvMusic) A.tvMusic(false); if (A.tvVoice) A.tvVoice(false); if (A.tvTerm) A.tvTerm(false); }
  // While the popup is open the set is what the player is looking at, so its audio steps forward
  // and the world ambience steps back. Both are restored on close.
  function setTvFocus(on) { if (A.tvFocus) A.tvFocus(!!on); }

  UI.openTV = function (tv) {
    UI.open.tv = true; UI.tvT = 0;
    UI.tvRef = tv || null;
    // per-TV seed so different sets show slightly different feeds
    UI.tvSeed = tv ? (((tv.x * 73856093) ^ (tv.y * 19349663)) >>> 0) % 1000 : 0;
    UI.tvChannel = 1;                                  // every set tunes in to channel 1 first
    UI.tvSwitch = 0;
    tvAudioOff();                                      // clear any bed left from a previous set
    setTvFocus(true);                                  // broadcast steps forward, world fades back
    if (A.tvStatic) A.tvStatic(true);                  // channel 1 is on air: the set's own buzz
    buildTVChannels();
    syncTvLabels();
    els.tvwin.classList.remove('hidden');
    els.cursor.classList.toggle('ui', true);
    if (S) S.paused = true; // freeze player movement and the world while watching (same as the pause menu)
    A.play('click');
  };
  UI.closeTV = function () { if (!UI.open.tv) return; UI.open.tv = false; tvAudioOff(); setTvFocus(false); els.tvwin.classList.add('hidden'); if (S && !UI.open.menu) S.paused = false; A.play('click'); };
  // Channel strip: one button per channel, wired to the same setTvChannel() the number keys use.
  function buildTVChannels() {
    const box = document.getElementById('tvchans');
    if (!box) return;
    box.innerHTML = '';
    for (let i = 1; i <= DSZ.Props.TV_CHANNELS; i++) {
      const b = document.createElement('button');
      b.textContent = 'CH ' + i;
      b.title = DSZ.Props.TV_CHANNEL_NAMES[i - 1] || ('Channel ' + i);
      b.className = i === UI.tvChannel ? 'on' : '';
      b.onclick = () => setTvChannel(i);
      box.appendChild(b);
    }
  }
  function tvChannelLabel() {
    if (UI.tvChannel === 2) return 'CH 2 · COMMENTARY';
    if (UI.tvChannel === 3) return 'CH 3 · NO SIGNAL';
    if (UI.tvChannel === 4) return 'CH 4 · TERMINAL';
    return 'CH 1 · LIVE FEED';
  }
  // The window's own title. It used to be a fixed string in the markup, so opening any channel
  // still said "Emergency Broadcast" across the top - the one label on screen that never changed
  // when you retuned. It follows the channel now.
  function tvChannelTitle() {
    return (DSZ.Props.TV_CHANNEL_NAMES && DSZ.Props.TV_CHANNEL_NAMES[(UI.tvChannel || 1) - 1])
      || ('Channel ' + (UI.tvChannel || 1));
  }
  function syncTvLabels() {
    if (els.tvch) els.tvch.textContent = tvChannelLabel();
    if (els.tvttl) els.tvttl.textContent = tvChannelTitle();
  }
  function setTvChannel(n) {
    if (!UI.open.tv) return;
    const total = DSZ.Props.TV_CHANNELS || 3;
    const ch = ((n - 1) % total + total) % total + 1;
    if (ch === UI.tvChannel) return;
    UI.tvChannel = ch;
    UI.tvSwitch = 0.28;                                // brief flicker on retune, like a real set
    syncTvLabels();
    for (const b of document.querySelectorAll('#tvchans button')) b.classList.toggle('on', b.textContent === 'CH ' + ch);
    // each channel carries its own audio beds; silence everything, then start the new ones
    tvAudioOff();
    if (A.tvStatic) A.tvStatic(ch === 1);
    if (A.tvMusic) A.tvMusic(ch === 2);
    if (A.tvVoice) A.tvVoice(ch === 2);
    if (A.tvTerm) A.tvTerm(ch === 4);
    A.play('click', null, null, 0.35);
  }
  UI.setTvChannel = setTvChannel;
  // ---------------------------------------------------------------- police computer
  // The office computer on the police desk. Same popup pattern as the TV: it pauses the
  // world, keeps its own small animation timer, and animates a canvas.
  UI.pcTab = 0;
  UI.openPC = function (obj) {
    UI.open.pc = true; UI.pcT = 0; UI.pcTab = 0;
    UI.pcRef = obj || null;
    UI.pcResized = false;
    buildPCTabs();
    els.pcwin.classList.remove('hidden');
    els.cursor.classList.toggle('ui', true);
    if (S) S.paused = true;
    if (A.pcTerm) A.pcTerm(true);          // the machine is powered, so it can be heard
    A.play('click');
  };
  // One place that silences the terminal, called from every close path: the button, Escape, the
  // window X, dying, and the safety net below. Leaving a running fan behind a closed window would
  // follow the player around the map.
  function pcAudioOff() { if (A.pcTerm) A.pcTerm(false); }
  UI.pcAudioOff = pcAudioOff;
  UI.closePC = function () {
    if (!UI.open.pc) return;
    UI.open.pc = false;
    pcAudioOff();
    els.pcwin.classList.add('hidden');
    if (S && !UI.open.menu && !UI.open.tv) S.paused = false;
    A.play('click');
  };
  function pcTabLabel() {
    return (DSZ.Props.PC_TABS || [])[UI.pcTab] || '';
  }
  function buildPCTabs() {
    const box = els.pctabs; if (!box) return;
    box.innerHTML = '';
    (DSZ.Props.PC_TABS || []).forEach((name, i) => {
      const b = document.createElement('button');
      b.textContent = name;
      b.className = i === UI.pcTab ? 'on' : '';
      b.onclick = () => { UI.pcTab = i; buildPCTabs(); els.pcmode.textContent = pcTabLabel(); A.play('click', null, null, 0.3); };
      box.appendChild(b);
    });
    els.pcmode.textContent = pcTabLabel();
  }
  // The canvas is 1080x660 in the markup, but it is displayed smaller on most windows. Rather
  // than draw at 1080 and let the browser shrink it (which is what made the text soft), resize
  // the backing store to the exact CSS size x devicePixelRatio. Text is then drawn at its true
  // size and is pixel-crisp at any window size.
  function sizePCScreen() {
    const cv = els.pcscreen; if (!cv) return false;
    const r = cv.getBoundingClientRect();
    if (r.width < 8) return false;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const wantW = Math.max(320, Math.round(r.width * dpr));
    const wantH = Math.round(wantW * 660 / 1080);
    if (cv.width === wantW && cv.height === wantH) return true;
    cv.width = wantW; cv.height = wantH;
    return true;
  }
  function renderPC(dt) {
    UI.pcT = (UI.pcT || 0) + (dt || 0.016);
    const cv = els.pcscreen; if (!cv) return;
    if (UI.pcResized !== true) UI.pcResized = sizePCScreen();
    if (!cv.width) return;
    const x = cv.getContext('2d');
    DSZ.Props.pcDraw(x, cv.width, cv.height, UI.pcT, UI.pcTab || 0);
  }
  UI.renderPC = renderPC;
  UI.resizePC = function () { UI.pcResized = false; sizePCScreen(); };

  // animate the enlarged broadcast on the popup canvas using the shared TV screen content
  function renderTV(dt) {
    UI.tvT = (UI.tvT || 0) + (dt || 0.016);
    const cv = els.tvscreen; if (!cv) return; const x = cv.getContext('2d');
    DSZ.Props.tvDrawChannel(x, cv.width, cv.height, UI.tvT, UI.tvSeed || 0, UI.tvChannel || 1);
    // brief static flash right after a channel change, so retuning feels physical
    if (UI.tvSwitch > 0) {
      UI.tvSwitch -= (dt || 0.016);
      const k = Math.max(0, UI.tvSwitch / 0.28);
      x.globalAlpha = 0.55 * k;
      x.fillStyle = '#dfe8f2'; x.fillRect(0, 0, cv.width, cv.height);
      x.globalAlpha = 1;
    }
  }
  UI.openMap = function () { if (!Inv.has(S.player.inv, 'map')) { DSZ.Game.toast(S, 'You need a Town Map.'); return; } UI.open.map = true; els.mapwin.classList.remove('hidden'); drawBigMap(); };
  UI.closeMap = function () { UI.open.map = false; els.mapwin.classList.add('hidden'); };
  UI.toggleMenu = function (v) { v = v === undefined ? !UI.open.menu : v; UI.open.menu = v; els.pause.classList.toggle('hidden', !v); if (S) S.paused = v; if (v) { cancelDrag(); A.engine(false); A.siren(false); } };
  UI.showSettings = function (v) { UI.open.settings = v; els.settings.classList.toggle('hidden', !v); if (v) buildSettings(); else if (!UI.open.title && S && S.state === 'play') { UI.toggleMenu(true); } titleVeil(); };
  UI.showControls = function (v) { UI.open.controls = v; els.controls.classList.toggle('hidden', !v); titleVeil(); };
  // On the title screen, Settings and Controls open on top of the title overlay. Hide the
  // title layer while either is open so its logo/menu neither show through nor intercept
  // clicks; restore it when both are closed. No effect during play (title is already off).
  function titleVeil() { if (!UI.open.title) return; els.title.classList.toggle('hidden', UI.open.settings || UI.open.controls); }
  UI.showTitle = function (v) {
    UI.open.title = v; els.title.classList.toggle('hidden', !v); els.hud.classList.toggle('hidden', v);
    // the hotbar lives outside #hud, so hide it with the HUD on the title screen
    els.hotbar.classList.toggle('hidden', v);
    // closing to the title also cancels any open inventory, so drop its HUD-hiding state
    if (v) { els.hud.classList.remove('win-open'); els.hotbar.classList.remove('win-open'); }
    else fitHud();
    $('t-continue').disabled = !DSZ.Game.hasSave(); if (v) { els.win.classList.add('hidden'); UI.open.win = false; UI.open.menu = false; els.pause.classList.add('hidden'); UI.open.death = false; els.death.classList.add('hidden'); UI.closeTV(); if (UI.syncDiff) UI.syncDiff(); }
  };
  UI.showLoading = function (v, txt, p) { $('loading').classList.toggle('hidden', !v); if (txt) $('ltxt').textContent = txt; if (p !== undefined) $('lbar').style.width = (p * 100) + '%'; };
  UI.showDeath = function (s) {
    UI.open.death = true; UI.closeWin(); UI.closeMap(); UI.closeTV(); if (UI.open.pc) UI.closePC(); else pcAudioOff(); els.death.classList.remove('hidden'); DSZ.Game.deleteSave();
    const why = { bite: 'Torn apart by the dead.', blast: 'Caught in an explosion.', crash: 'Killed in a crash.', hunger: 'You starved to death.', thirst: 'You died of thirst.', bleeding: 'You bled out.', infection: 'The infection took you.' }[s.deathCause] || 'You did not make it.';
    els.deathwhy.textContent = why;
    const hrs = ((s.day - 1) * 24 + s.hour - C.START_HOUR);
    const dname = (DSZ.DIFF[s.difficulty] || DSZ.DIFF.normal).name;
    els.deathstats.innerHTML = '<span>Difficulty</span><span>' + dname + '</span><span>Time survived</span><span>' + Math.floor(hrs / 24) + ' d ' + Math.floor(hrs % 24) + ' h</span><span>Nights survived</span><span>' + (s.stats.nights || 0) + '</span><span>Zombies killed</span><span>' + s.stats.kills + '</span><span>Containers searched</span><span>' + s.stats.looted + '</span><span>Structures built</span><span>' + s.stats.built + '</span><span>Distance on foot</span><span>' + s.stats.distance.toFixed(1) + ' km</span>';
  };
  UI.hideDeath = function () { UI.open.death = false; els.death.classList.add('hidden'); };
  // Full reset of transient UI state when a game starts or loads, so nothing (open windows,
  // overlays, active popups, drag, held keys) carries over from the previous session.
  // Persistent settings such as God Mode are handled separately and are NOT touched here.
  UI.resetGame = function () {
    cancelDrag(); hideTip();
    // a TV may be open on a channel with its own audio: stop every bed before dropping the flag,
    // otherwise it keeps playing (and stacking) after the new game starts
    tvAudioOff();
    setTvFocus(false);
    pcAudioOff();
    UI.loot = null; UI._isig = '';
    UI.open.win = false; UI.open.map = false; UI.open.menu = false; UI.open.settings = false;
    UI.open.controls = false; UI.open.tv = false; UI.open.death = false;
    for (const el of [els.win, els.mapwin, els.pause, els.settings, els.controls, els.death, els.tvwin, els.pcwin, els.lootcol]) el.classList.add('hidden');
    for (const k in In.keys) In.keys[k] = false; // drop any key held across the transition
    In.mouse.down = In.mouse.rdown = false;
    // window-open state must not leak into the next session (it hides the HUD corner panels)
    els.hud.classList.remove('win-open'); els.hotbar.classList.remove('win-open');
  };

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
    if (d.cols) add(d.slot === 'bag' ? 'Storage' : 'Pockets', d.cols + ' × ' + d.rows);
    if (d.quiet !== undefined) add('Noise', d.quiet);
    add('Size', d.w + ' × ' + d.h);
    return '<div class="t">' + d.type + '</div><b>' + d.name + (it.q > 1 ? ' ×' + it.q : '') + '</b>' + (d.desc ? '<div class="d">' + d.desc + '</div>' : '') + '<div class="s">' + rows.join('') + '</div>';
  }
  function showTip(it, el) { els.tip.innerHTML = itemTip(it); els.tip.classList.remove('hidden'); const r = el.getBoundingClientRect(); placeTip(r.right + 8, r.top); }
  function placeTip(x, y) { const t = els.tip, w = t.offsetWidth, h = t.offsetHeight; t.style.left = Math.min(window.innerWidth - w - 6, x) + 'px'; t.style.top = Math.min(window.innerHeight - h - 6, y) + 'px'; }
  function posTip(e) { if (hovered) placeTip(e.clientX + 16, e.clientY + 14); }
  function hideTip() { hovered = null; els.tip.classList.add('hidden'); }

  // ------------------------------------------------------------------ inventory rendering
  // storage grids are dynamic: one section per equipped item that provides capacity (bag,
  // legs, body, vest). gridEls maps a slot name to its grid element, rebuilt each renderInv.
  let gridEls = {};
  function gridObj(name) { const P = S.player.inv; return name === 'loot' ? (UI.loot && UI.loot.grid) : Inv.gridOf(P, name); }
  function gridEl(name) { return name === 'loot' ? els['g-loot'] : gridEls[name]; }
  function itemEl(it, name) {
    const d = I[it.id], [w, h] = Inv.size(it), e = document.createElement('div'); e.className = 'gi';
    e.style.cssText = 'left:' + (it.x * CELL) + 'px;top:' + (it.y * CELL) + 'px;width:' + (w * CELL) + 'px;height:' + (h * CELL) + 'px';
    let html = '<img src="' + img(it.id, it.tint) + '"' + (it.rot ? ' style="transform:rotate(90deg);width:' + (h * 88 / w) + '%;height:' + (w * 88 / h) + '%"' : '') + '>';
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
  // The vitals panel sits bottom-left and the hotbar is centred along the bottom. With the
  // compact sizing above they sit side by side on normal windows. If a window is narrow enough
  // that the centred hotbar would reach into the vitals, nudge the hotbar right just enough to
  // clear them (still bottom-aligned, so both stay readable). Only if there is no room to the
  // right does the vitals panel lift - which keeps very small windows usable.
  function fitHud() {
    const v = els.vitals, hb = els.hotbar;
    if (!v || !hb) return;
    hb.style.transform = '';                                // back to dead centre
    v.style.bottom = '';                                    // back to the CSS bottom
    if (els.hud.classList.contains('hidden')) return;
    const vr = v.getBoundingClientRect(), hr = hb.getBoundingClientRect();
    if (!hr.width || !vr.width) return;                     // not laid out yet
    // The car panel and Rozika both stack above the vitals. Offsets are measured rather than
    // hard-coded because the status chips and the car name can wrap. The car panel only exists
    // while driving, so it takes the slot directly above the vitals and Rozika moves up.
    const dh = els.doghud, ch = els.carhud;
    const placeStack = bottom => {
      let next = bottom + Math.round(vr.height) + 8;
      if (ch) {
        ch.style.bottom = next + 'px';
        if (!ch.classList.contains('hidden')) next += Math.round(ch.getBoundingClientRect().height) + 8;
      }
      if (dh) dh.style.bottom = next + 'px';
    };
    placeStack(18);
    const GAP = 10;
    const need = vr.right + GAP - hr.left;                  // px of horizontal clash
    if (need <= 0) return;                                  // already side by side
    const room = innerWidth - 18 - hr.right;                // space left of the right edge
    const shift = Math.min(need, Math.max(0, room));
    if (shift > 0) hb.style.transform = 'translateX(calc(-50% + ' + Math.ceil(shift) + 'px))';
    if (shift < need) {
      const nb = Math.round(window.innerHeight - hr.top + GAP);
      v.style.bottom = nb + 'px';
      // the vitals lifted, so the panels above them have to lift with them or they would overlap
      placeStack(nb);
    }
  }
  // Largest cell size that still keeps the equipment column, the widest storage grid and
  // (when a container is open) the container column visible at the same time. The 276px
  // equipment column is fixed by CSS; every grid column grows with CELL.
  function fitCell() {
    if (!S) return CELL_MAX;
    if (!UI.open.win) return CELL_MAX;
    // Unified Player screen: scale cells to the viewport so a fullscreen window uses the space
    // while a small window stays compact and scroll-free.
    if (UI.open.tab === 'player') {
      const byH = Math.floor((window.innerHeight - 317) / 12); // ~166px of headings/padding + 12 cell rows
      const byW = Math.floor((document.documentElement.clientWidth * 0.96 - 490) / 9);
      return U.clamp(Math.min(byH, byW), CELL_MIN, 44);
    }
    const P = S.player.inv;
    let storeCols = 0;
    for (const slot of Inv.STORE) { const g = Inv.gridOf(P, slot); if (g && g.w > storeCols) storeCols = g.w; }
    const lootCols = UI.loot ? UI.loot.grid.w : 0;
    const cols = storeCols + lootCols;
    if (!cols) return CELL_MAX;
    // Measure what does NOT scale with CELL: the equipment column, the gaps between columns,
    // the per-grid borders and the body padding. Everything else is (columns * CELL).
    // The available width is derived from the viewport (not the current window width) so the
    // result cannot oscillate: the window is capped at 96vw, so we only shrink when the
    // content at full size would not fit that cap.
    const body = els['tab-inv'];
    const cs = getComputedStyle(body);
    // Reserve room for the vertical scrollbar: once the content is taller than the window a
    // scrollbar appears and steals ~15px of width, which used to re-trigger horizontal scroll.
    const SCROLLBAR = 16;
    const avail = (document.documentElement.clientWidth * 0.96 - 2) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - SCROLLBAR;
    const gap = parseFloat(cs.columnGap) || 16;
    const eqW = els.eqcol.getBoundingClientRect().width || 276;
    const shownCols = (storeCols ? 1 : 0) + (lootCols ? 1 : 0);
    const fixed = eqW + gap * Math.max(0, shownCols);   // eq col + a gap before each grid column
    const borders = shownCols * 2;
    return U.clamp(Math.floor((avail - fixed - borders) / cols), CELL_MIN, CELL_MAX);
  }
  function renderGrid(name) {
    const el = gridEl(name), g = gridObj(name); if (!el) return; if (!g) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.style.width = (g.w * CELL + 2) + 'px'; el.style.height = (g.h * CELL + 2) + 'px';
    el.style.setProperty('--cell', CELL + 'px');
    el.innerHTML = '';
    for (const it of g.items) el.appendChild(itemEl(it, name));
  }
  const EQ = [['head', 'Head'], ['body', 'Body'], ['vest', 'Vest'], ['legs', 'Legs'], ['feet', 'Feet'], ['bag', 'Bag'], ['light', 'Light']];
  const SKIN_SW = ['#d6a680', '#f0d2b8', '#ecc4a4', '#a87856', '#78543c', '#583e2e'];
  const HAIR_SW = ['#462e1c', '#1e1814', '#966c3c', '#c4aa64', '#6e6e70', '#141416'];
  const CHAR_POSES = ['Idle', 'Walk', 'Armed'];
  let charAng = 1, charPose = 0;
  function paintEquip(el) {
    const P = S.player.inv; el.innerHTML = '';
    for (const [k, lab] of EQ) {
      const s = document.createElement('div'); s.className = 'eqslot'; s.dataset.eq = k; s.innerHTML = '<span class="lbl">' + lab + '</span>';
      const it = P.equip[k];
      if (it) { const im = document.createElement('img'); im.src = img(it.id, it.tint); im.draggable = false; im.addEventListener('mousedown', e => { if (e.button === 0) startDrag(e, it, { type: 'equip', slot: k }); }); im.addEventListener('contextmenu', e => { e.preventDefault(); quick(it, 'equip'); }); s.addEventListener('mouseenter', () => { hovered = it; showTip(it, s); }); s.addEventListener('mouseleave', hideTip); s.appendChild(im); }
      el.appendChild(s);
    }
  }
  function renderEquip() {
    paintEquip(els.equip);
    if (els.charequip) paintEquip(els.charequip);
    const hint = document.createElement('div'); hint.style.cssText = 'font-size:12px;color:var(--dim);margin-top:4px;width:276px'; hint.textContent = 'Drag items between grids or from the hotbar. Right-click to use / equip / move; with the inventory open, right-click a hotbar item to store it. R rotates while dragging. Weapons go on the hotbar.'; els.equip.appendChild(hint);
  }
  function renderCondition() {
    const p = S.player, hrs = ((S.day - 1) * 24 + S.hour - C.START_HOUR);
    const rows = [['Health', Math.round(p.hp) + ' / 100'], ['Hunger', Math.round(p.food) + '%'], ['Thirst', Math.round(p.water) + '%'], ['Energy', Math.round(p.energy) + '%'], ['Protection', Inv.armor(p.inv)], ['Carry weight', Inv.weight(p.inv).toFixed(1) + ' kg'], ['Infection', p.infection > 0 ? (p.infection > 30 ? Math.round(p.infection) + '%' : 'Unknown') : 'None'], ['Survived', Math.floor(hrs / 24) + 'd ' + Math.floor(hrs % 24) + 'h'], ['Zombies killed', S.stats.kills]];
    els.condition.innerHTML = '<div class="cond">' + rows.map(r => '<span>' + r[0] + '</span><span>' + r[1] + '</span>').join('') + '</div>';
  }
  function renderInv() {
    if (!S) return; renderEquip(); renderCondition();
    CELL = fitCell();
    const P = S.player.inv;
    // one storage section per equipped item that provides capacity; capacity is in the title.
    // order follows Inv.STORE (bag first, then legs, body, vest).
    const col = els.gridcol; col.innerHTML = ''; gridEls = {};
    for (const slot of Inv.STORE) {
      const g = Inv.gridOf(P, slot); if (!g) continue;
      const it = P.equip[slot], name = it ? I[it.id].name : (slot === 'bag' ? 'Bag' : slot);
      const h = document.createElement('h4'); h.textContent = name + '  ' + g.w + '×' + g.h; col.appendChild(h);
      const d = document.createElement('div'); d.className = 'grid'; d.dataset.slot = slot; col.appendChild(d);
      gridEls[slot] = d;
    }
    renderGrid('bag'); renderGrid('legs'); renderGrid('body'); renderGrid('vest');
    if (UI.loot) { els.lootcol.classList.remove('hidden'); els.loottitle.textContent = UI.loot.title; renderGrid('loot'); } else els.lootcol.classList.add('hidden');
    renderHot(true);
  }

  // -------------------------------------------------- character screen
  function paintSwatches(el, colors, current, key) {
    el.innerHTML = '';
    for (const col of colors) {
      const b = document.createElement('button'); b.className = 'swatch' + (String(current || '').toLowerCase() === col ? ' on' : '');
      b.style.background = col; b.title = col;
      b.onclick = () => { DSZ.Game.setAppearance(S, key, col); renderChar(); A.play('click'); };
      el.appendChild(b);
    }
  }
  function renderChar() {
    if (!S || !els['char-preview']) return;
    renderEquip();
    const cv = els['char-preview'], x = cv.getContext('2d');
    x.clearRect(0, 0, cv.width, cv.height);
    const armed = charPose === 2, P = S.player.inv, held = armed ? P.hot[P.sel] : null;
    const hdef = held && I[held.id];
    const gun = hdef && hdef.type === 'gun';
    const pose = armed ? (!hdef ? { arms: 'guard', af: 0, legs: 'idle', lf: 0, face: true }
      : gun || hdef.id === 'shotgun' ? { arms: hdef.id === 'shotgun' ? 'aimPump' : 'aim', af: 0, held: hdef.id, heldType: hdef.type, legs: 'idle', lf: 0, face: true }
        : { arms: 'swingR', af: 0, grip: (hdef.id === 'bat' || hdef.id === 'spear') ? 'two' : '', held: hdef.id, heldType: hdef.type, legs: 'idle', lf: 0, face: true })
      : charPose === 1 ? { arms: 'walk', af: 2, held: hdef && hdef.id, heldType: hdef && hdef.type, legs: 'walk', lf: 2, face: true }
      : { arms: 'idleEmpty', af: 0, legs: 'idle', lf: 0, face: true };
    const sp = DSZ.Fig.get(DSZ.Fig.playerSpec(S.player.look), charAng, pose);
    const sc = Math.min((cv.width - 16) / sp.c.width, (cv.height - 16) / sp.c.height);
    const dx = Math.round((cv.width - sp.c.width * sc) / 2), dy = Math.round((cv.height - sp.c.height * sc) / 2);
    x.imageSmoothingEnabled = false;
    const drawWeapon = () => {
      if (!hdef || !DSZ.Render.drawHeldTo) return;
      // Preview uses the world weapon renderer at world scale for melee, so the paper doll shows
      // exactly the same proportions as gameplay. Guns are only a few pixels long at that scale,
      // so they keep the small preview boost.
      const big = hdef.type === 'gun' ? 1.3 : 1;
      const fake = { ang: charAng, pose: { arms: pose.arms, af: pose.af, grip: pose.grip }, muzzle: 0, lightOn: false };
      x.save(); x.translate(dx, dy); x.scale(sc * big, sc * big);
      const anchor = sp.hand; // the shotgun is anchored to the trigger hand
      const hx = (anchor[0] + sp.ox) / big, hy = (anchor[1] + sp.oy) / big;
      const hx2 = (sp.hand2[0] + sp.ox) / big, hy2 = (sp.hand2[1] + sp.oy) / big;
      DSZ.Render.drawHeldTo(x, hdef, fake, hx, hy, S.player.look.skinCol || [214, 166, 128], hx2, hy2);
      x.restore();
    };
    // Match the gameplay depth order: when the holding hand is on the far side, the figure —
    // including the head — must cover the weapon instead of the grip drawing over the face.
    const depthBias = hdef && hdef.id === 'smg' ? (Math.cos(charAng) < -0.2 ? 0.07 : 0.012) : 0.012;
    const farHand = sp.handD < sp.bodyD + depthBias;
    if (farHand) drawWeapon();
    x.drawImage(sp.c, dx, dy, sp.c.width * sc, sp.c.height * sc);
    if (!farHand) drawWeapon();
    els['char-pose'].textContent = 'Pose: ' + CHAR_POSES[charPose];
    els['char-pose'].title = held ? 'Held: ' + I[held.id].name : (armed ? 'Select a weapon in the hotbar' : '');
    const ap = S.player.appearance || {};
    paintSwatches(els['skin-sw'], SKIN_SW, ap.skin, 'skin');
    paintSwatches(els['hair-sw'], HAIR_SW, ap.hair, 'hair');
    els['char-bald'].textContent = 'Bald: ' + (ap.bald ? 'On' : 'Off');
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
  UI.refresh = () => { hotbarLift(); if (UI.open.win) { if (UI.open.tab === 'inv' || UI.open.tab === 'char' || UI.open.tab === 'player') { renderInv(); if (UI.open.tab !== 'inv') renderChar(); } else renderCraft(); } renderHot(true); };
  UI.markCraftDirty = () => { UI._csig = null; };
  function renderHot(force) {
    if (!S) return; const P = S.player.inv, p = S.player;
    const sig = P.sel + '|' + P.hot.map(it => it ? it.id + it.q + (it.mag !== undefined ? it.mag : '') + (it.dur !== undefined ? (it.dur | 0) : '') : '-').join(',') + '|' + Inv.count(P, 'ammo9') + Inv.count(P, 'shell') + Inv.count(P, 'ammo762') + Inv.count(P, 'ammo556');
    if (!force && sig === hotSig) return; hotSig = sig;
    els.hotbar.querySelectorAll('.hslot').forEach((d, i) => {
      const it = P.hot[i]; d.classList.toggle('sel', P.sel === i);
      d.querySelectorAll('img,.q,.dur').forEach(n => n.remove());
      if (it) {
        const def = I[it.id], im = document.createElement('img'); im.src = img(it.id, it.tint); im.draggable = false; d.appendChild(im);
        let q = ''; if (def.type === 'gun') q = it.mag + '/' + Inv.count(P, def.ammo); else if (it.q > 1) q = it.q;
        if (q !== '') { const s = document.createElement('span'); s.className = 'q'; s.textContent = q; d.appendChild(s); }
        if (it.dur !== undefined && def.dur) { const f = U.clamp(it.dur / def.dur, 0, 1), b = document.createElement('div'); b.className = 'dur'; b.innerHTML = '<i style="width:' + f * 100 + '%"></i>'; d.appendChild(b); }
      }
    });
  }

  // ------------------------------------------------------------------ drag & drop
  // Right-clicking a hotbar item while the inventory is open stores it instead of using it:
  // using a weapon from the hotbar does nothing, and using a bandage in the middle of moving
  // gear wastes it. When a container is open the item goes into that container, otherwise
  // into the backpack. A full destination puts it back on the hotbar and says so.
  function storeFromHot(it) {
    const P = S.player.inv, idx = P.hot.indexOf(it);
    if (idx < 0) return false;
    const wasSel = P.sel === idx;
    P.hot[idx] = null; if (wasSel) P.sel = -1;
    let left = it;
    if (UI.loot) left = Inv.addTo(UI.loot.grid, it) === 0 ? null : it;
    if (left) left = Inv.give(P, it);
    if (left) { P.hot[idx] = left; if (wasSel) P.sel = idx; DSZ.Game.toast(S, 'No room in storage.'); A.play('thud', S.player.x, S.player.y, 0.4); }
    else { A.play('click'); DSZ.Game.toast(S, 'Stored ' + I[it.id].name); }
    UI.refresh();
    return !left;
  }
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
  // While the inventory/loot window is open, lift the hotbar above it so a drag from the grid
  // can actually reach a hotbar slot (the window otherwise covers all but a sliver of it).
  // The HUD's corner panels (vitals, clock/minimap) are hidden at the same time: they sit
  // under the window and the Condition list already shows the same values.
  function hotbarLift() {
    els.hotbar.classList.toggle('win-open', UI.open.win);
    els.hud.classList.toggle('win-open', UI.open.win);
    fitHud();
  }
  function sizeGhost() { const d = UI.drag; if (!d) return; const [w, h] = Inv.size(d.it), g = els.dragghost; g.style.width = w * CELL + 'px'; g.style.height = h * CELL + 'px'; g.innerHTML = '<img src="' + img(d.it.id, d.it.tint) + '"' + (d.it.rot ? ' style="transform:rotate(90deg)"' : '') + '>'; }
  function clearHL() { document.querySelectorAll('.cellhl').forEach(n => n.remove()); document.querySelectorAll('.eqslot.hl').forEach(n => n.classList.remove('hl')); }
  function target(e) {
    const t = document.elementFromPoint(e.clientX, e.clientY); if (!t) return null;
    const grid = t.closest && t.closest('.grid'); if (grid) { const name = grid.dataset.slot || (grid.id === 'g-loot' ? 'loot' : 'bag'); return { type: 'grid', name, el: grid }; }
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
      if (slot === t.slot) { const prev = P.equip[slot]; P.equip[slot] = it; if (Inv.STORE.indexOf(slot) >= 0) { Inv.refreshSlot(P, slot, DSZ.Game.dropFn(S)); } if (prev) { const left = Inv.give(P, prev); if (left) DSZ.Game.dropItem(S, S.player.x, S.player.y, left); } placed = true; DSZ.Game.refreshEquipVisuals(S); }
    } else if (t && t.type === 'world') { DSZ.Game.dropItem(S, S.player.x + Math.cos(S.player.ang) * 0.8, S.player.y + Math.sin(S.player.ang) * 0.8, it); placed = true; A.play('click'); }
    if (!placed) revert(d);
    else if (d.origin.type === 'equip' && Inv.STORE.indexOf(d.origin.slot) >= 0) { Inv.refreshSlot(P, d.origin.slot, DSZ.Game.dropFn(S)); }
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
    else if (UI.loot && from !== 'equip' && from !== 'loot') { Inv.remove(gridObj(from), it); if (Inv.addTo(UI.loot.grid, it) !== 0) { Inv.addTo(gridObj(from), it); G.toast(S, 'Container is full'); } else A.play('click'); }
    else { G.useItem(S, it); }
    UI.refresh();
  }
  function takeAll() { if (!UI.loot) return; const g = UI.loot.grid; for (const it of g.items.slice()) { Inv.remove(g, it); const left = Inv.give(S.player.inv, it); if (left) { Inv.addTo(g, left); } } A.play('pickup'); UI.refresh(); }

  // ------------------------------------------------------------------ crafting
  // Selecting a recipe only repaints the highlight and the detail pane. Rebuilding the whole
  // list on every click destroyed the tiles under the cursor (killing the hover state and
  // leaving the tooltip stuck), which made the menu feel unresponsive.
  function selectRecipe(r) {
    craftSel = r;
    for (const node of els.craftlist.children) node.classList.toggle('sel', node._recipe === r);
    renderCraftDetail();
  }
  function renderCraftDetail() {
    if (!S) return;
    const P = S.player.inv, st = Inv.stations(S), r = craftSel;
    if (!r) { els.craftdetail.innerHTML = ''; return; }
    const s = Inv.recipeState(P, r, st), od = I[r.out[0]];
    let html = '<h4>Recipe</h4><h3>' + od.name + (r.out[1] > 1 ? ' ×' + r.out[1] : '') + '</h3><div class="d">' + (r.desc || od.desc || '') + '</div><h4>Requires</h4>';
    for (const [id, q] of r.in) { if (q <= 0) continue; const have = Inv.countStored(P, id); html += '<div class="ing"><img src="' + img(id) + '" draggable="false"><span>' + I[id].name + '</span><b class="' + (have >= q ? 'ok' : 'no') + '">' + have + ' / ' + q + '</b></div>'; }
    if (r.needs) html += '<div class="ing"><img src="' + img(r.needs) + '" draggable="false"><span>' + I[r.needs].name + ' (tool)</span><b class="' + (Inv.has(P, r.needs) ? 'ok' : 'no') + '">' + (Inv.has(P, r.needs) ? 'have' : 'missing') + '</b></div>';
    if (r.station) html += '<div class="ing"><span style="padding-left:6px">' + (r.station === 'bench' ? 'Workbench nearby' : 'Fire nearby') + '</span><b class="' + (st[r.station] ? 'ok' : 'no') + '">' + (st[r.station] ? 'yes' : 'no') + '</b></div>';
    html += '<button class="btn" id="docraft" style="margin-top:10px;width:100%"' + (s.ok ? '' : ' disabled') + '>Craft</button>';
    els.craftdetail.innerHTML = html;
    const btn = $('docraft');
    if (btn) btn.onclick = () => { if (Inv.craft(P, r, Inv.stations(S), DSZ.Game.dropFn(S))) { A.play('craft'); DSZ.Game.toast(S, 'Crafted ' + od.name); renderCraft(); renderHot(true); } };
  }
  function renderCraft() {
    if (!S) return; UI._csig = craftSig(); const P = S.player.inv, st = Inv.stations(S), tabs = [...new Set(DSZ.RECIPES.map(r => r.tab))];
    els.crafttabs.innerHTML = '<h4>Categories</h4>';
    for (const t of tabs) { const b = document.createElement('button'); b.textContent = t; b.className = t === craftTab ? 'on' : ''; b.onclick = () => { craftTab = t; craftSel = null; renderCraft(); }; els.crafttabs.appendChild(b); }    const stat = document.createElement('div'); stat.style.cssText = 'margin-top:12px;font-size:13px;color:var(--dim)'; stat.innerHTML = 'Nearby<br><b style="color:' + (st.bench ? 'var(--good)' : 'var(--dim)') + '">' + (st.bench ? '● Workbench' : '○ Workbench') + '</b><br><b style="color:' + (st.fire ? 'var(--good)' : 'var(--dim)') + '">' + (st.fire ? '● Fire' : '○ Fire') + '</b>'; els.crafttabs.appendChild(stat);
    els.craftlist.innerHTML = '';
    const list = DSZ.RECIPES.filter(r => r.tab === craftTab); if (!craftSel || craftSel.tab !== craftTab) craftSel = list[0];
    for (const r of list) {
      const s = Inv.recipeState(P, r, st), d = document.createElement('div'); d.className = 'rcp' + (r === craftSel ? ' sel' : '') + (s.ok ? '' : ' no');
      d._recipe = r;
      d.innerHTML = '<img src="' + img(r.icon || r.out[0]) + '" draggable="false">' + (r.out[1] > 1 ? '<span class="q">' + r.out[1] + '</span>' : '') + (s.ok ? '<i class="ok"></i>' : '');
      d.onclick = () => { selectRecipe(r); A.play('click', null, null, 0.3); }; d.onmouseenter = () => { els.tip.innerHTML = '<b>' + I[r.out[0]].name + '</b><div class="d">' + (r.desc || I[r.out[0]].desc || '') + '</div>'; els.tip.classList.remove('hidden'); const rc = d.getBoundingClientRect(); placeTip(rc.right + 8, rc.top); }; d.onmouseleave = hideTip;
      d.addEventListener('mousedown', () => hideTip());
      els.craftlist.appendChild(d);
    }
    renderCraftDetail();
  }

  // ------------------------------------------------------------------ build bar
  let buildSig = '';
  function renderBuild() {
    const b = S.build, bar = els.buildbar; if (!b.active) { bar.classList.add('hidden'); buildSig = ''; return; }
    // Placing a carried item (the portable Workbench): the catalogue does not apply here, only
    // the controls do, and switching to another build would consume the item for the wrong thing.
    if (b.itemId) {
      const isig = 'item|' + b.itemId + '|' + (b.def && b.def.id) + '|' + (b.why || '');
      if (isig !== buildSig) { buildSig = isig; bar.classList.remove('hidden'); bar.innerHTML = '<div class="bhelp">LMB place &nbsp;·&nbsp; RMB / X cancel (keeps the item) &nbsp;·&nbsp; R rotate &nbsp;·&nbsp; B / Esc exit' + (b.why ? ' &nbsp;·&nbsp; <b style="color:var(--bad)">' + b.why + '</b>' : '') + '</div>'; }
      else bar.classList.remove('hidden');
      return;
    }
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
    DSZ.Props.poiLabels(x, (qx, qy) => [qx * k, qy * k], {
      mainFont: 'bold 13px Rajdhani, sans-serif', minorFont: 'bold 11px Rajdhani, sans-serif',
      mainH: 13, minorH: 11, mainColor: 'rgba(255,255,255,0.9)', minorColor: '#c6d6e4',
      stroke: 'rgba(0,0,0,0.9)', strokeW: 3, plate: 'rgba(6,10,14,0.68)'
    });
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
    const brightWrap = document.createElement('div'); brightWrap.style.cssText = 'display:flex;align-items:center;gap:8px';
    const brightVal = document.createElement('b'); brightVal.textContent = s.brightness + '%'; brightVal.style.cssText = 'min-width:38px;text-align:right;color:var(--accent)';
    const bright = slider('brightness', 70, 130, 5, () => { brightVal.textContent = s.brightness + '%'; }); bright.style.flex = '1';
    brightWrap.appendChild(bright); brightWrap.appendChild(brightVal);
    row('Brightness', brightWrap);
    // Difficulty for the NEXT new game. A loaded save keeps its own difficulty, so this
    // shows the running one too, to avoid confusion about why nothing changed mid-run.
    const running = (S && S.difficulty) ? DSZ.DIFF[S.difficulty].name : null;
    const diffEl = sel('difficulty', Object.keys(DSZ.DIFF).map(k => [k, DSZ.DIFF[k].name]), () => { if (UI.syncDiff) UI.syncDiff(); if (S) DSZ.Game.toast(S, 'Difficulty set to ' + DSZ.DIFF[s.difficulty].name + ' (applies to the next new game)'); });
    row('Difficulty (new game)', diffEl);
    if (running) { const note = document.createElement('div'); note.className = 'setnote'; note.textContent = 'This run is ' + running + '. Difficulty is locked to the save and applies from the next new game.'; b.appendChild(note); }
    row('Render resolution', sel('quality', [['auto', 'Auto (adaptive)'], ['1', '100%'], ['0.85', '85%'], ['0.7', '70%'], ['0.55', '55%']], () => DSZ.Main.applyQuality()));
    row('Lighting quality', sel('lightRes', [[0.2, 'Low'], [0.28, 'Medium'], [0.36, 'High'], [0.5, 'Ultra']], () => DSZ.Render.resize()));
    row('Film grain', tog('grain')); row('Bloom', tog('bloom')); row('UI blur', tog('blur', () => document.body.classList.toggle('noblur', !s.blur))); row('Show FPS', tog('showFps', () => els.fps.classList.toggle('hidden', !s.showFps)));
    row('God mode (admin)', tog('godmode', () => { if (S && s.godmode && DSZ.Game.godKit) DSZ.Game.godKit(S); els['tab-admin-btn'].classList.toggle('hidden', !s.godmode); if (S) DSZ.Game.toast(S, s.godmode ? 'God mode ON - immortal, empty pack, all items in admin.' : 'God mode OFF.'); }));
  }
  function buildControls() {
    const rows = [['W A S D', 'Move'], ['Mouse', 'Aim'], ['Left click', 'Attack / fire / use'], ['Right click', 'Steady aim'], ['Shift', 'Run'], ['Z', 'Sneak (toggle)'], ['Ctrl', 'Crouch (toggle)'], ['E', 'Interact · search · open · enter car'], ['T', 'Search nearest vehicle (trunk)'], ['Hold E', 'Pry locked door (crowbar/axe)'], ['1 – 6', 'Select hotbar item'], ['Tab / I / P', 'Player screen'], ['C', 'Crafting'], ['B', 'Base building'], ['F', 'Toggle flashlight'], ['R', 'Reload · rotate'], ['G', 'Refuel vehicle'], ['V', 'Rozika: stay / follow'], ['Q', 'Drop selected item'], ['M', 'Map (needs a Town Map)'], ['Mouse wheel', 'Zoom'], ['Car: W/S A/D', 'Drive · steer'], ['Car: Space', 'Handbrake'], ['Car: L / H', 'Headlights · horn'], ['Car: N', 'Police siren (toggle)'], ['Esc', 'Pause']];
    els.ctlbody.innerHTML = '<div class="ctl">' + rows.map(r => '<b>' + r[0] + '</b><span>' + r[1] + '</span>').join('') + '</div>';
  }

  // ------------------------------------------------------------------ per-frame HUD
  const vrows = {};
  // Rozika's panel. Hidden until a dog exists, so the HUD is unchanged for anyone without one.
  // The bar is bond itself; the note line carries the one thing the player actually needs to act
  // on - whether she will eat right now - rather than repeating the number twice.
  let dogSig = '';
  function renderDogHud(S) {
    const d = S && S.dog, el = els.doghud; if (!el) return;
    if (!d) {
      if (!el.classList.contains('hidden')) { el.classList.add('hidden'); dogSig = ''; }
      return;
    }
    el.classList.remove('hidden');
    const bond = Math.round(d.bond || 0);
    const tName = DSZ.Dog.tierName(bond);
    const ti = DSZ.Dog.tierIndex(bond);
    const stay = !!d.stay;
    // The note is the actionable half of the panel: can she eat right now, or not.
    let note, sig;
    if (d.fedT > 0) { note = '<b>' + Math.ceil(d.fedT) + 's</b> until she is hungry'; }
    else if (DSZ.Dog.pickFood(S.player.inv)) { note = 'E to <b>feed</b> her'; }
    else { note = 'no food - E to <b>pet</b>'; }
    sig = bond + '|' + ti + '|' + note + '|' + (stay ? 1 : 0);
    if (sig === dogSig) return;
    dogSig = sig;
    // "Stay" in the tier slot is the only mode indicator the HUD needs: the controls screen
    // documents V, and a stay command is otherwise invisible once the dog is off screen.
    els.dogtier.textContent = tName + (stay ? ' · Stay' : '');
    els.dogtier.className = 'dtier t' + ti;
    els.dogbond.style.width = bond + '%';
    els.dogbond.className = 't' + ti;
    els.dognote.innerHTML = note;
  }
  // Vehicle panel. Visible only while driving. The speedometer updates every frame so the number
  // tracks the car, while hull and fuel only touch the DOM when a rounded value actually moves.
  // Speed is world units per second, and one unit is one metre (the same scale the survival
  // distance stat uses), so km/h is simply m/s * 3.6.
  let carSig = '', carShown = false;
  function renderCarHud(S) {
    const el = els.carhud; if (!el) return;
    const c = S && S.player && S.player.driving;
    if (!c) {
      if (carShown) { el.classList.add('hidden'); carShown = false; carSig = ''; fitHud(); }
      return;
    }
    if (!carShown) { el.classList.remove('hidden'); carShown = true; carSig = ''; fitHud(); }
    const kmh = Math.round(Math.abs(c.speed || 0) * 3.6);
    if (els.carkmh.textContent !== String(kmh)) els.carkmh.textContent = kmh;
    const hp = Math.max(0, Math.round(c.hp)), maxhp = Math.max(1, Math.round(c.maxhp || 140));
    const fuel = Math.max(0, Math.round(c.fuel)), maxfuel = Math.max(1, Math.round(c.maxfuel || 60));
    const police = !!(DSZ.CarArt.K(c.kind).police), siren = !!c.sirenOn;
    const sig = c.kind + '|' + hp + '|' + fuel + '|' + (siren ? 1 : 0);
    if (sig === carSig) return;
    carSig = sig;
    els.carname.textContent = DSZ.CarArt.name(c.kind);
    els.carsirenrow.classList.toggle('hidden', !police);
    if (police) { els.carsiren.textContent = siren ? 'ON' : 'OFF'; els.carsiren.classList.toggle('on', siren); }
    const hf = hp / maxhp, ff = fuel / maxfuel;
    els.carhp.style.width = (hf * 100) + '%';
    els.carhp.className = hf > 0.55 ? 'ok' : hf > 0.25 ? 'mid' : 'low';
    els.carhpv.textContent = hp;
    els.carfuel.style.width = (ff * 100) + '%';
    els.carfuel.className = ff > 0.25 ? 'ok' : 'low';
    els.carfuelv.textContent = fuel;
  }
  UI.update = function (state, dt) {
    S = state; if (!S) return;
    const p = S.player;
    if (UI.open.tv) renderTV(dt);
    // safety net: no channel may outlive the popup. If the window is gone but a channel is still
    // tuned (e.g. a transition bypassed closeTV), reset to 1 and silence the commentary bed.
    // Focus is restored here too, so no code path can leave the world audio stuck ducked.
    // The labels are rewritten as well: the channel is forced back to 1 here, so leaving the
    // footer and the window title untouched would leave them reading the last channel watched
    // (CH 4 · TERMINAL) while the set is actually on 1 - visible the next time the popup opens
    // before the first retune.
    //
    // This else must stay attached to the TV if. When the police computer added its own
    // renderPC call between the two, the else silently rebound to that call, so the channel was
    // forced back to 1 on every frame the computer was closed - i.e. always. That is why the set
    // never held any channel but the first one.
    else {
      if (UI.tvChannel !== 1) { UI.tvChannel = 1; syncTvLabels(); }
      tvAudioOff(); setTvFocus(false);
    }
    if (UI.open.pc) renderPC(dt);
    // the same safety net for the office terminal: if the window is gone but the machine is still
    // running, cut it. This is the guarantee that no code path can leave a fan humming in an
    // empty room.
    if (!UI.open.pc) pcAudioOff();
    els.cursor.classList.toggle('ui', UI.blockMouse());
    if (!UI.open.title) {
      // key handling
      if (!UI.open.death && !UI.open.settings && !UI.open.controls) {
        if (In.pressed('Escape')) { if (UI.drag) cancelDrag(); else if (UI.open.tv) UI.closeTV(); else if (UI.open.pc) UI.closePC(); else if (UI.open.map) UI.closeMap(); else if (UI.open.win) UI.closeWin(); else if (S.build.active) { DSZ.Game.setBuild(S, false); } else UI.toggleMenu(); }
        else if (UI.open.tv) {
          // TV open: gameplay keys are blocked; the channel can be changed with the number keys or arrows
          if (In.pressed('Digit1')) setTvChannel(1);
          else if (In.pressed('Digit2')) setTvChannel(2);
          else if (In.pressed('Digit3')) setTvChannel(3);
          else if (In.pressed('Digit4')) setTvChannel(4);
          else if (In.pressed('ArrowRight')) setTvChannel((UI.tvChannel || 1) + 1);
          else if (In.pressed('ArrowLeft')) setTvChannel((UI.tvChannel || 1) - 1);
        }
        else if (!UI.open.menu) {
          if (In.pressed('Tab') || In.pressed('KeyI') || In.pressed('KeyP')) UI.toggleWin('player');
          if (In.pressed('KeyC')) UI.toggleWin('craft');
          if (In.pressed('KeyP')) UI.toggleWin('char');
          if (In.pressed('KeyM')) { if (UI.open.map) UI.closeMap(); else UI.openMap(); }
          if (In.pressed('KeyB') && !p.driving) { if (UI.open.win) UI.closeWin(); DSZ.Game.setBuild(S, !S.build.active); A.play('click'); }
          if (UI.drag && In.pressed('KeyR')) { UI.drag.it.rot = !UI.drag.it.rot; sizeGhost(); }
        }
      } else if (In.pressed('Escape')) { if (UI.open.settings) UI.showSettings(false); else if (UI.open.controls) UI.showControls(false); }
    } else if (In.pressed('Escape')) { if (UI.open.settings) UI.showSettings(false); if (UI.open.controls) UI.showControls(false); }
    hudT -= dt; const slow = hudT <= 0; if (slow) hudT = 0.12;
    if (UI.open.title) return;
    // vitals
    for (const node of vitalNodes) { const k = node.key, v = Math.round(p[k]); if (vrows[k] !== v) { vrows[k] = v; node.bar.style.width = Math.max(0, v) + '%'; node.value.textContent = v; node.row.classList.toggle('low', v < 22 && k !== 'stamina'); } }
    renderCarHud(S);
    renderHot(false);
    if (slow) {
      let st = ''; if (DSZ.settings.godmode) st += '<span class="warn">GOD MODE</span>'; if (p.thermal === 'cold') st += '<span class="warn">Cold</span>'; if (p.sneak) st += '<span class="quiet">Sneaking</span>'; if (p.bleed > 0) st += '<span>Bleeding</span>'; if (p.infection > 30) st += '<span>Infected</span>'; else if (p.infection > 0) st += '<span class="warn">Feverish</span>'; if (p.broken) st += '<span>Broken leg</span>'; if (p.food < 25) st += '<span class="warn">Hungry</span>'; if (p.water < 25) st += '<span class="warn">Thirsty</span>'; if (p.energy < 20) st += '<span class="warn">Tired</span>'; if (p.reload > 0) st += '<span class="warn">Reloading</span>';
      if (els.status.innerHTML !== st) { els.status.innerHTML = st; if (S.dog) fitHud(); }
      const h = Math.floor(S.hour), m = Math.floor((S.hour - h) * 60); els.clk.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); els.dayl.textContent = 'Day ' + S.day;
      const dname = (DSZ.DIFF[S.difficulty] || DSZ.DIFF.normal).name;
      if (els.dlab && els.dlab.textContent !== dname) els.dlab.textContent = dname;
      const H = S.horde;
      if (H && H.active) {
        const alive = S.zombies.reduce((a, z) => a + (!z.dead && z.horde ? 1 : 0), 0);
        els.nightw.classList.remove('hidden'); els.nightw.textContent = 'NIGHT \u00b7 ' + (H.left + alive) + ' LEFT';
      } else { els.nightw.classList.add('hidden'); }
      els.wx.textContent = S.weather.rain > 0.7 ? 'Storm' : (S.weather.rain > 0.15 ? 'Rain' : (DSZ.Render.daylight(S.hour) < 0.3 ? 'Night' : 'Clear'));
      drawMini();
      renderDogHud(S);
      const sig = S.toasts.map(t => t.text + t.kind).join('|'); if (sig !== toastSig) { toastSig = sig; els.toasts.innerHTML = S.toasts.map(t => '<div class="toast ' + t.kind + '">' + t.text + '</div>').join(''); }
      if (UI.open.win) { if (UI.open.tab === 'inv' && !UI.drag) { renderCondition(); } else if (UI.open.tab === 'craft') { /* only when the recipe availability actually changed */ if (!UI.drag) { const cs = craftSig(); if (cs !== UI._csig) { UI._csig = cs; renderCraft(); } } } if (UI.open.tab === 'inv' && !UI.drag) { const sg = invSig(); if (sg !== UI._isig) { UI._isig = sg; renderInv(); } } }
      if (UI.open.map) drawBigMap();
      if (UI.loot && UI.open.win && UI.loot.owner) { const o = UI.loot.owner, ox = o.x !== undefined ? (o.t !== undefined && o.hp !== undefined ? o.x + 0.5 : o.x) : p.x, oy = o.y !== undefined ? (o.t !== undefined && o.hp !== undefined ? o.y + 0.5 : o.y) : p.y; if (Math.hypot(ox - p.x, oy - p.y) > 3.6) { UI.closeWin(); } }
    }
    // prompt
    const f = S.focus, pr = els.prompt;
    if (f && !UI.open.win && !S.search && !S.prying && !UI.open.death) { const sp = DSZ.Render.toScreenCss(f.x, f.y, 1.7); pr.classList.remove('hidden'); if (pr.textContent !== f.label) pr.textContent = f.label; pr.style.left = sp[0] + 'px'; pr.style.top = sp[1] + 'px'; } else pr.classList.add('hidden');
    // progress
    const pg = els.progress, pgs = S.search || S.prying || (S.sleeping && { t: S.sleeping.t, total: 8, label: 'Sleeping' }) || (p.reload > 0 && { t: 1 - p.reload / (p.reloadItem ? I[p.reloadItem.id].reload : 1), total: 1, label: 'Reloading' });
    if (pgs) { pg.classList.remove('hidden'); els.proglabel.textContent = pgs.label || (S.prying ? 'Prying door open' : 'Searching'); els.progressBar.style.width = Math.min(100, pgs.t / pgs.total * 100) + '%'; } else pg.classList.add('hidden');
    renderBuild();
    if (S.sleeping) { /* handled in render via fade */ }
  };
  function invSig() { const P = S.player.inv; const f = g => g ? g.items.map(i => i.id + i.q + i.x + i.y + (i.mag || '') + (i.dur ? (i.dur | 0) : '')).join(',') : ''; return Inv.STORE.map(s => f(Inv.gridOf(P, s))).join('#') + '|' + (UI.loot ? f(UI.loot.grid) : '') + '|' + Object.values(P.equip).map(i => i ? i.id : '-').join(''); }
  // Signature of everything the crafting pane displays: the tab, the selected recipe and
  // whether each recipe is craftable right now. Used so the list is rebuilt only when its
  // appearance would actually change - rebuilding it every frame made clicks miss the tiles.
  function craftSig() {
    const P = S.player.inv, st = Inv.stations(S), list = DSZ.RECIPES.filter(r => r.tab === craftTab);
    return craftTab + '|' + (craftSel ? craftSel.out[0] : '-') + '|' + list.map(r => (Inv.recipeState(P, r, st).ok ? 1 : 0)).join('');
  }
  UI.fps = t => { if (DSZ.settings.showFps) els.fps.textContent = t; };
})();
