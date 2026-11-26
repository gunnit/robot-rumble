'use strict';
// =====================================================================================================================
// Mission 5 (ALIEN MOTHERSHIP) AREA 2: STAR GARDEN, world x 1600-3300. Owner: garden. docs/level5-spec.md section 6.
// The glass bio-domes inside the mothership where the abducted cows are kept: space, the Moon and a ringed planet
// behind steel ribs, an alien garden that is never green (green belongs to the robots), a catwalk over a glowing
// nectar pond. Joined by level5_scenery.js:
//   L5ART.garden = { x0, x1, steps, bg(g, cx), behind(cx), ground(cx), plat(pl), front(cx), overlay(cx) }
//  bg (screen, into g): space (p .15: nebula, stars, the Moon, a ringed planet, a comet, a spiral galaxy; live: twinkle,
//                    far saucers ferrying cows, a shooting star), a ROW OF THREE GLASS DOMES (p .5: A a diamond
//                    lattice, B the proposal's meridians and ring beam, C a fan window) joined by two hull pylons (the
//                    GREENHOUSE LAB with its lit window, the NECTAR WORKS with its tank and the nectar fall) over the
//                    far base wall, the far garden (p .65, dark shapes backlit by garden lamps) and the groves (p .8:
//                    dandelion trees, spiral trees, the proposal's three bubble trees, a mushroom forest, lantern willows)
//  behind (world):   the raised planter behind the catwalk and what grows and stands on it: nursery racks (1654),
//                    tall star flowers, a cloche bench (2082), the proposal's screen (2200-2680: ferns, tulips, the COW
//                    PADDOCK behind its force-field fence at 2540-2638: three cows until L5.paddock.on goes false),
//                    the milking parlour (2916-3040), hay bales (3202); spouts feeding the pond, sprinklers, glow moths
//  ground (world):   the steel catwalk (y 232) over the pond; the three nectar gaps (surface y 240, the hero wades on
//                    the bed at y 250, a ramp at each end); the solid ramp up to the airlock (3240-3300)
//  plat (world):     the mushroom caps: m1 orange, m2 pink (bouncy: it squashes when the hero bounces, small arrows
//                    over it), in steel pots on the deck or standing in the nectar
//  front (screen):   the nectar's front layer (a wading hero looks knee-deep), dark fiddleheads low at the bottom
//                    (world-anchored, never over a gap)
//  overlay (screen): drifting spores and star seeds
// The proposal's screen is camera 2200: every parallax strip is painted in u = "screen x at camera 2200"; at camera cx
// a strip of parallax p is drawn at u - (cx - 2200) * p. Static art is painted pixel by pixel into Int32 buffers and
// baked in `steps` (44 of them, none over ~30 ms in the harness); glows that never change are baked in too. Only small
// loops driven by G.t move. Deterministic: no Math.random / rand (a private mulberry32 table, hsh and G.t). bg draws
// with g only. Other files' names (M5.cow, L5.paddock, L5ART.level / groundAt) are used at call time, never at load.
// =====================================================================================================================
var L5ART = L5ART || {};
{
const Math = globalThis.Math;
const VW = W, VH = H;
const A0 = 1600, A1 = 3300;                      // the area (world x)
const CAM = 2200;                                // the proposal's camera
const CAM0 = 1200, CAM1 = 3220;                  // cameras the backdrop is painted for (bg is called for 1210..3210)
const DECK = 232, TER = 204;                     // the catwalk; the top of the raised planter behind it
const SURF = 240, BED = 250;                     // nectar: its surface, the bed the hero wades on
const PAD = { x0: 2540, x1: 2638 };              // the cow paddock on the planter
const NECTAR_DEF = [{ x0: 1956, x1: 2056, y: 240 }, { x0: 2756, x1: 2896, y: 240 }, { x0: 3056, x1: 3136, y: 240 }];
const nectarList = () => { const L = L5ART.level && L5ART.level(); return (L && L.nectar) || NECTAR_DEF; };
const gAt = x => L5ART.groundAt ? L5ART.groundAt(x) : DECK;

// ------------------------------------------------------------ noise, colour and dither helpers
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
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
const NZT = (() => { const r = rng(55021), a = new Float32Array(65536); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
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
const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
const hexOf = v => '#' + v.toString(16).padStart(6, '0');
const Pc = (...s) => s.map(I);
function mixI(a, b, k) {
  k = clamp(k, 0, 1);
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  return Math.round(ar + ((b >> 16 & 255) - ar) * k) << 16 | Math.round(ag + ((b >> 8 & 255) - ag) * k) << 8 | Math.round(ab + ((b & 255) - ab) * k);
}
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
// a colour from a ramp (dark -> light) at v 0..1, ordered-dithered between neighbours
// (wd = how much of each step is dithered: 1 = a full gradient, small = flat bands with a thin dithered edge)
function ramp(cols, v, x, y, wd = 1) {
  const f = clamp(v, 0, 1) * (cols.length - 1), i = Math.floor(f), k = (f - i - (0.5 - wd / 2)) / wd;
  return cols[Math.min(cols.length - 1, i + (k > bay(x, y) ? 1 : 0))];
}

// ------------------------------------------------------------ palette (the kit's M5.PAL values, as ints)
const S_HEX = ['#0e0c1e', '#17152e', '#222244', '#30345f', '#444e82', '#6272ab', '#8fa2d2', '#c3d0ee'];   // ship steel
const S = S_HEX.map(I);
const GN = Pc('#0c2b1c', '#12502a', '#1c7a34', '#2fae44', '#62d64f', '#a8f070', '#e6ffc2');               // robots only (a wall screen)
const MAG = '#ff4fa3', MAGL = '#ffb3d9', CYAN = '#4fe3ff', CYANL = '#c8f7ff', AMB = '#ffcf3a', AMBL = '#fff2a8';
const MAGI = I(MAG), MAGLI = I(MAGL), CYANI = I(CYAN), CYANLI = I(CYANL), AMBI = I(AMB), AMBLI = I(AMBL);
const COWC = Pc('#6b4423', '#a8702f', '#d59a46', '#eebd6a', '#fbe3a6'), COWCREAM = I('#fff3d6'), COWNOSE = I('#f08aa6');
const WHITE = 0xffffff, OUTI = I(OUT), HAZA = I('#c9a12e'), HAZB = I('#22222c');
const METI = I(MET), METDI = I(METD), METLI = I(METL), METDDI = I(METDD);
// plants (dark -> light). Never green.
const PINK = Pc('#4a1248', '#8a1f6e', '#d03f92', '#ff7fbd', '#ffc4e2');
const TEAL = Pc('#0b3246', '#12607a', '#1c95a8', '#4fd0dc', '#bdf4fa');
const ORNG = Pc('#6a2418', '#b8481c', '#f08a2a', '#ffc04f', '#ffeaa8');
const CREAM = Pc('#6e5a78', '#b29aa8', '#e8d6c8', '#fff3d6', '#ffffff');
const VIOL = Pc('#231250', '#3d2088', '#6a3cc8', '#9a74f0', '#d0bcff');
const TRUNK = Pc('#2a1c4c', '#4f3c7c', '#8470b0');
const HAZE = I('#191640');
const hz = (pal, k, c = HAZE) => pal.map(v => mixI(v, c, k));
const LQ = Pc('#1e0834', '#3c0e52', '#6a166c', '#a02082', '#d8389a', '#ff72ba', '#ffc8e6');               // the nectar
const EDGE = I('#0c0a24');

// ------------------------------------------------------------ pixel buffers (0xRRGGBB ints, NONE = empty)
// local (x, y) lands at cell (x + ox, y + oy)
function buf(w, h, ox = 0, oy = 0) { const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox, oy }; }
function put(b, x, y, c) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
// every pixel whose centre passes f(x, y): colour c, or c(x, y) (NONE / undefined = leave)
function shape(b, x0, y0, x1, y1, f, c) {
  const fn = typeof c === 'function';
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (!f(x + 0.5, y + 0.5)) continue;
    const v = fn ? c(x + 0.5, y + 0.5) : c;
    if (v != null && v !== NONE) put(b, x, y, v);
  }
}
function oval(b, cx, cy, rx, ry, c) { shape(b, cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, c); }
function line(b, x0, y0, x1, y1, c, t = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), hw = (t - 1) / 2;
  for (let i = 0; i <= n; i++) rect(b, Math.round(x0 + (x1 - x0) * i / n - hw), Math.round(y0 + (y1 - y0) * i / n - hw), t, t, c);
}
function outline(b, c = OUTI) {
  const add = [], w = b.w, h = b.h, d = b.d;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i] !== NONE) continue;
    if ((x > 0 && d[i - 1] !== NONE) || (x < w - 1 && d[i + 1] !== NONE) || (y > 0 && d[i - w] !== NONE) || (y < h - 1 && d[i + w] !== NONE)) add.push(i);
  }
  for (const i of add) d[i] = c;
}
function stampInto(dst, src) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const v = src.d[y * src.w + x]; if (v !== NONE) put(dst, x - src.ox, y - src.oy, v); } }
// paint one thing into a small scratch buffer (its box in dst's coordinates), give it a dark edge, stamp it into dst
function plant(dst, x0, y0, x1, y1, fn, edge) {
  const t = buf(x1 - x0 + 3, y1 - y0 + 3, 1 - x0, 1 - y0);
  fn(t);
  if (edge != null) outline(t, edge);
  stampInto(dst, t);
}
function pix(b, x, y, rows, map) { rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = map[row[i]]; if (c != null) put(b, x + i, y + j, c); } }); }
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function bake(b) {
  const c = canvasOf(b.w, b.h), g = c.getContext('2d'), im = g.createImageData(b.w, b.h), dd = im.data, d = b.d;
  for (let i = 0; i < d.length; i++) {
    const v = d[i];
    if (v === NONE) continue;
    const j = i * 4;
    dd[j] = (v >> 16) & 255; dd[j + 1] = (v >> 8) & 255; dd[j + 2] = v & 255; dd[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// soft additive light: one cached 64px radial sprite per colour
const GLW = {};
function glowSprite(col) {
  let s = GLW[col];
  if (!s) {
    s = GLW[col] = canvasOf(64, 64);
    const q = s.getContext('2d'), v = I(col), rgb = (v >> 16 & 255) + ',' + (v >> 8 & 255) + ',' + (v & 255), gr = q.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.35, 'rgba(' + rgb + ',0.45)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    q.fillStyle = gr; q.fillRect(0, 0, 64, 64);
  }
  return s;
}
// live glow into g (it keeps g's alpha: the overlay is called at its weight, bg may be a crossfade scratch)
function glowG(g, x, y, r, col, a) {
  const a0 = g.globalAlpha;
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = a0 * clamp(a, 0, 1);
  g.drawImage(glowSprite(col), Math.round(x - r), Math.round(y - r), r * 2, r * 2);
  g.globalAlpha = a0; g.globalCompositeOperation = 'source-over';
}
// baked glows: [x, y, colour (int), radius, alpha] in a buffer's coordinates, added to its canvas once
function bakeGlows(c, b, list, under) {
  if (!list || !list.length) return c;
  let out = c, g;
  if (under) { out = canvasOf(c.width, c.height); g = out.getContext('2d'); } else g = c.getContext('2d');
  g.globalCompositeOperation = 'lighter';
  for (const [x, y, col, r, a] of list) { g.globalAlpha = a == null ? 0.3 : a; g.drawImage(glowSprite(hexOf(col)), Math.round(x + b.ox - r), Math.round(y + b.oy - r), r * 2, r * 2); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (under) g.drawImage(c, 0, 0);
  return out;
}
// a shaded ball from an int ramp of 5 (dark -> light), lit from the upper right like the kit's robots
function sph(b, cx, cy, rx, ry, cols, lx = 0.45, ly = -0.85, th = [0.6, 0.18, -0.34, -0.72]) {
  shape(b, cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, (x, y) => {
    const l = (x - cx) / rx * lx + (y - cy) / ry * ly;
    return cols[l > th[0] ? 4 : l > th[1] ? 3 : l > th[2] ? 2 : l > th[3] ? 1 : 0];
  });
}

// ============================================================
// Plant painters (the proposal's, plus the new groves). GL = the glow list of the picture being painted.
// ============================================================
let GL = null;
const glowAt = (x, y, col, r, a) => { if (GL) GL.push([x, y, col, r, a]); };
// a glossy bubble: shaded ball, a white glint, bounce light on the lower rim
function bubble(b, cx, cy, r, cols) {
  sph(b, cx, cy, r, r, cols, 0.5, -0.8, [0.8, 0.34, -0.5, -0.86]);
  if (r >= 4) shape(b, cx - r, cy - r, cx + r, cy + r, (x, y) => { const d = Math.hypot(x - cx, y - cy); return d <= r && d > r - 1.4 && (x - cx) * -0.5 + (y - cy) * 0.8 > r * 0.5; }, cols[2]);
  if (r >= 2.5) put(b, cx + r * 0.36, cy - r * 0.5, WHITE);
  if (r >= 5) { put(b, cx + r * 0.36 - 1, cy - r * 0.5, WHITE); put(b, cx + r * 0.36, cy - r * 0.5 + 1, cols[4]); }
}
// a tapering bough along a quadratic curve, lit on the right
const qb = (a, c, d, t) => { const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * d[0], u * u * a[1] + 2 * u * t * c[1] + t * t * d[1]]; };
function bough(b, a, c, d, w0, w1, pal) {
  const n = Math.ceil((Math.hypot(c[0] - a[0], c[1] - a[1]) + Math.hypot(d[0] - c[0], d[1] - c[1])) * 1.6);
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = qb(a, c, d, t), w = Math.max(1, Math.round(lerp(w0, w1, t)));
    for (let k = 0; k < w; k++) { const u = (k + 0.5) / w; put(b, Math.round(x - w / 2) + k, y, u < 0.34 ? pal[0] : u > 0.7 ? pal[2] : pal[1]); }
  }
}
function limb(b, x0, y0, x1, y1, w0, w1, pal, bend = 0) { bough(b, [x0, y0], [(x0 + x1) / 2 + bend * 2, (y0 + y1) / 2], [x1, y1], w0, w1, pal); }
// a bubble tree: a twisting trunk that forks into curved boughs, each carrying a clump of glossy bubbles
function bubbleTree(b, x, base, top, spread, trunk, cols, seed, big = 1) {
  const r = rng(seed), lean = (r() - 0.5) * 12, forkY = base - (base - top) * 0.46, fx = x + lean;
  const dark = cols.map((c, i) => i ? cols[i - 1] : mixI(c, 0, 0.3));
  bough(b, [x, base], [x - lean * 0.7, (base + forkY) / 2], [fx, forkY], 9 * big, 5.6 * big, trunk);
  for (let k = 0; k < 4; k++) { put(b, x - 5 - k, base - 1 - (k < 2 ? 1 : 0), trunk[0]); put(b, x + 4 + k, base - 1 - (k < 2 ? 1 : 0), trunk[1]); }   // root flare
  const n = spread > 22 ? 4 : 3, clumps = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) * 2 - 1;
    clumps.push([fx + u * spread + (r() - 0.5) * 5, top + 10 + Math.abs(u) * (5 + r() * 8) + ((i & 1) ? -6 : 3) * r(), u]);
  }
  for (const [cx, cy, u] of clumps) bough(b, [fx, forkY + 2], [fx + u * spread * 0.95, forkY - 3], [cx, cy + 5], 5 * big, 2.6 * big, trunk);
  const bs = [];
  for (const [cx, cy] of clumps) {
    const R0 = (8 + r() * 2.5) * big, m = 5 + Math.floor(r() * 2);
    bs.push([cx, cy, R0, 3]);
    for (let k = 0; k < m; k++) { const a = (k / m) * Math.PI * 2 + r() * 0.8, d = R0 * (0.78 + r() * 0.3); bs.push([cx + Math.cos(a) * d * 1.2, cy + Math.sin(a) * d * 0.72, (4 + r() * 2.6) * big, Math.sin(a) < -0.2 ? 2 + r() : 1 + r()]); }
    for (let k = 0; k < 5; k++) { const a = r() * Math.PI * 2, d = R0 * (1.3 + r() * 0.5); bs.push([cx + Math.cos(a) * d * 1.2, cy + Math.sin(a) * d * 0.7 + 2, (2 + r() * 1.4) * big, r()]); }
  }
  bs.sort((p, q) => p[3] - q[3]);
  for (const [bx, by, br, dep] of bs) { const X = Math.round(bx), Y = Math.round(by), rr = Math.round(br * 2) / 2; oval(b, X, Y, rr + 1, rr + 1, mixI(cols[0], cols[1], 0.35)); bubble(b, X, Y, rr, dep < 1 ? dark : cols); }
}
// a soft rounded bush for the far hedge (pal: dark, mid, light)
function bush(b, cx, base, w, h, pal, seed) {
  const n = 3 + Math.floor(w / 14);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5, x = Math.round(cx + u * w * 0.8), rr = h * (0.55 + nz(seed, i) * 0.45) * (1 - Math.abs(u) * 0.5), y = Math.round(base - rr * 0.75);
    oval(b, x, y, rr * 1.2, rr, pal[0]);
    shape(b, x - rr * 1.2, y - rr, x + rr * 1.2, y + rr, (px, py) => ((px - x) / (rr * 1.2)) ** 2 + ((py - y) / rr) ** 2 <= 1 && (px - x) * 0.3 - (py - y) * 0.9 > rr * 0.35, pal[1]);
    for (let k = 0; k < rr / 2; k++) put(b, x - rr * 0.5 + nz(seed + i, k) * rr * 1.3, y - rr * (0.55 + nz(seed + i, k + 9) * 0.35), pal[2]);
  }
}
// a broad pointed leaf along a drooping midrib (pal: rib, upper, lower, edge)
function bigLeaf(b, x0, y0, a, len, wid, droop, pal) {
  const n = Math.ceil(len * 2.2);
  for (let i = 0; i <= n; i++) {
    const t = i / n, cx = x0 + Math.cos(a) * len * t, cy = y0 + Math.sin(a) * len * t + droop * t * t * len;
    const dx = Math.cos(a), dy = Math.sin(a) + 2 * droop * t, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
    const hw = wid * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.88)), 0.7), L = t * len;
    for (let o = -hw; o <= hw; o += 0.5) {
      const ao = Math.abs(o), up = o * ny < 0, vein = Math.abs(((L + ao * 0.8) % 6) - 3) < 0.4 && ao > 1;
      let c = ao < 0.6 ? pal[0] : up ? pal[1] : pal[2];
      if (vein) c = up ? pal[0] : pal[1];
      if (ao > hw - 0.8) c = up ? pal[0] : pal[3];
      put(b, cx + nx * o, cy + ny * o, c);
    }
  }
}
// a fiddlehead: a thick stalk with leaflets that curls into a spiral (pal: dark, mid, light, tip)
function fiddle(b, x, base, h, dir, w, pal, turns = 1.5) {
  const cr = Math.max(4, h * 0.24), pts = [], n1 = Math.ceil(h * 1.3);
  for (let i = 0; i <= n1; i++) { const t = i / n1; pts.push([x + dir * (t * t * h * 0.2 - Math.sin(t * Math.PI) * h * 0.07), base - t * (h - cr), 1 - t * 0.3]); }
  const [sx, sy] = pts[pts.length - 1], ccx = sx + dir * cr, n2 = Math.ceil(cr * turns * 6);
  for (let i = 1; i <= n2; i++) { const t = i / n2, a = Math.PI + t * Math.PI * 2 * turns, rr = cr * (1 - t * 0.78); pts.push([ccx + Math.cos(a) * rr * dir, sy + Math.sin(a) * rr, 0.72 - t * 0.25]); }
  for (let i = 4, q = 0; i < n1 - 2; i += Math.max(4, Math.round(w * 1.7)), q++) {            // leaflets
    const [px, py] = pts[i], L = Math.round((1 - i / n1) * w * 1.8 + 2), sd = q % 2 ? 1 : -1;
    for (let k = 1; k <= L; k++) { const X = Math.round(px) + sd * (k + (w >> 1)), Y = Math.round(py) - Math.round(k * 0.6); put(b, X, Y, pal[1]); put(b, X, Y + 1, pal[0]); if (k > 1 && k < L) put(b, X, Y - 1, pal[2]); }
  }
  const body = [];
  for (const [px, py, k] of pts) { const ww = Math.max(1, Math.round(w * k)), X = Math.round(px - ww / 2), Y = Math.round(py - ww / 2); for (let j = 0; j < ww; j++) for (let i = 0; i < ww; i++) { put(b, X + i, Y + j, pal[1]); body.push([X + i, Y + j]); } }
  for (const [X, Y] of body) { if (get(b, X, Y - 1) === NONE || get(b, X + 1, Y) === NONE) put(b, X, Y, pal[2]); else if (get(b, X, Y + 1) === NONE || get(b, X - 1, Y) === NONE) put(b, X, Y, pal[0]); }
  const e = pts[pts.length - 1]; rect(b, Math.round(e[0]) - 1, Math.round(e[1]) - 1, 2, 2, pal[3]);
  return [ccx, sy, cr];
}
// blooms: a star flower (this is the STAR garden), a tulip cup, a hanging lantern bulb
const STARF = ['...L...', '.L.L.L.', '..LML..', 'LLMWMLL', '..LML..', '.L.L.L.', '...L...'];
const BIGSTAR = ['....L....', '....L....', '.L.LML.L.', '..LMMML..', 'LLMMWMMLL', '..LMMML..', '.L.LML.L.', '....L....', '....L....'];
const TULIP = ['.L.L.L.', 'LWLMLML', 'LLMMMMD', 'LMMMMMD', '.MMMMD.', '..MDD..'];
const BULB = ['..S..', '.LLM.', 'LWLMD', 'LLMMD', 'LMMMD', '.MMD.', '..D..'];
const bloomMap = (pal, stalk) => ({ W: WHITE, L: pal[4], M: pal[3], D: pal[2], S: stalk });
function starFlower(b, x, base, h, pal, stalk, lean = 0) {
  line(b, x, base, x + lean, base - h, stalk); put(b, x + (lean > 0 ? -1 : 1), base - 3, stalk); put(b, x + (lean > 0 ? -2 : 2), base - 4, stalk);
  pix(b, x + lean - 3, base - h - 4, STARF, bloomMap(pal, stalk)); glowAt(x + lean, base - h - 1, pal[3], 7);
}
// a tall one with a big bloom and two leaves on its stalk
function tallStar(b, x, base, h, pal, stalk, lean = 0) {
  bough(b, [x, base], [x - lean, base - h * 0.5], [x + lean, base - h], 2.2, 1.2, stalk);
  for (const [t, sd] of [[0.3, -1], [0.52, 1]]) { const y = Math.round(base - h * t), xx = Math.round(x - lean * (1 - t) * 0.5); for (let k = 1; k <= 5; k++) { put(b, xx + sd * k, y - (k >> 1), stalk[1]); if (k > 1 && k < 5) put(b, xx + sd * k, y - (k >> 1) - 1, stalk[2]); } }
  pix(b, x + lean - 4, base - h - 5, BIGSTAR, bloomMap(pal, stalk[1])); glowAt(x + lean, base - h - 1, pal[2], 8, 0.2);
}
function tulip(b, x, base, h, pal, stalk, lean = 0) {
  line(b, x, base, x + lean, base - h, stalk); line(b, x, base - 2, x - 3, base - 6, stalk); line(b, x, base - 3, x + 3, base - 7, stalk);
  pix(b, x + lean - 3, base - h - 5, TULIP, bloomMap(pal, stalk)); glowAt(x + lean, base - h - 3, pal[3], 7);
}
function lantern(b, x, base, h, dir, stalk, pal) {
  bough(b, [x, base], [x - dir, base - h * 1.25], [x + dir * h * 0.42, base - h * 0.8], 2.4, 1.2, stalk);
  line(b, x, base - 2, x - dir * 5, base - 7, stalk[1]); line(b, x - dir, base - 2, x - dir * 6, base - 5, stalk[0]);
  const bx = Math.round(x + dir * h * 0.42), by = Math.round(base - h * 0.8);
  pix(b, bx - 2, by + 1, BULB, bloomMap(pal, stalk[1])); glowAt(bx, by + 4, pal[3], 9);
}
function shroomlet(b, x, base, w, h, cap, glow) {
  rect(b, x - 1, base - h, 3, h, CREAM[1]); rect(b, x - 1, base - h, 1, h, CREAM[0]); put(b, x + 1, base - h + 1, CREAM[2]);
  const hw = w >> 1, ch = Math.max(3, Math.round(w * 0.42));
  for (let i = -hw; i <= hw; i++) {
    const u = i / (hw + 0.5), hh = Math.max(1, Math.round(ch * Math.sqrt(1 - u * u)));
    for (let k = 0; k < hh; k++) put(b, x + i, base - h - k, k === hh - 1 ? cap[4] : u > 0.25 && k > 0 ? cap[3] : k === 0 ? cap[1] : cap[2]);
    put(b, x + i, base - h + 1, Math.abs(i) < hw - 1 ? ((i & 1) ? glow : cap[0]) : NONE);
  }
  put(b, x - hw + 2, base - h - 1, cap[4]); if (w > 8) put(b, x + 1, base - h - ch + 2, WHITE);
  glowAt(x, base - h + 2, glow, 6);
}
function bubBush(b, x, base, w, cols, seed) {
  const r = rng(seed), n = Math.round(w / 2.2), dark = cols.map((c, i) => i ? cols[i - 1] : c), bs = [];
  for (let i = 0; i < n; i++) { const u = r() * 2 - 1; bs.push([x + u * w / 2, base - 2 - r() * (1 - u * u) * w * 0.34, 2 + r() * 2.2, r()]); }
  bs.sort((p, q) => q[1] - p[1] + (p[3] - q[3]) * 2);
  for (const [bx, by, br, d] of bs) { oval(b, Math.round(bx), Math.round(by), br + 1, br + 1, dark[0]); bubble(b, Math.round(bx), Math.round(by), Math.round(br * 2) / 2, d < 0.3 ? dark : cols); }
}
function grass(b, x0, x1, base, pal, seed, hmax = 5) {
  for (let x = x0; x < x1; x++) {
    const hgt = 1 + Math.floor(nz(x, seed) * nz(x >> 2, seed + 1) * (hmax + 1.5));
    for (let k = 0; k < hgt; k++) put(b, x + (k > 2 && nz(x, seed + 2) > 0.5 ? 1 : 0), base - k, k === hgt - 1 ? pal[2] : k > 0 ? pal[1] : pal[0]);
  }
}
// thin reeds with glowing tips, along the pond's edge
function reeds(b, x0, x1, base, seed, tips) {
  for (let x = x0; x < x1; x += 3 + Math.floor(nz(x, seed) * 4)) {
    const h = 6 + Math.floor(nz(x, seed + 1) * 12), lean = nz(x, seed + 2) > 0.5 ? 1 : -1, tip = tips[Math.floor(nz(x, seed + 3) * tips.length)];
    for (let k = 0; k < h; k++) put(b, x + (k > h * 0.6 ? lean : 0), base - k, k > h - 3 ? TEAL[2] : TEAL[1]);
    if (nz(x, seed + 4) > 0.35) { rect(b, x + lean, base - h - 2, 1, 3, tip[3]); put(b, x + lean, base - h - 2, tip[4]); glowAt(x + lean, base - h - 1, tip[3], 5, 0.3); }
  }
}
// a tall background mushroom (not a platform)
function tallShroom(b, x, base, h, w, cap, stem, glow) {
  for (let y = base - h + 3; y <= base; y++) { const lean = Math.round(Math.sin((base - y) / h * 2.2) * 2), sw = w > 30 ? 1 : 0; for (let k = -1 - sw; k <= 1 + sw; k++) put(b, x + lean + k, y, k < 0 ? stem[0] : k > 0 ? stem[2] : stem[1]); }
  const cx = x + Math.round(Math.sin(2.2) * 2), cy = base - h + 3, hw = w / 2;
  for (let i = -hw; i < hw; i++) {
    const u = (i + 0.5) / hw, hh = Math.round((w * 0.42) * Math.sqrt(1 - u * u));
    for (let k = 0; k < hh; k++) { const l = u * 0.45 + (k / Math.max(1, w * 0.42)) * 1.5 - 0.6; put(b, cx + i, cy - k, cap[l > 0.7 ? 4 : l > 0.25 ? 3 : l > -0.2 ? 2 : 1]); }
    put(b, cx + i, cy + 1, (i & 1) ? glow : cap[0]);
  }
  for (let i = 0; i < w / 5; i++) put(b, cx - hw + 2 + i * 5 + (i & 1), cy - 2 - (i % 3), cap[4]);
  if (w > 24) glowAt(cx, cy + 3, glow, Math.round(w * 0.5), 0.2);
}
// a giant dandelion clock: a thin stalk, a round head of spokes with star tips (you can see through it)
function dandelion(b, x, base, h, r, stalk, pal, seed) {
  const lean = (nz(seed, 1) - 0.5) * 12, hx = Math.round(x + lean), hy = Math.round(base - h);
  bough(b, [x, base], [x - lean * 0.6, base - h * 0.5], [hx, hy], 3.4, 1.6, stalk);
  for (const [t, sd] of [[0.22, -1], [0.36, 1]]) { const y = Math.round(base - h * t), xx = Math.round(x - lean * 0.3 * t); for (let k = 1; k <= 7; k++) { put(b, xx + sd * (k + 1), y - (k >> 1), stalk[1]); put(b, xx + sd * (k + 1), y - (k >> 1) + 1, stalk[0]); } }
  const n = Math.round(r * 1.25);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + nz(seed, i + 9) * 0.25, len = r * (0.84 + nz(seed, i + 40) * 0.2), ex = hx + Math.cos(a) * len, ey = hy + Math.sin(a) * len * 0.95;
    line(b, hx + Math.cos(a) * 3, hy + Math.sin(a) * 3, ex, ey, pal[1]);
    put(b, ex - 1, ey, pal[3]); put(b, ex + 1, ey, pal[3]); put(b, ex, ey - 1, pal[3]); put(b, ex, ey + 1, pal[2]); put(b, ex, ey, pal[4]);
  }
  for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2, len = r * 0.5; put(b, hx + Math.cos(a) * len, hy + Math.sin(a) * len * 0.95, pal[3]); }
  oval(b, hx, hy, 3, 3, pal[2]); put(b, hx + 1, hy - 2, pal[4]); put(b, hx - 1, hy + 1, pal[1]);
  glowAt(hx, hy, pal[3], Math.round(r * 1.5), 0.16);
}
// a spiral tree: a giant fiddlehead with lantern bulbs hanging from its curl
function spiralTree(b, x, base, h, dir, w, pal, bulb, seed) {
  const [cx, cy, cr] = fiddle(b, x, base, h, dir, w, pal, 1.6);
  for (let k = 0; k < 3; k++) {
    const bx = Math.round(cx + (k - 1) * cr * 0.8 + (nz(seed, k) - 0.5) * 4), top = Math.round(cy + cr * (0.7 + (k === 1 ? 0.3 : 0))), L = 5 + Math.floor(nz(seed, k + 5) * 9);
    for (let j = 0; j < L; j++) put(b, bx, top + j, pal[0]);
    pix(b, bx - 2, top + L, BULB, bloomMap(bulb, pal[1])); glowAt(bx, top + L + 4, bulb[3], 8, 0.3);
  }
}
// a lantern willow: boughs that arch out and droop, strands of leaves hanging from them, a glowing bulb on each
function willow(b, x, base, h, spread, trunk, leaf, bulb, seed) {
  const r = rng(seed), top = base - h, lean = (r() - 0.5) * 8;
  bough(b, [x, base], [x + lean, base - h * 0.5], [x, top + 10], 9, 5, trunk);
  for (let k = 0; k < 4; k++) { put(b, x - 5 - k, base - 1 - (k < 2 ? 1 : 0), trunk[0]); put(b, x + 4 + k, base - 1 - (k < 2 ? 1 : 0), trunk[1]); }
  const N = 9;
  for (let i = 0; i < N; i++) {
    const u = (i / (N - 1)) * 2 - 1, ex = x + u * spread + (r() - 0.5) * 6, ey = top + 20 + Math.abs(u) * 4 + r() * 22;
    bough(b, [x, top + 11], [x + u * spread * 0.8, top - 10 + Math.abs(u) * 8], [ex, ey], 3.6, 1.3, trunk);
    for (const q of [0.55, 0.78, 1]) {                                       // strands
      const [sx, sy] = qb([x, top + 11], [x + u * spread * 0.8, top - 10 + Math.abs(u) * 8], [ex, ey], q), L = Math.round((q === 1 ? 12 : 6) + r() * 14), X = Math.round(sx);
      for (let k = 0; k < L; k++) { const Y = Math.round(sy) + k, w = (k % 4 === 3) ? 1 : 0; put(b, X + w, Y, leaf[1]); if (k % 3 === 1) put(b, X - 1, Y, leaf[2]); if (k % 3 === 2) put(b, X + 1, Y, leaf[0]); }
      if (q === 1 || r() > 0.6) { pix(b, X - 2, Math.round(sy) + L, BULB, bloomMap(bulb, leaf[1])); glowAt(X, Math.round(sy) + L + 4, bulb[3], 8, 0.3); }
    }
  }
  for (let k = 0; k < 7; k++) { const a = r() * Math.PI, rr = 4 + r() * 4; oval(b, x + Math.cos(a) * 9, top + 8 - Math.sin(a) * 6, rr, rr * 0.7, leaf[k % 2]); }
}
// far garden shapes: soft two-tone, darker than everything in play
function farTree(b, x, base, h, w, pal, seed) {
  for (let y = base - h + 6; y <= base; y++) { const sx = x + Math.round(Math.sin((base - y) / 13 + seed) * 1.5); put(b, sx, y, pal[0]); put(b, sx + 1, y, pal[1]); }
  const n = 4 + Math.floor(w / 9);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5, cx = Math.round(x + u * w + (nz(seed, i) - 0.5) * 4), cy = Math.round(base - h + 6 + Math.abs(u) * w * 0.3 + (nz(seed, i + 20) - 0.5) * 6), rx = 5 + nz(seed, i + 40) * 4, ry = rx * 0.8;
    oval(b, cx, cy, rx, ry, pal[0]);
    shape(b, cx - rx, cy - ry, cx + rx, cy + ry, (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1 && (px - cx) * 0.4 - (py - cy) * 0.9 > rx * 0.2, pal[1]);
    put(b, cx + rx * 0.3, cy - ry * 0.5, pal[2]);
  }
}
function farShroom(b, x, base, h, w, pal, glow) {
  for (let y = base - h; y <= base; y++) { put(b, x, y, pal[0]); put(b, x + 1, y, pal[1]); }
  const hw = w >> 1, ch = Math.round(w * 0.36);
  for (let i = -hw; i <= hw; i++) {
    const u = i / (hw + 0.5), hh = Math.max(1, Math.round(ch * Math.sqrt(1 - u * u)));
    for (let k = 0; k < hh; k++) put(b, x + i, base - h - k, k >= hh - 1 - (u > 0 ? 1 : 0) ? pal[1] : pal[0]);
    if ((i & 1) === 0 && Math.abs(i) < hw - 1) put(b, x + i, base - h + 1, glow);
  }
  put(b, x + hw * 0.4, base - h - ch + 1, pal[2]);
}

