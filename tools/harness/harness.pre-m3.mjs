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
  const set = want => {
    for (const code of Object.values(K)) {
      if (want[code]) { if (!keys[code]) pressed[code] = true; keys[code] = true; }
      else keys[code] = false;
    }
  };
  return f => {
    const want = {};
    if (G.state === 'over') { if (G.overT < 560 && f % 20 === 0) want[K.ok] = true; set(want); return; }
    if (G.state !== 'play' || !G.p) { set(want); return; }
    const p = G.p, cam = G.cam.x;
    if (noRideT > 0) noRideT--;
    if (leaveT > 0) {
      // getting out of a ride: Down held, Jump released and then pressed (a fresh press, so it counts as a tap)
      leaveT--; want[K.down] = true; if (leaveT < 3) want[K.jump] = true;
      set(want); return;
    }
    if (f % 6 === 0) {
      const ride = RIDES && !p.ride && !noRideT && G.props.find(o => RIDES[o.k] && !o.dead && o.x > cam && o.x < cam + W);
      let target = null;
      for (const e of G.enemies) {
        if (!e.active || e.dead || ghost(e) || e.x < cam || e.x > cam + W) continue;
        if (!target || Math.abs(e.x - p.x) < Math.abs(target.x - p.x)) target = e;
      }
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
