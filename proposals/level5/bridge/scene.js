'use strict';
// =====================================================================================================================
// MISSION 5 "ALIEN MOTHERSHIP" proposal frame: FINAL AREA: THE BRIDGE, boss MEGA OGGLE. A screenshot fixture, NOT game
// content. Needs the shared kit first:
//   node tools/harness/harness.mjs render --level 5 --x 6200 --frames 40 --hero 1 --god --scale 3 \
//     --extra proposals/level5/kit.js --extra proposals/level5/bridge/scene.js --out proposals/level5/bridge/bridge.png
// The captain of the mothership (a giant one-eyed green robot on a saucer skirt, a tiny captain's cap on its head)
// fires its EYE BEAM along the deck (ZAAAP!); Mathias jumps it and fires the H.M.G. into the eye; the other claw is
// about to drop a cow pod (blinking ring + red ! on the deck). Behind: the panoramic window with the Earth and the Moon.
// It pushes a temporary mission 5 whose boss lock is already running (pre-activated in load()).
// Drawing never calls Math.random()/rand(): hsh(n) and G.t only. Big static layers are painted once (pixel buffers ->
// canvases); only small live bits are drawn per frame. Private to this block except ENEMY_TYPES.megaoggle + the mission.
// =====================================================================================================================
{
const PAL = M5.PAL, GR = PAL.G, S = PAL.S, SP = PAL.SP;

// ---------------------------------------------------------------------------------------------------------------------
// Layout (design coordinates = screen coordinates with the camera locked in the arena)
// ---------------------------------------------------------------------------------------------------------------------
const END = 6400, CAM = END - W;           // the boss lock: camera x 5920
const DECK = 218;                           // the deck's walkable top edge
const HERO_SX = 108, HERO_Y = 165;          // Mathias at the top of his jump (feet)
const B = { cx: 362, eq: 152, rx: 76, ryT: 80, ryB: 62, p: 2.5 };   // the boss's body: a heavy rounded bell
const EX = 346, EY = 146, LR = 24, BR = 30.5; // the eye: centre, lens radius, bezel radius
const IRX = EX - 6, IRY = EY + 8;            // where the iris looks this frame: down-left along its beam
const SKY = 194, SKRX = 94, SKRY = 10;      // the saucer skirt: its top face (an ellipse)
const BX = B.cx, BY = 211;                  // the boss's anchor: e.x = CAM + BX, e.y = BY (the bottom of the skirt)
const HITX = 72;                            // where the eye beam meets the deck this frame
const PODX = 178, PODY = 130;               // the cow pod hanging from the left claw (its floor point)
const WIN = { y0: 40, y1: 150 };            // the panoramic window (glass from y0 to y1)
const EARTH = { x: 62, y: 100, r: 50 }, MOON = { x: 236, y: 97, r: 8 };
const BOSS_MAX = 500, BOSS_HP = 435;        // 87 %

// ---------------------------------------------------------------------------------------------------------------------
// Helpers: easing, value noise, packed colours, pixel buffers, inside-test shapes
// ---------------------------------------------------------------------------------------------------------------------
const DEG = Math.PI / 180;
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
function P(c, a = 255) { const v = rgbOf(c); return pk(v[0], v[1], v[2], a); }
// a colour from a ramp at t (0..1), dithered between neighbouring steps (pixel-art gradient)
function ramp(cols, t, x, y) {
  const f = clamp(t, 0, 1) * (cols.length - 1), i = Math.floor(f);
  return P(cols[Math.min(cols.length - 1, i + (f - i > dith(x, y) ? 1 : 0))]);
}
// the same with flat bands and only a narrow dithered transition between them (cleaner on big shapes)
function band(cols, t, x, y, w = 0.3) {
  const f = clamp(t, 0, 1) * (cols.length - 1), i = Math.floor(f), fr = clamp((f - i - 0.5) / w + 0.5, 0, 1);
  return P(cols[Math.min(cols.length - 1, i + (fr > dith(x, y) ? 1 : 0))]);
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
  disc(cx, cy, r, col) { this.shape((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r, col, cx - r - 1, cy - r - 1, cx + r + 2, cy + r + 2); }
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
  canvas() {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const g = c.getContext('2d'), id = g.createImageData(this.w, this.h);
    id.data.set(new Uint8ClampedArray(this.d.buffer)); g.putImageData(id, 0, 0);
    return c;
  }
}
const rot = (x, y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [dx * c + dy * s, -dx * s + dy * c]; };
function polyIn(pts) {
  return (x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
}
// nearest point on a segment: [distance, t]
function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return [Math.hypot(x - ax - dx * t, y - ay - dy * t), t];
}
// crisp pixel disc on the live canvas
function disc(x, y, r, col) {
  ctx.fillStyle = col; x = Math.round(x); y = Math.round(y);
  for (let j = -r; j <= r; j++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - j * j))); ctx.fillRect(x - w, y + j, w * 2 + 1, 1); }
}
// light from the upper left on a surface whose screen-space normal is (nx, ny): -1 (away) .. 1 (facing it)
const lit = (nx, ny) => -0.6 * nx - 0.8 * ny;
const STEEL = [METDD, METD, MET, METL, '#ffffff'];
const steel = l => P(STEEL[l > 0.6 ? 4 : l > 0.2 ? 3 : l > -0.3 ? 2 : l > -0.7 ? 1 : 0]);
const green = (l, o = 0) => P(GR[clamp((l > 0.6 ? 5 : l > 0.15 ? 4 : l > -0.35 ? 3 : l > -0.75 ? 2 : 1) + o, 0, 6)]);
// dim versions of the ship's lights for the background (the play lane must stay the brightest thing)
const CY0 = '#1b6884', CY1 = '#2fa3c4', MG0 = '#742a64', MG1 = '#b03a80', AM0 = '#8a6a12', AM1 = '#c9a030';

// alien glyphs: chunky circles, dots and bars (5x5); 7 is the oggles' eye mark
const GLY = [[14, 17, 17, 17, 14], [31, 0, 31, 0, 31], [4, 0, 31, 0, 4], [14, 17, 17, 0, 0], [4, 4, 4, 4, 4], [28, 16, 16, 0, 0], [0, 10, 0, 10, 0], [14, 17, 21, 17, 14], [16, 16, 16, 16, 31], [4, 4, 31, 4, 4], [31, 17, 17, 17, 31], [0, 14, 14, 14, 0]];
function glyph5(px, x, y, id, c) { for (let r = 0; r < 5; r++) for (let b = 0; b < 5; b++) if ((GLY[id][r] >> (4 - b)) & 1) px.dot(x + b, y + r, c); }

// =====================================================================================================================
// SPACE behind the window (screen space, painted once): near-black violet, stars in three sizes, the Earth, the Moon
// =====================================================================================================================
const OCEAN = ['#060a20', '#0a1844', '#102c74', '#1a4aa2', '#2c70c6', '#5aa2e4'];
const CLOUD = ['#10163a', '#2e3c74', '#6a82ba', '#a0b6e2', '#d2def8'];
const LAND = ['#0c0f24', '#27294a', '#514a58', '#80705c', '#ae966c'];
const MOONC = ['#1c1c36', '#3e3e62', '#77779c', '#b0b0cc', '#e2e2f0'];
const SUN = (() => { const m = Math.hypot(-0.62, -0.42, 0.66); return [-0.62 / m, -0.42 / m, 0.66 / m]; })();
const TWINK = [];
function paintSpace() {
  const px = new Pix(-24, 16, W + 48, 150);
  px.shape(() => true, (x, y, ix, iy) => {
    const n = fbm(x / 90 + 3, y / 50 + 1, 5, 4), m = fbm(x / 40 + 11, y / 26 + 4, 9, 3);
    return band(SP, clamp((n - 0.42) * 2.2, 0, 1) * (0.5 + m * 0.6), ix, iy, 0.5);
  });
  for (let i = 0; i < 190; i++) {
    const x = Math.floor(-24 + hsh(i * 3.17) * (W + 48)), y = Math.floor(18 + hsh(i * 7.31) * 144), k = hsh(i * 1.93);
    const tint = i % 9 === 0 ? '#ffd9a8' : i % 11 === 0 ? '#a8e0ff' : i % 13 === 0 ? PAL.MAGL : null;
    if (k < 0.6) px.dot(x, y, P(tint || (k < 0.3 ? '#4a4f82' : '#7a80b4')));
    else if (k < 0.9) px.dot(x, y, P(tint || '#d4dcff'));
    else {
      px.dot(x, y, P('#ffffff'));
      for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px.dot(x + a, y + b, P(tint || '#7f88c4'));
      if (Math.hypot(x - EARTH.x, y - EARTH.y) > EARTH.r + 6 && Math.hypot(x - MOON.x, y - MOON.y) > MOON.r + 5) TWINK.push([x, y]);
    }
  }
  // the Earth: a blue marble with cloud swirls, lit from the upper left, a thin pale-blue atmosphere rim
  const E = EARTH;
  px.shape((x, y) => Math.hypot(x - E.x, y - E.y) <= E.r + 2.6, (x, y, ix, iy) => {
    const dx = (x - E.x) / E.r, dy = (y - E.y) / E.r, rr = dx * dx + dy * dy;
    if (rr > 1) {
      const d = (dx * SUN[0] + dy * SUN[1]) / Math.sqrt(rr), q = (Math.sqrt(rr) - 1) * E.r;
      if (d < -0.1) return 0;
      return q < 1.2 ? P(d > 0.3 ? '#8fd0ff' : '#3f6fc0') : (d > 0.3 && dith(ix, iy) < 0.5 ? P('#2c4a9c') : 0);
    }
    const nz = Math.sqrt(1 - rr), d = dx * SUN[0] + dy * SUN[1] + nz * SUN[2];
    const lon = Math.atan2(dx, nz) + 0.9, lat = Math.asin(clamp(dy, -1, 1)), u = lon * 1.5, v = lat * 1.5;
    const warp = fbm(u * 1.2 + 3, v * 1.2, 21, 3);
    const cl = fbm(u * 2.1 + warp * 1.8, v * 3.6 - warp * 1.1 + 5, 31, 4);
    const land = fbm(u * 1.5 + 7, v * 1.5 + 2, 41, 4);
    const k = clamp(d * 1.05 + 0.1, 0, 1);
    if (cl > 0.56) return band(CLOUD, k * (0.72 + (cl - 0.56) * 2.4), ix, iy);
    if (land > 0.56) return d < -0.02 && hsh(ix * 7.1 + iy * 3.3) > 0.88 ? P('#c98a16') : band(LAND, k * 0.95, ix, iy);
    return band(OCEAN, k * 0.88 + (nz < 0.4 && d > 0.2 ? 0.1 : 0) + (fbm(u * 3 + 1, v * 3, 51, 2) - 0.5) * 0.12, ix, iy);
  });
  // far away: two tiny eye saucers hauling cows up from the Earth
  for (const [x, y] of [[124, 74], [134, 103]]) {
    for (let j = 0; j < 6; j++) for (let i = -1 - (j >> 1); i <= 1 + (j >> 1); i++) px.dot(x + i, y + 2 + j, P(PAL.BEAM, 120 - j * 12));
    px.rect(x - 1, y + 7, 3, 2, P(PAL.C[2])); px.dot(x + 1, y + 7, P(PAL.C[4])); px.dot(x - 2, y + 7, P(PAL.C[1]));
    px.rect(x - 4, y, 9, 1, P(GR[4])); px.rect(x - 5, y + 1, 11, 1, P(GR[3])); px.rect(x - 3, y + 2, 7, 1, P(GR[1]));
    px.rect(x - 2, y - 2, 5, 2, P('#74d3ee')); px.dot(x - 2, y - 2, P('#dff9ff')); px.dot(x - 5, y + 1, P(PAL.AMB)); px.dot(x + 5, y + 1, P(PAL.AMB));
  }
  // the Moon
  const M = MOON;
  px.shape((x, y) => Math.hypot(x - M.x, y - M.y) <= M.r, (x, y, ix, iy) => {
    const dx = (x - M.x) / M.r, dy = (y - M.y) / M.r, nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
    const d = dx * SUN[0] + dy * SUN[1] + nz * SUN[2], cr = fbm(x / 2.6, y / 2.6, 77, 2);
    return band(MOONC, clamp(d * 1.1 + 0.08, 0, 1) * (cr < 0.42 ? 0.72 : 1), ix, iy);
  });
  return px.canvas();
}

