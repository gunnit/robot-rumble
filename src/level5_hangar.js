'use strict';
// =====================================================================================================================
// Mission 5 (ALIEN MOTHERSHIP) AREA 1: THE HANGAR, world x 0-1600. Owner: hangar. docs/level5-spec.md section 6.
//   L5ART.hangar = { x0, x1, steps, bg(g, cx), behind(cx), ground(cx), plat(pl), front(cx), overlay(cx) }
//   L5ART.card(x, y, w, h)        the mission card (the Earth in the bay mouth, the hero, an oggle)
// The docking bay of the mothership, grown from the approved mock (proposals/level5/hangar/scene.js: the same
// painters and palette; camera 400 is the mock's screen). What stands where, left to right:
//   0-80      the sealed blast door at the hangar's end (no way back)
//   86-154    the ARRIVAL BOOTH: beam projector under the ceiling, the arrival pad at x 120 (the hero is beamed in here)
//   170-350   the cow tally screen and its console, a rack of empty stasis pods
//   380-596   catwalk 1 (y 156): two parked mini saucers on their pads, fuel valve and hoses, porthole, hose reel,
//             the oggles' plan on a wall screen, the way-on chevrons
//   600-868   THE BAY MOUTH: open to space behind a force field, the Earth outside; an empty pad at 700
//   880-1036  the saucer service bay: landing pads at 960 and 1012 (the real sleeping eye saucers park on them),
//             pad signs, a tool wall
//   1040-1236 catwalk 2 (y 160): the FUEL STATION (a nectar tank, a pump, dials, a pink sight glass)
//   1240-1446 cargo: stacks of crates, a conveyor that feeds boxes into the wall, the second window (the Moon)
//   1450-1600 the bulkhead to the STAR GARDEN: the garden sign, way-on chevrons, vines creeping in, the dark doorway
// Along the ceiling: girders, pipes, the crane rail (a parked crane holds a crate at 832: hangar.crane = false hides
// it), the pink nectar main from the garden to the fuel station.
// Layers: bg = deep space, the Earth, far saucers (screen space, into g only); behind = the force field, the Moon
// behind the second window, ONE baked picture of wall + hangar floor + parked things, then the small live bits;
// ground = the deck strip; plat = catwalks and cargo-crate steps; front = dark kit at the very bottom (parallax 1.3);
// overlay = the guide strip's glow, steam, spores. Static art is painted pixel by pixel into buffers (the cast's
// M5.px helpers) and baked once, in `steps`; only small things move with G.t. Never Math.random / rand: textures
// come from a private seeded table, motion from G.t and hsh.
// =====================================================================================================================
var L5ART = L5ART || {};
{
const Math = globalThis.Math;
const AX0 = 0, AX1 = 1600;                   // the area
const ML = 12, MT = 10;                      // the baked pictures start 12 px left of x 0 and 10 px above y 0 (screen shake)
const WW = AX1 + ML;
const DECK = 232;                            // the walkable deck (the terrain line of the whole area)
const BACK = 206;                            // where the back wall meets the hangar floor
const CEILY = 60;                            // under the ceiling girders
const PX0 = 400;                             // the mock's camera: its screen x + 400 = world x
const OPEN = { x0: 600, x1: 868, y0: 60, y1: BACK, ch: 14, fw: 6, all: false };   // the bay mouth in the back wall
const WIN = { x0: 1268, x1: 1392, y0: 74, y1: 138, ch: 8, fw: 4, all: true };     // the second window
const OPENS = [OPEN, WIN];
const EARTH = { x: 746, y: 132, r: 66, k: 0.92 };   // k: how much it moves with the wall (1 = glued into the mouth)
const MOON = { x: 441, y: 128, k: 0.86 };    // the small far Moon (screen x at camera 400)
const ARR = { x: 120, x0: 86, x1: 154, lens: 67 };   // the arrival booth and its pad
// landing pads on the hangar floor: [x, y, rx, ry]
const PADS = [[422, 221, 28, 6.5], [478, 221, 28, 6.5], [700, 219, 44, 8], [960, 222, 24, 6.5], [1012, 222, 24, 6.5]];
// catwalks by their left edge: hanger rods, work lamps underneath (x from the left edge), hazard-striped ends
const CATS = {
  380: { rods: [44, 117, 213], lamps: [42, 98, 154], hzL: false, cones: [42, 98] },
  1040: { rods: [8, 80, 166], lamps: [30, 90, 150], hzL: true, cones: [30, 90] }
};
const CRANE = { x: 832, claw: 64 };
const CONV = { x0: 1258, x1: 1428, y: 158 };   // the conveyor on the wall (boxes ride from x1 to x0)
const PIPE = { x0: 1196, y: 40 };              // the pink nectar main under the ceiling, from here to the garden

// ---- bound on the first bake (nothing of another file is touched while this one loads)
let PAL = null, NONE, I, buf, put, get, rect, shape, oval, ball, line, outline, bake, inPoly;
let S, SP, GR, MAG, MAGL, MAGD, CYAN, CYANL, AMB, AMBL, AMBD, HZ, WHITE, OUTI, C28, C1B, SCR0, SCR1, CDIM, HOSE, DOME;
let NZT = null;
function init() {
  if (PAL) return;
  PAL = M5.PAL;
  ({ NONE, I, buf, put, get, rect, shape, oval, ball, line, outline, bake, inPoly } = M5.px);
  S = PAL.S.map(I); SP = PAL.SP.map(I); GR = PAL.G.map(I);
  MAG = I(PAL.MAG); MAGL = I(PAL.MAGL); MAGD = I('#a82f6c'); CYAN = I(PAL.CYAN); CYANL = I(PAL.CYANL); AMB = I(PAL.AMB); AMBL = I(PAL.AMBL);
  AMBD = I('#c98a16'); HZ = I('#22222c'); WHITE = I('#ffffff'); OUTI = I(OUT);
  C28 = I('#282a52'); C1B = I('#1b1a38'); SCR0 = I('#071a2c'); SCR1 = I('#0a2238'); CDIM = I('#2f7f9f');
  HOSE = [I('#7d3f22'), I('#c9702e'), I('#eb9a4e')];
  DOME = [I('#16385e'), I('#1f5d8c'), I('#2f8fbf'), I('#8fe0f5')];
  const r = rng(505001); NZT = new Float32Array(65536); for (let i = 0; i < NZT.length; i++) NZT[i] = r();
}

// ------------------------------------------------------------ noise, colour and dither helpers (the mock's)
const lerp = (a, b, k) => a + (b - a) * k;
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
function mixI(a, b, k) {
  k = clamp(k, 0, 1);
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  return Math.round(ar + ((b >> 16 & 255) - ar) * k) << 16 | Math.round(ag + ((b >> 8 & 255) - ag) * k) << 8 | Math.round(ab + ((b & 255) - ab) * k);
}
// ordered dither (Bayer 4x4): a colour from a ramp, v in 0..1
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dth = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
function ramp(cols, v, x, y) {
  const f = clamp(v, 0, 1) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(f));
  return cols[i + (f - i > dth(Math.floor(x), Math.floor(y)) ? 1 : 0)];
}
const hazard = (x, y, per = 8) => (((Math.floor(x) + Math.floor(y)) % per) + per) % per < per / 2;
// mix every painted pixel (not the outline colour oc) toward c by k
function haze(b, c, k, oc) { for (let i = 0; i < b.d.length; i++) if (b.d[i] !== NONE && b.d[i] !== oc) b.d[i] = mixI(b.d[i], c, k); }
function swap(b, from, to) { for (let i = 0; i < b.d.length; i++) if (b.d[i] === from) b.d[i] = to; }
// a smooth curve through four control points (cubic Bezier) as a point list
function bez([a, b2, c, d], n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * a[0] + 3 * u * u * t * b2[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b2[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  return out;
}
// the same buffer seen dx further right: paint with the mock's screen coordinates (dx 400) into a world buffer
const view = (b, dx) => ({ w: b.w, h: b.h, d: b.d, ox: b.ox + dx, oy: b.oy });
// copy every painted pixel of s into b, s's origin at (dx, dy)
function stamp(b, s, dx = 0, dy = 0) {
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const v = s.d[y * s.w + x]; if (v !== NONE) put(b, x - s.ox + dx, y - s.oy + dy, v); }
}
// add a soft round light to the painted pixels round (x, y): M5.glow's falloff, baked (for lights that never change)
function glowInto(b, x, y, r, c, a) {
  const cr = c >> 16 & 255, cg = c >> 8 & 255, cb = c & 255;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const d = Math.hypot(i + 0.5, j + 0.5) / r;
    if (d >= 1) continue;
    const v = get(b, x + i, y + j);
    if (v === NONE) continue;
    const k = a * (d < 0.35 ? 1 - d / 0.35 * 0.55 : 0.45 * (1 - (d - 0.35) / 0.65));
    put(b, x + i, y + j, Math.min(255, Math.round((v >> 16 & 255) + cr * k)) << 16 | Math.min(255, Math.round((v >> 8 & 255) + cg * k)) << 8 | Math.min(255, Math.round((v & 255) + cb * k)));
  }
}
const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
// live: a crisp pixel disc in the current fillStyle
function pdisc(x, y, r) {
  x = Math.round(x); y = Math.round(y);
  const R2 = (r + 0.5) * (r + 0.5);
  for (let j = -Math.floor(r); j <= Math.floor(r); j++) { const hw = Math.floor(Math.sqrt(R2 - j * j)); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
}

// alien glyphs: chunky circles, dots and bars (5 x 7)
const GLY = [
  ['.###.', '#...#', '#.#.#', '#...#', '.###.', '.....', '#####'],
  ['#...#', '.....', '..#..', '.....', '#...#', '.....', '.###.'],
  ['#####', '.....', '.###.', '.#.#.', '.###.', '.....', '..#..'],
  ['#.#.#', '#.#.#', '#...#', '#...#', '.....', '.###.', '.###.'],
  ['..#..', '..#..', '#####', '.....', '.#.#.', '.....', '.###.'],
  ['.###.', '#...#', '#...#', '.###.', '.....', '#.#.#', '.....'],
  ['##.##', '##.##', '.....', '..#..', '.....', '#####', '.....']
];
function glyph(b, g, x, y, c, sc = 1) { GLY[((g % GLY.length) + GLY.length) % GLY.length].forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') rect(b, x + i * sc, y + j * sc, sc, sc, c); }); }
const COWPIC = ['.#.....#...', '.########.#', '##########.', '.########..', '.#.#..#.#..'];
function pic(b, rows, x, y, c) { rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') put(b, x + i, y + j, c); }); }

// =====================================================================================================================
// Space, the small far Moon and the Earth (behind the bay mouth)
// =====================================================================================================================
const SPX = 40, SPY = 10;                      // the space strip's margins (it scrolls a little: parallax 0.02)
function paintSpace() {
  const b = buf(W + 2 * SPX + 20, H + 2 * SPY, SPX, SPY);
  const NEB = [SP[0], SP[0], SP[1], SP[2], SP[3], I('#2b1c58')];
  for (let y = -SPY; y < H + SPY; y++) for (let x = -SPX; x < W + SPX + 20; x++) {
    if (y < 44 || y > 212) { put(b, x, y, SP[0]); continue; }             // only the band the bay mouth shows gets the nebula
    const n = fbm(x / 80, y / 50, 3, 4), m = fbm(x / 34 + 9, y / 26 + 4, 7, 3);
    put(b, x, y, ramp(NEB, clamp((n - 0.36) * 2.4, 0, 1) * (0.5 + 0.6 * m), x, y));
  }
  const star = (r, x, y) => {
    const k = r(), tint = r(), d3 = Math.floor(r() * 3);
    const hi = I(tint < 0.6 ? '#e6ecff' : tint < 0.75 ? '#bff3ff' : tint < 0.88 ? '#ffd0e8' : '#fff0c0');
    if (k < 0.58) put(b, x, y, I(['#3c3f78', '#565a96', '#7479b4'][d3]));
    else if (k < 0.9) put(b, x, y, hi);
    else if (k < 0.975) { put(b, x, y, WHITE); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(b, x + dx, y + dy, mixI(hi, SP[2], 0.5)); }
    else { put(b, x, y, WHITE); for (let d = 1; d <= 2; d++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(b, x + dx * d, y + dy * d, d === 1 ? hi : mixI(hi, SP[2], 0.62)); }
  };
  const r = rng(5051);
  for (let i = 0; i < 270; i++) { const x = Math.floor(-20 + r() * 520), y = Math.floor(r() * 210); star(r, x, y); }   // the mock's sky
  const r2 = rng(7717);
  for (let i = 0; i < 90; i++) { const x = Math.floor(-SPX + r2() * (W + 2 * SPX + 20)), y = Math.floor(-SPY + r2() * (H + 2 * SPY)); if (y >= 210 || y < 0 || x < -20 || x >= 500) star(r2, x, y); else { r2(); r2(); r2(); } }
  return b;
}
// the Moon, small and far (its own sprite: it keeps its place beside the Earth while the stars slide by)
function paintFarMoon() {
  const b = buf(16, 16, 8, 8);
  shape(b, -7, -7, 7, 7, (x, y) => x * x + y * y <= 5.7 ** 2, (x, y) => {
    const l = (x * -0.38 + y * -0.8) / 5.7;
    return l > 0.4 ? I('#f2f4fa') : l > -0.05 ? I('#c6ccdc') : l > -0.4 ? I('#7c84a4') : I('#2a2e52');
  });
  put(b, -2, -2, I('#aab1c8')); put(b, 1, -1, I('#aab1c8')); put(b, -1, 1, I('#9aa2bc'));
  return b;
}

// the continents, as rough (lon, lat) outlines: enough for the kids to find Africa, Europe and home (Galicia)
const LAND = [
  [[-17, 21], [-16.5, 15], [-15, 11], [-12, 7.5], [-8, 4.5], [-4, 5.2], [1, 6], [4.5, 6.3], [6, 4.3], [9, 4], [9.6, 1], [9, -1], [11.5, -4.5], [13.5, -9], [12.5, -13], [11.8, -17], [14.5, -22.5], [16.5, -28.5], [18.3, -34], [20, -34.8], [25.5, -34], [30, -31], [32.6, -28.5], [32.8, -25.5], [35.5, -24], [34.8, -20], [40.5, -15.5], [40.5, -10.5], [39, -6.5], [41.5, -2], [44.5, 1.5], [48, 5], [51.2, 11.8], [47, 11.2], [43.5, 11.5], [43, 12.6], [39.5, 15.5], [37.3, 19], [36.9, 22], [35.5, 24], [33.8, 27.8], [32.5, 29.9], [32.2, 31.3], [29, 31], [25, 31.7], [20, 31], [19.5, 30.3], [15.5, 31.5], [15, 32.4], [11, 33.5], [10.3, 37.2], [9.8, 37.3], [5, 36.8], [0, 35.8], [-2, 35.2], [-5.3, 35.8], [-6, 35.6], [-9.8, 31.5], [-9.8, 29.5], [-13, 27.7], [-14.8, 25]],
  [[-9.3, 43.2], [-8, 43.75], [-4.5, 43.45], [-1.8, 43.4], [0.7, 42.7], [3.2, 42.4], [3.2, 41.8], [0.9, 41], [0.2, 39.8], [-0.3, 38.7], [-0.7, 37.6], [-2, 36.75], [-4.4, 36.7], [-5.6, 36.05], [-6.3, 36.8], [-7.4, 37.2], [-8.9, 37], [-8.8, 38.5], [-9.5, 38.8], [-8.9, 40.2], [-8.7, 41.8]],
  [[-1.8, 43.4], [-1.2, 46], [-2.5, 47.3], [-4.7, 48.4], [-1.5, 48.7], [-1.6, 49.7], [1.5, 50.9], [3.5, 51.4], [4.7, 53], [7, 53.6], [8.8, 54], [8.5, 57], [10.5, 57.6], [10.8, 54.4], [14.2, 54], [18.5, 54.7], [21, 55.2], [21.3, 57.3], [24.2, 57.4], [23.5, 59.3], [28, 59.6], [30, 60], [33, 62], [35, 64.3], [40, 64.6], [44, 66.2], [55, 68.5], [60, 68.5], [60, 47], [52, 46.5], [48, 46.2], [47.5, 43], [44, 42.7], [40, 43.5], [37.5, 45], [35, 46.2], [33, 46.2], [30.5, 46.2], [28.2, 43.4], [28.3, 41.2], [26.2, 40.6], [23.5, 40.3], [24, 38], [23, 36.5], [21.6, 36.8], [21, 39], [19.5, 40.5], [19.3, 42], [16, 43.5], [13.7, 45.5], [12.3, 44.3], [13.6, 43.5], [16, 41.8], [18.5, 40.2], [17, 39], [16.5, 38], [15.7, 38], [16, 40], [12.5, 41.5], [10.5, 43], [8.8, 44.4], [7.5, 43.8], [6, 43.1], [3.2, 43.3], [3.2, 42.4], [0.7, 42.7]],
  [[5, 58.5], [5, 62], [10, 64], [14, 68], [20, 70], [28, 71], [30, 69.7], [33, 69.5], [41, 67], [40, 64.6], [35, 64.3], [33, 62], [30, 60], [23, 59.8], [21.3, 60.8], [21.5, 63], [24, 65.8], [21.5, 64.5], [17.5, 62], [17.2, 60.5], [18.8, 59.5], [16.5, 56.2], [14.5, 55.5], [12.8, 56], [11, 59], [8, 58]],
  [[-5.5, 50], [1.3, 51.2], [1.7, 52.8], [0, 53.6], [-1.5, 55.5], [-2, 57.6], [-4, 57.6], [-3, 58.6], [-5, 58.6], [-6.2, 56.5], [-4.8, 54.8], [-3, 53.4], [-4.6, 53.2], [-4.2, 51.8], [-5.2, 51.7], [-3, 51.2]],
  [[-10, 51.8], [-6.2, 52.2], [-6, 54.8], [-8, 55.2], [-10, 54], [-9.5, 52.8]],
  [[-24, 65.5], [-22, 64], [-18, 63.4], [-14, 64.5], [-14.5, 66], [-18, 66.5], [-22, 66.3]],
  [[26.2, 40.6], [28.3, 41.2], [33, 42], [38, 41], [41.5, 41.5], [44.5, 39.5], [44, 37], [36, 36.5], [32.5, 36], [30, 36.3], [27.5, 36.8], [26.3, 38.5]],
  [[32.5, 29.9], [34.9, 29.5], [35.6, 33], [36, 36.5], [44, 37], [46, 33], [48, 30], [50, 27], [51.5, 25], [56, 26], [59.5, 22.5], [55, 17], [52, 16], [45, 12.8], [43.3, 12.7], [42.5, 16.5], [39, 21.5], [37, 25], [35, 28]],
  [[44, 37], [44.5, 39.5], [48, 46.2], [60, 47], [75, 45], [75, 25], [66, 25], [61, 25.2], [57, 27], [51.5, 28], [50, 30], [48, 30], [46, 33]],
  [[44, -25], [47, -25], [50, -16], [49, -12], [46, -16], [44, -20]],
  [[-35, -5.5], [-37, -10], [-39, -15], [-41, -22], [-48.5, -26], [-48.8, -28.5], [-53.5, -34], [-58, -38], [-62, -39], [-65, -42], [-66, -48], [-69, -52], [-73, -52], [-75, -46], [-73, -37], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 0], [-78, 2], [-77, 8], [-72, 12], [-62, 10.5], [-57, 6], [-52, 5], [-50, 0], [-44, -2.5]],
  [[-45, 60], [-42, 63], [-33, 68], [-22, 70], [-20, 76], [-18, 81], [-35, 83.5], [-60, 82], [-72, 78], [-58, 75], [-53, 68], [-50, 62]],
  [[-53, 47], [-56, 52], [-61, 56], [-65, 60], [-78, 62], [-95, 60], [-95, 30], [-90, 29], [-84, 30], [-82, 25], [-80, 26], [-81, 31], [-76, 35], [-74, 40], [-70, 42], [-66, 44.5], [-60, 46]]
].map(p => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { p, x0, x1, y0, y1 }; });
function isLand(lon, lat) {
  for (const q of LAND) {
    if (lon < q.x0 || lon > q.x1 || lat < q.y0 || lat > q.y1) continue;
    if (inPoly(q.p, lon, lat)) return true;
  }
  return false;
}
// an orthographic globe of radius R seen over the Atlantic: continents, fbm clouds with three spiral storms, Lambert
// light with ordered dither, a dusk band, a night side with a few city lights, a thin line of air
function paintEarth(R) {
  const N = 2 * R + 8, b = buf(N, N, R + 4, R + 4), q = R / 66;
  const D = Math.PI / 180, lat0 = 24 * D, lon0 = -14, tilt = -0.2;
  const LS = [-0.38, -0.80, 0.46];                                   // the sun: up and a little left, in front
  const ct = Math.cos(tilt), st = Math.sin(tilt), c0 = Math.cos(lat0), s0 = Math.sin(lat0);
  const OCEAN = [I('#0f347f'), I('#1549a4'), I('#1d62c6'), I('#2e83e2'), I('#52a5f0')];
  const SAND = [I('#8f6c42'), I('#bb9257'), I('#dcb877'), I('#f0d79c')];
  const SOIL = [I('#4f4034'), I('#6e5a42'), I('#8c7350'), I('#a88c60')];
  const ICE = [I('#7f93c9'), I('#b9c9ec'), I('#e3ecfb'), I('#ffffff')];
  const CLOUD = [I('#8195cf'), I('#b7c8ee'), I('#e6eefc'), I('#ffffff')];
  const NIGHT_O = I('#080d28'), NIGHT_L = I('#0d1230'), NIGHT_C = I('#151d44'), DUSK_C = I('#d98fb4'), DUSK_O = I('#1a2468');
  const ATM = [I('#bfe6ff'), I('#6fb4f5'), I('#2c4f9f')], ATMN = I('#161f4e'), CITY = [I('#e0a84a'), I('#8a6226')];
  const SWIRL = [[-34, 49, 15, 1], [-20, -30, 13, -1], [-52, 22, 9, 1]];
  const cloud = (lon, lat) => {
    const u = lon * Math.cos(lat * D) / 9, v = lat / 5.2;
    const w = fbm(u * 0.45 + 3, v * 0.45 + 7, 41, 2) * 4;
    let n = fbm(u + w, v + w * 0.6, 43, 4) + 0.09 * Math.cos(lat * D * 6.5) - 0.02;
    for (const [lc, la, rr, dir] of SWIRL) {
      const dx = (lon - lc) * Math.cos(la * D), dy = lat - la, r = Math.hypot(dx, dy);
      if (r < rr) { const s = Math.sin(Math.atan2(dy, dx) * 2 * dir + Math.log(r + 1.5) * 4.4); n = lerp(n, r < 1.6 ? 0.3 : 0.5 + 0.26 * s, (1 - r / rr) ** 0.7); }
    }
    n -= 0.16 * Math.exp(-(((lon + 2) / 13) ** 2 + ((lat - 40) / 8) ** 2));      // clear skies over Iberia and the western Med
    return n;
  };
  // pass 1: what is where
  const idx = (px, py) => (py + R + 4) * N + px + R + 4;
  const LD = new Uint8Array(N * N), LT = new Float32Array(N * N), LN = new Float32Array(N * N);
  for (let py = -R; py < R; py++) for (let px = -R; px < R; px++) {
    const x = (px + 0.5) / R, y = (py + 0.5) / R, d2 = x * x + y * y;
    if (d2 > 1) continue;
    const z = Math.sqrt(1 - d2), gx = x * ct + y * st, up = -(-x * st + y * ct);
    const Y = up * c0 + z * s0, Z = -up * s0 + z * c0;
    const lat = Math.asin(clamp(Y, -1, 1)) / D, lon = lon0 + Math.atan2(gx, Z) / D;
    LT[idx(px, py)] = lat; LN[idx(px, py)] = lon; LD[idx(px, py)] = isLand(lon, lat) ? 1 : 0;
  }
  // pass 2: colour
  for (let py = -R - 3; py < R + 3; py++) for (let px = -R - 3; px < R + 3; px++) {
    const x = (px + 0.5) / R, y = (py + 0.5) / R, d2 = x * x + y * y, d = Math.sqrt(d2) * R;
    if (d > R + 2) continue;
    if (d > R) {                                                     // the thin atmosphere line and a dithered halo
      const L = (x * LS[0] + y * LS[1]) / Math.sqrt(d2);
      if (d <= R + 1) put(b, px, py, L > 0.2 ? ATM[0] : L > -0.1 ? ATM[1] : L > -0.3 ? ATM[2] : ATMN);
      else if (L > 0.05 && ((px + py) & 1)) put(b, px, py, L > 0.45 ? ATM[1] : ATM[2]);
      continue;
    }
    const z = Math.sqrt(1 - d2), L = x * LS[0] + y * LS[1] + z * LS[2];
    const k = idx(px, py), lat = LT[k], lon = LN[k], land = LD[k];
    const cn = cloud(lon, lat);
    const desert = land && ((lat > 14 && lat < 33 && lon < 40 && lon > -18) || (lon >= 34 && lat > 12 && lat < 40));
    const ice = land && (lat > 61 || (lon < -15 && lat > 59));
    const isCloud = cn > (desert ? 0.61 : 0.585), thin = !isCloud && cn > (desert ? 0.6 : 0.56);
    let c;
    if (L <= 0.02) {                                                 // night: a few city lights on the dark land
      c = isCloud ? NIGHT_C : land ? NIGHT_L : NIGHT_O;
      if (land && !desert && !ice && !isCloud && !(px < 4 * q && py > 26 * q) && nz(px * 3 + 7, py * 5 + 1) > 0.95) c = nz(px + 31, py + 17) > 0.7 ? CITY[0] : CITY[1];
    } else {
      const v = clamp((L - 0.02) / 0.8, 0, 1), tex = fbm(px / 5, py / 5, 61, 2) - 0.5;
      if (isCloud) c = ramp(CLOUD, 0.25 + 0.75 * v + (cn - 0.63) * 1.6, px, py);
      else if (land) c = ramp(ice ? ICE : desert ? SAND : SOIL, 0.2 + 0.8 * v + tex * 0.5, px, py);
      else {
        const coast = LD[idx(px + 1, py)] || LD[idx(px - 1, py)] || LD[idx(px, py + 1)] || LD[idx(px, py - 1)];
        const glint = Math.max(0, 1 - Math.hypot(x + 0.33, y + 0.5) / 0.3);       // the sun on the Atlantic
        c = ramp(OCEAN, 0.12 + 0.72 * v + tex * 0.2 + (coast ? 0.16 : 0) + glint * 0.35, px, py);
      }
      if (thin) c = mixI(c, CLOUD[2], 0.45);
      if (L < 0.2) {                                                 // dusk: dithered into the night side
        const u = (L - 0.02) / 0.18;
        if (u < dth(px, py)) c = isCloud ? NIGHT_C : land ? NIGHT_L : NIGHT_O;
        else c = isCloud ? mixI(c, DUSK_C, 0.55) : mixI(c, DUSK_O, 0.45);
      }
      if (d > R - 1.6 && L > 0.1) c = mixI(c, ATM[0], 0.55);         // air along the lit limb
      else if (d > R - 3.2 && L > 0.1 && ((px + py) & 1)) c = mixI(c, ATM[1], 0.5);
    }
    put(b, px, py, c);
  }
  return b;
}
// a soft blue halo for the Earth (drawn with 'lighter')
function haloOf(r, col) {
  const [c, g] = cnv(r * 2, r * 2), v = hex(col), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, 'rgba(' + v + ',1)'); gr.addColorStop(0.35, 'rgba(' + v + ',0.45)'); gr.addColorStop(1, 'rgba(' + v + ',0)');
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return c;
}
// what the second window shows: stars and the Moon, big and close (a strip a little wider than the window: parallax)
const MV = { w: WIN.x1 - WIN.x0 + 44, h: WIN.y1 - WIN.y0, mx: 74, my: 30, r: 21 };
function paintMoonView() {
  const b = buf(MV.w, MV.h, 0, 0), r = rng(4242);
  for (let y = 0; y < MV.h; y++) for (let x = 0; x < MV.w; x++) put(b, x, y, ramp([SP[0], SP[1], SP[2], SP[3]], 0.15 + 0.5 * fbm(x / 40 + 3, y / 24, 5, 3) - 0.2 + 0.25 * y / MV.h, x, y));
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(r() * MV.w), y = Math.floor(r() * MV.h), k = r();
    put(b, x, y, k < 0.5 ? I('#565a96') : k < 0.85 ? I('#e6ecff') : WHITE);
    if (k > 0.92) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(b, x + dx, y + dy, I('#7479b4'));
  }
  const MC = [I('#2a2e52'), I('#5a6288'), I('#8f97b6'), I('#c6ccdc'), I('#f2f4fa')], cx = MV.mx, cy = MV.my, R = MV.r;
  const CR = [[-8, -6, 4.6], [5, 4, 5.4], [-3, 10, 3], [9, -9, 2.8], [-13, 5, 2.4], [1, -13, 2.2], [13, 9, 2.2], [-2, 0, 1.6]];
  shape(b, cx - R - 1, cy - R - 1, cx + R + 1, cy + R + 1, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= R * R, (x, y) => {
    const dx = x - cx, dy = y - cy, z = Math.sqrt(Math.max(0, R * R - dx * dx - dy * dy)) / R;
    const l = (dx * -0.42 + dy * -0.62) / R + z * 0.55 + (dth(Math.floor(x), Math.floor(y)) - 0.5) * 0.1;
    let tone = l > 0.62 ? 4 : l > 0.26 ? 3 : l > -0.12 ? 2 : l > -0.5 ? 1 : 0;
    if (fbm(x / 10 + 5, y / 8, 78, 2) > 0.6 && tone > 1) tone--;                     // maria
    for (const [ox, oy, cr] of CR) {                                                // craters: a shadowed wall up-left, a lit rim down-right
      const d = Math.hypot(dx - ox, dy - oy);
      if (d > cr + 0.5 || d < cr * 0.42) continue;
      const side = (dx - ox + dy - oy) / cr;
      if (side < -0.4) tone--; else if (side > 0.5) tone++;
    }
    return MC[clamp(tone, 0, 4)];
  });
  // two slanted sheen bands on the glass
  for (const [x0, w] of [[18, 7], [31, 2], [118, 4]]) for (let y = 0; y < MV.h; y++) for (let i = 0; i < w; i++) {
    const x = x0 + i + Math.floor((MV.h - y) * 0.5), v = get(b, x, y);
    if (v !== NONE && ((x + y) & 1)) put(b, x, y, mixI(v, I('#c8f7ff'), 0.16));
  }
  return b;
}

