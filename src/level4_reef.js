'use strict';
// ============================================================
// Mission 4, AREA 1: CORAL GARDEN (world x 0-1700): sunny turquoise shallows just under the surface.
// L4ART.reef (contract: tools/m4polish/build-contract.md; joined into L4's hooks by level4_scenery.js):
//  bg(g, cx)    a sky cutaway above the waterline (y 40) with the far islands and Volcano Island smoking on the
//               horizon, the water (16 dithered depth steps), light shafts, a silvery bait ribbon, a far eagle ray,
//               three hazy reef walls (tall far pinnacles, mid coral heads with arches, a near ridge with muted corals),
//               a sea turtle, a shoal of yellow tangs, the rippling surface (crests, the bright mirror line, caustics)
//  behind(cx)   the reef bed: reef heads (rock, lacy sea fans, staghorn, labyrinth brain corals, tables, tube sponges),
//               low pieces in the sand, giant clams, the old diving bell (x 240), anemones with clownfish, chromis,
//               bubbles from the bell; the heroes' dive boat moored at the surface over the bell (x 150)
//  ground(cx)   pale sand: rippled top, a banked face with strata, shells, pebbles, starfish, weed, contact shadows,
//               a drift round the bell and one at the east end (1700); caustics dancing on it
//  front(cx)    a low dark rubble band along the very bottom (parallax 1.25)
//  overlay(cx)  drifting motes, bubbles rising to the surface, glints on the waterline
// Extras: L4ART.reef.paint.* (the same painters with a waterline argument, for the opening scene in level4_intro.js),
// .hide (the intro paints the whole split view itself: the joiner's calls do nothing meanwhile), .boat(cx, wl, o),
// .bubble, .WL, .BOAT_X, .BELL_X; L4ART.card(x, y, w, h): the mission card (a slice of the reef, the hero diver
// squaring up to a robot octopus).
// Static art is painted pixel by pixel into buffers and baked once in `steps`; only small bits move with G.t.
// Never Math.random / rand: textures from a private hash table, layout from a private seeded stream.
// ============================================================
var L4ART = L4ART || {};
var L4 = L4 || {};
{
// a local Math: the harness runs the game in a Node vm context where every global-object lookup is slow (no effect
// in the browser, but it keeps the bake quick in tests)
const Math = globalThis.Math;
const TAU = Math.PI * 2;

// ============================================================
// Helpers: easing, noise, a private random stream, colours, pixel buffers
// ============================================================
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (v, m) => ((v % m) + m) % m;
let NZT = null;
function makeNZT() {
  let a = 774411;
  NZT = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    NZT[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
const nz = (x, y) => NZT[((Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0) & 65535];
function vn(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = (s | 0) * 977;
  return lerp(lerp(nz(i + o, j), nz(i + 1 + o, j), a), lerp(nz(i + o, j + 1), nz(i + 1 + o, j + 1), a), b);
}
function fbm(x, y, s, oct = 3) {
  let v = 0, a = 1, n = 0, f = 1;
  for (let o = 0; o < oct; o++) { v += a * vn(x * f, y * f, s + o * 13); n += a; a *= 0.5; f *= 2.03; }
  return v / n;
}
let seed = 1;
const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const rr = (a, b) => a + rnd() * (b - a);
const pick = a => a[Math.floor(rnd() * a.length)];
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const RGBS = {};
const rgbOf = c => RGBS[c] || (RGBS[c] = hex(c));
const pk = (r, g, b, a) => (LE ? (a << 24) | (b << 16) | (g << 8) | r : (r << 24) | (g << 16) | (b << 8) | a) >>> 0;
const unpk = v => LE ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24] : [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
function P(c, a) { const v = rgbOf(c); return pk(v[0], v[1], v[2], a == null ? 255 : a); }
function mixPk(v, C, m) { const [r, g, b, a] = unpk(v); return pk(Math.round(r + (C[0] - r) * m), Math.round(g + (C[1] - g) * m), Math.round(b + (C[2] - b) * m), a); }
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const SPD = new Map();
function sprData(s) { let d = SPD.get(s); if (!d) { d = s.img.getContext('2d').getImageData(0, 0, s.w, s.h).data; SPD.set(s, d); } return d; }

// A pixel buffer: (x, y) is painted at buffer column x + ox, row y - top. 0 = empty.
class Pix {
  constructor(w, h, top = 0, ox = 10) { this.w = Math.ceil(w); this.h = Math.ceil(h); this.top = top; this.ox = ox; this.d = new Uint32Array(this.w * this.h); }
  rect(x, y, w, h, c) {
    x = Math.round(x) + this.ox; y = Math.round(y) - this.top;
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + Math.round(w)), y1 = Math.min(this.h, y + Math.round(h));
    if (x1 <= x0) return;
    for (let r = y0; r < y1; r++) this.d.fill(c, r * this.w + x0, r * this.w + x1);
  }
  dot(x, y, c) {
    x = Math.round(x) + this.ox; y = Math.round(y) - this.top;
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.d[y * this.w + x] = c;
  }
  get(x, y) {
    x = Math.round(x) + this.ox; y = Math.round(y) - this.top;
    return x >= 0 && x < this.w && y >= 0 && y < this.h ? this.d[y * this.w + x] : 0;
  }
  disc(cx, cy, r, c, maxY) {
    if (r < 0.5) { this.dot(cx, cy, c); return; }
    const R = r + 0.5, n = Math.floor(r), x = Math.round(cx), y = Math.round(cy);
    for (let dy = -n; dy <= n; dy++) { if (maxY != null && y + dy > maxY) break; const hw = Math.floor(Math.sqrt(R * R - dy * dy)); this.rect(x - hw, y + dy, hw * 2 + 1, 1, c); }
  }
  ell(cx, cy, rx, ry, c) {
    const n = Math.floor(ry), x = Math.round(cx), y = Math.round(cy);
    for (let dy = -n; dy <= n; dy++) { const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)) + 0.3); this.rect(x - hw, y + dy, hw * 2 + 1, 1, c); }
  }
  line(x0, y0, x1, y1, c, t = 1) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1, o = (t - 1) / 2;
    for (let i = 0; i <= n; i++) this.rect(Math.round(lerp(x0, x1, i / n) - o), Math.round(lerp(y0, y1, i / n) - o), t, t, c);
  }
  poly(pts, c) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const xs = [];
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const sy = y + 0.5; xs.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[j];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + (sy - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) { const a = Math.round(xs[k]), b = Math.round(xs[k + 1]); if (b > a) this.rect(a, y, b - a, 1, c); }
    }
  }
  fill(x0, x1, f, c) { for (let x = Math.floor(x0); x < x1; x++) { const y = Math.round(f(x)); this.rect(x, y, 1, this.top + this.h - y, c); } }
  sprite(s, x, y) {
    const d = sprData(s);
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) { const k = (j * s.w + i) * 4; if (d[k + 3] > 0) this.dot(x + i, y + j, pk(d[k], d[k + 1], d[k + 2], 255)); }
  }
  // light from the upper left: painted pixels on an open top edge get hi, open left edge lit, open right / bottom dark
  shade(hi, lit, dark, only) {
    const s = this.d.slice(), w = this.w, h = this.h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, v = s[i];
      if (!v || (only && v !== only)) continue;
      const Lf = x > 0 ? s[i - 1] : 0, Rt = x < w - 1 ? s[i + 1] : 0, U = y > 0 ? s[i - w] : 0, D = y < h - 1 ? s[i + w] : 0;
      if (hi && !U) this.d[i] = hi; else if (lit && !Lf) this.d[i] = lit; else if (dark && (!Rt || !D)) this.d[i] = dark;
    }
  }
  outline(c) {
    const s = this.d, w = this.w, h = this.h, add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (s[i]) continue;
      if ((x > 0 && s[i - 1]) || (x < w - 1 && s[i + 1]) || (y > 0 && s[i - w]) || (y < h - 1 && s[i + w])) add.push(i);
    }
    for (const i of add) s[i] = c;
    return this;
  }
  // copy the painted pixels onto another buffer, this buffer's (0, 0) at (x, y) there
  stamp(dst, x, y) {
    x = Math.round(x); y = Math.round(y);
    for (let r = 0; r < this.h; r++) for (let q = 0; q < this.w; q++) { const v = this.d[r * this.w + q]; if (v) dst.dot(x + q - this.ox, y + r + this.top, v); }
  }
  // the topmost painted y of a column (local coordinates), or 0
  topAt(x) { const q = Math.round(x) + this.ox; if (q < 0 || q >= this.w) return 0; for (let r = 0; r < this.h; r++) if (this.d[r * this.w + q]) return r + this.top; return 0; }
  // mix every painted pixel toward the colour fc(y) (rgb array) by k(y): haze, water
  hazeRows(fc, k) {
    const d = this.d;
    for (let r = 0; r < this.h; r++) {
      const y = r + this.top, m = typeof k === 'function' ? k(y) : k;
      if (m <= 0) continue;
      const C = fc(y);
      let lv = 0, lr = 0;
      for (let i = r * this.w, e = i + this.w; i < e; i++) { const v = d[i]; if (!v) continue; if (v === lv) { d[i] = lr; continue; } lv = v; lr = d[i] = mixPk(v, C, m); }
    }
    return this;
  }
  canvas() {
    const c = canvasOf(this.w, this.h), g = c.getContext('2d'), id = g.createImageData(this.w, this.h);
    id.data.set(new Uint8ClampedArray(this.d.buffer));
    g.putImageData(id, 0, 0);
    return c;
  }
}
// an object buffer: local (0, 0) = the middle of its base row
const obj = (w, h) => new Pix(w, h, -(h - 1), w >> 1);

