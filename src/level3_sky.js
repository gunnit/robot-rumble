'use strict';
var L3 = L3 || {};
// ============================================================
// Mission 3 sky: everything behind and over VOLCANO ISLAND that isn't the world itself.
//  drawBG: four painted backdrops chosen by the camera, lifted from the proposal frames (proposals/level3):
//    SHARK BAY (a golden morning: the open bay, sea stacks, boats, a black-sand spit with palms and a fishing hut, the
//    turquoise lagoon, the volcano far right smoking), HONEY JUNGLE (late morning: misty canopy layers, a basalt cliff
//    with a waterfall, the understory, a canopy ceiling with gaps and light shafts, the same volcano peeking through),
//    LAVA RIVERS (dusk: the volcano close and erupting, lava rivers down its flanks, basalt cliffs with lava falls,
//    flashes when L3.eruptT > 0) and THE CRATER (night inside the volcano: smoky red sky, stars, glowing crater walls
//    with the robots' catwalk, crane and blast door).
//    Static layers are painted once into pixel strips (crisp, no anti-aliasing) and blitted with parallax.
//    Transitions never crossfade two scenes: the old scene dissolves into a mist (humid steam, then volcanic smoke,
//    then dark crater smoke) far layers first, and the new one condenses out of it near layers first; the jungle's
//    canopy ceiling slides in and out as a real forest edge, and the bay's spit ends in a jungle headland.
//  weather(): { ash, steam, night, erupt } from the camera (and L3.eruptT, which this file counts down).
//  drawOverlay: light tints, sea spray glints, steam wisps, motes, ash and embers (screen space, after the world).
// Exports on the shared L3 object: skyLoad(cp), skyUpdate(), drawBG(cx), drawOverlay(cx), weather().
// Never calls Math.random: the moving bits use G.t and hsh(), the particles a private random stream.
// ============================================================
{
// ============================================================
// Helpers: easing, smooth noise, a private random stream, colours
// ============================================================
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (v, m) => ((v % m) + m) % m;
const h2 = (x, y, s) => hsh(x * 12.9898 + y * 78.233 + s * 37.719);
function vnoise(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hsh(i * 1.37 + s * 61.3), hsh((i + 1) * 1.37 + s * 61.3), u); }
function fbm(x, s, oct) {
  let v = 0, a = 1, n = 0, f = 1;
  for (let o = 0; o < (oct || 3); o++) { v += a * vnoise(x * f, s + o * 17); n += a; a *= 0.5; f *= 2.07; }
  return v / n;
}
function vn2(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return lerp(lerp(h2(i, j, s), h2(i + 1, j, s), a), lerp(h2(i, j + 1, s), h2(i + 1, j + 1, s), a), b);
}
function fbm2(x, y, s, oct) {
  let v = 0, a = 1, n = 0, f = 1;
  for (let o = 0; o < (oct || 3); o++) { v += a * vn2(x * f, y * f, s + o * 13); n += a; a *= 0.5; f *= 2.03; }
  return v / n;
}
// a table of hashes (made at the first build) for the dense jungle textures: nz(x, y) in 0..1
let NZT = null;
function makeNZT() {
  let a = 330311;
  NZT = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    NZT[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
const nz = (x, y) => NZT[((Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0) & 65535];
function jvn(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = (s | 0) * 977;
  return lerp(lerp(nz(i + o, j), nz(i + 1 + o, j), a), lerp(nz(i + o, j + 1), nz(i + 1 + o, j + 1), a), b);
}
function jfbm(x, y, s, oct) {
  let v = 0, a = 1, n = 0, f = 1;
  for (let o = 0; o < (oct || 3); o++) { v += a * jvn(x * f, y * f, s + o * 13); n += a; a *= 0.5; f *= 2.03; }
  return v / n;
}
// ordered dithering (4x4 Bayer) for ramps
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
// the particles' own random stream (never Math.random)
let seed = 1;
const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const rr = (a, b) => a + rnd() * (b - a);

// Colours: '#rrggbb' -> 0xRRGGBB ints for the pixel buffers
const NONE = -1;
const ICACHE = new Map();
const I = s => { let v = ICACHE.get(s); if (v === undefined) { v = parseInt(s.slice(1, 7), 16); ICACHE.set(s, v); } return v; };
const PI = (...s) => s.map(I);
function mixI(a, b, k) {
  k = clamp(k, 0, 1);
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  return Math.round(ar + ((b >> 16 & 255) - ar) * k) << 16 | Math.round(ag + ((b >> 8 & 255) - ag) * k) << 8 | Math.round(ab + ((b & 255) - ab) * k);
}
const mixC = (a, b, k) => mixI(I(a), I(b), k);
const hexI = c => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const hexMix = (a, b, k) => hexI(mixC(a, b, k));
const rgbs = c => { const v = typeof c === 'string' ? I(c) : c; return (v >> 16 & 255) + ',' + (v >> 8 & 255) + ',' + (v & 255); };
const rgba = (c, a) => 'rgba(' + rgbs(c) + ',' + clamp(a, 0, 1).toFixed(3) + ')';
// pick from a palette (ints) by t in 0..1, ordered dithering between neighbours
function ramp(pal, t, x, y) { const f = clamp(t, 0, 1) * (pal.length - 1), i = Math.floor(f); return pal[Math.min(pal.length - 1, i + (f - i > bay(x, y) ? 1 : 0))]; }
const flat = (pal, t) => pal[clamp(Math.round(t * (pal.length - 1)), 0, pal.length - 1)];
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ============================================================
// Pixel buffers: 0xRRGGBB ints, NONE = empty. A local point (x, y) lands on buffer pixel (x + ox, y + oy).
// ============================================================
function buf(w, h, ox, oy) { w = Math.ceil(w); h = Math.ceil(h); const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox: ox || 0, oy: oy || 0 }; }
function put(b, x, y, c) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) {
  x = Math.round(x) + b.ox; y = Math.round(y) + b.oy;
  const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(b.w, x + Math.round(w)), y1 = Math.min(b.h, y + Math.round(h));
  for (let r = y0; r < y1; r++) b.d.fill(c, r * b.w + x0, r * b.w + Math.max(x0, x1));
}
function disc(b, cx, cy, r, c, only) {
  const n = Math.ceil(r), R2 = (r + 0.5) * (r + 0.5), X = Math.round(cx), Y = Math.round(cy);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) if (i * i + j * j <= R2 && (only === undefined || get(b, X + i, Y + j) === only)) put(b, X + i, Y + j, c);
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
function path(b, pts, c, t) { for (let i = 0; i + 1 < pts.length; i++) line(b, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, t); }
function bez(p, n) {
  n = n || 24;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0], u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]]);
  }
  return out;
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
// 1px outline round everything painted (4 neighbours)
function outline(b, c) {
  const add = [], w = b.w, d = b.d;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i] !== NONE) continue;
    if ((x > 0 && d[i - 1] !== NONE) || (x < w - 1 && d[i + 1] !== NONE) || (y > 0 && d[i - w] !== NONE) || (y < b.h - 1 && d[i + w] !== NONE)) add.push(i);
  }
  for (const i of add) d[i] = c;
}
// mix every painted pixel toward colour c by k(x, y) (local coordinates): haze and mist
function hazeB(b, c, k) {
  for (let r = 0; r < b.h; r++) for (let q = 0; q < b.w; q++) {
    const i = r * b.w + q, v = b.d[i];
    if (v === NONE) continue;
    const m = k(q - b.ox, r - b.oy);
    if (m > 0) b.d[i] = mixI(v, c, m);
  }
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
// an RGBA canvas of one colour from fn(x, y) -> alpha 0..1 (soft light, glows, mist)
function alphaCanvas(w, h, col, fn) {
  const c = canvasOf(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data, C = I(col);
  const r = C >> 16 & 255, gg = C >> 8 & 255, bb = C & 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = fn(x, y);
    if (!(a > 0.004)) continue;
    const j = (y * w + x) * 4; d[j] = r; d[j + 1] = gg; d[j + 2] = bb; d[j + 3] = Math.round(Math.min(1, a) * 255);
  }
  g.putImageData(im, 0, 0);
  return c;
}
// a sprite: a buffer baked with its anchor (the local point drawn at (x, y))
const sprite = b => ({ img: bake(b), w: b.w, h: b.h, ox: b.ox, oy: b.oy });
const blitS = (g, s, x, y) => g.drawImage(s.img, Math.round(x) - s.ox, Math.round(y) - s.oy);
// crisp pixel disc on a live canvas in the current fillStyle
function pdisc(g, x, y, r) {
  x = Math.round(x); y = Math.round(y);
  const R2 = (r + 0.5) * (r + 0.5);
  for (let j = -Math.floor(r); j <= Math.floor(r); j++) { const hw = Math.floor(Math.sqrt(R2 - j * j)); g.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
}

// ============================================================
// Scenes and strips. A strip is painted in "design" coordinates = screen coordinates at its scene's first camera
// x (cam0); it is wide enough for its parallax p over the scene's camera range. Local x runs from -10.
// ============================================================
const SCN = {
  bay: { cam0: 0, cam1: 2300 },
  canopy: { cam0: 1400, cam1: 4000 },
  jungle: { cam0: 1900, cam1: 3900 },
  lava: { cam0: 3400, cam1: 5300 },
  crater: { cam0: 4900, cam1: 5720 }
};
// the transitions (camera x): the old scene dissolves into the mist, the new one condenses out of it
const T1 = [1950, 2250], T2 = [3420, 3860], T3 = [4950, 5290];
function strip(S, p, top, bot, fn) {
  const w = W + 22 + Math.ceil((S.cam1 - S.cam0) * p), b = buf(w, bot - top, 10, -top);
  fn(b, w - 10);
  return { S, p, top, h: bot - top, c: bake(b), b };
}
const offOf = (L, cx) => clamp(Math.round((cx - L.S.cam0) * L.p), 0, L.c.width - W - 20);
function blit(g, L, cx) { g.drawImage(L.c, offOf(L, cx), 0, W + 20, L.h, -10, L.top, W + 20, L.h); }

// ============================================================
// Sky columns: a 1 px wide column of colours stretched across the screen (cached per key)
// ============================================================
function gradCol(stops, y) {
  let i = 0;
  while (i + 1 < stops.length && stops[i + 1][0] <= y) i++;
  const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
  return b[0] > a[0] ? mixC(a[1], b[1], clamp((y - a[0]) / (b[0] - a[0]), 0, 1)) : I(a[1]);
}
function skyColumn(stops) {
  const b = buf(1, H + 20, 0, 10);
  for (let y = -10; y < H + 10; y++) put(b, 0, y, gradCol(stops, y));
  return bake(b);
}
const fillCol = (g, col) => g.drawImage(col, 0, 0, 1, H + 20, -10, -10, W + 20, H + 20);

// ============================================================
// SHARK BAY (morning). Sun upper left, the volcano far right, the open bay, a black-sand spit with palms and a fishing
// hut across the lagoon; at its right end the spit rises into a jungle headland (the jungle is next).
// ============================================================
const HZ = 126;                        // the sea horizon
const SKY_BAY = [[-10, '#3a6fc6'], [22, '#4e86d4'], [50, '#7aa9de'], [74, '#aac9e0'], [92, '#dcd6c8'], [106, '#f8d7ae'], [118, '#ffdca6'], [HZ, '#ffe4b0']];
const sunX = cx => 84 - Math.round(cx * 0.01);
function sunCanvas() {
  const R0 = 84, c = canvasOf(R0 * 2, R0 * 2), g = c.getContext('2d');
  const gr = g.createRadialGradient(R0, R0, 3, R0, R0, R0);
  gr.addColorStop(0, 'rgba(255,250,228,0.95)'); gr.addColorStop(0.15, 'rgba(255,238,190,0.5)'); gr.addColorStop(0.42, 'rgba(255,224,164,0.16)'); gr.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = gr; g.fillRect(0, 0, R0 * 2, R0 * 2);
  const b = buf(R0 * 2, R0 * 2, R0, R0);
  disc(b, 0, 0, 12, I('#ffe3a2')); disc(b, 0, 0, 11, I('#fff0c4')); disc(b, -1, -1, 9, I('#fffae6')); disc(b, -2, -2, 5, I('#ffffff'));
  g.drawImage(bake(b), 0, 0);
  return c;
}
// soft rays fanning right and down from the sun in the upper left (two sets, crossfaded so they shimmer)
function rayCanvas(s) {
  const w = 560, h = 320, c = canvasOf(w, h), g = c.getContext('2d'), ox = 100, oy = 80;
  for (let i = 0; i < 12; i++) {
    const a = -0.3 + (i + hsh(i * 3 + s) * 0.7) / 12 * 2.2, len = 230 + hsh(i * 7 + s) * 230, wd = 0.018 + hsh(i * 5 + s) * 0.03;
    const gr = g.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
    gr.addColorStop(0, 'rgba(255,238,198,0.22)'); gr.addColorStop(1, 'rgba(255,238,198,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(ox, oy);
    g.lineTo(ox + Math.cos(a - wd) * len, oy + Math.sin(a - wd) * len); g.lineTo(ox + Math.cos(a + wd) * len, oy + Math.sin(a + wd) * len);
    g.closePath(); g.fill();
  }
  return c;
}
// cumulus, lit from the side lx (-1 = from the left), coloured undersides
function cloudCanvas(w, s, pal, lx) {
  const h = Math.round(w * 0.5) + 6, base = h - 3, b = buf(w + 10, h, 5, 0), puffs = [];
  const n = 3 + Math.floor(w / 20), m = 1 + Math.floor(w / 46);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, r = w * (0.08 + 0.1 * Math.sin(t * Math.PI)) * (0.8 + 0.45 * hsh(s * 7 + i)); puffs.push([t * w, base - r * 0.6, r]); }
  for (let i = 0; i < m; i++) { const t = 0.32 + 0.36 * (m === 1 ? 0.5 : i / (m - 1)) + (hsh(s * 3 + i) - 0.5) * 0.14, r = w * (0.15 + 0.06 * hsh(s * 11 + i)); puffs.push([t * w, base - r * 0.55 - w * 0.12, r]); }
  const [C0, C1, C2] = pal.map(I);
  const lay = (dx, dy, dr, c, cut) => {
    for (const [x, y, r] of puffs) {
      const R2 = r + dr;
      if (R2 <= 0) continue;
      for (let yy = -Math.floor(R2); yy <= R2; yy++) {
        const Y = Math.round(y + dy + yy);
        if (Y > base - cut) break;
        const hw = Math.floor(Math.sqrt((R2 + 0.5) ** 2 - yy * yy));
        for (let X = Math.round(x + dx) - hw; X <= Math.round(x + dx) + hw; X++) put(b, X, Y, c);
      }
    }
  };
  lay(0, 0, 0, C0, 0);
  lay(-0.5 * lx, -2, -0.8, C1, 3);
  for (const [x, y, r] of puffs) {
    const hr = r * 0.55, hx = x + lx * r * 0.28, hy = y - r * 0.38;
    for (let yy = -Math.floor(hr); yy <= hr; yy++) {
      const hw = Math.floor(Math.sqrt((hr + 0.5) ** 2 - yy * yy));
      for (let X = Math.round(hx) - hw; X <= Math.round(hx) + hw; X++) if (get(b, X, Math.round(hy + yy)) === C1) put(b, X, Math.round(hy + yy), C2);
    }
  }
  for (let X = -5; X < w + 5; X++) if (get(b, X, base) === C0 && hsh(X * 1.7 + s) > 0.5) put(b, X, base + 1, C0);
  return bake(b);
}
// clouds: [width, x, y, parallax, drift]; they wrap round a span wider than the screen
const CL_BAY = [[96, 176, 62, 0.05, 0.012], [64, 276, 94, 0.04, 0.009], [46, 446, 82, 0.06, 0.014], [38, 6, 40, 0.07, 0.016], [30, 120, 104, 0.035, 0.008], [52, 610, 30, 0.06, 0.011]];
const CL_JUNGLE = [[70, 120, 20, 0.05, 0.02], [44, 330, 34, 0.04, 0.016], [90, 560, 12, 0.06, 0.024]];

// ------------------------------------------------------------ the volcano (one landmark for the bay and the jungle)
// Painted in design coordinates with the crater at VX (as in the proposal's bay frame at camera 600); drawn shifted so
// the crater sits at volcX(cx). It drifts left slowly as the hero walks toward it.
const VX = 372, VTOP = 57, VWL = 128, VWR = 152;
const volcX = cx => 392 - Math.round(cx * 0.04);
function vprof(x) {
  const d = x - VX, ad = Math.abs(d), rim = 8, VW = d < 0 ? VWL : VWR;
  if (ad > VW) return 999;
  let y;
  if (ad <= rim) y = VTOP;
  else { const t = (ad - rim) / (VW - rim); y = VTOP + (HZ - 1 - VTOP) * (1 - Math.pow(1 - t, 2.3)); }
  const nx = x - (VX + 3);
  if (Math.abs(nx) < 3.5) y = Math.max(y, VTOP + 3.5 - Math.abs(nx));   // the notch in the crater rim
  if (d < -2 && ad < rim + 2) y -= 1;                                    // left rim a touch higher
  y += (fbm(x / 6, 3, 2) - 0.5) * (0.8 + 2.4 * ss(VTOP + 25, HZ, y));
  return y;
}
// variant 'bay': lilac morning haze, a low far coast on its left, surf, its reflection in the bay;
// variant 'jungle': humid green-white haze, the jungle slopes carried on down behind the far forest
function paintVolcano(kind) {
  const jungle = kind === 'jungle', HAZE = jungle ? I('#cfe2d6') : I('#c7c3d7'), base = jungle ? 150 : HZ;
  const b = buf(420, (jungle ? base : HZ + 12) - 36, 150, -36);   // local x 150..570 -> design x 0..420 + 150? (ox = -150 shift below)
  b.ox = -140;                                                     // local design x 140 .. 560
  const C = {
    lit: I('#c99a86'), litG: I('#b08a80'), litR: I('#dcb49c'),
    sh: I('#7b7391'), shG: I('#6c6584'), shR: I('#8a829f'),
    flowL: I('#7c656c'), flowS: I('#554f6d'),
    jl: [I('#97ba73'), I('#77a067'), I('#5b8263')], js: [I('#719a7c'), I('#5c8371'), I('#4b6b69')]
  };
  if (!jungle) {
    // the low far coast left of the volcano, sinking into the sea
    for (let x = 150; x < VX - VWL + 12; x++) {
      const top = HZ - 1 - 6.5 * ss(150, 246, x) - 2.2 * fbm(x / 7, 11, 2) * ss(150, 190, x);
      for (let y = Math.round(top); y < HZ; y++) {
        const k = vn2(x / 2.4, y / 2, 14);
        put(b, x, y, mixI(k > 0.62 ? I('#86a98c') : k < 0.36 ? I('#5d8277') : I('#71967f'), HAZE, 0.42));
      }
    }
  }
  const FLOWS = [[-60, 4, 0.44], [-33, 3, 0.58], [-13, 2.5, 0.34], [16, 3.5, 0.5], [46, 3, 0.38], [80, 4, 0.52], [110, 3, 0.46]];
  for (let x = VX - VWL - (jungle ? 40 : 0); x <= VX + VWR + (jungle ? 40 : 0); x++) {
    let top = vprof(x);
    if (jungle && top >= HZ) top = HZ - 1 + (Math.abs(x - VX) - (x < VX ? VWL : VWR)) * 0.25;
    if (top >= base) continue;
    const ty = Math.ceil(top);
    for (let y = ty; y < base; y++) {
      const r = (HZ - y) / (HZ - VTOP);
      const bx = (x - VX) * (HZ - VTOP) / Math.max(2, y - VTOP + 2);
      const g = 0.55 * vnoise(bx / 3.2 + 40, 5) + 0.45 * vnoise(bx / 1.4 + y / 7, 15);
      const lit = (x - VX) + (g - 0.5) * 10 * (1 - r) + (vnoise(y / 5, 8) - 0.5) * 3 < 3;
      const jung = r < 0.32 + (fbm(x / 13, 9, 2) - 0.5) * 0.18;
      let c;
      if (jung) {
        const k = vn2(x / 2.3, y / 2, 4) + (r > 0.26 ? 0.12 : 0);
        const P = lit ? C.jl : C.js;
        c = k > 0.66 ? P[0] : k < 0.36 ? P[2] : P[1];
      } else {
        let flow = false;
        for (const [fx, fw, fe] of FLOWS) if (r > fe && Math.abs(bx - fx - Math.sin(r * 9 + fx) * 2.5) < fw * (0.6 + 0.7 * (1 - r))) flow = true;
        if (flow) c = lit ? C.flowL : C.flowS;
        else c = lit ? (g > 0.68 ? C.litR : g < 0.32 ? C.litG : C.lit) : (g > 0.68 ? C.shR : g < 0.32 ? C.shG : C.sh);
      }
      if (y === ty && x < VX + 2) c = mixI(c, I(jungle ? '#fff6dc' : '#ffe6c8'), 0.55);   // the rim catching the sun
      put(b, x, y, mixI(c, HAZE, (jungle ? 0.24 : 0.28) + 0.2 * clamp(1 - r, 0, 1.4)));
    }
  }
  // the crater: a dark inner wall in the notch, warm light on its lip
  for (let x = VX; x <= VX + 6; x++) { const y = Math.ceil(vprof(x)); put(b, x, y, mixC('#5c4a55', '#c7c3d7', 0.2)); put(b, x, y - 1, mixC('#ff9a5a', '#c7c3d7', 0.15)); }
  // a radio mast on the rim: the robots are home
  rect(b, VX - 6, Math.ceil(vprof(VX - 6)) - 5, 1, 5, mixC('#3a3a4a', '#c7c3d7', 0.35));
  if (!jungle) {
    // surf where the volcano's coast meets the sea
    for (let x = 146; x < VX + VWR + 4; x++) if (get(b, x, HZ - 1) !== NONE && hsh(x * 2.3) > 0.45) put(b, x, HZ - 1, mixC('#f2f6ee', '#c7c3d7', 0.15));
    // its reflection in the bay, broken by the swell (drawn over the sea strip)
    for (let x = 140; x < 560; x++) for (let k = 1; k <= 10; k++) {
      const src = get(b, x, HZ - k);
      if (src === NONE || (x + k * 3) % 5 === 0 || h2(x, k, 3) > 0.72) continue;
      put(b, x, HZ - 1 + k, mixI(stepCol(BAYB, HZ - 1 + k), src, 0.3 * (1 - k / 12)));
    }
  }
  return sprite(b);
}
// the plume over the crater, drifting right (painted once, lit from the upper left, thinning into the sky)
function plumeCanvas(skyStops, warm) {
  const b = buf(240, 80, 12, 60), puffs = [];
  for (let i = 0; i < 34; i++) {
    const s = i / 33, x = s * 150 + s * s * 50 + (hsh(i * 1.1) - 0.5) * 4, y = -s * 38 + s * s * 16 - 2 + (hsh(i * 1.3) - 0.5) * 3;
    puffs.push([x, y, 2.4 + s * 10 + hsh(i * 3.7) * 2.2]);
  }
  for (const [x, y, r] of puffs) disc(b, x + 1, y + 1.5, r, I('#a8a1b6'));
  for (const [x, y, r] of puffs) disc(b, x, y, r - 0.6, I('#dcd5da'));
  for (const [x, y, r] of puffs) disc(b, x - r * 0.3, y - r * 0.36, r * 0.55, I('#fff4e4'));
  for (let y = -60; y < 20; y++) for (let x = -12; x < 228; x++) {
    const c = get(b, x, y);
    if (c === NONE) continue;
    let d = mixI(c, I(warm), 0.4 * (1 - ss(0, 16, x)));
    d = mixI(d, gradCol(skyStops, VTOP + y), 0.75 * ss(40, 225, x));
    put(b, x, y, d);
  }
  return sprite(b);
}
// the stepped colour of a list of [y, '#hex'] stops (water bands)
function stepCol(stops, y) { let i = 0; while (i + 1 < stops.length && stops[i + 1][0] <= y) i++; return I(stops[i][1]); }
// water bands with dithered seams
function bands(b, stops, y0, y1, X0, X1) {
  for (let y = y0; y < y1; y++) {
    let i = 0;
    while (i + 1 < stops.length && stops[i + 1][0] <= y) i++;
    const c = I(stops[i][1]), prev = i > 0 ? I(stops[i - 1][1]) : c, seam = y - stops[i][0];
    for (let x = X0; x < X1; x++) put(b, x, y, (seam === 0 && ((x + y) & 1)) || (seam === 1 && x % 4 === 0) ? prev : c);
  }
}

// ------------------------------------------------------------ the far sea stacks (p 0.03)
function paintStacks(b) {
  const STACKS = [[19, 10, 18, 0], [33, 5, 9, 1], [44, 14, 13, 2], [-4, 6, 7, 3]];
  for (const [sx, w, hgt, k] of STACKS) {
    for (let x = sx; x < sx + w; x++) {
      const u = (x - sx + 0.5) / w, prof = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), 3)), 0.5);
      const top = Math.round(HZ - hgt * (0.5 + 0.5 * prof) - (h2(x, k, 3) - 0.5) * 2.5);
      for (let y = top; y < HZ; y++) {
        const ax = Math.abs(x - (sx + 7));
        if (k === 2 && ax < 2.5 && y > HZ - 6 + ax * 0.9) continue;
        let c = u < 0.22 ? '#b6a8b4' : u > 0.74 ? '#686684' : vn2(x / 1.3, y / 2.5, k + 5) > 0.55 ? '#958aa2' : '#837d99';
        if (y === top && u < 0.6) c = '#cdbcc0';
        if (y > HZ - 3) c = '#5e5c78';
        put(b, x, y, mixC(c, '#c7c3d7', 0.22));
      }
      if (prof > 0.55 && h2(x, k, 9) > 0.25) { put(b, x, top - 1, mixC(h2(x, k, 11) > 0.5 ? '#7f9e6e' : '#5f8262', '#c7c3d7', 0.25)); if (h2(x, k, 12) > 0.6) put(b, x, top - 2, mixC('#7f9e6e', '#c7c3d7', 0.3)); }
    }
    for (let x = sx - 2; x < sx + w + 2; x++) if (hsh(x * 1.9 + k) > 0.3) put(b, x, HZ - 1, I('#f4f6f2'));
  }
  // a low far islet with a few palms, further along
  for (let x = 236; x < 300; x++) {
    const u = (x - 236) / 64, top = Math.round(HZ - 1 - 5 * Math.sin(u * Math.PI) - 1.5 * fbm(x / 5, 17, 2));
    for (let y = top; y < HZ; y++) put(b, x, y, mixI(vn2(x / 2, y / 2, 18) > 0.55 ? I('#7a9a84') : I('#668a78'), I('#c7c3d7'), 0.45));
    if (hsh(x * 2.1) > 0.4) put(b, x, HZ - 1, I('#eef2ee'));
  }
  for (const [px0, h] of [[252, 9], [262, 12], [281, 8]]) {
    for (let k = 0; k < h; k++) put(b, px0 + Math.round(k * 0.15), HZ - 4 - k, mixC('#6a6a70', '#c7c3d7', 0.4));
    for (const dx of [-3, -2, -1, 1, 2, 3]) put(b, px0 + Math.round(h * 0.15) + dx, HZ - 4 - h + Math.abs(dx) * 0.5, mixC('#5a7a62', '#c7c3d7', 0.4));
  }
}

