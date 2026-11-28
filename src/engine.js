'use strict';
// ============================================================
// Engine: registries, game state, mission flow, physics, player, enemies,
// bullets, props, prisoners, items, effects, camera, locks, update()
// ============================================================
const LEVELS = [];          // LEVELS[0] = mission 1, LEVELS[1] = mission 2
let LV = null;              // current level definition (set by startMission / devStart)
const ENEMY_TYPES = {};     // name -> enemy type
const PROP_TYPES = {};      // kind -> prop type (crate, barrel live in level1.js)
const POW_KINDS = {};       // kind -> prisoner/animal type ('human' lives in level1.js)
const ITEMS = {};           // item letter/kind -> pickup
const RIDES = {};           // ride type -> vehicle (vehicle.js)
const EB_TYPES = {};        // custom enemy-projectile kinds

// ============================================================
// Game state
// ============================================================
const G = {
  state: 'title', t: 0, hero: 0, level: 0, score: 0, lives: 3, best: 0, time: 0, checkpoint: 0, section: 0,
  cam: { x: 0 }, p: null, enemies: [], pb: [], eb: [], grenades: [], props: [], pows: [], items: [],
  parts: [], rings: [], texts: [], later: [], markers: [], locks: [], fw: [], sflash: 0,
  freed: new Set(), continues: 0, fade: 0, shake: 0, banner: null, big: null, goT: 0, warnT: 0, winT: 0, overT: 0, endT: 0,
  intro: false, introKeys: {}, lockT: 0
};
try { G.best = +localStorage.getItem('robotRumbleBest') || 0; } catch (e) {}
// Per-mission records shown on the mission cards: G.rec[missionIndex] = { stars: 0..3, best: points earned in it }
G.rec = {}; G.score0 = 0;
try { const r = JSON.parse(localStorage.getItem('robotRumbleRecords') || '{}'); if (r && typeof r === 'object') G.rec = r; } catch (e) {}
window.G = G;
const dbg = { god: false, onHurt: null }; // onHurt(sectionIndex) is called for every hit the player takes
window.dbg = dbg;

function saveBest() {
  if (G.score > G.best) {
    G.best = G.score;
    try { localStorage.setItem('robotRumbleBest', String(G.best)); } catch (e) {}
  }
}

// Stars for the mission just won: finishing, freeing everyone, never needing a continue
function missionStars() { return 1 + (G.freed.size === LV.pows.length ? 1 : 0) + (G.continues === 0 ? 1 : 0); }
// Keep the best stars and the best score of this mission (points earned in it: the score carries over between missions)
function saveRecord() {
  if (LEVELS[G.level] !== LV) return; // the test arena has no card
  const r = G.rec[G.level] || (G.rec[G.level] = { stars: 0, best: 0 });
  r.stars = Math.max(r.stars | 0, missionStars());
  r.best = Math.max(r.best | 0, G.score - G.score0);
  try { localStorage.setItem('robotRumbleRecords', JSON.stringify(G.rec)); } catch (e) {}
}

function newPlayer(x) {
  return {
    x, y: groundAt(x), vx: 0, vy: 0, kb: 0, facing: 1, onGround: true, onPlat: null, crouch: false, aim: 'fwd', t: 0,
    hearts: 3, inv: 0, fireCd: 0, muzzle: 0, knife: 0, weapon: 'pistol', ammo: 0, bombs: 10, dropT: 0, dead: 0, rot: 0, ride: null
  };
}

// Stand-in for an enemy type nobody has written yet. makeEnemy returns one (already dead, so nothing touches it and
// updateEnemies drops it) instead of null, so content can push or set up whatever makeEnemy returns.
ENEMY_TYPES['?'] = { hp: 1, contact: 'none', update() {}, draw() {}, box: e => ({ x: e.x, y: e.y, w: 0, h: 0 }) };

function makeEnemy(s, lock) {
  const known = !!ENEMY_TYPES[s.t], type = ENEMY_TYPES[known ? s.t : '?'];
  if (!known) warnOnce('enemy type', s.t);
  const e = { type: known ? s.t : '?', x: s.x, y: s.y || groundAt(s.x), vx: 0, vy: 0, t: 0, hitT: 0, facing: -1, active: false, dead: !known, lock: lock || null, hp: type.hp || 1, max: 0 };
  if (type.make) type.make(e, s);
  if (!e.max) e.max = e.hp;
  return e;
}

function makeProp(s) {
  const type = PROP_TYPES[s.k];
  if (!type) { warnOnce('prop kind', s.k); return null; }
  const o = { ...s, y: s.y != null ? s.y : groundAt(s.x), hitT: 0, dead: false };
  if (type.make) type.make(o, s);
  return o;
}

function powKind(k = 'human') {
  if (POW_KINDS[k]) return k;
  warnOnce('POW kind', k);
  return 'human';
}

// Build the current level (LV) from checkpoint x = cp
function loadLevel(cp) {
  G.cam.x = cp;
  G.p = newPlayer(cp === 0 && LV.heroStart != null ? LV.heroStart : cp + 60);
  G.enemies = LV.spawns.filter(s => s.x >= cp + 40).map(s => makeEnemy(s)).filter(e => !e.dead);
  G.pows = LV.pows.map((o, i) => ({ id: i, x: o.x, y: groundAt(o.x), item: o.item, kind: powKind(o.kind), state: 'tied', t: 0 })).filter(o => o.x >= cp);
  G.props = LV.props.filter(o => o.x >= cp).map(makeProp).filter(Boolean);
  G.locks = LV.locks.map(l => ({ ...l, done: l.at < cp, active: false, t: 0, queue: [] }));
  G.pb = []; G.eb = []; G.grenades = []; G.items = []; G.parts = []; G.rings = [];
  G.texts = []; G.later = []; G.markers = [];
  G.section = Math.max(0, LV.sections.findIndex(s => s.x === cp));
  G.banner = { s: LV.sections[G.section].name, t: 200 };
  G.big = { s: LV.startText || 'MISSION START!', t: 130 };
  G.shake = 0; G.goT = 0; G.warnT = 0; G.winT = 0; G.intro = false;
  if (LV.load) LV.load(cp);
}

