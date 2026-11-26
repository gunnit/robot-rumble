'use strict';
// ============================================================
// Mission 1 scenery, area "base": FINAL AREA: ROBOT BASE (ground x 4340-6000) at dusk, lit by its own lights.
// Called by level1_art.js (contract: tools/polish/build-contract.md) through
//   L1ART.base = { x0, x1, steps, bg, behind, ground, plat, front }.
//  bg      dusk sky (stars, clouds lit from below, a crescent moon), a far skyline in haze (cooling towers, chimneys,
//          pylons), the factory (halls, stacks with smoke, silos, searchlight towers), the yard (fence, tanks, mast)
//  behind  the decor it owns: the ROBOT BASE gate (4400), the pipe rack (4440), the base wall (4600) with its catwalk,
//          vents, screens and lamps, and the blast door the Mega Crab comes out of (the shutter follows G.door)
//  ground  steel deck from x 4340: tread plate, hazard lip, girders, pipes, grates and machines under the floor
//  front   bollards, barriers and drums in front of the action
// Static art is painted pixel by pixel into buffers and baked once, in `steps`; only small things move (G.t).
// Never calls Math.random / rand: textures come from a private table, motion from G.t and hsh.
// The wall behind the boss fight is kept dark and calm: the alarm (lamps, sign, chase lights) only flashes while the
// WARNING is up and the door moves; after that everything on the wall glows steadily.
// ============================================================
var L1ART = L1ART || {};
{
const Math = globalThis.Math;            // a block-local name: the painters call it millions of times while baking, and
                                         // looking a global up is slow in the test harness (the sky took 790 ms, now 25)
const AX0 = 4340, AX1 = 6000;            // the area's ground range (L.grounds 'metal')
const GATE_X = 4400, PIPES_X = 4440, WALL_X = 4600, DOOR_X = WALL_X + 380, DOOR_W = 140, DOOR_H = 112;
const DOOR_Y = GROUND - DOOR_H;          // top of the door opening (120)
const WTOP = GROUND - 128;               // top of the wall face (104)
const GH_X = DOOR_X - 24, GH_TOP = 78;   // the gatehouse round the door
const LOCK_AT = 4620;                    // the boss lock's camera x (the last camera of the level)
const SC = { cam0: 3980, cam1: 4620 };   // camera range in which the base's backdrop is on screen (bg is called for 3990..4620)

// ============================================================
// Helpers: easing, noise, colours, pixel buffers (as in level3_world.js)
// ============================================================
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (v, m) => ((v % m) + m) % m;
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
let NZ = null;                                      // filled by the first bake step
function makeNZ() { const r = rng(40471); NZ = new Float32Array(65536); for (let i = 0; i < NZ.length; i++) NZ[i] = r(); }
const nz = (x, y) => NZ[((Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0) & 65535];
function vn(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = s * 57;
  return lerp(lerp(nz(i + o, j), nz(i + 1 + o, j), a), lerp(nz(i + o, j + 1), nz(i + 1 + o, j + 1), a), b);
}
function fbm(x, y, s, oct = 3) { let v = 0, a = 1, n = 0, f = 1; for (let o = 0; o < oct; o++) { v += a * vn(x * f, y * f, s + o * 7); n += a; a *= 0.5; f *= 2.03; } return v / n; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

const NONE = -1;
const ICACHE = new Map();
const I = s => { let v = ICACHE.get(s); if (v === undefined) { v = parseInt(s.slice(1, 7), 16); ICACHE.set(s, v); } return v; };
const P = (...s) => s.map(I);
const css = v => '#' + (v & 0xffffff).toString(16).padStart(6, '0');
function mixI(a, b, k) {
  k = clamp(k, 0, 1);
  return (Math.round(lerp(a >> 16 & 255, b >> 16 & 255, k)) << 16) | (Math.round(lerp(a >> 8 & 255, b >> 8 & 255, k)) << 8) | Math.round(lerp(a & 255, b & 255, k));
}
// pick from a palette by t in 0..1: flat steps, or steps with dithered seams
const flat = (pal, t) => pal[clamp(Math.round(t * (pal.length - 1)), 0, pal.length - 1)];
function ramp(pal, t, x, y) {
  const f = clamp(t, 0, 1) * (pal.length - 1), i = Math.floor(f), fr = clamp((f - i - 0.2) / 0.6, 0, 1);
  return pal[Math.min(pal.length - 1, i + (fr > bay(x, y) ? 1 : 0))];
}

// Pixel buffers: Int32 0xRRGGBB, NONE = empty; the point (x, y) lands on pixel (x - x0, y - y0)
function buf(x0, y0, w, h) { const d = new Int32Array(w * h); d.fill(NONE); return { x0, y0, w, h, d }; }
function put(b, x, y, c) { x = Math.floor(x) - b.x0; y = Math.floor(y) - b.y0; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) - b.x0; y = Math.floor(y) - b.y0; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) {
  x = Math.round(x) - b.x0; y = Math.round(y) - b.y0;
  const xa = Math.max(0, x), ya = Math.max(0, y), xb = Math.min(b.w, x + Math.round(w)), yb = Math.min(b.h, y + Math.round(h));
  if (xb > xa) for (let r = ya; r < yb; r++) b.d.fill(c, r * b.w + xa, r * b.w + xb);
}
function disc(b, cx, cy, r, c, only) {
  const n = Math.ceil(r), R2 = (r + 0.5) * (r + 0.5), X = Math.round(cx), Y = Math.round(cy);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) if (i * i + j * j <= R2 && (only === undefined || get(b, X + i, Y + j) === only)) put(b, X + i, Y + j, c);
}
function oval(b, cx, cy, rx, ry, c) {
  const RX = rx + 0.5, RY = ry + 0.5, X = Math.round(cx), Y = Math.round(cy);
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++)
    if (i * i / (RX * RX) + j * j / (RY * RY) <= 1) put(b, X + i, Y + j, c);
}
function line(b, x0, y0, x1, y1, c, t = 1) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1));
  for (let i = 0; i <= n; i++) rect(b, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), t, t, c);
}
function poly(b, pts, c) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const yc = y + 0.5, xs = [];
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
// mix every painted pixel toward colour c by k(x, y): haze
function tint(b, c, k) {
  for (let r = 0; r < b.h; r++) for (let q = 0; q < b.w; q++) {
    const i = r * b.w + q, v = b.d[i];
    if (v === NONE) continue;
    const m = k(q + b.x0, r + b.y0);
    if (m > 0) b.d[i] = mixI(v, c, m);
  }
}
// edges that face the afterglow at x = gx get a warm rim, top edges a lighter tone (only where the shape is 2+ px thick)
function rimLight(b, gx, rim, topC) {
  const w = b.w, d = b.d, out = [];
  for (let y = 1; y < b.h - 1; y++) for (let x = 2; x < w - 2; x++) {
    const i = y * w + x;
    if (d[i] === NONE) continue;
    const side = x + b.x0 < gx ? 1 : -1;
    if (d[i + side] === NONE && d[i - side] !== NONE && d[i - side * 2] !== NONE) out.push(i, rim(x + b.x0, y + b.y0));
    else if (topC != null && d[i - w] === NONE && d[i + w] !== NONE && d[i - 1] !== NONE && d[i + 1] !== NONE) out.push(i, topC);
  }
  for (let k = 0; k < out.length; k += 2) d[out[k]] = out[k + 1];
}
// the game's 5x7 font, painted into a buffer
function stamp(b, s, x, y, c, sc = 1) {
  for (let i = 0; i < s.length; i++) {
    const gl = GLYPHS[s[i]];
    if (!gl) continue;
    gl.split(' ').forEach((row, r) => { for (let q = 0; q < 5; q++) if (row[q] === '1') rect(b, x + (i * 6 + q) * sc, y + r * sc, sc, sc, c); });
  }
}
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function bake(b) {
  const c = canvasOf(b.w, b.h), g = c.getContext('2d'), im = g.createImageData(b.w, b.h), d = im.data;
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = i * 4;
    d[j] = v >> 16 & 255; d[j + 1] = v >> 8 & 255; d[j + 2] = v & 255; d[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
const mk = b => ({ img: bake(b), x0: b.x0, y0: b.y0, w: b.w, h: b.h });
const blit = (s, x, y) => ctx.drawImage(s.img, Math.round(x) + s.x0, Math.round(y) + s.y0);
// one colour with alpha from fn(x, y): light cones
function alphaCanvas(w, h, col, fn) {
  const c = canvasOf(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data, C = I(col);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = fn(x, y);
    if (!(a > 0.004)) continue;
    const j = (y * w + x) * 4; d[j] = C >> 16 & 255; d[j + 1] = C >> 8 & 255; d[j + 2] = C & 255; d[j + 3] = Math.round(Math.min(1, a) * 255);
  }
  g.putImageData(im, 0, 0);
  return c;
}
// a soft round glow (drawn with the 'lighter' composite)
function glowSprite(r, col) {
  const c = canvasOf(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r), v = I(col), s = (v >> 16 & 255) + ',' + (v >> 8 & 255) + ',' + (v & 255);
  gr.addColorStop(0, 'rgba(' + s + ',1)'); gr.addColorStop(0.4, 'rgba(' + s + ',0.42)'); gr.addColorStop(1, 'rgba(' + s + ',0)');
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return c;
}
// crisp pixel disc on a live canvas in the current fillStyle
function pdisc(g, x, y, r) {
  x = Math.round(x); y = Math.round(y);
  const R2 = (r + 0.5) * (r + 0.5);
  for (let j = -Math.floor(r); j <= Math.floor(r); j++) { const hw = Math.floor(Math.sqrt(R2 - j * j)); g.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
}
// A strip of backdrop with parallax p, painted in "design" coordinates (= screen coordinates at camera SC.cam0)
function newStrip(p, top, bot) {
  const w = W + 22 + Math.ceil((SC.cam1 - SC.cam0) * p);
  return { p, top, h: bot - top, X1: w - 10, b: buf(-10, top, w, bot - top), c: null };
}
function bakeStrip(S) { S.c = bake(S.b); S.b = null; }
const offOf = (S, cx) => clamp(Math.round((cx - SC.cam0) * S.p), 0, S.c.width - W - 20);
const blitStrip = (g, S, cx) => g.drawImage(S.c, offOf(S, cx), 0, W + 20, S.h, -10, S.top, W + 20, S.h);

// ============================================================
// Palettes. Night steel is blue-grey and darker than the robots' own metal (MET #8a97a8, the crab's #5d6d7e), so the
// crab, the hero and every shot stand out; warmth comes only from lamps, windows and the last light in the sky.
// ============================================================
const ST = P('#0f1219', '#161a24', '#1d2330', '#262d3c', '#30394a', '#3d485c', '#4e5b72', '#64738a', '#8493a8', '#b3bfce');
const WARM = I('#ffd9a0');
const HZ = { y: I('#e0b030'), yl: I('#f8d860'), yd: I('#a47a18'), k: I('#1c1a1c'), kl: I('#35313a') };
const RED = P('#ffd0c8', '#ff5a48', '#c8382c', '#8a2420', '#4a1216');
const SKYP = P('#0c0920', '#110d2c', '#18123a', '#211748', '#2d1d57', '#3d2566', '#522e73', '#6b377b', '#87407c', '#a44a76', '#bf566a', '#d6675a', '#e87c4a', '#f4964a', '#fbb157', '#ffcb72', '#ffe199');
const CLD = P('#140f2c', '#1c153e', '#271b4c', '#372258', '#502b62', '#723668', '#994466', '#bf585c', '#e0764c', '#f69a4e', '#ffc06a');
const FARP = P('#39225a', '#452966', '#523172', '#643b7e');
const MIDP = P('#1a122e', '#22173a', '#2c1e48', '#392757', '#4b3368');
const NEARP = P('#0f0c1e', '#16112a', '#1e1838', '#2a2248', '#3a305c');
const WIN = P('#ffe29a', '#f2b850', '#d5823a', '#43283e');
const RIMC = P('#6e3a58', '#a8524e', '#e0824a');

// Things that move, found while painting: positions are design coordinates of their strip (or world coordinates)
const LIVE = { stars: [], farL: [], farPl: [], stacks: [], midL: [], midW: [], beams: [], nearL: [], nearF: [], vents: [], screens: [], lamps: [], steam: [], grates: [], leds: [], chase: [] };

// ============================================================
// The sky (p 0.02): indigo to violet to a last band of orange and gold; cloud banks lit from below; stars; a moon
// ============================================================
const SKY_T = [[-10, 0], [18, 0.14], [42, 0.33], [60, 0.5], [74, 0.64], [86, 0.76], [98, 0.87], [114, 0.95], [140, 1], [400, 1]];
const GLOWX = 252;                                   // where the sun went down (design x of the sky strip)
function skyT(y) {
  let i = 0;
  while (i + 2 < SKY_T.length && SKY_T[i + 1][0] <= y) i++;
  return lerp(SKY_T[i][1], SKY_T[i + 1][1], clamp((y - SKY_T[i][0]) / (SKY_T[i + 1][0] - SKY_T[i][0]), 0, 1));
}
const skyPx = (x, y) => ramp(SKYP, skyT(y) + 0.07 * Math.exp(-(((x - GLOWX) / 170) ** 2)) * ss(30, 104, y), x, y);
function cloudD(x, y) {
  const band = 0.17 * Math.exp(-(((y - 50) / 24) ** 2)) + 0.13 * Math.exp(-(((y - 90) / 8) ** 2)) + 0.07 * Math.exp(-(((y - 14) / 12) ** 2));
  return fbm(x / 64 + 3.1, y / 11 + 0.7, 5, 4) + band - 0.665 - ss(100, 114, y) * 0.3;
}
function paintSky(b, X1, ya, yb) {
  for (let y = ya; y < yb; y++) for (let x = -10; x < X1; x++) {
    const d = y > 116 ? -1 : cloudD(x, y);            // no cloud can reach below the last streaks
    if (d <= 0) { put(b, x, y, skyPx(x, y)); continue; }
    const belly = clamp(1 - cloudD(x, y + 3) / 0.05, 0, 1), crown = clamp(1 - cloudD(x, y - 3) / 0.05, 0, 1), warm = ss(8, 100, y);
    const t = lerp(0.13, 0.36, warm) + belly * lerp(0.1, 0.6, warm * warm) - crown * 0.07 + (fbm(x / 9, y / 4, 9, 2) - 0.5) * 0.07;
    put(b, x, y, ramp(CLD, t, x, y));
  }
}
function paintSkyLights(b, X1) {
  for (let i = 0; i < 130; i++) {
    const x = Math.round(-10 + nz(i, 901) * (X1 + 10)), y = Math.round(-8 + Math.pow(nz(i, 902), 1.5) * 80);
    if (cloudD(x, y) > -0.02) continue;
    const m = nz(i, 903), dim = ss(26, 80, y);
    if (m > 0.84 && y < 58) {
      put(b, x, y, I('#fff6dc'));
      for (const [a, q] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(b, x + a, y + q, mixI(I('#b7a8e8'), skyPx(x + a, y + q), 0.45));
      LIVE.stars.push([x, y]);
    } else put(b, x, y, mixI(I(m > 0.45 ? '#ece6ff' : '#a99fd8'), skyPx(x, y), dim * 0.7 + (m < 0.25 ? 0.3 : 0)));
  }
  // a thin crescent moon
  const mx = 318, my = 17;
  for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) {
    if (i * i + j * j > 42 || (i - 3) * (i - 3) + (j + 2) * (j + 2) <= 36 || cloudD(mx + i, my + j) > 0) continue;
    put(b, mx + i, my + j, I(i * i + j * j > 30 ? '#f2dca8' : '#fff4d0'));
  }
}

// ============================================================
// The far skyline (p 0.08): cooling towers with plumes, thin chimneys, pylons and their wires, sheds, all in haze
// ============================================================
const FAR_BASE = 148, FO = Math.round((LOCK_AT - SC.cam0) * 0.08), GXF = 237 + FO;
function plume(b, x, y, s, pal, seed) {
  // a short, lumpy cloud leaning with the wind: big puffs, bellies lit by the afterglow, dusky tops
  const pts = [];
  for (let k = 0; k < 7; k++) { const t = k / 6; pts.push([x + 26 * s * Math.pow(t, 1.3) + (nz(k, seed) - 0.5) * 5 * t, y - 22 * s * Math.pow(t, 0.8) + (nz(k, seed + 1) - 0.5) * 5 * t, (3 + 7 * Math.pow(t, 0.7)) * s]); }
  pts.push([x + 34 * s, y - 16 * s, 5 * s], [x + 40 * s, y - 19 * s, 3 * s]);
  for (const [px, py, r] of pts) disc(b, px, py, r, pal[1]);
  for (const [px, py, r] of pts) disc(b, px + r * 0.2, py + r * 0.5, r * 0.6, pal[2], pal[1]);
  for (const [px, py, r] of pts) disc(b, px - r * 0.25, py - r * 0.5, r * 0.5, pal[0], pal[1]);
}
function coolTower(b, x, wB, h) {
  const top = FAR_BASE - h, litLeft = x > GXF;
  plume(b, x + 1, top - 1, wB / 40, P('#5e3c7c', '#80508c', '#c9748a'), x);
  for (let y = top; y < FAR_BASE; y++) {
    const t = (y - top) / h, k = t < 0.22 ? 0.58 + 0.2 * ((0.22 - t) / 0.22) ** 2 : 0.58 + 0.42 * Math.pow((t - 0.22) / 0.78, 1.5);
    const hw = Math.round(wB / 2 * k), lw = Math.max(2, Math.round(hw * 0.45));
    rect(b, x - hw, y, hw * 2 + 1, 1, FARP[1]);
    rect(b, litLeft ? x - hw : x + hw + 1 - lw, y, lw, 1, FARP[2]);
    rect(b, litLeft ? x + hw + 2 - lw : x - hw, y, lw - 1, 1, FARP[0]);
  }
  const hw0 = Math.round(wB / 2 * 0.78);
  rect(b, x - hw0, top, hw0 * 2 + 1, 1, FARP[3]);
  LIVE.farPl.push([x + 2, top - 3, wB / 40]);
}
function farStack(b, x, h, w) {
  const top = FAR_BASE - h;
  rect(b, x, top, w, h, FARP[1]); rect(b, x + (x < GXF ? w - 1 : 0), top, 1, h, FARP[2]);
  rect(b, x - 1, top, w + 2, 1, FARP[3]); rect(b, x - 1, top + 5, w + 2, 1, FARP[0]);
  LIVE.farL.push([x + (w >> 1), top - 2]);
}
function pylon(b, x, h, c) {
  const top = FAR_BASE - h, hwAt = y => 1 + 4 * (y - top - 9) / (h - 9);
  rect(b, x - 1, top, 3, 9, c);
  for (const [ay, aw] of [[top + 2, 8], [top + 8, 6]]) { rect(b, x - aw, ay, aw * 2 + 1, 1, c); put(b, x - aw, ay + 1, c); put(b, x + aw, ay + 1, c); }
  for (let y = top + 9, k = 0; y < FAR_BASE; y += 7, k++) {
    const y2 = Math.min(FAR_BASE, y + 7), a = hwAt(y), q = hwAt(y2);
    line(b, x - a, y, x - q, y2, c); line(b, x + a, y, x + q, y2, c);
    if (k % 2) line(b, x - a, y, x + q, y2, c); else line(b, x + a, y, x - q, y2, c);
  }
}
function paintFar(b, X1) {
  // sheds along the horizon
  rect(b, -10, FAR_BASE, X1 + 10, 250 - FAR_BASE, FARP[0]);
  for (let x = -10; x < X1;) {
    const w = 9 + (nz(x, 31) * 24 | 0), h = 3 + (nz(x, 32) * 11 | 0);
    rect(b, x, FAR_BASE - h, w, h, FARP[nz(x, 34) > 0.5 ? 0 : 1]);
    if (nz(x, 35) > 0.55) rect(b, x + 2, FAR_BASE - h - 2, 3, 2, FARP[1]);
    x += w + (nz(x, 33) * 5 | 0);
  }
  // pylons marching off, wires sagging between them
  const PY = [[-4, 46], [50, 50], [112, 44], [222, 52], [300, 46], [366, 54], [452, 48], [534, 52]].filter(p => p[0] < X1 + 20);
  for (let i = 0; i + 1 < PY.length; i++) for (const [dy, aw] of [[2, 8], [8, 6]]) for (const s of [-1, 1]) {
    const x0 = PY[i][0] + s * aw, y0 = FAR_BASE - PY[i][1] + dy + 1, x1 = PY[i + 1][0] + s * aw, y1 = FAR_BASE - PY[i + 1][1] + dy + 1;
    for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0); put(b, x, lerp(y0, y1, t) + 7 * 4 * t * (1 - t), FARP[2]); }
  }
  for (const [x, h] of PY) pylon(b, x, h, FARP[1]);
  for (const [x, w, h] of [[FO + 122, 36, 60], [FO + 86, 50, 80], [FO + 392, 44, 72], [FO - 22, 40, 66], [FO + 476, 32, 54]]) if (x < X1 + 20) coolTower(b, x, w, h);
  for (const [x, h, w] of [[FO + 150, 84, 3], [FO + 160, 70, 2], [FO + 212, 78, 2], [FO + 4, 74, 2], [FO + 360, 90, 3], [FO + 446, 80, 2], [FO + 268, 66, 2], [FO - 40, 66, 2]]) if (x < X1) farStack(b, x, h, w);
  // the haze of the last light swallows their feet
  tint(b, I('#f09a5c'), (x, y) => ss(96, 150, y) * 0.52);
  for (let i = 0; i < 90; i++) { const x = -8 + nz(i, 41) * (X1 + 6), y = FAR_BASE - 2 - (nz(i, 42) * 9 | 0); if (get(b, x, y) !== NONE && get(b, x, y - 2) !== NONE) put(b, x, y, I(nz(i, 43) > 0.5 ? '#ffe9a8' : '#ffc66a')); }
}

// ============================================================
// The factory (p 0.22): halls with saw-tooth roofs and lit windows, stacks, silos, a control block, searchlight
// towers, a crane. `MO + sx` puts a thing at screen x `sx` when the camera is on the boss lock.
// ============================================================
const MO = Math.round((LOCK_AT - SC.cam0) * 0.22), MID_BASE = 178, GXM = 237 + MO;
function winRow(b, x0, x1, y, ww, wh, gap, seed, live) {
  for (let x = x0, k = 0; x + ww <= x1; x += ww + gap, k++) {
    const r = nz(k, seed), lit = r < 0.56;
    rect(b, x, y, ww, wh, lit ? WIN[r < 0.12 ? 0 : r < 0.36 ? 1 : 2] : WIN[3]);
    if (lit && wh > 2) rect(b, x, y + wh - 1, ww, 1, WIN[2]);
    if (live && lit && nz(k, seed + 5) > 0.8) LIVE.midW.push([x, y, ww, wh]);
  }
}
function hall(b, x, w, top, o = {}) {
  const tw = o.tw || 22, th = o.th == null ? 8 : o.th;
  for (let i = 0; i < w; i++) {
    const k = i % tw, ry = top + (th ? Math.round((o.flip ? tw - 1 - k : k) / (tw - 1) * th) : 0);
    rect(b, x + i, ry, 1, 250 - ry, MIDP[1]);
    if (i % 11 === 0) rect(b, x + i, top + th + 1, 1, 250 - top, MIDP[0]);
  }
  rect(b, x, top + th + 1, w, 1, MIDP[2]);
  winRow(b, x + 3, x + w - 2, top + th + 3, 3, 4, 3, x * 3 + 1, true);
  for (let r = 0; r < 4; r++) winRow(b, x + 4, x + w - 3, top + th + 16 + r * 14, 5, 6, 6, x * 3 + 7 + r);
}
function block(b, x, w, top) {
  rect(b, x, top, w, 250 - top, MIDP[2]); rect(b, x, top, w, 2, MIDP[3]);
  rect(b, x + (x < GXM ? 0 : w - 3), top + 2, 3, 250 - top, MIDP[1]);
  for (let r = 0; r < 9; r++) winRow(b, x + 3, x + w - 2, top + 6 + r * 8, 4, 3, 2, x + r * 11, r < 3);
  rect(b, x + 3, top - 3, 6, 3, MIDP[2]); rect(b, x + w - 9, top - 5, 5, 5, MIDP[1]); rect(b, x + (w >> 1), top - 12, 1, 12, MIDP[2]);
  LIVE.midL.push([x + (w >> 1), top - 13, 0]);
}
function stack(b, x, top, w0, base) {
  for (let y = top; y < base; y++) {
    const w = w0 - Math.round((1 - (y - top) / (base - top)) * w0 * 0.34), x0 = x - (w >> 1), dark = x < GXM ? 0 : w - (w >> 1);
    rect(b, x0, y, w, 1, MIDP[2]); rect(b, x0 + dark, y, w >> 1, 1, MIDP[1]);
  }
  const wt = w0 - Math.round(w0 * 0.34), xt = x - (wt >> 1);
  rect(b, xt - 1, top, wt + 2, 2, MIDP[3]);
  rect(b, xt, top + 4, wt, 2, MIDP[4]); rect(b, xt, top + 9, wt, 1, MIDP[4]);
  rect(b, xt - 2, top + 16, wt + 4, 1, MIDP[3]); for (let i = -2; i < wt + 3; i += 2) put(b, xt + i, top + 15, MIDP[3]); rect(b, xt - 2, top + 14, wt + 4, 1, MIDP[2]);
  LIVE.stacks.push([x, top - 1, w0 > 6 ? 1 : 0.7]);
  LIVE.midL.push([xt - 2, top + 13, 1]);
}
function lattice(b, x, top, base, hw0, hw1, c, c2) {
  const hwAt = y => lerp(hw0, hw1, (y - top) / (base - top));
  for (let y = top, k = 0; y < base; k++) {
    const y2 = Math.min(base, y + Math.max(5, Math.round(hwAt(y) * 2))), a = hwAt(y), q = hwAt(y2);
    line(b, x - a, y, x - q, y2, c); line(b, x + a, y, x + q, y2, c2 || c);
    if (k % 2) line(b, x - a, y, x + q, y2, c); else line(b, x + a, y, x - q, y2, c);
    rect(b, Math.round(x - a), y, Math.round(a) * 2 + 1, 1, c);
    y = y2;
  }
}
function searchTower(b, x, top, base, pal, layer, ph) {
  lattice(b, x, top + 8, base, 3, 7, pal[2], pal[3]);
  rect(b, x - 5, top, 11, 8, pal[2]); rect(b, x - 6, top - 1, 13, 1, pal[4]); rect(b, x - 5, top + 7, 11, 1, pal[0]);
  rect(b, x - 3, top + 2, 7, 3, WIN[1]); rect(b, x - 3, top + 2, 7, 1, WIN[0]);
  rect(b, x - 2, top - 4, 5, 3, pal[3]);
  LIVE.beams.push({ layer, x, y: top - 3, ph });
}
function silos(b, x, top, n, w) {
  for (let i = 0; i < n; i++) {
    const sx = x + i * (w + 1), t2 = top + (i % 2) * 5;
    rect(b, sx, t2 + 3, w, 250 - t2, MIDP[2]); oval(b, sx + (w - 1) / 2, t2 + 3, (w - 1) / 2, 3, MIDP[2]);
    for (let k = 2; k < w; k += 3) rect(b, sx + k, t2 + 4, 1, 250 - t2, MIDP[1]);
    rect(b, sx, t2 + 12, w, 1, MIDP[1]); rect(b, sx, t2 + 30, w, 1, MIDP[1]);
    rect(b, sx + (sx < GXM ? w - 2 : 0), t2 + 4, 2, 250 - t2, MIDP[sx < GXM ? 3 : 1]);
  }
  rect(b, x - 2, top + 9, n * (w + 1) + 3, 1, MIDP[3]);                      // a catwalk across them
  for (let i = -2; i < n * (w + 1) + 2; i += 3) put(b, x + i, top + 8, MIDP[3]);
  rect(b, x - 2, top + 7, n * (w + 1) + 3, 1, MIDP[3]);
  rect(b, x + 2, top + 5, 2, 2, WIN[1]);
}
function waterTower(b, x, top, base) {
  lattice(b, x, top + 13, base, 4, 6, MIDP[2]);
  rect(b, x - 8, top + 3, 17, 10, MIDP[2]); rect(b, x - 8, top + 3, 17, 1, MIDP[3]); rect(b, x - 8, top + 8, 17, 1, MIDP[1]);
  poly(b, [[x - 8, top + 3], [x + 0.5, top - 2], [x + 9, top + 3]], MIDP[3]);
  rect(b, x, top - 5, 1, 4, MIDP[2]);
}
function crane(b, x, top, base) {
  rect(b, x - 12, top + 14, 2, base - top, MIDP[2]); rect(b, x + 10, top + 14, 2, base - top, MIDP[2]);
  rect(b, x - 16, top + 12, 34, 3, MIDP[3]); rect(b, x - 16, top + 15, 34, 1, MIDP[1]);
  line(b, x - 4, top + 12, x + 26, top - 6, MIDP[3], 2); line(b, x - 4, top + 12, x - 2, top + 2, MIDP[2]); line(b, x - 2, top + 2, x + 26, top - 6, MIDP[2]);
  rect(b, x + 25, top - 5, 1, 20, MIDP[1]); rect(b, x + 23, top + 15, 5, 3, MIDP[3]);
  rect(b, x - 6, top + 7, 8, 5, MIDP[2]); rect(b, x - 4, top + 8, 4, 2, WIN[1]);
  LIVE.midL.push([x + 26, top - 8, 2]);
}
function paintMid(b, X1) {
  rect(b, -10, MID_BASE, X1 + 10, 250 - MID_BASE, MIDP[0]);
  const M = sx => MO + sx;
  // (approach) left of the boss camera's view
  hall(b, M(-150), 70, 112, { th: 6 }); silos(b, M(-112), 98, 3, 11); stack(b, M(-66), 64, 7, 200);
  searchTower(b, M(-88), 74, MID_BASE, MIDP, 'mid', 2.1);
  // the part that shows above the wall during the fight, left to right
  hall(b, M(-34), 88, 86, {});
  stack(b, M(30), 37, 10, 220);
  hall(b, M(60), 92, 110, { th: 0 }); waterTower(b, M(138), 80, 112);
  rect(b, M(70), 104, 8, 6, MIDP[2]); rect(b, M(96), 106, 14, 4, MIDP[2]); rect(b, M(84), 102, 2, 8, MIDP[1]);
  silos(b, M(160), 84, 3, 14);
  searchTower(b, M(224), 60, MID_BASE, MIDP, 'mid', 0);
  block(b, M(244), 42, 70);
  hall(b, M(286), 56, 96, { flip: true });
  stack(b, M(298), 66, 5, 200); stack(b, M(309), 72, 4, 200);
  crane(b, M(350), 76, MID_BASE);
  hall(b, M(378), 130, 100, {});
  stack(b, M(428), 42, 11, 220);
  searchTower(b, M(466), 58, MID_BASE, MIDP, 'mid', 3.4);
  // pipe bridges between the buildings
  for (const [x0, x1, y] of [[M(34), M(62), 120], [M(206), M(246), 126], [M(-60), M(-36), 124]]) { rect(b, x0, y, x1 - x0, 3, MIDP[2]); rect(b, x0, y, x1 - x0, 1, MIDP[3]); for (let x = x0 + 3; x < x1; x += 7) rect(b, x, y + 3, 1, 4, MIDP[1]); }
  rimLight(b, GXM, (x, y) => RIMC[y > 84 ? 2 : y > 58 ? 1 : 0], MIDP[3]);
  tint(b, I('#8a3e5c'), (x, y) => ss(118, 190, y) * 0.3);
}

// ============================================================
// The yard (p 0.5): a fence with barbed wire, fuel tanks, containers, a watchtower, floodlights, a tall radio mast
// ============================================================
const NO = Math.round((LOCK_AT - SC.cam0) * 0.5), YARD = 214, GXN = 237 + NO;
function paintNear(b, X1) {
  const N = sx => NO + sx;
  // fuel tanks on saddles
  for (const [x, w, h] of [[N(-250), 62, 24], [N(-180), 50, 20], [N(40), 70, 26]]) {
    for (let j = 0; j < h; j++) {
      const inset = j < 2 ? 2 - j : j > h - 3 ? j - h + 3 : 0, t = j / h;
      rect(b, x + inset, YARD - 5 - h + j, w - inset * 2, 1, NEARP[t < 0.16 ? 4 : t < 0.42 ? 3 : t < 0.8 ? 2 : 1]);
    }
    for (let k = 10; k < w - 4; k += 16) rect(b, x + k, YARD - 5 - h, 1, h, NEARP[1]);
    for (let j = 2; j < h - 2; j++) for (let i = 0; i < 6; i++) put(b, x + w - 14 + i, YARD - 5 - h + j, ((i + j) >> 1) & 1 ? I('#8a6a22') : NEARP[0]);
    rect(b, x + 6, YARD - 5, 5, 5, NEARP[2]); rect(b, x + w - 11, YARD - 5, 5, 5, NEARP[2]);
    rect(b, x + 22, YARD - 9 - h, 6, 4, NEARP[3]);
  }
  // shipping containers
  for (const [x, y, c] of [[N(-120), 0, '#3a1c30'], [N(-84), 0, '#1b3040'], [N(-108), 17, '#3a3020'], [N(130), 0, '#1b3040'], [N(166), 0, '#3a1c30']]) {
    const C = I(c), y0 = YARD - 17 - y;
    rect(b, x, y0, 34, 17, C); rect(b, x, y0, 34, 1, mixI(C, I('#b08a9a'), 0.35)); rect(b, x, y0 + 16, 34, 1, NEARP[0]);
    for (let k = 2; k < 34; k += 3) rect(b, x + k, y0 + 2, 1, 13, mixI(C, NEARP[0], 0.45));
  }
  // the watchtower
  const wx = N(-10);
  lattice(b, wx, 162, YARD, 6, 9, NEARP[3]);
  rect(b, wx - 10, 146, 21, 16, NEARP[2]); rect(b, wx - 12, 144, 25, 2, NEARP[4]); rect(b, wx - 10, 161, 21, 1, NEARP[0]);
  rect(b, wx - 7, 150, 15, 5, WIN[1]); rect(b, wx - 7, 150, 15, 1, WIN[0]); rect(b, wx, 150, 1, 5, NEARP[1]);
  rect(b, wx - 2, 140, 5, 4, NEARP[3]);
  LIVE.beams.push({ layer: 'near', x: wx, y: 141, ph: 1.2 });
  // the radio mast, guyed
  const mx = N(58);
  for (const s of [-1, 1]) line(b, mx, 96, mx + s * 46, YARD, NEARP[2]);
  lattice(b, mx, 50, YARD, 1.5, 6, NEARP[3], I('#7a4654'));
  rect(b, mx, 40, 1, 10, NEARP[4]);
  for (const y of [78, 120, 166]) rect(b, mx - 6, y, 13, 1, NEARP[4]);
  oval(b, mx + 6, 92, 2, 3, NEARP[4]); oval(b, mx - 6, 104, 2, 3, NEARP[3]);
  LIVE.nearL.push([mx, 39, 0], [mx - 3, 77, 1], [mx + 5, 119, 2]);
  rimLight(b, GXN, (x, y) => RIMC[y > 150 ? 1 : 0], NEARP[3]);
  // the yard and its floodlights
  rect(b, -10, YARD, X1 + 10, 250 - YARD, NEARP[1]); rect(b, -10, YARD, X1 + 10, 1, NEARP[3]);
  for (let x = -6; x < X1; x += 26) rect(b, x, YARD + 9, 12, 1, NEARP[2]);
  for (const fx of [N(-286), N(-150), N(-46), N(110), N(250), N(400)]) {
    if (fx > X1) continue;
    rect(b, fx, 150, 2, YARD - 150, NEARP[3]); rect(b, fx, 150, 1, YARD - 150, NEARP[4]);
    rect(b, fx - 5, 148, 8, 3, NEARP[4]); rect(b, fx - 5, 151, 6, 1, I('#fff0c0'));
    for (let j = 0; j < 5; j++) rect(b, fx - 24 + j * 3, YARD + 1 + j, 44 - j * 6, 1, mixI(NEARP[1], I('#c8a070'), 0.3 - j * 0.04));
    LIVE.nearF.push([fx - 2, 152]);
  }
  // the fence in front of it all
  for (let y = 191; y < YARD; y++) for (let x = -10; x < X1; x++) if (((x + y) & 3) === 0 || ((x - y) & 3) === 0) put(b, x, y, NEARP[2]);
  rect(b, -10, 190, X1 + 10, 1, NEARP[4]);
  for (let x = -10; x < X1; x++) { put(b, x, 187 + Math.round(Math.sin(x * 1.1) * 1.4), NEARP[3]); if (x % 5 === 0) put(b, x, 185, NEARP[4]); }
  for (let x = -4; x < X1; x += 30) { rect(b, x, 184, 2, YARD - 184, NEARP[4]); rect(b, x + 1, 184, 1, YARD - 184, NEARP[2]); }
}

// ============================================================
// The base wall (world space): riveted plates under three floodlights, ribs, a cable tray, pipes, vents, screens,
// warning lamps, the catwalk on top, and the gatehouse with the blast door
// ============================================================
const FLOODS = [WALL_X + 44, WALL_X + 204, WALL_X + 336];
function lightLv(x, y) {
  const dy = y - 107;
  if (dy < 0) return 0;
  let v = 0;
  for (const fx of FLOODS) { const hw = 5 + dy * 0.52, dx = Math.abs(x - fx); if (dx < hw) v = Math.max(v, (1 - dy / 92) * (1 - 0.55 * (dx / hw) * (dx / hw))); }
  if (v <= 0) return 0;
  const q = v * 2.6, f = Math.floor(q);
  return f + (clamp((q - f - 0.3) / 0.4, 0, 1) > bay(x, y) ? 1 : 0);
}
// steel tone t (0..1) at a wall pixel, with the floodlights on it
function steel(t, x, y) {
  const lv = lightLv(x, y), c = flat(ST, t + lv * 0.085);
  return lv ? mixI(c, WARM, 0.055 * lv) : c;
}
function plateTone(x, y) {
  const ry = y - WTOP, row = Math.floor(ry / 32), ly = ry - row * 32;
  const rx = x - WALL_X + (row & 1) * 20 + 400, col = Math.floor(rx / 40), lx = rx - col * 40;
  const t = 0.31 - row * 0.024 + (nz(col, row + 40) - 0.5) * 0.06 - ss(218, 232, y) * 0.06;
  if (lx === 0 || ly === 0) return t - 0.13;
  if (lx === 1 || ly === 1) return t + 0.07;
  if (lx === 39 || ly === 31) return t - 0.05;
  const rvx = lx === 4 || lx === 20 || lx === 36, rvy = ly === 4 || ly === 28;
  if (rvx && rvy) return t + 0.16;
  if (rvx && (ly === 5 || ly === 29)) return t - 0.08;
  return t + (fbm(x / 13, y / 21, 3, 2) - 0.5) * 0.03;
}
function srect(b, x, y, w, h, t) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, steel(t, x + i, y + j)); }
// a box standing proud of the wall: lit top and left edges, dark bottom and right
function sbox(b, x, y, w, h, t) {
  srect(b, x, y, w, h, t); srect(b, x, y, w, 1, t + 0.16); srect(b, x, y, 1, h, t + 0.1);
  srect(b, x, y + h - 1, w, 1, t - 0.16); srect(b, x + w - 1, y, 1, h, t - 0.12);
  rect(b, x + 1, y + h, w, 1, ST[0]);
}
function hazard(b, x, y, w, h, per, dir, dim) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const on = (Math.floor((x + i + dir * (y + j)) / (per / 2)) & 1) === 0;
    let c = on ? (j === 0 ? HZ.yl : j === h - 1 ? HZ.yd : HZ.y) : (j === 0 ? HZ.kl : HZ.k);
    if (on && nz(x + i, y + j + 500) > 0.93) c = HZ.yd;                               // chipped paint
    put(b, x + i, y + j, dim ? mixI(c, ST[1], dim) : c);
  }
}
function hpipe(b, x0, x1, y, tones, dt) { for (let x = x0; x < x1; x++) tones.forEach((t, i) => put(b, x, y + i, steel(t + (dt || 0), x, y + i))); }
const PIPE8 = [0.3, 0.52, 0.74, 0.66, 0.54, 0.44, 0.34, 0.2], PIPE10 = [0.3, 0.5, 0.72, 0.82, 0.68, 0.56, 0.48, 0.4, 0.3, 0.2];
// a hand wheel seen edge-on, on its stem (a ring with spokes reads as a target marker)
function handWheel(b, x, y, w, stem) {
  rect(b, x - 1, y + 2, 2, stem, ST[4]); put(b, x - 1, y + 2, ST[6]);
  rect(b, x - (w >> 1), y, w, 2, RED[2]); rect(b, x - (w >> 1), y, w, 1, RED[1]); rect(b, x - (w >> 1), y + 2, w, 1, ST[0]);
  rect(b, x - 1, y - 1, 2, 1, ST[8]);
}
function paintInterior() {
  // the hangar behind the door: dark, ribbed, a furnace glow at the far end, rails on the floor
  const b = buf(0, 0, DOOR_W, DOOR_H), IN = P('#05060c', '#080a13', '#0d0d1a', '#160d18', '#240e16', '#360f17', '#4c1218', '#681a1a');
  for (let y = 0; y < DOOR_H; y++) for (let x = 0; x < DOOR_W; x++) {
    const g = Math.exp(-(((x - 70) / 40) ** 2) - (((y - 78) / 30) ** 2)) * 0.62 + (y > 92 ? 0.2 * Math.exp(-(((x - 70) / 56) ** 2)) * (y - 92) / 20 : 0);
    put(b, x, y, ramp(IN, 0.06 + g, x, y));
  }
  for (let k = 0; k < 4; k++) {
    const ix = 6 + k * 14, iy = 5 + k * 11, by = DOOR_H - 1 - k * 6, c = mixI(ST[2], I('#3a0e14'), 0.3 + k * 0.18), cl = mixI(ST[4], I('#5a1418'), 0.3 + k * 0.18);
    rect(b, ix, iy, 3, by - iy, c); rect(b, ix, iy, 1, by - iy, cl); rect(b, DOOR_W - ix - 3, iy, 3, by - iy, c); rect(b, DOOR_W - ix - 1, iy, 1, by - iy, I('#07060a'));
    rect(b, ix, iy, DOOR_W - ix * 2, 3, c); rect(b, ix, iy + 2, DOOR_W - ix * 2, 1, I('#07060a'));
    rect(b, 68 - (3 - k), iy + 3, 5 + (3 - k) * 2, 2, RED[k < 2 ? 1 : 2]); rect(b, 69, iy + 3, 3, 1, RED[0]);
  }
  // the far end: a furnace door, its glow on the rails
  rect(b, 55, 54, 31, 32, I('#1a0a0e')); rect(b, 57, 56, 27, 30, I('#5a1612'));
  for (let y = 58; y < 86; y++) for (let x = 59; x < 82; x++) put(b, x, y, ramp(P('#701a12', '#9c2812', '#c8421a', '#e66c26', '#f69a3e'), (y - 58) / 32 + 0.2 * Math.exp(-(((x - 70) / 8) ** 2)), x, y));
  for (let y = 61; y < 86; y += 5) rect(b, 58, y, 25, 1, I('#2a0c0e'));
  for (const s of [-1, 1]) for (let y = 88; y < DOOR_H; y++) { const x = 70 + s * (9 + (y - 88) * 1.5); put(b, x, y, I('#a8401e')); put(b, x + s, y, I('#4a1612')); }
  for (let y = 92; y < DOOR_H; y += 4) rect(b, 70 - (y - 80) * 1.4, y, (y - 80) * 2.8, 1, I('#2c0e10'));
  // pipes along the left wall
  for (const [y0, y1] of [[26, 58], [34, 62]]) line(b, 9, y0, 54, y1, I('#2c1218'));
  return b;
}
function paintShutter() {
  // heavy slats, guide rails, a big robot eye, a hazard bar along the bottom
  const b = buf(0, 0, DOOR_W, DOOR_H), SL = [ST[8], ST[7], ST[6], ST[6], ST[6], ST[5], ST[4], ST[1]];
  for (let y = 0; y < DOOR_H - 12; y++) rect(b, 0, y, DOOR_W, 1, SL[y % 8]);
  for (let y = 0; y < DOOR_H - 12; y++) for (let x = 0; x < DOOR_W; x++) if (nz(x >> 1, y + 700) > 0.9 && y % 8 > 1 && y % 8 < 6) put(b, x, y, ST[5]);
  for (const x of [30, 108]) { rect(b, x, 0, 2, DOOR_H - 12, ST[4]); rect(b, x + 2, 0, 1, DOOR_H - 12, ST[2]); rect(b, x - 1, 0, 1, DOOR_H - 12, ST[8]); }
  for (const x of [0, DOOR_W - 4]) { rect(b, x, 0, 4, DOOR_H, ST[3]); rect(b, x + (x ? 0 : 3), 0, 1, DOOR_H, ST[1]); for (let y = 5; y < DOOR_H; y += 10) put(b, x + 1 + (x ? 1 : 0), y, ST[7]); }
  disc(b, 70, 46, 17, ST[2]); disc(b, 70, 46, 16, ST[7]); disc(b, 69, 45, 14, ST[8], ST[7]); disc(b, 70, 46, 13, ST[1]);
  disc(b, 70, 46, 11, RED[3]); disc(b, 70, 46, 10, RED[2]); disc(b, 68, 44, 7, RED[1], RED[2]); disc(b, 70, 46, 4, I('#3a0c0e')); disc(b, 70, 46, 3, RED[0]); put(b, 68, 44, I('#ffffff'));
  for (let a = 0; a < 8; a++) put(b, 70 + Math.round(Math.cos(a * Math.PI / 4 + 0.39) * 15), 46 + Math.round(Math.sin(a * Math.PI / 4 + 0.39) * 15), ST[3]);
  stamp(b, 'BAY 01', 36, 80, ST[3], 2); stamp(b, 'BAY 01', 36, 79, ST[8], 2);
  rect(b, 0, DOOR_H - 13, DOOR_W, 1, ST[1]);
  [ST[9], ST[7], ST[7], ST[6], ST[5], ST[3]].forEach((c, i) => rect(b, 0, DOOR_H - 12 + i, DOOR_W, 1, c));
  for (let x = 10; x < DOOR_W; x += 15) { put(b, x, DOOR_H - 10, ST[9]); put(b, x, DOOR_H - 9, ST[3]); }
  hazard(b, 0, DOOR_H - 6, DOOR_W, 5, 8, 1, 0);
  rect(b, 0, DOOR_H - 1, DOOR_W, 1, ST[0]);
  for (const x of [5, DOOR_W - 9]) { rect(b, x, DOOR_H - 11, 4, 4, RED[3]); rect(b, x + 1, DOOR_H - 10, 2, 2, RED[1]); }
  return b;
}
let WB = null;                                       // the wall's buffer while it is being painted
const WX1 = WALL_X + 546, RIBS = [0, 80, 160, 240, 320].map(k => WALL_X + k);
function wallPlates() {
  const b = WB = buf(WALL_X - 10, 48, 556, 184), X0 = WALL_X;
  for (let y = WTOP; y < GROUND; y++) for (let x = X0; x < GH_X; x++) put(b, x, y, steel(plateTone(x, y), x, y));
  // grime: dark streaks down from the catwalk lip
  for (let x = X0; x < GH_X; x++) if (nz(x >> 1, 77) > 0.84) { const len = 8 + (nz(x >> 1, 78) * 34 | 0); for (let y = WTOP + 2; y < WTOP + 2 + len; y++) if (bay(x, y) > (y - WTOP) / (len + 6)) put(b, x, y, mixI(get(b, x, y), ST[0], 0.35)); }
}
function wallFittings() {
  const b = WB, X0 = WALL_X;
  // skirting along the floor
  srect(b, X0, 224, GH_X - X0, 8, 0.25); srect(b, X0, 224, GH_X - X0, 1, 0.42); rect(b, X0, 231, GH_X - X0, 1, ST[0]);
  for (let x = X0 + 6; x < GH_X; x += 16) put(b, x, 227, ST[5]);
  // a conduit at shoulder height
  for (let x = X0; x < GH_X; x++) { put(b, x, 181, steel(0.44, x, 181)); put(b, x, 182, steel(0.3, x, 182)); put(b, x, 183, ST[0]); if ((x - X0) % 20 === 9) { put(b, x, 180, steel(0.5, x, 180)); put(b, x, 182, steel(0.5, x, 182)); put(b, x + 1, 181, steel(0.56, x, 181)); if (x > X0 + 12) LIVE.chase.push(x); } }
  // the cable tray under the catwalk
  for (let x = X0; x < GH_X; x++) {
    const sag = Math.round(Math.sin(((x - X0) % 40) / 40 * Math.PI) * 1.2);
    put(b, x, 111 + sag, I('#5a2028')); put(b, x, 113 + sag, I('#1e4a55')); put(b, x, 114 + sag, I('#6a5420'));
    put(b, x, 116, steel(0.5, x, 116)); put(b, x, 117, steel(0.36, x, 117)); put(b, x, 118, ST[0]);
    if ((x - X0) % 40 === 0) for (let y = 108; y < 120; y++) { put(b, x, y, steel(0.5, x, y)); put(b, x + 1, y, steel(0.3, x, y)); }
  }
  // two pipes
  hpipe(b, X0, GH_X, 123, PIPE8, -0.06);
  for (let x = X0; x < GH_X; x++) { put(b, x, 134, I('#8a5a3a')); put(b, x, 135, I('#6a3e28')); put(b, x, 136, I('#2e1a16')); put(b, x, 137, ST[0]); }
  for (let fx = X0 + 40; fx < GH_X; fx += 80) { srect(b, fx, 121, 3, 12, 0.56); srect(b, fx, 121, 1, 12, 0.72); srect(b, fx + 2, 121, 1, 12, 0.3); put(b, fx + 1, 123, ST[8]); put(b, fx + 1, 130, ST[8]); }
  // a valve and a gauge on the pipe, a branch down to a steam nozzle
  const vx = WALL_X + 150;
  handWheel(b, vx, 117, 12, 5);
  disc(b, vx + 20, 119, 4, ST[2]); disc(b, vx + 20, 119, 3, ST[7]); line(b, vx + 20, 119, vx + 22, 117, RED[3]); put(b, vx + 20, 119, ST[1]);
  for (const sx of [WALL_X + 126, WALL_X + 306]) {
    for (let y = 131; y < 150; y++) { put(b, sx, y, steel(0.6, sx, y)); put(b, sx + 1, y, steel(0.44, sx, y)); put(b, sx + 2, y, steel(0.24, sx, y)); }
    sbox(b, sx - 2, 150, 7, 5, 0.46); rect(b, sx, 155, 3, 1, ST[0]);
    LIVE.steam.push([sx + 1, 157, 1]);
  }
  // vents with fans (the blades are live), a drip stain under each
  for (const cx of [WALL_X + 104]) {
    const cy = 156;
    sbox(b, cx - 16, cy - 16, 32, 32, 0.46);
    for (const [dx, dy] of [[-13, -13], [12, -13], [-13, 12], [12, 12]]) { put(b, cx + dx, cy + dy, ST[8]); put(b, cx + dx, cy + dy + 1, ST[1]); }
    disc(b, cx, cy, 13, ST[6]); disc(b, cx, cy, 12, ST[1]); disc(b, cx, cy, 11, I('#090a10'));
    for (let x = cx - 9; x < cx + 9; x++) if (nz(x, 91) > 0.4) { const len = 12 + (nz(x, 92) * 26 | 0); for (let y = cy + 17; y < cy + 17 + len && y < 224; y++) if (bay(x, y) > (y - cy - 17) / len) put(b, x, y, mixI(get(b, x, y), I('#0c0d12'), 0.4)); }
    LIVE.vents.push([cx, cy]);
  }
  // a pressure tank strapped to the wall in the fourth bay, fed from the copper line
  const tx = WALL_X + 252, ty = 146, TW = 46, TT = [0.3, 0.42, 0.56, 0.7, 0.78, 0.7, 0.62, 0.56, 0.52, 0.5, 0.48, 0.46, 0.44, 0.42, 0.4, 0.37, 0.33, 0.28, 0.22, 0.16];
  rect(b, tx + 3, ty + 20, TW - 4, 2, ST[0]);
  TT.forEach((t, j) => { const ins = j < 2 ? 3 - j : j > 17 ? j - 16 : j < 4 || j > 15 ? 1 : 0; for (let i = ins; i < TW - ins; i++) put(b, tx + i, ty + j, steel(t - 0.04 - (i > TW - 6 ? 0.08 : 0), tx + i, ty + j)); });
  for (const sx of [tx + 9, tx + TW - 12]) for (let j = 0; j < 20; j++) { put(b, sx, ty + j, steel(TT[j] + 0.12, sx, ty + j)); put(b, sx + 1, ty + j, steel(TT[j] - 0.1, sx, ty + j)); put(b, sx + 2, ty + j, ST[1]); }
  for (let j = 6; j < 13; j++) for (let i = 0; i < 12; i++) put(b, tx + 17 + i, ty + j, ((i + j) >> 1) & 1 ? mixI(HZ.y, ST[2], 0.5) : HZ.k);
  for (let y = 137; y < ty + 1; y++) { put(b, tx + 30, y, I('#8a5a3a')); put(b, tx + 31, y, I('#6a3e28')); put(b, tx + 32, y, I('#2e1a16')); }
  rect(b, tx + 28, ty - 2, 7, 2, ST[5]); rect(b, tx + 28, ty - 2, 7, 1, ST[7]);
  disc(b, tx + 40, ty - 3, 4, ST[2]); disc(b, tx + 40, ty - 3, 3, ST[7]); line(b, tx + 40, ty - 3, tx + 42, ty - 5, RED[3]); put(b, tx + 40, ty - 3, ST[1]); rect(b, tx + 39, ty + 1, 2, 1, ST[4]);
  for (const sx of [tx + 6, tx + TW - 9]) { rect(b, sx, ty + 20, 3, 5, ST[4]); rect(b, sx, ty + 20, 1, 5, ST[6]); rect(b, sx - 2, ty + 25, 7, 2, ST[5]); rect(b, sx - 2, ty + 27, 7, 1, ST[0]); }
  // a chain hoist under the catwalk (its chain and hook are live)
  const hx = WALL_X + 97;
  rect(b, hx - 7, WTOP + 1, 15, 3, ST[6]); rect(b, hx - 7, WTOP + 1, 15, 1, ST[8]); rect(b, hx - 7, WTOP + 4, 15, 1, ST[1]); rect(b, hx - 3, WTOP + 5, 7, 4, ST[5]); rect(b, hx - 3, WTOP + 5, 7, 1, ST[7]); rect(b, hx - 3, WTOP + 8, 7, 1, ST[2]);
  LIVE.hoist = [hx, WTOP + 9];
  // a control console with two screens, and a warning monitor
  const kx = WALL_X + 22;
  sbox(b, kx, 140, 44, 26, 0.44);
  for (const sx of [kx + 4, kx + 24]) { rect(b, sx, 144, 16, 11, ST[0]); rect(b, sx + 1, 145, 14, 9, I('#0a1c1e')); LIVE.screens.push({ x: sx + 1, y: 145, w: 14, h: 9, k: sx === kx + 4 ? 'wave' : 'bars' }); }
  for (let i = 0; i < 7; i++) { rect(b, kx + 5 + i * 5, 159, 3, 2, ST[1]); LIVE.leds.push([kx + 5 + i * 5, 159, 3, 2, i]); }
  sbox(b, kx + 2, 166, 40, 4, 0.5);
  line(b, kx + 10, 118, kx + 12, 140, I('#5a2028')); line(b, kx + 30, 118, kx + 28, 140, I('#1e4a55'));
  const wx = WALL_X + 180;
  sbox(b, wx, 144, 36, 22, 0.44); rect(b, wx + 3, 147, 30, 16, ST[0]); rect(b, wx + 4, 148, 28, 14, I('#1a0a0c'));
  LIVE.screens.push({ x: wx + 4, y: 148, w: 28, h: 14, k: 'warn' });
  line(b, wx + 18, 118, wx + 18, 144, I('#6a5420'));
  // the first bay: a sign for visitors, a workbench with a toolbox, an oil can and a spare soldier head
  const nx = WALL_X + 20;
  sbox(b, nx, 174, 58, 11, 0.3); stamp(b, 'NO HUMANS', nx + 3, 176, mixI(HZ.y, ST[2], 0.3), 1);
  const bx = WALL_X + 16, by = 208;
  srect(b, bx, by, 60, 2, 0.5); srect(b, bx, by + 2, 60, 1, 0.2); rect(b, bx + 1, by + 3, 59, 1, ST[0]);
  for (const lx of [bx + 3, bx + 54]) { srect(b, lx, by + 3, 3, 21, 0.4); srect(b, lx, by + 3, 1, 21, 0.52); }
  srect(b, bx + 6, by + 14, 48, 2, 0.36);
  rect(b, bx + 6, by - 9, 16, 9, I('#4a1c1e')); rect(b, bx + 6, by - 9, 16, 2, I('#6a2a2a')); rect(b, bx + 6, by - 7, 16, 1, I('#2a1012')); rect(b, bx + 12, by - 11, 4, 2, ST[5]); put(b, bx + 13, by - 5, ST[8]);
  rect(b, bx + 26, by - 5, 5, 5, ST[5]); rect(b, bx + 26, by - 5, 5, 1, ST[7]); line(b, bx + 30, by - 5, bx + 34, by - 9, ST[6]);
  rect(b, bx + 40, by - 9, 11, 9, ST[5]); rect(b, bx + 41, by - 10, 9, 1, ST[6]); rect(b, bx + 40, by - 9, 11, 2, ST[7]); rect(b, bx + 40, by - 2, 11, 2, ST[3]);
  rect(b, bx + 45, by - 6, 6, 3, ST[0]); put(b, bx + 48, by - 5, RED[3]); rect(b, bx + 42, by - 13, 1, 3, ST[4]);
  // bay numbers, stencilled low on the plates
  RIBS.forEach((rx, k) => { if (k > 0 && k < 4) stamp(b, '0' + (k + 1), rx + 14, 194, ST[4], 2); });
  // ribs with bolts, a warning lamp on each (the light is live)
  RIBS.forEach((rx, k) => {
    const TONES = [0.62, 0.5, 0.44, 0.44, 0.44, 0.44, 0.34, 0.24];
    for (let y = WTOP + 1; y < GROUND; y++) {
      const ly = (y - WTOP) % 32;
      TONES.forEach((t, i) => put(b, rx + i, y, steel(t + (ly === 0 ? -0.14 : ly === 1 ? 0.08 : (ly === 8 || ly === 24) && (i === 2 || i === 5) ? 0.26 : 0), rx + i, y)));
      put(b, rx + 8, y, mixI(get(b, rx + 8, y), ST[0], 0.5)); put(b, rx + 9, y, mixI(get(b, rx + 9, y), ST[0], 0.25));
    }
    sbox(b, rx - 2, 221, 12, 11, 0.4); sbox(b, rx - 1, WTOP + 1, 10, 4, 0.5);
    if (k) { sbox(b, rx + 1, 138, 6, 3, 0.56); rect(b, rx + 2, 141, 4, 5, RED[4]); rect(b, rx + 1, 146, 6, 1, ST[1]); LIVE.lamps.push([rx + 2, 141, k]); }
  });
  // the wall's outer end catches the last light
  for (let y = WTOP + 1; y < GROUND; y++) { put(b, X0 - 4, y, I('#7a4a52')); put(b, X0 - 3, y, ST[5]); put(b, X0 - 2, y, ST[4]); put(b, X0 - 1, y, ST[4]); }
  // the catwalk on top: lip (and its shadow on the plates), hazard band, railing, floodlights
  for (let x = X0; x < GH_X; x++) for (let j = 1; j < 4; j++) put(b, x, WTOP + j, mixI(get(b, x, WTOP + j), ST[0], 0.5 - j * 0.12));
  rect(b, X0 - 4, WTOP, GH_X - X0 + 4, 1, ST[0]);
  rect(b, X0 - 5, 98, GH_X - X0 + 5, 1, ST[8]);
  hazard(b, X0 - 5, 99, GH_X - X0 + 5, 5, 8, 1, 0.38);   // dim: the WARNING band's own stripes run right here
  rect(b, X0 - 5, 88, GH_X - X0 + 5, 1, ST[5]); rect(b, X0 - 5, 93, GH_X - X0 + 5, 1, ST[3]);
  for (let x = X0 - 5; x < GH_X; x += 20) { rect(b, x, 88, 1, 10, ST[4]); if ((x - X0 + 5) % 80 === 0) rect(b, x, 86, 2, 12, ST[5]); }
  for (const fx of FLOODS) { rect(b, fx - 5, WTOP, 10, 3, ST[6]); rect(b, fx - 5, WTOP, 10, 1, ST[8]); rect(b, fx - 4, WTOP + 3, 8, 1, I('#fff0c0')); }
  // loudspeakers and the radar's pedestal on the catwalk
  const lx = WALL_X + 300;
  rect(b, lx, 78, 2, 20, ST[5]); poly(b, [[lx - 1, 82], [lx - 9, 78], [lx - 9, 88], [lx - 1, 85]], ST[6]); poly(b, [[lx + 3, 82], [lx + 11, 78], [lx + 11, 88], [lx + 3, 85]], ST[4]);
  rect(b, lx - 10, 77, 1, 12, ST[8]); rect(b, lx + 11, 77, 1, 12, ST[6]);
  rect(b, WALL_X + 170, 84, 4, 14, ST[5]); rect(b, WALL_X + 170, 84, 1, 14, ST[7]); rect(b, WALL_X + 167, 96, 10, 2, ST[6]);
}
function wallGatehouse() {
  const b = WB, X1 = WX1;
  for (let y = GH_TOP; y < GROUND; y++) for (let x = GH_X; x < X1; x++) {
    const lx2 = (x - GH_X) % 28, ly = (y - GH_TOP) % 21;
    let t = 0.4 + (nz((x - GH_X) / 28 | 0, ((y - GH_TOP) / 21 | 0) + 90) - 0.5) * 0.05 - ss(150, 232, y) * 0.08;
    if (lx2 === 0 || ly === 0) t -= 0.14; else if (lx2 === 1 || ly === 1) t += 0.08;
    else if ((lx2 === 4 || lx2 === 24) && (ly === 4 || ly === 17)) t += 0.18;
    put(b, x, y, flat(ST, t));
  }
  rect(b, GH_X, GH_TOP, X1 - GH_X, 1, ST[8]); rect(b, GH_X, GH_TOP + 1, X1 - GH_X, 1, ST[6]);
  rect(b, GH_X, GH_TOP, 1, GROUND - GH_TOP, ST[7]); rect(b, GH_X + 1, GH_TOP + 2, 1, GROUND - GH_TOP, ST[5]); rect(b, GH_X - 1, GH_TOP + 1, 1, GROUND - GH_TOP, ST[0]);
  // roof rail, beacon sockets, a flag pole
  rect(b, GH_X, GH_TOP - 9, X1 - GH_X, 1, ST[5]); rect(b, GH_X, GH_TOP - 5, X1 - GH_X, 1, ST[3]);
  for (let x = GH_X; x < X1; x += 20) rect(b, x, GH_TOP - 9, 1, 9, ST[4]);
  for (const bx of [GH_X + 6, DOOR_X + DOOR_W + 8]) { rect(b, bx - 1, GH_TOP - 3, 9, 3, ST[6]); rect(b, bx - 1, GH_TOP - 3, 9, 1, ST[8]); }
  rect(b, DOOR_X + 70, 50, 1, GH_TOP - 50, ST[6]); rect(b, DOOR_X + 69, 49, 3, 1, ST[8]);
  // the sign over the door (lit live)
  rect(b, DOOR_X + 22, 83, 96, 20, ST[7]); rect(b, DOOR_X + 23, 84, 94, 18, ST[1]); rect(b, DOOR_X + 24, 85, 92, 16, I('#140a0e'));
  stamp(b, 'DANGER', DOOR_X + 35, 86, I('#4a1418'), 2);
  for (const x of [DOOR_X + 26, DOOR_X + 111]) for (const y of [87, 97]) put(b, x, y, ST[7]);
  // lintel and jambs in hazard stripes
  rect(b, DOOR_X - 13, 106, X1 - DOOR_X + 13, 1, ST[8]);
  hazard(b, DOOR_X - 13, 107, X1 - DOOR_X + 13, 12, 16, -1, 0.14);
  rect(b, DOOR_X - 13, 119, X1 - DOOR_X + 13, 1, ST[0]);
  for (const jx of [DOOR_X - 12, DOOR_X + DOOR_W]) {
    hazard(b, jx, DOOR_Y, 12, DOOR_H, 16, jx < DOOR_X ? 1 : -1, 0.34);   // dim: the crab's face and yellow eyes work right in front of it
    rect(b, jx, DOOR_Y, 1, DOOR_H, ST[7]); rect(b, jx + 11, DOOR_Y, 1, DOOR_H, ST[0]); rect(b, jx - 1, DOOR_Y, 1, DOOR_H, ST[1]);
    for (let y = DOOR_Y + 22; y < GROUND - 8; y += 30) { rect(b, jx + 1, y, 10, 4, ST[5]); rect(b, jx + 1, y, 10, 1, ST[8]); rect(b, jx + 1, y + 3, 10, 1, ST[1]); put(b, jx + 3, y + 2, ST[9]); put(b, jx + 8, y + 2, ST[9]); }
    for (let y = GROUND - 8; y < GROUND; y++) for (let i = 1; i < 11; i++) put(b, jx + i, y, mixI(get(b, jx + i, y), ST[0], (y - GROUND + 9) / 14));
  }
  // the hangar behind the door (the shutter is drawn live over it)
  const IN = paintInterior();
  for (let y = 0; y < DOOR_H; y++) for (let x = 0; x < DOOR_W; x++) put(b, DOOR_X + x, DOOR_Y + y, IN.d[y * DOOR_W + x]);
  // hydraulic cylinders beside the jambs (the rods are live)
  for (const px of [GH_X + 3, DOOR_X + DOOR_W + 13]) {
    rect(b, px + 2, DOOR_Y, 4, 56, ST[1]); rect(b, px + 2, DOOR_Y, 1, 56, ST[0]);
    [ST[3], ST[6], ST[7], ST[5], ST[4], ST[4], ST[3], ST[1]].forEach((c, i) => rect(b, px + i, 178, 1, GROUND - 178, c));
    rect(b, px - 1, 174, 10, 4, ST[5]); rect(b, px - 1, 174, 10, 1, ST[7]); rect(b, px - 1, 177, 10, 1, ST[2]);
    rect(b, px - 1, 204, 10, 2, ST[3]); rect(b, px - 1, 226, 10, 6, ST[4]); rect(b, px - 1, 226, 10, 1, ST[6]);
  }
}