// =====================================================================================================================
// THE BRIDGE (world space at the arena, painted once): ceiling beam with a cyan strip, the panoramic window frame
// (chamfered panes, bevelled struts, glass reflections), the sill, a dark console row along the back wall, the holo
// globe's pedestal, the captain's podium with its chair on the right, a locked door on the left
// =====================================================================================================================
const STRUTS = [-16, 146, 300, 452, 620], CH = 10;
function glass(x, y) {
  if (y < WIN.y0 || y >= WIN.y1) return false;
  for (let i = 0; i < STRUTS.length - 1; i++) {
    const a = STRUTS[i] + 5, b = STRUTS[i + 1] - 5;
    if (x < a || x >= b) continue;
    return Math.min(x - a, b - x) + Math.min(y - WIN.y0, WIN.y1 - y) >= CH;
  }
  return false;
}
const BLINKS = [];                        // live lamps on the consoles: [x, y, colour, phase]
function paintWall() {
  const px = new Pix(-24, 0, W + 48, 222);
  px.shape(() => true, (x, y, ix, iy) => {
    if (glass(x, y)) {                    // the glass: nearly clear, faint diagonal reflections, a cool tint at the top
      const st = ((ix + iy * 0.7) % 96 + 96) % 96;
      if (!glass(x - 1, y) || !glass(x, y - 1)) return P(S[0], 150);
      if (st < 7 || (st > 14 && st < 17)) return P('#9fb4ee', 16);
      return y < 64 ? P('#2a3a8a', Math.round((64 - y) * 1.6)) : 0;
    }
    if (y < WIN.y0) {                     // the ceiling beam
      if (y < 2) return P(S[0]);
      if (iy >= 8 && iy <= 13) return P((ix + 24) % 44 < 3 ? S[4] : iy === 8 ? S[4] : iy < 12 ? S[3] : S[1]);   // a pipe with clamps
      if (iy === 22) return P(S[4]);
      if (iy === 23) return P(S[0]);
      if (iy === 30 || iy === 31) return (ix + 24) % 30 < 24 ? P(iy === 30 ? PAL.CYAN : CY1) : P(S[0]);        // cyan strip
      if (iy === 29 || iy === 32) return P(S[0]);
      if (iy >= 36) return P(iy === 36 ? S[3] : S[1]);
      const sm = (ix + 24) % 60;
      return P(sm === 0 ? S[0] : sm === 1 ? S[3] : S[2]);
    }
    if (y < WIN.y1) {                     // window frame: bevels toward the glass, a seam and bolts on the struts
      if (glass(x + 2, y)) return P(S[0]);
      if (glass(x, y + 2)) return P(S[1]);
      if (glass(x - 2, y)) return P(S[5]);
      if (glass(x, y - 2)) return P(S[5]);
      for (const sx of STRUTS) if (Math.abs(x - sx) < 5) {
        if (Math.abs(ix - sx) < 1 && iy % 18 === 9) return P(S[5]);
        if (Math.abs(ix - sx) < 1 && iy % 18 === 10) return P(S[0]);
        return P(ix < sx - 2 ? S[4] : ix > sx + 1 ? S[2] : S[3]);
      }
      return P(S[2]);
    }
    // the sill
    if (iy === 150) return P(S[5]);
    if (iy === 151) return P(S[4]);
    if (iy < 157) return P((ix + 24) % 36 === 0 ? S[1] : S[3]);
    if (iy === 157) return P(S[2]);
    if (iy === 158) return P(S[0]);
    // the back wall under the window: dark panels, a seam, a dim magenta guide strip low
    const pm = (ix + 24) % 48, pid = Math.floor((ix + 24) / 48);
    if (pm === 0) return P(S[0]);
    if (pm === 1) return P(S[2]);
    if (iy === 188) return P(S[0]);
    if (iy === 189) return P(S[2]);
    if (iy === 208 || iy === 209) return (ix + 24) % 24 < 17 ? P(iy === 208 ? MG1 : MG0) : P(S[0]);
    if (iy > 192 && iy < 204 && pid % 3 === 1 && pm > 10 && pm < 38 && iy % 3 === 0) return P(S[0]);            // vent slots
    return P(hsh(pid * 3.7) > 0.5 ? S[1] : '#1b1936');
  });
  const scr = (x, y, w, h, g, eye) => {   // a small screen: dark glass, glyph rows in dim cyan (or the green eye mark)
    px.rect(x - 1, y - 1, w + 2, h + 2, P(S[3])); px.rect(x - 1, y - 1, w + 2, 1, P(S[4])); px.rect(x, y, w, h, P('#070c1e'));
    if (eye) { glyph5(px, x + ((w - 5) >> 1), y + ((h - 5) >> 1), 7, P(GR[3])); px.dot(x + ((w - 5) >> 1) + 2, y + ((h - 5) >> 1) + 2, P(GR[5])); return; }
    glyph5(px, x + 2, y + 1, g, P(CY1));
    for (let j = 0; j < h - 2; j += 2) { const n = 2 + Math.floor(hsh(x * 3.1 + j * 7.7) * (w - 11)); if (w > 12) px.rect(x + 9, y + 1 + j, Math.max(1, n), 1, P(j % 4 ? CY0 : CY1)); }
  };
  const desk = (x, w, top, o = {}) => {   // a console: a slanted key panel, a body with a kick plate, a screen on a neck
    px.rect(x, top, w, 1, P(S[5])); px.rect(x, top + 1, w, 3, P(S[4])); px.rect(x, top + 4, w, 1, P(S[1]));
    for (let i = 0; i < Math.floor((w - 4) / 3); i++) px.dot(x + 2 + i * 3, top + 2, P([AM1, MG1, CY1, S[2], AM1, CY1, S[2]][(i + x) % 7]));
    px.rect(x + 1, top + 5, w - 2, DECK - top - 5, P(S[2])); px.rect(x + 1, top + 5, 1, DECK - top - 5, P(S[3])); px.rect(x + w - 2, top + 5, 1, DECK - top - 5, P(S[0]));
    px.rect(x + 1, DECK - 5, w - 2, 5, P(S[0])); px.rect(x + 4, top + 9, w - 8, 1, P(S[1])); px.rect(x + 4, top + 10, w - 8, 1, P(S[3]));
    BLINKS.push([x + w - 5, top + 13, o.lamp || PAL.AMB, x]);
    if (o.scr) { px.rect(x + (w >> 1) - 1, top - 4, 2, 4, P(S[3])); scr(x + (w >> 1) - (o.sw || 14) / 2, top - 14, o.sw || 14, 9, o.g || 0, o.eye); }
  };
  const stool = x => {
    px.rect(x - 4, 216, 8, 2, P(S[0])); px.rect(x - 1, 204, 2, 12, P(S[3])); px.rect(x - 5, 201, 10, 3, P(MG0)); px.rect(x - 5, 201, 10, 1, P(MG1)); px.rect(x - 6, 202, 1, 1, P(MG0)); px.rect(x + 5, 202, 1, 1, P(MG0));
  };
  // the locked door on the left (hazard stripes)
  px.rect(-24, 156, 36, 62, P(S[2])); px.rect(10, 156, 3, 62, P(S[4])); px.rect(13, 156, 1, 62, P(S[0]));
  for (let y = 160; y < 216; y++) for (let x = -24; x < 10; x++) { const band = (y >= 162 && y < 168) || (y >= 206 && y < 212); if (band) px.dot(x, y, P(((x + y + 400) >> 2) % 2 ? AM1 : '#1c1a24')); }
  px.rect(-24, 186, 34, 1, P(S[0])); px.rect(-24, 187, 34, 1, P(S[3]));
  BLINKS.push([4, 175, '#ff3b30', 3]);
  // consoles along the back wall
  desk(52, 30, 184, { scr: true, g: 1 }); desk(88, 22, 190, {}); stool(70);
  desk(124, 34, 180, { scr: true, eye: true, sw: 12 }); stool(142);
  // a wall display counting the cows they have taken (a cow pictogram, glyph digits, bars)
  px.rect(151, 163, 40, 18, P(S[3])); px.rect(151, 163, 40, 1, P(S[5])); px.rect(152, 164, 38, 16, P('#070c1e'));
  px.rect(156, 168, 6, 3, P(PAL.C[1])); px.rect(156, 168, 6, 1, P(PAL.C[2])); px.rect(161, 166, 3, 3, P(PAL.C[2])); px.dot(163, 165, P(PAL.CREAM)); px.dot(156, 171, P(PAL.C[0])); px.dot(160, 171, P(PAL.C[0])); px.dot(155, 169, P(PAL.C[0]));
  glyph5(px, 167, 166, 9, P(CY0)); glyph5(px, 174, 166, 0, P(CY1)); glyph5(px, 181, 166, 1, P(CY1));
  for (let i = 0; i < 11; i++) px.rect(155 + i * 3, 177 - Math.round(hsh(i * 2.7) * 3), 2, 1 + Math.round(hsh(i * 2.7) * 3), P(i > 7 ? MG1 : CY0));
  BLINKS.push([186, 174, '#ff3b30', 5]);
  // the holo globe's pedestal (the hologram itself is drawn live)
  px.shape(polyIn([[26, 218], [28, 204], [41, 204], [43, 218]]), (x, y) => P(x < 30 ? S[4] : x > 39 ? S[1] : S[3]));
  px.rect(27, 203, 15, 1, P(CY1)); px.rect(30, 201, 9, 2, P(S[4])); px.rect(32, 200, 5, 1, P(PAL.CYAN));
  // the captain's podium on the right: a step, a hazard-striped edge, the captain's chair (a tall throne, gold trim)
  px.rect(436, 212, 10, 6, P(S[2])); px.rect(436, 212, 10, 1, P(S[4]));
  px.rect(446, 205, 64, 13, P(S[2])); px.rect(446, 205, 64, 1, P(S[5])); px.rect(446, 206, 64, 1, P(S[3]));
  for (let y = 208; y < 212; y++) for (let x = 446; x < 504; x++) px.dot(x, y, P(((x + y) >> 2) % 2 ? AM1 : '#1c1a24'));
  const TX = 464;
  px.shape((x, y) => Math.abs(x - TX) <= 13 && y >= 153 && y < 198 && Math.hypot(Math.max(0, Math.abs(x - TX) - 5), Math.min(0, y - 162)) <= 8.6, (x, y) => {
    const e = Math.abs(x - TX) > 10.6 || Math.hypot(Math.max(0, Math.abs(x - TX) - 5), Math.min(0, y - 162)) > 6.4;
    if (e) return P(x < TX - 6 || y < 157 ? S[5] : S[3]);
    return P((Math.floor(y / 6) + Math.floor((x + (Math.floor(y / 6) % 2) * 3) / 6)) % 2 === 0 && y % 6 === 2 && Math.floor(x) % 6 === 2 ? MG1 : y % 6 === 5 ? '#44183e' : x < TX - 6 ? MG0 : '#5c2052');
  });
  px.rect(TX - 10, 154, 20, 1, P(AM1)); px.rect(TX - 12, 156, 1, 3, P(AM1)); px.rect(TX + 12, 156, 1, 3, P(AM1));
  glyph5(px, TX - 2, 160, 7, P(GR[3])); px.dot(TX, 162, P(GR[5]));
  px.rect(TX - 17, 183, 5, 3, P(S[5])); px.rect(TX - 17, 186, 3, 8, P(S[3])); px.rect(TX + 13, 183, 5, 3, P(S[4])); px.rect(TX + 15, 186, 3, 8, P(S[2]));
  px.rect(TX - 14, 192, 28, 4, P(MG0)); px.rect(TX - 14, 192, 28, 1, P(MG1)); px.rect(TX - 15, 196, 30, 2, P(S[4])); px.rect(TX - 15, 198, 30, 1, P(S[1]));
  px.rect(TX - 4, 199, 8, 6, P(S[2])); px.rect(TX - 4, 199, 2, 6, P(S[4]));
  for (const sx of STRUTS.slice(0, 4)) for (const y of [62, 118]) { px.rect(sx - 1, y, 2, 4, P(CY1)); px.rect(sx - 1, y, 2, 1, P(PAL.CYANL)); px.rect(sx - 2, y - 1, 4, 1, P(S[0])); px.rect(sx - 2, y + 4, 4, 1, P(S[0])); }
  // a sign plaque on the ceiling beam (alien glyphs in cyan)
  px.rect(250, 5, 62, 13, P(S[0])); px.rect(251, 6, 60, 11, P('#070c1e')); px.rect(250, 5, 62, 1, P(S[4]));
  [0, 2, 1, 5, 3, 9, 0, 8].forEach((g, i) => glyph5(px, 254 + i * 7, 9, g, P(i === 3 ? PAL.CYAN : CY1)));
  return px.canvas();
}

