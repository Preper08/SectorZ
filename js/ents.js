/* Dead SectorZ — zombies (senses, flow-field pathing, bashing), vehicles (arcade physics), combat, particles */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, C = DSZ.C, W = DSZ.World, O = DSZ.O, D = DSZ.OBJDEF, A = DSZ.Audio;
  const E = DSZ.Ents = {};

  const ZT = {
    walker: { speed: 1.25, hp: 60, dmg: 12, r: 0.3, sc: 1, rate: 1.1 },
    runner: { speed: 3.9, hp: 42, dmg: 9, r: 0.3, sc: 1, rate: 0.8 },
    brute: { speed: 1.05, hp: 240, dmg: 26, r: 0.42, sc: 1.2, rate: 1.5 },
    crawler: { speed: 0.7, hp: 38, dmg: 8, r: 0.27, sc: 1, rate: 1.1 }
  };
  E.ZT = ZT;

  // ------------------------------------------------------------ particles & decals
  E.particle = function (S, o) { if (S.particles.length > 700) S.particles.shift(); o.max = o.life; S.particles.push(o); return o; };
  E.blood = function (S, x, y, ang, n, amt) {
    for (let i = 0; i < n; i++) { const a = ang + (Math.random() - 0.5) * 1.3, sp = 1 + Math.random() * 4; E.particle(S, { type: 'blood', x, y, z: 0.7 + Math.random() * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 1.5 + Math.random() * 3, life: 0.5 + Math.random() * 0.5, size: 1.6 + Math.random() * 2, seed: Math.random(), grav: 14, decal: 1 }); }
    if (amt) E.decal(S, { type: 'blood', x: x + Math.cos(ang) * 0.4, y: y + Math.sin(ang) * 0.4, r: 0.25 + Math.random() * amt, a: 0.55 + Math.random() * 0.3 });
  };
  E.decal = function (S, d) { S.decals.push(d); if (S.decals.length > 420) S.decals.shift(); };
  E.smoke = function (S, x, y, z, size, a, life) { E.particle(S, { type: 'smoke', x, y, z, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, vz: 0.6 + Math.random() * 0.8, life: life || 1.8, size: size || 40, a: a || 0.7, grav: 0, drag: 0.5 }); };
  E.sparks = function (S, x, y, z, n, col) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 1 + Math.random() * 4; E.particle(S, { type: 'spark', x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 1 + Math.random() * 3, life: 0.25 + Math.random() * 0.3, grav: 9 }); } };
  E.debris = function (S, x, y, z, n, col) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 1 + Math.random() * 3; E.particle(S, { type: 'debris', x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 1 + Math.random() * 3, life: 0.6 + Math.random() * 0.5, size: 2 + Math.random() * 3, col: col, grav: 12, bounce: 1 }); } };
  E.floatText = function (S, x, y, text, col, size) { E.particle(S, { type: 'text', x, y, z: 1.9, vx: 0, vy: 0, vz: 0.9, life: 1.1, text, col, size: size || 13, grav: 0 }); };
  E.updateParticles = function (S, dt) {
    const P = S.particles;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.life -= dt;
      if (p.life <= 0) { if (p.type === 'blood' && p.decal && Math.random() < 0.5) E.decal(S, { type: 'blood', x: p.x, y: p.y, r: 0.07 + Math.random() * 0.08, a: 0.6 }); P.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.grav) p.vz -= p.grav * dt;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      if (p.z < 0 && p.grav) { p.z = 0; if (p.bounce) { p.vz = -p.vz * 0.4; p.vx *= 0.6; p.vy *= 0.6; p.bounce--; } else if (p.type === 'blood' || p.type === 'casing') { p.vx = p.vy = p.vz = 0; p.life = Math.min(p.life, p.type === 'blood' ? 0.01 : 8); } else p.life = 0; }
    }
    for (let i = S.decals.length - 1; i >= 0; i--) { const d = S.decals[i]; if (d.ttl !== undefined) { d.ttl -= dt; if (d.ttl < 3) d.fade = Math.max(0, d.ttl / 3); if (d.ttl <= 0) S.decals.splice(i, 1); } }
    for (let i = S.bullets.length - 1; i >= 0; i--) { S.bullets[i].t += dt; if (S.bullets[i].t > S.bullets[i].max) S.bullets.splice(i, 1); }
    for (let i = S.glowLights.length - 1; i >= 0; i--) { S.glowLights[i].t -= dt; if (S.glowLights[i].t <= 0) S.glowLights.splice(i, 1); }
  };

  // ------------------------------------------------------------ noise
  E.noise = function (S, x, y, r, strength) {
    S.noiseEvents.push({ x, y, r, t: 0.0 });
    for (const z of S.zombies) {
      if (z.dead || z.state === 'chase') continue;
      const dx = z.x - x, dy = z.y - y, d = Math.hypot(dx, dy); if (d > r) continue;
      // walls dampen sound
      let rr = r; if (!W.los(x, y, z.x, z.y)) rr *= 0.62; if (d > rr) continue;
      z.state = 'investigate'; z.tx = x + (Math.random() - 0.5) * 2; z.ty = y + (Math.random() - 0.5) * 2; z.alert = 6;
    }
  };

  // ------------------------------------------------------------ zombies
  E.spawnZombie = function (S, x, y, type, seed) {
    const T = ZT[type] || ZT.walker; seed = seed === undefined ? (Math.random() * 1e6) | 0 : seed;
    const z = { x, y, vx: 0, vy: 0, ang: Math.random() * 6.28, type, hp: T.hp, maxhp: T.hp, speed: T.speed * (0.85 + Math.random() * 0.3), dmg: T.dmg, r: T.r, sc: T.sc, rate: T.rate, seed, state: 'idle', alert: 0, tx: x, ty: y, wander: Math.random() * 4, cool: 0, atkT: 0, ph: Math.random() * 6.28, dead: false, deadT: 0, alpha: 1, flash: 0, burn: 0, groan: 3 + Math.random() * 12, limp: Math.random() < 0.3, sleeper: Math.random() < 0.35, bash: 0, lostT: 0, stuck: 0, id: ++E.zid };
    z.spec = DSZ.Fig.zombieSpec(seed, type);
    z.pose = { arms: 'down', af: 0, legs: type === 'crawler' ? 'crawl' : 'idle', lf: 0, limp: z.limp };
    S.zombies.push(z); return z;
  };
  E.zid = 0;

  // flow field toward player
  const FD = new Int16Array(C.W * C.H), FS = new Int32Array(C.W * C.H); let fgen = 0;
  E.flowDist = (x, y) => (x < 0 || y < 0 || x >= C.W || y >= C.H) ? 9999 : (FS[y * C.W + x] === fgen ? FD[y * C.W + x] : 9999);
  function tileCost(x, y) {
    if (!W.inb(x, y)) return 0;
    const i = y * C.W + x; if (!W.solid[i]) return 1;
    const o = W.obj[i], d = o && D[o.t]; if (!d) return 1;
    if (d.door && !o.locked && !o.base) return 2;
    if (d.hp && d.hp < 900 && (d.wall || d.fence || d.base)) return 9 + Math.min(14, (o.hp || d.hp) / 40);
    return 0;
  }
  E.updateFlow = function (S) {
    const p = S.player, sx = Math.floor(p.x), sy = Math.floor(p.y), R = 36;
    fgen++; const buckets = []; const push = (d, i) => { (buckets[d] || (buckets[d] = [])).push(i); };
    const si = sy * C.W + sx; FD[si] = 0; FS[si] = fgen; push(0, si);
    for (let d = 0; d < buckets.length; d++) {
      const b = buckets[d]; if (!b) continue;
      for (let k = 0; k < b.length; k++) {
        const i = b[k]; if (FD[i] !== d) continue;
        const x = i % C.W, y = (i / C.W) | 0;
        for (let n = 0; n < 4; n++) {
          const nx = x + (n === 0 ? 1 : n === 1 ? -1 : 0), ny = y + (n === 2 ? 1 : n === 3 ? -1 : 0);
          if (Math.abs(nx - sx) > R || Math.abs(ny - sy) > R || !W.inb(nx, ny)) continue;
          const c = tileCost(nx, ny); if (!c) continue;
          const ni = ny * C.W + nx, nd = d + c;
          if (FS[ni] !== fgen || FD[ni] > nd) { FS[ni] = fgen; FD[ni] = nd; push(nd, ni); }
        }
      }
    }
  };
  function flowDir(z) {
    const tx = Math.floor(z.x), ty = Math.floor(z.y); let best = E.flowDist(tx, ty), bx = 0, by = 0;
    if (best >= 9999) return null;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = tx + dx, ny = ty + dy, d = E.flowDist(nx, ny);
      if (d >= best) continue;
      if (dx && dy && (!tileCost(tx + dx, ty) || !tileCost(tx, ty + dy))) continue;
      best = d; bx = dx; by = dy;
    }
    if (!bx && !by) return null;
    const cx = tx + bx + 0.5, cy = ty + by + 0.5, l = Math.hypot(cx - z.x, cy - z.y) || 1;
    return [(cx - z.x) / l, (cy - z.y) / l, tx + bx, ty + by];
  }

  // spatial hash for separation
  const CELL = 2, GW = Math.ceil(C.W / CELL) + 1; let hash = new Map();
  function rebuildHash(S) { hash.clear(); for (const z of S.zombies) { if (z.dead || !z.active) continue; const k = ((z.y / CELL) | 0) * GW + ((z.x / CELL) | 0); let a = hash.get(k); if (!a) hash.set(k, a = []); a.push(z); } }
  function neighbours(z, fn) { const cx = (z.x / CELL) | 0, cy = (z.y / CELL) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = hash.get((cy + dy) * GW + cx + dx); if (a) for (const o of a) if (o !== z) fn(o); } }

  E.carCircles = function (c, out) { const ca = Math.cos(c.ang), sa = Math.sin(c.ang); out.length = 0; for (const o of [-0.8, 0, 0.8]) out.push([c.x + ca * o, c.y + sa * o, 0.5]); return out; };
  const tmpC = [];
  function pushFromCars(S, e, r) {
    for (const c of S.cars) {
      if (Math.abs(c.x - e.x) > 2.6 || Math.abs(c.y - e.y) > 2.6) continue;
      E.carCircles(c, tmpC);
      for (const k of tmpC) { const dx = e.x - k[0], dy = e.y - k[1], d = Math.hypot(dx, dy), m = r + k[2]; if (d < m && d > 1e-4) { const f = (m - d) / d; const nx = e.x + dx * f, ny = e.y + dy * f; if (!W.hitCircle(nx, ny, r * 0.8)) { e.x = nx; e.y = ny; } } }
    }
  }
  E.pushFromCars = pushFromCars;

  E.hurtZombie = function (S, z, dmg, ang, kb, opts) {
    if (z.dead) return false; opts = opts || {};
    z.hp -= dmg; z.flash = 1; z.state = 'chase'; z.lostT = 0; z.sleeper = false;
    z.vx += Math.cos(ang) * kb; z.vy += Math.sin(ang) * kb;
    E.blood(S, z.x, z.y, ang, 3 + Math.min(8, dmg / 8 | 0), 0.18);
    if (opts.text) E.floatText(S, z.x, z.y, opts.text, opts.col || '#ffd070', 14);
    A.play('hitFlesh', z.x, z.y, 0.8);
    if (z.hp <= 0) { E.killZombie(S, z, ang); return true; }
    if (z.type !== 'brute' && Math.random() < 0.18) { z.stagger = 0.5; }
    return false;
  };
  E.killZombie = function (S, z, ang) {
    z.dead = true; z.deadT = 0.55; z.state = 'dead'; z.face = Math.cos(ang - z.ang) > 0; S.stats.kills++;
    E.blood(S, z.x, z.y, ang, 12, 0.6);
    E.decal(S, { type: 'blood', x: z.x, y: z.y, r: 0.55 + Math.random() * 0.4, a: 0.8 });
    if (Math.random() < 0.22) S.zombies.length; // keep for loot
    z.pose = { arms: 'down', af: 0, legs: 'dead', lf: 0, face: z.face };
    z.lootRoll = false; z.sprite = z.sprite;
    if (S.zombies.filter(q => q.dead).length > 90) { for (let i = 0; i < S.zombies.length; i++) if (S.zombies[i].dead && !S.zombies[i].grid && S.zombies[i] !== z) { S.zombies.splice(i, 1); break; } }
  };

  E.updateZombies = function (S, dt) {
    const p = S.player, dl = DSZ.Render.daylight(S.hour);
    S.flowT = (S.flowT || 0) - dt; if (S.flowT <= 0) { E.updateFlow(S); S.flowT = 0.3; }
    // refresh the active set a few times per second instead of scanning every zombie every frame
    S.actT = (S.actT || 0) - dt;
    if (S.actT <= 0) {
      S.actT = 0.15;
      let active = 0;
      for (const z of S.zombies) { z.active = !z.dead && Math.abs(z.x - p.x) < 60 && Math.abs(z.y - p.y) < 60; if (z.active) active++; }
      S.activeZ = active; rebuildHash(S);
    }
    const vis = (7 + 10 * dl) * (p.lightOn && dl < 0.6 ? 1.35 : 1) * (p.running ? 1.25 : 1) * (p.sneak ? 0.6 : 1) * (S.player.driving ? 1.4 : 1);
    for (let zi = S.zombies.length - 1; zi >= 0; zi--) {
      const z = S.zombies[zi];
      if (z.flash > 0) z.flash -= dt * 6;
      if (z.dead) {
        if (z.deadT > 0) { z.deadT -= dt; z.pose.lf = Math.min(6, Math.floor((1 - z.deadT / 0.55) * 7)); z.x += z.vx * dt; z.y += z.vy * dt; z.vx *= 0.9; z.vy *= 0.9; if (z.deadT <= 0) z.pose.lf = 6; }
        continue;
      }
      if (!z.active) continue;
      const dx = p.x - z.x, dy = p.y - z.y, dist = Math.hypot(dx, dy);
      // --- senses
      let sees = false;
      if (!p.dead && dist < vis * (z.state === 'chase' ? 1.5 : 1) * (z.sleeper ? 0.35 : 1)) {
        const a = Math.atan2(dy, dx), inCone = Math.abs(U.angDiff(z.ang, a)) < 1.25 || dist < 2.4 || z.state === 'chase';
        if (inCone && W.los(z.x, z.y, p.x, p.y)) sees = true;
      }
      if (p.driving && dist < 9 && !p.driving.dead) sees = sees || W.los(z.x, z.y, p.x, p.y);
      if (sees) { if (z.state !== 'chase') { z.state = 'chase'; A.play(Math.random() < 0.3 ? 'scream' : 'groan', z.x, z.y, 0.9); } z.lostT = 0; z.tx = p.x; z.ty = p.y; z.sleeper = false; }
      else if (z.state === 'chase') { z.lostT += dt; if (z.lostT > 7) { z.state = 'investigate'; z.alert = 5; } }
      if (z.alert > 0) { z.alert -= dt; if (z.alert <= 0 && z.state === 'investigate') z.state = 'idle'; }
      z.groan -= dt; if (z.groan <= 0) { z.groan = (z.state === 'chase' ? 4 : 11) + Math.random() * 10; if (dist < 24) A.play('groan', z.x, z.y, z.state === 'chase' ? 0.8 : 0.45); }
      // --- decide movement
      let mx = 0, my = 0, spd = 0, bashTarget = null;
      const T = ZT[z.type];
      if (z.stagger > 0) z.stagger -= dt;
      else if (z.state === 'chase') {
        spd = z.speed * (z.type === 'runner' ? 1 : 1);
        if (dist < 7 && W.los(z.x, z.y, p.x, p.y) && !W.raycastSolid(z.x, z.y, p.x, p.y, true)) { mx = dx / dist; my = dy / dist; }
        else { const f = flowDir(z); if (f) { mx = f[0]; my = f[1]; const t = W.getObj(f[2], f[3]); if (t && W.isSolid(f[2], f[3])) bashTarget = t; } else { mx = dx / (dist || 1); my = dy / (dist || 1); } }
        if (z.type === 'brute' && dist < 5 && dist > 2.5) spd *= 1.5;
      } else if (z.state === 'investigate') {
        const tdx = z.tx - z.x, tdy = z.ty - z.y, td = Math.hypot(tdx, tdy);
        if (td < 1.2) { z.state = 'idle'; z.wander = 2 + Math.random() * 3; }
        else { spd = z.speed * 0.8; if (W.los(z.x, z.y, z.tx, z.ty) || td < 3) { mx = tdx / td; my = tdy / td; } else { // greedy around obstacles using temporary flow to player if near
              const f = flowDir(z); if (f && dist < 38) { mx = f[0]; my = f[1]; } else { mx = tdx / td; my = tdy / td; } } }
      } else { // idle wander
        z.wander -= dt;
        if (z.wander <= 0) { z.wander = 2 + Math.random() * 5; if (z.sleeper || Math.random() < 0.45) { z.dirx = 0; z.diry = 0; } else { const a = Math.random() * 6.28; z.dirx = Math.cos(a); z.diry = Math.sin(a); } }
        if (z.dirx || z.diry) { mx = z.dirx; my = z.diry; spd = z.speed * 0.35; }
      }
      // --- door handling / bashing
      if (bashTarget && spd > 0) {
        const bd = D[bashTarget.t];
        if (bd.door && !bashTarget.locked && !bashTarget.base && !bashTarget.open) { bashTarget.open = true; W.refresh(bashTarget.x, bashTarget.y); A.play('door', z.x, z.y, 0.8); }
        else if (bd.hp) { z.bash += dt; spd *= 0.05; z.bashObj = bashTarget; if (z.bash > 0.9) { z.bash = 0; E.damageObject(S, bashTarget, z.dmg * 1.4, z, true); z.atkT = 0.4; } }
      } else z.bash = Math.max(0, z.bash - dt);
      // --- attack
      z.cool -= dt;
      if (z.atkT > 0) {
        z.atkT -= dt; const t = 1 - z.atkT / 0.55;
        z.pose.af = Math.min(3, Math.floor(t * 4));
        if (!z.hitDone && t > 0.5) { z.hitDone = true; if (dist < 1.15 + z.r && !p.dead) E.zombieHitPlayer(S, z); }
        spd *= 0.15;
      } else if (z.state === 'chase' && dist < 0.78 + z.r * 0.4 && z.cool <= 0 && !p.dead && !p.driving) {
        z.atkT = 0.55; z.cool = z.rate + Math.random() * 0.4; z.hitDone = false; z.ang = Math.atan2(dy, dx);
      } else if (z.state === 'chase' && p.driving && dist < 1.6 && z.cool <= 0) { z.cool = 1.0; E.damageCar(S, p.driving, z.dmg * 0.6, z.x, z.y); A.play('thud', z.x, z.y, 0.7); }
      // --- integrate
      const tvx = mx * spd, tvy = my * spd;
      z.vx += (tvx - z.vx) * Math.min(1, dt * 7); z.vy += (tvy - z.vy) * Math.min(1, dt * 7);
      let sp = Math.hypot(z.vx, z.vy);
      if (sp > 0.05) {
        const r = W.moveCircle(z.x, z.y, z.vx * dt, z.vy * dt, z.r);
        z.x = r.x; z.y = r.y;
        if (r.hitX && r.hitY) z.stuck += dt; else z.stuck = Math.max(0, z.stuck - dt);
        if (z.state === 'idle' && z.stuck > 0.5) { z.dirx = z.diry = 0; z.wander = 1 + Math.random() * 2; z.stuck = 0; }
        if (sp > 0.25 && z.atkT <= 0) { const ta = Math.atan2(z.vy, z.vx); z.ang += U.angDiff(z.ang, ta) * Math.min(1, dt * (z.state === 'chase' ? 9 : 4)); }
      } else if (z.state === 'chase' && dist > 0.1) z.ang += U.angDiff(z.ang, Math.atan2(dy, dx)) * Math.min(1, dt * 8);
      // separation
      neighbours(z, o => { const ex = z.x - o.x, ey = z.y - o.y, d = Math.hypot(ex, ey), m = z.r + o.r + 0.05; if (d < m && d > 1e-4) { const f = (m - d) * 0.45 / d; const nx = z.x + ex * f, ny = z.y + ey * f; if (!W.hitCircle(nx, ny, z.r)) { z.x = nx; z.y = ny; } } });
      pushFromCars(S, z, z.r);
      // --- animation
      const gait = z.type === 'runner' ? 'zrun' : 'zwalk';
      sp = Math.hypot(z.vx, z.vy);
      if (z.type === 'crawler') { z.pose.legs = 'crawl'; z.ph += sp * dt * 5; z.pose.lf = ((z.ph | 0) & 7); z.pose.arms = 'zreach'; }
      else if (z.atkT > 0) { z.pose.arms = 'zatk'; z.pose.legs = sp > 0.3 ? gait : 'idle'; z.ph += sp * dt * 3; z.pose.lf = (z.ph | 0) & 7; }
      else if (sp > 0.15) { z.ph += sp * dt * (z.type === 'runner' ? 2.0 : 3.3); z.pose.legs = gait; z.pose.lf = (z.ph | 0) & 7; z.pose.arms = z.state === 'chase' ? 'zreach' : (z.state === 'investigate' ? 'zreach' : 'down'); }
      else { z.pose.legs = 'idle'; z.pose.lf = 0; z.pose.arms = z.state === 'chase' ? 'zreach' : 'down'; }
      z.pose.limp = z.limp;
      if (z.burn > 0) { z.burn -= dt; z.hp -= 10 * dt; z.flash = 0.3; if (z.hp <= 0) E.killZombie(S, z, 0); }
    }
    // fire contact from burning cars
    for (const c of S.cars) if (c.fire) for (const z of S.zombies) if (!z.dead && z.active && Math.hypot(z.x - c.x, z.y - c.y) < 2.2) z.burn = 2.5;
  };

  E.zombieHitPlayer = function (S, z) {
    const p = S.player; const dmg = z.dmg * (0.8 + Math.random() * 0.4);
    DSZ.Game.hurtPlayer(S, dmg, z.x, z.y, 'bite', z);
  };

  // ------------------------------------------------------------ damage to world objects
  E.damageObject = function (S, o, dmg, src, byZombie) {
    const d = D[o.t]; if (!d || !d.hp) return;
    o.hp -= dmg; o.hit = 0.6;
    const x = o.x + 0.5, y = o.y + 0.5;
    if (d.window) { if (!o.broken) { o.broken = true; o.hp = 0; W.refresh(o.x, o.y); A.play('glass', x, y, 1); E.noise(S, x, y, 14); E.debris(S, x, y, 1.2, 10, '#bcd'); return; } }
    A.play(o.hp > 0 ? 'thud' : 'doorBreak', x, y, 0.9); E.debris(S, x, y, 1.0, 3, d.base || d.door ? '#8a6a44' : '#999');
    E.noise(S, x, y, byZombie ? 8 : 12);
    if (o.hp <= 0) {
      if (d.door && !d.base) { o.broken = true; o.open = true; o.locked = false; W.refresh(o.x, o.y); E.debris(S, x, y, 1, 14, '#7a5a38'); }
      else { if (d.base) { DSZ.Game.destroyBase(S, o); } else { W.removeObj(o.x, o.y); DSZ.Render.dirtyAt(o.x, o.y); E.debris(S, x, y, 1, 14, '#888'); } }
    }
  };

  // ------------------------------------------------------------ combat
  function rayCircle(ox, oy, dx, dy, cx, cy, r) { // dx,dy normalized; returns t or null
    const fx = cx - ox, fy = cy - oy, b = fx * dx + fy * dy; if (b < 0) return null;
    const d2 = fx * fx + fy * fy - b * b; if (d2 > r * r) return null; return b - Math.sqrt(r * r - d2);
  }
  E.shoot = function (S, p, def, item) {
    const n = def.pellets || 1, ox = p.x + Math.cos(p.aimAng) * 0.5, oy = p.y + Math.sin(p.aimAng) * 0.5;
    const spread = def.spread * (p.aiming ? 0.55 : 1) * (p.moving ? 1.3 : 1) * (p.running ? 1.6 : 1);
    A.play(def.snd, p.x, p.y, 1.2, 80); E.noise(S, p.x, p.y, def.noise * 1.0);
    S.muzzle = 0.09; p.muzzle = 0.08; S.cam.shake = Math.min(1, (S.cam.shake || 0) + (def.pellets ? 0.55 : 0.3));
    E.particle(S, { type: 'casing', x: p.x, y: p.y, z: 1.0, vx: Math.cos(p.aimAng + 1.6) * 1.6, vy: Math.sin(p.aimAng + 1.6) * 1.6, vz: 2, life: 8, grav: 12, bounce: 2 });
    E.particle(S, { type: 'smoke', x: ox + Math.cos(p.aimAng) * 0.3, y: oy + Math.sin(p.aimAng) * 0.3, z: 1.1, vx: Math.cos(p.aimAng) * 0.5, vy: Math.sin(p.aimAng) * 0.5, vz: 0.3, life: 0.8, size: 22, a: 0.35, drag: 1 });
    for (let k = 0; k < n; k++) {
      const a = p.aimAng + (Math.random() + Math.random() - 1) * spread * 2, dx = Math.cos(a), dy = Math.sin(a);
      let range = def.range, wall = W.raycastSolid(ox, oy, ox + dx * range, oy + dy * range, true);
      if (wall) range = wall.t;
      const hits = [];
      for (const z of S.zombies) {
        if (z.dead) continue; if (Math.abs(z.x - ox) > range + 1 || Math.abs(z.y - oy) > range + 1) continue;
        const t = rayCircle(ox, oy, dx, dy, z.x, z.y, z.r + 0.08); if (t !== null && t <= range) hits.push([t, z]);
      }
      hits.sort((a, b) => a[0] - b[0]);
      let pierce = def.pierce || 1, endT = range;
      for (const h of hits) {
        if (pierce <= 0) break; pierce--;
        const crit = Math.random() < 0.14, falloff = n > 1 ? Math.max(0.25, 1 - h[0] / def.range) : 1;
        let dmg = def.dmg * (crit ? 2.4 : 1) * falloff * (0.9 + Math.random() * 0.2);
        E.hurtZombie(S, h[1], dmg, a, def.pellets ? 1.5 : 2.5, { text: crit ? 'HEADSHOT' : null, col: '#ff6a50' });
        endT = h[0]; if (pierce <= 0) break;
      }
      // cars
      for (const c of S.cars) { if (c === p.driving) continue; if (Math.hypot(c.x - ox, c.y - oy) > range + 2) continue; E.carCircles(c, tmpC); for (const q of tmpC) { const t = rayCircle(ox, oy, dx, dy, q[0], q[1], 0.5); if (t !== null && t < endT) { endT = t; E.sparks(S, ox + dx * t, oy + dy * t, 0.7, 4); E.damageCar(S, c, def.dmg * 0.25, ox, oy, true); } } }
      if (wall && wall.t <= endT + 0.01) { const o = W.getObj(wall.tx, wall.ty); endT = wall.t; E.sparks(S, ox + dx * wall.t, oy + dy * wall.t, 1.0, 5); if (o && D[o.t].hp && (D[o.t].window || D[o.t].wall)) E.damageObject(S, o, def.dmg * 0.6, p); }
      S.bullets.push({ x0: ox, y0: oy, x1: ox + dx * endT, y1: oy + dy * endT, t: 0, max: 0.09 });
    }
    DSZ.Render && 0;
  };
  E.melee = function (S, p, def, item) {
    const range = def.range + 0.45, half = 0.95, hit = []; let any = false;
    A.play('swing', p.x, p.y, 0.8); E.noise(S, p.x, p.y, def.noise);
    for (const z of S.zombies) {
      if (z.dead) continue; const dx = z.x - p.x, dy = z.y - p.y, d = Math.hypot(dx, dy); if (d > range + z.r) continue;
      if (Math.abs(U.angDiff(p.aimAng, Math.atan2(dy, dx))) > half && d > 0.8) continue; if (!W.los(p.x, p.y, z.x, z.y)) continue;
      hit.push([d, z]);
    }
    hit.sort((a, b) => a[0] - b[0]);
    const maxT = def.dmg >= 40 ? 3 : 2;
    for (let i = 0; i < Math.min(hit.length, maxT); i++) {
      const z = hit[i][1], crit = Math.random() < 0.1, dmg = def.dmg * (crit ? 2 : 1) * (0.85 + Math.random() * 0.3) * (1 + p.strength * 0.0);
      E.hurtZombie(S, z, dmg, p.aimAng, def.dmg >= 40 ? 5 : 3.2, { text: crit ? 'CRIT' : null }); any = true;
      if (item && item.dur !== undefined) item.dur -= 0.5;
    }
    // objects: tile in front
    const tx = Math.floor(p.x + Math.cos(p.aimAng) * 1.1), ty = Math.floor(p.y + Math.sin(p.aimAng) * 1.1), o = W.getObj(tx, ty);
    if (o && !any) {
      const od = D[o.t];
      if (od.tree && def.chop) { o.chop = (o.chop || 0) + 1; A.play('thud', tx + 0.5, ty + 0.5, 0.9); E.debris(S, tx + 0.5, ty + 0.5, 1, 6, '#6a4a2a'); o.hit = 0.6; if (o.chop >= 5) { W.removeObj(tx, ty); DSZ.Render.dirtyAt(tx, ty); DSZ.Game.dropItem(S, tx + 0.5, ty + 0.5, DSZ.Inv.make('log', 2)); DSZ.Game.dropItem(S, tx + 0.7, ty + 0.3, DSZ.Inv.make('stick', 3)); E.debris(S, tx + 0.5, ty + 0.5, 1, 16, '#6a4a2a'); DSZ.Game.toast(S, 'Tree felled'); } any = true; if (item && item.dur !== undefined) item.dur -= 0.3; }
      else if (od.window && !o.broken) { E.damageObject(S, o, 999, p); any = true; }
      else if (od.hp && (od.door || od.fence || od.wall && !od.base)) { E.damageObject(S, o, def.dmg * 0.5, p); any = true; if (item && item.dur !== undefined) item.dur -= 0.6; }
      else if (od.cont && !od.base && od.h < 50 && def.dmg > 20 && Math.random() < 0.3) { E.debris(S, tx + 0.5, ty + 0.5, 0.6, 4, '#8a6a44'); }
    }
    if (any) { A.play('hit', p.x, p.y, 0.9); S.cam.shake = Math.min(1, (S.cam.shake || 0) + 0.18); }
    return any;
  };

  // ------------------------------------------------------------ cars
  E.spawnCar = function (S, spec) {
    const K = DSZ.CarArt.kinds[spec.kind];
    const c = { x: spec.x, y: spec.y, ang: spec.ang, vx: 0, vy: 0, speed: 0, steer: 0, kind: spec.kind, color: spec.color, state: spec.state, hp: spec.state === 'ok' ? 140 : (spec.state === 'burnt' ? 0 : 60), maxhp: 140, fuel: spec.state === 'ok' ? 15 + Math.random() * 45 : 0, maxfuel: 60, lightsOn: false, engineOn: false, braking: false, rev: false, fire: false, smoke: 0, seed: spec.seed, drivable: spec.state === 'ok', dead: spec.state === 'burnt', cont: null, flash: 0, alarm: 0, throttle: 0, bounce: 0, noiseT: 0 };
    S.cars.push(c); return c;
  };
  E.damageCar = function (S, c, dmg, sx, sy, bullet) {
    if (c.dead) return; c.hp -= dmg; c.flash = 0.6;
    if (c.drivable && c.hp < c.maxhp * 0.3 && !c.smoke) c.smoke = 1;
    if (c.hp <= 0 && !c.dead) E.destroyCar(S, c);
    else if (c.hp < c.maxhp * 0.12 && !c.fire && c.drivable) { c.fire = true; c.fireT = 9; }
  };
  E.destroyCar = function (S, c) {
    c.dead = true; c.state = 'burnt'; c.drivable = false; c.fire = true; c.fireT = 25; c.engineOn = false; c.lightsOn = false; c.speed = 0; c.vx = c.vy = 0;
    E.explode(S, c.x, c.y, 5.5, 90, c);
    if (S.player.driving === c) DSZ.Game.exitCar(S, true);
  };
  E.explode = function (S, x, y, r, dmg, src) {
    A.play('explosion', x, y, 1.6, 90); E.noise(S, x, y, 50); S.cam.shake = Math.min(1.4, (S.cam.shake || 0) + 1.0 * Math.max(0, 1 - Math.hypot(x - S.player.x, y - S.player.y) / 25));
    S.glowLights.push({ x, y, r: 12, col: [255, 170, 80], a: 1.4, t: 0.7, max: 0.7 });
    E.decal(S, { type: 'scorch', x, y, r: r * 0.5, a: 0.55 });
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, sp = 2 + Math.random() * 7; E.particle(S, { type: 'fire', x, y, z: 0.5 + Math.random(), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 1 + Math.random() * 4, life: 0.6 + Math.random() * 0.6, size: 40 + Math.random() * 40, grav: -2, drag: 2 }); }
    for (let i = 0; i < 10; i++) E.smoke(S, x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2, 1 + Math.random(), 80, 0.8, 3.5);
    E.debris(S, x, y, 1, 24, '#666');
    for (const z of S.zombies) { if (z.dead) continue; const d = Math.hypot(z.x - x, z.y - y); if (d < r) { const f = 1 - d / r; E.hurtZombie(S, z, dmg * f + 10, Math.atan2(z.y - y, z.x - x), 8 * f); if (!z.dead) z.burn = 3; } }
    const p = S.player, pd = Math.hypot(p.x - x, p.y - y); if (pd < r && !p.dead && src && p.driving !== src) DSZ.Game.hurtPlayer(S, dmg * (1 - pd / r) * 0.8, x, y, 'blast');
  };
  const cp = [];
  E.updateCars = function (S, dt) {
    const p = S.player;
    for (const c of S.cars) {
      if (c.flash > 0) c.flash -= dt * 3;
      if (c.fire) {
        c.fireT -= dt; if (Math.random() < dt * 8) E.smoke(S, c.x + (Math.random() - 0.5), c.y + (Math.random() - 0.5), 0.9, 50, 0.7, 2.2);
        if (c.fireT <= 0) { c.fire = false; if (!c.dead) E.destroyCar(S, c); }
        if (c.drivable && !c.dead && c.fireT < 3) E.destroyCar(S, c);
      } else if (c.smoke && Math.random() < dt * 5) E.smoke(S, c.x + Math.cos(c.ang) * 0.9, c.y + Math.sin(c.ang) * 0.9, 0.8, 34, 0.5, 1.6);
      const driven = p.driving === c;
      if (!driven && Math.abs(c.speed) < 0.05 && !c.vx && !c.vy) { if (c.engineOn && !driven) c.engineOn = false; continue; }
      if (!driven) { c.throttle = 0; }
      E.stepCar(S, c, dt, driven);
    }
  };
  E.stepCar = function (S, c, dt, driven) {
    const K = DSZ.CarArt.kinds[c.kind], G = DSZ.Game; const inp = driven ? S.carInput : { thr: 0, str: 0, hand: true };
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang), lx = -fy, ly = fx;
    let vf = c.vx * fx + c.vy * fy, vl = c.vx * lx + c.vy * ly;
    const hasFuel = c.fuel > 0 && c.hp > 0, max = (c.kind === 'taxi' ? 12.5 : c.kind === 'van' ? 10 : c.kind === 'pickup' ? 11 : 12) * (c.hp < 40 ? 0.7 : 1);
    let thr = driven && hasFuel && c.engineOn ? inp.thr : 0;
    c.braking = false; c.rev = vf < -0.5 && thr < 0;
    if (thr > 0) { if (vf < -0.3) { vf += 30 * dt; c.braking = true; } else vf += 10.5 * dt * (1 - Math.max(0, vf) / max); }
    else if (thr < 0) { if (vf > 0.3) { vf -= 30 * dt; c.braking = true; } else vf -= 7 * dt * (1 - Math.max(0, -vf) / 4.5); }
    vf -= vf * 0.45 * dt + Math.sign(vf) * 0.25 * dt; if (Math.abs(vf) < 0.03 && thr === 0) vf = 0;
    const grip = inp.hand ? 1.6 : 8.5; vl *= Math.exp(-grip * dt);
    if (inp.hand && Math.abs(vf) > 1) { vf *= Math.exp(-0.9 * dt); c.braking = true; }
    const steerT = (inp.str || 0); c.steer += (steerT - c.steer) * Math.min(1, dt * 8);
    const turn = c.steer * 2.1 / (1 + Math.abs(vf) * 0.09) * Math.min(1, Math.abs(vf) / 2.4) * (vf >= 0 ? 1 : -1);
    c.ang += turn * dt;
    const nfx = Math.cos(c.ang), nfy = Math.sin(c.ang);
    c.vx = nfx * vf + (-nfy) * vl; c.vy = nfy * vf + nfx * vl; c.speed = vf;
    // move with collision
    const steps = Math.max(1, Math.ceil(Math.hypot(c.vx, c.vy) * dt / 0.3));
    let hit = 0;
    for (let s = 0; s < steps; s++) {
      const mx = c.vx * dt / steps, my = c.vy * dt / steps;
      const nx = c.x + mx, ny = c.y + my; let blockX = false, blockY = false;
      E.carCircles({ x: nx, y: c.y, ang: c.ang }, cp); for (const q of cp) if (W.hitCircle(q[0], q[1], 0.42)) blockX = true;
      E.carCircles({ x: c.x, y: ny, ang: c.ang }, cp); for (const q of cp) if (W.hitCircle(q[0], q[1], 0.42)) blockY = true;
      if (!blockX) c.x = nx; else { hit = Math.max(hit, Math.abs(c.vx)); c.vx *= -0.25; }
      if (!blockY) c.y = ny; else { hit = Math.max(hit, Math.abs(c.vy)); c.vy *= -0.25; }
      if (blockX || blockY) { c.speed *= 0.4; }
    }
    // rotation collision (stuck against walls)
    E.carCircles(c, cp); let pen = false; for (const q of cp) if (W.hitCircle(q[0], q[1], 0.4)) pen = true; if (pen) { c.x -= c.vx * dt * 1.3; c.y -= c.vy * dt * 1.3; c.vx *= 0.5; c.vy *= 0.5; }
    // cars vs cars
    for (const o of S.cars) { if (o === c || Math.abs(o.x - c.x) > 3.2 || Math.abs(o.y - c.y) > 3.2) continue; const A1 = E.carCircles(c, []), B1 = E.carCircles(o, []); for (const a of A1) for (const b of B1) { const dx = a[0] - b[0], dy = a[1] - b[1], d = Math.hypot(dx, dy), m = a[2] + b[2]; if (d < m && d > 1e-4) { const f = (m - d) / d * 0.5; c.x += dx * f; c.y += dy * f; o.x -= dx * f * 0.4; o.y -= dy * f * 0.4; const rel = Math.hypot(c.vx - o.vx, c.vy - o.vy); if (rel > 2.5) { hit = Math.max(hit, rel); o.vx += c.vx * 0.3; o.vy += c.vy * 0.3; E.damageCar(S, o, rel * 2, c.x, c.y); } c.vx *= 0.7; c.vy *= 0.7; } } }
    if (hit > 3.2) { const dmg = (hit - 2.5) * 6; E.damageCar(S, c, dmg, c.x, c.y); S.cam.shake = Math.min(1.2, (S.cam.shake || 0) + hit * 0.06); A.play('carHit', c.x, c.y, Math.min(1.4, hit * 0.15)); E.noise(S, c.x, c.y, 24); E.sparks(S, c.x + nfx, c.y + nfy, 0.5, 8); E.debris(S, c.x + nfx, c.y + nfy, 0.5, 5, '#888'); if (driven && hit > 6) G.hurtPlayer(S, (hit - 5) * 2.2, c.x, c.y, 'crash'); }
    // run over zombies
    if (Math.abs(vf) > 2.2) for (const z of S.zombies) {
      if (z.dead || Math.abs(z.x - c.x) > 2.2 || Math.abs(z.y - c.y) > 2.2) continue;
      for (const q of E.carCircles(c, [])) { const d = Math.hypot(z.x - q[0], z.y - q[1]); if (d < 0.5 + z.r + 0.15) { const dmg = Math.abs(vf) * 15; E.hurtZombie(S, z, dmg, Math.atan2(c.vy, c.vx), Math.abs(vf) * 0.7); A.play('thud', z.x, z.y, 1); c.vx *= 0.97; c.vy *= 0.97; if (z.type === 'brute') E.damageCar(S, c, 4, z.x, z.y); S.cam.shake = Math.min(1, (S.cam.shake || 0) + 0.2); break; } }
    }
    // visuals: skid marks, fuel, noise
    const slip = Math.abs(vl);
    if ((slip > 3 || (inp.hand && Math.abs(vf) > 4)) && Math.random() < dt * 20) { for (const s of [-0.4, 0.4]) { const bx = c.x - nfx * 0.7 - nfy * s, by = c.y - nfy * 0.7 + nfx * s; E.decal(S, { type: 'skid', x: bx, y: by, x2: bx - c.vx * 0.05, y2: by - c.vy * 0.05, a: 0.5, ttl: 30 }); } E.smoke(S, c.x - nfx * 0.8, c.y - nfy * 0.8, 0.2, 28, 0.35, 1); }
    if (driven && c.engineOn) { c.fuel = Math.max(0, c.fuel - dt * (0.02 + Math.abs(thr) * 0.06)); if (c.fuel <= 0) { S.toast && DSZ.Game.toast(S, 'Out of fuel'); c.engineOn = false; } c.noiseT -= dt; if (c.noiseT <= 0) { c.noiseT = 0.6; E.noise(S, c.x, c.y, 16 + Math.abs(vf)); } }
    c.bounce = Math.max(0, Math.min(2, (c.bounce || 0) * 0.9 + (hit > 3 ? 1 : 0)));
  };
})();