// ============================================================
// Places and palettes
// ============================================================
const X1 = 1700, XEND = 2090, CAMMAX = XEND - W;   // the area; the backdrop strips cover cameras 0..1610 (crossfade)
const WEND = 1830;                                  // the world strips (reef bed, sand) run to here: pieces anchored < 1700 overhang
const WL = 40;                                     // the waterline in play (screen y)
const BELL_X = 240, BOAT_X = 150;                  // the old diving bell; the heroes' boat moored above it
const gAt = x => L4ART.groundAt(x);   // Mission 4's seabed (also when LV is another mission)
let OUTP = 0, OL = 0;
// water from the surface down (dithered between these), sky from the top down to the horizon
const WATER = ['#a2f4ea', '#78e6de', '#58d8d8', '#44c9d2', '#37bacb', '#2eabc4', '#279dbd', '#2190b5', '#1c84ad', '#1879a5', '#156f9d', '#136695', '#115d8d', '#0f5585', '#0d4d7d', '#0b4675'];
const WRGB = WATER.map(c => hex(c));
const wIdx = r => 15 * (1 - Math.exp(-Math.max(0, r) / 118));
function waterRGB(r) { const f = wIdx(r), i = Math.min(14, Math.floor(f)), k = f - i, A = WRGB[i], B = WRGB[i + 1]; return [lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k)]; }
const SKYC = ['#2c86d8', '#3592dc', '#3f9ee1', '#4aa9e5', '#57b3e9', '#66bdec', '#77c6ef', '#89cff2', '#9cd8f5', '#b0e1f7', '#c4e9f9', '#d6f0fa', '#e4f6fb'];
// reef palettes: [hi, lit, mid, dark, deep]
const BRAINS = [['#fff7b8', '#eedd70', '#d2bc4c', '#a08a32', '#6e5c22'], ['#ffd9e6', '#f6a3bf', '#e17a9b', '#b05271', '#7c3452'], ['#ecffb8', '#bce274', '#93c454', '#679a3c', '#456e2c']];
const STAGS = [['#e8fbff', '#9adbff', '#5bb9f0', '#2f7cc0'], ['#fbe8ff', '#d8b2ff', '#b07ce0', '#7a4cb0'], ['#fff1c8', '#ffcb84', '#ff9c4c', '#cc6a2c']];
const FANS = [['#ff9a7c', '#f05c50', '#b23a3a'], ['#f0a0f4', '#c464da', '#8a3aa8'], ['#ffdc7c', '#ffb43c', '#d0802c']];
const TABLES = [['#d8ffd0', '#a6eaa2', '#78cc82', '#4a9862'], ['#d8f4ff', '#a8dcf0', '#78bcd8', '#4a88aa']];
const TUBES = [['#c8a2f4', '#9c66d8', '#6c3ca4', '#331a58'], ['#ffbc80', '#ff8c3c', '#c85c22', '#5a2410'], ['#ffe490', '#f2c04a', '#c08a2a', '#5a3c10']];
const SAND = { hi: '#fff6d4', top: '#f6e6b6', m: '#ead49e', lite: '#f8eac0', shade: '#d8be88', d: '#c8ac78', dd: '#ad9064' };

// ============================================================
// Coral and reef painters (object buffers, light from the upper left)
// ============================================================
function brain(rx, ry, pal, s) {
  rx = Math.round(rx); ry = Math.round(ry);
  const b = obj(rx * 2 + 3, ry + 3), C = pal.map(c => P(c));
  for (let y = -ry; y <= 0; y++) for (let x = -rx; x <= rx; x++) {
    const nx = x / (rx + 0.5), ny = (y - 0.5) / (ry + 0.5);
    if (nx * nx + ny * ny > 1) continue;
    const l = -nx * 0.55 - ny * 0.9 + (vn(x * 0.4, y * 0.4, s) - 0.5) * 0.3;
    // labyrinth ridges: contour lines of smooth noise
    const g = Math.sin(TAU * 3.4 * fbm(x * 0.085 + 3, y * 0.11, s, 2) + x * 0.12);
    let c = l > 0.85 ? 0 : l > 0.42 ? 1 : l > -0.1 ? 2 : 3;
    if (g > 0.55) c = Math.min(4, c + 2); else if (g > 0.15) c = Math.min(4, c + 1);
    else if (g < -0.75 && c > 0) c--;
    if (ny > -0.2 && Math.abs(nx) > 0.75) c = Math.max(c, 3);
    b.dot(x, y, C[c]);
  }
  return b.outline(OL);
}
function stag(h, pal, s) {
  const b = obj(Math.round(h * 1.5) + 8, Math.round(h) + 6), C = pal.map(c => P(c));
  seed = s;
  const tips = [];
  const br = (x, y, a, len, th, dep) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    b.line(x, y, x2, y2, C[2], th);
    if (dep > 0) {
      br(x2, y2, a - rr(0.3, 0.62), len * rr(0.62, 0.82), Math.max(2, th - 1), dep - 1);
      br(x2, y2, a + rr(0.3, 0.62), len * rr(0.62, 0.82), Math.max(2, th - 1), dep - 1);
    } else tips.push([x2, y2]);
  };
  for (const a of [-2.15, -1.62, -1.08]) br(rr(-2, 2), 0, a + rr(-0.12, 0.12), h * rr(0.34, 0.42), 3, 2);
  b.shade(0, C[1], C[3]);
  for (const [x, y] of tips) { b.dot(x, y, C[0]); b.dot(x - 1, y, C[0]); }
  return b.outline(OL);
}
// a sea fan (gorgonian): a wide flat fan from a short stalk, veins radiating, a lace of fine branches between them
function fan(h, w, pal, s) {
  h = Math.round(h); w = Math.round(w);
  const b = obj(w + 5, h + 3), C = pal.map(c => P(c)), sx = w / (1.75 * h);
  for (let y = -h; y <= -1; y++) for (let x = -Math.ceil(w / 2) - 1; x <= w / 2 + 1; x++) {
    const X = x / sx, Y = -y + 1, r = Math.hypot(X, Y), ang = Math.atan2(X, Y);
    const R0 = h * (0.6 + 0.4 * vn(ang * 2.4 + 9, 0.5, s));
    if (r > R0 || Math.abs(ang) > 1.08 || r < 4) continue;
    const k = r / R0;
    const vein = Math.abs(wrap(ang * 7 / Math.PI + vn(r * 0.1, 1, s) * 0.8, 1) - 0.5) < 0.08 + 0.1 * (1 - k);
    const lat = ((x + y + 400) % 3 === 0) || ((x - y + 400) % 3 === 0);
    const hole = vn(x * 0.3, y * 0.3, s + 3) < 0.4 + 0.15 * (1 - k);
    const edge = k > 0.9 && vn(x * 0.5, y * 0.5, s + 5) > 0.3;
    if (!vein && !edge && (!lat || hole)) continue;
    const lit = -X / (h * 1.2) + Y / h * 0.6 > 0.35;
    b.dot(x, y, edge ? (k > 0.96 || lit ? C[0] : C[1]) : vein ? C[2] : lit ? C[0] : C[1]);
  }
  b.line(0, 0, 0, -5, C[2], 3); b.line(0, -4, -3, -8, C[2], 2); b.line(0, -4, 3, -8, C[2], 2);
  return b.outline(OL);
}
function table(w, h, pal, s) {
  w = Math.round(w); h = Math.round(h);
  const b = obj(w + 4, h + 3), C = pal.map(c => P(c));
  seed = s;
  b.rect(-2, -h + 3, 4, h - 2, C[3]); b.rect(-2, -h + 3, 1, h - 2, C[2]);
  const tier = (y, hw) => {
    b.ell(0, y, hw, 2, C[2]);
    b.rect(-hw + 1, y - 2, hw * 2 - 1, 1, C[0]); b.rect(-hw, y - 1, 3, 1, C[1]);
    for (let x = -hw + 1; x < hw; x++) { b.dot(x, y + 2, C[3]); if (nz(x + s, y) > 0.6) b.dot(x, y, C[1]); if (nz(x, y + s) > 0.75) b.dot(x, y - 1, C[0]); }
  };
  tier(-h + 2, Math.round(w / 2));
  if (h > 12) tier(-h + 9, Math.round(w / 3));
  return b.outline(OL);
}
function tubes(n, h, pal, s) {
  const b = obj(n * 7 + 6, Math.round(h) + 5), C = pal.map(c => P(c));
  seed = s;
  const list = [];
  for (let i = 0; i < n; i++) list.push([Math.round((i - (n - 1) / 2) * 6 + rr(-1, 1)), Math.round(h * rr(0.5, 1))]);
  list.sort((a, b2) => b2[1] - a[1]);
  for (const [x, th] of list) {
    b.rect(x - 2, -th, 5, th + 1, C[1]); b.rect(x - 2, -th, 1, th + 1, C[0]); b.rect(x + 2, -th, 1, th + 1, C[2]);
    for (let y = -th + 4; y < 0; y += 4) b.rect(x - 1, y, 3, 1, C[2]);
    b.rect(x - 3, -th - 1, 7, 2, C[0]); b.rect(x - 1, -th - 1, 3, 1, C[3]);
  }
  return b.outline(OL);
}
const RK = () => ({ hi: P('#a8dcc4'), lit: P('#86c4aa'), lit2: P('#74b29c'), mid: P('#5d9a8e'), dark: P('#467e78'), dd: P('#336462'), pink: P('#e48aa6'), pinkL: P('#ffbfd0'), pol: P('#f6e6a0') });
function rock(w, h, s) {
  w = Math.round(w); h = Math.round(h);
  const b = obj(w + 4, h + 4), C = RK(), hw = w / 2;
  for (let x = -Math.floor(hw); x <= hw; x++) {
    const nx = x / hw, top = Math.round(-h * Math.pow(Math.max(0, 1 - nx * nx), 0.5) * (0.75 + 0.4 * vn(x * 0.16, 1, s)));
    for (let y = top; y <= 0; y++) {
      const d = y - top, n = vn(x * 0.32, y * 0.32, s + 5);
      let c = d === 0 ? C.hi : d < 3 ? C.lit : n > 0.64 ? C.dark : n < 0.28 ? C.lit2 : C.mid;
      if (nx > 0.35 && d > 1 && c !== C.dark) c = n > 0.5 ? C.dd : C.dark;
      if (y > -3 && d > 1) c = C.dd;
      if (d >= 1 && d < 5 && vn(x * 0.28, y * 0.5, s + 9) > 0.63) c = d === 1 ? C.pinkL : C.pink;
      if (d > 2 && nz(x + s, y) > 0.975) c = C.pol;
      b.dot(x, y, c);
    }
  }
  return b.outline(OL);
}
function grass(h, s, pal) {
  const b = obj(14, Math.round(h) + 2), C = (pal || ['#9ee08a', '#5fb46a', '#3a8a58']).map(c => P(c));
  seed = s;
  for (let i = 0; i < 6; i++) {
    const x0 = rr(-4, 4), len = h * rr(0.55, 1), bend = rr(-0.5, 0.5);
    let x = x0, y = 0;
    for (let k = 0; k < len; k++) { x += bend * (k / len); y -= 1; b.dot(x, y, k > len - 3 ? C[0] : k % 5 === 0 ? C[2] : C[1]); }
  }
  return b;
}
function star(r, col, s) {
  const b = obj(r * 2 + 5, r * 2 + 4), C = { m: P(col[0]), l: P(col[1]), d: P(col[2]) };
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5 + s, rad = i % 2 ? r * 0.42 : r; pts.push([Math.cos(a) * rad, -r - 1 + Math.sin(a) * rad]); }
  b.poly(pts, C.m);
  b.shade(C.l, 0, C.d);
  b.dot(0, -r - 1, C.l); b.dot(-1, -r - 2, C.l);
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5 + s; b.dot(Math.cos(a) * r * 0.6, -r - 1 + Math.sin(a) * r * 0.6, C.l); }
  return b.outline(OUTP);
}
// a giant clam: ribbed white shell, the wavy lips open on a blue spotted mantle
function clam(w, s) {
  const hw = Math.round(w / 2), b = obj(hw * 2 + 3, 24);
  const sh = [P('#fffaf0'), P('#e8e0cc'), P('#cbbfa2'), P('#9c8e72')], mt = [P('#a8faf8'), P('#5aa0ff'), P('#3468e0'), P('#1d3c9a')];
  for (let x = -hw; x <= hw; x++) {
    const nx = x / hw, cv = Math.sqrt(Math.max(0, 1 - nx * nx)), zig = Math.abs(((x + 72) % 8) - 4) * 0.7, rib = (x + 72) % 4 === 0;
    const lipU = Math.round(-12 - zig * cv), lipD = Math.round(-8 + zig * 0.6 * cv);
    const topY = Math.round(-12 - 9 * cv), botY = Math.round(-(1 - cv) * 7);
    for (let y = topY; y < lipU; y++) b.dot(x, y, y === topY ? sh[0] : rib ? sh[2] : nx < -0.3 ? sh[0] : nx > 0.45 ? sh[2] : sh[1]);
    for (let y = lipU; y <= lipD; y++) b.dot(x, y, y === lipU ? mt[1] : nz(x * 3 + s, y) > 0.74 ? mt[0] : nz(x + s, y * 5) > 0.84 ? mt[3] : mt[2]);
    for (let y = lipD + 1; y <= botY; y++) b.dot(x, y, rib || y > botY - 1 ? sh[3] : nx < -0.3 ? sh[1] : sh[2]);
  }
  return b.outline(OUTP);
}
// the old diving bell: bronze, verdigris, rivets, portholes, a lifting eye, a starfish and a sponge on it
function bell() {
  const b = obj(62, 62);
  const C = { hi: P('#ffe6a4'), l: P('#f0c068'), m: P('#cc903e'), d: P('#985f28'), dd: P('#663c1c'), vg: P('#4caa92'), vgl: P('#88d8b8'), vgd: P('#2c7666') };
  const hw = y => y < 5 ? 25 - (y > 3 ? 1 : 0) : y < 31 ? 23 - (y - 5) * 0.15 : 19.1 * Math.sqrt(Math.max(0, 1 - ((y - 31) / 15) ** 2));
  for (let yy = 0; yy <= 45; yy++) {
    const w = hw(yy), n0 = Math.round(w);
    for (let x = -n0; x <= n0; x++) {
      const nx = x / (w + 0.5), lit = -nx * 0.9 + (yy > 31 ? (yy - 31) / 15 * 0.45 : 0) + (yy < 5 ? -0.15 : 0);
      let c = lit > 0.6 ? C.hi : lit > 0.22 ? C.l : lit > -0.3 ? C.m : lit > -0.68 ? C.d : C.dd;
      const n = vn(x * 0.2, yy * 0.24, 31) + (1 - yy / 45) * 0.28;
      if (n > 0.74) c = n > 0.86 ? C.vgd : lit > 0.2 ? C.vgl : C.vg;
      b.dot(x, -yy, c);
    }
  }
  b.rect(-25, -5, 50, 1, C.dd); b.rect(-24, -4, 48, 1, C.hi);
  for (const ry of [8, 27]) for (let x = -21; x <= 21; x += 6) { const w = hw(ry); if (Math.abs(x) < w - 1) { b.dot(x, -ry, C.hi); b.dot(x, -ry + 1, C.dd); } }
  // portholes
  const port = (x, y, rx, ry) => { b.ell(x, y, rx + 1, ry + 1, C.dd); b.ell(x, y, rx, ry, C.l); b.ell(x, y, rx - 1, ry - 1, P('#173848')); b.dot(x - 1, y - 1, P('#9ae6f6')); b.dot(x - 2, y - 2, P('#dffcff')); b.dot(x + 1, y + 1, P('#2a5a6e')); };
  port(0, -17, 6, 6); port(-15, -17, 3, 5); port(15, -17, 3, 5);
  // lifting eye and a short broken chain
  b.disc(0, -50, 4, C.d); b.disc(0, -50, 2, 0); b.rect(-3, -47, 6, 2, C.m); b.dot(-3, -52, C.hi);
  // valve on the right shoulder
  b.rect(10, -44, 3, 4, P('#7b8a90')); b.rect(9, -45, 5, 2, P('#b6c4c8'));
  b.outline(OUTP);
  // life: a starfish on the body, a pink sponge on the left shoulder, a tuft of weed on the dome
  star(4, ['#ff7a3c', '#ffb070', '#c44a24'], 0.3).stamp(b, 12, -7);
  for (let i = 0; i < 4; i++) { b.disc(-15 + i * 2, -36 - (i % 2) * 2, 2, P(i % 2 ? '#ff9ac4' : '#e66a9a')); }
  b.dot(-14, -38, P('#ffd0e4'));
  grass(7, 9, ['#c6f08a', '#78c060', '#4a9050']).stamp(b, 5, -45);
  return b;
}