// ============================================================
// Parallax strips: local x = u (screen x at camera 2200); at camera cx a strip is drawn at u - (cx - 2200) * p
// ============================================================
const uRange = p => [Math.floor((CAM0 - CAM) * p) - 12, Math.ceil((CAM1 - CAM) * p) + VW + 12];
function strip(p, top, h) { const [u0, u1] = uRange(p), b = buf(u1 - u0, h, -u0, -top); b.p = p; b.u0 = u0; b.u1 = u1; b.top = top; return b; }
const done = (b, glows, under) => ({ c: bakeGlows(bake(b), b, glows, under), p: b.p, u0: b.u0, top: b.top });
const parts = (x0, x1, n) => { const o = []; for (let i = 0; i < n; i++) o.push([Math.round(x0 + (x1 - x0) * i / n), Math.round(x0 + (x1 - x0) * (i + 1) / n)]); return o; };
const ART = {};                                  // every baked picture
let SB = null;                                   // the buffer being painted over several steps
const STEPS = [];

// ============================================================
// Space (p .15): stars, a violet nebula, the Moon and a small ringed planet (the proposal's sky), a comet to the
// left of them and a spiral galaxy to the right
// ============================================================
const SKY_P = 0.15;
const MOON = { x: 110, y: 101, r: 34 }, PLANET = { x: 322, y: 84, r: 9 };
const TWINK = [];
const SKYR = Pc('#04030b', '#06051a', '#0a0920', '#0f0d2a', '#151236', '#1c1644', '#261a54', '#331c62', '#441f6e');
const SKYT = Pc('#04030b', '#06051a', '#08101f', '#0a1a2c', '#0d2638', '#103446', '#134456', '#165466', '#1a6878');
function skyNebula(b, xa, xb) {
  for (let y = -10; y < 230; y++) for (let x = xa; x < xb; x++) {
    let v = 0.10 + 0.20 * ss(20, 200, y);
    const n = fbm(x / 80 + 3.1, y / 50 + 1.7, 5, 4), band = Math.exp(-((((y - 104) + (x - 250) * 0.24) / 60) ** 2));
    v += band * ss(0.36, 0.72, n) * 0.8 + Math.exp(-((((y - 150) - (x - 120) * 0.2) / 30) ** 2)) * ss(0.45, 0.8, fbm(x / 60 + 9, y / 40, 8, 3)) * 0.4;
    let cols = SKYR;
    if (x < -10) {                                              // a teal veil in the left of the sky (beyond the proposal's screen)
      const k = Math.exp(-((((y - 78) + (x + 70) * 0.34) / 36) ** 2)) * ss(-10, -90, x) * ss(0.38, 0.74, fbm(x / 52 + 20, y / 36 + 7, 12, 3));
      v += k * 0.55;
      if (k * 1.5 > bay(x + 1, y + 2)) cols = SKYT;
    }
    put(b, x, y, ramp(cols, v, x, y, 0.7));
  }
}
function star(b, x, y, k, tint) {
  const col = I(tint < 0.14 ? '#bff3ff' : tint < 0.26 ? '#ffc9e6' : tint < 0.34 ? '#fff0b0' : '#ffffff');
  if (k < 0.60) put(b, x, y, I(k < 0.3 ? '#4d5590' : '#8088c0'));
  else if (k < 0.90) put(b, x, y, col);
  else if (k < 0.972) {
    put(b, x, y, WHITE);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(b, x + dx, y + dy, mixI(col, I('#3a3f78'), 0.45));
    TWINK.push([x, y]);
  } else {
    put(b, x, y, WHITE);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { put(b, x + dx, y + dy, col); put(b, x + dx * 2, y + dy * 2, mixI(col, I('#3a3f78'), 0.6)); }
    TWINK.push([x, y]);
  }
}
function skyStars(b) {
  TWINK.length = 0;
  let r = rng(771);                                             // the proposal's own stars
  for (let i = 0; i < 340; i++) { const x = Math.floor(r() * (VW + 20)) - 10, y = Math.floor(r() * 215) - 6, k = r(), tint = r(); star(b, x, y, k, tint); }
  r = rng(772);
  for (let i = 0; i < 105; i++) { const x = b.u0 + Math.floor(r() * (-10 - b.u0)), y = Math.floor(r() * 215) - 6, k = r(), tint = r(); star(b, x, y, k, tint); }
  r = rng(773);
  for (let i = 0; i < 108; i++) { const x = 490 + Math.floor(r() * (b.u1 - 490)), y = Math.floor(r() * 215) - 6, k = r(), tint = r(); star(b, x, y, k, tint); }
}
function paintMoon(b) {
  const { x: cx, y: cy, r } = MOON;
  const MR = Pc('#0e0d22', '#1b1a36', '#2c2d49', '#474a66', '#6a6e88', '#9195aa', '#b9bcca', '#dcdee6', '#f6f6fa');
  const L = [0.60, -0.52, 0.61];
  const CR = [[-0.30, -0.35, 0.20], [0.28, 0.10, 0.26], [-0.05, 0.42, 0.17], [0.45, -0.42, 0.13], [-0.52, 0.18, 0.12], [0.10, -0.58, 0.10],
    [0.62, 0.30, 0.09], [-0.22, 0.02, 0.08], [0.28, 0.58, 0.10], [-0.42, 0.55, 0.08], [0.02, -0.18, 0.07], [0.52, -0.08, 0.07],
    [-0.66, -0.20, 0.07], [0.20, -0.36, 0.05], [-0.12, 0.70, 0.06]];
  for (let j = -r - 1; j <= r + 1; j++) for (let i = -r - 1; i <= r + 1; i++) {
    const nx = (i + 0.5) / r, ny = (j + 0.5) / r, d2 = nx * nx + ny * ny;
    if (d2 > 1) continue;
    const nzv = Math.sqrt(1 - d2);
    let px = nx, py = ny;
    let alb = 0.86 - 0.22 * ss(0.48, 0.64, fbm(nx * 2.2 + 9, ny * 2.2 + 4, 21, 3)) + (nz(i + 400, j + 90) - 0.5) * 0.05;   // the grey seas
    for (const [ax, ay, cr] of CR) {
      const dx = nx - ax, dy = ny - ay, q = Math.hypot(dx, dy) / cr;
      if (q < 1) { alb -= 0.07; const w = ss(0.25, 1, q); px -= dx / cr * w * 0.6; py -= dy / cr * w * 0.6; }            // the bowl: far wall lit
      else if (q < 1.3) { const w = 1 - (q - 1) / 0.3; px += dx / cr / q * w * 0.4; py += dy / cr / q * w * 0.4; alb += 0.05 * w; }   // raised rim
    }
    const l = px * L[0] + py * L[1] + nzv * L[2];
    const v = 0.08 + alb * Math.pow(clamp(l * 1.15 + 0.08, 0, 1), 0.75);
    put(b, cx + i, cy + j, ramp(MR, v, cx + i, cy + j, 0.4));
  }
}
function paintPlanet(b) {
  const { x: cx, y: cy, r } = PLANET;
  const PR = Pc('#5a2450', '#a03f6a', '#e0705e', '#ffae5a', '#ffe0a0'), RG = Pc('#6a4a8a', '#b88cc8', '#f2d8ee');
  const ring = front => {
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      for (const [rr, c] of [[1.55, 0], [1.75, 1], [1.95, 2], [2.1, 1]]) {
        const x = cx + Math.cos(a) * r * rr, y = cy + Math.sin(a) * r * rr * 0.26 - Math.cos(a) * r * rr * 0.22;
        put(b, x, y, RG[c]);
      }
    }
  };
  ring(false);
  shape(b, cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r, (x, y) => {
    const l = (x - cx) / r * 0.5 + (y - cy) / r * -0.6, band = Math.sin((y - cy) * 1.25 + (x - cx) * 0.25) * 0.14;
    return PR[clamp(Math.round((l + band + 0.75) * 2.7), 0, 4)];
  });
  ring(true);
}
// a spiral galaxy seen at a slant: a bright core, two dithered arms
function paintGalaxy(b, gx, gy) {
  const GX = Pc('#2a1a5e', '#4a2a86', '#8a3a9a', '#d0609e', '#ffb0d0', '#fff2e0');
  const ca = Math.cos(-0.45), sa = Math.sin(-0.45);
  for (let j = -30; j <= 30; j++) for (let i = -54; i <= 54; i++) {
    const X = i * ca - j * sa, Y = (i * sa + j * ca) / 0.4, r = Math.hypot(X, Y);
    if (r > 52) continue;
    const arm = 0.5 + 0.5 * Math.sin(2 * Math.atan2(Y, X) - Math.log(r + 2) * 4.4);
    const v = Math.exp(-((r / 7) ** 2)) * 1.3 + ss(0.4, 1, arm) * Math.exp(-r / 21) * 0.95 + Math.exp(-r / 12) * 0.3 + (nz(i + 700, j + 300) - 0.5) * 0.1;
    if (v < 0.17) continue;
    put(b, gx + i, gy + j, ramp(GX, v - 0.12, gx + i, gy + j, 0.8));
  }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]]) put(b, gx + dx, gy + dy, WHITE);
}
// a comet: a white head, a dithered cyan tail streaming up and to the right
function paintComet(b, cx, cy) {
  const C0 = I('#c8f7ff'), C1 = I('#6fb6e6'), C2 = I('#3a4f9a');
  for (let k = 2; k < 52; k++) {
    const w = 0.6 + k * 0.13, a = 1 - k / 52;
    for (let o = -w; o <= w; o += 0.5) {
      const x = Math.round(cx + k * 0.93 + o * 0.36), y = Math.round(cy - k * 0.36 - o * 0.93), e = a * (1 - Math.abs(o) / (w + 0.6));
      if (e * 1.5 > nz(x + 90, y + 40) * 0.9 + 0.12) put(b, x, y, e > 0.62 ? C0 : e > 0.34 ? C1 : C2);
    }
  }
  oval(b, cx, cy, 2.2, 2.2, C0); rect(b, cx - 1, cy - 1, 2, 2, WHITE);
  for (const [dx, dy] of [[-3, 0], [0, 3], [-2, 2]]) put(b, cx + dx, cy + dy, C1);
}
{
  const [u0, u1] = uRange(SKY_P);
  parts(u0, u1, 5).forEach(([a, c], i) => STEPS.push(() => { if (!i) SB = strip(SKY_P, -10, 240); skyNebula(SB, a, c); }));
  STEPS.push(() => {
    skyStars(SB); paintPlanet(SB); paintMoon(SB); paintGalaxy(SB, 458, 62); paintComet(SB, -34, 84);
    ART.sky = done(SB, [[MOON.x, MOON.y, I('#8fa2d2'), 60, 0.3], [458, 62, I('#ff9ad8'), 30, 0.2]]); SB = null;
  });
}

