'use strict';
// =====================================================================================================================
// MISSION 3 "VOLCANO ISLAND" proposal frame: FINAL AREA: THE CRATER. A screenshot fixture, NOT game content.
// Night inside the crater: the MEGA WHALE SHARK breaches from the lava lake mid-vacuum (mouth wide open and glowing,
// air, sparks, lava drops and a rock streaming in), Mathias on a basalt ledge firing the H.M.G. into its mouth.
// It pushes a temporary mission (LEVELS[2] = mission 3) whose boss arena is already locked and running:
//   node H/harness.mjs render --html /Users/macbookair/game/proposals/level3/base.html --level 3 --x 5921.6 \
//     --frames 40 --hero 1 --scale 3 --extra /Users/macbookair/game/proposals/level3/boss/scene.js --out boss.png
// Drawing never calls Math.random()/rand(): stable hsh(n) and G.t only. Big static layers are painted once at load
// (pixel buffers -> canvases); only small live bits are drawn per frame.
// Everything is private to this block except the registry entries (ENEMY_TYPES.megawhaleshark) and the mission.
// =====================================================================================================================
{
// ---------------------------------------------------------------------------------------------------------------------
// Layout (design coordinates = screen coordinates with the camera locked in the arena)
// ---------------------------------------------------------------------------------------------------------------------
const END = 6200, CAM = END - W;          // arena: the camera locks at x 5720 (the boss lock)
const LAVA = 214;                          // the lava lake's play line (screen y): rafts float here, the boss breaches
const LEDGE = 177, LEDGE_X1 = 132;         // the hero's basalt ledge: walkable top y and right edge (screen)
const HERO_SX = 78;                        // Mathias, screen x
const BX = 330, BY = 216;                  // the boss's anchor in design coordinates (e.x = CAM + BX, e.y = BY)
const SHORE = 199;                         // where the lake meets the far crater wall

// ---------------------------------------------------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------------------------------------------------
// basalt: near-black, warming where the lava lights it
const K0 = '#09070b', K1 = '#120e13', K2 = '#1c151b', K3 = '#2a1e24', K4 = '#3d2a2b', K5 = '#5e3328', K6 = '#93452a', K7 = '#cf6a31';
// lava: crust to white-hot
const C0 = '#1c0605', C1 = '#2e0a06', C2 = '#451008', C3 = '#5f170a';
const L0 = '#3d0b06', L1 = '#701708', L2 = '#b02b0b', L3 = '#e44f10', L4 = '#ff8519', L5 = '#ffb534', L6 = '#ffe063', L7 = '#fff7cc';
// whale shark armour (dark blue-grey), pale steel (jaw, belly, lips), lamps
const S0 = '#0d1220', S1 = '#162036', S2 = '#21304d', S3 = '#2f4568', S4 = '#46628c', S5 = '#6f8db8', S6 = '#a6c0e0';
const V0 = '#3e4656', V1 = '#5c687c', V2 = '#8592a6', V3 = '#b1bdcb', V4 = '#dce4ec';
const LAMP = '#f4fbff', LAMPH = '#c4e8ff', LAMPD = '#7fb6dc';
const AMB = '#ffcf3a', AMBL = '#fff2a8';
const WARM = '#dc6e2a';

// ---------------------------------------------------------------------------------------------------------------------
// Helpers: easing, value noise, packed colours, pixel buffers, inside-test shapes
// ---------------------------------------------------------------------------------------------------------------------
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function vn(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  const h = (p, q) => hsh(p * 157.31 + q * 311.71 + s * 71.93);
  return lerp(lerp(h(i, j), h(i + 1, j), a), lerp(h(i, j + 1), h(i + 1, j + 1), a), b);
}
function fbm(x, y, s, o = 4) {
  let v = 0, a = 1, n = 0;
  for (let k = 0; k < o; k++) { v += a * vn(x, y, s + k * 13); n += a; a *= 0.5; x *= 2.03; y *= 2.03; }
  return v / n;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y) => (BAYER[((y & 3) << 2) + (x & 3)] + 0.5) / 16;

const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const RGB = {};
const rgbOf = c => RGB[c] || (RGB[c] = hex(c));
const pk = (r, g, b, a = 255) => (LE ? ((a << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | a)) >>> 0;
const unpk = v => LE ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24] : [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
function P(c, a = 255) { const v = rgbOf(c); return pk(v[0], v[1], v[2], a); }
function PM(c1, c2, k, a = 255) {
  const A = rgbOf(c1), B = rgbOf(c2); k = clamp(k, 0, 1);
  return pk(Math.round(A[0] + (B[0] - A[0]) * k), Math.round(A[1] + (B[1] - A[1]) * k), Math.round(A[2] + (B[2] - A[2]) * k), a);
}
// a colour from a ramp at t (0..1), dithered between neighbouring steps (pixel-art gradient)
function ramp(cols, t, x, y) {
  const f = clamp(t, 0, 1) * (cols.length - 1), i = Math.floor(f);
  return P(cols[Math.min(cols.length - 1, i + (f - i > dith(x, y) ? 1 : 0))]);
}
const OUTP = P(OUT);
const rgba = (c, a) => { const v = rgbOf(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a.toFixed(3) + ')'; };

class Pix {
  constructor(x0, y0, w, h) { this.x0 = x0; this.y0 = y0; this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  i(x, y) { x = Math.floor(x) - this.x0; y = Math.floor(y) - this.y0; return x >= 0 && y >= 0 && x < this.w && y < this.h ? y * this.w + x : -1; }
  dot(x, y, c) { const i = this.i(x, y); if (i >= 0) this.d[i] = c; }
  get(x, y) { const i = this.i(x, y); return i >= 0 ? this.d[i] : 0; }
  rect(x, y, w, h, c) { x = Math.round(x); y = Math.round(y); for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) this.dot(x + k, y + j, c); }
  // every pixel whose centre passes f: colour col (or col(x, y, ix, iy); 0 = leave it)
  shape(f, col, x0 = this.x0, y0 = this.y0, x1 = this.x0 + this.w, y1 = this.y0 + this.h) {
    x0 = Math.max(Math.floor(x0), this.x0); y0 = Math.max(Math.floor(y0), this.y0);
    x1 = Math.min(Math.ceil(x1), this.x0 + this.w); y1 = Math.min(Math.ceil(y1), this.y0 + this.h);
    const fn = typeof col === 'function';
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      if (!f(cx, cy)) continue;
      const c = fn ? col(cx, cy, x, y) : col;
      if (c) this.d[(y - this.y0) * this.w + x - this.x0] = c;
    }
  }
  line(ax, ay, bx, by, c) {
    const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)));
    for (let k = 0; k <= n; k++) this.dot(Math.round(lerp(ax, bx, n ? k / n : 0)), Math.round(lerp(ay, by, n ? k / n : 0)), c);
  }
  // a 1px outline (4-neighbourhood) around everything painted
  outline(c = OUTP) {
    const q = this.d.slice(), w = this.w, h = this.h;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (q[k]) continue;
      if ((i > 0 && q[k - 1]) || (i < w - 1 && q[k + 1]) || (j > 0 && q[k - w]) || (j < h - 1 && q[k + w])) this.d[k] = c;
    }
  }
  // warm light from the lava below: painted pixels in [y0, y1] lean toward col, dithered
  warm(y0, y1, col, amt, skip) {
    const C = rgbOf(col);
    for (let j = 0; j < this.h; j++) {
      const y = j + this.y0, k = ss(y0, y1, y) * amt;
      if (k <= 0) continue;
      for (let i = 0; i < this.w; i++) {
        const v = this.d[j * this.w + i];
        if (!v || v === OUTP || (skip && skip(i + this.x0 + 0.5, y + 0.5))) continue;
        const [r, g, b, a] = unpk(v), m = k * (0.75 + dith(i, j) * 0.5);
        this.d[j * this.w + i] = pk(Math.round(r + (C[0] - r) * m), Math.round(g + (C[1] - g) * m), Math.round(b + (C[2] - b) * m), a);
      }
    }
  }
  canvas() {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const g = c.getContext('2d'), id = g.createImageData(this.w, this.h);
    id.data.set(new Uint8ClampedArray(this.d.buffer)); g.putImageData(id, 0, 0);
    return c;
  }
}
const rot = (x, y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [dx * c + dy * s, -dx * s + dy * c]; };
const ell = (cx, cy, rx, ry, a = 0) => (x, y) => { const [u, v] = rot(x, y, cx, cy, a); return (u / rx) ** 2 + (v / ry) ** 2 <= 1; };
const both = (a, b) => (x, y) => a(x, y) && b(x, y);
const minus = (a, b) => (x, y) => a(x, y) && !b(x, y);
function poly(pts) {
  return (x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
}
// smooth closed curve through points (Catmull-Rom), as a polygon
function smooth(pts, n = 6) {
  const out = [], m = pts.length;
  for (let i = 0; i < m; i++) {
    const p0 = pts[(i - 1 + m) % m], p1 = pts[i], p2 = pts[(i + 1) % m], p3 = pts[(i + 2) % m];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(d => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  return out;
}
// crisp pixel disc on the live canvas
function disc(x, y, r, col) {
  ctx.fillStyle = col;
  for (let j = -r; j <= r; j++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - j * j))); ctx.fillRect(Math.round(x) - w, Math.round(y) + j, w * 2 + 1, 1); }
}
function glow(x, y, r, col, a) {
  const v = rgbOf(col), g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(' + v + ',' + a + ')'); g.addColorStop(1, 'rgba(' + v + ',0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// a flat (undithered) colour from a ramp: clean bands like Mission 2's sprites
const flat = (cols, t) => P(cols[clamp(Math.round(t * (cols.length - 1)), 0, cols.length - 1)]);

// =====================================================================================================================
// BACKDROP (screen space, painted once): smoky red night sky with a few stars, the far crater wall, the two high side
// walls of basalt columns with lava glowing in their joints and two lava falls, everything lit from below by the lake
// =====================================================================================================================
const SKY = ['#0b0409', '#13060d', '#1c0911', '#280c13', '#371015', '#4a1517', '#601b18', '#7a2619'];
const SMOKE = ['#1a080e', '#260b11', '#371015', '#4c1818', '#66221a', '#83311c', '#a3451f'];
const BAS = [K0, K1, K2, K3, K4, K5, K6, K7];
// the side walls' inner edges (x at screen y), the far wall's rim
const leftEdge = y => 98 + 8 * Math.sin(y * 0.06) + 9 * (fbm(y / 16, 3, 4, 3) - 0.5) * 2 + ss(120, 200, y) * 18 - ss(40, 0, y) * 10;
const rightEdge = y => 416 + 8 * Math.sin(y * 0.05 + 1.3) + 9 * (fbm(y / 15, 9, 5, 3) - 0.5) * 2 + ss(70, 200, y) * 40;
const farRim = x => 126 + 9 * (fbm(x / 26, 1, 6, 4) - 0.5) * 2 - 6 * Math.sin(x * 0.021) + (hsh(Math.floor(x / 5) * 3.1) > 0.82 ? -3 : 0);
const FALLS = [{ x: 31, y0: 58, y1: 186, w: 7 }, { x: 457, y0: 46, y1: 152, w: 7 }];

// basalt cliff texture: stacked column blocks, each flat-shaded (lit from below by the lake, stepping block by block),
// dark joints with a lit lip, cross fractures, a warm rim on the wall's inner edge
function basalt(x, y, seed, lit, edgeD) {
  const xs = x + seed * 5, cw = 9 + Math.floor(hsh(seed + Math.floor(xs / 11)) * 4);
  const cx = Math.floor(xs / cw), off = Math.floor(hsh(cx * 1.3 + seed) * 23), sh = 12 + Math.floor(hsh(cx * 2.1 + seed) * 12);
  const row = Math.floor((y + off) / sh), yc = row * sh - off + sh / 2;
  let t = 0.17 + hsh(cx * 2.9 + seed) * 0.1 + hsh(cx * 5.1 + row * 1.7) * 0.07 + lit(yc);
  const jx = Math.floor(xs) - cx * cw, jy = Math.floor(y + off) - row * sh;
  if (jx === 0) t -= 0.14;                    // column joint
  else if (jx === 1) t += 0.06;               // its lit lip
  if (jy === 0) t -= 0.1;                     // cross fracture
  else if (jy === 1) t += 0.05;
  if (edgeD < 2.5) t += 0.2 * ss(30, 190, y); // warm rim on the inner edge
  return flat(BAS, t);
}

function paintBackdrop() {
  const px = new Pix(-10, -10, W + 20, 226);
  // sky + smoke: billows lit from below, thinning out at the top where a few stars show
  px.shape(() => true, (x, y, ix, iy) => {
    const t = ss(-10, 170, y);
    let d = fbm(x / 40 + 7, y / 16, 2, 5);
    const pc = 300 + (150 - y) * 0.6, plume = Math.exp(-(((x - pc) / 64) ** 2)) * ss(10, 130, y);
    d = d + plume * 0.3 + ss(70, 130, y) * 0.12 - ss(70, 0, y) * 0.3;
    if (d < 0.5) return ramp(SKY, t * 0.95, ix, iy);
    const under = clamp((d - fbm(x / 40 + 7, (y + 5) / 16, 2, 5)) * 6, -0.3, 0.3);
    return ramp(SMOKE, ss(0, 175, y) * 0.8 + (d - 0.5) * 0.7 + under, ix, iy);
  });
  for (const [x, y, s] of [[244, 7, 2], [262, 21, 1], [291, 5, 1], [318, 26, 1], [341, 11, 2], [366, 24, 1], [233, 30, 1], [302, 15, 1], [281, 32, 1], [206, 22, 1]]) {
    px.dot(x, y, P('#fff1c9'));
    if (s > 1) for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px.dot(x + a, y + b, P('#b07a68'));
  }
  // the far crater wall across the lake
  px.shape((x, y) => y >= farRim(x) && y < SHORE + 2, (x, y) => basalt(x, y, 3, yc => ss(farRim(x) + 6, SHORE + 4, yc) * 0.62, y - farRim(x) < 1.5 ? 0 : 9), -10, 90, W + 10, SHORE + 2);
  // the side walls
  px.shape((x, y) => x < leftEdge(y), (x, y) => basalt(x, y, 11, yc => ss(70, 215, yc) * 0.55 * (1 - ss(10, 80, leftEdge(y) - x) * 0.45), leftEdge(y) - x), -10, -10, 170, 216);
  px.shape((x, y) => x > rightEdge(y), (x, y) => basalt(x, y, 23, yc => ss(70, 215, yc) * 0.55 * (1 - ss(10, 70, x - rightEdge(y)) * 0.45), x - rightEdge(y)), 380, -10, W + 10, 216);
  // lava glowing in some column joints: continuous cracks stepping down the cliffs
  const crack = (x0, y0, n, seed) => {
    let x = x0, y = y0;
    for (let i = 0; i < n; i++) {
      const len = 7 + Math.floor(hsh(seed + i * 3.7) * 12);
      CRACK_GLOW.push([x, y + len / 2, len]);
      for (let k = 0; k < len; k++) { px.dot(x, y + k, P(k % 6 === 3 ? L6 : L5)); px.dot(x + 1, y + k, P(L2)); px.dot(x - 1, y + k, P(K0)); }
      const dx = hsh(seed + i * 9.1) > 0.5 ? 1 : -1, jog = 2 + Math.floor(hsh(seed + i) * 3);
      for (let k = 1; k <= jog; k++) { px.dot(x + dx * k, y + len, P(L4)); px.dot(x + dx * k, y + len + 1, P(L1)); }
      x += dx * jog; y += len + 1;
    }
  };
  crack(12, 98, 4, 1); crack(66, 44, 3, 2); crack(87, 132, 2, 3); crack(143, 160, 2, 4); crack(443, 66, 3, 5); crack(471, 110, 3, 6);
  // lava falls: a cave mouth, a ribbon widening as it falls, brighter in the middle, streaky
  for (const f of FALLS) {
    px.shape(ell(f.x + 0.5, f.y0 - 1, f.w * 0.95, 5), P(K0));
    px.shape(ell(f.x + 0.5, f.y0, f.w * 0.75, 3), P(L2));
    for (let y = f.y0; y < f.y1; y++) {
      const g = (y - f.y0) / (f.y1 - f.y0), w = Math.round(f.w + g * 3), wob = Math.round(Math.sin(y * 0.13 + f.x) * 0.8);
      for (let i = 0; i < w; i++) {
        const k = i / (w - 1), core = 1 - Math.abs(k * 2 - 1), streak = (hsh(Math.floor(y / 4 + i * 0.5) * 1.3 + i * 7.7) - 0.5) * 0.35;
        px.dot(f.x - (w >> 1) + i + wob, y, flat([L1, L2, L3, L4, L5, L6, L7], core * 0.95 + streak - g * 0.1));
      }
      px.dot(f.x - (w >> 1) - 1 + wob, y, P(K1)); px.dot(f.x - (w >> 1) + w + wob, y, P(K2));
    }
  }
  paintBase(px);
  return px.canvas();
}

// The robot army's base inside the crater: a steel catwalk with warning lamps and a pipe down the left wall, a crane
// arm with a hook on the right wall, a bunker with lit windows in the far wall (the lamps blink live)
const CRACK_GLOW = [];
const BLINK = [[12, 89], [57, 89], [416, 36], [143, 169]];
function paintBase(px) {
  const ST = ['#20242c', '#2f353f', '#454d59', '#5f6875', '#808a98'], HOT = '#9a5236';
  // catwalk deck at y 100 from the wall out to x 64, with a railing, struts and two lamp posts
  for (let x = -10; x <= 64; x++) {
    px.dot(x, 99, P(ST[4])); px.dot(x, 100, P(ST[2])); px.dot(x, 101, P(x % 3 ? ST[1] : ST[0])); px.dot(x, 102, P(HOT));
    px.dot(x, 93, P(ST[3])); px.dot(x, 96, P(ST[1]));
    if ((x + 10) % 9 === 0 || x === 64) for (let y = 93; y < 99; y++) px.dot(x, y, P(ST[2]));
  }
  for (let x = -10; x <= 65; x++) { px.dot(x, 92, OUTP); px.dot(x, 103, OUTP); }
  for (const sx of [14, 46]) for (let k = 0; k < 11; k++) px.dot(sx - Math.round(k * 0.8), 103 + k, P(k > 7 ? HOT : ST[1]));
  for (const [lx, ly] of BLINK.slice(0, 2)) { px.rect(lx - 1, ly + 1, 3, 3, P(ST[1])); px.rect(lx - 1, ly - 1, 3, 2, P('#5a1a1a')); }
  // a pipe from the catwalk down the wall to the ledge, with joints and bolts, lit warm near the bottom
  for (let y = 103; y < 176; y++) {
    const w = ss(130, 176, y);
    [ST[0], ST[2], ST[4], ST[2]].forEach((c, i) => px.dot(58 + i, y, w > 0.5 && i > 0 ? P(i === 2 ? '#d08a5a' : HOT) : P(c)));
    if ((y - 103) % 18 === 0) { px.rect(57, y, 6, 2, P(ST[3])); px.dot(57, y, P(ST[4])); }
    px.dot(57, y, OUTP); px.dot(62, y, OUTP);
  }
  // crane arm out of the right wall: a lattice girder, a trolley, a cable and a hook, a beacon at the tip
  for (let x = 416; x <= 490; x++) {
    px.dot(x, 37, P(ST[3])); px.dot(x, 38, P(ST[1])); px.dot(x, 44, P(ST[2])); px.dot(x, 45, P(ST[0]));
    const k = (x - 416) % 8, y = k < 4 ? 39 + k * 1.25 : 44 - (k - 4) * 1.25;
    px.dot(x, Math.round(y), P(ST[2]));
    px.dot(x, 36, OUTP); px.dot(x, 46, OUTP);
  }
  px.rect(421, 46, 7, 3, P(ST[2])); px.rect(421, 46, 7, 1, P(ST[4]));
  for (let y = 49; y < 74; y++) px.dot(424, y, P(y % 2 ? ST[1] : ST[3]));
  for (const [x, y, c] of [[423, 74, 4], [424, 74, 4], [425, 74, 4], [426, 75, 3], [426, 76, 3], [426, 77, 3], [425, 78, 2], [424, 78, 2], [423, 77, 2]]) px.dot(x, y, P(ST[c]));
  px.rect(415, 34, 3, 2, P('#5a1a1a'));
  // a blast door set into the far wall at the shore: a dark arch in the rock, a steel frame with a hazard-striped
  // lintel, two panels with slit windows, light leaking under it, a red lamp above
  const DX = 136, DY = 177, DW = 16, DH = 22;
  px.shape(poly([[DX - 5, SHORE], [DX - 5, DY - 4], [DX - 1, DY - 9], [DX + DW + 1, DY - 9], [DX + DW + 5, DY - 4], [DX + DW + 5, SHORE]]), P(K0));
  px.rect(DX - 2, DY - 5, DW + 4, DH + 5, OUTP);
  px.rect(DX - 1, DY - 4, DW + 2, DH + 4, P(ST[2]));
  for (let x = DX - 1; x < DX + DW + 1; x++) for (let y = DY - 4; y < DY - 1; y++) px.dot(x, y, P(((x + y) >> 1) % 2 ? '#e8b830' : '#2a2620'));
  px.rect(DX + 1, DY, DW - 2, DH - 1, P(ST[1])); px.rect(DX + DW / 2 - 1, DY, 1, DH - 1, OUTP);
  for (const x of [DX + 3, DX + DW / 2 + 2]) { px.rect(x, DY + 5, 3, 2, P('#ffcf6a')); px.rect(x, DY + 5, 3, 1, P('#fff2b0')); px.rect(x, DY + 12, 3, 1, P(ST[3])); }
  px.rect(DX + 1, DY + DH - 1, DW - 2, 1, P('#ffd070'));
  px.rect(DX + DW / 2 - 2, DY - 8, 3, 3, P(ST[1])); px.dot(DX + DW / 2 - 1, DY - 8, P('#5a1a1a'));
}

// =====================================================================================================================
// GROUND (world space at the arena, painted once): the lava lake (dark crust plates, glowing cracks, open bright lava
// around the boss and under its mouth) and Mathias's ledge of hexagonal basalt columns standing in it
// =====================================================================================================================
function worley(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const cx = i + a + 0.15 + hsh((i + a) * 12.9 + (j + b) * 78.2 + s) * 0.7, cy = j + b + 0.15 + hsh((i + a) * 39.3 + (j + b) * 11.1 + s * 3) * 0.7;
    const d = Math.hypot(x - cx, y - cy);
    if (d < d1) { d2 = d1; d1 = d; id = (i + a) * 31 + (j + b) * 17; } else if (d < d2) d2 = d;
  }
  return [d1, d2, id];
}
const heatAt = (x, y) => {
  const boss = Math.exp(-(((x - 372) / 100) ** 2)) * ss(203, 216, y) * (1 - ss(220, 244, y) * 0.75);
  const suck = Math.exp(-(((x - 207) / 30) ** 2) - (((y - 216) / 8) ** 2));
  const fin = Math.exp(-(((x - 377) / 20) ** 2) - (((y - 238) / 7) ** 2));   // = PEC_CUT (declared later)
  return clamp(boss * 0.8 + suck + fin * 0.8, 0, 1);
};
// basalt columns of the ledge: [x, width, top]
const COLS = [[-12, 14, 181], [2, 13, 178], [15, 14, 176], [29, 13, 179], [42, 14, 175], [56, 13, 175], [69, 14, 175], [83, 13, 175], [96, 14, 176], [110, 12, 180], [122, 11, 187]];

function paintGround() {
  const px = new Pix(-10, 166, W + 20, 114);
  // the lake: crust plates in perspective, cracks of varying width and heat, open lava where it's hottest
  px.shape((x, y) => y >= SHORE, (x, y) => {
    const near = ss(SHORE, 272, y), sc = 10 + near * 24, u = x / sc, v = (y - SHORE) / (sc * 0.5) + 2;
    const heat = heatAt(x, y);
    if (heat > 0.55 + (fbm(x / 14, y / 5, 7, 2) - 0.5) * 0.5) {
      const sw = fbm(x / 9 + y * 0.05, y / 3, 8, 3);
      return flat([L3, L4, L5, L6, L7], 0.25 + sw * 0.6 + (heat - 0.55));
    }
    const [d1, d2, id] = worley(u, v, 5), edge = d2 - d1;
    // a hierarchy of cracks: a few wide bright ones, many thin dim ones (thinner far away)
    const big = vn(u * 0.45, v * 0.45, 9);
    const cw = (0.012 + near * 0.05) * (0.3 + big * 1.35) + heat * 0.18;
    if (edge < cw) return flat([L1, L2, L3, L4, L5, L6], 0.1 + near * 0.3 + big * 0.35 + heat * 0.5 + (edge < cw * 0.4 ? 0.2 : 0));
    const rim = edge < cw + 0.07 ? 1 : 0;
    return flat([C0, C1, C2, C3, L1, L2, L3], hsh(id * 0.37) * 0.28 + rim * 0.17 + heat * 0.7 + near * 0.06 - (1 - near) * 0.05);
  });
  for (let x = -10; x < W + 10; x++) { px.dot(x, SHORE, P(L4)); px.dot(x, SHORE - 1, P(L2)); if (hsh(x * 0.7) > 0.5) px.dot(x, SHORE + 1, P(L5)); }
  // the ledge: hexagonal basalt columns, flattened hexagon tops, two faces lit from the lake (the right one more)
  for (const [x, w, top] of COLS) {
    const x1 = x + w, mid = x + Math.round(w * 0.42), base = 238 + Math.round(hsh(x) * 4);
    for (let y = top + 4; y < base; y++) for (let i = x; i < x1; i++) {
      const lit = i >= mid, k = Math.floor(ss(top + 2, base, y) * 5) / 5;
      let t = (lit ? 0.32 : 0.14) + k * (lit ? 0.6 : 0.42);
      if (i === mid) t += 0.13; if (i === x) t -= 0.25; if (i === x1 - 1) t -= 0.1;
      const fy = (y - top + Math.floor(hsh(x) * 9)) % 15;
      if (fy === 0) t -= 0.15; else if (fy === 1) t += 0.06;
      px.dot(i, y, flat(BAS, t));
    }
    px.shape(poly([[x, top + 2], [x + 3, top - 1], [x1 - 3, top - 1], [x1, top + 2], [x1 - 3, top + 5], [x + 3, top + 5]]), (cx, cy) => flat([K3, K4, K5, '#7a4433'], 0.3 + (cy - top + 1) * 0.13));
    px.line(x + 3, top - 1, x1 - 4, top - 1, P('#8a5240'));
    px.line(x, top + 2, x + 3, top + 5, P(K1)); px.line(x + 3, top + 5, x1 - 3, top + 5, P(K1));
    for (let i = x - 1; i <= x1; i++) { px.dot(i, base, P(L5)); px.dot(i, base + 1, P(L4)); px.dot(i, base - 1, P(L2)); }
    // heat cracks creeping up from the lava
    if (hsh(x * 1.7) > 0.35) {
      let cx = x + 3 + Math.floor(hsh(x * 2.3) * (w - 6));
      for (let y = base - 1, n = 8 + Math.floor(hsh(x * 4.1) * 12), k = 0; k < n; k++, y--) {
        if (k % 5 === 4) cx += hsh(x + k) > 0.5 ? 1 : -1;
        px.dot(cx, y, P(k < 4 ? L5 : k < n - 3 ? L3 : L2));
      }
    }
  }
  return px.canvas();
}

// =====================================================================================================================
// THE MEGA WHALE SHARK (design coordinates, painted once). A broad flat head in three-quarter view, so the huge wide
// mouth (wide open: the vacuum) faces the hero; a long body following a spine back into the lava. Dark blue-grey
// armour panels split by pale seams (the stripes) with a lamp in each panel (the spots), three ridges, five gill
// louvres, dorsal and pectoral fins, a pale jaw and belly lit orange by the lava, lava sheeting off its back.
// Live: the mouth (ribbed cavity, backlit intake fan, glow), lamps, gill steam, splashes, the vacuum.
// =====================================================================================================================
// the mouth: far corner F, near corner N; the upper lip arcs gently, the lower jaw hangs wide open
const FX = 170, FY = 117, NX = 268, NY = 129;
const mk = x => clamp((x - FX) / (NX - FX), 0, 1);
const lipUp = x => { const k = mk(x); return FY + (NY - FY) * k - 6 * Math.sin(Math.PI * k); };
const lipLo = x => { const k = mk(x); return FY + (NY - FY) * k + 50 * Math.pow(Math.sin(Math.PI * Math.pow(k, 0.85)), 0.75); };
const MOUTH = (x, y) => x > FX && x < NX && y > lipUp(x) && y < lipLo(x);
const THROAT = [233, 146];
const OFFS = [];
for (let a = 0; a < 20; a++) for (const r of [1.6, 3.2, 4.8]) OFFS.push([Math.cos(a * Math.PI / 10) * r, Math.sin(a * Math.PI / 10) * r, r]);
const nearMouth = (x, y, r) => OFFS.some(([dx, dy, rr]) => rr <= r && MOUTH(x + dx, y + dy));
const LIPS = (x, y) => !MOUTH(x, y) && x > FX - 7 && x < NX + 7 && y > FY - 12 && y < 190 && nearMouth(x, y, y > lipLo(x) - 2 ? 4.8 : 4);
const HEAD = poly(smooth([[166, 111], [176, 98], [198, 89], [232, 82], [266, 79], [290, 84], [306, 100], [312, 150], [304, 182], [288, 193], [258, 199], [226, 200], [198, 192], [180, 176], [169, 153], [163, 128]], 5));
const jawLine = x => x <= NX ? lipLo(x) + 0.5 : NY + 3 + (x - NX) * 1.25;
const JAW = (x, y) => y > jawLine(x) && x < 332;
const EYE = [281, 117];
const FAR_EYE = ell(166, 108, 4, 3.6);

const SPINE = [[262, 128, 50], [316, 146, 62], [384, 168, 56], [460, 184, 47], [540, 198, 40]];
const SPL = [];
for (let i = 1; i < SPINE.length; i++) SPL.push(Math.hypot(SPINE[i][0] - SPINE[i - 1][0], SPINE[i][1] - SPINE[i - 1][1]));
// nearest point on the spine: u = arc length, v = signed distance (negative = above), r = radius there, k = v - r
function spineAt(x, y) {
  let best = null, acc = 0;
  for (let i = 1; i < SPINE.length; i++) {
    const [ax, ay, ra] = SPINE[i - 1], [bx, by, rb] = SPINE[i], dx = bx - ax, dy = by - ay, L = SPL[i - 1];
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (L * L), 0, 1), r = ra + (rb - ra) * t;
    const qx = ax + dx * t, qy = ay + dy * t, d = Math.hypot(x - qx, y - qy), k = d - r;
    if (!best || k < best.k) best = { k, u: acc + L * t, v: (dx * (y - ay) - dy * (x - ax) >= 0 ? 1 : -1) * d, r };
    acc += L;
  }
  return best;
}
// the point on the body at spine u, height n (v / r)
function bodyPt(u, n) {
  let acc = 0;
  for (let k = 1; k < SPINE.length; k++) {
    if (acc + SPL[k - 1] < u && k < SPINE.length - 1) { acc += SPL[k - 1]; continue; }
    const [ax, ay, ra] = SPINE[k - 1], [bx, by, rb] = SPINE[k], L = SPL[k - 1], t = (u - acc) / L, r = ra + (rb - ra) * t;
    return [ax + (bx - ax) * t - (by - ay) / L * n * r, ay + (by - ay) * t + (bx - ax) / L * n * r];
  }
}
const WATER = x => LAVA + 1 + Math.round(Math.sin(x * 0.21) * 0.8);
const inBody = (x, y) => spineAt(x, y).k <= 0;
const DORSAL = poly(smooth([[352, 106], [360, 88], [370, 68], [382, 52], [393, 42], [397, 46], [396, 62], [398, 80], [404, 98], [412, 114], [420, 128], [388, 122]], 5));
// near pectoral fin (art director pass): a big sickle sweeping DOWN AND BACK from behind the gills, its tip slicing
// into the near lava. (It used to point down and forward, pale, with a far fin under the chin: the pair read as legs.)
const PEC = poly(smooth([[324, 187], [327, 199], [335, 212], [348, 225], [365, 236], [384, 245], [398, 249], [393, 240], [385, 229], [379, 216], [373, 203], [367, 191], [358, 184], [345, 181], [333, 182]], 5));
const PEC_WATER = x => 236 + Math.round(Math.sin(x * 0.5));
const PEC_CUT = 377;                      // where the fin slices into the near lava (splash, heat)
const FAR_PEC = () => false;              // the far fin is hidden behind the head now
const GILLS = [46, 54, 62, 70, 78];       // spine u of each louvre
const HEAD_U = 43;                        // the head's own shading in front of this spine u, the body's behind it
const SEAMS_U = []; for (let u = 94; u < 380; u += 15) SEAMS_U.push(u);
const RIDGES = [-58, -26, 8].map(a => Math.sin(a * Math.PI / 180));
const LAMPS_V = [-74, -42, -9, 24, 50].map(a => Math.sin(a * Math.PI / 180));
// lava tongues down the flank: top x, width, seed, length (0 = to the lake); they trail back as the shark rises
const STREAMS = [[357, 11, 1, 0], [431, 14, 2, 0], [468, 9, 3, 30], [394, 7, 4, 22]];
const ARM = [S0, S1, S2, S3, S4, S5, S6];
const armBand = n => n < -0.92 ? 5 : n < -0.58 ? 4 : n < -0.1 ? 3 : n < 0.38 ? 2 : 1;