// ============================================================
// Baked layers (built once, in steps)
// ============================================================
let LY = null;
// the water: dithered bands from the surface (row 0) down
function bakeWater() {
  const h = H + 4, px = new Pix(W + 20, h, 0, 10), pal = WATER.map(c => P(c));
  for (let y = 0; y < h; y++) { const f = wIdx(y); for (let x = -10; x < W + 10; x++) { let i = Math.floor(f); if (f - i > bay(x, y)) i++; px.dot(x, y, pal[Math.min(15, i)]); } }
  return px.canvas();
}
// the sky above the waterline: its bottom row is the horizon (screen y wl - 1)
const SKY_H = 150;
function cloud(px, x, y, s) {
  seed = Math.floor(x * 7 + y * 3);
  const n = 5 + Math.floor(rnd() * 3), puffs = [];
  for (let i = 0; i < n; i++) puffs.push([x + (i - (n - 1) / 2) * 7 * s + rr(-2, 2), y - Math.sin((i + 0.5) / n * Math.PI) * 7 * s - rr(0, 2), rr(4.5, 7.5) * s]);
  const bottom = Math.round(y + 3 * s);
  for (const [c, dx, dy, dr] of [['#bcd6ee', 0, 0, 0], ['#e2eef9', -1, -1, -1], ['#ffffff', -2, -2, -2.4]]) for (const [x0, y0, r] of puffs) px.disc(x0 + dx, y0 + dy, Math.max(1, r + dr), P(c), bottom);
}
function bakeSky() {
  const p = 0.03, w = W + 22 + Math.ceil(CAMMAX * p), px = new Pix(w, SKY_H, 0, 10), pal = SKYC.map(c => P(c)), n = pal.length - 1;
  for (let y = 0; y < SKY_H; y++) { const f = Math.pow(y / (SKY_H - 1), 1.25) * n; for (let x = -10; x < w - 10; x++) { let i = Math.floor(f); if (f - i > bay(x, y)) i++; px.dot(x, y, pal[Math.min(n, i)]); } }
  // the sun and its halo
  const sx = 60, sy = SKY_H - 50;
  for (let y = -26; y <= 26; y++) for (let x = -26; x <= 26; x++) {
    const d = Math.hypot(x, y);
    if (d < 7.5) px.dot(sx + x, sy + y, P(d < 5.5 ? '#fffdf0' : '#fff4c4'));
    else if (d < 26 && (1 - (d - 7.5) / 18.5) * 0.9 > bay(sx + x, sy + y)) px.dot(sx + x, sy + y, mixPk(px.get(sx + x, sy + y), [255, 252, 232], 0.3 + 0.4 * (1 - (d - 7.5) / 18.5)));
  }
  for (const [x, y, s] of [[156, SKY_H - 56, 1], [255, SKY_H - 64, 0.6], [418, SKY_H - 46, 1.25], [12, SKY_H - 26, 0.6], [520, SKY_H - 60, 0.9], [318, SKY_H - 24, 0.5]]) cloud(px, x, y, s);
  // the horizon: a long low island with palms, and Volcano Island far off, still smoking
  const hz = SKY_H - 1, isl = P('#7fb0c8'), isL = P('#9ccade'), isD = P('#6e9fba');
  for (let x = 18; x < 200; x++) { const u = (x - 18) / 182, t = Math.round(4 * Math.sin(u * Math.PI) ** 0.6 + vn(x * 0.2, 2, 4) * 2); px.rect(x, hz - t, 1, t + 1, isl); px.dot(x, hz - t, isL); }
  for (const x of [52, 61, 140, 168]) { px.rect(x, hz - 11, 1, 7, isD); px.rect(x - 2, hz - 12, 5, 1, isD); px.dot(x - 3, hz - 11, isD); px.dot(x + 3, hz - 11, isD); }
  const vx = 352;
  for (let x = vx - 62; x < vx + 70; x++) {
    const d = Math.abs(x - vx), cone = d < 6 ? 21 - (d < 3 ? 1 : 0) : 22 - (d - 6) * 0.62, base = 5 * Math.max(0, 1 - Math.abs(x - vx - 4) / 66);
    const t = Math.round(Math.max(base, cone) + (vn(x * 0.25, 3, 7) - 0.5) * 1.5);
    if (t <= 0) continue;
    px.rect(x, hz - t, 1, t + 1, x < vx - 2 ? isL : isl);
    if (x > vx + 4 && t > 6) px.rect(x, hz - t + 2, 1, t - 3, isD);
  }
  for (let i = 0; i < 26; i++) { const k = i / 25; px.disc(vx + 2 + k * 40 + Math.sin(k * 5) * 3, hz - 23 - k * 22, 1.5 + k * 3.5, P(k < 0.5 ? '#eef4f8' : '#dce8f0')); }
  return { c: px.canvas(), p };
}
// the surface band (8 frames, tiles every 128 px): wave crests above the waterline (row SB_WL), the bright underside
// and caustic light below it
const SB_W = 640, SB_H = 48, SB_WL = 6, SB_T = 128;
function caus(x, y, t) {
  const u = x / SB_T * TAU;
  const a = Math.sin(u * 3 + y * 0.23 + t) + Math.sin(u * 5 - y * 0.15 - t + 1.7) + Math.sin(u * 2 + y * 0.37 + 2 * t + 0.6);
  const b = Math.sin(u * 4 - y * 0.29 + t + 2.2) + Math.sin(u * 7 + y * 0.11 - 2 * t + 4.1);
  return Math.max(Math.max(0, 1 - Math.abs(a) * 2.4), Math.max(0, 1 - Math.abs(b) * 2.8) * 0.8);
}
function bakeSurf(f0, f1) {
  const out = [], foam = P('#ffffff'), crest = P('#d6fff8'), air = P(SKYC[SKYC.length - 1]);
  for (let f = f0; f < f1; f++) {
    const t = f / 8 * TAU, px = new Pix(SB_W, SB_H, 0, 0);
    for (let x = 0; x < SB_W; x++) {
      const u = x / SB_T * TAU, wv = 1.1 * Math.sin(3 * u + t) + 0.6 * Math.sin(7 * u - 2 * t + 1) + 0.5 * Math.sin(2 * u + t + 2);
      const top = SB_WL - Math.round(wv * 1.1);
      for (let y = SB_WL; y < top; y++) px.dot(x, y, air);                    // a trough: sky below the mean line
      px.dot(x, top, wv > 1.15 ? foam : crest);                              // the crest, seen from the side
      for (let y = top + 1; y < SB_H; y++) {
        const d = y - top - 1;
        let a, c = [214, 255, 248];
        if (d === 0) { a = 1; c = Math.sin(u * 9 + t * 2) > 0.55 ? [176, 240, 232] : [240, 255, 252]; }   // the mirror
        else if (d === 1) { a = 0.8; c = [200, 250, 244]; }
        else {
          const fade = Math.pow(Math.max(0, 1 - d / (SB_H - SB_WL - 2)), 1.5), g = 0.42 * Math.exp(-d / 4);
          const gq = Math.floor(g * 6 + bay(x, y)) / 6, cl = caus(x, y * 1.3, t) * fade;
          a = Math.max(gq, cl > 0.5 ? 0.62 * fade + 0.1 : cl > 0.3 && d < 14 ? 0.25 * fade : 0);
        }
        if (a > 0.02) px.dot(x, y, pk(c[0], c[1], c[2], Math.round(Math.min(1, a) * 255)));
      }
    }
    out.push(px.canvas());
  }
  return out;
}
// light shafts from the surface (soft, alpha): repeat every SH_P px
const SH_P = 360, SH_H = 232;
function bakeShafts() {
  const w = W + 20 + SH_P, px = new Pix(w, SH_H, 0, 0), row = new Float32Array(w);
  const list = [[10, 12, 0.8], [70, 6, 0.5], [128, 22, 1], [212, 9, 0.65], [262, 16, 0.85], [318, 7, 0.5]];
  for (let y = 0; y < SH_H; y++) {
    const fade = Math.pow(1 - y / SH_H, 1.5) * Math.min(1, y / 6 + 0.3);
    row.fill(0);
    for (const [sx, sw, st] of list) for (let k = -1; k <= 2; k++) {
      const c = sx + k * SH_P + y * 0.45, half = sw / 2 + y * 0.07;
      for (let x = Math.max(0, Math.floor(c - half)), x1 = Math.min(w - 1, Math.ceil(c + half)); x <= x1; x++) { const d = Math.abs(x - c); if (d < half) row[x] += st * (1 - ss(half * 0.35, half, d)); }
    }
    for (let x = 0; x < w; x++) {
      if (!row[x]) continue;
      const q = Math.floor(Math.min(1, row[x]) * fade * 0.36 * 40 + bay(x, y)) / 40;
      if (q > 0) px.dot(x, y, pk(214, 255, 244, Math.round(q * 255)));
    }
  }
  return px.canvas();
}
// a reef wall: silhouettes painted in one colour, then shaded from their top edges, then hazed into the water
function wall(p, top, o) {
  const w = W + 22 + Math.ceil(CAMMAX * p), px = new Pix(w, H - top, top, 10), M = P('#ff00ff');
  seed = o.seed;
  px.fill(-10, w - 10, x => o.y0 - o.amp * fbm(x / o.sc, 0.37, o.seed, 3), M);
  const holes = [];
  for (let x = -10 + rr(0, o.gap); x < w; x += rr(o.gap * 0.6, o.gap * 1.4)) {
    const k = rnd(), by = Math.round(o.y0 - o.amp * 0.3);
    if (k < o.pile) {   // a coral head: blobs piled up, widest at the bottom, a knobbly crown
      const bw = rr(o.pw[0], o.pw[1]), bh = rr(o.ph[0], o.ph[1]), n = 4 + Math.floor(rnd() * 3);
      let cxp = x;
      for (let i = 0; i <= n; i++) { const u = i / n, r = bw / 2 * (1 - u * 0.62); cxp += rr(-bw, bw) * 0.06; px.disc(cxp, by + 4 - bh * u + r * 0.4, r, M); }
      for (let i = 0; i < 4; i++) px.disc(cxp + rr(-bw, bw) * 0.25, by + 4 - bh + rr(0, bw * 0.2), rr(bw * 0.1, bw * 0.2), M);
      px.rect(x - bw / 2, by + 4, bw, H, M);
      if (o.arch && bw > (o.pw[0] + o.pw[1]) / 2 && rnd() < 0.6) holes.push([x + rr(-3, 3), by + rr(-2, 4), bw * rr(0.2, 0.28), rr(7, 11)]);
    } else if (k < o.pile + o.fanK) {   // a sea fan or a staghorn thicket
      const s = Math.floor(rnd() * 9999), fh = rr(o.ph[0] * 0.55, o.ph[1] * 0.75);
      (rnd() < 0.6 ? fan(fh, fh * rr(1, 1.4), ['#f0f', '#f0f', '#f0f'], s) : stag(fh, ['#f0f', '#f0f', '#f0f', '#f0f'], s)).stamp(px, x, by + 3);
    } else {   // a low wide mound
      px.ell(x, by + 2, rr(18, 40), rr(5, 11), M);
    }
  }
  for (const [hx, hy, rx, ry] of holes) px.ell(hx, hy, rx, ry, 0);
  // shading from the top edge of each run, lit left edges, dark right edges, darker pockets
  const body = hex(o.body), rim = hex(o.rim), dark = hex(o.dark), d = px.d, ww = px.w;
  const S = (a, b2, k) => pk(Math.round(lerp(a[0], b2[0], k)), Math.round(lerp(a[1], b2[1], k)), Math.round(lerp(a[2], b2[2], k)), 255);
  for (let q = 0; q < ww; q++) {
    let run = -1;
    for (let r = 0; r < px.h; r++) {
      const i = r * ww + q;
      if (!d[i]) { run = -1; continue; }
      run++;
      const x = q - px.ox, y = r + top, n = fbm(x * 0.07, y * 0.09, o.seed + 2, 2);
      let k = run === 0 ? -1 : run === 1 ? -0.6 : run < 4 ? -0.3 : 0;
      if (q > 0 && !d[i - 1]) k = Math.min(k, -0.45); else if (q < ww - 1 && !d[i + 1]) k = Math.max(k, 0.5);
      if (r < px.h - 1 && !d[i + ww]) k = Math.max(k, 0.6);
      k += (n - 0.5) * 0.9 + Math.max(0, (y - o.y0) / 60) * 0.4;
      const kq = Math.round(clamp(k, -1, 1) * 3 + (bay(x, y) - 0.5) * 0.9) / 3;
      d[i] = kq < 0 ? S(body, rim, -kq) : S(body, dark, kq);
    }
  }
  if (o.decor) o.decor(px);
  px.hazeRows(y => waterRGB(y - WL), o.haze);
  return { c: px.canvas(), p, top };
}
// stamp a random coral for a row ('back' bigger, 'front' smaller) onto a buffer at (x, base y)
function coral(px, x, y, size, kinds) {
  const s = Math.floor(rnd() * 99999), k = pick(kinds || ['brain', 'stag', 'fan', 'table', 'tubes', 'stag', 'fan']);
  let o;
  if (k === 'brain') o = brain(rr(7, 13) * size, rr(5, 9) * size, pick(BRAINS), s);
  else if (k === 'stag') o = stag(rr(16, 26) * size, pick(STAGS), s);
  else if (k === 'fan') { const h = rr(20, 34) * size; o = fan(h, h * rr(0.85, 1.15), pick(FANS), s); }
  else if (k === 'table') o = table(rr(16, 26) * size, rr(9, 16) * size, pick(TABLES), s);
  else if (k === 'tubes') o = tubes(3 + Math.floor(rnd() * 3), rr(12, 20) * size, pick(TUBES), s);
  else o = grass(rr(8, 14) * size, s);
  o.stamp(px, x, y);
  return o;
}
function nearBack() {
  return wall(0.42, 180, {
    seed: 77, body: '#24758c', rim: '#6cbcb8', dark: '#185a72', y0: 244, amp: 14, sc: 40, gap: 80, pw: [30, 54], ph: [14, 28], pile: 0.75, fanK: 0, haze: 0.4,
    decor: px => {
      seed = 9123;
      for (let x = rr(0, 20); x < px.w - 10; x += rr(18, 34)) {
        let ty = 0; for (let r = 0; r < px.h; r++) if (px.d[r * px.w + Math.round(x) + px.ox]) { ty = r + px.top; break; }
        if (!ty) continue;
        coral(px, x, ty + 3, rr(0.7, 1));
      }
    }
  });
}
// the play layer: the reef bed (world strip, x = world x). Reef heads ("clusters") every 140-180 px: a rock base with
// big sea fans and staghorn behind it, a big brain coral, a table or tube sponges on it, small pieces at its foot;
// sand between them with a few small corals and weed. CLUSTERS lists their centres (hand placed for the start, the
// cage at 370 and the first robots; regular after that).
const RB_TOP = 140, RB_OX = 24;
const CLUSTERS = [[40, 1], [410, 1.1], [598, 1.15], [745, 1], [905, 0.95], [1065, 1.1], [1225, 1], [1390, 1.1], [1545, 1], [1668, 0.85]];
const CLAMS = [700, 1186, 1505];
function cluster(px, x, sz, s) {
  seed = s;
  const gy = gAt(x) + 3, rw = rr(56, 78) * sz, rh = rr(15, 24) * sz, rk = rock(rw, rh, s);
  // behind the rock: one or two big sea fans, a staghorn thicket
  const nb = 2 + (rnd() < 0.5 ? 1 : 0);
  for (let i = 0; i < nb; i++) {
    const dx = (i - (nb - 1) / 2) * rw * 0.36 + rr(-4, 4), base = gy + rk.topAt(dx) + 6, k = (i + Math.floor(s)) % 3;
    if (k === 0) { const h = rr(42, 56) * sz; fan(h, h * rr(1.1, 1.4), pick(FANS), s + i).stamp(px, x + dx, base); }
    else if (k === 1) stag(rr(32, 44) * sz, pick(STAGS), s + i).stamp(px, x + dx, base);
    else { const h = rr(34, 46) * sz; fan(h, h * rr(1.05, 1.35), pick(FANS), s + i).stamp(px, x + dx, base); }
  }
  rk.stamp(px, x, gy);
  // on the rock: a big brain coral, and a table or tube sponges
  seed = s + 7;
  const bdx = rr(-rw * 0.18, rw * 0.18);
  brain(rr(13, 19) * sz, rr(9, 13) * sz, pick(BRAINS), s).stamp(px, x + bdx, gy + rk.topAt(bdx) + 4);
  const odx = bdx > 0 ? -rw * rr(0.25, 0.34) : rw * rr(0.25, 0.34), oy = gy + rk.topAt(odx) + 3;
  if (rnd() < 0.5) table(rr(20, 28) * sz, rr(12, 16) * sz, pick(TABLES), s).stamp(px, x + odx, oy);
  else tubes(3 + Math.floor(rnd() * 2), rr(14, 20) * sz, pick(TUBES), s).stamp(px, x + odx, oy);
  // at its foot: small brains, a staghorn, weed
  for (const side of [-1, 1]) {
    const fx = x + side * rw * rr(0.42, 0.55);
    if (rnd() < 0.5) brain(rr(6, 9), rr(4, 6), pick(BRAINS), s + side).stamp(px, fx, gAt(fx) + 3);
    else stag(rr(14, 20), pick(STAGS), s + side * 3).stamp(px, fx, gAt(fx) + 3);
    grass(rr(7, 11), s + side * 5).stamp(px, fx + side * 8, gAt(fx) + 3);
  }
}
function bakeReef() {
  const px = new Pix(WEND + RB_OX, H - RB_TOP, RB_TOP, RB_OX);
  // a few low pieces in the sand between the reef heads (a touch hazier: they sit back)
  seed = 5151;
  for (let x = rr(0, 20); x < X1 - 20; x += rr(36, 60)) {
    if (Math.abs(x - BELL_X) < 44 || CLUSTERS.some(([c, s]) => Math.abs(x - c) < 44 * s)) continue;
    const k = rnd();
    if (k < 0.3) brain(rr(6, 10), rr(4, 7), pick(BRAINS), Math.floor(x)).stamp(px, x, gAt(x) + 3);
    else if (k < 0.55) tubes(2 + Math.floor(rnd() * 2), rr(8, 13), pick(TUBES), Math.floor(x)).stamp(px, x, gAt(x) + 3);
    else if (k < 0.75) rock(rr(16, 26), rr(5, 9), Math.floor(x) + 3).stamp(px, x, gAt(x) + 3);
    else grass(rr(8, 14), Math.floor(x)).stamp(px, x, gAt(x) + 3);
  }
  px.hazeRows(y => waterRGB(y - WL), 0.16);
  for (const [x, sz] of CLUSTERS) cluster(px, x, sz, Math.floor(x * 1.37) + 11);
  for (const x of CLAMS) clam(rr(32, 38), x).stamp(px, x, gAt(x) + 3);
  bell().stamp(px, BELL_X, gAt(BELL_X) + 3);
  px.hazeRows(y => waterRGB(y - WL), 0.05);
  return px.canvas();
}
// the sand bed (world strip): a drift around the bell, ripples, grains, shells, pebbles, starfish, weed
const GR_TOP = 226;
function bakeGround() {
  const px = new Pix(WEND + RB_OX, H - GR_TOP, GR_TOP, RB_OX), S = {};
  for (const k in SAND) S[k] = P(SAND[k]);
  const tops = [];
  for (let x = -RB_OX; x < WEND; x++) {
    let gy = Math.round(gAt(x) + (vn(x * 0.06, 3, 5) - 0.5) * 2.4);
    const db = Math.abs(x - BELL_X); if (db < 44) gy -= Math.round(5 * (1 - db / 44) ** 1.6);
    if (x > 1640) gy -= Math.round(4 * ss(1640, 1690, x));   // a sand drift finishing the area at its east end (1700)
    tops[x + RB_OX] = gy;
    const fd = 7 + Math.round(vn(x * 0.05, 1, 8) * 3);   // where the rippled top plane turns into the bank's face
    for (let y = gy; y < H; y++) {
      const d = y - gy, rip = Math.sin(x * 0.11 + Math.sin(x * 0.043 + y * 0.31) * 1.6 + y * 1.05);
      let c;
      if (d < fd) c = d === 0 ? S.hi : d === 1 ? S.top : rip > 0.7 ? S.lite : rip < -0.6 ? S.shade : S.m;
      else {
        const band = wrap(Math.floor((d + Math.sin(x * 0.035) * 2.5 + vn(x * 0.08, d * 0.2, 4) * 2) / 3), 4);
        c = d === fd ? S.shade : band === 0 ? S.d : band === 2 ? S.dd : S.shade;
        if (d > fd + 8 && (d - fd - 8) * 0.08 > bay(x, y)) c = S.dd;
      }
      const g = nz(x, y);
      if (g > 0.955) c = S.dd; else if (g < 0.035 && d > 1) c = S.hi;
      px.dot(x, y, c);
    }
  }
  // contact shadows: the sand darkens at the foot of each reef head, the bell and the clams
  const shadow = (x0, hw, depth) => {
    for (let x = Math.round(x0 - hw); x <= x0 + hw; x++) {
      const k = 1 - Math.abs(x - x0) / hw, gy = tops[x + RB_OX];
      if (gy == null) continue;
      for (let d = 0; d < depth; d++) { const m = k * (1 - d / depth); if (m > bay(x, d) * 0.9) px.dot(x, gy + d, d === 0 && m > 0.5 ? S.dd : S.d); }
    }
  };
  for (const [x, sz] of CLUSTERS) shadow(x, 40 * sz, 4);
  for (const x of CLAMS) shadow(x, 20, 3);
  shadow(BELL_X, 32, 4);
  seed = 7373;
  // pebbles, shells and bits of old coral in the bank
  for (let x = rr(0, 20); x < X1; x += rr(10, 28)) {
    const gy = tops[Math.round(x) + RB_OX], y = gy + Math.round(rr(4, 24)), k = rnd();
    if (k < 0.4) { const r = rr(1.5, 3.2); px.ell(x, y, r, Math.max(1, r * 0.6), P(pick(['#8a877c', '#9a8f80', '#7c7a74']))); px.dot(x - 1, y - 1, P('#d6d2c4')); px.dot(x + 1, y + 1, P('#5e5a52')); }
    else if (k < 0.62) { px.ell(x, y, 2, 1.5, P('#fff4f0')); px.dot(x + 1, y, P('#f2a6b4')); px.dot(x, y + 1, P('#d88a9a')); }
    else if (k < 0.8) { px.rect(x - 2, y, 5, 1, P('#f6ece0')); px.rect(x - 1, y - 1, 1, 1, P('#f6ece0')); px.rect(x + 1, y - 1, 1, 1, P('#e8d8c8')); }
    else { px.rect(x - 1, y, 3, 1, P('#7a6a58')); px.dot(x, y - 1, P('#a89884')); }
  }
  // starfish on the sand
  seed = 8484;
  const SCOL = [['#ff7a3c', '#ffb070', '#c44a24'], ['#ff5a6a', '#ff9aa4', '#b8303e'], ['#7a8cff', '#b0bcff', '#4a58c8'], ['#ffb02c', '#ffd878', '#c87a14']];
  for (let x = rr(30, 60); x < X1 - 20; x += rr(80, 150)) {
    if (CLAMS.some(c => Math.abs(x - c) < 26) || Math.abs(x - BELL_X) < 34) continue;
    const gy = tops[Math.round(x) + RB_OX]; star(Math.round(rr(5, 7)), pick(SCOL), rr(0, 1)).stamp(px, x, gy + Math.round(rr(4, 9)));
  }
  // weed tufts along the top edge
  seed = 9595;
  for (let x = rr(0, 20); x < X1 - 6; x += rr(30, 70)) { const gy = tops[Math.round(x) + RB_OX]; grass(rr(5, 9), Math.floor(x)).stamp(px, x, gy + 1); }
  px.hazeRows(y => waterRGB(y - WL), y => 0.12 + Math.max(0, y - 248) * 0.012);
  return { c: px.canvas(), tops };
}
// caustic light on the sand: a 128 x 40 tile, 8 frames
function bakeSandCaustics() {
  const out = [];
  for (let f = 0; f < 8; f++) {
    const t = f / 8 * TAU, px = new Pix(SB_T, 40, 0, 0);
    for (let y = 0; y < 40; y++) for (let x = 0; x < SB_T; x++) {
      const a = caus(x, y * 2.6 + 30, t) * (1 - y / 44);
      const q = Math.floor(a * 3 + bay(x, y) * 0.9) / 3;
      if (q > 0.3) px.dot(x, y, pk(255, 255, 236, Math.round(Math.min(1, q) * 120)));
    }
    out.push(px.canvas());
  }
  return out;
}
// the dark foreground along the very bottom (parallax 1.25, screen space)
const FR_P = 1.25, FR_TOP = 228;
function bakeFront() {
  const w = W + 22 + Math.ceil(CAMMAX * FR_P), px = new Pix(w, H - FR_TOP, FR_TOP, 10);
  const B = P('#0d4a5e'), Lt = P('#1f6e7c'), D = P('#08323f');
  seed = 1357;
  // a band of rubble along the bottom edge, with low clumps of weed, coral and rock now and then
  px.fill(-10, w - 10, x => 264 - Math.round(4 * fbm(x / 14, 0.5, 21, 2)) + (vn(x * 0.5, 2, 3) > 0.7 ? -1 : 0), B);
  for (let x = rr(0, 60); x < w; x += rr(60, 150)) {
    const k = rnd();
    if (k < 0.45) { const rw = rr(12, 28), rh = rr(4, 8); for (let xx = -rw; xx <= rw; xx++) { const t = Math.round(rh * Math.sqrt(1 - (xx / rw) ** 2) * (0.8 + 0.3 * vn(xx * 0.3, 0, x))); px.rect(x + xx, 264 - t, 1, t + 6, B); } }
    else if (k < 0.75) { const s = Math.floor(rnd() * 999); const o = rnd() < 0.5 ? stag(rr(10, 14), ['#1f6e7c', '#0d4a5e', '#0d4a5e', '#08323f'], s) : fan(rr(11, 15), rr(16, 22), ['#1f6e7c', '#0d4a5e', '#08323f'], s); o.stamp(px, x, 266); }
    else { for (let i = 0; i < 6; i++) { const bx = x + rr(-7, 7), len = rr(7, 14), bend = rr(-0.6, 0.6); let xx = bx, yy = 266; for (let j = 0; j < len; j++) { xx += bend * j / len; yy--; px.rect(xx, yy, j < len - 4 ? 2 : 1, 1, B); } } }
  }
  px.shade(Lt, Lt, D, B);
  // repaint any outline the stamped silhouettes brought with them
  const ol = OL;
  for (let i = 0; i < px.d.length; i++) if (px.d[i] === ol) px.d[i] = D;
  return { c: px.canvas(), p: FR_P };
}
// sprites: fish, turtle, anemones, clownfish, bubbles
function fishPix(len, body, belly, fin, outl, f) {
  const b = obj(len + 6, 9), C = { b: P(body), l: P(belly), f: P(fin) };
  const ry = Math.max(1.5, len * 0.28);
  b.ell(0, -4, len / 2 - 1, ry, C.b);
  for (let x = -len / 2 + 2; x < len / 2 - 1; x++) b.dot(x, -4 + Math.round(ry) - (Math.abs(x) > len / 3 ? 1 : 0), C.l);
  const tx = -Math.round(len / 2), wag = f ? 1 : 0;
  b.poly([[tx + 1, -4], [tx - 3, -7 + wag], [tx - 3, -1 + wag]], C.f);
  b.dot(Math.round(len / 2) - 3, -5, P('#10161e'));
  return b.outline(P(outl));
}
function clownPix(f) {
  const b = obj(14, 9), O = P('#ff8a1c'), Ol = P('#ffb45a'), Wh = P('#ffffff'), K = P('#1a1a26');
  b.ell(0, -4, 4, 2.4, O);
  b.poly([[-4, -4], [-7, -7 + f], [-7, -1 + f]], O);
  b.rect(-3, -6, 4, 1, Ol);
  for (const [x, h] of [[2, 2], [-1, 3], [-4, 1]]) { b.rect(x, -4 - h, 1, h * 2 + 1, Wh); b.rect(x + 1, -4 - h + 1, 1, h * 2 - 1, K); }
  b.dot(3, -5, K);
  return b.outline(OUTP);
}
function turtlePix(f) {
  const b = obj(44, 26), sh = [P('#c6d470'), P('#94a84a'), P('#6e8838'), P('#4c6428')], sk = [P('#d8dc9c'), P('#a6b06a'), P('#7a8648')];
  const fl = [[-4, 3], [-1, 6], [3, 7], [-1, 6]][f];
  // back flipper, front flipper (behind the shell for the far side)
  b.poly([[-10, -9], [-17, -6 + (f & 1)], [-13, -4]], sk[2]);
  b.poly([[4, -10], [12 + fl[0], -18 + fl[1]], [16 + fl[0], -16 + fl[1]], [8, -8]], sk[2]);
  // shell
  b.ell(-1, -11, 12, 6.5, sh[2]);
  for (let x = -12; x <= 11; x++) for (let y = -17; y <= -5; y++) {
    if (!b.get(x, y)) continue;
    const ny = (y + 11) / 6.5, nx = (x + 1) / 12;
    let c = ny < -0.45 ? sh[0] : ny < 0.1 ? sh[1] : sh[2];
    if (ny > 0.55) c = sh[3];
    const sc = Math.abs(((x + 30) % 7) - 3.5) < 0.6 || (Math.abs(ny) < 0.12 && Math.abs(nx) < 0.85);
    if (sc && ny < 0.5) c = sh[3];
    b.dot(x, y, c);
  }
  b.rect(-12, -6, 23, 1, sk[1]);
  // head
  b.ell(14, -10, 4, 3, sk[1]); b.rect(12, -12, 4, 1, sk[0]); b.dot(16, -11, P('#10161e')); b.dot(17, -9, sk[2]);
  // near front flipper and near back flipper
  b.poly([[6, -7], [10 + fl[0] * 0.5, -1 + fl[1] * 0.4], [2 + fl[0] * 0.5, 2 + fl[1] * 0.5], [0, -6]], sk[1]);
  b.poly([[-9, -6], [-14, -2], [-9, -3]], sk[1]);
  return b.outline(P('#20341e'));
}
// a sea anemone: an outlined foot, then two rows of wavy tentacles (the back row darker), each ending in a pale bulb
// a spotted eagle ray seen from the side, gliding (far away: drawn hazed in the background); f = wing beat 0..3
function rayPix(f) {
  const b = obj(64, 30), up = [-7, -3, 2, -3][f];
  const D = P('#22465e'), M = P('#2f5c78'), Lt = P('#5e8ea8'), S = P('#d8ecf4'), Bl = P('#c4dce6');
  // far wing tip, body, near wing (a long swept triangle), the whip tail
  b.poly([[-4, -12], [4 + up * 0.3, -14 + up], [10, -12]], D);
  b.ell(0, -11, 13, 3.5, M); b.ell(9, -10, 6, 3, M); b.ell(14, -10, 3, 2, Lt); b.poly([[16, -11], [20, -10], [16, -9]], M);
  // the near wing: a curved pectoral fin sweeping up and back
  b.poly([[-12, -10], [-2, -12], [6, -12], [8, -14 + up * 0.6], [4, -17 + up * 1.3], [-4, -19 + up * 1.8], [-12, -18 + up * 1.6], [-9, -15 + up * 0.8]], Lt);
  b.rect(-12, -9, 22, 1, Bl);
  for (let i = 0; i < 26; i++) b.dot(-14 - i, -10 + Math.round(Math.sin(i * 0.25 + f) * 1.5), D);
  for (const [x, y] of [[-4, -13], [0, -12], [4, -13], [-8, -12], [2, -15], [-2, -16]]) b.dot(x, y + (y < -13 ? up : 0), S);
  b.dot(15, -11, P('#0e1a24'));
  return b;
}
function anemonePix(pal, f) {
  const b = obj(44, 30), C = pal.map(c => P(c));   // [tip, light, mid, dark, foot, footD]
  const foot = obj(44, 30);
  foot.rect(-7, -6, 14, 7, C[4]); foot.rect(-7, -6, 2, 7, C[1]); foot.rect(5, -6, 2, 7, C[5]); foot.rect(-6, -7, 12, 1, C[1]);
  foot.outline(OL); foot.stamp(b, 0, 0);
  for (const back of [true, false]) {
    const n = back ? 8 : 11;
    for (let i = 0; i < n; i++) {
      const u = (i + (back ? 0.5 : 0)) / (n - (back ? 0 : 1)) * 2 - 1, len = (back ? 12 : 10) + (1 - Math.abs(u)) * 7, ph = f / 4 * TAU + i * 1.3 + (back ? 2 : 0);
      let x = u * 6, y = -7;
      for (let k = 0; k < len; k++) {
        const a = -Math.PI / 2 + u * (back ? 1.1 : 1.3) + Math.sin(ph + k * 0.35) * 0.3 * (k / len);
        x += Math.cos(a); y += Math.sin(a);
        const wide = k < len * 0.6, c = back ? C[3] : k < 2 ? C[3] : (k + i) % 6 === 0 ? C[1] : C[2];
        b.rect(Math.round(x), Math.round(y), wide ? 2 : 1, 1, c);
        if (wide && !back) b.dot(Math.round(x) + 1, Math.round(y), C[3]);
      }
      b.dot(x, y, C[0]); b.dot(x + 1, y, C[0]); b.dot(x, y - 1, C[0]);
    }
  }
  return b;
}
const ANEM_PALS = [['#ffe0f4', '#ffb0de', '#f07ac4', '#b04a90', '#e0607e', '#a8405a'], ['#ffe4f0', '#d8f08a', '#a8d860', '#6c9a3c', '#d86a8a', '#9a4060']];
// world positions of the live reef bits
const ANEM = [[128, 0], [480, 1], [660, 0], [985, 1], [1146, 0], [1310, 1], [1468, 0], [1625, 1]];
const CHROMIS = [];
for (let i = 0; i < 21; i++) CHROMIS.push([30 + i * 80 + hsh(i * 3.1) * 50, 18 + hsh(i * 7.7) * 26, i]);


