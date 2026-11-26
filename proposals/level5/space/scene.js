'use strict';
// =====================================================================================================================
// MISSION 5 "ALIEN MOTHERSHIP" - proposal frame for AREA 3: SPACE WALK (painter key: space). A mock screenshot, not
// game content: a harness fixture loaded after proposals/level5/kit.js. It pushes a temporary mission 5 built around
// one camera position (CAM) and registers what the frame shows:
//   RIDES.miniufo        the stolen MINI UFO: silver-white saucer, red stripe, yellow star sticker, glass bubble with
//                        the hero inside, a CYAN grab beam underneath, a nose blaster firing YELLOW laser bolts.
//                        HUD panel: MINI UFO, 5 armour pips, beam-charge bar.
//   ENEMY_TYPES.m5ssaucer / m5soggle / m5sroly   the kit's robots holding staged poses (burst, warn, bubble helmet,
//                        held in the beam)
//   EB_TYPES.m5smeteor   a meteor with its landing marker (blinking ring + red ! + dotted line)
//   POW_KINDS.m5scow     the kit's cow pod with its MOO! bubble
// Scenery (all painted pixel by pixel into buffers once, blitted with parallax): space + nebula + stars, the Moon,
// the EARTH (an orthographic globe with a real map: Europe and North Africa, a ping on Vigo, the night side with
// city lights), the far parts of the mothership (the STAR GARDEN dome, a tower, the big engine fin with the robots'
// eye emblem), the deck's back row (lattice tower, hatch, vent, dish, solar panels), the hull deck, low foreground.
// Live bits use the scene's frame clock T and hsh() only: no Math.random / rand(). Blinks are authored round frame
// F0 (= --frames 90), so every warning lamp, the ! marks and the meteor ring are 'on' in the picture.
//   node tools/harness/harness.mjs render --level 5 --x 4088 --frames 90 --hero 0 --god --scale 3 \
//     --extra proposals/level5/kit.js --extra proposals/level5/space/scene.js --out proposals/level5/space/space.png
// =====================================================================================================================
{
const PAL = M5.PAL, S = PAL.S, GRN = PAL.G;
const { NONE, I, buf, put, get, rect, shape, oval, ball, line, inPoly, poly, outline, bake, mk, blit, canvasOf } = M5.px;

// --------------------------------------------------------------------------------------------------------- constants
const CAM = 3900;                  // camera x of the frame (world). Design coordinates below = screen x at this camera
const GY = 212;                    // the deck: where feet stand
const MG = 40;                     // strip margin
const F0 = 90;                     // the frame the picture is taken at (--frames 90): staged blinks are 'on' there
const UX = 188, UY = 124;          // the MINI UFO: centre of its disc
const GUN_A = 0.21;                // nose blaster: radians up from forward
const HELD = { x: 190, y: 197 };   // the roly eye held in the beam (its floor point)
const SA = { x: 300, y: 103 };     // eye saucer A: bursting
const SB = { x: 374, y: 88 };      // eye saucer B: warning (!)
const SC = { x: 340, y: 141 };     // eye saucer C: cruising
const OGX = 316, ROLX = 84;        // the oggle in its bubble helmet, a roly eye on the deck
const MTX = 386;                   // where the meteor will land
const METEOR = { x: 407, y: 124 }; // the meteor (centre of the rock)
const PODX = 450;                  // the cow pod

let T = F0;                        // frames since load
const cyc = (n, off = 0) => (((T - F0 + off) % n) + n) % n;      // 0 at the picture frame

// ----------------------------------------------------------------------------------------------------------- helpers
const D2R = Math.PI / 180;
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const h2 = (x, y, s) => hsh(x * 12.9898 + y * 78.233 + s * 37.719);
function vn2(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return lerp(lerp(h2(i, j, s), h2(i + 1, j, s), a), lerp(h2(i, j + 1, s), h2(i + 1, j + 1, s), a), b);
}
function fbm2(x, y, s, oct = 4) { let v = 0, a = 1, n = 0, f = 1; for (let o = 0; o < oct; o++) { v += a * vn2(x * f, y * f, s + o * 13); n += a; a *= 0.5; f *= 2.03; } return v / n; }
const rgbI = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
function mixI(a, b, k) { const A = rgbI(a), B = rgbI(b); return (Math.round(lerp(A[0], B[0], k)) << 16) | (Math.round(lerp(A[1], B[1], k)) << 8) | Math.round(lerp(A[2], B[2], k)); }
const rgba = (c, a) => { const v = rgbI(typeof c === 'string' ? I(c) : c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')'; };
// ordered dithering: pick from a ramp (dark -> light) by v in 0..1
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
function dith(ramp, v, x, y) { const n = ramp.length - 1, f = clamp(v, 0, 1) * n, i = Math.floor(f); return ramp[Math.min(n, i + (f - i > bay(x, y) ? 1 : 0))]; }
// the same with narrow dither bands: flat areas of colour, a short dithered step between them
function dithS(ramp, v, x, y, sharp = 3) { const n = ramp.length - 1, f = clamp(v, 0, 1) * n, i = Math.floor(f); return ramp[Math.min(n, i + (clamp((f - i - 0.5) * sharp + 0.5, 0, 1) > bay(x, y) ? 1 : 0))]; }
// crisp discs and rings for the live bits (rows of rects, never arc())
function pdisc(x, y, r, c) { ctx.fillStyle = c; x = Math.round(x); y = Math.round(y); for (let j = -r; j <= r; j++) { const hw = Math.floor(Math.sqrt(r * r - j * j + r * 0.8)); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); } }
function pring(x, y, rx, ry, c, n = 72) { ctx.fillStyle = c; for (let a = 0; a < n; a++) { const t = a / n * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(t) * rx), Math.round(y + Math.sin(t) * ry), 1, 1); } }
// a bar at angle a (radians up from +x) rasterised into a buffer: t along, s across
function bar(b, a, t0, t1, s0, s1, c) {
  const ca = Math.cos(a), sa = Math.sin(a);
  for (let t = t0; t <= t1 + 1e-6; t += 0.25) for (let s = s0; s <= s1 + 1e-6; s += 0.25) put(b, t * ca + s * sa, -t * sa + s * ca, c);
}
// steel parts lit from the left (the sun is off-screen left): t = tone index into the ship's steel ramp
function box(b, x, y, w, h, t) {
  rect(b, x, y, w, h, S[t]); rect(b, x, y, w, 1, S[t + 1]); rect(b, x, y, 1, h, S[t + 1]);
  rect(b, x + w - 1, y + 1, 1, h - 1, S[t - 1]); rect(b, x, y + h - 1, w, 1, S[t - 1]);
}
function tube(b, x, y, w, h, t) { for (let i = 0; i < w; i++) { const k = i / Math.max(1, w - 1); rect(b, x + i, y, 1, h, S[k < 0.15 ? t : k < 0.45 ? t + 1 : k < 0.72 ? t : t - 1]); } }
function htube(b, x, y, w, h, t) { for (let j = 0; j < h; j++) { const k = j / Math.max(1, h - 1); rect(b, x, y + j, w, 1, S[k < 0.3 ? t + 1 : k < 0.7 ? t : t - 1]); } }

// a strip of scenery in design coordinates, drawn with parallax p
function strip(top, bot, p, fn, x0 = -MG, x1 = W + MG) { const b = buf(x1 - x0, bot - top, -x0, -top); fn(b); return { c: bake(b), top, x0, p }; }
function drawStrip(L, cx) { ctx.drawImage(L.c, L.x0 - Math.round((cx - CAM) * L.p), L.top); }

