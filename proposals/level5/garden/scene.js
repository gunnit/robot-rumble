'use strict';
// =====================================================================================================================
// MISSION 5 proposal frame: AREA 2: STAR GARDEN (key: garden). A mock screenshot painted by the real engine: a harness
// fixture, NOT game content. Needs the shared kit first:
//   node tools/harness/harness.mjs render --level 5 --x 2401.6 --frames 60 --hero 1 --god --scale 3 \
//     --extra proposals/level5/kit.js --extra proposals/level5/garden/scene.js --out proposals/level5/garden/garden.png
// (--x 2401.6 puts the camera at exactly x 2200, so world x = screen x + 2200.)
// A glass bio-dome inside the alien mothership: space, the Moon and a ringed planet behind curved steel ribs; an alien
// garden that is never green (green belongs to the robots); the abducted cows behind a force-field fence; Mathias
// bouncing off a mushroom cap with the H.M.G. Static art is painted pixel by pixel into buffers and baked once; only
// small loops driven by G.t move. Deterministic: no Math.random / rand (a private mulberry32 table, hsh and G.t).
// =====================================================================================================================
{
const PAL = M5.PAL;
const { NONE, I, buf, put, get, rect, shape, oval, ball, line, poly, outline, mk, blit } = M5.px;
const S = PAL.S.map(I), GN = PAL.G.map(I);
const Pc = (...s) => s.map(I);
const WHITE = 0xffffff, OUTI = I(OUT);

// ------------------------------------------------------------ frame layout (screen coordinates; world x = x + CAM)
const CAM = 2200, WX = x => CAM + x;
const DECK = 232;                              // the catwalk (= GROUND)
const TER = 204;                               // top of the raised planter behind the catwalk
const HERO = { x: 118, y: 179 };               // Mathias mid-bounce above the orange cap (feet)
const M1 = { x: 118, y: 192, w: 56, capH: 15, t: 'm1' };      // mushroom-cap platforms: centre x, top y
const M2 = { x: 246, y: 186, w: 62, capH: 17, t: 'm2' };
const PAD = { x0: 340, x1: 438 };              // the cow paddock on the terrace
const SAUCER = { x: 391, y: 101 };             // the eye saucer lowering one more cow
const BURST = { x: 247, y: 164 };              // the oggle the tracers just hit, on the pink cap
const POD_X = 458;
const FALL_X = 200;                            // the irrigation spout pouring into the pond
const MOON = { x: 110, y: 101, r: 34 }, PLANET = { x: 322, y: 84, r: 9 };
const DOME = { cx: 250, by: 215, r: 236, rim: 8 };
const LONS = [-60, -30, 0, 30, 60];
const BEAM_Y = 62, WALL_Y = 172;

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
// a shaded ball from an int ramp of 5 (dark -> light), lit from the upper right like the kit's robots
function sph(b, cx, cy, rx, ry, cols, lx = 0.45, ly = -0.85, th = [0.6, 0.18, -0.34, -0.72]) {
  shape(b, cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, (x, y) => {
    const l = (x - cx) / rx * lx + (y - cy) / ry * ly;
    return cols[l > th[0] ? 4 : l > th[1] ? 3 : l > th[2] ? 2 : l > th[3] ? 1 : 0];
  });
}
function strip(s, cx, p) { ctx.drawImage(s.img, Math.round(-s.ox - (cx - CAM) * p), -s.oy); }
function world(s) { ctx.drawImage(s.img, CAM - s.ox, -s.oy); }
function pdisc(x, y, r) {
  x = Math.round(x); y = Math.round(y);
  const R2 = (r + 0.5) * (r + 0.5);
  for (let j = -Math.floor(r); j <= Math.floor(r); j++) { const hw = Math.floor(Math.sqrt(R2 - j * j)); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
}

// ------------------------------------------------------------ plant palettes (dark -> light). Never green.
const PINK = Pc('#4a1248', '#8a1f6e', '#d03f92', '#ff7fbd', '#ffc4e2');
const TEAL = Pc('#0b3246', '#12607a', '#1c95a8', '#4fd0dc', '#bdf4fa');
const ORNG = Pc('#6a2418', '#b8481c', '#f08a2a', '#ffc04f', '#ffeaa8');
const CREAM = Pc('#6e5a78', '#b29aa8', '#e8d6c8', '#fff3d6', '#ffffff');
const VIOL = Pc('#231250', '#3d2088', '#6a3cc8', '#9a74f0', '#d0bcff');
const TRUNK = Pc('#2a1c4c', '#4f3c7c', '#8470b0');
const HAZE = I('#191640');
const hz = (pal, k, c = HAZE) => pal.map(v => mixI(v, c, k));

// ============================================================
// Space: stars, a violet nebula, the Moon and a small ringed planet (screen layer, no parallax)
// ============================================================
const TWINK = [];
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
function paintSpace() {
  const b = buf(W + 20, 240, 10, 10);
  const R0 = Pc('#04030b', '#06051a', '#0a0920', '#0f0d2a', '#151236', '#1c1644', '#261a54', '#331c62', '#441f6e');
  for (let y = -10; y < 230; y++) for (let x = -10; x < W + 10; x++) {
    let v = 0.10 + 0.20 * ss(20, 200, y);
    const n = fbm(x / 80 + 3.1, y / 50 + 1.7, 5, 4), band = Math.exp(-((((y - 104) + (x - 250) * 0.24) / 60) ** 2));
    v += band * ss(0.36, 0.72, n) * 0.8 + Math.exp(-((((y - 150) - (x - 120) * 0.2) / 30) ** 2)) * ss(0.45, 0.8, fbm(x / 60 + 9, y / 40, 8, 3)) * 0.4;
    put(b, x, y, ramp(R0, v, x, y, 0.7));
  }
  const r = rng(771);
  for (let i = 0; i < 340; i++) {
    const x = Math.floor(r() * (W + 20)) - 10, y = Math.floor(r() * 215) - 6, k = r(), tint = r();
    const col = I(tint < 0.14 ? '#bff3ff' : tint < 0.26 ? '#ffc9e6' : tint < 0.34 ? '#fff0b0' : '#ffffff');
    if (k < 0.60) put(b, x, y, I(k < 0.3 ? '#4d5590' : '#8088c0'));
    else if (k < 0.90) put(b, x, y, col);
    else if (k < 0.972) {
      put(b, x, y, WHITE);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(b, x + dx, y + dy, mixI(col, I('#3a3f78'), 0.45));
      TWINK.push([x, y, col]);
    } else {
      put(b, x, y, WHITE);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { put(b, x + dx, y + dy, col); put(b, x + dx * 2, y + dy * 2, mixI(col, I('#3a3f78'), 0.6)); }
      TWINK.push([x, y, col]);
    }
  }
  for (let k = 0; k < 18; k++) put(b, 444 - k, 92 + (k >> 1), k < 2 ? WHITE : k < 6 ? I('#c8f7ff') : k < 11 ? I('#8fa2d2') : I('#3a3f78'));   // a shooting star
  put(b, 445, 91, I('#c8f7ff')); put(b, 445, 93, I('#c8f7ff')); put(b, 446, 92, I('#c8f7ff'));
  paintPlanet(b);
  paintMoon(b);
  return b;
}

// ============================================================
// The dome: hull in the top corners, a thick steel arch, curved meridian ribs, one ring beam, glass shine, and the
// far base wall of the garden (screen layer, parallax 0.05)
// ============================================================
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
const ribX = (lon, y) => { const s = (DOME.by - y) / DOME.r; return DOME.cx + Math.sin(lon * Math.PI / 180) * DOME.r * Math.sqrt(Math.max(0, 1 - s * s)); };
const domeD = (x, y) => Math.hypot(x + 0.5 - DOME.cx, y + 0.5 - DOME.by);
function paintDome() {
  const b = buf(W + 40, 218, 20, 0);
  const { r, rim } = DOME, RIM = [S[1], S[3], S[4], S[6], S[4], S[3], S[2], S[0]];
  for (let y = 0; y < WALL_Y; y++) for (let x = -20; x < W + 20; x++) {
    const d = domeD(x, y);
    if (d > r) put(b, x, y, hullCol(x, y, 2));
    else if (d > r - rim) put(b, x, y, RIM[Math.min(7, Math.floor(r - d))]);
  }
  // glass: a pair of slanting shine strokes in some panes
  for (const [x0, y0, len] of [[232, 72, 26], [292, 74, 20], [446, 110, 26], [142, 38, 15], [368, 38, 15], [66, 130, 18], [170, 116, 18]]) for (let k = 0; k < len; k++) {
    const x = Math.round(x0 - k * 0.8), y = y0 + k, c = I(k < 2 || k > len - 3 ? '#1a2052' : '#262e6c');
    for (let i = 0; i < 3; i++) if (domeD(x + i, y) < r - rim) put(b, x + i, y, c);
    if (k > 3 && k < len - 2 && domeD(x + 6, y) < r - rim) put(b, x + 6, y, I('#1a2052'));
  }
  // bolts round the arch
  for (let a = 0.02; a < Math.PI; a += 0.052) {
    const x = Math.round(DOME.cx + Math.cos(a) * (r - 4)), y = Math.round(DOME.by - Math.sin(a) * (r - 4));
    if (y < WALL_Y - 2) { put(b, x, y, S[7]); put(b, x, y + 1, S[1]); }
  }
  // a pipe and a cyan light strip follow the arch on the hull
  for (let y = 0; y < WALL_Y; y++) for (let x = -20; x < W + 20; x++) {
    const d = domeD(x, y) - r;
    if (d > 5 && d <= 9) put(b, x, y, [S[1], S[4], S[3], S[1]][Math.floor(d - 5.001)]);
    if (d > 13 && d <= 14) { const a = Math.atan2(DOME.by - y, x - DOME.cx); put(b, x, y, Math.floor(a * 60) % 3 ? I('#1f7fa6') : S[0]); }
  }
  // meridian ribs: dark edge left, lit edge right
  for (const lon of LONS) for (let y = 0; y < WALL_Y; y++) {
    const x = Math.round(ribX(lon, y));
    if (domeD(x, y) > r - rim) continue;
    put(b, x - 2, y, S[1]); put(b, x - 1, y, S[2]); put(b, x, y, S[3]); put(b, x + 1, y, S[5]);
    if (y % 14 === 5) { put(b, x, y, S[6]); put(b, x, y + 1, S[1]); }
  }
  // the ring beam with its cyan lamps, node plates where the ribs cross it
  for (let x = -20; x < W + 20; x++) {
    if (domeD(x, BEAM_Y + 2) > r - rim) continue;
    [S[6], S[4], S[3], S[2], S[0]].forEach((c, k) => put(b, x, BEAM_Y + k, c));
    if (((x % 20) + 20) % 20 < 6) put(b, x, BEAM_Y + 3, I(((x % 20) + 20) % 20 === 0 ? PAL.CYANL : PAL.CYAN));
  }
  for (const lon of LONS) {
    const x = Math.round(ribX(lon, BEAM_Y + 2));
    rect(b, x - 6, BEAM_Y - 3, 11, 11, S[1]); rect(b, x - 5, BEAM_Y - 2, 9, 9, S[3]); rect(b, x - 5, BEAM_Y - 2, 9, 1, S[6]); rect(b, x + 3, BEAM_Y - 1, 1, 8, S[4]);
    rect(b, x - 5, BEAM_Y + 6, 9, 1, S[2]);
    for (const [dx, dy] of [[-4, -1], [2, -1], [-4, 5], [2, 5]]) put(b, x + dx, BEAM_Y + dy, S[7]);
    rect(b, x - 2, BEAM_Y + 1, 3, 3, I(PAL.AMB)); put(b, x - 2, BEAM_Y + 1, I(PAL.AMBL));
  }
  // hull dressing in the corners: plaques, a vent
  plaque(b, 6, 42, 3, 5); vent(b, 8, 60, 16, 7);
  plaque(b, 446, 42, 3, 9);
  // the far base wall
  for (let y = WALL_Y; y < 218; y++) for (let x = -20; x < W + 20; x++) put(b, x, y, hullCol(x + 9, y + 5, 1));
  for (let x = -20; x < W + 20; x++) {
    [S[5], S[4], S[3], S[3], S[2], S[1], S[0]].forEach((c, k) => put(b, x, WALL_Y + k, c));
    if (((x % 12) + 12) % 12 === 3) { put(b, x, WALL_Y + 2, S[6]); put(b, x, WALL_Y + 3, S[1]); }
    [S[0], S[3], S[2], S[1], S[0]].forEach((c, k) => put(b, x, WALL_Y + 12 + k, c));           // a long pipe
    if (((x % 46) + 46) % 46 < 3) for (let k = -1; k < 6; k++) put(b, x, WALL_Y + 12 + k, k === -1 ? S[4] : S[2]);
  }
  for (const lon of LONS) {                                 // rib feet on the base ring
    const x = Math.round(ribX(lon, WALL_Y));
    rect(b, x - 5, WALL_Y - 3, 10, 9, S[1]); rect(b, x - 4, WALL_Y - 2, 8, 7, S[3]); rect(b, x - 4, WALL_Y - 2, 8, 1, S[6]); rect(b, x + 3, WALL_Y - 1, 1, 6, S[4]);
  }
  vent(b, 286, 190, 22, 9); vent(b, 44, 190, 18, 9);
  // a bulkhead door with a hazard lintel, and a robot screen showing an eye
  rect(b, 156, 181, 26, 30, S[0]); rect(b, 157, 182, 24, 29, S[3]); rect(b, 158, 187, 22, 24, S[2]); rect(b, 169, 187, 1, 24, S[0]); rect(b, 158, 187, 22, 1, S[4]); rect(b, 162, 193, 4, 3, S[0]); rect(b, 173, 193, 4, 3, S[0]);
  for (let i = 0; i < 24; i++) for (let k = 0; k < 4; k++) put(b, 157 + i, 182 + k, ((i + k) >> 2) % 2 ? I('#c9a12e') : I('#22222c'));
  rect(b, 188, 183, 17, 12, S[0]); rect(b, 189, 184, 15, 10, S[3]); rect(b, 190, 185, 13, 8, GN[0]);
  pix(b, 191, 186, ['...ggggg...', '.gg.....gg.', 'g...lGl...g', 'g...GlG...g', '.gg.....gg.', '...ggggg...'], { g: GN[2], G: GN[3], l: GN[5] });
  return b;
}

// ============================================================
// Plant painters
// ============================================================
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
function stamp(dst, src) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const v = src.d[y * src.w + x]; if (v !== NONE) put(dst, x - src.ox, y - src.oy, v); } }
// paint one plant into a scratch buffer, give it a dark edge, then stamp it into the layer
function plant(dst, fn, edge) { const t = buf(dst.w, dst.h, dst.ox, dst.oy); fn(t); if (edge != null) outline(t, edge); stamp(dst, t); }
function pix(b, x, y, rows, map) { rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = map[row[i]]; if (c != null) put(b, x + i, y + j, c); } }); }
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
}
// blooms: a star flower (this is the STAR garden), a tulip cup, a hanging lantern bulb
const STARF = ['...L...', '.L.L.L.', '..LML..', 'LLMWMLL', '..LML..', '.L.L.L.', '...L...'];
const TULIP = ['.L.L.L.', 'LWLMLML', 'LLMMMMD', 'LMMMMMD', '.MMMMD.', '..MDD..'];
const BULB = ['..S..', '.LLM.', 'LWLMD', 'LLMMD', 'LMMMD', '.MMD.', '..D..'];
const bloomMap = (pal, stalk) => ({ W: WHITE, L: pal[4], M: pal[3], D: pal[2], S: stalk });
function starFlower(b, x, base, h, pal, stalk, lean = 0) {
  line(b, x, base, x + lean, base - h, stalk); put(b, x + (lean > 0 ? -1 : 1), base - 3, stalk); put(b, x + (lean > 0 ? -2 : 2), base - 4, stalk);
  pix(b, x + lean - 3, base - h - 4, STARF, bloomMap(pal, stalk)); GLOWS.push([x + lean, base - h - 1, pal[3], 7]);
}
function tulip(b, x, base, h, pal, stalk, lean = 0) {
  line(b, x, base, x + lean, base - h, stalk); line(b, x, base - 2, x - 3, base - 6, stalk); line(b, x, base - 3, x + 3, base - 7, stalk);
  pix(b, x + lean - 3, base - h - 5, TULIP, bloomMap(pal, stalk)); GLOWS.push([x + lean, base - h - 3, pal[3], 7]);
}
function lantern(b, x, base, h, dir, stalk, pal) {
  bough(b, [x, base], [x - dir, base - h * 1.25], [x + dir * h * 0.42, base - h * 0.8], 2.4, 1.2, stalk);
  line(b, x, base - 2, x - dir * 5, base - 7, stalk[1]); line(b, x - dir, base - 2, x - dir * 6, base - 5, stalk[0]);
  const bx = Math.round(x + dir * h * 0.42), by = Math.round(base - h * 0.8);
  pix(b, bx - 2, by + 1, BULB, bloomMap(pal, stalk[1])); GLOWS.push([bx, by + 4, pal[3], 9]);
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
  GLOWS.push([x, base - h + 2, glow, 6]);
}
function bubBush(b, x, base, w, cols, seed) {
  const r = rng(seed), n = Math.round(w / 2.2), dark = cols.map((c, i) => i ? cols[i - 1] : c), bs = [];
  for (let i = 0; i < n; i++) { const u = r() * 2 - 1; bs.push([x + u * w / 2, base - 2 - r() * (1 - u * u) * w * 0.34, 2 + r() * 2.2, r()]); }
  bs.sort((p, q) => q[1] - p[1] + (p[3] - q[3]) * 2);
  for (const [bx, by, br, d] of bs) { oval(b, Math.round(bx), Math.round(by), br + 1, br + 1, dark[0]); bubble(b, Math.round(bx), Math.round(by), Math.round(br * 2) / 2, d < 0.3 ? dark : cols); }
}
// soft glows of the blooms, collected while painting: [x, y, colour, radius]
const GLOWS = [];
function grass(b, x0, x1, base, pal, seed, hmax = 5) {
  for (let x = x0; x < x1; x++) {
    const hgt = 1 + Math.floor(nz(x, seed) * nz(x >> 2, seed + 1) * (hmax + 1.5));
    for (let k = 0; k < hgt; k++) put(b, x + (k > 2 && nz(x, seed + 2) > 0.5 ? 1 : 0), base - k, k === hgt - 1 ? pal[2] : k > 0 ? pal[1] : pal[0]);
  }
}
// a tall background mushroom (not a platform)
function tallShroom(b, x, base, h, w, cap, stem, glow) {
  for (let y = base - h + 3; y <= base; y++) { const lean = Math.round(Math.sin((base - y) / h * 2.2) * 2); put(b, x + lean - 1, y, stem[0]); put(b, x + lean, y, stem[1]); put(b, x + lean + 1, y, stem[2]); }
  const cx = x + Math.round(Math.sin(2.2) * 2), cy = base - h + 3, hw = w / 2;
  for (let i = -hw; i < hw; i++) {
    const u = (i + 0.5) / hw, hh = Math.round((w * 0.42) * Math.sqrt(1 - u * u));
    for (let k = 0; k < hh; k++) { const l = u * 0.45 + (k / Math.max(1, w * 0.42)) * 1.5 - 0.6; put(b, cx + i, cy - k, cap[l > 0.7 ? 4 : l > 0.25 ? 3 : l > -0.2 ? 2 : 1]); }
    put(b, cx + i, cy + 1, (i & 1) ? glow : cap[0]);
  }
  for (let i = 0; i < w / 5; i++) put(b, cx - hw + 2 + i * 5 + (i & 1), cy - 2 - (i % 3), cap[4]);
}

