'use strict';
// =====================================================================================================================
// Mission 5 (ALIEN MOTHERSHIP) scenery joiner. Owner: coordinator. docs/level5-spec.md section 6.
// Joins the four painted areas (level5_hangar.js, level5_garden.js, level5_space.js, level5_bridge.js) into the hooks
// LEVELS[4] calls: L5.drawBG / drawBehind / drawGround / drawPlat / drawFront / drawOverlay / menuBG.
// Each area file adds
//   L5ART.<key> = { x0, x1, steps: [f, ...], bg(g, cx), behind(cx), ground(cx), plat(pl), front(cx), overlay(cx) }
// - the backdrop (bg) crossfades between neighbours over 300 px of camera travel, centred on camera-centre 1600, 3300
//   and 5000 (the second one is painted into a scratch canvas g and blended, so bg must draw into g, not ctx);
// - behind / ground / plat (world space) and front (screen space) are drawn by the area that owns them; ground and
//   front are clipped to exactly x0..x1;
// - overlay (screen space, optional) is called at globalAlpha = that area's backdrop weight;
// - on each seam (1600, 3300, 5000) a bulkhead airlock door frame stands on the deck, behind the hero.
// Baking: an area paints its pictures once, in steps. L5ART.pump(ms) runs steps for a while (main.js calls it in idle
// time on the menus); anything needed before its steps ran finishes them on the spot. Other Mission 5 files may queue
// their own one-off bakes: (L5ART.bakes = L5ART.bakes || []).push(f), run after the areas'.
// L5ART.groundAt(x): Mission 5's deck y at world x, also when LV is another mission (menus, mission card).
//
// STAND-INS: while an area's module does not exist yet (its file is still a stub), a simple readable stand-in with
// the same shape is used in its place (the second half of this file): blue-violet wall panels, the deck along the
// terrain with a bright top edge, the nectar, the platforms by type, stars behind the space walk. A real module
// replaces its stand-in completely (only a missing plat() falls back, so no platform is ever invisible).
// Never Math.random() / rand() here: hsh(n) and G.t only.
// =====================================================================================================================
var L5ART = L5ART || {};
var L5 = L5 || {};
{
const Math = globalThis.Math;
const KEYS = ['hangar', 'garden', 'space', 'bridge'];
const X0 = [0, 1600, 3300, 5000], X1 = [1600, 3300, 5000, 6400];
const BOUNDS = [1600, 3300, 5000];               // backdrop crossfade centres (camera centre)
const STAND = [null, null, null, null];          // the stand-ins (filled in below)
const real = i => (L5ART[KEYS[i]] && L5ART[KEYS[i]].bg) ? L5ART[KEYS[i]] : null;
const area = i => real(i) || STAND[i];
L5ART.X0 = X0; L5ART.X1 = X1;
// the Mission 5 level object (level5.js pushes it after this file loads: look it up when called)
let LEVEL = null;
const level = () => LEVEL || (LEVEL = LEVELS.find(l => l.title === 'ALIEN MOTHERSHIP') || null);
L5ART.level = level;
L5ART.groundAt = function (x) {
  const L = level(), t = L && L.terrain;
  if (!t) return GROUND;
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    const [x1, y1] = t[i];
    if (x <= x1) { const [x0, y0] = t[i - 1]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  }
  return t[t.length - 1][1];
};

// ---- baking --------------------------------------------------------------------------------------------------------
const done = [0, 0, 0, 0], doneFor = [null, null, null, null];
let bakesDone = 0;
const stepsOf = i => { const a = area(i); if (doneFor[i] !== a) { doneFor[i] = a; done[i] = 0; } return a ? a.steps || [] : []; };
function need(i) {
  const st = stepsOf(i);
  while (done[i] < st.length) { const f = st[done[i]++]; try { f(); } catch (err) { errorOnce(err); } }
  return area(i);
}
const bakes = () => L5ART.bakes || [];
L5ART.left = () => KEYS.reduce((n, k, i) => n + Math.max(0, stepsOf(i).length - done[i]), 0) + Math.max(0, bakes().length - bakesDone);
L5ART.total = () => KEYS.reduce((n, k, i) => n + stepsOf(i).length, 0) + bakes().length;
L5ART.pump = function (ms) {
  const t0 = performance.now();
  for (let i = 0; i < 4; i++) {
    const st = stepsOf(i);
    while (done[i] < st.length) {
      const f = st[done[i]++];
      try { f(); } catch (err) { errorOnce(err); }
      if (performance.now() - t0 >= ms) return L5ART.left();
    }
  }
  while (bakesDone < bakes().length) {
    const f = bakes()[bakesDone++];
    try { f(); } catch (err) { errorOnce(err); }
    if (performance.now() - t0 >= ms) break;
  }
  return L5ART.left();
};
L5ART.bakeAll = () => {
  for (let i = 0; i < 4; i++) need(i);
  while (bakesDone < bakes().length) { const f = bakes()[bakesDone++]; try { f(); } catch (err) { errorOnce(err); } }
};

// ---- backdrop ------------------------------------------------------------------------------------------------------
function weights(cx) {
  const c = cx + W / 2, w = [0, 0, 0, 0];
  let i = 0;
  while (i < 3 && c >= BOUNDS[i] + 150) i++;
  if (i < 3 && c > BOUNDS[i] - 150) { const k = (c - (BOUNDS[i] - 150)) / 300; w[i] = 1 - k; w[i + 1] = k; }
  else w[i] = 1;
  return w;
}
L5ART.weights = weights;
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
L5.drawBG = function (cx) {
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

// ---- world ---------------------------------------------------------------------------------------------------------
const inView = (i, cx, m) => X1[i] + m > cx && X0[i] - m < cx + W;
L5.drawBehind = function (cx) {
  for (let i = 0; i < 4; i++) if (inView(i, cx, 120)) { const a = need(i); if (a && a.behind) a.behind(cx); }
};
L5.drawGround = function (cx) {
  for (let i = 0; i < 4; i++) if (inView(i, cx, 20)) {
    const a = need(i);
    if (!a || !a.ground) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(X0[i], -20, X1[i] - X0[i], H + 40); ctx.clip();
    a.ground(cx);
    ctx.restore();
  }
  drawSeams(cx);
};
// a platform belongs to the area its middle is in
L5.drawPlat = function (pl) {
  const m = pl.x + pl.w / 2;
  let i = 0;
  while (i < 3 && m >= X1[i]) i++;
  const a = need(i);
  if (a && a.plat) a.plat(pl); else STAND[i].plat(pl);
};
L5.drawFront = function (cx) {
  for (let i = 0; i < 4; i++) if (inView(i, cx, 60)) {
    const a = need(i);
    if (!a || !a.front) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(Math.max(-10, X0[i] - cx), -10, Math.min(W + 10, X1[i] - cx) - Math.max(-10, X0[i] - cx), H + 20); ctx.clip();
    a.front(cx);
    ctx.restore();
  }
};
// light, glass shine, drifting specks: every visible area at the strength of its backdrop weight
L5.drawOverlay = function (cx) {
  const w = weights(cx);
  for (let i = 0; i < 4; i++) {
    if (w[i] <= 0) continue;
    const a = need(i);
    if (!a || !a.overlay) continue;
    const ga = ctx.globalAlpha; ctx.globalAlpha = ga * w[i]; a.overlay(cx); ctx.globalAlpha = ga;
  }
};
// Hero select backdrop while Mission 5 is chosen: the hangar at camera 400 (the proposal's screen). No G.p, no LV.
L5.menuBG = function () {
  const cx = 400, L = level();
  L5.drawBG(cx);
  ctx.save(); ctx.translate(-cx, 0);
  const a = need(0);
  if (a) {
    if (a.behind) a.behind(cx);
    if (a.ground) a.ground(cx);
    if (L) for (const pl of L.plats) if (pl.x <= cx + W + 20 && pl.x + pl.w >= cx - 20) L5.drawPlat(pl);
  }
  ctx.restore();
  if (a && a.front) a.front(cx);
};

// ---- seams: bulkhead airlock door frames ---------------------------------------------------------------------------
// Where two areas' decks meet, a door frame stands on the line: two steel posts with hazard-striped feet, each down to
// the deck under it (the deck rises to the hull at 3300 and steps down to the bridge at 5000), a lintel with hazard
// stripes and a sign, a rib up to the ceiling. Baked once per seam, drawn after the grounds: behind props and hero.
const PALS = () => M5.PAL.S;
const SEAMS = [
  { x: 1600, sign: 'GARDEN', lamp: '#4fe3ff' },
  { x: 3300, sign: 'AIRLOCK', lamp: '#ffcf3a' },
  { x: 5000, sign: 'BRIDGE', lamp: '#ff4fa3' }
];
const SEAM_HW = 44, SEAM_OPEN = 26, POST_W = 11, SEAM_H = 88, LINTEL_H = 20;
function bakeSeam(s) {
  const S = PALS(), AMB = M5.PAL.AMB, BLK = '#1a1826';
  const gl = Math.round(L5ART.groundAt(s.x - SEAM_OPEN - POST_W / 2)), gr = Math.round(L5ART.groundAt(s.x + SEAM_OPEN + POST_W / 2));
  const top = Math.min(gl, gr) - SEAM_H, hgt = Math.max(gl, gr) + 4 - (-10);
  const c = document.createElement('canvas'); c.width = SEAM_HW * 2; c.height = hgt;
  const g = c.getContext('2d'), px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x + SEAM_HW, y + 10, w, h); };
  // the rib from the ceiling down to the lintel
  px(-7, -10, 14, top + 10, OUT); px(-6, -10, 12, top + 10, S[2]); px(-6, -10, 2, top + 10, S[3]); px(4, -10, 2, top + 10, S[1]);
  for (let y = 6; y < top - 4; y += 22) { px(-6, y, 12, 1, S[0]); px(-4, y + 3, 1, 1, S[5]); px(3, y + 3, 1, 1, S[5]); }
  // the posts
  for (const [side, gy] of [[-1, gl], [1, gr]]) {
    const x0 = side < 0 ? -SEAM_OPEN - POST_W : SEAM_OPEN, y0 = top + LINTEL_H - 2;
    px(x0 - 1, y0, POST_W + 2, gy - y0 + 1, OUT);
    px(x0, y0, POST_W, gy - y0, S[4]); px(x0, y0, 3, gy - y0, S[6]); px(x0 + 3, y0, 1, gy - y0, S[5]); px(x0 + POST_W - 3, y0, 3, gy - y0, S[3]);
    for (let y = y0 + 12; y < gy - 22; y += 18) { px(x0, y, POST_W, 1, S[2]); px(x0 + 5, y + 5, 1, 1, S[7]); px(x0 + 5, y + 6, 1, 1, S[1]); }
    // hazard-striped foot and a base plate
    for (let j = 0; j < 14; j++) for (let i = 0; i < POST_W; i++) px(x0 + i, gy - 17 + j, 1, 1, ((i + j) >> 2) % 2 ? AMB : BLK);
    px(x0, gy - 18, POST_W, 1, OUT); px(x0, gy - 3, POST_W, 1, OUT);
    px(x0 - 3, gy - 2, POST_W + 6, 3, OUT); px(x0 - 2, gy - 2, POST_W + 4, 2, S[5]); px(x0 - 2, gy - 2, POST_W + 4, 1, S[7]);
    // a strip of door lights on the inner edge
    for (let y = y0 + 6; y < gy - 22; y += 6) px(side < 0 ? x0 + POST_W - 2 : x0 + 1, y, 1, 3, s.lamp);
  }
  // the lintel: steel beam, hazard stripes along its lower half, bolts
  const lw = (SEAM_OPEN + POST_W + 4) * 2, lx = -lw / 2;
  px(lx - 1, top - 1, lw + 2, LINTEL_H + 2, OUT);
  px(lx, top, lw, LINTEL_H, S[4]); px(lx, top, lw, 2, S[7]); px(lx, top + 2, lw, 1, S[6]); px(lx, top + LINTEL_H - 1, lw, 1, S[2]);
  for (let j = 0; j < 6; j++) for (let i = 0; i < lw; i++) px(lx + i, top + LINTEL_H - 7 + j, 1, 1, ((i + j) >> 2) % 2 ? AMB : BLK);
  px(lx, top + LINTEL_H - 8, lw, 1, OUT);
  for (const bx of [lx + 3, lx + lw - 5]) { px(bx, top + 4, 2, 2, S[7]); px(bx, top + 5, 2, 1, S[2]); }
  // the sign plate (its word and the lamp are drawn live)
  px(-25, top + 3, 50, 10, OUT); px(-24, top + 4, 48, 8, '#0e0c1e');
  return { c, top, gl, gr };
}
function drawSeams(cx) {
  for (const s of SEAMS) {
    if (s.x < cx - SEAM_HW - 4 || s.x > cx + W + SEAM_HW + 4) continue;
    if (!s.img) s.img = bakeSeam(s);
    const im = s.img;
    ctx.drawImage(im.c, s.x - SEAM_HW, -10);
    const on = Math.floor(G.t / 20) % 2;
    text(s.sign, s.x + 1, im.top + 5, s.lamp, 1, 'center', null);
    // the lamp on top of the beam
    RO(s.x - 3, im.top - 5, 6, 4, on ? s.lamp : '#5a4a2a'); R(s.x - 3, im.top - 5, 6, 1, on ? '#ffffff' : '#7a6a4a');
    if (on) M5.glow(s.x, im.top - 3, 12, s.lamp, 0.4);
  }
}