// ------------------------------------------------------------------------------------------------------------- space
const NEB = { x: 176, y: -6, dx: 0.889, dy: 0.457 };          // the axis of the faint nebula band
function paintSpace(b) {
  const RAMP = ['#05040d', '#07061a', '#0b0a1c', '#0f0d26', '#141230', '#19153b', '#1f1a46', '#2a1b52', '#381f5c', '#47225f'].map(I);
  for (let y = -10; y < H + 10; y++) for (let x = -MG; x < W + MG; x++) {
    const dist = -(x - NEB.x) * NEB.dy + (y - NEB.y) * NEB.dx, along = (x - NEB.x) * NEB.dx + (y - NEB.y) * NEB.dy;
    const g = Math.exp(-(dist * dist) / (2 * 32 * 32)) * ss(-90, 70, along);
    const n = fbm2(x * 0.019 + 3, y * 0.027, 3, 4), n2 = fbm2(x * 0.045 + 20, y * 0.05, 12, 3);
    let v = 0.05 + 0.08 * ss(20, 270, y) + g * (0.1 + 0.6 * ss(0.28, 0.7, n) + 0.34 * ss(0.45, 0.8, n2) * ss(0.4, 0.7, n));
    v -= g * 0.3 * ss(0.5, 0.72, fbm2(x * 0.05 + 9, y * 0.018 - 4, 8, 3));          // dark dust lanes
    put(b, x, y, dithS(RAMP, v, x, y, 1.6));
  }
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
  const TINTS = [PAL.CYANL, PAL.MAGL, PAL.AMBL, '#c8d0ff'];
  for (let i = 0; i < 300; i++) {
    const x = hsh(i * 3.17 + 1) * (W + 2 * MG) - MG, y = hsh(i * 7.71 + 2) * 236 - 6, q = hsh(i * 5.3 + 3);
    star(x, y, q < 0.52 ? 0 : q < 0.82 ? 1 : q < 0.93 ? 2 : q < 0.985 ? 3 : 4, q < 0.82 ? hsh(i * 9.1) > 0.7 : TINTS[i % 4]);
  }
  for (let i = 0; i < 190; i++) {                              // the band is thick with faint stars
    const t = hsh(i * 2.3 + 40) * 420 - 60, d = (hsh(i * 4.9 + 41) - 0.5), q = hsh(i * 6.1 + 42);
    star(NEB.x + NEB.dx * t - NEB.dy * d * d * d * 320, NEB.y + NEB.dy * t + NEB.dx * d * d * d * 320, q < 0.7 ? 0 : q < 0.95 ? 1 : 2, q > 0.4);
  }
}
// the stars that twinkle (live): [x, y, period, tint]
const TWINK = [[52, 46, 70, '#ffffff'], [254, 70, 90, PAL.CYANL], [448, 46, 60, '#ffffff'], [296, 172, 80, PAL.MAGL], [142, 86, 110, PAL.AMBL], [406, 150, 75, '#ffffff'], [226, 148, 95, '#ffffff']];
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
// An orthographic globe: centre (EARTH.x, EARTH.y), radius r, the point under the camera at LAT0 / LON0 (over the
// Atlantic off West Africa), north up. The visible dome shows Europe and North Africa; the sun is off-screen left, so
// the east (right) is in the evening.
const EARTH = { x: 10, y: 350, r: 260 };
const LAT0 = -8 * D2R, LON0 = -20 * D2R, SL0 = Math.sin(LAT0), CL0 = Math.cos(LAT0);
const SUN = (() => { const v = [-0.72, 0.18, 0.67], n = Math.hypot(v[0], v[1], v[2]); return v.map(a => a / n); })();
function geoAt(dx, dy, nz) { return [(LON0 + Math.atan2(dx, nz * CL0 - dy * SL0)) / D2R, Math.asin(clamp(nz * SL0 + dy * CL0, -1, 1)) / D2R]; }
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
const inAny = (A, lon, lat) => { for (const L of A) if (lon >= L.x0 && lon <= L.x1 && lat >= L.y0 && lat <= L.y1 && inPoly(L.p, lon, lat)) return true; return false; };
const isLand = (lon, lat) => inAny(LANDS, lon, lat) && !inAny(LAKES, lon, lat);
// mountain ranges: [lon, lat, radius in degrees, snow]
const MTS = [[9.6, 46.5, 3.0, 1], [0.4, 42.6, 1.7, 1], [-5.0, 43.0, 1.6, 0], [-3.2, 37.1, 1.0, 0], [-4.2, 40.4, 1.5, 0], [-5.0, 32.2, 3.4, 0], [3.0, 34.6, 2.4, 0], [24.5, 46.0, 2.6, 0], [18.0, 44.0, 2.0, 0], [13.5, 42.4, 1.6, 0], [9.0, 61.5, 3.6, 1], [16.0, 67.0, 3.2, 1], [35.0, 39.0, 4.5, 0], [43.0, 42.6, 2.8, 1], [-4.6, 57.0, 1.3, 0], [-18.5, 64.8, 1.7, 1], [22.0, 39.6, 1.5, 0]];
function mountain(lon, lat) {
  let m = 0, sn = 0; const cl = Math.cos(lat * D2R);
  for (const [x, y, r, s] of MTS) { const d = Math.hypot((lon - x) * cl, lat - y) / r; if (d < 1 && 1 - d > m) { m = 1 - d; sn = s; } }
  return [m, sn];
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
function paintEarth(b, X0, X1, Y0, Y1) {
  const E = EARTH, w = X1 - X0, h = Y1 - Y0, CT = 0.6;
  const kind = new Uint8Array(w * h), cl = new Float32Array(w * h), lam = new Float32Array(w * h), nzA = new Float32Array(w * h), lo = new Float32Array(w * h), la = new Float32Array(w * h);
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const dx = (x + 0.5 - E.x) / E.r, dy = (E.y - y - 0.5) / E.r, d2 = dx * dx + dy * dy, i = (y - Y0) * w + (x - X0);
    if (d2 >= 1) continue;
    const nz = Math.sqrt(1 - d2), g = geoAt(dx, dy, nz), lon = g[0], lat = g[1];
    const jl = lon + (fbm2(lon * 1.9, lat * 1.9, 31, 2) - 0.5) * 0.3, jt = lat + (fbm2(lon * 1.9 + 40, lat * 1.9, 32, 2) - 0.5) * 0.24;
    kind[i] = isLand(jl, jt) ? 2 : 1; cl[i] = cloudAt(lon, lat); lam[i] = dx * SUN[0] + dy * SUN[1] + nz * SUN[2]; nzA[i] = nz; lo[i] = lon; la[i] = lat;
  }
  const at = (arr, x, y) => (x < X0 || x >= X1 || y < Y0 || y >= Y1) ? 0 : arr[(y - Y0) * w + (x - X0)];
  const OCEAN = ['#0a1a56', '#0d2c84', '#1243ac', '#1a5ccb', '#2979e0', '#459aef', '#6bb6f6'].map(I);
  const SAND = ['#8f6238', '#b98347', '#d9a55f', '#eec686', '#f7dca6'].map(I);
  const TAN = ['#57433a', '#7a5f44', '#9c7d4f', '#b89760', '#cdb077'].map(I);
  const TUND = ['#6f7088', '#9ea2ba', '#cdd3e4', '#f0f4fb'].map(I);
  const CLOUD = ['#a9c2e6', '#dbe8f8', '#ffffff'].map(I), WARM = ['#a85a78', '#f09a7a', '#ffd2ae'].map(I);
  const AIR = ['#3b86e0', '#62aaf0', '#98d0fa'].map(I);
  const HV = [SUN[0], SUN[1], SUN[2] + 1], hn = Math.hypot(HV[0], HV[1], HV[2]);
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const i = (y - Y0) * w + (x - X0), k = kind[i];
    if (!k) continue;
    const L = lam[i], nz = nzA[i], lon = lo[i], lat = la[i], c = cl[i];
    const day = clamp((L + 0.025) / 0.07, 0, 1), lit = clamp(L, 0, 1), shadow = at(cl, x - 2, y - 2) > CT ? 0.16 : 0;
    let dayC, nightC;
    if (c > CT) {                                                                    // clouds, lit from the upper left
      const up = at(cl, x - 1, y - 1) > CT, dn = at(cl, x + 1, y + 1) > CT;
      const ci = !up ? 2 : !dn ? 0 : c > CT + 0.06 ? 2 : 1;
      dayC = L < 0.07 ? WARM[ci] : CLOUD[ci]; nightC = I('#121a3c');
    } else if (k === 2) {                                                            // land: tan, sand, rock, snow
      let d = ss(38.6, 33.6, lat);
      if (lon > 28) d = Math.max(d, 0.6 * ss(28, 36, lon) * ss(43, 39, lat));
      const tex = fbm2(lon * 0.8, lat * 0.8, 21, 3);
      let v = 0.2 + 0.6 * tex;
      const sl = at(kind, x - 1, y) === 1 || at(kind, x, y - 1) === 1, sr = at(kind, x + 1, y) === 1 || at(kind, x, y + 1) === 1;
      if (sl) v += 0.22; else if (sr) v -= 0.2;
      v = v * (0.3 + 0.7 * clamp(L * 2.4, 0, 1)) - shadow;
      dayC = dithS(bay(x + 2, y + 1) < d ? SAND : TAN, v, x, y, 2.4);
      if (lat > 60 && bay(x + 1, y + 3) < ss(60, 67, lat)) dayC = dithS(TUND, v + 0.15, x, y, 2.4);
      const mt = mountain(lon, lat);
      if (mt[0] > 0.2) {
        const ridge = fbm2(lon * 2.4, lat * 2.4, 71, 3), q = mt[0] * 0.7 + ridge * 0.6;
        if (q > 0.7) dayC = mt[1] && q > 0.84 ? I('#f4f7ff') : ridge > 0.54 ? I('#6a4f3c') : I('#7d5f44');
      }
      nightC = I('#0b0c20');
      if (L < 0.0 && lat > 35 && lat < 61 && fbm2(lon * 0.7, lat * 0.9, 51, 2) > 0.52 && h2(x, y, 52) > 0.74) nightC = I(h2(x, y, 53) > 0.8 ? '#fff2a8' : '#ffb84a');
    } else {                                                                         // ocean
      const spec = Math.pow(Math.max(0, ((x + 0.5 - E.x) / E.r * HV[0] + (E.y - y - 0.5) / E.r * HV[1] + nz * HV[2]) / hn), 50);
      let v = 0.16 + 0.48 * lit + (fbm2(lon * 0.2, lat * 0.3, 61, 3) - 0.5) * 0.3 + spec * 0.5 - shadow;
      if (at(kind, x - 1, y) === 2 || at(kind, x + 1, y) === 2 || at(kind, x, y - 1) === 2 || at(kind, x, y + 1) === 2) v += 0.2;
      dayC = dithS(OCEAN, v, x, y, 3.2);
      nightC = I('#050a22');
    }
    const fres = 1 - nz;                                                             // the air thickens toward the limb
    if (fres > 0.74) {
      const hk = (fres - 0.74) / 0.26;
      if (bay(x + 1, y) < hk * 1.1 - 0.1) { dayC = L < 0.12 && hk > 0.4 ? I(hk > 0.75 ? '#ffb48a' : '#d0708a') : AIR[hk > 0.7 ? 2 : hk > 0.36 ? 1 : 0]; if (nightC === I('#050a22') || hk > 0.5) nightC = I(hk > 0.7 ? '#142a66' : '#0b1640'); }
    }
    if (day < 1 && day > 0) dayC = mixI(dayC, 0x2a1c4c, (1 - day) * 0.45);
    put(b, x, y, day >= 1 ? dayC : day <= 0 ? nightC : bay(x, y) < day ? dayC : nightC);
  }
  // the atmosphere's rim: one bright line just outside the limb on the lit side, a blue fringe beyond it
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const dx = x + 0.5 - E.x, dy = E.y - y - 0.5, d = Math.hypot(dx, dy);
    if (d < E.r || d > E.r + 2.6) continue;
    const day = clamp(((dx * SUN[0] + dy * SUN[1]) / d + 0.06) / 0.2, 0, 1);
    if (d < E.r + 1.3) put(b, x, y, day > 0.7 ? '#d6f1ff' : day > 0.25 ? '#ffb89a' : '#1a3478');
    else if (day > 0.7 ? bay(x, y) < 0.62 : day > 0.25 ? bay(x, y) < 0.4 : false) put(b, x, y, day > 0.7 ? '#4f96e8' : '#8a4a72');
  }
}
// the soft glow of the air round the lit limb (RGBA, drawn with 'lighter')
function earthHalo(X0, X1, Y0, Y1) {
  const w = X1 - X0, h = Y1 - Y0, c = canvasOf(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data, E = EARTH;
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const dx = x + 0.5 - E.x, dy = E.y - y - 0.5, r = Math.hypot(dx, dy) - E.r;
    if (r < -10 || r > 22) continue;
    const day = clamp(((dx * SUN[0] + dy * SUN[1]) / (r + E.r) + 0.06) / 0.4, 0, 1);
    const a = (r > 0 ? 0.5 * Math.exp(-r / 6) : 0.3 * Math.exp(r / 3.5)) * day, i = ((y - Y0) * w + (x - X0)) * 4;
    d[i] = 90; d[i + 1] = 170; d[i + 2] = 255; d[i + 3] = Math.round(255 * a);
  }
  g.putImageData(im, 0, 0);
  return c;
}