// ============================================================
// Bake steps: each one bakes one layer, once (they may run in any later order too: the joiner runs them in idle time,
// the opening scene or the mission card may need them first). REEF.bakeMs records how long each took.
// ============================================================
function init() { if (LY) return; makeNZT(); OUTP = P(OUT); OL = P('#163a4c'); LY = {}; }
const bakeMs = {};
const step = (k, f) => () => { init(); if (LY[k]) return; const t0 = performance.now(); LY[k] = f(); bakeMs[k] = Math.round(performance.now() - t0); };
const STEPS = [
  step('water', bakeWater),
  step('sky', bakeSky),
  step('surfA', () => bakeSurf(0, 4)),
  step('surfB', () => bakeSurf(4, 8)),
  step('shaft', bakeShafts),
  step('far', () => wall(0.1, 110, { seed: 11, body: '#1f7ea4', rim: '#3eaac2', dark: '#1a6f98', y0: 222, amp: 34, sc: 70, gap: 95, pw: [44, 96], ph: [40, 96], pile: 0.75, fanK: 0.08, haze: y => 0.56 + clamp((205 - y) / 80, 0, 1) * 0.3 })),
  step('mid', () => wall(0.22, 156, { seed: 23, body: '#1c7092', rim: '#58b6c0', dark: '#145a7e', y0: 236, amp: 20, sc: 50, gap: 80, pw: [34, 64], ph: [24, 46], pile: 0.6, fanK: 0.25, arch: true, haze: 0.36 })),
  step('near', nearBack),
  step('reef', bakeReef),
  step('ground', bakeGround),
  step('caus', bakeSandCaustics),
  step('front', bakeFront),
  step('sprites', () => ({
    clown: [0, 1].map(f => clownPix(f).canvas()),
    anem: ANEM_PALS.map(pal => [0, 1, 2, 3].map(f => anemonePix(pal, f).canvas())),
    turtle: [0, 1, 2, 3].map(f => turtlePix(f).hazeRows(() => waterRGB(70), 0.32).canvas()),
    ray: [0, 1, 2, 3].map(f => rayPix(f).hazeRows(() => waterRGB(90), 0.55).canvas()),
    tang: [0, 1].map(f => fishPix(8, '#ffe040', '#fff6b0', '#f4b418', '#7a5a10', f).hazeRows(() => waterRGB(110), 0.32).canvas()),
    chromis: [0, 1].map(f => fishPix(6, '#4ac8f8', '#b8f0ff', '#2a8ad0', '#123a5a', f).hazeRows(() => waterRGB(170), 0.14).canvas())
  })),
  step('boat', boatPix)
];
function build() { for (const f of STEPS) f(); return LY; }