// =====================================================================================================================
// STAND-INS (skeleton): one simple area module per key, used only while L5ART.<key> does not exist. Same contract as
// the real ones, so they double as a small worked example. Everything still is baked in steps; only lamps, the nectar's
// shimmer and the platforms are drawn live.
// =====================================================================================================================
const S = M5.PAL.S, SP = M5.PAL.SP, P5 = M5.PAL;
const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
const pen = g => (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const TW = 256, TH = H + 20;                       // backdrop tiles: 256 px wide, the whole screen height + 10 above and below
// stars on deep space (a tile that repeats every 256 px)
function starTile(seed, n) {
  const [c, g] = cnv(TW, TH), px = pen(g);
  const gr = g.createLinearGradient(0, 0, 0, TH); gr.addColorStop(0, SP[0]); gr.addColorStop(0.6, SP[1]); gr.addColorStop(1, SP[2]);
  g.fillStyle = gr; g.fillRect(0, 0, TW, TH);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hsh(seed + i * 1.7) * TW), y = Math.floor(hsh(seed + i * 3.1 + 5) * TH), k = hsh(seed + i * 7.7);
    px(x, y, 1, 1, k > 0.8 ? '#ffffff' : k > 0.5 ? '#aab4e6' : k > 0.25 ? '#6a6aa8' : '#3c3a6e');
    if (k > 0.94) { px(x - 1, y, 3, 1, '#cfd6ff'); px(x, y - 1, 1, 3, '#cfd6ff'); px(x, y, 1, 1, '#ffffff'); }
  }
  return c;
}
// a wall of blue-violet panels with seams: ceiling pipes, a light strip, panels with rivets, now and then a vent or a
// window (kind 'port' round, 'wide' a big pane, 'none'), a dark skirting. tone 0 = darkest.
function wallTile(seed, accent, win, starsC) {
  const [c, g] = cnv(TW, TH), px = pen(g);
  px(0, 0, TW, TH, S[1]);
  // ceiling: beams and pipes (mostly behind the HUD)
  px(0, 0, TW, 44, S[0]); px(0, 44, TW, 2, S[2]); px(0, 46, TW, 1, S[0]);
  for (const [y, col] of [[16, S[2]], [22, S[1]], [30, S[2]]]) { px(0, y, TW, 3, col); px(0, y, TW, 1, S[3]); }
  for (let x = 20; x < TW; x += 64) { px(x, 10, 6, 34, S[1]); px(x, 10, 1, 34, S[2]); }
  // the light strip
  for (let x = 4; x < TW; x += 32) { px(x, 50, 22, 2, accent); px(x, 52, 22, 1, S[0]); }
  // panels: an upper and a lower plate each, rivets in the corners
  for (let i = 0; i < 4; i++) {
    const x = i * 64;
    px(x, 56, 64, 170, S[0]);
    px(x + 1, 57, 62, 82, S[2]); px(x + 1, 57, 62, 1, S[3]); px(x + 1, 138, 62, 1, S[1]);
    px(x + 1, 141, 62, 84, S[2]); px(x + 1, 141, 62, 1, S[3]); px(x + 1, 224, 62, 1, S[1]);
    for (const [rx, ry] of [[4, 60], [59, 60], [4, 134], [59, 134], [4, 144], [59, 144]]) px(x + rx, ry, 1, 1, S[4]);
  }
  // what is on them: a window, a vent or a small screen above; a hatch or ribs below
  const disc = (wx, wy, r, f) => { for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r - dy * dy)); f(wx - hw, wy + dy, hw * 2); } };
  // space seen through a window: a little lighter than the far backdrop so the pane reads, its own stars
  const starsIn = (x0, y0, w, h, n, inside) => {
    for (let k = 0; k < n; k++) {
      const sx = x0 + Math.floor(hsh(seed + x0 + k * 2.3) * w), sy = y0 + Math.floor(hsh(seed + x0 * 3 + k * 5.9) * h), q = hsh(seed + k * 9.1 + x0);
      if (inside && !inside(sx, sy)) continue;
      px(sx, sy, 1, 1, q > 0.7 ? '#ffffff' : q > 0.35 ? '#aab4e6' : '#6a6aa8');
      if (q > 0.9) { px(sx - 1, sy, 3, 1, '#cfd6ff'); px(sx, sy - 1, 1, 3, '#cfd6ff'); }
    }
  };
  for (let i = 0; i < 4; i++) {
    const x = i * 64, k = hsh(seed + i * 5.3);
    if (win === 'port' && i % 2 === 0) {                       // a round porthole with stars
      const wx = x + 32, wy = 98;
      disc(wx, wy, 17, (a, b, w) => px(a, b, w, 1, b < wy - 9 ? S[5] : S[4]));
      disc(wx, wy, 13, (a, b, w) => px(a, b, w, 1, b < wy - 4 ? SP[2] : b < wy + 5 ? SP[3] : '#2a2260'));
      starsIn(wx - 13, wy - 13, 26, 26, 9, (sx, sy) => (sx - wx) * (sx - wx) + (sy - wy) * (sy - wy) < 144);
      px(wx - 9, wy - 8, 5, 1, 'rgba(200,220,255,0.35)'); px(wx - 11, wy - 6, 3, 1, 'rgba(200,220,255,0.35)');
    } else if (win === 'wide' && i % 2 === 0) {                // a big window pane over two panels
      px(x + 6, 64, 116, 66, S[4]); px(x + 6, 64, 116, 2, S[5]);
      px(x + 9, 67, 110, 22, SP[2]); px(x + 9, 89, 110, 22, SP[3]); px(x + 9, 111, 110, 16, '#2a2260');
      starsIn(x + 9, 67, 110, 60, 26);
      px(x + 63, 64, 2, 66, S[4]); px(x + 9, 67, 110, 1, 'rgba(200,220,255,0.18)');
    } else if (win === 'wide') { /* under the pane */ }
    else if (k > 0.55) {                                       // a vent
      for (let j = 0; j < 5; j++) { px(x + 16, 84 + j * 5, 32, 2, S[0]); px(x + 16, 86 + j * 5, 32, 1, S[3]); }
    } else if (k > 0.25) {                                     // a small screen with alien glyphs
      px(x + 18, 86, 28, 18, S[0]); px(x + 19, 87, 26, 16, '#12243a');
      for (let j = 0; j < 4; j++) px(x + 21 + Math.floor(hsh(seed + i + j) * 6), 89 + j * 4, 8 + Math.floor(hsh(seed + i * 3 + j) * 10), 1, j % 2 ? '#2f7f9a' : '#3aa0b8');
    }
    if (k < 0.4) { px(x + 10, 170, 44, 30, S[1]); px(x + 11, 171, 42, 28, S[2]); px(x + 11, 171, 42, 1, S[3]); px(x + 48, 184, 3, 3, accent); }
    else for (let j = 0; j < 3; j++) px(x + 8, 160 + j * 18, 48, 1, S[1]);
  }
  px(0, 226, TW, TH - 226, S[0]); px(0, 226, TW, 1, S[2]);
  return c;
}
// draw a repeating tile into g, scrolled by cx * par
function tiled(g, tile, cx, par) {
  const off = ((Math.round(cx * par) % TW) + TW) % TW;
  for (let x = -off - 10; x < W + 10; x += TW) g.drawImage(tile, x, -10);
}
// the deck of one area, baked as a strip (world x0..x1, y 200 to the bottom): bright top edge on the terrain line,
// plates with seams and rivets, a strip of lights, hazard stripes at both ends (they end up under the door frames)
const GTOP = 200;
function deckStrip(i, light, tone) {
  const x0 = X0[i], x1 = X1[i], [c, g] = cnv(x1 - x0, H + 12 - GTOP), px = pen(g);
  const L = level(), nect = (L && L.nectar) || [];
  const [edge, top, plate, low, dark] = tone;
  for (let x = x0; x < x1; x++) {
    const gy = Math.round(L5ART.groundAt(x + 0.5)), lx = x - x0, y = gy - GTOP;
    px(lx, y, 1, H + 12 - gy, low);
    px(lx, y, 1, 1, edge); px(lx, y + 1, 1, 2, top); px(lx, y + 3, 1, 1, OUT); px(lx, y + 4, 1, 7, plate);
    px(lx, y + 11, 1, 1, dark);
    if (x % 16 < 10) px(lx, y + 13, 1, 2, light); else px(lx, y + 13, 1, 2, dark);
    px(lx, y + 16, 1, 1, dark);
    if (x % 48 === 0) { px(lx, y + 4, 1, 7, dark); px(lx, y + 17, 1, H, dark); }
    if (x % 48 === 4 || x % 48 === 44) { px(lx, y + 6, 1, 1, edge); px(lx, y + 22, 1, 1, plate); }
    if (x % 96 === 24) px(lx, y + 26, 14, 1, dark);
    if (x - x0 < 30 || x1 - x < 30) px(lx, y + 4, 1, 7, ((x + 0) >> 2) % 2 ? P5.AMB : '#1a1826');
  }
  // the nectar pond showing in the gaps of the catwalk: glowing pink from its surface down
  for (const n of nect) {
    if (n.x1 < x0 || n.x0 > x1) continue;
    for (let x = Math.max(x0, n.x0 - 6); x < Math.min(x1, n.x1 + 6); x++) {
      const gy = Math.round(L5ART.groundAt(x + 0.5)), lx = x - x0;
      if (gy <= n.y) { px(lx, gy - GTOP + 4, 1, 7, (x >> 2) % 2 ? P5.AMB : '#1a1826'); continue; }   // the gap's lips: hazard stripes
      const y = n.y - GTOP;
      px(lx, y, 1, H + 12 - n.y, '#c2317f'); px(lx, y, 1, 1, '#ffe3f3'); px(lx, y + 1, 1, 2, '#ff8cc6'); px(lx, y + 3, 1, 5, '#ff4fa3');
      px(lx, y + 8, 1, 8, '#e03d92'); px(lx, y + 22, 1, H, '#8f2468');
      if (hsh(x * 0.31) > 0.8) px(lx, y + 5 + Math.floor(hsh(x) * 16), 1, 1, '#ffb3d9');
      // the pond bed the hero wades on (just visible through the nectar)
      px(lx, gy - GTOP, 1, 1, '#a02a70');
    }
  }
  return c;
}
function drawDeck(strip, i, cx) {
  const sx = Math.max(0, Math.floor(cx) - 12 - X0[i]), w = Math.min(strip.width - sx, W + 24);
  if (w > 0) ctx.drawImage(strip, sx, 0, w, strip.height, X0[i] + sx, GTOP, w, strip.height);
}
// platforms by type (world space). Kept small and clear: a steel-edged top where the hero stands.
const gAt = x => Math.round(L5ART.groundAt(x));
function standPlat(pl) {
  const x = pl.x, y = pl.y, w = pl.w, x2 = x + w, mid = Math.round(x + w / 2);
  switch (pl.t) {
    case 'crate': {                                   // a cargo crate standing on the deck
      const gy = gAt(mid);
      RO(x, y, w, gy - y, S[4]); R(x, y, w, 2, S[7]); R(x, y + 2, w, 1, S[6]); R(x + w - 3, y + 3, 3, gy - y - 3, S[3]);
      RO(x + 4, y + 7, w - 8, gy - y - 12, S[3]); R(x + 4, y + 7, w - 8, 1, S[5]);
      for (let i = 0; i < w - 10; i++) if (((i >> 2) % 2) === 0) R(x + 5 + i, y + 9, 1, 3, P5.AMB);
      R(x + 6, gy - 9, 4, 2, P5.CYAN);
      break;
    }
    case 'cat': {                                     // a catwalk hung from the ceiling on rods
      for (const rx of [x + 8, mid, x2 - 9]) { R(rx - 1, -10, 3, y + 10, OUT); R(rx, -10, 1, y + 10, S[4]); }
      for (let px = x; px < x2; px += 12) R(px, y - 9, 1, 9, S[4]);
      R(x, y - 9, w, 1, S[5]);
      RO(x, y, w, 5, S[4]); R(x, y, w, 1, S[7]); R(x, y + 1, w, 1, S[5]); R(x, y + 4, w, 1, S[2]);
      for (let px = x + 2; px < x2 - 2; px += 4) R(px, y + 2, 2, 2, S[1]);
      for (let px = x; px < x2 - 3; px += 8) R(px, y + 5, 4, 1, P5.AMB);
      break;
    }
    case 'm1': case 'm2': {                           // a mushroom cap on its stem (m2, pink: the bouncy one)
      const pink = pl.t === 'm2', gy = Math.max(gAt(mid), 240), sq = pink ? Math.round(Math.sin(G.t * 0.1) * 1) : 0;
      const c = pink ? ['#ff4fa3', '#ffb3d9', '#b02a78', '#ffffff'] : ['#f08a2a', '#ffcf6a', '#b0561a', '#fff2d0'];
      RO(mid - 5, y + 8, 10, gy - y - 8, '#e8dcc8'); R(mid - 5, y + 8, 3, gy - y - 8, '#fff6e6'); R(mid + 2, y + 8, 3, gy - y - 8, '#b8a890');
      const rows = [[w, 0], [w + 4, 2], [w + 6, 5], [w + 2, 8], [w - 10, 10]];
      ctx.fillStyle = OUT; for (const [rw, ry] of rows) ctx.fillRect(mid - Math.round(rw / 2) - 1, y + ry - 1 - sq, rw + 2, 4);
      rows.forEach(([rw, ry], k) => R(mid - Math.round(rw / 2), y + ry - sq, rw, 3, k < 1 ? c[1] : k < 3 ? c[0] : c[2]));
      for (const [dx, dy, r] of [[-15, 3, 3], [1, 2, 4], [16, 4, 3]]) R(mid + dx - r, y + dy - sq, r * 2, 3, c[3]);
      R(x + 1, y - sq, w - 2, 1, c[3]);
      if (pink) for (let k = 0; k < 2; k++) { const ay = y - 12 - k * 6 - (Math.floor(G.t / 8) % 3); R(mid - 1, ay, 2, 1, '#ffffff'); R(mid - 3, ay + 1, 6, 1, '#ffffff'); R(mid - 5, ay + 2, 3, 1, '#ffffff'); R(mid + 2, ay + 2, 3, 1, '#ffffff'); }
      break;
    }
    case 'solar': {                                   // a solar panel on a mast
      const gy = gAt(mid);
      RO(mid - 2, y + 5, 4, gy - y - 5, S[4]); R(mid - 2, y + 5, 1, gy - y - 5, S[6]);
      RO(x, y, w, 6, '#1d3f8a'); R(x, y, w, 1, S[7]);
      for (let px = x + 1; px < x2 - 1; px += 6) { R(px, y + 1, 5, 4, '#2a5fc4'); R(px, y + 1, 5, 1, '#6fa8ff'); }
      break;
    }
    case 'tower': {                                   // an antenna tower: a lattice mast with a flat top
      const gy = gAt(mid);
      for (const lx of [x + 6, x2 - 8]) { R(lx - 1, y + 4, 4, gy - y - 4, OUT); R(lx, y + 4, 2, gy - y - 4, S[5]); }
      ctx.strokeStyle = S[4]; ctx.lineWidth = 1; ctx.beginPath();
      for (let yy = y + 6; yy < gy - 8; yy += 12) { ctx.moveTo(x + 7.5, yy + 0.5); ctx.lineTo(x2 - 7.5, yy + 12.5); ctx.moveTo(x2 - 7.5, yy + 0.5); ctx.lineTo(x + 7.5, yy + 12.5); }
      ctx.stroke();
      RO(x, y, w, 5, S[5]); R(x, y, w, 1, S[7]); R(x, y + 4, w, 1, S[3]);
      R(mid, y - 14, 1, 14, OUT); RO(mid - 1, y - 17, 3, 3, Math.floor(G.t / 25) % 2 ? '#ff3b30' : '#6a1a16');
      break;
    }
    case 'console': {                                 // a control console standing on the deck
      const gy = gAt(mid);
      RO(x + 4, y + 6, w - 8, gy - y - 6, S[3]); R(x + 4, y + 6, 2, gy - y - 6, S[4]);
      RO(x, y, w, 7, S[5]); R(x, y, w, 1, S[7]); R(x, y + 6, w, 1, S[3]);
      for (let i = 0; i < 5; i++) R(x + 5 + i * 8, y + 3, 4, 2, [(P5.CYAN), P5.AMB, P5.MAG, '#8be0a8', P5.CYAN][(i + Math.floor(G.t / 20)) % 5]);
      R(x + 9, y + 11, w - 18, 8, '#12243a'); R(x + 11, y + 13, w - 26, 1, '#3aa0b8'); R(x + 11, y + 16, w - 30, 1, '#2f7f9a');
      break;
    }
    default: RO(x, y, w, 5, S[5]); R(x, y, w, 1, S[7]);
  }
}
function standIn(i, o) {
  const A = { x0: X0[i], x1: X1[i], standIn: true };
  let back = null, stars = null, deck = null;
  A.steps = [
    () => { stars = starTile(o.seed, o.stars || 70); },
    () => { back = o.back ? o.back(stars) : null; },
    () => { deck = deckStrip(i, o.light, o.tone); },
    ...(o.more || [])
  ];
  A.bg = (g, cx) => {
    tiled(g, stars, cx, 0.08);
    if (o.far) o.far(g, cx);
    if (back) tiled(g, back, cx, 0.5);
  };
  A.behind = cx => { if (o.behind) o.behind(cx); };
  A.ground = cx => { drawDeck(deck, i, cx); if (o.groundLive) o.groundLive(cx); };
  A.plat = standPlat;
  A.front = cx => { if (o.front) o.front(cx); };
  return A;
}
const DECK = [S[7], S[5], S[4], S[2], S[0]], HULL = ['#e6ecff', S[6], S[5], S[3], S[1]];
// AREA 1, THE HANGAR: panels with portholes, amber lights
STAND[0] = standIn(0, { seed: 11, light: P5.MAG, tone: DECK, back: st => wallTile(11, P5.AMB, 'port', st) });
// AREA 2, STAR GARDEN: a glass dome (stars, ribs) over a low wall, alien plants as dark shapes; the nectar; the paddock
STAND[1] = standIn(1, {
  seed: 23, stars: 90, light: P5.CYAN, tone: DECK,
  back() {
    const [c, g] = cnv(TW, TH), px = pen(g);
    // dome ribs over the stars (the tile itself stays see-through above the wall)
    for (let x = 0; x < TW; x += 128) { px(x, 0, 3, 170, S[2]); px(x, 0, 1, 170, S[3]); }
    px(0, 78, TW, 2, S[2]); px(0, 130, TW, 2, S[2]);
    // alien plants: bulbs on stalks, in dim pink, teal, orange and violet
    const cols = [['#5a2452', '#7a3070'], ['#1c4a52', '#256a70'], ['#6a3a1c', '#8a4e22'], ['#3a2a6a', '#4e3a8a']];
    for (let k = 0; k < 9; k++) {
      const x = Math.floor(hsh(k * 3.7 + 2) * (TW - 30)) + 15, top = 110 + Math.floor(hsh(k * 5.1) * 50), r = 9 + Math.floor(hsh(k * 2.3) * 9), [a, b] = cols[k % 4];
      px(x - 1, top, 3, 190 - top, a);
      for (let dy = -r; dy <= r * 0.6; dy++) { const hw = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / r) * (dy / r)))); px(x - hw, top + dy, hw * 2 + 1, 1, dy < -r * 0.3 ? b : a); }
    }
    // the low wall under the dome
    px(0, 186, TW, TH - 186, S[0]); px(0, 186, TW, 2, S[3]);
    for (let x = 0; x < TW; x += 64) { px(x + 1, 190, 62, 34, S[1]); px(x + 1, 190, 62, 1, S[2]); }
    return c;
  },
  // the cow paddock (2540-2638): a force-field fence, three cows grazing behind it until the stampede
  behind(cx) {
    if (cx + W < 2500 || cx > 2680) return;
    const pk = L5.paddock, on = !pk || pk.on, gy = gAt(2589);
    R(2540, gy - 3, 98, 3, '#2f6a3a'); for (let x = 2542; x < 2638; x += 5) R(x, gy - 4 - (hsh(x) > 0.5 ? 1 : 0), 1, 2, '#62d64f');
    if (on) for (const [x, f] of [[2558, 1], [2590, -1], [2620, 1]]) M5.cow(x, gy - 1, f);
    for (const x of [2540, 2638]) { RO(x - 2, gy - 34, 4, 34, S[5]); R(x - 2, gy - 34, 1, 34, S[7]); RO(x - 3, gy - 38, 6, 4, on ? P5.CYAN : S[3]); }
    if (on) for (let j = 0; j < 4; j++) { ctx.fillStyle = 'rgba(79,227,255,' + (0.35 + 0.2 * Math.sin(G.t * 0.12 + j)).toFixed(2) + ')'; ctx.fillRect(2542, gy - 31 + j * 8, 94, 2); }
  },
  // the nectar's shimmer (the still pond is baked into the deck strip)
  groundLive(cx) {
    const L = level();
    for (const n of (L && L.nectar) || []) {
      if (n.x1 < cx - 10 || n.x0 > cx + W + 10) continue;
      for (let x = n.x0 + 6; x < n.x1 - 8; x += 14) { const ph = Math.floor((G.t + x * 3) / 14) % 4; R(x + ph * 2, n.y + 2 + (x >> 2) % 3 * 3, 5, 1, '#ffe3f3'); }
      M5.glow((n.x0 + n.x1) / 2, n.y + 6, (n.x1 - n.x0) * 0.42, P5.MAG, 0.18 + 0.05 * Math.sin(G.t * 0.05));
    }
  },
  // in front of the hero: the nectar's surface layer, so a wading hero looks knee-deep
  front(cx) {
    const L = level();
    for (const n of (L && L.nectar) || []) {
      if (n.x1 < cx - 10 || n.x0 > cx + W + 10) continue;
      const x = n.x0 + 3 - cx, w = n.x1 - n.x0 - 6;
      ctx.fillStyle = 'rgba(255,79,163,0.55)'; ctx.fillRect(x, n.y + 1, w, 12);
      ctx.fillStyle = 'rgba(255,227,243,0.8)'; ctx.fillRect(x, n.y, w, 1);
    }
  }
});
// AREA 3, SPACE WALK: open space, the Earth low on the left, the pale hull as the deck
// the Earth: sea, sand-coloured land, clouds, a night side. Painted in three steps (it is the slowest picture here).
const ER = 120, EO = ER + 4;
let EARTH = null, earthIm = null;
function earthRows(y0, y1) {
  if (!EARTH) { const [c, g] = cnv(EO * 2, EO * 2); EARTH = c; earthIm = { g, im: g.createImageData(EO * 2, EO * 2) }; }
  const d = earthIm.im.data, r = ER, o = EO;
  const h2 = (a, b) => hsh(a * 12.9898 + b * 78.233);
  const noise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, a = h2(xi, yi), b = h2(xi + 1, yi), cc = h2(xi, yi + 1), dd = h2(xi + 1, yi + 1); return a + (b - a) * fx + (cc - a) * fy + (a - b - cc + dd) * fx * fy; };
  const C = { rim: [120, 190, 255], l1: hex('#b8924a'), l0: hex('#d9b86a'), s1: hex('#3f8fe0'), s0: hex('#2a6fd6'), cl: hex('#f2f6ff'), nl: hex('#4a3e2e'), ns: hex('#12285e'), dl: hex('#7a6238'), ds: hex('#1d4fa8') };
  const put = (x, y, v, al = 255) => { const k = ((o + y) * o * 2 + o + x) * 4; d[k] = v[0]; d[k + 1] = v[1]; d[k + 2] = v[2]; d[k + 3] = al; };
  for (let y = y0; y <= y1; y++) for (let x = -r - 2; x <= r + 2; x++) {
    const dist = Math.hypot(x, y);
    if (dist > r + 2) continue;
    if (dist > r) { put(x, y, C.rim, 90); continue; }                        // a thin rim of air
    const n = noise(x * 0.035 + 7, y * 0.035 + 3) * 0.65 + noise(x * 0.09 + 20, y * 0.09 + 11) * 0.35;
    const land = n > 0.56, sh = (x * 0.55 + y * 0.6) / r;                    // sh: the night side, to the lower right
    let col = land ? (n > 0.66 ? C.l1 : C.l0) : n > 0.5 ? C.s1 : C.s0;
    if (noise(x * 0.05 + 40, y * 0.12 + 9) > 0.72) col = C.cl;
    if (sh > 0.55) col = land ? C.nl : C.ns; else if (sh > 0.3 && ((x + y) & 1)) col = land ? C.dl : C.ds;
    put(x, y, col);
  }
  if (y1 >= r + 2) earthIm.g.putImageData(earthIm.im, 0, 0);
}
STAND[2] = standIn(2, {
  seed: 37, stars: 130, light: P5.CYAN, tone: HULL,
  more: [() => earthRows(-ER - 2, -42), () => earthRows(-41, 40), () => earthRows(41, ER + 2)],
  far(g, cx) {
    g.drawImage(EARTH, Math.round(30 - (cx - 3300) * 0.05) - EO, 96);
    // far saucers: clearly background
    for (let k = 0; k < 3; k++) { const x = ((k * 190 + G.t * (0.1 + k * 0.04) - cx * 0.1) % (W + 60) + W + 60) % (W + 60) - 30, y = 64 + k * 23; g.fillStyle = '#2c6a3a'; g.fillRect(Math.round(x) - 5, y, 10, 2); g.fillStyle = '#3f8f4a'; g.fillRect(Math.round(x) - 2, y - 2, 4, 2); }
  },
  // the hull's lamps along the edge
  groundLive(cx) {
    for (let x = Math.ceil((cx - 10) / 120) * 120; x < cx + W + 10; x += 120) {
      if (x < 3320 || x > 4970) continue;
      const gy = gAt(x), on = Math.floor((G.t + x) / 30) % 2;
      RO(x - 2, gy - 4, 4, 4, on ? P5.CYAN : '#1f5a6a'); if (on) M5.glow(x, gy - 2, 8, P5.CYAN, 0.35);
    }
  }
});
// FINAL AREA, THE BRIDGE: panels with wide windows, cyan lights
STAND[3] = standIn(3, { seed: 51, light: P5.AMB, tone: DECK, back: st => wallTile(51, P5.CYAN, 'wide', st) });
}