// the deck (world space, painted once): a bright top edge, a thin top face, a front face with panels and a magenta strip
function paintDeck() {
  const px = new Pix(-24, 214, W + 48, 56);
  px.shape((x, y) => y >= DECK, (x, y, ix, iy) => {
    const d = iy - DECK, u = ix + 24;
    if (d === 0) return P(S[7]);
    if (d < 5 && ix > B.cx - 96 + d * 2 && ix < B.cx + 96 - d * 2) return P(((ix + d * 2) >> 2) % 2 ? (d < 3 ? PAL.AMB : '#c9a030') : '#22222c');   // the captain's pad
    if (d < 5) return P((u + d * 3) % 40 === 0 ? S[2] : d === 1 ? S[5] : d < 4 ? S[4] : S[3]);
    if (d === 5) return P(S[6]);
    if (d === 6) return P(S[3]);
    if (d === 7 || d === 8) return P(S[0]);
    if (d < 31) {
      const pm = u % 56;
      if (pm === 0) return P(S[0]);
      if (pm === 1 || d === 9) return P(S[3]);
      if (d === 13 || d === 14) return u % 22 < 15 ? P(d === 13 ? PAL.MAGL : PAL.MAG) : P(S[0]);
      if (d === 12 || d === 15) return P(S[0]);
      if (d > 19 && d < 28 && Math.floor(u / 56) % 2 === 0 && pm > 12 && pm < 44 && d % 2 === 0) return P(S[0]);
      if ((pm === 4 || pm === 52) && (d === 18 || d === 28)) return P(S[4]);
      return P(S[2]);
    }
    if (d === 31) return P(S[4]);
    if (d === 32) return P(S[0]);
    const py = d - 36;
    if (py >= 0 && py < 5) return P(u % 70 < 3 ? S[3] : py === 0 ? S[3] : py < 3 ? S[2] : S[0]);
    return P(S[1]);
  });
  return px.canvas();
}

// low foreground at the very bottom (screen space, painted once): the backs of the near consoles, cables, a railing
function paintFront() {
  const px = new Pix(-10, 228, W + 20, 44);
  const hump = (x0, x1, top, r) => (x, y) => x >= x0 && x < x1 && y >= top && Math.hypot(Math.max(0, Math.max(x0 + r - x, x - (x1 - r))), Math.max(0, top + r - y)) <= r;
  const body = (f, x0, x1) => px.shape(f, (x, y, ix, iy) => {
    if (!f(x, y - 1.2)) return P(S[5]);
    if (!f(x, y - 2.4)) return P(S[3]);
    if (!f(x - 1.5, y)) return P(S[3]);
    if (!f(x + 1.5, y)) return P(S[0]);
    return P((ix - x0) % 26 === 12 ? S[0] : (ix - x0) % 26 === 13 ? S[2] : S[1]);
  }, x0, 228, x1, 272);
  // a low railing with a magenta light strip between the two near stations
  px.rect(78, 262, 322, 1, P(S[4])); px.rect(78, 263, 322, 2, P(S[1])); px.rect(78, 265, 322, 1, P(S[0]));
  for (let x = 96; x < 390; x += 20) px.rect(x, 263, 8, 1, P(x % 40 < 20 ? MG1 : MG0));
  for (let x = 110; x < 390; x += 46) { px.rect(x, 265, 3, 7, P(S[1])); px.rect(x, 265, 1, 7, P(S[3])); }
  body(hump(84, 134, 256, 6), 84, 134); body(hump(338, 392, 257, 6), 338, 392);
  body(hump(-10, 78, 247, 9), -10, 78); body(hump(400, 490, 245, 10), 400, 490);
  // the backs of two monitors (their screens light the edges cyan), key lamps along the desk edges, a lever
  for (const [x, y, w, h] of [[4, 234, 26, 13], [456, 232, 24, 13]]) {
    px.rect(x, y, w, h, P(S[0])); px.rect(x, y, w, 1, P(CY1)); px.rect(x, y + 1, 1, h - 1, P(CY0)); px.rect(x + w - 1, y + 1, 1, h - 1, P(CY0)); px.rect(x + 1, y + 1, w - 2, 1, P(S[3]));
    px.rect(x + 4, y + 4, w - 8, 1, P(S[2])); px.rect(x + 4, y + 7, w - 8, 1, P(S[2])); px.dot(x + w - 4, y + h - 3, P(AM1));
  }
  for (const [x, y, c] of [[56, 249, AM1], [61, 249, MG1], [66, 249, CY1], [92, 258, CY1], [98, 258, AM1], [122, 258, MG1], [410, 247, CY1], [415, 247, MG1], [420, 247, AM1], [346, 259, MG1], [352, 259, CY1], [382, 259, AM1]]) { px.rect(x, y, 3, 2, P(c)); px.dot(x, y, P('#ffffff')); }
  px.rect(110, 248, 2, 8, P(S[4])); px.rect(108, 245, 6, 4, P(MG1)); px.rect(108, 245, 6, 1, P(PAL.MAGL)); px.rect(107, 246, 1, 2, P(MG0)); px.rect(114, 246, 1, 2, P(MG0));
  px.rect(364, 250, 2, 7, P(S[4])); px.rect(362, 247, 6, 4, P(AM1)); px.rect(362, 247, 6, 1, P(PAL.AMBL));
  return px.canvas();
}

