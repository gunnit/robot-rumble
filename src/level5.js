'use strict';
var L5 = L5 || {};
var L5ART = L5ART || {};
// =====================================================================================================================
// Mission 5: ALIEN MOTHERSHIP (LEVELS[4]). Owner: coordinator. docs/level5-spec.md section 2.
// Ines or Mathias are beamed up with the cows of Vigo Hills: through THE HANGAR, the STAR GARDEN under its glass dome
// (a glowing nectar pond, mushroom caps, the cows' paddock), out over the hull on the SPACE WALK (low gravity, the
// MINI UFO, meteors, the BIG SAUCER) and onto THE BRIDGE to the MEGA OGGLE.
// This file: the level data and the hook wiring (the picture is level5_scenery.js's: L5.drawBG ...), the level rules
//   - nectar: L5.nectarAt(x); the hero wades at 60 % speed with pink splashes; items float on it
//   - low gravity: L5.lowG(x); on foot over the hull (x 3300-4990) gravity is halved; the hero wears a glass bubble
//     (L5ART.helmet from level5_space.js, else a stand-in), drawn right after the world objects
//   - bouncy caps: landing on a platform with t 'm2' bounces the hero up (vy -7.2, kept at full height)
//   - hearts: the first robot beaten in an area while the hero is on the last heart leaves one; the BIG SAUCER always
//   - hazards: L5.craneCrate(tx) in AREA 1 and L5.meteor(tx) in AREA 3 (level5_saucers.js), scheduled here
//   - the paddock: PROP_TYPES.paddock (the control box at 2589) and the stampede; L5.paddock = { on, t } for the art
//   - the BIG SAUCER's lock: GO > and the area's tune again when it is beaten (a boss lock shows neither by itself)
//   - cargo crates: PROP_TYPES.cargo (the ship's own steel crate; same rules as the engine's wooden one), L5.drawCargo
// and the music (TRACKS.mothership, .spacewalk, .oggleboss). The opening scene is level5_intro.js's (it sets
// L5.level.intro), the mission card level5_hangar.js's (L5ART.card).
// Everything in the block is private except what hangs on L5 (level, nectarAt, lowG, paddock, drawCargo).
// =====================================================================================================================
{
const Math = globalThis.Math;
const SECTIONS = [
  { x: 0, name: 'AREA 1: THE HANGAR' },
  { x: 1600, name: 'AREA 2: STAR GARDEN' },
  { x: 3300, name: 'AREA 3: SPACE WALK' },
  { x: 5000, name: 'FINAL AREA: THE BRIDGE' }
];
const LOWG = [3300, 4990];
const dr = (x, y, more) => Object.assign({ t: 'eyedrone', x, y }, more);   // an eye saucer at height y
const MOTHERSHIP = {
  mission: 'MISSION 5', title: 'ALIEN MOTHERSHIP', end: 6400, heroStart: 120, freedLabel: 'COWS RESCUED',
  music: 'mothership', bossMusic: 'oggleboss', startText: 'MISSION 5 START!', startSay: 'Mission five, start!',
  sections: SECTIONS,
  // the deck: flat 232 in the hangar and the garden (three dips: the nectar gaps), 212 on the hull, 218 on the bridge
  terrain: [
    [0, 232], [1952, 232], [1960, 250], [2052, 250], [2060, 232], [2752, 232], [2760, 250], [2892, 250], [2900, 232],
    [3052, 232], [3060, 250], [3132, 250], [3140, 232], [3240, 232], [3300, 212], [4980, 212], [5010, 218], [6400, 218]
  ],
  // the glowing pond showing in three gaps of the garden catwalk (the garden draws it; the rule is below)
  nectar: [{ x0: 1956, x1: 2056, y: 240 }, { x0: 2756, x1: 2896, y: 240 }, { x0: 3056, x1: 3136, y: 240 }],
  // one-way platforms { x (left), y (top), w, t }
  plats: [
    // AREA 1: cargo crate steps and catwalks
    { x: 340, y: 206, w: 28, t: 'crate' }, { x: 733, y: 206, w: 28, t: 'crate' }, { x: 1044, y: 206, w: 28, t: 'crate' },
    { x: 380, y: 156, w: 216, t: 'cat' }, { x: 1040, y: 160, w: 180, t: 'cat' },
    // AREA 2: mushroom caps, m1 orange, m2 pink (bouncy)
    { x: 1980, y: 196, w: 56, t: 'm1' }, { x: 2290, y: 192, w: 56, t: 'm1' }, { x: 2772, y: 196, w: 50, t: 'm1' }, { x: 3070, y: 194, w: 56, t: 'm1' },
    { x: 2415, y: 186, w: 62, t: 'm2' }, { x: 2838, y: 188, w: 56, t: 'm2' },
    // AREA 3: solar panels and an antenna tower on the hull
    { x: 3620, y: 176, w: 60, t: 'solar' }, { x: 4160, y: 170, w: 70, t: 'solar' }, { x: 4700, y: 168, w: 44, t: 'tower' },
    // FINAL AREA: consoles (5970 and 6090 stand in the boss arena)
    { x: 5300, y: 190, w: 50, t: 'console' }, { x: 5970, y: 192, w: 44, t: 'console' }, { x: 6090, y: 192, w: 44, t: 'console' }
  ],
  // robots placed at load (y defaults to the deck; extra fields reach make(e, spec))
  spawns: [
    // AREA 1
    { t: 'oggle', x: 520 }, { t: 'oggle', x: 560, y: 156, sniper: true }, dr(760, 90),
    { t: 'eyedrone', x: 960, asleep: true }, { t: 'eyedrone', x: 1012, asleep: true },
    { t: 'roller', x: 1280 }, { t: 'oggle', x: 1340 },
    dr(1500, 84, { carry: true }),      // crosses the 1120 lock's screen with a cow in its beam
    // AREA 2
    { t: 'roller', x: 1760 }, { t: 'eyeflower', x: 1880 }, { t: 'oggle', x: 2110 }, { t: 'roller', x: 2190 },
    { t: 'eyeflower', x: 2258 }, { t: 'roller', x: 2375 }, { t: 'roller', x: 2485 }, { t: 'oggle', x: 2520 },
    dr(2591, 100, { carry: true }), dr(2920, 95), { t: 'roller', x: 2960 }, { t: 'oggle', x: 3010 },
    { t: 'eyeflower', x: 3218 },
    // AREA 3 (the oggles wear a glass bubble out here); the last two wake only after the BIG SAUCER's lock (its screen
    // ends at 4880)
    { t: 'oggle', x: 3640, helmet: true }, { t: 'roller', x: 3720 }, dr(3850, 90), dr(3900, 112), dr(3950, 80),
    { t: 'roller', x: 3984 }, { t: 'roller', x: 4090 }, dr(4200, 103), dr(4274, 88),
    { t: 'oggle', x: 4216, helmet: true },
    { t: 'oggle', x: 4920, helmet: true }, dr(4940, 95),
    // FINAL AREA
    { t: 'oggle', x: 5150 }, { t: 'roller', x: 5230 }, { t: 'oggle', x: 5325, y: 190, sniper: true }, dr(5400, 100),
    { t: 'roller', x: 5520 }, { t: 'oggle', x: 5600 }
  ],
  // camera locks (at = camera x)
  locks: [
    { at: 1120, waves: [   // the hangar's far end
      { t: 'oggle', side: 1, d: 20 }, { t: 'oggle', side: -1, d: 90 }, { t: 'eyedrone', side: 1, d: 160, y: 90 },
      { t: 'roller', side: 1, d: 260 }
    ] },
    { at: 2200, waves: [   // the garden screen of the proposal (the paddock is on it)
      { t: 'roller', side: 1, d: 20 }, { t: 'roller', side: -1, d: 100 }, { t: 'eyedrone', side: 1, d: 160, y: 95 },
      { t: 'oggle', side: 1, d: 240 }, { t: 'roller', side: 1, d: 330 }, { t: 'eyedrone', side: -1, d: 400, y: 100, mode: 'beam' }
    ] },
    { at: 4400, boss: true, waves: [{ t: 'bigsaucer', side: 1, d: 60 }] },      // mini-boss: the BIG SAUCER
    { at: 5920, boss: true, waves: [{ t: 'megaoggle', side: 1, d: 60 }] }       // the MEGA OGGLE (it places itself at 6282, 211)
  ],
  // the rescues: cows in glass pods, kind 'podcow' ('cow' is Mission 2's caged cow). v: 0 blond, 1 black-and-white,
  // 2 a blond calf (load() copies v onto G.pows: the engine does not)
  pows: [
    { x: 844, item: 'H', kind: 'podcow', v: 0 }, { x: 1460, item: 'B', kind: 'podcow', v: 1 }, { x: 2655, item: 'S', kind: 'podcow', v: 2 },
    { x: 3180, item: 'Z', kind: 'podcow', v: 0 }, { x: 3760, item: 'heart', kind: 'podcow', v: 1 }, { x: 4350, item: 'R', kind: 'podcow', v: 2 },
    { x: 5560, item: 'H', kind: 'podcow', v: 0 }
  ],
  props: [
    { k: 'cargo', x: 250, item: 'coin' }, { k: 'cargo', x: 900, item: 'heart' }, { k: 'cargo', x: 1380, item: 'coin' },
    { k: 'cargo', x: 2100, item: 'heart' }, { k: 'paddock', x: 2589 }, { k: 'cargo', x: 3700, item: 'coin' },
    { k: 'cargo', x: 4700, item: 'heart' }, { k: 'cargo', x: 5380, item: 'heart' },
    { k: 'miniufo', x: 3520 }, { k: 'miniufo', x: 4520 }
  ],
  // the picture is the joiner's (level5_scenery.js); the herd and the hero's bubble are drawn with the front layer
  drawBG: cx => L5.drawBG(cx),
  drawBehind: cx => L5.drawBehind(cx),
  drawGround: cx => L5.drawGround(cx),
  drawPlat: pl => L5.drawPlat(pl),
  drawFront(cx) { drawExtras(cx); L5.drawFront(cx); },
  drawOverlay: cx => L5.drawOverlay(cx),
  menuBG: () => L5.menuBG(),
  preview(x, y, w, h) { if (L5ART.card) L5ART.card(x, y, w, h); },
  // once per play frame, after all objects (also during the intro)
  update() {
    heroRules();
    floatItems();
    herdUpdate();
    hazards();
    bigSaucerLock();
    musicByArea();
  },
  // after the level is (re)built for camera x cp (start 0, a checkpoint, or a devStart x), before intro.start()
  load(cp) {
    if (L5ART.bakeAll) L5ART.bakeAll();
    S.bvy = 0; S.boing = null; S.wet = false; S.crateT = 240; S.meteorT = 200; S.heartSec = -1; S.herd = null; S.lowSaid = false;
    const lk = G.locks.find(l => l.at === 4400);
    S.saucerDone = !lk || lk.done;
    L5.paddock.on = true; L5.paddock.t = 0;
    for (const o of G.pows) o.v = MOTHERSHIP.pows[o.id].v;
    if (G.p) G.p.hidden = false;
  },
  intro: null   // set by level5_intro.js (L5.level.intro)
};
LEVELS.push(MOTHERSHIP);
L5.level = MOTHERSHIP;

// Mission 5 state (all of it reset by load)
const S = { bvy: 0, boing: null, wet: false, crateT: 240, meteorT: 200, heartSec: -1, herd: null, lowSaid: false, saucerDone: false };
// the cows' force field: on until the control box is broken; t = frames since then (one object for the whole game:
// load() resets its fields)
L5.paddock = { on: true, t: 0 };

// =====================================================================================================================
// Lookups for the other Mission 5 files (null / false in any other level, e.g. the sandbox)
// =====================================================================================================================
// the nectar range { x0, x1, y } that holds world x, or null. Ground robots treat it as a wall.
L5.nectarAt = function (x) {
  if (LV !== MOTHERSHIP) return null;
  for (const n of MOTHERSHIP.nectar) if (x >= n.x0 && x <= n.x1) return n;
  return null;
};
// low gravity at world x (out on the hull)
L5.lowG = x => LV === MOTHERSHIP && x >= LOWG[0] && x <= LOWG[1];

// =====================================================================================================================
// The hero's rules. The engine is not edited: it has already moved the hero this frame (updatePlayer: vy += 0.26,
// y += vy, landing), so what differs here is put right afterwards.
// =====================================================================================================================
function pinkSplash(x, y, n) {
  for (let i = 0; i < n; i++) G.parts.push({ type: 'spark', x: x + rand(-4, 4), y: y - 1, vx: rand(-1.3, 1.3), vy: rand(-2.6, -0.8), g: 0.16, life: rand(10, 18), max: 18, size: i % 3 ? 1 : 2, c: i % 2 ? '#ffe3f3' : '#ff7ab8' });
  if (n > 4) Snd.noise(0.14, 0.05, 1600);
}
function heroRules() {
  const p = G.p;
  if (!p || p.dead || p.ride) { S.bvy = 0; S.wet = false; return; }
  // bouncy caps: the pink mushrooms throw the hero up as soon as he lands on one
  if (p.onGround && p.onPlat && p.onPlat.t === 'm2') {
    const pl = p.onPlat;
    p.vy = -7.2; p.onGround = false; p.onPlat = null; S.bvy = -7.2;
    for (let i = 0; i < 9; i++) G.parts.push({ type: 'spark', x: p.x + rand(-12, 12), y: pl.y - 1, vx: rand(-1.2, 1.2), vy: rand(-2.2, -0.6), g: 0.05, life: rand(18, 32), max: 32, size: i % 3 ? 1 : 2, c: i % 2 ? '#ffb3d9' : '#ffffff' });
    Snd.tone('sine', 180, 620, 0.2, 0.14); Snd.tone('triangle', 360, 900, 0.14, 0.06, 0.03);
    if (pl !== S.boing) G.texts.push({ x: p.x, y: pl.y - 30, s: 'BOING!', t: 40, c: '#ffb3d9' });
    S.boing = pl;
  } else if (S.bvy < 0) {
    // keep the bounce at full height: the engine cuts a rising hero to vy -2.6 when jump isn't held
    if (p.onGround) S.bvy = 0;
    else {
      const want = S.bvy + 0.26;
      if (p.vy > want + 0.01 && want < -2.34) { p.y += want - p.vy; p.vy = want; }
      S.bvy = want < -2.34 ? want : 0;
    }
  }
  if (p.onGround) S.boing = null;
  // low gravity on the hull: half of the engine's 0.26 is taken back while the hero is in the air (the engine's
  // short-hop cut to vy -2.6 still works: a tap is a small hop, a held jump goes about twice as high as indoors)
  if (!p.onGround && L5.lowG(p.x)) { p.vy -= 0.13; p.y -= 0.13; }
  if (!S.lowSaid && L5.lowG(p.x) && !G.intro) { S.lowSaid = true; G.texts.push({ x: p.x + 30, y: p.y - 50, s: 'LOW GRAVITY!', t: 100, c: '#c8f7ff' }); }
  // nectar: wading at 60 % of the walking speed (40 % of this frame's step is taken back), pink splashes
  const n = L5.nectarAt(p.x), wet = !!n && p.y > n.y + 1;
  if (wet) {
    if (p.vx) {
      p.x -= p.vx * 0.4;
      if (p.onGround && !p.onPlat) p.y = groundAt(p.x);
    }
    if (!S.wet) pinkSplash(p.x, n.y, Math.min(12, 3 + Math.max(0, p.vy) * 2));
    else if (p.onGround && p.vx && p.t % 8 === 0) pinkSplash(p.x - p.facing * 3, n.y, 2);
  }
  S.wet = wet;
}
// a pick-up that comes down in the nectar floats on it, bobbing (on the pond bed it would be half hidden)
function floatItems() {
  for (const it of G.items) {
    const n = L5.nectarAt(it.x);
    if (!n || it.y < n.y - 2 || (it.vy < 0 && !it.onGround)) continue;
    if (!it.l5float) { it.l5float = true; pinkSplash(it.x, n.y, 5); }
    it.y = n.y - 1 + ((G.t + Math.round(it.x)) >> 4 & 1); it.vy = 0; it.vx = 0; it.onGround = true;
  }
}
// The hero's glass bubble out on the hull (world space): level5_space.js's L5ART.helmet(x, y, facing), where (x, y) is
// the hero's feet, y lowered by 8 while he crouches (his head is 8 lower then); else a simple stand-in. Not drawn while
// he is dead, hidden, in a ride, or on the off frames of his invulnerable blinking.
function drawBubble() {
  const p = G.p;
  if (!p || p.dead || p.ride || p.hidden || !L5.lowG(p.x)) return;
  if (p.inv > 0 && Math.floor(p.inv / 3) % 2) return;            // the hero blinks while invulnerable: so does the bubble
  const y = p.y + (p.crouch ? 8 : 0);
  if (typeof L5ART.helmet === 'function') { L5ART.helmet(p.x, y, p.facing); return; }
  const x = Math.round(p.x) + p.facing, cy = Math.round(y) - 28;
  const rows = [5, 7, 9, 10, 10, 11, 11, 11, 11, 11, 11, 10, 10, 9, 7, 5];
  ctx.fillStyle = 'rgba(200,247,255,0.16)';
  rows.forEach((hw, i) => ctx.fillRect(x - hw, cy - 8 + i, hw * 2, 1));
  ctx.fillStyle = 'rgba(200,247,255,0.85)';
  rows.forEach((hw, i) => {
    const y1 = cy - 8 + i, prev = rows[i - 1] ?? 0, next = rows[i + 1] ?? 0, t = Math.max(1, hw - Math.min(prev, next));
    if (i === 0 || i === rows.length - 1) ctx.fillRect(x - hw, y1, hw * 2, 1);
    else { ctx.fillRect(x - hw, y1, t, 1); ctx.fillRect(x + hw - t, y1, t, 1); }
  });
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 7, cy - 5, 2, 1); ctx.fillRect(x - 8, cy - 4, 1, 3);
  R(x - 6, cy + 8, 12, 2, '#c3d0ee'); R(x - 6, cy + 9, 12, 1, '#6272ab');
}