// ============================================================
// The gate (drawn with its feet at GATE_X, GROUND) and the pipe rack
// ============================================================
function paintGate() {
  const b = buf(-64, -128, 128, 129), OI = I(OUT);
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -48 : 32, T = [0.66, 0.56, 0.48, 0.46, 0.46, 0.46, 0.46, 0.46, 0.46, 0.46, 0.46, 0.44, 0.4, 0.34, 0.28, 0.22];
    for (let y = -92; y < 0; y++) for (let i = 0; i < 16; i++) {
      const ly = (y + 92) % 23;
      put(b, x0 + i, y, flat(ST, T[i] + (ly === 0 ? -0.14 : ly === 1 ? 0.08 : (i === 3 || i === 12) && (ly === 6 || ly === 17) ? 0.22 : 0)));
    }
    for (const hy of [-82, -36]) { rect(b, x0 + 1, hy - 1, 14, 16, ST[1]); hazard(b, x0 + 2, hy, 12, 14, 8, s, 0); }
    rect(b, x0 - 3, -8, 22, 8, ST[4]); rect(b, x0 - 3, -8, 22, 1, ST[7]); rect(b, x0 - 3, -1, 22, 1, ST[1]); rect(b, x0 + 18, -8, 1, 8, ST[2]);
    rect(b, x0 - 2, -96, 20, 4, ST[5]); rect(b, x0 - 2, -96, 20, 1, ST[8]); rect(b, x0 - 2, -93, 20, 1, ST[2]);
    rect(b, x0 + 4, -99, 8, 3, ST[4]); rect(b, x0 + 4, -99, 8, 1, ST[7]); rect(b, x0 + 5, -104, 6, 5, RED[4]);
  }
  // the beam across: a box truss carrying the sign
  rect(b, -58, -112, 116, 2, ST[6]); rect(b, -58, -112, 116, 1, ST[8]); rect(b, -58, -99, 116, 2, ST[4]); rect(b, -58, -98, 116, 1, ST[1]);
  for (let x = -58; x < 54; x += 10) { line(b, x, -100, x + 5, -110, ST[4]); line(b, x + 5, -110, x + 10, -100, ST[3]); }
  rect(b, -42, -117, 84, 21, ST[7]); rect(b, -41, -116, 82, 19, ST[1]); rect(b, -40, -115, 80, 17, I('#160a0e'));
  stamp(b, 'ROBOT BASE', -29, -110, I('#5a1a1c'), 1);
  for (const x of [-38, 37]) for (const y of [-113, -101]) put(b, x, y, ST[7]);
  for (const x of [-30, 0, 30]) { rect(b, x - 1, -121, 3, 2, ST[5]); rect(b, x, -123, 1, 2, ST[6]); rect(b, x - 2, -119, 5, 1, I('#fff0c0')); }
  // the barrier arm, raised
  for (let k = 0; k < 46; k++) { const x = 30 - k * 0.3, y = -36 - k; rect(b, x, y, 3, 1, Math.floor(k / 6) & 1 ? I('#e8e4dc') : RED[2]); put(b, x + 2, y, Math.floor(k / 6) & 1 ? I('#a8a4a0') : RED[3]); }
  rect(b, 26, -40, 9, 8, ST[5]); rect(b, 26, -40, 9, 1, ST[8]); rect(b, 26, -33, 9, 1, ST[2]); put(b, 30, -36, ST[9]);
  outline(b, OI);
  return b;
}
function paintPipes() {
  const X = PIPES_X, gy = GROUND, b = buf(X - 8, gy - 106, 160, 107), fl = t => flat(ST, t);
  // trestles
  for (const tx of [X + 8, X + 72, X + 132]) {
    rect(b, tx, gy - 34, 4, 34, ST[3]); rect(b, tx, gy - 34, 1, 34, ST[5]); rect(b, tx + 3, gy - 34, 1, 34, ST[1]);
    line(b, tx - 6, gy - 2, tx, gy - 18, ST[3]); line(b, tx + 9, gy - 2, tx + 3, gy - 18, ST[2]);
    rect(b, tx - 7, gy - 3, 18, 3, ST[4]); rect(b, tx - 7, gy - 3, 18, 1, ST[6]);
    rect(b, tx - 3, gy - 35, 10, 2, ST[5]);
  }
  // risers behind the main pipe: one bends away with a steam exhaust, one carries a hand wheel
  const R8 = [0.3, 0.62, 0.8, 0.66, 0.5, 0.4, 0.3, 0.2];
  for (let y = gy - 92; y < gy - 44; y++) R8.forEach((t, i) => put(b, X + 30 + i, y, fl(t - 0.06)));
  for (let x = X + 30; x < X + 60; x++) PIPE8.forEach((t, i) => put(b, x, gy - 100 + i, fl(t - 0.06)));
  rect(b, X + 58, gy - 102, 3, 12, ST[5]); rect(b, X + 58, gy - 102, 1, 12, ST[7]); rect(b, X + 28, gy - 70, 12, 3, ST[5]); rect(b, X + 28, gy - 70, 12, 1, ST[7]);
  LIVE.steam.push([X + 63, gy - 96, 0]);
  for (let y = gy - 72; y < gy - 44; y++) [0.3, 0.62, 0.78, 0.56, 0.4, 0.22].forEach((t, i) => put(b, X + 100 + i, y, fl(t - 0.06)));
  rect(b, X + 102, gy - 77, 2, 5, ST[4]); rect(b, X + 96, gy - 79, 14, 2, RED[2]); rect(b, X + 96, gy - 79, 14, 1, RED[1]); rect(b, X + 102, gy - 80, 2, 1, ST[8]);
  // the thin copper line and the main pipe with its flanges
  for (let x = X - 2; x < X + 144; x++) { put(b, x, gy - 50, I('#9a6a44')); put(b, x, gy - 49, I('#7a4a30')); put(b, x, gy - 48, I('#3a2018')); }
  for (let x = X; x < X + 142; x++) PIPE10.forEach((t, i) => put(b, x, gy - 44 + i, fl(t - 0.08)));
  for (let fx = X + 16; fx < X + 140; fx += 36) { rect(b, fx, gy - 46, 3, 14, ST[5]); rect(b, fx, gy - 46, 1, 14, ST[7]); rect(b, fx + 2, gy - 46, 1, 14, ST[2]); put(b, fx + 1, gy - 44, ST[9]); put(b, fx + 1, gy - 35, ST[8]); }
  for (const ex of [X - 2, X + 141]) { rect(b, ex, gy - 46, 3, 14, ST[4]); rect(b, ex, gy - 46, 1, 14, ST[6]); }
  // valves, a gauge, rust under the flanges
  for (const vx of [X + 60, X + 120]) { handWheel(b, vx, gy - 56, 10, 10); rect(b, vx + 7, gy - 47, 2, 3, ST[6]); LIVE.steam.push([vx + 8, gy - 49, 0]); }
  disc(b, X + 88, gy - 51, 4, ST[2]); disc(b, X + 88, gy - 51, 3, I('#d9dee6')); line(b, X + 88, gy - 51, X + 86, gy - 53, RED[2]);
  for (let fx = X + 17; fx < X + 140; fx += 36) for (let y = gy - 32; y < gy - 32 + 5 + (nz(fx, 3) * 6 | 0); y++) put(b, fx, y, I('#5a3020'));
  outline(b, I('#0c0d14'));
  return b;
}

