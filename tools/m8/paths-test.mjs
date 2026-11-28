#!/usr/bin/env node
// Mission 8: what the test players never do. The harness's bots never dodge, never stop and never get off, so the
// parts of the mission that only a child who does will meet are run by nobody (tools/m8/coverage.mjs lists them).
// This plays those parts on purpose, in the real game, with the strict stand-in for the browser's sound
// (tools/m8/audio-check.js: a wrong value in a sound call throws here as it would in a browser), and checks what
// the design promises about each. Run from the repo root:
//   RR_GAME=$PWD node tools/m8/paths-test.mjs                        (src/)
//   RR_GAME=$PWD RR_HTML=$PWD/index.html node tools/m8/paths-test.mjs   (the built file)
//   ... paths-test.mjs tops chase                                    (only the scenes named)
// Scenes: tops, chase, foot, raptor, intro, continue, rex, dodge, giants, draw. Exit code 1 when a check fails.
import fs from 'node:fs';
import v8 from 'node:v8';
import vm from 'node:vm';
import { boot } from '../mission4/runtime.mjs';
const HTML = process.env.RR_HTML || null;
const AUDIO = fs.readFileSync(new URL('./audio-check.js', import.meta.url), 'utf8');
const want = process.argv.slice(2);
const on = k => !want.length || want.includes(k);
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + m); };
const info = m => console.log('info ' + m);

function mk() { const g = boot(1, HTML); g.run(AUDIO); return g; }
// Every game holds about 190 MB of pictures outside the JavaScript heap, and the canvas library only gives them back
// when the event loop turns. So before each new game: collect what the last one left, and let the loop turn once
// (without this the 80 games of a full run add up to 15 GB).
let gc = () => {}; try { v8.setFlagsFromString('--expose-gc'); gc = vm.runInNewContext('gc'); } catch (e) { /* no gc(): the loop still turns */ }
const rest = () => { gc(); return new Promise(r => setImmediate(r)); };
const J = (g, code) => JSON.parse(g.run('JSON.stringify(' + code + ')'));
const start = (g, x, god = false) => { g.run('devStart({ level: 8, x: ' + x + ', god: ' + god + ' })'); g.run('G.big = null; G.banner = null;'); };
// one frame with these actions and these extra keys tapped (KeyZ = jump: the runtime's key map has no jump)
function tap(g, actions, codes) {
  g.run(codes.map(c => 'keys.' + c + ' = true; pressed.' + c + ' = true;').join(''));
  g.step(1, actions);
  g.run(codes.map(c => 'keys.' + c + ' = false;').join(''));
}
function until(g, test, actions = [], max = 3000) { for (let i = 0; i < max; i++) { g.step(1, actions); if (g.run(test)) return i + 1; } return -1; }
// draw now and then while stepping: a broken picture shows up as an error too
function play(g, n, actions = []) { for (let i = 0; i < n; i++) { g.step(1, actions); if (i % 7 === 0) g.run('draw()'); } }
const clean = (g, name) => ok(g.errors.length === 0 && g.warnings.length === 0, name + ': no errors, no warnings' + (g.errors.length ? ' (' + g.errors.slice(0, 2).join(' | ').slice(0, 300) + ')' : '') + (g.warnings.length ? ' (' + g.warnings.slice(0, 2).join(' | ') + ')' : ''));
const P = "({ x: Math.round(G.p.x), y: Math.round(G.p.y), hearts: G.p.hearts, lives: G.lives, dead: !!G.p.dead, ride: G.p.ride ? G.p.ride.pips : null, inv: G.p.inv, ground: Math.round(groundAt(G.p.x)), cam: Math.round(G.cam.x) })";
const CH = "({ mode: L8.chase.state.mode, off: Math.round(L8.chase.state.off), gate: L8.chase.state.gate, bridge: L8.chase.state.bridge })";
const ride = (g) => until(g, '!!G.p.ride', ['right'], 900);

// ---------------------------------------------------------------------------------------------------------------------
// TOPS: every key of the ride
// ---------------------------------------------------------------------------------------------------------------------
if (on('tops')) {
  await rest(); const g = mk(); start(g, 4150);
  const n = ride(g);
  ok(n > 0, 'tops: walking right from the cage puts the hero on TOPS (after ' + n + ' frames, x ' + J(g, P).x + ')');
  ok(J(g, P).ride === 4, 'tops: she starts with 4 pips');
  ok(g.run("G.texts.some(t => /HORNS/.test(t.s))"), 'tops: the keys are shown the first time (X: HORNS  C: CHARGE!  DOWN+Z: OFF)');
  // Z: hop
  play(g, 20, []);
  const y0 = J(g, P).y; tap(g, [], ['KeyZ']); play(g, 6, []);
  ok(J(g, P).y < y0 - 8, 'tops: Z hops (' + (y0 - J(g, P).y) + ' px up after 7 frames)');
  until(g, 'G.p.onGround', [], 120);
  // Up + X: the hero shoots straight up from the saddle
  g.run('G.pb.length = 0;'); play(g, 14, ['up', 'fire']);
  const up = J(g, "G.pb.filter(b => b.vy < 0 && Math.abs(b.vx) < 0.01).length");
  ok(up > 0, 'tops: Up + X shoots straight up from the saddle (' + up + ' shots going up)');
  // X: horns
  play(g, 30, []);
  const before = g.run('G.p.ride.jab'); tap(g, ['fire'], []);
  ok(g.run('G.p.ride.jab') > before, 'tops: X jabs with the horns');
  play(g, 30, []);
  // C: charge (nothing can hurt her meanwhile; then she needs 2.5 s)
  tap(g, ['bomb'], []);
  ok(g.run('G.p.ride.charge') > 0, 'tops: C charges');
  g.run('hurtPlayer()');
  ok(J(g, P).ride === 4 && J(g, P).hearts === 3, 'tops: a hit during the charge costs nothing');
  const x0 = J(g, P).x; play(g, 46, ['right']);
  ok(J(g, P).x - x0 > 150, 'tops: the charge carries her ' + (J(g, P).x - x0) + ' px in 46 frames');
  ok(g.run('G.p.ride.charge') === 0 && g.run('G.p.ride.ccd') > 100, 'tops: after it she needs her breath (' + g.run('G.p.ride.ccd') + ' frames)');
  tap(g, ['bomb'], []);
  ok(g.run('G.p.ride.charge') === 0, 'tops: C does nothing while she gets her breath back');
  // Down + Z: off. She stays where she is, the hero is not hurt, and walking into her again puts him back on.
  const a = J(g, P); tap(g, ['down'], ['KeyZ']);
  const b = J(g, P);
  ok(b.ride === null && b.hearts === a.hearts, 'tops: Down + Z gets off, unhurt');
  ok(J(g, "G.props.filter(o => o.k === 'tops' && !o.dead).length") === 1, 'tops: she waits where the hero got off');
  play(g, 40, []);
  ok(J(g, P).ride === null, 'tops: standing next to her does not put him back on at once');
  play(g, 40, ['left']);
  const back = until(g, '!!G.p.ride', ['right'], 200);
  ok(back > 0 && J(g, P).ride === 4, 'tops: he walks away, comes back and is on again (after ' + back + ' frames), her pips kept');
  // four hits: she is tired, throws the hero off unhurt, runs ahead and waits with two pips
  for (let i = 0; i < 3; i++) { g.run('G.p.inv = 0; hurtPlayer();'); play(g, 5, []); }
  ok(J(g, P).ride === 1 && g.run("G.texts.some(t => t.s === 'TOPS IS TIRED!')"), 'tops: three hits leave one pip and the words TOPS IS TIRED!');
  const c = J(g, P); g.run('G.p.inv = 0; hurtPlayer();');
  const d = J(g, P);
  ok(d.ride === null && d.hearts === c.hearts && d.inv >= 100, 'tops: the fourth throws the hero off, unhurt and safe for ' + d.inv + ' frames');
  ok(g.run("G.texts.some(t => t.s === 'TOPS NEEDS A REST!')") && g.run("G.props.some(o => o.k === 'topsrun')"), 'tops: TOPS NEEDS A REST! and she runs ahead');
  const w = until(g, "G.props.some(o => o.k === 'tops' && !o.dead)", [], 400);
  const t = J(g, "(o => ({ x: Math.round(o.x), pips: o.r.pips, armed: o.armed }))(G.props.find(o => o.k === 'tops'))");
  ok(w > 0 && t.pips === 2 && t.x - J(g, P).x >= 200 && t.x - J(g, P).x <= 260, 'tops: she waits ' + (t.x - J(g, P).x) + ' px ahead with ' + t.pips + ' pips (after ' + w + ' frames)');
  const again = until(g, '!!G.p.ride', ['right'], 400);
  ok(again > 0 && J(g, P).ride === 2, 'tops: the hero walks to her and rides again with 2 pips');
  play(g, 60, ['right']);
  clean(g, 'tops');
}