// =====================================================================================================================
// The paddock: a hazard-striped control box in front of the cows' force-field fence (the fence and the grazing cows
// are the garden's scenery: they read L5.paddock.on). Breaking the box drops the field: STAMPEDE! Three cows hop down
// from the planter and run along the deck at 3 px a frame: first left to the screen's edge, then back right and away
// (about 6 s in all), hopping the nectar gaps; every robot they touch takes 6, once.
// =====================================================================================================================
const HERD_X = [2562, 2595, 2620], HERD_T = 360, PLANTER_Y = 205;   // where the garden's cows stand
function moo(d = 0) { Snd.tone('sawtooth', 185, 139, 0.5, 0.1, d); Snd.tone('sawtooth', 139, 110, 0.35, 0.08, d + 0.3); }
PROP_TYPES.paddock = {
  make(o) { o.hp = 6; },
  box: o => ({ x: o.x - 9, y: o.y - 26, w: 18, h: 26 }),
  hit(o, d) {
    if (!propHurt(o, d)) return;
    o.dead = true;
    L5.paddock.on = false; L5.paddock.t = 0;
    S.herd = { t: 0, hit: new Set(), cows: HERD_X.map((x, i) => ({ x, y: PLANTER_Y, dir: -1, wait: i * 9, v: [2, 1, 0][i], hop: { x0: x, x1: x - 34, y0: PLANTER_Y, y1: groundAt(x - 34), h: 12 } })) };
    boom(o.x, o.y - 14, 0.7); debris(o.x, o.y - 12, 8, '#ffcf3a'); debris(o.x, o.y - 12, 5, MET);
    addScore(1000, o.x, o.y - 34);
    G.texts.push({ x: o.x, y: o.y - 58, s: 'STAMPEDE!', t: 110, c: '#ffe066' });
    G.shake = Math.max(G.shake, 4);
    moo(0); moo(0.25); moo(0.5);
    say('Stampede!');
  },
  draw(o) {
    const x = Math.round(o.x), y = Math.round(o.y), on = Math.floor(G.t / 16) % 2;
    RO(x - 3, y - 10, 6, 10, METD); R(x - 3, y - 10, 2, 10, MET);                       // the stand
    RO(x - 9, y - 26, 18, 17, '#3a3f66'); R(x - 9, y - 26, 18, 1, '#8fa2d2'); R(x + 7, y - 25, 2, 15, '#222244');
    for (let i = 0; i < 18; i++) R(x - 9 + i, y - 13, 1, 4, ((i + 1) >> 2) % 2 ? '#ffcf3a' : '#1a1826');   // hazard stripes
    RO(x - 5, y - 23, 7, 7, on ? '#ff3b30' : '#a3151a'); R(x - 5, y - 23, 3, 2, on ? '#ffd6d1' : '#d0453c');   // the big red button
    R(x + 4, y - 23, 2, 2, '#4fe3ff'); R(x + 4, y - 19, 2, 2, on ? '#62d64f' : '#1c7a34');
    R(x + 6, y - 31, 1, 5, OUT); RO(x + 5, y - 34, 3, 3, on ? '#4fe3ff' : '#1f5a6a');     // antenna to the field
    if (on && !FLASH) M5.glow(x - 1, y - 20, 9, '#ff3b30', 0.35);
  }
};
// The ship's cargo crate: steel-violet with amber corners and a cyan glyph (top-left at x, y; 16 x 16). Same rules as
// the engine's wooden crate: two shots, 50 points, it drops its item. The crane's crate lands as one too.
L5.drawCargo = function (x, y) {
  RO(x, y, 16, 16, '#444e82'); R(x, y, 16, 2, '#8fa2d2'); R(x, y + 14, 16, 2, '#30345f');
  R(x + 1, y + 3, 14, 10, '#30345f'); R(x + 2, y + 4, 12, 8, '#222244');
  R(x, y, 3, 3, '#ffcf3a'); R(x + 13, y, 3, 3, '#ffcf3a'); R(x, y + 13, 3, 3, '#c98a16'); R(x + 13, y + 13, 3, 3, '#c98a16');
  R(x + 5, y + 6, 6, 1, '#4fe3ff'); R(x + 7, y + 5, 2, 6, '#4fe3ff'); R(x + 5, y + 9, 2, 1, '#4fe3ff'); R(x + 9, y + 9, 2, 1, '#4fe3ff');
};
PROP_TYPES.cargo = {
  make(o) { o.hp = 2; },
  box: o => ({ x: o.x - 8, y: o.y - 16, w: 16, h: 16 }),
  hit(o, d) {
    if (!propHurt(o, d)) return;
    o.dead = true;
    debris(o.x, o.y - 8, 7, '#6272ab'); debris(o.x, o.y - 8, 3, '#ffcf3a');
    addScore(50, o.x, o.y - 16);
    if (o.item) dropItem(o.item, o.x, o.y - 10, 0);
    Snd.hit();
  },
  draw: o => L5.drawCargo(o.x - 8, o.y - 16)
};
function herdUpdate() {
  const pk = L5.paddock;
  if (!pk.on) pk.t++;
  const h = S.herd;
  if (!h) return;
  h.t++;
  for (const c of h.cows) {
    if (c.wait > 0) { c.wait--; continue; }
    if (!c.hop && c.dir < 0 && c.x <= G.cam.x + 18) { c.dir = 1; dust(c.x, c.y, 3); }      // the screen's left edge: turn round
    c.x += 3 * c.dir;
    if (!c.hop) {
      const n = L5.nectarAt(c.x + 10 * c.dir);
      if (n) { const x1 = c.dir > 0 ? n.x1 + 12 : n.x0 - 12; c.hop = { x0: c.x, x1, y0: groundAt(c.x), y1: groundAt(x1), h: 16 + Math.abs(x1 - c.x) * 0.2 }; Snd.tone('square', 240, 520, 0.12, 0.05); }
    }
    if (c.hop) {
      const u = (c.x - c.hop.x0) / (c.hop.x1 - c.hop.x0);
      if (u >= 1) { c.hop = null; c.y = groundAt(c.x); dust(c.x, c.y, 4); }
      else c.y = c.hop.y0 + (c.hop.y1 - c.hop.y0) * u - c.hop.h * 4 * u * (1 - u);
    } else {
      c.y = groundAt(c.x);
      if (h.t % 5 === 0) dust(c.x - 10 * c.dir, c.y, 1, -c.dir);
    }
    const box = { x: c.x - 12, y: c.y - 20, w: 26, h: 20 };
    for (const e of G.enemies) {
      if (e.dead || h.hit.has(e) || ENEMY_TYPES[e.type].boss || !overlap(box, ebox(e))) continue;   // awake or not
      h.hit.add(e);
      if (damageEnemy(e, 6)) sparks(e.x, c.y - 12, 6, '#ffe066');
    }
  }
  if (h.t % 50 === 20 && h.t < 260) moo();
  if (h.t >= HERD_T) S.herd = null;     // about 6 s: across the screen and away, clearing the way ahead
}
// world space (called with the front layer, so the herd runs in front of the robots it bowls over)
function drawHerd() {
  const h = S.herd;
  if (!h) return;
  for (const c of h.cows) {
    if (c.wait > 0) { M5.cow(c.x, c.y, c.dir, { v: c.v }); continue; }
    M5.cow(c.x, c.y - (c.hop ? 0 : (h.t + c.v * 3 >> 2) & 1), c.dir, { v: c.v, run: h.t, float: !!c.hop });
  }
}
function drawExtras(cx) {
  ctx.save(); ctx.translate(-cx, 0);
  drawHerd();
  drawBubble();
  ctx.restore();
}