// ============================================================
// The deck (from world x 4340, y 232-270): tread plate on top, a hazard lip, and the machinery under the floor.
// Its west end, where the bridge lands, is a sheet-pile abutment with a nosing plate and a rubber fender.
// ============================================================
const DK0 = AX0, DK1 = AX0 + 840;          // painted once; beyond DK1 the bays repeat (see drawDeck)
function paintDeck() {
  const b = buf(DK0, GROUND, DK1 - DK0, H - GROUND);
  for (let x = AX0; x < DK1; x++) {
    const lx = (x - AX0) % 32, pv = (nz((x - AX0) / 32 | 0, 610) - 0.5) * 0.05, oil = fbm(x / 11, 3.3, 77, 2) > 0.62;
    put(b, x, GROUND, lx === 0 ? ST[4] : oil ? ST[7] : ST[8]);
    const m = (x - AX0) % 8;
    for (let j = 1; j <= 4; j++) {
      // chequer plate: little raised dashes, leaning left and right in turn
      const dash = (j === 1 && (m === 2 || m === 4)) || (j === 2 && (m === 1 || m === 5)) || (j === 3 && (m === 0 || m === 6));
      let c = dash ? ST[7] : j === 4 ? ST[4] : flat(ST, 0.55 + pv);
      if (lx === 0) c = ST[1]; else if (lx === 1) c = ST[6];
      if (oil) c = mixI(c, I('#15131c'), 0.45);
      put(b, x, GROUND + j, c);
    }
    put(b, x, GROUND + 5, ST[0]);
    put(b, x, GROUND + 10, I('#090a0f'));
  }
  hazard(b, AX0, GROUND + 6, DK1 - AX0, 4, 8, 1, 0.12);
  for (let x = AX0 + 16; x < DK1; x += 32) { put(b, x - 6, GROUND + 2, ST[9]); put(b, x + 6, GROUND + 2, ST[9]); put(b, x - 6, GROUND + 3, ST[1]); put(b, x + 6, GROUND + 3, ST[1]); }
  // under the floor
  const U0 = GROUND + 11;
  for (let y = U0; y < H; y++) for (let x = AX0; x < DK1; x++) put(b, x, y, (x - AX0) % 16 === 0 ? ST[1] : (x - AX0) % 16 === 1 ? I('#12151d') : ramp(P('#0b0c12', '#0e1017', '#11141c'), 1 - (y - U0) / 26, x, y));
  // one long pipe at the bottom, a thinner hot line above it
  for (let x = AX0; x < DK1; x++) { [ST[1], ST[3], ST[5], ST[4], ST[3], ST[2], ST[0]].forEach((c, i) => put(b, x, H - 9 + i, c)); }
  for (let x = AX0 + 32; x < DK1; x += 64) { rect(b, x, H - 10, 3, 9, ST[4]); rect(b, x, H - 10, 1, 9, ST[6]); }
  for (let bay2 = 0, bx = AX0; bx < DK1; bay2++, bx += 64) {
    const kind = [2, 0, 3, 1, 2, 0, 1, 2, 0, 1, 0, 2, 3][bay2 % 13];
    if (kind === 0) {
      // a grate with the furnace glowing under it
      const gx = bx + 16;
      rect(b, gx - 1, U0, 34, 9, ST[4]); rect(b, gx - 1, U0, 34, 1, ST[6]);
      for (let x = 0; x < 32; x++) for (let y = 0; y < 7; y++) put(b, gx + x, U0 + 1 + y, x % 3 === 2 ? ramp(P('#ffd87a', '#ffa23c', '#e8641e', '#a83a12', '#5a1c0e'), y / 6 + Math.abs(x - 16) / 40, x, y) : ST[1]);
      for (let y = U0 + 9; y < U0 + 17; y++) for (let x = gx - 4; x < gx + 36; x++) if (bay(x, y) < 0.5 * (1 - (y - U0 - 9) / 8) * (1 - Math.abs(x - gx - 16) / 22)) put(b, x, y, I('#7a2c12'));
      LIVE.grates.push([gx + 16, U0 + 6]);
    } else if (kind === 1) {
      // a machine: louvres, a gauge, status lights
      const mx = bx + 14;
      rect(b, mx, U0 + 2, 38, 13, ST[3]); rect(b, mx, U0 + 2, 38, 1, ST[6]); rect(b, mx, U0 + 2, 1, 13, ST[5]); rect(b, mx + 37, U0 + 2, 1, 13, ST[1]); rect(b, mx, U0 + 14, 38, 1, ST[1]);
      for (let y = U0 + 5; y < U0 + 12; y += 2) rect(b, mx + 3, y, 14, 1, ST[1]);
      disc(b, mx + 31, U0 + 8, 3, I('#cfd6e0')); line(b, mx + 31, U0 + 8, mx + 33, U0 + 6, RED[2]); put(b, mx + 31, U0 + 8, ST[1]);
      for (let i = 0; i < 3; i++) { rect(b, mx + 20 + i * 3, U0 + 5, 2, 2, ST[0]); LIVE.leds.push([mx + 20 + i * 3, U0 + 5, 2, 2, bay2 * 3 + i]); }
    } else if (kind === 2) {
      // cables sagging from girder to girder, a junction box
      for (const [c, y0, sag] of [['#5a2028', U0 + 2, 9], ['#1e4a55', U0 + 3, 6], ['#6a5420', U0 + 1, 12]]) for (let x = bx + 6; x < bx + 64; x++) { const t = (x - bx - 6) / 58; put(b, x, y0 + sag * 4 * t * (1 - t), I(c)); }
      rect(b, bx + 30, U0 + 3, 9, 7, ST[4]); rect(b, bx + 30, U0 + 3, 9, 1, ST[6]); rect(b, bx + 30, U0 + 9, 9, 1, ST[1]); put(b, bx + 34, U0 + 6, I('#ffc66a'));
    } else {
      // a drain pipe with a valve
      const px = bx + 34;
      for (let y = U0; y < H - 9; y++) [ST[3], ST[6], ST[5], ST[4], ST[2]].forEach((c, i) => put(b, px + i, y, c));
      rect(b, px - 1, U0 + 3, 7, 2, ST[5]); rect(b, px + 5, U0 + 8, 3, 2, ST[4]); rect(b, px + 8, U0 + 5, 2, 8, RED[2]); rect(b, px + 8, U0 + 5, 1, 8, RED[1]);
      for (let x = bx + 8; x < bx + 30; x++) { put(b, x, U0 + 6, I('#8a5a3a')); put(b, x, U0 + 7, I('#3a2018')); }
    }
  }
  // girders
  for (let x = AX0; x < DK1; x += 64) {
    [ST[6], ST[5], ST[4], ST[4], ST[3], ST[1]].forEach((c, i) => rect(b, x + i, U0, 1, H - U0, c));
    rect(b, x - 3, U0, 12, 3, ST[5]); rect(b, x - 3, U0, 12, 1, ST[7]); rect(b, x - 3, U0 + 2, 12, 1, ST[2]);
    for (let y = U0 + 7; y < H; y += 8) { put(b, x + 2, y, ST[8]); put(b, x + 2, y + 1, ST[1]); }
  }
  // the west end: two sheet piles going down, wet and weedy at the bottom; the deck's first 10 px are a solid nosing
  // plate with fresh hazard paint; a rubber fender; the end face catches the sunset over the river
  for (let y = GROUND + 11; y < H; y++) for (let i = 0; i < 10; i++) {
    let c = [ST[6], ST[5], ST[4], ST[3], ST[1]][i % 5];
    if (y > H - 10) c = mixI(c, I('#16241f'), 0.6); else if (y === H - 10) c = mixI(c, I('#5d6e52'), 0.5);
    put(b, DK0 + i, y, c);
  }
  hazard(b, DK0, GROUND + 6, 10, 4, 8, 1, 0); rect(b, DK0 + 10, GROUND + 6, 1, 5, ST[0]);
  for (const y of [GROUND + 14, GROUND + 24]) { put(b, DK0 + 7, y, ST[8]); put(b, DK0 + 7, y + 1, ST[0]); }
  rect(b, DK0, GROUND + 13, 3, 13, I('#14151b')); rect(b, DK0, GROUND + 13, 3, 1, I('#3c3e4a')); put(b, DK0 + 1, GROUND + 16, HZ.y); put(b, DK0 + 1, GROUND + 22, HZ.y);
  for (let y = GROUND; y < GROUND + 11; y++) put(b, DK0, y, mixI(get(b, DK0, y), I('#e8a070'), 0.45));
  return b;
}