// ------------------------------------------------------------ the open bay between the horizon and the spit (p 0.06)
const BAYB = [[HZ, '#f7e9c6'], [HZ + 1, '#e2e2cf'], [HZ + 3, '#b8d6d4'], [HZ + 6, '#92c6d0'], [HZ + 10, '#70b2c9'], [HZ + 16, '#589fc0'], [HZ + 24, '#4890b6'], [HZ + 33, '#3e84ad']];
function paintBay(b, X1) {
  bands(b, BAYB, HZ, 176, -10, X1);
  const n = Math.round(300 * (X1 + 10) / 560);
  for (let i = 0; i < n; i++) {
    const y = Math.round(HZ + 3 + Math.pow(hsh(i * 3.7 + 0.5), 1.1) * (174 - HZ - 3)), x = -10 + hsh(i * 5.3 + 1) * (X1 + 10);
    const len = 2 + Math.round((y - HZ) / 5 * (0.5 + hsh(i * 1.9))), base = stepCol(BAYB, y);
    rect(b, x, y, len, 1, hsh(i * 9.1) > 0.4 ? mixI(base, I('#ffffff'), 0.3) : mixI(base, I('#1d5576'), 0.16));
  }
}

// ------------------------------------------------------------ the lagoon (p 0.3)
const LAGB = [[164, '#c3f2e2'], [167, '#a9ecdd'], [171, '#8de3d6'], [177, '#6fd7cf'], [185, '#53c9c8'], [195, '#3db8c1'], [207, '#2fa8b9'], [220, '#2498af'], [235, '#1c88a5'], [251, '#16799a'], [265, '#116c8e']];
function paintLagoon(b, X1) {
  const X0 = -10;
  bands(b, LAGB, 164, H, X0, X1);
  for (let y = 164; y < 180; y++) for (let x = X0; x < X1; x++) put(b, x, y, mixI(get(b, x, y), I('#fff0cc'), 0.32 * (1 - ss(164, 180, y))));
  // wind patches: broad lighter and darker stretches of water
  for (let y = 172; y < H; y++) for (let x = X0; x < X1; x++) {
    const k = vn2(x / 26, y / 5, 41) - 0.5;
    if (Math.abs(k) < 0.14) continue;
    put(b, x, y, mixI(get(b, x, y), k > 0 ? I('#dafff6') : I('#0d5a72'), Math.min(0.1, (Math.abs(k) - 0.14) * 0.45)));
  }
  // wavelets: little arched crests with a shaded back, bigger toward the viewer; plain trough dashes between
  const n = Math.round(760 * (X1 - X0) / 560);
  for (let i = 0; i < n; i++) {
    const k = Math.pow(hsh(i * 2.9 + 7), 0.8), y = Math.round(170 + k * (H - 170)), x = Math.round(X0 + hsh(i * 6.1 + 3) * (X1 - X0));
    const sc = clamp((y - 166) / 100, 0, 1), len = Math.max(2, Math.round(2 + sc * 8 * (0.6 + hsh(i * 2.3) * 0.8))), base = get(b, x, y);
    if (base === NONE) continue;
    if (hsh(i * 8.3) > 0.4) {
      rect(b, x, y, len, 1, mixI(base, I('#e8fffb'), 0.34 + 0.12 * sc));
      if (len >= 5) rect(b, x + 1, y - 1, len - 2, 1, mixI(base, I('#e8fffb'), 0.2));
      rect(b, x + 1, y + 1, Math.max(1, len - 1), 1, mixI(base, I('#0d5a72'), 0.15));
    } else rect(b, x, y, len, 1, mixI(base, I('#0d5a72'), 0.17));
  }
}

// ------------------------------------------------------------ the spit (p 0.18): palms, scrub, the hut, a canoe
const LEAF = PI('#c4e47c', '#86c45a', '#559e47', '#357a3b', '#245a2f');
function frond(b, x, y, a, L, droop, seed, pass) {
  const steps = Math.ceil(L * 1.6), sh = pass === 0 ? 1 : 0;
  for (let i = 1; i <= steps; i++) {
    const s = i / steps;
    const X = x + Math.cos(a) * L * s + sh, Y = y + Math.sin(a) * L * s + droop * L * s * s + sh;
    let tx = Math.cos(a), ty = Math.sin(a) + 2 * droop * s; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
    put(b, X, Y, pass === 0 ? LEAF[4] : s < 0.5 ? I('#8a8a3a') : LEAF[3]);
    if (i % 2) continue;
    const ll = (1 - s * 0.7) * 7 * Math.min(1.1, L / 18);
    for (const side of [-1, 1]) {
      const r = side * 0.95, dx = tx * Math.cos(r) - ty * Math.sin(r), dy = tx * Math.sin(r) + ty * Math.cos(r) + 0.6, dl = Math.hypot(dx, dy);
      const ux = dx / dl, uy = dy / dl, n = Math.max(1, Math.round(ll * (0.8 + 0.4 * h2(i, side, seed))));
      const litSide = uy < 0.15 || ux < -0.45;
      for (let k = 1; k <= n; k++) {
        const c = pass === 0 ? LEAF[4] : litSide ? (k === n && uy < 0 ? LEAF[0] : LEAF[1]) : (k > n - 2 ? LEAF[3] : LEAF[2]);
        put(b, X + ux * k, Y + uy * k, c);
      }
    }
  }
}
function palm(b, x0, y0, hgt, lean, seed, s) {
  const x1 = x0 + lean, y1 = y0 - hgt, qx = x0 + lean * 0.05 + (hsh(seed * 3.3) - 0.5) * 6, qy = y0 - hgt * 0.55;
  const at = t => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * qx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * qy + t * t * y1];
  const TR = PI('#c9a87e', '#9a7c5c', '#6f5944', '#584638');
  const n = Math.ceil(hgt * 2.2);
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = at(t), wd = Math.max(2, Math.round(lerp(4.6, 2.6, t) * s));
    const xl = Math.round(x - wd / 2), yy = Math.round(y), ring = ((yy + seed * 7) % 4) === 0;
    for (let k = 0; k < wd; k++) put(b, xl + k, yy, ring ? (k === 0 ? TR[1] : TR[3]) : k === 0 ? TR[0] : k === wd - 1 ? TR[2] : TR[1]);
  }
  rect(b, Math.round(x0 - 3 * s), y0 - 1, Math.round(6 * s) + 1, 2, TR[2]);
  const NF = 9;
  for (let pass = 0; pass < 2; pass++) for (let f = 0; f < NF; f++) {
    const a = -Math.PI + 0.12 + (f / (NF - 1)) * (Math.PI - 0.24) + (hsh(seed * 9 + f) - 0.5) * 0.3;
    const up = Math.abs(a + Math.PI / 2) < 0.5;
    const L = (17 + hsh(seed * 5 + f) * 9) * s * (up ? 0.72 : 1);
    frond(b, x1, y1, a, L, 0.5 + hsh(seed * 7 + f) * 0.4 + (up ? 0.25 : 0), seed * 13 + f, pass);
  }
  for (let k = 0; k < 3; k++) { const cx = x1 + (k - 1) * 2.4, cy = y1 + 3 + (k % 2); disc(b, cx, cy, 1.3, I('#6a5628')); put(b, Math.round(cx) - 1, Math.round(cy) - 1, I('#a68e48')); }
}
function scrub(b, x, y, r, sd, C) {
  C = C || PI('#a8d466', '#66a14a', '#43803d', '#2c5c33');
  disc(b, x, y, r, C[3]);
  disc(b, x - 0.6, y - 0.8, r - 0.8, C[2]);
  disc(b, x - 1.2, y - 1.7, Math.max(0, r - 2.2), C[1]);
  for (let k = 0; k < r * 4; k++) {
    const a = hsh(sd * 3 + k) * 6.283, d = hsh(sd * 5 + k) * r;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.9;
    if (get(b, px, py) === NONE) continue;
    put(b, px, py, py < y - r * 0.3 ? C[0] : C[3]);
  }
  if (hsh(sd * 7) > 0.45) for (let k = 0; k < 3; k++) { const px = x + (hsh(sd + k * 3) - 0.5) * r * 1.4, py = y - r * 0.4 + hsh(sd * 2 + k) * r * 0.6; if (get(b, px, py) !== NONE) put(b, px, py, k % 2 ? I('#ff7fae') : I('#ffd2e4')); }
}
function hut(b, x, base) {
  const WW = 34, fl = base - 9, wt = fl - 15, rt = wt - 16;
  for (const sx of [2, 10, 23, 31]) { rect(b, x + sx, fl, 2, base - fl + 1, I('#5c4431')); put(b, x + sx, fl, I('#8a6a48')); }
  for (let i = 0; i < WW; i++) rect(b, x + i, wt, 1, fl - wt, i % 3 === 0 ? I('#a4844c') : i % 3 === 1 ? I('#e2c98c') : I('#c8aa68'));
  rect(b, x, wt + 4, WW, 1, I('#8a6a3a')); rect(b, x, fl - 4, WW, 1, I('#8a6a3a'));
  rect(b, x, wt, 2, fl - wt, I('#f0dca4'));
  rect(b, x + 5, wt + 6, 8, 5, I('#2a1f1a')); rect(b, x + 5, wt + 6, 3, 5, I('#d8573a')); rect(b, x + 10, wt + 6, 3, 5, I('#d8573a')); rect(b, x + 5, wt + 6, 8, 1, I('#a8432c'));
  rect(b, x + 21, wt + 3, 8, fl - wt - 3, I('#2a1f1a')); rect(b, x + 21, wt + 3, 8, 1, I('#4a3626')); rect(b, x + 21, fl - 1, 8, 1, I('#4a3626'));
  rect(b, x - 2, fl, WW + 4, 2, I('#6b4e34')); rect(b, x - 2, fl, WW + 4, 1, I('#a07c54'));
  const cx = x + WW / 2;
  for (let r = 0; r < 17; r++) {
    const y = rt + r, half = 7 + r * 1.42;
    for (let xx = Math.round(cx - half); xx <= Math.round(cx + half); xx++) {
      const band = (r + (hsh(xx * 0.7) > 0.6 ? 1 : 0)) % 4;
      let c = band === 0 ? I('#f4da98') : band === 3 ? I('#a87e3e') : I('#d6b064');
      if (xx < cx - half + 2.5) c = mixI(c, I('#fff2c8'), 0.35);
      else if (xx > cx + half - 2.5) c = mixI(c, I('#7a5a2c'), 0.3);
      put(b, xx, y, c);
    }
  }
  for (let xx = Math.round(cx - 31); xx <= Math.round(cx + 31); xx++) if (hsh(xx * 3.1) > 0.35) put(b, xx, rt + 17, I('#8a6430'));
  rect(b, Math.round(cx - 7), rt - 1, 15, 2, I('#8a6a34')); rect(b, Math.round(cx - 7), rt - 1, 15, 1, I('#b08a4a'));
  for (let y = fl + 2; y <= base; y++) { put(b, x + 22, y, I('#7a5a3a')); put(b, x + 27, y, I('#7a5a3a')); if ((y - fl) % 3 === 0) rect(b, x + 22, y, 6, 1, I('#a07c54')); }
}
function nets(b, x0, x1, top, base) {
  for (const x of [x0, x1]) { rect(b, x, top, 2, base - top, I('#6a5038')); put(b, x, top, I('#a07c54')); }
  for (let x = x0 + 2; x < x1; x++) {
    const u = (x - x0) / (x1 - x0), sag = Math.round(Math.sin(u * Math.PI) * 6);
    put(b, x, top + 2 + sag, I('#d8c8a0'));
    for (let y = top + 3 + sag; y < top + 14 + sag - Math.round(Math.sin(u * Math.PI * 2) * 2); y++) if ((x + y) % 3 === 0 || (x - y) % 3 === 0) put(b, x, y, I('#5a4c3c'));
    if (x % 5 === 0) put(b, x, top + 3 + sag, x % 10 ? I('#ff8a3a') : I('#f4f0e6'));
  }
}
function canoe(b, x, y) {
  rect(b, x + 6, y - 5, 24, 2, I('#d8c49a')); rect(b, x + 6, y - 5, 24, 1, I('#efe0b8'));
  for (const bx of [x + 11, x + 25]) line(b, bx, y - 4, bx + 1, y - 1, I('#8a6a48'));
  poly(b, [[x, y - 3], [x + 36, y - 3], [x + 33, y], [x + 3, y]], I('#a8462c'));
  rect(b, x + 1, y - 3, 35, 1, I('#e0804a')); rect(b, x + 3, y - 1, 30, 1, I('#6a2a1c'));
  put(b, x, y - 4, I('#a8462c')); put(b, x + 36, y - 4, I('#a8462c'));
}
// a jungle crown for the headland: clumps lit from the upper left, hazed by distance
function crown(b, cx, cy, rx, ry, pal, sd) {
  const n = Math.max(3, Math.round(rx * ry / 9));
  const cl = [];
  for (let i = 0; i < n; i++) { const a = hsh(sd * 3.1 + i) * 6.283, d = Math.sqrt(hsh(sd * 5.7 + i)); cl.push([cx + Math.cos(a) * d * rx * 0.75, cy + Math.sin(a) * d * ry * 0.7, 2.5 + hsh(sd * 7.3 + i) * 3.5]); }
  cl.sort((p, q) => p[1] - q[1]);
  for (const [x, y, r] of cl) {
    oval(b, x, y, r + 1, (r + 1) * 0.8, pal[3]);
    oval(b, x, y, r, r * 0.8, pal[2]);
    oval(b, x - 0.5, y - 1, Math.max(0.5, r - 1.3), Math.max(0.5, (r - 1.3) * 0.75), pal[1]);
    oval(b, x - r * 0.3, y - r * 0.45, Math.max(0.5, r * 0.4), Math.max(0.5, r * 0.26), pal[0]);
  }
}
const SWL = 168;                       // where the lagoon laps the spit
const HL = 640;                        // the spit rises into a jungle headland from here (design x)
const spitBase = x => 157 + 1.6 * Math.sin(x / 41 + 1) + (fbm(x / 8, 21, 2) - 0.5) * 2.4;
const spitTop = x => spitBase(x) - 62 * ss(HL, HL + 230, x) - 7 * ss(HL + 60, HL + 260, x) * fbm(x / 23, 25, 2);
// [x, height, lean, seed, size]; base y follows the spit
const PALMS = [[16, 98, 9, 1, 1.15], [47, 72, -7, 2, 0.95], [131, 86, 13, 3, 1.05], [152, 60, 16, 4, 0.85], [302, 44, -6, 5, 0.8],
  [404, 74, -9, 12, 0.95], [478, 84, -13, 7, 1.0], [552, 92, -4, 10, 1.1], [612, 56, 12, 11, 0.8],
  [700, 64, 6, 14, 0.85], [790, 52, 9, 16, 0.8], [905, 48, 5, 18, 0.75]];