// ============================================================
// The glasshouse (p .5): three domes in a row (hull above and between them), their ribs, the far base wall
// ============================================================
const DOME_P = 0.5, DOME_BY = 215, DOME_R = 236, RIM = 8, BEAM_Y = 62, WALL_Y = 172, WALL_B = 240;
const DOMES = [{ cx: -322, kind: 'lattice' }, { cx: 250, kind: 'merid' }, { cx: 770, kind: 'fan' }];
const PYL = [-36, 510];                           // the pylons between them: the greenhouse lab, the nectar works
const LONS = [-60, -30, 0, 30, 60];
const domeOf = x => x < PYL[0] ? DOMES[0] : x < PYL[1] ? DOMES[1] : DOMES[2];
const domeD = (D, x, y) => Math.hypot(x + 0.5 - D.cx, y + 0.5 - DOME_BY);
const inGlass = (D, x, y) => domeD(D, x, y) <= DOME_R - RIM;
const ribX = (D, lon, y) => { const s = (DOME_BY - y) / DOME_R; return D.cx + Math.sin(lon * Math.PI / 180) * DOME_R * Math.sqrt(Math.max(0, 1 - s * s)); };
function hullCol(x, y, base) {
  const row = Math.floor(y / 26), ox = (row & 1) * 22, X = x + ox + 2000, col = Math.floor(X / 44), u = X % 44, v = ((y % 26) + 26) % 26;
  const q = nz(col, row + 50), tone = base + (q > 0.74 ? 1 : q < 0.18 ? -1 : 0);
  if (u === 0 || v === 0) return S[Math.max(0, base - 2)];
  if (v === 1 || u === 1) return S[Math.min(7, tone + 1)];
  if ((u === 4 || u === 40) && (v === 4 || v === 22)) return S[Math.min(7, tone + 2)];
  if ((u === 5 || u === 41) && (v === 5 || v === 23)) return S[Math.max(0, tone - 1)];
  return nz(x, y) < 0.05 ? S[Math.max(0, tone - 1)] : S[Math.max(0, tone)];
}
function glyphs(b, x, y, n, col, seed) {
  for (let i = 0; i < n; i++) {
    const k = Math.floor(nz(seed, i) * 6), gx = x + i * 7;
    if (k === 0 || k === 3) { rect(b, gx + 1, y, 3, 1, col); rect(b, gx + 1, y + 4, 3, 1, col); rect(b, gx, y + 1, 1, 3, col); rect(b, gx + 4, y + 1, 1, 3, col); if (k === 3) put(b, gx + 2, y + 2, col); }
    else if (k === 1) rect(b, gx + 1, y + 1, 3, 3, col);
    else if (k === 2) { rect(b, gx, y, 2, 5, col); rect(b, gx + 3, y, 2, 5, col); }
    else if (k === 4) { rect(b, gx, y + 3, 5, 2, col); rect(b, gx + 1, y, 3, 2, col); }
    else { rect(b, gx + 1, y, 2, 5, col); rect(b, gx + 3, y + 3, 2, 2, col); }
  }
}
function plaque(b, x, y, n, seed, pad = 2, col = I('#2bb6d6')) {
  rect(b, x - 1, y - 1, n * 7 + 5, 7 + pad * 2, S[3]); rect(b, x, y, n * 7 + 3, 5 + pad * 2, S[0]);
  glyphs(b, x + 2, y + pad, n, col, seed);
}
function vent(b, x, y, w, h) {
  rect(b, x - 1, y - 1, w + 2, h + 2, S[3]); rect(b, x, y, w, h, S[0]);
  for (let j = 1; j < h; j += 2) rect(b, x + 1, y + j, w - 2, 1, S[2]);
}
const RIMC = [S[1], S[3], S[4], S[6], S[4], S[3], S[2], S[0]], ARCHPIPE = [S[1], S[4], S[3], S[1]], ARCHLIGHT = I('#1f7fa6');
const WALLTOP = [S[5], S[4], S[3], S[3], S[2], S[1], S[0]], WALLPIPE = [S[0], S[3], S[2], S[1], S[0]];
// the hull, the arches' steel rims and the base wall, column by column (the glass stays empty: space shows through)
function structCols(b, xa, xb) {
  const r = DOME_R;
  for (let x = xa; x < xb; x++) {
    const D = domeOf(x), dx = x + 0.5 - D.cx, dx2 = dx * dx;
    for (let y = -10; y < WALL_Y; y++) {
      const dy = y + 0.5 - DOME_BY, d = Math.sqrt(dx2 + dy * dy);
      if (d > r) {
        const dd = d - r;
        let c;
        if (dd > 5 && dd <= 9) c = ARCHPIPE[Math.floor(dd - 5.001)];                       // a pipe follows the arch
        else if (dd > 13 && dd <= 14) c = Math.floor(Math.atan2(DOME_BY - y, x - D.cx) * 60) % 3 ? ARCHLIGHT : S[0];   // and a cyan light strip
        else c = hullCol(x, y, 2);
        put(b, x, y, c);
      } else if (d > r - RIM) put(b, x, y, RIMC[Math.min(7, Math.floor(r - d))]);
    }
    for (let y = WALL_Y; y < WALL_B; y++) put(b, x, y, hullCol(x + 9, y + 5, 1));
    for (let k = 0; k < 7; k++) put(b, x, WALL_Y + k, WALLTOP[k]);
    const m12 = ((x % 12) + 12) % 12, m46 = ((x % 46) + 46) % 46;
    if (m12 === 3) { put(b, x, WALL_Y + 2, S[6]); put(b, x, WALL_Y + 3, S[1]); }
    for (let k = 0; k < 5; k++) put(b, x, WALL_Y + 12 + k, WALLPIPE[k]);                  // a long pipe
    if (m46 < 3) for (let k = -1; k < 6; k++) put(b, x, WALL_Y + 12 + k, k === -1 ? S[4] : S[2]);
  }
}
// glass: a pair of slanting shine strokes
function shine(b, D, x0, y0, len) {
  for (let k = 0; k < len; k++) {
    const x = Math.round(x0 - k * 0.8), y = y0 + k, c = I(k < 2 || k > len - 3 ? '#1a2052' : '#262e6c');
    for (let i = 0; i < 3; i++) if (inGlass(D, x + i, y)) put(b, x + i, y, c);
    if (k > 3 && k < len - 2 && inGlass(D, x + 6, y)) put(b, x + 6, y, I('#1a2052'));
  }
}
// one pixel row of a rib: dark edge left, lit edge right
function ribPx(b, D, x, y) {
  if (y >= WALL_Y || !inGlass(D, x, y)) return false;
  put(b, x - 2, y, S[1]); put(b, x - 1, y, S[2]); put(b, x, y, S[3]); put(b, x + 1, y, S[5]);
  return true;
}
function ribLine(b, D, x0, y0, x1, y1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); if (ribPx(b, D, x, y) && i % 14 === 5) { put(b, x, y, S[6]); put(b, x, y + 1, S[1]); } }
}
// a ring beam across the glass with small lamps; rows = its colours from the top
function ringBeam(b, D, y, rows, lampRow, lamp, lampL, step) {
  for (let x = D.cx - DOME_R; x < D.cx + DOME_R; x++) {
    if (!inGlass(D, x, y + 2)) continue;
    rows.forEach((c, k) => put(b, x, y + k, c));
    const m = ((x % step) + step) % step;
    if (m < 6) put(b, x, y + lampRow, m === 0 ? lampL : lamp);
  }
}
function nodePlate(b, x, y, lamp, lampL, big) {
  if (big) {
    rect(b, x - 6, y - 3, 11, 11, S[1]); rect(b, x - 5, y - 2, 9, 9, S[3]); rect(b, x - 5, y - 2, 9, 1, S[6]); rect(b, x + 3, y - 1, 1, 8, S[4]); rect(b, x - 5, y + 6, 9, 1, S[2]);
    for (const [dx, dy] of [[-4, -1], [2, -1], [-4, 5], [2, 5]]) put(b, x + dx, y + dy, S[7]);
    rect(b, x - 2, y + 1, 3, 3, lamp); put(b, x - 2, y + 1, lampL);
  } else {
    rect(b, x - 4, y - 2, 8, 8, S[1]); rect(b, x - 3, y - 1, 6, 6, S[3]); rect(b, x - 3, y - 1, 6, 1, S[6]); rect(b, x + 2, y, 1, 5, S[4]);
    rect(b, x - 1, y + 1, 2, 2, lamp); put(b, x - 1, y + 1, lampL);
  }
}
function ribFoot(b, x) { rect(b, x - 5, WALL_Y - 3, 10, 9, S[1]); rect(b, x - 4, WALL_Y - 2, 8, 7, S[3]); rect(b, x - 4, WALL_Y - 2, 8, 1, S[6]); rect(b, x + 3, WALL_Y - 1, 1, 6, S[4]); }
const LAT_Y = [WALL_Y, 122, 70, 22], LAT_N = [7, 6, 5, 4];
const latX = (D, k, i) => { const hw = Math.sqrt((DOME_R - RIM) ** 2 - (DOME_BY - LAT_Y[k]) ** 2) - 2; return Math.round(D.cx - hw + 2 * hw * i / (LAT_N[k] - 1)); };
const FAN_A = [20, 40, 60, 80, 100, 120, 140, 160], FAN_R = [112, 176];
const DGL = [];                                   // the glasshouse's baked lamp glows
function domeRibs(b, D) {
  const r = DOME_R, cx = D.cx;
  // bolts round the arch
  for (let a = 0.02; a < Math.PI; a += 0.052) {
    const x = Math.round(cx + Math.cos(a) * (r - 4)), y = Math.round(DOME_BY - Math.sin(a) * (r - 4));
    if (y < WALL_Y - 2) { put(b, x, y, S[7]); put(b, x, y + 1, S[1]); }
  }
  if (D.kind === 'merid') {
    // the proposal's dome: curved meridian ribs, one ring beam with cyan lamps, amber node lamps
    for (const [x0, y0, len] of [[232, 72, 26], [292, 74, 20], [446, 110, 26], [142, 38, 15], [368, 38, 15], [66, 130, 18], [170, 116, 18]]) shine(b, D, x0, y0, len);
    for (const lon of LONS) for (let y = -10; y < WALL_Y; y++) { const x = Math.round(ribX(D, lon, y)); if (ribPx(b, D, x, y) && ((y % 14) + 14) % 14 === 5) { put(b, x, y, S[6]); put(b, x, y + 1, S[1]); } }
    ringBeam(b, D, BEAM_Y, [S[6], S[4], S[3], S[2], S[0]], 3, CYANI, CYANLI, 20);
    for (let x = cx - 250; x < cx + 250; x += 20) if (inGlass(D, x, BEAM_Y + 2) && inGlass(D, x + 6, BEAM_Y + 2)) DGL.push([x + 3, BEAM_Y + 4, CYANI, 9, 0.22]);
    for (const lon of LONS) { const x = Math.round(ribX(D, lon, BEAM_Y + 2)); nodePlate(b, x, BEAM_Y, AMBI, AMBLI, true); DGL.push([x - 1, BEAM_Y + 2, AMBI, 6, 0.25]); BLINK[1].push([x - 1, BEAM_Y + 2]); }
    for (const lon of LONS) ribFoot(b, Math.round(ribX(D, lon, WALL_Y)));
  } else if (D.kind === 'lattice') {
    // a geodesic lattice: three rings of nodes, struts zigzag between them, magenta lamps
    for (const [dx, y0, len] of [[-40, 78, 22], [72, 84, 18], [-150, 132, 20], [150, 128, 18], [-64, 30, 14], [30, 34, 14]]) shine(b, D, cx + dx, y0, len);
    for (let k = 0; k < 3; k++) for (let j = 0; j < LAT_N[k + 1]; j++) {
      const ux = latX(D, k + 1, j), uy = LAT_Y[k + 1];
      ribLine(b, D, ux, uy, latX(D, k, j), LAT_Y[k]); ribLine(b, D, ux, uy, latX(D, k, j + 1), LAT_Y[k]);
    }
    for (let j = 0; j < LAT_N[3]; j++) ribLine(b, D, latX(D, 3, j), LAT_Y[3], cx + (j - 1.5) * 10, DOME_BY - r + RIM);
    ringBeam(b, D, 122 - 1, [S[5], S[3], S[2], S[0]], 2, I('#b8387c'), MAGI, 24);
    ringBeam(b, D, 70 - 1, [S[5], S[3], S[2], S[0]], 2, I('#b8387c'), MAGI, 24);
    for (let j = 0; j < LAT_N[1]; j++) { const x = latX(D, 1, j); nodePlate(b, x, 121, MAGI, MAGLI, false); DGL.push([x, 123, MAGI, 6, 0.24]); }
    for (let j = 0; j < LAT_N[2]; j++) { const x = latX(D, 2, j); nodePlate(b, x, 68, AMBI, AMBLI, true); DGL.push([x - 1, 70, AMBI, 6, 0.25]); BLINK[0].push([x - 1, 70]); }
    for (let j = 0; j < LAT_N[0]; j++) ribFoot(b, latX(D, 0, j));
  } else {
    // a fan window: two arcs round the middle, straight ribs radiating from it, amber lamps
    for (const [dx, y0, len] of [[-30, 60, 24], [84, 92, 20], [-136, 124, 20], [160, 132, 18], [-70, 30, 14], [40, 150, 14]]) shine(b, D, cx + dx, y0, len);
    for (const ad of FAN_A) {
      const a = ad * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      ribLine(b, D, cx + ca * 52, DOME_BY - sa * 52, cx + ca * (r - RIM), DOME_BY - sa * (r - RIM));
    }
    for (const fr of FAN_R) for (let a = 0; a < Math.PI; a += 0.004) {
      const ca = Math.cos(a), sa = Math.sin(a);
      [S[1], S[2], S[4], S[5]].forEach((c, k) => { const x = Math.round(cx + ca * (fr - 1 + k)), y = Math.round(DOME_BY - sa * (fr - 1 + k)); if (y < WALL_Y) put(b, x, y, c); });
    }
    for (let ad = 8; ad < 176; ad += 6) {                           // lamps along the outer arc
      const a = ad * Math.PI / 180, x = Math.round(cx + Math.cos(a) * (FAN_R[1] + 1)), y = Math.round(DOME_BY - Math.sin(a) * (FAN_R[1] + 1));
      if (y < WALL_Y - 4) { put(b, x, y, AMBI); put(b, x + 1, y, I('#c98a16')); if (ad % 18 === 8) DGL.push([x, y, AMBI, 7, 0.2]); }
    }
    for (const ad of FAN_A) {
      const a = ad * Math.PI / 180;
      for (const [fr, big] of [[FAN_R[1], true], [FAN_R[0], false]]) { const x = Math.round(cx + Math.cos(a) * fr), y = Math.round(DOME_BY - Math.sin(a) * fr); if (y < WALL_Y - 8) { nodePlate(b, x, y - 2, big ? AMBI : CYANI, big ? AMBLI : CYANLI, big); DGL.push([x - 1, y, big ? AMBI : CYANI, 6, 0.25]); if (big) BLINK[2].push([x - 1, y]); } }
      const rr = (DOME_BY - WALL_Y) / Math.sin(a);
      if (rr >= 52 && rr < r - RIM) ribFoot(b, Math.round(cx + Math.cos(a) * rr));
    }
    for (const fr of FAN_R) for (const sd of [-1, 1]) ribFoot(b, Math.round(cx + sd * Math.sqrt(fr * fr - (DOME_BY - WALL_Y) ** 2)));
  }
}
// what hangs on the base wall: the proposal's own pieces in its screen, the same kit along the rest
function wallDoor(b, x) {
  rect(b, x, 181, 26, 30, S[0]); rect(b, x + 1, 182, 24, 29, S[3]); rect(b, x + 2, 187, 22, 24, S[2]); rect(b, x + 13, 187, 1, 24, S[0]); rect(b, x + 2, 187, 22, 1, S[4]); rect(b, x + 6, 193, 4, 3, S[0]); rect(b, x + 17, 193, 4, 3, S[0]);
  for (let i = 0; i < 24; i++) for (let k = 0; k < 4; k++) put(b, x + 1 + i, 182 + k, ((i + k) >> 2) % 2 ? HAZA : HAZB);
}
function wallScreen(b, x) {
  rect(b, x, 183, 17, 12, S[0]); rect(b, x + 1, 184, 15, 10, S[3]); rect(b, x + 2, 185, 13, 8, GN[0]);
  pix(b, x + 3, 186, ['...ggggg...', '.gg.....gg.', 'g...lGl...g', 'g...GlG...g', '.gg.....gg.', '...ggggg...'], { g: GN[2], G: GN[3], l: GN[5] });
}
function wallDress(b) {
  // the hull in the top corners of the proposal's screen
  plaque(b, 6, 42, 3, 5); vent(b, 8, 60, 16, 7); plaque(b, 446, 42, 3, 9);
  vent(b, 286, 190, 22, 9); vent(b, 44, 190, 18, 9); wallDoor(b, 156); wallScreen(b, 188);
  for (let x = b.u0 + 30, i = 0; x < b.u1 - 30; x += 78 + Math.floor(nz(i, 71) * 50), i++) {
    if (x > -40 && x < 520) continue;
    if (Math.abs(x - PYL[1]) < 40) continue;                        // the nectar fall comes down here
    const k = nz(i, 72);
    if (k < 0.3) vent(b, x, 190, 18 + Math.floor(nz(i, 73) * 8), 9);
    else if (k < 0.5) { wallDoor(b, x); if (nz(i, 74) > 0.4) wallScreen(b, x + 32); }
    else if (k < 0.75) plaque(b, x, 189, 2 + Math.floor(nz(i, 75) * 3), 30 + i, 1);
    else { vent(b, x, 190, 14, 7); plaque(b, x + 22, 189, 2, 50 + i, 1, MAGI); }
  }
  for (const D of [DOMES[0], DOMES[2]]) { plaque(b, D.cx - 244, 42, 3, 15 + D.cx); vent(b, D.cx + 222, 58, 16, 7); }
}
// PYLON L, the GREENHOUSE LAB: a lit window onto shelves of specimen jars under a grow-lamp, pipes, a porthole
const LABX = PYL[0], LAB = { x0: LABX - 33, y0: 58, w: 66, h: 34 };
function paintLab(b) {
  const { x0, y0, w, h } = LAB, X = LABX;
  const ROOM = Pc('#0a1a2a', '#0f2a3a', '#143e4e', '#1b5464', '#267080');
  rect(b, x0 - 4, y0 - 4, w + 8, h + 8, S[0]); rect(b, x0 - 3, y0 - 3, w + 6, h + 6, S[4]); rect(b, x0 - 3, y0 - 3, w + 6, 1, S[6]); rect(b, x0 - 3, y0 + h + 2, w + 6, 1, S[2]); rect(b, x0 + w + 2, y0 - 2, 1, h + 4, S[3]);
  rect(b, x0 - 1, y0 - 1, w + 2, h + 2, S[0]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(b, x0 + x, y0 + y, ramp(ROOM, 0.66 - y / h * 0.5 + (nz(x + 31, y + 77) - 0.5) * 0.06, x, y, 0.5));
  rect(b, x0 + 5, y0 + 1, w - 10, 1, S[3]);                                              // the grow-lamp
  for (let x = x0 + 7; x < x0 + w - 7; x += 4) { put(b, x, y0 + 2, MAGLI); put(b, x + 1, y0 + 2, MAGI); }
  const GLS = I('#3f8fa8'), GLD = I('#122c3c');
  const jar = (x, base, wj, hj, pal, top) => {
    rect(b, x, base - hj, wj, hj, GLD); const lq = Math.round(hj * 0.62);
    rect(b, x, base - lq, wj, lq, pal[2]); rect(b, x, base - lq, wj, 1, pal[4]); rect(b, x + wj - 1, base - lq + 1, 1, lq - 1, pal[1]);
    rect(b, x, base - hj, 1, hj, GLS); rect(b, x - 1, base - hj - 1, wj + 2, 1, S[5]);
    if (top === 1) { put(b, x + (wj >> 1), base - lq - 1, pal[4]); put(b, x + (wj >> 1), base - lq - 2, pal[3]); put(b, x + (wj >> 1) - 1, base - lq - 3, pal[4]); put(b, x + (wj >> 1) + 1, base - lq - 3, pal[4]); }
    if (top === 2) { rect(b, x + 1, base - lq - 3, wj - 2, 2, pal[3]); put(b, x + (wj >> 1), base - lq - 1, pal[1]); }
  };
  const sh1 = y0 + 15, sh2 = y0 + 32;
  rect(b, x0 + 2, sh1, w - 4, 1, S[5]); rect(b, x0 + 2, sh1 + 1, w - 4, 1, S[1]);
  [[4, PINK, 1], [11, TEAL, 2], [24, ORNG, 1], [31, VIOL, 0], [46, PINK, 2], [53, CREAM, 1], [59, TEAL, 0]].forEach(([dx, pal, top], i) => jar(x0 + dx, sh1, 5, 8 + (i % 3), pal, top));
  rect(b, x0 + 2, sh2, w - 4, 2, S[4]);
  jar(x0 + 5, sh2, 9, 13, ORNG, 2); jar(x0 + 49, sh2, 7, 11, VIOL, 1);
  // a round flask on a burner, a screen with a growth curve
  oval(b, x0 + 30, sh2 - 6, 5.5, 5.5, GLD); shape(b, x0 + 24, sh2 - 7, x0 + 36, sh2, (x, y) => (x - x0 - 30) ** 2 + (y - sh2 + 6) ** 2 <= 30 && y > sh2 - 7, PINK[2]);
  rect(b, x0 + 29, sh2 - 14, 3, 4, GLD); rect(b, x0 + 29, sh2 - 14, 1, 4, GLS); rect(b, x0 + 26, sh2 - 7, 9, 1, PINK[4]); put(b, x0 + 27, sh2 - 9, GLS);
  rect(b, x0 + 14, sh2 - 12, 11, 9, S[0]); rect(b, x0 + 15, sh2 - 11, 9, 7, I('#0c2c3a'));
  for (let k = 0; k < 8; k++) put(b, x0 + 16 + k, sh2 - 6 - Math.round(k * k * 0.07), CYANI);
  rect(b, x0 + 19, sh2 - 3, 1, 3, S[3]);
  for (const mx of [x0 + 21, x0 + 43]) { rect(b, mx, y0, 2, h, S[3]); rect(b, mx, y0, 1, h, S[5]); }   // mullions
  for (const [sx, sy, len] of [[x0 + 12, y0 + 3, 14], [x0 + 36, y0 + 5, 11], [x0 + 60, y0 + 3, 13]]) for (let k = 0; k < len; k++) {
    for (let i = 0; i < 2; i++) { const px = sx - Math.round(k * 0.7) + i, py = sy + k, v = get(b, px, py); if (v !== NONE && px >= x0 && px < x0 + w) put(b, px, py, mixI(v, 0xbfe8ff, 0.2)); }
  }
  for (let i = -3; i < w + 3; i++) for (let k = 0; k < 3; k++) put(b, x0 + i, y0 + h + 4 + k, ((i + k + 40) >> 2) % 2 ? HAZA : HAZB);
  rect(b, x0 - 3, y0 + h + 7, w + 6, 1, S[0]);
  // the sign: a flask and glyphs
  rect(b, X - 22, 38, 45, 13, S[3]); rect(b, X - 21, 39, 43, 11, S[0]);
  pix(b, X - 18, 41, ['.ccc.', '..c..', '..c..', '.cpc.', 'cpppc', 'cpppc', '.ccc.'], { c: CYANLI, p: MAGI });
  glyphs(b, X - 9, 42, 4, I('#2bb6d6'), 91);
  for (const sd of [-1, 1]) { rect(b, X + sd * 29 - 2, 42, 5, 5, S[1]); rect(b, X + sd * 29 - 1, 43, 3, 3, AMBI); put(b, X + sd * 29 - 1, 43, AMBLI); }
  // down the pylon: two pipes, a porthole onto space, a vent
  for (const px of [X - 11, X + 8]) for (let y = y0 + h + 8; y < WALL_Y; y++) { ARCHPIPE.forEach((c, k) => put(b, px + k, y, c)); if (y % 18 === 4) for (let k = -1; k < 5; k++) { put(b, px + k, y, S[5]); put(b, px + k, y + 1, S[2]); } }
  const py = 124;
  oval(b, X, py, 10.5, 10.5, S[1]); oval(b, X, py, 9.5, 9.5, S[5]); shape(b, X - 10, py - 10, X + 10, py + 10, (x, y) => (x - X) ** 2 + (y - py) ** 2 <= 90 && (x - X) * 0.5 - (y - py) * 0.8 < -2, S[3]);
  for (let y = py - 7; y <= py + 7; y++) for (let x = X - 7; x <= X + 7; x++) if ((x + 0.5 - X) ** 2 + (y + 0.5 - py) ** 2 <= 49) b.d[(y + b.oy) * b.w + x + b.ox] = NONE;
  for (const [dx, dy] of [[-4, -3], [-5, -2], [-5, -1], [-3, -4]]) put(b, X + dx, py + dy, I('#3a4688'));
  for (const [dx, dy] of [[-8, -8], [7, -8], [-8, 7], [7, 7]]) put(b, X + dx, py + dy, S[7]);
  vent(b, X - 8, 148, 16, 7);
  DGL.push([X, y0 + 14, I('#3fb6d0'), 46, 0.3], [X, y0 + 4, MAGI, 30, 0.22], [X - 29, 44, AMBI, 6, 0.3], [X + 29, 44, AMBI, 6, 0.3]);
}
// PYLON R, the NECTAR WORKS: a glass tank of glowing nectar on a gantry, the fall pouring from its chute down the wall
const WKX = PYL[1], TANK = { x0: WKX - 19, x1: WKX + 19, y0: 44, y1: 92, lvl: 54 }, FALL = { y0: 106, y1: WALL_B, hw: 5 };
const LQH = hz(LQ, 0.16);
const FALLC = Pc('#b02a7c', '#e0569e', '#ff9aca', '#ffd0e8', '#ff9aca', '#ffb8da', '#ffd0e8', '#ff9aca', '#e0569e', '#b02a7c').map(c => mixI(c, HAZE, 0.12));
function paintWorks(b) {
  const X = WKX, { x0, x1, y0, y1, lvl } = TANK;
  // feed pipe down from the ceiling
  for (let y = -10; y < y0 - 4; y++) { [S[1], S[4], S[5], S[3], S[1]].forEach((c, k) => put(b, X - 2 + k, y, c)); if (((y % 16) + 16) % 16 === 3) for (let k = -1; k < 6; k++) { put(b, X - 2 + k, y, S[6]); put(b, X - 2 + k, y + 1, S[2]); } }
  // the tank: steel caps, glass, the nectar inside (darker toward the round sides)
  rect(b, x0 - 3, y0 - 5, x1 - x0 + 6, 6, S[1]); rect(b, x0 - 2, y0 - 4, x1 - x0 + 4, 4, S[4]); rect(b, x0 - 2, y0 - 4, x1 - x0 + 4, 1, S[7]); rect(b, x0 - 2, y0 - 1, x1 - x0 + 4, 1, S[2]);
  rect(b, x0 - 1, y0, x1 - x0 + 2, y1 - y0, S[0]);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const u = (x + 0.5 - X) / (x1 - x0) * 2, edge = u * u;
    if (y < lvl) put(b, x, y, ramp(Pc('#120e2a', '#1c1840', '#2a2458'), 0.3 + (1 - edge) * 0.5 - (u > 0.5 ? 0.2 : 0), x, y, 0.6));
    else put(b, x, y, ramp(LQH, 0.46 + (1 - edge) * 0.36 + (u < -0.2 && u > -0.62 ? 0.12 : 0) - (y - lvl) / (y1 - lvl) * 0.16 + (fbm(x / 7, y / 5, 44, 2) - 0.5) * 0.2, x, y, 0.7));
  }
  for (let x = x0; x < x1; x++) { put(b, x, lvl, LQ[6]); if ((x & 3) === 1) put(b, x, lvl - 1, LQ[5]); }
  for (const hy of [y0 + 15, y0 + 32]) { rect(b, x0 - 1, hy, x1 - x0 + 2, 2, S[4]); rect(b, x0 - 1, hy, x1 - x0 + 2, 1, S[6]); put(b, x0 + 3, hy, S[7]); put(b, x1 - 4, hy, S[7]); }
  for (let y = y0 + 2; y < y1 - 2; y++) { const v = get(b, x0 + 3, y); if (v !== S[4] && v !== S[6] && v !== S[7]) { put(b, x0 + 3, y, mixI(v, WHITE, 0.4)); put(b, x0 + 4, y, mixI(get(b, x0 + 4, y), WHITE, 0.16)); } }
  for (let y = y0 + 4; y < y1 - 2; y += 4) put(b, x1 - 3, y, S[6]);                                   // gauge marks
  rect(b, x0 - 3, y1, x1 - x0 + 6, 5, S[1]); rect(b, x0 - 2, y1, x1 - x0 + 4, 4, S[4]); rect(b, x0 - 2, y1, x1 - x0 + 4, 1, S[6]); rect(b, x0 - 2, y1 + 3, x1 - x0 + 4, 1, S[2]);
  // the gantry it stands on: a deck with a hazard edge, a railing
  rect(b, X - 36, y1 + 5, 72, 3, S[5]); rect(b, X - 36, y1 + 5, 72, 1, S[7]);
  for (let i = 0; i < 72; i++) for (let k = 0; k < 3; k++) put(b, X - 36 + i, y1 + 8 + k, ((i + k) >> 2) % 2 ? HAZA : HAZB);
  rect(b, X - 36, y1 + 11, 72, 1, S[0]);
  for (const sd of [-1, 1]) { for (let i = 0; i < 3; i++) rect(b, X + sd * (24 + i * 5) - (sd < 0 ? 0 : 0), y1 - 4, 1, 9, S[4]); rect(b, X + (sd < 0 ? -35 : 23), y1 - 5, 12, 1, S[6]); }
  // the chute and the fall
  rect(b, X - 8, y1 + 11, 16, 5, S[1]); rect(b, X - 7, y1 + 11, 14, 4, S[3]); rect(b, X - 7, y1 + 11, 14, 1, S[5]); rect(b, X - 6, y1 + 14, 12, 2, S[0]);
  for (let y = FALL.y0; y < FALL.y1; y++) for (let k = 0; k < 10; k++) put(b, X - 5 + k, y, FALLC[k]);
  for (let y = FALL.y0; y < FALL.y0 + 3; y++) for (let k = 0; k < 10; k++) put(b, X - 5 + k, y, mixI(FALLC[k], S[0], 0.5 - (y - FALL.y0) * 0.16));
  // signs: a drop, glyphs
  rect(b, X + 27, 56, 23, 13, S[3]); rect(b, X + 28, 57, 21, 11, S[0]);
  pix(b, X + 30, 59, ['..p..', '..p..', '.pPp.', 'pPPpp', 'pPppp', '.ppp.'], { p: MAGI, P: MAGLI }); glyphs(b, X + 37, 60, 1, I('#2bb6d6'), 63); put(b, X + 45, 62, AMBI); put(b, X + 45, 64, AMBI);
  plaque(b, X - 49, 58, 3, 77, 1, MAGI);
  for (const sd of [-1, 1]) { rect(b, X + sd * 31 - 2, 80, 5, 5, S[1]); rect(b, X + sd * 31 - 1, 81, 3, 3, MAGI); put(b, X + sd * 31 - 1, 81, MAGLI); }
  DGL.push([X, 72, MAGI, 40, 0.24], [X - 31, 82, MAGI, 6, 0.3], [X + 31, 82, MAGI, 6, 0.3]);
  for (let y = FALL.y0 + 8; y < WALL_B; y += 16) DGL.push([X, y, MAGI, 15, 0.2]);
}
{
  const [u0, u1] = uRange(DOME_P);
  parts(u0, u1, 6).forEach(([a, c], i) => STEPS.push(() => { if (!i) { SB = strip(DOME_P, -10, WALL_B + 10); DGL.length = 0; BLINK.forEach(l => { l.length = 0; }); } structCols(SB, a, c); }));
  STEPS.push(() => { domeRibs(SB, DOMES[0]); domeRibs(SB, DOMES[1]); });
  STEPS.push(() => { domeRibs(SB, DOMES[2]); wallDress(SB); paintLab(SB); paintWorks(SB); });
  STEPS.push(() => { ART.dome = done(SB, DGL); SB = null; });
}

