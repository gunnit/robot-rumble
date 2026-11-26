'use strict';
var L3 = L3 || {};
// ============================================================
// Mission 3: VOLCANO ISLAND (LEVELS[2]). Ines or Mathias sail to a tropical island where the robot army hides its
// base in the volcano: across SHARK BAY (morning, the lagoon and the jet-ski), up through the HONEY JUNGLE (late
// morning, bees and frogs), over the LAVA RIVERS (dusk, basalt columns, lava bombs) into THE CRATER (night) and the
// MEGA WHALE SHARK.
// This file: the level data (terrain, liquids, platforms, spawns, locks, animals, props), the level hooks, the
// liquid rules (lava bounce, items popping out of the lava, splashes), the lava-bomb schedule, the opening
// cutscene (the hero arrives on a little boat), the mission-card art, the seven caged animals (POW_KINDS turtle
// pelican parrot monkey toucan iguana flamingo) and the two music tracks (TRACKS.island, TRACKS.whaleboss).
// The other Mission 3 files hang their hooks on the shared L3 object (level3_sky.js: drawBG, drawOverlay, skyLoad,
// skyUpdate, weather; level3_world.js: drawBehind, drawGround, drawPlat, drawFront, worldLoad, worldUpdate;
// level3_enemies.js: lavaBomb). Each level hook looks its L3 hook up when it is called and draws a simple stand-in
// when it isn't there yet. Everything in the block below is private, except L3.lavaAt / L3.waterAt (and it clears
// L3.whaleHp, the whale's health kept for a continue, on a fresh start).
// ============================================================
{
// ============================================================
// Level data (world x; y is screen y, there is no vertical camera). docs/level3-spec.md section 2.
// ============================================================
const SECTIONS = [
  { x: 0, name: 'AREA 1: SHARK BAY' },
  { x: 2250, name: 'AREA 2: HONEY JUNGLE' },
  { x: 3900, name: 'AREA 3: LAVA RIVERS' },
  { x: 5300, name: 'FINAL AREA: THE CRATER' }
];

const VOLCANO = {
  mission: 'MISSION 3', title: 'VOLCANO ISLAND', end: 6200, heroStart: 140, freedLabel: 'ANIMALS RESCUED',
  music: 'island', bossMusic: 'whaleboss', clearMusic: 'victory',
  startText: 'MISSION 3 START!', startSay: 'Mission three, start!',
  sections: SECTIONS,
  terrain: [
    [0, 214], [140, 214], [240, 220], [380, 226], [520, 230], [620, 232], [660, 240], [700, 246],
    [1460, 246], [1490, 232], [1590, 232], [1620, 246], [2030, 246], [2070, 238], [2110, 230], [2250, 226],
    [2400, 220], [2560, 214], [2700, 208], [2850, 204], [3000, 206], [3120, 214], [3160, 228], [3180, 236],
    [3320, 236], [3345, 226], [3380, 214], [3520, 210], [3700, 212], [3900, 216],
    [4040, 220], [4058, 220], [4064, 262], [4296, 262], [4302, 222], [4540, 224], [4556, 224], [4562, 262],
    [4824, 262], [4830, 222], [5030, 220], [5036, 262], [5184, 262], [5190, 222], [5300, 222],
    [5400, 224], [5600, 224], [5720, 222], [5940, 222], [5946, 262], [6200, 262]
  ],
  // Liquids (the world draws them, this file applies their rules). The lagoon floor is at 246 (the hero wades),
  // the sandbar 1490-1590 is dry; the jungle hot-spring pond; three lava rivers and the crater's lava lake.
  water: [{ x0: 640, x1: 2090, y: 234 }, { x0: 3150, x1: 3355, y: 228 }],
  lava: [{ x0: 4060, x1: 4300, y: 250 }, { x0: 4558, x1: 4828, y: 250 }, { x0: 5032, x1: 5188, y: 250 }, { x0: 5944, x1: 6200, y: 238 }],
  // One-way platforms { x (left), y (top), w, t }. In the lava, gaps <= 34 px and rises <= 18 px.
  plats: [
    // AREA 1: wooden piers in the lagoon
    { x: 960, y: 208, w: 90, t: 'pier' }, { x: 1700, y: 206, w: 80, t: 'pier' },
    // AREA 2: a fallen log, a mossy rock, lily pads on the hot-spring pond, another log, a rock
    { x: 2480, y: 200, w: 60, t: 'log' }, { x: 2900, y: 186, w: 50, t: 'rock' },
    { x: 3196, y: 225, w: 18, t: 'lily' }, { x: 3252, y: 225, w: 18, t: 'lily' }, { x: 3300, y: 225, w: 16, t: 'lily' },
    { x: 3460, y: 194, w: 56, t: 'log' }, { x: 3720, y: 192, w: 44, t: 'rock' },
    // AREA 3: basalt columns across the three lava rivers
    { x: 4066, y: 210, w: 30, t: 'column' }, { x: 4118, y: 200, w: 28, t: 'column' }, { x: 4170, y: 208, w: 30, t: 'column' },
    { x: 4222, y: 198, w: 28, t: 'column' }, { x: 4268, y: 206, w: 28, t: 'column' },
    { x: 4566, y: 212, w: 30, t: 'column' }, { x: 4618, y: 202, w: 28, t: 'column' }, { x: 4670, y: 196, w: 30, t: 'column' },
    { x: 4722, y: 204, w: 28, t: 'column' }, { x: 4774, y: 210, w: 30, t: 'column' },
    { x: 5040, y: 206, w: 30, t: 'column' }, { x: 5094, y: 198, w: 30, t: 'column' }, { x: 5146, y: 206, w: 30, t: 'column' },
    // FINAL AREA: the robots' catwalks (none at x >= 5700: the boss ledge is clear)
    { x: 5380, y: 196, w: 60, t: 'catwalk' }, { x: 5560, y: 190, w: 50, t: 'catwalk' }
  ],
  // Enemies placed at load (asleep until x <= cam + W + activateMargin; flyers pick their height). A frog on a
  // platform gets that platform's top as y. Nothing between 5660 and the boss.
  spawns: [
    // AREA 1: the first robot, sharks in the lagoon, more after the shark pack's lock
    { t: 'bee', x: 460 },   // (was 300: it dived while the MISSION 3 START! band still covered it)
    { t: 'shark', x: 760 }, { t: 'shark', x: 880 }, { t: 'shark', x: 1020 },
    { t: 'shark', x: 1760 }, { t: 'shark', x: 1880 }, { t: 'shark', x: 1990 },
    // AREA 2: bees, frogs, two hives (hanging from branches at their y), frogs on the rock and the lily pads
    { t: 'bee', x: 2350 }, { t: 'frog', x: 2560 },   // (retune: no lone bee at 2640, the 2620 hive sends its own)
    { t: 'hive', x: 2620, y: 120 },
    { t: 'frog', x: 2780 }, { t: 'frog', x: 2900, y: 186 }, { t: 'bee', x: 3000 },
    { t: 'hive', x: 3250, y: 112 },
    { t: 'frog', x: 3200, y: 225 }, { t: 'frog', x: 3300, y: 225 },
    // AREA 3: a lava shark in river 1, then more after the lava lock (river 3)
    { t: 'lavashark', x: 4180 }, { t: 'bee', x: 4350 }, { t: 'frog', x: 4400 },
    { t: 'lavashark', x: 5100 }, { t: 'bee', x: 5150 }, { t: 'frog', x: 5250 },
    // FINAL AREA
    { t: 'bee', x: 5350 }, { t: 'frog', x: 5530 },   // frog 5530: clear of the 5380/5560 catwalks and the flamingo's cage (5480)
    { t: 'hive', x: 5500, y: 104 },
    { t: 'bee', x: 5600 }, { t: 'frog', x: 5640 }
  ],
  // Camera locks. A lava-shark wave carries `lava`: the index in LV.lava of the river it enters (river 2).
  locks: [
    { at: 1200, waves: [   // SHARK PACK: they wave in along the lagoon, never on land
      { t: 'shark', side: 1, d: 20 }, { t: 'shark', side: 1, d: 90 }, { t: 'shark', side: -1, d: 160 },
      { t: 'shark', side: 1, d: 260 }, { t: 'shark', side: -1, d: 360 }, { t: 'shark', side: 1, d: 460 }
    ] },
    { at: 3380, waves: [   // QUEEN BEE (mini-boss: ends with e.dead = true)
      { t: 'queenbee', side: 1, d: 40 }, { t: 'bee', side: 1, d: 200 }, { t: 'frog', side: 1, d: 420 }   // (retune: 1 bee, was 2: no bee -1 d320)
    ] },
    { at: 4440, waves: [   // LAVA LOCK: lava sharks in river 2, lava bombs twice as often (2 sharks: tuning, was 3)
      { t: 'lavashark', side: 1, d: 30, lava: 1 }, { t: 'bee', side: -1, d: 120 },   // (retune: 1 bee, was 2: no bee d330)
      { t: 'lavashark', side: -1, d: 430, lava: 1 }
    ] },
    { at: 5720, boss: true, waves: [{ t: 'megawhale', side: 1, d: 60 }] }
  ],
  // The animals in robot cages; each tosses its item forward when freed
  pows: [
    { x: 520, item: 'S', kind: 'turtle' }, { x: 1540, item: 'heart', kind: 'pelican' }, { x: 2700, item: 'F', kind: 'parrot' },
    { x: 2980, item: 'B', kind: 'monkey' }, { x: 3640, item: 'heart', kind: 'toucan' }, { x: 4420, item: 'R', kind: 'iguana' },
    { x: 5480, item: 'H', kind: 'flamingo' }
  ],
  // Props, drawn in this order: palms and rocks first (behind the crates), the parked jet-ski last
  props: [
    { k: 'palm', x: 60 }, { k: 'palm', x: 230 }, { k: 'palm', x: 410 }, { k: 'palm', x: 1530 }, { k: 'palm', x: 2140 }, { k: 'palm', x: 2230 },
    { k: 'beachrock', x: 600 }, { k: 'beachrock', x: 2100 },
    { k: 'crate', x: 330, item: 'coin' }, { k: 'crate', x: 1560, item: 'heart' }, { k: 'crate', x: 2760, item: 'coin' },
    { k: 'crate', x: 3560, item: 'heart' }, { k: 'crate', x: 4440, item: 'heart' }, { k: 'crate', x: 5340, item: 'heart' },
    { k: 'jetski', x: 700 }
  ],
  drawBG(cx) { if (L3.drawBG) L3.drawBG(cx); else fallbackBG(cx); },
  drawBehind(cx) { if (L3.drawBehind) L3.drawBehind(cx); else fallbackBehind(cx); missingProps(cx); },
  drawGround(cx) { if (L3.drawGround) L3.drawGround(cx); else fallbackGround(cx); },
  drawPlat(pl) { if (L3.drawPlat) L3.drawPlat(pl); else fallbackPlat(pl); },
  drawFront(cx) { if (L3.drawFront) L3.drawFront(cx); else fallbackFront(cx); },
  drawOverlay(cx) { if (L3.drawOverlay) L3.drawOverlay(cx); else fallbackOverlay(cx); },
  // once per play frame, after all objects (also during the intro)
  update() {
    liquidRules();
    tossItems();
    bombSchedule();
    musicByArea();
    if (L3.skyUpdate) L3.skyUpdate();
    if (L3.worldUpdate) L3.worldUpdate();
  },
  // after the level is (re)built for camera x cp (start 0, a checkpoint, or a devStart x), before intro.start()
  load(cp) {
    S.bvy = 0; S.lastP = G.p; S.wet = false; S.bombT = 150; S.hotT = 0;
    if (!G.continues) L3.whaleHp = null;   // the whale's health kept for a continue (level3_boss.js): a fresh run forgets it
    S.boat = cp < 320 ? { x: BOAT_X, ky: BOAT_Y, k: 5, hero: false, go: false, bump: 0 } : null;
    placeBoat();
    L3.eruptT = 0;
    if (G.p) G.p.hidden = false;
    if (L3.skyLoad) L3.skyLoad(cp);
    if (L3.worldLoad) L3.worldLoad(cp);
  },
  intro: makeIntro(),
  preview: drawPreview,
  menuBG() { if (L3.drawBG) L3.drawBG(0); else fallbackBG(0); }
};
LEVELS.push(VOLCANO);

// Mission 3 state (reset by load)
const S = { bvy: 0, lastP: null, wet: false, bombT: 150, hotT: 0, boat: null };

// ============================================================
// Liquids: lookups shared with the other Mission 3 files (L3.lavaAt / L3.waterAt return the LV.lava / LV.water
// entry whose x range holds x, or null)
// ============================================================
function inRange(list, x) { if (list) for (const r of list) if (x >= r.x0 && x <= r.x1) return r; return null; }
const lavaAt = x => inRange(LV && LV.lava, x);
const waterAt = x => inRange(LV && LV.water, x);
if (!L3.lavaAt) L3.lavaAt = lavaAt;
if (!L3.waterAt) L3.waterAt = waterAt;

// the nearest dry place to x beside lava range lv: a bank (on screen when possible), or a basalt column in it
function bankOf(lv, x, columns) {
  const c0 = G.cam.x + 12, c1 = G.cam.x + W - 12, out = [];
  for (const bx of [lv.x0 - 12, lv.x1 + 12]) if (bx > 4 && bx < LV.end - 4 && !lavaAt(bx)) out.push(bx);
  if (columns) for (const pl of LV.plats) if (pl.t === 'column' && pl.x >= lv.x0 && pl.x + pl.w <= lv.x1) out.push(pl.x + pl.w / 2);
  let best = null, bd = Infinity;
  for (const bx of out) {
    const d = Math.abs(bx - x) + (bx < c0 || bx > c1 ? 2000 : 0);
    if (d < bd) { bd = d; best = bx; }
  }
  return best == null ? x : best;
}

// Send an item on a hop arc from (x0, y0) so it comes down at world x tx (the engine's item physics: vy += 0.2,
// capped at 5, then it lands on the ground or a platform)
function aimItem(it, x0, y0, tx, vy0) {
  const gy = groundAt(tx);
  let y = y0, vy = vy0, n = 0;
  while (n < 240) { vy = Math.min(vy + 0.2, 5); y += vy; n++; if (vy > 0 && y >= gy) break; }
  it.x = x0; it.y = y0; it.vy = vy0; it.vx = clamp((tx - x0) / n, -4, 4); it.onGround = false; it.l3t = G.t;
}

// The rules (level3-spec section 2): lava = one hit (hurtPlayer respects invulnerability) and a strong bounce
// (vy -7.5) even while invulnerable; items that fall into lava pop back onto the nearest bank; a respawn over lava
// is moved onto dry ground; wading in water is safe, with splashes.
function liquidRules() {
  const p = G.p;
  if (!p) return;
  if (p !== S.lastP) {                          // a fresh hero after losing a life drops in from the top
    S.lastP = p; S.bvy = 0;
    // in the boss lock: mid-ledge, never on the lake's lip or in front of the whale's jaw
    const bl = p.y < 0 && G.locks.find(l => l.boss && l.active && !l.done);
    if (bl) p.x = bl.at + 100;
    else if (p.y < 0 && lavaAt(p.x)) p.x = bankOf(lavaAt(p.x), p.x, true);
  }
  if (S.hotT > 0) S.hotT--;
  if (!p.dead && !p.ride) {
    const lv = lavaAt(p.x);
    if (lv && p.y > lv.y) {
      hurtPlayer();
      if (!p.dead) {
        p.y = lv.y; p.vy = -7.5; p.onGround = false; p.onPlat = null; S.bvy = -7.5;
        lavaSplash(p.x, lv.y, 1);
        if (!S.hotT) { G.texts.push({ x: p.x, y: p.y - 44, s: 'HOT HOT!', t: 50, c: '#ffb020' }); S.hotT = 40; }
        Snd.noise(0.3, 0.1, 2600); Snd.tone('square', 260, 880, 0.16, 0.05);
      }
    } else if (S.bvy < 0) {
      // keep the bounce at full height: the engine cuts a rising hero to vy -2.6 when jump isn't held
      if (p.onGround) S.bvy = 0;
      else {
        const want = S.bvy + 0.26;
        if (p.vy > want + 0.01 && want < -2.34) { p.y += want - p.vy; p.vy = want; }
        S.bvy = want < -2.34 ? want : 0;
      }
    }
    // wading: a splash going in, droplets while walking
    const w = waterAt(p.x), wet = !!w && p.y > w.y + 1;
    if (wet && !S.wet) waterSplash(p.x, w.y, Math.min(12, 3 + Math.max(0, p.vy) * 2));
    else if (wet && p.onGround && p.vx && p.t % 8 === 0) waterSplash(p.x - p.facing * 3, w.y, 2);
    S.wet = wet;
  } else { S.bvy = 0; S.wet = false; }
  for (const it of G.items) {
    const lv = lavaAt(it.x);
    if (lv && it.y > lv.y - 1 && it.vy >= 0) {
      aimItem(it, it.x, lv.y - 2, bankOf(lv, it.x, false), -4.6);
      lavaSplash(it.x, lv.y, 0.5);
      Snd.noise(0.2, 0.06, 2600);
      continue;
    }
    // an item coming down in deep water floats on the surface, bobbing (on the bottom it would look washed out)
    const w = waterAt(it.x);
    if (w && groundAt(it.x) > w.y + 3 && it.y >= w.y - 2 && (it.vy >= 0 || it.onGround)) {
      if (!it.l3float) { it.l3float = true; waterSplash(it.x, w.y, 5); }
      it.y = w.y - 2 + ((G.t + it.x) >> 4 & 1); it.vy = 0; it.vx = 0; it.onGround = true;
    }
  }
}
// deep water at x (an item there would sink to the lagoon floor)
const deepAt = x => { const w = waterAt(x); return !!w && groundAt(x) > w.y - 1; };
// the nearest place on screen where a present tossed toward x lands on dry sand (the sandbar, the shore), a little
// way onto it; x itself when there is none (it then floats)
function dryNear(x) {
  const lo = G.cam.x + 24, hi = G.cam.x + W - 24;
  for (let d = 4; d <= 160; d += 4) {
    for (const s of [1, -1]) {
      const q = x + s * d;
      if (q >= lo && q <= hi && !deepAt(q) && !lavaAt(q)) return clamp(q + s * 8, lo, hi);
    }
  }
  return x;
}
function lavaSplash(x, y, s) {
  for (let i = 0; i < 10 * s; i++) G.parts.push({ type: 'spark', x: x + rand(-4, 4), y, vx: rand(-1.6, 1.6), vy: rand(-3.6, -1), g: 0.16, life: rand(14, 26), max: 26, size: rand(1, 3) | 0, c: i % 3 ? '#ffb020' : '#fff1a0' });
  for (let i = 0; i < 5 * s; i++) G.parts.push({ type: 'fire', x: x + rand(-5, 5), y: y - 2, vx: rand(-0.5, 0.5), vy: rand(-1.4, -0.4), life: rand(14, 22), max: 22, size: rand(2, 4) });
}
function waterSplash(x, y, n) {
  for (let i = 0; i < n; i++) G.parts.push({ type: 'spark', x: x + rand(-4, 4), y: y - 1, vx: rand(-1.3, 1.3), vy: rand(-2.6, -0.8), g: 0.16, life: rand(10, 18), max: 18, size: i % 3 ? 1 : 2, c: i % 2 ? '#e8fdff' : '#8fe2ee' });
  if (n > 4) Snd.noise(0.14, 0.05, 1600);
}

// A freed animal tosses its item forward: the engine drops it behind the animal at salute t 40 (dropItem at
// o.x - 10, moving left); this frame we catch that item and throw it so it lands 30-50 px ahead of the hero, on
// screen and never in lava
const HOP = 20;   // how far a freed animal hops clear of the hero
// where an animal running home stands at x: the ground, or over lava a basalt column or a hop between two of them
function runnerY(x) {
  const lv = lavaAt(x);
  if (!lv) return { y: groundAt(x), air: false };
  const seg = [[lv.x0 - 40, lv.x0, groundAt(lv.x0 - 3)], [lv.x1, lv.x1 + 40, groundAt(lv.x1 + 3)]];
  for (const pl of LV.plats) if (pl.t === 'column' && pl.x < lv.x1 && pl.x + pl.w > lv.x0) seg.push([pl.x, pl.x + pl.w, pl.y]);
  let l = null, r = null;
  for (const sg of seg) {
    if (x >= sg[0] && x <= sg[1]) return { y: sg[2], air: false };
    if (sg[1] < x && (!l || sg[1] > l[1])) l = sg;
    if (sg[0] > x && (!r || sg[0] < r[0])) r = sg;
  }
  if (!l || !r) return { y: groundAt(x), air: false };
  const u = (x - l[1]) / (r[0] - l[1]);
  return { y: l[2] + (r[2] - l[2]) * u - (6 + (r[0] - l[1]) * 0.35) * Math.sin(u * Math.PI), air: true };
}
// a freed animal that lands on a crate stands on it (it slides off its edge as it leaves)
function crateLift(x) {
  let lift = 0;
  for (const c of G.props) if (c.k === 'crate' && !c.dead) lift = Math.max(lift, Math.round(16 * clamp((13 - Math.abs(x - c.x)) / 6, 0, 1)));
  return lift;
}
function tossTarget() {
  const p = G.p;
  let tx = clamp(p && !p.dead ? p.x + 40 : G.cam.x + W * 0.6, G.cam.x + 24, G.cam.x + W - 24);
  const lv = lavaAt(tx);
  if (lv) tx = bankOf(lv, tx, false);
  else if (deepAt(tx)) tx = dryNear(tx);   // e.g. the pelican's heart, freed from the jet-ski: onto the sandbar
  return tx;
}
function tossItems() {
  for (const o of G.pows) {
    const K = KINDS[o.kind];
    if (!K || o.state === 'tied') continue;
    // freed, it hops clear of the hero (who usually stands on the cage) so it can be seen: drawFreed reads o.l3side
    if (o.l3side == null) o.l3side = G.p && G.p.x > o.x ? -1 : 1;
    // running home across a lava river (the engine puts it on the river bed): it hops from column to column
    if (o.state === 'run' && !K.fly) { const r = runnerY(o.x); o.y = r.y; o.l3air = r.air; }
    if (o.state !== 'salute') continue;
    // the animal turns to where its present will go (drawFreed reads o.l3dir)
    const ax = o.x + o.l3side * HOP;
    if (o.t >= 24 && o.t <= 40) { o.l3tx = tossTarget(); o.l3dir = o.l3tx >= ax ? 1 : -1; }
    if (o.t !== 40) continue;
    const it = G.items.find(i => i.t === 1 && i.k === o.item && i.l3t == null && Math.abs(i.x - (o.x - 10.6)) < 1.5);
    if (!it) continue;
    aimItem(it, ax + o.l3dir * K.hand[0], o.y + K.hand[1] - 2 - crateLift(ax), o.l3tx, -4.2);
    Snd.throw();
  }
}

// The island tune turns to its minor lava version from AREA 3 on (also after a continue there); the boss lock's own
// music and the win jingle are left alone
function musicByArea() {
  if (G.state !== 'play' || !TRACKS.islandlava) return;
  if (Music.track === TRACKS.island && G.section >= 2) Music.play('islandlava');
  else if (Music.track === TRACKS.islandlava && G.section < 2) Music.play('island');
}

// Lava bombs in AREA 3 (L3.lavaBomb from level3_enemies.js): one every ~5 s near the hero, twice as often while
// the LAVA LOCK is on. The first one comes 2.5 s after the area starts.
function bombSchedule() {
  const p = G.p;
  if (!L3.lavaBomb || G.intro || G.winT > 0 || !p || p.dead || G.section !== 2) { S.bombT = Math.max(S.bombT, 150); return; }
  // one danger at a time: no bomb while a lava shark warns or leaps (L3.lavaSharkBusy, level3_enemies.js, when
  // it is there), and a short breather after it
  let busy = false;
  if (typeof L3.lavaSharkBusy === 'function') { try { busy = !!L3.lavaSharkBusy(); } catch (err) { errorOnce(err); } }
  // (retune) nor while a bee's warning or dive is on (L3.beeBusy, level3_bees.js)
  if (!busy && typeof L3.beeBusy === 'function') { try { busy = !!L3.beeBusy(); } catch (err) { errorOnce(err); } }
  if (busy) { S.bombT = Math.max(S.bombT, 45); return; }
  if (--S.bombT > 0) return;
  const lk = G.locks.find(l => l.at === 4440), hot = !!lk && lk.active && !lk.done;
  S.bombT = Math.round((hot ? 180 : 360) * rand(0.8, 1.2));   // (retune: every ~6 s, 3 s in the lock; was 300 / 150)
  const tx = clamp(p.x + rand(-30, 80), G.cam.x + 24, G.cam.x + W - 24);
  try { L3.lavaBomb(tx); } catch (err) { errorOnce(err); }
}

// ============================================================
// Pixel grid (as in level2.js): shapes painted with palette letters, shaded and outlined, turned into a sprite
// ============================================================
function grid(w, h) {
  const g = [];
  for (let y = 0; y < h; y++) g.push(new Array(w).fill('.'));
  const put = (x, y, c) => { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; };
  const o = {
    w, h,
    at: (x, y) => x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : '.',
    p(x, y, c) { put(x, y, c); return o; },
    r(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) put(x + i, y + j, c); return o; },
    e(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx) - 1; x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1.04) put(x, y, c);
      }
      return o;
    },
    l(x0, y0, x1, y1, c, wd = 1) {
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) || 1;
      for (let i = 0; i <= n; i++) o.r(Math.round(x0 + (x1 - x0) * i / n - wd / 2), Math.round(y0 + (y1 - y0) * i / n - wd / 2), wd, wd, c);
      return o;
    },
    t(pts, c) {
      let y0 = Infinity, y1 = -Infinity;
      for (const q of pts) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
        const yc = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        xs.sort((m, n) => m - n);
        for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x + 0.5 <= xs[i + 1]; x++) put(x, y, c);
      }
      return o;
    },
    // 3-tone shading of colour c: lt where nothing is above, dk where nothing is below
    shade(c, lt, dk, dk2) {
      const s = g.map(r => r.slice()), at = (x, y) => x >= 0 && y >= 0 && x < w && y < h ? s[y][x] : '.';
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (s[y][x] !== c) continue;
        if (lt && at(x, y - 1) === '.') g[y][x] = lt;
        else if (dk && at(x, y + 1) === '.') g[y][x] = dk;
        else if (dk2 && at(x, y + 2) === '.') g[y][x] = dk2;
      }
      return o;
    },
    outline() {
      const s = g.map(r => r.slice()), at = (x, y) => x >= 0 && y >= 0 && x < w && y < h ? s[y][x] : '.';
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (s[y][x] === '.' && (at(x - 1, y) !== '.' || at(x + 1, y) !== '.' || at(x, y - 1) !== '.' || at(x, y + 1) !== '.')) g[y][x] = 'k';
      }
      return o;
    },
    sprite(pal) { return makeSprite(g.map(r => r.join('')), pal); }
  };
  return o;
}
// filled pixel ellipse on the main canvas (crisp edges, unlike circ)
function pdisc(x, y, r, col, ry = r) {
  for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)))); R(x - w, y + dy, w * 2 + 1, 1, col); }
}
function hex2(c) { return '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
// blend of hex colours by weights (weights sum to 1)
function blendHex(cols, ws) { const a = [0, 0, 0]; cols.forEach((c, i) => { const v = hex(c); for (let j = 0; j < 3; j++) a[j] += v[j] * ws[i]; }); return hex2(a); }

// ============================================================
// Stand-in drawing, used only while level3_sky.js / level3_world.js don't provide their L3 hooks. The time of day
// moves on with the camera: morning (SHARK BAY), late morning (HONEY JUNGLE), dusk (LAVA RIVERS), night (CRATER).
// ============================================================
const ZX = [0, 2250, 3900, 5300];
// how much of each area's look shows for camera x cx (cross-fades over 400 px around each section start)
function zones(cx) {
  const c = cx + W / 2, w = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const up = i === 0 ? 1 : clamp((c - ZX[i] + 200) / 400, 0, 1), dn = i === 3 ? 1 : clamp((ZX[i + 1] + 200 - c) / 400, 0, 1);
    w[i] = Math.min(up, dn);
  }
  const s = w[0] + w[1] + w[2] + w[3];
  return w.map(v => v / s);
}
const SKY = [
  ['#2f7fd8', '#7cc4f2', '#f6ecd0'],   // morning
  ['#3d8fc4', '#98d2dc', '#e6f0c8'],   // late morning, humid
  ['#251a48', '#8a3a5c', '#ff9a50'],   // dusk
  ['#07050c', '#1e0a10', '#5a1e0e']    // night in the crater
];
function fallbackBG(cx) {
  const z = zones(cx);
  const col = i => blendHex(SKY.map(s => s[i]), z);
  const g = ctx.createLinearGradient(0, 0, 0, 175);
  g.addColorStop(0, col(0)); g.addColorStop(0.55, col(1)); g.addColorStop(1, col(2));
  ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);
  // stars at dusk and night
  const st = z[2] * 0.5 + z[3];
  if (st > 0.02) {
    ctx.globalAlpha = st;
    for (let i = 0; i < 40; i++) R(Math.floor(hsh(i) * W), Math.floor(hsh(i + 50) * 120), 1, 1, (G.t + i * 13) % 90 < 70 ? '#ffffff' : '#8a7aa0');
    ctx.globalAlpha = 1;
  }
  // sun (morning high on the left, setting big and orange at dusk)
  const sunA = z[0] + z[1], sunD = z[2];
  if (sunA > 0.02) { ctx.globalAlpha = sunA; pdisc(70, 46, 22, 'rgba(255,246,200,0.25)'); pdisc(70, 46, 12, '#fff2b8'); pdisc(69, 45, 9, '#fffbe6'); ctx.globalAlpha = 1; }
  if (sunD > 0.02) { ctx.globalAlpha = sunD; pdisc(60, 150, 26, 'rgba(255,170,90,0.3)'); pdisc(60, 150, 16, '#ffb060'); pdisc(60, 150, 12, '#ffd890'); ctx.globalAlpha = 1; }
  // the volcano, growing nearer as the mission goes on (gone once we are inside the crater)
  const va = 1 - z[3];
  if (va > 0.02) {
    ctx.globalAlpha = va;
    const s = 0.8 + Math.min(cx, 5300) / 5300 * 0.75, vx = Math.round(372 - cx * 0.04), base = 168, top = base - 92 * s, rw = 14 * s;
    const rock = blendHex(['#8a86a8', '#7a8a98', '#3c2c3c', '#3c2c3c'], z), dark = blendHex(['#6e6a90', '#5e6e7c', '#2a1e2c', '#2a1e2c'], z);
    ctx.fillStyle = rock; ctx.beginPath(); ctx.moveTo(vx - 150 * s, base); ctx.lineTo(vx - rw, top); ctx.lineTo(vx - rw * 0.3, top + 4 * s); ctx.lineTo(vx + rw * 0.4, top + 2 * s); ctx.lineTo(vx + rw, top); ctx.lineTo(vx + 150 * s, base); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(vx + rw * 0.4, top + 2 * s); ctx.lineTo(vx + rw, top); ctx.lineTo(vx + 150 * s, base); ctx.lineTo(vx + 30 * s, base); ctx.fill();
    // green lower slopes (morning) / glowing lava rivers (dusk)
    if (z[0] + z[1] > 0.02) { ctx.globalAlpha = va * (z[0] + z[1]); ctx.fillStyle = '#5f8f62'; ctx.beginPath(); ctx.moveTo(vx - 150 * s, base); ctx.lineTo(vx - 70 * s, base - 28 * s); ctx.lineTo(vx + 80 * s, base - 24 * s); ctx.lineTo(vx + 150 * s, base); ctx.fill(); }
    if (z[2] > 0.02) {
      ctx.globalAlpha = va * z[2];
      for (const [dx, k] of [[-0.5, 0.9], [0.2, 1.2], [0.6, 0.7]]) for (let i = 0; i < 90; i++) {
        const u = i / 90, x = vx + dx * rw + (dx * 120 * s) * u * k + Math.sin(u * 9 + dx * 5) * 3, y = top + 3 + u * (base - top - 6) * (0.55 + 0.25 * k);
        R(Math.round(x) - 1, Math.round(y), 4, 2, 'rgba(255,120,40,0.25)'); R(Math.round(x), Math.round(y), 2, 2, (i + (G.t >> 3)) % 9 ? '#ff7a1a' : '#ffd23f');
      }
      pdisc(vx, Math.round(top + 1), Math.round(rw * 0.7), '#ff9a30', 2);
    }
    // the plume: puffs rising from the crater and drifting right (an eruption glow under them at dusk)
    for (let i = 0; i < 10; i++) {
      const k = ((G.t * 0.12 + i * 20) % 200) / 200, r = Math.round((5 + k * 16) * s);
      ctx.globalAlpha = va * (1 - k) * 0.75;
      pdisc(Math.round(vx + k * 70 * s + Math.sin(k * 6 + i) * 4), Math.round(top - 4 - k * 80 * s), r, z[2] > 0.5 ? '#4a3a44' : '#e8e4ec', Math.round(r * 0.8));
    }
    ctx.globalAlpha = 1;
  }
  // AREA 1: the bay, far islands and sparkles
  if (z[0] > 0.02) {
    ctx.globalAlpha = z[0];
    R(-10, 168, W + 20, H - 168 + 10, '#2f9fcf'); R(-10, 168, W + 20, 2, '#a8e6f4'); R(-10, 176, W + 20, 3, '#3fb0d8');
    for (const [ix, iw, ih] of [[60, 70, 10], [200, 40, 6]]) { const x = Math.round(ix - cx * 0.08); ctx.fillStyle = '#7a8aa0'; ctx.beginPath(); ctx.ellipse(x, 168, iw / 2, ih, 0, Math.PI, 0); ctx.fill(); }
    for (let i = 0; i < 22; i++) { const span = W + 20, x = ((i * 53 - cx * 0.12 + G.t * 0.15) % span + span) % span - 10; if ((G.t + i * 11) % 60 < 44) R(Math.round(x), 172 + (i * 7) % 40, 4, 1, '#d8f8ff'); }
  }
  // AREA 2: misty jungle (far crowns, nearer trunks and crowns)
  if (z[1] > 0.02) {
    ctx.globalAlpha = z[1];
    for (let i = 0; i < 22; i++) { const span = W + 80, x = ((i * 31 - cx * 0.15) % span + span) % span - 40; pdisc(Math.round(x), 128 + Math.round(hsh(i + 7) * 14), 14 + Math.round(hsh(i) * 12), '#8cbaa2', 10 + Math.round(hsh(i + 3) * 6)); }
    R(-10, 138, W + 20, H, '#8cbaa2');
    for (let i = 0; i < 14; i++) {
      const span = W + 140, x = Math.round(((i * 47 - cx * 0.3) % span + span) % span - 70), top = 112 + Math.round(hsh(i + 20) * 26), r = 14 + Math.round(hsh(i + 30) * 10);
      R(x - 2, top, 5, H, '#5e8a70'); pdisc(x, top, r, '#5e9476', Math.round(r * 0.7)); pdisc(x - 4, top - 4, Math.round(r * 0.5), '#72a688', Math.round(r * 0.35));
    }
    for (let i = 0; i < 8; i++) {
      const span = W + 160, x = Math.round(((i * 73 - cx * 0.5) % span + span) % span - 80), top = 70 + Math.round(hsh(i + 40) * 40), r = 22 + Math.round(hsh(i + 50) * 12);
      R(x - 4, top, 9, H, '#3a5e44'); R(x - 4, top, 2, H, '#4e7458');
      pdisc(x, top, r, '#2f6a44', Math.round(r * 0.66)); pdisc(x + 10, top + 6, Math.round(r * 0.6), '#2f6a44', Math.round(r * 0.4)); pdisc(x - 6, top - 6, Math.round(r * 0.55), '#3f7e52', Math.round(r * 0.36));
      for (let v = 0; v < 3; v++) R(x - r + 8 + v * Math.round(r * 0.7), top + 8, 1, 20 + v * 9, '#2a5a3a');
    }
    R(-10, 0, W + 20, 12, '#1f4a30'); for (let i = 0; i < 30; i++) pdisc(((i * 23 - Math.round(cx * 0.6)) % (W + 40) + W + 40) % (W + 40) - 20, 10, 9, '#1f4a30', 6);
  }
  // AREA 3: basalt cliffs glowing at their feet
  if (z[2] > 0.02) {
    ctx.globalAlpha = z[2];
    // a basalt cliff of narrow columns (heights step a little from one to the next), lit on the left
    const off = Math.round(cx * 0.3), c0 = Math.floor((off - 10) / 7);
    for (let c = c0; c < c0 + W / 7 + 4; c++) {
      const x = c * 7 - off, top = 150 + Math.round(Math.sin(c * 0.21) * 12 + Math.sin(c * 0.07 + 1) * 10 + hsh(c) * 6);
      R(x, top, 7, H, c % 2 ? '#30243a' : '#382a40'); R(x, top, 1, H, '#4a3a52'); R(x + 6, top, 1, H, '#241a2c');
      R(x, top, 7, 2, '#5a4660'); R(x + 1, top, 4, 1, '#7a6078');
      for (let jy = top + 12 + (c % 3) * 4; jy < H; jy += 16) R(x, jy, 7, 1, '#221828');
    }
    R(-10, 214, W + 20, 40, 'rgba(255,110,40,0.3)');
  }
  // FINAL: inside the crater: the far rim with the robots' base lights, jagged walls left and right with glowing
  // cracks, the lava light from below
  if (z[3] > 0.02) {
    ctx.globalAlpha = z[3];
    const off = Math.round(cx * 0.12);
    ctx.fillStyle = '#2a1a1c'; ctx.beginPath(); ctx.moveTo(-10, H);
    for (let x = -10; x <= W + 10; x += 8) ctx.lineTo(x, 150 + Math.round(hsh(Math.floor((x + off) / 8)) * 14) + Math.round(Math.sin((x + off) * 0.02) * 10));
    ctx.lineTo(W + 10, H); ctx.fill();
    for (let i = 0; i < 9; i++) { const x = ((i * 59 - off) % (W + 20) + W + 20) % (W + 20) - 10; R(x, 170 + (i * 13) % 20, 2, 2, (G.t + i * 20) % 70 < 50 ? '#ffd23f' : '#7a5a20'); }
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#160e12'; ctx.beginPath();
      const x0 = side < 0 ? -10 : W + 10;
      ctx.moveTo(x0, -10);
      for (let y = -10; y <= H + 10; y += 10) { const d = 70 + Math.round(Math.sin(y * 0.03) * 22 + hsh(Math.floor(y / 10) + (side + 2) * 40) * 16) - (y > 160 ? (y - 160) * 0.3 : 0); ctx.lineTo(side < 0 ? d : W - d, y); }
      ctx.lineTo(x0, H + 10); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const y = 30 + i * 30 + Math.round(hsh(i + side * 9) * 12), x = side < 0 ? 18 + Math.round(hsh(i + 4) * 30) : W - 18 - Math.round(hsh(i + 14) * 30);
        const on = 0.6 + 0.4 * Math.sin(G.t * 0.05 + i);
        ctx.globalAlpha = z[3] * on; R(x, y, 1, 8, '#ff7a1a'); R(x + side, y + 7, 1, 6, '#ff7a1a'); R(x, y + 12, 1, 5, '#ffb02a'); ctx.globalAlpha = z[3];
      }
    }
    R(-10, 196, W + 20, 80, 'rgba(255,90,30,0.22)');
  }
  ctx.globalAlpha = 1;
}

