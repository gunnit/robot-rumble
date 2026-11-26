'use strict';
// ============================================================
// Mission 4 CORAL KINGDOM, AREA 3: SUNKEN RUINS (world x 3400-5000): L4ART.ruins for the scenery joiner
// (level4_scenery.js; contract: tools/m4polish/build-contract.md).
//  bg: deeper blue water (dithered bands, brighter top left), slanted light shafts, and parallax layers: a drowned city
//    on its hill (p .08), the giant crowned head of a sunken sea king + a temple + a guardian statue (p .2), broken
//    colonnades, arcades and coral (p .42); live: a gliding manta, a pod of three free dolphins, schools of little fish.
//  behind: the four landmark arches (3660, 3990, 4440, 4720), an old shipwreck lying tilted on the sand (3712-3930,
//    the dolphin cage at 3820 hangs right at its yard arm), a colossal stone fist gripping a bronze trident (4232),
//    fallen column drums, mossy boulders at both area ends; live: swaying seaweed, bubbles leaking from the wreck.
//  ground: sand skin with ripples over the old street (paving slabs, mosaic panels, drifted over in places), a bed of
//    rubble stones, dark layered silt with buried pots, coins and shells; the treasure chest under the bow spilling
//    coins (live twinkles). front: low dark rocks, drums and weed at the very bottom. overlay: marine snow, bubbles.
// Painted pixel by pixel into buffers and baked once in steps; per frame it is blits plus small live bits from G.t.
// No Math.random/rand anywhere (private mulberry32 table + hsh), no canvases per frame.
// ============================================================
var L4ART = L4ART || {};
{
const Math = globalThis.Math;
const AX0 = 3400, AX1 = 5000;                    // AREA 3 in world x
const PX0 = 2800, CX1 = 5130;                    // cameras the parallax strips cover (bg 3010..4910, front 2860..5060)
const REF = 3660;                                // parallax pieces are placed by where they sit with the camera here
const GA = x => L4ART.groundAt(x);

// ------------------------------------------------------------ noise, colour, pixel buffers
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
let NZT = null;                                  // built by the first bake step (65536 private random floats)
function initNoise() { if (NZT) return; const r = rng(40433), a = new Float32Array(65536); for (let i = 0; i < a.length; i++) a[i] = r(); NZT = a; }
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
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dz = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
const I = s => parseInt(s.slice(1, 7), 16);
const P = (...s) => s.map(I);
const NONE = -1, OUTI = I(OUT);
function mixI(a, b, k) {
  k = clamp(k, 0, 1);
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  return Math.round(ar + ((b >> 16 & 255) - ar) * k) << 16 | Math.round(ag + ((b >> 8 & 255) - ag) * k) << 8 | Math.round(ab + ((b & 255) - ab) * k);
}
const rgba = (v, a) => 'rgba(' + (v >> 16 & 255) + ',' + (v >> 8 & 255) + ',' + (v & 255) + ',' + a.toFixed(3) + ')';
function buf(w, h, ox = 0, oy = 0) { const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox, oy }; }
function put(b, x, y, c) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
function oval(b, cx, cy, rx, ry, c) {
  const RX = rx + 0.5, RY = ry + 0.5, X = Math.round(cx), Y = Math.round(cy);
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++)
    if (i * i / (RX * RX) + j * j / (RY * RY) <= 1) put(b, X + i, Y + j, c);
}
function line(b, x0, y0, x1, y1, c, t = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), h = (t - 1) / 2;
  for (let i = 0; i <= n; i++) rect(b, Math.round(x0 + (x1 - x0) * i / n - h), Math.round(y0 + (y1 - y0) * i / n - h), t, t, c);
}
function path(b, pts, c, t = 1) { for (let i = 0; i + 1 < pts.length; i++) line(b, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, t); }
function poly(b, pts, c) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const sy = y + 0.5, xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[j];
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + (sy - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b2) => a - b2);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) put(b, x, y, c);
  }
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
function bake(b, white) {
  const c = document.createElement('canvas'); c.width = b.w; c.height = b.h;
  const g = c.getContext('2d'), im = g.createImageData(b.w, b.h), dd = im.data;
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = i * 4;
    if (white && v !== OUTI) dd[j] = dd[j + 1] = dd[j + 2] = 255;
    else { dd[j] = v >> 16 & 255; dd[j + 1] = v >> 8 & 255; dd[j + 2] = v & 255; }
    dd[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
function mk(b, white) { return { img: bake(b), white: white ? bake(b, true) : null, w: b.w, h: b.h, ax: b.ox, ay: b.oy }; }
function gblit(g, s, x, y) { g.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay); }
function blit(s, x, y) { ctx.drawImage(FLASH && s.white ? s.white : s.img, Math.round(x) - s.ax, Math.round(y) - s.ay); }
function alphaCanvas(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fn(x, y);
    if (!v) continue;
    const j = (y * w + x) * 4; d[j] = v[0]; d[j + 1] = v[1]; d[j + 2] = v[2]; d[j + 3] = v[3];
  }
  g.putImageData(im, 0, 0);
  return c;
}
// live drawing helpers: crisp thick line, pixel disc (current fillStyle)
function pl(x0, y0, x1, y1, w, c) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), h = (w - 1) / 2;
  ctx.fillStyle = FLASH ? '#ffffff' : c;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n - h), Math.round(y0 + (y1 - y0) * i / n - h), w, w);
}
function pdisc(x, y, r) {
  x = Math.round(x); y = Math.round(y);
  const R2 = (r + 0.5) * (r + 0.5);
  for (let j = -Math.floor(r); j <= Math.floor(r); j++) { const hw = Math.floor(Math.sqrt(R2 - j * j)); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
}

// ------------------------------------------------------------ the water of AREA 3: deeper blue, light from the upper left
const WCOL = P('#4b9cc9', '#3e8dbe', '#3380b3', '#2a72a7', '#23649a', '#1d578d', '#184b80', '#144073', '#103667');
const waterT = (x, y) => clamp(Math.pow(clamp((y + 6) / 276, 0, 1), 0.9) * 8.2 - 0.55 * (1 - clamp(x / 480, 0, 1)) * (1 - clamp(y / 230, 0, 1)), 0, 8);
function waterAt(x, y) { const t = waterT(x, y), i = Math.floor(t); return mixI(WCOL[i], WCOL[Math.min(8, i + 1)], t - i); }
function waterD(x, y) { const t = waterT(x, y), i = Math.floor(t), f = ss(0.28, 0.72, t - i); return WCOL[Math.min(8, i + (f > dz(x, y) ? 1 : 0))]; }
const WMID = new Int32Array(H + 40);
for (let y = 0; y < H + 40; y++) WMID[y] = waterAt(260, y - 20);
const wmid = y => WMID[clamp(Math.round(y) + 20, 0, H + 39)];
// mix the painted pixels toward the water behind them by k(x, y) (buffer-local x, screen y): depth haze
function hazeW(b, k) {
  for (let r = 0; r < b.h; r++) for (let q = 0; q < b.w; q++) {
    const i = r * b.w + q;
    if (b.d[i] === NONE) continue;
    const y = r - b.oy, m = k(q - b.ox, y);
    if (m > 0) b.d[i] = mixI(b.d[i], wmid(y), m);
  }
}
// parallax strips: layer x = screen x + (cx - PX0) * p, wide enough for every camera that can see the area
const stripW = p => W + Math.ceil((CX1 - PX0) * p) + 24;
// pieces in the parallax layers are placed by the screen x where they sit when the camera is at REF
const LX = (p, sx) => sx + (REF - PX0) * p;
function strip(g, s, cx, p) { g.drawImage(s.img, Math.round(-s.ax - (cx - PX0) * p), -s.ay); }

function paintWater() {
  const b = buf(W + 24, H + 24, 12, 12);
  for (let y = -12; y < H + 12; y++) for (let x = -12; x < W + 12; x++) put(b, x, y, waterD(x, y));
  return mk(b);
}
// slanted light shafts from the surface far above (soft alpha, stepped edges)
function shaftCanvas() {
  const beams = [[10, 18, 0.09], [92, 30, 0.07], [150, 12, 0.095], [262, 36, 0.065], [346, 14, 0.09], [430, 26, 0.07], [520, 16, 0.085], [585, 22, 0.065]];
  return alphaCanvas(640, H, (x, y) => {
    let a = 0;
    for (const [x0, bw, A] of beams) {
      const c = x0 + y * 0.3, hw = bw / 2 + y * 0.05, d = Math.abs(x - c) / hw;
      if (d < 1) a += A * (d < 0.4 ? 1 : d < 0.75 ? 0.62 : 0.3);
    }
    a *= Math.pow(1 - clamp(y / 236, 0, 1), 1.4);
    if (a < 0.006) return null;
    return [200, 240, 255, Math.round(a * 255)];
  });
}

// ------------------------------------------------------------ FAR: the drowned city on its hill (parallax 0.08)
const FAR_P = 0.08, STAT_P = 0.2, MID_P = 0.42, FRONT_P = 1.25, SHAFT_P = 0.05, POD_P = 0.3;
const FT = P('#d4e8e2', '#a6c7c8', '#7a9fae', '#577b90');
function towerF(b, x, base, w, h, s) {
  const kind = Math.floor(nz(s, 50) * 4), top = base - h;
  for (let i = 0; i < w; i++) {
    const jag = kind === 3 ? Math.floor(nz(i, s + 7) * 9 + (i / w) * 6) : 0;
    for (let y = top + jag; y < base; y++) put(b, x + i, y, i === 0 ? FT[0] : i >= w - 2 ? FT[2] : FT[1]);
  }
  for (let y = top + 10; y < base - 4; y += 15) { rect(b, x - 1, y, w + 2, 1, FT[0]); rect(b, x - 1, y + 1, w + 2, 1, FT[2]); }
  for (let y = top + 4 + (kind === 3 ? 10 : 0); y < base - 9; y += 15) for (let i = 2; i + 2 < w; i += 4) if (nz(i + x, y + s) > 0.3) { rect(b, x + i, y + 3, 2, 5, FT[3]); }
  const cx = x + w / 2;
  if (kind === 0) for (let j = 0; j < w + 6; j++) { const hw = (w / 2 + 2) * (1 - j / (w + 6)); for (let i = -hw; i <= hw; i++) put(b, cx + i, top - 1 - j, i < -hw * 0.2 ? FT[0] : FT[2]); }
  else if (kind === 1) { for (let j = 0; j < w / 2 + 2; j++) { const hw = (w / 2 + 1) * Math.sqrt(1 - (j / (w / 2 + 2)) ** 2); for (let i = -hw; i <= hw; i++) put(b, cx + i, top - 1 - j, i < -hw * 0.3 ? FT[0] : i > hw * 0.4 ? FT[2] : FT[1]); } rect(b, cx - 0.5, top - w / 2 - 6, 1, 4, FT[2]); }
  else if (kind === 2) { rect(b, x - 2, top - 2, w + 4, 3, FT[1]); rect(b, x - 2, top - 2, w + 4, 1, FT[0]); for (let i = -2; i < w + 2; i += 3) rect(b, x + i, top - 5, 2, 3, FT[1]); }
}
function domeF(b, x, base, r, drumH, s) {
  const top = base - drumH;
  for (let y = top; y < base; y++) for (let i = -r + 2; i <= r - 2; i++) put(b, x + i, y, i < -r + 4 ? FT[0] : i > r - 5 ? FT[2] : FT[1]);
  for (let i = -r + 5; i < r - 4; i += 5) rect(b, x + i, top + 3, 2, Math.max(2, drumH - 7), FT[3]);
  rect(b, x - r + 1, top - 1, 2 * r - 1, 2, FT[0]);
  const ry = Math.round(r * 0.85), broken = nz(s, 51) < 0.35;
  for (let j = 0; j <= ry; j++) {
    const hw = r * Math.sqrt(1 - (j / (ry + 0.5)) ** 2);
    for (let i = -hw; i <= hw; i++) {
      if (broken && i > r * 0.15 && j > ry * 0.25 + (i - r * 0.15) * 0.4 - nz(Math.round(i), s) * 4) continue;
      const rib = Math.abs(((i / (hw + 0.01)) * 3 + 9) % 1 - 0.5) < 0.08 && j < ry - 1;
      put(b, x + i, top - 2 - j, rib ? FT[2] : i < -hw * 0.25 && j > ry * 0.2 ? FT[0] : i > hw * 0.45 ? FT[2] : FT[1]);
    }
  }
  if (!broken) { rect(b, x - 1, top - ry - 6, 3, 4, FT[1]); put(b, x - 1, top - ry - 6, FT[0]); oval(b, x, top - ry - 7, 1.5, 1.2, FT[1]); }
}
function pyramidF(b, x, base, w, s) {
  const steps = 5 + Math.floor(nz(s, 52) * 3), sh = 5;
  for (let k = 0; k < steps; k++) {
    const inset = k * w / (steps * 2.4), y = base - (k + 1) * sh;
    rect(b, x + inset, y, w - 2 * inset, sh, FT[1]); rect(b, x + inset, y, w - 2 * inset, 1, FT[0]); rect(b, x + w - inset - 3, y, 3, sh, FT[2]);
  }
  const tw = w - 2 * (steps * w / (steps * 2.4)), ty = base - steps * sh;
  rect(b, x + w / 2 - 4, ty - 8, 8, 8, FT[1]); rect(b, x + w / 2 - 2, ty - 6, 3, 6, FT[3]); rect(b, x + w / 2 - 5, ty - 9, 10, 1, FT[0]);
  rect(b, x + w / 2 - 1, base - steps * sh + 1, 2, steps * sh - 1, FT[2]);
}
function aqueductF(b, x, base, w, h, s) {
  const top = base - h, span = 14;
  rect(b, x, top, w, 6, FT[1]); rect(b, x, top, w, 1, FT[0]); rect(b, x, top + 5, w, 1, FT[2]);
  for (let px = x; px < x + w; px += span) {
    if (nz(px, s) < 0.18) continue;
    rect(b, px, top + 6, 4, h - 6, FT[1]); put(b, px, top + 6, FT[0]); rect(b, px, top + 6, 1, h - 6, FT[0]); rect(b, px + 3, top + 6, 1, h - 6, FT[2]);
    for (let i = 4; i < span; i++) { const t = (i - 4) / (span - 4), ay = Math.round(Math.sin(t * Math.PI) * 4); rect(b, px + i, top + 6, 1, 4 - ay + 1, FT[1]); }
  }
  // a broken gap
  const gx = x + Math.floor(nz(s, 53) * (w - 20));
  for (let i = 0; i < 12; i++) for (let y = top; y < top + 6 + nz(i, s) * 4; y++) put(b, gx + i, y, NONE);
}
function blockF(b, x, base, w, h, s) {
  for (let y = base - h; y < base; y++) for (let i = 0; i < w; i++) put(b, x + i, y, i < 2 ? FT[0] : i > w - 3 ? FT[2] : FT[1]);
  rect(b, x - 1, base - h - 2, w + 2, 2, FT[0]);
  for (let i = 3; i < w - 3; i += 5) rect(b, x + i, base - h + 4, 2, h - 6, FT[2]);
  if (nz(s, 54) < 0.5) { // pediment
    for (let j = 0; j < w / 3; j++) { const hw = (w / 2 + 1) * (1 - j / (w / 3)); rect(b, x + w / 2 - hw, base - h - 3 - j, hw * 2, 1, j === 0 ? FT[2] : FT[1]); }
  }
}
function paintFar() {
  const p = FAR_P, w = stripW(p), b = buf(w, H, 10, 0);
  const hill = x => 198 + (fbm(x * 0.009, 3.3, 11) - 0.5) * 30 - ss(LX(p, 300), LX(p, 470), x) * ss(LX(p, 720), LX(p, 560), x) * 16;
  let x = -8, n = 0;
  while (x < w - 10) {
    const r = nz(n, 31), base = Math.round(hill(x + 10)) + 3;
    if (r < 0.22) { const rr = 9 + Math.floor(nz(n, 32) * 9); domeF(b, x + rr, base, rr, 10 + Math.floor(nz(n, 33) * 16), n); x += rr * 2 + 3; }
    else if (r < 0.5) { const tw = 7 + Math.floor(nz(n, 34) * 6), th = 36 + Math.floor(nz(n, 35) * 66); towerF(b, x, base, tw, th, n); x += tw + 2 + Math.floor(nz(n, 36) * 9); }
    else if (r < 0.62) { const pw = 38 + Math.floor(nz(n, 37) * 26); pyramidF(b, x, base, pw, n); x += pw + 3; }
    else if (r < 0.78) { const aw = 46 + Math.floor(nz(n, 38) * 50); aqueductF(b, x, base, aw, 24 + Math.floor(nz(n, 39) * 16), n); x += aw + 2; }
    else { const bw = 18 + Math.floor(nz(n, 40) * 16), bh = 18 + Math.floor(nz(n, 41) * 24); blockF(b, x, base, bw, bh, n); x += bw + 3; }
    n++;
  }
  for (let xx = -10; xx < w - 10; xx++) { const y0 = Math.round(hill(xx)); for (let y = y0; y < H; y++) put(b, xx, y, y < y0 + 1 ? FT[1] : FT[2]); }
  hazeW(b, (x2, y) => 0.68 + ss(140, 235, y) * 0.2);
  return mk(b);
}

// ------------------------------------------------------------ STATUES: the sunken sea king's head and a temple (parallax 0.2)
const ST = P('#d9eae2', '#a8c7c4', '#77999f', '#506f81');            // weathered marble: light, mid, dark, deep
const MOSS = P('#86c49a', '#5c9e80', '#3f7a6c');
const CORAL = { pink: P('#ffb0c4', '#f0708e', '#b5466a'), orange: P('#ffd08a', '#f59a4a', '#b8612e'), purple: P('#e2b6f0', '#b27fd4', '#7a4fa4'), teal: P('#a6f0dc', '#5ccab4', '#2f8a84') };
const LIGHT = (() => { const l = [-0.45, -0.75, 0.5], m = Math.hypot(...l); return l.map(v => v / m); })();
function toneN(nx, ny, nzz, bias = 0) {
  const d = nx * LIGHT[0] + ny * LIGHT[1] + nzz * LIGHT[2] + bias;
  return d > 0.74 ? 0 : d > 0.45 ? 1 : d > 0.16 ? 2 : 3;
}
// the head, face-on, in local coords (u right, v down, 0 at the middle of the face): a tone index, or -1 outside
function headTone(u, v) {
  const sph = (cu, cv, ru, rv) => { const a = (u - cu) / ru, c = (v - cv) / rv, q = a * a + c * c; return q > 1 ? null : [a, c, Math.sqrt(1 - q)]; };
  // eyes: carved pupils looking a little to the right (at the hero's fight)
  for (const s of [-1, 1]) {
    const e = sph(s * 14, -4, 7.5, 3.4);
    if (e) { const pu = (u - (s * 14 - 2.5)) ** 2 + ((v + 3.6) * 1.3) ** 2; if (pu < 5.5) return 3; if (v < -6) return 2; return 0; }
  }
  // brows
  for (const s of [-1, 1]) { const e = sph(s * 14, -10, 10, 2.6); if (e && v < -9) return toneN(e[0] * 0.5, -0.8, 0.4); }
  // nose: a ridge lit on its left side
  if (v > -12 && v < 10) { const hw = 3.5 + (v + 12) * 0.16; if (Math.abs(u) < hw) { const s = u / hw; return v > 7 && Math.abs(s) > 0.35 ? 3 : toneN(s * 0.8, 0.1, 0.6); } }
  // mustache: two curling lobes
  for (const s of [-1, 1]) { const e = sph(s * 10, 14 + Math.abs(u) * 0.08, 11, 4.2); if (e) return toneN(e[0], e[1] * 0.8 - 0.2, e[2]); }
  if (v > 18.5 && v < 21 && Math.abs(u) < 7) return 3;
  // beard: wavy carved locks hanging from the cheeks and chin, each ending in a curl
  const be = sph(0, 22, 31, 28);
  if (be && v > 11) {
    const li = Math.round(u / 6.5), uc = li * 6.5 + Math.sin(v * 0.32 + li * 1.7) * 1.6, du = (u - uc) / 3.1;
    const endV = 38 + Math.cos(li * 1.3) * 6 - Math.abs(li) * 1.2;
    if (v > endV + 3) return -1;
    if (Math.abs(du) > 1) return 3;
    if (v > endV) { const c = sph(uc + 1.5, endV + 1.5, 3, 2.6); return c ? toneN(c[0], c[1], c[2]) : -1; }
    const nk = Math.sqrt(Math.max(0, 1 - du * du));
    return (Math.round(v + li * 3) % 7 === 0) ? 3 : toneN(du * 0.9 + be[0] * 0.3, be[1] * 0.4 - 0.15, nk);
  }
  // ears
  for (const s of [-1, 1]) { const e = sph(s * 35, -2, 5, 10); if (e) return Math.abs(u - s * 35) < 2 && Math.abs(v + 2) < 6 ? 3 : toneN(e[0], e[1], e[2]); }
  // crown: a band set with round bosses, seven short points with pearls (the middle one tallest; one pearl lost)
  if (v > -39 && v < -28 && Math.abs(u) < 37) {
    const cyl = [u / 40, -0.2, Math.sqrt(Math.max(0, 1 - (u / 40) ** 2))];
    if (v < -37) return toneN(cyl[0], -0.9, cyl[2]);
    if (v > -30) return 2;
    const gi = Math.round(u / 10), gu = u - gi * 10, g2 = gu * gu + (v + 33.5) ** 2;
    if (g2 < 6.5) return g2 < 2.5 && gu < 0 ? 0 : 1;
    return toneN(cyl[0], cyl[1], cyl[2]) === 0 ? 1 : 2;
  }
  for (let k = -3; k <= 3; k++) {
    const pu = k * 10.5, ph = k === 0 ? 17 : 11 - Math.abs(k) * 1.2, top = -39 - ph;
    if (v <= -39 && v > top) { const hw = 4.2 * (1 - (-39 - v) / ph) + 0.8; if (Math.abs(u - pu) < hw) return u - pu < -hw * 0.25 ? 0 : u - pu > hw * 0.4 ? 2 : 1; }
    if (k !== 2) { const e = sph(pu, top - 1.8, 2.8, 2.8); if (e) return toneN(e[0], e[1], e[2]); }
  }
  // the face itself
  const f = sph(0, 2, 34, 41);
  if (f) {
    let t = toneN(f[0], f[1], f[2]);
    for (const s of [-1, 1]) { const so = sph(s * 14, -4, 10, 5.5); if (so) t = Math.min(3, t + 1); }
    if (Math.abs(u) > 18 && v > 2 && v < 12) t = Math.min(3, t + (Math.abs(u) > 26 ? 1 : 0));
    return t;
  }
  return -1;
}
function paintStatues() {
  const p = STAT_P, w = stripW(p), b = buf(w, H, 10, 0);
  const dune = x => 216 + (fbm(x * 0.02, 7.1, 21) - 0.5) * 12;
  // --- temple facade (left of the head)
  const tx = LX(p, 4), tb = 214;
  for (let k = 0; k < 3; k++) { rect(b, tx - 8 + k * 4, tb - (k + 1) * 4, 122 - k * 8, 4, ST[1]); rect(b, tx - 8 + k * 4, tb - (k + 1) * 4, 122 - k * 8, 1, ST[0]); rect(b, tx - 8 + k * 4, tb - (k + 1) * 4 + 3, 122 - k * 8, 1, ST[2]); }
  const colTop = tb - 12 - 62;
  for (let c = 0; c < 6; c++) {
    const cx = tx + 6 + c * 19, broken = c === 4 ? 30 : c === 1 ? 9 : 0;
    for (let y = colTop + 6 + broken; y < tb - 12; y++) for (let i = 0; i < 9; i++) {
      const jag = broken && y < colTop + 6 + broken + nz(i, c) * 5;
      if (!jag) put(b, cx + i, y, i < 2 ? ST[0] : i > 6 ? ST[2] : (i % 3 === 1 ? ST[2] : ST[1]));
    }
    rect(b, cx - 2, tb - 15, 13, 3, ST[1]); rect(b, cx - 2, tb - 15, 13, 1, ST[0]);
    if (!broken) { rect(b, cx - 2, colTop + 3, 13, 3, ST[1]); rect(b, cx - 2, colTop + 3, 13, 1, ST[0]); rect(b, cx - 1, colTop + 6, 11, 1, ST[2]); }
    else { // the fallen drum of this column, lying at its foot
      const fx = cx + 14 + c * 2;
      for (let i = 0; i < 18; i++) for (let j = 0; j < 9; j++) put(b, fx + i, tb - 21 + j, j < 2 ? ST[0] : j > 6 ? ST[2] : (i % 3 === 0 ? ST[2] : ST[1]));
      oval(b, fx + 18, tb - 17, 2, 4, ST[2]);
    }
  }
  // entablature and the pediment (the right end is broken off)
  for (let i = -6; i < 120; i++) {
    if (i > 84 + nz(i, 3) * 6) continue;
    rect(b, tx + i, colTop - 4, 1, 9, ST[1]); put(b, tx + i, colTop - 4, ST[0]); put(b, tx + i, colTop + 4, ST[2]);
    if (i % 4 === 0) put(b, tx + i, colTop + 2, ST[2]);
    const ph = Math.max(0, 22 - Math.abs(i - 57) * 0.36);
    for (let j = 0; j < ph; j++) put(b, tx + i, colTop - 5 - j, j > ph - 2 ? ST[0] : j < 2 ? ST[2] : ST[1]);
  }
  oval(b, tx + 57, colTop - 13, 5, 4, ST[2]); oval(b, tx + 56, colTop - 14, 3, 2, ST[0]);       // a scallop shell boss
  // --- the giant head of the sea king, tilted, half sunk in the sand
  const hx = LX(p, 426), hy = 146, HS = 1.22, ang = 0.13, ca = Math.cos(ang), sa = Math.sin(ang);
  const hp = (u, v) => [hx + (u * ca - v * sa) * HS, hy + (u * sa + v * ca) * HS];
  for (let y = hy - 110; y < hy + 80; y++) for (let x = hx - 80; x < hx + 80; x++) {
    const dx = (x + 0.5 - hx) / HS, dy = (y + 0.5 - hy) / HS, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    const t = headTone(u, v);
    if (t >= 0) put(b, x, y, ST[t]);
  }
  // cracks
  path(b, [hp(-6, -40), hp(-9, -32), hp(-5, -24), hp(-11, -16)], ST[3]);
  path(b, [hp(24, 4), hp(29, 12), hp(26, 18)], ST[3]);
  // moss on the upward-facing light stone; coral and a sea fan on the crown; a starfish on the cheek
  for (let y = hy - 115; y < hy + 50; y++) for (let x = hx - 75; x < hx + 75; x++) {
    const c = get(b, x, y);
    if (c !== ST[0] && c !== ST[1]) continue;
    if (get(b, x, y - 1) === NONE || get(b, x, y - 2) === NONE) { if (nz(x, y) < 0.7) put(b, x, y, nz(x + 1, y) < 0.5 ? MOSS[0] : MOSS[1]); }
    else if (fbm(x * 0.15, y * 0.15, 5) > 0.7) put(b, x, y, MOSS[c === ST[0] ? 0 : 1]);
  }
  { const [x, y] = hp(-26, -48); coralFan(b, x, y, 11, CORAL.purple, 3); }
  { const [x, y] = hp(16, -51); coralBranch(b, x, y, 8, CORAL.pink, 4); }
  { const [x, y] = hp(30, -40); tubeSponge(b, x, y, 3, CORAL.orange, 6); }
  { const [x, y] = hp(-22, 8); starfish(b, x, y, 4.6, P('#ffc07a', '#ff8f4a', '#c4582e'), 0.4); }
  // seaweed hanging off the crown over the right ear
  { const [x, y] = hp(34, -36); for (let k = 0; k < 3; k++) { let px = x + k * 2, py = y; for (let j = 0; j < 26 + k * 6; j++) { const nx = px + Math.sin(j * 0.25 + k) * 0.7; put(b, nx, py + j, j % 5 === 0 ? MOSS[0] : MOSS[1 + (k % 2)]); px = nx; } } }
  // --- a small standing sea guardian far on the right (other cameras)
  guardian(b, LX(p, 640), 214, ST);
  // the sand dune in front buries their feet
  for (let x = -10; x < w - 10; x++) { const y0 = Math.round(dune(x)); for (let y = y0; y < H; y++) put(b, x, y, y < y0 + 1 ? I('#b9cdc0') : y < y0 + 3 ? I('#93ada8') : I('#7896a0')); }
  hazeW(b, (x, y) => 0.48 + ss(150, 240, y) * 0.2);
  return mk(b);
}
function guardian(b, x, base, S) {
  rect(b, x - 9, base - 10, 20, 10, S[1]); rect(b, x - 9, base - 10, 20, 1, S[0]); rect(b, x + 8, base - 10, 3, 10, S[2]);
  poly(b, [[x - 6, base - 10], [x - 8, base - 50], [x - 3, base - 62], [x + 5, base - 62], [x + 9, base - 50], [x + 7, base - 10]], S[1]);
  rect(b, x - 7, base - 50, 3, 40, S[0]); rect(b, x + 5, base - 50, 3, 40, S[2]);
  oval(b, x + 1, base - 68, 6, 7, S[1]); oval(b, x - 1, base - 70, 3, 3, S[0]);
  line(b, x + 12, base - 12, x + 12, base - 86, S[2], 2); line(b, x + 8, base - 86, x + 16, base - 86, S[2], 2);
  for (const d of [-4, 0, 4]) line(b, x + 12 + d, base - 86, x + 12 + d, base - 93, S[1]);
  line(b, x + 8, base - 52, x + 12, base - 58, S[1], 2);
}
function coralBranch(b, x, y, s, pal, seed) {
  const rec = (x0, y0, a, len, d) => {
    if (d > 3 || len < 2) return;
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    line(b, x0, y0, x1, y1, pal[2], 2); line(b, x0, y0 - 1, x1, y1 - 1, pal[1]);
    put(b, x1, y1 - 1, pal[0]);
    rec(x1, y1, a - 0.45 - nz(d, seed) * 0.2, len * 0.72, d + 1); rec(x1, y1, a + 0.4 + nz(d + 5, seed) * 0.2, len * 0.7, d + 1);
  };
  rec(x, y, -Math.PI / 2 - 0.25, s, 0); rec(x, y, -Math.PI / 2 + 0.35, s * 0.8, 1);
}
function coralFan(b, x, y, r, pal, seed) {
  for (let j = 0; j <= r; j++) for (let i = -r; i <= r; i++) {
    const q = (i * i) / (r * r) + (j * j) / (r * r * 0.7);
    if (q > 1 || j > r * 0.95) continue;
    const net = ((i + 40) % 3 === 0) || ((j + i * 0.3 + 40) % 4 < 1);
    if (net || q > 0.85) put(b, x + i, y - j, q > 0.85 ? pal[2] : (i < 0 ? pal[0] : pal[1]));
  }
  line(b, x, y, x, y + 3, pal[2], 2);
}
function tubeSponge(b, x, y, n, pal, seed) {
  // a cluster of hollow tube sponges: leaning tubes, flared rims, dark mouths, bumpy skin
  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  order.sort((p0, q) => nz(q, seed + 1) - nz(p0, seed + 1));
  for (const i of order) {
    const xx = x + (i - (n - 1) / 2) * 4.5, hh = 6 + nz(i, seed) * 9, lean = (i - (n - 1) / 2) * 0.18;
    for (let j = 0; j < hh; j++) {
      const cx2 = xx + lean * j, w2 = 2 + (j > hh - 3 ? 1 : 0);
      for (let k = -w2; k <= w2 - 1; k++) put(b, cx2 + k, y - j, k === -w2 ? pal[0] : k === w2 - 1 ? pal[2] : (nz(j + i * 7, k + seed) > 0.8 ? pal[2] : pal[1]));
    }
    const tx = xx + lean * hh;
    rect(b, tx - 3, y - hh - 1, 6, 1, pal[0]); rect(b, tx - 2, y - hh, 4, 1, I('#4a2a2a')); put(b, tx + 2, y - hh, pal[2]);
  }
}
function starfish(b, x, y, r, pal, rot) {
  for (let j = -r - 1; j <= r + 1; j++) for (let i = -r - 1; i <= r + 1; i++) {
    const a = Math.atan2(j, i) - rot, d = Math.hypot(i, j), arm = (Math.cos(a * 5) + 1) / 2, rr = r * (0.42 + 0.58 * Math.pow(arm, 1.6));
    if (d <= rr) put(b, x + i, y + j, d < rr - 1.2 ? (j < -0.5 ? pal[0] : pal[1]) : pal[2]);
  }
}

// ------------------------------------------------------------ MID: broken colonnades, arcades and coral (parallax 0.42)
const MT = P('#c6ddd6', '#93b7b8', '#668d9a', '#46677c');
function column(b, x, base, h, w, S, broken, s) {
  const top = base - h;
  for (let i = 0; i < w; i++) {
    const jag = broken ? Math.floor(nz(i, s) * 6 + Math.abs(i - w * 0.6) * 0.7) : 0;
    for (let y = top + 5 + jag; y < base - 3; y++) put(b, x + i, y, i < 2 ? S[0] : i >= w - 2 ? S[2] : (i % 3 === 1 ? S[2] : S[1]));
    if (broken) put(b, x + i, top + 5 + jag, S[0]);
  }
  rect(b, x - 2, base - 3, w + 4, 3, S[1]); rect(b, x - 2, base - 3, w + 4, 1, S[0]); rect(b, x - 2, base - 1, w + 4, 1, S[2]);
  if (!broken) { rect(b, x - 2, top + 1, w + 4, 3, S[1]); rect(b, x - 2, top + 1, w + 4, 1, S[0]); rect(b, x - 1, top + 4, w + 2, 1, S[2]); }
}
function arcade(b, x, base, n, span, pierW, h, S, s) {
  const top = base - h, r = span / 2;
  for (let k = 0; k <= n; k++) column(b, x + k * (span + pierW), base, h - 6, pierW, S, false, s + k);
  const x1 = x + n * (span + pierW) + pierW;
  for (let xx = x - 2; xx < x1 + 2; xx++) {
    if (nz(xx >> 2, s) < 0.08) continue;
    for (let y = top - 8; y < top; y++) put(b, xx, y, y === top - 8 ? S[0] : y === top - 1 ? S[2] : S[1]);
    // arch spandrels between the piers
    const k = Math.floor((xx - x) / (span + pierW)), lx = xx - x - k * (span + pierW) - pierW;
    if (k >= 0 && k < n && lx >= 0 && lx < span) {
      const d = Math.sqrt(Math.max(0, r * r - (lx - r + 0.5) ** 2)), ay = Math.round(top + 6 - d * 0.7 + r * 0.7 - r);
      for (let y = top; y < Math.min(base, top + Math.max(0, Math.round(r - d) + 2)); y++) put(b, xx, y, y === top ? S[2] : S[1]);
      put(b, xx, top + Math.round(r - d) + 2, S[0]);
    }
  }
}
function seagrass(b, x, base, n, h, pal, seed) {
  for (let k = 0; k < n; k++) {
    const x0 = x + (k - n / 2) * 2, hh = h * (0.5 + nz(k, seed) * 0.6), bend = (nz(k + 9, seed) - 0.5) * 10;
    for (let j = 0; j < hh; j++) { const t = j / hh; put(b, x0 + bend * t * t, base - j, t > 0.75 ? pal[0] : k % 2 ? pal[1] : pal[2]); }
  }
}
function paintMid() {
  const p = MID_P, w = stripW(p), b = buf(w, H, 10, 0);
  const dune = x => 229 + (fbm(x * 0.017, 2.2, 31) - 0.5) * 10;
  // groups along the strip; a few placed to frame the mock
  const groups = [];
  for (let x = 0, n = 0; x < w; n++) {
    const r = nz(n, 61);
    groups.push({ x, r, n });
    x += 70 + Math.floor(nz(n, 62) * 80);
  }
  const clear = [LX(p, 372), LX(p, 486)];
  for (const g of groups) {
    const base = Math.round(dune(g.x + 20)) + 2, s = g.n * 7;
    if (g.x + 90 > clear[0] && g.x < clear[1]) g.r = 0.7;
    if (g.r < 0.38) {
      const nCol = 3 + Math.floor(nz(g.n, 63) * 3), h = 58 + Math.floor(nz(g.n, 64) * 30);
      for (let k = 0; k < nCol; k++) column(b, g.x + k * 17, base, h, 9, MT, nz(k, s) < 0.35, s + k);
      const lw = Math.floor(nCol * 17 * (0.4 + nz(g.n, 65) * 0.5));
      if (nz(g.n, 66) < 0.7) for (let xx = g.x - 3; xx < g.x - 3 + lw; xx++) for (let y = base - h - 7; y < base - h + 1; y++) put(b, xx, y, y === base - h - 7 ? MT[0] : y === base - h ? MT[2] : (xx % 7 === 0 && y > base - h - 4 ? MT[2] : MT[1]));
    } else if (g.r < 0.62) {
      arcade(b, g.x, base, 2 + Math.floor(nz(g.n, 67) * 2), 18, 7, 52 + Math.floor(nz(g.n, 68) * 20), MT, s);
    } else if (g.r < 0.8) {
      // broken stumps and a fallen column
      for (let k = 0; k < 3; k++) column(b, g.x + k * 22, base, 18 + Math.floor(nz(k, s) * 26), 9, MT, true, s + k);
      for (let i = 0; i < 40; i++) for (let j = 0; j < 9; j++) put(b, g.x + 10 + i, base - 9 + j, j < 2 ? MT[0] : j > 6 ? MT[2] : ((i % 9) < 1 ? MT[3] : (i % 3 === 0 ? MT[2] : MT[1])));
    } else {
      // a statue on a plinth
      guardian(b, g.x + 12, base, MT);
    }
    // coral and grass on and around
    coralBranch(b, g.x - 6, base - 1, 7, CORAL.pink, s);
    tubeSponge(b, g.x + 40, base, 3, CORAL.orange, s);
    seagrass(b, g.x + 26, base, 6, 14, MOSS, s);
  }
  for (let x = -10; x < w - 10; x++) { const y0 = Math.round(dune(x)); for (let y = y0; y < H; y++) put(b, x, y, y < y0 + 1 ? I('#b4cbbf') : y < y0 + 3 ? I('#8eaaa6') : I('#6f8f9b')); }
  hazeW(b, (x, y) => 0.4 + ss(170, 250, y) * 0.14);
  return mk(b);
}

// ------------------------------------------------------------ WORLD: the landmark arches (world x 3660, 3990, 4440, 4720)
const RS = P('#c9e0d6', '#98bdb9', '#6d95a0', '#4b6d82', '#2c4760');  // world stone: light, mid, dark, deep, edge
function archSprite(cxW, opt) {
  const g = Math.round(GA(cxW)), span = opt.span, pw = opt.pw, ph = opt.h, R0 = span / 2, R1 = R0 + opt.ring;
  const left = cxW - R1 - 8, top = g - ph - R1 - 34, b = buf(Math.ceil(2 * R1 + 16 + 40), g - top + 6, -left, -top);
  const lx = cxW - R0 - pw, rx = cxW + R0, spring = g - ph;
  const block = (x, y, x0, y0) => { const row = Math.floor((y - y0) / 9), off = row % 2 ? 7 : 0; return ((x - x0 + off) % 14 === 0) || ((y - y0) % 9 === 0); };
  // pillars (stacked blocks, capital and base)
  const pillar = (x0, broken) => {
    for (let i = 0; i < pw; i++) {
      const jag = broken ? Math.floor(nz(i, x0) * 7 + i * 0.5) : 0;
      for (let y = spring + 4 + jag + (broken || 0); y < g - 4; y++) {
        let c = i < 2 ? RS[0] : i >= pw - 3 ? RS[2] : RS[1];
        if (i === pw - 1) c = RS[3];
        if (block(x0 + i, y, x0, spring) && i > 0 && i < pw - 1) c = i < 2 ? RS[1] : RS[3];
        put(b, x0 + i, y, c);
      }
    }
    rect(b, x0 - 3, g - 5, pw + 6, 5, RS[1]); rect(b, x0 - 3, g - 5, pw + 6, 1, RS[0]); rect(b, x0 + pw, g - 5, 3, 5, RS[2]);
    if (!broken) { rect(b, x0 - 3, spring, pw + 6, 5, RS[1]); rect(b, x0 - 3, spring, pw + 6, 1, RS[0]); rect(b, x0 - 3, spring + 4, pw + 6, 1, RS[3]); rect(b, x0 + pw, spring, 3, 5, RS[2]); }
  };
  pillar(lx, opt.brokenL ? opt.brokenL : 0);
  pillar(rx, 0);
  // the ring of wedge stones; the left half missing when broken
  const nV = 11;
  for (let y = spring - R1 - 2; y <= spring + 1; y++) for (let x = cxW - R1 - 2; x <= cxW + R1 + 2; x++) {
    const dx = x - cxW + 0.5, dy = y - spring + 0.5, d = Math.hypot(dx, dy);
    if (dy > 0.5 || d < R0 || d > R1) continue;
    const a = Math.atan2(-dy, dx), k = Math.floor(a / Math.PI * nV);
    if (opt.halfBroken && a > Math.PI * (0.5 + nz(Math.round(d), 77) * 0.12)) continue;
    const edge = Math.abs(a / Math.PI * nV - Math.round(a / Math.PI * nV)) < 0.5 / (d * Math.PI / nV) * 1.4;
    let c = d > R1 - 1.6 ? (dy < -R1 * 0.6 || dx < 0 ? RS[0] : RS[1]) : d < R0 + 1.6 ? RS[3] : (dx < -R0 * 0.2 ? RS[0] : RS[1]);
    if (d > R1 - 1.6 && dx > R1 * 0.55) c = RS[2];
    if (edge) c = RS[3];
    put(b, x, y, c);
  }
  // weathering: chipped outer edge, moss on top faces, barnacles
  for (let y = top; y < g; y++) for (let x = left; x < left + b.w; x++) {
    const c = get(b, x, y);
    if (c === NONE) continue;
    const upN = get(b, x, y - 1) === NONE;
    if (upN && nz(x, y + 3) < 0.13) { put(b, x, y, NONE); continue; }
    if (upN || (get(b, x, y - 2) === NONE && nz(x, y) < 0.6)) put(b, x, y, nz(x + 3, y) < 0.55 ? MOSS[0] : MOSS[1]);
    else if (fbm(x * 0.2, y * 0.2, 9) > 0.7 && c !== RS[3]) put(b, x, y, c === RS[0] ? MOSS[0] : MOSS[1]);
    else if (nz(x * 7, y) > 0.985) put(b, x, y, I('#e8efe6'));
  }
  // keystone: a big carved scallop shell standing proud of the ring
  if (opt.keystone) {
    const ky = spring - R1 + 1, SH = P('#e4f0ea', '#b8d4cc', '#86aab0', '#5d7f8e');
    poly(b, [[cxW - 7, ky - 1], [cxW + 8, ky - 1], [cxW + 6, ky + opt.ring], [cxW - 5, ky + opt.ring]], RS[1]);
    line(b, cxW + 6, ky, cxW + 5, ky + opt.ring, RS[2]);
    for (let j = 0; j <= 12; j++) for (let i = -10; i <= 10; i++) {
      const q = (i * i) / 110 + ((j - 12) ** 2) / 150;
      if (q > 1) continue;
      const a = Math.atan2(12 - j, i), rib = Math.abs(((a / Math.PI) * 9) % 1 - 0.5) < 0.17;
      put(b, cxW + i, ky - 10 + j, q > 0.86 ? SH[3] : rib ? SH[2] : (i < -2 ? SH[0] : SH[1]));
    }
    rect(b, cxW - 4, ky + 1, 9, 3, SH[2]); rect(b, cxW - 3, ky + 1, 7, 1, SH[1]); put(b, cxW, ky - 6, SH[0]);
  }
  outline(b, RS[4]);
  // overgrowth on the crown (dy = 'top': on the ring at dx) and the pillars (dy = height above the ground)
  for (const [kind, dx, dy, s] of opt.grow) {
    const x = cxW + dx, y = dy === 'top' ? Math.round(spring - Math.sqrt(Math.max(0, R1 * R1 - dx * dx))) + 1 : g - dy;
    if (kind === 'fan') coralFan(b, x, y, s, CORAL.purple, dx);
    else if (kind === 'branch') coralBranch(b, x, y, s, CORAL.pink, dx);
    else if (kind === 'tube') tubeSponge(b, x, y, s, CORAL.orange, dx);
    else if (kind === 'brain') { oval(b, x, y - s * 0.4, s, s * 0.6, CORAL.teal[2]); oval(b, x - 1, y - s * 0.45 - 1, s - 1, s * 0.55 - 1, CORAL.teal[1]); for (let i = -s + 2; i < s - 2; i += 2) put(b, x + i, y - s * 0.45 + Math.sin(i) * 1.5, CORAL.teal[0]); }
    else if (kind === 'anemone') anemone(b, x, y, s);
    else if (kind === 'star') starfish(b, x, y, s, P('#ffd37a', '#ff9d4a', '#b85a2c'), dx * 0.1);
    else if (kind === 'grass') seagrass(b, x, y, 5, s, MOSS, dx);
  }
  return b;
}
function anemone(b, x, y, s) {
  const pal = P('#ffd2e6', '#ff8fb8', '#c4507e');
  oval(b, x, y - 2, s * 0.6, 2.4, pal[2]);
  for (let k = -s; k <= s; k++) { const a = -Math.PI / 2 + k * 0.22, len = s * (0.9 + nz(k + 20, s) * 0.4); for (let j = 0; j < len; j++) put(b, x + Math.cos(a) * j * 0.8 + Math.sin(j * 0.6) * 0.6, y - 3 + Math.sin(a) * j, j > len - 2 ? pal[0] : pal[1]); }
}
const ARCHES = [
  { x: 3660, span: 46, pw: 15, h: 86, ring: 14, keystone: false, halfBroken: true, brokenL: 52, grow: [['grass', -42, 4, 16], ['tube', 30, 'top', 3], ['anemone', 36, 5, 5], ['branch', -36, 4, 8]] },
  { x: 3990, span: 58, pw: 18, h: 84, ring: 16, keystone: true, grow: [['fan', -26, 'top', 11], ['branch', 24, 'top', 9], ['brain', 38, 'top', 5], ['anemone', -42, 5, 6], ['tube', 46, 4, 4], ['star', -47, 50, 4], ['grass', 52, 4, 18]] },
  { x: 4440, span: 50, pw: 16, h: 70, ring: 13, keystone: true, grow: [['fan', 18, 'top', 10], ['brain', -30, 'top', 5], ['tube', -30, 4, 3], ['anemone', 40, 5, 5], ['grass', -50, 4, 14]] },
  { x: 4720, span: 44, pw: 15, h: 90, ring: 14, keystone: false, halfBroken: true, brokenL: 40, grow: [['branch', 26, 'top', 9], ['brain', -38, 4, 6], ['star', 34, 44, 4], ['grass', 48, 4, 16]] }
];

// ------------------------------------------------------------ WORLD: a colossal stone hand rising from the sand, gripping a bronze trident (x 4232)
const HAND = { x: 4232 };
function paintHand() {
  const hx = HAND.x, g = Math.round(GA(hx)), b = buf(90, 186, -(hx - 42), -(g - 178));
  const BR = P('#a6dcc0', '#74b49c', '#4f8a7a', '#35635c');            // verdigris bronze
  const sx = hx + 15, top = g - 160;
  // the trident shaft, crossbar and three prongs (the right one snapped)
  for (let y = top; y < g + 2; y++) { put(b, sx - 1, y, BR[0]); put(b, sx, y, BR[1]); put(b, sx + 1, y, BR[2]); }
  for (let i = -11; i <= 11; i++) { const y = top + 4 + Math.round((i / 11) ** 2 * 3); put(b, sx + i, y, BR[0]); put(b, sx + i, y + 1, BR[1]); put(b, sx + i, y + 2, BR[3]); }
  const prong = (px, len, broken) => {
    for (let j = 0; j < len; j++) { const y = top + 3 - j; put(b, px - 1, y, BR[0]); put(b, px, y, BR[1]); put(b, px + 1, y, BR[2]); }
    if (!broken) { poly(b, [[px - 3, top + 4 - len], [px, top - 4 - len], [px + 4, top + 4 - len]], BR[1]); line(b, px - 2, top + 3 - len, px, top - 3 - len, BR[0]); put(b, px - 3, top + 6 - len, BR[2]); put(b, px + 3, top + 6 - len, BR[2]); }
    else for (let i = -1; i <= 1; i++) put(b, px + i, top + 3 - len - (i === 0 ? 1 : 0), BR[0]);
  };
  prong(sx, 19, false); prong(sx - 11, 13, false); prong(sx + 11, 7, true);
  oval(b, sx, top + 8, 2.5, 2, BR[1]); put(b, sx - 1, top + 7, BR[0]);
  // shaded marble capsules (lit from the top left) for the forearm, the hand and each finger
  const capsule = (x0, y0, x1, y1, r) => {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
    for (let y = Math.floor(Math.min(y0, y1) - r - 1); y <= Math.max(y0, y1) + r + 1; y++) for (let x = Math.floor(Math.min(x0, x1) - r - 1); x <= Math.max(x0, x1) + r + 1; x++) {
      const t = clamp(((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / L2, 0, 1), px = x + 0.5 - (x0 + dx * t), py = y + 0.5 - (y0 + dy * t), d = Math.hypot(px, py);
      if (d > r) continue;
      const nx = px / r, ny = py / r, l = -0.5 * nx - 0.7 * ny + 0.5 * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      put(b, x, y, d > r - 0.9 ? RS[3] : l > 0.6 ? RS[0] : l > 0.2 ? RS[1] : l > -0.2 ? RS[2] : RS[3]);
    }
  };
  capsule(hx - 1, g + 6, hx - 2, g - 40, 14);                     // forearm out of the sand
  capsule(hx - 6, g - 44, hx - 4, g - 70, 12);                    // the back of the hand
  for (let f = 0; f < 4; f++) { const y = g - 45 - f * 8.5, len = f === 0 ? 20 : 25 - Math.abs(f - 2) * 1.5; capsule(hx - 8, y, hx - 8 + len, y - 0.5, 4.4); }
  capsule(hx - 15, g - 76, hx + 6, g - 80, 4.6);                  // the thumb over the top
  // knuckle creases and lights, a fingernail on the thumb
  for (let f = 0; f < 4; f++) { const y = Math.round(g - 45 - f * 8.5), kx = hx + 3 + (f === 0 ? -2 : 0); for (let j = -2; j <= 2; j++) put(b, kx, y + j, RS[3]); put(b, kx + 6, y - 2, RS[0]); }
  rect(b, hx + 3, g - 83, 4, 2, RS[0]);
  // cracks and a wrist crease
  path(b, [[hx - 8, g - 4], [hx - 5, g - 12], [hx - 9, g - 20], [hx - 6, g - 26]], RS[3]);
  for (let x = hx - 12; x < hx + 10; x++) if (get(b, x, g - 37) !== NONE) put(b, x, g - 37, RS[3]);
  // weathering: moss on the top faces
  for (let y = g - 186; y < g; y++) for (let x = hx - 42; x < hx + 48; x++) {
    const c = get(b, x, y);
    if (c === NONE || BR.includes(c)) continue;
    if (get(b, x, y - 1) === NONE && nz(x, y) < 0.7) put(b, x, y, nz(x + 2, y) < 0.5 ? MOSS[0] : MOSS[1]);
    else if (fbm(x * 0.25, y * 0.25, 29) > 0.74) put(b, x, y, MOSS[1]);
  }
  outline(b, RS[4]);
  coralBranch(b, hx - 10, g - 84, 8, CORAL.pink, 7);
  anemone(b, hx + 8, g - 85, 4);
  starfish(b, hx - 9, g - 18, 4.4, P('#ffd37a', '#ff9d4a', '#b85a2c'), 0.7);
  tubeSponge(b, hx - 20, g - 1, 3, CORAL.orange, 9);
  return mk(b);
}

// fallen column drums and a toppled capital lying on the seabed (world sprites)
const RUBBLE = [3470, 4128, 4592, 4868];
function paintRubble(x0, seed) {
  const g = Math.round(GA(x0)), b = buf(80, 40, -(x0 - 40), -(g - 34));
  const drum = (x, y, len, r, a) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let u = 0; u <= len; u += 0.5) for (let v = -r; v <= r; v += 0.5) {
      const px = x + u * ca - v * sa, py = y + u * sa + v * ca, t = (v + r) / (2 * r), flute = Math.abs(((u * 0 + v * 1.6 + 40) % 3) - 1.5) < 0.35;
      put(b, px, py, t < 0.22 ? RS[0] : t > 0.78 ? RS[3] : flute ? RS[2] : RS[1]);
    }
    for (let v = -r; v <= r; v += 0.5) { const px = x + len * ca - v * sa, py = y + len * sa + v * ca; put(b, px, py, RS[2]); put(b, px + ca, py + sa, RS[3]); }
  };
  drum(x0 - 30, g - 6, 22, 6, -0.05 + nz(seed, 1) * 0.1);
  drum(x0 - 4, g - 5, 14, 5.5, 0.12);
  // a capital (the block on top of a column) tipped on its side
  rect(b, x0 + 14, g - 15, 16, 14, RS[1]); rect(b, x0 + 14, g - 15, 16, 2, RS[0]); rect(b, x0 + 27, g - 15, 3, 14, RS[2]);
  for (const sg of [0, 1]) { oval(b, x0 + 15 + sg * 14, g - 13, 3, 3, RS[0]); oval(b, x0 + 15 + sg * 14, g - 13, 1.5, 1.5, RS[2]); }
  for (let y = g - 34; y < g; y++) for (let x = x0 - 40; x < x0 + 40; x++) {
    const c = get(b, x, y);
    if (c === NONE) continue;
    if (get(b, x, y - 1) === NONE && nz(x, y) < 0.6) put(b, x, y, nz(x + 2, y) < 0.5 ? MOSS[0] : MOSS[1]);
  }
  outline(b, RS[4]);
  tubeSponge(b, x0 + 22, g - 15, 2, CORAL.orange, seed);
  coralBranch(b, x0 - 22, g - 12, 6, CORAL.pink, seed);
  anemone(b, x0 + 4, g - 10, 3);
  return mk(b);
}

// ------------------------------------------------------------ WORLD: the shipwreck (stern 3712, bow 3902) and its mast
const WOOD = P('#b0916c', '#866c53', '#5e4f45', '#3e3642', '#2a2433');
const WRECK = { sx: 3712, sy: 252, a: -0.105, len: 190 };
const hullBot = u => u < 18 ? (18 - u) * 0.9 : u > 150 ? ((u - 150) / 40) ** 2 * 38 : 0;
const hullTop = u => (u < 44 ? 57 : u > 156 ? 47 : 41) + ((u - 95) / 95) ** 2 * 3;
function shipPt(u, h) { const ca = Math.cos(WRECK.a), sa = Math.sin(WRECK.a); return [WRECK.sx + u * ca + h * sa, WRECK.sy + u * sa - h * ca]; }
function paintWreck() {
  const x0 = 3680, y0 = 30, b = buf(280, 230, -x0, -y0), ca = Math.cos(WRECK.a), sa = Math.sin(WRECK.a);
  const hole = (u, h) => u > 58 && u < 98 && h > 6 && h < 27 + Math.sin(u * 0.7) * 3 && Math.abs(u - 78) < 20 - Math.abs(h - 16) * 0.35 + nz(Math.round(u), Math.round(h)) * 3;
  // hull, pixel by pixel in ship coordinates
  for (let y = y0; y < y0 + 230; y++) for (let x = x0; x < x0 + 280; x++) {
    const dx = x + 0.5 - WRECK.sx, dy = y + 0.5 - WRECK.sy, u = dx * ca + dy * sa, h = dx * sa - dy * ca;
    if (u < 0 || u > WRECK.len) continue;
    const bot = hullBot(u), top = hullTop(u);
    if (h < bot || h > top) continue;
    let c;
    const fromTop = top - h;
    if (hole(u, h)) {
      // the breach: dark inside, ribs showing
      c = (Math.round(u) % 7 < 2) ? WOOD[2] : (h > 22 ? WOOD[4] : I('#1b2030'));
      if (Math.round(u) % 7 < 2 && Math.round(u) % 7 === 0) c = WOOD[1];
    } else if (fromTop < 2) c = fromTop < 1 ? WOOD[0] : WOOD[2];
    else if (fromTop >= 9 && fromTop < 13) c = fromTop < 10 ? WOOD[0] : fromTop > 11.5 ? WOOD[3] : WOOD[1];   // the wale
    else {
      const strake = Math.floor(fromTop / 4.5), seam = (fromTop % 4.5) < 0.9, butt = (Math.round(u + strake * 23) % 31) === 0;
      c = seam || butt ? WOOD[3] : (h < 10 ? WOOD[2] : (strake % 2 ? WOOD[1] : mixI(WOOD[1], WOOD[2], 0.35)));
      if (!seam && fromTop < 6) c = mixI(c, WOOD[0], 0.5);
      if (h < 24) c = mixI(c, WOOD[4], (24 - h) / 24 * 0.45);
    }
    // stern castle windows
    if (u > 6 && u < 40 && h > 44 && h < 52 && (Math.round(u) % 8) < 4) c = (h > 50 || Math.round(u) % 8 === 0) ? WOOD[0] : I('#22354a');
    // gun ports
    for (const gu of [108, 128, 146]) if (Math.abs(u - gu) < 3.5 && fromTop > 15 && fromTop < 22) c = (Math.abs(u - gu) > 2.7 || fromTop > 21) ? WOOD[0] : I('#161b28');
    put(b, x, y, c);
  }
  // the hole's jagged rim (lit splinters)
  for (let u = 56; u < 100; u += 1) for (let h = 4; h < 32; h += 1) {
    if (!hole(u, h)) continue;
    if (!hole(u, h + 1.2)) { const [px, py] = shipPt(u, h + 1); put(b, px, py, WOOD[0]); }
    if (!hole(u - 1.2, h) && nz(u, h) < 0.5) { const [px, py] = shipPt(u - 1, h); put(b, px, py, WOOD[1]); }
  }
  // gold glinting inside the breach (the treasure hold)
  for (const [u, h] of [[72, 10], [76, 9], [80, 10], [74, 12], [78, 11], [84, 9]]) { const [px, py] = shipPt(u, h); put(b, px, py, I('#d8a83a')); put(b, px + 1, py, I('#f6d66c')); }
  // stern castle rail and the forecastle rail: posts
  for (let u = 2; u < 44; u += 5) { const [px, py] = shipPt(u, hullTop(u)); line(b, px, py, px - 0.6, py - 6, WOOD[2]); }
  { const a0 = shipPt(1, 63), a1 = shipPt(44, 63); line(b, a0[0], a0[1], a1[0], a1[1], WOOD[1]); }
  for (let u = 158; u < 188; u += 5) { const [px, py] = shipPt(u, hullTop(u)); line(b, px, py, px - 0.5, py - 5, WOOD[2]); }
  { const a0 = shipPt(157, 52), a1 = shipPt(188, 52); line(b, a0[0], a0[1], a1[0], a1[1], WOOD[1]); }
  // rudder behind the transom
  { const [px, py] = shipPt(-2, 8); poly(b, [[px, py - 30], [px - 9, py - 26], [px - 10, py + 4], [px, py + 6]], WOOD[2]); line(b, px - 9, py - 26, px - 10, py + 4, WOOD[3]); line(b, px - 1, py - 30, px - 8, py - 27, WOOD[1]); }
  // bowsprit and the snapped foremast
  { const [px, py] = shipPt(186, 44); line(b, px, py, px + 34, py - 18, WOOD[3], 3); line(b, px, py - 1, px + 34, py - 19, WOOD[1]); }
  { const [fx, fy] = shipPt(168, hullTop(168)); line(b, fx, fy, fx - 3, fy - 34, WOOD[2], 4); line(b, fx - 1, fy, fx - 4, fy - 34, WOOD[0]); for (let i = -2; i <= 2; i++) put(b, fx - 3 + i, fy - 35 - nz(i, 5) * 4, WOOD[1]); }
  // main mast (leaning), crow's nest, the yard the cage hangs from, rigging, a torn sail and a tatty flag
  const MF = shipPt(136, hullTop(136)), MT = [3858, 44];
  line(b, MF[0], MF[1], MT[0], MT[1], WOOD[3], 6); line(b, MF[0] - 1, MF[1], MT[0] - 1, MT[1], WOOD[2], 4); line(b, MF[0] - 2, MF[1], MT[0] - 2, MT[1], WOOD[0], 1);
  for (let k = 1; k < 6; k++) { const t = k / 6, px = lerp(MF[0], MT[0], t), py = lerp(MF[1], MT[1], t); rect(b, px - 3, py, 7, 1, WOOD[3]); }
  const mastX = y => lerp(MF[0], MT[0], (MF[1] - y) / (MF[1] - MT[1]));
  const YL = [3790, 70], YR = [3914, 77];
  line(b, YL[0], YL[1], YR[0], YR[1], WOOD[3], 4); line(b, YL[0], YL[1] - 1, YR[0], YR[1] - 1, WOOD[1], 2); line(b, YL[0], YL[1] - 2, YR[0], YR[1] - 2, WOOD[0]);
  { const nx = mastX(60); rect(b, nx - 8, 56, 16, 7, WOOD[2]); rect(b, nx - 8, 56, 16, 1, WOOD[0]); for (let i = -7; i < 8; i += 3) rect(b, nx + i, 57, 1, 6, WOOD[3]); rect(b, nx - 9, 55, 18, 1, WOOD[1]); }
  // ropes: from the yard ends to the rails, one snapped and dangling; the rope that holds the cage
  const rope = I('#2a3140');
  { const r0 = shipPt(30, 64); path(b, [[YL[0] + 2, YL[1] + 2], [lerp(YL[0], r0[0], 0.5) + 3, lerp(YL[1], r0[1], 0.5) + 6], [r0[0], r0[1]]], rope); }
  { const r1 = shipPt(186, 50); path(b, [[YR[0] - 2, YR[1] + 2], [lerp(YR[0], r1[0], 0.5) + 4, lerp(YR[1], r1[1], 0.5) + 4], [r1[0], r1[1]]], rope); }
  path(b, [[MT[0], MT[1] + 2], [3880, 78], [3901, 96], [3907, 121]], rope);
  path(b, [[3906, 76], [3909, 90], [3906, 104], [3910, 116]], rope);
  for (const hx2 of [3800, 3838]) { rect(b, hx2, 68, 3, 1, rope); rect(b, hx2 + 1, 66, 1, 6, rope); }
  // torn sail hanging off the right half of the yard
  const SL = P('#d6d2b4', '#b2b094', '#868a7c', '#5f6870');
  for (let x = 3864; x < 3906; x++) {
    const ty = lerp(YL[1], YR[1], (x - YL[0]) / (YR[0] - YL[0])) + 2, len = 30 + Math.sin(x * 0.21) * 6 + nz(x, 41) * 10 - (x > 3896 ? (x - 3896) * 2.5 : 0);
    for (let j = 0; j < len; j++) {
      if (nz(x >> 1, (j + 30) >> 2) < 0.07 && j > 6) continue;
      const fold = Math.sin(x * 0.45 + j * 0.05);
      put(b, x, ty + j, j > len - 2 ? SL[3] : fold > 0.55 ? SL[0] : fold < -0.5 ? SL[2] : SL[1]);
    }
  }
  { const fx = MT[0] + 1; for (let i = 0; i < 12; i++) for (let j = 0; j < 7 - Math.floor(i / 4); j++) put(b, fx + i, MT[1] - 7 + j + Math.round(Math.sin(i * 0.6)), I('#2a2a36')); oval(b, fx + 5, MT[1] - 4, 1.6, 1.4, I('#d8d8cc')); put(b, fx + 4, MT[1] - 2, I('#d8d8cc')); put(b, fx + 6, MT[1] - 2, I('#d8d8cc')); }
  // barnacles low on the hull, algae on the rails, coral on the castle
  for (let i = 0; i < 70; i++) {
    const u = nz(i, 91) * 186, h = hullBot(u) + 1 + nz(i, 92) * 10, [px, py] = shipPt(u, h);
    if (get(b, px, py) !== NONE && !hole(u, h)) { put(b, px, py, I('#9aa49a')); put(b, px + 1, py, I('#6e786f')); if (nz(i, 93) < 0.3) put(b, px, py - 1, I('#c2c8b8')); }
  }
  for (let y = y0; y < y0 + 230; y++) for (let x = x0; x < x0 + 280; x++) {
    const c = get(b, x, y);
    if (c === NONE || c === rope) continue;
    if (get(b, x, y - 1) === NONE && nz(x, y) < 0.55 && y > 120) { put(b, x, y, MOSS[1]); if (nz(x, y + 1) < 0.3) put(b, x, y - 1, MOSS[0]); }
  }
  { const [px, py] = shipPt(5, 64); tubeSponge(b, px, py, 2, CORAL.orange, 3); }
  { const [px, py] = shipPt(172, 49); coralBranch(b, px, py, 7, CORAL.pink, 8); }
  { const [px, py] = shipPt(40, 64); anemone(b, px, py, 4); }
  outline(b, I('#1c1c2a'));
  return mk(b);
}

// ------------------------------------------------------------ GROUND: the seabed of the drowned city (world x 3400-5000)
// From the gameplay line down: a sand skin with ripples, the old street (paving slabs and mosaic panels, drifted over in
// places), a shadow joint, a bed of packed rubble stones, then dark layered silt with buried pots, coins and shells.
// Both area ends are plain drifted sand over the same layers (a finished edge on its own).
const SAND = P('#d2d8be', '#adbcaa', '#8ca2a0', '#6c8590', '#526c80');
const PAVE = P('#c6d8cf', '#9db6b3', '#7896a2', '#4f6b80', '#3a5268');
const BED = P('#6a8492', '#5a7486', '#4b6378', '#3d5469', '#30455b', '#26384d');
const MOSA = P('#f2ecd4', '#4a8fd4', '#e07a4c', '#f2c862', '#2c5a8c');
const STONES = [P('#b8cbc8', '#8aa2a8', '#64798a', '#3a4e64'), P('#dcc8a2', '#b29b78', '#86705a', '#4e4038'), P('#e8eee8', '#c0cecb', '#91a6aa', '#56697c')];
const MOSAIC_ZONES = [[3430, 3600], [3925, 4075], [4390, 4510], [4650, 4800]];
// the old street: slabs of seeded widths; some lifted out (sand fills the hole), some cracked, a few darker
let SLABS = null;
function slabs() {
  if (SLABS) return SLABS;
  const R = rng(7311), out = [];
  for (let x = AX0 + 30; x < AX1 - 30;) { const w = 12 + Math.floor(R() * 11); out.push({ x, w, gone: R() < 0.12, crack: R() < 0.3 ? 2 + R() * (w - 4) : -1, slope: R() - 0.5, tone: R() }); x += w; }
  return (SLABS = out);
}
function slabAt(x) {
  const S = slabs();
  let lo = 0, hi = S.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (x < S[m].x) hi = m - 1; else if (x >= S[m].x + S[m].w) lo = m + 1; else return S[m]; }
  return null;
}
// one half of the seabed strip per bake step: half 0 = x 3392..4200, half 1 = x 4200..5008
function paintGround(half) {
  const gx0 = half ? 4200 : AX0 - 8, gx1 = half ? AX1 + 8 : 4200, gy0 = 228, b = buf(gx1 - gx0, H - gy0 + 4, -gx0, -gy0);
  for (let x = gx0; x < gx1; x++) {
    const g0 = Math.round(GA(x)), m = mound(x), top = g0 - m;
    const zone = MOSAIC_ZONES.find(z => x >= z[0] && x < z[1]), zk = zone ? Math.min(x - zone[0], zone[1] - x) : 0;
    const sl = zone ? null : slabAt(x);
    const street = !!(zone || (sl && !sl.gone)) && x > AX0 + 30 && x < AX1 - 30;
    const ripN = fbm(x * 0.05, 0, 3) * 6;
    for (let y = top; y < H + 2; y++) {
      const d = y - g0;
      let c;
      if (y < g0) c = y === top ? SAND[0] : SAND[1];                     // sand piled against things
      else if (d === 0) c = m > 0 ? SAND[1] : SAND[0];
      else if (d < 3) { const rip = Math.sin(x * 0.55 + d * 1.7 + ripN); c = rip > 0.55 ? SAND[0] : rip < -0.6 ? SAND[2] : SAND[1]; }
      else if (d < 9) {
        // the street; sand drifts over it where the noise says so (more over mounds and toward its ends)
        const drift = fbm(x * 0.04, d * 0.22, 13) + (zone ? ss(16, 0, zk) * 0.5 : 0.08) + ss(70, 30, Math.min(x - AX0, AX1 - x)) * 0.6 + m * 0.15 - (d - 3) * 0.035;
        if (street && drift < 0.55) {
          if (zone) {
            const row = d < 5 ? 0 : 1, tx = Math.floor((x - zone[0] + row) / 3), gx = (x - zone[0] + row) % 3 === 2, gy = d === 4 || d === 8;
            if (gy || gx) c = I('#56707e');
            else if (row === 0) c = tx % 2 ? MOSA[3] : MOSA[2];
            else { const w = (tx + (d === 6 ? 1 : 0)) % 4; c = w < 2 ? MOSA[1] : w === 2 ? MOSA[0] : MOSA[4]; }
            if (d === 3 && !gx) c = mixI(c, I('#ffffff'), 0.3);
          } else {
            const lx = x - sl.x;
            c = d === 3 ? PAVE[0] : d === 8 ? PAVE[2] : (nz(x, y) > 0.86 ? PAVE[2] : PAVE[1]);
            if (sl.tone > 0.75) c = mixI(c, PAVE[3], 0.25);
            if (lx === 0) c = PAVE[3];
            else if (lx === 1 && d > 3) c = PAVE[0];
            if (sl.crack >= 0 && d > 3 && Math.abs(lx - (sl.crack + (d - 3) * sl.slope * 2)) < 0.6) c = PAVE[3];
            if (d === 3 && nz(x, 77) > 0.8) c = MOSS[1];
          }
        } else {
          const rip = Math.sin(x * 0.4 + d * 1.3 + ripN);
          c = d < 5 ? (rip > 0.7 ? SAND[1] : SAND[2]) : (rip > 0.75 ? SAND[2] : SAND[3]);
        }
      } else if (d === 9) c = street ? PAVE[4] : (dz(x, y) < 0.5 ? SAND[3] : SAND[4]);
      else if (d < 16) c = dz(x, y) < (d - 9) / 7 ? BED[1] : BED[0];
      else {
        const k = (d - 16) / 10 + (fbm(x * 0.02, 3, 23) - 0.5) * 0.5, band = Math.floor(k * 4);
        c = BED[clamp(2 + band + (dz(x, y) < (k * 4 - band) ? 1 : 0), 2, 5)];
        if (Math.abs(((y + fbm(x * 0.02, 1, 19) * 8) % 7) - 3.5) < 0.35) c = mixI(c, BED[5], 0.5);
      }
      put(b, x, y, c);
    }
  }
  // the bed of packed rubble stones under the street
  const R = rng(5150 + half * 77);
  for (let x = gx0 + 2 + R() * 4; x < gx1 - 2; x += 3 + R() * 6) {
    if (R() < 0.14) continue;
    const big = R() < 0.18, g0 = Math.round(GA(x)), pal = STONES[R() < 0.72 ? 0 : R() < 0.6 ? 1 : 2], rx = (big ? 3.6 : 1.6) + R() * 2.4, ry = (big ? 2.4 : 1.2) + R() * 1.3, y = g0 + 10.5 + R() * 5 + (big ? 1 : 0);
    oval(b, x, y, rx + 0.8, ry + 0.8, pal[3]); oval(b, x, y, rx, ry, pal[1]); oval(b, x + rx * 0.3, y + ry * 0.35, rx * 0.6, ry * 0.5, pal[2]);
    put(b, x - rx * 0.4, y - ry * 0.5, pal[0]); put(b, x - rx * 0.4 + 1, y - ry * 0.5, pal[0]);
  }
  // buried things in the silt: stones, shells, coins, pottery shards
  for (let i = 0; i < 60; i++) {
    const x = gx0 + R() * (gx1 - gx0), g0 = GA(x), y = g0 + 18 + R() * (H - g0 - 18), k = R();
    if (k < 0.45) { const r = 1 + R() * 2; oval(b, x, y, r + 0.6, r * 0.7, BED[5]); oval(b, x - 0.3, y - 0.4, r, r * 0.6, I('#7f949c')); put(b, x - r * 0.5, y - r * 0.5, I('#b4c4c4')); }
    else if (k < 0.62) { put(b, x, y, I('#f0eadc')); put(b, x + 1, y, I('#d8cfbf')); put(b, x, y + 1, I('#b9ad9c')); }
    else if (k < 0.8) { rect(b, x, y, 2, 1, I('#e2b64c')); put(b, x, y, I('#fff0a0')); }
    else { poly(b, [[x, y], [x + 4, y - 1], [x + 5, y + 2], [x + 1, y + 2]], I('#b0603c')); line(b, x + 1, y, x + 4, y - 1, I('#d98a5a')); }
  }
  // shells and little starfish lying on the sand
  for (let i = 0; i < 22; i++) {
    const x = Math.round(gx0 + 4 + R() * (gx1 - gx0 - 8)), y = Math.round(GA(x)) - mound(x), k = R();
    if (k < 0.6) { put(b, x, y, I('#ffe8e0')); put(b, x + 1, y, I('#f4b8b0')); put(b, x, y - 1, I('#fff6f0')); }
    else if (k < 0.85) starfish(b, x, y - 1, 2.4, P('#ffd37a', '#ff9d4a', '#b85a2c'), R());
    else { put(b, x, y, I('#e9d9ff')); put(b, x + 1, y, I('#b9a2e8')); }
  }
  // amphorae and column drums buried in the silt
  for (const [x, y, a] of [[3605, 260, -0.3], [4060, 262, 0.5], [4520, 263, 1.2], [4885, 261, -1.0]]) if (x >= gx0 - 10 && x < gx1 + 10) amphora(b, x, y, a);
  for (const [x, y] of [[3540, 260], [4150, 263], [4610, 259]]) if (x >= gx0 - 22 && x < gx1) {
    for (let i = 0; i < 20; i++) for (let j = 0; j < 8; j++) put(b, x + i, y + j, j < 2 ? I('#b7cbc6') : j > 5 ? I('#5f7b88') : (i % 4 === 0 ? I('#748f99') : I('#94adae')));
    oval(b, x + 20, y + 4, 2, 4, I('#5f7b88'));
  }
  return mk(b);
}
// sand piled against things standing on the seabed (px above the gameplay line; the sand never changes groundAt)
function mound(x) {
  let m = 0;
  if (x > 3700 && x < 3898) m = Math.max(m, 3.2 * Math.sin((x - 3700) / 198 * Math.PI) ** 0.5 + (fbm(x * 0.08, 2, 5) - 0.5) * 3);
  for (const a of ARCHES) for (const px of [a.x - a.span / 2 - a.pw / 2, a.x + a.span / 2 + a.pw / 2]) m = Math.max(m, 2.6 - Math.abs(x - px) / (a.pw * 0.6 + 4) * 2.6);
  if (x > 3896 && x < 3930) m = Math.max(m, 1.6 * Math.sin((x - 3896) / 34 * Math.PI));
  if (Math.abs(x - HAND.x + 1) < 24) m = Math.max(m, 3.6 * Math.cos((x - HAND.x + 1) / 24 * Math.PI / 2));
  return Math.max(0, Math.round(m));
}
function amphora(b, x, y, a) {
  // a two-handled jar half buried in the sand: pointed foot, round belly, narrow neck, rim
  const T = P('#efa874', '#c8724a', '#94503a', '#5a3028'), ca = Math.cos(a), sa = Math.sin(a);
  const at = (u, v) => [x + u * ca - v * sa, y + u * sa + v * ca];
  for (let v = -11; v <= 10; v += 0.5) {
    const hw = v < -9 ? 2.4 : v < -5 ? 1.5 : v < 7 ? 4.6 * Math.sin((v + 6) / 13 * Math.PI) ** 0.6 + 0.8 : Math.max(0.6, 1.6 - (v - 7) * 0.35);
    for (let u = -hw; u <= hw; u += 0.5) { const [px, py] = at(u, v); put(b, px, py, u < -hw * 0.35 ? T[0] : u > hw * 0.5 ? T[2] : T[1]); }
  }
  for (const s2 of [-1, 1]) for (let k = 0; k <= 6; k++) { const t = k / 6, u = s2 * (1.6 + Math.sin(t * Math.PI) * 3.4), v = -9 + t * 5; const [px, py] = at(u, v); put(b, px, py, T[3]); }
  for (let u = -2; u <= 2; u++) { const [px, py] = at(u, -2.5); put(b, px, py, T[3]); }
}
// the chest under the bow, spilling coins onto the sand (drawn after the ground)
function paintChest() {
  const cx = 3912, g = Math.round(GA(cx)), b = buf(70, 34, -(cx - 18), -(g - 26));
  const WD = P('#c0874e', '#93603a', '#64402e', '#3b2a26'), GO = P('#fff3a6', '#ffd24a', '#d99a24', '#8e5a1c');
  // lid tipped open behind
  poly(b, [[cx - 12, g - 14], [cx - 15, g - 26], [cx + 8, g - 25], [cx + 9, g - 14]], WD[2]);
  poly(b, [[cx - 11, g - 15], [cx - 14, g - 24], [cx + 7, g - 23], [cx + 8, g - 15]], WD[1]);
  line(b, cx - 14, g - 24, cx + 7, g - 23, WD[0]); line(b, cx - 6, g - 25, cx - 5, g - 15, GO[2], 2);
  // gold heaped in the box
  for (let i = 0; i < 26; i++) { const x = cx - 10 + nz(i, 3) * 20, y = g - 13 - nz(i, 4) * 6 * Math.sin((x - cx + 11) / 22 * Math.PI); oval(b, x, y, 1.6, 1, GO[2]); put(b, x - 1, y - 1, GO[0]); put(b, x, y - 1, GO[1]); }
  // the box (a little sunk, tilted toward the coins)
  poly(b, [[cx - 12, g - 14], [cx + 10, g - 13], [cx + 11, g + 2], [cx - 12, g + 2]], WD[1]);
  rect(b, cx - 12, g - 14, 23, 2, WD[0]); for (let x = cx - 12; x < cx + 11; x += 6) rect(b, x, g - 12, 1, 14, WD[2]);
  rect(b, cx - 12, g - 7, 23, 2, GO[2]); rect(b, cx - 12, g - 7, 23, 1, GO[1]);
  rect(b, cx - 2, g - 10, 4, 5, GO[1]); put(b, cx - 1, g - 8, WD[3]);
  // a pearl necklace and a red gem over the front
  for (let i = 0; i < 9; i++) put(b, cx - 10 + i * 1.6, g - 12 + Math.sin(i / 8 * Math.PI) * 5, I('#f4f6ff'));
  oval(b, cx + 6, g - 15, 2, 1.6, I('#e8344a')); put(b, cx + 5, g - 16, I('#ffb0b8'));
  outline(b);
  // coins spilling down the sand to the right
  const coins = [[14, -3], [17, -1], [20, 0], [24, 1], [22, -2], [27, 1], [31, 2], [35, 2], [29, -1], [39, 3], [44, 3], [33, 0], [48, 3]];
  for (const [dx, dy] of coins) { const x = cx + dx, y = g + dy - 1; oval(b, x, y, 1.6, 1, GO[3]); oval(b, x, y - 0.4, 1.2, 0.6, GO[1]); put(b, x - 1, y - 1, GO[0]); }
  rect(b, cx + 18, g - 6, 2, 4, GO[2]); put(b, cx + 18, g - 6, GO[0]);   // one coin standing on its edge
  return mk(b);
}
// low dark foreground at the very bottom (screen layer, parallax 1.25)
function paintFront() {
  const p = FRONT_P, w = stripW(p), y0 = 196, b = buf(w, H - y0, 10, -y0);
  const F = P('#2c5f73', '#1c4459', '#12304a', '#0b2238');
  // a wide kelp blade from (x, base) curving up with wavy edges (dark, rim-lit on one side)
  const blade = (x, base, h, bend, wid, seed) => {
    for (let j = 0; j < h; j++) {
      const t = j / h, cx2 = x + bend * t * t + Math.sin(j * 0.18 + seed) * 1.5, hw = wid * Math.sin(Math.min(1, t * 1.2 + 0.15) * Math.PI) * (1 - t * 0.3) + 0.6 + Math.sin(j * 0.9 + seed) * 0.5;
      for (let i = -hw; i <= hw; i++) put(b, cx2 + i, base - j, i < -hw + 1 ? F[0] : Math.abs(i) < 0.6 ? F[1] : i > hw - 1 ? F[3] : F[2]);
    }
  };
  const clumps = [];
  for (let x = 30, n = 0; x < w; n++) { clumps.push([x, n]); x += 120 + Math.floor(nz(n, 71) * 140); }
  for (const [x, n] of clumps) {
    const kind = Math.floor(nz(n, 72) * 4);
    if (kind === 0) { // a fallen column drum with grass
      for (let i = 0; i < 34; i++) for (let j = 0; j < 12; j++) put(b, x + i, 258 + j, j < 2 ? F[0] : (i % 5 === 0 ? F[3] : F[1]));
      oval(b, x + 34, 264, 3, 6, F[2]);
      seagrass(b, x + 8, 260, 7, 16, [F[0], F[1], F[2]], n);
    } else if (kind === 1) { // rocks and a sea fan
      oval(b, x, 266, 18, 10, F[2]); oval(b, x - 2, 263, 15, 7, F[1]); oval(b, x - 6, 260, 7, 3, F[0]);
      blade(x + 12, 264, 24, 6, 2.4, n + 1); blade(x + 18, 268, 20, -4, 2, n + 4);
      seagrass(b, x - 16, 268, 6, 22, [F[0], F[1], F[2]], n + 3);
    } else if (kind === 2) { // tall weed
      seagrass(b, x, 268, 9, 26, [F[0], F[1], F[2]], n);
      oval(b, x + 2, 268, 10, 4, F[2]);
    } else { // a corner mass: a broken column block, a rock, two big kelp blades
      const sg = n % 2 ? 1 : -1;
      oval(b, x + sg * 6, 272, 26, 11, F[3]); oval(b, x + sg * 2, 268, 20, 8, F[2]); oval(b, x - sg * 4, 263, 10, 3, F[1]);
      for (let i = 0; i < 30; i++) for (let j = 0; j < 11; j++) { const xx = x - sg * 18 + sg * i, yy = 259 + j - Math.round(i * 0.2); put(b, xx, yy, j < 2 ? F[0] : (i % 6 === 0 ? F[3] : j > 8 ? F[3] : F[1])); }
      blade(x - sg * 4, 266, 26, sg * 8, 3, n); blade(x + sg * 8, 268, 26, -sg * 5, 2.4, n + 2); blade(x - sg * 14, 270, 22, sg * 3, 2, n + 5);
    }
  }
  return mk(b);
}

