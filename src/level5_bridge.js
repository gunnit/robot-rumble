'use strict';
// =====================================================================================================================
// Mission 5 (ALIEN MOTHERSHIP) FINAL AREA: THE BRIDGE, world x 5000-6400. Owner: bridge. docs/level5-spec.md section 6.
// L5ART.bridge = { x0, x1, steps, bg, behind, ground, plat, front, overlay } for src/level5_scenery.js.
//   bg (screen space, into g only): deep space behind the windows (nebula, stars, twinkles; parallax 0.04) and, on a
//     nearer layer (parallax 0.25), the Earth (sand-coloured land), the Moon and two tiny saucers hauling cows up.
//   behind (world): the room. A 900-px approach corridor in seven bays, then the boss arena (camera 5920):
//     5000 AIRLOCK LOBBY   the hull in section, a porthole, the >>> sign, suit lockers, spare glass bubbles
//     5138 HALL OF FAME    framed portraits of the Missions 1-4 bosses (crab, bear, whale shark, octopus: each with a
//                          sticking plaster), picture lamps, name plates; under them a glass case with what was left
//                          of them (a claw, a cog, a fin, a tentacle)
//     5298 SERVICE BAY     pipes, a valve, a vent, a WANTED poster with the hero's own face (behind the 5300 console)
//     5380 STAR MAP ROOM   the big chart: home planet -> Earth (a cow marks it), a saucer creeping along the route;
//                          a plotting table with a little orrery
//     5540 COW COUNTER     seven lamps, one per pod of the mission; each rescue crosses one out (G.freed); a milk tank
//     5648 CREW STATIONS   an observation window (the Earth drifts through it), three desks, oggle-sized chairs
//     5874 CAPTAIN'S DOOR  hazard door marked BOSS, the end of the red carpet (deck, 5700-5934)
//     5920 THE BRIDGE      the panoramic window, the sill, an instrument wall, dark desks with glyph screens, the cow
//                          display, the holo globe, the captain's throne, wheel and podium, the ceiling plaque
//   ground (world): the deck (bright edge on L5ART.groundAt, top face, panelled front with the magenta strip), hazard
//     stripes at the airlock, the red carpet, the captain's hazard pad (6186-6378) where the MEGA OGGLE hovers.
//   plat: the 'console' platforms (5300, 5970, 6090): a pedestal console, open underneath so the eye beam passes.
//   front (screen): the backs of the near stations, a railing, velvet ropes on gold posts (in front of the HALL OF FAME
//     and along the red carpet), cables: y 228 and lower only, parallax 1.25.
//   overlay: a slow glint sliding over each pane of window glass.
// Static art is painted once into pixel buffers in bake steps; live bits use G.t and hsh() only. No Math.random.
// Green is the robots' colour: here only five small eye marks (three screens, the star map, the throne) and the two
// tiny far saucers are green. No actors, no boss, no mock staging: scenery only.
// =====================================================================================================================
var L5ART = L5ART || {};
{
const Math = globalThis.Math, clp = clamp, hs = hsh;   // local names: global lookups are slow in the test harness
const AX0 = 5000, AX1 = 6400, AR = 5920, DECK = 218;   // the area; the arena's camera (design x = world x - AR)
const WX0 = 5000, WX1 = 6412, WY0 = -10, WY1 = 222;    // the wall strip (world)
const CAM0 = 4610, CAM1 = 5920;                        // cameras the backdrop is asked for
const PS = 0.04, PE = 0.25;                            // parallax: stars; the Earth's layer
const EARTH = { x: 62, y: 100, r: 50 }, MOON = { x: 236, y: 97, r: 8 };   // screen positions at camera AR

// ---- palette (the ship's steel and lights as in M5.PAL; dim versions for everything behind the play lane) ----------
const S = ['#0e0c1e', '#17152e', '#222244', '#30345f', '#444e82', '#6272ab', '#8fa2d2', '#c3d0ee'];
const SP = ['#05040d', '#0b0a1c', '#141230', '#1f1a46'];
const MAG = '#ff4fa3', MAGL = '#ffb3d9', CYAN = '#4fe3ff', CYANL = '#c8f7ff', AMB = '#ffcf3a', AMBL = '#fff2a8';
const CY0 = '#1b6884', CY1 = '#2fa3c4', MG0 = '#742a64', MG1 = '#b03a80', AM0 = '#8a6a12', AM1 = '#c9a030';
const GRN = '#2fae44', GRNL = '#a8f070';               // the eye-mark screens only
const COWC = ['#6b4423', '#a8702f', '#d59a46', '#eebd6a'], CREAM = '#fff3d6';
const WU0 = '#1c1a3a', WU1 = '#1f1d40', WALLL = '#1b1936', SCRN = '#070c1e', HZ0 = '#1c1a24', RED = '#ff3b30';
const CARPET = ['#4e0e20', '#8e1c30', '#b8283e', '#e2566a'];

// ---- helpers ---------------------------------------------------------------------------------------------------------
const mod = (a, n) => ((a % n) + n) % n;
const lerp = (a, b, k) => a + (b - a) * k;
const DEG = Math.PI / 180;
let NZT = null;
function makeNZT() {
  let a = 71993; NZT = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); NZT[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
}
const nz = (x, y) => NZT[((Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0) & 65535];
function vn(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = s * 57;
  return lerp(lerp(nz(i + o, j), nz(i + 1 + o, j), a), lerp(nz(i + o, j + 1), nz(i + 1 + o, j + 1), a), b);
}
function fbm(x, y, s, oct) { let v = 0, a = 1, n = 0; for (let k = 0; k < oct; k++) { v += a * vn(x, y, s + k * 13); n += a; a *= 0.5; x *= 2.03; y *= 2.03; } return v / n; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y) => (BAYER[((y & 3) << 2) + (x & 3)] + 0.5) / 16;

// packed RGBA pixels (as they lie in an ImageData)
const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const pk = (r, g, b, a) => (LE ? ((a << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | a)) >>> 0;
const unp = v => LE ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24] : [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
const PC = new Map();
function P(c, a) {
  if (a !== undefined) return pk(parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), a);
  let v = PC.get(c);
  if (v === undefined) { v = pk(parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255); PC.set(c, v); }
  return v;
}
const s = S.map(c => P(c)), SPK = SP.map(c => P(c));      // the steel ramp and the space ramp, packed
// a colour from a ramp at t (0..1): flat bands with a narrow dithered transition
function band(cols, t, x, y, wd) {
  const f = clp(t, 0, 1) * (cols.length - 1), i = Math.floor(f), fr = clp((f - i - 0.5) / (wd || 0.3) + 0.5, 0, 1);
  return cols[Math.min(cols.length - 1, i + (fr > dith(x, y) ? 1 : 0))];
}
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

class Pix {
  constructor(x0, y0, w, h) { this.x0 = x0; this.y0 = y0; this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  dot(x, y, c) { x = Math.floor(x) - this.x0; y = Math.floor(y) - this.y0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  get(x, y) { x = Math.floor(x) - this.x0; y = Math.floor(y) - this.y0; return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
  rect(x, y, w, h, c) {
    x = Math.round(x) - this.x0; y = Math.round(y) - this.y0;
    const xa = Math.max(0, x), xb = Math.min(this.w, x + Math.round(w)), ya = Math.max(0, y), yb = Math.min(this.h, y + Math.round(h));
    if (xb <= xa) return;
    for (let r = ya; r < yb; r++) this.d.fill(c, r * this.w + xa, r * this.w + xb);
  }
  // every pixel whose centre passes f: colour col, or col(cx, cy, ix, iy) (0 = leave it)
  shape(f, col, x0, y0, x1, y1) {
    x0 = Math.max(Math.floor(x0), this.x0); y0 = Math.max(Math.floor(y0), this.y0);
    x1 = Math.min(Math.ceil(x1), this.x0 + this.w); y1 = Math.min(Math.ceil(y1), this.y0 + this.h);
    const fn = typeof col === 'function';
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (!f(x + 0.5, y + 0.5)) continue;
      const c = fn ? col(x + 0.5, y + 0.5, x, y) : col;
      if (c) this.d[(y - this.y0) * this.w + x - this.x0] = c;
    }
  }
  // copy another buffer's painted pixels in, its (0, 0) corner at (x, y)
  blit(src, x, y) { for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) { const v = src.d[j * src.w + i]; if (v) this.dot(x + i, y + j, v); } }
  hole(f, x0, y0, x1, y1) { for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) if (f(x + 0.5, y + 0.5)) this.dot(x, y, 0); }
  ell(cx, cy, rx, ry, col) { this.shape((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, col, cx - rx - 1, cy - ry - 1, cx + rx + 2, cy + ry + 2); }
  line(ax, ay, bx, by, c) {
    const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)));
    for (let k = 0; k <= n; k++) this.dot(Math.round(lerp(ax, bx, n ? k / n : 0)), Math.round(lerp(ay, by, n ? k / n : 0)), c);
  }
  // blend what is painted (opaque pixels only) toward colour c by k
  tint(x, y, w, h, c, k) {
    const [cr, cg, cb] = unp(c);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const v = this.get(i, j);
      if ((LE ? v >>> 24 : v & 255) !== 255) continue;
      const [r, g, b] = unp(v);
      this.dot(i, j, pk(Math.round(r + (cr - r) * k), Math.round(g + (cg - g) * k), Math.round(b + (cb - b) * k), 255));
    }
  }
  // the game's 5x7 font (core.js GLYPHS), 6 px per letter
  text(str, x, y, c) {
    for (let i = 0; i < str.length; i++) {
      const src = GLYPHS[str[i]];
      if (!src) continue;
      const rows = src.split(' ');
      for (let r = 0; r < rows.length; r++) for (let b = 0; b < 5; b++) if (rows[r][b] === '1') this.dot(x + i * 6 + b, y + r, c);
    }
  }
  outline(c) {
    const q = this.d.slice(), w = this.w, h = this.h;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (q[k]) continue;
      if ((i > 0 && q[k - 1]) || (i < w - 1 && q[k + 1]) || (j > 0 && q[k - w]) || (j < h - 1 && q[k + w])) this.d[k] = c;
    }
  }
  canvas() {
    const c = canvasOf(this.w, this.h), g = c.getContext('2d'), id = g.createImageData(this.w, this.h);
    id.data.set(new Uint8ClampedArray(this.d.buffer)); g.putImageData(id, 0, 0);
    return c;
  }
}
// soft light: a radial sprite, drawn additively (bake once per colour and size)
function halo(r, col, a) {
  const c = canvasOf(r * 2, r * 2), g = c.getContext('2d'), v = hex(col), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, 'rgba(' + v + ',' + a + ')'); gr.addColorStop(0.35, 'rgba(' + v + ',' + (a * 0.45).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + v + ',0)');
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return { img: c, o: r };
}
// a shine sliding over window glass: two slanted bands (pixel steps), drawn additively and clipped to the pane
function glint(ht) {
  const px = new Pix(0, 0, 24 + Math.ceil(ht * 0.6), ht);
  for (let y = 0; y < ht; y++) { const o = Math.round((ht - 1 - y) * 0.6); px.rect(o, y, 9, 1, P('#9fb4ee', 30)); px.rect(o + 14, y, 3, 1, P('#9fb4ee', 22)); }
  return px.canvas();
}
// a ceiling lamp's cone of light, narrow at the top (drawn additively)
function cone(wd, ht) {
  const c = canvasOf(wd, ht), g = c.getContext('2d'), id = g.createImageData(wd, ht), d = id.data;
  for (let y = 0; y < ht; y++) for (let x = 0; x < wd; x++) {
    const v = y / ht, hw = 5 + v * (wd / 2 - 5), k = Math.max(0, 1 - Math.abs(x + 0.5 - wd / 2) / hw), a = Math.pow(k, 1.3) * Math.pow(1 - v, 1.2) * 0.2, i = (y * wd + x) * 4;
    d[i] = 150; d[i + 1] = 215; d[i + 2] = 255; d[i + 3] = Math.round(a * 255);
  }
  g.putImageData(id, 0, 0);
  return { img: c, o: wd >> 1 };
}
const polyIn = pts => (x, y) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};
// alien glyphs: chunky circles, dots and bars (5x5); 7 is the oggles' eye mark
const GLY = [[14, 17, 17, 17, 14], [31, 0, 31, 0, 31], [4, 0, 31, 0, 4], [14, 17, 17, 0, 0], [4, 4, 4, 4, 4], [28, 16, 16, 0, 0], [0, 10, 0, 10, 0], [14, 17, 21, 17, 14], [16, 16, 16, 16, 31], [4, 4, 31, 4, 4], [31, 17, 17, 17, 31], [0, 14, 14, 14, 0]];
function glyph5(px, x, y, id, c) { for (let r = 0; r < 5; r++) for (let b = 0; b < 5; b++) if ((GLY[id][r] >> (4 - b)) & 1) px.dot(x + b, y + r, c); }
// the little cow pictogram of the oggles' screens (k = pixel size)
function cowIcon(px, x, y, k, dim) {
  const c = dim ? ['#4a3018', '#7a5224', '#a07434', '#c8b890'] : [COWC[0], COWC[1], COWC[2], CREAM];
  px.rect(x, y + 2 * k, 6 * k, 3 * k, P(c[1])); px.rect(x, y + 2 * k, 6 * k, k, P(c[2])); px.rect(x + 5 * k, y, 3 * k, 3 * k, P(c[2]));
  px.rect(x + 7 * k, y - k, k, k, P(c[3])); px.rect(x, y + 5 * k, k, k, P(c[0])); px.rect(x + 4 * k, y + 5 * k, k, k, P(c[0])); px.rect(x - k, y + 3 * k, k, k, P(c[0]));
}