// =====================================================================================================================
// THE MEGA OGGLE (design coordinates, painted once). A heavy bell of green armour plates (seams, rivets) on a saucer
// skirt; ONE enormous eye in a thick steel bezel; a grumpy grille mouth; a crown of three antennae; a tiny captain's
// cap; two ribbed cable arms with claw hands. Live: iris, eyelids, lamps, thrusters, beam, tractor beam.
// =====================================================================================================================
const nyOf = y => (y - B.eq) / (y < B.eq ? B.ryT : B.ryB);
const hw = y => { const n = Math.abs(nyOf(y)); return n >= 1 ? 0 : B.rx * Math.pow(1 - Math.pow(n, B.p), 1 / B.p); };
const collarY = x => { const k = (x - B.cx) / 64; return Math.abs(k) >= 1 ? SKY : SKY + 6.5 * Math.sqrt(1 - k * k); };
const BODY = (x, y) => y >= B.eq - B.ryT && y <= collarY(x) && Math.abs(x - B.cx) <= hw(y);
const LGT = (() => { const m = Math.hypot(-0.5, -0.62, 0.6); return [-0.5 / m, -0.62 / m, 0.6 / m]; })();
function bodyLight(x, y) {
  const nx = (x - B.cx) / B.rx, ny = nyOf(y), ax = Math.abs(nx), ay = Math.abs(ny), p = B.p;
  const f = Math.min(1, Math.pow(ax, p) + Math.pow(ay, p));
  const gx = Math.sign(nx) * Math.pow(ax, p - 1), gy = Math.sign(ny) * Math.pow(ay, p - 1), gz = Math.pow(1 - f, (p - 1) / p);
  const m = Math.hypot(gx, gy, gz) || 1;
  return (gx * LGT[0] + gy * LGT[1] + gz * LGT[2]) / m;
}
// armour plates: three bands (dome, face, jaw) split by meridian seams
const angOf = (x, y) => Math.asin(clamp((x - B.cx) / (hw(y) || 1), -1, 1)) / DEG;
const seamA = x => 106 - 8 * (1 - ((x - B.cx) / B.rx) ** 2);
const seamB = x => 172 + 5 * (1 - ((x - B.cx) / B.rx) ** 2);
const MER = [[-40, 6, 46], [-62, 30, 62], [-56, 24, 58]];
function plateAt(x, y) {
  const band = y < seamA(x) ? 0 : y < seamB(x) ? 1 : 2, a = angOf(x, y);
  let sec = 0; for (const m of MER[band]) if (a > m) sec++;
  return band * 4 + sec;
}
const ANT = [{ bx: B.cx - 40, by: 80, tx: B.cx - 52, ty: 61, bend: -2 }, { bx: B.cx + 16, by: 74, tx: B.cx + 20, ty: 47, bend: 1 }, { bx: B.cx + 40, by: 80, tx: B.cx + 54, ty: 60, bend: 2 }];
const topEdge = x => SKY + SKRY * Math.sqrt(Math.max(0, 1 - ((x - B.cx) / SKRX) ** 2));
const lowEdge = x => { const k = (x - B.cx) / (SKRX - 3); return Math.abs(k) >= 1 ? SKY : SKY + 3 + 14 * Math.sqrt(1 - k * k); };
const NOZ = [-46, 0, 46];
const MX = EX - 2, MW = 32, mT = x => 181 + 6 * ((x - MX) / MW) ** 2;
const MOUTH = (x, y) => Math.abs(x - MX) <= MW && y >= mT(x) && y <= mT(x) + 8;
const lineU = x => EY - 9 - (x - EX) * 0.2;           // the upper lid's lower edge (lower toward the hero: grumpy)
const lineL = x => EY + 18 + (x - EX) * 0.04;         // the lower lid's upper edge
const BROW = [[EX - 37, EY - 19], [EX - 34, EY - 30], [EX + 33, EY - 43], [EX + 37, EY - 32]];   // the brow plate over the eye, tilted down toward the hero
const COLLAR_LAMPS = [];
const SHO = [[B.cx - 74, 128], [B.cx + 74, 128]];

function paintBody() {
  const px = new Pix(250, 36, 236, 186);
  // ---- antenna stalks (springy, with coil turns), behind the dome
  for (const a of ANT) {
    const n = Math.ceil(Math.hypot(a.tx - a.bx, a.ty - a.by));
    for (let k = 0; k <= n; k++) {
      const q = k / n, x = Math.round(lerp(a.bx, a.tx, q) + Math.sin(q * Math.PI) * a.bend), y = Math.round(lerp(a.by, a.ty, q));
      px.dot(x, y, P(METD)); px.dot(x + 1, y, P(METL));
      if (k % 4 === 1) { px.dot(x - 1, y, P(MET)); px.dot(x + 2, y, P(METD)); }
    }
    px.rect(a.bx - 3, a.by - 2, 8, 4, P(METD)); px.rect(a.bx - 3, a.by - 2, 8, 1, P(METL));
  }
  // ---- the saucer skirt: top face (bevel, groove, plates with radial seams), then the body stands in it
  const skq = (x, y) => Math.hypot((x - B.cx) / SKRX, (y - SKY) / SKRY);
  px.shape((x, y) => skq(x, y) <= 1, (x, y) => {
    const q = skq(x, y), left = x < B.cx + 24, a = Math.atan2((y - SKY) / SKRY, (x - B.cx) / SKRX) / DEG;
    if (q > 0.93) return P(left ? GR[5] : GR[4]);
    if (q > 0.87) return P(GR[1]);
    if (q > 0.7) return P(((a + 360) % 18) < 1.2 ? GR[1] : left ? GR[4] : GR[3]);
    if (q > 0.66) return P(GR[1]);
    return P(GR[2]);
  });
  // ---- the bowl under the top face: a steel rim band, a green underside, three thruster nozzles
  px.shape((x, y) => Math.abs(x - B.cx) < SKRX && y > topEdge(x) && y <= Math.max(lowEdge(x), topEdge(x) + 2.5), (x, y) => {
    const d = y - topEdge(x), left = x < B.cx - 20;
    if (d < 1) return P(left ? '#ffffff' : METL);
    if (d < 3) return P(left ? METL : MET);
    if (d < 4) return P(METD);
    return P(lowEdge(x) - y < 2 ? GR[0] : d < 7 ? (left ? GR[3] : GR[2]) : GR[1]);
  });
  for (const nx of NOZ) {
    const x0 = B.cx + nx, yb = Math.round(lowEdge(x0)) - 1;
    for (let r = 0; r < 4; r++) { const h2 = 7 - r; px.rect(x0 - h2, yb + r, h2 * 2, 1, P(r === 3 ? METDD : METD)); px.dot(x0 - h2, yb + r, P(METL)); px.dot(x0 - h2 + 1, yb + r, P(MET)); }
  }
  // ---- the body: flat bands of green (lit from the upper left), each plate a touch different, seams with a lit lip
  px.shape(BODY, (x, y) => {
    const pl = plateAt(x, y);
    if (pl !== plateAt(x + 1, y) || pl !== plateAt(x, y + 1)) return P(GR[0]);
    const l = bodyLight(x, y) + (hsh(pl * 7.31) - 0.5) * 0.14;
    let tone = l > 0.9 ? 5 : l > 0.7 ? 4 : l > 0.42 ? 3 : l > 0.12 ? 2 : 1;
    if (pl !== plateAt(x - 1, y) || pl !== plateAt(x, y - 1)) tone = Math.min(5, tone + 1);
    if (tone < 2 && x > B.cx && !BODY(x + 2.5, y)) tone = 2;                       // reflected light on the far edge
    if (y > collarY(x) - 9 && tone > 1) tone--;                                      // the body sinks into the skirt
    // the eye's deep socket and the brow shade the plates round them
    const de = Math.hypot(x - EX, y - EY);
    if (de < BR + 4 && tone > 1) tone--;
    // a glossy streak on the dome, and the beam's light catching the near edge
    const nx = (x - B.cx) / B.rx, ny = nyOf(y);
    if (nx < 0 && ny < 0) {
      const f = Math.pow(-nx, B.p) + Math.pow(-ny, B.p), a = Math.atan2(-ny, -nx) / DEG;
      if (f > 0.6 && f < 0.74 && a > 24 && a < 60) tone = f > 0.64 && f < 0.7 && a > 30 && a < 54 ? 6 : 5;
    }
    if (x < B.cx - 30 && y > 150 && !BODY(x - 2.2, y)) tone = 5;
    // the muzzle: a raised plate round the mouth
    const md = y - mT(x);
    if (Math.abs(x - MX) <= MW + 8 && md >= -7 && md <= 16) {
      if (Math.abs(x - MX) > MW + 7 || md < -6) return P(GR[0]);
      tone = md < -4.6 ? 5 : x < MX + 10 ? 4 : 3;
    }
    return P(GR[tone]);
  });
  // rivets along the seams
  const rivet = (x, y) => { x = Math.round(x); y = Math.round(y); if (Math.hypot(x - EX, y - EY) > BR + 5 && BODY(x + 0.5, y + 0.5) && BODY(x + 2.5, y + 2.5) && BODY(x - 1.5, y - 1.5)) { px.dot(x, y, P(GR[5])); px.dot(x + 1, y + 1, P(GR[0])); px.dot(x + 1, y, P(GR[1])); px.dot(x, y + 1, P(GR[1])); } };
  for (let a = -72; a <= 72; a += 16) {
    for (const [sm, off] of [[seamA, -4], [seamA, 4], [seamB, -4], [seamB, 4]]) {
      let x = B.cx; for (let k = 0; k < 4; k++) x = B.cx + Math.sin(a * DEG) * hw(sm(x) + off);
      rivet(x, sm(x) + off);
    }
  }
  MER.forEach((ms, band) => ms.forEach(m => {
    const [y0, y1] = band === 0 ? [80, 96] : band === 1 ? [116, 164] : [180, 190];
    for (let y = y0; y <= y1; y += 16) for (const o of [-4, 4]) rivet(B.cx + Math.sin(m * DEG) * hw(y) + o, y);
  }));
  // a hatch on the dome, louvres on the far flank, dings from the fight
  const hx = B.cx + 20;
  px.rect(hx, 86, 15, 1, P(GR[1])); px.rect(hx, 95, 15, 1, P(GR[1])); px.rect(hx, 86, 1, 10, P(GR[1])); px.rect(hx + 14, 86, 1, 10, P(GR[1])); px.rect(hx + 1, 87, 13, 1, P(GR[4])); px.rect(hx + 5, 90, 5, 2, P(GR[1])); px.rect(hx + 5, 90, 5, 1, P(GR[5]));
  for (let i = 0; i < 4; i++) { px.rect(B.cx + 44, 118 + i * 5, 14, 2, P(GR[0])); px.rect(B.cx + 44, 120 + i * 5, 14, 1, P(GR[3])); }
  for (const [x, y] of [[B.cx - 60, 112], [B.cx - 64, 156], [B.cx - 36, 94], [B.cx + 30, 176], [B.cx - 58, 174]]) { px.dot(x, y, P(GR[1])); px.dot(x + 1, y, P(GR[1])); px.dot(x, y + 1, P(GR[5])); px.dot(x + 1, y + 1, P(GR[5])); }
  px.line(B.cx - 56, 98, B.cx - 49, 93, P(GR[5])); px.line(B.cx - 55, 99, B.cx - 50, 95, P(GR[2]));
  for (let y = 0; y < 5; y++) for (let x = 0; x < 16; x++) px.dot(B.cx + 41 + x, 164 + y, P(x === 0 || x === 15 || y === 0 || y === 4 ? GR[0] : ((x + y) >> 1) % 2 ? PAL.AMB : '#22222c'));   // a hazard-striped access plate
  for (let i = 0; i < 3; i++) { px.rect(B.cx - 68, 140 + i * 5, 3, 3, P(GR[0])); px.dot(B.cx - 67, 141 + i * 5, P(i === 1 ? PAL.CYAN : PAL.CYANL)); }
  // the captain's medals pinned on its chest: three ribbons with gold discs
  [[PAL.MAG, PAL.MAGL], [PAL.CYAN, PAL.CYANL], ['#ff3b30', '#ffb0a8']].forEach(([c, cl], i) => {
    const x = B.cx + 43 + i * 7, y = 146 + (i === 1 ? 1 : 0);
    px.rect(x - 1, y - 1, 6, 12, P(GR[0])); px.rect(x, y, 4, 5, P(c)); px.rect(x, y, 1, 5, P(cl)); px.rect(x, y + 5, 4, 4, P(PAL.AMB)); px.rect(x, y + 5, 2, 2, P(PAL.AMBL)); px.dot(x + 3, y + 8, P('#c98a16'));
  });
  // ---- the steel collar where the body meets the skirt, with a row of amber lamps
  px.shape((x, y) => BODY(x, y) && y > collarY(x) - 5.5, (x, y) => { const d = collarY(x) - y; return P(d > 4.5 ? METL : d > 2 ? MET : d > 1 ? METD : METDD); });
  for (let a = -70; a <= 70; a += 20) { const x = Math.round(B.cx + Math.sin(a * DEG) * 60), y = Math.round(collarY(x) - 4); COLLAR_LAMPS.push([x, y]); px.rect(x, y, 2, 2, P(AM0)); }
  // ---- the eye: a dark recess, a thick steel bezel with bolts, the big white lens
  px.shape((x, y) => Math.hypot(x - EX, y - EY) <= BR + 1.8, (x, y) => {
    const dx = x - EX, dy = y - EY, d = Math.hypot(dx, dy) || 1, l = lit(dx / d, dy / d);
    if (d > BR) return P(GR[0]);
    if (d > LR) {
      const q = (d - LR) / (BR - LR);
      if (q < 0.16) return P(METDD);
      if (q > 0.9) return P(l > 0.3 ? METL : METD);
      return steel(q > 0.5 ? l * (0.6 + q * 0.6) : 0.1 - l * 0.9);
    }
    const sh = dx * 0.35 + dy * 0.94;
    if (d > LR - 1.4) return P(l > 0 ? PAL.EYES : '#dfeaf4');
    return P(sh > LR * 0.84 ? '#93a9c4' : sh > LR * 0.56 ? PAL.EYES : PAL.EYEW);
  });
  for (let k = 0; k < 8; k++) { const a = (k * 45 + 22.5) * DEG, x = Math.round(EX + Math.cos(a) * 27.6 - 0.5), y = Math.round(EY + Math.sin(a) * 27.6 - 0.5); px.rect(x - 1, y - 1, 3, 3, P(METDD)); px.rect(x - 1, y - 1, 2, 2, P(METL)); px.dot(x - 1, y - 1, P('#ffffff')); }
  // ---- the mouth: a grumpy steel grille (corners turned down), a furnace glowing behind the bars
  px.shape((x, y) => Math.abs(x - MX) <= MW + 2 && y >= mT(x) - 2 && y <= mT(x) + 10, (x, y) => {
    if (!MOUTH(x, y)) return P(y < mT(x) ? METL : y > mT(x) + 8 ? METDD : Math.abs(x - MX) > MW ? METD : MET);
    const bx = (Math.floor(x) - MX + 120) % 6, d = y - mT(x);
    if (bx < 2) return P(d < 1.5 ? METL : bx ? METD : MET);
    return P(d > 6 ? '#c97a14' : d > 4 ? '#6a3c10' : '#0c1410');
  });
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { px.dot(MX + s * (MW + 3 + k), mT(MX + MW) + 8 + k, P(GR[0])); px.dot(MX + s * (MW + 3 + k), mT(MX + MW) + 9 + k, P(GR[0])); }
  // ---- the tiny captain's cap: white crown, navy band with a gold badge, a black visor toward the hero
  const CX = B.cx - 10, CY = 74, CA = -0.17;
  const cap = (f, col) => px.shape((x, y) => { const [u, v] = rot(x, y, CX, CY, CA); return f(u, -v); }, (x, y) => { const [u, v] = rot(x, y, CX, CY, CA); return col(u, -v); }, CX - 34, CY - 24, CX + 28, CY + 12);
  cap((u, w) => ((u - 1) / 21) ** 2 + ((w - 8) / 7) ** 2 <= 1 && w >= 5, (u, w) => P(u > 12 || w < 6.5 ? '#aebbdc' : w > 12 && u < 4 ? '#ffffff' : '#eef2ff'));
  cap((u, w) => Math.abs(u) <= 16 && w >= 0 && w < 5.5, (u, w) => P(w >= 2 && w < 3.4 ? PAL.AMB : u > 10 ? '#121a3c' : w > 4.4 ? '#34468c' : '#22306a'));
  cap((u, w) => ((u + 11) / 3.6) ** 2 + ((w - 3.4) / 3.6) ** 2 <= 1, (u, w) => P(u < -11.5 && w > 3.6 ? PAL.AMBL : w < 1.6 ? '#c98a16' : PAL.AMB));
  cap(polyIn([[-12, 1.2], [-27, -3.4], [-26, -6.6], [-10, -2.2]]), (u, w) => P(w > -2.0 + (u + 19) * 0.3 ? '#6a6a94' : '#15151f'));
  // ---- shoulders: a steel ball joint in a dark socket, a captain's gold epaulette on top
  for (const [sx, sy] of SHO) {
    px.disc(sx, sy, 9.2, P(GR[0]));
    px.shape((x, y) => Math.hypot(x - sx, y - sy) <= 7.6, (x, y) => { const d = Math.hypot(x - sx, y - sy) || 1; return steel(lit((x - sx) / d, (y - sy) / d) * d / 7.6 + 0.1); });
    px.shape((x, y) => ((x - sx) / 11) ** 2 + ((y - sy + 10) / 3.6) ** 2 <= 1, (x, y) => P(y < sy - 11 ? PAL.AMBL : y < sy - 9 ? PAL.AMB : '#c98a16'));
    for (let i = -4; i <= 4; i++) { px.rect(sx + i * 2.4 - 0.5, sy - 7, 1, 4, P(i % 2 ? PAL.AMB : '#c98a16')); px.dot(sx + i * 2.4 - 0.5, sy - 3, P(PAL.AMBL)); }
  }
  px.outline();
  return px;
}