// =====================================================================================================================
// Hazards (level5_saucers.js makes them; nothing happens while they don't exist): in AREA 1, once the camera is past
// 300, a cargo crate from the ceiling crane about every 420 frames; in AREA 3 a meteor about every 330 frames (240
// while the BIG SAUCER's lock is on). Aimed near the hero, on screen. Never during an intro, while the hero is down
// or while a boss is dying.
// =====================================================================================================================
function hazards() {
  const p = G.p;
  const quiet = G.intro || G.winT > 0 || !p || p.dead || G.enemies.some(e => (e.dying || e.state === 'dying') && ENEMY_TYPES[e.type].boss);
  const fire = f => { const tx = clamp(p.x + rand(-30, 80), G.cam.x + 24, G.cam.x + W - 24); try { f(tx); } catch (err) { errorOnce(err); } };
  if (typeof L5.craneCrate === 'function' && !quiet && G.section === 0 && G.cam.x > 300) {
    if (--S.crateT <= 0) { S.crateT = Math.round(420 * rand(0.85, 1.15)); fire(L5.craneCrate); }
  } else S.crateT = Math.max(S.crateT, 120);
  if (typeof L5.meteor === 'function' && !quiet && G.section === 2) {
    if (--S.meteorT <= 0) {
      const lk = G.locks.find(l => l.at === 4400), hot = !!lk && lk.active && !lk.done;
      S.meteorT = Math.round((hot ? 240 : 330) * rand(0.85, 1.15));
      fire(L5.meteor);
    }
  } else S.meteorT = Math.max(S.meteorT, 120);
}

