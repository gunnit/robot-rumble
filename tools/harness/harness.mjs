#!/usr/bin/env node
// Robot Rumble headless test harness: runs the real game scripts (src/manifest.json order, or the inline
// script of an old single-file build with --legacy) in one vm context with stub browser globals and an
// @napi-rs/canvas canvas, then drives update()/draw() itself. See README.md next to this file.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const GAME = process.env.RR_GAME || '/Users/macbookair/game';
const W = 480, H = 270;

// ---------------------------------------------------------------- arguments
const [mode, ...rest] = process.argv.slice(2);
const opt = { extra: [], files: [] };
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith('--')) { opt.files.push(a); continue; }
  const k = a.slice(2);
  if (k === 'god') opt.god = true;
  else if (k === 'extra') opt.extra.push(rest[++i]);
  else opt[k] = rest[++i];
}
const num = (v, d) => v == null ? d : +v;
const level = num(opt.level, 1), hero = num(opt.hero, 0) ? 1 : 0;
const WARMUP = 200; // play frames before an end screen (win, over, allclear, pause) is forced
const sandbox = opt.sandbox ? opt.sandbox.split(',').filter(Boolean) : null;

// Deterministic Math.random (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- game context
function boot(seed) {
  const errors = [], warnings = [], seen = new Map(), files = new Set();
  const where = err => {
    for (const line of String(err && err.stack || '').split('\n')) {
      const m = /([\w./-]+\.(?:js|html)):(\d+)(?::\d+)?/.exec(line);
      if (m && files.has(m[1])) return m[1] + ':' + m[2];
    }
    return '?';
  };
  const record = (message, at) => {
    const k = message + '@' + at;
    if (seen.has(k)) { seen.get(k).count++; return; }
    const e = { message, at, count: 1 };
    seen.set(k, e); errors.push(e);
  };
  const fail = err => record(String(err && err.message || err), where(err));

  const store = {};
  const screen = createCanvas(W, H); screen.style = {};
  const sb = {
    console: {
      log: (...a) => process.stderr.write(a.join(' ') + '\n'),
      info: (...a) => process.stderr.write(a.join(' ') + '\n'),
      warn: (...a) => { const s = a.join(' '); if (!warnings.includes(s)) warnings.push(s); },
      // the game logs the errors it catches (errorOnce) with the Error itself: list those like thrown ones, with file:line
      error: (...a) => { const err = a.find(x => x && typeof x.stack === 'string'); if (err) fail(err); else record(a.map(String).join(' '), 'console.error'); }
    },
    document: {
      createElement: tag => { if (tag !== 'canvas') throw new Error('harness: createElement(' + tag + ')'); const c = createCanvas(1, 1); c.style = {}; return c; },
      getElementById: id => id === 'game' ? screen : null,
      addEventListener() {}, body: { appendChild() {} }
    },
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame() { return 0; },
    performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    innerWidth: 1440, innerHeight: 810,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { search: '', href: 'http://localhost/' }
  };
  const ctx = vm.createContext(sb);
  vm.runInContext('this.window = this;', ctx);
  if (seed != null) { sb.__rng = rng(seed); vm.runInContext('Math.random = __rng; delete this.__rng;', ctx); }

  const run = (code, filename, lineOffset = 0) => {
    files.add(filename);
    try { new vm.Script(code, { filename, lineOffset }).runInContext(ctx); } catch (err) { fail(err); }
  };
  const page = opt.legacy || opt.html;
  if (page) {
    // every inline <script> of a single-file build, in page order (line numbers match the .html)
    const html = fs.readFileSync(page, 'utf8'), re = /<script>([\s\S]*?)<\/script>/g;
    let m, n = 0;
    while ((m = re.exec(html))) { n++; run(m[1], path.basename(page), html.slice(0, m.index + '<script>'.length).split('\n').length - 1); }
    if (!n) throw new Error('no inline <script> in ' + page);
  } else {
    for (const f of JSON.parse(fs.readFileSync(path.join(GAME, 'src/manifest.json'), 'utf8'))) run(fs.readFileSync(path.join(GAME, 'src', f), 'utf8'), 'src/' + f);
  }
  for (const f of opt.extra) run(fs.readFileSync(f, 'utf8'), path.basename(f));

  const g = name => { try { return vm.runInContext(name, ctx); } catch (e) { return undefined; } };
  const call = (fn, ...a) => { try { return fn(...a); } catch (err) { fail(err); } };
  const has = name => vm.runInContext('typeof ' + name + " !== 'undefined'", ctx);
  // builds from before the engine refactor have no devStart: drive them through their own globals
  return { ctx, g, call, has, fail, errors, warnings, screen, legacy: !has('devStart') };
}

