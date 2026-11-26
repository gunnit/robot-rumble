'use strict';
// ============================================================
// MISSION 3 proposal frame: AREA 3 LAVA RIVERS (a mock screenshot of a level that is not built yet).
// Harness fixture (--extra, loaded after the game): pushes a temporary Mission 3 'VOLCANO ISLAND' and paints the one
// camera spot this frame shows (camera x 3300: render with --level 3 --x 3501.6 --frames 60 --hero 0 --scale 3; the
// shots, banner and poses are timed for exactly 60 frames, see FRAMES/SHOTS near the end):
// dusk on the volcano's flank, the volcano close behind and erupting, a basalt cliff with a lava fall, hexagonal
// basalt columns over a glowing lava river, two lava-shark fins with glowing wakes, a lava shark leaping between two
// columns, a lava bomb falling on a marked column, Ines on a column firing the shotgun.
// Static layers are painted pixel by pixel into offscreen canvases once (deterministic: hsh() noise, never
// Math.random); the live bits (fountain, lava fall, wakes, drips, embers) are drawn every frame from G.t.
// ============================================================
{
const CAM0 = 3300;           // camera x the frame is composed for (screen x + CAM0 = world x)
const HX = 3501.6;           // hero x (devStart puts the camera at HX - 201.6 = CAM0)
const LAVA_Y = 234;          // the near edge of the lava river (screen y)

// ============================================================
// Math, noise, colours
// ============================================================
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const h2 = (i, j, s) => hsh(i * 12.9898 + j * 78.233 + s * 37.719);
function vnoise(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hsh(i * 1.37 + s * 91.3), hsh((i + 1) * 1.37 + s * 91.3), u); }
function fbm(x, s, oct = 3) { let a = 0, amp = 1, n = 0, f = 1; for (let o = 0; o < oct; o++) { a += vnoise(x * f, s + o * 17) * amp; n += amp; amp *= 0.5; f *= 2.03; } return a / n; }
function vn2(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(h2(i, j, s), h2(i + 1, j, s), u), lerp(h2(i, j + 1, s), h2(i + 1, j + 1, s), u), v);
}
function fbm2(x, y, s, oct = 3) { let a = 0, amp = 1, n = 0, f = 1; for (let o = 0; o < oct; o++) { a += vn2(x * f, y * f, s + o * 13) * amp; n += amp; amp *= 0.5; f *= 2.03; } return a / n; }
// cellular noise: distance to the nearest and the second nearest jittered cell point
const VOR = [0, 0];
function vor(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const ci = i + di, cj = j + dj, d = Math.hypot(ci + h2(ci, cj, s) - x, cj + h2(ci, cj, s + 5) - y);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  VOR[0] = f1; VOR[1] = f2;
  return VOR;
}
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const pk = (r, g, b, a = 255) => (LE ? (a << 24) | (b << 16) | (g << 8) | r : (r << 24) | (g << 16) | (b << 8) | a) >>> 0;
const RGB = new Map(), PC = new Map();
function rgb(c) { let v = RGB.get(c); if (!v) { v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; RGB.set(c, v); } return v; }
function P(c) { let v = PC.get(c); if (v === undefined) { const a = rgb(c); v = pk(a[0], a[1], a[2]); PC.set(c, v); } return v; }
function PM(a, b, k) { const A = rgb(a), B = rgb(b); return pk(Math.round(A[0] + (B[0] - A[0]) * k), Math.round(A[1] + (B[1] - A[1]) * k), Math.round(A[2] + (B[2] - A[2]) * k)); }
const chR = v => LE ? v & 255 : v >>> 24, chG = v => (v >>> (LE ? 8 : 16)) & 255, chB = v => (v >>> (LE ? 16 : 8)) & 255, chA = v => LE ? v >>> 24 : v & 255;
function tint(v, c, k) { const C = rgb(c), r = chR(v), g = chG(v), b = chB(v); return pk(Math.round(r + (C[0] - r) * k), Math.round(g + (C[1] - g) * k), Math.round(b + (C[2] - b) * k), chA(v)); }
// pick from a palette by t in 0..1, ordered dithering between neighbours
function ramp(pal, t, x, y) { const f = clamp(t, 0, 1) * (pal.length - 1), i = Math.floor(f); return pal[Math.min(pal.length - 1, i + (f - i > bay(x, y) ? 1 : 0))]; }
const rgba = (c, a) => { const v = rgb(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a.toFixed(3) + ')'; };

// ============================================================
// Pixel buffers (packed RGBA), turned into canvases once
// ============================================================
class Buf {
  constructor(w, h, x0 = 0, y0 = 0) { this.w = Math.ceil(w); this.h = Math.ceil(h); this.x0 = x0; this.y0 = y0; this.d = new Uint32Array(this.w * this.h); }
  at(x, y) { x = Math.round(x) - this.x0; y = Math.round(y) - this.y0; return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : y * this.w + x; }
  set(x, y, c) { const i = this.at(x, y); if (i >= 0) this.d[i] = c; }
  get(x, y) { const i = this.at(x, y); return i < 0 ? 0 : this.d[i]; }
  rect(x, y, w, h, c) { x = Math.round(x); y = Math.round(y); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  disc(cx, cy, r, c, only) {
    const n = Math.ceil(r) + 1, X = Math.round(cx), Y = Math.round(cy), rr = (r + 0.5) * (r + 0.5) - 0.5;
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      if (i * i + j * j > rr) continue;
      if (only !== undefined && this.get(X + i, Y + j) !== only) continue;
      this.set(X + i, Y + j, c);
    }
  }
  poly(pts, c) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const xs = [];
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const sy = y + 0.5; xs.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const ax = pts[i][0], ay = pts[i][1], bx = pts[j][0], by = pts[j][1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + (sy - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c);
    }
  }
  canvas() {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const g = c.getContext('2d'), id = g.createImageData(this.w, this.h);
    id.data.set(new Uint8ClampedArray(this.d.buffer)); g.putImageData(id, 0, 0);
    return c;
  }
}
// 1px outline around every painted pixel (diag: 8 neighbours)
function outlineBuf(b, col, diag) {
  const c = P(col || OUT), add = [], w = b.w, h = b.h, d = b.d;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[y * w + x] !== 0 && d[y * w + x] !== c;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[y * w + x]) continue;
    if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || (diag && (on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1)))) add.push(y * w + x);
  }
  for (const i of add) d[i] = c;
}

// Character grids for the robots (palette letters, '.' = empty), like makeSprite rows
class Grid {
  constructor(w, h, x0, y0) { this.w = w; this.h = h; this.x0 = x0; this.y0 = y0; this.g = new Array(w * h).fill('.'); }
  set(x, y, c) { x = Math.round(x) - this.x0; y = Math.round(y) - this.y0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y * this.w + x] = c; }
  get(x, y) { x = Math.round(x) - this.x0; y = Math.round(y) - this.y0; return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.g[y * this.w + x] : '.'; }
  poly(pts, c, keep) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const xs = [];
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const sy = y + 0.5; xs.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const ax = pts[i][0], ay = pts[i][1], bx = pts[j][0], by = pts[j][1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + (sy - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) if (!keep || this.get(x, y) === '.') this.set(x, y, c);
    }
  }
  outline(diag) {
    const add = [];
    const on = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && this.g[y * this.w + x] !== '.' && this.g[y * this.w + x] !== 'k';
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.g[y * this.w + x] !== '.') continue;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || (diag && (on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1)))) add.push(y * this.w + x);
    }
    for (const i of add) this.g[i] = 'k';
  }
  sprite(pal) { const rows = []; for (let y = 0; y < this.h; y++) rows.push(this.g.slice(y * this.w, (y + 1) * this.w).join('')); const s = makeSprite(rows, pal); s.ox = this.x0; s.oy = this.y0; return s; }
}
// ============================================================
// SKY: dusk over the island (indigo above, wine red, orange low on the left where the sun went down),
// a few early stars, flat banks of cloud lit gold underneath
// ============================================================
const SKYS = [[0, '#170b27'], [28, '#22102f'], [54, '#35133a'], [78, '#511840'], [100, '#711e44'], [120, '#922a44'], [138, '#b13940'], [154, '#cd4c3b'], [168, '#e26537'], [182, '#f0833c'], [198, '#f8a24b']];
function skyCol(y) {
  let i = 0;
  while (i + 1 < SKYS.length && SKYS[i + 1][0] <= y) i++;
  const a = SKYS[i], b = SKYS[Math.min(i + 1, SKYS.length - 1)];
  return b[0] > a[0] ? PM(a[1], b[1], clamp((y - a[0]) / (b[0] - a[0]), 0, 1)) : P(a[1]);
}
// a flat bank of cloud: flattened puffs on a flat base, shaded by the distance to its bottom edge (lit from below by
// the sun under the horizon, brighter toward the left) and to its top edge (dim sky light)
function cloudBank(b, cx, cy, w, h, s, dim) {
  const puffs = [], n = Math.max(3, Math.round(w / 11));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, env = Math.pow(Math.sin(Math.PI * t), 0.8), r = h * (0.35 + 1.05 * env) * (0.55 + 0.8 * h2(i, s, 11));
    puffs.push([cx - w / 2 + t * w + (h2(i, s, 12) - 0.5) * 9, cy - r * 0.38, r * 1.5, r * 1.22]);   // art director: rounder, taller puffs
  }
  const inside = (x, y) => {
    if (y > cy + h * 0.35 + (fbm(x / 9, s + 5) - 0.5) * 2) return false;
    for (const [px, py, rx, ry] of puffs) { const dx = (x - px) / rx, dy = (y - py) / ry; if (dx * dx + dy * dy <= 1) return true; }
    return false;
  };
  const x0 = Math.floor(cx - w / 2 - h * 3), x1 = Math.ceil(cx + w / 2 + h * 3), y0 = Math.floor(cy - h * 3), y1 = Math.ceil(cy + h);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inside(x, y)) continue;
    let db = 1; while (db < 5 && inside(x, y + db)) db++;
    let dt = 1; while (dt < 3 && inside(x, y - dt)) dt++;
    const warm = clamp(1 - (x + 20) / 520, 0.25, 1) * (dim ? 0.6 : 1);
    let c;
    if (db === 1) c = PM('#e0704c', '#ffd09a', warm);
    else if (db === 2) c = PM('#a8404a', '#f08a5a', warm);
    else if (db <= 4 && (db === 3 || bay(x, y) < 0.5)) c = PM('#7a2a48', '#c0504c', warm);
    else c = dt === 1 ? P('#4a1a3e') : P(dim ? '#5c2244' : '#6a2546');
    b.set(x, y, c);
  }
}
function paintSky() {
  const b = new Buf(W + 20, H, -10, 0);
  for (let y = 0; y < H; y++) {
    const base = skyCol(y);
    for (let x = -10; x < W + 10; x++) {
      const gx = (x + 40) / 240, gy = (y - 196) / 80, k = Math.exp(-(gx * gx + gy * gy)) * 0.6;
      b.set(x, y, k > 0.01 ? tint(base, '#ffc47c', k) : base);
    }
  }
  for (let i = 0; i < 24; i++) {
    const x = Math.round(hsh(i * 3.17 + 1) * 270) - 6, y = Math.round(36 + Math.pow(hsh(i * 7.71 + 2), 1.3) * 44);
    const big = hsh(i * 5.3) > 0.8;
    b.set(x, y, P(big ? '#fff4ea' : hsh(i * 9.1) > 0.5 ? '#e8c6d6' : '#a8809e'));
    if (big) { const c = P('#8a5e84'); b.set(x - 1, y, c); b.set(x + 1, y, c); b.set(x, y - 1, c); b.set(x, y + 1, c); }
  }
  cloudBank(b, 40, 106, 96, 7, 1);
  cloudBank(b, 132, 113, 64, 5, 7);
  cloudBank(b, 200, 127, 84, 5, 2);
  cloudBank(b, 6, 138, 74, 5, 3);
  cloudBank(b, 216, 92, 46, 4, 4, true);
  cloudBank(b, 440, 126, 76, 6, 5, true);
  cloudBank(b, 492, 138, 50, 4, 6, true);
  return b.canvas();
}

