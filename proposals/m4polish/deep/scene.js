'use strict';
// ============================================================
// Mission 4 polish proposal, key "deep": FINAL AREA: GLOWING DEEP (world x 5000-6400) and the MEGA OCTOPUS lair.
// A harness fixture (--extra) loaded after the game. It wraps LEVELS[3]'s draw hooks and only takes over while the
// camera can see the Glowing Deep (cross-fading in from the Sunken Ruins over camera x FADE0..FADE1); everywhere else
// it calls the previous hooks, so other painters' scene.js files compose with this one in any order.
//
// Look: a dark navy/violet abyss inside a sea cave, lit only by friendly bioluminescence.
//   drawBG (screen space, parallax strips baked once): the water column, far-off glows, far abyss spires, an anglerfish
//   with its lure light, drifting glowing jellyfish, mid cave pillars, a school of lanternfish, the cave ceiling with
//   stalactite overhangs and glow-worm threads (kept above y 58: the swim space starts at y 62).
//   drawBehind (world): the MEGA OCTOPUS lair built into the end wall (vault hatch, hazard ring, beacons, portholes, an
//   emblem), then the coral gardens (tube corals, sea fans, brain domes, anemones, sea pens, tube worms, boulders).
//   drawGround (world): dark sand, then the corals' light (4 additive glow layers, each pulsing on its own phase).
//   drawFront (screen): low dark rocks and corals at the very bottom.  drawOverlay: plankton sparkles, marine snow.
// Static layers are painted pixel by pixel into Int32 buffers and baked once (first draw); the live bits are a few
// sprites and fillRects driven by G.t and hs(). Never calls MA.random / rand.
// Staging: a camera of exactly F1 (--x 5411.6) or F2 (--x 6121.6) pins the frame's action (see the end of the file).
// ============================================================
{
const L = LEVELS[3];
const MA = Math, clp = clamp, hs = hsh;     // local aliases: much faster than global lookups inside the harness's vm
const prev = { bg: L.drawBG, behind: L.drawBehind, ground: L.drawGround, front: L.drawFront, overlay: L.drawOverlay, load: L.load, update: L.update };

const AX0 = 5000;                       // the area starts here (world x)
const WX0 = 4950, WX1 = 6420;           // world strips span
const FADE0 = 4560, FADE1 = 4900;       // camera range of the cross-fade in from the ruins
const CAM0 = 4560, CAM1 = 5920;         // camera range the screen strips are painted for
const F1 = 5210, F2 = 5920;             // the two proposal cameras

// ============================================================
// Helpers (copied from src/level3_sky.js: they are private there)
// ============================================================
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const h2 = (x, y, s) => hs(x * 12.9898 + y * 78.233 + s * 37.719);
function vnoise(x, s) { const i = MA.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hs(i * 1.37 + s * 61.3), hs((i + 1) * 1.37 + s * 61.3), u); }
function fbm(x, s, oct) { let v = 0, a = 1, n = 0, f = 1; for (let o = 0; o < (oct || 3); o++) { v += a * vnoise(x * f, s + o * 17); n += a; a *= 0.5; f *= 2.07; } return v / n; }
let NZT = null;
function makeNZT() {
  let a = 520417; NZT = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = MA.imul(t ^ (t >>> 15), t | 1); t ^= t + MA.imul(t ^ (t >>> 7), t | 61); NZT[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
}
const nz = (x, y) => NZT[((MA.imul(x | 0, 374761393) ^ MA.imul(y | 0, 668265263)) >>> 0) & 65535];
function jvn(x, y, s) {
  const i = MA.floor(x), j = MA.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = (s | 0) * 977;
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
  return MA.round(ar + ((b >> 16 & 255) - ar) * k) << 16 | MA.round(ag + ((b >> 8 & 255) - ag) * k) << 8 | MA.round(ab + ((b & 255) - ab) * k);
}
function ramp(pal, t, x, y) { const f = clp(t, 0, 1) * (pal.length - 1), i = MA.floor(f); return pal[MA.min(pal.length - 1, i + (f - i > bay(x, y) ? 1 : 0))]; }
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Pixel buffers: 0xRRGGBB ints, NONE = empty. Local point (x, y) lands on buffer pixel (x + ox, y + oy).
function buf(w, h, ox, oy) { w = MA.ceil(w); h = MA.ceil(h); const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox: ox || 0, oy: oy || 0 }; }
function put(b, x, y, c) { x = MA.floor(x) + b.ox; y = MA.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = MA.floor(x) + b.ox; y = MA.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) {
  x = MA.round(x) + b.ox; y = MA.round(y) + b.oy;
  const x0 = MA.max(0, x), y0 = MA.max(0, y), x1 = MA.min(b.w, x + MA.round(w)), y1 = MA.min(b.h, y + MA.round(h));
  for (let r = y0; r < y1; r++) b.d.fill(c, r * b.w + x0, r * b.w + MA.max(x0, x1));
}
function disc(b, cx, cy, r, c) {
  const n = MA.ceil(r), R2 = (r + 0.5) * (r + 0.5), X = MA.round(cx), Y = MA.round(cy);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) if (i * i + j * j <= R2) put(b, X + i, Y + j, c);
}
function oval(b, cx, cy, rx, ry, c) {
  const RX = rx + 0.5, RY = ry + 0.5;
  for (let j = -MA.ceil(ry); j <= MA.ceil(ry); j++) for (let i = -MA.ceil(rx); i <= MA.ceil(rx); i++)
    if (i * i / (RX * RX) + j * j / (RY * RY) <= 1) put(b, MA.round(cx) + i, MA.round(cy) + j, c);
}
function line(b, x0, y0, x1, y1, c, t) {
  t = t || 1;
  const n = MA.ceil(MA.max(MA.abs(x1 - x0), MA.abs(y1 - y0), 1));
  for (let i = 0; i <= n; i++) rect(b, MA.round(x0 + (x1 - x0) * i / n - (t - 1) / 2), MA.round(y0 + (y1 - y0) * i / n - (t - 1) / 2), t, t, c);
}
function poly(b, pts, c) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = MA.min(y0, p[1]); y1 = MA.max(y1, p[1]); }
  const xs = [];
  for (let y = MA.floor(y0); y <= MA.ceil(y1); y++) {
    const yc = y + 0.5; xs.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const ax = pts[i][0], ay = pts[i][1], bx = pts[j][0], by = pts[j][1];
      if ((ay <= yc) !== (by <= yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, q) => a - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = MA.ceil(xs[k] - 0.5); x + 0.5 <= xs[k + 1]; x++) put(b, x, y, c);
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
const blitS = (g, s, x, y) => g.drawImage(s.img, MA.round(x) - s.ox, MA.round(y) - s.oy);

// Light buffers: float RGB light, baked to an RGBA canvas drawn with 'lighter' (additive bioluminescence)
function lbuf(w, h, ox, oy) { const n = MA.ceil(w) * MA.ceil(h); return { w: MA.ceil(w), h: MA.ceil(h), ox: ox || 0, oy: oy || 0, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n) }; }
function glow(gb, x, y, r, col, a, ry) {
  if (!gb) return;
  ry = ry || r;
  const cr = (col >> 16 & 255) / 255, cg = (col >> 8 & 255) / 255, cb = (col & 255) / 255;
  const x0 = MA.floor(x - r), x1 = MA.ceil(x + r), y0 = MA.floor(y - ry), y1 = MA.ceil(y + ry);
  for (let yy = y0; yy <= y1; yy++) {
    const Y = yy + gb.oy; if (Y < 0 || Y >= gb.h) continue;
    for (let xx = x0; xx <= x1; xx++) {
      const X = xx + gb.ox; if (X < 0 || X >= gb.w) continue;
      const dx = (xx + 0.5 - x) / r, dy = (yy + 0.5 - y) / ry, d = dx * dx + dy * dy;
      if (d >= 1) continue;
      const k = a * (1 - MA.sqrt(d)) ** 2, i = Y * gb.w + X;
      gb.r[i] += cr * k; gb.g[i] += cg * k; gb.b[i] += cb * k;
    }
  }
}
function bakeLight(gb) {
  const c = canvasOf(gb.w, gb.h), g = c.getContext('2d'), im = g.createImageData(gb.w, gb.h), d = im.data;
  for (let i = 0; i < gb.r.length; i++) {
    const r = gb.r[i], gg = gb.g[i], b = gb.b[i], m = MA.max(r, gg, b);
    if (m < 0.006) continue;
    const j = i * 4;
    d[j] = MA.round(r / m * 255); d[j + 1] = MA.round(gg / m * 255); d[j + 2] = MA.round(b / m * 255); d[j + 3] = MA.round(MA.min(1, m) * 255);
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
function lit(g, img, x, y, alpha) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha; g.drawImage(img, x, y); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }

// the seabed (same as groundAt, read from the level data so baking never depends on LV)
function gy(x) {
  const T = L.terrain;
  if (x <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (x <= T[i][0]) { const a = T[i - 1], b = T[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
  return T[T.length - 1][1];
}

// Screen strips: painted in design coordinates (= screen x at camera CAM0), local x from -10, parallax p
function stripBuf(p, top, bot) { return buf(W + 22 + MA.ceil((CAM1 - CAM0) * p), bot - top, 10, -top); }
function stripLight(b) { return lbuf(b.w, b.h, b.ox, b.oy); }
const sOff = (p, cx, cw) => clp(MA.round((cx - CAM0) * p), 0, cw - W - 20);
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
      const d = MA.abs(x - sx) / hw;
      if (d < 1) {
        // towers: steep sides, a rounded or broken top, ledges; every third one a flat mesa
        const mesa = MA.round(sx) % 3 === 0, prof = mesa ? ss(0.62, 1, d) : 0.12 * d * d + 0.88 * ss(0.38, 1, d);
        let raw = st + (210 - st) * prof + (mesa ? 0 : 6 * MA.max(0, 0.3 - d));
        raw += (fbm(x / 3, sx, 2) - 0.5) * 4 + (fbm(x / 11, sx + 1, 2) - 0.5) * 8 * (1 - d);
        yt = MA.min(yt, raw);
      }
    }
    yt = MA.round(yt); tops.push(yt);
    for (let y = yt; y < H; y++) {
      const n = jfbm(x / 4, y / 14, 4, 2), up = 1 - ss(yt, yt + 30, y);
      let t = 0.3 + (n - 0.5) * 0.5 - (y - 160) / 260 + up * 0.18;
      if (MA.sin(x * 0.9 + fbm(y / 9, x, 1) * 3) > 0.85) t -= 0.12;      // vertical erosion streaks
      put(b, x, y, ramp(FAR, t, x, y));
    }
    put(b, x, yt, FAR[5]); put(b, x, yt + 1, FAR[4]);
  }
  // pin-prick glows of far corals on the spires
  for (let i = 0; i < 70; i++) {
    const x = MA.floor(-8 + hs(i * 3.1) * (w + 6)), yt = tops[x + 10], y = yt + 2 + MA.floor(hs(i * 7.7) * 40);
    if (y >= H) continue;
    const c = [CYAN, MAG, VIO][i % 3];
    put(b, x, y, mixI(c.r, FAR[1], 0.35));
    glow(gl, x + 0.5, y + 0.5, 4, c.g, 0.18);
  }
  return { c: bake(b), l: bakeLight(gl), p, top };
}

// ============================================================
// BG: mid cave pillars and arches (p 0.22), dark, lit at the rims by the glow
// ============================================================
function paintMid() {
  const p = 0.22, top = 0, b = stripBuf(p, top, H), gl = stripLight(b), w = b.w - 10;
  const MID = PI('#0b1030', '#0f1537', '#131a40', '#182149', '#1f2956', '#2a356f', '#3a4890');
  const RIMR = I('#46307a');
  // pillars [x, half width] from the floor up behind the ceiling, one great arch, low mounds along the mid floor
  const pillars = [[150, 22], [600, 19]];
  const AR = { x: 375, rx: 62, ry: 168, hx: 30, hy: 128, floor: 232 };
  // the noise terms depend on x only or on y only: tabulate them once (the mask is tested ~200k times)
  const floorY = [], strata = [], pw = pillars.map(() => []), pc = pillars.map(() => []), arR = [], arH = [];
  for (let x = -10; x < w; x++) { floorY.push(222 + 7 * fbm(x / 34, 2, 2) - 14 * MA.max(0, MA.sin(x / 61 + 1)) ** 3); strata.push(5 * fbm(x / 26, 11, 2)); }
  for (let y = 0; y < H; y++) {
    pillars.forEach(([px, hw], i) => { pw[i].push(hw * (0.78 + 0.4 * fbm(y / 38, px, 2)) + 10 * ss(170, 232, y)); pc[i].push(px + 8 * (fbm(y / 60, px + 3, 2) - 0.5)); });
    arR.push(AR.rx + 4 * (fbm(y / 25, 7, 2) - 0.5)); arH.push(AR.hx + 5 * (fbm(y / 20, 8, 2) - 0.5));
  }
  const inside = (x, y) => {
    if (y >= floorY[x + 10]) return true;
    for (let i = 0; i < pillars.length; i++) if (MA.abs(x - pc[i][y]) < pw[i][y]) return true;
    const nx = (x - AR.x) / arR[y], ny = (y - AR.floor) / AR.ry;
    if (y <= AR.floor && nx * nx + ny * ny <= 1) {
      const hx = (x - AR.x) / arH[y], hy = (y - AR.floor) / AR.hy;
      if (hx * hx + hy * hy >= 1) return true;
    }
    return false;
  };
  // a mask first, then shade each row's runs as rounded rock: lit on the left, a violet rim on the right,
  // brighter low down where the glowing gardens light it, wavy strata and cracks
  const mw = w + 10, M = new Uint8Array(mw * (H - top));
  for (let y = top; y < H; y++) for (let x = -10; x < w; x++) if (inside(x, y)) M[(y - top) * mw + x + 10] = 1;
  const m = (x, y) => x >= -10 && x < w && y >= top && y < H && M[(y - top) * mw + x + 10] === 1;
  for (let y = top; y < H; y++) {
    let x = -10;
    while (x < w) {
      if (!m(x, y)) { x++; continue; }
      let x1 = x; while (x1 < w && m(x1, y)) x1++;
      const run = x1 - x;
      for (let q = x; q < x1; q++) {
        const u = run > 1 ? (q - x) / (run - 1) : 0.5, n = jfbm(q / 6, y / 9, 7, 3);
        let t = 0.14 + 0.32 * (1 - ss(0, 0.45, u)) * (run > 60 ? 0.4 : 1) + (n - 0.5) * 0.3 + 0.16 * ss(150, 228, y);
        if (MA.sin((y + strata[q + 10]) * 0.4) > 0.94) t -= 0.12;
        if (MA.abs(jfbm(q / 13, y / 17, 12, 2) - 0.5) < 0.014) t = 0;
        let c = ramp(MID, t, q, y);
        if (!m(q - 1, y) || !m(q, y - 1)) c = MID[5];
        else if (!m(q - 2, y) || !m(q - 1, y - 1)) c = MID[4];
        else if (!m(q + 1, y) || (!m(q + 2, y) && y > 150)) c = RIMR;
        put(b, q, y, c);
      }
      x = x1;
    }
  }
  // glow-worm colonies speckling the rock
  for (let i = 0; i < 140; i++) {
    const x = MA.floor(-8 + hs(i * 2.71 + 3) * (w + 4)), y = top + MA.floor(hs(i * 6.13) * (H - top - 40));
    if (!m(x, y) || !m(x, y + 2)) continue;
    put(b, x, y, i % 5 ? I('#2f6a8a') : I('#6fe8f0')); if (i % 5 === 0) glow(gl, x + 0.5, y + 0.5, 4, CYAN.g, 0.16);
  }
  // glowing coral tufts on the ledges and the mid floor
  for (let i = 0; i < 70; i++) {
    const x = MA.floor(-6 + hs(i * 5.3 + 1) * (w + 2));
    let y = top + 2; while (y < H && !m(x, y)) y++;
    if (y >= H - 2 || y < 60) continue;
    const c = [CYAN, MAG, VIO, WARM][i % 4], n = 2 + MA.floor(hs(i * 2.9) * 4);
    for (let k = 0; k < n; k++) {
      const xx = x + k - (n >> 1), hh = 1 + MA.floor(hs(i * 9 + k) * 5);
      for (let j = 0; j < hh; j++) put(b, xx, y - 1 - j, mixI(c.b, MID[2], 0.35));
      put(b, xx, y - 1 - hh, mixI(c.r, MID[2], 0.3));
    }
    glow(gl, x, y - 3, 10, c.g, 0.15);
  }
  // glowing strands hanging under the arch (like glow-worm silk)
  for (let i = 0; i < 9; i++) {
    const x = MA.round(AR.x - AR.hx + 6 + i * (AR.hx * 2 - 12) / 8 + (hs(i * 3) - 0.5) * 4);
    let y = AR.floor - AR.hy; while (y > top && !m(x, y)) y--;
    if (!m(x, y)) continue;
    const len = 4 + MA.floor(hs(i * 7.3) * 14);
    for (let j = 1; j <= len; j++) put(b, x, y + j, j % 4 === 0 ? I('#5fd6e6') : I('#1b2c56'));
    put(b, x, y + len + 1, I('#a8fbff'));
    glow(gl, x + 0.5, y + len + 1, 6, CYAN.g, 0.25);
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
    const cell = MA.floor((x + 400) / 38), cx0 = cell * 38 - 400 + 10 + hs(cell) * 18, hw = 4 + hs(cell * 3.3) * 6, len = 10 + hs(cell * 7.1) * 26;
    const d = MA.abs(x - cx0) / hw;
    if (d < 1) yb = MA.max(yb, MA.min(56, yb + len * MA.pow(1 - d, 1.4)));
    bottom[x + 10] = yb;
  }
  for (let x = -10; x < w; x++) {
    const yb = MA.round(bottom[x + 10]);
    for (let y = 0; y <= yb; y++) {
      const n = jfbm(x / 5, y / 8, 33, 3), e = yb - y;
      let c = ramp(ROCK, 0.1 + n * 0.4, x, y);
      if (e === 0) c = ROCK[5]; else if (e === 1) c = ROCK[4]; else if (e < 4 && n > 0.5) c = ROCK[3];
      put(b, x, y, c);
    }
  }
  // glow-worm threads: silk lines with glowing beads hanging from the underside
  for (let i = 0; i < 120; i++) {
    const x = MA.floor(-8 + hs(i * 4.17 + 9) * (w + 4)), y0 = MA.round(bottom[x + 10]) + 1, len = 3 + MA.floor(hs(i * 1.9) * MA.min(18, 57 - y0));
    if (y0 > 54) continue;
    for (let j = 0; j < len; j++) put(b, x, y0 + j, j % 4 === 3 ? I('#7ff3ff') : I('#1f3d5c'));
    put(b, x, y0 + len, I('#c8fffb'));
    glow(gl, x + 0.5, y0 + len, 5, CYAN.g, 0.22);
  }
  // clusters of glowing dots on the rock (glow-worm colonies)
  for (let i = 0; i < 60; i++) {
    const x = MA.floor(-8 + hs(i * 6.7 + 2) * (w + 4)), y = MA.round(bottom[x + 10]) - 1 - MA.floor(hs(i * 3.3) * 5);
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
    const sq = MA.sin(f / 4 * MA.PI * 2), rx = size * (0.5 + 0.05 * sq), ry = size * (0.42 - 0.06 * sq), tl = size * 1.7;
    const b = buf(size * 2 + 8, size * 3 + 8, size + 4, MA.ceil(ry) + 3);
    // tentacles first (behind)
    const nT = size > 16 ? 7 : 5;
    for (let k = 0; k < nT; k++) {
      const x0 = -rx * 0.85 + (k / (nT - 1)) * rx * 1.7;
      for (let j = 0; j < tl; j++) put(b, x0 + MA.sin(j * 0.22 + f * 1.57 + k) * (1 + j * 0.06), j + 1, j > tl * 0.7 ? P.d : P.b);
    }
    // frilly oral arms
    for (const ax of [-rx * 0.25, rx * 0.2]) for (let j = 0; j < tl * 0.62; j++) {
      const xx = ax + MA.sin(j * 0.35 + f * 1.57 + ax) * 1.5;
      put(b, xx, j + 1, P.l); put(b, xx + 1, j + 1, j % 3 ? P.l : P.r);
    }
    // the bell
    for (let y = -MA.ceil(ry); y <= 0; y++) for (let x = -MA.ceil(rx); x <= MA.ceil(rx); x++) {
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
    for (let x = -MA.floor(rx); x <= rx; x += 2) put(b, x, 1, P.t);
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
  for (let x = 3; x <= 15; x++) { const y = MA.round(7 - (x - 9) * (x - 9) * 0.06 + (x > 13 ? -1 : 0)); put(b, x, y, D[0]); put(b, x, y + 1, I('#3a2048')); }
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
let WB = null;   // the world build (see buildWorld)
// organ-pipe tube sponges: shaded cylinders that widen a little at the top, an open glowing lip, glowing spots
function tubes(b, gl, x, y, n, hmax, seed, P) {
  const list = [];
  for (let i = 0; i < n; i++) list.push({ x: x + (i - (n - 1) / 2) * 6 + (h2(i, 1, seed) - 0.5) * 3, h: MA.round(hmax * (0.42 + 0.58 * h2(i, 2, seed))), w: 4 + MA.floor(h2(i, 3, seed) * 3), lean: (h2(i, 4, seed) - 0.5) * 0.3, i });
  list.sort((a, q) => q.h - a.h);
  const SH = [P.t, P.l, P.m, P.b, P.b, P.d];
  for (const t of list) {
    for (let j = 0; j <= t.h; j++) {
      const cx = t.x + t.lean * j + MA.sin(j * 0.09 + seed) * 0.6, ww = MA.round(t.w * (0.8 + 0.3 * j / t.h)), x0 = MA.round(cx - ww / 2);
      for (let k = 0; k < ww; k++) {
        const u = k / MA.max(1, ww - 1);
        let si = u < 0.15 ? 1 : u < 0.4 ? 2 : u < 0.8 ? 3 : 5;
        if (j % 8 === 3 && si > 1 && si < 5) si++;
        put(b, x0 + k, y - j, SH[MA.min(5, si)]);
      }
      if (h2(j, t.i, seed) > 0.9 && j > 3 && j < t.h - 3) { put(b, x0 + 1 + MA.floor(h2(t.i, j, seed) * (ww - 2)), y - j, P.r); }
    }
    const tx = t.x + t.lean * t.h + MA.sin(t.h * 0.09 + seed) * 0.6, ty = y - t.h, rw = MA.round(t.w * 1.1) + 1, x0 = MA.round(tx - rw / 2);
    for (let k = 0; k < rw; k++) { put(b, x0 + k, ty - 1, k === 0 || k === rw - 1 ? P.r : P.d); put(b, x0 + k, ty, P.r); put(b, x0 + k, ty - 2, k > 0 && k < rw - 1 ? P.r : NONE); }
    put(b, x0 + 1, ty - 2, P.t); put(b, x0 + 2, ty - 2, P.t);
    glow(gl, tx, ty - 1, 9 + t.w, P.g, 0.42, 7);
  }
  glow(gl, x, y - hmax * 0.45, hmax * 0.6 + 10, P.g, 0.12);
}
// gorgonian sea fan: main branches spread in a fan, twigs on alternating sides, a fine glowing mesh between them,
// glowing polyps on every tip
function fan(b, gl, x, y, h, seed, P) {
  const tips = [], strokes = [], nm = 4 + MA.floor(h2(1, 2, seed) * 2), rows = new Map();
  const mark = (px, py, c) => { strokes.push([px, py, c]); const r = MA.round(py), e = rows.get(r); const X = MA.round(px); if (!e) rows.set(r, [X, X]); else { e[0] = MA.min(e[0], X); e[1] = MA.max(e[1], X); } };
  for (let m = 0; m < nm; m++) {
    let a = -MA.PI / 2 + ((m / (nm - 1)) - 0.5) * 1.6 + (h2(m, 3, seed) - 0.5) * 0.2;
    const len = h * (0.5 + 0.5 * MA.sin(MA.PI * (0.12 + 0.76 * m / (nm - 1)))) * (0.9 + 0.2 * h2(m, 4, seed));
    let px = x, py = y - 3, side = m % 2 ? 1 : -1;
    for (let s = 0; s < len; s++) {
      a += (-MA.PI / 2 - a) * 0.014 + MA.sin(s * 0.2 + m + seed) * 0.012;
      px += MA.cos(a); py += MA.sin(a);
      const k = s / len;
      mark(px, py, k < 0.3 ? P.d : k < 0.7 ? P.b : P.m);
      if (k < 0.2) mark(px + 1, py, P.d);
      if (s > 4 && s % 3 === 0) {
        const ta = a + side * (0.65 + h2(s, m, seed) * 0.35), tl = 2 + (1 - k) * 6 * h2(m, s, seed + 1);
        let qx = px, qy = py;
        for (let q = 0; q < tl; q++) { qx += MA.cos(ta - side * q * 0.07); qy += MA.sin(ta - side * q * 0.07); mark(qx, qy, k < 0.5 ? P.b : P.m); }
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
    const v = jfbm((xx + 100) * 0.09, (yy + 100) * 0.12, seed, 2) * 6 + xx * 0.04, f = v - MA.floor(v);
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
  const n = 9 + MA.floor(s / 4);
  for (let k = 0; k < n; k++) {
    const a = -MA.PI * (0.06 + 0.88 * k / (n - 1)), len = s * (0.75 + 0.35 * h2(k, 1, seed)), curl = (h2(k, 2, seed) - 0.5) * 0.9;
    let px = x + MA.cos(a) * s * 0.25, py = top;
    for (let j = 0; j < len; j++) {
      const aa = a + curl * j / len;
      px += MA.cos(aa) * 0.9; py += MA.sin(aa) * 0.9;
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
  for (let j = MA.floor(h * 0.3); j < h - 1; j += 2) {
    const cx = x + lean * j, yy = y - j, k = (j - h * 0.3) / (h * 0.7), len = MA.max(1, MA.round(5.5 * MA.sin(MA.PI * MA.min(1, k * 1.1 + 0.08))));
    for (const sd of [-1, 1]) for (let i = 1; i <= len; i++) put(b, cx + sd * i, yy - MA.round(i * i / 7), i === len ? P.r : i === 1 ? P.b : P.l);
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
      const cx = MA.round(t.x + t.lean * j + MA.sin(j * 0.25 + t.x) * 0.5), ring = j % 4 === 0;
      put(b, cx - 1, y - j, T[3]); put(b, cx, y - j, ring ? T[3] : T[4]); put(b, cx + 1, y - j, ring ? T[1] : T[2]);
    }
    const tx = MA.round(t.x + t.lean * t.h), ty = MA.round(y - t.h);
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
  for (let i = 0; i <= 24; i++) { const a = MA.PI + MA.PI * i / 24, r = 0.85 + 0.3 * fbm(i / 4, seed, 2); pts.push([x + MA.cos(a) * w * r, y + MA.sin(a) * h * r]); }
  pts.push([x + w, y + 2], [x - w, y + 2]);
  const tmp = buf(w * 3 + 4, h * 2 + 8, MA.round(w * 1.5 - x) + 2, MA.round(h * 1.4 - y) + 4);
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
  for (let k = 0; k < 5; k++) { const a = -MA.PI / 2 + k * MA.PI * 2 / 5; for (let r = 0; r <= s; r++) { put(b, x + MA.cos(a) * r, y + MA.sin(a) * r * 0.6, r === s ? c2 : c1); } }
  put(b, x, y, c2);
}

// ============================================================
// World: the MEGA OCTOPUS lair (end wall, world x 6150-6420)
// ============================================================
const HX = 6322, HY = 140, HR = 51;      // the hatch: centre, opening radius (ring to 66)
function paintLair(b, gl) {
  // the rock massif: overhang at the top, the wall around the hatch, a talus at the foot
  const edge = y => {
    if (y < 64) return 6168 + 30 * ss(0, 64, y) + 10 * fbm(y / 9, 41, 2);
    return 6218 + 10 * fbm(y / 16, 42, 3) - 14 * ss(196, 246, y) + 4 * MA.sin(y / 11);
  };
  for (let y = 0; y < 250; y++) {
    const ex = MA.round(edge(y));
    for (let x = ex; x < WX1; x++) {
      const n = jfbm(x / 6, y / 7, 43, 3), e = x - ex;
      let c = ramp(ROCK, 0.18 + n * 0.45 - (y < 60 ? 0.1 : 0), x, y);
      if (e === 0) c = ROCK[5]; else if (e < 3) c = ROCK[4]; else if (e < 6 && n > 0.55) c = ROCK[3];
      // crack lines
      if (MA.abs(jfbm(x / 22, y / 30, 44, 2) - 0.5) < 0.012) c = ROCK[0];
      put(b, x, y, c);
    }
  }
  paintRiser(b);
  // the bulkhead: an octagon of dark riveted steel plates set into the rock, grimy, rock creeping over its rim
  const SD = PI('#0d1120', '#131a2c', '#1b2339', '#242f4a', '#30405f', '#44597e', '#6a82a8');
  const AP = 76, oct = (dx, dy) => MA.max(MA.abs(dx), MA.abs(dy), (MA.abs(dx) + MA.abs(dy)) / MA.SQRT2);
  for (let y = HY - AP - 1; y <= HY + AP + 1; y++) for (let x = HX - AP - 1; x <= HX + AP + 1; x++) {
    const dx = x - HX, dy = y - HY, o = oct(dx, dy);
    if (o > AP) continue;
    // which facet: its outward normal decides the light (from the upper left)
    const ang = MA.round(MA.atan2(dy, dx) / (MA.PI / 4)) * (MA.PI / 4), light = MA.cos(ang + MA.PI * 0.75);
    const a8 = MA.atan2(dy, dx) / (MA.PI / 4), seam = MA.abs(a8 - MA.round(a8 - 0.5) - 0.5) * (MA.PI / 4) * MA.hypot(dx, dy) < 0.6;
    const grime = jfbm(x / 5, y / 5, 45, 3);
    let t = 0.4 + light * 0.17 + (grime > 0.62 ? -0.1 : grime < 0.3 ? 0.05 : 0) + (o > AP - 2 ? 0.2 * MA.sign(light) : 0);
    if (MA.abs(o - 71) < 0.7) t = 0.08; else if (MA.abs(o - 70) < 0.7) t += 0.18;
    if (seam && o > 66) t = 0.06;
    put(b, x, y, SD[clp(MA.round(t * 6 + (bay(x, y) - 0.5) * 0.35), 0, 6)]);
    // rivet rows along the concentric seam and the rim
    if ((MA.abs(o - 73.5) < 0.6 || MA.abs(o - 68.5) < 0.6) && (MA.round(x + y) % 6 === 0)) { put(b, x, y, SD[6]); }
  }
  // rock creeping back over the rim (the lair was dug into the reef wall)
  for (let y = HY - AP - 1; y <= HY + AP + 1; y++) for (let x = HX - AP - 1; x <= HX + AP + 1; x++) {
    const o = oct(x - HX, y - HY);
    if (o > AP || o < AP - 9) continue;
    const n = jfbm(x / 9, y / 9, 46, 3);
    if (n > 0.6 + (AP - o) * 0.025) put(b, x, y, ramp(ROCK, 0.2 + (n - 0.6) * 2, x, y));
    else if (n > 0.57 + (AP - o) * 0.025) put(b, x, y, ROCK[5]);
  }
  // barnacles and a few glowing coral buds on the steel
  for (let i = 0; i < 26; i++) {
    const a = hs(i * 3.3 + 7) * MA.PI * 2, r = 68 + hs(i * 5.7) * 7, x = MA.round(HX + MA.cos(a) * r), y = MA.round(HY + MA.sin(a) * r);
    if (i % 3) { put(b, x, y, SD[5]); put(b, x + 1, y, SD[3]); put(b, x, y + 1, SD[2]); }
    else { const P = [CYAN, MAG, VIO][i % 3 === 0 ? (i / 3) % 3 : 0]; put(b, x, y, P.r); put(b, x, y + 1, P.b); glow(gl.cyan, x + 0.5, y, 4, P.g, 0.18); }
  }
  // portholes on the four diagonal facets: amber glass lit from inside, a bolted frame
  for (const [px, py] of PORTS) {
    disc(b, px, py, 6, SD[0]); disc(b, px, py, 5, SD[5]); disc(b, px + 1, py + 1, 4, SD[2]);
    disc(b, px, py, 3, I('#6a3010')); disc(b, px, py, 2, I('#c46a1e')); put(b, px + 1, py + 1, I('#f0a040')); put(b, px - 1, py - 1, I('#ffe2a8'));
    for (const [dx, dy] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) put(b, px + dx, py + dy, SD[6]);
    glow(gl.warm, px, py, 13, I('#ff9a3c'), 0.3);
  }
  // the opening: a tunnel into the robot factory. Ribs shrinking toward a red furnace glow at the back, a conveyor of
  // robot-jelly domes across the floor, claw arms hanging from a rail (the boss's eyes are live, see lairLive)
  const TX = HX, TY = HY + 4, inHole = (x, y) => MA.hypot(x - HX, y - HY) < HR - 0.5;
  for (let y = HY - HR; y <= HY + HR; y++) for (let x = HX - HR; x <= HX + HR; x++) {
    if (!inHole(x, y)) continue;
    const d = MA.hypot(x - TX, (y - TY) * 1.08), rib = [44, 33, 24, 16].find(r => MA.abs(d - r) < (r > 30 ? 1.2 : 0.8));
    let c = mixI(I('#04051a'), I('#0a0b26'), ss(50, 10, d));
    if (d < 14) c = bay(x, y) < ss(14, 4, d) ? I('#5a1426') : I('#2a0a1e');
    if (d < 6) c = bay(x, y) < ss(6, 1, d) ? I('#c43a2a') : I('#7a1a26');
    if (rib) c = y < TY - rib * 0.5 ? I('#2e3a5e') : y < TY ? I('#1f2846') : I('#141a32');
    put(b, x, y, c);
  }
  // spokes from the ribs: the tunnel's seams
  for (let k = 0; k < 8; k++) { const a = k * MA.PI / 4 + MA.PI / 8; for (let r = 17; r < 44; r++) { const x = TX + MA.cos(a) * r, y = TY + MA.sin(a) * r / 1.08; if (inHole(x, y)) put(b, x, y, I('#121831')); } }
  // the rail and three claw arms
  for (let x = HX - HR; x <= HX + HR; x++) if (inHole(x, HY - 28)) { put(b, x, HY - 29, I('#3a4668')); put(b, x, HY - 28, I('#232c48')); }
  for (const [kx, len] of [[-24, 22], [2, 30], [27, 18]]) {
    for (let y = HY - 27; y < HY - 27 + len; y++) { put(b, HX + kx, y, I('#2a3454')); put(b, HX + kx + 1, y, I('#161c34')); }
    const cy = HY - 27 + len;
    rect(b, HX + kx - 2, cy, 6, 3, I('#3c486c')); rect(b, HX + kx - 2, cy, 6, 1, I('#56648c'));
    for (const sx of [-1, 1]) for (let j = 0; j < 5; j++) put(b, HX + kx + (sx < 0 ? -2 : 3) + sx * MA.round(j * 0.5 - (j > 2 ? (j - 2) : 0)), cy + 3 + j, I('#2f3a5c'));
  }
  // the conveyor across the tunnel floor and robot-jelly domes riding it
  for (let x = HX - HR; x <= HX + HR; x++) if (inHole(x, HY + 36)) {
    put(b, x, HY + 34, I('#46557a')); put(b, x, HY + 35, I('#2a3352')); put(b, x, HY + 36, x % 6 < 3 ? I('#38446a') : I('#151b32')); put(b, x, HY + 37, I('#0d1124'));
    if (x % 6 === 0) put(b, x, HY + 38, I('#1f2846'));
  }
  for (const kx of [-32, -14, 6, 25]) {
    const yy = HY + 33;
    for (let j = -5; j <= 0; j++) for (let i = -5; i <= 5; i++) if (i * i / 25 + j * j / 25 <= 1 && inHole(HX + kx + i, yy + j)) put(b, HX + kx + i, yy + j, j < -3 ? I('#7a8cb0') : i < -2 ? I('#5a6a90') : I('#3c4a6c'));
    put(b, HX + kx - 2, yy - 4, I('#b0c0dc')); rect(b, HX + kx - 2, yy - 2, 2, 1, I('#ff4a48')); rect(b, HX + kx + 1, yy - 2, 2, 1, I('#ff4a48'));
    for (let i = -4; i <= 4; i += 2) put(b, HX + kx + i, yy + 1, I('#2f3b59'));
  }
  glow(gl.warm, TX, TY, 30, I('#ff3a3a'), 0.22, 26);
  glow(gl.warm, TX, TY, 10, I('#ff6a3a'), 0.35);
  // the hazard ring and the steel ring with rivets
  for (let y = HY - 67; y <= HY + 67; y++) for (let x = HX - 67; x <= HX + 67; x++) {
    const d = MA.hypot(x - HX, y - HY);
    if (d <= HR || d > 66.5) continue;
    const a = MA.atan2(y - HY, x - HX), light = MA.cos(a + MA.PI * 0.75);   // lit from the upper left
    let c;
    if (d <= 58) {
      const stripe = MA.floor((a * 54 + d * 1.2) / 3.5) & 1;
      c = stripe ? (light > 0.2 ? I('#c79a2a') : I('#9c7420')) : I('#1a1822');
      if (d > 57) c = STEEL[0];
    } else {
      const t = 0.5 + light * 0.32 + (d > 64 ? -0.2 : d < 60 ? 0.12 : 0);
      c = ramp(STEEL, t, x, y);
    }
    put(b, x, y, c);
  }
  for (let k = 0; k < 18; k++) { const a = k * MA.PI * 2 / 18, x = HX + MA.cos(a) * 62, y = HY + MA.sin(a) * 62; put(b, x, y, STEEL[5]); put(b, x + 1, y + 1, STEEL[0]); }
  // the vault door, swung open to the left (seen nearly edge on): rim, hazard edge, wheel
  const DX = 6241;
  for (let y = HY - 62; y <= HY + 62; y++) for (let x = DX - 12; x <= DX + 12; x++) {
    const e = (x - DX) ** 2 / 144 + (y - HY) ** 2 / 3844;
    if (e > 1) continue;
    let c = ramp(STEEL, 0.62 - (x - DX) / 30 - (y - HY) / 300, x, y);
    if (e > 0.82) { c = (MA.floor((y + x) / 4) & 1) ? I('#b68c26') : I('#1a1822'); if (e > 0.94) c = STEEL[0]; }
    put(b, x, y, c);
  }
  for (let k = 0; k < 14; k++) { const a = k / 14 * MA.PI * 2, x = DX + MA.cos(a) * 9.5, y = HY + MA.sin(a) * 52; put(b, x, y, STEEL[5]); put(b, x + 1, y + 1, STEEL[0]); }
  for (let y = HY - 16; y <= HY + 16; y++) { put(b, DX - 1, y, STEEL[0]); put(b, DX, y, STEEL[4]); }
  for (let x = DX - 5; x <= DX + 5; x++) { put(b, x, HY, STEEL[5]); put(b, x, HY + 1, STEEL[0]); }
  oval(b, DX, HY, 2, 4, I('#c0392b')); put(b, DX - 1, HY - 2, I('#ff8a78'));
  for (const hy of [HY - 40, HY + 40]) { rect(b, DX + 8, hy - 3, 12, 6, STEEL[2]); rect(b, DX + 8, hy - 3, 12, 1, STEEL[4]); rect(b, DX + 8, hy + 2, 12, 1, STEEL[0]); put(b, DX + 17, hy, STEEL[5]); }
  // the emblem above the hatch: a cartoon robot octopus on a hazard-framed plate
  const EX = HX, EY = 47;
  rect(b, EX - 18, EY - 12, 36, 24, I('#1a1822'));
  for (let y = EY - 11; y <= EY + 10; y++) for (let x = EX - 17; x <= EX + 16; x++) {
    const border = x < EX - 14 || x > EX + 13 || y < EY - 8 || y > EY + 7;
    put(b, x, y, border ? ((MA.floor((x + y) / 3) & 1) ? I('#c79a2a') : I('#1a1822')) : STEEL[1]);
  }
  for (let y = EY - 7; y <= EY + 1; y++) for (let x = EX - 8; x <= EX + 8; x++) { const e = (x - EX) ** 2 / 72 + (y - EY - 1) ** 2 / 64; if (e <= 1 && y <= EY + 1) put(b, x, y, e > 0.7 ? STEEL[3] : STEEL[4]); }
  for (const ex of [-4, 3]) { rect(b, EX + ex, EY - 3, 2, 2, I('#ff4040')); put(b, EX + ex, EY - 3, I('#ffd0c0')); }
  rect(b, EX - 3, EY, 6, 1, STEEL[1]);
  for (let k = 0; k < 5; k++) { const tx = EX - 8 + k * 4; for (let j = 0; j < 5; j++) put(b, tx + MA.round(MA.sin(j * 0.9 + k) * 1), EY + 2 + j, j === 4 ? STEEL[3] : STEEL[4]); }
  for (const [rx, ry] of [[EX - 16, EY - 10], [EX + 15, EY - 10], [EX - 16, EY + 9], [EX + 15, EY + 9]]) put(b, rx, ry, STEEL[5]);
  // beacon bases on the ring (the lights are live)
  for (const [bx, by] of BEACONS) { rect(b, bx - 4, by + 1, 9, 3, STEEL[0]); rect(b, bx - 3, by + 1, 7, 1, STEEL[3]); }
  // a sagging cable of little warning lamps from the overhang to the collar (lamps are live)
  for (let i = 0; i <= 90; i++) { const t = i / 90, x = lerp(6178, 6252, t), y = lerp(52, 70, t) + MA.sin(t * MA.PI) * 9; put(b, x, y, I('#2a3350')); put(b, x, y + 1, I('#0b0d1e')); }
}
// a riser pipe climbing the rock face from the floor into the overhang (painted before the bulkhead)
function paintRiser(b) {
  const PP = PI("#151b2e", "#232c45", "#36446a", "#4f6390", "#7590bb"), X = 6221;
  for (let y = 54; y <= 246; y++) for (let i = -3; i <= 3; i++) put(b, X + i, y, MA.abs(i) === 3 ? PP[0] : ramp(PP, 0.72 - MA.abs(i + 1) / 5, X + i, y));
  for (let y = 70; y < 240; y += 28) { rect(b, X - 4, y, 9, 2, PP[1]); rect(b, X - 4, y, 9, 1, PP[3]); rect(b, X + 4, y - 1, 6, 4, PP[0]); put(b, X + 6, y, PP[4]); }
  for (let y = 150; y < 166; y++) for (let i = -3; i <= 3; i++) put(b, X + i, y, (MA.floor((y + i) / 3) & 1) ? I('#b68c26') : I('#1a1822'));
  rect(b, X - 5, 52, 11, 4, PP[2]); rect(b, X - 5, 52, 11, 1, PP[4]); rect(b, X - 5, 55, 11, 1, PP[0]);
}
const BEACONS = [[6298, 63], [6346, 63]];
const PORTS = [[6272, 90], [6372, 90], [6272, 190], [6372, 190]];
const LAMPS = [0.2, 0.4, 0.6, 0.8].map(t => [MA.round(lerp(6178, 6252, t)), MA.round(lerp(52, 70, t) + MA.sin(t * MA.PI) * 9) + 1]);

// pipes from the lair along the floor, a valve, a vent (bubbles are live)
function paintPipes(b, gl) {
  const PP = PI('#151b2e', '#232c45', '#36446a', '#4f6390', '#7590bb');
  const pipeH = (x0, x1, yc) => { for (let x = x0; x <= x1; x++) for (let j = -4; j <= 4; j++) { const t = 0.75 - MA.abs(j + 1.5) / 6; put(b, x, yc + j, MA.abs(j) === 4 ? PP[0] : ramp(PP, t, x, yc + j)); } for (let x = x0 + 6; x < x1; x += 22) { for (let j = -5; j <= 5; j++) { put(b, x, yc + j, PP[3]); put(b, x + 1, yc + j, PP[1]); put(b, x + 2, yc + j, PP[0]); } put(b, x, yc - 3, PP[4]); } };
  const yA = MA.round(gy(6180)) - 7;
  pipeH(6118, 6252, yA);
  // hazard band near the lair and the elbow vent at the left end
  for (let x = 6226; x < 6250; x++) for (let j = -3; j <= 3; j++) put(b, x, yA + j, (MA.floor((x + j) / 3) & 1) ? I('#b68c26') : I('#1a1822'));
  for (let y = yA - 16; y <= yA; y++) for (let i = -4; i <= 4; i++) put(b, 6118 + i, y, MA.abs(i) === 4 ? PP[0] : ramp(PP, 0.75 - MA.abs(i + 1.5) / 6, 6118 + i, y));
  rect(b, 6112, yA - 19, 13, 4, PP[1]); rect(b, 6112, yA - 19, 13, 1, PP[4]); rect(b, 6113, yA - 18, 11, 1, I('#05060f'));
  // the valve wheel (a red pop of colour)
  const vx = 6184, vy = yA - 10;
  for (let y = vy; y < yA - 3; y++) put(b, vx, y, PP[2]);
  oval(b, vx, vy - 1, 6, 2, I('#7a1c22')); oval(b, vx, vy - 1, 5, 1, I('#c0392b')); put(b, vx - 3, vy - 2, I('#ff8a78')); put(b, vx, vy - 1, PP[4]);
  // a pressure gauge
  disc(b, 6206, yA - 9, 3, PP[4]); disc(b, 6206, yA - 9, 2, I('#e8e4d0')); put(b, 6207, yA - 10, I('#c0392b')); put(b, 6206, yA - 9, I('#1a1822'));
  for (let y = yA - 6; y < yA - 3; y++) put(b, 6206, y, PP[2]);
  // pipe B: out of the collar, bending down into the floor
  for (let x = 6232; x <= 6252; x++) for (let j = -3; j <= 3; j++) put(b, x, 216 + j, MA.abs(j) === 3 ? PP[0] : ramp(PP, 0.7 - MA.abs(j + 1) / 5, x, 216 + j));
  for (let y = 216; y <= 240; y++) for (let i = -3; i <= 3; i++) put(b, 6232 + i, y, MA.abs(i) === 3 ? PP[0] : ramp(PP, 0.7 - MA.abs(i + 1) / 5, 6232 + i, y));
  // floor scrap: a dented robot dome and plates
  oval(b, 6150, MA.round(gy(6150)) - 2, 6, 4, STEEL[2]); oval(b, 6149, MA.round(gy(6150)) - 4, 4, 2, STEEL[3]); put(b, 6147, MA.round(gy(6150)) - 5, STEEL[5]);
  rect(b, 6136, MA.round(gy(6136)) - 2, 7, 2, STEEL[1]); rect(b, 6160, MA.round(gy(6160)) - 1, 5, 1, STEEL[3]);
  glow(gl.warm, 6206, yA - 9, 6, I('#ffc070'), 0.1);
}

// ============================================================
// World build: the behind strip, the lair, the ground strip, four light layers
// ============================================================
// the coral gardens, left to right: [kind, x, size, palette or boulder height, count, lift (sits on a boulder)]
const GARDEN = [
  // the way in (seen while the ruins fade out)
  ['boulder', 4986, 30, 22], ['tubes', 4980, 34, CYAN, 5, 18], ['fan', 5010, 52, MAG], ['worms', 5034, 6], ['pen', 5048, 32],
  ['dome', 5074, 16, VIO], ['anem', 5098, 18, CYAN], ['tubes', 5124, 30, VIO, 4], ['pen', 5146, 38], ['pen', 5155, 28],
  ['fan', 5178, 44, VIO], ['worms', 5198, 5],
  // frame 1 (camera 5210): hero 5352, robot jelly 5462, robot octopus 5508, cuttlefish cage 5650
  ['boulder', 5222, 22, 16], ['tubes', 5220, 36, CYAN, 4, 14], ['pen', 5248, 36], ['pen', 5257, 26],
  ['tubes', 5274, 16, VIO, 3], ['fan', 5300, 72, MAG], ['worms', 5334, 7], ['anem', 5360, 14, CYAN],
  ['dome', 5390, 22, VIO], ['pen', 5418, 40], ['pen', 5427, 29], ['pen', 5436, 34], ['anem', 5462, 16, MAG],
  ['boulder', 5506, 36, 24], ['tubes', 5494, 30, CYAN, 4, 20], ['fan', 5524, 34, VIO, 0, 16],
  ['worms', 5556, 6], ['anem', 5590, 22, MAG], ['pen', 5616, 24], ['dome', 5676, 12, CYAN], ['tubes', 5694, 46, CYAN, 5],
  // between the frames
  ['fan', 5728, 50, VIO], ['worms', 5756, 5], ['boulder', 5792, 28, 16], ['tubes', 5788, 28, VIO, 3, 14], ['anem', 5822, 16, CYAN],
  ['pen', 5848, 36], ['pen', 5858, 28], ['dome', 5886, 18, MAG], ['tubes', 5904, 26, CYAN, 3],
  // frame 2 (camera 5920): hero 6082, the lair from 6200
  ['fan', 5934, 52, MAG], ['tubes', 5966, 40, CYAN, 5], ['worms', 5994, 7], ['pen', 6014, 34], ['pen', 6023, 26],
  ['boulder', 6044, 30, 18], ['dome', 6042, 13, MAG, 0, 16], ['fan', 6076, 66, VIO], ['anem', 6104, 18, CYAN],
  ['pen', 6128, 30], ['worms', 6146, 4], ['tubes', 6172, 24, VIO, 3], ['anem', 6198, 14, MAG]
];
// small, darker back-row corals that fill the gaps (seeded)
function backRow(b, gl) {
  for (let x = WX0 + 4; x < 6200; x += 7 + MA.floor(hs(x) * 9)) {
    const y = MA.round(gy(x)) - 1, k = hs(x * 1.3), gi = MA.floor(hs(x * 2.1) * 3), P = [CYAN, MAG, VIO][gi];
    const D = { d: mixI(P.d, ROCK[1], 0.4), b: mixI(P.b, ROCK[1], 0.45), m: mixI(P.m, ROCK[1], 0.45), l: mixI(P.l, ROCK[1], 0.45), r: mixI(P.r, ROCK[2], 0.4), t: mixI(P.t, ROCK[2], 0.4), g: P.g };
    if (k < 0.35) tubes(b, null, x, y, 2, 10 + hs(x + 1) * 10, x, D);
    else if (k < 0.6) fan(b, null, x, y, 14 + hs(x + 2) * 14, x, D);
    else if (k < 0.8) dome(b, null, x, y, 5 + MA.floor(hs(x + 3) * 5), 4 + MA.floor(hs(x + 4) * 3), x, D);
    else for (let i = 0; i < 4; i++) { const xx = x + i * 2, hh = 2 + MA.floor(hs(x + i) * 5); for (let j = 0; j < hh; j++) put(b, xx, y - j, D.b); put(b, xx, y - hh, D.r); }
    if (hs(x * 4.4) > 0.6) glow(gl[['cyan', 'mag', 'vio'][gi]], x, y - 6, 8, P.g, 0.08);
  }
}
function buildWorld() {
  if (WB) return WB;
  if (!NZT) makeNZT();
  const top = 0, bot = 252;
  const b = buf(WX1 - WX0, bot - top, -WX0, -top);
  const lg = () => lbuf(WX1 - WX0, H - top, -WX0, -top);
  const gl = { cyan: lg(), mag: lg(), vio: lg(), warm: lg() };
  const glOf = P => P === CYAN ? gl.cyan : P === MAG ? gl.mag : P === VIO ? gl.vio : gl.warm;
  paintLair(b, gl);
  backRow(b, gl);
  for (const [k, x, s, a, n, lift] of GARDEN) {
    const y = MA.round(gy(x)) + 1 - (lift || 0);
    if (k === 'tubes') tubes(b, glOf(a), x, y, n, s, x, a);
    else if (k === 'fan') fan(b, glOf(a), x, y, s, x, a);
    else if (k === 'dome') dome(b, glOf(a), x, y, s, MA.round(s * 0.7), x % 97, a);
    else if (k === 'anem') anemone(b, glOf(a), x, y, s, x, a);
    else if (k === 'pen') seaPen(b, gl.warm, x, y, s, x);
    else if (k === 'worms') worms(b, gl.mag, x, y, s, x);
    else if (k === 'boulder') boulder(b, gl, x, y, s, a, x % 89, null);
  }
  paintPipes(b, gl);
  // starfish and shells on the sand
  for (const [x, c1, c2] of [[5062, '#ff8a4a', '#ffd08a'], [5318, '#ff6f8a', '#ffc0cc'], [5478, '#ff8a4a', '#ffd08a'], [5604, '#b06cff', '#e2c8ff'], [5876, '#ff8a4a', '#ffd08a'], [6040, '#ff6f8a', '#ffc0cc']]) starfish(b, x, MA.round(gy(x)) - 1, 4, I(c1), I(c2));
  // light pools on the sand under the gardens
  for (const [k, x, s, a] of GARDEN) if (k !== 'boulder' && k !== 'worms') glow(k === 'pen' ? gl.warm : glOf(a), x, gy(x) + 4, s * 1.1 + 14, (k === 'pen' ? WARM : a).g, 0.17, 9);
  // the ground strip: dark sand in wavy layers with ripples, a lit lip, pebbles, shells and glowing grains
  const G0 = 234, gb = buf(WX1 - WX0, H - G0 + 2, -WX0, -G0);
  for (let x = WX0; x < WX1; x++) {
    const yg = MA.round(gy(x));
    for (let y = yg; y < H + 2; y++) {
      const d = y - yg, n = jfbm(x / 9, y / 3, 51, 3), rip = MA.sin(x * 0.19 + MA.sin(x * 0.031) * 3 + d * 0.15);
      const band = MA.sin((y + 3 * MA.sin(x / 37) + 2 * fbm(x / 13, 52, 2)) * 0.62);
      let c = ramp(SAND, 0.66 - d * 0.03 + (n - 0.5) * 0.36 + (band > 0.8 ? -0.12 : 0) + (d < 6 && rip > 0.7 ? 0.12 : 0), x, y);
      if (d === 0) c = SAND[6 - (hs(x * 0.7) > 0.7 ? 1 : 0)]; else if (d === 1) c = SAND[5];
      if (x < AX0 && bay(x, y) > (x - WX0) / (AX0 - WX0)) continue;   // dither into the previous area's ground
      put(gb, x, y, c);
    }
    if (hs(x * 1.37) > 0.82 && x >= AX0) put(gb, x, yg - 1, SAND[5]);   // little bumps on the lip
  }
  // pebbles (some half buried at the lip), scallop shells, spiral shells
  for (let i = 0; i < 150; i++) {
    const x = AX0 + MA.floor(hs(i * 3.7 + 11) * (WX1 - AX0)), yg = MA.round(gy(x)), deep = hs(i * 5.1) > 0.45, y = deep ? yg + 4 + MA.floor(hs(i * 2.3) * (H - yg - 6)) : yg;
    const k = hs(i * 9.3), w = 2 + MA.floor(hs(i * 4.1) * 4);
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
    const x = WX0 + MA.floor(hs(i * 7.3 + 5) * (WX1 - WX0)), y = MA.round(gy(x)) + 1 + MA.floor(hs(i * 5.9) ** 2 * (H - gy(x) - 1));
    const k = hs(i * 9.7);
    if (k < 0.4) { put(gb, x, y, SAND[6]); put(gb, x + 1, y, SAND[4]); }
    else if (k < 0.62) put(gb, x, y, SAND[0]);
    else { const P = [CYAN, MAG, VIO][i % 3]; put(gb, x, y, P.r); if (k > 0.85) put(gb, x + 1, y, P.t); glow(gl[['cyan', 'mag', 'vio'][i % 3]], x + 0.5, y + 0.5, 4, P.g, 0.22); }
  }
  WB = { c: bake(b), g: bake(gb), G0, top, light: { cyan: bakeLight(gl.cyan), mag: bakeLight(gl.mag), vio: bakeLight(gl.vio), warm: bakeLight(gl.warm) } };
  return WB;
}

// ============================================================
// Front strip (p 1.2, screen space): low dark rocks and coral silhouettes at the very bottom
// ============================================================
function paintFront() {
  const p = 1.2, top = 224, b = stripBuf(p, top, H), gl = stripLight(b), w = b.w - 10;
  const FR = PI('#05061a', '#080a22', '#0c0f2c', '#131740');
  for (let x = -10; x < w; x++) {
    const cell = MA.floor(x / 150), on = hs(cell * 2.3) > 0.35, cx0 = cell * 150 + 30 + hs(cell) * 90, hw = 18 + hs(cell * 3.1) * 30, hh = 4 + hs(cell * 5.7) * 7;
    const d = MA.abs(x - cx0) / hw;
    let yt = 264 + 3 * fbm(x / 20, 61, 2);
    if (on && d < 1) yt = MA.min(yt, 264 - hh * MA.sqrt(1 - d * d) + (fbm(x / 5, 62, 2) - 0.5) * 3);
    yt = MA.round(yt);
    for (let y = yt; y < H; y++) put(b, x, y, y === yt ? FR[3] : y === yt + 1 ? FR[2] : ramp(FR, 0.45 - (y - yt) / 16 + (jfbm(x / 4, y / 4, 63, 2) - 0.5) * 0.4, x, y));
  }
  // coral silhouettes on the lumps, some tips glowing
  for (let i = 0; i < 40; i++) {
    const x = MA.floor(-6 + hs(i * 7.3 + 5) * (w + 2));
    let y = top; while (y < H && get(b, x, y) === NONE) y++;
    if (y > H - 3) continue;
    const P = [CYAN, MAG, VIO, WARM][i % 4], hh = 4 + MA.floor(hs(i * 3.9) * 9);
    if (i % 3 === 0) { for (let k = 0; k < 3; k++) { const xx = x + k * 2 - 2, h = hh - k * 2; for (let j = 0; j < h; j++) put(b, xx, y - j, FR[1]); put(b, xx, y - h, mixI(P.r, FR[1], 0.3)); glow(gl, xx, y - h, 6, P.g, 0.25); } }
    else { for (let j = 0; j < hh; j++) { put(b, x + MA.round(MA.sin(j * 0.5 + i) * 1.5), y - j, FR[1]); } put(b, x + MA.round(MA.sin(hh * 0.5 + i) * 1.5), y - hh, mixI(P.r, FR[1], 0.35)); }
  }
  return { c: bake(b), l: bakeLight(gl), p, top };
}

// ============================================================
// Live layers
// ============================================================
let BG = null;
function buildBG() {
  if (BG) return BG;
  if (!NZT) makeNZT();
  BG = {
    water: paintWater(), farGlow: paintFarGlow(), far: paintFar(), mid: paintMid(), ceil: paintCeiling(), front: paintFront(),
    jellyP: jellyFrames(19, { d: I('#5a3a8a'), b: I('#8e5cc8'), l: I('#c79af0'), r: I('#f0c8ff'), t: I('#ffffff') }),
    jellyPs: jellyFrames(13, { d: I('#4a3478'), b: I('#7a52b0'), l: I('#b088e0'), r: I('#dcb8f8'), t: I('#f8eaff') }),
    jellyC: jellyFrames(16, { d: I('#1f5a78'), b: I('#2f8aa8'), l: I('#6fd6e0'), r: I('#bafff6'), t: I('#ffffff') }),
    haloP: haloCanvas(22, '#c070ff', 0.32), haloC: haloCanvas(18, '#40e8e0', 0.3), haloS: haloCanvas(12, '#c070ff', 0.26),
    angler: anglerSprite(), lure: haloCanvas(14, '#7affd8', 0.6), lureCore: haloCanvas(4, '#e0fff4', 0.9),
    lantern: lanternFish(), beacon: haloCanvas(16, '#ff3b30', 0.5), amber: haloCanvas(8, '#ffb040', 0.5),
    motes: [haloCanvas(5, '#60fff0', 0.55), haloCanvas(5, '#ff70e0', 0.5), haloCanvas(5, '#a080ff', 0.55)],
    fade: null
  };
  return BG;
}
// jellyfish in the background: [design x, y, parallax, kind, phase]; design x = screen x at camera CAM0
// (seen at F1: pink 396,74  cyan 46,150 and 376,100  small violet 180,70; at F2: pink 183,74  cyan 262,100  violet 95,70)
const JELLIES = [[591, 74, 0.3, 'P', 0.0], [150, 150, 0.16, 'C', 2.0], [480, 100, 0.16, 'C', 5.2], [258, 70, 0.12, 'S', 4.0]];
function drawJellies(g, cx, far) {
  const B = BG;
  for (const [dx, sy, p, k, ph] of JELLIES) {
    if ((p < 0.15) !== far) continue;
    const x = ssx(dx, cx, p) + MA.sin(G.t * 0.006 + ph) * 8, y = sy + MA.sin(G.t * 0.013 + ph) * 5 - MA.max(0, MA.sin(G.t * 0.05 + ph)) * 2;
    if (x < -40 || x > W + 40) continue;
    const fr = (k === 'P' ? B.jellyP : k === 'C' ? B.jellyC : B.jellyPs)[MA.floor(G.t / 9 + ph * 3) & 3], h = k === 'P' ? B.haloP : k === 'C' ? B.haloC : B.haloS;
    lit(g, h.img, MA.round(x) - h.o, MA.round(y) - h.o - 2, 0.7 + 0.3 * MA.sin(G.t * 0.05 + ph));
    g.globalAlpha = far ? 0.5 : 0.72; blitS(g, fr, x, y); g.globalAlpha = 1;
  }
}
// the anglerfish far off, its lure bobbing and pulsing: [screen x, y, camera, parallax, facing]
const ANGLERS = [[112, 98, F1, 0.12, 1]];
function drawAnglers(g, cx) {
  const B = BG;
  for (const [sx, sy, cam, p, f] of ANGLERS) {
    const x = MA.round(ssx(dsx(sx, cam, p), cx, p) + MA.sin(G.t * 0.004 + sx) * 6), y = MA.round(sy + MA.sin(G.t * 0.011 + sx) * 3);
    if (x < -50 || x > W + 50) continue;
    g.save(); g.translate(x, y); g.scale(f, 1);
    g.globalAlpha = 0.9; blitS(g, B.angler, 0, 0); g.globalAlpha = 1;
    // the lure stalk: an arc from the forehead forward
    const lx = 20 + MA.round(MA.sin(G.t * 0.03 + sx) * 1.5), ly = -17 + MA.round(MA.sin(G.t * 0.045 + sx));
    g.fillStyle = '#4a64a0';
    for (let i = 0; i <= 12; i++) { const t = i / 12; g.fillRect(MA.round(lerp(3, lx, t)), MA.round(lerp(-13, ly, t) - MA.sin(t * MA.PI) * 7), 1, 1); }
    const pulse = 0.75 + 0.25 * MA.sin(G.t * 0.07 + sx);
    lit(g, B.lure.img, lx - B.lure.o, ly - B.lure.o, pulse);
    lit(g, B.lureCore.img, lx - B.lureCore.o, ly - B.lureCore.o, 1);
    g.fillStyle = '#e8fff6'; g.fillRect(lx, ly, 1, 1);
    g.restore();
  }
}
// a school of lanternfish crossing the mid distance
function drawLanterns(g, cx) {
  const B = BG, p = 0.35;
  for (const [sx, sy, cam, n] of [[300, 150, F1, 9], [120, 160, F2, 7]]) {
    const base = ssx(dsx(sx, cam, p), cx, p) + ((G.t * 0.12) % 900);
    for (let i = 0; i < n; i++) {
      const x = MA.round(base - 900 * (base > W + 60 ? 1 : 0) + (i % 3) * 9 + MA.floor(i / 3) * 13 + MA.sin(G.t * 0.04 + i) * 2), y = MA.round(sy + (i % 3) * 6 - MA.floor(i / 3) * 3 + MA.sin(G.t * 0.03 + i * 1.7) * 2);
      if (x < -10 || x > W + 10) continue;
      g.globalAlpha = 0.85; blitS(g, B.lantern, x, y); g.globalAlpha = 1;
    }
  }
}

function myBG(g, cx) {
  const B = buildBG();
  g.drawImage(B.water, -10, -10);
  blitStrip(g, B.far.c, B.far.p, B.far.top, cx);
  lit(g, B.farGlow, -10 - sOff(0.04, cx, B.farGlow.width), 0, 1);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.7 + 0.3 * MA.sin(G.t * 0.02);
  g.drawImage(B.far.l, sOff(B.far.p, cx, B.far.l.width), 0, W + 20, B.far.l.height, -10, B.far.top, W + 20, B.far.l.height);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  drawAnglers(g, cx);
  drawJellies(g, cx, true);
  blitStrip(g, B.mid.c, B.mid.p, B.mid.top, cx);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.75 + 0.25 * MA.sin(G.t * 0.025 + 1);
  g.drawImage(B.mid.l, sOff(B.mid.p, cx, B.mid.l.width), 0, W + 20, B.mid.l.height, -10, B.mid.top, W + 20, B.mid.l.height);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  drawJellies(g, cx, false);
  drawLanterns(g, cx);
  blitStrip(g, B.ceil.c, B.ceil.p, 0, cx);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.7 + 0.3 * MA.sin(G.t * 0.03 + 2);
  g.drawImage(B.ceil.l, sOff(B.ceil.p, cx, B.ceil.l.width), 0, W + 20, B.ceil.l.height, -10, 0, W + 20, B.ceil.l.height);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

// world-space blit of a world strip canvas (ctx is translated by -cx)
function worldBlit(c, cx, y0) {
  const sx = MA.max(0, MA.floor(cx - 12 - WX0)), ex = MA.min(c.width, MA.ceil(cx + W + 12 - WX0));
  if (ex > sx) ctx.drawImage(c, sx, 0, ex - sx, c.height, WX0 + sx, y0, ex - sx, c.height);
}
function lairLive(cx) {
  if (cx + W < 6150) return;
  const B = BG;
  // beacons: red domes with a turning light
  for (let i = 0; i < BEACONS.length; i++) {
    const [bx, by] = BEACONS[i], ph = G.t * 0.11 + i * MA.PI, on = MA.cos(ph);
    R(bx - 3, by - 3, 7, 4, '#5a1420'); R(bx - 2, by - 4, 5, 1, '#5a1420');
    const side = MA.round(MA.sin(ph) * 2);
    R(bx - 1 + side, by - 3, 2, 3, on > -0.3 ? '#ff4a3a' : '#a02028'); R(bx - 1 + side, by - 4, 1, 1, '#ffd0c0');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.45 * MA.max(0, on);
    ctx.drawImage(B.beacon.img, bx - B.beacon.o, by - 2 - B.beacon.o); ctx.restore();
  }
  // cable lamps blinking in turn
  for (let i = 0; i < LAMPS.length; i++) {
    const [lx, ly] = LAMPS[i], on = (MA.floor(G.t / 20) + i) % 2 === 0;
    R(lx - 1, ly, 4, 4, '#0b0d1e'); R(lx, ly + 1, 2, 2, on ? (i % 2 ? '#ffd040' : '#ff4a3a') : '#3a2a20'); if (on) R(lx, ly + 1, 1, 1, '#fff2c0');
    if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(B.amber.img, lx + 1 - B.amber.o, ly + 2 - B.amber.o); ctx.restore(); }
  }
  // running lights chasing round the steel ring
  const head = (G.t / 5) % 16;
  for (let k = 0; k < 16; k++) {
    const a = k * MA.PI / 8 - MA.PI / 2, x = MA.round(HX + MA.cos(a) * 62), y = MA.round(HY + MA.sin(a) * 62), d = (head - k + 16) % 16;
    R(x - 1, y - 1, 2, 2, d < 1 ? '#fff0b0' : d < 2.2 ? '#ffc040' : d < 3.4 ? '#a06018' : '#3a2a14');
    if (d < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(B.amber.img, x - B.amber.o, y - B.amber.o); ctx.restore(); }
  }
  // robot silhouettes passing behind the portholes
  for (const [px, py, ph] of [[PORTS[0][0], PORTS[0][1], 0], [PORTS[3][0], PORTS[3][1], 2.4]]) {
    const s = MA.sin(G.t * 0.02 + ph);
    if (s > 0.3) { const ox = MA.round((s - 0.65) * 18); ctx.save(); ctx.beginPath(); ctx.arc(px + 0.5, py + 0.5, 3, 0, MA.PI * 2); ctx.clip(); R(px + ox - 2, py - 1, 4, 4, '#3a1a10'); R(px + ox - 1, py - 2, 2, 1, '#3a1a10'); R(px + ox, py, 1, 1, '#ff5040'); ctx.restore(); }
  }
  // something is awake in there: two red eyes at the back of the tunnel until the boss comes out
  if (!G.enemies.some(e => e.type === 'megaoctopus')) {
    const blink = G.t % 150 < 6, gx = HX + MA.round(MA.sin(G.t * 0.02) * 2);
    if (!blink) { R(gx - 7, HY - 6, 4, 2, '#ff3a30'); R(gx + 4, HY - 6, 4, 2, '#ff3a30'); R(gx - 6, HY - 6, 1, 1, '#ffd0a0'); R(gx + 5, HY - 6, 1, 1, '#ffd0a0'); }
  }
  // the emblem's eye lamp and the vent bubbles
  if (MA.floor(G.t / 30) % 2) R(HX - 1, 34, 2, 2, '#ff4040');
  const yA = MA.round(gy(6180)) - 7;
  for (let i = 0; i < 6; i++) {
    const ph = ((G.t * 0.6 + i * 37) % 120) / 120, x = 6118 + MA.sin(ph * 9 + i) * 3, y = yA - 20 - ph * 80;
    ctx.strokeStyle = 'rgba(184,250,255,' + (0.5 * (1 - ph)).toFixed(3) + ')'; ctx.lineWidth = 1;
    ctx.strokeRect(MA.round(x) - 1, MA.round(y) - 1, 2 + (i % 2), 2 + (i % 2));
  }
}
const PULSE = { cyan: 0, mag: 2.1, vio: 4.2, warm: 1.1 };
function worldLight(cx) {
  const W0 = buildWorld();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const k in PULSE) { ctx.globalAlpha = 0.62 + 0.38 * MA.sin(G.t * 0.028 + PULSE[k]); worldBlit(W0.light[k], cx, W0.top); }
  ctx.restore();
}

// ============================================================
// Hooks: mine while the camera can see the Glowing Deep; the previous painter's hooks elsewhere
// ============================================================
const fadeK = cx => ss(FADE0, FADE1, cx);
L.drawBG = cx => {
  const k = fadeK(cx);
  if (k <= 0) return prev.bg(cx);
  if (k >= 1) return myBG(ctx, cx);
  prev.bg(cx);
  const B = buildBG();
  if (!B.fade) B.fade = canvasOf(W + 20, H + 20);
  const g = B.fade.getContext('2d'); g.imageSmoothingEnabled = false;
  g.setTransform(1, 0, 0, 1, 10, 10); myBG(g, cx); g.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = k; ctx.drawImage(B.fade, -10, -10); ctx.globalAlpha = 1;
};
// world hooks: the previous painter keeps everything left of the area start
function clipLeft(cx, fn) { ctx.save(); ctx.beginPath(); ctx.rect(cx - 30, -30, AX0 - (cx - 30), H + 60); ctx.clip(); fn(cx); ctx.restore(); }
const seesMine = cx => cx + W > WX0;
L.drawBehind = cx => {
  if (!seesMine(cx)) return prev.behind(cx);
  if (cx < AX0) clipLeft(cx, prev.behind);
  buildBG();
  const W0 = buildWorld();
  worldBlit(W0.c, cx, W0.top);
  lairLive(cx);
};
L.drawGround = cx => {
  if (!seesMine(cx)) return prev.ground(cx);
  if (cx < AX0) clipLeft(cx, prev.ground);
  const W0 = buildWorld();
  worldBlit(W0.g, cx, W0.G0);
  worldLight(cx);
};
L.drawFront = cx => {
  if (!seesMine(cx)) return prev.front(cx);
  if (cx < AX0) { ctx.save(); ctx.beginPath(); ctx.rect(-10, -10, AX0 - cx + 10, H + 20); ctx.clip(); prev.front(cx); ctx.restore(); }
  const B = buildBG(), F = B.front, k = fadeK(cx);
  ctx.save(); ctx.beginPath(); ctx.rect(MA.max(-10, WX0 - cx), -10, W + 20, H + 20); ctx.clip();
  blitStrip(ctx, F.c, F.p, F.top, cx);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (0.7 + 0.3 * MA.sin(G.t * 0.03)) * k;
  ctx.drawImage(F.l, sOff(F.p, cx, F.l.width), 0, W + 20, F.l.height, -10, F.top, W + 20, F.l.height);
  ctx.restore();
};
function myOverlay(cx) {
  // glowing motes drifting like underwater fireflies (soft halos, additive)
  const B = buildBG();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const p = 0.7 + hs(i * 2.9) * 0.5, x = MA.round(((hs(i * 4.3 + 1) * 1100 - cx * p + MA.sin(G.t * 0.011 + i * 1.7) * 18) % (W + 60) + W + 60) % (W + 60) - 30);
    const y = MA.round(72 + hs(i * 6.1) * 150 + MA.sin(G.t * 0.017 + i * 2.3) * 10), m = B.motes[i % 3], a = 0.45 + 0.4 * MA.sin(G.t * 0.06 + i * 1.3);
    if (a < 0.1) continue;
    ctx.globalAlpha = a; ctx.drawImage(m.img, x - m.o, y - m.o);
    ctx.globalAlpha = MA.min(1, a + 0.3); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
  // sparkling plankton: tiny twinkles drifting up and right, a few four-point sparkles
  for (let i = 0; i < 64; i++) {
    const p = 0.6 + hs(i * 1.3) * 0.6, x = MA.round(((hs(i * 3.7) * 900 - cx * p + G.t * (0.05 + hs(i) * 0.08)) % (W + 40) + W + 40) % (W + 40) - 20);
    const y = MA.round(64 + ((hs(i * 9.1) * 180 - G.t * (0.03 + hs(i * 2) * 0.05)) % 180 + 180) % 180 + MA.sin(G.t * 0.02 + i) * 3);
    const tw = MA.sin(G.t * (0.05 + hs(i * 5) * 0.08) + i * 2.3);
    if (tw < -0.2) continue;
    const c = i % 3 === 0 ? '200,255,250' : i % 3 === 1 ? '255,190,240' : '190,200,255';
    ctx.fillStyle = 'rgba(' + c + ',' + (0.35 + 0.6 * tw).toFixed(3) + ')'; ctx.fillRect(x, y, 1, 1);
    if (tw > 0.85 && i % 4 === 0) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  }
  // marine snow sinking
  ctx.fillStyle = 'rgba(170,180,220,0.35)';
  for (let i = 0; i < 26; i++) {
    const x = MA.round(((hs(i * 7.9 + 4) * 700 - cx * 0.9 + MA.sin(G.t * 0.01 + i) * 6) % (W + 20) + W + 20) % (W + 20) - 10), y = MA.round(((hs(i * 2.2) * 300 + G.t * 0.08) % 220) + 50);
    ctx.fillRect(x, y, 1, 1);
  }
  // rising bubbles from the floor vents of the gardens
  ctx.strokeStyle = 'rgba(181,242,244,0.22)'; ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) { const x = (hs(i + 93) * W - cx * 0.7 + W * 30) % W, y = H - ((G.t * (0.21 + hs(i) * 0.24) + hs(i + 4) * H) % H); ctx.beginPath(); ctx.arc(MA.round(x), MA.round(y), 1 + hs(i + 8) * 2, 0, MA.PI * 2); ctx.stroke(); }
}
L.drawOverlay = cx => {
  const k = fadeK(cx);
  if (k < 1) prev.overlay(cx);
  if (k > 0) { ctx.globalAlpha = k; myOverlay(cx); ctx.globalAlpha = 1; }
};

// ============================================================
// Staging for the proposal frames (only when the mission is built at exactly F1 or F2)
// ============================================================
let stage = null;
function bubble(x, y) {
  return { x, y, vx: 5.2, vy: 0, dmg: 1, life: 95, draw(b) { ctx.strokeStyle = '#b8faff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(MA.round(b.x), MA.round(b.y), 3, 0, MA.PI * 2); ctx.stroke(); R(b.x - 1, b.y - 2, 2, 1, '#ffffff'); } };
}
L.load = cp => {
  prev.load(cp);
  stage = MA.abs(cp - F1) < 1 ? 'deep' : MA.abs(cp - F2) < 1 ? 'lair' : null;
  if (stage === 'deep') {
    const j = makeEnemy({ t: 'robojelly', x: 5470, y: 100 }); j.active = true; G.enemies.push(j);
  }
};
L.update = () => {
  prev.update();
  if (!stage) return;
  const p = G.p;
  G.big = null; G.goT = 0;
  if (stage === 'deep') {
    Object.assign(p, { x: 5352, y: 168, vx: 0, vy: 0, facing: 1, inv: 0, dead: 0, hearts: 3, muzzle: 3, kb: 0 });
    G.score = 41350; G.lives = 3;
    G.banner = { s: 'FINAL AREA: GLOWING DEEP', t: 100 };
    for (const e of G.enemies) {
      if (e.type === 'roboctopus') { e.x = 5508; e.y = 200; e.state = 'idle'; e.timer = 999; e.active = true; }
      if (e.type === 'robojelly') { e.x = 5462; e.y = 112; e.state = 'idle'; e.timer = 999; e.active = true; }
    }
    G.pb = [bubble(5398, 154), bubble(5440, 154)];
    G.eb = []; G.items = [];
  } else {
    Object.assign(p, { x: 6082, y: 172, vx: 0, vy: 0, facing: 1, inv: 0, dead: 0, hearts: 2, muzzle: 3, kb: 0 });
    G.score = 68900; G.lives = 2; G.warnT = 0; G.banner = null;
    for (const e of G.enemies) if (e.type === 'megaoctopus') { e.x = 6318; e.y = 168; e.state = 'idle'; e.timer = 999; }
    G.pb = [bubble(6128, 158), bubble(6176, 158)];
    G.eb = []; G.items = [];
  }
};
}