// =====================================================================================================================
// SPACE (screen space, painted once): near-black violet nebula, stars in three sizes; then the Earth, the Moon, saucers
// =====================================================================================================================
const SW = W + 22 + Math.ceil((CAM1 - CAM0) * PS), SH = H + 20;
const OCEAN = ['#060a20', '#0a1844', '#102c74', '#1a4aa2', '#2c70c6', '#5aa2e4'];
const CLOUD = ['#10163a', '#2e3c74', '#6a82ba', '#a0b6e2', '#d2def8'];
const LAND = ['#0c0f24', '#27294a', '#514a58', '#80705c', '#ae966c'];
const MOONC = ['#1c1c36', '#3e3e62', '#77779c', '#b0b0cc', '#e2e2f0'];
const SUN = (() => { const m = Math.hypot(-0.62, -0.42, 0.66); return [-0.62 / m, -0.42 / m, 0.66 / m]; })();
const TWINK = [];
const BK = {};                                          // everything baked
let SPX = null;
function spaceRows(y0, y1) {
  if (!SPX) SPX = new Pix(0, 0, SW, SH);
  const d = SPX.d, C = SP.map(c => P(c));
  for (let y = y0; y < y1; y++) for (let x = 0; x < SW; x++) {
    const n = fbm(x / 90 + 3, y / 50 + 1, 5, 3), m = fbm(x / 40 + 11, y / 26 + 4, 9, 2);
    d[y * SW + x] = band(C, clp((n - 0.42) * 2.2, 0, 1) * (0.5 + m * 0.6), x, y, 0.5);
  }
}
function spaceStars() {
  const px = SPX;
  for (let i = 0; i < 400; i++) {
    const x = Math.floor(hs(i * 3.17) * SW), y = Math.floor(hs(i * 7.31) * SH), k = hs(i * 1.93);
    const tint = i % 9 === 0 ? '#ffd9a8' : i % 11 === 0 ? '#a8e0ff' : i % 13 === 0 ? MAGL : null;
    if (k < 0.6) px.dot(x, y, P(tint || (k < 0.3 ? '#4a4f82' : '#7a80b4')));
    else if (k < 0.9) px.dot(x, y, P(tint || '#d4dcff'));
    else {
      px.dot(x, y, P('#ffffff'));
      for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px.dot(x + a, y + b, P(tint || '#7f88c4'));
      TWINK.push([x, y]);
    }
  }
  BK.space = px.canvas(); SPX = null;
}
// the Earth: a blue marble with cloud swirls and sand-coloured land (no green), lit from the upper left, city lights
// on the night side, a thin pale-blue rim of air
const EO = EARTH.r + 4;
function paintEarth() {
  const E = { x: EO, y: EO, r: EARTH.r }, px = new Pix(0, 0, EO * 2, EO * 2);
  const OC = OCEAN.map(c => P(c)), CL = CLOUD.map(c => P(c)), LA = LAND.map(c => P(c));
  px.shape((x, y) => Math.hypot(x - E.x, y - E.y) <= E.r + 2.6, (x, y, ix, iy) => {
    const dx = (x - E.x) / E.r, dy = (y - E.y) / E.r, rr = dx * dx + dy * dy;
    if (rr > 1) {
      const d = (dx * SUN[0] + dy * SUN[1]) / Math.sqrt(rr), q = (Math.sqrt(rr) - 1) * E.r;
      if (d < -0.1) return 0;
      return q < 1.2 ? P(d > 0.3 ? '#8fd0ff' : '#3f6fc0') : (d > 0.3 && dith(ix, iy) < 0.5 ? P('#2c4a9c') : 0);
    }
    const nzz = Math.sqrt(1 - rr), d = dx * SUN[0] + dy * SUN[1] + nzz * SUN[2];
    const lon = Math.atan2(dx, nzz) + 0.9, lat = Math.asin(clp(dy, -1, 1)), u = lon * 1.5, v = lat * 1.5;
    const warp = fbm(u * 1.2 + 3, v * 1.2, 21, 3);
    const cl = fbm(u * 2.1 + warp * 1.8, v * 3.6 - warp * 1.1 + 5, 31, 4);
    const land = fbm(u * 1.5 + 7, v * 1.5 + 2, 41, 4);
    const k = clp(d * 1.05 + 0.1, 0, 1);
    if (cl > 0.58) return band(CL, k * (0.72 + (cl - 0.58) * 2.4), ix, iy);
    if (land > 0.54) return d < -0.02 && hs(ix * 7.1 + iy * 3.3) > 0.88 ? P('#c98a16') : band(LA, k * 0.95, ix, iy);
    return band(OC, k * 0.88 + (nzz < 0.4 && d > 0.2 ? 0.1 : 0) + (fbm(u * 3 + 1, v * 3, 51, 2) - 0.5) * 0.12, ix, iy);
  }, 0, 0, EO * 2, EO * 2);
  BK.earth = px.canvas();
  BK.air = halo(46, '#4f9dff', 0.22);
  // the Moon
  const M = MOON.r, mp = new Pix(0, 0, M * 2 + 2, M * 2 + 2), MC = MOONC.map(c => P(c));
  mp.shape((x, y) => Math.hypot(x - M - 1, y - M - 1) <= M, (x, y, ix, iy) => {
    const dx = (x - M - 1) / M, dy = (y - M - 1) / M, nzz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
    const d = dx * SUN[0] + dy * SUN[1] + nzz * SUN[2], cr = fbm(x / 2.6 + 9, y / 2.6 + 4, 77, 2);
    return band(MC, clp(d * 1.1 + 0.08, 0, 1) * (cr < 0.42 ? 0.72 : 1), ix, iy);
  }, 0, 0, M * 2 + 2, M * 2 + 2);
  BK.moon = mp.canvas();
  // far away: a tiny eye saucer hauling a cow up from the Earth (the only green here: clearly background, 11 px)
  const sp = new Pix(-6, -3, 13, 13), GR = ['#12502a', '#2fae44', '#62d64f'];
  for (let j = 0; j < 6; j++) for (let i = -1 - (j >> 1); i <= 1 + (j >> 1); i++) sp.dot(i, 2 + j, P('#9dff4a', 120 - j * 12));
  sp.rect(-1, 7, 3, 2, P(COWC[2])); sp.dot(1, 7, P(CREAM)); sp.dot(-2, 7, P(COWC[1]));
  sp.rect(-4, 0, 9, 1, P(GR[2])); sp.rect(-5, 1, 11, 1, P(GR[1])); sp.rect(-3, 2, 7, 1, P(GR[0]));
  sp.rect(-2, -2, 5, 2, P('#74d3ee')); sp.dot(-2, -2, P('#dff9ff')); sp.dot(-5, 1, P(AMB)); sp.dot(5, 1, P(AMB));
  BK.saucer = sp.canvas();
}
function drawBG(g, cx) {
  const t = G.t, c = clp(cx, CAM0 - 60, CAM1 + 20);
  const sx = -11 - Math.round((clp(c, CAM0, CAM1) - CAM0) * PS);
  g.drawImage(BK.space, sx, -10);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < TWINK.length; i++) {
    if ((Math.floor(t / 9) + i * 5) % 7) continue;
    const x = TWINK[i][0] + sx, y = TWINK[i][1] - 10;
    if (x > -4 && x < W + 4) { g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5); }
  }
  // now and then a shooting star
  const sk = Math.floor(t / 520), sp = t % 520;
  if (sp < 22) {
    const x0 = 60 + hs(sk * 3.7) * (W - 120), y0 = 44 + hs(sk * 9.1) * 70;
    for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(220,232,255,' + ((1 - i / 7) * (1 - sp / 22)).toFixed(3) + ')'; g.fillRect(Math.round(x0 + sp * 4 - i * 3), Math.round(y0 + sp * 1.8 - i * 1.35), 2, 1); }
  }
  // the Earth's layer
  // (not before the camera is inside the bridge: until then the wall hides it anyway, and the space walk has its own Earth)
  if (cx < 4960) return;
  const o = Math.round((AR - c) * PE), ex = EARTH.x + o, mx = MOON.x + o;
  if (ex > -70 && ex < W + 70) {
    g.drawImage(BK.earth, ex - EO, EARTH.y - EO);
    const ga = g.globalAlpha;
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = ga * (0.85 + 0.15 * Math.sin(t * 0.02));
    g.drawImage(BK.air.img, ex - 22 - BK.air.o, EARTH.y - 16 - BK.air.o);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = ga;
  }
  if (mx > -20 && mx < W + 20) g.drawImage(BK.moon, mx - MOON.r - 1, MOON.y - MOON.r - 1);
  // the two saucers: one hangs by the Earth, one climbs slowly away with its cow, again and again
  const u = (t % 1500) / 1500;
  g.drawImage(BK.saucer, ex + 62 - 6, 74 - 3 + Math.round(Math.sin(t * 0.03) * 1.5));
  const ga0 = g.globalAlpha;
  g.globalAlpha = ga0 * Math.min(1, u * 14);
  g.drawImage(BK.saucer, ex + 72 - 6 + Math.round(u * 30), 118 - 3 - Math.round(u * 96));
  g.globalAlpha = ga0;
}