// ============================================================
// THE VOLCANO: a tall stratovolcano close behind (crater at VX, VY): grey-brown upper slopes with ridges and gullies
// running down, streaked with old dark lava flows, green jungle on its lower third, fresh lava rivers down the
// flanks. Lit by the sunset from the left (the summit catching the last light), the right flank in shade.
// ============================================================
const VX = 300, VY = 86, RIMW = 14, VO = VY - 80;   // VO: the river and old-flow points were laid out for VY 80; RIMW 20 -> 14 (art director: a narrower crater, like the bay's)
function vProf(x) {
  const u = Math.abs(x - VX);
  if (u <= RIMW) {
    const k = (x - VX + RIMW) / (2 * RIMW);
    return VY + 2.2 * Math.sin(Math.PI * k) + 3.4 * Math.exp(-Math.pow((x - (VX - 9)) / 3.2, 2)) - 1.4 * k + 0.8 * (fbm(x / 4, 2) - 0.5);
  }
  const w = u - RIMW;
  return VY + 116 * (1 - Math.exp(-w / 100)) + 0.05 * w + (2.6 * fbm(x / 13, 4) - 1.3) * (1.2 - Math.min(1, w / 260)) + (x > VX ? -1.4 : 0);
}
const ROCK = ['#1d151c', '#291d25', '#382830', '#4a333b', '#5f4146', '#785250', '#93655c', '#b07a68'];
const JUNG = ['#0e1813', '#14231a', '#1c3121', '#274528', '#355a2e', '#4a7034'];
const OLDF = [[-0.5, 0.06, 150, 1], [-0.17, 0.04, 126, 2], [0.3, 0.05, 158, 3], [0.62, 0.045, 140, 4], [-0.86, 0.05, 170, 5]];
const RIVERS = [
  { pts: [[-9, 84], [-13, 92], [-17, 100], [-22, 109], [-28, 118], [-34, 128], [-40, 138], [-47, 149], [-53, 160], [-60, 172], [-67, 186]], w0: 1.1, w1: 2.8, s: 1 },
  { pts: [[14, 82], [17, 90], [21, 99], [26, 109], [32, 119], [38, 130], [44, 141], [51, 152], [58, 165], [63, 178]], w0: 1.0, w1: 2.5, s: 2 },
  { pts: [[22, 103], [18, 112], [15, 123], [10, 135], [7, 147], [3, 159], [0, 172], [-2, 186]], w0: 0.7, w1: 2.0, s: 3 }
];
function riverPts(r) {
  const out = [];
  for (let i = 0; i + 1 < r.pts.length; i++) {
    const ax = VX + r.pts[i][0], ay = r.pts[i][1] + VO, bx = VX + r.pts[i + 1][0], by = r.pts[i + 1][1] + VO, n = Math.ceil(Math.hypot(bx - ax, by - ay) * 3);
    for (let k = 0; k < n; k++) {
      const t = (i + k / n) / (r.pts.length - 1), x = lerp(ax, bx, k / n) + Math.sin(t * 23 + r.s) * 0.8, y = lerp(ay, by, k / n);
      out.push([x, y, lerp(r.w0, r.w1, t) * (0.85 + 0.3 * fbm(t * 9, r.s)), t]);
    }
  }
  return out;
}
function paintVolcano() {
  const b = new Buf(W + 20, H, -10, 0);
  for (let x = -10; x < W + 10; x++) {
    const top = Math.round(vProf(x)), jt = VY + 74 + 8 * fbm(x / 26, 12) - 5 * fbm(x / 6, 13), side = x < VX;
    for (let y = Math.max(0, top); y < H; y++) {
      const dy = y - VY, a = (x - VX) / (dy + 18);
      let l;
      if (y > jt) {
        // jungle: clumps of canopy, the tops of the clumps catching the light
        const t1 = vn2(x / 3.1, y / 2.4, 31), t2 = vn2(x / 3.1, (y - 1.5) / 2.4, 31);
        l = (side ? 2.4 : 1.5) + (t1 - 0.5) * 2.2 + (t1 > t2 + 0.05 ? 1 : t1 < t2 - 0.05 ? -0.8 : 0) - ss(jt, jt + 40, y) * 0.8;
        if (y - jt < 1.5) l += 1.2;
        b.set(x, y, P(JUNG[clamp(Math.floor(l + bay(x, y) - 0.5), 0, 5)]));
        continue;
      }
      l = side ? 3.3 : 1.8;
      l += (1 - ss(VY, VY + 75, y)) * (side ? 2.1 : 1.0);            // the upper slopes catch the last light
      l -= ss(VY + 40, VY + 110, y) * 0.7;
      const rp = a * 5.4 + (fbm(a * 2.5 + 7, 22) - 0.5) * 3 + (fbm(y / 9 + a * 3, 24) - 0.5) * 0.7, fr = rp - Math.floor(rp);
      l += fr < 0.16 ? 1.1 : fr < 0.5 ? 0.2 : fr < 0.72 ? -0.6 : -1.1;   // ridges: a lit crest, the face, shadow, a gully
      l += (fbm2(x / 14, y / 10, 23, 2) - 0.5) * 1.1;
      for (const [ac, hw, ye, s] of OLDF) {
        const d = Math.abs(a - ac + (fbm(y / 7, s) - 0.5) * 0.06), w = hw * (0.5 + 0.5 * ss(VY, VY + 40, y));
        if (y < ye + VO - fbm(x / 5, s) * 12 && d < w) l = d > w - 0.012 && side ? 3 : 0.6 + (h2(x, y, s) > 0.8 ? 1 : 0);
      }
      if (y - top < 1) l += 1.2;
      b.set(x, y, P(ROCK[clamp(Math.floor(l + (bay(x, y) - 0.5) * 0.7), 0, 7)]));
    }
  }
  // crowns poking above the jungle edge: round canopy trees and small palms
  const jtop = x => VY + 74 + 8 * fbm(x / 26, 12) - 5 * fbm(x / 6, 13);
  for (let x = -6, i = 0; x < W + 6; x += 4 + Math.round(h2(i, 1, 35) * 6), i++) {
    const jt = jtop(x);
    if (jt < vProf(x) + 4) continue;
    const side = x < VX, r = 1.8 + h2(i, 2, 35) * 2.2;
    b.disc(x, jt - r * 0.5, r, P(JUNG[side ? 2 : 1]));
    b.disc(x - 0.6, jt - r * 0.5 - 0.8, Math.max(0.5, r - 1.2), P(JUNG[side ? 4 : 3]));
  }
  for (const [x, h, lean, s] of [[128, 8, 0.6, 21], [378, 8, 0.7, 23], [404, 10, -0.6, 24], [446, 8, 0.5, 25]]) palm(b, x, Math.round(jtop(x)) + 1, h, lean, s, P(x < VX ? '#1c2c20' : '#16221a'), 0.45);
  // glow of the fresh lava on the slopes around it
  const glow = new Float32Array(b.w * b.h), rivs = RIVERS.map(r => { const pts = riverPts(r), i = pts.findIndex(([x, y]) => y > jtop(x) + 3); return i < 0 ? pts : pts.slice(0, i); });
  for (const pts of rivs) for (const [x, y, w] of pts) {
    const R2 = w + 8;
    for (let j = -Math.ceil(R2); j <= R2; j++) for (let i = -Math.ceil(R2); i <= R2; i++) {
      const d = Math.hypot(i, j), idx = b.at(x + i, y + j);
      if (idx < 0 || d > R2) continue;
      glow[idx] = Math.max(glow[idx], Math.pow(1 - d / R2, 1.7) * 0.85);
    }
  }
  for (let i = 0; i < glow.length; i++) if (glow[i] > 0.02 && b.d[i]) {
    const x = (i % b.w) + b.x0, y = Math.floor(i / b.w), g = glow[i] + (bay(x, y) - 0.5) * 0.12;
    b.d[i] = tint(b.d[i], g > 0.5 ? '#e0602c' : '#a83a26', Math.min(0.85, g * 1.1));
  }
  // the rivers: dark red banks, orange body, yellow core, white-hot near the crater; crusted stretches further down
  for (const pts of rivs) for (const [x, y, w] of pts) b.disc(x, y, w + 0.6, P('#a8301a'));
  for (const pts of rivs) for (const [x, y, w, t] of pts) b.disc(x, y, Math.max(0, w - 0.3), P(t > 0.75 ? '#e8501e' : '#ff7a1a'));
  rivs.forEach((pts, ri) => { for (const [x, y, w, t] of pts) if (w > 1.1) { const hot = fbm(t * 11, ri + 40) - t * 0.35; b.disc(x, y, w - 1.1, P(hot > 0.42 ? '#ffd23f' : hot > 0.2 ? '#ffa02a' : '#ff7a1a')); } });
  for (const pts of rivs) for (const [x, y, w, t] of pts) if (t < 0.35 && hsh(x * 3.1 + y) > 0.55) b.set(x, y, P('#fff1a0'));
  // smoke where the lava runs into the jungle and sets it smouldering
  rivs.forEach((pts, ri) => {
    const hit = pts[pts.length - 1];
    for (let k = 0; k < 14; k++) {                       // the lava glowing through the canopy below the edge
      const gx = hit[0] + (h2(k, ri, 37) - 0.5) * 8 + (k - 7) * 0.3 * (ri === 1 ? 1 : -1), gy = hit[1] + 2 + k * 1.6;
      b.set(gx, gy, P(k < 5 ? '#ff8a2a' : '#c8401a')); if (k < 8) b.set(gx + 1, gy, P('#a8301a'));
    }
    // a thin wisp of smoke leaning away with the wind
    for (let k = 0; k < 7; k++) {
      const px = hit[0] + 1 + k * k * 0.35 + (h2(k, ri, 36) - 0.5) * 1.5, py = hit[1] - 2 - k * 3.2, r = 0.8 + k * 0.45;
      b.disc(px, py, r, P(k < 2 ? '#7a3c34' : k < 4 ? '#5e4048' : '#4c3e46'), undefined);
      if (r > 1.2) b.disc(px - 0.5, py - 0.6, r - 0.9, P(k < 2 ? '#a85a40' : '#6e5660'));
    }
  });
  // crater: the rim glows where the lava inside lights it, the notch spills over
  for (let x = VX - RIMW - 2; x <= VX + RIMW + 2; x++) {
    const top = Math.round(vProf(x)), k = 1 - Math.abs(x - VX) / (RIMW + 3);
    b.set(x, top, P(k > 0.5 ? '#ffd23f' : '#ff8a2a'));
    if (k > 0.3) b.set(x, top + 1, P(k > 0.7 ? '#ff8a2a' : '#c8401a'));
    if (k > 0.6 && hsh(x * 1.3) > 0.4) b.set(x, top + 2, P('#a8301a'));
  }
  return b.canvas();
}

