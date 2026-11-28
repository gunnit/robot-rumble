#!/usr/bin/env node
// Mission 8 in a real browser (Chromium through Playwright), with the page's real canvas and real Web Audio.
// The harness plays the game in Node with a stand-in canvas and no sound, and paints every 15th frame only. So four
// things are never seen there: a sound call the browser refuses (it throws inside an enemy's update, and the engine
// drops that enemy), a canvas call that only the stand-in knows, a game painted every frame, and how long a frame
// really takes. This plays the built index.html:
//
//   1. THE SAME RUN. The harness bot plays Mission 8 in Node (seed 1, Mathias) and its keys are written down
//      (keys-rec.js). The browser gets the same random numbers and the same keys, frame by frame, with sound on,
//      and paints every frame as a browser does. It must end as the Node run ended (time, hits per area, score,
//      lives), without one error, and must have played exactly the effect sounds the Node run asked for
//      (audio-check.js counts them there). Every frame is timed (update and picture), and pictures of the same
//      frames from both are compared pixel by pixel.
//      Two things make the two runs one: painting takes its random numbers from a generator of its own on both sides
//      (paint-apart.js: the engine's screen shake takes two per painted frame), and the page's sound takes its
//      from the browser's own. This run is therefore not the plain "seed 1" of the notes, but its own.
//   2. BY HAND. A fresh page, nothing changed: real key presses from the title screen through the mission select,
//      the hero select and the briefing into Mission 8, the opening scene to its end, then ten seconds of play in
//      real time. Counts the updates per second (60 expected) and the time a picture takes.
//
//   node tools/m8/browser-check.mjs [outdir]        (from the repo root; needs: python3 build.py, and Playwright:
//                                                    npm i -D playwright && npx playwright install chromium)
// Exit code 1 when a check fails. Pictures go to outdir (default tools/m8/work/browser). The times are those of
// this machine (here: headless Chromium, painting without a graphics card); they say what is slow, not how slow.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { boot } from '../mission4/runtime.mjs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('browser-check needs Playwright: npm i -D playwright && npx playwright install chromium'); process.exit(2); }
const { loadImage, createCanvas } = require('../harness/node_modules/@napi-rs/canvas');
const GAME = process.env.RR_GAME || process.cwd(), HTML = path.join(GAME, 'index.html');
const OUT = process.argv[2] || path.join(GAME, 'tools/m8/work/browser');
const SEED = 1, HERO = 1;
let SHOTS = [150, 900, 2400, 4200, 6000, 7500, 9000, 10500];    // frames to compare as pictures (and two near the end)
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^(node|chromium)-\d+\.png$|^hand-.*\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f));
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + m); };
const info = m => console.log('info ' + m);