// =====================================================================================================================
// The back wall: plates, ribs, ceiling, the bay mouth and the second window (holes with steel frames)
// =====================================================================================================================
let FD = null;                               // per wall pixel: 0 = in an opening, 1..6 = on its steel frame, 9 = plain wall
const fdi = (x, y) => (y + MT) * WW + x + ML;
const isWall = (x, y) => y >= -MT && y < BACK && x >= -ML && x < AX1 && FD[fdi(x, y)] === 9;
const inO = (o, x, y) => x >= o.x0 && x < o.x1 && y >= o.y0 && y < o.y1 && (x - o.x0) + (y - o.y0) >= o.ch && (o.x1 - 1 - x) + (y - o.y0) >= o.ch &&
  (!o.all || ((x - o.x0) + (o.y1 - 1 - y) >= o.ch && (o.x1 - 1 - x) + (o.y1 - 1 - y) >= o.ch));
function frameD(o, x, y) {
  if (inO(o, x, y)) return 0;
  for (let d = 1; d <= o.fw; d++) {
    if (inO(o, x + d, y) || inO(o, x - d, y) || inO(o, x, y + d) || inO(o, x + d, y + d) || inO(o, x - d, y + d)) return d;
    if (o.all && (inO(o, x, y - d) || inO(o, x + d, y - d) || inO(o, x - d, y - d))) return d;
  }
  return 9;
}
function buildMask() {
  FD = new Int8Array(WW * (BACK + MT)); FD.fill(9);
  for (const o of OPENS) for (let y = o.y0 - o.fw - 1; y < Math.min(BACK, o.y1 + o.fw + 1); y++) for (let x = o.x0 - o.fw - 1; x <= o.x1 + o.fw; x++) FD[fdi(x, y)] = frameD(o, x, y);
}
const tooth = y => { const k = ((y - OPEN.y0) % 22 + 22) % 22; return k < 11 ? Math.floor(k / 2.2) : Math.floor((22 - k) / 2.2); };
// ceiling lamps: each throws a soft cone of light down the wall (dithered into the wall's tones)
const CLAMPS = [[198, 0.3], [300, 0.3], [526, 0.22], [986, 0.3], [1486, 0.3]];
function pool(x, y) {
  let v = 0;
  for (const [lx, k] of CLAMPS) {
    const dx = Math.abs(x - lx);
    if (dx > 64) continue;
    const t = (y - 64) / 118;
    if (t < 0 || t > 1) continue;
    const hw = 10 + t * 52;
    if (dx < hw) v += k * (1 - dx / hw) * (1 - t);
  }
  return v;
}
// the plain wall and ceiling for world x xa..xb (textured, dithered, darker toward the floor)
function wallBase(b, xa, xb) {
  const WALL = [S[1], C1B, S[2], C28], CEIL = [S[0], S[1], C1B], d = b.d;
  for (let y = -MT; y < BACK; y++) {
    const row = (y + MT) * WW + ML, base = 0.86 - 0.6 * ss(CEILY, BACK, y);
    for (let x = xa; x < xb; x++) {
      if (FD[row + x] === 0) continue;
      const xs = x - PX0;
      d[row + x] = y < CEILY
        ? ramp(CEIL, 0.2 + 0.6 * y / CEILY + 0.5 * (fbm(xs / 34, y / 10, 17, 2) - 0.5), xs, y)
        : ramp(WALL, base + 0.36 * (fbm(xs / 44, y / 44, 23, 2) - 0.5) + pool(x, y), xs, y);
    }
  }
}
function rib(b, x, y0, y1) {
  const cols = [S[0], S[4], S[3], S[3], S[3], S[2], S[2], S[1], S[0]];
  for (let y = y0; y < y1; y++) for (let i = 0; i < 9; i++) put(b, x + i, y, cols[i]);
  for (let y = y0 + 6; y < y1 - 3; y += 16) { put(b, x + 3, y, S[6]); put(b, x + 4, y, S[5]); put(b, x + 3, y + 1, S[1]); put(b, x + 4, y + 1, S[1]); }
}
function porthole(b, cx, cy, r) {
  shape(b, cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= (r + 0.5) ** 2, (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    if (d > r - 0.3) return S[0];
    if (d > r - 4.2) { const l = ((x - cx) * -0.6 + (y - cy) * -0.8) / r; return l > 0.5 ? S[6] : l > 0.05 ? S[5] : l > -0.45 ? S[4] : S[3]; }
    if (d > r - 5.2) return S[0];
    const n = nz(Math.floor(x) * 3 + 11, Math.floor(y) * 7 + 5);
    return n > 0.94 ? I('#e6ecff') : n > 0.88 ? I('#565a96') : (x - cx) + (y - cy) < -r * 0.3 ? SP[2] : SP[1];
  });
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.39; put(b, Math.round(cx + Math.cos(a) * (r - 2.4) - 0.5), Math.round(cy + Math.sin(a) * (r - 2.4) - 0.5), S[7]); }
  line(b, cx - 5, cy - 1, cx - 2, cy - 4, I('#8fa2d2')); put(b, cx - 5, cy + 1, I('#6272ab'));
}
// a wall screen: steel bezel round a dark interior of w x h at (X, Y) with scanlines
function screenBox(b, X, Y, w, h) {
  rect(b, X - 3, Y - 3, w + 6, h + 6, S[0]); rect(b, X - 2, Y - 2, w + 4, h + 4, S[4]); rect(b, X - 2, Y - 2, w + 4, 1, S[6]); rect(b, X - 2, Y + h + 1, w + 4, 1, S[2]); rect(b, X + w, Y - 1, 2, h + 2, S[3]);
  for (let y = 0; y < h; y++) rect(b, X, Y + y, w, 1, y % 2 ? SCR1 : SCR0);
}
// a dark sign plate with a steel edge
function plaque(b, x, y, w, h) { rect(b, x, y, w, h, S[4]); rect(b, x + 1, y + 1, w - 2, h - 2, S[0]); rect(b, x, y + h, w, 1, S[0]); }
// the way on: three amber chevrons on a plate (lit in turn, live)
const CHEVS = [[538, 170], [1470, 112]];
function chevSign(b, x, y) {
  plaque(b, x, y, 42, 15);
  for (let i = 0; i < 3; i++) for (let k = 0; k < 5; k++) for (const yy of [y + 3 + k, y + 11 - k]) { put(b, x + 7 + i * 11 + k, yy, i === 2 ? AMBL : AMB); put(b, x + 8 + i * 11 + k, yy, i === 2 ? AMB : AMBD); }
}
function vent(b, x, y, w, h) { rect(b, x, y, w, h, S[0]); for (let yy = y + 1; yy < y + h - 1; yy += 3) { rect(b, x + 1, yy, w - 2, 1, S[4]); rect(b, x + 1, yy + 1, w - 2, 1, S[2]); } }
// vertical panel seams, horizontal seams, rivets, bulkhead ribs, cyan light strips [xa, xb]
const VS = [162, 240, 446, 547, 884, 986, 1092, 1250, 1410, 1500];
const HS = [64, 112, 164];
const RIVETS = [4, 158, 166, 236, 244, 366, 404, 442, 450, 488, 504, 543, 551, 590, 880, 888, 982, 990, 1032, 1048, 1088, 1096, 1224, 1240, 1246, 1254, 1406, 1414, 1444, 1460, 1496, 1504];
const RIBS = [76, 391, 492, 874, 1036, 1228, 1448];
const STRIPS = [[166, 372], [404, 590], [890, 1030], [1048, 1168], [1462, 1540]];
function wallStructure(b) {
  const wput = (x, y, c) => { if (isWall(x, y)) put(b, x, y, c); };
  for (const x of VS) for (let y = 64; y < 197; y++) { wput(x, y, S[0]); wput(x + 1, y, y % 2 ? S[3] : C28); }
  for (const y of HS) for (let x = -ML; x < AX1; x++) { wput(x, y - 1, S[0]); wput(x, y, S[3]); }
  for (const y of HS) for (const x of RIVETS) { wput(x, y + 4, S[4]); wput(x + 1, y + 5, S[0]); }
  for (const x of RIBS) rib(b, x, CEILY, 197);
  // ---- ceiling: girder edge, pipes with clamps, a lintel plate over the mouth
  for (let x = -ML; x < AX1; x++) { wput(x, CEILY - 2, S[3]); wput(x, CEILY - 1, S[0]); wput(x, 33, S[2]); }
  for (const [py, cs, runs] of [[42, [S[3], S[2], S[2], S[0]], [[-ML, 594], [878, PIPE.x0 - 4]]], [50, [S[2], S[2], S[0]], [[-ML, 594], [878, 1546]]]]) {
    for (const [xa, xb] of runs) for (let x = xa; x < xb; x++) cs.forEach((c, i) => wput(x, py + i, ((x - PX0 + 14) % 44 + 44) % 44 < 3 ? (i ? S[1] : S[4]) : c));
  }
  for (let x = 596; x < 874; x++) { wput(x, 36, S[3]); if ((x - 596) % 67 === 0) for (let y = 37; y < 52; y++) wput(x, y, S[0]); if ((x - 590) % 12 === 0) { wput(x, 39, S[3]); wput(x, 40, S[0]); } }
  // ceiling cross-beams (short stubs under the girder) every so often, away from the mock's screen
  for (const x of [34, 128, 272, 348, 912, 1004, 1120, 1210, 1340, 1424, 1520]) { for (let y = 20; y < 32; y++) { wput(x, y, S[0]); wput(x + 1, y, S[2]); wput(x + 2, y, S[2]); wput(x + 3, y, S[1]); wput(x + 4, y, S[0]); } }
  // ---- the steel frames of the openings
  for (const o of OPENS) for (let y = o.y0 - o.fw - 1; y < Math.min(BACK, o.y1 + o.fw + 1); y++) for (let x = o.x0 - o.fw - 1; x <= o.x1 + o.fw; x++) {
    const d = FD[fdi(x, y)];
    if (d < 1 || d > 6) continue;
    const mid = !(x < o.x0 || x >= o.x1), top = y < o.y0 + o.ch && mid, bot = o.all && y >= o.y1 - o.ch && mid, left = x < o.x0;
    const k = o.fw === 6 ? d - 2 : (d - 2) * 2;
    let c = d === 1 || d === o.fw ? S[0] : top ? [S[4], S[3], S[3], S[2]][k] : bot ? [S[6], S[5], S[5], S[4]][k] : left ? [S[6], S[5], S[4], S[3]][k] : [S[5], S[4], S[3], S[2]][k];
    if (o.fw === 6 && (d === 3 || d === 4) && ((x - PX0 + y * 3) % 12 + 12) % 12 === 0) c = d === 3 ? S[7] : S[1];
    if (o.fw === 4 && d === 2 && ((x + y * 3) % 14 + 14) % 14 === 0) c = S[7];
    put(b, x, y, c);
  }
  // force-field emitters along the top of the mouth
  for (let x = OPEN.x0 + 24; x < OPEN.x1 - 24; x += 20) { rect(b, x, OPEN.y0 - 2, 5, 1, S[0]); rect(b, x + 1, OPEN.y0 - 1, 3, 1, CYAN); put(b, x + 2, OPEN.y0 - 1, CYANL); }
  // ---- the bay door, slid open into the wall: its toothed, hazard-striped edges show on both sides
  for (let y = OPEN.y0; y < BACK; y++) {
    const w = 9 + tooth(y);
    for (let i = 0; i <= w; i++) for (const side of [0, 1]) {
      const x = side ? OPEN.x1 - 1 - i : OPEN.x0 + i;
      if (!inO(OPEN, x, y)) continue;
      const hz = hazard(x - PX0, y, 10);
      put(b, x, y, i === w ? S[0] : i === w - 1 ? (hz ? AMBL : S[4]) : hz ? (side ? AMBD : AMB) : HZ);
    }
  }
  // ---- light strips: cyan, high on the wall
  for (const [xa, xb] of STRIPS) for (let x = xa; x < xb; x++) { const on = (x - xa) % 26 < 22; wput(x, 66, S[0]); wput(x, 67, on ? CYANL : S[1]); wput(x, 68, on ? CYAN : S[1]); wput(x, 69, S[0]); }
  // ---- baseboard with dim guide markers (unlit: lit dashes down here would read as tracer rounds)
  const M1 = I('#5a2f66'), M2 = I('#3a2450');
  for (let x = -ML; x < AX1; x++) {
    for (let y = 197; y < BACK; y++) wput(x, y, y === 197 ? S[4] : y === 198 ? S[3] : y === 205 ? S[0] : ramp([S[2], S[3]], 0.5, x - PX0, y));
    if (((x - PX0 + 20) % 24 + 24) % 24 < 9) { wput(x, 201, M1); wput(x, 202, M2); }
  }
  // ---- ceiling lamps: a small fitting under the girder (its cone of light is in the wall's shading)
  for (const [lx] of CLAMPS) { rect(b, lx - 6, CEILY, 12, 2, S[0]); rect(b, lx - 5, CEILY, 10, 1, S[5]); rect(b, lx - 4, CEILY + 2, 8, 2, S[4]); rect(b, lx - 4, CEILY + 4, 8, 1, CYANL); rect(b, lx - 5, CEILY + 5, 10, 1, S[0]); }
}
// the pink nectar main under the ceiling (from the garden to the fuel station) and the crane rail, over everything
function ceilingRuns(b) {
  const y0 = PIPE.y, rows = [S[0], S[6], S[5], S[4], S[4], S[4], S[3], S[2], S[0]];
  for (let x = PIPE.x0; x < AX1; x++) rows.forEach((c, i) => put(b, x, y0 + i, c));
  for (let x = PIPE.x0 + 36; x < AX1 - 30; x += 96) {          // sight glasses: the nectar shows (bubbles are live)
    rect(b, x - 1, y0 + 1, 24, 7, S[0]);
    for (let i = 0; i < 22; i++) { put(b, x + i, y0 + 2, MAGL); put(b, x + i, y0 + 3, MAG); put(b, x + i, y0 + 4, MAG); put(b, x + i, y0 + 5, MAGD); put(b, x + i, y0 + 6, I('#7a2452')); }
  }
  for (let x = PIPE.x0 + 16; x < AX1; x += 48) { rect(b, x - 1, y0 - 1, 5, 11, S[0]); rect(b, x, y0, 3, 9, S[4]); rect(b, x, y0, 1, 9, S[6]); rect(b, x + 2, y0 + 1, 1, 8, S[2]); }   // flanges
  // the rail
  for (let x = -ML; x < AX1; x++) { put(b, x, 32, OUTI); put(b, x, 33, S[6]); put(b, x, 34, S[4]); put(b, x, 35, S[4]); put(b, x, 36, S[2]); put(b, x, 37, x % 4 < 2 ? S[1] : S[3]); put(b, x, 38, OUTI); }
  for (let x = 20; x < AX1; x += 116) { rect(b, x, 26, 4, 6, S[0]); rect(b, x + 1, 26, 2, 6, S[3]); }       // its hangers
}

