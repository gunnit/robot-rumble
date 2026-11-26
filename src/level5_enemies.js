'use strict';
// =====================================================================================================================
// Mission 5 (ALIEN MOTHERSHIP) robots: the OGGLES. Owner: robots (docs/level5-spec.md section 3). Looks: level5_cast.js.
//
//   ENEMY_TYPES.oggle      the trooper (hp 3, 100). Walks up to 110-150 px from the hero, stops, aims, warns 40 frames
//                          (lamp, yellow eye, '!', glowing gun tip, a dotted green aim line) and fires ONE slow ring
//                          along the deck (jump it), then waits 150-200 frames. sniper: true = stays on its platform
//                          and fires down its dotted line at where the hero stood (step aside); after two shots, or
//                          150 frames with the hero below it, it hops down and is a trooper. helmet: true = glass bubble.
//   ENEMY_TYPES.roller     the roly eye (hp 2, 100), 18 px tall. Rolls up to within 120 px, hops on the spot with a '!'
//                          for 36 frames, dashes 150 px (only the dash hurts: jump it), skids and sits dizzy 40 frames.
//   ENEMY_TYPES.eyeflower  rooted turret of the STAR GARDEN (hp 4, 200). A shut bud (shots clank), then the bloom snaps
//                          open and warns 50 frames, spits ONE seed in a slow arc (a ring marks where it lands; it can
//                          be shot), stays open 60 frames, shuts for 90-140.
//   EB_TYPES.ogring        the ray-gun ring;   EB_TYPES.oseed   the flower's seed
//   POW_KINDS.podcow       a cow of Vigo Hills in a glass pod (o.v: 0 blond, 1 black-and-white, 2 a calf)
//   PROP_TYPES.ogwreck     (private) what a beaten robot leaves for a second: its cracked shell and the eye boinging
//                          on a spring. No box: nothing can hit it and it hurts nobody.
// Every type has grab (true / false) and, when true, cargoDraw(x, y, t, rot, e): the robot dangling (rot 0) or
// tumbling from the MINI UFO's beam, (x, y) = its middle; e (optional) = the grabbed robot, for its glass bubble.
//
// Tuning from the level data (spawn or wave fields, all optional): oggle { range: px, cd: frames before its first shot },
// roller { cd: frames before its first dash }, eyeflower { len: frames its first bud stays shut }. The timings are the
// constants at the head of each section (AIM_T, WARN_T, RING_V; R_WARN, R_DIZZY, R_ROLL, R_DASH; F_WARN, F_OPEN, F_RANGE).
//
// Rules every ground robot keeps (the test bot never dodges, never drops through a platform, and only walks toward a
// robot more than 24 px away): it stays on the screen once it is on it; nectar and the end of its platform are walls
// (a roly eye may roll OFF a platform); while the hero stands on another floor it never idles within 44 px of the
// hero's x but keeps well clear (so the hero comes down, or the bot walks off the platform's end); a roly eye never
// parks on the hero; a robot on a platform with the hero below it comes down.
// Everything is private to the block. rand() only in update code.
// =====================================================================================================================
{
const Math = globalThis.Math;
const PAL = M5.PAL;
const nectarAt = x => (typeof L5 !== 'undefined' && L5.nectarAt) ? L5.nectarAt(x) : null;
const lowG = x => typeof L5 !== 'undefined' && !!L5.lowG && L5.lowG(x);
const go = (e, s) => { e.state = s; e.st = 0; };
const onScr = (x, m = 0) => x > G.cam.x + m && x < G.cam.x + W - m;
const heroUp = () => { const p = G.p; return !!p && !p.dead && !p.hidden && !G.intro && G.winT <= 0; };

// ---------------------------------------------------------------------------------------------------------------------
// Sounds
// ---------------------------------------------------------------------------------------------------------------------
let clankAt = -99, beepAt = -99;
const SFX = {
  beep(k) { if (G.t - beepAt < 5) return; beepAt = G.t; Snd.tone('square', 760 + k * 170, 760 + k * 170, 0.05, 0.035); },
  zap() { Snd.tone('sawtooth', 980, 220, 0.2, 0.06); Snd.tone('square', 1500, 520, 0.1, 0.035); },
  ringPop() { Snd.tone('sine', 640, 180, 0.08, 0.04); },
  hop(k) { Snd.tone('square', 240 + k * 70, 420 + k * 70, 0.06, 0.04); },
  dash() { Snd.noise(0.3, 0.09, 3600); Snd.tone('sawtooth', 180, 620, 0.25, 0.045); },
  skid() { Snd.noise(0.22, 0.08, 6500); Snd.tone('square', 900, 300, 0.16, 0.03); },
  dizzy() { Snd.tone('sine', 900, 1300, 0.09, 0.03); Snd.tone('sine', 1300, 900, 0.09, 0.03, 0.1); },
  bloom() { Snd.tone('triangle', 280, 880, 0.09, 0.07); Snd.noise(0.06, 0.04, 5000); },
  spit() { Snd.tone('square', 520, 150, 0.12, 0.07); Snd.noise(0.1, 0.07, 2400); },
  seedPop() { Snd.tone('sine', 420, 140, 0.1, 0.05); Snd.noise(0.1, 0.05, 1800); },
  clank() { if (G.t - clankAt < 6) return; clankAt = G.t; Snd.clank(); },
  pop() { Snd.tone('square', 760, 180, 0.14, 0.08); Snd.noise(0.18, 0.12, 3000); },
  boing() { Snd.tone('sine', 300, 760, 0.12, 0.06); Snd.tone('sine', 520, 300, 0.16, 0.05, 0.1); },
  glass() { Snd.noise(0.25, 0.13, 7000); Snd.tone('sine', 1500, 700, 0.12, 0.05); Snd.tone('sine', 2100, 1100, 0.1, 0.035, 0.05); },
  moo(d = 0) { Snd.tone('sawtooth', 185, 139, 0.5, 0.1, d); Snd.tone('sawtooth', 139, 110, 0.35, 0.08, d + 0.3); }
};

// ---------------------------------------------------------------------------------------------------------------------
// Shared: the hero's floor, walls, falling, the nectar, landing rings, the burst
// ---------------------------------------------------------------------------------------------------------------------
// The floor the hero stands on: his feet when they were last on something (so a jump is not "another floor"); a ride's
// own height while he rides
let floorY = 232, floorT = -1;
function heroFloor() {
  const p = G.p;
  if (floorT !== G.t) { floorT = G.t; if (p.onGround || p.ride || Math.abs(p.y - floorY) > 140) floorY = p.y; }
  return floorY;
}
// What stops a ground robot going from e.x to nx (direction d): the level's ends; the screen's edges (a robot on the
// screen stays on it: nothing can be shot outside it and a camera lock could never end; the camera never comes back,
// so the left edge always counts); nectar; the end of its platform (rollOff: a roly eye may roll off one).
function wall(e, nx, d, rollOff) {
  const cam = G.cam.x;
  if (nx < 14 || nx > LV.end - 14) return 'end';
  if (d < 0 ? nx < cam + 14 : (nx > cam + W - 14 && e.x <= cam + W - 14)) return 'screen';
  const pl = e.onPlat;
  if (pl) return !rollOff && (nx < pl.x + 4 || nx > pl.x + pl.w - 4) ? 'edge' : null;
  if (e.onGround && nectarAt(nx + d * 10)) return 'nectar';
  return null;
}
function step(e, d, v, rollOff) {
  const nx = e.x + d * v, w = wall(e, nx, d, rollOff);
  if (!w) e.x = nx;
  return w;
}
// how far it could go in direction d before a wall (up to max)
function runway(e, d, max) {
  for (let s = 6; s <= max; s += 6) if (wall(e, e.x + d * s, d, false)) return s - 6;
  return max;
}
function fall(e) {
  const py = e.y;
  if (e.dropT > 0) e.dropT--;
  e.vy = Math.min(e.vy + 0.26, 6); e.y += e.vy;
  land(e, py);
}
function pinkDrops(x, y, n) {
  if (G.parts.length > 600) return;
  for (let i = 0; i < n; i++) G.parts.push({ type: 'spark', x: x + rand(-4, 4), y: y - 1, vx: rand(-1.2, 1.2), vy: rand(-2.4, -0.8), g: 0.16, life: rand(10, 18), max: 18, size: i % 3 ? 1 : 2, c: i % 2 ? '#ffe3f3' : '#ff7ab8' });
}
// A ground robot that ended up in the pond (it fell in) wades out to the nearer bank: true while it does
function wade(e) {
  if (e.onPlat || !e.onGround) return false;
  const n = nectarAt(e.x);
  if (!n || e.y <= n.y) return false;
  const d = e.x - n.x0 < n.x1 - e.x ? -1 : 1;
  e.x += d * 0.5; e.facing = d;
  if (e.t % 9 === 0) pinkDrops(e.x, n.y, 2);
  return true;
}
// a dashed ring lying on the floor at (x, y): red and yellow, blinking (faster when fast)
function landRing(x, y, r, fast) {
  x = Math.round(x); y = Math.round(y);
  const on = Math.floor(G.t / (fast ? 3 : 5)) % 2 === 0, n = 20;
  ctx.fillStyle = 'rgba(20,8,14,0.4)'; ctx.fillRect(x - Math.round(r * 0.6), y - 1, Math.round(r * 0.6) * 2 + 1, 2);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, px = Math.round(x + Math.cos(a) * r), py = Math.round(y - 1 + Math.sin(a) * r * 0.3);
    ctx.fillStyle = (i % 2 === 0) === on ? '#ff3b30' : '#ffe066';
    ctx.fillRect(px, py, 2, 1);
  }
}
// A beaten robot: the fireball, its pieces, the wreck with the eye on its spring, the score
function burstRobot(e, kind, pts, cx, cy, b) {
  boom(cx, cy, kind === 'roller' ? 0.6 : 0.75);
  M5.burst(kind, e.x, e.y, e.facing || 1, { helmet: e.helmet });
  if (e.x > G.cam.x - 40 && e.x < G.cam.x + W + 40) {
    const o = makeProp({ k: 'ogwreck', x: e.x, y: e.y, kind, f: e.facing || 1 });
    if (o) G.props.push(o);
    SFX.pop(); SFX.boing();
  }
  addScore(pts, cx, b.y - 16);
}
const WRECK_T = 90;
PROP_TYPES.ogwreck = {
  make(o) { o.a = 0; o.vy = 0; o.onGround = false; o.onPlat = null; },
  box: () => null,
  hit() {},
  update(o) {
    if (!o.onGround) { const py = o.y; o.vy = Math.min(o.vy + 0.26, 6); o.y += o.vy; land(o, py); }     // burst in mid-air: it drops
    if (++o.a >= WRECK_T) o.dead = true;
  },
  draw(o) {
    if (o.a > WRECK_T - 24 && Math.floor(o.a / 3) % 2) return;       // blinks out
    FLASH = false;
    M5.wreck(o.x, o.y, o.f, { kind: o.kind, a: Math.max(0, o.a - 6) });        // the eye pops as the fireball clears
  }
};

