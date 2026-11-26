'use strict';
// ============================================================
// Mission 4 robots: BEHAVIOUR (their looks are in level4_cast.js; the MEGA OCTOPUS is in level4_boss.js).
// Exports: ENEMY_TYPES.roboctopus / roboray / robojelly / robocuttle (INK CAPTAIN mini-boss) and the three new robots
// robopuffer / robocrab / roboeel; EB_TYPES.oceanBolt / oceanInk / pufferSpike / crabShell (their draws come from
// level4_cast.js; the plain ones here are only a fallback). Shared with the looks through L4: L4.gun(e) (where a shot
// leaves), L4.dashPath(e) (the ray's real dash path), L4.crabGun(e) (the crab's shoulder and muzzle), and the fields
// e.face (-1/1), e.state, e.timer, e.tellT (the tell's length: progress = 1 - timer / tellT).
// Every attack warns first (the looks draw it: '!' or a word, the robot's own part lighting up, dotted lines along the
// exact path) and leaves a way out:
//   octopus  48 f: periscope blinks, nozzle glows, arms curl; one ink blob from its O-mouth to where the diver was.
//   ray      48 f: jets glow, dotted line along its dash; dashes along that line (only the dash hurts by touch).
//   jelly    48 f: bell lights up, ZAP!, six dotted rays; six slow energy pearls fly out along them.
//   captain  48 f: tanks bubble, cap pops up, INK!, three dotted lines; three inks from its funnel; then it moves.
//   puffer   60 f: puffs up into a spiky ball, eight dotted rays; eight slow spikes (shootable) fly out along them.
//   crab     54 f: plants its legs, claw swings up, dotted line + ring on the spot it locked; one slow shell there.
//   eel      54 f: eyes light up in the pipe end, a red lane with '!'; lunges 120 px along the lane (only the lunge
//            hurts), stays out to be shot, slides back. Hidden it can't be hurt; shooting the pipe pokes it out.
// Robots burst into bubbles, sparks and plates. No Math.random()/rand() here except the engine's own effects.
// ============================================================
var L4 = L4 || {};
{
const Math = globalThis.Math;
const TAU = Math.PI * 2;
const cy = p => p.y - 14;
const busy = () => G.intro || G.p.dead || G.winT;
const TELL = 48;
// first warning this long after a robot wakes up (it used to be ~1.6 s: robots died before ever attacking)
const FIRST = 60;

// ---------- shared with the looks ----------
// where a robot's shot leaves: the octopus's O-mouth, the captain's ink funnel, the middle of the jelly's bell
L4.gun = function (e) {
  const f = e.face || -1;
  if (e.type === 'roboctopus') return { x: e.x + f * 5, y: e.y - 10 };
  if (e.type === 'robocuttle') return { x: e.x + f * 26, y: e.y - 3 };
  return { x: e.x, y: e.y - 16 };
};
// the ray's dash from where it is now with the velocity it locked at the start of its tell: 70 frames at most, it
// stops at the screen edges (same rules as its update); points are its body centre (x, y - 14)
L4.dashPath = function (e) {
  const out = [];
  if (e.dvx == null) return out;
  let x = e.x, y = e.y;
  for (let i = 0; i < 70; i++) {
    x += e.dvx; y = clamp(y + e.dvy, 72, groundAt(x) - 15); out.push([x, y - 14]);
    if (x < G.cam.x + 38 || x > G.cam.x + W - 38) break;
  }
  return out;
};
// the crab's cannon: shoulder (pivot of the claw) and muzzle, from its facing and claw angle e.aim (0 = forward, up < 0)
const CRAB_REACH = 27;
L4.crabGun = function (e) {
  const f = e.face || -1, sx = e.x + f * 13, sy = e.y - 15 + (e.state === 'tell' || e.state === 'recoil' ? 2 : 0), a = e.aim || 0;
  return { sx, sy, mx: sx + Math.cos(a) * CRAB_REACH * f, my: sy + Math.sin(a) * CRAB_REACH };
};
function crabWant(e) { const g = L4.crabGun(e); return clamp(Math.atan2(e.ty - g.sy, (e.tx - g.sx) * e.face), -2.0, 0); }
L4.crabWant = crabWant;

// ---------- helpers ----------
function shoot(e, tx, ty, kind, speed) {
  const g = L4.gun(e), a = Math.atan2(ty - g.y, tx - g.x);
  // ink blobs can't be popped (swim above or below them: the dotted line shows where they go); pearls can
  G.eb.push({ k: kind, x: g.x, y: g.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 250, r: kind === 'oceanInk' ? 7 : 4, shoot: kind !== 'oceanInk' });
}
// stay in the right part of the screen and bob (the captain keeps further in: it is bigger)
function moveInside(e, margin) {
  const tx = G.cam.x + W - margin;
  if (e.x > tx) e.x = Math.max(tx, e.x - 1.4);
  else if (e.x < G.cam.x + 45) e.x = Math.min(G.cam.x + 45, e.x + 1.4);
  else e.x += Math.sin(e.t * 0.014 + e.homeX) * 0.22;
  e.y = clamp(e.baseY + Math.sin(e.t * 0.025) * 9, 82, groundAt(e.x) - 22);
}
// turn to the diver (not while it gets ready: the warning stays where it was shown)
function faceHero(e) { const d = G.p.x - e.x; if (Math.abs(d) > 10) e.face = d < 0 ? -1 : 1; }
function burst(cx, cy2, col) { L4.bubbles(cx, cy2, 16); sparks(cx, cy2, 8, '#ffe066'); debris(cx, cy2, 6, col); L4SND.play('robopop', { fb: () => Snd.clank() }); }
// a stand-in look (level4_cast.js replaces every draw)
function plain(e) { FLASH = e.hitT > 0; const b = ENEMY_TYPES[e.type].box(e); RO(Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h), MET); R(Math.round(e.x) - 3, Math.round(b.y) + 4, 3, 2, EVIL); FLASH = false; }

