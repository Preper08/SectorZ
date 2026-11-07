/* Dead SectorZ — boot, loading, title screen, main loop, adaptive resolution */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, C = DSZ.C, R = DSZ.Render, In = DSZ.Input, A = DSZ.Audio, Game = DSZ.Game, UI = DSZ.UI;
  const Main = DSZ.Main = { mode: 'boot' };
  let canvas, S = null, last = 0, acc = 0, ft = 16, ftN = 0, scaleCool = 3, fpsT = 0, frames = 0, orbit = 0, booted = false, errShown = false;

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const tick = async (txt, p) => { UI.showLoading(true, txt, p); await wait(30); };

  Main.applyQuality = function () {
    const q = DSZ.settings.quality;
    if (q === 'auto') { if (!R.scale || R.scale < 0.5) R.scale = 1; } else R.scale = +q;
    R.resize();
  };

  async function boot() {
    canvas = document.getElementById('game');
    R.scale = DSZ.settings.quality === 'auto' ? 1 : +DSZ.settings.quality || 1;
    document.body.classList.toggle('noblur', !DSZ.settings.blur);
    await tick('Painting the world…', 0.1);
    DSZ.Tex.init();
    await tick('Preparing renderer…', 0.3);
    In.init(canvas);
    R.init(canvas);
    UI.init();
    await tick('Building the town…', 0.5);
    startTitleWorld();
    await tick('Almost there…', 1);
    UI.showLoading(false);
    UI.showTitle(true);
    booted = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  // A world running behind the title menu (cinematic orbit at dusk)
  function startTitleWorld(seed) {
    S = Game.newGame(seed || ((Math.random() * 1e9) | 0));
    S.paused = true; S.cinema = 1; S.title = true; S.toasts.length = 0;
    S.hour = 18.6; S.weather.rain = 0.0; S.weather.target = 0;
    UI.setState(S); orbit = Math.random() * 6.28;
    S.player.lightOn = true;
    R.dirtyAll();
  }

  async function begin(saved) {
    UI.showTitle(false); UI.hideDeath(); UI.showLoading(true, 'Generating town…', 0.15);
    await wait(40);
    const seed = saved ? saved.seed : ((Math.random() * 1e9) | 0);
    R.dirtyAll();
    S = Game.newGame(seed, saved || null);
    S.title = false; S.cinema = 0; S.paused = false;
    UI.setState(S); UI.showLoading(true, 'Starting…', 1); await wait(60);
    UI.showLoading(false); UI.open.win = false; UI.open.menu = false; UI.open.title = false;
    document.getElementById('hud').classList.remove('hidden');
    A.init(); A.setVolume(); A.startAmbient();
    Main.mode = 'play'; R.dirtyAll();
    UI.refresh();
  }
  Main.startNew = () => begin(null);
  Main.cont = () => { const d = Game.readSave(); if (d) begin(d); else begin(null); };
  Main.toTitle = function () {
    A.engine(false); UI.hideDeath(); UI.closeWin(); UI.closeMap(); document.getElementById('pause').classList.add('hidden');
    UI.open.menu = false; UI.showLoading(true, 'Returning…', 0.5);
    setTimeout(() => { startTitleWorld(); Main.mode = 'title'; UI.showLoading(false); UI.showTitle(true); }, 40);
  };

  function titleCam(dt) {
    orbit += dt * 0.035; const c = S.cam, p = S.player;
    c.x = p.x + Math.cos(orbit) * 7; c.y = p.y + Math.sin(orbit * 0.8) * 5; c.zoom = 1.25 + Math.sin(orbit * 0.7) * 0.05; c.shake = 0;
    S.time += dt; S.hour = 18.6 + Math.sin(S.time * 0.01) * 0.3;
    p.aimAng = p.ang = orbit * 1.3; p.lightOn = true;
    DSZ.Ents.updateParticles(S, dt);
  }

  function adapt(dtMs, workMs) {
    if (DSZ.settings.quality !== 'auto' || Main.mode !== 'play') return;
    // judge by how long our own frame work takes, not by the vsync interval -
    // otherwise a 30 Hz display would keep lowering the resolution even when we are fast
    const ms = workMs || dtMs;
    ft += (ms - ft) * 0.08; scaleCool -= dtMs / 1000;
    if (scaleCool > 0) return;
    if (ft > 26 && R.scale > 0.5) { R.setScale(Math.max(0.5, +(R.scale - 0.08).toFixed(2))); scaleCool = 2; }
    else if (ft < 14.5 && R.scale < 1) { R.setScale(Math.min(1, +(R.scale + 0.05).toFixed(2))); scaleCool = 6; }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000; last = now; if (!(dt > 0)) dt = 0.016; const rawMs = dt * 1000; dt = Math.min(dt, 0.05);
    const work0 = performance.now();
    try {
      if (UI.open.title || S.title) { titleCam(dt); }
      else {
        // pointer → world for aiming handled in Game.update via S.mouse
        Game.update(S, dt);
      }
      R.frame(S, dt);
      UI.update(S, dt);
      adapt(rawMs, performance.now() - work0);
    } catch (e) {
      if (!errShown) { errShown = true; console.error('Frame error', e); }
      window.__dszError = e;
    }
    In.endFrame();
    frames++; fpsT += rawMs; if (fpsT >= 500) { UI.fps(Math.round(frames * 1000 / fpsT) + ' fps · ' + Math.round(R.scale * 100) + '%'); window.__fps = frames * 1000 / fpsT; frames = 0; fpsT = 0; }
  }

  window.addEventListener('resize', () => { if (booted) { R.resize(); } });
  window.addEventListener('beforeunload', () => { try { if (S && !S.title) Game.save(S); } catch (e) { /* */ } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S && !S.title && !UI.open.menu && S.state === 'play') UI.toggleMenu(true); });
  window.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('error', e => { window.__dszError = e.error || e.message; });
  window.addEventListener('load', () => { boot().catch(e => { console.error(e); window.__dszError = e; document.getElementById('ltxt').textContent = 'Error: ' + e.message; }); });
})();