// world-space backdrop stand-in: nothing beyond the props (fallbackBehind is a hook for parity with Mission 2)
function fallbackBehind() {}

// Stand-ins for props whose type isn't written yet (palms, beach rocks, the jet-ski), so their places show
function missingProps(cx) {
  for (const s of VOLCANO.props) {
    if (PROP_TYPES[s.k] || s.x < cx - 90 || s.x > cx + W + 90) continue;
    const x = s.x, gy = Math.round(groundAt(x));
    if (s.k === 'palm') palmStandIn(x, gy, x);
    else if (s.k === 'beachrock') {
      blob([[x - 15, gy - 9, 30, 10], [x - 10, gy - 15, 18, 7], [x + 4, gy - 12, 8, 4]], '#4a4652');
      R(x - 9, gy - 14, 12, 2, '#6e6878'); R(x - 14, gy - 8, 6, 1, '#6e6878'); R(x + 8, gy - 6, 6, 5, '#363240');
      R(x - 12, gy - 2, 24, 1, '#2a2632');
    } else if (s.k === 'jetski') {
      const w = waterAt(x), wy = (w ? w.y : gy) + Math.round(Math.sin(G.t * 0.06) * 1);
      blob([[x - 18, wy - 7, 32, 7], [x + 10, wy - 9, 10, 5], [x - 20, wy - 9, 6, 4]], '#d8392b');
      R(x - 17, wy - 7, 30, 1, '#ff6d4d'); R(x - 17, wy - 3, 34, 1, '#f2f6f9'); R(x - 17, wy - 1, 32, 1, '#a2251e');
      RO(x - 8, wy - 11, 12, 3, '#2a2a36'); RO(x + 6, wy - 16, 2, 6, '#5e6773'); RO(x + 3, wy - 17, 8, 1, '#8f9aa7');
      if ((G.t >> 4) % 2) R(x + 18, wy - 9, 2, 2, '#ffe066');
      if (w) for (let i = 0; i < 6; i++) R(x - 22 + i * 8 + ((G.t >> 3) % 2) * 2, wy + 1, 4, 1, '#e8fbff');
    } else RO(x - 8, gy - 16, 16, 16, '#ff00ff');
  }
}
// a leaning palm: ringed trunk, drooping fronds that sway, coconuts (outlined like the props)
function palmStandIn(x, gy, seed, k = 1) {
  const lean = (hsh(seed) - 0.5) * 30 * k, hgt = (70 + Math.round(hsh(seed + 1) * 22)) * k, sway = Math.sin(G.t * 0.025 + seed) * 2;
  const pt = u => [x + lean * u * u + sway * u * u * u, gy - hgt * u];
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i <= 18; i++) {
    const [tx, ty] = pt(i / 18), w = Math.max(2, Math.round((5 - i / 18 * 1.5) * Math.sqrt(k)));
    if (pass === 0) R(Math.round(tx - w / 2) - 1, Math.round(ty) - 1, w + 2, 6, OUT);
    else { R(Math.round(tx - w / 2), Math.round(ty), w, 4, i % 2 ? '#8a6a44' : '#a8845a'); R(Math.round(tx - w / 2), Math.round(ty), 1, 4, '#c8a272'); }
  }
  const [hx, hy] = pt(1);
  const fronds = [[-2.9, 26], [-2.3, 30], [-1.6, 24], [-0.9, 22], [-0.3, 28], [0.3, 26]];
  for (let pass = 0; pass < 2; pass++) for (let f = 0; f < fronds.length; f++) {
    const [a0, l0] = fronds[f], len = Math.round(l0 * k), a = a0 + Math.sin(G.t * 0.03 + f + seed) * 0.05;
    for (let s = 0; s <= len; s += 2) {
      const px = hx + Math.cos(a) * s, py = hy + Math.sin(a) * s * 0.55 + s * s * 0.012;
      const lw = s < len * 0.7 ? 3 : 2;
      if (pass === 0) R(Math.round(px) - 1, Math.round(py) - 1, lw + 2, 4, OUT);
      else { R(Math.round(px), Math.round(py), lw, 2, f % 2 ? '#3f9a3a' : '#4cae46'); R(Math.round(px), Math.round(py), lw, 1, '#86d65a'); if (s % 4 === 0) R(Math.round(px), Math.round(py) + 2, 1, 2, '#2f7a34'); }
    }
  }
  for (const [dx, dy] of [[-2, 3], [2, 4], [0, 6]]) { pdisc(Math.round(hx + dx), Math.round(hy + dy), 2, OUT); pdisc(Math.round(hx + dx), Math.round(hy + dy), 1, '#6a4422'); }
}