// Put the game into play: Mission `level` (or a sandbox) from its start (intro included), or built straight at
// world x (no intro, earlier locks done)
function start(env, { x = null, frames = 0, god = false } = {}) {
  const { g, call, legacy } = env;
  if (!legacy) return call(g('devStart'), { level, hero, x, god, sandbox, frames });
  if (sandbox) throw new Error('--sandbox needs the new build');
  if (level !== 1) throw new Error('the legacy build only has mission 1');
  const G = g('G');
  g('dbg').god = god;
  G.hero = hero;
  if (x == null) call(g('startGame'));
  else {
    // the old startGame() without its build at x 0, like devStart: same random numbers as the new build
    const cam = Math.max(0, Math.min(x - W * 0.42, g('LEVEL_END') - W));
    call(() => vm.runInContext('G.score = 0; G.lives = 3; G.time = 0; G.checkpoint = 0; G.freed = new Set(); G.continues = 0; G.fade = 1;' +
      'loadLevel(' + cam + "); G.state = 'play'; Music.play('main'); say('Mission start!');", env.ctx));
    G.p.x = x; G.p.y = g('GROUND');
  }
  steps(env, frames);
  call(g('draw'));
}

function steps(env, n, each) {
  const update = env.g('update'), pressed = env.g('pressed');
  for (let i = 0; i < n; i++) {
    if (each) each(i);
    env.call(update);
    for (const k in pressed) delete pressed[k];
  }
}

// ---------------------------------------------------------------- bot
const K = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'KeyZ', fire: 'KeyX', bomb: 'KeyC', ok: 'Enter' };

