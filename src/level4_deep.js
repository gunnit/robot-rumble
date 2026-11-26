'use strict';
// ============================================================
// Mission 4, FINAL AREA: GLOWING DEEP (world x 5000-6400) and the MEGA OCTOPUS lair: L4ART.deep for level4_scenery.js
// (contract: tools/m4polish/build-contract.md). A dark navy/violet abyss inside a sea cave, lit only by friendly
// bioluminescence.
//   bg (screen space, parallax strips): the water column, far-off glows, hazy far rock towers, anglerfish with lure
//   lights, glowing jellyfish, the mid cave (a great arch, pillars, a stack with a window), schools of lanternfish, the
//   cave ceiling with stalactite overhangs and glow-worm threads (all above y 58: the swim space starts at y 62).
//   behind (world): the lair dug into the end wall (an octagon bulkhead round the hatch the boss comes out of, a hazard
//   ring, running lights, beacons, portholes, the vault door, a hanging emblem sign, a factory tunnel inside), then the
//   coral gardens (tube sponges, sea fans, brain corals, anemones, sea pens, tube worms, boulders, starfish) and pipes.
//   ground (world): dark sand, then the corals' light (4 additive layers, each pulsing on its own phase).
//   front (screen): low dark rocks along the bottom edge.  overlay: glowing motes, plankton sparkles, marine snow.
// Static art is painted pixel by pixel into Int32 buffers in bake steps (STEPS, each well under ~100 ms in the
// harness); the live bits are a few sprites and fillRects driven by G.t and hsh(). Never Math.random / rand.
// ============================================================
var L4ART = L4ART || {};
{
const Math = globalThis.Math, clp = clamp, hs = hsh;   // local: global lookups are slow inside the harness's sandbox
const AX0 = 5000;                       // the area starts here (world x)
const WX0 = 4900, WX1 = 6420;           // world strip span (the first boulder overhangs x 5000 a little)
const CAM0 = 4560, CAM1 = 5920;         // camera range the screen strips are painted for (bg is called for 4610..5920)

// ============================================================
// Helpers (copied from src/level3_sky.js: they are private there)
// ============================================================
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const h2 = (x, y, s) => hs(x * 12.9898 + y * 78.233 + s * 37.719);
function vnoise(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hs(i * 1.37 + s * 61.3), hs((i + 1) * 1.37 + s * 61.3), u); }
function fbm(x, s, oct) { let v = 0, a = 1, n = 0, f = 1; for (let o = 0; o < (oct || 3); o++) { v += a * vnoise(x * f, s + o * 17); n += a; a *= 0.5; f *= 2.07; } return v / n; }
let NZT = null;
function makeNZT() {
  let a = 520417; NZT = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); NZT[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
}
const nz = (x, y) => NZT[((Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0) & 65535];
function jvn(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = (s | 0) * 977;
  return lerp(lerp(nz(i + o, j), nz(i + 1 + o, j), a), lerp(nz(i + o, j + 1), nz(i + 1 + o, j + 1), a), b);
}
function jfbm(x, y, s, oct) { let v = 0, a = 1, n = 0, f = 1; for (let o = 0; o < (oct || 3); o++) { v += a * jvn(x * f, y * f, s + o * 13); n += a; a *= 0.5; f *= 2.03; } return v / n; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

const NONE = -1;
const ICACHE = new Map();
const I = s => { let v = ICACHE.get(s); if (v === undefined) { v = parseInt(s.slice(1, 7), 16); ICACHE.set(s, v); } return v; };
const PI = (...s) => s.map(I);
function mixI(a, b, k) {
  k = clp(k, 0, 1);
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  return Math.round(ar + ((b >> 16 & 255) - ar) * k) << 16 | Math.round(ag + ((b >> 8 & 255) - ag) * k) << 8 | Math.round(ab + ((b & 255) - ab) * k);
}
function ramp(pal, t, x, y) { const f = clp(t, 0, 1) * (pal.length - 1), i = Math.floor(f); return pal[Math.min(pal.length - 1, i + (f - i > bay(x, y) ? 1 : 0))]; }
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Pixel buffers: 0xRRGGBB ints, NONE = empty. Local point (x, y) lands on buffer pixel (x + ox, y + oy).
function buf(w, h, ox, oy) { w = Math.ceil(w); h = Math.ceil(h); const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox: ox || 0, oy: oy || 0 }; }
function put(b, x, y, c) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) {
  x = Math.round(x) + b.ox; y = Math.round(y) + b.oy;
  const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(b.w, x + Math.round(w)), y1 = Math.min(b.h, y + Math.round(h));
  for (let r = y0; r < y1; r++) b.d.fill(c, r * b.w + x0, r * b.w + Math.max(x0, x1));
}
function disc(b, cx, cy, r, c) {
  const n = Math.ceil(r), R2 = (r + 0.5) * (r + 0.5), X = Math.round(cx), Y = Math.round(cy);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) if (i * i + j * j <= R2) put(b, X + i, Y + j, c);
}
function oval(b, cx, cy, rx, ry, c) {
  const RX = rx + 0.5, RY = ry + 0.5;
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++)
    if (i * i / (RX * RX) + j * j / (RY * RY) <= 1) put(b, Math.round(cx) + i, Math.round(cy) + j, c);
}
function line(b, x0, y0, x1, y1, c, t) {
  t = t || 1;
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1));
  for (let i = 0; i <= n; i++) rect(b, Math.round(x0 + (x1 - x0) * i / n - (t - 1) / 2), Math.round(y0 + (y1 - y0) * i / n - (t - 1) / 2), t, t, c);
}
function poly(b, pts, c) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const xs = [];
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const yc = y + 0.5; xs.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const ax = pts[i][0], ay = pts[i][1], bx = pts[j][0], by = pts[j][1];
      if ((ay <= yc) !== (by <= yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, q) => a - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x + 0.5 <= xs[k + 1]; x++) put(b, x, y, c);
  }
}
function outline(b, c) {
  const add = [], w = b.w, d = b.d;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i] !== NONE) continue;
    if ((x > 0 && d[i - 1] !== NONE) || (x < w - 1 && d[i + 1] !== NONE) || (y > 0 && d[i - w] !== NONE) || (y < b.h - 1 && d[i + w] !== NONE)) add.push(i);
  }
  for (const i of add) d[i] = c;
}
function bake(b) {
  const c = canvasOf(b.w, b.h), g = c.getContext('2d'), im = g.createImageData(b.w, b.h), d = im.data;
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = i * 4;
    d[j] = (v >> 16) & 255; d[j + 1] = (v >> 8) & 255; d[j + 2] = v & 255; d[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
const sprite = b => ({ img: bake(b), ox: b.ox, oy: b.oy, w: b.w, h: b.h });
const blitS = (g, s, x, y) => g.drawImage(s.img, Math.round(x) - s.ox, Math.round(y) - s.oy);

// Light buffers: float RGB light, baked to an RGBA canvas drawn with 'lighter' (additive bioluminescence)
function lbuf(w, h, ox, oy) { const n = Math.ceil(w) * Math.ceil(h); return { w: Math.ceil(w), h: Math.ceil(h), ox: ox || 0, oy: oy || 0, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n) }; }
function glow(gb, x, y, r, col, a, ry) {
  if (!gb) return;
  ry = ry || r;
  const cr = (col >> 16 & 255) / 255, cg = (col >> 8 & 255) / 255, cb = (col & 255) / 255;
  const x0 = Math.floor(x - r), x1 = Math.ceil(x + r), y0 = Math.floor(y - ry), y1 = Math.ceil(y + ry);
  for (let yy = y0; yy <= y1; yy++) {
    const Y = yy + gb.oy; if (Y < 0 || Y >= gb.h) continue;
    for (let xx = x0; xx <= x1; xx++) {
      const X = xx + gb.ox; if (X < 0 || X >= gb.w) continue;
      const dx = (xx + 0.5 - x) / r, dy = (yy + 0.5 - y) / ry, d = dx * dx + dy * dy;
      if (d >= 1) continue;
      const k = a * (1 - Math.sqrt(d)) ** 2, i = Y * gb.w + X;
      gb.r[i] += cr * k; gb.g[i] += cg * k; gb.b[i] += cb * k;
    }
  }
}
function bakeLight(gb) {
  const c = canvasOf(gb.w, gb.h), g = c.getContext('2d'), im = g.createImageData(gb.w, gb.h), d = im.data;
  for (let i = 0; i < gb.r.length; i++) {
    const r = gb.r[i], gg = gb.g[i], b = gb.b[i], m = Math.max(r, gg, b);
    if (m < 0.006) continue;
    const j = i * 4;
    d[j] = Math.round(r / m * 255); d[j + 1] = Math.round(gg / m * 255); d[j + 2] = Math.round(b / m * 255); d[j + 3] = Math.round(Math.min(1, m) * 255);
  }
  g.putImageData(im, 0, 0);
  return c;
}
// soft round glow sprite (for the live bits)
function haloCanvas(r, col, a) {
  const gb = lbuf(r * 2 + 2, r * 2 + 2, r + 1, r + 1);
  glow(gb, 0, 0, r, I(col), a);
  return { img: bakeLight(gb), o: r + 1 };
}
function lit(g, img, x, y, alpha) { const ga = g.globalAlpha; g.globalCompositeOperation = 'lighter'; g.globalAlpha = ga * alpha; g.drawImage(img, x, y); g.globalAlpha = ga; g.globalCompositeOperation = 'source-over'; }

// Mission 4's seabed (works on the menus too)
const gy = x => L4ART.groundAt(x);

// Screen strips: painted in design coordinates (= screen x at camera CAM0), local x from -10, parallax p
function stripBuf(p, top, bot) { return buf(W + 22 + Math.ceil((CAM1 - CAM0) * p), bot - top, 10, -top); }
function stripLight(b) { return lbuf(b.w, b.h, b.ox, b.oy); }
const sOff = (p, cx, cw) => clp(Math.round((cx - CAM0) * p), 0, cw - W - 20);
function blitStrip(g, c, p, top, cx) { g.drawImage(c, sOff(p, cx, c.width), 0, W + 20, c.height, -10, top, W + 20, c.height); }
const dsx = (sx, cam, p) => sx + (cam - CAM0) * p;        // design x of a thing seen at screen x sx when the camera is at cam
const ssx = (dx, cx, p) => dx - (cx - CAM0) * p;          // screen x of design x dx at camera cx

// ============================================================
// Palette
// ============================================================
const WATER = PI('#1f3166', '#1c2c5e', '#192755', '#17224d', '#151d45', '#13193d', '#121636', '#111330', '#0f102a');
// coral palettes: d dark, b body, m mid, l lit, r glowing rim/tips, t white-hot tips, g the colour of their light
const pal = (d, b, l, r, t, g) => ({ d: I(d), b: I(b), m: mixI(I(b), I(l), 0.5), l: I(l), r: I(r), t: I(t), g: I(g) });
const CYAN = pal('#0f3248', '#17516a', '#26808f', '#3fd8d6', '#b4fff8', '#38f0e2');
const MAG = pal('#3d1442', '#6c2369', '#a33a97', '#ff6fd5', '#ffd6f4', '#ff4cc6');
const VIO = pal('#221b56', '#352a86', '#5844bf', '#a58cff', '#e8e0ff', '#8a66ff');
const WARM = pal('#4a2240', '#a1405f', '#e0707a', '#ffa48a', '#ffe4c8', '#ff8a6a');
const ROCK = PI('#0a0c25', '#0f1230', '#14183b', '#1b2048', '#252a5c', '#343675');
const SAND = PI('#17162f', '#1d1b37', '#23213f', '#2a2748', '#322e55', '#3c3763', '#4a4476');
const STEEL = PI('#161c30', '#222b44', '#313d5c', '#45557a', '#60759c', '#8aa0c2');

// ============================================================
// BG: the water column (screen-fixed) and far-off glows
// ============================================================
function paintWater() {
  const b = buf(W + 20, H + 20, 10, 10);
  for (let y = -10; y < H + 10; y++) for (let x = -10; x < W + 10; x++) {
    const t = (y + 10) / (H + 20) + (jfbm(x / 40, y / 30, 3, 2) - 0.5) * 0.08;
    put(b, x, y, ramp(WATER, t, x + 40, y + 40));
  }
  return bake(b);
}
// big soft glows in the far distance: a luminous coral field along the far floor, two clouds of light higher up
function paintFarGlow() {
  const p = 0.04, b = stripBuf(p, 0, H), gl = stripLight(b), w = b.w - 10;
  for (let x = -10; x < w; x += 14) {
    const n = fbm(x / 70, 21, 2), c = n < 0.4 ? CYAN.g : n < 0.62 ? VIO.g : MAG.g;
    glow(gl, x + hs(x) * 10, 212 + hs(x + 3) * 14, 46 + hs(x + 7) * 30, c, 0.08 + 0.1 * fbm(x / 40, 9, 2), 30);
  }
  for (const [x, y, r, c, a] of [[70, 130, 130, CYAN.g, 0.08], [330, 110, 160, VIO.g, 0.1], [560, 150, 130, MAG.g, 0.07], [210, 70, 130, I('#5a8cff'), 0.06]]) glow(gl, x, y, r, c, a, r * 0.7);
  return bakeLight(gl);
}

// ============================================================
// BG: far abyss spires (p 0.09), silhouettes over the glow
// ============================================================
function paintFar() {
  const p = 0.09, top = 80, b = stripBuf(p, top, H), gl = stripLight(b), w = b.w - 10;
  // hazy far rock (a touch lighter than the water: the farthest plane), stepped spires and mesas with ledges
  const FAR = PI('#16214c', '#1a2756', '#1e2d5e', '#233468', '#2c3f78', '#3a5290');
  const spires = [[-4, 120, 26], [58, 150, 30], [128, 104, 18], [176, 160, 40], [262, 128, 24], [318, 96, 16], [366, 150, 34], [446, 118, 22], [520, 140, 30], [590, 108, 20]];
  const tops = [];
  for (let x = -10; x < w; x++) {
    let yt = 204 + 12 * fbm(x / 60, 3, 3) - 8 * fbm(x / 17, 5, 2);
    for (const [sx, st, hw] of spires) {
      const d = Math.abs(x - sx) / hw;
      if (d < 1) {
        // towers: steep sides, a rounded or broken top, ledges; every third one a flat mesa
        const mesa = Math.round(sx) % 3 === 0, prof = mesa ? ss(0.62, 1, d) : 0.12 * d * d + 0.88 * ss(0.38, 1, d);
        let raw = st + (210 - st) * prof + (mesa ? 0 : 6 * Math.max(0, 0.3 - d));
        raw += (fbm(x / 3, sx, 2) - 0.5) * 4 + (fbm(x / 11, sx + 1, 2) - 0.5) * 8 * (1 - d);
        yt = Math.min(yt, raw);
      }
    }
    yt = Math.round(yt); tops.push(yt);
    for (let y = yt; y < H; y++) {
      const n = jfbm(x / 4, y / 14, 4, 2), up = 1 - ss(yt, yt + 30, y);
      let t = 0.3 + (n - 0.5) * 0.5 - (y - 160) / 260 + up * 0.18;
      if (Math.sin(x * 0.9 + jvn(x * 0.37, y / 9, 5) * 3) > 0.85) t -= 0.12;      // vertical erosion streaks
      put(b, x, y, ramp(FAR, t, x, y));
    }
    put(b, x, yt, FAR[5]); put(b, x, yt + 1, FAR[4]);
  }
  // pin-prick glows of far corals on the spires
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(-8 + hs(i * 3.1) * (w + 6)), yt = tops[x + 10], y = yt + 2 + Math.floor(hs(i * 7.7) * 40);
    if (y >= H) continue;
    const c = [CYAN, MAG, VIO][i % 3];
    put(b, x, y, mixI(c.r, FAR[1], 0.35));
    glow(gl, x + 0.5, y + 0.5, 4, c.g, 0.18);
  }
  return { c: bake(b), l: bakeLight(gl), p, top };
}


