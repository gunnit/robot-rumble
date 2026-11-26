'use strict';
// =====================================================================================================================
// Mission 5 (ALIEN MOTHERSHIP) AREA 3: SPACE WALK, world x 3300-5000: outside, on the mothership's hull, in open space.
// Owner: space. Contract: docs/level5-spec.md section 6 (called by level5_scenery.js; the bubble by level5.js).
//   L5ART.space = { x0, x1, steps, bg(g, cx), behind(cx), ground(cx), plat(pl), front(cx), overlay(cx) }
//   L5ART.helmet(x, y, facing)   the glass bubble over the hero's head while he walks the hull (world space, y = feet)
// The approved look is proposals/level5/space/scene.js: its painters, palette and layout live on here, and the screen
// at camera 3900 is still that picture's scenery. What stands where (world x):
//   bg      space with a faint nebula band and stars (parallax .02), the Moon (.03), far eye saucers, the EARTH (.14: an
//           orthographic globe with a real map, Europe and North Africa, a ping on Vigo; it slides left as you walk and
//           is toned down toward the deck so the play lane reads), the far ship (.16: the hull's long back, a tower with
//           lit windows, the big engine fin with the eye emblem), the nearer ridge (.5: a landing deck on a far block
//           with a parked row of saucers, one of them coming and going; a tank and a gantry; an antenna forest and a
//           radome; low blocks behind the mini-boss's screen, which stays calm).
//   behind  3300 the STAR GARDEN's glass dome seen from outside (its flank, with the airlock's housing under the door
//           frame), 3520 landing pad 1, 3790-3884 an antenna forest, 3920 the lattice tower with the red beacon, 4022 a
//           hatch dome (an oggle peeks out), 4055 a vent, 4105 the big dish aimed at the Earth, 4248 / 4292 two tilted
//           solar panels, 4370 crates, 4403 a small dish, 4436 a fuel tank, 4520 landing pad 2, 4610 a radar that turns,
//           4776-4830 a second aerial cluster, 4850 a deck hatch (another peeker), 4876 a signal mast showing red,
//           4892-5000 the bridge tower with lit windows (the airlock into the bridge under the door frame). Cyan lamp
//           posts all along.
//   ground  the hull: bright top edge, deck plates, hazard plates (pads, pods, hatches, both thresholds), the magenta
//           guide strip with a running light, and the hull's side: ribs, portholes (oggles peek out of some), vents,
//           plaques in alien glyphs, service hatches, ladders, pipes with valves.
//   plat    'solar' (a solar wing on a mast: the bright rail is where feet stand) and 'tower' (a lattice mast with a deck).
//   front   dark pieces along the very bottom (parallax 1.25): a pump box with a gauge, a solar wing's edge, pipes, aerials.
//   overlay the Earth's blue light from the lower left, a few drifting specks of ice.
// Everything static is painted pixel by pixel into buffers by the bake steps (once) and blitted; the live bits (lamps,
// beacons, the radar, puffs, peekers, twinkles) use G.t and a private hash only: never Math.random() / rand().
// bg draws with the context it is handed (g) only. No mock staging: the UFO, robots, meteors, pods, shots and the
// hero are other files' business. Green is the robots' colour: the Earth's land is sand-coloured.
// =====================================================================================================================
var L5ART = L5ART || {};
{
const Math = globalThis.Math;          // (the harness's vm context makes global look-ups slow; the bake does millions)
const AX0 = 3300, AX1 = 5000;          // the area
const GY = 212;                        // the hull deck: where feet stand
const REF = 3900;                      // backdrop strips are painted in design x = screen x with the camera at REF
const MG = 40;
// the ship's colours: the same values as M5.PAL (level5_cast.js), copied so nothing here needs the cast while loading
const S = ['#0e0c1e', '#17152e', '#222244', '#30345f', '#444e82', '#6272ab', '#8fa2d2', '#c3d0ee'];
const GRN = ['#0c2b1c', '#12502a', '#1c7a34', '#2fae44', '#62d64f', '#a8f070', '#e6ffc2'];
const MAG = '#ff4fa3', MAGL = '#ffb3d9', CYAN = '#4fe3ff', CYANL = '#c8f7ff', AMB = '#ffcf3a', AMBL = '#fff2a8';
const EYEW = '#f6fbff', IRIS = '#ff3b30', PUP = '#1a0a12', RED = '#ff3b30', HAZ = '#22222c';

// ----------------------------------------------------------------------------------------------------------- helpers
const D2R = Math.PI / 180;
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hs = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };      // = core.js hsh
const h2 = (x, y, s) => hs(x * 12.9898 + y * 78.233 + s * 37.719);
function vn2(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return lerp(lerp(h2(i, j, s), h2(i + 1, j, s), a), lerp(h2(i, j + 1, s), h2(i + 1, j + 1, s), a), b);
}
function fbm2(x, y, s, oct = 4) { let v = 0, a = 1, n = 0, f = 1; for (let o = 0; o < oct; o++) { v += a * vn2(x * f, y * f, s + o * 13); n += a; a *= 0.5; f *= 2.03; } return v / n; }
const I = s => parseInt(s.slice(1, 7), 16);
const SI = S.map(I), AMBI = I(AMB), AMBLI = I(AMBL), HAZI = I(HAZ), OUTI = I(OUT);
function mixI(a, b, k) {
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  return (Math.round(ar + ((b >> 16 & 255) - ar) * k) << 16) | (Math.round(ag + ((b >> 8 & 255) - ag) * k) << 8) | Math.round(ab + ((b & 255) - ab) * k);
}
// ordered dithering: pick from a ramp (dark -> light) by v in 0..1; dithS = flat areas with a short dithered step
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
function dith(ramp, v, x, y) { const n = ramp.length - 1, f = cl(v, 0, 1) * n, i = Math.floor(f); return ramp[Math.min(n, i + (f - i > bay(x, y) ? 1 : 0))]; }
function dithS(ramp, v, x, y, sharp = 3) { const n = ramp.length - 1, f = cl(v, 0, 1) * n, i = Math.floor(f); return ramp[Math.min(n, i + (cl((f - i - 0.5) * sharp + 0.5, 0, 1) > bay(x, y) ? 1 : 0))]; }

// pixel buffers: 0xRRGGBB ints, NONE = empty; b.a (optional) = alpha per pixel. Baked once into canvases.
const NONE = -1;
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function buf(w, h, ox = 0, oy = 0) { const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox, oy, a: null }; }
function put(b, x, y, c) { if (typeof c === 'string') c = I(c); x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function putA(b, x, y, c, al) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) { b.d[y * b.w + x] = c; b.a[y * b.w + x] = al; } }
function get(b, x, y) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) { if (typeof c === 'string') c = I(c); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
function shape(b, x0, y0, x1, y1, f, c) {
  const fn = typeof c === 'function';
  if (typeof c === 'string') c = I(c);
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (!f(x + 0.5, y + 0.5)) continue;
    const v = fn ? c(x + 0.5, y + 0.5) : c;
    if (v != null && v !== NONE) put(b, x, y, v);
  }
}
function line(b, x0, y0, x1, y1, c) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) put(b, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
}
function inPoly(P, x, y) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function poly(b, P, c) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  shape(b, x0, y0, x1, y1, (x, y) => inPoly(P, x, y), c);
}
function bake(b, flip) {
  const c = canvasOf(b.w, b.h), g = c.getContext('2d'), im = g.createImageData(b.w, b.h), dd = im.data, w = b.w;
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = (flip ? i - (i % w) + (w - 1 - (i % w)) : i) * 4;
    dd[j] = (v >> 16) & 255; dd[j + 1] = (v >> 8) & 255; dd[j + 2] = v & 255; dd[j + 3] = b.a ? b.a[i] : 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// a 1-px outline round the outside of what is painted: holes (a lattice's bays) stay clear
function outlineExt(b, c = OUTI) {
  const w = b.w, h = b.h, d = b.d, out = new Uint8Array(w * h), st = [];
  const push = i => { if (d[i] === NONE && !out[i]) { out[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (st.length) { const i = st.pop(), x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < (h - 1) * w) push(i + w); }
  const add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!out[i]) continue;
    if ((x > 0 && d[i - 1] !== NONE) || (x < w - 1 && d[i + 1] !== NONE) || (y > 0 && d[i - w] !== NONE) || (y < h - 1 && d[i + w] !== NONE)) add.push(i);
  }
  for (const i of add) d[i] = c;
}
// steel parts lit from the left (the sun is off-screen left): t = tone index into the steel ramp
function box(b, x, y, w, h, t) {
  rect(b, x, y, w, h, SI[t]); rect(b, x, y, w, 1, SI[t + 1]); rect(b, x, y, 1, h, SI[t + 1]);
  rect(b, x + w - 1, y + 1, 1, h - 1, SI[t - 1]); rect(b, x, y + h - 1, w, 1, SI[t - 1]);
}
function tube(b, x, y, w, h, t) { for (let i = 0; i < w; i++) { const k = i / Math.max(1, w - 1); rect(b, x + i, y, 1, h, SI[k < 0.15 ? t : k < 0.45 ? t + 1 : k < 0.72 ? t : t - 1]); } }
function htube(b, x, y, w, h, t) { for (let j = 0; j < h; j++) { const k = j / Math.max(1, h - 1); rect(b, x, y + j, w, 1, SI[k < 0.3 ? t + 1 : k < 0.7 ? t : t - 1]); } }

// soft additive light, into any context (one cached 64-px sprite per colour)
const GL = {};
function glowSprite(col) {
  const s = canvasOf(64, 64), g = s.getContext('2d'), v = I(col), rgb = (v >> 16 & 255) + ',' + (v >> 8 & 255) + ',' + (v & 255), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.35, 'rgba(' + rgb + ',0.45)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return s;
}
function glow(g, x, y, r, col, a) {
  const s = GL[col] || (GL[col] = glowSprite(col)), ga = g.globalAlpha;
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = ga * cl(a, 0, 1);
  g.drawImage(s, Math.round(x - r), Math.round(y - r), r * 2, r * 2);
  g.globalAlpha = ga; g.globalCompositeOperation = 'source-over';
}
// a blinking lamp: 3x3 with a white core and a glow when on
function lamp(g, x, y, c, on, r = 5) {
  if (on) glow(g, x, y, r, c, 0.6);
  g.fillStyle = on ? c : '#3a1a2a'; g.fillRect(x - 1, y - 1, 3, 3);
  if (on) { g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); g.fillRect(x - 1, y - 1, 1, 1); }
}
// a backdrop strip in design coordinates: its design x0 is at canvas x 0; drawn with parallax p, cropped to the screen
function stripDraw(g, L, cx) {
  let sx = Math.round((cx - REF) * L.p) - 10 - L.x0, dx = -10, w = W + 20;
  if (sx < 0) { dx -= sx; w += sx; sx = 0; }
  if (sx + w > L.c.width) w = L.c.width - sx;
  if (w > 0) g.drawImage(L.c, sx, 0, w, L.c.height, dx, L.top, w, L.c.height);
}
// a world strip (canvas x 0 = world L.x0), cropped to the screen
function worldDraw(L, cx) {
  let sx = Math.floor(cx) - 12 - L.x0, w = W + 24;
  if (sx < 0) { w += sx; sx = 0; }
  if (sx + w > L.c.width) w = L.c.width - sx;
  if (w > 0) ctx.drawImage(L.c, sx, 0, w, L.c.height, L.x0 + sx, L.top, w, L.c.height);
}
const seen = (a, b, cx) => b > cx - 12 && a < cx + W + 12;
const A = {};                          // everything the bake steps make

// ------------------------------------------------------------------------------------------------------------- space
const SPACE_P = 0.02, MOON_P = 0.03;
const NEB = { x: 176, y: -6, dx: 0.889, dy: 0.457 };            // the axis of the faint nebula band
const SPRAMP = ['#05040d', '#07061a', '#0b0a1c', '#0f0d26', '#141230', '#19153b', '#1f1a46', '#2a1b52', '#381f5c', '#47225f'].map(I);
let SPB = null;
function spaceRows(y0, y1) {
  const b = SPB || (SPB = buf(W + 2 * MG, H + 20, MG, 10));
  for (let y = y0; y < y1; y++) for (let x = -MG; x < W + MG; x++) {
    const dist = -(x - NEB.x) * NEB.dy + (y - NEB.y) * NEB.dx;
    let v = 0.05 + 0.08 * ss(20, 270, y);
    if (dist > -100 && dist < 100) {
      const g = Math.exp(-(dist * dist) / 2048) * ss(-90, 70, (x - NEB.x) * NEB.dx + (y - NEB.y) * NEB.dy);
      if (g > 0.004) {
        const n = fbm2(x * 0.019 + 3, y * 0.027, 3, 4), n2 = fbm2(x * 0.045 + 20, y * 0.05, 12, 3);
        v += g * (0.1 + 0.6 * ss(0.28, 0.7, n) + 0.34 * ss(0.45, 0.8, n2) * ss(0.4, 0.7, n));
        v -= g * 0.3 * ss(0.5, 0.72, fbm2(x * 0.05 + 9, y * 0.018 - 4, 8, 3));          // dark dust lanes
      }
    }
    b.d[(y + 10) * b.w + x + MG] = dithS(SPRAMP, v, x, y, 1.6);
  }
}
function spaceStars() {
  const b = SPB;
  const star = (x, y, k, tint) => {
    x = Math.round(x); y = Math.round(y);
    if (k === 0) put(b, x, y, tint ? '#5a4a8a' : '#454876');
    else if (k === 1) put(b, x, y, tint ? '#b9a6e0' : '#9aa3d8');
    else if (k === 2) put(b, x, y, '#ffffff');
    else if (k === 3) { for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(b, x + i, y + j, tint || '#7f8bd0'); put(b, x, y, '#ffffff'); }
    else {
      for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { put(b, x + i * 2, y + j * 2, mixI(I(tint), 0x141230, 0.55)); put(b, x + i, y + j, tint); }
      put(b, x, y, '#ffffff');
    }
  };
  const TINTS = [CYANL, MAGL, AMBL, '#c8d0ff'];
  for (let i = 0; i < 300; i++) {
    const x = hs(i * 3.17 + 1) * (W + 2 * MG) - MG, y = hs(i * 7.71 + 2) * 236 - 6, q = hs(i * 5.3 + 3);
    star(x, y, q < 0.52 ? 0 : q < 0.82 ? 1 : q < 0.93 ? 2 : q < 0.985 ? 3 : 4, q < 0.82 ? hs(i * 9.1) > 0.7 : TINTS[i % 4]);
  }
  for (let i = 0; i < 190; i++) {                              // the band is thick with faint stars
    const t = hs(i * 2.3 + 40) * 420 - 60, d = (hs(i * 4.9 + 41) - 0.5), q = hs(i * 6.1 + 42);
    star(NEB.x + NEB.dx * t - NEB.dy * d * d * d * 320, NEB.y + NEB.dy * t + NEB.dx * d * d * d * 320, q < 0.7 ? 0 : q < 0.95 ? 1 : 2, q > 0.4);
  }
  A.space = { c: bake(b), x0: -MG, top: -10, p: SPACE_P };
  SPB = null;
}
// the stars that twinkle (live): [x, y, period, tint]
const TWINK = [[52, 46, 70, '#ffffff'], [254, 70, 90, CYANL], [448, 46, 60, '#ffffff'], [296, 172, 80, MAGL], [142, 86, 110, AMBL], [406, 150, 75, '#ffffff'], [226, 148, 95, '#ffffff']];
function moonSprite() {
  const b = buf(20, 20, 10, 10), r = 8.3, RAMP = ['#24224a', '#5d5a86', '#9794b8', '#c9c6e0', '#f2f0fa'].map(I);
  shape(b, -9, -9, 9, 9, (x, y) => x * x + y * y <= r * r, (x, y) => {
    const z = Math.sqrt(Math.max(0, r * r - x * x - y * y)) / r, l = (-x * 0.8 - y * 0.38) / r + z * 0.45;
    const mare = fbm2(x * 0.32 + 5, y * 0.32 + 2, 15, 2) > 0.56 ? 0.16 : 0;
    return dithS(RAMP, 0.6 + l * 0.6 - mare, Math.floor(x), Math.floor(y), 4);
  });
  for (const [x, y] of [[-4, -3], [-5, 2], [-1, 4], [1, -2], [-2, 0]]) if (get(b, x, y) !== NONE) { put(b, x, y, '#9794b8'); put(b, x + 1, y + 1, '#ffffff'); }
  return bake(b);
}

