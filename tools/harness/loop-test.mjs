#!/usr/bin/env node
// Check of main.js frame() run the browser way (requestAnimationFrame queue, performance.now), headless: errors
// that repeat every frame at 60-144 Hz, a one-off error inside save/clip, broken enemies / props / bullets, the
// clean loop against the original one, private names. See README.md (Main loop).
//   node loop-test.mjs [src|built]
import { createRequire } from 'module';
import fs from 'fs';
import vm from 'vm';
const HARN = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/\/$/, ''); // this folder
const require = createRequire(import.meta.url); // works on Windows paths too
const { createCanvas } = require('@napi-rs/canvas');
const GAME = process.env.RR_GAME || '/Users/macbookair/game', W = 480, H = 270;
const kind = process.argv[2] || 'src';
const out = [];
const ok = (c, m) => out.push((c ? 'ok   ' : 'FAIL ') + m);
const info = m => out.push('info ' + m);

function boot() {
  const rafs = [], errors = [];
  let now = 1000;
  const screen = createCanvas(W, H); screen.style = {};
  const sb = {
    console: { log() {}, info() {}, warn() {}, error: (...a) => errors.push(a.map(x => x && x.message ? x.message : String(x)).join(' ')) },
    document: { createElement: () => { const c = createCanvas(1, 1); c.style = {}; return c; }, getElementById: () => screen, addEventListener() {}, body: { appendChild() {} } },
    addEventListener() {}, removeEventListener() {}, requestAnimationFrame: f => { rafs.push(f); return rafs.length; },
    performance: { now: () => now }, innerWidth: 1440, innerHeight: 810,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { search: '', href: 'http://localhost/' }
  };
  const ctx = vm.createContext(sb);
  vm.runInContext('this.window = this; Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();', ctx);
  const run = (code, fn) => new vm.Script(code, { filename: fn }).runInContext(ctx);
  if (kind === 'built') { const html = fs.readFileSync(GAME + '/index.html', 'utf8'), re = /<script>([\s\S]*?)<\/script>/g; let m; while ((m = re.exec(html))) run(m[1], 'index.html'); }
  else for (const f of JSON.parse(fs.readFileSync(GAME + '/src/manifest.json', 'utf8'))) run(fs.readFileSync(GAME + '/src/' + f, 'utf8'), 'src/' + f);
  const ev = s => vm.runInContext(s, ctx);
  const px = () => screen.getContext('2d').getImageData(0, 0, W, H).data;
  // pump display frames at hz (one queued rAF callback per frame, like a browser)
  const pump = (n, hz = 60, each) => {
    for (let i = 0; i < n; i++) {
      const f = rafs.shift(); if (!f) return i;
      now += 1000 / hz + (i % 2 ? 0.3 : -0.3);
      if (each) each(i);
      f(now);
    }
    return n;
  };
  return { ev, pump, px, errors, rafs, screen, get now() { return now; } };
}
const lit = d => { let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 0) n++; return n; };
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; };
// pixels that differ outside the note box (W/2 - 93 .. W/2 + 93, H - 16 .. H - 4)
const diffOutsideNote = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    const p = i / 4, x = p % W, y = (p / W) | 0;
    if (x >= W / 2 - 93 && x < W / 2 + 93 && y >= H - 16 && y < H - 4) continue;
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
  }
  return n;
};
// the note: a dark red box at the bottom centre
const noteOn = d => { const i = ((H - 5) * W + W / 2 - 90) * 4; return d[i] > 80 && d[i] < 140 && d[i + 1] < 30 && d[i + 2] < 30; };

