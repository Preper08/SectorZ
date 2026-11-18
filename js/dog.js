/* Dead SectorZ — the dog: a small pale-cream chihuahua that follows the player.
   Drawn as its own four-legged sprite rather than through Fig, because that whole system is a
   bipedal skeleton (hips, knees, shoulders) and a dog has a different topology: a long body on
   four short legs with the head out front. Reusing Fig would mean fighting it into a shape it
   was never built for.

   Behaviour is deliberately simple and entirely non-combat:
     - follows the player at a heel offset, so it stands beside/behind you rather than on top
     - teleports to the player if it is ever left far behind or stuck, so it can never be lost
     - trots with a real gait cycle, and turns its head toward whatever you are looking at
     - whines softly now and then; barks when a zombie gets close (a free early warning)
   It has no health and cannot be hurt: it is a companion, not a second player to protect. */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, W = DSZ.World, C = DSZ.C;
  const Dog = DSZ.Dog = {};
  // the 2d context is handed in by the renderer each frame (see setContext), so this module
  // never has to reach into render.js internals
  let ctxRef = null;

  // Chihuahua proportions, in world units (1 unit = 1 m, same scale as a person).
  // A real chihuahua is ~0.2 m at the shoulder, which would be eight pixels tall here and
  // unreadable, so these are scaled up to roughly a third of the player's height: unmistakably
  // a small dog, still clearly an animal rather than a second human.
  const BODY_L = 0.40, BODY_R = 0.062;        // long, thin barrel
  const LEG_L = 0.145;
  const SHOULDER_H = LEG_L + BODY_R;          // where the barrel sits
  const HEAD_R = 0.105;
  const HEAD_Z = SHOULDER_H + 0.155;          // head carried high, on an upright neck
  const HEAD_X = 0.235;
  const CH_SCALE = 0.9;                       // matches characters in render.js

  // Pale cream coat: near-white with a faint warm cast, which is what the user asked for
  // ("svetlo bez boje" - light, without colour). Deliberately not pure white, so it still
  // reads against snow-grey asphalt and hospital walls.
  const COAT = [233, 227, 210];
  const COAT_DARK = [197, 188, 166];
  const NOSE = [88, 78, 72];

  const rgb = (col, k) => 'rgb(' +
    Math.min(255, Math.round(col[0] * k)) + ',' +
    Math.min(255, Math.round(col[1] * k)) + ',' +
    Math.min(255, Math.round(col[2] * k)) + ')';

  // ---------------------------------------------------------------- sprite
  // Projected the same way Fig.render does: rotate the world-space point by the heading, then
  // project with the iso basis. Keeping the maths identical means the dog sits on the ground at
  // exactly the same height as a character's feet, in the same lighting and depth order.
  const VX = 0.612, VY = 0.612, VZ = 0.5, ZU = 39.2, SC = 45.25;

  function buildSprite(ang, gait) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const pr = p => {
      const wx = p[0] * ca - p[1] * sa, wy = p[0] * sa + p[1] * ca;
      return { x: (wx - wy) * 32, y: (wx + wy) * 16 - p[2] * ZU, d: wx * VX + wy * VY + p[2] * VZ };
    };

    const parts = [];
    const cap = (a, b, r, col, extra) => { parts.push(Object.assign({ pa: pr(a), pb: pr(b), w: r * 2 * SC, col, d: (pr(a).d + pr(b).d) / 2 }, extra || {})); };

    // gait: legs in diagonal pairs, like a real trot
    const ph = gait * Math.PI * 2;
    const sw = Math.sin(ph) * 0.055, sw2 = Math.sin(ph + Math.PI) * 0.055;
    const lift1 = Math.max(0, Math.cos(ph)) * 0.035, lift2 = Math.max(0, Math.cos(ph + Math.PI)) * 0.035;

    const halfL = BODY_L / 2;
    const bodyZ = SHOULDER_H;
    // barrel: thin and level, so the dog reads as a long animal, not a white blob
    cap([-halfL, 0, bodyZ], [halfL * 0.55, 0, bodyZ + 0.005], BODY_R, COAT, { body: true });
    // rump, slightly higher, the way a small dog carries itself
    cap([-halfL * 1.06, 0, bodyZ + 0.012], [-halfL * 0.72, 0, bodyZ + 0.006], BODY_R * 1.1, COAT, { body: true });
    // chest: fuller, and it is what the neck rises from
    cap([halfL * 0.45, 0, bodyZ], [halfL * 0.86, 0, bodyZ + 0.03], BODY_R * 1.25, COAT, { body: true });

    // four legs. Front pair under the chest, rear under the rump; diagonal pairs swing together.
    const legs = [
      [halfL * 0.66, -0.052, sw, lift1],
      [halfL * 0.66, 0.052, sw2, lift2],
      [-halfL * 0.74, -0.052, sw2, lift2],
      [-halfL * 0.74, 0.052, sw, lift1]
    ];
    for (const [lx, ly, swing, lift] of legs) {
      const knee = [lx + swing * 0.45, ly, LEG_L * 0.52 + lift * 0.5];
      const foot = [lx + swing, ly, lift];
      cap([lx, ly, bodyZ - BODY_R * 0.5], knee, 0.030, COAT_DARK);
      cap(knee, foot, 0.026, COAT);
    }

    // neck: rises steeply from the chest. This separation is what stops the head merging into
    // the body, which is what happened with the first, squatter version.
    const neckTop = [HEAD_X - 0.055, 0, HEAD_Z - 0.035];
    cap([halfL * 0.72, 0, bodyZ + 0.03], neckTop, 0.042, COAT);
    const hp = pr([HEAD_X, 0, HEAD_Z]);
    const hr = HEAD_R * SC;

    // tail: short and angled back at about 45 degrees. Long versions read as a fifth leg, and a
    // fully vertical one reads as a chimney; this length is what keeps it looking like a tail.
    cap([-halfL * 1.04, 0, bodyZ + 0.015], [-halfL * 1.34, 0, bodyZ + 0.13], 0.032, COAT);

    parts.sort((a, b) => a.d - b.d);

    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of parts) for (const q of [p.pa, p.pb]) {
      x0 = Math.min(x0, q.x - p.w / 2); x1 = Math.max(x1, q.x + p.w / 2);
      y0 = Math.min(y0, q.y - p.w / 2); y1 = Math.max(y1, q.y + p.w / 2);
    }
    x0 = Math.min(x0, hp.x - hr - 4); x1 = Math.max(x1, hp.x + hr + 4);
    y0 = Math.min(y0, hp.y - hr - 4); y1 = Math.max(y1, hp.y + hr + 4);
    const pad = 7, w = Math.ceil(x1 - x0) + pad * 2, h = Math.ceil(y1 - y0) + pad * 2;
    const [cv, x] = U.canvas2d(w, h);
    const ox = pad - x0, oy = pad - y0;
    x.translate(ox, oy); x.lineCap = 'round'; x.lineJoin = 'round';

    let headDrawn = false;
    const headDepth = pr([HEAD_X, 0, HEAD_Z]).d;
    const drawHead = () => {
      const fwdW = [ca, sa], fv = fwdW[0] * VX + fwdW[1] * VY;   // >0 = facing the camera
      // muzzle first, so it pokes out from under the skull
      const mz = pr([HEAD_X + 0.10, 0, HEAD_Z - 0.018]);
      x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = hr * 0.5 + 1.6;
      x.beginPath(); x.moveTo(hp.x, hp.y); x.lineTo(mz.x, mz.y); x.stroke();
      x.strokeStyle = rgb(COAT, 0.96); x.lineWidth = hr * 0.5;
      x.beginPath(); x.moveTo(hp.x, hp.y); x.lineTo(mz.x, mz.y); x.stroke();
      // skull
      x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.arc(hp.x, hp.y, hr + 1, 0, 7); x.fill();
      const g = x.createRadialGradient(hp.x - hr * 0.35, hp.y - hr * 0.4, hr * 0.1, hp.x, hp.y, hr);
      g.addColorStop(0, rgb(COAT, 1.22)); g.addColorStop(1, rgb(COAT, 0.8));
      x.fillStyle = g; x.beginPath(); x.arc(hp.x, hp.y, hr, 0, 7); x.fill();
      // nose tip
      x.fillStyle = rgb(NOSE, 1); x.beginPath(); x.arc(mz.x, mz.y, hr * 0.17, 0, 7); x.fill();
      // ears: large upright triangles, the most recognisable thing about the breed. They are
      // wide at the base and only moderately tall - the first version was narrow and tall, which
      // read as insect antennae rather than ears.
      const eL = pr([HEAD_X - 0.025, -0.052, HEAD_Z + 0.055]);
      const eR = pr([HEAD_X - 0.025, 0.052, HEAD_Z + 0.055]);
      for (const e of [eL, eR]) {
        x.fillStyle = rgb(COAT, 1.08);
        x.beginPath();
        x.moveTo(e.x - hr * 0.62, e.y + hr * 0.30);
        x.lineTo(e.x + hr * 0.56, e.y + hr * 0.30);
        x.lineTo(e.x - hr * 0.02, e.y - hr * 0.78);
        x.closePath(); x.fill();
        x.strokeStyle = 'rgba(0,0,0,0.34)'; x.lineWidth = 0.9; x.stroke();
        // inner ear, a shade darker, so the triangle reads as a surface and not a spike
        x.fillStyle = rgb(COAT_DARK, 1.02);
        x.beginPath();
        x.moveTo(e.x - hr * 0.34, e.y + hr * 0.22);
        x.lineTo(e.x + hr * 0.30, e.y + hr * 0.22);
        x.lineTo(e.x - hr * 0.02, e.y - hr * 0.50);
        x.closePath(); x.fill();
      }
      // eyes, only when the face is toward the camera
      if (fv > 0.02) {
        const e1 = pr([HEAD_X + 0.075, -0.034, HEAD_Z + 0.012]);
        const e2 = pr([HEAD_X + 0.075, 0.034, HEAD_Z + 0.012]);
        x.fillStyle = 'rgba(26,20,18,0.92)';
        x.globalAlpha = Math.min(1, fv * 2.4);
        x.beginPath(); x.arc(e1.x, e1.y, hr * 0.14, 0, 7); x.fill();
        x.beginPath(); x.arc(e2.x, e2.y, hr * 0.14, 0, 7); x.fill();
        x.globalAlpha = 1;
      }
      x.strokeStyle = 'rgba(0,0,0,0.32)'; x.lineWidth = 0.8;
      x.beginPath(); x.arc(hp.x, hp.y, hr, 0, 7); x.stroke();
    };

    for (const p of parts) {
      if (!headDrawn && p.d > headDepth) { drawHead(); headDrawn = true; }
      const col = p.col;
      x.lineWidth = p.w + 1.6; x.strokeStyle = 'rgba(0,0,0,0.5)';
      x.beginPath(); x.moveTo(p.pa.x, p.pa.y); x.lineTo(p.pb.x, p.pb.y); x.stroke();
      x.lineWidth = p.w; x.strokeStyle = rgb(col, 0.86);
      x.beginPath(); x.moveTo(p.pa.x, p.pa.y); x.lineTo(p.pb.x, p.pb.y); x.stroke();
      x.lineWidth = p.w * 0.6; x.strokeStyle = rgb(col, 1.1);
      x.beginPath(); x.moveTo(p.pa.x - p.w * 0.1, p.pa.y - p.w * 0.12); x.lineTo(p.pb.x - p.w * 0.1, p.pb.y - p.w * 0.12); x.stroke();
      x.lineWidth = p.w * 0.2; x.strokeStyle = 'rgba(255,255,255,0.16)';
      x.beginPath(); x.moveTo(p.pa.x - p.w * 0.22, p.pa.y - p.w * 0.2); x.lineTo(p.pb.x - p.w * 0.22, p.pb.y - p.w * 0.2); x.stroke();
    }
    if (!headDrawn) drawHead();

    return { c: cv, ox, oy };
  }

  // Sprites are cached per (heading bucket, gait bucket). Both are quantised so the cache stays
  // tiny: the dog is small enough that its gait only needs a few frames to read as a trot.
  const cache = new Map();
  const NANG = 16, NGAIT = 8;
  function sprite(ang, gait) {
    const ai = ((Math.round(ang / (Math.PI * 2) * NANG) % NANG) + NANG) % NANG;
    const gi = Math.round(gait * NGAIT) % NGAIT;
    const key = ai * 100 + gi;
    let s = cache.get(key);
    if (!s) {
      s = buildSprite(ai / NANG * Math.PI * 2, gi / NGAIT);
      cache.set(key, s);
    }
    return s;
  }
  Dog.sprite = sprite;
  Dog.clearCache = () => cache.clear();

  // ---------------------------------------------------------------- state
  Dog.spawn = function (S) {
    const p = S.player;
    const spot = Dog.findSpot(S, p.x, p.y);
    S.dog = {
      x: spot[0], y: spot[1], ang: p.ang, vx: 0, vy: 0,
      gait: 0, moving: false, r: 0.2,
      barkT: 0, whineT: 6 + Math.random() * 10, wagT: 0, alert: 0,
      sprite: null, name: 'Zuca'
    };
    return S.dog;
  };

  // A free tile next to the player, preferring the side they are facing away from, so the dog
  // does not appear in front of the camera looking at you. Falls back to the player's own tile.
  Dog.findSpot = function (S, x, y) {
    const bx = Math.floor(x), by = Math.floor(y);
    const ring = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (const [dx, dy] of ring) {
      const tx = bx + dx, ty = by + dy;
      if (!W.inb(tx, ty) || W.isSolid(tx, ty) || W.getObj(tx, ty)) continue;
      const cx = tx + 0.5, cy = ty + 0.5;
      if (W.hitCircle(cx, cy, 0.22)) continue;
      return [cx, cy];
    }
    return [x, y];
  };

  // ---------------------------------------------------------------- update
  // The dog walks toward a heel position behind the player. It is not a physics body: it uses
  // the same moveCircle as everyone else so it cannot clip through walls, and it is snapped
  // back to the player if it ever falls too far behind (which is the only failure mode that
  // matters for a companion - being left behind forever).
  const HEEL = 0.85;      // how far behind the player it likes to sit
  const MAX_D = 1.35;     // beyond this it walks in
  const MIN_D = 0.62;     // closer than this and it steps aside, so it never stands inside you
  const TELEPORT_D = 16;  // beyond this it is considered lost and is recalled

  Dog.update = function (S, dt) {
    const d = S.dog, p = S.player;
    if (!d) return;
    if (dt > 0.2) dt = 0.2;   // a hiccup must not fling it across the map

    if (d.whineT > 0) d.whineT -= dt;
    if (d.barkT > 0) d.barkT -= dt;
    if (d.alert > 0) d.alert -= dt;

    const dx = p.x - d.x, dy = p.y - d.y;
    const dist = Math.hypot(dx, dy) || 1;

    // recall: never leave the dog behind
    if (dist > TELEPORT_D) {
      const spot = Dog.findSpot(S, p.x, p.y);
      d.x = spot[0]; d.y = spot[1]; d.vx = d.vy = 0;
      return;
    }

    let mx = 0, my = 0, spd = 0;
    if (dist > MAX_D) {
      // aim at a point HEEL behind the player rather than at the player itself
      const tx = p.x - (dx / dist) * HEEL, ty = p.y - (dy / dist) * HEEL;
      const ddx = tx - d.x, ddy = ty - d.y, dd = Math.hypot(ddx, ddy) || 1;
      mx = ddx / dd; my = ddy / dd;
      // a little faster than the player walks, so it can actually catch up
      spd = dist > 4 ? 3.4 : 2.9;
      if (p.running) spd = 5.2;
    } else if (dist < MIN_D && dist > 0.02) {
      // too close: step directly away from the player at a walk, so it clears your feet without
      // bolting. This is what stops it disappearing behind the player sprite at the heel.
      mx = -dx / dist; my = -dy / dist;
      spd = 1.5;
    }

    d.vx += (mx * spd - d.vx) * Math.min(1, dt * 10);
    d.vy += (my * spd - d.vy) * Math.min(1, dt * 10);
    const sp = Math.hypot(d.vx, d.vy);
    d.moving = sp > 0.25;

    if (sp > 0.01) {
      const r = W.moveCircle(d.x, d.y, d.vx * dt, d.vy * dt, d.r);
      d.x = r.x; d.y = r.y;
      if (r.hitX && r.hitY) { d.vx *= 0.5; d.vy *= 0.5; }
    }
    // if it gets wedged against geometry, pop it out rather than letting it grind a wall
    const u = W.unstick(d.x, d.y, d.r);
    d.x = u[0]; d.y = u[1];

    if (d.moving) {
      d.gait = (d.gait + sp * dt * 2.1) % 1;
      d.ang += U.angDiff(d.ang, Math.atan2(d.vy, d.vx)) * Math.min(1, dt * 7);
    } else if (dist < 6) {
      d.ang += U.angDiff(d.ang, Math.atan2(dy, dx)) * Math.min(1, dt * 2);
    }

    // ---- voice. Silent most of the time; a whine now and then, and a bark when something is
    // close. This is the one thing the dog gives the player that is mechanically useful.
    if (DSZ.Audio && DSZ.Audio.play && !S.sleeping) {
      if (d.barkT <= 0) {
        let near = 0;
        for (const z of S.zombies) {
          if (z.dead) continue;
          if (Math.hypot(z.x - p.x, z.y - p.y) < 7) { near = 1; break; }
        }
        if (near) { d.barkT = 3.2; d.alert = 1; DSZ.Audio.play('dogBark', d.x, d.y, 0.55); }
      }
      if (d.whineT <= 0) {
        d.whineT = 22 + Math.random() * 30;
        DSZ.Audio.play('dogWhine', d.x, d.y, 0.3);
      }
    }
  };

  // ---------------------------------------------------------------- draw
  // Called from render.js inside the sorted depth pass, so it is occluded by walls and props
  // exactly like every other entity. The renderer has already applied the camera transform, so
  // this only needs the plain iso projection, the same one drawZombie uses.
  Dog.draw = function (S) {
    const d = S.dog; if (!d) return;
    const s = sprite(d.ang, d.moving ? d.gait : 0);
    const i = [(d.x - d.y) * 32, (d.x + d.y) * 16];
    d.sprite = s;
    const ctx = ctxRef; if (!ctx) return;
    ctx.save(); ctx.translate(i[0], i[1]); ctx.scale(CH_SCALE, CH_SCALE);
    ctx.drawImage(s.c, -s.ox, -s.oy);
    ctx.restore();
  };

  Dog.setContext = function (ctx) { ctxRef = ctx; };
})();
