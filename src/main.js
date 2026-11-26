'use strict';
// ============================================================
// Main loop (fixed 60 updates per second) and dev hooks.
// Everything is private to this block except window.devStart.
// ============================================================
{
let last = performance.now(), acc = 0;
const STEP = 1000 / 60;
// Start-up: Mission 1's painted scenery is baked a few steps per frame behind a progress bar (L1ART.pump), so the
// title screen and the first steps into each area never pause. Only on the title screen, before the first game frame.
let booting = true;
const boot = { frames: 0, t0: 0, t1: 0 };
function loadingFrame() {
  const total = L1ART.total() || 1, k = 1 - L1ART.left() / total;
  ctx.fillStyle = '#0b0b1e'; ctx.fillRect(0, 0, W, H);
  logoText('ROBOT', 62, 4, '#ff9a1f', '#ffe066', '#3a1200');
  logoText('RUMBLE', 94, 4, '#e8541e', '#ffb347', '#3a0a00');
  text('LOADING...', W / 2, 150, '#ffffff', 1, 'center');
  RO(W / 2 - 81, 164, 162, 9, '#1c1c34');
  R(W / 2 - 80, 165, Math.round(160 * k), 7, '#ffe066'); R(W / 2 - 80, 165, Math.round(160 * k), 2, '#fff6c2');
  L1ART.pump(24);
}
function frame(now) {
  requestAnimationFrame(frame); // first, so nothing below can stop the loop
  if (booting) {
    if (G.state === 'title' && typeof L1ART !== 'undefined' && L1ART.left && L1ART.left() > 0) {
      last = now; acc = 0;
      if (!boot.frames++) boot.t0 = Math.round(now);
      try { loadingFrame(); } catch (err) { errorOnce(err); booting = false; }
      return;
    }
    booting = false;
    boot.t1 = Math.round(now); window.bootInfo = boot; // dev: when the loading bar started / ended (ms) and its frames
  }
  acc += Math.min(now - last, 100);
  last = now;
  // An error doesn't stop the game (errorOnce logs it once): a failed update still counts as a step, so the game
  // keeps its speed on any screen, and the frame is drawn whatever happened in the updates
  while (acc >= STEP) {
    try { update(); } catch (err) { errorOnce(err); }
    acc -= STEP;
    for (const k in pressed) delete pressed[k];
  }
  try { draw(); } catch (err) { errorOnce(err); resetCanvas(); }
  // Mission 4's painted scenery bakes in idle time on the menus (a few ms per frame), so starting it never pauses
  if ((G.state === 'title' || G.state === 'missions' || G.state === 'select') && typeof L4ART !== 'undefined' && L4ART.left && L4ART.left() > 0) {
    try { L4ART.pump(5); } catch (err) { errorOnce(err); }
  } else if ((G.state === 'title' || G.state === 'missions' || G.state === 'select') && typeof L5ART !== 'undefined' && L5ART.left && L5ART.left() > 0) {
    try { L5ART.pump(5); } catch (err) { errorOnce(err); } // then Mission 5's
  }
  if (G.state !== 'play' && typeof L4SND !== 'undefined' && L4SND.warm) L4SND.warm(); // decode Mission 4's sounds early
  if (now - errorAt < 2000) errorNote();
}

// Undo the canvas state a failed draw left behind (open save()s with their transforms, clips and alpha; the hit
// flash), keeping what it drew: restore() does nothing once no save() is left
function resetCanvas() {
  FLASH = false;
  for (let i = 0; i < 64; i++) ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = false;
}

// While errors happen (and 2 s after the last one) a note over the picture says so: index.html has no error box
function errorNote() {
  try {
    ctx.fillStyle = 'rgba(110,0,0,0.85)'; ctx.fillRect(W / 2 - 93, H - 16, 186, 12);
    text('OOPS! ERROR - SEE THE CONSOLE', W / 2, H - 14, '#ffffff', 1, 'center', null);
  } catch (err) { /* the font itself may be what is broken: the console has it */ }
}

// ============================================================
// Dev hooks (dev.html?level=2&x=1200, the test harness, the browser console)
// ============================================================
// Flat test arena: the listed enemy types appear ahead of the player, again and again
function sandboxLevel(types) {
  let wait = 0;
  return {
    mission: 'SANDBOX', title: 'TEST ARENA', end: 1e6, heroStart: 60, terrain: null,
    sections: [{ x: 0, name: 'SANDBOX: ' + types.join(' ') }],
    plats: [], spawns: [], pows: [], props: [], locks: [], music: 'main', bossMusic: 'boss', intro: null,
    drawBG() {
      const g = ctx.createLinearGradient(0, 0, 0, GROUND);
      g.addColorStop(0, '#5a8fc0'); g.addColorStop(1, '#cfe3f0');
      ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, GROUND + 20);
    },
    drawGround(cx) {
      R(cx - 12, GROUND, W + 24, H - GROUND, '#6b5a45'); R(cx - 12, GROUND, W + 24, 3, '#7fa65a');
      // a ruler every 50px so positions are easy to read in screenshots
      for (let x = Math.floor((cx - 12) / 50) * 50; x < cx + W + 12; x += 50) {
        R(x, GROUND + 3, 1, x % 200 ? 4 : 8, '#3d3226');
        if (x % 200 === 0) text(String(x), x + 3, GROUND + 6, '#e8dcc8', 1, 'left', null);
      }
    },
    load() { wait = 0; },
    update() {
      G.winT = 0; // a beaten boss comes back instead of ending the run
      // a fresh group a second after the last one is gone
      if (G.enemies.length) { wait = 60; return; }
      if (--wait <= 0) types.forEach((t, i) => { const e = makeEnemy({ t, x: G.p.x + 150 + i * 60 }); if (!e.dead) G.enemies.push(e); });
    }
  };
}