// =====================================================================================================================
// THE ROOM (world space, painted once into one strip, x 5000-6412)
// =====================================================================================================================
let WP = null;                                           // the wall buffer while it is being painted
const CONES = [5092, 5336, 5586];                        // ceiling lamps of the corridor
const RIBS = [5130, 5290, 5372, 5532, 5640, 5866];        // the ribs between the bays
const BLINKS = [];                                       // live lamps: [x, y, colour, phase]
const LAMPS = [];                                        // soft lights on the wall: [x, y, kind]
// ---- shared structure -----------------------------------------------------------------------------------------------
function ceiling(w, x0, x1) {
  const n = x1 - x0;
  w.rect(x0, -10, n, 12, s[0]); w.rect(x0, 2, n, 34, s[2]);
  w.rect(x0, 8, n, 1, s[4]); w.rect(x0, 9, n, 3, s[3]); w.rect(x0, 12, n, 2, s[1]);
  w.rect(x0, 22, n, 1, s[4]); w.rect(x0, 23, n, 1, s[0]);
  w.rect(x0, 29, n, 4, s[0]);
  w.rect(x0, 36, n, 1, s[3]); w.rect(x0, 37, n, 3, s[1]);
  for (let x = x0; x < x1; x++) {
    const u = x - 5896, sm = mod(u, 60);
    if (sm < 2) { w.rect(x, 2, 1, 6, sm ? s[3] : s[0]); w.rect(x, 14, 1, 8, sm ? s[3] : s[0]); w.rect(x, 24, 1, 5, sm ? s[3] : s[0]); w.rect(x, 33, 1, 3, sm ? s[3] : s[0]); }
    if (mod(u, 44) < 3) w.rect(x, 8, 1, 6, s[4]);
    if (mod(u, 30) < 24) { w.dot(x, 30, P(CYAN)); w.dot(x, 31, P(CY1)); }
  }
}
// the sill under the windows; in the corridor the same band runs on as a rail
function rail(w, x0, x1) {
  const n = x1 - x0;
  w.rect(x0, 150, n, 1, s[5]); w.rect(x0, 151, n, 1, s[4]); w.rect(x0, 152, n, 5, s[3]);
  for (let x = x0; x < x1; x++) if (mod(x - 5896, 36) === 0) w.rect(x, 152, 1, 5, s[1]);
  w.rect(x0, 157, n, 1, s[2]); w.rect(x0, 158, n, 1, s[0]);
}
// the wall from the sill down to the deck: dark panels, a seam, vent slots, a dim magenta guide strip low
function lowerWall(w, x0, x1) {
  for (let x = x0; x < x1; x++) {
    const u = x - 5896, pm = mod(u, 48), pid = Math.floor(u / 48);
    if (pm < 2) { w.rect(x, 159, 1, 63, pm ? s[2] : s[0]); continue; }
    w.rect(x, 159, 1, 63, P(hs(pid * 3.7) > 0.5 ? S[1] : WALLL));
    w.dot(x, 188, s[0]); w.dot(x, 189, s[2]);
    const on = mod(u, 24) < 17;
    w.dot(x, 208, on ? P(MG1) : s[0]); w.dot(x, 209, on ? P(MG0) : s[0]);
    if (mod(pid, 3) === 1 && pm > 10 && pm < 38) for (let y = 195; y < 204; y += 3) w.dot(x, y, s[0]);
  }
}
function corridorBase(w, x0, x1) {
  const n = x1 - x0;
  for (let x = x0; x < x1; x++) {
    const u = x - 5896, pm = mod(u, 48), pid = Math.floor(u / 48);
    w.rect(x, 40, 1, 110, pm === 0 ? s[0] : pm === 1 ? s[2] : P(hs(pid * 5.3 + 1) > 0.5 ? WU0 : WU1));
    if (pm === 5 || pm === 44) for (const y of [56, 95, 106, 145]) w.dot(x, y, s[3]);
  }
  w.rect(x0, 40, n, 2, s[0]);
  // a cable duct under the ceiling, clamps
  w.rect(x0, 43, n, 1, s[3]); w.rect(x0, 44, n, 4, s[2]); w.rect(x0, 48, n, 1, s[0]);
  for (let x = x0; x < x1; x++) if (mod(x - 5896, 32) < 2) w.rect(x, 43, 1, 6, s[3]);
  w.rect(x0, 100, n, 1, s[0]); w.rect(x0, 101, n, 1, s[2]);
  rail(w, x0, x1); lowerWall(w, x0, x1);
  // ceiling lamps (their cones of light are live)
  for (const x of CONES) { w.rect(x - 7, 36, 14, 5, s[0]); w.rect(x - 6, 36, 12, 4, s[3]); w.rect(x - 6, 36, 12, 1, s[4]); w.rect(x - 4, 40, 8, 2, P('#9fd8f0')); w.rect(x - 4, 40, 8, 1, P('#dff6ff')); }
}
// a rib between two bays: a pilaster from the ceiling to the deck
function rib(w, x) {
  w.rect(x, 36, 8, 186, s[2]); w.rect(x, 36, 1, 186, s[4]); w.rect(x + 1, 36, 1, 186, s[3]); w.rect(x + 6, 36, 1, 186, s[1]); w.rect(x + 7, 36, 1, 186, s[0]);
  w.rect(x - 2, 36, 12, 6, s[3]); w.rect(x - 2, 36, 12, 1, s[4]); w.rect(x - 2, 41, 12, 1, s[0]);
  w.rect(x - 2, 150, 12, 9, s[3]); w.rect(x - 2, 150, 12, 1, s[5]); w.rect(x - 2, 158, 12, 1, s[0]);
  w.rect(x - 2, 211, 12, 11, s[3]); w.rect(x - 2, 211, 12, 1, s[4]);
  for (let y = 60; y < 206; y += 26) { if (y > 140 && y < 164) continue; w.dot(x + 3, y, s[5]); w.dot(x + 4, y, s[4]); w.dot(x + 3, y + 1, s[0]); w.dot(x + 4, y + 1, s[0]); }
}
// a window: glass (left clear: the backdrop shows) between bevelled struts, chamfered panes, faint reflections
function paintWindow(w, struts, Y0, Y1, ch, bx0, bx1, by0, by1, shade) {
  const glass = (x, y) => {
    if (y < Y0 || y >= Y1) return false;
    for (let i = 0; i < struts.length - 1; i++) {
      const a = struts[i] + 5, b = struts[i + 1] - 5;
      if (x < a || x >= b) continue;
      return Math.min(x - a, b - x) + Math.min(y - Y0, Y1 - y) >= ch;
    }
    return false;
  };
  const tintC = hex('#2a3a8a'), refl = P('#9fb4ee', 16), edge = P(S[0], 150);
  for (let iy = by0; iy < by1; iy++) for (let ix = bx0; ix < bx1; ix++) {
    const x = ix + 0.5, y = iy + 0.5;
    let c;
    if (glass(x, y)) {
      const st = mod(ix - AR + iy * 0.7, 96);
      if (!glass(x - 1, y) || !glass(x, y - 1)) c = edge;
      else if (st < 7 || (st > 14 && st < 17)) c = refl;
      else {
        // a cool tint at the top of the pane; the corridor's panes are a little smoked as well (shade)
        const a1 = y < Y0 + 24 ? (Y0 + 24 - y) * 1.6 : 0, a2 = shade || 0, k = a1 + a2 ? a1 / (a1 + a2) : 0;
        c = a1 + a2 ? pk(Math.round(14 + (tintC[0] - 14) * k), Math.round(12 + (tintC[1] - 12) * k), Math.round(30 + (tintC[2] - 30) * k), Math.round(a1 + a2)) : 0;
      }
    } else if (y < Y0 || y >= Y1) continue;
    else if (glass(x + 2, y)) c = s[0];
    else if (glass(x, y + 2)) c = s[1];
    else if (glass(x - 2, y)) c = s[5];
    else if (glass(x, y - 2)) c = s[5];
    else {
      c = s[2];
      for (const sx of struts) if (Math.abs(x - sx) < 5) {
        c = Math.abs(ix - sx) < 1 && mod(iy, 18) === 9 ? s[5] : Math.abs(ix - sx) < 1 && mod(iy, 18) === 10 ? s[0] : ix < sx - 2 ? s[4] : ix > sx + 1 ? s[2] : s[3];
        break;
      }
    }
    w.dot(ix, iy, c);
  }
}
// a small screen: dark glass, glyph rows in dim cyan (or the green eye mark)
function screen(w, x, y, sw, sh, g, eye) {
  w.rect(x - 1, y - 1, sw + 2, sh + 2, s[3]); w.rect(x - 1, y - 1, sw + 2, 1, s[4]); w.rect(x, y, sw, sh, P(SCRN));
  if (eye) { const ex = x + ((sw - 5) >> 1), ey = y + ((sh - 5) >> 1); glyph5(w, ex, ey, 7, P(GRN)); w.dot(ex + 2, ey + 2, P(GRNL)); return; }
  if (g < 0) return;
  glyph5(w, x + 2, y + 1, g, P(CY1));
  for (let j = 0; j < sh - 2; j += 2) { const n = 2 + Math.floor(hs(x * 3.1 + j * 7.7) * (sw - 11)); if (sw > 12) w.rect(x + 9, y + 1 + j, Math.max(1, n), 1, P(j % 4 ? CY0 : CY1)); }
}
// a dark console against the back wall: a slanted key panel, a body with a kick plate, a screen on a neck
function desk(w, x, wd, top, o) {
  w.rect(x, top, wd, 1, s[4]); w.rect(x, top + 1, wd, 3, s[3]); w.rect(x, top + 4, wd, 1, s[0]);
  for (let i = 0; i < Math.floor((wd - 4) / 3); i++) w.dot(x + 2 + i * 3, top + 2, P([AM0, MG0, CY0, S[1], AM0, CY0, S[1]][(i + x) % 7]));
  w.rect(x + 1, top + 5, wd - 2, DECK - top - 5, s[2]); w.rect(x + 1, top + 5, 1, DECK - top - 5, s[3]); w.rect(x + wd - 2, top + 5, 1, DECK - top - 5, s[0]);
  w.rect(x + 1, DECK - 5, wd - 2, 5, s[0]); w.rect(x + 4, top + 9, wd - 8, 1, s[1]); w.rect(x + 4, top + 10, wd - 8, 1, s[3]);
  BLINKS.push([x + wd - 5, top + 13, o.lamp || AMB, x % 13]);
  if (o.scr) { const sw = o.sw || 14, sx = x + (wd >> 1) - (sw >> 1); w.rect(x + (wd >> 1) - 1, top - 4, 2, 4, s[3]); screen(w, sx, top - 14, sw, 9, o.g || 0, o.eye); return [sx, top - 14]; }
  return null;
}
// an oggle-sized swivel chair (back: -1 / 1 = which side its little backrest is on; 0 = a stool)
function chair(w, x, back) {
  w.rect(x - 4, 216, 8, 2, s[0]); w.rect(x - 1, 204, 2, 12, s[3]); w.dot(x - 1, 204, s[4]);
  w.rect(x - 5, 201, 10, 3, P(MG0)); w.rect(x - 5, 201, 10, 1, P(MG1)); w.dot(x - 6, 202, P(MG0)); w.dot(x + 5, 202, P(MG0));
  if (!back) return;
  const bx = back < 0 ? x - 7 : x + 4;
  w.rect(bx, 189, 3, 11, P(MG0)); w.rect(bx, 189, 3, 1, P(MG1)); w.rect(back < 0 ? bx : bx + 2, 190, 1, 9, P('#4c1c44')); w.rect(bx + 1, 200, 1, 2, s[3]);
}
// depth for the corridor wall: a shadow under the ceiling duct, a darker foot, a shadow beside each rib
function wallShade(w) {
  for (let j = 0; j < 9; j++) w.tint(5012, 49 + j, 884, 1, s[0], 0.42 * (1 - j / 9));
  for (let j = 0; j < 8; j++) w.tint(5012, 210 + j, 862, 1, s[0], 0.05 + 0.035 * j);
  for (const x of RIBS) { w.tint(x + 8, 42, 2, 108, s[0], 0.3); w.tint(x + 8, 159, 2, 52, s[0], 0.3); }
}
// ---- 5000 AIRLOCK LOBBY --------------------------------------------------------------------------------------------
const CHEV = [5070, 115];
function porthole(w, cx, cy, r) {
  const X = cx + 0.5, Y = cy + 0.5;
  w.shape((x, y) => (x - X) ** 2 + (y - Y) ** 2 <= (r + 5.5) ** 2, (x, y) => {
    const dx = x - X, dy = y - Y, d = Math.hypot(dx, dy), l = (-dx * 0.6 - dy * 0.8) / (d || 1);
    if (d > r + 4.5) return s[0];
    if (d > r + 1) return l > 0.45 ? s[5] : l > -0.3 ? s[4] : s[2];
    return s[0];
  }, cx - r - 6, cy - r - 6, cx + r + 8, cy + r + 8);
  // its glass is painted (deep space, a few stars), not left clear: the backdrop behind it is still crossfading with
  // the space walk's while the hero stands in the lobby
  w.shape((x, y) => (x - X) ** 2 + (y - Y) ** 2 <= r * r, (x, y, ix, iy) => band(SPK, 0.35 + (y - Y) / r * 0.3 + (x - X) / r * 0.15, ix, iy, 0.5), cx - r - 1, cy - r - 1, cx + r + 2, cy + r + 2);
  for (let i = 0; i < 9; i++) { const a = hs(i * 4.1 + cx) * 6.283, d = Math.sqrt(hs(i * 2.3 + 7)) * (r - 2), k = hs(i * 9.7); w.dot(Math.round(X + Math.cos(a) * d - 0.5), Math.round(Y + Math.sin(a) * d - 0.5), P(k > 0.7 ? '#d4dcff' : k > 0.35 ? '#7a80b4' : '#4a4f82')); }
  w.shape((x, y) => { const d = Math.hypot(x - X, y - Y); return d <= r && d > r - 1.2; }, P('#0a0918'), cx - r - 1, cy - r - 1, cx + r + 2, cy + r + 2);
  w.shape((x, y) => { const d = Math.hypot(x - X, y - Y); return d <= r - 2 && d > r - 4.2 && (x - X) + (y - Y) < -r * 0.75; }, P('#5a6aa8'), cx - r, cy - r, cx + r, cy + r);
  w.tint(cx - r, cy - r, r * 2 + 1, Math.round(r * 0.6), P('#2a3a8a'), 0.16);
  for (let k = 0; k < 8; k++) { const a = (k * 45 + 22.5) * DEG, bx = Math.round(X + Math.cos(a) * (r + 2.8) - 0.5), by = Math.round(Y + Math.sin(a) * (r + 2.8) - 0.5); w.dot(bx, by, s[6]); w.dot(bx + 1, by + 1, s[0]); }
}
// a spare glass bubble (the oggles' space helmets), standing on its steel collar
function bubble(w, cx, cy) {
  const X = cx + 0.5, Y = cy + 0.5;
  w.shape((x, y) => { const d = Math.hypot(x - X, y - Y); return d <= 6.3 && d > 5.1 && y < Y + 5; }, (x, y) => (x - X) + (y - Y) < -2 ? P(CY1) : P(CY0), cx - 7, cy - 7, cx + 8, cy + 6);
  w.dot(cx - 3, cy - 3, P('#8fd0e0')); w.dot(cx - 4, cy - 2, P('#8fd0e0')); w.dot(cx - 2, cy - 4, P('#5fa8bc'));
  w.rect(cx - 4, cy + 5, 9, 2, s[4]); w.rect(cx - 4, cy + 5, 9, 1, s[5]);
}
function locker(w, x, open) {
  w.rect(x, 162, 22, 56, s[0]); w.rect(x + 1, 163, 20, 55, s[2]); w.rect(x + 1, 163, 20, 1, s[3]); w.rect(x + 20, 164, 1, 54, s[1]);
  if (!open) {
    for (let j = 0; j < 3; j++) w.rect(x + 5, 168 + j * 3, 12, 1, s[0]);
    w.rect(x + 17, 188, 2, 6, s[4]); w.rect(x + 4, 180, 9, 3, P('#3e3210')); w.rect(x + 4, 180, 5, 1, P(AM0));
    w.rect(x + 1, 206, 20, 1, s[1]);
    return;
  }
  w.rect(x + 2, 164, 18, 54, P('#0a0a18')); w.rect(x + 2, 184, 18, 1, s[3]); w.rect(x + 2, 185, 18, 1, s[0]);
  bubble(w, x + 11, 176);
  w.rect(x + 10, 188, 1, 4, s[4]); w.rect(x + 6, 192, 9, 12, s[3]); w.rect(x + 6, 192, 9, 1, s[5]); w.rect(x + 9, 195, 3, 3, P(AM0)); w.rect(x + 6, 204, 4, 8, s[3]); w.rect(x + 11, 204, 4, 8, s[3]);
  w.rect(x + 5, 212, 5, 4, s[4]); w.rect(x + 11, 212, 5, 4, s[4]);
  w.rect(x - 3, 162, 3, 56, s[3]); w.rect(x - 3, 162, 1, 56, s[4]); w.rect(x - 4, 162, 1, 56, s[0]);
}
function bayAirlock(w) {
  // the outer hull in section (the coordinator's door frame stands over most of it)
  w.rect(5000, -10, 2, 232, s[6]); w.rect(5002, -10, 7, 232, s[4]); w.rect(5009, -10, 2, 232, s[2]); w.rect(5011, -10, 1, 232, s[0]);
  for (let y = -4; y < 218; y += 12) { w.dot(5005, y, s[6]); w.dot(5005, y + 1, s[1]); }
  // heavier plating than the rest of the corridor, a hazard band low on the wall: this is still the airlock
  for (const y of [66, 132]) { w.rect(5012, y, 118, 1, s[0]); w.rect(5012, y + 1, 118, 1, s[3]); for (let x = 5020; x < 5128; x += 12) w.dot(x, y + 4, s[3]); }
  for (let y = 211; y < 217; y++) for (let x = 5012; x < 5130; x++) w.dot(x, y, P(((x + y) >> 2) % 2 ? AM0 : HZ0));
  w.rect(5012, 210, 118, 1, s[0]); w.rect(5012, 217, 118, 1, s[0]);
  porthole(w, 5092, 82, 13);
  // the way to the bridge: a chevron sign (one chevron at a time lights up, live)
  w.rect(5062, 111, 60, 15, s[3]); w.rect(5062, 111, 60, 1, s[4]); w.rect(5063, 112, 58, 13, P('#0a0a18'));
  for (let k = 0; k < 5; k++) chevron(w, CHEV[0] + k * 10, CHEV[1], P('#4a3a10'));
  for (let i = 0; i < 3; i++) locker(w, 5056 + i * 24, i === 1);
  for (const hx of [5088, 5106, 5122]) bubble(w, hx, 143);
  // a pressure dial by the door
  w.ell(5052, 138, 6.2, 6.2, s[0]); w.ell(5052, 138, 5.2, 5.2, (x, y) => x + y < 10188 ? s[5] : s[3]); w.ell(5052, 138, 3.6, 3.6, P('#0a0a18')); w.line(5051, 137, 5053, 135, P(AM1)); w.dot(5051, 138, s[6]);
}
function chevron(w, x, y, c) { for (let j = 0; j < 4; j++) { w.rect(x + j, y + j, 2, 1, c); w.rect(x + j, y + 6 - j, 2, 1, c); } }
// ---- 5138 HALL OF FAME ---------------------------------------------------------------------------------------------
// a bust of one of the earlier missions' bosses in a 28 x 26 picture (x, y = its top left corner)
function bust(w, kind, x, y) {
  const cx = x + 14;
  const sh = (X, Y, rx, ry, pal) => (px, py) => { const l = -(px - X) / rx * 0.5 - (py - Y) / ry * 0.75; return P(pal[l > 0.55 ? 3 : l > 0.05 ? 2 : l > -0.5 ? 1 : 0]); };
  for (let j = 0; j < 26; j++) w.rect(x, y + j, 28, 1, P(j < 9 ? '#1a2242' : j < 18 ? '#161c3a' : '#121630'));
  const ST = ['#3a4052', '#5a6274', '#8a94a8', '#c0c8d6'];
  if (kind === 0) {                                      // MEGA CRAB: red shell, two yellow eyes on stalks, claws up
    const RD = ['#5e1414', '#9a221c', '#cf3a2a', '#f06a50'];
    for (const sd of [-1, 1]) { w.line(cx + sd * 7, y + 21, cx + sd * 12, y + 25, P(ST[1])); w.line(cx + sd * 3, y + 22, cx + sd * 5, y + 25, P(ST[0])); }
    for (const sd of [-1, 1]) {
      const kx = cx + sd * 10;
      w.line(cx + sd * 6, y + 17, kx, y + 12, P(ST[1]));
      // a pincer, open upward: two prongs on a round palm
      w.rect(kx - 2, y + 8, 5, 3, P(RD[1])); w.rect(kx - 1, y + 11, 3, 1, P(RD[0]));
      w.rect(kx - 3, y + 4, 2, 5, P(RD[2])); w.dot(kx - 3, y + 3, P(RD[2])); w.dot(kx - 3, y + 4, P(RD[3])); w.dot(kx - 2, y + 3, P(RD[3]));
      w.rect(kx + 2, y + 4, 2, 5, P(RD[1])); w.dot(kx + 3, y + 3, P(RD[2])); w.dot(kx + 2, y + 4, P(RD[2]));
      w.dot(kx - 1, y + 6, P('#f4f4f4')); w.dot(kx + 1, y + 6, P('#f4f4f4')); w.dot(kx, y + 7, P(RD[0]));
    }
    w.ell(cx, y + 19, 9.5, 5.5, sh(cx, y + 19, 9.5, 5.5, RD));
    w.rect(cx - 8, y + 22, 16, 1, P(ST[1])); w.rect(cx - 7, y + 23, 14, 1, P(ST[0]));
    for (const ex of [cx - 4, cx + 2]) { w.rect(ex, y + 9, 1, 6, P(ST[2])); w.rect(ex - 1, y + 5, 4, 4, P('#ffd23f')); w.rect(ex - 1, y + 5, 4, 1, P('#fff2a8')); w.rect(ex + 1, y + 7, 2, 2, P('#1a1010')); }
    w.rect(cx - 1, y + 18, 3, 3, P('#3a1010')); w.rect(cx, y + 19, 1, 1, P('#ffb040'));
    plaster(w, cx + 4, y + 15);
  } else if (kind === 1) {                               // MEGA BEAR: brown head, round ears, a steel muzzle, yellow eyes
    const BR = ['#4a2a12', '#7a4a20', '#a8682c', '#cc8c48'];
    w.ell(cx, y + 26, 13, 7, sh(cx, y + 26, 13, 7, BR));
    for (const sd of [-1, 1]) { w.ell(cx + sd * 7.5, y + 5.5, 3.6, 3.6, P(BR[1])); w.ell(cx + sd * 7.5, y + 5.5, 1.8, 1.8, P(ST[1])); }
    w.ell(cx, y + 13, 9.6, 8.6, sh(cx, y + 13, 9.6, 8.6, BR));
    w.ell(cx, y + 17, 5.2, 3.8, sh(cx, y + 17, 5.2, 3.8, ST));
    w.rect(cx - 2, y + 14, 4, 2, P('#141018')); w.rect(cx - 4, y + 18, 8, 1, P(ST[0])); w.rect(cx - 3, y + 19, 1, 1, P('#ffffff')); w.rect(cx + 2, y + 19, 1, 1, P('#ffffff'));
    for (const sd of [-1, 1]) { const ex = cx + sd * 5; w.rect(ex - 1, y + 10, 3, 2, P('#ffd23f')); w.dot(ex, y + 11, P('#1a1010')); w.line(ex - 2 * sd, y + 9, ex + 2 * sd, y + 8, P(BR[0])); }
    w.dot(cx - 8, y + 15, P(ST[3])); w.dot(cx + 8, y + 15, P(ST[2]));
    plaster(w, cx + 3, y + 5);
  } else if (kind === 2) {                               // MEGA WHALE SHARK: blue-grey, white dots, a pale jaw, a fin
    const BL = ['#1e2e48', '#314c74', '#476896', '#6a8ab6'];
    w.shape(polyIn([[x + 15, y + 9], [x + 21, y + 1], [x + 24, y + 9]]), (px, py) => P(px < x + 20 ? BL[2] : BL[1]), x + 14, y, x + 26, y + 10);
    w.ell(cx + 2, y + 15, 13, 8, sh(cx + 2, y + 15, 13, 8, BL));
    w.shape((px, py) => ((px - cx - 2) / 13) ** 2 + ((py - y - 15) / 8) ** 2 <= 1 && py > y + 18.5 - (px - x) * 0.06, (px, py) => P(py > y + 21 ? '#8a94a8' : '#c0c8d6'), x, y + 16, x + 28, y + 26);
    w.rect(x + 3, y + 18, 12, 1, P('#141a2c'));
    w.rect(x + 8, y + 13, 3, 3, P('#ffd23f')); w.dot(x + 9, y + 14, P('#1a1010'));
    for (const gx of [15, 17, 19]) w.rect(x + gx, y + 12, 1, 5, P(BL[0]));
    for (const [dx, dy] of [[5, 11], [12, 9], [14, 12], [20, 9], [23, 12], [22, 16], [25, 14], [18, 7], [9, 9], [26, 11]]) w.dot(x + dx, y + dy, P('#dfe8ff'));
    plaster(w, x + 12, y + 6);
  } else {                                               // MEGA OCTOPUS: a red dome, angry eyes, a glass top, tentacles
    const OR = ['#701c12', '#aa2c1a', '#da4626', '#fa7446'];
    for (const [tx, sd] of [[-9, -1], [-4, -1], [4, 1], [9, 1]]) { w.line(cx + tx, y + 20, cx + tx + sd * 2, y + 24, P(OR[1])); w.line(cx + tx + sd * 2, y + 24, cx + tx + sd * 4, y + 25, P(OR[1])); w.dot(cx + tx + sd, y + 22, P('#ff9ac0')); }
    w.ell(cx, y + 5, 4.6, 3.6, P('#3f8fb0')); w.rect(cx - 2, y + 3, 4, 3, P('#f07ab0')); w.dot(cx - 3, y + 3, P('#dff9ff'));
    w.ell(cx, y + 13, 9.4, 7.8, sh(cx, y + 13, 9.4, 7.8, OR));
    for (const sd of [-1, 1]) { const ex = cx + sd * 4; w.rect(ex - 2, y + 11, 4, 3, P('#2a0c0c')); w.rect(ex - 1, y + 12, 2, 2, P(RED)); w.line(ex - 2 * sd, y + 9, ex + 2 * sd, y + 11, P('#2a0c0c')); }
    for (let i = 0; i < 18; i++) w.rect(cx - 9 + i, y + 19, 1, 2, P(((i >> 1) & 1) ? AM1 : '#22222c'));
    w.rect(cx - 1, y + 16, 2, 2, P('#7a4ab0'));
    plaster(w, cx + 5, y + 7);
  }
}
function plaster(w, x, y) { for (let k = -2; k <= 2; k++) { w.dot(x + k, y + k, P('#f2e2c2')); w.dot(x + k, y - k, P('#f2e2c2')); } w.dot(x, y, P('#c8b28a')); }
const FAME = [5144, 5181, 5218, 5255];
function bayFame(w) {
  // the title
  w.rect(5173, 60, 78, 13, s[3]); w.rect(5173, 60, 78, 1, s[4]); w.rect(5174, 61, 76, 11, P('#0a0a18'));
  w.text('HALL OF FAME', 5177, 63, P(AM0));
  ['CRAB', 'BEAR', 'SHARK', 'OCTO'].forEach((nm, i) => {
    const x = FAME[i], y = 82;
    // a gold frame, its picture, a picture lamp above, the name plate below
    w.rect(x - 1, y - 1, 36, 34, s[0]);
    w.rect(x, y, 34, 32, P(AM0)); w.rect(x, y, 34, 1, P(AM1)); w.rect(x, y, 1, 32, P(AM1)); w.rect(x + 33, y + 1, 1, 31, P('#5a4410')); w.rect(x + 1, y + 31, 33, 1, P('#5a4410'));
    w.rect(x + 2, y + 2, 30, 28, P('#3a2c0a'));
    const pic = new Pix(0, 0, 28, 26); bust(pic, i, 0, 0); w.blit(pic, x + 3, y + 3);
    w.tint(x + 3, y + 3, 28, 26, P('#141230'), 0.3);
    w.tint(x + 3, y + 3, 28, 3, P('#fff2a8'), 0.1);
    w.rect(x + 13, y - 6, 8, 2, P(AM0)); w.rect(x + 13, y - 6, 8, 1, P(AM1)); w.rect(x + 16, y - 9, 2, 3, s[3]);
    LAMPS.push([x + 17, y - 3, 'pic']);
    w.rect(x + 1, y + 36, 32, 11, s[0]); w.rect(x + 2, y + 37, 30, 9, P('#241c0c')); w.rect(x + 2, y + 37, 30, 1, P('#4a3a10'));
    w.text(nm, x + 17 - nm.length * 3, y + 38, P(AM0));
  });
  relics(w);
}
// under the portraits: a glass case with what was left of them (a claw, a cog, a fin, a tentacle)
function relics(w) {
  const x0 = 5148, x1 = 5286, RD = ['#5e1414', '#9a221c', '#cf3a2a'], BL = ['#1e2e48', '#314c74', '#476896'], OR = ['#701c12', '#aa2c1a', '#da4626'], ST = ['#3a4052', '#5a6274', '#8a94a8'];
  w.rect(x0, 203, x1 - x0, 15, s[0]); w.rect(x0 + 1, 204, x1 - x0 - 2, 14, s[2]); w.rect(x0 + 1, 204, x1 - x0 - 2, 1, s[4]); w.rect(x0 + 1, 213, x1 - x0 - 2, 5, s[1]);
  for (let x = x0 + 8; x < x1 - 8; x += 12) w.rect(x, 208, 6, 1, P(mod(x, 24) < 12 ? AM0 : S[3]));
  w.rect(x0 + 2, 185, x1 - x0 - 4, 18, P('#15132c'));
  const cells = [5166, 5200, 5234, 5268];
  for (const cx of cells) { w.rect(cx - 3, 201, 7, 2, P(AM0)); w.rect(cx - 3, 201, 7, 1, P(AM1)); }
  // the Mega Crab's claw
  { const cx = cells[0]; w.rect(cx - 2, 196, 5, 5, P(RD[1])); w.rect(cx - 4, 189, 3, 8, P(RD[2])); w.rect(cx + 2, 190, 3, 7, P(RD[1])); w.dot(cx - 4, 189, P('#f06a50')); w.dot(cx - 1, 193, P('#f4f4f4')); w.dot(cx + 1, 193, P('#f4f4f4')); }
  // a cog of the Mega Bear
  { const cx = cells[1], cy = 194; for (let k = 0; k < 8; k++) { const a = k * 45 * DEG; w.rect(Math.round(cx + Math.cos(a) * 6) - 1, Math.round(cy + Math.sin(a) * 6) - 1, 2, 2, P(ST[1])); } w.ell(cx + 0.5, cy + 0.5, 5.2, 5.2, (x, y) => P(x + y < cx + cy - 2 ? ST[2] : ST[1])); w.ell(cx + 0.5, cy + 0.5, 2, 2, P('#15132c')); }
  // the Mega Whale Shark's fin
  { const cx = cells[2]; w.shape(polyIn([[cx - 6, 201], [cx + 3, 187], [cx + 6, 201]]), (x, y) => P(x < cx ? BL[2] : BL[1]), cx - 7, 186, cx + 8, 202); w.dot(cx, 195, P('#dfe8ff')); w.dot(cx + 2, 198, P('#dfe8ff')); w.dot(cx - 2, 199, P('#dfe8ff')); }
  // a tentacle of the Mega Octopus, curled up
  { const cx = cells[3]; for (let k = 0; k <= 22; k++) { const a = k * 0.32, r = 6.5 - k * 0.22, x = Math.round(cx + Math.cos(a + 1.6) * r), y = Math.round(195 + Math.sin(a + 1.6) * r * 0.9); w.rect(x, y, 2, 2, P(k < 8 ? OR[2] : OR[1])); if (k % 4 === 1) w.dot(x, y + 1, P('#ff9ac0')); } w.rect(cx - 1, 199, 3, 2, P(OR[1])); }
  w.tint(x0 + 2, 185, x1 - x0 - 4, 16, P('#15132c'), 0.3);
  // the glass hood: its frame, a pane line between the pieces, a faint shine
  w.rect(x0 + 1, 184, x1 - x0 - 2, 1, s[4]); w.rect(x0 + 1, 185, 1, 18, s[3]); w.rect(x1 - 2, 185, 1, 18, s[3]);
  for (const dx of [5183, 5217, 5251]) w.rect(dx, 185, 1, 18, s[2]);
  for (const cx of cells) for (let k = 0; k < 9; k++) { w.tint(cx - 12 + k, 198 - k, 1, 2, P('#9fb4ee'), 0.16); }
}
// ---- 5298 SERVICE BAY ----------------------------------------------------------------------------------------------
const POSTER = [5316, 80];
function bayService(w) {
  for (const px of [5302, 5308]) { w.rect(px, 49, 4, 101, s[3]); w.rect(px, 49, 1, 101, s[4]); w.rect(px + 3, 49, 1, 101, s[1]); for (const y of [70, 104, 138]) { w.rect(px - 1, y, 6, 3, s[4]); w.rect(px - 1, y + 2, 6, 1, s[1]); } }
  // a valve wheel
  w.shape((x, y) => { const d = Math.hypot(x - 5307, y - 122); return d <= 6 && d > 4; }, (x, y) => P(y < 121 ? '#8a3040' : '#5e2030'), 5300, 115, 5314, 129);
  w.rect(5303, 121, 8, 1, P('#5e2030')); w.rect(5306, 118, 1, 8, P('#5e2030')); w.rect(5306, 121, 2, 2, s[5]);
  // a vent
  w.rect(5322, 50, 42, 20, s[0]); w.rect(5323, 51, 40, 18, s[2]);
  for (let j = 0; j < 5; j++) { w.rect(5325, 53 + j * 3, 36, 1, s[0]); w.rect(5325, 54 + j * 3, 36, 1, s[3]); }
  // the WANTED poster: paper, the word, a photo box (the hero's own head is drawn live), the reward
  const [x, y] = POSTER;
  w.rect(x - 1, y - 1, 42, 48, s[0]); w.rect(x, y, 40, 46, P('#9c9078')); w.rect(x, y, 40, 1, P('#b8ac90')); w.rect(x + 39, y + 1, 1, 45, P('#8a7e64')); w.rect(x, y + 45, 40, 1, P('#8a7e64'));
  w.text('WANTED', x + 3, y + 3, P('#a02820'));
  w.rect(x + 9, y + 12, 22, 20, P('#5a4e3a')); w.rect(x + 10, y + 13, 20, 18, P('#c8bda2'));
  cowIcon(w, x + 6, y + 37, 1, true); w.text('X99', x + 18, y + 36, P('#5a4e3a'));
  w.dot(x + 2, y + 2, s[5]); w.dot(x + 37, y + 2, s[5]); w.dot(x, y + 45, s[0]); w.dot(x + 39, y + 45, s[0]);
  // a fuse box low on the wall
  w.rect(5344, 166, 16, 18, s[0]); w.rect(5345, 167, 14, 16, s[2]); w.rect(5345, 167, 14, 1, s[3]); w.rect(5347, 170, 2, 5, s[0]); w.rect(5351, 170, 2, 5, s[0]); w.rect(5355, 170, 2, 5, s[0]);
  BLINKS.push([5347, 178, AMB, 4]); BLINKS.push([5355, 178, CYAN, 9]);
}
// ---- 5380 STAR MAP ROOM --------------------------------------------------------------------------------------------
const MAP = { x: 5386, y: 60, w: 136, h: 76 };
const mapRoute = u => { const a = [26, 50], b = [66, 4], c = [106, 34], v = 1 - u; return [MAP.x + v * v * a[0] + 2 * v * u * b[0] + u * u * c[0], MAP.y + v * v * a[1] + 2 * v * u * b[1] + u * u * c[1]]; };
const ORR = [5458, 175];
function bayMap(w) {
  const { x, y } = MAP;
  w.rect(x - 4, y - 4, MAP.w + 8, MAP.h + 8, s[0]); w.rect(x - 3, y - 3, MAP.w + 6, MAP.h + 6, s[3]); w.rect(x - 3, y - 3, MAP.w + 6, 1, s[4]); w.rect(x - 1, y - 1, MAP.w + 2, MAP.h + 2, s[0]);
  w.rect(x, y, MAP.w, MAP.h, P(SCRN));
  for (let gx = 17; gx < MAP.w; gx += 17) w.rect(x + gx, y, 1, MAP.h, P('#0b1430'));
  for (let gy = 19; gy < MAP.h; gy += 19) w.rect(x, y + gy, MAP.w, 1, P('#0b1430'));
  for (let i = 0; i < 46; i++) { const k = hs(i * 2.71 + 4); w.dot(x + 2 + Math.floor(hs(i * 5.3 + 1) * (MAP.w - 4)), y + 2 + Math.floor(hs(i * 9.7 + 2) * (MAP.h - 4)), P(k > 0.8 ? '#7fa8c8' : k > 0.4 ? CY0 : '#15405a')); }
  // constellations
  const CON = [[[14, 14], [26, 22], [40, 14], [50, 28], [38, 38]], [[76, 54], [90, 62], [108, 56], [122, 66]], [[84, 12], [98, 8], [112, 14]]];
  for (const cn of CON) {
    for (let i = 1; i < cn.length; i++) w.line(x + cn[i - 1][0], y + cn[i - 1][1], x + cn[i][0], y + cn[i][1], P('#12405a'));
    for (const [a, b] of cn) { w.rect(x + a - 1, y + b, 3, 1, P(CY0)); w.rect(x + a, y + b - 1, 1, 3, P(CY0)); w.dot(x + a, y + b, P(CY1)); }
  }
  // the route home -> Earth, dotted
  for (let k = 0; k <= 28; k++) { const [rx, ry] = mapRoute(k / 28); w.dot(Math.round(rx), Math.round(ry), P(AM0)); }
  // home: a ringed planet with the eye mark beside it
  w.ell(x + 20.5, y + 54.5, 6, 6, (px, py) => P(px + py < x + y + 73 ? MG1 : MG0)); w.line(x + 10, y + 58, x + 31, y + 51, P('#b08a3a')); w.rect(x + 17, y + 53, 7, 3, P(MG1));
  glyph5(w, x + 6, y + 66, 7, P(GRN)); glyph5(w, x + 14, y + 66, 1, P(CY0)); glyph5(w, x + 21, y + 66, 5, P(CY0));
  // the Earth, a cow beside it (that is why they came)
  w.ell(x + 114.5, y + 34.5, 8, 8, (px, py) => P(px + py < x + y + 144 ? '#2c70c6' : '#143c86')); w.rect(x + 111, y + 30, 5, 3, P('#8a7a5c')); w.rect(x + 115, y + 36, 4, 3, P('#8a7a5c')); w.rect(x + 109, y + 37, 3, 2, P('#6a82ba'));
  cowIcon(w, x + 108, y + 48, 1, true);
  [0, 9, 2].forEach((g, i) => glyph5(w, x + 100 + i * 7, y + 18, g, P(CY0)));
  // a caption strip under the chart
  w.rect(x + 20, y + MAP.h + 6, 96, 7, P('#0a0a18'));
  [3, 0, 8, 1, 10, 2, 5, 9, 0, 4, 11, 6].forEach((g, i) => glyph5(w, x + 24 + i * 7, y + MAP.h + 7, g, P(i % 4 === 1 ? CY1 : CY0)));
  // the plotting table: a faintly lit top (kept dark: it is not a platform), two legs; the orrery on it is drawn live
  w.rect(5426, 187, 66, 1, P(CY0)); w.rect(5426, 188, 66, 3, s[2]); w.rect(5426, 191, 66, 1, s[0]);
  w.rect(5432, 192, 5, 26, s[2]); w.rect(5432, 192, 1, 26, s[3]); w.rect(5481, 192, 5, 26, s[2]); w.rect(5485, 192, 1, 26, s[0]); w.rect(5437, 203, 44, 2, s[1]);
  w.rect(ORR[0] - 1, ORR[1] + 1, 2, 11, P(AM0)); w.rect(ORR[0] - 4, ORR[1] + 11, 8, 1, P(AM0));
  chair(w, 5412, 0); chair(w, 5506, 0);
}
// ---- 5540 COW COUNTER ----------------------------------------------------------------------------------------------
const COWB = { x: 5546, y: 68, w: 82, h: 56 };
const TANK = { x: 5600, y: 164, w: 20 };
function bayCows(w) {
  const { x, y } = COWB;
  w.rect(x - 2, y - 2, COWB.w + 4, COWB.h + 4, s[0]); w.rect(x - 1, y - 1, COWB.w + 2, COWB.h + 2, s[3]); w.rect(x - 1, y - 1, COWB.w + 2, 1, s[5]); w.rect(x, y, COWB.w, COWB.h, P(SCRN));
  cowIcon(w, x + 6, y + 7, 2, false);
  w.tint(x + 3, y + 3, 26, 16, P(SCRN), 0.25);
  w.rect(x + 3, y + 25, COWB.w - 6, 1, P('#12405a'));
  for (let i = 0; i < 7; i++) { const sx = x + 4 + i * 11; w.rect(sx, y + 30, 9, 11, P('#0e1830')); w.rect(sx, y + 40, 9, 1, P('#1a2c50')); }
  for (let i = 0; i < 12; i++) { const h = 1 + Math.round(hs(i * 2.7) * 5); w.rect(x + 5 + i * 6, y + 52 - h, 4, h, P(i > 8 ? MG0 : '#15405a')); }
  w.rect(x + 36, y - 6, 10, 4, s[0]); w.rect(x + 37, y - 5, 8, 3, P('#4a1418'));
  // the milk tank (that is what the cows are for): a glass cylinder on a base, a pipe, a tap and a cup
  const T = TANK;
  w.rect(T.x + 8, 159, 3, T.y - 159, s[3]); w.rect(T.x + 8, 159, 1, T.y - 159, s[4]);
  w.rect(T.x - 1, T.y, T.w + 2, 4, s[0]); w.rect(T.x, T.y, T.w, 3, s[4]); w.rect(T.x, T.y, T.w, 1, s[5]);
  w.rect(T.x, T.y + 4, T.w, 42, s[0]); w.rect(T.x + 1, T.y + 4, T.w - 2, 42, P('#141a34'));
  w.rect(T.x - 2, 210, T.w + 4, 8, s[0]); w.rect(T.x - 1, 210, T.w + 2, 8, s[3]); w.rect(T.x - 1, 210, T.w + 2, 1, s[5]);
  for (let i = 0; i < T.w; i += 4) w.rect(T.x + i, 213, 2, 3, P(AM0));
  w.rect(T.x - 4, 129, 29, 11, s[0]); w.rect(T.x - 3, 130, 27, 9, P('#241c0c')); w.rect(T.x - 3, 130, 27, 1, P('#4a3a10')); w.text('MILK', T.x - 1, 131, P(AM0));
  w.rect(T.x - 6, 201, 6, 2, s[4]); w.rect(T.x - 6, 203, 2, 3, s[4]); w.rect(T.x - 8, 210, 6, 7, P('#5a6690')); w.rect(T.x - 8, 210, 6, 1, P('#aab4d0')); w.rect(T.x - 7, 211, 4, 2, P('#aab0c8'));
}
// ---- 5648 CREW STATIONS --------------------------------------------------------------------------------------------
const PONG = [0, 0], MUG = [0, 0];
function bayCrew(w) {
  const X0 = 5655, X1 = 5852, st = [5660, 5753, 5846];
  w.rect(X0 - 1, 51, X1 - X0 + 2, 90, s[0]);
  w.rect(X0, 52, X1 - X0, 88, s[2]); w.rect(X0, 52, X1 - X0, 1, s[4]);
  paintWindow(w, st, 58, 132, 8, X0, X1, 53, 132, 46);
  w.rect(X0, 132, X1 - X0, 1, s[5]); w.rect(X0, 133, X1 - X0, 1, s[4]); w.rect(X0, 134, X1 - X0, 4, s[3]); w.rect(X0, 138, X1 - X0, 1, s[2]); w.rect(X0, 139, X1 - X0, 1, s[0]);
  for (const sx of st) for (const y of [70, 112]) { if (sx !== 5753) continue; w.rect(sx - 1, y, 2, 4, P(CY1)); w.rect(sx - 1, y, 2, 1, P(CYANL)); w.rect(sx - 2, y - 1, 4, 1, s[0]); w.rect(sx - 2, y + 4, 4, 1, s[0]); LAMPS.push([sx, y + 2, 'strut']); }
  // three stations: a desk with a screen each, an oggle-sized chair pushed back from it
  desk(w, 5668, 30, 184, { scr: true, g: 2 }); chair(w, 5712, 1);
  const p = desk(w, 5736, 30, 184, { scr: true, g: -1, sw: 16, lamp: CYAN }); PONG[0] = p[0]; PONG[1] = p[1]; chair(w, 5780, 1);
  desk(w, 5804, 30, 184, { scr: true, eye: true, sw: 12, lamp: MAG }); chair(w, 5846, -1);
  // somebody's mug (its steam is live)
  MUG[0] = 5693; MUG[1] = 180;
  w.rect(5692, 180, 4, 4, P('#6a76a0')); w.rect(5692, 180, 4, 1, P('#9aa8cc')); w.dot(5696, 181, P('#6a76a0')); w.dot(5696, 182, P('#6a76a0'));
  // glyph labels under the window
  [2, 6, 0, 10].forEach((g, i) => glyph5(w, 5672 + i * 7, 143, g, P(CY0)));
  [5, 1, 9].forEach((g, i) => glyph5(w, 5814 + i * 7, 143, g, P(CY0)));
}
// ---- 5874 THE CAPTAIN'S DOOR ---------------------------------------------------------------------------------------
function bayDoor(w) {
  const x0 = 5878, x1 = 5930;
  w.rect(x0 - 4, 156, 1, 62, s[0]); w.rect(x0 - 3, 156, 3, 62, s[4]);
  w.rect(x0, 156, x1 - x0, 62, s[2]);
  w.rect(x1, 156, 3, 62, s[4]); w.rect(x1 + 3, 156, 1, 62, s[0]);
  w.rect(x0 - 3, 154, x1 - x0 + 6, 2, P(AM0)); w.rect(x0 - 3, 154, x1 - x0 + 6, 1, P(AM1));
  for (let y = 162; y < 212; y++) { if (!((y >= 162 && y < 168) || (y >= 206 && y < 212))) continue; for (let x = x0; x < x1; x++) w.dot(x, y, P(((x - AR + y + 400) >> 2) % 2 ? AM1 : HZ0)); }
  w.rect(x0, 186, x1 - x0, 1, s[0]); w.rect(x0, 187, x1 - x0, 1, s[3]);
  w.rect(5904, 168, 1, 38, s[0]);
  // the name plate and the captain's cap
  w.rect(5888, 170, 31, 12, s[0]); w.rect(5889, 171, 29, 10, P('#241c0c')); w.rect(5889, 171, 29, 1, P(AM0));
  w.text('BOSS', 5892, 173, P(AM1));
  w.rect(5895, 193, 16, 4, P('#aebbdc')); w.rect(5897, 191, 12, 2, P('#d8e0f4')); w.rect(5895, 197, 16, 2, P('#22306a')); w.rect(5902, 196, 3, 3, P(AM1)); w.rect(5893, 199, 8, 1, P('#15151f'));
  BLINKS.push([5924, 175, RED, 3]);
}
// ---- 5920 THE BRIDGE (the boss arena) ------------------------------------------------------------------------------
const STRUTS = [AR - 16, AR + 146, AR + 300, AR + 452, AR + 620];
const HOLO = [AR + 34, 181], COWD = [AR + 128, 162], TX = AR + 464;
// one recessed instrument plate of the wall under the sill: gauges, sliders, lamp grids, tiny screens, all very dim
function instr(w, x, y, wd, ht, kd) {
  w.rect(x, y, wd, ht, s[0]); w.rect(x, y + ht, wd, 1, s[2]); w.rect(x + 1, y + 1, wd - 2, ht - 2, P('#131128'));
  if (kd === 0) {
    w.rect(x + 4, y + 4, 16, 11, P(SCRN)); for (let j = 0; j < 4; j++) w.rect(x + 6, y + 6 + j * 2, 3 + Math.floor(hs(x + j * 3.3) * 9), 1, P(j % 2 ? '#134a60' : CY0));
    for (let i = 0; i < 3; i++) { w.rect(x + 24 + i * 5, y + 4, 2, 8, s[2]); w.rect(x + 24 + i * 5, y + 5 + Math.floor(hs(x + i) * 5), 2, 2, s[4]); }
  } else if (kd === 1) {
    for (let i = 0; i < 2; i++) { const gx = x + 9 + i * 14, gy = y + 10; w.ell(gx + 0.5, gy + 0.5, 5, 5, s[3]); w.ell(gx + 0.5, gy + 0.5, 4, 4, P('#0c0c1c')); w.line(gx, gy, gx + (i ? 2 : -3), gy - 3, P(i ? AM0 : S[5])); }
    w.rect(x + 30, y + 5, 5, 2, P(MG0)); w.rect(x + 30, y + 9, 5, 2, s[2]); w.rect(x + 30, y + 13, 5, 2, P(CY0));
  } else if (kd === 2) {
    for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) { const k = hs(x * 1.3 + i * 5.1 + j * 9.7); w.rect(x + 4 + i * 6, y + 4 + j * 5, 3, 2, P(k > 0.86 ? AM0 : k > 0.74 ? CY0 : k > 0.64 ? MG0 : S[2])); }
  } else {
    for (let j = 0; j < 5; j++) { w.rect(x + 4, y + 4 + j * 3, wd - 8, 1, s[2]); }
    w.rect(x + wd - 9, y + ht - 6, 4, 3, P('#3e3210'));
  }
}
// a ship's wheel on a pedestal by the throne (the captain steers the mothership the old way)
function helm(w, cx, cy) {
  w.rect(cx - 2, cy + 4, 4, 208 - cy, s[2]); w.rect(cx - 2, cy + 4, 1, 208 - cy, s[3]); w.rect(cx - 5, 209, 10, 3, s[3]); w.rect(cx - 5, 209, 10, 1, s[4]);
  for (let k = 0; k < 8; k++) { const a = k * 45 * DEG; w.line(cx + Math.cos(a) * 2, cy + Math.sin(a) * 2, cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, P(k % 2 ? '#6a5210' : AM0)); w.dot(Math.round(cx + Math.cos(a) * 10), Math.round(cy + Math.sin(a) * 10), P(AM1)); }
  w.shape((x, y) => { const d = Math.hypot(x - cx - 0.5, y - cy - 0.5); return d <= 7.6 && d > 5.6; }, (x, y) => P((x - cx) + (y - cy) < -3 ? AM1 : AM0), cx - 9, cy - 9, cx + 10, cy + 10);
  w.rect(cx - 1, cy - 1, 3, 3, P(AM1));
}
function arenaWall(w) {
  rail(w, 5896, WX1); lowerWall(w, 5896, WX1);
  // the instrument wall: one recessed plate per panel, between the sill and the seam
  for (let pid = 0; pid < 11; pid++) {
    const x = 5896 + pid * 48 + 5;
    if (x < 5936 || x > 6360) continue;
    instr(w, x, 163, 39, 21, [0, 2, 1, 3, 0, 1, 2, 0, 3, 1, 2][pid]);
  }
}
function arenaRoom(w) {
  // the strut lamps
  for (const sx of STRUTS.slice(0, 4)) for (const y of [62, 118]) { w.rect(sx - 1, y, 2, 4, P(CY1)); w.rect(sx - 1, y, 2, 1, P(CYANL)); w.rect(sx - 2, y - 1, 4, 1, s[0]); w.rect(sx - 2, y + 4, 4, 1, s[0]); LAMPS.push([sx, y + 2, 'strut']); }
  // a sign plaque on the ceiling beam (alien glyphs in cyan)
  w.rect(AR + 250, 5, 62, 13, s[0]); w.rect(AR + 251, 6, 60, 11, P(SCRN)); w.rect(AR + 250, 5, 62, 1, s[4]);
  [0, 2, 1, 5, 3, 9, 0, 8].forEach((g, i) => glyph5(w, AR + 254 + i * 7, 9, g, P(i === 3 ? CYAN : CY1)));
  // the holo globe's pedestal (the hologram is live)
  w.shape(polyIn([[AR + 26, 218], [AR + 28, 204], [AR + 41, 204], [AR + 43, 218]]), (x, y) => x < AR + 30 ? s[4] : x > AR + 39 ? s[1] : s[3], AR + 26, 204, AR + 44, 218);
  w.rect(AR + 27, 203, 15, 1, P(CY1)); w.rect(AR + 30, 201, 9, 2, s[4]); w.rect(AR + 32, 200, 5, 1, P(CYAN));
  // dark consoles along the back wall, between and beside the two platforms the hero can stand on
  desk(w, AR + 100, 26, 184, { scr: true, g: 1 }); chair(w, AR + 138, 0);
  desk(w, AR + 222, 34, 180, { scr: true, eye: true, sw: 12 }); chair(w, AR + 264, 0);
  desk(w, AR + 392, 30, 186, { scr: true, eye: true, sw: 12, lamp: MAG });
  // the wall display counting the cows they have taken (a cow pictogram, glyph digits, bars)
  const [dx, dy] = COWD;
  w.rect(dx, dy, 40, 18, s[3]); w.rect(dx, dy, 40, 1, s[5]); w.rect(dx + 1, dy + 1, 38, 16, P(SCRN));
  cowIcon(w, dx + 5, dy + 3, 1, false);
  glyph5(w, dx + 16, dy + 3, 9, P(CY0)); glyph5(w, dx + 23, dy + 3, 0, P(CY1)); glyph5(w, dx + 30, dy + 3, 1, P(CY1));
  for (let i = 0; i < 11; i++) { const h = Math.round(hs(i * 2.7) * 3); w.rect(dx + 4 + i * 3, dy + 14 - h, 2, 1 + h, P(i > 7 ? MG1 : CY0)); }
  BLINKS.push([dx + 35, dy + 11, RED, 5]);
  // the captain's podium on the right: a step, a hazard-striped edge, the wheel, the throne (tall, gold trim)
  w.rect(AR + 436, 212, 10, 6, s[2]); w.rect(AR + 436, 212, 10, 1, s[4]);
  w.rect(AR + 446, 205, 64, 13, s[2]); w.rect(AR + 446, 205, 64, 1, s[5]); w.rect(AR + 446, 206, 64, 1, s[3]);
  for (let y = 208; y < 212; y++) for (let x = AR + 446; x < AR + 504; x++) w.dot(x, y, P(((x - AR + y) >> 2) % 2 ? AM1 : HZ0));
  helm(w, AR + 440, 190);
  // a beacon post at each end of the captain's hazard pad (their lamps blink)
  for (const bx of [PAD0 + 2, PAD1 - 4]) { w.rect(bx - 1, 207, 5, 11, s[0]); w.rect(bx, 208, 3, 10, s[3]); w.rect(bx, 208, 1, 10, s[4]); w.rect(bx, 205, 3, 3, P('#4a3a10')); BLINKS.push([bx, 205, AMB, bx % 5]); }
  const inBack = (x, y) => Math.abs(x - TX) <= 13 && y >= 153 && y < 198 && Math.hypot(Math.max(0, Math.abs(x - TX) - 5), Math.min(0, y - 162)) <= 8.6;
  w.shape(inBack, (x, y) => {
    const e = Math.abs(x - TX) > 10.6 || Math.hypot(Math.max(0, Math.abs(x - TX) - 5), Math.min(0, y - 162)) > 6.4;
    if (e) return x < TX - 6 || y < 157 ? s[5] : s[3];
    return P((Math.floor(y / 6) + Math.floor((x + (Math.floor(y / 6) % 2) * 3) / 6)) % 2 === 0 && Math.floor(y) % 6 === 2 && Math.floor(x) % 6 === 2 ? MG1 : Math.floor(y) % 6 === 5 ? '#44183e' : x < TX - 6 ? MG0 : '#5c2052');
  }, TX - 14, 152, TX + 15, 199);
  w.rect(TX - 10, 154, 20, 1, P(AM1)); w.rect(TX - 12, 156, 1, 3, P(AM1)); w.rect(TX + 12, 156, 1, 3, P(AM1));
  glyph5(w, TX - 2, 160, 7, P(GRN)); w.dot(TX, 162, P(GRNL));
  w.rect(TX - 17, 183, 5, 3, s[5]); w.rect(TX - 17, 186, 3, 8, s[3]); w.rect(TX + 13, 183, 5, 3, s[4]); w.rect(TX + 15, 186, 3, 8, s[2]);
  w.rect(TX - 14, 192, 28, 4, P(MG0)); w.rect(TX - 14, 192, 28, 1, P(MG1)); w.rect(TX - 15, 196, 30, 2, s[4]); w.rect(TX - 15, 198, 30, 1, s[1]);
  w.rect(TX - 4, 199, 8, 6, s[2]); w.rect(TX - 4, 199, 2, 6, s[4]);
}