// ============================================================
// BG: the cave ceiling (p 0.85): rock with stalactite overhangs, glow-worm threads, all above y 58
// ============================================================
function paintCeiling() {
  const p = 0.85, b = stripBuf(p, 0, 64), gl = stripLight(b), w = b.w - 10;
  const bottom = new Float32Array(w + 12);
  for (let x = -10; x < w; x++) {
    let yb = 14 + 12 * fbm(x / 46, 31, 3) + 5 * fbm(x / 11, 32, 2);
    // stalactites: a spike every 30-70 px, some long, ending at most at y 56
    const cell = Math.floor((x + 400) / 38), cx0 = cell * 38 - 400 + 10 + hs(cell) * 18, hw = 4 + hs(cell * 3.3) * 6, len = 10 + hs(cell * 7.1) * 26;
    const d = Math.abs(x - cx0) / hw;
    if (d < 1) yb = Math.max(yb, Math.min(56, yb + len * Math.pow(1 - d, 1.4)));
    bottom[x + 10] = yb;
  }
  for (let x = -10; x < w; x++) {
    const yb = Math.round(bottom[x + 10]);
    for (let y = 0; y <= yb; y++) {
      const n = jfbm(x / 5, y / 8, 33, 3), e = yb - y;
      let c = ramp(ROCK, 0.1 + n * 0.4, x, y);
      if (e === 0) c = ROCK[5]; else if (e === 1) c = ROCK[4]; else if (e < 4 && n > 0.5) c = ROCK[3];
      put(b, x, y, c);
    }
  }
  // glow-worm threads: silk lines with glowing beads hanging from the underside
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(-8 + hs(i * 4.17 + 9) * (w + 4)), y0 = Math.round(bottom[x + 10]) + 1, len = 3 + Math.floor(hs(i * 1.9) * Math.min(18, 57 - y0));
    if (y0 > 54) continue;
    for (let j = 0; j < len; j++) put(b, x, y0 + j, j % 4 === 3 ? I('#7ff3ff') : I('#1f3d5c'));
    put(b, x, y0 + len, I('#c8fffb'));
    glow(gl, x + 0.5, y0 + len, 5, CYAN.g, 0.22);
  }
  // clusters of glowing dots on the rock (glow-worm colonies)
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(-8 + hs(i * 6.7 + 2) * (w + 4)), y = Math.round(bottom[x + 10]) - 1 - Math.floor(hs(i * 3.3) * 5);
    put(b, x, y, I('#5ee6f0')); glow(gl, x + 0.5, y + 0.5, 6, CYAN.g, 0.12);
  }
  return { c: bake(b), l: bakeLight(gl), p, top: 0 };
}

// ============================================================
// BG live: glowing jellyfish, the anglerfish, lanternfish
// ============================================================
// a real (friendly) jellyfish: a dome with a bright rim, four petals inside, frilly arms and long tentacles; 4 pulse frames
function jellyFrames(size, P) {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const sq = Math.sin(f / 4 * Math.PI * 2), rx = size * (0.5 + 0.05 * sq), ry = size * (0.42 - 0.06 * sq), tl = size * 1.7;
    const b = buf(size * 2 + 8, size * 3 + 8, size + 4, Math.ceil(ry) + 3);
    // tentacles first (behind)
    const nT = size > 16 ? 7 : 5;
    for (let k = 0; k < nT; k++) {
      const x0 = -rx * 0.85 + (k / (nT - 1)) * rx * 1.7;
      for (let j = 0; j < tl; j++) put(b, x0 + Math.sin(j * 0.22 + f * 1.57 + k) * (1 + j * 0.06), j + 1, j > tl * 0.7 ? P.d : P.b);
    }
    // frilly oral arms
    for (const ax of [-rx * 0.25, rx * 0.2]) for (let j = 0; j < tl * 0.62; j++) {
      const xx = ax + Math.sin(j * 0.35 + f * 1.57 + ax) * 1.5;
      put(b, xx, j + 1, P.l); put(b, xx + 1, j + 1, j % 3 ? P.l : P.r);
    }
    // the bell
    for (let y = -Math.ceil(ry); y <= 0; y++) for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
      const e = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (e > 1) continue;
      let c = e > 0.72 ? P.r : P.l;
      if (y > -2 && e > 0.3) c = P.r;
      if (e < 0.5 && y < -ry * 0.45 && x < 0) c = P.t;
      put(b, x, y, c);
    }
    // petals (gonads) inside the bell
    for (let k = 0; k < 4; k++) { const px = (k - 1.5) * rx * 0.36, py = -ry * 0.35; put(b, px, py, P.b); put(b, px + 1, py, P.b); if (size > 16) { put(b, px, py + 1, P.b); put(b, px + 1, py - 1, P.t); } }
    // scalloped rim
    for (let x = -Math.floor(rx); x <= rx; x += 2) put(b, x, 1, P.t);
    frames.push(sprite(b));
  }
  return frames;
}
// a friendly anglerfish: a chubby round body, a big shiny eye, a small smile with two tiny teeth; the lure is drawn live
function anglerSprite() {
  const b = buf(52, 40, 24, 20);
  const D = PI('#0e1232', '#18204c', '#222d62', '#2f3f7c', '#4a68a6', '#6f95c8');
  poly(b, [[-23, -9], [-14, -1], [-23, 8], [-19, -1]], D[2]);       // tail fin
  oval(b, -15, -1, 4, 5, D[1]);
  oval(b, 0, 0, 15, 13, D[1]);                                    // round body
  oval(b, 1, 4, 13, 8, D[2]);                                     // lighter belly
  oval(b, -3, -6, 10, 5, D[0]);                                   // darker back
  poly(b, [[-7, -12], [-2, -17], [2, -12]], D[2]);                // dorsal fin
  poly(b, [[-3, 4], [-10, 11], [0, 8]], D[3]);                    // pectoral fin
  // a small smile under the lure, two tiny teeth
  for (let x = 3; x <= 15; x++) { const y = Math.round(7 - (x - 9) * (x - 9) * 0.06 + (x > 13 ? -1 : 0)); put(b, x, y, D[0]); put(b, x, y + 1, I('#3a2048')); }
  put(b, 6, 7, I('#e2e6f8')); put(b, 9, 8, I('#e2e6f8')); put(b, 12, 7, I('#e2e6f8'));
  // a big shiny eye
  disc(b, 8, -4, 4, I('#dcecff')); disc(b, 9, -4, 3, I('#0c1030')); put(b, 7, -6, I('#ffffff')); put(b, 8, -6, I('#ffffff')); put(b, 7, -5, I('#ffffff')); put(b, 10, -2, I('#8fb8ff'));
  // rosy cheek and the lure's light on the forehead
  put(b, 5, 1, I('#6a4a8a')); put(b, 4, 1, I('#5a3e7a'));
  for (let x = 1; x < 15; x++) { let y = -14; while (y < 0 && get(b, x, y) === NONE) y++; put(b, x, y, D[5]); put(b, x, y + 1, D[4]); }
  // photophores along the side
  for (const [x, y] of [[-9, 4], [-5, 7], [-1, 8], [-11, 1]]) put(b, x, y, I('#3fc7d9'));
  outline(b, I('#070918'));
  return sprite(b);
}
function lanternFish() {
  const b = buf(12, 7, 6, 3);
  rect(b, -3, -1, 7, 3, I('#2a3a70')); rect(b, -2, -2, 5, 1, I('#202c5c')); rect(b, -2, 2, 5, 1, I('#1a2450')); put(b, 4, 0, I('#2a3a70')); put(b, 4, 1, I('#202c5c'));
  put(b, -4, 0, I('#202c5c')); put(b, -5, -1, I('#2a3a70')); put(b, -5, 1, I('#2a3a70')); put(b, -6, -2, I('#202c5c')); put(b, -6, 2, I('#202c5c'));
  put(b, 2, -1, I('#e8f4ff')); put(b, 3, -1, I('#0a0e24'));
  put(b, -2, 1, I('#7ff7ff')); put(b, 0, 1, I('#7ff7ff')); put(b, 2, 1, I('#b8fffb'));
  return sprite(b);
}