// a bamboo lookout on stilts with a thatched cap and a little flag (the fishermen watch for sharks)
function lookout(b, x, base) {
  const top = base - 30;
  for (const sx of [0, 9]) { rect(b, x + sx, top, 2, base - top, I('#8a6a3a')); put(b, x + sx, top, I('#c8a868')); for (let y = top + 4; y < base; y += 5) put(b, x + sx, y, I('#5c4431')); }
  line(b, x + 1, top + 4, x + 10, base - 2, I('#6a5038')); line(b, x + 10, top + 4, x + 1, base - 2, I('#6a5038'));
  rect(b, x - 3, top - 1, 17, 2, I('#a07c54')); rect(b, x - 3, top - 1, 17, 1, I('#d8b880'));
  rect(b, x - 2, top - 6, 1, 5, I('#8a6a3a')); rect(b, x + 12, top - 6, 1, 5, I('#8a6a3a')); rect(b, x - 2, top - 4, 15, 1, I('#c8a868'));
  for (let r = 0; r < 7; r++) for (let xx = x + 5 - 3 - r; xx <= x + 6 + 3 + r; xx++) put(b, xx, top - 13 + r, (r + (hsh(xx * 0.7) > 0.6 ? 1 : 0)) % 3 === 0 ? I('#f4da98') : r === 6 ? I('#8a6430') : I('#d6b064'));
  rect(b, x + 5, top - 20, 1, 7, I('#5c4431'));
  for (let k = 0; k < 4; k++) rect(b, x + 6, top - 20 + k, 4 - k, 1, k % 2 ? I('#f4f0e6') : I('#e0392c'));
}
function paintSpit(b, X1) {
  const X0 = -10;
  // the headland behind: jungle crowns climbing the slope, hazed (it is the island's jungle, next)
  const FJ = PI('#b4d8a4', '#94c48a', '#78ac7a', '#5e9068');
  for (let x = HL - 20; x < X1 + 12; x += 7) {
    const t = spitTop(x), k = ss(HL - 10, HL + 120, x);
    if (k <= 0) continue;
    const r = 6 + hsh(x * 0.37) * 7;
    crown(b, x + (hsh(x) - 0.5) * 4, t - r * 0.3 - 2 + 8 * (1 - k), r * 1.4, r, FJ, x);
  }
  for (const [x, h, w] of [[720, 30, 22], [812, 38, 26], [884, 26, 20]]) {   // emergent trees on the headland
    if (x > X1 + 20) continue;
    const t = spitTop(x);
    rect(b, x, t - h, 2, h, I('#6e8c74'));
    for (let k = -2; k <= 2; k++) oval(b, x + k * w * 0.22, t - h + Math.abs(k) * 1.5, w * 0.3, 3.4, FJ[2]);
    for (let k = -2; k <= 2; k++) oval(b, x + k * w * 0.22 - 1, t - h - 1 + Math.abs(k) * 1.5, w * 0.22, 1.7, FJ[1]);
  }
  hazeB(b, I('#e6ecd8'), (x, y) => 0.25 * ss(HL, HL + 200, x));
  // surf on the bay side of the spit, peeking over the crest
  for (let x = X0; x < Math.min(X1, HL + 40); x++) { const y = Math.round(spitTop(x)) - 1; if (hsh(x * 1.3) > 0.25) put(b, x, y, I('#f6fbf8')); if (hsh(x * 2.1) > 0.6) put(b, x, y - 1, I('#d6f0ee')); }
  // back scrub along the crest
  for (let x = X0; x < X1; x += 5) { const r = 2.5 + hsh(x * 0.37) * 4 * (0.4 + fbm(x / 40, 33, 2)); if (fbm(x / 30, 31, 2) > 0.4) scrub(b, x, spitTop(x) - r * 0.4, r, x); }
  // palms, the far (short) ones first
  const palms = PALMS.filter(p => p[0] < X1 + 30).sort((a, c) => a[1] - c[1]);
  for (const [x0, hgt, lean, sd, s] of palms) palm(b, x0, Math.round(spitTop(x0)) + 1, hgt, lean, sd, s);
  // the fishing hut and its nets; a second little hut on stilts further along
  nets(b, 56, 72, 137, 160);
  hut(b, 80, 162);
  lookout(b, 366, Math.round(spitTop(372)) + 6);
  // front scrub at the palm feet
  for (const [x0] of palms) { const t = spitTop(x0); scrub(b, x0 - 4, t, 4, x0 * 3); scrub(b, x0 + 4, t + 1, 3, x0 * 5); }
  for (let x = X0; x < X1; x += 9) if (fbm(x / 22, 35, 2) > 0.52) scrub(b, x, spitTop(x) + 1, 2.5 + hsh(x) * 2, x * 7);
  // the black-sand beach face down to the lagoon (dark lava rock under the headland)
  for (let x = X0; x < X1; x++) {
    const top = Math.round(spitTop(x)) + 1, rocky = ss(HL + 20, HL + 120, x);
    for (let y = top; y < SWL; y++) {
      const k = (y - top) / Math.max(1, SWL - top);
      let c;
      if (rocky > hsh(x * 0.31 + y * 0.07) && y > spitBase(x) - 2) {
        const n = vn2(x / 3, y / 2.2, 7);
        c = n > 0.62 ? I('#4a4450') : n > 0.38 ? I('#38333d') : I('#29252e');
        if (y >= SWL - 2) c = I('#1f1c24');
      } else if (y < spitBase(x) - 2) {
        const n = vn2(x / 2.4, y / 2.1, 29);
        c = n > 0.62 ? FJ[1] : n > 0.4 ? FJ[2] : FJ[3];
        c = mixI(c, I('#e6ecd8'), 0.2);
      } else {
        c = k < 0.22 ? I('#5c5254') : k < 0.6 ? I('#413a3d') : I('#302b31');
        if (y >= SWL - 3) c = I('#231f27');
        if (y < SWL - 3 && k > 0.2 && (y + Math.round(Math.sin(x / 9 + y) * 1.3)) % 3 === 0) c = mixI(c, I('#1c191d'), 0.3);
        const n = h2(x, y, 5);
        if (n > 0.982) c = I('#e2dad0'); else if (n > 0.955) c = mixI(c, I('#8a807a'), 0.45);
        if (y >= SWL - 3 && h2(x >> 2, y, 6) > 0.55) c = mixI(c, I('#8a92ac'), 0.4);
      }
      put(b, x, y, c);
    }
  }
  for (let i = 0; i < 120; i++) {
    const x = Math.round(X0 + hsh(i * 4.7 + 2) * (HL - X0)), y = Math.round(spitTop(x) + 3 + hsh(i * 2.3) * 6);
    if (hsh(i * 9.9) > 0.75) { put(b, x, y, I('#f4ece0')); continue; }
    rect(b, x, y, 2, 1, I('#6e6870')); put(b, x, y, I('#9a94a0')); put(b, x + 1, y + 1, I('#1c191d'));
  }
  rect(b, 250, 163, 16, 2, I('#b8a890')); rect(b, 250, 163, 16, 1, I('#e0d4bc')); put(b, 249, 164, I('#8a7a62')); put(b, 262, 162, I('#b8a890')); put(b, 263, 161, I('#b8a890'));
  for (let y = 159; y < SWL - 1; y++) { const x = 232 + Math.round((y - 159) * 0.6); if (y % 2) { put(b, x - 2, y, I('#1e1b20')); put(b, x + 2, y, I('#1e1b20')); } }
  canoe(b, 136, 166);
  canoe(b, 512, 166);
  for (const [rx, r] of [[204, 4], [213, 3], [262, 2.5], [362, 5], [373, 3], [430, 3.5], [580, 4], [592, 2.5], [646, 5], [660, 3.5]]) {
    const ry = Math.round(Math.min(SWL - 3, spitBase(rx) + 8));
    disc(b, rx, ry, r, I('#2a2630')); disc(b, rx - 0.7, ry - 0.8, r - 1, I('#3e3944')); put(b, rx - Math.round(r * 0.5), ry - Math.round(r * 0.6), I('#6e6878'));
  }
  // foam where the lagoon laps the shore
  for (let x = X0; x < X1; x++) {
    put(b, x, SWL, hsh(x * 0.9) > 0.15 ? I('#f4fbf6') : I('#c8eee6'));
    if (Math.sin(x / 13) + hsh(x * 1.7) * 0.8 > 0.6) put(b, x, SWL - 1, I('#e2f6f0'));
    if (Math.sin(x / 9 + 2) > 0.3 && hsh(x * 3.3) > 0.3) put(b, x, SWL + 1, I('#d2f4ec'));
  }
  // reflections of the palms and the huts in the lagoon (painted over the lagoon's colours)
  for (const [x0, hgt, lean, sd] of palms) {
    const n = Math.round(hgt * 0.3), top = Math.round(spitTop(x0));
    if (top < SWL - 14) continue;
    for (let k = 0; k < n; k++) {
      if (k % 3 === 2) continue;
      const y = SWL + 2 + k, x = Math.round(x0 + lean * (k / hgt) * 1.4 + Math.sin(k * 0.9 + sd) * 1.2);
      for (let i = -1; i <= 1; i++) put(b, x + i, y, mixI(stepCol(LAGB, y), I('#1d6268'), 0.26));
    }
  }
}

// ------------------------------------------------------------ live bits of the bay
function glitter(g, x0, y0, y1, n, sp0, sp1, sd) {
  for (let i = 0; i < n; i++) {
    const cyc = 9 + (i % 7), ph = Math.floor((G.t + i * 5) / cyc), life = (G.t + i * 5) % cyc;
    if (life > cyc - 3) continue;
    const k = Math.pow(hsh(i * 13.1 + ph * 0.37 + sd), 1.4), y = Math.round(y0 + k * (y1 - y0)), sp = lerp(sp0, sp1, k);
    const x = Math.round(x0 + (hsh(i * 7.7 + ph * 1.3 + sd) - 0.5) * 2 * sp);
    g.fillStyle = life < 2 ? '#ffffff' : '#fff2c4';
    g.fillRect(x, y, k > 0.5 ? 2 : 1, 1);
    if (life === 1 && i % 4 === 0) { g.fillRect(x - 1, y, 4, 1); g.fillRect(x, y - 1, 1, 3); }
  }
}
function motorboat(g, x, y, dir) {
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x - dir * 12 - 3, y + 1, 7, 1); g.fillRect(x - dir * 17 - 1, y + 1, 3, 1);
  g.fillStyle = '#f4f0e6'; g.fillRect(x - 6, y - 2, 12, 2);
  g.fillStyle = '#2f5f9f'; g.fillRect(x - 5, y, 10, 1);
  g.fillStyle = '#26324a'; g.fillRect(x - 4, y + 1, 8, 1);
  g.fillStyle = '#f8f6f0'; g.fillRect(x - 2, y - 5, 5, 3);
  g.fillStyle = '#4a5a72'; g.fillRect(x - 1, y - 4, 3, 1);
  g.fillStyle = '#6a5a4a'; g.fillRect(x + 3 * dir, y - 9, 1, 7);
  g.fillStyle = '#e0392c'; g.fillRect(dir > 0 ? x + 3 : x - 5, y - 9, 3, 1);
}
function sailboat(g, x, y) {
  g.fillStyle = '#ffffff';
  for (let r = 0; r < 7; r++) g.fillRect(x, y - 8 + r, 1 + Math.floor(r * 0.6), 1);
  g.fillStyle = '#ffe8d0'; for (let r = 0; r < 5; r++) g.fillRect(x - 1 - Math.floor(r * 0.5), y - 6 + r, 1 + Math.floor(r * 0.5), 1);
  g.fillStyle = '#4a4458'; g.fillRect(x - 3, y, 8, 1);
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 3, y + 1, 8, 1);
}
function gull(g, x, y, i) {
  const t = G.t + i * 377, fl = (t % 300) < 80 ? Math.floor(t / 6) % 4 : 1, s = i % 2;
  g.fillStyle = '#ffffff'; g.fillRect(x - 1, y, 3, 1);
  if (fl === 0) { g.fillRect(x - 2 - s, y - 1, 1 + s, 1); g.fillRect(x + 2, y - 1, 1 + s, 1); g.fillRect(x - 3 - s, y - 2, 1, 1); g.fillRect(x + 3 + s, y - 2, 1, 1); }
  else if (fl === 2) { g.fillRect(x - 2 - s, y + 1, 1 + s, 1); g.fillRect(x + 2, y + 1, 1 + s, 1); }
  else { g.fillRect(x - 3 - s, y - 1, 2 + s, 1); g.fillRect(x + 2, y - 1, 2 + s, 1); }
  g.fillStyle = '#ffb030'; g.fillRect(x + 2, y, 1, 1);
}
function clouds(g, cx, list, set, a) {
  if (a <= 0.01) return;
  const span = W + 300;
  if (a < 1) g.globalAlpha = a;
  list.forEach(([w, x, y, p, v], i) => g.drawImage(set[i], Math.round(wrap(x - cx * p - G.t * v + 150, span) - 150), y));
  g.globalAlpha = 1;
}
// the small volcano: sprite + crater glow + plume + live puffs + mast light + two drones (the robots are up there)
function drawVolcanoFar(g, cx, kind, al) {
  const A = ART, vx = volcX(cx), dx = vx - VX;
  if (al === undefined) al = 1;
  if (al <= 0.004) return;
  g.globalAlpha = al;
  blitS(g, kind === 'jungle' ? A.volJ : A.volB, dx, 0);
  const gx = vx + 3, gy = VTOP + 1, k = 0.8 + 0.2 * Math.sin(G.t * 0.05);
  g.fillStyle = 'rgba(255,150,80,' + (0.16 * k).toFixed(3) + ')'; pdisc(g, gx, gy, 9);
  g.fillStyle = 'rgba(255,170,100,' + (0.2 * k).toFixed(3) + ')'; pdisc(g, gx, gy + 1, 4);
  // fresh puffs leaving the crater and joining the painted plume
  for (let i = 0; i < 6; i++) {
    const u = ((G.t * 0.004 + i / 6) % 1), r = 1.5 + u * 4.5, px = gx + u * 26 + Math.sin(u * 5 + i) * 1.5, py = gy - 3 - u * 15;
    g.fillStyle = rgba(kind === 'jungle' ? '#eef2ec' : '#efe6e4', 0.55 * Math.sin(Math.PI * u)); pdisc(g, px, py, r);
  }
  g.globalAlpha = 0.93 * al; blitS(g, kind === 'jungle' ? A.plumeJ : A.plumeB, gx, VTOP - 1); g.globalAlpha = al;
  if (G.t % 50 < 25) { g.fillStyle = '#ff5a4a'; g.fillRect(vx - 6, Math.ceil(vprof(VX - 6)) - 6, 1, 1); }
  for (let i = 0; i < 2; i++) {
    const a = G.t * 0.012 + (i ? 1.5 : -1.5), x = Math.round(vx + Math.cos(a) * (34 + i * 16)), y = Math.round(VTOP + 18 + i * 9 + Math.sin(a) * 5);
    g.fillStyle = '#5a5c70'; g.fillRect(x - 2, y, 5, 2); g.fillRect(x - 1, y - 1, 3, 1);
    g.fillStyle = '#8a8ca0'; g.fillRect(x - 3 + ((G.t >> 1) & 1), y - 2, 2, 1); g.fillRect(x + 2 - ((G.t >> 1) & 1), y - 2, 2, 1);
    if ((G.t + i * 13) % 30 < 15) { g.fillStyle = '#ff4a3a'; g.fillRect(x, y + 2, 1, 1); }
  }
  g.globalAlpha = 1;
}
function drawSun(g, cx, a) {
  if (a <= 0.01) return;
  const A = ART, sx = sunX(cx), k = 0.5 + 0.5 * Math.sin(G.t * 0.013);
  g.globalAlpha = a * (0.55 + 0.45 * k); g.drawImage(A.rays[0], sx - 100, 64 - 80);
  g.globalAlpha = a * (1 - 0.45 * k); g.drawImage(A.rays[1], sx - 100, 64 - 80);
  g.globalAlpha = a; g.drawImage(A.sun, sx - 84, 64 - 84);
  g.globalAlpha = 1;
}
// the bay's sky (sun, clouds, gulls: the "decorations" that fade out with the scene's sky)
function bayDeco(g, cx, a) {
  drawSun(g, cx, a);
  clouds(g, cx, CL_BAY, ART.cloudsB, a);
}
// the bay's layers, back to front (g = the screen or the mist buffer; hz(g, depth) hazes what is drawn so far)
function bayLayers(g, cx, hz) {
  const L = LAY.bay;
  blit(g, L.stacks, cx); if (hz) hz(g, 0);
  blit(g, L.sea, cx);
  const so = offOf(L.sea, cx), vx = volcX(cx);
  g.drawImage(ART.volB.img, 0, HZ + ART.volB.oy, ART.volB.w, 12, vx - VX - ART.volB.ox, HZ, ART.volB.w, 12);   // its reflection
  glitter(g, sunX(cx), HZ + 1, 152, 40, 3, 26, 1);
  // sailboats and a motorboat crossing the bay (on the sea strip)
  for (let i = 0; i < 4; i++) {
    const bx = Math.round(wrap(i * 191 + G.t * (0.02 + i * 0.006) * (i % 2 ? 1 : -1), 760) - 60 - so), by = HZ + 4 + i * 3;
    if (bx > -12 && bx < W + 12) sailboat(g, bx, by);
  }
  const mb = Math.round(wrap(G.t * 0.06 + 300, 900) - 120 - so);
  if (mb > -30 && mb < W + 30) motorboat(g, mb, HZ + 12, 1);
  for (let i = 0; i < 3; i++) gull(g, Math.round(wrap(i * 157 + G.t * (0.2 + i * 0.05) - cx * 0.08, W + 120) - 60), Math.round(76 + i * 13 + Math.sin((G.t + i * 377) * 0.017) * 5), i);
  if (hz) hz(g, 1);
  blit(g, L.lagoon, cx);
  const lo = offOf(L.lagoon, cx);
  glitter(g, sunX(cx) + 20, 169, 232, 44, 8, 48, 2);
  for (let i = 0; i < 14; i++) {
    const u = (G.t * 0.004 + hsh(i * 2.7)) % 1, y = Math.round(172 + hsh(i * 9.3) * 60), len = 4 + Math.round((y - 166) / 7);
    const x = Math.round(wrap(hsh(i * 4.1) * 900 - lo + u * 40, W + 60) - 30), a = Math.sin(u * Math.PI);
    g.fillStyle = 'rgba(236,255,250,' + (0.5 * a).toFixed(2) + ')'; g.fillRect(x, y, len, 1);
  }
  if (hz) hz(g, 2);
  blit(g, L.spit, cx);
  // the surf rolling in on the spit (a line of foam sliding along)
  const po = offOf(L.spit, cx);
  for (let i = 0; i < 10; i++) {
    const u = (G.t * 0.006 + i * 0.1) % 1, x = Math.round(wrap(i * 97 + u * 30 - po, W + 40) - 20);
    g.fillStyle = 'rgba(255,255,255,' + (0.7 * Math.sin(Math.PI * u)).toFixed(2) + ')'; g.fillRect(x, SWL, 6 + (i % 3) * 2, 1);
  }
  if (hz) hz(g, 3);
}