// --------------------------------------------------------------------------------------------------------- the Earth
// An orthographic globe: centre (EARTH.x, EARTH.y) in design coordinates, radius r, the point under the camera at
// LAT0 / LON0 (over the Atlantic off West Africa), north up. The visible dome shows Europe and North Africa; the sun is
// off-screen left, so the east (right) is in the evening. It slides left with parallax EARTH_P as the hero walks.
const EARTH = { x: 10, y: 350, r: 260 }, EARTH_P = 0.14;
const EX0 = -152, EX1 = 274, EY0 = 86, EY1 = 238, EW = EX1 - EX0, EH = EY1 - EY0;
const LAT0 = -8 * D2R, LON0 = -20 * D2R, SL0 = Math.sin(LAT0), CL0 = Math.cos(LAT0);
const SUN = (() => { const v = [-0.72, 0.18, 0.67], n = Math.hypot(v[0], v[1], v[2]); return v.map(a => a / n); })();
function earthXY(lon, lat) { const la = lat * D2R, dl = lon * D2R - LON0; return [EARTH.x + EARTH.r * Math.cos(la) * Math.sin(dl), EARTH.y - EARTH.r * (CL0 * Math.sin(la) - SL0 * Math.cos(la) * Math.cos(dl))]; }
const VIGO = [-8.72, 42.24];
const IBERIA = [[-1.8, 43.4], [-0.7, 42.9], [0.7, 42.7], [1.7, 42.5], [3.2, 42.4], [3.2, 41.9], [2.2, 41.3], [1.0, 41.0], [0.6, 40.6], [-0.2, 39.8], [-0.3, 39.4], [0.2, 38.8], [-0.5, 38.3], [-0.7, 37.6], [-1.6, 37.3], [-2.2, 36.7], [-3.5, 36.7], [-4.4, 36.7], [-5.2, 36.2], [-5.6, 36.0], [-6.3, 36.5], [-6.4, 36.9], [-7.0, 37.2], [-7.9, 37.0], [-9.0, 37.0], [-8.8, 37.9], [-8.8, 38.4], [-9.5, 38.8], [-9.4, 39.4], [-9.0, 39.9], [-8.8, 40.6], [-8.7, 41.2], [-8.9, 41.9], [-8.9, 42.3], [-9.3, 43.0], [-9.1, 43.2], [-8.4, 43.4], [-7.9, 43.8], [-7.0, 43.6], [-5.7, 43.6], [-4.5, 43.4], [-3.8, 43.5], [-2.9, 43.4]];
const EUROPE = [[-1.8, 43.4], [-1.3, 44.6], [-1.1, 45.6], [-1.3, 46.2], [-2.1, 47.1], [-2.8, 47.5], [-4.4, 47.8], [-4.8, 48.4], [-3.5, 48.8], [-1.6, 48.6], [-1.6, 49.6], [-1.2, 49.4], [0.1, 49.5], [1.5, 50.2], [1.9, 51.0], [3.3, 51.4], [4.2, 52.1], [4.8, 53.0], [6.0, 53.4], [7.2, 53.7], [8.6, 53.9], [8.8, 54.9], [8.1, 55.6], [8.2, 56.8], [9.6, 57.3], [10.6, 57.7], [10.4, 56.5], [10.0, 55.2], [9.9, 54.6], [10.9, 54.0], [12.1, 54.2], [13.5, 54.4], [14.3, 53.9], [16.2, 54.3], [18.6, 54.6], [19.8, 54.4], [21.0, 55.3], [21.1, 56.8], [22.0, 57.6], [23.5, 57.0], [24.3, 57.9], [23.5, 59.2], [24.8, 59.5], [27.5, 59.5], [30.2, 59.9], [28.5, 60.6], [26.0, 60.4], [23.0, 59.9], [21.5, 60.6], [21.4, 62.5], [22.5, 63.6], [24.8, 64.9], [25.4, 65.6], [24.1, 65.8],
  [26.0, 70.3], [31.0, 70.2], [33.0, 69.4], [40.0, 67.8], [41.0, 66.6], [38.0, 66.2], [34.5, 66.7], [36.0, 64.4], [40.0, 64.6], [44.0, 66.0], [44.0, 68.4], [53.0, 68.8], [60.0, 69.0], [68.0, 69.5], [68.0, 37.0], [44.0, 37.0],
  [36.2, 36.6], [34.6, 36.8], [33.0, 36.1], [32.0, 36.5], [30.6, 36.8], [29.1, 36.3], [27.3, 37.0], [27.2, 38.4], [26.3, 38.3], [26.9, 39.4], [26.2, 40.0], [27.5, 40.4], [29.0, 41.0], [28.0, 41.0], [26.3, 40.7], [25.0, 40.9], [24.0, 40.7], [23.8, 40.0], [22.9, 40.5], [22.6, 39.5], [23.2, 38.8], [24.0, 38.1], [23.5, 37.9], [23.2, 37.3], [22.9, 36.5], [22.3, 36.5], [21.7, 36.9], [21.3, 37.8], [21.2, 38.3], [21.0, 38.9], [20.2, 39.6], [19.4, 40.6], [19.5, 41.6], [18.5, 42.4], [17.2, 43.0], [15.9, 43.6], [15.0, 44.6], [14.4, 45.3], [13.6, 45.1], [13.6, 45.7], [12.3, 45.4], [12.4, 44.3], [13.6, 43.6], [14.2, 42.5], [15.6, 41.9], [16.2, 41.8], [16.0, 41.4], [17.5, 40.9], [18.5, 40.1], [18.1, 39.9], [17.0, 40.5], [16.6, 39.7], [17.1, 39.0], [16.5, 38.4], [16.1, 37.9], [15.6, 38.0], [15.8, 38.9], [16.1, 39.2], [15.6, 40.1], [14.9, 40.3], [14.2, 40.8], [13.0, 41.2], [12.2, 41.8], [11.1, 42.4], [10.5, 43.0], [10.2, 43.9], [9.0, 44.4], [8.2, 44.0], [7.4, 43.7], [6.6, 43.2], [5.4, 43.3], [4.6, 43.4], [3.9, 43.5], [3.1, 43.0], [3.2, 42.4], [1.7, 42.5], [0.7, 42.7], [-0.7, 42.9]];