// ============================================================
// Mission flow
// ============================================================
// Fresh run from the hero select screen
function startGame() {
  G.score = 0;
  startMission(G.level);
}

// Start mission i from its beginning (hero and score carry over)
function startMission(i) {
  G.level = i; LV = LEVELS[i];
  beginMission(0, true);
}

// Fresh lives and timers, LV built for camera x cp. The intro (if LV has one) only plays when asked: fresh starts,
// not devStart jumps.
function beginMission(cp, intro) {
  G.lives = 3; G.time = 0; G.checkpoint = 0; G.freed = new Set(); G.continues = 0; G.fade = 1;
  G.score0 = G.score;
  loadLevel(cp);
  G.state = 'play';
  Music.play(LV.music || 'main');
  G.intro = !!(intro && LV.intro);
  // the intro owns the opening banners and voice; player controls come from G.introKeys until it ends
  if (G.intro) { G.banner = null; G.big = null; G.introKeys = {}; prevIntroKeys = {}; LV.intro.start(); }
  else say(LV.startSay || 'Mission start!');
}

function continueGame() {
  G.lives = 3; G.continues++; G.fade = 1;
  loadLevel(G.checkpoint);
  G.state = 'play';
  Music.play(LV.music || 'main');
  say(LV.startSay || 'Mission start!');
}

function toWin() {
  G.state = 'win'; G.endT = 0; G.fw = []; G.fade = 0.8;
  saveBest(); saveRecord();
  Music.stop(); Snd.win();
  say('Mission complete!');
}

// ============================================================
// Effects
// ============================================================
function boom(x, y, s = 1) {
  const n = Math.round(9 * s) + 3;
  G.parts.push({ type: 'flash', x, y, life: 5, max: 5, size: 16 * s });
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), d = rand(0, 9 * s);
    G.parts.push({ type: 'fire', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, vx: Math.cos(a) * rand(0.3, 1.5) * s, vy: Math.sin(a) * rand(0.3, 1.2) * s - 0.5, life: rand(18, 34), max: 34, size: rand(4, 8) * s });
  }
  for (let i = 0; i < n * 0.7; i++) G.parts.push({ type: 'smoke', x: x + rand(-8, 8) * s, y: y + rand(-8, 4) * s, vx: rand(-0.5, 0.5), vy: rand(-0.9, -0.3), life: rand(40, 70), max: 70, size: rand(4, 8) * s });
  for (let i = 0; i < n; i++) G.parts.push({ type: 'spark', x, y, vx: rand(-3.5, 3.5), vy: rand(-4, 1), g: 0.18, life: rand(15, 30), max: 30, size: 2 });
  G.rings.push({ x, y, r: 24 * s, t: 0, max: 10 });
  G.shake = Math.max(G.shake, 3 * s);
  if (s >= 1.5) G.sflash = Math.max(G.sflash, Math.min(0.6, s * 0.2));
  Snd.boom(s > 1.3);
}
function dust(x, y, n, dir = 0) {
  for (let i = 0; i < n; i++) G.parts.push({ type: 'dust', x: x + rand(-3, 3), y: y - rand(0, 3), vx: (dir || (i % 2 ? 1 : -1)) * rand(0.2, 0.9), vy: rand(-0.5, -0.1), life: rand(16, 26), max: 26, size: rand(2, 4) });
}
function sparks(x, y, n = 4, c = '#ffe066') {
  for (let i = 0; i < n; i++) G.parts.push({ type: 'spark', x, y, vx: rand(-2, 2), vy: rand(-2.5, 0.5), g: 0.15, life: rand(8, 16), max: 16, size: 1, c });
}
function debris(x, y, n, c) {
  for (let i = 0; i < n; i++) G.parts.push({ type: 'debris', x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-2.2, 2.2), vy: rand(-3.5, -1), g: 0.22, life: rand(40, 70), max: 70, size: rand(2, 4) | 0, c });
}
function addScore(n, x, y) {
  G.score += n;
  G.texts.push({ x, y, s: String(n), t: 50, c: '#ffffff' });
}

// Damage area: src 'player' / 'barrel' hurts enemies, 'enemy' hurts the player
function blast(x, y, r, dmg, src) {
  boom(x, y, r / 24);
  if (src === 'enemy') {
    if (!G.p.dead && distToBox(x, y, pbox(G.p)) < r * 0.8) hurtPlayer();
    return;
  }
  for (const e of G.enemies) if (e.active && !e.dead && distToBox(x, y, ebox(e)) < r) damageEnemy(e, dmg);
  for (const o of G.props) { const b = !o.dead && propBox(o); if (b && distToBox(x, y, b) < r) hitProp(o, 99, src); }
  for (const o of G.pows) if (o.state === 'tied' && Math.abs(o.x - x) < r) freePow(o);
}

// ============================================================
// Collision boxes
// ============================================================
function pbox(p) {
  if (p.ride) return RIDES[p.ride.type].box(p, p.ride);
  const h = p.crouch ? 24 : 32; return { x: p.x - 6, y: p.y - h, w: 12, h };
}
function ebox(e) { return ENEMY_TYPES[e.type].box(e); }
function propBox(o) { return PROP_TYPES[o.k].box(o); } // null = can't be hit
function powBox(o) { const k = POW_KINDS[o.kind]; return k.box ? k.box(o) : { x: o.x - 8, y: o.y - 32, w: 18, h: 32 }; }

// One-way platforms + terrain. Walkers that were on the ground stick to it going downhill.
function land(e, prevY) {
  const stick = e.onGround && !e.onPlat;
  e.onGround = false; e.onPlat = null;
  if (e.vy < 0) return;
  const gy = groundAt(e.x);
  if (e.y >= gy || (stick && gy - e.y < 6)) { e.y = gy; e.vy = 0; e.onGround = true; return; }
  if (e.dropT > 0) return;
  for (const pl of LV.plats) {
    if (prevY <= pl.y + 0.01 && e.y >= pl.y && e.x > pl.x - 3 && e.x < pl.x + pl.w + 3) {
      e.y = pl.y; e.vy = 0; e.onGround = true; e.onPlat = pl; return;
    }
  }
}