// ---- zone by zone: what hangs on the wall ----------------------------------------------------------------------------
// 0-380: the sealed blast door, the arrival booth, the cow tally, the rack of empty pods
function fitArrival(b) {
  const wput = (x, y, c) => { if (isWall(x, y)) put(b, x, y, c); };
  // slack cables and a conduit
  for (const [xa, xb, sag, c] of [[160, 262, 13, I('#3d4f8a')], [236, 352, 8, I('#6a3a78')]]) for (let x = xa; x <= xb; x++) { const u = (x - xa) / (xb - xa), y = Math.round(CEILY + 1 + sag * 4 * u * (1 - u)); wput(x, y, c); wput(x, y + 1, S[0]); }
  // ---- the blast door: two heavy leaves, shut; a hazard band; a red bar light (live) says LOCKED
  rect(b, 8, 88, 68, 118, S[0]);
  rect(b, 9, 89, 66, 117, S[4]); rect(b, 9, 89, 66, 1, S[6]); rect(b, 9, 90, 1, 116, S[6]); rect(b, 73, 90, 2, 116, S[2]);
  rect(b, 14, 94, 56, 112, S[0]);
  for (let y = 95; y < BACK; y++) for (let x = 15; x < 69; x++) put(b, x, y, ramp([S[1], S[2], C28, S[3]], 0.3 + 0.5 * (1 - (y - 95) / 111) + (x < 42 ? 0.14 : 0) + 0.3 * (fbm(x / 9, y / 30, 91, 2) - 0.5), x, y));
  for (let y = 95; y < BACK; y++) { put(b, 41, y, S[5]); put(b, 42, y, S[0]); put(b, 43, y, S[1]); }
  for (const y of [116, 174]) { rect(b, 15, y, 54, 1, S[5]); rect(b, 15, y + 1, 54, 2, S[3]); rect(b, 15, y + 3, 54, 1, S[0]); }
  rect(b, 15, 138, 54, 1, S[0]); rect(b, 15, 151, 54, 1, S[0]);
  for (let y = 139; y < 151; y++) for (let x = 15; x < 69; x++) put(b, x, y, hazard(x < 42 ? x : -x, y, 12) ? (y < 141 ? AMB : AMBD) : HZ);
  for (const [x, y] of [[18, 99], [37, 99], [46, 99], [65, 99], [18, 200], [37, 200], [46, 200], [65, 200], [18, 128], [65, 128], [18, 160], [65, 160]]) { put(b, x, y, S[7]); put(b, x + 1, y, S[5]); put(b, x, y + 1, S[1]); put(b, x + 1, y + 1, S[0]); }
  for (const x of [22, 48]) { rect(b, x, 104, 14, 6, S[0]); rect(b, x + 1, 105, 12, 1, DOME[1]); rect(b, x + 1, 106, 12, 3, DOME[0]); put(b, x + 2, 106, DOME[3]); put(b, x + 3, 106, DOME[2]); }
  for (let i = 0; i < 3; i++) glyph(b, i + 4, 30 + i * 8, 182, i === 1 ? S[6] : S[5]);
  rect(b, 28, 79, 28, 7, S[0]); rect(b, 29, 80, 26, 5, I('#3a0f14'));                 // the bar light's housing
  rect(b, 40, 86, 4, 2, S[2]);
  // ---- the arrival booth: beam projector on top, light bars inside, up-arrows on its back wall
  const X0 = ARR.x0, X1 = ARR.x1, cx = ARR.x;
  rect(b, X0, 68, X1 - X0 + 1, BACK - 68, S[0]);
  for (let y = 76; y < BACK; y++) for (let x = X0 + 6; x < X1 - 5; x++) {
    const u = 1 - Math.abs(x - cx) / 30, k = (y - 76) / 130;
    put(b, x, y, ramp([S[0], SP[1], SP[2], S[1]], 0.1 + 0.5 * k * k * Math.max(0, u) + 0.14 * u, x, y));
  }
  [S[6], S[5], S[4], S[4], S[3]].forEach((c, i) => rect(b, X0 + 1 + i, 69, 1, BACK - 69, c));
  [S[5], S[4], S[3], S[3], S[2]].forEach((c, i) => rect(b, X1 - 5 + i, 69, 1, BACK - 69, c));
  for (let y = 84; y < 192; y++) if (y % 8 < 6) { put(b, X0 + 9, y, CYAN); put(b, X0 + 10, y, CYANL); put(b, X1 - 10, y, CYANL); put(b, X1 - 9, y, CYAN); } else { put(b, X0 + 9, y, S[1]); put(b, X0 + 10, y, S[1]); put(b, X1 - 10, y, S[1]); put(b, X1 - 9, y, S[1]); }
  for (let i = 0; i < 3; i++) for (let k = 0; k < 8; k++) { const y = 150 - i * 20 + k, c = I('#1f5d7a'); put(b, cx - 1 - k, y, c); put(b, cx + k, y, c); put(b, cx - 1 - k, y + 1, c); put(b, cx + k, y + 1, c); }   // (lit in turn, live)
  for (const y of [96, 180]) for (const x of [X0 + 14, X1 - 15]) { put(b, x, y, S[4]); put(b, x, y + 1, S[0]); }
  // the projector: a housing hung from the ceiling, a hazard band, the lens strip
  for (let y = 40; y < 62; y++) { const hw = 15 + Math.round((y - 40) * 0.75); for (let x = cx - hw; x <= cx + hw; x++) put(b, x, y, x === cx - hw || x === cx + hw ? S[0] : x < cx - hw + 3 ? S[6] : x > cx + hw - 4 ? S[3] : ramp([S[4], S[5]], 0.75 - (y - 40) / 30, x, y)); }
  rect(b, cx - 16, 39, 33, 1, S[0]); rect(b, cx - 15, 40, 31, 1, S[7]);
  for (let x = cx - 26; x <= cx + 26; x++) for (let y = 52; y < 56; y++) if (get(b, x, y) !== S[0]) put(b, x, y, hazard(x, y, 8) ? AMB : HZ);
  rect(b, X0, 62, X1 - X0 + 1, 7, S[0]); rect(b, X0 + 1, 63, X1 - X0 - 1, 2, S[5]); rect(b, X0 + 1, 63, X1 - X0 - 1, 1, S[7]);
  for (let x = X0 + 6; x < X1 - 5; x++) { put(b, x, 65, S[0]); put(b, x, 66, (x - X0) % 6 < 4 ? CYANL : CYAN); put(b, x, 67, CYAN); }
  for (const dx of [-9, 0, 9]) { rect(b, cx + dx - 1, 44, 3, 3, S[0]); put(b, cx + dx, 45, dx ? AMB : CYANL); }
  // ---- the cow tally: seven cows taken so far, one slot still blinking (live)
  { const X = 176, Y = 84;
    screenBox(b, X, Y, 50, 28);
    for (let i = 0; i < 4; i++) glyph(b, i + 2, X + 3 + i * 7, Y + 1, i === 3 ? CYANL : CDIM);
    rect(b, X + 33, Y + 3, 14, 1, CDIM); rect(b, X + 33, Y + 5, 9, 1, CDIM);
    for (let k = 0; k < 7; k++) pic(b, COWPIC, X + 2 + (k % 4) * 12, Y + 11 + Math.floor(k / 4) * 8, k % 3 === 1 ? CYANL : CYAN);
    rect(b, X + 20, Y + 29, 10, 2, S[2]); }
  // ---- the pod rack: three empty stasis pods on a rail, waiting for cows (dim: they are wall furniture)
  { const r = buf(104, 76, -246, -74), DK = I('#0f2a48');
    plaque(r, 262, 76, 44, 13); for (let i = 0; i < 5; i++) glyph(r, i + 3, 266 + i * 8, 79, i === 0 ? CYANL : CDIM);
    rect(r, 250, 96, 96, 4, S[0]); rect(r, 251, 96, 94, 1, S[6]); rect(r, 251, 97, 94, 2, S[4]);
    for (const x of [254, 298, 340]) { rect(r, x, 90, 3, 6, S[3]); put(r, x, 90, S[6]); }
    for (const px of [270, 298, 326]) {
      rect(r, px - 2, 100, 4, 3, S[3]);
      rect(r, px - 10, 103, 20, 5, S[0]); rect(r, px - 9, 103, 18, 4, S[5]); rect(r, px - 9, 103, 18, 1, S[7]); rect(r, px - 9, 106, 18, 1, S[2]);
      rect(r, px - 9, 108, 18, 32, S[0]);
      for (let y = 108; y < 140; y++) for (let x = px - 8; x < px + 8; x++) put(r, x, y, x < px - 6 ? DOME[1] : x > px + 5 ? DK : ramp([DK, DOME[0]], 0.3 + 0.5 * (y - 108) / 32, x, y));
      rect(r, px - 6, 110, 1, 22, DOME[3]); rect(r, px - 5, 110, 1, 12, DOME[2]); rect(r, px - 8, 108, 16, 1, DOME[2]);
      rect(r, px - 10, 140, 20, 6, S[0]); rect(r, px - 9, 140, 18, 5, S[4]); rect(r, px - 9, 140, 18, 1, S[6]);
      for (let x = px - 8; x < px + 8; x++) for (let y = 142; y < 144; y++) put(r, x, y, hazard(x, y, 4) ? AMBD : HZ);
      rect(r, px - 1, 104, 2, 2, CYAN);
    }
    haze(r, S[2], 0.22, S[0]);
    stamp(b, r); }
  // a vent low on the wall before the catwalk; a big stencilled bay number
  vent(b, 352, 174, 26, 14);
  for (let i = 0; i < 2; i++) for (const [dx, dy, c] of [[1, 1, S[0]], [0, 0, S[3]]]) { GLY[i ? 0 : 3].forEach((row, j) => { for (let k = 0; k < 5; k++) if (row[k] === '#') for (let q = 0; q < 9; q++) wput(282 + i * 22 + k * 3 + dx + q % 3, 164 + j * 3 + dy + Math.floor(q / 3), c); }); }
  for (let x = 276; x < 326; x++) { wput(x, 188, S[3]); wput(x, 189, S[0]); }
}
// 380-900: the mock's own fittings (its screen coordinates: world x - 400)
function fitMock(wb) {
  const b = view(wb, PX0), wput = (x, y, c) => { if (isWall(x + PX0, y)) put(b, x, y, c); };
  // slack cables hanging under the ceiling girder (left bay)
  for (const [xa, xb, sag, c] of [[-2, 92, 16, I('#3d4f8a')], [-12, 70, 9, I('#6a3a78')]]) {
    for (let x = xa; x <= xb; x++) { const u = (x - xa) / (xb - xa), y = Math.round(CEILY + 1 + sag * 4 * u * (1 - u)); wput(x, y, c); wput(x, y + 1, S[0]); }
  }
  // conduit, porthole
  for (let y = 70; y < 172; y++) { wput(15, y, S[0]); wput(16, y, S[4]); wput(17, y, S[3]); wput(18, y, S[1]); if (y % 20 === 8) for (let i = 14; i < 20; i++) wput(i, y, i === 14 ? S[0] : S[4]); }
  porthole(b, 40, 100, 13);
  // hose reel: an orange fuel hose wound on a drum, the nozzle hanging down
  rect(b, 70, 101, 20, 3, S[4]); rect(b, 70, 103, 20, 1, S[1]); rect(b, 72, 100, 2, 1, S[6]); rect(b, 86, 100, 2, 1, S[6]);
  shape(b, 70, 104, 90, 124, (x, y) => (x - 80) ** 2 + (y - 114) ** 2 <= 9.5 ** 2, (x, y) => {
    const d = Math.hypot(x - 80, y - 114), l = (x - 80) * -0.5 + (y - 114) * -0.8;
    return d > 8.6 ? S[0] : d > 6.8 ? (l > 3 ? HOSE[2] : HOSE[1]) : d > 5.8 ? HOSE[0] : d > 4 ? (l > 1.5 ? HOSE[2] : HOSE[1]) : d > 3 ? S[0] : d > 1.4 ? S[4] : S[7];
  });
  for (let y = 116; y < 136; y++) { put(b, 89, y, S[0]); put(b, 90, y, y % 3 ? HOSE[1] : HOSE[0]); put(b, 91, y, y % 3 ? HOSE[2] : HOSE[0]); put(b, 92, y, S[0]); }
  rect(b, 88, 136, 6, 5, S[0]); rect(b, 89, 136, 4, 4, S[5]); rect(b, 89, 136, 1, 4, S[7]); rect(b, 90, 140, 2, 2, S[3]);
  // sign plaque: cyan glyphs on a dark plate
  rect(b, 110, 73, 44, 15, S[4]); rect(b, 111, 74, 42, 13, S[0]); rect(b, 110, 88, 44, 1, S[0]);
  for (let i = 0; i < 5; i++) glyph(b, i + 1, 114 + i * 8, 77, i === 2 ? CYANL : CYAN);
  // the oggles' plan on a wall screen: Earth -> cow -> beam -> saucer (ship cyan; their eye emblem in green)
  {
    const X = 104, Y = 95, CD = I('#2f8fb0'), put2 = (x, y, c) => put(b, X + x, Y + y, c);
    screenBox(b, X, Y, 42, 26);
    shape(b, X + 2, Y + 10, X + 14, Y + 22, (x, y) => { const d = Math.hypot(x - X - 8, y - Y - 16); return d <= 5.6; }, (x, y) => Math.hypot(x - X - 8, y - Y - 16) > 4.4 ? CYAN : nz(Math.floor(x) * 5, Math.floor(y) * 3) > 0.62 ? CD : I('#0d3350'));
    for (const x of [16, 18, 20]) put2(x, 16, CYAN); put2(21, 15, CYAN); put2(21, 17, CYAN); put2(22, 16, CYANL);
    COWPIC.forEach((row, j) => { for (let i = 0; i < 11; i++) if (row[i] === '#') put2(26 + i, 14 + j, CYANL); });
    for (let y = 7; y < 13; y += 2) { put2(28 + Math.floor((12 - y) / 3), y, CD); put2(35 - Math.floor((12 - y) / 3), y, CD); }
    ['....###....', '..#######..', '###########', '..##...##..'].forEach((row, j) => { for (let i = 0; i < 11; i++) if (row[i] === '#') put2(26 + i, 2 + j, j === 2 ? CYANL : CYAN); });
    for (let i = 0; i < 5; i++) put2(3 + i, 3 + (i === 0 || i === 4 ? 1 : 0), GR[4]); for (let i = 1; i < 4; i++) put2(3 + i, 5, GR[4]); put2(5, 4, GR[6]);
    rect(b, X + 18, Y + 28, 6, 2, S[2]);
  }
  // the way on: amber chevrons; vent slats low on the left
  chevSign(b, 138, 170);
  vent(b, 100, 174, 30, 14);
}
// 880-1040: the saucer service bay: a sign over each landing pad, a tool wall, a wall fan
const FAN = { x: 912, y: 98 };
function fitService(b) {
  const wput = (x, y, c) => { if (isWall(x, y)) put(b, x, y, c); };
  for (const [xa, xb, sag, c] of [[884, 1036, 11, I('#3d4f8a')]]) for (let x = xa; x <= xb; x++) { const u = (x - xa) / (xb - xa), y = Math.round(CEILY + 1 + sag * 4 * u * (1 - u)); wput(x, y, c); wput(x, y + 1, S[0]); }
  [960, 1012].forEach((px, k) => {
    rect(b, px - 15, 88, 30, 34, S[0]); rect(b, px - 14, 89, 28, 32, S[4]); rect(b, px - 14, 89, 28, 1, S[6]); rect(b, px - 12, 91, 24, 28, S[0]);
    for (let x = px - 12; x < px + 12; x++) for (let y = 91; y < 94; y++) put(b, x, y, hazard(x, y, 6) ? AMBD : HZ);
    glyph(b, k ? 5 : 2, px - 5, 98, AMB, 2);
    rect(b, px - 1, 122, 2, 4, S[2]);
    for (let j = 0; j < 5; j++) { put(b, px - 5 + j, 128 + j, I('#6a5210')); put(b, px + 4 - j, 128 + j, I('#6a5210')); }     // the arrow down to the pad (lit live)
  });
  // the tool wall: a pegboard with a wrench, a ring spanner, a mallet, a coil of hose, a spare dome
  rect(b, 890, 126, 46, 62, S[0]); rect(b, 891, 127, 44, 60, S[1]); rect(b, 891, 127, 44, 1, S[3]);
  for (let y = 131; y < 186; y += 5) for (let x = 894; x < 934; x += 5) put(b, x, y, S[0]);
  rect(b, 898, 140, 3, 30, S[5]); rect(b, 898, 140, 1, 30, S[7]); rect(b, 896, 134, 7, 6, S[5]); rect(b, 898, 134, 3, 3, S[1]); rect(b, 896, 134, 7, 1, S[7]);     // wrench
  shape(b, 906, 132, 918, 144, (x, y) => { const d = Math.hypot(x - 912, y - 138); return d <= 5.2 && d > 2.4; }, (x, y) => (x - 912) + (y - 138) < 0 ? S[7] : S[5]);
  rect(b, 911, 143, 3, 28, S[5]); rect(b, 911, 143, 1, 28, S[7]);                                                                                                        // ring spanner
  rect(b, 921, 134, 11, 7, S[0]); rect(b, 922, 135, 9, 5, S[4]); rect(b, 922, 135, 9, 1, S[6]); rect(b, 925, 141, 3, 26, HOSE[0]); rect(b, 925, 141, 1, 26, HOSE[1]);   // mallet
  shape(b, 895, 172, 909, 186, (x, y) => { const d = Math.hypot(x - 902, y - 179); return d <= 6 && d > 2.5; }, (x, y) => Math.hypot(x - 902, y - 179) > 4.4 ? ((x - 902) + (y - 179) < 0 ? HOSE[2] : HOSE[1]) : HOSE[0]);
  shape(b, 916, 172, 932, 185, (x, y) => ((x - 924) / 7.5) ** 2 + ((y - 184) / 9) ** 2 <= 1 && y < 184, (x, y) => x < 921 && y > 178 ? DOME[3] : x > 928 ? DOME[0] : DOME[1]);
  rect(b, 915, 184, 18, 2, S[5]); rect(b, 915, 185, 18, 1, S[2]);
  vent(b, 994, 172, 30, 14);
  // the wall fan: a round housing with a grille (the blades are live)
  shape(b, FAN.x - 17, FAN.y - 17, FAN.x + 17, FAN.y + 17, (x, y) => (x - FAN.x) ** 2 + (y - FAN.y) ** 2 <= 16.5 ** 2, (x, y) => {
    const d = Math.hypot(x - FAN.x, y - FAN.y), l = (x - FAN.x) * -0.6 + (y - FAN.y) * -0.8;
    return d > 15.6 ? S[0] : d > 12.6 ? (l > 6 ? S[6] : l > 0 ? S[5] : l > -7 ? S[4] : S[3]) : d > 11.6 ? S[0] : SP[1];
  });
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.39; put(b, Math.round(FAN.x + Math.cos(a) * 14 - 0.5), Math.round(FAN.y + Math.sin(a) * 14 - 0.5), S[7]); }
}
// 1040-1236: the fuel station's wall: the drop sign, three dials, a downpipe and the pink sight glass
const DIALS = [[1110, 94], [1131, 94], [1152, 94]];
const SIGHT = { x: 1192, y0: 72, y1: 150 };
function fitFuel(b) {
  const wput = (x, y, c) => { if (isWall(x, y)) put(b, x, y, c); };
  for (const [xa, xb, sag, c] of [[1044, 1180, 9, I('#6a3a78')]]) for (let x = xa; x <= xb; x++) { const u = (x - xa) / (xb - xa), y = Math.round(CEILY + 1 + sag * 4 * u * (1 - u)); wput(x, y, c); wput(x, y + 1, S[0]); }
  // the sign: a pink drop
  plaque(b, 1052, 78, 30, 32);
  shape(b, 1058, 82, 1076, 106, (x, y) => { const dx = x - 1067, dy = y - 98; return dx * dx + dy * dy <= 42 || (dy < 0 && dy > -14 && Math.abs(dx) <= (14 + dy) * 0.42); }, (x, y) => (x - 1067) < -2 && y > 94 && y < 101 ? MAGL : (x - 1067) > 2 || y > 102 ? MAGD : MAG);
  // the dials (needles are live)
  rect(b, 1094, 78, 74, 34, S[0]); rect(b, 1095, 79, 72, 32, S[3]); rect(b, 1095, 79, 72, 1, S[5]); rect(b, 1095, 110, 72, 1, S[1]);
  for (const [dx, dy] of DIALS) {
    shape(b, dx - 9, dy - 9, dx + 9, dy + 9, (x, y) => (x - dx) ** 2 + (y - dy) ** 2 <= 81, (x, y) => { const d = Math.hypot(x - dx, y - dy); return d > 8 ? S[0] : d > 6.4 ? ((x - dx) + (y - dy) < 0 ? S[7] : S[5]) : SCR0; });
    for (let k = 0; k < 5; k++) { const a = Math.PI * (1.15 + k * 0.175); put(b, Math.round(dx + Math.cos(a) * 5 - 0.5), Math.round(dy + Math.sin(a) * 5 - 0.5), k > 3 ? I('#ff3b30') : CDIM); }
    rect(b, dx - 3, dy + 4, 6, 1, CDIM);
  }
  // a steel downpipe with clamps
  for (let y = CEILY; y < 197; y++) { put(b, 1174, y, S[0]); put(b, 1175, y, S[5]); put(b, 1176, y, S[4]); put(b, 1177, y, S[3]); put(b, 1178, y, S[2]); put(b, 1179, y, S[0]); if (y % 26 === 8) rect(b, 1173, y, 8, 2, S[4]); }
  // the pink sight glass: the nectar main comes down here (bubbles are live)
  const sx = SIGHT.x;
  for (let y = PIPE.y + 8; y < 197; y++) { put(b, sx - 1, y, S[0]); put(b, sx, y, S[6]); put(b, sx + 1, y, S[5]); put(b, sx + 2, y, S[4]); put(b, sx + 3, y, S[4]); put(b, sx + 4, y, S[3]); put(b, sx + 5, y, S[2]); put(b, sx + 6, y, S[0]); }
  for (let y = SIGHT.y0; y < SIGHT.y1; y++) { put(b, sx, y, S[0]); put(b, sx + 1, y, MAG); put(b, sx + 2, y, I('#d8408c')); put(b, sx + 3, y, MAGD); put(b, sx + 4, y, I('#7a2452')); put(b, sx + 5, y, S[0]); }
  for (const y of [SIGHT.y0 - 3, SIGHT.y1, 110]) { rect(b, sx - 2, y, 10, 3, S[0]); rect(b, sx - 1, y, 8, 2, S[5]); rect(b, sx - 1, y, 8, 1, S[7]); }
  vent(b, 1056, 120, 26, 14);
}
// 1240-1446: the conveyor's track under the second window (its boxes and the two hatches are live)
function fitCargo(b) {
  const y = CONV.y;
  for (let x = CONV.x0 - 14; x < CONV.x1 + 14; x++) { put(b, x, y, S[6]); put(b, x, y + 1, S[4]); put(b, x, y + 2, S[0]); }
  for (let x = CONV.x0 + 6; x < CONV.x1; x += 34) { for (let k = 0; k < 6; k++) rect(b, x + k, y + 3 + k, 2, 1, S[3]); rect(b, x - 1, y + 3, 4, 1, S[0]); }
  // glyph stencils between the brackets
  for (let i = 0; i < 4; i++) glyph(b, i + 3, 1300 + i * 22, 172, S[3]);
  rect(b, 1296, 184, 92, 1, S[3]); rect(b, 1296, 185, 92, 1, S[0]);
}
// 1450-1600: the bulkhead to the STAR GARDEN
const BUDS = [[1528, 134], [1564, 168], [1486, 67], [1522, 160], [1584, 130]];
function fitGarden(b) {
  const wput = (x, y, c) => { if (isWall(x, y)) put(b, x, y, c); };
  // heavy plating round the doorway, the dark doorway itself (a hint of the garden's pink light low down)
  for (let y = CEILY; y < BACK; y++) for (let x = 1546; x < AX1; x++) put(b, x, y, ramp([S[2], S[3]], 0.75 - 0.75 * ss(CEILY, BACK, y) + 0.2 * (fbm(x / 30, y / 60, 55, 2) - 0.5), x, y));
  for (let y = CEILY; y < BACK; y++) { put(b, 1545, y, S[0]); put(b, 1546, y, S[5]); put(b, 1547, y, S[4]); put(b, 1548, y, S[4]); }
  for (const y of [86, 116, 146]) { for (let x = 1549; x < AX1; x++) { put(b, x, y, S[0]); put(b, x, y + 1, S[4]); } }
  for (let y = 70; y < 200; y += 15) for (const x of [1552, 1568]) { put(b, x, y, S[7]); put(b, x + 1, y, S[4]); put(b, x, y + 1, S[1]); put(b, x + 1, y + 1, S[0]); }
  for (let y = 146; y < BACK; y++) for (let x = 1574; x < AX1; x++) {
    const k = (y - 146) / 60, u = (x - 1574) / 26;
    put(b, x, y, dth(x, y) < k * k * 0.75 * u ? I('#5a2466') : dth(x + 2, y + 1) < k * 0.5 ? I('#241a44') : S[0]);
  }
  // the garden sign: a pink mushroom between two stars
  plaque(b, 1462, 74, 62, 30);
  shape(b, 1482, 79, 1504, 92, (x, y) => ((x - 1493) / 10.5) ** 2 + ((y - 91) / 11) ** 2 <= 1 && y < 91, (x, y) => y < 84 ? MAGL : x > 1498 ? MAGD : MAG);
  for (const [x, y] of [[1487, 86], [1493, 83], [1499, 87]]) { rect(b, x, y, 2, 2, WHITE); }
  rect(b, 1490, 91, 6, 8, I('#e8dcc8')); rect(b, 1490, 91, 2, 8, I('#fff6e6')); rect(b, 1494, 91, 2, 8, I('#b8a890')); rect(b, 1483, 91, 20, 1, MAGD);
  for (const [x, y, c] of [[1471, 86, AMB], [1514, 82, CYAN], [1512, 94, AMB]]) { rect(b, x - 2, y, 5, 1, c); rect(b, x, y - 2, 1, 5, c); put(b, x, y, WHITE); }
  chevSign(b, 1470, 112);
  // vines creeping in round the door: violet stems, pink buds, teal leaves
  const V0 = I('#4a2a70'), V1 = I('#8a4aa8'), TL = I('#2fb5a8'), TD = I('#1c6a78');
  const VINES = [[[1562, 62], [1540, 84], [1552, 110], [1528, 132]], [[1568, 62], [1576, 100], [1556, 130], [1564, 166]], [[1550, 62], [1526, 72], [1508, 60], [1486, 66]], [[1552, 110], [1540, 122], [1538, 150], [1522, 158]], [[1590, 62], [1582, 80], [1594, 104], [1584, 128]]];
  VINES.forEach((v, n) => {
    const pts = bez(v, 60);
    for (const [x, y] of pts) rect(b, Math.round(x) - 1, Math.round(y), 3, 3, S[0]);
    for (const [x, y] of pts) { rect(b, Math.round(x), Math.round(y), 2, 2, V0); put(b, Math.round(x), Math.round(y), V1); }
    for (let i = 6; i < pts.length; i += 9) {
      const [x, y] = pts[i].map(Math.round), s = (i + n) % 2 ? 1 : -1;
      if ((i + n) % 3 === 0) { rect(b, x - 1, y - 3, 3, 3, MAG); put(b, x - 1, y - 3, MAGL); put(b, x + 1, y - 1, MAGD); }
      else { rect(b, x + (s > 0 ? 2 : -4), y - 1, 3, 2, TL); put(b, x + (s > 0 ? 4 : -4), y - 2, TL); put(b, x + (s > 0 ? 2 : -2), y, TD); put(b, x + (s > 0 ? 3 : -3), y + 1, TD); }
    }
  });
  for (const [x, y] of BUDS) { rect(b, x - 3, y - 3, 6, 6, S[0]); rect(b, x - 2, y - 2, 4, 4, MAG); rect(b, x - 2, y - 2, 2, 2, MAGL); put(b, x + 1, y + 1, MAGD); }
}