// Ground following groundAt (black sand beach, pale lagoon sand, jungle earth, basalt), then the water and lava
const MAT = [
  { base: '#4a4450', top: '#7a7282', lip: '#9a92a2', dot: '#2e2a34' },   // black volcanic sand
  { base: '#d6bf86', top: '#ecd9a2', lip: '#fff0c0', dot: '#b89e64' },   // pale lagoon sand
  { base: '#5a3a24', top: '#3f9a3a', lip: '#86d65a', dot: '#3e2616' },   // jungle earth under grass
  { base: '#2a2430', top: '#4a4250', lip: '#6a6070', dot: '#18141c' }    // basalt
];
const matAt = x => x < 640 ? 0 : x < 2200 ? 1 : x < 3900 ? 2 : 3;
function fallbackGround(cx) {
  const x0 = Math.floor((cx - 12) / 2) * 2, x1 = cx + W + 12;
  for (let x = x0; x < x1; x += 2) {
    const gy = Math.round(groundAt(x + 1)), m = MAT[matAt(x)];
    R(x, gy, 2, H - gy + 2, m.base); R(x, gy, 2, 3, m.top); R(x, gy, 2, 1, m.lip);
    for (let k = 0; k < 4; k++) if (hsh(x * 0.37 + k * 11) > 0.72) R(x + (k & 1), gy + 5 + k * 6 + Math.floor(hsh(x + k) * 4), 1, 1, m.dot);
    if (matAt(x) === 2 && hsh(x + 3) > 0.6) R(x, gy - 2, 1, 2, '#2f7a34');
  }
  for (const w of LV.water) {
    if (w.x1 < cx - 10 || w.x0 > cx + W + 10) continue;
    for (let x = Math.max(x0, w.x0 & ~1); x <= Math.min(x1, w.x1); x += 2) {
      const gy = Math.round(groundAt(x + 1));
      if (gy <= w.y) continue;
      R(x, w.y, 2, gy - w.y, 'rgba(26,168,190,0.72)'); R(x, w.y + 1, 2, 1, 'rgba(120,230,240,0.8)');
      R(x, w.y, 2, 1, gy - w.y < 3 ? '#ffffff' : '#c8f6ff');
      if (hsh(Math.floor((x + G.t * 0.3) / 6)) > 0.85) R(x, w.y + 2 + (x >> 3) % 3, 2, 1, '#e8ffff');
    }
  }
  for (const L of LV.lava) {
    if (L.x1 < cx - 10 || L.x0 > cx + W + 10) continue;
    R(L.x0, L.y - 18, L.x1 - L.x0, 18, 'rgba(255,110,30,0.10)'); R(L.x0, L.y - 7, L.x1 - L.x0, 7, 'rgba(255,150,40,0.14)');
    for (let x = Math.max(x0, L.x0 & ~1); x <= Math.min(x1, L.x1); x += 2) {
      R(x, L.y, 2, H - L.y + 2, '#e8480c'); R(x, L.y + 14, 2, H - L.y, '#c4360a');
      R(x, L.y, 2, 1, '#fff2a0'); R(x, L.y + 1, 2, 3, '#ffb02a'); R(x, L.y + 4, 2, 4, '#ff7a1a');
      const u = Math.floor((x + Math.floor(G.t * 0.25)) / 10);
      if (hsh(u) > 0.72) R(x, L.y + 5 + Math.floor(hsh(u + 5) * 8), 2, 2, '#7a240c');
    }
    // bubbles swell and pop
    const n = Math.max(2, Math.round((L.x1 - L.x0) / 50));
    for (let i = 0; i < n; i++) {
      const ph = (G.t + Math.floor(hsh(i + L.x0) * 90)) % 90, bx = Math.round(L.x0 + 8 + hsh(i * 3 + L.x0) * (L.x1 - L.x0 - 16));
      if (ph < 60) pdisc(bx, L.y + 1, 1 + Math.floor(ph / 22), '#ffd23f', 1);
      else if (ph < 66) { R(bx - 3, L.y - 2, 1, 1, '#fff2a0'); R(bx + 3, L.y - 2, 1, 1, '#fff2a0'); R(bx, L.y - 4, 1, 1, '#ffb02a'); }
    }
  }
}

// Platforms: outlined blocks coloured by type (world space)
function fallbackPlat(pl) {
  const x = pl.x, y = pl.y, w = pl.w, x2 = x + w;
  switch (pl.t) {
    case 'pier': {
      for (let px = x + 3; px < x2; px += 22) { const gy = Math.round(groundAt(px)); RO(px, y + 4, 3, gy - y - 4, '#6a4a2a'); R(px, y + 4, 1, gy - y - 4, '#8a6a44'); }
      for (let px = x + 3; px + 22 < x2; px += 22) { ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + 2, y + 6); ctx.lineTo(px + 22, y + 22); ctx.stroke(); }
      RO(x, y, w, 4, '#9a6a3a'); R(x, y, w, 1, '#c8955a');
      for (let px = x + 5; px < x2; px += 6) R(px, y + 1, 1, 3, '#6a4220');
      break;
    }
    case 'log': {
      for (const sx of [x + 6, x2 - 12]) RO(sx, y + 9, 6, Math.max(0, Math.round(groundAt(sx)) - y - 9), '#5a3a1e');
      RO(x, y, w, 9, '#7a4a26'); R(x, y, w, 2, '#a0703e'); R(x, y + 7, w, 2, '#5a3218');
      for (let px = x + 4; px < x2 - 6; px += 9) R(px, y + 3 + (px % 3), 5, 1, '#5a3218');
      for (let px = x; px < x2; px += 3) if (hsh(px) > 0.4) R(px, y - 1, 2, 1, '#5aa83a');
      RO(x2 - 5, y, 5, 9, '#c89a62'); R(x2 - 4, y + 3, 3, 3, '#a07a4a'); R(x2 - 3, y + 4, 1, 1, '#7a5a32');
      break;
    }
    case 'lily': {
      const cx2 = Math.round(x + w / 2);
      pdisc(cx2, y + 2, Math.round(w / 2) + 1, OUT, 3); pdisc(cx2, y + 2, Math.round(w / 2), '#3f9a4a', 2);
      R(cx2 - Math.round(w / 2) + 2, y + 1, w - 4, 1, '#7ad06a'); R(cx2 + 2, y + 1, 3, 3, '#2a6a34');
      if (x % 3 === 0) { pdisc(cx2 - 3, y, 2, '#ffffff', 1); R(cx2 - 3, y, 1, 1, '#ffd23f'); }
      break;
    }
    case 'column': {
      RO(x, y, w, H - y + 2, '#2e2834');
      R(x, y + 3, 4, H - y, '#4a4252'); R(x2 - 5, y + 3, 5, H - y, '#1c1820');
      for (let jy = y + 16; jy < H; jy += 15) R(x, jy, w, 1, '#18141c');
      R(x, y, w, 3, '#6a6070'); R(x, y, w, 1, '#8a8090'); R(x + 2, y + 1, 3, 1, '#a89eb0');
      R(x, 238, w, 12, 'rgba(255,120,30,0.25)'); R(x, 246, w, 4, 'rgba(255,170,60,0.3)');
      break;
    }
    case 'catwalk': {
      for (const sx of [x + 4, x2 - 8]) { const gy = Math.round(groundAt(sx)); RO(sx, y + 3, 3, gy - y - 3, '#4a525c'); }
      for (let px = x; px <= x2 - 1; px += 10) R(px, y - 8, 1, 8, '#9aa5b0');
      R(x, y - 8, w, 1, '#c0c8d0'); R(x, y - 4, w, 1, '#7a8590');
      RO(x, y, w, 3, '#7a8590'); R(x, y, w, 1, '#c0c8d0');
      for (let px = x + 1; px < x2; px += 3) R(px, y + 1, 1, 2, '#3a4048');
      for (let px = x; px < x2; px += 6) R(px, y + 3, 3, 1, '#f1c40f');
      break;
    }
    default: {   // rock and anything else: a block from the flat top down to the slope under it
      const [c, cl, cd] = pl.t === 'rock' ? ['#6a7068', '#8f978a', '#4a504a'] : ['#8a8f98', '#b0b6c0', '#5e636c'];
      const gl = Math.round(groundAt(x)), gr = Math.round(groundAt(x2));
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.moveTo(x - 1, y - 1); ctx.lineTo(x2 + 1, y - 1); ctx.lineTo(x2 + 1, gr + 1); ctx.lineTo(x - 1, gl + 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y); ctx.lineTo(x2, gr); ctx.lineTo(x, gl); ctx.closePath(); ctx.fill();
      R(x, y, w, 2, cl); R(x2 - 3, y + 2, 3, Math.max(0, gr - y - 2), cd);
      if (pl.t === 'rock') for (let px = x; px < x2; px += 2) if (hsh(px + 1) > 0.35) R(px, y - 1, 2, 2, '#4caf50');
    }
  }
}

// In front of everything: the water's surface layer, so a wading hero and swimming sharks are half under it
function fallbackFront(cx) {
  ctx.save(); ctx.translate(-Math.round(cx), 0);
  for (const w of LV.water) {
    if (w.x1 < cx - 10 || w.x0 > cx + W + 10) continue;
    for (let x = Math.max(Math.floor(cx) & ~1, w.x0 & ~1); x <= Math.min(cx + W + 2, w.x1); x += 2) {
      const gy = Math.round(groundAt(x + 1));
      if (gy > w.y + 1) { R(x, w.y + 1, 2, gy - w.y - 1, 'rgba(40,190,210,0.38)'); R(x, w.y, 2, 1, 'rgba(220,250,255,0.7)'); if (((x >> 1) + (G.t >> 3)) % 9 === 0) R(x, w.y + 1, 2, 1, 'rgba(255,255,255,0.6)'); }
    }
  }
  ctx.restore();
}
function fallbackOverlay(cx) {
  const z = zones(cx);
  if (z[2] > 0.02) { R(0, 0, W, H, 'rgba(255,90,40,' + (0.06 * z[2]).toFixed(3) + ')'); }
  if (z[3] > 0.02) { R(0, 0, W, 30, 'rgba(0,0,0,' + (0.25 * z[3]).toFixed(3) + ')'); R(0, H - 26, W, 26, 'rgba(255,80,20,' + (0.12 * z[3]).toFixed(3) + ')'); }
}

// ============================================================
// The little sailboat: the hero sails in on it (intro) and it stays beached on the black sand at x 100 (hull 73-127,
// keel at y 213). It is a private prop kind (load() puts it first in G.props, so it is drawn after the ground and
// behind the palms and crates): a shadow on the sand, the rig (mast, boom, a mainsail with a sun on it and a jib,
// lowered and furled once it beaches, a pennant always fluttering), the hero at the tiller, then the hull in front of
// him. In the water the hull sits lower, with a wash of sea over its bottom, a bow wave and a wake.
// ============================================================
const BOAT_X = 100, BOAT_Y = 213;
const BPAL = { k: OUT, b: '#2f86c8', L: '#6cc0f0', B: '#1f5a94', w: '#f4f2ea', W: '#ffffff', r: '#c8402e', R: '#8a2a1e', g: '#c8915a', G: '#e8b880', d: '#7a4a24', y: '#ffd23f', m: '#a8763e', M: '#d8a868',
  c: '#f6efd8', C: '#fffaf0', e: '#d8ccae', E: '#bfb090', o: '#ff9a2a', O: '#ffd060', s: '#e8503a', t: '#5a4a3a' };