// ---------------------------------------------------------------------------------------------------------------------
// 0. the Node run and its keys
// ---------------------------------------------------------------------------------------------------------------------
let ref, keys, nodeSfx;
const X = f => path.join(GAME, 'tools/m8', f);
{
  const args = [path.join(GAME, 'tools/harness/harness.mjs'), 'sim', '--level', '8', '--seed', String(SEED), '--hero', String(HERO), '--html', HTML,
    '--extra', X('keys-rec.js'), '--extra', X('paint-apart.js'), '--extra', X('audio-check.js')];
  const tmp = path.join(OUT, 'node-run.txt');
  const outFd = fs.openSync(tmp, 'w');
  let stdout;
  try { stdout = execFileSync('node', args, { cwd: GAME, env: { ...process.env, RR_GAME: GAME }, stdio: ['ignore', 'pipe', outFd], maxBuffer: 1 << 26 }).toString(); } finally { fs.closeSync(outFd); }
  ref = JSON.parse(stdout);
  const lines = fs.readFileSync(tmp, 'utf8').split('\n');
  const line = lines.find(l => l.startsWith('KEYS '));
  if (!line) { console.error('the Node run did not end (no KEYS line): ' + JSON.stringify(ref).slice(0, 300)); process.exit(1); }
  keys = JSON.parse(line.slice(5));
  const au = /^AUDIO done (\d+) tones, (\d+) noises .*\(effects (\d+) and (\d+),.*odd calls (\d+)/.exec(lines.find(l => l.startsWith('AUDIO done ')) || '');
  if (!au) { console.error('the Node run has no AUDIO done line'); process.exit(1); }
  nodeSfx = { tone: +au[3], noise: +au[4], odd: +au[5] };
  info('Node: ' + ref.seconds + ' s, hits ' + ref.hitsBySection.join(' ') + ', ' + ref.deaths + ' lives lost, score ' + ref.score + ', freed ' + ref.freed + ', ' + keys.frames + ' frames, ' + keys.rows.length + ' key changes, ' +
    nodeSfx.tone + ' effect tones and ' + nodeSfx.noise + ' effect noises');
  ok(ref.completed && ref.state === 'win' && !ref.errors.length && !ref.warnings.length && nodeSfx.odd === 0, 'the Node run wins without an error, a warning or an odd sound call');
}
// the pictures of the same frames from Node (the stand-in canvas): the keys played back, painted every frame
SHOTS = [...new Set([...SHOTS.filter(f => f < keys.frames - 800), keys.frames - 700, keys.frames - 200])];
const rowAt = new Map(keys.rows.map(r => [r[0], r]));
{
  const g = boot(SEED, HTML);
  g.run(fs.readFileSync(X('paint-apart.js'), 'utf8'));
  g.run('devStart({ level: 8, hero: ' + HERO + ' })');
  g.run('window.__hits = []; dbg.onHurt = s => { window.__hits[s] = (window.__hits[s] || 0) + 1; };');
  const K = g.get('keys'), Pr = g.get('pressed'), upd = g.get('update'), drw = g.get('draw');
  for (let f = 0; f < keys.frames; f++) {
    const r = rowAt.get(f);
    if (r) { for (const k in K) K[k] = false; if (r[1]) for (const k of r[1].split(',')) K[k] = true; }
    for (const k in Pr) delete Pr[k];
    if (r && r[2]) for (const k of r[2].split(',')) Pr[k] = true;
    upd();
    for (const k in Pr) delete Pr[k];
    drw();
    if (SHOTS.includes(f)) fs.writeFileSync(path.join(OUT, 'node-' + String(f).padStart(5, '0') + '.png'), g.canvas.toBuffer('image/png'));
  }
  const end = JSON.parse(g.run("JSON.stringify({ state: G.state, time: G.time, score: G.score, freed: G.freed.size, hits: Array.from({ length: LV.sections.length }, (_, i) => window.__hits[i] || 0) })"));
  ok(end.state === 'win' && end.score === ref.score && Math.round(end.time / 6) / 10 === ref.seconds && end.freed === ref.freed && end.hits.join(' ') === ref.hitsBySection.join(' ') && !g.errors.length && !g.warnings.length,
    'the keys played back in Node, painted every frame, end as the run did (' + end.state + ', ' + (end.time / 60).toFixed(1) + ' s, hits ' + end.hits.join(' ') + ', score ' + end.score + ')' + (g.errors.length ? ' ' + g.errors[0] : ''));
}

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const watch = (page, bag) => {
  page.on('pageerror', e => bag.push('pageerror: ' + (e && e.stack || e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') bag.push(m.type() + ': ' + m.text()); });
};
const png = async (file) => { const img = await loadImage(file); const c = createCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height); };

// ---------------------------------------------------------------------------------------------------------------------
// 1. the same run in the browser, with sound, painted every frame
// ---------------------------------------------------------------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const bag = []; watch(page, bag);
  // the harness's random numbers (mulberry32) for the game; no frame loop of its own (the playback steps the game)
  await page.addInitScript(seed => {
    window.__native = Math.random;
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    window.requestAnimationFrame = () => 0;
  }, SEED);
  await page.goto('file://' + HTML);
  await page.waitForFunction("typeof devStart === 'function' && typeof Snd === 'object'");
  await page.evaluate(() => {
    // sound draws its noise from the browser's own generator, so that the game's numbers stay the harness's
    for (const k of ['init', 'noise']) { const f = Snd[k]; Snd[k] = function (...a) { const r = Math.random; Math.random = window.__native; try { return f.apply(this, a); } finally { Math.random = r; } }; }
  });
  await page.addScriptTag({ path: X('paint-apart.js') });          // and painting from one of its own, as in the Node run
  await page.evaluate(n => {
    window.__hits = []; dbg.onHurt = s => { window.__hits[s] = (window.__hits[s] || 0) + 1; };
    window.__stat = { n: 0, upd: new Float32Array(n), drw: new Float32Array(n), at: new Int32Array(n), deaths: 0, wasDead: false, sfxTone: 0, sfxNoise: 0, musTone: 0, musNoise: 0, tracks: {} };
    for (const k of ['tone', 'noise']) {
      const f = Snd[k];
      Snd[k] = function (...a) {
        const bus = k === 'tone' ? a[6] : a[4];
        if (Snd.ac) window.__stat[(bus && bus === Snd.musBus ? 'mus' : 'sfx') + (k === 'tone' ? 'Tone' : 'Noise')]++;
        return f.apply(this, a);
      };
    }
    const mp = Music.play; Music.play = function (name) { window.__stat.tracks[name] = (window.__stat.tracks[name] || 0) + 1; return mp.apply(this, arguments); };
  }, keys.frames);
  await page.keyboard.press('ShiftLeft');                        // a real key: the page's own listener starts the sound
  const snd = await page.evaluate(() => ({ ac: !!Snd.ac, state: Snd.ac && Snd.ac.state, rate: Snd.ac && Snd.ac.sampleRate }));
  ok(snd.ac && snd.state === 'running', 'a key press starts the sound (AudioContext ' + snd.state + ', ' + snd.rate + ' Hz)');
  await page.evaluate(hero => { devStart({ level: 8, hero }); }, HERO);
  const CH = 300;
  for (let from = 0; from < keys.frames; from += CH) {
    const to = Math.min(keys.frames, from + CH);
    const rows = keys.rows.filter(r => r[0] >= from && r[0] < to);
    const res = await page.evaluate(({ from, to, rows, shots }) => {
      const at = new Map(rows.map(r => [r[0], r])), S = window.__stat, out = {};
      for (let f = from; f < to; f++) {
        const r = at.get(f);
        if (r) { for (const k in keys) keys[k] = false; if (r[1]) for (const k of r[1].split(',')) keys[k] = true; }
        for (const k in pressed) delete pressed[k];
        if (r && r[2]) for (const k of r[2].split(',')) pressed[k] = true;
        const t0 = performance.now(); update(); const t1 = performance.now();
        for (const k in pressed) delete pressed[k];
        draw(); const t2 = performance.now();
        S.upd[f] = t1 - t0; S.drw[f] = t2 - t1; S.at[f] = G.p ? G.p.x : -1; S.n++;
        const dead = !!(G.p && G.p.dead); if (dead && !S.wasDead) S.deaths++; S.wasDead = dead;
        if (shots.includes(f)) out[f] = document.getElementById('game').toDataURL('image/png');
      }
      return { shots: out };
    }, { from, to, rows, shots: SHOTS });
    for (const f in res.shots) fs.writeFileSync(path.join(OUT, 'chromium-' + String(f).padStart(5, '0') + '.png'), Buffer.from(res.shots[f].split(',')[1], 'base64'));
    await page.waitForTimeout(40);                               // let the sound scheduled so far play out
  }
  const end = await page.evaluate(() => {
    const S = window.__stat, n = S.n, sum = a => { let t = 0; for (let i = 0; i < n; i++) t += a[i]; return t; };
    const both = Array.from({ length: n }, (_, i) => S.upd[i] + S.drw[i]), sorted = [...both].sort((a, b) => a - b);
    const slow = both.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 6).map(([v, i]) => ({ f: i, ms: +v.toFixed(1), upd: +S.upd[i].toFixed(1), drw: +S.drw[i].toFixed(1), x: S.at[i] }));
    return { state: G.state, time: G.time, score: G.score, freed: G.freed.size, cont: G.continues, hits: Array.from({ length: LV.sections.length }, (_, i) => window.__hits[i] || 0),
      deaths: S.deaths, sfxTone: S.sfxTone, sfxNoise: S.sfxNoise, musTone: S.musTone, musNoise: S.musNoise, tracks: S.tracks, ac: Snd.ac.state, n,
      upd: sum(S.upd) / n, drw: sum(S.drw) / n, p99: sorted[Math.floor(n * 0.99)], max: sorted[n - 1], over: both.filter(v => v > 1000 / 60).length, slow,
      pictures: window.PAINTAPART.pictures, taken: window.PAINTAPART.taken };
  });
  ok(end.state === 'win', 'the browser run ends in the win screen (' + end.state + ')');
  ok(Math.round(end.time / 6) / 10 === ref.seconds && end.score === ref.score && end.freed === ref.freed && end.cont === ref.continues && end.deaths === ref.deaths && end.hits.join(' ') === ref.hitsBySection.join(' '),
    'and it is the Node run to the frame, painted every frame (' + end.pictures + ' pictures): ' + (end.time / 60).toFixed(1) + ' s, hits ' + end.hits.join(' ') + ', ' + end.deaths + ' lives lost, score ' + end.score + ', freed ' + end.freed);
  ok(bag.length === 0, 'no error and no warning from the page in the whole run' + (bag.length ? ': ' + bag.slice(0, 3).join(' | ').slice(0, 600) : ''));
  ok(end.sfxTone === nodeSfx.tone && end.sfxNoise === nodeSfx.noise && end.ac === 'running',
    'with sound: Web Audio took the ' + end.sfxTone + ' effect tones and ' + end.sfxNoise + ' effect noises the Node run asked for (' + nodeSfx.tone + ', ' + nodeSfx.noise + '), none refused');
  const tr = Object.keys(end.tracks);
  ok(['dinovalley', 'clubtail', 'dinochase', 'ogglerex', 'dinodawn'].every(t => tr.includes(t)) && end.musTone > 0 && end.musNoise > 0,
    'all five tunes of the mission were started (' + tr.join(', ') + '); ' + (end.musTone + end.musNoise) + ' notes of music went out (the music is timed by the clock, and this run was played fast)');
  info('browser: an update takes ' + end.upd.toFixed(3) + ' ms on average, a picture ' + end.drw.toFixed(2) + ' ms; a frame has 16.7 ms. Both together: 99 of 100 frames under ' + end.p99.toFixed(1) + ' ms, the longest ' + end.max.toFixed(1) + ' ms, ' + end.over + ' of ' + end.n + ' over 16.7 ms');
  info('the slowest frames: ' + end.slow.map(s => 'frame ' + s.f + ' (x ' + s.x + ') ' + s.ms + ' ms = update ' + s.upd + ' + picture ' + s.drw).join('; '));
  ok(end.upd + end.drw < 8, 'an update and a picture together take ' + (end.upd + end.drw).toFixed(2) + ' ms on average: under half a frame');
  // (the long ones: in the opening scene the mission paints its scenery ahead, which a start from the menus has
  //  mostly done before; later, about one picture in twenty carries the browser's own work for those before it,
  //  because this playback never rests. Part 2 measures the pace in real time.)
  // the pictures: Chromium's canvas against the harness's stand-in
  let worst = 0, worstAt = '';
  for (const f of SHOTS) {
    const a = path.join(OUT, 'node-' + String(f).padStart(5, '0') + '.png'), b = path.join(OUT, 'chromium-' + String(f).padStart(5, '0') + '.png');
    if (!fs.existsSync(a) || !fs.existsSync(b)) { ok(false, 'picture of frame ' + f + ' missing'); continue; }
    const A = await png(a), B = await png(b);
    let diff = 0, big = 0;
    for (let i = 0; i < A.data.length; i += 4) { const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2])); if (d > 0) diff++; if (d > 24) big++; }
    const pct = big / (A.data.length / 4) * 100;
    if (pct > worst) { worst = pct; worstAt = 'frame ' + f; }
    info('frame ' + String(f).padStart(5) + ': ' + diff + ' of ' + A.data.length / 4 + ' pixels differ at all, ' + big + ' clearly (' + pct.toFixed(2) + ' %)');
  }
  ok(worst < 1, 'the browser paints what the harness paints: at most ' + worst.toFixed(2) + ' % of a picture differs clearly (' + (worstAt || 'none') + ')');
  await page.close();
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. by hand: real keys from the title screen into Mission 8, in real time. Twice: a patient player, who looks at
//    every screen, and a hasty one, who hammers Enter and skips the opening scene (the mission paints its scenery
//    ahead on the menus and the briefing: the hasty one gives it the least time)
// ---------------------------------------------------------------------------------------------------------------------
async function byHand(hasty) {
  const who = hasty ? 'hasty: ' : '', page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const bag = []; watch(page, bag);
  await page.goto('file://' + HTML);
  await page.waitForFunction("typeof devStart === 'function' && window.bootInfo", null, { timeout: 60000 });
  await page.evaluate(() => {
    // every picture the page shows: how long after the one before, and what the game was showing
    window.__iv = []; let last = 0;
    const phase = () => G.state !== 'play' ? G.state : STORY.briefing() ? 'briefing' : G.intro ? 'scene' : 'play';
    const tick = now => { if (last) window.__iv.push([now - last, phase()]); last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const st = () => page.evaluate(() => ({ state: G.state, level: G.level, hero: G.hero, intro: !!G.intro, brief: !!STORY.briefing(), left: M8.queued(), x: G.p ? Math.round(G.p.x) : null, t: G.t }));
  const HOLD = hasty ? 34 : 60, GAP = hasty ? 34 : 400;
  const tapKey = async (k, ms = GAP) => { await page.keyboard.down(k); await page.waitForTimeout(HOLD); await page.keyboard.up(k); await page.waitForTimeout(ms); };
  // wait (in real time) until the page says so; false when it never does
  const waitFor = async (test, ms) => { for (let t = 0; t < ms; t += 50) { if (await page.evaluate(test)) return true; await page.waitForTimeout(50); } return false; };
  const shot = async name => { if (!hasty) await page.screenshot({ path: path.join(OUT, name) }); };
  if (!hasty) {
    const bootInfo = await page.evaluate(() => window.bootInfo);
    info('the loading bar took ' + (bootInfo.t1 - bootInfo.t0) + ' ms (' + bootInfo.frames + ' frames)');
    await page.waitForTimeout(1200);
  }
  ok((await st()).state === 'title', who + 'the page opens on the title screen');
  await tapKey('Enter');
  ok(await waitFor(() => G.state === 'missions', 2000), who + 'Enter: the mission select');
  for (let i = 0; i < 12 && (await st()).level < 7; i++) await tapKey('ArrowRight', hasty ? 34 : 150);
  ok((await st()).level === 7, who + 'Right, seven times: Mission 8 is chosen');
  if (!hasty) await page.waitForTimeout(500);
  await shot('hand-1-missions.png');
  await tapKey('Enter');
  ok(await waitFor(() => G.state === 'select', 2000), who + 'Enter: the hero select');
  if (!hasty) await page.waitForTimeout(400);
  await shot('hand-2-select.png');
  await tapKey('Enter');
  ok(await waitFor(() => G.state === 'play' && !!STORY.briefing(), 2000), who + 'Enter: the briefing of Mission 8 (THE OGGLE CASE FILE), the mission waiting behind it');
  if (!hasty) await page.waitForTimeout(2200);
  await shot('hand-3-briefing.png');
  // the briefing: one Enter shows all of its text, the next one starts the mission
  let s = await st();
  for (let i = 0; i < 40 && s.brief; i++) { await tapKey('Enter', hasty ? 34 : 500); s = await st(); }
  ok(s.state === 'play' && !s.brief && s.intro, who + 'Enter, twice: the mission starts with its opening scene');
  const leftAtStart = s.left;
  if (hasty) { await page.waitForTimeout(250); await tapKey('Enter', 0); }            // and skips it
  else { await page.waitForTimeout(2200); await shot('hand-4-opening.png'); }
  const over = await waitFor(() => !G.intro, 9000);
  s = await st();
  ok(over && s.state === 'play', who + (hasty ? 'Enter skips the opening scene and the hero is the player\'s' : 'the opening scene plays to its end by itself and hands over the hero') + ' (' + s.state + ', x ' + s.x + ')');
  info(who + 'pictures still to paint ahead: ' + leftAtStart + ' when the mission starts, ' + s.left + ' when the hero is the player\'s');
  const snd = await page.evaluate(() => ({ state: Snd.ac && Snd.ac.state, track: Object.keys(TRACKS).find(k => TRACKS[k] === Music.track) }));
  ok(snd.state === 'running' && snd.track === 'dinovalley', who + 'the sound runs and the valley\'s tune plays (' + snd.state + ', ' + snd.track + ')');
  // ten seconds of play: Right and X held
  await page.evaluate(() => {
    const d = draw, S = window.__rt = { draw: 0, n: 0, max: 0, t0: performance.now(), g0: G.t };
    draw = function () { const t = performance.now(); d(); const k = performance.now() - t; S.draw += k; S.n++; if (k > S.max) S.max = k; };
  });
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('KeyX');
  await page.waitForTimeout(5000);
  await shot('hand-5-play.png');
  await page.waitForTimeout(5000);
  await page.keyboard.up('ArrowRight'); await page.keyboard.up('KeyX');
  const rt = await page.evaluate(() => {
    const S = window.__rt, by = {};
    for (const [d, ph] of window.__iv) { const b = by[ph] || (by[ph] = { n: 0, late: 0, max: 0 }); b.n++; if (d > 25) b.late++; if (d > b.max) b.max = Math.round(d); }
    return { ups: (G.t - S.g0) / ((performance.now() - S.t0) / 1000), draw: S.draw / S.n, max: S.max, n: S.n, x: Math.round(G.p.x), hearts: G.p.hearts, state: G.state, by };
  });
  ok(rt.ups > 58 && rt.ups < 62, who + 'in real time the game makes ' + rt.ups.toFixed(1) + ' updates a second (60)');
  ok(rt.x > 400 && rt.state === 'play', who + 'the hero has walked to x ' + rt.x + ' with Right and X held (' + rt.hearts + ' hearts)');
  const P = rt.by.play || { n: 0, late: 0, max: 0 };
  ok(P.n > 500 && P.late / P.n < 0.02, who + 'the play is smooth from its first second: ' + P.late + ' of ' + P.n + ' pictures came late (over 25 ms; the longest wait ' + P.max + ' ms)');
  info(who + 'pictures that came late, by screen: ' + ['title', 'missions', 'select', 'briefing', 'scene', 'play'].filter(k => rt.by[k]).map(k => k + ' ' + rt.by[k].late + ' of ' + rt.by[k].n + ' (longest ' + rt.by[k].max + ' ms)').join(', ') +
    '; painting one takes ' + rt.draw.toFixed(2) + ' ms on average (longest ' + rt.max.toFixed(1) + ' ms)');
  ok(bag.length === 0, who + 'no error and no warning from the page' + (bag.length ? ': ' + bag.slice(0, 3).join(' | ').slice(0, 600) : ''));
  await page.close();
}
await byHand(false);
await byHand(true);
await browser.close();
console.log(fails ? fails + ' of ' + checks + ' checks FAILED' : 'ALL OK (' + checks + ' checks)');
process.exit(fails ? 1 : 0);