// =====================================================================================================================
// The hangar floor between the wall and the deck edge (seen a little from above), with the landing pads
// =====================================================================================================================
function pad(b, cx, cy, rx, ry, cyan) {
  shape(b, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 2, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy - 1) / ry) ** 2 <= 1, S[0]);
  shape(b, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, (x, y) => {
    const u = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (u > 0.5) { const a = Math.atan2((y - cy) / ry, (x - cx) / rx), on = Math.floor((a / Math.PI + 1) * 9 + 0.5) % 2; return cyan ? (on ? (y < cy ? CDIM : I('#3fa8c8')) : SCR1) : on ? (y < cy ? AMBD : AMB) : HZ; }
    if (u > 0.4) return S[0];
    return u > 0.14 && u < 0.24 ? (cyan ? CYAN : CDIM) : ramp([S[1], S[2]], 0.5, x, y);
  });
  rect(b, cx - 2, cy, 4, 1, cyan ? CYANL : I('#3fa8c8'));
}
function paintFloor(b, xa, xb) {
  const FL = [S[1], S[2], C28, S[3]], EL = I('#33488a'), PK = I('#5a2f7a');
  for (let y = BACK; y < DECK; y++) for (let x = xa; x < xb; x++) {
    const k = (y - BACK) / (DECK - BACK), xs = x - PX0;
    let c = ramp(FL, 0.22 + 0.55 * k + 0.25 * (fbm(xs / 26, y / 5, 31, 2) - 0.5), xs, y);
    const m = Math.min(x - (OPEN.x0 + 12), OPEN.x1 - 12 - x);          // Earth-light spilling in through the mouth
    if (m > 0 && dth(xs, y) < (0.62 - k * 1.5) * Math.min(1, m / 30)) c = EL;
    if (x > 1540 && dth(xs, y) < (x - 1540) / 60 * (0.55 - k * 0.5)) c = PK;      // the garden's pink light at its door
    put(b, x, y, c);
  }
}
function floorMarks(b) {
  for (let x = 662 - 46 * 15; x < AX1; x += 46) for (let y = BACK + 1; y < DECK; y++) put(b, x, y, S[0]);       // plate seams
  for (let x = -ML; x < AX1; x++) { put(b, x, 212, S[0]); put(b, x, 213, (x - PX0) % 3 ? S[3] : C28); put(b, x, 221, S[0]); }
  // the lip of the bay mouth: a hazard-striped threshold with the field emitter rail
  for (let x = OPEN.x0 + 10; x < OPEN.x1 - 10; x++) {
    const xs = x - PX0;
    put(b, x, BACK, (xs % 12) < 5 ? CYAN : S[0]); put(b, x, BACK + 1, S[5]);
    for (let y = BACK + 2; y < BACK + 5; y++) put(b, x, y, hazard(xs, y, 8) ? AMBD : HZ);
    put(b, x, BACK + 5, S[0]);
  }
  // hazard chevrons on the floor before the garden door, a painted bay glyph by the service pads
  for (let i = 0; i < 3; i++) for (let k = 0; k < 5; k++) { const x = 1488 + i * 18; for (const y of [216 + k, 226 - k]) rect(b, x + k * 2, y, 5, 1, i === 2 ? I('#a8841a') : I('#7a5e16')); }
  glyph(b, 2, 905, 215, I('#2a3f6e'), 1); glyph(b, 5, 1046, 215, I('#2a3f6e'), 1);
  for (let x = 10; x < 74; x++) { put(b, x, BACK, S[5]); for (let y = BACK + 1; y < BACK + 4; y++) put(b, x, y, hazard(x, y, 8) ? AMBD : HZ); put(b, x, BACK + 4, S[0]); }      // the blast door's threshold
  for (const [cx, cy, rx, ry] of PADS) pad(b, cx, cy, rx, ry, false);
  pad(b, ARR.x, 221, 34, 7.5, true);
}