// ============================================================
// Foreground props (drawn in front of the action, low)
// ============================================================
function paintFrontProps() {
  const OI = I('#08080e'), out = [];
  // a hazard bollard with a lamp
  let b = buf(-8, -30, 17, 31);
  for (let y = -22; y <= 0; y++) for (let i = -5; i < 5; i++) {
    const on = (((i + y + 64) >> 2) & 1) === 0;
    put(b, i, y, mixI(on ? (i < -3 ? I('#e8be44') : i > 2 ? I('#8a6614') : I('#c9a227')) : (i < -3 ? I('#3a3444') : I('#1b1722')), I('#10101c'), 0.12));
  }
  rect(b, -6, -25, 12, 3, I('#3a3448')); rect(b, -6, -25, 12, 1, I('#6a6080')); rect(b, -2, -28, 4, 3, I('#5a3a14'));
  outline(b, OI); out.push(mk(b));
  // a striped barrier
  b = buf(-18, -18, 37, 19);
  rect(b, -16, -14, 32, 9, I('#b8b0a8'));
  for (let y = -14; y < -5; y++) for (let x = -16; x < 16; x++) if ((((x + y + 64) >> 2) & 1) === 0) put(b, x, y, y === -14 ? I('#e86050') : I('#b8382c'));
  rect(b, -16, -14, 32, 1, I('#e8e4dc')); rect(b, -16, -6, 32, 1, I('#6a6468'));
  for (const x of [-13, 10]) { rect(b, x, -5, 3, 5, I('#2a2634')); rect(b, x - 2, -1, 7, 1, I('#3a3448')); }
  outline(b, OI); out.push(mk(b));
  // two oil drums
  b = buf(-14, -22, 29, 23);
  for (const [x, c1, c2, c3] of [[-11, '#2c4a6a', '#3f6a94', '#1a2c40'], [1, '#6a2a26', '#94403a', '#3e1614']]) {
    const h = x < 0 ? 18 : 15;
    rect(b, x, -h, 11, h, I(c1)); rect(b, x, -h, 2, h, I(c2)); rect(b, x + 8, -h, 3, h, I(c3));
    rect(b, x, -h, 11, 1, I(c2)); rect(b, x, -h + 5, 11, 1, I(c3)); rect(b, x, -5, 11, 1, I(c3));
    for (let k = 0; k < 4; k++) put(b, x + 3 + k, -h + 8 + (k & 1), I('#e0b030'));
  }
  outline(b, OI); out.push(mk(b));
  return out;
}
// a patrol blimp far off over the factory
function paintBlimp() {
  const b = buf(-13, -6, 27, 14), C = P('#2a1a48', '#3a2458', '#b86070');
  oval(b, 0, 0, 11, 4, C[1]); rect(b, -8, -4, 14, 2, C[0]); rect(b, -7, 4, 13, 1, C[2]); rect(b, -9, 3, 3, 1, C[2]);
  poly(b, [[-13, -5], [-9, -2], [-9, 3], [-13, 5]], C[0]); rect(b, -3, 5, 6, 2, C[0]);
  return b;
}
// four frames of a fan (a quarter turn in all)
function paintFans() {
  const out = [];
  for (let f = 0; f < 4; f++) {
    const b = buf(-11, -11, 23, 23);
    for (let k = 0; k < 4; k++) {
      const a = f * Math.PI / 8 + k * Math.PI / 2;
      for (let r = 2; r <= 10; r += 0.5) for (let w = -0.34; w <= 0.34; w += 0.03) put(b, Math.round(Math.cos(a + w) * r), Math.round(Math.sin(a + w) * r), w > 0.12 ? ST[5] : ST[3]);
    }
    disc(b, 0, 0, 2, ST[6]); put(b, 0, 0, ST[8]);
    out.push(mk(b));
  }
  return out;
}