// ---------- the four robots of the first build (same behaviour, new boxes, shots from their nozzles) ----------
function generic(kind, hp, margin, box, score, col) {
  return {
    hp, flying: true, armored: true,
    contact: e => (e.state === 'dash' ? 'hurt' : 'none'),
    make(e, s) { e.homeX = s.x; e.baseY = s.y ?? (95 + hsh(s.x) * 110); e.y = e.baseY; e.state = 'idle'; e.timer = FIRST; e.face = -1; e.tellT = TELL; },
    box,
    update(e) {
      if (e.state === 'dash') {
        e.x += e.vx; e.y = clamp(e.y + e.vy, 72, groundAt(e.x) - 15);
        if (--e.timer <= 0 || e.x < G.cam.x + 38 || e.x > G.cam.x + W - 38) { e.state = 'idle'; e.timer = 95; e.baseY = e.y; }
        return;
      }
      moveInside(e, margin);
      if (e.state !== 'tell') faceHero(e);
      if (busy()) return;
      if (--e.timer > 0) return;
      if (e.state === 'idle') {
        e.state = 'tell'; e.timer = TELL; e.tellT = TELL; e.targetX = G.p.x; e.targetY = cy(G.p);
        if (kind === 'ray') {
          const a = Math.atan2(e.targetY - (e.y - 12), e.targetX - e.x);
          e.dvx = Math.cos(a) * 2.6; e.dvy = Math.sin(a) * 1.7; e.face = e.dvx < 0 ? -1 : 1;
        } else e.face = e.targetX < e.x ? -1 : 1;
        return;
      }
      e.state = 'idle'; e.timer = kind === 'jelly' ? 150 : 120;
      if (kind === 'ray') { e.vx = e.dvx; e.vy = e.dvy; e.timer = 70; e.state = 'dash'; L4SND.play('whoosh', { vol: 0.6, rate: 1.3 }); }
      else if (kind === 'jelly') {
        const g = L4.gun(e); L4SND.play('zap');
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6; G.eb.push({ k: 'oceanBolt', x: g.x, y: g.y, vx: Math.cos(a) * 1.15, vy: Math.sin(a) * 1.15, r: 4, life: 170, shoot: true }); }
      } else if (kind === 'cuttle') {
        L4SND.play('ink', { rate: 0.8 });
        for (const dy of [-28, 0, 28]) shoot(e, e.targetX, e.targetY + dy, 'oceanInk', 1.25);
        e.baseY = clamp(e.targetY + 35, 90, 205);
      } else { L4SND.play('ink'); shoot(e, e.targetX, e.targetY, 'oceanInk', 1.35); }
    },
    draw: plain,
    onKill(e, cx, cy2) { burst(cx, cy2, col); addScore(score, e.x, e.y - 30); }
  };
}
// boxes match the new drawings (body centre = e.x, e.y - 14)
ENEMY_TYPES.roboctopus = generic('octopus', 7, 65, e => ({ x: e.x - 17, y: e.y - 33, w: 34, h: 36 }), 150, '#ec5038');
ENEMY_TYPES.roboray = generic('ray', 6, 65, e => ({ x: e.x - 27, y: e.y - 34, w: 54, h: 40 }), 150, '#a9b5c2');
ENEMY_TYPES.robojelly = generic('jelly', 6, 65, e => ({ x: e.x - 16, y: e.y - 34, w: 32, h: 40 }), 150, '#ffd34a');
ENEMY_TYPES.robocuttle = { ...generic('cuttle', 55, 90, e => ({ x: e.x - 34, y: e.y - 38, w: 68, h: 40 }), 1800, '#a468e2'), boss: true, bossName: 'INK CAPTAIN' };