// ============================================================
// Player
// ============================================================
// Player controls: the keyboard, or the intro's scripted keys (G.introKeys) while a cutscene runs.
// An intro key counts as tapped on the first player update that sees it, keys set in intro.start() included
// (prevIntroKeys = the keys the last player update saw, {} at the start).
let prevIntroKeys = {};
const ctl = a => G.intro ? !!G.introKeys[a] : held(a);
const ctlTap = a => G.intro ? !!G.introKeys[a] && !prevIntroKeys[a] : tap(a);

function hurtPlayer() {
  const p = G.p;
  if (dbg.god || p.inv > 0 || p.dead || G.winT > 0 || G.state !== 'play' || G.intro) return;
  if (dbg.onHurt) dbg.onHurt(G.section);
  if (p.ride) { RIDES[p.ride.type].hurt(p, p.ride); return; }
  p.hearts--;
  G.shake = Math.max(G.shake, 4);
  if (p.hearts <= 0) {
    p.dead = 1; p.vy = -4.5; p.vx = -p.facing * 1.3; p.rot = 0; p.knife = 0; p.muzzle = 0;
    Snd.die();
  } else {
    p.inv = 100; p.kb = -p.facing * 2.6; p.vy = -2.4; p.onGround = false;
    Snd.hurt();
  }
}

function playerRespawn() {
  const old = G.p;
  G.lives--;
  if (G.lives > 0) {
    const p = newPlayer(clamp(old.x, G.cam.x + 40, G.cam.x + W - 60));
    p.y = -20; p.onGround = false; p.inv = 180; p.bombs = Math.max(10, old.bombs);
    G.p = p;
  } else {
    G.state = 'over'; G.overT = 600;
    saveBest();
    Music.stop();
    say('Game over', 0.8, 0.9);
  }
}

// Rides (vehicles): while p.ride is set, RIDES[p.ride.type] moves, boxes, draws and takes hits for the player
function boardRide(p, ride) {
  if (!RIDES[ride.type]) { warnOnce('ride', ride.type); return false; }
  p.ride = ride; p.vx = 0; p.vy = 0; p.kb = 0; p.crouch = false; p.knife = 0; p.muzzle = 0; p.aim = 'fwd';
  return true;
}
function exitRide(p, ejected) {
  const ride = p.ride;
  p.ride = null; p.onGround = false; p.onPlat = null; p.crouch = false;
  p.vy = ejected ? -5 : -3.6;
  if (ejected) { p.inv = Math.max(p.inv, 120); p.kb = -p.facing * 2; }
  return ride;
}

function knifeTarget(p) {
  for (const e of G.enemies) {
    if (!e.active || e.dead || offStage(e) || !ENEMY_TYPES[e.type].melee) continue; // no slashing at a dying wolf
    const dx = e.x - p.x;
    if (Math.abs(dx) < 20 && (Math.sign(dx) === p.facing || Math.abs(dx) < 6) && Math.abs(e.y - p.y) < 20) return e;
  }
  return null;
}

// Weapon pickup: switch to it, or top up its ammo when already holding it
function giveWeapon(p, name) {
  const w = WEAPONS[name];
  if (!w) { warnOnce('weapon', name); return; }
  if (p.weapon === name) p.ammo = Math.min(w.maxAmmo, p.ammo + w.ammo); else { p.weapon = name; p.ammo = w.ammo; }
}

function shoot(p) {
  const wp = weaponOf(p.weapon), m = wp.muzzle(p.aim);
  const mx = p.x + (m[0] - (p.aim === 'fwd' ? 6 : 0)) * p.facing, my = p.y + m[1] + (p.crouch ? 8 : 0);
  wp.fire(p, mx, my, p.aim === 'fwd' ? p.facing : 0, p.aim === 'up' ? -1 : p.aim === 'down' ? 1 : 0);
  p.muzzle = 4; p.fireCd = wp.cd;
  if (wp.ammo !== Infinity && --p.ammo <= 0) { p.weapon = 'pistol'; p.ammo = 0; }
}

function updatePlayer() {
  const p = G.p;
  if (p.dead) {
    p.dead++;
    p.vy += 0.25; p.x += p.vx; p.y += p.vy;
    const gy = groundAt(p.x);
    if (p.y >= gy) { p.y = gy; p.vy *= -0.3; p.vx *= 0.6; p.rot = -Math.PI / 2; }
    else p.rot -= 0.15;
    if (p.dead > 110) playerRespawn();
    return;
  }
  p.t++;
  if (p.inv > 0) p.inv--;
  if (p.ride) { RIDES[p.ride.type].update(p, p.ride); return; }
  const L = ctl('left'), Rt = ctl('right'), U = ctl('up'), D = ctl('down');
  const mv = L && !Rt ? -1 : Rt && !L ? 1 : 0;
  if (mv) p.facing = mv;
  p.crouch = D && p.onGround;
  p.vx = mv * (p.crouch ? 0.9 : 1.7);
  if (p.kb) { p.vx += p.kb; p.kb *= 0.85; if (Math.abs(p.kb) < 0.15) p.kb = 0; }
  if (ctlTap('jump') && p.onGround) {
    if (D && p.onPlat) { p.dropT = 12; p.y += 1; p.onGround = false; }
    else { p.vy = -5.4; p.onGround = false; Snd.jump(); }
  }
  if (!ctl('jump') && p.vy < -2.6) p.vy = -2.6; // short hop when jump is released early
  p.vy = Math.min(p.vy + 0.26, 6);
  const py = p.y, wasGround = p.onGround, fall = p.vy;
  p.x += p.vx; p.y += p.vy;
  if (p.dropT > 0) p.dropT--;
  land(p, py);
  if (p.onGround && !wasGround && fall > 2) dust(p.x, p.y, 6);
  if (!p.onGround && wasGround && p.vy < 0) dust(p.x, p.y, 3);
  if (p.onGround && p.vx && p.t % 10 === 0) dust(p.x - p.facing * 4, p.y, 1, -p.facing);
  p.crouch = D && p.onGround;
  p.aim = U ? 'up' : (D && !p.onGround ? 'down' : 'fwd');

  if (p.fireCd > 0) p.fireCd--;
  if (p.muzzle > 0) p.muzzle--;
  if (p.knife > 0) p.knife--;
  if ((ctlTap('fire') && p.fireCd <= (weaponOf(p.weapon).tapCd ?? 4)) || (ctl('fire') && p.fireCd <= 0)) {
    const tg = p.aim === 'fwd' ? knifeTarget(p) : null;
    if (tg) { p.knife = 10; p.fireCd = 14; damageEnemy(tg, 2); Snd.slash(); }
    else shoot(p);
  }
  if (ctlTap('bomb') && p.bombs > 0 && G.grenades.length < 2) {
    p.bombs--;
    G.grenades.push({ x: p.x + p.facing * 4, y: p.y - 18 + (p.crouch ? 7 : 0), vx: p.facing * 2.4 + p.vx * 0.4, vy: -3.4, b: 0, t: 0 });
    Snd.throw();
  }
}