const SCAND = [[24.1, 65.8], [22.2, 65.5], [21.3, 64.5], [20.3, 63.7], [18.5, 62.8], [17.3, 61.7], [17.2, 60.7], [18.8, 59.8], [18.1, 59.0], [16.7, 58.1], [16.5, 57.0], [16.0, 56.2], [14.7, 56.1], [14.2, 55.4], [12.9, 55.4], [12.5, 56.3], [11.9, 57.6], [11.2, 58.9], [10.6, 59.5], [9.6, 58.9], [8.1, 58.1], [6.8, 58.0], [5.6, 58.8], [5.0, 60.2], [5.0, 61.6], [6.2, 62.6], [8.5, 63.5], [10.5, 64.4], [12.2, 65.6], [13.0, 66.8], [14.6, 68.0], [16.5, 68.8], [18.5, 69.8], [21.0, 70.2], [23.5, 70.8], [25.8, 71.1], [28.0, 70.9], [26.0, 70.3]];
const BRITAIN = [[-5.7, 50.1], [-4.2, 50.3], [-3.5, 50.3], [-2.0, 50.6], [-0.8, 50.8], [0.9, 50.9], [1.4, 51.2], [0.9, 51.5], [1.6, 52.1], [1.7, 52.7], [0.4, 53.0], [0.1, 53.6], [-0.4, 54.3], [-1.3, 54.7], [-1.6, 55.6], [-2.6, 56.0], [-2.1, 57.0], [-2.0, 57.6], [-3.6, 57.7], [-3.1, 58.6], [-5.0, 58.6], [-5.8, 57.6], [-6.2, 56.7], [-5.4, 56.2], [-5.7, 55.4], [-4.9, 55.0], [-5.0, 54.7], [-3.4, 54.9], [-3.0, 54.0], [-3.0, 53.4], [-4.4, 53.3], [-4.1, 52.8], [-4.7, 52.1], [-5.2, 51.8], [-4.2, 51.6], [-3.1, 51.4], [-3.2, 51.2], [-4.4, 51.1], [-5.1, 50.4]];
const IRELAND = [[-6.3, 52.2], [-7.6, 52.0], [-9.8, 51.5], [-10.2, 52.2], [-9.5, 52.8], [-9.9, 53.5], [-9.9, 54.2], [-8.5, 54.4], [-8.5, 55.1], [-7.4, 55.3], [-6.1, 55.2], [-5.5, 54.5], [-6.1, 53.9], [-6.1, 53.3]];
const ICELAND = [[-22.5, 63.9], [-24.0, 65.5], [-22.2, 66.4], [-20.3, 65.8], [-18.0, 66.3], [-16.0, 66.4], [-14.6, 65.6], [-13.7, 64.9], [-15.5, 64.2], [-18.8, 63.4], [-20.5, 63.6]];
const AFRICA = [[36.2, 36.6], [44.0, 37.0], [68.0, 37.0], [68.0, -20.0], [12.0, -20.0], [9.5, -1.0], [9.3, 1.0], [9.8, 2.5], [10.0, 3.0], [9.5, 4.1], [8.3, 4.5], [6.0, 4.3], [4.5, 6.3], [2.4, 6.3], [0.5, 5.7], [-2.0, 4.8], [-4.0, 5.2], [-7.5, 4.4], [-9.0, 5.0], [-11.5, 6.9], [-13.3, 9.0], [-15.0, 10.9], [-16.7, 12.4], [-17.5, 14.7], [-16.5, 19.5], [-17.0, 21.0], [-16.0, 23.7], [-14.5, 26.2], [-13.0, 27.8], [-11.3, 28.7], [-9.9, 29.9], [-9.7, 30.6], [-9.8, 31.5], [-9.2, 32.6], [-8.0, 33.4], [-6.8, 34.0], [-6.2, 35.2], [-5.9, 35.8], [-5.3, 35.9], [-4.4, 35.2], [-3.0, 35.3], [-2.2, 35.1], [-0.6, 35.8], [1.0, 36.5], [3.0, 36.9], [5.1, 36.8], [7.5, 37.1], [9.8, 37.3], [11.0, 37.0], [10.6, 35.6], [11.1, 35.2], [10.8, 34.5], [10.1, 33.9], [11.1, 33.2], [12.3, 32.9], [13.2, 32.9], [15.2, 32.4], [15.7, 31.3], [18.0, 30.4], [19.9, 30.9], [20.0, 32.1], [21.6, 32.9], [23.2, 32.5], [25.2, 31.6], [27.3, 31.3], [29.0, 30.9], [30.9, 31.5], [32.3, 31.3], [34.2, 31.3], [34.9, 32.3], [35.5, 33.9], [35.8, 35.5]];
const ISLES = [
  [[12.4, 38.0], [13.4, 38.2], [15.6, 38.3], [15.2, 37.0], [14.2, 37.0], [12.5, 37.6]],            // Sicily
  [[8.2, 40.9], [9.6, 41.1], [9.7, 39.2], [8.9, 38.9], [8.4, 39.2]],                                // Sardinia
  [[8.6, 42.5], [9.5, 42.9], [9.4, 41.5], [8.8, 41.6]],                                             // Corsica
  [[2.3, 39.5], [3.2, 39.95], [3.5, 39.6], [3.0, 39.25]],                                           // Mallorca
  [[23.6, 35.6], [26.3, 35.3], [24.5, 34.9]],                                                       // Crete
  [[32.3, 35.0], [34.5, 35.7], [33.9, 34.9], [32.6, 34.6]],                                         // Cyprus
  [[11.1, 55.2], [12.6, 55.7], [12.3, 56.1], [11.0, 55.7]],                                         // Zealand
  [[-16.9, 28.0], [-16.1, 28.6], [-15.3, 28.1], [-16.2, 27.7]], [[-14.3, 28.1], [-13.5, 29.2], [-13.4, 28.3]],   // the Canaries
  [[-17.3, 32.6], [-16.7, 32.9], [-16.6, 32.6]]                                                    // Madeira
];
const SEAS = [
  [[28.0, 41.3], [29.1, 41.2], [31.4, 41.2], [33.3, 42.0], [35.2, 42.0], [36.5, 41.3], [38.5, 40.9], [40.0, 41.0], [41.6, 41.6], [41.5, 42.6], [39.9, 43.4], [38.3, 44.4], [37.3, 45.3], [38.2, 46.0], [39.3, 47.1], [37.5, 47.0], [35.2, 46.2], [35.5, 45.3], [33.6, 44.4], [32.5, 45.3], [33.5, 46.1], [32.0, 46.6], [30.8, 46.6], [29.7, 45.2], [28.7, 44.2], [28.0, 43.2], [27.7, 42.5]],   // the Black Sea
  [[47.5, 45.5], [51.0, 46.8], [53.5, 45.3], [51.2, 43.2], [52.9, 41.0], [54.0, 39.3], [53.8, 37.0], [50.5, 37.3], [49.0, 38.4], [49.5, 40.5], [47.6, 42.9]]     // the Caspian
];
const withBox = P => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return { p: P, x0, y0, x1, y1 }; };
const LANDS = [IBERIA, EUROPE, SCAND, BRITAIN, IRELAND, ICELAND, AFRICA, ...ISLES].map(withBox), LAKES = SEAS.map(withBox);
const inAny = (L, lon, lat) => { for (const p of L) if (lon >= p.x0 && lon <= p.x1 && lat >= p.y0 && lat <= p.y1 && inPoly(p.p, lon, lat)) return true; return false; };
const isLand = (lon, lat) => inAny(LANDS, lon, lat) && !inAny(LAKES, lon, lat);
// mountain ranges: [lon, lat, radius in degrees, snow]
const MTS = [[9.6, 46.5, 3.0, 1], [0.4, 42.6, 1.7, 1], [-5.0, 43.0, 1.6, 0], [-3.2, 37.1, 1.0, 0], [-4.2, 40.4, 1.5, 0], [-5.0, 32.2, 3.4, 0], [3.0, 34.6, 2.4, 0], [24.5, 46.0, 2.6, 0], [18.0, 44.0, 2.0, 0], [13.5, 42.4, 1.6, 0], [9.0, 61.5, 3.6, 1], [16.0, 67.0, 3.2, 1], [35.0, 39.0, 4.5, 0], [43.0, 42.6, 2.8, 1], [-4.6, 57.0, 1.3, 0], [-18.5, 64.8, 1.7, 1], [22.0, 39.6, 1.5, 0]];
const MT = [0, 0];
function mountain(lon, lat) {
  let m = 0, sn = 0; const c = Math.cos(lat * D2R);
  for (const [x, y, r, s] of MTS) { const d = Math.hypot((lon - x) * c, lat - y) / r; if (d < 1 && 1 - d > m) { m = 1 - d; sn = s; } }
  MT[0] = m; MT[1] = sn;
}
const CYCLONE = [-15, 56.5];
function cloudAt(lon, lat) {
  const wx = lon * 0.15 + 2.2 * fbm2(lon * 0.05 + 7, lat * 0.07 + 3, 5, 3), wy = lat * 0.36 + 2.2 * fbm2(lon * 0.05 + 1, lat * 0.08 + 9, 6, 3);
  let c = fbm2(wx, wy, 11, 4);
  c -= 0.22 * ss(47, 40, lat) * ss(-14, -9, lon);                                   // clear skies over Iberia and the south
  c -= 0.1 * ss(36, 30, lat);                                                       // and over the desert
  c += 0.04 * ss(47, 58, lat);
  c -= 0.1 * ss(1, 6, lon) * ss(52, 47, lat) * ss(40, 44, lat);                     // the Alps stay in view
  const dx = (lon - CYCLONE[0]) * Math.cos(lat * D2R), dy = lat - CYCLONE[1], r = Math.hypot(dx, dy);
  if (r < 7) {                                                                       // a spiral low north-west of Scotland
    const arm = 0.5 + 0.5 * Math.cos(Math.atan2(dy, dx) * 2 - 4.4 * Math.log(r + 0.5) + 0.6);
    c = lerp(c, 0.36 + 0.4 * arm, ss(7, 3.5, r) * 0.95);
    if (r < 0.8) c = 0.3;
  }
  return c;
}
// Painted in two passes, each in runs of rows (bake steps): first where land, cloud and daylight are, then the colours.
let EK = null, ECL, ELAM, ENZ, ELO, ELA, EB = null;
function earthGeo(ya, yb) {
  if (!EK) { const n = EW * EH; EK = new Uint8Array(n); ECL = new Float32Array(n); ELAM = new Float32Array(n); ENZ = new Float32Array(n); ELO = new Float32Array(n); ELA = new Float32Array(n); }
  const E = EARTH;
  for (let y = ya; y < yb; y++) for (let x = EX0; x < EX1; x++) {
    const dx = (x + 0.5 - E.x) / E.r, dy = (E.y - y - 0.5) / E.r, d2 = dx * dx + dy * dy, i = (y - EY0) * EW + (x - EX0);
    if (d2 >= 1) continue;
    const nz = Math.sqrt(1 - d2), lon = (LON0 + Math.atan2(dx, nz * CL0 - dy * SL0)) / D2R, lat = Math.asin(cl(nz * SL0 + dy * CL0, -1, 1)) / D2R;
    const jl = lon + (fbm2(lon * 1.9, lat * 1.9, 31, 2) - 0.5) * 0.3, jt = lat + (fbm2(lon * 1.9 + 40, lat * 1.9, 32, 2) - 0.5) * 0.24;
    EK[i] = isLand(jl, jt) ? 2 : 1; ECL[i] = cloudAt(lon, lat); ELAM[i] = dx * SUN[0] + dy * SUN[1] + nz * SUN[2]; ENZ[i] = nz; ELO[i] = lon; ELA[i] = lat;
  }
}
const OCEAN = ['#0a1a56', '#0d2c84', '#1243ac', '#1a5ccb', '#2979e0', '#459aef', '#6bb6f6'].map(I);
const SAND = ['#8f6238', '#b98347', '#d9a55f', '#eec686', '#f7dca6'].map(I);
const TAN = ['#57433a', '#7a5f44', '#9c7d4f', '#b89760', '#cdb077'].map(I);
const TUND = ['#6f7088', '#9ea2ba', '#cdd3e4', '#f0f4fb'].map(I);
const CLOUD = ['#a9c2e6', '#dbe8f8', '#ffffff'].map(I), WARM = ['#a85a78', '#f09a7a', '#ffd2ae'].map(I);
const AIR = ['#3b86e0', '#62aaf0', '#98d0fa'].map(I);
// The play lane runs in front of the Earth's lower half: the globe is toned toward deep blue, more so near the deck,
// so robots and shots read (the proposal's bright sand and clouds behind the lane were too bright)
const TONE = 0x0e1540;
const toneK = y => 0.26 + 0.28 * ss(108, 214, y);
function earthPaint(ya, yb) {
  const b = EB || (EB = buf(EW, EH, -EX0, -EY0));
  const E = EARTH, CT = 0.6, w = EW;
  const at = (arr, x, y) => (x < EX0 || x >= EX1 || y < EY0 || y >= EY1) ? 0 : arr[(y - EY0) * w + (x - EX0)];
  const HV = [SUN[0], SUN[1], SUN[2] + 1], hn = Math.hypot(HV[0], HV[1], HV[2]);
  for (let y = ya; y < yb; y++) {
    const tk = toneK(y);
    for (let x = EX0; x < EX1; x++) {
      const i = (y - EY0) * w + (x - EX0), k = EK[i];
      if (!k) continue;
      const L = ELAM[i], nz = ENZ[i], lon = ELO[i], lat = ELA[i], c = ECL[i];
      const day = cl((L + 0.025) / 0.07, 0, 1), lit = cl(L, 0, 1), shadow = at(ECL, x - 2, y - 2) > CT ? 0.16 : 0;
      let dayC, nightC;
      if (c > CT) {                                                                    // clouds, lit from the upper left
        const up = at(ECL, x - 1, y - 1) > CT, dn = at(ECL, x + 1, y + 1) > CT;
        const ci = !up ? 2 : !dn ? 0 : c > CT + 0.06 ? 2 : 1;
        dayC = L < 0.07 ? WARM[ci] : CLOUD[ci]; nightC = 0x121a3c;
      } else if (k === 2) {                                                            // land: tan, sand, rock, snow
        let d = ss(38.6, 33.6, lat);
        if (lon > 28) d = Math.max(d, 0.6 * ss(28, 36, lon) * ss(43, 39, lat));
        const tex = fbm2(lon * 0.8, lat * 0.8, 21, 3);
        let v = 0.2 + 0.6 * tex;
        const sl = at(EK, x - 1, y) === 1 || at(EK, x, y - 1) === 1, sr = at(EK, x + 1, y) === 1 || at(EK, x, y + 1) === 1;
        if (sl) v += 0.22; else if (sr) v -= 0.2;
        v = v * (0.3 + 0.7 * cl(L * 2.4, 0, 1)) - shadow;
        dayC = dithS(bay(x + 2, y + 1) < d ? SAND : TAN, v, x, y, 2.4);
        if (lat > 60 && bay(x + 1, y + 3) < ss(60, 67, lat)) dayC = dithS(TUND, v + 0.15, x, y, 2.4);
        mountain(lon, lat);
        if (MT[0] > 0.2) {
          const ridge = fbm2(lon * 2.4, lat * 2.4, 71, 3), q = MT[0] * 0.7 + ridge * 0.6;
          if (q > 0.7) dayC = MT[1] && q > 0.84 ? 0xf4f7ff : ridge > 0.54 ? 0x6a4f3c : 0x7d5f44;
        }
        nightC = 0x0b0c20;
        if (L < 0.0 && lat > 35 && lat < 61 && fbm2(lon * 0.7, lat * 0.9, 51, 2) > 0.52 && h2(x, y, 52) > 0.74) nightC = h2(x, y, 53) > 0.8 ? 0xfff2a8 : 0xffb84a;
      } else {                                                                         // ocean
        const spec = Math.pow(Math.max(0, ((x + 0.5 - E.x) / E.r * HV[0] + (E.y - y - 0.5) / E.r * HV[1] + nz * HV[2]) / hn), 50);
        let v = 0.16 + 0.48 * lit + (fbm2(lon * 0.2, lat * 0.3, 61, 3) - 0.5) * 0.3 + spec * 0.5 - shadow;
        if (at(EK, x - 1, y) === 2 || at(EK, x + 1, y) === 2 || at(EK, x, y - 1) === 2 || at(EK, x, y + 1) === 2) v += 0.2;
        dayC = dithS(OCEAN, v, x, y, 3.2);
        nightC = 0x050a22;
      }
      const fres = 1 - nz;                                                             // the air thickens toward the limb
      if (fres > 0.74) {
        const hk = (fres - 0.74) / 0.26;
        if (bay(x + 1, y) < hk * 1.1 - 0.1) { dayC = L < 0.12 && hk > 0.4 ? (hk > 0.75 ? 0xffb48a : 0xd0708a) : AIR[hk > 0.7 ? 2 : hk > 0.36 ? 1 : 0]; if (nightC === 0x050a22 || hk > 0.5) nightC = hk > 0.7 ? 0x142a66 : 0x0b1640; }
      }
      if (day < 1 && day > 0) dayC = mixI(dayC, 0x2a1c4c, (1 - day) * 0.45);
      const lights = nightC === 0xfff2a8 || nightC === 0xffb84a;
      const col = day >= 1 ? dayC : day <= 0 ? nightC : bay(x, y) < day ? dayC : nightC;
      b.d[i] = col === nightC ? (lights ? mixI(col, TONE, 0.3 + tk * 0.5) : col) : mixI(col, TONE, tk);
    }
  }
}
function earthFinish() {
  const b = EB, E = EARTH;
  // the atmosphere's rim: one bright line just outside the limb on the lit side, a blue fringe beyond it
  for (let y = EY0; y < EY1; y++) for (let x = EX0; x < EX1; x++) {
    const dx = x + 0.5 - E.x, dy = E.y - y - 0.5, d = Math.hypot(dx, dy);
    if (d < E.r || d > E.r + 2.6) continue;
    const day = cl(((dx * SUN[0] + dy * SUN[1]) / d + 0.06) / 0.2, 0, 1);
    if (d < E.r + 1.3) put(b, x, y, day > 0.7 ? 0xd6f1ff : day > 0.25 ? 0xffb89a : 0x1a3478);
    else if (day > 0.7 ? bay(x, y) < 0.62 : day > 0.25 ? bay(x, y) < 0.4 : false) put(b, x, y, day > 0.7 ? 0x4f96e8 : 0x8a4a72);
  }
  // one picture: the globe, and round its lit limb the soft glow of the air (see-through blue, strongest at the edge)
  const w = HX1 - HX0, h = HY1 - HY0, c = canvasOf(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data;
  for (let y = HY0; y < HY1; y++) for (let x = HX0; x < HX1; x++) {
    const i = ((y - HY0) * w + (x - HX0)) * 4, v = x >= EX0 && x < EX1 && y >= EY0 && y < EY1 ? b.d[(y - EY0) * EW + (x - EX0)] : NONE;
    if (v !== NONE) { d[i] = v >> 16 & 255; d[i + 1] = v >> 8 & 255; d[i + 2] = v & 255; d[i + 3] = 255; continue; }
    const dx = x + 0.5 - E.x, dy = E.y - y - 0.5, r = Math.hypot(dx, dy) - E.r;
    if (r < 0 || r > 22) continue;
    const day = cl(((dx * SUN[0] + dy * SUN[1]) / (r + E.r) + 0.06) / 0.4, 0, 1);
    d[i] = 90; d[i + 1] = 170; d[i + 2] = 255; d[i + 3] = Math.round(255 * 0.5 * Math.exp(-r / 6) * day);
  }
  g.putImageData(im, 0, 0);
  A.earth = c;
  EB = null; EK = ECL = ELAM = ENZ = ELO = ELA = null;
  // the ping on Vigo: seven rings, small to wide
  A.ping = [3, 4, 5, 6, 7, 8, 9].map(pr => { const q = buf(21, 15, 10, 7); for (let a = 0; a < 44; a++) { const t = a / 44 * Math.PI * 2; put(q, Math.round(Math.cos(t) * pr), Math.round(Math.sin(t) * pr * 0.72), 0xffffff); } return bake(q); });
}
const HX0 = -152, HX1 = 300, HY0 = 60, HY1 = 238;

// ----------------------------------------------------------------------------------- the far parts of the mothership
// FA (parallax .16): the hull's long back rising to the right, a tower with lit windows, a small dome, the engine fin
const FA_P = 0.16, FA0 = -172, FA1 = 656, FATOP = 54;
const FIN_LE = [[402, 178], [413, 150], [425, 120], [436, 94], [444, 77], [449, 68], [453, 64.5]];      // its leading edge
const FIN = [...FIN_LE, [458, 64], [462, 67], [464, 76], [466, 110], [469, 178]];
function finEdge(y) { for (let i = 0; i + 1 < FIN_LE.length; i++) { const a = FIN_LE[i], b = FIN_LE[i + 1]; if (y <= a[1] && y >= b[1]) return a[0] + (b[0] - a[0]) * (a[1] - y) / (a[1] - b[1]); } return 453; }
const farTop = x => 213 - 50 * ss(196, 540, x) - 7 * ss(560, 656, x);
function paintFarA() {
  const b = buf(FA1 - FA0, GY + 6 - FATOP, -FA0, -FATOP);
  const body = 0x191735, lite = 0x232246, dark = 0x100e24, rim = 0x343664, win = [0x2f7a98, 0x8a681e, 0x782a5c];
  const sil = (x, y, w, h) => { rect(b, x, y, w, h, body); rect(b, x, y, 1, h, rim); rect(b, x + 1, y, w - 1, 1, lite); rect(b, x + w - 1, y + 1, 1, h - 1, dark); };
  // the engine fin: a swept blade, its leading edge catching the sun
  const fin = 0x1b1a3a, finL = 0x252650, finR = 0x3c4278, finRR = 0x5560a0;
  poly(b, FIN, (x, y) => {
    const e = x - finEdge(y);                                  // distance behind the leading edge
    if (e < 1.5 || y < 65.5) return finRR;
    if (e < 3) return finR;
    if (y > 82 && y < 95) return y < 84 || y > 93 ? dark : ((Math.floor(x + y * 0.5) >> 2) & 1) ? 0x6a5222 : 0x17152e;   // dim hazard band
    if (x > 466.5 - (178 - y) * 0.03) return dark;
    const em = Math.hypot(x - 449.5, y - 119.5);               // the robots' eye emblem
    if ((em > 6 && em < 8.2) || em < 2.6) return finR;
    if (Math.floor(e) % 12 === 11) return dark;
    return e > 30 ? fin : finL;
  });
  for (let y = 138; y < 172; y += 11) rect(b, 446 + Math.round((178 - y) * 0.06), y, 4, 1, win[0]);
  // the engine under it: a long nacelle with ring bands
  for (let x = 372; x < 540; x++) for (let y = 170; y < 196; y++) {
    const k = (y - 170) / 25, e = x < 384 ? Math.abs(k - 0.5) > 0.5 * Math.sqrt(Math.max(0, 1 - ((384 - x) / 12) ** 2)) : false;
    if (e) continue;
    put(b, x, y, (x - 372) % 17 === 16 ? dark : k < 0.12 ? rim : k < 0.42 ? lite : k < 0.75 ? body : dark);
  }
  // towers and a dome on the far hull
  sil(322, 150, 20, 40); sil(327, 138, 10, 12); rect(b, 331, 124, 1, 14, rim); rect(b, 329, 130, 5, 1, lite);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) if (h2(i, j, 81) > 0.35) rect(b, 326 + i * 5, 154 + j * 7, 2, 1, win[(i + j) % 3]);
  shape(b, 262, 172, 300, 196, (x, y) => ((x - 281) / 17) ** 2 + ((y - 190) / 13) ** 2 <= 1, (x, y) => { const d = ((x - 281) / 17) ** 2 + ((y - 190) / 13) ** 2; return d > 0.82 ? (x < 276 ? 0x4a5490 : rim) : (Math.floor(x) - 281) % 7 === 0 ? 0x2a2452 : bay(x, y) < 0.3 + (y - 178) / 30 ? 0x5a2a6a : 0x33204f; });
  rect(b, 236, 190, 1, 14, rim); rect(b, 234, 194, 5, 1, lite); rect(b, 247, 184, 1, 18, rim); rect(b, 245, 189, 5, 1, lite);
  sil(504, 150, 14, 30);
  // further aft (seen from the far end of the walk): a second tower, a hangar block, a mast
  sil(556, 122, 18, 44); sil(560, 112, 9, 10); rect(b, 564, 100, 1, 12, rim); rect(b, 562, 105, 5, 1, lite);
  for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (h2(i, j, 84) > 0.4) rect(b, 559 + i * 5, 126 + j * 7, 2, 1, win[(i + j + 1) % 3]);
  sil(606, 142, 36, 22); for (let i = 0; i < 6; i++) if (h2(i, 0, 85) > 0.3) rect(b, 610 + i * 5, 147, 2, 1, win[i % 3]);
  rect(b, 630, 128, 1, 14, rim); rect(b, 628, 132, 5, 1, lite);
  // the far hull itself: a long back rising to the right, bands of plating, a few lit windows
  for (let x = FA0; x < FA1; x++) {
    const t = farTop(x);
    for (let y = Math.ceil(t); y < GY + 6; y++) {
      const d = y - t;
      put(b, x, y, d < 1 ? rim : d < 2 && bay(x, y) < 0.5 ? rim : (d > 7 && d < 8.2) || (d > 17 && d < 18.2) ? dark : d < 7 ? lite : body);
    }
    if (x > 214 && x % 7 === 3 && h2(x, 1, 82) > 0.45) put(b, x, Math.round(t + 4), win[x % 3]);
    if (x > 250 && x % 9 === 4 && h2(x, 2, 82) > 0.5) put(b, x, Math.round(t + 12), win[(x >> 1) % 3]);
  }
  return { c: bake(b), x0: FA0, top: FATOP, p: FA_P };
}
// FB (parallax .5): the nearer ridge and what stands on it. Left to right (design x): a landing shelf with a parked row
// of saucers (-176..-4), a tank and a gantry (362-458, the proposal's), an antenna forest and a radome (552-672), low
// blocks and a pipe bridge (the real bridge tower stands on the deck at 4892-5000: behind())
const FB_P = 0.5, FB0 = -510, FB1 = 1000, FBTOP = 120;
const nearTop = x => 214 - 24 * ss(296, 540, x) + 9 * ss(640, 720, x) - 8 * ss(840, 960, x);
const PARK = [-158, -124, -90, -22], SHELF = 158, PARKLIVE = -56;   // parked saucers (design x); one more comes and goes                       // the parked saucers (design x of their middles)
const FOREST = [[556, 22, 0], [563, 14, 0], [571, 30, 2], [580, 18, 1], [590, 36, 2], [598, 12, 0], [607, 26, 1], [618, 20, 0], [629, 32, 2]];
function paintFarB() {
  const b = buf(FB1 - FB0, GY + 6 - FBTOP, -FB0, -FBTOP);
  const body = 0x201f42, lite = 0x292a52, dark = 0x17152e, rim = SI[4], win = [0x3a9cc0, 0xb08a22, 0xa03a78];
  const sil = (x, y, w, h) => { rect(b, x, y, w, h, body); rect(b, x, y, 1, h, rim); rect(b, x + 1, y, w - 1, 1, lite); rect(b, x + w - 1, y + 1, 1, h - 1, dark); };
  // the landing shelf: a deck jutting out of a far block, well above the hull, five saucers parked on it in a row
  sil(-214, 136, 38, 82); for (let j = 0; j < 7; j++) for (let i = 0; i < 4; i++) if (h2(i, j, 88) > 0.45) rect(b, -208 + i * 8, 142 + j * 9, 3, 2, win[(i + j) % 3]);
  rect(b, -196, 124, 1, 12, rim); rect(b, -198, 128, 5, 1, lite);
  for (const x of [-150, -100, -50]) { rect(b, x, SHELF + 3, 2, 215 - SHELF, lite); rect(b, x + 2, SHELF + 3, 1, 215 - SHELF, dark); line(b, x + 3, SHELF + 4, x + 24, SHELF + 22, dark); line(b, x - 1, SHELF + 4, x - 22, SHELF + 22, lite); }
  rect(b, -178, SHELF, 176, 3, body); rect(b, -178, SHELF, 176, 1, rim); rect(b, -178, SHELF + 2, 176, 1, dark);
  for (let x = -176; x < -4; x += 6) put(b, x, SHELF + 1, (x & 8) ? 0x6a5222 : dark);
  for (const x of PARK) {                                       // tiny with distance: legs, a green disc, a glass dome
    const y = SHELF - 5;
    put(b, x - 4, y + 4, lite); put(b, x + 4, y + 4, lite); put(b, x - 3, y + 3, lite); put(b, x + 3, y + 3, lite);
    rect(b, x - 6, y + 1, 13, 1, 0x1c5a34); rect(b, x - 5, y, 11, 1, 0x2a7a40); rect(b, x - 5, y + 2, 11, 1, 0x134028); put(b, x - 6, y + 1, 0x2a7a40);
    rect(b, x - 2, y - 3, 5, 3, 0x2f6a88); rect(b, x - 1, y - 4, 3, 1, 0x2f6a88); put(b, x - 2, y - 3, 0x5aa6c4); put(b, x - 1, y - 4, 0x5aa6c4);
    put(b, x, y + 3, 0xb9d0e4);
  }
  sil(-12, SHELF - 16, 11, 16); rect(b, -9, SHELF - 12, 6, 2, win[0]); rect(b, -7, SHELF - 26, 1, 10, rim); rect(b, -9, SHELF - 22, 5, 1, lite);
  // a gantry and a tank standing on the ridge (the proposal's)
  rect(b, 428, 170, 2, 30, lite); rect(b, 452, 170, 2, 28, lite); rect(b, 424, 168, 34, 3, body); rect(b, 424, 168, 34, 1, rim); rect(b, 440, 171, 1, 8, lite); rect(b, 438, 179, 5, 3, body);
  line(b, 429, 172, 452, 196, lite); line(b, 453, 172, 430, 198, dark);
  shape(b, 362, 186, 384, 206, (x, y) => ((x - 373) / 10) ** 2 + ((y - 198) / 10) ** 2 <= 1, (x, y) => x < 366 ? rim : y < 192 ? lite : body);
  rect(b, 372, 181, 1, 8, lite);
  // the antenna forest: whips, cross trees and little dishes; a radome on a stub
  for (const [x, h, kind] of FOREST) {
    rect(b, x, 190 - h, 1, h + 2, lite); put(b, x, 190 - h, rim);
    if (kind === 1) for (let k = 0; k < 3; k++) rect(b, x - 3 + k, 190 - h + 4 + k * 4, 7 - k * 2, 1, k & 1 ? dark : lite);
    if (kind === 2) { rect(b, x - 2, 190 - h + 5, 5, 1, lite); rect(b, x - 1, 190 - h + 10, 3, 1, dark); }
  }
  rect(b, 550, 186, 86, 5, body); rect(b, 550, 186, 86, 1, rim);
  rect(b, 661, 180, 7, 12, body); rect(b, 661, 180, 1, 12, rim);
  shape(b, 654, 162, 676, 184, (x, y) => (x - 664.5) ** 2 + (y - 173) ** 2 <= 90, (x, y) => { const l = (-(x - 664.5) * 0.8 - (y - 173) * 0.5) / 9.5; return l > 0.75 ? SI[5] : l > 0.3 ? rim : l > -0.3 ? 0x343664 : (Math.floor(x + y) % 5 === 0 ? dark : lite); });
  // low blocks and a pipe bridge (the part behind the mini-boss fight: kept low and calm)
  sil(716, 190, 22, 12); rect(b, 720, 194, 2, 1, win[1]); sil(752, 184, 12, 18); rect(b, 755, 188, 2, 1, win[0]);
  rect(b, 786, 186, 2, 16, lite); rect(b, 814, 186, 2, 16, lite); rect(b, 782, 184, 38, 3, body); rect(b, 782, 184, 38, 1, rim);
  sil(846, 182, 16, 14); rect(b, 850, 186, 2, 1, win[2]); rect(b, 855, 186, 2, 1, win[1]);
  // the ridge itself
  for (let x = FB0; x < FB1; x++) {
    const t = nearTop(x);
    for (let y = Math.ceil(t); y < GY + 6; y++) { const d = y - t; put(b, x, y, d < 1 ? (bay(x, y) < 0.7 ? rim : lite) : d < 4 ? lite : (x + 400) % 26 === 0 ? dark : body); }
    if (x > 306 && x % 6 === 2 && h2(x, 3, 83) > 0.4) rect(b, x, Math.round(t + 6), 2, 1, win[(x >> 2) % 3]);
  }
  return { c: bake(b), x0: FB0, top: FBTOP, p: FB_P };
}

