'use strict';
// ============================================================
// Mission 4 scenery: joins the four painted areas (level4_reef.js, level4_kelp.js, level4_ruins.js, level4_deep.js)
// into L4's draw hooks (LEVELS[3] calls L4.drawBG / drawBehind / drawGround / drawFront / drawOverlay / preview /
// menuBG). Each area file adds L4ART.<key> = { x0, x1, steps, bg, behind, ground, front, overlay } (contract:
// tools/m4polish/build-contract.md). The backdrop crossfades between neighbours over 300 px of camera travel; the
// world layers are drawn by the area that owns them; mossy rocks stand on the three seams.
// Baking: every area paints its pictures once, in steps. L4ART.pump(ms) runs steps for a while (main.js runs it in
// idle time on the menus), then the robots' (L4.castPump) and the boss's (L4.bossArt); anything needed before its
// steps ran finishes them on the spot.
// ============================================================
var L4ART = L4ART || {};
var L4 = L4 || {};
{
const KEYS = ['reef', 'kelp', 'ruins', 'deep'];
const X0 = [0, 1700, 3400, 5000], X1 = [1700, 3400, 5000, 6400];
const BOUNDS = [1700, 3400, 5000];               // backdrop crossfade centres (camera centre)
const area = i => (L4ART[KEYS[i]] && L4ART[KEYS[i]].bg) ? L4ART[KEYS[i]] : null;
L4ART.X0 = X0; L4ART.X1 = X1;
// Mission 4's seabed y at world x, also when LV is another mission (menus, mission card): use this, not groundAt
let TER = null;
L4ART.groundAt = function (x) {
  if (!TER) { const L = LEVELS.find(l => l.title === 'CORAL KINGDOM'); if (!L) return GROUND; TER = L.terrain; }
  const t = TER;
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    const [x1, y1] = t[i];
    if (x <= x1) { const [x0, y0] = t[i - 1]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  }
  return t[t.length - 1][1];
};

// ---- baking ----------------------------------------------------------
const done = [0, 0, 0, 0];
function need(i) {
  const a = area(i);
  if (!a) return null;
  const st = a.steps || [];
  while (done[i] < st.length) { const f = st[done[i]++]; try { f(); } catch (err) { errorOnce(err); } }
  return a;
}
const extraLeft = () => (L4.castLeft ? L4.castLeft() : 0) + (L4.bossArt ? L4.bossArt.left() : 0);
L4ART.left = () => KEYS.reduce((n, k, i) => n + (area(i) ? Math.max(0, (area(i).steps || []).length - done[i]) : 0), 0) + extraLeft();
L4ART.total = () => KEYS.reduce((n, k, i) => n + (area(i) ? (area(i).steps || []).length : 0), 0);
L4ART.pump = function (ms) {
  const t0 = performance.now();
  for (let i = 0; i < 4; i++) {
    const a = area(i), st = a ? a.steps || [] : [];
    while (done[i] < st.length) {
      const f = st[done[i]++];
      try { f(); } catch (err) { errorOnce(err); }
      if (performance.now() - t0 >= ms) return L4ART.left();
    }
  }
  while (L4.castLeft && L4.castLeft() > 0) { L4.castPump(1); if (performance.now() - t0 >= ms) return L4ART.left(); }
  if (L4.bossArt && L4.bossArt.left() > 0) L4.bossArt.pump(Math.max(1, ms - (performance.now() - t0)));
  return L4ART.left();
};
L4ART.bakeAll = () => { for (let i = 0; i < 4; i++) need(i); };

// ---- backdrop ----------------------------------------------------------
function weights(cx) {
  const c = cx + W / 2, w = [0, 0, 0, 0];
  let i = 0;
  while (i < 3 && c >= BOUNDS[i] + 150) i++;
  if (i < 3 && c > BOUNDS[i] - 150) { const k = (c - (BOUNDS[i] - 150)) / 300; w[i] = 1 - k; w[i + 1] = k; }
  else w[i] = 1;
  return w;
}
L4ART.weights = weights;
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
L4.drawBG = function (cx) {
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
L4.drawBehind = function (cx) {
  for (let i = 0; i < 4; i++) if (inView(i, cx, 120)) { const a = need(i); if (a && a.behind) a.behind(cx); }
};
L4.drawGround = function (cx) {
  for (let i = 0; i < 4; i++) if (inView(i, cx, 20)) {
    const a = need(i);
    if (!a || !a.ground) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(X0[i], -20, X1[i] - X0[i], H + 40); ctx.clip();
    a.ground(cx);
    ctx.restore();
  }
  drawSeams(cx);
};
// Seams: where two areas' seabeds meet, a mossy rock outcrop (glowing in the deep) stands on the line, so the two
// sands meet rock and not each other. Baked once per seam, drawn after the grounds.
const SEAMS = [
  { x: 1700, seed: 17, rock: ['#1d2f3a', '#34505c', '#4c6d75', '#7a9a92'], moss: ['#4d7a3f', '#7ba352', '#a9c96c'], glow: null },
  { x: 3400, seed: 34, rock: ['#1c2d3e', '#33506a', '#4b6e82', '#86a8a8'], moss: ['#3f6f52', '#5f9468', '#8fbf86'], glow: null },
  { x: 5000, seed: 50, rock: ['#151a33', '#2a2f52', '#3d4470', '#6b74a6'], moss: ['#3b3f78', '#5a4fa0', '#8a6cc8'], glow: ['#5ff0e6', '#ff7ad9'] }
];
const SEAM_W = 72, SEAM_UP = 20;
function bakeSeam(s) {
  const gy = Math.round(L4ART.groundAt(s.x)), hgt = H - gy + SEAM_UP + 4;
  const c = document.createElement('canvas'); c.width = SEAM_W; c.height = hgt;
  const g = c.getContext('2d'), px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const top = [];
  for (let i = 0; i < SEAM_W; i++) {
    const u = (i - SEAM_W / 2) / (SEAM_W / 2), bump = Math.cos(u * Math.PI / 2);
    top.push(Math.round(SEAM_UP + 3 - bump * (SEAM_UP - 2) * (0.75 + 0.25 * hsh(s.seed + (i >> 3))) + (Math.abs(u) > 0.8 ? 4 : 0)));
  }
  for (let i = 0; i < SEAM_W; i++) {
    const t = top[i], u = i / SEAM_W;
    px(i, t, 1, hgt - t, s.rock[0]);                                                // outline / deepest shade
    px(i, t + 1, 1, hgt - t - 1, u < 0.55 ? s.rock[2] : s.rock[1]);                  // lit left, shaded right
    if (i > 0 && i < SEAM_W - 1) px(i, t + 1, 1, 2, u < 0.6 ? s.rock[3] : s.rock[2]); // top rim light
    for (let y = t + 6; y < hgt; y += 5) if (hsh(s.seed * 7 + i * 3 + y) > 0.82) px(i, y, 2, 1, s.rock[0]); // cracks
    for (let y = t + 4; y < hgt; y += 3) if (hsh(s.seed * 13 + i + y * 5) > 0.9) px(i, y, 1, 1, s.rock[3]); // grit
  }
  // strata lines
  for (let k = 0; k < 3; k++) {
    const y0 = SEAM_UP + 8 + k * 7;
    for (let i = 2; i < SEAM_W - 2; i++) if (top[i] < y0 - 1 && hsh(s.seed + k * 31 + (i >> 2)) > 0.25) px(i, y0 + Math.round(Math.sin(i * 0.2 + k) * 1.5), 1, 1, s.rock[0]);
  }
  // moss / algae on the top and a few blades of weed
  for (let i = 3; i < SEAM_W - 3; i++) {
    const t = top[i];
    if (hsh(s.seed * 3 + i) > 0.35) { px(i, t - 1, 1, 2, s.moss[1]); if (hsh(s.seed + i * 9) > 0.6) px(i, t - 2, 1, 1, s.moss[2]); }
    else px(i, t, 1, 1, s.moss[0]);
  }
  for (let k = 0; k < 4; k++) {
    const i = 10 + Math.floor(hsh(s.seed + k * 17) * (SEAM_W - 20)), len = 5 + Math.floor(hsh(s.seed + k * 5) * 7), t = top[i];
    for (let j = 0; j < len; j++) px(i + Math.round(Math.sin(j * 0.6 + k) * 1), t - 1 - j, 1, 1, j < len - 2 ? s.moss[0] : s.moss[1]);
  }
  // pebbles at the foot on both sides
  for (let k = 0; k < 6; k++) {
    const i = k < 3 ? 1 + k * 5 : SEAM_W - 4 - (k - 3) * 5, y = SEAM_UP + 4 + Math.floor(hsh(s.seed + k) * 4);
    px(i, y, 3, 2, s.rock[1]); px(i, y, 2, 1, s.rock[3]);
  }
  return { c, gy };
}
function drawSeams(cx) {
  for (const s of SEAMS) {
    if (s.x < cx - SEAM_W || s.x > cx + W + SEAM_W) continue;
    if (!s.img) s.img = bakeSeam(s);
    const x = s.x - SEAM_W / 2, y = s.img.gy - SEAM_UP - 4;
    ctx.drawImage(s.img.c, x, y);
    if (s.glow) for (let k = 0; k < 5; k++) {          // glowing polyps on the deep's rock, pulsing gently
      const i = 8 + Math.floor(hsh(s.seed + k * 23) * (SEAM_W - 16)), on = 0.5 + 0.5 * Math.sin(G.t * 0.05 + k * 1.7);
      if (on > 0.35) R(x + i, y + SEAM_UP - 1 + Math.floor(hsh(k + 9) * 6), 1, 1, s.glow[k % 2]);
    }
  }
}
L4.drawFront = function (cx) {
  for (let i = 0; i < 4; i++) if (inView(i, cx, 60)) {
    const a = need(i);
    if (!a || !a.front) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(Math.max(-10, X0[i] - cx), -10, Math.min(W + 10, X1[i] - cx) - Math.max(-10, X0[i] - cx), H + 20); ctx.clip();
    a.front(cx);
    ctx.restore();
  }
};
// Light, caustics, drifting specks: every visible area at the strength of its backdrop weight
L4.drawOverlay = function (cx) {
  const w = weights(cx);
  for (let i = 0; i < 4; i++) {
    if (w[i] <= 0) continue;
    const a = need(i);
    if (!a || !a.overlay) continue;
    const ga = ctx.globalAlpha; ctx.globalAlpha = ga * w[i]; a.overlay(cx); ctx.globalAlpha = ga;
  }
  if (!G.intro && G.time < 440) {
    panel(85, 250, 310, 14); text('ARROWS: SWIM   X: BUBBLES   C: TORPEDO', 240, 254, '#d9faff', 1, 'center');
  }
};
// Hero select backdrop while Mission 4 is chosen: the reef at camera 260 (no G.p, no groundAt-dependent actors)
L4.menuBG = function () {
  const cx = 260;
  L4.drawBG(cx);
  ctx.save(); ctx.translate(-cx, 0);
  const a = need(0);
  if (a) { if (a.behind) a.behind(cx); if (a.ground) a.ground(cx); }
  ctx.restore();
  if (a && a.front) a.front(cx);
};
}
