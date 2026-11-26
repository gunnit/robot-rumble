'use strict';
// =====================================================================================================================
// MISSION 5 (ALIEN MOTHERSHIP) proposal frame: AREA 1: THE HANGAR. A mock screenshot for the family, rendered by the
// real engine: a harness fixture, NOT game content. Needs the shared cast first (proposals/level5/kit.js).
// It pushes a temporary mission 5 that holds only what this one frame shows: the docking bay of the mothership, its
// bay mouth open to space with the Earth outside, parked mini saucers, a catwalk, a ceiling crane, cargo crates, and
// the staged moment (Ines firing, an oggle bursting, three more oggles, an eye saucer bringing a cow in, a cow in a pod).
// Static art is painted pixel by pixel into buffers and baked once on the first draw; update() pins every pose, so
// only the small loops driven by G.t move with --frames. No Math.random / rand anywhere: the same command gives the
// same picture.
//   cd /Users/macbookair/game
//   node tools/harness/harness.mjs render --level 5 --x 601.6 --frames 30 --hero 0 --god --scale 3 \
//     --extra proposals/level5/kit.js --extra proposals/level5/hangar/scene.js --out proposals/level5/hangar/hangar.png
// (--x 601.6 puts the camera exactly at x 400, so world x = screen x + 400.)
// =====================================================================================================================
{
const PAL = M5.PAL;
const { NONE, I, buf, put, get, rect, shape, oval, ball, line, outline, mk } = M5.px;
const S = PAL.S.map(I), SP = PAL.SP.map(I), GR = PAL.G.map(I);
const MAG = I(PAL.MAG), MAGL = I(PAL.MAGL), CYAN = I(PAL.CYAN), CYANL = I(PAL.CYANL), AMB = I(PAL.AMB), AMBL = I(PAL.AMBL);
const AMBD = I('#c98a16'), HZ = I('#22222c'), WHITE = I('#ffffff'), OUTI = I(OUT);

// ------------------------------------------------------------ frame layout (screen coordinates; world x = x + CAM)
const CAM = 400;
const WX = x => CAM + x;
const DECK = 232;                            // the walkable deck (GROUND)
const BACK = 206;                            // where the back wall meets the hangar floor
const CEILY = 60;                            // under the ceiling girders
const OPEN = { x0: 200, x1: 468, y0: 60, y1: BACK, ch: 14 };      // the bay mouth in the back wall
const EARTH = { x: 346, y: 132, r: 66 };
const MOON = { x: 441, y: 128 };
const HERO = { x: 112, y: DECK };
const CAT = { x: WX(-20), y: 156, w: 216, t: 'cat' };             // the catwalk (one-way platform)
const CRATE = { x: WX(333), y: 206, w: 28, t: 'crate' };          // the cargo crate the shooter stands on
const BURST = { x: 264, y: 206 };            // the oggle the bullets just blew up
const RING = { x: 305, y: 194 };             // the green ring on its way to Ines
const TUG = { x: 242, y: 88, beam: 157 };    // the eye saucer and the cow in its beam
const CRANE = { x: 432, claw: 64 };
const POD_X = 444;

// ------------------------------------------------------------ noise, colour and dither helpers
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
const NZT = (() => { const r = rng(505001), a = new Float32Array(65536); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
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
// a smooth curve through four control points (cubic Bezier) as a point list
function bez([a, b2, c, d], n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * a[0] + 3 * u * u * t * b2[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b2[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  return out;
}
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
function glyph(b, g, x, y, c) { GLY[g % GLY.length].forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') put(b, x + i, y + j, c); }); }

// =====================================================================================================================
// Space, the Moon and the Earth (behind the bay mouth)
// =====================================================================================================================
function paintSpace() {
  const b = buf(520, 212, 20, 0);
  const NEB = [SP[0], SP[0], SP[1], SP[2], SP[3], I('#2b1c58')];
  for (let y = 0; y < 212; y++) for (let x = -20; x < 500; x++) {
    const n = fbm(x / 80, y / 50, 3, 4), m = fbm(x / 34 + 9, y / 26 + 4, 7, 3);
    put(b, x, y, ramp(NEB, clamp((n - 0.36) * 2.4, 0, 1) * (0.5 + 0.6 * m), x, y));
  }
  const r = rng(5051);
  for (let i = 0; i < 270; i++) {
    const x = Math.floor(-20 + r() * 520), y = Math.floor(r() * 210), k = r(), tint = r(), d3 = Math.floor(r() * 3);
    const hi = I(tint < 0.6 ? '#e6ecff' : tint < 0.75 ? '#bff3ff' : tint < 0.88 ? '#ffd0e8' : '#fff0c0');
    if (k < 0.58) put(b, x, y, I(['#3c3f78', '#565a96', '#7479b4'][d3]));
    else if (k < 0.9) put(b, x, y, hi);
    else if (k < 0.975) { put(b, x, y, WHITE); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(b, x + dx, y + dy, mixI(hi, SP[2], 0.5)); }
    else { put(b, x, y, WHITE); for (let d = 1; d <= 2; d++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(b, x + dx * d, y + dy * d, d === 1 ? hi : mixI(hi, SP[2], 0.62)); }
  }
  // the Moon, small and far
  shape(b, MOON.x - 7, MOON.y - 7, MOON.x + 7, MOON.y + 7, (x, y) => (x - MOON.x) ** 2 + (y - MOON.y) ** 2 <= 5.7 ** 2, (x, y) => {
    const l = ((x - MOON.x) * -0.38 + (y - MOON.y) * -0.8) / 5.7;
    return l > 0.4 ? I('#f2f4fa') : l > -0.05 ? I('#c6ccdc') : l > -0.4 ? I('#7c84a4') : I('#2a2e52');
  });
  put(b, MOON.x - 2, MOON.y - 2, I('#aab1c8')); put(b, MOON.x + 1, MOON.y - 1, I('#aab1c8')); put(b, MOON.x - 1, MOON.y + 1, I('#9aa2bc'));
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
    if (M5.px.inPoly(q.p, lon, lat)) return true;
  }
  return false;
}
function paintEarth() {
  const R = EARTH.r, N = 2 * R + 8, b = buf(N, N, R + 4, R + 4);
  const D = Math.PI / 180, lat0 = 24 * D, lon0 = -14, tilt = -0.2;
  const LS = [-0.38, -0.80, 0.46];                                   // the sun: up and a little left, in front
  const ct = Math.cos(tilt), st = Math.sin(tilt), c0 = Math.cos(lat0), s0 = Math.sin(lat0);
  const OCEAN = [I('#0f347f'), I('#1549a4'), I('#1d62c6'), I('#2e83e2'), I('#52a5f0')];
  const SAND = [I('#8f6c42'), I('#bb9257'), I('#dcb877'), I('#f0d79c')];
  const SOIL = [I('#4f4034'), I('#6e5a42'), I('#8c7350'), I('#a88c60')];
  const ICE = [I('#7f93c9'), I('#b9c9ec'), I('#e3ecfb'), I('#ffffff')];
  const CLOUD = [I('#8195cf'), I('#b7c8ee'), I('#e6eefc'), I('#ffffff')];
  const NIGHT_O = I('#080d28'), NIGHT_L = I('#0d1230'), NIGHT_C = I('#151d44'), DUSK_C = I('#d98fb4');
  const ATM = [I('#bfe6ff'), I('#6fb4f5'), I('#2c4f9f')];
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
      if (d <= R + 1) put(b, px, py, L > 0.2 ? ATM[0] : L > -0.1 ? ATM[1] : L > -0.3 ? ATM[2] : I('#161f4e'));
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
      if (land && !desert && !ice && !isCloud && !(px < 4 && py > 26) && nz(px * 3 + 7, py * 5 + 1) > 0.95) c = nz(px + 31, py + 17) > 0.7 ? I('#e0a84a') : I('#8a6226');
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
        const q = (L - 0.02) / 0.18;
        if (q < dth(px, py)) c = isCloud ? NIGHT_C : land ? NIGHT_L : NIGHT_O;
        else c = isCloud ? mixI(c, DUSK_C, 0.55) : mixI(c, I('#1a2468'), 0.45);
      }
      if (d > R - 1.6 && L > 0.1) c = mixI(c, ATM[0], 0.55);         // air along the lit limb
      else if (d > R - 3.2 && L > 0.1 && ((px + py) & 1)) c = mixI(c, ATM[1], 0.5);
    }
    put(b, px, py, c);
  }
  return b;
}

// =====================================================================================================================
// The back wall of the hangar with the bay mouth
// =====================================================================================================================
const inOpen = (x, y) => x >= OPEN.x0 && x < OPEN.x1 && y >= OPEN.y0 && y < OPEN.y1 && (x - OPEN.x0) + (y - OPEN.y0) >= OPEN.ch && (OPEN.x1 - 1 - x) + (y - OPEN.y0) >= OPEN.ch;
function frameDist(x, y) {                   // 0 = in the mouth, 1..6 = on its steel frame, 9 = plain wall
  if (inOpen(x, y)) return 0;
  if (x < OPEN.x0 - 7 || x > OPEN.x1 + 6 || y < OPEN.y0 - 7) return 9;
  for (let d = 1; d <= 6; d++) if (inOpen(x + d, y) || inOpen(x - d, y) || inOpen(x, y + d) || inOpen(x + d, y + d) || inOpen(x - d, y + d)) return d;
  return 9;
}
const tooth = y => { const k = ((y - OPEN.y0) % 22 + 22) % 22; return k < 11 ? Math.floor(k / 2.2) : Math.floor((22 - k) / 2.2); };
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
function rib(b, x, y0, y1) {
  const cols = [S[0], S[4], S[3], S[3], S[3], S[2], S[2], S[1], S[0]];
  for (let y = y0; y < y1; y++) for (let i = 0; i < 9; i++) put(b, x + i, y, cols[i]);
  for (let y = y0 + 6; y < y1 - 3; y += 16) { put(b, x + 3, y, S[6]); put(b, x + 4, y, S[5]); put(b, x + 3, y + 1, S[1]); put(b, x + 4, y + 1, S[1]); }
}
function paintWall() {
  const b = buf(520, BACK, 20, 0);
  const WALL = [S[1], I('#1b1a38'), S[2], I('#282a52')], CEIL = [S[0], S[1], I('#1b1a38')];
  const FD = new Int8Array(520 * BACK), fdAt = (x, y) => FD[y * 520 + x + 20];
  for (let y = 0; y < BACK; y++) for (let x = -20; x < 500; x++) {
    const d = frameDist(x, y); FD[y * 520 + x + 20] = d;
    if (d === 0) continue;
    put(b, x, y, y < CEILY
      ? ramp(CEIL, 0.2 + 0.6 * y / CEILY + 0.5 * (fbm(x / 34, y / 10, 17, 2) - 0.5), x, y)
      : ramp(WALL, 0.86 - 0.6 * ss(CEILY, BACK, y) + 0.36 * (fbm(x / 44, y / 44, 23, 2) - 0.5), x, y));
  }
  const wall = (x, y) => y >= 0 && y < BACK && x >= -20 && x < 500 && fdAt(x, y) === 9;
  const wput = (x, y, c) => { if (wall(x, y)) put(b, x, y, c); };
  // ---- panels: 1px dark seams, a lighter top edge, a rivet in each corner
  const VS = [46, 147, 484], HS = [64, 112, 164];
  for (const x of VS) for (let y = 64; y < 197; y++) { wput(x, y, S[0]); wput(x + 1, y, y % 2 ? S[3] : I('#282a52')); }
  for (const y of HS) for (let x = -20; x < 500; x++) { wput(x, y - 1, S[0]); wput(x, y, S[3]); }
  for (const y of HS) for (const x of [4, 42, 50, 88, 104, 143, 151, 190, 480, 488]) { wput(x, y + 4, S[4]); wput(x + 1, y + 5, S[0]); }
  // ---- bulkhead ribs
  rib(b, -9, CEILY, 197); rib(b, 92, CEILY, 197); rib(b, 474, CEILY, 197);
  // ---- ceiling: girder edge, pipes with clamps, a lintel plate over the mouth
  for (let x = -20; x < 500; x++) { wput(x, CEILY - 2, S[3]); wput(x, CEILY - 1, S[0]); wput(x, 33, S[2]); }
  for (const [py, cs] of [[42, [S[3], S[2], S[2], S[0]]], [50, [S[2], S[2], S[0]]]]) for (let x = -20; x < 194; x++) cs.forEach((c, i) => wput(x, py + i, (x + 14) % 44 < 3 ? (i ? S[1] : S[4]) : c));
  for (let x = 196; x < 474; x++) { wput(x, 36, S[3]); if ((x - 196) % 67 === 0) for (let y = 37; y < 52; y++) wput(x, y, S[0]); if ((x - 190) % 12 === 0) { wput(x, 39, S[3]); wput(x, 40, S[0]); } }
  // ---- the steel frame of the bay mouth
  for (let y = 0; y < BACK; y++) for (let x = -20; x < 500; x++) {
    const d = fdAt(x, y);
    if (d < 1 || d > 6) continue;
    const top = y < OPEN.y0 + OPEN.ch && !(x < OPEN.x0 || x >= OPEN.x1), left = x < OPEN.x0;
    let c = d === 1 ? S[0] : d === 6 ? S[0] : top ? [S[4], S[3], S[3], S[2]][d - 2] : left ? [S[6], S[5], S[4], S[3]][d - 2] : [S[5], S[4], S[3], S[2]][d - 2];
    if ((d === 3 || d === 4) && ((x + y * 3) % 12 + 12) % 12 === 0) c = d === 3 ? S[7] : S[1];
    put(b, x, y, c);
  }
  // force-field emitters along the top of the mouth
  for (let x = OPEN.x0 + 24; x < OPEN.x1 - 24; x += 20) { rect(b, x, OPEN.y0 - 2, 5, 1, S[0]); rect(b, x + 1, OPEN.y0 - 1, 3, 1, CYAN); put(b, x + 2, OPEN.y0 - 1, CYANL); }
  // ---- the bay door, slid open into the wall: its toothed, hazard-striped edges show on both sides
  for (let y = OPEN.y0; y < BACK; y++) {
    const w = 9 + tooth(y);
    for (let i = 0; i <= w; i++) for (const side of [0, 1]) {
      const x = side ? OPEN.x1 - 1 - i : OPEN.x0 + i;
      if (!inOpen(x, y)) continue;
      put(b, x, y, i === w ? S[0] : i === w - 1 ? (hazard(x, y, 10) ? AMBL : S[4]) : hazard(x, y, 10) ? (side ? AMBD : AMB) : HZ);
    }
  }
  // ---- light strips: cyan high
  for (let x = 4; x < 190; x++) { const on = (x - 4) % 26 < 22; wput(x, 66, S[0]); wput(x, 67, on ? CYANL : S[1]); wput(x, 68, on ? CYAN : S[1]); wput(x, 69, S[0]); }
  // ---- baseboard with the magenta guide strip (low)
  for (let x = -20; x < 500; x++) for (let y = 197; y < BACK; y++) wput(x, y, y === 197 ? S[4] : y === 198 ? S[3] : y === 205 ? S[0] : ramp([S[2], S[3]], 0.5, x, y));
  for (let x = -20; x < 500; x++) if ((x + 20) % 24 < 9) { wput(x, 201, I('#5a2f66')); wput(x, 202, I('#3a2450')); }
  // ---- slack cables hanging under the ceiling girder (left bay)
  for (const [xa, xb, sag, c] of [[-2, 92, 16, I('#3d4f8a')], [-12, 70, 9, I('#6a3a78')]]) {
    for (let x = xa; x <= xb; x++) { const u = (x - xa) / (xb - xa), y = Math.round(CEILY + 1 + sag * 4 * u * (1 - u)); wput(x, y, c); wput(x, y + 1, S[0]); }
  }
  // ---- porthole, conduit, hose reel, sign plaque, the plan screen, the way-on sign
  for (let y = 70; y < 172; y++) { wput(15, y, S[0]); wput(16, y, S[4]); wput(17, y, S[3]); wput(18, y, S[1]); if (y % 20 === 8) for (let i = 14; i < 20; i++) wput(i, y, i === 14 ? S[0] : S[4]); }
  porthole(b, 40, 100, 13);
  // hose reel: an orange fuel hose wound on a drum, the nozzle hanging down
  const HOSE = [I('#7d3f22'), I('#c9702e'), I('#eb9a4e')];
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
    rect(b, X - 3, Y - 3, 48, 32, S[0]); rect(b, X - 2, Y - 2, 46, 30, S[4]); rect(b, X - 2, Y - 2, 46, 1, S[6]); rect(b, X - 2, Y + 27, 46, 1, S[2]); rect(b, X + 42, Y - 1, 2, 28, S[3]);
    for (let y = 0; y < 26; y++) for (let x = 0; x < 42; x++) put2(x, y, y % 2 ? I('#0a2238') : I('#071a2c'));
    shape(b, X + 2, Y + 10, X + 14, Y + 22, (x, y) => { const d = Math.hypot(x - X - 8, y - Y - 16); return d <= 5.6; }, (x, y) => Math.hypot(x - X - 8, y - Y - 16) > 4.4 ? CYAN : nz(Math.floor(x) * 5, Math.floor(y) * 3) > 0.62 ? CD : I('#0d3350'));
    for (const x of [16, 18, 20]) put2(x, 16, CYAN); put2(21, 15, CYAN); put2(21, 17, CYAN); put2(22, 16, CYANL);
    ['.#.....#...', '.########.#', '##########.', '.########..', '.#.#..#.#..'].forEach((row, j) => { for (let i = 0; i < 11; i++) if (row[i] === '#') put2(26 + i, 14 + j, CYANL); });
    for (let y = 7; y < 13; y += 2) { put2(28 + Math.floor((12 - y) / 3), y, CD); put2(35 - Math.floor((12 - y) / 3), y, CD); }
    ['....###....', '..#######..', '###########', '..##...##..'].forEach((row, j) => { for (let i = 0; i < 11; i++) if (row[i] === '#') put2(26 + i, 2 + j, j === 2 ? CYANL : CYAN); });
    for (let i = 0; i < 5; i++) put2(3 + i, 3 + (i === 0 || i === 4 ? 1 : 0), GR[4]); for (let i = 1; i < 4; i++) put2(3 + i, 5, GR[4]); put2(5, 4, GR[6]);
    rect(b, X + 18, Y + 28, 6, 2, S[2]);
  }
  // the way on: amber chevrons
  rect(b, 138, 170, 42, 15, S[4]); rect(b, 139, 171, 40, 13, S[0]); rect(b, 138, 185, 42, 1, S[0]);
  for (let i = 0; i < 3; i++) for (let k = 0; k < 5; k++) for (const yy of [173 + k, 181 - k]) { put(b, 145 + i * 11 + k, yy, i === 2 ? AMBL : AMB); put(b, 146 + i * 11 + k, yy, i === 2 ? AMB : AMBD); }
  // vent slats low on the left
  rect(b, 100, 174, 30, 14, S[0]); for (let y = 175; y < 187; y += 3) { rect(b, 101, y, 28, 1, S[4]); rect(b, 101, y + 1, 28, 1, S[2]); }
  return b;
}

// =====================================================================================================================
// The hangar floor between the wall and the deck edge (seen a little from above), with the landing pads
// =====================================================================================================================
const PADS = [[22, 221, 28, 6.5, 0], [78, 221, 28, 6.5, 3], [300, 219, 44, 8, 5]];
const LAMPS = [22, 78, 134];                 // work lamps under the catwalk (the first two shine on the parked saucers)
function paintFloor() {
  const b = buf(520, DECK - BACK, 20, -BACK);
  const VPX = 250, VPY = 150, FL = [S[1], S[2], I('#282a52'), S[3]];
  for (let y = BACK; y < DECK; y++) for (let x = -20; x < 500; x++) {
    const k = (y - BACK) / (DECK - BACK);
    let c = ramp(FL, 0.22 + 0.55 * k + 0.25 * (fbm(x / 26, y / 5, 31, 2) - 0.5), x, y);
    const m = Math.min(x - (OPEN.x0 + 12), OPEN.x1 - 12 - x);          // Earth-light spilling in through the mouth
    if (m > 0 && dth(x, y) < (0.62 - k * 1.5) * Math.min(1, m / 30)) c = I('#33488a');
    put(b, x, y, c);
  }
  for (let i = -14; i <= 14; i++) {
    const xf = VPX + i * 46 + 12;
    for (let y = BACK + 1; y < DECK; y++) put(b, Math.round(VPX + (xf - VPX) * (y - VPY) / (DECK - VPY)), y, S[0]);
  }
  for (let x = -20; x < 500; x++) { put(b, x, 212, S[0]); put(b, x, 213, x % 3 ? S[3] : I('#282a52')); put(b, x, 221, S[0]); }
  // the lip of the bay mouth: a hazard-striped threshold with the field emitter rail
  for (let x = OPEN.x0 + 10; x < OPEN.x1 - 10; x++) {
    put(b, x, BACK, (x % 12) < 5 ? CYAN : S[0]); put(b, x, BACK + 1, S[5]);
    for (let y = BACK + 2; y < BACK + 5; y++) put(b, x, y, hazard(x, y * 1, 8) ? AMBD : HZ);
    put(b, x, BACK + 5, S[0]);
  }
  // landing pads: an amber-and-black ring, a dark plate, a glyph
  for (const [cx, cy, rx, ry] of PADS) {
    shape(b, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 2, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy - 1) / ry) ** 2 <= 1, S[0]);
    shape(b, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, (x, y) => {
      const u = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (u > 0.5) { const a = Math.atan2((y - cy) / ry, (x - cx) / rx); return Math.floor((a / Math.PI + 1) * 9 + 0.5) % 2 ? (y < cy ? AMBD : AMB) : HZ; }
      if (u > 0.4) return S[0];
      return u > 0.14 && u < 0.24 ? I('#2f7f9f') : ramp([S[1], S[2]], 0.5, x, y);
    });
    rect(b, cx - 2, cy, 4, 1, I('#3fa8c8'));
  }
  return b;
}