// ============================================================
// Drawing. bgI(g, cx, wl): screen space into context g, the waterline at screen y wl (40 in play, lower in the
// opening's split view); behindI / groundI: world space (ctx translated by -cx); frontI, overlayI: screen space.
// They draw with whatever globalAlpha the caller set.
// ============================================================
function surfBand(g, cx, wl, x0 = -10, x1 = W + 10) {
  const fi = (G.t >> 3) & 7, fr = fi < 4 ? LY.surfA[fi] : LY.surfB[fi - 4], off = wrap(Math.round(cx), SB_T);
  g.drawImage(fr, off + Math.max(0, x0 + 10), 0, Math.min(W + 20, x1 - x0), SB_H, Math.max(-10, x0), wl - SB_WL, Math.min(W + 20, x1 - x0), SB_H);
}
function bgI(g, cx, wl = WL) {
  const l = build(), S = l.sprites, ga = g.globalAlpha;
  // the sky above the waterline
  if (wl > -10) { const s = l.sky, off = Math.round(cx * s.p), rows = Math.min(SKY_H, wl + 10); g.drawImage(s.c, off, SKY_H - rows, W + 20, rows, -10, wl - rows, W + 20, rows); if (wl + 10 > SKY_H) { g.fillStyle = SKYC[0]; g.fillRect(-10, -10, W + 20, wl - SKY_H + 10); } }
  // the water (its depth colours stay anchored at the play waterline, so the hazed walls match it in the intro too)
  g.drawImage(l.water, 0, Math.max(0, wl - WL), W + 20, H - wl + 10, -10, wl, W + 20, H - wl + 10);
  // shafts, swaying
  g.globalAlpha = ga * (0.8 + 0.2 * Math.sin(G.t * 0.021));
  const so = wrap(Math.round(cx * 0.12 + Math.sin(G.t * 0.008) * 6), SH_P);
  g.drawImage(l.shaft, so, 0, W + 20, Math.min(SH_H, H - wl), -10, wl, W + 20, Math.min(SH_H, H - wl));
  g.globalAlpha = ga;
  // the far shoal: a silvery ribbon of little fish that flashes as it turns
  const sx = wrap(560 - cx * 0.18 + G.t * 0.22, 1100) - 300, sy = 112 + Math.sin(G.t * 0.011) * 8;
  for (let i = 0; i < 44; i++) {
    const c = i % 11, r = (i / 11) | 0, fx = Math.round(sx + c * 8 + r * 3 + Math.sin(i * 1.7 + G.t * 0.03) * 2), fy = Math.round(sy + r * 5 + Math.sin(c * 0.55 + G.t * 0.02) * 7 + Math.sin(i * 2.3 + G.t * 0.05) * 1.5);
    if (fy <= wl + 4) continue;
    g.fillStyle = ((G.t >> 3) + c) % 9 === 0 ? 'rgba(236,255,255,0.8)' : 'rgba(150,214,226,0.5)';
    g.fillRect(fx, fy, 3, 1); g.fillStyle = 'rgba(120,190,210,0.45)'; g.fillRect(fx - 1, fy, 1, 1);
  }
  // an eagle ray far off, gliding the other way
  const rx = wrap(603 + cx * 0.06 - G.t * 0.2, 1400) - 300, ry = 92 + Math.sin(G.t * 0.009) * 6;
  if (ry > wl + 16) { g.save(); g.translate(Math.round(rx), Math.round(ry)); g.scale(-1, 1); g.drawImage(S.ray[[0, 1, 2, 1][(G.t >> 4) & 3]], -32, -29); g.restore(); }
  // the reef walls, the sea turtle gliding behind the near one
  for (const ly of [l.far, l.mid]) { const off = Math.round(cx * ly.p), y0 = Math.max(ly.top, wl + 2); g.drawImage(ly.c, off, y0 - ly.top, W + 20, H - y0, -10, y0, W + 20, H - y0); }
  const tx = wrap(420 - cx * 0.34 + G.t * 0.16, 1000) - 200, ty = 100 + Math.sin(G.t * 0.013) * 7;
  if (ty > wl + 14) g.drawImage(S.turtle[[0, 1, 2, 1][(G.t >> 4) & 3]], Math.round(tx) - 22, Math.round(ty) - 25);
  { const ly = l.near, off = Math.round(cx * ly.p), y0 = Math.max(ly.top, wl + 2); g.drawImage(ly.c, off, y0 - ly.top, W + 20, H - y0, -10, y0, W + 20, H - y0); }
  // a shoal of yellow tangs: a loose sunflower spiral, not a grid
  const yx = wrap(745 - cx * 0.55 + G.t * 0.32, 1300) - 300, yy = 148 + Math.sin(G.t * 0.016) * 10;
  for (let i = 0; i < 11; i++) {
    const a = i * 2.39996, rad = 4 + Math.sqrt(i) * 9;
    const fx = yx + Math.cos(a) * rad * 1.5 + Math.sin(i * 2.1 + G.t * 0.025) * 3, fy = yy + Math.sin(a) * rad * 0.7 + Math.sin(i * 1.3 + G.t * 0.04) * 2;
    if (fy > wl + 8) g.drawImage(S.tang[((G.t >> 3) + i) & 1], Math.round(fx) - 7, Math.round(fy) - 8);
  }
  surfBand(g, cx, wl);
}
function bubble(g, x, y, r) {
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = 'rgba(214,255,250,0.85)';
  if (r <= 1) { g.fillRect(x, y, 2, 2); return; }
  g.fillRect(x - 1, y - 2, 3, 1); g.fillRect(x - 1, y + 2, 3, 1); g.fillRect(x - 2, y - 1, 1, 3); g.fillRect(x + 2, y - 1, 1, 3);
  g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - 1, 1, 1);
}
function behindI(cx, withBoat = true) {
  const l = build(), S = l.sprites;
  const x0 = Math.max(-RB_OX, Math.floor(cx) - 10), x1 = Math.min(WEND, Math.floor(cx) + W + 10);
  if (x1 > x0) ctx.drawImage(l.reef, x0 + RB_OX, 0, x1 - x0, H - RB_TOP, x0, RB_TOP, x1 - x0, H - RB_TOP);
  // anemones and their clownfish
  for (let i = 0; i < ANEM.length; i++) {
    const [x, k] = ANEM[i];
    if (x < cx - 30 || x > cx + W + 30) continue;
    const gy = Math.round(gAt(x)) + 3;
    ctx.drawImage(S.anem[k][((G.t >> 3) + i) & 3], x - 22, gy - 29);
    for (let j = 0; j < 2; j++) {
      const ph = G.t * 0.035 + i * 2 + j * 3.1, fx = x + Math.sin(ph) * 11, fy = gy - 22 - j * 4 + Math.sin(ph * 1.7) * 2, dir = Math.cos(ph) > 0 ? 1 : -1;
      ctx.save(); ctx.translate(Math.round(fx), Math.round(fy)); ctx.scale(dir, 1); ctx.drawImage(S.clown[(G.t >> 3) & 1], -7, -8); ctx.restore();
    }
  }
  // chromis hovering over the corals
  for (const [x0c, h, i] of CHROMIS) {
    const x = x0c + Math.sin(G.t * 0.02 + i) * 10;
    if (x < cx - 10 || x > cx + W + 10) continue;
    const y = gAt(x) - 26 - h + Math.sin(G.t * 0.06 + i * 1.3) * 2, dir = Math.cos(G.t * 0.02 + i) > 0 ? 1 : -1;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(dir, 1); ctx.drawImage(S.chromis[((G.t >> 3) + i) & 1], -6, -8); ctx.restore();
  }
  // bubbles leaking from the bell's valve
  if (BELL_X > cx - 40 && BELL_X < cx + W + 40) {
    const by = gAt(BELL_X) + 3 - 45;
    for (let i = 0; i < 7; i++) {
      const k = wrap(G.t * 0.9 + i * 31, 210), y = by - k, x = BELL_X + 12 + Math.sin(k * 0.08 + i) * 2;
      if (y >= WL + 3) bubble(ctx, x, y, 1 + (i % 3 === 0 ? 1 : 0));
    }
  }
  if (withBoat) boat(cx, WL);
}
function groundI(cx) {
  const l = build(), gr = l.ground;
  const x0 = Math.max(-RB_OX, Math.floor(cx) - 10), x1 = Math.min(WEND, Math.floor(cx) + W + 10);
  if (x1 <= x0) return;
  ctx.drawImage(gr.c, x0 + RB_OX, 0, x1 - x0, H - GR_TOP, x0, GR_TOP, x1 - x0, H - GR_TOP);
  // caustics dancing on the sand (clipped to it)
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x0, H);
  for (let x = x0; x < x1; x += 4) ctx.lineTo(x, gr.tops[x + RB_OX] + 1);
  ctx.lineTo(x1, gr.tops[x1 - 1 + RB_OX] + 1); ctx.lineTo(x1, H); ctx.closePath(); ctx.clip();
  const fr = l.caus[(G.t >> 3) & 7];
  ctx.globalAlpha *= 0.9;
  for (let tx = Math.floor(x0 / SB_T) * SB_T; tx < x1; tx += SB_T) ctx.drawImage(fr, tx, Math.round(gAt(tx + 64)) - 2);
  ctx.restore();
}
function frontI(cx) {
  const f = build().front;
  ctx.drawImage(f.c, Math.round(cx * f.p), 0, W + 20, H - FR_TOP, -10, FR_TOP, W + 20, H - FR_TOP);
}
function overlayI(cx, wl = WL) {
  // drifting motes
  for (let i = 0; i < 34; i++) {
    const x = Math.round(wrap(hsh(i * 3.7) * 900 - cx * 0.8 + Math.sin(G.t * 0.01 + i) * 8, W + 20) - 10), y = Math.round(wl + 14 + hsh(i * 9.1) * 200 + Math.sin(G.t * 0.017 + i * 1.3) * 4);
    ctx.fillStyle = i % 3 ? 'rgba(224,255,248,0.35)' : 'rgba(255,255,255,0.6)';
    ctx.fillRect(x, y, 1, 1);
  }
  // bubbles rising from the reef to the surface
  for (let i = 0; i < 12; i++) {
    const sp = 0.35 + hsh(i * 5.3) * 0.4, k = wrap(G.t * sp + hsh(i * 2.9) * 400, 230), y = H - 28 - k, x = wrap(hsh(i * 4.1) * 1400 - cx + Math.sin(k * 0.06 + i) * 3, W + 40) - 20;
    if (y > wl + 3) bubble(ctx, x, y, i % 4 === 0 ? 2 : 1);
  }
  // glints on the waterline
  for (let i = 0; i < 6; i++) { const x = Math.round(wrap(hsh(i * 7.3) * 700 - cx, W)); if (((G.t >> 2) + i * 5) % 23 < 3) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, wl - 2, 1, 1); ctx.fillRect(x - 1, wl - 1, 3, 1); } }
}