// ============================================================
// World: coral garden painters (into the world buffer b and one light buffer per pulse group)
// ============================================================
// organ-pipe tube sponges: shaded cylinders that widen a little at the top, an open glowing lip, glowing spots
function tubes(b, gl, x, y, n, hmax, seed, P) {
  const list = [];
  for (let i = 0; i < n; i++) list.push({ x: x + (i - (n - 1) / 2) * 6 + (h2(i, 1, seed) - 0.5) * 3, h: Math.round(hmax * (0.42 + 0.58 * h2(i, 2, seed))), w: 4 + Math.floor(h2(i, 3, seed) * 3), lean: (h2(i, 4, seed) - 0.5) * 0.3, i });
  list.sort((a, q) => q.h - a.h);
  const SH = [P.t, P.l, P.m, P.b, P.b, P.d];
  for (const t of list) {
    for (let j = 0; j <= t.h; j++) {
      const cx = t.x + t.lean * j + Math.sin(j * 0.09 + seed) * 0.6, ww = Math.round(t.w * (0.8 + 0.3 * j / t.h)), x0 = Math.round(cx - ww / 2);
      for (let k = 0; k < ww; k++) {
        const u = k / Math.max(1, ww - 1);
        let si = u < 0.15 ? 1 : u < 0.4 ? 2 : u < 0.8 ? 3 : 5;
        if (j % 8 === 3 && si > 1 && si < 5) si++;
        put(b, x0 + k, y - j, SH[Math.min(5, si)]);
      }
      if (h2(j, t.i, seed) > 0.9 && j > 3 && j < t.h - 3) { put(b, x0 + 1 + Math.floor(h2(t.i, j, seed) * (ww - 2)), y - j, P.r); }
    }
    const tx = t.x + t.lean * t.h + Math.sin(t.h * 0.09 + seed) * 0.6, ty = y - t.h, rw = Math.round(t.w * 1.1) + 1, x0 = Math.round(tx - rw / 2);
    for (let k = 0; k < rw; k++) { put(b, x0 + k, ty - 1, k === 0 || k === rw - 1 ? P.r : P.d); put(b, x0 + k, ty, P.r); put(b, x0 + k, ty - 2, k > 0 && k < rw - 1 ? P.r : NONE); }
    put(b, x0 + 1, ty - 2, P.t); put(b, x0 + 2, ty - 2, P.t);
    glow(gl, tx, ty - 1, 9 + t.w, P.g, 0.42, 7);
  }
  glow(gl, x, y - hmax * 0.45, hmax * 0.6 + 10, P.g, 0.12);
}
// gorgonian sea fan: main branches spread in a fan, twigs on alternating sides, a fine glowing mesh between them,
// glowing polyps on every tip
function fan(b, gl, x, y, h, seed, P) {
  const tips = [], strokes = [], nm = 4 + Math.floor(h2(1, 2, seed) * 2), rows = new Map();
  const mark = (px, py, c) => { strokes.push([px, py, c]); const r = Math.round(py), e = rows.get(r); const X = Math.round(px); if (!e) rows.set(r, [X, X]); else { e[0] = Math.min(e[0], X); e[1] = Math.max(e[1], X); } };
  for (let m = 0; m < nm; m++) {
    let a = -Math.PI / 2 + ((m / (nm - 1)) - 0.5) * 1.6 + (h2(m, 3, seed) - 0.5) * 0.2;
    const len = h * (0.5 + 0.5 * Math.sin(Math.PI * (0.12 + 0.76 * m / (nm - 1)))) * (0.9 + 0.2 * h2(m, 4, seed));
    let px = x, py = y - 3, side = m % 2 ? 1 : -1;
    for (let s = 0; s < len; s++) {
      a += (-Math.PI / 2 - a) * 0.014 + Math.sin(s * 0.2 + m + seed) * 0.012;
      px += Math.cos(a); py += Math.sin(a);
      const k = s / len;
      mark(px, py, k < 0.3 ? P.d : k < 0.7 ? P.b : P.m);
      if (k < 0.2) mark(px + 1, py, P.d);
      if (s > 4 && s % 3 === 0) {
        const ta = a + side * (0.65 + h2(s, m, seed) * 0.35), tl = 2 + (1 - k) * 6 * h2(m, s, seed + 1);
        let qx = px, qy = py;
        for (let q = 0; q < tl; q++) { qx += Math.cos(ta - side * q * 0.07); qy += Math.sin(ta - side * q * 0.07); mark(qx, qy, k < 0.5 ? P.b : P.m); }
        tips.push([qx, qy]); side = -side;
      }
    }
    tips.push([px, py]);
  }
  // the mesh: a dithered net filling each row between the outermost branches (thinner toward the base)
  for (const [r, [x0, x1]] of rows) {
    if (r > y - 6) continue;
    for (let X = x0 + 1; X < x1; X++) if (((X + r) & 1) === 0 && ((X >> 1) + (r >> 1)) % 3 !== 0 && get(b, X, r) === NONE) put(b, X, r, (r % 4 < 2) ? P.d : mixI(P.d, P.b, 0.45));
  }
  line(b, x, y, x, y - 4, P.d, 2);
  for (const [px, py, c] of strokes) put(b, px, py, c);
  for (const [tx, ty] of tips) { put(b, tx, ty, P.r); if (h2(tx, ty, 3) > 0.6) put(b, tx, ty - 1, P.t); glow(gl, tx, ty, 4, P.g, 0.2); }
  glow(gl, x, y - h * 0.6, h * 0.6, P.g, 0.14, h * 0.55);
}
// brain coral: a dome with meandering grooves, lit from above, glowing ridge crests
function dome(b, gl, x, y, rx, ry, seed, P) {
  for (let yy = -ry; yy <= 0; yy++) for (let xx = -rx; xx <= rx; xx++) {
    const e = xx * xx / (rx * rx) + yy * yy / (ry * ry);
    if (e > 1) continue;
    const v = jfbm((xx + 100) * 0.09, (yy + 100) * 0.12, seed, 2) * 6 + xx * 0.04, f = v - Math.floor(v);
    const nyy = -yy / ry, light = nyy * 0.7 - xx / rx * 0.3;
    let c;
    if (f < 0.2) c = e > 0.85 ? P.d : P.b;
    else if (f < 0.32 || f > 0.9) c = light > 0.35 ? P.m : P.b;
    else c = light > 0.5 ? P.r : light > 0.1 ? P.l : P.m;
    if (e > 0.92) c = P.d;
    put(b, x + xx, y + yy, c);
    if (c === P.r && h2(xx, yy, seed) > 0.9) glow(gl, x + xx, y + yy, 5, P.g, 0.18);
  }
  glow(gl, x, y - ry * 0.6, rx + 8, P.g, 0.15, ry + 6);
}
function anemone(b, gl, x, y, s, seed, P) {
  const top = y - s * 0.55;
  for (let yy = top; yy <= y; yy++) { const w = s * 0.3 + (y - yy) * 0.06; for (let xx = -w; xx <= w; xx++) put(b, x + xx, yy, xx < -w + 1.5 ? P.l : xx > w - 1.5 ? P.d : P.b); }
  const n = 9 + Math.floor(s / 4);
  for (let k = 0; k < n; k++) {
    const a = -Math.PI * (0.06 + 0.88 * k / (n - 1)), len = s * (0.75 + 0.35 * h2(k, 1, seed)), curl = (h2(k, 2, seed) - 0.5) * 0.9;
    let px = x + Math.cos(a) * s * 0.25, py = top;
    for (let j = 0; j < len; j++) {
      const aa = a + curl * j / len;
      px += Math.cos(aa) * 0.9; py += Math.sin(aa) * 0.9;
      put(b, px, py, j > len - 3 ? P.r : P.l);
    }
    put(b, px, py, P.t);
    glow(gl, px, py, 5, P.g, 0.25);
  }
  glow(gl, x, top - s * 0.3, s * 1.1, P.g, 0.16);
}
function seaPen(b, gl, x, y, h, seed) {
  const P = WARM, lean = (hs(seed) - 0.5) * 0.2;
  oval(b, x, y - 1, 2, 1, P.d);
  for (let j = 0; j < h; j++) put(b, x + lean * j, y - j, j < h * 0.3 ? P.d : P.l);
  for (let j = Math.floor(h * 0.3); j < h - 1; j += 2) {
    const cx = x + lean * j, yy = y - j, k = (j - h * 0.3) / (h * 0.7), len = Math.max(1, Math.round(5.5 * Math.sin(Math.PI * Math.min(1, k * 1.1 + 0.08))));
    for (const sd of [-1, 1]) for (let i = 1; i <= len; i++) put(b, cx + sd * i, yy - Math.round(i * i / 7), i === len ? P.r : i === 1 ? P.b : P.l);
  }
  put(b, x + lean * h, y - h, P.t); put(b, x + lean * (h - 1), y - h + 1, P.r);
  glow(gl, x + lean * h * 0.7, y - h * 0.65, 7 + h * 0.3, P.g, 0.3, h * 0.42);
}
function worms(b, gl, x, y, n, seed) {
  const T = PI('#3e3450', '#76667c', '#ab98a4', '#d9c8c4', '#f2e6dc'), PL = PI('#6a1230', '#c0213c', '#f0404e', '#ff7a78', '#ffc4b8');
  const list = [];
  for (let i = 0; i < n; i++) list.push({ x: x + (i - (n - 1) / 2) * 3.6 + (h2(i, 5, seed) - 0.5) * 2, h: 7 + h2(i, 6, seed) * 22, lean: (h2(i, 7, seed) - 0.5) * 0.35 });
  list.sort((a, q) => q.h - a.h);
  for (const t of list) {
    for (let j = 0; j < t.h; j++) {
      const cx = Math.round(t.x + t.lean * j + Math.sin(j * 0.25 + t.x) * 0.5), ring = j % 4 === 0;
      put(b, cx - 1, y - j, T[3]); put(b, cx, y - j, ring ? T[3] : T[4]); put(b, cx + 1, y - j, ring ? T[1] : T[2]);
    }
    const tx = Math.round(t.x + t.lean * t.h), ty = Math.round(y - t.h);
    // the red plume: a feathery crown of gills, darker at the collar
    put(b, tx - 1, ty, PL[0]); put(b, tx, ty, PL[1]); put(b, tx + 1, ty, PL[0]);
    for (let r = 1; r <= 4; r++) {
      const hw = r < 3 ? 1 + r : 3;
      for (let k = -hw; k <= hw; k++) put(b, tx + k, ty - r, r === 4 ? ((k & 1) ? PL[4] : NONE) : (k + r) & 1 ? PL[2] : PL[3]);
    }
    put(b, tx - 3, ty - 4, PL[4]); put(b, tx + 3, ty - 4, PL[4]);
    glow(gl, tx, ty - 3, 7, PL[2], 0.2);
  }
}
function boulder(b, gl, x, y, w, h, seed, tint) {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const a = Math.PI + Math.PI * i / 24, r = 0.85 + 0.3 * fbm(i / 4, seed, 2); pts.push([x + Math.cos(a) * w * r, y + Math.sin(a) * h * r]); }
  pts.push([x + w, y + 2], [x - w, y + 2]);
  const tmp = buf(w * 3 + 4, h * 2 + 8, Math.round(w * 1.5 - x) + 2, Math.round(h * 1.4 - y) + 4);
  poly(tmp, pts, 1);
  for (let yy = -tmp.oy; yy < tmp.h - tmp.oy; yy++) for (let xx = -tmp.ox; xx < tmp.w - tmp.ox; xx++) {
    if (get(tmp, xx, yy) === NONE) continue;
    const top = get(tmp, xx, yy - 1) === NONE, top2 = get(tmp, xx, yy - 2) === NONE, left = get(tmp, xx - 1, yy) === NONE;
    const n = jfbm(xx / 4, yy / 4, seed, 3), ny = (yy - (y - h)) / (h + 2);
    let c = ramp(ROCK, 0.55 - ny * 0.45 + (n - 0.5) * 0.5, xx, yy);
    if (top) c = tint ? mixI(ROCK[5], tint, 0.35) : ROCK[5]; else if (top2 || left) c = ROCK[4];
    put(b, xx, yy, c);
  }
}
function starfish(b, x, y, s, c1, c2) {
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; for (let r = 0; r <= s; r++) { put(b, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, r === s ? c2 : c1); } }
  put(b, x, y, c2);
}