// ============================================================
// Far garden (p .65): soft two-tone shapes at the foot of the wall, backlit by garden lamps
// ============================================================
const FAR_P = 0.65, MID_P = 0.8;
const FARPAL = (pal, k) => [mixI(pal[0], HAZE, k), mixI(pal[1], HAZE, k + 0.1), mixI(pal[2], HAZE, k + 0.12)];
function paintFar(b) {
  const FV = FARPAL(VIOL, 0.36), FP = FARPAL(PINK, 0.46), FT = FARPAL(TEAL, 0.42), GLc = mixI(CYANI, HAZE, 0.55);
  // the proposal's screen
  farTree(b, 150, 212, 56, 30, FV, 1); farShroom(b, 236, 212, 36, 20, FV, GLc); farTree(b, 268, 212, 64, 34, FT, 2);
  farShroom(b, 300, 212, 46, 22, FP, GLc); farTree(b, 350, 212, 46, 26, FV, 3); farTree(b, 428, 212, 58, 28, FT, 4);
  farTree(b, 30, 212, 50, 26, FT, 5); farShroom(b, 334, 212, 30, 16, FV, GLc); farShroom(b, 186, 212, 28, 14, FT, GLc);
  farShroom(b, 472, 212, 34, 18, FT, GLc);
  // and the rest of the row
  for (let x = b.u0 + 8, i = 0; x < b.u1; i++) {
    if (x > -40 && x < 506) { x = 506 + Math.floor(nz(i, 80) * 24); continue; }
    const pal = [FV, FT, FP, FV, FT][Math.floor(nz(i, 81) * 5)];
    if (nz(i, 82) < 0.58) farTree(b, x, 212, 42 + Math.floor(nz(i, 83) * 26), 24 + Math.floor(nz(i, 84) * 12), pal, 10 + i);
    else farShroom(b, x, 212, 26 + Math.floor(nz(i, 85) * 24), 14 + 2 * Math.floor(nz(i, 86) * 5), pal, GLc);
    x += 30 + Math.floor(nz(i, 87) * 46);
  }
  // a low haze of leaves along the wall foot
  for (let x = b.u0; x < b.u1; x++) { const hgt = 3 + Math.floor(fbm(x / 14, 3, 61, 2) * 9); for (let k = 0; k < hgt; k++) put(b, x, 212 - k, k === hgt - 1 && nz(x, 9) > 0.5 ? FV[1] : FV[0]); }
  // garden lamps at the foot of the wall (baked under the shapes)
  const lamps = [[40, MAGI], [150, I('#9a74f0')], [262, CYANI], [352, MAGI], [452, I('#9a74f0')]].map(([x, c]) => [x, 196, c, 48, 0.26]);
  const LC = [MAGI, I('#9a74f0'), CYANI];
  for (let x = b.u0 + 30, i = 0; x < b.u1; x += 96 + Math.floor(nz(i, 88) * 30), i++) if (x < -30 || x > 520) lamps.push([x, 196, LC[i % 3], 48, 0.26]);
  return lamps;
}
STEPS.push(() => { const b = strip(FAR_P, 100, 116); ART.far = done(b, paintFar(b), true); });

