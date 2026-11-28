'use strict';
var L8 = L8 || {};
// =====================================================================================================================
// Mission 8 (DINOSAUR VALLEY), AREA 4: REX RUN! The OGGLE REX hunts the hero from the canyon to the hatchery's gate.
//
// The Rex of the chase belongs to the level (it is not an enemy: nothing can shoot it, the bot never aims at it).
//   - The ground thumps from x 4430 on. At x 4560 its head bursts in at the left edge of the screen: RUN!
//   - While the hero makes headway it only follows, its snout 76 px inside the screen. When the screen stands still
//     (a boulder wall, a fight, a dawdler) the snout creeps up at half a pixel a frame.
//   - Within 40 px of the hero it BITES: the jaws open, a red '!' and a marked strip on the ground show for 40
//     frames, then they snap. The strip stays where it was marked: from the moment the jaws open the head no longer
//     follows the screen, so whoever runs on leaves the strip and the bite misses (on foot 11 frames of running are
//     enough, on TOPS 8). A bite costs a heart (or one of TOPS's pips), throws the hero ahead and smashes a boulder
//     wall in the way, so nobody is ever stuck. It then needs two seconds.
//   - Its steps shake rocks loose: each comes down on a ringed spot where the hero stood about a second before
//     (never while a wall bars the way). Keep moving and none can touch you.
//   - Robots it catches up with are trampled. TOPS, left standing, bolts ahead before it reaches her.
//   - THE BRIDGE (x 5500-5620): logs over a chasm; the hatchery's gate beyond it is shut. Once the hero is across,
//     the Rex thunders onto the logs. They crack, it hangs for a moment, and falls. The crash bursts the gate's lock.
//     From then on the bridge is gone (the hero cannot go back) and the gate is open.
//
// L8.chase = { load(cp), update(), hud(), active(), drawGround(cx), drawFront(cx) }: level8.js calls the first four,
// the scenery the last two (drawGround in the world's space after the ground, drawFront in the screen's space).
// Everything else is private to the block. rand() only in update code.
// =====================================================================================================================
{
const Math = globalThis.Math;
const { NONE, buf, put, get, rect, shape, oval, poly, line, outline, form, mk, blit } = M8.px;
const I = M8.I, P = M8.P, K0 = M8.art.K0, K1 = M8.art.K1;
const BSFX = L8.BSFX, ROCK = M8.PAL2.ROCK, STEEL = M8.PAL.STEEL, GRN = M8.PAL.GRN, AMB = M8.PAL.AMB;
const WOOD = P('#2e1c10', '#4a2c16', '#6e431f', '#96602c', '#bd8440', '#dcaa62');
const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const mixP = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

const RUMBLE = 4430, START = 4560, BR0 = 5500, BR1 = 5620, FAR = BR1 + 12, STAND = 5548, GATE = L8.GATE_X;
const REST = 76, BITE = 40, T_TELL = 40, CREEP = 0.5, LEAD = 160;    // LEAD: the snout is that far ahead of its hips
const H_RUN = [100, -58], H_TELL = [86, -76], H_SNAP = [127, -34], H_HIGH = [80, -112];
const C = { mode: 'off', t: 0, off: -90, hx: 0, gy: 228, cam: 0, walk: 0, stepAt: 0, biteCd: 0, wait: 0, rockT: 0, toss: 0, fall: 0, vy: 0, hx0: 0, gate: 0, bridge: 1, sag: 0, hit: false, lunge: 27, warmed: false };
const chasing = () => C.mode === 'in' || C.mode === 'run' || C.mode === 'tell' || C.mode === 'snap' || C.mode === 'back';
const finale = () => C.mode === 'bridge' || C.mode === 'crack' || C.mode === 'fall' || C.mode === 'crash';
const snout = () => C.hx + LEAD;

function load(cp) {
  const done = cp >= GATE;
  Object.assign(C, { mode: done ? 'done' : 'off', t: 0, off: -90, hx: 0, gy: 228, cam: G.cam.x, walk: 0, stepAt: 0, biteCd: 0, wait: 0, rockT: 90, toss: 0, fall: 0, vy: 0, hx0: 0, gate: done ? 1 : 0, bridge: done ? 0 : 1, sag: 0, hit: false, lunge: 27 });
  if (!C.warmed) { C.warmed = true; M8.rexWarm(false); }
}
function go(m) { C.mode = m; C.t = 0; }

// ---------------------------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------------------------
function bite(p) {
  G.shake = Math.max(G.shake, 7); BSFX.crunch();
  // boulders between the jaws and the hero's way out fall apart
  for (const e of G.enemies) if (e.type === 'boulderwall' && !e.dead && e.x > p.x - 30 && e.x < p.x + 120) damageEnemy(e, 99);
  const riding = !!p.ride, before = p.inv;
  hurtPlayer();
  C.hit = p.inv > before || p.dead;
  if (p.dead) return;
  // thrown ahead, out of its reach
  if (p.ride) { C.toss = 12; p.vy = -3; p.onGround = false; }
  else { p.kb = riding ? 3.4 : 4.4; p.vy = Math.min(p.vy, -3.4); p.onGround = false; p.onPlat = null; p.facing = 1; }
  G.texts.push({ x: p.x + 40, y: p.y - 52, s: 'CHOMP!', t: 50, c: '#ff8a5c' });
}
function trample(sx) {
  for (const e of G.enemies) {
    if (!e.active || e.dead || e.dying || ENEMY_TYPES[e.type].boss || e.x > sx - 16 || e.y < groundAt(e.x) - 44) continue;
    const b = ebox(e);
    e.inv = false;
    damageEnemy(e, 99);
    sparks(b.x + b.w / 2, b.y + b.h / 2, 6, '#9dff4a'); BSFX.crunch();
  }
  // TOPS, left standing, runs for it (she waits again further on)
  const run = [];
  for (const o of G.props) if (o.k === 'tops' && !o.dead && o.x <= sx + 30) { o.dead = true; run.push(o); }
  for (const o of run) { G.props.push({ k: 'topsrun', x: o.x, y: o.y, hitT: 0, dead: false, facing: 1, r: o.r, t: 0, scared: true }); L8.bellow(); }
}
function steps(dx) {
  C.walk += Math.abs(dx);
  if (C.walk - C.stepAt < 40) return;
  C.stepAt = C.walk;
  G.shake = Math.max(G.shake, 1.5); BSFX.thud(0.4);
}
function update() {
  const p = G.p;
  if (!p) return;
  const cam = G.cam.x, alive = !p.dead, moved = cam - C.cam;
  C.cam = cam; C.t++;
  if (C.biteCd > 0) C.biteCd--;
  if (C.toss > 0 && alive) { C.toss--; if (p.ride) p.x = Math.min(p.x + 3.2, cam + W - 24, GATE - 30); }
  switch (C.mode) {
    case 'off':                                                  // something very big is coming
      if (alive && p.x >= RUMBLE && p.x < START && C.t % 44 === 0) {
        const k = (p.x - RUMBLE) / (START - RUMBLE);
        G.shake = Math.max(G.shake, 1.5 + k * 2.5); BSFX.thud(0.5 + k * 0.6);
        if (k > 0.5) dust(cam + 6, groundAt(cam + 6), 3, 1);
      }
      if (alive && p.x >= START && !G.intro) {
        go('in'); C.off = -90;
        G.big = { s: 'RUN!', t: 110 }; G.shake = Math.max(G.shake, 9);
        BSFX.roar(1); say('Run!');
        const gy = groundAt(cam + 4), bits = M8.rockBits();
        for (let i = 0; i < 12; i++) G.parts.push({ type: 'sprite', s: bits[i % 3], x: cam + rand(-6, 10), y: gy - rand(10, 90), vx: rand(1.4, 4.4), vy: rand(-3.4, -0.6), g: 0.2, rot: rand(0, 6.28), vr: rand(-0.4, 0.4), life: rand(40, 64) | 0, max: 64 });
        dust(cam + 8, gy, 10, 1);
      }
      break;
    case 'in':                                                   // the head bursts in
      C.off = -90 + (REST + 90) * ease(C.t / 44);
      if (C.t >= 44) { go('run'); C.biteCd = 60; }
      break;
    case 'run': {
      if (!alive) { C.off = Math.max(-30, C.off - 2); C.wait = 90; }       // it backs off while the hero is down
      else if (C.wait > 0) C.wait--;
      else if (C.off < REST) C.off = Math.min(REST, C.off + 1.5);
      else if (moved > 0.5) C.off = Math.max(REST, C.off - 0.8);
      else C.off = Math.min(C.off + CREEP, Math.max(REST, p.x - cam - 14));
      if (alive && C.wait <= 0 && C.biteCd <= 0 && p.x - (cam + C.off) < BITE && p.x < FAR - 20) { go('tell'); L8.SFX.beep(3); BSFX.growl(); }
      // rocks, shaken loose: where the hero stands now
      if (--C.rockT <= 0) {
        C.rockT = 84 + (rand(0, 56) | 0);
        const wall = G.enemies.some(e => e.type === 'boulderwall' && !e.dead && e.x > p.x - 20 && e.x < p.x + 120);
        if (alive && !wall && p.x < BR0 - 70 && p.x - (cam + C.off) > 70) G.eb.push({ k: 'rexrock', x: p.x, y: -24, tx: p.x, vx: 0, vy: 0, wait: 14, life: 400, big: rand(0, 1) < 0.4 });
      }
      break;
    }
    case 'tell':                                                 // jaws wide: 40 frames to get away
      C.off = Math.max(-30, C.off - moved);                       // the head stays over the strip it marked, not on the screen
      if (C.t % 8 === 0) L8.SFX.beep(2);
      if (C.t >= T_TELL) { go('snap'); BSFX.whoosh(); C.hit = false; C.lunge = clamp(p.x - snout() + 6, 24, 66); }      // the neck telescopes out as far as the hero stands
      break;
    case 'snap':
      C.off = Math.max(-30, C.off - moved);
      if (C.t === 4) {
        if (alive && p.x - (cam + C.off) < BITE + 18) bite(p);
        else { BSFX.clang(); G.shake = Math.max(G.shake, 3); }
      }
      if (C.t >= 14) { go('back'); C.biteCd = 120; }
      break;
    case 'back':                                                 // it pulls its head back
      C.off = Math.max(REST - 44, C.off - 1.4);
      if (C.t >= 32) go('run');
      break;
    case 'bridge': {                                             // out onto the logs after the hero
      const v = 3.7;
      C.hx = Math.min(STAND, C.hx + v); steps(v);
      C.sag = Math.min(3, C.sag + 0.1);
      if (C.t % 5 === 0) dust(C.hx - 8, 228, 1, -1);
      if (C.hx >= STAND) {
        go('crack');
        G.shake = Math.max(G.shake, 8); BSFX.crunch(); Snd.noise(0.5, 0.3, 1400);
        G.texts.push({ x: (BR0 + BR1) / 2, y: 196, s: 'CRACK!', t: 70, c: '#ffe066' });
        splinters(8);
      }
      break;
    }
    case 'crack':                                                // the logs give way under it
      C.sag = 3 + 6 * ease(C.t / 34);
      if (C.t % 9 === 0) { splinters(3); Snd.noise(0.12, 0.18, 2000); G.shake = Math.max(G.shake, 3); }
      if (C.t === 12) BSFX.squeak();
      if (C.t >= 38) {
        go('fall'); C.bridge = 0; C.vy = 0.6; C.fall = 0;
        G.shake = Math.max(G.shake, 9); BSFX.crunch(); BSFX.roar(0.8);
        logsFall();
      }
      break;
    case 'fall':
      C.fall += C.vy; C.vy = Math.min(C.vy + 0.34, 9);
      C.hx = Math.min(STAND + 26, C.hx + 1);                      // toward the middle of the hole as it tips over
      if (C.fall > 210) {
        go('crash');
        G.shake = Math.max(G.shake, 12); BSFX.thud(1.8); Snd.noise(1.1, 0.3, 500);
        G.texts.push({ x: (BR0 + BR1) / 2, y: 206, s: 'CRASH!', t: 80, c: '#ffe066' });
        for (let i = 0; i < 26; i++) G.parts.push({ type: 'dust', x: rand(BR0 + 8, BR1 - 8), y: 236 + rand(0, 20), vx: rand(-0.7, 0.7), vy: rand(-3.4, -1.2), life: rand(34, 70) | 0, max: 70, size: rand(3, 7) });
        addScore(2000, (BR0 + BR1) / 2, 180);
      }
      break;
    case 'crash':                                                // far below, somebody is cross; the gate's lock bursts
      if (C.t === 34) BSFX.squeak();
      if (C.t === 50) { sparks(GATE + 13, 150, 14, '#9dff4a'); boom(GATE + 13, 150, 0.6); Snd.tone('square', 440, 880, 0.2, 0.08); }
      if (C.t > 50) { C.gate = ease((C.t - 50) / 46); if (C.t % 6 === 0) Snd.noise(0.05, 0.05, 900); }
      if (C.t >= 100) { go('done'); C.gate = 1; G.goT = 180; Snd.select(); }
      break;
  }
  const hunting = chasing();
  if (hunting) {
    const hx = cam + C.off - LEAD;
    steps(hx - C.hx);
    C.hx = hx;
    const sx = cam + C.off;
    trample(sx);
    if (alive && p.x < sx - 44) p.x = sx - 44;                    // under its chin: no further
    if (alive && C.mode !== 'snap' && C.mode !== 'in' && p.x >= FAR) {
      go('bridge'); C.hx0 = C.hx; BSFX.roar(1.1); G.shake = Math.max(G.shake, 6);
      G.eb = G.eb.filter(b => b.k !== 'rexrock');
      trample(FAR + 40);                                            // nobody stays on the logs (TOPS runs to the gate)
    }
  }
  C.gy += (groundAt(clamp(C.hx + LEAD - 40, 0, LV.end)) - C.gy) * 0.2;
  // the way back and the way on
  if (alive && (finale() || C.mode === 'done') && p.x < FAR - 4) p.x = FAR - 4;
  if (alive && C.gate < 0.9) { const lim = GATE - (p.ride ? 28 : 10); if (p.x > lim) { p.x = lim; if (!p.ride && p.vx > 0) p.vx = 0; } }
}

// ---------------------------------------------------------------------------------------------------------------------
// The picture: the chasm, the log bridge, the gate
// ---------------------------------------------------------------------------------------------------------------------
const LOG = M8.memo(() => [0, 1, 2].map(i => {
  const b = buf(14, 14, 7, 7);
  oval(b, 0, 0, 5.4, 5.4, K0);
  form(b, K0, WOOD, { depth: 5, amb: 0.5 });
  // the cut end: pale wood, rings
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
    const d = Math.hypot(x + 0.5 - (i - 1) * 0.3, y + 0.5);
    if (d < 3.6) put(b, x, y, d < 1.1 ? WOOD[3] : d < 2.4 ? ((i + (d | 0)) % 2 ? WOOD[5] : WOOD[4]) : WOOD[4]);
  }
  put(b, i - 1, 0, WOOD[2]);
  outline(b);
  const s = mk(b, false);
  return { img: s.img, w: s.w, h: s.h, ox: s.ox, oy: s.oy };
}));
const POST = M8.memo(() => {
  const b = buf(12, 40, 6, 36);
  rect(b, -3, -32, 6, 34, K0); rect(b, -4, -34, 8, 3, K0);
  form(b, K0, WOOD, { depth: 3, amb: 0.5, grain: (x, y) => (M8.fbm(x * 0.9, y * 0.2, 4) - 0.5) * 0.5 });
  for (const y of [-26, -25, -9, -8]) for (let x = -3; x < 3; x++) put(b, x, y, y % 2 ? I('#e8dcb8') : I('#b8a880'));   // rope
  outline(b);
  return mk(b, false);
});
const CHASM = M8.memo(() => {
  const w = BR1 - BR0, h = H - 226, b = buf(w, h, 0, 0);
  const VOID = P('#3a2a48', '#2a1c38', '#1c1228', '#120a1c', '#0a0612');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = 5 + M8.fbm(y * 0.11, 2.3, 9) * 9 + y * 0.16, r = w - 6 - M8.fbm(y * 0.13, 7.1, 11) * 9 - y * 0.18;
    if (x < l || x > r) {                                         // the rock walls, lit from above
      const d = x < l ? l - x : x - r, k = clamp(1 - y / h * 1.1, 0, 1) * 0.8 + M8.fbm(x * 0.3, y * 0.3, 2) * 0.4 - (d < 2 ? 0.25 : 0);
      put(b, x, y, ROCK[clamp(Math.round(k * 4), 0, 4)]);
    } else {
      const k = y / h + (M8.fbm(x * 0.08, y * 0.2, 6) - 0.5) * 0.3;
      put(b, x, y, VOID[clamp(Math.floor(k * 5), 0, 4)]);
    }
  }
  return mk(b, false);
});
const GATE_ART = M8.memo(() => {
  const DK = P('#10141c', '#1a2030', '#262e42', '#343e56');
  // the far jamb: the dark inside of the doorway
  const jamb = buf(28, 74, 0, 0);
  for (let y = 0; y < 74; y++) for (let x = 0; x < 28; x++) put(jamb, x, y, DK[x < 3 || x > 24 ? 2 : (y < 3 ? 2 : (x + y) % 9 === 0 ? 1 : 0)]);
  // the shutter: steel slats, a hazard band along its foot
  const sh = buf(24, 72, 0, 0);
  for (let y = 0; y < 72; y++) for (let x = 0; x < 24; x++) {
    const s = y % 8;
    put(sh, x, y, s === 0 ? STEEL[5] : s === 7 ? STEEL[1] : y > 62 ? (((x + y) >> 2) % 2 ? AMB[3] : I('#1a1826')) : STEEL[x < 2 ? 4 : x > 21 ? 2 : 3]);
  }
  for (let y = 4; y < 60; y += 16) { put(sh, 4, y, STEEL[5]); put(sh, 19, y, STEEL[5]); }
  outline(sh);
  // the wall over the doorway: plates, a hazard lintel, the socket of the lamp
  const wall = buf(34, 160, 0, 0);
  for (let y = 0; y < 160; y++) for (let x = 0; x < 34; x++) {
    const plate = y % 26 === 0 || x === 0 || x === 33, lit = x < 3 ? 5 : x < 6 ? 4 : x > 29 ? 1 : x > 26 ? 2 : 3;
    put(wall, x, y, plate ? STEEL[1] : y % 26 === 1 ? STEEL[Math.min(5, lit + 1)] : STEEL[lit]);
  }
  for (let y = 26; y < 160; y += 26) for (const x of [5, 28]) { put(wall, x, y + 5, STEEL[5]); put(wall, x, y + 6, STEEL[0]); }
  for (let y = 148; y < 158; y++) for (let x = 1; x < 33; x++) put(wall, x, y, ((x + y) >> 2) % 2 ? AMB[3] : I('#1a1826'));
  for (let x = 0; x < 34; x++) { put(wall, x, 146, STEEL[0]); put(wall, x, 147, STEEL[5]); put(wall, x, 158, STEEL[0]); put(wall, x, 159, STEEL[0]); }
  shape(wall, 9, 118, 25, 134, (x, y) => Math.hypot(x - 17, y - 126) <= 8, GRN[1]);
  shape(wall, 11, 120, 23, 132, (x, y) => Math.hypot(x - 17, y - 126) <= 6, I('#0a1410'));
  return { jamb: mk(jamb, false), sh: mk(sh, false), wall: mk(wall, false) };
});
function splinters(n) {
  const bits = LOG();
  for (let i = 0; i < n; i++) G.parts.push({ type: 'spark', x: rand(BR0 + 20, BR1 - 20), y: 228 + rand(0, 6), vx: rand(-1.6, 1.6), vy: rand(-3, -1), g: 0.2, life: rand(14, 26) | 0, max: 26, size: i % 2 ? 1 : 2, c: i % 3 ? '#bd8440' : '#dcaa62' });
  void bits;
}
function logsFall() {
  const L = LOG();
  for (let i = 2; i < 10; i++) G.parts.push({ type: 'sprite', s: L[i % 3], x: BR0 + 5 + i * 10, y: 232 + C.sag, vx: rand(-1.2, 1.2), vy: rand(-2.6, 0.5), g: 0.3, rot: rand(0, 6.28), vr: rand(-0.3, 0.3), life: 60, max: 60 });
  splinters(18);
}
function rope(x0, y0, x1, y1, sag, col) {
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / 2));
  for (let i = 0; i <= n; i++) { const u = i / n; R(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag), 2, 1, col); }
}
// in the world's space, after the ground: the hole, what is left of the bridge, the gate's back
function drawGround(cx) {
  if (cx + W + 20 > BR0 && cx - 20 < BR1) {
    blit(CHASM(), BR0, 226);
    R(BR0 - 2, 226, 3, 3, '#1a1410'); R(BR1 - 1, 226, 3, 3, '#1a1410');
    const L = LOG(), post = POST();
    blit(post, BR0 - 5, 230); blit(post, BR1 + 5, 230);
    if (C.bridge) {
      const wob = C.mode === 'crack' ? (Math.floor(C.t / 2) % 2 ? 1 : -1) : 0;
      // the two long beams under the logs, the logs, the hand rope
      for (let x = BR0; x < BR1; x += 2) { const u = (x - BR0) / (BR1 - BR0), y = 236 + Math.round(Math.sin(u * Math.PI) * C.sag); R(x, y, 2, 3, '#2e1c10'); R(x, y, 2, 1, '#4a2c16'); }
      for (let i = 0; i < 12; i++) {
        const u = (i + 0.5) / 12, y = 232 + Math.sin(u * Math.PI) * C.sag + (i % 2 ? wob : -wob) * (C.sag > 4 ? 1 : 0);
        blit(L[i % 3], BR0 + 5 + i * 10, y);
        if (i % 3 === 1) { R(BR0 + 9 + i * 10, Math.round(y) - 4, 2, 9, '#e8dcb8'); R(BR0 + 10 + i * 10, Math.round(y) - 4, 1, 9, '#b8a880'); }
      }
      rope(BR0 - 5, 204, BR1 + 4, 204, 9 + C.sag, '#e8dcb8');
    } else {
      // stumps: two logs hang at each end, the ropes trail down
      blit(L[0], BR0 + 4, 232); blit(L[1], BR0 + 12, 237); blit(L[2], BR1 - 4, 232); blit(L[1], BR1 - 12, 238);
      rope(BR0 - 5, 204, BR0 + 9, 240, -3, '#e8dcb8'); rope(BR1 + 4, 204, BR1 - 10, 242, -3, '#e8dcb8');
      R(BR0 + 15, 240, 1, 9, '#b8a880'); R(BR1 - 16, 241, 1, 12, '#b8a880');
    }
  }
  if (cx + W + 20 > GATE && cx - 60 < GATE) {
    const A = GATE_ART(), up = Math.round(C.gate * 66);
    blit(A.jamb, GATE - 1, 156);
    ctx.save(); ctx.beginPath(); ctx.rect(GATE - 2, 156, 32, 74); ctx.clip();
    blit(A.sh, GATE + 1, 157 - up);
    ctx.restore();
  }
}
// in the screen's space, over the actors: the Rex, its warnings, the wall over the gate
function drawRex() {
  if (C.mode === 'off' || C.mode === 'done' || C.mode === 'crash') return null;
  const run = [H_RUN[0], H_RUN[1] + Math.sin(C.walk / 20 * Math.PI) * 2];
  let head = run, ha = 0.15, jaw = Math.floor(C.walk / 26) % 2 ? 0.5 : 0, mood = 'look', pilot = 'drive', body = 'walk:' + (Math.floor(C.walk / 10) % 8), y = C.gy;
  if (C.mode === 'in') { const k = ease(C.t / 30); head = mixP([H_RUN[0] - 6, H_RUN[1] - 14], run, k); ha = -0.3 + 0.45 * k; jaw = 1; mood = 'hot'; }
  else if (C.mode === 'tell') { const k = ease(C.t / 16); head = mixP(run, H_TELL, k); ha = 0.15 - 0.45 * k; jaw = k > 0.4 ? 1 : 0.5; mood = 'warn'; }
  else if (C.mode === 'snap') { const k = ease(C.t / 4); head = mixP(H_TELL, [H_RUN[0] + C.lunge, H_SNAP[1]], k); ha = -0.3 + 0.6 * k; jaw = C.t < 4 ? 1 : 0; mood = 'hot'; pilot = C.hit ? 'cheer' : 'drive'; }
  else if (C.mode === 'back') { const k = ease(C.t / 26); head = mixP([H_RUN[0] + C.lunge, H_SNAP[1]], run, k); ha = 0.3 - 0.15 * k; jaw = 0; pilot = C.hit ? 'cheer' : 'ouch'; }
  else if (C.mode === 'bridge') { const k = ease((C.hx - C.hx0) / Math.max(1, STAND - C.hx0)); head = mixP(run, H_HIGH, k); ha = 0.15 - 0.3 * k; jaw = 1; mood = 'hot'; pilot = 'cheer'; y = 228; }
  else if (C.mode === 'crack') { head = [H_HIGH[0], H_HIGH[1] + (Math.floor(C.t / 3) % 2)]; ha = -0.15; jaw = 0.5; mood = 'warn'; pilot = 'panic'; body = 'idle:' + (Math.floor(C.t / 4) % 2); y = 228 + C.sag; }
  else if (C.mode === 'fall') { head = [H_HIGH[0] - 4, H_HIGH[1] - 6]; ha = -0.6; jaw = 1; mood = 'dizzy'; pilot = 'panic'; body = 'roar'; y = 228 + C.sag + C.fall; }
  const clip = C.mode === 'fall' || C.mode === 'crack';
  if (clip) {
    // it goes down tail first, nose in the air; the banks hide what is below their edge
    ctx.save(); ctx.beginPath(); ctx.rect(G.cam.x - 20, -40, W + 40, 268); ctx.rect(BR0 + 3, 228, BR1 - BR0 - 6, 80); ctx.clip();
    if (C.mode === 'fall') { const a = -Math.min(1.05, C.t * 0.045); ctx.translate(Math.round(C.hx) + 10, Math.round(y) - 40); ctx.rotate(a); ctx.translate(-Math.round(C.hx) - 10, -Math.round(y) + 40); }
  }
  const o = M8.rex(C.hx, y, 1, { body, head, ha, jaw, mood, pilot, t: C.t });
  if (clip) ctx.restore();
  return o;
}
function drawFront(cx) {
  ctx.save(); ctx.translate(-Math.round(cx), 0);
  const o = drawRex();
  if (o) {
    if (C.mode === 'tell' || (C.mode === 'snap' && C.t < 4)) {
      // where the jaws come down
      const x0 = Math.round(snout() - 30), x1 = Math.round(snout() + BITE + 18), gy = Math.round(groundAt(snout() + 20)), on = Math.floor(C.t / 4) % 2;
      for (let x = x0; x < x1; x += 6) R(x, gy - 2, 4, 2, ((x - x0) / 6 + on) % 2 < 1 ? '#ff3b30' : '#ffe066');
      M8.bang(o.snout[0] + 6, o.snout[1] - 22, C.t);
    }
    if (C.mode === 'crack' && C.t > 10) M8.bubble(o.dome[0], o.dome[1] - 14, 'UH-OH!');
  }
  if (C.mode === 'crash' && C.t > 30 && C.t < 96) M8.bubble((BR0 + BR1) / 2, 232 - Math.min(14, (C.t - 30) * 0.5), "I'LL BE BACK!");
  // the hatchery's wall over its gate, the lamp in it
  if (cx + W + 20 > GATE && cx - 60 < GATE) {
    blit(GATE_ART().wall, GATE - 3, -2);
    const open = C.gate > 0, on = Math.floor(G.t / 14) % 2;
    R(GATE + 12, 121, 5, 7, open ? '#3fd15a' : on ? '#ff3b30' : '#a3151a'); R(GATE + 11, 122, 7, 5, open ? '#3fd15a' : on ? '#ff3b30' : '#a3151a');
    R(GATE + 13, 123, 3, 3, '#1a0a12'); R(GATE + 12, 122, 2, 2, '#ffffff');
    if (!open) M8.glow(GATE + 14, 124, 14, '#ff3b30', on ? 0.5 : 0.25); else M8.glow(GATE + 14, 124, 14, '#3fd15a', 0.4);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------
// The strip along the foot of the screen: how far to the bridge, how close the Rex is
// ---------------------------------------------------------------------------------------------------------------------
function hud() {
  if (!chasing() && C.mode !== 'bridge') return;
  const x0 = 150, w = 180, y = 259, k = x => clamp((x - START + 140) / (FAR - START + 140), 0, 1);
  RO(x0 - 34, y - 6, w + 60, 13, 'rgba(10,14,24,0.72)');
  if (Math.floor(G.t / 12) % 2) text('RUN!', x0 - 30, y - 3, '#ffe066');
  for (let x = 0; x < w; x += 4) R(x0 + x, y, 2, 1, '#56606e');
  // the bridge at the end of the strip
  R(x0 + w - 1, y - 3, 1, 6, '#bd8440'); R(x0 + w + 9, y - 3, 1, 6, '#bd8440'); for (let i = 0; i < 4; i++) R(x0 + w + 1 + i * 2, y - (i % 2), 1, 2, '#dcaa62');
  // the Rex's head (green, one eye) and the hero
  const rx = Math.round(x0 + k(snout()) * w), px = Math.round(x0 + k(G.p ? G.p.x : START) * w);
  R(rx - 8, y - 3, 8, 5, '#12502a'); R(rx - 8, y - 4, 6, 2, '#2fae44'); R(rx - 4, y - 2, 4, 2, '#2fae44'); R(rx - 6, y - 3, 2, 2, C.mode === 'tell' || C.mode === 'snap' ? '#ff3b30' : '#f6fbff'); R(rx - 3, y + 1, 1, 1, '#f6fbff'); R(rx - 1, y + 1, 1, 1, '#f6fbff');
  const hc = HEROES[G.hero] ? HEROES[G.hero].col : '#ffffff';
  R(px - 1, y - 4, 3, 3, '#ffd8b0'); R(px - 1, y - 1, 3, 3, hc); R(px - 1, y + 2, 1, 2, '#33467d'); R(px + 1, y + 2, 1, 2, '#33467d');
}

L8.chase = { load, update, hud, active: chasing, finale, drawGround, drawFront, state: C, START, BR0, BR1, FAR, gateArt: GATE_ART };
}