// ============================================================
// Far garden (screen layer, parallax 0.2): soft two-tone shapes at the foot of the dome, darker than everything in play
// ============================================================
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
function paintFar() {
  const b = buf(W + 80, 110, 40, -104);
  const F = (pal, k) => [mixI(pal[0], HAZE, k), mixI(pal[1], HAZE, k + 0.1), mixI(pal[2], HAZE, k + 0.12)];
  const FV = F(VIOL, 0.36), FP = F(PINK, 0.46), FT = F(TEAL, 0.42), GL = mixI(I(PAL.CYAN), HAZE, 0.55);
  farTree(b, 150, 212, 56, 30, FV, 1); farShroom(b, 236, 212, 36, 20, FV, GL); farTree(b, 268, 212, 64, 34, FT, 2);
  farShroom(b, 300, 212, 46, 22, FP, GL); farTree(b, 350, 212, 46, 26, FV, 3); farTree(b, 428, 212, 58, 28, FT, 4);
  farTree(b, 30, 212, 50, 26, FT, 5); farShroom(b, 334, 212, 30, 16, FV, GL); farShroom(b, 186, 212, 28, 14, FT, GL);
  farShroom(b, 472, 212, 34, 18, FT, GL);
  // a low haze of leaves along the wall foot
  for (let x = -40; x < W + 40; x++) { const hgt = 3 + Math.floor(fbm(x / 14, 3, 61, 2) * 9); for (let k = 0; k < hgt; k++) put(b, x, 212 - k, k === hgt - 1 && nz(x, 9) > 0.5 ? FV[1] : FV[0]); }
  return b;
}