// ============================================================
// Baking, in steps (level1_art.js runs them all, in order, before anything is drawn)
// ============================================================
const ART = {};
const STEPS = [
  function tables() {
    makeNZ();
    ART.glowR = glowSprite(26, '#ff3a2a'); ART.glowA = glowSprite(30, '#ffb040'); ART.glowW = glowSprite(40, '#ffe2a8');
    ART.glowO = glowSprite(18, '#ff7a22'); ART.glowD = glowSprite(70, '#ff4a2a'); ART.glowC = glowSprite(22, '#2ad0e0');
    // a searchlight beam: origin at (0, 22), pointing right, in a few stepped strengths
    ART.beam = alphaCanvas(150, 44, '#fff0c4', (x, y) => {
      const hw = 1.5 + x * 0.135, dy = Math.abs(y - 21.5);
      return dy > hw ? 0 : Math.round(0.62 * Math.pow(1 - x / 150, 1.1) * (1 - 0.5 * (dy / hw) * (dy / hw)) * 7) / 7;
    });
    ART.front = paintFrontProps(); ART.fans = paintFans(); ART.blimp = mk(paintBlimp());
    ART.sky = newStrip(0.02, -10, 152);
  },
  function skyTop() { paintSky(ART.sky.b, ART.sky.X1, -10, 40); },
  function skyMid() { paintSky(ART.sky.b, ART.sky.X1, 40, 84); },
  function skyLow() { paintSky(ART.sky.b, ART.sky.X1, 84, 152); paintSkyLights(ART.sky.b, ART.sky.X1); bakeStrip(ART.sky); },
  function far() { const S = ART.far = newStrip(0.08, 10, 182); paintFar(S.b, S.X1); bakeStrip(S); },
  function mid() { const S = ART.mid = newStrip(0.22, 20, 218); paintMid(S.b, S.X1); bakeStrip(S); },
  function near() { const S = ART.near = newStrip(0.5, 30, 250); paintNear(S.b, S.X1); bakeStrip(S); },
  wallPlates,
  wallFittings,
  function gatehouse() { wallGatehouse(); ART.wall = mk(WB); WB = null; ART.shutter = mk(paintShutter()); },
  function gateAndPipes() { ART.gate = mk(paintGate()); ART.pipes = mk(paintPipes()); },
  function deck() { ART.deck = mk(paintDeck()); }
];