// Lava hops (Mission 3 copy of the harness; tools/harness/harness.mjs has no such code). Built only for a level with
// lava (LV.lava), so in Missions 1-2 the bot is exactly the one of tools/harness. Planned from the hero's physics
// (engine updatePlayer): walk 1.7 px/frame, a jump tap on the ground gives vy -5.4, then vy += 0.26 a frame, and a
// rising hero is cut to vy -2.6 when jump is let go (a full jump: ~56 px up, ~41 frames, ~70 px at full speed). The
// walking direction is set fresh every frame (no momentum), so the hero can be steered in the air. A platform is
// landed on when the feet fall through its top with x in (pl.x - 3, pl.x + w + 3), and kept while x stays in it.
// Supports = the banks (ground up to 4 px from a lava range: the bank drops steeply there) and the platforms over
// lava (basalt columns).
//  - On a support, walking toward its edge with lava ahead: at the edge, a full jump (jump held while rising) to the
//    next support that way, steered in the air to its middle (a bank: 14 px in). No support that way (the crater
//    lake): stop at the edge.
//  - In the air near lava without a plan (the bot's own jump every 42 frames, a knock-back, a lava bounce, a respawn):
//    carry on to the next support in the walking direction when a landing prediction (reach) says this jump still gets
//    there, else come down on the support below (walk on, but not off its ends), else (over the lava) go for the
//    reachable support ahead or behind.
//  - Targets: a robot down in the lava (a lava shark swimming/warning/surfacing) is skipped (level shots can't reach
//    it); only during a camera lock with nothing else on screen is it the target, and then the bot waits on its
//    column or bank by that river for the leap instead of chasing it.
// Everything else (aiming, firing, crouching, the jump every 42 frames) is the plain bot's: it still never dodges.
function makeHops(env, LV) {
  const { g } = env, G = g('G'), keys = g('keys'), groundAt = g('groundAt');
  const ET = env.has('ENEMY_TYPES') ? g('ENEMY_TYPES') : null;
  const lava = LV.lava.slice().sort((a, b) => a.x0 - b.x0);
  const lavaNear = (x, m) => lava.some(r => x >= r.x0 - m && x <= r.x1 + m);
  const sup = [];
  for (let i = 0; i < lava.length; i++) {
    const r = lava[i], prev = lava[i - 1], next = lava[i + 1];
    if (!prev) sup.push({ a: r.x0 - 400, b: r.x0 - 4, bank: true });
    const b = next ? next.x0 - 4 : LV.end;
    if (r.x1 + 4 < b) sup.push({ a: r.x1 + 4, b, bank: true });
  }
  for (const pl of LV.plats || []) {
    if (lava.some(r => pl.x + pl.w > r.x0 && pl.x < r.x1)) sup.push({ a: pl.x - 2, b: pl.x + pl.w + 2, pl, mid: pl.x + pl.w / 2 });
  }
  sup.sort((p, q) => p.a - q.a);
  const top = (s, x) => s.pl ? s.pl.y : groundAt(x);
  // where to come down on support s arriving going d: a column's middle, 14 px into a bank
  const aim = (s, d) => s.pl ? s.mid : d > 0 ? Math.min(s.a + 14, s.b - 4) : Math.max(s.b - 14, s.a + 4);
  const after = (x, d) => {   // the first support beyond x going d
    let best = null;
    for (const s of sup) if (d > 0 ? s.a > x && (!best || s.a < best.a) : s.b < x && (!best || s.b > best.b)) best = s;
    return best;
  };
  const standing = p => {      // the support a grounded hero is on
    if (p.onPlat) { const s = sup.find(q => q.pl === p.onPlat); if (s) return s; }
    let best = null, bd = Infinity;
    for (const s of sup) if (s.bank) { const d = p.x < s.a ? s.a - p.x : p.x > s.b ? p.x - s.b : 0; if (d < bd) { bd = d; best = s; } }
    return bd < 8 ? best : null;
  };
  // where the hero comes down steering for x tx with jump held from now on (the engine's order: walk + knock-back,
  // gravity, move, land): the support it lands on, or null for lava
  const reach = (p, tx) => {
    let x = p.x, y = p.y, vy = p.vy, kb = p.kb || 0;
    for (let i = 0; i < 150; i++) {
      const dx = tx - x;
      let vx = Math.abs(dx) > 1 ? Math.sign(dx) * 1.7 : 0;
      if (kb) { vx += kb; kb *= 0.85; if (Math.abs(kb) < 0.15) kb = 0; }
      vy = Math.min(vy + 0.26, 6);
      const py = y; x += vx; y += vy;
      if (vy >= 0) {
        for (const q of sup) {
          if (q.pl ? py <= q.pl.y + 0.01 && y >= q.pl.y && x > q.pl.x - 2 && x < q.pl.x + q.pl.w + 2
                   : x >= q.a && x <= q.b && y >= groundAt(x)) return q;
        }
      }
      const r = lava.find(q => x >= q.x0 && x <= q.x1);
      if ((r && y > r.y) || y > 300) return null;
    }
    return null;
  };
  let hop = null;   // { s: target support, tx: x to come down at, d, full: jump held while rising, state }
  const steer = (want, h) => {
    delete want[K.left]; delete want[K.right];
    if (h) want[h > 0 ? K.right : K.left] = true;
  };
  // want: the plain bot's keys for this frame; move: its walking direction; tap: this frame's key is only a turn
  const hopper = (want, move, tap) => {
    const p = G.p;
    if (!p || p.dead || p.ride || G.intro) { hop = null; return; }
    const h0 = want[K.right] && !want[K.left] ? 1 : want[K.left] && !want[K.right] ? -1 : 0;
    if (hop && hop.state === 'air' && p.onGround && hop.t > 1) hop = null;   // landed
    if (hop && hop.state === 'arm' && !p.onGround) hop.state = 'air';        // left the ground some other way
    if (p.onGround && (!hop || hop.state !== 'arm')) {
      hop = null;
      const s = standing(p), d = h0;
      if (!s || !d) return;
      const edge = d > 0 ? s.b : s.a, room = d * (edge - p.x);
      if (room > 3.4) return;
      const n = after(d > 0 ? s.b : s.a, d);
      const gap = n ? (d > 0 ? n.a - s.b : s.a - n.b) : Infinity;
      if (n && gap < 52 && !tap) hop = { s: n, tx: aim(n, d), d, full: true, state: 'arm', t: 0 };
      else { if (!tap || room <= 1.8) steer(want, 0); return; }
    }
    if (!hop) {
      // in the air with no plan (the jump every 42 frames, a knock-back, a lava bounce, a respawn)
      if (p.onGround || !lavaNear(p.x, 70)) return;
      let s = null;
      for (const q of sup) if (p.x >= q.a + 1 && p.x <= q.b - 1 && top(q, p.x) >= p.y - 1 && (!s || top(q, p.x) < top(s, p.x))) s = q;
      const d = move || p.facing || 1;
      // on to the next support the bot is walking toward when this jump still gets there (jump held from now on)
      const n = after(s ? (d > 0 ? s.b : s.a) : p.x, d);
      if (n && (move || !s) && reach(p, aim(n, d)) === n) hop = { s: n, tx: aim(n, d), d, full: true, state: 'air', t: 0 };
      else if (s) {
        // else come down on the support below: walk on as the bot wants, but not off its ends
        const lo = s.a + 5, hi = s.b - 5;
        if (p.x < lo) steer(want, 1);
        else if (p.x > hi) steer(want, -1);
        else if (h0 && (p.x + h0 * 1.7 < lo || p.x + h0 * 1.7 > hi)) steer(want, 0);
        return;
      } else {
        // over the lava: the support ahead, or behind, that this fall or bounce reaches (else the one ahead)
        const m = after(p.x, -d);
        const c = [n, m].filter(Boolean);
        const t = c.find(q => reach(p, aim(q, q.a > p.x ? 1 : -1)) === q) || c[0];
        if (!t) return;
        hop = { s: t, tx: aim(t, t.a > p.x ? 1 : -1), d, full: true, state: 'air', t: 0 };
      }
    }
    hop.t++;
    delete want[K.down];
    if (hop.state === 'arm') {
      // a fresh jump press (released for a frame first if jump is still held), then off with the walking key
      if (keys[K.jump]) { delete want[K.jump]; steer(want, 0); return; }
      want[K.jump] = true; steer(want, hop.d); hop.state = 'air'; hop.t = 0;
      return;
    }
    if (hop.full) { if (p.vy < 0) want[K.jump] = true; else delete want[K.jump]; }
    const dx = hop.tx - p.x;
    steer(want, Math.abs(dx) > 1 ? Math.sign(dx) : 0);
  };
  // A robot down in the lava (a lava shark swimming, warning or surfacing: anchored at or below the surface) is no
  // target: level shots can't reach it from a bank or a column, and walking up to it means standing over it until it
  // leaps (the plain bot stood on river 1's first column for minutes). The bot crosses on and shoots it once it leaps.
  // During a camera lock it is still the target when there is no other (the lock only opens when it is beaten): the
  // bot goes and stands over it.
  hopper.chase = () => G.locks.some(l => l.active && !l.done);
  hopper.near = (p, e) => lava.some(r => e.x >= r.x0 && e.x <= r.x1 && p.x > r.x0 - 30 && p.x < r.x1 + 30);
  hopper.sunk = e => {
    if (ET && ET[e.type] && ET[e.type].boss) return false;
    const r = lava.find(q => e.x >= q.x0 && e.x <= q.x1);
    return !!r && e.y >= r.y - 1;
  };
  return hopper;
}