// hull: 57 x 17, keel on row 14, gunwale on row 4; facing right (bow on the right)
const HULL = (() => {
  const g = grid(58, 17);
  g.t([[1, 4], [45, 4.5], [51, 3], [55.5, 0.5], [56.5, 1.5], [54.5, 6], [50, 10], [44, 13.5], [10, 14.2], [4, 12], [1, 8]], 'b');
  g.shade('b', 'L', null);
  g.t([[2, 6], [46, 6.5], [52, 5], [55.5, 2.6], [55.5, 3.8], [52, 6.4], [46, 8], [2, 7.6]], 'w');
  g.t([[3, 11], [49, 10.6], [44, 13.5], [10, 14.2], [4, 12]], 'r');
  g.r(4, 13, 40, 1, 'R');
  g.r(3, 9, 45, 1, 'B');
  for (let x = 9; x < 46; x += 9) g.p(x, 8, 'B').p(x, 10, 'B');
  g.r(1, 3, 45, 2, 'g').r(1, 3, 45, 1, 'G').l(45, 3.5, 56, 0.5, 'g', 2).l(45, 3, 55, 0, 'G', 1);
  g.r(1, 4, 2, 7, 'B');
  g.e(49.5, 7.2, 2, 1.8, 'y').p(49, 6, 'W');                    // a sun on the bow
  g.t([[0, 8], [3, 8], [3, 15], [1, 16], [0, 14]], 'd');       // rudder
  g.outline();
  g.l(2, 3, 12, 0, 'd', 1).p(12, 0, 'm');                       // the tiller
  return g.sprite(BPAL);
})();
// rig: 60 x 66, its row 65 on the hull's gunwale; k = 0 full sail (fl = flutter), 1-4 lowering, 5 furled
const RIG = [];
for (let k = 0; k <= 5; k++) for (let fl = 0; fl < (k ? 1 : 2); fl++) {
  const g = grid(60, 67), head = 4 + Math.round(k * 6.2), boom = 35;
  // mainsail: luff on the mast, foot on the boom, the leech bellied out by the wind
  if (k < 5) {
    const pts = [[29, head], [29, boom], [7, boom]], bul = (k ? 1.5 : 3.4 + fl) * (1 - k / 6);
    for (let i = 1; i < 12; i++) {
      const u = i / 12, x = 7 + (29 - 7) * u, y = boom + (head - boom) * u, len = Math.hypot(22, boom - head);
      pts.push([x - (boom - head) / len * bul * Math.sin(u * Math.PI), y - 22 / len * bul * Math.sin(u * Math.PI)]);
    }
    g.t(pts, 'c');
    // light along the mast, shadow in the belly near the leech, seams, the bunched cloth above the boom
    for (let y = head; y <= boom; y++) for (let x = 7; x < 29; x++) {
      if (g.at(x, y) !== 'c') continue;
      const edge = g.at(x - 1, y) === '.' || g.at(x - 2, y) === '.';
      if (x >= 26) g.p(x, y, 'C'); else if (edge) g.p(x, y, 'e');
      if ((y - head) % 6 === 5 && x < 28) g.p(x, y, g.at(x, y) === 'C' ? 'e' : 'E');
    }
    if (!k) { g.e(20, 23, 4.2, 4.2, 'o').e(19.4, 22.4, 2.4, 2.4, 'O'); for (const [x, y] of [[20, 16], [20, 30], [13, 23], [27, 23], [15, 18], [25, 18], [15, 28], [25, 28]]) g.p(x, y, 'o'); }
    g.r(8, boom - 2, 21, 2, 's');                                  // the red band at the foot
    if (k) for (let x = 8; x < 29; x += 3) g.p(x, boom - 3, 'E').p(x + 1, boom - 4, 'e');
  } else {
    g.r(8, 31, 22, 4, 'c').r(8, 31, 22, 1, 'C').r(8, 34, 22, 1, 'e');   // furled on the boom, tied
    for (let x = 11; x < 29; x += 6) g.r(x, 31, 1, 4, 's');
  }
  // jib: from high on the mast down the forestay to the bow (furled to a thin roll along the stay)
  const jh = 12 + Math.round(k * 8.6);
  if (k < 5) {
    const pts = [[32, jh], [54, 61], [34, 60]], bul = (k ? 1 : 2.4 + fl * 0.8) * (1 - k / 6);
    for (let i = 1; i < 10; i++) { const u = i / 10, x = 34 + (32 - 34) * u, y = 60 + (jh - 60) * u; pts.push([x - bul * Math.sin(u * Math.PI), y]); }
    g.t(pts, 'c');
    for (let y = jh; y <= 61; y++) for (let x = 30; x < 56; x++) if (g.at(x, y) === 'c' && (g.at(x - 1, y) === '.' || g.at(x - 2, y) === '.')) g.p(x, y, 'e');
    g.l(35, 58, 51, 58, 's', 1);
  } else g.l(33, 50, 52, 61, 'c', 2);
  // mast and boom
  g.r(29, 2, 3, 64, 'm').r(29, 2, 1, 64, 'M').r(28, 1, 5, 2, 'd');
  g.r(6, boom, 25, 2, 'm').r(6, boom, 25, 1, 'M').r(5, boom, 2, 3, 'd');
  g.shade('c', null, 'e');
  g.outline();
  // stays and the sheet: thin lines, not outlined
  g.l(31, 3, 55, 62, 't', 1);
  g.l(29, 3, 1, 63, 't', 1);
  g.l(7, boom + 2, 7, 52, 't', 1);
  RIG.push(g.sprite(BPAL));
}
const rigFrame = (k, fl) => RIG[k ? k + 1 : fl];
// the boat at world bx (centre), keel at ky: rig k (0-5), the hero at the tiller if seat is set
// ('sit' or 'stand'), bump = a lurch forward when it runs aground
function drawBoatAt(bx, ky, k, seat, bump) {
  const hx = Math.round(bx) - 27, hy = Math.round(ky) - 14;
  ctx.save();
  if (bump > 4) { ctx.translate(hx + 50, hy + 14); ctx.rotate(-0.012 * (bump - 4)); ctx.translate(-hx - 50, -hy - 14); }
  spr(rigFrame(k, (G.t >> 3) & 1), hx, hy + 4 - 65);
  // pennant at the masthead, streaming forward in the breeze
  const px = hx + 32, py = hy + 4 - 64, f = (G.t >> 2) % 3;
  R(px, py, 1, 4, OUT);
  for (let i = 0; i < 7; i++) { const yy = py + Math.round(Math.sin(i * 0.9 - G.t * 0.3) * 0.8) + (f === 2 && i > 4 ? 1 : 0); R(px + 1 + i, yy, 1, Math.max(1, 3 - (i >> 1)), i < 3 ? '#e8503a' : '#ff7a5a'); }
  if (seat) drawHero(HEROES[G.hero], hx + 15 + (bump > 2 ? 1 : 0), hy + 9, 1, { pose: seat === 'sit' ? 'crouch' : 'idle', t: G.t, aim: 'fwd' });
  spr(HULL, hx, hy);
  ctx.restore();
}
// the wave the boat rides in on: the sea washes up the black sand to x front (it recedes once the boat is aground),
// over the hull's bottom, with a foam crest; a bow wave and a wake while it moves
function boatWater(b, front) {
  const hx = Math.round(b.x) - 27, wl = BOAT_Y, f0 = Math.round(front);
  ctx.fillStyle = 'rgba(56,176,194,0.5)';
  for (let y = wl; y < H; y++) { const xr = f0 - Math.round((y - wl) * 1.15 + Math.sin(y * 0.7 + G.t * 0.06) * 1.2); if (xr > 0) ctx.fillRect(0, y, xr, 1); else break; }
  for (let y = wl - 1; y < H; y++) {
    const xr = f0 - Math.round((y - wl) * 1.15 + Math.sin(y * 0.7 + G.t * 0.06) * 1.2);
    if (xr <= 0) break;
    R(xr - 2, y, 2, 1, (y + (G.t >> 3)) % 5 ? '#ffffff' : '#c8f4ee');
    if ((y * 5 + (G.t >> 2)) % 11 === 0 && xr > 14) R(xr - 9 - (y % 4) * 3, y, 3, 1, '#e8fffa');
  }
  for (let x = Math.max(0, hx); x < Math.min(f0 - 2, hx + 57); x += 2) R(x, wl - ((x + (G.t >> 2)) % 7 === 0 ? 1 : 0), 2, 1, (x >> 1) % 3 ? '#ffffff' : '#c8f4ee');
  if (!b.go) return;
  const bwx = hx + 54;
  for (let i = 0; i < 7; i++) { const a = (G.t * 0.5 + i * 7) % 12; R(bwx - 3 + i, wl - 2 - Math.round(Math.sin(i / 6 * Math.PI) * 3) + (a < 6 ? 0 : 1), 1, 1, i % 2 ? '#ffffff' : '#e8fdff'); }
  for (let i = 0; i < 9; i++) {
    const age = i * 5 + (G.t % 5), wx = hx - 2 - age * 1.6, spread = age * 0.35;
    ctx.globalAlpha = Math.max(0, 1 - age / 46);
    R(Math.round(wx), wl - 1 - Math.round(spread * 0.3), 3, 1, '#ffffff');
    R(Math.round(wx), wl + 1 + Math.round(spread), 3, 1, '#e8fdff');
  }
  ctx.globalAlpha = 1;
}
PROP_TYPES.l3boat = {
  box: () => null, hit() {},
  draw(o) {
    const b = S.boat;
    if (!b) return;
    const moving = b.go, ky = b.ky;
    if (ky <= BOAT_Y + 0.5) {   // aground: a soft shadow on the sand, a little heap of sand at the bow
      ctx.globalAlpha = 0.35; R(Math.round(b.x) - 25, BOAT_Y + 1, 50, 2, '#14101a'); R(Math.round(b.x) - 20, BOAT_Y + 3, 38, 1, '#14101a'); ctx.globalAlpha = 1;
    }
    drawBoatAt(b.x, ky + (moving ? Math.round(Math.sin(G.t * 0.12)) : 0), b.k, b.hero, b.bump);
    if (b.wash > 0) boatWater(b, b.wash);
    if (b.k >= 5 && !b.hero && ky <= BOAT_Y + 0.5) R(Math.round(b.x) + 26, BOAT_Y, 4, 1, '#6a6272');
  }
};
// keep the boat prop first in G.props (drawn right after the ground)
function placeBoat() {
  if (!S.boat || G.props.some(o => o.k === 'l3boat')) return;
  G.props.unshift({ k: 'l3boat', x: BOAT_X, y: BOAT_Y, hitT: 0, dead: false });
}

// ============================================================
// Intro (5 s): letterbox bars and a caption, gulls; in the golden morning the little sailboat comes in from the
// left with the volcano smoking behind, its sail full, a bow wave and a wake; it runs up onto the black sand with a
// crunch, the sail drops and is furled, the hero stands, hops out over the side onto the beach at x 140, "LET'S GO!",
// MISSION 3 START! (said aloud), the area name, bars out. Enter skips to the banner with the hero on the beach.
// ============================================================
const IT = { beach: 150, drop: 158, dropLen: 24, stand: 188, hop: 198, say: 236, go: 252, banner: 266, out: 272, end: 300 };
const BARS = 34;
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
function gull(d) { Snd.tone('triangle', 1500, 1100, 0.12, 0.03, d); Snd.tone('triangle', 1700, 1200, 0.16, 0.03, d + 0.16); }
// two gulls gliding over the bay (screen space), flapping now and then
const GULL = [['.k.....k.', 'kwk...kwk', '..kwkwk..', '...kgk...'], ['.........', '.kk...kk.', 'kwwkwkwwk', '...kgk...'], ['.........', '.........', 'kkwwkwwkk', '..kwgwk..']].map(r => makeSprite(r, { k: '#3a4250', w: '#ffffff', g: '#ffb020' }));
function drawGulls(t) {
  for (const [x0, y0, sp, ph] of [[-20, 62, 0.9, 0], [-60, 76, 0.75, 9]]) {
    const x = Math.round(x0 + t * sp), y = Math.round(y0 + Math.sin((t + ph) * 0.05) * 6);
    if (x < -12 || x > W + 12) continue;
    const fl = (t + ph) % 70 < 24 ? [0, 1, 2, 1][((t + ph) >> 2) & 3] : 1;
    spr(GULL[fl], x, y);
  }
}
function makeIntro() {
  let t = 0, skipped = false;
  const land = () => { const p = G.p; p.hidden = false; p.x = 140; p.y = groundAt(140); p.vy = 0; p.vx = 0; p.onGround = true; p.facing = 1; };
  const beach = b => { b.x = BOAT_X; b.ky = BOAT_Y; b.k = 5; b.go = false; b.bump = 0; b.hero = false; b.wash = 0; };
  return {
    start() {
      t = 0; skipped = false;
      const p = G.p; p.hidden = true; p.facing = 1; G.introKeys = {};
      S.boat = { x: -80, ky: BOAT_Y + 3, k: 0, hero: 'sit', go: true, bump: 0, wash: 40 };
      placeBoat();
    },
    update() {
      t++;
      const p = G.p, b = S.boat || (S.boat = { x: BOAT_X, ky: BOAT_Y, k: 5, hero: false, go: false, bump: 0 });
      placeBoat();
      if (!skipped && t > 10 && t < IT.go && pressed.Enter) { skipped = true; t = IT.go; beach(b); G.introKeys = {}; land(); }
      if (b.bump > 0) b.bump--;
      if (!skipped) {
        if (t <= IT.beach) {
          const u = t / IT.beach;
          b.x = -80 + (BOAT_X + 80) * (1 - Math.pow(1 - u, 2.2));
          b.ky = BOAT_Y + 3 * clamp((96 - b.x) / 30, 0, 1);
          b.wash = Math.max(40, b.x + 34);
          if (t % 40 === 20) Snd.noise(0.6, 0.025, 700);               // the sea swishing past the hull
        }
        if (t === 24) gull(0);
        if (t === 112) gull(0.1);
        if (t === IT.beach) {
          b.go = false; b.bump = 10; b.x = BOAT_X; b.ky = BOAT_Y;
          Snd.noise(0.35, 0.12, 700); Snd.tone('sine', 120, 60, 0.2, 0.15);
          dust(b.x + 27, BOAT_Y, 6, 1); dust(b.x + 20, BOAT_Y, 3, 1); dust(b.x - 10, BOAT_Y, 2, -1);
          G.shake = Math.max(G.shake, 1.5);
        }
        if (t >= IT.drop && t <= IT.drop + IT.dropLen) {
          b.k = Math.min(5, 1 + Math.floor((t - IT.drop) / IT.dropLen * 5));
          if (t === IT.drop) { Snd.noise(0.4, 0.06, 500); Snd.tone('triangle', 300, 180, 0.3, 0.04); }
          if (t === IT.drop + IT.dropLen) Snd.tone('square', 900, 1200, 0.05, 0.03);
        }
        if (t > IT.beach) b.wash = t < IT.beach + 50 ? (BOAT_X + 34) - (BOAT_X + 34 - 30) * ease((t - IT.beach) / 50) : 0;
        if (t === IT.stand) b.hero = 'stand';
        if (t === IT.hop) {
          b.hero = false; p.hidden = false; p.x = b.x - 12; p.y = BOAT_Y - 5; p.vy = -4.6; p.vx = 0; p.onGround = false; p.facing = 1;
          Snd.jump();
        }
        if (t >= IT.hop) G.introKeys = { right: p.x < 138, jump: p.vy < 0 && !p.onGround };
      }
      if (t === IT.go) { G.big = { s: VOLCANO.startText, t: 130 }; say(VOLCANO.startSay); }
      if (t === IT.banner) G.banner = { s: SECTIONS[0].name, t: 200 };
      if (t < IT.end) return false;
      if (p.hidden || b.hero) { beach(b); land(); }
      b.go = false; G.introKeys = {};
      return true;
    },
    draw() {
      // the warm morning light while the bars are in
      const k = t < 10 ? ease(t / 10) : t > IT.out ? 1 - ease((t - IT.out) / (IT.end - IT.out)) : 1;
      if (t < IT.go) drawGulls(t);
      // the hero: "LET'S GO!"
      if (t >= IT.say && t < IT.say + 44 && !G.p.hidden) {
        const bx = Math.round(G.p.x - G.cam.x) + 2, by = Math.round(G.p.y) - 56 + (t < IT.say + 4 ? IT.say + 4 - t : 0);
        RO(bx - 28, by, 57, 13, '#ffffff'); R(bx - 28, by + 12, 57, 1, '#d8dce6');
        R(bx - 6, by + 13, 4, 1, '#ffffff'); R(bx - 5, by + 14, 2, 1, '#ffffff');
        R(bx - 7, by + 13, 1, 1, OUT); R(bx - 2, by + 13, 1, 1, OUT); R(bx - 6, by + 14, 1, 1, OUT); R(bx - 3, by + 14, 1, 1, OUT); R(bx - 5, by + 15, 2, 1, OUT);
        text("LET'S GO!", bx + 1, by + 3, '#2a3a6a', 1, 'center', null);
      }
      // letterbox bars: in at the start, out at the end; a caption in the bottom bar
      const bh = Math.round(BARS * k);
      if (bh > 0) {
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
        ctx.fillStyle = '#1c1c2a'; ctx.fillRect(0, bh - 1, W, 1); ctx.fillRect(0, H - bh, W, 1);
        const ca = Math.min(1, (t - 14) / 14, (150 - t) / 14);
        if (ca > 0) {
          ctx.globalAlpha = ca;
          const tx = W / 2 - 88, ty = H - bh + 9;
          R(tx + 3, ty, 2, 9, '#a8845a'); R(tx - 1, ty - 1, 4, 2, '#4cae46'); R(tx + 4, ty - 1, 5, 2, '#4cae46'); R(tx - 2, ty + 1, 2, 1, '#4cae46'); R(tx + 8, ty + 1, 2, 1, '#4cae46');
          text('SOMEWHERE IN THE SOUTH SEAS', tx + 14, ty + 1, '#f4e2b8', 1, 'left', null);
          ctx.globalAlpha = 1;
        }
        if (!skipped && t > 160 && t < IT.go && (t >> 4) % 2) text('ENTER: SKIP', W - 8, H - bh + 11, '#8a8aa0', 1, 'right', null);
      }
    }
  };
}