// ============================================================
// Live drawing: the backdrop (screen space)
// ============================================================
function smoke(g, x, y, s, seed, body, lit) {
  for (let k = 0; k < 6; k++) {
    const u = wrap(G.t * 0.006 + k / 6 + seed, 1), r = 1.5 + u * 6 * s;
    const px = x + u * u * 36 * s + Math.sin(u * 7 + k * 2.1 + seed * 9) * 2, py = y - u * 30 * s;
    g.globalAlpha = ((1 - u) * 0.8 + 0.05) * GA;
    g.fillStyle = body; pdisc(g, px, py, r);
    if (r > 2.6) { g.fillStyle = lit; pdisc(g, px + 1, py + r * 0.45, r * 0.5); }
  }
  g.globalAlpha = GA;
}
function beam(g, x, y, ang, a) {
  g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = a * GA;
  g.drawImage(ART.beam, 0, -22);
  g.restore();
}
let GA = 1;                                          // the alpha bg was called with (1 everywhere else)
function glow(g, img, x, y, a) { g.globalAlpha = a * GA; g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2)); }
function blinker(g, x, y, i, glowImg) {
  const on = (G.t + i * 23) % 64 < 30;
  g.fillStyle = on ? '#ff4a3a' : '#5a1a1c'; g.fillRect(x, y, 2, 2);
  if (on) { g.fillStyle = '#ffd0c8'; g.fillRect(x, y, 1, 1); g.globalCompositeOperation = 'lighter'; glow(g, glowImg, x + 1, y + 1, 0.3); g.globalCompositeOperation = 'source-over'; g.globalAlpha = GA; }
}
// The whole backdrop for camera cx, into g only (the game canvas, or level1_art.js's scratch during a crossfade)
function paintBG(g, cx) {
  const A = ART, t = G.t;
  GA = g.globalAlpha;
  blitStrip(g, A.sky, cx);
  const so = offOf(A.sky, cx);
  LIVE.stars.forEach(([x, y], i) => {
    const ph = (t + i * 41) % 150;
    if (ph < 16) { g.fillStyle = ph < 8 ? '#ffffff' : '#e9e2ff'; g.fillRect(x - so - 1, y, 3, 1); g.fillRect(x - so, y - 1, 1, 3); }
  });
  // far: plumes drift, the stacks' lights blink
  const fo = offOf(A.far, cx);
  for (const [x, y, s] of LIVE.farPl) for (let k = 0; k < 3; k++) {
    const u = wrap(t * 0.003 + k / 3 + x * 0.01, 1);
    g.globalAlpha = 0.55 * (1 - u) * GA; g.fillStyle = '#8a5890'; pdisc(g, x - fo + u * u * 30 * s, y - u * 30 * s, 2 + u * 5 * s);
  }
  g.globalAlpha = GA;
  blitStrip(g, A.far, cx);
  LIVE.farL.forEach(([x, y], i) => { if ((t + i * 31) % 80 < 36) { g.fillStyle = '#ff5a48'; g.fillRect(x - fo, y, 1, 1); } });
  // a patrol blimp drifts along behind the factory
  const bx = wrap(t * 0.04 - cx * 0.1 + 108, W + 80) - 40;
  g.drawImage(A.blimp.img, Math.round(bx) + A.blimp.x0, 60 + A.blimp.y0);
  if (t % 50 < 22) { g.fillStyle = '#ff5a48'; g.fillRect(Math.round(bx) - 1, 67, 2, 1); }
  // mid: smoke behind the factory's own silhouettes, then lights, windows, searchlights
  const mo = offOf(A.mid, cx);
  LIVE.stacks.forEach(([x, y, s], i) => smoke(g, x - mo, y, s * 1.25, i * 0.37, '#3c2a54', '#b0607a'));
  blitStrip(g, A.mid, cx);
  LIVE.midL.forEach(([x, y, i]) => blinker(g, x - mo, y, i + 3, A.glowR));
  LIVE.midW.forEach(([x, y, w, h], i) => { if (hsh(i * 7.3 + (t >> 5)) > 0.7) { g.fillStyle = '#43283e'; g.fillRect(x - mo, y, w, h); } });
  g.globalCompositeOperation = 'lighter';
  for (const B of LIVE.beams) if (B.layer === 'mid') beam(g, B.x - mo, B.y, -Math.PI / 2 + Math.sin(t * 0.011 + B.ph) * 0.75, 0.5);
  g.globalCompositeOperation = 'source-over';
  // near: the yard
  const no = offOf(A.near, cx);
  blitStrip(g, A.near, cx);
  LIVE.nearL.forEach(([x, y, i]) => blinker(g, x - no, y, i, A.glowR));
  g.globalCompositeOperation = 'lighter';
  for (const [x, y] of LIVE.nearF) if (x - no > -50 && x - no < W + 50) glow(g, A.glowW, x - no, y + 4, 0.34 + 0.03 * Math.sin(t * 0.3 + x));
  for (const B of LIVE.beams) if (B.layer === 'near' && B.x - no > -160 && B.x - no < W + 160) beam(g, B.x - no, B.y, -Math.PI / 2 + Math.sin(t * 0.013 + B.ph) * 0.8, 0.55);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = GA;
  GA = 1;
}
// ============================================================
// Live drawing: the gate, the pipes, the wall and the door (world space, on the game's ctx)
// ============================================================
function steamPuffs(x, y, dir, seed) {
  // dir 1: a jet blown down then curling up off a wall nozzle; 0: straight up from a valve
  for (let k = 0; k < 4; k++) {
    const u = wrap(G.t * 0.012 + k / 4 + seed, 1), r = 1 + u * 4;
    const px = x + Math.sin(u * 5 + k + seed * 7) * (1.5 + u * 3) + (dir ? u * 5 : 0), py = dir ? y + u * 10 - u * u * 26 : y - u * 22;
    ctx.globalAlpha = 0.42 * (1 - u) * (1 - u) + 0.03;
    ctx.fillStyle = '#b9c2d8'; pdisc(ctx, px, py, r);
    if (r > 2.4) { ctx.fillStyle = '#dde3f0'; pdisc(ctx, px - 1, py - 1, r * 0.45); }
  }
  ctx.globalAlpha = 1;
}
// a warning lamp: lv 0 = off, 1 = glowing steadily, 2 = flashing bright
function redLamp(x, y, w, h, lv, a) {
  R(x, y, w, h, css(lv > 1 ? RED[1] : lv ? RED[3] : RED[4]));
  if (!lv) return;
  R(x, y, w, 1, css(lv > 1 ? RED[0] : RED[2]));
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, ART.glowR, x + w / 2, y + h / 2, lv > 1 ? a : a * 0.45); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function drawGate() {
  const A = ART, x = GATE_X, t = G.t;
  blit(A.gate, x, GROUND);
  const on = Math.floor(t / 24) % 2;
  redLamp(x - 43, GROUND - 104, 6, 5, on === 0 ? 2 : 0, 0.5); redLamp(x + 37, GROUND - 104, 6, 5, on === 1 ? 2 : 0, 0.5);
  // the sign: lit letters, a faulty flicker now and then
  const flick = hsh(Math.floor(t / 4) * 1.7) > 0.93;
  if (!flick) {
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, A.glowR, x, GROUND - 107, 0.3); glow(ctx, A.glowW, x, GROUND - 118, 0.22); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    text('ROBOT BASE', x - 29, GROUND - 110, '#ff7a5a', 1, 'left', null);
  }
}
function drawPipes() {
  blit(ART.pipes, 0, 0);
  LIVE.steam.forEach(([x, y, dir], i) => { if (x < WALL_X) steamPuffs(x, y, dir, i * 0.29); });
}
function drawWall() {
  const A = ART, t = G.t, door = clamp(G.door || 0, 0, 1);
  // The alarm flashes while the WARNING is up and the door moves. Once the crab is out, everything glows steadily:
  // nothing on the wall blinks behind the fight.
  // (G.warnT, the engine's WARNING timer, and G.door are only read here.)
  const alarm = G.warnT > 0 || (door > 0 && door < 1), out = door > 0 && !alarm;
  blit(A.wall, 0, 0);
  // the hangar's red light spills out over the frame and the wall beside it; the console's screens glow
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, A.glowD, DOOR_X + 70, 196, 0.18 * door); glow(ctx, A.glowC, WALL_X + 44, 150, 0.1);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // the hangar's glow breathes
  ctx.save(); ctx.beginPath(); ctx.rect(DOOR_X, DOOR_Y, DOOR_W, DOOR_H); ctx.clip();
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, A.glowO, DOOR_X + 70, DOOR_Y + 74, (alarm ? 0.4 : 0.26) + 0.1 * Math.sin(t * 0.07)); glow(ctx, A.glowR, DOOR_X + 70, DOOR_Y + 100, 0.22);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // the shutter rolls up
  const open = Math.round(door * (DOOR_H - 13)), sb = GROUND - open;      // sb = the shutter's bottom edge
  ctx.drawImage(A.shutter.img, DOOR_X, DOOR_Y - open);
  if (open > 2) { ctx.globalAlpha = 0.5; R(DOOR_X, sb, DOOR_W, 3, '#000000'); ctx.globalAlpha = 0.25; R(DOOR_X, sb + 3, DOOR_W, 3, '#000000'); ctx.globalAlpha = 1; }
  ctx.restore();
  // piston rods lift it
  for (const px of [GH_X + 3, DOOR_X + DOOR_W + 13]) {
    const top = sb - 8;
    if (top < 174) { R(px + 3, top, 2, 174 - top, css(ST[8])); R(px + 4, top, 1, 174 - top, css(ST[5])); R(px + 1, top - 3, 6, 4, css(ST[6])); R(px + 1, top - 3, 6, 1, css(ST[8])); R(px + 1, top, 6, 1, css(ST[2])); }
  }
  if (door > 0 && door < 1) {
    // sparks in the guide rails while it moves
    for (let k = 0; k < 7; k++) {
      const h1 = hsh(t * 0.71 + k * 13.3), h2 = hsh(t * 1.13 + k * 7.9), side = k & 1;
      R(side ? DOOR_X + DOOR_W - 2 - Math.round(h1 * 9) : DOOR_X + Math.round(h1 * 9), sb - 2 + Math.round(h2 * 14), h2 > 0.6 ? 2 : 1, 1, h1 > 0.5 ? '#ffffff' : '#ffe066');
    }
    // steam rolls out along the floor under the lifting shutter
    const s0 = Math.sin(door * Math.PI);
    for (let k = 0; k < 8; k++) {
      const ph = t * 0.03 + k / 8, n = Math.floor(ph), u = ph - n;
      ctx.globalAlpha = 0.5 * (1 - u) * s0; ctx.fillStyle = k & 1 ? '#c2c9da' : '#9aa2b8';
      pdisc(ctx, DOOR_X + 6 + hsh(n * 8 + k + 0.5) * (DOOR_W - 12), GROUND - 3 - u * 15, 2 + u * 5);
    }
    ctx.globalAlpha = 1;
  }
  // beacons on the gatehouse roof: dark until the alarm, turning fast during it, slowly afterwards
  [GH_X + 6, DOOR_X + DOOR_W + 8].forEach((bx, i) => {
    const a = t * (alarm ? 0.26 : 0.09) + i * Math.PI, c = Math.cos(a), lit = door > 0 && c > -0.3;
    R(bx, GH_TOP - 8, 7, 5, lit ? '#ffb030' : '#5a3410'); R(bx + 1, GH_TOP - 10, 5, 2, lit ? '#ffc850' : '#6a4418'); R(bx + 2, GH_TOP - 11, 3, 1, lit ? '#ffe9a0' : '#7a5420');
    if (lit) R(bx + 3 + Math.round(Math.sin(a) * 2), GH_TOP - 8, 2, 4, '#fff6d0');
    if (door > 0) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, A.glowA, bx + 3, GH_TOP - 6, alarm ? 0.22 + 0.3 * Math.max(0, c) : 0.1 + 0.14 * Math.max(0, c)); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  });
  // the DANGER sign: flashes with the alarm, then stays on, dimmer
  if (alarm ? t % 24 < 15 : out) {
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, A.glowR, DOOR_X + 70, 93, alarm ? 0.42 : 0.1); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    text('DANGER', DOOR_X + 35, 86, alarm ? '#ff5a48' : '#b0302a', 2, 'left', null);
  }
  // the flag
  const fw = Math.floor(t / 12) % 2;
  R(DOOR_X + 71, 51 + fw, 14, 9, '#262636'); R(DOOR_X + 71, 51 + fw, 14, 1, '#3c3c50'); R(DOOR_X + 76, 54 + fw, 5, 3, EVIL); R(DOOR_X + 85, 52 - fw, 4, 8, '#262636'); R(DOOR_X + 85, 52 - fw, 4, 1, '#3c3c50');
  // the radar: a round dish turning on its pedestal
  const rx = WALL_X + 172, rw = Math.round(Math.abs(Math.cos(t * 0.03)) * 9) + 1, face = Math.cos(t * 0.03) > 0;
  for (let j = -6; j <= 6; j++) {
    const hw = Math.max(1, Math.round(rw * Math.sqrt(1 - (j / 6.6) * (j / 6.6))));
    R(rx + 2 - hw, 77 + j, hw * 2, 1, css(face ? (j < -3 ? ST[8] : j > 3 ? ST[5] : ST[7]) : (j < -3 ? ST[5] : ST[3])));
  }
  if (face && rw > 3) { R(rx + 1, 76, 2, 2, css(ST[3])); R(rx + 1, 76, 1, 1, css(ST[9])); } else if (!face && rw > 3) R(rx + 1, 71, 2, 13, css(ST[4]));
  // the hoist's chain and hook swing a little
  if (LIVE.hoist) {
    const [hx, hy] = LIVE.hoist, len = 58, sw = Math.sin(t * 0.021) * 2.6;
    for (let y = 0; y < len; y += 2) R(hx + Math.round(sw * y / len), hy + y, 1, 2, (y >> 1) & 1 ? css(ST[6]) : css(ST[3]));
    const ex = hx + Math.round(sw), ey = hy + len;
    R(ex - 2, ey, 5, 4, css(ST[6])); R(ex - 2, ey, 5, 1, css(ST[8])); R(ex - 2, ey + 3, 5, 1, css(ST[2]));
    R(ex, ey + 4, 1, 3, css(ST[7])); R(ex - 2, ey + 6, 3, 1, css(ST[7])); R(ex - 3, ey + 4, 1, 2, css(ST[7]));
  }
  // fans
  for (const [vx, vy] of LIVE.vents) {
    blit(A.fans[(t >> 1) & 3], vx, vy);
    R(vx - 11, vy, 23, 1, css(ST[6])); R(vx, vy - 11, 1, 23, css(ST[6]));
  }
  // screens (kept dim: missiles and orbs fly in front of them)
  for (const s of LIVE.screens) {
    if (s.k === 'wave') { for (let i = 0; i < s.w; i++) R(s.x + i, s.y + 4 + Math.round(Math.sin((i + t * 0.4) * 0.9) * 2.4 * Math.sin(i * 0.3 + t * 0.02)), 1, 1, '#42b878'); }
    else if (s.k === 'bars') { for (let i = 0; i < 6; i++) { const h = 1 + Math.floor(hsh(i * 3.1 + (t >> 4)) * (s.h - 2)); R(s.x + 1 + i * 2, s.y + s.h - h, 1, h, i === 4 ? '#b88a4a' : '#3496a6'); } }
    else if (alarm || out) {
      // the warning monitor shows the crab: flashing during the alarm, a steady dim picture afterwards
      const on = out || t % 20 >= 6, c = alarm ? '#ff5a48' : '#a8322a';
      R(s.x, s.y, s.w, s.h, alarm && on ? '#5a1210' : '#2a0c0c');
      if (on) { R(s.x + 9, s.y + 3, 10, 2, c); R(s.x + 11, s.y + 6, 6, 5, c); R(s.x + 8, s.y + 8, 12, 1, c); R(s.x + 12, s.y + 4, 1, 1, '#ffe066'); R(s.x + 15, s.y + 4, 1, 1, '#ffe066'); }
      if (on && alarm) { text('!', s.x + 3, s.y + 4, '#ffd23f', 1, 'left', null); text('!', s.x + s.w - 7, s.y + 4, '#ffd23f', 1, 'left', null); }
    } else { R(s.x + 2, s.y + 3, 12, 1, '#3496a6'); R(s.x + 2, s.y + 6, 18, 1, '#256e7c'); R(s.x + 2, s.y + 9, 8, 1, '#256e7c'); if (t % 40 < 20) R(s.x + 22, s.y + 9, 3, 2, '#42b878'); }
    if (t % 97 < 3) { ctx.globalAlpha = 0.2; R(s.x, s.y + (t * 3) % s.h, s.w, 1, '#ffffff'); ctx.globalAlpha = 1; }
  }
  for (const [x, y, w, h, i] of LIVE.leds) if (y < GROUND) R(x, y, w, h, hsh(i * 5.7 + ((t + i * 9) >> 5)) > 0.45 ? ['#3aa86a', '#b88a4a', '#b8443a', '#2f9aaa'][i % 4] : '#1c2a2a');
  // during the alarm little lights run along the conduit toward the door
  if (alarm) LIVE.chase.forEach((x, k) => { if ((k - Math.floor(t / 4)) % 5 === 0) R(x, 180, 2, 1, '#ffc040'); });
  // warning lamps on the ribs: a steady glow; during the alarm every other one flashes, turn about
  for (const [x, y, k] of LIVE.lamps) redLamp(x, y, 4, 5, alarm ? (Math.floor(t / 12) % 2 === k % 2 ? 2 : 0) : 1, 0.42);
  LIVE.steam.forEach(([x, y, dir], i) => { if (x >= WALL_X) steamPuffs(x, y, dir, i * 0.29 + 0.5); });
}