// =====================================================================================================================
// Behind the play line: parked mini saucers on their pads, fuel hoses, the booth's console, the fuel station, cargo
// =====================================================================================================================
function saucer(b, cx, by) {
  const SSTR = PAL.S;
  // legs and feet
  for (const s of [-1, 1]) { line(b, cx + s * 10, by - 12, cx + s * 17, by - 2, S[3], 2); line(b, cx + s * 10, by - 12, cx + s * 17, by - 2, S[5]); rect(b, cx + s * 17 - 2, by - 1, 6, 2, S[4]); rect(b, cx + s * 17 - 2, by - 1, 6, 1, S[6]); }
  // belly
  shape(b, cx - 15, by - 16, cx + 15, by - 7, (x, y) => ((x - cx) / 14) ** 2 + ((y - (by - 15)) / 7) ** 2 <= 1 && y >= by - 15, (x, y) => x - cx < -6 ? S[3] : (y > by - 10.5 || x - cx > 7) ? S[1] : S[2]);
  // the sleeping eye: a steel pod, the lid shut
  ball(b, cx, by - 10, 5.2, 5.2, [SSTR[2], SSTR[3], SSTR[4], SSTR[5], SSTR[6]]);
  rect(b, cx - 4, by - 9, 9, 1, S[0]); rect(b, cx - 3, by - 8, 7, 1, S[5]); put(b, cx - 5, by - 10, S[0]); put(b, cx + 5, by - 10, S[0]);
  // the disc
  shape(b, cx - 25, by - 23, cx + 25, by - 11, (x, y) => ((x - cx) / 24) ** 2 + ((y - (by - 17)) / 5.2) ** 2 <= 1, (x, y) => {
    const dy = y - (by - 17), dx = (x - cx) / 24;
    return dy < -3 ? (dx < 0.1 ? S[7] : S[6]) : dy < -1 ? (dx < -0.3 ? S[6] : S[5]) : dy < 0 ? S[4] : dy < 1 ? S[1] : dy < 3 ? (dx < -0.3 ? S[4] : S[3]) : S[2];
  });
  for (let i = -3; i <= 3; i++) rect(b, cx + i * 6 - 1, by - 17, 2, 1, i % 2 ? I('#b8408a') : AMBD);
  // dome on its ring
  shape(b, cx - 10, by - 34, cx + 10, by - 22, (x, y) => ((x - cx) / 9.5) ** 2 + ((y - (by - 22)) / 10.5) ** 2 <= 1 && y < by - 22, (x, y) => {
    const u = (x - cx) / 9.5, v = (y - (by - 22)) / 10.5;
    return u < -0.3 && u > -0.62 && v > -0.78 && v < -0.2 ? DOME[3] : u > 0.42 ? DOME[0] : v < -0.72 ? DOME[2] : DOME[1];
  });
  put(b, cx - 5, by - 30, WHITE); put(b, cx - 6, by - 29, WHITE);
  rect(b, cx - 3, by - 26, 6, 4, DOME[0]); rect(b, cx - 2, by - 27, 4, 1, DOME[0]);       // the empty seat
  rect(b, cx - 11, by - 22, 22, 1, S[6]); rect(b, cx - 11, by - 21, 22, 1, S[3]);
  // antenna and its lamp
  rect(b, cx, by - 37, 1, 4, S[5]); rect(b, cx - 1, by - 40, 3, 3, AMBD); put(b, cx - 1, by - 40, AMBL);
}
function hose(b, pts, cols) {
  for (const [x, y] of pts) rect(b, Math.round(x) - 1, Math.round(y) - 1, 3, 3, cols[1]);
  pts.forEach(([x, y], i) => {
    const n = pts[Math.min(pts.length - 1, i + 1)], p = pts[Math.max(0, i - 1)], hor = Math.abs(n[0] - p[0]) > Math.abs(n[1] - p[1]);
    x = Math.round(x); y = Math.round(y);
    if (i % 4 === 0) for (let k = -1; k <= 1; k++) put(b, x + (hor ? 0 : k), y + (hor ? k : 0), cols[0]);
    else put(b, x - (hor ? 0 : 1), y - (hor ? 1 : 0), cols[2]);
  });
}
// a cargo crate: steel box, amber corner brackets, a glyph plaque, grip slots, an optional colour band
function paintCrate(w, h, g, band) {
  const b = buf(w + 2, h + 2, 1, 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = y === 0 ? S[7] : y < 3 ? S[6] : y === 3 ? S[2] : y >= h - 3 ? S[3] : S[5];
    if (y > 3 && y < h - 3) c = x < 2 ? S[6] : x >= w - 3 ? S[4] : ramp([S[4], S[5]], 0.75 - (y - 4) / (h - 7) * 0.6, x, y);
    put(b, x, y, c);
  }
  rect(b, 0, h - 1, w, 1, S[2]);
  for (const [cx, cy, sx, sy] of [[0, 4, 1, 1], [w - 1, 4, -1, 1], [0, h - 4, 1, -1], [w - 1, h - 4, -1, -1]]) for (let k = 0; k < 4; k++) { put(b, cx + sx * k, cy, k ? AMB : AMBL); put(b, cx, cy + sy * k, AMB); put(b, cx + sx * k, cy + sy, AMBD); }
  const px = Math.floor(w / 2) - 5, py = Math.floor(h / 2) - 4;
  rect(b, px, py, 11, 11, S[1]); rect(b, px, py, 11, 1, S[0]); glyph(b, g, px + 3, py + 2, CYAN); put(b, px + 5, py + 4, CYANL);
  rect(b, 4, py + 2, 1, 6, S[2]); rect(b, w - 5, py + 2, 1, 6, S[2]);
  if (band) { rect(b, 0, h - 7, w, 2, band); rect(b, px, h - 7, 11, 2, S[1]); }
  outline(b);
  return b;
}
function paintRear(wb) {
  // ---- the mock's two parked mini saucers, the fuel valve between their pads and a hose to each
  {
    const b = buf(140, 110, 20, -130);
    hose(b, bez([[50, 182], [50, 208], [40, 218], [31, 211]], 46), HOSE);
    hose(b, bez([[51, 182], [52, 210], [62, 219], [69, 211]], 46), HOSE);
    shape(b, 44, 172, 58, 186, (x, y) => (x - 50.5) ** 2 + (y - 179) ** 2 <= 36, (x, y) => { const d = Math.hypot(x - 50.5, y - 179); return d > 4.6 ? S[5] : d > 3 ? AMBD : d > 1.6 ? S[1] : AMB; });
    saucer(b, 22, 221); saucer(b, 78, 221);
    outline(b, S[0]);
    haze(b, S[2], 0.12, S[0]);
    stamp(wb, b, PX0, 0);
  }
  // ---- the booth's console under the cow tally: a slanted desk with buttons and a lever
  {
    const b = buf(48, 40, -176, -190);
    rect(b, 186, 210, 30, 16, S[3]); rect(b, 186, 210, 2, 16, S[5]); rect(b, 212, 210, 4, 16, S[2]);
    for (let i = 0; i < 6; i++) rect(b, 184 + i, 209 - i, 34 - i, 1, i ? S[4] : S[6]);
    rect(b, 189, 203, 28, 1, S[7]);
    for (const [x, c] of [[192, AMB], [197, MAG], [202, CYAN], [207, AMB]]) { rect(b, x, 206, 3, 2, c); }
    rect(b, 212, 196, 1, 8, S[6]); rect(b, 211, 194, 3, 3, I('#ff3b30')); put(b, 211, 194, I('#ffd6d1'));
    rect(b, 190, 214, 12, 7, SCR0); rect(b, 191, 216, 7, 1, CDIM); rect(b, 191, 218, 9, 1, CDIM);
    rect(b, 184, 226, 34, 2, S[2]);
    outline(b, S[0]); haze(b, S[2], 0.14, S[0]);
    stamp(wb, b);
  }
  // ---- the fuel station under catwalk 2: a tank on its saddles, the pump with its hose
  {
    const b = buf(140, 60, -1044, -174);
    const x0 = 1050, x1 = 1126, cy = 203, ry = 19;
    shape(b, x0, cy - ry, x1, cy + ry, (x, y) => { const e = Math.min(x - x0, x1 - x); const cap = e < 12 ? Math.sqrt(Math.max(0, 1 - ((12 - e) / 12) ** 2)) : 1; return Math.abs(y - cy) <= ry * cap; }, (x, y) => {
      const v = (y - cy) / ry;
      return v < -0.72 ? S[5] : v < -0.4 ? S[4] : v < 0.15 ? S[3] : v < 0.6 ? S[2] : S[1];
    });
    for (const x of [1066, 1108]) for (let y = cy - ry; y <= cy + ry; y++) if (get(b, x, y) !== NONE) { put(b, x, y, S[1]); put(b, x + 1, y, S[5]); put(b, x + 2, y, S[1]); }
    for (let x = 1074; x < 1102; x++) for (let y = cy - 3; y < cy + 4; y++) put(b, x, y, hazard(x, y, 8) ? AMBD : HZ);
    rect(b, 1078, cy - 12, 20, 6, S[0]); rect(b, 1079, cy - 11, 18, 2, MAGL); rect(b, 1079, cy - 9, 18, 2, MAG);                    // level window: nectar
    glyph(b, 4, 1085, cy + 7, S[6]);
    rect(b, 1084, cy - ry - 4, 8, 4, S[4]); rect(b, 1084, cy - ry - 4, 8, 1, S[6]);                                                  // filler cap
    for (const x of [1058, 1112]) { rect(b, x, cy + ry - 4, 8, 9, S[3]); rect(b, x, cy + ry - 4, 2, 9, S[5]); rect(b, x - 2, cy + ry + 4, 12, 2, S[4]); }
    // the pump
    rect(b, 1140, 186, 26, 40, S[3]); rect(b, 1140, 186, 26, 2, S[5]); rect(b, 1140, 186, 2, 40, S[5]); rect(b, 1162, 188, 4, 38, S[1]); rect(b, 1138, 224, 30, 3, S[2]);
    rect(b, 1144, 191, 16, 10, SCR0); rect(b, 1145, 193, 9, 1, MAG); rect(b, 1145, 195, 12, 1, MAGD); rect(b, 1145, 197, 6, 1, CDIM);
    for (let x = 1140; x < 1166; x++) for (let y = 206; y < 210; y++) put(b, x, y, hazard(x, y, 6) ? AMBD : HZ);
    rect(b, 1146, 214, 4, 4, AMB); rect(b, 1154, 214, 4, 4, CYAN);
    hose(b, bez([[1166, 196], [1180, 196], [1182, 226], [1172, 224]], 30), HOSE);
    hose(b, bez([[1128, 208], [1134, 214], [1136, 222], [1140, 220]], 14), HOSE);
    outline(b, S[0]); haze(b, S[1], 0.22, S[0]);
    stamp(wb, b);
  }
  // ---- cargo stacks either side of the conveyor
  {
    const b = buf(210, 60, -1240, -172);
    const put1 = (x, y, w, h, g, band) => { const c = paintCrate(w, h, g, band); stamp(b, c, x, y); };
    put1(1246, 201, 28, 26, 1, MAGD); put1(1277, 207, 22, 20, 4, 0); put1(1250, 183, 20, 18, 6, AMBD);
    put1(1398, 203, 26, 24, 2, 0); put1(1402, 188, 18, 15, 5, I('#2f7f9f')); put1(1426, 213, 16, 14, 3, 0);
    swap(b, OUTI, S[0]); haze(b, S[1], 0.5, S[0]);
    stamp(wb, b);
  }
}