// ============================================================
// Enemies
// ============================================================
// An enemy in its intro or death animation doesn't hurt on touch, lets grenades through and shows no boss bar
const offStage = e => e.dying || e.state === 'dying' || e.state === 'intro';

function damageEnemy(e, d) {
  if (e.dead || e.inv || e.dying || e.state === 'dying') return false;
  // a type's own armour: shield(e, d) returns the damage that gets through (0 or less: the hit is turned away)
  const shield = ENEMY_TYPES[e.type].shield;
  if (shield) { d = shield(e, d); if (!(d > 0)) return false; }
  e.hp -= d; e.hitT = 4;
  if (e.hp <= 0) killEnemy(e);
  else if (ENEMY_TYPES[e.type].armored) Snd.clank();
  else Snd.hit();
  return true;
}

// onKill(e, cx, cy, box) plays the effects and adds score. Returning 'dying' keeps the enemy for its own death
// animation (in any e.state): e.dying makes it immune and harmless until it calls bossDefeated(e) or sets e.dead.
function killEnemy(e) {
  const type = ENEMY_TYPES[e.type], b = ebox(e), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  if (!type.onKill) { e.dead = true; boom(cx, cy, 0.8); return; }
  if (type.onKill(e, cx, cy, b) === 'dying') { e.dying = true; e.hitT = 0; } else e.dead = true;
}

function bossDefeated(e) { e.dead = true; G.winT = 210; }