// =====================================================================================================================
// THE DECK (world space, painted once, y 210 down): a bright edge on the ground line, a thin top face, a panelled front
// face with the magenta light strip, a pipe below. On its top face: hazard stripes at the airlock, the red carpet to the
// captain's door, the captain's hazard pad in the arena.
// =====================================================================================================================
const DY0 = 210, DY1 = H + 12, CARPET0 = 5700, CARPET1 = 5934, PAD0 = 6186, PAD1 = 6378;
let DP = null;
function paintDeck(x0, x1) {
  if (!DP) DP = new Pix(WX0, DY0, WX1 - WX0, DY1 - DY0);
  const g = DP, CA = CARPET.map(c => P(c)), mg = P(MAG), mgl = P(MAGL), amb = P(AMB), am1 = P(AM1), hz = P('#22222c');
  for (let x = x0; x < x1; x++) {
    const gy = Math.round(L5ART.groundAt(x + 0.5)), u = x - 5896, pm = mod(u, 56), pid = Math.floor(u / 56);
    const carpet = x >= CARPET0 && x < CARPET1, fringe = carpet && (x < CARPET0 + 3 || x >= CARPET1 - 3);
    for (let y = gy; y < DY1; y++) {
      const d = y - gy;
      let c;
      if (d === 0) c = carpet && !fringe ? CA[3] : s[7];
      else if (d < 5 && x > PAD0 + d * 2 && x < PAD1 - d * 2) c = ((x - AR + d * 2) >> 2) % 2 ? (d < 3 ? amb : am1) : hz;
      else if (d < 5 && x < 5046 - d * 2) c = ((x + d * 2) >> 2) % 2 ? (d < 3 ? amb : am1) : hz;
      else if (d < 5 && carpet) c = fringe ? (x % 2 ? am1 : P(AM0)) : d === 1 ? CA[2] : d === 4 ? CA[0] : (d === 2 && mod(x, 12) < 2 ? am1 : CA[1]);
      else if (d === 2 && x > 5052 && x < CARPET0 - 6 && mod(x, 20) < 9) c = P(CY1);              // a guide line to the bridge
      else if (d < 5) c = mod(u + d * 3, 40) === 0 ? s[2] : d === 1 ? s[5] : d < 4 ? s[4] : s[3];
      else if (d === 5) c = s[6];
      else if (d === 6) c = s[3];
      else if (d < 9) c = s[0];
      else if (d < 31) {
        if (pm === 0) c = s[0];
        else if (pm === 1 || d === 9) c = s[3];
        else if (d === 13 || d === 14) c = mod(u, 22) < 15 ? (d === 13 ? mgl : mg) : s[0];
        else if (d === 12 || d === 15) c = s[0];
        else if (d > 19 && d < 28 && mod(pid, 2) === 0 && pm > 12 && pm < 44 && d % 2 === 0) c = s[0];
        else if ((pm === 4 || pm === 52) && (d === 18 || d === 28)) c = s[4];
        else c = s[2];
      } else if (d === 31) c = s[4];
      else if (d === 32) c = s[0];
      else { const py = d - 36; c = py >= 0 && py < 5 ? (mod(u, 70) < 3 ? s[3] : py === 0 ? s[3] : py < 3 ? s[2] : s[0]) : s[1]; }
      g.dot(x, y, c);
    }
    // glyph plates on the odd panels of the corridor's front face
    if (x < 5890 && mod(pid, 2) === 1 && pm === 20) glyph5(g, x, gy + 21, mod(pid * 7, 12) === 7 ? 0 : mod(pid * 7, 12), P('#3a3470'));
  }
}