// =====================================================================================================================
// The play layer: the deck, the catwalks, cargo-crate steps, the ceiling crane (1px OUT outlines)
// =====================================================================================================================
const DKH = H + 12 - DECK;
function paintDeck() {
  const b = buf(WW, DKH, ML, -DECK);
  const FACE = [S[0], S[1], C1B, S[2]];
  for (let x = -ML; x < AX1; x++) {
    const xs = x - PX0;
    put(b, x, DECK, S[7]); put(b, x, DECK + 1, S[6]); put(b, x, DECK + 2, S[5]); put(b, x, DECK + 3, S[5]); put(b, x, DECK + 4, S[4]); put(b, x, DECK + 5, S[0]);
    for (let y = DECK + 6; y < DECK + DKH; y++) put(b, x, y, ramp(FACE, 0.95 - (y - DECK - 6) / 34 + 0.2 * (fbm(xs / 30, y / 9, 71, 2) - 0.5), xs, y));
  }
  for (let x = 8; x < AX1; x += 20) { put(b, x, DECK + 3, S[7]); put(b, x + 1, DECK + 3, S[2]); }
  // panels with seams, vents in every other one
  for (let j = -9; 384 + 44 * j < AX1; j++) {
    const x = 384 + 44 * j, odd = ((j % 2) + 2) % 2;
    for (let y = DECK + 6; y < DECK + DKH; y++) { put(b, x, y, S[0]); put(b, x + 1, y, y % 2 ? S[3] : S[2]); }
    if (odd) for (let y = DECK + 22; y < DECK + 33; y += 3) { rect(b, x + 8, y, 28, 1, S[0]); rect(b, x + 8, y + 1, 28, 1, S[3]); }
    else { rect(b, x + 16, DECK + 24, 13, 9, S[0]); glyph(b, j + 2, x + 20, DECK + 25, CDIM); }
  }
  // the magenta guide strip in its channel
  for (let x = -ML; x < AX1; x++) {
    put(b, x, DECK + 10, S[0]); put(b, x, DECK + 15, S[3]);
    const on = ((x - PX0 + 20) % 16 + 16) % 16 < 11;
    put(b, x, DECK + 11, on ? MAGL : S[0]); put(b, x, DECK + 12, on ? MAG : S[0]); put(b, x, DECK + 13, on ? MAG : S[0]); put(b, x, DECK + 14, on ? MAGD : S[0]);
  }
  // the lip at special places: cyan beam lights at the arrival pad, hazard stripes at the service pads and both ends
  for (let x = ARR.x - 26; x < ARR.x + 26; x++) { const on = (x - ARR.x + 26) % 6 < 4; put(b, x, DECK + 2, on ? CYANL : S[0]); put(b, x, DECK + 3, on ? CYAN : S[0]); }
  for (const [xa, xb] of [[-ML, 8], [936, 1038], [1574, AX1]]) for (let x = xa; x < xb; x++) for (let y = DECK + 2; y < DECK + 5; y++) put(b, x, y, hazard(x, y, 8) ? AMB : HZ);
  return b;
}
function paintCatwalk(w, top, o) {
  const b = buf(w + 2, 150, 1, 130);
  // the walkway: bright top edge, a grating, brackets under it, hazard-striped ends
  for (let x = 0; x < w; x++) {
    put(b, x, 0, S[7]); put(b, x, 1, S[6]); put(b, x, 2, S[5]); put(b, x, 3, x % 4 < 2 ? S[2] : S[5]); put(b, x, 4, S[4]); put(b, x, 5, S[2]);
  }
  for (let x = w - 12; x < w; x++) for (let y = 1; y < 5; y++) put(b, x, y, hazard(x, y, 6) ? AMB : HZ);
  if (o.hzL) for (let x = 0; x < 12; x++) for (let y = 1; y < 5; y++) put(b, x, y, hazard(-x, y, 6) ? AMB : HZ);
  for (let x = 0; x < w; x++) { put(b, x, 11, S[5]); put(b, x, 12, S[3]); }          // the truss's lower chord
  for (let x = 0; x < w; x += 12) rect(b, x, 6, 2, 5, S[4]);                         // its posts
  outline(b);
  for (let x = 2; x < w - 10; x += 12) for (let k = 0; k < 5; k++) put(b, x + 1 + (Math.floor(x / 12) % 2 ? k * 2 : 9 - k * 2), 6 + k, S[3]);   // diagonals (thin)
  // hanger rods up to the ceiling girder and the railing (thin, no outline)
  for (const hx of o.rods) { for (let y = top + 1; y < -13; y++) { put(b, hx, y, S[5]); put(b, hx + 1, y, S[2]); } rect(b, hx - 2, top, 6, 3, S[4]); rect(b, hx - 2, top, 6, 1, S[6]); rect(b, hx - 1, -40, 4, 2, S[4]); }
  for (let x = 0; x < w; x++) { put(b, x, -13, S[6]); put(b, x, -12, S[3]); if (x % 2) put(b, x, -7, S[4]); }
  for (let x = 4; x < w; x += 20) for (let y = -11; y < 0; y++) { put(b, x, y, S[6]); put(b, x + 1, y, S[3]); }
  for (let y = -13; y < 0; y++) { put(b, w - 2, y, S[6]); put(b, w - 1, y, S[3]); }
  if (o.hzL) for (let y = -13; y < 0; y++) { put(b, 0, y, S[6]); put(b, 1, y, S[3]); }
  return b;
}
// the parked crane: trolley on the rail, cables, a two-finger claw (the mock's screen coordinates)
function paintCrane() {
  const b = buf(40, 62, -412, -30), cx = 432, cy = CRANE.claw;
  rect(b, cx - 13, 38, 26, 9, S[4]); rect(b, cx - 13, 38, 26, 1, S[6]); rect(b, cx - 13, 46, 26, 1, S[2]);
  for (let x = cx - 13; x < cx + 13; x++) for (let y = 42; y < 45; y++) put(b, x, y, hazard(x, y, 6) ? AMB : HZ);
  rect(b, cx - 10, 36, 4, 3, S[2]); rect(b, cx + 6, 36, 4, 3, S[2]);
  for (const dx of [-5, 4]) for (let y = 47; y < cy; y++) { put(b, cx + dx, y, y % 4 === 1 ? S[4] : S[6]); put(b, cx + dx + 1, y, S[2]); }
  rect(b, cx - 10, cy, 20, 6, S[5]); rect(b, cx - 10, cy, 20, 1, S[7]); rect(b, cx - 10, cy + 5, 20, 1, S[3]); rect(b, cx - 3, cy + 2, 6, 2, AMB); rect(b, cx - 3, cy + 2, 6, 1, AMBL);
  for (const s of [-1, 1]) {
    const fx = s > 0 ? cx + 12 : cx - 15;
    rect(b, s > 0 ? cx + 8 : cx - 15, cy + 1, 7, 4, S[4]); rect(b, s > 0 ? cx + 8 : cx - 15, cy + 1, 7, 1, S[6]);       // shoulder
    rect(b, fx, cy + 5, 3, 19, S[5]); rect(b, fx + (s > 0 ? 2 : 0), cy + 5, 1, 19, S[3]);                                // finger
    rect(b, s > 0 ? cx + 9 : cx - 15, cy + 23, 6, 2, S[6]); rect(b, s > 0 ? cx + 9 : cx - 15, cy + 24, 6, 1, S[3]);       // hook under the crate
    put(b, fx + 1, cy + 8, AMB); put(b, fx + 1, cy + 9, AMBD);
  }
  outline(b);
  return b;
}
// the conveyor's hatch: a hooded opening in the wall with a hazard lip (drawn over the boxes, so they slide in and out)
function paintHatch(flip) {
  const b = buf(24, 28, 1, 1);
  rect(b, 0, 0, 22, 26, S[4]); rect(b, 0, 0, 22, 2, S[6]); rect(b, 0, 2, 2, 24, flip ? S[3] : S[6]); rect(b, 20, 2, 2, 24, flip ? S[6] : S[3]); rect(b, 0, 24, 22, 2, S[2]);
  rect(b, 3, 8, 16, 15, S[0]); rect(b, flip ? 3 : 15, 8, 4, 15, SP[2]);
  for (let x = 3; x < 19; x++) for (let y = 4; y < 7; y++) put(b, x, y, hazard(x, y, 6) ? AMB : HZ);
  outline(b);
  return b;
}
function paintBox(w, h, k) {
  const b = buf(w + 2, h + 2, 1, 1);
  rect(b, 0, 0, w, h, S[5]); rect(b, 0, 0, w, 1, S[7]); rect(b, w - 2, 1, 2, h - 1, S[4]); rect(b, 0, h - 1, w, 1, S[3]);
  put(b, 0, 1, AMB); put(b, w - 1, 1, AMB); rect(b, Math.floor(w / 2) - 1, Math.floor(h / 2) - 1, 3, 3, [CYAN, MAG, AMB][k % 3]);
  outline(b);
  return b;
}

// front: dark kit at the very bottom, in front of the deck (rim-lit by the magenta strip); parallax 1.3
const FRP = 1.3, FRW = Math.ceil((AX1 + 70) * FRP) + W + 30, FRY = H - 40;
const POSTS = [520 + 465, 1844];                // warning posts with a blinking lamp: x of the lamp in the strip
function paintFront() {
  const wb = buf(FRW, 54, ML, -FRY);
  const D0 = I('#0a0916'), D1 = I('#131127'), D2 = I('#1e1a3c'), RIM = I('#5a3a7e'), RIMM = I('#a8407e'), HZD = I('#7a5e16'), HZL = I('#b08a1c');
  // a fuel drum (its top at x..x+34)
  const drum = (b, x) => {
    shape(b, x, 238, x + 34, 282, (px, py) => px < x + 32 && py > 242, (px, py) => px > x + 30 ? RIM : px > x + 26 ? D2 : (Math.floor(py) === 251 || Math.floor(py) === 262) ? D2 : px < x + 10 ? D0 : D1);
    shape(b, x, 238, x + 34, 246, (px, py) => ((px - x - 15) / 17) ** 2 + ((py - 242.5) / 3.6) ** 2 <= 1, (px, py) => { const u = ((px - x - 15) / 17) ** 2 + ((py - 242.5) / 3.6) ** 2; return u > 0.62 && py < 242.5 ? RIM : D2; });
    rect(b, x + 17, 241, 5, 2, D0); rect(b, x + 17, 241, 5, 1, RIM); put(b, x + 28, 240, RIMM); put(b, x + 29, 241, RIMM);
    for (let px = x + 2; px < x + 27; px++) for (let py = 254; py < 259; py++) put(b, px, py, hazard(px - x - 8, py, 6) ? HZD : D0);
  };
  // a coil of hose with its nozzle (centre x)
  const coil = (b, cx) => {
    for (let k = 0; k < 3; k++) {
      const rx = 20 - k * 5.5, ry = 8.5 - k * 2.4;
      shape(b, cx - 23, 248, cx + 25, 282, (x, y) => { const u = ((x - cx) / rx) ** 2 + ((y - 264) / ry) ** 2; return u <= 1 && u > (k === 2 ? 0.15 : 0.48); }, (x, y) => y < 264 - ry * 0.7 ? RIM : k % 2 ? D2 : D1);
    }
    rect(b, cx + 17, 257, 8, 4, D2); rect(b, cx + 17, 257, 8, 1, RIM); rect(b, cx + 25, 258, 3, 2, RIM);
  };
  // a warning post with a hazard band (its lamp is live)
  const post = (b, x) => {
    rect(b, x, 244, 13, 38, D1); rect(b, x, 244, 13, 1, RIM); rect(b, x, 245, 1, 37, RIM); rect(b, x + 11, 245, 2, 37, D0); rect(b, x - 3, 265, 19, 17, D2); rect(b, x - 3, 265, 19, 1, RIM);
    for (let px = x; px < x + 13; px++) for (let py = 251; py < 257; py++) put(b, px, py, hazard(px - x + 5, py, 6) ? HZL : D0);
    rect(b, x + 3, 240, 7, 4, I('#6a4e10'));
  };
  const cable = (b, pts) => { for (const [x, y] of bez(pts, 80)) { rect(b, Math.round(x), Math.round(y), 2, 2, D1); put(b, Math.round(x), Math.round(y), (Math.round(x) & 3) ? D2 : RIM); } };
  // the corner of a crate, a strap over it
  const box = (b, x, w, h) => { rect(b, x, 282 - h, w, h, D1); rect(b, x, 282 - h, w, 1, RIM); rect(b, x + w - 1, 282 - h, 1, h, RIM); rect(b, x + 2, 282 - h + 2, w - 4, h, D2); rect(b, x + Math.floor(w / 2) - 2, 282 - h, 4, h, D0); rect(b, x + 3, 282 - h + 5, 5, 1, HZD); rect(b, x + 3, 282 - h + 7, 5, 1, HZD); };
  // a cone with a hazard band
  const cone = (b, x) => { for (let k = 0; k < 18; k++) { const hw = 1 + Math.floor(k * 0.4); rect(b, x - hw, 250 + k, hw * 2 + 1, 1, k > 6 && k < 11 ? HZL : D1); put(b, x + hw, 250 + k, RIM); } rect(b, x - 9, 267, 19, 15, D2); rect(b, x - 9, 267, 19, 1, RIM); };
  // the mock's corners (its screen coordinates + 520)
  { const b = view(wb, 520); drum(b, -8); coil(b, 53); post(b, 461); cable(b, [[380, 272], [404, 256], [432, 271], [458, 262]]); }
  // the rest of the hangar
  box(wb, 34, 30, 22); box(wb, 60, 18, 12);
  cable(wb, [[150, 274], [190, 252], [240, 272], [300, 258]]); cone(wb, 318);
  cable(wb, [[690, 262], [730, 250], [770, 274], [830, 266]]);
  coil(wb, 1262); box(wb, 1300, 22, 16);
  drum(wb, 1508); drum(wb, 1546);
  cable(wb, [[1700, 274], [1740, 252], [1800, 272], [1843, 262]]); post(wb, 1840);
  // a tendril of the garden's vines, down by the door (the front layer slides faster than the deck: it shows near camera 1300-1450)
  { const V0 = I('#2a1840'), V1 = I('#4a2a70');
    for (const pts of [[[1950, 282], [1968, 250], [2004, 264], [2030, 246]], [[1986, 282], [2012, 262], [2044, 272], [2076, 254]]]) for (const [x, y] of bez(pts, 90)) { rect(wb, Math.round(x), Math.round(y), 2, 2, V0); put(wb, Math.round(x), Math.round(y), V1); }
    for (const [x, y] of [[1969, 256], [2005, 260], [2030, 245], [2046, 268], [2076, 253]]) { rect(wb, x - 1, y - 2, 3, 3, MAGD); put(wb, x - 1, y - 2, MAG); } }
  return wb;
}