// The ash plume: a billowing column out of the crater, bending right with the wind at the top; dark ash lit pink on
// its left by the dusk sky and orange underneath by the eruption
function paintPlume() {
  const b = new Buf(W + 20, H, -10, 0), puffs = [];
  for (let i = 0; i <= 70; i++) {
    const s = i / 70, y = VY - 7 - s * (VY + 40), x = VX + 1 + 140 * Math.pow(s, 2.3) + 5 * s, r = 9 + 27 * Math.pow(s, 0.7);
    for (let k = 0; k < 5; k++) {
      const o = (h2(i, k, 41) - 0.5) * r * 1.35, rr = r * (0.42 + 0.42 * h2(i, k, 42));
      puffs.push([x + o, y + (h2(i, k, 43) - 0.5) * r * 0.8, rr]);
    }
  }
  for (let i = 0; i < 24; i++) puffs.push([366 + i * 6.2 + (h2(i, 1, 44) - 0.5) * 10, 3 + (h2(i, 2, 44) - 0.5) * 14 + i * 0.7, 9 + 10 * h2(i, 3, 44)]);
  puffs.sort((p, q) => q[1] - p[1]);
  const A0 = P('#271b23'), A1 = P('#392830'), A2 = P('#533a46'), A3 = P('#7a5262');
  for (const [x, y, r] of puffs) b.disc(x + 0.8, y + 1.2, r, A0);
  for (const [x, y, r] of puffs) b.disc(x - 0.5, y - 0.8, r - 1, A1);
  for (const [x, y, r] of puffs) if (r > 3) b.disc(x - r * 0.32, y - r * 0.34, r * 0.52, A2, A1);
  for (const [x, y, r] of puffs) if (r > 7) b.disc(x - r * 0.46, y - r * 0.44, r * 0.24, A3, A2);
  for (let i = 0; i < b.d.length; i++) {
    if (!b.d[i]) continue;
    const x = (i % b.w) + b.x0, y = Math.floor(i / b.w);
    const k = ss(VY - 72, VY - 4, y) * clamp(1 - Math.abs(x - VX - 3) / 44, 0, 1);
    if (k > 0.02) { const g = k + (bay(x, y) - 0.5) * 0.15; b.d[i] = tint(b.d[i], g > 0.6 ? '#f07a34' : g > 0.35 ? '#c8502e' : '#8a3a30', Math.min(0.9, g * 1.1)); }
  }
  return b.canvas();
}

// The lava fountain over the crater, and lava bombs arcing far away (live)
function fountain(ox) {
  const cx = VX + ox;
  // jets: three columns of lava thrown up out of the vent, bright at the root, breaking into blobs at the top
  for (const [dx, hgt, lean] of [[-1, 24, -0.12], [-6, 15, -0.45], [5, 17, 0.4]]) {
    for (let y = 0; y < hgt; y++) {
      const k = y / hgt, x = Math.round(cx + dx + lean * y + Math.sin(y * 0.6 + G.t * 0.3) * 0.5), w = k < 0.5 ? 3 : 2;
      ctx.fillStyle = k < 0.25 ? '#fff1a0' : k < 0.55 ? '#ffd23f' : k < 0.8 ? '#ffa02a' : '#ff7a1a';
      ctx.fillRect(x - (w >> 1), VY - 2 - y, w, 1);
    }
  }
  for (let i = 0; i < 70; i++) {
    const ph = (G.t * 0.016 + hsh(i * 3.3 + 0.2)) % 1, a = -Math.PI / 2 + (hsh(i * 5.1) - 0.5) * (i < 24 ? 0.7 : 1.6), v = 1.4 + hsh(i * 7.9) * 1.3, T = ph * 48;
    const x = Math.round(cx + Math.cos(a) * v * T), y = Math.round(VY - 4 + Math.sin(a) * v * T + 0.055 * T * T);
    if (y > VY + 3) continue;
    const c = ph < 0.16 ? '#fff1a0' : ph < 0.4 ? '#ffd23f' : ph < 0.66 ? '#ff8a1a' : '#c8401a', s = ph < 0.28 ? 2 : 1;
    ctx.fillStyle = c; ctx.fillRect(x, y, s, s);
  }
  // the dome of lava welling over the vent
  ctx.fillStyle = '#c8401a'; ctx.fillRect(cx - 12, VY, 25, 2);
  ctx.fillStyle = '#ff8a1a'; ctx.fillRect(cx - 11, VY - 1, 23, 2); ctx.fillRect(cx - 8, VY - 3, 17, 2); ctx.fillRect(cx - 5, VY - 4, 11, 1);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(cx - 8, VY - 1, 17, 1); ctx.fillRect(cx - 6, VY - 3, 13, 2);
  ctx.fillStyle = '#fff1a0'; ctx.fillRect(cx - 4, VY - 3, 9, 1); ctx.fillRect(cx - 2, VY - 4, 5, 1);
  for (let i = 0; i < 4; i++) {
    const ph = (G.t * 0.006 + i * 0.27) % 1, dir = i % 2 ? 1 : -1, T = ph * 90, vx = dir * (0.6 + 0.25 * i), vy = -2.6 - 0.2 * i;
    for (let k = 5; k >= 0; k--) {
      const tt = T - k * 1.6, px = Math.round(cx + vx * tt), py = Math.round(VY - 6 + vy * tt + 0.04 * tt * tt);
      ctx.fillStyle = k === 0 ? '#ffe9a0' : k < 2 ? '#ff9a2e' : k < 4 ? '#c8401a' : '#5a2a28';
      ctx.fillRect(px, py, k === 0 ? 2 : 1, k === 0 ? 2 : 1);
    }
  }
}

// ============================================================
// MID: a jungle ridge with palm silhouettes on the left, dark ridges at the volcano's foot on the right
// ============================================================
function palm(b, x, base, h, lean, s, C, scale = 1) {
  let tx = x, ty = base;
  for (let i = 0; i <= h; i++) {
    const k = i / h;
    tx = Math.round(x + lean * k * k * h * 0.45); ty = base - i;
    b.set(tx, ty, C); b.set(tx + 1, ty, C);
    if (i < 2) { b.set(tx - 1, ty, C); b.set(tx + 2, ty, C); }
    if (i % 3 === 1 && i < h - 2) b.set(tx + (lean > 0 ? -1 : 2), ty, C);
  }
  // crown: hand-shaped fronds (feathers whose leaflets hang in a jagged fringe), mirrored left and right
  const cx = tx + 0.5, cy = ty + 0.5;
  PALM_FRONDS.forEach((pts, f) => {
    for (const m of f === 3 ? [1] : [1, -1]) {
      const sc = (0.78 + 0.32 * h2(f, m + 3, s)) * scale, sh = (h2(f, m + 7, s) - 0.5) * 0.25;
      b.poly(pts.map(([u, v]) => [cx + m * (u * sc) + v * sh, cy + v * sc + (m * u * sc) * sh * 0.3]), C);
    }
  });
  b.disc(cx, cy + 1, 1.6 * scale, C);
}
const PALM_FRONDS = [
  [[0, -1], [5, -4], [10, -4.5], [14, -3], [17, 0], [19, 5], [17.5, 5], [16.5, 3], [15.5, 5.5], [14.5, 2], [13, 4.5], [12, 1], [10.5, 3.5], [9.5, 0.5], [8, 3], [7, 0], [5.5, 2], [4, -0.5], [2.5, 1.5], [1, 0.5]],
  [[0, -1], [3, -6], [7, -9], [11, -10], [14.5, -9], [16.5, -7], [15, -6.5], [14, -8], [13.5, -6], [12, -8], [11, -6], [9.5, -7.5], [8.5, -5], [7, -6], [5.5, -3.5], [4, -3.5], [2, -1]],
  [[0, 0], [4, 0.5], [7, 2.5], [9.5, 6.5], [8.5, 7.5], [7.5, 5.5], [6.5, 7], [5.5, 4], [4, 5], [3, 2.5], [1.5, 2.5]],
  [[-0.5, -1], [-1.5, -6], [0, -10.5], [2, -11.5], [3, -10], [1.5, -9], [2, -7], [0.5, -6], [1, -3]]
];
function paintMid() {
  const b = new Buf(W + 20, H, -10, 0);
  for (let x = -10; x < 160; x++) {
    const top = Math.round(150 + 0.0035 * x * x + 6 * fbm(x / 17, 61) + 3 * fbm(x / 5, 62));
    for (let y = top; y < H; y++) {
      const n = vn2(x / 2.6, y / 2.2, 63);
      let c = n > 0.62 ? '#2a1f27' : n > 0.35 ? '#211922' : '#1a131c';
      if (y === top) c = '#6a3038'; else if (y === top + 1 && n > 0.5) c = '#40242f';
      b.set(x, y, P(c));
    }
  }
  const C = P('#170f19');
  for (const [x, base, h, lean, s] of [[4, 152, 25, 0.5, 1], [22, 155, 19, 0.9, 2], [46, 158, 22, -0.6, 3], [-8, 158, 15, 0.8, 6], [128, 146, 17, -0.8, 7]]) palm(b, x, base, h, lean, s, C);
  for (let x = 220; x < W + 10; x++) {
    const top = Math.round(178 + 7 * fbm(x / 30, 64) - 9 * Math.max(0, Math.sin((x - 330) / 40)) + 2 * fbm(x / 6, 65));
    for (let y = top; y < H; y++) {
      const n = vn2(x / 3, y / 2.5, 66);
      b.set(x, y, P(y === top ? '#6a3036' : n > 0.6 ? '#30222a' : '#261b23'));
    }
  }
  return b.canvas();
}