// --------------------------------------------------------------------------------------- the far parts of the mothership
const FIN_LE = [[402, 178], [413, 150], [425, 120], [436, 94], [444, 77], [449, 68], [453, 64.5]];      // its leading edge
const FIN = [...FIN_LE, [458, 64], [462, 67], [464, 76], [466, 110], [469, 178]];
function finEdge(y) { for (let i = 0; i + 1 < FIN_LE.length; i++) { const a = FIN_LE[i], b = FIN_LE[i + 1]; if (y <= a[1] && y >= b[1]) return a[0] + (b[0] - a[0]) * (a[1] - y) / (a[1] - b[1]); } return 453; }
const farTop = x => 213 - 50 * ss(196, 540, x);
function paintFarA(b) {
  const body = I('#191735'), lite = I('#232246'), dark = I('#100e24'), rim = I('#343664'), win = [I('#2f7a98'), I('#8a681e'), I('#782a5c')];
  const sil = (x, y, w, h) => { rect(b, x, y, w, h, body); rect(b, x, y, 1, h, rim); rect(b, x + 1, y, w - 1, 1, lite); rect(b, x + w - 1, y + 1, 1, h - 1, dark); };
  // the engine fin: a swept blade, its leading edge catching the sun
  const fin = I('#1b1a3a'), finL = I('#252650'), finR = I('#3c4278'), finRR = I('#5560a0');
  poly(b, FIN, (x, y) => {
    const e = x - finEdge(y);                                  // distance behind the leading edge
    if (e < 1.5 || y < 65.5) return finRR;
    if (e < 3) return finR;
    if (y > 82 && y < 95) return y < 84 || y > 93 ? dark : ((Math.floor(x + y * 0.5) >> 2) & 1) ? I('#6a5222') : I('#17152e');   // dim hazard band
    if (x > 466.5 - (178 - y) * 0.03) return dark;
    const em = Math.hypot(x - 449.5, y - 119.5);
    if ((em > 6 && em < 8.2) || em < 2.6) return finR;
    if (Math.floor(e) % 12 === 11) return dark;
    return e > 30 ? fin : finL;
  });
  for (let y = 138; y < 172; y += 11) rect(b, 446 + Math.round((178 - y) * 0.06), y, 4, 1, win[0]);
  // the engine under it: a long nacelle with ring bands
  for (let x = 372; x < W + MG; x++) for (let y = 170; y < 196; y++) {
    const k = (y - 170) / 25, e = x < 384 ? Math.abs(k - 0.5) > 0.5 * Math.sqrt(Math.max(0, 1 - ((384 - x) / 12) ** 2)) : false;
    if (e) continue;
    put(b, x, y, (x - 372) % 17 === 16 ? dark : k < 0.12 ? rim : k < 0.42 ? lite : k < 0.75 ? body : dark);
  }
  // towers and a dome on the far hull
  sil(322, 150, 20, 40); sil(327, 138, 10, 12); rect(b, 331, 124, 1, 14, rim); rect(b, 329, 130, 5, 1, lite);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) if (h2(i, j, 81) > 0.35) rect(b, 326 + i * 5, 154 + j * 7, 2, 1, win[(i + j) % 3]);
  shape(b, 262, 172, 300, 196, (x, y) => ((x - 281) / 17) ** 2 + ((y - 190) / 13) ** 2 <= 1, (x, y) => { const d = ((x - 281) / 17) ** 2 + ((y - 190) / 13) ** 2; return d > 0.82 ? (x < 276 ? I('#4a5490') : rim) : (Math.floor(x) - 281) % 7 === 0 ? I('#2a2452') : bay(x, y) < 0.3 + (y - 178) / 30 ? I('#5a2a6a') : I('#33204f'); });
  rect(b, 236, 190, 1, 14, rim); rect(b, 234, 194, 5, 1, lite); rect(b, 247, 184, 1, 18, rim); rect(b, 245, 189, 5, 1, lite);
  sil(504, 150, 14, 30);
  // the far hull itself: a long back rising to the right, bands of plating, a few lit windows
  for (let x = -MG; x < W + MG; x++) {
    const t = farTop(x);
    for (let y = Math.ceil(t); y < GY + 6; y++) {
      const d = y - t;
      put(b, x, y, d < 1 ? rim : d < 2 && bay(x, y) < 0.5 ? rim : (d > 7 && d < 8.2) || (d > 17 && d < 18.2) ? dark : d < 7 ? lite : body);
    }
    if (x > 214 && x % 7 === 3 && h2(x, 1, 82) > 0.45) put(b, x, Math.round(t + 4), win[x % 3]);
    if (x > 250 && x % 9 === 4 && h2(x, 2, 82) > 0.5) put(b, x, Math.round(t + 12), win[(x >> 1) % 3]);
  }
}
const nearTop = x => 214 - 24 * ss(296, 540, x);
function paintFarB(b) {
  const body = I('#201f42'), lite = I('#292a52'), dark = I('#17152e'), rim = I(S[4]), win = [I('#3a9cc0'), I('#b08a22'), I('#a03a78')];
  // a gantry and a tank standing on the nearer ridge
  rect(b, 428, 170, 2, 30, lite); rect(b, 452, 170, 2, 28, lite); rect(b, 424, 168, 34, 3, body); rect(b, 424, 168, 34, 1, rim); rect(b, 440, 171, 1, 8, lite); rect(b, 438, 179, 5, 3, body);
  line(b, 429, 172, 452, 196, lite); line(b, 453, 172, 430, 198, dark);
  shape(b, 362, 186, 384, 206, (x, y) => ((x - 373) / 10) ** 2 + ((y - 198) / 10) ** 2 <= 1, (x, y) => x < 366 ? rim : y < 192 ? lite : body);
  rect(b, 372, 181, 1, 8, lite);
  for (let x = -MG; x < W + MG; x++) {
    const t = nearTop(x);
    for (let y = Math.ceil(t); y < GY + 6; y++) { const d = y - t; put(b, x, y, d < 1 ? (bay(x, y) < 0.7 ? rim : lite) : d < 4 ? lite : (x + 400) % 26 === 0 ? dark : body); }
    if (x > 306 && x % 6 === 2 && h2(x, 3, 83) > 0.4) rect(b, x, Math.round(t + 6), 2, 1, win[(x >> 2) % 3]);
  }
}

// -------------------------------------------------------------------------- the deck's back row (behind the play lane)
function lattice(b, x, base, top) {
  const hw = y => 3 + 7 * (y - top) / (base - top);
  for (let y = top, k = 0; y < base - 3; k++) {
    const y2 = Math.min(base, y + 10 + k * 2);
    line(b, x - hw(y), y, x + hw(y2), y2, I(S[3])); line(b, x + hw(y), y, x - hw(y2), y2, I(S[4]));
    rect(b, Math.round(x - hw(y)), y, Math.round(hw(y) * 2) + 1, 1, S[4]);
    y = y2;
  }
  for (let y = top; y < base; y++) { const w = hw(y); put(b, x - w, y, S[6]); put(b, x - w + 1, y, S[4]); put(b, x + w, y, S[3]); put(b, x + w - 1, y, S[2]); }
  box(b, x - 9, top + 30, 19, 3, 4); rect(b, x - 9, top + 27, 1, 3, S[4]); rect(b, x + 9, top + 27, 1, 3, S[3]); rect(b, x - 9, top + 27, 19, 1, S[3]);
  box(b, x - 4, top - 3, 9, 4, 4); rect(b, x, top - 17, 1, 14, S[5]); rect(b, x - 2, top - 9, 5, 1, S[4]); rect(b, x - 1, top - 13, 3, 1, S[4]);
  box(b, x - 6, base - 5, 13, 5, 3);
}
// a dish antenna looking along (px, py): the rim ellipse (a across, c deep on screen), the shell behind it, the feed
function dish(b, cx, cy, a, c, px, py, depth) {
  const mx = -py, my = px;
  for (let y = Math.floor(cy - a - depth); y <= cy + a + depth; y++) for (let x = Math.floor(cx - a - depth); x <= cx + a + depth; x++) {
    const rx = x + 0.5 - cx, ry = y + 0.5 - cy, u = rx * mx + ry * my, v = rx * px + ry * py;
    const face = (u / a) ** 2 + (v / c) ** 2;
    if (face <= 1) {                                           // the concave face: its far side catches the light
      const lit = rx / a * 0.8 - ry / a * 0.3 + 0.1;
      let col = dith([S[2], S[3], S[4], S[5], S[6]].map(I), 0.5 + lit * 0.6, x, y);
      if (face > 0.8) col = I(ry < 0 || rx < 0 ? S[7] : S[5]);
      else if (Math.abs(face - 0.34) < 0.05) col = I(S[3]);
      put(b, x, y, col);
    } else if (v < 0 && (u / a) ** 2 + (v / depth) ** 2 <= 1) { // the shell behind the rim
      const k = rx / a;
      put(b, x, y, Math.abs(Math.abs(u) - a * 0.5) < 0.6 ? S[2] : k < -0.55 ? S[5] : k < 0.1 ? S[4] : k < 0.6 ? S[3] : S[2]);
    }
  }
  const fx = cx + px * (c + a * 0.62), fy = cy + py * (c + a * 0.62);      // the feed horn on three struts
  line(b, cx + mx * a * 0.8, cy + my * a * 0.8, fx, fy, I(S[5])); line(b, cx - mx * a * 0.8, cy - my * a * 0.8, fx, fy, I(S[4])); line(b, cx, cy, fx, fy, I(S[3]));
  rect(b, Math.round(fx) - 1, Math.round(fy) - 1, 3, 3, S[6]);
  return [Math.round(fx), Math.round(fy)];
}
const CELL = ['#131d56', '#1a2b78', '#243e9c', '#3558c4'].map(I);
function solar(b, x, y, w, h, sk) {                            // lower left corner at (x, y); the top leans sk to the right
  for (let j = 0; j < h; j++) {
    const off = Math.round(sk * (1 - j / (h - 1)));
    for (let i = 0; i < w; i++) {
      const X = x + i + off, Y = y - h + 1 + j, fr = i === 0 || j === 0 || i === w - 1 || j === h - 1, grid = i % 9 === 0 || j % 7 === 0;
      const gl = Math.abs((i + j * 1.6) - (w * 0.62)) < 3.2;   // the sun's glint: a diagonal band
      put(b, X, Y, fr ? I(i === 0 || j === 0 ? S[6] : S[4]) : grid ? I(S[2]) : gl ? I(bay(X, Y) < 0.55 ? '#6f9cf0' : '#3558c4') : dith(CELL, 0.25 + 0.55 * (1 - j / h) + (i / w) * 0.2, X, Y));
    }
  }
}
function lamppost(b, x, hgt) { rect(b, x, GY - hgt, 1, hgt, S[4]); rect(b, x - 1, GY - 3, 3, 3, S[3]); rect(b, x - 2, GY - hgt - 1, 5, 2, S[5]); rect(b, x - 2, GY - hgt, 5, 1, S[3]); }
const LAMPS = [[64, 22], [222, 24], [300, 20], [476, 26]];     // posts with a cyan lamp on top (lamp drawn live)
const DISH = { x: 258, y: 170 };
let DISH_FEED = [0, 0];
function paintMid(b) {
  // far left: the lattice tower with its red beacon, a little dish on its platform
  lattice(b, 20, GY, 128);
  box(b, 27, 147, 7, 9, 4); rect(b, 28, 149, 5, 1, S[2]); rect(b, 28, 152, 5, 1, S[2]);
  // lamp posts
  for (const [x, hg] of LAMPS) lamppost(b, x, hg);
  // a deck hatch: a low dome with a hazard collar and a hand wheel
  shape(b, 108, GY - 11, 136, GY, (x, y) => ((x - 122) / 13) ** 2 + ((y - GY) / 10) ** 2 <= 1, (x, y) => I(x < 113 ? S[6] : y < GY - 7 ? S[5] : x > 130 ? S[3] : S[4]));
  for (let x = 108; x < 137; x++) { put(b, x, GY - 2, ((x - 108) >> 2) & 1 ? '#22222c' : PAL.AMB); put(b, x, GY - 1, ((x - 108) >> 2) & 1 ? '#22222c' : '#c98a16'); }
  rect(b, 118, GY - 13, 9, 2, S[6]); rect(b, 122, GY - 12, 1, 3, S[3]); rect(b, 118, GY - 12, 9, 1, S[4]);
  // a vent stack
  box(b, 150, GY - 12, 10, 12, 3); rect(b, 149, GY - 14, 12, 2, S[5]); rect(b, 149, GY - 13, 12, 1, S[3]);
  for (let j = 0; j < 3; j++) rect(b, 152, GY - 9 + j * 3, 6, 1, S[1]);
  // the big dish, looking up and left at the Earth
  tube(b, DISH.x - 4, DISH.y + 6, 9, GY - DISH.y - 6, 4);
  box(b, DISH.x - 9, GY - 7, 19, 7, 3); rect(b, DISH.x - 9, GY - 7, 19, 1, S[5]);
  box(b, DISH.x - 6, DISH.y + 4, 13, 6, 4);
  DISH_FEED = dish(b, DISH.x, DISH.y, 22, 9, -0.5, -0.866, 12);
  // two solar panels on masts, tilted at the sun
  for (const x of [348, 392]) {
    rect(b, x + 17, GY - 16, 2, 16, S[4]); rect(b, x + 18, GY - 16, 1, 16, S[2]); rect(b, x + 13, GY - 3, 10, 3, S[3]); rect(b, x + 13, GY - 3, 10, 1, S[5]);
    solar(b, x, GY - 14, 32, 23, 8);
  }
  // crates of ship parts by the pod, a small dish at the right edge
  box(b, 470, GY - 9, 14, 9, 3); box(b, 484, GY - 15, 12, 15, 4);
  rect(b, 502, GY - 26, 2, 26, S[4]); dish(b, 503, GY - 30, 9, 4, -0.5, -0.866, 5);
}