// =====================================================================================================================
// Baking, in steps (the joiner runs them once, in order, before anything of this area is drawn)
// =====================================================================================================================
const LY = {}, bakeMs = {};
let BK = null;                                // the back picture (wall + floor + parked things) while it is painted
const spr1 = b => ({ img: bake(b), ox: b.ox, oy: b.oy, w: b.w, h: b.h });
const step = (k, f) => () => { init(); const t0 = performance.now(); f(); bakeMs[k] = +(performance.now() - t0).toFixed(1); };
const STEPS = [
  step('wall1', () => { buildMask(); BK = buf(WW, DECK + MT, ML, MT); wallBase(BK, -ML, 400); }),
  step('wall2', () => wallBase(BK, 400, 800)),
  step('wall3', () => wallBase(BK, 800, 1200)),
  step('wall4', () => wallBase(BK, 1200, AX1)),
  step('struct', () => wallStructure(BK)),
  step('fitA', () => { fitArrival(BK); fitMock(BK); }),
  step('fitB', () => {
    fitService(BK); fitFuel(BK); fitCargo(BK); fitGarden(BK); ceilingRuns(BK);
    for (const [lx] of CLAMPS) glowInto(BK, lx, CEILY + 6, 12, CYAN, 0.3);                           // the still lights' glow
    for (const [xa, xb] of STRIPS) for (let x = xa + 10; x < xb; x += 26) glowInto(BK, x, 68, 9, CYAN, 0.16);
  }),
  step('floor1', () => paintFloor(BK, -ML, 800)),
  step('floor2', () => { paintFloor(BK, 800, AX1); floorMarks(BK); }),
  step('rear', () => { paintRear(BK); LY.back = bake(BK); BK = null; FD = null; }),
  step('deck', () => { LY.deck = bake(paintDeck()); }),
  step('plats', () => {
    LY.cat = {};
    const L = L5ART.level && L5ART.level();
    for (const pl of (L ? L.plats : [])) if (pl.t === 'cat' && pl.x < AX1) catSprite(pl);
    LY.crate = [0, 1, 2].map(k => spr1(paintCrate(28, 26, [0, 3, 6][k], [MAG, CYAN, AMBD][k])));
    LY.box1 = spr1(paintCrate(20, 17, 3, AMBD)); LY.box2 = spr1(paintCrate(16, 13, 5)); LY.hung = spr1(paintCrate(22, 18, 4));
    LY.can = spr1(paintCan());
    LY.crane = spr1(paintCrane());
    LY.hatch = [spr1(paintHatch(false)), spr1(paintHatch(true))];
    LY.box = [spr1(paintBox(10, 8, 0)), spr1(paintBox(12, 9, 1)), spr1(paintBox(8, 7, 2)), spr1(paintBox(11, 7, 3))];
    // a work lamp's cone of light (drawn with 'lighter'): flat, stepped, no blur
    const [c, g] = cnv(64, 60);
    g.globalCompositeOperation = 'lighter';
    for (const [k, a] of [[0.44, 0.07], [0.24, 0.06]]) { g.fillStyle = 'rgba(79,200,255,' + a + ')'; for (let y = 0; y < 57; y++) { const hw = Math.round(3 + y * k); g.fillRect(32 - hw, y, hw * 2 + 1, 1); } }
    LY.cone = c;
    LY.field = bakeField();
    // the magenta guide strip's glow: one strip of soft lights, 32 px apart (drawn with 'lighter')
    const [gs, q] = cnv(W + 64, 24), gr = q.createRadialGradient(12, 12, 0, 12, 12, 12), v = hex(PAL.MAG);
    gr.addColorStop(0, 'rgba(' + v + ',1)'); gr.addColorStop(0.35, 'rgba(' + v + ',0.45)'); gr.addColorStop(1, 'rgba(' + v + ',0)');
    q.globalCompositeOperation = 'lighter'; q.fillStyle = gr;
    for (let x = 4; x < W + 40; x += 32) { q.setTransform(1, 0, 0, 1, x, 0); q.fillRect(0, 0, 24, 24); }
    LY.strip = gs;
  }),
  step('front', () => { LY.front = bake(paintFront()); }),
  step('space', () => { LY.space = bake(paintSpace()); }),
  step('earth', () => { LY.earth = spr1(paintEarth(EARTH.r)); LY.halo = haloOf(EARTH.r + 30, '#3d7be0'); LY.moon = bake(paintMoonView()); LY.fmoon = spr1(paintFarMoon()); })
];
// a fuel can for the catwalk
function paintCan() {
  const b = buf(12, 16, 1, 1);
  rect(b, 0, 2, 10, 12, I('#c9702e')); rect(b, 0, 2, 2, 12, I('#eb9a4e')); rect(b, 8, 2, 2, 12, I('#7d3f22')); rect(b, 0, 13, 10, 1, I('#7d3f22'));
  rect(b, 2, 0, 4, 2, S[5]); rect(b, 6, 1, 3, 1, S[4]); rect(b, 2, 6, 6, 3, MAGD); rect(b, 2, 6, 6, 1, MAG);
  outline(b);
  return b;
}
function catSprite(pl) {
  const key = pl.x + ':' + pl.y + ':' + pl.w;
  if (!LY.cat[key]) {
    const o = CATS[pl.x] || { rods: [16, Math.round(pl.w / 2), pl.w - 18], lamps: [], hzL: true, cones: [] };
    LY.cat[key] = { s: spr1(paintCatwalk(pl.w, CEILY - 2 - pl.y, o)), o };
  }
  return LY.cat[key];
}

// =====================================================================================================================
// Drawing
// =====================================================================================================================
const blink = (n, ph = 0) => Math.floor((G.t + ph) / n) % 2 === 0;
const blit = (s, x, y) => ctx.drawImage(s.img, x - s.ox, y - s.oy);
// the backdrop (screen space, into g only): deep space, the Earth, far saucers on their way down to it
function bgI(g, cx) {
  const ox = PX0 - cx, t = G.t, ga = g.globalAlpha;
  g.fillStyle = PAL.SP[0]; g.fillRect(-10, -10, W + 20, H + 20);
  g.drawImage(LY.space, Math.round(-SPX - (cx - PX0) * 0.02), -SPY);
  const mx0 = OPEN.x0 - cx, mx1 = OPEN.x1 - cx;
  if (mx1 < -10 || mx0 > W + 10) return;
  // a few stars twinkle
  for (let i = 0; i < 14; i++) {
    const x = OPEN.x0 + 16 + Math.floor(hsh(i * 4.1) * (OPEN.x1 - OPEN.x0 - 32)) + ox, y = OPEN.y0 + 6 + Math.floor(hsh(i * 8.3) * (BACK - OPEN.y0 - 14));
    if (Math.floor((t + i * 23) / 26) % 3 === 0) { g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); g.fillStyle = 'rgba(200,247,255,0.55)'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
  }
  // the Earth: a soft blue halo, then the marble
  const ex = EARTH.x - PX0 + Math.round(ox * EARTH.k), ey = EARTH.y, hr = EARTH.r + 30;
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = ga * 0.3;
  g.drawImage(LY.halo, ex - 6 - hr, ey - 8 - hr);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = ga;
  g.drawImage(LY.fmoon.img, MOON.x + Math.round(ox * MOON.k) - LY.fmoon.ox, MOON.y - LY.fmoon.oy);
  g.drawImage(LY.earth.img, ex - LY.earth.ox, ey - LY.earth.oy);
  // far off: more saucers on their way down to the Earth (the robots' green: they are theirs)
  const P = PAL.G;
  for (let i = 0; i < 4; i++) {
    const u = (t / 1500 + i / 4) % 1, ph = i * 9;
    if (u < 0.04) continue;
    const sz = u < 0.4 ? 2 : u < 0.72 ? 1 : 0, w = 2 + sz;
    const x = Math.round(lerp(236, 301, u)) + Math.round(ox * 0.9) + Math.round(Math.sin((t + ph * 7) / 37) * 1), y = Math.round(lerp(60, 87, u)) + Math.round(Math.sin((t + ph * 5) / 23) * 1);
    if (x < mx0 + 14 || x > mx1 - 14) continue;
    g.fillStyle = '#74d3ee'; g.fillRect(x - 1, y - 2, 3, 1); g.fillStyle = P[4]; g.fillRect(x - w, y - 1, w * 2 + 1, 1); g.fillStyle = P[3]; g.fillRect(x - w - 1, y, w * 2 + 3, 1);
    g.fillStyle = P[1]; g.fillRect(x - w + 1, y + 1, w * 2 - 1, 1); g.fillStyle = '#ffffff'; g.fillRect(x, y + 1, 1, 1);
    if (blink(14, ph * 5)) { g.fillStyle = PAL.AMBL; g.fillRect(x - w - 1, y, 1, 1); }
  }
}
// the force field across the bay mouth (world space, under the wall): a faint veil, slanted sheen, drifting glints.
// Its still parts are baked: the stepped cyan glow where it meets the frame, the sheen bands, the running edge lights.
const FW = OPEN.x1 - OPEN.x0, FH = BACK - OPEN.y0;
function bakeField() {
  const [edge, g] = cnv(FW, FH);
  g.fillStyle = 'rgba(79,227,255,0.03)'; g.fillRect(0, 0, FW, FH);
  for (let d = 0; d < 6; d++) {              // brightest where it meets the frame: the door edges, the top and the lip
    g.fillStyle = 'rgba(79,227,255,' + (0.30 - d * 0.05).toFixed(3) + ')';
    g.fillRect(14 + d, 0, 1, FH); g.fillRect(FW - 15 - d, 0, 1, FH);
    g.fillRect(20, d, FW - 40, 1); g.fillRect(20, FH - 1 - d, FW - 40, 1);
  }
  const bands = [[250, 18, 0.085], [276, 5, 0.11]].map(([off, w, a]) => {
    const [c, q] = cnv(w + Math.ceil(FH / 2) + 2, FH);
    q.fillStyle = 'rgba(200,247,255,' + a + ')';
    for (let y = 0; y < FH; y += 2) q.fillRect(Math.round((FH - y) * 0.5), y, w, 2);
    return { c, off };
  });
  const [run, q] = cnv(1, FH + 14);          // energy running along the door edges (a 14-px pattern, scrolled)
  for (let y = 0; y < FH + 14; y++) { q.fillStyle = y % 14 < 8 ? 'rgba(200,247,255,0.75)' : 'rgba(79,227,255,0.28)'; q.fillRect(0, y, 1, 1); }
  const glints = [];
  for (let i = 0; i < 26; i++) glints.push({ x: OPEN.x0 + 16 + Math.floor(hsh(i * 3.7) * (FW - 44)), v: 0.12 + hsh(i * 1.9) * 0.2, ph: hsh(i * 7.1) * 150, w: 3 + Math.floor(hsh(i * 5.3) * 6), c: 'rgba(200,247,255,' + (0.14 + 0.2 * hsh(i * 9.7)).toFixed(3) + ')' });
  return { edge, bands, run, glints };
}
function field() {
  const x0 = OPEN.x0, x1 = OPEN.x1, y0 = OPEN.y0, y1 = BACK, t = G.t, F = LY.field;
  ctx.drawImage(F.edge, x0, y0);
  for (const { c, off } of F.bands) {
    const bx = Math.round(x0 + ((off + t * 0.2) % (FW + 120)) - 90), sx = Math.max(0, x0 - bx), w = Math.min(c.width, x1 - bx) - sx;
    if (w > 0) ctx.drawImage(c, sx, 0, w, FH, bx + sx, y0, w, FH);
  }
  for (const q of F.glints) { ctx.fillStyle = q.c; ctx.fillRect(q.x, Math.round(y1 - 4 - ((t * q.v + q.ph) % (FH - 8))), q.w, 1); }
  const ro = (Math.floor(t / 3) + y0 + 12) % 14;
  ctx.drawImage(F.run, 0, ro, 1, FH - 14, x0 + 14, y0 + 12, 1, FH - 14); ctx.drawImage(F.run, 0, ro, 1, FH - 14, x1 - 15, y0 + 12, 1, FH - 14);
  // a ripple of light runs down the field now and then
  const rp = (t * 0.9) % 420;
  if (rp < FH - 6) { const y = y0 + 3 + Math.floor(rp); ctx.fillStyle = 'rgba(200,247,255,0.30)'; ctx.fillRect(x0 + 16, y, FW - 32, 1); ctx.fillStyle = 'rgba(79,227,255,0.07)'; ctx.fillRect(x0 + 16, y - 5, FW - 32, 5); }
  // little arcs of energy between the emitters, sparkles on the field
  for (let x = x0 + 26, i = 0; x < x1 - 44; x += 20, i++) {
    if (Math.floor(t / 7 + i * 1.7) % 3) continue;
    ctx.fillStyle = 'rgba(200,247,255,0.85)';
    for (let k = 3; k < 20; k += 2) ctx.fillRect(x + k, y0 + 1 + Math.round(Math.sin(Math.PI * k / 20) * 3 + hsh(i * 9 + k + Math.floor(t / 7)) * 1.5), 1, 1);
  }
  for (let i = 0; i < 9; i++) {
    const q = Math.floor((t + i * 13) / 18), on = (t + i * 13) % 18 < 8;
    if (!on) continue;
    const side = hsh(q * 3.1 + i) < 0.5, x = side ? x0 + 16 + Math.floor(hsh(q + i * 5.5) * 5) : x1 - 18 - Math.floor(hsh(q + i * 5.5) * 5), y = y0 + 10 + Math.floor(hsh(q * 7.7 + i) * (y1 - y0 - 20));
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); ctx.fillStyle = 'rgba(79,227,255,0.8)'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
  }
}
function behindI(cx) {
  const t = G.t, P = PAL, see = (xa, xb) => xb > cx - 16 && xa < cx + W + 16;
  if (see(OPEN.x0, OPEN.x1)) field();
  if (see(WIN.x0, WIN.x1)) {                    // the Moon behind the second window (it slides a little: it is far away)
    const off = Math.round(clamp((cx - 800) * 0.07, 0, 44));
    ctx.drawImage(LY.moon, off, 0, WIN.x1 - WIN.x0, MV.h, WIN.x0, WIN.y0, WIN.x1 - WIN.x0, MV.h);
    for (let i = 0; i < 5; i++) if (Math.floor((t + i * 31) / 24) % 4 === 0) { const x = WIN.x0 + 8 + Math.floor(hsh(i * 6.1 + 2) * 106), y = WIN.y0 + 6 + Math.floor(hsh(i * 2.7) * 50); R(x, y, 1, 1, '#ffffff'); R(x - 1, y, 3, 1, 'rgba(200,247,255,0.5)'); R(x, y - 1, 1, 3, 'rgba(200,247,255,0.5)'); }
  }
  // the baked picture: wall, hangar floor, everything parked on it
  if (cx < ML) R(-ML, DECK, ML, H + 12 - DECK, '#17152e');      // left of x 0 (only a screen shake shows it)
  const sx = Math.max(-ML, Math.floor(cx) - 12), ex = Math.min(AX1, Math.floor(cx) + W + 12);
  if (ex > sx) ctx.drawImage(LY.back, sx + ML, 0, ex - sx, DECK + MT, sx, -MT, ex - sx, DECK + MT);
  // ---- live bits, zone by zone
  if (see(0, 380)) {
    // the blast door's bar light: LOCKED
    const k = 0.5 + 0.5 * Math.sin(t / 22);
    R(29, 80, 26, 5, mix('#5a1418', '#ff3b30', k)); R(29, 80, 26, 1, mix('#7a2a2a', '#ffb0a8', k));
    if (k > 0.6) M5.glow(42, 82, 14, '#ff3b30', 0.25 * k);
    // the booth: its up-arrows light in turn, the lens glows, the pad's ring pulses
    const a = Math.floor(t / 12) % 4;
    if (a < 3) for (let j = 0; j < 8; j++) { const y = 150 - a * 20 + j; R(ARR.x - 1 - j, y, 1, 2, P.CYAN); R(ARR.x + j, y, 1, 2, P.CYAN); }
    M5.glow(ARR.x, ARR.lens, 22, P.CYAN, 0.22 + 0.08 * Math.sin(t / 15));
    const pr = (t % 90) / 90;
    ctx.fillStyle = 'rgba(200,247,255,' + (0.5 * (1 - pr)).toFixed(3) + ')';
    for (const s of [-1, 1]) ctx.fillRect(ARR.x + s * Math.round(6 + pr * 26) - 1, 221, 2, 1);
    ctx.fillRect(ARR.x - Math.round(pr * 14), 221 - Math.round(1 + pr * 4), Math.round(pr * 28), 1); ctx.fillRect(ARR.x - Math.round(pr * 14), 221 + Math.round(1 + pr * 4), Math.round(pr * 28), 1);
    M5.glow(ARR.x, 222, 26, P.CYAN, 0.14);
    // the tally: the eighth slot blinks (the next cow), a cursor in the header
    if (blink(20)) for (let j = 0; j < 5; j++) for (let i = 0; i < 11; i++) if (COWPIC[j][i] === '#' && ((i + j) & 1)) R(176 + 2 + 36 + i, 84 + 19 + j, 1, 1, '#2f7f9f');
    if (blink(16, 5)) R(176 + 44, 84 + 3, 3, 1, P.CYANL);
    // the pods' ready lamps, the console
    for (let i = 0; i < 3; i++) if (Math.floor(t / 30) % 3 === i) { R(269 + i * 28, 104, 2, 2, P.CYANL); M5.glow(270 + i * 28, 105, 5, P.CYAN, 0.4); }
    if (blink(24, 7)) R(197, 206, 3, 2, P.MAGL);
  }
  if (see(380, 900)) {
    for (let x = OPEN.x0 + 26; x < OPEN.x1 - 24; x += 20) M5.glow(x, OPEN.y0, 7, P.CYAN, 0.35 + 0.15 * Math.sin(t / 9 + x - PX0));
    if (blink(16)) R(PX0 + 104 + 38, 95 + 22, 2, 1, P.CYANL);                       // the screen's cursor
    for (const sx of [422, 478]) if (blink(30, (sx - PX0) * 3)) { R(sx - 1, 181, 3, 3, P.AMBL); M5.glow(sx, 182, 6, P.AMB, 0.5); }
    // the parked crane and the crate in its claw
    if (HANGAR.crane) {
      blit(LY.crane, PX0, 0);
      blit(LY.hung, CRANE.x - 11, CRANE.claw + 6);
      const lamp = blink(12);
      RO(CRANE.x - 16, 40, 3, 3, lamp ? P.AMBL : '#8a6a12'); if (lamp) M5.glow(CRANE.x - 14, 41, 8, P.AMB, 0.6);
    }
  }
  if (see(880, 1240)) {
    // the wall fan turns
    { const a0 = t * 0.21; ctx.fillStyle = '#30345f';
      for (let k = 0; k < 3; k++) { const a = a0 + k * Math.PI * 2 / 3; for (let r = 2; r < 11; r++) { const w = r < 6 ? 2 : 3; ctx.fillRect(Math.round(FAN.x + Math.cos(a + r * 0.05) * r - w / 2), Math.round(FAN.y + Math.sin(a + r * 0.05) * r - w / 2), w, w); } }
      R(FAN.x - 2, FAN.y - 2, 4, 4, '#6272ab'); R(FAN.x - 1, FAN.y - 1, 2, 2, '#c3d0ee');
      for (let y = -9; y <= 9; y += 6) R(FAN.x - Math.round(Math.sqrt(121 - y * y)), FAN.y + y, Math.round(Math.sqrt(121 - y * y)) * 2, 1, '#17152e'); }
    // the pad signs' arrows, pointing down in turn
    for (let k = 0; k < 2; k++) if (Math.floor(t / 18) % 2 === k) { const px = k ? 1012 : 960; for (let j = 0; j < 5; j++) { R(px - 5 + j, 128 + j, 1, 1, P.AMBL); R(px + 4 - j, 128 + j, 1, 1, P.AMBL); } }
    // the dials' needles
    DIALS.forEach(([dx, dy], i) => { const a = Math.PI * (1.5 + 0.3 * Math.sin(t / (31 + i * 9) + i * 2) + (i === 2 ? 0.12 * Math.sin(t / 3) : 0)); for (let k = 1; k < 6; k++) R(Math.round(dx + Math.cos(a) * k - 0.5), Math.round(dy + Math.sin(a) * k - 0.5), 1, 1, P.AMB); R(dx - 1, dy - 1, 2, 2, '#c3d0ee'); });
    // bubbles rising in the sight glass
    for (let i = 0; i < 6; i++) { const u = (t / 110 + hsh(i * 5.7)) % 1, y = SIGHT.y1 - 2 - Math.floor(u * (SIGHT.y1 - SIGHT.y0 - 4)); R(SIGHT.x + 1 + (i % 3), y, 1, 1 + (i & 1), '#ffffff'); }
    M5.glow(SIGHT.x + 3, 110, 12, P.MAG, 0.16 + 0.05 * Math.sin(t / 20));
  }
  if (see(1196, AX1)) {
    // the nectar moving in the main's sight glasses (toward the fuel station)
    for (let x = PIPE.x0 + 36; x < AX1 - 30; x += 96) for (let i = 0; i < 3; i++) { const u = (t / 70 + i / 3 + x * 0.013) % 1; R(x + 20 - Math.floor(u * 20), PIPE.y + 3 + (i % 2), 2, 1, '#ffe3f3'); }
    // the conveyor: boxes ride from the right hatch to the left one
    const span = CONV.x1 - CONV.x0 + 24;
    for (let k = 0; k < 4; k++) {
      const s = LY.box[k], u = ((t * 0.3 + k * span / 4 + (k & 1) * 9) % span), x = Math.round(CONV.x1 + 12 - u);
      if (x > CONV.x0 - 14 && x < CONV.x1 + 4) blit(s, x, CONV.y - (s.h - 2));
    }
    for (let x = CONV.x0 + ((Math.floor(t * 0.3)) % 8); x < CONV.x1; x += 8) R(x, CONV.y + 1, 2, 1, '#8fa2d2');     // the belt's rollers turning
    blit(LY.hatch[0], CONV.x0 - 24, CONV.y - 22); blit(LY.hatch[1], CONV.x1 + 2, CONV.y - 22);
    for (const [hx, ph] of [[CONV.x0 - 14, 0], [CONV.x1 + 12, 20]]) { const on = blink(20, ph); R(hx, CONV.y - 25, 3, 2, on ? P.AMBL : '#8a6a12'); if (on) M5.glow(hx + 1, CONV.y - 24, 6, P.AMB, 0.45); }
    // the garden sign's mushroom glows; the vines' buds pulse
    M5.glow(1493, 88, 13, P.MAG, 0.2 + 0.08 * Math.sin(t / 17));
    BUDS.forEach(([x, y], i) => M5.glow(x, y, 7, P.MAG, 0.25 + 0.2 * Math.sin(t / 13 + i * 1.7)));
  }
  // every zone: the way-on chevrons, the pads' marker lamps (the ceiling lamps' and light strips' glow is baked)
  const cv = Math.floor(t / 10) % 4;
  if (cv < 3) for (const [x, y] of CHEVS) if (see(x, x + 42)) for (let k = 0; k < 5; k++) for (const yy of [y + 3 + k, y + 11 - k]) R(x + 7 + cv * 11 + k, yy, 2, 1, P.AMBL);
  for (const [px, py, rx] of PADS) if (see(px - rx - 8, px + rx + 8)) for (const s of [-1, 1]) { const on = blink(20, px - PX0); R(px + s * (rx + 3) - 1, py, 2, 1, on ? P.MAGL : '#7a2452'); if (on) M5.glow(px + s * (rx + 3), py, 5, P.MAG, 0.5); }
  // the work lamps under the catwalks light what is parked below: flat cones of light
  const L = L5ART.level && L5ART.level();
  if (L) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const pl of L.plats) if (pl.t === 'cat' && pl.x < AX1 && see(pl.x, pl.x + pl.w)) { const o = CATS[pl.x]; if (o) for (const lx of o.cones) ctx.drawImage(LY.cone, pl.x + lx - 32, pl.y + 15, 64, DECK - 4 - pl.y - 15, pl.x + lx - 32, pl.y + 15, 64, DECK - 4 - pl.y - 15); }
    ctx.restore();
  }
}
function groundI(cx) {
  const sx = Math.max(-ML, Math.floor(cx) - 12), ex = Math.min(AX1, Math.floor(cx) + W + 12);
  if (ex > sx) ctx.drawImage(LY.deck, sx + ML, 0, ex - sx, DKH, sx, DECK, ex - sx, DKH);
}
function platI(pl) {
  const P = PAL;
  if (pl.t === 'cat') {
    const c = catSprite(pl);
    blit(c.s, pl.x, pl.y);
    if (pl.x === 380) {                          // cargo left on the catwalk
      blit(LY.box1, 458, pl.y - 17); blit(LY.box2, 461, pl.y - 30); blit(LY.box2, 440, pl.y - 13);
    } else if (pl.x === 1040) { blit(LY.can, pl.x + pl.w - 30, pl.y - 14); blit(LY.can, pl.x + pl.w - 42, pl.y - 14); }
    for (const x of c.o.lamps) { RO(pl.x + x - 2, pl.y + 13, 5, 2, P.CYANL); M5.glow(pl.x + x, pl.y + 15, 8, P.CYAN, 0.35); }
  } else {
    blit(LY.crate[pl.x === 1000 ? 1 : pl.x === 340 ? 2 : 0], pl.x, pl.y);
  }
}
function frontI(cx) {
  const off = Math.round(cx * FRP), P = PAL;
  ctx.drawImage(LY.front, off + ML - 10, 0, W + 20, 54, -10, FRY, W + 20, 54);
  const on = blink(18);
  for (const px of POSTS) {
    const x = px - off;
    if (x < -20 || x > W + 20) continue;
    R(x, 241, 5, 3, on ? P.AMBL : '#8a6a12'); R(x, 241, 5, 1, on ? '#ffffff' : '#b08a1c'); if (on) M5.glow(x + 2, 242, 9, P.AMB, 0.55);
  }
}
// steam vents (world x, y): the fuel valve between the parked saucers, the fuel station's pump, a floor vent
const STEAM = [[450, 174, 0], [1153, 186, 40], [262, 206, 70]];
function overlayI(cx) {
  const t = G.t, P = PAL, ga = ctx.globalAlpha;
  // the magenta guide strip glows
  { const o = (((PX0 - cx) % 32) + 32) % 32, w = Math.min(LY.strip.width, AX1 - cx + 16 - (o - 28));
    if (w > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * 0.16; ctx.drawImage(LY.strip, 0, 0, w, 24, o - 28, DECK, w, 24); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = ga; } }
  // steam
  for (const [wx, wy, ph0] of STEAM) {
    if (wx < cx - 30 || wx > cx + W + 30) continue;
    for (let i = 0; i < 6; i++) {
      const ph = ((t * 0.5 + i * 31 + ph0) % 90) / 90, x = wx - cx + ph * 9 + Math.sin(ph * 6 + i) * 2, y = wy - ph * 22;
      ctx.fillStyle = 'rgba(200,210,240,' + (Math.sin(Math.PI * ph) * 0.22).toFixed(3) + ')'; pdisc(x, y, 2 + ph * 4);
    }
  }
  // spores drifting in from the garden, by its door
  if (cx + W > 1380) for (let i = 0; i < 9; i++) {
    const u = (t / (260 + i * 23) + hsh(i * 3.3)) % 1, x = 1596 - u * 190 - cx, y = 90 + hsh(i * 7.9) * 120 + Math.sin(t / 37 + i * 2) * 6;
    ctx.fillStyle = 'rgba(255,179,217,' + (0.7 * Math.sin(Math.PI * u)).toFixed(3) + ')'; ctx.fillRect(Math.round(x), Math.round(y), i % 3 ? 1 : 2, i % 3 ? 1 : 2);
  }
}