// ============================================================
// The animals (art faces right; drawn facing the hero). Each kind: a grid w x h (feet on row h - 2, the outline on
// the last row, the feet centred on column ax), its cage (cw x ch), the head box (drawn again over the bars: the face
// pressed between them), the hand (where it holds the item it tosses, from the feet), a painter for the poses, its
// shading, its call (short Snd tones), its happy dance and how it goes home (flies or runs).
// Poses: stand, blink, look (peeking, eyes wide), call (shouting HELP!), happy, jump (the happy jump), salute (a wing,
// flipper or paw at the brow), toss (flinging the item forward) and m0-m3 (flying or walking away).
// ============================================================
const POSE = {
  stand: { face: 'n', arm: 'rest', leg: 'stand' }, blink: { face: 'b', arm: 'rest', leg: 'stand' },
  look: { face: 'w', arm: 'rest', leg: 'stand', lean: 1 }, call: { face: 'o', arm: 'rest', leg: 'stand', open: 1 },
  happy: { face: 'h', arm: 'rest', leg: 'stand', open: 1 }, jump: { face: 'h', arm: 'up', leg: 'tuck', open: 1 },
  salute: { face: 's', arm: 'salute', leg: 'stand' }, toss: { face: 'h', arm: 'toss', leg: 'stand', open: 1 },
  m0: { face: 'h', arm: 'm', leg: 'm', f: 0 }, m1: { face: 'h', arm: 'm', leg: 'm', f: 1 },
  m2: { face: 'h', arm: 'm', leg: 'm', f: 2 }, m3: { face: 'h', arm: 'm', leg: 'm', f: 3 }
};
// an eye at (x, y) (top-left of the 2x2 pupil): a white glint; b = blinking, h = happy ^, w/o = wide open (one taller)
function eye(g, x, y, f, n = 'n') {
  if (f === 'b') g.r(x - 1, y + 1, 3, 1, n);
  else if (f === 'h') g.p(x - 1, y + 1, n).p(x, y, n).p(x + 1, y, n).p(x + 2, y + 1, n);
  else if (f === 'w' || f === 'o') g.r(x, y - 1, 2, 3, n).p(x, y - 1, 'W').p(x, y, 'W');
  else g.r(x, y, 2, 2, n).p(x, y, 'W');
}
// a worried brow over an eye (calling for help) or a raised one (peeking)
function brow(g, x, y, f, c = 'n') {
  if (f === 'o') g.p(x - 1, y - 2, c).p(x, y - 3, c).p(x + 1, y - 3, c);
  else if (f === 'w') g.p(x, y - 3, c).p(x + 1, y - 3, c);
}
// wing flaps (side view): the near wing up, spread, down, spread; shape from the shoulder sx..sx+sw at y sy
function wingFlap(g, f, sx, sw, sy, len, c, tip, ft = 0.32) {
  const k = [0, 1, 2, 1][f];
  if (k === 0) { g.t([[sx, sy], [sx + sw, sy], [sx + sw * 0.5 - len * 0.25, sy - len], [sx - len * 0.35, sy - len * 0.86]], c); g.t([[sx + sw * 0.5 - len * 0.25, sy - len], [sx - len * 0.35, sy - len * 0.86], [sx - len * 0.2, sy - len * (1 - ft)], [sx + sw * 0.35 - len * 0.25, sy - len * (1 - ft * 0.8)]], tip); }
  else if (k === 1) { g.t([[sx - 1, sy - 1], [sx + sw + 1, sy - 1], [sx + sw * 0.6, sy + 3], [sx - len * 0.8, sy + 3], [sx - len * 0.95, sy + 1]], c); g.t([[sx - len * 0.55, sy + 3], [sx - len * 0.8, sy + 3], [sx - len * 0.95, sy + 1], [sx - len * 0.6, sy]], tip); }
  else { g.t([[sx, sy], [sx + sw, sy], [sx + sw * 0.4 - len * 0.1, sy + len], [sx - len * 0.3, sy + len * 0.9]], c); g.t([[sx + sw * 0.4 - len * 0.1, sy + len], [sx - len * 0.3, sy + len * 0.9], [sx - len * 0.2, sy + len * (1 - ft)], [sx + sw * 0.3 - len * 0.1, sy + len * (1 - ft * 0.8)]], tip); }
}
const KINDS = {
  // a sea turtle: a high green shell with lit scutes and a yellow rim, pale skin, a big round head and worried eyes
  turtle: {
    w: 38, h: 23, ax: 16, cw: 40, ch: 28, fly: false, dance: 'spin', head: [24, 0, 38, 17], hand: [14, -19],
    pal: { k: OUT, g: '#4f8a3c', G: '#86c255', h: '#2f5a2a', l: '#a8d65e', m: '#e8d26c', M: '#b0962e', c: '#f2e6b4', s: '#a9c79a', S: '#d9ecc8', d: '#6f9a66', n: '#1a1a26', W: '#ffffff', p: '#f4978e', r: '#c0404a' },
    shade: [['g', 'G', null], ['s', 'S', 'd']],
    paint(g, P) {
      const f = P.f || 0, walk = P.leg === 'm', ln = P.lean ? 2 : 0, hy = P.arm === 'up' ? -1 : 0;
      // back flipper
      const bk = walk ? [0, 2, 0, -2][f] : P.arm === 'up' ? -3 : 0;
      g.e(4 - bk * 0.5, 18.5 + (P.arm === 'up' ? -2 : 0), 3.6, 1.6, 's');
      // neck and head (pushed forward when peeking)
      g.l(22, 15, 27 + ln, 12 + hy, 's', 4);
      g.e(30.5 + ln, 9.5 + hy, 4.6, 4.2, 's');
      // the shell: a high dome, a yellow rim, a cream belly plate
      g.t([[2, 17], [3, 12], [6, 8], [11, 5.5], [18, 5.5], [23, 8], [26, 12], [27, 17]], 'g');
      g.r(2, 15, 25, 1, 'm').r(3, 16, 23, 1, 'c').p(1, 15, 'M').p(27, 15, 'M');
      for (const [x, y] of [[9.5, 8.5], [14.5, 7.2], [19.5, 8.5]]) g.e(x, y, 2.4, 1.6, 'G');
      for (const [x, y] of [[5.5, 12], [10.5, 11.6], [15.5, 11.6], [20.5, 11.6], [24.5, 12.4]]) g.e(x, y, 1.7, 1.1, 'l');
      for (const x of [8, 13, 18, 23]) g.r(x, 10, 1, 4, 'h');
      for (let x = 5; x <= 24; x++) if (g.at(x, 9) === 'g') g.p(x, 9, 'h');
      // front flipper: resting, walking, at the brow (salute), up (jump) or flung forward (toss)
      if (P.arm === 'salute') g.l(23, 16, 27 + ln, 9, 's', 3).l(27, 9, 30, 4, 's', 2).p(31, 3, 's');
      else if (P.arm === 'up') g.t([[21, 15], [24, 13], [33, 8], [34, 10], [24, 17]], 's');
      else if (P.arm === 'toss') g.t([[21, 15], [24, 13], [36, 13], [36, 15], [24, 17]], 's');
      else { const fw = walk ? [3, 0, -3, 0][f] : 0; g.t([[20, 15], [24, 14], [31 + fw, 19], [29 + fw, 21], [21, 18]], 's'); }
      // face: big eye, rosy cheek, a little beak-mouth
      const ex = 31 + ln, ey = 7 + hy;
      eye(g, ex, ey, P.face); brow(g, ex, ey, P.face, 'd');
      g.p(30 + ln, 11 + hy, 'p');
      if (P.open) g.r(33 + ln, 11 + hy, 2, 2, 'n').p(33 + ln, 12 + hy, 'r');
      else if (P.face === 's' || P.face === 'h') g.p(33 + ln, 11 + hy, 'n').p(34 + ln, 10 + hy, 'n');
      else g.p(34 + ln, 11 + hy, 'd');
    },
    call(d) { Snd.tone('triangle', 420, 760, 0.14, 0.09, d); Snd.tone('triangle', 520, 980, 0.18, 0.09, d + 0.17); Snd.tone('sine', 1300, 1500, 0.08, 0.04, d + 0.36); }
  },
  // a white pelican: a round body, black wingtips, a long yellow bill and an orange throat pouch, orange feet
  pelican: {
    w: 40, h: 37, ax: 15, cw: 38, ch: 42, fly: true, dance: 'flap', head: [17, 0, 40, 18], hand: [7, -34],
    pal: { k: OUT, w: '#ecebe4', V: '#ffffff', v: '#c4c6cc', g: '#b8bec8', G: '#d8dce2', a: '#8f96a2', n: '#1a1a26', W: '#ffffff', y: '#f6c83a', Y: '#ffe68a', o: '#f08a2a', O: '#b8581a', l: '#f0902e', L: '#c0661a', p: '#f4a0a8', i: '#ffcf9a' },
    shade: [['w', 'V', 'v'], ['g', 'G', 'a']],
    paint(g, P) {
      const fly = P.leg === 'm', f = P.f || 0;
      if (fly) {
        // flying: neck folded back on the shoulders, the bill resting on it, feet tucked behind
        const b = [0, 1, 2, 1][f] - 1;
        g.t([[2, 20 + b], [8, 18 + b], [8, 23 + b], [3, 22 + b]], 'w');
        g.r(4, 23 + b, 3, 1, 'l');
        g.e(15, 20 + b, 9.5, 4.8, 'w');
        g.e(24, 15 + b, 4, 3.6, 'w');
        g.t([[26, 14 + b], [38, 18 + b], [38, 19 + b], [27, 17 + b]], 'y');
        g.t([[27, 17 + b], [37, 19 + b], [31, 21 + b], [27, 20 + b]], 'o');
        g.p(38, 19 + b, 'O');
        eye(g, 25, 13 + b, 'h');
        wingFlap(g, f, 10, 9, 18 + b, 16, 'g', 'n');
        return;
      }
      // legs and webbed feet
      if (P.leg === 'tuck') g.r(12, 28, 1, 3, 'l').r(16, 28, 1, 3, 'l').r(10, 31, 4, 1, 'l').r(15, 31, 4, 1, 'l');
      else g.r(12, 28, 1, 7, 'l').r(16, 28, 1, 7, 'l').r(10, 35, 4, 1, 'l').r(15, 35, 4, 1, 'L').p(10, 35, 'L');
      // tail and round body
      g.t([[2, 21], [8, 19], [8, 25], [3, 24]], 'w');
      g.e(13.5, 22.5, 9, 6.5, 'w');
      // neck curving up to the head (forward when peeking)
      const ln = P.lean ? 2 : 0;
      g.l(19, 20, 21 + ln, 11, 'w', 4);
      g.e(22 + ln, 8.5, 4, 3.8, 'w');
      g.r(19 + ln, 4, 2, 1, 'i').p(19 + ln, 3, 'i');                                      // a little crest
      // the bill: a long yellow upper mandible with a hooked tip, the orange pouch (it opens to shout or toss)
      const op = P.open ? 1 : 0;
      g.t([[24 + ln, 6.5 - op], [38 + ln, 9 - op], [38 + ln, 10 - op], [25 + ln, 10 - op]], 'y');
      g.r(25 + ln, 7 - op, 12, 1, 'Y').p(39 + ln, 10 - op, 'O');
      if (op) g.t([[25 + ln, 11], [35 + ln, 11.5], [31 + ln, 17], [25 + ln, 15]], 'o').r(25 + ln, 10, 10, 1, 'O');
      else g.t([[25 + ln, 10], [36 + ln, 10.5], [31 + ln, 15], [25 + ln, 13]], 'o');
      // the near wing: folded (black primaries at the back), at the brow, spread up or out
      if (P.arm === 'salute') { g.t([[9, 20], [16, 18], [21 + ln, 7], [24 + ln, 3], [24 + ln, 5], [19, 17], [12, 25]], 'g'); g.t([[21 + ln, 7], [24 + ln, 3], [24 + ln, 5], [22 + ln, 8]], 'n'); }
      else if (P.arm === 'up') { g.t([[8, 21], [17, 19], [12, 4], [5, 2]], 'g'); g.t([[12, 4], [5, 2], [6, 8], [11, 9]], 'n'); }
      else if (P.arm === 'toss') { g.t([[9, 20], [17, 18], [27, 16], [26, 19], [12, 25]], 'g'); g.t([[23, 16.5], [27, 16], [26, 19], [23, 19]], 'n'); }
      else { g.e(12, 22, 7, 4.2, 'g'); g.t([[3, 21], [9, 20], [9, 25], [4, 24]], 'n'); }
      // face: eye with a pink ring, worried or happy
      const ex = 22 + ln, ey = 7;
      g.p(ex - 1, ey + 1, 'p').p(ex + 2, ey + 1, 'p');
      eye(g, ex, ey, P.face); brow(g, ex, ey, P.face, 'a');
    },
    call(d) { for (let i = 0; i < 3; i++) Snd.tone('sawtooth', 300 - i * 20, 230 - i * 20, 0.13, 0.07, d + i * 0.16); Snd.noise(0.1, 0.03, 900, d); }
  },
  // a scarlet macaw: red, a yellow and blue wing, a long tail, a white face patch and a big hooked beak
  parrot: {
    w: 38, h: 40, ax: 14, cw: 30, ch: 44, fly: true, dance: 'flap', head: [11, 2, 30, 17], hand: [3, -35],
    pal: { k: OUT, r: '#e8352a', R: '#ff7a5a', q: '#a81e1e', y: '#ffd23f', Y: '#fff0a0', b: '#2f7fe0', B: '#1d58b0', u: '#8ac4ff', w: '#f4f0e8', c: '#efe6d4', C: '#c8bca4', n: '#1a1a26', W: '#ffffff', f: '#6a6a72', p: '#f2848c', z: '#5a1414' },
    shade: [['r', 'R', 'q'], ['b', 'u', 'B']],
    paint(g, P) {
      const fly = P.leg === 'm', f = P.f || 0;
      if (fly) {
        const b = [0, 1, 2, 1][f] - 1;
        g.t([[12, 22 + b], [1, 27 + b], [1, 29 + b], [12, 26 + b]], 'r').t([[5, 26 + b], [1, 27 + b], [1, 29 + b], [5, 28 + b]], 'b');
        g.e(18, 23 + b, 7.5, 4.6, 'r');
        g.e(26, 19 + b, 4.4, 4.2, 'r');
        g.e(27.5, 19.5 + b, 2.4, 2.4, 'w');
        g.t([[29, 16.5 + b], [33, 18 + b], [34, 21 + b], [32, 23 + b], [30, 21 + b]], 'c').p(31, 22 + b, 'n');
        eye(g, 27, 18 + b, 'h');
        wingFlap(g, f, 15, 8, 21 + b, 15, 'b', 'y', 0.6);
        return;
      }
      const ln = P.lean ? 2 : 0;
      // the long tail down to the floor, feet
      g.t([[9, 27], [13, 29], [6, 38], [3, 37]], 'r').t([[5, 34], [8, 34], [6, 38], [3, 37]], 'b');
      if (P.leg === 'tuck') g.r(12, 33, 3, 1, 'f').r(16, 33, 3, 1, 'f');
      else g.r(13, 33, 1, 4, 'f').r(16, 33, 1, 4, 'f').r(11, 37, 4, 1, 'f').r(15, 37, 4, 1, 'f');
      // body and head
      g.e(14.5, 25, 6, 8.5, 'r');
      g.e(17 + ln, 11, 5.4, 5.2, 'r');
      g.e(19.5 + ln, 11.5, 2.8, 3.2, 'w');
      for (const [x, y] of [[18, 13], [20, 13], [19, 14]]) g.p(x + ln, y, 'C');
      // the hooked beak (the lower half drops open to shout)
      g.t([[22 + ln, 7.5], [26 + ln, 9], [27.5 + ln, 12], [26.5 + ln, 15], [25 + ln, 13], [22 + ln, 12.5]], 'c');
      g.p(26 + ln, 14, 'C').p(26 + ln, 15, 'C');
      if (P.open) g.t([[22 + ln, 13], [25 + ln, 14], [24 + ln, 17], [22 + ln, 16]], 'n').p(23 + ln, 14, 'p');
      else g.t([[22 + ln, 12.5], [25 + ln, 13.5], [24 + ln, 15], [22 + ln, 15]], 'n');
      // the wing: folded (yellow over blue), at the brow, up or flung out
      if (P.arm === 'salute') { g.t([[11, 22], [15, 18], [20 + ln, 9], [23 + ln, 6], [22 + ln, 9], [17, 19], [13, 27]], 'b'); g.t([[11, 22], [15, 18], [16, 22], [12, 26]], 'y'); }
      else if (P.arm === 'up') { g.t([[10, 21], [16, 19], [13, 4], [6, 3]], 'b'); g.t([[10, 21], [16, 19], [14, 13], [9, 13]], 'y'); }
      else if (P.arm === 'toss') { g.t([[11, 21], [16, 19], [29, 18], [28, 22], [13, 27]], 'b'); g.t([[11, 21], [16, 19], [20, 19], [19, 23], [13, 25]], 'y'); }
      else { g.e(12, 24, 4.6, 6.8, 'b'); g.e(12.6, 20.5, 4, 3.6, 'y'); }
      eye(g, 19 + ln, 10, P.face); brow(g, 19 + ln, 10, P.face, 'q');
    },
    call(d) { for (let i = 0; i < 2; i++) { Snd.tone('sawtooth', 1500, 820, 0.13, 0.05, d + i * 0.2); Snd.noise(0.09, 0.04, 3600, d + i * 0.2); } Snd.tone('sine', 1200, 2200, 0.16, 0.05, d + 0.44); }
  },
  // a little capuchin monkey: brown, a dark cap, a big cream heart-shaped face, round ears, a curly tail
  monkey: {
    w: 30, h: 32, ax: 14, cw: 32, ch: 38, fly: false, dance: 'flip', head: [6, 0, 26, 18], hand: [2, -29],
    pal: { k: OUT, b: '#8a5a34', B: '#b07e50', d: '#5e3a1e', D: '#3a2412', c: '#f0cfa0', C: '#ffe4c0', e: '#c8a070', E: '#7a4a28', n: '#1a1a26', W: '#ffffff', p: '#f2848c', r: '#b8303a' },
    shade: [['b', 'B', 'd'], ['c', 'C', null]],
    paint(g, P) {
      const run = P.leg === 'm', f = P.f || 0, ln = P.lean ? 1 : run ? 1 : 0, bob = run ? [0, -1, 0, -1][f] : 0;
      // the curly tail
      const tw = run ? [0, 1, 0, -1][f] : 0;
      g.l(9, 24, 4, 21 + tw, 'b', 2).l(4, 21 + tw, 3, 15 + tw, 'b', 2).e(5, 13.5 + tw, 2.6, 2.6, 'b').p(5, 13 + tw, '.').p(5, 14 + tw, '.');
      // legs: standing, tucked (jump) or running (far leg darker)
      const legs = P.leg === 'tuck' ? [[11, 24, 9, 27, 'd'], [16, 24, 18, 27, 'b']]
        : run ? [[[11, 24, 18, 28, 'd'], [15, 24, 8, 28, 'b']], [[11, 24, 13, 27, 'd'], [15, 24, 14, 29, 'b']], [[11, 24, 8, 28, 'd'], [15, 24, 19, 28, 'b']], [[11, 24, 13, 29, 'd'], [15, 24, 15, 27, 'b']]][f]
        : [[11, 24, 11, 29, 'd'], [16, 24, 16, 29, 'b']];
      for (const [x0, y0, x1, y1, c] of legs) g.l(x0, y0 + bob, x1, y1 + bob, c, 2).r(x1 - 1, y1 + 1 + bob, 3, 1, c === 'd' ? 'D' : 'd');
      // body, belly
      g.e(13.5, 21.5 + bob, 5, 5.5, 'b');
      g.e(15, 22.5 + bob, 3, 3.6, 'c');
      // the far arm (behind): down, or up for the jump
      if (P.arm === 'up') g.l(11, 18, 6, 9, 'd', 2).r(5, 7, 2, 2, 'e');
      else if (run) g.l(11, 18 + bob, [16, 12, 7, 12][f], [22, 23, 21, 23][f] + bob, 'd', 2);
      else g.l(11, 18, 10, 24, 'd', 2);
      // the head, front-on: round ears, a dark cap, the cream face mask round both eyes and the muzzle
      const hx = 15 + ln, hy = 9.5 + bob;
      for (const ex of [hx - 6.4, hx + 6.4]) g.e(ex, hy, 2.3, 2.5, 'b').e(ex, hy, 1.1, 1.3, 'e');
      g.e(hx, hy, 6, 5.6, 'b');
      g.e(hx - 2.2, hy - 0.4, 2.8, 2.8, 'c').e(hx + 2.2, hy - 0.4, 2.8, 2.8, 'c').e(hx, hy + 3, 3.8, 2.6, 'c');
      g.t([[hx - 4.5, hy - 3.6], [hx - 1.5, hy - 5.6], [hx + 1.5, hy - 5.6], [hx + 4.5, hy - 3.6], [hx + 1, hy - 2.6], [hx, hy - 2], [hx - 1, hy - 2.6]], 'D');
      const ey = Math.floor(hy - 1);
      eye(g, Math.floor(hx - 3), ey, P.face); eye(g, Math.floor(hx + 1), ey, P.face);
      if (P.face === 'o' || P.face === 'w') { brow(g, Math.floor(hx - 3), ey, P.face, 'E'); brow(g, Math.floor(hx + 1), ey, P.face, 'E'); }
      // nose and mouth: a smile, an O (shouting) or a big grin
      const mx = Math.floor(hx), my = Math.floor(hy + 2);
      g.p(mx - 1, my, 'E').p(mx + 1, my, 'E');
      if (P.face === 'o') g.r(mx - 1, my + 2, 3, 2, 'n').p(mx, my + 3, 'r');
      else if (P.open) g.r(mx - 2, my + 2, 5, 1, 'n').r(mx - 1, my + 3, 3, 1, 'p');
      else g.p(mx - 2, my + 2, 'n').r(mx - 1, my + 3, 3, 1, 'n').p(mx + 2, my + 2, 'n');
      // the near arm: down, at the brow (a proper salute), up, throwing, or swinging as it runs
      if (P.arm === 'salute') g.l(17, 18, 22, 15, 'b', 2).l(22, 15, hx + 5, ey - 2, 'b', 2).r(hx + 2, ey - 3, 4, 2, 'c');
      else if (P.arm === 'up') g.l(17, 18, 22, 9, 'b', 2).r(21, 7, 3, 2, 'c');
      else if (P.arm === 'toss') g.l(17, 18, 23, 13, 'b', 2).l(23, 13, 27, 9, 'b', 2).r(26, 7, 3, 2, 'c');
      else if (run) { const a = [[11, 22], [17, 23], [22, 17], [17, 23]][f]; g.l(17, 18 + bob, a[0], a[1] + bob, 'b', 2).r(a[0] - 1, a[1] - 1 + bob, 2, 2, 'c'); }
      else g.l(17, 18, 18, 24, 'b', 2).r(17, 24, 2, 2, 'c');
    },
    call(d) { for (let i = 0; i < 4; i++) Snd.tone('triangle', i < 2 ? 480 : 720, i < 2 ? 760 : 1180, 0.09, 0.08, d + i * 0.12); Snd.tone('square', 1400, 1900, 0.06, 0.03, d + 0.5); }
  },
  // a toco toucan: glossy black, a white bib, a blue eye ring, the huge orange bill with a black tip
  toucan: {
    w: 38, h: 33, ax: 12, cw: 34, ch: 36, fly: true, dance: 'hop', head: [9, 0, 38, 16], hand: [2, -30],
    pal: { k: OUT, a: '#2c2c3a', A: '#4a4a66', z: '#16161e', w: '#fff6e0', y: '#ffd23f', o: '#ff8a1a', O: '#ffd23f', s: '#d85a0a', r: '#e8352a', u: '#4ac0ff', U: '#2a80c8', n: '#0e0e14', W: '#ffffff', f: '#5a7a9a' },
    shade: [['a', 'A', null]],
    paint(g, P) {
      const fly = P.leg === 'm', f = P.f || 0;
      if (fly) {
        const b = [0, 1, 2, 1][f] - 1;
        g.t([[8, 21 + b], [1, 22 + b], [1, 25 + b], [8, 25 + b]], 'a');
        g.e(13, 22 + b, 7, 4.4, 'a');
        g.e(19, 19 + b, 4, 3.8, 'a');
        g.e(20, 22 + b, 2.6, 2, 'w');
        g.t([[21, 16.5 + b], [27, 16 + b], [35, 19 + b], [36, 21 + b], [22, 22 + b]], 'o');
        g.r(23, 17 + b, 9, 1, 'O').t([[33, 18.5 + b], [36, 20 + b], [36, 21 + b], [33, 21 + b]], 'n').r(21, 17 + b, 1, 5, 'r');
        g.e(19, 18 + b, 1.6, 1.6, 'u'); eye(g, 19, 17 + b, 'h');
        wingFlap(g, f, 10, 8, 20 + b, 14, 'z', 'a');
        return;
      }
      const ln = P.lean ? 2 : 0;
      // tail, red undertail, feet
      g.t([[6, 23], [10, 25], [5, 31], [2, 30]], 'a');
      g.e(9.5, 25.5, 2, 1.4, 'r');
      if (P.leg === 'tuck') g.r(10, 27, 3, 1, 'f').r(13, 27, 3, 1, 'f');
      else g.r(11, 26, 1, 5, 'f').r(14, 26, 1, 5, 'f').r(10, 31, 3, 1, 'f').r(13, 31, 3, 1, 'f');
      // body and head
      g.e(11, 19.5, 5.6, 7.4, 'a');
      g.e(13 + ln, 8.5, 4.6, 4.6, 'a');
      g.e(15 + ln, 13.5, 3.2, 3.6, 'w');
      g.r(13 + ln, 16, 4, 1, 'y');
      // the big bill: orange with a yellow ridge, a red base line, a black tip (opens a crack to shout or toss)
      const op = P.open ? 1 : 0;
      g.t([[16 + ln, 5], [22 + ln, 4.5], [31 + ln, 7.5 - op], [34 + ln, 9.5 - op], [32 + ln, 10.5 - op], [17 + ln, 10]], 'o');
      g.r(18 + ln, 5, 10, 1, 'O').r(16 + ln, 5, 1, 6, 'r');
      g.t([[31 + ln, 7.5 - op], [34 + ln, 9.5 - op], [32 + ln, 10.5 - op], [30 + ln, 10.5 - op]], 'n');
      g.t([[17 + ln, 10 + op], [31 + ln, 10.5 + op], [29 + ln, 12.5 + op], [17 + ln, 12 + op]], 's');
      if (op) g.r(18 + ln, 10, 12, 1, 'n');
      // the wing: folded, at the brow, up, or out
      if (P.arm === 'salute') g.t([[8, 20], [12, 16], [16 + ln, 6], [18 + ln, 3], [18 + ln, 6], [14, 17], [10, 25]], 'z');
      else if (P.arm === 'up') g.t([[7, 19], [13, 18], [10, 4], [4, 3]], 'z');
      else if (P.arm === 'toss') g.t([[8, 19], [13, 17], [25, 17], [24, 20], [10, 24]], 'z');
      else g.e(9.5, 19.5, 4, 6, 'z');
      // the blue eye ring
      g.e(14 + ln, 7.5, 2, 2, 'u'); g.p(15 + ln, 9, 'U').p(13 + ln, 9, 'U');
      eye(g, 14 + ln, 7, P.face); brow(g, 14 + ln, 7, P.face, 'A');
    },
    call(d) { for (let i = 0; i < 3; i++) { Snd.tone('square', 340, 240, 0.06, 0.06, d + i * 0.1); Snd.noise(0.03, 0.05, 2400, d + i * 0.1); } Snd.tone('triangle', 700, 1100, 0.12, 0.05, d + 0.34); }
  },
  // a green iguana: a spiky yellow crest, a long banded tail, an orange dewlap, golden eyes
  iguana: {
    w: 44, h: 22, ax: 22, cw: 46, ch: 26, fly: false, dance: 'pushup', head: [28, 0, 44, 18], hand: [9, -18],
    pal: { k: OUT, g: '#4caf50', G: '#8be06a', d: '#2e7a34', D: '#24602a', l: '#c8e88a', s: '#e8d24a', S: '#fff2a0', o: '#f08a2a', O: '#ffc070', n: '#1a1a26', W: '#ffffff', y: '#ffd23f', p: '#f2848c' },
    shade: [['g', 'G', 'd']],
    paint(g, P) {
      const run = P.leg === 'm', f = P.f || 0, up = P.arm === 'up' ? 2 : 0, ln = P.lean ? 2 : 0;
      // the long tail lying on the ground (it swishes while running)
      const sw = run ? [1, 0, -1, 0][f] : 0;
      g.t([[16, 14], [8, 16 + sw], [0, 18 + sw * 1.5], [0, 19 + sw * 1.5], [8, 18 + sw], [16, 18]], 'g');
      for (const x of [3, 7, 11]) g.r(x, Math.round(17 + sw * (1.5 - x / 11)), 2, 2, 'D');
      // legs, splayed: far legs first
      const lk = run ? [[2, -2], [1, 0], [-2, 2], [0, 1]][f] : [0, 0];
      g.l(16, 16, 14 + lk[1], 20, 'd', 2).l(27, 16 - up, 30 - lk[0], 20, 'd', 2);
      // body (raised at the front for a push-up)
      g.t([[13, 12], [20, 10 - up], [27, 10 - up], [29, 15 - up], [26, 18], [14, 18]], 'g');
      g.r(15, 17, 11, 1, 'l');
      // head and snout
      g.e(31 + ln, 11 - up, 4.4, 3.4, 'g');
      g.t([[32 + ln, 8.5 - up], [39 + ln, 10.5 - up], [40 + ln, 12.5 - up], [32 + ln, 14 - up]], 'g');
      // the dewlap under the jaw
      g.t([[29 + ln, 13 - up], [35 + ln, 13.5 - up], [31 + ln, 18 - up]], 'o'); g.p(31 + ln, 15 - up, 'O').p(32 + ln, 14 - up, 'O');
      // the crest: spikes from the neck down the back
      for (let x = 14; x <= 30; x += 2) { const top = x < 20 ? 11 : x < 28 ? 10 - up : 8 - up; g.p(x + (x > 27 ? ln : 0), top - 1, 's'); if (x > 18 && x < 30) g.p(x + (x > 27 ? ln : 0), top - 2, 'S'); }
      // near legs: the front one walks, salutes, or stays planted
      g.l(16, 16, 18 + lk[0], 20, 'g', 2).r(17 + lk[0], 20, 3, 1, 'd');
      if (P.arm === 'salute') g.l(27, 14 - up, 31, 11 - up, 'g', 2).l(31, 11 - up, 33 + ln, 7 - up, 'g', 2).p(34 + ln, 6 - up, 'g');
      else if (P.arm === 'toss') g.l(27, 14, 33, 14, 'g', 2).r(34, 13, 2, 2, 'g');
      else g.l(27, 16 - up, 28 + lk[1], 20, 'g', 2).r(27 + lk[1], 20, 3, 1, 'd');
      // the golden eye, nostril, mouth
      const ex = 33 + ln, ey = 9 - up;
      g.r(ex - 1, ey - 1, 4, 4, 'y');
      eye(g, ex, ey, P.face); brow(g, ex, ey, P.face, 'd');
      g.p(39 + ln, 11 - up, 'D');
      if (P.open) g.r(35 + ln, 13 - up, 4, 1, 'n').p(36 + ln, 12 - up, 'p'); else g.r(36 + ln, 13 - up, 3, 1, 'd');
    },
    call(d) { Snd.noise(0.2, 0.05, 4200, d); for (let i = 0; i < 3; i++) Snd.tone('triangle', 900 + i * 200, 1300 + i * 200, 0.07, 0.05, d + 0.24 + i * 0.09); }
  },
  // a flamingo: pink, the S-shaped neck, a bent black-tipped bill, one leg tucked up, black flight feathers
  flamingo: {
    w: 46, h: 42, ax: 20, cw: 30, ch: 46, fly: true, dance: 'twirl', head: [21, 0, 46, 13], hand: [6, -40],
    pal: { k: OUT, p: '#f27aa0', P: '#ffb0c8', q: '#c84a76', v: '#e8487a', V: '#ff86a8', n: '#1a1a26', W: '#ffffff', c: '#f4e8d8', l: '#e86a90', L: '#b84a70', y: '#ffd23f' },
    shade: [['p', 'P', 'q'], ['v', 'V', null]],
    paint(g, P) {
      const fly = P.leg === 'm', f = P.f || 0;
      if (fly) {
        // flying: the neck straight forward, the legs trailing straight back
        const b = [0, 1, 2, 1][f] - 1;
        g.l(1, 25 + b, 12, 24 + b, 'l', 1).r(0, 25 + b, 2, 1, 'L');
        g.e(18, 23 + b, 7, 4, 'p');
        g.t([[10, 21 + b], [13, 20 + b], [13, 25 + b], [10, 24 + b]], 'n');
        g.l(24, 22 + b, 36, 20 + b, 'p', 2);
        g.e(38, 19.5 + b, 2.6, 2.3, 'p');
        g.t([[40, 18 + b], [44, 19 + b], [45, 21 + b], [43, 23 + b], [41, 21 + b]], 'c').t([[43, 20.5 + b], [45, 21 + b], [43, 23 + b]], 'n');
        eye(g, 38, 18 + b, 'h', 'n');
        wingFlap(g, f, 14, 9, 21 + b, 15, 'v', 'n');
        return;
      }
      const ln = P.lean ? 2 : 0;
      // legs: one tucked up (standing), both down (happy), dangling (jump)
      if (P.leg === 'tuck') g.l(18, 27, 15, 37, 'l', 1).l(21, 27, 22, 37, 'l', 1).r(14, 37, 3, 1, 'l').r(21, 37, 3, 1, 'l');
      else if (P.face === 'h' || P.arm === 'toss') g.r(17, 26, 1, 14, 'l').r(21, 26, 1, 14, 'l').p(17, 32, 'L').p(21, 32, 'L').r(15, 40, 4, 1, 'l').r(20, 40, 4, 1, 'l');
      else { g.r(19, 26, 1, 14, 'l').p(19, 32, 'L').r(17, 40, 4, 1, 'l'); g.l(19, 27, 24, 31, 'l', 1).l(24, 31, 20, 34, 'l', 1).p(24, 31, 'L'); }
      // body, black flight feathers at the back
      g.e(18, 23, 7.5, 4.6, 'p');
      g.t([[9, 21], [13, 20], [13, 25], [10, 24]], 'n');
      // the S neck up to the head (forward when peeking)
      g.l(24, 21, 26, 16, 'p', 2).l(26, 16, 23 + ln, 11, 'p', 2).l(23 + ln, 11, 24 + ln, 7, 'p', 2);
      g.e(26 + ln, 5, 2.8, 2.6, 'p');
      // the bent bill (opens a crack to call)
      g.t([[28 + ln, 3.5], [32 + ln, 4.5], [33 + ln, 7.5], [31 + ln, 10], [30 + ln, 7.5], [28 + ln, 7]], 'c');
      g.t([[31 + ln, 7.5], [33 + ln, 7.5], [31 + ln, 10]], 'n');
      if (P.open) g.r(28 + ln, 7, 2, 1, 'n');
      // the wing: folded deep pink, at the brow, up, or out
      if (P.arm === 'salute') { g.t([[12, 21], [20, 18], [25 + ln, 5], [27 + ln, 1], [27 + ln, 4], [23, 18], [16, 26]], 'v'); g.t([[25 + ln, 5], [27 + ln, 1], [27 + ln, 4], [26 + ln, 6]], 'n'); }
      else if (P.arm === 'up') { g.t([[11, 22], [20, 20], [14, 6], [7, 4]], 'v'); g.t([[14, 6], [7, 4], [8, 10], [13, 11]], 'n'); }
      else if (P.arm === 'toss') { g.t([[12, 21], [20, 19], [31, 17], [30, 20], [15, 26]], 'v'); g.t([[27, 17.5], [31, 17], [30, 20], [27, 20]], 'n'); }
      else g.e(16.5, 22.5, 5.5, 3.2, 'v');
      eye(g, 26 + ln, 4, P.face); brow(g, 26 + ln, 4, P.face, 'q');
    },
    call(d) { Snd.tone('square', 640, 520, 0.09, 0.05, d); Snd.tone('square', 700, 560, 0.12, 0.05, d + 0.13); Snd.tone('square', 600, 480, 0.1, 0.04, d + 0.3); }
  }
};
for (const k in KINDS) {
  const K = KINDS[k];
  K.fr = {};
  for (const f in POSE) {
    const g = grid(K.w, K.h);
    K.paint(g, POSE[f]);
    for (const s of K.shade) g.shade(...s);
    g.outline();
    K.fr[f] = g.sprite(K.pal);
  }
}