// ------------------------------------------------------------------------------------------------- the deck (the hull)
const PORTS = [100, 276, 436];
const HATCH = { x: 352, y: GY + 34, r: 11 };
function paintDeck(b) {
  const X0 = -MG, X1 = W + MG, FACE = [S[1], S[2], S[3], S[3], S[4]].map(I);
  for (let x = X0; x < X1; x++) {
    put(b, x, GY, S[7]); put(b, x, GY + 1, S[6]); put(b, x, GY + 2, S[5]); put(b, x, GY + 3, S[4]); put(b, x, GY + 4, S[1]);
    for (let y = GY + 5; y < GY + 14; y++) put(b, x, y, y === GY + 5 ? S[5] : y === GY + 13 ? S[2] : y === GY + 6 ? S[4] : S[3]);
    put(b, x, GY + 14, S[1]);
    for (let y = GY + 15; y < GY + 18; y++) put(b, x, y, S[0]);
    put(b, x, GY + 18, S[4]);
    for (let y = GY + 19; y < H + 10; y++) put(b, x, y, dithS(FACE, 0.86 - (y - GY - 19) / 50 - x / 1900, x, y, 1.8));
  }
  // the deck plates: seams, rivets
  for (let x = X0 + 6; x < X1; x += 32) {
    rect(b, x, GY + 6, 1, 7, S[1]); rect(b, x + 1, GY + 6, 1, 7, S[4]);
    put(b, x + 4, GY + 8, S[5]); put(b, x + 4, GY + 11, S[5]); put(b, x - 3, GY + 8, S[5]); put(b, x - 3, GY + 11, S[2]);
    for (let i = 0; i < 3; i++) { put(b, x + 12 + i * 4, GY + 9, S[4]); put(b, x + 13 + i * 4, GY + 10, S[4]); }      // tread marks
  }
  // hazard plates: under the cow pod, round the deck hatch
  for (const [x0, x1] of [[428, 474], [106, 138]]) {
    for (let x = x0; x < x1; x++) for (let y = GY + 6; y < GY + 13; y++) put(b, x, y, ((x + y) >> 2) & 1 ? (y === GY + 6 ? PAL.AMBL : PAL.AMB) : '#22222c');
    rect(b, x0 - 1, GY + 6, 1, 7, S[1]); rect(b, x1, GY + 6, 1, 7, S[1]);
  }
  // the magenta guide strip in its channel
  for (let x = X0; x < X1; x++) { const m = ((x % 24) + 24) % 24; if (m < 10) { put(b, x, GY + 16, m > 1 && m < 8 ? PAL.MAGL : PAL.MAG); put(b, x, GY + 15, '#7a2452'); put(b, x, GY + 17, '#7a2452'); } }
  // the hull's side: ribs, panel seams
  for (let x = X0 + 20; x < X1; x += 80) {
    rect(b, x, GY + 19, 1, 60, S[5]); rect(b, x + 1, GY + 19, 3, 60, S[3]); rect(b, x + 4, GY + 19, 1, 60, S[1]); rect(b, x + 5, GY + 19, 1, 60, S[0]);
    for (let y = GY + 23; y < H + 10; y += 9) { put(b, x + 2, y, S[5]); put(b, x + 2, y + 1, S[1]); }
    rect(b, x + 44, GY + 19, 1, 21, S[0]); rect(b, x + 45, GY + 19, 1, 21, S[3]);
  }
  for (let x = X0; x < X1; x++) if (get(b, x, GY + 40) !== I(S[5])) { put(b, x, GY + 40, S[0]); if (bay(x, 0) < 0.6) put(b, x, GY + 41, S[3]); }
  // portholes: thick rims, the ship's light inside
  for (const px of PORTS) {
    const cy = GY + 29;
    shape(b, px - 9, cy - 9, px + 9, cy + 9, (x, y) => (x - px) ** 2 + (y - cy) ** 2 <= 8.6 * 8.6, (x, y) => {
      const d = Math.hypot(x - px, y - cy), l = (-(x - px) - (y - cy)) / 8.6;
      if (d > 7.6) return I(S[0]);
      if (d > 5.2) return I(l > 0.5 ? S[7] : l > 0 ? S[6] : l > -0.5 ? S[4] : S[3]);
      if (d > 4.4) return I('#0a1230');
      return I(l > 0.45 ? '#bff2ff' : l > -0.1 ? '#5ac8e6' : l > -0.6 ? '#2a8fb8' : '#1c5f8c');
    });
    for (const [i, j] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) put(b, px + i, cy + j, S[5]);
  }
  // a vent, a plaque in the aliens' glyphs
  box(b, 150, GY + 23, 24, 12, 2); for (let j = 0; j < 4; j++) { rect(b, 152, GY + 25 + j * 2.5, 20, 1, S[0]); }
  rect(b, 194, GY + 22, 46, 13, '#0b1026'); rect(b, 194, GY + 22, 46, 1, S[4]); rect(b, 194, GY + 34, 46, 1, S[0]); rect(b, 194, GY + 22, 1, 13, S[4]); rect(b, 239, GY + 22, 1, 13, S[0]);
  const C = PAL.CYAN, CL = PAL.CYANL, gy = GY + 25;
  rect(b, 198, gy, 5, 7, C); rect(b, 199, gy + 1, 3, 5, '#0b1026'); put(b, 200, gy + 3, CL);                    // ring with a dot
  rect(b, 205, gy, 2, 7, C); rect(b, 209, gy, 2, 2, CL); rect(b, 209, gy + 5, 2, 2, C);                          // bar, two dots
  rect(b, 213, gy, 6, 2, C); rect(b, 213, gy + 5, 6, 2, C); rect(b, 215, gy + 2, 2, 3, CL);                      // an I beam
  rect(b, 221, gy + 2, 3, 3, CL); rect(b, 226, gy, 5, 7, C); rect(b, 227, gy + 1, 3, 5, '#0b1026'); rect(b, 228, gy + 1, 1, 5, C);   // dot, split ring
  rect(b, 233, gy, 2, 7, C); rect(b, 236, gy + 5, 2, 2, CL);
  // a round service hatch with a hazard ring and a hand wheel
  shape(b, HATCH.x - 14, HATCH.y - 14, HATCH.x + 14, HATCH.y + 14, (x, y) => (x - HATCH.x) ** 2 + (y - HATCH.y) ** 2 <= 13.4 * 13.4, (x, y) => {
    const dx = x - HATCH.x, dy = y - HATCH.y, d = Math.hypot(dx, dy), l = (-dx - dy) / 13, a = Math.atan2(dy, dx);
    if (d > 12.4) return I(S[0]);
    if (d > 10) return (Math.floor((a + Math.PI) / (Math.PI / 6)) & 1) ? I('#22222c') : I(l > 0 ? PAL.AMB : '#c98a16');
    if (d > 9) return I(S[1]);
    if (d > 4.6 && d < 6.2) return I(l > 0.1 ? S[7] : S[5]);
    if (d < 1.6) return I(S[6]);
    if (d < 4.6 && (Math.abs(dx) < 0.8 || Math.abs(dy) < 0.8)) return I(S[5]);
    return I(l > 0.35 ? S[5] : l > -0.3 ? S[4] : S[3]);
  });
  // pipes along the hull
  htube(b, X0, GY + 46, X1 - X0, 4, 4); rect(b, X0, GY + 50, X1 - X0, 1, S[0]);
  for (let x = X0 + 18; x < X1; x += 80) { rect(b, x, GY + 45, 3, 6, S[5]); rect(b, x + 3, GY + 45, 1, 6, S[2]); rect(b, x, GY + 45, 3, 1, S[6]); }
  for (let x = X0; x < X1; x++) { const y = GY + 54 + Math.round(Math.sin(x * 0.045) * 1.4); put(b, x, y, S[3]); put(b, x, y + 1, S[0]); }
}