// ============================================================
// THE CLIFF WALL: a basalt cliff behind the river, hazy with heat and smoke, columnar jointing on its face and stepped
// columns along its top; taller around the lava fall, which pours from a notch at FALL
// ============================================================
const FALL = [96, 111, 155];   // x0, x1, lip y (screen at CAM0, parallax 0.55)
function wallTopAt(x) {
  let top = 181 + 9 * fbm(x / 40, 70) + 5 * (fbm(x / 9, 73) - 0.5);
  top = lerp(top, 137 + 7 * fbm(x / 11, 74) + Math.abs(x - 104) * 0.12, 1 - ss(34, 64, Math.abs(x - 104)));
  if (x > 405) top = lerp(top, 165 + 7 * fbm(x / 13, 75), ss(405, 450, x));
  return top;
}
// two tiers like real basalt cliffs: thin fanned columns on top (the entablature), thick regular columns below
function paintWall() {
  const b = new Buf(W + 20, H, -10, 0);
  for (let x = -14, i = 0; x < W + 14; i++) {
    const w = 7 + Math.round(h2(i, 1, 71) * 5), c = x + w / 2, a = Math.max(2, Math.round(w * 0.32));
    let top = Math.round(wallTopAt(c) + (h2(i, 2, 71) - 0.5) * 7);
    if (c >= FALL[0] - 4 && c <= FALL[1] + 4) top = FALL[2] + 1;
    const tier = top + 14 + Math.round(fbm(c / 23, 76) * 10);
    const joints = new Set();
    for (let j = tier + 6 + Math.round(h2(i, 6, 71) * 10); j < 240; j += 11 + Math.round(h2(i, j, 72) * 13)) joints.add(j);
    for (let X = x; X < x + w; X++) {
      const lx = X - x;
      for (let Y = top - 1; Y < 240; Y++) {
        let col;
        if (Y < top + 1) col = Y === top - 1 ? '#86566e' : '#66425a';
        else if (Y < tier) {
          const tilt = (fbm(X / 17, 77) - 0.5) * 1.7, xx = X + (Y - top) * tilt * 0.4, k = Math.floor(xx / 3.4), f = xx / 3.4 - k;
          col = f < 0.24 ? '#20111c' : (k & 1) ? '#3c2335' : '#342030';
          if (Y < top + 3 && f >= 0.24) col = '#4a2c40';
          if (h2(X, Y, 78) > 0.92) col = '#26141f';
        } else if (Y === tier) col = '#1c0f18';
        else {
          col = lx < a ? '#4e2e44' : '#3e2438';
          if (lx === a) col = '#5c3a50';
          if (lx === 0) col = '#24121f';
          if (joints.has(Y)) col = '#22111d'; else if (joints.has(Y - 1) && lx < a) col = '#603e54';
        }
        let v = P(col);
        const g = Math.pow(ss(178, 234, Y), 1.3) * 0.9;
        if (g > 0) v = tint(v, lx < a ? '#d8602a' : '#a8401c', g);
        const df = Math.min(Math.abs(X - FALL[0]), Math.abs(X - FALL[1])), inF = X >= FALL[0] && X <= FALL[1];
        if (!inF && df < 26 && Y > FALL[2] - 6) v = tint(v, '#e86a2c', Math.pow(1 - df / 26, 2) * 0.85 * (0.55 + 0.45 * ss(FALL[2], 230, Y)));
        b.set(X, Y, v);
      }
    }
    x += w;
  }
  // scrub clinging to the cliff top
  for (let x = -10; x < W + 10; x++) {
    if (fbm(x / 13, 79) < 0.55 || (x > FALL[0] - 8 && x < FALL[1] + 8)) continue;
    let top = 0; while (top < 240 && !b.get(x, top)) top++;
    const hgt = Math.round((fbm(x / 13, 79) - 0.55) * 18 + h2(x, 1, 80) * 2);
    for (let k = 1; k <= hgt; k++) b.set(x, top - k, P(k === hgt ? '#3a2a30' : '#1e1a1e'));
  }
  for (let k = 0; k < b.d.length; k++) if (b.d[k]) b.d[k] = tint(b.d[k], '#7a3448', 0.1);
  // the far edge of the river under the wall
  for (let X = -10; X < W + 10; X++) for (let Y = 226; Y < 240; Y++) {
    const n = fbm2(X / 9, Y / 1.5, 77, 2) + (Y - 226) * 0.012;
    b.set(X, Y, P(Y === 226 ? '#ff9a3a' : n > 0.62 ? '#ffd23f' : n > 0.45 ? '#ffa02a' : n > 0.3 ? '#ff7a1a' : '#d84a1a'));
  }
  return b.canvas();
}
// hard-edged disc of rects in the current fillStyle (no anti-aliasing)
function pdisc(x, y, r) {
  x = Math.round(x); y = Math.round(y);
  const n = Math.ceil(r);
  for (let j = -n; j <= n; j++) { const q = r * r - j * j + r * 0.8; if (q >= 0) { const hw = Math.round(Math.sqrt(q)); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); } }
}
// The lava fall (live): streaks sliding down, lava curling over the lip, a splash and steam at the foot
function lavaFall(ox) {
  const x0 = FALL[0] + ox, x1 = FALL[1] + ox, y0 = FALL[2], y1 = 228;
  const gl = ctx.createLinearGradient(x0 - 22, 0, x1 + 22, 0);
  gl.addColorStop(0, 'rgba(255,120,40,0)'); gl.addColorStop(0.35, 'rgba(255,130,40,0.22)'); gl.addColorStop(0.65, 'rgba(255,130,40,0.22)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = gl; ctx.fillRect(x0 - 22, y0 - 6, x1 - x0 + 45, y1 - y0 + 6);
  for (let y = y0; y < y1; y++) {
    const spread = Math.round(ss(y0 + 30, y1, y) * 2);              // a little wider toward the foot
    const L = x0 - spread + Math.round(Math.sin(y * 0.21 + G.t * 0.08) * 0.6), Rr = x1 + spread;
    for (let x = L; x <= Rr; x++) {
      const k = (x - L) / (Rr - L), e = Math.min(k, 1 - k), sp = 2.1 + hsh(x * 3.3) * 1.3, ph = hsh(x * 7.1) * 40, len = 17 + Math.round(hsh(x * 2.9) * 10);
      const s = ((y - G.t * sp + ph) % len + len) % len;
      let c = e < 0.06 ? '#a8301a' : e < 0.16 ? '#ff7a1a' : e < 0.3 ? '#ffa52a' : '#ffd23f';
      if (s < 2 && e > 0.1) c = '#fff1a0';
      else if (s > len - 4 && s < len - 2 && e > 0.12) c = '#e0501a';
      ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1);
    }
  }
  // the lip: a tongue of lava rolling over the edge, thickest in the middle
  const mid = (x0 + x1) / 2, hw = (x1 - x0) / 2 + 1.5;
  for (let x = Math.floor(mid - hw); x <= Math.ceil(mid + hw); x++) {
    const k = (x - mid) / hw, bul = Math.round(2.4 * (1 - k * k));
    for (let j = 0; j <= bul + 1; j++) {
      const y = y0 + 1 - j, top = j === bul + 1;
      ctx.fillStyle = top ? (Math.abs(k) > 0.8 ? '#c8401a' : '#ff8a2a') : j === bul ? (Math.abs(k) < 0.6 ? '#fff1a0' : '#ffd23f') : Math.abs(k) > 0.85 ? '#c8401a' : j > bul - 2 ? '#ffd23f' : '#ffa52a';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // thin trickles seeping down the cliff beside the fall
  for (const [tx, ty0, s] of [[x0 - 7, y0 + 10, 1], [x1 + 9, y0 + 30, 3]]) {
    for (let y = ty0; y < 226; y++) {
      const X = tx + Math.round(Math.sin(y * 0.13 + s) * 1.2), ph = ((y - G.t * 1.6 + s * 13) % 11 + 11) % 11;
      ctx.fillStyle = ph < 1.2 ? '#ffc23a' : '#b8401a'; ctx.fillRect(X, y, 1, 1);
    }
  }
  // splash and spray at the foot
  const fx = (x0 + x1) / 2;
  ctx.fillStyle = '#ff8a2a'; ctx.fillRect(fx - 16, 223, 33, 7);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(fx - 13, 222, 27, 5); ctx.fillRect(fx - 18, 227, 37, 2);
  ctx.fillStyle = '#fff1a0'; ctx.fillRect(fx - 9, 222, 19, 3); ctx.fillRect(fx - 4, 220, 9, 2);
  for (let i = 0; i < 20; i++) {
    const ph = (G.t * 0.03 + hsh(i * 4.1)) % 1, a = -Math.PI / 2 + (hsh(i * 2.3) - 0.5) * 2.6, v = 0.9 + hsh(i * 6.7) * 1.1, T = ph * 22;
    const x = Math.round(fx + Math.cos(a) * v * T), y = Math.round(222 + Math.sin(a) * v * T + 0.08 * T * T);
    if (y > 228) continue;
    ctx.fillStyle = ph < 0.4 ? '#fff1a0' : ph < 0.7 ? '#ffb52e' : '#e0501a'; ctx.fillRect(x, y, 1, ph < 0.3 ? 2 : 1);
  }
  for (let i = 0; i < 8; i++) {
    const ph = (G.t * 0.006 + i / 8) % 1, x = Math.round(fx - 9 + hsh(i * 3.9) * 18 + ph * 12), y = Math.round(219 - ph * 52), r = 2 + ph * 7;
    ctx.globalAlpha = 0.5 * (1 - ph);
    ctx.fillStyle = '#7a5a66'; pdisc(x, y, r);
    ctx.fillStyle = '#b07a80'; pdisc(x - 1, y - 1, r * 0.55);
  }
  ctx.globalAlpha = 1;
}

// ============================================================
// THE BASALT COLUMNS (the platforms): clusters of hexagonal columns, a back row in shadow and a front row whose
// lit caps are the platforms; dusk light on top, the lava's glow from below; 1px OUT outline per cluster
// ============================================================
const CLUSTERS = [
  { rim: [0, 1], back: [[-10, 14, 184], [4, 16, 172], [20, 14, 186], [34, 16, 178]], front: [[-10, 24, 198], [14, 20, 190], [34, 20, 200], [54, 12, 212]] },
  { rim: [0, 1], back: [[150, 16, 178], [168, 14, 168], [222, 14, 178]], front: [[146, 18, 204], [164, 20, 194], [184, 32, 182], [216, 22, 192]] },
  { rim: [1, 0], back: [[328, 14, 156], [362, 16, 160], [384, 12, 170]], front: [[324, 20, 184], [344, 30, 168], [374, 22, 180], [396, 8, 198]] },
  { rim: [1, 0], back: [[462, 16, 182]], front: [[450, 26, 198], [476, 26, 206]] }
];
const PLATS = [];
for (const cl of CLUSTERS) for (const [x, w, top] of cl.front) if (w >= 12) PLATS.push({ x: CAM0 + x, y: top, w, t: 'col' });
const COLK = {
  front: { hot: true, cap: '#6c5a72', capF: '#806a84', capL: '#b898aa', capD: '#40344a', f: ['#4b3d56', '#30263a', '#1c1725'], e01: '#66546f', e12: '#130f19', jn: '#110d17', jl: '#58496a', warm: ['#e06a2c', '#b0441e', '#6a2416'] },
  fore: { cap: '#4e4056', capF: '#5c4c64', capL: '#8a7088', capD: '#2c2434', f: ['#2e2536', '#1f1928', '#141019'], e01: '#40344a', e12: '#0c0910', jn: '#0a080e', jl: '#3a3044', warm: ['#c8582a', '#90361a', '#521c12'] },
  back: { cap: '#4a3d50', capF: '#56465c', capL: '#72586e', capD: '#2c2434', f: ['#30273a', '#231c2c', '#17121e'], e01: '#3e3448', e12: '#0e0b13', jn: '#0c0910', jl: '#382e42', warm: ['#94401e', '#6a2a18', '#461a12'] }
};
// one hexagonal column: three vertical faces (lit left, front, dark right), a hexagonal cap seen a little from
// above (lit front rim, darker back edge), cross joints that follow the cap's outline, chipped corners
function paintCol(b, x, w, top, bot, K, seed, w0, w1) {
  const a = Math.max(2, Math.round(w * 0.22)), cd = w >= 18 ? 2 : 1;
  const joints = new Set();
  for (let j = 9 + Math.round(h2(seed, 1, 81) * 9); j < bot - top; j += 12 + Math.round(h2(seed, j, 82) * 12)) joints.add(j);
  for (let X = x; X < x + w; X++) {
    const lx = X - x, face = lx < a ? 0 : lx >= w - a ? 2 : 1;
    const yf = face === 0 ? top + Math.round(cd * lx / a) : face === 2 ? top + Math.round(cd * (w - 1 - lx) / a) : top + cd;
    const yb = 2 * top - yf - 1;
    for (let Y = yb; Y <= yf; Y++) {
      let c = Y === yf ? (face === 2 ? K.cap : K.capL) : Y === yb ? K.capD : Y >= yf - 1 ? K.capF : K.cap;
      if (Y > yb && Y < yf - 1 && h2(X, Y, seed + 3) > 0.86) c = K.capD;
      b.set(X, Y, P(c));
    }
    for (let Y = yf + 1; Y < bot; Y++) {
      const rel = Y - yf;
      let c = K.f[face];
      if (face === 0 && lx === a - 1) c = K.e01;
      if (face === 1 && lx === w - a) c = K.e01;
      if (face === 2 && lx === w - a) c = K.e12;
      if (lx === 0) c = K.e12;
      // chipped corners at the joints: the edge pixel is knocked out
      if ((lx === 0 || lx === w - 1) && (joints.has(rel) || joints.has(rel + 1)) && h2(X, rel, seed + 5) > 0.45) continue;
      // low joints of the front row glow: lava seeping up through the cracks
      if (joints.has(rel) && K.hot && Y > LAVA_Y - 34 && h2(seed, rel, 83) > 0.35 && h2(Math.floor((lx + seed) / 4), rel, seed + 85) > 0.45) { b.set(X, Y, P(face === 2 ? '#b8401a' : h2(X, Y, 84) > 0.7 ? '#ffd23f' : '#ff8a2a')); continue; }
      if (joints.has(rel)) c = K.jn;
      else if (joints.has(rel - 1) && face < 2) c = K.jl;
      let v = P(c);
      if (h2(X, Y, seed) > 0.95) v = tint(v, '#0c0910', 0.4);
      else if (face < 2 && h2(X, Math.floor(Y / 4), seed + 9) > 0.85) v = tint(v, '#7a6880', 0.16);
      const k = Math.pow(ss(w0 == null ? top + 4 : w0, w1 == null ? LAVA_Y + 2 : w1, Y), 1.7) * 0.94;
      if (k > 0) v = tint(v, K.warm[face], k);
      b.set(X, Y, v);
    }
  }
}
function buildClusters() {
  return CLUSTERS.map((cl, n) => {
    const all = cl.back.concat(cl.front);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity;
    for (const [x, w, top] of all) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + w); y0 = Math.min(y0, top); }
    const b = new Buf(x1 - x0 + 4, LAVA_Y + 8 - (y0 - 6), x0 - 2, y0 - 6);
    cl.back.forEach(([x, w, top], i) => paintCol(b, x, w, top, LAVA_Y + 6, COLK.back, n * 10 + i));
    cl.front.forEach(([x, w, top], i) => paintCol(b, x, w, top, LAVA_Y + 6, COLK.front, n * 10 + i + 5));
    outlineBuf(b, OUT, false);
    const o = P(OUT), RIM = '#ff9a4a';
    for (let y = 0; y < b.h; y++) for (let x = 1; x < b.w - 1; x++) {
      const i = y * b.w + x, v = b.d[i];
      if (!v || v === o) continue;
      const Y = y + b.y0, k = ss(150, 228, Y) * 0.65;
      if (cl.rim[1] && b.d[i + 1] === o && (x + 2 >= b.w || !b.d[i + 2])) b.d[i] = tint(v, RIM, 0.3 + k);
      if (cl.rim[0] && b.d[i - 1] === o && (x - 2 < 0 || !b.d[i - 2])) b.d[i] = tint(v, RIM, 0.3 + k);
    }
    return { c: b.canvas(), x: x0 - 2, y: y0 - 6 };
  });
}

