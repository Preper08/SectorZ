/* Dead SectorZ — fully procedural WebAudio (no assets) */
(function () {
  'use strict';
  const DSZ = window.DSZ;
  let ac = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
  let lx = 0, ly = 0;
  let engine = null, wind = null, droneNodes = null, rainNode = null;

  function mkNoise() {
    const len = ac.sampleRate * 2, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3; }
    return b;
  }

  function out(x, y, vol, maxd) {
    // returns a gain node routed to sfx bus with distance attenuation + pan
    const g = ac.createGain();
    let v = vol, pan = 0;
    if (x !== undefined && x !== null) {
      const dx = x - lx, dy = y - ly, d = Math.hypot(dx, dy), md = maxd || 40;
      v *= Math.max(0, 1 - d / md) ** 1.5;
      pan = Math.max(-1, Math.min(1, (dx - dy) / 24));
    }
    g.gain.value = v;
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(sfxBus); }
    else g.connect(sfxBus);
    return v > 0.002 ? g : null;
  }

  function noise(g, t, dur, f0, f1, q, type, gain, attack) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.Q.value = q || 0.7;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const e = ac.createGain(); e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(gain, t + (attack || 0.004));
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(e); e.connect(g);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function tone(g, t, dur, f0, f1, type, gain, attack) {
    const o = ac.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const e = ac.createGain(); e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(gain, t + (attack || 0.005));
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e); e.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }

  const SFX = {
    step: (g, t) => noise(g, t, 0.09, 700, 180, 0.6, 'lowpass', 0.5),
    stepRun: (g, t) => noise(g, t, 0.1, 900, 200, 0.6, 'lowpass', 0.8),
    swing: (g, t) => noise(g, t, 0.18, 500, 2400, 1.2, 'bandpass', 0.35, 0.05),
    hit: (g, t) => { noise(g, t, 0.14, 1200, 160, 0.8, 'lowpass', 1.0); tone(g, t, 0.12, 140, 50, 'sine', 0.8); },
    hitFlesh: (g, t) => { noise(g, t, 0.2, 900, 120, 1.2, 'lowpass', 1.0); tone(g, t, 0.16, 110, 40, 'sine', 0.9); },
    gun_pistol: (g, t) => { noise(g, t, 0.28, 5200, 300, 0.5, 'lowpass', 1.4, 0.001); tone(g, t, 0.18, 180, 45, 'triangle', 1.0, 0.001); },
    gun_shotgun: (g, t) => { noise(g, t, 0.6, 4200, 140, 0.5, 'lowpass', 1.8, 0.001); tone(g, t, 0.35, 120, 30, 'triangle', 1.4, 0.001); },
    gun_rifle: (g, t) => { noise(g, t, 0.5, 6200, 200, 0.5, 'lowpass', 1.6, 0.001); tone(g, t, 0.3, 150, 35, 'triangle', 1.2, 0.001); },
    reload: (g, t) => { tone(g, t, 0.05, 900, 400, 'square', 0.25); tone(g, t + 0.25, 0.07, 500, 300, 'square', 0.3); tone(g, t + 0.5, 0.05, 1200, 500, 'square', 0.2); },
    empty: (g, t) => tone(g, t, 0.04, 1500, 700, 'square', 0.3),
    groan: (g, t) => {
      const d = 0.9 + Math.random() * 0.8, f = 70 + Math.random() * 40;
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * (0.6 + Math.random() * 0.3), t + d);
      const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 4;
      fl.frequency.setValueAtTime(420, t); fl.frequency.linearRampToValueAtTime(700 + Math.random() * 300, t + d * 0.5); fl.frequency.linearRampToValueAtTime(300, t + d);
      const e = ac.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.5, t + 0.15); e.gain.linearRampToValueAtTime(0.0001, t + d);
      const lf = ac.createOscillator(); lf.frequency.value = 7 + Math.random() * 4; const lg = ac.createGain(); lg.gain.value = 12; lf.connect(lg); lg.connect(o.frequency);
      o.connect(fl); fl.connect(e); e.connect(g); o.start(t); lf.start(t); o.stop(t + d + 0.05); lf.stop(t + d + 0.05);
      noise(g, t, d, 900, 400, 2, 'bandpass', 0.18, 0.2);
    },
    scream: (g, t) => {
      const d = 1.1, o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(380, t); o.frequency.linearRampToValueAtTime(820, t + 0.3); o.frequency.linearRampToValueAtTime(300, t + d);
      const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 3; fl.frequency.value = 1400;
      const e = ac.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.5, t + 0.08); e.gain.linearRampToValueAtTime(0.0001, t + d);
      o.connect(fl); fl.connect(e); e.connect(g); o.start(t); o.stop(t + d + 0.05);
    },
    bite: (g, t) => { noise(g, t, 0.12, 2200, 400, 1, 'bandpass', 0.8); tone(g, t, 0.1, 200, 80, 'square', 0.3); },
    hurt: (g, t) => { tone(g, t, 0.25, 260, 120, 'sawtooth', 0.6); noise(g, t, 0.2, 1200, 300, 1, 'lowpass', 0.5); },
    door: (g, t) => { tone(g, t, 0.22, 110, 70, 'triangle', 0.9); noise(g, t, 0.18, 600, 150, 1, 'lowpass', 0.5); },
    doorBreak: (g, t) => { noise(g, t, 0.5, 2400, 150, 0.8, 'lowpass', 1.5, 0.002); tone(g, t, 0.3, 90, 35, 'sine', 1.2); },
    glass: (g, t) => { noise(g, t, 0.5, 9000, 2500, 1.5, 'highpass', 0.9, 0.001); for (let i = 0; i < 6; i++) tone(g, t + i * 0.05, 0.1, 3000 + Math.random() * 3000, 1500, 'triangle', 0.15); },
    pickup: (g, t) => { tone(g, t, 0.08, 500, 900, 'sine', 0.35); },
    click: (g, t) => tone(g, t, 0.03, 1100, 800, 'square', 0.18),
    craft: (g, t) => { tone(g, t, 0.07, 400, 300, 'square', 0.3); tone(g, t + 0.09, 0.07, 500, 380, 'square', 0.3); tone(g, t + 0.2, 0.2, 700, 1000, 'sine', 0.3); },
    build: (g, t) => { noise(g, t, 0.1, 1800, 400, 1, 'bandpass', 0.8); tone(g, t, 0.1, 160, 90, 'square', 0.4); noise(g, t + 0.14, 0.1, 1800, 400, 1, 'bandpass', 0.7); },
    eat: (g, t) => { for (let i = 0; i < 4; i++) noise(g, t + i * 0.12, 0.08, 1800, 600, 1, 'bandpass', 0.5); },
    drink: (g, t) => { for (let i = 0; i < 3; i++) tone(g, t + i * 0.14, 0.1, 300 + i * 60, 200, 'sine', 0.3); },
    bandage: (g, t) => noise(g, t, 0.4, 3000, 1500, 0.8, 'bandpass', 0.4, 0.08),
    horn: (g, t) => { tone(g, t, 0.6, 392, 392, 'square', 0.35, 0.02); tone(g, t, 0.6, 494, 494, 'square', 0.3, 0.02); },
    explosion: (g, t) => { noise(g, t, 1.4, 3000, 60, 0.5, 'lowpass', 2.2, 0.002); tone(g, t, 0.8, 70, 25, 'sine', 2); },
    whoosh: (g, t) => noise(g, t, 0.35, 800, 3000, 0.8, 'bandpass', 0.4, 0.1),
    ignite: (g, t) => { noise(g, t, 0.6, 1500, 400, 0.6, 'bandpass', 0.7, 0.05); },
    alarm: (g, t) => { for (let i = 0; i < 6; i++) tone(g, t + i * 0.4, 0.2, 900, 900, 'square', 0.18); },
    thud: (g, t) => { tone(g, t, 0.2, 90, 40, 'sine', 1.0); noise(g, t, 0.1, 400, 100, 1, 'lowpass', 0.5); },
    carHit: (g, t) => { noise(g, t, 0.3, 2000, 200, 0.8, 'lowpass', 1.2, 0.001); tone(g, t, 0.25, 100, 40, 'sine', 1); },
    ding: (g, t) => { tone(g, t, 0.6, 880, 880, 'sine', 0.3, 0.01); tone(g, t, 0.6, 1320, 1320, 'sine', 0.15, 0.01); },
    sleep: (g, t) => tone(g, t, 1.2, 220, 110, 'sine', 0.25, 0.3)
  };

  const Audio = DSZ.Audio = {
    ready: false,
    init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = DSZ.settings.volume;
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
        master.connect(comp); comp.connect(ac.destination);
        sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
        musBus = ac.createGain(); musBus.gain.value = DSZ.settings.music * 0.5; musBus.connect(master);
        noiseBuf = mkNoise();
        Audio.ready = true;
      } catch (e) { Audio.ready = false; }
    },
    setVolume() { if (master) { master.gain.value = DSZ.settings.volume; musBus.gain.value = DSZ.settings.music * 0.5; } },
    setListener(x, y) { lx = x; ly = y; },
    play(name, x, y, vol, maxd) {
      if (!ac || !SFX[name]) return;
      const g = out(x, y, vol === undefined ? 1 : vol, maxd);
      if (!g) return;
      try { SFX[name](g, ac.currentTime + 0.001); } catch (e) { /* ignore */ }
    },
    startAmbient() {
      if (!ac || wind) return;
      const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 360; f.Q.value = 0.4;
      const g = ac.createGain(); g.gain.value = 0.12;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.08; const lg = ac.createGain(); lg.gain.value = 140;
      lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      s.connect(f); f.connect(g); g.connect(musBus); s.start();
      wind = { g, f };
      // dark drone pad
      const mk = (fr, gv) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = fr; const og = ac.createGain(); og.gain.value = gv; o.connect(og); og.connect(musBus); o.start(); return og; };
      droneNodes = [mk(55, 0.07), mk(82.4, 0.04), mk(110.3, 0.025)];
      // rain
      const rs = ac.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true;
      const rf = ac.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1800;
      const rg = ac.createGain(); rg.gain.value = 0; rs.connect(rf); rf.connect(rg); rg.connect(musBus); rs.start();
      rainNode = rg;
    },
    setAmbient(night, rain) {
      if (!ac || !wind) return;
      const t = ac.currentTime;
      wind.g.gain.setTargetAtTime(0.07 + night * 0.12, t, 1);
      if (droneNodes) droneNodes.forEach((n, i) => n.gain.setTargetAtTime((0.025 + night * 0.06) / (i + 1), t, 2));
      if (rainNode) rainNode.gain.setTargetAtTime(rain * 0.12, t, 1.5);
    },
    engine(on, rpm, vol) {
      if (!ac) return;
      if (on && !engine) {
        const o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 2;
        const g = ac.createGain(); g.gain.value = 0;
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus); o1.start(); o2.start();
        engine = { o1, o2, f, g };
      }
      if (engine) {
        const t = ac.currentTime;
        if (!on) { engine.g.gain.setTargetAtTime(0, t, 0.1); const e = engine; engine = null; setTimeout(() => { try { e.o1.stop(); e.o2.stop(); } catch (er) { /* */ } }, 400); return; }
        engine.o1.frequency.setTargetAtTime(32 + rpm * 70, t, 0.05);
        engine.o2.frequency.setTargetAtTime(16 + rpm * 35, t, 0.05);
        engine.f.frequency.setTargetAtTime(260 + rpm * 700, t, 0.05);
        engine.g.gain.setTargetAtTime((0.13 + rpm * 0.12) * (vol === undefined ? 1 : vol), t, 0.08);
      }
    }
  };
})();
