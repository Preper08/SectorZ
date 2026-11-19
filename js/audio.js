/* Dead SectorZ — fully procedural WebAudio (no assets) */
(function () {
  'use strict';
  const DSZ = window.DSZ;
  let ac = null, master = null, sfxBus = null, musBus = null, tvBus = null, noiseBuf = null, tvFocused = false;
  let lx = 0, ly = 0;
  let engine = null, wind = null, droneNodes = null, rainNode = null, tvMus = null, tvGen = 0, tvTermS = null, tvTgen = 0, tvVoiceS = null, tvVgen = 0, tvCh1S = null, tvC1gen = 0;
  // The police terminal's own bed, separate from the TV's. It lives on the sfx bus with a fixed
  // gain rather than going through the TV focus mix, because the terminal popup is not a
  // broadcast: it is a machine two feet in front of you, and it should sit under the world's
  // ambient wind rather than ducking it.
  let pcHumS = null, pcHumGen = 0;

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

  // TV mix. While the popup is open the set is what the player is looking at, so the broadcast
  // should sit on top of the world instead of being buried under the wind and footsteps.
  //   - ambient/music bus ducks to 30% of its normal level
  //   - world one-shot sfx duck too, so a nearby zombie or a step cannot talk over the news
  //   - the TV bus rises to 185% of normal
  // That is a 6x gap between the broadcast and the world, which is what makes the set read as
  // the thing the player is listening to. All three are driven from the single music volume
  // setting, so the user's slider (and the Volume setting above it) still governs the result.
  const TV_DUCK = 0.30, TV_BOOST = 1.85, SFX_DUCK = 0.34, SFX_BASE = 0.9;
  function applyTvMix(t, smooth) {
    if (!ac || !musBus || !tvBus || !sfxBus) return;
    const lv = DSZ.settings.music * 0.5;
    const set = (param, v) => {
      if (smooth > 0) param.setTargetAtTime(v, t, smooth);
      else param.value = v;
    };
    set(musBus.gain, tvFocused ? lv * TV_DUCK : lv);
    set(tvBus.gain, tvFocused ? lv * TV_BOOST : lv);
    set(sfxBus.gain, tvFocused ? SFX_BASE * SFX_DUCK : SFX_BASE);
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
    // A zombie's hunting call. The old version was a pure sawtooth that climbed to 820 Hz through
    // a narrow 1400 Hz band, which read as a human - specifically female - shriek and was the one
    // voice that grated. This is a low, torn-open roar instead: two chest-register sawtooths
    // detuned against each other so they beat, sagging as the breath runs out, shaped by two low
    // formants so it carries a vowel rather than a whistle, and buried in wet breath noise. Still
    // unmistakably an alert, but a throat rather than a voice.
    scream: (g, t) => {
      const d = 1.0 + Math.random() * 0.55;
      const f0 = 92 + Math.random() * 36;                    // stays in the male chest register
      const o1 = ac.createOscillator(); o1.type = 'sawtooth';
      const o2 = ac.createOscillator(); o2.type = 'sawtooth';
      o1.frequency.setValueAtTime(f0, t);
      o2.frequency.setValueAtTime(f0 * (1.045 + Math.random() * 0.03), t);
      o1.frequency.linearRampToValueAtTime(f0 * 0.60, t + d);
      o2.frequency.linearRampToValueAtTime(f0 * 0.64, t + d);
      // ragged flutter: a fast, uneven wobble on the pitch, which is what makes a throat sound torn
      const lf = ac.createOscillator(); lf.frequency.value = 10 + Math.random() * 7;
      const lg = ac.createGain(); lg.gain.value = 9 + Math.random() * 7;
      lf.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      // two formants, an open "aah" falling toward a closed "uhh"
      const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 3.2;
      f1.frequency.setValueAtTime(520, t); f1.frequency.linearRampToValueAtTime(330, t + d);
      const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 4.5;
      f2.frequency.setValueAtTime(1150, t); f2.frequency.linearRampToValueAtTime(700, t + d);
      const g2 = ac.createGain(); g2.gain.value = 0.55;
      const e = ac.createGain(); e.gain.setValueAtTime(0.0001, t);
      e.gain.linearRampToValueAtTime(0.62, t + 0.06);
      e.gain.linearRampToValueAtTime(0.34, t + d * 0.45);
      e.gain.linearRampToValueAtTime(0.0001, t + d);
      o1.connect(f1); f1.connect(e); o2.connect(f2); f2.connect(g2); g2.connect(e); e.connect(g);
      // wet breath riding on top, so it reads as a throat and not as a synth
      noise(g, t, d, 900, 300, 1.4, 'bandpass', 0.30, 0.05);
      o1.start(t); o2.start(t); lf.start(t);
      o1.stop(t + d + 0.05); o2.stop(t + d + 0.05); lf.stop(t + d + 0.05);
    },
    bite: (g, t) => { noise(g, t, 0.12, 2200, 400, 1, 'bandpass', 0.8); tone(g, t, 0.1, 200, 80, 'square', 0.3); },
    hurt: (g, t) => { tone(g, t, 0.25, 260, 120, 'sawtooth', 0.6); noise(g, t, 0.2, 1200, 300, 1, 'lowpass', 0.5); },
    door: (g, t) => { tone(g, t, 0.22, 110, 70, 'triangle', 0.9); noise(g, t, 0.18, 600, 150, 1, 'lowpass', 0.5); },
    doorBreak: (g, t) => { noise(g, t, 0.5, 2400, 150, 0.8, 'lowpass', 1.5, 0.002); tone(g, t, 0.3, 90, 35, 'sine', 1.2); },
    glass: (g, t) => { noise(g, t, 0.5, 9000, 2500, 1.5, 'highpass', 0.9, 0.001); for (let i = 0; i < 6; i++) tone(g, t + i * 0.05, 0.1, 3000 + Math.random() * 3000, 1500, 'triangle', 0.15); },
    pickup: (g, t) => { tone(g, t, 0.08, 500, 900, 'sine', 0.35); },
    click: (g, t) => tone(g, t, 0.03, 1100, 800, 'square', 0.18),
    // CRT arc: a very short, very bright tick. Kept tiny on purpose - it fires often when you
    // stand next to a set, so anything louder would become a nuisance rather than an accent.
    tvArc: (g, t) => { noise(g, t, 0.035, 4200, 1400, 3.5, 'bandpass', 0.5, 0.001); tone(g, t, 0.02, 2600, 900, 'square', 0.07, 0.001); },
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
    sleep: (g, t) => tone(g, t, 1.2, 220, 110, 'sine', 0.25, 0.3),
    // ---- the dog. Two short voiced sounds, both built from a sawtooth glottal source pushed
    // through a formant pair, the same technique as the TV commentator. A chihuahua is small,
    // so the fundamental is high for a dog (330-420 Hz) and the formants sit close together,
    // which is what gives a yappy, nasal character rather than a big dog's chesty woof.
    dogBark: (g, t) => {
      for (let k = 0; k < 2; k++) {
        const t0 = t + k * 0.17, d = 0.11;
        const f = 350 + Math.random() * 70;
        const o = ac.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f, t0);
        o.frequency.exponentialRampToValueAtTime(f * 0.62, t0 + d);
        const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5;
        f1.frequency.setValueAtTime(1150, t0); f1.frequency.exponentialRampToValueAtTime(820, t0 + d);
        const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 7; f2.frequency.value = 2400;
        const g2 = ac.createGain(); g2.gain.value = 0.34;
        const e = ac.createGain();
        e.gain.setValueAtTime(0.0001, t0);
        e.gain.exponentialRampToValueAtTime(0.5, t0 + 0.008);
        e.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        o.connect(f1); f1.connect(e); o.connect(f2); f2.connect(g2); g2.connect(e); e.connect(g);
        o.start(t0); o.stop(t0 + d + 0.02);
        noise(g, t0, d * 0.8, 2400, 900, 2, 'bandpass', 0.16, 0.004);
      }
    },
    // a thin, rising whine: one slow sine sweep with a little breath on it
    dogWhine: (g, t) => {
      const d = 0.62;
      const o = ac.createOscillator(); o.type = 'triangle';
      const f = 620 + Math.random() * 120;
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 1.34, t + d * 0.45);
      o.frequency.linearRampToValueAtTime(f * 1.12, t + d);
      const lf = ac.createOscillator(); lf.frequency.value = 5.5 + Math.random() * 2;
      const lg = ac.createGain(); lg.gain.value = 12; lf.connect(lg); lg.connect(o.frequency);
      const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 2.4; fl.frequency.value = 1300;
      const e = ac.createGain();
      e.gain.setValueAtTime(0.0001, t);
      e.gain.linearRampToValueAtTime(0.22, t + 0.12);
      e.gain.linearRampToValueAtTime(0.0001, t + d);
      o.connect(fl); fl.connect(e); e.connect(g);
      o.start(t); lf.start(t); o.stop(t + d + 0.05); lf.stop(t + d + 0.05);
    }
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
        // The TV gets its own bus, separate from the ambient/music bus. While a set is open the
        // ambient bus is ducked and this one keeps its level, so the broadcast sits clearly on
        // top of the wind instead of being buried in it.
        tvBus = ac.createGain(); tvBus.gain.value = DSZ.settings.music * 0.5; tvBus.connect(master);
        noiseBuf = mkNoise();
        Audio.ready = true;
      } catch (e) { Audio.ready = false; }
    },
    setVolume() {
      if (!master) return;
      master.gain.value = DSZ.settings.volume;
      applyTvMix(ac.currentTime, 0.05);
    },
    // While a TV popup is open the player is watching that set, so the world audio should step
    // back: duck the ambient/music bus and raise the TV bus above it. Restoring on close returns
    // both buses to exactly their previous levels. The TV bus is raised, not boosted past the
    // master, so the user's own volume and music settings are still respected.
    tvFocus(on) {
      if (!ac || !musBus || !tvBus) return;
      if (on === tvFocused) return;
      tvFocused = !!on;
      applyTvMix(ac.currentTime, tvFocused ? 0.25 : 0.45);
    },
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
    },
    // ---- Channel 1: the set itself, not the broadcast.
    // Channel 1 shows a dying emergency broadcast, so what the player actually hears is the
    // television: a 60 Hz mains buzz with its harmonics, the flyback transformer's high whine,
    // and a soft bed of static. Nothing here is "content" - it is the noise an old CRT makes
    // when it is powered on and receiving something weak. All of it is procedural, and like the
    // other beds it lives on the TV bus so the focus mix can lift it over the world.
    tvStatic(on) {
      if (!ac) return;
      if (on && !tvCh1S) {
        const token = tvC1gen = (tvC1gen + 1);
        const bus = ac.createGain(); bus.gain.value = 0; bus.connect(tvBus);

        // mains buzz: a 60 Hz sawtooth through two resonant lowpasses. The second filter is what
        // gives the buzz its nasal, "something is humming in the room" character instead of a
        // flat electrical tone.
        const hum = ac.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 60;
        const humF1 = ac.createBiquadFilter(); humF1.type = 'lowpass'; humF1.frequency.value = 220; humF1.Q.value = 5;
        const humF2 = ac.createBiquadFilter(); humF2.type = 'peaking'; humF2.frequency.value = 120; humF2.Q.value = 2.5; humF2.gain.value = 7;
        const humG = ac.createGain(); humG.gain.value = 0.026;
        hum.connect(humF1); humF1.connect(humF2); humF2.connect(humG); humG.connect(bus);

        // flyback whine: the 15.6 kHz line whistle a CRT makes. Kept very low and rolled off
        // above 12 kHz so it reads as pressure in the ears rather than a piercing tone.
        const whine = ac.createOscillator(); whine.type = 'sine'; whine.frequency.value = 15600;
        const whineG = ac.createGain(); whineG.gain.value = 0.0016;
        const whineLp = ac.createBiquadFilter(); whineLp.type = 'lowpass'; whineLp.frequency.value = 12000;
        whine.connect(whineLp); whineLp.connect(whineG); whineG.connect(bus);

        // static bed: bandpassed noise with a slow amplitude wobble, so it breathes like a weak
        // signal instead of hissing at a constant level. Two bands: one around 900 Hz, which is
        // what makes the set audible on laptop speakers where 60 Hz simply cannot be reproduced,
        // and a higher hiss near 3.2 kHz for the "weak signal" air.
        const stat = ac.createBufferSource(); stat.buffer = noiseBuf; stat.loop = true;
        const statLoF = ac.createBiquadFilter(); statLoF.type = 'bandpass'; statLoF.frequency.value = 900; statLoF.Q.value = 0.9;
        const statLoG = ac.createGain(); statLoG.gain.value = 0.10;
        const statHiF = ac.createBiquadFilter(); statHiF.type = 'bandpass'; statHiF.frequency.value = 3200; statHiF.Q.value = 0.45;
        const statHiG = ac.createGain(); statHiG.gain.value = 0.075;
        const wob = ac.createOscillator(); wob.type = 'sine'; wob.frequency.value = 0.13;
        const wobG = ac.createGain(); wobG.gain.value = 0.026;
        wob.connect(wobG); wobG.connect(statLoG.gain);
        const wob2 = ac.createOscillator(); wob2.type = 'sine'; wob2.frequency.value = 0.071;
        const wob2G = ac.createGain(); wob2G.gain.value = 0.02;
        wob2.connect(wob2G); wob2G.connect(statHiG.gain);
        stat.connect(statLoF); statLoF.connect(statLoG); statLoG.connect(bus);
        stat.connect(statHiF); statHiF.connect(statHiG); statHiG.connect(bus);

        // degauss: old sets shudder once when switched on. A short 50 Hz thump with a metallic
        // ring reads as that.
        const degauss = (t) => {
          const o = ac.createOscillator(); o.type = 'sawtooth';
          o.frequency.setValueAtTime(70, t);
          o.frequency.exponentialRampToValueAtTime(38, t + 0.5);
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 110; bp.Q.value = 2.5;
          const g = ac.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
          o.connect(bp); bp.connect(g); g.connect(bus);
          o.start(t); o.stop(t + 0.6);
        };

        hum.start(); whine.start(); stat.start(); wob.start(); wob2.start();
        tvCh1S = { bus, hum, whine, stat, wob, wob2, token };
        bus.gain.setTargetAtTime(0.55, ac.currentTime, 0.45);
        degauss(ac.currentTime + 0.03);
      } else if (!on && tvCh1S) {
        const m = tvCh1S; tvCh1S = null;
        tvC1gen++;
        try {
          m.bus.gain.setTargetAtTime(0.0001, ac.currentTime, 0.15);
          setTimeout(() => {
            try { m.hum.stop(); } catch (e) { /* already stopped */ }
            try { m.whine.stop(); } catch (e) { /* already stopped */ }
            try { m.stat.stop(); } catch (e) { /* already stopped */ }
            try { m.wob.stop(); } catch (e) { /* already stopped */ }
            try { m.wob2.stop(); } catch (e) { /* already stopped */ }
            try { m.bus.disconnect(); } catch (e) { /* already gone */ }
          }, 600);
        } catch (e) { /* ignore */ }
      }
    },
    // ---- Channel 2: the breaking-news bed.
    // A real bulletin bed is not melodic: it is a low sustained drone, a minor pad that breathes,
    // a slow heartbeat pulse for urgency, a sparse teletype tick and an occasional tension swell
    // that never resolves. Everything is procedural and kept under the ambient wind, gunfire and
    // footsteps, so it colours the channel without drowning the game.
    tvMusic(on) {
      if (!ac) return;
      if (on && !tvMus) {
        const t0 = ac.currentTime + 0.05;
        // generation token: a stale scheduler tick from a previous set must never revive the bed
        const gen = tvGen = (tvGen + 1);
        const bed = ac.createGain(); bed.gain.value = 0; bed.connect(tvBus);
        const filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 900; filt.Q.value = 0.7;
        filt.connect(bed);

        // weight: two low saws an octave and a fifth apart, barely moving
        const drone = [];
        for (const spec of [[55, 0.017], [82.41, 0.011]]) {   // A1, E2
          const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = spec[0];
          o.detune.value = (Math.random() - 0.5) * 9;
          const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 190;
          const g = ac.createGain(); g.gain.value = spec[1];
          o.connect(lp); lp.connect(g); g.connect(filt); o.start(t0);
          drone.push(o);
        }

        // pad: an A-minor triad under a slow filter LFO, so it breathes instead of droning
        const lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.055;
        const lfoG = ac.createGain(); lfoG.gain.value = 240;
        const padFilt = ac.createBiquadFilter(); padFilt.type = 'lowpass'; padFilt.frequency.value = 640; padFilt.Q.value = 1.2;
        lfo.connect(lfoG); lfoG.connect(padFilt.frequency); lfo.start(t0); padFilt.connect(filt);
        const pads = [];
        for (const fr of [220, 261.63, 329.63]) {              // A3, C4, E4
          const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
          o.detune.value = (Math.random() - 0.5) * 7;
          const g = ac.createGain(); g.gain.value = 0.011;
          o.connect(g); g.connect(padFilt); o.start(t0);
          pads.push(o);
        }

        // one low pulse: the "lub" of a lub-dub heartbeat, the bed's slow march
        const pulse = (t, f, dur, gv) => {
          const o = ac.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(f, t);
          o.frequency.exponentialRampToValueAtTime(f * 0.6, t + dur);
          const g = ac.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(gv, t + 0.014);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g); g.connect(filt); o.start(t); o.stop(t + dur + 0.03);
        };
        // teletype tick: a dry click on a bandpassed noise burst
        const tick = (t) => {
          const s = ac.createBufferSource(); s.buffer = noiseBuf;
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3300; bp.Q.value = 2.4;
          const g = ac.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.007, t + 0.003);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
          s.connect(bp); bp.connect(g); g.connect(filt);
          s.start(t, Math.random() * 1.4, 0.04);
        };
        // tension swell: a filtered noise rise that never resolves
        const swell = (t) => {
          const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3.2;
          bp.frequency.setValueAtTime(200, t);
          bp.frequency.linearRampToValueAtTime(1500, t + 2.6);
          const g = ac.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.015, t + 2.1);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
          s.connect(bp); bp.connect(g); g.connect(filt);
          s.start(t); s.stop(t + 2.9);
        };
        // opening sting: three low notes rising, the way a bulletin announces itself
        const sting = (t) => {
          const notes = [[146.83, 0], [174.61, 0.20], [220, 0.40]];   // D3, F3, A3 (D minor)
          for (const n of notes) {
            const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = n[0];
            const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300;
            const g = ac.createGain();
            g.gain.setValueAtTime(0.0001, t + n[1]);
            g.gain.exponentialRampToValueAtTime(0.026, t + n[1] + 0.03);
            g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] + 0.55);
            o.connect(lp); lp.connect(g); g.connect(filt);
            o.start(t + n[1]); o.stop(t + n[1] + 0.6);
          }
        };

        // scheduler: a slow heartbeat march, a teletype tick, an occasional swell
        const sched = { nextBeat: 0.9, nextTick: 0.15, nextSwell: 6 + Math.random() * 5 };
        const step = () => {
          if (!tvMus || tvGen !== gen) return;
          const now = ac.currentTime + 0.02;
          if (now >= sched.nextBeat) {
            pulse(now, 62, 0.34, 0.058);
            pulse(now + 0.24, 52, 0.44, 0.04);             // the "dub"
            sched.nextBeat = now + 1.75;
          }
          if (now >= sched.nextTick) { tick(now); sched.nextTick = now + 0.42 + Math.random() * 0.1; }
          if (now >= sched.nextSwell) { swell(now + 0.05); sched.nextSwell = now + 9 + Math.random() * 6; }
        };
        tvMus = { bed, filt, drone, pads, lfo, timer: setInterval(step, 80), gen };
        bed.gain.setTargetAtTime(0.30, ac.currentTime, 0.7);   // fade in, subdued
        sting(ac.currentTime + 0.1);
        step();
      } else if (!on && tvMus) {
        const m = tvMus; tvMus = null;
        tvGen++;                                   // invalidate any in-flight scheduler tick
        clearInterval(m.timer);
        try {
          m.bed.gain.setTargetAtTime(0.0001, ac.currentTime, 0.22);
          setTimeout(() => {
            try { for (const o of m.drone) o.stop(); } catch (e) { /* already stopped */ }
            try { for (const o of m.pads) o.stop(); } catch (e) { /* already stopped */ }
            try { m.lfo.stop(); } catch (e) { /* already stopped */ }
            try { m.bed.disconnect(); } catch (e) { /* already gone */ }
          }, 800);
        } catch (e) { /* ignore */ }
      }
    },
    // ---- Channel 4: retro terminal audio. A quiet CRT mains hum plus a high flyback whine,
    // irregular mechanical key clicks in typing bursts, and an occasional modem handshake
    // followed by a data screech. All procedural; stops completely when the channel changes.
    tvTerm(on) {
      if (!ac) return;
      if (on && !tvTermS) {
        const gen = tvTgen = (tvTgen + 1);
        const bus = ac.createGain(); bus.gain.value = 0; bus.connect(tvBus);
        // CRT hum: mains buzz through a resonant lowpass
        const hum = ac.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 60;
        const humF = ac.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 240; humF.Q.value = 4;
        const humG = ac.createGain(); humG.gain.value = 0.011;
        hum.connect(humF); humF.connect(humG); humG.connect(bus); hum.start();
        // flyback whine, barely there
        const whine = ac.createOscillator(); whine.type = 'sine'; whine.frequency.value = 7200;
        const whineG = ac.createGain(); whineG.gain.value = 0.0022;
        whine.connect(whineG); whineG.connect(bus); whine.start();

        // one keypress: noise click through a bandpass plus a low mechanical thock
        const clack = (t, hard) => {
          const s = ac.createBufferSource(); s.buffer = noiseBuf;
          s.playbackRate.value = 0.9 + Math.random() * 0.5;
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
          bp.frequency.value = 2200 + Math.random() * 1600; bp.Q.value = 1.4;
          const g = ac.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(hard ? 0.072 : 0.042, t + 0.002);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
          s.connect(bp); bp.connect(g); g.connect(bus);
          s.start(t, Math.random() * 1.2, 0.06);
          const o = ac.createOscillator(); o.type = 'triangle';
          o.frequency.value = 150 + Math.random() * 60;
          const og = ac.createGain();
          og.gain.setValueAtTime(0.0001, t);
          og.gain.exponentialRampToValueAtTime(hard ? 0.045 : 0.026, t + 0.003);
          og.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.08);
        };

        // modem: two short dial tones, then a warbling data screech
        const modem = (t0) => {
          let t = t0;
          for (const [f, d] of [[1400, 0.18], [2100, 0.14], [900, 0.22]]) {
            const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
            const g = ac.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.030, t + 0.012);
            g.gain.setValueAtTime(0.030, t + d - 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t + d);
            o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + 0.02);
            t += d;
          }
          const dur = 0.9;
          const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6;
          bp.frequency.setValueAtTime(800, t);
          bp.frequency.linearRampToValueAtTime(3200, t + dur * 0.6);
          bp.frequency.linearRampToValueAtTime(1200, t + dur);
          const g = ac.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.026, t + 0.05);
          g.gain.setValueAtTime(0.026, t + dur - 0.1);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          s.connect(bp); bp.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.05);
          // carrier warbling over the data
          const o = ac.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(1200, t);
          const lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 11;
          const lg = ac.createGain(); lg.gain.value = 380;
          lfo.connect(lg); lg.connect(o.frequency);
          const og = ac.createGain();
          og.gain.setValueAtTime(0.0001, t);
          og.gain.exponentialRampToValueAtTime(0.011, t + 0.08);
          og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(og); og.connect(bus); o.start(t); o.stop(t + dur + 0.05);
          lfo.start(t); lfo.stop(t + dur + 0.05);
        };

        // scheduler: runs 60 ms apart and fires the next key or modem burst when due
        const st = { typing: 5 + ((Math.random() * 10) | 0), nextKey: 0.25, nextModem: 3.6 };
        const step = () => {
          if (!tvTermS || tvTgen !== gen) return;
          const now = ac.currentTime + 0.02;
          if (now >= st.nextKey) {
            if (st.typing > 0) {
              clack(now, Math.random() < 0.16);
              st.typing--;
              st.nextKey = now + 0.035 + Math.random() * 0.085;
            } else {
              st.typing = 5 + ((Math.random() * 14) | 0);
              st.nextKey = now + 0.5 + Math.random() * 1.2;
            }
          }
          if (now >= st.nextModem) { modem(now); st.nextModem = now + 10 + Math.random() * 8; }
        };
        tvTermS = { bus, hum, whine, timer: setInterval(step, 60) };
        bus.gain.setTargetAtTime(0.5, ac.currentTime, 0.5);
      } else if (!on && tvTermS) {
        const m = tvTermS; tvTermS = null;
        tvTgen++;
        clearInterval(m.timer);
        try {
          m.bus.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2);
          setTimeout(() => {
            try { m.hum.stop(); } catch (e) { /* already stopped */ }
            try { m.whine.stop(); } catch (e) { /* already stopped */ }
            try { m.bus.disconnect(); } catch (e) { /* already gone */ }
          }, 700);
        } catch (e) { /* ignore */ }
      }
    },
    // ---- The police terminal in the office.
    // Unlike the TV channels this is not a broadcast: it is a machine on a desk that you are
    // standing at. So it gets a quiet, close, dry sound with no static bed and no music -
    // a case fan and a monitor whine, keystrokes while the player is reading, and the rare
    // disk seek. Everything is deliberately below the ambient wind so it never competes
    // with the world: the point is that the room feels occupied, not that you are watching TV.
    pcTerm(on) {
      if (!ac) return;
      if (on && !pcHumS) {
        const gen = pcHumGen = (pcHumGen + 1);
        // Its own gain, straight to the sfx bus, so the TV focus mix cannot touch it and the
        // world's ambient ducks never silence it. 0.34 of normal keeps it clearly under the wind.
        const bus = ac.createGain(); bus.gain.value = 0; bus.connect(sfxBus);

        // case fan: filtered noise, mostly low, with a faint tonal component from the bearing.
        // A fan is the thing you actually hear from a running desktop, so it is the backbone.
        const fan = ac.createBufferSource(); fan.buffer = noiseBuf; fan.loop = true;
        const fanLp = ac.createBiquadFilter(); fanLp.type = 'lowpass'; fanLp.frequency.value = 420; fanLp.Q.value = 0.7;
        const fanG = ac.createGain(); fanG.gain.value = 0.055;
        fan.connect(fanLp); fanLp.connect(fanG); fanG.connect(bus);
        const fanTone = ac.createOscillator(); fanTone.type = 'sine'; fanTone.frequency.value = 118;
        const fanToneG = ac.createGain(); fanToneG.gain.value = 0.012;
        fanTone.connect(fanToneG); fanToneG.connect(bus);

        // monitor whine: the 7.2 kHz line whistle, quieter than the TV's because you are close
        // to it and a loud one is unbearable at desk distance.
        const whine = ac.createOscillator(); whine.type = 'sine'; whine.frequency.value = 7200;
        const whineG = ac.createGain(); whineG.gain.value = 0.0013;
        whine.connect(whineG); whineG.connect(bus);

        // a keypress: a soft mechanical click, much quieter than the TV terminal's clack, since
        // this one is at arm's length rather than across a room
        const key = (t) => {
          const s = ac.createBufferSource(); s.buffer = noiseBuf;
          s.playbackRate.value = 0.85 + Math.random() * 0.4;
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
          bp.frequency.value = 1500 + Math.random() * 900; bp.Q.value = 1.6;
          const g = ac.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.020, t + 0.002);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.030);
          s.connect(bp); bp.connect(g); g.connect(bus);
          s.start(t, Math.random() * 1.2, 0.05);
          const o = ac.createOscillator(); o.type = 'triangle';
          o.frequency.value = 132 + Math.random() * 40;
          const og = ac.createGain();
          og.gain.setValueAtTime(0.0001, t);
          og.gain.exponentialRampToValueAtTime(0.012, t + 0.003);
          og.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
          o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.07);
        };

        // disk seek: a short ratchet of three ticks with rising pitch, the sound of a machine
        // doing something on its own while you read
        const seek = (t0) => {
          let t = t0;
          for (let i = 0; i < 3; i++) {
            const o = ac.createOscillator(); o.type = 'square';
            o.frequency.value = 480 + i * 190 + Math.random() * 90;
            const g = ac.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.009, t + 0.002);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
            o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.04);
            t += 0.055 + Math.random() * 0.03;
          }
        };

        // the fan starts spinning up, not instantly at level
        fan.start(); fanTone.start(); whine.start();
        bus.gain.setTargetAtTime(0.34, ac.currentTime, 0.35);

        // scheduler: typing comes in bursts with long pauses, because the player is reading,
        // not writing. Roughly one burst every 4-9 s, plus a seek every 11-19 s.
        const st = { typing: 3 + ((Math.random() * 6) | 0), nextKey: 0.6, nextSeek: 5 + Math.random() * 6 };
        const step = () => {
          if (!pcHumS || pcHumGen !== gen) return;
          const now = ac.currentTime + 0.02;
          if (now >= st.nextKey) {
            if (st.typing > 0) {
              key(now); st.typing--;
              st.nextKey = now + 0.05 + Math.random() * 0.11;
            } else {
              st.typing = 3 + ((Math.random() * 7) | 0);
              st.nextKey = now + 4 + Math.random() * 5;
            }
          }
          if (now >= st.nextSeek) { seek(now); st.nextSeek = now + 11 + Math.random() * 8; }
        };
        pcHumS = { bus, fan, fanTone, whine, timer: setInterval(step, 60) };
      } else if (!on && pcHumS) {
        const m = pcHumS; pcHumS = null;
        pcHumGen++;
        clearInterval(m.timer);
        try {
          // the fan coasts down rather than cutting out
          m.bus.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25);
          setTimeout(() => {
            try { m.fan.stop(); } catch (e) { /* already stopped */ }
            try { m.fanTone.stop(); } catch (e) { /* already stopped */ }
            try { m.whine.stop(); } catch (e) { /* already stopped */ }
            try { m.bus.disconnect(); } catch (e) { /* already gone */ }
          }, 900);
        } catch (e) { /* ignore */ }
      }
    },
    // ---- Channel 2: the commentator's voice.
    // A formant "babble" voice, not a recording: one sawtooth glottal source is driven through
    // three parallel bandpass formant filters, so changing a vowel is just changing F1/F2/F3.
    // Syllables are scheduled a second ahead with a pitch contour that falls across each phrase
    // and lands on its last syllable, short noise bursts stand in for consonants, and a breath
    // of silence separates phrases. It reads unmistakably as a newsreader talking, without any
    // audio file, speech API or per-syllable node allocation - the whole voice is six nodes and
    // one timer, and it sits under the ambient wind like the music bed does.
    tvVoice(on) {
      if (!ac) return;
      if (on && !tvVoiceS) {
        const token = tvVgen = (tvVgen + 1);
        const bus = ac.createGain(); bus.gain.value = 0;
        // broadcast speaker band: cut only the sub-bass rumble and the hiss above the voice.
        // The highpass sits at 90 Hz, not 230: a male fundamental is around 120 Hz, and cutting
        // there would leave only harmonics behind - a thin, nasal voice instead of a chesty one.
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90; hp.Q.value = 0.6;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.6;
        hp.connect(lp); lp.connect(bus); bus.connect(tvBus);

        // glottal source: a sawtooth with a little vibrato, shaped later by the syllable envelope
        const src = ac.createOscillator(); src.type = 'sawtooth'; src.frequency.value = 118;
        const vib = ac.createOscillator(); vib.type = 'sine'; vib.frequency.value = 5.2;
        const vibG = ac.createGain(); vibG.gain.value = 1.6;
        vib.connect(vibG); vibG.connect(src.frequency);

        // formants: three parallel resonators, the classic F1/F2/F3 of a male speaking voice.
        // Q is deliberately wide (3.4, not 7+): a sawtooth only puts harmonics every F0 apart, so
        // a very narrow band would catch one harmonic and the voice would come out thin and quiet.
        // Gains rise towards F2/F3 because a sawtooth falls off as 1/f, and without the lift the
        // voice ends up bass-heavy mush instead of something that reads as speech.
        const F = [];
        const formSum = ac.createGain(); formSum.gain.value = 1;
        for (const spec of [[700, 1.0], [1220, 1.35], [2600, 0.95]]) {
          const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = spec[0]; f.Q.value = 3.4;
          const g = ac.createGain(); g.gain.value = spec[1];
          src.connect(f); f.connect(g); g.connect(formSum); F.push(f);
        }
        // syllable envelope sits after the formants, so only the shaped voice is gated
        const env = ac.createGain(); env.gain.value = 0.0001;
        formSum.connect(env); env.connect(hp);

        // consonants: a bandpassed noise burst on its own short envelope
        const nz = ac.createBufferSource(); nz.buffer = noiseBuf; nz.loop = true;
        const nF = ac.createBiquadFilter(); nF.type = 'bandpass'; nF.frequency.value = 2600; nF.Q.value = 1.1;
        const nG = ac.createGain(); nG.gain.value = 0.0001;
        nz.connect(nF); nF.connect(nG); nG.connect(hp);

        src.start(); vib.start(); nz.start();

        // vowels as (F1, F2, F3), the open unhurried set a reader actually uses
        const VOW = [
          [730, 1090, 2440],   // a
          [530, 1840, 2480],   // e
          [400, 1900, 2600],   // schwa
          [570, 840, 2410],    // o
          [300, 870, 2240],    // u
          [270, 2290, 3010]    // i
        ];
        // Syllable queue. Kept in absolute AudioContext time and topped up ahead of the clock so
        // a late timer cannot clip a syllable; `left` counts down the syllables of a phrase.
        const st = { at: ac.currentTime + 1.3, left: 0, len: 6, startF0: 120, phrase: 0 };
        const schedule = (horizon, now) => {
          while (st.at < horizon) {
            if (st.left <= 0) {
              st.at += 0.18 + Math.random() * 0.22;         // a short breath between phrases
              if (st.at < now) st.at = now;                  // never schedule into the past
              st.len = 5 + ((Math.random() * 9) | 0);
              st.left = st.len;
              st.startF0 = 118 + Math.random() * 18;
              st.phrase++;
            }
            const t = st.at;
            const dur = 0.13 + Math.random() * 0.08;
            const v = VOW[(Math.random() * VOW.length) | 0];
            // pitch: a slow declination across the phrase, landing on the last syllable
            const prog = (st.len - st.left) / Math.max(1, st.len - 1);
            let f0 = st.startF0 * (1.05 - 0.17 * prog) * (1 + (Math.random() - 0.5) * 0.05);
            if (st.left === 1) f0 *= 0.87;
            for (let k = 0; k < 3; k++) F[k].frequency.setTargetAtTime(v[k], t, 0.018);
            src.frequency.setTargetAtTime(f0, t, 0.03);
            const amp = 0.115 + Math.random() * 0.035;
            env.gain.setValueAtTime(0.0001, t);
            env.gain.exponentialRampToValueAtTime(amp, t + 0.028);
            env.gain.setValueAtTime(amp, t + Math.max(0.05, dur - 0.055));
            env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            // a leading consonant on roughly every other syllable
            if (Math.random() < 0.55) {
              const ct = Math.max(0, t - 0.035);
              nF.frequency.setValueAtTime(2200 + Math.random() * 1200, ct);
              nG.gain.setValueAtTime(0.0001, ct);
              nG.gain.exponentialRampToValueAtTime(0.045, ct + 0.008);
              nG.gain.exponentialRampToValueAtTime(0.0001, ct + 0.048);
            }
            st.at = t + dur + 0.006 + Math.random() * 0.018;
            st.left--;
          }
        };
        const pump = () => {
          if (!tvVoiceS || tvVgen !== token) return;
          schedule(ac.currentTime + 1.0, ac.currentTime);
        };
        tvVoiceS = { bus, env, nG, src, vib, nz, F, timer: setInterval(pump, 140), token };
        bus.gain.setTargetAtTime(0.38, ac.currentTime, 0.6);   // clear of the bed, under the wind
        pump();
      } else if (!on && tvVoiceS) {
        const m = tvVoiceS; tvVoiceS = null;
        tvVgen++;                                   // invalidate any in-flight scheduler tick
        clearInterval(m.timer);
        try {
          m.bus.gain.setTargetAtTime(0.0001, ac.currentTime, 0.18);
          setTimeout(() => {
            try { m.src.stop(); } catch (e) { /* already stopped */ }
            try { m.vib.stop(); } catch (e) { /* already stopped */ }
            try { m.nz.stop(); } catch (e) { /* already stopped */ }
            try { m.bus.disconnect(); } catch (e) { /* already gone */ }
          }, 700);
        } catch (e) { /* ignore */ }
      }
    }
  };
})();