// ---------- NEW: ROBO PUFFER ----------
// drifts like the others; every ~2.3 s puffs up into a spiky ball (60 f), shoots 8 slow spikes outward, stays big a
// moment and deflates. Contact never hurts.
const PUFF_TELL = 60;
ENEMY_TYPES.robopuffer = {
  hp: 6, flying: true, armored: true, contact: 'none',
  make(e, s) { e.homeX = s.x; e.baseY = s.y ?? (100 + hsh(s.x) * 90); e.y = e.baseY; e.state = 'idle'; e.timer = FIRST; e.puff = 0; e.face = -1; e.tellT = PUFF_TELL; },
  box(e) { const rx = 12 + e.puff * 8, ry = 10 + e.puff * 10; return { x: e.x - rx, y: e.y - 14 - ry, w: rx * 2, h: ry * 2 }; },
  update(e) {
    moveInside(e, 80);
    if (e.state !== 'tell') faceHero(e);
    if (e.state === 'idle') {
      e.puff = Math.max(0, e.puff - 0.02);
      if (busy()) return;
      if (--e.timer <= 0) { e.state = 'tell'; e.timer = PUFF_TELL; e.tellT = PUFF_TELL; L4SND.play('puff', { fb: () => Snd.tone('sine', 300, 700, 0.5, 0.05) }); }
    } else if (e.state === 'tell') {
      const k = 1 - e.timer / PUFF_TELL; e.puff = k * k * (3 - 2 * k);
      if (--e.timer <= 0) {
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8, c = Math.cos(a), s = Math.sin(a); G.eb.push({ k: 'pufferSpike', x: e.x + c * 18, y: e.y - 14 + s * 18, vx: c * 1.35, vy: s * 1.35, r: 3, life: 200, shoot: true }); }
        e.state = 'pop'; e.timer = 40; Snd.tone('square', 900, 300, 0.12, 0.07); L4.bubbles(e.x, e.y - 14, 10);
      }
    } else if (e.state === 'pop') { e.puff = 1; if (--e.timer <= 0) { e.state = 'idle'; e.timer = 140; } }
  },
  draw: plain,
  onKill(e, cx, cy2) { burst(cx, cy2, '#ff9a30'); addScore(200, cx, cy2 - 18); }
};

// ---------- NEW: ROBO CRAB ----------
// walks sideways on the seabed keeping ~105 px from the diver; then plants its legs and aims its cannon claw at the spot
// where the diver was (54 f), fires one slow shell there. Hit it from low down. Contact never hurts.
const CRAB_TELL = 54;
ENEMY_TYPES.robocrab = {
  hp: 7, armored: true, contact: 'none', activateMargin: 40,
  make(e) { e.y = groundAt(e.x); e.state = 'walk'; e.timer = FIRST + Math.round(hsh(e.x) * 30); e.aim = -0.45; e.face = -1; e.walk = 0; e.tellT = CRAB_TELL; },
  box: e => ({ x: e.x - 19, y: e.y - 32, w: 38, h: 32 }),
  update(e) {
    const p = G.p;
    e.y = groundAt(e.x);
    if (e.state === 'walk') {
      faceHero(e);
      const want = clamp(p.x + (e.x > p.x ? 105 : -105), G.cam.x + 40, G.cam.x + W - 40), d = want - e.x;
      if (Math.abs(d) > 4) { e.x += Math.sign(d) * 0.65; e.walk++; }
      e.aim += (-0.45 - e.aim) * 0.1;
      if (busy()) return;
      if (--e.timer <= 0 && e.x > G.cam.x + 24 && e.x < G.cam.x + W - 24) {
        e.state = 'tell'; e.timer = CRAB_TELL; e.tellT = CRAB_TELL; e.tx = p.x; e.ty = cy(p); e.face = e.tx < e.x ? -1 : 1;
        Snd.tone('square', 600, 900, 0.06, 0.04);
      }
    } else if (e.state === 'tell') {
      e.aim += (crabWant(e) - e.aim) * 0.12;
      if (--e.timer <= 0) {
        const g = L4.crabGun(e), L = Math.hypot(e.tx - g.mx, e.ty - g.my) || 1;
        G.eb.push({ k: 'crabShell', x: g.mx, y: g.my, vx: (e.tx - g.mx) / L * 2.1, vy: (e.ty - g.my) / L * 2.1, r: 4, life: 240, shoot: true });
        e.state = 'recoil'; e.timer = 22; L4SND.play('crab', { fb: () => Snd.tone('triangle', 220, 90, 0.15, 0.1) }); L4.bubbles(g.mx, g.my, 6);
      }
    } else if (e.state === 'recoil') { if (--e.timer <= 0) { e.state = 'walk'; e.timer = 120; } }
  },
  draw: plain,
  onKill(e, cx, cy2) { burst(cx, cy2, '#ffd23a'); addScore(200, cx, cy2 - 18); }
};