// ============================================================
// BG: mid cave pillars and arches (p 0.22), dark, lit at the rims by the glow. Baked in steps (mask, shade, extras)
// ============================================================
const MIDP = 0.22;
const MIDC = PI('#0b1030', '#0f1537', '#131a40', '#182149', '#1f2956', '#2a356f', '#3a4890');
const RIMR = I('#46307a');
// pillars [x, half width, top y (0 = up behind the ceiling), window y, window radius]; the great arch; mounds on the floor
const PILLARS = [[150, 22, 0, 0, 0], [500, 13, 158, 0, 0], [600, 19, 0, 0, 0], [724, 32, 112, 150, 9]];
const ARCH = { x: 375, rx: 62, ry: 168, hx: 30, hy: 128, floor: 232 };
let MS = null;   // mid build state
function midInit() {
  const b = stripBuf(MIDP, 0, H), w = b.w - 10;
  const floorY = [], strata = [], pw = PILLARS.map(() => []), pc = PILLARS.map(() => []), arR = [], arH = [];
  // the noise terms depend on x only or on y only: tabulate them once (the mask is tested ~200k times)
  for (let x = -10; x < w; x++) { floorY.push(222 + 7 * fbm(x / 34, 2, 2) - 14 * Math.max(0, Math.sin(x / 61 + 1)) ** 3); strata.push(5 * fbm(x / 26, 11, 2)); }
  for (let y = 0; y < H; y++) {
    PILLARS.forEach(([px, hw, top], i) => {
      const cap = top ? Math.sqrt(clp((y - top) / 7, 0, 1)) : 1;
      pw[i].push((hw * (0.78 + 0.4 * fbm(y / 38, px, 2)) + 10 * ss(170, 232, y)) * cap); pc[i].push(px + 8 * (fbm(y / 60, px + 3, 2) - 0.5));
    });
    arR.push(ARCH.rx + 4 * (fbm(y / 25, 7, 2) - 0.5)); arH.push(ARCH.hx + 5 * (fbm(y / 20, 8, 2) - 0.5));
  }
  const inside = (x, y) => {
    if (y >= floorY[x + 10]) return true;
    for (let i = 0; i < PILLARS.length; i++) {
      const [px, , top, wy, wr] = PILLARS[i];
      if (y < top || Math.abs(x - pc[i][y]) >= pw[i][y]) continue;
      if (wr && (x - px) ** 2 + ((y - wy) * 0.8) ** 2 < wr * wr) continue;   // a natural window through the stack
      return true;
    }
    const nx = (x - ARCH.x) / arR[y], ny = (y - ARCH.floor) / ARCH.ry;
    if (y <= ARCH.floor && nx * nx + ny * ny <= 1) {
      const hx = (x - ARCH.x) / arH[y], hy = (y - ARCH.floor) / ARCH.hy;
      if (hx * hx + hy * hy >= 1) return true;
    }
    return false;
  };
  const mw = w + 10, M = new Uint8Array(mw * H);
  MS = { b, gl: stripLight(b), w, mw, M, inside, strata, m: (x, y) => x >= -10 && x < w && y >= 0 && y < H && M[y * mw + x + 10] === 1 };
}
function midMask(y0, y1) { const { w, mw, M, inside } = MS; for (let y = y0; y < y1; y++) for (let x = -10; x < w; x++) if (inside(x, y)) M[y * mw + x + 10] = 1; }
// shade each row's runs as rounded rock: lit on the left, a violet rim on the right, brighter low down where the
// glowing gardens light it, wavy strata and cracks
function midShade(y0, y1) {
  const { b, w, m, strata } = MS;
  for (let y = y0; y < y1; y++) {
    let x = -10;
    while (x < w) {
      if (!m(x, y)) { x++; continue; }
      let x1 = x; while (x1 < w && m(x1, y)) x1++;
      const run = x1 - x;
      for (let q = x; q < x1; q++) {
        const u = run > 1 ? (q - x) / (run - 1) : 0.5, n = jfbm(q / 6, y / 9, 7, 3);
        let t = 0.14 + 0.32 * (1 - ss(0, 0.45, u)) * (run > 60 ? 0.4 : 1) + (n - 0.5) * 0.3 + 0.16 * ss(150, 228, y);
        if (Math.sin((y + strata[q + 10]) * 0.4) > 0.94) t -= 0.12;
        if (Math.abs(jfbm(q / 13, y / 17, 12, 2) - 0.5) < 0.014) t = 0;
        let c = ramp(MIDC, t, q, y);
        if (!m(q - 1, y) || !m(q, y - 1)) c = MIDC[5];
        else if (!m(q - 2, y) || !m(q - 1, y - 1)) c = MIDC[4];
        else if (!m(q + 1, y) || (!m(q + 2, y) && y > 150)) c = RIMR;
        put(b, q, y, c);
      }
      x = x1;
    }
  }
}
function midFinish() {
  const { b, gl, w, m } = MS;
  // glow-worm colonies speckling the rock
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(-8 + hs(i * 2.71 + 3) * (w + 4)), y = Math.floor(hs(i * 6.13) * (H - 40));
    if (!m(x, y) || !m(x, y + 2)) continue;
    put(b, x, y, i % 5 ? I('#2f6a8a') : I('#6fe8f0')); if (i % 5 === 0) glow(gl, x + 0.5, y + 0.5, 4, CYAN.g, 0.16);
  }
  // glowing coral tufts on the ledges and the mid floor
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(-6 + hs(i * 5.3 + 1) * (w + 2));
    let y = 2; while (y < H && !m(x, y)) y++;
    if (y >= H - 2 || y < 60) continue;
    const c = [CYAN, MAG, VIO, WARM][i % 4], n = 2 + Math.floor(hs(i * 2.9) * 4);
    for (let k = 0; k < n; k++) {
      const xx = x + k - (n >> 1), hh = 1 + Math.floor(hs(i * 9 + k) * 5);
      for (let j = 0; j < hh; j++) put(b, xx, y - 1 - j, mixI(c.b, MIDC[2], 0.35));
      put(b, xx, y - 1 - hh, mixI(c.r, MIDC[2], 0.3));
    }
    glow(gl, x, y - 3, 10, c.g, 0.15);
  }
  // glowing strands hanging under the arch (like glow-worm silk)
  for (let i = 0; i < 9; i++) {
    const x = Math.round(ARCH.x - ARCH.hx + 6 + i * (ARCH.hx * 2 - 12) / 8 + (hs(i * 3) - 0.5) * 4);
    let y = ARCH.floor - ARCH.hy; while (y > 0 && !m(x, y)) y--;
    if (!m(x, y)) continue;
    const len = 4 + Math.floor(hs(i * 7.3) * 14);
    for (let j = 1; j <= len; j++) put(b, x, y + j, j % 4 === 0 ? I('#5fd6e6') : I('#1b2c56'));
    put(b, x, y + len + 1, I('#a8fbff'));
    glow(gl, x + 0.5, y + len + 1, 6, CYAN.g, 0.25);
  }
  BG.mid = { c: bake(b), l: bakeLight(gl), p: MIDP, top: 0 };
  MS = null;
}