// ============================================================
// The groves (p .8): from the left dandelion trees, spiral trees, the proposal's three bubble trees, a mushroom
// forest, lantern willows; a calm hedge along the wall foot behind them all
// ============================================================
const MGL = [];
const MIDPARTS = (() => {
  const HV = [mixI(VIOL[0], HAZE, 0.2), mixI(VIOL[1], HAZE, 0.4), mixI(VIOL[2], HAZE, 0.5)], HT = [mixI(TEAL[0], HAZE, 0.2), mixI(TEAL[1], HAZE, 0.4), mixI(TEAL[2], HAZE, 0.5)], HP = [mixI(PINK[0], HAZE, 0.2), mixI(PINK[1], HAZE, 0.45), mixI(PINK[2], HAZE, 0.55)];
  const TR = hz(TRUNK, 0.15), STEM = hz(CREAM, 0.45).slice(0, 3), GC = mixI(CYANI, HAZE, 0.3);
  const DSTK = hz(Pc('#123e58', '#1a6078', '#3a9ab0'), 0.2), DPAL = hz(Pc('#3a4a78', '#6a80b0', '#b8cce0', '#e6f6ff', '#ffffff'), 0.24);
  const SPV = [mixI(VIOL[0], HAZE, 0.3), mixI(VIOL[1], HAZE, 0.2), mixI(VIOL[2], HAZE, 0.22), I('#d07ab8')], SPT = [mixI(TEAL[0], HAZE, 0.3), mixI(TEAL[1], HAZE, 0.3), mixI(TEAL[2], HAZE, 0.3), I('#d8c890')];
  const WLEAF = hz([TEAL[0], TEAL[1], TEAL[2]], 0.22), WLEAFV = hz([VIOL[0], VIOL[1], VIOL[3]], 0.24);
  return [
    b => {   // the hedge: the proposal's bushes, then the rest of the row
      for (const [x, w, h, pal, sd] of [[-30, 50, 20, HV, 1], [20, 40, 15, HT, 2], [70, 46, 12, HV, 3], [150, 40, 12, HP, 4], [200, 50, 15, HV, 5], [272, 46, 13, HT, 6], [316, 36, 16, HV, 7], [474, 40, 16, HP, 8], [512, 50, 20, HV, 9]]) bush(b, x, 211, w, h, pal, sd);
      for (let x = b.u0, i = 0; x < b.u1 + 30; i++) {
        if (x > -70 && x < 548) { x = 548 + Math.floor(nz(i, 90) * 20); continue; }
        bush(b, x, 211, 36 + Math.floor(nz(i, 91) * 18), 11 + Math.floor(nz(i, 92) * 9), [HV, HT, HV, HP][Math.floor(nz(i, 93) * 4)], 20 + i);
        x += 36 + Math.floor(nz(i, 94) * 26);
      }
    },
    b => {   // far left (seen only while the hangar's backdrop fades out): a few of each
      spiralTree(b, -764, 211, 100, 1, 6, SPV, hz(ORNG, 0.1), 5); dandelion(b, -690, 211, 96, 20, DSTK, DPAL, 1);
      spiralTree(b, -610, 211, 120, -1, 7, SPT, hz(PINK, 0.1), 6); dandelion(b, -524, 211, 78, 16, DSTK, DPAL, 2);
    },
    b => {   // spiral trees: giant fiddleheads hung with lantern bulbs
      spiralTree(b, -428, 211, 96, -1, 6, SPV, hz(ORNG, 0.1), 1); spiralTree(b, -366, 211, 134, 1, 8, SPT, hz(PINK, 0.1), 2);
    },
    b => {   // dandelion trees
      dandelion(b, -234, 211, 120, 25, DSTK, DPAL, 3); dandelion(b, -178, 211, 76, 16, DSTK, DPAL, 4);
      dandelion(b, -120, 211, 102, 21, DSTK, DPAL, 5); dandelion(b, -64, 211, 58, 12, DSTK, DPAL, 6);
    },
    b => {   // the proposal's screen: tall mushrooms to the right, the pink bubble tree
      tallShroom(b, 451, 210, 80, 26, hz(VIOL, 0.26), STEM, GC); tallShroom(b, 476, 210, 56, 20, hz(PINK, 0.3), STEM, GC);
      tallShroom(b, 432, 210, 40, 16, hz(VIOL, 0.38), hz(CREAM, 0.5).slice(0, 3), mixI(CYANI, HAZE, 0.4));
      bubbleTree(b, 16, 211, 92, 24, TR, hz(PINK, 0.12), 11);
    },
    b => bubbleTree(b, 196, 211, 84, 24, TR, hz(TEAL, 0.1), 23),
    b => bubbleTree(b, 318, 211, 98, 21, TR, Pc('#8a3414', '#d2581c', '#f8962e', '#ffc85a', '#fff0b4'), 37),
    b => {   // the mushroom forest
      tallShroom(b, 532, 211, 104, 38, hz(TEAL, 0.2), STEM, GC); tallShroom(b, 574, 211, 58, 22, hz(PINK, 0.32), STEM, GC);
      tallShroom(b, 626, 211, 128, 48, hz(VIOL, 0.18), STEM, mixI(MAGI, HAZE, 0.2)); tallShroom(b, 672, 211, 72, 26, hz(TEAL, 0.3), STEM, GC);
      tallShroom(b, 714, 211, 46, 18, hz(VIOL, 0.36), STEM, GC); tallShroom(b, 756, 211, 94, 32, hz(VIOL, 0.26), STEM, GC);
      tallShroom(b, 794, 211, 60, 22, hz(PINK, 0.34), STEM, GC);
    },
    b => willow(b, 884, 211, 114, 40, TR, WLEAF, hz(ORNG, 0.06), 1),
    b => bubbleTree(b, 968, 211, 100, 22, TR, hz(CREAM, 0.12), 51),
    b => willow(b, 1052, 211, 132, 46, TR, WLEAFV, hz(PINK, 0.06), 2),
    b => bubbleTree(b, 1140, 211, 90, 24, TR, hz(VIOL, 0.12), 61),
    b => willow(b, 1226, 211, 108, 40, TR, WLEAF, hz(ORNG, 0.06), 3)
  ];
})();
MIDPARTS.forEach((f, i) => STEPS.push(() => { if (!i) { SB = strip(MID_P, 50, 166); MGL.length = 0; } GL = MGL; f(SB); GL = null; }));
STEPS.push(() => { ART.mid = done(SB, MGL); SB = null; });

