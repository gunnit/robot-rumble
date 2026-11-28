'use strict';
var L8 = L8 || {};
// =====================================================================================================================
// Mission 8: DINOSAUR VALLEY (LEVELS[7]). The last chapter of THE OGGLE CASE FILE.
// MEGA OGGLE's escape pod came down in a hidden valley where dinosaurs still live. He has caged the young ones and
// built ROBOT dinosaurs after them. Ines or Mathias cross the CRASH SITE, wade the LONG-NECK LAGOON, climb through
// BONE CANYON to the armoured CLUBTAIL, free TOPS the triceratops and ride her away from the OGGLE REX (REX RUN!),
// shut down the ROBO HATCHERY and face the OGGLE REX itself on the launch pad.
//
// This file: the level data, the hook wiring and the level rules:
//   - water and tar: L8.poolAt(x); the hero wades (water 65 % of his speed, tar 45 %); robots are slowed by tar too
//   - hearts: L8.robotDown(e, cx, cy), called by every Mission 8 robot when it is beaten: a robot beaten while the
//     hero is on his last heart leaves a heart, at most one every 20 seconds (a continue starts afresh)
//   - CLUBTAIL's lock (camera 3780): WARNING and its own tune; the fight is a checkpoint of its own; beaten, TOPS's
//     cage opens (L8.cageOpen)
//   - TOPS: where she is put down after a continue, the hatchery gate she will not pass (L8.topsMay), where she may
//     wait after being tired out (L8.topsRest)
//   - the hatchery's lock (camera 6300): the robot nests on that screen belong to it
//   - the music by area
// Level-owned pieces live in their own files: the chase (level8_chase.js: L8.chase), the picture (level8_backdrops.js
// and level8_scenery.js), the five tunes (level8_music.js) and the opening scene (level8_intro.js).
// Everything in the block is private except what hangs on L8.
// =====================================================================================================================
{
const Math = globalThis.Math;
const SECTIONS = [
  { x: 0, name: 'AREA 1: CRASH SITE' },
  { x: 1450, name: 'AREA 2: LONG-NECK LAGOON' },
  { x: 2900, name: 'AREA 3: BONE CANYON' },
  { x: 4300, name: 'AREA 4: REX RUN!' },
  { x: 5700, name: 'AREA 5: ROBO HATCHERY' },
  { x: 7100, name: 'FINAL AREA: OGGLE REX' }
];
const CLUB_AT = 3780, NEST_AT = 6300, BOSS_AT = 7380, CAGE_X = 4215, GATE_X = 5690;
const POOLS = [
  { x0: 1640, x1: 1900, y: 226, k: 'water' }, { x0: 2060, x1: 2330, y: 226, k: 'water' },
  { x0: 3296, x1: 3424, y: 198, k: 'tar' }, { x0: 3556, x1: 3664, y: 216, k: 'tar' }
];
const c3 = (x, cd = 0) => [{ t: 'compy', x, cd: 20 + cd }, { t: 'compy', x: x + 22, cd: 44 + cd }, { t: 'compy', x: x + 46, cd: 68 + cd }];   // a pack of three
const VALLEY = {
  mission: 'MISSION 8', title: 'DINOSAUR VALLEY', end: 7860, heroStart: 110, freedLabel: 'DINOSAURS FREED',
  music: 'dinovalley', bossMusic: 'ogglerex', clearMusic: 'victory', startText: 'MISSION 8 START!', startSay: 'Mission eight, start!',
  sections: SECTIONS,
  pools: POOLS,
  terrain: [
    // AREA 1: CRASH SITE (the pod's crater, a rise, the first clearing)
    [0, 226], [250, 226], [290, 234], [400, 234], [440, 226], [560, 218], [700, 218], [780, 228], [1300, 228], [1380, 220], [1450, 216],
    // AREA 2: LONG-NECK LAGOON (two pools: surface 226, bed 236)
    [1540, 226], [1640, 226], [1652, 236], [1888, 236], [1900, 226], [2060, 226], [2072, 236], [2318, 236], [2330, 226], [2900, 226],
    // AREA 3: BONE CANYON (two ledges, two tar pits, CLUBTAIL's arena)
    [2990, 226], [3040, 212], [3180, 212], [3230, 198], [3290, 198], [3296, 204], [3424, 204], [3430, 198], [3490, 198],
    [3550, 216], [3556, 222], [3664, 222], [3670, 216], [3730, 228], [4300, 228],
    // AREA 4: REX RUN! (rolling ground, the log bridge 5500-5620)
    [4460, 228], [4540, 220], [4640, 220], [4720, 230], [4840, 230], [4920, 220], [5010, 216], [5100, 226], [5220, 230], [5320, 222], [5420, 228], [5700, 228],
    // AREA 5: ROBO HATCHERY (a steel floor), FINAL AREA (the launch pad)
    [7000, 228], [7040, 226], [7860, 226]
  ],
  plats: [],
  spawns: [
    // AREA 1: one new robot at a time: the little ones, a raptor (it wakes when the hero passes x 620: the pack is
    // beaten by then), (the lock: the first one in the sky), an ambush
    ...c3(560), { t: 'raptor', x: 920 },
    { t: 'raptor', x: 1340, ambush: true }, { t: 'compy', x: 1400 }, { t: 'compy', x: 1424, cd: 50 },
    // AREA 2: a spitter on the island between the pools, a swooper over the second pool (low: a shot fired from a
    // jump brings it down before it dives), an ambush on the far bank
    { t: 'spitter', x: 1990, range: 170 }, { t: 'compy', x: 1930, cd: 60 }, { t: 'compy', x: 1952, cd: 100 },
    { t: 'ptero', x: 2230, y: 178, mode: 'swoop' }, { t: 'raptor', x: 2372, ambush: true },
    // AREA 3: up the ledges (a pack, an ambush), through the tar: a spitter holds the far side of the first pit,
    // a bomber circles over the second
    ...c3(3130), { t: 'raptor', x: 3256, ambush: true }, { t: 'spitter', x: 3462, range: 150 }, { t: 'ptero', x: 3640, y: 84 },
    // AREA 4: the chase (boulder walls bar the way; the rest runs at TOPS)
    ...c3(4680), { t: 'boulderwall', x: 4800 }, { t: 'raptor', x: 4960 }, { t: 'boulderwall', x: 5090 },
    { t: 'boulderwall', x: 5360 }, { t: 'compy', x: 5440 }, { t: 'compy', x: 5462, cd: 50 },
    // AREA 5: one Oggle trooper, one robot nest, then both kinds together in the lock; a last trooper at the door
    { t: 'oggle', x: 6030 }, { t: 'robonest', x: 6150, cd: 90 },
    { t: 'robonest', x: 6470, cd: 150 }, { t: 'robonest', x: 6690, cd: 260 },
    { t: 'oggle', x: 6930 }
  ],
  locks: [
    // (the first lock brings one new thing, the robot in the sky; the raptors of this area come one at a time)
    { at: 800, waves: [
      { t: 'compy', side: 1, d: 20 }, { t: 'compy', side: 1, d: 44, cd: 40 },
      { t: 'compy', side: -1, d: 170 }, { t: 'compy', side: -1, d: 194, cd: 40 }, { t: 'ptero', side: 1, d: 270, y: 84 }
    ] },
    { at: 2400, waves: [
      { t: 'raptor', side: 1, d: 20 }, { t: 'compy', side: -1, d: 130 }, { t: 'compy', side: -1, d: 154, cd: 40 },
      { t: 'ptero', side: 1, d: 260, y: 84 }, { t: 'raptor', side: -1, d: 400 },
      { t: 'compy', side: 1, d: 500 }, { t: 'compy', side: 1, d: 524, cd: 40 }
    ] },
    { at: CLUB_AT, waves: [{ t: 'clubtail', side: 1, d: 70 }] },                 // mini-boss
    { at: NEST_AT, waves: [{ t: 'oggle', side: 1, d: 60 }, { t: 'oggle', side: -1, d: 330 }] },
    { at: BOSS_AT, boss: true, waves: [{ t: 'ogglerex', side: 1, d: 60 }] }
  ],
  // eight young dinosaurs in cages (their look goes by their number)
  pows: [
    { x: 330, item: 'H', kind: 'hatchling' }, { x: 1240, item: 'B', kind: 'hatchling' }, { x: 1985, item: 'D', kind: 'hatchling' },
    { x: 2262, item: 'heart', kind: 'hatchling' }, { x: 3170, item: 'H', kind: 'hatchling' }, { x: 3745, item: 'heart', kind: 'hatchling' },
    { x: 6230, item: 'D', kind: 'hatchling' }, { x: 7230, item: 'heart', kind: 'hatchling' }
  ],
  props: [
    { k: 'amber', x: 210, item: 'coin' }, { k: 'amber', x: 700, item: 'coin' }, { k: 'amber', x: 1130, item: 'heart' },
    { k: 'amber', x: 1560, item: 'coin' }, { k: 'amber', x: 2390, item: 'heart' }, { k: 'amber', x: 2850, item: 'heart' },
    { k: 'amber', x: 3520, item: 'B' }, { k: 'topscage', x: CAGE_X }, { k: 'amber', x: 4400, item: 'coin' },
    { k: 'amber', x: 5770, item: 'heart' }, { k: 'amber', x: 6260, item: 'coin' }, { k: 'amber', x: 6830, item: 'heart' },
    { k: 'amber', x: 7180, item: 'B' }
  ],
  drawBG: cx => L8.drawBG(cx),
  drawBehind: cx => L8.drawBehind(cx),
  drawGround: cx => L8.drawGround(cx),
  drawPlat: pl => L8.drawPlat(pl),
  drawFront: cx => L8.drawFront(cx),
  drawOverlay: cx => L8.drawOverlay(cx),
  drawHUD() { if (L8.chase) L8.chase.hud(); },
  menuBG: () => L8.menuBG(),
  preview(x, y, w, h) { L8.card(x, y, w, h); },
  pauseHint: 'FREE THE BABY DINOSAURS. THE ROBOTS HAVE ONE EYE!',
  update() {
    // the pictures to come are painted a little at a time, long before they show (the opening scene, which plays by
    // itself, paints more of them: level8_intro.js)
    if (!G.intro && G.t % 4 === 0) L8.bakeSome(1);
    heroRules();
    duckTip();
    clubLock();
    nestLock();
    if (L8.chase) L8.chase.update();
    musicByArea();
  },
  load(cp) {
    S.wet = null; S.tip = null; S.heartAt = -PITY; S.clubOn = false; S.nestOn = false; L8.dawnAt = null;
    if (!cp) S.duck = false;                // (a continue does not repeat the tip)
    L8.sceneWarm();
    // a checkpoint that is not the start of an area (CLUBTAIL's arena): the engine picked area 1
    let sec = 0;
    for (let i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].x <= cp) sec = i;
    if (G.section !== sec) { G.section = sec; if (G.banner) G.banner.s = SECTIONS[sec].name; }
    const lk = G.locks.find(l => l.at === CLUB_AT);
    S.clubDone = !lk || lk.done;
    // TOPS: caged until CLUBTAIL is beaten; after that she waits for the hero near where he starts (until the gate)
    if (S.clubDone) {
      G.props = G.props.filter(o => o.k !== 'topscage');
      if (cp < GATE_X - 200) L8.parkTops(Math.max(CAGE_X, cp + 96), 1, null, true);
      else if (cp < GATE_X + 300) L8.topsEnd(GATE_X - 30);
    }
    if (L8.chase) L8.chase.load(cp);
    if (G.p) G.p.hidden = false;
  },
  intro: null   // set by level8_intro.js (L8.level.intro)
};
LEVELS.push(VALLEY);
L8.level = VALLEY;
L8.CLUB_AT = CLUB_AT; L8.BOSS_AT = BOSS_AT; L8.GATE_X = GATE_X; L8.CAGE_X = CAGE_X;