// ============================================================
// THE LAVA RIVER (near band): molten orange with yellow currents and white-hot glints, plates of dark crust with
// glowing cracks drifting on it, features growing toward the viewer
// ============================================================
function lavaCol(x, y) {
  const r = y - LAVA_Y, sc = 1 + r * 0.06;
  if (r < 1) return hsh(x * 0.71) > 0.35 ? '#fff1a0' : '#ffd23f';
  if (r < 2) return hsh(x * 1.37) > 0.5 ? '#ffd23f' : '#ffa52a';
  const n = fbm2(x / (16 * sc), r / (3.4 * sc), 91, 3) + (bay(x, y) - 0.5) * 0.06;
  const V = vor(x / (24 * sc), r / (6.5 * sc), 93), edge = V[1] - V[0];
  const crusty = fbm2(x / 90, r / 14, 95, 2);
  if (crusty > 0.54 && edge > 0.09 + (1 - crusty) * 0.35) {
    // a raft of dark crust, its rim glowing where it cracks away from the melt
    if (edge < 0.15) return '#ffb52e';
    if (edge < 0.22) return '#c8401a';
    const t2 = vn2(x / 3, r / 1.5, 96);
    return t2 > 0.75 ? '#6e2a18' : t2 > 0.3 ? '#4e1c12' : '#3e160f';
  }
  const t = n + (r < 8 ? 0.12 : 0) - r * 0.005;
  return t > 0.7 ? '#fff1a0' : t > 0.58 ? '#ffd23f' : t > 0.45 ? '#ffa02a' : t > 0.33 ? '#ff7a1a' : '#e0501a';
}
function buildLava() {
  const b = new Buf(W + 40, H - LAVA_Y + 4, -20, LAVA_Y);
  for (let y = LAVA_Y; y < H + 4; y++) for (let x = -20; x < W + 20; x++) b.set(x, y, P(lavaCol(x + CAM0, y)));
  return b.canvas();
}