// ============================================================
// The terrace (world): the raised planter wall behind the catwalk and everything on it
// ============================================================
const TGL = [];
const TB0 = A0 - 4, TTOP = 130;
const MOSS = Pc('#3a1458', '#7a2a8e', '#c85ab8', '#ff9ad8'), MOSS2 = Pc('#0e3a52', '#1a6a86', '#3fb6c8', '#a8f0f6');
const FERN = [TEAL[0], TEAL[1], TEAL[3], I('#ff9ad8')], FERNV = [VIOL[0], VIOL[2], VIOL[3], I('#ffe9a8')];
const STK = I('#1a6078'), STK3 = Pc('#123e58', '#1a6078', '#3a9ab0');
const SPRINK = [1702, 1868, 2358, 2504, 2716, 3172];
const SPOUTS = [{ x: 1968, w: 8, gap: true }, { x: 2400, w: 6, gap: false }, { x: 2830, w: 14, gap: true }, { x: 3062, w: 6, gap: true }];
const inGap = x => nectarList().some(n => x >= n.x0 - 4 && x < n.x1 + 4);
// grass along the planter top (the noise is read in the proposal's screen coordinates, so its screen stays as it was)
function grassW(b, x0, x1, pal, seed, hmax) {
  for (let x = x0; x < x1; x++) {
    const sx = x - CAM, hgt = 1 + Math.floor(nz(sx, seed) * nz(sx >> 2, seed + 1) * (hmax + 1.5));
    for (let k = 0; k < hgt; k++) put(b, x + (k > 2 && nz(sx, seed + 2) > 0.5 ? 1 : 0), TER - 1 - k, k === hgt - 1 ? pal[2] : k > 0 ? pal[1] : pal[0]);
  }
}
function terraceWall(b) {
  for (let x = TB0; x < A1 + 4; x++) {
    const u = x % 48, bot = inGap(x) ? SURF + 3 : DECK;
    for (let y = TER; y < bot; y++) {
      let c = y === TER ? S[5] : y === TER + 1 ? S[4] : y === TER + 2 ? S[1] : y < TER + 14 ? (bay(x, y) < 0.5 ? S[2] : S[1]) : y > DECK - 3 ? S[0] : S[1];
      if (y > TER + 2 && u === 0) c = S[0];
      if (y > TER + 2 && u === 1 && y <= DECK - 3) c = S[2];
      if (y >= DECK + 3) c = mixI(S[0], LQ[3], (y - DECK - 2) * 0.1);                               // the pond lights the wall's foot
      put(b, x, y, c);
    }
    [S[0], S[4], S[3], S[2], S[0]].forEach((c, k) => put(b, x, TER + 4 + k, c));                    // irrigation pipe
    if (x % 32 < 3) for (let k = 0; k < 5; k++) put(b, x, TER + 4 + k, k === 0 ? S[5] : k === 4 ? S[1] : S[3]);
    const m = x % 16;                                                                               // magenta guide strip
    put(b, x, TER + 20, S[0]); put(b, x, TER + 22, S[0]);
    put(b, x, TER + 21, m < 9 ? (m === 0 ? MAGLI : MAGI) : S[0]);
    const sx = x - CAM;                                                                             // soil and moss along the top
    put(b, x, TER - 1, nz(sx, 5) > 0.3 ? MOSS[1] : MOSS[0]); if (nz(sx, 6) > 0.6) put(b, x, TER, MOSS[0]); if (nz(sx, 7) > 0.86) put(b, x, TER + 1, MOSS[1]);
  }
  grassW(b, TB0, PAD.x0 - 4, MOSS2, 31, 4);
  grassW(b, PAD.x0 - 4, PAD.x1 + 6, [MOSS[1], MOSS[2], MOSS[3]], 41, 5);                            // the pasture: pink grass
  grassW(b, PAD.x1 + 6, 2910, MOSS2, 51, 4);
  grassW(b, 2910, 3046, [MOSS[1], MOSS[2], MOSS[3]], 43, 4);                                        // the milking parlour's
  grassW(b, 3046, A1 + 4, MOSS2, 53, 4);
  // spouts in the wall that feed the pond (their streams are drawn live)
  for (const s of SPOUTS) {
    const hw = (s.w >> 1) + 3;
    rect(b, s.x - hw, TER + 8, hw * 2, 8, S[0]); rect(b, s.x - hw + 1, TER + 9, hw * 2 - 2, 6, S[3]); rect(b, s.x - hw + 1, TER + 9, hw * 2 - 2, 1, S[5]); rect(b, s.x - (s.w >> 1), TER + 13, s.w, 3, S[0]);
    if (s.w > 10) { for (let i = 0; i < hw * 2; i++) put(b, s.x - hw + i, TER + 7, ((i + 1) >> 1) % 2 ? HAZA : HAZB); }
  }
  for (const [x, w] of [[1664, 16], [1830, 18], [2112, 16], [2264, 16], [2578, 18], [2712, 16], [2960, 18], [3180, 16]]) vent(b, x, TER + 11, w, 6);
  plaque(b, 1760, TER + 11, 3, 23, 1); plaque(b, 2156, TER + 11, 2, 33, 1, MAGI); plaque(b, 2420, TER + 11, 3, 13, 1); plaque(b, 3010, TER + 11, 3, 43, 1);
  for (const x of SPRINK) { rect(b, x, TER - 6, 1, 6, S[4]); rect(b, x - 1, TER - 8, 3, 2, S[6]); put(b, x, TER - 8, CYANLI); }
}
const P = (b, x, hw, top, fn, edge = EDGE) => plant(b, x - hw, top, x + hw, TER + 2, fn, edge);
// thin things that sway a little: baked one by one and blitted in runs of rows that share one offset (see swayDraw)
const SWAYERS = [];
function swayer(x0, y0, x1, y1, amp, fn) {
  const t = buf(x1 - x0 + 3, y1 - y0 + 3, 1 - x0, 1 - y0);
  fn(t); outline(t, EDGE);
  SWAYERS.push({ c: bake(t), x: x0 - 1, y: y0 - 1, w: x1 - x0 + 3, base: TER, h: TER - y0, amp, ph: (x0 * 0.37) % 6.28 });
}
const PS = (x, hw, top, amp, fn) => swayer(x - hw, top, x + hw, TER + 2, amp, fn);
function pf(b, x, h, dir, w, pal) {
  const cr = Math.max(4, h * 0.24), far = h * 0.2 + cr * 2 + w + 3, near = w * 2 + 6;
  plant(b, Math.floor(x - (dir < 0 ? far : near)), TER - h - 6, Math.ceil(x + (dir > 0 ? far : near)), TER + 2, t => fiddle(t, x, TER, h, dir, w, pal), EDGE);
}
function tag(b, x, c) { rect(b, x, TER - 5, 1, 5, S[5]); rect(b, x - 1, TER - 8, 4, 3, c); put(b, x, TER - 7, S[0]); }
// the nursery: a steel rack of seedling pots under grow-lamps
const POT = Pc('#3a2c5a', '#6a56a0', '#9a88cc');
function nursery(b, x0) {
  const top = TER - 44;
  for (const ux of [x0, x0 + 60, x0 + 120]) { rect(b, ux, top, 3, 44, S[3]); rect(b, ux, top, 1, 44, S[5]); rect(b, ux + 2, top, 1, 44, S[1]); }
  rect(b, x0 - 2, top - 2, 127, 2, S[4]); rect(b, x0 - 2, top - 2, 127, 1, S[6]);
  for (const [sy, row] of [[TER - 30, 0], [TER - 14, 1], [TER, 2]]) {
    if (row < 2) { rect(b, x0 + 3, sy, 117, 2, S[4]); rect(b, x0 + 3, sy, 117, 1, S[6]); rect(b, x0 + 63, sy, 57, 1, S[5]); }
    rect(b, x0 + 4, sy - 13, 115, 1, S[2]);                                                        // the lamp bar above this shelf
    for (let x = x0 + 7; x < x0 + 118; x += 5) if (Math.abs(x - x0 - 61) > 3) { put(b, x, sy - 12, MAGLI); put(b, x + 1, sy - 12, MAGI); }
    for (let k = 0; k < 8; k++) {
      const px = x0 + 10 + (k % 4) * 13 + (k > 3 ? 60 : 0), q = Math.floor(nz(k + row * 8, 61) * 5), pal = [TEAL, PINK, VIOL, ORNG, CREAM][q], gh = 2 + Math.floor(nz(k + row * 8, 62) * 4);
      rect(b, px - 2, sy - 4, 5, 4, POT[1]); rect(b, px - 3, sy - 5, 7, 1, POT[2]); rect(b, px + 1, sy - 4, 1, 4, POT[0]); put(b, px - 2, sy - 1, POT[0]);
      for (let j = 0; j < gh; j++) put(b, px, sy - 6 - j, pal[2]);
      if ((k + row) % 3 === 0) { put(b, px - 1, sy - 6 - gh, pal[4]); put(b, px + 1, sy - 6 - gh, pal[4]); put(b, px, sy - 7 - gh, pal[3]); }
      else if ((k + row) % 3 === 1) { put(b, px - 1, sy - 5 - gh, pal[3]); put(b, px - 2, sy - 6 - gh, pal[4]); put(b, px + 1, sy - 6 - gh, pal[3]); put(b, px + 2, sy - 7 - gh, pal[4]); }
      else { rect(b, px - 1, sy - 8 - gh, 3, 3, pal[3]); put(b, px, sy - 7 - gh, pal[4]); put(b, px - 1, sy - 6 - gh, pal[2]); }
    }
    TGL.push([x0 + 32, sy - 8, MAGI, 30, 0.2], [x0 + 92, sy - 8, MAGI, 30, 0.2]);
  }
}
// a glass cloche with one specimen in it, on the lab bench
function cloche(b, x, base, r, hgt, fn) {
  const G1 = I('#4f9fba'), G2 = I('#bdf4fa');
  fn(b);
  for (let i = -r; i <= r; i++) { const u = i / (r + 0.5), top = base - hgt + Math.round((1 - Math.sqrt(1 - u * u)) * r); put(b, x + i, top, i > r * 0.2 ? G1 : G2); if (Math.abs(i) === r) for (let y = top; y < base; y++) put(b, x + i, y, i < 0 ? G2 : G1); }
  rect(b, x - 1, base - hgt - 2, 3, 2, G2); put(b, x + 1, base - hgt - 1, G1);
  put(b, x - r + 2, base - hgt + r - 1, WHITE); put(b, x - r + 2, base - hgt + r, G2); put(b, x - r + 2, base - hgt + r + 2, G2); put(b, x - r + 3, base - hgt + r - 3, G2);
  rect(b, x - r - 1, base, r * 2 + 3, 2, S[5]); rect(b, x - r - 1, base, r * 2 + 3, 1, S[7]);
}
function labBench(b, x0) {
  const top = TER - 6;
  rect(b, x0, top, 104, 3, S[4]); rect(b, x0, top, 104, 1, S[6]); rect(b, x0, top + 2, 104, 1, S[1]);
  for (const lx of [x0 + 4, x0 + 50, x0 + 98]) { rect(b, lx, top + 3, 2, 3, S[3]); }
  cloche(b, x0 + 16, top - 2, 9, 20, t => { starFlower(t, x0 + 16, top - 2, 9, CREAM, STK, 0); });
  cloche(b, x0 + 47, top - 2, 13, 28, t => { limb(t, x0 + 47, top - 2, x0 + 47, top - 14, 3, 2, TRUNK); for (const [dx, dy, r] of [[-5, -16, 4], [4, -17, 4.5], [0, -21, 4], [-2, -12, 2.5], [6, -12, 2.5]]) bubble(t, x0 + 47 + dx, top - 2 + dy, r, PINK); glowAt(x0 + 47, top - 18, PINK[3], 12, 0.3); });
  cloche(b, x0 + 76, top - 2, 8, 17, t => { shroomlet(t, x0 + 76, top - 2, 9, 6, ORNG, AMBLI); });
  // a scanner arm with a lamp (it blinks live), a rack of test tubes
  rect(b, x0 + 93, top - 18, 2, 18, S[4]); rect(b, x0 + 93, top - 18, 1, 18, S[6]); rect(b, x0 + 86, top - 19, 9, 2, S[4]); rect(b, x0 + 85, top - 17, 3, 3, S[2]);
  for (let k = 0; k < 3; k++) { rect(b, x0 + 30 + k * 3, top - 6, 2, 6, [PINK[3], CYANI, AMBI][k]); put(b, x0 + 30 + k * 3, top - 7, WHITE); }
  rect(b, x0 + 29, top - 2, 10, 1, S[5]);
  tag(b, x0 + 62, AMBI);
}
// the milking parlour: a little stall with the milking robot (the cow, the hose and the bottles are drawn live)
const PARL = { x0: 2916, x1: 3040, cow: 2948, mach: 2984 };
function parlour(b) {
  const { x0, x1, mach } = PARL;
  for (const x of [x0, x0 + 64]) { rect(b, x - 2, TER - 20, 5, 21, S[1]); rect(b, x - 1, TER - 20, 3, 20, S[4]); rect(b, x + 1, TER - 20, 1, 20, S[6]); rect(b, x - 1, TER - 20, 3, 1, S[7]); }
  rect(b, x0 + 2, TER - 15, 62, 1, S[5]); rect(b, x0 + 2, TER - 14, 62, 1, S[2]);                 // a plain steel rail
  // the machine: a cabinet with a dial, a glass jar on top, the bottle belt to its right
  rect(b, mach, TER - 22, 20, 22, S[1]); rect(b, mach + 1, TER - 21, 18, 21, S[4]); rect(b, mach + 1, TER - 21, 18, 1, S[7]); rect(b, mach + 16, TER - 20, 3, 20, S[3]); rect(b, mach + 1, TER - 21, 2, 21, S[5]);
  rect(b, mach + 4, TER - 17, 9, 7, S[0]); rect(b, mach + 5, TER - 16, 7, 5, I('#12243a'));
  for (let i = 0; i < 18; i++) put(b, mach + 1 + i, TER - 3, ((i >> 1) % 2) ? HAZA : HAZB); rect(b, mach + 1, TER - 2, 18, 1, HAZB);
  rect(b, mach + 5, TER - 36, 11, 14, S[0]); rect(b, mach + 6, TER - 35, 9, 12, I('#1a2a4a')); rect(b, mach + 6, TER - 35, 1, 12, I('#8fd0e6')); rect(b, mach + 4, TER - 37, 13, 2, S[5]); rect(b, mach + 4, TER - 37, 13, 1, S[7]);
  rect(b, mach + 20, TER - 6, 38, 2, S[4]); rect(b, mach + 20, TER - 6, 38, 1, S[6]);
  for (let x = mach + 22; x < mach + 58; x += 6) { rect(b, x, TER - 4, 2, 4, S[2]); }
  rect(b, mach + 20, TER - 14, 3, 8, S[3]); rect(b, mach + 20, TER - 15, 6, 2, S[5]);              // the filler nozzle
  // the sign: a milk bottle
  rect(b, x1 - 4, TER - 30, 1, 30, S[4]);
  rect(b, x1 - 11, TER - 44, 15, 15, S[4]); rect(b, x1 - 10, TER - 43, 13, 13, S[0]); rect(b, x1 - 11, TER - 44, 15, 1, S[6]);
  pix(b, x1 - 7, TER - 42, ['..cc..', '..ww..', '.wwww.', 'wwwwww', 'wWwwww', 'wWwwww', 'wWwwww', 'wwwwww', '.wwww.'], { c: CYANI, w: I('#f2f6ff'), W: WHITE });
}
function hayBales(b, x0) {
  const HY = Pc('#7a5a1e', '#b88a2e', '#e0b84a', '#f6dc86');
  const bale = (x, y) => { rect(b, x, y - 9, 16, 9, HY[1]); rect(b, x, y - 9, 16, 1, HY[3]); rect(b, x, y - 1, 16, 1, HY[0]); rect(b, x + 15, y - 8, 1, 7, HY[0]); for (let i = 0; i < 9; i++) put(b, x + 1 + Math.floor(nz(x + i, y) * 14), y - 2 - Math.floor(nz(x, y + i) * 6), i % 2 ? HY[2] : HY[0]); for (const sx of [x + 4, x + 11]) rect(b, sx, y - 9, 1, 9, I('#c0384a')); };
  bale(x0, TER); bale(x0 + 17, TER); bale(x0 + 34, TER); bale(x0 + 8, TER - 9); bale(x0 + 26, TER - 9);
  // a pitchfork leaning on them
  line(b, x0 + 55, TER, x0 + 50, TER - 24, S[5]); for (const dx of [-2, 0, 2]) line(b, x0 + 50 + dx, TER - 24, x0 + 49 + dx, TER - 30, S[6]); rect(b, x0 + 47, TER - 24, 6, 1, S[5]);
}
const TERPARTS = [
  b => { TGL.length = 0; SWAYERS.length = 0; terraceWall(b); },
  b => {   // 1600-2190: the nursery, the tall star flowers, the first gap, the lab bench
    plant(b, 1650, TER - 50, 1780, TER + 2, t => nursery(t, 1654), EDGE);
    pf(b, 1802, 34, -1, 3, FERNV);
    PS(1822, 12, TER - 44, 1.6, t => tallStar(t, 1822, TER, 30, CREAM, STK3, 2));
    PS(1838, 10, TER - 34, 1.2, t => tallStar(t, 1838, TER, 20, PINK, STK3, -1));
    PS(1914, 12, TER - 54, 2, t => tallStar(t, 1914, TER, 40, CREAM, STK3, -2));
    PS(1932, 10, TER - 40, 1.4, t => tallStar(t, 1932, TER, 26, TEAL, STK3, 1));
    P(b, 1896, 8, TER - 16, t => { shroomlet(t, 1894, TER, 7, 4, VIOL, CYANI); shroomlet(t, 1900, TER, 5, 3, VIOL, CYANI); });
    tag(b, 1812, CYANI); tag(b, 1924, MAGLI);
    swayer(1976, TER - 24, 2052, TER + 2, 1.5, t => reeds(t, 1980, 2050, TER, 71, [PINK, CREAM]));
    pf(b, 2066, 26, 1, 3, FERN);
    plant(b, 2080, TER - 40, 2188, TER + 2, t => labBench(t, 2082), EDGE);
  },
  b => {   // 2190-2690: the proposal's screen
    pf(b, 2220, 30, -1, 3, FERNV); pf(b, 2201, 48, 1, 3, FERN);
    P(b, 2285, 12, TER - 16, t => { shroomlet(t, 2282, TER, 9, 7, VIOL, CYANI); shroomlet(t, 2288, TER, 7, 4, VIOL, CYANI); });
    P(b, 2368, 26, TER - 24, t => { tulip(t, 2349, TER, 14, PINK, STK, 1); tulip(t, 2369, TER, 11, PINK, STK, -1); starFlower(t, 2386, TER, 13, TEAL, STK, 0); });
    P(b, 2401, 12, TER - 14, t => { shroomlet(t, 2397, TER, 9, 6, TEAL, CYANLI); shroomlet(t, 2405, TER, 7, 4, TEAL, CYANLI); });
    P(b, 2488, 20, TER - 38, t => lantern(t, 2481, TER, 27, 1, STK3, ORNG));
    P(b, 2505, 14, TER - 24, t => { starFlower(t, 2499, TER, 9, CREAM, STK, 0); tulip(t, 2512, TER, 13, PINK, STK, -1); });
    P(b, 2648, 14, TER - 16, t => bubBush(t, 2648, TER, 16, ORNG, 9), null);
    pf(b, 2683, 38, -1, 3, FERNV);
    // a sign on the paddock's first post: this is where the cows are kept
    rect(b, PAD.x0, TER - 34, 1, 8, S[4]);
    rect(b, PAD.x0 - 7, TER - 46, 15, 13, S[4]); rect(b, PAD.x0 - 6, TER - 45, 13, 11, S[0]); rect(b, PAD.x0 - 7, TER - 46, 15, 1, S[6]);
    pix(b, PAD.x0 - 4, TER - 43, ['.c.....c.', '.bbbbbbb.', 'bbkbbbkbb', 'bbbbbbbbb', '.bpppppb.', '.bpnpnpb.', '..ddddd..'], { c: COWCREAM, b: COWC[3], k: OUTI, p: COWCREAM, n: COWNOSE, d: COWC[2] });
    tag(b, 2343, CYANI); tag(b, 2488, MAGLI);
  },
  b => {   // 2690-3300: the weir at the second gap, the milking parlour, the last gap, hay for the cows
    P(b, 2706, 8, TER - 14, t => { shroomlet(t, 2704, TER, 7, 5, TEAL, CYANLI); shroomlet(t, 2709, TER, 5, 3, TEAL, CYANLI); });
    swayer(2766, TER - 24, 2818, TER + 2, 1.5, t => reeds(t, 2768, 2816, TER, 73, [PINK, CREAM]));
    swayer(2842, TER - 24, 2894, TER + 2, 1.5, t => reeds(t, 2846, 2892, TER, 74, [CREAM, PINK]));
    pf(b, 2906, 30, 1, 3, FERN);
    plant(b, PARL.x0 - 4, TER - 48, PARL.x1 + 8, TER + 2, t => parlour(t), EDGE);
    P(b, 3052, 8, TER - 20, t => tulip(t, 3052, TER, 12, PINK, STK, 1));
    swayer(3072, TER - 24, 3130, TER + 2, 1.5, t => reeds(t, 3074, 3128, TER, 75, [PINK, CREAM]));
    P(b, 3150, 10, TER - 14, t => { shroomlet(t, 3148, TER, 7, 4, VIOL, CYANI); });
    plant(b, 3200, TER - 34, 3262, TER + 2, t => hayBales(t, 3202), EDGE);
  }
];
TERPARTS.forEach((f, i) => STEPS.push(() => { if (!i) SB = buf(A1 + 4 - TB0, 116, -TB0, -TTOP); GL = TGL; f(SB); GL = null; }));
STEPS.push(() => { ART.ter = { c: bakeGlows(bake(SB), SB, TGL), x0: TB0, top: TTOP }; SB = null; });

// ============================================================
// The catwalk and the glowing pond under it (world), the three nectar gaps, the ramp up to the airlock
// ============================================================
const DTOP = 208, DBOT = 284, POND0 = A0 + 6, POND1 = 3234, NFRONT = 14;
const SLABC = [S[7], S[6], S[5], S[4], S[4], S[3], S[2], S[0]], SHADE = I('#1c0a30');
function slab(b, x, gy, haz) {
  const u = x % 40;
  for (let k = 0; k < 8; k++) put(b, x, gy + k, SLABC[k]);
  if (haz) { for (let k = 2; k < 7; k++) put(b, x, gy + k, ((x + k) >> 2) % 2 ? HAZA : HAZB); return; }
  if (u === 0) for (let k = 1; k < 7; k++) put(b, x, gy + k, S[1]);
  if (u === 1) for (let k = 1; k < 6; k++) put(b, x, gy + k, S[6]);
  if (u === 5 || u === 36) { put(b, x, gy + 2, S[7]); put(b, x, gy + 3, S[2]); }
  if (u >= 12 && u < 29) { put(b, x, gy + 4, S[1]); put(b, x, gy + 5, u === 12 ? MAGLI : MAGI); put(b, x, gy + 6, S[1]); }
}
const gyAt = x => Math.round(gAt(x + 0.5));
// 1. the pond itself, from its surface down (brighter in the gaps, out of the catwalk's shadow)
function deckPond(b, xa, xb) {
  for (let x = Math.max(xa, POND0); x < Math.min(xb, POND1); x++) {
    const gap = gyAt(x) > DECK;
    for (let y = gap ? SURF : 243; y < DBOT; y++) {
      const d = (y - 243) / 28;
      let v = 0.26 + 0.46 * Math.sin(Math.PI * Math.min(1, Math.max(0, d * 1.15 + 0.1))) * (1 - d * 0.3) + (fbm(x / 26, y / 4 + 3, 31, 3) - 0.5) * 0.44;
      if (gap) v += 0.24 * ss(254, 240, y) + 0.06;
      put(b, x, y, ramp(LQ, v, x, y));
    }
  }
}
// 2. ripples and floating pads on it
const PADS = [[64, 258, 9], [150, 252, 7], [176, 263, 10], [246, 256, 8], [322, 262, 11], [388, 253, 7], [416, 264, 9], [296, 250, 5]];
function pondDetail(b) {
  const onPond = x => x >= POND0 && x < POND1;
  // ripples and caustic squiggles: the proposal's own in its screen, the same recipe along the rest
  for (let q = -2; q <= 2; q++) for (let i = 0; i < 90; i++) {
    const j = i + (q ? q * 1000 + 5000 : 0), y = 246 + Math.floor(nz(j, 3) * 25), x = CAM + q * 500 - 10 + Math.floor(nz(j, 4) * (VW + 20)), w = 3 + Math.floor(nz(j, 5) * 9);
    for (let k = 0; k < w; k++) { const yy = y + (nz(j, 6) > 0.6 && k > w / 2 ? 1 : 0); if (onPond(x + k)) put(b, x + k, yy, nz(j, 7) > 0.78 ? I('#aef6ff') : LQ[6]); }
  }
  // floating pads (teal discs with a notch and a pale rim), some with a bloom
  const pads = PADS.map(([x, y, w]) => [x + CAM, y, w]);
  for (let x = POND0 + 20, i = 0; x < POND1 - 12; x += 44 + Math.floor(nz(i, 21) * 50), i++) if (x < CAM - 20 || x > CAM + VW + 20) pads.push([x, (gyAt(x) > DECK ? 257 : 250) + Math.floor(nz(i, 22) * (gyAt(x) > DECK ? 9 : 16)), 5 + Math.floor(nz(i, 23) * 7)]);
  for (const [x, y, w] of pads) {
    if (x - w < POND0 + 2 || x + w > POND1 - 2) continue;
    for (let i = -w; i <= w; i++) put(b, x + i, y + 3 + (Math.abs(i) > w * 0.7 ? -1 : 0), LQ[1]);
    for (let i = -w; i <= w; i++) { const hh = Math.round(2.4 * Math.sqrt(1 - (i / (w + 0.5)) ** 2)); for (let k = -hh; k <= hh; k++) put(b, x + i, y + k, k === -hh ? TEAL[3] : k === hh ? TEAL[0] : i > w * 0.3 ? TEAL[2] : TEAL[1]); }
    put(b, x - 1, y - 1, LQ[4]); put(b, x - 2, y - 2, LQ[4]); put(b, x, y, TEAL[0]);
    if (w > 7) { rect(b, x + 3, y - 3, 3, 2, CREAM[3]); put(b, x + 4, y - 4, WHITE); put(b, x + 4, y - 2, ORNG[3]); }
  }
}
// 3. the steel: struts, the catwalk slab, the ramps into the gaps, the solid ends
function deckSteel(b, xa, xb) {
  const gaps = nectarList();
  for (let x = xa; x < xb; x++) {
    const gy = gyAt(x), gap = gy > DECK;
    if (x < POND0 || x >= POND1) {                               // solid ends: the slab on a plinth of hull plates
      for (let y = gy + 8; y < DBOT; y++) put(b, x, y, hullCol(x, y + 9, 2));
      if (x === POND0 - 1 || x === POND1) for (let y = DECK + 8; y < DBOT; y++) put(b, x, y, S[5]);
      if (x === POND0 - 2 || x === POND1 + 1) for (let y = DECK + 8; y < DBOT; y++) put(b, x, y, S[0]);
      slab(b, x, gy, false);
    } else if (gap) {
      put(b, x, SURF, LQ[6]); put(b, x, SURF + 1, (x + (x >> 2)) % 3 ? LQ[5] : LQ[6]);            // the surface catches the light
      if (gy < BED) [S[6], S[4], S[3], S[1]].forEach((c, k) => put(b, x, gy + k, gy + k < SURF ? c : mixI(c, LQ[4], 0.45 + k * 0.05)));   // the ramp into the nectar
      else if ((x >> 1) % 4 !== 3) put(b, x, BED + 1, mixI(LQ[3], S[3], 0.35));                   // the bed, just visible
    } else {
      put(b, x, 240, S[0]); put(b, x, 241, SHADE); put(b, x, 242, SHADE);
      const u = x % 80;                                          // struts and a girder under the catwalk
      if (u >= 20 && u < 25) for (let y = 240; y < DBOT; y++) put(b, x, y, [S[0], S[2], S[4], S[2], S[0]][u - 20]);
      if (u >= 17 && u < 28) { put(b, x, 240, S[3]); put(b, x, 241, S[2]); put(b, x, 242, S[0]); }
      slab(b, x, gy, gaps.some(n => (x >= n.x0 - 10 && x < n.x0 - 4) || (x >= n.x1 + 4 && x < n.x1 + 10)));
    }
  }
}
function deckGlows() {
  const gl = [];
  for (let x = 1630; x < POND1; x += 60) gl.push([x, 246, MAGI, 26, 0.16]);                       // the pond lights the underside of the catwalk
  for (const n of nectarList()) { const m = (n.x0 + n.x1) / 2, w = n.x1 - n.x0; gl.push([m, 247, MAGI, Math.round(w * 0.42), 0.2], [m - w * 0.28, 246, MAGI, 24, 0.14], [m + w * 0.28, 246, MAGI, 24, 0.14]); }
  return gl;
}
parts(TB0, A1 + 4, 4).forEach(([a, c], i) => STEPS.push(() => { if (!i) SB = buf(A1 + 4 - TB0, DBOT - DTOP, -TB0, -DTOP); deckPond(SB, a, c); }));
STEPS.push(() => { pondDetail(SB); deckSteel(SB, TB0, A1 + 4); });
STEPS.push(() => {
  const d = bakeGlows(bake(SB), SB, deckGlows());
  // the nectar's front layer: the same picture again, drawn half see-through over whoever wades in it
  ART.nect = nectarList().map(n => { const c = canvasOf(n.x1 - n.x0 + 8, NFRONT); c.getContext('2d').drawImage(d, n.x0 - 4 - TB0, SURF - DTOP, c.width, NFRONT, 0, 0, c.width, NFRONT); return { c, x: n.x0 - 4, x1: n.x1 + 4 }; });
  ART.deck = { c: d, x0: TB0, top: DTOP }; SB = null;
});