// 1. persistent errors the engine can't pin on an object (a level hook), at several display rates
for (const hz of [60, 75, 120, 144]) {
  for (const where of ['drawFront', 'update']) {
    const g = boot();
    g.ev('devStart({ level: 1, x: 900, god: true });');
    g.pump(30, hz);
    const ref = lit(g.px());
    g.ev(where === 'drawFront'
      ? 'LV.drawFront = function () { ctx.save(); ctx.translate(40, 40); ctx.beginPath(); ctx.rect(0, 0, 10, 10); ctx.clip(); ctx.globalAlpha = 0.2; FLASH = true; throw new Error("broken drawFront"); };'
      : 'LV.update = function () { throw new Error("broken LV.update"); };');
    const t0 = g.ev('G.t'), x0 = g.ev('G.p.x');
    g.ev('keys.ArrowRight = true;');
    g.pump(hz * 2, hz);
    g.ev('keys.ArrowRight = false;');
    const n = g.ev('G.t') - t0, d = g.px();
    ok(n >= 118 && n <= 121, `${hz} Hz, ${where} throwing every frame: ${n} updates in 2 s (120 expected)`);
    ok(g.errors.length === 1, `${hz} Hz, ${where}: logged once (${g.errors.length})`);
    ok(lit(d) > ref * 0.8, `${hz} Hz, ${where}: the picture stays (${lit(d)} lit px, ${ref} before)`);
    ok(g.ev('G.p.x') > x0 + 100, `${hz} Hz, ${where}: the hero keeps moving (x ${Math.round(x0)} -> ${Math.round(g.ev('G.p.x'))})`);
    ok(noteOn(d), `${hz} Hz, ${where}: the OOPS note is on the screen`);
  }
}

// 2. a failed draw inside save/translate/clip: state unwound, the next good frame is pixel-identical to a clean run
{
  const a = boot(), b = boot();
  for (const g of [a, b]) { g.ev('devStart({ level: 1, x: 1950, god: true });'); g.pump(20); }
  a.ev('var __n = 0, __f = LV.drawFront; LV.drawFront = function (cx) { if (++__n === 1) { ctx.save(); ctx.translate(13, 7); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 5, 5); ctx.clip(); ctx.globalAlpha = 0.3; FLASH = true; throw new Error("one-off"); } return __f.call(this, cx); };');
  a.pump(1); b.pump(1);
  const mid = diff(a.px(), b.px());
  a.pump(1); b.pump(1);
  const t = a.ev('JSON.stringify(ctx.getTransform ? [ctx.getTransform().a, ctx.getTransform().e, ctx.getTransform().f] : null)');
  ok(diffOutsideNote(a.px(), b.px()) === 0 && t === '[1,0,0]' && a.ev('ctx.globalAlpha') === 1 && a.ev('FLASH') === false,
    `one-off draw error inside save/translate/clip: next frame like a clean run except the note (${diff(a.px(), b.px())} px differ; ${mid} on the failed frame), transform ${t}, alpha 1, FLASH off`);
  a.pump(130); b.pump(130);
  ok(diff(a.px(), b.px()) === 0, `2 s later the note is gone: pixel-identical to a run without the error (${diff(a.px(), b.px())} px)`);
}

// 3. a broken enemy: dropped (draw or update), logged once, the rest of the frame goes on
for (const where of ['draw', 'update']) {
  const g = boot();
  g.ev('devStart({ level: 1, x: 900, god: true });'); g.pump(10);
  g.ev(`ENEMY_TYPES.r3bad = { hp: 5, contact: 'none', update(e) { if ('${where}' === 'update') throw new Error('r3 bad ${where}'); }, draw(e) { if ('${where}' === 'draw') { ctx.save(); ctx.translate(5, 5); throw new Error('r3 bad ${where}'); } }, box: e => ({ x: e.x - 5, y: e.y - 10, w: 10, h: 10 }) };
    var __b = makeEnemy({ t: 'r3bad', x: G.cam.x + 250 }); __b.active = true; G.enemies.push(__b);`);
  const ref = lit(g.px()), t0 = g.ev('G.t');
  g.pump(120);
  ok(g.ev('!G.enemies.includes(__b) && __b.dead') && g.errors.length === 1 && g.ev('G.t') - t0 >= 119 && lit(g.px()) > ref * 0.8,
    `an enemy whose ${where} throws: dropped, logged once (${g.errors.length}), updates ${g.ev('G.t') - t0}/120, picture kept`);
}