// ============================================================
// World: the MEGA OCTOPUS lair, dug into the cave's end wall (world x 6150-6400). The boss comes out of the hatch.
// ============================================================
const HX = 6316, HY = 120, HR = 71;        // the hatch: centre and opening radius (hazard band to 78, steel ring to 86)
const AP = 96;                             // the octagon bulkhead round it (apothem)
const DX = 6210, DRX = 17, DRY = 86;       // the vault door, swung open to the left: centre and radii
const BEACONS = [[6246, 62], [6386, 62]];
const PORTS = [[6246, 178], [6386, 178]];
const SIGN = [6180, 17];                   // the hanging emblem sign (between the HUD panels at the boss camera)
const SD = PI('#0d1120', '#131a2c', '#1b2339', '#242f4a', '#30405f', '#44597e', '#6a82a8');
const oct = (dx, dy) => Math.max(Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) / Math.SQRT2);
const inHole = (x, y) => Math.hypot(x - HX, y - HY) < HR - 0.5;
// the rock massif: an overhang at the top, the wall the bulkhead is set into, a talus at the foot
function lairRock(b) {
  const edge = y => y < 44 ? 6146 + 40 * ss(0, 44, y) + 8 * fbm(y / 9, 41, 2) : 6190 + 9 * fbm(y / 16, 42, 3) - 16 * ss(200, 246, y) + 3 * Math.sin(y / 11);
  for (let y = 0; y < 250; y++) {
    const ex = Math.round(edge(y));
    for (let x = ex; x < WX1; x++) {
      const n = jfbm(x / 6, y / 7, 43, 3), e = x - ex;
      let c = ramp(ROCK, 0.18 + n * 0.45 - (y < 60 ? 0.1 : 0), x, y);
      if (e === 0) c = ROCK[5]; else if (e < 3) c = ROCK[4]; else if (e < 6 && n > 0.55) c = ROCK[3];
      if (Math.abs(jfbm(x / 22, y / 30, 44, 2) - 0.5) < 0.012) c = ROCK[0];   // cracks
      put(b, x, y, c);
    }
  }
}
// the bulkhead: an octagon of dark riveted steel plates, grimy, rock creeping back over its rim, barnacles, portholes
function lairBulkhead(b, gl) {
  for (let y = HY - AP - 1; y <= HY + AP + 1; y++) for (let x = HX - AP - 1; x <= Math.min(WX1 - 1, HX + AP + 1); x++) {
    const dx = x - HX, dy = y - HY, o = oct(dx, dy);
    if (o > AP || Math.hypot(dx, dy) < 86) continue;
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), light = Math.cos(ang + Math.PI * 0.75);   // facet lit from the upper left
    const a8 = Math.atan2(dy, dx) / (Math.PI / 4), seam = Math.abs(a8 - Math.round(a8 - 0.5) - 0.5) * (Math.PI / 4) * Math.hypot(dx, dy) < 0.6;
    const grime = jfbm(x / 5, y / 5, 45, 3);
    let t = 0.4 + light * 0.17 + (grime > 0.62 ? -0.1 : grime < 0.3 ? 0.05 : 0) + (o > AP - 2 ? 0.2 * Math.sign(light) : 0);
    if (Math.abs(o - (AP - 5)) < 0.7) t = 0.08; else if (Math.abs(o - (AP - 6)) < 0.7) t += 0.18;
    if (seam) t = 0.06;
    put(b, x, y, SD[clp(Math.round(t * 6 + (bay(x, y) - 0.5) * 0.35), 0, 6)]);
    if ((Math.abs(o - (AP - 2.5)) < 0.6 || Math.abs(o - (AP - 7.5)) < 0.6) && Math.round(x + y) % 6 === 0) put(b, x, y, SD[6]);
  }
  for (let y = HY - AP - 1; y <= HY + AP + 1; y++) for (let x = HX - AP - 1; x <= HX + AP + 1; x++) {
    const o = oct(x - HX, y - HY);
    if (o > AP || o < AP - 9) continue;
    const n = jfbm(x / 9, y / 9, 46, 3);
    if (n > 0.6 + (AP - o) * 0.025) put(b, x, y, ramp(ROCK, 0.2 + (n - 0.6) * 2, x, y));
    else if (n > 0.57 + (AP - o) * 0.025) put(b, x, y, ROCK[5]);
  }
  for (let i = 0; i < 30; i++) {
    const a = hs(i * 3.3 + 7) * Math.PI * 2, r = 88 + hs(i * 5.7) * 6, x = Math.round(HX + Math.cos(a) * r), y = Math.round(HY + Math.sin(a) * r);
    if (i % 3) { put(b, x, y, SD[5]); put(b, x + 1, y, SD[3]); put(b, x, y + 1, SD[2]); }
    else { const P = [CYAN, MAG, VIO][(i / 3) % 3]; put(b, x, y, P.r); put(b, x, y + 1, P.b); glow(gl.cyan, x + 0.5, y, 4, P.g, 0.18); }
  }
  for (const [px, py] of PORTS) {
    disc(b, px, py, 5, SD[0]); disc(b, px, py, 4, SD[5]); disc(b, px + 1, py + 1, 3, SD[2]);
    disc(b, px, py, 2, I('#a8521a')); put(b, px + 1, py + 1, I('#f0a040')); put(b, px - 1, py - 1, I('#ffe2a8')); put(b, px, py, I('#e38a2a'));
    for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) put(b, px + dx, py + dy, SD[6]);
    glow(gl.warm, px, py, 12, I('#ff9a3c'), 0.3);
  }
  for (const [bx, by] of BEACONS) { rect(b, bx - 4, by + 1, 9, 3, SD[0]); rect(b, bx - 3, by + 1, 7, 1, SD[4]); }
}
// the opening: a tunnel into the robot factory. Ribs shrinking toward a red furnace glow, claw arms on a rail, a conveyor
// of robot-jelly domes (two red eyes at the back are live, until the boss is out)
function lairTunnel(b, gl) {
  const TX = HX, TY = HY + 6;
  for (let y = HY - HR; y <= HY + HR; y++) for (let x = HX - HR; x <= HX + HR; x++) {
    if (!inHole(x, y)) continue;
    const d = Math.hypot(x - TX, (y - TY) * 1.08), rib = [61, 46, 33, 22].find(r => Math.abs(d - r) < (r > 40 ? 1.4 : 0.9));
    let c = mixI(I('#04051a'), I('#0a0b26'), ss(70, 14, d));
    if (d < 19) c = bay(x, y) < ss(19, 5, d) ? I('#5a1426') : I('#2a0a1e');
    if (d < 8) c = bay(x, y) < ss(8, 1, d) ? I('#c43a2a') : I('#7a1a26');
    if (rib) c = y < TY - rib * 0.5 ? I('#2e3a5e') : y < TY ? I('#1f2846') : I('#141a32');
    put(b, x, y, c);
  }
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; for (let r = 23; r < 61; r++) { const x = TX + Math.cos(a) * r, y = TY + Math.sin(a) * r / 1.08; if (inHole(x, y)) put(b, x, y, I('#121831')); } }
  for (let x = HX - HR; x <= HX + HR; x++) if (inHole(x, HY - 39)) { put(b, x, HY - 40, I('#3a4668')); put(b, x, HY - 39, I('#232c48')); }
  for (const [kx, len] of [[-34, 30], [3, 42], [38, 25]]) {
    for (let y = HY - 38; y < HY - 38 + len; y++) { put(b, HX + kx, y, I('#2a3454')); put(b, HX + kx + 1, y, I('#161c34')); }
    const cy = HY - 38 + len;
    rect(b, HX + kx - 3, cy, 8, 3, I('#3c486c')); rect(b, HX + kx - 3, cy, 8, 1, I('#56648c'));
    for (const sx of [-1, 1]) for (let j = 0; j < 6; j++) put(b, HX + kx + (sx < 0 ? -3 : 4) + sx * Math.round(j * 0.5 - (j > 3 ? (j - 3) : 0)), cy + 3 + j, I('#2f3a5c'));
  }
  for (let x = HX - HR; x <= HX + HR; x++) if (inHole(x, HY + 52)) {
    put(b, x, HY + 50, I('#46557a')); put(b, x, HY + 51, I('#2a3352')); put(b, x, HY + 52, x % 6 < 3 ? I('#38446a') : I('#151b32')); put(b, x, HY + 53, I('#0d1124'));
    if (x % 6 === 0) put(b, x, HY + 54, I('#1f2846'));
  }
  for (const kx of [-45, -20, 8, 35]) {
    const yy = HY + 49;
    for (let j = -7; j <= 0; j++) for (let i = -7; i <= 7; i++) if (i * i / 49 + j * j / 49 <= 1 && inHole(HX + kx + i, yy + j)) put(b, HX + kx + i, yy + j, j < -5 ? I('#7a8cb0') : i < -3 ? I('#5a6a90') : I('#3c4a6c'));
    put(b, HX + kx - 3, yy - 6, I('#b0c0dc')); rect(b, HX + kx - 3, yy - 3, 2, 2, I('#ff4a48')); rect(b, HX + kx + 2, yy - 3, 2, 2, I('#ff4a48'));
    for (let i = -6; i <= 6; i += 3) put(b, HX + kx + i, yy + 1, I('#2f3b59'));
  }
  glow(gl.warm, TX, TY, 42, I('#ff3a3a'), 0.22, 36);
  glow(gl.warm, TX, TY, 14, I('#ff6a3a'), 0.35);
}
// the hazard band and the dark steel ring (kept darker than the boss's gunmetal crown so it reads in front), the door,
// the hanging emblem sign
function lairRing(b) {
  for (let y = HY - 87; y <= HY + 87; y++) for (let x = HX - 87; x <= Math.min(WX1 - 1, HX + 87); x++) {
    const d = Math.hypot(x - HX, y - HY);
    if (d < HR - 0.5 || d > 86.5) continue;
    const a = Math.atan2(y - HY, x - HX), light = Math.cos(a + Math.PI * 0.75);
    let c;
    if (d <= 78) {
      c = (Math.floor((a * 75 + d * 1.2) / 3.5) & 1) ? (light > 0.2 ? I('#c79a2a') : I('#9c7420')) : I('#1a1822');
      if (d > 77) c = SD[0];
    } else {
      const t = 0.42 + light * 0.25 + (d > 84.5 ? -0.25 : d < 80 ? 0.1 : 0);
      c = SD[clp(Math.round(t * 6 + (bay(x, y) - 0.5) * 0.4), 0, 5)];
    }
    put(b, x, y, c);
  }
  for (let k = 0; k < 24; k++) { const a = k * Math.PI * 2 / 24 + 0.13, x = HX + Math.cos(a) * 82, y = HY + Math.sin(a) * 82; put(b, x, y, SD[6]); put(b, x + 1, y + 1, SD[0]); }
  // the vault door, swung open to the left (seen nearly edge on): steel, a hazard edge, rivets, the wheel, hinge arms
  for (let y = HY - DRY; y <= HY + DRY; y++) for (let x = DX - DRX; x <= DX + DRX; x++) {
    const e = (x - DX) ** 2 / (DRX * DRX) + (y - HY) ** 2 / (DRY * DRY);
    if (e > 1) continue;
    let c = SD[clp(Math.round((0.5 - (x - DX) / 40 - (y - HY) / 420) * 6 + (bay(x, y) - 0.5) * 0.5), 0, 5)];
    if (e > 0.86) { c = (Math.floor((y + x) / 4) & 1) ? I('#9c7420') : I('#1a1822'); if (e > 0.95) c = SD[0]; }
    put(b, x, y, c);
  }
  for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2, x = DX + Math.cos(a) * (DRX - 3.5), y = HY + Math.sin(a) * (DRY - 11); put(b, x, y, SD[6]); put(b, x + 1, y + 1, SD[0]); }
  for (let y = HY - 26; y <= HY + 26; y++) { put(b, DX - 1, y, SD[0]); put(b, DX, y, SD[5]); }
  for (let x = DX - 6; x <= DX + 6; x++) { put(b, x, HY, SD[6]); put(b, x, HY + 1, SD[0]); }
  for (let j = 0; j < 40; j++) { const a = j / 40 * Math.PI * 2; put(b, DX + Math.cos(a) * 5, HY + Math.sin(a) * 22, SD[1]); }
  oval(b, DX, HY, 2, 5, I('#c0392b')); put(b, DX - 1, HY - 3, I('#ff8a78'));
  for (const hy of [HY - 54, HY + 54]) { rect(b, DX + 14, hy - 3, 12, 6, SD[2]); rect(b, DX + 14, hy - 3, 12, 1, SD[5]); rect(b, DX + 14, hy + 2, 12, 1, SD[0]); put(b, DX + 23, hy, SD[6]); }
  // the emblem sign hanging on two chains from the overhang: a cartoon robot octopus on a hazard-framed plate
  const [EX, EY] = SIGN;
  for (const cx of [EX - 12, EX + 12]) for (let y = 0; y < EY - 11; y++) put(b, cx, y, y % 3 === 2 ? I('#0b0d1e') : I('#3a4668'));
  rect(b, EX - 18, EY - 12, 36, 24, I('#1a1822'));
  for (let y = EY - 11; y <= EY + 10; y++) for (let x = EX - 17; x <= EX + 16; x++) {
    const border = x < EX - 14 || x > EX + 13 || y < EY - 8 || y > EY + 7;
    put(b, x, y, border ? ((Math.floor((x + y) / 3) & 1) ? I('#c79a2a') : I('#1a1822')) : STEEL[1]);
  }
  for (let y = EY - 7; y <= EY + 1; y++) for (let x = EX - 8; x <= EX + 8; x++) { const e = (x - EX) ** 2 / 72 + (y - EY - 1) ** 2 / 64; if (e <= 1) put(b, x, y, e > 0.7 ? STEEL[3] : STEEL[4]); }
  for (const ex of [-4, 3]) { rect(b, EX + ex, EY - 3, 2, 2, I('#ff4040')); put(b, EX + ex, EY - 3, I('#ffd0c0')); }
  rect(b, EX - 3, EY, 6, 1, STEEL[1]);
  for (let k = 0; k < 5; k++) { const tx = EX - 8 + k * 4; for (let j = 0; j < 5; j++) put(b, tx + Math.round(Math.sin(j * 0.9 + k)), EY + 2 + j, j === 4 ? STEEL[3] : STEEL[4]); }
  for (const [rx, ry] of [[EX - 16, EY - 10], [EX + 15, EY - 10], [EX - 16, EY + 9], [EX + 15, EY + 9]]) put(b, rx, ry, STEEL[5]);
}
// pipes from the lair along the floor, a valve, a gauge, a vent (bubbles are live), some robot scrap
const VENT = 6112;
function paintPipes(b, gl) {
  const PP = PI('#151b2e', '#232c45', '#36446a', '#4f6390', '#7590bb');
  const yA = Math.round(gy(6180)) - 7;
  for (let x = VENT; x <= 6232; x++) for (let j = -4; j <= 4; j++) put(b, x, yA + j, Math.abs(j) === 4 ? PP[0] : ramp(PP, 0.75 - Math.abs(j + 1.5) / 6, x, yA + j));
  for (let x = VENT + 6; x < 6232; x += 22) { for (let j = -5; j <= 5; j++) { put(b, x, yA + j, PP[3]); put(b, x + 1, yA + j, PP[1]); put(b, x + 2, yA + j, PP[0]); } put(b, x, yA - 3, PP[4]); }
  for (let x = 6208; x < 6232; x++) for (let j = -3; j <= 3; j++) put(b, x, yA + j, (Math.floor((x + j) / 3) & 1) ? I('#b68c26') : I('#1a1822'));
  for (let y = yA - 16; y <= yA; y++) for (let i = -4; i <= 4; i++) put(b, VENT + i, y, Math.abs(i) === 4 ? PP[0] : ramp(PP, 0.75 - Math.abs(i + 1.5) / 6, VENT + i, y));
  rect(b, VENT - 6, yA - 19, 13, 4, PP[1]); rect(b, VENT - 6, yA - 19, 13, 1, PP[4]); rect(b, VENT - 5, yA - 18, 11, 1, I('#05060f'));
  const vx = 6152, vy = yA - 10;
  for (let y = vy; y < yA - 3; y++) put(b, vx, y, PP[2]);
  oval(b, vx, vy - 1, 6, 2, I('#7a1c22')); oval(b, vx, vy - 1, 5, 1, I('#c0392b')); put(b, vx - 3, vy - 2, I('#ff8a78')); put(b, vx, vy - 1, PP[4]);
  disc(b, 6178, yA - 9, 3, PP[4]); disc(b, 6178, yA - 9, 2, I('#e8e4d0')); put(b, 6179, yA - 10, I('#c0392b')); put(b, 6178, yA - 9, I('#1a1822'));
  for (let y = yA - 6; y < yA - 3; y++) put(b, 6178, y, PP[2]);
  const gs = x => Math.round(gy(x));
  oval(b, 6130, gs(6130) - 2, 6, 4, STEEL[2]); oval(b, 6129, gs(6130) - 4, 4, 2, STEEL[3]); put(b, 6127, gs(6130) - 5, STEEL[5]); rect(b, 6126, gs(6130) - 3, 2, 1, I('#5a1a20'));
  rect(b, 6098, gs(6098) - 2, 7, 2, STEEL[1]); rect(b, 6140, gs(6140) - 1, 5, 1, STEEL[3]);
  glow(gl.warm, 6178, yA - 9, 6, I('#ffc070'), 0.1);
}