// -------------------------------------------------------------------------- the deck's back row (behind the play lane)
function lattice(b, x, base, top) {
  const hw = y => 3 + 7 * (y - top) / (base - top);
  for (let y = top, k = 0; y < base - 3; k++) {
    const y2 = Math.min(base, y + 10 + k * 2);
    line(b, x - hw(y), y, x + hw(y2), y2, SI[3]); line(b, x + hw(y), y, x - hw(y2), y2, SI[4]);
    rect(b, Math.round(x - hw(y)), y, Math.round(hw(y) * 2) + 1, 1, SI[4]);
    y = y2;
  }
  for (let y = top; y < base; y++) { const w = hw(y); put(b, x - w, y, SI[6]); put(b, x - w + 1, y, SI[4]); put(b, x + w, y, SI[3]); put(b, x + w - 1, y, SI[2]); }
  box(b, x - 9, top + 30, 19, 3, 4); rect(b, x - 9, top + 27, 1, 3, SI[4]); rect(b, x + 9, top + 27, 1, 3, SI[3]); rect(b, x - 9, top + 27, 19, 1, SI[3]);
  box(b, x - 4, top - 3, 9, 4, 4); rect(b, x, top - 17, 1, 14, SI[5]); rect(b, x - 2, top - 9, 5, 1, SI[4]); rect(b, x - 1, top - 13, 3, 1, SI[4]);
  box(b, x - 6, base - 5, 13, 5, 3);
}
// a dish antenna looking along (px, py): the rim ellipse (a across, c deep on screen), the shell behind it, the feed
const DISHR = [SI[2], SI[3], SI[4], SI[5], SI[6]];
function dish(b, cx, cy, a, c, px, py, depth) {
  const mx = -py, my = px;
  for (let y = Math.floor(cy - a - depth); y <= cy + a + depth; y++) for (let x = Math.floor(cx - a - depth); x <= cx + a + depth; x++) {
    const rx = x + 0.5 - cx, ry = y + 0.5 - cy, u = rx * mx + ry * my, v = rx * px + ry * py;
    const face = (u / a) ** 2 + (v / c) ** 2;
    if (face <= 1) {                                           // the concave face: its far side catches the light
      const lit = rx / a * 0.8 - ry / a * 0.3 + 0.1;
      let col = dith(DISHR, 0.5 + lit * 0.6, x, y);
      if (face > 0.8) col = ry < 0 || rx < 0 ? SI[7] : SI[5];
      else if (Math.abs(face - 0.34) < 0.05) col = SI[3];
      put(b, x, y, col);
    } else if (v < 0 && (u / a) ** 2 + (v / depth) ** 2 <= 1) { // the shell behind the rim
      const k = rx / a;
      put(b, x, y, Math.abs(Math.abs(u) - a * 0.5) < 0.6 ? SI[2] : k < -0.55 ? SI[5] : k < 0.1 ? SI[4] : k < 0.6 ? SI[3] : SI[2]);
    }
  }
  const fx = cx + px * (c + a * 0.62), fy = cy + py * (c + a * 0.62);      // the feed horn on three struts
  line(b, cx + mx * a * 0.8, cy + my * a * 0.8, fx, fy, SI[5]); line(b, cx - mx * a * 0.8, cy - my * a * 0.8, fx, fy, SI[4]); line(b, cx, cy, fx, fy, SI[3]);
  rect(b, Math.round(fx) - 1, Math.round(fy) - 1, 3, 3, SI[6]);
  return [Math.round(fx), Math.round(fy)];
}
const CELL = ['#131d56', '#1a2b78', '#243e9c', '#3558c4'].map(I);
function solar(b, x, y, w, h, sk) {                            // lower left corner at (x, y); the top leans sk to the right
  for (let j = 0; j < h; j++) {
    const off = Math.round(sk * (1 - j / (h - 1)));
    for (let i = 0; i < w; i++) {
      const X = x + i + off, Y = y - h + 1 + j, fr = i === 0 || j === 0 || i === w - 1 || j === h - 1, grid = i % 9 === 0 || j % 7 === 0;
      const gl = Math.abs((i + j * 1.6) - (w * 0.62)) < 3.2;   // the sun's glint: a diagonal band
      put(b, X, Y, fr ? (i === 0 || j === 0 ? SI[6] : SI[4]) : grid ? SI[2] : gl ? (bay(X, Y) < 0.55 ? 0x6f9cf0 : 0x3558c4) : dith(CELL, 0.25 + 0.55 * (1 - j / h) + (i / w) * 0.2, X, Y));
    }
  }
}
function lamppost(b, x, hgt) { rect(b, x, GY - hgt, 1, hgt, SI[4]); rect(b, x - 1, GY - 3, 3, 3, SI[3]); rect(b, x - 2, GY - hgt - 1, 5, 2, SI[5]); rect(b, x - 2, GY - hgt, 5, 1, SI[3]); }
// a whip aerial: 0 plain, 1 a yagi (crossbars), 2 a cross tree (its lamp blinks, live), 3 a little dish half way up
function aerial(b, x, h, kind) {
  const top = GY - h;
  rect(b, x, top, 1, h, SI[4]); put(b, x, top, SI[6]); rect(b, x - 1, GY - 5, 3, 5, SI[3]); put(b, x - 1, GY - 5, SI[5]);
  if (kind === 1) for (let k = 0; k < 4; k++) { const w = 4 - (k >> 1); rect(b, x - w, top + 5 + k * 5, w * 2 + 1, 1, SI[k & 1 ? 3 : 5]); }
  else if (kind === 2) { rect(b, x - 3, top + 6, 7, 1, SI[5]); rect(b, x - 2, top + 12, 5, 1, SI[3]); put(b, x - 3, top + 5, SI[5]); put(b, x + 3, top + 5, SI[5]); }
  else if (kind === 3) dish(b, x + 1, top + 10, 5, 2.4, -0.5, -0.866, 3);
  else { put(b, x, top + 9, SI[6]); rect(b, x - 1, top + 15, 3, 1, SI[3]); }
}
function hazardRow(b, x0, x1, y, h) { for (let x = x0; x < x1; x++) for (let j = 0; j < h; j++) put(b, x, y + j, ((x - x0) >> 2) & 1 ? HAZI : j ? 0xc98a16 : AMBI); }
// what stands where
const LAMPS = [[3478, 22], [3596, 20], [3890, 20], [3964, 22], [4150, 24], [4376, 26], [4660, 20], [4764, 24]];      // posts with a cyan lamp (live)
const PADS = [3520, 4520];                                      // the MINI UFOs' landing pads
const TOWER = { x: 3920, top: 128 }, PEEKDOME = 4022, VENT = 4055, DISH = { x: 4105, y: 170 }, RADAR = { x: 4610, y: GY - 38 }, PEEKLID = 4850, SIGNAL = 4876;
const FOREST1 = [[3794, 34, 0], [3803, 52, 1], [3814, 28, 0], [3822, 66, 2], [3834, 40, 3], [3846, 58, 1], [3857, 30, 0], [3868, 48, 2], [3879, 24, 0]];
const FOREST2 = [[4780, 30, 0], [4790, 46, 1], [4801, 26, 0], [4812, 54, 2], [4824, 34, 3]];
const MID0 = 3440, MID1 = 4900, MIDTOP = 100;
let DISH_FEED = [0, 0], MIDB = null;
function paintMidA() {
  const b = MIDB = buf(MID1 - MID0, GY + 1 - MIDTOP, -MID0, -MIDTOP);
  for (const [x, hg] of LAMPS) lamppost(b, x, hg);
  // landing pads: a low plate with a hazard edge, two short approach lights, a pump box with its hose
  for (const x of PADS) {
    rect(b, x - 27, GY - 2, 55, 2, SI[4]); rect(b, x - 27, GY - 2, 55, 1, SI[6]); hazardRow(b, x - 25, x + 26, GY - 1, 1);
    for (const px of [x - 32, x + 32]) { rect(b, px, GY - 9, 1, 9, SI[4]); rect(b, px - 1, GY - 2, 3, 2, SI[3]); rect(b, px - 1, GY - 11, 3, 2, SI[5]); }
    box(b, x + 40, GY - 14, 11, 14, 3); rect(b, x + 42, GY - 11, 7, 4, 0x0b1026); rect(b, x + 43, GY - 10, 3, 1, I(CYAN)); rect(b, x + 40, GY - 15, 11, 1, SI[5]);
    for (let i = 0; i < 9; i++) put(b, x + 39 - i, GY - 6 + Math.round(Math.sin(i / 8 * Math.PI) * 4), SI[2]);      // the hose
  }
  // antenna forest 1 on its rack
  box(b, 3789, GY - 5, 96, 5, 3); for (let x = 3792; x < 3884; x += 7) put(b, x, GY - 3, SI[5]);
  for (const [x, h, k] of FOREST1) aerial(b, x, h, k);
  // the lattice tower with its red beacon (lamp live), a little cabinet on its platform
  lattice(b, TOWER.x, GY, TOWER.top);
  box(b, TOWER.x + 7, 147, 7, 9, 4); rect(b, TOWER.x + 8, 149, 5, 1, SI[2]); rect(b, TOWER.x + 8, 152, 5, 1, SI[2]);
  // a deck hatch: a low dome with a hazard collar and a hand wheel (it lifts now and then: somebody peeks out)
  { const x = PEEKDOME;
    shape(b, x - 14, GY - 11, x + 14, GY, (px, py) => ((px - x) / 13) ** 2 + ((py - GY) / 10) ** 2 <= 1, (px, py) => px < x - 9 ? SI[6] : py < GY - 7 ? SI[5] : px > x + 8 ? SI[3] : SI[4]);
    for (let px = x - 14; px < x + 15; px++) { put(b, px, GY - 2, ((px - x + 14) >> 2) & 1 ? HAZI : AMBI); put(b, px, GY - 1, ((px - x + 14) >> 2) & 1 ? HAZI : 0xc98a16); }
    rect(b, x - 4, GY - 13, 9, 2, SI[6]); rect(b, x, GY - 12, 1, 3, SI[3]); rect(b, x - 4, GY - 12, 9, 1, SI[4]); }
  // a vent stack
  box(b, VENT - 5, GY - 12, 10, 12, 3); rect(b, VENT - 6, GY - 14, 12, 2, SI[5]); rect(b, VENT - 6, GY - 13, 12, 1, SI[3]);
  for (let j = 0; j < 3; j++) rect(b, VENT - 3, GY - 9 + j * 3, 6, 1, SI[1]);
  // the big dish, looking up and left at the Earth
  tube(b, DISH.x - 4, DISH.y + 6, 9, GY - DISH.y - 6, 4);
  box(b, DISH.x - 9, GY - 7, 19, 7, 3); rect(b, DISH.x - 9, GY - 7, 19, 1, SI[5]);
  box(b, DISH.x - 6, DISH.y + 4, 13, 6, 4);
  DISH_FEED = dish(b, DISH.x, DISH.y, 22, 9, -0.5, -0.866, 12);
}
function paintMidB() {
  const b = MIDB;
  // two solar panels on masts, tilted at the sun (scenery: the dark tilted ones; the platforms have a bright rail)
  for (const x of [4248, 4292]) {
    rect(b, x + 17, GY - 16, 2, 16, SI[4]); rect(b, x + 18, GY - 16, 1, 16, SI[2]); rect(b, x + 13, GY - 3, 10, 3, SI[3]); rect(b, x + 13, GY - 3, 10, 1, SI[5]);
    solar(b, x, GY - 14, 32, 23, 8);
  }
  // crates of ship parts by the pod, a small dish
  box(b, 4370, GY - 9, 14, 9, 3); box(b, 4384, GY - 15, 12, 15, 4);
  rect(b, 4402, GY - 26, 2, 26, SI[4]); dish(b, 4403, GY - 30, 9, 4, -0.5, -0.866, 5);
  // a fuel tank lying on two saddles: ring bands, a hazard band, a valve on top
  htube(b, 4438, GY - 18, 46, 13, 4);
  for (const x of [4438, 4483]) for (let j = 0; j < 13; j++) { const k = Math.abs(j - 6) / 6.5, dx = Math.round(3 * (1 - Math.sqrt(1 - k * k))); if (x === 4438) rect(b, x, GY - 18 + j, dx, 1, NONE); else rect(b, x + 1 - dx, GY - 18 + j, dx, 1, NONE); }
  for (const x of [4450, 4472]) rect(b, x, GY - 18, 1, 13, SI[2]);
  for (let x = 4456; x < 4468; x++) for (let j = 2; j < 11; j++) put(b, x, GY - 18 + j, ((x + j) >> 2) & 1 ? 0x8a6a1c : 0x1c1c28);
  box(b, 4444, GY - 6, 7, 6, 3); box(b, 4471, GY - 6, 7, 6, 3);
  rect(b, 4460, GY - 22, 3, 4, SI[5]); rect(b, 4458, GY - 23, 7, 1, SI[6]);
  // the radar's pylon (its head turns, live)
  tube(b, RADAR.x - 3, GY - 30, 7, 30, 4); box(b, RADAR.x - 8, GY - 6, 17, 6, 3); rect(b, RADAR.x - 8, GY - 6, 17, 1, SI[5]);
  box(b, RADAR.x - 5, GY - 33, 11, 4, 4); for (let y = GY - 26; y < GY - 8; y += 6) rect(b, RADAR.x - 3, y, 7, 1, SI[2]);
  // antenna cluster 2 on its rack
  box(b, 4775, GY - 5, 56, 5, 3); for (let x = 4778; x < 4830; x += 7) put(b, x, GY - 3, SI[5]);
  for (const [x, h, k] of FOREST2) aerial(b, x, h, k);
  // a flat deck hatch with a hazard collar (another peeker)
  rect(b, PEEKLID - 10, GY - 2, 21, 2, SI[3]); hazardRow(b, PEEKLID - 10, PEEKLID + 11, GY - 2, 1);
  rect(b, PEEKLID - 7, GY - 4, 15, 2, SI[5]); rect(b, PEEKLID - 7, GY - 4, 15, 1, SI[7]); rect(b, PEEKLID - 1, GY - 5, 3, 1, SI[6]);
  // a signal mast for the MINI UFOs by the bridge's airlock: red (they are too big for that door); lamps live
  rect(b, SIGNAL, GY - 34, 2, 34, SI[4]); rect(b, SIGNAL + 1, GY - 34, 1, 34, SI[2]); rect(b, SIGNAL - 2, GY - 3, 6, 3, SI[3]);
  box(b, SIGNAL - 3, GY - 50, 8, 18, 2); rect(b, SIGNAL - 3, GY - 51, 8, 1, SI[5]);
  A.mid = { c: bake(b), x0: MID0, top: MIDTOP };
  MIDB = null;
}

