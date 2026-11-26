'use strict';
// ============================================================
// Mission 1 scenery: joins the four painted areas (level1_jungle.js, level1_camp.js, level1_bridge.js,
// level1_base.js) into the level's draw hooks. Each area file adds L1ART.<key> = { x0, x1, steps, bg, behind,
// ground, plat, front } (contract: tools/polish/build-contract.md). This file owns LEVELS[0].drawBG / drawBehind /
// drawGround / drawPlat / drawFront / preview: the sky crossfades between neighbours as the camera moves (same
// 300 px as before), everything in the world is drawn by the area that owns it.
// Baking: every area paints its pictures once, in steps. L1ART.pump(ms) runs steps for a while (the start-up
// loading screen in main.js); an area that is needed before its steps ran finishes them on the spot.
// ============================================================
var L1ART = L1ART || {};
{
const L = LEVELS[0];
const KEYS = ['jungle', 'camp', 'bridge', 'base'];
const X0 = [0, 1620, 3060, 4340], X1 = [1620, 3060, 4340, 6000];   // ground ranges (L.grounds)
const AREA_BOUNDS = [1600, 3020, 4380];                             // sky crossfade centres (camera centre), as level1.js
const area = i => L1ART[KEYS[i]] || null;

// ---- who owns what -------------------------------------------------
// decor entry -> area index (signs and the bridge's truss belong to the area they announce, wherever they stand)
function decorOwner(d) {
  switch (d.t) {
    case 'statue': case 'ruin': case 'bush': case 'fern': return 0;
    case 'palm': return d.x < X1[0] ? 0 : 1;
    case 'sign': return d.s === 'BRIDGE' ? 2 : 1;
    case 'flag': case 'radio': case 'jeep': case 'drums': case 'tent': case 'sandbags': return 1;
    case 'truss': return 2;
    case 'gate': case 'pipes': case 'wall': return 3;
  }
  return d.x < X1[0] ? 0 : d.x < X1[1] ? 1 : d.x < X1[2] ? 2 : 3;
}
const areaOfX = x => x < X1[0] ? 0 : x < X1[1] ? 1 : x < X1[2] ? 2 : 3;
let DECOR = null;
// The decor entries of one area (by key), in level order
L1ART.decor = function (key) {
  if (!DECOR) { DECOR = KEYS.map(() => []); for (const d of L.decor) DECOR[decorOwner(d)].push(d); }
  return DECOR[KEYS.indexOf(key)] || [];
};
L1ART.plats = key => L.plats.filter(pl => areaOfX(pl.x) === KEYS.indexOf(key));

// ---- baking ----------------------------------------------------------
const done = [0, 0, 0, 0];
function need(i) {
  const a = area(i);
  if (!a) return null;
  const st = a.steps || [];
  while (done[i] < st.length) { const f = st[done[i]++]; try { f(); } catch (err) { errorOnce(err); } }
  return a;
}
// Steps still to run / in all, over every area
L1ART.left = () => KEYS.reduce((n, k, i) => n + (area(i) ? Math.max(0, (area(i).steps || []).length - done[i]) : 0), 0);
L1ART.total = () => KEYS.reduce((n, k, i) => n + (area(i) ? (area(i).steps || []).length : 0), 0);
// Run bake steps for about `ms` milliseconds (at least one). Returns the number of steps left.
L1ART.pump = function (ms) {
  const t0 = performance.now();
  for (let i = 0; i < 4; i++) {
    const a = area(i), st = a ? a.steps || [] : [];
    while (done[i] < st.length) {
      const f = st[done[i]++];
      try { f(); } catch (err) { errorOnce(err); }
      if (performance.now() - t0 >= ms) return L1ART.left();
    }
  }
  return 0;
};

// ---- sky ---------------------------------------------------------------
function weights(cx) {
  const c = cx + W / 2, w = [0, 0, 0, 0];
  let i = 0;
  while (i < 3 && c >= AREA_BOUNDS[i] + 150) i++;
  if (i < 3 && c > AREA_BOUNDS[i] - 150) { const k = (c - (AREA_BOUNDS[i] - 150)) / 300; w[i] = 1 - k; w[i + 1] = k; }
  else w[i] = 1;
  return w;
}
let SCR = null, SG = null;
function scratch() {
  if (!SCR) {
    SCR = document.createElement('canvas'); SCR.width = W + 20; SCR.height = H + 20;
    SG = SCR.getContext('2d'); SG.imageSmoothingEnabled = false;
  }
  SG.setTransform(1, 0, 0, 1, 10, 10);
  SG.globalAlpha = 1; SG.globalCompositeOperation = 'source-over';
  SG.clearRect(-10, -10, W + 20, H + 20);
  return SG;
}
// One area alone, or two neighbours while the camera crosses from one to the next: the first is painted, the second
// fades in over it through the scratch canvas
L.drawBG = function (cx) {
  const w = weights(cx);
  let first = true;
  for (let i = 0; i < 4; i++) {
    if (w[i] <= 0) continue;
    const a = need(i);
    if (!a) continue;
    if (first || w[i] >= 1) { a.bg(ctx, cx); first = false; continue; }
    a.bg(scratch(), cx);
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * w[i]; ctx.drawImage(SCR, -10, -10); ctx.globalAlpha = ga;
  }
};

// ---- world -------------------------------------------------------------
const inView = (i, cx, m) => X1[i] + m > cx && X0[i] - m < cx + W;

L.drawBehind = function (cx) {
  for (let i = 0; i < 4; i++) if (inView(i, cx, 700)) { const a = need(i); if (a && a.behind) a.behind(cx); }
};

L.drawGround = function (cx) {
  for (let i = 0; i < 4; i++) if (inView(i, cx, 40)) { const a = need(i); if (a && a.ground) a.ground(cx); }
};

L.drawPlat = function (pl) {
  const a = need(areaOfX(pl.x));
  if (a && a.plat) a.plat(pl);
};

// Foreground (screen space, parallax 1.3): each area draws the part of the screen that shows its own stretch
L.drawFront = function (cx) {
  for (let i = 0; i < 4; i++) if (inView(i, cx, 200)) { const a = need(i); if (a && a.front) a.front(cx); }
};

// Mission-select card art: a slice of the jungle, a hero squaring up to a robot soldier
L.preview = function (x, y, w, h) {
  const cx = 348, ox = 44, wx = cx + ox;   // between the first temple blocks and the log: palms, a bush, open jungle
  ctx.save();
  ctx.translate(x - ox, y - (GROUND + 12 - h));
  L.drawBG(cx);
  ctx.translate(-cx, 0);
  L.drawBehind(cx); L.drawGround(cx);
  const fire = G.t % 40 < 18;
  ENEMY_TYPES.soldier.draw({ x: wx + w - 28, y: GROUND, facing: -1, hitT: 0, moving: false, t: G.t, state: 'aim', st: G.t });
  drawHero(HEROES[G.hero], wx + 30, GROUND, 1, { pose: 'idle', t: G.t, aim: 'fwd', muzzle: fire && G.t % 6 < 3 ? 3 : 0 });
  if (fire) for (let i = 0; i < 3; i++) {
    const bx = wx + 50 + ((G.t * 6 + i * 40) % (w - 80));
    R(bx - 3, GROUND - 20, 6, 3, '#ffe066'); R(bx - 2, GROUND - 19, 4, 1, '#ffffff');
  }
  ctx.restore();
};
}
