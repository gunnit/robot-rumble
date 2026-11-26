'use strict';
// ============================================================
// Mission 1 repaint mock, AREA 3: THE BIG BRIDGE (key: bridge). A harness fixture: load it after the game with
//   --extra proposals/polish/bridge/scene.js   (render command and notes: proposals/polish/bridge/notes.md)
// It replaces the draw hooks of LEVELS[0] for the bridge (ground type 'bridge', world x 3060-4340) and falls back
// to the original drawing everywhere else:
//   drawBG      a golden-sunset gorge: dithered sky, low sun, belly-lit clouds, a flock of birds, two far purple
//               ranges, hazy far cliffs, the river (row-by-row parallax, a glitter path under the sun), the gorge
//               walls with strata, jungle and a two-tier waterfall, mist. Crossfaded with the neighbours' old art.
//   drawBehind  stone pylons with lanterns, riveted rust-red trussed arches with hangers, the far rope railing, the
//               BRIDGE sign (the rest of the old decor is still drawn by the original function).
//   drawGround  the plank deck on its riveted girder, stone piers standing in the river, foam, both river banks.
//   drawPlat    the 'crates' platforms on the bridge as stacked, strapped cargo crates with stencil marks.
//   drawFront   the near railing: dark posts and swaying ropes.
// Static art is painted pixel by pixel into buffers and baked once on first use (no canvases per frame); live bits
// (water, falls, mist, sparkles, birds, lamps, ropes) use G.t and hsh() only: never Math.random / rand.
// The last section stages the proposal frame (only when the mission is built at the mock camera, --x 3400).
// ============================================================
{
const L = LEVELS[0];
const BX0 = 3060, BX1 = 4340, SPAN = 256;   // the bridge; one arch span (5 spans, springs at BX0 + k * SPAN)
const CAM0 = 2630, CAM1 = 4290;             // camera x range in which the bridge scene has any weight
const MOCK = 3198, T0 = 150;                // the proposal frame: camera x (--x 3400) and frame count

// ============================================================
// Helpers: noise, colours, pixel buffers (same approach as level3_world.js; private copies)
// ============================================================
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
// hard-edged disc of rows in the current fillStyle (mist, glows)
function pdisc(g, x, y, r) {
  x = Math.round(x); y = Math.round(y);
  const n = Math.ceil(r);
  for (let j = -n; j <= n; j++) { const q = r * r - j * j + r * 0.8; if (q >= 0) { const hw = Math.round(Math.sqrt(q)); g.fillRect(x - hw, y + j, hw * 2 + 1, 1); } }
}
// a vertically periodic column of a tile (period P) drawn from y0 to y1 at x, scrolled down by off px
function tileY(g, img, i, P, x, y0, y1, off) {
  off = wrap(Math.floor(off), P);
  for (let y = y0; y < y1;) { const ty = wrap(y - y0 - off, P), n = Math.min(P - ty, y1 - y); g.drawImage(img, i, ty, 1, n, x, y, 1, n); y += n; }
}

// The weight of the bridge scene for camera cx: the same crossfade as level1.js areaWeights()[2]
function weightAt(cx) {
  const c = cx + W / 2;
  if (c <= 2870 || c >= 4530) return 0;
  if (c < 3170) return (c - 2870) / 300;
  if (c > 4230) return 1 - (c - 4230) / 300;
  return 1;
}
// Background strips: painted in strip coordinates; strip x = screen x + 10 + stripOff. mockX(p) is the strip x of
// screen x 0 at the proposal camera, so the composition can be laid out in the frame's own coordinates.
const stripW = p => W + 22 + Math.ceil((CAM1 - CAM0) * p);
const stripOff = (p, cx) => clamp(Math.round((cx - CAM0) * p), 0, stripW(p) - W - 20);
const mockX = p => 10 + Math.round((MOCK - CAM0) * p);
function blitStrip(g, s, cx) { g.drawImage(s.img, stripOff(s.p, cx), 0, W + 20, s.h, -10, s.top, W + 20, s.h); }

// ============================================================
// Palettes (the sun is low on the right: things are lit from the right and from the sky above)
// ============================================================
const SUN = { x: 422, y: 134 };
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
function skyBuf() {
  const b = buf(-10, -10, W + 20, 224);
  for (let y = -10; y < 214; y++) for (let x = -10; x < W + 10; x++) {
    const dx = (x - SUN.x) * 0.75, dy = (y - SUN.y) * 1.3;
    let t = Math.pow(clamp((y + 16) / 190, 0, 1), 1.15);
    t += 0.26 * Math.exp(-(dx * dx + dy * dy) / 12100) + (fbm(x / 120, y / 10, 3, 2) - 0.5) * 0.045;
    put(b, x, y, ramp(SKYC, t, x, y, 0.22));
  }
  for (const [x, y, big] of STARS) put(b, x, y, big ? I('#fff8e0') : I('#c8c0e8'));
  const top = I('#9a6e9c'), body = I('#d4849a'), lit = I('#ffd898');
  streak(b, 150, 122, 170, 4, 1, top, body, lit); streak(b, 296, 108, 130, 3, 2, top, body, lit);
  streak(b, 452, 118, 100, 3, 3, top, I('#e8947e'), I('#ffe6a8')); streak(b, 40, 138, 120, 3, 4, top, body, lit);
  streak(b, 250, 132, 90, 2, 5, top, I('#e8947e'), I('#ffe6a8')); streak(b, 330, 92, 80, 2, 6, I('#8a66a0'), I('#b87a9e'), I('#f0a890'));
  return b;
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
  const w = stripW(p), b = buf(0, top, w, 214 - top);
  for (let s = 0; s < w; s++) {
    const y0 = Math.round(f(s)), lit = f(s + 2) > f(s - 2) + 0.5;
    for (let y = Math.max(top, y0); y < 214; y++) {
      const d = y - y0, u = (s + d * 0.9) / 12, v = d / 34;
      const gr = fbm(u, v, seed, 3) - fbm(u + 0.3, v, seed, 3);
      let c = gr > 0.02 ? pal[1] : gr < -0.025 ? pal[3] : pal[2];
      if (d < 2) c = lit ? pal[0] : pal[2];
      put(b, s, y, mixI(c, haze, hk * ss(hz0, hz1, y)));
    }
  }
  return { img: bake(b), p, top, h: b.h };
}
const PF = 0.10;
function farCliffs() {
  const w = stripW(PF), top = 150, b = buf(0, top, w, 214 - top), M = mockX(PF);
  const CF = P('#f4bc98', '#d2928c', '#aa768e', '#8c648e'), haze = I('#ffdcaa');
  const topF = s => {
    const m = fbm(s / 70, 0, 61, 2), gap = Math.exp(-(((s - M - SUN.x) / 54) ** 2));
    let h = 10 * ss(0.36, 0.42, m) + 16 * ss(0.48, 0.52, m) + 12 * ss(0.6, 0.63, m);
    h *= 1 - 0.95 * gap;
    return 200 - Math.round(h) - (h > 3 ? Math.round(fbm(s / 4, 0, 63, 2) * 3) : 0);
  };
  for (let s = 0; s < w; s++) {
    const y0 = topF(s);
    if (y0 >= 199) continue;
    const dr = topF(s + 2) - y0, dl = topF(s - 2) - y0;
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
// The river: a tile of rows from the far bend (row RY0) to the bottom of the screen. Each pair of rows scrolls with
// its own parallax (far 0.1 .. 1 at the piers' feet .. faster in front), which makes the plane lie flat.
// Above the deck it mirrors the low golden sky; under the bridge it lies in shadow.
// ============================================================
const RY0 = 196, RW = 512;
const rowP = y => 0.10 + 0.9 * Math.pow((y - RY0) / 66, 1.5);
const RIV_UP = P('#ffd9a0', '#f2b690', '#d69a92', '#b88296', '#9c7098', '#85649a', '#73599a');
const RIV_DN = P('#9a74a0', '#74609c', '#564f92', '#434688', '#373e7e', '#2e3672', '#283068');
function riverBuf() {
  const b = buf(0, RY0, RW, H - RY0);
  for (let y = RY0; y < H; y++) for (let x = 0; x < RW; x++)
    put(b, x, y, y < 236 ? ramp(RIV_UP, Math.pow((y - RY0) / 40, 0.7), x, y, 0.2) : ramp(RIV_DN, (y - 238) / 30, x, y, 0.2));
  for (let y = RY0 + 1; y < H; y++) {
    const d = y - RY0, up = y < 236, n = Math.round(RW / (up ? 30 : 22));
    for (let i = 0; i < n; i++) {
      const x = Math.floor(nz(i, y * 3 + 1) * RW), len = 2 + Math.round(d * 0.14 * (0.4 + nz(i, y * 3 + 2))), light = nz(i, y * 3 + 3) > 0.5;
      const base = RIV_UP[Math.min(6, Math.round(Math.pow(d / 40, 0.7) * 6))];
      const c = up ? (light ? mixI(base, I('#ffe8c0'), 0.5) : mixI(base, I('#5a4688'), 0.4)) : (light ? I('#8f88c8') : I('#1e2658'));
      for (let k = 0; k < len; k++) put(b, wrap(x + k, RW), y, c);
    }
  }
  return b;
}
// the sun's glitter path: dashes thinning out away from its centre line (two phases, alternated)
function glitterBuf(ph) {
  const b = buf(-62, RY0, 124, H - RY0);
  for (let y = RY0 + 1; y < H; y++) {
    const d = y - RY0, hw = 2 + d * 0.46, under = y > 247;
    for (let x = -Math.ceil(hw); x <= hw; x++) {
      const u = Math.abs(x) / hw, run = nz((x + 200) >> (d > 22 ? 2 : 1), y * 5 + ph * 31);
      if (run < Math.pow(1 - u, 1.5) * (under ? 0.24 : 0.56)) put(b, x, y, nz(x, y + ph * 7) > 0.35 ? I('#fff8dc') : I('#ffe2a0'));
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

// ============================================================
// The gorge walls (parallax 0.18): strata, ledges and cracks lit from the right, jungle and palms on top, vines,
// a notch with a two-tier waterfall (the water itself is drawn live), mist at the river
// ============================================================
const PC = 0.18, MC = mockX(PC);
const FALL = { s: MC + 84, w: 12, y0: 110, mid: 156, base: 211 };
const CL_PTS = [[-130, 106], [-70, 98], [10, 96], [66, 100], [80, 101], [100, 114], [118, 118], [150, 120], [163, 142], [178, 147], [200, 150], [211, 176],
  [224, 183], [233, 200], [241, 216], [242, 999], [430, 999], [431, 216], [438, 198], [446, 172], [453, 165], [459, 140], [467, 120], [477, 113], [490, 117],
  [499, 140], [512, 152], [540, 148], [560, 122], [600, 102], [700, 97]];
function cliffTop(s) {
  const x = s - MC;
  let i = 0;
  while (i + 2 < CL_PTS.length && CL_PTS[i + 1][0] <= x) i++;
  const [xa, ya] = CL_PTS[i], [xb, yb] = CL_PTS[i + 1];
  if (ya > 900 || yb > 900) return 999;
  let y = lerp(ya, yb, ss(0.2, 0.8, clamp((x - xa) / (xb - xa), 0, 1)));
  y += (fbm(s / 7, 0, 31, 2) - 0.5) * 5 + Math.floor(fbm(s / 13, 0, 33, 2) * 3) * 2 - 2;
  if (s >= FALL.s && s < FALL.s + FALL.w) y = FALL.y0 + 1;
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
function cliffStrip() {
  const w = stripW(PC), top = 70, b = buf(0, top, w, 226 - top);
  const D = (x, y) => fbm(x / 30, y / 80, 41, 3) + 0.45 * fbm(x / 8, y / 26, 43, 2);
  const tops = new Int16Array(w + 8), bases = new Int16Array(w + 8);
  for (let s = -4; s < w + 4; s++) { tops[s + 4] = cliffTop(s); bases[s + 4] = cliffBase(s); }
  const T = s => tops[clamp(s, -4, w + 3) + 4], ledge = [];
  for (let s = 0; s < w; s++) {
    const t0 = T(s), base = bases[s + 4];
    if (t0 >= base) continue;
    const slope = T(s + 3) - T(s - 3), wob = 6 * fbm(s / 60, 0, 47, 2) + s * 0.03, crack = nz(s, 91) > 0.9;
    const df = Math.abs(s - (FALL.s + FALL.w / 2));
    for (let y = t0; y <= base; y++) {
      const d = y - t0, fm = wrap(y + wob, 5), j = Math.floor((y + wob) / 5);
      let t = 0.4 + (D(s - 1.5, y) - D(s + 1.5, y)) * 4.6 + (nz(j, 7) - 0.5) * 0.2;
      if (fm < 1 && nz(j, 9) > 0.3 && nz(s >> 3, j + 40) > 0.2) t -= 0.14;
      if (nz(j, 11) > 0.58 && nz((s + j * 13) >> 4, j + 60) > 0.34) {                   // a ledge (a broken run): lit lip, shadow under it
        if (fm < 1) { t += 0.36; if (d > 6 && nz(s, j + 70) > 0.955) ledge.push([s, y]); } else if (fm < 3) t -= 0.32;
      }
      if (d < 2) t += 0.25;
      if (d < 34) { if (slope > 4) t += 0.2 * (1 - d / 34); else if (slope < -4) t -= 0.16 * (1 - d / 34); }
      if (crack && fbm(s * 0.37, y / 18, 51, 2) > 0.5) t -= 0.22;
      let c = ramp(ROCK, t, s, y, 0.12);
      if (T(s + 1) > y) c = I('#ffd49a');                                              // the edge that faces the sun
      if (df < 16 && y > FALL.y0) c = mixI(c, I('#3a2a52'), (1 - df / 16) * 0.42);      // wet and dark round the falls
      put(b, s, y, c);
    }
  }
  // the shelf the first fall breaks on
  for (let s = FALL.s - 3; s < FALL.s + FALL.w + 3; s++) { put(b, s, FALL.mid + 1, ROCK[7]); put(b, s, FALL.mid + 2, ROCK[3]); put(b, s, FALL.mid + 3, ROCK[1]); }
  // vines hanging over the edge
  for (let s = 0; s < w; s++) {
    const t0 = T(s);
    if (t0 > 200 || nz(s, 57) < 0.78 || (s >= FALL.s - 1 && s <= FALL.s + FALL.w)) continue;
    const len = 4 + Math.round(nz(s, 58) * 20);
    for (let k = 0; k < len; k++) put(b, s + Math.round(Math.sin(k / 3 + s) * 0.6), t0 + k, k % 3 === 0 ? FOL[3] : k % 3 === 1 ? FOL[2] : FOL[1]);
  }
  // bushes on the ledges and the jungle along the top (farther clumps first)
  const veg = [];
  for (let s = 2; s < w; s += 3) {
    const t0 = T(s);
    if (t0 > 196 || (s >= FALL.s - 2 && s <= FALL.s + FALL.w + 1)) continue;
    const flat = Math.abs(T(s + 3) - T(s - 3)) < 9;
    if (flat && nz(s, 71) < 0.8) veg.push([s + nz(s, 72) * 2, t0 - 1 - nz(s, 73) * 2, 2.6 + nz(s, 74) * 3.4]);
    if (flat && nz(s, 75) > 0.7) veg.push([s, t0 - 6 - nz(s, 76) * 5, 4 + nz(s, 77) * 3.5]);
  }
  for (const [x, y] of ledge) if (Math.abs(x - FALL.s - 6) > 12) veg.push([x, y - 1, 1.6 + nz(x, y) * 1.6]);
  veg.sort((a, c) => a[1] - c[1]);
  for (const x of [-96, -62, -30, 4, 30, 56, 128, 146, 172, 194, 470, 486, 524, 556, 584, 626, 660]) { const s = x + MC, t0 = T(s); if (s > 4 && s < w - 4 && t0 < 200) palm(b, s, t0, 11 + Math.round(nz(s, 81) * 6), nz(s, 82) > 0.5 ? 1 : -1); }
  veg.forEach(([x, y, r], i) => clump(b, x, y, r, 900 + i * 7));
  // haze: everything sinks into the warm mist over the river
  for (let i = 0; i < b.d.length; i++) { const c = b.d[i]; if (c !== NONE) b.d[i] = mixI(c, MIST, 0.2 + 0.26 * ss(160, 212, Math.floor(i / b.w) + top)); }
  // the foot of the wall: a foam line and a dithered reflection on the water
  for (let s = 0; s < w; s++) {
    const t0 = T(s), base = bases[s + 4];
    if (t0 >= base) continue;
    if (nz(s >> 1, 95) > 0.6) put(b, s, base + 1, I('#f8e4d8'));
    if (nz(s >> 1, 96) > 0.82) put(b, s, base + 3, I('#e8c8c8'));
    for (let k = 2; k < 10; k++) if (bay(s, base + k) > 0.3 + k * 0.07) put(b, s + Math.round(Math.sin((base + k) * 1.3) * 1.2), base + k, mixI(I('#5c3c66'), I('#8a6a96'), k / 10));
  }
  return { img: bake(b), p: PC, top, h: b.h };
}
// falls: per column streak tiles, each column scrolled at its own speed
function fallTex() {
  const b = buf(0, 0, 16, 64);
  for (let i = 0; i < 16; i++) for (let y = 0; y < 64; y++) {
    const s = wrap(y + Math.floor(nz(i, 9) * 64), 16), e = nz(i, 13);
    const sh = i < 4 ? 1 : 0;
    put(b, i, y, s < 3 - sh * 2 ? I('#ffffff') : s < 8 - sh * 3 ? (e > 0.5 ? I('#fff0e2') : I('#f4dcdc')) : s < 12 - sh * 2 ? I('#d6c4e6') : I('#a89cd8'));
  }
  return bake(b);
}

// ============================================================
// The bridge (world space). One span is baked once and drawn for each of the five.
// ============================================================
const PANEL = 16;                                              // the arch is a polygon: straight members between panel points
const seg = f => x => { const a = Math.floor(x / PANEL) * PANEL; return lerp(f(a), f(a + PANEL), (x - a) / PANEL); };
const yLow = seg(x => 224 - 296 * (x / SPAN) * (1 - x / SPAN));   // lower chord (local x 0..SPAN): crown at y 150
const yUp = seg(x => 207 - 260 * (x / SPAN) * (1 - x / SPAN));    // upper chord: crown at y 142
const POST = P('#f6cc90', '#b87c48', '#7a4c2c');
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
  // the lattice between the chords and the hangers down to the railing: thin, behind the chords, no outline
  for (let k = 1; k < 16; k++) { const x = k * 16; for (let y = Math.round(yUp(x)) + 3; y < Math.round(yLow(x)); y++) putN(b, x, y, STEEL[4]); }
  for (let k = 0; k < 16; k++) {
    const xa = Math.max(11, k * 16), xb = Math.min(SPAN - 11, k * 16 + 16);
    if (k % 2 === 0) line(b, xa, yUp(xa) + 3, xb, yLow(xb) - 1, STEEL[3], 1, true); else line(b, xa, yLow(xa) - 1, xb, yUp(xb) + 3, STEEL[3], 1, true);
  }
  for (let k = 1; k < 8; k++) {
    const x = k * 32, y0 = Math.round(yLow(x)) + 3;
    for (let y = y0; y < 220; y++) { putN(b, x, y, STEEL[4]); putN(b, x + 1, y, STEEL[2]); }
    const ty = Math.round(lerp(y0, 220, 0.62));
    if (220 - y0 > 24) { rect(b, x - 1, ty, 4, 4, STEEL[3]); rect(b, x - 1, ty, 4, 1, STEEL[1]); put(b, x + 2, ty + 1, STEEL[0]); }
  }
  // the far railing: posts under the hangers, two sagging ropes
  const posts = [];
  for (let k = 1; k < 8; k++) posts.push(k * 32);
  const ends = [10, ...posts, SPAN - 10];
  for (let i = 0; i + 1 < ends.length; i++) {
    const a = ends[i] + 2, n = ends[i + 1] - 1 - a;
    for (let k = 0; k <= n; k++) {
      const u = k / n, s1 = Math.round(4 * u * (1 - u) * 3), s2 = Math.round(4 * u * (1 - u) * 2);
      put(b, a + k, 222 + s1, I('#f6dcaa')); put(b, a + k, 223 + s1, (a + k) % 3 ? I('#b08c60') : I('#8a6a48')); put(b, a + k, 227 + s2, I('#dcb888'));
    }
  }
  for (const x of posts) {
    rect(b, x - 1, 220, 4, 12, POST[1]); rect(b, x + 2, 220, 1, 12, POST[0]); rect(b, x - 1, 220, 1, 12, POST[2]);
    rect(b, x - 2, 218, 6, 2, POST[1]); rect(b, x - 2, 218, 6, 1, POST[0]); put(b, x - 2, 219, POST[2]);
  }
  return mk(b);
}
// A stone pylon at each spring: courses of blocks, a cornice, a lantern on top, steel shoes for the arches,
// and a little robot-army banner
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
  // the banner of the robot army
  rect(b, -4, 185, 8, 11, I('#2d2d3a')); rect(b, -4, 185, 8, 1, I('#56606e')); rect(b, 2, 186, 2, 10, I('#3c3c4c')); rect(b, -1, 189, 3, 2, I('#ff3b30')); put(b, -1, 189, I('#ffd0cc'));
  put(b, -1, 195, STONE[2]); put(b, 0, 195, STONE[2]); put(b, -1, 194, STONE[2]);
  outline(b);
  return mk(b);
}
// The deck (a tile as long as a span): plank ends with nails over a riveted girder, joist ends under it.
// Its top row is the walking line, GROUND.
function deckBuf() {
  const b = buf(0, GROUND, SPAN, 20);
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
    if (x % 16 >= 6 && x % 16 < 10) { put(b, x, GROUND + 16, x % 16 === 9 ? WOOD[2] : WOOD[4]); put(b, x, GROUND + 17, WOOD[5]); put(b, x, GROUND + 18, x % 16 === 9 || x % 16 === 6 ? NONE : OUTI); }
    if (x % 16 === 5 || x % 16 === 10) { put(b, x, GROUND + 16, OUTI); put(b, x, GROUND + 17, OUTI); }
  }
  // the army's stencil on the girder, once per span
  rect(b, 163, GROUND + 8, 31, 6, STEEL[3]);
  stencil(b, 165, GROUND + 8, 'RR-0731', I('#f4cc9c'));
  return bake(b);
}
// A stone pier under each pylon, standing in the river (water line y 262), with steel knee braces to the girder
const WATER_Y = 262;
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
  const b = buf(-32, GROUND + 15, 64, H - GROUND - 15);
  for (const d of [-1, 1]) for (let k = 0; k <= 16; k++) {
    const x = d * (13 + k), y = 259 - Math.round(k * 0.62);
    put(b, x, y, STEEL[2]); put(b, x, y + 1, STEEL[4]); if (k % 4 === 2) put(b, x, y, STEEL[0]);
  }
  for (let y = GROUND + 19; y < H; y++) {
    const hw = 11 + Math.round(ss(GROUND + 19, 268, y) * 3);
    for (let x = -hw; x < hw; x++) put(b, x, y, pierPx(x, y, hw));
  }
  rect(b, -14, GROUND + 16, 28, 3, STONE[2]); rect(b, -14, GROUND + 16, 28, 1, STONE[1]); rect(b, 12, GROUND + 17, 2, 2, STONE[0]); rect(b, -14, GROUND + 17, 2, 2, STONE[5]);
  // outline above the water only
  const add = [];
  for (let y = b.y0; y < WATER_Y; y++) for (let x = b.x0; x < b.x0 + b.w; x++) if (get(b, x, y) === NONE && (get(b, x - 1, y) !== NONE || get(b, x + 1, y) !== NONE || get(b, x, y - 1) !== NONE || get(b, x, y + 1) !== NONE)) add.push([x, y]);
  for (const [x, y] of add) put(b, x, y, OUTI);
  return mk(b);
}

// Stacked cargo crates. Each crate is a cell with shared 1px borders; the top border row is the platform's top.
const GLYPH = { R: ['##.', '#.#', '##.', '#.#', '#.#'], 0: ['###', '#.#', '#.#', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 3: ['###', '..#', '.##', '..#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], '-': ['...', '...', '###', '...', '...'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'], '^': ['..#..', '.###.', '#.#.#', '..#..', '..#..'] };
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
  const v = nz(seed, 311);
  if (kind === 0) {
    if (w === 16) { if (v > 0.5) stencil(b, x + 6, y + 6, '^', I('#8a3a2a')); else line(b, x + 3, y + h - 3, x + w - 3, y + 3, pal[4]); }
    else { stencil(b, x + 13, y + 6, '^', I('#8a3a2a')); stencil(b, x + 20, y + 6, 'X3', I('#6a4a30')); }
  } else if (kind === 1) {
    const ink = I('#f0ecc0');
    if (w === 16) { rect(b, x + 5, y + 6, 6, 4, I('#2d2d3a')); rect(b, x + 7, y + 7, 2, 2, I('#ff3b30')); put(b, x + 4, y + 7, I('#2d2d3a')); put(b, x + 11, y + 8, I('#2d2d3a')); }
    else {
      stencil(b, x + 12, y + 6, v > 0.5 ? 'RR-7' : 'RR-3', ink);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 12; j++) put(b, x + 3 + i, y + 3 + j, ((i + j) >> 1) % 2 ? I('#f1c40f') : OUTI);     // hazard end
    }
  } else {
    for (const sx of w === 16 ? [x + 4, x + 11] : [x + 6, x + 25]) { rect(b, sx, y + 1, 2, h - 1, I('#56606e')); rect(b, sx + 1, y + 1, 1, h - 1, I('#c3cdd8')); put(b, sx, y + 4, OUTI); put(b, sx, y + 11, OUTI); }
    if (w === 32) stencil(b, x + 11, y + 6, v > 0.5 ? '0731' : 'R-10', I('#e8d0a0'));
  }
}
function stackBuf(pl) {
  const x = pl.x, y = pl.y, w = pl.w, b = buf(x - 1, y - 1, w + 3, GROUND - y + 1);
  let n = 0;
  for (let yy = GROUND - 16, row = 0; yy >= y; yy -= 16, row++) for (let xx = x, i = 0; xx < x + w; i++) {
    // long and short crates staggered like bricks: olive army crates, pine and dark ones
    const big = xx + 32 <= x + w && (w % 32 === 0 ? row % 2 === 0 : (i + row) % 2 === 0), cw = big ? 32 : 16;
    crate(b, xx, yy, cw, big ? [1, 1, 0][row % 3] : row % 3 === 0 || i % 2 ? 2 : 0, x + 13 * n++);
    xx += cw;
  }
  // two ratchet straps over the whole stack, down to rings on the deck
  for (const sx of [x + 9, x + w - 4]) for (let yy = y + 1; yy < GROUND; yy++) {
    put(b, sx, yy, I('#b08a2a')); put(b, sx + 1, yy, I('#f4d060'));
    if ((yy - y) % 16 === 9) { rect(b, sx - 1, yy, 4, 3, I('#56606e')); rect(b, sx - 1, yy, 4, 1, I('#c3cdd8')); }
  }
  // the lid you stand on catches the light
  for (let xx = x + 1; xx < x + w; xx++) if (get(b, xx, y + 1) !== OUTI) put(b, xx, y + 1, I('#fff0c4'));
  // drop the bottom border: the deck line stays whole
  for (let xx = x - 1; xx < x + w + 2; xx++) put(b, xx, GROUND, NONE);
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
// The banks: rock under the sand at the bridge's start, a concrete and steel abutment at the robot base's end
function bankBuf(left) {
  const b = buf(-34, GROUND, 68, H - GROUND);
  if (left) {
    // the abutment under the first pylon: the piers' masonry, from under the sand's edge down into the river
    for (let y = GROUND + 5; y < H; y++) for (let x = -17; x < 13; x++) if (x < 0 || y > GROUND + 15) put(b, x, y, y === GROUND + 5 ? STONE[0] : y === GROUND + 6 ? STONE[2] : pierPx(x, y, 13));
    for (let y = GROUND + 5; y < WATER_Y; y++) { put(b, -18, y, OUTI); if (y > GROUND + 15) put(b, 13, y, OUTI); }
    // boulders at its foot
    for (const [bx, bw, bh, sd] of [[14, 11, 6, 511], [22, 9, 4, 513]]) for (let x = 0; x < bw; x++) {
      const u = (x - (bw - 1) / 2) / (bw / 2), hh = Math.max(1, Math.round(bh * Math.sqrt(Math.max(0, 1 - u * u)) * (0.7 + 0.4 * nz(x >> 1, sd))));
      for (let k = 0; k < hh; k++) put(b, bx + x, WATER_Y + 1 - k, k === hh - 1 ? I('#d08a70') : u > 0.3 ? I('#5e3c62') : I('#443058'));
      put(b, bx + x, WATER_Y + 2, I('#b8b4e0'));
    }
  } else {
    for (let y = GROUND; y < H; y++) for (let x = -8; x <= 12; x++) {
      let c = x >= 10 ? I('#3d454f') : x <= -7 ? I('#8a93a3') : (y - GROUND) % 9 === 8 ? I('#3d454f') : nz(x >> 1, y >> 1) > 0.8 ? I('#4b5560') : I('#59606e');
      if (y < GROUND + 4) c = ((x + 8 + y - GROUND) >> 2) % 2 ? I('#f1c40f') : OUTI;
      if (y >= WATER_Y) c = mixI(c, RIV_DN[4], 0.6);
      put(b, x, y, c);
    }
    for (let y = GROUND; y < WATER_Y; y++) put(b, -9, y, OUTI);
    for (const y of [GROUND + 8, GROUND + 17, GROUND + 26]) { put(b, -4, y, I('#c3cdd8')); put(b, 5, y, I('#c3cdd8')); }
  }
  return mk(b);
}

// The near railing in front of everything: a dark post against the light, and a rope (three sags for its sway)
const FGW = P('#f0a860', '#96583a', '#623a32', '#422832', '#2a1c2a');
function fgPostBuf() {
  const b = buf(-7, 0, 15, 24);
  for (let y = 3; y < 24; y++) for (let x = -4; x <= 4; x++) {
    let c = x === 4 ? FGW[0] : x === 3 ? FGW[1] : x <= -3 ? FGW[4] : nz(x, y >> 2) > 0.7 ? FGW[3] : FGW[2];
    if (y === 7 || y === 8) c = x >= 3 ? I('#c3a890') : y === 7 ? I('#4a4458') : IRON;
    put(b, x, y, c);
  }
  rect(b, -6, 0, 13, 3, FGW[2]); rect(b, -6, 0, 13, 1, FGW[0]); rect(b, 5, 1, 2, 2, FGW[0]); rect(b, -6, 1, 2, 2, FGW[4]);
  outline(b, I('#1c1220'));
  return mk(b);
}
const FG_SP = 96;
function fgRopeBuf(sag) {
  const b = buf(0, 0, FG_SP, sag + 5);
  for (let x = 0; x < FG_SP; x++) {
    const u = x / (FG_SP - 1), y = Math.round(4 * u * (1 - u) * sag);
    put(b, x, y, (x + y) % 4 === 0 ? I('#ffd9a0') : I('#d09a62')); put(b, x, y + 1, (x + y) % 4 === 2 ? FGW[2] : I('#8a5c40')); put(b, x, y + 2, FGW[3]);
  }
  return bake(b);
}
function glowSprite(r, col) {
  const c = canvasOf(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 1, r, r, r);
  gr.addColorStop(0, 'rgba(' + col + ',0.7)'); gr.addColorStop(0.35, 'rgba(' + col + ',0.28)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return c;
}

// ============================================================
// Building everything once, on first use
// ============================================================
let A = null, built = 0;
function build() {
  const a = {};
  a.sky = bake(skyBuf());
  a.sun = sunSprite(); a.rays = [raySprite(1), raySprite(2)];
  a.clouds = [[128, 1, CLOUD_LOW], [92, 2, CLOUD_HIGH], [70, 3, CLOUD_LOW], [150, 4, CLOUD_HIGH], [60, 5, CLOUD_HIGH], [104, 6, CLOUD_LOW]].map(([w, s, pal]) => mk(cloudBuf(w, s, pal)));
  const sA = mockX(0.03) + SUN.x, sB = mockX(0.06) + SUN.x, fA = ridge(11, 152, 14, 44, 64, 0.95), fB = ridge(17, 176, 16, 46, 58, 0.9);
  a.rangeA = mountains(0.03, 96, s => fA(s) + 10 * Math.exp(-(((s - sA) / 44) ** 2)), P('#f2bcae', '#d4a0b2', '#bf90b2', '#a984b2'), I('#ffd2a2'), 150, 200, 0.62, 13);
  a.rangeB = mountains(0.06, 110, s => fB(s) + 14 * Math.exp(-(((s - sB) / 50) ** 2)), P('#d6929c', '#b47c9a', '#99699c', '#805b98'), I('#f8be9a'), 162, 202, 0.7, 19);
  a.far = farCliffs();
  a.river = bake(riverBuf());
  a.glit = [glitterBuf(0), glitterBuf(1)];
  a.cliff = cliffStrip();
  a.fall = fallTex();
  a.rocks = [];
  // rocks: [mock screen x, foot row, w, h]; each scrolls with the parallax of its row
  const R0 = [[262, 207, 9, 4], [318, 212, 14, 6], [440, 209, 8, 3], [168, 222, 16, 7], [414, 224, 20, 8], [70, 219, 12, 5], [258, 258, 22, 9], [92, 264, 18, 7], [430, 266, 24, 9]];
  for (let k = 0; k < 14; k++) R0.push([540 + k * 97 + Math.round(nz(k, 601) * 50), k % 3 === 2 ? 256 + Math.round(nz(k, 602) * 10) : 206 + Math.round(nz(k, 603) * 20), 9 + Math.round(nz(k, 604) * 12), 4 + Math.round(nz(k, 605) * 5)]);
  for (let k = 0; k < 6; k++) R0.push([-90 - k * 83, k % 2 ? 260 : 210 + k * 3, 10 + k * 2, 4 + (k % 3)]);
  R0.forEach(([mx, y, w, h], i) => { const p = rowP(y); a.rocks.push({ x: mx + (MOCK - CAM0) * p, y, p, w, s: rockBuf(w, h, 700 + i * 3, y > 240) }); });
  const mb = canvasOf(1, 16), mg = mb.getContext('2d'), gr = mg.createLinearGradient(0, 0, 0, 16);
  gr.addColorStop(0, 'rgba(255,226,170,0)'); gr.addColorStop(0.45, 'rgba(255,230,178,0.75)'); gr.addColorStop(1, 'rgba(255,226,170,0)');
  mg.fillStyle = gr; mg.fillRect(0, 0, 1, 16);
  a.mistBand = mb;
  a.span = spanBuf(); a.pylon = pylonBuf(); a.deck = deckBuf(); a.pier = pierBuf();
  a.sign = signBuf(); a.bankL = bankBuf(true); a.bankR = bankBuf(false);
  a.fgPost = fgPostBuf(); a.fgRope = [7, 8, 9].map(fgRopeBuf);
  a.glow = glowSprite(24, '255,208,120');
  a.stacks = new Map();
  a.buf = canvasOf(W + 20, H + 20);
  a.bufG = a.buf.getContext('2d'); a.bufG.imageSmoothingEnabled = false; a.bufG.translate(10, 10);
  A = a;
}
function ready() {
  if (!built) { built = -1; try { build(); built = 1; } catch (err) { errorOnce(err); } }
  return built === 1;
}

// ============================================================
// drawBG: the whole background (screen space), into g
// ============================================================
// clouds: [sprite, x and y in the proposal frame, parallax, drift px/frame]
const CLOUDS = [[3, 318, 14, 0.035, 0.022], [4, 132, 30, 0.03, 0.018], [1, 14, 64, 0.045, 0.03], [0, 226, 76, 0.05, 0.035], [2, 408, 98, 0.04, 0.026], [5, -150, 84, 0.05, 0.035]];
const FLOCK = [[0, 0], [8, -3], [9, 3], [17, -6], [18, 6], [27, -8], [29, 9]];
function scene(g, cx) {
  const t = G.t;
  g.drawImage(A.sky, -10, -10);
  if (Math.floor(t / 24) % 3 === 0) { g.fillStyle = '#fff8e0'; g.fillRect(51, 46, 3, 1); g.fillRect(52, 45, 1, 3); }
  const sunX = SUN.x - Math.round((cx - MOCK) * 0.012), sunY = SUN.y + Math.round((cx - MOCK) * 0.012);
  const rk = 0.5 + 0.5 * Math.sin(t * 0.013);
  g.globalAlpha = 0.5 + 0.5 * rk; g.drawImage(A.rays[0], sunX - 260, sunY - 240);
  g.globalAlpha = 1 - 0.5 * rk; g.drawImage(A.rays[1], sunX - 260, sunY - 240);
  g.globalAlpha = 1;
  g.drawImage(A.sun, sunX - 72, sunY - 72);
  for (const [i, mx, y, p, v] of CLOUDS) blit(g, A.clouds[i], wrap(mx + 170 - (cx - MOCK) * p - (t - T0) * v, W + 340) - 170, y);
  // a flock heading home, left along the gorge
  const fx = wrap(300 + 40 - (cx - MOCK) * 0.04 - (t - T0) * 0.14, W + 80) - 40, fy = 124 + Math.sin(t * 0.011) * 3;
  g.fillStyle = '#4a3058';
  FLOCK.forEach(([dx, dy], i) => {
    const x = Math.round(fx + dx), y = Math.round(fy + dy + Math.sin(t * 0.03 + i * 1.7)), f = Math.floor((t + i * 5) / 7) % 4;
    g.fillRect(x - 1, y, 3, 1);
    if (f === 0) { g.fillRect(x - 2, y - 1, 1, 1); g.fillRect(x + 2, y - 1, 1, 1); g.fillRect(x - 3, y - 2, 1, 1); g.fillRect(x + 3, y - 2, 1, 1); }
    else if (f === 2) { g.fillRect(x - 2, y + 1, 1, 1); g.fillRect(x + 2, y + 1, 1, 1); }
    else { g.fillRect(x - 3, y - 1, 2, 1); g.fillRect(x + 2, y - 1, 2, 1); }
  });
  blitStrip(g, A.rangeA, cx); blitStrip(g, A.rangeB, cx); blitStrip(g, A.far, cx);
  river(g, cx, RY0);
  g.drawImage(A.mistBand, 0, 0, 1, 16, -10, RY0 - 8, W + 20, 16);
  blit(g, A.glit[Math.floor(t / 9) % 2], sunX, 0);
  sparkles(g, cx, sunX);
  for (const r of A.rocks) {
    if (r.y > 240) continue;
    const x = Math.round(r.x - (cx - CAM0) * r.p);
    if (x > -40 && x < W + 20) { blit(g, r.s, x, r.y); g.fillStyle = '#fffaf0'; g.fillRect(x - 3 + (Math.floor(t / 10 + r.w) % 3), r.y + 1, 3, 1); g.fillRect(x + r.w - 2 - (Math.floor(t / 13 + r.w) % 2), r.y + 1, 4, 1); }
  }
  // mist drifting low over the far water
  for (let i = 0; i < 7; i++) {
    const u = wrap(t * 0.0009 * (1 + (i % 3) * 0.3) + hsh(i * 3.7), 1), x = wrap(u * (W + 240) - (cx - CAM0) * 0.14 + i * 90, W + 240) - 120;
    g.globalAlpha = 0.16 + 0.1 * Math.sin(t * 0.01 + i);
    g.fillStyle = '#ffe9c4';
    for (let k = 0; k < 5; k++) pdisc(g, x + k * 13 - 26, 201 + (i % 3) * 3 + Math.sin(k * 2 + i) * 1.5, 5 + ((k * 7 + i) % 3) * 1.5);
  }
  g.globalAlpha = 1;
  blitStrip(g, A.cliff, cx);
  waterfall(g, cx);
  nearRocks(g, cx);
}
// the river, row pair by row pair, from row y0 down
function river(g, cx, y0) {
  for (let y = y0; y < H; y += 2) {
    const p = rowP(y), off = wrap(Math.floor((cx - CAM0) * p + G.t * 0.07 * p), RW), n = Math.min(RW - off, W + 20), sy = y - RY0;
    g.drawImage(A.river, off, sy, n, 2, -10, y, n, 2);
    if (n < W + 20) g.drawImage(A.river, 0, sy, W + 20 - n, 2, -10 + n, y, W + 20 - n, 2);
  }
  g.drawImage(A.river, 0, H - RY0 - 1, W + 20, 1, -10, H, W + 20, 10);   // the margin a screen shake can show
}
// rocks under and in front of the bridge
function nearRocks(g, cx) {
  const t = G.t;
  for (const r of A.rocks) {
    if (r.y <= 240) continue;
    const x = Math.round(r.x - (cx - CAM0) * r.p);
    if (x > -40 && x < W + 20) { blit(g, r.s, x, r.y); g.fillStyle = '#c8c4ec'; g.fillRect(x - 4 + (Math.floor(t / 10 + r.w) % 3), r.y + 1, 4, 1); g.fillRect(x + r.w - 1 - (Math.floor(t / 13 + r.w) % 2), r.y + 1, 5, 1); }
  }
}
// twinkles on the glitter path, scattered glints, slow wave lines
function sparkles(g, cx, sunX) {
  const t = G.t;
  for (let i = 0; i < 24; i++) {
    const cyc = 9 + (i % 7), ph = Math.floor((t + i * 5) / cyc), life = (t + i * 5) % cyc;
    if (life > cyc - 3) continue;
    const y = Math.round(RY0 + 2 + Math.pow(hsh(i * 13.1 + ph * 0.37), 1.4) * (i % 4 === 0 ? 70 : 34)), spread = 3 + (y - RY0) * 0.5;
    const x = Math.round(sunX + (hsh(i * 7.7 + ph * 1.3) - 0.5) * 2 * spread);
    g.fillStyle = life < 2 ? '#ffffff' : '#fff0c0';
    g.fillRect(x, y, y > RY0 + 12 ? 2 : 1, 1);
    if (life === 1 && i % 3 === 0) { g.fillRect(x - 1, y, 4, 1); g.fillRect(x, y - 1, 1, 3); }
  }
  for (let i = 0; i < 16; i++) {
    const cyc = 14 + (i % 5), ph = Math.floor((t + i * 11) / cyc), life = (t + i * 11) % cyc;
    if (life > 4) continue;
    const y = Math.round(RY0 + 3 + hsh(i * 3.1 + ph) * 70);
    g.fillStyle = y > 240 ? '#b8b4f0' : '#fffdf0';
    g.fillRect(Math.round(wrap(hsh(i * 5.3 + ph * 0.71) * 900 - (cx - CAM0) * rowP(y), W + 20) - 10), y, life === 2 ? 2 : 1, 1);
  }
  for (let i = 0; i < 12; i++) {
    const u = (t * 0.004 + hsh(i * 2.7)) % 1, y = Math.round(RY0 + 4 + hsh(i * 9.3) * 68), len = 3 + Math.round((y - RY0) / 5);
    const x = Math.round(wrap(hsh(i * 4.1) * 900 - (cx - CAM0) * rowP(y) - u * 30, W + 60) - 30);
    g.fillStyle = y > 240 ? 'rgba(150,146,214,' + (0.6 * Math.sin(u * Math.PI)).toFixed(2) + ')' : 'rgba(255,250,226,' + (0.7 * Math.sin(u * Math.PI)).toFixed(2) + ')';
    g.fillRect(x, y, len, 1);
  }
}
function waterfall(g, cx) {
  const x0 = FALL.s - 10 - stripOff(PC, cx), t = G.t;
  if (x0 < -40 || x0 > W + 30) return;
  for (let i = 0; i < FALL.w; i++) tileY(g, A.fall, i, 64, x0 + i, FALL.y0, FALL.mid + 1, t * (1.5 + hsh(i * 3.3) * 0.9));
  for (let i = 0; i < 16; i++) tileY(g, A.fall, i, 64, x0 - 2 + i, FALL.mid + 2, FALL.base, t * (2.1 + hsh(i * 5.1) * 1.2));
  // shaded edges, the lip rolling over, spray on the shelf
  g.fillStyle = '#a69cd4';
  g.fillRect(x0, FALL.y0 + 6, 1, FALL.mid - FALL.y0 - 5); g.fillRect(x0 - 2, FALL.mid + 8, 1, FALL.base - FALL.mid - 8);
  for (let x = x0; x < x0 + FALL.w; x++) { g.fillStyle = (x + (t >> 2)) % 3 ? '#fff6ea' : '#c8bce0'; g.fillRect(x, FALL.y0 - 1, 1, 1); }
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 9; i++) {
    const ph = (t * 0.05 + hsh(i * 4.1)) % 1, a = -Math.PI / 2 + (hsh(i * 2.3) - 0.5) * 2.4, v = 0.7 + hsh(i * 6.7);
    g.fillRect(Math.round(x0 + FALL.w / 2 + Math.cos(a) * v * ph * 11), Math.round(FALL.mid + Math.sin(a) * v * ph * 9 + 0.1 * (ph * 9) * (ph * 9)), 1, 1);
  }
  g.fillRect(x0 - 2, FALL.mid, FALL.w + 4, 1); g.fillRect(x0 - 3, FALL.mid + 1, FALL.w + 5, 1);
  // foam and mist where it lands
  const fx = x0 + 6;
  g.fillRect(fx - 12, FALL.base - 1, 25, 2); g.fillStyle = '#fff0dc'; g.fillRect(fx - 17, FALL.base + 1, 35, 1); g.fillRect(fx - 9, FALL.base - 2, 18, 1);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 12; i++) {
    const ph = (t * 0.04 + hsh(i * 4.7)) % 1, a = -Math.PI / 2 + (hsh(i * 2.9) - 0.5) * 2.7, v = 0.8 + hsh(i * 6.1);
    const Y = Math.round(FALL.base - 1 + Math.sin(a) * v * ph * 16 + 0.09 * (ph * 16) * (ph * 16));
    if (Y <= FALL.base) g.fillRect(Math.round(fx + Math.cos(a) * v * ph * 18), Y, 1, 1);
  }
  g.fillStyle = '#fff2e0';
  for (let i = 0; i < 7; i++) {
    const ph = (t * 0.006 + i / 7) % 1;
    g.globalAlpha = 0.34 * (1 - ph);
    pdisc(g, fx - 10 + hsh(i * 3.9) * 20 + ph * 14, FALL.base - 3 - ph * 30, 3 + ph * 7);
  }
  g.globalAlpha = 1;
}

const oldBG = L.drawBG, oldBehind = L.drawBehind, oldGround = L.drawGround, oldPlat = L.drawPlat, oldFront = L.drawFront;
L.drawBG = function (cx) {
  const w = weightAt(cx);
  if (!ready()) return oldBG(cx);
  if (w >= 1) return scene(ctx, cx);
  oldBG(cx);
  if (w > 0) {
    scene(A.bufG, cx);
    ctx.globalAlpha = ss(0, 1, w); ctx.drawImage(A.buf, -10, -10); ctx.globalAlpha = 1;
  }
  // under the deck the river is always whole (the neighbours' ground covers the rest)
  if (cx + W > BX0 - 12 && cx < BX1 + 12) { river(ctx, cx, GROUND + 2); nearRocks(ctx, cx); }
};

// ============================================================
// drawBehind, drawGround, drawPlat (world space)
// ============================================================
const SPRINGS = [0, 1, 2, 3, 4, 5].map(k => BX0 + k * SPAN);
const SIGN = L.decor.find(d => d.t === 'sign' && d.s === 'BRIDGE') || { x: 3020 };
// the original decor without its truss and BRIDGE sign (re-filtered only when the list itself is another one)
let decorSrc = null, decorRest = null;
function restDecor() {
  if (L.decor !== decorSrc) { decorSrc = L.decor; decorRest = decorSrc.filter(d => d.t !== 'truss' && !(d.t === 'sign' && d.s === 'BRIDGE')); }
  return decorRest;
}
L.drawBehind = function (cx) {
  if (cx + W < SIGN.x - 40 || cx > BX1 + 30 || !ready()) return oldBehind(cx);
  const keep = L.decor;
  L.decor = restDecor();
  try { oldBehind(cx); } finally { L.decor = keep; }
  const t = G.t;
  if (SIGN.x > cx - 40) { blit(ctx, A.sign, SIGN.x, GROUND); text('BRIDGE', SIGN.x, GROUND - 35, '#5a2416', 1, 'center', null); }
  for (let k = 0; k < 5; k++) { const x = SPRINGS[k]; if (x + SPAN > cx - 4 && x < cx + W + 4) blit(ctx, A.span, x, 0); }
  for (const x of SPRINGS) if (x > cx - 30 && x < cx + W + 30) blit(ctx, A.pylon, x, 0);
  // the lamps are coming on
  for (let k = 0; k < 11; k++) {
    const x = BX0 + k * SPAN / 2, y = k % 2 ? 160 : 159;
    if (x < cx - 30 || x > cx + W + 30) continue;
    ctx.globalAlpha = 0.72 + 0.2 * Math.sin(t * 0.13 + k * 2.1) + (hsh(k + Math.floor(t / 7)) > 0.9 ? -0.15 : 0);
    ctx.drawImage(A.glow, x - 24, y - 24);
  }
  ctx.globalAlpha = 1;
};

let groundSrc = null, groundRest = null;
L.drawGround = function (cx) {
  if (cx + W < BX0 - 40 || cx > BX1 + 40 || !ready()) return oldGround(cx);
  const keep = L.grounds;
  if (keep !== groundSrc) { groundSrc = keep; groundRest = keep.filter(s => s[2] !== 'bridge'); }
  L.grounds = groundRest;
  try { oldGround(cx); } finally { L.grounds = keep; }
  const t = G.t;
  // piers, then the foam round their feet
  for (let k = 1; k < 5; k++) {
    const x = SPRINGS[k];
    if (x < cx - 40 || x > cx + W + 40) continue;
    blit(ctx, A.pier, x, 0);
    const f = Math.floor(t / 9 + k) % 3;
    R(x - 17 - f, WATER_Y, 9, 1, '#e8e6ff'); R(x + 8 + f, WATER_Y, 10, 1, '#e8e6ff'); R(x - 13, WATER_Y - 1, 5, 1, '#ffffff'); R(x + 9, WATER_Y - 1, 4, 1, '#ffffff');
    R(x - 24 - f * 2, WATER_Y + 2, 7, 1, '#9a96d8'); R(x + 16 + f * 2, WATER_Y + 3, 8, 1, '#9a96d8'); R(x - 6 + f, WATER_Y + 1, 5, 1, '#c8c4f0');
  }
  // the deck
  const xa = Math.max(BX0, Math.floor(cx) - 12), xb = Math.min(BX1, Math.ceil(cx) + W + 12);
  for (let x = xa; x < xb;) { const tx = wrap(x - BX0, SPAN), n = Math.min(SPAN - tx, xb - x); ctx.drawImage(A.deck, tx, 0, n, 20, x, GROUND, n, 20); x += n; }
  if (BX0 > cx - 40 && BX0 < cx + W + 40) blit(ctx, A.bankL, BX0, 0);
  if (BX1 > cx - 40 && BX1 < cx + W + 40) blit(ctx, A.bankR, BX1, 0);
};

L.drawPlat = function (pl) {
  if (pl.t !== 'crates' || pl.x < BX0 || pl.x + pl.w > BX1 || !ready()) return oldPlat(pl);
  let s = A.stacks.get(pl);
  if (!s) { s = stackBuf(pl); A.stacks.set(pl, s); }
  ctx.drawImage(s.img, s.x0, s.y0);
};

// ============================================================
// drawFront (screen space, parallax 1.3): the near railing. The original foreground of the other areas is kept.
// ============================================================
const areaOfX = x => x < 1600 ? 0 : x < 3020 ? 1 : x < 4380 ? 2 : 3;
L.drawFront = function (cx) {
  if (!ready()) return oldFront(cx);
  // the original items that do not belong to the bridge (same positions as level1.js drawForeground), through a clip
  const off0 = cx * 1.3;
  let any = false;
  for (let i = Math.floor((off0 - 80) / 90); i * 90 - off0 < W + 80; i++) {
    if (hsh(i + 3) < 0.35) continue;
    const x = Math.round(i * 90 + hsh(i) * 40 - off0);
    if (areaOfX(cx + x) === 2) continue;
    if (!any) { ctx.save(); ctx.beginPath(); any = true; }
    ctx.rect(x - 30, H - 44, 80, 54);
  }
  if (any) { ctx.clip(); oldFront(cx); ctx.restore(); }
  const off = cx * 1.3, t = G.t;
  for (let i = Math.floor((off - FG_SP) / FG_SP); i * FG_SP - off < W + 10; i++) {
    const x = Math.round(i * FG_SP - off), wx = cx + x;
    if (wx < BX0 - 30 || wx > BX1 + 20) continue;
    if (wx + FG_SP <= BX1 + 20) ctx.drawImage(A.fgRope[1 + Math.round(Math.sin(t * 0.035 + i * 1.9))], x, H - 18);
    blit(ctx, A.fgPost, x, H - 22);
  }
};

// ============================================================
// The proposal frame: a real moment on the bridge, pinned every update so the picture does not depend on timing.
// Only when the mission was built at the mock camera (--x 3400); at any other start the game plays as usual.
// ============================================================
let staged = false;
const oldLoad = L.load, oldUpdate = L.update;
L.load = function (cp) {
  if (oldLoad) oldLoad.call(L, cp);
  staged = Math.abs(cp - (3400 - W * 0.42)) < 1;
  if (staged) G.big = null;
};
L.update = function () {
  if (oldUpdate) oldUpdate.call(L);
  if (!staged || LV !== L) return;
  const p = G.p;
  G.cam.x = MOCK + 0.4;
  // the hero runs along the deck, machine gun blazing
  Object.assign(p, { x: 3410, y: GROUND, vx: 1.7, vy: 0, onGround: true, onPlat: null, facing: 1, aim: 'fwd', crouch: false, knife: 0, muzzle: 3, t: 16,
    weapon: 'hmg', ammo: 137, bombs: 8, hearts: 3, inv: 0, dead: 0, kb: 0, ride: null, hidden: false });
  G.lives = 3; G.score = 23650; G.shake = 0;
  G.big = null; G.banner = { s: 'AREA 3: THE BIG BRIDGE', t: 100 };
  const sol = G.enemies.filter(e => e.type === 'soldier'), dro = G.enemies.filter(e => e.type === 'drone');
  const big = L.plats.find(pl => pl.x === 3520);
  if (sol[0]) Object.assign(sol[0], { x: 3502, y: GROUND, vy: 0, onGround: true, onPlat: null, facing: -1, state: 'walk', moving: true, t: 15, cd: 90, hitT: 0, hp: 2, active: true });
  if (sol[1]) Object.assign(sol[1], { x: 3546, y: big ? big.y : 184, vy: 0, onGround: true, onPlat: big || null, facing: -1, state: 'aim', st: 2, moving: false, t: 22, hitT: 0, hp: 2, active: true });
  if (dro[0]) Object.assign(dro[0], { x: 3392, y: 110, facing: 1, cd: 100, t: 31, hitT: 0, hp: 2, active: true, offX: -24 });
  if (dro[1]) Object.assign(dro[1], { x: 3622, y: 88, facing: -1, cd: 20, t: 12, hitT: 0, hp: 2, active: true, offX: 30 });
  for (const o of G.pows) if (o.state === 'tied') o.t = 10;                    // HELP! is showing
  // machine-gun rounds on their way, sparks where the last one hit, a spent shell
  G.pb = [{ x: 3446, y: 213, vx: 7, vy: 0.1, dmg: 1, life: 60, draw: hmgShot }, { x: 3474, y: 212, vx: 7, vy: -0.1, dmg: 1, life: 60, draw: hmgShot }];
  G.parts = [];
  for (const [dx, dy] of [[-3, -3], [-6, 1], [-2, 4], [-8, -5], [-5, 6], [-1, -7]]) G.parts.push({ type: 'spark', x: 3494 + dx, y: 213 + dy, vx: 0, vy: 0, life: 10, max: 16, size: 1, c: '#ffe066' });
  G.parts.push({ type: 'spark', x: 3493, y: 212, vx: 0, vy: 0, life: 10, max: 16, size: 2, c: '#ffffff' });
  G.parts.push({ type: 'debris', x: 3403, y: 204, vx: 0, vy: 0, life: 30, max: 40, size: 2, c: '#e8b43a' }, { type: 'debris', x: 3396, y: 197, vx: 0, vy: 0, life: 30, max: 40, size: 2, c: '#e8b43a' });
  // the soldier on the crates has just fired; the first drone's bomb is falling
  G.eb = [{ k: 'laser', x: 3482, y: 187, vx: -1.94, vy: 0.8, r: 3, life: 200 }, { k: 'bomb', x: 3392, y: 127, vx: 0, vy: 0.9, g: 0.09, r: 3, life: 200, shoot: true }];
  G.grenades = []; G.items = []; G.texts = []; G.rings = [];
};
}