// ------------------------------------------------------------------------------- 3300: the STAR GARDEN's dome, outside
// Where the walk starts: the flank of the garden's great glass dome (ribs, the pink glow of the nectar and the shapes
// of the giant mushrooms inside) and the steel housing of its airlock, which the door frame at 3300 stands against.
const FLANK = { cx: 3236, cy: 214, rx: 216, ry: 196, x1: 3460 };
const GLASS = ['#191a44', '#211c50', '#2e1f5c', '#432466', '#5e2a70', '#7c3278'].map(I);
let FLB = null;
function paintFlank(ya, yb) {                                    // the glass in two runs of rows (two bake steps)
  const F = FLANK;
  if (!FLB) { FLB = buf(F.x1 - AX0, GY + 2 + 10, -AX0, 10); FLB.a = new Uint8Array(FLB.w * FLB.h).fill(255); }
  const b = FLB;
  // the shapes inside, seen through the glass: [kind, x, y, rx, ry, colour]: caps on stalks, bulbs on stems
  const INSIDE = [['cap', 3340, 148, 32, 14, 0xc0702c, 0x8a4e22], ['cap', 3400, 176, 22, 10, 0xb0449a, 0x7a3070], ['bulb', 3374, 118, 12, 12, 0x2f8f96, 0x226068], ['bulb', 3318, 90, 14, 13, 0x6a52b4, 0x46348a], ['bulb', 3424, 156, 8, 8, 0x6a52b4, 0x46348a], ['cap', 3312, 186, 16, 7, 0x2f8f96, 0x226068], ['bulb', 3398, 96, 6, 6, 0xb0449a, 0x7a3070]];
  const inside = (x, y) => {
    for (const [kind, px, py, rx, ry, c1, c2] of INSIDE) {
      if (kind === 'cap') {
        if (y <= py && ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2 <= 1) return (Math.abs(Math.abs(x - px) - rx * 0.45) < 2.2 && Math.abs(y - py + ry * 0.5) < 1.6) ? 0xf2dcc0 : y < py - ry * 0.45 ? c1 : (Math.floor(x - px) % 9 === 0 ? c1 : c2);
        if (y > py && Math.abs(x - px) < 3.5 + (y - py) * 0.03) return 0x8a7f9a;
      } else {
        if ((x - px) ** 2 / (rx * rx) + (y - py) ** 2 / (ry * ry) <= 1) return (x - px) * -0.7 + (y - py) * -0.6 > rx * 0.35 ? c1 : c2;
        if (y > py && Math.abs(x - px - Math.sin((y - py) * 0.08) * 4) < 1.2) return c2;
      }
    }
    return NONE;
  };
  for (let y = ya; y < yb; y++) for (let x = AX0; x < F.x1; x++) {
    const u = (x + 0.5 - F.cx) / F.rx, v = (F.cy - y - 0.5) / F.ry, q2 = u * u + v * v;
    if (q2 > 1) continue;
    const edge = (1 - Math.sqrt(q2)) * 204, sq = Math.sqrt(Math.max(0.0001, 1 - v * v)), m = u / sq;
    if (edge < 1.3) { putA(b, x, y, y < 120 ? SI[6] : SI[5], 255); continue; }                     // the outer frame
    if (edge < 4) { putA(b, x, y, edge < 3 ? SI[3] : SI[1], 255); continue; }
    let rib = false;
    for (const mk of [0.44, 0.67, 0.86]) if (Math.abs(m - mk) * F.rx * sq < 1.6) rib = true;       // ribs along the dome
    for (const yk of [72, 124, 166]) if (Math.abs(y - yk) < 1.5) rib = true;                       // and round it
    if (rib) { putA(b, x, y, (y === 71 || y === 123 || y === 165) ? SI[4] : SI[2], 255); continue; }
    const tint = dithS(GLASS, 0.06 + 0.9 * ss(40, 200, y) + (h2(x >> 2, y >> 2, 91) - 0.5) * 0.08, x, y, 2.2);
    const streak = ((x - AX0) + y * 0.62) % 97, gl = y < 168 && (streak < 5 || (streak > 9 && streak < 11));
    const ins = inside(x + 0.5, y + 0.5);
    if (ins !== NONE) putA(b, x, y, mixI(ins, tint, gl ? 0.08 : 0.2), 255);
    else putA(b, x, y, gl ? mixI(tint, 0xc8d8ff, 0.2) : tint, gl ? 226 : 214);
  }
}
function paintFlankBase() {
  const F = FLANK, b = FLB;
  // the dome's base wall with a light strip
  for (let x = AX0; x < F.x1; x++) {
    const xe = F.cx + F.rx * Math.sqrt(Math.max(0, 1 - ((F.cy - 196) / F.ry) ** 2));
    if (x > xe + 2) continue;
    for (let y = 196; y <= GY; y++) putA(b, x, y, y === 196 ? SI[5] : y === 197 ? SI[4] : y === 203 ? SI[1] : (x % 22 === 0 ? SI[1] : SI[2]), 255);
    if (x % 8 < 5) putA(b, x, 200, I(MAG), 255);
    if (x % 22 === 4 || x % 22 === 18) putA(b, x, 207, SI[4], 255);
  }
  // the airlock's housing: a steel block the door frame stands against, its doorway dark with the garden's pink light
  const hx = 3354;
  for (let y = 112; y <= GY; y++) for (let x = AX0; x < hx; x++) {
    let c = y === 112 ? SI[5] : y === 113 ? SI[4] : x >= hx - 2 ? SI[1] : (y - 112) % 26 === 25 ? SI[1] : (y - 112) % 26 === 0 ? SI[4] : SI[3];
    if (x === hx - 3 && y > 113) c = SI[2];
    putA(b, x, y, c, 255);
  }
  for (let y = 146; y <= GY; y++) for (let x = AX0; x < 3327; x++) putA(b, x, y, dithS([0x0e0c1e, 0x1c1030, 0x34163e, 0x55204e], ss(160, 214, y) * 0.9 - (x - AX0) * 0.012, x, y, 2), 255);
  for (let y = 150; y < 206; y += 7) { putA(b, 3324, y, I(MAG), 255); putA(b, 3324, y + 1, 0x7a2452, 255); }
  // a round window and a key pad on the housing
  shape(b, 3336, 150, 3348, 162, (x, y) => (x - 3342) ** 2 + (y - 156) ** 2 <= 30, (x, y) => { const d = Math.hypot(x - 3342, y - 156); return d > 4.2 ? SI[5] : d > 3.2 ? SI[1] : y < 155 ? 0xc04a92 : 0x8a2f6e; });
  rect(b, 3338, 174, 9, 11, SI[1]); rect(b, 3339, 175, 7, 4, 0x0b1026); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) put(b, 3340 + i * 2, 181 + j * 2, SI[5]);
  for (let x = 3330; x < hx - 3; x++) for (let j = 0; j < 4; j++) put(b, x, 116 + j, ((x + j) >> 2) & 1 ? HAZI : 0xb8922a);
  A.flank = { c: bake(b), x0: AX0, top: -10 };
  FLB = null;
}

// ------------------------------------------------------------------------------------------- 5000: the bridge tower
// Where the walk ends: the bridge's tower rises out of the hull, rows of lit windows, the robots' eye emblem; the
// door frame at 5000 stands against it (the MINI UFO is too big for that airlock).
const BT0 = 4888;
const btTop = x => x < 4892 ? 999 : x < 4914 ? 170 : x < 4942 ? 92 : -10;
function paintBridgeTower() {
  const b = buf(AX1 - BT0, 218 + 10, -BT0, 10);
  const WIN = [0xc79a40, 0xe0bd70, 0x4aa6c4, 0xa8467c], BODY = [SI[1], SI[2], SI[2], SI[3]];
  for (let x = 4892; x < AX1; x++) {
    const t = btTop(x), step = x === 4892 || x === 4914 || x === 4942, step2 = x === 4893 || x === 4915 || x === 4943;
    for (let y = t; y < 218; y++) {
      let c = dithS(BODY, 0.62 - (y + 10) / 620 + (x - 4892) / 900, x, y, 1.6);
      if (y - t < 1) c = SI[5]; else if (y - t < 2) c = SI[4];
      if (step) c = y - t < 3 ? SI[7] : SI[6]; else if (step2) c = SI[4];
      else if ((x - 4942) % 29 === 0 && x > 4942) c = SI[1];
      else if (y > t + 3 && (y + 10) % 30 === 0) c = SI[1]; else if (y > t + 3 && (y + 10) % 30 === 1) c = SI[3];
      put(b, x, y, c);
    }
  }
  // windows: rows of small lit panes (amber mostly, some cyan and magenta, some dark)
  const pane = (x, y, k) => { const q = h2(x, y, 95); if (q < 0.24) { rect(b, x, y, 4, 5, 0x10122a); return; } const c = q > 0.93 ? WIN[3] : q > 0.8 ? WIN[2] : WIN[0]; rect(b, x, y, 4, 5, c); rect(b, x, y, 4, 1, c === WIN[0] ? WIN[1] : mixI(c, 0xffffff, 0.4)); rect(b, x + 3, y + 1, 1, 4, mixI(c, 0x10122a, 0.35)); };
  for (let y = 4; y < 136; y += 15) for (let x = 4948; x < 4996; x += 8) if (!(y > 50 && y < 85 && x > 4956 && x < 4990)) pane(x, y, 0);
  for (let y = 100; y < 190; y += 15) for (let x = 4919; x < 4939; x += 8) pane(x, y, 1);
  for (const x of [4897, 4905]) pane(x, 178, 2);
  rect(b, 4917, 96, 1, 76, SI[0]);                               // a lift shaft (its light is live)
  // the robots' eye emblem
  shape(b, 4960, 54, 4986, 80, (x, y) => { const d = Math.hypot(x - 4973, y - 67); return (d > 7.2 && d < 10) || d < 3.4; }, (x, y) => (-(x - 4973) - (y - 67)) > 2 ? SI[6] : SI[5]);
  // a catwalk with a railing round the tower, a mast on the lower block
  rect(b, 4938, 150, 62, 2, SI[4]); rect(b, 4938, 152, 62, 1, SI[1]); rect(b, 4938, 142, 62, 1, SI[3]); for (let x = 4939; x < AX1; x += 7) rect(b, x, 142, 1, 8, SI[3]);      // (dim: nobody can stand on it)
  rect(b, 4927, 62, 1, 30, SI[5]); rect(b, 4925, 70, 5, 1, SI[4]); rect(b, 4926, 77, 3, 1, SI[4]); box(b, 4924, 88, 7, 4, 4);
  // pipes up the low block, its hatch
  rect(b, 4909, 172, 2, 40, SI[4]); rect(b, 4910, 172, 1, 40, SI[2]); rect(b, 4896, 190, 9, 22, SI[1]); rect(b, 4897, 191, 7, 21, 0x121030); rect(b, 4896, 190, 9, 1, SI[5]);
  // the airlock's doorway under the door frame: dark, lit cyan from inside
  for (let y = 146; y < 218; y++) for (let x = 4974; x < AX1; x++) put(b, x, y, dithS([0x0e0c1e, 0x10203a, 0x163a58, 0x1f5a7a], ss(160, 216, y) * 0.9 - (AX1 - x) * 0.012, x, y, 2));
  for (let y = 150; y < 210; y += 7) { put(b, 4976, y, I(CYAN)); put(b, 4976, y + 1, 0x1f5a7a); }
  for (let x = 4946; x < 4972; x++) for (let j = 0; j < 4; j++) put(b, x, 132 + j, ((x + j) >> 2) & 1 ? HAZI : 0xb8922a);
  return { c: bake(b), x0: BT0, top: -10 };
}