// ---------------------------------------------------------------------------------------------------------------------
// OGGLE: the trooper (and the sniper on its platform)
// ---------------------------------------------------------------------------------------------------------------------
const AIM_T = 14, WARN_T = 40, SHOT_T = 12, RING_V = 1.9;
let lastAim = -999;      // G.t when an oggle last began to aim: they take turns, so rings never come in a clump
// lock the shot: level along the deck for a trooper (also under a hero who flies the MINI UFO); the sniper fires down
// its dotted line at where the hero is now
function lockAim(e) {
  const p = G.p;
  e.aimA = 0; e.hug = !e.onPlat;
  const ty = (p.ride ? p.y - 12 : p.onGround ? p.y - 6 : Math.min(heroFloor(), groundAt(p.x)) - 6);
  if (!e.sniper || Math.abs(ty + 6 - e.y) < 14) return;
  e.aimA = clamp(Math.atan2(ty - (e.y - 13), Math.max(8, Math.abs(p.x - e.x) - 5)), -0.78, 1.3);
  e.hug = false;
}
function fireRing(e) {
  const a = e.aimA, m = M5.oggleMuzzle(a), x = e.x + e.facing * m[0], y = e.y + m[1];
  G.eb.push({ k: 'ogring', x, y: a ? y : e.y - 12, vx: e.facing * Math.cos(a) * RING_V, vy: Math.sin(a) * RING_V, life: 300, hug: e.hug, t: 0 });
  for (let i = 0; i < 5; i++) G.parts.push({ type: 'spark', x, y, vx: e.facing * rand(0.4, 2.2), vy: rand(-1.2, 1.2), g: 0.04, life: rand(8, 16), max: 16, size: 1, c: i % 2 ? PAL.BEAML : PAL.BEAM });
  if (onScr(e.x, -20)) SFX.zap();
}
// a way down for an oggle on a platform: a clear spot on the deck to one side (toward a far hero, away from a near
// one), or false
function hopDown(e, close) {
  const p = G.p, cam = G.cam.x, side = (p.x < e.x ? 1 : -1) * (Math.abs(p.x - e.x) > 120 ? -1 : 1);
  for (const d of [46, -46, 62, -62, 78, -78, 30, -30]) {
    const x = e.x + d * side;
    if (x < cam + 20 || x > cam + W - 20 || x < 20 || x > LV.end - 20) continue;
    if (Math.abs(x - p.x) < (close ? 20 : 36)) continue;
    if (nectarAt(x) || nectarAt(x - 12) || nectarAt(x + 12)) continue;
    const gy = groundAt(x);
    if (gy < e.y + 8) continue;
    if (LV.plats.some(pl => pl !== e.onPlat && x > pl.x - 8 && x < pl.x + pl.w + 8 && pl.y > e.y + 2 && pl.y < gy)) continue;   // not onto a step on the way
    e.hop = { x0: e.x, y0: e.y, x1: x, y1: gy, T: Math.round(28 + (gy - e.y) * 0.2), A: 13 };
    e.facing = d * side < 0 ? -1 : 1;
    go(e, 'squat');
    return true;
  }
  return false;
}
function updOggle(e) {
  const p = G.p, cam = G.cam.x;
  e.st++;
  if (e.cd > 0) e.cd--;
  const dx = p.x - e.x, adx = Math.abs(dx), dir = dx < 0 ? -1 : 1, up = heroUp();
  const lvl = heroFloor() - e.y, other = !p.ride && Math.abs(lvl) > 30;       // the hero on foot on another floor
  const st = e.state, busy = st === 'aim' || st === 'warn' || st === 'shoot' || st === 'squat' || st === 'hop' || st === 'landed';
  e.walk = false;
  // on a platform with the hero below it: it will not sit up there for ever
  if (e.onPlat && up && lvl > 16 && adx < 70) e.below++; else if (e.below > 0 && e.t % 3 === 0) e.below--;
  if (e.soft && st !== 'enter' && (adx > 26 || Math.abs(p.y - e.y) > 40)) e.soft = false;
  if (!busy && e.onGround && wade(e)) { e.walk = true; fall(e); return; }
  const canFire = up && e.cd <= 0 && e.onGround && onScr(e.x, 18) && onScr(p.x) && G.t - lastAim >= 45;
  switch (st) {
    case 'enter': {      // a wave oggle walks on screen first
      const into = e.x < cam + W / 2 ? 1 : -1;
      e.facing = into; e.x += into * 0.9; e.walk = true;
      if (e.x > cam + 28 && e.x < cam + W - 28) go(e, 'walk');
      break;
    }
    case 'post': {       // the sniper on its platform
      e.facing = dir;
      if (!e.onPlat) { e.sniper = false; go(e, 'walk'); break; }             // its platform is gone: a trooper now
      if ((e.shots >= 2 && e.cd < 110) || e.below >= 150) { if (hopDown(e, e.below > 300)) break; }
      if (canFire && adx > 24 && adx < 230) { lastAim = G.t; go(e, 'aim'); }
      break;
    }
    case 'walk': {
      e.facing = dir;
      if (e.onPlat && e.below >= 150 && hopDown(e, e.below > 300)) break;
      let want = 0, stuck = false;
      if (other && adx < 44) want = e.flee || (e.flee = dx === 0 ? 1 : -dir);        // never idle under (or over) the hero
      else if (e.soft && adx < 34) want = -dir;                                      // it walked in on top of the hero: it backs off
      else {
        e.flee = 0;
        if (adx > e.range + 8) want = dir;                                           // up to its range
        else if (other && adx < 66) want = -dir;                                     // well clear while the hero is on another floor
      }
      if (want && e.onGround) {
        const w = step(e, want, want === dir ? 0.6 : 0.5);
        if (w) { stuck = true; if (e.flee) e.flee = -e.flee; } else e.walk = true;
      }
      if (canFire && !other && adx > 30 && adx < 215 && (!want || stuck) && Math.abs(p.y - e.y) < 70 + (p.ride ? 200 : 0)) { lastAim = G.t; go(e, 'aim'); }
      break;
    }
    case 'aim':          // stops and raises the gun
      e.facing = dir;
      if (e.st >= AIM_T) { lockAim(e); go(e, 'warn'); }
      break;
    case 'warn':         // the tell: lamp, yellow eye, '!', the glowing tip and the dotted line (the aim is locked)
      if ((e.st === 1 || e.st === 14 || e.st === 27) && onScr(e.x, -10)) SFX.beep(Math.floor(e.st / 13));
      if (e.st >= WARN_T) { if (up) fireRing(e); go(e, 'shoot'); }
      break;
    case 'shoot':
      if (e.st >= SHOT_T) { e.shots++; e.cd = Math.round(rand(150, 200)); go(e, e.sniper && e.onPlat ? 'post' : 'walk'); }
      break;
    case 'squat':        // about to hop down
      if (e.st >= 12) { go(e, 'hop'); SFX.hop(1); dust(e.x, e.y, 3); }
      break;
    case 'hop': {
      const h = e.hop, u = Math.min(1, e.st / h.T);
      e.x = h.x0 + (h.x1 - h.x0) * u;
      e.y = h.y0 + (h.y1 - h.y0) * u * u - 4 * h.A * u * (1 - u);
      if (e.st >= h.T) {
        e.x = h.x1; e.y = groundAt(h.x1); e.vy = 0; e.onGround = true; e.onPlat = null; e.sniper = false; e.below = 0;
        dust(e.x, e.y, 5); Snd.tone('sine', 300, 110, 0.08, 0.06);
        go(e, 'landed');
      }
      return;
    }
    case 'landed':
      if (e.st >= 9) { e.cd = Math.max(e.cd, 50); go(e, 'walk'); }
      break;
  }
  // troopers standing in one spot spread out a little
  if (e.state === 'walk' && e.onGround && !e.onPlat) {
    for (const o of G.enemies) {
      if (o === e || o.type !== 'oggle' || !o.active || o.dead || o.state !== 'walk' || o.onPlat || Math.abs(o.x - e.x) > 16) continue;
      step(e, e.x < o.x || (e.x === o.x && e.t % 2) ? -1 : 1, 0.3);
    }
  }
  fall(e);
}
// the dotted green aim line (marching toward the target), and for a slanted shot the ring where it meets the deck
function aimLine(e) {
  const a = e.aimA, m = M5.oggleMuzzle(a), f = e.facing, ux = f * Math.cos(a), uy = Math.sin(a);
  const x0 = e.x + f * m[0], y0 = e.y + m[1], cam = G.cam.x, ph = (e.st >> 1) % 8;
  let end = null;
  for (let i = 6 + ph; i < 330; i += 8) {
    const x = x0 + ux * i, y = y0 + uy * i;
    if (x < cam - 4 || x > cam + W + 4 || y < 0) break;
    if (a && y >= groundAt(x) - 2) { end = [x, groundAt(x)]; break; }
    ctx.fillStyle = OUT; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 5, 4);
    ctx.fillStyle = PAL.BEAM; ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 2);
    ctx.fillStyle = PAL.BEAML; ctx.fillRect(Math.round(x) - 1, Math.round(y), (i - ph) % 16 < 8 ? 3 : 1, 1);
  }
  if (end) { landRing(end[0], end[1], 9, e.st > WARN_T - 14); M5.bang(end[0], end[1] - 40, e.t); }
}
function drawOggle(e) {
  if (e.x < G.cam.x - 60 || e.x > G.cam.x + W + 60) return;
  const st = e.state, aiming = st === 'aim' || st === 'warn' || st === 'shoot';
  let pose = st === 'aim' ? 'aim' : st === 'warn' ? 'warn' : st === 'shoot' ? 'shoot' : st === 'squat' || st === 'landed' ? 'land' : st === 'hop' ? 'jump' : e.walk ? 'walk' : st === 'post' ? 'aim' : 'idle';
  if (e.hitT > 0 && (pose === 'walk' || pose === 'idle')) pose = 'hit';
  if (st === 'warn') aimLine(e);
  const a = st === 'aim' ? 0 : aiming ? e.aimA : 0;
  const look = st === 'hop' || st === 'squat' ? [e.facing * 0.6, 0.8] : aiming && a ? [e.facing * Math.cos(a), Math.sin(a)] : null;
  FLASH = e.hitT > 0;
  M5.oggle(e.x, e.y, e.facing, { pose, t: e.t, aim: a, helmet: e.helmet, look });
  FLASH = false;
}
ENEMY_TYPES.oggle = {
  hp: 3, melee: true, grab: true, edge: 18,
  // its touch hurts, but never: while it hops down or walks on screen; a wave oggle until it has once stood clear of
  // the hero (it may walk in right where the hero stands); through the floor of its platform (a hero jumping up under it)
  contact: e => (e.state === 'squat' || e.state === 'hop' || e.state === 'enter' || e.soft || (e.onPlat && !G.p.ride && G.p.y > e.y + 6) ? 'none' : 'hurt'),
  make(e, s) {
    Object.assign(e, { state: s.side != null ? 'enter' : 'walk', st: 0, sniper: false, helmet: !!s.helmet, walk: false, onGround: true, onPlat: null, dropT: 0,
      range: s.range || Math.round(rand(110, 150)), cd: s.cd != null ? s.cd : Math.round(rand(20, 60)), shots: 0, below: 0, flee: 0, aimA: 0, hug: true, hop: null, soft: s.side != null });
    if (s.sniper) {
      // a sniper stands on the platform it was placed on (within 4 px of its top)
      const pl = LV.plats.find(q => Math.abs(q.y - e.y) < 4 && e.x >= q.x - 2 && e.x <= q.x + q.w + 2);
      if (pl) { e.sniper = true; e.onPlat = pl; e.y = pl.y; e.x = clamp(e.x, pl.x + 6, pl.x + pl.w - 6); e.state = 'post'; if (s.cd == null) e.cd = Math.round(rand(40, 80)); }
    }
  },
  update: updOggle, draw: drawOggle,
  box: e => ({ x: e.x - 10, y: e.y - 27, w: 20, h: 27 }),
  cargoDraw(x, y, t, rot, e) { M5.cargo('oggle', x, y, t, rot, { helmet: !!(e && e.helmet) }); },
  onKill(e, cx, cy, b) { burstRobot(e, 'oggle', 100, cx, cy, b); }
};
// The ring: 5 px, 1.9 px a frame. A trooper's glides along the deck line 10 px up (over the nectar gaps and up the
// ramps too): jump it. A sniper's flies straight down its dotted line and pops on the deck.
EB_TYPES.ogring = {
  r: 5,
  update(b) {
    b.t = (b.t || 0) + 1;
    if (b.hug) {
      const x = b.x + b.vx, n = nectarAt(x), gy = n ? n.y - 8 : groundAt(x);
      b.y += clamp(gy - 10 - b.y, -0.7, 0.7);
    }
  },
  draw(b) { M5.ring(b.x, b.y, { dir: b.vx < 0 ? -1 : 1, t: b.t || 0 }); },
  onGround(b) { sparks(b.x, groundAt(b.x) - 2, 5, PAL.BEAM); G.rings.push({ x: b.x, y: groundAt(b.x) - 2, r: 9, t: 0, max: 8 }); if (onScr(b.x)) SFX.ringPop(); },
  onHit(b) { sparks(b.x, b.y, 6, PAL.BEAML); G.parts.push({ type: 'flash', x: b.x, y: b.y, life: 4, max: 4, size: 8 }); }
};