// =====================================================================================================================
// The 'console' platforms: a pedestal console the hero can stand on (the eye beam passes underneath its wings)
// =====================================================================================================================
const CONS = {};
function bakeConsole(wd, ht) {
  const px = new Pix(-2, -2, wd + 4, ht + 3), m = wd >> 1;
  // the foot and the column, a screen set into it
  px.rect(m - 12, ht - 4, 24, 4, s[4]); px.rect(m - 12, ht - 4, 24, 1, s[6]); px.rect(m + 7, ht - 3, 5, 3, s[2]); px.rect(m - 12, ht - 1, 24, 1, s[2]);
  px.rect(m - 8, 10, 16, ht - 14, s[3]); px.rect(m - 8, 10, 2, ht - 14, s[5]); px.rect(m - 6, 10, 1, ht - 14, s[4]); px.rect(m + 5, 10, 3, ht - 14, s[1]);
  px.rect(m - 5, 12, 10, 7, s[0]); px.rect(m - 4, 13, 8, 5, P(SCRN)); px.rect(m - 3, 14, 4, 1, P(CY1)); px.rect(m - 3, 16, 6, 1, P(CY0));
  px.rect(m - 8, ht - 8, 16, 1, s[0]); px.rect(m - 8, ht - 7, 16, 1, P(CYAN)); px.rect(m - 8, ht - 6, 16, 1, P(CY0));
  // the neck spreading out under the top
  for (let j = 0; j < 3; j++) { const hw = m - 4 - j * 4; px.rect(m - hw, 7 + j, hw * 2, 1, j ? s[2] : s[3]); px.rect(m - hw, 7 + j, 2, 1, s[4]); px.rect(m + hw - 3, 7 + j, 3, 1, s[1]); }
  // the top: the bright surface the hero stands on, a row of keys, a dark lip
  px.rect(0, 0, wd, 7, s[5]); px.rect(1, 0, wd - 2, 1, s[7]); px.rect(0, 1, wd, 1, s[6]); px.rect(0, 5, wd, 1, s[4]); px.rect(1, 6, wd - 2, 1, s[2]);
  px.rect(0, 1, 1, 5, s[6]); px.rect(wd - 2, 2, 2, 4, s[3]);
  for (let i = 3; i < wd - 4; i += 4) px.rect(i, 2, 2, 2, s[2]);
  for (let i = 5; i < wd - 6; i += 8) px.rect(i, 5, 4, 1, P(CY1));
  px.outline(P(OUT));
  return px.canvas();
}
const KEYC = [CYAN, AMB, MAG, CYAN];
function drawConsole(pl) {
  const ht = Math.round(L5ART.groundAt(pl.x + pl.w / 2)) - pl.y, k = pl.w + 'x' + ht;
  const im = CONS[k] || (CONS[k] = bakeConsole(pl.w, ht));
  // the light under the wings
  if (BK.under) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.5 + 0.1 * Math.sin(G.t * 0.07 + pl.x); ctx.drawImage(BK.under.img, pl.x + (pl.w >> 1) - BK.under.o, pl.y + ht - 6 - BK.under.o); ctx.restore(); }
  ctx.drawImage(im, pl.x - 2, pl.y - 2);
  // keys lighting up in turn
  const n = Math.floor((pl.w - 7) / 4), f = Math.floor(G.t / 9);
  for (let i = 0; i < n; i++) { const h = hs(i * 3.1 + pl.x + Math.floor((f + i * 5) / 7) * 1.7); if (h > 0.45) { ctx.fillStyle = KEYC[(i + (pl.x >> 2)) & 3]; ctx.fillRect(pl.x + 3 + i * 4, pl.y + 2, 2, h > 0.8 ? 2 : 1); } }
  if (Math.floor(G.t / 22 + pl.x) % 3) { ctx.fillStyle = CYANL; ctx.fillRect(pl.x + (pl.w >> 1) - 3 + (Math.floor(G.t / 22) % 3) * 2, pl.y + 14, 2, 1); }
}