// ============================================================
// HONEY JUNGLE (late morning). The same volcano far away; misty canopy layers; basalt cliffs with waterfalls; the
// understory; a canopy ceiling (its own strip, shared with the bay and lava transitions) with gaps, light shafts
// falling through them, backlit fronds, vines and heliconias.
// ============================================================
const SKY_JUNGLE = [[-10, '#6fb6cf'], [36, '#8bc6d8'], [84, '#b2dadd'], [126, '#d3eadb'], [170, '#e6f1d8'], [280, '#ecf2d9']];
const MIST = I('#e4efe2');
const FJ = PI('#b2d1bd', '#9cc1ac', '#89b29f', '#79a491');
const CLF = PI('#8a948b', '#727e76', '#5f6a63', '#4c5650');
const MP = PI('#a8d084', '#86b46a', '#699658', '#527a48');
const TP = PI('#aacbb0', '#90b69a', '#7aa286', '#699077');
const MJ = PI('#8ccb78', '#64a862', '#4b8a54', '#3a6e46');
const MB = PI('#71907a', '#57745f', '#44604e', '#344c3e');
const NC = PI('#5c9a42', '#3f7838', '#2b5a31', '#1c4025');
const LIT = PI('#d2f08a', '#a6d860', '#76b448');
const JLEAF = PI('#92d45e', '#5ea445', '#3f7e36', '#295c29');
const HELI = PI('#ff7a5a', '#e8352a', '#b01e1e', '#7a1414');
const GOLD = PI('#fff3a0', '#ffd23f', '#e09a14', '#a86a0a');
// a mass of leaves: clumps sorted top to bottom, each a deep rim, dark, mid and a lit top; leaf-stroke texture
function foliage(b, cx, cy, rx, ry, pal, s, rmin, rmax) {
  rmin = rmin || 2.5; rmax = rmax || 5.5;
  const n = Math.max(3, Math.round(rx * ry / (rmin * rmax) * 1.4)), cl = [];
  for (let i = 0; i < n; i++) {
    const a = nz(i, s) * Math.PI * 2, d = Math.sqrt(nz(i, s + 1)), r = rmin + nz(i, s + 2) * (rmax - rmin);
    cl.push([cx + Math.cos(a) * d * Math.max(0, rx - r), cy + Math.sin(a) * d * Math.max(0, ry - r), r]);
  }
  cl.sort((p, q) => p[1] - q[1]);
  for (const [x, y, r] of cl) {
    oval(b, x, y, r + 1, (r + 1) * 0.8, pal[3]);
    oval(b, x, y, r, r * 0.8, pal[2]);
    oval(b, x - 0.5, y - 1, Math.max(0.5, r - 1.3), Math.max(0.5, (r - 1.3) * 0.75), pal[1]);
    oval(b, x - r * 0.25, y - r * 0.45, Math.max(0.5, r * 0.4), Math.max(0.5, r * 0.26), pal[0]);
  }
  const x0 = Math.floor(cx - rx - 2), x1 = Math.ceil(cx + rx + 2), y0 = Math.floor(cy - ry - 2), y1 = Math.ceil(cy + ry + 2);
  for (let i = 0, n2 = (x1 - x0) * (y1 - y0) / 4; i < n2; i++) {
    const x = x0 + Math.floor(nz(i, s + 5) * (x1 - x0)), y = y0 + Math.floor(nz(i, s + 6) * (y1 - y0)), k = pal.indexOf(get(b, x, y));
    if (k < 0) continue;
    const up = nz(i, s + 7) < (k >= 2 ? 0.35 : 0.6), nc = pal[clamp(k + (up ? -1 : 1), 0, 3)], dx = nz(i, s + 8) < 0.5 ? 1 : -1;
    for (let j = 0; j < 2 + (nz(i, s + 9) * 2 | 0); j++) if (pal.indexOf(get(b, x + dx * j, y + j)) >= 0) put(b, x + dx * j, y + j, nc);
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = get(b, x, y);
    if (pal.indexOf(c) < 0) continue;
    const q = nz(x * 3 + s, y);
    if (q > 0.84 && get(b, x, y + 1) === NONE) { put(b, x, y + 1, pal[2]); if (q > 0.92) put(b, x + (x & 1 ? 1 : -1), y + 2, pal[3]); }
    else if (q < 0.08 && get(b, x - 1, y) === NONE) put(b, x - 1, y, c);
    else if (q > 0.8 && get(b, x + 1, y) === NONE) put(b, x + 1, y, c);
  }
}
// a palm frond: a drooping rachis with leaflets hanging from both sides
function jfrond(b, x0, y0, a, len, droop, pal) {
  for (let i = 0; i <= len; i++) {
    const t = i / len, x = x0 + Math.cos(a) * i, y = y0 + Math.sin(a) * i + droop * t * t * len;
    const dx = Math.cos(a), dy = Math.sin(a) + 2 * droop * t, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
    if (i > 1 && i % 2 === 0) {
      const ll = (1 - t * 0.55) * len * 0.2 + 2;
      for (const sd of [-1, 1]) {
        const lx = ux * 0.55 - uy * sd * 0.85, ly = uy * 0.55 + ux * sd * 0.85;
        for (let k = 1; k <= ll; k++) put(b, x + lx * k, y + ly * k + k * k * 0.035, k < ll * 0.35 ? pal[2] : k < ll * 0.8 ? pal[1] : pal[0]);
      }
    }
    put(b, x, y, pal[3]); put(b, x, y - 1, pal[2]);
  }
}
function trunkCol(b, x, w, y0, y1, pal, s, flareH) {
  if (flareH === undefined) flareH = 26;
  for (let y = y0; y < y1; y++) {
    const fl = flareH > 0 ? ss(y1 - flareH, y1, y) : 0, ww = Math.round(w + fl * w * 1.2), xl = Math.round(x - ww / 2 + Math.sin(y / 19 + s) * 0.8);
    for (let i = 0; i < ww; i++) {
      const t = (i + 0.5) / ww;
      let c = t < 0.22 ? pal[0] : t > 0.7 ? pal[2] : pal[1];
      if (ww > 4 && (i + Math.floor(y / 9 + nz(i, s) * 3)) % 4 === 0 && nz(xl + i, y >> 2) > 0.45 && t > 0.15) c = pal[3];
      put(b, xl + i, y, c);
    }
  }
}
// a banana-like paddle leaf with torn slits
function paddle(b, x0, y0, a, len, wid, droop, pal, s) {
  const n = Math.ceil(len * 1.6);
  for (let i = 0; i <= n; i++) {
    const t = i / n, cx = x0 + Math.cos(a) * len * t, cy = y0 + Math.sin(a) * len * t + droop * t * t * len;
    const dx = Math.cos(a), dy = Math.sin(a) + 2 * droop * t, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
    const hw = wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.6), slit = nz(Math.floor(t * len / 2.2), s) > 0.72;
    for (let o = -hw; o <= hw; o += 0.5) {
      if (slit && Math.abs(o) > 1.2 && Math.floor(t * len * 1.6) % 3 === 0) continue;
      const up = (o * ny) < 0;
      const c = Math.abs(o) < 0.6 ? pal[0] : up ? (Math.abs(o) > hw - 1 ? pal[0] : pal[1]) : (Math.abs(o) > hw - 1 ? pal[3] : pal[2]);
      put(b, cx + nx * o, cy + ny * o, c);
    }
  }
}
function fern(b, x, base, s, pal) {
  for (let k = -3; k <= 3; k++) {
    const a = -Math.PI / 2 + k * 0.42, len = s * (1 - Math.abs(k) * 0.1);
    for (let t = 1; t <= len; t++) {
      const bend = (t / len) * (t / len) * s * 0.35;
      const px = x + Math.cos(a) * t + Math.sign(k) * bend, py = base + Math.sin(a) * t + bend * 0.9;
      put(b, px, py, pal[1]);
      if (t > 1 && t < len - 1 && t % 2 === 0) { put(b, px - 1, py + 1, pal[(t + k) % 3 ? 2 : 0]); put(b, px + 1, py + 1, pal[2]); }
    }
  }
}
// a small far palm silhouette (pal: light, mid, dark, deep)
function jpalm(b, x, base, h, lean, pal, s) {
  for (let i = 0; i <= h; i++) {
    const t = i / h, px = x + lean * t * t, py = base - i;
    put(b, px, py, pal[2]); put(b, px + 1, py, i % 3 ? pal[1] : pal[3]);
  }
  const cx = x + lean, cy = base - h, n = 8;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI * (0.02 + 0.96 * k / (n - 1)) + (nz(k, s) - 0.5) * 0.25, L = h * (0.36 + 0.14 * nz(k, s + 1));
    for (let i = 1; i <= L; i++) {
      const t = i / L, fx = cx + Math.cos(a) * i * (1 - t * 0.15), fy = cy + Math.sin(a) * i * 0.8 + t * t * L * 0.75;
      put(b, fx, fy, t < 0.5 ? pal[1] : pal[2]);
      if (t < 0.4) put(b, fx, fy - 1, pal[0]);
      if (i > 2 && i % 2 === 0) put(b, fx, fy + 1 + (t > 0.5 ? 1 : 0), pal[2]);
    }
  }
  oval(b, cx + 0.5, cy + 1.5, 1.2, 1, pal[3]);
}
// a heliconia pendant: zig-zag stem with red bracts tipped gold
function heliconia(b, x, y0, n) {
  for (let y = y0; y < y0 + n * 6 + 2; y++) put(b, x + (Math.floor((y - y0) / 6) % 2 ? 1 : 0), y, JLEAF[3]);
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? 1 : -1, by = y0 + 3 + k * 6, sz = 1 - k / (n + 2);
    const L = Math.round(8 * sz + 2), Ht = Math.max(2, Math.round(4 * sz + 1));
    for (let i = 0; i < L; i++) {
      const t = i / L, top = by - Math.round(t * 3 * sz) - 1, bot = by + Math.round(Ht * (1 - t * 0.7));
      for (let y = top; y <= bot; y++) {
        let c = y === top ? GOLD[1] : y === top + 1 ? HELI[0] : y >= bot - 1 ? HELI[2] : HELI[1];
        if (i >= L - 2) c = y === top ? GOLD[0] : JLEAF[1];
        put(b, x + side * (i + 1), y, c);
      }
    }
  }
}

// the far misty canopy (p 0.08): a band of crowns, emergent trees with umbrella crowns, far palms
const farTop = x => 127 + 8 * jfbm(x / 26, 0.5, 21) + 3 * Math.sin(x / 31 + 1);
function paintFarJ(b, X1) {
  for (let x = -16; x < X1 + 8; x += 4) { const r = 3 + nz(x + 4096, 3) * 8, y = farTop(x) + r * 0.6; oval(b, x, y, r + 1, r * 0.85, FJ[2]); }
  for (let x = -10; x < X1; x++) rect(b, x, Math.round(farTop(x)) + 5, 1, H, FJ[2]);
  for (let x = -16; x < X1 + 8; x += 4) { const r = 3 + nz(x + 4096, 3) * 8, y = farTop(x) + r * 0.6; if (r > 4) oval(b, x - 1, y - 2, r - 2.5, r * 0.85 - 3, FJ[1]); }
  for (let x = 30, i = 0; x < X1 + 20; x += 120 + Math.round(nz(i, 77) * 110), i++) {
    const h = 22 + nz(i, 78) * 16, w = 15 + nz(i, 79) * 10, top = farTop(x) - h;
    rect(b, x, top + 3, 2, h, FJ[3]);
    for (let k = -2; k <= 2; k++) oval(b, x + k * w * 0.22, top + Math.abs(k) * 1.5, w * 0.3, 3.2, FJ[2]);
    for (let k = -2; k <= 2; k++) oval(b, x + k * w * 0.22 - 1, top - 1 + Math.abs(k) * 1.5, w * 0.22, 1.6, FJ[1]);
  }
  for (let x = 72, i = 0; x < X1 + 10; x += 34 + Math.round(nz(i, 80) * 70), i++) jpalm(b, x, farTop(x) + 4, 18 + nz(i, 81) * 12, (nz(i, 82) - 0.5) * 12, [FJ[0], FJ[2], FJ[3], FJ[3]], x);
  hazeB(b, MIST, (x, y) => 0.1 + ss(118, 200, y) * 0.5);
}

// basalt cliffs with ribbon waterfalls (p 0.2), misty trees between them. Cliff: centre x, width, top, falls width
const CLIFFS = [{ x: 150, w: 86, top: 99, wf: 13 }, { x: 440, w: 104, top: 88, wf: 15 }, { x: 716, w: 78, top: 106, wf: 11 }];
const wfOf = c => ({ x0: Math.round(c.x - c.wf / 2), x1: Math.round(c.x + c.wf / 2) });
function cliffTop(x, c) {
  const f = wfOf(c), d = x - c.x;
  return c.top + 4 * jfbm(x / 8, 2.2, 31) + (x >= f.x0 && x <= f.x1 ? 4 : 0) + ss(c.w * 0.2, c.w * 0.43, d) * 12 + (1 - ss(-c.w * 0.43, -c.w * 0.22, d)) * 14;
}
function paintCliffJ(b, X1) {
  // misty trees between and beside the cliffs
  for (let x = -6, i = 0; x < X1 + 10; x += 34 + Math.round(nz(i, 61) * 40), i++) {
    if (CLIFFS.some(c => Math.abs(x - c.x) < c.w / 2 - 6)) continue;
    const top = 84 + nz(i, 62) * 30, w = 4 + Math.round(nz(i, 63) * 2);
    trunkCol(b, x, w, top, H, TP, x);
    foliage(b, x, top, 13 + nz(i, 64) * 11, 9 + nz(i, 65) * 6, TP, x * 7 + i, 2.5, 5);
  }
  for (const c of CLIFFS) {
    const f = wfOf(c), x0 = Math.round(c.x - c.w / 2), x1 = Math.round(c.x + c.w / 2);
    for (let x = x0; x < x1; x++) {
      const t = Math.round(cliffTop(x, c));
      for (let y = t; y < H; y++) {
        const sh = Math.round(2 * Math.sin(y / 17 + x * 0.02)), col = Math.floor((x + sh) / 6), fx = ((x + sh) % 6 + 6) % 6;
        let cc = fx === 0 ? CLF[3] : fx === 1 ? CLF[0] : fx < 4 ? CLF[1] : CLF[2];
        if ((y + col * 7) % 23 === 0) cc = CLF[3];
        const m = jfbm(x / 6, y / 9, 44);
        if (m > 0.52 && y > t + 2) cc = m > 0.62 ? MP[1] : m > 0.56 ? MP[2] : MP[3];
        if (x > f.x0 - 4 && x < f.x1 + 4) cc = mixI(cc, I('#34443f'), 0.5);
        put(b, x, y, cc);
      }
      if (!(x >= f.x0 - 1 && x <= f.x1 + 1)) {
        if (x % 3 === 0) foliage(b, x, t - 1, 3.5, 2.6, MP, x * 3, 1.5, 3);
        if (x % 4 === 1 && nz(x, 62) > 0.45) { const n = 4 + nz(x, 63) * 20; for (let k = 0; k < n; k++) put(b, x + Math.round(Math.sin(k * 0.4 + x)), t + k, k % 4 === 3 ? MP[1] : MP[3]); }
      }
    }
    for (const [dx, dy, s] of [[-33, 33, 6], [29, 21, 7], [-21, 69, 5], [21, 61, 6], [13, 5, 5]]) fern(b, c.x + dx * c.w / 86, c.top + dy, s, MP);
  }
  hazeB(b, MIST, (x, y) => 0.26 + ss(130, 215, y) * 0.4);
}
// the understory (p 0.35): trunks with lianas, leaf masses, flowering trees, banana plants, tree ferns, undergrowth
function paintMidJ(b, X1) {
  const trunks = [];
  for (let x = 24, i = 0; x < X1 + 30; x += 92 + Math.round(nz(i, 91) * 86), i++) trunks.push([x, 7 + Math.round(nz(i, 92) * 4), i]);
  for (const [x, w] of trunks) {
    trunkCol(b, x, w, 0, 222, MB, x, 34);
    for (let k = 0; k < 3; k++) {
      const lx = x + (k - 1) * (w + 4), len = 80 + nz(x, k) * 90;
      for (let y = 0; y < len; y++) put(b, lx + Math.round(Math.sin(y / 13 + k + x) * 2), y, k % 2 ? MJ[3] : MB[3]);
    }
  }
  const BLOOM = [['#ffb060', '#f2742a'], ['#ffb8d8', '#e8609a']];
  for (const [x, , i] of trunks) {
    const fy = 84 + nz(i, 93) * 24, rx = 22 + nz(i, 94) * 14, ry = 13 + nz(i, 95) * 6;
    foliage(b, x + (nz(i, 96) - 0.5) * 20, fy, rx, ry, MJ, x * 11 + 7, 3, 6.5);
    if (nz(i, 97) > 0.45) foliage(b, x + 30 + nz(i, 98) * 20, fy + 30 + nz(i, 99) * 16, 12 + nz(i, 100) * 10, 8 + nz(i, 101) * 4, MJ, x * 13 + 5, 3, 6);
    if (nz(i, 102) > 0.55) {   // a flame tree or a pink-flowering tree: blossom on the lit tops
      const [c0, c1] = BLOOM[nz(i, 103) > 0.5 ? 1 : 0];
      for (let j = 0; j < 46; j++) {
        const px = x + (nz(j, i * 31) - 0.5) * 2 * rx, py = fy + (nz(j, i * 31 + 1) - 0.65) * 2 * ry, q = MJ.indexOf(get(b, px, py));
        if (q < 0 || q > 1) continue;
        put(b, px, py, I(c1)); put(b, px + 1, py, I(c1)); put(b, px, py - 1, I(c0)); if (nz(j, i) > 0.5) put(b, px + 1, py - 1, I(c0));
      }
    }
  }
  for (let x = 60, i = 0; x < X1 + 20; x += 70 + Math.round(nz(i, 111) * 70), i++) {   // banana plants
    const base = 212 + Math.round(nz(i, 112) * 4), s = 18 + nz(i, 113) * 6;
    rect(b, x - 1, base - s, 3, s, MJ[3]);
    paddle(b, x, base - s, -2.5, s * 1.15, 3.6, 0.25, MJ, x);
    paddle(b, x, base - s, -1.9, s * 1.3, 4, 0.18, MJ, x + 1);
    paddle(b, x, base - s, -0.95, s * 1.25, 3.8, 0.2, MJ, x + 2);
    paddle(b, x, base - s, -0.3, s * 1.05, 3.4, 0.32, MJ, x + 3);
  }
  for (let x = 110, i = 0; x < X1 + 20; x += 120 + Math.round(nz(i, 121) * 90), i++) {   // tree ferns
    const base = 213, h = 38 + nz(i, 122) * 18;
    for (let y = base - h; y < base; y++) { put(b, x, y, MB[2]); put(b, x + 1, y, MB[3]); }
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI * (0.05 + 0.9 * k / 8), L = 14 + nz(k, x) * 8;
      for (let j = 1; j <= L; j++) {
        const t = j / L, fx = x + Math.cos(a) * j, fy = base - h + Math.sin(a) * j * 0.7 + t * t * L * 0.65;
        put(b, fx, fy, MJ[1]);
        if (j % 2 === 0 && j < L - 1) { put(b, fx, fy + 1, MJ[2]); put(b, fx, fy - 1, MJ[0]); }
      }
    }
  }
  for (let x = -14; x < X1 + 14; x += 3) {   // undergrowth along the back of the world
    const r = 3 + nz(x + 4096, 71) * 5 * (jfbm(x / 30, 0, 72) + 0.4), y = 210 - r * 0.4 + nz(x + 4096, 73) * 4;
    oval(b, x, y, r, r * 0.8, MJ[2]); oval(b, x - 0.6, y - 1.2, r - 1.3, r * 0.8 - 1.3, MJ[1]);
    if (nz(x + 4096, 74) > 0.75) put(b, x - 1, y - r + 1, MJ[0]);
  }
  rect(b, -10, 212, X1 + 10, H - 212, MJ[2]);
  for (let x = 6; x < X1; x += 16 + Math.round(nz(x, 75) * 22)) fern(b, x, 214, 7 + nz(x, 76) * 5, MJ);
  for (let i = 0; i < (X1 + 10) / 18; i++) {
    const x = Math.round(nz(i, 81) * X1), y = 192 + Math.round(nz(i, 82) * 18);
    if (get(b, x, y) === NONE) continue;
    put(b, x, y, I('#e85a5a')); put(b, x + 1, y, I('#c83a40')); put(b, x, y - 1, I('#ff8a7a'));
  }
  hazeB(b, MIST, (x, y) => ss(150, 226, y) * 0.3 + 0.06);
}