// ------------------------------------------------------------------------------------------------------ low foreground
function paintFront(b) {
  // bottom left: a pump box with a gauge and a fat pipe; bottom right: the edge of a solar wing. Dark: it frames,
  // it never hides the play lane
  const D = [S[0], S[1], S[2], S[3], S[4]];
  for (let j = 0; j < 9; j++) rect(b, -MG, 259 + j, 136, 1, j === 0 ? D[4] : j < 3 ? D[3] : j < 6 ? D[2] : D[1]);
  for (const x of [58, 92]) { rect(b, x, 257, 4, 14, D[3]); rect(b, x, 257, 4, 1, D[4]); rect(b, x + 3, 258, 1, 13, D[1]); }
  rect(b, -MG, 246, 70, 24, D[2]); rect(b, -MG, 246, 70, 1, D[4]); rect(b, 29, 247, 1, 23, D[0]); rect(b, -MG, 247, 69, 1, D[3]);
  for (let x = -MG; x < 29; x++) put(b, x, 249, ((x + 60) >> 2) & 1 ? '#6a5222' : D[0]);                // a dim hazard lip
  for (let i = 0; i < 3; i++) { rect(b, 2 + i * 5, 254, 3, 9, D[0]); rect(b, 2 + i * 5, 254, 1, 9, D[1]); }
  shape(b, 17, 252, 27, 262, (x, y) => (x - 22.5) ** 2 + (y - 257.5) ** 2 <= 20, (x, y) => { const d = Math.hypot(x - 22.5, y - 257.5); return I(d > 3.4 ? D[4] : '#0b1026'); });
  put(b, 22, 257, PAL.CYAN); put(b, 23, 256, PAL.CYAN); put(b, 24, 255, PAL.CYANL);
  rect(b, 12, 240, 2, 6, D[3]); rect(b, 9, 238, 8, 2, D[3]); rect(b, 9, 238, 8, 1, D[4]);
  for (let x = 30; x < 80; x++) { const y = 251 + Math.round(Math.sin((x - 30) / 50 * Math.PI) * 5); put(b, x, y, D[3]); put(b, x, y + 1, D[0]); }
  const FC = ['#0c1238', '#101a4c', '#172664', '#20347c'].map(I);
  for (let y = 244; y < H + 10; y++) for (let x = 372; x < W + MG; x++) {
    const e = x - (372 + (270 - y) * 1.05), t = y - (252 - (x - 400) * 0.07);
    if (e < 0 || t < 0) continue;
    const u = Math.floor(e), v = Math.floor(t);
    put(b, x, y, e < 1.2 || t < 1.2 ? I(D[4]) : e < 2.4 || t < 2.4 ? I(D[2]) : u % 14 === 0 || v % 9 === 0 ? I(D[1]) : dith(FC, 0.25 + 0.6 * h2(Math.floor(u / 14), Math.floor(v / 9), 7), x, y));
  }
}

// ------------------------------------------------------------------------------------------------------ the MINI UFO
const UF = { w: '#ffffff', l: '#e6ecf7', m: '#bcc8de', d: '#8d9dbd', D: '#5f6f96', k: '#39425f', r: '#e0302a', R: '#ff6b5a', q: '#a3151a', y: '#ffd23f', Y: '#fff3b0', o: '#c98a16' };
const STAR = ['.....y.....', '.....y.....', '....yyy....', '....yyy....', 'yyyyyyyyyyy', '.yyyyyyyyy.', '..yyyyyyy..', '...yyyyy...', '..yyyyyyy..', '..yyy.yyy..', '.yy.....yy.'];
function ufoSprite() {
  const b = buf(92, 48, 46, 18);                               // local (0, 0) = the centre of the disc
  // a red toy-rocket tail fin
  poly(b, [[-25, -3], [-34, -14], [-28, -14], [-17, -4]], I(UF.r));
  line(b, -33, -13, -25, -4, I(UF.R)); line(b, -28, -13, -19, -5, I(UF.q)); rect(b, -33, -14, 5, 1, UF.w);
  // the cabin under the disc: a silver bowl
  ball(b, 0, 2, 18, 14.5, [UF.D, UF.d, UF.m, UF.l, UF.w], (x, y) => y > 2, 0.45, -0.85, [0.3, -0.1, -0.56, -0.86]);
  // the yellow star sticker (a bit crooked: stuck on by hand)
  STAR.forEach((row, j) => { for (let i = 0; i < 11; i++) if (row[i] === 'y') put(b, -4 + i, 4 + j, j < 4 || (j === 4 && i < 6) ? UF.Y : j > 8 ? UF.o : UF.y); });
  // the beam emitter
  rect(b, -7, 15, 15, 2, UF.k); rect(b, -5, 17, 11, 2, UF.D); rect(b, -5, 17, 11, 1, UF.d); rect(b, -3, 18, 7, 1, PAL.CYAN); rect(b, -1, 18, 3, 1, '#ffffff');
  // the disc: white on top, the red stripe round the rim, silver underneath
  shape(b, -31, -7, 31, 7, (x, y) => (x / 30.4) ** 2 + (y / 6.5) ** 2 <= 1, (x, y) => I(y < -4 ? UF.w : y < -2 ? (x > -14 ? UF.w : UF.l) : y < -1 ? UF.R : y < 1 ? UF.r : y < 2 ? UF.q : y < 4 ? UF.m : y < 5 ? UF.d : UF.D));
  for (let x = -26; x <= 26; x += 8) if (x !== -2) put(b, x, -1, '#ffd6d1');
  for (const x of [-22, 21]) { rect(b, x, 5, 2, 1, PAL.CYANL); }
  // the cabin's collar, a little console and the control stick with a red knob
  rect(b, -15, -7, 31, 1, UF.m); rect(b, -16, -6, 33, 1, UF.d); rect(b, -15, -7, 12, 1, UF.l);
  rect(b, 9, -9, 7, 2, UF.D); rect(b, 9, -9, 7, 1, UF.d); put(b, 14, -9, PAL.AMB); rect(b, 10, -11, 1, 2, UF.k); rect(b, 9, -13, 3, 2, UF.r); put(b, 9, -13, UF.R);
  // the nose blaster's mount
  rect(b, 25, -6, 6, 4, UF.r); rect(b, 25, -6, 6, 1, UF.R); rect(b, 25, -3, 6, 1, UF.q);
  outline(b);
  return mk(b);
}
const DOME = { x: 0, y: -12, r: 17, cut: -6 };
function domeSprites() {
  const back = buf(40, 32, 20, 31), front = buf(40, 32, 20, 31), D = DOME;
  shape(back, -18, -30, 18, D.cut, (x, y) => (x - D.x) ** 2 + (y - D.y) ** 2 <= (D.r - 1) ** 2 && y < D.cut, (x, y) => I(x > 6 ? '#3f9fc4' : '#9fe6ff'));
  shape(front, -19, -31, 19, D.cut, (x, y) => { const d = Math.hypot(x - D.x, y - D.y); return y < D.cut && d <= D.r + 0.5 && d > D.r - 1.6; }, (x, y) => {
    const d = Math.hypot(x - D.x, y - D.y), a = Math.atan2(y - D.y, x - D.x);
    if (d > D.r - 0.55) return I(OUT);
    return I(a < -2.0 ? '#ffffff' : a < -1.0 ? '#c8f7ff' : a < -0.2 ? '#74d3ee' : a > 2.6 ? '#e8fbff' : '#4aa8cc');
  });
  // highlights on the glass: a curved streak up on the left, a glint on the right
  shape(front, -19, -31, 19, D.cut, (x, y) => { const d = Math.hypot(x - D.x, y - D.y), a = Math.atan2(y - D.y, x - D.x); return d < 13.3 && d > 12 && a > -2.7 && a < -2.05; }, I('#ffffff'));
  shape(front, -19, -31, 19, D.cut, (x, y) => { const d = Math.hypot(x - D.x, y - D.y), a = Math.atan2(y - D.y, x - D.x); return d < 13.3 && d > 12.2 && a > -1.92 && a < -1.75; }, I('#e8fbff'));
  put(front, 10, -20, '#ffffff'); put(front, 11, -19, '#ffffff');
  return { back: bake(back), front: bake(front), ox: 20, oy: 31 };
}
function gunSprite() {
  const b = buf(22, 16, 4, 10), a = GUN_A;
  bar(b, a, 0, 9, -1.5, 1.5, I(UF.d)); bar(b, a, 0, 9, -1.5, -0.8, I(UF.w)); bar(b, a, 0, 9, 0.9, 1.5, I(UF.D));
  bar(b, a, 3, 3.6, -1.5, 1.5, I(UF.k)); bar(b, a, 6, 6.6, -1.5, 1.5, I(UF.k));
  bar(b, a, 9, 11.5, -2, 2, I(UF.y)); bar(b, a, 9, 11.5, -2, -1.2, I(UF.Y)); bar(b, a, 9, 11.5, 1.2, 2, I(UF.o));
  outline(b);
  return mk(b);
}
function iconSprite() {
  const b = buf(26, 20, 13, 12);
  shape(b, -7, -10, 7, -2, (x, y) => (x * x + (y + 3) ** 2 <= 49) && y < -2, (x, y) => I(x < -2 && y > -8 ? '#dff9ff' : '#74d3ee'));
  rect(b, -1, -7, 3, 4, I('#e8762c')); rect(b, -1, -4, 3, 2, I('#9b59b6'));                              // a tiny pilot
  shape(b, -11, -2, 11, 3, (x, y) => (x / 10.6) ** 2 + (y / 2.9) ** 2 <= 1, (x, y) => I(y < -1 ? UF.w : y < 0 ? UF.r : y < 1 ? UF.q : UF.d));
  shape(b, -6, 2, 6, 6, (x, y) => (x / 5.6) ** 2 + ((y - 1) / 4.6) ** 2 <= 1 && y > 2, (x, y) => I(y < 4 ? UF.m : UF.d));
  put(b, 0, 3, UF.y); put(b, -1, 3, UF.y); put(b, 1, 3, UF.y); put(b, 0, 2, UF.Y); put(b, 0, 4, UF.y);
  outline(b);
  return bake(b);
}
// the grab beam: a cyan cone from the emitter down to the deck; whatever it holds floats in it
function drawBeam(x, y0, y1, held) {
  const n = y1 - y0;
  M5.glow(x, y0 + 2, 16, PAL.CYAN, 0.55);
  for (let j = 0; j < n; j++) {
    const k = j / n, hw = Math.round(5 + k * 16), band = ((j + 600 - (T >> 1)) % 6) < 3;
    ctx.fillStyle = rgba(PAL.CYAN, (band ? 0.5 : 0.33) * (1 - k * 0.3)); ctx.fillRect(x - hw, y0 + j, hw * 2 + 1, 1);
    ctx.fillStyle = rgba(PAL.CYANL, 0.26 * (1 - k * 0.5)); ctx.fillRect(x - Math.round(hw * 0.4), y0 + j, Math.round(hw * 0.4) * 2 + 1, 1);
  }
  // the pool of light on the deck
  M5.glow(x, y1, 30, PAL.CYAN, 0.4);
  ctx.fillStyle = rgba(PAL.CYANL, 0.85); ctx.fillRect(x - 21, y1, 43, 1);
  ctx.fillStyle = rgba(PAL.CYAN, 0.5); ctx.fillRect(x - 24, y1 + 1, 49, 2);
  if (held) held();
  for (let j = 0; j < n; j++) {                                // crisp bright edges
    const k = j / n, hw = Math.round(5 + k * 16);
    ctx.fillStyle = rgba(PAL.CYANL, 0.9 - k * 0.45); ctx.fillRect(x - hw, y0 + j, 1, 1); ctx.fillRect(x + hw, y0 + j, 1, 1);
  }
  for (let i = 0; i < 4; i++) {                                // rings sliding up the beam
    const u = ((T / 46 + i / 4) % 1), yy = Math.round(y1 - u * n), hw = Math.round(5 + (1 - u) * 16);
    ctx.fillStyle = rgba('#ffffff', 0.3 + 0.5 * Math.sin(u * Math.PI)); ctx.fillRect(x - hw, yy, hw * 2 + 1, 1);
  }
  for (let i = 0; i < 12; i++) {                               // sparkles drawn up with it
    const u = (T / (50 + i * 7) + hsh(i * 3.7)) % 1, yy = Math.round(y1 - 2 - u * (n - 6)), hw = 4 + (1 - u) * 14;
    const xx = Math.round(x + (hsh(i * 9.1) - 0.5) * 2 * hw);
    ctx.fillStyle = i % 3 ? '#ffffff' : PAL.CYANL; ctx.fillRect(xx, yy, 1, i % 4 === 0 ? 2 : 1);
  }
}
function drawUfo(p, r) {
  const A = art(), x = Math.round(p.x), y = Math.round(p.y) - 16;
  drawBeam(x + 1, y + 19, GY, () => {
    // the roly eye it has grabbed: lifted off the deck, looking up at its captor
    const hx = CAM + HELD.x, hy = HELD.y;
    M5.roller(hx, hy, 1, { pose: 'idle', look: [-0.15, -1], rot: 0.5, t: 0 });
    for (const [i, j, l] of [[-12, -3, 3], [12, -5, 4], [-9, 4, 3], [10, 3, 2]]) { ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + i, hy + j, 1, l); }      // it wriggles
    for (let i = 0; i < 3; i++) { ctx.fillStyle = rgba('#ffffff', 0.8); ctx.fillRect(hx - 5 + i * 5, hy + 3 + (i & 1) * 2, 1, 4); }                         // lift lines
  });
  // the glass bubble: its back, the pilot (pistol clipped away: her hand is on the stick), the saucer, the glass front
  ctx.globalAlpha = 0.17; ctx.drawImage(A.dome.back, x - A.dome.ox, y - A.dome.oy); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(x + 2, y + 8);
  ctx.beginPath(); ctx.rect(-30, -60, 60, 39); ctx.rect(-30, -21, 37, 9); ctx.clip();
  drawHero(HEROES[G.hero], 0, 0, 1, { pose: 'idle', t: 0, aim: 'fwd', weapon: 'pistol', muzzle: 0 });
  ctx.restore();
  blit(A.ufo, x, y);
  ctx.drawImage(A.dome.front, x - A.dome.ox, y - A.dome.oy);
  blit(A.gun, x + 29, y - 4);
  if (r.muzzle > 0) { const mx = x + 29 + Math.round(Math.cos(GUN_A) * 14), my = y - 4 - Math.round(Math.sin(GUN_A) * 14); M5.glow(mx, my, 12, '#ffd23f', 0.7); flashAt(mx, my, true); }
  // hover lights under the rim
  M5.glow(x - 21, y + 7, 6, PAL.CYAN, 0.6); M5.glow(x + 22, y + 7, 6, PAL.CYAN, 0.6);
}
function boltSprite() {
  const b = buf(40, 16, 34, 10);                               // local (0, 0) = the bolt's tip; it climbs 1 px every 5
  for (let i = -32; i <= 0; i++) {
    const y = -Math.round((i + 32) / 4.8) + 7;
    if (i < -25) put(b, i, y, '#ff7a1a');
    else if (i < -19) { put(b, i, y, '#ffb52e'); put(b, i, y - 1, '#ff7a1a'); }
    else { put(b, i, y - 1, '#ffd23f'); put(b, i, y, i > -16 && i < -1 ? '#fffbe0' : '#fff3b0'); put(b, i, y + 1, i > -12 ? '#ffd23f' : '#ffb52e'); }
  }
  put(b, 1, 0, '#fff3b0');
  return bake(b);
}
function drawBolt(b) {
  const A = art(), ux = Math.cos(GUN_A), uy = -Math.sin(GUN_A);
  M5.glow(b.x - ux * 6, b.y - uy * 6, 12, '#ffd23f', 0.55); M5.glow(b.x - ux * 18, b.y - uy * 18, 9, '#ffb52e', 0.4);
  ctx.drawImage(A.bolt, Math.round(b.x) - 34, Math.round(b.y) - 10);
}