function paintShark() {
  const px = new Pix(150, 30, 340, 216);
  const solid = (x, y) => (HEAD(x, y) || inBody(x, y) || FAR_EYE(x, y)) && !MOUTH(x, y) && y < WATER(x);
  const headTop = []; for (let x = 150; x < 340; x++) { let y = 60; while (y < 200 && !HEAD(x + 0.5, y + 0.5)) y++; headTop[x] = y; }
  // ---- the far pectoral fin, behind the jaw, in shadow ----
  px.shape(both(FAR_PEC, (x, y) => y < WATER(x) + 1), (x, y) => P(!FAR_PEC(x - 1.5, y - 1) ? S3 : !FAR_PEC(x + 1, y + 2) ? S0 : S1));
  // ---- the body: flat bands around the body (lit top, darker flank), pale belly; seams (stripes) and ridges ----
  px.shape(solid, (x, y) => {
    const s = spineAt(x, y), n = s.v / s.r;
    if (n > 0.6 || JAW(x, y)) return flat([V1, V2, V3], 1 - ss(0.6, 1.02, n) * 0.9);
    let b = armBand(n);
    if (s.u >= 86) {
      const bow = 5 * (1 - n * n);
      for (const su of SEAMS_U) { const d = s.u + bow - su; if (d >= 0 && d < 1) b++; else if (d >= 1 && d < 2 && n > -0.55) b--; }
      for (const rv of RIDGES) { const d = (n - rv) * s.r; if (d >= -0.5 && d < 0.6) b += 2; else if (d >= 0.6 && d < 1.7) b--; }
    }
    return P(ARM[clamp(b, 0, 6)]);
  });
  // ---- the head (in front of the gills): flat top in bands, the snout's front a step darker, the cheek ----
  px.shape((x, y) => solid(x, y) && HEAD(x, y) && !JAW(x, y) && spineAt(x, y).u < HEAD_U, (x, y) => {
    const dTop = y - headTop[Math.floor(x)];
    if (dTop < 1.5) return P(S6);
    if (dTop < 3) return P(S5);
    if (x < NX + 2) {
      const dLip = lipUp(x) - y;
      if (dLip < 3) return P(S1);
      if (dLip < 9) return P(S2);
      return P(dTop < 14 ? S4 : S3);
    }
    return P(dTop < 12 ? S3 : y > jawLine(x) - 6 ? S1 : S2);
  });
  // ---- the jaw: pale steel bands under the lower lip, darker toward the bottom (lit warm later) ----
  px.shape((x, y) => solid(x, y) && JAW(x, y) && (HEAD(x, y) || spineAt(x, y).v / spineAt(x, y).r > 0.3), (x, y) => {
    const d = y - jawLine(x);
    if (!solid(x, y + 1.5)) return P(V0);
    if (!solid(x, y + 3.5)) return P(V1);
    // two plate seams parallel to the lip: a dark line with a lit lip under it
    if (Math.abs(d - 8) < 0.5 || Math.abs(d - 16) < 0.5) return P(V0);
    if (Math.abs(d - 9) < 0.5 || Math.abs(d - 17) < 0.5) return P(V4);
    return P(d < 8 ? V3 : d < 16 ? V2 : V1);
  });
  for (let x = 184; x < 320; x += 9) for (const d of [12, 20]) {
    const y = Math.round(jawLine(x) + d);
    if (solid(x + 0.5, y + 3.5) && JAW(x + 0.5, y + 0.5) && !LIPS(x + 0.5, y - 1.5)) { px.dot(x, y, P(V4)); px.dot(x + 1, y + 1, P(V0)); }
  }
  px.shape((x, y) => solid(x, y) && x > NX - 1 && x < 334 && Math.abs(y - jawLine(x)) < 0.75, P(S0));      // jaw seam
  px.shape(ell(NX + 6, NY + 9, 3.2, 3.2), (x, y) => P(y < NY + 8 ? V4 : y < NY + 10 ? V2 : V0));            // hinge bolt
  px.dot(NX + 5, NY + 7, P('#ffffff'));
  // ---- lips: thick pale steel around the mouth, tiny comb teeth, rivets ----
  px.shape(LIPS, (x, y) => {
    const upper = y < (lipUp(x) + lipLo(x)) / 2 && x > FX + 2 && x < NX - 2;
    if (nearMouth(x, y, 1.7)) return P(V0);
    if (nearMouth(x, y, 3.2)) return P(upper ? V2 : V4);
    return P(upper ? V3 : V2);
  });
  for (let x = FX + 5; x < NX - 4; x += 2) {
    const k = mk(x), tu = Math.round(lipUp(x)), tl = Math.round(lipLo(x));
    if (k > 0.04 && k < 0.96) { px.dot(x, tu, P(V4)); if (x % 4 === 1) px.dot(x, tu + 1, P(V3)); }
    if (k > 0.06 && k < 0.94) { px.dot(x, tl - 1, P(V4)); if (x % 4 === 3) px.dot(x, tl - 2, P(V3)); }
  }
  for (let x = FX + 9; x < NX - 6; x += 11) {
    const yu = Math.round(lipUp(x)) - 3, yl = Math.round(lipLo(x)) + 3;
    px.dot(x, yu, P(V4)); px.dot(x + 1, yu + 1, P(V0));
    px.dot(x, yl, P('#ffffff')); px.dot(x + 1, yl + 1, P(V1));
  }
  // ---- gill louvres: five thin slots behind the head, a pale lip in front, red-hot low inside, bolts ----
  for (const gu of GILLS) {
    px.shape(solid, (x, y) => {
      const s = spineAt(x, y), n = s.v / s.r;
      if (n < -0.55 || n > 0.62) return 0;
      const d = s.u + 3.5 * (1 - n * n) - gu;
      if (d >= 0 && d < 1.3) return P(n > 0.28 ? L3 : n > 0.05 ? L1 : S0);
      if (d >= 1.3 && d < 2.3) return P(S1);
      if (d >= -1.1 && d < 0) return P(n < -0.1 ? S6 : S5);
      return 0;
    }, 280, 80, 360, 214);
    for (const n of [-0.6, 0.67]) { const [bx, by] = bodyPt(gu + 3.5 * (1 - n * n) - 1, n); px.dot(Math.round(bx), Math.round(by), P(S6)); px.dot(Math.round(bx) + 1, Math.round(by) + 1, P(S0)); }
  }
  // ---- the eyes: small round amber eyes under a stern brow plate ----
  px.shape(ell(EYE[0], EYE[1], 5, 4.5), P(S0));
  px.shape(ell(EYE[0], EYE[1] + 0.2, 3.4, 3.1), (x, y) => P(y < EYE[1] - 1 ? AMBL : AMB));
  px.rect(EYE[0] - 3, EYE[1] - 1, 2, 3, P('#2a1400'));                       // the pupil, looking at the hero
  px.dot(EYE[0] - 3, EYE[1] - 1, P('#5a3000'));
  px.dot(EYE[0] + 1, EYE[1] - 2, P('#ffffff')); px.dot(EYE[0] + 2, EYE[1] - 2, P('#ffffff')); px.dot(EYE[0] + 2, EYE[1] + 1, P('#c98a10'));
  px.shape(poly([[271, 110], [290, 107], [292, 111], [273, 114]]), (x, y) => P(y < 109 ? S6 : y < 111 ? S5 : S4));
  px.dot(275, 112, P(S1)); px.dot(287, 109, P(S1));
  px.shape(FAR_EYE, (x, y) => P(Math.hypot(x - 166, y - 108) < 2.4 ? AMB : S1));
  px.dot(164, 108, P('#2a1400')); px.dot(164, 109, P('#2a1400')); px.dot(167, 107, P('#ffffff'));
  // ---- dorsal fin: lit leading edge, plates, rivets ----
  px.shape(DORSAL, (x, y) => {
    if (!DORSAL(x - 1.5, y + 0.5)) return P(S6);
    if (!DORSAL(x - 4, y + 1)) return P(S5);
    if (!DORSAL(x + 2.5, y)) return P(S2);
    return P(y > 112 ? S2 : S3);
  });
  px.shape(DORSAL, (x, y) => (DORSAL(x - 8, y + 2) && !DORSAL(x - 9, y + 2) && y > 60 && y < 118) || (DORSAL(x - 17, y + 4) && !DORSAL(x - 18, y + 4) && y > 84 && y < 120) ? P(S1) : 0);
  for (const [x, y] of [[372, 92], [380, 78], [388, 64], [394, 104], [403, 116], [387, 98]]) { px.dot(x, y, P(S6)); px.dot(x + 1, y + 1, P(S0)); }
  // ---- near pectoral fin: armour like the body (dark bands, the spots as lamps, a panel seam), a pale leading edge
  //      facing down-forward, a dark root seam where it leaves the flank, a lava-lit rim near the lake ----
  px.shape(both(PEC, (x, y) => y < PEC_WATER(x)), (x, y) => {
    if (!PEC(x - 1.3, y + 1.1)) return P(S6);                // leading edge
    if (!PEC(x - 3, y + 2.6)) return P(S5);
    if (!PEC(x + 1.6, y + 0.2)) return P(S0);                // trailing edge in shadow
    if (!PEC(x + 3, y - 0.4)) return P(S1);
    if (!PEC(x, y - 1.6)) return P(S2);                      // the root, grown out of the flank (no hard line)
    if (y > PEC_WATER(x) - 4) return P('#7a4a3c');           // lava light on the part about to dip in
    return P(!PEC(x - 6, y + 5) ? S4 : S3);
  });
  // a panel seam across the fin (the stripes carry on), rivets along it
  const finD = (x, y) => (x - 340) * 0.63 + (y - 200) * 0.77;   // distance along the fin from its root
  px.shape(both(PEC, (x, y) => y < PEC_WATER(x) - 3 && PEC(x - 3, y + 2.6) && PEC(x + 2.6, y - 3)), (x, y) => {
    const d = finD(x, y);
    return d >= 18.4 && d < 19.4 ? P(S1) : d >= 19.4 && d < 20.4 ? P(S5) : 0;
  });
  for (const [x, y] of [[352, 218], [358, 213], [364, 208], [370, 203]]) if (PEC(x + 0.5, y + 0.5) && PEC(x - 2.5, y + 3) && PEC(x + 3, y - 3)) { px.dot(x, y, P(S6)); px.dot(x + 1, y + 1, P(S0)); }
  // ---- lava on its back: a sheet along the top, wide tongues pouring down the flank ----
  px.shape((x, y) => { const s = spineAt(x, y); return s.k <= 0 && s.k > -4.6 - 1.8 * Math.sin(s.u * 0.17) && s.v < 0 && s.u > 88 && !DORSAL(x, y); }, (x, y) => {
    const s = spineAt(x, y);
    if (s.k > -1.2) return P(L6);
    if (hsh(Math.floor(x) * 7.3 + Math.floor(y) * 1.9) > 0.9) return P(L2);
    return P(s.k > -3 ? L5 : L4);
  });
  for (const [sx, w0, seed, len] of STREAMS) {
    const y0 = bodyTop(sx) + 2, y1 = len ? y0 + len : WATER(sx);
    for (let y = y0 - 1; y < y1 + 1; y++) {
      const g = clamp((y - y0) / (y1 - y0), 0, 1), xc = sx + Math.sin(y * 0.13 + seed) * 2.6 + (y - y0) * 0.2;
      // wide where it spills over the back, narrowing as it runs down, a bulb where a short one drips
      const w = w0 * (1 - g * 0.6) + (vn(y * 0.25, seed, 3) - 0.5) * 4 + (len && g > 0.82 ? 3 : 0) + (g < 0.1 ? 4 * (1 - g * 10) : 0);
      for (let x = Math.floor(xc - w / 2 - 1); x <= Math.ceil(xc + w / 2 + 1); x++) {
        const d = (x + 0.5 - xc) / (w / 2), ad = Math.abs(d);
        if (ad > 1 || !solid(x + 0.5, y + 0.5) || DORSAL(x + 0.5, y + 0.5) || PEC(x + 0.5, y + 0.5)) continue;
        let c = ad > 0.8 ? L2 : ad > 0.55 ? L4 : ad > 0.22 ? L5 : (d < 0 ? L7 : L6);
        if (ad <= 0.8 && hsh(Math.floor(x / 2) * 7.3 + Math.floor(y / 2) * 1.9 + seed) > 0.9) c = ad > 0.4 ? L2 : L3;   // floating crust
        px.dot(x, y, P(c));
      }
    }
  }
  px.outline();
  // no outline along the waterline (the body carries on under the lava)
  for (let x = px.x0; x < px.x0 + px.w; x++) for (let y = WATER(x) - 1; y < px.y0 + px.h; y++) if (px.get(x, y) === OUTP && !PEC(x + 0.5, y + 0.5) && !PEC(x + 0.5, y - 0.5)) px.dot(x, y, 0);
  // the lava lights it from below (not the lava itself)
  const isLava = (x, y) => { const v = px.get(x, y); if (!v) return false; const [r, g, b] = unpk(v); return r > 170 && b < 120; };
  // the fin's top side faces up, away from the lake: it keeps its armour colours (lit only where it dips in)
  px.warm(164, 216, WARM, 0.62, (x, y) => isLava(x, y) || (PEC(x, y) && y < PEC_WATER(x) - 4 && px.get(x - 0.5, y - 0.5) !== OUTP));
  return px;
}