// ============================================================
// Mushroom-cap platforms (world sprites, origin = top centre of the cap). In a steel pot on the deck, or standing in
// the nectar (no pot: the stem goes down to the bed).
// ============================================================
const SPOTS1 = [[-0.62, 0.52, 4, 2.4], [-0.22, 0.3, 5, 2.6], [0.24, 0.5, 4.5, 2.4], [0.62, 0.34, 4, 2], [0.02, 0.74, 3, 1.5], [-0.42, 0.8, 2.5, 1.3], [0.5, 0.78, 3, 1.4], [0.84, 0.66, 2, 1.4]];
const SPOTS2 = [[-0.66, 0.5, 4, 2.4], [-0.3, 0.26, 5.5, 2.6], [0.16, 0.42, 5, 2.8], [0.6, 0.3, 4.5, 2.2], [-0.1, 0.74, 3.5, 1.6], [0.44, 0.76, 3, 1.4], [-0.5, 0.82, 2.5, 1.2], [0.84, 0.62, 2.4, 1.6]];
const SPOTC2 = Pc('#1c95a8', '#4fd0dc', '#bdf4fa', '#ffffff');
function paintShroom(w, total, pot, pink, squash) {
  const cap = pink ? PINK : ORNG, spot = pink ? SPOTC2 : CREAM, spots = pink ? SPOTS2 : SPOTS1;
  const hw = w / 2 + (squash > 0 ? squash : 0), ch = (pink ? 17 : 15) - squash, potH = pot ? 7 : 0, gill = 4, top0 = squash, stemTop = top0 + ch + 1, stemBot = total - potH;
  const b = buf(w + 14, total + 6, (w >> 1) + 7, 3);
  const STEM = Pc('#5f4a78', '#a58fb4', '#e6d6dc', '#fff6e6'), GILL = Pc('#7a4a6a', '#e8c8b0', '#fff0d0');
  for (let y = stemTop; y < stemBot + 1; y++) {
    const t = (y - stemTop) / (stemBot - stemTop), sw = Math.round(5.5 + 2.4 * t * t);
    for (let x = -sw; x < sw; x++) { const u = (x + sw + 0.5) / (2 * sw); put(b, x, y, u < 0.2 ? STEM[0] : u < 0.45 ? STEM[1] : u < 0.84 ? STEM[2] : STEM[3]); }
    if (y === stemTop + 5 || y === stemTop + 6) for (let x = -sw - 1; x < sw + 1; x++) put(b, x, y, y === stemTop + 5 ? STEM[3] : STEM[1]);   // the skirt
  }
  for (let y = stemTop; y < stemTop + 3; y++) for (let x = -7; x < 7; x++) if (get(b, x, y) !== NONE) put(b, x, y, STEM[y === stemTop + 2 ? 1 : 0]);   // shade under the cap
  if (pot) {                                                     // the steel pot bolted to the deck
    rect(b, -11, total - potH, 22, potH, METDI); rect(b, -12, total - potH, 24, 2, METI); rect(b, -12, total - potH, 24, 1, METLI);
    for (let i = 0; i < 6; i++) { rect(b, -11 + i * 4, total - 4, 2, 3, AMBI); rect(b, -9 + i * 4, total - 4, 2, 3, HAZB); }
    rect(b, -11, total - 1, 22, 1, METDDI);
  }
  for (let x = Math.ceil(-hw) + 3; x < hw - 3; x++) {            // gills under the cap
    const u = (x + 0.5) / (hw - 3), dy = Math.round(gill * Math.sqrt(1 - u * u));
    for (let k = 0; k < dy; k++) put(b, x, top0 + ch - 1 + k, (x & 1) ? GILL[0] : k === dy - 1 ? GILL[2] : GILL[1]);
  }
  const top = x => ch * (1 - Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / hw, 2.6))));       // the cap: flat top, round shoulders
  for (let x = Math.ceil(-hw); x < hw; x++) {
    const u = (x + 0.5) / hw, y0 = Math.round(top(x + 0.5)), y1 = ch - (Math.abs(u) > 0.93 ? 1 : 0);
    for (let y = y0; y < y1; y++) {
      const wv = (y + 0.5) / ch, l = u * 0.42 - (2 * wv - 1) * 0.85;
      let c = cap[l > 0.62 ? 4 : l > 0.2 ? 3 : l > -0.34 ? 2 : l > -0.74 ? 1 : 0];
      if (y === y0) c = u > -0.55 ? cap[4] : cap[3];
      if (y === y1 - 1) c = cap[0]; else if (y === y1 - 2) c = cap[1];
      put(b, x, top0 + y, c);
    }
  }
  const gl = [];
  for (const [su, sw, rx, ry] of spots) {
    const sx = su * hw, sy = top0 + sw * ch;
    shape(b, sx - rx, sy - ry, sx + rx, sy + ry, (x, y) => ((x - sx) / rx) ** 2 + ((y - sy) / ry) ** 2 <= 1 && cap.includes(get(b, x, y)),
      (x, y) => (y - sy) / ry > 0.35 ? spot[1] : (x - sx) / rx > 0.2 && (y - sy) / ry < -0.1 ? spot[3] : spot[2]);
    if (rx >= 4) gl.push([sx, sy, pink ? I('#bdf4fa') : I('#fff3d6'), rx + 3, 0.2]);
  }
  outline(b);
  return { c: bakeGlows(bake(b), b, gl), ox: b.ox, oy: b.oy };
}
const SHROOMS = {};
function shroomOf(pl, squash) {
  const mid = pl.x + pl.w / 2, inN = nectarList().some(n => mid > n.x0 && mid < n.x1), total = (inN ? BED + 3 : DECK) - pl.y;
  const key = pl.t + ':' + pl.w + ':' + total + ':' + squash;
  return SHROOMS[key] || (SHROOMS[key] = paintShroom(pl.w, total, !inN, pl.t === 'm2', squash));
}
let MYPL = null;
const myPlats = () => {
  if (MYPL) return MYPL;
  const L = L5ART.level && L5ART.level();
  if (!L) return [];
  return (MYPL = L.plats.filter(pl => (pl.t === 'm1' || pl.t === 'm2') && pl.x + pl.w / 2 >= A0 && pl.x + pl.w / 2 < A1));
};
STEPS.push(() => { for (const pl of myPlats()) shroomOf(pl, 0); });
STEPS.push(() => { for (const pl of myPlats()) if (pl.t === 'm2') { shroomOf(pl, 2); shroomOf(pl, -1); } });

// ============================================================
// Foreground plants (bottom of the screen only, world-anchored, never over a nectar gap): dark shapes rim-lit pink
// ============================================================
const FRONTC = Pc('#8a2a80', '#3a1658', '#22103c', '#120a26'), FCURL = Pc('#160b2c', '#2c1450', '#b03c94', '#ffa0dc');
const FDK = [FRONTC[3], FRONTC[3], FRONTC[2], FRONTC[1], FRONTC[0]], FLIMB = [FRONTC[3], FRONTC[2], FRONTC[1]], FEDGE = I('#090514');
// each: world x of its local 0, the buffer's box [x0, y0, w, h] in local coordinates, its painter
const FRONTS = [
  { x: 1664, box: [-34, 226, 96, 62], f: b => { fiddle(b, 20, 294, 52, -1, 5, FCURL, 1.4); limb(b, 44, 286, 50, 258, 4, 2, FLIMB, 2); for (const [x, y, r] of [[51, 255, 6], [44, 262, 4], [57, 263, 4]]) bubble(b, x, y, r, FDK); bigLeaf(b, -20, 290, -0.9, 34, 10, 0.3, FRONTC); } },
  { x: 1852, box: [-40, 228, 90, 60], f: b => { bigLeaf(b, 34, 292, -2.0, 42, 12, -0.2, FRONTC); fiddle(b, -8, 296, 50, 1, 5, FCURL, 1.3); } },
  { x: 2200, box: [-14, 176, 120, 100], f: b => { bigLeaf(b, -10, 262, -1.2, 40, 12, 0.25, FRONTC); fiddle(b, 3, 292, 72, 1, 6, FCURL, 1.4); fiddle(b, 45, 294, 46, -1, 5, FCURL, 1.3); } },   // the proposal's left corner
  { x: 2200, box: [390, 186, 100, 90], f: b => {                                                                                                                                  // and its right corner
    fiddle(b, 493, 294, 56, -1, 5, FCURL, 1.4);
    limb(b, 468, 284, 458, 254, 4, 2, FLIMB, -2); for (const [x, y, r] of [[457, 251, 6], [464, 258, 4], [451, 260, 4]]) bubble(b, x, y, r, FDK);
    limb(b, 444, 286, 434, 264, 3, 2, FLIMB, 2); for (const [x, y, r] of [[433, 261, 5], [440, 267, 3]]) bubble(b, x, y, r, FDK);
  } },
  { x: 2976, box: [-40, 224, 100, 64], f: b => { fiddle(b, -6, 294, 58, 1, 6, FCURL, 1.4); bigLeaf(b, 40, 292, -1.9, 38, 11, -0.2, FRONTC); limb(b, 30, 288, 24, 262, 3, 2, FLIMB, 2); for (const [x, y, r] of [[23, 259, 5], [30, 265, 3]]) bubble(b, x, y, r, FDK); } },
  { x: 3196, box: [-30, 228, 80, 60], f: b => { fiddle(b, 26, 296, 52, -1, 5, FCURL, 1.3); limb(b, -2, 288, 4, 262, 4, 2, FLIMB, -2); for (const [x, y, r] of [[5, 259, 6], [-3, 265, 4], [12, 266, 3]]) bubble(b, x, y, r, FDK); } }
];
STEPS.push(() => {
  ART.fronts = FRONTS.map(o => { const [x0, y0, w, h] = o.box, b = buf(w, h, -x0, -y0); o.f(b); outline(b, FEDGE); return { c: bake(b), x: o.x + x0, y: y0, w, base: y0 + h, h, amp: 1.6, ph: (o.x * 0.21) % 6.28 }; });
  for (const c of [MAG, CYAN, AMB, '#ffd080', '#c8f7ff', '#ffe9a8', '#ffc4e2', '#ff9ad8']) glowSprite(c);
});

// ============================================================
// Drawing (every frame: blits and small live bits)
// ============================================================
const offOf = (cx, p) => Math.round((cx - CAM) * p);
function blitStrip(g, s, cx) {
  const sx = clamp(offOf(cx, s.p) - 10 - s.u0, 0, s.c.width - (VW + 20));
  g.drawImage(s.c, sx, 0, VW + 20, s.c.height, -10, s.top, VW + 20, s.c.height);
}
function blitWorld(s, cx) {
  const x0 = Math.max(s.x0, cx - 12), x1 = Math.min(s.x0 + s.c.width, cx + VW + 12);
  if (x1 > x0) ctx.drawImage(s.c, x0 - s.x0, 0, x1 - x0, s.c.height, x0, s.top, x1 - x0, s.c.height);
}
const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
// a baked plant blitted with a gentle sway: rows are drawn in runs that share one horizontal offset (dx = camera)
function swayDraw(s, t, dx) {
  const img = s.c, hh = img.height;
  let y0 = 0, o0 = 1e9;
  for (let y = 0; y <= hh; y++) {
    let o = 1e9;
    if (y < hh) { const f = clamp((s.base - (s.y + y)) / s.h, 0, 1); o = Math.round(s.amp * f * Math.sqrt(f) * Math.sin(t * 0.035 + s.ph + f * 1.3)); }
    if (o !== o0) { if (y > y0) ctx.drawImage(img, 0, y0, img.width, y - y0, s.x - dx + o0, s.y + y0, img.width, y - y0); y0 = y; o0 = o; }
  }
}
// far saucers ferrying cows across the sky (small, dim: clearly background)
function farSaucers(g, cx, t) {
  for (let k = 0; k < 3; k++) {
    const span = VW + 220, x = Math.round((((k * 251 + 60 - t * (0.1 + k * 0.045) - cx * 0.22) % span) + span) % span) - 110, y = 62 + k * 27 + Math.round(Math.sin(t * 0.021 + k * 2) * 2);
    if (k !== 1) {
      g.fillStyle = 'rgba(157,255,74,0.14)'; g.fillRect(x - 2, y + 2, 5, 3); g.fillRect(x - 3, y + 5, 7, 7);
      g.fillStyle = '#a8803e'; g.fillRect(x - 2, y + 8, 5, 2); g.fillRect(x + 2, y + 7, 2, 2); g.fillStyle = '#6b4a23'; g.fillRect(x - 2, y + 10, 1, 1); g.fillRect(x + 1, y + 10, 1, 1);
    }
    g.fillStyle = '#17452c'; g.fillRect(x - 6, y, 13, 2); g.fillStyle = '#25703c'; g.fillRect(x - 4, y - 1, 9, 1); g.fillRect(x - 5, y, 11, 1);
    g.fillStyle = '#1f5f78'; g.fillRect(x - 2, y - 3, 5, 2); g.fillStyle = '#3f9fc4'; g.fillRect(x - 2, y - 3, 2, 1);
    g.fillStyle = Math.floor(t / 22 + k) % 2 ? '#ffcf3a' : '#5a4a1a'; g.fillRect(x, y - 5, 1, 1);
  }
}
// the lab's window: bubbles in the big jar, the sign lamps taking turns
function labLive(g, x, t) {
  if (x < -70 || x > VW + 70) return;
  const x0 = x - 33, sh2 = LAB.y0 + 32;
  g.fillStyle = 'rgba(255,240,200,0.9)';
  for (let k = 0; k < 3; k++) { const u = (t / 50 + k / 3) % 1; g.fillRect(x0 + 7 + ((k * 3 + 1) % 6), Math.round(sh2 - 2 - u * 6), 1, 1); }
  g.fillStyle = Math.floor(t / 14) % 3 ? '#2bb6d6' : '#c8f7ff'; g.fillRect(x0 + 16 + (Math.floor(t / 14) % 8), sh2 - 9, 1, 1);
  const on = Math.floor(t / 28) % 2;
  g.fillStyle = AMBL; g.fillRect(x + (on ? 28 : -30), 43, 3, 3);
  glowG(g, x + (on ? 29 : -29), 44, 9, AMB, 0.3);
}
// the nectar works: bubbles rising in the tank, the fall running down
function worksLive(g, x, t) {
  if (x < -90 || x > VW + 90) return;
  const { y1, lvl } = TANK;
  for (let k = 0; k < 7; k++) {
    const u = (t / 80 + hsh(k * 3.3)) % 1, bx = Math.round(x - 15 + hsh(k * 7.1) * 30 + Math.sin(t / 9 + k) * 1.5), by = Math.round(y1 - 3 - u * (y1 - lvl - 5));
    g.fillStyle = k % 3 ? 'rgba(255,227,243,0.85)' : 'rgba(255,255,255,0.95)'; g.fillRect(bx, by, k % 3 ? 1 : 2, k % 3 ? 1 : 2);
  }
  g.fillStyle = '#ffe3f3';
  for (let k = 0; k < 5; k++) g.fillRect(x - 17 + ((k * 8 + Math.floor(t / 7)) % 34), lvl, 2, 1);
  const span = FALL.y1 - FALL.y0;
  for (let i = 0; i < 10; i++) {
    g.fillStyle = i === 0 || i === 9 ? 'rgba(255,154,202,0.9)' : 'rgba(255,255,255,0.8)';
    for (let j = 0; j < 6; j++) { const y = FALL.y0 + ((t * 1.8 + hsh(i * 3.7) * 61 + j * (span / 6)) % span); g.fillRect(x - 5 + i, Math.round(y), 1, 3 + ((i + j) & 1) * 2); }
  }
  for (let k = 0; k < 5; k++) {                   // warm steam off the chute
    const u = (t / 70 + k / 5) % 1, sx = Math.round(x + 9 + u * 7 + Math.sin(t / 15 + k * 2) * 2), sy = Math.round(102 - u * 16);
    g.fillStyle = u < 0.4 ? 'rgba(255,220,240,0.4)' : u < 0.75 ? 'rgba(255,220,240,0.26)' : 'rgba(255,220,240,0.12)'; g.fillRect(sx, sy, 2 + (u > 0.5 ? 1 : 0), 2); g.fillRect(-sx + 2 * x - 2, sy + 1, 2, 2);
  }
  glowG(g, x, 72, 40, MAG, 0.06 + 0.05 * Math.sin(t / 25));
}
const BLINK = [[], [], []];                       // per dome: the node lamps that flare in turn [u, y]
function gardenBG(g, cx) {
  const t = G.t;
  g.fillStyle = S_HEX[0]; g.fillRect(-10, 226, VW + 20, VH - 216);       // under the wall's foot (the strips cover the rest)
  blitStrip(g, ART.sky, cx);
  const so = offOf(cx, SKY_P);
  g.fillStyle = '#ffffff';                        // stars twinkle
  for (let i = 0; i < TWINK.length; i++) {
    const x = TWINK[i][0] - so;
    if (x < -4 || x > VW + 4 || Math.sin(t * 0.07 + i * 2.1) <= 0.55) continue;
    g.fillRect(x - 2, TWINK[i][1], 5, 1); g.fillRect(x, TWINK[i][1] - 2, 1, 5);
  }
  const cyc = Math.floor(t / 540), ph = t % 540;  // a shooting star now and then
  if (ph < 24) {
    const x0 = 140 + hsh(cyc * 3.1) * 280 - ph * 5, y0 = 48 + hsh(cyc * 7.7) * 46 + ph * 2.5;
    for (let k = 0; k < 16; k++) { g.fillStyle = k < 2 ? '#ffffff' : k < 6 ? '#c8f7ff' : k < 11 ? '#8fa2d2' : '#3a3f78'; g.fillRect(Math.round(x0 + k * 2), Math.round(y0 - k), 2, 1); }
  }
  farSaucers(g, cx, t);
  blitStrip(g, ART.dome, cx);
  const dox = offOf(cx, DOME_P);
  for (let d = 0; d < 3; d++) {                   // node lamps flare in turn
    const L = BLINK[d];
    if (!L.length) continue;
    const q = L[Math.floor(t / 30) % L.length], x = q[0] - dox;
    if (x > -12 && x < VW + 12) glowG(g, x, q[1], 10, AMB, 0.3);
  }
  labLive(g, LABX - dox, t); worksLive(g, WKX - dox, t);
  blitStrip(g, ART.far, cx);
  blitStrip(g, ART.mid, cx);
}