function updateEnemies() {
  const p = G.p;
  for (const e of G.enemies) {
    const type = ENEMY_TYPES[e.type];
    if (!e.active) { if (e.x <= G.cam.x + W + (type.activateMargin ?? 30)) e.active = true; else continue; }
    e.t++;
    if (e.hitT > 0) e.hitT--;
    try { type.update(e); } catch (err) { e.dead = true; errorOnce(err); continue; } // a broken enemy is dropped
    if (!e.dead && !p.dead && !offStage(e)) {
      const c = typeof type.contact === 'function' ? type.contact(e) : type.contact || 'hurt';
      if (c === 'block') {
        // solid enemies push you back (jump over them!) but touching them doesn't hurt.
        // The hero's box is centred on p.x; a ride's box need not be, so it is pushed out by its edges.
        const tb = ebox(e), pb = pbox(p);
        if (overlap(pb, tb) && p.y > tb.y + 8) {
          if (!p.ride) p.x = p.x < e.x ? tb.x - pb.w / 2 : tb.x + tb.w + pb.w / 2;
          else p.x += pb.x + pb.w / 2 < tb.x + tb.w / 2 ? tb.x - (pb.x + pb.w) : tb.x + tb.w - pb.x;
          p.x = clamp(p.x, G.cam.x + 8, G.cam.x + W - 8); // a push never leaves the hero off screen
        }
      } else if (c === 'hurt' && overlap(pbox(p), ebox(e))) hurtPlayer();
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead && !(e.x < G.cam.x - 120 && !ENEMY_TYPES[e.type].boss));
}

// ============================================================
// Bullets, grenades, props, prisoners, items
// ============================================================
// Player bullets: { x, y, vx, vy, dmg, life, pierce?, update?(b), draw?(b), onHit?(b, e), onGround?(b), onProp?(b, o), onPow?(b, o) }
// onGround / onProp / onPow replace the default (sparks / hitProp / freePow); the bullet stops unless they return
// exactly true. A bullet whose own hook throws is dropped.
function updateBullets() {
  for (const b of G.pb) try { updateBullet(b); } catch (err) { b.life = 0; errorOnce(err); }
  G.pb = G.pb.filter(b => b.life > 0);
}
function updateBullet(b) {
  if (b.life <= 0) return; // dropped since the last update (its draw failed)
  if (b.update) { b.update(b); if (b.life <= 0) return; } // e.g. a rocket that exploded by itself
  b.x += b.vx; b.y += b.vy; b.life--;
  if (b.x < G.cam.x - 10 || b.x > G.cam.x + W + 10 || b.y < -10 || b.y > H) { b.life = 0; return; }
  const gy = groundAt(b.x);
  if (b.y >= gy) {
    if (b.onGround) { if (b.onGround(b) !== true) b.life = 0; }
    else { b.life = 0; sparks(b.x, gy - 1, 3, '#d9c79a'); }
    return;
  }
  for (const e of G.enemies) {
    if (!e.active || e.dead || (b.hits && b.hits.includes(e))) continue;
    if ((e.dying || e.state === 'dying') && !ENEMY_TYPES[e.type].boss) continue; // flies through a dying enemy (not a boss's wreck)
    if (inBox(b.x, b.y, ebox(e))) {
      if (b.onHit) b.onHit(b, e); else { damageEnemy(e, b.dmg); sparks(b.x, b.y); }
      if (!b.pierce) { b.life = 0; break; }
      (b.hits || (b.hits = [])).push(e); // piercing shots hit each enemy once
    }
  }
  if (b.life <= 0) return;
  for (const o of G.props) {
    const pb = !o.dead && propBox(o);
    if (pb && inBox(b.x, b.y, pb)) {
      if (b.onProp) { if (b.onProp(b, o) !== true) b.life = 0; }
      else { hitProp(o, b.dmg, 'bullet'); b.life = 0; }
      break;
    }
  }
  if (b.life <= 0) return;
  for (const o of G.pows) {
    if (o.state !== 'tied' || !inBox(b.x, b.y, powBox(o))) continue;
    if (b.onPow) { if (b.onPow(b, o) !== true) b.life = 0; }
    else { freePow(o); b.life = 0; }
    break;
  }
  if (b.life <= 0) return;
  for (const s of G.eb) {
    if ((s.shoot || (EB_TYPES[s.k] && EB_TYPES[s.k].shootable)) && Math.hypot(s.x - b.x, s.y - b.y) < 8) { s.life = 0; boom(s.x, s.y, 0.4); b.life = 0; break; }
  }
}

// Enemy projectiles: built-in kinds below, new kinds in EB_TYPES[k] = { r, update?, draw, onGround?, onHit?, shootable? }.
// A kind that is neither is dropped with a warning (it would be invisible but still hurt), one whose hook throws too.
const EB_BUILTIN = new Set(['laser', 'orb', 'mg', 'shell', 'bomb', 'mup', 'mdown', 'wave']);
function updateEnemyBullets() {
  const pb = G.p.dead ? null : pbox(G.p);
  for (const b of G.eb) try { updateEnemyBullet(b, pb); } catch (err) { b.life = 0; errorOnce(err); }
  G.eb = G.eb.filter(b => b.life > 0);
}
function updateEnemyBullet(b, pb) {
  if (b.life <= 0) return; // shot down or dropped since the last update
  const type = EB_TYPES[b.k];
  if (!type && !EB_BUILTIN.has(b.k)) { warnOnce('enemy projectile', b.k); b.life = 0; return; }
  if (type && type.update) type.update(b);
  b.x += b.vx; b.y += b.vy; if (b.g) b.vy += b.g; b.life--;
  if (b.k === 'wave' && G.t % 3 === 0) G.parts.push({ type: 'smoke', x: b.x, y: groundAt(b.x) - 3, vx: 0.5, vy: -0.4, life: 20, max: 20, size: 3 });
  if (b.k === 'mup' && b.y < -20) b.life = 0;
  if (pb && b.life > 0) {
    const hit = b.k === 'wave' ? overlap({ x: b.x - 6, y: groundAt(b.x) - 12, w: 12, h: 12 }, pb) : distToBox(b.x, b.y, pb) < (b.r != null ? b.r : type ? type.r : 3);
    if (hit) {
      hurtPlayer();
      if (type) { if (type.onHit) type.onHit(b); }
      else if (b.k === 'shell' || b.k === 'bomb' || b.k === 'mdown') boom(b.x, b.y, 0.6);
      if (b.k !== 'wave') b.life = 0;
    }
  }
  if (b.life > 0 && b.k !== 'wave') {
    const gy = groundAt(b.x);
    if (b.y >= gy) {
      if (type) { if (!(type.onGround && type.onGround(b) === true)) b.life = 0; } // onGround returns true to keep it (bounce)
      else {
        if (b.k === 'shell' || b.k === 'mdown') blast(b.x, gy - 4, 18, 0, 'enemy');
        else if (b.k === 'bomb') blast(b.x, gy - 4, 16, 0, 'enemy');
        else sparks(b.x, gy - 1, 3, '#ff8a80');
        b.life = 0;
      }
    }
  }
  if (b.x < G.cam.x - 30 || b.x > G.cam.x + W + 30 || b.y > H) b.life = 0;
}

function updateGrenades() {
  for (const g of G.grenades) {
    g.vy += 0.18; g.x += g.vx; g.y += g.vy; g.t++;
    if (G.enemies.some(e => e.active && !e.dead && !offStage(e) && inBox(g.x, g.y, ebox(e)))) {
      g.done = true; blast(g.x, g.y, 30, 6, 'player'); continue;
    }
    const gy = groundAt(g.x);
    if (g.y >= gy - 2) {
      if (g.b === 0) { g.y = gy - 2; g.vy *= -0.45; g.vx *= 0.6; g.b = 1; }
      else { g.done = true; blast(g.x, gy - 6, 30, 6, 'player'); }
    }
    if (g.x > G.cam.x + W + 40 || g.x < G.cam.x - 40) g.done = true;
  }
  G.grenades = G.grenades.filter(g => !g.done);
}

// src: 'bullet' (player shot), 'player' (grenade / player blast) or 'barrel'
function hitProp(o, d, src) { if (!o.dead) PROP_TYPES[o.k].hit(o, d, src); }
// Shared prop damage: flash + click, true once the prop is broken
function propHurt(o, d) {
  o.hp -= d; o.hitT = 3;
  if (o.hp > 0) { Snd.hit(); return false; }
  return true;
}

function updateProps() {
  for (const o of G.props) {
    if (o.hitT > 0) o.hitT--;
    const type = PROP_TYPES[o.k];
    if (type.update) try { type.update(o); } catch (err) { o.dead = true; errorOnce(err); } // a broken prop is dropped
  }
  G.props = G.props.filter(o => !o.dead && o.x > G.cam.x - 60);
}

function freePow(o) {
  if (o.state !== 'tied') return;
  const k = POW_KINDS[o.kind];
  o.state = 'free'; o.t = 0;
  G.freed.add(o.id);
  G.texts.push({ x: o.x, y: o.y - 44, s: k.thanks || 'THANK YOU!', t: 80, c: '#ffe066' });
  addScore(500, o.x, o.y - 32);
  Snd.freed();
  if (k.onFree) k.onFree(o);
}

function updatePows() {
  const p = G.p;
  for (const o of G.pows) {
    o.t++;
    if (o.state === 'tied') {
      if (!p.dead && Math.abs(p.x - o.x) < 12 && Math.abs(p.y - o.y) < 20) freePow(o);
    } else if (o.state === 'free') {
      if (o.t === 24) o.state = 'salute';
    } else if (o.state === 'salute') {
      if (o.t === 40 && o.item != null) dropItem(o.item, o.x - 10, o.y - 14, -1);
      if (o.t >= 64) o.state = 'run';
    } else if (o.state === 'run') {
      const run = POW_KINDS[o.kind].run;
      if (run) run(o);
      else { o.x -= 2.2; o.y = groundAt(o.x); }
    }
  }
  G.pows = G.pows.filter(o => o.x > G.cam.x - 40);
}

function dropItem(k, x, y, dir) {
  if (!ITEMS[k]) { warnOnce('item', k); return; }
  G.items.push({ k, x, y, vx: dir * 0.6, vy: -2.5, onGround: false, t: 0 });
}

function updateItems() {
  const p = G.p;
  for (const it of G.items) {
    it.t++;
    if (!it.onGround) {
      it.vy = Math.min(it.vy + 0.2, 5);
      const py = it.y;
      it.y += it.vy; it.x += it.vx;
      land(it, py);
      if (it.onGround) it.vx = 0;
    }
    if (!p.dead && it.t > 10 && overlap(pbox(p), { x: it.x - 7, y: it.y - 14, w: 14, h: 14 })) {
      Snd.pickup(); ITEMS[it.k].collect(it, p); it.gone = true;
    }
  }
  G.items = G.items.filter(it => !it.gone && it.x > G.cam.x - 30);
}

// Letter crate pickups (H, B and the other weapon letters)
function letterBox(it, col, top, ink) {
  const x = Math.round(it.x), y = Math.round(it.y);
  RO(x - 6, y - 12, 12, 12, col); R(x - 6, y - 12, 12, 2, top);
  text(it.k, x - 2, y - 10, ink, 1, 'left', null);
  if (it.t % 40 < 6) R(x + 4, y - 15, 2, 2, '#ffffff');
}

ITEMS.H = {
  draw: it => letterBox(it, '#f4d03f', '#fff3a0', '#c0392b'),
  collect(it, p) {
    giveWeapon(p, 'hmg');
    G.texts.push({ x: it.x, y: it.y - 24, s: 'HEAVY MACHINE GUN!', t: 80, c: '#ffe066' });
    say('Heavy machine gun!', 0.7, 1);
  }
};
ITEMS.B = {
  draw: it => letterBox(it, '#58a55c', '#8fd18f', '#ffffff'),
  collect(it, p) {
    p.bombs = Math.min(30, p.bombs + 10);
    G.texts.push({ x: it.x, y: it.y - 24, s: '+10 GRENADES', t: 70, c: '#8be0a8' });
    say('Bombs!', 0.8, 1);
  }
};
ITEMS.heart = {
  draw: it => drawHeart(Math.round(it.x) - 7, Math.round(it.y) - 12, 2, true),
  collect(it, p) {
    if (p.hearts < 3) { p.hearts++; G.texts.push({ x: it.x, y: it.y - 24, s: '+1 HEART', t: 70, c: '#ff8a9a' }); }
    else addScore(500, it.x, it.y - 20);
  }
};
ITEMS.coin = {
  draw(it) {
    const x = Math.round(it.x), y = Math.round(it.y);
    RO(x - 4, y - 9, 8, 8, '#f1c40f'); R(x - 2, y - 8, 2, 5, '#fff6b0'); R(x + 2, y - 7, 1, 5, '#c79a0b');
  },
  collect: it => addScore(500, it.x, it.y - 20)
};

function updateFx() {
  for (const p of G.parts) {
    p.x += p.vx; p.y += p.vy;
    if (p.g) {
      p.vy += p.g;
      const gy = groundAt(p.x);
      if (p.y > gy && p.vy > 0) { p.y = gy; p.vy *= -0.35; p.vx *= 0.6; if (p.vr) p.vr *= 0.5; }
      if (p.vr) p.rot += p.vr;
    } else if (p.type === 'smoke' || p.type === 'dust') { p.vx *= 0.96; p.size += p.type === 'smoke' ? 0.07 : 0.03; }
    else if (p.type === 'fire') { p.vx *= 0.92; p.vy = p.vy * 0.92 - 0.03; }
    p.life--;
  }
  if (G.parts.length > 700) G.parts.splice(0, G.parts.length - 700);
  G.parts = G.parts.filter(p => p.life > 0);
  for (const r of G.rings) r.t++;
  G.rings = G.rings.filter(r => r.t < r.max);
  for (const t of G.texts) { t.t--; t.y -= 0.35; }
  G.texts = G.texts.filter(t => t.t > 0);
  for (const l of G.later) if (--l.t <= 0) { boom(l.x, l.y, l.s); l.done = true; }
  G.later = G.later.filter(l => !l.done);
  for (const m of G.markers) {
    m.t++;
    if (m.t === 50) G.eb.push({ k: 'mdown', x: m.x, y: -10, vx: 0, vy: 2, g: 0.25, r: 4, life: 200, shoot: true });
  }
  G.markers = G.markers.filter(m => m.t < 88);
}

// ============================================================
// Camera, locks, checkpoints
// ============================================================
function updateCamera() {
  const p = G.p;
  let maxCam = LV.end - W;
  const lk = G.locks.find(l => !l.done);
  if (lk) maxCam = Math.min(maxCam, lk.at);
  const target = p.x - W * 0.42;
  if (target > G.cam.x) G.cam.x = Math.min(G.cam.x + Math.min(target - G.cam.x, 4), maxCam);
  if (!p.dead) p.x = clamp(p.x, G.cam.x + 8, G.cam.x + W - 8);
}

// Camera locks: the screen stops scrolling at l.at until its waves are beaten
function updateLocks() {
  const l = G.locks.find(l => !l.done);
  if (!l) return;
  if (!l.active) {
    if (G.cam.x >= l.at - 0.5) {
      l.active = true; l.t = 0; l.queue = l.waves.map(w => ({ ...w }));
      if (l.boss) { G.warnT = 160; Music.play(LV.bossMusic || 'boss'); Snd.noise(1.5, 0.3, 300); }
    }
    return;
  }
  l.t++;
  for (let i = l.queue.length - 1; i >= 0; i--) {
    const w = l.queue[i];
    if (l.t < w.d) continue;
    // wave enemies enter just outside the screen edge (type.edge px, default 16); make(e, spec) gets the whole entry
    const off = (ENEMY_TYPES[w.t] || {}).edge || 16;
    const e = makeEnemy({ ...w, x: w.side > 0 ? G.cam.x + W + off : G.cam.x - off }, l);
    if (!e.dead) { e.active = true; e.facing = -w.side; G.enemies.push(e); }
    l.queue.splice(i, 1);
  }
  if (!l.queue.length && !G.enemies.some(e => e.lock === l)) {
    l.done = true;
    if (!l.boss) { G.goT = 180; Snd.select(); }
  }
}

function updatePlay() {
  if (tap('pause')) { G.state = 'pause'; return; }
  // A level can take over one play tick for a self-contained scene.
  // Pause above and music in update() still use the normal campaign controls.
  if (!G.intro && LV.updateScene && LV.updateScene()) { G.time++; return; }
  if (G.intro && LV.intro.update()) G.intro = false;
  if (!G.intro) G.time++;
  if (LV.beforePlayerUpdate) LV.beforePlayerUpdate();
  updatePlayer();
  if (G.intro) prevIntroKeys = { ...G.introKeys }; // what the player has seen: a key set after this is a new tap
  updateCamera();
  updateLocks();
  for (let i = G.section + 1; i < LV.sections.length; i++) {
    if (G.p.x >= LV.sections[i].x + 30) {
      G.section = i; G.checkpoint = LV.sections[i].x;
      G.banner = { s: LV.sections[i].name, t: 200 };
    }
  }
  updateEnemies();
  updateBullets();
  updateEnemyBullets();
  updateGrenades();
  updateProps();
  updatePows();
  updateItems();
  updateFx();
  if (G.banner && --G.banner.t <= 0) G.banner = null;
  if (G.big && --G.big.t <= 0) G.big = null;
  if (G.goT > 0) G.goT--;
  if (G.warnT > 0) G.warnT--;
  G.shake *= 0.88; if (G.shake < 0.2) G.shake = 0;
  if (G.sflash > 0) G.sflash = Math.max(0, G.sflash - 0.03);
  if (LV.update) LV.update();
  if (G.winT > 0 && --G.winT === 0) toWin();
}

// Fireworks over the end screens (one burst every n frames)
function fireworks(n) {
  G.endT++;
  updateFx();
  if (G.endT % n === 0) {
    const x = rand(40, W - 40), y = rand(30, 120), c = ['#ffe066', '#ff6b6b', '#6bd5ff', '#8be0a8', '#d7a6ef'][Math.random() * 5 | 0];
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, sp = rand(1, 2.4); G.fw.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 50, c }); }
    Snd.tone('triangle', rand(500, 900), 200, 0.25, 0.05);
  }
  for (const f of G.fw) { f.x += f.vx; f.y += f.vy; f.vy += 0.03; f.vx *= 0.98; f.life--; }
  G.fw = G.fw.filter(f => f.life > 0);
}