// lamps (the spots): one per body panel, dense small spots on the head, computed once
const LAMPS = [];
function placeLamps(px) {
  for (let i = 0; i < SEAMS_U.length - 1; i++) {
    const uc = (SEAMS_U[i] + SEAMS_U[i + 1]) / 2;
    for (let j = 0; j < LAMPS_V.length; j++) {
      const n = LAMPS_V[j], [x0, y0] = bodyPt(uc - 5 * (1 - n * n), n), x = Math.round(x0 + (hsh(i * 3 + j) - 0.5) * 2), y = Math.round(y0);
      const c = px.get(x, y), [r, g, b] = c ? unpk(c) : [0, 0, 0];
      if (y < WATER(x) - 3 && c && c !== OUTP && b > r && !DORSAL(x, y) && !PEC(x, y) && !HEAD(x, y)) LAMPS.push({ x, y, s: Math.abs(n) > 0.85 ? 1 : n > 0.35 ? 2 : 3, k: hsh(i * 7 + j * 3) });
    }
  }
  for (let y = 80; y < 160; y += 6) for (let x = 168; x < 330; x += 7) {
    const jx = x + Math.round((hsh(x * 1.3 + y * 7.1) - 0.5) * 3) + ((y / 6) % 2 ? 3 : 0), jy = y + Math.round((hsh(x * 5.7 + y * 1.1) - 0.5) * 2);
    if (!HEAD(jx + 0.5, jy + 0.5) || !HEAD(jx + 2.5, jy - 2.5) || JAW(jx, jy + 2) || LIPS(jx + 0.5, jy + 0.5) || LIPS(jx + 0.5, jy + 2.5) || MOUTH(jx, jy + 4)) continue;
    if (Math.hypot(jx - EYE[0], jy - EYE[1] + 3) < 10 || spineAt(jx, jy).u > HEAD_U - 2) continue;
    if (x >= NX && lipUp(NX) - jy < 0) continue;
    LAMPS.push({ x: jx, y: jy, s: hsh(jx * 1.7 + jy) > 0.8 ? 2 : 1, k: hsh(jx * 3 + jy) });
  }
  // spots on the near pectoral fin too
  for (const [x, y, s] of [[337, 199, 2], [346, 205, 1], [342, 211, 1], [353, 213, 2], [366, 215, 1], [361, 224, 1], [372, 226, 2], [375, 219, 1], [331, 193, 1]]) {
    if (PEC(x + 0.5, y + 0.5) && PEC(x - 2.5, y + 3.5) && PEC(x + 3.5, y - 3) && y < PEC_WATER(x) - 5) LAMPS.push({ x, y, s, k: hsh(x * 3 + y) });
  }
}