// ---------------------------------------------------------------------------------------------------------------------
// ROLLER: the roly eye
// ---------------------------------------------------------------------------------------------------------------------
const R_WARN = 36, R_DIZZY = 40, R_ROLL = 0.9, R_DASH = 3.2;
function updRoller(e) {
  const p = G.p, cam = G.cam.x;
  e.st++;
  if (e.cd > 0) e.cd--;
  const dx = p.x - e.x, adx = Math.abs(dx), dir = dx < 0 ? -1 : 1, up = heroUp();
  const lvl = heroFloor() - e.y, other = !p.ride && Math.abs(lvl) > 30;
  let mv = 0, off = false;
  e.hopY = 0;
  if (e.onGround && (e.state === 'roll' || e.state === 'dizzy') && wade(e)) { e.rot += e.facing * 0.06; fall(e); return; }
  switch (e.state) {
    case 'enter': {      // a wave roly eye rolls on screen first
      const into = e.x < cam + W / 2 ? 1 : -1;
      e.facing = into; e.x += into * 1.3; e.rot += into * 0.14;
      if (onScr(e.x, 26)) go(e, 'roll');
      fall(e);
      return;
    }
    case 'roll': {
      if (!e.onGround) break;                                                // dropped (by a saucer): falling
      e.facing = dir;
      if (e.onPlat) {                                                        // off the end of a platform and down
        if (!e.pd || (adx >= 8 && !e.pdT)) e.pd = adx >= 8 ? dir : e.dir;      // toward the hero; right over him: straight on
        if (e.pdT > 0) e.pdT--;
        mv = e.pd * R_ROLL; off = true; e.dir = e.pd;
        break;
      }
      e.pd = 0;
      if (p.ride) {      // the hero flies: it rolls along underneath and hops at the MINI UFO (it can't reach)
        if (adx > 18) mv = dir * R_ROLL;
        else e.hopY = Math.abs(Math.sin(e.t / 9)) * 7;
        break;
      }
      if (other) {       // the hero on another floor: it keeps clear and waits, rocking
        if (adx < 44) mv = (e.flee || (e.flee = dx === 0 ? 1 : -dir)) * R_ROLL;
        else { e.flee = 0; mv = adx < 74 ? -dir * R_ROLL : adx > 130 ? dir * R_ROLL : Math.cos(e.t / 9) * 0.4; }
        break;
      }
      const can = up && e.cd <= 0 && runway(e, dir, 60) >= 36;               // room for a dash at the hero
      if (adx < 30 && !can) { mv = (e.flee || (e.flee = dx === 0 ? 1 : -dir)) * R_ROLL; break; }   // never parks on the hero
      e.flee = 0;
      if (adx > 120 || !onScr(e.x, 16)) mv = dir * R_ROLL;
      else if (can) { e.dir = dir; go(e, 'warn'); }
      else mv = Math.cos(e.t / 9) * 0.4;                                     // waiting: it rocks to and fro
      break;
    }
    case 'warn': {       // the tell: it hops on the spot, sparks fly, '!' (higher, slower hops out on the hull)
      const T = lowG(e.x) ? 18 : 12, k = Math.floor((e.st - 1) / T);
      e.hopY = Math.abs(Math.sin((e.st - 1) / T * Math.PI)) * (lowG(e.x) ? 9 : 5);
      if ((e.st - 1) % T === 0 && onScr(e.x, -10)) { SFX.hop(k); dust(e.x, e.y, 2); }
      if (e.st >= R_WARN) { e.dist = 150; go(e, 'dash'); if (onScr(e.x, -10)) SFX.dash(); }
      break;
    }
    case 'dash': {       // only this hurts
      e.facing = e.dir;
      if (!e.onGround) { mv = e.dir * R_DASH; break; }
      if (wall(e, e.x + e.dir * R_DASH, e.dir, false)) { e.spd = 0; go(e, 'skid'); dust(e.x + e.dir * 8, e.y, 5, e.dir); if (onScr(e.x, -10)) SFX.skid(); break; }
      mv = e.dir * R_DASH; e.dist -= R_DASH;
      if (e.st % 4 === 0) dust(e.x - e.dir * 8, e.y, 1, -e.dir);
      if (e.dist <= 13) { e.spd = R_DASH; go(e, 'skid'); if (onScr(e.x, -10)) SFX.skid(); }
      break;
    }
    case 'skid':
      e.spd *= 0.8; mv = e.dir * e.spd;
      if (e.st % 3 === 0 && e.spd > 0.4) dust(e.x + e.dir * 8, e.y, 1, e.dir);
      if (e.st >= 12) { go(e, 'dizzy'); e.flee = 0; if (onScr(e.x, -10)) SFX.dizzy(); }
      break;
    case 'dizzy':        // sits and sees stars; if that is on top of the hero it wobbles off first
      if (!other && adx < 24) mv = (e.flee || (e.flee = dx === 0 ? -e.dir : -dir)) * 0.7;
      if (e.st >= R_DIZZY) { e.cd = 30; go(e, 'roll'); }
      break;
  }
  if (mv && e.onGround) {
    const d = mv < 0 ? -1 : 1;
    if (step(e, d, Math.abs(mv), off)) { mv = 0; if (e.flee) e.flee = -e.flee; if (off) { e.pd = -d; e.pdT = 240; } }   // (a platform that ends off screen: the other end)
  } else if (mv) e.x += mv;                                                  // in the air: carried on
  e.rot += mv / 9;
  fall(e);
}
function drawRoller(e) {
  if (e.x < G.cam.x - 40 || e.x > G.cam.x + W + 40) return;
  const st = e.state;
  let pose = st === 'warn' ? 'warn' : st === 'dash' ? 'dash' : st === 'skid' ? 'skid' : st === 'dizzy' ? 'dizzy' : 'idle';
  if (e.hitT > 0 && pose === 'idle') pose = 'hit';
  FLASH = e.hitT > 0;
  M5.roller(e.x, e.y, e.facing, { pose, t: e.t, rot: e.rot * e.facing, hop: e.hopY || (st === 'warn' ? 0 : null), look: st === 'dash' || st === 'skid' ? [e.dir, 0.1] : null });
  FLASH = false;
}
ENEMY_TYPES.roller = {
  hp: 2, grab: true, edge: 14,
  contact: e => (e.state === 'dash' || (e.state === 'skid' && e.spd > 1.3) ? 'hurt' : 'none'),
  make(e, s) { Object.assign(e, { state: s.side != null ? 'enter' : 'roll', st: 0, rot: hsh(e.x * 0.37) * 6, dir: -1, dist: 0, spd: 0, cd: s.cd != null ? s.cd : Math.round(rand(10, 40)), flee: 0, hopY: 0, pd: 0, pdT: 0, onGround: s.y == null, onPlat: null, dropT: 0 }); },
  update: updRoller, draw: drawRoller,
  box: e => ({ x: e.x - 9, y: e.y - 18, w: 18, h: 18 }),
  cargoDraw(x, y, t, rot) { M5.cargo('roller', x, y, t, rot); },
  onKill(e, cx, cy, b) { burstRobot(e, 'roller', 100, cx, cy, b); }
};