// ============================================================
// Main update
// ============================================================
function update() {
  G.t++;
  if (G.fade > 0) G.fade = Math.max(0, G.fade - 0.04);
  if (tap('mute')) Music.on = !Music.on;
  switch (G.state) {
    case 'title':
      if (tap('ok')) { G.state = 'missions'; G.level = clamp(G.level, 0, LEVELS.length - 1); G.fade = 1; Snd.select(); }
      break;
    case 'missions':
      if (G.lockT > 0) G.lockT--;
      if (tap('left') && G.level > 0) { G.level--; Snd.select(); }
      if (tap('right')) {
        if (G.level < LEVELS.length - 1) { G.level++; Snd.select(); }
        else { G.lockT = 30; Snd.tone('square', 140, 90, 0.12, 0.08); } // nothing (unlocked) further right: the padlock shakes
      }
      if (tap('ok')) { G.state = 'select'; G.lockT = 0; G.fade = 1; Snd.select(); } // the padlock shake ends here
      break;
    case 'select':
      if (tap('left') && G.hero !== 0) { G.hero = 0; Snd.select(); }
      if (tap('right') && G.hero !== 1) { G.hero = 1; Snd.select(); }
      if (tap('ok')) startGame();
      break;
    case 'play':
      updatePlay();
      break;
    case 'pause':
      if (tap('quit')) { saveBest(); Music.stop(); G.state = 'title'; G.fade = 1; } // the mission select opens on this mission
      else if (tap('pause') || tap('ok')) G.state = 'play';
      break;
    case 'over':
      G.overT--;
      updateFx();
      if (tap('ok') && G.overT < 570) continueGame();
      else if (G.overT <= 0) { G.state = 'title'; G.fade = 1; }
      break;
    case 'win':
      fireworks(22);
      if (G.endT > 120 && tap('ok')) {
        if (G.level + 1 < LEVELS.length) startMission(G.level + 1);
        else if (LEVELS.length > 1) { G.state = 'allclear'; G.endT = 0; G.fw = []; G.fade = 1; Snd.win(); say('All missions complete!'); }
        else { G.state = 'title'; G.fade = 1; } // the only mission (so far): play again, as before Mission 2 existed
      }
      if (G.endT < 90 && G.endT % 4 === 0) Snd.tone('square', 900, 900, 0.03, 0.04);
      if (G.endT === 40 || G.endT === 60 || G.endT === 80) Snd.pickup();
      break;
    case 'allclear':
      fireworks(12);
      if (G.endT === 72) { const m = LV.clearMusic || 'victory'; if (TRACKS[m]) Music.play(m); } // after the jingle
      if (G.endT > 120 && tap('ok')) { G.state = 'title'; G.level = 0; G.fade = 1; Music.stop(); } // a new adventure starts at Mission 1
      break;
  }
  if (G.state !== 'pause') Music.update();
}