// ============================================================
// Mid garden (screen layer, parallax 0.35): hazy bubble trees and tall mushrooms in front of the far wall
// ============================================================
function paintMid() {
  const b = buf(W + 120, 150, 60, -62);
  // a calm far hedge along the wall foot (it stays dark behind the play lane; gaps behind the paddock and the pod)
  const HV = [mixI(VIOL[0], HAZE, 0.2), mixI(VIOL[1], HAZE, 0.4), mixI(VIOL[2], HAZE, 0.5)], HT = [mixI(TEAL[0], HAZE, 0.2), mixI(TEAL[1], HAZE, 0.4), mixI(TEAL[2], HAZE, 0.5)], HP = [mixI(PINK[0], HAZE, 0.2), mixI(PINK[1], HAZE, 0.45), mixI(PINK[2], HAZE, 0.55)];
  for (const [x, w, h, pal, sd] of [[-30, 50, 20, HV, 1], [20, 40, 15, HT, 2], [70, 46, 12, HV, 3], [150, 40, 12, HP, 4], [200, 50, 15, HV, 5], [272, 46, 13, HT, 6], [316, 36, 16, HV, 7], [474, 40, 16, HP, 8], [512, 50, 20, HV, 9]]) bush(b, x, 211, w, h, pal, sd);
  tallShroom(b, 451, 210, 80, 26, hz(VIOL, 0.26), hz(CREAM, 0.45).slice(0, 3), mixI(I(PAL.CYAN), HAZE, 0.3));
  tallShroom(b, 476, 210, 56, 20, hz(PINK, 0.3), hz(CREAM, 0.45).slice(0, 3), mixI(I(PAL.CYAN), HAZE, 0.3));
  tallShroom(b, 432, 210, 40, 16, hz(VIOL, 0.38), hz(CREAM, 0.5).slice(0, 3), mixI(I(PAL.CYAN), HAZE, 0.4));
  bubbleTree(b, 16, 211, 92, 24, hz(TRUNK, 0.15), hz(PINK, 0.12), 11);
  bubbleTree(b, 196, 211, 84, 24, hz(TRUNK, 0.15), hz(TEAL, 0.1), 23);
  bubbleTree(b, 318, 211, 98, 21, hz(TRUNK, 0.15), Pc('#8a3414', '#d2581c', '#f8962e', '#ffc85a', '#fff0b4'), 37);
  return b;
}