// Cage parts that fly off when it bursts (sprites for G.parts 'sprite' particles), as in Mission 2
const CAGE_PAL = { k: OUT, m: MET, l: METL, d: METD, D: METDD, y: '#f1c40f', r: EVIL, R: '#ffb3a8' };
const BAR_SPR = makeSprite(['klk', 'klk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kdk', 'kdk'], CAGE_PAL);
const PLATE_SPR = makeSprite(['kkkkkkkkkkkkkkkk', 'kllllllllllllllk', 'kmdmmmmdmmmmmdmk', 'kddddddddddddddk', 'kkkkkkkkkkkkkkkk'], CAGE_PAL);
const BASE_SPR = makeSprite(['kkkkkkkkkkkk', 'kyyDDyyDDyyk', 'kyDDyyDDyyDk', 'kkkkkkkkkkkk'], CAGE_PAL);
const EYE_SPR = makeSprite(['..kkkk..', '.kllllk.', 'kmmmmmmk', 'kmkrRkmk', 'kmkrrkmk', 'kddddddk', '.kkkkkk.'], CAGE_PAL);

function cageBack(K) {
  const x0 = -(K.cw >> 1), top = -K.ch, n = Math.max(2, Math.round(K.cw / 8) - 1);
  ctx.globalAlpha = 0.55;
  R(x0 + 2, top + 4, K.cw - 4, 1, METD);
  for (let i = 0; i <= n; i++) R(x0 + Math.round((i + 0.5) * K.cw / (n + 1)), top + 4, 1, K.ch - 8, METD);
  ctx.globalAlpha = 1;
  R(x0 + 1, -5, K.cw - 2, 1, 'rgba(0,0,0,0.25)');
}
function cageFront(K, o, near, rattle) {
  const x0 = -(K.cw >> 1), x1 = x0 + K.cw, top = -K.ch + rattle, bh = K.ch - 6 - rattle, n = Math.max(2, Math.round(K.cw / 8) - 1);
  for (let i = 1; i <= n; i++) { const x = x0 + Math.round(i * K.cw / (n + 1)) - 1; R(x, top + 3, 1, bh, OUT); R(x + 1, top + 3, 1, bh, METL); R(x + 1, top + bh, 1, 3, MET); }
  for (const px of [x0, x1 - 2]) { RO(px, top + 2, 2, bh + 1, MET); R(px, top + 2, 1, bh + 1, METL); }
  RO(x0 - 1, top, K.cw + 2, 3, METD); R(x0 - 1, top, K.cw + 2, 1, METL);
  for (let x = x0 + 2; x < x1 - 1; x += 5) R(x, top + 1, 1, 1, METDD);
  RO(x0 - 1, -4, K.cw + 2, 4, METDD);
  for (let r = 0; r < 3; r++) for (let x = x0 - 1 + ((r + 4) & 3); x < x1 + 1; x += 4) R(x, -3 + r, Math.min(2, x1 + 1 - x), 1, '#f1c40f');
  R(x0 - 1, -4, K.cw + 2, 1, '#6a737e');
  const look = G.p ? clamp(Math.round((G.p.x - o.x) / 40), -1, 1) : 0, rate = near ? 8 : 24, on = Math.floor((o.t + o.id * 7) / rate) % 2 === 0;
  blob([[-4, top - 4, 8, 4], [-3, top - 5, 6, 1]], METD); R(-3, top - 4, 6, 1, METL); R(-4, top - 1, 8, 1, METDD);
  RO(-2, top - 3, 4, 2, '#2a0c0c'); R(-1 + look, top - 3, 2, 2, on ? EVIL : '#7a1f1f'); if (on) R(-1 + look, top - 3, 1, 1, '#ffd0cc');
  R(0, top - 8, 1, 3, METDD); R(0, top - 9, 1, 1, on ? EVIL : '#5a1a1a');
}
const HEART5 = ['.x.x.', 'xxxxx', '.xxx.', '..x..'];
function heart(x, y, c) {
  for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) if (HEART5[r][i] === 'x') R(x + i - 1, y + r - 1, 3, 3, OUT);
  for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) if (HEART5[r][i] === 'x') R(x + i, y + r, 1, 1, r === 0 && i < 2 ? '#ffc2cc' : c);
}
function sparkle(x, y, s, c) { R(x - s, y, s * 2 + 1, 1, c); R(x, y - s, 1, s * 2 + 1, c); }
// one animal frame, feet at (dx, dy), facing f, turned by rot round the middle of its body; headOnly draws just the
// head (over the cage bars: the face pressed between them)
function beast(K, fr, f, dx, dy, rot, headOnly) {
  const s = K.fr[fr], oy = -(s.h - 1);
  ctx.save(); ctx.translate(Math.round(dx), Math.round(dy)); ctx.scale(f, 1);
  if (rot) { ctx.translate(0, oy / 2); ctx.rotate(rot); ctx.translate(0, -oy / 2); }
  if (headOnly) { const [x0, y0, x1, y1] = K.head; ctx.beginPath(); ctx.rect(x0 - K.ax, y0 + oy, x1 - x0, y1 - y0); ctx.clip(); }
  spr(s, -K.ax, oy);
  ctx.restore();
}
function helpBubble(by) {
  RO(-16, by, 33, 11, '#ffffff'); R(-16, by + 10, 33, 1, '#d8dce6');
  R(-2, by + 11, 5, 1, '#ffffff'); R(-1, by + 12, 3, 1, '#ffffff'); R(0, by + 13, 1, 1, '#ffffff');
  R(-3, by + 11, 1, 1, OUT); R(3, by + 11, 1, 1, OUT); R(-2, by + 12, 1, 1, OUT); R(2, by + 12, 1, 1, OUT); R(-1, by + 13, 1, 1, OUT); R(1, by + 13, 1, 1, OUT); R(0, by + 14, 1, 1, OUT);
  text('HELP!', 1, by + 2, '#e0302a', 1, 'center', null);
}
// in the cage: shouting HELP! with the bubble, nervous between calls (blinks, peeks out between the bars, looks back
// over its shoulder, shivers); excited when the hero comes close (happy jumps, the cage rattles)
function drawTied(K, o) {
  const p = G.p, t = o.t + o.id * 37, near = !!p && !p.dead && Math.abs(p.x - o.x) < 150, bubble = Math.floor(t / 40) % 2 === 0;
  let face = -1, fr = 'stand', dx = 0, dy = 0, rattle = 0, peek = false;
  if (near) {
    face = p.x < o.x ? -1 : 1;
    const h = t % 36;
    if (h < 14) { dy = -Math.round(Math.sin(h / 14 * Math.PI) * 4); fr = 'jump'; }
    else fr = bubble ? ((t >> 3) % 2 ? 'call' : 'happy') : 'happy';
    if (h >= 14 && h < 17) rattle = 1;
    peek = face < 0;
  } else {
    const ph = t % 240;
    if (bubble && (t >> 4) % 2 === 0) fr = 'call';
    if (ph >= 40 && ph < 96) { dx = -Math.round(Math.sin((ph - 40) / 56 * Math.PI) * 3); fr = 'look'; peek = true; }
    else if (ph >= 140 && ph < 176) face = 1;
    else if (ph >= 200 && ph < 218) dx = (t >> 1) % 2 ? -1 : 0;
    if (t % 150 < 6) fr = 'blink';
  }
  cageBack(K);
  beast(K, fr, face, dx, -4 + dy, 0);
  cageFront(K, o, near, rattle);
  if (peek) beast(K, fr, face, dx, -4 + dy, 0, true);
  if (bubble) helpBubble(-K.ch - 23 + (Math.floor(t / 10) % 2));
}
// freed: hop out with hearts, salute, toss the item forward (the item flies at salute t 40), its happy dance, then
// home: the birds fly up and away, the others run (the engine moves it left 2.2 px a frame)
function drawFreed(K, o) {
  const t = o.t, p = G.p, side = o.l3side || 1, tf = o.l3dir || side;
  let face = -1, fr = 'happy', dx = 0, dy = 0, rot = 0, held = false;
  // hop clear of the hero, stay there for the salute, and back into the engine's path as it heads home
  const off = side * HOP * (o.state === 'free' ? ease(t / 22) : o.state === 'salute' ? 1 : Math.max(0, 1 - (t - 64) / 14));
  // landing on a crate: it stands on top of it (and hops down as it leaves)
  const lift = o.state !== 'free' || t > 16 ? crateLift(o.x + off) : 0;
  ctx.translate(Math.round(off), -lift);
  if (o.state === 'free') {
    const u = t / 24;
    dy = -Math.round(Math.sin(u * Math.PI) * 14 + 4 * (1 - u));
    fr = u > 0.1 && u < 0.85 ? 'jump' : 'happy';
    face = side;
    if (t < 6) { ctx.globalAlpha = 0.9 - t * 0.15; pdisc(0, -(K.ch >> 1), 14 - t * 2, '#fffbe8'); ctx.globalAlpha = 1; }
  } else if (o.state === 'salute') {
    const s = t - 24;
    face = tf;
    if (s < 10) { fr = 'salute'; face = -side; if (s < 4) dy = -1; }                     // a smart salute to the hero
    else if (s < 16) { fr = 'jump'; held = true; dy = -((s - 10) >> 1); }               // holds the present up
    else if (s < 22) { fr = 'toss'; dy = -2; }                                         // and flings it forward
    else {                                                                              // its happy dance
      const d = s - 22;
      fr = (d >> 2) % 2 ? 'happy' : 'jump';
      if (K.dance === 'spin') { fr = 'happy'; face = (d >> 2) % 2 ? 1 : -1; dy = -Math.round(Math.abs(Math.sin(d * 0.35)) * 3); }
      else if (K.dance === 'flap') { fr = (d >> 2) % 2 ? 'm0' : 'm2'; dy = -6 - Math.round(Math.sin(d * 0.25) * 3); }
      else if (K.dance === 'flip') { const u = clamp(d / 16, 0, 1); dy = -Math.round(Math.sin(u * Math.PI) * 14); rot = -u * Math.PI * 2 * face; fr = d < 16 ? 'jump' : 'happy'; }
      else if (K.dance === 'hop') dy = -Math.round(Math.abs(Math.sin(d * 0.3)) * 6);
      else if (K.dance === 'pushup') { fr = (d >> 3) % 2 ? 'jump' : 'happy'; }
      else if (K.dance === 'twirl') { fr = (d >> 2) % 2 ? 'jump' : 'happy'; face = (d >> 3) % 2 ? 1 : -1; dy = -Math.round(Math.abs(Math.sin(d * 0.2)) * 4); }
    }
  } else {
    const s = t - 64;
    if (K.fly) { dy = -Math.min(150, Math.round(4 + s * 1.2 + s * s * 0.01)); fr = 'm' + ((s >> 2) & 3); }
    else {
      fr = o.l3air ? 'jump' : 'm' + ((t >> 2) & 3); dy = o.l3air ? 0 : -((t >> 2) % 2);
      if (!o.l3air) for (let i = 0; i < 3; i++) {
        const age = (t % 7) + i * 7, r = 1 + (age >> 3);
        if (age > 18) continue;
        ctx.globalAlpha = 0.5 * (1 - age / 19);
        pdisc(Math.round(K.ax * 0.5 + age * 2.2), -1 - (age >> 2), r, o.x < 2200 ? '#b0a8b8' : o.x < 3900 ? '#c8a878' : '#9a8a90');
      }
      ctx.globalAlpha = 1;
    }
  }
  beast(K, fr, face, dx, dy, rot);
  // the present held up before the toss
  if (held && ITEMS[o.item]) {
    try { ITEMS[o.item].draw({ k: o.item, x: face * K.hand[0], y: K.hand[1] + dy, t: 1, vx: 0, vy: 0, onGround: true }); } catch (e) { errorOnce(e); }
  }
  if (t < 90) for (let i = 0; i < 4; i++) {
    const a = t - i * 12;
    if (a < 0 || a > 46) continue;
    const hx = Math.round((hsh(o.id * 7 + i) - 0.5) * 22 + Math.sin(a * 0.15 + i) * 3), hy = Math.round(-K.ch * 0.6 - 6 - a * 0.55) + Math.min(0, dy);
    if (a < 40 || a % 4 < 2) heart(hx - 2, hy, i % 2 ? '#ff5a7a' : '#ff3b5c');
  }
  if (t < 30) for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + t * 0.05, r = 6 + t * 0.7;
    if ((t + i) % 4 < 3) sparkle(Math.round(Math.cos(a) * r), Math.round(-K.ch / 2 + Math.sin(a) * r * 0.7), t < 15 ? 1 : 0, i % 2 ? '#ffe066' : '#ffffff');
  }
  // a twinkle at the brow when it salutes
  if (o.state === 'salute' && t - 24 < 8 && (t >> 1) % 2) sparkle(face * (K.head[2] - K.ax - 4), -K.h + 6 + dy, 1, '#ffffff');
}
// the cage bursting: bars, plate, base halves and the lock-eye fly off, sparks, smoke, a ring
function burst(K, o) {
  const x0 = o.x - (K.cw >> 1), cy = o.y - K.ch / 2, life = 64;
  const part = (s, x, y, vx, vy, vr) => G.parts.push({ type: 'sprite', s, x, y, vx, vy, g: 0.22, rot: rand(-0.3, 0.3), vr, life, max: life });
  for (let x = 7; x <= K.cw - 8; x += 6) { const side = x < K.cw / 2 ? -1 : 1; part(BAR_SPR, x0 + x, cy, side * rand(1.2, 2.6), rand(-3.8, -2.2), rand(-0.35, 0.35)); }
  part(PLATE_SPR, o.x, o.y - K.ch, rand(-0.6, 0.6), -4.4, rand(-0.25, 0.25));
  part(EYE_SPR, o.x, o.y - K.ch - 5, rand(-1.2, 1.2), -5.6, rand(0.3, 0.5) * (rand(0, 1) < 0.5 ? -1 : 1));
  part(BASE_SPR, o.x - K.cw / 4, o.y - 2, -rand(0.8, 1.4), -1.8, -0.15); part(BASE_SPR, o.x + K.cw / 4, o.y - 2, rand(0.8, 1.4), -1.8, 0.15);
  sparks(o.x, o.y - K.ch, 10, '#ffe066'); sparks(o.x, cy, 6, '#ffffff');
  for (let i = 0; i < 5; i++) G.parts.push({ type: 'smoke', x: o.x + rand(-K.cw / 2, K.cw / 2), y: o.y - rand(2, K.ch), vx: rand(-0.6, 0.6), vy: rand(-0.8, -0.2), life: rand(26, 40), max: 40, size: rand(3, 5) });
  G.rings.push({ x: o.x, y: cy, r: K.cw * 0.8, t: 0, max: 12 });
  G.shake = Math.max(G.shake, 1.5);
  Snd.noise(0.14, 0.2, 3200); Snd.tone('square', 900, 180, 0.16, 0.07); Snd.tone('triangle', 1200, 1800, 0.12, 0.05, 0.05);
}
for (const k of Object.keys(KINDS)) {
  const K = KINDS[k];
  POW_KINDS[k] = {
    thanks: 'THANK YOU!',
    box: o => ({ x: o.x - (K.cw >> 1), y: o.y - K.ch - 5, w: K.cw, h: K.ch + 5 }),
    draw(o) {
      ctx.save(); ctx.translate(Math.round(o.x), Math.round(o.y));
      if (o.state === 'tied') drawTied(K, o); else drawFreed(K, o);
      ctx.restore();
    },
    onFree(o) { burst(K, o); K.call(0.36); }
  };
}