// Set up a game: { level: mission number (1 = Mission 1), hero: 0|1, x: start x, god, sandbox: ['wolf', ...], frames }.
// Without x the mission starts from its beginning (intro included); with x it is built straight at that spot, no intro.
// Runs `frames` updates synchronously, draws once and returns a summary.
window.devStart = function (o = {}) {
  dbg.god = !!o.god;
  G.hero = o.hero ? 1 : 0;
  G.score = 0;
  if (o.sandbox) LV = sandboxLevel([].concat(o.sandbox));
  else {
    const i = (o.level || 1) - 1;
    if (!LEVELS[i]) throw new Error('devStart: mission ' + (i + 1) + ' is not loaded (' + LEVELS.length + ' missions)');
    G.level = i; LV = LEVELS[i];
  }
  if (o.x == null) beginMission(0, true);
  else {
    // jump ahead: locks before the camera count as done, enemies from there on are spawned
    beginMission(clamp(o.x - W * 0.42, 0, LV.end - W), false);
    G.p.x = o.x; G.p.y = groundAt(o.x);
  }
  for (let i = 0; i < (o.frames || 0); i++) { update(); for (const k in pressed) delete pressed[k]; }
  draw();
  const p = G.p;
  return { level: o.sandbox ? 'sandbox' : G.level + 1, state: G.state, intro: G.intro, x: Math.round(p.x), cam: Math.round(G.cam.x), hearts: p.hearts, lives: G.lives, score: G.score, enemies: G.enemies.length, section: G.section };
};

// dev.html?level=2&x=1200&hero=1&god=1 (or ?sandbox=wolf,eagle) starts straight in that state
const devQuery = {};
for (const kv of location.search.slice(1).split('&')) { const [k, v = ''] = kv.split('='); if (k) devQuery[k] = decodeURIComponent(v); }
if (devQuery.level || devQuery.sandbox) {
  try {
    devStart({
      level: +devQuery.level || 1, hero: +devQuery.hero || 0, x: devQuery.x ? +devQuery.x : null, god: devQuery.god === '1',
      sandbox: devQuery.sandbox ? devQuery.sandbox.split(',') : null
    });
  } catch (err) {
    // a broken start must not leave a dead page: report it and show the title screen instead
    console.error('Robot Rumble: devStart from the address bar failed (showing the title screen instead):', err);
    G.state = 'title'; G.intro = false; G.fade = 1; Music.stop();
    resetCanvas();
  }
}
requestAnimationFrame(frame);
}