// ============================================================
// World: the coral gardens, the ground strip, the light layers
// ============================================================
// left to right: [kind, x, size, palette or boulder height, count, lift (sits on a boulder)]
const GARDEN = [
  ['boulder', 5018, 32, 22], ['tubes', 5014, 34, CYAN, 5, 18], ['fan', 5046, 52, MAG], ['worms', 5068, 6], ['pen', 5082, 32],
  ['dome', 5106, 16, VIO], ['anem', 5130, 18, CYAN], ['tubes', 5154, 30, VIO, 4], ['pen', 5176, 38], ['pen', 5185, 28],
  ['fan', 5204, 44, VIO], ['worms', 5224, 5],
  ['boulder', 5250, 22, 16], ['tubes', 5248, 36, CYAN, 4, 14], ['pen', 5272, 36], ['pen', 5281, 26],
  ['tubes', 5294, 16, VIO, 3], ['fan', 5320, 72, MAG], ['worms', 5352, 7], ['anem', 5376, 14, CYAN],
  ['dome', 5404, 22, VIO], ['pen', 5430, 40], ['pen', 5439, 29], ['pen', 5448, 34], ['anem', 5472, 16, MAG],
  ['boulder', 5512, 36, 24], ['tubes', 5500, 30, CYAN, 4, 20], ['fan', 5530, 34, VIO, 0, 16],
  ['worms', 5562, 6], ['anem', 5594, 22, MAG], ['pen', 5618, 24], ['dome', 5676, 12, CYAN], ['tubes', 5698, 46, CYAN, 5],
  ['fan', 5730, 50, VIO], ['worms', 5758, 5], ['boulder', 5792, 28, 16], ['tubes', 5788, 28, VIO, 3, 14], ['anem', 5822, 16, CYAN],
  ['pen', 5848, 36], ['pen', 5858, 28], ['dome', 5886, 18, MAG], ['tubes', 5906, 26, CYAN, 3],
  ['fan', 5934, 52, MAG], ['tubes', 5966, 40, CYAN, 5], ['worms', 5994, 7], ['pen', 6014, 34], ['pen', 6023, 26],
  ['boulder', 6044, 30, 18], ['dome', 6042, 13, MAG, 0, 16], ['fan', 6070, 60, VIO], ['anem', 6094, 16, CYAN]
];
let WS = null, WB = null;     // world build state, then the baked world
function worldInit() {
  const lg = () => lbuf(WX1 - WX0, H, -WX0, 0);
  WS = { b: buf(WX1 - WX0, 252, -WX0, 0), gb: buf(WX1 - AX0, H - 232, -AX0, -232), gl: { cyan: lg(), mag: lg(), vio: lg(), warm: lg() } };
}
const glOf = P => P === CYAN ? WS.gl.cyan : P === MAG ? WS.gl.mag : P === VIO ? WS.gl.vio : WS.gl.warm;
// small, darker back-row corals that fill the gaps (seeded)
function backRow() {
  const { b, gl } = WS;
  for (let x = AX0 + 4; x < 6110; x += 7 + Math.floor(hs(x) * 9)) {
    const y = Math.round(gy(x)) - 1, k = hs(x * 1.3), gi = Math.floor(hs(x * 2.1) * 3), P = [CYAN, MAG, VIO][gi];
    const D = { d: mixI(P.d, ROCK[1], 0.4), b: mixI(P.b, ROCK[1], 0.45), m: mixI(P.m, ROCK[1], 0.45), l: mixI(P.l, ROCK[1], 0.45), r: mixI(P.r, ROCK[2], 0.4), t: mixI(P.t, ROCK[2], 0.4), g: P.g };
    if (k < 0.35) tubes(b, null, x, y, 2, 10 + hs(x + 1) * 10, x, D);
    else if (k < 0.6) fan(b, null, x, y, 14 + hs(x + 2) * 14, x, D);
    else if (k < 0.8) dome(b, null, x, y, 5 + Math.floor(hs(x + 3) * 5), 4 + Math.floor(hs(x + 4) * 3), x, D);
    else for (let i = 0; i < 4; i++) { const xx = x + i * 2, hh = 2 + Math.floor(hs(x + i) * 5); for (let j = 0; j < hh; j++) put(b, xx, y - j, D.b); put(b, xx, y - hh, D.r); }
    if (hs(x * 4.4) > 0.6) glow(gl[['cyan', 'mag', 'vio'][gi]], x, y - 6, 8, P.g, 0.08);
  }
}
function garden(i0, i1) {
  const { b, gl } = WS;
  for (const [k, x, s, a, n, lift] of GARDEN.slice(i0, i1)) {
    const y = Math.round(gy(x)) + 1 - (lift || 0);
    if (k === 'tubes') tubes(b, glOf(a), x, y, n, s, x, a);
    else if (k === 'fan') fan(b, glOf(a), x, y, s, x, a);
    else if (k === 'dome') dome(b, glOf(a), x, y, s, Math.round(s * 0.7), x % 97, a);
    else if (k === 'anem') anemone(b, glOf(a), x, y, s, x, a);
    else if (k === 'pen') seaPen(b, gl.warm, x, y, s, x);
    else if (k === 'worms') worms(b, gl.mag, x, y, s, x);
    else if (k === 'boulder') boulder(b, gl, x, y, s, a, x % 89, null);
  }
}
function gardenFinish() {
  const { b, gl } = WS;
  paintPipes(b, gl);
  for (const [x, c1, c2] of [[5062, '#ff8a4a', '#ffd08a'], [5318, '#ff6f8a', '#ffc0cc'], [5478, '#ff8a4a', '#ffd08a'], [5604, '#b06cff', '#e2c8ff'], [5876, '#ff8a4a', '#ffd08a'], [6040, '#ff6f8a', '#ffc0cc']]) starfish(b, x, Math.round(gy(x)) - 1, 4, I(c1), I(c2));
  // light pools on the sand under the gardens
  for (const [k, x, s, a] of GARDEN) if (k !== 'boulder' && k !== 'worms') glow(k === 'pen' ? gl.warm : glOf(a), x, gy(x) + 4, s * 1.1 + 14, (k === 'pen' ? WARM : a).g, 0.17, 9);
}
// the ground strip: dark sand in wavy layers with ripples, a lit lip, pebbles, shells and glowing grains
function sand(x0, x1) {
  const gb = WS.gb;
  for (let x = x0; x < x1; x++) {
    const yg = Math.round(gy(x));
    for (let y = yg; y < H + 2; y++) {
      const d = y - yg, n = jfbm(x / 9, y / 3, 51, 3), rip = Math.sin(x * 0.19 + Math.sin(x * 0.031) * 3 + d * 0.15);
      const band = Math.sin((y + 3 * Math.sin(x / 37) + 2 * fbm(x / 13, 52, 2)) * 0.62);
      let c = ramp(SAND, 0.66 - d * 0.03 + (n - 0.5) * 0.36 + (band > 0.8 ? -0.12 : 0) + (d < 6 && rip > 0.7 ? 0.12 : 0), x, y);
      if (d === 0) c = SAND[6 - (hs(x * 0.7) > 0.7 ? 1 : 0)]; else if (d === 1) c = SAND[5];
      put(gb, x, y, c);
    }
    if (hs(x * 1.37) > 0.82) put(gb, x, yg - 1, SAND[5]);   // little bumps on the lip
  }
}
function sandFinish() {
  const { gb, gl } = WS;
  for (let i = 0; i < 150; i++) {
    const x = AX0 + 3 + Math.floor(hs(i * 3.7 + 11) * (WX1 - AX0 - 6)), yg = Math.round(gy(x)), deep = hs(i * 5.1) > 0.45, y = deep ? yg + 4 + Math.floor(hs(i * 2.3) * (H - yg - 6)) : yg;
    const k = hs(i * 9.3), w = 2 + Math.floor(hs(i * 4.1) * 4);
    if (k < 0.62) {
      for (let j = 0; j < 3; j++) for (let q = -w; q <= w; q++) if (q * q / (w * w) + (j - 1) * (j - 1) / 2.2 <= 1) put(gb, x + q, y - 1 + j, j === 0 ? (q < 0 ? ROCK[5] : ROCK[4]) : j === 1 ? ROCK[3] : ROCK[1]);
      put(gb, x - w + 1, y - 1, I('#5a5c9a'));
    } else if (k < 0.8) {
      const C = PI('#7a5a7a', '#c890a8', '#f0c8d0');
      for (let q = -2; q <= 2; q++) { put(gb, x + q, y, q & 1 ? C[1] : C[2]); put(gb, x + q, y + 1, C[0]); }
      put(gb, x, y - 1, C[2]); put(gb, x - 1, y - 1, C[1]); put(gb, x + 1, y - 1, C[1]);
    } else {
      const C = PI('#6e6080', '#d8cfc0', '#fff6e8');
      put(gb, x, y, C[1]); put(gb, x + 1, y, C[2]); put(gb, x + 2, y, C[1]); put(gb, x + 1, y - 1, C[1]); put(gb, x, y + 1, C[0]); put(gb, x + 1, y + 1, C[0]);
    }
  }
  for (let i = 0; i < 320; i++) {
    const x = AX0 + Math.floor(hs(i * 7.3 + 5) * (WX1 - AX0)), y = Math.round(gy(x)) + 1 + Math.floor(hs(i * 5.9) ** 2 * (H - gy(x) - 1));
    const k = hs(i * 9.7);
    if (k < 0.4) { put(gb, x, y, SAND[6]); put(gb, x + 1, y, SAND[4]); }
    else if (k < 0.62) put(gb, x, y, SAND[0]);
    else { const P = [CYAN, MAG, VIO][i % 3]; put(gb, x, y, P.r); if (k > 0.85) put(gb, x + 1, y, P.t); glow(gl[['cyan', 'mag', 'vio'][i % 3]], x + 0.5, y + 0.5, 4, P.g, 0.22); }
  }
}