// =====================================================================================================================
// Low foreground at the very bottom (screen space, parallax 1.25, painted once in "front design" coordinates: the
// arena's part is at 0..480, the corridor's to the left of it): the backs of the near stations, a railing, cables
// =====================================================================================================================
const FP = 1.25, FX0 = -1290, FX1 = 500, FY0 = 228;
function paintFront() {
  const px = new Pix(FX0, FY0, FX1 - FX0, 54);
  const hump = (x0, x1, top, r) => (x, y) => x >= x0 && x < x1 && y >= top && Math.hypot(Math.max(0, Math.max(x0 + r - x, x - (x1 - r))), Math.max(0, top + r - y)) <= r;
  const body = (f, x0, x1) => px.shape(f, (x, y, ix) => {
    if (!f(x, y - 1.2)) return s[5];
    if (!f(x, y - 2.4)) return s[3];
    if (!f(x - 1.5, y)) return s[3];
    if (!f(x + 1.5, y)) return s[0];
    return mod(ix - x0, 26) === 12 ? s[0] : mod(ix - x0, 26) === 13 ? s[2] : s[1];
  }, x0, FY0, x1, FY0 + 54);
  const railing = (x0, x1) => {
    px.rect(x0, 262, x1 - x0, 1, s[4]); px.rect(x0, 263, x1 - x0, 2, s[1]); px.rect(x0, 265, x1 - x0, 1, s[0]);
    for (let x = x0 + 18; x < x1 - 10; x += 20) px.rect(x, 263, 8, 1, P(mod(x, 40) < 20 ? MG1 : MG0));
    for (let x = x0 + 32; x < x1 - 10; x += 46) { px.rect(x, 265, 3, 17, s[1]); px.rect(x, 265, 1, 17, s[3]); }
  };
  const monitor = (x, y, w, h) => {
    px.rect(x, y, w, h, s[0]); px.rect(x, y, w, 1, P(CY1)); px.rect(x, y + 1, 1, h - 1, P(CY0)); px.rect(x + w - 1, y + 1, 1, h - 1, P(CY0)); px.rect(x + 1, y + 1, w - 2, 1, s[3]);
    px.rect(x + 4, y + 4, w - 8, 1, s[2]); px.rect(x + 4, y + 7, w - 8, 1, s[2]); px.dot(x + w - 4, y + h - 3, P(AM1));
  };
  const keys = list => { for (const [x, y, c] of list) { px.rect(x, y, 3, 2, P(c)); px.dot(x, y, P('#ffffff')); } };
  // ---- the arena (as in the proposal frame, without the crew)
  railing(78, 400);
  body(hump(84, 134, 256, 6), 84, 134); body(hump(338, 392, 257, 6), 338, 392);
  body(hump(-10, 78, 247, 9), -10, 78); body(hump(400, 490, 245, 10), 400, 490);
  monitor(4, 234, 26, 13); monitor(456, 232, 24, 13);
  keys([[56, 249, AM1], [61, 249, MG1], [66, 249, CY1], [92, 258, CY1], [98, 258, AM1], [122, 258, MG1], [410, 247, CY1], [415, 247, MG1], [420, 247, AM1], [346, 259, MG1], [352, 259, CY1], [382, 259, AM1]]);
  px.rect(110, 248, 2, 8, s[4]); px.rect(108, 245, 6, 4, P(MG1)); px.rect(108, 245, 6, 1, P(MAGL)); px.rect(107, 246, 1, 2, P(MG0)); px.rect(114, 246, 1, 2, P(MG0));
  px.rect(364, 250, 2, 7, s[4]); px.rect(362, 247, 6, 4, P(AM1)); px.rect(362, 247, 6, 1, P(AMBL));
  // ---- the corridor: a railing in stretches, a few low things in front of each bay
  // a velvet rope on gold posts: in front of the HALL OF FAME, and along the red carpet to the captain's door
  const rope = (x0, x1, n) => {
    const st = (x1 - x0) / n;
    for (let k = 0; k < n; k++) for (let i = 0; i <= st; i++) { const u = i / st, x = Math.round(x0 + k * st + i), y = Math.round(251 + 26 * u * (1 - u)); px.rect(x, y, 1, 2, P(CARPET[2])); px.dot(x, y, P(CARPET[3])); px.dot(x, y + 2, P(CARPET[0])); }
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + k * st);
      px.rect(x - 2, 250, 5, 32, s[0]); px.rect(x - 1, 250, 3, 32, P(AM0)); px.rect(x - 1, 250, 1, 32, P(AM1));
      px.rect(x - 3, 244, 7, 6, s[0]); px.rect(x - 2, 245, 5, 4, P(AM1)); px.rect(x - 2, 245, 2, 2, P(AMBL)); px.rect(x + 1, 248, 2, 1, P(AM0));
    }
  };
  railing(-1240, -1030); rope(-1000, -760, 4); railing(-740, -640); railing(-520, -300); rope(-238, -46, 4);
  // crates of spare parts (their tops only), a tool box
  body(hump(-1130, -1070, 250, 3), -1130, -1070); px.rect(-1120, 256, 40, 1, s[3]); px.rect(-1107, 259, 14, 5, P(AM0)); px.rect(-1107, 259, 14, 1, P(AM1));
  body(hump(-620, -560, 252, 8), -620, -560); monitor(-610, 238, 24, 14); keys([[-580, 256, CY1], [-575, 256, AM1], [-570, 256, MG1]]);
  body(hump(-296, -252, 254, 5), -296, -252); px.rect(-280, 246, 2, 8, s[4]); px.rect(-282, 243, 6, 4, P(CY1)); px.rect(-282, 243, 6, 1, P(CYANL));
  // cables on the floor
  for (const [a, b] of [[-1060, -1004], [-640, -520], [-40, 84]]) for (let x = a; x < b; x++) { const y = Math.round(268 + Math.sin(x * 0.07) * 2 + Math.sin(x * 0.023 + 1) * 2); px.dot(x, y, s[3]); px.dot(x, y + 1, s[0]); }
  return px.canvas();
}