const SPRINK = [158, 304];
// ============================================================
// The terrace (world): the raised planter wall behind the catwalk, its plants, the paddock grass
// ============================================================
function paintTerrace() {
  const b = buf(W + 20, 90, 10, -146);
  // the planter wall
  for (let x = -10; x < W + 10; x++) {
    const u = ((x + CAM) % 48 + 48) % 48;
    for (let y = TER; y < DECK; y++) {
      let c = y === TER ? S[5] : y === TER + 1 ? S[4] : y === TER + 2 ? S[1] : y < TER + 14 ? (bay(x, y) < 0.5 ? S[2] : S[1]) : y > DECK - 3 ? S[0] : S[1];
      if (y > TER + 2 && u === 0) c = S[0];
      if (y > TER + 2 && u === 1) c = S[2];
      put(b, x, y, c);
    }
    [S[0], S[4], S[3], S[2], S[0]].forEach((c, k) => put(b, x, TER + 4 + k, c));                 // irrigation pipe
    if (((x + CAM) % 32 + 32) % 32 < 3) for (let k = 0; k < 5; k++) put(b, x, TER + 4 + k, k === 0 ? S[5] : k === 4 ? S[1] : S[3]);
    const m = ((x + CAM) % 16 + 16) % 16;                                                         // magenta guide strip
    put(b, x, TER + 20, S[0]); put(b, x, TER + 22, S[0]);
    put(b, x, TER + 21, m < 9 ? I(m === 0 ? PAL.MAGL : PAL.MAG) : S[0]);
  }
  vent(b, 64, TER + 11, 16, 6); plaque(b, 220, TER + 11, 3, 13, 1);
  vent(b, 378, TER + 11, 18, 6);
  // the spout that pours the pink nutrient stream
  rect(b, FALL_X - 6, TER + 8, 12, 8, S[0]); rect(b, FALL_X - 5, TER + 9, 10, 6, S[3]); rect(b, FALL_X - 5, TER + 9, 10, 1, S[5]); rect(b, FALL_X - 3, TER + 13, 6, 3, S[0]);
  // soil and moss along the planter top
  const MOSS = Pc('#3a1458', '#7a2a8e', '#c85ab8', '#ff9ad8'), MOSS2 = Pc('#0e3a52', '#1a6a86', '#3fb6c8', '#a8f0f6');
  for (let x = -10; x < W + 10; x++) { put(b, x, TER - 1, nz(x, 5) > 0.3 ? MOSS[1] : MOSS[0]); if (nz(x, 6) > 0.6) put(b, x, TER, MOSS[0]); if (nz(x, 7) > 0.86) put(b, x, TER + 1, MOSS[1]); }
  grass(b, -10, PAD.x0 - 4, TER - 1, MOSS2, 31, 4);
  grass(b, PAD.x0 - 4, PAD.x1 + 6, TER - 1, [MOSS[1], MOSS[2], MOSS[3]], 41, 5);                  // the pasture: pink grass
  grass(b, PAD.x1 + 6, W + 10, TER - 1, MOSS2, 51, 4);
  // plants on the terrace (kept low and sparse behind the play lane; the bright bits are the small blooms)
  const FERN = [TEAL[0], TEAL[1], TEAL[3], I('#ff9ad8')], FERNV = [VIOL[0], VIOL[2], VIOL[3], I('#ffe9a8')];
  const STK = I('#1a6078'), STK3 = Pc('#123e58', '#1a6078', '#3a9ab0'), EDGE = I('#0c0a24');
  plant(b, t => fiddle(t, 20, TER, 30, -1, 3, FERNV), EDGE);
  plant(b, t => fiddle(t, 1, TER, 48, 1, 3, FERN), EDGE);
  plant(b, t => { shroomlet(t, 82, TER, 9, 7, VIOL, I(PAL.CYAN)); shroomlet(t, 88, TER, 7, 4, VIOL, I(PAL.CYAN)); }, EDGE);
  plant(b, t => { tulip(t, 149, TER, 14, PINK, STK, 1); tulip(t, 169, TER, 11, PINK, STK, -1); starFlower(t, 186, TER, 13, TEAL, STK, 0); }, EDGE);
  plant(b, t => { shroomlet(t, 197, TER, 9, 6, TEAL, I(PAL.CYANL)); shroomlet(t, 205, TER, 7, 4, TEAL, I(PAL.CYANL)); }, EDGE);
  plant(b, t => lantern(t, 281, TER, 27, 1, STK3, ORNG), EDGE);
  plant(b, t => { starFlower(t, 299, TER, 9, CREAM, STK, 0); tulip(t, 312, TER, 13, PINK, STK, -1); }, EDGE);
  plant(b, t => bubBush(t, 448, TER, 16, ORNG, 9));
  plant(b, t => fiddle(t, 483, TER, 38, -1, 3, FERNV), EDGE);
  for (const x of SPRINK) { rect(b, x, TER - 6, 1, 6, S[4]); rect(b, x - 1, TER - 8, 3, 2, S[6]); put(b, x, TER - 8, I(PAL.CYANL)); }
  // a sign on the paddock's first post: this is where the cows are kept
  rect(b, PAD.x0, TER - 34, 1, 8, S[4]);
  rect(b, PAD.x0 - 7, TER - 46, 15, 13, S[4]); rect(b, PAD.x0 - 6, TER - 45, 13, 11, S[0]); rect(b, PAD.x0 - 7, TER - 46, 15, 1, S[6]);
  pix(b, PAD.x0 - 4, TER - 43, ['.c.....c.', '.bbbbbbb.', 'bbkbbbkbb', 'bbbbbbbbb', '.bpppppb.', '.bpnpnpb.', '..ddddd..'], { c: I(PAL.CREAM), b: I(PAL.C[3]), k: OUTI, p: I(PAL.CREAM), n: I(PAL.NOSE), d: I(PAL.C[2]) });
  // gardeners' tags on little stakes
  for (const [x, c] of [[143, PAL.CYAN], [288, PAL.MAGL]]) { rect(b, x, TER - 5, 1, 5, S[5]); rect(b, x - 1, TER - 8, 4, 3, I(c)); put(b, x, TER - 7, S[0]); }
  // the cows' water trough
  rect(b, 383, TER - 6, 16, 6, S[1]); rect(b, 384, TER - 5, 14, 4, S[4]); rect(b, 384, TER - 5, 14, 1, I(PAL.CYANL)); rect(b, 384, TER - 4, 14, 1, I(PAL.CYAN)); rect(b, 384, TER - 2, 14, 1, S[2]); put(b, 386, TER - 5, WHITE);
  return b;
}

// ============================================================
// The catwalk and the glowing pond under it (world)
// ============================================================
const LQ = Pc('#1e0834', '#3c0e52', '#6a166c', '#a02082', '#d8389a', '#ff72ba', '#ffc8e6');
const PADS = [[64, 258, 9], [150, 252, 7], [176, 263, 10], [246, 256, 8], [322, 262, 11], [388, 253, 7], [416, 264, 9], [296, 250, 5]];
function paintDeck() {
  const b = buf(W + 20, 42, 10, -DECK);
  for (let y = 240; y < 274; y++) for (let x = -10; x < W + 10; x++) {
    if (y < 243) { put(b, x, y, y === 240 ? S[0] : I('#1c0a30')); continue; }
    const d = (y - 243) / 28;
    let v = 0.26 + 0.46 * Math.sin(Math.PI * Math.min(1, d * 1.15 + 0.1)) * (1 - d * 0.3) + (fbm((x + CAM) / 26, y / 4 + 3, 31, 3) - 0.5) * 0.44;
    put(b, x, y, ramp(LQ, v, x, y));
  }
  // ripples and caustic squiggles
  for (let i = 0; i < 90; i++) {
    const y = 246 + Math.floor(nz(i, 3) * 25), x = -10 + Math.floor(nz(i, 4) * (W + 20)), w = 3 + Math.floor(nz(i, 5) * 9);
    for (let k = 0; k < w; k++) put(b, x + k, y + (nz(i, 6) > 0.6 && k > w / 2 ? 1 : 0), nz(i, 7) > 0.78 ? I('#aef6ff') : LQ[6]);
  }
  // floating pads (teal discs with a notch and a pale rim)
  for (const [x, y, w] of PADS) {
    for (let i = -w; i <= w; i++) { const hh = Math.round(2.4 * Math.sqrt(1 - (i / (w + 0.5)) ** 2)); for (let k = -hh; k <= hh; k++) put(b, x + i, y + k, k === -hh ? TEAL[3] : k === hh ? TEAL[0] : i > w * 0.3 ? TEAL[2] : TEAL[1]); }
    put(b, x - 1, y - 1, LQ[4]); put(b, x - 2, y - 2, LQ[4]); put(b, x, y, TEAL[0]);
    for (let i = -w; i <= w; i++) put(b, x + i, y + 3 + (Math.abs(i) > w * 0.7 ? -1 : 0), LQ[1]);
    if (w > 7) { rect(b, x + 3, y - 3, 3, 2, CREAM[3]); put(b, x + 4, y - 4, WHITE); put(b, x + 4, y - 2, ORNG[3]); }
  }
  // struts and a girder under the catwalk
  for (let x = -10; x < W + 10; x++) {
    const u = ((x + CAM) % 80 + 80) % 80;
    if (u >= 20 && u < 25) for (let y = 240; y < 274; y++) put(b, x, y, [S[0], S[2], S[4], S[2], S[0]][u - 20]);
    if (u >= 17 && u < 28) { put(b, x, 240, S[3]); put(b, x, 241, S[2]); put(b, x, 242, S[0]); }
  }
  // the catwalk slab: bright top edge, plates with seams, magenta guide dashes
  for (let x = -10; x < W + 10; x++) {
    const u = ((x + CAM) % 40 + 40) % 40;
    [S[7], S[6], S[5], S[4], S[4], S[3], S[2], S[0]].forEach((c, k) => put(b, x, DECK + k, c));
    if (u === 0) for (let k = 1; k < 7; k++) put(b, x, DECK + k, S[1]);
    if (u === 1) for (let k = 1; k < 6; k++) put(b, x, DECK + k, S[6]);
    if (u === 5 || u === 36) { put(b, x, DECK + 2, S[7]); put(b, x, DECK + 3, S[2]); }
    if (u >= 12 && u < 29) { put(b, x, DECK + 4, S[1]); put(b, x, DECK + 5, I(u === 12 ? PAL.MAGL : PAL.MAG)); put(b, x, DECK + 6, S[1]); }
  }
  return b;
}

