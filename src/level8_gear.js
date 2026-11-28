'use strict';
var L8 = L8 || {};
// =====================================================================================================================
// Mission 8 (DINOSAUR VALLEY) gear: what the hero finds, frees and rides.
//
//   PROP_TYPES.amber        an amber block: two shots, 50 points, it drops its item (like a crate)
//   POW_KINDS.hatchling     a baby dinosaur in an Oggle cage. Four looks by its number (three-horn, long-neck,
//                           plate-back, duck-bill); freed, it hops for joy, leaves its item and bounces away
//   ITEMS.D, WEAPONS.dinorang   the DINO-RANG: a bone boomerang that flies out about 110 px and comes back to the
//                           hero's hand. It goes through everything and hits each robot once on the way out and once
//                           on the way back (2 + 2); it knocks eggs out of the air and opens cages
//   RIDES.tops, PROP_TYPES.tops, PROP_TYPES.topscage, PROP_TYPES.topswait
//                           TOPS, a young triceratops. Walk into her to get on. Left / right: trot (2.3 px a frame),
//                           Z: hop, X: HORNS (4 damage to everything up to 60 px ahead, eggs and cages too),
//                           Up + X: the hero shoots straight up from the saddle, C: CHARGE (45 frames at 4.4 px a
//                           frame: 8 damage to every robot in the way, boulder walls fall at once, nothing can hurt
//                           her meanwhile; then she needs 2.5 s), Down + Z: get off. Small robots under her feet are
//                           trampled while she moves. Four hits tire her out: she throws the hero off (unhurt), runs
//                           240 px ahead and waits there with two pips back (L8.topsRest says how far she may go;
//                           there L8.topsEnd turns her into a bystander). A hero who gets off and walks on does not
//                           lose her: as the screen leaves her behind she trots after him and waits ahead.
//   L8.newTops()            a fresh ride object; L8.parkTops(x, facing, ride) puts her down as a prop
// Looks: level8_friends.js. Everything is private to the block. rand() only in update code.
// =====================================================================================================================
{
const Math = globalThis.Math;
const SFX = L8.SFX;

// ---------------------------------------------------------------------------------------------------------------------
// Amber blocks
// ---------------------------------------------------------------------------------------------------------------------
function bitsFly(s, x, y, n, sp = 1) {
  for (let i = 0; i < n; i++) G.parts.push({ type: 'sprite', s, x: x + rand(-5, 5), y: y + rand(-5, 5), vx: rand(-2.2, 2.2) * sp, vy: rand(-3.6, -1.2) * sp, g: 0.2, rot: rand(0, 6.28), vr: rand(-0.4, 0.4), life: rand(36, 60) | 0, max: 60 });
}
PROP_TYPES.amber = {
  make(o) { o.hp = 2; },
  box: o => ({ x: o.x - 8, y: o.y - 16, w: 16, h: 16 }),
  hit(o, d) {
    if (!propHurt(o, d)) return;
    o.dead = true;
    bitsFly(M8.amberBits(), o.x, o.y - 8, 7); sparks(o.x, o.y - 8, 6, '#ffe88a');
    addScore(50, o.x, o.y - 16);
    if (o.item) dropItem(o.item, o.x, o.y - 10, 0);
    Snd.tone('triangle', 1400, 700, 0.12, 0.08); Snd.noise(0.1, 0.1, 5000);
  },
  draw: o => M8.amber(Math.round(o.x) - 8, Math.round(o.y) - 16, G.t)
};

// ---------------------------------------------------------------------------------------------------------------------
// Hatchlings
// ---------------------------------------------------------------------------------------------------------------------
const CALLS = ['RAWR! THANKS!', 'HONK! THANKS!', 'SQUEAK! THANKS!', 'TOOT! THANKS!'];
POW_KINDS.hatchling = {
  thanks: 'THANK YOU!',
  box: o => ({ x: o.x - 14, y: o.y - 26, w: 28, h: 26 }),
  draw(o) {
    const v = (o.v ?? o.id) & 3, x = Math.round(o.x), y = Math.round(o.y);
    if (o.state === 'tied') {
      M8.cage(x, y, 'back');
      M8.hatchling(x - 1, y - 3, 1, { v, pose: 'sit', t: o.t + o.id * 7 });
      M8.cage(x, y, 'front', o.t);
      if ((o.t + o.id * 40) % 240 < 70) M8.bubble(x, y - 34, 'HELP!', '#2a6a9a');
      return;
    }
    if (o.state === 'run') { M8.hatchling(x, y, -1, { v, pose: 'run', t: o.t }); return; }
    // free, salute: jumping for joy, a heart over its head
    const hop = Math.abs(Math.sin(o.t * 0.26)) * 7;
    M8.hatchling(x, y - hop, o.t % 32 < 16 ? 1 : -1, { v, pose: 'hop', t: o.t });
    if (o.state === 'salute') drawHeart(x - 4, y - 34 - (o.t - 24) * 0.2, 1, true);
  },
  onFree(o) {
    const v = (o.v ?? o.id) & 3;
    for (let i = G.texts.length - 1; i >= 0 && i >= G.texts.length - 3; i--) if (G.texts[i].s === 'THANK YOU!') { G.texts[i].s = CALLS[v]; break; }
    bitsFly(M8.cageBits(), o.x, o.y - 12, 5, 1.2); sparks(o.x, o.y - 14, 8, '#9dff4a');
    const f = [520, 300, 900, 420][v];
    Snd.tone('square', f, f * 1.6, 0.08, 0.08); Snd.tone('square', f * 1.2, f * 2, 0.1, 0.08, 0.1);
    if (L8.onFreed) L8.onFreed(o);
  },
  // away to the left in little bounces (it drops off a ledge by itself)
  run(o) {
    o.x -= 2;
    o.vy = (o.vy || 0) + 0.3; o.y += o.vy;
    const gy = groundAt(o.x);
    if (o.y >= gy) { o.y = gy; o.vy = -2.4; }
  }
};

// ---------------------------------------------------------------------------------------------------------------------
// DINO-RANG
// ---------------------------------------------------------------------------------------------------------------------
const RANG = M8.memo(() => {
  const { buf, capsule, put, outline, mk, rect } = M8.px, I = M8.I, out = [];
  for (let i = 0; i < 8; i++) {
    const b = buf(16, 16, 8, 8), a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    const P2 = (x, y) => [x * c - y * s, x * s + y * c];
    const e1 = P2(-5, 2.5), m = P2(0, -2), e2 = P2(5, 2.5);
    capsule(b, e1[0], e1[1], m[0], m[1], 1.5, 1.7, I('#f4ecd8')); capsule(b, m[0], m[1], e2[0], e2[1], 1.7, 1.5, I('#f4ecd8'));
    for (const e of [e1, e2]) { rect(b, Math.round(e[0]) - 1, Math.round(e[1]) - 1, 2, 2, I('#ffffff')); }
    put(b, m[0], m[1], I('#c8b890')); put(b, m[0] + c, m[1] + s, I('#c8b890'));
    outline(b);
    out.push(mk(b, false));
  }
  return out;
});
function rangUpdate(b) {
  const p = G.p, cam = G.cam.x;
  b.age++;
  if (!b.back) {
    b.vx *= 0.945; b.vy *= 0.945;
    if (b.age > 30 || b.x < cam + 6 || b.x > cam + W - 6 || b.y < 8) { b.back = true; b.hits = []; }
  } else {
    const tx = p.x, ty = p.y - 18 - (p.ride ? 16 : 0), dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
    b.sp = Math.min((b.sp || 0.4) + 0.32, 5.6);
    b.vx = dx / d * b.sp; b.vy = dy / d * b.sp;
    if (d < 9 || p.dead) { b.life = 0; if (!p.dead) Snd.tone('square', 880, 1320, 0.04, 0.05); return; }
  }
  b.life = Math.max(b.life, 2);                      // it only ends in the hero's hand (or off the screen)
  if (b.age % 5 === 0) Snd.tone('triangle', 500 + (b.age % 10) * 30, 420, 0.04, 0.02);
  for (const s of G.eb) if (s.life > 0 && (s.shoot || (EB_TYPES[s.k] && EB_TYPES[s.k].shootable)) && Math.hypot(s.x - b.x, s.y - b.y) < 10) { s.life = 0; boom(s.x, s.y, 0.4); }
}
function rangDraw(b) {
  const s = RANG()[(b.age >> 1) & 7], x = Math.round(b.x), y = Math.round(b.y);
  ctx.globalAlpha = 0.35; ctx.drawImage(RANG()[((b.age >> 1) + 7) & 7].img, Math.round(b.x - b.vx * 1.6) - 8, Math.round(b.y - b.vy * 1.6) - 8); ctx.globalAlpha = 1;
  ctx.drawImage(s.img, x - s.ox, y - s.oy);
}
WEAPONS.dinorang = {
  label: 'DINO-RANG', ammo: 30, maxAmmo: 60, cd: 18, tapCd: 8,
  muzzle: aim => aim === 'up' ? [4, -40] : aim === 'down' ? [1, -2] : [18, -19],
  fire(p, mx, my, dx, dy) {
    G.pb.push({
      x: mx, y: my, vx: dx * 7, vy: dy * 7, dmg: 2, life: 200, pierce: true, age: 0, back: false, rang: true,
      update: rangUpdate, draw: rangDraw,
      onHit(b, e) { if (damageEnemy(e, b.dmg)) sparks(b.x, b.y, 5, '#fff6dc'); },
      onGround(b) { b.y = groundAt(b.x) - 2; b.vy = -Math.abs(b.vy) * 0.6 - 0.6; if (!b.back) { b.back = true; b.hits = []; } return true; },
      onProp(b, o) { if (!(b.props || (b.props = [])).includes(o)) { b.props.push(o); hitProp(o, b.dmg, 'bullet'); } return true; },
      onPow(b, o) { freePow(o); return true; }
    });
    Snd.tone('triangle', 300, 900, 0.14, 0.09); Snd.noise(0.08, 0.05, 6000);
  },
  drawGun(aim, ty, r) {
    // the hand holds the bone by one end
    if (aim === 'fwd') { RO(6 - r, ty - 1, 8, 3, '#f4ecd8'); RO(12 - r, ty - 5, 3, 6, '#f4ecd8'); R(7 - r, ty - 1, 6, 1, '#ffffff'); }
    else if (aim === 'up') { RO(3, ty - 14, 3, 9, '#f4ecd8'); RO(3, ty - 16, 7, 3, '#f4ecd8'); }
    else { RO(3, ty + 9, 3, 9, '#f4ecd8'); RO(3, ty + 16, 7, 3, '#f4ecd8'); }
  },
  icon(x, y) { const s = RANG()[1]; ctx.drawImage(s.img, x + 9 - s.ox, y + 4 - s.oy); }
};
ITEMS.D = {
  draw: it => letterBox(it, '#e8dcc0', '#ffffff', '#a8521a'),
  collect(it, p) {
    giveWeapon(p, 'dinorang');
    G.texts.push({ x: it.x, y: it.y - 24, s: 'DINO-RANG!', t: 80, c: '#ffe066' });
    say('Dino rang!', 0.9, 1);
  }
};

// ---------------------------------------------------------------------------------------------------------------------
// TOPS
// ---------------------------------------------------------------------------------------------------------------------
const T_SPEED = 2.3, T_HOP = -4.7, T_G = 0.26, JAB_T = 14, JAB_CD = 20, JAB_REACH = [14, 60], CH_T = 45, CH_V = 4.4, CH_CD = 150, PIPS = 4;
const HELP = 'X: HORNS  C: CHARGE!  DOWN+Z: OFF';
let helped = false;
L8.newTops = () => ({ type: 'tops', pips: PIPS, jab: 0, jcd: 0, charge: 0, ccd: 0, hitT: 0, t: 0, hits: null, cheer: 0 });
// everything the horns reach: robots, props, cages, eggs in the air. z = the zone, dmg, once = a Set of what this
// charge has already hit (a jab hits everything once anyway)
function horns(p, r, z, dmg, once) {
  let any = false;
  for (const e of G.enemies) {
    if (!e.active || e.dead || offStage(e) || (once && once.has(e)) || !overlap(z, ebox(e))) continue;
    if (once) once.add(e);
    const b = ebox(e);
    if (damageEnemy(e, e.type === 'boulderwall' && once ? 99 : dmg)) { any = true; sparks(clamp(p.x + p.facing * 30, b.x, b.x + b.w), clamp(p.y - 20, b.y, b.y + b.h), 8, '#fff6dc'); }
  }
  for (const o of G.props) {
    const b = !o.dead && propBox(o);
    if (!b || (once && once.has(o)) || !overlap(z, b)) continue;
    if (once) once.add(o);
    hitProp(o, dmg, 'bullet'); any = true;
  }
  for (const o of G.pows) if (o.state === 'tied' && overlap(z, powBox(o))) { freePow(o); any = true; }
  for (const s of G.eb) if (s.life > 0 && (s.shoot || (EB_TYPES[s.k] && EB_TYPES[s.k].shootable)) && inBox(s.x, s.y, { x: z.x - 6, y: z.y - 6, w: z.w + 12, h: z.h + 12 })) { s.life = 0; boom(s.x, s.y, 0.4); any = true; }
  return any;
}
function getOff(p, r) {
  L8.parkTops(p.x, p.facing, r, false);
  exitRide(p, false);
  p.y -= 18;
  Snd.tone('square', 300, 150, 0.1, 0.06);
}
// four hits: she bucks the hero off and runs on ahead
function tired(p, r) {
  const o = { k: 'topsrun', x: p.x, y: groundAt(p.x), hitT: 0, dead: false, facing: 1, r, t: 0 };
  G.props.push(o);
  exitRide(p, true);
  p.y -= 18;
  G.texts.push({ x: p.x, y: p.y - 40, s: 'TOPS NEEDS A REST!', t: 90, c: '#ffb04a' });
  Snd.tone('sawtooth', 300, 120, 0.4, 0.1); Snd.tone('sawtooth', 240, 100, 0.3, 0.08, 0.2);
}
function bellow(d = 0) { Snd.tone('sawtooth', 150, 230, 0.18, 0.1, d); Snd.tone('square', 230, 170, 0.22, 0.07, d + 0.16); }
L8.bellow = bellow;
RIDES.tops = {
  help: HELP,
  update(p, r) {
    r.t++;
    if (r.jcd > 0) r.jcd--; if (r.ccd > 0) { if (--r.ccd === 0) Snd.tone('square', 660, 990, 0.08, 0.06); }
    if (r.hitT > 0) r.hitT--; if (p.fireCd > 0) p.fireCd--; if (p.muzzle > 0) p.muzzle--;
    p.crouch = false; p.onPlat = null; p.kb = 0;
    const L = ctl('left'), Rt = ctl('right'), U = ctl('up'), D = ctl('down');
    if (D && ctlTap('jump') && !r.charge) { getOff(p, r); return; }
    let mv = L && !Rt ? -1 : Rt && !L ? 1 : 0;
    if (r.charge > 0) {
      r.charge--; p.vx = p.facing * CH_V;
      p.inv = Math.max(p.inv, 2);                    // nothing hurts a charging triceratops
      const z = { x: p.facing > 0 ? p.x + 6 : p.x - 50, y: p.y - 44, w: 44, h: 44 };
      if (horns(p, r, z, 8, r.hits)) { G.shake = Math.max(G.shake, 4); Snd.noise(0.12, 0.2, 900); Snd.tone('square', 180, 70, 0.12, 0.12); }
      if (p.onGround && r.t % 3 === 0) dust(p.x - p.facing * 18, p.y, 2, -p.facing);
      if (r.charge === 0) { r.ccd = CH_CD; r.hits = null; }
    } else {
      if (mv) p.facing = mv;
      p.vx = mv * T_SPEED;
      if (ctlTap('bomb')) {
        if (r.ccd <= 0) { r.charge = CH_T; r.hits = new Set(); r.jab = 0; p.inv = Math.max(p.inv, 2); bellow(); Snd.noise(0.3, 0.12, 500); G.texts.push({ x: p.x, y: p.y - 58, s: 'CHARGE!', t: 40, c: '#ffe066' }); }
        else Snd.tone('square', 200, 150, 0.05, 0.05);
      }
    }
    // the screen's edges stop her (the camera follows on the right)
    if ((p.vx < 0 && p.x + p.vx < G.cam.x + 24) || (p.vx > 0 && p.x + p.vx > G.cam.x + W - 24)) p.vx = 0;
    if (L8.topsMay && !L8.topsMay(p, r)) return;      // the level may stop her (the hatchery gate)
    p.x += p.vx;
    const gy = groundAt(p.x);
    if (p.onGround) {
      if (ctlTap('jump') && !D) { p.vy = T_HOP; p.onGround = false; Snd.tone('square', 150, 320, 0.1, 0.06); dust(p.x, gy, 4); }
      else p.y = gy;
    }
    if (!p.onGround) {
      p.vy = Math.min(p.vy + T_G, 6); p.y += p.vy;
      if (p.y >= gy) { const hard = p.vy; p.y = gy; p.vy = 0; p.onGround = true; if (hard > 1.5) { dust(p.x - 12, gy, 4); dust(p.x + 12, gy, 4); G.shake = Math.max(G.shake, 1.5); Snd.noise(0.1, 0.14, 500); } }
    } else if (p.vx && r.t % 9 === 0) { dust(p.x - p.facing * 16, p.y, 1, -p.facing); if (r.t % 18 === 0) Snd.noise(0.04, 0.05, 700); }
    // little robots under her feet
    if (p.vx || !p.onGround) {
      const b = RIDES.tops.box(p, r);
      for (const e of G.enemies) if (e.active && !e.dead && e.type === 'compy' && overlap(b, ebox(e))) damageEnemy(e, 2);
    }
    // horns, or the hero's own gun straight up
    p.aim = U ? 'up' : 'fwd';
    if (r.charge <= 0) {
      if (U) {
        if (ctl('fire') && p.fireCd <= 0) {
          const fr = M8.topsFrame('idle:0'), x0 = p.x, y0 = p.y;
          p.x += fr.seat[0] * p.facing; p.y += fr.seat[1];
          try { shoot(p); } finally { p.x = x0; p.y = y0; }
        }
      } else if ((ctlTap('fire') || ctl('fire')) && r.jcd <= 0) { r.jab = JAB_T; r.jcd = JAB_CD; Snd.tone('triangle', 260, 520, 0.08, 0.08); Snd.noise(0.06, 0.06, 3000); }
    }
    if (r.jab > 0) {
      r.jab--;
      if (r.jab === JAB_T - 5) {
        const z = { x: p.facing > 0 ? p.x + JAB_REACH[0] : p.x - JAB_REACH[1], y: p.y - 38, w: JAB_REACH[1] - JAB_REACH[0], h: 38 };
        if (horns(p, r, z, 4, null)) { G.shake = Math.max(G.shake, 2); Snd.tone('square', 200, 90, 0.1, 0.1); }
      }
    }
  },
  box: p => ({ x: p.x - 20, y: p.y - 46, w: 40, h: 46 }),
  draw(p, r) {
    if (p.inv > 0 && !r.charge && r.hitT <= 0 && Math.floor(p.inv / 3) % 2) return;
    const pose = r.charge > 0 ? 'charge' : r.jab > 0 ? 'jab' : !p.onGround ? 'hop' : p.vx ? 'walk' : 'idle';
    const F = FLASH; FLASH = r.hitT > 6;
    M8.tops(p.x, p.y, p.facing, {
      pose, t: r.t, k: 1 - r.jab / JAB_T,
      rider(fr) { const f = FLASH; FLASH = false; drawHero(HEROES[G.hero], p.x + fr.seat[0] * p.facing, p.y + fr.seat[1], p.facing, { pose: 'idle', t: p.t, aim: p.aim, weapon: p.weapon, muzzle: p.muzzle }); FLASH = f; }
    });
    FLASH = F;
    if (r.charge > 0) {       // speed lines off the horns
      const x = Math.round(p.x), y = Math.round(p.y);
      for (let i = 0; i < 4; i++) R(x - p.facing * (26 + ((r.t * 7 + i * 13) % 26)) - (p.facing > 0 ? 8 : 0), y - 8 - i * 9, 8, 1, 'rgba(255,255,255,0.7)');
    }
  },
  hurt(p, r) {
    r.pips--; r.hitT = 10;
    G.shake = Math.max(G.shake, 3.5);
    sparks(p.x, p.y - 24, 8, '#ffb04a');
    Snd.hurt(); Snd.tone('sawtooth', 260, 140, 0.2, 0.08);
    if (r.pips <= 0) { tired(p, r); return; }
    p.inv = 80;
    if (r.pips === 1) G.texts.push({ x: p.x, y: p.y - 58, s: 'TOPS IS TIRED!', t: 70, c: '#ff8a5c' });
  },
  hud(r) {
    text('TOPS', 131, 8, '#ffb04a');
    for (let i = 0; i < PIPS; i++) {
      const x = 160 + i * 9, on = i < r.pips;
      if (i === r.pips && r.hitT > 0) RO(x, 8, 6, 6, '#ffffff');
      else { RO(x, 8, 6, 6, on ? (r.pips === 1 && G.t % 30 < 12 ? '#ffc2c2' : '#ff8a3a') : '#3a3a4a'); if (on) R(x, 8, 6, 1, '#ffd08a'); }
    }
    // the charge: a bar that fills, then C blinks
    const k = r.charge > 0 ? r.charge / CH_T : 1 - r.ccd / CH_CD, ready = r.ccd <= 0 && r.charge <= 0;
    text('C', 131, 20, ready && G.t % 24 < 12 ? '#ffffff' : '#ffe066');
    R(140, 21, 62, 5, '#2a2a3a'); R(140, 21, Math.round(62 * clamp(k, 0, 1)), 5, r.charge > 0 ? '#ffffff' : ready ? '#ffd23f' : '#a8742a');
    text(ready ? 'GO!' : '', 226, 20, '#ffe066', 1, 'right');
  }
};
// TOPS standing by herself: walk into her to get on
L8.parkTops = function (x, facing, r, armed = true) {
  const o = { k: 'tops', x, y: groundAt(x), hitT: 0, dead: false, facing: facing || 1, r: r || L8.newTops(), armed, t: 0 };
  o.r.jab = 0; o.r.charge = 0; o.r.hits = null; o.r.hitT = 0;
  G.props.push(o);
  return o;
};
PROP_TYPES.tops = {
  make(o) { o.r = o.r || L8.newTops(); o.armed = o.armed !== false; o.facing = o.facing || 1; o.t = 0; },
  box: () => null, hit() {},
  update(o) {
    o.t++; o.y = groundAt(o.x);
    const p = G.p, near = !p.dead && !p.ride && Math.abs(p.x - o.x) < 16 && Math.abs(p.y - o.y) < 34;
    // left behind (the hero got off and walked on): before the screen's left edge passes her (the engine drops a prop
    // 60 px beyond it) she trots after him and waits ahead, as she is. TOPS is never lost.
    if (!p.dead && !p.ride && o.x < G.cam.x - 26) {
      o.dead = true;
      G.props.push({ k: 'topsrun', x: o.x, y: o.y, hitT: 0, dead: false, facing: 1, r: o.r, t: 0, scared: true });
      bellow();
      return;
    }
    if (!o.armed) { if (!near) o.armed = true; return; }
    if (!near || G.intro || !boardRide(p, o.r)) return;
    o.dead = true;
    p.x = o.x; p.y = o.y; p.facing = o.facing; p.onGround = true;
    o.r.cheer = 30;
    bellow();
    if (!helped) { helped = true; G.texts.push({ x: o.x, y: o.y - 74, s: HELP, t: 220, c: '#ffffff' }); }
    G.texts.push({ x: o.x, y: o.y - 60, s: 'GO, TOPS!', t: 70, c: '#ffe066' });
  },
  draw(o) {
    const p = G.p, near = p && !p.ride && Math.abs(p.x - o.x) < 70;
    M8.tops(o.x, o.y, o.facing, { pose: near ? 'happy' : 'idle', t: o.t });
    if (o.armed && !FLASH && Math.floor(o.t / 20) % 2) { const x = Math.round(o.x) - 5, y = Math.round(o.y) - 52; R(x - 1, y, 3, 5, '#ffe066'); R(x - 3, y + 5, 7, 1, '#ffe066'); R(x - 2, y + 6, 5, 1, '#ffe066'); R(x - 1, y + 7, 3, 1, '#ffe066'); R(x, y + 8, 1, 1, '#ffe066'); }
  }
};
// tired (or o.scared: the Rex is behind her): she trots off to the right and waits 240 px ahead of the hero
PROP_TYPES.topsrun = {
  box: () => null, hit() {},
  update(o) {
    o.t++; o.x += 3.2; o.y = groundAt(o.x);
    if (o.t % 6 === 0) dust(o.x - 16, o.y, 1, -1);
    const limit = L8.topsRest ? L8.topsRest() : LV.end - 60;
    // she stops well ahead of the hero, where he can see her (but not where the level says no: the log bridge)
    if ((o.x < G.p.x + 240 || (L8.topsNo && L8.topsNo(o.x))) && o.x < limit) return;
    o.dead = true;
    if (!o.scared) o.r.pips = Math.max(o.r.pips, 2);      // tired: two pips back (scared off by the Rex: as she was)
    if (o.x >= limit && L8.topsEnd) L8.topsEnd(limit);    // the end of her road: she waits there, no ride any more
    else L8.parkTops(Math.min(o.x, limit), 1, o.r, true);
  },
  draw(o) { M8.tops(o.x, o.y, 1, { pose: 'walk', t: o.t * 2 }); }
};
// The cage the Oggles keep her in: 76 x 46. It opens when its lock says so (L8.cageOpen(): the level's call).
// It is a wall to a hero on foot, as it is to CLUBTAIL (her roll ends 62 px before its middle): nobody stands in
// front of it, where her roll would not reach.
PROP_TYPES.topscage = {
  make(o) { o.t = 0; },
  box: () => null, hit() {},
  update(o) {
    o.t++; o.y = groundAt(o.x);
    const p = G.p;
    if (p && !p.dead && !p.ride && p.x > o.x - 44 && p.x < o.x + 44) p.x = o.x - 44;
    if (!(L8.cageOpen && L8.cageOpen())) return;
    o.dead = true;
    const bar = M8.cageBits();
    for (let i = 0; i < 12; i++) G.parts.push({ type: 'sprite', s: bar, x: o.x - 34 + i * 6, y: o.y - 24, vx: rand(-2.6, 2.6), vy: rand(-5, -2), g: 0.2, rot: 0, vr: rand(-0.4, 0.4), life: 70, max: 70 });
    boom(o.x, o.y - 30, 0.8); sparks(o.x, o.y - 30, 12, '#9dff4a');
    G.texts.push({ x: o.x, y: o.y - 66, s: 'TOPS IS FREE!', t: 120, c: '#ffe066' });
    addScore(1000, o.x, o.y - 50);
    bellow(0.2); say('Tops is free!');
    L8.parkTops(o.x, 1, null, true);
  },
  draw(o) {
    const x = Math.round(o.x), y = Math.round(o.y), F = FLASH;
    ctx.fillStyle = 'rgba(16,22,34,0.4)'; ctx.fillRect(x - 36, y - 44, 72, 42);
    FLASH = false;
    M8.tops(x - 2, y - 3, 1, { pose: G.enemies.some(e => ENEMY_TYPES[e.type].boss && e.active) ? (Math.floor(o.t / 40) % 3 ? 'idle' : 'happy') : 'sad', t: o.t });
    RO(x - 38, y - 3, 76, 3, '#56606e'); R(x - 38, y - 3, 76, 1, '#c3cdd8');
    RO(x - 38, y - 47, 76, 4, '#56606e'); R(x - 38, y - 47, 76, 1, '#c3cdd8');
    for (let i = 0; i < 10; i++) { R(x - 36 + i * 8, y - 43, 1, 40, '#c3cdd8'); R(x - 35 + i * 8, y - 43, 1, 40, '#2a303a'); }
    RO(x - 5, y - 53, 10, 6, '#12502a'); R(x - 5, y - 53, 10, 1, '#2fae44'); R(x - 1, y - 51, 2, 2, Math.floor(o.t / 14) % 2 ? '#9dff4a' : '#2fae44');
    FLASH = F;
  }
};
// After the chase she waits by the hatchery gate (a prop that is not a ride)
PROP_TYPES.topswait = {
  make(o) { o.t = 0; },
  box: () => null, hit() {},
  update(o) { o.t++; o.y = groundAt(o.x); },
  draw(o) { M8.tops(o.x, o.y, o.facing || 1, { pose: Math.floor(o.t / 50) % 2 ? 'happy' : 'idle', t: o.t }); }
};
}
