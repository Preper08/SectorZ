/* Dead SectorZ — humanoid sprites: posed 3D skeleton rendered as shaded capsules from any heading.
   Used for the player, survivors and every zombie type. Sprites are cached per (spec, heading, pose). */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U;
  const Fig = DSZ.Fig = { NANG: 16 };
  const VX = 0.612, VY = 0.612, VZ = 0.5, ZU = 39.2, SC = 45.25;

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
    // crouch: drop the pelvis and lean the torso forward (feet stay planted on the ground)
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
        J.footL = [-0.9 + Math.sin(ph) * 0.06, -0.1, 0.08]; J.footR = [-0.9 - Math.sin(ph) * 0.06, 0.1, 0.08];
        J.kneeL = [-0.5, -0.12, 0.1]; J.kneeR = [-0.5, 0.12, 0.1];
      } else if (lf >= 3) { // dead: sprawl arms
        const sp = Math.min(1, (lf - 2) / 4);
        J.handL = lerp3(J.handL, [J.shL[0] + 0.1, -0.55, 0.08], sp); J.handR = lerp3(J.handR, [J.shR[0] - 0.1, 0.55, 0.08], sp);
        J.elL = lerp3(J.elL, [J.shL[0], -0.38, 0.1], sp); J.elR = lerp3(J.elR, [J.shR[0], 0.38, 0.1], sp);
        J.kneeL = lerp3(J.kneeL, [J.kneeL[0], -0.2, 0.09], sp); J.footL = lerp3(J.footL, [J.footL[0], -0.28, 0.07], sp);
      }
    }
    return J;
  }

  function render(spec, ang, P) {
    const J = pose(P);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const pr = p => { const wx = p[0] * ca - p[1] * sa, wy = p[0] * sa + p[1] * ca; return { x: (wx - wy) * 32, y: (wx + wy) * 16 - p[2] * ZU, d: wx * VX + wy * VY + p[2] * VZ }; };
    const parts = [];
    const cap = (a, b, r, col, extra) => { const pa = pr(a), pb = pr(b); parts.push(Object.assign({ pa, pb, w: r * 2 * SC, col, d: (pa.d + pb.d) / 2 }, extra || {})); };
    const skin = spec.skin, shirt = spec.shirt, pants = spec.pants, shoes = spec.shoes || [30, 28, 28];
    const rb = spec.armR || 0.062;
    // legs (shoes at ends; boots get a taller, thicker shaft that follows the shin)
    const boot = spec.feetId === 'boots';
    const legR = boot ? 0.095 : 0.085;
    cap(J.hipL, J.kneeL, legR, pants); cap(J.kneeL, J.footL, 0.07, pants);
    if (boot) {
      // boot shaft hugs the lower leg: from just below the knee down to the ankle,
      // lerped between the knee and foot joints so it follows the walking motion
      const shaftL = lerp3(J.kneeL, J.footL, 0.32), topL = lerp3(J.kneeL, J.footL, 0.05);
      cap([shaftL[0], shaftL[1], shaftL[2] + 0.03], [topL[0], topL[1], topL[2] + 0.2], 0.078, shoes);
    }
    cap([J.footL[0] - 0.02, J.footL[1], J.footL[2] + 0.04], [J.footL[0] + 0.15, J.footL[1], J.footL[2] + 0.04], 0.055, shoes);
    cap(J.hipR, J.kneeR, legR, pants); cap(J.kneeR, J.footR, 0.07, pants);
    if (boot) {
      const shaftR = lerp3(J.kneeR, J.footR, 0.32), topR = lerp3(J.kneeR, J.footR, 0.05);
      cap([shaftR[0], shaftR[1], shaftR[2] + 0.03], [topR[0], topR[1], topR[2] + 0.2], 0.078, shoes);
    }
    cap([J.footR[0] - 0.02, J.footR[1], J.footR[2] + 0.04], [J.footR[0] + 0.15, J.footR[1], J.footR[2] + 0.04], 0.055, shoes);
    // torso
    cap(J.pel, J.neck, 0.155, shirt, { torso: true });
    cap(J.shL, J.shR, 0.075, shirt);
    cap(J.pel, [J.pel[0], J.pel[1], J.pel[2] - 0.05], 0.15, pants);
    // clothing details: jacket hem + collar, tactical vest overlay (kept in the capsule style)
    if (spec.bodyId === 'jacket') {
      cap([J.pel[0] + 0.02, 0, J.pel[2] + 0.06], [J.neck[0], 0, J.neck[2] - 0.08], 0.165, shirt, { hem: true }); // open front line
      cap([J.neck[0] - 0.02, -0.07, J.neck[2] - 0.02], [J.neck[0] - 0.02, 0.07, J.neck[2] - 0.02], 0.06, shirt); // folded collar
    } else if (spec.bodyId === 'hoodie') {
      cap([J.neck[0] - 0.01, 0, J.neck[2] - 0.01], [J.neck[0] + 0.1, 0, J.neck[2] - 0.14], 0.09, shirt); // hood bump behind the neck
      cap([J.pel[0] + 0.04, 0, J.pel[2] + 0.05], [J.pel[0] + 0.04, 0, J.pel[2] + 0.18], 0.03, shirt); // drawstring
    } else if (spec.bodyId === 'vest') {
      const vc = shirt.map(v => v * 0.72); // darker overlay panels
      cap([J.neck[0] + 0.02, 0, J.neck[2] - 0.02], [J.pel[0] + 0.02, 0, J.pel[2] + 0.1], 0.115, vc, { plate: true });
      cap([J.shL[0], -0.13, J.shL[2] - 0.02], [J.shR[0], 0.13, J.shR[2] - 0.02], 0.055, vc); // shoulder yoke
      cap([J.pel[0] + 0.03, -0.1, J.pel[2] + 0.02], [J.pel[0] + 0.03, 0.1, J.pel[2] + 0.02], 0.045, vc); // belt pouches
    }
    // arms
    const sleeve = spec.sleeve || shirt;
    cap(J.shL, J.elL, rb + 0.008, sleeve); cap(J.elL, J.handL, rb, spec.glove || skin);
    cap(J.shR, J.elR, rb + 0.008, sleeve); cap(J.elR, J.handR, rb, spec.glove || skin);
    // neck + head
    cap(J.neck, J.head, 0.05, skin);
    // bag: distinct shapes per bag type, drawn behind the torso with visible straps
    if (spec.bag) {
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
      if (spec.hat) { // cap: flat dome + front brim. helmet: full dome covering the head down to the ears + rim
        const ht = pr([J.head[0] + 0.01, J.head[1], J.head[2] + 0.06]);
        const helmet = spec.headId === 'helmet';
        if (helmet) {
          x.fillStyle = rgb(spec.hat, 0.85); x.beginPath(); x.arc(hp.x, hp.y - 1, hr * 1.06, Math.PI * 0.95, Math.PI * 2.06); x.lineTo(ht.x + hr * 1.06, hp.y + hr * 0.42); x.closePath(); x.fill();
          // darker rim band at the bottom edge
          x.strokeStyle = rgb(spec.hat, 0.55); x.lineWidth = 2.2; x.beginPath(); x.arc(hp.x, hp.y - 1, hr * 1.02, Math.PI * 0.98, Math.PI * 2.02); x.stroke();
          // chin strap hint on the visible cheek side
          x.strokeStyle = 'rgba(30,30,30,0.55)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(hp.x - hr * 0.75, hp.y + hr * 0.45); x.lineTo(hp.x - hr * 0.55, hp.y + hr * 0.95); x.stroke();
        } else {
          x.fillStyle = rgb(spec.hat, 1); x.beginPath(); x.arc(ht.x, ht.y - 1.2, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98); x.lineTo(ht.x + hr, ht.y); x.fill();
          // brim sticking forward from the cap edge
          const br = pr([J.head[0] + 0.17, J.head[1], J.head[2] + 0.045]);
          x.strokeStyle = rgb(spec.hat, 0.8); x.lineWidth = 3.4; x.lineCap = 'round'; x.beginPath(); x.moveTo(ht.x + hr * 0.55, ht.y - 1.5); x.lineTo(br.x, br.y); x.stroke();
          // button on top
          x.fillStyle = rgb(spec.hat, 1.25); x.beginPath(); x.arc(ht.x, ht.y - hr * 0.98, 1.6, 0, 7); x.fill();
        }
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
  Fig.get = function (spec, ang, P) {
    const n = Fig.NANG, ai = ((Math.round(ang / (Math.PI * 2) * n) % n) + n) % n;
    const key = spec.id + '|' + ai + '|' + (P.arms || 'walk') + (P.af | 0) + '|' + (P.legs || 'idle') + (P.lf | 0) + (P.limp ? 'l' : '') + (P.face ? 'f' : '') + (P.hx ? 'h' : '') + (P.crouch ? 'c' : '');
    let s = cache.get(key);
    if (!s) { s = render(spec, ai / n * Math.PI * 2, P); cache.set(key, s); }
    return s;
  };
  Fig.cacheSize = () => cache.size;

  // ----- specs
  const SKIN = [[236, 196, 164], [214, 166, 128], [168, 120, 86], [120, 84, 60], [88, 62, 46]];
  const HAIR = [[30, 24, 20], [70, 46, 28], [150, 110, 60], [196, 170, 100], [110, 110, 112], [20, 20, 22]];
  const SHIRTS = [[150, 40, 40], [48, 80, 130], [70, 110, 70], [190, 180, 160], [60, 60, 66], [180, 130, 50], [110, 60, 110], [220, 220, 214], [40, 90, 100], [130, 90, 60]];
  const PANTS = [[44, 56, 84], [48, 48, 52], [92, 82, 62], [60, 70, 50], [30, 30, 34], [100, 100, 108]];
  Fig.playerSpec = function (eq) {
    return { id: 'P' + (eq.body || 0) + (eq.head || 0) + (eq.bag || 0) + (eq.feet || 0), skin: SKIN[1], hair: HAIR[1], shirt: eq.bodyCol || [78, 98, 120], pants: [54, 60, 78], sleeve: eq.bodyCol ? null : [78, 98, 120], shoes: eq.feetCol || [40, 34, 30], hat: eq.headCol || null, bag: eq.bagCol || null, bodyId: eq.bodyId || null, headId: eq.headId || null, feetId: eq.feetId || null, bagId: eq.bagId || null, eye: 'rgba(14,10,10,0.9)' };
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
