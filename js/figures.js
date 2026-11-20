/* Dead SectorZ — humanoid sprites: posed 3D skeleton rendered as shaded capsules from any heading.
   Used for the player, survivors and every zombie type. Sprites are cached per (spec, heading, pose). */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U;
  const Fig = DSZ.Fig = { NANG: 16 };
  const VX = 0.612, VY = 0.612, VZ = 0.5, ZU = 39.2, SC = 45.25;
// Shared by pose() and render.js: how far the body rises at the top of a window vault, in world
// units. One constant because the figure's joints are lifted inside the pose and the sprite
// itself is lifted in the renderer, and the two have to agree or the legs detach from the body.
DSZ.VAULT_LIFT = 0.30;
const VAULT_LIFT = DSZ.VAULT_LIFT;

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // two-bone IK with a bend hint vector
  function ik(a, t, l1, l2, hint) {
    let d = sub(t, a), D = len(d);
    const maxd = (l1 + l2) * 0.999;
    if (D > maxd) { t = add(a, mul(nrm(d), maxd)); d = sub(t, a); D = maxd; }
    const dn = nrm(d);
    const x = (l1 * l1 - l2 * l2 + D * D) / (2 * D), hh = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    let p = sub(hint, mul(dn, dot(hint, dn))); p = nrm(p);
    return { knee: add(add(a, mul(dn, x)), mul(p, hh)), end: t };
  }

  function pose(P) {
    const J = {};
    const arms = P.arms || 'walk', legs = P.legs || 'idle', af = P.af || 0, lf = P.lf || 0;
    const run = legs === 'run';
    const ph = (lf / 8) * Math.PI * 2;
    let pz = 0.93, lean = 0.03, A = 0, lift = 0.12;
    if (legs === 'walk') { A = 0.24; } else if (legs === 'run') { A = 0.4; lift = 0.2; lean = 0.2; } else if (legs === 'zwalk') { A = 0.17; lean = 0.13; lift = 0.07; } else if (legs === 'zrun') { A = 0.38; lean = 0.3; lift = 0.18; }
    const moving = legs !== 'idle' && legs !== 'crawl' && legs !== 'dead';
    // ---- vault: going over a window sill.
    // The sill on the wall art sits about 0.71 world units above the floor (glass starts 28 px up
    // a 92 px wall, ZU = 39.2 px per unit), and the character is roughly 1.63 units tall. So this
    // is not a jump - it is a hands-on-the-sill swing over something waist high, which is also
    // what the tiles allow: collision is per tile, there is no half height to stand on, so any
    // real ballistic arc would fight the world geometry. Instead the whole body is lifted and the
    // legs are tucked, and the renderer carries the lift.
    //
    // af runs 0..1 across the move. The body rises and falls on a single sine hump, the knees
    // come up and forward, the torso folds over the sill, and one hand is planted on it.
    let vaultLift = 0;
    if (legs === 'vault') {
      const t = U.clamp(af / 8, 0, 1);
      const arc = Math.sin(t * Math.PI);                  // 0 at both ends, 1 at the sill
      vaultLift = arc * VAULT_LIFT;
      pz += vaultLift;
      lean = 0.03 + arc * 0.42;                            // fold over the sill
    }
    const crouch = (P.crouch && legs !== 'dead' && legs !== 'crawl') ? 1 : 0;
    if (crouch) { pz -= 0.37; lean += 0.36; }
    if (moving) pz -= Math.abs(Math.sin(ph)) * 0.025 * (run ? 2 : 1);
    if (arms === 'zatk') lean += 0.1 + 0.12 * Math.sin(af / 4 * Math.PI);
    if (arms === 'swing') lean += 0.04;
    const pel = [0, 0, pz];
    const neck = [lean * 0.55, 0, pz + 0.5], head = [lean * 0.8 + (P.hx || 0), 0, pz + 0.7];
    J.pel = pel; J.neck = neck; J.head = head; J.lean = lean;
    J.shL = [lean * 0.45, -0.2, pz + 0.46]; J.shR = [lean * 0.45, 0.2, pz + 0.46];
    J.hipL = [0, -0.1, pz]; J.hipR = [0, 0.1, pz];
    let fL = [0, -0.1, 0], fR = [0, 0.1, 0];
    if (moving) {
      const sL = Math.sin(ph + Math.PI) * A, sR = Math.sin(ph) * A;
      fL = [sL, -0.1, Math.max(0, Math.cos(ph + Math.PI)) * lift * (legs === 'zwalk' && (P.limp ? 0.3 : 1))]; fR = [sR, 0.1, Math.max(0, Math.cos(ph)) * lift];
      if (P.limp && legs === 'zwalk') fL[0] *= 0.4;
    } else if (legs === 'idle') { fL = [0.03, -0.12, 0]; fR = [-0.03, 0.12, 0]; }
    // vault: both legs fold up and forward over the sill. The feet stay high through the middle
    // of the move and reach the floor again at the ends, so the body reads as clearing an edge
    // rather than stepping up onto something.
    if (legs === 'vault') {
      const t = U.clamp(af / 8, 0, 1), arc = Math.sin(t * Math.PI);
      // Feet keep some height for the whole move so the legs stay tucked under the body instead
      // of hanging straight down - hanging legs read as "standing on air", not as clearing an
      // edge. Both swing forward, the trailing leg higher, like stepping over a fence rail.
      const base = 0.05 + 0.30 * arc;
      fL = [0.20 + 0.22 * arc, -0.12, base];
      fR = [0.30 + 0.30 * arc, 0.12, base + 0.10 * arc];
    }
    // crouch: feet move slightly forward and keep their ground contact, so the knees bend
    if (crouch) { fL = [fL[0] * 0.55 + 0.17, fL[1] - 0.03, Math.max(fL[2], 0.02)]; fR = [fR[0] * 0.55 + 0.17, fR[1] + 0.03, Math.max(fR[2], 0.02)]; }
    let kL = ik(J.hipL, fL, 0.47, 0.47, [1, 0, 0.1]), kR = ik(J.hipR, fR, 0.47, 0.47, [1, 0, 0.1]);
    J.kneeL = kL.knee; J.footL = kL.end; J.kneeR = kR.knee; J.footR = kR.end;
    // arms
    const sh = 0.29, fa = 0.28;
    let hL, hR, hintL = [-0.4, -0.7, -0.3], hintR = [-0.4, 0.7, -0.3];
    const swing = moving ? A * 0.9 : 0;
    if (arms === 'walk') { hL = [Math.sin(ph) * swing, -0.26, pz + 0.04 + 0.12]; hR = [Math.sin(ph + Math.PI) * swing, 0.26, pz + 0.04 + 0.12]; hL[2] += 0.05; hR[2] += 0.05; }
    else if (arms === 'aim') { hR = [0.5, 0.12, pz + 0.46]; hL = [0.42, -0.04, pz + 0.43]; hintR = [0, 0.5, -0.5]; hintL = [0, -0.5, -0.5]; }
    else if (arms === 'light') { hR = [0.36, 0.2, pz + 0.37]; hL = [Math.sin(ph) * swing, -0.26, pz + 0.17]; hintR = [0, 0.6, -0.5]; }
    else if (arms === 'swing') {
      const t = af / 4; // 0 wind-up .. 1 follow through
      const wind = [-0.15, 0.3, pz + 0.85], hit = [0.55, 0.1, pz + 0.4], fin = [0.5, -0.25, pz + 0.12];
      let p; if (t < 0.4) p = lerp3([0.1, 0.25, pz + 0.3], wind, t / 0.4); else if (t < 0.7) p = lerp3(wind, hit, (t - 0.4) / 0.3); else p = lerp3(hit, fin, (t - 0.7) / 0.3);
      hR = p; hL = [p[0] * 0.8, p[1] * 0.4 - 0.06, p[2] - 0.08]; hintR = [0, 0.7, -0.2]; hintL = [0, -0.6, -0.3];
    }
    else if (arms === 'zreach') { const w = Math.sin(ph) * 0.05; hR = [0.58, 0.17, pz + 0.5 + w]; hL = [0.52, -0.17, pz + 0.43 - w]; hintR = [0, 0.4, -0.7]; hintL = [0, -0.4, -0.7]; }
    else if (arms === 'zatk') { const t = af / 3, s = Math.sin(t * Math.PI); hR = [0.5 + 0.2 * s, 0.14, pz + 0.55 - 0.3 * s]; hL = [0.5 + 0.2 * s, -0.14, pz + 0.5 - 0.3 * s]; hintR = [0, 0.4, -0.7]; hintL = [0, -0.4, -0.7]; }
    else if (arms === 'down') { hL = [0, -0.27, pz + 0.12]; hR = [0, 0.27, pz + 0.12]; }
    // vault: the right hand plants on the sill ahead of the body, the left swings back for
    // balance. Both follow the same arc, so the hands are already down when the hips come up.
    else if (arms === 'vault') {
      const t = U.clamp(af / 8, 0, 1), arc = Math.sin(t * Math.PI);
      // The planting hand reaches forward and DOWN onto the sill; the other swings back and up
      // for balance. At the peak the plant hand is at hip height ahead of the body, which is
      // where a sill at 0.71 units actually is relative to a pelvis at 0.93 + lift.
      hR = [0.42 + 0.16 * arc, 0.22, pz - 0.30 * arc];
      hL = [-0.20 - 0.22 * arc, -0.34, pz + 0.26 + 0.06 * arc];
      hintR = [0.6, 0.5, -0.3]; hintL = [-0.6, -0.5, -0.1];
    }
    else { hL = [0, -0.27, pz + 0.12]; hR = [0, 0.27, pz + 0.12]; }
    let eL = ik(J.shL, hL, sh, fa, hintL), eR = ik(J.shR, hR, sh, fa, hintR);
    J.elL = eL.knee; J.handL = eL.end; J.elR = eR.knee; J.handR = eR.end;

    // whole-body transforms for crawl / dead
    if (legs === 'dead' || legs === 'crawl') {
      const th = legs === 'dead' ? (Math.min(lf, 6) / 6) * (Math.PI / 2) * (P.face ? -1 : 1) : -Math.PI / 2;
      const c = Math.cos(th), s = Math.sin(th), lift2 = legs === 'dead' ? 0.12 : 0.17;
      const tf = p => [p[0] * c - p[2] * s, p[1], Math.max(0.07, p[0] * s + p[2] * c + (th !== 0 ? lift2 : 0))];
      for (const k of ['pel', 'neck', 'head', 'shL', 'shR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR', 'elL', 'elR', 'handL', 'handR']) J[k] = tf(J[k]);
      if (legs === 'crawl') {
        const w = Math.sin(ph) * 0.12;
        J.handR = [J.shR[0] + 0.5 + w, 0.3, 0.1]; J.handL = [J.shL[0] + 0.5 - w, -0.3, 0.1];
        J.elR = [J.shR[0] + 0.25, 0.32, 0.18]; J.elL = [J.shL[0] + 0.25, -0.32, 0.18];
        // Trail the legs behind the rotated hips instead of placing them at fixed world
        // coordinates: with the body lying forward the hips sit far along +x, so absolute
        // values here stretched each thigh to well over twice its real length.
        const hxL = J.hipL[0], hxR = J.hipR[0], sw = Math.sin(ph) * 0.06;
        J.kneeL = [hxL - 0.47, -0.12, 0.11]; J.kneeR = [hxR - 0.47, 0.12, 0.11];
        J.footL = [hxL - 0.90 + sw, -0.1, 0.08]; J.footR = [hxR - 0.90 - sw, 0.1, 0.08];
      } else if (lf >= 3) { // dead: sprawl arms
        const sp = Math.min(1, (lf - 2) / 4);
        J.handL = lerp3(J.handL, [J.shL[0] + 0.1, -0.55, 0.08], sp); J.handR = lerp3(J.handR, [J.shR[0] - 0.1, 0.55, 0.08], sp);
        J.elL = lerp3(J.elL, [J.shL[0], -0.38, 0.1], sp); J.elR = lerp3(J.elR, [J.shR[0], 0.38, 0.1], sp);
        J.kneeL = lerp3(J.kneeL, [J.kneeL[0], -0.2, 0.09], sp); J.footL = lerp3(J.footL, [J.footL[0], -0.28, 0.07], sp);
      }
    }
    return J;
  }

  // Depth of the lower-leg capsule the legwear actually draws, one value per leg.
  //
  // Parts are sorted by this depth, so a boot only wins against the shin it covers if its depth
  // is larger. Anchoring shoes to the ankle joint is not enough: shorts draw the bare shin as a
  // single capsule from the hem down to the ankle, and a capsule's depth is the average of its
  // ends - the hem sits high up the leg, so the average lands well in front of the ankle and the
  // shoe was drawn behind the very leg it should wrap. Full-length trousers end at the knee, so
  // their average is low and the shoe already sorted in front, which is why only shorts were
  // affected.
  function shinDepth(spec, J, pr) {
    const shorts = !spec.legsId || spec.legsId === 'shorts';
    const one = (hip, knee, foot) => {
      const top = shorts ? lerp3(hip, knee, 0.62) : knee;
      return (pr(top).d + pr(foot).d) / 2;
    };
    return { L: one(J.hipL, J.kneeL, J.footL), R: one(J.hipR, J.kneeR, J.footR) };
  }

  // legs: thighs + shins follow the LEGS_FIGS entry (shorts keep shins bare, trousers
  // cover them to the ankle); footwear drawn after from FOOTWEAR_FIGS
  function drawLegs(J, spec, cap, pr, skin, pants, shoes) {
    const legR = FOOTWEAR_FIGS[spec.feetId] ? 0.095 : 0.085;
    const lg = LEGS_FIGS[spec.legsId] || LEGS_FIGS.shorts;
    lg(J, cap, pr, skin, pants, legR);
    const fw = FOOTWEAR_FIGS[spec.feetId] || FOOTWEAR_FIGS.barefoot;
    fw(J, cap, pr, skin, shoes, shinDepth(spec, J, pr));
  }

  // torso: pelvis-to-neck capsule + shoulder line + shorts hip piece, plus the clothing
  // details selected from CLOTHING_FIGS by bodyId (default: plain undershirt, no extras)
  function drawTorso(J, spec, cap, skin, pants, shirt) {
    cap(J.pel, J.neck, 0.155, shirt, { torso: true });
    cap(J.shL, J.shR, 0.075, shirt);
    cap(J.pel, [J.pel[0], J.pel[1], J.pel[2] - 0.05], 0.15, pants);
    const cf = CLOTHING_FIGS[spec.bodyId];
    if (cf) cf(J, cap, shirt);
  }

  // arms: upper arm + forearm with IK elbow, sleeve or bare skin
  function drawArms(J, spec, cap, rb, skin, shirt) {
    const sleeve = spec.sleeve || shirt;
    cap(J.shL, J.elL, rb + 0.008, sleeve); cap(J.elL, J.handL, rb, spec.glove || skin);
    cap(J.shR, J.elR, rb + 0.008, sleeve); cap(J.elR, J.handR, rb, spec.glove || skin);
  }

  // bag: distinct shapes per bag type, drawn behind the torso with visible straps
  function drawBag(J, spec, cap) {
    if (!spec.bag) return;
    const big = spec.bagId === 'bigpack', small = spec.bagId === 'fannypack';
    const bk = [J.pel[0] - (small ? 0.1 : 0.22), 0, small ? (J.pel[2] + 0.14) : (J.pel[2] + J.neck[2]) / 2 + 0.02];
    if (small) {
      // fanny pack: small pouch on the lower back / hip
      cap([bk[0], -0.08, bk[2] - 0.05], [bk[0], 0.08, bk[2] + 0.05], 0.085, spec.bag, { bag: true });
    } else {
      // main body: bigpack is taller and thicker, backpack is one rounded block
      cap([bk[0], -0.11, bk[2] - (big ? 0.17 : 0.13)], [bk[0], 0.11, bk[2] + (big ? 0.17 : 0.13)], big ? 0.14 : 0.12, spec.bag, { bag: true });
      if (big) cap([bk[0] - 0.07, -0.08, bk[2] + 0.2], [bk[0] - 0.07, 0.08, bk[2] + 0.28], 0.06, spec.bag); // rolled top / lid
      // shoulder straps over both shoulders (visible from the front)
      const stc = spec.bag.map(v => v * 0.6);
      cap(J.shL, [J.pel[0] - 0.02, J.shL[1], J.pel[2] + 0.02], 0.032, stc);
      cap(J.shR, [J.pel[0] - 0.02, J.shR[1], J.pel[2] + 0.02], 0.032, stc);
      if (!big) cap([bk[0] + 0.06, -0.06, bk[2] + 0.1], [bk[0] + 0.06, 0.06, bk[2] - 0.06], 0.03, stc); // side pocket seam
    }
  }

  // vest layer: drawn after the torso and arms so it overlays the BODY clothing; the
  // shirt remains visible on the sides, lower hem and arms wherever the vest does not cover
  function drawVest(J, spec, cap) {
    if (!spec.vestId) return;
    const vf = VEST_FIGS[spec.vestId];
    if (vf) vf(J, cap, spec.shirt, spec.vestCol || spec.shirt);
  }

  // ----- equipment definition tables: each entry is a draw function anchored to the
  // body joints. Adding new clothing / headwear / footwear = a new table entry, no
  // changes to the render pipeline. All shapes are kept in the capsule style.
  const CLOTHING_FIGS = {
    // plain t-shirt: no extra layers, the torso capsule is the shirt
    tshirt: null,
    // jacket: open front line + folded collar
    jacket: (J, cap, shirt) => {
      cap([J.pel[0] + 0.02, 0, J.pel[2] + 0.06], [J.neck[0], 0, J.neck[2] - 0.08], 0.165, shirt, { hem: true }); // open front line
      cap([J.neck[0] - 0.02, -0.07, J.neck[2] - 0.02], [J.neck[0] - 0.02, 0.07, J.neck[2] - 0.02], 0.06, shirt); // folded collar
    },
    // hoodie: hood bump behind the neck + drawstring
    hoodie: (J, cap, shirt) => {
      cap([J.neck[0] - 0.01, 0, J.neck[2] - 0.01], [J.neck[0] + 0.1, 0, J.neck[2] - 0.14], 0.09, shirt); // hood bump behind the neck
      cap([J.pel[0] + 0.04, 0, J.pel[2] + 0.05], [J.pel[0] + 0.04, 0, J.pel[2] + 0.18], 0.03, shirt); // drawstring
    },
    // flannel shirt: open collar + a plaid grid (dark bands) on the chest front
    flannel: (J, cap, shirt) => {
      const dk = [shirt[0] * 0.55, shirt[1] * 0.55, shirt[2] * 0.55];
      cap([J.neck[0] - 0.02, -0.07, J.neck[2] - 0.02], [J.neck[0] - 0.02, 0.07, J.neck[2] - 0.02], 0.055, shirt); // collar
      const xf = J.pel[0] + 0.155;
      for (const t of [0.28, 0.52, 0.76]) { const z = J.pel[2] + (J.neck[2] - J.pel[2]) * t; cap([xf, -0.11, z], [xf, 0.11, z], 0.014, dk); } // horizontal plaid
      cap([xf, -0.06, J.pel[2] + 0.06], [xf, -0.06, J.neck[2] - 0.06], 0.014, dk); // vertical plaid
      cap([xf, 0.06, J.pel[2] + 0.06], [xf, 0.06, J.neck[2] - 0.06], 0.014, dk);
    },
    // wool sweater: chunky rolled collar + knit ridges + ribbed hem
    sweater: (J, cap, shirt) => {
      const lt = [shirt[0] * 1.2, shirt[1] * 1.2, shirt[2] * 1.2];
      cap([J.neck[0] - 0.01, -0.085, J.neck[2] - 0.04], [J.neck[0] - 0.01, 0.085, J.neck[2] - 0.04], 0.07, lt); // rolled collar
      const xf = J.pel[0] + 0.15;
      for (const t of [0.22, 0.42, 0.62, 0.82]) { const z = J.pel[2] + (J.neck[2] - J.pel[2]) * t; cap([xf, -0.1, z], [xf, 0.1, z], 0.012, lt); } // knit ridges
      cap([J.pel[0] - 0.02, -0.15, J.pel[2] + 0.1], [J.pel[0] + 0.15, -0.15, J.pel[2] + 0.1], 0.032, lt); // ribbed hem
      cap([J.pel[0] - 0.02, 0.15, J.pel[2] + 0.1], [J.pel[0] + 0.15, 0.15, J.pel[2] + 0.1], 0.032, lt);
    },
    // leather jacket: open front + zip line + two zip chest pockets (shiny)
    leather: (J, cap, shirt) => {
      const hi = [Math.min(255, shirt[0] * 1.7 + 30), Math.min(255, shirt[1] * 1.7 + 30), Math.min(255, shirt[2] * 1.7 + 30)];
      cap([J.pel[0] + 0.03, 0, J.pel[2] + 0.06], [J.neck[0], 0, J.neck[2] - 0.08], 0.16, shirt, { hem: true }); // open front
      cap([J.neck[0] - 0.02, -0.075, J.neck[2] - 0.02], [J.neck[0] - 0.02, 0.075, J.neck[2] - 0.02], 0.06, shirt); // collar
      const xf = J.pel[0] + 0.155;
      cap([xf, 0, J.pel[2] + 0.09], [xf, 0, J.neck[2] - 0.1], 0.012, hi); // zipper
      cap([xf, -0.09, J.pel[2] + 0.2], [xf, -0.09, J.pel[2] + 0.3], 0.014, hi); // chest pockets
      cap([xf, 0.09, J.pel[2] + 0.2], [xf, 0.09, J.pel[2] + 0.3], 0.014, hi);
    },
    // padded jacket: chest plate + shoulder pads + quilting lines (armoured look)
    padded: (J, cap, shirt) => {
      const dk = [shirt[0] * 0.7, shirt[1] * 0.7, shirt[2] * 0.7];
      cap([J.pel[0] + 0.05, 0, J.pel[2] + 0.1], [J.neck[0] + 0.02, 0, J.neck[2] - 0.1], 0.14, shirt, { plate: true }); // chest plate
      cap([J.shL[0] + 0.02, -0.2, J.shL[2] + 0.01], [J.shL[0] + 0.02, -0.02, J.shL[2] + 0.01], 0.085, shirt); // shoulder pads
      cap([J.shR[0] + 0.02, 0.2, J.shR[2] + 0.01], [J.shR[0] + 0.02, 0.02, J.shR[2] + 0.01], 0.085, shirt);
      const xf = J.pel[0] + 0.19;
      for (const t of [0.25, 0.5, 0.75]) { const z = J.pel[2] + (J.neck[2] - J.pel[2]) * t; cap([xf, -0.1, z], [xf, 0.1, z], 0.011, dk); } // quilting
    },
    // rain coat: oilskin slicker - high storm collar, smooth waterproof sheen, long hem and
    // a front placket. Kept visually distinct from the winter coat (no fur) and from the
    // leather jacket (no zip, brighter and thicker).
    raincoat: (J, cap, shirt) => {
      const lt = [Math.min(255, shirt[0] * 1.35 + 18), Math.min(255, shirt[1] * 1.35 + 18), Math.min(255, shirt[2] * 1.35 + 18)];
      const dk = [shirt[0] * 0.55, shirt[1] * 0.55, shirt[2] * 0.55];
      const xf = J.pel[0] + 0.15;
      cap([J.neck[0] - 0.01, -0.1, J.neck[2] + 0.01], [J.neck[0] - 0.01, 0.1, J.neck[2] + 0.01], 0.095, lt); // storm collar
      cap([xf, 0, J.pel[2] + 0.07], [xf, 0, J.neck[2] - 0.1], 0.02, dk);                                    // front placket
      for (const t of [0.3, 0.62]) { const z = J.pel[2] + (J.neck[2] - J.pel[2]) * t; cap([xf - 0.01, -0.06, z], [xf - 0.01, 0.06, z], 0.016, dk); } // pocket flaps
      cap([J.pel[0] + 0.02, -0.15, J.pel[2] + 0.02], [J.pel[0] + 0.02, 0.15, J.pel[2] + 0.02], 0.155, shirt);  // long hem
      cap([J.pel[0] + 0.02, -0.14, J.pel[2] - 0.12], [J.pel[0] + 0.02, 0.14, J.pel[2] - 0.12], 0.13, shirt);   // skirt past the hips
    },
    // winter coat: wide fur collar + double-breasted front + long hem over the hips
    wintercoat: (J, cap, shirt) => {
      const fur = [Math.min(255, shirt[0] * 1.4 + 40), Math.min(255, shirt[1] * 1.4 + 40), Math.min(255, shirt[2] * 1.4 + 40)];
      const dk = [shirt[0] * 0.5, shirt[1] * 0.5, shirt[2] * 0.5];
      cap([J.neck[0] - 0.02, -0.13, J.neck[2] - 0.02], [J.neck[0] - 0.02, 0.13, J.neck[2] - 0.02], 0.105, fur); // fur collar
      cap([J.pel[0] + 0.03, 0, J.pel[2] + 0.08], [J.neck[0], 0, J.neck[2] - 0.08], 0.16, shirt, { hem: true }); // open front
      const xf = J.pel[0] + 0.15;
      cap([xf, -0.07, J.pel[2] + 0.1], [xf, -0.07, J.neck[2] - 0.1], 0.013, dk); // button line
      cap([J.pel[0] + 0.02, -0.15, J.pel[2] + 0.02], [J.pel[0] + 0.02, 0.15, J.pel[2] + 0.02], 0.155, shirt); // long hem
      cap([J.pel[0] + 0.02, -0.14, J.pel[2] - 0.09], [J.pel[0] + 0.02, 0.14, J.pel[2] - 0.09], 0.135, shirt); // hem skirt
    }
  };

  // vest layer: drawn AFTER the body clothing so it overlays it; the underlying BODY
  // item stays visible wherever the vest does not cover (sides, lower hem, arms)
  // entries receive (J, cap, shirt, vestCol)
  const VEST_FIGS = {
    vest: (J, cap, shirt, vc) => {
      cap([J.neck[0] + 0.02, 0, J.neck[2] - 0.02], [J.pel[0] + 0.02, 0, J.pel[2] + 0.1], 0.115, vc, { plate: true });
      cap([J.shL[0], -0.13, J.shL[2] - 0.02], [J.shR[0], 0.13, J.shR[2] - 0.02], 0.055, vc); // shoulder yoke
      cap([J.pel[0] + 0.03, -0.1, J.pel[2] + 0.02], [J.pel[0] + 0.03, 0.1, J.pel[2] + 0.02], 0.045, vc); // belt pouches
    }
  };

  // headwear drawn inside drawHead(): dome + extras per item, all relative to the head
  // joint (hp) and head radius (hr). entries receive (x, spec, hp, ht, hr, rgb, pr, J)
  const HEADWEAR_FIGS = {
    // helmet: full dome covering the head down to the ears + rim + chin strap
    helmet: (x, spec, hp, ht, hr, rgb, pr, J) => {
      x.fillStyle = rgb(spec.hat, 0.85); x.beginPath(); x.arc(hp.x, hp.y - 1, hr * 1.06, Math.PI * 0.95, Math.PI * 2.06); x.lineTo(ht.x + hr * 1.06, hp.y + hr * 0.42); x.closePath(); x.fill();
      x.strokeStyle = rgb(spec.hat, 0.55); x.lineWidth = 2.2; x.beginPath(); x.arc(hp.x, hp.y - 1, hr * 1.02, Math.PI * 0.98, Math.PI * 2.02); x.stroke();
      x.strokeStyle = 'rgba(30,30,30,0.55)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(hp.x - hr * 0.75, hp.y + hr * 0.45); x.lineTo(hp.x - hr * 0.55, hp.y + hr * 0.95); x.stroke();
    },
    // cap: flat dome + front brim + top button
    cap: (x, spec, hp, ht, hr, rgb, pr, J) => {
      x.fillStyle = rgb(spec.hat, 1); x.beginPath(); x.arc(ht.x, ht.y - 1.2, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98); x.lineTo(ht.x + hr, ht.y); x.fill();
      const br = pr([J.head[0] + 0.17, J.head[1], J.head[2] + 0.045]);
      x.strokeStyle = rgb(spec.hat, 0.8); x.lineWidth = 3.4; x.lineCap = 'round'; x.beginPath(); x.moveTo(ht.x + hr * 0.55, ht.y - 1.5); x.lineTo(br.x, br.y); x.stroke();
      x.fillStyle = rgb(spec.hat, 1.25); x.beginPath(); x.arc(ht.x, ht.y - hr * 0.98, 1.6, 0, 7); x.fill();
    }
  };

  // legs clothing: each entry draws the legs from the real hip/knee/foot joints.
  // shorts keep the shins bare; trousers/cargo cover them to the ankle; cargo adds
  // visible side pockets. entries receive (J, cap, pr, skin, col)
  const LEGS_FIGS = {
    // shorts: light beige/khaki, thigh-length with a rolled cuff; shins and feet stay bare skin
    shorts: (J, cap, pr, skin, col, legR) => {
      const hemL = lerp3(J.hipL, J.kneeL, 0.62), hemR = lerp3(J.hipR, J.kneeR, 0.62);
      cap(J.hipL, hemL, legR * 1.08, col); cap(J.hipR, hemR, legR * 1.08, col);
      // rolled cuff: a slightly lighter, wider band at the hem
      const cuff = [col[0] * 1.12, col[1] * 1.12, col[2] * 1.12];
      cap(lerp3(J.hipL, J.kneeL, 0.55), hemL, legR * 1.16, cuff);
      cap(lerp3(J.hipR, J.kneeR, 0.55), hemR, legR * 1.16, cuff);
      // bare skin shins
      cap(hemL, J.footL, 0.068, skin); cap(hemR, J.footR, 0.068, skin);
    },
    // trousers: grey, slim tapered legs to the ankle with a pressed centre crease
    trousers: (J, cap, pr, skin, col, legR) => {
      cap(J.hipL, J.kneeL, legR * 0.94, col); cap(J.kneeL, J.footL, 0.066, col);
      cap(J.hipR, J.kneeR, legR * 0.94, col); cap(J.kneeR, J.footR, 0.066, col);
      // pressed crease: a thin light line down the front of each leg, both segments.
      // depth stays below footwear (boot shaft is +0.03) so boots cover the shin part
      const crease = [col[0] * 1.18, col[1] * 1.18, col[2] * 1.18];
      cap(J.hipL, J.kneeL, 0.012, crease, { d: (pr(J.hipL).d + pr(J.kneeL).d) / 2 + 0.012 });
      cap(J.kneeL, J.footL, 0.012, crease, { d: (pr(J.kneeL).d + pr(J.footL).d) / 2 + 0.012 });
      cap(J.hipR, J.kneeR, 0.012, crease, { d: (pr(J.hipR).d + pr(J.kneeR).d) / 2 + 0.012 });
      cap(J.kneeR, J.footR, 0.012, crease, { d: (pr(J.kneeR).d + pr(J.footR).d) / 2 + 0.012 });
    },
    // jeans: denim blue, baggy thick legs to the ankle with a rolled cuff
    jeans: (J, cap, pr, skin, col, legR) => {
      cap(J.hipL, J.kneeL, legR * 1.12, col); cap(J.kneeL, J.footL, 0.085, col);
      cap(J.hipR, J.kneeR, legR * 1.12, col); cap(J.kneeR, J.footR, 0.085, col);
      // cuff: a darker rolled band just above the ankle
      const cuff = [col[0] * 0.82, col[1] * 0.82, col[2] * 0.82];
      cap(lerp3(J.kneeL, J.footL, 0.82), J.footL, 0.093, cuff);
      cap(lerp3(J.kneeR, J.footR, 0.82), J.footR, 0.093, cuff);
      // front fly seam
      cap(J.hipL, lerp3(J.hipL, J.kneeL, 0.3), 0.012, [col[0] * 1.35 + 25, col[1] * 1.35 + 25, col[2] * 1.35 + 25], { d: pr(J.hipL).d + 0.04 });
    },
    // tracksuit pants: full-length, slimmer with a light side stripe that follows each leg bone
    tracksuit: (J, cap, pr, skin, col, legR) => {
      cap(J.hipL, J.kneeL, legR * 0.92, col); cap(J.kneeL, J.footL, 0.065, col);
      cap(J.hipR, J.kneeR, legR * 0.92, col); cap(J.kneeR, J.footR, 0.065, col);
      const lite = [col[0] * 1.5 + 40, col[1] * 1.5 + 40, col[2] * 1.5 + 40];
      // stripe drawn per bone segment so it bends with the knee and keeps correct depth.
      // depth stays below footwear (boot shaft is +0.03) so boots cover the shin part
      cap(J.hipL, J.kneeL, 0.018, lite, { d: (pr(J.hipL).d + pr(J.kneeL).d) / 2 + 0.012 });
      cap(J.kneeL, J.footL, 0.018, lite, { d: (pr(J.kneeL).d + pr(J.footL).d) / 2 + 0.012 });
      cap(J.hipR, J.kneeR, 0.018, lite, { d: (pr(J.hipR).d + pr(J.kneeR).d) / 2 + 0.012 });
      cap(J.kneeR, J.footR, 0.018, lite, { d: (pr(J.kneeR).d + pr(J.footR).d) / 2 + 0.012 });
    },
    // cargo pants: full-length + pocket patches on both thighs
    cargopants: (J, cap, pr, skin, col, legR) => {
      cap(J.hipL, J.kneeL, legR, col); cap(J.kneeL, J.footL, 0.075, col);
      cap(J.hipR, J.kneeR, legR, col); cap(J.kneeR, J.footR, 0.075, col);
      const dk = col.map(v => v * 0.75);
      const pL = lerp3(J.hipL, J.kneeL, 0.45), pR = lerp3(J.hipR, J.kneeR, 0.45);
      cap([pL[0] + 0.02, pL[1] - 0.06, pL[2]], [pL[0] + 0.02, pL[1] - 0.06, pL[2] - 0.14], 0.045, dk);
      cap([pR[0] + 0.02, pR[1] + 0.06, pR[2]], [pR[0] + 0.02, pR[1] + 0.06, pR[2] - 0.14], 0.045, dk);
    }
  };
  // footwear: shaft / laces / foot / heel / sole per item; barefoot is the default
  // entry (skin-toned feet). entries receive (J, cap, pr, skin, shoes, shin)
  //
  // shin carries the depth of the lower-leg capsule each leg already drew. Anything that must
  // wrap the ankle has to sort in front of that value rather than in front of the raw joint,
  // or it is painted behind the shin on shorts, where the shin capsule reaches far up the leg.
  const FOOTWEAR_FIGS = {
    barefoot: (J, cap, pr, skin, shoes) => {
      cap([J.footL[0] - 0.02, J.footL[1], J.footL[2] + 0.04], [J.footL[0] + 0.15, J.footL[1], J.footL[2] + 0.04], 0.055, skin);
      cap([J.footR[0] - 0.02, J.footR[1], J.footR[2] + 0.04], [J.footR[0] + 0.15, J.footR[1], J.footR[2] + 0.04], 0.055, skin);
    },
    // sneakers: low shoe over the foot + light-coloured sole strip, slimmer than boots
    sneakers: (J, cap, pr, skin, shoes, shin) => {
      [[J.footL, shin && shin.L], [J.footR, shin && shin.R]].forEach(([ft, sd]) => {
        const d = Math.max(pr(ft).d, sd || -Infinity) + 0.03;
        cap([ft[0] - 0.05, ft[1], ft[2] + 0.035], [ft[0] + 0.16, ft[1], ft[2] + 0.035], 0.052, shoes, { d });
        cap([ft[0] - 0.05, ft[1], ft[2] + 0.006], [ft[0] + 0.16, ft[1], ft[2] + 0.006], 0.045, [shoes[0] * 1.35, shoes[1] * 1.35, shoes[2] * 1.35], { sole: true, d: d + 0.005 });
      });
    },
    // running shoes: slimmer low profile with a white stripe, lighter colour
    runners: (J, cap, pr, skin, shoes, shin) => {
      [[J.footL, shin && shin.L], [J.footR, shin && shin.R]].forEach(([ft, sd]) => {
        const d = Math.max(pr(ft).d, sd || -Infinity) + 0.03;
        cap([ft[0] - 0.04, ft[1], ft[2] + 0.035], [ft[0] + 0.17, ft[1], ft[2] + 0.035], 0.046, shoes, { d });
        cap([ft[0] - 0.04, ft[1], ft[2] + 0.005], [ft[0] + 0.17, ft[1], ft[2] + 0.005], 0.042, [255, 255, 255], { sole: true, d: d + 0.005 }); // white sole
      });
    },
    // boots: shaft + laces + foot + heel + dark sole, both legs
    boots: (J, cap, pr, skin, shoes, shin) => {
      [[J.kneeL, J.footL, shin && shin.L], [J.kneeR, J.footR, shin && shin.R]].forEach(([kne, ft, sd]) => {
        // A shoe wraps the ankle, so it has to be in front of whatever the leg drew there. The
        // shin depth already accounts for how far up the leg that capsule reaches, which is the
        // whole difference between shorts and trousers.
        const front = Math.max(pr(ft).d, sd || -Infinity) + 0.03;
        // shaft: one piece from just below the knee to the ankle, drawn IN FRONT of the
        // bare shin so the leg tucks into the boot and no skin shows through
        const t0 = lerp3(kne, ft, 0.02), t1 = ft;
        cap([t0[0], t0[1], t0[2] + 0.01], [t1[0], t1[1], t1[2] + 0.015], 0.079, shoes, { d: front });
        // laces: cross stitches down the front of the shaft
        const l0 = lerp3(kne, ft, 0.3), l1 = lerp3(kne, ft, 0.08);
        cap([l0[0], l0[1], l0[2] + 0.012], [l1[0], l1[1], l1[2] + 0.012], 0.026, shoes, { lace: true, d: front + 0.01 });
        // foot: ankle to toe box as one piece, plus a heel block behind
        cap([ft[0] - 0.07, ft[1], ft[2] + 0.03], [ft[0] + 0.17, ft[1], ft[2] + 0.03], 0.058, shoes, { d: front });
        cap([ft[0] - 0.075, ft[1], ft[2] + 0.02], [ft[0] - 0.03, ft[1], ft[2] + 0.055], 0.048, [shoes[0] * 0.85, shoes[1] * 0.85, shoes[2] * 0.85], { d: front });
        // dark sole line under the whole foot
        cap([ft[0] - 0.07, ft[1], ft[2] + 0.004], [ft[0] + 0.17, ft[1], ft[2] + 0.004], 0.042, shoes, { sole: true, d: front + 0.01 });
      });
    }
  };

  const poseCache = new Map();
  function cachedPose(P) {
        const key = (P.arms || 'walk') + '|' + (P.af || 0) + '|' + (P.legs || 'idle') + '|' + (P.lf || 0) + '|' + !!P.limp + '|' + !!P.face + '|' + (P.hx || 0) + '|' + !!P.crouch;
    let J = poseCache.get(key);
    if (!J) {
      J = pose(P); poseCache.set(key, J);
      if (poseCache.size > 256) poseCache.delete(poseCache.keys().next().value);
    }
    return J;
  }
  function render(spec, ang, P) {
    const J = cachedPose(P);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const pr = p => { const wx = p[0] * ca - p[1] * sa, wy = p[0] * sa + p[1] * ca; return { x: (wx - wy) * 32, y: (wx + wy) * 16 - p[2] * ZU, d: wx * VX + wy * VY + p[2] * VZ }; };
    const parts = [];
    const cap = (a, b, r, col, extra) => { const pa = pr(a), pb = pr(b); parts.push(Object.assign({ pa, pb, w: r * 2 * SC, col, d: (pa.d + pb.d) / 2 }, extra || {})); };
    const skin = spec.skin, shirt = spec.shirt, pants = spec.pants, shoes = spec.shoes || [30, 28, 28];
    const rb = spec.armR || 0.062;
    drawLegs(J, spec, cap, pr, skin, pants, shoes);
    drawTorso(J, spec, cap, skin, pants, shirt);
    drawArms(J, spec, cap, rb, skin, shirt);
    drawVest(J, spec, cap);
    cap(J.neck, J.head, 0.05, skin);
    drawBag(J, spec, cap);
    parts.sort((a, b) => a.d - b.d);
    // head drawn in depth order too
    const hp = pr(J.head), hr = 0.125 * SC;
    // bounds
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of parts) for (const q of [p.pa, p.pb]) { x0 = Math.min(x0, q.x - p.w / 2); x1 = Math.max(x1, q.x + p.w / 2); y0 = Math.min(y0, q.y - p.w / 2); y1 = Math.max(y1, q.y + p.w / 2); }
    x0 = Math.min(x0, hp.x - hr - 3); x1 = Math.max(x1, hp.x + hr + 3); y0 = Math.min(y0, hp.y - hr - 4); y1 = Math.max(y1, hp.y + hr + 3);
    const pad = 6, w = Math.ceil(x1 - x0) + pad * 2, h = Math.ceil(y1 - y0) + pad * 2;
    const [c, x] = U.canvas2d(w, h);
    const ox = pad - x0, oy = pad - y0;
    x.translate(ox, oy); x.lineCap = 'round'; x.lineJoin = 'round';
    const rgb = (col, k) => 'rgb(' + Math.min(255, col[0] * k | 0) + ',' + Math.min(255, col[1] * k | 0) + ',' + Math.min(255, col[2] * k | 0) + ')';
    const drawHead = () => {
      const fwdW = [ca, sa], fv = (fwdW[0] * VX + fwdW[1] * VY); // >0 → face toward camera
      x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.arc(hp.x, hp.y, hr + 1, 0, 7); x.fill();
      const g = x.createRadialGradient(hp.x - hr * 0.35, hp.y - hr * 0.4, hr * 0.1, hp.x, hp.y, hr);
      g.addColorStop(0, rgb(skin, 1.25)); g.addColorStop(1, rgb(skin, 0.72)); x.fillStyle = g; x.beginPath(); x.arc(hp.x, hp.y, hr, 0, 7); x.fill();
      // hair covers back / top of head
      const hs = pr([J.head[0] - 0.045, J.head[1], J.head[2] + 0.035]);
      const hairShift = pr([J.head[0] - 0.05 * 1.6, J.head[1], J.head[2] + 0.03]);
      if (!spec.bald) {
        x.fillStyle = rgb(spec.hair, 1); x.beginPath();
        x.arc(hs.x, hs.y - 0.5, hr * 0.98, 0, 7); x.fill();
        // clip hair off the face when the face is toward the camera
        if (fv > 0.02) {
          const fx = pr([J.head[0] + 0.08, J.head[1], J.head[2] - 0.04]);
          x.save(); x.beginPath(); x.arc(hp.x, hp.y, hr, 0, 7); x.clip();
          const g2 = x.createRadialGradient(fx.x, fx.y + 1, 1, fx.x, fx.y + 1, hr * 0.78);
          g2.addColorStop(0, rgb(skin, 1.12)); g2.addColorStop(0.8, rgb(skin, 0.95)); g2.addColorStop(1, rgb(skin, 0));
          x.globalAlpha = Math.min(1, fv * 2.2); x.fillStyle = g2; x.beginPath(); x.arc(fx.x, fx.y + 1, hr * 0.8, 0, 7); x.fill(); x.globalAlpha = 1;
          // eyes
          const e1 = pr([J.head[0] + 0.115, J.head[1] - 0.045, J.head[2] + 0.01]), e2 = pr([J.head[0] + 0.115, J.head[1] + 0.045, J.head[2] + 0.01]);
          x.fillStyle = spec.eye || 'rgba(14,10,10,0.9)'; x.globalAlpha = Math.min(1, fv * 2.5);
          x.fillRect(e1.x - 0.9, e1.y - 0.7, 1.8, 1.6); x.fillRect(e2.x - 0.9, e2.y - 0.7, 1.8, 1.6); x.globalAlpha = 1;
          x.restore();
        }
      } else if (fv > 0.02) {
        const e1 = pr([J.head[0] + 0.115, J.head[1] - 0.045, J.head[2] + 0.01]), e2 = pr([J.head[0] + 0.115, J.head[1] + 0.045, J.head[2] + 0.01]);
        x.fillStyle = spec.eye || 'rgba(14,10,10,0.9)'; x.globalAlpha = Math.min(1, fv * 2.5); x.fillRect(e1.x - 0.9, e1.y - 0.7, 1.8, 1.6); x.fillRect(e2.x - 0.9, e2.y - 0.7, 1.8, 1.6); x.globalAlpha = 1;
      }
      if (spec.hat) { // headwear from HEADWEAR_FIGS: cap dome + brim, helmet dome + rim
        const ht = pr([J.head[0] + 0.01, J.head[1], J.head[2] + 0.06]);
        const hw = HEADWEAR_FIGS[spec.headId];
        if (hw) hw(x, spec, hp, ht, hr, rgb, pr, J);
        x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.arc(ht.x - 1.5, ht.y - 3, hr * 0.6, Math.PI * 1.1, Math.PI * 1.7); x.stroke();
      }
      x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 0.8; x.beginPath(); x.arc(hp.x, hp.y, hr, 0, 7); x.stroke();
    };
    let headDone = false; const hd = pr(J.head).d;
    for (const p of parts) {
      if (!headDone && p.d > hd + 0.0) { drawHead(); headDone = true; }
      const col = p.col;
      x.lineWidth = p.w + 1.6; x.strokeStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.moveTo(p.pa.x, p.pa.y); x.lineTo(p.pb.x, p.pb.y); x.stroke();
      x.lineWidth = p.w; x.strokeStyle = rgb(col, 0.82); x.beginPath(); x.moveTo(p.pa.x, p.pa.y); x.lineTo(p.pb.x, p.pb.y); x.stroke();
      x.lineWidth = p.w * 0.62; x.strokeStyle = rgb(col, 1.08); x.beginPath(); x.moveTo(p.pa.x - p.w * 0.1, p.pa.y - p.w * 0.12); x.lineTo(p.pb.x - p.w * 0.1, p.pb.y - p.w * 0.12); x.stroke();
      x.lineWidth = p.w * 0.22; x.strokeStyle = 'rgba(255,255,255,0.14)'; x.beginPath(); x.moveTo(p.pa.x - p.w * 0.22, p.pa.y - p.w * 0.2); x.lineTo(p.pb.x - p.w * 0.22, p.pb.y - p.w * 0.2); x.stroke();
      if (p.lace) { // boot laces: short cross stitches along the shaft
        x.strokeStyle = 'rgba(20,16,12,0.6)'; x.lineWidth = Math.max(0.8, p.w * 0.28);
        const dx2 = p.pb.x - p.pa.x, dy2 = p.pb.y - p.pa.y, n = 4;
        for (let i = 1; i < n; i++) {
          const lx = p.pa.x + dx2 * (i / n), ly = p.pa.y + dy2 * (i / n);
          x.beginPath(); x.moveTo(lx - p.w * 0.3, ly - p.w * 0.18); x.lineTo(lx + p.w * 0.3, ly + p.w * 0.18); x.stroke();
        }
      }
      if (p.sole) { // boot sole: solid dark strip under the foot
        x.strokeStyle = 'rgba(18,14,10,0.85)'; x.lineWidth = p.w * 0.7;
        x.beginPath(); x.moveTo(p.pa.x, p.pa.y + p.w * 0.25); x.lineTo(p.pb.x, p.pb.y + p.w * 0.25); x.stroke();
      }
      if (p.torso && spec.blood) { // gore on torso
        const r = U.mulberry32(spec.seed | 0);
        for (let i = 0; i < spec.blood; i++) { const t = r(), bx = p.pa.x + (p.pb.x - p.pa.x) * t + (r() - 0.5) * p.w * 0.7, by = p.pa.y + (p.pb.y - p.pa.y) * t + (r() - 0.5) * p.w * 0.3; x.fillStyle = 'rgba(' + (96 + r() * 40 | 0) + ',8,8,' + (0.5 + r() * 0.4) + ')'; x.beginPath(); x.ellipse(bx, by, 1 + r() * 3.2, 1 + r() * 2.2, r() * 3, 0, 7); x.fill(); }
      }
    }
    if (!headDone) drawHead();
    const ha = pr(J.handR), hb = pr(J.handL);
    return { c, ox, oy, hand: [ha.x, ha.y], hand2: [hb.x, hb.y], head: [hp.x, hp.y] };
  }

  const cache = new Map();
  let lastSprites = new WeakMap();
  const specKeys = new Map(), MAX_PIXELS = 16 * 1024 * 1024;
  let cachePixels = 0;
  function dropCached(key, entry) {
    cache.delete(key); cachePixels -= entry.pixels;
    const keys = specKeys.get(entry.id);
    if (keys) { keys.delete(key); if (!keys.size) specKeys.delete(entry.id); }
  }
  Fig.forget = function (spec) {
    lastSprites.delete(spec);
    const keys = specKeys.get(spec.id); if (!keys) return;
    for (const key of keys) dropCached(key, cache.get(key));
  };
  Fig.clearCache = function () { cache.clear(); specKeys.clear(); poseCache.clear(); lastSprites = new WeakMap(); cachePixels = 0; };
  DSZ.on('newgame', Fig.clearCache);
  Fig.get = function (spec, ang, P) {
    const n = Fig.NANG, ai = ((Math.round(ang / (Math.PI * 2) * n) % n) + n) % n;
    const arms = P.arms || 'walk', af = P.af | 0, legs = P.legs || 'idle', lf = P.lf | 0, limp = !!P.limp, face = !!P.face, hx = !!P.hx, crouch = !!P.crouch;
    // vault progress is part of the pose, so it has to be part of the cache identity too. It is
    // quantised to eight steps: that is enough for a 0.45 s move to read as smooth at this size,
    // and it keeps the sprite cache from growing by one entry per frame.
    const vq = legs === 'vault' ? Math.round(U.clamp((P.af || 0) / 8, 0, 1) * 8) : -1;
    let last = lastSprites.get(spec);
    if (last && last.id === spec.id && last.n === n && last.ai === ai && last.arms === arms && last.af === af && last.legs === legs && last.lf === lf && last.limp === limp && last.face === face && last.hx === hx && last.crouch === crouch && last.vq === vq) return last.sprite;
    const key = spec.id + '|' + ai + '|' + (P.arms || 'walk') + (P.af | 0) + '|' + (P.legs || 'idle') + (P.lf | 0) + (P.limp ? 'l' : '') + (P.face ? 'f' : '') + (P.hx ? 'h' : '') + (P.crouch ? 'c' : '') + (vq >= 0 ? 'v' + vq : '');
    const entry = cache.get(key);
    let s;
    if (entry) { cache.delete(key); cache.set(key, entry); s = entry.sprite; }
    else {
      s = render(spec, ai / n * Math.PI * 2, P);
      const pixels = s.c.width * s.c.height;
      cache.set(key, { sprite: s, id: spec.id, pixels }); cachePixels += pixels;
      let keys = specKeys.get(spec.id); if (!keys) specKeys.set(spec.id, keys = new Set());
      keys.add(key);
      while (cachePixels > MAX_PIXELS && cache.size > 1) {
        const oldest = cache.entries().next().value; dropCached(oldest[0], oldest[1]);
      }
    }
    if (!last) { last = {}; lastSprites.set(spec, last); }
    Object.assign(last, { id: spec.id, n, ai, arms, af, legs, lf, limp, face, hx, crouch, vq, sprite: s });
    return s;
  };
  Fig.cacheSize = () => cache.size;

  // ----- specs
  const SKIN = [[236, 196, 164], [214, 166, 128], [168, 120, 86], [120, 84, 60], [88, 62, 46]];
  const HAIR = [[30, 24, 20], [70, 46, 28], [150, 110, 60], [196, 170, 100], [110, 110, 112], [20, 20, 22]];
  const SHIRTS = [[150, 40, 40], [48, 80, 130], [70, 110, 70], [190, 180, 160], [60, 60, 66], [180, 130, 50], [110, 60, 110], [220, 220, 214], [40, 90, 100], [130, 90, 60]];
  const PANTS = [[44, 56, 84], [48, 48, 52], [92, 82, 62], [60, 70, 50], [30, 30, 34], [100, 100, 108]];
  Fig.playerSpec = function (eq) {
    return { id: 'P' + (eq.bodyId || 0) + (eq.vestId || 0) + (eq.headId || 0) + (eq.bagId || 0) + (eq.feetId || 0) + (eq.legsId || 0), skin: SKIN[1], hair: HAIR[1], shirt: eq.bodyCol || [78, 98, 120], pants: eq.legsCol || [54, 60, 78], sleeve: eq.bodyCol ? null : [78, 98, 120], shoes: eq.feetCol || [40, 34, 30], hat: eq.headCol || null, bag: eq.bagCol || null, bodyId: eq.bodyId || null, headId: eq.headId || null, feetId: eq.feetId || null, bagId: eq.bagId || null, legsId: eq.legsId || null, legsCol: eq.legsCol || null, vestId: eq.vestId || null, vestCol: eq.vestCol || null, eye: 'rgba(14,10,10,0.9)' };
  };
  Fig.zombieSpec = function (seed, type) {
    const r = U.mulberry32(seed * 7919 + 13);
    const sk = SKIN[(r() * SKIN.length) | 0], dead = [sk[0] * 0.78 - 6, sk[1] * 0.92 + 6, sk[2] * 0.78];
    const sh = SHIRTS[(r() * SHIRTS.length) | 0].map(v => v * (0.45 + r() * 0.3)), pn = PANTS[(r() * PANTS.length) | 0].map(v => v * 0.6);
    const spec = { id: 'Z' + type + seed, seed, skin: dead, hair: HAIR[(r() * HAIR.length) | 0], shirt: sh, pants: pn, shoes: [28, 24, 22], eye: 'rgba(120,20,16,0.95)', bald: r() < 0.22, blood: 3 + ((r() * 8) | 0), armR: 0.062 };
    if (type === 'brute') { spec.shirt = sh.map(v => v * 0.8); spec.armR = 0.09; spec.skin = [dead[0] * 0.95, dead[1] * 0.95, dead[2] * 0.95]; }
    if (type === 'runner') { spec.skin = [dead[0] + 14, dead[1] - 4, dead[2] - 4]; }
    if (r() < 0.22) spec.hat = [r() * 90 | 0, r() * 90 | 0, r() * 90 | 0];
    return spec;
  };
  Fig.SKIN = SKIN;
})();
