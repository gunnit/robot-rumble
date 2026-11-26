'use strict';
// ============================================================
// Mission 1 scenery, AREA 3: THE BIG BRIDGE (ground 3060-4340). Contract: tools/polish/build-contract.md.
// L1ART.bridge = { x0, x1, steps, bg, behind, ground, plat, front }, called by level1_art.js.
//   bg      a golden-sunset river gorge (screen space, into the context it is handed): dithered sky bands round a
//           low sun that sinks as you cross, rays, belly-lit clouds, a flock of birds, two purple ranges, hazy mesas,
//           the river (bands with their own parallax, a glitter path under the sun), and the gorge walls: the west
//           wall with a two-tier waterfall, the open gorge, a rock tower with a robot lookout, the east wall with a
//           slim second fall.
//   behind  the BRIDGE sign, stone pylons with lanterns, five riveted trussed arches, the far rope railing.
//   ground  the river under the bridge, stone piers, the plank deck on its riveted girder (spans numbered RR-01 to
//           RR-05), a stone abutment at each end. Exactly 3060..4340.
//   plat    the crate platforms as strapped cargo stacks.
//   front   low river rocks and reeds along the bottom edge (parallax 1.3).
// Everything static is painted pixel by pixel into buffers by the bake steps (once); the live bits (water bands,
// falls, mist, sparkles, birds, lamps, reeds) use G.t and hsh() only: never Math.random / rand.
// The band the fight happens in (rows ~196-232) is kept calm on purpose: thin muted hangers, a muted railing, a
// dusky river and a thinned glitter path, so robots and shots read.
// ============================================================
var L1ART = L1ART || {};
{
const BX0 = 3060, BX1 = 4340, SPAN = 256;   // the bridge; one arch span (5 spans, springs at BX0 + k * SPAN)
const CAM0 = 2630, CAM1 = 4290;             // the cameras bg is called for (the sky crossfades at both ends)

// ============================================================
// Helpers: noise, colours, pixel buffers (private copies of the level3_world.js approach)
// ============================================================
// Local aliases: the test harness runs the game in a vm context where every look-up of a global (Math.floor ...)
// is slow, and the bake does millions of them. This makes it about 50 times faster there; a browser does not care.
const Math = globalThis.Math;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (v, m) => ((v % m) + m) % m;
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const NZ = (() => { const r = rng(20261113), a = new Float32Array(65536); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
const nz = (x, y) => NZ[((Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0) & 65535];
function vn(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = s * 57;
  return lerp(lerp(nz(i + o, j), nz(i + 1 + o, j), a), lerp(nz(i + o, j + 1), nz(i + 1 + o, j + 1), a), b);
}
function fbm(x, y, s, oct = 3) { let v = 0, a = 1, n = 0, f = 1; for (let o = 0; o < oct; o++) { v += a * vn(x * f, y * f, s + o * 7); n += a; a *= 0.5; f *= 2.03; } return v / n; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
const P = (...s) => s.map(I);
const OUTI = I(OUT);
function mixI(a, b, k) {
  k = clamp(k, 0, 1);
  return (Math.round(lerp(a >> 16 & 255, b >> 16 & 255, k)) << 16) | (Math.round(lerp(a >> 8 & 255, b >> 8 & 255, k)) << 8) | Math.round(lerp(a & 255, b & 255, k));
}
// pick from a palette by t in 0..1 with ordered dithering between neighbours; `hard` keeps the middle of each step flat
function ramp(pal, t, x, y, hard = 0) {
  const f = clamp(t, 0, 1) * (pal.length - 1), i = Math.floor(f);
  let fr = f - i;
  if (hard) fr = clamp((fr - hard) / (1 - 2 * hard), 0, 1);
  return pal[Math.min(pal.length - 1, i + (fr > bay(x, y) ? 1 : 0))];
}
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Pixel buffers: Int32 0xRRGGBB, NONE = empty; the point (x, y) lands on pixel (x - x0, y - y0)
function buf(x0, y0, w, h) { w = Math.ceil(w); h = Math.ceil(h); const d = new Int32Array(w * h); d.fill(NONE); return { x0, y0, w, h, d }; }
function put(b, x, y, c) { x = Math.floor(x) - b.x0; y = Math.floor(y) - b.y0; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) - b.x0; y = Math.floor(y) - b.y0; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function putN(b, x, y, c) { if (get(b, x, y) === NONE) put(b, x, y, c); }   // only where nothing is painted yet
function rect(b, x, y, w, h, c) {
  x = Math.round(x) - b.x0; y = Math.round(y) - b.y0;
  const xa = Math.max(0, x), ya = Math.max(0, y), xb = Math.min(b.w, x + Math.round(w)), yb = Math.min(b.h, y + Math.round(h));
  if (xb > xa) for (let r = ya; r < yb; r++) b.d.fill(c, r * b.w + xa, r * b.w + xb);
}
function disc(b, cx, cy, r, c) {
  if (r < 0.4) { if (r >= 0) put(b, Math.round(cx), Math.round(cy), c); return; }
  const n = Math.ceil(r), R2 = (r + 0.5) * (r + 0.5), X = Math.round(cx), Y = Math.round(cy);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) if (i * i + j * j <= R2) put(b, X + i, Y + j, c);
}
function line(b, x0, y0, x1, y1, c, t = 1, only = false) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
    for (let a = 0; a < t; a++) for (let q = 0; q < t; q++) if (only) putN(b, x + a, y + q, c); else put(b, x + a, y + q, c);
  }
}
// 1px outline round everything painted (4 neighbours)
function outline(b, c = OUTI) {
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
    d[j] = v >> 16 & 255; d[j + 1] = v >> 8 & 255; d[j + 2] = v & 255; d[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// a sprite drawn with its local origin at (x, y)
function mk(b) { return { img: bake(b), x0: b.x0, y0: b.y0, w: b.w, h: b.h }; }
function blit(g, s, x, y) { g.drawImage(s.img, Math.round(x) + s.x0, Math.round(y) + s.y0); }

// Background strips: painted in strip coordinates; strip x = screen x + 10 + stripOff(p, cx)
const stripW = p => W + 22 + Math.ceil((CAM1 - CAM0) * p);
const stripOff = (p, cx) => clamp(Math.round((cx - CAM0) * p), 0, stripW(p) - W - 20);
function blitStrip(g, s, cx) { g.drawImage(s.img, stripOff(s.p, cx), 0, W + 20, s.h, -10, s.top, W + 20, s.h); }

// ============================================================
// Palettes (the sun is low on the right: things are lit from the right and from the sky above)
// ============================================================
const SUN = { x: 422, y: 134 };             // where the sky's glow is centred (screen)
// the disc itself drifts a little left and sinks 20 px between the first and the last camera
const sunX = cx => 429 - Math.round((cx - CAM0) * 0.012), sunY = cx => 127 + Math.round((cx - CAM0) * 0.012);
const SKYC = P('#2a3c84', '#36478f', '#46529c', '#5a5ca6', '#7266ac', '#8c70ae', '#a87aa8', '#c4849c', '#dc908c', '#ee9e7e', '#f8b074', '#fec478', '#ffd68c', '#ffe6a8');
const CLOUD_LOW = P('#fff2bc', '#ffd088', '#f6a070', '#cc7a84', '#9c6a98', '#74609a');     // gold-lit bellies, near the sun
const CLOUD_HIGH = P('#ffd9c0', '#f4a89c', '#d0809a', '#a06c9e', '#7a609e', '#5c5496');    // rose-lit, higher up
const MIST = I('#c48e9c');
const ROCK = P('#352242', '#48294c', '#5e3352', '#763f58', '#90505e', '#aa6462', '#c47e66', '#dc9a70', '#f0b880');
const FOL = P('#243c44', '#35543e', '#4f7440', '#86a04a', '#cfc864');                       // jungle: deep .. sunlit
const STEEL = P('#ffc890', '#ec8a58', '#c45c3c', '#9c3e30', '#74292c', '#4c1c28');          // rust-red steel: rim .. deep
const STEEL_OUT = I('#2c1420');
const STONE = P('#fbd6a0', '#e2b088', '#c09078', '#9c7470', '#785a68', '#58425a');          // sunset-lit stone
const WOOD = P('#ffdca0', '#e6b070', '#c08a50', '#9a6638', '#70462a', '#4a2c20');           // deck timber
const PINE = P('#ffe4b0', '#e8be82', '#c89860', '#a07244', '#72502e', '#48321f');           // pale crate boards
const OLIVE = P('#d0d088', '#a8ae64', '#808a4a', '#5e6838', '#424a2a', '#2c321e');          // painted army crates
const DARKW = P('#d0a070', '#a67a4c', '#805a38', '#5e402c', '#422c20', '#2c1c18');          // dark crates
const IRON = I('#2a2030');

const A = {};       // everything the bake steps make

// ============================================================
// Sky: dithered sunset bands bowing round the sun, thin stratus streaks, the first stars
// ============================================================
function streak(b, cx, cy, len, th, seed, top, body, lit) {
  for (let x = -len / 2; x <= len / 2; x++) {
    const u = x / (len / 2), prof = Math.pow(Math.max(0, 1 - u * u), 0.7) * (0.4 + 0.95 * fbm((cx + x) / 14, seed, 3, 2));
    const t = Math.round(th * prof);
    if (t <= 0) continue;
    const y0 = Math.round(cy + (fbm((cx + x) / 40, seed, 5, 2) - 0.5) * 4 - t / 2);
    for (let k = 0; k < t; k++) put(b, cx + x, y0 + k, k === t - 1 ? lit : k === 0 && t > 2 ? top : body);
  }
}
const STARS = [[52, 46, 1], [18, 70, 0], [96, 40, 0], [246, 13, 0], [304, 37, 0], [150, 72, 0], [362, 62, 0], [6, 38, 0]];
// painted in two runs of rows (two bake steps), then the stars and streaks
function skyRows(b, ya, yb) {
  const d = b.d, w = b.w;
  for (let y = ya; y < yb; y++) {
    const ty = Math.pow(clamp((y + 16) / 190, 0, 1), 1.15), dy = (y - SUN.y) * 1.3, row = (y + 10) * w + 10;
    for (let x = -10; x < W + 10; x++) {
      const dx = (x - SUN.x) * 0.75;
      d[row + x] = ramp(SKYC, ty + 0.26 * Math.exp(-(dx * dx + dy * dy) / 12100) + (fbm(x / 120, y / 10, 3, 2) - 0.5) * 0.045, x, y, 0.22);
    }
  }
}
function skyFinish(b) {
  for (const [x, y, big] of STARS) put(b, x, y, big ? I('#fff8e0') : I('#c8c0e8'));
  const top = I('#9a6e9c'), body = I('#d4849a'), lit = I('#ffd898');
  streak(b, 150, 122, 170, 4, 1, top, body, lit); streak(b, 296, 108, 130, 3, 2, top, body, lit);
  streak(b, 452, 118, 100, 3, 3, top, I('#e8947e'), I('#ffe6a8')); streak(b, 40, 138, 120, 3, 4, top, body, lit);
  streak(b, 250, 132, 90, 2, 5, top, I('#e8947e'), I('#ffe6a8')); streak(b, 330, 92, 80, 2, 6, I('#8a66a0'), I('#b87a9e'), I('#f0a890'));
  return bake(b);
}
// The low sun: a soft glow (alpha, like Mission 2's) and a crisp disc crossed by two thin clouds
function sunSprite() {
  const R = 72, c = canvasOf(R * 2, R * 2), g = c.getContext('2d');
  const gr = g.createRadialGradient(R, R, 5, R, R, R);
  gr.addColorStop(0, 'rgba(255,246,206,0.9)'); gr.addColorStop(0.22, 'rgba(255,226,150,0.5)'); gr.addColorStop(0.6, 'rgba(255,196,120,0.16)'); gr.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, R * 2, R * 2);
  const b = buf(0, 0, R * 2, R * 2);
  disc(b, R, R, 14, I('#ffd884')); disc(b, R, R, 13, I('#ffeeb0')); disc(b, R - 1, R - 1, 11, I('#fffbe4'));
  for (let y = R + 6; y <= R + 14; y++) for (let x = R - 14; x <= R + 14; x++) if (get(b, x, y) !== NONE && (y > R + 9 || bay(x, y) > 0.5)) put(b, x, y, y > R + 11 ? I('#ffc870') : I('#ffe096'));
  for (let x = -22; x <= 12; x++) { put(b, R + x, R + 3, I('#f09a7c')); if (x > -16 && x < 6) put(b, R + x, R + 4, I('#ffd898')); }
  for (let x = -9; x <= 24; x++) { put(b, R + x, R + 9, I('#e08a82')); put(b, R + x, R + 10, I('#f6a878')); }
  g.drawImage(bake(b), 0, 0);
  return c;
}
// Soft rays fanning up from the sun (two sets, crossfaded so they shimmer), like Mission 2's
function raySprite(s) {
  const w = 520, h = 300, c = canvasOf(w, h), g = c.getContext('2d'), ox = w / 2, oy = h - 60;
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI * (0.04 + 0.92 * (i + hsh(i * 3 + s) * 0.7) / 11), len = 150 + hsh(i * 7 + s) * 110, wd = 0.02 + hsh(i * 5 + s) * 0.035;
    const gr = g.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
    gr.addColorStop(0, 'rgba(255,232,170,0.3)'); gr.addColorStop(1, 'rgba(255,226,170,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(ox, oy);
    g.lineTo(ox + Math.cos(a - wd) * len, oy + Math.sin(a - wd) * len); g.lineTo(ox + Math.cos(a + wd) * len, oy + Math.sin(a + wd) * len);
    g.closePath(); g.fill();
  }
  return c;
}
// A sunset cloud: puffs on a flat base, dusky on top, its belly and the edges facing the sun glowing
function cloudBuf(w, seed, pal) {
  const h = Math.round(w * 0.26) + 8, b = buf(-6, 0, w + 12, h + 2), base = h - 2, r = rng(seed * 977 + 5), puffs = [];
  const n = 4 + Math.floor(w / 15), m = 1 + Math.floor(w / 38);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, rad = w * (0.04 + 0.075 * Math.sin(t * Math.PI)) * (0.75 + 0.5 * r()); puffs.push([t * w, base - rad * 0.5, rad]); }
  for (let i = 0; i < m; i++) { const t = 0.28 + 0.44 * (m === 1 ? 0.5 : i / (m - 1)) + (r() - 0.5) * 0.12, rad = w * (0.085 + 0.04 * r()); puffs.push([t * w, base - rad * 0.45 - w * 0.065, rad]); }
  const MARK = 1;
  for (const [x, y, rad] of puffs) for (let j = -Math.ceil(rad); j <= rad; j++) {
    const Y = Math.round(y + j);
    if (Y > base) continue;
    const hw = Math.floor(Math.sqrt(Math.max(0, (rad + 0.5) ** 2 - j * j)));
    for (let X = Math.round(x) - hw; X <= Math.round(x) + hw; X++) put(b, X, Y, MARK);
  }
  for (let X = -6; X < w + 6; X++) if (get(b, X, base) === MARK && nz(X, seed) > 0.45) put(b, X, base + 1, MARK);   // a ragged underside
  const inside = (x, y) => get(b, x, y) !== NONE, out = new Int32Array(b.d.length).fill(NONE);
  for (let Y = 0; Y < b.h; Y++) for (let X = -6; X < w + 6; X++) {
    if (!inside(X, Y)) continue;
    let t0 = Y, t1 = Y;
    while (inside(X, t0 - 1)) t0--;
    while (inside(X, t1 + 1)) t1++;
    const v = (Y - t0) / Math.max(1, t1 - t0);
    let k = 0, u = 0;
    while (k < 7 && inside(X + Math.round(0.7 * (k + 1)), Y + k + 1)) k++;    // how deep inside, seen from the sun (below right)
    while (u < 4 && inside(X, Y - u - 1)) u++;
    let c;
    if (k === 0) c = pal[0];
    else if (k <= 2) c = pal[1];
    else if (k <= 4 && v > 0.3) c = pal[2];
    else if (u <= 1) c = pal[5];
    else c = ramp([pal[5], pal[4], pal[3], pal[2]], v * 0.95, X, Y, 0.25);
    out[(Y - b.y0) * b.w + (X - b.x0)] = c;
  }
  b.d.set(out);
  return b;
}
// hard-edged alpha-free blobs for the mist (drawn with globalAlpha): a low bank of five puffs, and single discs
function blobSprite(discs, col) {
  let x1 = 0, y1 = 0;
  for (const [x, y, r] of discs) { x1 = Math.max(x1, x + r + 2); y1 = Math.max(y1, y + r + 2); }
  const b = buf(0, 0, x1, y1);
  for (const [x, y, r] of discs) disc(b, x, y, r, col);
  return bake(b);
}

// ============================================================
// Far scenery: two purple ranges, then hazy mesas at the far end of the gorge
// ============================================================
function ridge(seed, base, h0, h1, sp, wm) {
  return s => {
    const k0 = Math.floor(s / sp);
    let v = 0;
    for (let k = k0 - 2; k <= k0 + 2; k++) {
      const c = (k + 0.5) * sp + (nz(k, seed) - 0.5) * sp * 0.8, h = lerp(h0, h1, nz(k, seed + 1)), w = sp * wm * (0.7 + 0.6 * nz(k, seed + 2));
      v = Math.max(v, h * Math.pow(Math.max(0, 1 - Math.abs(s - c) / w), 1.2));
    }
    return base - v - (fbm(s / 9, 0, seed + 3, 2) - 0.5) * 6;
  };
}
// pal: [ridge light, lit slope, slope, shaded slope]; hazed toward `haze` between rows hz0 and hz1
function mountains(p, top, f, pal, haze, hz0, hz1, hk, seed) {
  const w = stripW(p), b = buf(0, top, w, 214 - top), d = b.d, ys = new Float32Array(w + 8);
  for (let s = -4; s < w + 4; s++) ys[s + 4] = f(s);
  const hz = [];
  for (let y = top; y < 214; y++) hz.push(hk * ss(hz0, hz1, y));
  for (let s = 0; s < w; s++) {
    const y0 = Math.round(ys[s + 4]), lit = ys[s + 6] > ys[s + 2] + 0.5;
    for (let y = Math.max(top, y0); y < 214; y++) {
      const dd = y - y0, u = (s + dd * 0.9) / 12, v = dd / 34;
      const gr = fbm(u, v, seed, 3) - fbm(u + 0.3, v, seed, 3);
      let c = gr > 0.02 ? pal[1] : gr < -0.025 ? pal[3] : pal[2];
      if (dd < 2) c = lit ? pal[0] : pal[2];
      d[(y - top) * w + s] = mixI(c, haze, hz[y - top]);
    }
  }
  return { img: bake(b), p, top, h: b.h };
}
const PF = 0.10;
function farCliffs() {
  const w = stripW(PF), top = 150, b = buf(0, top, w, 214 - top);
  const CF = P('#f4bc98', '#d2928c', '#aa768e', '#8c648e'), haze = I('#ffdcaa');
  const topF = s => {
    const m = fbm(s / 70, 0, 61, 2), gap = Math.exp(-(((s - 505) / 70) ** 2));     // lower where the river runs out of sight
    let h = 10 * ss(0.36, 0.42, m) + 16 * ss(0.48, 0.52, m) + 12 * ss(0.6, 0.63, m);
    h *= 1 - 0.9 * gap;
    return 200 - Math.round(h) - (h > 3 ? Math.round(fbm(s / 4, 0, 63, 2) * 3) : 0);
  };
  const ys = new Int16Array(w + 8);
  for (let s = -4; s < w + 4; s++) ys[s + 4] = topF(s);
  for (let s = 0; s < w; s++) {
    const y0 = ys[s + 4];
    if (y0 >= 199) continue;
    const dr = ys[s + 6] - y0, dl = ys[s + 2] - y0;
    for (let y = y0; y < 204; y++) {
      let c = dr > 3 ? CF[1] : dl > 3 ? CF[3] : CF[2];
      if ((y + Math.floor(s * 0.06)) % 5 === 0 && nz(s >> 2, y) > 0.4) c = CF[3];
      if (y === y0) c = CF[0];
      put(b, s, y, mixI(c, haze, 0.18 + 0.7 * ss(170, 200, y)));
    }
    if (nz(s, 67) > 0.62) { put(b, s, y0 - 1, mixI(FOL[1], haze, 0.35)); if (nz(s, 68) > 0.5) put(b, s, y0 - 2, mixI(FOL[2], haze, 0.35)); }
  }
  return { img: bake(b), p: PF, top, h: b.h };
}

// ============================================================
// The river: a tile of rows from the far bend (row RY0) to the bottom of the screen, baked two periods wide so a
// band is one blit. Bands of four rows scroll with their own parallax (far 0.1 .. 1 at the piers' feet .. faster in
// front), which makes the plane lie flat. Above the deck it is dusky (gold only at the far bend); under the bridge
// it lies in shadow. Rows down to the deck are drawn by bg, the rows under the deck by ground.
// ============================================================
const RY0 = 196, RW = 512, BAND = 4;
const rowP = y => 0.10 + 0.9 * Math.pow((y - RY0) / 66, 1.5);
const RIV_UP = P('#ffd9a0', '#f2b690', '#d69a92', '#b88296', '#9c7098', '#85649a', '#73599a');
const RIV_DN = P('#9a74a0', '#74609c', '#564f92', '#434688', '#373e7e', '#2e3672', '#283068');
function riverBuf() {
  const b = buf(0, RY0, RW * 2, H - RY0);
  for (let y = RY0; y < H; y++) for (let x = 0; x < RW; x++)
    put(b, x, y, y < 236 ? ramp(RIV_UP, Math.pow((y - RY0) / 40, 0.7), x, y, 0.2) : ramp(RIV_DN, (y - 238) / 30, x, y, 0.2));
  for (let y = RY0 + 1; y < H; y++) {
    const dd = y - RY0, up = y < 236, n = Math.round(RW / (up ? 30 : 22));
    for (let i = 0; i < n; i++) {
      const x = Math.floor(nz(i, y * 3 + 1) * RW), len = 2 + Math.round(dd * 0.14 * (0.4 + nz(i, y * 3 + 2))), light = nz(i, y * 3 + 3) > 0.5;
      const base = RIV_UP[Math.min(6, Math.round(Math.pow(dd / 40, 0.7) * 6))];
      const c = up ? (light ? mixI(base, I('#ffe8c0'), 0.5) : mixI(base, I('#5a4688'), 0.4)) : (light ? I('#8f88c8') : I('#1e2658'));
      for (let k = 0; k < len; k++) put(b, wrap(x + k, RW), y, c);
    }
  }
  for (let y = 0; y < b.h; y++) b.d.copyWithin(y * b.w + RW, y * b.w, y * b.w + RW);     // the second period
  return b;
}
// the sun's glitter path: dashes thinning out away from its centre line (two phases, alternated). It is thinned
// and never white in the rows the fight happens in front of.
function glitterBuf(ph) {
  const b = buf(-62, RY0, 124, H - RY0);
  for (let y = RY0 + 1; y < H; y++) {
    const dd = y - RY0, hw = 2 + dd * 0.46, under = y > 247, band = y > 206 && y < 236;
    for (let x = -Math.ceil(hw); x <= hw; x++) {
      const u = Math.abs(x) / hw, run = nz((x + 200) >> (dd > 22 ? 2 : 1), y * 5 + ph * 31);
      if (run < Math.pow(1 - u, 1.5) * (under ? 0.24 : band ? 0.34 : 0.56)) put(b, x, y, !band && nz(x, y + ph * 7) > 0.35 ? I('#fff8dc') : I('#ffe2a0'));
    }
  }
  return mk(b);
}
// a rock in the river with a foam line at its foot (far ones hazy and lit, near ones dark in the bridge's shadow)
function rockBuf(w, h, seed, near) {
  const b = buf(-2, -h - 1, w + 4, h + 3), pal = near ? P('#d08a70', '#5e3c62', '#443058', '#30264c') : P('#f6c090', '#8e5668', '#6e4466', '#553860');
  for (let x = 0; x < w; x++) {
    const u = (x - (w - 1) / 2) / (w / 2), hh = Math.max(1, Math.round(h * Math.sqrt(Math.max(0, 1 - u * u)) * (0.65 + 0.5 * nz(x >> 1, seed))));
    for (let k = 0; k < hh; k++) put(b, x, -1 - k, k === hh - 1 ? pal[0] : u > 0.35 ? pal[1] : u < -0.3 ? pal[3] : pal[2]);
    if (u > 0.55) put(b, x, -hh, pal[0]);
  }
  for (let x = -2; x < w + 2; x++) if (nz(x, seed + 9) > 0.3) put(b, x, 0, near ? I('#b8b4e0') : I('#fffaf0'));
  return mk(b);
}
// Rocks along the whole crossing: each scrolls with the parallax of the row its foot stands on. Few in the rows
// behind the fight. x = screen x at the first camera.
function makeRocks() {
  const list = [];
  const add = (n, y0, y1, w0, w1, h0, h1, seed, near) => {
    for (let k = 0; k < n; k++) {
      const y = Math.round(lerp(y0, y1, nz(k, seed))), p = rowP(y), len = W + 80 + (CAM1 - CAM0) * p;
      const w = Math.round(lerp(w0, w1, nz(k, seed + 1))), h = Math.round(lerp(h0, h1, nz(k, seed + 2)));
      list.push({ x: (k + 0.15 + 0.7 * nz(k, seed + 3)) / n * len - 40, y, p, w, near, s: rockBuf(w, h, seed + 10 + k * 3, near) });
    }
  };
  add(7, 203, 212, 8, 14, 3, 6, 601, false);
  add(4, 216, 226, 11, 18, 4, 7, 621, false);
  add(11, 253, 267, 14, 26, 5, 9, 641, true);
  return list;
}

// ============================================================
// The gorge walls (parallax 0.18), in strip coordinates 0..~800: the west wall (a butte, the notch with the
// two-tier waterfall, a buttress, steps down to the water), the open gorge (354-541), a rock tower with a robot
// lookout, a low ridge the sun sets behind (624-690), and the east wall with a slim second fall. The sun (nearly
// fixed on screen) sweeps strip x 439..708 over the crossing: it stands in the open gorge at first, passes behind
// the tower in mid-bridge, comes out over the low ridge and is gone behind the east wall at the very end. Strata, ledges and cracks lit from the right,
// jungle and palms on top, vines, mist at the river. The water of the falls is drawn live from baked frames.
// ============================================================
const PC = 0.18;
const FALL = { s: 196, w: 12, y0: 110, mid: 156, base: 211 };       // upper tier 12 wide, lower tier 16 wide
const FALL2 = { s: 724, w: 6, y0: 103, base: 211 };                 // the slim fall on the east wall
const LOOK = 592;                                                   // the robots' lookout on the rock tower
const CL_PTS = [[-18, 106], [42, 98], [52, 96], [62, 82], [84, 78], [98, 85], [110, 97], [122, 96], [178, 100], [192, 101], [212, 114], [230, 118], [262, 120], [275, 142],
  [290, 147], [312, 150], [323, 176], [336, 183], [345, 200], [353, 216], [354, 999], [542, 999], [543, 216], [550, 198], [558, 172], [565, 165], [571, 140], [579, 120],
  [589, 113], [602, 117], [611, 140], [624, 152], [640, 157], [660, 151], [676, 158], [690, 150], [700, 124], [712, 106], [730, 101], [770, 97], [830, 99]];
function cliffTop(s) {
  let i = 0;
  while (i + 2 < CL_PTS.length && CL_PTS[i + 1][0] <= s) i++;
  const [xa, ya] = CL_PTS[i], [xb, yb] = CL_PTS[i + 1];
  if (ya > 900 || yb > 900) return 999;
  let y = lerp(ya, yb, ss(0.2, 0.8, clamp((s - xa) / (xb - xa), 0, 1)));
  y += (fbm(s / 7, 0, 31, 2) - 0.5) * 5 + Math.floor(fbm(s / 13, 0, 33, 2) * 3) * 2 - 2;
  if (s >= FALL.s && s < FALL.s + FALL.w) y = FALL.y0 + 1;
  if (s >= FALL2.s && s < FALL2.s + FALL2.w) y = FALL2.y0 + 1;
  if (Math.abs(s - LOOK) <= 8) y = 112;                             // levelled for the lookout
  return Math.round(y);
}
const cliffBase = s => 210 + Math.round(fbm(s / 9, 0, 53, 2) * 4);
// a clump of leaves: lit toward the sun (upper right), leaf texture, a ragged rim
function clump(b, x, y, r, seed) {
  x = Math.round(x); y = Math.round(y);
  const n = Math.ceil(r), R2 = (r + 0.5) * (r + 0.5);
  for (let k = 0; k < r * 2.5; k++) { const a = nz(seed, k) * 6.283; put(b, x + Math.cos(a) * (r + 1), y + Math.sin(a) * (r + 0.8), Math.sin(a) < -0.3 ? FOL[2] : FOL[0]); }
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    if (i * i + j * j > R2) continue;
    const l = (i * 0.62 - j * 0.78) / (r + 0.5) + (nz(x + i, y + j + seed) - 0.5) * 0.55;
    put(b, x + i, y + j, l > 0.78 ? FOL[4] : l > 0.46 ? FOL[3] : l > 0.08 ? FOL[2] : l > -0.38 ? FOL[1] : FOL[0]);
  }
}
function palm(b, x, base, h, lean) {
  let tx = x, ty = base;
  for (let k = 0; k <= h; k++) { tx = x + lean * (k / h) * (k / h) * h * 0.3; ty = base - k; put(b, tx, ty, I('#4a3040')); put(b, tx + 1, ty, I('#a06a50')); }
  for (const [a, len] of [[-2.9, 9], [-2.4, 10], [-1.9, 8], [-1.2, 8], [-0.7, 10], [-0.2, 9], [0.25, 7], [-3.4, 7]]) for (let t = 0; t <= len; t++) {
    const u = t / len, fx = tx + Math.cos(a) * t, fy = ty + Math.sin(a) * t + u * u * len * 0.55;
    put(b, fx, fy, FOL[1]);
    if (t > 1 && Math.cos(a) > -0.5) put(b, fx, fy - 1, Math.cos(a) > 0.3 ? FOL[4] : FOL[3]); else if (t > 1) put(b, fx, fy - 1, FOL[2]);
  }
  put(b, tx, ty + 1, I('#3a2430')); put(b, tx + 1, ty + 2, I('#3a2430'));
}
// the robots' lookout: a little steel tower with a hazard-striped cabin and an aerial (its lamp blinks live)
function lookout(b, x, base) {
  const SD = I('#3c3a54'), SM = I('#5c5a78'), SL = I('#9a96b4'), RIM = I('#f0b890');
  for (let y = base - 16; y <= base; y++) { put(b, x - 5, y, SD); put(b, x + 5, y, SM); put(b, x + 6, y, RIM); }
  line(b, x - 5, base, x + 5, base - 8, SD); line(b, x + 5, base, x - 5, base - 8, SD); line(b, x - 5, base - 8, x + 5, base - 16, SD); line(b, x + 5, base - 8, x - 5, base - 16, SD);
  rect(b, x - 8, base - 18, 17, 2, SM); rect(b, x - 8, base - 18, 17, 1, SL);
  rect(b, x - 7, base - 26, 15, 8, SM); rect(b, x - 7, base - 26, 15, 1, SL); rect(b, x + 6, base - 25, 2, 7, RIM); rect(b, x - 7, base - 25, 1, 7, SD);
  rect(b, x - 4, base - 24, 8, 3, I('#20202e')); put(b, x - 3, base - 23, I('#ffd870')); put(b, x + 1, base - 23, I('#ffd870'));
  for (let i = 0; i < 15; i++) put(b, x - 7 + i, base - 19, (i >> 1) % 2 ? I('#f1c40f') : I('#20202e'));
  rect(b, x - 9, base - 27, 19, 1, SD);
  for (let y = base - 36; y < base - 27; y++) put(b, x + 3, y, SD);
}
// The wall is painted in column runs (three bake steps), then dressed and baked.
function cliffBegin() {
  const w = stripW(PC), top = 60, b = buf(0, top, w, 226 - top), tops = new Int16Array(w + 8), bases = new Int16Array(w + 8);
  for (let s = -4; s < w + 4; s++) { tops[s + 4] = cliffTop(s); bases[s + 4] = cliffBase(s); }
  A.cw = { w, top, b, tops, bases, ledge: [] };
}
function cliffRock(s0, s1) {
  const { w, b, tops, bases, ledge } = A.cw, d = b.d, bw = b.w, top = b.y0;
  const T = s => tops[clamp(s, -4, w + 3) + 4];
  const D = (x, y) => fbm(x / 30, y / 80, 41, 3) + 0.45 * fbm(x / 8, y / 26, 43, 2);
  for (let s = s0; s < Math.min(s1, w); s++) {
    const t0 = T(s), base = bases[s + 4];
    if (t0 >= base) continue;
    const slope = T(s + 3) - T(s - 3), wob = 6 * fbm(s / 60, 0, 47, 2) + s * 0.03, crack = nz(s, 91) > 0.9, edge = T(s + 1);
    const df = Math.min(Math.abs(s - (FALL.s + FALL.w / 2)), Math.abs(s - (FALL2.s + FALL2.w / 2)) * 1.6);
    for (let y = t0; y <= base; y++) {
      const dd = y - t0, fm = wrap(y + wob, 5), j = Math.floor((y + wob) / 5);
      let t = 0.4 + (D(s - 1.5, y) - D(s + 1.5, y)) * 4.6 + (nz(j, 7) - 0.5) * 0.2;
      if (fm < 1 && nz(j, 9) > 0.3 && nz(s >> 3, j + 40) > 0.2) t -= 0.14;
      if (nz(j, 11) > 0.58 && nz((s + j * 13) >> 4, j + 60) > 0.34) {                   // a ledge (a broken run): lit lip, shadow under it
        if (fm < 1) { t += 0.36; if (dd > 6 && nz(s, j + 70) > 0.955) ledge.push([s, y]); } else if (fm < 3) t -= 0.32;
      }
      if (dd < 2) t += 0.25;
      if (dd < 34) { if (slope > 4) t += 0.2 * (1 - dd / 34); else if (slope < -4) t -= 0.16 * (1 - dd / 34); }
      if (crack && fbm(s * 0.37, y / 18, 51, 2) > 0.5) t -= 0.22;
      let c = ramp(ROCK, t, s, y, 0.12);
      if (edge > y) c = I('#ffd49a');                                                  // the edge that faces the sun
      if (df < 16 && dd > 0) c = mixI(c, I('#3a2a52'), (1 - df / 16) * 0.42);           // wet and dark round the falls
      d[(y - top) * bw + s] = c;
    }
  }
}
function cliffDress() {
  const { w, top, b, tops, bases, ledge } = A.cw;
  const T = s => tops[clamp(s, -4, w + 3) + 4];
  const atFall = (s, m) => (s >= FALL.s - m && s <= FALL.s + FALL.w + m) || (s >= FALL2.s - m && s <= FALL2.s + FALL2.w + m);
  // the shelf the first fall breaks on
  for (let s = FALL.s - 3; s < FALL.s + FALL.w + 3; s++) { put(b, s, FALL.mid + 1, ROCK[7]); put(b, s, FALL.mid + 2, ROCK[3]); put(b, s, FALL.mid + 3, ROCK[1]); }
  // vines hanging over the edge
  for (let s = 0; s < w; s++) {
    const t0 = T(s);
    if (t0 > 200 || nz(s, 57) < 0.78 || atFall(s, 1) || Math.abs(s - LOOK) < 9) continue;
    const len = 4 + Math.round(nz(s, 58) * 20);
    for (let k = 0; k < len; k++) put(b, s + Math.round(Math.sin(k / 3 + s) * 0.6), t0 + k, k % 3 === 0 ? FOL[3] : k % 3 === 1 ? FOL[2] : FOL[1]);
  }
  // bushes on the ledges and the jungle along the top (farther clumps first)
  const veg = [];
  for (let s = 2; s < w; s += 3) {
    const t0 = T(s);
    if (t0 > 196 || atFall(s, 2) || Math.abs(s - LOOK) < 11) continue;
    const flat = Math.abs(T(s + 3) - T(s - 3)) < 9;
    if (flat && nz(s, 71) < 0.8) veg.push([s + nz(s, 72) * 2, t0 - 1 - nz(s, 73) * 2, 2.6 + nz(s, 74) * 3.4]);
    if (flat && nz(s, 75) > 0.7) veg.push([s, t0 - 6 - nz(s, 76) * 5, 4 + nz(s, 77) * 3.5]);
  }
  for (const [x, y] of ledge) if (!atFall(x, 8)) veg.push([x, y - 1, 1.6 + nz(x, y) * 1.6]);
  veg.sort((a, c) => a[1] - c[1]);
  for (const s of [16, 44, 76, 96, 142, 168, 240, 258, 284, 306, 572, 612, 636, 664, 684, 744, 778]) { const t0 = T(s); if (s > 4 && s < w - 4 && t0 < 200) palm(b, s, t0, 11 + Math.round(nz(s, 81) * 6), nz(s, 82) > 0.5 ? 1 : -1); }
  veg.forEach(([x, y, r], i) => clump(b, x, y, r, 900 + i * 7));
  lookout(b, LOOK, T(LOOK));
  // haze: everything sinks into the mist over the river
  const d = b.d;
  for (let y = 0; y < b.h; y++) { const k = 0.2 + 0.26 * ss(160, 212, y + top); for (let i = y * b.w, e = i + b.w; i < e; i++) if (d[i] !== NONE) d[i] = mixI(d[i], MIST, k); }
  // the foot of the wall: a foam line and a dithered reflection on the water
  for (let s = 0; s < w; s++) {
    const t0 = T(s), base = bases[s + 4];
    if (t0 >= base) continue;
    if (nz(s >> 1, 95) > 0.6) put(b, s, base + 1, I('#f8e4d8'));
    if (nz(s >> 1, 96) > 0.82) put(b, s, base + 3, I('#e8c8c8'));
    for (let k = 2; k < 10; k++) if (bay(s, base + k) > 0.3 + k * 0.07) put(b, s + Math.round(Math.sin((base + k) * 1.3) * 1.2), base + k, mixI(I('#5c3c66'), I('#8a6a96'), k / 10));
  }
  A.cliff = { img: bake(b), p: PC, top, h: b.h };
  A.lookY = T(LOOK) - 37;
  A.wallTop = tops;
  A.cw = null;
}
// Falls: streaks in every column, each column falling at its own speed. Baked as FALL_N frames that loop (each
// column moves a multiple of 32 / FALL_N... rows per frame, the streak pattern repeats every 32 rows).
const FALL_N = 8, FALL_HOLD = 3;
function fallPx(i, y) {
  const s0 = wrap(y + Math.floor(nz(i, 9) * 32), 32), s = s0 < 18 ? s0 * 16 / 18 : (s0 - 18) * 16 / 14, e = nz(i, 13), sh = i % 16 < 4 ? 1 : 0;   // shaded left columns
  return s < 3 - sh * 2 ? I('#ffffff') : s < 8 - sh * 3 ? (e > 0.5 ? I('#fff0e2') : I('#f4dcdc')) : s < 12 - sh * 2 ? I('#d6c4e6') : I('#a89cd8');
}
function fallFrames(F) {
  const frames = [], two = F.mid != null, x0 = two ? -3 : -1, w = two ? 20 : F.w + 2;
  for (let k = 0; k < FALL_N; k++) {
    const b = buf(x0, F.y0 - 1, w, F.base - F.y0 + 2);
    const col = (x, ci, ya, yb) => { const dv = 4 * (1 + Math.floor(nz(ci, 17) * 3)); for (let y = ya; y < yb; y++) put(b, x, y, fallPx(ci, y - k * dv)); };
    if (two) {
      for (let i = 0; i < F.w; i++) col(i, i, F.y0, F.mid + 1);
      for (let i = 0; i < 16; i++) col(i - 2, 40 + i, F.mid + 2, F.base);
      for (let y = F.y0 + 6; y < F.mid + 1; y++) put(b, 0, y, I('#a69cd4'));
      for (let y = F.mid + 8; y < F.base; y++) put(b, -2, y, I('#a69cd4'));
      for (let x = -2; x < F.w + 2; x++) { put(b, x, F.mid, I('#ffffff')); put(b, x - 1, F.mid + 1, I('#ffffff')); }      // the white water on the shelf
    } else {
      for (let i = 0; i < F.w; i++) col(i, 80 + i, F.y0, F.base);
      for (let y = F.y0 + 5; y < F.base; y++) put(b, 0, y, I('#a69cd4'));
    }
    for (let x = 0; x < F.w; x++) put(b, x, F.y0 - 1, (x + k) % 3 ? I('#fff6ea') : I('#c8bce0'));                         // the lip rolling over
    frames.push(mk(b));
  }
  return frames;
}

// ============================================================
// The bridge (world space). One span is baked once and drawn for each of the five.
// ============================================================
const PANEL = 16;                                              // the arch is a polygon: straight members between panel points
const seg = f => x => { const a = Math.floor(x / PANEL) * PANEL; return lerp(f(a), f(a + PANEL), (x - a) / PANEL); };
const yLow = seg(x => 224 - 296 * (x / SPAN) * (1 - x / SPAN));   // lower chord (local x 0..SPAN): crown at y 150
const yUp = seg(x => 207 - 260 * (x / SPAN) * (1 - x / SPAN));    // upper chord: crown at y 142
const CALM = 196;                                                 // below this row the fight happens: keep it quiet
const RAIL = P('#dcc0a4', '#a8866e', '#7a5c58');
function spanBuf() {
  const b = buf(-2, 134, SPAN + 4, 100);
  // the two chords: lit on top, a row of rivets, shaded underneath; gusset plates at the panel points
  for (let x = 11; x <= SPAN - 11; x++) for (const f of [yUp, yLow]) {
    const y = Math.round(f(x));
    put(b, x, y, STEEL[1]); put(b, x, y + 1, x % 4 === 0 ? STEEL[0] : STEEL[3]); put(b, x, y + 2, STEEL[4]);
  }
  for (let k = 1; k < 16; k++) for (const f of [yUp, yLow]) {
    const x = k * 16, y = Math.round(f(x));
    if (k % 2) { rect(b, x - 1, y - 1, 3, 5, STEEL[3]); rect(b, x - 1, y - 1, 3, 1, STEEL[1]); put(b, x, y + 1, STEEL[0]); put(b, x, y + 3, STEEL[5]); continue; }
    rect(b, x - 2, y - 1, 5, 5, STEEL[3]); rect(b, x - 2, y - 1, 5, 1, STEEL[1]); rect(b, x - 2, y + 3, 5, 1, STEEL[5]); rect(b, x + 2, y, 1, 3, STEEL[2]);
    put(b, x - 1, y + 1, STEEL[0]); put(b, x + 1, y + 1, STEEL[0]); put(b, x, y + 2, STEEL[5]);
  }
  // the crown lantern on its chain
  rect(b, SPAN / 2, 154, 1, 3, IRON); rect(b, SPAN / 2 - 2, 157, 5, 7, IRON); rect(b, SPAN / 2 - 1, 158, 3, 5, I('#ffd870')); put(b, SPAN / 2 - 1, 158, I('#fff8dc')); rect(b, SPAN / 2 - 3, 157, 7, 1, IRON);
  outline(b, STEEL_OUT);
  // the lattice between the chords: thin, behind the chords, no outline
  for (let k = 1; k < 16; k++) { const x = k * 16; for (let y = Math.round(yUp(x)) + 3; y < Math.round(yLow(x)); y++) putN(b, x, y, STEEL[4]); }
  for (let k = 0; k < 16; k++) {
    const xa = Math.max(11, k * 16), xb = Math.min(SPAN - 11, k * 16 + 16);
    if (k % 2 === 0) line(b, xa, yUp(xa) + 3, xb, yLow(xb) - 1, STEEL[3], 1, true); else line(b, xa, yLow(xa) - 1, xb, yUp(xb) + 3, STEEL[3], 1, true);
  }
  // the hangers down to the railing: rods above the fight, a thin muted wire through it
  const wire = mixI(STEEL[4], I('#8a6a96'), 0.4);
  for (let k = 1; k < 8; k++) {
    const x = k * 32, y0 = Math.round(yLow(x)) + 3;
    for (let y = y0; y < 220; y++) { if (y < CALM - 3) { putN(b, x, y, STEEL[4]); putN(b, x + 1, y, STEEL[2]); } else putN(b, x, y, wire); }
    if (y0 < CALM - 8) { rect(b, x - 1, CALM - 4, 4, 3, STEEL[3]); rect(b, x - 1, CALM - 4, 4, 1, STEEL[1]); put(b, x + 2, CALM - 3, STEEL[0]); }
  }
  // the far railing: posts under the hangers, two sagging ropes, in muted colours
  const posts = [];
  for (let k = 1; k < 8; k++) posts.push(k * 32);
  const ends = [10, ...posts, SPAN - 10];
  for (let i = 0; i + 1 < ends.length; i++) {
    const a = ends[i] + 2, n = ends[i + 1] - 1 - a;
    for (let k = 0; k <= n; k++) {
      const u = k / n, s1 = Math.round(4 * u * (1 - u) * 3), s2 = Math.round(4 * u * (1 - u) * 2);
      put(b, a + k, 222 + s1, I('#d6b8a0')); put(b, a + k, 223 + s1, (a + k) % 3 ? I('#96766e') : I('#7c5e62')); put(b, a + k, 227 + s2, I('#b4948c'));
    }
  }
  for (const x of posts) {
    rect(b, x - 1, 220, 3, 12, RAIL[1]); rect(b, x + 1, 220, 1, 12, RAIL[0]); rect(b, x - 1, 220, 1, 12, RAIL[2]);
    rect(b, x - 2, 218, 5, 2, RAIL[1]); rect(b, x - 2, 218, 5, 1, RAIL[0]); put(b, x - 2, 219, RAIL[2]);
  }
  return mk(b);
}
// A stone pylon at each spring: courses of blocks, a cornice, a lantern on top, steel shoes for the arches,
// and the robot army's hazard banner (no red on it: red means robot eyes and lasers)
function pylonBuf() {
  const b = buf(-17, 150, 34, 84);
  for (let y = 182; y < 232; y++) for (let x = -10; x <= 9; x++) {
    const cy = y - 182, course = Math.floor(cy / 6), joint = cy % 6 === 5 || (wrap(x + 10 + (course & 1) * 5, 10) === 0);
    let k = x >= 8 ? 0 : x >= 6 ? 1 : x <= -9 ? 4 : 2 + (nz(x, y) > 0.82 ? 1 : 0) - (nz(x >> 1, (y >> 1) + 77) > 0.86 ? 1 : 0);
    if (joint) k = Math.min(5, k + 2);
    put(b, x, y, STONE[k]);
  }
  rect(b, -12, 225, 24, 7, STONE[2]); rect(b, -12, 225, 24, 1, STONE[0]); rect(b, 10, 226, 2, 6, STONE[0]); rect(b, -12, 226, 2, 6, STONE[4]); rect(b, -10, 228, 20, 1, STONE[3]);
  rect(b, -12, 178, 24, 1, STONE[0]); rect(b, -12, 179, 24, 1, STONE[1]); rect(b, -12, 180, 24, 1, STONE[2]); rect(b, -11, 181, 22, 1, STONE[4]);
  rect(b, -8, 172, 16, 6, STONE[2]); rect(b, -8, 172, 16, 1, STONE[0]); rect(b, 6, 173, 2, 5, STONE[0]); rect(b, -8, 173, 2, 5, STONE[4]);
  for (let k = 0; k < 3; k++) { rect(b, -6 + k * 2, 171 - k, 12 - k * 4, 1, k === 2 ? STONE[0] : STONE[1]); put(b, -6 + k * 2, 171 - k, STONE[3]); }
  // the lantern
  rect(b, -1, 163, 2, 6, IRON); rect(b, -3, 156, 6, 7, IRON); rect(b, -2, 157, 4, 5, I('#ffd870')); put(b, -1, 158, I('#fff8dc')); put(b, 0, 158, I('#fff8dc')); rect(b, -4, 155, 8, 1, IRON); put(b, 0, 154, IRON); put(b, -1, 154, IRON);
  // steel shoes where the arches land
  for (const sx of [-14, 10]) {
    rect(b, sx, 202, 4, 24, STEEL[3]); rect(b, sx, 202, 4, 1, STEEL[1]); rect(b, sx + 3, 203, 1, 23, sx > 0 ? STEEL[0] : STEEL[2]); rect(b, sx, 203, 1, 23, STEEL[4]);
    for (let y = 205; y < 225; y += 4) put(b, sx + 1, y, STEEL[0]);
  }
  // the banner: dark cloth, a yellow chevron
  rect(b, -4, 185, 8, 11, I('#2d2d3a')); rect(b, -4, 185, 8, 1, I('#56606e')); rect(b, 2, 186, 2, 10, I('#3c3c4c'));
  for (let i = 0; i < 3; i++) { put(b, -3 + i, 191 - i, I('#f1c40f')); put(b, 2 - i, 191 - i, I('#f1c40f')); put(b, -3 + i, 192 - i, I('#c99a0c')); put(b, 2 - i, 192 - i, I('#c99a0c')); }
  put(b, -1, 195, STONE[2]); put(b, 0, 195, STONE[2]); put(b, -1, 194, STONE[2]);
  outline(b);
  return mk(b);
}
// The deck (a tile as long as a span): plank ends with nails over a riveted girder, joist ends under it.
// Its top row is the walking line, GROUND.
const DECK_H = 19;
function deckBuf() {
  const b = buf(0, GROUND, SPAN, DECK_H);
  for (let x = 0; x < SPAN; x++) {
    const pk = Math.floor(x / 8), px = x % 8, tone = nz(pk, 201), gap = px === 0;
    const k = tone > 0.8 ? 2 : tone > 0.25 ? 3 : 4;
    put(b, x, GROUND, gap ? WOOD[3] : WOOD[0]);
    put(b, x, GROUND + 1, gap ? WOOD[4] : tone > 0.5 ? WOOD[1] : WOOD[2]);
    for (let y = GROUND + 2; y < GROUND + 6; y++) put(b, x, y, gap ? WOOD[5] : WOOD[Math.min(5, k + (y === GROUND + 5 ? 1 : 0) - (px === 7 && y < GROUND + 5 ? 1 : 0))]);
    if (px === 4) { put(b, x, GROUND + 3, WOOD[5]); put(b, x + 1, GROUND + 3, WOOD[1]); }                    // a nail
    if ((px === 2 || px === 3) && nz(pk, 207) > 0.55) put(b, x, GROUND + 4, WOOD[Math.min(5, k + 1)]);       // grain
    put(b, x, GROUND + 6, I('#3a2026'));
    // the girder: flanges, a web with two rows of rivets and stiffeners, rust streaks
    put(b, x, GROUND + 7, STEEL[1]);
    for (let y = GROUND + 8; y < GROUND + 14; y++) {
      let c = y >= GROUND + 12 ? STEEL[4] : STEEL[3];
      if (nz(x, 221) > 0.86 && y > GROUND + 8) c = STEEL[4];
      if (bay(x, y) > 0.8 && y === GROUND + 11) c = STEEL[4];
      put(b, x, y, c);
    }
    if (x % 4 === 1) { put(b, x, GROUND + 9, STEEL[0]); put(b, x, GROUND + 12, STEEL[2]); put(b, x - 1, GROUND + 9, STEEL[5]); }
    if (x % 32 === 0) { rect(b, x, GROUND + 8, 1, 6, STEEL[5]); rect(b, x + 1, GROUND + 8, 1, 6, STEEL[1]); }
    put(b, x, GROUND + 14, STEEL[2]); put(b, x, GROUND + 15, STEEL_OUT);
    if (x % 16 >= 6 && x % 16 < 10) { put(b, x, GROUND + 16, x % 16 === 9 ? WOOD[2] : WOOD[4]); put(b, x, GROUND + 17, WOOD[5]); if (x % 16 === 7 || x % 16 === 8) put(b, x, GROUND + 18, OUTI); }
    if (x % 16 === 5 || x % 16 === 10) { put(b, x, GROUND + 16, OUTI); put(b, x, GROUND + 17, OUTI); }
  }
  return bake(b);
}
// A stone pier under each pylon, standing in the river (water line y 262), with steel knee braces to the girder
const WATER_Y = 262, UNDER = GROUND + 15;      // UNDER: the first row below the girder (the river shows from here down)
function pierPx(x, y, hw) {
  const cy = y - (GROUND + 19), course = Math.floor(cy / 5), joint = wrap(cy, 5) === 4 || wrap(x + 20 + (course & 1) * 4, 9) === 0;
  let k = x >= hw - 2 ? 0 : x >= hw - 4 ? 1 : x <= -hw + 1 ? 5 : 3 + (nz(x, y + 9) > 0.8 ? 1 : 0) - (nz(x >> 1, y >> 1) > 0.85 ? 1 : 0);
  if (joint) k = Math.min(5, k + 1);
  let c = STONE[k];
  if (y >= WATER_Y - 3 && y < WATER_Y) c = nz(x, y) > 0.5 ? I('#5a6a4a') : mixI(c, I('#2a2440'), 0.45);     // wet, with weed
  if (y >= WATER_Y) c = mixI(c, RIV_DN[4], 0.62 + ss(WATER_Y, H, y) * 0.2);                                  // seen through the water
  return c;
}
function pierBuf() {
  const b = buf(-32, UNDER, 64, H - UNDER + 10);
  for (const dd of [-1, 1]) for (let k = 0; k <= 16; k++) {
    const x = dd * (13 + k), y = 259 - Math.round(k * 0.62);
    put(b, x, y, STEEL[2]); put(b, x, y + 1, STEEL[4]); if (k % 4 === 2) put(b, x, y, STEEL[0]);
  }
  for (let y = GROUND + 19; y < H + 10; y++) {
    const hw = 11 + Math.round(ss(GROUND + 19, 268, y) * 3);
    for (let x = -hw; x < hw; x++) put(b, x, y, pierPx(x, Math.min(y, H - 1), hw));
  }
  rect(b, -14, GROUND + 16, 28, 3, STONE[2]); rect(b, -14, GROUND + 16, 28, 1, STONE[1]); rect(b, 12, GROUND + 17, 2, 2, STONE[0]); rect(b, -14, GROUND + 17, 2, 2, STONE[5]);
  // outline above the water only
  const add = [];
  for (let y = b.y0; y < WATER_Y; y++) for (let x = b.x0; x < b.x0 + b.w; x++) if (get(b, x, y) === NONE && (get(b, x - 1, y) !== NONE || get(b, x + 1, y) !== NONE || get(b, x, y - 1) !== NONE || get(b, x, y + 1) !== NONE)) add.push([x, y]);
  for (const [x, y] of add) put(b, x, y, OUTI);
  return mk(b);
}
// The two ends: a masonry abutment inside the bridge's own ground. A stone sill (8 px, its top is the walking
// line) carries the first planks, the wall under it goes down into the river, boulders lie at its foot.
// Local x 0 = the end of the bridge (BX0 or BX1); west = the camp's end, else the base's end.
const ABUT = 14, SILL = 8;
function bankBuf(west) {
  const b = buf(west ? 0 : -44, GROUND, 44, H - GROUND + 10);
  const X = u => west ? u : u - ABUT;                    // u = 0..ABUT-1 across the wall, left to right
  for (let y = GROUND; y < H + 10; y++) for (let u = 0; u < ABUT; u++) {
    const inSill = west ? u < SILL : u >= ABUT - SILL;
    if (!inSill && y < UNDER) continue;                  // the girder runs over the inner part
    put(b, X(u), y, y === GROUND ? STONE[0] : y === GROUND + 1 ? STONE[1] : pierPx(u - 7, Math.min(y, H - 1), 7));
  }
  // the sill's inner face, the wall's face toward the water
  const inX = west ? SILL : -SILL - 1, faceX = west ? ABUT : -ABUT - 1;
  for (let y = GROUND + 1; y < UNDER; y++) put(b, inX, y, OUTI);
  for (let y = UNDER; y < WATER_Y; y++) put(b, faceX, y, OUTI);
  if (!west) for (let y = GROUND + 3; y < GROUND + 6; y++) for (let u = ABUT - SILL; u < ABUT; u++) put(b, X(u), y, ((u + y) >> 1) % 2 ? I('#f1c40f') : I('#20202e'));   // the robots' side
  // boulders at its foot
  for (const [off, bw, bh, sd] of [[2, 12, 6, 511], [12, 10, 4, 513], [21, 7, 3, 515]]) for (let x = 0; x < bw; x++) {
    const u = (x - (bw - 1) / 2) / (bw / 2), hh = Math.max(1, Math.round(bh * Math.sqrt(Math.max(0, 1 - u * u)) * (0.7 + 0.4 * nz(x >> 1, sd))));
    const wx = west ? ABUT + off + x : -ABUT - 1 - off - (bw - 1 - x);
    for (let k = 0; k < hh; k++) put(b, wx, WATER_Y + 1 - k, k === hh - 1 ? I('#d08a70') : u > 0.3 ? I('#5e3c62') : I('#443058'));
    put(b, wx, WATER_Y + 2, I('#b8b4e0'));
  }
  return mk(b);
}

// Stacked cargo crates. Each crate is a cell with shared 1px borders; the top border row is the platform's top.
const GLYPH = { R: ['##.', '#.#', '##.', '#.#', '#.#'], 0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  '-': ['...', '...', '###', '...', '...'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'], '^': ['..#..', '.###.', '#.#.#', '..#..', '..#..'] };
function stencil(b, x, y, s, c) {
  for (const ch of s) { const gl = GLYPH[ch]; if (!gl) { x += 2; continue; } for (let j = 0; j < gl.length; j++) for (let i = 0; i < gl[j].length; i++) if (gl[j][i] === '#') put(b, x + i, y + j, c); x += gl[0].length + 1; }
}
function crate(b, x, y, w, kind, seed) {
  const pal = kind === 0 ? PINE : kind === 1 ? OLIVE : DARKW, h = 16;
  rect(b, x, y, w + 1, h + 1, OUTI);
  rect(b, x + 1, y + 1, w - 1, h - 1, pal[2]);
  if (kind === 1) for (let yy = y + 5; yy < y + h - 2; yy += 4) rect(b, x + 1, yy, w - 1, 1, pal[3]);
  else for (let xx = x + 4; xx < x + w - 1; xx += 4) rect(b, xx, y + 1, 1, h - 1, pal[3]);
  for (let i = 0; i < w * h / 12; i++) put(b, x + 3 + Math.floor(nz(i, seed) * (w - 5)), y + 3 + Math.floor(nz(i, seed + 1) * (h - 5)), nz(i, seed + 2) > 0.5 ? pal[1] : pal[3]);
  // the frame boards: lit on top and on the sun side
  rect(b, x + 1, y + 1, w - 1, 2, pal[1]); rect(b, x + 1, y + 1, w - 1, 1, pal[0]);
  rect(b, x + 1, y + h - 2, w - 1, 2, pal[4]);
  rect(b, x + 1, y + 1, 2, h - 1, pal[3]); rect(b, x + w - 2, y + 2, 2, h - 2, pal[1]); rect(b, x + w - 1, y + 2, 1, h - 3, pal[0]);
  for (const [nx, ny] of [[x + 2, y + 2], [x + w - 2, y + 2], [x + 2, y + h - 2], [x + w - 2, y + h - 2]]) put(b, nx, ny, pal[5]);
  if (w < 16) return;
  const v = nz(seed, 311);
  if (kind === 0) {
    if (w < 32) { if (v > 0.5) stencil(b, x + 6, y + 6, '^', I('#8a3a2a')); else line(b, x + 3, y + h - 3, x + w - 3, y + 3, pal[4]); }
    else { stencil(b, x + 13, y + 6, '^', I('#8a3a2a')); stencil(b, x + 20, y + 6, 'X3', I('#6a4a30')); }
  } else if (kind === 1) {
    if (w < 32) { rect(b, x + 5, y + 6, 6, 4, I('#2d2d3a')); rect(b, x + 7, y + 7, 2, 2, I('#f1c40f')); put(b, x + 4, y + 7, I('#2d2d3a')); put(b, x + 11, y + 8, I('#2d2d3a')); }
    else {
      stencil(b, x + 12, y + 6, v > 0.5 ? 'RR-7' : 'RR-3', I('#f0ecc0'));
      for (let i = 0; i < 6; i++) for (let j = 0; j < 12; j++) put(b, x + 3 + i, y + 3 + j, ((i + j) >> 1) % 2 ? I('#f1c40f') : OUTI);     // hazard end
    }
  } else {
    for (const sx of w < 32 ? [x + 4, x + 11] : [x + 6, x + 25]) { rect(b, sx, y + 1, 2, h - 1, I('#56606e')); rect(b, sx + 1, y + 1, 1, h - 1, I('#c3cdd8')); put(b, sx, y + 4, OUTI); put(b, sx, y + 11, OUTI); }
    if (w >= 32) stencil(b, x + 11, y + 6, v > 0.5 ? '0731' : 'R-10', I('#e8d0a0'));
  }
}
// One platform: rows of crates from its top (pl.y) down to the deck; the top border row is exactly pl.y
function stackBuf(pl) {
  const x = pl.x, y = pl.y, w = pl.w, b = buf(x - 1, y - 1, w + 3, GROUND - y + 1), rows = Math.max(1, Math.ceil((GROUND - y) / 16));
  let n = 0;
  for (let r = 0; r < rows; r++) for (let xx = x, i = 0; xx < x + w; i++) {
    // long and short crates staggered like bricks: olive army crates, pine and dark ones (row 0 = the bottom row)
    const row = rows - 1 - r, left = x + w - xx;
    const big = left >= 32 && (w % 32 === 0 ? row % 2 === 0 : (i + row) % 2 === 0), cw = big ? 32 : Math.min(16, left);
    crate(b, xx, y + r * 16, cw, big ? [1, 1, 0][row % 3] : row % 3 === 0 || i % 2 ? 2 : 0, x + 13 * n++);
    xx += cw;
  }
  // two ratchet straps over the whole stack, down to rings on the deck
  if (w >= 24) for (const sx of [x + 9, x + w - 4]) for (let yy = y + 1; yy < GROUND; yy++) {
    put(b, sx, yy, I('#b08a2a')); put(b, sx + 1, yy, I('#f4d060'));
    if ((yy - y) % 16 === 9) { rect(b, sx - 1, yy, 4, 3, I('#56606e')); rect(b, sx - 1, yy, 4, 1, I('#c3cdd8')); }
  }
  // the lid you stand on catches the light
  for (let xx = x + 1; xx < x + w; xx++) if (get(b, xx, y + 1) !== OUTI) put(b, xx, y + 1, I('#fff0c4'));
  return mk(b);
}

// The BRIDGE sign (the word itself is drawn with the game font)
function signBuf() {
  const b = buf(-28, -42, 56, 42);
  rect(b, -2, -26, 4, 26, WOOD[3]); rect(b, 1, -26, 1, 26, WOOD[1]); rect(b, -2, -26, 1, 26, WOOD[4]);
  rect(b, -25, -39, 50, 15, WOOD[2]); rect(b, -25, -39, 50, 1, WOOD[0]); rect(b, -25, -26, 50, 2, WOOD[4]); rect(b, 23, -38, 2, 12, WOOD[0]); rect(b, -25, -38, 1, 13, WOOD[3]);
  for (let x = -24; x < 24; x += 2) if (nz(x, 401) > 0.5) put(b, x, -36 + Math.floor(nz(x, 402) * 10), WOOD[3]);
  rect(b, -25, -32, 50, 1, WOOD[3]);
  for (const [nx, ny] of [[-23, -37], [22, -37], [-23, -27], [22, -27]]) put(b, nx, ny, WOOD[5]);
  outline(b);
  return mk(b);
}
// the span's number on the girder (RR-01 .. RR-05): the kids can count the spans
function spanMark(n) {
  const b = buf(0, 0, 23, 6);
  rect(b, 0, 0, 23, 6, STEEL[3]);
  stencil(b, 2, 0, 'RR-0' + n, I('#f4cc9c'));
  return bake(b);
}
function glowSprite(r, col) {
  const c = canvasOf(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 1, r, r, r);
  gr.addColorStop(0, 'rgba(' + col + ',0.7)'); gr.addColorStop(0.35, 'rgba(' + col + ',0.28)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return c;
}

// Foreground (parallax 1.3): a low rock in the river, dark in the bridge's shadow with the sun on its rim, with
// or without reeds (three bends for their sway). Local origin: the rock's left end on the bottom edge of the screen.
const FGK = P('#e8a070', '#5c4674', '#3c305c', '#2a2246'), FGR = P('#d0c474', '#5e7e4c', '#2e4a3e');
function fgBuf(seed, reeds, bend) {
  const w = 22 + Math.round(nz(seed, 1) * 14), h = 6 + Math.round(nz(seed, 2) * 5), b = buf(-14, -34, w + 28, 34);
  if (reeds) for (let k = 0; k < 7; k++) {
    const rx = 3 + Math.round(nz(seed + k, 3) * (w - 6)), len = 11 + Math.round(nz(seed + k, 4) * 15), lean = (nz(seed + k, 5) - 0.5) * 6 + bend;
    for (let t = 0; t < len; t++) { const u = t / len; put(b, rx + lean * u * u, -3 - t, t > len - 3 ? FGR[0] : u > 0.45 ? FGR[1] : FGR[2]); }
    if (k % 3 === 0) { const tx = Math.floor(rx + lean * 0.8); rect(b, tx, -3 - len - 2, 2, 5, I('#6a4030')); put(b, tx + 1, -3 - len - 1, I('#c08050')); }   // a cattail
  }
  for (let x = 0; x < w; x++) {
    const u = (x - (w - 1) / 2) / (w / 2), hh = Math.max(1, Math.round(h * Math.sqrt(Math.max(0, 1 - u * u)) * (0.7 + 0.45 * nz(x >> 2, seed + 7))));
    for (let k = 0; k < hh; k++) put(b, x, -1 - k, k === hh - 1 ? (u > -0.2 ? FGK[0] : FGK[1]) : u > 0.4 ? FGK[1] : nz(x >> 1, k + seed) > 0.75 ? FGK[3] : FGK[2]);
  }
  outline(b, I('#161226'));
  return mk(b);
}

// ============================================================
// Bake steps (run once, in order, by level1_art.js)
// ============================================================
const steps = [
  () => { A.skyB = buf(-10, -10, W + 20, 224); skyRows(A.skyB, -10, 100); },
  () => { skyRows(A.skyB, 100, 214); A.sky = skyFinish(A.skyB); A.skyB = null; },
  () => { A.clouds = [[128, 1, CLOUD_LOW], [92, 2, CLOUD_HIGH], [70, 3, CLOUD_LOW], [150, 4, CLOUD_HIGH], [60, 5, CLOUD_HIGH], [104, 6, CLOUD_LOW]].map(([w, s, pal]) => mk(cloudBuf(w, s, pal))); },
  () => {
    A.sun = sunSprite(); A.rays = [raySprite(1), raySprite(2)];
    A.glow = glowSprite(24, '255,208,120');
    const mb = canvasOf(1, 16), mg = mb.getContext('2d'), gr = mg.createLinearGradient(0, 0, 0, 16);
    gr.addColorStop(0, 'rgba(255,226,170,0)'); gr.addColorStop(0.45, 'rgba(255,230,178,0.75)'); gr.addColorStop(1, 'rgba(255,226,170,0)');
    mg.fillStyle = gr; mg.fillRect(0, 0, 1, 16);
    A.mistBand = mb;
    A.bank = [0, 1, 2].map(i => blobSprite([0, 1, 2, 3, 4].map(k => [9 + k * 13, 9 + Math.round(Math.sin(k * 2 + i) * 1.5), 5 + ((k * 7 + i) % 3) * 1.5]), I('#ffe9c4')));
    A.puff = [3, 5, 7, 9].map(r => blobSprite([[r + 1, r + 1, r]], I('#fff2e0')));
  },
  // the ranges: lower where the sun sets behind them (the saddles follow the sun across all cameras)
  () => { const f = ridge(11, 152, 14, 44, 64, 0.95); A.rangeA = mountains(0.03, 96, s => f(s) + 10 * Math.exp(-(((s - 454) / 52) ** 2)), P('#f2bcae', '#d4a0b2', '#bf90b2', '#a984b2'), I('#ffd2a2'), 150, 200, 0.62, 13); },
  () => { const f = ridge(17, 176, 16, 46, 58, 0.9); A.rangeB = mountains(0.06, 110, s => f(s) + 14 * Math.exp(-(((s - 479) / 66) ** 2)), P('#d6929c', '#b47c9a', '#99699c', '#805b98'), I('#f8be9a'), 162, 202, 0.7, 19); },
  () => { A.far = farCliffs(); A.river = bake(riverBuf()); A.glit = [glitterBuf(0), glitterBuf(1)]; A.rocks = makeRocks(); },
  cliffBegin,
  () => cliffRock(0, 200), () => cliffRock(200, 400), () => cliffRock(400, 620), () => cliffRock(620, 9999),
  cliffDress,
  () => { A.fall = fallFrames(FALL); A.fall2 = fallFrames(FALL2); },
  () => { A.span = spanBuf(); A.pylon = pylonBuf(); A.deck = deckBuf(); A.pier = pierBuf(); },
  () => {
    A.sign = signBuf(); A.bankW = bankBuf(true); A.bankE = bankBuf(false); A.marks = [1, 2, 3, 4, 5].map(spanMark);
    A.fg = [0, 1, 2, 3].map(i => [-2, 0, 2].map(bend => fgBuf(801 + i * 17, i !== 1, bend)));
    A.stacks = new Map();
    for (const pl of (L1ART.plats ? L1ART.plats('bridge') : [])) A.stacks.set(pl, stackBuf(pl));
  }
];

// ============================================================
// bg: the whole backdrop (screen space), into g
// ============================================================
// clouds: [sprite, x at the first camera and frame 0, y, parallax, drift px/frame]
const CLOUDS = [[3, 510, 14, 0.035, 0.022], [4, 250, 30, 0.03, 0.018], [1, 130, 64, 0.045, 0.03], [0, 400, 76, 0.05, 0.035], [2, 590, 98, 0.04, 0.026], [5, 770, 84, 0.05, 0.035]];
const FLOCK = [[0, 0], [8, -3], [9, 3], [17, -6], [18, 6], [27, -8], [29, 9]];
function bg(g, cx) {
  const t = G.t, sx = sunX(cx), sy = sunY(cx);
  g.drawImage(A.sky, -10, -10);
  if (Math.floor(t / 24) % 3 === 0) { g.fillStyle = '#fff8e0'; g.fillRect(51, 46, 3, 1); g.fillRect(52, 45, 1, 3); }
  const rk = 0.5 + 0.5 * Math.sin(t * 0.013);
  g.globalAlpha = 0.5 + 0.5 * rk; g.drawImage(A.rays[0], sx - 260, sy - 240);
  g.globalAlpha = 1 - 0.5 * rk; g.drawImage(A.rays[1], sx - 260, sy - 240);
  g.globalAlpha = 1;
  g.drawImage(A.sun, sx - 72, sy - 72);
  for (let i = 0; i < CLOUDS.length; i++) { const c = CLOUDS[i]; blit(g, A.clouds[c[0]], wrap(c[1] + 170 - (cx - CAM0) * c[3] - t * c[4], W + 340) - 170, c[2]); }
  // a flock heading home, west along the gorge (it comes by every minute and a half)
  const fx = wrap(420 - (cx - CAM0) * 0.04 - t * 0.14, W + 280) - 60, fy = 122 + Math.sin(t * 0.011) * 3;
  if (fx < W + 40) {
    g.fillStyle = '#4a3058';
    for (let i = 0; i < FLOCK.length; i++) {
      const x = Math.round(fx + FLOCK[i][0]), y = Math.round(fy + FLOCK[i][1] + Math.sin(t * 0.03 + i * 1.7)), f = Math.floor((t + i * 5) / 7) % 4;
      g.fillRect(x - 1, y, 3, 1);
      if (f === 0) { g.fillRect(x - 2, y - 1, 1, 1); g.fillRect(x + 2, y - 1, 1, 1); g.fillRect(x - 3, y - 2, 1, 1); g.fillRect(x + 3, y - 2, 1, 1); }
      else if (f === 2) { g.fillRect(x - 2, y + 1, 1, 1); g.fillRect(x + 2, y + 1, 1, 1); }
      else { g.fillRect(x - 3, y - 1, 2, 1); g.fillRect(x + 2, y - 1, 2, 1); }
    }
  }
  blitStrip(g, A.rangeA, cx); blitStrip(g, A.rangeB, cx); blitStrip(g, A.far, cx);
  riverBands(g, cx, RY0, GROUND + 12, 0);
  g.drawImage(A.mistBand, 0, 0, 1, 16, -10, RY0 - 8, W + 20, 16);
  const lit = sunLit(cx);
  if (lit > 0) {
    const gl = A.glit[Math.floor(t / 9) % 2];
    g.globalAlpha = lit; g.drawImage(gl.img, 0, 0, gl.w, GROUND + 2 - RY0, sx + gl.x0, RY0, gl.w, GROUND + 2 - RY0); g.globalAlpha = 1;
  }
  sparkles(g, cx, sx, 0, RY0 + 2, 32, lit > 0.5);
  for (const r of A.rocks) {
    if (r.near) continue;
    const x = Math.round(r.x - (cx - CAM0) * r.p);
    if (x > -40 && x < W + 20) { blit(g, r.s, x, r.y); g.fillStyle = '#fffaf0'; g.fillRect(x - 3 + (Math.floor(t / 10 + r.w) % 3), r.y + 1, 3, 1); g.fillRect(x + r.w - 2 - (Math.floor(t / 13 + r.w) % 2), r.y + 1, 4, 1); }
  }
  // mist drifting low over the far water
  for (let i = 0; i < 7; i++) {
    const u = wrap(t * 0.0009 * (1 + (i % 3) * 0.3) + hsh(i * 3.7), 1), x = wrap(u * (W + 240) - (cx - CAM0) * 0.14 + i * 90, W + 240) - 120;
    g.globalAlpha = 0.16 + 0.1 * Math.sin(t * 0.01 + i);
    g.drawImage(A.bank[i % 3], Math.round(x) - 35, 192 + (i % 3) * 3);
  }
  g.globalAlpha = 1;
  blitStrip(g, A.cliff, cx);
  const off = stripOff(PC, cx);
  waterfall(g, FALL, A.fall, FALL.s - 10 - off, t);
  waterfall(g, FALL2, A.fall2, FALL2.s - 10 - off, t + 11);
  // the lookout's lamp
  if (Math.floor(t / 22) % 2) { const lx = LOOK + 3 - 10 - off; g.fillStyle = '#ff5a48'; g.fillRect(lx - 1, A.lookY, 3, 1); g.fillRect(lx, A.lookY - 1, 1, 3); }
}
// How much of the sun shows over the gorge wall in front of it (0..1): its glitter on the river follows
function sunLit(cx) {
  const s = sunX(cx) + 10 + stripOff(PC, cx);
  return clamp((A.wallTop[clamp(s, 0, A.wallTop.length - 5) + 4] - (sunY(cx) - 8)) / 16, 0, 1);
}
// the river from row ya to row yb, in bands, at x offset ox (0 in screen space, the camera x in world space)
function riverBands(g, cx, ya, yb, ox) {
  for (let y = ya; y < yb; y += BAND) {
    const h = Math.min(BAND, yb - y), p = rowP(y + 1.5);
    g.drawImage(A.river, wrap(Math.floor((cx - CAM0) * p + G.t * 0.07 * p), RW), y - RY0, W + 20, h, ox - 10, y, W + 20, h);
  }
}
// twinkles on the glitter path, scattered glints and slow wave lines, for the rows y0 .. y0 + span
function sparkles(g, cx, sx, ox, y0, span, path) {
  const t = G.t, low = y0 > GROUND;
  for (let i = 0; path && i < (low ? 6 : 16); i++) {
    const cyc = 9 + (i % 7), ph = Math.floor((t + i * 5) / cyc), life = (t + i * 5) % cyc;
    if (life > cyc - 3) continue;
    const y = Math.round(y0 + Math.pow(hsh(i * 13.1 + ph * 0.37 + y0), low ? 1 : 1.6) * span), spread = 3 + (y - RY0) * 0.42;
    const x = ox + Math.round(sx + (hsh(i * 7.7 + ph * 1.3) - 0.5) * 2 * spread);
    g.fillStyle = life < 2 && y < 206 ? '#ffffff' : '#fff0c0';
    g.fillRect(x, y, y > RY0 + 12 ? 2 : 1, 1);
    if (life === 1 && i % 3 === 0 && (y < 206 || low)) { g.fillRect(x - 1, y, 4, 1); g.fillRect(x, y - 1, 1, 3); }
  }
  for (let i = 0; i < 8; i++) {
    const cyc = 14 + (i % 5), ph = Math.floor((t + i * 11) / cyc), life = (t + i * 11) % cyc;
    if (life > 4) continue;
    const y = Math.round(y0 + 1 + hsh(i * 3.1 + ph + y0) * (span - 2));
    g.fillStyle = low ? '#b8b4f0' : '#fff4e0';
    g.fillRect(ox + Math.round(wrap(hsh(i * 5.3 + ph * 0.71) * 900 - (cx - CAM0) * rowP(y), W + 20) - 10), y, life === 2 ? 2 : 1, 1);
  }
  for (let i = 0; i < 6; i++) {
    const u = (t * 0.004 + hsh(i * 2.7 + y0)) % 1, y = Math.round(y0 + 2 + hsh(i * 9.3 + y0) * (span - 3)), len = 3 + Math.round((y - RY0) / 5);
    const x = ox + Math.round(wrap(hsh(i * 4.1) * 900 - (cx - CAM0) * rowP(y) - u * 30, W + 60) - 30);
    g.fillStyle = low ? 'rgba(150,146,214,' + (0.6 * Math.sin(u * Math.PI)).toFixed(2) + ')' : 'rgba(255,244,226,' + (0.45 * Math.sin(u * Math.PI)).toFixed(2) + ')';
    g.fillRect(x, y, len, 1);
  }
}
// a fall: the baked frame, then spray, foam and mist where the water lands (x0 = screen x of its first column)
function waterfall(g, F, frames, x0, t) {
  if (x0 < -44 || x0 > W + 34) return;
  blit(g, frames[Math.floor(t / FALL_HOLD) % FALL_N], x0, 0);
  const two = F.mid != null, fx = x0 + F.w / 2, r = two ? 1 : 0.5;
  g.fillStyle = '#ffffff';
  if (two) for (let i = 0; i < 7; i++) {
    const ph = (t * 0.05 + hsh(i * 4.1)) % 1, a = -Math.PI / 2 + (hsh(i * 2.3) - 0.5) * 2.4, v = 0.7 + hsh(i * 6.7);
    g.fillRect(Math.round(fx + Math.cos(a) * v * ph * 11), Math.round(F.mid + Math.sin(a) * v * ph * 9 + 0.1 * (ph * 9) * (ph * 9)), 1, 1);
  }
  g.fillRect(Math.round(fx - 12 * r), F.base - 1, Math.round(25 * r), 2);
  g.fillStyle = '#fff0dc'; g.fillRect(Math.round(fx - 17 * r), F.base + 1, Math.round(35 * r), 1); g.fillRect(Math.round(fx - 9 * r), F.base - 2, Math.round(18 * r), 1);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < (two ? 10 : 5); i++) {
    const ph = (t * 0.04 + hsh(i * 4.7)) % 1, a = -Math.PI / 2 + (hsh(i * 2.9) - 0.5) * 2.7, v = 0.8 + hsh(i * 6.1);
    const Y = Math.round(F.base - 1 + Math.sin(a) * v * ph * 16 * r + 0.09 * (ph * 16) * (ph * 16) * r);
    if (Y <= F.base) g.fillRect(Math.round(fx + Math.cos(a) * v * ph * 18 * r), Y, 1, 1);
  }
  for (let i = 0; i < (two ? 6 : 3); i++) {
    const ph = (t * 0.006 + i / 6) % 1, s = A.puff[Math.min(3, Math.floor(ph * (two ? 4 : 2.5)))];
    g.globalAlpha = 0.34 * (1 - ph);
    g.drawImage(s, Math.round(fx - 10 * r + hsh(i * 3.9) * 20 * r + ph * 14 - s.width / 2), Math.round(F.base - 3 - ph * 30 * r - s.height / 2));
  }
  g.globalAlpha = 1;
}

// ============================================================
// behind, ground, plat (world space: ctx is translated by -cx)
// ============================================================
const SPRINGS = [0, 1, 2, 3, 4, 5].map(k => BX0 + k * SPAN);
function behind(cx) {
  const decor = L1ART.decor ? L1ART.decor('bridge') : [];
  for (let i = 0; i < decor.length; i++) {
    const dd = decor[i];
    if (dd.t === 'sign') { if (dd.x > cx - 40 && dd.x < cx + W + 40) { blit(ctx, A.sign, dd.x, GROUND); text(dd.s || 'BRIDGE', dd.x, GROUND - 35, '#5a2416', 1, 'center', null); } }
    else if (dd.t === 'truss') truss(cx);
  }
}
function truss(cx) {
  if (cx + W < BX0 - 40 || cx > BX1 + 40) return;
  const t = G.t;
  for (let k = 0; k < 5; k++) { const x = SPRINGS[k]; if (x + SPAN > cx - 4 && x < cx + W + 4) blit(ctx, A.span, x, 0); }
  for (let k = 0; k < 6; k++) { const x = SPRINGS[k]; if (x > cx - 30 && x < cx + W + 30) blit(ctx, A.pylon, x, 0); }
  // the lamps are coming on: one on each pylon, one under each crown
  for (let k = 0; k < 11; k++) {
    const x = BX0 + k * SPAN / 2, y = k % 2 ? 160 : 159;
    if (x < cx - 30 || x > cx + W + 30) continue;
    ctx.globalAlpha = 0.72 + 0.2 * Math.sin(t * 0.13 + k * 2.1) + (hsh(k + Math.floor(t / 7)) > 0.9 ? -0.15 : 0);
    ctx.drawImage(A.glow, x - 24, y - 24);
  }
  ctx.globalAlpha = 1;
}

function ground(cx) {
  const xa = Math.max(BX0, Math.floor(cx) - 12), xb = Math.min(BX1, Math.ceil(cx) + W + 12);
  if (xb <= xa) return;
  const t = G.t, clip = xa > cx - 10 || xb < cx + W + 10;        // an end of the bridge is on screen
  if (clip) { ctx.save(); ctx.beginPath(); ctx.rect(xa, GROUND, xb - xa, H - GROUND + 10); ctx.clip(); }
  // the river under the bridge, in the bridge's shadow
  riverBands(ctx, cx, UNDER, H, cx);
  ctx.drawImage(A.river, 0, H - RY0 - 1, W + 20, 1, cx - 10, H, W + 20, 10);      // the margin a screen shake can show
  const sx = sunX(cx), lit = sunLit(cx);
  if (lit > 0) {
    const gl = A.glit[Math.floor(t / 9) % 2];
    ctx.globalAlpha = lit; ctx.drawImage(gl.img, 0, UNDER - RY0, gl.w, H - UNDER, cx + sx + gl.x0, UNDER, gl.w, H - UNDER); ctx.globalAlpha = 1;
  }
  sparkles(ctx, cx, sx, cx, UNDER + 2, H - UNDER - 4, lit > 0.5);
  for (const r of A.rocks) {
    if (!r.near) continue;
    const x = cx + Math.round(r.x - (cx - CAM0) * r.p);
    if (x > cx - 40 && x < cx + W + 20) { blit(ctx, r.s, x, r.y); R(x - 4 + (Math.floor(t / 10 + r.w) % 3), r.y + 1, 4, 1, '#c8c4ec'); R(x + r.w - 1 - (Math.floor(t / 13 + r.w) % 2), r.y + 1, 5, 1, '#c8c4ec'); }
  }
  // piers, then the foam round their feet
  for (let k = 1; k < 5; k++) {
    const x = SPRINGS[k];
    if (x < cx - 40 || x > cx + W + 40) continue;
    blit(ctx, A.pier, x, 0);
    const f = Math.floor(t / 9 + k) % 3;
    R(x - 17 - f, WATER_Y, 9, 1, '#e8e6ff'); R(x + 8 + f, WATER_Y, 10, 1, '#e8e6ff'); R(x - 13, WATER_Y - 1, 5, 1, '#ffffff'); R(x + 9, WATER_Y - 1, 4, 1, '#ffffff');
    R(x - 24 - f * 2, WATER_Y + 2, 7, 1, '#9a96d8'); R(x + 16 + f * 2, WATER_Y + 3, 8, 1, '#9a96d8'); R(x - 6 + f, WATER_Y + 1, 5, 1, '#c8c4f0');
  }
  // the deck, the span numbers, the abutments
  for (let x = xa; x < xb;) { const tx = wrap(x - BX0, SPAN), n = Math.min(SPAN - tx, xb - x); ctx.drawImage(A.deck, tx, 0, n, DECK_H, x, GROUND, n, DECK_H); x += n; }
  for (let k = 0; k < 5; k++) { const x = SPRINGS[k] + 166; if (x > cx - 30 && x < cx + W + 10) ctx.drawImage(A.marks[k], x, GROUND + 8); }
  if (BX0 > cx - 50 && BX0 < cx + W + 10) { blit(ctx, A.bankW, BX0, 0); const f = Math.floor(t / 11) % 3; R(BX0 + ABUT + 1 + f, WATER_Y + 3, 9, 1, '#9a96d8'); }
  if (BX1 > cx - 10 && BX1 < cx + W + 50) { blit(ctx, A.bankE, BX1, 0); const f = Math.floor(t / 11) % 3; R(BX1 - ABUT - 12 - f, WATER_Y + 3, 9, 1, '#9a96d8'); }
  if (clip) ctx.restore();
}

function plat(pl) {
  let s = A.stacks.get(pl);
  if (!s) { s = stackBuf(pl); A.stacks.set(pl, s); }       // a platform the bake did not know (none today)
  ctx.drawImage(s.img, s.x0, s.y0);
}

// ============================================================
// front (screen space, parallax 1.3): sparse river rocks and reeds along the bottom edge, only where the bridge is
// ============================================================
const FG_SP = 170;
function front(cx) {
  const off = cx * 1.3, t = G.t;
  for (let i = Math.floor((off - 60) / FG_SP); i * FG_SP - off < W + 20; i++) {
    if (hsh(i * 1.31 + 7) < 0.3) continue;
    const x = Math.round(i * FG_SP + hsh(i * 2.17) * 80 - off), wx = cx + x;
    if (wx < BX0 + 24 || wx > BX1 - 60) continue;
    const kind = A.fg[Math.floor(hsh(i * 3.7 + 1) * 4) % 4];
    blit(ctx, kind[1 + Math.round(Math.sin(t * 0.03 + i * 1.9))], x, H);
  }
}

L1ART.bridge = { x0: BX0, x1: BX1, steps, bg, behind, ground, plat, front };
}