// =====================================================================================================================
// Build everything once, the first time the mission loads
// =====================================================================================================================
const bodyTop = x => { for (let y = 40; y < 216; y++) if (inBody(x + 0.5, y + 0.5)) return y; return 216; };
let ART = null;
function build() {
  if (ART) return ART;
  const shark = paintShark();
  placeLamps(shark);
  ART = { bg: paintBackdrop(), ground: paintGround(), shark: shark.canvas(), sx: shark.x0, sy: shark.y0, fan: paintFan(), rock: paintRock(), front: paintFront() };
  return ART;
}

// the intake fan in the throat, backlit (pixel-crisp, five curved blades), painted once
function paintFan() {
  const px = new Pix(-17, -17, 35, 35);
  px.shape((x, y) => Math.hypot(x, y) <= 16.5, (x, y) => {
    const r = Math.hypot(x, y);
    if (r > 15) return P('#2a0808');
    let a = Math.atan2(y, x) - r * 0.09;
    a = ((a % (Math.PI * 2 / 5)) + Math.PI * 2 / 5) % (Math.PI * 2 / 5);
    if (r > 3.5 && a < 0.62) return P(a < 0.14 ? '#7a2010' : '#3a0c0a');
    if (r <= 3.5) return P(r < 1.6 ? V3 : V1);
    return 0;
  });
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; px.dot(Math.round(Math.cos(a) * 15.6), Math.round(Math.sin(a) * 15.6), P(V2)); }
  return px.canvas();
}