// ============================================================
// Front strip (p 1.2, screen space): low dark rocks and coral silhouettes at the very bottom
// ============================================================
function paintFront() {
  const p = 1.2, top = 224, b = stripBuf(p, top, H), gl = stripLight(b), w = b.w - 10;
  const FR = PI('#05061a', '#080a22', '#0c0f2c', '#131740');
  for (let x = -10; x < w; x++) {
    const cell = Math.floor(x / 150), on = hs(cell * 2.3) > 0.35, cx0 = cell * 150 + 30 + hs(cell) * 90, hw = 18 + hs(cell * 3.1) * 30, hh = 4 + hs(cell * 5.7) * 7;
    const d = Math.abs(x - cx0) / hw;
    let yt = 264 + 3 * fbm(x / 20, 61, 2);
    if (on && d < 1) yt = Math.min(yt, 264 - hh * Math.sqrt(1 - d * d) + (fbm(x / 5, 62, 2) - 0.5) * 3);
    yt = Math.round(yt);
    for (let y = yt; y < H; y++) put(b, x, y, y === yt ? FR[3] : y === yt + 1 ? FR[2] : ramp(FR, 0.45 - (y - yt) / 16 + (jfbm(x / 4, y / 4, 63, 2) - 0.5) * 0.4, x, y));
  }
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(-6 + hs(i * 7.3 + 5) * (w + 2));
    let y = top; while (y < H && get(b, x, y) === NONE) y++;
    if (y > H - 3) continue;
    const P = [CYAN, MAG, VIO, WARM][i % 4], hh = 4 + Math.floor(hs(i * 3.9) * 9);
    if (i % 3 === 0) { for (let k = 0; k < 3; k++) { const xx = x + k * 2 - 2, h = hh - k * 2; for (let j = 0; j < h; j++) put(b, xx, y - j, FR[1]); put(b, xx, y - h, mixI(P.r, FR[1], 0.3)); glow(gl, xx, y - h, 6, P.g, 0.25); } }
    else { for (let j = 0; j < hh; j++) put(b, x + Math.round(Math.sin(j * 0.5 + i) * 1.5), y - j, FR[1]); put(b, x + Math.round(Math.sin(hh * 0.5 + i) * 1.5), y - hh, mixI(P.r, FR[1], 0.35)); }
  }
  return { c: bake(b), l: bakeLight(gl), p, top };
}

// ============================================================
// Live layers: jellyfish, anglerfish, lanternfish (spread along the whole area, in design coordinates)
// ============================================================
const BG = {};
// jellyfish: [design x, y, parallax, kind, phase]. Design x = screen x at camera CAM0 (4560); at camera cx a jelly is at
// design x - (cx - 4560) * p. Each strip spans design 0 .. 490 + 1360 p, so these cover the whole area.
const JELLIES = [
  [110, 84, 0.3, 'P', 0.0], [500, 72, 0.3, 'C', 2.6], [880, 92, 0.3, 'P', 4.1],
  [52, 132, 0.16, 'C', 2.0], [400, 100, 0.16, 'P', 5.2], [650, 136, 0.16, 'C', 3.4],
  [205, 70, 0.12, 'S', 4.0], [560, 90, 0.12, 'S', 0.8]
];
function drawJellies(g, cx, far) {
  for (const [dx, sy, p, k, ph] of JELLIES) {
    if ((p < 0.15) !== far) continue;
    const x = ssx(dx, cx, p) + Math.sin(G.t * 0.006 + ph) * 8, y = sy + Math.sin(G.t * 0.013 + ph) * 5 - Math.max(0, Math.sin(G.t * 0.05 + ph)) * 2;
    if (x < -40 || x > W + 40) continue;
    const big = p > 0.2, fr = (k === 'S' ? BG.jellyPs : k === 'C' ? (big ? BG.jellyC : BG.jellyCs) : (big ? BG.jellyP : BG.jellyPm))[Math.floor(G.t / 9 + ph * 3) & 3];
    const h = k === 'S' ? BG.haloS : k === 'C' ? BG.haloC : BG.haloP;
    lit(g, h.img, Math.round(x) - h.o, Math.round(y) - h.o - 2, (0.7 + 0.3 * Math.sin(G.t * 0.05 + ph)) * (big ? 1 : 0.7));
    const ga = g.globalAlpha; g.globalAlpha = ga * (far ? 0.5 : big ? 0.72 : 0.62); blitS(g, fr, x, y); g.globalAlpha = ga;
  }
}
// anglerfish far off, lures bobbing and pulsing: [design x, y, parallax, facing]
const ANGLERS = [[200, 100, 0.12, 1], [470, 132, 0.12, -1]];
function drawAnglers(g, cx) {
  for (const [dx, sy, p, f] of ANGLERS) {
    const x = Math.round(ssx(dx, cx, p) + Math.sin(G.t * 0.004 + dx) * 6), y = Math.round(sy + Math.sin(G.t * 0.011 + dx) * 3);
    if (x < -50 || x > W + 50) continue;
    g.save(); g.translate(x, y); g.scale(f, 1);
    const ga = g.globalAlpha; g.globalAlpha = ga * 0.68; blitS(g, BG.angler, 0, 0); g.globalAlpha = ga;   // hazy: clearly background
    const lx = 20 + Math.round(Math.sin(G.t * 0.03 + dx) * 1.5), ly = -17 + Math.round(Math.sin(G.t * 0.045 + dx));
    g.fillStyle = '#4a64a0';
    for (let i = 0; i <= 12; i++) { const t = i / 12; g.fillRect(Math.round(lerp(3, lx, t)), Math.round(lerp(-13, ly, t) - Math.sin(t * Math.PI) * 7), 1, 1); }
    lit(g, BG.lure.img, lx - BG.lure.o, ly - BG.lure.o, 0.75 + 0.25 * Math.sin(G.t * 0.07 + dx));
    lit(g, BG.lureCore.img, lx - BG.lureCore.o, ly - BG.lureCore.o, 1);
    g.fillStyle = '#e8fff6'; g.fillRect(lx, ly, 1, 1);
    g.restore();
  }
}
// schools of lanternfish drifting right across the mid distance (each wraps round a 900 px loop)
const SCHOOLS = [[260, 150, 9], [700, 166, 7], [480, 120, 6]];
function drawLanterns(g, cx) {
  const p = 0.35, ga = g.globalAlpha;
  g.globalAlpha = ga * 0.85;
  for (const [dx, sy, n] of SCHOOLS) {
    const base = ((ssx(dx, cx, p) + G.t * 0.12 + 200) % 900 + 900) % 900 - 200;
    for (let i = 0; i < n; i++) {
      const x = Math.round(base + (i % 3) * 9 + Math.floor(i / 3) * 13 + Math.sin(G.t * 0.04 + i) * 2), y = Math.round(sy + (i % 3) * 6 - Math.floor(i / 3) * 3 + Math.sin(G.t * 0.03 + i * 1.7) * 2);
      if (x > -10 && x < W + 10) blitS(g, BG.lantern, x, y);
    }
  }
  g.globalAlpha = ga;
}
function stripLit(g, L, a) {
  g.globalCompositeOperation = 'lighter'; const ga = g.globalAlpha; g.globalAlpha = ga * a;
  g.drawImage(L.l, sOff(L.p, cxNow, L.l.width), 0, W + 20, L.l.height, -10, L.top, W + 20, L.l.height);
  g.globalAlpha = ga; g.globalCompositeOperation = 'source-over';
}
let cxNow = 0;
function drawBGDeep(g, cx) {
  cxNow = cx;
  g.drawImage(BG.water, -10, -10);
  blitStrip(g, BG.far.c, BG.far.p, BG.far.top, cx);
  lit(g, BG.farGlow, -10 - sOff(0.04, cx, BG.farGlow.width), 0, 1);
  stripLit(g, BG.far, 0.7 + 0.3 * Math.sin(G.t * 0.02));
  drawAnglers(g, cx);
  drawJellies(g, cx, true);
  blitStrip(g, BG.mid.c, BG.mid.p, BG.mid.top, cx);
  stripLit(g, BG.mid, 0.75 + 0.25 * Math.sin(G.t * 0.025 + 1));
  drawJellies(g, cx, false);
  drawLanterns(g, cx);
  blitStrip(g, BG.ceil.c, BG.ceil.p, 0, cx);
  stripLit(g, BG.ceil, 0.7 + 0.3 * Math.sin(G.t * 0.03 + 2));
}