// ============================================================
// Mushroom-cap platforms (world sprites, origin = top centre of the cap)
// ============================================================
function paintShroom(m, cap, spot, spots) {
  const hw = m.w / 2, ch = m.capH, total = DECK - m.y, potH = 7, gill = 4, stemTop = ch + 1, stemBot = total - potH;
  const b = buf(m.w + 8, total + 4, hw + 4, 2);
  const STEM = Pc('#5f4a78', '#a58fb4', '#e6d6dc', '#fff6e6'), GILL = Pc('#7a4a6a', '#e8c8b0', '#fff0d0');
  for (let y = stemTop; y < stemBot + 1; y++) {
    const t = (y - stemTop) / (stemBot - stemTop), w = Math.round(5.5 + 2.4 * t * t);
    for (let x = -w; x < w; x++) { const u = (x + w + 0.5) / (2 * w); put(b, x, y, u < 0.2 ? STEM[0] : u < 0.45 ? STEM[1] : u < 0.84 ? STEM[2] : STEM[3]); }
    if (y === stemTop + 5 || y === stemTop + 6) for (let x = -w - 1; x < w + 1; x++) put(b, x, y, y === stemTop + 5 ? STEM[3] : STEM[1]);   // the skirt
  }
  for (let y = stemTop; y < stemTop + 3; y++) for (let x = -7; x < 7; x++) if (get(b, x, y) !== NONE) put(b, x, y, STEM[y === stemTop + 2 ? 1 : 0]);   // shade under the cap
  // the steel pot bolted to the deck
  rect(b, -11, total - potH, 22, potH, I(METD)); rect(b, -12, total - potH, 24, 2, I(MET)); rect(b, -12, total - potH, 24, 1, I(METL));
  for (let i = 0; i < 6; i++) { rect(b, -11 + i * 4, total - 4, 2, 3, I(PAL.AMB)); rect(b, -9 + i * 4, total - 4, 2, 3, I('#22222c')); }
  rect(b, -11, total - 1, 22, 1, I(METDD));
  // gills under the cap
  for (let x = -hw + 3; x < hw - 3; x++) {
    const u = (x + 0.5) / (hw - 3), dy = Math.round(gill * Math.sqrt(1 - u * u));
    for (let k = 0; k < dy; k++) put(b, x, ch - 1 + k, (x & 1) ? GILL[0] : k === dy - 1 ? GILL[2] : GILL[1]);
  }
  // the cap: flat top, round shoulders
  const top = x => ch * (1 - Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / hw, 2.6))));
  for (let x = -hw; x < hw; x++) {
    const u = (x + 0.5) / hw, y0 = Math.round(top(x + 0.5)), y1 = ch - (Math.abs(u) > 0.93 ? 1 : 0);
    for (let y = y0; y < y1; y++) {
      const w = (y + 0.5) / ch, l = u * 0.42 - (2 * w - 1) * 0.85;
      let c = cap[l > 0.62 ? 4 : l > 0.2 ? 3 : l > -0.34 ? 2 : l > -0.74 ? 1 : 0];
      if (y === y0) c = u > -0.55 ? cap[4] : cap[3];
      if (y === y1 - 1) c = cap[0]; else if (y === y1 - 2) c = cap[1];
      put(b, x, y, c);
    }
  }
  for (const [su, sw, rx, ry] of spots) {
    const sx = su * hw, sy = sw * ch;
    shape(b, sx - rx, sy - ry, sx + rx, sy + ry, (x, y) => ((x - sx) / rx) ** 2 + ((y - sy) / ry) ** 2 <= 1 && cap.includes(get(b, x, y)),
      (x, y) => (y - sy) / ry > 0.35 ? spot[1] : (x - sx) / rx > 0.2 && (y - sy) / ry < -0.1 ? spot[3] : spot[2]);
  }
  outline(b);
  return b;
}
const SPOTS1 = [[-0.62, 0.52, 4, 2.4], [-0.22, 0.3, 5, 2.6], [0.24, 0.5, 4.5, 2.4], [0.62, 0.34, 4, 2], [0.02, 0.74, 3, 1.5], [-0.42, 0.8, 2.5, 1.3], [0.5, 0.78, 3, 1.4], [0.84, 0.66, 2, 1.4]];
const SPOTS2 = [[-0.66, 0.5, 4, 2.4], [-0.3, 0.26, 5.5, 2.6], [0.16, 0.42, 5, 2.8], [0.6, 0.3, 4.5, 2.2], [-0.1, 0.74, 3.5, 1.6], [0.44, 0.76, 3, 1.4], [-0.5, 0.82, 2.5, 1.2], [0.84, 0.62, 2.4, 1.6]];

// ============================================================
// The new robot: the EYE FLOWER, a turret on a steel stalk. Shut it is an armoured bud; it opens its bloom to show
// the eye (the warning) before it spits a seed. Sprites face right, origin = the bolt plate on the deck.
// ============================================================
const BEZ = [METDD, METD, MET, METL, '#ffffff'];
function eyeBake(b, cx, cy, r) {
  oval(b, cx, cy, r + 2.7, r + 2.7, GN[0]);
  ball(b, cx, cy, r + 2, r + 2, BEZ);
  oval(b, cx, cy, r, r, I(PAL.EYEW));
  shape(b, cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r && (x - cx) * -0.35 + (y - cy) * 0.94 > r * 0.52, I(PAL.EYES));
}
function eyeLive(cx, cy, r, lx, ly, mood, t) {
  const k = r - 2.4, x = Math.round(cx + clamp(lx, -1, 1) * k), y = Math.round(cy + clamp(ly, -1, 1) * k);
  const warn = mood === 'warn', col = warn ? (Math.floor(t / 4) % 2 ? PAL.WARN : '#ffffff') : PAL.IRIS;
  R(x - 2, y - 1, 5, 3, col); R(x - 1, y - 2, 3, 5, col);
  if (!warn) { R(x + 1, y + 1, 1, 1, PAL.IRISD); R(x, y + 2, 1, 1, PAL.IRISD); R(x, y - 1, 1, 3, PAL.PUP); R(x - 1, y, 3, 1, PAL.PUP); R(x - 1, y - 1, 1, 1, '#ffffff'); }
  else R(x, y, 1, 1, PAL.PUP);
}
function flowerBase(b) {
  rect(b, -8, -4, 16, 4, I(METD)); rect(b, -8, -4, 16, 1, I(METL)); rect(b, -8, -1, 16, 1, I(METDD));
  for (let i = 0; i < 4; i++) { rect(b, -7 + i * 4, -3, 2, 2, I(PAL.AMB)); rect(b, -5 + i * 4, -3, 2, 2, I('#22222c')); }
  rect(b, -3, -7, 6, 3, I(MET)); rect(b, -3, -7, 6, 1, I(METL)); rect(b, -3, -5, 6, 1, I(METD));
}
function flowerStalk(b, hx, hy, sway) {
  const n = -7 - hy;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = Math.round(Math.sin(t * Math.PI * 1.5) * sway + hx * t * t), y = -7 - i, j = i % 5 === 4;
    put(b, x - 1, y, I(j ? METDD : METD)); put(b, x, y, I(j ? METD : MET)); put(b, x + 1, y, I(j ? MET : METL));
  }
}
function leafPlate(b, ax, ay, d, droop = 0) {
  const pts = [[ax, ay], [ax + d * 4, ay - 4 + droop], [ax + d * 10, ay - 5 + droop * 2], [ax + d * 13, ay - 2 + droop * 3], [ax + d * 8, ay + 1 + droop * 2], [ax + d * 3, ay + 2]];
  poly(b, pts, (x, y) => (y - ay) - (x - ax) * d * (-0.2 + droop * 0.2) < -1.5 ? GN[4] : GN[2]);
  line(b, ax + d, ay - 1, ax + d * 12, ay - 3 + droop * 3, GN[1]);
  put(b, ax + d * 6, ay - 4 + droop, GN[5]); put(b, ax + d * 7, ay - 4 + droop, GN[5]);
}
function petal(b, hx, hy, a, dist, rl, rw) {
  const ca = Math.cos(a), sa = Math.sin(a), cx = hx + ca * dist, cy = hy + sa * dist;
  shape(b, cx - rl - 1, cy - rl - 1, cx + rl + 1, cy + rl + 1, (x, y) => { const u = (x - cx) * ca + (y - cy) * sa, v = -(x - cx) * sa + (y - cy) * ca; return (u / rl) ** 2 + (v / rw) ** 2 <= 1; },
    (x, y) => {
      const u = ((x - cx) * ca + (y - cy) * sa) / rl, v = (-(x - cx) * sa + (y - cy) * ca) / rw, l = (x - cx) / rl * 0.45 + (y - cy) / rl * -0.85;
      if (u * u + v * v > 0.62) return l > 0 ? GN[3] : GN[1];
      if (Math.abs(v) < 0.16 && u > -0.3 && u < 0.55) return GN[2];
      return u < -0.5 ? GN[1] : l > 0.3 ? GN[5] : l > -0.2 ? GN[4] : GN[3];
    });
}
const FLOWER_HEAD = { x: 3, y: -33 };
function paintFlowerOpen() {
  const b = buf(46, 64, 22, 60), { x: hx, y: hy } = FLOWER_HEAD;
  flowerBase(b); flowerStalk(b, hx, hy, -2.5);
  leafPlate(b, -1, -10, -1, 0.5); leafPlate(b, 0, -13, 1, 0.3);
  for (const a of [60, 120, 0, 180, 240, 300]) petal(b, hx, hy, a * Math.PI / 180, 9.4, 5.6, 3.9);
  eyeBake(b, hx, hy, 4.6);
  outline(b);
  return b;
}
function paintFlowerShut() {
  const b = buf(46, 64, 22, 60);
  flowerBase(b); flowerStalk(b, -1, -24, 1.5);
  leafPlate(b, -1, -12, -1, 0.8); leafPlate(b, 1, -15, 1, 0.8);
  const cx = -1, cy = -30;
  sph(b, cx, cy, 5.8, 7.4, [GN[1], GN[2], GN[3], GN[4], GN[5]]);
  for (let y = -37; y <= -23; y++) { const k = (y + 30) / 7.4, w = Math.sqrt(Math.max(0, 1 - k * k)); put(b, cx + Math.round(w * 2.2) - 1, y, GN[1]); put(b, cx - Math.round(w * 3.4), y, GN[1]); }
  rect(b, cx - 1, cy - 9, 2, 2, GN[3]); put(b, cx, cy - 10, GN[2]);
  rect(b, cx - 4, cy + 6, 8, 2, GN[1]); rect(b, cx - 3, cy + 6, 6, 1, GN[2]);
  outline(b);
  return b;
}
let FL = null;
function flowerSprites() { return FL || (FL = { open: mk(paintFlowerOpen()), shut: mk(paintFlowerShut()) }); }
// draw: (x, y) = base on the deck; facing; o.pose 'shut' | 'open' | 'warn'; o.look; o.t
function eyeFlower(x, y, facing, o = {}) {
  const t = o.t ?? G.t, pose = o.pose || 'open', s = flowerSprites(), { x: hx, y: hy } = FLOWER_HEAD;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(facing, 1);
  if (pose === 'shut') {
    R(-1, -44, 1, 4, OUT); RO(-2, -47, 3, 3, '#8a6a12'); R(-2, -47, 1, 1, PAL.AMB);
    blit(s.shut, 0, 0);
    ctx.restore();
    const k = Math.floor(t / 22) % 3;                              // asleep: little z's
    text('Z', Math.round(x) + facing * 6, Math.round(y) - 50 - k * 2, '#c8f7ff', 1, 'left', '#0e0c1e');
    if (k) R(Math.round(x) + facing * 6 + 7, Math.round(y) - 58 - k, 3, 1, '#c8f7ff');
    return;
  }
  const warn = pose === 'warn', jit = warn ? (Math.floor(t / 3) % 2 ? 1 : 0) : 0;
  // antenna: a springy stalk with the lamp
  const sway = warn ? (Math.floor(t / 3) % 2 ? 1 : -1) : Math.round(Math.sin(t / 14));
  R(hx, hy - 15, 1, 4, OUT); R(hx + (sway > 0 ? 1 : sway < 0 ? -1 : 0), hy - 18, 1, 3, OUT);
  const lamp = warn ? (Math.floor(t / 4) % 2 ? '#ffffff' : PAL.IRIS) : PAL.AMB;
  RO(hx + sway - 1, hy - 21, 3, 3, lamp); R(hx + sway - 1, hy - 21, 1, 1, '#ffffff');
  blit(s.open, 0, -jit);
  const look = o.look || [1, 0];
  eyeLive(hx, hy - jit, 4.6, look[0] * facing, look[1], warn ? 'warn' : '', t);
  if (warn) { const g = PAL.G; R(hx - 4, hy - 5 - jit, 7, 1, g[2]); R(hx - 2, hy - 4 - jit, 6, 1, g[2]); R(hx + 1, hy - 3 - jit, 3, 1, g[2]); R(hx - 2, hy - 3 - jit, 3, 1, g[0]); R(hx + 1, hy - 2 - jit, 3, 1, g[0]); R(hx - 5, hy - 4 - jit, 3, 1, g[0]); }
  ctx.restore();
  if (warn) { M5.glow(x + facing * hx, y + hy, 9, PAL.WARN, 0.28); M5.bang(x + facing * hx + 1, y + hy - 30, t); }
}
ENEMY_TYPES.eyeflower = {
  hp: 4, contact: 'none', activateMargin: 600,
  make(e, s) { e.pose = s.pose || 'open'; e.look = s.look || null; e.facing = s.face || -1; e.t0 = s.t0; },
  update(e) { e.vx = 0; },
  draw(e) { FLASH = e.hitT > 0; eyeFlower(e.x, e.y, e.facing, { pose: e.pose, look: e.look, t: e.t0 }); FLASH = false; },
  box: e => ({ x: e.x - 12, y: e.y - 48, w: 24, h: 48 }),
  onKill(e, cx, cy, b) { boom(cx, cy, 0.9); debris(cx, cy, 8, PAL.G[3]); addScore(150, cx, b.y); }
};
// the kit's roly eye and oggle with a pinned animation clock (so the '!' and the yellow eye show whatever --frames is)
const pinned = (hp, draw, box) => ({
  hp, contact: 'none', activateMargin: 600,
  make(e, s) { e.spec = s; e.facing = s.face || -1; },
  update(e) { e.vx = 0; },
  draw(e) { FLASH = e.hitT > 0; draw(e); FLASH = false; },
  box,
  onKill(e, cx, cy, b) { boom(cx, cy, 0.8); debris(cx, cy, 8, PAL.G[3]); addScore(100, cx, b.y); }
});
ENEMY_TYPES.g_roller = pinned(2, e => M5.roller(e.x, e.y, e.facing, { pose: e.spec.pose, look: e.spec.look, rot: e.spec.rot, t: e.spec.t0 }), e => ({ x: e.x - 9, y: e.y - 18, w: 18, h: 18 }));
ENEMY_TYPES.g_oggle = pinned(3, e => M5.oggle(e.x, e.y, e.facing, { pose: e.spec.pose, look: e.spec.look, t: e.spec.t0 }), e => ({ x: e.x - 10, y: e.y - 27, w: 20, h: 27 }));