// the iris: a steel camera-shutter ring round a red iris with shutter blades; white-hot in the middle while it fires
function paintIris(hot) {
  const px = new Pix(-15, -15, 30, 30);
  px.shape((x, y) => x * x + y * y <= 13.6 * 13.6, (x, y) => {
    const d = Math.hypot(x, y), a = ((Math.atan2(y, x) / DEG) + 360) % 360;
    if (d > 12.6) return P(METDD);
    if (d > 10.6) return P(a % 30 < 8 ? METDD : lit(x / d, y / d) > -0.1 ? METL : MET);
    if (d > 9.8) return P(PAL.IRISD);
    const blade = ((a + d * 6) % 60) < 8;
    if (!hot) return d < 4.8 ? P(PAL.PUP) : P(blade ? PAL.IRISD : x * 0.4 + y * 0.9 > 4 ? '#d62a22' : PAL.IRIS);
    if (d > 7.4) return P(blade ? PAL.IRISD : PAL.IRIS);
    if (d > 5.6) return P(blade ? '#c9540f' : '#ff8a2a');
    if (d > 4) return P(blade ? '#f0b030' : PAL.WARN);
    return P('#ffffff');
  });
  if (!hot) { px.rect(-3, -3, 2, 2, P('#ffffff')); }
  return px.canvas();
}
// the eyelids (armour shutters inside the bezel: a slat seam, rivets, a thick lip) and the heavy brow plate above
function paintLids() {
  const up = new Pix(EX - 40, EY - 44, 80, 48), lo = new Pix(EX - 26, EY + 12, 52, 16);
  up.shape((x, y) => Math.hypot(x - EX, y - EY) <= LR + 0.4 && y < lineU(x), (x, y) => {
    const d = lineU(x) - y;
    if (d < 1) return P(GR[0]);
    if (d < 2.2) return P(GR[2]);
    if (d < 4) return P(GR[5]);
    if (Math.abs(d - 9.5) < 0.5) return P(GR[1]);
    if (Math.abs(d - 8.5) < 0.5) return P(GR[5]);
    return P(x < EX - 4 ? GR[4] : GR[3]);
  });
  for (const x of [EX - 12, EX, EX + 12]) { const y = Math.round(lineU(x) - 6); up.dot(x, y, P(GR[6])); up.dot(x + 1, y + 1, P(GR[0])); }
  const inBrow = polyIn(BROW), [b0, b1, b2, b3] = BROW;
  up.shape(inBrow, (x, y) => {
    const dl = segDist(x, y, b0[0], b0[1], b3[0], b3[1])[0], dt = segDist(x, y, b1[0], b1[1], b2[0], b2[1])[0];
    if (!inBrow(x - 1.2, y) || !inBrow(x + 1.2, y)) return P(GR[0]);
    if (dl < 1.1 || dt < 1.1) return P(GR[0]);
    if (dl < 3) return P(GR[2]);
    if (dt < 2.8) return P(GR[5]);
    return P(x < EX + 6 ? GR[4] : GR[3]);
  });
  for (const k of [0.07, 0.93]) { const x = Math.round(lerp(b0[0] + 1, b3[0] - 1, k)), y = Math.round(lerp((b0[1] + b1[1]) / 2, (b3[1] + b2[1]) / 2, k)); up.rect(x - 1, y - 1, 3, 3, P(METD)); up.rect(x - 1, y - 1, 2, 2, P(METL)); }
  up.rect(EX - 6, Math.round((b1[1] + b2[1]) / 2) + 2, 3, 1, P(GR[1])); up.rect(EX - 5, Math.round((b1[1] + b2[1]) / 2) + 3, 1, 2, P(GR[1]));   // a chip from the fight
  lo.shape((x, y) => Math.hypot(x - EX, y - EY) <= LR + 0.4 && y > lineL(x), (x, y) => {
    const d = y - lineL(x);
    return P(d < 1 ? GR[0] : d < 2.6 ? GR[5] : d > 4.4 && d < 5.4 ? GR[1] : x < EX + 4 ? GR[4] : GR[3]);
  });
  return { up: up.canvas(), ux: up.x0, uy: up.y0, lo: lo.canvas(), lx: lo.x0, ly: lo.y0 };
}