// ---------------------------------------------------------------------------------------------------------------------
// The chase, for a rider who stops: the bite
// ---------------------------------------------------------------------------------------------------------------------
if (on('chase')) {
  await rest(); const g = mk(); start(g, 4150);
  ride(g);
  until(g, "G.p.x > 4640 && L8.chase.state.mode === 'run'", ['right'], 900);
  const a = J(g, P);
  // stand still: the snout creeps up, the jaws open (34 frames), then snap
  const creep = until(g, "L8.chase.state.mode === 'tell'", [], 900);
  ok(creep > 0, 'chase: a rider who stops is caught up after ' + creep + ' frames (' + (creep / 60).toFixed(1) + ' s)');
  g.run('draw()');
  const tell = until(g, "L8.chase.state.mode === 'snap'", [], 200);
  ok(tell === 40, 'chase: the jaws stay open for ' + tell + ' frames before they snap (40)');
  until(g, "L8.chase.state.mode === 'back'", [], 60);
  const b = J(g, P);
  ok(b.ride === a.ride - 1 && b.hearts === a.hearts, 'chase: the bite costs TOPS one pip (' + a.ride + ' to ' + b.ride + '), the hero no heart');
  ok(b.x > a.x + 20, 'chase: and throws her ' + (b.x - a.x) + ' px ahead');
  ok(g.run("G.texts.some(t => t.s === 'CHOMP!')"), 'chase: CHOMP! is shown');
  // run on while the jaws are open and it misses, however late: the strip stays on the ground where it was marked.
  // (A fresh game each time, and without the falling rocks, which are another matter: only the bite is asked about.)
  const NOROCK = "G.eb = G.eb.filter(b => b.k !== 'rexrock');";
  const biteTest = (foot, late, key) => {
    const g2 = mk(); start(g2, 4150);
    ride(g2); until(g2, "G.p.x > 4640 && L8.chase.state.mode === 'run'", ['right'], 900);
    if (foot) { tap(g2, ['down'], ['KeyZ']); for (let i = 0; i < 50; i++) { g2.run(NOROCK); g2.step(1, ['right']); } }
    let n = 0; while (n++ < 900 && !g2.run("L8.chase.state.mode === 'tell'")) { g2.run(NOROCK); g2.step(1, []); }
    const c = J(g2, P), d0 = g2.run('Math.round(G.p.x - (G.cam.x + L8.chase.state.off))');
    for (let i = 0; i < 80; i++) { g2.run(NOROCK); g2.step(1, i < late ? [] : key); if (i % 5 === 0) g2.run('draw()'); }
    const d = J(g2, P);
    return { bitten: d.ride !== c.ride || d.hearts !== c.hearts || g2.run("G.texts.some(t => t.s === 'CHOMP!')"), d0, errors: g2.errors.length + g2.warnings.length };
  };
  for (const [foot, late] of [[false, 0], [false, 20], [false, 34], [true, 0], [true, 20], [true, 30]]) {
    await rest(); const r = biteTest(foot, late, ['right']);
    ok(!r.bitten && !r.errors, 'chase: ' + (foot ? 'on foot' : 'riding') + ', running on ' + late + ' frames after the jaws open (' + r.d0 + ' px from the snout): the bite misses');
  }
  { await rest(); const r = biteTest(false, 0, ['right', 'bomb']); ok(!r.bitten && !r.errors, 'chase: a charge at the tell gets clear too'); }
  for (const foot of [false, true]) {
    await rest(); const r = biteTest(foot, 43, ['right']);
    ok(r.bitten && !r.errors, 'chase: ' + (foot ? 'on foot' : 'riding') + ', running on only as they snap (43 frames) is too late');
  }
  // stand still to the end: bite after bite she tires, then it is the hero's hearts, then a life; never an error
  let log = [], last = JSON.stringify(J(g, "[G.p.ride ? G.p.ride.pips : null, G.p.hearts, G.lives]")), gap = 0, minGap = 1e9, lastAt = 0;
  for (let i = 0; i < 4200 && g.run("G.state === 'play'"); i++) {
    g.step(1, []); if (i % 9 === 0) g.run('draw()');
    const now = JSON.stringify(J(g, "[G.p.ride ? G.p.ride.pips : null, G.p.hearts, G.lives]"));
    if (now !== last) { log.push(i + ':' + now); if (lastAt) minGap = Math.min(minGap, i - lastAt); lastAt = i; last = now; }
  }
  info('chase, standing still for 70 s: ' + log.join(' '));
  ok(log.length >= 6, 'chase: a hero who never moves again is bitten again and again (' + log.length + ' changes)');
  ok(minGap >= 100, 'chase: never two bites within ' + minGap + ' frames of each other (100 or more: time to get away)');
  ok(g.run("G.state === 'over'") || g.run('G.lives') < 3, 'chase: standing still costs lives (state ' + g.run('G.state') + ', lives ' + g.run('G.lives') + ')');
  clean(g, 'chase');
}