// =====================================================================================================================
// Live drawing: the boss (design coordinates; drawShark translates so that design (BX, BY) lands on (e.x, e.y))
// =====================================================================================================================
const MOUTH_PATH = [];
for (let x = FX; x <= NX; x += 2) MOUTH_PATH.push([x, lipUp(x)]);
for (let x = NX; x >= FX; x -= 2) MOUTH_PATH.push([x, lipLo(x)]);
function mouthClip() { ctx.beginPath(); MOUTH_PATH.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }

// the mouth: a dark cavity with a ribbed roof and a lit floor, air rushing in, the white-hot throat with its fan
function drawMouth(t) {
  const [hx, hy] = THROAT, A = build();
  ctx.save(); mouthClip(); ctx.clip();
  ctx.fillStyle = '#1a0507'; ctx.fillRect(FX, FY - 10, NX - FX, 80);
  ctx.fillStyle = '#3e0d0b'; ctx.beginPath(); ctx.ellipse(hx - 10, 178, 56, 24, -0.05, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6a180d'; ctx.beginPath(); ctx.ellipse(hx - 6, 178, 40, 16, -0.05, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#922a10'; ctx.beginPath(); ctx.ellipse(hx - 2, 176, 24, 9, -0.05, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 4; k++) {
    const q = k / 4, rx = lerp(48, 18, q), ry = lerp(30, 12, q), cx = lerp(214, hx, q), cy = lerp(148, hy, q);
    ctx.strokeStyle = k % 2 ? '#2e0909' : '#5a1510'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, -0.12, Math.PI * 1.06, Math.PI * 1.94); ctx.stroke();
  }
  // air rushing in along the cavity walls
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + 0.3, ph = ((t * 0.05 + hsh(i * 3.3)) % 1);
    const r0 = 44 - ph * 26, x = hx + Math.cos(a) * r0 * 1.15, y = hy + Math.sin(a) * r0 * 0.62;
    ctx.fillStyle = 'rgba(255,214,160,' + (0.5 * (1 - ph)).toFixed(2) + ')';
    ctx.fillRect(Math.round(x), Math.round(y), 3, 1);
  }
  // the white-hot throat and the fan silhouetted against it
  for (const [r, c] of [[22, '#4a100b'], [19, L1], [17, L2], [15, L3]]) disc(hx, hy, r, c);
  disc(hx, hy, 14, L5); disc(hx, hy, 10, L6); disc(hx, hy, 6, L7);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.round(t * 0.35 / (Math.PI / 20)) * (Math.PI / 20));
  ctx.drawImage(A.fan, -17, -17);
  ctx.restore();
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(hx, hy, 62, '#ff7a20', 0.42); glow(hx, hy, 26, '#ffd070', 0.45);
  ctx.restore();
}