// ------------------------------------------------------------ live creatures: free dolphins, rays, a fish school
// a bottlenose dolphin facing right, arched mid-stroke (frame 0..3 = flukes up, level, down, level)
function dolphinBuf(frame, hz, sc = 1) {
  const b = buf(Math.ceil(48 * sc), Math.ceil(30 * sc), Math.ceil(24 * sc), Math.ceil(15 * sc)), pal = P('#a9d2ee', '#7fb3dc', '#5b8fc0', '#3f6c9c'), belly = P('#ffffff', '#dcecf6');
  const flick = [-1, 0, 1, 0][frame], Lb = 30 * sc;
  // spine: a gentle arch; thickness: thin tail stock, round melon, then the short beak
  const spine = x => -Math.sin(((x + Lb * 0.5) / Lb) * Math.PI) * 2.2 * sc + (x < -Lb * 0.18 ? ((x + Lb * 0.18) / Lb) * flick * 7 * sc : 0);
  for (let x = Math.round(-Lb * 0.5); x <= Math.round(Lb * 0.5); x++) {
    const t = (x + Lb * 0.5) / Lb;
    let th = (t < 0.72 ? Math.pow(Math.sin(Math.min(1, t / 0.72) * Math.PI * 0.62), 1.2) * 6.4 : 6.4 * Math.cos((t - 0.72) / 0.28 * Math.PI * 0.42)) * sc + 0.6;
    const cy = spine(x);
    for (let y = Math.round(cy - th); y <= Math.round(cy + th * 0.86); y++) {
      const k = (y - cy) / th;
      put(b, x, y, k > 0.3 ? (k > 0.68 ? belly[1] : belly[0]) : k < -0.62 ? pal[0] : k < -0.05 ? pal[1] : pal[2]);
    }
  }
  const nx = Math.round(Lb * 0.5), ny = Math.round(spine(nx));
  // beak (rostrum) with the smile line under it
  rect(b, nx, ny + 1, Math.round(5 * sc), Math.max(2, Math.round(2 * sc)), pal[1]); put(b, nx + Math.round(5 * sc) - 1, ny + 1, pal[2]);
  rect(b, nx, ny + 1 + Math.max(2, Math.round(2 * sc)), Math.round(4 * sc), 1, belly[1]);
  line(b, nx - 6 * sc, ny + 2.5 * sc, nx + 2, ny + 2 * sc, pal[3]);
  // eye with a sparkle
  rect(b, nx - Math.round(8 * sc), ny - Math.round(1 * sc), 2, 2, I('#13202e')); put(b, nx - Math.round(8 * sc), ny - Math.round(1 * sc), I('#ffffff'));
  // curved dorsal fin, flipper, flukes
  const dx = Math.round(-2 * sc), dy = Math.round(spine(dx) - 5.8 * sc);
  poly(b, [[dx - 5 * sc, dy + 2], [dx - 2 * sc, dy - 4 * sc], [dx - 4 * sc, dy - 8 * sc], [dx + 4 * sc, dy + 2]], pal[1]); line(b, dx - 3 * sc, dy - 1, dx - 3.5 * sc, dy - 7 * sc, pal[0]);
  poly(b, [[6 * sc, 3 * sc], [-1 * sc, 10 * sc], [2 * sc, 4 * sc]], pal[2]);
  const tx = Math.round(-Lb * 0.5), ty = Math.round(spine(tx));
  poly(b, [[tx + 2, ty - 1], [tx - 7 * sc, ty - 5 * sc + flick * 2 * sc], [tx - 4 * sc, ty], [tx - 7 * sc, ty + 5 * sc + flick * 2 * sc], [tx + 2, ty + 1]], pal[2]);
  outline(b, I('#1a2c46'));
  if (hz > 0) for (let i = 0; i < b.d.length; i++) if (b.d[i] !== NONE) b.d[i] = mixI(b.d[i], I('#2f76ad'), hz);
  return mk(b);
}
// a ray seen from above, gliding to the right: diamond wings, horns at the nose, a long tail.
// pal: [lit, mid, dark, deep]
function rayShape(b, frame, pal) {
  const flap = [-1, 0, 1, 0.4][frame], ty = 28 - flap * 4, tx = -8 + flap * 2;
  // crescent wings: the leading edge bows out to a pointed tip, the trailing edge curves back in to the tail root
  const lead = k => [lerp(17, tx, k) + Math.sin(k * Math.PI) * 5, lerp(1, ty, k) - Math.sin(k * Math.PI) * 2];
  const trail = k => [lerp(tx, -17, k) - Math.sin(k * Math.PI) * 1.5, lerp(ty, 3, k) - Math.sin(k * Math.PI) * 6];
  const wing = sg => { const pts = []; for (let k = 0; k <= 1.001; k += 0.125) { const [x, y] = lead(k); pts.push([x, sg * y]); } for (let k = 0.125; k <= 1.001; k += 0.125) { const [x, y] = trail(k); pts.push([x, sg * y]); } return pts; };
  poly(b, wing(-1), pal[1]); poly(b, wing(1), pal[2]);
  // the leading edges catch the light, the trailing edges are darker
  for (let k = 0; k < 1; k += 0.02) { const [x, y] = lead(k); put(b, x, -y, pal[0]); put(b, x, y, pal[1]); }
  for (let k = 0; k < 1; k += 0.03) { const [x, y] = trail(k); put(b, x + 1, -y + 1, pal[2]); put(b, x + 1, y - 1, pal[3]); }
  const tipX = tx, tipY = ty;
  // body ridge down the middle
  for (let x = -16; x <= 15; x++) { const hw = x > 8 ? 4.5 - (x - 8) * 0.35 : 4.5; for (let y = -hw; y <= hw; y++) put(b, x, y, y < -1.5 ? pal[0] : y < 1.5 ? pal[1] : pal[2]); }
  // cephalic horns
  poly(b, [[15, -3], [23, -7], [22, -2]], pal[1]); poly(b, [[15, 3], [23, 7], [22, 2]], pal[2]);
  // tail
  const tcol = () => pal[2];
  for (let i = 0; i < 15; i++) { const x = -17 - i * 2.2, y = Math.sin(i * 0.45 + frame * 1.3) * 1.2; rect(b, x - 1, y, 3, 1, tcol(i)); }
  for (const [x, y] of [[-2, -10], [-6, -16], [0, 9], [-5, 15], [-9, -20]]) put(b, x, y, I('#e6eef8'));
  put(b, 11, -3, I('#13202e')); put(b, 11, 3, I('#13202e'));
}
function mantaBuf(frame, hz) {
  const b = buf(90, 64, 56, 32);
  rayShape(b, frame, P('#7da3c8', '#5a7fa8', '#3f6088', '#2c4568'));
  outline(b, I('#1c3048'));
  for (let i = 0; i < b.d.length; i++) if (b.d[i] !== NONE) b.d[i] = mixI(b.d[i], I('#2a6aa0'), hz);
  return mk(b);
}