// ============================================================
// Drawing: game objects (world space)
// ============================================================
// A prop, enemy or bullet whose draw throws is dropped (gone on the next update); the error goes on to main.js,
// which logs it and puts the canvas right
function drawProp(o) { FLASH = o.hitT > 0; try { PROP_TYPES[o.k].draw(o); } catch (err) { o.dead = true; throw err; } FLASH = false; }
function drawPow(o) { POW_KINDS[o.kind].draw(o); }
function drawItem(it) { ITEMS[it.k].draw(it); }
function drawEnemy(e) { try { ENEMY_TYPES[e.type].draw(e); } catch (err) { e.dead = true; throw err; } }

function drawPlayer() {
  const p = G.p;
  if (p.ride) { RIDES[p.ride.type].draw(p, p.ride); return; }
  if (p.hidden) return; // out of sight, e.g. still inside the house during Mission 2's intro
  if (p.inv > 0 && !p.dead && Math.floor(p.inv / 3) % 2) return;
  const pose = p.dead ? 'jump' : p.crouch ? 'crouch' : !p.onGround ? 'jump' : p.vx ? 'run' : 'idle';
  drawHero(HEROES[G.hero], p.x, p.y, p.facing, { pose, t: p.t, aim: p.aim, weapon: p.weapon, muzzle: p.muzzle, knife: p.knife, rot: p.dead ? p.rot : 0 });
}