// ============================================================
// The heroes' dive boat, moored at the surface (BOAT_X) by a rope to the bell's lifting eye: deck (canopy, cabin,
// tanks, flag pole), hull (white, turquoise stripe, red boot top, navy bottom, a ladder at the stern) and a
// water-tinted copy of the hull for the part below the waterline
// ============================================================
const BT = { top: -60, ox: 56, w: 112, h: 76 };
function boatPix() {
  const deck = new Pix(BT.w, BT.h, BT.top, BT.ox), hull = new Pix(BT.w, BT.h, BT.top, BT.ox);
  const Wh = P('#f6f6f0'), Wd = P('#d6dce2'), Wdd = P('#aeb8c2'), Tq = P('#22a8c0'), TqL = P('#68d4e2'), Rd = P('#d8402e'), RdL = P('#f2705a'), Nv = P('#2a3a6a'), Rl = P('#c4ccd4'), Gl = P('#2c4a6a'), GlL = P('#a8dcf2'), Po = P('#c0c8d0');
  deck.rect(-36, -36, 1, 24, Po); deck.rect(-12, -36, 1, 24, Po);
  for (let x = -39; x <= -8; x++) { const st = Math.floor((x + 39) / 3) % 2; deck.rect(x, -39, 1, 3, st ? Wh : Rd); deck.dot(x, -39, st ? P('#ffffff') : RdL); if ((x + 39) % 3 === 1) deck.dot(x, -36, st ? Wh : Rd); }
  deck.rect(-6, -27, 20, 15, Wh); deck.rect(9, -27, 5, 15, Wd); deck.rect(-6, -27, 20, 1, P('#ffffff'));
  deck.rect(-3, -24, 9, 5, Gl); deck.rect(-2, -24, 3, 1, GlL); deck.dot(-2, -23, GlL);
  deck.poly([[14, -27], [18, -27], [24, -17], [14, -17]], Gl); deck.line(16, -26, 20, -19, GlL);
  deck.disc(-1, -15, 3, P('#ff7a2a')); deck.disc(-1, -15, 1, 0); deck.dot(-4, -15, Wh); deck.dot(2, -15, Wh); deck.dot(-1, -18, Wh);
  for (const tx of [26, 31]) { deck.rect(tx, -21, 4, 9, P('#ffd23f')); deck.rect(tx, -21, 1, 9, P('#fff0a0')); deck.rect(tx + 3, -21, 1, 9, P('#c89a20')); deck.rect(tx + 1, -23, 2, 2, P('#5a6a74')); }
  deck.rect(38, -46, 1, 34, P('#8a96a0'));
  deck.outline(OUTP);
  const pts = [[-44, -12], [-10, -13], [20, -14], [38, -17], [49, -20], [47, -12], [42, -3], [33, 5], [-36, 6], [-44, 2]];
  hull.poly(pts, Wh);
  for (let i = 0; i < hull.d.length; i++) {
    if (!hull.d[i]) continue;
    const y = Math.floor(i / hull.w) + hull.top, x = (i % hull.w) - hull.ox;
    let c = Wh;
    if (y >= 2) c = Nv; else if (y >= 0) c = y === 0 ? RdL : Rd; else if (y >= -3) c = Wd; else if (y >= -8 && y <= -6 + (x > 30 ? -1 : 0)) c = y === -8 ? TqL : Tq;
    if (y === -4 && c === Wd) c = Wdd;
    hull.d[i] = c;
  }
  hull.shade(Rl, 0, 0, Wh);
  for (const px0 of [24, 32]) { hull.disc(px0, -10, 1.5, Gl); hull.dot(px0 - 1, -11, GlL); }
  hull.outline(OUTP);
  for (let y = -12; y < 7; y++) { hull.dot(-47, y, Po); hull.dot(-50, y, Po); if (y % 4 === 0) hull.rect(-49, y, 2, 1, Po); }
  hull.dot(-47, -13, Po); hull.dot(-48, -14, Po); hull.dot(-49, -14, Po); hull.dot(-50, -13, Po);
  const tint = new Pix(BT.w, BT.h, BT.top, BT.ox); tint.d.set(hull.d); tint.hazeRows(() => [62, 196, 206], 0.45);
  return { deck: deck.canvas(), hull: hull.canvas(), hullT: tint.canvas() };
}
// the diver-down flag (red, a white diagonal), fluttering
function flag(x, y) {
  const f = (G.t >> 3) & 1;
  R(x, y, 12, 8, OUT);
  R(x, y + 1, 11, 6, '#e8382e'); if (f) R(x + 7, y + 6, 4, 1, OUT);
  for (let i = 0; i < 11; i++) R(x + i, y + 1 + Math.round(i * 5 / 10), 1, 2, '#ffffff');
  R(x + 11, y + 1 + f, 1, 6 - f, '#b8281e');
}
// the boat (world space) with the waterline at screen y wl; o.onDeck(by) draws people on board (between deck and hull)
function boat(cx, wl, o = {}) {
  const l = build(), b = l.boat;
  const bx = BOAT_X, by = wl + Math.round(Math.sin(G.t * 0.05));
  if (bx < cx - 80 || bx > cx + W + 80) return;
  // the mooring line from the bow to the bell's lifting eye
  const ax = bx + 47, ay = by - 15, ex = BELL_X, ey = gAt(BELL_X) + 3 - 50;
  for (let i = 0; i <= 60; i++) { const k = i / 60, x = lerp(ax, ex, k) + Math.sin(k * Math.PI) * 6, y = lerp(ay, ey, k); R(Math.round(x), Math.round(y), 1, 2, i % 3 ? '#d8c89a' : '#9a8a64'); }
  ctx.drawImage(b.deck, bx - BT.ox, by + BT.top);
  flag(bx + 39, by - 46);
  if (o.onDeck) o.onDeck(by);
  ctx.save(); ctx.beginPath(); ctx.rect(bx - BT.ox, by + BT.top, BT.w, -BT.top); ctx.clip(); ctx.drawImage(b.hull, bx - BT.ox, by + BT.top); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(bx - BT.ox, by, BT.w, BT.h + BT.top); ctx.clip(); ctx.drawImage(b.hullT, bx - BT.ox, by + BT.top); ctx.restore();
  surfBand(ctx, 0, wl, bx - BT.ox - 4, bx - BT.ox + BT.w + 8);
}