// ------------------------------------------------------------ WORLD: mossy boulders finishing both area ends
function paintBoulders(x0, seed) {
  const g = Math.round(GA(x0)), b = buf(74, 36, -(x0 - 37), -(g - 30)), S = STONES[0];
  for (const [dx, dy, rx, ry] of [[-15, -5, 11, 8], [6, -8, 13, 10], [21, -3, 8, 6], [-26, -1, 6, 4]]) {
    const cx2 = x0 + dx + (nz(seed, dx + 40) - 0.5) * 4, cy2 = g + dy + 2;
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const q = (x / rx) ** 2 + (y / ry) ** 2;
      if (q > 1) continue;
      const l = -0.5 * x / rx - 0.8 * y / ry + 0.4 * Math.sqrt(1 - q);
      put(b, cx2 + x, cy2 + y, l > 0.55 ? S[0] : l > 0.1 ? S[1] : l > -0.3 ? S[2] : S[3]);
    }
  }
  for (let y = g - 30; y < g + 4; y++) for (let x = x0 - 37; x < x0 + 37; x++) {
    const c = get(b, x, y);
    if (c === NONE) continue;
    if (get(b, x, y - 1) === NONE && nz(x, y) < 0.75) put(b, x, y, nz(x + 2, y) < 0.5 ? MOSS[0] : MOSS[1]);
    else if (fbm(x * 0.2, y * 0.2, 31 + seed) > 0.7) put(b, x, y, MOSS[1]);
  }
  outline(b, RS[4]);
  seagrass(b, x0 - 6, g - 14, 6, 14, MOSS, seed);
  if (seed % 2) coralBranch(b, x0 + 10, g - 17, 7, CORAL.pink, seed); else tubeSponge(b, x0 + 9, g - 17, 3, CORAL.orange, seed);
  anemone(b, x0 - 18, g - 9, 3);
  return mk(b);
}
const EDGES = [AX0 + 14, AX1 - 16];