// ---- the cable arms: ribbed steel hoses with green cuffs, ending in three-fingered claws
function splinePts(pts, step = 0.5) {
  const out = [], Q = [pts[0], ...pts, pts[pts.length - 1]];
  let s = 0, prev = null;
  for (let i = 1; i < Q.length - 2; i++) {
    const p0 = Q[i - 1], p1 = Q[i], p2 = Q[i + 1], p3 = Q[i + 2], n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const q = [0, 1].map(d => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3));
      if (prev) s += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
      out.push([q[0], q[1], s]); prev = q;
    }
  }
  return out;
}
function paintHose(px, pts) {
  const sp = splinePts(pts), L = sp[sp.length - 1][2];
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of sp) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  for (let y = Math.floor(y0 - 6); y <= y1 + 6; y++) for (let x = Math.floor(x0 - 6); x <= x1 + 6; x++) {
    let bd = 1e9, bi = 0;
    for (let i = 0; i < sp.length; i += 2) { const d = (x + 0.5 - sp[i][0]) ** 2 + (y + 0.5 - sp[i][1]) ** 2; if (d < bd) { bd = d; bi = i; } }
    const d = Math.sqrt(bd), s = sp[bi][2], cuff = s > L - 9 || Math.abs(s - L * 0.52) < 4.5, r = cuff ? 4.7 : 3.5;
    if (d > r) continue;
    const l = lit((x + 0.5 - sp[bi][0]) / (d || 1), (y + 0.5 - sp[bi][1]) / (d || 1)) * Math.min(1, d / r * 1.4);
    if (cuff) { const e = Math.min(Math.abs(s - (L - 9)), Math.abs(Math.abs(s - L * 0.52) - 4.5)); px.dot(x, y, e < 0.8 ? P(GR[1]) : green(l)); }
    else px.dot(x, y, Math.floor(s / 3) % 2 ? steel(l - 0.55) : steel(l + 0.12));
  }
}
function paintClaw(px, wx, wy, ang, open, f1 = 10, f2 = 11) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const toS = (u, v) => [wx + u * ca - v * sa, wy + u * sa + v * ca];
  const capsule = (a, b, r0, r1, dk) => px.shape((x, y) => { const [d, t] = segDist(x, y, a[0], a[1], b[0], b[1]); return d <= lerp(r0, r1, t); }, (x, y) => {
    const [d, t] = segDist(x, y, a[0], a[1], b[0], b[1]), qx = a[0] + (b[0] - a[0]) * t, qy = a[1] + (b[1] - a[1]) * t, r = lerp(r0, r1, t);
    return steel(lit((x - qx) / (d || 1), (y - qy) / (d || 1)) * Math.min(1, d / r * 1.5) + dk);
  }, Math.min(a[0], b[0]) - 4, Math.min(a[1], b[1]) - 4, Math.max(a[0], b[0]) + 5, Math.max(a[1], b[1]) + 5);
  capsule(toS(12, 0), toS(21, 0), 2, 1.1, -0.4);                               // the short middle finger, behind
  for (const sg of [-1, 1]) {
    const a2 = open - 1.4, b = toS(9, sg * 4), k = toS(9 + f1 * Math.cos(open), sg * (4 + f1 * Math.sin(open)));
    const t = toS(9 + f1 * Math.cos(open) + f2 * Math.cos(a2), sg * (4 + f1 * Math.sin(open) + f2 * Math.sin(a2)));
    capsule(b, k, 2.8, 2.5, 0); capsule(k, t, 2.4, 0.8, 0.1);
    px.disc(k[0], k[1], 2.6, P(METD)); px.dot(k[0] - 1, k[1] - 1, P(METL));
    px.dot(t[0], t[1], P('#ffffff'));
  }
  // the green cuff and the steel palm with its emitter
  px.shape((x, y) => { const [u, v] = rot(x, y, wx, wy, ang); return u >= -3 && u <= 5 && Math.abs(v) <= 5.6; }, (x, y) => {
    const [u, v] = rot(x, y, wx, wy, ang), sg = v < 0 ? -1 : 1;
    if (u < -2 || u > 4) return P(GR[1]);
    return green(lit(-sa * sg, ca * sg) * Math.abs(v) / 5.6);
  }, wx - 10, wy - 10, wx + 11, wy + 11);
  const pc = toS(9, 0);
  px.shape((x, y) => Math.hypot(x - pc[0], y - pc[1]) <= 6.4, (x, y) => { const d = Math.hypot(x - pc[0], y - pc[1]) || 1; return steel(lit((x - pc[0]) / d, (y - pc[1]) / d) * d / 6.4 + 0.1); });
  px.disc(pc[0], pc[1], 2.6, P(PAL.MAG)); px.dot(pc[0] - 1, pc[1] - 1, P(PAL.MAGL));
}
const ARM_L = [[SHO[0][0], 128], [SHO[0][0] - 7, 108], [SHO[0][0] - 15, 88], [SHO[0][0] - 32, 69], [230, 59], [200, 57], [PODX + 4, 57], [PODX, 61]];
const ARM_R = [[SHO[1][0], 128], [SHO[1][0] + 15, 122], [SHO[1][0] + 28, 104], [SHO[1][0] + 33, 85], [SHO[1][0] + 30, 68]];
const CLAW_L = [PODX, 61, 90 * DEG, 72 * DEG, 11, 12], CLAW_R = [SHO[1][0] + 30, 68, -112 * DEG, 52 * DEG];
function paintArms() {
  const px = new Pix(140, 34, 346, 110);
  paintHose(px, ARM_L); paintClaw(px, ...CLAW_L);
  paintHose(px, ARM_R); paintClaw(px, ...CLAW_R);
  px.outline();
  return px;
}

// =====================================================================================================================
// Build everything once, the first time the mission loads
// =====================================================================================================================
let ART = null;
function build() {
  if (ART) return ART;
  const body = paintBody(), arms = paintArms();
  ART = { space: paintSpace(), wall: paintWall(), deck: paintDeck(), front: paintFront(), body: body.canvas(), bx: body.x0, by: body.y0,
    arms: arms.canvas(), ax: arms.x0, ay: arms.y0, iris: paintIris(false), irisHot: paintIris(true), lids: paintLids() };
  return ART;
}

// =====================================================================================================================
// Live drawing: the boss (design coordinates; drawBoss translates so that design (BX, BY) lands on (e.x, e.y))
// =====================================================================================================================
const BEAM_Y = x => IRY + (IRX - x) * (DECK - 1 - IRY) / (IRX - HITX);