// ------------------------------------------------------------------------------------------------- the deck (the hull)
// [x, kind]: 0 lit cyan, 1 lit amber, 2 shuttered, 3 lit cyan with somebody watching (live)
const PORTS = [[3368, 0], [3456, 3], [3586, 1], [3690, 0], [3830, 3], [4000, 0], [4176, 3], [4336, 0], [4452, 2], [4588, 3], [4706, 0], [4796, 1], [4876, 3]];
const HATCHES = [3620, 4252, 4640, 4950];                       // round service hatches
const VENTS = [3410, 4050, 4490, 4812];
const PLAQUES = [[3492, 11, 1], [3742, 23, 0], [4094, 0, 0], [4530, 37, 1]];     // [x, seed, saucer icon]
const LADDERS = [3662, 4398, 4738];
const VALVES = [3470, 3776, 4420, 4700, 4900];
const HAZPLATES = [[3300, 3344], [3494, 3546], [3738, 3784], [4006, 4038], [4328, 4374], [4494, 4546], [4836, 4864], [4926, 5000]];
function glyphs(b, x, y, seed, n) {                             // the aliens' writing: rings, bars, dots, beams
  const C = I(CYAN), CL = I(CYANL), D = 0x0b1026;
  for (let k = 0; k < n; k++) {
    const t = Math.floor(hs(seed * 7.3 + k * 3.1) * 5);
    if (t === 0) { rect(b, x, y, 5, 7, C); rect(b, x + 1, y + 1, 3, 5, D); put(b, x + 2, y + 3, CL); x += 7; }
    else if (t === 1) { rect(b, x, y, 2, 7, C); rect(b, x + 4, y, 2, 2, CL); rect(b, x + 4, y + 5, 2, 2, C); x += 8; }
    else if (t === 2) { rect(b, x, y, 6, 2, C); rect(b, x, y + 5, 6, 2, C); rect(b, x + 2, y + 2, 2, 3, CL); x += 8; }
    else if (t === 3) { rect(b, x, y + 2, 3, 3, CL); x += 5; }
    else { rect(b, x, y, 5, 7, C); rect(b, x + 1, y + 1, 3, 5, D); rect(b, x + 2, y + 1, 1, 5, C); x += 7; }
  }
}
function paintDeck(X0, X1) {
  const b = buf(X1 - X0, H + 12 - GY, -X0, -GY), FACE = [SI[1], SI[2], SI[3], SI[3], SI[4]], MAGI = I(MAG), MAGLI = I(MAGL);
  const inX = (a, c) => c > X0 - 30 && a < X1 + 30;
  for (let x = X0; x < X1; x++) {
    put(b, x, GY, SI[7]); put(b, x, GY + 1, SI[6]); put(b, x, GY + 2, SI[5]); put(b, x, GY + 3, SI[4]); put(b, x, GY + 4, SI[1]);
    for (let y = GY + 5; y < GY + 14; y++) put(b, x, y, y === GY + 5 ? SI[5] : y === GY + 13 ? SI[2] : y === GY + 6 ? SI[4] : SI[3]);
    put(b, x, GY + 14, SI[1]);
    for (let y = GY + 15; y < GY + 18; y++) put(b, x, y, SI[0]);
    put(b, x, GY + 18, SI[4]);
    const sh = 0.13 + 0.1 * Math.sin(x * 0.0045 + 1);
    for (let y = GY + 19; y < H + 12; y++) put(b, x, y, dithS(FACE, 0.86 - (y - GY - 19) / 50 - sh, x, y, 1.8));
  }
  // the deck plates: seams, rivets, tread marks
  for (let x = Math.ceil((X0 - 30 - 26) / 32) * 32 + 26; x < X1; x += 32) {
    rect(b, x, GY + 6, 1, 7, SI[1]); rect(b, x + 1, GY + 6, 1, 7, SI[4]);
    put(b, x + 4, GY + 8, SI[5]); put(b, x + 4, GY + 11, SI[5]); put(b, x - 3, GY + 8, SI[5]); put(b, x - 3, GY + 11, SI[2]);
    for (let i = 0; i < 3; i++) { put(b, x + 12 + i * 4, GY + 9, SI[4]); put(b, x + 13 + i * 4, GY + 10, SI[4]); }
  }
  // hazard plates: landing pads, under the cow pods, round the deck hatches, both thresholds
  for (const [x0, x1] of HAZPLATES) {
    if (!inX(x0, x1)) continue;
    for (let x = x0; x < x1; x++) for (let y = GY + 6; y < GY + 13; y++) put(b, x, y, ((x + y) >> 2) & 1 ? (y === GY + 6 ? AMBLI : AMBI) : HAZI);
    rect(b, x0 - 1, GY + 6, 1, 7, SI[1]); rect(b, x1, GY + 6, 1, 7, SI[1]);
  }
  // the magenta guide strip in its channel
  for (let x = X0; x < X1; x++) { const m = (((x - 12) % 24) + 24) % 24; if (m < 10) { put(b, x, GY + 16, m > 1 && m < 8 ? MAGLI : MAGI); put(b, x, GY + 15, 0x7a2452); put(b, x, GY + 17, 0x7a2452); } }
  // the hull's side: ribs, panel seams
  for (let x = Math.ceil((X0 - 60 - 40) / 80) * 80 + 40; x < X1; x += 80) {
    rect(b, x, GY + 19, 1, 60, SI[5]); rect(b, x + 1, GY + 19, 3, 60, SI[3]); rect(b, x + 4, GY + 19, 1, 60, SI[1]); rect(b, x + 5, GY + 19, 1, 60, SI[0]);
    for (let y = GY + 23; y < H + 12; y += 9) { put(b, x + 2, y, SI[5]); put(b, x + 2, y + 1, SI[1]); }
    rect(b, x + 44, GY + 19, 1, 21, SI[0]); rect(b, x + 45, GY + 19, 1, 21, SI[3]);
  }
  for (let x = X0; x < X1; x++) if (get(b, x, GY + 40) !== SI[5]) { put(b, x, GY + 40, SI[0]); if (bay(x, 0) < 0.6) put(b, x, GY + 41, SI[3]); }
  // ladders down the side
  for (const lx of LADDERS) {
    if (!inX(lx, lx + 8)) continue;
    rect(b, lx, GY + 19, 1, 51, SI[5]); rect(b, lx + 7, GY + 19, 1, 51, SI[4]); rect(b, lx + 1, GY + 19, 1, 51, SI[1]);
    for (let y = GY + 21; y < H + 12; y += 4) { rect(b, lx + 1, y, 6, 1, SI[5]); rect(b, lx + 1, y + 1, 6, 1, SI[1]); }
  }
  // portholes: thick rims, the ship's light inside
  for (const [px, kind] of PORTS) {
    if (!inX(px - 10, px + 10)) continue;
    const cy = GY + 29, G4 = kind === 1 ? [0xfff0b8, 0xf2c45a, 0xc08a2a, 0x8a5c1c] : [0xbff2ff, 0x5ac8e6, 0x2a8fb8, 0x1c5f8c];
    shape(b, px - 9, cy - 9, px + 9, cy + 9, (x, y) => (x - px) ** 2 + (y - cy) ** 2 <= 8.6 * 8.6, (x, y) => {
      const d = Math.hypot(x - px, y - cy), l = (-(x - px) - (y - cy)) / 8.6;
      if (d > 7.6) return SI[0];
      if (d > 5.2) return l > 0.5 ? SI[7] : l > 0 ? SI[6] : l > -0.5 ? SI[4] : SI[3];
      if (d > 4.4) return 0x0a1230;
      if (kind === 2) return Math.floor(y) % 2 ? SI[2] : SI[3];                      // shutter slats
      return l > 0.45 ? G4[0] : l > -0.1 ? G4[1] : l > -0.6 ? G4[2] : G4[3];
    });
    for (const [i, j] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) put(b, px + i, cy + j, SI[5]);
  }
  // vents
  for (const vx of VENTS) { if (!inX(vx, vx + 24)) continue; box(b, vx, GY + 23, 24, 12, 2); for (let j = 0; j < 4; j++) rect(b, vx + 2, GY + 25 + j * 2.5, 20, 1, SI[0]); }
  // plaques in the aliens' glyphs (the ones under the landing pads show a little saucer)
  for (const [x, seed, icon] of PLAQUES) {
    if (!inX(x, x + 46)) continue;
    rect(b, x, GY + 22, 46, 13, 0x0b1026); rect(b, x, GY + 22, 46, 1, SI[4]); rect(b, x, GY + 34, 46, 1, SI[0]); rect(b, x, GY + 22, 1, 13, SI[4]); rect(b, x + 45, GY + 22, 1, 13, SI[0]);
    const C = I(CYAN), CL = I(CYANL), gy = GY + 25;
    if (!seed) {                                                // the proposal's plaque
      rect(b, x + 4, gy, 5, 7, C); rect(b, x + 5, gy + 1, 3, 5, 0x0b1026); put(b, x + 6, gy + 3, CL);
      rect(b, x + 11, gy, 2, 7, C); rect(b, x + 15, gy, 2, 2, CL); rect(b, x + 15, gy + 5, 2, 2, C);
      rect(b, x + 19, gy, 6, 2, C); rect(b, x + 19, gy + 5, 6, 2, C); rect(b, x + 21, gy + 2, 2, 3, CL);
      rect(b, x + 27, gy + 2, 3, 3, CL); rect(b, x + 32, gy, 5, 7, C); rect(b, x + 33, gy + 1, 3, 5, 0x0b1026); rect(b, x + 34, gy + 1, 1, 5, C);
      rect(b, x + 39, gy, 2, 7, C); rect(b, x + 42, gy + 5, 2, 2, CL);
    } else if (icon) {
      rect(b, x + 5, gy + 3, 11, 1, CL); rect(b, x + 4, gy + 4, 13, 1, C); rect(b, x + 6, gy + 5, 9, 1, 0x2a8fb8); rect(b, x + 8, gy, 5, 3, C); rect(b, x + 9, gy, 2, 1, CL); put(b, x + 10, gy + 6, I(AMB));
      glyphs(b, x + 21, gy, seed, 3);
    } else glyphs(b, x + 4, gy, seed, 5);
  }
  // round service hatches with a hazard ring and a hand wheel
  for (const hx of HATCHES) {
    if (!inX(hx - 15, hx + 15)) continue;
    const hy = GY + 34;
    shape(b, hx - 14, hy - 14, hx + 14, hy + 14, (x, y) => (x - hx) ** 2 + (y - hy) ** 2 <= 13.4 * 13.4, (x, y) => {
      const dx = x - hx, dy = y - hy, d = Math.hypot(dx, dy), l = (-dx - dy) / 13, a = Math.atan2(dy, dx);
      if (d > 12.4) return SI[0];
      if (d > 10) return (Math.floor((a + Math.PI) / (Math.PI / 6)) & 1) ? HAZI : l > 0 ? AMBI : 0xc98a16;
      if (d > 9) return SI[1];
      if (d > 4.6 && d < 6.2) return l > 0.1 ? SI[7] : SI[5];
      if (d < 1.6) return SI[6];
      if (d < 4.6 && (Math.abs(dx) < 0.8 || Math.abs(dy) < 0.8)) return SI[5];
      return l > 0.35 ? SI[5] : l > -0.3 ? SI[4] : SI[3];
    });
  }
  // pipes along the hull, flanges, a red hand wheel here and there, a sagging cable
  htube(b, X0, GY + 46, X1 - X0, 4, 4); rect(b, X0, GY + 50, X1 - X0, 1, SI[0]);
  for (let x = Math.ceil((X0 - 10 - 38) / 80) * 80 + 38; x < X1; x += 80) { rect(b, x, GY + 45, 3, 6, SI[5]); rect(b, x + 3, GY + 45, 1, 6, SI[2]); rect(b, x, GY + 45, 3, 1, SI[6]); }
  for (const vx of VALVES) { if (!inX(vx - 4, vx + 4)) continue; rect(b, vx - 1, GY + 43, 3, 3, SI[5]); rect(b, vx - 3, GY + 41, 7, 2, 0xc8322c); rect(b, vx - 3, GY + 41, 7, 1, 0xff6b5a); put(b, vx, GY + 41, SI[7]); }
  for (let x = X0; x < X1; x++) { const y = GY + 54 + Math.round(Math.sin((x - REF) * 0.045) * 1.4); put(b, x, y, SI[3]); put(b, x, y + 1, SI[0]); }
  // the last 20 px slope down to the bridge's deck: each column slides down with the terrain
  for (let x = Math.max(X0, 4975); x < X1; x++) {
    const k = Math.round(L5ART.groundAt(x + 0.5)) - GY, col = x - X0;
    if (k <= 0) continue;
    for (let j = b.h - 1; j >= 0; j--) b.d[j * b.w + col] = j >= k ? b.d[(j - k) * b.w + col] : NONE;
  }
  return { c: bake(b), x0: X0, top: GY };
}
const DECKCUT = 4150;

// ------------------------------------------------------------------------------------------------------ low foreground
// Dark pieces along the very bottom, parallax 1.25: they frame, they never hide the play lane. [kind, design x]
const FRONT_P = 1.25, FR0 = -1450, FR1 = 1960, FRTOP = 236;
const FRONTS = [['pipes', -1380], ['wing', -1500], ['aerials', -860], ['pump', -640], ['pipes', -360], ['pump', 0], ['wing', 0], ['aerials', 680], ['pipes', 960], ['pump', 1330], ['wing', 1230]];
function paintFront() {
  const b = buf(FR1 - FR0, H + 10 - FRTOP, -FR0, -FRTOP), D = [SI[0], SI[1], SI[2], SI[3], SI[4]];
  const FC = ['#0c1238', '#101a4c', '#172664', '#20347c'].map(I);
  for (const [kind, o] of FRONTS) {
    if (kind === 'pump') {                                      // a pump box with a gauge and a fat pipe
      for (let j = 0; j < 9; j++) rect(b, o - MG, 259 + j, 136, 1, j === 0 ? D[4] : j < 3 ? D[3] : j < 6 ? D[2] : D[1]);
      for (const x of [58, 92]) { rect(b, o + x, 257, 4, 14, D[3]); rect(b, o + x, 257, 4, 1, D[4]); rect(b, o + x + 3, 258, 1, 13, D[1]); }
      rect(b, o - MG, 246, 70, 24, D[2]); rect(b, o - MG, 246, 70, 1, D[4]); rect(b, o + 29, 247, 1, 23, D[0]); rect(b, o - MG, 247, 69, 1, D[3]);
      for (let x = -MG; x < 29; x++) put(b, o + x, 249, ((x + 60) >> 2) & 1 ? 0x6a5222 : D[0]);                // a dim hazard lip
      for (let i = 0; i < 3; i++) { rect(b, o + 2 + i * 5, 254, 3, 9, D[0]); rect(b, o + 2 + i * 5, 254, 1, 9, D[1]); }
      shape(b, o + 17, 252, o + 27, 262, (x, y) => (x - o - 22.5) ** 2 + (y - 257.5) ** 2 <= 20, (x, y) => Math.hypot(x - o - 22.5, y - 257.5) > 3.4 ? D[4] : 0x0b1026);
      put(b, o + 22, 257, I(CYAN)); put(b, o + 23, 256, I(CYAN)); put(b, o + 24, 255, I(CYANL));
      rect(b, o + 12, 240, 2, 6, D[3]); rect(b, o + 9, 238, 8, 2, D[3]); rect(b, o + 9, 238, 8, 1, D[4]);
      for (let x = 30; x < 80; x++) { const y = 251 + Math.round(Math.sin((x - 30) / 50 * Math.PI) * 5); put(b, o + x, y, D[3]); put(b, o + x, y + 1, D[0]); }
    } else if (kind === 'wing') {                               // the edge of a solar wing
      for (let y = 240; y < H + 10; y++) for (let x = 372; x < 600; x++) {
        const e = x - (372 + (270 - y) * 1.05), e2 = (548 + (270 - y) * 1.05) - x, t = y - (252 - (x - 400) * 0.07);
        if (e < 0 || t < 0 || e2 < 0) continue;
        const u = Math.floor(e), v = Math.floor(t);
        put(b, o + x, y, e < 1.2 || t < 1.2 || e2 < 1.2 ? D[4] : e < 2.4 || t < 2.4 ? D[2] : u % 14 === 0 || v % 9 === 0 ? D[1] : dith(FC, 0.25 + 0.6 * h2(Math.floor(u / 14), Math.floor(v / 9), 7), x, y));
      }
    } else if (kind === 'pipes') {                              // three pipes on brackets, a hand wheel
      for (let k = 0; k < 3; k++) { const y = 254 + k * 6; rect(b, o, y, 150, 4, D[2]); rect(b, o, y, 150, 1, D[4]); rect(b, o, y + 3, 150, 1, D[0]); }
      for (const x of [14, 74, 134]) { rect(b, o + x, 251, 5, 22, D[3]); rect(b, o + x, 251, 1, 22, D[4]); rect(b, o + x + 4, 252, 1, 21, D[1]); }
      rect(b, o + 46, 247, 2, 7, D[3]); rect(b, o + 41, 245, 12, 2, D[3]); rect(b, o + 41, 245, 12, 1, D[4]);
      for (let x = 150; x < 172; x++) { const y = 254 + Math.round(((x - 150) / 22) ** 2 * 18); rect(b, o + x, y, 1, 4, D[2]); put(b, o + x, y, D[4]); }
    } else {                                                    // a junction box with three stub aerials and a cable
      rect(b, o, 250, 54, 22, D[2]); rect(b, o, 250, 54, 1, D[4]); rect(b, o, 251, 1, 21, D[3]); rect(b, o + 53, 251, 1, 21, D[0]);
      for (let i = 0; i < 4; i++) rect(b, o + 6 + i * 6, 255, 3, 8, D[0]);
      put(b, o + 40, 256, I(AMB)); put(b, o + 44, 256, 0x7a2452);
      for (const [x, h] of [[10, 9], [24, 13], [40, 7]]) { rect(b, o + x, 250 - h, 1, h, D[3]); put(b, o + x, 250 - h, D[4]); }
      for (let x = 54; x < 110; x++) { const y = 262 + Math.round(Math.sin((x - 54) / 56 * Math.PI) * 6); put(b, o + x, y, D[3]); put(b, o + x, y + 1, D[0]); }
    }
  }
  return { c: bake(b), x0: FR0, top: FRTOP, p: FRONT_P };
}