// ------------------------------------------------------------------------------------------ robots holding their poses
// the bubble helmet the oggles wear outside: glass round the top of the egg, a steel collar on the belt
function helmetSprite() {
  const b = buf(34, 30, 17, 33), cx = 0, cy = -19, rx = 14, ry = 13.4, cut = -8;
  const dd = (x, y) => Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) * 14;
  shape(b, -16, -33, 16, cut, (x, y) => { const d = dd(x, y); return y < cut && d <= 14 && d > 12; }, (x, y) => {
    const d = dd(x, y), a = Math.atan2(y - cy, x - cx);
    if (d > 13) return I(OUT);
    return I(a < -2.0 ? '#ffffff' : a < -0.9 ? '#c8f7ff' : a < 0 ? '#74d3ee' : a > 2.4 ? '#e8fbff' : '#4aa8cc');
  });
  shape(b, -16, -33, 16, cut, (x, y) => { const d = dd(x, y), a = Math.atan2(y - cy, x - cx); return d < 10.4 && d > 8.6 && a > -2.7 && a < -2.2; }, I('#ffffff'));
  put(b, 7, -27, '#ffffff'); put(b, 8, -26, '#ffffff');
  return bake(b);
}
function drawHelmet(x, y) {
  const A = art();
  ctx.fillStyle = 'rgba(160,236,255,0.13)';
  for (let j = -31; j < -8; j++) { const hw = Math.floor(13 * Math.sqrt(Math.max(0, 1 - ((j + 19) / 12.6) ** 2))); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
  ctx.drawImage(A.helmet, x - 17, y - 33);
  RO(x - 11, y - 9, 23, 2, METL); R(x - 11, y - 8, 23, 1, MET);              // the collar
  RO(x + 3, y - 34, 3, 2, MET);                                              // a grommet where the antenna pokes out (facing left)
}
const DRONE_BOX = e => ({ x: e.x - 14, y: e.y - 10, w: 28, h: 22 });
const posed = (draw, box, extra) => Object.assign({
  hp: 3, contact: 'none', activateMargin: 600,
  make(e, s) { e.pose = s.pose || 'idle'; e.spec = s; e.facing = s.face || -1; if (s.y != null) e.y = s.y; },
  update(e) { e.vx = 0; e.active = true; },
  draw(e) { FLASH = e.hitT > 0; draw(e); FLASH = false; },
  box,
  onKill(e, cx, cy, b) { boom(cx, cy, 0.8); debris(cx, cy, 8, GRN[3]); debris(cx, cy, 4, MET); addScore(100, cx, b.y); }
}, extra || {});
function flashSprite() {
  const b = buf(52, 52, 26, 26), pts = k => { const P = []; for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + 0.2, r = (i & 1 ? 9.5 : 17 + 6 * hsh(i * 3.7)) * k; P.push([Math.cos(a) * r, Math.sin(a) * r * 0.92]); } return P; };
  poly(b, pts(1), I('#ff8c2e')); poly(b, pts(0.86), I('#ffd23f')); poly(b, pts(0.6), I('#fff3b0')); poly(b, pts(0.36), I('#ffffff'));
  return bake(b);
}
function drawBurst(e) {
  // saucer A as the laser bolt tears it open: four pieces of the kit's saucer fly apart (the dome up, a wing each
  // way, the eye pod down with a black X on its lens)
  const x = Math.round(e.x), y = Math.round(e.y), o = { pose: 'idle', look: [0, 0.2], t: 3, still: true };
  M5.glow(x, y + 1, 36, '#ffd23f', 0.5);
  ctx.drawImage(art().flash, x - 26, y - 25);
  const piece = (cx0, cy0, cw, ch, ox, oy) => { ctx.save(); ctx.beginPath(); ctx.rect(x + cx0 + ox, y + cy0 + oy, cw, ch); ctx.clip(); M5.drone(x + ox, y + oy, -1, o); ctx.restore(); };
  piece(-17, -6, 10, 12, -14, 4);        // left wing of the disc
  piece(7, -6, 10, 12, 15, -5);          // right wing
  piece(-10, -19, 20, 14, 2, -17);       // the dome and the antenna, blown upward
  piece(-8, -5, 16, 19, 4, 16);          // the eye pod, dropping
  const ex = x + 4 - 1, ey = y + 16 + 7;
  pdisc(ex, ey, 4, PAL.EYEW);
  for (let i = -2; i <= 2; i++) { R(ex + i, ey + i, 1, 1, PAL.PUP); R(ex + i, ey - i, 1, 1, PAL.PUP); }
}
ENEMY_TYPES.m5ssaucer = posed(e => {
  if (e.pose === 'burst') drawBurst(e);
  else if (e.pose === 'warn') M5.drone(e.x, e.y, -1, { pose: 'warn', look: [-0.9, 0.35], t: 4, still: true });
  else M5.drone(e.x, e.y, -1, { pose: 'idle', look: [-0.95, 0], t: T, ph: 1.3 });
}, DRONE_BOX, { flying: true });
function drawTether(x, y) {
  for (let i = 0; i <= 26; i++) {
    const k = i / 26, tx = Math.round(lerp(lerp(x + 13, x + 20, k), lerp(x + 20, x + 33, k), k)), ty = Math.round(lerp(lerp(y - 13, y + 3, k), lerp(y + 3, y - 2, k), k));
    R(tx, ty + 1, 1, 1, OUT); R(tx, ty, 1, 1, i % 6 < 3 ? '#ff9a3a' : '#ffd23f');
  }
  RO(x + 32, y - 4, 4, 4, METL); R(x + 33, y - 3, 2, 2, METDD);
}
ENEMY_TYPES.m5soggle = posed(e => { drawTether(Math.round(e.x), Math.round(e.y)); M5.oggle(e.x, e.y, -1, { pose: 'aim', look: [-0.75, -0.65], t: 10 }); drawHelmet(Math.round(e.x), Math.round(e.y)); }, e => ({ x: e.x - 10, y: e.y - 27, w: 20, h: 27 }));
ENEMY_TYPES.m5sroly = posed(e => { if (!e.spec.held) M5.roller(e.x, e.y, 1, { pose: 'idle', look: [0.8, -0.6], rot: T / 5 }); }, e => ({ x: e.x - 9, y: e.y - 18, w: 18, h: 18 }));