// ============================================================
// Foreground plants (screen space, bottom corners only): dark silhouettes rim-lit pink by the pond
// ============================================================
const FRONT = Pc('#8a2a80', '#3a1658', '#22103c', '#120a26'), FCURL = Pc('#160b2c', '#2c1450', '#b03c94', '#ffa0dc');
function paintFrontL() {
  const b = buf(120, 100, 14, -176);
  bigLeaf(b, -10, 262, -1.2, 40, 12, 0.25, FRONT);
  fiddle(b, 3, 292, 72, 1, 6, FCURL, 1.4);
  fiddle(b, 45, 294, 46, -1, 5, FCURL, 1.3);
  outline(b, I('#090514'));
  return b;
}
function paintFrontR() {
  const b = buf(100, 90, -390, -186);
  const dk = [FRONT[3], FRONT[3], FRONT[2], FRONT[1], FRONT[0]];
  fiddle(b, 493, 294, 56, -1, 5, FCURL, 1.4);
  limb(b, 468, 284, 458, 254, 4, 2, [FRONT[3], FRONT[2], FRONT[1]], -2); for (const [x, y, r] of [[457, 251, 6], [464, 258, 4], [451, 260, 4]]) bubble(b, x, y, r, dk);
  limb(b, 444, 286, 434, 264, 3, 2, [FRONT[3], FRONT[2], FRONT[1]], 2); for (const [x, y, r] of [[433, 261, 5], [440, 267, 3]]) bubble(b, x, y, r, dk);
  outline(b, I('#090514'));
  return b;
}

// ============================================================
// Building (once, on the first draw)
// ============================================================
let LAY = null;
function build() {
  if (LAY) return LAY;
  LAY = {
    space: mk(paintSpace()), dome: mk(paintDome()), far: mk(paintFar()), mid: mk(paintMid()), ter: mk(paintTerrace()), deck: mk(paintDeck()),
    m1: mk(paintShroom(M1, ORNG, CREAM, SPOTS1)), m2: mk(paintShroom(M2, PINK, Pc('#1c95a8', '#4fd0dc', '#bdf4fa', '#ffffff'), SPOTS2)),
    frontL: mk(paintFrontL()), frontR: mk(paintFrontR())
  };
  return LAY;
}