// the eye beam: a thick green-and-white ray from the iris down to the deck, pulses running along it
function drawBeam(t) {
  for (let x = HITX; x < IRX - 30; x += 14) M5.glow(x, BEAM_Y(x), 15, PAL.BEAM, 0.14);
  for (let x = HITX + 20; x < IRX - 40; x += 40) M5.glow(x, BEAM_Y(x), 34, PAL.BEAM, 0.09);          // the room lit green
  for (let i = 0; i < 26; i++) {                                                                      // ionised motes drifting off it
    const x = HITX + 14 + hsh(i * 3.9) * (IRX - HITX - 40), ph = ((t * 0.6 + hsh(i * 7.7) * 40) % 40) / 40, up = i % 2 ? -1 : 1;
    ctx.fillStyle = rgba(i % 3 ? PAL.BEAML : '#ffffff', 0.9 * (1 - ph)); ctx.fillRect(Math.round(x + ph * 4), Math.round(BEAM_Y(x) + up * (8 + ph * 9)), 1, 1);
  }
  for (let x = HITX - 2; x <= IRX; x++) {
    const yc = BEAM_Y(x), near = Math.min(1, (IRX - x) / 58 + 0.16), ring = ((x + t * 3) % 40 + 40) % 40;
    const h = (4.4 + Math.sin(x * 0.2 + t * 0.7) * 0.6 + (ring < 3 ? 1.8 : 0)) * near;
    for (const [hh, c] of [[h + 2, GR[2]], [h + 1, PAL.BEAM], [h - 1, PAL.BEAML], [h - 3, '#ffffff']]) {
      if (hh <= 0) continue;
      const a = Math.round(yc - hh), b = Math.round(yc + hh);
      ctx.fillStyle = c; ctx.fillRect(x, a, 1, Math.min(b, DECK) - a + 1);
    }
  }
  // the flare where it leaves the iris
  disc(IRX, IRY, 4, '#ffffff');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(IRX - 8, IRY, 17, 1); ctx.fillRect(IRX, IRY - 8, 1, 17);
}
// where it hits the deck: a white-hot splash, sparks flying, the glowing track it has swept
function drawImpact(t) {
  for (let x = HITX + 4; x < 262; x++) {
    const k = (x - HITX) / 190, gap = k > 0.45 && hsh(x * 3.7) > 0.8 - (1 - k) * 0.2;
    if (gap) continue;
    ctx.fillStyle = k < 0.1 ? '#ffffff' : k < 0.3 ? PAL.BEAML : k < 0.55 ? PAL.BEAM : k < 0.8 ? GR[3] : GR[2]; ctx.fillRect(x, DECK, 1, 1);
    ctx.fillStyle = k < 0.16 ? PAL.BEAML : k < 0.4 ? PAL.BEAM : k < 0.65 ? GR[3] : GR[1]; ctx.fillRect(x, DECK + 1, 1, 1);
    if (k < 0.5) { ctx.fillStyle = rgba(PAL.BEAM, 0.45 * (1 - k * 2)); ctx.fillRect(x, DECK - 1, 1, 1); ctx.fillRect(x, DECK + 2, 1, 1); }
  }
  for (let x = HITX; x < 200; x += 16) M5.glow(x, DECK, 10 - (x - HITX) / 22, PAL.BEAM, 0.3);
  // wisps of steam rising off the track
  for (let i = 0; i < 9; i++) {
    const x0 = HITX + 22 + i * 19, ph = ((t * 0.9 + hsh(i * 3.3) * 50) % 50) / 50, x = x0 + Math.sin(ph * 5 + i) * 2, y = DECK - 2 - ph * 13;
    ctx.fillStyle = rgba('#d8ffc0', 0.5 * (1 - ph)); ctx.fillRect(Math.round(x), Math.round(y), ph > 0.5 ? 2 : 1, 2);
  }
  M5.glow(HITX, DECK - 2, 30, PAL.BEAM, 0.75); M5.glow(HITX, DECK - 2, 15, '#ffffff', 0.9);
  ctx.fillStyle = PAL.BEAM; ctx.fillRect(HITX - 13, DECK - 1, 27, 2); ctx.fillRect(HITX - 9, DECK - 3, 19, 2);
  ctx.fillStyle = PAL.BEAML; ctx.fillRect(HITX - 10, DECK - 1, 21, 2); ctx.fillRect(HITX - 6, DECK - 4, 13, 3);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(HITX - 7, DECK - 1, 15, 2); ctx.fillRect(HITX - 4, DECK - 5, 9, 4);
  // rays and sparks thrown up from the splash
  for (let i = 0; i < 9; i++) {
    const a = (-168 + i * 19.5) * DEG, r0 = 7, r1 = 12 + hsh(i * 2.9 + Math.floor(t / 4)) * 9;
    for (let r = r0; r < r1; r++) { ctx.fillStyle = r < r0 + 4 ? '#ffffff' : PAL.BEAML; ctx.fillRect(Math.round(HITX + Math.cos(a) * r), Math.round(DECK - 3 + Math.sin(a) * r * 0.9), 1, 1); }
  }
  for (let i = 0; i < 16; i++) {
    const ph = ((t * 1.3 + hsh(i * 5.1) * 30) % 30) / 30, vx = (hsh(i * 2.3) - 0.5) * 2.6, vy = -1.6 - hsh(i * 4.7) * 2, f = ph * 26;
    const x = HITX + vx * f, y = DECK - 3 + vy * f + 0.11 * f * f;
    if (y > DECK - 1) continue;
    ctx.fillStyle = i % 3 ? PAL.BEAML : '#ffffff'; ctx.fillRect(Math.round(x), Math.round(y), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
  }
}
// the tractor beam under the left claw: a short green cone holding the cow pod
function drawTractor(t) {
  const y0 = 72, y1 = PODY + 2;
  for (let j = 0; j < y1 - y0; j += 2) {
    const k = j / (y1 - y0), hw2 = Math.round(7 + k * 15), a = 0.4 - k * 0.12 + 0.07 * Math.sin(t / 3 - j / 4);
    ctx.fillStyle = rgba(PAL.BEAM, clamp(a, 0, 1)); ctx.fillRect(PODX - hw2, y0 + j, hw2 * 2, 2);
    ctx.fillStyle = rgba(PAL.BEAML, 0.5); ctx.fillRect(PODX - hw2, y0 + j, 1, 2); ctx.fillRect(PODX + hw2 - 1, y0 + j, 1, 2);
  }
  for (let k = 0; k < 4; k++) {
    const u = ((t / 36 + k / 4) % 1), yy = Math.round(y1 - u * (y1 - y0)), hw2 = Math.round(7 + (1 - u) * 15);
    ctx.fillStyle = rgba(PAL.BEAML, 0.55 * (1 - Math.abs(u - 0.5) * 2) + 0.2); ctx.fillRect(PODX - hw2, yy, hw2 * 2, 1);
  }
  M5.glow(PODX, 74, 14, PAL.BEAM, 0.7); M5.glow(PODX, PODY - 22, 30, PAL.BEAM, 0.22);
  M5.pod(PODX, PODY, { id: 2, t, facing: -1 });
  // where it will land: a dotted drop line, a blinking ring on the deck and the red !
  for (let y = PODY + 12; y < DECK - 14; y += 5) { ctx.fillStyle = OUT; ctx.fillRect(PODX - 1, y - 1, 3, 4); ctx.fillStyle = '#ff6a5a'; ctx.fillRect(PODX, y, 1, 2); }
  const ring = (rx, ry, c) => { ctx.fillStyle = c; for (let a = 0; a < 360; a += 2) ctx.fillRect(Math.round(PODX + Math.cos(a * DEG) * rx), Math.round(DECK + 2 + Math.sin(a * DEG) * ry), 1, 1); };
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { ctx.save(); ctx.translate(ox, oy); ring(16, 3.4, OUT); ring(15, 2.6, OUT); ctx.restore(); }
  ring(16, 3.4, '#ff3b30'); ring(15, 2.6, '#ffd6d1');
  ctx.fillStyle = '#ff3b30'; ctx.fillRect(PODX - 3, DECK + 2, 7, 1); ctx.fillRect(PODX, DECK + 1, 1, 3);
  M5.glow(PODX, DECK + 2, 20, '#ff3b30', 0.45);
  M5.bang(PODX, DECK - 6, 0);
}
function drawThrusters(t) {
  for (let i = 0; i < NOZ.length; i++) {
    const x = B.cx + NOZ[i], y = Math.round(lowEdge(x)) + 3, f = Math.floor(t / 3 + i) % 3;
    M5.glow(x, y + 2, 13, PAL.BEAM, 0.55);
    ctx.fillStyle = PAL.BEAM; ctx.fillRect(x - 5, y, 10, 2); ctx.fillRect(x - 4, y + 2, 8, 2); ctx.fillRect(x - 3, y + 4, 6, 1 + (f > 0)); ctx.fillRect(x - 1, y + 5, 2, f);
    ctx.fillStyle = PAL.BEAML; ctx.fillRect(x - 4, y, 8, 2); ctx.fillRect(x - 3, y + 2, 6, 1 + (f > 0)); ctx.fillRect(x - 2, y + 3, 4, 1 + (f > 1));
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y, 6, 1); ctx.fillRect(x - 2, y + 1, 4, 1); ctx.fillRect(x - 1, y + 2, 2, 1 + (f === 1));
  }
  for (let i = 0; i < 18; i++) {
    const nx = NOZ[i % 3], ph = ((t * 1.1 + hsh(i * 4.3) * 24) % 24) / 24, dir = i % 2 ? 1 : -1;
    ctx.fillStyle = ph < 0.4 ? PAL.BEAML : PAL.BEAM; ctx.fillRect(Math.round(B.cx + nx + dir * (3 + ph * 16)), DECK - 1 - Math.round(ph * ph * 4 * hsh(i)), ph < 0.5 ? 2 : 1, 1);
  }
  // their light pooling on the deck
  ctx.save(); ctx.translate(B.cx, DECK + 1); ctx.scale(1, 0.22); M5.glow(0, 0, 80, PAL.BEAM, 0.55); ctx.restore();
}
function drawLamps(t) {
  // the crown: three antenna lamps, all lit while the beam fires
  ANT.forEach((a, i) => {
    M5.glow(a.tx + 1, a.ty - 2, 11, PAL.AMB, 0.55);
    disc(a.tx + 1, a.ty - 2, 5, OUT); disc(a.tx + 1, a.ty - 2, 4, PAL.AMB); disc(a.tx, a.ty - 3, 3, PAL.AMBL); disc(a.tx - 1, a.ty - 4, 1, '#ffffff');
    ctx.fillStyle = '#c98a16'; ctx.fillRect(a.tx + 2, a.ty + 1, 3, 1); ctx.fillRect(a.tx + 4, a.ty - 1, 1, 2);
    if ((Math.floor(t / 4) + i) % 2) { ctx.fillStyle = PAL.AMBL; ctx.fillRect(a.tx - 7, a.ty - 2, 2, 1); ctx.fillRect(a.tx + 8, a.ty - 2, 2, 1); ctx.fillRect(a.tx + 1, a.ty - 10, 1, 2); }
  });
  // amber lamps chasing round the collar and the skirt's steel rim
  COLLAR_LAMPS.forEach(([x, y], i) => { if ((Math.floor(t / 5) + i) % 3 === 0) { ctx.fillStyle = PAL.AMBL; ctx.fillRect(x, y, 2, 2); } });
  for (let k = -6; k <= 6; k++) {
    const x = B.cx + k * 14, y = Math.round(topEdge(x)) + 1, on = (Math.floor(t / 5) + k + 60) % 4 === 0;
    ctx.fillStyle = on ? PAL.AMBL : AM0; ctx.fillRect(x - 1, y, 3, 2);
    if (on) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y, 1, 1); }
  }
}
function drawEye(t) {
  const A = build();
  ctx.drawImage(A.irisHot, IRX - 15, IRY - 15);
  // the upper lid's shadow on the lens
  ctx.fillStyle = rgba('#5f7896', 0.5);
  for (let x = EX - LR + 1; x <= EX + LR - 1; x++) { const y = Math.round(lineU(x)), hh = Math.sqrt(LR * LR - (x - EX) ** 2); if (y > EY - hh && y < EY + hh - 3) ctx.fillRect(x, y, 1, 2); }
  ctx.drawImage(A.lids.up, A.lids.ux, A.lids.uy);
  ctx.drawImage(A.lids.lo, A.lids.lx, A.lids.ly);
  M5.glow(IRX, IRY, 24, PAL.BEAM, 0.4); M5.glow(IRX, IRY, 9, '#ffffff', 0.6);
}
const ZAP = 'ZAAAP!';
function drawBoss(e) {
  const A = build(), t = G.t;
  ctx.save(); ctx.translate(Math.round(e.x) - BX, Math.round(e.y) - BY);
  drawThrusters(t);
  ctx.drawImage(A.arms, A.ax, A.ay);
  if (Math.floor(t / 6) % 2) { ctx.fillStyle = '#ffffff'; const cx2 = CLAW_R[0] - 12, cy2 = CLAW_R[1] - 26; ctx.fillRect(cx2 - 6, cy2 - 3, 3, 1); ctx.fillRect(cx2 - 8, cy2 + 2, 3, 1); ctx.fillRect(cx2 - 1, cy2 - 8, 1, 3); ctx.fillRect(cx2 + 5, cy2 - 7, 1, 3); }
  ctx.drawImage(A.body, A.bx, A.by);
  // a comic anger mark throbbing on its temple
  { const ax = B.cx + 41, ay = 99 - (Math.floor(t / 8) % 2), M = ['..#...#..', '..#...#..', '###...###', '.........', '.........', '###...###', '..#...#..', '..#...#..'];
    for (const [c, ox, oy] of [[OUT, -1, 0], [OUT, 1, 0], [OUT, 0, -1], [OUT, 0, 1], ['#ff3b30', 0, 0]]) { ctx.fillStyle = c; M.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') ctx.fillRect(ax + i + ox, ay + j + oy, 1, 1); }); }
    ctx.fillStyle = '#ffb0a8'; ctx.fillRect(ax, ay + 2, 2, 1); ctx.fillRect(ax + 6, ay + 2, 2, 1); }
  // the furnace flickering behind the grille
  M5.glow(MX, mT(MX) + 6, 16, '#ffb040', 0.18 + 0.06 * Math.sin(t / 4));
  drawLamps(t);
  drawEye(t);
  drawTractor(t);
  drawBeam(t);
  drawImpact(t);
  // the comic word, stepping up along the beam
  const j = Math.round((hsh(Math.floor(t / 3) * 0.7) - 0.5) * 2);
  for (let i = 0; i < ZAP.length; i++) {
    const x = 195 + i * 12 + j, y = 200 - Math.round(i * 2.6) + j;
    for (const [ox, oy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2], [2, 1]]) text(ZAP[i], x + ox, y + oy, OUT, 2, 'left', null);
    text(ZAP[i], x, y, PAL.BEAML, 2, 'left', null);
    ctx.save(); ctx.beginPath(); ctx.rect(x - 1, y + 8, 12, 8); ctx.clip(); text(ZAP[i], x, y, PAL.BEAM, 2, 'left', null); ctx.restore();
  }
  ctx.restore();
}

// =====================================================================================================================
// Registry entries
// =====================================================================================================================
ENEMY_TYPES.megaoggle = {
  hp: BOSS_MAX, boss: true, bossName: 'MEGA OGGLE', edge: 60, contact: 'none', armored: true, flying: true,
  make(e) { e.state = 'beam'; e.max = BOSS_MAX; e.hp = BOSS_HP; },
  update(e) { e.state = 'beam'; e.hp = BOSS_HP; e.hitT = 0; e.vx = 0; },   // the screenshot holds the EYE BEAM pose
  draw: drawBoss,
  // the weak spot: the open eye
  box: e => ({ x: e.x - BX + EX - LR, y: e.y - BY + EY - LR, w: LR * 2, h: LR * 2 }),
  onKill(e) { e.state = 'dying'; return 'dying'; }
};