// the burst round saucer A, frozen about six frames in: engine fire puffs, sparks, shards (rebuilt every frame)
function burstFx() {
  const x = CAM + SA.x, y = SA.y, out = [];
  const fire = (dx, dy, size, k) => out.push({ type: 'fire', x: x + dx, y: y + dy, vx: 0, vy: 0, life: Math.round(34 * k), max: 34, size });
  fire(-2, 1, 6, 0.94); fire(5, -3, 4, 0.8); fire(3, 6, 4, 0.72);
  for (let i = 0; i < 16; i++) {
    const a = hsh(i * 3.3 + 1) * Math.PI * 2, d = 21 + hsh(i * 5.1 + 2) * 13;
    out.push({ type: 'spark', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.85, vx: 0, vy: 0, g: 0, life: 20, max: 30, size: i % 3 ? 2 : 1, c: i % 4 === 0 ? '#ffffff' : '#ffe066' });
  }
  [[-27, -9, 3], [-22, 17, 2], [24, -17, 3], [30, 10, 2], [-9, 25, 3], [-14, -23, 2], [33, 3, 2]].forEach(([dx, dy, s], i) =>
    out.push({ type: 'debris', x: x + dx, y: y + dy, vx: 0, vy: 0, g: 0, life: 50, max: 70, size: s, c: i % 3 === 2 ? METL : i % 2 ? GRN[3] : GRN[5] }));
  return out;
}

// --------------------------------------------------------------------------------------------------------- the meteor
function meteorSprites() {
  const fl = buf(74, 100, 16, 82), ux = 0.34, uy = -0.94, LEN = 74;
  const FL = ['#fff7c8', '#ffe066', '#ffb52e', '#ff7a1a', '#e0452c', '#a8285a'].map(I);
  for (let y = -82; y < 18; y++) for (let x = -16; x < 58; x++) {
    const s = (x + 0.5) * ux + (y + 0.5) * uy, r = Math.abs(-(x + 0.5) * uy + (y + 0.5) * ux);
    if (s < -13 || s > LEN) continue;
    const wd = s < 0 ? 13 * Math.sqrt(Math.max(0, 1 - (s / 13) ** 2)) : 13 * Math.pow(1 - s / LEN, 0.85) + Math.sin(s * 0.42 + 1) * 1.1 * (s / LEN) * 2;
    if (wd <= 0) continue;
    const q = r / wd + (fbm2(x * 0.33, y * 0.33, 91, 2) - 0.5) * (0.25 + 0.5 * Math.max(0, s) / LEN) + Math.max(0, s) / LEN * 0.4;
    if (q > 1.12) continue;
    const c = q < 0.2 ? FL[0] : q < 0.4 ? FL[1] : q < 0.6 ? FL[2] : q < 0.8 ? FL[3] : q < 1 ? FL[4] : (bay(x, y) < 0.5 ? FL[5] : NONE);
    if (c !== NONE) put(fl, x, y, c);
  }
  const rk = buf(30, 30, 15, 15);
  shape(rk, -13, -13, 13, 13, (x, y) => { const a = Math.atan2(y, x); return Math.hypot(x, y) <= 9.6 + 1.4 * Math.sin(a * 3 + 1) + 0.9 * Math.sin(a * 5 + 2); }, (x, y) => {
    const f = (-x * ux - y * uy) / 10, n = h2(Math.floor(x), Math.floor(y), 93), top = (x * 0.5 - y * 0.6) / 10;      // f: toward the glowing front
    if (f > 0.74) return I('#fff3b0');
    if (f > 0.54) return I(n > 0.4 ? '#ffb52e' : '#ff7a1a');
    if (f > 0.36 && n > 0.5) return I('#d9512c');
    return I(top > 0.35 ? (n > 0.75 ? '#c9a2ae' : '#a8808e') : top > -0.2 ? (n > 0.85 ? '#5a3c50' : '#84596c') : '#5a3c50');
  });
  for (const [x, y] of [[3, -4], [-2, 1], [5, 2], [0, -7]]) { put(rk, x, y, '#4a3044'); put(rk, x + 1, y, '#4a3044'); put(rk, x, y + 1, '#4a3044'); put(rk, x + 1, y + 1, '#c9a2ae'); put(rk, x + 2, y + 1, '#c9a2ae'); }
  outline(rk);
  return { flame: bake(fl), fox: 16, foy: 82, rock: mk(rk) };
}
function bang2(x, y) {                                           // the kit's red ! at double size (a meteor is a big deal)
  ctx.fillStyle = OUT; ctx.fillRect(x - 4, y - 20, 10, 16); ctx.fillRect(x - 4, y - 2, 10, 8);
  ctx.fillStyle = '#ff3b30'; ctx.fillRect(x - 2, y - 18, 6, 12); ctx.fillRect(x - 2, y, 6, 4);
  ctx.fillStyle = '#ffd6d1'; ctx.fillRect(x - 2, y - 18, 2, 10);
}
EB_TYPES.m5smeteor = {
  r: 9,
  draw(b) {
    const A = art(), x = Math.round(b.x), y = Math.round(b.y), tx = Math.round(b.tx), on = cyc(12) < 6;
    // the landing marker on the deck: a blinking red and yellow ring, a dotted line down to it, the red !
    M5.glow(tx, GY, 22, '#ff3b30', 0.3);
    for (let i = 0; i < 9; i++) { const k = (i + 0.5) / 9; ctx.fillStyle = on ? '#ff3b30' : '#ffe066'; ctx.fillRect(Math.round(lerp(x - 6, tx, k)), Math.round(lerp(y + 12, GY - 5, k)), 2, 2); }
    pring(tx, GY, 15, 4, on ? '#ff3b30' : '#ffe066', 90); pring(tx, GY, 14, 3.4, on ? '#ff3b30' : '#ffe066', 90); pring(tx, GY, 13, 3, OUT, 80);
    pring(tx, GY, 8, 2, on ? '#ffe066' : '#ff3b30', 60);
    ctx.fillStyle = on ? '#ffe066' : '#ff3b30'; ctx.fillRect(tx - 1, GY, 3, 1);
    bang2(tx - 1, GY - 12);
    // the meteor: a flame streaming behind a glowing rock
    M5.glow(x, y, 26, '#ff8c2e', 0.5); M5.glow(x - 3, y + 6, 12, '#fff3b0', 0.6);
    ctx.drawImage(A.meteor.flame, x - A.meteor.fox, y - A.meteor.foy);
    blit(A.meteor.rock, x, y);
    for (let i = 0; i < 14; i++) {                              // embers shed along the tail
      const u = (hsh(i * 2.9) + T / (40 + i * 3)) % 1, s = 14 + u * 66, w = (hsh(i * 7.3 + Math.floor(T / 5)) - 0.5) * 16;
      ctx.fillStyle = u < 0.4 ? '#fff3b0' : u < 0.75 ? '#ffb52e' : '#e0452c';
      ctx.fillRect(Math.round(x + 0.34 * s + 0.94 * w), Math.round(y - 0.94 * s + 0.34 * w), 1, 1);
    }
  }
};

// ------------------------------------------------------------------------------------------------------- the cow pod
POW_KINDS.m5scow = {
  thanks: 'MOO! THANK YOU!',
  box: o => ({ x: o.x - 16, y: o.y - 48, w: 32, h: 48 }),
  draw(o) {
    if (o.state === 'tied') { M5.pod(o.x, o.y, { id: 2, t: T }); M5.bubble(o.x, o.y - 53, 'MOO!'); }
    else { M5.pod(o.x, o.y, { id: 2, empty: true, t: T }); M5.cow(o.x, o.y, o.state === 'run' ? -1 : 1); }
  }
};

// ------------------------------------------------------------------------------------------------- building (once)
let ART = null;
function art() {
  if (ART) return ART;
  const EX0 = -MG, EX1 = 280, EY0 = 82, EY1 = GY + 8;
  ART = {
    space: strip(-10, H + 10, 0.006, paintSpace), moon: moonSprite(),
    earth: strip(EY0, EY1, 0.015, b => paintEarth(b, EX0, EX1, EY0, EY1), EX0, EX1), halo: earthHalo(EX0, 300, 60, EY1),
    farA: strip(54, GY + 6, 0.08, paintFarA), farB: strip(160, GY + 6, 0.2, paintFarB),
    mid: strip(104, GY + 1, 1, paintMid), deck: strip(GY, H + 10, 1, paintDeck), front: strip(236, H + 10, 1.25, paintFront),
    ufo: ufoSprite(), dome: domeSprites(), gun: gunSprite(), icon: iconSprite(), helmet: helmetSprite(), meteor: meteorSprites(), bolt: boltSprite(), flash: flashSprite()
  };
  return ART;
}