// ============================================================
// LAVA SHARK: a robot shark (gunmetal back, white belly, a row of red-hot armour plates, one red eye in a visor,
// metal teeth, a glowing furnace throat). Painted straight (facing right, u along the body, v down, design units
// scaled by F), then bent into the leap along a circular arc by nearest-pixel mapping, then outlined.
// ============================================================
const SPAL = {
  k: OUT, a: '#a7b0c4', b: '#757e93', c: '#50576b', d: '#373b4d',
  w: '#fff4e6', x: '#e4ccb8', y: '#b9957f', z: '#ffc48a',
  h: '#fff1a0', i: '#ffc23a', j: '#ff8a1a', l: '#e0501a', m: '#9a2c14', n: '#3a1812',
  e: '#ff3b30', g: '#ffd6c8', v: '#1c1e28', t: '#eef3f7', s: '#9aa6b4', o: '#ffd23f', p: '#ff8a1a', q: '#a3301a', r: '#d8e0ea'
};
const F = 1.14, SL = 58 * F;
const STOP = [[-1, -2.5], [4, -3], [10, -4.5], [18, -7.5], [26, -9.5], [34, -10.5], [42, -10.5], [48, -9.5], [53, -7.5], [57, -5], [60, -2.5], [61, -1]];
const SBOT = [[-1, 2.5], [4, 3], [10, 4.5], [18, 7], [26, 8.5], [34, 9.5], [40, 9.5], [44, 8.5], [50, 7], [55, 5], [59, 2.5], [61, 0.5]];
const SBEL = [[-1, 0.5], [10, 1.5], [24, 2.5], [36, 3], [43, 3.5]];
function curve(pts, u) {
  if (u <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (u <= pts[i][0]) { const a = pts[i - 1], b = pts[i], k = (u - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], k * k * (3 - 2 * k)); }
  return pts[pts.length - 1][1];
}
const JAW = 0.46, HINGE = [43, 4.5];
const gum = u => lerp(3.4, 0.6, clamp((u - 43) / 17, 0, 1));
function paintShark() {
  const G2 = new Grid(110, 76, -24, -38);
  const set = (u, v, c) => G2.set(u * F, v * F, c);
  const poly = (pts, c) => G2.poly(pts.map(([u, v]) => [u * F, v * F]), c);
  const line = (u0, v0, u1, v1, c0, c1, n) => { for (let k = 0; k <= n; k++) set(lerp(u0, u1, k / n), lerp(v0, v1, k / n), k > n * 0.6 && c1 ? c1 : c0); };
  // body (the lower jaw is painted later, opened about the hinge)
  for (let px = Math.floor(-1 * F); px <= Math.ceil(61 * F); px++) {
    const u = px / F, t = Math.round(curve(STOP, u) * F), bo = Math.round((u > 43 ? gum(u) : curve(SBOT, u)) * F), be = curve(SBEL, Math.min(u, 43)) * F;
    for (let v = t; v <= bo; v++) {
      let c = 'b';
      if (v === t) c = 'a';
      else if (u <= 43 && v >= be) c = v >= bo ? 'z' : v < be + 1.5 ? 'x' : 'w';
      else if (u <= 43 && v >= be - 1.5) c = 'c';
      if (u > 43 && v >= gum(u) * F - 1.4) c = 'x';
      G2.set(px, v, c);
    }
  }
  // tail fin: a crescent, the upper lobe longer, hot along its leading edge
  poly([[3, -2], [-3, -9], [-9, -17], [-11, -17], [-7, -9], [-3, -1]], 'b');
  poly([[3, 2], [-2, 7], [-8, 12], [-10, 11], [-5, 5], [-3, 1]], 'b');
  line(-3, -3, -10, -16.5, 'l', 'j', 14); line(-3, 3, -8.5, 11, 'c', null, 10);
  set(-10.5, -17, 'i'); set(-9.5, 11, 'l');
  // second dorsal and anal fins
  poly([[13, -4], [9, -9], [7, -9], [9, -4]], 'b'); set(8, -9, 'l'); set(9, -8, 'l');
  poly([[13, 4], [9, 8], [7, 8], [9, 3]], 'c');
  // dorsal fin: hot leading edge, swept back, concave trailing edge
  poly([[39, -10], [34, -15], [30, -20], [27, -23], [25, -23], [26, -19], [27, -15], [26, -10]], 'b');
  for (let k = 0; k <= 16; k++) { const u = lerp(39, 26, k / 16), v = lerp(-10, -23, k / 16) + Math.sin(k / 16 * Math.PI) * 0.8; set(u, v, k > 11 ? 'h' : k > 5 ? 'i' : 'j'); set(u - 0.9, v + 0.9, k > 8 ? 'j' : 'l'); }
  for (let k = 0; k <= 12; k++) set(lerp(26, 27, k / 12) + Math.sin(k / 12 * Math.PI) * 1.2, lerp(-22, -11, k / 12), 'c');
  set(31, -13, 'r'); set(29, -16, 'd');
  // pectoral fin (near side, darker) with a hot tip; pelvic fin
  poly([[46, 5], [41, 6], [34, 12], [29, 17], [27, 17], [30, 12], [35, 6], [38, 3]], 'c');
  line(45, 5, 29, 16.5, 'b', 'l', 14); set(28, 17, 'j'); set(27, 17, 'l');
  poly([[22, 8], [17, 12], [15, 12], [17, 7]], 'c'); set(15, 12, 'l');
  // the red-hot armour plates along the back and over the head
  const PL = [10, 16, 22, 28, 34, 40, 46, 52, 56];
  for (let p = 0; p + 1 < PL.length; p++) {
    for (let px = Math.round(PL[p] * F); px < Math.round(PL[p + 1] * F); px++) {
      const u = px / F, t = Math.round(curve(STOP, u) * F), th = p === PL.length - 2 ? 2 : 3 + (p > 1 && p < 6 ? 1 : 0);
      for (let v = t; v < t + th; v++) {
        let c = v === t ? (px > PL[p + 1] * F - 3 ? 'h' : 'i') : v === t + th - 1 ? 'l' : 'j';
        if (px === Math.round(PL[p] * F)) c = 'n';
        G2.set(px, v, c);
      }
      G2.set(px, t + th, px === Math.round(PL[p] * F) ? 'n' : 'm');
    }
  }
  // flank panel seams with rivets, gills venting a glow
  for (const u of [19, 31]) {
    const px = Math.round(u * F), t = Math.round(curve(STOP, u) * F) + 6, be = Math.round(curve(SBEL, u) * F);
    for (let v = t; v < be - 1; v++) G2.set(px, v, 'c');
    G2.set(px - 1, t, 'a'); G2.set(px + 1, t + 1, 'r'); G2.set(px + 1, be - 3, 'r');
  }
  for (const u of [36.5, 39, 41.5]) for (let k = 0; k < 8; k++) G2.set(Math.round(u * F - k * 0.25), Math.round(-3.5 * F + k), k === 3 || k === 4 ? 'j' : k === 5 ? 'l' : 'd');
  // eye: one red lamp in a dark visor
  poly([[47, -5.6], [55, -6], [55, -1.9], [47, -1.8]], 'v');
  { const ex = Math.round(51 * F), ey = Math.round(-4.4 * F);
    G2.set(ex, ey, 'g'); G2.set(ex + 1, ey, 'e'); G2.set(ex, ey + 1, 'e'); G2.set(ex + 1, ey + 1, 'e'); G2.set(ex + 2, ey + 1, 'l'); G2.set(ex - 1, ey + 1, 'l');
    G2.set(ex + 3, ey - 1, 'r'); }
  // snout: a metal nose cone
  set(59, -2, 'r'); set(60, -1, 'a'); set(58, -3, 'a'); set(57, -4, 'a');
  // the mouth: a glowing furnace throat
  for (let px = Math.round(43 * F); px <= Math.round(60 * F); px++) for (let v = Math.round(gum(px / F) * F) + 1; v <= 16; v++) G2.set(px, v, 'q');
  const cs = Math.cos(JAW), sn = Math.sin(JAW);
  const jaw = (u, v) => [HINGE[0] + (u - HINGE[0]) * cs - (v - HINGE[1]) * sn, HINGE[1] + (u - HINGE[0]) * sn + (v - HINGE[1]) * cs];
  const unjaw = (u, v) => [HINGE[0] + (u - HINGE[0]) * cs + (v - HINGE[1]) * sn, HINGE[1] - (u - HINGE[0]) * sn + (v - HINGE[1]) * cs];
  for (let y = 0; y <= 20; y++) for (let x = Math.round(38 * F); x <= Math.round(62 * F); x++) {
    const [u, v] = unjaw(x / F, y / F), lo = curve(SBOT, u), hi = 3.6;
    const inJaw = u >= 41 && u <= 58.5 && v >= hi && v <= lo;
    if (inJaw) G2.set(x, y, v >= lo - 0.8 ? 'z' : v < hi + 1 ? 'x' : 'w');
    else if (G2.get(x, y) === 'q' && (v > hi || u > 59.5)) G2.set(x, y, '.');
  }
  for (let y = 0; y <= 18; y++) for (let x = Math.round(42 * F); x <= Math.round(62 * F); x++) if (G2.get(x, y) === 'q') {
    const d = Math.hypot(x - 45.5 * F, y - 5.5 * F);
    if (d < 2.2) G2.set(x, y, 'h'); else if (d < 5.5) G2.set(x, y, 'o'); else if (d < 12) G2.set(x, y, 'p');
  }
  for (const u of [45.5, 48.5, 51.5, 54.5, 57.5]) {
    const x = Math.round(u * F), g = Math.round(gum(u) * F) + 1;
    G2.set(x, g, 't'); G2.set(x + 1, g, 's'); G2.set(x, g + 1, 't');
    if (u > 50) G2.set(x, g + 2, 's');
  }
  for (const u of [46, 49, 52, 55]) {
    const [ju, jv] = jaw(u, 3.6), x = Math.round(ju * F), y = Math.round(jv * F);
    G2.set(x, y - 1, 't'); G2.set(x + 1, y - 1, 's'); G2.set(x, y - 2, 't');
  }
  return G2;
}
// bend the straight grid along a circular arc: mid-spine angle ang (negative = nose up), radius Rr (pixels)
function bendGrid(src, ang, Rr) {
  const L2 = SL / 2, Cx = -Rr * Math.sin(ang), Cy = Rr * Math.cos(ang), fm = Math.atan2(-Cy, -Cx);
  const fwd = (u, v) => { const f = fm + (u - L2) / Rr, r = Rr - v; return [Cx + r * Math.cos(f), Cy + r * Math.sin(f)]; };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.g[y * src.w + x] !== '.') {
    const [X, Y] = fwd(x + src.x0, y + src.y0);
    x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
  }
  x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2; x1 = Math.ceil(x1) + 2; y1 = Math.ceil(y1) + 2;
  const out = new Grid(x1 - x0 + 1, y1 - y0 + 1, x0, y0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x - Cx, dy = y - Cy, r = Math.hypot(dx, dy);
    let f = Math.atan2(dy, dx) - fm;
    while (f > Math.PI) f -= Math.PI * 2;
    while (f < -Math.PI) f += Math.PI * 2;
    const c = src.get(f * Rr + L2, Rr - r);
    if (c !== '.') out.set(x, y, c);
  }
  out.fwd = (u, v) => fwd(u * F, v * F);
  return out;
}
// A fin cutting the lava: the dorsal fin and the hot plates of the back just breaking the surface
function paintFin() {
  const g = new Grid(44, 34, -21, -29), K = 1.45;
  const set = (u, v, c) => g.set(u * K, v * K, c);
  // the back just breaking the surface: gunmetal with a row of hot plates along the spine
  for (let px = Math.round(-9 * K); px <= Math.round(9 * K); px++) {
    const u = px / K, t = Math.round(-2.6 * K * Math.cos(u / 9 * Math.PI / 2));
    for (let v = t; v <= 0; v++) g.set(px, v, v === t ? (u > 1 ? 'i' : 'j') : v === t + 1 ? 'l' : v === 0 ? 'd' : 'c');
    if (Math.abs(px) % 5 === 2 && t < -1) g.set(px, t, 'n');
  }
  g.poly([[6, -2], [3, -7], [0, -12], [-3, -15], [-5, -15], [-4, -11], [-3, -6], [-4, -2]].map(([u, v]) => [u * K, v * K]), 'b');
  for (let k = 0; k <= 16; k++) { const u = lerp(6, -4, k / 16), v = lerp(-2, -15, k / 16) + Math.sin(k / 16 * Math.PI) * 0.7; set(u, v, k > 11 ? 'h' : k > 5 ? 'i' : 'j'); set(u - 0.8, v + 0.8, k > 8 ? 'j' : 'l'); }
  for (let k = 0; k <= 12; k++) set(lerp(-5, -4, k / 12) + Math.sin(k / 12 * Math.PI) * 1.2, lerp(-14, -3, k / 12), 'c');
  set(0, -6, 'r'); set(-2, -9, 'd'); set(1.5, -4, 'a'); set(-1, -11, 'a');
  g.outline(true);
  for (let x = g.x0; x < g.x0 + g.w; x++) for (let v = 1; v < g.y0 + g.h; v++) g.set(x, v, '.');   // no outline under the waterline
  return g;
}
// lava welling around the fin's base: a bright collar over the waterline and a few splashes
function foam(x, y, dir) {
  for (let X = x - 15; X <= x + 15; X++) {
    const k = hsh(X * 1.9 + y), e = Math.abs(X - x) > 11;
    ctx.fillStyle = k > 0.55 ? '#fff1a0' : '#ffd23f'; ctx.fillRect(X, y - (e || k < 0.3 ? 0 : 1), 1, e ? 1 : 2);
    ctx.fillStyle = '#ff8a1a'; ctx.fillRect(X, y + 1, 1, 1);
  }
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#fff1a0' : '#ffb52e'; ctx.fillRect(Math.round(x + dir * (8 + i * 2)), Math.round(y - 2 - (i % 3)), 1, 1); }
}