// The lighthouse bell solves environmental puzzles and counters charged attacks.
// Drive the same keyboard controls as the player, using the HUD's machine state.
function climbInputs(scene, jumpHeld, bellHeld) {
  const goal=scene.goal, x=scene.feet.x, inputs=[];
  if(goal.action==='ride')return inputs;
  const jump=goal.action==='jump'||goal.action==='board';
  const liningUp=jump && scene.grounded && Math.abs(goal.takeoffX-x)>2.5;
  const target=liningUp?goal.takeoffX:goal.landX;
  if(Math.abs(target-x)>2.5)inputs.push(target<x?'ArrowLeft':'ArrowRight');
  if(jump&&!liningUp&&(!scene.grounded||!jumpHeld))inputs.push('KeyZ');
  if(!jump&&Math.abs(target-x)<=2.5&&!bellHeld)inputs.push('KeyV');
  return inputs;
}

function makeLighthousePilot(env) {
  const { g } = env, G = g('G'), signal = g('L7Signal');
  const box = g('ebox'), distance = g('distToBox'), types = g('ENEMY_TYPES');
  const foes = g('L7Foes'), tower = g('L7Belfry'), keys = g('keys');
  const flight = [[3590,162],[3742,115],[3890,133],[4080,149],[4260,177],
    [4436,174],[4620,173],[4787,120],[4906,105],[5074,140]];
  return (want, p, frame) => {
    if (p.dead || G.intro) return true;
    const climb=tower&&tower.status();
    if(climb&&climb.active){
      for(const key of climbInputs(climb,keys.KeyZ,keys.KeyV))want[key]=true;
      return true;
    }
    if (G.winT) { want.KeyV = frame % 6 === 0; return true; }
    const st = signal.status(), x = p.x, y = p.y - 19;
    const ring = () => { if (!st.cooldown) want.KeyV = true; };
    const move = dx => { if (dx) want[dx < 0 ? K.left : K.right] = true; };
    if (p.ride) {
      const next = flight.find(([wx]) => wx > x);
      if (next && Math.abs(p.y - 5 - next[1]) > 1) want[p.y - 5 > next[1] ? K.up : K.down] = true;
      if ([4070,4775].some(wx => wx > x && wx - x < 76)) ring();
      return true;
    }
    let machine = null;
    if (!st.quay && x > 345 && x < 490) machine = 418;
    if (!st.aligned && x > 5680 && x < 5910) machine = st.angles[0] === 2 ? 5840 : 5744;
    if (st.coils < 2 && x > 7730 && x < 7950) machine = st.coils === 0 ? 7800 : 7880;
    want[K.fire] = true;
    if (machine !== null) {
      if (Math.abs(x - machine) > 6) move(machine - x); else ring();
      return true;
    }
    if (G.eb.some(b => b.life > 0 && Math.hypot(b.x - x, b.y - y) < 55)) ring();
    const tell = G.enemies.find(e => e.active && !e.dead && (foes.counterReady ? foes.counterReady(e) : e.state === 'tell') && distance(x, y, box(e)) <= 122);
    if (tell) ring();
    const lock = G.locks.find(l => l.active && !l.done);
    if (lock) {
      const boss = G.enemies.find(e => e.lock === lock && !e.dying && types[e.type].boss);
      if (boss && boss.state === 'tether') {
        const clasp = G.enemies.find(e => e.type === 'mantaClasp' && e.active && !e.dead);
        if (clasp) {
          const dx = clasp.x - x;
          if (Math.abs(dx) > 64 || (dx && p.facing !== Math.sign(dx))) move(dx);
          if (distance(x, y, box(clasp)) < 90) ring();
        }
        return true;
      }
      if (boss && distance(x, y, box(boss)) > 90) { move(boss.x - x); return true; }
      return false; // the normal combat bot aims, dodges and throws grenades
    }
    const keeper = G.pows.find(o => o.state === 'tied' && o.x < x + 74 && o.x >= G.cam.x + 10);
    if (keeper) {
      if (Math.hypot(keeper.x-x, keeper.y-15-y) < 84) ring();
      if (Math.abs(x - keeper.x) > 15) move(keeper.x - x);
      else if (keeper.y < p.y - 33) { want[K.up] = true; want[K.jump] = frame % 50 < 24; }
      return true;
    }
    want[K.right] = true; want[K.jump] = frame % 110 < 22;
    if ([1870,2390,2720].some(fan => x >= fan - 18 && x < fan + 6)) ring();
    return true;
  };
}