// ------------------------------------------------------------------------------------------------------- platforms
// 'solar': a solar wing on a mast; the bright rail on top is where feet stand, the cells lean back under it.
function solarPlat(w, hgt) {
  const b = buf(w + 4, hgt + 3, 2, 1), mid = w >> 1;
  box(b, mid - 5, 11, 11, 6, 4);
  tube(b, mid - 2, 15, 5, hgt - 15, 4);
  box(b, mid - 7, hgt - 4, 15, 4, 3); rect(b, mid - 7, hgt - 4, 15, 1, SI[5]);
  line(b, mid - 3, 26, mid - 18, 13, SI[4]); line(b, mid + 3, 26, mid + 18, 13, SI[3]);
  for (let j = 0; j < 10; j++) {
    const inset = Math.round(j * 0.5), y = 3 + j, ww = w - 2 * inset;
    for (let u = 0; u < ww; u++) {
      const i = u + inset, fr = u === 0 || u === ww - 1 || j === 9, grid = Math.round(u * w / ww) % 10 === 0 || j === 4;
      const gl = Math.abs((i + j * 1.6) - w * 0.62) < 3.2;
      put(b, i, y, fr ? SI[4] : grid ? SI[2] : gl ? (bay(i, y) < 0.55 ? 0x6f9cf0 : 0x3558c4) : dith(CELL, 0.3 + 0.5 * (1 - j / 10) + (i / w) * 0.2, i, y));
    }
  }
  rect(b, 0, 0, w, 1, SI[7]); rect(b, 0, 1, w, 1, SI[6]); rect(b, 0, 2, w, 1, SI[4]);
  rect(b, 0, 0, 2, 3, SI[7]); rect(b, w - 2, 1, 2, 2, SI[5]);
  outlineExt(b);
  return { c: bake(b), ox: 2, oy: 1 };
}
// 'tower': a lattice mast with a deck plate (hazard lip) and a whip aerial at its right end (the lamp is live)
function towerPlat(w, hgt) {
  const b = buf(w + 4, hgt + 24, 2, 21);
  const lx = y => 7 - 4 * (y - 5) / (hgt - 5), rx = y => w - 8 + 4 * (y - 5) / (hgt - 5);
  for (let k = 0, y = 5; k < 3; k++) {
    const y2 = k === 2 ? hgt - 3 : y + 12 + k;
    line(b, lx(y), y, rx(y2), y2, SI[4]); line(b, rx(y), y, lx(y2), y2, SI[5]);
    rect(b, Math.round(lx(y2)), y2, Math.round(rx(y2) - lx(y2)) + 1, 1, SI[5]);
    y = y2;
  }
  for (let y = 5; y < hgt; y++) { const a = Math.round(lx(y)), c = Math.round(rx(y)); put(b, a, y, SI[6]); put(b, a + 1, y, SI[4]); put(b, c, y, SI[3]); put(b, c - 1, y, SI[5]); }
  box(b, 1, hgt - 3, 8, 3, 3); box(b, w - 9, hgt - 3, 8, 3, 3);
  rect(b, 0, 0, w, 5, SI[4]); rect(b, 0, 0, w, 1, SI[7]); rect(b, 0, 1, w, 1, SI[6]); rect(b, 0, 4, w, 1, SI[2]);
  for (let i = 2; i < w - 2; i++) put(b, i, 3, ((i >> 2) & 1) ? AMBI : HAZI);
  rect(b, w - 6, -16, 1, 16, SI[5]); rect(b, w - 8, -9, 5, 1, SI[4]); box(b, w - 10, -4, 7, 4, 4);
  outlineExt(b);
  return { c: bake(b), ox: 2, oy: 21 };
}
const PLATS = {};
function platSprite(pl) {
  const hgt = Math.round(L5ART.groundAt(pl.x + pl.w / 2)) - pl.y, k = pl.t + ':' + pl.w + ':' + hgt;
  return PLATS[k] || (PLATS[k] = pl.t === 'tower' ? towerPlat(pl.w, hgt) : solarPlat(pl.w, hgt));
}

// ------------------------------------------------------------------------------------------------- the hero's bubble
// A glass bubble over the head: mostly clear, a bright rim, a glint, a steel collar, a tiny aerial with a yellow tip
// (silver and yellow: neither hero's colour). Local (0, 0) = the feet, facing right; baked both ways.
let HELM = null;
function helmSprites() {
  const b = buf(30, 28, 15, 43), cx = -1, cy = -29.2, rx = 11.4, ry = 9.3;
  b.a = new Uint8Array(b.w * b.h).fill(255);
  for (let y = -41; y < -21; y++) for (let x = -14; x < 13; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = Math.sqrt(dx * dx + dy * dy) * 11.4, a = Math.atan2(dy, dx);
    if (d > 11.4) continue;
    if (d > 10.5) putA(b, x, y, OUTI, 150);
    else if (d > 9.4) putA(b, x, y, a < -2.0 ? 0xffffff : a < -0.9 ? 0xc8f7ff : a < 0 ? 0x74d3ee : a > 2.4 ? 0xe8fbff : 0x4aa8cc, a < -0.9 || a > 2.4 ? 235 : 190);
    else if (d < 8.4 && d > 7.1 && a > -2.75 && a < -2.2) putA(b, x, y, 0xffffff, 215);          // a curved streak, upper left
    else putA(b, x, y, 0xa0ecff, 30);
  }
  putA(b, 5, -35, 0xffffff, 230); putA(b, 6, -34, 0xffffff, 230);                                 // a glint, upper right
  // the collar
  for (let x = -7; x < 6; x++) { putA(b, x, -21, x < -3 ? 0xe6ecf7 : 0xc3d0ee, 255); putA(b, x, -20, x > 2 ? 0x444e82 : 0x6272ab, 255); }
  putA(b, -8, -21, OUTI, 255); putA(b, -8, -20, OUTI, 255); putA(b, 6, -21, OUTI, 255); putA(b, 6, -20, OUTI, 255);
  for (let x = -7; x < 6; x++) putA(b, x, -19, OUTI, 110);
  // the air hose down to the pack, the aerial
  putA(b, -8, -19, 0xe6ecf7, 255); putA(b, -9, -18, 0xbcc8de, 255); putA(b, -10, -17, 0x8d9dbd, 255);
  putA(b, -6, -39, 0xe6ecf7, 255); putA(b, -6, -40, 0xe6ecf7, 255); putA(b, -6, -41, 0xbcc8de, 255); putA(b, -6, -42, 0xffd84d, 255); putA(b, -7, -42, OUTI, 200); putA(b, -5, -42, OUTI, 200); putA(b, -6, -43, OUTI, 200);
  return { r: bake(b), l: bake(b, true), ox: b.ox, oy: b.oy, w: b.w };
}
L5ART.helmet = function (x, y, facing) {
  const s = HELM || (HELM = helmSprites()), p = G.p;
  let bob = 0;                                                  // the head bobs with the hero's idle and run frames
  if (p && p.x === x && !p.crouch && p.onGround) { if (p.vx) { const f = Math.floor(p.t / 4) % 6; bob = f === 2 || f === 5 ? -1 : 0; } else bob = Math.floor(p.t / 32) % 2; }
  const X = Math.round(x), Y = Math.round(y) + bob - s.oy;
  if (facing < 0) ctx.drawImage(s.l, X + s.ox - s.w, Y); else ctx.drawImage(s.r, X - s.ox, Y);
  if (G.t % 170 < 6) { const gx = X + (facing < 0 ? -6 : 5), gy = Math.round(y) + bob - 35; ctx.fillStyle = '#ffffff'; ctx.fillRect(gx - 1, gy, 3, 1); ctx.fillRect(gx, gy - 1, 1, 3); }
};

// the oggle watching from a porthole: three frames (ducked, half up, up), clipped to the glass
function peekSprites() {
  return [7, 3, 0].map(oy => {
    const b = buf(9, 9, 4, 4);
    const inGlass = (x, y) => x * x + y * y <= 19.4;
    const set = (x, y, c) => { if (inGlass(x + 0.5, y + 0.5 - 0)) put(b, x, y, c); };
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const Y = y - oy;                                         // the face's own row
      let c = NONE;
      if (x * x + (Y - 1) * (Y - 1) <= 12.5) c = I(GRN[3]);
      if (Y >= 3 && Y <= 4 && Math.abs(x) <= 3) c = I(GRN[1]);
      if (Y === -3 && Math.abs(x) <= 2) c = I(GRN[5]);
      if (x * x + Y * Y <= 6.3) c = 0x7f8fa6;
      if ((Math.abs(x) <= 1 && Math.abs(Y) <= 2) || (Math.abs(x) <= 2 && Math.abs(Y) <= 1)) c = I(EYEW);
      if (c !== NONE) set(x, y, c);
    }
    return bake(b);
  });
}
// the Earth's light on the scene: a soft blue radial, drawn additively by overlay()
function shineSprite() {
  const c = canvasOf(300, 200), g = c.getContext('2d'), gr = g.createRadialGradient(100, 150, 16, 100, 150, 200);
  gr.addColorStop(0, 'rgba(70,140,255,0.10)'); gr.addColorStop(1, 'rgba(70,140,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 300, 200);
  return c;
}

// -------------------------------------------------------------------------------------------------- bake steps (once)
// each well under 100 ms in the harness (about 10-30 ms on a quiet machine; the Earth is the dear one: eight runs of rows)
const steps = [
  () => spaceRows(-10, 40),
  () => spaceRows(40, 100),
  () => spaceRows(100, 170),
  () => { spaceRows(170, H + 10); spaceStars(); A.moon = moonSprite(); },
  () => earthGeo(EY0, 122), () => earthGeo(122, 150), () => earthGeo(150, 176), () => earthGeo(176, 204), () => earthGeo(204, EY1),
  () => earthPaint(EY0, 150), () => earthPaint(150, 190), () => earthPaint(190, EY1),
  earthFinish,
  () => { A.farA = paintFarA(); A.farB = paintFarB(); },
  () => { paintMidA(); paintMidB(); },
  () => paintFlank(FLANK.cy - FLANK.ry, 118),
  () => { paintFlank(118, 197); paintFlankBase(); },
  () => { A.tower = paintBridgeTower(); A.deck = [paintDeck(AX0 - 4, DECKCUT), paintDeck(DECKCUT, AX1 + 4)]; },
  () => {
    A.front = paintFront(); A.peek = peekSprites(); A.shine = shineSprite(); HELM = HELM || helmSprites();
    for (const c of [CYAN, MAG, AMB, RED, '#c9c6e0']) GL[c] = GL[c] || glowSprite(c);
    const L = L5ART.level && L5ART.level();
    for (const pl of (L && L.plats) || []) if (pl.t === 'solar' || pl.t === 'tower') platSprite(pl);
  }
];

// ------------------------------------------------------------------------------------------------------ live scenery
// far saucers flying in formation, tiny with distance: [design x, y, k]; gone before the mini-boss's screen
const FARS = [[398, 46, 0], [414, 52, 1], [431, 44, 2]];
function bg(g, cx) {
  const t = G.t, sh = p => Math.round((cx - REF) * p);
  const ga = g.globalAlpha;
  if (cx < 2400 || cx > 5400) { g.fillStyle = '#05040d'; g.fillRect(-10, -10, W + 20, H + 20); }      // (the space strip covers the screen for every camera in between)
  stripDraw(g, A.space, cx);
  const so = sh(SPACE_P);
  for (const [x0, y, per, c] of TWINK) {                         // twinkling stars
    const x = x0 - so, on = ((t + x0) % per) < per / 2;
    g.globalAlpha = ga * (on ? 1 : 0.35); g.fillStyle = c; g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5);
    if (on) { g.globalAlpha = ga * 0.5; g.fillRect(x - 3, y, 7, 1); g.fillRect(x, y - 3, 1, 7); }
    g.globalAlpha = ga; g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1);
  }
  const mx = 96 - sh(MOON_P);
  glow(g, mx, 70, 16, '#c9c6e0', 0.16); g.drawImage(A.moon, mx - 10, 60);
  for (const [x, y, n, off] of [[52, 46, 9, 0], [246, 78, 7, 150], [380, 40, 8, 330]]) {       // shooting stars: more meteors on their way
    const u = ((t + off) % 480) / 60;
    if (u > 0.5) continue;
    const hx = x - so - Math.round(u * 26), hy = y + Math.round(u * 26 * 1.6);
    for (let i = 0; i < n; i++) { g.globalAlpha = ga * (1 - i / n); g.fillStyle = i < 2 ? '#ffffff' : i < 5 ? AMBL : '#ff8c2e'; g.fillRect(hx + Math.round(i * 0.6), hy - i, 1, 1); }
    g.globalAlpha = ga;
  }
  const fo2 = sh(0.3);
  for (const [x0, y, k] of FARS) {                               // three eye saucers, tiny with distance
    if (cx > 4170 + k * 40) continue;
    const x = x0 - fo2, yy = y + (((t + k * 20) % 64) < 32 ? 0 : 1);
    g.fillStyle = OUT; g.fillRect(x - 4, yy - 1, 9, 4); g.fillRect(x - 2, yy - 3, 5, 3); g.fillRect(x - 1, yy + 2, 3, 2);
    g.fillStyle = '#74d3ee'; g.fillRect(x - 1, yy - 2, 3, 1);
    g.fillStyle = GRN[4]; g.fillRect(x - 3, yy, 7, 1); g.fillStyle = GRN[2]; g.fillRect(x - 3, yy + 1, 7, 1);
    g.fillStyle = EYEW; g.fillRect(x, yy + 2, 1, 1); g.fillStyle = ((t + k * 10) % 30) < 15 ? AMBL : AMB; g.fillRect(x - 2 + k, yy, 1, 1);
  }
  // the Earth, the glow of its air, the ping on Vigo: home
  const eo = sh(EARTH_P);
  g.drawImage(A.earth, HX0 - eo, HY0);
  const v = VIGOXY || (VIGOXY = earthXY(VIGO[0], VIGO[1]).map(Math.round)), vx = v[0] - eo, vy = v[1], u = ((t + 30) % 80) / 80;
  g.globalAlpha = ga * 0.95 * (1 - u); g.drawImage(A.ping[Math.min(6, Math.floor(u * 7))], vx - 10, vy - 7);
  g.globalAlpha = ga;
  g.fillStyle = OUT; g.fillRect(vx - 2, vy - 1, 5, 3); g.fillRect(vx - 1, vy - 2, 3, 5);
  g.fillStyle = MAG; g.fillRect(vx - 1, vy - 1, 3, 3); g.fillStyle = '#ffffff'; g.fillRect(vx, vy, 1, 1); g.fillRect(vx - 1, vy - 1, 1, 1);
  // the far ship: the engine's glow, the fin's beacon, mast lamps
  const fo = sh(FA_P);
  glow(g, 486 - fo, 183, 34, MAG, 0.3 + 0.08 * Math.sin(t / 9));
  stripDraw(g, A.farA, cx);
  lamp(g, 456 - fo, 61, RED, t % 50 < 28, 7);
  lamp(g, 331 - fo, 123, AMB, (t + 20) % 64 < 30, 4); lamp(g, 247 - fo, 183, RED, (t + 8) % 44 < 20, 4); lamp(g, 564 - fo, 99, AMB, (t + 40) % 70 < 32, 4);
  // the nearer ridge: lamps on the tank, the landing shelf (a chase along the parked saucers), the forest, the bridge
  const fb = sh(FB_P);
  stripDraw(g, A.farB, cx);
  if (372 - fb > -20 && 372 - fb < W + 20) lamp(g, 372 - fb, 180, CYAN, (t + 12) % 70 < 40, 4);
  if (fb < 12) {
    const k = Math.floor(t / 14) % 7;
    for (let i = 0; i < 4; i++) { g.fillStyle = i === k ? AMBL : '#6a5222'; g.fillRect(PARK[i] - fb, SHELF - 6, 1, 1); }
    // the fifth saucer: parked, lifts off, flies away over the ridge, comes back down (a slow 15-second round)
    const q = t % 900;
    let sx = PARKLIVE, sy = SHELF - 5, here = true;
    if (q >= 380 && q < 560) { const u = q - 380; sy -= Math.min(u, 50) * 0.6; sx += Math.max(0, u - 50) * 1.3; sy -= Math.max(0, u - 50) * 0.12; }
    else if (q >= 560 && q < 720) here = false;
    else if (q >= 720) { const u = 900 - q; sy -= Math.min(u, 50) * 0.6; sx += Math.max(0, u - 50) * 1.3; sy -= Math.max(0, u - 50) * 0.12; }
    if (here) farSaucer(g, Math.round(sx) - fb, Math.round(sy), q < 380 ? false : Math.floor(t / 6) % 2 === 0, q >= 380);
    lamp(g, -7 - fb, SHELF - 27, RED, (t + 5) % 56 < 26, 4); lamp(g, -196 - fb, 123, AMB, (t + 25) % 62 < 30, 4);
  }
  if (640 - fb > -20 && 550 - fb < W + 20) for (const [x, h, kind] of FOREST) if (kind === 2) { g.fillStyle = (t + x * 7) % 66 < 30 ? '#c8a04a' : '#3a2a3a'; g.fillRect(x - fb, 189 - h, 1, 1); }      // far and dim: no glow
}
let VIGOXY = null;
// a saucer on the far landing shelf, tiny with distance (x, y = the middle of its disc)
function farSaucer(g, x, y, lit, flying) {
  if (!flying) { g.fillStyle = '#292a52'; g.fillRect(x - 4, y + 4, 1, 1); g.fillRect(x + 4, y + 4, 1, 1); g.fillRect(x - 3, y + 3, 1, 1); g.fillRect(x + 3, y + 3, 1, 1); }
  g.fillStyle = '#1c5a34'; g.fillRect(x - 6, y + 1, 13, 1); g.fillStyle = '#2a7a40'; g.fillRect(x - 5, y, 11, 1); g.fillRect(x - 6, y + 1, 1, 1);
  g.fillStyle = '#134028'; g.fillRect(x - 5, y + 2, 11, 1);
  g.fillStyle = '#2f6a88'; g.fillRect(x - 2, y - 3, 5, 3); g.fillRect(x - 1, y - 4, 3, 1); g.fillStyle = '#5aa6c4'; g.fillRect(x - 2, y - 3, 1, 1); g.fillRect(x - 1, y - 4, 1, 1);
  g.fillStyle = lit ? AMBL : '#b9d0e4'; g.fillRect(x, y + 3, 1, 1);
}