// the canopy ceiling (p 0.6) over camera 1400..4000: a forest edge at CAN.e0 (it slides in over the end of the bay),
// gaps over the volcano's line of sight, and it opens up again at CAN.e1 (the jungle ends before the lava)
const CAN = { e0: 550, e1: 1400, gaps: [700, 900, 1100, 1300] };
function gapK(x) { let g = 0; for (const c of CAN.gaps) g = Math.max(g, 1 - ss(34, 78, Math.abs(x - c))); return g; }
const edgeK = x => ss(CAN.e0, CAN.e0 + 70, x) * (1 - ss(CAN.e1 - 70, CAN.e1, x));
function canopyBottom(x) {
  const closed = 56 + 10 * jfbm(x / 16, 0, 41) + 7 * Math.sin(x / 47);
  const open = 9 + 5 * jfbm(x / 13, 1, 42);
  return lerp(lerp(closed, open, gapK(x)), -30, 1 - edgeK(x));
}
function paintCanopy(b, X1) {
  for (let x = CAN.e0 - 30; x < CAN.e1 + 30; x++) { const cb = Math.round(canopyBottom(x)) - 5; if (cb > 0) rect(b, x, 0, 1, cb, NC[3]); }
  for (let x = CAN.e0 - 30; x < CAN.e1 + 30; x += 11) { const cb = canopyBottom(x); if (cb > -8) foliage(b, x + 3, cb - 15, 10, 7, NC, x + 777, 2.5, 5); }
  for (let x = CAN.e0 - 30; x < CAN.e1 + 30; x += 7) { const cb = canopyBottom(x); if (cb > -12) foliage(b, x, cb - 5, 8, 5, NC, x + 501, 2.5, 4.5); }
  // the forest edges: a few big crowns that round the canopy off
  for (const [x, y, rx, ry] of [[CAN.e0 + 6, 6, 22, 14], [CAN.e0 + 30, 22, 18, 12], [CAN.e1 - 8, 4, 20, 13], [CAN.e1 - 34, 20, 16, 11]]) foliage(b, x, y, rx, ry, NC, x * 3 + 1, 3, 6);
  // backlit palm fronds reaching into each gap from both sides
  const FR = [LIT[0], LIT[1], LIT[2], NC[2]];
  CAN.gaps.forEach((g, i) => {
    const m = i % 2 ? 1 : 0;
    jfrond(b, g - 72, 40 - m * 6, 0.15, 52 - m * 8, 0.55, FR);
    jfrond(b, g - 60, 24, 0.5, 40, 0.4, FR);
    if (m) jfrond(b, g - 40, 8, 0.75, 30, 0.3, FR);
    jfrond(b, g + 72, 30 + m * 8, Math.PI - 0.1, 50, 0.55, FR);
    jfrond(b, g + 56, 14, Math.PI - 0.45, 38 + m * 6, 0.45, FR);
  });
  // vines hanging down, heliconia pendants
  for (let x = CAN.e0 + 4, i = 0; x < CAN.e1 - 4; x += 19 + Math.round(nz(i, 51) * 46), i++) {
    if (gapK(x) > 0.5) continue;
    const y0 = Math.max(0, Math.round(canopyBottom(x)) - 4), len = 30 + Math.round(nz(i, 52) * 100 * edgeK(x));
    for (let y = y0; y < y0 + len; y++) {
      const vx = x + Math.round(Math.sin((y - y0) / 15 + x) * 2);
      put(b, vx, y, NC[3]);
      if ((y - y0) % 7 === 3) { put(b, vx + 1, y, NC[1]); put(b, vx + 2, y + 1, NC[2]); }
      if ((y - y0) % 7 === 0) { put(b, vx - 1, y, NC[1]); put(b, vx - 2, y + 1, NC[2]); }
    }
    if (nz(i, 53) > 0.7) heliconia(b, x + 6, y0 + 2, 4 + Math.round(nz(i, 54) * 4));
  }
}
// light shafts falling through the canopy gaps (soft, warm), on the canopy's parallax
function shaftCanvas(w) {
  const beams = [], c = canvasOf(w, H), g = c.getContext('2d'), im = g.createImageData(w, H), d = im.data, A = new Float32Array(w);
  for (const gx of CAN.gaps) for (const [dx, bw, ba] of [[-52, 16, 0.26], [-24, 8, 0.18], [28, 20, 0.24], [56, 10, 0.16]]) beams.push([gx + dx, bw, ba]);
  for (let y = 0; y < H; y++) {
    const fy = ss(10, 44, y) * (1 - ss(190, 250, y));
    if (fy <= 0) continue;
    A.fill(0);
    for (const [bx, bw, ba] of beams) {
      const cc = bx + y * 0.5 + 10;
      for (let x = Math.max(0, Math.floor(cc - bw / 2)); x <= Math.min(w - 1, Math.ceil(cc + bw / 2)); x++) {
        const e = 1 - Math.abs(x - cc) / (bw / 2);
        if (e > 0) A[x] = Math.max(A[x], ba * fy * Math.min(1, e * 2.2));
      }
    }
    for (let x = 0; x < w; x++) if (A[x] > 0.01) { const j = (y * w + x) * 4; d[j] = 255; d[j + 1] = 246; d[j + 2] = 204; d[j + 3] = Math.round(A[x] * 255); }
  }
  g.putImageData(im, 0, 0);
  return c;
}
// a soft sun glow for the jungle sky (upper left, above the canopy)
function glowCanvas(r, c, a) {
  const cv = canvasOf(r * 2, r * 2), g = cv.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(c, a)); gr.addColorStop(0.5, rgba(c, a * 0.35)); gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return cv;
}
// the waterfall of a cliff (live: the water streams down; drawn on the cliff strip's offset)
function waterfall(g, c, ox) {
  const f = wfOf(c), y0 = Math.round(cliffTop(c.x, c)) - 4, y1 = 206;
  if (f.x1 + ox < -12 || f.x0 + ox > W + 12) return;
  const WFC = ['#4f8f9f', '#79b9c4', '#a9dbe1', '#d9f2f3'];
  for (let x = f.x0; x <= f.x1; x++) {
    const e = Math.min(x - f.x0, f.x1 - x), sp = 2.2 + (x % 3) * 0.4;
    g.fillStyle = WFC[Math.min(3, e)]; g.fillRect(x + ox, y0, 1, y1 - y0);
    for (let y = y0; y < y1; y++) {
      const q = ((y - G.t * sp + hsh(x) * 50) % 11 + 11) % 11;
      if (q < 3 && e > 0) { g.fillStyle = e > 1 ? '#ffffff' : '#c8eef0'; g.fillRect(x + ox, y, 1, 1); }
      else if (q > 7.5 && e > 0 && e < 4) { g.fillStyle = e === 1 ? '#5d9fae' : '#86c3cc'; g.fillRect(x + ox, y, 1, 1); }
    }
  }
  g.fillStyle = '#ffffff'; g.fillRect(f.x0 + ox - 1, y0, f.x1 - f.x0 + 3, 1);
  g.fillStyle = '#e6f8f8'; g.fillRect(f.x0 + ox, y0 + 1, f.x1 - f.x0 + 1, 1);
  g.fillStyle = '#4f8f9f'; g.fillRect(f.x0 + ox - 1, y0 + 1, 1, 3); g.fillRect(f.x1 + ox + 1, y0 + 1, 1, 3);
  for (let i = 0; i < 9; i++) { const t = (G.t * 0.4 + i * 9) % 40; g.fillStyle = 'rgba(240,250,250,' + (0.34 * (1 - t / 40)).toFixed(3) + ')'; pdisc(g, (f.x0 + f.x1) / 2 + ox + (i - 4) * 4, y1 - 8 - t * 0.3, 4 + t * 0.15); }
}
// pollen and dust drifting in the light (screen space)
function motes(g, cx, n, p, a) {
  for (let i = 0; i < n; i++) {
    const t = G.t + i * 211, x = Math.round(wrap(hsh(i * 3.7) * 700 + Math.sin(t * 0.007 + i) * 30 + t * 0.06 - cx * p, W + 40) - 20);
    const y = Math.round(40 + hsh(i * 9.1) * 170 + Math.sin(t * 0.011 + i * 2) * 12 + Math.sin(t * 0.004) * 6);
    const tw = Math.sin(t * 0.09 + i) > 0.2;
    g.fillStyle = tw ? 'rgba(255,250,220,' + (0.95 * a).toFixed(2) + ')' : 'rgba(255,246,200,' + (0.45 * a).toFixed(2) + ')';
    g.fillRect(x, y, 1, 1);
    if (tw && i % 5 === 0) { g.fillStyle = 'rgba(255,250,220,' + (0.35 * a).toFixed(2) + ')'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
  }
}
function jungleDeco(g, cx, a) {
  if (a <= 0.01) return;
  g.globalAlpha = a; g.drawImage(ART.glowJ, 150 - Math.round((cx - SCN.jungle.cam0) * 0.01) - 270, -40 - 270); g.globalAlpha = 1;
  clouds(g, cx, CL_JUNGLE, ART.cloudsJ, a);
}
function jungleLayers(g, cx, hz) {
  const L = LAY.jungle;
  blit(g, L.far, cx); if (hz) hz(g, 0);
  blit(g, L.cliff, cx);
  const co = offOf(L.cliff, cx);
  for (const c of CLIFFS) waterfall(g, c, -co);
  if (hz) hz(g, 1);
  blit(g, L.mid, cx);
  g.globalAlpha = 0.66 + 0.16 * Math.sin(G.t * 0.017); blit(g, LAY.canopy.shaft, cx); g.globalAlpha = 1;
  motes(g, cx, 22, 0.35, 1);
  if (hz) hz(g, 2);
}
// the canopy ceiling in front of everything behind the world (while any of it is on screen)
function drawCanopy(g, cx) {
  const L = LAY.canopy.near, o = Math.round((cx - L.S.cam0) * L.p);
  if (o + W + 10 < CAN.e0 - 40 || o - 10 > CAN.e1 + 120) return;
  blit(g, L, cx);
}

// ============================================================
// The mists between the scenes: a haze target (an opaque column the old scene's layers dissolve toward, far layers
// first), a fog column (per-row alpha) laid over everything at the peak, and drifting textured bands
// ============================================================
// a band of drifting mist (alpha) that wraps seamlessly at its width
function fogStrip(w, h, s, col, dens) {
  const A = new Float32Array(w * 2), Q = 16, u0 = -w / 13, B = new Float32Array(Math.ceil((2 * w / 13 + h / 9) * Q) + 2);
  for (let x = -w; x < w; x++) A[x + w] = fbm(x / 45, s, 3);
  for (let i = 0; i < B.length; i++) B[i] = fbm(u0 + i / Q, s + 3, 2);
  const n = (x, y) => { const u = (x / 13 + y / 9 - u0) * Q, i = Math.floor(u); return 0.55 * A[x + w] + 0.45 * lerp(B[i], B[i + 1], u - i); };
  const FY = new Float32Array(h);
  for (let y = 0; y < h; y++) FY[y] = Math.sin(Math.PI * y / h) ** 2;
  return alphaCanvas(w, h, col, (x, y) => clamp(FY[y] * (lerp(n(x, y), n(x - w, y), x / w) * 1.4 - 0.3), 0, 1) * (dens || 0.8));
}
function band(g, img, off, y) {
  const w = img.width;
  for (let x = -10 - Math.round(wrap(off, w)); x < W + 10; x += w) g.drawImage(img, x, y);
}
// [haze stops (opaque), fog alpha (y => 0..1), bands: [colour, height, y, density, parallax, drift]]
const MISTS = [
  { haze: [[-10, '#a8d0d6'], [60, '#c4e0da'], [110, '#e2eee0'], [160, '#eaf2e4'], [280, '#e6f0e0']], fa: y => ss(64, 150, y),
    bands: [['#f4f8f0', 70, 108, 0.8, 0.12, 0.08], ['#ffffff', 56, 150, 0.7, 0.25, 0.14], ['#eef6ea', 60, 186, 0.8, 0.4, 0.2]],
    bg: (g, cx, a) => { g.globalAlpha = a; blit(g, LAY.jungle.far, cx); g.globalAlpha = a * 0.6; blit(g, LAY.jungle.cliff, cx); g.globalAlpha = 1; }, bgA: 0.7, front: 0.7 },
  { haze: [[-10, '#4a3a4c'], [70, '#6e5560'], [140, '#946c64'], [210, '#b47c5c'], [280, '#c08458']], fa: () => 1,
    bands: [['#3a2c36', 70, 10, 0.75, 0.1, 0.16], ['#7a6066', 64, 60, 0.6, 0.2, 0.22], ['#5a4448', 70, 120, 0.7, 0.3, 0.3], ['#c08a6a', 50, 176, 0.5, 0.45, 0.26]],
    bg: (g, cx, a) => drawVolcanoNear(g, cx, a), bgA: 0.55, front: 0.8 },
  { haze: [[-10, '#1e0c12'], [80, '#2e1216'], [160, '#4a1a18'], [230, '#6a281c'], [280, '#7a2e1c']], fa: () => 1,
    bands: [['#120609', 70, 6, 0.75, 0.1, 0.12], ['#3a1416', 64, 70, 0.6, 0.22, 0.2], ['#5a2018', 70, 130, 0.65, 0.32, 0.26], ['#a8481e', 46, 190, 0.45, 0.45, 0.3]],
    bg: (g, cx, a) => { g.globalAlpha = a; blit(g, LAY.crater.far, cx); g.globalAlpha = 1; }, bgA: 0.6, front: 0.8 }
];
function mistArt(m, i) {
  m.hazeCol = skyColumn(m.haze);
  const b = canvasOf(1, H + 20), g = b.getContext('2d'), im = g.createImageData(1, H + 20);
  for (let y = -10; y < H + 10; y++) { const c = gradCol(m.haze, y), j = (y + 10) * 4; im.data[j] = c >> 16 & 255; im.data[j + 1] = c >> 8 & 255; im.data[j + 2] = c & 255; im.data[j + 3] = Math.round(255 * m.fa(y)); }
  g.putImageData(im, 0, 0);
  m.fogCol = b;
  m.strips = m.bands.map(([c, h, , d], k) => fogStrip(700 + k * 60, h, 7 + i * 5 + k, c, d));
}
// the haze after layer d of n (cumulative: far layers end up hazier), u = 0 at the scene's own end .. 1 in the mist
function hazeOver(g, mist, u, d, n) {
  const a = ss(0, 0.85, u) * (0.6 - 0.35 * d / Math.max(1, n - 1));
  if (a <= 0.004) return;
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a;
  fillCol(g, mist.hazeCol);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}
function fogBands(g, cx, mist, m) {
  if (m <= 0.004) return;
  mist.bands.forEach(([, , y, d, p, v], k) => { g.globalAlpha = m * mist.front * (0.6 + 0.4 * Math.sin(G.t * 0.01 + k)); band(g, mist.strips[k], cx * p + G.t * v, y + Math.round(Math.sin(G.t * 0.007 + k * 2) * 3)); });
  g.globalAlpha = 1;
}

// ============================================================
// The scenes: sky column, sky decorations (fade with the scene), landmark, layers (haze hooks), how many depths
// ============================================================
const SCENES = {
  bay: { sky: () => ART.skyB, deco: bayDeco, land: (g, cx, a) => drawVolcanoFar(g, cx, 'bay', a), lk: 'small', layers: bayLayers, n: 4 },
  jungle: { sky: () => ART.skyJ, deco: jungleDeco, land: (g, cx, a) => drawVolcanoFar(g, cx, 'jungle', a), lk: 'small', layers: jungleLayers, n: 3 },
  lava: { sky: () => ART.skyL, deco: (g, cx, a) => lavaDeco(g, cx, a), land: (g, cx, a) => drawVolcanoNear(g, cx, a), lk: 'big', layers: (g, cx, hz) => lavaLayers(g, cx, hz), n: 3 },
  crater: { sky: () => ART.skyC, deco: (g, cx, a) => craterDeco(g, cx, a), land: null, lk: null, layers: (g, cx, hz) => craterLayers(g, cx, hz), n: 3 }
};
function drawScene(S, cx) {
  fillCol(ctx, S.sky());
  S.deco(ctx, cx, 1);
  if (S.land) S.land(ctx, cx, 1);
  S.layers(ctx, cx, null);
}
// A transition: the old scene's layers dissolve (far ones first) toward the mist in front of a fog that hides
// their landmark; through the fog the new scene's far layer looms (mist.bg); then the new scene condenses out of it
// (near layers first). The two scenes' layers are never drawn together; landmarks shared by both (the far volcano
// of the bay and the jungle) stay, crossfading only their light.
function drawTrans(A, B, k, mist, cx) {
  const u = k < 0.5 ? k * 2 : (1 - k) * 2, shared = A.lk && A.lk === B.lk;
  fillCol(ctx, A.sky());
  if (k > 0.003) { ctx.globalAlpha = k; fillCol(ctx, B.sky()); ctx.globalAlpha = 1; }
  A.deco(ctx, cx, 1 - ss(0.05, 0.5, k));
  B.deco(ctx, cx, ss(0.5, 0.95, k));
  if (shared) { A.land(ctx, cx, 1 - ss(0.2, 0.8, k)); B.land(ctx, cx, ss(0.2, 0.8, k)); }
  else if (k < 0.5 && A.land) A.land(ctx, cx, 1 - ss(0.3, 0.7, u));
  const m = ss(0.25, 0.9, u);
  if (m > 0.004) { ctx.globalAlpha = m; fillCol(ctx, mist.fogCol); ctx.globalAlpha = 1; }
  const ba = mist.bgA * ss(0.5, 1, u);
  if (ba > 0.004) mist.bg(ctx, cx, ba);
  const S = k < 0.5 ? A : B, al = 1 - ss(0.55, 1, u);
  if (al > 0.004) {
    const bg = BUF.getContext('2d'), own = !shared && S === B && S.land, n = S.n + (own ? 1 : 0);
    bg.clearRect(-10, -10, W + 20, H + 20);
    if (own) { S.land(bg, cx, 1); hazeOver(bg, mist, u, 0, n); }
    S.layers(bg, cx, (g, d) => hazeOver(g, mist, u, d + (own ? 1 : 0), n));
    ctx.globalAlpha = al; ctx.drawImage(BUF, -10, -10); ctx.globalAlpha = 1;
  }
  fogBands(ctx, cx, mist, m);
}
const isM3 = () => typeof LV !== 'undefined' && LV && LV.mission === 'MISSION 3';
L3.drawBG = function (cx) {
  if (!ready()) { ctx.fillStyle = '#8fd0ff'; ctx.fillRect(-10, -10, W + 20, H + 20); return; }
  const S = SCENES;
  if (cx <= T1[0]) drawScene(S.bay, cx);
  else if (cx < T1[1]) drawTrans(S.bay, S.jungle, (cx - T1[0]) / (T1[1] - T1[0]), MISTS[0], cx);
  else if (cx <= T2[0]) drawScene(S.jungle, cx);
  else if (cx < T2[1]) drawTrans(S.jungle, S.lava, (cx - T2[0]) / (T2[1] - T2[0]), MISTS[1], cx);
  else if (cx <= T3[0]) drawScene(S.lava, cx);
  else if (cx < T3[1]) drawTrans(S.lava, S.crater, (cx - T3[0]) / (T3[1] - T3[0]), MISTS[2], cx);
  else drawScene(S.crater, cx);
  drawCanopy(ctx, cx);
};

// ============================================================
// LAVA RIVERS (dusk). Indigo to wine to orange sky with early stars and cloud banks lit gold from below; the volcano
// close and erupting (lava jets, fresh rivers down its flanks into the jungle, a billowing ash plume bending right);
// a jungle ridge with palm silhouettes; a two-tier basalt cliff glowing at its foot, lava falls pouring from notches.
// ============================================================
const SKY_LAVA = [[0, '#170b27'], [28, '#22102f'], [54, '#35133a'], [78, '#511840'], [100, '#711e44'], [120, '#922a44'], [138, '#b13940'], [154, '#cd4c3b'], [168, '#e26537'], [182, '#f0833c'], [198, '#f8a24b']];
// a flat bank of cloud: flattened puffs on a flat base, lit from below by the sun under the horizon (warmer to the left)
function cloudBank(b, cx, cy, w, h, s, dim) {
  const puffs = [], n = Math.max(3, Math.round(w / 10)), slope = (h2(s, 1, 13) - 0.5) * 0.08;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, env = Math.pow(Math.sin(Math.PI * t), 0.8), r = h * (0.3 + 1.1 * env) * (0.5 + 0.9 * h2(i, s, 11));
    puffs.push([cx - w / 2 + t * w + (h2(i, s, 12) - 0.5) * 9, cy - r * 0.38 - (h2(i, s, 14) - 0.5) * h * 0.6, r * 1.5, r * 1.22]);
  }
  const baseY = x => cy + h * 0.35 + (fbm(x / 9, s + 5) - 0.5) * 2.4 + (x - cx) * slope;
  const inside = (x, y) => {
    if (y > baseY(x)) return false;
    for (const [px, py, rx, ry] of puffs) { const dx = (x - px) / rx, dy = (y - py) / ry; if (dx * dx + dy * dy <= 1) return true; }
    return false;
  };
  const warmAt = x => clamp(1 - (x + 20) / 900, 0.25, 1) * (dim ? 0.6 : 1);
  const x0 = Math.floor(cx - w / 2 - h * 3), x1 = Math.ceil(cx + w / 2 + h * 3), y0 = Math.floor(cy - h * 3), y1 = Math.ceil(cy + h * 1.5);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inside(x, y)) continue;
    let db = 1; while (db < 5 && inside(x, y + db)) db++;
    let dt = 1; while (dt < 3 && inside(x, y - dt)) dt++;
    const warm = warmAt(x);
    let c;
    if (db === 1) c = mixC('#e0704c', '#ffd09a', warm);
    else if (db === 2) c = mixC('#a8404a', '#f08a5a', warm);
    else if (db <= 4 && (db === 3 || bay(x, y) < 0.5)) c = mixC('#7a2a48', '#c0504c', warm);
    else c = dt === 1 ? I('#4a1a3e') : I(dim ? '#5c2244' : '#6a2546');
    put(b, x, y, c);
  }
  // wispy tails trailing off both ends, lit from below, broken up
  for (let k = 0; k < 3; k++) {
    const side = k % 2 ? 1 : -1, len = 10 + h2(k, s, 15) * 26, yy = Math.round(baseY(cx + side * w / 2) - 1 + k), xs = cx + side * (w / 2 - 6 - h2(k, s, 16) * 8);
    for (let i = 0; i < len; i++) {
      const x = Math.round(xs + side * i);
      if (get(b, x, yy) !== NONE || h2(x, yy, s) > 0.82 - 0.4 * (i / len)) continue;
      put(b, x, yy, mixC(i < len * 0.5 ? '#c0504c' : '#8a3048', '#ffd09a', warmAt(x) * 0.6));
    }
  }
}
const BANKS = [[40, 106, 96, 7, 1], [132, 113, 64, 5, 7], [200, 127, 84, 5, 2], [6, 138, 74, 5, 3], [216, 92, 46, 4, 4, 1], [440, 126, 76, 6, 5, 1], [492, 138, 50, 4, 6, 1],
  [330, 104, 70, 5, 8], [560, 112, 88, 6, 9], [610, 134, 60, 4, 10, 1]];