// =====================================================================================================================
// Behind the play line: parked mini saucers on their pads, fuel hoses, a stack of cargo
// =====================================================================================================================
const SSTR = PAL.S;
const DOME = [I('#16385e'), I('#1f5d8c'), I('#2f8fbf'), I('#8fe0f5')];
function saucer(b, cx, by) {
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
function paintRear() {
  const b = buf(520, 110, 20, -130);
  const HOSE = [I('#7d3f22'), I('#c9702e'), I('#eb9a4e')];
  // the fuel valve on the wall between the two pads, a hose to each saucer
  hose(b, bez([[50, 182], [50, 208], [40, 218], [31, 211]], 46), HOSE);
  hose(b, bez([[51, 182], [52, 210], [62, 219], [69, 211]], 46), HOSE);
  shape(b, 44, 172, 58, 186, (x, y) => (x - 50.5) ** 2 + (y - 179) ** 2 <= 36, (x, y) => { const d = Math.hypot(x - 50.5, y - 179); return d > 4.6 ? S[5] : d > 3 ? AMBD : d > 1.6 ? S[1] : AMB; });
  saucer(b, 22, 221); saucer(b, 78, 221);
  outline(b, S[0]);
  haze(b, S[2], 0.12, S[0]);
  return b;
}

// =====================================================================================================================
// The play layer: the deck edge, the catwalk, cargo crates, the ceiling crane (1px OUT outlines)
// =====================================================================================================================
function paintDeck() {
  const b = buf(520, H - DECK, 20, -DECK);
  const FACE = [S[0], S[1], I('#1b1a38'), S[2]];
  for (let x = -20; x < 500; x++) {
    put(b, x, DECK, S[7]); put(b, x, DECK + 1, S[6]); put(b, x, DECK + 2, S[5]); put(b, x, DECK + 3, S[5]); put(b, x, DECK + 4, S[4]); put(b, x, DECK + 5, S[0]);
    for (let y = DECK + 6; y < H; y++) put(b, x, y, ramp(FACE, 0.95 - (y - DECK - 6) / 34 + 0.2 * (fbm(x / 30, y / 9, 71, 2) - 0.5), x, y));
  }
  for (let x = -12; x < 500; x += 20) { put(b, x, DECK + 3, S[7]); put(b, x + 1, DECK + 3, S[2]); }
  // panels with seams, vents in every other one
  for (let x = -16, i = 0; x < 500; x += 44, i++) {
    for (let y = DECK + 6; y < H; y++) { put(b, x, y, S[0]); put(b, x + 1, y, y % 2 ? S[3] : S[2]); }
    if (i % 2) for (let y = DECK + 22; y < DECK + 33; y += 3) { rect(b, x + 8, y, 28, 1, S[0]); rect(b, x + 8, y + 1, 28, 1, S[3]); }
    else { rect(b, x + 16, DECK + 24, 13, 9, S[0]); glyph(b, i + 2, x + 20, DECK + 25, I('#2f7f9f')); }
  }
  // the magenta guide strip in its channel
  for (let x = -20; x < 500; x++) {
    put(b, x, DECK + 10, S[0]); put(b, x, DECK + 15, S[3]);
    const on = (x + 20) % 16 < 11;
    put(b, x, DECK + 11, on ? MAGL : S[0]); put(b, x, DECK + 12, on ? MAG : S[0]); put(b, x, DECK + 13, on ? MAG : S[0]); put(b, x, DECK + 14, on ? I('#a82f6c') : S[0]);
  }
  return b;
}
function paintCrate(w, h, g, band) {
  const b = buf(w + 2, h + 2, 1, 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = y === 0 ? S[7] : y < 3 ? S[6] : y === 3 ? S[2] : y >= h - 3 ? S[3] : S[5];
    if (y > 3 && y < h - 3) c = x < 2 ? S[6] : x >= w - 3 ? S[4] : ramp([S[4], S[5]], 0.75 - (y - 4) / (h - 7) * 0.6, x, y);
    put(b, x, y, c);
  }
  rect(b, 0, h - 1, w, 1, S[2]);
  // amber corner brackets
  for (const [cx, cy, sx, sy] of [[0, 4, 1, 1], [w - 1, 4, -1, 1], [0, h - 4, 1, -1], [w - 1, h - 4, -1, -1]]) for (let k = 0; k < 4; k++) { put(b, cx + sx * k, cy, k ? AMB : AMBL); put(b, cx, cy + sy * k, AMB); put(b, cx + sx * k, cy + sy, AMBD); }
  // glyph plaque and grip slots
  const px = Math.floor(w / 2) - 5, py = Math.floor(h / 2) - 4;
  rect(b, px, py, 11, 11, S[1]); rect(b, px, py, 11, 1, S[0]); glyph(b, g, px + 3, py + 2, CYAN); put(b, px + 5, py + 4, CYANL);
  rect(b, 4, py + 2, 1, 6, S[2]); rect(b, w - 5, py + 2, 1, 6, S[2]);
  if (band) { rect(b, 0, h - 7, w, 2, band); rect(b, px, h - 7, 11, 2, S[1]); }
  outline(b);
  return b;
}
function paintCatwalk() {
  const w = CAT.w, b = buf(w + 2, 150, 1, 130);
  // the walkway: bright top edge, a grating, brackets under it, a hazard-striped end
  for (let x = 0; x < w; x++) {
    put(b, x, 0, S[7]); put(b, x, 1, S[6]); put(b, x, 2, S[5]); put(b, x, 3, x % 4 < 2 ? S[2] : S[5]); put(b, x, 4, S[4]); put(b, x, 5, S[2]);
  }
  for (let x = w - 12; x < w; x++) for (let y = 1; y < 5; y++) put(b, x, y, hazard(x, y, 6) ? AMB : HZ);
  for (let x = 0; x < w; x++) { put(b, x, 11, S[5]); put(b, x, 12, S[3]); }          // the truss's lower chord
  for (let x = 0; x < w; x += 12) rect(b, x, 6, 2, 5, S[4]);                         // its posts
  outline(b);
  for (let x = 2; x < w - 10; x += 12) for (let k = 0; k < 5; k++) put(b, x + 1 + (Math.floor(x / 12) % 2 ? k * 2 : 9 - k * 2), 6 + k, S[3]);   // diagonals (thin)
  // hanger rods up to the ceiling girder and the railing (thin, no outline)
  for (const hx of [44, 117, 213]) { for (let y = -97; y < -13; y++) { put(b, hx, y, S[5]); put(b, hx + 1, y, S[2]); } rect(b, hx - 2, -98, 6, 3, S[4]); rect(b, hx - 2, -98, 6, 1, S[6]); rect(b, hx - 1, -40, 4, 2, S[4]); }
  for (let x = 0; x < w; x++) { put(b, x, -13, S[6]); put(b, x, -12, S[3]); if (x % 2) put(b, x, -7, S[4]); }
  for (let x = 4; x < w; x += 20) for (let y = -11; y < 0; y++) { put(b, x, y, S[6]); put(b, x + 1, y, S[3]); }
  for (let y = -13; y < 0; y++) { put(b, w - 2, y, S[6]); put(b, w - 1, y, S[3]); }
  return b;
}
function paintCrane() {
  const b = buf(520, 90, 20, -30), cx = CRANE.x, cy = CRANE.claw;
  // the rail along the ceiling
  for (let x = -20; x < 500; x++) { put(b, x, 33, S[6]); put(b, x, 34, S[4]); put(b, x, 35, S[4]); put(b, x, 36, S[2]); put(b, x, 37, x % 4 < 2 ? S[1] : S[3]); }
  // trolley
  rect(b, cx - 13, 38, 26, 9, S[4]); rect(b, cx - 13, 38, 26, 1, S[6]); rect(b, cx - 13, 46, 26, 1, S[2]);
  for (let x = cx - 13; x < cx + 13; x++) for (let y = 42; y < 45; y++) put(b, x, y, hazard(x, y, 6) ? AMB : HZ);
  rect(b, cx - 10, 36, 4, 3, S[2]); rect(b, cx + 6, 36, 4, 3, S[2]);
  // cables, claw head, two hooked fingers round the crate
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

// front corners: dark kit at the very bottom, in front of the deck (rim-lit by the magenta strip)
function paintFront() {
  const b = buf(520, 44, 20, -(H - 40));
  const D0 = I('#0a0916'), D1 = I('#131127'), D2 = I('#1e1a3c'), RIM = I('#5a3a7e'), RIMM = I('#a8407e');
  // left: a fuel drum, a coil of hose with its nozzle
  shape(b, -8, 238, 26, 272, (x, y) => x < 24 && y > 242, (x, y) => x > 22 ? RIM : x > 18 ? D2 : (Math.floor(y) === 251 || Math.floor(y) === 262) ? D2 : x < 2 ? D0 : D1);
  shape(b, -8, 238, 26, 246, (x, y) => ((x - 7) / 17) ** 2 + ((y - 242.5) / 3.6) ** 2 <= 1, (x, y) => { const u = ((x - 7) / 17) ** 2 + ((y - 242.5) / 3.6) ** 2; return u > 0.62 && y < 242.5 ? RIM : D2; });
  rect(b, 9, 241, 5, 2, D0); rect(b, 9, 241, 5, 1, RIM); put(b, 20, 240, RIMM); put(b, 21, 241, RIMM);
  for (let x = -6; x < 19; x++) for (let y = 254; y < 259; y++) put(b, x, y, hazard(x, y, 6) ? I('#7a5e16') : D0);
  for (let k = 0; k < 3; k++) {
    const rx = 20 - k * 5.5, ry = 8.5 - k * 2.4;
    shape(b, 30, 248, 78, 272, (x, y) => { const u = ((x - 53) / rx) ** 2 + ((y - 264) / ry) ** 2; return u <= 1 && u > (k === 2 ? 0.15 : 0.48); }, (x, y) => y < 264 - ry * 0.7 ? RIM : k % 2 ? D2 : D1);
  }
  rect(b, 70, 257, 8, 4, D2); rect(b, 70, 257, 8, 1, RIM); rect(b, 78, 258, 3, 2, RIM);
  // right: a warning post with a hazard band, its lamp (live), a cable
  rect(b, 461, 244, 13, 28, D1); rect(b, 461, 244, 13, 1, RIM); rect(b, 461, 245, 1, 27, RIM); rect(b, 472, 245, 2, 27, D0); rect(b, 458, 265, 19, 7, D2); rect(b, 458, 265, 19, 1, RIM);
  for (let x = 461; x < 474; x++) for (let y = 251; y < 257; y++) put(b, x, y, hazard(x, y, 6) ? I('#b08a1c') : D0);
  rect(b, 464, 240, 7, 4, I('#6a4e10'));
  for (const [x, y] of bez([[380, 272], [404, 256], [432, 271], [458, 262]], 80)) { rect(b, Math.round(x), Math.round(y), 2, 2, D1); put(b, Math.round(x), Math.round(y), (Math.round(x) & 3) ? D2 : RIM); }
  return b;
}

// =====================================================================================================================
// Building (once, on the first draw) and the frame's live bits
// =====================================================================================================================
let LAY = null;
function build() {
  if (LAY) return LAY;
  LAY = {
    space: mk(paintSpace()), earth: mk(paintEarth()), wall: mk(paintWall()), floor: mk(paintFloor()), rear: mk(paintRear()),
    deck: mk(paintDeck()), cat: mk(paintCatwalk()), crate: mk(paintCrate(28, 26, 0, MAG)), hung: mk(paintCrate(22, 18, 4)), box1: mk(paintCrate(20, 17, 3, AMBD)), box2: mk(paintCrate(16, 13, 5)), crane: mk(paintCrane()),
    front: mk(paintFront())
  };
  burstSprites();
  return LAY;
}
const strip = (s, cx, p) => ctx.drawImage(s.img, Math.round(-s.ox - (cx - CAM) * p), -s.oy);
const world = s => ctx.drawImage(s.img, CAM - s.ox, -s.oy);
const blink = (n, ph = 0) => Math.floor((G.t + ph) / n) % 2 === 0;

// the force field across the bay mouth (screen space, behind the wall): a faint veil, slanted sheen, drifting glints
function field(ox) {
  const x0 = OPEN.x0 + ox, x1 = OPEN.x1 + ox, y0 = OPEN.y0, y1 = BACK, t = G.t;
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  ctx.fillStyle = 'rgba(79,227,255,0.03)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (const [off, w, a] of [[250, 18, 0.085], [276, 5, 0.11]]) {
    const bx = x0 + ((off + t * 0.2) % (x1 - x0 + 120)) - 90;
    ctx.fillStyle = 'rgba(200,247,255,' + a + ')';
    for (let y = y0; y < y1; y += 2) ctx.fillRect(Math.round(bx + (y1 - y) * 0.5), y, w, 2);
  }
  for (let i = 0; i < 26; i++) {
    const x = x0 + 16 + Math.floor(hsh(i * 3.7) * (x1 - x0 - 44)), y = y1 - 4 - ((t * (0.12 + hsh(i * 1.9) * 0.2) + hsh(i * 7.1) * 150) % (y1 - y0 - 8)), w = 3 + Math.floor(hsh(i * 5.3) * 6);
    ctx.fillStyle = 'rgba(200,247,255,' + (0.14 + 0.2 * hsh(i * 9.7)).toFixed(3) + ')'; ctx.fillRect(x, Math.round(y), w, 1);
  }
  // the field is brightest where it meets the frame: stepped cyan bands along the door edges, the top and the lip
  for (let d = 0; d < 6; d++) {
    ctx.fillStyle = 'rgba(79,227,255,' + (0.30 - d * 0.05).toFixed(3) + ')';
    ctx.fillRect(x0 + 14 + d, y0, 1, y1 - y0); ctx.fillRect(x1 - 15 - d, y0, 1, y1 - y0);
    ctx.fillRect(x0 + 20, y0 + d, x1 - x0 - 40, 1); ctx.fillRect(x0 + 20, y1 - 1 - d, x1 - x0 - 40, 1);
  }
  for (let y = y0 + 12; y < y1 - 2; y++) {
    const on = ((y + Math.floor(t / 3)) % 14) < 8;
    ctx.fillStyle = on ? 'rgba(200,247,255,0.75)' : 'rgba(79,227,255,0.28)';
    ctx.fillRect(x0 + 14, y, 1, 1); ctx.fillRect(x1 - 15, y, 1, 1);
  }
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
  ctx.restore();
}

// ---- the oggle that just blew up: its parts, baked once
let PARTS = null;
function burstSprites() {
  const BEZ = [METDD, METD, MET, METL, '#ffffff'];
  // the eye, popped out on its spring
  const eye = buf(19, 19, 9, 9);
  ball(eye, 0, 0, 7.4, 7.4, BEZ); oval(eye, 0, 0, 5.2, 5.2, I(PAL.EYEW));
  shape(eye, -6, -6, 6, 6, (x, y) => x * x + y * y <= 5.2 * 5.2 && x * -0.35 + y * 0.94 > 2.8, I(PAL.EYES));
  rect(eye, 0, -4, 3, 5, I(PAL.IRIS)); rect(eye, -1, -3, 5, 3, I(PAL.IRIS)); rect(eye, 1, -3, 1, 3, I(PAL.PUP)); rect(eye, 0, -2, 3, 1, I(PAL.PUP)); put(eye, 0, -3, WHITE);
  outline(eye);
  const spring = buf(9, 12, 4, 0);
  for (let k = 0; k < 10; k++) { const x = [0, 1, 2, 1, 0, -1, -2, -1][k % 8]; put(spring, x, k, I(k % 2 ? METL : MET)); put(spring, x + 1, k, I(METD)); }
  outline(spring);
  // the green egg shell, cracked into pieces (the kit's body shading, cut along zig-zag cracks)
  const GB = [PAL.G[1], PAL.G[2], PAL.G[3], PAL.G[4], PAL.G[5]];
  const jag = x => [0, -1, -2, -1, 0, 1, 2, 1][((Math.floor(x) + 40) % 8)];
  // the lower half, still standing on its boots (it was facing left)
  const low = buf(28, 18, 14, 16);
  for (const bx of [-8, 2]) { rect(low, bx, -4, 6, 4, I(METD)); rect(low, bx, -4, 6, 1, I(MET)); rect(low, bx + 2, -6, 3, 2, GR[1]); }
  ball(low, 0, -15, 10.2, 11, GB, (x, y) => y > -11.5 + jag(x));
  for (let x = -11; x <= 11; x++) { if (get(low, x, -8) !== NONE) put(low, x, -8, I(x < -3 ? METL : MET)); if (get(low, x, -7) !== NONE) put(low, x, -7, I(METD)); }
  put(low, -5, -8, AMBL); put(low, -6, -8, AMB); put(low, -5, -7, AMB); put(low, -6, -7, AMBD);
  outline(low);
  // the top of the shell: the empty eye socket, antenna and lamp still on it
  const cap = buf(26, 24, 13, 21);
  ball(cap, 0, 0, 10.2, 11, GB, (x, y) => y < -0.5 + jag(x + 3) * 0.5);
  shape(cap, -9, -10, 5, 2, (x, y) => (x + 2) ** 2 + (y + 3) ** 2 <= 6.4 ** 2 && get(cap, x, y) !== NONE, (x, y) => (x + 2) ** 2 + (y + 3) ** 2 > 4.9 ** 2 ? I(METD) : GR[0]);
  put(cap, 6, -6, GR[5]); put(cap, 7, -3, GR[5]);
  rect(cap, 4, -14, 1, 4, OUTI); rect(cap, 5, -16, 1, 3, OUTI); rect(cap, 4, -19, 3, 3, AMB); put(cap, 4, -19, AMBL);
  outline(cap);
  // the back tank, rolling away
  const tank = buf(15, 9, 7, 4);
  rect(tank, -5, -2, 11, 5, I(METD)); rect(tank, -5, -2, 11, 1, I(METL)); rect(tank, -5, 2, 11, 1, I(METDD)); rect(tank, 0, -2, 1, 5, I(METDD)); rect(tank, -7, -1, 2, 3, I(MET)); rect(tank, 6, -1, 1, 3, I(METDD));
  outline(tank);
  const gun = buf(19, 9, 9, 4);                                      // its ray gun, flung toward the hero (muzzle first)
  rect(gun, 1, -2, 7, 5, I('#c9d2e0')); rect(gun, 1, -2, 7, 1, WHITE); rect(gun, 1, 2, 7, 1, I('#8794a8')); rect(gun, 5, 3, 2, 2, I(METD));
  rect(gun, 0, -1, 1, 3, MAG); rect(gun, -2, 0, 2, 1, I('#c9d2e0')); rect(gun, -3, -1, 1, 3, MAG); rect(gun, -6, -1, 2, 3, I(PAL.BEAM));
  outline(gun);
  const bolt = buf(5, 5, 2, 2); rect(bolt, -1, -1, 3, 3, I('#8a97a8')); put(bolt, -1, -1, I('#c3cdd8')); put(bolt, 0, 0, I('#3b424d')); outline(bolt);
  PARTS = { eye: mk(eye), spring: mk(spring), low: mk(low), cap: mk(cap), tank: mk(tank), gun: mk(gun), bolt: mk(bolt) };
}
function frameFx() {
  build();
  const bx = WX(BURST.x), by = BURST.y, out = [];
  const part = (dx, dy, s) => out.push({ type: 'sprite', x: bx + dx - s.ox + Math.floor(s.w / 2), y: by + dy - s.oy + Math.floor(s.h / 2), vx: 0, vy: 0, rot: 0, s, life: 40, max: 40 });
  part(0, DECK - by, PARTS.low);                                     // the lower half still stands there (the fire hides its top)
  for (const [dx, dy, s, life] of [[-13, -15, 9, 20], [10, -19, 8, 16], [-2, -25, 7, 12]]) out.push({ type: 'smoke', x: bx + dx, y: by + dy, vx: 0, vy: 0, life, max: 30, size: s });
  out.push({ type: 'flash', x: bx, y: by - 2, life: 3, max: 5, size: 16 });
  for (const [dx, dy, s, life] of [[0, -2, 11, 30], [-8, 2, 7, 25], [8, -6, 7.5, 23], [-3, -11, 6.5, 19], [9, 4, 5.5, 15], [-10, -8, 5, 13]]) out.push({ type: 'fire', x: bx + dx, y: by + dy, vx: 0, vy: 0, life, max: 34, size: s });
  part(-23, -13, PARTS.cap); part(18, -24, PARTS.eye); part(16, -16, PARTS.spring); part(24, 22, PARTS.tank); part(-33, 10, PARTS.gun);
  part(-31, -27, PARTS.bolt); part(-19, 22, PARTS.bolt); part(4, -27, PARTS.bolt);
  for (const [dx, dy] of [[-12, -20], [14, -10], [19, 11], [-17, 9], [19, -16], [-24, -7], [29, 6], [-7, -35], [34, -24], [-36, -12]]) out.push({ type: 'spark', x: bx + dx, y: by + dy, vx: 0, vy: 0, life: 10, max: 16, size: 1, c: '#ffe066' });
  // dust at her heels and two spent shells
  for (const [dx, dy, s, life] of [[-9, -2, 2.5, 20], [-14, -3, 3, 16], [-19, -1, 2, 12]]) out.push({ type: 'dust', x: WX(HERO.x) + dx, y: DECK + dy, vx: 0, vy: 0, life, max: 26, size: s });
  out.push({ type: 'debris', x: WX(HERO.x) - 3, y: HERO.y - 29, vx: 0, vy: 0, life: 30, max: 40, size: 2, c: '#e8b43a' });
  out.push({ type: 'debris', x: WX(HERO.x) - 9, y: HERO.y - 24, vx: 0, vy: 0, life: 30, max: 40, size: 2, c: '#e8b43a' });
  return out;
}

// the eye saucer bringing a cow in: the kit's saucer and beam, the cow floating up inside it
ENEMY_TYPES.hgtug = {
  hp: 2, contact: 'none', flying: true, activateMargin: 600,
  make(e, s) { e.y = s.y; e.spec = s; },
  update(e) { e.vx = 0; },
  draw(e) {
    const t = G.t, bob = Math.round(Math.sin(t / 17) * 1.5);
    FLASH = e.hitT > 0;
    M5.drone(e.x, e.y, -1, { pose: 'idle', beam: e.spec.beam, still: true });
    FLASH = false;
    // the beam's bright edges (the kit paints the cone)
    const y0 = e.y + 12, n = e.spec.beam - y0;
    for (let j = 0; j < n; j++) { const hw = Math.round(5 + j / n * 13); ctx.fillStyle = 'rgba(234,255,200,' + (0.55 - 0.3 * j / n).toFixed(3) + ')'; ctx.fillRect(Math.round(e.x) - hw, y0 + j, 1, 1); ctx.fillRect(Math.round(e.x) + hw - 1, y0 + j, 1, 1); }
    M5.cow(e.x - 1, e.y + 56 + bob, 1, { float: true });
    M5.bubble(e.x + 22, e.y + 30 + bob, 'MOO!');
    // the beam's light over the cow, and sparkles going up
    for (let k = 0; k < 3; k++) { const u = (t / 40 + k / 3) % 1, y = Math.round(e.y + 62 - u * 36), hw = 7 + Math.round((y - e.y - 12) / 62 * 13); ctx.fillStyle = 'rgba(234,255,200,0.42)'; ctx.fillRect(Math.round(e.x) - hw, y, hw * 2, 1); }
    for (let k = 0; k < 7; k++) { const u = (t / 60 + hsh(k * 3.3)) % 1; ctx.fillStyle = k % 2 ? PAL.BEAML : '#ffffff'; ctx.fillRect(Math.round(e.x - 14 + hsh(k * 7.7) * 28), Math.round(e.y + 70 - u * 54), 1, 1); }
  },
  box: e => ({ x: e.x - 14, y: e.y - 10, w: 28, h: 22 }),
  onKill(e, cx, cy, b) { boom(cx, cy, 0.8); debris(cx, cy, 8, PAL.G[3]); addScore(100, cx, b.y); }
};

LEVELS.push({
  mission: 'MISSION 5', title: 'ALIEN MOTHERSHIP', end: 6400, heroStart: 120, freedLabel: 'COWS RESCUED',
  sections: [{ x: 0, name: 'AREA 1: THE HANGAR' }, { x: 1600, name: 'AREA 2: STAR GARDEN' }, { x: 3300, name: 'AREA 3: SPACE WALK' }, { x: 5000, name: 'FINAL AREA: THE BRIDGE' }],
  terrain: null,
  plats: [CAT, CRATE],
  spawns: [
    { t: 'oggle', x: WX(176), y: CAT.y, pose: 'warn', face: -1 },                 // on the catwalk, about to fire down
    { t: 'hgtug', x: WX(TUG.x), y: TUG.y, beam: TUG.beam },                       // the eye saucer and its cow
    { t: 'oggle', x: WX(347), y: CRATE.y, pose: 'shoot', face: -1 },              // on the cargo crate: ZAP
    { t: 'oggle', x: WX(399), pose: 'walk', face: -1 }                            // marching in
  ],
  pows: [{ x: WX(POD_X), item: 'H', kind: 'cow' }],
  props: [], locks: [],
  music: 'main', bossMusic: 'boss',
  load() { G.big = null; },
  update() {
    const p = G.p;
    Object.assign(p, { x: WX(HERO.x), y: HERO.y, vx: 0.6, vy: 0, onGround: true, onPlat: null, facing: 1, aim: 'fwd', crouch: false,
      knife: 0, muzzle: 3, weapon: 'hmg', ammo: 164, bombs: 8, hearts: 3, inv: 0, dead: 0, kb: 0, ride: null, hidden: false, t: 1 });
    G.lives = 3; G.score = 52300;
    G.big = null; G.banner = { s: 'AREA 1: THE HANGAR', t: 100 };
    for (const o of G.pows) if (o.state === 'tied') o.t = 8;                       // hold the HELP! bubble
    // H.M.G. rounds on their way (the one before them just blew an oggle apart), the oggle's ring coming back
    G.pb = [{ x: WX(166), y: HERO.y - 19, vx: 7, vy: 0, dmg: 1, life: 60, draw: hmgShot }, { x: WX(202), y: HERO.y - 19, vx: 7, vy: 0, dmg: 1, life: 60, draw: hmgShot }];
    G.eb = [{ k: 'ogring', x: WX(RING.x), y: RING.y, vx: -1.6, vy: 0.18, life: 900 }];
    G.parts = frameFx();
    G.texts = [{ x: WX(BURST.x) - 2, y: BURST.y - 41, s: '100', t: 40, c: '#ffffff' }];
    G.items = []; G.grenades = []; G.rings = []; G.shake = 0;
  },
  drawBG(cx) {
    const l = build(), ox = CAM - cx, t = G.t;
    ctx.fillStyle = PAL.SP[0]; ctx.fillRect(-10, -10, W + 20, H + 20);
    strip(l.space, cx, 0.02);
    // a few stars twinkle
    for (let i = 0; i < 14; i++) {
      const x = OPEN.x0 + 16 + Math.floor(hsh(i * 4.1) * (OPEN.x1 - OPEN.x0 - 32)) + ox, y = OPEN.y0 + 6 + Math.floor(hsh(i * 8.3) * (BACK - OPEN.y0 - 14));
      if (Math.floor((t + i * 23) / 26) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); ctx.fillStyle = 'rgba(200,247,255,0.55)'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    }
    // the Earth: a soft blue halo, then the marble
    const ex = EARTH.x + Math.round(ox * 0.97), ey = EARTH.y;
    M5.glow(ex - 6, ey - 8, EARTH.r + 30, '#3d7be0', 0.3);
    ctx.drawImage(l.earth.img, ex - l.earth.ox, ey - l.earth.oy);
    // far off: more saucers on their way down to the Earth
    for (const [fx, fy, sz, ph] of [[272, 66, 2, 0], [285, 75, 1, 9], [295, 83, 0, 18]]) {
      const x = fx + Math.round(ox * 0.9) + Math.round(Math.sin((t + ph * 7) / 37) * 1), y = fy + Math.round(Math.sin((t + ph * 5) / 23) * 1), w = 2 + sz;
      R(x - 1, y - 2, 3, 1, '#74d3ee'); R(x - w, y - 1, w * 2 + 1, 1, PAL.G[4]); R(x - w - 1, y, w * 2 + 3, 1, PAL.G[3]); R(x - w + 1, y + 1, w * 2 - 1, 1, PAL.G[1]); R(x, y + 1, 1, 1, '#ffffff');
      if (blink(14, ph * 5)) R(x - w - 1, y, 1, 1, PAL.AMBL);
    }
    field(ox);
  },
  drawBehind() {
    const l = build(), t = G.t;
    world(l.wall);
    // live wall lights
    for (let x = OPEN.x0 + 26; x < OPEN.x1 - 24; x += 20) M5.glow(WX(x), OPEN.y0, 7, PAL.CYAN, 0.35 + 0.15 * Math.sin(t / 9 + x));
    for (let x = 14; x < 190; x += 26) M5.glow(WX(x), 68, 9, PAL.CYAN, 0.16);
    const cv = Math.floor(t / 10) % 4;                                             // the way-on chevrons light up in turn
    if (cv < 3) for (let k = 0; k < 5; k++) for (const yy of [173 + k, 181 - k]) R(WX(145 + cv * 11 + k), yy, 2, 1, PAL.AMBL);
    if (blink(16)) R(WX(104 + 38), 95 + 22, 2, 1, PAL.CYANL);                       // the screen's cursor
    world(l.floor);
    for (const [cx, cy, rx] of PADS) for (const s of [-1, 1]) { const on = blink(20, cx); R(WX(cx + s * (rx + 3)) - 1, cy, 2, 1, on ? PAL.MAGL : '#7a2452'); if (on) M5.glow(WX(cx + s * (rx + 3)), cy, 5, PAL.MAG, 0.5); }
    world(l.rear);
    // the work lamps under the catwalk light the parked saucers: flat cones of light (stepped, no blur)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const lx of LAMPS.slice(0, 2)) for (const [k, a] of [[0.44, 0.07], [0.24, 0.06]]) {
      ctx.fillStyle = 'rgba(79,200,255,' + a + ')';
      for (let y = CAT.y + 15; y < 228; y++) { const hw = Math.round(3 + (y - CAT.y - 15) * k); ctx.fillRect(WX(lx) - hw, y, hw * 2 + 1, 1); }
    }
    ctx.restore();
    text('Z', WX(35), 172, PAL.CYANL, 1, 'left', null); R(WX(42), 169, 3, 1, PAL.CYAN); R(WX(43), 170, 1, 1, PAL.CYAN); R(WX(42), 171, 3, 1, PAL.CYAN);   // asleep
    for (const cx of [22, 78]) if (blink(30, cx * 3)) { R(WX(cx) - 1, 181, 3, 3, PAL.AMBL); M5.glow(WX(cx), 182, 6, PAL.AMB, 0.5); }
    // the crane and the crate in its claw
    world(l.crane);
    ctx.drawImage(l.hung.img, WX(CRANE.x) - 11 - l.hung.ox, CRANE.claw + 6 - l.hung.oy);
    const lamp = blink(12);
    RO(WX(CRANE.x) - 16, 40, 3, 3, lamp ? PAL.AMBL : '#8a6a12'); if (lamp) M5.glow(WX(CRANE.x) - 14, 41, 8, PAL.AMB, 0.6);
  },
  drawGround() {
    const l = build();
    world(l.deck);
  },
  drawPlat(pl) {
    const l = build();
    if (pl.t === 'cat') {
      ctx.drawImage(l.cat.img, pl.x - l.cat.ox, pl.y - l.cat.oy);
      ctx.drawImage(l.box1.img, WX(58) - l.box1.ox, pl.y - 17 - l.box1.oy);                      // cargo left on the catwalk
      ctx.drawImage(l.box2.img, WX(61) - l.box2.ox, pl.y - 30 - l.box2.oy);
      ctx.drawImage(l.box2.img, WX(40) - l.box2.ox, pl.y - 13 - l.box2.oy);
      for (const x of LAMPS) { RO(WX(x) - 2, pl.y + 13, 5, 2, PAL.CYANL); M5.glow(WX(x), pl.y + 15, 8, PAL.CYAN, 0.35); }
    } else ctx.drawImage(l.crate.img, pl.x - l.crate.ox, pl.y - l.crate.oy);
  },
  drawFront(cx) {
    const l = build();
    const fx = Math.round(-(cx - CAM) * 1.3);
    ctx.drawImage(l.front.img, fx - l.front.ox, -l.front.oy);
    const on = blink(18);
    R(fx + 465, 241, 5, 3, on ? PAL.AMBL : '#8a6a12'); R(fx + 465, 241, 5, 1, on ? '#ffffff' : '#b08a1c'); if (on) M5.glow(fx + 467, 242, 9, PAL.AMB, 0.55);
  },
  drawOverlay(cx) {
    const ox = CAM - cx, t = G.t;
    // the magenta guide strip glows
    for (let x = -12 + ((ox % 32) + 32) % 32; x < W + 16; x += 32) M5.glow(x, DECK + 12, 12, PAL.MAG, 0.16);
    // where the catwalk oggle's ring will go: a dotted green line down to the hero (his warning)
    if (Math.floor(t / 5) % 2 === 0) {
      const x0 = 176 - 25 + ox, y0 = CAT.y - 13, x1 = HERO.x + 6 + ox, y1 = HERO.y - 24, n = 9;
      for (let i = 1; i < n; i++) { ctx.fillStyle = i % 2 ? PAL.BEAM : PAL.BEAML; ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 2, 2); }
    }
    // steam from the fuel valve
    for (let i = 0; i < 6; i++) {
      const ph = ((t * 0.5 + i * 31) % 90) / 90, x = 50 + ox + ph * 9 + Math.sin(ph * 6 + i) * 2, y = 174 - ph * 22;
      ctx.fillStyle = 'rgba(200,210,240,' + (Math.sin(Math.PI * ph) * 0.22).toFixed(3) + ')'; pdisc(x, y, 2 + ph * 4);
    }
  }
});
}