// ============================================================
// Live bits
// ============================================================
function fence() {
  const x0 = WX(PAD.x0), x1 = WX(PAD.x1), t = G.t, RAILS = [TER - 21, TER - 5];
  for (const y of RAILS) {
    for (let x = x0 + 3; x < x1 - 2; x++) { const w = ((x + Math.floor(t / 4)) % 8) < 4 ? 0 : 1; ctx.fillStyle = w ? 'rgba(79,227,255,0.45)' : 'rgba(79,227,255,0.75)'; ctx.fillRect(x, y + w, 1, 1); }
    for (let k = 0; k < 7; k++) { const x = x0 + 3 + ((k * 14 + Math.floor(t / 3) + (y & 7) * 3) % (x1 - x0 - 8)); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 2, 1); ctx.fillStyle = PAL.CYANL; ctx.fillRect(x + 2, y, 2, 1); }
  }
  for (const x of [x0, x1]) {
    R(x - 2, TER - 25, 5, 26, PAL.S[1]); R(x - 1, TER - 25, 3, 25, PAL.S[4]); R(x + 1, TER - 25, 1, 25, PAL.S[6]); R(x - 1, TER - 25, 3, 1, PAL.S[7]);
    R(x - 2, TER - 29, 5, 1, PAL.S[1]); R(x - 1, TER - 28, 3, 3, Math.floor(t / 24) % 2 ? PAL.AMB : PAL.AMBL);
    for (const y of RAILS) { R(x - 2, y - 1, 5, 3, PAL.S[2]); R(x - 1, y, 3, 1, PAL.CYANL); M5.glow(x, y, 5, PAL.CYAN, 0.3); }
  }
}
function paddock() {
  const t = G.t;
  M5.cow(WX(362), TER + 1, -1, {});
  M5.cow(WX(420), TER + 1, 1, {});
  // pink grass in the first cow's mouth, and blades in front of the hooves
  ctx.fillStyle = '#ff9ad8'; ctx.fillRect(WX(347), TER - 10, 1, 3); ctx.fillRect(WX(345), TER - 9, 1, 2); ctx.fillStyle = '#c85ab8'; ctx.fillRect(WX(346), TER - 10 + (Math.floor(t / 20) % 2), 1, 3);
  for (let i = 0; i < 26; i++) { const x = WX(PAD.x0 + 4 + i * 3.6 + hsh(i * 3.1) * 3), hgt = 2 + Math.floor(hsh(i * 7.7) * 3); ctx.fillStyle = i % 3 ? '#c85ab8' : '#ff9ad8'; ctx.fillRect(Math.round(x), TER + 1 - hgt, 1, hgt); }
  // one more cow arriving: the eye saucer lowers it gently in its beam
  M5.cow(WX(SAUCER.x) + 1, 160 + Math.round(Math.sin(t / 17) * 1.5), -1, { float: true });
  M5.drone(WX(SAUCER.x), SAUCER.y, -1, { pose: 'idle', look: [0, 1], beam: TER - 14, ph: 1 });
  fence();
}
function waterfall(y0, y1) {
  const x0 = WX(FALL_X - 3);
  for (let x = 0; x < 6; x++) {
    ctx.fillStyle = x === 0 || x === 5 ? '#d8358e' : x === 1 || x === 4 ? '#ff8fc8' : '#ffc8e6'; ctx.fillRect(x0 + x, y0, 1, y1 - y0);
    for (let y = y0; y < y1; y++) if ((((y - G.t * 1.6 + hsh(x + 3) * 40) % 6) + 6) % 6 < 2) { ctx.fillStyle = x === 0 || x === 5 ? '#ff8fc8' : '#ffffff'; ctx.fillRect(x0 + x, y, 1, 1); }
  }
}

// ============================================================
// The frame's action: pinned every update, so the picture does not depend on what the engine would do next
// ============================================================
function rotBuf(src, ang) {
  const n = Math.ceil(Math.hypot(src.w, src.h)) + 4, d = buf(n, n, n >> 1, n >> 1), c = Math.cos(ang), s = Math.sin(ang);
  for (let y = -(n >> 1); y < n - (n >> 1); y++) for (let x = -(n >> 1); x < n - (n >> 1); x++) {
    const v = get(src, Math.round(x * c + y * s), Math.round(-x * s + y * c));
    if (v !== NONE) put(d, x, y, v);
  }
  return d;
}
let BITS = null;
function burstSprites() {
  if (BITS) return BITS;
  const fin = (b, a) => { const d = a ? rotBuf(b, a) : b; outline(d); return mk(d); };
  // shell plates
  const p1 = buf(14, 10, 7, 5);
  shape(p1, -7, -5, 7, 5, (x, y) => (x / 6.5) ** 2 + ((y - 3) / 7) ** 2 <= 1 && y < 1.5 && x < 3 + y, (x, y) => { const q = (x / 6.5) ** 2 + ((y - 3) / 7) ** 2; return q > 0.74 ? GN[5] : y > 0 ? GN[1] : x > -1 ? GN[4] : GN[3]; });
  put(p1, -2, -1, GN[6]); put(p1, -2, 0, GN[1]);
  const p2 = buf(10, 8, 5, 4); rect(p2, -4, -2, 8, 4, GN[3]); rect(p2, -4, -2, 8, 1, GN[5]); rect(p2, -4, 1, 8, 1, GN[1]); put(p2, -2, 0, GN[6]); p2.d[(2 + 4) * 10 + 5 + 3] = NONE;
  // a boot
  const bt = buf(10, 8, 5, 4); rect(bt, -3, -1, 6, 4, I(METD)); rect(bt, -3, -1, 6, 1, I(MET)); put(bt, 2, 1, I(METL)); rect(bt, -1, -3, 3, 2, GN[1]);
  // the ray gun
  const gn = buf(18, 10, 9, 5); rect(gn, -7, -2, 7, 5, I('#c9d2e0')); rect(gn, -7, -2, 7, 1, WHITE); rect(gn, -7, 2, 7, 1, I('#8794a8')); rect(gn, -6, 3, 2, 2, I(METD));
  rect(gn, 0, -1, 1, 3, I(PAL.MAG)); rect(gn, 1, 0, 2, 1, I('#c9d2e0')); rect(gn, 3, -1, 1, 3, I(PAL.MAG)); rect(gn, 5, -1, 2, 3, I(PAL.BEAM));
  // the eye, popped out on its spring
  const ey = buf(16, 16, 8, 8); ball(ey, 0, 0, 6, 6, BEZ); oval(ey, 0, 0, 4, 4, I(PAL.EYEW)); rect(ey, -1, -2, 3, 3, I(PAL.IRIS)); put(ey, 0, -1, I(PAL.PUP)); put(ey, -3, -3, WHITE);
  // the antenna lamp
  const an = buf(10, 10, 5, 5); rect(an, -1, -3, 3, 3, I(PAL.AMB)); put(an, -1, -3, WHITE); rect(an, 0, 0, 1, 4, OUTI);
  const bolt = buf(5, 5, 2, 2); rect(bolt, -1, -1, 3, 3, I(MET)); put(bolt, -1, -1, I(METL)); put(bolt, 1, 1, I(METDD));
  BITS = { p1: fin(p1, 0.5), p1b: fin(p1, -2.2), p2: fin(p2, -0.6), boot: fin(bt, 0.9), gun: fin(gn, -0.7), eye: fin(ey, 0), ant: fin(an, 0.8), bolt: fin(bolt, 0) };
  return BITS;
}
function frameFx() {
  const B = burstSprites(), bx = WX(BURST.x), by = BURST.y, out = [];
  out.push({ type: 'flash', x: bx, y: by, life: 3, max: 5, size: 13 });
  for (const [dx, dy, s, life] of [[0, 0, 7, 30], [-5, 3, 5, 26], [5, -3, 5.5, 22], [-1, -6, 4.5, 18], [6, 5, 4, 14], [-7, -3, 3, 12]]) out.push({ type: 'fire', x: bx + dx, y: by + dy, vx: 0, vy: 0, life, max: 34, size: s });
  for (const [dx, dy, s] of [[-17, -9, B.p1], [15, -15, B.eye], [-12, 9, B.boot], [20, 2, B.gun], [2, -21, B.ant], [-21, 1, B.p2], [12, 11, B.p1b], [-6, -17, B.bolt], [24, -9, B.bolt], [7, -12, B.p2]])
    out.push({ type: 'sprite', x: bx + dx, y: by + dy, vx: 0, vy: 0, rot: 0, s, life: 40, max: 40 });
  for (const [dx, dy, c] of [[-9, -13, '#ffe066'], [10, -4, '#ffe066'], [7, 12, '#a8f070'], [-13, 6, '#ffe066'], [3, 15, '#a8f070'], [15, -9, '#ffffff'], [-22, -8, '#a8f070'], [22, 9, '#ffe066']]) out.push({ type: 'spark', x: bx + dx, y: by + dy, vx: 0, vy: 0, life: 10, max: 16, size: 1, c });
  // the puff of glowing spores he kicked out of the orange cap
  for (const [dx, dy, s, life] of [[-6, -2, 3, 20], [4, -3, 3.5, 18], [11, -1, 2.5, 15], [-12, -1, 2, 13]]) out.push({ type: 'dust', x: WX(M1.x) + dx, y: M1.y + dy, vx: 0, vy: 0, life, max: 26, size: s });
  for (const [dx, dy, c] of [[-14, -6, '#ffeaa8'], [-8, -10, '#c8f7ff'], [-2, -7, '#ffeaa8'], [6, -9, '#ffffff'], [13, -5, '#ffeaa8'], [18, -8, '#c8f7ff'], [-19, -3, '#ffffff'], [9, -13, '#ffeaa8'], [-5, -14, '#c8f7ff']])
    out.push({ type: 'spark', x: WX(M1.x) + dx, y: M1.y + dy, vx: 0, vy: 0, life: 10, max: 16, size: 1, c });
  // spent casings
  out.push({ type: 'debris', x: WX(HERO.x) - 5, y: HERO.y - 31, vx: 0, vy: 0, life: 30, max: 40, size: 2, c: '#e8b43a' });
  out.push({ type: 'debris', x: WX(HERO.x) - 11, y: HERO.y - 38, vx: 0, vy: 0, life: 30, max: 40, size: 2, c: '#e8b43a' });
  return out;
}