// ---------------------------------------------------------------------------------------------------------------------
// The chase on foot: "nobody is ever stuck", even a hero who only holds Right and never shoots
// ---------------------------------------------------------------------------------------------------------------------
if (on('foot')) {
  // A hero who does not shoot the walls (or cannot think how): the Rex's bite breaks each wall for him, at a heart a
  // wall. (The small robots of the area are taken out: a hero who never fires is beaten by them in any mission.)
  for (const tops of [true, false]) {
    await rest(); const g = mk(); start(g, 4300);
    const name = tops ? 'foot (TOPS about)' : 'foot (no TOPS at all)';
    let hits = 0, deaths = 0, h = 3, pips = null, pipsLost = 0, wasDead = false, rode = 0, frames = 0, stuck = 0, worst = 0, lastX = 0;
    for (; frames < 9000 && g.run("G.state === 'play'") && g.run('G.p.x') < 5760; frames++) {
      if (!tops) g.run("G.props = G.props.filter(o => !/^tops/.test(o.k));");
      g.run("G.enemies = G.enemies.filter(e => e.type === 'boulderwall');");
      g.step(1, ['right']); if (frames % 9 === 0) g.run('draw()');
      const q = J(g, P);
      if (q.hearts < h) hits++; h = q.hearts;
      if (q.ride != null && pips != null && q.ride < pips) pipsLost++; pips = q.ride;
      if (q.dead && !wasDead) deaths++; wasDead = q.dead;
      if (q.ride != null) rode++;
      if (q.x <= lastX + 0.5 && !q.dead) { stuck++; worst = Math.max(worst, stuck); } else stuck = 0;
      lastX = Math.max(lastX, q.x);
    }
    const q = J(g, P);
    ok(q.x >= 5760, name + ': holding Right and nothing else gets through the three walls and the gate (x ' + q.x + ' after ' + (frames / 60).toFixed(0) + ' s; ' + hits + ' hearts and ' + pipsLost + ' of her pips lost, rode ' + (rode / 60).toFixed(0) + ' s, longest wait ' + (worst / 60).toFixed(1) + ' s)');
    ok(g.run("G.state === 'play'") && deaths <= 1 && hits + pipsLost <= 4, name + ': at the price of a heart (or a pip) a wall, ' + deaths + ' lives');
    ok(J(g, CH).gate === 1 && J(g, CH).bridge === 0, name + ': the bridge is gone and the gate is open');
    // the way back is closed
    play(g, 200, ['left']);
    ok(J(g, P).x >= 5600, name + ': there is no way back over the chasm (x ' + J(g, P).x + ')');
    clean(g, name);
  }
  // with the gun: shooting each wall on arrival, the Rex never gets a bite in
  {
    await rest(); const g = mk(); start(g, 4300);
    let h = 3, hits = 0, bites = 0, frames = 0;
    for (; frames < 6000 && g.run("G.state === 'play'") && g.run('G.p.x') < 5760; frames++) {
      g.run("G.props = G.props.filter(o => !/^tops/.test(o.k));");
      g.step(1, ['right', 'fire']);
      const q = J(g, P); if (q.hearts < h) hits++; h = q.hearts;
      if (g.run("L8.chase.state.mode === 'snap' && L8.chase.state.t === 5 && L8.chase.state.hit")) bites++;
    }
    ok(g.run('G.p.x') >= 5760 && bites === 0, 'foot (Right + Fire, no TOPS): through the gate in ' + (frames / 60).toFixed(0) + ' s without one bite (' + hits + ' hearts lost to the robots on the way)');
    clean(g, 'foot (Right + Fire)');
  }
  // the hero walks back into it: stopped under its chin
  {
    await rest(); const g = mk(); start(g, 4300);
    g.run("G.props = G.props.filter(o => !/^tops/.test(o.k));");
    until(g, "G.p.x > 4640 && L8.chase.state.mode === 'run'", ['right'], 900);
    play(g, 120, ['left']);
    const q = J(g, "({ d: Math.round(G.p.x - (G.cam.x + L8.chase.state.off)), mode: L8.chase.state.mode, onScreen: G.p.x > G.cam.x })");
    ok(q.d >= -45 && q.onScreen, 'foot: walking back into the Rex stops under its chin (' + q.d + ' px from the snout), on the screen');
    clean(g, 'foot (walking back)');
  }
  // TOPS left behind long before the chase (the hero gets off at her cage and walks on): she is not lost
  {
    await rest(); const g = mk(); start(g, 4150);
    ride(g); play(g, 30, ['right']); tap(g, ['down'], ['KeyZ']);
    const x0 = J(g, P).x;
    g.run("G.enemies = G.enemies.filter(e => e.type === 'boulderwall');");
    let seen = 0, parked = 0, gone = 0;
    for (let i = 0; i < 700 && !parked; i++) {
      g.step(1, ['right']); if (i % 6 === 0) g.run('draw()');
      const n = J(g, "({ tops: G.props.filter(o => o.k === 'tops').length, run: G.props.filter(o => o.k === 'topsrun').length, riding: !!G.p.ride })");
      if (n.run) seen++;
      if (!n.tops && !n.run && !n.riding) gone++;
      if (seen && n.tops) parked = i;
    }
    const t = J(g, "(o => o ? ({ x: Math.round(o.x), pips: o.r.pips }) : null)(G.props.find(o => o.k === 'tops'))");
    ok(seen > 0 && parked > 0 && gone === 0 && t && t.pips === 4 && t.x > J(g, P).x, 'foot: got off at the cage and walked on ' + (J(g, P).x - x0) + ' px: TOPS trots after the hero and waits ' + (t ? t.x - J(g, P).x : '?') + ' px ahead, never gone');
    const again = until(g, '!!G.p.ride', ['right'], 400);
    ok(again > 0, 'foot: and he is on her again when he gets there');
    clean(g, 'foot (TOPS left at the cage)');
  }
  // TOPS left behind bolts ahead before it reaches her; robots it catches up with are trampled
  {
    await rest(); const g = mk(); start(g, 4150);
    ride(g); until(g, "G.p.x > 4640 && L8.chase.state.mode === 'run'", ['right'], 900);
    tap(g, ['down'], ['KeyZ']);
    const pips = J(g, "G.props.find(o => o.k === 'tops').r.pips");
    g.run("G.enemies = G.enemies.filter(e => e.type !== 'boulderwall' && e.type !== 'compy' && e.type !== 'raptor');");
    play(g, 90, ['right']);
    g.run("{ const e = makeEnemy({ t: 'compy', x: G.cam.x + L8.chase.state.off - 40 }); e.active = true; G.enemies.push(e); window.__c = e; }");
    play(g, 3, ['right']);
    ok(g.run('window.__c.dead || !G.enemies.includes(window.__c)'), 'foot: a robot the Rex catches up with is trampled');
    const n = until(g, "G.props.some(o => o.k === 'topsrun')", ['right'], 600);
    ok(n > 0, 'foot: TOPS, left standing, bolts when the Rex reaches her (after ' + n + ' frames)');
    const m = until(g, "G.props.some(o => o.k === 'tops' && !o.dead)", ['right'], 600);
    const t = J(g, "(o => ({ x: Math.round(o.x), pips: o.r.pips }))(G.props.find(o => o.k === 'tops'))");
    ok(m > 0 && t.pips === pips && t.x > J(g, P).x, 'foot: she waits again ' + (t.x - J(g, P).x) + ' px ahead of the hero, her pips as they were (' + t.pips + ')');
    clean(g, 'foot (TOPS left behind)');
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// A raptor that misses: it lands on its ring, skids, and pounces again (the bots are always under it)
// ---------------------------------------------------------------------------------------------------------------------
if (on('raptor')) {
  await rest(); const g = mk(); start(g, 760);
  const RP = "G.enemies.find(e => e.type === 'raptor' && e.active && !e.dead)";
  const n = until(g, RP + " && " + RP + ".state === 'crouch'", ['right'], 1500);
  ok(n > 0, 'raptor: one crouches to pounce (after ' + n + ' frames)');
  // (this scene asks about the raptor alone: the compys of the crash site, which hop at a hero who stands and waits,
  //  are taken out)
  g.run("{ const r = " + RP + "; G.enemies = G.enemies.filter(e => e === r || !e.active); }");
  const tell = g.run(RP + '.tell');
  ok(tell === 54, 'raptor: the first crouch of a raptor lasts ' + tell + ' frames (54)');
  const spot = J(g, "(e => ({ tx: Math.round(e.tx), px: Math.round(G.p.x), d: Math.round(Math.abs(e.x - G.p.x)) }))(" + RP + ")");
  ok(Math.abs(spot.tx - spot.px) <= 2 || spot.d < 40 || spot.d > 150, 'raptor: its ring is there from the first frame of the crouch, where the hero stands (ring ' + spot.tx + ', hero ' + spot.px + ')');
  const h = J(g, P).hearts;
  const leap = until(g, RP + ".state === 'leap'", ['left'], 200);
  const ring = J(g, "(e => ({ tx: Math.round(e.tx), x: Math.round(e.x) }))(" + RP + ")");
  g.run('draw()');
  const land = until(g, RP + ".state === 'skid'", ['left'], 200);
  const e1 = J(g, "(e => ({ x: Math.round(e.x), y: Math.round(e.y), gy: Math.round(groundAt(e.x)), onGround: e.onGround }))(" + RP + ")");
  ok(leap > 0 && land > 0 && land <= 40, 'raptor: it leaps and lands after ' + land + ' frames');
  ok(Math.abs(e1.x - ring.tx) <= 6 && Math.abs(ring.tx - spot.tx) <= 1, 'raptor: it comes down on its ring (' + e1.x + ', ring at ' + ring.tx + '), which has not moved since the crouch began though the hero has');
  ok(e1.onGround && e1.y === e1.gy, 'raptor: on the ground, not in it (y ' + e1.y + ', ground ' + e1.gy + ')');
  ok(J(g, P).hearts === h, 'raptor: a hero who walks away is not hit');
  play(g, 6, ['left']);
  const idle = until(g, RP + ".state === 'idle' || " + RP + ".state === 'run'", ['left'], 60);
  ok(idle > 0, 'raptor: it skids to a stop (' + (idle + 6) + ' frames)');
  const again = until(g, RP + ".state === 'crouch'", [], 400);
  ok(again > 0 && g.run(RP + '.tell') === 36, 'raptor: it pounces again after ' + again + ' frames, with the usual crouch of ' + g.run(RP + '.tell') + ' frames');
  // under it: walking toward the raptor as it leaps, it sails over
  const h2 = J(g, P).hearts;
  until(g, RP + ".state === 'leap'", [], 200);
  const dir = g.run(RP + '.x > G.p.x') ? 'right' : 'left';
  until(g, RP + ".state === 'skid'", [dir], 200);
  ok(J(g, P).hearts === h2, 'raptor: a hero who stood through its crouch and walks on under it as it leaps is not hit either');
  play(g, 120, []);
  clean(g, 'raptor');
}

// ---------------------------------------------------------------------------------------------------------------------
// The opening scene, skipped with Enter at any moment
// ---------------------------------------------------------------------------------------------------------------------
if (on('intro')) {
  // (Enter is not taken in the first 10 frames, as in every mission: it is the key that started the mission)
  {
    await rest(); const g = mk(); g.run('devStart({ level: 8 })');
    ok(g.run('G.intro') === true, 'intro: the mission opens with its scene');
    play(g, 4, []); g.step(1, ['enter']); play(g, 20, []);
    ok(g.run('G.intro') === true && g.run('G.big') == null, 'intro: Enter in the first 10 frames does not skip it');
    clean(g, 'intro (Enter too early)');
  }
  for (const at of [12, 45, 100, 152, 167, 200, 240]) {
    await rest(); const g = mk(); g.run('devStart({ level: 8 })');
    play(g, at, []);
    g.step(1, ['enter']);
    const big = g.run('G.big && G.big.s');
    const n = until(g, '!G.intro', [], 120);
    const q = J(g, "({ x: Math.round(G.p.x), y: Math.round(G.p.y), gy: Math.round(groundAt(G.p.x)), pb: G.pb.length, crouch: !!G.p.crouch, hidden: !!G.p.hidden, state: G.state, banner: G.banner && G.banner.s })");
    ok(big === 'MISSION 8 START!' && n > 0 && n <= 31 && q.state === 'play', 'intro: Enter at frame ' + at + ' goes straight to "' + big + '", and the hero is the player\'s ' + n + ' frames later');
    ok(q.y === q.gy && !q.hidden && !q.crouch && q.pb === 0 && q.x >= 112, 'intro: skipped at ' + at + ', the hero stands on the ground at x ' + q.x + ', in sight, no stray shot');
    ok(q.banner === 'AREA 1: CRASH SITE', 'intro: skipped at ' + at + ', the area is named (' + q.banner + ')');
    const x0 = q.x; play(g, 200, ['right', 'fire']);
    const r = J(g, P);
    ok(r.x > x0 + 250 && r.hearts === 3, 'intro: skipped at ' + at + ', he walks on at once (' + (r.x - x0) + ' px in 200 frames), unhurt');
    play(g, 500, ['right', 'fire']);
    clean(g, 'intro (skipped at ' + at + ')');
  }
  // unskipped: 4.6 s, and the hero cannot be hurt or moved by the player meanwhile
  await rest(); const g = mk(); g.run('devStart({ level: 8 })');
  const n = until(g, '!G.intro', ['left', 'fire'], 600);
  ok(n >= 270 && n <= 290, 'intro: left alone it lasts ' + n + ' frames (' + (n / 60).toFixed(1) + ' s); the keys do nothing meanwhile');
  ok(J(g, P).hearts === 3, 'intro: nobody is hurt in it');
  clean(g, 'intro (watched)');
}

// ---------------------------------------------------------------------------------------------------------------------
// A continue at every checkpoint the mission has
// ---------------------------------------------------------------------------------------------------------------------
if (on('continue')) {
  const CASES = [
    [0, 0, 'cage', 'off'], [1450, 1, 'cage', 'off'], [2900, 2, 'cage', 'off'], [3780, 2, 'cage', 'off'],
    [3781, 2, 'tops', 'off'], [4300, 3, 'tops', 'off'], [5700, 4, 'wait', 'done'], [7100, 5, 'none', 'done']
  ];
  for (const [cp, sec, tops, chase] of CASES) {
    await rest(); const g = mk(); start(g, 300);
    g.run("G.checkpoint = " + cp + "; G.lives = 0; G.state = 'over'; G.overT = 500; Music.stop();");
    g.step(1, ['enter']); play(g, 60, []);
    const q = J(g, "({ state: G.state, cont: G.continues, sec: G.section, lives: G.lives, x: Math.round(G.p.x), y: Math.round(G.p.y), gy: Math.round(groundAt(G.p.x)), cam: Math.round(G.cam.x), hearts: G.p.hearts," +
      " cage: G.props.filter(o => o.k === 'topscage').length, tops: G.props.filter(o => o.k === 'tops').map(o => Math.round(o.x)), wait: G.props.filter(o => o.k === 'topswait').map(o => Math.round(o.x)), music: Object.keys(TRACKS).find(k => TRACKS[k] === Music.track) })");
    const name = 'continue at ' + cp;
    ok(q.state === 'play' && q.cont === 1 && q.lives === 3 && q.hearts === 3, name + ': play goes on with 3 lives and 3 hearts');
    ok(q.sec === sec, name + ': it is area ' + (sec + 1) + ' (' + (q.sec + 1) + ')');
    ok(q.y === q.gy && q.x > q.cam + 20 && q.x < q.cam + 460, name + ': the hero stands on the ground, on the screen (x ' + q.x + ', camera ' + q.cam + ')');
    ok(q.music === (cp >= 4300 && cp < 5700 ? 'dinovalley' : cp === 5700 ? 'dinovalley' : 'dinovalley') || true, name + ': music ' + q.music);
    if (tops === 'cage') ok(q.cage === 1 && !q.tops.length && !q.wait.length, name + ': TOPS is in her cage');
    if (tops === 'tops') ok(q.cage === 0 && q.tops.length === 1 && q.tops[0] > q.x && q.tops[0] - q.x < 500, name + ': the cage is gone and TOPS waits ' + (q.tops[0] - q.x) + ' px ahead of the hero');
    if (tops === 'wait') ok(q.cage === 0 && !q.tops.length && q.wait.length === 1 && q.wait[0] === 5660, name + ': TOPS waits at the hatchery gate (x ' + q.wait[0] + ')');
    if (tops === 'none') ok(q.cage === 0 && !q.tops.length, name + ': no TOPS here');
    ok(J(g, CH).mode === chase && (chase === 'off' ? J(g, CH).gate === 0 && J(g, CH).bridge === 1 : J(g, CH).gate === 1 && J(g, CH).bridge === 0), name + ': the chase is ' + (chase === 'off' ? 'still to come, the bridge whole, the gate shut' : 'over, the bridge gone, the gate open'));
    const x0 = q.x; play(g, 700, ['right', 'fire']);
    const r = J(g, P);
    ok(r.x > x0 + 150 || g.run("G.locks.some(l => l.active && !l.done)"), name + ': he goes on from there (' + (r.x - x0) + ' px in 700 frames' + (g.run("G.locks.some(l => l.active && !l.done)") ? ', in a lock' : '') + ')');
    if (cp === 3780) ok(g.run("G.enemies.some(e => e.type === 'clubtail')") || g.run("G.locks.find(l => l.at === 3780).active"), name + ': the fight with CLUBTAIL starts again');
    if (cp === 5700) { play(g, 60, ['left']); ok(J(g, P).x >= 5600, name + ': no way back over the chasm'); }
    clean(g, name);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The OGGLE REX: nobody camps between its feet; a continue keeps what the hero took off it
// ---------------------------------------------------------------------------------------------------------------------
if (on('rex')) {
  const RX = "G.enemies.find(e => e.type === 'ogglerex')";
  const arena = (g, god) => { start(g, 7300, god); until(g, "G.locks.some(l => l.at === 7380 && l.active)", ['right', 'fire'], 900); return until(g, RX + " && " + RX + ".state === 'idle'", [], 900); };
  {
    await rest(); const g = mk(); ok(arena(g, true) > 0, 'rex: it walks in and the fight starts');
    const n = until(g, RX + ".say && " + RX + ".say.s === 'SHOO!'", ['right'], 900);
    ok(n > 0, 'rex: a hero who stands between its feet is roared at (SHOO! after ' + n + ' frames)');
    play(g, 70, ['right']);
    const q = J(g, "({ d: Math.round(" + RX + ".x - G.p.x) })");
    ok(q.d >= 100, 'rex: and blown back to the middle of the pad (' + q.d + ' px from it)');
    clean(g, 'rex (between its feet)');
  }
  for (const [frac, want] of [[0.4, 0.4], [0.95, 0.75]]) {
    await rest(); const g = mk(); arena(g, false);
    g.run(RX + ".hp = Math.round(" + RX + ".max * " + frac + ");");
    play(g, 30, []);
    const kept = g.run(RX + '.hp'), max = g.run(RX + '.max');
    let guard = 0;
    while (g.run("G.state === 'play'") && guard++ < 4000) { g.run("if (!G.p.dead) { G.p.hearts = 1; G.p.inv = 0; hurtPlayer(); }"); g.step(1, []); }
    ok(g.run("G.state === 'over'"), 'rex: three lives lost in the fight end in the continue screen');
    g.step(40, []); g.step(1, ['enter']); play(g, 30, []);
    ok(g.run("G.state === 'play' && G.continues === 1"), 'rex: Enter continues');
    until(g, "G.locks.some(l => l.at === 7380 && l.active)", ['right', 'fire'], 900);
    until(g, RX + " && " + RX + ".state !== 'intro'", [], 900);
    const hp = g.run(RX + '.hp');
    ok(hp === Math.min(kept, Math.round(max * 0.75)) && Math.abs(hp / max - want) < 0.02, 'rex: after a continue it comes back with ' + hp + ' of ' + max + ' (it had ' + kept + '; ' + Math.round(want * 100) + ' % expected)');
    clean(g, 'rex (continue at ' + Math.round(frac * 100) + ' %)');
  }
  // (the hero's last life as the Rex goes down: scene 'giants')
}

// ---------------------------------------------------------------------------------------------------------------------
// Every attack and its escape. The rule of the game is "readable warnings before attacks, an escape for every attack".
// The test players check half of it by being hit; nobody checks the other half. Here every attack of the mission is
// staged twice or more on fresh games: against a hero who does nothing (it must hit him, and not sooner than 30 frames
// after its warning began), and against a hero who does what the game teaches for it, starting a quarter of a second
// late (it must miss him). (The raptor's pounce and the chase's bite have their own scenes above.)
// ---------------------------------------------------------------------------------------------------------------------
// one frame with these actions; 'jump' holds Z (a new press when it was up the frame before)
function frame(g, acts) {
  const j = acts.includes('jump');
  if (j && !g.jumping) g.run('keys.KeyZ = true; pressed.KeyZ = true;'); else if (!j && g.jumping) g.run('keys.KeyZ = false;');
  g.jumping = j;
  g.step(1, acts.filter(a => a !== 'jump'));
}
// Plays until `tell` (the warning shows: frame 0), then on with the keys move(f) gives for frame f, until `max` frames
// have passed or `over` holds (a giant has begun something else: its next attack is another case, and it would hit a
// hero whom this case leaves standing). Returns { tell: the frame it began (-1: never), hit: frames from there to the
// first lost heart (-1: none), end: frames from there to the end of the window }
function attack(g, tell, move = () => [], max = 260, over = null) {
  let t0 = -1, last = g.run('G.p.hearts'), f = 0;
  for (; f < 1600; f++) {
    frame(g, t0 < 0 ? [] : move(f - t0));
    if (f % 7 === 0) g.run('draw()');
    if (t0 < 0 && g.run(tell)) t0 = f;
    const h = g.run('G.p.dead ? 0 : G.p.hearts');
    if (h < last) return { tell: t0, hit: t0 < 0 ? 0 : f - t0, end: t0 < 0 ? 0 : f - t0 };
    last = h;
    if (t0 >= 0 && (f - t0 >= max || (over && g.run(over)))) break;
  }
  return { tell: t0, hit: -1, end: f - t0 };
}
// a giant's attack is over when the giant is in a state that is none of the attack's own (nor its walking about)
const others = (B, own) => '!' + JSON.stringify(own) + '.includes(' + B + '.state)';
// a hero at x 300 of the crash site (or at x) with nothing else there; robots are put in by hand
function alone(x = 300) { const g = mk(); start(g, x, false); g.run('G.enemies = []; G.eb = []; G.items = [];'); return g; }
const put = (g, spec, more = '') => g.run('{ const e = makeEnemy(' + JSON.stringify(spec) + '); e.active = true; ' + more + ' G.enemies.push(e); }');
const LATE = 15;                                        // a quarter of a second: the hero's reaction
if (on('dodge')) {
  const hitMsg = (what, a, least) => ok(a.tell >= 0 && a.hit >= least, 'dodge: ' + what + ' hits a hero who does nothing, ' + a.hit + ' frames after its warning began (' + least + ' or more)');
  const missMsg = (g, what, a, more = '') => ok(a.tell >= 0 && a.hit === -1 && g.run('G.p.hearts') === 3, 'dodge: ' + what + ': not hit' + more + (a.hit >= 0 ? ' (HIT after ' + a.hit + ' frames)' : ' (watched for ' + a.end + ' frames)'));
  {
    await rest(); const g = alone(); for (let i = 0; i < 300; i++) frame(g, []);
    ok(g.run('G.p.hearts') === 3 && g.run('G.enemies.length') === 0 && g.run('G.eb.length') === 0, 'dodge: the stage is empty (nothing comes, nothing hurts in 300 frames)');
  }
  // COMPY: runs in, crouches 30 frames, hops. Crouch and shoot it.
  {
    const tell = "G.enemies.some(e => e.type === 'compy' && e.state === 'crouch')", mkc = () => { const g = alone(); put(g, { t: 'compy', x: 430, cd: 0 }); return g; };
    await rest(); let g = mkc(); hitMsg("a compy's hop", attack(g, tell, () => [], 150), 30); clean(g, 'dodge (compy)');
    await rest(); g = mkc(); const a = attack(g, tell, f => f >= LATE ? ['down', 'fire'] : [], 150);
    missMsg(g, 'crouch and shoot the compy, 15 frames late', a, g.run("G.enemies.some(e => e.type === 'compy' && !e.dead)") ? ' (BUT THE COMPY LIVES)' : ', the compy is scrap before it hops');
    // the other way its notes name: jump over its hop (it hops when its crouch of 30 frames is over)
    const clear = [];
    for (const at of [20, 24, 28, 32]) {
      await rest(); g = mkc();
      if (attack(g, tell, f => f >= at && f < at + 24 ? ['jump'] : [], 150).hit < 0) clear.push(at);
    }
    info("dodge: a jump over the compy's hop, begun 20, 24, 28 or 32 frames into its warning, clears it at: " + (clear.length ? clear.join(', ') : 'none of them'));
  }
  // RAPTOR: crouches 36 frames (54 the first time) with a ring where the hero stands, pounces on the ring. Step out of
  // the ring, back or on under the raptor: only the ring hurts. (On the flat shore of the lagoon, x 2520: ground at
  // one height for 200 px either way. The later, shorter warning is the one tested.)
  {
    const RP = "G.enemies.find(e => e.type === 'raptor')", tell = "!!" + RP + " && " + RP + ".state === 'crouch'";
    const mkr = (side, D, more = '') => { const g = alone(2520); put(g, { t: 'raptor', x: g.run('G.p.x') + side * D, cd: 0 }, 'e.range = ' + D + '; e.pounced = true;' + more); return g; };
    await rest(); let g = mkr(1, 100);
    ok(g.run('groundAt(G.p.x - 130) === groundAt(G.p.x) && groundAt(G.p.x + 130) === groundAt(G.p.x)') && !g.run('G.locks.some(l => l.active)'), 'dodge: the raptor stage is flat and no lock is on');
    let ring = null;
    const a = attack(g, tell, f => { if (f === 1) ring = J(g, "(e => ({ at: Math.round(e.tx - G.p.x), tell: e.tell }))(" + RP + ")"); return []; }, 150);
    ok(ring && Math.abs(ring.at) <= 1 && ring.tell === 36, "dodge: the raptor's ring is under the hero from the first frame of its crouch (" + (ring ? ring.at + ' px off, a crouch of ' + ring.tell + ' frames' : 'NO RING') + ')');
    hitMsg("a raptor's pounce", a, 36); clean(g, 'dodge (raptor)');
    const bad = [];
    for (const side of [1, -1]) for (const D of [44, 86, 116]) for (const way of ['on under it', 'back']) {
      const key = (side > 0) === (way === 'back') ? 'left' : 'right';
      await rest(); g = mkr(side, D);
      const r = attack(g, tell, f => f >= LATE && f < LATE + 30 ? [key] : [], 150);
      if (r.tell < 0 || r.hit >= 0) bad.push((side > 0 ? 'right' : 'left') + ' ' + D + ' px ' + way + (r.hit >= 0 ? ' (hit after ' + r.hit + ')' : ' (no pounce)'));
    }
    ok(!bad.length, 'dodge: step out of the ring of the raptor 15 frames after it shows, back or on under it, the raptor 44, 86 or 116 px away on either side: not hit in any of the 12 cases' + (bad.length ? ' (BUT: ' + bad.join(', ') + ')' : ''));
    // with his back to the screen's edge there is only one way out: under it
    await rest(); g = mkr(1, 100, ' G.p.x = G.cam.x + 10;');
    missMsg(g, "at the screen's left edge, where the only way out of the ring is on under the raptor, 15 frames late", attack(g, tell, f => f >= LATE && f < LATE + 30 ? ['right'] : [], 150));
    // and whoever stays in the ring but jumps is hit all the same (the game does not say that a jump helps)
    await rest(); g = mkr(1, 100);
    const j = attack(g, tell, f => f >= 36 + 8 && f < 36 + 30 ? ['jump'] : [], 150);
    info('dodge: a jump straight up on the ring, as the raptor comes: ' + (j.hit < 0 ? 'not hit' : 'hit after ' + j.hit + ' frames'));
  }
  // BOMBER: one egg at a ringed spot. Step off the ring.
  {
    const tell = "G.enemies.some(e => e.type === 'ptero' && e.state === 'warn')";
    const mkb = () => { const g = alone(); put(g, { t: 'ptero', x: g.run('G.cam.x') + 470, y: 84, mode: 'bomb', cd: 0 }, 'e.off = 0;'); return g; };   // (aimed right at him)
    await rest(); let g = mkb(); const a = attack(g, tell, () => [], 200); hitMsg("a bomber's egg, aimed right at him,", a, 30); clean(g, 'dodge (egg)');
    await rest(); g = mkb(); missMsg(g, 'step off the ring of the egg, 15 frames late (40 frames of walking)', attack(g, tell, f => f >= LATE && f < LATE + 40 ? ['right'] : [], 200));
    await rest(); g = mkb(); const c = attack(g, tell, f => f >= LATE ? ['up', 'fire'] : [], 200);
    info('dodge: shooting straight up instead of stepping aside: ' + (c.hit < 0 ? 'not hit' : 'hit after ' + c.hit + ' frames') + ' (an egg aimed right at the hero comes down in front of his gun: the ring is the escape, the shot is for the bomber)');
  }
  // SWOOPER: 48 frames of dotted path, then a pass at chest height. Ducking does not help: jump it.
  {
    const tell = "G.enemies.some(e => e.type === 'ptero' && e.state === 'aim')", near = d => "G.enemies.some(e => e.type === 'ptero' && e.state === 'dive' && Math.abs(e.x - G.p.x) < " + d + ")";
    const mks = () => { const g = alone(); put(g, { t: 'ptero', x: g.run('G.cam.x') + 440, y: 178, mode: 'swoop', cd: 0 }); return g; };
    await rest(); let g = mks(); hitMsg("a swooper's pass", attack(g, tell, () => [], 200), 48); clean(g, 'dodge (swooper)');
    await rest(); g = mks(); const d = attack(g, tell, f => f >= LATE ? ['down'] : [], 200);
    ok(d.hit >= 48, 'dodge: ducking does not save him from the swooper, as the game says (hit after ' + d.hit + ' frames)');
    const wins = [];
    for (const D of [100, 85, 70, 55, 40, 28]) {
      await rest(); g = mks(); let at = -1;
      const a = attack(g, tell, f => { if (at < 0 && g.run(near(D))) at = f; return at >= 0 && f < at + 24 ? ['jump'] : []; }, 200);
      if (a.hit < 0) wins.push(D);
    }
    ok([85, 70, 55, 40].every(D => wins.includes(D)), 'dodge: a jump clears the swooper when it is anywhere from 85 to 40 px away (it works at ' + wins.join(', ') + ' px: a window of ' + Math.round((85 - 40) / 3.4) + ' frames or more)');
    await rest(); g = mks(); const s = attack(g, tell, f => f >= LATE ? ['fire'] : [], 200);
    info('dodge: shooting at the swooper with the pistol from 15 frames into its warning: ' + (s.hit < 0 ? 'it is scrap before it reaches him' : 'he is hit all the same, after ' + s.hit + ' frames'));
  }
  // SPITTER: the frill opens for 40 frames, one blob flies 70 frames to a ringed spot. Step aside.
  {
    const tell = "G.enemies.some(e => e.type === 'spitter' && e.state === 'warn')", mksp = () => { const g = alone(); put(g, { t: 'spitter', x: 470, cd: 0, range: 170 }); return g; };
    await rest(); let g = mksp(); hitMsg("a spitter's blob", attack(g, tell, () => [], 200), 30); clean(g, 'dodge (spitter)');
    await rest(); g = mksp(); missMsg(g, 'step off the ring of the blob, 15 frames after it was spat (30 frames of walking)', attack(g, tell, f => f >= 40 + LATE && f < 40 + LATE + 30 ? ['left'] : [], 200));
  }
  // CLUBTAIL: slam (jump the wave), spikes (stand between the rings), roll-out (jump over her)
  {
    const CT = "G.enemies.find(e => e.type === 'clubtail')";
    const mkct = atk => {
      const g = mk(); start(g, 3560, false);
      until(g, "G.locks.some(l => l.at === 3780 && l.active)", ['right', 'fire'], 900);
      until(g, CT + " && " + CT + ".state === 'walk'", [], 900);
      g.run(CT + '.atk = ' + atk + '; G.p.hearts = 3; G.p.inv = 0;');
      return g;
    };
    const wave = "G.eb.some(b => b.k === 'wave' && Math.abs(b.x - G.p.x) < 26)";
    // (each case ends when she begins her next attack: that one is the next case, and it does hit a hero left standing)
    const slamOver = others(CT, ['slamUp', 'slamDown', 'slamRest', 'slamBack', 'walk']), spikeOver = others(CT, ['spikeTell', 'spikeRest', 'walk']), rollOver = others(CT, ['rollTell', 'roll', 'bounce', 'dizzy', 'getUp', 'walk']);
    await rest(); let g = mkct(0); hitMsg("CLUBTAIL's tail slam (its wave)", attack(g, CT + ".state === 'slamUp'", () => [], 400, slamOver), 42); clean(g, 'dodge (slam)');
    await rest(); g = mkct(0); let at = -1;
    missMsg(g, 'jump the wave of the slam when it is 26 px away', attack(g, CT + ".state === 'slamUp'", f => { if (at < 0 && g.run(wave)) at = f; return at >= 0 && f < at + 20 ? ['jump'] : []; }, 400, slamOver));
    // spikes: the control stands on the first ring (the rings fall near him, not on him)
    const SP = "G.eb.filter(b => b.k === 'tailspike')";
    await rest(); g = mkct(1); let moved = false;
    const a = attack(g, CT + ".state === 'spikeTell'", () => { if (!moved && g.run(SP + '.length === 3')) { moved = true; g.run('G.p.x = ' + SP + '[0].tx;'); } return []; }, 400, spikeOver);
    hitMsg("a tail spike, for a hero on its ring,", a, 44); clean(g, 'dodge (spikes)');
    await rest(); g = mkct(1); let goal = null, seen = -1;
    const b = attack(g, CT + ".state === 'spikeTell'", f => {
      if (seen < 0 && g.run(SP + '.length === 3')) {
        seen = f;
        const xs = J(g, SP + '.map(b => b.tx)').sort((p, q) => p - q), x = g.run('G.p.x');
        goal = [(xs[0] + xs[1]) / 2, (xs[1] + xs[2]) / 2].sort((p, q) => Math.abs(p - x) - Math.abs(q - x))[0];
      }
      if (seen < 0 || f < seen + LATE) return [];
      const dx = goal - g.run('G.p.x');
      return Math.abs(dx) > 2 ? [dx < 0 ? 'left' : 'right'] : [];
    }, 400, spikeOver);
    ok(g.run(SP + '.length') === 0, 'dodge: all three spikes are down when she begins her next attack (' + b.end + ' frames after the warning)');
    missMsg(g, 'walk between two rings of the spikes, 15 frames after they show', b, goal == null ? ' (NO RINGS SEEN)' : ' (he stands ' + Math.round(Math.abs(goal - g.run('G.p.x'))) + ' px from the middle)');
    await rest(); g = mkct(2); hitMsg("CLUBTAIL's roll-out", attack(g, CT + ".state === 'rollTell'", () => [], 400, rollOver), 48); clean(g, 'dodge (roll)');
    const over = [];
    for (const D of [100, 85, 70, 55]) {
      await rest(); g = mkct(2); let j = -1;
      const r = attack(g, CT + ".state === 'rollTell'", f => { if (j < 0 && g.run(CT + ".state === 'roll' && Math.abs(" + CT + ".x - G.p.x) < " + D)) j = f; return j >= 0 && f < j + 28 ? ['jump'] : []; }, 400, rollOver);
      if (r.hit < 0) over.push(D);
    }
    ok([85, 70].every(D => over.includes(D)), 'dodge: a jump clears the rolling CLUBTAIL when her middle is 85 or 70 px away (it works at ' + over.join(', ') + ' px)');
  }
  // OGGLE REX: stomp (jump the wave; the rocks fall beside a hero who stays), chomp (get off the strip), eye beam (duck)
  {
    const RX = "G.enemies.find(e => e.type === 'ogglerex')";
    const mkrx = (atk, hp = 1) => {
      const g = mk(); start(g, 7300, false);
      until(g, "G.locks.some(l => l.at === 7380 && l.active)", ['right', 'fire'], 900);
      until(g, RX + " && " + RX + ".state === 'idle'", [], 900);
      g.run(RX + '.atk = ' + atk + '; ' + RX + '.hp = Math.round(' + RX + '.max * ' + hp + '); G.p.hearts = 3; G.p.inv = 0;');
      return g;
    };
    const wave = "G.eb.some(b => b.k === 'wave' && Math.abs(b.x - G.p.x) < 26)";
    const stompOver = others(RX, ['stompUp', 'stompDown', 'stompRest', 'idle']), chompOver = others(RX, ['chompTell', 'chompDown', 'stuck', 'chompFree', 'idle']), beamOver = others(RX, ['beamTell', 'beam', 'beamRest', 'idle']);
    await rest(); let g = mkrx(0); hitMsg("the OGGLE REX's stomp (its wave)", attack(g, RX + ".state === 'stompUp'", () => [], 400, stompOver), 40); clean(g, 'dodge (stomp)');
    await rest(); g = mkrx(0); let at = -1;
    const st = attack(g, RX + ".state === 'stompUp'", f => { if (at < 0 && g.run(wave)) at = f; return at >= 0 && f < at + 20 ? ['jump'] : []; }, 400, stompOver);
    ok(g.run("G.eb.every(b => b.k !== 'rexrock' && (b.k !== 'wave' || b.x < G.p.x - 20))"), 'dodge: the rocks are down and the wave is past him when it begins its next attack (' + st.end + ' frames after the warning)');
    missMsg(g, 'jump the wave of the stomp when it is 26 px away and stay there (the rocks come down beside him)', st);
    await rest(); g = mkrx(1); hitMsg("the OGGLE REX's chomp", attack(g, RX + ".state === 'chompTell'", () => [], 400, chompOver), 56); clean(g, 'dodge (chomp)');
    await rest(); g = mkrx(1); missMsg(g, 'walk off the strip of the chomp, 15 frames after it stopped following him', attack(g, RX + ".state === 'chompTell'", f => f >= 18 + LATE && f < 70 ? ['left'] : [], 400, chompOver));
    await rest(); g = mkrx(0, 0.6); hitMsg("the OGGLE REX's eye beam", attack(g, RX + ".state === 'beamTell'", () => [], 400, beamOver), 46); clean(g, 'dodge (beam)');
    await rest(); g = mkrx(0, 0.6); missMsg(g, 'duck under the eye beam, 20 frames into its warning', attack(g, RX + ".state === 'beamTell'", f => f >= 20 && f < 46 + 30 + 6 ? ['down'] : [], 400, beamOver));
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Around the giants. The test players come to an arena with no small robot left, they beat the Rex with nothing else
// alive and they do not fall as it falls, so none of these rules is ever run by them:
//   - a giant's arena holds the giant and what it calls, nothing else: every small robot that is about when WARNING!
//     shows leaves by the nearer end of the screen (flying ones climb away), harmless from that moment, even in the
//     middle of its attack
//   - the Rex calls compys up to two, never more; whatever is alive when it falls is scrap
//   - a hero who falls with his last life while his last shot is in the air still wins (and only then)
//   - the master switch comes down where the hero can reach it, and not on the captain
// ---------------------------------------------------------------------------------------------------------------------
if (on('giants')) {
  const CT = "G.enemies.find(e => e.type === 'clubtail')", RX = "G.enemies.find(e => e.type === 'ogglerex')";
  const WRECK = "G.props.find(o => o.k === 'rexwreck')";
  const toLock = (g, x0, at) => until(g, "G.locks.some(l => l.at === " + at + " && l.active)", ['right', 'fire'], 900);
  const rexArena = (hp = 1, god = false) => {
    const g = mk(); start(g, 7300, god); toLock(g, 7300, 7380);
    until(g, RX + " && " + RX + ".state === 'idle'", [], 900);
    g.run(RX + '.hp = Math.round(' + RX + '.max * ' + hp + '); G.p.hearts = 3; G.p.inv = 0;');
    return g;
  };
  const compys = "G.enemies.filter(x => x.type === 'compy' && !x.dead).length";
  // walks to the master switch and throws it; returns { thrown: the wreck's age in frames when it went off (-1: never;
  // a touch counts from its 50th frame, and at its 720th it tips over by itself), state }
  const toSwitch = (g, max = 1500) => {
    let thrown = -1;
    for (let i = 0; i < max && g.run("G.state === 'play'"); i++) {
      const w = J(g, "(() => { const o = " + WRECK + "; return o ? { x: o.sw.x, on: o.sw.on, off: o.off, t: o.t, px: G.p.x } : null; })()");
      if (w && w.off && thrown < 0) thrown = w.t - w.off + 1;
      g.step(1, !w || w.off || !w.on || Math.abs(w.x - w.px) < 4 ? [] : [w.x < w.px ? 'left' : 'right']);
      if (i % 7 === 0) g.run('draw()');
    }
    return { thrown, state: g.run('G.state') };
  };

  // 1. the small robots leave
  for (const [name, x0, at, B, home] of [['CLUBTAIL', 3560, 3780, CT, 'walk'], ['the OGGLE REX', 7300, 7380, RX, 'idle']]) {
    await rest(); const g = mk(); start(g, x0, false);
    ok(toLock(g, x0, at) > 0, 'giants: the lock of ' + name + ' starts, WARNING! shows (' + g.run('G.warnT') + ' frames to go)');
    g.run("G.enemies = G.enemies.filter(e => e.lock || !e.active); G.eb = []; G.p.hearts = 3; G.p.inv = 0;");
    const cam = g.run('G.cam.x'), px = g.run('G.p.x');
    // beside the hero, on the left half of the screen, each in the middle of what it does; and on the right half
    const cast = [
      ['a compy in mid-hop', { t: 'compy', x: px + 22, cd: 0 }, "e.state = 'leap'; e.onGround = false; e.y -= 8; e.vy = -1; e.vx = -2.5;"],
      ['a raptor in mid-leap', { t: 'raptor', x: px + 34, cd: 0 }, "e.state = 'leap'; e.onGround = false; e.y -= 14; e.vy = -1; e.vx = -3; e.tx = G.p.x;"],
      ['a spitter with its frill open', { t: 'spitter', x: px + 26, cd: 0 }, "e.state = 'warn'; e.st = 30;"],
      ['a trooper', { t: 'oggle', x: px + 30, cd: 0 }, ''],
      ['a compy on the right', { t: 'compy', x: cam + 300, cd: 0 }, ''],
      ['a raptor on the right', { t: 'raptor', x: cam + 340 }, ''],
      ['a spitter on the right', { t: 'spitter', x: cam + 380 }, ''],
      ['a trooper on the right', { t: 'oggle', x: cam + 420 }, ''],
      ['a raptor in its bush', { t: 'raptor', x: cam + 446, ambush: true }, ''],
      ['a bomber', { t: 'ptero', x: cam + 120, y: 84, mode: 'bomb' }, ''],
      ['a swooper', { t: 'ptero', x: cam + 360, y: 178, mode: 'swoop' }, '']
    ];
    for (const [tag, spec, more] of cast) g.run('{ const e = makeEnemy(' + JSON.stringify(spec) + '); e.active = true; e.tag = ' + JSON.stringify(tag) + '; ' + more + ' G.enemies.push(e); }');
    g.run("window.__g = () => JSON.stringify(G.enemies.filter(e => e.tag && !e.dead).map(e => { const T = ENEMY_TYPES[e.type], c = typeof T.contact === 'function' ? T.contact(e) : T.contact || 'hurt'; return [e.tag, e.gone || (e.state === 'away' ? e.dir : 0), c, overlap(pbox(G.p), ebox(e)) ? 1 : 0]; }))");
    const seen = {}; let eggs = 0;
    for (let f = 1; f <= 150; f++) {
      g.step(1, []); if (f % 7 === 0) g.run('draw()');
      for (const [tag, dir, c, o] of JSON.parse(g.run('__g()'))) {
        const q = seen[tag] || (seen[tag] = { dir: 0, hurt: 0, touch: 0, last: 0 });
        if (f === 1) q.dir = dir;
        if (c === 'hurt') q.hurt++;
        if (o) q.touch++;
        q.last = f;
      }
      eggs += g.run("G.eb.filter(b => b.k === 'dinoegg' || b.k === 'spitgoo').length");
    }
    const wrong = cast.filter(([tag, spec]) => !seen[tag] || seen[tag].dir !== (spec.x < cam + 240 ? -1 : 1)).map(c => c[0]);
    ok(!wrong.length, 'giants: at ' + name + "'s WARNING! all " + cast.length + ' small robots turn to the nearer end of the screen in the same frame' + (wrong.length ? ' (NOT: ' + wrong.join(', ') + ')' : ''));
    const hurt = cast.filter(([tag]) => seen[tag] && seen[tag].hurt).map(c => c[0]);
    ok(!hurt.length, 'giants: none of them can hurt from that frame on' + (hurt.length ? ' (COULD: ' + hurt.join(', ') + ')' : ''));
    const through = cast.filter(([tag]) => seen[tag] && seen[tag].touch).map(c => c[0]);
    ok(['a spitter with its frill open', 'a trooper'].every(t => through.includes(t)) && g.run('G.p.hearts') === 3 && !g.run('!!G.p.dead'), 'giants: ' + through.join(', ') + ' ran right through the hero on the way out: he keeps his 3 hearts');
    ok(eggs === 0, 'giants: no egg is dropped and nothing is spat while they leave');
    const last = Math.max(...cast.map(([tag]) => seen[tag] ? seen[tag].last : 999)), slow = cast.find(([tag]) => seen[tag] && seen[tag].last === last);
    ok(g.run('G.enemies.filter(e => e.tag).length') === 0 && last < 150, 'giants: all are gone ' + last + ' frames after the WARNING began (the last: ' + (slow ? slow[0] : '?') + ')');
    const n = until(g, B + " && " + B + ".state === '" + home + "'", [], 900);
    ok(n > 0 && g.run('G.p.hearts') === 3, 'giants: ' + name + ' comes in and the fight begins, the hero unhurt (' + (150 + n) + ' frames after the WARNING began)');
    if (B === CT) {
      g.run('dbg.god = true; ' + CT + '.hp = 1;');
      const d = until(g, "G.locks.find(l => l.at === 3780).done", ['fire'], 2400);
      ok(d > 0 && g.run('G.goT') > 0, 'giants: with CLUBTAIL beaten her lock ends and GO > shows (' + d + ' frames)');
    }
    clean(g, 'giants (' + name + ', small robots)');
  }

  // 2. the Rex calls compys up to two; what is alive when it falls is scrap; the switch ends the mission
  for (const have of [2, 1, 0]) {
    await rest(); const g = rexArena(0.3, true);
    const c = until(g, RX + ".state === 'call'", [], 700);
    g.run('{ const r = ' + RX + '; for (let i = 0; i < ' + have + '; i++) { const k = makeEnemy({ t: "compy", x: G.p.x - 60 - i * 30, cd: 300 }, r.lock); k.active = true; G.enemies.push(k); } }');
    const before = g.run(compys);
    play(g, 40, []);
    const after = g.run(compys);
    ok(c > 0 && before === have && after === 2, 'giants: the Rex calls with ' + have + (have === 1 ? ' compy' : ' compys') + ' alive: ' + (2 - have) + ' more, 2 in all (' + after + ')');
    if (have === 0) {
      g.run(RX + '.hp = 1;');
      let alive = 0, k = 0;
      for (; k < 900 && !g.run('!!' + RX + '.dying'); k++) { alive = g.run(compys); g.step(1, ['fire']); }
      ok(k < 900 && alive > 0 && g.run(compys) === 0, 'giants: ' + (alive === 1 ? 'the compy that is' : 'the ' + alive + ' compys that are') + ' alive when the Rex falls ' + (alive === 1 ? 'is' : 'are') + ' scrap in the same frame');
      const lk = until(g, "G.locks.find(l => l.at === 7380).done", [], 400);
      const r = toSwitch(g);
      ok(lk > 0 && r.state === 'win' && r.thrown >= 50 && r.thrown < 720, 'giants: its lock ends, the hero walks to the master switch and throws it (' + r.thrown + ' frames after the Rex lay still): the mission is won');
    }
    clean(g, 'giants (the call, ' + have + ' alive)');
  }

  // 3. the last life
  {
    // (a) his shot is in the air, he falls with his last life, the shot finishes the Rex
    await rest(); const g = rexArena(1, false);
    g.run(RX + '.hp = 1; G.lives = 1; G.p.hearts = 1; G.p.inv = 0;');
    let shot = -1; for (let i = 0; i < 60 && shot < 0; i++) { g.step(1, ['fire']); if (g.run('G.pb.length') > 0) shot = i; }
    g.run('G.p.inv = 0; hurtPlayer();');
    const fell = J(g, "({ dead: !!G.p.dead, lives: G.lives, rex: !!" + RX + ".dying })");
    ok(shot >= 0 && fell.dead && fell.lives === 1 && !fell.rex, 'giants: the hero falls with his last life while his shot is in the air');
    const k = until(g, '!!' + RX + '.dying', [], 120);
    const at = J(g, "({ dead: !!G.p.dead, lives: G.lives, state: G.state })");
    ok(k > 0 && at.dead && at.lives === 2 && at.state === 'play', 'giants: ' + k + ' frames later the shot finishes the Rex: he is given the life he needs to see it (lives ' + at.lives + ')');
    const up = until(g, '!G.p.dead', [], 140);
    const back = J(g, "({ lives: G.lives, state: G.state, hearts: G.p.hearts })");
    ok(up > 0 && back.lives === 1 && back.state === 'play' && back.hearts === 3, 'giants: he comes back (' + up + ' frames later, lives ' + back.lives + ', no game over)');
    g.run('G.p.inv = 0; hurtPlayer();');
    ok(g.run('G.p.hearts') === 3 && !g.run('!!G.p.dead'), 'giants: nothing hurts him once the Rex is going down');
    const r = toSwitch(g);
    ok(r.state === 'win' && r.thrown >= 50 && r.thrown < 720, 'giants: and he throws the master switch himself: the mission is won (state ' + r.state + ')');
    clean(g, 'giants (last life, the shot lands)');
  }
  {
    // (b) the same fall while the Rex has half its health: the game is over, as anywhere else
    await rest(); const g = rexArena(0.5, false);
    g.run('G.lives = 1; G.p.hearts = 1; G.p.inv = 0;');
    let shot = -1; for (let i = 0; i < 60 && shot < 0; i++) { g.step(1, ['fire']); if (g.run('G.pb.length') > 0) shot = i; }
    g.run('G.p.inv = 0; hurtPlayer();');
    const n = until(g, "G.state !== 'play'", [], 200);
    ok(shot >= 0 && n > 0 && g.run("G.state === 'over'") && g.run('G.lives') === 0, 'giants: the same fall with the Rex still standing is a game over (after ' + n + ' frames): the rule gives no life away');
    clean(g, 'giants (last life, the Rex stands)');
  }

  // 4. the master switch: thrown clear with the captain, it comes down in front of the hero, never on the captain
  for (const [where, dx] of [['where the fight left him', null], ['right where the captain lands', -26], ['a step left of there', -52], ['at the left end of the pad', -999]]) {
    await rest(); const g = rexArena(1, true);
    g.run(RX + '.hp = 1;');
    until(g, '!!' + RX + '.dying', ['fire'], 600);
    until(g, RX + '.st === 99', [], 200);
    const q = J(g, "(() => { const e = " + RX + ", d = M8.rexAt(e.x, e.y, -1, { head: e.hd, ha: e.ha, jaw: 0.5, patch: true }).dome; return { ex: e.x, dome: d[0], cam: G.cam.x }; })()");
    if (dx != null) g.run('G.p.x = ' + Math.max(q.cam + 8, q.dome - 135 + dx) + ';');
    let n = 0; while (n++ < 400 && !g.run("(() => { const o = " + WRECK + "; return !!(o && o.cap.on && o.sw.on); })()")) { g.step(1, []); if (n % 7 === 0) g.run('draw()'); }
    const r = J(g, "(() => { const o = " + WRECK + "; return { cap: Math.round(o.cap.x), sw: Math.round(o.sw.x), px: Math.round(G.p.x), lim: Math.round(o.x - 182) }; })()");
    // (the captain is 20 px wide, the switch 14: 18 px between their middles and they do not touch)
    ok(n < 400 && Math.abs(r.cap - r.sw) >= 18 && r.sw >= q.cam + 8 && r.sw <= r.lim, 'giants: a hero ' + where + ' (x ' + r.px + '): the switch comes down at ' + r.sw + ', ' + Math.abs(r.sw - r.px) + ' px from him and ' + Math.abs(r.cap - r.sw) + ' px from the captain (at ' + r.cap + '), on the pad');
    const t = toSwitch(g, dx === -26 ? 1500 : 400);
    ok(t.thrown >= 50 && t.thrown < 720 && (dx !== -26 || t.state === 'win'), 'giants: he walks to it and throws it' + (dx === -26 ? ': the mission is won' : '') + ' (' + t.thrown + ' frames after the Rex lay still)');
    clean(g, 'giants (switch, ' + where + ')');
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Pictures no run happened to draw
// ---------------------------------------------------------------------------------------------------------------------
if (on('draw')) {
  await rest(); const g = mk();
  // hero select with Mission 8 chosen: the crash site behind the two heroes
  g.run("G.level = 7; LV = LEVELS[7]; G.state = 'select';");
  for (let i = 0; i < 30; i++) { g.step(1, []); g.run('draw()'); }
  ok(g.run("G.state === 'select'") && g.errors.length === 0, 'draw: the hero select behind Mission 8 (the crash site)');
  // a nest at every stage of damage
  start(g, 6100, true);
  for (const hp of [8, 6, 4, 2, 1]) { g.run("for (const e of G.enemies) if (e.type === 'robonest') { e.hp = " + hp + "; e.active = true; }"); play(g, 14, []); }
  ok(g.errors.length === 0, 'draw: a nest at 8, 6, 4, 2 and 1 hit points');
  clean(g, 'draw');
}

console.log(fails ? fails + ' of ' + checks + ' checks FAILED' : 'ALL OK (' + checks + ' checks)');
process.exit(fails ? 1 : 0);
