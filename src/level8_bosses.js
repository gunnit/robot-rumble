'use strict';
var L8 = L8 || {};
// =====================================================================================================================
// Mission 8 (DINOSAUR VALLEY): how the two giants fight. Looks: level8_giants.js.
//
// ENEMY_TYPES.clubtail   CLUBTAIL, the robot ankylosaur that guards TOPS's cage (Bone Canyon's mini-boss, hp 56).
//   She rolls in as a ball, then walks toward the hero and takes her three attacks in the same order every time:
//     TAIL SLAM   the club rises over her back and glows (42 frames, a ring on the ground shows where it lands,
//                 60 px in front of her), comes down and sends a ground wave both ways. Step back, jump the wave.
//     SPIKES      she ducks, her back spikes light up one by one (44 frames), three fly up and come down on ringed
//                 spots (near the hero, and 60 px either side) 72 frames or more later. Stand between the rings.
//     ROLL-OUT    she curls up and spins on the spot (48 frames, arrows on the ground show the way), then rolls
//                 across the arena. Jump over her. She hits the wall and lies DIZZY for 150 frames: every hit
//                 counts double then.
//   Her ARMOUR: standing or curled up, only 10 hit points get through in one attack (from the first step of a walk
//   to the end of the attack it leads to); the rest clanks off. DIZZY, hits count double, and 28 hit points in one
//   spell wake her up early. So no gun ends the fight before her first roll (steady fire alone took 8 seconds, with
//   one attack seen), and a player who misses a lot is not kept much longer: one and a half to two and a half rounds.
//   Only the rolling ball and the things she throws hurt: her body is solid, touching it does nothing.
//   Every time she hits the wall a heart is shaken out of her and flies to where the hero stands (so a long fight
//   pays for itself). Beaten, she always leaves another, and TOPS's cage opens (L8.cageOpen in level8.js).
// EB_TYPES.tailspike     one of her spikes coming down (b.wait frames in the sky first; the ring is there at once)
//
// ENEMY_TYPES.ogglerex, ENEMY_TYPES.rexeye, PROP_TYPES.rexwreck, EB_TYPES.rexrock: the OGGLE REX, further down.
// Everything is private to the block. rand() only in update code.
// =====================================================================================================================
{
const Math = globalThis.Math;
const { blit } = M8.px;
const SFX = L8.SFX;
const go = (e, s) => { e.state = s; e.st = 0; };
const heroUp = () => { const p = G.p; return !!p && !p.dead && !p.hidden && !G.intro && G.winT <= 0; };
const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const word = (x, y, s, c = '#ffe066', t = 50) => G.texts.push({ x, y, s, t, c });
const BSFX = {
  thud(k = 1) { Snd.noise(0.25 * k, 0.22, 500); Snd.tone('sine', 120, 45, 0.22 * k, 0.25); },
  rev(k) { Snd.tone('sawtooth', 90 + k * 160, 110 + k * 200, 0.07, 0.05); },
  whoosh() { Snd.noise(0.2, 0.1, 2400); Snd.tone('sawtooth', 500, 160, 0.18, 0.05); },
  clang() { Snd.tone('square', 220, 90, 0.2, 0.12); Snd.noise(0.2, 0.18, 3200); },
  launch() { Snd.tone('square', 300, 1100, 0.14, 0.06); Snd.noise(0.1, 0.06, 5000); },
  roar(k = 1) { Snd.tone('sawtooth', 150 * k, 55 * k, 0.9, 0.2); Snd.tone('square', 96 * k, 40 * k, 0.9, 0.12, 0.04); Snd.noise(0.9, 0.16, 800); },
  growl() { Snd.tone('sawtooth', 110, 70, 0.4, 0.1); Snd.noise(0.3, 0.08, 600); },
  charge(k) { Snd.tone('sine', 400 + k * 900, 460 + k * 1000, 0.08, 0.05); },
  zap() { Snd.tone('sawtooth', 1500, 200, 0.5, 0.12); Snd.noise(0.5, 0.1, 6000); },
  crunch() { Snd.noise(0.3, 0.3, 900); Snd.tone('square', 180, 50, 0.25, 0.2); },
  squeak() { Snd.tone('square', 1300, 1900, 0.08, 0.05); Snd.tone('square', 1700, 1200, 0.1, 0.05, 0.09); }
};
L8.BSFX = BSFX;

// A giant's hit flash. Small robots blink white on every hit, like everything else in the game. A giant fills far
// too much of the screen for that (a pistol held down lands six or seven hits a second: a white flicker over a third
// of the picture), so a giant only glints: a white tint for FL_LEN frames, at most three times a second (the usual
// limit for flashing pictures). Every hit keeps its sound and its sparks, and the health bar shows the rest.
const FL_GAP = 20, FL_LEN = 3, FL_TINT = 0.45;
const flashTick = e => { if (e.hitT >= 3 && G.t - (e.flAt ?? -99) >= FL_GAP) e.flAt = G.t; };      // (from update)
// paint() draws the giant and returns what its painter returns; on a glint frame it is painted once more in white,
// see-through, on top
function glint(e, paint) {
  const o = paint();
  if (e.dying || G.t - (e.flAt ?? -99) >= FL_LEN) return o;
  ctx.save(); ctx.globalAlpha = FL_TINT; FLASH = true;
  try { paint(); } finally { FLASH = false; ctx.restore(); }
  return o;
}

// =====================================================================================================================
// CLUBTAIL
// =====================================================================================================================
const CT = { HP: 56, ARM: 10, SHAKE: 28, WALK: 0.8, KEEP: 112, T_SLAM: 42, REACH: 60, T_SPIKE: 44, T_ROLL: 48, ROLL_V: 4.2, DIZZY: 150, OFF: 20 };
const C_REST = M8.CLUB.REST, C_UP = [-4, -76], C_DOWN = [62, -9];
const ctBounds = e => [e.ax + 46, Math.min(e.ax + W - 46, (L8.CAGE_X ?? 1e9) - 104)];
const SPIKE = M8.memo(() => {
  const { buf, poly, rect, form, outline, mk } = M8.px, K0 = M8.art.K0, K1 = M8.art.K1, b = buf(12, 22, 6, 11);
  poly(b, [[-3, -9], [3, -9], [0.5, 9], [-0.5, 9]], K0); rect(b, -4, -10, 8, 3, K1);
  form(b, K0, [M8.PAL.BONED, M8.I('#cfc6b2'), M8.PAL.BONE, M8.I('#fbf7ea')], { depth: 2, amb: 0.6 }); form(b, K1, M8.PAL.STEEL, { depth: 2 });
  outline(b);
  return mk(b, false);
});
EB_TYPES.tailspike = {
  r: 6,
  update(b) { if (b.wait > 0) { b.x = b.tx; b.y = -30; b.vy = 0; if (--b.wait === 0) { b.vy = 5.2; SFX.drop(); } } },
  draw(b) {
    M8.ring(b.tx, groundAt(b.tx), 10, b.wait <= 0 && b.y > 90);
    if (b.wait <= 0) blit(SPIKE(), b.x, b.y);
  },
  onGround(b) {
    const gy = groundAt(b.x);
    G.parts.push({ type: 'sprite', s: SPIKE(), x: b.x, y: gy - 7, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, life: 50, max: 50 });
    sparks(b.x, gy - 2, 6, '#e8e2d2'); dust(b.x, gy, 4); G.shake = Math.max(G.shake, 2); BSFX.thud(0.5);
  },
  onHit(b) { sparks(b.x, b.y, 6, '#e8e2d2'); }
};
function ctSlam(e) {
  const ix = e.x + e.facing * CT.REACH, gy = groundAt(ix);
  G.shake = Math.max(G.shake, 6); BSFX.thud(1.2); BSFX.clang();
  dust(ix, gy, 12); debris(ix, gy - 3, 8, '#8d7a66');
  blast(ix, gy - 8, 24, 0, 'enemy');
  for (const d of [-1, 1]) G.eb.push({ k: 'wave', x: ix + d * 10, y: gy - 3, vx: d * 2.6, vy: 0, life: 104, t: 0 });
}
function ctVolley(e) {
  // (her arena ends at TOPS's cage: 44 px before its middle, where the hero's way ends too)
  const p = G.p, a = e.ax, ar = Math.min(a + W - 16, (L8.CAGE_X ?? 1e9) - 44), T0 = clamp(p.x + rand(-CT.OFF, CT.OFF), a + 20, ar - 4);
  [0, -60, 60].forEach((off, i) => {
    let tx = T0 + off;
    if (tx < a + 16 || tx > ar) tx = T0 - off * 2;                  // no room on that side: further out on the other
    G.eb.push({ k: 'tailspike', x: tx, y: -30, tx, vx: 0, vy: 0, wait: 26 + i * 16, life: 400 });
  });
  for (const s of e.pts || []) G.parts.push({ type: 'sprite', s: SPIKE(), x: s[0], y: s[1], vx: rand(-0.4, 0.4), vy: -8, g: 0, rot: Math.PI, vr: 0, life: 30, max: 30 });
  BSFX.launch();
}
// Her armour (the engine asks before every hit): how much of d gets through
function ctShield(e, d) {
  if (e.state === 'dizzy') {                                    // every hit counts double
    if (e.t - (e.x2T || 0) > 20) { e.x2T = e.t; word(e.x + 34, e.y - 36, 'x2!', '#ffffff', 30); }   // (beside DIZZY!, not on it)
    e.dz += d * 2;
    return d * 2;
  }
  const room = CT.ARM - e.took;
  if (room <= 0) {                                              // the plates hold: a clank, a word the first times
    if (e.t - (e.clankT || -99) > 7) { e.clankT = e.t; Snd.clank(); }
    if (e.armSaid < 2 && e.t - (e.armT || -999) > 150) { e.armSaid++; e.armT = e.t; word(e.x, e.y - 52, 'ARMOUR!', '#bfe6ff', 50); }
    return 0;
  }
  d = Math.min(d, room); e.took += d;
  return d;
}
const ctWalk = (e, t) => { go(e, 'walk'); e.walkT = t; e.took = 0; };   // a new attack begins: the plates are whole again
function ctUpdate(e) {
  const p = G.p, f = e.facing, [bl, br] = ctBounds(e);
  e.st++;
  flashTick(e);
  e.y = groundAt(e.x) - (e.hop || 0);
  if (e.dying) {                                                // beaten: she falls apart, the heart pops out
    if (e.st % 9 === 1 && e.st < 54) { boom(e.x + rand(-34, 34), e.y - rand(6, 34), 0.7); debris(e.x, e.y - 20, 4, '#2fae44'); debris(e.x, e.y - 20, 3, '#8a97a8'); }
    if (e.st >= 60) {
      e.dead = true;
      boom(e.x, e.y - 20, 1.6); debris(e.x, e.y - 20, 14, '#2fae44'); debris(e.x, e.y - 20, 10, '#c3cdd8');
      M8.burst('raptor', e.x - 20, e.y, e.facing); M8.burst('raptor', e.x + 20, e.y, -e.facing);
      dropItem('heart', e.x, e.y - 30, 0);
      G.big = { s: 'CLUBTAIL DOWN!', t: 110 };
    }
    return;
  }
  const half = e.hp <= e.max / 2;
  switch (e.state) {
    case 'intro':                                               // she rolls in from the right and uncurls
      e.inv = true; e.facing = -1; e.spin -= 0.3;
      e.x -= 3.4;
      if (e.st % 4 === 0) dust(e.x + 14, e.y, 1, 1);
      if (e.st % 8 === 0) BSFX.rev(0.5);
      if (e.x <= e.home) { e.x = e.home; go(e, 'uncurl'); G.shake = Math.max(G.shake, 5); BSFX.thud(); dust(e.x, e.y, 10); }
      break;
    case 'uncurl':
      e.inv = true;
      if (e.st === 14) { BSFX.roar(1.5); G.shake = Math.max(G.shake, 4); }
      if (e.st >= 54) { e.inv = false; ctWalk(e, 50); }
      break;
    case 'walk': {                                              // toward a spot KEEP px in front of the hero
      const dx = p.x - e.x;
      if (Math.abs(dx) > 30) e.facing = dx < 0 ? -1 : 1;
      const tx = clamp(p.x - e.facing * CT.KEEP, bl, br), d = tx - e.x;
      e.moving = Math.abs(d) > 2;
      if (e.moving) e.x += clamp(d, -CT.WALK, CT.WALK);
      if (e.st >= e.walkT && heroUp()) {
        const a = e.atk++ % 3;
        if (a === 0) { go(e, 'slamUp'); SFX.beep(2); }
        else if (a === 1) { go(e, 'spikeTell'); SFX.beep(2); }
        else { go(e, 'rollTell'); e.dir = p.x < e.x ? -1 : 1; e.facing = e.dir; SFX.beep(2); }
      }
      break;
    }
    case 'slamUp':
      if (e.st % 10 === 0) SFX.beep(1);
      if (e.st >= CT.T_SLAM) { go(e, 'slamDown'); BSFX.whoosh(); }
      break;
    case 'slamDown':
      if (e.st >= 7) { ctSlam(e); go(e, 'slamRest'); }
      break;
    case 'slamRest':
      if (e.st >= 34) go(e, 'slamBack');
      break;
    case 'slamBack':
      if (e.st >= 22) ctWalk(e, half ? 36 : 60);
      break;
    case 'spikeTell':
      if (e.st % 9 === 0) SFX.beep(Math.min(3, Math.floor(e.st / 12)));
      if (e.st >= CT.T_SPIKE) { ctVolley(e); go(e, 'spikeRest'); }
      break;
    case 'spikeRest':
      if (e.st >= 50) ctWalk(e, half ? 36 : 60);
      break;
    case 'rollTell':                                            // curled up, spinning on the spot
      e.spin += e.dir * (0.1 + 0.3 * e.st / CT.T_ROLL);
      if (e.st % 5 === 0) { dust(e.x - e.dir * 12, e.y, 1, -e.dir); BSFX.rev(e.st / CT.T_ROLL); }
      if (e.st >= CT.T_ROLL) { go(e, 'roll'); BSFX.whoosh(); }
      break;
    case 'roll': {
      const v = half ? CT.ROLL_V + 0.5 : CT.ROLL_V;
      e.x += e.dir * v; e.spin += e.dir * v / 18;
      if (e.st % 3 === 0) dust(e.x - e.dir * 10, e.y, 1, -e.dir);
      const wall = e.dir < 0 ? e.ax + 24 : Math.min(e.ax + W - 24, (L8.CAGE_X ?? 1e9) - 62);
      if ((e.x - wall) * e.dir >= 0) {
        e.x = wall; go(e, 'bounce'); e.vy = -3.4; e.hop = 0.01;
        G.shake = Math.max(G.shake, 7); BSFX.clang(); BSFX.thud(); dust(e.x + e.dir * 14, e.y, 10); sparks(e.x + e.dir * 16, e.y - 18, 10);
      }
      break;
    }
    case 'bounce':                                              // off the wall, back a little
      e.x = clamp(e.x - e.dir * 1.5, bl, br); e.spin -= e.dir * 0.12;
      e.hop += -e.vy; e.vy += 0.3;
      if (e.hop <= 0) {
        e.hop = 0; go(e, 'dizzy'); e.dz = 0; e.facing = -e.dir; G.shake = Math.max(G.shake, 4); BSFX.thud(); dust(e.x, groundAt(e.x), 8);
        word(e.x, groundAt(e.x) - 56, 'DIZZY!', '#ffe066', 60);
        // every crash shakes a heart out of her (a long fight pays for itself): it flies to where the hero stands
        if (ITEMS.heart) {
          const x0 = e.x - e.dir * 24, tx = clamp(p.x, e.ax + 16, e.ax + W - 16);
          G.items.push({ k: 'heart', x: x0, y: groundAt(e.x) - 40, vx: (tx - x0) / 48, vy: -4, onGround: false, t: 0 });
        }
        if (!e.gift) { e.gift = true; G.texts.push({ x: G.cam.x + W / 2, y: 80, s: 'SHE IS DIZZY: HIT HER NOW!', t: 110, c: '#ffe066' }); }
      }
      break;
    case 'dizzy':                                               // (hurt a lot, she shakes it off early)
      if (e.st >= CT.DIZZY || e.dz >= CT.SHAKE) go(e, 'getUp');
      break;
    case 'getUp':
      if (e.st >= 24) ctWalk(e, half ? 30 : 50);
      break;
  }
  // the club follows its pose
  const sway = [C_REST[0], C_REST[1] + Math.sin(e.t / 13) * 3];
  let c = sway, arc = 0.3;
  if (e.state === 'slamUp') { const k = ease(e.st / (CT.T_SLAM * 0.7)); c = mix(sway, C_UP, k); arc = 0.3 + 0.22 * k; }
  else if (e.state === 'slamDown') { const k = ease(e.st / 7); c = mix(C_UP, C_DOWN, k); arc = 0.52 + 0.1 * k; }
  else if (e.state === 'slamRest') { c = C_DOWN; arc = 0.62; }
  else if (e.state === 'slamBack') { const k = ease(e.st / 22); c = mix(C_DOWN, sway, k); arc = 0.62 - 0.32 * k; if (k < 0.5) c[1] -= Math.sin(k * 2 * Math.PI) * 26; }
  else if (e.state === 'dizzy') { c = [-82, -8]; arc = 0.08; }
  else if (e.state === 'spikeTell' || e.state === 'spikeRest') { c = [-80, -20]; arc = 0.15; }
  e.club = e.club ? mix(e.club, c, e.state === 'slamDown' || e.state === 'slamUp' ? 1 : 0.3) : c;
  e.arc = arc;
}
function ctDraw(e) {
  const ball = e.state === 'intro' || e.state === 'rollTell' || e.state === 'roll' || e.state === 'bounce';
  const gy = groundAt(e.x);
  // where the next thing lands
  if (e.state === 'slamUp' || e.state === 'slamDown') M8.ring(e.x + e.facing * CT.REACH, groundAt(e.x + e.facing * CT.REACH), 15, e.st > CT.T_SLAM - 14 || e.state === 'slamDown');
  if (e.state === 'rollTell') {
    // arrows on the ground: the way she will roll
    const on = Math.floor(e.t / 5) % 3;
    for (let i = 0; i < 6; i++) {
      const x = Math.round(e.x + e.dir * (34 + i * 22)), y = gy - 3, c = i % 3 === on ? '#ff3b30' : '#ffe066';
      if (x < G.cam.x + 6 || x > G.cam.x + W - 6) continue;
      for (let k = 0; k < 4; k++) R(x - e.dir * k, y - k, 2, 1 + k * 2, c);
    }
  }
  const pose = e.dying ? 'down' : ball ? 'ball' : e.state === 'uncurl' ? (e.st < 16 ? 'hunker' : 'idle') : e.state === 'spikeTell' ? 'hunker' : e.state === 'dizzy' ? 'dizzy' : e.state === 'getUp' ? 'hunker' : e.state === 'walk' && e.moving ? 'walk' : 'idle';
  const warn = e.state === 'slamUp' || e.state === 'spikeTell';
  const o = glint(e, () => M8.clubtail(e.x, gy - (ball ? e.hop || 0 : 0), e.facing, {
    pose, t: e.t, club: e.dying ? [-82, -8] : e.club, arc: e.dying ? 0.08 : e.arc, spin: e.spin,
    arm: e.state === 'slamUp' ? Math.min(1, e.st / 20) : e.state === 'slamDown' ? 1 : 0,
    spikes: e.state === 'spikeTell' ? e.st / (CT.T_SPIKE - 8) : 0,
    mood: e.dying ? 'off' : e.state === 'dizzy' ? 'dizzy' : warn ? 'warn' : 'look'
  }));
  e.pts = o.spikes;                 // (where her spikes are on the screen: ctVolley's sparks start there. For show only,
                                    //  and the one thing a painter of this mission hands to an update)
  if (warn || e.state === 'rollTell') M8.bang(e.x, gy - (ball ? 48 : 62));
  if (e.state === 'dizzy') {
    // stars round her head
    for (let i = 0; i < 3; i++) { const a = e.t / 9 + i * 2.1, x = Math.round(o.eye[0] + Math.cos(a) * 12), y = Math.round(o.eye[1] - 12 + Math.sin(a) * 4); R(x - 1, y, 3, 1, '#ffe066'); R(x, y - 1, 1, 3, '#ffe066'); }
  }
}
ENEMY_TYPES.clubtail = {
  hp: CT.HP, boss: true, bossName: 'CLUBTAIL', armored: true, grab: false, edge: 46, activateMargin: 60,
  contact: e => e.dying ? 'none' : e.state === 'roll' ? 'hurt' : 'block',
  make(e, s) {
    M8.clubWarm();
    const lk = e.lock;
    e.ax = lk && lk.at != null ? lk.at : G.cam.x;
    e.home = Math.min(e.ax + 330, ctBounds(e)[1]);
    e.state = 'intro'; e.st = 0; e.inv = true; e.facing = -1; e.spin = 0; e.atk = 0; e.hop = 0; e.vy = 0; e.dir = -1; e.walkT = 50;
    e.club = null; e.arc = 0.3; e.max = e.hp; e.pts = []; e.took = 0; e.dz = 0; e.armSaid = 0; e.gift = false;
    if (!lk) { e.state = 'walk'; e.inv = false; e.home = e.x; }           // the sandbox: no arena, no entrance
  },
  update: ctUpdate,
  draw: ctDraw,
  shield: ctShield,
  box(e) {
    if (e.state === 'intro' || e.state === 'rollTell' || e.state === 'roll' || e.state === 'bounce') return { x: e.x - 17, y: e.y - 37, w: 34, h: 35 };
    if (e.state === 'dizzy' || e.dying) return { x: e.x - 42, y: e.y - 34, w: 84, h: 34 };
    return { x: e.x - 41, y: e.y - 42, w: 82, h: 42 };
  },
  onKill(e, cx, cy, b) {
    e.state = 'down'; e.st = 0; e.hop = 0;
    G.eb = G.eb.filter(x => x.k !== 'tailspike' && x.k !== 'wave');
    addScore(3000, cx, b.y - 10);
    boom(cx, cy, 1.2); BSFX.clang(); say('Clubtail is down!');
    return 'dying';
  }
};

// =====================================================================================================================
// OGGLE REX (the launch pad, hp 300): MEGA OGGLE's biggest machine, back from the chasm with a plaster on its snout.
// It stands on the right of the pad, facing the hero, and takes its attacks in the same order every time:
//   STOMP   the near foot rises (40 frames, a ring where it comes down), then: a ground wave runs to the left (jump
//           it) and two rocks fall on ringed spots (three in the last third). Standing at its toes gets you trodden.
//   CHOMP   the head rears up, jaws wide (56 frames). A striped strip on the ground follows the hero for 18 frames,
//           then stays for the other 38: get off it. The head comes down and STICKS in the ground for 96 frames
//           (80 in the last third): its eye is at the height of the hero's gun then.
//   EYE BEAM (from two thirds of its health) the chin goes down on the ground, the eye charges white (46 frames, a
//           dotted line shows the beam), then the beam crosses the pad at a standing hero's head for 30 frames: DUCK.
//   In the last third it also roars two compys out of its chest hatch now and then, and rests a quarter less.
// Its body is solid and takes plain damage. ENEMY_TYPES.rexeye is its one eye: a second target that passes every
// hit on DOUBLED (shoot straight up from under its head, or level when the head is stuck or staring).
// It drops a heart at two thirds and at one third. After a continue it comes back with the health it had, at most
// 75 % (L8.rexKeep). Beaten: it falls apart and lies down, the dome pops and tiny MEGA OGGLE lands in the dust with
// his MASTER SWITCH; PROP_TYPES.rexwreck plays the rest (TOPS and the freed babies run in to cheer).
// L8.bossFront(cx): what must be drawn over the hero (the beam and its warning), called by the scenery's front layer.
// =====================================================================================================================
const RX = { HP: 300, HOME: 404, WALK: 1.1, KEEP: 72, DOWN: 182, BLOW: 190, POCKET: 112, T_STOMP: 40, T_CHOMP: 56, FOLLOW: 18, STUCK: 96, T_BEAM: 46, BEAM: 30, NEAR: 104, FAR: 240, ZONE: 30, FOOT: 30, RING: 34, REST: 120 };
const HD_IDLE = [80, -112], HD_ROAR = [76, -122], HD_REAR = [60, -132], HD_STARE = [118, -17], HD_DEAD = [112, -15];
const rexGy = e => groundAt(Math.min(e.x, LV.end));
const rexPh = e => { const k = e.hp / e.max; return k > 0.66 ? 1 : k > 0.33 ? 2 : 3; };
const stuckHd = e => [clamp(e.x - e.tx - 40, 30, 200), -30];
function rexWant(e) {
  const sway = Math.sin(e.t / 26) * 3, step = 'walk:' + (Math.floor(e.walk / 10) % 8);
  switch (e.state) {
    case 'intro': return { hd: [HD_IDLE[0], HD_IDLE[1] + sway], ha: 0.1, jaw: Math.floor(e.walk / 26) % 2 ? 0.5 : 0, body: step, mood: 'hot', pilot: 'drive' };
    case 'roar': case 'call': return { hd: HD_ROAR, ha: -0.3, jaw: 1, body: 'roar', mood: 'hot', pilot: 'cheer' };
    case 'stompUp': return { hd: [74, -118], ha: -0.1, jaw: 0.5, body: 'stomp:0', mood: 'warn', pilot: 'drive' };
    case 'stompDown': case 'stompRest': return { hd: [86, -102], ha: 0.2, jaw: 0, body: 'stomp:1', mood: 'hot', pilot: 'cheer', rate: 0.4 };
    case 'chompTell': return { hd: HD_REAR, ha: -0.5, jaw: 1, body: 'roar', mood: 'warn', pilot: 'drive' };
    case 'chompDown': return { hd: stuckHd(e), ha: 0.9, jaw: e.st < 4 ? 1 : 0, body: 'bite', mood: 'hot', pilot: 'cheer', rate: 0 };
    case 'stuck': return { hd: [stuckHd(e)[0] + (e.st % 30 < 10 && Math.floor(e.st / 3) % 2 ? 2 : 0), -30], ha: 0.9, jaw: 0, body: 'bite', mood: 'dizzy', pilot: 'panic', rate: 1 };
    case 'beamTell': return { hd: HD_STARE, ha: 0, jaw: 0, body: 'bite', mood: 'charge', pilot: 'drive', rate: 0.15 };
    case 'beam': return { hd: [HD_STARE[0] - 2, HD_STARE[1]], ha: 0, jaw: 0, body: 'bite', mood: 'charge', pilot: 'cheer', rate: 1 };
    case 'down': {
      if (e.st < 70) return { hd: [78 + Math.sin(e.st / 5) * 12, -116 + Math.cos(e.st / 4) * 10], ha: Math.sin(e.st / 6) * 0.4, jaw: 1, body: 'roar', mood: Math.floor(e.st / 4) % 2 ? 'dizzy' : 'off', pilot: 'panic', rate: 0.3 };
      return { hd: HD_DEAD, ha: 0, jaw: 0.5, body: 'down', mood: 'off', pilot: e.cap ? false : 'panic', rate: 0.3 };
    }
    default: return { hd: [HD_IDLE[0], HD_IDLE[1] + sway], ha: 0.04 * Math.sin(e.t / 31), jaw: 0, body: e.moving ? step : 'idle:' + (Math.floor(e.t / 30) % 2), mood: 'look', pilot: e.rest > RX.REST - 50 ? 'cheer' : 'drive' };
  }
}
function rexStep(e, v) {
  e.walk += v;
  if (e.walk - e.stepAt < 40) return;
  e.stepAt = e.walk;
  G.shake = Math.max(G.shake, 3.5); BSFX.thud(0.8); dust(e.x - 10, rexGy(e), 4);
}
function rexRoar(e, first) {
  e.state = 'roar'; e.st = 0; e.first = !!first; e.near = 0;
  BSFX.roar(first ? 0.9 : 1.2); G.shake = Math.max(G.shake, 8);
}
function rexIdle(e, ph, wait) {
  const p = G.p, mercy = p && !p.dead && p.hearts <= 1;
  if (e.rage) { e.rage = false; rexRoar(e); return; }             // a third of it gone: first it roars
  e.state = 'idle'; e.st = 0;
  e.wait = Math.round(wait * (ph === 3 ? 0.75 : 1) * (mercy ? 1.3 : 1));
}
function rexNext(e, ph) {
  const order = ph === 1 ? ['stomp', 'chomp'] : ph === 2 ? ['beam', 'stomp', 'chomp'] : ['call', 'chomp', 'stomp', 'beam'];   // each third opens with its new trick
  let a = order[e.atk++ % order.length];
  if (a === 'call' && G.enemies.filter(x => x.type === 'compy' && !x.dead).length >= 2) a = order[e.atk++ % order.length];
  e.st = 0;
  if (a === 'stomp') { e.state = 'stompUp'; SFX.beep(2); }
  else if (a === 'chomp') { e.state = 'chompTell'; e.tx = clamp(G.p.x, e.x - RX.FAR, e.x - RX.NEAR); SFX.beep(2); BSFX.growl(); }
  else if (a === 'beam') { e.state = 'beamTell'; e.beams++; SFX.beep(2); }
  else { e.state = 'call'; e.say = { s: 'GET THEM!', t: 60 }; }
}
function rexStomp(e, gy, ph) {
  const p = G.p, ax = e.ax, fx = e.x - RX.FOOT;
  G.shake = Math.max(G.shake, 9); BSFX.thud(1.5); BSFX.clang();
  dust(fx - 14, gy, 10, -1); dust(fx + 10, gy, 6, 1); debris(fx, gy - 3, 10, '#8d7a66');
  G.eb.push({ k: 'wave', x: fx - 34, y: gy - 3, vx: -2.6, vy: 0, life: 170, t: 0 });
  // rocks: one close to the hero (never right on a hero who stands still), the others anywhere on the pad, never two
  // on one spot
  const lo = ax + 16, hi = e.x - 96, side = rand(0, 1) < 0.5 ? -1 : 1, off = rand(22, 46);
  let near = p.x + side * off;
  if (near < lo || near > hi) near = p.x - side * off;
  const spots = [clamp(near, lo, hi)], n = ph === 3 ? 3 : 2;
  for (let tries = 0; spots.length < n && tries < 24; tries++) { const x = rand(lo + 4, hi); if (spots.every(q => Math.abs(q - x) > 46) && Math.abs(x - p.x) > 20) spots.push(x); }
  spots.forEach((tx, i) => G.eb.push({ k: 'rexrock', x: tx, y: -24, tx, vx: 0, vy: 0, wait: 22 + i * 16, life: 400, big: i === 0 }));
}
function rexChomp(e, gy) {
  const p = G.p, tx = e.tx, bits = M8.rockBits();
  G.shake = Math.max(G.shake, 10); BSFX.crunch(); BSFX.thud(1.4);
  dust(tx, gy, 14); debris(tx, gy - 4, 10, '#8d7a66');
  for (let i = 0; i < 8; i++) G.parts.push({ type: 'sprite', s: bits[i % 3], x: tx + rand(-14, 14), y: gy - 4, vx: rand(-2.6, 2.6), vy: rand(-4.4, -1.6), g: 0.22, rot: rand(0, 6.28), vr: rand(-0.4, 0.4), life: rand(30, 50) | 0, max: 50 });
  if (!p.dead && Math.abs(p.x - tx) < RX.ZONE && p.y > gy - 50) hurtPlayer();
}
function rexCall(e) {
  const gy = rexGy(e), have = G.enemies.filter(x => x.type === 'compy' && !x.dead).length;
  for (let i = have; i < 2; i++) {
    const k = makeEnemy({ t: 'compy', x: e.x - 58 - i * 8, y: gy - 46, cd: 40 + i * 30 }, e.lock);
    if (k.dead) continue;
    k.active = true; k.facing = -1; k.vx = -1.6 - i * 0.6; k.vy = -3;
    G.enemies.push(k);
    SFX.hatch();
  }
  sparks(e.x - 50, gy - 50, 8, '#9dff4a');
}
// the head, when it is down at the hero's height, is in the way (it shoves, it does not hurt)
function rexHeadBox(e, gy) {
  if (e.state === 'stuck' || e.state === 'chompDown' || (e.state === 'chompFree' && e.st < 6)) return { x: e.tx - 4, y: gy - 46, w: 48, h: 46 };
  if ((e.state === 'beamTell' && e.st > 12) || e.state === 'beam' || (e.state === 'beamRest' && e.st < 8)) return { x: e.x - e.hd[0] - 60, y: gy - 46, w: 72, h: 46 };
  return null;
}
function rexUpdate(e) {
  const p = G.p, gy = rexGy(e), ax = e.ax;
  e.st++; e.y = gy;
  flashTick(e);
  if (e.say && --e.say.t <= 0) e.say = null;
  if (e.dying) rexDying(e, gy);
  else {
    L8.rexKeep = { hp: e.hp, run: G.freed };
    const ph = rexPh(e);
    if (ph > e.ph) {                                              // a third of it gone: a heart for the hero, and it gets angrier
      e.ph = ph; e.rage = true; e.atk = 0;
      dropItem('heart', clamp(p.x + p.facing * 8, ax + 15, e.x - 80), groundAt(p.x) - 19, 0);
      e.say = { s: ph === 2 ? 'NOT FAIR!' : 'MY REX!!', t: 80 };
      G.shake = Math.max(G.shake, 5);
      for (let i = 0; i < 3; i++) boom(e.x - 30 + rand(-40, 40), gy - rand(40, 110), 0.7);
    }
    // it gloats after a hit (a breather for the hero), and it does not let anybody camp between its feet
    const hh = p.dead ? 0 : p.hearts;
    if (e.hh != null && hh < e.hh) { e.rest = RX.REST; if (!e.say) e.say = { s: e.laughs++ % 2 ? 'GOTCHA!' : 'HA HA HA!', t: 60 }; }
    e.hh = hh;
    if (e.state !== 'roar' && e.state !== 'intro') e.near = !p.dead && p.x > e.x - RX.POCKET ? e.near + 1 : Math.max(0, e.near - 2);
    switch (e.state) {
      case 'intro':                                               // it walks in from the right: the ground shakes
        e.inv = true;
        e.x = Math.max(e.home, e.x - RX.WALK); rexStep(e, RX.WALK);
        if (e.x <= e.home) { rexRoar(e, true); e.say = { s: 'YOU AGAIN!', t: 66 }; }
        break;
      case 'roar':                                                // its breath blows the hero back to the middle of the pad
        e.inv = !!e.first;
        if (e.st % 6 === 0) G.shake = Math.max(G.shake, 3);
        if (!p.dead && e.st > 6 && p.x > e.x - RX.BLOW) p.x = Math.max(e.x - RX.BLOW, p.x - 3);
        if (e.st >= 66) { e.inv = false; if (e.first) e.tip = { s: 'HIT ITS EYE: DOUBLE DAMAGE!', t: 260 }; e.first = false; rexIdle(e, ph, 50); }
        break;
      case 'idle': {                                              // toward its place: 200 px from the hero, never off its pad
        const tx = clamp(p.x + 200, ax + 330, e.home), d = tx - e.x;
        e.moving = Math.abs(d) > 3;
        if (e.moving) { const v = clamp(d, -0.6, 0.6); e.x += v; rexStep(e, Math.abs(v)); }
        if (e.rage) { e.rage = false; rexRoar(e); break; }
        if (e.rest > 0) { e.rest--; e.st--; }
        if (e.near >= 80 && heroUp()) { rexRoar(e); e.say = { s: 'SHOO!', t: 50 }; break; }
        if (e.st >= e.wait && heroUp()) rexNext(e, ph);
        break;
      }
      case 'stompUp':
        if (e.st % 10 === 0) SFX.beep(1);
        if (e.st >= RX.T_STOMP) { e.state = 'stompDown'; e.st = 0; BSFX.whoosh(); }
        break;
      case 'stompDown':
        if (e.st === 4) rexStomp(e, gy, ph);
        if (e.st >= 8) { e.state = 'stompRest'; e.st = 0; }
        break;
      case 'stompRest':
        if (e.st >= 30) rexIdle(e, ph, 76);
        break;
      case 'chompTell':
        if (e.st <= RX.FOLLOW) e.tx = clamp(p.x, e.x - RX.FAR, e.x - RX.NEAR);
        if (e.st % 8 === 0) SFX.beep(e.st > RX.FOLLOW ? 3 : 1);
        if (e.st >= RX.T_CHOMP) { e.state = 'chompDown'; e.st = 0; BSFX.whoosh(); }
        break;
      case 'chompDown': {
        const k = ease(e.st / 6);
        e.hd = mix(HD_REAR, stuckHd(e), k); e.ha = -0.5 + 1.4 * k;
        if (e.st >= 6) { rexChomp(e, gy); e.state = 'stuck'; e.st = 0; e.say = { s: 'PULL! PULL!', t: 70 }; e.tip = { s: 'ITS HEAD IS STUCK: HIT THE EYE!', t: (ph === 3 ? RX.STUCK - 16 : RX.STUCK) }; }
        break;
      }
      case 'stuck':
        if (e.st % 24 === 0) BSFX.squeak();
        if (e.st >= (ph === 3 ? RX.STUCK - 16 : RX.STUCK)) {
          e.state = 'chompFree'; e.st = 0;
          G.shake = Math.max(G.shake, 5); BSFX.thud(); debris(e.tx, gy - 4, 8, '#8d7a66'); dust(e.tx, gy, 8);
        }
        break;
      case 'chompFree':
        if (e.st >= 30) rexIdle(e, ph, 64);
        break;
      case 'beamTell':
        if (e.st % 6 === 0) BSFX.charge(e.st / RX.T_BEAM);
        if (e.st >= RX.T_BEAM) { e.state = 'beam'; e.st = 0; BSFX.zap(); G.shake = Math.max(G.shake, 4); }
        break;
      case 'beam': {                                              // from the eye to the pad's left end, at a standing hero's head
        const ey = e.eyeW[1], x1 = e.eyeW[0] - 8;
        if (!p.dead && overlap(pbox(p), { x: ax - 20, y: ey - 3.5, w: x1 - (ax - 20), h: 7 })) hurtPlayer();
        if (e.st % 3 === 0) sparks(ax + 4, ey, 2, '#9dff4a');
        if (e.st >= RX.BEAM) { e.state = 'beamRest'; e.st = 0; }
        break;
      }
      case 'beamRest':
        if (e.st >= 28) rexIdle(e, ph, 76);
        break;
      case 'call':
        if (e.st === 8) { BSFX.roar(1.4); G.shake = Math.max(G.shake, 5); }
        if (e.st === 30) rexCall(e);
        if (e.st >= 56) rexIdle(e, ph, 44);
        break;
    }
    if (e.tip && --e.tip.t <= 0) e.tip = null;
    const hb = rexHeadBox(e, gy);
    if (hb && !p.dead) {
      const pb = pbox(p);
      if (overlap(pb, hb) && p.y > hb.y + 8) {                    // out to the nearer side (to the left when its legs are right there)
        const left = hb.x - (pb.x + pb.w), right = hb.x + hb.w - pb.x, room = hb.x + hb.w + pb.w / 2 <= e.x - RX.KEEP;
        p.x = clamp(p.x + clamp(!room || -left < right ? left : right, -4, 4), G.cam.x + 8, G.cam.x + W - 8);
      }
    }
  }
  // nobody gets past its legs (walking in, it walks the hero back); once it has fallen its head lies in the way
  if (p && !p.dead) {
    const lim = e.x - (e.dying && e.st >= 70 ? RX.DOWN : RX.KEEP);
    if (p.x > lim) p.x = Math.max(G.cam.x + 8, e.dying ? Math.max(lim, p.x - 4) : lim);
  }
  // the head follows its pose
  const w = rexWant(e), r = w.rate ?? 0.16;
  if (r > 0) { e.hd = mix(e.hd, w.hd, r); e.ha += (w.ha - e.ha) * r; }
  e.P = w;
  e.eyeW = M8.rexAt(e.x, gy, -1, { head: e.hd, ha: e.ha, jaw: w.jaw, patch: true }).eye;
}
function rexDying(e, gy) {
  const t = e.st, bits = M8.rockBits(), p = G.p;
  if (t < 70 && t % 6 === 1) {
    boom(e.x + rand(-70, 30), gy - rand(16, 124), 0.8); G.shake = Math.max(G.shake, 4);
    debris(e.x - 20, gy - 70, 4, '#2fae44'); debris(e.x - 20, gy - 70, 3, '#8a97a8');
  }
  if (t === 70) {                                                 // its legs give way
    G.shake = Math.max(G.shake, 12); BSFX.thud(1.8); BSFX.crunch();
    dust(e.x - 60, gy, 14); dust(e.x, gy, 14); dust(e.x - 120, gy, 10);
    for (let i = 0; i < 10; i++) G.parts.push({ type: 'sprite', s: bits[i % 3], x: e.x + rand(-90, 20), y: gy - 4, vx: rand(-2.4, 2.4), vy: rand(-4.4, -1.6), g: 0.22, rot: rand(0, 6.28), vr: rand(-0.4, 0.4), life: rand(30, 56) | 0, max: 56 });
    e.say = { s: 'ABANDON REX!', t: 40 };
    G.big = { s: 'OGGLE REX DOWN!', t: 130 };
  }
  if (t === 100 && !e.cap) {                                      // the dome pops: the captain and his switch are thrown clear
    const d = M8.rexAt(e.x, gy, -1, { head: e.hd, ha: e.ha, jaw: 0.5, patch: true }).dome;
    e.cap = { x: d[0], y: d[1], vx: -2.3, vy: -4.4, on: false, t: 0, hops: 0 };
    // the switch comes down in front of the hero (not on the captain, who lands about 135 px from the dome)
    const land = d[0] - 135, lo = e.ax + 30, hi = e.x - RX.DOWN - 10, air = (4.4 + Math.sqrt(19.36 + 0.44 * Math.max(0, gy - d[1]))) / 0.22;
    let sx = clamp((p ? p.x : e.x - 260) + 26, lo, hi);
    if (Math.abs(sx - land) < 24) sx = land + 26 <= hi ? land + 26 : land - 26;
    e.sw = { x: d[0], y: d[1] - 4, vx: (sx - d[0]) / air, vy: -4.4, on: false };
    e.say = null;
    for (let i = 0; i < 10; i++) G.parts.push({ type: 'spark', x: d[0] + rand(-6, 6), y: d[1] + rand(-6, 6), vx: rand(-2.4, 2.4), vy: rand(-3.4, -0.6), g: 0.16, life: rand(16, 30) | 0, max: 30, size: i % 2 ? 1 : 2, c: i % 2 ? '#d6f6ff' : '#78bed6' });
    Snd.tone('square', 900, 1800, 0.12, 0.08); BSFX.squeak();
  }
  capFly(e.cap, gy, e.ax + 24); swFly(e.sw, gy);
  if (t === 150) {
    if (p && p.dead && G.lives <= 1) G.lives = 2;
    G.props.push({ k: 'rexwreck', x: e.x, y: gy, hitT: 0, dead: false, t: 0, off: 0, hd: e.hd.slice(), ha: e.ha, cap: e.cap, sw: e.sw, ax: e.ax });
    bossDefeated(e);
  }
}
// the tiny captain through the air: two bounces, then he sits
function capFly(c, gy, minX) {
  if (!c || c.on) return;
  c.t++; c.x = Math.max(minX, c.x + c.vx); c.y += c.vy; c.vy += 0.22;
  if (c.y < gy) return;
  c.y = gy;
  if (c.hops < 2) { c.hops++; c.vy = -2.6 + c.hops * 0.9; c.vx *= 0.55; dust(c.x, gy, 3); BSFX.squeak(); }
  else { c.on = true; c.t = 0; dust(c.x, gy, 4); }
}
function swFly(c, gy) {
  if (!c || c.on) return;
  c.x += c.vx; c.y += c.vy; c.vy += 0.22;
  if (c.y < gy) return;
  c.y = gy; c.on = true; dust(c.x, gy, 4); BSFX.clang();
}
function stars(x, y, t, r = 12) {
  for (let i = 0; i < 3; i++) { const a = t / 9 + i * 2.1, sx = Math.round(x + Math.cos(a) * r), sy = Math.round(y + Math.sin(a) * r * 0.35); R(sx - 1, sy, 3, 1, '#ffe066'); R(sx, sy - 1, 1, 3, '#ffe066'); }
}
// the MASTER SWITCH: a hazard box with one big red lever (thrown: every Oggle robot goes to sleep)
function masterSwitch(x, y, t, off) {
  x = Math.round(x); y = Math.round(y);
  RO(x - 7, y - 9, 14, 9, '#56606e'); R(x - 7, y - 9, 14, 1, '#c3cdd8'); R(x - 6, y - 2, 12, 2, '#2a303a');
  for (let i = 0; i < 4; i++) R(x - 6 + i * 3, y - 4, 2, 2, i % 2 ? '#1a1826' : '#ffc83a');
  if (off) { R(x + 1, y - 12, 6, 2, '#a3151a'); R(x + 6, y - 14, 3, 3, '#ff3b30'); R(x + 6, y - 14, 1, 1, '#ffd6d1'); }
  else { R(x - 1, y - 16, 2, 8, '#a3151a'); R(x - 2, y - 19, 4, 4, '#ff3b30'); R(x - 2, y - 19, 1, 1, '#ffd6d1'); }
  R(x - 5, y - 7, 2, 2, off ? '#2a303a' : Math.floor(t / 8) % 2 ? '#9dff4a' : '#2fae44');
}
L8.masterSwitch = masterSwitch;
function rexDraw(e) {
  const gy = rexGy(e), P = e.P || rexWant(e);
  // where the next thing lands
  if (e.state === 'stompUp') M8.ring(e.x - RX.FOOT, gy, RX.RING, e.st > RX.T_STOMP - 14);
  if (e.state === 'chompTell' || e.state === 'chompDown') {
    const lock = e.st > RX.FOLLOW || e.state === 'chompDown', on = Math.floor(e.t / (lock ? 3 : 6)) % 2, x0 = Math.round(e.tx - RX.ZONE);
    for (let x = x0; x < e.tx + RX.ZONE; x += 6) R(x, Math.round(gy) - 2, 4, 2, ((x - x0) / 6 + on) % 2 < 1 ? '#ff3b30' : '#ffe066');
    R(x0 - 2, Math.round(gy) - 5, 2, 5, '#ff3b30'); R(Math.round(e.tx + RX.ZONE), Math.round(gy) - 5, 2, 5, '#ff3b30');
    M8.bang(e.tx, gy - 40, e.t);
  }
  ctx.save(); ctx.beginPath(); ctx.rect(G.cam.x - 4, -4, W + 8, Math.round(gy) + 5); ctx.clip();      // nothing of it shows below the pad
  const o = glint(e, () => M8.rex(e.x, gy, -1, { body: P.body, head: e.hd, ha: e.ha, jaw: P.jaw, mood: P.mood, pilot: P.pilot, patch: true, t: e.t }));
  ctx.restore();
  if (e.state === 'stompUp') M8.bang(e.x - RX.FOOT - RX.RING - 4, gy - 22, e.t);
  if (e.state === 'stuck' || (e.state === 'chompFree' && e.st < 4)) {
    // the rubble its snout is in, the stars round its eye
    const bits = M8.rockBits();
    [[-12, -3, 2], [-3, -6, 1], [7, -3, 2], [14, -1, 0], [-18, -1, 0], [2, -1, 1]].forEach(([dx, dy, i]) => ctx.drawImage(bits[i].img, Math.round(e.tx + dx) - 7, Math.round(gy + dy) - 7));
    stars(o.eye[0], o.eye[1] - 14, e.t);
  }
  if (e.state === 'beamTell') M8.glow(o.eye[0], o.eye[1], 8 + 14 * e.st / RX.T_BEAM, '#eaffd0', 0.5 + 0.4 * e.st / RX.T_BEAM);
  if (e.state === 'roar' && e.st > 4) {                           // its breath: streaks from the jaws down to the pad
    ctx.save(); ctx.globalAlpha = 0.85;
    for (let i = 0; i < 16; i++) {
      const k = ((e.st * 5 + i * 23) % 100) / 100, spread = ((i * 37) % 41) - 20, x = o.mouth[0] - 10 - k * 200, y = o.mouth[1] + 6 + k * (78 + spread * 0.5) + spread * (0.3 + k), len = 22 - Math.round(k * 12);
      R(Math.round(x - len), Math.round(y), len, i % 3 ? 1 : 2, k < 0.5 ? '#ffffff' : '#d7eef2');
    }
    ctx.restore();
  }
  if (e.say && !e.cap) { if (o.dome[1] < 84) M8.bubble(o.dome[0] - 9, o.dome[1] - 1, e.say.s, '#e0302a', true); else M8.bubble(o.dome[0], o.dome[1] - 13, e.say.s); }
  const c = e.cap;
  if (c) {
    if (c.on) { M8.captain(c.x, c.y, -1, { pose: 'dizzy', t: e.t }); stars(c.x, c.y - 24, e.t, 8); }
    else M8.captain(c.x, c.y, -1, { pose: 'panic', t: e.t });
  }
  if (e.sw) masterSwitch(e.sw.x, e.sw.y, e.t, false);
}
ENEMY_TYPES.ogglerex = {
  hp: RX.HP, boss: true, bossName: 'OGGLE REX', armored: true, grab: false, edge: 150, activateMargin: 200, contact: 'block',
  make(e, s) {
    M8.rexWarm(true);
    const lk = e.lock;
    e.ax = lk && lk.at != null ? lk.at : G.cam.x;
    e.home = e.ax + RX.HOME;
    Object.assign(e, { state: 'intro', st: 0, inv: true, facing: -1, atk: 0, wait: 50, ph: 1, tx: e.home - 150, walk: 0, stepAt: 0, moving: false, beams: 0, tip: null, first: false, say: null, cap: null, rage: false, rest: 0, near: 0, hh: null, laughs: 0, hd: HD_IDLE.slice(), ha: 0, P: null, eyeW: [e.x - 101, e.y - 125] });
    if (!lk) { e.state = 'idle'; e.inv = false; e.home = e.x; e.ax = e.x - RX.HOME; }       // the sandbox: no entrance
    // after a continue (a game over during this fight) it comes back worn down: the health it had, at most 75 %
    e.max = e.hp;
    const k = L8.rexKeep;
    if (k && k.run === G.freed && G.continues > 0) e.hp = clamp(Math.min(k.hp, Math.round(e.max * 0.75)), 1, e.max);
    e.ph = rexPh(e);
    // its eye is a target of its own
    const eye = makeEnemy({ t: 'rexeye', x: e.x + 2, y: e.y - 125 }, lk);
    eye.rex = e; eye.active = true;
    G.enemies.push(eye);
  },
  update: rexUpdate,
  draw: rexDraw,
  box(e) { const gy = rexGy(e); return e.dying ? { x: e.x - 60, y: gy - 60, w: 110, h: 60 } : { x: e.x - 46, y: gy - 104, w: 80, h: 104 }; },
  onKill(e, cx, cy, b) {
    const p = G.p;
    e.state = 'down'; e.st = 0; e.hitT = 0; e.say = { s: 'OH NO NO NO!', t: 60 };
    G.eb = G.eb.filter(x => x.k !== 'rexrock' && x.k !== 'wave');
    for (const w of G.enemies) if (w !== e && w.active && !w.dead && !w.dying && w.type !== 'rexeye') damageEnemy(w, 99);
    G.winT = 360;
    if (p && p.dead && G.lives <= 1) G.lives = 2;
    addScore(10000, cx, b.y);
    BSFX.roar(0.7); say('Oggle Rex is going down!', 1.1, 1.05);
    return 'dying';
  }
};
// Its one eye: every hit on it is passed on to the Rex, doubled. (Its x is behind the Rex's, so that whoever aims at
// the nearest robot aims at the Rex; its box is where the eye really is.)
ENEMY_TYPES.rexeye = {
  hp: 9999, armored: true, grab: false, contact: 'none',
  make(e) { e.max = e.hp; e.x2T = 0; },
  update(e) {
    const r = e.rex;
    if (!r || r.dead || r.dying) { e.dead = true; return; }
    e.x = r.x + 2; e.y = r.eyeW[1]; e.inv = !!r.inv || r.state === 'intro';
    const d = e.max - e.hp;
    if (d <= 0) return;
    e.hp = e.max;
    damageEnemy(r, d * 2);
    r.hitT = Math.max(r.hitT, 5);
    sparks(r.eyeW[0], r.eyeW[1], 5, '#9dff4a');
    if (e.t - e.x2T > 24) { e.x2T = e.t; word(r.eyeW[0], r.eyeW[1] - 16, 'x2!', '#ffe066', 30); }
  },
  draw() {},
  // the eye and, when the head is up, the strip of head under it (for a shot straight up)
  box(e) { const r = e.rex, w = r && r.eyeW; if (!w) return { x: e.x, y: e.y, w: 1, h: 1 }; const up = r.hd[1] < -80; return { x: w[0] - 12, y: w[1] - 12, w: 24, h: up ? 42 : 30 }; }
};
// After the fight: the Rex lies where it fell, the captain sits dizzy in the dust, and the MASTER SWITCH has come down
// in front of the hero, blinking under an arrow. The mission ends when the hero throws it (touching it is enough; after
// 12 s it tips over by itself): every Oggle robot goes to sleep, the night ends (L8.dawnK), the captain waves a white
// flag, and TOPS and the babies the hero freed come running to cheer.
PROP_TYPES.rexwreck = {
  box: () => null, hit() {},
  update(o) {
    const p = G.p, sw = o.sw;
    o.t++;
    capFly(o.cap, o.y, o.ax + 24); swFly(sw, o.y);
    if (o.t % 14 === 0) G.parts.push({ type: 'smoke', x: o.x + rand(-70, 20), y: o.y - rand(30, 60), vx: rand(-0.2, 0.2), vy: -0.6, life: 50, max: 50, size: 4 });
    if (p && !p.dead && p.x > o.x - RX.DOWN) p.x = Math.max(o.x - RX.DOWN, p.x - 4);
    if (o.off) {
      o.off++;
      if (o.off === 40) L8.bellow();
      if (o.off % 40 === 20 && o.off > 50) Snd.tone('square', 700 + (o.off % 3) * 120, 1000, 0.06, 0.04);
      return;
    }
    G.winT = Math.max(G.winT, 120);                               // the win waits for the switch
    const touch = sw && sw.on && o.t >= 50 && p && !p.dead && Math.abs(p.x - sw.x) < 14 && p.y > o.y - 30;
    if (!touch && o.t < 720) return;
    o.off = 1; G.winT = 240; L8.dawnAt = G.time;
    G.big = { s: 'ALL ROBOTS OFF!', t: 130 };
    Snd.tone('square', 220, 440, 0.05, 0.1); Snd.tone('sawtooth', 520, 60, 0.9, 0.1);
    if (sw) { word(sw.x, o.y - 30, 'CLICK!', '#ffe066', 60); sparks(sw.x, o.y - 12, 10, '#9dff4a'); }
    addScore(1000, sw ? sw.x : o.x - 200, o.y - 44);
    say('Robots off! The valley is free!', 1.1, 1.1);
    if (TRACKS.dinodawn) Music.play('dinodawn');
  },
  draw(o) {
    const F = FLASH; FLASH = false;
    ctx.save(); ctx.beginPath(); ctx.rect(G.cam.x - 4, -4, W + 8, Math.round(o.y) + 5); ctx.clip();
    M8.rex(o.x, o.y, -1, { body: 'down', head: o.hd, ha: o.ha, jaw: 0.5, mood: 'off', pilot: false, patch: true, t: o.t });
    ctx.restore();
    const c = o.cap, sw = o.sw, gy = o.y, off = o.off, x0 = G.cam.x - 40, run = Math.max(0, off - 16) * 2.6;
    const at = (goal, lag) => Math.min(goal, x0 + run - lag), cx = c ? c.x : o.ax + 120;
    if (off) {                                                    // TOPS trots in behind the others
      const goal = Math.max(o.ax + 44, cx - 64), x = at(goal, 0), there = x >= goal;
      if (x > x0) M8.tops(x, gy - (there && Math.floor(o.t / 10) % 2 ? 2 : 0), 1, { pose: there ? 'happy' : 'walk', t: o.t * (there ? 1 : 2) });
    }
    if (c) {
      if (!c.on) M8.captain(c.x, c.y, -1, { pose: 'panic', t: o.t });
      else if (!off) { M8.captain(c.x, c.y, -1, { pose: 'dizzy', t: o.t }); stars(c.x, c.y - 24, o.t, 8); }
      else {
        M8.captain(c.x, c.y, -1, { pose: 'wave', t: o.t });
        const up = Math.floor(o.t / 10) % 2, fx = Math.round(c.x) - 11, fy = Math.round(c.y) - (up ? 24 : 22);
        R(fx, fy, 1, 11, '#8a97a8'); R(fx - 7, fy, 7, 5, '#ffffff'); R(fx - 7, fy + 4, 7, 1, '#c3cdd8');
        if (off % 150 < 90) M8.bubble(c.x, c.y - 28, 'I GIVE UP!');
      }
    }
    if (sw) {
      masterSwitch(sw.x, sw.y, o.t, !!off);
      if (!off && sw.on && o.t >= 50) {                           // "this!": the name and an arrow that bobs
        const x = Math.round(sw.x), y = Math.round(gy) - 34 + (Math.floor(o.t / 8) % 2) * 2;
        text('MASTER SWITCH', x, y - 12, Math.floor(o.t / 16) % 2 ? '#ffe066' : '#ffffff', 1, 'center');
        R(x - 1, y, 3, 5, '#ffe066'); R(x - 4, y + 5, 9, 1, '#ffe066'); R(x - 3, y + 6, 7, 1, '#ffe066'); R(x - 2, y + 7, 5, 1, '#ffe066'); R(x - 1, y + 8, 3, 1, '#ffe066'); R(x, y + 9, 1, 1, '#ffe066');
      }
    }
    if (off) {                                                    // the babies, round the captain, hopping for joy
      const n = Math.min(8, G.freed ? G.freed.size : 0);
      for (let i = n - 1, right = 0; i >= 0; i--) {
        const g0 = cx - 22 - i * 14, goal = g0 >= o.ax + 10 ? g0 : cx + 34 + right++ * 14, x = at(goal, 30 + i * 12), there = x >= goal;
        if (x > x0) M8.hatchling(x, gy - (there && Math.floor((o.t + i * 7) / 8) % 2 ? 3 : 0), 1, { v: i & 3, pose: there ? 'hop' : 'run', t: o.t + i * 5 });
      }
    }
    FLASH = F;
  }
};
// 0 = night, 1 = the morning after the switch was thrown (the scenery fades with it)
L8.dawnK = () => L8.dawnAt == null ? 0 : clamp((G.time - L8.dawnAt) / 170, 0, 1);
// Over the hero: the beam, the line that warns of it, DUCK!, the tip about the eye
L8.bossFront = function (cx) {
  const e = G.enemies.find(x => x.type === 'ogglerex' && x.active && !x.dead);
  if (!e || !e.eyeW) return;
  ctx.save(); ctx.translate(-Math.round(cx), 0);
  const ex = Math.round(e.eyeW[0]), ey = Math.round(e.eyeW[1]), x0 = Math.round(cx) - 4;
  if (e.state === 'beamTell' && e.st > 14) {
    const on = Math.floor(e.t / 3) % 2;
    for (let x = ex - 12 - on * 4; x > x0; x -= 8) R(x, ey, 4, 1, on ? '#ff3b30' : '#ffe066');
    const p = G.p;
    if (p && !p.dead && e.beams <= 3) {                           // the first times: say what to do
      const x = Math.round(p.x), y = Math.round(p.y) - 56 + (Math.floor(e.t / 6) % 2);
      text('DUCK!', x, y, '#ffe066', 1, 'center');
      R(x - 1, y + 9, 3, 4, '#ffe066'); R(x - 3, y + 13, 7, 1, '#ffe066'); R(x - 2, y + 14, 5, 1, '#ffe066'); R(x - 1, y + 15, 3, 1, '#ffe066');
    }
  }
  if (e.state === 'beam') {
    const w = e.st < 3 ? 2 + e.st * 2 : e.st > RX.BEAM - 4 ? Math.max(1, (RX.BEAM - e.st) * 2) : 7 + (Math.floor(e.t / 2) % 2);
    M8.glow(ex - 6, ey, 22, '#9dff4a', 0.8);
    ctx.fillStyle = 'rgba(157,255,74,0.45)'; ctx.fillRect(x0, ey - w, ex - 6 - x0, w * 2 + 1);
    ctx.fillStyle = '#9dff4a'; ctx.fillRect(x0, ey - Math.ceil(w / 2), ex - 6 - x0, Math.ceil(w / 2) * 2 + 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, ey - 1, ex - 6 - x0, 3);
  }
  ctx.restore();
  if (e.tip && !e.dying && Math.floor(e.tip.t / 10) % 4) text(e.tip.s, W / 2, 60, '#ffe066', 1, 'center');
};

// =====================================================================================================================
// Falling rocks (the chase and the OGGLE REX's stomp shake them loose). b.tx = where it lands (the ring is there from
// the start), b.wait = frames before it comes down, b.big = a bigger one. They can be shot out of the air.
// =====================================================================================================================
const ROCKS = M8.memo(() => [7, 9].map((r, i) => {
  const { buf, shape, put, get, form, outline, mk, NONE } = M8.px, K0 = M8.art.K0, b = buf(r * 2 + 6, r * 2 + 6, r + 3, r + 3);
  shape(b, -r - 1, -r - 1, r + 1, r + 1, (x, y) => { const a = Math.atan2(y, x); return Math.hypot(x, y) <= r * (1 + 0.13 * Math.sin(a * 3 + i * 2) + 0.07 * Math.sin(a * 5 + 1)); }, K0);
  form(b, K0, M8.PAL2.ROCK, { depth: r * 0.8, amb: 0.5, grain: (x, y) => (M8.fbm(x * 0.5, y * 0.5, 5 + i) - 0.5) * 0.5 });
  for (const [x, y] of [[-2, -1], [-1, 0], [0, 0], [1, 1], [2, 3]]) if (get(b, x, y) !== NONE) put(b, x, y, M8.PAL2.ROCK[0]);
  outline(b);
  const s = mk(b, false);
  return { img: s.img, w: s.w, h: s.h, ox: s.ox, oy: s.oy };
}));
L8.rockSprite = big => ROCKS()[big ? 1 : 0];
EB_TYPES.rexrock = {
  r: 7, shootable: true,
  update(b) {
    if (b.wait > 0) { b.x = b.tx; b.y = -24; b.vy = 0; if (--b.wait === 0) { b.vy = 4.8; SFX.drop(); } }
    b.rot = (b.rot || 0) + 0.12;
  },
  draw(b) {
    M8.ring(b.tx, groundAt(b.tx), b.big ? 13 : 10, b.wait <= 0 && b.y > 100);
    if (b.wait > 0) return;
    const s = ROCKS()[b.big ? 1 : 0];
    ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(Math.round(b.rot / (Math.PI / 4)) * Math.PI / 4);
    ctx.drawImage(s.img, -s.ox, -s.oy); ctx.restore();
  },
  onGround(b) {
    const gy = groundAt(b.x), bits = M8.rockBits();
    for (let i = 0; i < 6; i++) G.parts.push({ type: 'sprite', s: bits[i % 3], x: b.x + rand(-4, 4), y: gy - 4, vx: rand(-2.2, 2.2), vy: rand(-3.6, -1.4), g: 0.22, rot: rand(0, 6.28), vr: rand(-0.4, 0.4), life: rand(26, 44) | 0, max: 44 });
    dust(b.x, gy, 6); G.shake = Math.max(G.shake, 2.5); BSFX.thud(0.6);
  },
  onHit(b) { dust(b.x, b.y, 4); }
};
}