// ---------------------------------------------------------------------------------------------------------------------
// EYE FLOWER (STAR GARDEN only, never in a wave): rooted
// ---------------------------------------------------------------------------------------------------------------------
const F_WARN = 50, F_OPEN = 60, F_SPIT = 12, F_SNAP = 8, F_RANGE = 250;
const flowerBox = e => (e.state === 'shut' ? { x: e.x - 9, y: e.y - 40, w: 18, h: 40 } : { x: e.x - 12, y: e.y - 48, w: 24, h: 48 });
// a spot for a flower at or near x: not in (or at the very edge of) the nectar, not on a cow's pod
function flowerSpot(x) {
  const ok = c => c > 24 && c < LV.end - 24 && !nectarAt(c) && !nectarAt(c - 14) && !nectarAt(c + 14) && !G.pows.some(o => o.state === 'tied' && Math.abs(o.x - c) < 34);
  for (const d of [0, 36, -36, 48, -48, 60, -60, 72, -72]) if (ok(x + d)) return x + d;
  return x;
}
function spitSeed(e) {
  const p = G.p, cam = G.cam.x, H = M5.FLOWER_HEAD, x0 = e.x + e.facing * (H.x + 5), y0 = e.y + H.y;
  const tx = clamp(clamp(p.x, e.x - F_RANGE, e.x + F_RANGE), cam + 10, cam + W - 10), n = nectarAt(tx);
  const ty = p.onGround && !p.ride && Math.abs(p.x - tx) < 2 ? (n ? Math.min(p.y, n.y) : p.y) : n ? n.y : groundAt(tx);
  const T = Math.round(clamp(64 + Math.abs(tx - x0) * 0.22, 70, 116)), g = 0.07;
  G.eb.push({ k: 'oseed', x: x0, y: y0, vx: (tx - x0) / T, vy: (ty - y0 - g * T * (T - 1) / 2) / T, g, life: T + 80, tx, ty, t: 0, T });
  for (let i = 0; i < 4; i++) G.parts.push({ type: 'spark', x: x0, y: y0, vx: e.facing * rand(0.3, 1.6), vy: rand(-1.6, 0.2), g: 0.06, life: 12, max: 12, size: 1, c: i % 2 ? PAL.BEAML : PAL.AMBL });
  SFX.spit();
}
function updFlower(e) {
  const p = G.p;
  e.st++;
  if (!e.seen) { e.seen = true; e.x = flowerSpot(e.x); e.y = groundAt(e.x); }
  if (e.clank > 0) e.clank--;
  const dx = p.x - e.x, near = heroUp() && Math.abs(dx) < F_RANGE && onScr(e.x, -6);
  switch (e.state) {
    case 'shut': {       // the armoured bud: shots clank off it
      e.inv = true;
      const b = flowerBox(e);
      for (const s of G.pb) if (inBox(s.x + s.vx, s.y + s.vy, b)) { e.clank = 8; SFX.clank(); }
      if (e.st >= e.len && near) { e.facing = dx < 0 ? -1 : 1; e.inv = false; go(e, 'bloom'); SFX.bloom(); }
      break;
    }
    case 'bloom':        // the tell: the bloom snaps open, the lamp blinks, the eye turns yellow, '!'
      if (e.st === 18 || e.st === 34) SFX.beep(e.st > 20 ? 2 : 1);
      if (e.st >= F_WARN) { if (near) spitSeed(e); go(e, 'spit'); }
      break;
    case 'spit': if (e.st >= F_SPIT) go(e, 'open'); break;
    case 'open': if (e.st >= F_OPEN - F_SPIT) go(e, 'close'); break;
    case 'close': if (e.st >= F_SNAP) { e.inv = true; e.len = Math.round(rand(90, 140)); go(e, 'shut'); } break;
  }
}
function drawFlower(e) {
  if (e.x < G.cam.x - 50 || e.x > G.cam.x + W + 50) return;
  const st = e.state;
  FLASH = e.hitT > 0;
  if (st === 'shut') M5.flower(e.x, e.y, e.facing, { pose: 'shut', t: e.t, shake: e.clank > 0 ? 1 : 0, z: e.clank <= 0 });
  else if (st === 'bloom') M5.flower(e.x, e.y, e.facing, { pose: e.st < F_SNAP ? 'open' : 'warn', k: e.st / F_SNAP, t: e.t });
  else if (st === 'close') M5.flower(e.x, e.y, e.facing, { pose: 'open', k: 1 - e.st / F_SNAP, t: e.t });
  else M5.flower(e.x, e.y, e.facing, { pose: st === 'spit' ? 'spit' : e.hitT > 0 ? 'hit' : 'open', t: e.t });
  FLASH = false;
}
ENEMY_TYPES.eyeflower = {
  hp: 4, grab: false, contact: 'none',
  make(e, s) { Object.assign(e, { state: 'shut', st: 0, len: s.len != null ? s.len : Math.round(rand(30, 80)), inv: true, clank: 0, seen: false }); },
  update: updFlower, draw: drawFlower, box: flowerBox,
  onKill(e, cx, cy, b) { burstRobot(e, 'flower', 200, cx, cy, b); }
};
// The seed: a slow arc to where the hero stood when it was spat (a ring marks the spot from the start). 5 px; it can be
// shot down; it only hurts by touching, the pop on the deck is harmless.
function seedPop(x, y) {
  const n = nectarAt(x);
  if (n && y >= n.y - 1) pinkDrops(x, n.y, 6);
  else if (G.parts.length < 620) for (let i = 0; i < 7; i++) G.parts.push({ type: 'spark', x, y: y - 2, vx: rand(-1.8, 1.8), vy: rand(-2.6, -0.6), g: 0.14, life: rand(12, 22), max: 22, size: i % 3 ? 1 : 2, c: i % 2 ? PAL.BEAML : PAL.BEAM });
  G.parts.push({ type: 'dust', x, y: y - 3, vx: 0, vy: -0.3, life: 18, max: 26, size: 3 });
  if (onScr(x)) SFX.seedPop();
}
EB_TYPES.oseed = {
  r: 5, shootable: true,
  update(b) {
    b.t++;
    b.r = b.t < 16 ? -1 : 5;           // harmless while it leaves the bloom (a hero right beside the flower)
    if (b.vy > 0 && b.y + b.vy >= b.ty) { b.life = 0; seedPop(b.tx, b.ty); }
  },
  draw(b) {
    const left = b.T - b.t;
    landRing(b.tx, b.ty, 8 + clamp(left / b.T, 0, 1) * 5, left < 30);
    M5.bang(b.tx, b.ty - 42, G.t);
    const x = Math.round(b.x), y = Math.round(b.y);
    for (let i = 1; i <= 3; i++) { ctx.fillStyle = 'rgba(157,255,74,' + (0.5 - i * 0.13).toFixed(2) + ')'; ctx.fillRect(Math.round(x - b.vx * i * 3), Math.round(y - b.vy * i * 3), 2, 2); }
    M5.seed(x, y, b.t);
  },
  onHit(b) { seedPop(b.x, b.y); },
  onGround(b) { seedPop(b.x, groundAt(b.x)); }
};