function makeBot(env) {
  const { g } = env, G = g('G'), keys = g('keys'), pressed = g('pressed'), ebox = g('ebox');
  const ET = env.has('ENEMY_TYPES') ? g('ENEMY_TYPES') : null, RIDES = env.has('RIDES') ? g('RIDES') : null;
  const flying = e => ET ? !!(ET[e.type] && ET[e.type].flying) : e.type === 'drone';
  // shots fly through a dying enemy that isn't a boss: nothing to aim at
  const ghost = e => !!ET && (e.dying || e.state === 'dying') && !(ET[e.type] && ET[e.type].boss);
  const open = e => !e.inv && !e.dying && e.state !== 'dying' && e.state !== 'intro'; // can be hurt right now
  let move = 1, turn = 0, aimUp = false, firing = false, wide = false, crouch = false, jumpT = 0;
  // rides: frames in position without hurting anything, frames left of getting out, frames before boarding again
  let rideT = 0, leaveT = 0, noRideT = 0, lastScore = 0;
  const seenHp = new WeakMap();
  const LVd = g('LV'), hops = LVd && Array.isArray(LVd.lava) && LVd.lava.length ? makeHops(env, LVd) : null;
  const lighthouse = LVd && LVd.mission === 'MISSION 7' && env.has('L7Signal') ? makeLighthousePilot(env) : null;
  const controls = Object.values(K);
  if (lighthouse) controls.push('KeyV');
  const set = want => {
    for (const code of controls) {
      if (want[code]) { if (!keys[code]) pressed[code] = true; keys[code] = true; }
      else keys[code] = false;
    }
  };
  return f => {
    const want = {};
    if (G.state === 'over') { if (G.overT < 560 && f % 20 === 0) want[K.ok] = true; set(want); return; }
    if (G.state !== 'play' || !G.p) { set(want); return; }
    const p = G.p, cam = G.cam.x;
    if (lighthouse && lighthouse(want, p, f)) { set(want); return; }
    if (noRideT > 0) noRideT--;
    if (leaveT > 0) {
      // getting out of a ride: Down held, Jump released and then pressed (a fresh press, so it counts as a tap)
      leaveT--; want[K.down] = true; if (leaveT < 3) want[K.jump] = true;
      set(want); return;
    }
    if (f % 6 === 0) {
      const ride = RIDES && !p.ride && !noRideT && G.props.find(o => RIDES[o.k] && !o.dead && o.x > cam && o.x < cam + W);
      let target = null, sunk = null;
      for (const e of G.enemies) {
        if (!e.active || e.dead || ghost(e) || e.x < cam || e.x > cam + W) continue;
        if (hops && hops.sunk(e)) { if (!sunk || Math.abs(e.x - p.x) < Math.abs(sunk.x - p.x)) sunk = e; continue; }
        if (!target || Math.abs(e.x - p.x) < Math.abs(target.x - p.x)) target = e;
      }
      if (!target && sunk && hops.chase()) target = sunk;
      // any damage done since the last look (an enemy losing hp, or score from a kill)
      let hurt = G.score > lastScore; lastScore = G.score;
      for (const e of G.enemies) { if (seenHp.has(e) && e.hp < seenHp.get(e)) hurt = true; seenHp.set(e, e.hp); }
      turn = 0; aimUp = false; wide = false; crouch = false;
      if (ride) { move = Math.sign(ride.x - p.x) || 1; firing = !!target; }
      else if (target) {
        const dx = target.x - p.x, dir = dx < 0 ? -1 : 1, b = ebox(target), line = p.y - 19, low = p.y - 11;
        const hits = y => y >= b.y && y <= b.y + b.h, ground = p.onGround && !p.onPlat;
        firing = true;
        if (p.facing !== dir) turn = dir;
        aimUp = flying(target) && Math.abs(dx) < 40 && target.y < p.y - 20;
        wide = b.w > 40;
        if (p.ride) {
          // a ride's gun is its own (crouching does nothing): drive up to the target, right under a flyer (Up swings
          // up a gun that can aim up). When nothing gets hurt for 1.5 s there, get out and fight on foot.
          move = Math.abs(dx) > (flying(target) ? 24 : 60) ? dir : 0;
          rideT = hurt || move || !open(target) ? 0 : rideT + 6;
          if (rideT >= 90) { rideT = 0; leaveT = 6; noRideT = 600; }
        } else {
          // shots fly level (feet-19, crouching feet-11): crouch for a short target the standing shot passes over
          // (e.g. just downhill), else walk toward a target above or below the bullet line (slopes, platforms, flyers)
          crouch = !aimUp && ground && !hits(line) && hits(low);
          move = !aimUp && !crouch && !hits(line) && (Math.abs(dx) > 24 || (ground && line < b.y)) ? dir : 0;
          // a lava dweller in a lock: wait for its leap on a column or the bank next to its river (it keeps its distance)
          if (target === sunk) move = hops.near(p, target) ? 0 : dir;
        }
      } else { move = 1; firing = false; }
      if (!p.ride || !target) rideT = 0;
    }
    if (turn && f % 6 === 0) want[turn > 0 ? K.right : K.left] = true;
    else if (move) want[move > 0 ? K.right : K.left] = true;
    if (firing) want[K.fire] = true;
    if (aimUp) want[K.up] = true;
    if (crouch && p.onGround) want[K.down] = true;
    if (f % 42 === 0) jumpT = crouch ? 0 : 10;
    if (jumpT > 0) { jumpT--; want[K.jump] = true; }
    if (wide && f % 150 === 0) want[K.bomb] = true;
    if (hops) hops(want, move, !!(turn && f % 6 === 0));
    set(want);
  };
}

