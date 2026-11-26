'use strict';
// Engine self-test fixture (NOT game content): a throwaway "mission 2" that uses every engine hook Mission 1
// doesn't (terrain, intro, ride, bullet hooks, EB_TYPES, boss death animation, POW kinds) and names types
// nobody has built (wolf, eagle, cow, S, R, cherrytree, vigo...). Problems are reported with console.warn,
// which the harness prints under "warnings".
//   node harness.mjs sim --level 3 --seed 1 --extra fixtures/engine-selftest.js   (mission 3: pushed after the real Mission 2)
//   node harness.mjs render --level 3 --x 420 --extra fixtures/engine-selftest.js --out shots/selftest.png
{
const check = (ok, msg) => { if (!ok) console.warn('SELFTEST FAIL: ' + msg); };

WEAPONS.testgun = {
  label: 'TEST', ammo: 60, maxAmmo: 120, cd: 6,
  muzzle: aim => aim === 'up' ? [5, -37] : aim === 'down' ? [1, -2] : [16, -19],
  fire(p, mx, my, dx, dy) {
    G.pb.push({
      x: mx, y: my, vx: dx * 5, vy: dy * 5, dmg: 1, life: 70, pierce: true,
      update(b) { b.vy += 0.03; },
      draw(b) { R(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4, '#00ffff'); },
      onHit(b, e) { damageEnemy(e, 2); sparks(b.x, b.y, 3, '#00ffff'); },
      onGround(b) { dust(b.x, groundAt(b.x), 3); }
    });
    Snd.shoot();
  },
  drawGun(aim, ty, r) { if (aim === 'fwd') RO(6 - r, ty + 1, 10, 3, '#00aaaa'); else RO(4, aim === 'up' ? ty - 14 : ty + 10, 3, 9, '#00aaaa'); },
  icon(x, y) { RO(x + 2, y, 10, 3, '#00aaaa'); }
};
ITEMS.T = { draw: it => letterBox(it, '#00aaaa', '#66ffff', '#ffffff'), collect(it, p) { giveWeapon(p, 'testgun'); } };

EB_TYPES.rock = {
  r: 4, shootable: true,
  draw(b) { RO(Math.round(b.x) - 3, Math.round(b.y) - 3, 6, 6, '#8d8478'); },
  onGround(b) { debris(b.x, groundAt(b.x) - 2, 4, '#8d8478'); }
};

ENEMY_TYPES.thrower = {
  hp: 3, melee: true,
  contact: e => e.t % 120 < 60 ? 'hurt' : 'block',
  make(e) { e.cd = 50; },
  update(e) {
    // wave enemies start just off screen: walk on so they can be beaten (or the lock never ends)
    if (e.x > G.cam.x + W - 30) e.x -= 0.6; else if (e.x < G.cam.x + 30) e.x += 0.6;
    e.y = groundAt(e.x); e.facing = G.p.x < e.x ? -1 : 1;
    if (--e.cd <= 0) { e.cd = 100; G.eb.push({ k: 'rock', x: e.x, y: e.y - 22, vx: e.facing * 1.8, vy: -3, g: 0.12, life: 240 }); }
  },
  draw(e) { FLASH = e.hitT > 0; RO(Math.round(e.x) - 8, Math.round(e.y) - 22, 16, 22, MET); R(Math.round(e.x) - 4, Math.round(e.y) - 18, 3, 2, EVIL); FLASH = false; },
  box: e => ({ x: e.x - 8, y: e.y - 22, w: 16, h: 22 }),
  onKill(e, cx, cy, b) { boom(cx, cy, 0.8); addScore(100, cx, b.y); }
};

ENEMY_TYPES.testboss = {
  hp: 40, boss: true, bossName: 'TEST BOSS', edge: 40, contact: 'block', armored: true,
  make(e) { e.state = 'intro'; e.st = 0; },
  update(e) {
    if (e.state === 'intro') { e.x -= 1; if (e.x < G.cam.x + W - 90) e.state = 'fight'; }
    else if (e.state === 'fight') { if (e.t % 90 === 0) G.eb.push({ k: 'wave', x: e.x - 24, y: e.y, vx: -2.5, vy: 0, r: 6, life: 200 }); }
    else if (e.state === 'dying') { if (e.t % 8 === 0) boom(e.x + rand(-20, 20), e.y - rand(10, 40), 0.8); if (++e.st > 60) bossDefeated(e); }
  },
  draw(e) { FLASH = e.hitT > 0; RO(Math.round(e.x) - 24, Math.round(e.y) - 44, 48, 44, '#aa3333'); FLASH = false; },
  box: e => ({ x: e.x - 24, y: e.y - 44, w: 48, h: 44 }),
  onKill(e) { e.state = 'dying'; e.st = 0; addScore(5000, e.x, e.y - 50); return 'dying'; }
};

// A ride: walk into the parked cart to drive it; Down+Jump gets out, 3 hits throw you clear
RIDES.cart = {
  update(p, r) {
    const mv = ctl('left') && !ctl('right') ? -1 : ctl('right') && !ctl('left') ? 1 : 0;
    if (mv) p.facing = mv;
    p.x += mv * 1.4; p.y = groundAt(p.x);
    if (r.cd > 0) r.cd--;
    if (ctl('fire') && r.cd <= 0) { r.cd = 7; G.pb.push({ x: p.x + p.facing * 16, y: p.y - 14, vx: p.facing * 6, vy: 0, dmg: 1, life: 80 }); Snd.hmg(); }
    if (ctlTap('jump') && ctl('down')) exitRide(p, false);
    r.rides = (r.rides || 0) + 1;
  },
  box: p => ({ x: p.x - 14, y: p.y - 26, w: 28, h: 26 }),
  draw(p, r) {
    if (p.inv > 0 && Math.floor(p.inv / 3) % 2) return;
    drawHero(HEROES[G.hero], p.x, p.y - 8, p.facing, { pose: 'idle', t: p.t, aim: 'fwd', weapon: p.weapon });
    RO(Math.round(p.x) - 14, Math.round(p.y) - 16, 28, 12, '#3355aa');
    ctx.fillStyle = OUT; circ(Math.round(p.x) - 8, Math.round(p.y) - 4, 4); circ(Math.round(p.x) + 8, Math.round(p.y) - 4, 4);
  },
  hurt(p, r) {
    G.shake = Math.max(G.shake, 3);
    if (--r.hp <= 0) { exitRide(p, true); boom(p.x, p.y - 10, 1); } else p.inv = 60;
  },
  hud(r) { text('CART', 154, 8, '#ffe066'); for (let i = 0; i < 3; i++) R(154 + i * 8, 20, 6, 4, i < r.hp ? '#8be0a8' : '#3a3a4a'); }
};
PROP_TYPES.cart = {
  box: () => null, hit() {},
  update(o) {
    const p = G.p;
    if (!p.dead && !p.ride && Math.abs(p.x - o.x) < 10 && boardRide(p, { type: 'cart', hp: 3, cd: 0 })) { o.dead = true; G.selftestBoarded = true; }
  },
  draw(o) { RO(o.x - 14, o.y - 16, 28, 12, '#3355aa'); text('GET IN', o.x, o.y - 30, '#ffe066', 1, 'center'); }
};

POW_KINDS.dog = {
  thanks: 'WOOF!',
  draw(o) { RO(Math.round(o.x) - 7, Math.round(o.y) - 10, 14, 8, '#c49a6c'); RO(Math.round(o.x) + 5, Math.round(o.y) - 14, 6, 6, '#c49a6c'); },
  box: o => ({ x: o.x - 10, y: o.y - 16, w: 20, h: 16 }),
  onFree() { G.selftestWoof = true; }
};

let t = 0, wasGround = true, flickers = 0;
LEVELS.push({
  mission: 'MISSION 2', title: 'TEST HILLS', end: 2400, heroStart: 140, freedLabel: 'ANIMALS RESCUED',
  sections: [{ x: 0, name: 'TEST AREA 1' }, { x: 1200, name: 'TEST AREA 2' }],
  terrain: [[0, 176], [250, 176], [300, 182], [360, 196], [430, 212], [520, 224], [700, 232], [1000, 214], [1300, 232], [2400, 232]],
  plats: [{ x: 820, y: 196, w: 60, t: 'box' }],
  spawns: [{ t: 'thrower', x: 640 }, { t: 'wolf', x: 660 }, { t: 'soldier', x: 900 }, { t: 'drone', x: 1100 }, { t: 'soldier', x: 845, y: 196 }],
  pows: [{ x: 380, item: 'T', kind: 'dog' }, { x: 1000, item: 'S', kind: 'cow' }, { x: 1400, item: 'H' }],
  props: [{ k: 'crate', x: 470, item: 'R' }, { k: 'barrel', x: 760 }, { k: 'cart', x: 1150 }, { k: 'cherrytree', x: 520 }],
  locks: [
    { at: 1500, waves: [{ t: 'thrower', side: 1, d: 10 }, { t: 'eagle', side: 1, d: 20 }, { t: 'drone', side: -1, d: 40 }] },
    { at: 1920, boss: true, waves: [{ t: 'testboss', side: 1, d: 30 }] }
  ],
  music: 'vigo', bossMusic: 'bearboss',
  drawBG() { ctx.fillStyle = '#9fd0f0'; ctx.fillRect(-10, -10, W + 20, H + 20); },
  drawGround(cx) {
    ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.moveTo(cx - 10, H);
    for (let x = cx - 10; x <= cx + W + 10; x += 4) ctx.lineTo(x, groundAt(x));
    ctx.lineTo(cx + W + 10, H); ctx.fill();
  },
  drawPlat(pl) { RO(pl.x, pl.y, pl.w, groundAt(pl.x) - pl.y, '#8a8f98'); },
  drawFront() {},
  drawOverlay() { ctx.fillStyle = 'rgba(80,120,255,0.08)'; ctx.fillRect(0, 0, W, H); },
  preview(x, y, w, h) { ctx.fillStyle = '#9fd0f0'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#4caf50'; ctx.fillRect(x, y + h - 30, w, 30); },
  load(cp) { t = 0; wasGround = true; G.selftestLoads = (G.selftestLoads || 0) + 1; },
  intro: {
    start() { t = 0; },
    update() {
      t++;
      G.introKeys = { right: t <= 30 };
      if (t === 59) check(Math.abs(G.p.x - (140 + 30 * 1.7)) < 0.01, 'intro: player x ' + G.p.x + ' (keyboard leaked into the cutscene?)');
      return t >= 60;
    },
    draw() { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 24); ctx.fillRect(0, H - 24, W, 24); text('SELFTEST INTRO', W / 2, 8, '#fff', 1, 'center'); }
  },
  update() {
    // downhill check: a grounded walker must not leave the ground while falling less than 6px
    const p = G.p;
    if (!p.dead && !p.ride && wasGround && !p.onGround && p.vy >= 0 && groundAt(p.x) - p.y < 6 && ++flickers < 4) console.warn('SELFTEST FAIL: slope flicker at x=' + Math.round(p.x));
    wasGround = p.onGround;
    if (G.winT === 1) {
      check(G.selftestBoarded, 'ride: the player never boarded the cart');
      check(G.selftestWoof, 'POW kind: dog onFree never ran');
      check(G.pows.every(o => o.kind === 'dog' || o.kind === 'human'), 'POW kind fallback');
      console.warn('SELFTEST DONE: boarded=' + !!G.selftestBoarded + ' woof=' + !!G.selftestWoof + ' loads=' + G.selftestLoads);
    }
  }
});
}