// ============================================================
// The module
// ============================================================
function drawDeck(cx) {
  const A = ART, t = G.t, right = Math.min(AX1, cx + W + 14);
  blit(A.deck, 0, 0);
  // (the level ends at 5100 today; if it ever grows, the deck carries on: its bays come round every 832 px)
  for (let x = DK1; x < right; x += 832) { const w = Math.min(832, AX1 - x); ctx.drawImage(A.deck.img, DK1 - 832 - DK0, 0, w, H - GROUND, x, GROUND, w, H - GROUND); }
  ctx.globalCompositeOperation = 'lighter';
  LIVE.grates.forEach(([x, y], i) => { if (x > cx - 30 && x < cx + W + 30) glow(ctx, A.glowO, x, y, 0.5 + 0.14 * Math.sin(t * 0.09 + i * 2)); });
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  for (const [x, y, w, h, i] of LIVE.leds) if (y >= GROUND && x > cx - 4 && x < cx + W + 4) R(x, y, w, h, hsh(i * 5.7 + ((t + i * 9) >> 5)) > 0.4 ? ['#3aa86a', '#b88a4a', '#b8443a'][i % 3] : '#1c2a2a');
  // the open hangar spills red light across the tread plate
  if (G.door > 0) { ctx.globalAlpha = 0.2 * Math.min(1, G.door) * (0.8 + 0.2 * Math.sin(t * 0.07)); R(DOOR_X, GROUND + 1, DOOR_W, 4, '#ff5a3a'); ctx.globalAlpha = 1; }
}
// Foreground (screen space, parallax 1.3): the original's spots, for the part of the screen that shows the base
function drawFront(cx) {
  const A = ART, off = cx * 1.3, sp = 90, edge = AX0 - cx;
  for (let i = Math.floor((off - 80) / sp); i * sp - off < W + 80; i++) {
    if (hsh(i + 3) < 0.35) continue;
    const x = Math.round(i * sp + hsh(i) * 40 - off);
    if (x < edge + 12) continue;
    const v = hsh(i * 7.7 + 1), k = v < 0.56 ? 0 : v < 0.78 ? 1 : 2;
    blit(A.front[k], x + 5, H);
    if (k === 0) { const on = (G.t + i * 17) % 50 < 25; R(x + 3, H - 28, 4, 3, on ? '#ffc040' : '#5a3a14'); if (on) R(x + 3, H - 28, 4, 1, '#fff0b0'); }
  }
}
// There is no platform in this area today. If one is ever added it is a steel catwalk on legs, its top edge at pl.y.
function drawPlat(pl) {
  const { x, y, w } = pl, gy = groundAt(x + w / 2);
  for (const lx of [x + 3, x + w - 6]) { RO(lx, y + 5, 3, gy - y - 5, css(ST[5])); R(lx, y + 5, 1, gy - y - 5, css(ST[7])); }
  RO(x, y, w, 5, css(ST[6])); R(x, y, w, 1, css(ST[9])); R(x, y + 4, w, 1, css(ST[3]));
  for (let k = x + 3; k + 4 <= x + w - 3; k += 8) R(k, y + 2, 4, 2, css(HZ.y));
}
// The decor this area owns is painted where the level puts it today; if an entry is ever moved, its art follows
const HOME = { gate: GATE_X, pipes: PIPES_X, wall: WALL_X };
function drawBehind(cx) {
  for (const d of L1ART.decor('base')) {
    if (HOME[d.t] == null) continue;
    const dx = d.x - HOME[d.t], c = cx - dx;
    if (dx) { ctx.save(); ctx.translate(dx, 0); }
    if (d.t === 'gate') { if (c < GATE_X + 80 && c + W > GATE_X - 80) drawGate(); }
    else if (d.t === 'pipes') { if (c < PIPES_X + 170 && c + W > PIPES_X - 20) drawPipes(); }
    else if (c + W > WALL_X - 20 && c < WX1 + 20) drawWall();
    if (dx) ctx.restore();
  }
}
L1ART.base = { x0: AX0, x1: AX1, steps: STEPS, bg: paintBG, behind: drawBehind, ground: drawDeck, plat: drawPlat, front: drawFront };
}