// Mission 8 state (all of it reset by load)
const PITY = 1200;                      // frames of play between two hearts for a hero on his last one
const S = { wet: null, tip: null, heartAt: -PITY, clubOn: false, clubDone: false, nestOn: false, duck: false };
const inM8 = () => LV === VALLEY;
L8.inM8 = inM8;

// ---------------------------------------------------------------------------------------------------------------------
// Lookups for the other Mission 8 files (null / false in any other level, e.g. the sandbox)
// ---------------------------------------------------------------------------------------------------------------------
L8.poolAt = function (x) {
  if (!inM8()) return null;
  for (const n of POOLS) if (x >= n.x0 && x <= n.x1) return n;
  return null;
};
L8.sticky = x => { const n = L8.poolAt(x); return !!n && n.k === 'tar'; };
L8.cageOpen = () => inM8() && S.clubDone;
L8.topsRest = () => inM8() ? GATE_X - 30 : LV.end - 60;
// TOPS will not go into the Oggles' hatchery: at its gate the hero gets off and she waits there
L8.topsNo = x => inM8() && x > 5476 && x < 5644;                 // no waiting on the log bridge
L8.topsEnd = function (x) {
  const o = { k: 'topswait', x, y: groundAt(x), hitT: 0, dead: false, facing: 1, t: 0 };
  G.props.push(o);
  return o;
};
L8.topsMay = function (p, r) {
  if (!inM8() || p.x < GATE_X - 30) return true;
  const o = L8.topsEnd(p.x);
  exitRide(p, false);
  p.y -= 18; p.x += 10;
  G.texts.push({ x: o.x, y: o.y - 62, s: 'TOPS WAITS HERE!', t: 130, c: '#ffe066' });
  L8.bellow();
  return false;
};