// ---------------------------------------------------------------- modes
function sim() {
  const env = boot(opt.seed != null ? +opt.seed : null), { g, call } = env;
  const maxFrames = num(opt.frames, 30000);
  const hits = [];
  let deaths = 0, wasDead = false, frames = 0;
  start(env, { x: opt.x == null ? null : +opt.x, god: !!opt.god }); // --x: built at that x like render --x
  const G = g('G');
  if (env.legacy) {
    // the old build has no dbg.onHurt: count the hits that take a heart
    vm.runInContext('hurtPlayer = (orig => function () { const h = G.p.hearts; orig(); if (G.p.hearts < h) __hit(G.section); })(hurtPlayer);', Object.assign(env.ctx, { __hit: s => { hits[s] = (hits[s] || 0) + 1; } }));
  } else g('dbg').onHurt = s => { hits[s] = (hits[s] || 0) + 1; };
  const bot = makeBot(env), update = g('update'), draw = g('draw'), pressed = g('pressed');
  for (; frames < maxFrames; frames++) {
    bot(frames);
    call(update);
    for (const k in pressed) delete pressed[k];
    if (frames % 15 === 0) call(draw);
    const dead = !!(G.p && G.p.dead);
    if (dead && !wasDead) deaths++;
    wasDead = dead;
    if (G.state === 'win' || G.state === 'allclear' || G.state === 'title' || env.errors.length > 25) break;
  }
  const L = env.legacy ? { sections: g('SECTIONS') } : g('LV');
  const n = L && L.sections ? L.sections.length : 1;
  console.log(JSON.stringify({
    completed: G.state === 'win' || G.state === 'allclear', state: G.state, errors: env.errors,
    hitsBySection: Array.from({ length: n }, (_, i) => hits[i] || 0), deaths, continues: G.continues,
    seconds: Math.round(G.time / 6) / 10, frames, score: G.score, freed: G.freed.size, x: G.p ? Math.round(G.p.x) : null,
    ...(L && L.mission === 'MISSION 7' && env.has('L7Skiff') ? { pennants: g('L7Skiff').count() } : {}),
    level: sandbox ? 'sandbox' : level, warnings: env.warnings
  }, null, 1));
}