// ---------------------------------------------------------------------------------------------------------------------
// The rescue: a cow of Vigo Hills in a glass pod (box 32 x 48). Freed: the glass pops, the cow hops out, does a happy
// jump and gallops off left (it swims the nectar gaps). ('cow' is Mission 2's caged cow: this kind is 'podcow'.)
// The engine does not move a freed POW until it runs, and a kind has no update: the hop out is drawn from o.t (frames
// since it was freed), 22 px to the left of the pod, and the gallop keeps that offset.
// ---------------------------------------------------------------------------------------------------------------------
const COW_OFF = 22;
// a galloping cow's feet at x: the deck; in a nectar gap it swims across, a little under the surface
function cowY(x, v) {
  const n = nectarAt(x), gy = groundAt(x);
  return n ? Math.min(gy, n.y + (v === 2 ? 5 : 7)) : gy;
}
POW_KINDS.podcow = {
  thanks: 'MOO! THANK YOU!',
  box: o => ({ x: o.x - 16, y: o.y - 48, w: 32, h: 48 }),
  onFree(o) {
    o.podX = o.x; o.podY = o.y;
    M5.burst('pod', o.x, o.y, 1);
    SFX.glass(); SFX.moo(0.12);
  },
  draw(o) {
    const v = o.v || 0;
    if (o.state === 'tied') {
      const t = o.t + o.id * 37, p = G.p, close = !!p && !p.dead && Math.abs(p.x - o.x) < 80;
      M5.pod(o.x, o.y, { id: o.id, v, facing: p && p.x > o.x ? 1 : -1 });
      if (close) M5.bubble(o.x, o.y - 54 + (Math.floor(t / 6) % 2), 'MOO!');
      else if (Math.floor(t / 40) % 2 === 0) M5.bubble(o.x, o.y - 54 + (Math.floor(t / 10) % 2), Math.floor(t / 80) % 2 ? 'MOO!' : 'HELP!');
      return;
    }
    const t = o.t, px = o.podX ?? o.x, py = o.podY ?? o.y;
    M5.pod(px, py, { id: o.id, broken: t });
    if (o.state === 'free') {              // out of the pod in one hop
      const u = Math.min(1, t / 24);
      M5.cow(o.x - COW_OFF * u, o.y - 15 * (1 - u) - Math.sin(u * Math.PI) * 13, -1, { v, pose: 'leap' });
    } else if (o.state === 'salute') {     // the happy jump: two hops with a MOO!, and a heart
      const u = clamp((t - 24) / 40, 0, 1), hop = Math.abs(Math.sin(u * Math.PI * 2)) * 10, x = o.x - COW_OFF;
      M5.cow(x, o.y - hop, u < 0.5 ? 1 : -1, { v, pose: hop > 2.5 ? 'happy' : 'stand', moo: true });
      const hy = Math.round(o.y - 30 - u * 10);
      if (u > 0.1) drawHeart(Math.round(x) - 4, hy, 1, true);
    } else {                               // gallops off left
      const x = o.x - COW_OFF, y = cowY(x, v), n = nectarAt(x), swim = !!n && y > n.y + 2;
      M5.cow(x, y - (swim ? (t >> 3) & 1 : (t >> 2) & 1), -1, swim ? { v, float: true } : { v, run: t });
      if (swim) {                          // its wake on the pink surface
        const sx = Math.round(x), sy = Math.round(n.y);
        ctx.fillStyle = '#ffe3f3'; ctx.fillRect(sx - 15 - ((t >> 2) % 3), sy, 4, 1); ctx.fillRect(sx + 9 + ((t >> 3) % 2), sy, 5, 1); ctx.fillRect(sx + 16 + ((t >> 2) % 4), sy + 1, 3, 1);
        ctx.fillStyle = '#ff7ab8'; ctx.fillRect(sx - 11, sy + 1, 22, 1); ctx.fillRect(sx - 13, sy - 1 - ((t >> 2) % 2), 1, 1); ctx.fillRect(sx + 20 + ((t >> 2) % 5), sy, 2, 1);
      }
    }
  }
};
}