// ---------------------------------------------------------------------------------------------------------------------
// Hearts: a robot beaten while the hero is on his last heart leaves one. Missions 1, 4 and 5 do that once per area;
// this mission is half as long again, so here it is once every PITY frames of play (20 seconds). Whoever plays well
// never sees it; whoever jumps about and misses (the test bot does) is kept in the game.
// ---------------------------------------------------------------------------------------------------------------------
L8.robotDown = function (e, cx, cy) {
  const p = G.p;
  if (!inM8() || !p || p.dead || p.hearts !== 1 || G.time - S.heartAt < PITY) return;
  S.heartAt = G.time;
  dropItem('heart', cx, Math.min(cy, groundAt(cx) - 12), 0);
};
// Mission 5's troopers serve in the hatchery: they keep the rule there, and the rule of every small robot of the
// valley: when a giant comes, a trooper that is not part of its lock runs off (L8.scram in level8_enemies.js)
{
  const T = ENEMY_TYPES.oggle;
  if (T && !T.l8hearts) {
    const kill = T.onKill, upd = T.update, touch = T.contact;
    T.l8hearts = true;
    T.onKill = function (e, cx, cy, b) { const r = kill ? kill.call(this, e, cx, cy, b) : undefined; if (inM8()) L8.robotDown(e, cx, cy); return r; };
    T.update = function (e) { if (inM8() && L8.scram && L8.scram(e, 2.6)) { e.state = 'walk'; e.walk = true; return; } return upd.call(this, e); };
    T.contact = function (e) { return e.gone ? 'none' : typeof touch === 'function' ? touch.call(this, e) : touch || 'hurt'; };
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The hero's rules: wading. The engine has already moved him this frame; part of the step is taken back.
// ---------------------------------------------------------------------------------------------------------------------
function splash(x, y, n, tar) {
  for (let i = 0; i < n; i++) G.parts.push({ type: 'spark', x: x + rand(-4, 4), y: y - 1, vx: rand(-1.3, 1.3), vy: rand(-2.6, -0.8) * (tar ? 0.6 : 1), g: 0.16, life: rand(10, 18), max: 18, size: i % 3 ? 1 : 2, c: tar ? (i % 2 ? '#2a2030' : '#4a3a52') : (i % 2 ? '#e8fbff' : '#8ad8f0') });
  if (n > 4) Snd.noise(0.14, 0.05, tar ? 500 : 1800);
}
L8.splash = splash;
function heroRules() {
  const p = G.p;
  if (!p || p.dead || p.ride) { S.wet = null; return; }
  const n = L8.poolAt(p.x), wet = n && p.y > n.y + 1 ? n : null;
  if (wet) {
    const tar = wet.k === 'tar';
    if (p.vx) { p.x -= p.vx * (tar ? 0.55 : 0.35); if (p.onGround && !p.onPlat) p.y = groundAt(p.x); }
    if (!S.wet) { splash(p.x, wet.y, Math.min(12, 3 + Math.max(0, p.vy) * 2), tar); if (tar && !S.tarSaid) { S.tarSaid = true; G.texts.push({ x: p.x, y: wet.y - 44, s: 'STICKY TAR!', t: 90, c: '#d7a6ef' }); } }
    else if (p.onGround && p.vx && p.t % 8 === 0) splash(p.x - p.facing * 3, wet.y, 2, tar);
  }
  S.wet = wet;
}

// The first pack of little robots: a standing shot flies over them (they are 13 px tall), and no mission before this
// one asked for a shot from a crouch. Said once, over the hero's head.
function duckTip() {
  if (S.tip) { if (S.tip.t > 1) S.tip.x = G.cam.x + S.tip.sx; else S.tip = null; }     // the tip stays on the screen
  if (S.duck) return;
  const p = G.p, cam = G.cam.x;
  if (!p || p.dead || p.ride) return;
  if (!G.enemies.some(e => e.type === 'compy' && e.active && !e.dead && e.x > cam + 8 && e.x < cam + W - 8)) return;
  S.duck = true;
  S.tip = { x: 0, y: p.y - 62, s: 'DUCK TO SHOOT THE LITTLE ONES!', t: 170, c: '#ffe066', sx: clamp(p.x + 40 - cam, 96, W - 96) };
  S.tip.x = cam + S.tip.sx;
  G.texts.push(S.tip);
}

// ---------------------------------------------------------------------------------------------------------------------
// CLUBTAIL's lock: a mini-boss behind an ordinary lock (so the engine says GO > afterwards). WARNING, its tune, and a
// checkpoint of its own: a continue during the fight starts at the arena, one after it starts behind it with TOPS.
// ---------------------------------------------------------------------------------------------------------------------
function clubLock() {
  if (S.clubDone) return;
  const lk = G.locks.find(l => l.at === CLUB_AT);
  if (!lk) { S.clubDone = true; return; }
  if (lk.active && !S.clubOn) {
    S.clubOn = true;
    G.checkpoint = CLUB_AT;
    if (ENEMY_TYPES.clubtail) { G.warnT = 160; Music.play('clubtail'); Snd.noise(1.5, 0.3, 300); }
  }
  if (lk.done) {
    S.clubDone = true;
    G.checkpoint = CLUB_AT + 1;
    if (G.state === 'play' && Music.track === TRACKS.clubtail) Music.play('dinovalley');
  }
}
// The hatchery's lock: the nests standing on its screen belong to it (it ends when they are scrap)
function nestLock() {
  if (S.nestOn) return;
  const lk = G.locks.find(l => l.at === NEST_AT);
  if (!lk || !lk.active) return;
  S.nestOn = true;
  for (const e of G.enemies) if (e.type === 'robonest' && e.x > NEST_AT && e.x < NEST_AT + W) { e.lock = lk; e.active = true; }
  G.texts.push({ x: G.cam.x + W / 2, y: 80, s: 'SMASH THE ROBOT NESTS!', t: 150, c: '#ffe066' });
}
// One tune for the valley, a faster one for the chase, the Oggles' own in their hatchery; lock tunes are left alone
function musicByArea() {
  if (G.state !== 'play') return;
  const want = L8.chase && L8.chase.active() ? 'dinochase' : G.section === 4 ? 'mothership' : 'dinovalley';
  const cur = Music.track;
  if (cur !== TRACKS[want] && (cur === TRACKS.dinovalley || cur === TRACKS.dinochase || cur === TRACKS.mothership) && TRACKS[want]) Music.play(want);
}

// ---------------------------------------------------------------------------------------------------------------------
// The picture is level8_backdrops.js's and level8_scenery.js's (they load after this file); the cast's own props:
// ---------------------------------------------------------------------------------------------------------------------
L8.drawBush = L8.drawBush || ((x, y, flash) => { const F = FLASH; FLASH = !!flash; M8.bush(x, y); FLASH = F; });
L8.drawNest = L8.drawNest || ((x, y, rock, t, hp) => M8.nest(x, y, rock, t, hp));
L8.drawWall = L8.drawWall || ((x, y, hp) => M8.wall(x, y, hp));

}