function render() {
  if (!opt.out) throw new Error('render needs --out file.png');
  const env = boot(opt.seed != null ? +opt.seed : 1), { g, call } = env;
  const scr = opt.screen, G = g('G');
  if (scr) {
    // win/allclear default to frame 150: past the Enter wait (endT > 120) with the blinking prompt shown
    const n = num(opt.frames, scr === 'win' || scr === 'allclear' ? 150 : 60);
    if (scr === 'missions' || scr === 'allclear') {
      if (env.legacy) { console.log(JSON.stringify({ out: null, note: 'the legacy build has no ' + scr + ' screen' })); return; }
    }
    if (scr === 'title' || scr === 'select' || scr === 'missions') { G.hero = hero; G.state = scr; steps(env, n); }
    else {
      // like real play: no intro running and 200 frames in, so the MISSION START band and area name are gone
      start(env, { god: true });
      G.intro = false;
      steps(env, WARMUP);
      if (scr === 'win') { call(g('toWin')); steps(env, n); }
      else if (scr === 'over') { G.state = 'over'; G.overT = 600; steps(env, n); }
      else if (scr === 'allclear') { G.state = 'allclear'; G.endT = 0; G.fw = []; steps(env, n); }
      else if (scr === 'pause') { steps(env, n); G.state = 'pause'; }
      else throw new Error('unknown screen ' + scr);
    }
    call(g('draw'));
  } else start(env, { x: opt.x == null ? null : +opt.x, frames: num(opt.frames, 60), god: !!opt.god });
  save(env.screen, opt.out, num(opt.scale, 3));
  console.log(JSON.stringify({ out: path.resolve(opt.out), errors: env.errors, warnings: env.warnings }));
}