// the play layer, world space (ctx is translated by -cx)
function pdisc(x, y, r) { for (let j = -r; j <= r; j++) { const hw = Math.floor(Math.sqrt((r + 0.5) * (r + 0.5) - j * j)); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); } }
function stream(x, w, y0, y1, t) {
  const xl = x - (w >> 1), h = y1 - y0;
  if (h <= 0) return;
  px(xl, y0, w, h, '#d8358e'); px(xl + 1, y0, w - 2, h, '#ff8fc8'); px(xl + 2, y0, w - 4, h, '#ffc8e6');
  for (let i = 0; i < w; i++) {
    ctx.fillStyle = i === 0 || i === w - 1 ? '#ff8fc8' : '#ffffff';
    for (let y = ((Math.floor(t * 1.6 - hsh(i + 3) * 40) % 6) + 6) % 6 - 2; y < h; y += 6) { const ya = Math.max(0, y), yb = Math.min(h, y + 2); if (yb > ya) ctx.fillRect(xl + i, y0 + ya, 1, yb - ya); }
  }
}
function foam(x, w, y, t) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const n = 3 + (w >> 2);
  for (let i = 0; i < n; i++) pdisc(Math.round(x - (n - 1) * 1.5 + i * 3), y + ((i + Math.floor(t / 7)) % 2), 1 + ((i + Math.floor(t / 11)) % 3 === 1 ? 1 : 0));
}
function fence(on, off, t) {
  const x0 = PAD.x0, x1 = PAD.x1, RAILS = [TER - 21, TER - 5], s = Math.floor(t / 4);
  if (on) for (const y of RAILS) {
    for (let x = x0 + 3; x < x1 - 2;) { const run = Math.min(4 - ((x + s) % 4), x1 - 2 - x), w = ((x + s) % 8) < 4 ? 0 : 1; px(x, y + w, run, 1, w ? 'rgba(79,227,255,0.45)' : 'rgba(79,227,255,0.75)'); x += run; }
    for (let k = 0; k < 7; k++) { const x = x0 + 3 + ((k * 14 + Math.floor(t / 3) + (y & 7) * 3) % (x1 - x0 - 8)); px(x, y, 2, 1, '#ffffff'); px(x + 2, y, 2, 1, CYANL); }
  } else if (off < 26) {                          // the field has just dropped: its last sparks
    for (let k = 0; k < 9; k++) if (hsh(k * 1.7 + off * 0.37) > 0.45) px(x0 + 5 + Math.floor(hsh(k * 3.3 + off) * 86), RAILS[k % 2] + (k % 3) - 1, 2, 1, k % 2 ? CYANL : '#ffffff');
  }
  for (const x of [x0, x1]) {
    px(x - 2, TER - 25, 5, 26, S_HEX[1]); px(x - 1, TER - 25, 3, 25, S_HEX[4]); px(x + 1, TER - 25, 1, 25, S_HEX[6]); px(x - 1, TER - 25, 3, 1, S_HEX[7]);
    px(x - 2, TER - 29, 5, 1, S_HEX[1]); px(x - 1, TER - 28, 3, 3, on ? (Math.floor(t / 24) % 2 ? AMB : AMBL) : (Math.floor(t / 12) % 2 ? '#ff3b30' : '#6a1a16'));
    for (const y of RAILS) { px(x - 2, y - 1, 5, 3, S_HEX[2]); px(x - 1, y, 3, 1, on ? CYANL : S_HEX[0]); if (on) glowG(ctx, x, y, 5, CYAN, 0.3); }
  }
}
const cowDraw = (x, y, f, o) => { if (typeof M5 !== 'undefined' && M5.cow) M5.cow(x, y, f, o); };
// the cows' paddock: three cows graze behind the force-field fence until the control box is broken (then the herd is
// level5.js's and the paddock stands empty)
function paddock(t) {
  const pk = typeof L5 !== 'undefined' ? L5.paddock : null, on = !pk || pk.on;
  if (on) {
    const hop = t % 420;                          // the calf hops now and then, the middle cow looks round
    cowDraw(2595, TER, Math.floor(t / 310) % 3 === 2 ? 1 : -1, { v: 1 });
    cowDraw(2562, TER + 1 - (hop < 18 ? Math.round(Math.sin(hop / 18 * Math.PI) * 4) : 0), -1, { v: 2 }); cowDraw(2620, TER + 1, 1, { v: 0 });
    px(2547, TER - 10, 1, 3, '#ff9ad8'); px(2545, TER - 9, 1, 2, '#ff9ad8'); px(2546, TER - 10 + (Math.floor(t / 20) % 2), 1, 3, '#c85ab8');   // a mouthful of pink grass
  }
  // the water trough
  px(2583, TER - 6, 16, 6, S_HEX[1]); px(2584, TER - 5, 14, 4, S_HEX[4]); px(2584, TER - 5, 14, 1, CYANL); px(2584, TER - 4, 14, 1, CYAN); px(2584, TER - 2, 14, 1, S_HEX[2]); px(2586 + (Math.floor(t / 16) % 9), TER - 5, 1, 1, '#ffffff');
  for (let i = 0; i < 26; i++) { const x = PAD.x0 + 4 + i * 3.6 + hsh(i * 3.1) * 3, hgt = 2 + Math.floor(hsh(i * 7.7) * 3); px(Math.round(x), TER + 1 - hgt, 1, hgt, i % 3 ? '#c85ab8' : '#ff9ad8'); }   // blades in front of the hooves
  fence(on, on ? 0 : pk.t, t);
  return on;
}
// the milking parlour: one cow, the robot milking it, bottles going down the belt (empty once the cows have bolted)
function parlourLive(t, on) {
  const { cow, mach } = PARL;
  if (on) {
    cowDraw(cow, TER + 1, 1, { v: 1 });
    px(cow - 4, TER - 5, 5, 1, '#f08aa6'); px(cow - 2, TER - 4, 1, 2, '#c3cdd8');                 // the cups and the hose along the ground
    px(cow - 2, TER - 2, mach - cow + 2, 1, '#8a97a8'); px(mach - 1, TER - 9, 1, 8, '#8a97a8');
    for (let k = 0; k < 3; k++) { const u = (t / 44 + k / 3) % 1; px(Math.round(cow + u * (mach - cow - 4)), TER - 2, 3, 1, '#ffffff'); }
  } else px(mach - 6, TER - 2, 6, 1, '#8a97a8');
  const lvl = on ? 2 + Math.floor(((t / 5) % 80) / 80 * 9) : 1;                                    // the jar on top fills, then empties into a bottle
  px(mach + 7, TER - 23 - lvl, 8, lvl, '#e6ecff'); px(mach + 7, TER - 23 - lvl, 8, 1, '#ffffff');
  px(mach + 6, TER - 15, 2, 2, on ? (Math.floor(t / 15) % 2 ? CYAN : '#1f5a6a') : '#ff3b30'); px(mach + 9, TER - 15, 2, 1, AMB);
  if (on) px(mach + 6, TER - 12, 1 + Math.floor(t / 10) % 5, 1, CYANL);
  for (let k = 0; k < 4; k++) {                                                                    // bottles
    const u = on ? (t / 240 + k / 4) % 1 : (k + 0.4) / 4, bx = Math.round(mach + 23 + u * 30), full = on && u > 0.1;
    px(bx - 1, TER - 12, 6, 6, '#1a1a2e'); px(bx + 1, TER - 15, 2, 3, '#1a1a2e');
    px(bx, TER - 11, 4, 5, full ? '#f2f6ff' : '#3a4a78'); px(bx + 1, TER - 14, 2, 3, full ? '#f2f6ff' : '#3a4a78'); px(bx, TER - 11, 1, 5, full ? '#ffffff' : '#8fd0e6'); px(bx + 1, TER - 15, 2, 1, MAG);
  }
  if (on && (t / 240 * 4) % 1 < 0.12) px(PARL.mach + 22, TER - 13, 2, 3, '#ffffff');               // a squirt from the filler
}
const MOTHS = [[1832, 172, 0], [1922, 164, 1], [2132, 176, 2], [2800, 180, 3], [3104, 182, 4], [3226, 176, 5]];
function gardenBehind(cx) {
  const t = G.t, vis = (x, m) => x > cx - m && x < cx + VW + m;
  blitWorld(ART.ter, cx);
  for (const s of SWAYERS) if (s.x < cx + VW + 10 && s.x + s.w > cx - 10) swayDraw(s, t, 0);
  if (vis(1714, 100)) {                           // the nursery's grow-lamps breathe; a drip from the top shelf
    glowG(ctx, 1714, TER - 24, 46, MAG, 0.07 + 0.04 * Math.sin(t / 30));
    const u = (t % 90) / 90; if (u < 0.5) px(1700, Math.round(TER - 28 + u * u * 52), 1, 2, CYANL);
  }
  if (vis(2134, 90)) {                            // the lab bench: the scanner's lamp sweeps, the specimens glow
    const on = Math.floor(t / 20) % 2;
    px(2167, TER - 23, 3, 3, on ? CYANL : '#1f5a6a'); if (on) glowG(ctx, 2168, TER - 21, 8, CYAN, 0.4);
    glowG(ctx, 2129, TER - 24, 14, '#ff9ad8', 0.08 + 0.06 * Math.sin(t / 22));
  }
  for (const sx of SPRINK) {                      // sprinklers: a fine cyan mist
    if (!vis(sx, 24)) continue;
    for (let k = 0; k < 18; k++) {
      const u = ((t / 26 + k / 18) % 1), d = (k % 2 ? 1 : -1) * (2 + u * (9 + (k % 3) * 4)), y = TER - 8 - Math.sin(u * Math.PI) * (6 + (k % 4)) + u * 6;
      px(sx + Math.round(d), Math.round(y), 1, k % 3 ? 1 : 2, k % 3 ? '#c8f7ff' : '#ffffff');
    }
    glowG(ctx, sx, TER - 9, 13, CYANL, 0.14);
  }
  for (const s of SPOUTS) if (vis(s.x, 20)) stream(s.x, s.w, TER + 14, s.gap ? SURF + 1 : DECK, t);
  for (const [mx, my, k] of MOTHS) {              // glow moths fluttering over the planter
    if (!vis(mx, 40)) continue;
    const a = t * 0.021 + k * 1.9, x = Math.round(mx + Math.sin(a) * 16 + Math.sin(a * 2.7) * 5), y = Math.round(my + Math.sin(a * 1.6 + k) * 7), up = Math.floor(t / 5 + k) % 2, c = k % 2 ? '#ffc4e2' : '#bdf4fa';
    px(x - 2, y - up, 2, 1 + up, c); px(x + 1, y - up, 2, 1 + up, c); px(x, y, 1, 2, '#ffffff');
  }
  let on = true;
  if (vis(2589, 90)) on = paddock(t); else { const pk = typeof L5 !== 'undefined' ? L5.paddock : null; on = !pk || pk.on; }
  if (vis(2978, 100)) parlourLive(t, on);
}
function gardenGround(cx) {
  const t = G.t;
  blitWorld(ART.deck, cx);
  for (const s of SPOUTS) {                       // where the spouts' streams meet the pond
    if (s.x < cx - 20 || s.x > cx + VW + 20) continue;
    if (!s.gap) stream(s.x, s.w, DECK + 8, DECK + 13, t);
    foam(s.x, s.w, s.gap ? SURF : DECK + 13, t);
  }
  const nl = nectarList();                        // a light runs along the catwalk's guide dashes
  for (let k = Math.floor((cx - 30) / 40), k1 = Math.ceil((cx + VW) / 40), ph = Math.floor(t / 7); k <= k1; k++) {
    const x = k * 40 + 12;
    if ((((k - ph) % 7) + 7) % 7 || x < POND0 || x + 17 > POND1 || nl.some(n => x + 17 > n.x0 - 10 && x < n.x1 + 10)) continue;
    px(x, DECK + 5, 17, 1, '#ffe3f3'); px(x - 1, DECK + 5, 1, 1, MAGL); px(x + 17, DECK + 5, 1, 1, MAGL);
  }
  for (let k = Math.floor((cx - 10) / 15), k1 = Math.ceil((cx + VW + 10) / 15); k < k1; k++) {     // shimmer on the pond
    const x = Math.round(k * 15 + hsh(k * 7.7) * 12 + Math.sin(t * 0.03 + k) * 3);
    if (x < POND0 + 2 || x > POND1 - 8) continue;
    px(x, 247 + Math.floor(hsh(k * 3.1) * 22), 2 + Math.floor(hsh(k * 1.3) * 4), 1, k % 5 ? 'rgba(255,220,240,0.8)' : 'rgba(174,246,255,0.9)');
  }
  for (let k = Math.floor((cx - 10) / 40), k1 = Math.ceil((cx + VW + 10) / 40); k < k1; k++) {     // bubbles rising
    const u = (t / 120 + hsh(k * 5.3)) % 1, x = Math.round(k * 40 + hsh(k * 9.1) * 36);
    if (x < POND0 + 2 || x > POND1 - 4) continue;
    px(x, Math.round(270 - u * 22), 1, 1, u < 0.35 ? 'rgba(255,255,255,0.75)' : u < 0.7 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)');
  }
}
// mushroom caps. The pink one squashes and springs back when the hero bounces off it; small arrows say "bouncy".
const BOING = new Map();
function gardenPlat(pl) {
  if (pl.t !== 'm1' && pl.t !== 'm2') {            // not a mushroom (none is planned here): a plain steel ledge, so it is never invisible
    px(pl.x - 1, pl.y - 1, pl.w + 2, 7, OUT); px(pl.x, pl.y, pl.w, 5, S_HEX[5]); px(pl.x, pl.y, pl.w, 1, S_HEX[7]); px(pl.x, pl.y + 4, pl.w, 1, S_HEX[3]);
    return;
  }
  const t = G.t, mid = Math.round(pl.x + pl.w / 2), pink = pl.t === 'm2', p = G.p;
  let sq = 0;
  if (pink) {
    if (p && !p.dead && !p.ride && p.vy < -6 && Math.abs(p.x - mid) < pl.w / 2 + 6 && p.y > pl.y - 18 && p.y <= pl.y + 2) BOING.set(pl.x, t);
    const d = BOING.has(pl.x) ? t - BOING.get(pl.x) : -1;
    sq = d >= 0 && d < 5 ? 2 : d >= 5 && d < 11 ? -1 : 0;
  }
  const s = shroomOf(pl, sq);
  glowG(ctx, mid, pl.y + (pink ? 21 : 19), 22, pink ? CYAN : '#ffd080', 0.3);
  ctx.drawImage(s.c, mid - s.ox, pl.y - s.oy);
  glowG(ctx, mid, pl.y + 8, pl.w >> 1, pink ? '#ffc4e2' : '#ffe9a8', 0.05 + 0.05 * Math.sin(t / 16 + mid));
  if (pink) for (let k = 0; k < 2; k++) {
    const ay = pl.y - 13 - k * 6 - (Math.floor(t / 8) % 3);
    ctx.fillStyle = k ? 'rgba(255,179,217,0.55)' : 'rgba(255,255,255,0.85)';
    ctx.fillRect(mid - 1, ay, 2, 1); ctx.fillRect(mid - 3, ay + 1, 6, 1); ctx.fillRect(mid - 5, ay + 2, 3, 1); ctx.fillRect(mid + 2, ay + 2, 3, 1);
  }
}
function gardenFront(cx) {
  const t = G.t, a0 = ctx.globalAlpha, p = G.p;
  for (const q of ART.nect) {                     // the nectar in front of whoever wades in it
    const x = q.x - cx, w = q.c.width;
    if (x > VW + 10 || x + w < -10) continue;
    ctx.globalAlpha = a0 * 0.62; ctx.drawImage(q.c, x, SURF); ctx.globalAlpha = a0;
    px(x + 4, SURF, w - 8, 1, 'rgba(255,227,243,0.9)');
    for (let gx = 8; gx < w - 16; gx += 13) { const ph = Math.floor((t + (q.x + gx) * 3) / 12) % 5; px(x + gx + ph * 2, SURF, 3, 1, '#ffffff'); if (ph === 2) px(x + gx + 5, SURF + 2, 2, 1, 'rgba(255,255,255,0.6)'); }
    for (const pl of myPlats()) {                 // rings round the mushroom stems that stand in it
      const m = Math.round(pl.x + pl.w / 2);
      if (m < q.x || m > q.x1) continue;
      const e = Math.floor(t / 14 + m) % 3;
      px(m - 11 - e - cx, SURF, 3, 1, '#ffffff'); px(m + 8 + e - cx, SURF, 3, 1, '#ffffff'); px(m - 8 - cx, SURF + 1, 16, 1, 'rgba(255,227,243,0.5)');
    }
    if (p && !p.dead && !p.ride && !p.hidden && p.x > q.x + 2 && p.x < q.x1 - 2 && p.y > SURF + 1) {   // and round the hero's legs
      const hx = Math.round(p.x) - cx, e = Math.floor(t / 6) % 4;
      px(hx - 6 - e, SURF, 3, 1, '#ffffff'); px(hx + 4 + e, SURF, 3, 1, '#ffffff'); px(hx - 4, SURF, 8, 1, '#ffe3f3'); px(hx - 9 - e, SURF + 1, 2, 1, 'rgba(255,255,255,0.6)'); px(hx + 8 + e, SURF + 1, 2, 1, 'rgba(255,255,255,0.6)');
    }
  }
  for (const f of ART.fronts) { const x = f.x - cx; if (x < VW + 10 && x + f.w > -10) swayDraw(f, t, cx); }   // dark plants low in front
}
// drifting spores and three glowing star seeds
const wrap = (v, m) => ((v % m) + m) % m;
function gardenOverlay(cx) {
  const t = G.t, sc = (cx - CAM) * 0.9;
  for (const [x0, y0, ph, c] of [[166, 124, 0, '#c8f7ff'], [301, 147, 2, '#ffe9a8'], [72, 158, 4, '#ffc4e2']]) {
    const x = Math.round(wrap(x0 - sc + 40, VW + 80) - 40 + Math.sin(t * 0.03 + ph) * 4), y = y0 + Math.round(Math.sin(t * 0.045 + ph * 2) * 3);
    glowG(ctx, x, y, 6, c, 0.3);
    ctx.fillStyle = c; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x, y + 3, 1, 3); ctx.fillRect(x - 1, y + 6, 1, 1);
  }
  for (let i = 0; i < 34; i++) {
    const tt = t + i * 211, x = Math.round(wrap(hsh(i * 3.7) * 700 + Math.sin(tt * 0.007 + i) * 30 + tt * 0.04 - sc, VW + 40) - 20);
    if (Math.sin(tt * 0.09 + i) <= -0.3) continue;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,196,226,0.9)' : i % 3 === 1 ? 'rgba(200,247,255,0.9)' : 'rgba(255,240,170,0.8)';
    ctx.fillRect(x, Math.round(70 + hsh(i * 9.1) * 160 + Math.sin(tt * 0.011 + i * 2) * 10), 1, 1);
  }
}

L5ART.garden = {
  x0: A0, x1: A1,
  steps: STEPS,
  bg: gardenBG, behind: gardenBehind, ground: gardenGround, plat: gardenPlat, front: gardenFront, overlay: gardenOverlay
};
}