function paintBanks(b, X1) { for (const [x, y, w, h, sd, dim] of BANKS) if (x - w < X1) cloudBank(b, x, y, w, h, sd, dim); }
// the afterglow of the sunset low on the left, and the early stars (a canvas the size of the screen)
function duskCanvas() {
  const w = W + 40, c = canvasOf(w, H), g = c.getContext('2d'), im = g.createImageData(w, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) {
    const gx = (x - 30) / 240, gy = (y - 196) / 80, k = Math.exp(-(gx * gx + gy * gy)) * 0.6;
    if (k < 0.01) continue;
    const j = (y * w + x) * 4; d[j] = 255; d[j + 1] = 196; d[j + 2] = 124; d[j + 3] = Math.round(k * 255);
  }
  g.putImageData(im, 0, 0);
  const b = buf(w, H, 0, 0);
  for (let i = 0; i < 40; i++) {
    const x = Math.round(hsh(i * 3.17 + 1) * (w - 4)) + 2, y = Math.round(16 + Math.pow(hsh(i * 7.71 + 2), 1.3) * 64);
    const big = hsh(i * 5.3) > 0.82;
    put(b, x, y, I(big ? '#fff4ea' : hsh(i * 9.1) > 0.5 ? '#e8c6d6' : '#a8809e'));
    if (big) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(b, x + dx, y + dy, I('#8a5e84'));
  }
  g.drawImage(bake(b), 0, 0);
  return c;
}
// the big volcano: painted in design coordinates with its crater at (LVX, LVY), drawn shifted so the crater sits
// at volcLX(cx). The same notched stratovolcano as the bay's, much closer, at dusk, erupting.
const LVX = 300, LVY = 86, RIMW = 14, VO = LVY - 80;
const volcLX = cx => 300 - Math.round((cx - 3640) * 0.05);
function vProf(x) {
  const u = Math.abs(x - LVX);
  if (u <= RIMW) {
    const k = (x - LVX + RIMW) / (2 * RIMW);
    return LVY + 2.2 * Math.sin(Math.PI * k) + 3.4 * Math.exp(-Math.pow((x - (LVX - 9)) / 3.2, 2)) - 1.4 * k + 0.8 * (fbm(x / 4, 2) - 0.5);
  }
  const w = u - RIMW;
  return LVY + 116 * (1 - Math.exp(-w / 100)) + 0.05 * w + (2.6 * fbm(x / 13, 4) - 1.3) * (1.2 - Math.min(1, w / 260)) + (x > LVX ? -1.4 : 0);
}
const ROCK = PI('#1d151c', '#291d25', '#382830', '#4a333b', '#5f4146', '#785250', '#93655c', '#b07a68');
const JUNG = PI('#0e1813', '#14231a', '#1c3121', '#274528', '#355a2e', '#4a7034');
const OLDF = [[-0.5, 0.06, 150, 1], [-0.17, 0.04, 126, 2], [0.3, 0.05, 158, 3], [0.62, 0.045, 140, 4], [-0.86, 0.05, 170, 5]];
const RIVERS = [
  { pts: [[-9, 84], [-13, 92], [-17, 100], [-22, 109], [-28, 118], [-34, 128], [-40, 138], [-47, 149], [-53, 160], [-60, 172], [-67, 186]], w0: 1.1, w1: 2.8, s: 1 },
  { pts: [[14, 82], [17, 90], [21, 99], [26, 109], [32, 119], [38, 130], [44, 141], [51, 152], [58, 165], [63, 178]], w0: 1.0, w1: 2.5, s: 2 },
  { pts: [[22, 103], [18, 112], [15, 123], [10, 135], [7, 147], [3, 159], [0, 172], [-2, 186]], w0: 0.7, w1: 2.0, s: 3 }
];
function riverPts(r) {
  const out = [];
  for (let i = 0; i + 1 < r.pts.length; i++) {
    const ax = LVX + r.pts[i][0], ay = r.pts[i][1] + VO, bx = LVX + r.pts[i + 1][0], by = r.pts[i + 1][1] + VO, n = Math.ceil(Math.hypot(bx - ax, by - ay) * 3);
    for (let k = 0; k < n; k++) {
      const t = (i + k / n) / (r.pts.length - 1), x = lerp(ax, bx, k / n) + Math.sin(t * 23 + r.s) * 0.8, y = lerp(ay, by, k / n);
      out.push([x, y, lerp(r.w0, r.w1, t) * (0.85 + 0.3 * fbm(t * 9, r.s)), t]);
    }
  }
  return out;
}
// palm silhouettes: hand-shaped fronds, mirrored
const PALM_FRONDS = [
  [[0, -1], [5, -4], [10, -4.5], [14, -3], [17, 0], [19, 5], [17.5, 5], [16.5, 3], [15.5, 5.5], [14.5, 2], [13, 4.5], [12, 1], [10.5, 3.5], [9.5, 0.5], [8, 3], [7, 0], [5.5, 2], [4, -0.5], [2.5, 1.5], [1, 0.5]],
  [[0, -1], [3, -6], [7, -9], [11, -10], [14.5, -9], [16.5, -7], [15, -6.5], [14, -8], [13.5, -6], [12, -8], [11, -6], [9.5, -7.5], [8.5, -5], [7, -6], [5.5, -3.5], [4, -3.5], [2, -1]],
  [[0, 0], [4, 0.5], [7, 2.5], [9.5, 6.5], [8.5, 7.5], [7.5, 5.5], [6.5, 7], [5.5, 4], [4, 5], [3, 2.5], [1.5, 2.5]],
  [[-0.5, -1], [-1.5, -6], [0, -10.5], [2, -11.5], [3, -10], [1.5, -9], [2, -7], [0.5, -6], [1, -3]]
];
function spalm(b, x, base, h, lean, sd, C, scale) {
  scale = scale || 1;
  let tx = x, ty = base;
  for (let i = 0; i <= h; i++) {
    const k = i / h;
    tx = Math.round(x + lean * k * k * h * 0.45); ty = base - i;
    put(b, tx, ty, C); put(b, tx + 1, ty, C);
    if (i < 2) { put(b, tx - 1, ty, C); put(b, tx + 2, ty, C); }
    if (i % 3 === 1 && i < h - 2) put(b, tx + (lean > 0 ? -1 : 2), ty, C);
  }
  const cx = tx + 0.5, cy = ty + 0.5;
  PALM_FRONDS.forEach((pts, f) => {
    for (const m of f === 3 ? [1] : [1, -1]) {
      const sc = (0.78 + 0.32 * h2(f, m + 3, sd)) * scale, sh = (h2(f, m + 7, sd) - 0.5) * 0.25;
      poly(b, pts.map(([u, v]) => [cx + m * (u * sc) + v * sh, cy + v * sc + (m * u * sc) * sh * 0.3]), C);
    }
  });
  disc(b, cx, cy + 1, 1.6 * scale, C);
}
function paintVolcanoNear() {
  const b = buf(660, 200, 30, -70);       // design x -30 .. 630, y 70 .. 270
  const X0 = -30, X1 = 630;
  const jtop = x => LVY + 74 + 8 * fbm(x / 26, 12) - 5 * fbm(x / 6, 13);
  const OFY = new Float32Array(OLDF.length * 300), OFX = new Float32Array(OLDF.length);
  OLDF.forEach(([, , , sd], q) => { for (let y = 0; y < 300; y++) OFY[q * 300 + y] = fbm(y / 7, sd) - 0.5; });
  for (let x = X0; x < X1; x++) {
    const top = Math.round(vProf(x)), jt = jtop(x), side = x < LVX;
    OLDF.forEach(([, , , sd], q) => { OFX[q] = fbm(x / 5, sd); });
    for (let y = Math.max(70, top); y < H; y++) {
      const dy = y - LVY, a = (x - LVX) / (dy + 18);
      let l;
      if (y > jt) {
        const t1 = vn2(x / 3.1, y / 2.4, 31), t2 = vn2(x / 3.1, (y - 1.5) / 2.4, 31);
        l = (side ? 2.4 : 1.5) + (t1 - 0.5) * 2.2 + (t1 > t2 + 0.05 ? 1 : t1 < t2 - 0.05 ? -0.8 : 0) - ss(jt, jt + 40, y) * 0.8;
        if (y - jt < 1.5) l += 1.2;
        put(b, x, y, JUNG[clamp(Math.floor(l + bay(x, y) - 0.5), 0, 5)]);
        continue;
      }
      l = side ? 3.3 : 1.8;
      l += (1 - ss(LVY, LVY + 75, y)) * (side ? 2.1 : 1.0);
      l -= ss(LVY + 40, LVY + 110, y) * 0.7;
      const rp = a * 5.4 + (fbm(a * 2.5 + 7, 22) - 0.5) * 3 + (fbm(y / 9 + a * 3, 24) - 0.5) * 0.7, fr = rp - Math.floor(rp);
      l += fr < 0.16 ? 1.1 : fr < 0.5 ? 0.2 : fr < 0.72 ? -0.6 : -1.1;
      l += (jfbm(x / 14, y / 10, 23, 2) - 0.5) * 1.1;
      for (let q = 0; q < OLDF.length; q++) {
        const [ac, hw, ye, sd] = OLDF[q], d = Math.abs(a - ac + OFY[q * 300 + y] * 0.06), w = hw * (0.5 + 0.5 * ss(LVY, LVY + 40, y));
        if (y < ye + VO - OFX[q] * 12 && d < w) l = d > w - 0.012 && side ? 3 : 0.6 + (h2(x, y, sd) > 0.8 ? 1 : 0);
      }
      if (y - top < 1) l += 1.2;
      put(b, x, y, ROCK[clamp(Math.floor(l + (bay(x, y) - 0.5) * 0.7), 0, 7)]);
    }
  }
  // crowns poking above the jungle edge: round canopy trees and small palms
  for (let x = X0 + 4, i = 0; x < X1 - 4; x += 4 + Math.round(h2(i, 1, 35) * 6), i++) {
    const jt = jtop(x);
    if (jt < vProf(x) + 4) continue;
    const side = x < LVX, r = 1.8 + h2(i, 2, 35) * 2.2;
    disc(b, x, jt - r * 0.5, r, JUNG[side ? 2 : 1]);
    disc(b, x - 0.6, jt - r * 0.5 - 0.8, Math.max(0.5, r - 1.2), JUNG[side ? 4 : 3]);
  }
  for (const [x, h, lean, sd] of [[60, 9, 0.6, 26], [128, 8, 0.6, 21], [378, 8, 0.7, 23], [404, 10, -0.6, 24], [446, 8, 0.5, 25], [520, 9, -0.5, 27]]) spalm(b, x, Math.round(jtop(x)) + 1, h, lean, sd, I(x < LVX ? '#1c2c20' : '#16221a'), 0.45);
  // the glow of the fresh lava on the slopes around it
  const glow = new Float32Array(b.w * b.h), rivs = RIVERS.map(r => { const pts = riverPts(r), i = pts.findIndex(([x, y]) => y > jtop(x) + 3); return i < 0 ? pts : pts.slice(0, i); });
  for (const pts of rivs) for (const [x, y, w] of pts) {
    const R2 = w + 8;
    for (let j = -Math.ceil(R2); j <= R2; j++) for (let i = -Math.ceil(R2); i <= R2; i++) {
      const d = Math.hypot(i, j), X = Math.round(x + i) + b.ox, Y = Math.round(y + j) + b.oy;
      if (X < 0 || Y < 0 || X >= b.w || Y >= b.h || d > R2) continue;
      glow[Y * b.w + X] = Math.max(glow[Y * b.w + X], Math.pow(1 - d / R2, 1.7) * 0.85);
    }
  }
  for (let i = 0; i < glow.length; i++) if (glow[i] > 0.02 && b.d[i] !== NONE) {
    const x = (i % b.w) - b.ox, y = Math.floor(i / b.w) - b.oy, gl = glow[i] + (bay(x, y) - 0.5) * 0.12;
    b.d[i] = mixI(b.d[i], I(gl > 0.5 ? '#e0602c' : '#a83a26'), Math.min(0.85, gl * 1.1));
  }
  // the rivers: dark red banks, orange body, yellow core, white-hot near the crater
  for (const pts of rivs) for (const [x, y, w] of pts) disc(b, x, y, w + 0.6, I('#a8301a'));
  for (const pts of rivs) for (const [x, y, w, t] of pts) disc(b, x, y, Math.max(0, w - 0.3), I(t > 0.75 ? '#e8501e' : '#ff7a1a'));
  rivs.forEach((pts, ri) => { for (const [x, y, w, t] of pts) if (w > 1.1) { const hot = fbm(t * 11, ri + 40) - t * 0.35; disc(b, x, y, w - 1.1, I(hot > 0.42 ? '#ffd23f' : hot > 0.2 ? '#ffa02a' : '#ff7a1a')); } });
  for (const pts of rivs) for (const [x, y, , t] of pts) if (t < 0.35 && hsh(x * 3.1 + y) > 0.55) put(b, x, y, I('#fff1a0'));
  // smoke where the lava runs into the jungle and sets it smouldering
  rivs.forEach((pts, ri) => {
    const hit = pts[pts.length - 1];
    for (let k = 0; k < 14; k++) {
      const gx = hit[0] + (h2(k, ri, 37) - 0.5) * 8 + (k - 7) * 0.3 * (ri === 1 ? 1 : -1), gy = hit[1] + 2 + k * 1.6;
      put(b, gx, gy, I(k < 5 ? '#ff8a2a' : '#c8401a')); if (k < 8) put(b, gx + 1, gy, I('#a8301a'));
    }
    for (let k = 0; k < 7; k++) {
      const px = hit[0] + 1 + k * k * 0.35 + (h2(k, ri, 36) - 0.5) * 1.5, py = hit[1] - 2 - k * 3.2, r = 0.8 + k * 0.45;
      disc(b, px, py, r, I(k < 2 ? '#7a3c34' : k < 4 ? '#5e4048' : '#4c3e46'));
      if (r > 1.2) disc(b, px - 0.5, py - 0.6, r - 0.9, I(k < 2 ? '#a85a40' : '#6e5660'));
    }
  });
  // the crater rim glows where the lava inside lights it; a radio mast on the rim (the robots are home)
  for (let x = LVX - RIMW - 2; x <= LVX + RIMW + 2; x++) {
    const top = Math.round(vProf(x)), k = 1 - Math.abs(x - LVX) / (RIMW + 3);
    put(b, x, top, I(k > 0.5 ? '#ffd23f' : '#ff8a2a'));
    if (k > 0.3) put(b, x, top + 1, I(k > 0.7 ? '#ff8a2a' : '#c8401a'));
    if (k > 0.6 && hsh(x * 1.3) > 0.4) put(b, x, top + 2, I('#a8301a'));
  }
  const mx = LVX - RIMW - 4, my = Math.round(vProf(mx));
  rect(b, mx, my - 9, 1, 9, I('#2a1e26')); rect(b, mx - 2, my - 9, 5, 1, I('#2a1e26')); rect(b, mx - 1, my - 6, 3, 1, I('#2a1e26'));
  return sprite(b);
}
// the ash plume: a billowing column out of the crater, bending right; dark ash lit pink on its left by the dusk sky
// and orange underneath by the eruption
function paintPlumeNear() {
  const b = buf(470, 150, -(LVX - 60), 60), puffs = [];   // design x 240 .. 710, y -60 .. 90
  for (let i = 0; i <= 70; i++) {
    const s = i / 70, y = LVY - 7 - s * (LVY + 40), x = LVX + 1 + 140 * Math.pow(s, 2.3) + 5 * s, r = 9 + 27 * Math.pow(s, 0.7);
    for (let k = 0; k < 5; k++) {
      const o = (h2(i, k, 41) - 0.5) * r * 1.35, rr2 = r * (0.42 + 0.42 * h2(i, k, 42));
      puffs.push([x + o, y + (h2(i, k, 43) - 0.5) * r * 0.8, rr2]);
    }
  }
  for (let i = 0; i < 44; i++) puffs.push([366 + i * 7.6 + (h2(i, 1, 44) - 0.5) * 10, 3 + (h2(i, 2, 44) - 0.5) * 14 + i * 0.5, 9 + 10 * h2(i, 3, 44)]);
  puffs.sort((p, q) => q[1] - p[1]);
  const A0 = I('#271b23'), A1 = I('#392830'), A2 = I('#533a46'), A3 = I('#7a5262');
  for (const [x, y, r] of puffs) disc(b, x + 0.8, y + 1.2, r, A0);
  for (const [x, y, r] of puffs) disc(b, x - 0.5, y - 0.8, r - 1, A1);
  for (const [x, y, r] of puffs) if (r > 3) disc(b, x - r * 0.32, y - r * 0.34, r * 0.52, A2, A1);
  for (const [x, y, r] of puffs) if (r > 7) disc(b, x - r * 0.46, y - r * 0.44, r * 0.24, A3, A2);
  for (let i = 0; i < b.d.length; i++) {
    if (b.d[i] === NONE) continue;
    const x = (i % b.w) - b.ox, y = Math.floor(i / b.w) - b.oy;
    const k = ss(LVY - 72, LVY - 4, y) * clamp(1 - Math.abs(x - LVX - 3) / 44, 0, 1);
    if (k > 0.02) { const gl = k + (bay(x, y) - 0.5) * 0.15; b.d[i] = mixI(b.d[i], I(gl > 0.6 ? '#f07a34' : gl > 0.35 ? '#c8502e' : '#8a3a30'), Math.min(0.9, gl * 1.1)); }
  }
  return sprite(b);
}
// the lava fountain over the crater, fiercer while the volcano erupts (e 0..1), bombs arcing far away (live)
function fountain(g, cx, e) {
  for (const [dx, hgt, lean] of [[-1, 24, -0.12], [-6, 15, -0.45], [5, 17, 0.4]]) {
    const hh = Math.round(hgt * (1 + 0.9 * e + 0.12 * Math.sin(G.t * 0.07 + dx)));
    for (let y = 0; y < hh; y++) {
      const k = y / hh, x = Math.round(cx + dx + lean * y + Math.sin(y * 0.6 + G.t * 0.3) * 0.5), w = k < 0.5 ? 3 : 2;
      g.fillStyle = k < 0.25 ? '#fff1a0' : k < 0.55 ? '#ffd23f' : k < 0.8 ? '#ffa02a' : '#ff7a1a';
      g.fillRect(x - (w >> 1), LVY - 2 - y, w, 1);
    }
  }
  for (let i = 0, n = 70 + Math.round(50 * e); i < n; i++) {
    const ph = (G.t * 0.016 + hsh(i * 3.3 + 0.2)) % 1, a = -Math.PI / 2 + (hsh(i * 5.1) - 0.5) * (i < 24 ? 0.7 : 1.6), v = (1.4 + hsh(i * 7.9) * 1.3) * (1 + 0.5 * e), T = ph * 48;
    const x = Math.round(cx + Math.cos(a) * v * T), y = Math.round(LVY - 4 + Math.sin(a) * v * T + 0.055 * T * T);
    if (y > LVY + 3) continue;
    g.fillStyle = ph < 0.16 ? '#fff1a0' : ph < 0.4 ? '#ffd23f' : ph < 0.66 ? '#ff8a1a' : '#c8401a';
    const sz = ph < 0.28 ? 2 : 1; g.fillRect(x, y, sz, sz);
  }
  g.fillStyle = '#c8401a'; g.fillRect(cx - 12, LVY, 25, 2);
  g.fillStyle = '#ff8a1a'; g.fillRect(cx - 11, LVY - 1, 23, 2); g.fillRect(cx - 8, LVY - 3, 17, 2); g.fillRect(cx - 5, LVY - 4, 11, 1);
  g.fillStyle = '#ffd23f'; g.fillRect(cx - 8, LVY - 1, 17, 1); g.fillRect(cx - 6, LVY - 3, 13, 2);
  g.fillStyle = '#fff1a0'; g.fillRect(cx - 4, LVY - 3, 9, 1); g.fillRect(cx - 2, LVY - 4, 5, 1);
  for (let i = 0; i < 4; i++) {   // far bombs arcing off the volcano, trailing smoke
    const ph = (G.t * 0.006 + i * 0.27) % 1, dir = i % 2 ? 1 : -1, T = ph * 90, vx = dir * (0.6 + 0.25 * i), vy = -2.6 - 0.2 * i;
    for (let k = 5; k >= 0; k--) {
      const tt = T - k * 1.6, px = Math.round(cx + vx * tt), py = Math.round(LVY - 6 + vy * tt + 0.04 * tt * tt);
      g.fillStyle = k === 0 ? '#ffe9a0' : k < 2 ? '#ff9a2e' : k < 4 ? '#c8401a' : '#5a2a28';
      g.fillRect(px, py, k === 0 ? 2 : 1, k === 0 ? 2 : 1);
    }
  }
}
// the big volcano with its glow, plume and fountain (al = alpha); an eruption flash when L3.eruptT > 0
function drawVolcanoNear(g, cx, al) {
  if (al <= 0.004) return;
  const vx = volcLX(cx), dx = vx - LVX, e = WX.erupt;
  g.globalAlpha = al;
  blitS(g, ART.volL, dx, 0);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = al * (0.55 + 0.45 * e);
  g.drawImage(ART.craterGlow, vx - 80, LVY - 8 - 80);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = al;
  blitS(g, ART.plumeL, dx, 0);
  fountain(g, vx, e);
  if (e > 0.01) {   // the eruption: the plume's underside and the sky above the crater flare
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = al * e * 0.6;
    g.drawImage(ART.eruptGlow, vx - 160, LVY - 30 - 160);
    g.globalCompositeOperation = 'source-over';
  }
  g.globalAlpha = 1;
}
function lavaDeco(g, cx, a) {
  if (a <= 0.01) return;
  const L = LAY.lava;
  g.globalAlpha = a;
  g.drawImage(ART.dusk, -10 - Math.round((cx - SCN.lava.cam0) * 0.01), 0);
  for (let i = 0; i < 6; i++) if ((G.t + i * 47) % 140 < 14) { g.fillStyle = '#fff4ea'; g.fillRect(Math.round(hsh(i * 13.3 + 4) * W), Math.round(20 + hsh(i * 5.9) * 56), 1, 1); }
  blit(g, L.banks, cx);
  g.globalAlpha = 1;
}
// a jungle ridge with palm silhouettes, dark ridges at the volcano's foot (p 0.25)
function paintRidge(b, X1) {
  const top = x => 168 + 12 * Math.sin(x / 97 + 1) + 7 * Math.sin(x / 41) + 6 * fbm(x / 17, 61) + 3 * fbm(x / 5, 62) - 14 * ss(0, 1, Math.sin(x / 150 + 2));
  for (let x = -10; x < X1; x++) {
    const t = Math.round(top(x)), jungle = Math.sin(x / 150 + 2) > 0;
    for (let y = t; y < H; y++) {
      const n = vn2(x / 2.6, y / 2.2, 63);
      let c = jungle ? (n > 0.62 ? '#2a1f27' : n > 0.35 ? '#211922' : '#1a131c') : (n > 0.6 ? '#30222a' : '#261b23');
      if (y === t) c = jungle ? '#6a3038' : '#6a3036'; else if (y === t + 1 && n > 0.5) c = '#40242f';
      put(b, x, y, I(c));
    }
  }
  const C = I('#170f19');
  for (let x = 4, i = 0; x < X1; x += 14 + Math.round(h2(i, 1, 64) * 40), i++) {
    if (Math.sin(x / 150 + 2) < 0.15 && h2(i, 2, 64) > 0.25) continue;
    spalm(b, x, Math.round(top(x)) + 3, 15 + Math.round(h2(i, 3, 64) * 11), (h2(i, 4, 64) - 0.5) * 1.8, i + 1, C);
  }
}
// the basalt cliff wall (p 0.55): fanned thin columns on top (the entablature), thick regular columns below, hazy with
// heat, glowing orange at its foot; lava falls pour from notches. FALLS_L: [x0, x1, lip y]
const FALLS_L = [[396, 411, 155], [946, 960, 160], [1392, 1408, 150]];
function wallTopAt(x) {
  let top = 181 + 9 * fbm(x / 40, 70) + 5 * (fbm(x / 9, 73) - 0.5);
  for (const [x0, x1, lip] of FALLS_L) { const fc = (x0 + x1) / 2; top = lerp(top, lip - 18 + 7 * fbm(x / 11, 74) + Math.abs(x - fc) * 0.12, 1 - ss(34, 64, Math.abs(x - fc))); }
  top -= 22 * ss(0.55, 1, Math.sin(x / 210 + 0.6)) * (0.6 + 0.4 * fbm(x / 31, 78));   // taller stretches of cliff
  return top;
}
function paintWall(b, X1) {
  for (let x = -14, i = 0; x < X1 + 14; i++) {
    const w = 7 + Math.round(h2(i, 1, 71) * 5), c = x + w / 2, a = Math.max(2, Math.round(w * 0.32));
    let top = Math.round(wallTopAt(c) + (h2(i, 2, 71) - 0.5) * 7);
    let fall = null;
    for (const f of FALLS_L) if (c >= f[0] - 4 && c <= f[1] + 4) fall = f;
    if (fall) top = fall[2] + 1;
    const tier = top + 14 + Math.round(fbm(c / 23, 76) * 10);
    const joints = new Set();
    for (let j = tier + 6 + Math.round(h2(i, 6, 71) * 10); j < 240; j += 11 + Math.round(h2(i, j, 72) * 13)) joints.add(j);
    for (let X = x; X < x + w; X++) {
      const lx = X - x, tilt = (fbm(X / 17, 77) - 0.5) * 1.7;
      for (let Y = top - 1; Y < 228; Y++) {
        let col;
        if (Y < top + 1) col = Y === top - 1 ? '#86566e' : '#66425a';
        else if (Y < tier) {
          const xx = X + (Y - top) * tilt * 0.4, k = Math.floor(xx / 3.4), f = xx / 3.4 - k;
          col = f < 0.24 ? '#20111c' : (k & 1) ? '#3c2335' : '#342030';
          if (Y < top + 3 && f >= 0.24) col = '#4a2c40';
          if (nz(X + 4096, Y + 78) > 0.92) col = '#26141f';
        } else if (Y === tier) col = '#1c0f18';
        else {
          col = lx < a ? '#4e2e44' : '#3e2438';
          if (lx === a) col = '#5c3a50';
          if (lx === 0) col = '#24121f';
          if (joints.has(Y)) col = '#22111d'; else if (joints.has(Y - 1) && lx < a) col = '#603e54';
        }
        let v = I(col);
        const gl = Math.pow(ss(178, 228, Y), 1.3) * 0.9;
        if (gl > 0) v = mixI(v, I(lx < a ? '#d8602a' : '#a8401c'), gl);
        for (const [f0, f1, lip] of FALLS_L) {
          const df = Math.min(Math.abs(X - f0), Math.abs(X - f1)), inF = X >= f0 && X <= f1;
          if (!inF && df < 26 && Y > lip - 6) v = mixI(v, I('#e86a2c'), Math.pow(1 - df / 26, 2) * 0.85 * (0.55 + 0.45 * ss(lip, 226, Y)));
        }
        put(b, X, Y, v);
      }
    }
    x += w;
  }
  // scrub clinging to the cliff top
  for (let x = -10; x < X1 + 10; x++) {
    if (fbm(x / 13, 79) < 0.55 || FALLS_L.some(([f0, f1]) => x > f0 - 8 && x < f1 + 8)) continue;
    let top = 130; while (top < 228 && get(b, x, top) === NONE) top++;
    const hgt = Math.round((fbm(x / 13, 79) - 0.55) * 18 + h2(x, 1, 80) * 2);
    for (let k = 1; k <= hgt; k++) put(b, x, top - k, I(k === hgt ? '#3a2a30' : '#1e1a1e'));
  }
  hazeB(b, I('#7a3448'), () => 0.1);
  // the far edge of the river under the wall (molten, behind the world's banks and rivers)
  for (let X = -10; X < X1 + 10; X++) for (let Y = 226; Y < H; Y++) {
    const n = jfbm(X / 9, Y / 1.5, 77, 2) + (Y - 226) * 0.012;
    put(b, X, Y, I(Y === 226 ? '#ff9a3a' : n > 0.62 ? '#ffd23f' : n > 0.45 ? '#ffa02a' : n > 0.3 ? '#ff7a1a' : '#d84a1a'));
  }
}
// a lava fall (live): streaks sliding down, lava curling over the lip, a splash and steam at the foot
function lavaFall(g, f, ox) {
  const x0 = f[0] + ox, x1 = f[1] + ox, y0 = f[2], y1 = 228;
  if (x1 < -30 || x0 > W + 30) return;
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5;
  g.drawImage(ART.fallGlow, Math.round((x0 + x1) / 2) - 30, y0 - 6);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  for (let y = y0; y < y1; y++) {
    const spread = Math.round(ss(y0 + 30, y1, y) * 2);
    const L = x0 - spread + Math.round(Math.sin(y * 0.21 + G.t * 0.08) * 0.6), Rr = x1 + spread;
    for (let x = L; x <= Rr; x++) {
      const k = (x - L) / (Rr - L), e = Math.min(k, 1 - k), sp = 2.1 + hsh(x * 3.3) * 1.3, ph = hsh(x * 7.1) * 40, len = 17 + Math.round(hsh(x * 2.9) * 10);
      const s2 = ((y - G.t * sp + ph) % len + len) % len;
      let c = e < 0.06 ? '#a8301a' : e < 0.16 ? '#ff7a1a' : e < 0.3 ? '#ffa52a' : '#ffd23f';
      if (s2 < 2 && e > 0.1) c = '#fff1a0';
      else if (s2 > len - 4 && s2 < len - 2 && e > 0.12) c = '#e0501a';
      g.fillStyle = c; g.fillRect(x, y, 1, 1);
    }
  }
  const mid = (x0 + x1) / 2, hw = (x1 - x0) / 2 + 1.5;
  for (let x = Math.floor(mid - hw); x <= Math.ceil(mid + hw); x++) {
    const k = (x - mid) / hw, bul = Math.round(2.4 * (1 - k * k));
    for (let j = 0; j <= bul + 1; j++) {
      const y = y0 + 1 - j, tp = j === bul + 1;
      g.fillStyle = tp ? (Math.abs(k) > 0.8 ? '#c8401a' : '#ff8a2a') : j === bul ? (Math.abs(k) < 0.6 ? '#fff1a0' : '#ffd23f') : Math.abs(k) > 0.85 ? '#c8401a' : j > bul - 2 ? '#ffd23f' : '#ffa52a';
      g.fillRect(x, y, 1, 1);
    }
  }
  for (const [tx, ty0, sd] of [[x0 - 7, y0 + 10, 1], [x1 + 9, y0 + 30, 3]]) {
    for (let y = ty0; y < 226; y++) {
      const X = tx + Math.round(Math.sin(y * 0.13 + sd) * 1.2), ph = ((y - G.t * 1.6 + sd * 13) % 11 + 11) % 11;
      g.fillStyle = ph < 1.2 ? '#ffc23a' : '#b8401a'; g.fillRect(X, y, 1, 1);
    }
  }
  const fx = (x0 + x1) / 2;
  g.fillStyle = '#ff8a2a'; g.fillRect(fx - 16, 223, 33, 7);
  g.fillStyle = '#ffd23f'; g.fillRect(fx - 13, 222, 27, 5); g.fillRect(fx - 18, 227, 37, 2);
  g.fillStyle = '#fff1a0'; g.fillRect(fx - 9, 222, 19, 3); g.fillRect(fx - 4, 220, 9, 2);
  for (let i = 0; i < 20; i++) {
    const ph = (G.t * 0.03 + hsh(i * 4.1)) % 1, a = -Math.PI / 2 + (hsh(i * 2.3) - 0.5) * 2.6, v = 0.9 + hsh(i * 6.7) * 1.1, T = ph * 22;
    const x = Math.round(fx + Math.cos(a) * v * T), y = Math.round(222 + Math.sin(a) * v * T + 0.08 * T * T);
    if (y > 228) continue;
    g.fillStyle = ph < 0.4 ? '#fff1a0' : ph < 0.7 ? '#ffb52e' : '#e0501a'; g.fillRect(x, y, 1, ph < 0.3 ? 2 : 1);
  }
  for (let i = 0; i < 8; i++) {
    const ph = (G.t * 0.006 + i / 8) % 1, x = Math.round(fx - 9 + hsh(i * 3.9) * 18 + ph * 12), y = Math.round(219 - ph * 52), r = 2 + ph * 7;
    g.globalAlpha = 0.5 * (1 - ph);
    g.fillStyle = '#7a5a66'; pdisc(g, x, y, r);
    g.fillStyle = '#b07a80'; pdisc(g, x - 1, y - 1, r * 0.55);
  }
  g.globalAlpha = 1;
}
function lavaLayers(g, cx, hz) {
  const L = LAY.lava;
  blit(g, L.ridge, cx); if (hz) hz(g, 0);
  blit(g, L.wall, cx);
  const wo = offOf(L.wall, cx);
  for (const f of FALLS_L) lavaFall(g, f, -wo);
  if (hz) hz(g, 1);
  g.drawImage(ART.heatL, 0, 0, 1, H + 20, -10, -10, W + 20, H + 20);
  if (hz) hz(g, 2);
}