// world-space blit of a world strip canvas (ctx is translated by -cx)
function worldBlit(c, x0w, cx, y0) {
  const sx = Math.max(0, Math.floor(cx - 12 - x0w)), ex = Math.min(c.width, Math.ceil(cx + W + 12 - x0w));
  if (ex > sx) ctx.drawImage(c, sx, 0, ex - sx, c.height, x0w + sx, y0, ex - sx, c.height);
}
function glowAt(img, x, y, a) { ctx.globalAlpha = a; ctx.drawImage(img.img, x - img.o, y - img.o); }
function lairLive(cx) {
  if (cx + W < 6140) return;
  ctx.save();
  // beacons: red domes with a turning light
  for (let i = 0; i < BEACONS.length; i++) {
    const [bx, by] = BEACONS[i], ph = G.t * 0.11 + i * Math.PI, on = Math.cos(ph), side = Math.round(Math.sin(ph) * 2);
    R(bx - 3, by - 3, 7, 4, '#5a1420'); R(bx - 2, by - 4, 5, 1, '#5a1420');
    R(bx - 1 + side, by - 3, 2, 3, on > -0.3 ? '#ff4a3a' : '#a02028'); R(bx - 1 + side, by - 4, 1, 1, '#ffd0c0');
    ctx.globalCompositeOperation = 'lighter'; glowAt(BG.beacon, bx, by - 2, 0.35 + 0.45 * Math.max(0, on)); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  // running lights chasing round the steel ring
  const head = (G.t / 4) % 24;
  for (let k = 0; k < 24; k++) {
    const a = k * Math.PI / 12 - Math.PI / 2, x = Math.round(HX + Math.cos(a) * 82), y = Math.round(HY + Math.sin(a) * 82), d = (head - k + 24) % 24;
    if (x > WX1 - 2) continue;
    R(x - 1, y - 1, 2, 2, d < 1 ? '#fff0b0' : d < 2.2 ? '#ffc040' : d < 3.4 ? '#a06018' : '#3a2a14');
    if (d < 1) { ctx.globalCompositeOperation = 'lighter'; glowAt(BG.amber, x, y, 0.6); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  }
  // robot silhouettes passing behind the portholes
  for (let i = 0; i < PORTS.length; i++) {
    const [px, py] = PORTS[i], s = Math.sin(G.t * 0.02 + i * 2.4);
    if (s > 0.3) { const ox = Math.round((s - 0.65) * 12); ctx.save(); ctx.beginPath(); ctx.arc(px + 0.5, py + 0.5, 2.5, 0, Math.PI * 2); ctx.clip(); R(px + ox - 2, py - 1, 3, 3, '#3a1a10'); R(px + ox - 1, py, 1, 1, '#ff5040'); ctx.restore(); }
  }
  // something is awake in there: two red eyes at the back of the tunnel until the boss comes out
  if (G.enemies && !G.enemies.some(e => e.type === 'megaoctopus')) {
    const gx = HX + Math.round(Math.sin(G.t * 0.02) * 3);
    if (G.t % 150 >= 6) { R(gx - 13, HY - 8, 6, 2, '#ff3a30'); R(gx + 7, HY - 8, 6, 2, '#ff3a30'); R(gx - 12, HY - 8, 1, 1, '#ffd0a0'); R(gx + 8, HY - 8, 1, 1, '#ffd0a0'); }
  }
  // the sign's lamp and the vent's bubbles
  if (Math.floor(G.t / 30) % 2) R(SIGN[0] - 1, SIGN[1] - 11, 2, 1, '#ff4040');
  const yA = Math.round(gy(6180)) - 7;
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const ph = ((G.t * 0.6 + i * 37) % 120) / 120, x = VENT + Math.sin(ph * 9 + i) * 3, y = yA - 20 - ph * 80;
    ctx.strokeStyle = 'rgba(184,250,255,' + (0.5 * (1 - ph)).toFixed(3) + ')';
    ctx.strokeRect(Math.round(x) - 1, Math.round(y) - 1, 2 + (i % 2), 2 + (i % 2));
  }
  ctx.restore();
}
const PULSE = { cyan: 0, mag: 2.1, vio: 4.2, warm: 1.1 };

// ============================================================
// Bake steps (each well under ~100 ms in the harness), then the contract object
// ============================================================
const rows = (n, k, f) => Array.from({ length: k }, (_, i) => () => f(Math.floor(i * n / k), Math.floor((i + 1) * n / k)));
const STEPS = [
  () => { if (!NZT) makeNZT(); BG.water = paintWater(); },
  () => { BG.farGlow = paintFarGlow(); },
  () => { BG.far = paintFar(); },
  midInit,
  ...rows(H, 3, midMask),
  ...rows(H, 3, midShade),
  midFinish,
  () => { BG.ceil = paintCeiling(); },
  () => { BG.front = paintFront(); },
  () => {
    BG.jellyP = jellyFrames(19, { d: I('#5a3a8a'), b: I('#8e5cc8'), l: I('#c79af0'), r: I('#f0c8ff'), t: I('#ffffff') });
    BG.jellyPm = jellyFrames(15, { d: I('#4e367e'), b: I('#8456bc'), l: I('#bd92ea'), r: I('#e8c2fc'), t: I('#fbefff') });
    BG.jellyPs = jellyFrames(13, { d: I('#4a3478'), b: I('#7a52b0'), l: I('#b088e0'), r: I('#dcb8f8'), t: I('#f8eaff') });
    BG.jellyC = jellyFrames(16, { d: I('#1f5a78'), b: I('#2f8aa8'), l: I('#6fd6e0'), r: I('#bafff6'), t: I('#ffffff') });
    BG.jellyCs = jellyFrames(13, { d: I('#1c5070'), b: I('#2b7e9c'), l: I('#62c8d6'), r: I('#aef6f0'), t: I('#f0ffff') });
    BG.haloP = haloCanvas(22, '#c070ff', 0.32); BG.haloC = haloCanvas(18, '#40e8e0', 0.3); BG.haloS = haloCanvas(12, '#c070ff', 0.26);
    BG.angler = anglerSprite(); BG.lure = haloCanvas(14, '#7affd8', 0.6); BG.lureCore = haloCanvas(4, '#e0fff4', 0.9);
    BG.lantern = lanternFish(); BG.beacon = haloCanvas(16, '#ff3b30', 0.5); BG.amber = haloCanvas(8, '#ffb040', 0.5);
    BG.motes = [haloCanvas(5, '#60fff0', 0.55), haloCanvas(5, '#ff70e0', 0.5), haloCanvas(5, '#a080ff', 0.55)];
  },
  () => { worldInit(); lairRock(WS.b); },
  () => lairBulkhead(WS.b, WS.gl),
  () => { lairTunnel(WS.b, WS.gl); lairRing(WS.b); },
  backRow,
  ...rows(GARDEN.length, 3, garden),
  gardenFinish,
  ...rows(WX1 - AX0, 3, (a, b) => sand(AX0 + a, AX0 + b)),
  sandFinish,
  () => { WB = { c: bake(WS.b), g: bake(WS.gb), light: {} }; },
  ...Object.keys(PULSE).map(k => () => { WB.light[k] = bakeLight(WS.gl[k]); WS.gl[k] = null; }),
  () => { WS = null; }
];

L4ART.deep = {
  x0: AX0, x1: 6400,
  steps: STEPS,
  // the whole backdrop, screen space, opaque, into g (the joiner may hand a scratch canvas for the crossfade)
  bg(g, cx) { drawBGDeep(g, cx); },
  // world space: the lair, the gardens (anchored 5000..6400; the first boulder overhangs x 5000 by ~20 px)
  behind(cx) {
    worldBlit(WB.c, WX0, cx, 0);
    lairLive(cx);
  },
  // world space: the sand, then the corals' light falling on it and on the gardens (4 colour groups, own pulse each)
  ground(cx) {
    worldBlit(WB.g, AX0, cx, 232);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const ga = ctx.globalAlpha;
    for (const k in PULSE) { ctx.globalAlpha = ga * (0.62 + 0.38 * Math.sin(G.t * 0.028 + PULSE[k])); worldBlit(WB.light[k], WX0, cx, 0); }
    ctx.restore();
  },
  // screen space: low dark rocks along the bottom edge, a few glowing tips
  front(cx) {
    const F = BG.front;
    blitStrip(ctx, F.c, F.p, F.top, cx);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.7 + 0.3 * Math.sin(G.t * 0.03);
    ctx.drawImage(F.l, sOff(F.p, cx, F.l.width), 0, W + 20, F.l.height, -10, F.top, W + 20, F.l.height);
    ctx.restore();
  },
  // screen space, at globalAlpha = the backdrop's weight: glowing motes, sparkling plankton, marine snow, bubbles
  overlay(cx) {
    const ga = ctx.globalAlpha;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const p = 0.7 + hs(i * 2.9) * 0.5, x = Math.round(((hs(i * 4.3 + 1) * 1100 - cx * p + Math.sin(G.t * 0.011 + i * 1.7) * 18) % (W + 60) + W + 60) % (W + 60) - 30);
      const y = Math.round(72 + hs(i * 6.1) * 150 + Math.sin(G.t * 0.017 + i * 2.3) * 10), m = BG.motes[i % 3], a = 0.45 + 0.4 * Math.sin(G.t * 0.06 + i * 1.3);
      if (a < 0.1) continue;
      glowAt(m, x, y, ga * a);
      ctx.globalAlpha = ga * Math.min(1, a + 0.3); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
    for (let i = 0; i < 64; i++) {
      const p = 0.6 + hs(i * 1.3) * 0.6, x = Math.round(((hs(i * 3.7) * 900 - cx * p + G.t * (0.05 + hs(i) * 0.08)) % (W + 40) + W + 40) % (W + 40) - 20);
      const y = Math.round(64 + ((hs(i * 9.1) * 180 - G.t * (0.03 + hs(i * 2) * 0.05)) % 180 + 180) % 180 + Math.sin(G.t * 0.02 + i) * 3);
      const tw = Math.sin(G.t * (0.05 + hs(i * 5) * 0.08) + i * 2.3);
      if (tw < -0.2) continue;
      const c = i % 3 === 0 ? '200,255,250' : i % 3 === 1 ? '255,190,240' : '190,200,255';
      ctx.fillStyle = 'rgba(' + c + ',' + (0.35 + 0.6 * tw).toFixed(3) + ')'; ctx.fillRect(x, y, 1, 1);
      if (tw > 0.85 && i % 4 === 0) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    }
    ctx.fillStyle = 'rgba(170,180,220,0.35)';
    for (let i = 0; i < 26; i++) {
      const x = Math.round(((hs(i * 7.9 + 4) * 700 - cx * 0.9 + Math.sin(G.t * 0.01 + i) * 6) % (W + 20) + W + 20) % (W + 20) - 10), y = Math.round(((hs(i * 2.2) * 300 + G.t * 0.08) % 220) + 50);
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.strokeStyle = 'rgba(181,242,244,0.22)'; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) { const x = (hs(i + 93) * W - cx * 0.7 + W * 30) % W, y = H - ((G.t * (0.21 + hs(i) * 0.24) + hs(i + 4) * H) % H); ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), 1 + hs(i + 8) * 2, 0, Math.PI * 2); ctx.stroke(); }
  }
};
}