// ---------- NEW: ROBO EEL ----------
// lives in a T-pipe standing on the seabed (spawn y = the pipe's mouth height, default seabed - 34). When the diver is
// level with the mouth and within 175 px (or shoots the pipe), it peeks out on the diver's side (54 f), lunges 120 px,
// stays out 50 f (it can be shot then), slides back and rests 90 f. Hidden it can't be hurt. Only the lunge hurts.
// Stationary: a spawn, never a lock wave.
const EEL_TELL = 54, EEL_REACH = 120;
const eelBox = e => {
  if (e.ext < 4) return { x: e.x - 21, y: e.y - 9, w: 42, h: 18 };
  const x0 = e.x + e.dir * 18, x1 = e.x + e.dir * (20 + e.ext);
  return { x: Math.min(x0, x1), y: e.y - 9, w: Math.abs(x1 - x0), h: 18 };
};
ENEMY_TYPES.roboeel = {
  hp: 6, armored: true, activateMargin: 20,
  contact: e => (e.state === 'lunge' ? 'hurt' : 'none'),
  make(e, s) { e.gy = groundAt(e.x); e.y = s.y ?? e.gy - 34; e.state = 'hide'; e.timer = 60; e.ext = 0; e.dir = -1; e.inv = true; e.tellT = EEL_TELL; },
  box: eelBox,
  update(e) {
    const p = G.p, near = Math.abs(p.x - e.x) < 175 && Math.abs(cy(p) - e.y) < 30;
    if (e.state === 'hide') {
      e.inv = true; e.ext = 0;
      // a bubble shot clanking on the pipe pokes it out too (it still gives the whole warning)
      const b0 = eelBox(e), poked = G.pb.some(b => b.x + b.vx > b0.x && b.x + b.vx < b0.x + b0.w && b.y > b0.y && b.y < b0.y + b0.h);
      if (e.timer > 0) e.timer--;
      else if ((near || poked) && !busy()) { e.state = 'peek'; e.timer = EEL_TELL; e.dir = p.x < e.x ? -1 : 1; e.inv = false; L4SND.play('eel', { fb: () => Snd.tone('square', 180, 160, 0.2, 0.05) }); }
    } else if (e.state === 'peek') { e.ext = e.timer < 14 ? 6 : 0; if (--e.timer <= 0) { e.state = 'lunge'; e.timer = 14; Snd.noise(0.2, 0.08, 3000); } }
    else if (e.state === 'lunge') { const q = 1 - e.timer / 14; e.ext = EEL_REACH * (1 - (1 - q) * (1 - q)); if (--e.timer <= 0) { e.state = 'hold'; e.timer = 50; } }
    else if (e.state === 'hold') { e.ext = EEL_REACH; if (--e.timer <= 0) { e.state = 'back'; e.timer = 30; } }
    else if (e.state === 'back') { e.ext = EEL_REACH * (e.timer / 30); if (--e.timer <= 0) { e.state = 'hide'; e.timer = 90; } }
  },
  draw: plain,
  onKill(e, cx, cy2) { burst(cx, cy2, '#4cc65e'); addScore(250, cx, cy2 - 18); }
};

// ---------- shots (draws in level4_cast.js) ----------
EB_TYPES.oceanBolt = { r: 4, draw(b) { ctx.fillStyle = '#f9df7e'; circ(Math.round(b.x), Math.round(b.y), 4); }, update(b) { if (b.y < 45) b.life = 0; } };
EB_TYPES.oceanInk = { r: 7, draw(b) { ctx.fillStyle = '#806cae'; circ(Math.round(b.x), Math.round(b.y), 6); }, update(b) { if (b.y < 44) b.life = 0; }, onHit(b) { L4.bubbles(b.x, b.y, 6); } };
EB_TYPES.pufferSpike = { r: 3, shootable: true, draw(b) { R(b.x - 2, b.y - 1, 4, 2, '#e2e9ef'); }, update(b) { if (b.y < 46) b.life = 0; }, onHit(b) { L4.bubbles(b.x, b.y, 4); } };
EB_TYPES.crabShell = {
  r: 4, shootable: true, draw(b) { R(b.x - 2, b.y - 2, 4, 4, '#ff6a2e'); },
  update(b) { if (b.y < 46) b.life = 0; if ((G.t & 3) === 0) G.parts.push({ x: b.x - b.vx * 3, y: b.y - b.vy * 3, vx: 0, vy: -0.4, life: 18, max: 18, size: 1, c: '#b8faff' }); },
  onHit(b) { L4.bubbles(b.x, b.y, 6); }
};
}