// ============================================================
// THE CRATER (night): a smoky red sky with a few stars; the far crater wall across the lava lake with the robots'
// blast door; tall basalt walls glowing in their joints with lava falls, a catwalk with warning lamps and a pipe on
// the left, a crane arm on the right; everything lit from below by the lake.
// ============================================================
const SKY_CRATER = [[-10, '#0b0409'], [60, '#1c0911'], [120, '#371015'], [170, '#601b18'], [230, '#7a2619']];
const CSKY = PI('#0b0409', '#13060d', '#1c0911', '#280c13', '#371015', '#4a1517', '#601b18', '#7a2619');
const CSMOKE = PI('#1a080e', '#260b11', '#371015', '#4c1818', '#66221a', '#83311c', '#a3451f');
const BAS = PI('#09070b', '#120e13', '#1c151b', '#2a1e24', '#3d2a2b', '#5e3328', '#93452a', '#cf6a31');
const L1C = '#701708', L2C = '#b02b0b', L4C = '#ff8519', L5C = '#ffb534', L6C = '#ffe063';
const SHORE = 199, BOSSX = 5720;                       // the far wall meets the lake; the boss arena's camera
// basalt cliff texture: stacked column blocks, each flat-shaded (lit from below), dark joints with a lit lip, cross
// fractures, a warm rim on a wall's inner edge
function basalt(x, y, sd, lit, edgeD) {
  const xs = x + sd * 5, cw = 9 + Math.floor(hsh(sd + Math.floor(xs / 11)) * 4);
  const cx = Math.floor(xs / cw), off = Math.floor(hsh(cx * 1.3 + sd) * 23), sh = 12 + Math.floor(hsh(cx * 2.1 + sd) * 12);
  const row = Math.floor((y + off) / sh), yc = row * sh - off + sh / 2;
  let t = 0.17 + hsh(cx * 2.9 + sd) * 0.1 + hsh(cx * 5.1 + row * 1.7) * 0.07 + lit(yc);
  const jx = Math.floor(xs) - cx * cw, jy = Math.floor(y + off) - row * sh;
  if (jx === 0) t -= 0.14; else if (jx === 1) t += 0.06;
  if (jy === 0) t -= 0.1; else if (jy === 1) t += 0.05;
  if (edgeD < 2.5) t += 0.2 * ss(30, 190, y);
  return flat(BAS, t);
}
// the smoky night sky (p 0.02): billows lit from below, thinning out at the top where a few stars show
function paintCraterSky(b, X1) {
  const w = X1 + 10, D = new Float32Array(w * 248);
  for (let y = -10; y < 238; y++) for (let x = -10; x < X1; x++) D[(y + 10) * w + x + 10] = jfbm(x / 40 + 7, y / 16, 2, 3);
  for (let y = -10; y < 232; y++) {
    const t = ss(-10, 170, y), pc = 316 + (150 - y) * 0.6, py = ss(10, 130, y), lift = ss(70, 130, y) * 0.12 - ss(70, 0, y) * 0.3;
    for (let x = -10; x < X1; x++) {
      const d0 = D[(y + 10) * w + x + 10], d = d0 + Math.exp(-(((x - pc) / 64) ** 2)) * py * 0.3 + lift;
      if (d < 0.5) { put(b, x, y, ramp(CSKY, t * 0.95, x + 10, y + 10)); continue; }
      const under = clamp((d0 - D[(y + 15) * w + x + 10]) * 6, -0.3, 0.3);
      put(b, x, y, ramp(CSMOKE, ss(0, 175, y) * 0.8 + (d - 0.5) * 0.7 + under, x + 10, y + 10));
    }
  }
  for (const [x, y, s] of [[260, 7, 2], [278, 21, 1], [307, 5, 1], [334, 26, 1], [357, 11, 2], [382, 24, 1], [249, 30, 1], [318, 15, 1], [297, 32, 1], [222, 22, 1], [120, 12, 1], [160, 30, 2], [430, 9, 1], [470, 28, 1]]) {
    put(b, x, y, I('#fff1c9'));
    if (s > 1) for (const [a2, b2] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(b, x + a2, y + b2, I('#b07a68'));
  }
}
// the far crater wall across the lake (p 0.12), the blast door at the shore, glowing cracks
const farRim = x => 126 + 9 * (fbm(x / 26, 61, 3) - 0.5) * 2 - 6 * Math.sin(x * 0.021) + (hsh(Math.floor(x / 5) * 3.1) > 0.82 ? -3 : 0);
const DOORX = 136 + Math.round((BOSSX - 4900) * 0.12);
function crack(b, x0, y0, n, sd, list) {
  let x = x0, y = y0;
  for (let i = 0; i < n; i++) {
    const len = 7 + Math.floor(hsh(sd + i * 3.7) * 12);
    if (list) list.push([x, y + len / 2, len]);
    for (let k = 0; k < len; k++) { put(b, x, y + k, I(k % 6 === 3 ? L6C : L5C)); put(b, x + 1, y + k, I(L2C)); put(b, x - 1, y + k, BAS[0]); }
    const dx = hsh(sd + i * 9.1) > 0.5 ? 1 : -1, jog = 2 + Math.floor(hsh(sd + i) * 3);
    for (let k = 1; k <= jog; k++) { put(b, x + dx * k, y + len, I(L4C)); put(b, x + dx * k, y + len + 1, I(L1C)); }
    x += dx * jog; y += len + 1;
  }
}
const CRACKS_FAR = [], SEEPS = [[78, 0.7], [292, 1], [452, 0.8], [548, 0.6]], BASE_LIGHTS = [];
const farRim2 = x => 112 + 7 * (fbm(x / 34, 64, 3) - 0.5) * 2 - 5 * Math.sin(x * 0.017 + 2) + (hsh(Math.floor(x / 7) * 1.7) > 0.86 ? -2 : 0);
function paintCraterFar(b, X1) {
  // the crater's far side, further away and hazier, curving round behind the far wall; robot base lights on it
  for (let x = -10; x < X1; x++) {
    const rim = Math.round(farRim2(x));
    for (let y = rim; y < 150; y++) {
      const k = ss(rim, 150, y), n = vn2(x / 5, y / 3, 66);
      let c = mixC('#3a1a1e', '#6e2a20', k * 0.8 + (n - 0.5) * 0.2);
      if (y === rim) c = I('#8a3a2c');
      put(b, x, y, c);
    }
  }
  BASE_LIGHTS.length = 0;
  for (let i = 0; i < 9; i++) { const x = Math.round(20 + i * 67 + hsh(i * 3.3) * 30); if (x < X1) { const y = Math.round(farRim2(x) + 6 + hsh(i * 5.1) * 12); put(b, x, y, I('#ffcf6a')); put(b, x + 1, y, I('#c88a3a')); BASE_LIGHTS.push([x, y]); } }
  for (let x = -10; x < X1; x++) {
    const rim = farRim(x);
    for (let y = Math.ceil(rim); y < SHORE + 2; y++) put(b, x, y, basalt(x, y, 3, yc => ss(rim + 6, SHORE + 4, yc) * 0.62, y - rim < 1.5 ? 0 : 9));
    // the rim catches the red glow of the smoke
    const ry = Math.ceil(rim);
    if (get(b, x, ry) !== NONE) put(b, x, ry, mixI(get(b, x, ry), I('#c8542a'), 0.5));
  }
  // lava seeping down the far wall to the shore, a pool of light where it meets the lake
  for (const [sx, k] of SEEPS) {
    if (sx > X1) continue;
    let x = sx;
    for (let y = Math.ceil(farRim(sx)) + 6; y < SHORE + 1; y++) {
      if (hsh(y * 0.37 + sx) > 0.86) x += hsh(y + sx) > 0.5 ? 1 : -1;
      put(b, x, y, I(y % 7 === 3 ? L6C : L5C)); put(b, x + 1, y, I(k > 0.75 ? L4C : L2C)); put(b, x - 1, y, mixI(get(b, x - 1, y), I(L2C), 0.5));
    }
    for (let dx = -5; dx <= 5; dx++) put(b, x + dx, SHORE - Math.round(Math.max(0, 2 - Math.abs(dx) * 0.5)), I(Math.abs(dx) < 2 ? L6C : L4C));
  }
  // the lava lake reaches across to the far wall: crusted plates in perspective, bright cracks, the shore glowing
  for (let y = SHORE + 1; y < 246; y++) {
    const dz = (y - SHORE) / 46;
    for (let x = -10; x < X1; x++) {
      const n = jfbm(x / (14 + dz * 22), y / (1.2 + dz * 2.6), 81, 2), crk = Math.abs(jfbm(x / (9 + dz * 14), y / (0.9 + dz * 2), 83, 2) - 0.5);
      let c = n > 0.5 ? '#2e0a06' : n > 0.42 ? '#3d0d07' : n > 0.36 ? '#5a1408' : '#8a2209';
      if (crk < 0.022 + dz * 0.016) c = n > 0.46 ? '#b02b0b' : '#e44f10';
      if (y <= SHORE + 2) c = y === SHORE + 1 ? '#ffb534' : '#c83a0e';
      put(b, x, y, mixI(I(c), I('#4a1a18'), 0.3 * (1 - dz)));
    }
  }
  CRACKS_FAR.length = 0;
  for (const [x, y, n, sd] of [[DOORX + 7, 160, 2, 4], [60, 150, 2, 7], [420, 146, 3, 8], [560, 156, 2, 9]]) if (x < X1) crack(b, x, y, n, sd, CRACKS_FAR);
  // the blast door: a dark arch in the rock, a steel frame with a hazard-striped lintel, two panels with slit
  // windows, light leaking under it, a red lamp above
  const ST = PI('#20242c', '#2f353f', '#454d59', '#5f6875', '#808a98'), DX = DOORX, DY = 177, DW = 16, DH = 22, OI = I(OUT);
  poly(b, [[DX - 5, SHORE], [DX - 5, DY - 4], [DX - 1, DY - 9], [DX + DW + 1, DY - 9], [DX + DW + 5, DY - 4], [DX + DW + 5, SHORE]], BAS[0]);
  rect(b, DX - 2, DY - 5, DW + 4, DH + 5, OI);
  rect(b, DX - 1, DY - 4, DW + 2, DH + 4, ST[2]);
  for (let x = DX - 1; x < DX + DW + 1; x++) for (let y = DY - 4; y < DY - 1; y++) put(b, x, y, ((x + y) >> 1) % 2 ? I('#e8b830') : I('#2a2620'));
  rect(b, DX + 1, DY, DW - 2, DH - 1, ST[1]); rect(b, DX + DW / 2 - 1, DY, 1, DH - 1, OI);
  for (const x of [DX + 3, DX + DW / 2 + 2]) { rect(b, x, DY + 5, 3, 2, I('#ffcf6a')); rect(b, x, DY + 5, 3, 1, I('#fff2b0')); rect(b, x, DY + 12, 3, 1, ST[3]); }
  rect(b, DX + 1, DY + DH - 1, DW - 2, 1, I('#ffd070'));
  rect(b, DX + DW / 2 - 2, DY - 8, 3, 3, ST[1]); put(b, DX + DW / 2 - 1, DY - 8, I('#5a1a1a'));
  // a second, smaller hatch further along, with a lit window
  rect(b, 470, 184, 10, 15, OI); rect(b, 471, 185, 8, 14, ST[1]); rect(b, 473, 188, 4, 2, I('#ffcf6a'));
}
// the side walls (p 0.35): in design x at camera 4900. At the boss camera the left wall stands at screen 98..125 and
// the right wall from 416..456, as in the proposal; before that a broken wall of column stacks with smoke above.
const COFF = Math.round((BOSSX - 4900) * 0.35);
const leftEdge = y => COFF + 98 + 8 * Math.sin(y * 0.06) + 9 * (fbm(y / 16, 71, 3) - 0.5) * 2 + ss(120, 200, y) * 18 - ss(40, 0, y) * 10;
const rightEdge = y => COFF + 416 + 8 * Math.sin(y * 0.05 + 1.3) + 9 * (fbm(y / 15, 72, 3) - 0.5) * 2 + ss(70, 200, y) * 40;
const lowWall = x => 64 + 46 * (0.5 + 0.5 * Math.sin(x / 47 + 1)) + 26 * fbm(x / 23, 73, 3) - 150 * ss(COFF - 130, COFF - 10, x);
const FALLS_C = [{ x: COFF + 31, y0: 58, y1: 186, w: 7 }, { x: COFF + 457, y0: 46, y1: 152, w: 7 }, { x: 120, y0: 104, y1: 190, w: 6 }];
const BLINK = [[COFF + 12, 89], [COFF + 57, 89], [COFF + 416, 36], [40, 96]];
const CRACKS_C = [];
function paintCraterWalls(b, X1) {
  const LW = new Float32Array(X1 + 20);
  for (let x = -10; x < X1 + 10; x++) LW[x + 10] = lowWall(x);
  for (let y = -10; y < 216; y++) {
    const le = leftEdge(y), re = rightEdge(y);
    for (let x = -10; x < X1; x++) {
      const lw = LW[x + 10], right = x > re;
      if (!right && !(x < le && y > lw)) continue;
      const ed = right ? x - re : Math.min(le - x, y - lw);
      put(b, x, y, basalt(x, y, right ? 23 : 11, yc => ss(70, 215, yc) * 0.55 * (1 - ss(10, 80, Math.abs(ed)) * 0.45), ed));
    }
  }
  CRACKS_C.length = 0;
  for (const [x, y, n, sd] of [[COFF + 12, 98, 4, 1], [COFF + 66, 44, 3, 2], [COFF + 87, 132, 2, 3], [COFF + 443, 66, 3, 5], [COFF + 471, 110, 3, 6], [30, 130, 3, 11], [200, 120, 3, 12], [262, 70, 4, 13]]) crack(b, x, y, n, sd, CRACKS_C);
  for (const f of FALLS_C) {
    for (let y = -6; y <= 6; y++) for (let x = -f.w; x <= f.w; x++) if ((x / (f.w * 0.95)) ** 2 + (y / 5) ** 2 <= 1) put(b, f.x + x, f.y0 - 1 + y, BAS[0]);
    for (let y = -3; y <= 3; y++) for (let x = -f.w; x <= f.w; x++) if ((x / (f.w * 0.75)) ** 2 + (y / 3) ** 2 <= 1) put(b, f.x + x, f.y0 + y, I(L2C));
    for (let y = f.y0; y < f.y1; y++) {
      const gg = (y - f.y0) / (f.y1 - f.y0), w = Math.round(f.w + gg * 3), wob = Math.round(Math.sin(y * 0.13 + f.x) * 0.8);
      for (let i = 0; i < w; i++) {
        const k = i / (w - 1), core = 1 - Math.abs(k * 2 - 1), streak = (hsh(Math.floor(y / 4 + i * 0.5) * 1.3 + i * 7.7) - 0.5) * 0.35;
        put(b, f.x - (w >> 1) + i + wob, y, flat(PI(L1C, L2C, '#e44f10', L4C, L5C, L6C, '#fff7cc'), core * 0.95 + streak - gg * 0.1));
      }
      put(b, f.x - (w >> 1) - 1 + wob, y, BAS[1]); put(b, f.x - (w >> 1) + w + wob, y, BAS[2]);
    }
  }
  // the robots' base: a catwalk with warning lamps and a pipe down the left wall, a crane arm on the right wall
  const ST = PI('#20242c', '#2f353f', '#454d59', '#5f6875', '#808a98'), HOT = I('#9a5236'), OI = I(OUT), o = COFF;
  for (let x = o - 10; x <= o + 64; x++) {
    put(b, x, 99, ST[4]); put(b, x, 100, ST[2]); put(b, x, 101, x % 3 ? ST[1] : ST[0]); put(b, x, 102, HOT);
    put(b, x, 93, ST[3]); put(b, x, 96, ST[1]);
    if ((x + 10) % 9 === 0 || x === o + 64) for (let y = 93; y < 99; y++) put(b, x, y, ST[2]);
  }
  for (let x = o - 10; x <= o + 65; x++) { put(b, x, 92, OI); put(b, x, 103, OI); }
  for (const sx of [o + 14, o + 46]) for (let k = 0; k < 11; k++) put(b, sx - Math.round(k * 0.8), 103 + k, k > 7 ? HOT : ST[1]);
  for (const [lx, ly] of BLINK.slice(0, 2)) { rect(b, lx - 1, ly + 1, 3, 3, ST[1]); rect(b, lx - 1, ly - 1, 3, 2, I('#5a1a1a')); }
  for (let y = 103; y < 176; y++) {
    const w = ss(130, 176, y);
    [ST[0], ST[2], ST[4], ST[2]].forEach((c, i) => put(b, o + 58 + i, y, w > 0.5 && i > 0 ? (i === 2 ? I('#d08a5a') : HOT) : c));
    if ((y - 103) % 18 === 0) { rect(b, o + 57, y, 6, 2, ST[3]); put(b, o + 57, y, ST[4]); }
    put(b, o + 57, y, OI); put(b, o + 62, y, OI);
  }
  for (let x = o + 416; x <= o + 500; x++) {
    put(b, x, 37, ST[3]); put(b, x, 38, ST[1]); put(b, x, 44, ST[2]); put(b, x, 45, ST[0]);
    const k = (x - o - 416) % 8, y = k < 4 ? 39 + k * 1.25 : 44 - (k - 4) * 1.25;
    put(b, x, Math.round(y), ST[2]);
    put(b, x, 36, OI); put(b, x, 46, OI);
  }
  rect(b, o + 421, 46, 7, 3, ST[2]); rect(b, o + 421, 46, 7, 1, ST[4]);
  for (let y = 49; y < 74; y++) put(b, o + 424, y, y % 2 ? ST[1] : ST[3]);
  for (const [x, y, c] of [[423, 74, 4], [424, 74, 4], [425, 74, 4], [426, 75, 3], [426, 76, 3], [426, 77, 3], [425, 78, 2], [424, 78, 2], [423, 77, 2]]) put(b, o + x, y, ST[c]);
  rect(b, o + 415, 34, 3, 2, I('#5a1a1a'));
  // on the broken wall before the arena: a lamp post and a girder with a warning lamp
  rect(b, 38, 98, 5, 2, ST[3]); rect(b, 39, 100, 3, 30, ST[1]); put(b, 39, 100, ST[3]); rect(b, 39, 96, 3, 2, I('#5a1a1a'));
}
function glowAt(g, x, y, r, a) {
  const s = ART.glows[Math.min(ART.glows.length - 1, Math.max(0, Math.round(r / 4) - 1))];
  g.globalAlpha = a; g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
}
function craterDeco(g, cx, a) {
  if (a <= 0.01) return;
  g.globalAlpha = a;
  blit(g, LAY.crater.sky, cx);
  // the smoke rolls slowly over the crater
  band(g, ART.smokeC, cx * 0.05 + G.t * 0.05, 40); g.globalAlpha = a * 0.7; band(g, ART.smokeC2, cx * 0.08 + G.t * 0.08, 96);
  g.globalAlpha = 1;
}
function craterLayers(g, cx, hz) {
  const L = LAY.crater, fo = offOf(L.far, cx), wo = offOf(L.walls, cx);
  blit(g, L.far, cx);
  g.globalCompositeOperation = 'lighter';
  for (const [x, y, n] of CRACKS_FAR) glowAt(g, x - fo, y, 5 + n * 0.4, 0.2 + 0.08 * Math.sin(G.t * 0.05 + x));
  for (const [x, y] of SEEPS.map(([sx]) => [sx, SHORE - 2])) glowAt(g, x - fo, y, 12, 0.22 + 0.06 * Math.sin(G.t * 0.06 + x));
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  if ((G.t % 70) < 40) { g.fillStyle = EVIL; g.fillRect(DOORX + 7 - fo, 168, 2, 2); }
  BASE_LIGHTS.forEach(([x, y], i) => { if ((G.t + i * 37) % 160 < 8) { g.fillStyle = '#fff2b0'; g.fillRect(x - fo, y, 2, 1); } });
  if (hz) hz(g, 0);
  blit(g, L.walls, cx);
  g.globalCompositeOperation = 'lighter';
  for (const f of FALLS_C) for (let y = f.y0; y < f.y1; y += 14) glowAt(g, f.x - wo, y + 7, 15, 0.17);
  for (const [x, y, n] of CRACKS_C) glowAt(g, x - wo, y, 5 + n * 0.4, 0.15 + 0.08 * Math.sin(G.t * 0.04 + y));
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // the falls stream (a few bright streaks slide down each ribbon)
  for (const f of FALLS_C) {
    const x = f.x - wo;
    if (x < -12 || x > W + 12) continue;
    for (let i = 0; i < 3; i++) {
      const y = f.y0 + wrap(G.t * (1.4 + i * 0.3) + i * 37, f.y1 - f.y0 - 6);
      g.fillStyle = '#fff7cc'; g.fillRect(x - 1 + i, Math.round(y), 1, 4);
    }
  }
  BLINK.forEach(([x, y], i) => {
    if ((G.t + i * 23) % 50 >= 30) return;
    const sx = x - wo;
    g.fillStyle = EVIL; g.fillRect(sx - 1, y - 1, 3, 2); g.fillStyle = '#ffd0c8'; g.fillRect(sx, y - 1, 1, 1);
    g.globalCompositeOperation = 'lighter'; glowAt(g, sx, y, 9, 0.35); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  });
  if (hz) hz(g, 1);
  g.drawImage(ART.heatC, 0, 0, 1, H + 20, -10, -10, W + 20, H + 20);
  if (hz) hz(g, 2);
}
// a soft round glow (for the 'lighter' composite)
function glowSprite(r, col) {
  const c = canvasOf(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return c;
}
// a column canvas with per-row alpha
function alphaColumn(c, fa) {
  const b = canvasOf(1, H + 20), g = b.getContext('2d'), im = g.createImageData(1, H + 20), v = I(c);
  for (let y = -10; y < H + 10; y++) { const j = (y + 10) * 4; im.data[j] = v >> 16 & 255; im.data[j + 1] = v >> 8 & 255; im.data[j + 2] = v & 255; im.data[j + 3] = Math.round(255 * clamp(fa(y), 0, 1)); }
  g.putImageData(im, 0, 0);
  return b;
}

// ============================================================
// Building everything (once, the first time Mission 3 loads)
// ============================================================
let ART = null, LAY = null, built = 0, BUF = null, BUILD_MS = 0;
const STEPS = [];
function step(name, fn) { const t0 = Date.now(), v = fn(); STEPS.push(name + ' ' + (Date.now() - t0)); return v; }
function build() {
  const t0 = Date.now();
  STEPS.length = 0;
  makeNZT();
  ART = {}; LAY = {};
  // the bay
  step('bay sky', () => {
    ART.skyB = skyColumn(SKY_BAY);
    ART.sun = sunCanvas(); ART.rays = [rayCanvas(1), rayCanvas(2)];
    ART.cloudsB = CL_BAY.map(([w], i) => cloudCanvas(w, i + 1, ['#ecbcae', '#fbe3d4', '#fff8ef'], -1));
  });
  step('volcanoes', () => { ART.volB = paintVolcano('bay'); ART.volJ = paintVolcano('jungle'); });
  step('plumes', () => { ART.plumeB = plumeCanvas(SKY_BAY, '#f2b898'); ART.plumeJ = plumeCanvas(SKY_JUNGLE, '#f2c0a0'); });
  let S = SCN.bay;
  LAY.bay = {};
  step('bay stacks', () => { LAY.bay.stacks = strip(S, 0.03, 96, HZ + 1, paintStacks); });
  step('bay sea', () => { LAY.bay.sea = strip(S, 0.06, HZ, 176, paintBay); });
  step('bay lagoon', () => { LAY.bay.lagoon = strip(S, 0.3, 164, H, paintLagoon); });
  step('bay spit', () => { LAY.bay.spit = strip(S, 0.18, 30, 186, paintSpit); });
  // the jungle
  step('jungle sky', () => {
    ART.skyJ = skyColumn(SKY_JUNGLE);
    ART.glowJ = glowCanvas(270, '#fff8dc', 0.5);
    ART.cloudsJ = CL_JUNGLE.map(([w], i) => cloudCanvas(w, i + 11, ['#bcd2ea', '#e8f2fb', '#ffffff'], -1));
  });
  S = SCN.jungle;
  LAY.jungle = {};
  step('jungle far', () => { LAY.jungle.far = strip(S, 0.08, 104, H, paintFarJ); });
  step('jungle cliff', () => { LAY.jungle.cliff = strip(S, 0.2, 60, H, paintCliffJ); });
  step('jungle mid', () => { LAY.jungle.mid = strip(S, 0.35, 0, H, paintMidJ); });
  S = SCN.canopy;
  LAY.canopy = {};
  step('canopy', () => { LAY.canopy.near = strip(S, 0.6, 0, H, paintCanopy); });
  step('shafts', () => { LAY.canopy.shaft = { S, p: 0.6, top: 0, h: H, c: shaftCanvas(LAY.canopy.near.c.width) }; });
  // the lava rivers
  step('lava sky', () => {
    ART.skyL = skyColumn(SKY_LAVA); ART.dusk = duskCanvas();
    ART.heatL = alphaColumn('#ff7a30', y => ss(186, 236, y) * 0.4);
    ART.craterGlow = glowSprite(80, '#ff8a3a'); ART.eruptGlow = glowSprite(160, '#ff6a20'); ART.fallGlow = glowSprite(30, '#ff6a20');
  });
  step('lava volcano', () => { ART.volL = paintVolcanoNear(); ART.plumeL = paintPlumeNear(); });
  S = SCN.lava;
  LAY.lava = {};
  step('lava banks', () => { LAY.lava.banks = strip(S, 0.03, 70, 150, paintBanks); });
  step('lava ridge', () => { LAY.lava.ridge = strip(S, 0.25, 130, H, paintRidge); });
  step('lava wall', () => { LAY.lava.wall = strip(S, 0.55, 120, H, paintWall); });
  // the crater
  S = SCN.crater;
  LAY.crater = {};
  step('crater sky', () => {
    ART.skyC = skyColumn(SKY_CRATER);
    LAY.crater.sky = strip(S, 0.02, -10, 232, paintCraterSky);
    ART.smokeC = fogStrip(620, 70, 41, '#3a1418', 0.55); ART.smokeC2 = fogStrip(560, 60, 43, '#5a2018', 0.45);
    ART.heatC = alphaColumn('#ff5a1a', y => ss(150, 226, y) * 0.3);
    ART.glows = [4, 8, 12, 16].map(r => glowSprite(r, '#ff5a14'));
  });
  step('crater far', () => { LAY.crater.far = strip(S, 0.12, 92, 246, paintCraterFar); });
  step('crater walls', () => { LAY.crater.walls = strip(S, 0.35, -10, 216, paintCraterWalls); });
  step('mists', () => MISTS.forEach(mistArt));
  BUF = canvasOf(W + 20, H + 20);
  const bg = BUF.getContext('2d'); bg.imageSmoothingEnabled = false; bg.translate(10, 10);
  for (const k in LAY) for (const n in LAY[k]) LAY[k][n].b = null;   // the pixel buffers aren't needed any more
  BUILD_MS = Date.now() - t0;
}
function ready() {
  if (!built) {
    built = -1;
    try { build(); built = 1; } catch (err) { errorOnce(err); }
  }
  return built === 1;
}

// ============================================================
// Weather, eruption countdown, particles, overlay
// ============================================================
const WX = { ash: 0, steam: 0, night: 0, erupt: 0 };
function weatherNow() {
  if (!isM3()) { WX.ash = WX.steam = WX.night = WX.erupt = 0; return WX; }
  const x = G.cam.x;
  WX.ash = clamp(0.6 * ss(T2[0], T2[1], x) + 0.4 * ss(T3[0], T3[1], x), 0, 1);
  WX.steam = ss(T1[0], T1[1], x) * (1 - ss(T2[0], T2[1], x));
  WX.night = clamp(0.5 * ss(T2[0], T2[1], x) + 0.5 * ss(T3[0], T3[1], x), 0, 1);
  WX.erupt = clamp((L3.eruptT || 0) / 30, 0, 1);
  return WX;
}
L3.weather = function () { const w = weatherNow(); return { ash: w.ash, steam: w.steam, night: w.night, erupt: w.erupt }; };
// how much of each scene is showing (for the overlay's tints and particles)
function sceneW(x) {
  const a = ss(T1[0], T1[1], x), b = ss(T2[0], T2[1], x), c = ss(T3[0], T3[1], x);
  return [1 - a, a - b, b - c, c];
}
// Particles (world x, screen y) on the private random stream: ash flakes drifting down, embers rising off the lava,
// steam wisps curling up from the jungle floor and the hot-spring pond. Capped.
const parts = [];
const CAP = { ash: 36, ember: 28, steam: 18 };
const count = { ash: 0, ember: 0, steam: 0 };
let T = 0;
function lavaUnder(x) { if (L3.lavaAt) { const r = L3.lavaAt(x); if (r) return r.y; } return 0; }
function spawn(k, o) { if (count[k] >= CAP[k]) return; o.k = k; o.t = 0; parts.push(o); count[k]++; }
function stepParticles() {
  const cx = G.cam.x, w = WX, m3 = isM3();
  if (m3 && w.ash > 0.01) {
    if (rnd() < 0.22 * w.ash) spawn('ash', { x: cx + rr(-30, W + 90), y: -4, vx: rr(-0.45, -0.15), vy: rr(0.18, 0.42), life: 520, ph: rr(0, 6.3), c: rnd() < 0.5 ? 0 : 1 });
    const er = (0.22 + 0.7 * w.erupt) * w.ash;
    if (rnd() < er) {
      const x = cx + rr(0, W), ly = lavaUnder(x);
      if (ly || rnd() < 0.35) spawn('ember', { x, y: ly ? ly - 2 : H + 2, vx: rr(-0.25, 0.25), vy: rr(-1.0, -0.45), life: Math.round(rr(70, 170)), ph: rr(0, 6.3), c: 0 });
    }
  }
  if (m3 && w.steam > 0.01 && rnd() < 0.08 * w.steam) {
    const pond = LV.water && LV.water[1], nearPond = pond && pond.x1 > cx - 20 && pond.x0 < cx + W + 20 && rnd() < 0.75;
    const x = nearPond ? rr(pond.x0 + 6, pond.x1 - 6) : cx + rr(0, W);
    spawn('steam', { x, y: (nearPond ? pond.y : groundAt(x)) - rr(0, 6), vx: rr(0.05, 0.22), vy: -rr(0.12, 0.28), life: Math.round(rr(150, 260)), ph: rr(0, 6.3), c: 0 });
  }
  for (const p of parts) {
    p.t++;
    if (p.k === 'ash') { p.x += p.vx + Math.sin(p.ph + T * 0.04) * 0.25; p.y += p.vy + Math.sin(p.ph * 1.7 + T * 0.07) * 0.12; }
    else if (p.k === 'ember') { p.vy *= 0.992; p.x += p.vx + Math.sin(p.ph + T * 0.09) * 0.3; p.y += p.vy; }
    else { p.x += p.vx + Math.sin(p.ph + T * 0.03) * 0.15; p.y += p.vy; }
    if (p.t >= p.life || p.y > H + 6 || p.y < -10 || p.x < cx - 60 || p.x > cx + W + 120) p.dead = true;
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].dead) { count[parts[i].k]--; parts.splice(i, 1); }
}
L3.skyLoad = function (cp) {
  ready();
  seed = 0x3a7b11 + Math.round(cp || 0);
  parts.length = 0; count.ash = count.ember = count.steam = 0; T = 0;
  weatherNow();
  for (let i = 0; i < 240; i++) { T++; stepParticles(); }
};
L3.skyUpdate = function () {
  T++;
  if (L3.eruptT > 0) L3.eruptT--;
  weatherNow();
  stepParticles();
};

// ============================================================
// Overlay (screen space, after the world): light tints, spray glints, steam, ash and embers
// ============================================================
let TINT = null;
function tintArt() {
  TINT = {
    sun: (() => { const r = 300, c = canvasOf(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 10, r, r, r); gr.addColorStop(0, 'rgba(255,226,170,0.16)'); gr.addColorStop(1, 'rgba(255,226,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c; })(),
    dusk: alphaColumn('#ff7030', y => 0.03 + ss(150, 270, y) * 0.12),
    duskTop: alphaColumn('#2a1040', y => (1 - ss(-10, 90, y)) * 0.12),
    crater: alphaColumn('#ff4a18', y => ss(120, 270, y) * 0.14),
    craterTop: alphaColumn('#0a0206', y => (1 - ss(-10, 110, y)) * 0.3),
    flash: alphaColumn('#ff8a3a', () => 1)
  };
}
L3.drawOverlay = function (cx) {
  if (!ready()) return;
  if (!TINT) tintArt();
  const wx = weatherNow(), sw = sceneW(cx);
  // the bay: the warm morning light from the sun's side; glints of spray on the lagoon
  if (sw[0] > 0.01) {
    ctx.globalAlpha = sw[0]; ctx.drawImage(TINT.sun, sunX(cx) - 300, 64 - 300); ctx.globalAlpha = 1;
    const wr = LV.water && LV.water[0];
    if (wr) for (let i = 0; i < 16; i++) {
      const cyc = 23 + (i % 5) * 4, t = G.t + i * 17, life = t % cyc, gen = Math.floor(t / cyc);
      if (life > 4) continue;
      const x = Math.round(cx + hsh(i * 7.31 + gen * 1.37) * W), sx = x - cx;
      if (x < wr.x0 + 8 || x > wr.x1 - 8) continue;
      const y = wr.y + 1 + Math.round(hsh(i * 3.7 + gen) * 5);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * sw[0]).toFixed(2) + ')';
      ctx.fillRect(sx, y, life === 2 ? 2 : 1, 1);
      if (life === 2 && i % 3 === 0) { ctx.fillStyle = 'rgba(255,255,240,' + (0.5 * sw[0]).toFixed(2) + ')'; ctx.fillRect(sx - 1, y, 4, 1); ctx.fillRect(sx, y - 1, 1, 3); }
    }
  }
  // the jungle: the light shafts reach the front faintly, pollen drifts in them
  if (sw[1] > 0.01) {
    const L = LAY.canopy.shaft;
    ctx.globalAlpha = 0.16 * sw[1] * (0.8 + 0.2 * Math.sin(G.t * 0.017)); blit(ctx, L, cx); ctx.globalAlpha = 1;
    motes(ctx, cx, 10, 0.9, sw[1] * 0.8);
  }
  // dusk and the crater: lava light from below, the sky darkening above
  const dk = sw[2] + sw[3] * 0.3;
  if (dk > 0.01) { ctx.globalAlpha = dk; fillCol(ctx, TINT.dusk); fillCol(ctx, TINT.duskTop); ctx.globalAlpha = 1; }
  if (sw[3] > 0.01) { ctx.globalAlpha = sw[3]; fillCol(ctx, TINT.crater); fillCol(ctx, TINT.craterTop); ctx.globalAlpha = 1; }
  // the eruption: an orange flash over everything
  if (wx.erupt > 0.01 && dk > 0.01) { ctx.globalAlpha = 0.07 * wx.erupt * Math.min(1, dk); fillCol(ctx, TINT.flash); ctx.globalAlpha = 1; }
  // particles
  for (const p of parts) {
    const x = Math.round(p.x - cx), y = Math.round(p.y);
    if (x < -8 || x > W + 8) continue;
    const fade = Math.min(1, p.t / 20, (p.life - p.t) / 30);
    if (p.k === 'ash') {
      ctx.fillStyle = rgba(p.c ? '#d8ccca' : '#9a8c90', 0.85 * fade);
      const f = Math.floor(p.ph * 2 + T * 0.1) % 3;
      ctx.fillRect(x, y, f === 0 ? 2 : 1, f === 2 ? 2 : 1);
    } else if (p.k === 'ember') {
      const u = p.t / p.life, c = u < 0.25 ? '#fff1a0' : u < 0.55 ? '#ffb52e' : u < 0.8 ? '#ff6a1a' : '#a83a1a';
      const tw = Math.sin(p.ph * 3 + T * 0.4) > -0.6;
      if (!tw) continue;
      ctx.fillStyle = rgba(c, fade); ctx.fillRect(x, y, 1, 1);
      if (u < 0.3) { ctx.fillStyle = rgba('#ff8a2a', 0.35 * fade); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    } else {
      const u = p.t / p.life, r = 1.5 + u * 5, a = Math.sin(Math.PI * u), sw2 = Math.sin(p.ph + p.t * 0.05) * (1 + u * 3);
      ctx.fillStyle = rgba('#f4fbf6', 0.22 * a); pdisc(ctx, x + sw2, y, r); pdisc(ctx, x - sw2 * 0.6, y - r * 1.4, r * 0.8);
      ctx.fillStyle = rgba('#ffffff', 0.16 * a); pdisc(ctx, x + sw2 - r * 0.3, y - r * 0.3, r * 0.5);
    }
  }
};
L3.skyBuildMs = () => BUILD_MS;
L3.skyBuildSteps = () => STEPS.slice();
}