let SPR = null;
function sprites() {
  if (SPR) return SPR;
  const bent = bendGrid(paintShark(), -0.36, 96);
  bent.outline(true);
  SPR = { leap: bent.sprite(SPAL), bend: bent, fin: paintFin().sprite(SPAL) };
  return SPR;
}

// a glowing wake behind a fin: a warning ring of ripples, two arms of bright crests spreading back, a hot trail in
// the middle, spray at the bow
function wake(x, y, dir) {
  // the lava pushed aside darkens around the fin
  ctx.fillStyle = 'rgba(60,10,6,0.4)'; ctx.fillRect(x - 14, y - 1, 29, 4);
  // a churned white-hot trail down the middle
  for (let d = 4; d < 64; d++) {
    const fade = 1 - d / 64, X = Math.round(x - dir * d);
    if (hsh(d * 1.9) < fade * 1.4) { const w = d < 20 ? 3 : d < 40 ? 2 : 1; ctx.fillStyle = d < 18 ? '#fff6d0' : '#ffd23f'; ctx.fillRect(X, Math.round(y + 1) - (w >> 1), 1, w); }
  }
  // the two arms of the V: thick white-hot crests with a dark trough outside, breaking up as they spread
  for (const side of [-1, 1]) {
    for (let d = 5; d < 68; d++) {
      const fade = 1 - d / 68;
      if (hsh(d * 2.3 + side * 5) > fade * 1.6) continue;
      const X = Math.round(x - dir * d), Y = Math.round(y + 1 + side * (1.2 + d * 0.13)), th = d < 28 ? 2 : 1;
      ctx.fillStyle = '#4a1009'; ctx.fillRect(X, side > 0 ? Y + th : Y - th, 1, 1);
      ctx.fillStyle = d < 16 ? '#fffbe6' : d < 38 ? '#fff1a0' : '#ffd23f'; ctx.fillRect(X, side > 0 ? Y : Y - th + 1, 1, th);
    }
  }
  // wave chevrons spreading back from the fin: white-hot crests, a dark trough behind each
  for (let k = 0; k < 5; k++) {
    const d0 = 9 + k * 12, hh = 2.5 + k * 1.6, a = 1 - k * 0.16;
    for (let t = -1; t <= 1.001; t += 1 / (hh * 1.6)) {
      if (Math.abs(t) < 0.22 || hsh(k * 31 + t * 17) > a + 0.1) continue;
      const X = Math.round(x - dir * (d0 + t * t * (4 + k))), Y = Math.round(y + 1 + t * hh);
      ctx.fillStyle = '#4a1009'; ctx.fillRect(X - dir, Y, 1, 1);
      ctx.fillStyle = k < 2 ? '#fff6d0' : k < 4 ? '#ffd23f' : '#ffa02a'; ctx.fillRect(X, Y, 1, 1);
      if (k < 3) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(X + dir, Y, 1, 1); }
    }
  }
  ctx.fillStyle = '#fff1a0'; ctx.fillRect(Math.round(x + dir * 7), Math.round(y) - 1, 3, 2);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(Math.round(x + dir * 4), Math.round(y) - 2, 3, 1); ctx.fillRect(Math.round(x + dir * 9), Math.round(y), 3, 1);
  for (let i = 0; i < 8; i++) {
    const ph = (G.t * 0.05 + hsh(i * 2.7)) % 1, sx = Math.round(x + dir * (6 + ph * 8 + i)), sy = Math.round(y - 2 - Math.sin(ph * Math.PI) * (4 + i % 3));
    ctx.fillStyle = ph < 0.5 ? '#ffd23f' : '#ff8a1a'; ctx.fillRect(sx, sy, 1, ph < 0.3 ? 2 : 1);
  }
}

ENEMY_TYPES.lavashark = {
  hp: 8, armored: true, contact: 'hurt',
  make(e, s) { e.mode = s.mode || 'fin'; if (e.mode === 'leap') e.hp = e.max = 60; },
  update(e) { e.vx = 0; },
  draw(e) {
    const S = sprites(), x = Math.round(e.x), y = Math.round(e.y);
    FLASH = e.hitT > 0;
    if (e.mode === 'fin') {
      wake(x, y, e.facing);
      ctx.save(); ctx.translate(x, y); ctx.scale(e.facing, 1);
      spr(S.fin, S.fin.ox, S.fin.oy);
      ctx.restore();
      foam(x, y, e.facing);
    } else {
      const gl = ctx.createRadialGradient(x, y - 4, 4, x, y - 4, 46);
      gl.addColorStop(0, 'rgba(255,130,40,0.28)'); gl.addColorStop(1, 'rgba(255,110,40,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - 46, y - 50, 92, 92);
      leapFx(e, x, y, S);
      ctx.save(); ctx.translate(x, y); ctx.scale(e.facing, 1);
      spr(S.leap, S.leap.ox, S.leap.oy);
      ctx.restore();
      drips(e, x, y, S);
    }
    FLASH = false;
  },
  box: e => e.mode === 'leap' ? { x: e.x - 30, y: e.y - 18, w: 60, h: 32 } : { x: e.x - 10, y: e.y - 20, w: 20, h: 20 },
  onKill(e, cx, cy) { boom(cx, cy, 0.9); addScore(300, cx, cy - 10); }
};
function leapFx(e, x, y, S) {
  const f = e.facing, B = S.bend, [tx, ty] = B.fwd(-6, 0), sx = Math.round(x + f * tx), sy = LAVA_Y + 2;
  ctx.fillStyle = '#ff8a1a'; ctx.fillRect(sx - 13, sy - 2, 27, 4);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(sx - 10, sy - 3, 21, 3);
  ctx.fillStyle = '#fff1a0'; ctx.fillRect(sx - 5, sy - 3, 11, 1);
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (i / 15 - 0.5) * 2.7, r = 6 + hsh(i * 3.1) * 8, px = Math.round(sx + Math.cos(a) * r * 1.25), py = Math.round(sy - 2 + Math.sin(a) * r);
    ctx.fillStyle = i % 3 ? '#ffd23f' : '#fff1a0'; ctx.fillRect(px, py, 1, 2);
    ctx.fillStyle = '#e0501a'; ctx.fillRect(px, py + 2, 1, 1);
  }
  const ty2 = Math.round(y + ty);
  for (let yy = ty2 + 4; yy < sy - 2; yy++) {
    const k = (yy - ty2) / Math.max(1, sy - ty2), wob = Math.round(Math.sin(yy * 0.5 + G.t * 0.2) * 0.7), w = 1 + Math.round(k * 2);
    ctx.fillStyle = '#ff8a1a'; ctx.fillRect(sx + wob - w, yy, w * 2 + 1, 1);
    ctx.fillStyle = k < 0.5 ? '#fff1a0' : '#ffd23f'; ctx.fillRect(sx + wob, yy, 1, 1);
  }
}
function drips(e, x, y, S) {
  const f = e.facing, B = S.bend;
  const SRC = [[12, 6], [20, 9], [28, 17], [33, 10], [17, 12], [-9, 11], [40, 10], [24, 9]];
  SRC.forEach(([u, v], i) => {
    const [px, py] = B.fwd(u, v), X = Math.round(x + f * px), Y = Math.round(y + py);
    for (let k = 0; k < 2; k++) {
      const ph = (G.t * 0.04 + hsh(i * 5.7 + k * 3.1)) % 1, dy = Math.round(3 + ph * ph * 34), big = ph < 0.5;
      ctx.fillStyle = '#e0501a'; ctx.fillRect(X, Y + dy - 2, 1, 2);
      ctx.fillStyle = '#ff8a1a'; ctx.fillRect(X, Y + dy, big ? 2 : 1, big ? 3 : 2);
      ctx.fillStyle = '#fff1a0'; ctx.fillRect(X, Y + dy, 1, 1);
    }
    ctx.fillStyle = '#ffc23a'; ctx.fillRect(X, Y + 1, 1, 2);
  });
}

// ============================================================
// LAVA BOMB from the volcano: a molten rock trailing fire and smoke, its landing marker blinking on the column below
// ============================================================
let BOMB = null;
// a molten rock: dark crust broken into plates by glowing cracks, the leading (lower) side still molten
function bombSprite() {
  const g = new Grid(17, 17, -8, -8);
  for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
    const d = Math.hypot(x, y * 1.08);
    if (d > 6.5) continue;
    const V = vor(x / 2.6 + 11.3, y / 2.6 + 4.7, 97), e = V[1] - V[0], molten = (y - x * 0.35) > 3.2;
    let c;
    if (molten) c = d > 5.6 ? 'l' : y > 4 ? 'i' : 'j';
    else if (e < 0.13) c = d < 4 ? 'h' : 'i';
    else if (e < 0.22) c = 'l';
    else c = (x + y) < -4 ? 'c' : (x + y) < 3 ? 'd' : 'n';
    if (c === 'd' && h2(x, y, 98) > 0.8) c = 'c';
    g.set(x, y, c);
  }
  g.outline(false);
  return g.sprite(SPAL);
}
EB_TYPES.lavabomb = {
  r: 7, shootable: true,
  update(b) { b.vx = 0; b.vy = 0; },
  draw(b) {
    const x = Math.round(b.x), y = Math.round(b.y);
    marker(Math.round(b.tx), Math.round(b.ty), x, y);
    for (let i = 16; i >= 1; i--) {
      const k = i / 16, px = x + Math.round(b.dx * i * 2.2 + Math.sin(i * 1.7) * k * 1.6), py = y - Math.round(i * 2.5), r = 1.5 + k * 5;
      if (k > 0.5) { ctx.fillStyle = k > 0.75 ? '#2e2228' : '#4a3034'; pdisc(px, py, r); ctx.fillStyle = '#5e4048'; pdisc(px - 1, py - 1, r * 0.5); }
      else { ctx.fillStyle = k > 0.3 ? '#c8401a' : '#ff8a1a'; pdisc(px, py, r); ctx.fillStyle = k > 0.3 ? '#ff8a1a' : '#ffd23f'; pdisc(px, py + 1, r * 0.6); }
    }
    ctx.fillStyle = '#ffd23f'; pdisc(x + Math.round(b.dx * 3), y - 5, 3.5);
    ctx.fillStyle = '#fff1a0'; pdisc(x + 1, y - 3, 2.5);
    const gl = ctx.createRadialGradient(x, y, 2, x, y, 18);
    gl.addColorStop(0, 'rgba(255,170,70,0.5)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = gl; ctx.fillRect(x - 18, y - 18, 36, 36);
    if (!BOMB) BOMB = bombSprite();
    spr(BOMB, x - 8, y - 8);
    for (let i = 0; i < 7; i++) { const a = hsh(i * 3.3) * 6.28, r = 9 + hsh(i * 1.7) * 6; ctx.fillStyle = i % 2 ? '#ffd23f' : '#ff8a1a'; ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 4 + Math.sin(a) * r * 0.8), 1, 1); }
  },
  onGround(b) { blast(b.x, groundAt(b.x), 22, 1, 'enemy'); }
};
// the landing marker: a blinking red and yellow ring on the column top, a warning sign, a dotted line up to the bomb
function marker(x, y, bx, by) {
  const on = Math.floor(G.t / 5) % 2 === 0;
  const ring = (rx, ry, c) => { for (let a = 0; a < 72; a++) { const t = a / 72 * Math.PI * 2; ctx.fillStyle = c; ctx.fillRect(Math.round(x + Math.cos(t) * rx), Math.round(y + Math.sin(t) * ry), 1, 1); } };
  ctx.fillStyle = 'rgba(40,10,10,0.5)'; ctx.fillRect(x - 7, y - 1, 15, 3);
  ring(11, 3.5, on ? '#ff3b30' : '#ffe066'); ring(10, 3, on ? '#ff3b30' : '#ffe066');
  ring(6, 1.6, on ? '#ffe066' : '#ff3b30');
  for (let yy = y - 36; yy > by + 12; yy -= 5) { ctx.fillStyle = on ? '#ff3b30' : '#ffe066'; ctx.fillRect(Math.round(lerp(x, bx, (y - yy) / (y - by))), yy, 1, 2); }
  text('!', x + 1, y - 26, on ? '#ff3b30' : '#ffe066', 2, 'center');
}