// The BIG SAUCER's lock is a boss lock (WARNING, the boss tune, its health bar): the engine shows no GO > after one and
// leaves the boss tune on, so both are done here when it ends.
function bigSaucerLock() {
  if (S.saucerDone) return;
  const lk = G.locks.find(l => l.at === 4400);
  if (!lk || !lk.done) return;
  S.saucerDone = true;
  G.goT = 180; Snd.select();
  if (G.state === 'play' && Music.track === TRACKS.oggleboss) Music.play(G.section === 2 ? 'spacewalk' : 'mothership');
}
// The ship's tune speeds up out on the hull (AREA 3, also after a continue there) and calms down again on the bridge;
// a boss lock's own music and the win jingle are left alone
function musicByArea() {
  if (G.state !== 'play') return;
  if (Music.track === TRACKS.mothership && G.section === 2) Music.play('spacewalk');
  else if (Music.track === TRACKS.spacewalk && G.section !== 2) Music.play('mothership');
}

// =====================================================================================================================
// Hearts (as Missions 1 and 4): the first robot beaten in an area while the hero is on the last heart leaves a heart,
// once per area (a continue starts afresh); the BIG SAUCER always leaves one. Wraps the types' onKill once, at load:
// this file loads after level5_enemies.js / level5_saucers.js, so it wraps the real ones (or the stand-ins).
// =====================================================================================================================
function heartRule(names) {
  for (const t of names) {
    const T = ENEMY_TYPES[t];
    if (!T || T.l5hearts) continue;
    const kill = T.onKill;
    T.l5hearts = true;
    T.onKill = function (e, cx, cy, b) {
      const r = kill ? kill.call(this, e, cx, cy, b) : (boom(cx, cy, 0.8), undefined);
      const p = G.p;
      if (LV !== MOTHERSHIP) return r;
      if (t === 'bigsaucer') dropItem('heart', cx, Math.min(cy, groundAt(cx) - 20), 0);
      else if (p && !p.dead && p.hearts === 1 && S.heartSec !== G.section) { S.heartSec = G.section; dropItem('heart', cx, cy, 0); }
      return r;
    };
  }
}