// ============================================================
// Music: one entry per step, MIDI notes, 0 = rest (audio.js plays every step as a short note, the drums as hits)
// ============================================================
// ISLAND (AREA 1-2): a calypso in C, 16 steps a bar at 236 (a quarter = 118), so every step is a sixteenth. A bright
// triangle lead like a steel drum (long notes rolled as repeated sixteenths), a bass walking up and down the chords
// in the 3-3-2 calypso rhythm, a four-on-the-floor kick, snare on 2 and 4, the offbeat "iron" on the hat.
// A: C F G7 C | C F G7 C   B: Am F C G | Am Dm G7 C  (16 bars, 256 steps; loops into bar 1)
const ISL_CH = { C: [48, 52, 55, 57], F: [41, 45, 48, 50], G7: [43, 47, 50, 53], Cd: [48, 43, 40, 43], Am: [45, 48, 52, 55], Dm: [38, 41, 45, 48], G: [43, 47, 50, 47], Ce: [48, 43, 48, 47] };
const islandBass = [];
for (const c of ['C', 'F', 'G7', 'Cd', 'C', 'F', 'G7', 'Cd', 'Am', 'F', 'C', 'G', 'Am', 'Dm', 'G7', 'Ce']) {
  const [r, a, b, d] = ISL_CH[c];
  islandBass.push(r, 0, 0, r, 0, 0, a, 0, b, 0, 0, b, 0, 0, d, 0);
}
TRACKS.island = {
  bpm: 236, lead: 'triangle',
  bass: islandBass,
  mel: [
    76, 0, 0, 79, 0, 0, 84, 0, 84, 83, 81, 0, 79, 0, 76, 0,    77, 0, 0, 81, 0, 0, 84, 0, 86, 84, 81, 0, 77, 0, 81, 0,
    79, 0, 0, 83, 0, 0, 86, 0, 86, 83, 79, 0, 77, 0, 74, 0,    76, 76, 76, 76, 79, 0, 76, 0, 72, 0, 0, 0, 0, 0, 67, 71,
    72, 0, 76, 79, 0, 0, 81, 79, 0, 76, 0, 72, 0, 74, 76, 0,   77, 0, 81, 84, 0, 0, 86, 84, 0, 81, 0, 77, 0, 79, 81, 0,
    83, 0, 0, 83, 0, 0, 81, 0, 79, 0, 77, 0, 74, 0, 71, 0,     72, 72, 72, 72, 72, 72, 0, 0, 79, 0, 76, 0, 72, 0, 0, 0,
    81, 0, 0, 84, 0, 0, 88, 0, 88, 86, 84, 0, 81, 0, 0, 0,     77, 0, 0, 81, 0, 0, 84, 0, 84, 81, 0, 77, 0, 81, 0, 0,
    79, 0, 76, 0, 79, 0, 84, 0, 83, 0, 81, 0, 79, 0, 76, 0,    74, 0, 0, 79, 0, 0, 83, 0, 86, 86, 86, 86, 83, 0, 79, 0,
    84, 0, 0, 81, 0, 0, 76, 0, 81, 0, 79, 0, 81, 0, 84, 0,     86, 0, 0, 81, 0, 0, 77, 0, 81, 0, 79, 0, 77, 0, 74, 0,
    79, 0, 81, 0, 83, 0, 86, 0, 84, 83, 81, 79, 77, 76, 74, 71, 72, 0, 0, 76, 0, 0, 79, 0, 84, 0, 0, 0, 0, 0, 0, 0
  ],
  drums: { kick: 'x...x...x...x...', snare: '....x.......x..x', hat: '..x...x...x...xx' }
};
// LAVA RIVERS (AREA 3 and the crater, switched in by update()): the island tune turned to A minor, faster, with a
// heavier driving bass (root and octave in eighths) and the tresillo on the kick
const toMinor = { 67: 64, 69: 65, 71: 68, 72: 69, 74: 71, 76: 72, 77: 74, 79: 76, 81: 77, 83: 80, 84: 81, 86: 83, 88: 84 };
const LAV_CH = { C: 45, F: 38, G7: 40, Cd: 45, Am: 41, Dm: 38, G: 40, Ce: 40 };
const lavaBass = [];
for (const c of ['C', 'F', 'G7', 'Cd', 'C', 'F', 'G7', 'Cd', 'Am', 'F', 'C', 'G', 'Am', 'Dm', 'G7', 'Ce']) { const r = LAV_CH[c]; for (let i = 0; i < 4; i++) lavaBass.push(r, 0, r + 12, 0); }
TRACKS.islandlava = {
  bpm: 256, lead: 'triangle',
  bass: lavaBass,
  mel: TRACKS.island.mel.map(n => n ? toMinor[n] || n - 3 : 0),
  drums: { kick: 'x..x..x.x..x..x.', snare: '....x.......x.x.', hat: 'x.xxx.xxx.xxx.xx' }
};
// MEGA WHALE SHARK: a driving A minor (Am F G E | Am F G E | Dm Am Dm E | F G E E), eighth-note steps at 184, a
// pumping root-and-octave bass, a bouncy square lead; 16 bars (128 steps)
const bossBass = [];
for (const r of [45, 41, 43, 40, 45, 41, 43, 40, 38, 45, 38, 40, 41, 43, 40, 40]) for (let i = 0; i < 4; i++) bossBass.push(r, r + 12);
TRACKS.whaleboss = {
  bpm: 184,
  bass: bossBass,
  mel: [
    81, 0, 76, 81, 84, 0, 83, 81,   77, 0, 72, 77, 81, 0, 79, 77,   79, 0, 74, 79, 83, 0, 81, 79,   80, 0, 76, 80, 83, 0, 80, 76,
    81, 81, 0, 84, 0, 88, 86, 84,   81, 0, 77, 0, 72, 0, 77, 81,    83, 83, 0, 86, 0, 83, 79, 74,   80, 0, 83, 0, 88, 0, 0, 0,
    74, 0, 77, 81, 0, 77, 74, 0,    76, 0, 72, 69, 0, 72, 76, 0,    77, 0, 81, 86, 0, 81, 77, 0,    80, 0, 76, 71, 0, 76, 80, 83,
    84, 0, 81, 77, 84, 0, 81, 77,   86, 0, 83, 79, 86, 0, 83, 79,   88, 0, 80, 83, 88, 0, 80, 83,   88, 0, 86, 0, 83, 0, 80, 0
  ],
  drums: { kick: 'x...x..x', snare: '..x...x.', hat: 'xxxxxxxx' }
};