// ============================================================
// The area (contract) and the extras for the opening scene
// ============================================================
const REEF = {
  x0: 0, x1: X1, steps: STEPS, bakeMs, hide: false,
  bg(g, cx) { if (!hidden()) bgI(g, cx, WL); },
  behind(cx) { if (!hidden()) behindI(cx, true); },
  ground(cx) { if (!hidden()) groundI(cx); },
  front(cx) { if (!hidden()) frontI(cx); },
  overlay(cx) { if (!hidden()) overlayI(cx, WL); },
  paint: { bg: bgI, behind: behindI, ground: groundI, front: frontI, overlay: overlayI },
  build, boat, surfBand, bubble, WL, BOAT_X, BELL_X
};
// only while the opening scene is really playing (never on the menus, whatever was left set)
const hidden = () => REEF.hide && G.intro && G.state === 'play';
L4ART.reef = REEF;

// ============================================================
// The mission card (L4ART.card): a slice of the reef squeezed into 96 rows (the surface at row 17, the seabed near
// row 85; the card is drawn 12 px higher than its frame and the record strip covers its last rows), the hero diver
// squaring up to a robot octopus: bubbles fly and burst on it, it flashes, then winds up its ink (its tell), again.
// ============================================================
const CW = 240, CH = 96, CWL = 17, CDY = -162, CX0 = 548;
let CARD = null;
function cardLayer() {
  if (CARD) return CARD;
  const l = build(), c = canvasOf(CW, CH), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(l.sky.c, 40, SKY_H - CWL, CW, CWL, 0, 0, CW, CWL);
  // the water, its depth steps squeezed into the card
  const wp = new Pix(CW, CH - CWL, CWL, 0), pal = WATER.map(q => P(q));
  for (let y = CWL; y < CH; y++) { const f = wIdx((y - CWL) * 2.6); for (let x = 0; x < CW; x++) { let i = Math.floor(f); if (f - i > bay(x, y)) i++; wp.dot(x, y, pal[Math.min(15, i)]); } }
  g.drawImage(wp.canvas(), 0, CWL);
  // the mid and near walls (shifted up), then the reef bed and the sand of world x CX0..CX0 + CW
  g.drawImage(l.mid.c, Math.round(CX0 * l.mid.p), 0, CW, l.mid.c.height, -10, l.mid.top - 150, CW, l.mid.c.height);
  g.drawImage(l.near.c, Math.round(CX0 * l.near.p), 0, CW, l.near.c.height, -10, l.near.top - 158, CW, l.near.c.height);
  g.drawImage(l.reef, CX0 + RB_OX, 0, CW, H - RB_TOP, 0, RB_TOP + CDY, CW, H - RB_TOP);
  g.drawImage(l.ground.c, CX0 + RB_OX, 0, CW, H - GR_TOP, 0, GR_TOP + CDY, CW, H - GR_TOP);
  return (CARD = c);
}
L4ART.card = function (x, y, w, h) {
  const l = build(), T = G.t, s = T % 170;
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.drawImage(cardLayer(), 0, 0, Math.min(w, CW), Math.min(h, CH), 0, 0, Math.min(w, CW), Math.min(h, CH));
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * 0.7; ctx.drawImage(l.shaft, wrap(Math.round(T * 0.05), SH_P), 0, w, h - CWL, 0, CWL, w, h - CWL); ctx.globalAlpha = ga;
  surfBand(ctx, T * 0.2, CWL, -10, w + 10);
  // a few chromis over the corals
  for (let i = 0; i < 3; i++) { const fx = Math.round(w * (0.18 + i * 0.3) + Math.sin(T * 0.02 + i * 2) * 8), fy = 70 + i * 3 + Math.round(Math.sin(T * 0.05 + i) * 2); ctx.save(); ctx.translate(fx, fy); ctx.scale(Math.cos(T * 0.02 + i * 2) > 0 ? 1 : -1, 1); ctx.drawImage(l.sprites.chromis[((T >> 3) + i) & 1], -6, -8); ctx.restore(); }
  // the robot octopus (the cast's drawing), hit by the bubbles, then winding up its ink
  // narrow cards (three in the window, ~113 px): the whole diver at the left (fins at the edge), the robot at the
  // right, a lane for the bubbles between them; wider cards spread them out
  const sp = Math.max(0, w - 113) * 0.25, dx = Math.round(30 + sp), dy = 62 + Math.round(Math.sin(T * 0.05) * 2), ox = Math.round(w - 22 - sp), oy = 60 + Math.round(Math.sin(T * 0.04 + 1) * 3);
  const fire = s < 84, tell = s >= 100 && s < 160, hit = fire && s > 26 && (s - 26) % 16 < 4;
  const oct = ENEMY_TYPES.roboctopus;
  if (oct && oct.draw) oct.draw({ type: 'roboctopus', x: ox, y: oy, t: T, state: tell ? 'tell' : 'idle', timer: tell ? 160 - s : 95, hitT: hit ? 2 : 0, homeX: 540, baseY: oy, targetX: dx, targetY: dy - 14, facing: -1, hp: 6, active: true });
  // bubbles from the gun to the robot, popping on it
  if (fire) for (let k = 0; k < 4; k++) {
    const age = s - k * 16;
    if (age < 0 || age > 30) continue;
    const bx = dx + 30 + age * ((ox - 20 - dx - 30) / 26), by = dy - 14;
    if (age <= 26) { ctx.strokeStyle = '#b8faff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(bx), by, 3, 0, TAU); ctx.stroke(); R(Math.round(bx) - 1, by - 2, 2, 1, '#ffffff'); }
    else for (const [px0, py0] of [[-4, -3], [3, -5], [5, 2], [-2, 4]]) R(Math.round(bx) + px0, by + py0, 2, 2, '#d8fcff');
  }
  // the hero diver (the cast's drawing)
  if (L4.drawDiver) L4.drawDiver({ x: dx, y: dy, facing: 1, t: T, muzzle: fire && (s % 16) < 4 ? 3 : 0, hearts: 3, ride: { type: 'scuba' } });
  for (let i = 0; i < 3; i++) { const k = wrap(T * 0.6 + i * 23, 50), by = dy - 28 - k; if (by > CWL + 3) bubble(ctx, dx + 8 + Math.sin(k * 0.2 + i) * 1.5, by, 1); }
  ctx.restore();
};
}