// =====================================================================================================================
// The mission (a stand-in with the real names; only the bridge arena is built)
// =====================================================================================================================
function frameShots() {
  const y = HERO_Y - 19;
  return [172, 214, 258, 300].map((x, i) => ({ x: CAM + x, y: y + (i % 2 ? 1 : 0), vx: 7, vy: 0, dmg: 0, life: 60, draw: hmgShot }));
}
function holo(t) {                        // the holographic globe of the Earth with target marks (cyan, magenta marks)
  const cx = CAM + 34, cy = 181, r = 15;
  for (let j = 0; j < 22; j += 2) { ctx.fillStyle = rgba(PAL.CYAN, 0.05 + j * 0.006); const hw2 = Math.round(4 + (22 - j) * 0.55); ctx.fillRect(cx - hw2, 200 - j, hw2 * 2 + 1, 1); }
  M5.glow(cx, cy, 22, PAL.CYAN, 0.22);
  ctx.fillStyle = rgba(PAL.CYAN, 0.16); for (let j = -r; j <= r; j++) { const w = Math.round(Math.sqrt(r * r - j * j)); ctx.fillRect(cx - w, cy + j, w * 2 + 1, 1); }
  ctx.fillStyle = rgba(PAL.CYAN, 0.75);
  for (let a = 0; a < 360; a += 4) ctx.fillRect(Math.round(cx + Math.cos(a * DEG) * r), Math.round(cy + Math.sin(a * DEG) * r), 1, 1);
  ctx.fillStyle = rgba(PAL.CYAN, 0.42);
  for (const k of [-0.55, 0, 0.55]) { const yy = Math.round(cy + k * r), w = Math.round(Math.sqrt(r * r - (k * r) ** 2)); for (let x = -w; x <= w; x += 2) ctx.fillRect(cx + x, yy, 1, 1); }
  for (const m of [0.2, 0.62, 0.95]) { const ph = (m + t / 240) % 1, s = Math.cos(ph * Math.PI); for (let a = -80; a <= 80; a += 8) ctx.fillRect(Math.round(cx + s * Math.cos(a * DEG) * r), Math.round(cy + Math.sin(a * DEG) * r), 1, 1); }
  // target marks
  for (const [dx, dy, ph] of [[-5, -4, 0], [6, 3, 9], [1, -9, 17]]) {
    const on = Math.floor((t + ph) / 8) % 3 !== 0; ctx.fillStyle = on ? PAL.MAG : PAL.MAGL;
    ctx.fillRect(cx + dx - 2, cy + dy, 5, 1); ctx.fillRect(cx + dx, cy + dy - 2, 1, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(cx + dx, cy + dy, 1, 1);
  }
}

LEVELS.push({
  mission: 'MISSION 5', title: 'ALIEN MOTHERSHIP', end: END, heroStart: 120, freedLabel: 'COWS RESCUED',
  sections: [{ x: 0, name: 'AREA 1: THE HANGAR' }, { x: 1600, name: 'AREA 2: STAR GARDEN' }, { x: 3300, name: 'AREA 3: SPACE WALK' }, { x: 5000, name: 'FINAL AREA: THE BRIDGE' }],
  terrain: [[0, DECK], [END, DECK]],
  plats: [], spawns: [], pows: [], props: [],
  locks: [{ at: CAM, boss: true, waves: [{ t: 'megaoggle', side: 1, d: 60 }] }],
  music: 'main', bossMusic: 'boss',
  load(cp) {
    build();
    G.banner = null; G.big = null;                 // mid-fight: no area name, no MISSION START band
    if (cp >= CAM) {
      // the boss lock is already running with the MEGA OGGLE in it
      const l = G.locks[G.locks.length - 1];
      l.active = true; l.t = 999; l.queue = [];
      const e = makeEnemy({ t: 'megaoggle', x: CAM + BX, y: BY }, l);
      e.active = true; e.facing = -1; G.enemies.push(e);
    }
  },
  update() {
    const p = G.p;
    if (G.cam.x >= CAM - 1) {
      // Mathias at the top of his jump over the beam, firing the H.M.G. level into the eye
      Object.assign(p, { x: CAM + HERO_SX, y: HERO_Y, vx: 0, vy: -0.3, onGround: false, onPlat: null, facing: 1, aim: 'fwd', crouch: false,
        knife: 0, muzzle: 3, weapon: 'hmg', ammo: 118, bombs: 5, hearts: 3, inv: 0, dead: 0, kb: 0, ride: null, hidden: false });
      G.lives = 3; G.score = 204650;
      G.pb = frameShots(); G.eb = []; G.items = []; G.grenades = []; G.texts = [];
      // two spent shells tumbling behind him
      G.parts = [[-6, -24, 0.3], [-11, -15, 1.2]].map(([dx, dy, r]) => ({ type: 'debris', x: CAM + HERO_SX + dx, y: HERO_Y + dy, vx: 0, vy: 0, g: 0, life: 20, max: 40, size: 2, c: '#e8b43a' }));
    }
    G.shake = 0; G.warnT = 0; G.banner = null; G.big = null;
  },
  drawBG(cx) {
    const A = build(), o = cx - CAM, t = G.t;
    ctx.fillStyle = SP[0]; ctx.fillRect(-10, -10, W + 20, H + 20);
    const sx = -24 - Math.round(o * 0.03);
    ctx.drawImage(A.space, sx, 16);
    // stars twinkle; the atmosphere glows on the Earth's lit side
    TWINK.forEach(([x, y], i) => { if ((Math.floor(t / 9) + i * 5) % 7 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 24 + sx - 2, y, 5, 1); ctx.fillRect(x + 24 + sx, y - 2, 1, 5); } });
    M5.glow(EARTH.x - 22 + 24 + sx, EARTH.y - 16, 46, '#4f9dff', 0.22);
  },
  drawBehind(cx) {
    const A = build(), t = G.t;
    ctx.fillStyle = S[1]; ctx.fillRect(cx - 10, 0, Math.max(0, CAM - 24 - cx + 10), DECK);
    ctx.drawImage(A.wall, CAM - 24, 0);
    // live: the cyan strip glows, console lamps blink, the hologram turns
    for (let x = 20; x < W; x += 60) M5.glow(CAM + x, 31, 14, PAL.CYAN, 0.16);
    for (const sx of STRUTS.slice(0, 4)) for (const y of [64, 120]) M5.glow(CAM + sx, y, 7, PAL.CYAN, 0.3);
    for (const [x, y, c, ph] of BLINKS) if (Math.floor((t + ph * 7) / 14) % 3) { ctx.fillStyle = c; ctx.fillRect(CAM + x, y, 2, 2); M5.glow(CAM + x + 1, y + 1, 5, c, 0.3); }
    holo(t);
  },
  drawGround(cx) {
    const A = build();
    if (cx < CAM - 14) { ctx.fillStyle = S[2]; ctx.fillRect(cx - 10, DECK, CAM - 14 - cx, H - DECK); ctx.fillStyle = S[7]; ctx.fillRect(cx - 10, DECK, CAM - 14 - cx, 1); }   // the walk in (not painted)
    ctx.drawImage(A.deck, CAM - 24, 214);
    for (let x = 10; x < W; x += 44) M5.glow(CAM + x, DECK + 14, 9, PAL.MAG, 0.22);
    // the beam's splash and the thrusters light the deck's edge and front face
    ctx.fillStyle = rgba(PAL.BEAML, 0.5); ctx.fillRect(CAM + HITX - 22, DECK + 1, 44, 4);
    ctx.save(); ctx.translate(CAM + HITX, DECK + 10); ctx.scale(1, 0.5); M5.glow(0, 0, 36, PAL.BEAM, 0.5); ctx.restore();
    for (const nx of NOZ) {
      ctx.fillStyle = rgba(PAL.BEAML, 0.4); ctx.fillRect(CAM + B.cx + nx - 12, DECK + 1, 24, 4);
      ctx.save(); ctx.translate(CAM + B.cx + nx, DECK + 9); ctx.scale(1, 0.5); M5.glow(0, 0, 22, PAL.BEAM, 0.35); ctx.restore();
    }
  },
  drawFront(cx) {
    const A = build(), o = Math.round((cx - CAM) * 1.25), t = G.t;
    // speed lines under Mathias's boots: he has just jumped the beam
    const jx = HERO_SX - (cx - CAM);
    for (const [dx, y0, n] of [[-6, 5, 9], [-1, 8, 12], [4, 4, 8]]) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(jx + dx, HERO_Y + y0, 1, n); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(jx + dx, HERO_Y + y0 + n, 1, 4); }
    // sparks where the H.M.G. rounds hit the lens (the weak spot)
    const hx = EX - LR + 1 - (cx - CAM), hy = HERO_Y - 19;
    M5.glow(hx, hy, 12, '#ffe066', 0.7);
    ctx.fillStyle = '#ffb52e'; ctx.fillRect(hx - 6, hy, 13, 1); ctx.fillRect(hx, hy - 6, 1, 13);
    ctx.fillStyle = '#ffe066'; ctx.fillRect(hx - 3, hy - 1, 7, 3); ctx.fillRect(hx - 1, hy - 3, 3, 7);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(hx - 1, hy - 1, 3, 3);
    for (let i = 0; i < 8; i++) {
      const a = (150 + i * 37 + hsh(i) * 20) * DEG, r = 7 + ((t * 1.4 + i * 5) % 11);
      ctx.fillStyle = i % 2 ? '#ffe066' : '#ffffff'; ctx.fillRect(Math.round(hx + Math.cos(a) * r * (Math.cos(a) > 0 ? 0.3 : 1)), Math.round(hy + Math.sin(a) * r), 1, 1);
    }
    // two of the crew cower behind the near consoles and watch
    M5.oggle(44 - o, 262, 1, { pose: 'idle', look: [0.9, -0.45], t: 40 });
    M5.oggle(438 - o, 260, -1, { pose: 'idle', look: [-0.55, -0.85], t: 52 });
    ctx.drawImage(A.front, -10 - o, 228);
  },
  drawOverlay(cx) {},
  preview(x, y, w, h) { ctx.fillStyle = S[1]; ctx.fillRect(x, y, w, h); ctx.fillStyle = SP[0]; ctx.fillRect(x, y + 12, w, h - 40); ctx.fillStyle = GR[3]; ctx.fillRect(x + w - 60, y + 26, 40, 40); ctx.fillStyle = S[4]; ctx.fillRect(x, y + h - 22, w, 22); }
});
}