const T0 = 21;      // a clock value where the '!' is on and the warning eye is yellow
LEVELS.push({
  mission: 'MISSION 5', title: 'ALIEN MOTHERSHIP', end: 6400, heroStart: 120, freedLabel: 'COWS RESCUED',
  sections: [{ x: 0, name: 'AREA 1: THE HANGAR' }, { x: 1600, name: 'AREA 2: STAR GARDEN' }, { x: 3300, name: 'AREA 3: SPACE WALK' }, { x: 5000, name: 'FINAL AREA: THE BRIDGE' }],
  terrain: null,
  plats: [{ x: WX(M1.x - 23), y: M1.y, w: 46, t: 'm1' }, { x: WX(M2.x - 26), y: M2.y, w: 52, t: 'm2' }],
  spawns: [
    { t: 'eyeflower', x: WX(57), pose: 'warn', face: 1, look: [0.7, -0.6], t0: T0 },
    { t: 'g_roller', x: WX(176), pose: 'warn', face: -1, look: [-0.7, -0.7], rot: 0.9, t0: T0 },
    { t: 'g_roller', x: WX(289), pose: 'idle', face: -1, look: [-1, -0.2], rot: 2.2, t0: T0 },
    { t: 'g_oggle', x: WX(323), pose: 'aim', face: -1, look: [-0.9, -0.5], t0: 40 }
  ],
  pows: [{ x: WX(POD_X), item: 'B', kind: 'cow' }],
  props: [], locks: [],
  music: 'main', bossMusic: 'boss',
  load() { G.big = null; },
  update() {
    const p = G.p;
    Object.assign(p, { x: WX(HERO.x), y: HERO.y, vx: 0, vy: -0.9, onGround: false, onPlat: null, facing: 1, aim: 'fwd', crouch: false,
      knife: 0, muzzle: 3, weapon: 'hmg', ammo: 152, bombs: 7, hearts: 3, inv: 0, dead: 0, kb: 0, ride: null, hidden: false });
    G.lives = 3; G.score = 71850;
    G.big = null; G.banner = { s: 'AREA 2: STAR GARDEN', t: 100 };
    const my = HERO.y - 19;
    G.pb = [{ x: WX(HERO.x) + 44, y: my, vx: 7, vy: 0, dmg: 1, life: 60, draw: hmgShot }, { x: WX(HERO.x) + 72, y: my + 1, vx: 7, vy: 0, dmg: 1, life: 60, draw: hmgShot }, { x: WX(HERO.x) + 101, y: my - 1, vx: 7, vy: 0, dmg: 1, life: 60, draw: hmgShot }];
    G.parts = frameFx();
    G.texts = [{ x: WX(BURST.x), y: BURST.y - 34, s: '100', t: 40, c: '#ffffff' }];
    G.eb = []; G.items = []; G.grenades = []; G.rings = []; G.shake = 0;
    for (const o of G.pows) o.t = 10;                 // hold the pod's HELP! bubble on
  },
  drawBG(cx) {
    const l = build(), t = G.t;
    ctx.fillStyle = PAL.S[0]; ctx.fillRect(-10, -10, W + 20, H + 20);
    strip(l.space, cx, 0);
    TWINK.forEach(([x, y, c], i) => { if (Math.sin(t * 0.07 + i * 2.1) > 0.55) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); } });
    M5.glow(MOON.x, MOON.y, 60, '#8fa2d2', 0.3);
    strip(l.dome, cx, 0.05);
    const ox = -Math.round((cx - CAM) * 0.05);
    for (let x = 0; x < W; x += 20) if (Math.hypot(x - DOME.cx, BEAM_Y - DOME.by) < DOME.r - 10) M5.glow(x + 3 + ox, BEAM_Y + 4, 9, PAL.CYAN, 0.22);
    LONS.forEach((lon, i) => { const k = (Math.floor(t / 30) + i) % 5 === 0; M5.glow(Math.round(ribX(lon, BEAM_Y + 2)) + ox - 1, BEAM_Y + 2, k ? 9 : 6, PAL.AMB, k ? 0.5 : 0.25); });
    // garden lamps at the foot of the wall backlight the far plants
    const gx = -Math.round((cx - CAM) * 0.2);
    [[40, PAL.MAG], [150, '#9a74f0'], [262, PAL.CYAN], [352, PAL.MAG], [452, '#9a74f0']].forEach(([x, c], i) => M5.glow(x + gx, 196, 48, c, 0.26 + 0.02 * Math.sin(t / 40 + i)));
    strip(l.far, cx, 0.2);
    strip(l.mid, cx, 0.35);
  },
  drawBehind() {
    const l = build(), t = G.t;
    world(l.ter);
    for (const [x, y, c, gr] of GLOWS) M5.glow(WX(x), y, gr, '#' + c.toString(16).padStart(6, '0'), 0.28 + 0.08 * Math.sin(t / 20 + x));
    // sprinklers: a fine cyan mist
    for (const sx of SPRINK) for (let k = 0; k < 14; k++) {
      const u = ((t / 26 + k / 14) % 1), d = (k % 2 ? 1 : -1) * (2 + u * (9 + (k % 3) * 3)), y = TER - 8 - Math.sin(u * Math.PI) * (5 + (k % 4)) + u * 6;
      ctx.fillStyle = k % 3 ? 'rgba(200,247,255,0.8)' : 'rgba(255,255,255,0.9)'; ctx.fillRect(WX(sx) + Math.round(d), Math.round(y), 1, 1);
    }
    waterfall(TER + 14, DECK);
    paddock();
  },
  drawGround() {
    const l = build(), t = G.t;
    world(l.deck);
    waterfall(DECK + 8, DECK + 13);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 5; i++) pdisc(WX(FALL_X - 6 + i * 3), DECK + 13 + (i % 2), 1 + (i % 3 === 1 ? 1 : 0));
    // shimmer on the pond
    for (let i = 0; i < 34; i++) {
      const y = 247 + Math.floor(hsh(i * 3.1) * 22), x = hsh(i * 7.7) * W + Math.sin(t * 0.03 + i) * 3, w = 2 + Math.floor(hsh(i * 1.3) * 4);
      ctx.fillStyle = i % 5 ? 'rgba(255,220,240,0.8)' : 'rgba(174,246,255,0.9)'; ctx.fillRect(WX(Math.round(x)), y, w, 1);
    }
    for (let i = 0; i < 12; i++) { const u = ((t / 120 + hsh(i * 5.3)) % 1), x = WX(20 + hsh(i * 9.1) * 440), y = 270 - u * 22; ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * (1 - u)).toFixed(2) + ')'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    // the pond lights the underside of the catwalk
    for (let x = 30; x < W; x += 60) M5.glow(WX(x), 246, 26, PAL.MAG, 0.16);
  },
  drawPlat(pl2) {
    const l = build(), m = pl2.t === 'm1' ? M1 : M2;
    M5.glow(WX(m.x), m.y + m.capH + 4, 22, pl2.t === 'm1' ? '#ffd080' : PAL.CYAN, 0.3);
    blit(l[pl2.t], WX(m.x), m.y);
    const sp = pl2.t === 'm1' ? SPOTS1 : SPOTS2, k = 0.2 + 0.07 * Math.sin(G.t / 16 + m.x);      // the spots glow softly
    for (const [su, sw, rx] of sp) if (rx >= 4) M5.glow(WX(m.x) + su * m.w / 2, m.y + sw * m.capH, rx + 3, pl2.t === 'm1' ? '#fff3d6' : '#bdf4fa', k);
  },
  drawFront() {
    const l = build();
    ctx.drawImage(l.frontL.img, -l.frontL.ox, -l.frontL.oy);
    ctx.drawImage(l.frontR.img, -l.frontR.ox, -l.frontR.oy);
  },
  drawOverlay() {
    const t = G.t;
    for (const [x0, y0, ph, c] of [[166, 124, 0, '#c8f7ff'], [301, 147, 2, '#ffe9a8'], [72, 158, 4, '#ffc4e2']]) {
      const x = x0 + Math.round(Math.sin(t * 0.03 + ph) * 4), y = y0 + Math.round(Math.sin(t * 0.045 + ph * 2) * 3);
      M5.glow(x, y, 6, c, 0.3);
      ctx.fillStyle = c; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x, y + 3, 1, 3); ctx.fillRect(x - 1, y + 6, 1, 1);
    }
    // glowing spores drifting through the dome
    for (let i = 0; i < 34; i++) {
      const tt = t + i * 211, x = Math.round(((hsh(i * 3.7) * 700 + Math.sin(tt * 0.007 + i) * 30 + tt * 0.04) % (W + 40)) - 20);
      const y = Math.round(70 + hsh(i * 9.1) * 160 + Math.sin(tt * 0.011 + i * 2) * 10);
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,196,226,0.9)' : i % 3 === 1 ? 'rgba(200,247,255,0.9)' : 'rgba(255,240,170,0.8)';
      if (Math.sin(tt * 0.09 + i) > -0.3) ctx.fillRect(x, y, 1, 1);
    }
  }
});
}