function drawGrenades() {
  for (const g of G.grenades) { RO(Math.round(g.x) - 2, Math.round(g.y) - 3, 4, 5, '#3e6b35'); R(Math.round(g.x) - 1, Math.round(g.y) - 4, 2, 1, '#c0c0c0'); }
}

function drawPB(b) {
  if (b.draw) { try { b.draw(b); } catch (err) { b.life = 0; throw err; } return; }
  const x = Math.round(b.x), y = Math.round(b.y);
  if (Math.abs(b.vy) > Math.abs(b.vx)) { R(x - 1, y - 3, 3, 6, '#ffe066'); R(x, y - 2, 1, 4, '#ffffff'); }
  else { R(x - 3, y - 1, 6, 3, '#ffe066'); R(x - 2, y, 4, 1, '#ffffff'); }
}

function drawEB(b) {
  const type = EB_TYPES[b.k];
  if (type) { try { type.draw(b); } catch (err) { b.life = 0; throw err; } return; }
  const x = Math.round(b.x), y = Math.round(b.y);
  switch (b.k) {
    case 'laser': R(x - 3, y - 2, 6, 4, '#ff3b30'); R(x - 2, y - 1, 4, 2, '#ffd6d1'); break;
    case 'orb': {
      const c = G.t % 8 < 4 ? '#ff9f1c' : '#ff5e3a';
      R(x - 4, y - 3, 8, 6, c); R(x - 3, y - 4, 6, 8, c); R(x - 1, y - 1, 3, 3, '#fff6c2');
      break;
    }
    case 'mg': R(x - 3, y - 1, 6, 2, '#ffe066'); break;
    case 'shell': RO(x - 3, y - 3, 6, 6, '#3d3d3d'); R(x - 2, y - 2, 2, 2, '#9a9a9a'); break;
    case 'bomb': RO(x - 2, y - 3, 5, 7, '#2c3e50'); R(x - 2, y - 5, 5, 2, '#566573'); R(x, y + 1, 1, 1, G.t % 10 < 5 ? EVIL : '#2c3e50'); break;
    case 'mup': RO(x - 2, y - 6, 4, 10, '#d5d8dc'); R(x - 2, y - 6, 4, 2, '#e74c3c'); R(x - 1, y + 4, 2, 3 + (G.t % 3), '#ff9f1c'); break;
    case 'mdown': RO(x - 2, y - 5, 4, 10, '#d5d8dc'); R(x - 2, y + 3, 4, 2, '#e74c3c'); R(x - 1, y - 8 - (G.t % 3), 2, 3, '#ff9f1c'); break;
    case 'wave': {
      const k = G.t % 6 < 3, gy = Math.round(groundAt(b.x));
      R(x - 7, gy - 8, 14, 8, k ? '#ffe9a0' : '#ffd060'); R(x - 4, gy - 13, 8, 13, '#fff6d0'); R(x - 1, gy - 16, 2, 16, '#ffffff');
      break;
    }
  }
}

function drawMarkers() {
  for (const m of G.markers) {
    if (m.t < 0) continue;
    const on = Math.floor(m.t / 5) % 2 === 0, gy = groundAt(m.x);
    ctx.strokeStyle = on ? '#ff3b30' : '#ffe066'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(m.x, gy - 1, 10, 3, 0, 0, Math.PI * 2); ctx.stroke();
    if (on) text('!', m.x, gy - 18, '#ff3b30', 1, 'center');
  }
}

function drawFx() {
  for (const r of G.rings) {
    const k = r.t / r.max;
    ctx.strokeStyle = 'rgba(255,' + (200 - k * 120 | 0) + ',120,' + (1 - k) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.3 + k * 0.7), 0, Math.PI * 2); ctx.stroke();
  }
  for (const p of G.parts) {
    const k = p.life / p.max;
    if (p.type === 'fire') {
      const rr = p.size * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, (1 - k) * 1.3 + 0.15)));
      const x = Math.round(p.x), y = Math.round(p.y);
      if (k < 0.55) { ctx.fillStyle = k < 0.2 ? '#3b2f2f' : '#8a2a12'; circ(x, y, rr + 1); }
      ctx.fillStyle = k > 0.78 ? '#fffbe0' : k > 0.55 ? '#ffd23f' : k > 0.35 ? '#ff8c2e' : k > 0.2 ? '#d9431e' : '#4a3b3b';
      circ(x, y, rr);
      if (k > 0.45) { ctx.fillStyle = k > 0.7 ? '#ffffff' : '#fff1a0'; circ(x - rr * 0.25, y - rr * 0.25, rr * 0.45); }
    } else if (p.type === 'flash') {
      ctx.fillStyle = 'rgba(255,255,240,' + k.toFixed(2) + ')'; circ(p.x, p.y, p.size * (1.2 - k * 0.4));
    } else if (p.type === 'dust') {
      ctx.fillStyle = 'rgba(214,196,160,' + (k * 0.8).toFixed(2) + ')'; circ(Math.round(p.x), Math.round(p.y), p.size * (1.4 - k * 0.6));
    } else if (p.type === 'sprite') {
      ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y)); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, k * 4);
      ctx.drawImage(p.s.img, -Math.floor(p.s.w / 2), -Math.floor(p.s.h / 2));
      ctx.restore();
    } else if (p.type === 'smoke') {
      ctx.fillStyle = 'rgba(64,62,70,' + (Math.min(1, k * 1.5) * 0.5).toFixed(2) + ')';
      circ(Math.round(p.x), Math.round(p.y), p.size * 0.7);
    } else {
      ctx.fillStyle = p.c || '#ffe066';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }
  for (const t of G.texts) text(t.s, t.x, t.y, t.c, 1, 'center');
}