// ============================================================
// Mission-select card art (screen space, clipped by the caller: 112x96 with three cards, 180x96 with two). G.p may
// be null and LV another level: nothing here uses them or groundAt. A golden morning over Shark Bay: the volcano
// smoking beyond the bay, the turquoise lagoon, a palm leaning in, the hero on the black sand shooting at a big
// robot shark that circles as a fin, warns (a red ring and !), leaps high with its jaws open and splashes back in.
// The still scenery is painted once per card size into offscreen layers; animated with G.t only.
// ============================================================
function painter(g) {
  const P = {
    R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); },
    RO(x, y, w, h, c) { P.R(x - 1, y - 1, w + 2, h + 2, OUT); P.R(x, y, w, h, c); },
    disc(x, y, r, c, ry = r) { for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)))); P.R(x - hw, y + dy, hw * 2 + 1, 1, c); } },
    poly(pts, c) { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.fill(); }
  };
  return P;
}
const cardCache = {};
function cardLayer(name, w, h, paint) {
  const key = name + w + 'x' + h;
  let c = cardCache[key];
  if (!c) {
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    paint(painter(g), g, w, h);
    cardCache[key] = c;
  }
  return c;
}
const HORIZON = 54;
const shoreY = px => 79 + Math.round(Math.sin(px * 0.07) * 1.2 + Math.sin(px * 0.023 + 2) * 1.5);
const volX = w => Math.round(w * 0.68);
// layer 1: sky with the sun's glow, far islets, the volcano (lit flank, shadow flank, gullies, green jungle slopes,
// a glowing rim), the deep bay and the turquoise lagoon with its reef line
function cardBack(P, g, w, h) {
  const sky = g.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#3a86dc'); sky.addColorStop(0.55, '#9ad6f2'); sky.addColorStop(0.85, '#ffe8c0'); sky.addColorStop(1, '#ffd8a0');
  g.fillStyle = sky; g.fillRect(0, 0, w, HORIZON);
  const sx = Math.round(w * 0.14), sy = 14;
  g.globalAlpha = 0.14; P.disc(sx, sy, 17, '#fff6c8'); g.globalAlpha = 0.25; P.disc(sx, sy, 11, '#fff6c8'); g.globalAlpha = 1;
  P.disc(sx, sy, 6, '#ffe58a'); P.disc(sx - 1, sy - 1, 4, '#fffbe6');
  // far islets on the horizon
  P.disc(Math.round(w * 0.08), HORIZON, 12, '#8a9ab8', 3); P.disc(Math.round(w * 0.3), HORIZON, 6, '#98a8c4', 2);
  const vx = volX(w), top = 19;
  // the volcano: lit left flank, cool shadow on the right, a notched rim
  P.poly([[vx - 58, HORIZON + 1], [vx - 8, top], [vx - 3, top + 2], [vx + 2, top + 1], [vx + 8, top], [vx + 60, HORIZON + 1]], '#9a90b0');
  P.poly([[vx + 2, top + 1], [vx + 8, top], [vx + 60, HORIZON + 1], [vx + 10, HORIZON + 1]], '#7a7098');
  P.poly([[vx - 58, HORIZON + 1], [vx - 8, top], [vx - 6, top + 4], [vx - 40, HORIZON + 1]], '#b0a4bc');
  for (let i = 0; i < 6; i++) { const gx = vx - 6 + i * 3; P.poly([[gx, top + 3], [gx - 24 + i * 9, HORIZON - 10], [gx - 22 + i * 9, HORIZON - 10], [gx + 1, top + 3]], i < 3 ? '#a294b4' : '#6c6290'); }
  // a lava trickle down the shadow side
  for (let i = 0; i < 12; i++) P.R(vx + 3 + Math.round(i * 1.6 + Math.sin(i) * 1), top + 3 + i * 2, 1, 2, i % 3 ? '#ff7a2a' : '#ffc040');
  // green jungle slopes with bumpy tree crowns
  P.poly([[vx - 58, HORIZON + 1], [vx - 36, HORIZON - 9], [vx - 12, HORIZON - 7], [vx + 18, HORIZON - 10], [vx + 60, HORIZON + 1]], '#4f8f5a');
  for (let i = 0; i < 16; i++) { const bx = vx - 52 + i * 7, by = HORIZON - 3 - Math.round(Math.sin(i * 0.6) * 2 + 3 * Math.sin(Math.min(1, Math.max(0, i / 15)) * Math.PI)); P.disc(bx, by, 4, i % 2 ? '#4f8f5a' : '#5ea468', 3); P.R(bx - 2, by - 3, 3, 1, '#7cc07a'); }
  P.R(vx - 7, top - 1, 15, 2, '#ff9a40'); P.R(vx - 4, top - 2, 8, 1, '#ffd890');
  // the bay: deep blue to the reef, then the turquoise lagoon
  P.R(0, HORIZON, w, h - HORIZON, '#2a8ccc'); P.R(0, HORIZON, w, 1, '#d8f2fa'); P.R(0, HORIZON + 2, w, 1, '#58aedc');
  for (let i = 0; i < 14; i++) P.R(Math.floor(hsh(i + 40) * w), HORIZON + 3 + Math.floor(hsh(i + 70) * 5), 2 + (i % 3), 1, '#5cb8e4');
  P.R(0, HORIZON + 9, w, h - HORIZON - 9, '#3ec6cc'); P.R(0, HORIZON + 9, w, 1, '#e8fffa'); P.R(0, HORIZON + 10, w, 1, '#8ae4e4');
  for (let i = 0; i < 18; i++) P.R(Math.floor(hsh(i + 3) * w), HORIZON + 12 + Math.floor(hsh(i + 9) * 12), 3 + (i % 3), 1, i % 2 ? '#6ad8dc' : '#2eaebc');
}
// layer 2: the black-sand beach in front (foam line, wet sand, pebbles, a shell) and a dark lava rock at the right
function cardShore(P, g, w, h) {
  for (let px = 0; px < w; px += 2) {
    const sy = shoreY(px);
    P.R(px, sy - 2, 2, 2, 'rgba(255,255,255,0.35)');
    P.R(px, sy, 2, h - sy, '#423c4a'); P.R(px, sy, 2, 1, '#ffffff'); P.R(px, sy + 1, 2, 2, '#2a2632'); P.R(px, sy + 3, 2, 1, '#5a5464');
    for (let k = 0; k < 3; k++) if (hsh(px * 0.7 + k * 13) > 0.7) P.R(px + (k & 1), sy + 5 + k * 4, 1, 1, k ? '#6e6878' : '#8a8494');
  }
  const rx = w - 16, ry = shoreY(rx) + 1;
  P.poly([[rx - 13, ry + 2], [rx - 9, ry - 8], [rx, ry - 11], [rx + 10, ry - 7], [rx + 14, ry + 2]], OUT);
  P.poly([[rx - 12, ry + 1], [rx - 8, ry - 7], [rx, ry - 10], [rx + 9, ry - 6], [rx + 13, ry + 1]], '#4a4652');
  P.poly([[rx - 7, ry - 7], [rx, ry - 9], [rx + 6, ry - 6], [rx, ry - 6]], '#6e6878');
  P.R(rx - 4, ry - 1, 3, 1, '#2e2a34'); P.R(rx + 4, ry - 3, 2, 1, '#2e2a34');
  const shx = Math.round(w * 0.5), shy = shoreY(shx) + 8;
  P.R(shx, shy, 3, 2, '#f4c8b0'); P.R(shx, shy, 3, 1, '#ffe8d8');
}
// a big cartoon robot shark (facing right): steel back with rivets, a white belly, gill slits, the dorsal beacon, a
// glowing red eye, jaws wide open on a glowing throat; painted at five angles (rotating the shapes, not the bitmap,
// keeps the pixels crisp)
const CARD_SHARK = [-0.55, -0.28, 0, 0.28, 0.55].map(a => {
  const g = grid(56, 40), ca = Math.cos(a), sa = Math.sin(a);
  const q = ([x, y]) => [28 + (x - 23) * ca - (y - 9) * sa, 20 + (x - 23) * sa + (y - 9) * ca];
  const T = (pts, c) => g.t(pts.map(q), c), P = (x, y, c) => { const [px, py] = q([x + 0.5, y + 0.5]); g.p(px, py, c); };
  T([[0, 0], [8, 8], [1, 17], [5, 8]], 'm');                                                      // tail
  T([[4, 8], [11, 4], [22, 2.5], [33, 4], [41, 7], [46, 9.5], [41, 12], [31, 15], [17, 16], [9, 14]], 'm');
  T([[18, 3.5], [22, -4], [25, -4.5], [27, 3.5]], 'm');                                            // dorsal fin
  T([[20, 14], [27, 15], [19, 21]], 'm');                                                         // pectoral fin
  g.shade('m', 'M', 'd');
  T([[12, 12.5], [39, 11.5], [34, 15], [17, 16]], 'w');                                            // white belly
  T([[34, 8.6], [47, 6.5], [47, 9], [44, 14.5], [35, 12.4]], 'n');                                 // open jaws
  T([[35, 9.6], [39, 9.4], [39, 11.6], [35, 11.6]], 'g');                                         // glowing throat
  for (const x of [39, 41, 43, 45]) { P(x, 7.6 - (x - 39) * 0.2, 'w'); P(x - 1, 12.6 + (x - 39) * 0.3, 'w'); }   // teeth
  P(36, 5, 'r'); P(37, 5, 'r'); P(36, 6, 'r'); P(37, 6, 'R'); P(35, 4, 'd'); P(36, 4, 'd'); P(37, 4, 'd');   // eye + brow
  for (const x of [28, 30, 32]) for (let y = 7; y < 11; y++) P(x, y, 'd');                         // gill slits
  for (const [x, y] of [[12, 7], [16, 6], [20, 7], [24, 6], [8, 9]]) P(x, y, 'M');                  // rivets
  P(23, -5, 'r'); P(24, -5, 'r'); P(23, -6, 'R');                                                  // dorsal beacon
  g.outline();
  return g.sprite({ k: OUT, m: '#8a96a6', M: '#c0cad6', d: '#58626e', w: '#f2f6f9', n: '#5a1414', g: '#ffb040', r: EVIL, R: '#ffd0cc' });
});
const CARD_FIN = (() => {
  const g = grid(12, 10);
  g.t([[1, 9], [6, 1], [8, 1], [11, 9]], 'm'); g.shade('m', 'M', null); g.p(6, 1, 'r').p(7, 1, 'r');
  g.outline();
  return g.sprite({ k: OUT, m: '#8a96a6', M: '#c0cad6', r: EVIL });
})();
// a palm leaning in from the left edge (fronds sway with G.t)
function cardPalm(x, gy) {
  const hgt = 70, lean = 16, sway = Math.sin(G.t * 0.03) * 1.5;
  const pt = u => [x + lean * u * u + sway * u * u * u, gy - hgt * u];
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i <= 16; i++) {
    const [tx, ty] = pt(i / 16), wd = Math.max(2, Math.round(4 - i / 16 * 1.5));
    if (pass === 0) R(Math.round(tx - wd / 2) - 1, Math.round(ty) - 1, wd + 2, 6, OUT);
    else { R(Math.round(tx - wd / 2), Math.round(ty), wd, 4, i % 2 ? '#8a6a44' : '#a8845a'); R(Math.round(tx - wd / 2), Math.round(ty), 1, 4, '#c8a272'); }
  }
  const [hx, hy] = pt(1);
  const fronds = [[-2.8, 22], [-2.2, 26], [-1.4, 22], [-0.7, 26], [-0.1, 30], [0.5, 24], [3.6, 18]];
  for (let pass = 0; pass < 2; pass++) for (let f = 0; f < fronds.length; f++) {
    const [a0, len] = fronds[f], a = a0 + Math.sin(G.t * 0.03 + f) * 0.05;
    for (let s = 0; s <= len; s += 2) {
      const px = hx + Math.cos(a) * s * (1 - s / len * 0.15), py = hy + Math.sin(a) * s * 0.5 + s * s * 0.028, lw = s < len * 0.6 ? 3 : 2;
      if (pass === 0) R(Math.round(px) - 1, Math.round(py) - 1, lw + 2, 4, OUT);
      else { R(Math.round(px), Math.round(py), lw, 2, f % 2 ? '#3f9a3a' : '#4cae46'); R(Math.round(px), Math.round(py), lw, 1, '#86d65a'); if (s % 4 === 2) R(Math.round(px), Math.round(py) + 2, 1, 2, '#2f7a34'); }
    }
  }
  for (const [dx, dy] of [[-2, 3], [2, 4], [0, 6]]) { pdisc(Math.round(hx + dx), Math.round(hy + dy), 2, OUT); pdisc(Math.round(hx + dx), Math.round(hy + dy), 1, '#6a4422'); }
}
function drawPreview(x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const T = G.t, vx = volX(w);
  ctx.drawImage(cardLayer('back', w, h, cardBack), 0, 0);
  // clouds drifting, the volcano's plume, gulls, sea sparkles
  for (let i = 0; i < 2; i++) {
    const span = w + 60, cx2 = Math.round(((i * 97 + T * 0.05) % span) - 30), cy2 = 9 + i * 13;
    pdisc(cx2, cy2, 8, '#f3e2d8', 3); pdisc(cx2 + 7, cy2 - 3, 6, '#f3e2d8', 4); pdisc(cx2, cy2 - 1, 7, '#ffffff', 2); pdisc(cx2 + 7, cy2 - 4, 5, '#ffffff', 3);
  }
  for (let i = 0; i < 8; i++) {
    const k = ((T * 0.15 + i * 20) % 160) / 160, r = Math.round(3 + k * 9);
    ctx.globalAlpha = (1 - k) * 0.85;
    pdisc(Math.round(vx + 2 + k * 38 + Math.sin(k * 5 + i) * 2), Math.round(17 - k * 30), r, k < 0.15 ? '#8a7a80' : '#ece8f0', Math.round(r * 0.8));
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 2; i++) { const gx = Math.round((T * 0.3 + i * 40) % (w + 20)) - 10, gy = 26 + i * 6 + Math.round(Math.sin(T * 0.05 + i) * 2); R(gx - 2, gy, 2, 1, '#ffffff'); R(gx + 1, gy, 2, 1, '#ffffff'); R(gx, gy + 1, 1, 1, '#ffffff'); }
  for (let i = 0; i < 12; i++) {
    const sx2 = Math.round((i * 41 + T * (0.1 + (i % 3) * 0.04)) % (w + 10)) - 5, sy2 = HORIZON + 11 + (i * 5) % 13;
    if ((T + i * 13) % 50 < 36) R(sx2, sy2, 2 + (i % 2), 1, i % 4 ? '#bff2fa' : '#ffffff');
  }
  // the robot shark: a fin coming in, the warning, a high leap toward the hero, the splash
  const s = T % 220, fy = HORIZON + 17, fx0 = w + 8, fx1 = Math.round(w * 0.78), lx1 = Math.round(w * 0.46);
  if (s < 90) {
    const fx = s < 60 ? Math.round(fx0 - (fx0 - fx1) * s / 60) : fx1;
    if (s >= 60) { if ((s >> 2) % 2) { ctx.strokeStyle = (s >> 3) % 2 ? '#ff3a2a' : '#ffd23f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(fx + 0.5, fy + 0.5, 10, 2.5, 0, 0, Math.PI * 2); ctx.stroke(); } text('!', fx + 1, fy - 22 - (s < 66 ? 66 - s : 0), '#ff3a2a', 1, 'center'); }
    ctx.globalAlpha = 0.35; pdisc(fx - 3, fy + 3, 9, '#1a5a7a', 2); ctx.globalAlpha = 1;
    spr(CARD_FIN, fx - 6, fy - 9);
    R(fx - 7, fy, 15, 1, '#e8fbff'); if (s < 60) for (let i = 1; i < 4; i++) R(fx + 4 + i * 4, fy - (i % 2), 3, 1, '#d8f6fa');
  } else if (s < 165) {
    const u = (s - 90) / 75, lx = fx1 + (lx1 - fx1) * u, ly = fy - 8 - Math.sin(u * Math.PI) * 44;
    // the water trail off its tail and the splash where it left
    if (u < 0.45) for (let i = 0; i < 7; i++) { const k2 = i / 7; R(Math.round(fx1 + (lx - fx1) * k2 * 0.6) + 4, Math.round(fy - 2 - (fy - ly) * k2 * 0.5), 1, 2, '#e8fbff'); }
    if (u < 0.3) { const k3 = u / 0.3; for (let i = 0; i < 7; i++) R(fx1 - 6 + i * 2, fy - 1 - Math.round(Math.sin((i + 1) / 8 * Math.PI) * 9 * (1 - k3)), 1, 2, '#ffffff'); ctx.globalAlpha = 1 - k3; pdisc(fx1, fy, Math.round(5 + k3 * 8), '#e8fbff', 1); ctx.globalAlpha = 1; }
    ctx.globalAlpha = 0.3; pdisc(Math.round(lx), fy + 2, 10, '#1a5a7a', 1); ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(Math.round(lx), Math.round(ly)); ctx.scale(-1, 1);
    spr(CARD_SHARK[clamp(Math.round(u * 4), 0, 4)], -28, -20); ctx.restore();
  } else if (s < 195) {
    const k = (s - 165) / 30;
    ctx.globalAlpha = 1 - k; pdisc(lx1, fy, Math.round(5 + k * 11), '#e8fbff', 1); ctx.globalAlpha = 1;
    for (let i = 0; i < 9; i++) R(lx1 - 8 + i * 2, fy - Math.round(Math.sin((i + 1) / 10 * Math.PI) * 12 * (1 - k)), 1, 2, '#ffffff');
  }
  ctx.drawImage(cardLayer('shore', w, h, cardShore), 0, 0);
  cardPalm(4, shoreY(4) + 3);
  // the hero on the beach, shooting at the shark
  const hx = Math.round(w * 0.24), hy = shoreY(hx) + 10, fire = s >= 60 && s < 160;
  drawHero(HEROES[G.hero], hx, hy, 1, { pose: 'idle', t: T, aim: 'fwd', muzzle: fire && T % 6 < 3 ? 3 : 0 });
  if (fire) for (let i = 0; i < 3; i++) { const bx = hx + 22 + ((T * 4 + i * 16) % 48); R(bx - 2, hy - 19, 5, 2, '#ffe066'); R(bx - 1, hy - 19, 3, 1, '#ffffff'); }
  ctx.restore();
}

}
