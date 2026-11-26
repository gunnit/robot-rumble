'use strict';
// Regression checks for the engine API review fixes: makeEnemy stand-ins, onKill 'dying', intro key taps, whole wave
// entries, bullet hooks (update/onGround/onProp/onPow), ride push-out, unknown projectiles, mission card boss,
// devStart with x, font accents, drum patterns, the single-mission win flow; round 3: intro keys set in start(),
// hooks keep a bullet only on exactly true, dying enemies (knife, shots), the padlock shake, a mission with no
// title. Runs at load time, prints API lines:
//   node harness.mjs sim --level 1 --frames 1 --extra fixtures/api-fixes.js 2>&1 | grep '^API'
{
  const out = [], ok = (c, m) => out.push((c ? 'ok   ' : 'FAIL ') + m);
  const KEY = { jump: 'KeyZ', fire: 'KeyX', bomb: 'KeyC', ok: 'Enter' };
  const step = (n = 1, taps) => { for (let i = 0; i < n; i++) { if (i === 0 && taps) for (const a of taps) pressed[KEY[a]] = true; update(); for (const k in pressed) delete pressed[k]; } };
  const run = (name, fn) => { try { fn(); } catch (err) { out.push('FAIL [' + name + '] threw: ' + err.message + ' ' + String(err.stack).split('\n')[1]); } };
  const box24 = e => ({ x: e.x - 8, y: e.y - 24, w: 16, h: 24 });
  ENEMY_TYPES.apidummy = { hp: 3, contact: 'none', update() {}, draw() {}, box: box24 };
  ENEMY_TYPES.apidyer = { hp: 2, contact: 'hurt', make(e) { e.dt = 0; }, update(e) { if (e.dying && ++e.dt > 30) e.dead = true; }, draw() {}, box: box24, onKill() { G.apiKills = (G.apiKills || 0) + 1; return 'dying'; } };
  ENEMY_TYPES.apiblock = { hp: 50, contact: 'block', update() {}, draw() {}, box: e => ({ x: e.x - 20, y: e.y - 30, w: 40, h: 30 }) };
  RIDES.apiride = { update() {}, box: p => ({ x: p.x - 6, y: p.y - 26, w: 40, h: 26 }), draw() {}, hurt() {}, hud() {} };
  PROP_TYPES.apiprop = { box: o => ({ x: o.x - 8, y: o.y - 40, w: 16, h: 40 }), hit(o) { o.hits = (o.hits || 0) + 1; }, draw() {} };
  // a quiet flat arena: nothing spawns by itself
  const arena = () => { devStart({ sandbox: ['apidummy'], god: true, x: 300 }); G.enemies = []; G.big = null; G.banner = null; LV.update = () => {}; };

  run('stand-in', () => {
    arena();
    G.enemies.push(makeEnemy({ t: 'api_nope', x: G.cam.x + 200 }));
    const s = makeEnemy({ t: 'api_nope', x: G.cam.x + 100 }); s.active = true; s.vx = 2; G.enemies.push(s);
    step(2); draw();
    ok(G.enemies.length === 0 && s.dead && s.type === '?', 'unknown enemy type: a dead stand-in that is safe to push and set up, dropped on the next update');
  });

  run('dying', () => {
    arena();
    const d = makeEnemy({ t: 'apidyer', x: G.p.x + 60 }); d.active = true; G.enemies.push(d);
    damageEnemy(d, 5);
    ok(d.dying && !d.dead && damageEnemy(d, 5) === false && G.apiKills === 1, "onKill returning 'dying' without changing e.state: kept, immune, onKill ran once");
    dbg.god = false; G.p.inv = 0; G.p.x = d.x; const h = G.p.hearts; step(1);
    ok(G.p.hearts === h, "a dying enemy doesn't hurt on touch");
    dbg.god = true; step(40);
    ok(!G.enemies.includes(d), 'its own animation ends it (e.dead = true)');
  });

  run('intro keys', () => {
    arena();
    let keys = {};
    LV.intro = { start() {}, update() { G.introKeys = { ...keys }; return false; }, draw() {} };
    G.intro = true; G.introKeys = {}; prevIntroKeys = {};
    keys = { jump: true }; step(1);
    ok(G.p.vy < 0 && !G.p.onGround, 'G.introKeys = { jump: true } jumps (vy ' + G.p.vy.toFixed(2) + ')');
    keys = {}; step(40); keys = { bomb: true }; step(6);
    ok(G.grenades.length === 1, 'G.introKeys = { bomb: true } throws one grenade, held for 6 frames (' + G.grenades.length + ')');
    keys = { fire: true }; step(30);
    ok(G.pb.length > 1, 'G.introKeys = { fire: true } held keeps shooting (' + G.pb.length + ' bullets)');
    G.intro = false; LV.intro = null;
  });

  run('wave spec', () => {
    arena();
    let spec = null;
    ENEMY_TYPES.apiwave = { hp: 1, contact: 'none', make(e, s) { spec = s; }, update(e) { e.x -= 1; }, draw() {}, box: box24 };
    G.locks = [{ at: G.cam.x, waves: [{ t: 'apiwave', side: 1, d: 0, leader: true }], done: false, active: false, t: 0, queue: [] }];
    step(2);
    ok(spec && spec.leader === true && spec.x > G.cam.x + W, 'wave entries reach make(e, spec) whole (leader ' + (spec && spec.leader) + ', x ' + (spec && spec.x) + ')');
    G.locks = [];
  });

  run('bullet hooks', () => {
    arena();
    const o = makeProp({ k: 'apiprop', x: G.p.x + 40 }); G.props.push(o);
    let n1 = 0; G.pb.push({ x: G.p.x + 26, y: G.p.y - 19, vx: 4, vy: 0, dmg: 1, life: 60, onProp(b, q) { if (q === o) n1++; } });
    step(3);
    ok(n1 === 1 && !o.hits && !G.pb.length, 'onProp(b, o) replaces hitProp and stops the bullet');
    let n2 = 0; G.pb.push({ x: G.p.x + 26, y: G.p.y - 19, vx: 4, vy: 0, dmg: 1, life: 60, onProp() { n2++; return true; } });
    step(6);
    ok(n2 >= 2 && G.pb.length === 1 && !o.hits, 'onProp returning true keeps it flying through the prop (' + n2 + ' calls)');
    G.pb = []; G.props = [];
    const pw = { id: 99, x: G.p.x + 40, y: groundAt(G.p.x + 40), item: 'coin', kind: 'human', state: 'tied', t: 0 }; G.pows.push(pw);
    let n3 = 0; G.pb.push({ x: G.p.x + 26, y: G.p.y - 19, vx: 4, vy: 0, dmg: 1, life: 60, onPow(b, q) { if (q === pw) n3++; } });
    step(3);
    ok(n3 === 1 && pw.state === 'tied' && !G.pb.length, 'onPow(b, o) replaces freePow and stops the bullet');
    G.pows = [];
    const t = makeEnemy({ t: 'apidummy', x: G.p.x + 40 }); t.active = true; G.enemies.push(t);
    let late = 0; G.pb.push({ x: t.x, y: t.y - 10, vx: 0, vy: 0, dmg: 1, life: 50, update(b) { b.life = 0; }, onHit() { late++; } });
    step(1);
    ok(late === 0 && t.hp === 3, 'a bullet whose update() sets life = 0 no longer collides that frame');
    G.enemies = [];
    let og = 0; G.pb.push({ x: G.p.x + 30, y: groundAt(G.p.x + 30) - 2, vx: 0, vy: 3, dmg: 1, life: 200, onGround(b) { og++; b.y = groundAt(b.x) - 1; b.vy = -2; return og < 3; } });
    for (let i = 0; i < 80; i++) { if (G.pb[0]) G.pb[0].vy += 0.3; step(1); }
    ok(og === 3 && !G.pb.length, 'player bullet onGround returning true keeps it (bounced, then removed on the 3rd: ' + og + ' calls)');
  });

  run('ride block', () => {
    arena();
    const bl = makeEnemy({ t: 'apiblock', x: G.p.x + 60 }); bl.active = true; G.enemies.push(bl);
    G.p.ride = { type: 'apiride' };
    G.p.x = bl.x - 20 - 34 + 6; // the ride box's front (p.x + 34) 6px inside the block
    step(1);
    const pb = pbox(G.p), tb = ebox(bl);
    ok(!overlap(pb, tb) && Math.abs(pb.x + pb.w - tb.x) < 1e-9, "contact 'block' pushes an off-centre ride box out by its edge (gap " + (tb.x - pb.x - pb.w) + ')');
    G.p.ride = null;
  });

  run('unknown EB', () => {
    arena(); dbg.god = false; G.p.inv = 0;
    const h = G.p.hearts;
    G.eb.push({ k: 'api_nope_eb', x: G.p.x, y: G.p.y - 10, vx: 0, vy: 0, life: 100 });
    step(1);
    ok(G.p.hearts === h && !G.eb.length && warned.has('enemy projectile:api_nope_eb'), 'unknown enemy projectile kind: dropped with a warning, never hurts');
    dbg.god = true;
  });

  run('bossOf', () => {
    // the card's boss line, read from what the mission select draws (bossOf is private to screens.js). The test
    // mission is pushed after the real ones (Mission 2 exists now): only its own card, the last one drawn, counts
    const cardBoss = locks => {
      LEVELS.push({ mission: 'MISSION 2', title: 'API TEST', end: 3000, sections: [{ x: 0, name: 'A' }], terrain: null, plats: [], spawns: [], pows: [], props: [], locks });
      const s0 = G.state, orig = text, got = [];
      G.state = 'missions'; G.level = LEVELS.length - 1;
      text = (s, ...a) => { got.push(String(s)); return orig(s, ...a); };
      try { draw(); } finally { text = orig; G.state = s0; G.level = 0; LEVELS.pop(); }
      return got.filter(s => s.includes('BOSS: ')).pop() || '';
    };
    const t = { hp: 1, boss: true, update() {}, draw() {}, box: box24 };
    ENEMY_TYPES.apimini = { ...t, bossName: 'MINI' }; ENEMY_TYPES.apimega = { ...t, bossName: 'MEGA' };
    const b1 = cardBoss([{ at: 100, waves: [{ t: 'apimini' }] }, { at: 900, boss: true, waves: [{ t: 'apimega' }] }]);
    ok(b1.includes('BOSS: MEGA') && !b1.includes('MINI'), 'mission card names the boss of the boss lock, not an earlier mini-boss (' + b1 + ')');
    const b2 = cardBoss([{ at: 1, waves: [{ t: 'apimini' }] }]);
    ok(b2.includes('BOSS: MINI'), 'and falls back to any boss type (' + b2 + ')');
  });

  run('devStart x', () => {
    let starts = 0; const loads = [];
    LEVELS.push({ mission: 'MISSION 2', title: 'API TEST', end: 3000, sections: [{ x: 0, name: 'A' }], terrain: null, plats: [], spawns: [], pows: [], props: [], locks: [],
      load(cp) { loads.push(cp); }, intro: { start() { starts++; }, update() { return false; }, draw() {} } });
    const n = LEVELS.length;   // the test mission's number (after Mission 2, which exists now)
    devStart({ level: n, x: 1000 });
    ok(starts === 0 && loads.length === 1 && !G.intro, 'devStart with x: built once at the camera (load ' + loads.join(',') + '), no intro');
    devStart({ level: n });
    ok(starts === 1 && loads.length === 2 && loads[1] === 0 && G.intro, 'devStart without x: the mission start, intro included');
    LEVELS.pop();
  });

  run('font', () => {
    const ink = s => { ctx.clearRect(0, 0, 80, 12); text(s, 0, 0, '#ffffff', 1, 'left', null); const d = ctx.getImageData(0, 0, 80, 12).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
    ok(ink('RÍA') === ink('RIA') && ink('Ñ Ç Ü') === ink('N C U'), 'accented letters fall back to their base letter (RÍA ' + ink('RÍA') + ' / RIA ' + ink('RIA') + ' px)');
  });

  run('drums', () => {
    const ot = Snd.tone, on = Snd.noise, oac = Snd.ac, beat = name => {
      const hits = { kick: [], snare: [], hat: [] };
      Snd.tone = (type, f1) => { if (type === 'sine' && f1 === 150) hits.kick.push(Music.step); };
      Snd.noise = (dur, vol, freq) => { if (freq === 2500) hits.snare.push(Music.step); else if (freq === 8000) hits.hat.push(Music.step); };
      Snd.ac = { currentTime: 0 }; Music.on = true; Music.play(name);
      for (let i = 0; i < 400 && Music.step < 24; i++) { Snd.ac.currentTime += 1 / 60; Music.update(); }
      return hits;
    };
    TRACKS.apijig = { bpm: 200, bass: [38, 0, 0], mel: [62, 66, 69], drums: { kick: 'x..x..', hat: '.xx.xx' } };
    const jig = beat('apijig'), main = beat('main');
    ok(!jig.snare.length && jig.kick.slice(0, 4).join() === '0,3,6,9', 'drums without a snare: no snare (kick ' + jig.kick.slice(0, 4) + ')');
    ok(main.kick.slice(0, 3).join() === '0,4,8' && main.snare.slice(0, 2).join() === '4,12' && main.hat.slice(0, 3).join() === '1,3,5', 'no drums: the 4/4 beat');
    Snd.tone = ot; Snd.noise = on; Snd.ac = oac; Music.stop(); delete TRACKS.apijig;
  });

  // ---------------------------------------------------------------- round 3
  run('intro start keys', () => {
    arena();
    LV.intro = { start() { G.introKeys = { jump: true }; }, update() { return false; }, draw() {} };
    G.intro = true; prevIntroKeys = {}; LV.intro.start();
    const y0 = G.p.y; step(1);
    ok(G.p.vy < 0 && G.p.y < y0, 'a key set in intro.start() (and kept) counts as a tap on the first intro frame (vy ' + G.p.vy.toFixed(2) + ')');
    step(60);
    ok(G.p.onGround, 'held on, it does not jump again (on the ground after 60 frames)');
    G.intro = false; LV.intro = null;
  });

  run('hook returns', () => {
    arena(); G.enemies = [];
    let og = 0;
    G.pb.push({ x: G.p.x + 30, y: groundAt(G.p.x + 30) - 3, vx: 0.5, vy: 2, dmg: 1, life: 40, onGround: b => { og++; return G.texts.push({ x: b.x, y: b.y, s: '!', t: 5, c: '#fff' }); } });
    step(10);
    ok(og === 1 && !G.pb.length, 'onGround returning a number (an arrow body by accident) stops the bullet (' + og + ' call)');
    const o = makeProp({ k: 'apiprop', x: G.p.x + 40 }); G.props.push(o);
    let op = 0; G.pb.push({ x: G.p.x + 26, y: G.p.y - 19, vx: 4, vy: 0, dmg: 1, life: 60, onProp: () => { op++; return 1; } });
    step(6);
    ok(op === 1 && !G.pb.length, 'onProp returning 1 stops it too (' + op + ' call)');
    G.props = [];
    let deep = 0; G.pb.push({ x: G.p.x + 30, y: groundAt(G.p.x + 30) + 2, vx: 0, vy: 3, dmg: 1, life: 500, onGround: () => { deep++; return true; } });
    step(40);
    ok(!G.pb.length && deep < 30, 'a bullet kept under the ground is removed below the screen (' + deep + ' onGround calls)');
    EB_TYPES.apieb = { r: 3, draw() {}, onGround: b => { b.n = (b.n || 0) + 1; return b.n; } };
    G.eb.push({ k: 'apieb', x: G.p.x + 80, y: groundAt(G.p.x + 80) - 2, vx: 0, vy: 3, life: 100 });
    const eb = G.eb[0]; step(3);
    ok(!G.eb.includes(eb) && eb.n === 1, 'EB_TYPES onGround returning a number stops the projectile (' + eb.n + ' call)');
    delete EB_TYPES.apieb;
  });

  run('dying enemies', () => {
    arena();
    ENEMY_TYPES.apiwolf = { hp: 2, melee: true, contact: 'hurt', make(e) { e.dt = 0; }, update(e) { if (e.dying && ++e.dt > 40) e.dead = true; }, draw() {}, box: box24, onKill: () => 'dying' };
    ENEMY_TYPES.apiboss = { ...ENEMY_TYPES.apiwolf, boss: true, melee: false, onKill: () => 'dying' };
    const w = makeEnemy({ t: 'apiwolf', x: G.p.x + 12 }); w.active = true; G.enemies.push(w);
    damageEnemy(w, 9); G.p.facing = 1; G.p.fireCd = 0; G.p.knife = 0;
    const n0 = G.pb.length; step(1, ['fire']);
    ok(G.p.knife === 0 && G.pb.length > n0, 'the hero shoots instead of knifing a dying melee enemy (knife ' + G.p.knife + ', bullets ' + (G.pb.length - n0) + ')');
    const behind = makeEnemy({ t: 'apidummy', x: G.p.x + 60 }); behind.active = true; G.enemies.push(behind);
    G.pb = [{ x: w.x - 4, y: w.y - 10, vx: 4, vy: 0, dmg: 1, life: 40 }];
    step(14);
    ok(behind.hp < 3, 'a shot flies through a dying enemy and hits the one behind it (hp ' + behind.hp + ')');
    G.enemies = [];
    const bs = makeEnemy({ t: 'apiboss', x: G.p.x + 50 }); bs.active = true; G.enemies.push(bs); damageEnemy(bs, 9);
    G.pb = [{ x: bs.x - 12, y: bs.y - 10, vx: 4, vy: 0, dmg: 1, life: 40 }];
    step(3);
    ok(bs.dying && !G.pb.length, "a dying boss's wreck still stops shots (like Mission 1's crab)");
    G.enemies = [];
  });

  run('missions screen', () => {
    const key = c => { pressed[c] = true; keys[c] = true; update(); for (const k in pressed) delete pressed[k]; keys[c] = false; };
    G.state = 'title'; key('Enter'); key('ArrowRight');
    const shook = G.lockT; key('Enter');
    G.state = 'title'; key('Enter');
    ok(shook > 0 && G.state === 'missions' && G.lockT === 0, 'the padlock shake does not carry over to the next visit (lockT ' + shook + ' -> ' + G.lockT + ')');
    LEVELS.push({ end: 2000, heroStart: 100, sections: [{ x: 0, name: 'A' }], terrain: null, plats: [], spawns: [], pows: [], props: [], locks: [], intro: null });
    let threw = null, got = [];
    const name = 'MISSION ' + LEVELS.length;   // its card is named after its place in the list
    const orig = text; text = (s, ...a) => { got.push(String(s)); return orig(s, ...a); };
    try { G.level = LEVELS.length - 1; draw(); } catch (e) { threw = e.message; } finally { text = orig; LEVELS.pop(); G.level = 0; G.state = 'title'; }
    ok(!threw && got.includes(name), 'a mission with no title or mission name: the card draws (' + name + '), no throw (' + threw + ')');
  });

  run('win flow', () => {
    // the single-mission flow: Mission 2 exists now, so the later missions are set aside for this check
    const later = LEVELS.splice(1);
    try {
      ok(LEVELS.length === 1, 'only Mission 1 is loaded (' + later.length + ' later mission(s) set aside)');
      devStart({ level: 1 }); toWin(); step(100); step(1, ['ok']);
      ok(G.state === 'win', 'Enter waits on the win screen');
      step(30); step(1, ['ok']);
      ok(G.state === 'title', 'the only mission: Enter goes back to the title, as before Mission 2 (' + G.state + ')');
    } finally { LEVELS.push(...later); }
    if (LEVELS.length > 1) {
      devStart({ level: 1 }); toWin(); step(130); step(1, ['ok']);
      ok(G.state === 'play' && LV === LEVELS[1] && G.level === 1, 'with Mission 2 loaded, Enter on the win screen starts Mission 2 (' + G.state + ', level ' + (G.level + 1) + ')');
    }
  });

  for (const s of out) console.log('API ' + s);
}