// ------------------------------------------------------------------------------------------------------ live scenery
const blink = (x, y, c, on, r = 5) => { if (on) { M5.glow(x, y, r, c, 0.6); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); } ctx.fillStyle = on ? c : '#3a1a2a'; ctx.fillRect(x - 1, y - 1, 3, 3); if (on) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 1, 1); } };
function drawBG(cx) {
  const A = art(), sh = (p) => Math.round((cx - CAM) * p);
  ctx.fillStyle = '#05040d'; ctx.fillRect(-10, -10, W + 20, H + 20);
  drawStrip(A.space, cx);
  for (const [x, y, per, c] of TWINK) {                         // twinkling stars
    const k = cyc(per, x) / per, a = k < 0.5 ? 1 : 0.35;
    ctx.fillStyle = rgba(c, a); ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
    if (k < 0.5) { ctx.fillStyle = rgba(c, 0.5); ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x, y - 3, 1, 7); }
  }
  M5.glow(96 - sh(0.01), 70, 16, '#c9c6e0', 0.16); ctx.drawImage(A.moon, 96 - 10 - sh(0.01), 70 - 10);
  for (const [x, y, n, off] of [[52, 46, 9, 0], [246, 78, 7, 40]]) {              // shooting stars: more meteors on their way
    const u = cyc(120, off) / 120, hx = x - Math.round(u * 26), hy = y + Math.round(u * 26 * 1.6);
    if (u > 0.5) continue;
    for (let i = 0; i < n; i++) { ctx.fillStyle = rgba(i < 2 ? '#ffffff' : i < 5 ? PAL.AMBL : '#ff8c2e', 1 - i / n); ctx.fillRect(hx + Math.round(i * 0.6), hy - i, 1, 1); }
  }
  for (const [x, y, k] of [[398, 46, 0], [414, 52, 1], [431, 44, 2]]) {            // three more eye saucers, tiny with distance
    const yy = y + (cyc(64, k * 20) < 32 ? 0 : 1);
    ctx.fillStyle = OUT; ctx.fillRect(x - 4, yy - 1, 9, 4); ctx.fillRect(x - 2, yy - 3, 5, 3); ctx.fillRect(x - 1, yy + 2, 3, 2);
    ctx.fillStyle = '#74d3ee'; ctx.fillRect(x - 1, yy - 2, 3, 1);
    ctx.fillStyle = GRN[4]; ctx.fillRect(x - 3, yy, 7, 1); ctx.fillStyle = GRN[2]; ctx.fillRect(x - 3, yy + 1, 7, 1);
    ctx.fillStyle = PAL.EYEW; ctx.fillRect(x, yy + 2, 1, 1); ctx.fillStyle = cyc(30, k * 10) < 15 ? PAL.AMBL : PAL.AMB; ctx.fillRect(x - 2 + k, yy, 1, 1);
  }
  // the Earth, the glow of its air, the ping on Vigo: home
  const eo = sh(A.earth.p);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(A.halo, -MG - eo, 60); ctx.restore();
  drawStrip(A.earth, cx);
  const v = earthXY(VIGO[0], VIGO[1]), vx = Math.round(v[0]) - eo, vy = Math.round(v[1]), u = cyc(80, 30) / 80;
  pring(vx, vy, 3 + u * 6, (3 + u * 6) * 0.72, rgba('#ffffff', 0.95 * (1 - u)), 44);
  ctx.fillStyle = OUT; ctx.fillRect(vx - 2, vy - 1, 5, 3); ctx.fillRect(vx - 1, vy - 2, 3, 5);
  ctx.fillStyle = PAL.MAG; ctx.fillRect(vx - 1, vy - 1, 3, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(vx, vy, 1, 1); ctx.fillRect(vx - 1, vy - 1, 1, 1);
  // the far parts of the ship: the engine's glow, the fin's beacon, mast lamps
  const fo = sh(A.farA.p);
  M5.glow(486 - fo, 183, 34, PAL.MAG, 0.3 + 0.08 * Math.sin(T / 9));
  drawStrip(A.farA, cx);
  blink(456 - fo, 61, '#ff3b30', cyc(50) < 28, 7);
  blink(331 - fo, 123, PAL.AMB, cyc(64, 20) < 30, 4); blink(247 - fo, 183, '#ff3b30', cyc(44, 8) < 20, 4);
  drawStrip(A.farB, cx);
  blink(372 - sh(A.farB.p), 180, PAL.CYAN, cyc(70, 12) < 40, 4);
}
function drawBehind() {
  const A = art();
  ctx.drawImage(A.mid.c, CAM + A.mid.x0, A.mid.top);
  blink(CAM + 20, 110, '#ff3b30', cyc(40) < 22, 8);                                          // the tower's beacon
  for (const [x, hg] of LAMPS) { M5.glow(CAM + x, GY - hg - 1, 7, PAL.CYAN, 0.45); R(CAM + x - 1, GY - hg - 3, 3, 2, PAL.CYANL); R(CAM + x - 1, GY - hg - 2, 3, 1, PAL.CYAN); }
  M5.glow(CAM + DISH_FEED[0], DISH_FEED[1], 5, PAL.MAG, 0.6); R(CAM + DISH_FEED[0], DISH_FEED[1], 1, 1, PAL.MAGL);
  for (let i = 0; i < 5; i++) {                                                               // gas puffing out of the vent
    const u = (T / 70 + i / 5) % 1, x = CAM + 155 + Math.round(Math.sin(i * 2.1 + u * 3) * (1 + u * 4)), y = GY - 15 - Math.round(u * 20), s = 1 + Math.round(u * 2);
    ctx.fillStyle = rgba('#c3d0ee', 0.5 * (1 - u)); ctx.fillRect(x - s, y - s, s * 2 + 1, s * 2 + 1);
  }
}
function drawGround() {
  const A = art();
  ctx.drawImage(A.deck.c, CAM + A.deck.x0, A.deck.top);
  for (let x = -MG; x < W + MG; x += 24) M5.glow(CAM + x - ((x % 24) + 24) % 24 + 5, GY + 16, 7, PAL.MAG, 0.22 + 0.06 * Math.sin(T / 12 + x));
  // somebody is watching from a porthole
  const px = CAM + PORTS[1], py = GY + 29;
  pdisc(px, py + 1, 3, GRN[3]); R(px - 3, py + 3, 7, 2, GRN[1]); R(px - 2, py - 3, 5, 1, GRN[5]);
  pdisc(px, py, 2, METD); R(px - 1, py - 2, 3, 5, PAL.EYEW); R(px - 2, py - 1, 5, 3, PAL.EYEW);
  const ix = px - 1 + (cyc(120) < 60 ? 0 : 1); R(ix, py - 1, 2, 2, PAL.IRIS); R(ix, py, 1, 1, PAL.PUP);
}
function drawFront(cx) {
  const A = art();
  drawStrip(A.front, cx);
  if (cyc(60, 10) < 34) { M5.glow(13 - Math.round((cx - CAM) * 1.25), 236, 6, PAL.CYAN, 0.5); R(12, 235, 2, 2, PAL.CYANL); } else R(12, 235, 2, 2, '#1f5f78');
}

// ------------------------------------------------------------------------------------------------- the ride (registry)
RIDES.miniufo = {
  help: 'X: LASER   C: GRAB BEAM   DOWN+Z: GET OUT',
  // the frame holds the pose. In the real area: fly in eight directions, X fires the nose blaster, hold C over a robot
  // to lift it with the beam and let go to throw it; the beam drains its charge bar and refills when off
  update(p, r) {
    p.x = CAM + UX; p.y = UY + 16; p.facing = 1; p.vx = 0; p.vy = 0; p.onGround = false;
    r.muzzle = 3;
  },
  box: p => ({ x: p.x - 30, y: p.y - 44, w: 60, h: 46 }),
  draw: drawUfo,
  hurt(p, r) { r.armour = Math.max(0, r.armour - 1); p.inv = 60; },
  hud(r) {
    const A = art();
    ctx.drawImage(A.icon, 129, 8);
    text('MINI UFO', 157, 8, '#ffe066');
    for (let i = 0; i < 5; i++) {
      const x = 157 + i * 7;
      if (i < r.armour) { RO(x, 21, 5, 4, UF.l); R(x, 21, 5, 1, '#ffffff'); R(x, 24, 5, 1, UF.d); } else { RO(x, 21, 5, 4, '#3a3a4a'); R(x + 2, 22, 1, 1, '#22222e'); }
    }
    // beam charge: a little cone, then the bar
    R(195, 21, 3, 1, PAL.CYANL); R(194, 22, 5, 1, PAL.CYAN); R(193, 23, 7, 1, PAL.CYAN); R(193, 24, 7, 1, '#2a8fb8');
    RO(202, 21, 25, 4, '#2a2a3a'); R(202, 21, Math.round(25 * r.beam), 4, PAL.CYAN); R(202, 21, Math.round(25 * r.beam), 1, PAL.CYANL);
  }
};
PROP_TYPES.miniufo = {
  box: () => null, hit() {},
  update(o) { const p = G.p; if (p && !p.dead && !p.ride && Math.abs(p.x - o.x) < 16 && boardRide(p, { type: 'miniufo', armour: 5, beam: 1, muzzle: 0 })) o.dead = true; },
  draw(o) { const A = art(); blit(A.ufo, o.x, o.y - 18); ctx.drawImage(A.dome.front, Math.round(o.x) - A.dome.ox, Math.round(o.y) - 18 - A.dome.oy); }
};

// ------------------------------------------------------------------------------------------------------- the mission
LEVELS.push({
  mission: 'MISSION 5', title: 'ALIEN MOTHERSHIP', end: 6400, heroStart: 120, freedLabel: 'COWS RESCUED',
  sections: [{ x: 0, name: 'AREA 1: THE HANGAR' }, { x: 1600, name: 'AREA 2: STAR GARDEN' }, { x: 3300, name: 'AREA 3: SPACE WALK' }, { x: 5000, name: 'FINAL AREA: THE BRIDGE' }],
  terrain: [[0, GY], [6400, GY]],
  plats: [], spawns: [], pows: [{ x: CAM + PODX, item: 'heart', kind: 'm5scow' }], props: [], locks: [],
  music: 'main', bossMusic: 'boss', intro: null,
  load() {
    T = 0;
    G.cam.x = CAM;
    dbg.god = true;                                            // a staged frame: nothing may hurt the hero
    const p = G.p;
    p.x = CAM + UX; p.y = UY + 16;
    boardRide(p, { type: 'miniufo', armour: 4, beam: 0.62, muzzle: 3 });
    const add = s => { const e = makeEnemy(s); e.active = true; G.enemies.push(e); };
    add({ t: 'm5ssaucer', x: CAM + SA.x, y: SA.y, pose: 'burst' });
    add({ t: 'm5ssaucer', x: CAM + SB.x, y: SB.y, pose: 'warn' });
    add({ t: 'm5ssaucer', x: CAM + SC.x, y: SC.y, pose: 'idle' });
    add({ t: 'm5soggle', x: CAM + OGX, y: GY });
    add({ t: 'm5sroly', x: CAM + ROLX, y: GY });
    add({ t: 'm5sroly', x: CAM + HELD.x, y: HELD.y, held: true });
  },
  update() {
    T++;
    G.cam.x = CAM;
    const p = G.p;
    p.hearts = 3; p.inv = 0; p.dead = 0; G.lives = 3;
    G.score = 98400;
    G.big = null; G.banner = { s: 'AREA 3: SPACE WALK', t: 100 };
    G.shake = 0; G.rings = [];
    // two yellow laser bolts on their way (the one before them just hit saucer A)
    const mx = CAM + UX + 29 + Math.cos(GUN_A) * 14, my = UY - 4 - Math.sin(GUN_A) * 14;
    G.pb = [20, 50].map(d => ({ x: mx + Math.cos(GUN_A) * d, y: my - Math.sin(GUN_A) * d, vx: 0, vy: 0, dmg: 1, life: 99, draw: drawBolt }));
    G.parts = burstFx();
    G.texts = [{ x: CAM + SA.x + 31, y: SA.y - 33, s: '200', t: 40, c: '#ffffff' }];
    G.eb = [{ k: 'm5smeteor', x: CAM + METEOR.x, y: METEOR.y, vx: 0, vy: 0, life: 999, tx: CAM + MTX }];
    G.items = []; G.grenades = [];
    for (const e of G.enemies) { e.hitT = 0; e.active = true; }
  },
  drawBG, drawBehind, drawGround, drawFront,
  drawOverlay() {
    const g = ctx.createRadialGradient(40, 190, 20, 40, 190, 230);
    g.addColorStop(0, 'rgba(70,140,255,0.10)'); g.addColorStop(1, 'rgba(70,140,255,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  },
  preview(x, y, w, h) { ctx.fillStyle = '#05040d'; ctx.fillRect(x, y, w, h); ctx.fillStyle = S[3]; ctx.fillRect(x, y + h - 20, w, 20); }
});
}