// ============================================================
// Overlay: embers rising off the lava, ash drifting down from the plume, the warm light of the river
// ============================================================
function overlay() {
  for (let i = 0; i < 90; i++) {
    const sp = 0.25 + hsh(i * 1.3) * 0.55, x = Math.round(((hsh(i * 2.1) * 520 + G.t * (0.15 + hsh(i * 4.4) * 0.25)) % 520) - 20);
    const y = Math.round(LAVA_Y + 6 - ((hsh(i * 3.7) * 250 + G.t * sp) % 250));
    const hot = hsh(i * 8.8);
    ctx.fillStyle = hot > 0.7 ? '#fff1a0' : hot > 0.35 ? '#ffb52e' : '#ff6a2a';
    ctx.fillRect(x, y, 1, 1);
    if (hot > 0.88) { ctx.fillStyle = 'rgba(255,140,40,0.5)'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.round(((hsh(i * 6.1) * 540 + G.t * 0.3) % 540) - 30 + Math.sin(G.t * 0.02 + i) * 3);
    const y = Math.round((hsh(i * 9.3) * 280 + G.t * (0.2 + hsh(i) * 0.2)) % 280) - 10;
    ctx.fillStyle = hsh(i * 2.2) > 0.5 ? '#6e5c64' : '#4a3c44';
    ctx.fillRect(x, y, hsh(i * 7.7) > 0.7 ? 2 : 1, 1);
  }
  let g = ctx.createLinearGradient(0, 150, 0, H);
  g.addColorStop(0, 'rgba(255,100,30,0)'); g.addColorStop(1, 'rgba(255,100,30,0.14)');
  ctx.fillStyle = g; ctx.fillRect(0, 150, W, H - 150);
  g = ctx.createLinearGradient(0, 0, 0, 80);
  g.addColorStop(0, 'rgba(14,6,26,0.3)'); g.addColorStop(1, 'rgba(14,6,26,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 80);
}

// ============================================================
// The mission (a stand-in: only AREA 3 around camera x 3300 is painted)
// ============================================================
let BGL = null, CL = null, LAVA = null, FORE = null, frame = 0;
// foreground: stubs of broken columns rising out of the lava at the bottom corners (parallax 1.25), rim-lit
function buildFore() {
  const b = new Buf(W + 20, H, -10, 0);
  [[-9, 17, 251], [8, 13, 259], [455, 15, 256], [470, 20, 246]].forEach(([x, w, top], i) => paintCol(b, x, w, top, H + 4, COLK.fore, 90 + i, top + 2, top + 26));
  outlineBuf(b, OUT, false);
  const o = P(OUT);
  for (let y = 0; y < b.h; y++) for (let x = 1; x < b.w - 1; x++) {
    const i = y * b.w + x, v = b.d[i];
    if (!v || v === o) continue;
    const X = x + b.x0, inner = X < 240 ? b.d[i + 1] === o && !b.d[i + 2] : b.d[i - 1] === o && !b.d[i - 2];
    if (inner) b.d[i] = tint(v, '#ffb060', 0.65);
  }
  return b.canvas();
}
const FRAMES = 60, SHOTS = [40, 59];   // the render runs FRAMES updates; Ines fires on these frames (the last one 1 frame before the draw)
LEVELS.push({
  mission: 'MISSION 3', title: 'VOLCANO ISLAND', end: 6400, heroStart: 120, freedLabel: 'ANIMALS RESCUED',
  sections: [{ x: 0, name: 'AREA 1: SHARK BAY' }, { x: 1500, name: 'AREA 2: HONEY JUNGLE' }, { x: 3000, name: 'AREA 3: LAVA RIVERS' }, { x: 4800, name: 'FINAL AREA: THE CRATER' }],
  terrain: [[0, 244], [6400, 244]],
  plats: PLATS, spawns: [], pows: [], props: [], locks: [],
  drawBG(cx) {
    if (!BGL) BGL = { sky: paintSky(), volc: paintVolcano(), plume: paintPlume(), mid: paintMid(), wall: paintWall() };
    const off = p => Math.round((cx - CAM0) * p);
    ctx.drawImage(BGL.sky, -10, 0);
    ctx.drawImage(BGL.volc, -10 - off(0.06), 0);
    const gx = VX - off(0.06), gr = ctx.createRadialGradient(gx, VY - 8, 2, gx, VY - 8, 70);
    gr.addColorStop(0, 'rgba(255,170,70,0.6)'); gr.addColorStop(0.35, 'rgba(255,90,40,0.25)'); gr.addColorStop(1, 'rgba(255,80,40,0)');
    ctx.fillStyle = gr; ctx.fillRect(gx - 70, VY - 78, 140, 140);
    ctx.drawImage(BGL.plume, -10 - off(0.06), 0);
    fountain(-off(0.06));
    ctx.drawImage(BGL.mid, -10 - off(0.25), 0);
    ctx.drawImage(BGL.wall, -10 - off(0.55), 0);
    lavaFall(-off(0.55));
    const hz = ctx.createLinearGradient(0, 186, 0, LAVA_Y);
    hz.addColorStop(0, 'rgba(255,110,40,0)'); hz.addColorStop(1, 'rgba(255,120,40,0.4)');
    ctx.fillStyle = hz; ctx.fillRect(-10, 186, W + 20, LAVA_Y - 186);
  },
  drawGround() {
    if (!CL) { CL = buildClusters(); LAVA = buildLava(); }
    for (const c of CL) ctx.drawImage(c.c, CAM0 + c.x, c.y);
    ctx.drawImage(LAVA, CAM0 - 20, LAVA_Y);
    // bubbles swelling and popping on the river
    for (let i = 0; i < 14; i++) {
      const bx = CAM0 + Math.round(hsh(i * 7.3 + 1) * 480), by = LAVA_Y + 5 + Math.round(Math.pow(hsh(i * 3.9 + 2), 0.8) * 28), ph = (G.t * 0.02 + hsh(i * 5.1)) % 1;
      if (Math.abs(bx - CAM0 - 104) < 26 || Math.abs(bx - CAM0 - 428) < 26) continue;
      const r = 1 + Math.round(ph * 3 * (0.6 + (by - LAVA_Y) / 40));
      if (ph < 0.8) {
        ctx.fillStyle = '#c8401a'; ctx.fillRect(bx - r - 1, by, r * 2 + 3, 1);
        ctx.fillStyle = '#ff9a2a'; ctx.fillRect(bx - r, by - 1, r * 2 + 1, 1); ctx.fillRect(bx - r + 1, by - 2, Math.max(1, r * 2 - 1), 1);
        ctx.fillStyle = '#fff1a0'; ctx.fillRect(bx - 1, by - 2, 1, 1);
      } else {
        ctx.fillStyle = '#ffd23f';
        for (let k = 0; k < 6; k++) { const a = -Math.PI * (0.1 + 0.8 * k / 5); ctx.fillRect(Math.round(bx + Math.cos(a) * (r + 2)), Math.round(by - 1 + Math.sin(a) * (r + 1)), 1, 1); }
      }
    }
    for (const cl of CLUSTERS) {
      const x0 = CAM0 + Math.min(...cl.front.map(c => c[0])), x1 = CAM0 + Math.max(...cl.front.map(c => c[0] + c[1]));
      for (let x = x0 - 1; x <= x1; x++) {
        const k = hsh(x * 1.7);
        ctx.fillStyle = k > 0.6 ? '#fff1a0' : '#ffd23f'; ctx.fillRect(x, LAVA_Y - (k > 0.8 ? 2 : 1), 1, k > 0.8 ? 2 : 1);
      }
    }
  },
  drawFront(cx) {
    if (!FORE) FORE = buildFore();
    ctx.drawImage(FORE, -10 - Math.round((cx - CAM0) * 1.25), 0);
  },
  drawOverlay() { overlay(); },
  load() { frame = 0; },
  update() {
    const p = G.p;
    frame++;
    G.big = null;
    G.banner = { s: 'AREA 3: LAVA RIVERS', t: 120 };
    if (frame === 1) {
      const pl = PLATS.find(q => p.x > q.x && p.x < q.x + q.w);
      if (pl) { p.y = pl.y; p.vy = 0; p.onGround = true; p.onPlat = pl; }
      p.facing = 1; p.weapon = 'shotgun'; p.ammo = 24; p.bombs = 7; p.hearts = 2;
      G.score = 87350; G.section = 2; G.checkpoint = 3000;
      const add = s => { const e = makeEnemy(s); e.active = true; e.facing = s.facing; G.enemies.push(e); };
      add({ t: 'lavashark', mode: 'fin', x: CAM0 + 104, y: 247, facing: 1 });
      add({ t: 'lavashark', mode: 'fin', x: CAM0 + 428, y: 254, facing: -1 });
      add({ t: 'lavashark', mode: 'leap', x: CAM0 + 292, y: 168, facing: -1 });
      G.eb.push({ k: 'lavabomb', x: CAM0 + 368, y: 92, vx: 0, vy: 0, life: 99999, tx: CAM0 + 359, ty: 168, dx: 0.45 });
    }
    if (SHOTS.includes(frame)) shoot(p);
    G.shake = 0;
  }
});
}