function behind(cx) {
  const t = G.t;
  if (seen(AX0, FLANK.x1, cx)) {
    ctx.drawImage(A.flank.c, A.flank.x0, A.flank.top);
    glow(ctx, 3312, 206, 22, MAG, 0.22 + 0.06 * Math.sin(t / 16));                                  // the garden's light in the doorway
    R(3341, 176, 1, 1, t % 40 < 20 ? CYANL : '#1f5f78');
    ctx.fillStyle = MAGL;                                        // spores drifting up inside the dome
    for (let i = 0; i < 9; i++) {
      const u = (t / (260 + i * 37) + hs(i * 5.3)) % 1, x = 3362 + hs(i * 2.9) * 70 + Math.sin(t * 0.02 + i * 2) * 3, y = 192 - u * (70 + hs(i * 7.1) * 50);
      ctx.globalAlpha = 0.55 * Math.sin(u * Math.PI); ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  if (seen(BT0, AX1, cx)) {
    ctx.drawImage(A.tower.c, A.tower.x0, A.tower.top);
    lamp(ctx, 4927, 60, RED, (t + 9) % 46 < 24, 6);
    glow(ctx, 4990, 208, 22, CYAN, 0.2 + 0.05 * Math.sin(t / 14));
    { const u = (t % 640) / 640, ly = Math.round(96 + (u < 0.5 ? u * 2 : 2 - u * 2) * 70); R(4917, ly, 1, 3, CYANL); R(4917, ly + 3, 1, 1, '#2a8fb8'); }      // a lift going up and down
    for (const [wx, wy, o] of [[4956, 19, 0], [4980, 94, 70], [4927, 130, 140]]) if ((t + o) % 220 < 90) R(wx, wy, 4, 5, '#10122a');      // somebody switches a light off and on
  }
  worldDraw(A.mid, cx);
  for (const [x, hg] of LAMPS) if (seen(x - 8, x + 8, cx)) { glow(ctx, x, GY - hg - 1, 7, CYAN, 0.45); R(x - 1, GY - hg - 3, 3, 2, CYANL); R(x - 1, GY - hg - 2, 3, 1, CYAN); }
  for (const x of PADS) if (seen(x - 40, x + 60, cx)) {                                             // pad lights
    const k = Math.floor(t / 16) % 2;
    lamp(ctx, x - 32, GY - 11, AMB, k === 0, 4); lamp(ctx, x + 32, GY - 11, AMB, k === 1, 4);
    R(x + 46, GY - 10, 2, 1, t % 60 < 30 ? CYANL : '#1f5f78');
  }
  if (seen(3780, 3890, cx)) for (const [x, h, k] of FOREST1) if (k === 2) lamp(ctx, x, GY - h - 2, x === 3822 ? RED : AMB, (t + x) % 60 < 28, 4);
  if (seen(4770, 4840, cx)) for (const [x, h, k] of FOREST2) if (k === 2) lamp(ctx, x, GY - h - 2, CYAN, (t + x) % 90 < 50, 4);
  if (seen(TOWER.x - 20, TOWER.x + 20, cx)) lamp(ctx, TOWER.x, TOWER.top - 18, RED, t % 40 < 22, 8);          // the tower's beacon
  for (const [x, o] of [[4268, 0], [4310, 90]]) if (seen(x - 20, x + 20, cx) && (t + o) % 210 < 12) { const k = (t + o) % 210, gx = x - 6 + k, gy = GY - 34 + Math.round(k * 0.5); R(gx - 1, gy, 3, 1, '#ffffff'); R(gx, gy - 1, 1, 3, '#ffffff'); }
  if (seen(DISH.x - 40, DISH.x + 40, cx)) { glow(ctx, DISH_FEED[0], DISH_FEED[1], 5, MAG, 0.6); R(DISH_FEED[0], DISH_FEED[1], 1, 1, MAGL); }
  if (seen(VENT - 20, VENT + 20, cx)) {                                                             // gas puffing out of the vent
    ctx.fillStyle = '#c3d0ee';
    for (let i = 0; i < 5; i++) {
      const u = (t / 70 + i / 5) % 1, x = VENT + Math.round(Math.sin(i * 2.1 + u * 3) * (1 + u * 4)), y = GY - 15 - Math.round(u * 20), s = 1 + Math.round(u * 2);
      ctx.globalAlpha = 0.5 * (1 - u); ctx.fillRect(x - s, y - s, s * 2 + 1, s * 2 + 1);
    }
    ctx.globalAlpha = 1;
  }
  if (seen(PEEKDOME - 20, PEEKDOME + 20, cx)) peek(PEEKDOME, GY - 13, 9, (t + 150) % 420, false);
  if (seen(PEEKLID - 20, PEEKLID + 20, cx)) peek(PEEKLID, GY - 4, 15, (t + 330) % 380, true);
  if (seen(RADAR.x - 20, RADAR.x + 20, cx)) radar(RADAR.x, RADAR.y, t);
  if (seen(SIGNAL - 10, SIGNAL + 10, cx)) {
    const on = t % 50 < 34;
    if (on) glow(ctx, SIGNAL + 1, GY - 46, 7, RED, 0.6);
    R(SIGNAL - 1, GY - 48, 4, 4, on ? RED : '#5a1a1a'); if (on) R(SIGNAL - 1, GY - 48, 1, 1, '#ffd6d1');
    R(SIGNAL - 1, GY - 43, 4, 4, '#5a4a1c'); R(SIGNAL - 1, GY - 38, 4, 4, '#1c4a5a');
  }
}
// a hatch lid lifts, an oggle's eye looks left and right, the lid drops: (x, top of the closed lid, lid width, phase)
function peek(x, y, w, ph, flat) {
  if (ph >= 150) return;
  const lift = ph < 8 ? Math.ceil(ph / 2) + 1 : ph > 142 ? Math.ceil((150 - ph) / 2) + 1 : 5, hw = w >> 1;
  R(x - hw, y - lift, w, lift + 2, '#0e0c1e');
  if (lift >= 4) {
    R(x - 3, y - lift + 1, 7, lift, GRN[1]); R(x - 3, y - lift + 1, 7, 1, GRN[2]);
    R(x - 2, y - 2, 5, 2, '#b9d0e4');
    const ix = x - 1 + (ph < 50 ? -1 : ph < 100 ? 1 : 0); R(ix, y - 2, 2, 2, '#a3151a'); R(ix, y - 1, 1, 1, PUP);
  }
  R(x - hw, y - lift - 2, w, 2, S[6]); R(x - hw, y - lift - 1, w, 1, S[4]);
  if (flat) R(x - 1, y - lift - 3, 3, 1, S[6]);
}
// the radar's head: a flat mesh aerial turning about its mast (wide face-on, a sliver edge-on; its back is darker and
// cross-braced), the feed horn on its arm swinging round in front
function radar(x, y, t) {
  const a = t * 0.028, c = Math.cos(a), s = Math.sin(a), hw = Math.max(1, Math.round(15 * Math.abs(c))), front = c > 0;
  R(x - 1, y + 5, 3, 3, S[4]);
  if (!front) R(x + Math.round(s * 7), y + 1, 2, 2, S[3]);                    // the feed, seen past the edge of the back
  R(x - hw, y - 6, hw * 2 + 1, 12, front ? S[4] : S[2]);
  R(x - hw, y - 6, hw * 2 + 1, 1, front ? S[7] : S[4]); R(x - hw, y + 5, hw * 2 + 1, 1, front ? S[3] : S[1]);
  if (hw > 2) {
    R(x - hw, y - 6, 1, 12, front ? S[6] : S[3]); R(x + hw, y - 6, 1, 12, front ? S[3] : S[1]);
    if (front) { R(x - hw + 1, y - 2, hw * 2 - 1, 1, S[5]); R(x - hw + 1, y + 2, hw * 2 - 1, 1, S[3]); for (const k of [-0.5, 0.5]) R(x + Math.round(k * hw), y - 5, 1, 10, S[3]); }
    else { R(x - hw + 1, y - 1, hw * 2 - 1, 1, S[3]); R(x, y - 5, 1, 10, S[3]); }
  }
  if (front) { const fx = x + Math.round(s * 7); R(fx - 1, y, 3, 3, S[6]); R(fx, y + 1, 1, 1, MAGL); R(x, y + 3, fx > x ? fx - x : 1, 1, S[6]); if (fx < x) R(fx, y + 3, x - fx, 1, S[6]); }
  R(x, y - 10, 1, 4, S[5]); R(x - 1, y - 11, 3, 2, t % 36 < 18 ? AMB : '#6a5222');
}

function ground(cx) {
  const t = G.t;
  if (seen(AX0 - 4, DECKCUT, cx)) worldDraw(A.deck[0], cx);
  if (seen(DECKCUT, AX1 + 4, cx)) worldDraw(A.deck[1], cx);
  // a light running along the guide strip (every eighth dash, moving right)
  const k = Math.floor(t / 5) % 8;
  for (let x = Math.floor((cx - 20) / 192) * 192 + 12 + k * 24; x < cx + W + 20; x += 192) {
    if (x < AX0 + 2 || x > 4966) continue;
    glow(ctx, x + 5, GY + 16, 9, MAG, 0.5); R(x + 1, GY + 16, 8, 1, '#ffffff');
  }
  // landing pads: studs on the deck's edge blink in turn
  for (const px of PADS) if (seen(px - 30, px + 30, cx)) for (let i = 0; i < 4; i++) { const on = (Math.floor(t / 10) + i) % 4 === 0; R(px - 24 + i * 16, GY + 2, 2, 2, on ? CYANL : '#1f5f78'); if (on) glow(ctx, px - 23 + i * 16, GY + 3, 5, CYAN, 0.5); }
  // somebody is watching from a porthole
  for (const [px, kind] of PORTS) {
    if (kind !== 3 || !seen(px - 10, px + 10, cx)) continue;
    const ph = (t + (px - 4176) * 3 + 4200) % 400, py = GY + 29;
    if (ph >= 290) continue;
    const f = ph < 5 || ph >= 285 ? 0 : ph < 10 || ph >= 280 ? 1 : 2;
    ctx.drawImage(A.peek[f], px - 4, py - 4);
    if (f === 2) { const ix = px - 1 + ((t + px) % 120 < 60 ? 0 : 1); R(ix, py - 1, 2, 2, IRIS); R(ix, py, 1, 1, PUP); }
  }
}
function plat(pl) {
  const s = platSprite(pl);
  ctx.drawImage(s.c, pl.x - s.ox, pl.y - s.oy);
  if (pl.t === 'tower') lamp(ctx, pl.x + pl.w - 6, pl.y - 18, CYAN, (G.t + 11) % 80 < 44, 5);
}
function front(cx) {
  stripDraw(ctx, A.front, cx);
  const off = Math.round((cx - REF) * FRONT_P), on = (G.t + 10) % 60 < 34;
  for (const [kind, o] of FRONTS) {
    if (kind !== 'pump') continue;
    const x = o + 12 - off;
    if (x < -10 || x > W + 10) continue;
    if (on) glow(ctx, x + 1, 236, 6, CYAN, 0.5);
    R(x, 235, 2, 2, on ? CYANL : '#1f5f78');
  }
}
// called at globalAlpha = this area's backdrop weight
function overlay(cx) {
  const ga = ctx.globalAlpha, t = G.t, eo = Math.round((cx - REF) * EARTH_P);
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(A.shine, -60 - eo, 40); ctx.globalCompositeOperation = 'source-over';
  // specks of ice drifting past, slowly
  ctx.fillStyle = '#c8d8ff';
  for (let i = 0; i < 9; i++) {
    const x = ((hs(i * 3.1) * 560 - cx * (0.3 + hs(i) * 0.3) - t * (0.05 + hs(i * 2.3) * 0.06)) % (W + 20) + W + 20) % (W + 20) - 10;
    const y = 44 + hs(i * 7.7) * 150 + Math.sin(t * 0.008 + i) * 4;
    ctx.globalAlpha = ga * (0.25 + 0.25 * Math.sin(t * 0.05 + i * 2));
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  ctx.globalAlpha = ga;
}

L5ART.space = { x0: AX0, x1: AX1, steps, bg, behind, ground, plat, front, overlay };
}