// the lamps (the whale shark's white spots), glowing
function drawLamps(t) {
  for (const l of LAMPS) {
    const dim = l.k < 0.05 && (t >> 4) % 2;
    if (l.s === 1) { ctx.fillStyle = dim ? LAMPD : LAMP; ctx.fillRect(l.x, l.y, l.k > 0.55 ? 2 : 1, 1); continue; }
    if (l.s === 2) { ctx.fillStyle = LAMPH; ctx.fillRect(l.x, l.y, 2, 2); ctx.fillStyle = dim ? LAMPD : LAMP; ctx.fillRect(l.x, l.y, 1, 1); continue; }
    ctx.fillStyle = LAMPH; ctx.fillRect(l.x - 1, l.y, 4, 2); ctx.fillRect(l.x, l.y - 1, 2, 4);
    ctx.fillStyle = dim ? LAMPD : LAMP; ctx.fillRect(l.x, l.y, 2, 2);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const l of LAMPS) if (l.s > 1) glow(l.x + 1, l.y + 1, l.s === 3 ? 6 : 4, '#8cc8ff', 0.2);
  ctx.restore();
}

// steam puffing out of the gill louvres, rising and drifting back
function drawSteam(t) {
  for (let g = 0; g < GILLS.length; g++) {
    const [gx, gy] = bodyPt(GILLS[g] + 3.5 * 0.7, -0.55);
    for (let i = 0; i < 6; i++) {
      const ph = ((t * 0.5 + i * 7.5 + g * 9) % 45) / 45, x = gx + ph * 20 + Math.sin(ph * 4 + g * 2) * 3, y = gy - 3 - ph * 34;
      const r = Math.round(2 + ph * 7);
      ctx.globalAlpha = 0.36 * (1 - ph) + 0.06;
      disc(x, y, r, '#c9b6c0');
      disc(x - r * 0.3, y - r * 0.3, Math.max(1, Math.round(r * 0.55)), '#f5edf1');
    }
  }
  ctx.globalAlpha = 1;
}