// =====================================================================================================================
// The area (contract)
// =====================================================================================================================
const HANGAR = {
  x0: AX0, x1: AX1, steps: STEPS, bakeMs,
  bg: bgI, behind: behindI, ground: groundI, plat: platI, front: frontI, overlay: overlayI,
  crane: true,                                  // the parked crane at x 832 (false hides it)
  pad: { x: ARR.x, y: DECK, top: ARR.lens }     // the arrival pad (the opening scene beams the hero in here)
};
L5ART.hangar = HANGAR;

// =====================================================================================================================
// The mission card (L5ART.card): screen space, clipped by the caller; G.p may be null and LV another level. The bay
// mouth with the Earth outside (a small globe from the same painter), the hero on the deck squaring up to an oggle:
// shots fly and it flashes, then its lamp blinks and its eye turns yellow (its tell), again. The picture is baked
// once per card width; it is drawn 12 px higher than its frame and the record strip covers its lowest rows, so the
// deck line is at y + h - 16.
// =====================================================================================================================
const CARDS = {};
function cardLayer(w, h) {
  const key = w + ':' + h;
  if (CARDS[key]) return CARDS[key];
  init();
  const b = buf(w, h + 14, 0, 0), dk = h - 16, fl = dk - 10, mid = Math.round(w / 2), r = rng(8080 + w);
  // space in the mouth, stars, the Earth with a dithered rim of light
  for (let y = 0; y < fl; y++) for (let x = 0; x < w; x++) put(b, x, y, ramp([SP[0], SP[1], SP[2], SP[3], I('#2b1c58')], clamp((fbm(x / 40, y / 26, 3, 3) - 0.38) * 2.2, 0, 1), x, y));
  for (let i = 0; i < w * 0.5; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * fl), k = r(); put(b, x, y, k < 0.5 ? I('#565a96') : k < 0.85 ? I('#e6ecff') : WHITE); if (k > 0.93) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(b, x + dx, y + dy, I('#7479b4')); }
  const ER = Math.min(27, Math.floor((fl - 14) / 2)), ex = mid + 4, ey = 13 + ER;
  shape(b, ex - ER - 5, ey - ER - 5, ex + ER + 5, ey + ER + 5, (x, y) => { const d = Math.hypot(x - ex + 2, y - ey + 2); return d > ER && d < ER + 5 && dth(x, y) < (ER + 5 - d) / 9; }, I('#2c4f9f'));
  stamp(b, paintEarth(ER), ex, ey);
  // the wall round the mouth: lintel with field emitters, steel frame, the bay door's hazard edges
  for (let y = 0; y < fl; y++) for (let x = 0; x < w; x++) {
    const e = Math.min(x, w - 1 - x), left = x < mid, tw = 5 + (tooth(y * 2 + 8) >> 1);
    let c = NONE;
    if (y < 15) c = y === 14 ? S[0] : y > 11 ? (x % 10 < 3 && e > 12 ? (y === 13 ? CYANL : CYAN) : S[3]) : ramp([S[1], S[2]], 0.5, x, y);
    else if (e < 3) c = ramp([S[1], S[2]], 0.6, x, y);
    else if (e === 3 || e === 8) c = S[0];
    else if (e < 8) c = left ? [S[6], S[5], S[4], S[3]][e - 4] : [S[5], S[4], S[3], S[2]][e - 4];
    else if (e < 9 + tw) c = e === 8 + tw ? S[0] : hazard(x, y, 8) ? (left ? AMB : AMBD) : HZ;
    else if (e === 9 + tw) c = dth(x, y) < 0.6 ? I('#3fa8c8') : NONE;       // the field, bright where it meets the door
    if (c !== NONE) put(b, x, y, c);
  }
  // the hangar floor behind the deck: the lip of the mouth, a landing pad
  for (let y = fl; y < dk; y++) for (let x = 0; x < w; x++) put(b, x, y, y === fl ? ((x % 10) < 4 && Math.min(x, w - 1 - x) > 9 ? CYAN : S[0]) : y < fl + 3 && Math.min(x, w - 1 - x) > 9 ? (hazard(x, y, 8) ? AMBD : HZ) : ramp([S[1], S[2], C28], 0.3 + 0.5 * (y - fl) / 10, x, y));
  shape(b, mid - 22, dk - 7, mid + 22, dk - 1, (x, y) => ((x - mid) / 21) ** 2 + ((y - dk + 4) / 3) ** 2 <= 1, (x, y) => { const u = ((x - mid) / 21) ** 2 + ((y - dk + 4) / 3) ** 2; return u > 0.5 ? (Math.floor((Math.atan2((y - dk + 4) / 3, (x - mid) / 21) / Math.PI + 1) * 7 + 0.5) % 2 ? AMBD : HZ) : S[1]; });
  // the deck: bright edge, lip, the magenta guide strip
  for (let x = 0; x < w; x++) {
    [S[7], S[6], S[5], S[4], S[0], S[0]].forEach((c, i) => put(b, x, dk + i, c));
    const on = x % 16 < 11;
    put(b, x, dk + 6, on ? MAGL : S[0]); put(b, x, dk + 7, on ? MAG : S[0]); put(b, x, dk + 8, on ? MAGD : S[0]); put(b, x, dk + 9, S[0]);
    for (let y = dk + 10; y < h + 14; y++) put(b, x, y, ramp([S[0], S[1], C1B], 0.9 - (y - dk - 10) / 20, x, y));
    if (x % 20 === 8) put(b, x, dk + 2, S[7]);
  }
  return (CARDS[key] = bake(b));
}
L5ART.card = function (x, y, w, h) {
  const img = cardLayer(w, h), T = G.t, s = T % 180, dk = h - 16, P = PAL;
  ctx.save(); ctx.translate(x, y);
  ctx.drawImage(img, 0, 0);
  // a few stars twinkle; a glint runs down the field
  for (let i = 0; i < 5; i++) if (Math.floor((T + i * 29) / 22) % 3 === 0) { const sx = 18 + Math.floor(hsh(i * 3.9 + w) * (w - 36)), sy = 18 + Math.floor(hsh(i * 7.3) * (dk - 34)); R(sx, sy, 1, 1, '#ffffff'); R(sx - 1, sy, 3, 1, 'rgba(200,247,255,0.5)'); R(sx, sy - 1, 1, 3, 'rgba(200,247,255,0.5)'); }
  for (let i = 0; i < 4; i++) { const yy = 16 + ((T * 0.3 + i * 17) % (dk - 30)); R(i % 2 ? 17 : w - 19, Math.round(yy), 2, 1, 'rgba(200,247,255,0.8)'); }
  // the hero fires; the oggle is hit, then warns (lamp, yellow eye, !) and shoots
  const hx = Math.round(w * 0.24), ox = Math.round(w * 0.77);
  const fire = s < 84, tell = s >= 104 && s < 164, zap = s >= 164, hit = fire && s > 14 && (s - 14) % 16 < 3;
  if (fire) for (let k = 0; k < 4; k++) {
    const age = s - k * 16;
    if (age < 0 || age > 14) continue;
    const bx = hx + 18 + age * ((ox - 12 - hx - 18) / 14);
    R(Math.round(bx) - 3, dk - 20, 5, 2, '#ffe066'); R(Math.round(bx), dk - 20, 2, 2, '#ffffff');
  }
  drawHero(HEROES[G.hero], hx, dk, 1, { pose: 'idle', t: T, aim: 'fwd', muzzle: fire && s % 16 < 4 ? 3 : 0, knife: 0 });
  if (fire && s % 16 < 3) flashAt(hx + 19, dk - 19, false);
  FLASH = hit;
  M5.oggle(ox + (hit ? 1 : 0), dk, -1, { pose: zap ? 'shoot' : tell ? 'warn' : hit ? 'hit' : 'aim', look: [-1, 0], t: T });
  FLASH = false;
  if (zap) { const rx = ox - 26 - (s - 164) * 2; R(rx - 2, dk - 18, 4, 9, OUT); R(rx - 1, dk - 17, 2, 7, P.BEAM); R(rx, dk - 15, 1, 3, OUT); }
  ctx.restore();
};
}