// 4. a broken prop update and a bullet whose update throws: dropped, the mission goes on (time keeps counting)
{
  const g = boot();
  g.ev('devStart({ level: 1, x: 900, god: true });'); g.pump(10);
  g.ev(`PROP_TYPES.r3prop = { box: () => null, hit() {}, update() { throw new Error('r3 prop'); }, draw() {} };
    var __o = makeProp({ k: 'r3prop', x: G.cam.x + 200 }); G.props.push(__o);
    G.pb.push({ x: G.p.x + 20, y: G.p.y - 19, vx: 3, vy: 0, dmg: 1, life: 60, update() { throw new Error('r3 bullet'); } });
    G.eb.push({ k: 'r3eb', x: G.p.x + 200, y: G.p.y - 60, vx: 0, vy: 0, life: 99 }); EB_TYPES.r3eb = { r: 3, update() { throw new Error('r3 eb'); }, draw() {} };`);
  const time0 = g.ev('G.time');
  g.pump(60);
  ok(g.ev('!G.props.includes(__o) && G.pb.every(b => !b.update) && !G.eb.some(b => b.k === "r3eb")') && g.errors.length === 3 && g.ev('G.time') - time0 >= 59,
    `broken prop / bullet / enemy projectile updates: each dropped and logged once (${g.errors.length}), play time still counts (+${g.ev('G.time') - time0})`);
}

// 5. Mission 1 unchanged by the loop: with no errors the new frame() matches the original loop (index-before-level2),
// frame for frame, at 60 and 144 Hz with the hero walking and shooting (draw() uses rand() while the screen shakes)
for (const hz of [60, 144]) {
  const a = boot(), b = boot();
  for (const g of [a, b]) g.ev('devStart({ level: 1, x: 250 });');
  b.ev(`var __last = 1000, __acc = 0; const __STEP = 1000 / 60;
    var oldFrame = function (now) { __acc += Math.min(now - __last, 100); __last = now; while (__acc >= __STEP) { update(); __acc -= __STEP; for (const k in pressed) delete pressed[k]; } draw(); };`);
  let worst = 0, now = 1000;
  for (let i = 0; i < 900; i++) {
    const hold = i % 200 < 150 ? 'keys.ArrowRight = true; keys.KeyX = i % 3 < 2;' : 'keys.ArrowRight = false; keys.KeyX = false;';
    for (const g of [a, b]) g.ev('var i = ' + i + '; ' + hold);
    now += 1000 / hz + (i % 2 ? 0.3 : -0.3);
    a.rafs.shift()(now);
    b.ev('oldFrame(' + now + ')');
    if (i % 30 === 29) worst = Math.max(worst, diff(a.px(), b.px()));
  }
  ok(a.ev('G.t') === b.ev('G.t') && a.ev('G.p.x') === b.ev('G.p.x') && a.ev('G.score') === b.ev('G.score') && worst === 0 && !a.errors.length,
    `${hz} Hz clean run, new loop vs original loop: G.t ${a.ev('G.t')}/${b.ev('G.t')}, x ${Math.round(a.ev('G.p.x'))}/${Math.round(b.ev('G.p.x'))}, score ${a.ev('G.score')}/${b.ev('G.score')}, max ${worst} px differ`);
}

// 6. private names: main.js and screens.js internals are not globals any more
{
  const g = boot();
  const names = ['frame', 'last', 'acc', 'STEP', 'resetCanvas', 'errorNote', 'sandboxLevel', 'devQuery', 'crown', 'pixelDisc', 'drawLockedPreview', 'drawPlainPreview', 'STAR7', 'pixelStar', 'selectCard', 'lockIcon', 'missionCard', 'bossOf', 'CARD_COLS', 'blinkOn', 'grenadeIcon', 'drawHUD', 'drawTitle', 'drawMissions'];
  const leaked = names.filter(n => g.ev(`typeof ${n} !== 'undefined'`));
  ok(!leaked.length, 'private screens/main names are not global (leaked: ' + leaked.join(',') + ')');
  const exp = ['draw', 'drawPlay', 'panel', 'logoText', 'drawStar', 'devStart', 'errorOnce', 'errorAt'].filter(n => g.ev(`typeof ${n} === 'undefined'`));
  ok(!exp.length, 'exports still global (missing: ' + exp.join(',') + ')');
}

console.log(out.join('\n'));
console.log(out.filter(l => l.startsWith('FAIL')).length ? 'SOME FAILED' : 'ALL OK');
