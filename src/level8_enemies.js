'use strict';
var L8 = L8 || {};
// =====================================================================================================================
// Mission 8 (DINOSAUR VALLEY) robots: how the robot dinosaurs behave. Looks: level8_cast.js.
//
//   ENEMY_TYPES.compy       hp 1, 50 points, 13 px tall. Runs at the hero in packs, crouches 30 frames (yellow eye,
//                           '!': half a second, time enough for a child to duck and fire or to jump), hops. Only
//                           the hop hurts. A standing shot flies over it: crouch, or let the knife do it.
//   ENEMY_TYPES.raptor      hp 3, 150. Runs up to about 100 px, crouches 36 frames (yellow eye, '!'), then pounces at
//                           where the hero stood when it crouched: a ring marks that spot from the first '!' to
//                           the landing (36 frames of crouching and 33 of flight), and only there does the pounce
//                           hurt. Step out of the ring, back or on under the raptor as it flies: either way is
//                           safe (the body in the air does not hurt, what comes down on the ring does). It skids,
//                           backs off for 80-120 frames, again. Its first pounce takes 54 frames of crouching (it
//                           sizes the hero up). ambush: true = it waits in a bush until the hero is near.
//   The rule for both: no hit without its yellow eye first. A robot that runs in at the screen's edge, where a hero
//   waits for the next wave, cannot hurt him by running into him.
//   Every small robot (compy, raptor, spitter, ptero; in the hatchery Mission 5's troopers too): when a giant comes
//   (WARNING!), one that is not part of the giant's lock clears off for good, harmless from that moment (scram).
//   ENEMY_TYPES.ptero       flies, hp 2, 200. mode 'bomb' (default): flies over with ONE egg, shows a ring where it
//                           will land (near the hero, never exactly on him every time) at least 30 frames before
//                           the drop; the egg can be shot; it turns at the screen's edge and fetches another.
//                           It flies too high for a shot from a jump: shoot straight up as it passes overhead (a
//                           pistol held down lands one or two hits a pass). After its third pass over the screen
//                           (spec passes: n) it flies home, whether its egg fell or not (a hero who walks along
//                           under it leaves it no room to warn of an egg, so eggs cannot be what is counted):
//                           16 seconds after it came it is gone, and no lock waits for it longer than that.
//                           mode 'swoop': hovers 150 px away, low (its y in the level data: about 55 px above
//                           the ground, where a shot fired from a jump reaches it), shows its dotted path for 48
//                           frames, dives and skims the ground at chest height past the hero. Ducking does NOT
//                           help: shoot it down while it hovers (jump and shoot), shoot it as it comes (a standing
//                           shot hits it) or jump over it. Then it sits on the ground out of breath for 90 frames
//                           (harmless, easy to hit) before it takes off again.
//   ENEMY_TYPES.spitter     hp 4, 200. Keeps 150-190 px away, opens its frill for 40 frames, spits ONE glowing blob in
//                           a high arc (over a jumping hero's head) at where the hero stands: a ring shows the spot
//                           for the 70 frames of its flight (step aside). It rests 110-150 frames.
//   ENEMY_TYPES.robonest    hp 8, 300, armoured, solid. A robot egg hatches into a compy every 210 frames (the egg
//                           rocks for 30 first), two alive at most, until the nest is destroyed.
//   ENEMY_TYPES.boulderwall hp 8, 100, solid and too tall to jump: shoot it, bomb it, or ram it with TOPS.
//   EB_TYPES.dinoegg, EB_TYPES.spitgoo
//
// Tuning from the level data (spawn or wave fields, all optional): compy / raptor { cd: frames before the first attack },
// raptor { ambush }, ptero { y, mode, cd, passes }, spitter { range, cd }, robonest { cd }.
// Rules every ground robot keeps (the test bot never dodges and only walks toward a robot more than 24 px away): it
// comes onto the screen by itself and stays on it once it is on it, and it never stops on top of the hero.
// Everything is private to the block. rand() only in update code.
// =====================================================================================================================
{
const Math = globalThis.Math;
const go = (e, s) => { e.state = s; e.st = 0; };
const heroUp = () => { const p = G.p; return !!p && !p.dead && !p.hidden && !G.intro && G.winT <= 0; };
const down = (e, cx, cy) => { if (L8.robotDown) L8.robotDown(e, cx, cy); };

let beepAt = -99;
const SFX = {
  beep(k = 0) { if (G.t - beepAt < 5) return; beepAt = G.t; Snd.tone('square', 700 + k * 160, 700 + k * 160, 0.05, 0.035); },
  screech() { Snd.tone('sawtooth', 1200, 500, 0.18, 0.05); Snd.tone('square', 900, 1500, 0.1, 0.03, 0.05); },
  hop() { Snd.tone('square', 360, 620, 0.06, 0.04); },
  pounce() { Snd.tone('sawtooth', 300, 900, 0.16, 0.06); Snd.noise(0.12, 0.06, 3000); },
  skid() { Snd.noise(0.2, 0.07, 6000); },
  drop() { Snd.tone('sine', 900, 300, 0.2, 0.05); },
  splat() { Snd.noise(0.14, 0.1, 1800); Snd.tone('sine', 300, 120, 0.1, 0.05); },
  frill() { Snd.noise(0.1, 0.05, 5000); Snd.tone('triangle', 260, 520, 0.12, 0.05); },
  spit() { Snd.tone('square', 520, 150, 0.12, 0.07); Snd.noise(0.1, 0.07, 2400); },
  dive() { Snd.tone('sawtooth', 1400, 300, 0.4, 0.05); },
  hatch() { Snd.tone('square', 500, 900, 0.07, 0.05); Snd.noise(0.08, 0.06, 4000); },
  rock() { Snd.noise(0.3, 0.2, 700); Snd.tone('sine', 110, 50, 0.2, 0.15); },
  pop() { Snd.tone('square', 760, 180, 0.14, 0.08); Snd.noise(0.18, 0.12, 3000); }
};
L8.SFX = SFX;

// ---------------------------------------------------------------------------------------------------------------------
// Shared: walking, the screen's edges, falling
// ---------------------------------------------------------------------------------------------------------------------
// A ground robot that has been on the screen stays on it (nothing can be shot outside it, and a camera lock could
// never end); the level's ends are walls too. Returns false when it could not move.
function step(e, d, v) {
  if (L8.sticky && L8.sticky(e.x)) v *= 0.5;            // tar
  const cam = G.cam.x, nx = e.x + d * v;
  if (nx < 14 || nx > LV.end - 14) return false;
  if (d < 0 ? nx < cam + 12 : nx > cam + W - 12) return false;
  e.x = nx;
  return true;
}
// outside the screen: which way is in (0 = it is on the screen). Every walking robot comes in before anything else,
// or a camera lock could wait for ever for a robot nobody can see.
const wayIn = e => e.x > G.cam.x + W - 18 ? -1 : e.x < G.cam.x + 18 ? 1 : 0;
function fall(e) {
  const py = e.y;
  e.vy = Math.min(e.vy + 0.26, 6); e.y += e.vy;
  land(e, py);
}
const mark = (e, dy) => M8.bang(e.x, e.y - dy);
function drawRobot(fn, e, o) {
  FLASH = e.hitT > 0;
  const fr = fn(e.x, e.y, e.facing, o);
  FLASH = false;
  return fr;
}
// A giant is coming (WARNING!, or the boss of a lock is on the screen): a small robot that is not part of that lock
// clears off, harmless from that moment. Walking ones run off the nearer end of the screen at v px a frame (scram:
// true while the robot is on its way out, its update does nothing else then); flying ones climb away (the ptero's own
// 'away'). A giant's arena holds the giant and what it calls, nothing else.
const giantHere = () => G.warnT > 0 || G.enemies.some(o => o.lock && o.active && !o.dead && ENEMY_TYPES[o.type].boss);
function scram(e, v) {
  if (!e.gone) {
    if (e.lock || !giantHere()) return false;
    e.gone = e.x < G.cam.x + W / 2 ? -1 : 1; e.vx = 0;
    SFX.screech();
  }
  e.facing = e.gone; e.x += e.gone * v; e.st++;
  fall(e);
  if (e.onGround && e.t % 6 === 0) dust(e.x, e.y, 1, -e.gone);
  if (e.x < G.cam.x - 24 || e.x > G.cam.x + W + 24) e.dead = true;
  return true;
}
L8.scram = scram;

// ---------------------------------------------------------------------------------------------------------------------
// COMPY
// ---------------------------------------------------------------------------------------------------------------------
const C_RUN = 1.9, C_TELL = 30, C_NEAR = 44;
ENEMY_TYPES.compy = {
  hp: 1, melee: true, activateMargin: 20,
  contact: e => e.state === 'leap' && !e.born ? 'hurt' : 'none',   // only its hop hurts (just hatched: not even that)
  make(e, s) { e.state = 'run'; e.st = 0; e.cd = s.cd ?? Math.round(rand(10, 50)); e.onGround = true; e.nest = s.nest || null; if (s.vy) { e.vy = s.vy; e.vx = s.vx || 0; e.onGround = false; e.state = 'leap'; e.born = true; } },
  update(e) {
    if (scram(e, 3)) { e.state = 'run'; return; }
    const p = G.p, dx = p.x - e.x, d = dx < 0 ? -1 : 1, inn = wayIn(e);
    e.st++; if (e.cd > 0) e.cd--;
    if (e.state === 'run') {
      e.facing = inn || d;
      // run in; once near, hop when ready, else dart to and fro so it never parks on the hero
      if (inn) step(e, inn, C_RUN);
      else if (Math.abs(dx) > C_NEAR) step(e, d, C_RUN);
      else if (e.cd <= 0 && heroUp() && e.onGround) { go(e, 'crouch'); SFX.beep(2); }
      else if (Math.abs(dx) < 28) step(e, -d, C_RUN * 0.8);
      fall(e);
    } else if (e.state === 'crouch') {
      fall(e);
      if (e.st >= C_TELL) { go(e, 'leap'); e.vy = -3.5; e.vx = e.facing * 2.5; e.onGround = false; SFX.hop(); }
    } else {
      const py = e.y;
      if (e.vx) step(e, Math.sign(e.vx), Math.abs(e.vx));
      e.vy = Math.min(e.vy + 0.26, 6); e.y += e.vy; land(e, py);
      if (e.onGround) { go(e, 'run'); e.vx = 0; e.born = false; e.cd = Math.round(rand(50, 90)); dust(e.x, e.y, 2); }
    }
  },
  draw(e) {
    drawRobot(M8.compy, e, { pose: e.state === 'run' ? (e.onGround ? 'run' : 'leap') : e.state, t: e.t, mood: e.state === 'crouch' ? 'warn' : 'look' });
    if (e.state === 'crouch') mark(e, 18);
  },
  box: e => ({ x: e.x - 7, y: e.y - 13, w: 14, h: 13 }),
  onKill(e, cx, cy, b) { boom(cx, cy, 0.5); M8.burst('compy', e.x, e.y, e.facing); SFX.pop(); addScore(50, cx, b.y - 8); down(e, cx, cy); }
};

// ---------------------------------------------------------------------------------------------------------------------
// RAPTOR
// ---------------------------------------------------------------------------------------------------------------------
const R_RUN = 2.3, R_TELL = 36, R_FIRST = 54, R_SKID = 22, R_RANGE = [86, 116], R_LEAP_T = 33, R_VY = -5, R_G = 0.3;
const R_RING = 11, R_LEAP = [40, 150];           // the ring's radius; how far a pounce goes (4.6 px a frame at most)
// It crouches: its spot is chosen now, where the hero stands, and ringed from this frame on
function raptorCrouch(e, tell) {
  const p = G.p, d = p.x < e.x ? -1 : 1;
  go(e, 'crouch'); e.tell = tell; e.pounced = true; e.facing = d;
  e.tx = clamp(e.x + d * clamp(Math.abs(p.x - e.x), R_LEAP[0], R_LEAP[1]), G.cam.x + 12, G.cam.x + W - 12);
  SFX.screech();
}
// the hero (or what he rides) has a foot in the ring
const inRing = e => { const b = pbox(G.p); return e.tx != null && b.x < e.tx + R_RING && b.x + b.w > e.tx - R_RING; };
ENEMY_TYPES.raptor = {
  hp: 3, melee: true, activateMargin: 20,
  contact: e => e.state === 'leap' && inRing(e) ? 'hurt' : 'none',   // only its pounce hurts, and only on its ring
  make(e, s) {
    e.state = s.ambush ? 'hide' : 'run'; e.st = 0; e.onGround = true; e.tx = null;
    e.range = Math.round(rand(R_RANGE[0], R_RANGE[1])); e.cd = s.cd ?? 0; e.wait = 0;
  },
  update(e) {
    if (scram(e, 3.4)) { e.state = 'run'; return; }
    const p = G.p, dx = p.x - e.x, d = dx < 0 ? -1 : 1, ad = Math.abs(dx), inn = wayIn(e);
    e.st++; if (e.cd > 0) e.cd--;
    switch (e.state) {
      case 'hide':     // in its bush: it jumps out when the hero comes near (or shoots it)
        e.facing = d;
        if ((ad < 130 && heroUp()) || e.hp < e.max) raptorCrouch(e, R_FIRST);
        break;
      case 'run':
        e.facing = inn || d;
        if (inn) step(e, inn, R_RUN);
        else if (ad > e.range + 4) { if (!step(e, d, R_RUN)) go(e, 'idle'); }
        else go(e, 'idle');
        fall(e);
        break;
      case 'idle':     // in range: wait for its turn, keep its distance
        e.facing = d;
        if (inn || ad > e.range + 40) go(e, 'run');
        else if (ad < 56 && step(e, -d, 1.4)) { /* backs off */ }
        fall(e);
        if (e.cd <= 0 && e.st > 8 && heroUp() && e.onGround) raptorCrouch(e, e.pounced ? R_TELL : R_FIRST);
        break;
      case 'crouch':   // it looks at its spot, not at the hero any more
        if (e.tx == null) e.tx = e.x + e.facing * R_LEAP[0];
        e.facing = e.tx < e.x ? -1 : 1; fall(e);
        if (e.st % 9 === 0) SFX.beep(1);
        if (e.st >= (e.tell || R_TELL)) {
          go(e, 'leap'); e.onGround = false; e.vy = R_VY;
          // (the screen may have moved on since it crouched: it stays on it, and its ring with it)
          e.tx = clamp(e.tx, G.cam.x + 12, G.cam.x + W - 12);
          e.vx = clamp((e.tx - e.x) / R_LEAP_T, -4.6, 4.6);
          e.tx = e.x + e.vx * R_LEAP_T;
          SFX.pounce();
        }
        break;
      case 'leap': {   // through the air to its ring (the tar below does not slow it; the screen's edge stops it)
        const py = e.y, nx = e.x + e.vx;
        if (nx < 14 || nx > LV.end - 14 || nx < G.cam.x + 12 || nx > G.cam.x + W - 12) e.vx = 0; else e.x = nx;
        e.vy = Math.min(e.vy + R_G, 6); e.y += e.vy; land(e, py);
        if (e.onGround) { go(e, 'skid'); dust(e.x, e.y, 6); SFX.skid(); }
        break;
      }
      case 'skid':
        if (e.vx) { if (!step(e, Math.sign(e.vx), Math.abs(e.vx))) e.vx = 0; e.vx *= 0.86; if (Math.abs(e.vx) < 0.3) e.vx = 0; }
        fall(e);
        if (e.st % 5 === 0 && e.vx) dust(e.x, e.y, 1, -Math.sign(e.vx));
        if (e.st >= R_SKID) { go(e, 'idle'); e.cd = Math.round(rand(80, 120)); e.vx = 0; }
        break;
    }
  },
  draw(e) {
    if (e.state === 'hide') {
      if (L8.drawBush) L8.drawBush(e.x, e.y, e.hitT > 0);
      // two blinks of its eye from the leaves
      const on = Math.floor(e.t / 6) % 12 < 2;
      R(Math.round(e.x) + e.facing * 4 - 1, Math.round(e.y) - 14, 3, 2, on ? '#ffffff' : '#ff3b30');
      return;
    }
    const pose = e.state === 'run' ? 'run' : e.state === 'crouch' ? 'crouch' : e.state === 'leap' ? 'leap' : e.state === 'skid' ? 'skid' : 'idle';
    if ((e.state === 'crouch' || e.state === 'leap') && e.tx != null) M8.ring(e.tx, groundAt(e.tx), R_RING, e.state === 'leap');
    drawRobot(M8.raptor, e, { pose, t: e.t, mood: e.state === 'crouch' ? 'warn' : e.state === 'leap' ? 'hot' : 'look' });
    if (e.state === 'crouch') mark(e, 36);
  },
  // (30 px tall: its neck counts, so a standing shot from a ledge 10 px higher still hits it)
  box: e => e.state === 'hide' ? { x: e.x - 12, y: e.y - 20, w: 24, h: 20 } : { x: e.x - 11, y: e.y - 30, w: 22, h: 30 },
  onKill(e, cx, cy, b) { boom(cx, cy, 0.75); M8.burst('raptor', e.x, e.y, e.facing); SFX.pop(); addScore(150, cx, b.y - 10); down(e, cx, cy); }
};

// ---------------------------------------------------------------------------------------------------------------------
// PTERO (e.y = the middle of its body, not its feet)
// ---------------------------------------------------------------------------------------------------------------------
// Bomber: P_OFF = how far from the hero an egg may be aimed (robots are clumsy: about every other egg would miss a
// hero who never moves; the ring shows the real landing spot from the first '!').
// Swooper: P_AIM frames of dotted path, a slanted dive of P_RUN px (from its hover, 10 px above its y in the level
// data), then a level pass at the height of the hero's chest
// (P_CHEST above the ground HE stands on, not the ground under the robot: over a pool's bed or a ledge that would take it
// out of the line of a standing shot; too low to duck under: shoot it or jump over it) for at most P_PASS px.
const P_FLY = 1.5, P_WARN = 30, P_OFF = 34, P_OVER = 3, P_AIM = 48, P_DIVE = 4.2, P_SKIM = 3.4, P_RUN = 64, P_PASS = 250, P_CHEST = 21, P_HOVER = 150, P_PERCH = 90;
EB_TYPES.dinoegg = {
  r: 5, shootable: true,
  draw(b) {
    if (b.tx != null) M8.ring(b.tx, groundAt(b.tx), 9, b.vy > 2.5);
    M8.egg(b.x, b.y);
  },
  onGround(b) { blast(b.x, groundAt(b.x) - 4, 14, 0, 'enemy'); debris(b.x, groundAt(b.x) - 4, 6, '#62d64f'); },
  onHit(b) { boom(b.x, b.y, 0.5); }
};
const EGG = { vx: 0.6, vy: 0.6, g: 0.09 };
// where something dropped at (x, y) with speed (vx, vy) and gravity g comes down
function landingX(x, y, vx, vy, g) {
  for (let i = 0; i < 400; i++) { x += vx; y += vy; vy += g; if (y >= groundAt(x)) break; }
  return x;
}
const eggLands = e => landingX(e.x - e.dir * 3, e.y + 12, e.dir * EGG.vx, EGG.vy, EGG.g);
const skimY = () => groundAt(G.p.x) - P_CHEST;
ENEMY_TYPES.ptero = {
  hp: 2, flying: true, contact: e => e.state === 'perch' || e.state === 'away' ? 'none' : 'hurt', activateMargin: 30, edge: 24,
  make(e, s) {
    e.mode = s.mode || 'bomb'; e.baseY = s.y || 84; e.y = e.baseY; e.state = 'fly'; e.st = 0;
    e.egg = e.mode === 'bomb'; e.left = (s.passes ?? P_OVER) - 1; e.cd = s.cd ?? 40; e.dir = 0; e.ph = (s.x || 0) * 0.01;
    e.off = rand(-P_OFF, P_OFF);
  },
  update(e) {
    const p = G.p, cam = G.cam.x, dx = p.x - e.x;
    e.st++; if (e.cd > 0) e.cd--;
    if (!e.dir) e.dir = e.facing || -1;
    // a giant is coming (see scram): a flying robot that is not part of its lock climbs away
    if (e.state !== 'away' && !e.lock && giantHere()) { go(e, 'away'); e.dir = e.x < cam + W / 2 ? -1 : 1; SFX.screech(); }
    if (e.state === 'away') {
      e.facing = e.dir; e.x += e.dir * 2.4; e.y -= 1.8;
      if (e.y < -24) e.dead = true;
      return;
    }
    const bob = Math.sin(e.t * 0.08 + e.ph) * 6;
    if (e.mode === 'bomb') {
      if (e.state === 'fly') {
        e.x += e.dir * P_FLY; e.facing = e.dir; e.y += (e.baseY + bob - e.y) * 0.1;
        // turn at the screen's edges (once it has been on the screen) and fetch the next egg there. After its last
        // pass it flies home instead, egg or no egg: a hero who cannot bring it down is rid of it after P_OVER
        // passes, and so is a lock. (Passes are counted, not eggs: under a hero who walks along with it, it never
        // finds the room to warn of an egg, and it would fly up and down for ever.)
        if ((e.dir > 0 ? e.x > cam + W - 26 : e.x < cam + 26) && e.x > cam + 10 && e.x < cam + W - 10) {
          if (e.left <= 0) { go(e, 'away'); return; }
          e.dir = -e.dir; e.left--;
          if (!e.egg) { e.egg = true; e.cd = 30; e.off = rand(-P_OFF, P_OFF); }
        }
        // the egg is aimed at a spot near the hero: the '!' and the ring come P_WARN frames or more before the drop
        const tx = clamp(p.x + e.off, cam + 14, cam + W - 14), ahead = (tx - eggLands(e)) * e.dir;
        if (e.egg && e.cd <= 0 && heroUp() && ahead >= P_WARN * P_FLY * 0.8 && ahead <= P_WARN * P_FLY * 0.8 + 14) { e.tx = tx; go(e, 'warn'); SFX.beep(2); }
      } else if (e.state === 'warn') {
        e.x += e.dir * P_FLY * 0.8; e.y += (e.baseY + bob - e.y) * 0.1;
        if ((eggLands(e) - e.tx) * e.dir >= 0 || e.st >= P_WARN + 30) {
          const b = { k: 'dinoegg', x: e.x - e.dir * 3, y: e.y + 12, vx: e.dir * EGG.vx, vy: EGG.vy, g: EGG.g, life: 400 };
          b.tx = landingX(b.x, b.y, b.vx, b.vy, b.g);
          G.eb.push(b); e.egg = false; go(e, 'fly'); SFX.drop();
        }
      }
    } else {
      const hy = e.baseY - 10;
      if (e.state === 'fly') {           // glide to a hover spot ahead of the hero, facing him
        // (on the side where it is, or over the hero's head to the other side when the screen has no room there)
        const spot = sd => clamp(p.x + sd * P_HOVER, cam + 40, cam + W - 40);
        let tx = spot(e.x >= p.x ? 1 : -1);
        if (Math.abs(tx - p.x) < P_HOVER - 30) tx = spot(tx >= p.x ? -1 : 1);
        e.x += clamp(tx - e.x, -2, 2); e.y += (hy + bob - e.y) * 0.1; e.facing = dx < 0 ? -1 : 1;
        if (e.cd <= 0 && Math.abs(tx - e.x) < 6 && Math.abs(dx) > P_RUN + 40 && heroUp()) {
          // the path is fixed now: down the slant, then level along the ground past where the hero stands
          e.dir = e.facing; e.x0 = e.x; e.y0 = e.y;
          e.lx = e.x + e.dir * P_RUN;
          e.ex = clamp(e.lx + e.dir * P_PASS, cam + 16, cam + W - 16);
          go(e, 'aim'); SFX.beep(2);
        }
      } else if (e.state === 'aim') {    // it hangs still over its dotted path
        e.facing = e.dir; e.y += (e.y0 - e.y) * 0.2;
        if (e.st % 10 === 0) SFX.beep(1);
        if (e.st >= P_AIM) { go(e, 'dive'); e.lvl = 0; SFX.dive(); }
      } else if (e.state === 'dive') {   // down the slant, level at chest height past the hero, then up and away
        if (!e.lvl) {
          const ty = skimY(), d = Math.hypot(e.lx - e.x, ty - e.y) || 1;
          if (d <= P_DIVE) { e.x = e.lx; e.y = ty; e.lvl = 1; }
          else { e.x += (e.lx - e.x) / d * P_DIVE; e.y += (ty - e.y) / d * P_DIVE; }
        } else {
          e.x += e.dir * P_SKIM; e.y += clamp(skimY() - e.y, -2, 2);
          if ((e.x - e.ex) * e.dir >= 0 || e.x < cam + 16 || e.x > cam + W - 16) { e.x = clamp(e.x, cam + 16, cam + W - 16); go(e, 'perch'); e.lvl = 0; dust(e.x, groundAt(e.x), 3); }
        }
      } else if (e.state === 'perch') {  // out of breath on the ground (or paddling in a pool): now it is the hero's turn
        const pl = L8.poolAt ? L8.poolAt(e.x) : null;
        e.y += clamp((pl ? pl.y - 4 : groundAt(e.x) - 10) - e.y, -2, 2); e.facing = dx < 0 ? -1 : 1;
        if (e.st >= P_PERCH) { go(e, 'climb'); e.dir = -e.facing; SFX.hop(); }
      } else {                            // climb
        e.x = clamp(e.x + e.dir * 1.2, cam + 16, cam + W - 16); e.y -= 2.4;
        if (e.y <= hy) { go(e, 'fly'); e.cd = Math.round(rand(90, 130)); }
      }
    }
  },
  draw(e) {
    if (e.mode === 'swoop' && (e.state === 'aim' || (e.state === 'dive' && !e.lvl))) {
      // the dotted path it will fly: the slant, then the level pass (every dot is always there, dark-rimmed so that
      // it reads on water, sand and leaves alike; the colours run along it)
      const on = Math.floor(e.t / 4) % 2, ly = skimY();
      const dot = (x, y, i) => { x = Math.round(x); y = Math.round(y); R(x - 2, y - 2, 5, 5, '#2a0a0e'); R(x - 1, y - 1, 3, 3, (i + on) % 2 ? '#ffe066' : '#ff3b30'); };
      for (let i = 1; i <= 6; i++) { const u = i / 6; dot(e.x0 + (e.lx - e.x0) * u, e.y0 + (ly - e.y0) * u, i); }
      const n = Math.max(1, Math.round(Math.abs(e.ex - e.lx) / 12));
      for (let i = 1; i <= n; i++) dot(e.lx + (e.ex - e.lx) * i / n, ly, i + 6);
    }
    if (e.mode === 'bomb' && e.state === 'warn') M8.ring(e.tx, groundAt(e.tx), 9, false);
    const warn = e.state === 'warn' || e.state === 'aim';
    drawRobot(M8.ptero, e, { pose: e.state === 'perch' ? 'perch' : e.state === 'dive' && !e.lvl ? 'dive' : 'fly', t: e.t, egg: e.egg, mood: warn ? 'warn' : e.state === 'dive' ? 'hot' : e.state === 'perch' ? 'dizzy' : 'look' });
    if (warn) M8.bang(e.x, e.y - 14);
  },
  box: e => e.state === 'perch' ? { x: e.x - 8, y: e.y - 13, w: 16, h: 23 } : { x: e.x - 10, y: e.y - 6, w: 20, h: 11 },
  onKill(e, cx, cy, b) { boom(cx, cy, 0.7); M8.burst('ptero', e.x, e.y + 14, e.facing); SFX.pop(); addScore(200, cx, b.y - 10); down(e, cx, cy); }
};

// ---------------------------------------------------------------------------------------------------------------------
// SPITTER
// ---------------------------------------------------------------------------------------------------------------------
const S_WALK = 1.0, S_WARN = 40, S_FLY = 70, S_VY = -5.2;   // a high lob: it comes down steeply on its ring
EB_TYPES.spitgoo = {
  r: 5,
  update(b) { if (G.t % 3 === 0 && G.parts.length < 600) G.parts.push({ type: 'spark', x: b.x, y: b.y, vx: 0, vy: 0.2, life: 10, max: 10, size: 2, c: '#62d64f' }); },
  draw(b) {
    if (b.tx != null) M8.ring(b.tx, groundAt(b.tx), 8, b.vy > 2);
    const x = Math.round(b.x), y = Math.round(b.y);
    M8.glow(x, y, 9, '#9dff4a', 0.4);
    R(x - 3, y - 2, 6, 4, '#2fae44'); R(x - 2, y - 3, 4, 6, '#2fae44'); R(x - 2, y - 2, 3, 3, '#a8f070'); R(x - 1, y - 2, 1, 1, '#e6ffc2');
  },
  onGround(b) { sparks(b.x, groundAt(b.x) - 2, 8, '#62d64f'); SFX.splat(); },
  onHit(b) { sparks(b.x, b.y, 8, '#62d64f'); SFX.splat(); }
};
ENEMY_TYPES.spitter = {
  hp: 4, contact: e => e.gone ? 'none' : 'hurt', activateMargin: 20,
  make(e, s) { e.state = 'walk'; e.st = 0; e.onGround = true; e.range = s.range || Math.round(rand(150, 190)); e.cd = s.cd ?? 50; e.k = 0; },
  update(e) {
    if (scram(e, 2.4)) { e.state = 'walk'; e.moving = true; e.k = Math.max(0, e.k - 0.06); return; }
    const p = G.p, dx = p.x - e.x, d = dx < 0 ? -1 : 1, ad = Math.abs(dx);
    e.st++; if (e.cd > 0) e.cd--;
    if (e.state === 'walk') {
      e.facing = d; e.k = Math.max(0, e.k - 0.06);
      // keep its distance: walk in to range, back off when the hero comes close (as far as the screen allows)
      e.moving = false;
      const inn = wayIn(e);
      if (inn) { e.facing = inn; e.moving = step(e, inn, S_WALK * 1.5); }
      else if (ad > e.range + 6) e.moving = step(e, d, S_WALK);
      else if (ad < e.range - 50) e.moving = step(e, -d, S_WALK);
      fall(e);
      if (e.cd <= 0 && heroUp() && e.onGround && e.x > G.cam.x + 10 && e.x < G.cam.x + W - 10) { go(e, 'warn'); SFX.frill(); }
    } else if (e.state === 'warn') {
      e.facing = d; e.k = Math.min(1, e.st / (S_WARN * 0.6)); fall(e);
      if (e.st % 10 === 0) SFX.beep(1);
      if (e.st >= S_WARN) {
        const mx = e.x + e.facing * 14, my = e.y - 20;
        const tx = clamp(p.x, G.cam.x + 10, G.cam.x + W - 10), gy = groundAt(tx);
        const g = 2 * ((gy - my) - S_VY * S_FLY) / (S_FLY * S_FLY);
        G.eb.push({ k: 'spitgoo', x: mx, y: my, vx: (tx - mx) / S_FLY, vy: S_VY, g, life: 300, tx });
        go(e, 'spit'); SFX.spit();
      }
    } else {
      fall(e);
      if (e.st >= 18) { go(e, 'walk'); e.cd = Math.round(rand(110, 150)); }
    }
  },
  draw(e) {
    const pose = e.state === 'warn' ? 'warn' : e.state === 'spit' ? 'spit' : e.moving ? 'walk' : 'idle';
    drawRobot(M8.spitter, e, { pose, t: e.t, k: e.k, mood: e.state === 'warn' ? 'warn' : e.state === 'spit' ? 'hot' : 'look' });
    if (e.state === 'warn') mark(e, 46);
  },
  box: e => ({ x: e.x - 12, y: e.y - 31, w: 24, h: 31 }),
  onKill(e, cx, cy, b) { boom(cx, cy, 0.75); M8.burst('spitter', e.x, e.y, e.facing); SFX.pop(); addScore(200, cx, b.y - 10); down(e, cx, cy); }
};

// ---------------------------------------------------------------------------------------------------------------------
// ROBO NEST
// ---------------------------------------------------------------------------------------------------------------------
const N_EVERY = 210, N_ROCK = 30, N_MAX = 2;
ENEMY_TYPES.robonest = {
  hp: 8, armored: true, contact: 'block', activateMargin: 10,
  make(e, s) { e.cd = s.cd ?? 70; e.rock = 0; e.kids = []; e.onGround = true; },
  update(e) {
    e.y = groundAt(e.x);
    e.kids = e.kids.filter(k => !k.dead && G.enemies.includes(k));
    if (e.rock > 0) {
      if (--e.rock === 0) {
        const d = G.p.x < e.x ? -1 : 1;
        const k = makeEnemy({ t: 'compy', x: e.x + d * 4, y: e.y - 22, vy: -3.2, vx: d * 1.6, cd: 40 }, e.lock);
        k.active = true; k.facing = d; G.enemies.push(k); e.kids.push(k);
        sparks(e.x, e.y - 24, 6, '#a8f070'); SFX.hatch();
        e.cd = N_EVERY;
      }
    } else if (--e.cd <= 0 && e.kids.length < N_MAX && heroUp() && e.x < G.cam.x + W - 8) e.rock = N_ROCK;
  },
  draw(e) {
    FLASH = e.hitT > 0;
    if (L8.drawNest) L8.drawNest(e.x, e.y, e.rock, e.t, e.hp / e.max);
    FLASH = false;
    if (e.rock > 0) M8.bang(e.x, e.y - 34);
  },
  box: e => ({ x: e.x - 14, y: e.y - 26, w: 28, h: 26 }),
  onKill(e, cx, cy, b) { boom(cx, cy, 1); debris(cx, cy, 8, '#56606e'); debris(cx, cy, 6, '#62d64f'); SFX.pop(); addScore(300, cx, b.y - 10); down(e, cx, cy); }
};

// ---------------------------------------------------------------------------------------------------------------------
// BOULDER WALL (the chase's road blocks)
// ---------------------------------------------------------------------------------------------------------------------
ENEMY_TYPES.boulderwall = {
  hp: 8, contact: 'block', activateMargin: 40,
  make(e) { e.onGround = true; },
  update(e) { e.y = groundAt(e.x); },
  draw(e) { FLASH = e.hitT > 0; if (L8.drawWall) L8.drawWall(e.x, e.y, e.hp / e.max); FLASH = false; },
  box: e => ({ x: e.x - 22, y: e.y - 54, w: 44, h: 54 }),
  onKill(e, cx, cy, b) {
    boom(e.x, e.y - 26, 1.1); debris(e.x, e.y - 30, 14, '#8d7a66'); debris(e.x, e.y - 14, 10, '#5e5044'); dust(e.x, e.y, 10);
    SFX.rock(); addScore(100, cx, b.y - 8); G.shake = Math.max(G.shake, 4);
  }
};
}