// ------------------------------------------------------------ bake steps (each well under ~100 ms in the harness)
let LAY = null;
const STEPS = [
  () => { initNoise(); LAY = {}; LAY.water = paintWater(); },
  () => { LAY.shaft = shaftCanvas(); },
  () => { LAY.far = paintFar(); },
  () => { LAY.stat = paintStatues(); },
  () => { LAY.mid = paintMid(); },
  () => { LAY.arches = ARCHES.map(a => mk(archSprite(a.x, a))); LAY.hand = paintHand(); },
  () => { LAY.wreck = paintWreck(); LAY.rubble = RUBBLE.map((x, i) => paintRubble(x, i + 3)); LAY.edges = EDGES.map((x, i) => paintBoulders(x, i + 1)); },
  () => { LAY.ground = [paintGround(0)]; },
  () => { LAY.ground.push(paintGround(1)); LAY.chest = paintChest(); },
  () => { LAY.front = paintFront(); LAY.dol = [0, 1, 2, 3].map(f => dolphinBuf(f, 0.3, 0.85)); LAY.manta = [0, 1, 2, 3].map(f => mantaBuf(f, 0.5)); LAY.fish = fishSprites(); }
];

// ------------------------------------------------------------ live bits
// a big manta gliding far away; it wraps off screen on both sides
function manta(g, cx) {
  const span = W + 200, x = ((150 + G.t * 0.12 - (cx - PX0) * 0.15) % span + span) % span - 100, y = 82 + Math.sin(G.t * 0.02) * 3;
  gblit(g, LAY.manta[Math.floor(G.t / 14) % 4], x, y);
}
// three free dolphins swimming together to the right, high in the open water (background: hazier and smaller)
function pod(g, cx) {
  const span = W + 260, head = ((300 + G.t * 0.42 - (cx - PX0) * POD_P) % span + span) % span - 120;
  for (const [dx, dy, ph] of [[0, 0, 0], [-40, 13, 1.8], [-22, -14, 3.1]]) {
    const x = head + dx, y = 78 + dy + Math.sin(G.t * 0.03 + ph) * 3;
    if (x > -40 && x < W + 40) gblit(g, LAY.dol[Math.floor(G.t / 9 + ph * 2) % 4], x, y);
  }
}
// little striped fish (2 tail frames), slightly hazed: schools circling in the mid water (parallax 0.55)
function fishSprites() {
  return [0, 1].map(f => {
    const b = buf(12, 7, 6, 3);
    oval(b, 0, 0, 4, 1.6, I('#cfe6f4'));
    rect(b, -3, -2, 7, 1, I('#5f8fc0')); rect(b, -2, -1, 6, 1, I('#8fbade'));
    rect(b, -3, 0, 6, 1, I('#ffd86a')); rect(b, -2, 1, 5, 1, I('#ffffff'));
    put(b, 3, -1, I('#13202e'));
    if (f) { put(b, -5, -2, I('#5f8fc0')); put(b, -5, -1, I('#8fbade')); put(b, -6, -2, I('#5f8fc0')); put(b, -5, 1, I('#8fbade')); }
    else { put(b, -5, -1, I('#8fbade')); put(b, -6, -2, I('#5f8fc0')); put(b, -5, 1, I('#8fbade')); put(b, -6, 2, I('#5f8fc0')); }
    put(b, -4, 0, I('#8fbade'));
    outline(b, I('#1c3048'));
    for (let i = 0; i < b.d.length; i++) if (b.d[i] !== NONE) b.d[i] = mixI(b.d[i], I('#2f76ad'), 0.25);
    return mk(b);
  });
}
const FISH_P = 0.55, SCHOOLS = [[LX(0.55, 66), 112, 13], [LX(0.55, 66) + 560, 102, 11], [LX(0.55, 66) + 1120, 122, 12]];
function fishSchools(g, cx) {
  const off = (cx - PX0) * FISH_P;
  for (let s = 0; s < SCHOOLS.length; s++) {
    const [lx, ly, n] = SCHOOLS[s], cx0 = lx - off + Math.sin(G.t * 0.006 + s) * 10;
    if (cx0 < -70 || cx0 > W + 70) continue;
    for (let i = 0; i < n; i++) {
      const a = i * 2.4 + s, r = 6 + (i % 4) * 7, x = cx0 + Math.cos(a) * r * 1.6 + Math.sin(G.t * 0.02 + i) * 3, y = ly + Math.sin(a) * r * 0.5 + Math.sin(G.t * 0.03 + i * 1.3) * 2;
      gblit(g, LAY.fish[(Math.floor(G.t / 6) + i) % 2], x, y);
    }
  }
}
// strands of seaweed on the ruins that sway (world space)
const WEED = [[3446, 8], [3600, 9], [3646, 0], [3702, 1], [3940, 2], [4036, 3], [4250, 10], [4396, 4], [4490, 5], [4676, 6], [4770, 7], [4950, 11]];
function liveWeed(cx) {
  for (const [x, s] of WEED) {
    if (x < cx - 30 || x > cx + W + 30) continue;
    const g = GA(x), h = 22 + nz(s, 81) * 26;
    let px = x, py = g;
    for (let j = 3; j <= h; j += 3) {
      const nx = x + Math.sin(G.t * 0.03 + s + j * 0.08) * j * 0.12, ny = g - j;
      pl(px, py, nx, ny, 2, j > h - 6 ? '#6fb88e' : s % 2 ? '#3f8a70' : '#2f7a66');
      px = nx; py = ny;
    }
  }
}
function coinTwinkle() {
  const pts = [[3906, -18], [3926, -3], [3940, 0], [3900, -15], [3955, 1]];
  for (let i = 0; i < pts.length; i++) {
    const ph = (G.t + i * 23) % 70;
    if (ph > 10) continue;
    const x = pts[i][0], y = Math.round(GA(x)) + pts[i][1], s = ph < 5 ? ph : 10 - ph;
    ctx.fillStyle = '#fffbe0'; ctx.fillRect(x, y - (s >> 1), 1, s | 1); ctx.fillRect(x - (s >> 1), y, s | 1, 1);
  }
}
function wreckBubbles() {
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const ph = ((G.t * 0.5 + i * 37) % 160) / 160, x = 3786 + Math.sin(ph * 9 + i) * 3 + (i % 2) * 3, y = 222 - ph * 150;
    ctx.strokeStyle = 'rgba(200,240,250,' + (0.55 * (1 - ph)).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(Math.round(x) + 0.5, Math.round(y) + 0.5, 1 + (i % 3 === 0 ? 1 : 0), 0, Math.PI * 2); ctx.stroke();
  }
}