// =====================================================================================================================
// Live bits (world space unless said otherwise)
// =====================================================================================================================
function light(h, x, y, a) { ctx.globalAlpha = a; ctx.drawImage(h.img, Math.round(x) - h.o, Math.round(y) - h.o); }
const rgba = (c, a) => { const v = hex(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a.toFixed(3) + ')'; };
function bakeHolo() {
  // the still part of the holo globe: the projector's cone, the disc, its rim and parallels
  const r = 15, px = new Pix(-24, -24, 48, 48);
  for (let j = 0; j < 22; j += 2) { const hw = Math.round(4 + (22 - j) * 0.55); px.rect(-hw, 19 - j, hw * 2 + 1, 1, P(CYAN, Math.round((0.05 + j * 0.006) * 255))); }
  px.shape((x, y) => Math.hypot(x - 0.5, y - 0.5) <= r, P(CYAN, 40), -r, -r, r + 1, r + 1);
  for (let a = 0; a < 360; a += 4) px.dot(Math.round(Math.cos(a * DEG) * r), Math.round(Math.sin(a * DEG) * r), P(CYAN, 190));
  for (const k of [-0.55, 0, 0.55]) { const yy = Math.round(k * r), wd = Math.round(Math.sqrt(r * r - (k * r) ** 2)); for (let x = -wd; x <= wd; x += 2) px.dot(x, yy, P(CYAN, 108)); }
  return px.canvas();
}
function drawHolo(t) {
  const cx = HOLO[0], cy = HOLO[1], r = 15;
  ctx.drawImage(BK.holo, cx - 24, cy - 24);
  ctx.fillStyle = 'rgba(79,227,255,0.42)';
  for (const m of [0.2, 0.62, 0.95]) { const ph = (m + t / 240) % 1, k = Math.cos(ph * Math.PI); for (let a = -80; a <= 80; a += 16) ctx.fillRect(Math.round(cx + k * Math.cos(a * DEG) * r), Math.round(cy + Math.sin(a * DEG) * r), 1, 1); }
  // the target marks on it (when the MEGA OGGLE is beaten they go out one by one)
  const marks = G.winT > 0 ? clp(Math.ceil((G.winT - 240) / 40), 0, 3) : 3;
  for (const [dx, dy, ph] of [[-5, -4, 0], [6, 3, 9], [1, -9, 17]].slice(0, marks)) {
    ctx.fillStyle = Math.floor((t + ph) / 8) % 3 !== 0 ? MG1 : MAGL;
    ctx.fillRect(cx + dx - 2, cy + dy, 5, 1); ctx.fillRect(cx + dx, cy + dy - 2, 1, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(cx + dx, cy + dy, 1, 1);
  }
}
function drawLive(cx) {
  const t = G.t, x0 = cx - 12, x1 = cx + W + 12, vis = (a, b) => b > x0 && a < x1;
  // ---- lamps that blink
  for (const [x, y, c, ph] of BLINKS) if (x > x0 && x < x1 && Math.floor((t + ph * 7) / 14) % 3) { ctx.fillStyle = c; ctx.fillRect(x, y, 2, 2); }
  if (vis(5060, 5124)) {                                   // the chevrons: one after the other
    const k = Math.floor(t / 10) % 7;
    if (k < 5) { ctx.fillStyle = AM1; const x = CHEV[0] + k * 10, y = CHEV[1]; for (let j = 0; j < 4; j++) { ctx.fillRect(x + j, y + j, 2, 1); ctx.fillRect(x + j, y + 6 - j, 2, 1); } }
  }
  if (vis(POSTER[0], POSTER[0] + 40) && typeof HEROES !== 'undefined') {   // the WANTED poster shows whoever is playing
    const h = HEROES[G.hero] || HEROES[0], hd = h && h.head;
    if (hd) { ctx.drawImage(hd.img, POSTER[0] + 20 - (hd.w >> 1), POSTER[1] + 15); ctx.fillStyle = 'rgba(20,18,48,0.38)'; ctx.fillRect(POSTER[0] + 10, POSTER[1] + 13, 20, 18); }
  }
  if (vis(5296, 5320)) {                                   // the valve leaks a little steam
    for (let i = 0; i < 4; i++) { const ph = ((t * 0.5 + i * 13) % 52) / 52; ctx.fillStyle = 'rgba(190,200,235,' + (0.4 * (1 - ph)).toFixed(3) + ')'; ctx.fillRect(Math.round(5311 + ph * 7 + Math.sin(ph * 6 + i) * 1.5), Math.round(118 - ph * 16), ph > 0.5 ? 2 : 1, ph > 0.5 ? 2 : 1); }
  }
  if (vis(MAP.x, MAP.x + MAP.w)) {                         // the star map: a saucer creeping along the route, the target on Earth
    const u = (t % 900) / 900, [mx, my] = mapRoute(u), X = Math.round(mx), Y = Math.round(my);
    ctx.fillStyle = AM1; ctx.fillRect(X - 2, Y, 5, 1); ctx.fillRect(X - 1, Y - 1, 3, 1);
    if (Math.floor(t / 6) % 2) { ctx.fillStyle = AMBL; ctx.fillRect(X, Y - 1, 1, 1); }
    const b = Math.floor(t / 20) % 2; ctx.fillStyle = b ? MG1 : MG0;
    const ex = MAP.x + 114, ey = MAP.y + 34, rr = 11 + b;
    ctx.fillRect(ex - rr, ey, 4, 1); ctx.fillRect(ex + rr - 3, ey, 4, 1); ctx.fillRect(ex, ey - rr, 1, 4); ctx.fillRect(ex, ey + rr - 3, 1, 4);
    // the orrery on the plotting table: three little planets round a lamp
    ctx.fillStyle = AM1; ctx.fillRect(ORR[0] - 1, ORR[1] - 1, 3, 3); ctx.fillStyle = AMBL; ctx.fillRect(ORR[0], ORR[1], 1, 1);
    for (let i = 0; i < 3; i++) { const a = t * (0.03 - i * 0.008) + i * 2.1, r = 6 + i * 5, back = Math.sin(a) < 0; ctx.fillStyle = [CY1, MG1, S[6]][i]; if (back && Math.abs(Math.cos(a)) * r < 2) continue; ctx.fillRect(Math.round(ORR[0] + Math.cos(a) * r), Math.round(ORR[1] + Math.sin(a) * r * 0.3), i === 2 ? 2 : 1, i === 2 ? 2 : 1); }
  }
  if (vis(COWB.x, TANK.x + 30)) {                          // the cow counter: one lamp per pod; a rescue crosses it out
    const fr = G.freed, L = L5ART.level && L5ART.level(), tot = Math.min(7, L && L.pows ? L.pows.length : 7);
    let left = 0;
    for (let i = 0; i < tot; i++) {
      const sx = COWB.x + 4 + i * 11, sy = COWB.y + 30, free = !!(fr && fr.has(i));
      if (!free) { left++; ctx.fillStyle = COWC[1]; ctx.fillRect(sx + 1, sy + 4, 6, 4); ctx.fillStyle = COWC[2]; ctx.fillRect(sx + 1, sy + 4, 6, 1); ctx.fillRect(sx + 5, sy + 2, 3, 3); ctx.fillStyle = COWC[0]; ctx.fillRect(sx + 1, sy + 8, 1, 1); ctx.fillRect(sx + 5, sy + 8, 1, 1); }
      else { ctx.fillStyle = '#c0302a'; for (let k = 0; k < 7; k++) { ctx.fillRect(sx + 1 + k, sy + 2 + k, 1, 1); ctx.fillRect(sx + 7 - k, sy + 2 + k, 1, 1); } }
    }
    const alarm = left < tot, on = Math.floor(t / 16) % 2;
    text(String(left), COWB.x + 58, COWB.y + 5, left ? (alarm && on ? '#ff7a5a' : AM1) : (on ? RED : '#7a1c18'), 2, 'left', null);
    text('COWS', COWB.x + 30, COWB.y + 4, AM0, 1, 'left', null);
    if (alarm && on) { ctx.fillStyle = RED; ctx.fillRect(COWB.x + 37, COWB.y - 5, 8, 3); }
    // the milk in the tank: its level creeps, bubbles rise
    const T = TANK, lv = T.y + 20 + Math.round(Math.sin(t * 0.02) * 2);
    ctx.fillStyle = '#7f88ac'; ctx.fillRect(T.x + 1, lv, T.w - 2, T.y + 46 - lv); ctx.fillStyle = '#b4bcd8'; ctx.fillRect(T.x + 1, lv, T.w - 2, 1); ctx.fillStyle = '#9aa2c4'; ctx.fillRect(T.x + 2, lv + 1, 2, T.y + 45 - lv);
    for (let i = 0; i < 3; i++) { const ph = ((t * 0.5 + i * 23) % 60) / 60; ctx.fillStyle = '#c8d0e8'; ctx.fillRect(T.x + 5 + i * 5, Math.round(T.y + 45 - ph * (T.y + 44 - lv)), 1, 1); }
    ctx.fillStyle = 'rgba(200,220,255,0.25)'; ctx.fillRect(T.x + 2, T.y + 5, 1, 40); ctx.fillStyle = '#7f88ac'; if (Math.floor(t / 30) % 4 === 0) ctx.fillRect(T.x - 5, 206 + (Math.floor(t / 6) % 4), 1, 1);
  }
  if (vis(5660, 5850)) {                                   // crew stations: a game of pong left running, a steaming mug
    const [px, py] = PONG, bw = 13, bh = 6, tri = (v, n) => { const m = mod(v, n * 2); return m < n ? m : n * 2 - m; };
    const bx = tri(t / 5, bw), by = tri(t / 7 + 3, bh);
    ctx.fillStyle = CY0; ctx.fillRect(px + 1, py + 1 + clp(Math.round(by - 1 + Math.sin(t / 40)), 0, bh - 2), 1, 3); ctx.fillRect(px + 14, py + 1 + clp(Math.round(by - 1 - Math.sin(t / 31)), 0, bh - 2), 1, 3);
    ctx.fillStyle = CYANL; ctx.fillRect(px + 1 + Math.round(bx), py + 1 + Math.round(by), 1, 1);
    for (let i = 0; i < 2; i++) { const ph = ((t * 0.4 + i * 20) % 40) / 40; ctx.fillStyle = rgba('#c8d0e8', 0.5 * (1 - ph)); ctx.fillRect(MUG[0] + Math.round(Math.sin(ph * 5 + i) * 1.2), Math.round(MUG[1] - 2 - ph * 9), 1, 1); }
  }
  if (vis(HOLO[0] - 24, HOLO[0] + 24)) drawHolo(t);
  // ---- soft lights (additive)
  const ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  for (let x = Math.ceil((x0 - 5916) / 60) * 60 + 5916; x < x1; x += 60) if (x > 5012) light(BK.hCyan, x, 31, ga * 0.16);
  for (const x of CONES) if (x > x0 - 30 && x < x1 + 30) {
    const fl = x === 5336 && hs(Math.floor(t / 5) * 1.3) > 0.82 ? 0.25 : 1;                       // the service bay's lamp flickers
    ctx.globalAlpha = ga * fl * (0.9 + 0.1 * Math.sin(t * 0.05 + x)); ctx.drawImage(BK.cone.img, x - BK.cone.o, 42);
  }
  for (const [x, y, k] of LAMPS) if (x > x0 && x < x1) { if (k === 'strut') light(BK.hStrut, x, y, ga * 0.3); else light(BK.hPic, x, y + 4, ga * 0.22); }
  for (const [x, y, c, ph] of BLINKS) if (x > x0 && x < x1 && Math.floor((t + ph * 7) / 14) % 3) light(c === RED ? BK.hRed : c === CYAN ? BK.hLampC : c === MAG ? BK.hLampM : BK.hLampA, x + 1, y + 1, ga * 0.3);
  if (vis(HOLO[0] - 24, HOLO[0] + 24)) light(BK.hHolo, HOLO[0], HOLO[1], ga * 0.22);
  // the big screens light the wall round them a little
  if (vis(MAP.x - 40, MAP.x + MAP.w + 40)) light(BK.hMap, MAP.x + MAP.w / 2, MAP.y + MAP.h / 2 + 6, ga * (0.07 + 0.01 * Math.sin(t * 0.04)));
  if (vis(COWB.x - 30, COWB.x + COWB.w + 30)) light(BK.hBoard, COWB.x + COWB.w / 2, COWB.y + COWB.h / 2 + 4, ga * 0.06);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = ga;
}
function worldBlit(c, wx0, cx, y0) {
  const sx = Math.max(0, Math.floor(cx - 12 - wx0)), ex = Math.min(c.width, Math.ceil(cx + W + 12 - wx0));
  if (ex > sx) ctx.drawImage(c, sx, 0, ex - sx, c.height, wx0 + sx, y0, ex - sx, c.height);
}

// the window panes (world x0, x1, y0, y1): the crew stations' two, the bridge's four
const PANES = [[5665, 5748, 58, 132], [5758, 5841, 58, 132], [STRUTS[0] + 5, STRUTS[1] - 5, 40, 150], [STRUTS[1] + 5, STRUTS[2] - 5, 40, 150], [STRUTS[2] + 5, STRUTS[3] - 5, 40, 150], [STRUTS[3] + 5, WX1, 40, 150]];
// =====================================================================================================================
// Bake steps (each well under ~100 ms in the harness), then the contract object
// =====================================================================================================================
const STEPS = [
  () => { if (!NZT) makeNZT(); spaceRows(0, 100); },
  () => spaceRows(100, 200),
  () => { spaceRows(200, SH); spaceStars(); },
  paintEarth,
  () => { WP = new Pix(WX0, WY0, WX1 - WX0, WY1 - WY0); ceiling(WP, WX0, WX1); corridorBase(WP, WX0, 5896); },
  () => { wallShade(WP); for (const x of RIBS) rib(WP, x); bayAirlock(WP); bayFame(WP); },
  () => { bayService(WP); bayMap(WP); bayCows(WP); },
  () => { bayCrew(WP); },
  () => { paintWindow(WP, STRUTS, 40, 150, 10, 5896, 6160, 40, 150); },
  () => { paintWindow(WP, STRUTS, 40, 150, 10, 6160, WX1, 40, 150); },
  () => { arenaWall(WP); bayDoor(WP); arenaRoom(WP); },
  () => { BK.wall = WP.canvas(); WP = null; },
  () => paintDeck(WX0, 5700),
  () => { paintDeck(5700, WX1); BK.deck = DP.canvas(); DP = null; },
  () => { BK.front = paintFront(); },
  () => {
    BK.holo = bakeHolo();
    // the console platforms of the level, so that none is baked in the middle of play
    const L = L5ART.level && L5ART.level();
    for (const pl of (L && L.plats) || []) if (pl.t === 'console') { const ht = Math.round(L5ART.groundAt(pl.x + pl.w / 2)) - pl.y, k = pl.w + 'x' + ht; if (!CONS[k]) CONS[k] = bakeConsole(pl.w, ht); }
    BK.hCyan = halo(14, CYAN, 1); BK.hStrut = halo(7, CYAN, 1); BK.hPic = halo(12, AMB, 1); BK.hHolo = halo(22, CYAN, 1);
    BK.hRed = halo(5, RED, 1); BK.hLampC = halo(5, CYAN, 1); BK.hLampM = halo(5, MAG, 1); BK.hLampA = halo(5, AMB, 1);
    BK.cone = cone(64, 150); BK.hMap = halo(96, CYAN, 1); BK.hBoard = halo(64, AMB, 1);
    BK.hMag = halo(9, MAG, 1); BK.under = halo(16, CYAN, 0.5); BK.glint = glint(112);
  }
];

L5ART.bridge = {
  x0: AX0, x1: AX1,
  steps: STEPS,
  // the whole backdrop for camera cx, screen space, opaque, into g only (g may be the joiner's crossfade canvas)
  bg(g, cx) { drawBG(g, cx); },
  // world space: the room (the wall strip, then its live lamps, screens and the hologram)
  behind(cx) {
    worldBlit(BK.wall, WX0, cx, WY0);
    // past the level's end (seen only when the screen shakes: the joiner clips the ground at x1)
    if (cx + W > AX1 - 4) ctx.drawImage(BK.deck, AX1 - WX0, 0, WX1 - AX1, BK.deck.height, AX1, DY0, WX1 - AX1, BK.deck.height);
    drawLive(cx);
  },
  // world space: the deck, then the glow of its magenta strip
  ground(cx) {
    worldBlit(BK.deck, WX0, cx, DY0);
    const ga = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    for (let x = Math.ceil((cx - 20 - 5930) / 44) * 44 + 5930; x < cx + W + 20; x += 44) if (x > AX0 + 4) light(BK.hMag, x, Math.round(L5ART.groundAt(x)) + 14, ga * (0.2 + 0.04 * Math.sin(G.t * 0.05 + x)));
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = ga;
  },
  plat(pl) { drawConsole(pl); },
  // screen space: the low foreground, scrolling a little faster than the deck
  front(cx) {
    const o = Math.round((cx - AR) * FP), sx = clp(o - 10 - FX0, 0, BK.front.width - (W + 20));
    ctx.drawImage(BK.front, sx, 0, W + 20, BK.front.height, sx + FX0 - o, FY0, W + 20, BK.front.height);
  },
  // screen space, at globalAlpha = the backdrop's weight: a slow glint sliding over the glass of the windows
  overlay(cx) {
    const ga = ctx.globalAlpha, t = G.t;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < PANES.length; i++) {
      const [a, b, y0, y1] = PANES[i];
      if (b < cx || a > cx + W) continue;
      const u = ((t + i * 190) % 760) / 760;
      if (u > 0.5) continue;                               // one pass, then a rest
      const gx = a - 90 + u * 2 * (b - a + 90) - cx;
      ctx.save(); ctx.beginPath(); ctx.rect(a - cx, y0, b - a, y1 - y0); ctx.clip();
      ctx.globalAlpha = ga * Math.sin(u * 2 * Math.PI);
      ctx.drawImage(BK.glint, Math.round(gx), y0 - 1);
      ctx.restore();
    }
    ctx.restore();
  }
};
}