function save(canvas, out, s) {
  const src = canvas.getContext('2d').getImageData(0, 0, W, H).data;
  const big = createCanvas(W * s, H * s), bctx = big.getContext('2d'), img = bctx.createImageData(W * s, H * s), d = img.data;
  for (let y = 0; y < H * s; y++) {
    const row = ((y / s) | 0) * W;
    for (let x = 0; x < W * s; x++) {
      const si = (row + ((x / s) | 0)) * 4, di = (y * W * s + x) * 4;
      d[di] = src[si]; d[di + 1] = src[si + 1]; d[di + 2] = src[si + 2]; d[di + 3] = 255;
    }
  }
  bctx.putImageData(img, 0, 0);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, big.toBuffer('image/png'));
}

// Pixel difference between two PNGs of the same size
async function diff() {
  const [a, b] = opt.files;
  if (!a || !b) throw new Error('diff needs two png files');
  const [ia, ib] = await Promise.all([loadImage(a), loadImage(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) { console.log(JSON.stringify({ same: false, reason: 'size' })); return; }
  const read = im => { const c = createCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
  const da = read(ia), db = read(ib);
  let n = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let i = 0; i < da.length; i += 4) {
    if (da[i] === db[i] && da[i + 1] === db[i + 1] && da[i + 2] === db[i + 2]) continue;
    n++;
    const p = i / 4, x = p % ia.width, y = (p / ia.width) | 0;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  console.log(JSON.stringify({ same: n === 0, pixels: n, box: n ? [x0, y0, x1, y1] : null }));
}

const modes = { sim, render, diff };
if (!modes[mode]) {
  console.error('usage: node harness.mjs sim|render|diff [options]  (see README.md)');
  process.exit(2);
}
await modes[mode]();