// the vacuum: streaks of air pulled in toward the throat; sparks, embers and lava drops riding them
const STREAKS = [];
for (let i = 0; i < 30; i++) STREAKS.push({ y0: 92 + hsh(i * 3.3) * 128, x0: 6 + hsh(i * 7.1) * 70, bend: (hsh(i * 1.9) - 0.5) * 70, ph: hsh(i * 5.5), len: 0.1 + hsh(i * 2.2) * 0.12 });
function along(s, q) {
  const [tx, ty] = THROAT, mx = (s.x0 + tx) / 2, my = (s.y0 + ty) / 2 + s.bend;
  const a = (1 - q) * (1 - q), b = 2 * (1 - q) * q, c = q * q;
  return [a * s.x0 + b * mx + c * tx, a * s.y0 + b * my + c * ty];
}
function drawVacuum(t) {
  for (const s of STREAKS) {
    const head = (t * 0.016 + s.ph) % 1, tail = Math.max(0, head - s.len);
    if (head < 0.2) continue;
    for (let q = tail; q < head; q += 0.01) {
      const [x, y] = along(s, q);
      if (MOUTH(x, y)) break;
      const k = (q - tail) / (head - tail);
      ctx.fillStyle = 'rgba(255,238,210,' + (0.15 + k * 0.6).toFixed(2) + ')';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      if (q > 0.6 && k > 0.5) ctx.fillRect(Math.round(x), Math.round(y) + 1, 1, 1);
    }
  }
  for (let i = 0; i < 26; i++) {
    const s = STREAKS[(i * 7) % STREAKS.length], q = ((t * 0.02 + hsh(i * 9.7)) % 1) * 0.92 + 0.04;
    const [x, y] = along(s, q);
    if (MOUTH(x, y)) continue;
    ctx.fillStyle = [L5, L7, L4, L6][i % 4]; ctx.fillRect(Math.round(x), Math.round(y), i % 5 ? 1 : 2, i % 5 ? 1 : 2);
  }
  // lava drawn up out of the lake: a tongue curling up over the lower lip, breaking into drops near the throat
  const rib = q => [203 + 9 * q + 3 * Math.sin(q * 6), LAVA + 2 - 50 * Math.pow(q, 0.9)];
  for (const [dr, c] of [[0, L3], [1, L5], [2, L7]]) for (let q = 0; q <= 1; q += 0.01) {
    const [x, y] = rib(q), r = Math.round(3.4 - 2.4 * q) - dr;
    if (r >= 0) disc(x + (dr ? -0.4 : 0), y, r, c);
  }
  for (let i = 0; i < 6; i++) {
    const q = ((t * 0.04 + i / 6) % 1), [x0, y0] = rib(1), x = lerp(x0, THROAT[0] - 6, q), y = lerp(y0, THROAT[1] + 6, q) - Math.sin(q * Math.PI) * 4;
    disc(x, y, q < 0.5 ? 1 : 0, q < 0.5 ? L6 : L5);
  }
  ctx.fillStyle = L5; ctx.beginPath(); ctx.ellipse(205, LAVA + 2, 14, 3, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = L6; ctx.beginPath(); ctx.ellipse(205, LAVA + 2, 8, 2, 0, Math.PI, 0); ctx.fill();
  // grit and pebbles pulled off the ledge in front of the hero
  for (let i = 0; i < 7; i++) {
    const ph = ((t * 0.02 + i / 7) % 1), x = 104 + ph * 70 + i * 3, y = LEDGE - 6 - ph * 22 - hsh(i) * 6;
    ctx.fillStyle = i % 2 ? K5 : '#7a4433'; ctx.fillRect(Math.round(x), Math.round(y), i % 3 ? 1 : 2, i % 3 ? 1 : 2);
  }
}

// a chunk of basalt sucked off the ledge, tumbling toward the mouth with speed lines behind it
// (painted once: a lumpy lava rock, dark crust with glowing cracks, outlined)
function paintRock() {
  // an angular chunk of basalt: a lit top facet, a face glowing from the mouth's side, a hot crack
  const px = new Pix(-10, -9, 20, 18), f = poly([[-7, -2], [-4, -6], [2, -7], [7, -3], [8, 2], [4, 6], [-2, 7], [-7, 3]]);
  px.shape(f, (x, y) => {
    if (!f(x + 1.4, y) || !f(x + 1, y + 1.4)) return P(L4);              // rim lit by the mouth's glow
    if (y < -3.2 + x * 0.1 && x < 4) return P('#b07a60');               // top facet
    if (x > 3.5 || y > 4.5 - x * 0.2) return P(x > 5 ? K7 : '#a8552e'); // the face toward the mouth
    return P(x < -3 ? '#4e3532' : '#6e4a3e');
  });
  px.line(-5, 1, -1, 0, P(L4)); px.line(-1, 0, 1, 3, P(L5)); px.dot(-1, 0, P(L6)); px.dot(-3, 1, P(L6));
  px.outline();
  return px.canvas();
}
function drawRock(t, x, y) {
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = 'rgba(255,226,190,' + (0.55 - i * 0.09).toFixed(2) + ')';
    ctx.fillRect(Math.round(x - 12 - i * 7), Math.round(y - 4 + i * 2 + (i % 2)), 6 + i, 1);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(x, y, 14, '#ff6a1a', 0.3); ctx.restore();
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(Math.round((0.6 + t * 0.15) / (Math.PI / 2)) * (Math.PI / 2));
  ctx.drawImage(build().rock, -10, -9);
  ctx.restore();
}

// the splash where the body leaves the lava: a churned bright rim, drops flung up, lava pouring off the chin
function drawSplash(t) {
  for (let x = 296; x < 482; x++) {
    const y = WATER(x), w = 1 + Math.round(1 + Math.sin(x * 0.3 + t * 0.2));
    if (PEC(x + 0.5, y - 0.5) || PEC(x + 0.5, y + w)) continue;     // the near fin is in front of the rim
    ctx.fillStyle = L7; ctx.fillRect(x, y - 1, 1, 1);
    ctx.fillStyle = L5; ctx.fillRect(x, y, 1, w);
  }
  for (let i = 0; i < 30; i++) {
    const x0 = 298 + i * 6.3 + hsh(i * 3.1) * 4, ph = ((t * 0.8 + hsh(i) * 40) % 40) / 40;
    const h = 5 + hsh(i * 7.3) * 12, y = LAVA - Math.sin(ph * Math.PI) * h, x = x0 + ph * (i % 2 ? 5 : -5);
    ctx.fillStyle = ph < 0.5 ? L6 : L4; ctx.fillRect(Math.round(x), Math.round(y), i % 3 ? 1 : 2, 2);
  }
  // the pectoral fin cutting the near lava
  for (let i = 0; i < 12; i++) {
    const ph = ((t + i * 13) % 30) / 30, a = Math.PI * (0.15 + 0.7 * hsh(i * 2.7)), d = ph * (8 + hsh(i) * 8);
    ctx.fillStyle = ph < 0.5 ? L6 : L4;
    ctx.fillRect(Math.round(PEC_CUT + Math.cos(a) * d * (i % 2 ? 1 : -1)), Math.round(237 - Math.sin(a) * d * 1.2 + ph * ph * 10), 2, 1);
  }
  ctx.fillStyle = L6; ctx.fillRect(PEC_CUT - 10, 237, 22, 1); ctx.fillStyle = L5; ctx.fillRect(PEC_CUT - 13, 238, 28, 2);
  ctx.fillStyle = L4; ctx.fillRect(PEC_CUT + 15, 239, 10, 1); ctx.fillRect(PEC_CUT - 20, 239, 7, 1);
  // lava dribbling off the chin
  for (const [x, y, n] of [[214, 199, 3], [238, 200, 2], [256, 199, 3]]) {
    for (let i = 0; i < n; i++) { const yy = y + ((t * 0.5 + i * 5 + x) % 15); disc(x, yy, i ? 0 : 1, L5); }
  }
  // gobs of lava flung off its back as it rises, arcing down into the lake with a short trail
  for (let i = 0; i < 9; i++) {
    const u0 = 96 + i * 26, [x0, y0] = bodyPt(u0, -1.02), ph = ((t * 0.9 + hsh(i * 5.1) * 60) % 60) / 60;
    const vx = 0.9 + hsh(i * 2.3) * 0.9, vy = -2.2 - hsh(i * 4.7) * 1.6, f = ph * 44;
    for (let k = 3; k >= 0; k--) {
      const ff = Math.max(0, f - k * 1.6), x = x0 + vx * ff, y = y0 + vy * ff + 0.09 * ff * ff;
      if (y > LAVA) continue;
      ctx.fillStyle = k ? (k > 1 ? L3 : L4) : L6;
      ctx.fillRect(Math.round(x), Math.round(y), k ? 1 : 2, k ? 1 : 2);
    }
  }
  // the short tongues end in drips
  for (const [sx, , seed, len] of STREAMS) if (len) {
    const y0 = bodyTop(sx) + 2, x = Math.round(sx + Math.sin((y0 + len) * 0.13 + seed) * 2.6 + len * 0.2), dy = (t * 0.6 + seed * 7) % 26;
    disc(x, y0 + len + 3 + dy, 1, L5); ctx.fillStyle = L6; ctx.fillRect(x, y0 + len + 2 + dy, 1, 1);
  }
}

// foreground (screen space, painted once): dark basalt boulders at the bottom corners, rims lit by the lake
function paintFront() {
  const px = new Pix(-10, 222, W + 20, 58);
  const rocks = [
    poly(smooth([[-12, 252], [6, 242], [24, 246], [38, 256], [44, 270], [-12, 282]], 4)),
    poly(smooth([[404, 264], [418, 250], [436, 244], [458, 240], [478, 236], [494, 240], [494, 282], [400, 282]], 4)),
    poly(smooth([[372, 276], [380, 266], [394, 262], [404, 270], [400, 282], [370, 282]], 3))
  ];
  for (const f of rocks) px.shape(f, (x, y) => {
    if (!f(x, y - 1.5)) return P(L4);
    if (!f(x, y - 3) || !f(x - 2, y - 2)) return P(K6);
    const b = Math.floor((x + Math.floor(y / 9) * 5) / 11);
    return P(hsh(b * 3.3) > 0.5 ? K1 : K2);
  });
  px.outline();
  return px.canvas();
}

const MOUTH_TXT = 'SLUUURP!';
function drawShark(e) {
  const A = build(), t = G.t;
  ctx.save(); ctx.translate(Math.round(e.x) - BX, Math.round(e.y) - BY);
  drawMouth(t);
  ctx.drawImage(A.shark, A.sx, A.sy);
  drawLamps(t);
  drawSteam(t);
  drawSplash(t);
  drawVacuum(t);
  drawRock(t, 152, 136);
  // glints running along the armour's top edges (4-point twinkles, like the bear's claws)
  for (const [x, y, k] of [[214, 87, 0], [292, 84, 9], [384, 57, 17], [452, 152, 25]]) {
    const s = [1, 2, 3, 2, 1, 0, 0, 0][((t >> 2) + k) % 8];
    if (s) { ctx.fillStyle = '#fff6dc'; ctx.fillRect(x - s, y, s * 2 + 1, 1); ctx.fillRect(x, y - s, 1, s * 2 + 1); if (s > 2) ctx.fillRect(x - 1, y - 1, 3, 3); }
  }
  const j = Math.round((hsh(Math.floor(t / 3) * 0.7) - 0.5) * 2);
  text(MOUTH_TXT, 190 + j, 63 + j, '#ffe066', 2, 'center', '#3a1200');
  ctx.restore();
}

// =====================================================================================================================
// Registry entries
// =====================================================================================================================
ENEMY_TYPES.megawhaleshark = {
  hp: 400, boss: true, bossName: 'MEGA WHALE SHARK', edge: 60, contact: 'none', armored: true,
  make(e) { e.state = 'vacuum'; e.st = 0; e.max = 400; e.hp = 371; },
  update(e) { e.state = 'vacuum'; e.st++; e.hp = 371; e.hitT = 0; },    // the screenshot holds the vacuum pose
  draw: drawShark,
  // the weak spot this frame: the open mouth (shots stop inside it)
  box: e => ({ x: e.x - BX + 206, y: e.y - BY + 118, w: 60, h: 62 }),
  onKill(e) { e.state = 'dying'; return 'dying'; }
};

// =====================================================================================================================
// The mission (a stand-in with the real names; only the crater arena is built)
// =====================================================================================================================
LEVELS.push({
  mission: 'MISSION 3', title: 'VOLCANO ISLAND', end: END, heroStart: 120, freedLabel: 'ANIMALS RESCUED',
  sections: [{ x: 0, name: 'AREA 1: SHARK BAY' }, { x: 1500, name: 'AREA 2: HONEY JUNGLE' }, { x: 3000, name: 'AREA 3: LAVA RIVERS' }, { x: 4500, name: 'FINAL AREA: THE CRATER' }],
  terrain: [[0, LEDGE], [CAM + LEDGE_X1 - 12, LEDGE], [CAM + LEDGE_X1 + 4, LAVA + 2], [END, LAVA + 2]],
  plats: [{ x: CAM + 140, y: 210, w: 32, t: 'raft' }], spawns: [], pows: [], props: [],
  locks: [{ at: CAM, boss: true, waves: [{ t: 'megawhaleshark', side: 1, d: 60 }] }],
  music: 'main', bossMusic: 'boss',
  load(cp) {
    build();
    G.banner = null; G.big = null;                 // mid-fight: no area name, no MISSION START band
    G.score = 186350;
    const p = G.p; p.weapon = 'hmg'; p.ammo = 143; p.bombs = 6;
    if (cp >= CAM) {
      // the boss lock is already running with the MEGA WHALE SHARK in it
      const l = G.locks[G.locks.length - 1];
      l.active = true; l.t = 999; l.queue = [];
      const e = makeEnemy({ t: 'megawhaleshark', x: CAM + BX, y: BY }, l);
      e.active = true; e.facing = -1; G.enemies.push(e);
    }
  },
  update() {
    const p = G.p;
    if (G.time < 3) { p.x = CAM + HERO_SX; p.y = LEDGE; p.vy = 0; p.onGround = true; p.facing = 1; }
    keys.KeyX = true;                                // keep firing
    G.shake = 0; G.warnT = 0; G.banner = null; G.big = null;
  },
  drawBG(cx) {
    const A = build();
    ctx.drawImage(A.bg, -10, -10);
    // the lava falls and the glowing cracks light the rock around them; warning lamps blink
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of FALLS) for (let y = f.y0; y < f.y1; y += 14) glow(f.x, y + 7, 15, '#ff6a1a', 0.17);
    for (const [x, y, n] of CRACK_GLOW) glow(x, y, 5 + n * 0.4, '#ff5a14', 0.18);
    ctx.restore();
    BLINK.forEach(([x, y], i) => {
      if ((G.t + i * 23) % 50 < 30) {
        ctx.fillStyle = EVIL; ctx.fillRect(x - 1, y - 1, 3, 2); ctx.fillStyle = '#ffd0c8'; ctx.fillRect(x, y - 1, 1, 1);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(x, y, 9, '#ff3020', 0.35); ctx.restore();
      }
    });
  },
  drawGround(cx) { const A = build(); ctx.drawImage(A.ground, CAM - 10, 166); },
  drawPlat(pl) {
    // a floating raft of basalt: a lit hexagon top with a hot crack, a short side, a bright lava ring and a wake
    // trailing away from the mouth (the vacuum is dragging it)
    const x = Math.round(pl.x), y = pl.y, w = pl.w;
    ctx.fillStyle = L5; ctx.fillRect(x - 4, y + 7, w + 8, 2); ctx.fillStyle = L6; ctx.fillRect(x - 2, y + 6, w + 4, 1);
    for (let i = 1; i < 6; i++) { ctx.fillStyle = i % 2 ? L5 : L4; ctx.fillRect(x - 4 - i * 4, y + 7 + (i >> 1), 3, 1); ctx.fillRect(x - 4 - i * 4, y + 9 - (i >> 1) + i, 3, 1); }
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x - 1, y + 2); ctx.lineTo(x + 3, y - 2); ctx.lineTo(x + w - 3, y - 2); ctx.lineTo(x + w + 1, y + 2); ctx.lineTo(x + w + 1, y + 8); ctx.lineTo(x - 1, y + 8); ctx.fill();
    ctx.fillStyle = K3; ctx.fillRect(x, y + 3, w, 5); ctx.fillStyle = K6; ctx.fillRect(x + (w >> 1), y + 3, w >> 1, 5); ctx.fillStyle = K7; ctx.fillRect(x + w - 3, y + 3, 3, 5);
    ctx.fillStyle = K5; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + 3, y - 1); ctx.lineTo(x + w - 3, y - 1); ctx.lineTo(x + w, y + 2); ctx.lineTo(x + w - 3, y + 4); ctx.lineTo(x + 3, y + 4); ctx.fill();
    ctx.fillStyle = '#9a6048'; ctx.fillRect(x + 3, y - 1, w - 6, 1);
    ctx.fillStyle = L4; ctx.fillRect(x + 9, y + 1, 6, 1); ctx.fillRect(x + 15, y + 2, 4, 1); ctx.fillStyle = L6; ctx.fillRect(x + 12, y + 1, 2, 1);
  },
  drawFront(cx) { ctx.drawImage(build().front, -10, 222); },
  drawOverlay(cx) {
    // warm light rising off the lake, embers drifting up
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, 120, 0, H);
    g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(1, 'rgba(255,90,20,0.12)');
    ctx.fillStyle = g; ctx.fillRect(0, 120, W, H - 120);
    ctx.restore();
    for (let i = 0; i < 40; i++) {
      const x = (hsh(i * 3.7) * W + Math.sin(G.t * 0.03 + i) * 6) | 0, y = H - ((G.t * (0.3 + hsh(i) * 0.5) + hsh(i * 9.1) * H) % H) | 0;
      ctx.fillStyle = i % 3 ? L4 : L6; ctx.fillRect(x, y, 1, 1);
    }
  },
  preview(x, y, w, h) { ctx.fillStyle = '#2c0d14'; ctx.fillRect(x, y, w, h); ctx.fillStyle = L4; ctx.fillRect(x, y + h - 20, w, 20); }
});
}