// ------------------------------------------------------------ the area for the joiner
const seen = (x0, x1, cx) => x1 > cx && x0 < cx + W;
L4ART.ruins = {
  x0: AX0, x1: AX1, steps: STEPS,
  bg(g, cx) {
    const ga = g.globalAlpha;
    g.drawImage(LAY.water.img, -12, -12);
    g.drawImage(LAY.shaft, Math.round(-40 - (cx - PX0) * SHAFT_P + Math.sin(G.t * 0.004) * 6), 0);
    strip(g, LAY.far, cx, FAR_P);
    manta(g, cx);
    strip(g, LAY.stat, cx, STAT_P);
    pod(g, cx);
    strip(g, LAY.mid, cx, MID_P);
    fishSchools(g, cx);
    g.globalAlpha = ga;
  },
  behind(cx) {
    for (let i = 0; i < EDGES.length; i++) if (seen(EDGES[i] - 40, EDGES[i] + 40, cx)) blit(LAY.edges[i], 0, 0);
    for (let i = 0; i < ARCHES.length; i++) { const a = ARCHES[i]; if (seen(a.x - 80, a.x + 80, cx)) blit(LAY.arches[i], 0, 0); }
    for (let i = 0; i < RUBBLE.length; i++) if (seen(RUBBLE[i] - 42, RUBBLE[i] + 42, cx)) blit(LAY.rubble[i], 0, 0);
    if (seen(3680, 3960, cx)) { blit(LAY.wreck, 0, 0); wreckBubbles(); }
    if (seen(HAND.x - 50, HAND.x + 50, cx)) blit(LAY.hand, 0, 0);
    liveWeed(cx);
  },
  ground(cx) {
    if (seen(AX0 - 8, 4200, cx)) blit(LAY.ground[0], 0, 0);
    if (seen(4200, AX1 + 8, cx)) blit(LAY.ground[1], 0, 0);
    if (seen(3880, 3980, cx)) { blit(LAY.chest, 0, 0); coinTwinkle(); }
  },
  front(cx) { strip(ctx, LAY.front, cx, FRONT_P); },
  overlay(cx) {
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * 0.16; ctx.drawImage(LAY.shaft, Math.round(-40 - (cx - PX0) * SHAFT_P + Math.sin(G.t * 0.004) * 6), 0);
    ctx.globalAlpha = ga;
    // marine snow drifting down
    for (let i = 0; i < 46; i++) {
      const x = ((hsh(i * 3.1) * 700 - cx * (0.5 + hsh(i) * 0.4) + Math.sin(G.t * 0.01 + i) * 6) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = (hsh(i * 7.7) * 260 + G.t * (0.06 + hsh(i * 2.3) * 0.08)) % 250 + 20;
      ctx.fillStyle = i % 4 ? 'rgba(190,226,240,0.45)' : 'rgba(230,248,255,0.75)'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // rising bubbles
    ctx.strokeStyle = 'rgba(181,242,244,0.28)'; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const x = ((hsh(i + 93) * W - cx * 0.7) % W + W) % W, y = H - ((G.t * (0.21 + hsh(i) * 0.24) + hsh(i + 4) * H) % H);
      ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), 1 + hsh(i + 8) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = ga;
  }
};
}