// =====================================================================================================================
// Music: one entry per step, MIDI notes, 0 = rest (audio.js plays every step as a short note).
// MOTHERSHIP: a spooky-funny space tune in E minor, 16 steps a bar at 216. The lead is a sine like the theremin of an
// old flying-saucer film: short blips, and every long note wobbles (it trills up a semitone on every other step); the
// phrases end in whole-tone runs. A bass that bounces root - octave - fifth, a ticking hat and a soft kick.
// A A' B A'' (16 bars, 256 steps). SPACE WALK is the same tune faster with a busier bass and a snare.
// =====================================================================================================================
// [note, steps, wobble]: one strike and rests; a 3-step note is struck twice; a wobbling one trills n, n + 1, n ...
function tune(list) {
  const out = [];
  for (const [n, len, wob] of list) for (let i = 0; i < len; i++) out.push(!n ? 0 : wob ? (i === len - 1 && len > 4 ? 0 : n + (i & 1)) : i === 0 || (len === 3 && i === 2) ? n : 0);
  return out;
}
const A1 = [[76, 3], [79, 3], [83, 2], [82, 2], [83, 2], [79, 2], [76, 2]];
const A2 = [[75, 3], [78, 3], [81, 2], [80, 2], [81, 2], [78, 2], [75, 2]];
const SHIP_MEL = tune([
  ...A1, ...A2, [76, 3], [79, 3], [83, 2], [86, 2], [88, 4, 1], [0, 2],
  [86, 1], [84, 1], [82, 1], [80, 1], [78, 1], [76, 1], [74, 1], [72, 1], [71, 4, 1], [0, 4],
  ...A1, ...A2, [76, 3], [79, 3], [83, 2], [86, 2], [88, 2], [91, 2], [88, 2],
  [87, 1], [86, 1], [84, 1], [82, 1], [80, 1], [78, 1], [76, 2], [76, 4, 1], [0, 4],
  [72, 2], [0, 1], [76, 2], [0, 1], [79, 2], [84, 4, 1], [79, 2], [76, 2],
  [69, 2], [0, 1], [72, 2], [0, 1], [76, 2], [81, 4, 1], [76, 2], [72, 2],
  [66, 2], [69, 2], [72, 2], [75, 2], [78, 2], [81, 2], [84, 2], [87, 2],
  [83, 3], [0, 1], [83, 1], [83, 1], [0, 2], [82, 1], [83, 1], [82, 1], [83, 1], [87, 4, 1],
  ...A1, ...A2, [76, 2], [79, 2], [83, 2], [88, 2], [86, 2], [83, 2], [79, 2], [75, 2],
  [76, 4, 1], [0, 2], [64, 1], [0, 1], [64, 1], [0, 1], [76, 2], [0, 4]
]);
const SHIP_ROOTS = [40, 47, 40, 47, 40, 47, 40, 40, 48, 45, 42, 47, 40, 47, 40, 40];
const shipBass = [], walkBass = [];
for (const r of SHIP_ROOTS) {
  shipBass.push(r, 0, r + 12, 0, r, 0, r + 12, 0, r, 0, r + 12, 0, r + 7, 0, r + 12, r + 7);
  walkBass.push(r, 0, r, r + 12, 0, r, r + 12, 0, r, 0, r, r + 12, r + 7, 0, r + 12, r + 7);
}
TRACKS.mothership = { bpm: 216, lead: 'sine', bass: shipBass, mel: SHIP_MEL, drums: { kick: 'x.......x.....x.', hat: 'x.x.x.x.x.x.x.xx' } };
TRACKS.spacewalk = { bpm: 252, lead: 'sine', bass: walkBass, mel: SHIP_MEL, drums: { kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx' } };
// MEGA OGGLE (and the BIG SAUCER): a heavy march in E minor, eighth-note steps at 168: an oom-pah bass on root and
// fifth, a snare cadence, a stomping square lead that keeps the mothership tune's A sharp. 16 bars (128 steps).
const bossBass = [];
for (const r of [40, 40, 36, 47, 40, 40, 45, 47, 43, 38, 40, 47, 36, 45, 42, 47]) bossBass.push(r, r, r + 7, 0, r, r, r + 7, r + 12);
TRACKS.oggleboss = {
  bpm: 168,
  bass: bossBass,
  mel: [
    64, 0, 64, 64, 67, 0, 71, 0,     70, 0, 71, 0, 67, 0, 64, 0,     72, 0, 72, 72, 76, 0, 79, 0,     78, 0, 75, 0, 71, 0, 0, 0,
    64, 0, 64, 64, 67, 0, 71, 0,     70, 0, 71, 0, 76, 0, 79, 0,     81, 0, 79, 76, 72, 0, 69, 0,     71, 71, 0, 75, 0, 78, 83, 0,
    79, 0, 74, 79, 83, 0, 79, 0,     78, 0, 74, 78, 81, 0, 78, 0,     76, 0, 71, 76, 79, 0, 76, 0,     75, 0, 71, 75, 78, 0, 0, 0,
    72, 72, 0, 76, 0, 79, 84, 0,     81, 81, 0, 76, 0, 72, 69, 0,     78, 75, 72, 69, 78, 75, 72, 69,  71, 0, 71, 71, 71, 0, 83, 0
  ],
  drums: { kick: 'x...x...', snare: '..x...xx..x.x.xx', hat: 'x.xxx.xx' }
};

heartRule(['oggle', 'roller', 'eyeflower', 'eyedrone', 'bigsaucer']);
}
