'use strict';
var L3 = L3 || {};
// ============================================================
// Mission 3 world layer (VOLCANO ISLAND): the ground of the four areas (black-sand beach, the lagoon floor seen
// through clear water, the coral sandbar, the jungle floor and the hot-spring pond, the basalt shelves, the crater
// floor and the boss ledge), the liquids (animated lagoon and pond surfaces, flowing lava rivers, the crater's lava
// lake), the platforms (pier, log, rock, lily pad, basalt column, robot catwalk), the scenery behind the walking line
// (shallows and sea stacks, fishing hut, nets, canoe and buoys; jungle trunks, lianas, heliconias, giant leaves,
// ferns, hibiscus and the waterfall; back basalt columns, lava falls, boulders and steam vents; the robots' crater
// machinery), the front layer (the water over waders, the lava lip, splashes and steam, low foreground plants) and
// the PROP_TYPES palm and beachrock.
// L3 hooks: worldLoad, worldUpdate, drawBehind, drawGround, drawPlat, drawFront.
// Static art is painted pixel by pixel into buffers and baked into canvases (sprites at load, the ground and the
// platforms in worldLoad once the terrain is known). Only living parts are drawn each frame. Deterministic: no
// Math.random or rand() anywhere in this file (decoration uses hsh() / a private noise table, effects a private rng).
// ============================================================
{
// ============================================================
// Helpers: noise, colours, pixel buffers
// ============================================================
const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
const P = (...s) => s.map(I);
const OUTI = I(OUT);
const css = v => '#' + (v & 0xffffff).toString(16).padStart(6, '0');
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
// stable noise 0..1 per integer point, smooth value noise and fbm on top of it
const NZ = (() => { const r = rng(3310711), a = new Float32Array(65536); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
const nz = (x, y) => NZ[((Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0) & 65535];
function vn(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = s * 57;
  return lerp(lerp(nz(i + o, j), nz(i + 1 + o, j), a), lerp(nz(i + o, j + 1), nz(i + 1 + o, j + 1), a), b);
}
function fbm(x, y, s, oct = 3) { let v = 0, a = 1, n = 0, f = 1; for (let o = 0; o < oct; o++) { v += a * vn(x * f, y * f, s + o * 7); n += a; a *= 0.5; f *= 2.03; } return v / n; }
// value noise and Worley cells periodic in y (nj lattice rows), for the lava that scrolls toward the viewer
function vnP(x, y, s, nj, ni) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = s * 57;
  const j0 = ((j % nj) + nj) % nj, j1 = (j0 + 1) % nj, i0 = ni ? ((i % ni) + ni) % ni : i, i1 = ni ? (i0 + 1) % ni : i + 1;
  return lerp(lerp(nz(i0 + o, j0), nz(i1 + o, j0), a), lerp(nz(i0 + o, j1), nz(i1 + o, j1), a), b);
}
// Worley cells (results in WD1, WD2, WID, FX, FY: no allocation); periodic in x over ni cells and in y over nj rows
// when those are given
let WD1 = 0, WD2 = 0, WID = 0;
function worleyP(u, v, nj, s, ni) {
  const i = Math.floor(u), j = Math.floor(v);
  let d1 = 9, d2 = 9, id = 0, fx = 0, fy = 0;
  for (let bj = -1; bj <= 1; bj++) for (let ai = -1; ai <= 1; ai++) {
    const ci = i + ai, cj = j + bj, jw = nj ? ((cj % nj) + nj) % nj : cj, iw = ni ? ((ci % ni) + ni) % ni : ci;
    const px = ci + 0.12 + nz(iw * 7 + s, jw * 13) * 0.76, py = cj + 0.12 + nz(iw * 11 + s, jw * 5 + 99) * 0.76;
    const dx = u - px, dy = v - py, d = Math.sqrt(dx * dx + dy * dy);
    if (d < d1) { d2 = d1; d1 = d; id = iw * 31 + jw * 17; fx = px; fy = py; } else if (d < d2) d2 = d;
  }
  WD1 = d1; WD2 = d2; WID = id; FX = fx; FY = fy;
}
let FX = 0, FY = 0;
function mixI(a, b, k) {
  k = clamp(k, 0, 1);
  return (Math.round(lerp(a >> 16 & 255, b >> 16 & 255, k)) << 16) | (Math.round(lerp(a >> 8 & 255, b >> 8 & 255, k)) << 8) | Math.round(lerp(a & 255, b & 255, k));
}
// Pixel buffers: Int32 0xRRGGBB, NONE = empty; world/local point (x, y) lands on pixel (x - x0, y - y0)
function buf(x0, y0, w, h) { const d = new Int32Array(w * h); d.fill(NONE); return { x0, y0, w, h, d }; }
function put(b, x, y, c) { x = Math.floor(x) - b.x0; y = Math.floor(y) - b.y0; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) - b.x0; y = Math.floor(y) - b.y0; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
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
    xs.sort((a, b2) => a - b2);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x + 0.5 <= xs[k + 1]; x++) put(b, x, y, c);
  }
}
// cubic bezier as points
function bez(p, n = 24) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    o.push([u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0], u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]]);
  }
  return o;
}
function path(b, pts, c, t = 1) { for (let i = 0; i + 1 < pts.length; i++) line(b, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, t); }
// 1px outline round everything painted (4 neighbours)
function outline(b, c = OUTI) {
  const add = [], w = b.w, d = b.d;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i] !== NONE) continue;
    if ((x > 0 && d[i - 1] !== NONE) || (x < w - 1 && d[i + 1] !== NONE) || (y > 0 && d[i - w] !== NONE) || (y < b.h - 1 && d[i + w] !== NONE)) add.push(i);
  }
  for (const i of add) d[i] = c;
}
// tones by position inside the pixels of colour `mark`: lit on top/left edges, dark on bottom/right edges
function shade(b, mark, L, M, D, lr = 1, dr = 1) {
  const m = new Uint8Array(b.w * b.h);
  for (let i = 0; i < m.length; i++) m[i] = b.d[i] === mark ? 1 : 0;
  const inM = (x, y) => x >= 0 && y >= 0 && x < b.w && y < b.h && m[y * b.w + x] === 1;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (!m[y * b.w + x]) continue;
    let c = M;
    for (let k = 1; k <= dr && c === M; k++) if (!inM(x, y + k) || !inM(x + k, y)) c = D;
    for (let k = 1; k <= lr && c === M; k++) if (!inM(x, y - k) || !inM(x - k, y)) c = L;
    b.d[y * b.w + x] = c;
  }
}
function bake(b, white) {
  const c = document.createElement('canvas'); c.width = b.w; c.height = b.h;
  const g = c.getContext('2d'), im = g.createImageData(b.w, b.h), d = im.data;
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = i * 4;
    if (white) d[j] = d[j + 1] = d[j + 2] = 255;
    else { d[j] = v >> 16 & 255; d[j + 1] = v >> 8 & 255; d[j + 2] = v & 255; }
    d[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// a sprite drawn with its local origin at (x, y)
function mk(b, white) { return { img: bake(b), white: white ? bake(b, true) : null, x0: b.x0, y0: b.y0, w: b.w, h: b.h }; }
function blit(s, x, y) { ctx.drawImage(FLASH && s.white ? s.white : s.img, Math.round(x) + s.x0, Math.round(y) + s.y0); }
// wind sway: horizontal slices, the top moves `amt` px and the bottom row stays
function swayBlit(s, x, y, amt, rows) {
  const X = Math.round(x) + s.x0, Y = Math.round(y) + s.y0, im = FLASH && s.white ? s.white : s.img;
  let y0 = 0, off = null;
  for (let sy = 0; sy < s.h; sy += rows) {
    const sh = Math.min(rows, s.h - sy), k = 1 - (sy + sh / 2) / s.h, o = Math.round(amt * k * k);
    if (off !== null && o !== off) { ctx.drawImage(im, 0, y0, s.w, sy - y0, X + off, Y + y0, s.w, sy - y0); y0 = sy; }
    off = o;
  }
  if (off !== null) ctx.drawImage(im, 0, y0, s.w, s.h - y0, X + off, Y + y0, s.w, s.h - y0);
}
// hard-edged disc of rects in the current fillStyle
function pdisc(x, y, r) {
  x = Math.round(x); y = Math.round(y);
  const n = Math.ceil(r);
  for (let j = -n; j <= n; j++) { const q = r * r - j * j + r * 0.8; if (q >= 0) { const hw = Math.round(Math.sqrt(q)); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); } }
}
const sway = (ph, amp) => amp * (0.55 * Math.sin(G.t * 0.03 + ph) + 0.25 * Math.sin(G.t * 0.071 + ph * 1.7) + 0.2);

// ============================================================
// Palettes (the island's sun is low on the left: things are lit from the upper left)
// ============================================================
const SAND = P('#a49cac', '#827a8c', '#625a6c', '#4c4556', '#3b3545', '#2d2836', '#221e29');      // black volcanic sand
const CSAND = P('#fff6d6', '#f4e2ae', '#e2c98c', '#c8aa6e', '#a48a56');                            // coral sand (sandbar)
const FSAND = P('#fff2c8', '#ead7a0', '#d2bb80');                                                  // the lagoon floor
const LAG = P('#e2fff8', '#aef2e6', '#84e2da', '#5ecdd2', '#41b6c9', '#2f9dbd', '#2384ac', '#1a6a94'); // lagoon water
const DRIFT = P('#e8e0d0', '#c8bca8', '#a09482', '#766a5c');
const MOSS = P('#b8e06c', '#88c04a', '#5e9838', '#3e6e2a');
const EARTH = P('#8a5a3e', '#734a34', '#5e3c2c', '#4a3024', '#38241c', '#281a14');      // red tropical earth
const LEAF = P('#96d860', '#60a646', '#408036', '#2a5c2a', '#1c4020');
const LEAFC = P('#86c47c', '#4f9460', '#38764e', '#255a3a');                                       // cooler giant leaves
const BARK = P('#a39078', '#80705e', '#625549', '#463d35', '#2e2824');
const PONDW = P('#dcf6ec', '#b4e6d8', '#8ed2c8', '#6cbab8', '#55a2a8', '#468a98', '#38707e');      // milky jade
const SINTER = P('#fbf1d8', '#efd39c', '#dca858', '#bb7d36', '#8c5626');
const BAS = P('#c49ab0', '#9a7c98', '#6e5a78', '#524460', '#3c3048', '#2a2234', '#1a1522', '#110d16'); // basalt at dusk
const HOT = P('#ffd8a0', '#ff9a4a', '#e06a2c', '#b0441e', '#6a2416');
const LVC = P('#fff8d0', '#fff1a0', '#ffd23f', '#ffa52a', '#ff7a1a', '#e8501a', '#b8300c', '#7a1a08'); // lava, hot .. cool
const CRU = P('#8a3a22', '#6a2a18', '#4e1c12', '#3e160f', '#2c0f0b', '#1e0a08');                   // lava crust
const KR = P('#09070b', '#120e13', '#1c151b', '#2a1e24', '#3d2a2b', '#5e3328', '#93452a', '#cf6a31'); // crater basalt at night
const ST = P('#1c2028', '#2c323c', '#434b57', '#5f6875', '#828c9a', '#adb6c2', '#dfe5ec');            // robot steel

// ============================================================
// Level geometry, read from the level data in worldLoad: ground y per x, the liquids, their visible faces
// ============================================================
let WAT = [], LAV = [], SI = null, END = 6200;
const gi = x => SI ? SI[clamp(Math.round(x), 0, SI.length - 1)] : Math.round(groundAt(x));
const wAt = x => { for (const r of WAT) if (x >= r.x0 && x <= r.x1) return r; return null; };
const lAt = x => { for (const r of LAV) if (x >= r.x0 && x <= r.x1) return r; return null; };
function liquidGeom() {
  WAT = (LV.water || []).map(w => ({ x0: w.x0, x1: w.x1, y: w.y }));
  LAV = (LV.lava || []).map(l => ({ x0: l.x0, x1: l.x1, y: l.y }));
  for (const w of WAT) {
    // wet span (ground below the surface), dry islands inside it (the sandbar)
    let a = null, b = null, dry = null;
    w.bars = [];
    for (let x = Math.ceil(w.x0); x <= w.x1; x++) {
      if (gi(x) > w.y) { if (a == null) a = x; b = x; if (dry != null) { w.bars.push([dry, x - 1]); dry = null; } }
      else if (a != null && dry == null) dry = x;
    }
    w.l = a == null ? w.x0 : a; w.r = b == null ? w.x1 : b;
    w.pond = w.r - w.l < 500;
    w.segs = []; let sa = null;
    for (let x = w.l; x <= w.r + 1; x++) { const wet = x <= w.r && gi(x) > w.y; if (wet && sa == null) sa = x; else if (!wet && sa != null) { w.segs.push([sa, x - 1]); sa = null; } }
    w.cx = (w.l + w.r) / 2; w.rx = (w.r - w.l) / 2 + 1; w.ry = 30;
  }
  LAV.sort((a, b) => a.x0 - b.x0);
  for (const l of LAV) l.lake = l.x1 >= END - 2;
}
// is (x, y) on the face of water w (the part in front of the walking line)?
function inBar(w, x, y) { for (const [b0, b1] of w.bars) { const s = (y - w.y) * 0.55; if (x >= b0 - s - 1 && x <= b1 + s + 1) return true; } return false; }
function waterFace(w, x, y) {
  if (y < w.y || x < w.l || x > w.r) return false;
  if (w.pond) { const u = (x - w.cx) / w.rx, v = (y - w.y) / w.ry; return u * u + v * v < 1; }
  const s = (y - w.y) * 0.7;
  return x >= w.l + s && x <= w.r - s && !inBar(w, x, y);
}

// ============================================================
// Ground pixels per area
// ============================================================
const ZB = 2210, ZJ = 3880, ZC = 5306;
function zoneAt(x, y) {
  const X = x + (nz(x >> 1, y >> 1) - 0.5) * 26;
  return X < ZB ? 0 : X < ZJ ? 1 : X < ZC ? 2 : 3;
}
// how wet the black sand is: next to the lagoon, the shallows at the far left where the boat comes in
function wetness(x, y) {
  let k = x < 76 ? 1 - ss(40, 76, x) : 0;
  for (const w of WAT) if (!w.pond) {
    const s = Math.max(0, y - w.y) * 0.7;
    k = Math.max(k, 1 - ss(0, 34, Math.min(Math.abs(x - (w.l + s)), Math.abs(x - (w.r - s)))));
  }
  return k;
}
function sandPx(x, y, si, n) {
  const d = y - si;
  if (d < 0) return NONE;
  const wet = wetness(x, y);
  let c;
  if (d === 0) c = n > 0.75 ? SAND[0] : SAND[1];
  else if (d === 1) c = SAND[2];
  else {
    let k = 3 + Math.floor((d - 2) / 15 + n * 0.75);
    if (d < 4) k = 3;
    // wind ripples
    const ry = y + Math.round(Math.sin(x / 9 + y * 0.6) * 1.3 + Math.sin(x / 31) * 2), rp = ((ry % 6) + 6) % 6;
    if (d > 4 && rp === 0) k++;                                   // ripple troughs
    else if (d > 4 && rp === 5 && nz(x >> 1, ry) > 0.25) k--;      // and their lit crests
    c = SAND[clamp(k, 2, 6)];
  }
  if (wet > 0.02) {
    c = mixI(c, I('#262a38'), wet * 0.45);
    if (d > 1 && vn(x / 7, y / 1.6, 3) > 0.72) c = mixI(c, I('#8a9cc0'), 0.4 * wet);   // wet sand mirrors the sky
  }
  const g = nz(x, y + 900);
  if (g > 0.996) c = I('#f0ecf6'); else if (g > 0.988) c = mixI(c, SAND[1], 0.5);   // black-sand glints
  return c;
}
function coralSandPx(x, y, top, n) {
  const d = y - top;
  if (d === 0) return CSAND[0];
  if (d === 1) return CSAND[1];
  const ry = y + Math.round(Math.sin(x / 7 + y * 0.5) * 1.2);
  let k = 1 + Math.floor((d - 2) / 14 + n * 0.7);
  if (ry % 4 === 0 && d > 3) k++;
  let c = CSAND[clamp(k, 1, 4)];
  if (nz(x, y + 77) > 0.975) c = I('#ffffff');
  else if (nz(x, y + 78) > 0.985) c = I('#f2a0a8');   // pink shell grit
  return c;
}
// the lagoon: water over the floor at the walking line, then the floor seen through the water toward the viewer
const seenK = d => 0.36 + 0.34 * ss(0, 30, d);
const waterTint = d => mixI(LAG[3], LAG[6], ss(0, 34, d));
const seen = (c, d) => mixI(c, waterTint(d), seenK(d));
function lagBack(x, y, w) {
  const dy = y - w.y;
  let c = mixI(LAG[2], LAG[4], ss(1, 12, dy));
  if (dy < 2) c = LAG[1];
  if ((Math.floor(x + y * 0.55) % 29 + 29) % 29 < 2 && nz(Math.floor((x + y * 0.55) / 29), 7) > 0.35) c = mixI(c, LAG[0], 0.22);   // light shafts
  return c;
}
function lagFloor(x, y, d, w) {
  const edge = Math.min(x - w.l, w.r - x), dark = 1 - ss(20, 110, edge);
  const rip = Math.sin(x * 0.33 + Math.sin(y * 0.9 + x * 0.021) * 1.7 + y * 0.85);
  let c = rip > 0.72 ? FSAND[0] : rip < -0.55 ? FSAND[2] : FSAND[1];
  if (dark > 0) c = mixI(c, I('#3a3444'), dark * 0.8);
  const m = vn(x / 15, y / 4.5, 11);
  if (m > 0.7) c = mixI(c, I('#3c7448'), 0.55 + (m - 0.7) * 1.2);         // seagrass meadow
  else if (m < 0.18) c = mixI(c, I('#8a7e72'), 0.35);                     // rubble
  return seen(c, d);
}
function pondBack(x, y, w) { const dy = y - w.y; return dy < 1 ? PONDW[0] : dy < 3 ? PONDW[1] : PONDW[2]; }
function pondFace(x, y, w) {
  const u = (x - w.cx) / w.rx, v = (y - w.y) / w.ry, r = Math.sqrt(u * u + v * v);
  const dep = clamp((1 - r) * 2.2 + (vn(x / 11, y / 4, 3) - 0.5) * 0.4, 0, 1);
  let k = Math.min(6, 1 + Math.floor(dep * 6));
  if ((y - w.y) % 5 === 2 && nz(x >> 2, y) > 0.72) k = Math.max(1, k - 2);
  let c = PONDW[k];
  c = mixI(c, I('#ffffff'), Math.max(0, 1 - Math.hypot(u * 1.4 + 0.2, (v - 0.35) * 2.6)) * 0.22);   // the bright sky mirrored
  return c;
}
// jungle floor: moss and leaf litter on the lip, dark earth with roots below; scorched toward the lava area
function bladeH(x) { const a = nz(x, 11); return a < 0.55 ? 1 + (nz(x, 12) * 3.6 | 0) : 0; }
function junglePx(x, y, si, n) {
  const d = y - si, burn = ss(3700, 3900, x);
  if (d < 0) {
    const h = bladeH(x) - (burn > 0.6 ? 2 : 0);
    if (-d > h) return NONE;
    return mixI(-d === h ? MOSS[0] : MOSS[1], I('#6a5a3a'), burn * 0.8);
  }
  let c;
  if (d < 2) c = nz(x, y + 500) > 0.86 ? I('#d08a3e') : MOSS[d === 0 ? 1 : 2];
  else if (d < 4) c = nz(x, y + 600) > 0.8 ? I('#a8602a') : MOSS[3];
  else if (d === 4) c = EARTH[4];
  else {
    // reddish tropical earth in wavy strata, a clay streak here and there, darker toward the bottom
    const wav = Math.sin(x * 0.045 + Math.sin(x * 0.013) * 2) * 2.5 + Math.sin(x * 0.17) * 0.8, sd = d - 4 + wav, band = Math.floor(sd / 8);
    let k = Math.floor(ss(2, 62, d) * 3.6 + (n - 0.5) * 0.8) + (((band % 3) + 3) % 3 === 1 ? 1 : 0);
    if (n > 0.975) k--;
    c = EARTH[clamp(k, 0, 5)];
    const st = ((Math.round(sd) % 8) + 8) % 8;
    if (st === 0 && nz(x >> 3, band + 40) > 0.4) c = mixI(c, I('#b07a52'), 0.45);
    else if (st === 1 && nz(x >> 3, band + 40) > 0.4) c = mixI(c, EARTH[5], 0.3);
  }
  if (burn > 0) c = mixI(c, d < 4 ? I('#5a4e48') : I('#2e2428'), burn * 0.75);
  return c;
}
// basalt shelves (AREA 3): columnar jointing seen from the side, ash on the lip, warm light near the lava
let COLS3 = null;   // per x: [column start, width, joint offset, joint period]
function basaltCol(x) { const c = COLS3 && COLS3[x - 3700]; return c || [x, 8, 0, 14]; }
function lavaGlow(x, y) {
  let g = 0;
  for (const l of LAV) {
    const dx = x < l.x0 ? l.x0 - x : x > l.x1 ? x - l.x1 : 0;
    g = Math.max(g, (1 - ss(0, l.lake ? 70 : 46, dx)) * (0.45 + 0.55 * ss(214, 262, y)));
  }
  return g;
}
function basaltPx(x, y, si, n) {
  const d = y - si;
  if (d < 0) return NONE;
  const [c0, w, off, per] = basaltCol(x), lx = x - c0;
  let t;
  if (d === 0) t = lx < 2 ? 0 : 1;
  else if (d < 3) t = lx < w - 2 ? 1 : 2;
  else {
    t = lx < 2 ? 2 : lx >= w - 2 ? 4 : 3;
    if (lx === 0) t = 5;
    const jy = (d + off) % per;
    if (jy === 0) t = 6; else if (jy === 1 && lx < w - 1) t = Math.max(1, t - 1);
    if (n > 0.95) t = Math.min(7, t + 1);
    t += Math.floor(ss(10, 50, d) * 1.6);
  }
  let c = BAS[clamp(t, 0, 7)];
  if (d < 3 && nz(x, y + 40) > 0.55) c = mixI(c, I('#9a90a0'), 0.55);   // ash on the shelf
  const g = lavaGlow(x, y);
  if (g > 0) c = mixI(c, t <= 2 ? HOT[1] : HOT[3], g * (t <= 2 ? 0.75 : 0.6));
  return c;
}
// crater floor (night): dark rubbly basalt; the boss ledge of hexagonal columns is drawn by its own pass
const LEDGE0 = 5700;
const flatK = t => KR[clamp(Math.round(t * 7), 0, 7)];
function ledgePx(x, y, si, d, n) {
  // the boss ledge: hexagonal basalt columns (14 px), flattened hexagon tops, faces lit by the lake from the right
  const w = 14, ci = Math.floor((x - LEDGE0) / w), lx = (x - LEDGE0) % w, off = nz(ci, 777) * 9 | 0;
  const lake = LAV.find(l => l.lake), lx1 = lake ? lake.x0 : 5944, warm = ss(lx1 - 160, lx1, x);
  if (d < 5) {
    const inset = [3, 1, 0, 1, 2][d];
    if (lx < inset || lx > w - 1 - inset) return d < 2 ? NONE : KR[1];
    if (d === 0) return lx < w * 0.5 ? I('#8a5240') : KR[5];
    if (d === 4) return KR[1];
    const c = d === 1 ? (lx < 4 ? KR[6] : KR[5]) : d === 2 ? KR[5] : KR[4];
    return mixI(c, HOT[2], warm * 0.25);
  }
  const mid = Math.round(w * 0.3), lit = lx >= mid, k = Math.floor(ss(5, 46, d) * 4) / 4;
  let t = (lit ? 0.36 : 0.24) + k * (lit ? 0.36 : 0.2);
  if (lx === mid) t += 0.1; if (lx === 0) t -= 0.14; if (lx === w - 1) t -= 0.05;
  const fy = (d + off) % 15;
  if (fy === 0) t -= 0.14; else if (fy === 1) t += 0.06;
  let c = flatK(t);
  if (lit) c = mixI(c, HOT[2], (0.15 + warm * 0.45) * (0.4 + k * 0.6));
  else c = mixI(c, HOT[4], 0.12 + warm * 0.2);
  if (x >= lx1 - 6) c = mixI(c, HOT[1], 0.25 + (x - lx1 + 6) * 0.08);   // the face above the lake, lit from below
  return c;
}
function craterPx(x, y, si, n) {
  const d = y - si;
  if (d < 0) return NONE;
  if (x >= LEDGE0) return ledgePx(x, y, si, d, n);
  if (x > 5318 && x < 5690 && d < 4) {   // the robots' steel road along the crater floor
    const sx = (x - 5318) % 26;
    if (sx === 0) return d === 0 ? ST[2] : ST[0];
    if (d === 0) return ST[5];
    if (d === 1) return sx === 3 || sx === 22 ? ST[6] : ST[3];
    if (d === 2) return ((x >> 1) % 3) ? I('#c89a28') : I('#2a2620');
    return ST[1];
  }
  let t;
  if (d === 0) t = 5; else if (d < 3) t = 4;
  else {
    t = 3 - Math.floor(ss(4, 40, d) * 2.2 + (n - 0.5) * 1.2);
    if (nz(x >> 2, y >> 1) > 0.82) t++;
    const sd = d + Math.round(Math.sin(x * 0.04) * 2);
    if (sd % 9 === 0 && nz(x >> 3, sd) > 0.4) t--;
  }
  let c = KR[clamp(t, 0, 7)];
  if (d > 2 && d < 7 && nz(x, y + 31) > 0.55) c = mixI(c, I('#6a5a5c'), 0.35);   // ash settled under the lip
  const g = lavaGlow(x, y);
  if (g > 0) c = mixI(c, KR[6], g * 0.6);
  if (d < 2 && nz(x, 44) > 0.6) c = mixI(c, I('#6a5a5c'), 0.5);
  return c;
}
function groundPx(x, y, si) {
  const n = nz(x, y), w = wAt(x);
  if (w && y >= w.y && x >= w.l && x <= w.r) {
    if (y < si) return w.pond ? pondBack(x, y, w) : lagBack(x, y, w);
    if (waterFace(w, x, y)) return w.pond ? pondFace(x, y, w) : lagFloor(x, y, y - si, w);
  }
  if (w && !w.pond && inBar(w, x, y) && y >= w.y - 2) return coralSandPx(x, y, Math.min(si, w.y - 2), n);
  if (w && w.pond && y >= w.y - 3) {
    // sinter terraces round the pool
    const u = (x - w.cx) / w.rx, v = (y - w.y) / w.ry, r = Math.sqrt(u * u + v * v);
    if (r < 1.12 && y >= si - 1) {
      const e = (r - 1) * 30;
      return e < 0.8 ? SINTER[0] : e < 1.8 ? SINTER[1] : Math.round(e + y * 0.3) % 3 === 0 ? SINTER[3] : SINTER[2];
    }
  }
  const l = lAt(x);
  if (l && y >= l.y - 1 && si > l.y) return NONE;   // lava is drawn live
  // the jungle -> basalt and basalt -> crater changes are cross-faded (a dithered seam looked like noise)
  for (const [zx, A, B] of [[ZB, sandPx, junglePx], [ZJ, junglePx, basaltPx], [ZC, basaltPx, craterPx]]) {
    if (Math.abs(x - zx) >= 44) continue;
    const k = ss(zx - 44, zx + 44, x + (vn(x / 6, y / 4, 71) - 0.5) * 14), a = A(x, y, si, n), b = B(x, y, si, n);
    if (a === NONE || b === NONE) return k < 0.5 ? a : b;
    return mixI(a, b, k);
  }
  const z = zoneAt(x, y);
  return z === 0 ? sandPx(x, y, si, n) : z === 1 ? junglePx(x, y, si, n) : z === 2 ? basaltPx(x, y, si, n) : craterPx(x, y, si, n);
}

// ============================================================
// Ground features stamped on the chunks (per world position, so they run on across chunk borders)
// ============================================================
const isWaterFace = (x, y) => { const w = wAt(x); return !!w && !w.pond && waterFace(w, x, y) && y >= gi(x); };
// paint on the lagoon floor: tinted by the water in front of it
function sub(b, x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (!isWaterFace(x, y) || get(b, x, y) === NONE) return;
  put(b, x, y, seen(c, y - gi(x)));
}
function pebble(b, cx, cy, rx, ry, pal) {
  oval(b, cx, cy, rx + 1, ry + 1, OUTI);
  const RX = rx + 0.5, RY = ry + 0.5;
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    if (i * i / (RX * RX) + j * j / (RY * RY) > 1) continue;
    const t = -i / RX - j / RY;
    put(b, cx + i, cy + j, t > 0.7 ? pal[0] : t < -0.6 ? pal[2] : pal[1]);
  }
}
// a bleached driftwood log lying on the sand
function driftwood(b, x, y, len, seed) {
  const pts = [];
  for (let i = 0; i <= len; i++) pts.push([x + i, y + Math.round(Math.sin(i * 0.12 + seed) * 1.2 + i * 0.06)]);
  for (const [px, py] of pts) { rect(b, px, py - 2, 1, 5, OUTI); }
  for (let i = 0; i < pts.length; i++) {
    const [px, py] = pts[i], r = i < 3 || i > len - 3 ? 1 : 2;
    for (let k = -r; k <= r - 1; k++) put(b, px, py + k, k === -r ? DRIFT[0] : k < 0 ? DRIFT[1] : k === r - 1 ? DRIFT[3] : DRIFT[2]);
    if ((i + seed) % 7 === 0) put(b, px, py, DRIFT[3]);
  }
  // a broken branch stub and a knot
  const k = Math.round(len * 0.62), [bx, by] = pts[k];
  line(b, bx - 1, by - 3, bx - 4, by - 6, OUTI, 2); line(b, bx, by - 3, bx - 3, by - 6, DRIFT[1]); put(b, bx - 3, by - 7, OUTI);
  oval(b, pts[Math.round(len * 0.3)][0], pts[Math.round(len * 0.3)][1], 1, 0, DRIFT[3]);
}
// a pair of turtle-flipper tracks up the beach toward the cage, a dragged tail line between them
function turtleTracks(b, x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = lerp(x0, x1, t) + Math.sin(t * 5) * 3, y = lerp(y0, y1, t);
    put(b, x, y, SAND[5]);
    if (i % 2) continue;
    const sp = 3 + (y - y0) * 0.08;
    for (const s of [-1, 1]) { put(b, x - 1, y + s * sp, SAND[6]); put(b, x, y + s * sp, SAND[6]); put(b, x + 1, y + s * sp + s, SAND[6]); put(b, x - 1, y + s * sp - s, SAND[1]); }
  }
}
function starfish(b, x, y, c, tinted) {
  const pts = [[0, -2], [2, -1], [1, 1], [-1, 1], [-2, -1]];
  const p = (px, py, cc) => tinted ? sub(b, px, py, cc) : put(b, px, py, cc);
  p(x, y, c);
  for (const [dx, dy] of pts) { p(x + dx, y + dy, c); p(x + Math.round(dx * 0.5), y + Math.round(dy * 0.5), c); }
  p(x, y - 1, I('#ffd0a0'));
}
function coralDome(b, cx, cy, rx, ry, c, hl) {
  for (let j = -ry; j <= 1; j++) for (let i = -rx; i <= rx; i++) {
    if (i * i / ((rx + 0.5) * (rx + 0.5)) + j * j / ((ry + 0.5) * (ry + 0.5)) > 1) continue;
    let col = (i + j * 2) % 3 === 0 ? mixI(c, 0, 0.35) : c;                 // brain grooves
    if (j < -ry * 0.5 && i < 0) col = hl;
    if (j === 1) col = mixI(c, 0, 0.5);
    sub(b, cx + i, cy + j, col);
  }
}
function staghorn(b, cx, cy, h, c, tip, seed) {
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * 0.42 + (nz(seed, k) - 0.5) * 0.3, L = h * (0.6 + nz(seed + 1, k) * 0.5);
    for (let t = 0; t <= L; t += 0.5) {
      const x = cx + Math.cos(a) * t, y = cy + Math.sin(a) * t;
      sub(b, x, y, t > L - 1.5 ? tip : c);
      if (t > L * 0.5 && Math.abs(t - L * 0.7) < 0.3) { sub(b, x + 1, y - 1, c); sub(b, x + 2, y - 2, tip); }
    }
  }
}
function seaFan(b, cx, cy, r, c) {
  for (let a = -Math.PI * 0.95; a <= -0.05; a += 0.06) for (let t = 1; t <= r; t += 0.5) {
    if (((t * 2) | 0) % 3 === 0 || Math.abs(Math.round(a * 18) % 3) === 0) sub(b, cx + Math.cos(a) * t, cy + Math.sin(a) * t * 0.95, c);
  }
  for (let y = 0; y < 3; y++) sub(b, cx, cy + y, mixI(c, 0, 0.4));
}
function seaGrass(b, cx, cy, n, seed) {
  for (let k = 0; k < n; k++) {
    const x = cx + k * 2 + (nz(seed, k) - 0.5) * 2, h = 5 + nz(seed + 3, k) * 8;
    for (let t = 0; t < h; t++) sub(b, x + Math.sin(t * 0.45 + k) * 0.9, cy - t, t > h - 2 ? I('#7ac25a') : I('#2e7a46'));
  }
}
function reefRock(b, cx, cy, rx, ry) {
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    if (i * i / ((rx + 0.5) * (rx + 0.5)) + j * j / ((ry + 0.5) * (ry + 0.5)) > 1) continue;
    const t = -i / rx - j / ry;
    let c = t > 0.8 ? I('#8a8a96') : t < -0.5 ? I('#2e2c38') : I('#55525e');
    if (nz(cx + i, cy + j) > 0.85) c = I('#6a9a5a');
    sub(b, cx + i, cy + j, c);
  }
}
// a glowing crack running down through the rock: a bright core, a warm halo, short branches
function lavaCrack(b, x, y, n, seed) {
  let cx = x, cy = y, dir = 0;
  const halo = (px, py, k) => { const c = get(b, px, py); if (c !== NONE && c !== OUTI) put(b, px, py, mixI(c, HOT[3], k)); };
  for (let k = 0; k < n && cy < H + 4; k++) {
    const thick = k < n * 0.6;
    halo(cx - 1, cy, 0.5); halo(cx + 1 + (thick ? 1 : 0), cy, 0.5); halo(cx - 2, cy, 0.25); halo(cx + 2 + (thick ? 1 : 0), cy, 0.25);
    put(b, cx, cy, k % 5 === 2 ? LVC[2] : LVC[3]);
    if (thick) put(b, cx + 1, cy, LVC[5]);
    if (nz(seed, k + 40) > 0.86 && k > 2) {   // a branch
      const bd = nz(seed, k + 41) > 0.5 ? 1 : -1;
      for (let j = 1; j < 4 + (nz(seed, k + 42) * 4 | 0); j++) { put(b, cx + bd * j, cy + (j >> 1), LVC[4]); halo(cx + bd * j, cy + (j >> 1) + 1, 0.4); }
    }
    cy++;
    if (k % 3 === 0) { const q = nz(seed * 7 + k, 984); dir = q < 0.35 ? -1 : q > 0.65 ? 1 : 0; }
    cx += dir;
  }
}
function groundFeatures(b, x0) {
  const x1 = x0 + CHW, has = (a, c) => a < x1 + 40 && c > x0 - 40;
  // --- the beaches: pebbles, shells, driftwood, a tide line of seaweed, turtle tracks to the cage
  for (let c = Math.floor((x0 - 30) / 24); c * 24 < x1 + 30; c++) {
    const n = nz(c, 900) * 3 | 0;
    for (let k = 0; k < n; k++) {
      const x = c * 24 + (nz(c, 910 + k) * 24 | 0), z = zoneAt(x, 0);
      if (z !== 0) continue;
      const w = wAt(x);
      const d = 6 + (Math.pow(nz(c, 920 + k), 1.3) * 50 | 0), y = gi(x) + d;
      if (y > H + 4 || (w && waterFace(w, x, y)) || (w && inBar(w, x, y))) continue;
      if (nz(c, 930 + k) > 0.72) { put(b, x, y, nz(c, 931 + k) > 0.5 ? I('#f4f0e6') : I('#f2b8b8')); put(b, x + 1, y, I('#c8b8b0')); continue; }
      const rx = 1 + (nz(c, 940 + k) * 2.6 | 0), ry = 1 + (nz(c, 950 + k) * 1.6 | 0);
      pebble(b, x, y, rx, ry, [I('#7a7486'), I('#3e3848'), I('#26222c')]);
    }
  }
  if (has(150, 230)) driftwood(b, 168, 238, 38, 3);
  if (has(2120, 2190)) driftwood(b, 2128, 252, 30, 7);
  if (has(380, 440)) driftwood(b, 392, 262, 22, 11);
  if (has(440, 650)) turtleTracks(b, 626, 252, 524, 236);
  // seaweed along the tide line near the lagoon
  for (const [a, c2] of [[560, 640], [2070, 2150]]) if (has(a, c2)) for (let x = a; x < c2; x++) {
    const y = gi(x) + 9 + Math.round(Math.sin(x / 11) * 2 + Math.sin(x / 4.3) * 0.8);
    if (nz(x, 970) > 0.3) put(b, x, y, nz(x, 971) > 0.5 ? I('#3a5a34') : I('#5a7a3a'));
    if (nz(x, 972) > 0.75) put(b, x, y - 1, I('#6a8a44'));
  }
  if (has(250, 300)) starfish(b, 270, 252, I('#f07a4a'), false);
  // --- the lagoon floor: coral heads, staghorn, fans, sea grass, reef rocks, starfish, shells, an old anchor
  for (const w of WAT) {
    if (w.pond || !has(w.l, w.r)) continue;
    for (let c = Math.floor((x0 - 40) / 46); c * 46 < x1 + 40; c++) {
      const cx = c * 46 + (nz(c, 700) * 30 | 0), d = 8 + (nz(c, 701) * 24 | 0), cy = 246 + d;
      if (!isWaterFace(cx, cy)) continue;
      const kind = nz(c, 702) * 6 | 0, sc = 0.7 + d / 40;
      if (kind === 0) coralDome(b, cx, cy, Math.round(6 * sc), Math.round(4 * sc), I('#a05aa8'), I('#f0b8f0'));
      else if (kind === 1) staghorn(b, cx, cy, 9 * sc, I('#ff8a6a'), I('#ffe0c8'), c);
      else if (kind === 2) seaFan(b, cx, cy, Math.round(8 * sc), I('#c05ac8'));
      else if (kind === 3) seaGrass(b, cx, cy, 4 + (nz(c, 703) * 4 | 0), c);
      else if (kind === 4) reefRock(b, cx, cy, Math.round(7 * sc), Math.round(3 * sc));
      else { coralDome(b, cx, cy, Math.round(4 * sc), Math.round(3 * sc), I('#e0a040'), I('#ffe08a')); seaGrass(b, cx + 7, cy + 1, 3, c + 5); }
      if (nz(c, 704) > 0.7) starfish(b, cx - 9, cy + 2, I('#ff7040'), true);
      if (nz(c, 705) > 0.6) { sub(b, cx + 12, cy + 3, I('#fff4e0')); sub(b, cx + 13, cy + 3, I('#e0c8b0')); }
    }
    // a rusty anchor half buried in the sand, its chain trailing off
    if (has(1240, 1300)) {
      const ax = 1268, ay = 262, RU = I('#8a4a2a'), RD = I('#5a2e1e');
      for (let y = ay - 9; y <= ay; y++) sub(b, ax, y, RU);
      for (let i = -5; i <= 5; i++) sub(b, ax + i, ay + Math.round(i * i * 0.08), i < 0 ? RU : RD);
      sub(b, ax - 5, ay - 1, RU); sub(b, ax + 5, ay - 1, RD); sub(b, ax - 2, ay - 8, RU); sub(b, ax + 2, ay - 8, RU);
      for (let k = 0; k < 4; k++) sub(b, ax, ay - 11 + (k === 3 ? 1 : 0), k % 2 ? RD : RU);
      for (let i = 1; i < 26; i++) sub(b, ax + i, ay - 10 + Math.round(i * 0.3 + Math.sin(i * 0.5)), i % 2 ? RD : I('#a86040'));
    }
  }
  // --- the jungle: roots and stones in the earth, a few mushrooms
  for (let x = x0 - 30; x < x1 + 30; x += 5) {
    if (zoneAt(x, 0) !== 1 || wAt(x) || nz(x, 31) > 0.42) continue;
    let rx = x, ry = gi(x) + 5;
    const thick = nz(x, 34) > 0.6;
    for (let i = 0; i < 6 + nz(x, 32) * 16; i++) {
      put(b, rx, ry, I('#3a2618')); if (thick && i < 8) put(b, rx + 1, ry, I('#4a3020'));
      ry++; const q = nz(x + i * 7, 33); if (q < 0.28) rx--; else if (q > 0.72) rx++;
    }
  }
  for (let c = Math.floor((x0 - 30) / 30); c * 30 < x1 + 30; c++) {
    const x = c * 30 + (nz(c, 960) * 30 | 0);
    if (zoneAt(x, 0) !== 1 || wAt(x)) continue;
    const y = gi(x) + 10 + (nz(c, 961) * 40 | 0), rx = 1 + (nz(c, 962) * 3 | 0);
    if (y < H + 3) pebble(b, x, y, rx, Math.max(1, rx - 1), [I('#8a7a6a'), I('#5e5044'), I('#3e342c')]);
  }
  // --- AREA 3 and the crater: rubble lit by the lava, a few robot scraps (bolts, a plate) in the crater
  for (let c = Math.floor((x0 - 30) / 20); c * 20 < x1 + 30; c++) {
    const x = c * 20 + (nz(c, 990) * 20 | 0), z = zoneAt(x, 0);
    if (z < 2 || lAt(x) || x >= LEDGE0) continue;
    const y = gi(x) + 7 + (Math.pow(nz(c, 991), 1.3) * 44 | 0), rx = 1 + (nz(c, 992) * 3 | 0);
    if (y > H + 3) continue;
    if (z === 3 && nz(c, 993) > 0.8) { rect(b, x - 2, y - 1, 5, 3, ST[2]); rect(b, x - 2, y - 1, 5, 1, ST[4]); put(b, x - 1, y, ST[5]); put(b, x + 1, y, ST[5]); continue; }
    pebble(b, x, y, rx, Math.max(1, rx - 1), z === 3 ? [KR[6], KR[4], KR[2]] : [BAS[2], BAS[4], BAS[6]]);
  }
  // --- AREA 3 and the crater: glowing cracks creeping through the rock
  for (let c = Math.floor((x0 - 30) / 64); c * 64 < x1 + 30; c++) {
    const x = c * 64 + (nz(c, 980) * 50 | 0), z = zoneAt(x, 0);
    if (z < 2 || lAt(x) || lAt(x + 10) || lAt(x - 10) || nz(c, 981) < 0.35) continue;
    lavaCrack(b, x, gi(x) + 5 + (nz(c, 982) * 8 | 0), 10 + (nz(c, 983) * 22 | 0), c);
  }
}

// ============================================================
// Ground chunks (256 px wide), and the "back" chunks drawn behind the scenery: the shallows behind the beach and the
// lagoon (AREA 1)
// ============================================================
const CHW = 256, CHY = 176, CHH = H + 8 - CHY;
let chunks = null, backs = null, builtFor = null, bakeMs = 0;
const REEF = new Int16Array(2600);
for (let x = 0; x < REEF.length; x++) REEF[x] = Math.round(204 + 2.2 * Math.sin(x / 47) + 1.3 * Math.sin(x / 13 + 1) + (vn(x / 6, 0, 21) - 0.5) * 2);
const reefY = x => REEF[clamp(x | 0, 0, REEF.length - 1)];
function backPx(x, y) {
  if (x > ZB + 20) return NONE;
  const top = reefY(x);
  if (y < top) return NONE;
  const dy = y - top;
  if (dy === 0) return nz(x, 61) > 0.25 ? I('#f6fffc') : I('#c8f2ea');          // surf on the reef
  if (dy === 1) return nz(x, 62) > 0.55 ? I('#e2faf4') : LAG[4];
  if (dy === 2) return LAG[5];                                                  // the reef's drop-off shadow
  let c = mixI(LAG[4], LAG[2], ss(3, 26, dy));
  if (vn(x / 22, y / 4, 31) > 0.68) c = mixI(c, LAG[1], 0.25);                 // wind patches
  // wavelets: little arched crests with a shaded back
  const k = Math.floor((x + (y % 3) * 17) / 9), ph = (x + (y % 3) * 17) % 9;
  if ((y - top) % 3 === 1 && nz(k, y) > 0.55 && ph < 4) c = mixI(c, LAG[0], 0.45);
  else if ((y - top) % 3 === 2 && nz(k, y - 1) > 0.55 && ph < 4) c = mixI(c, LAG[6], 0.25);
  return c;
}
function buildChunks() {
  const t0 = Date.now();
  chunks = []; backs = [];
  for (let x0 = 0; x0 < END + CHW; x0 += CHW) {
    const b = buf(x0, CHY, CHW, CHH);
    for (let lx = 0; lx < CHW; lx++) {
      const x = x0 + lx, si = gi(x);
      for (let y = Math.max(CHY, si - 6); y < CHY + CHH; y++) {
        const c = groundPx(x, y, si);
        if (c !== NONE) b.d[(y - CHY) * CHW + lx] = c;
      }
      // the pond's water between the surface and the floor at the walking line sits above si
      const w = wAt(x);
      if (w && w.pond && x >= w.l && x <= w.r) for (let y = w.y; y < si; y++) b.d[(y - CHY) * CHW + lx] = pondBack(x, y, w);
    }
    groundFeatures(b, x0);
    chunks.push(bake(b));
    // back chunk (only where there is something)
    if (x0 < ZB + 40) {
      const bb = buf(x0, CHY, CHW, 250 - CHY);
      for (let lx = 0; lx < CHW; lx++) {
        const x = x0 + lx, w = wAt(x), lim = Math.min(gi(x) + 2, w ? w.y : 250);
        for (let y = CHY; y < lim; y++) { const c = backPx(x, y); if (c !== NONE) bb.d[(y - CHY) * CHW + lx] = c; }
      }
      backs.push(bake(bb));
    } else backs.push(null);
  }
  bakeMs = Date.now() - t0;
}
function drawChunks(list, cx) {
  if (!list) return;
  for (let i = Math.max(0, Math.floor(cx / CHW)); i * CHW < cx + W && i < list.length; i++) if (list[i]) ctx.drawImage(list[i], i * CHW, CHY);
}

// ============================================================
// Lava: textures baked once. Rivers flow toward the viewer (periodic in y, scrolled); the crater lake is still,
// its cracks breathe. Crust rafts with glowing cracks of varying width over brighter open lava currents: never a
// uniform net.
// ============================================================
const LPER = 72, LPX = 168;   // the river tile (px), periodic both ways, shared by the rivers (each at its own offset)
function riverPx(x, y, s) {
  worleyP(x / 12, y / 6, LPER / 6, s, LPX / 12);
  const edge = WD2 - WD1, id = WID;
  // whole cells become crust rafts where the cover noise (sampled at the cell's centre) is high: rafts of a few
  // plates drifting in open lava, never a uniform net
  const cover = vnP(FX * 12 / 56, FY * 6 / 24, s + 1, LPER / 24, LPX / 56) + (nz(id, s + 9) - 0.5) * 0.22;
  const big = vnP(x / 42, y / 18, s + 2, LPER / 18, LPX / 42), cw = 0.05 + big * 0.1;
  if (cover > 0.6) {
    const imp = cover < 0.7 || big > 0.55;   // the raft's outer cracks glow, the seams inside it only smoulder
    if (edge < cw * 0.4) return imp ? LVC[2] : LVC[6];
    if (edge < cw) return imp ? LVC[4] : CRU[0];
    if (edge < cw + 0.06) return imp ? LVC[6] : CRU[1];
    const tex = nz(x * 3 + (y >> 1), y * 7 + 5);
    let k = 2 + (nz(id, s) * 2.4 | 0) + (edge > cw + 0.3 ? 1 : 0);
    if (tex > 0.86) k--; else if (tex < 0.1) k++;
    return CRU[clamp(k, 1, 5)];
  }
  // open lava: bright currents with darker cooling skins
  const cur = vnP(x / 28, y / 6, s + 3, LPER / 6, LPX / 28) * 0.62 + vnP(x / 8.4, y / 3, s + 4, LPER / 3, LPX / 8.4) * 0.38;
  if (cur < 0.36 && vnP(x / 14, y / 4, s + 6, LPER / 4, LPX / 14) > 0.55) return cur < 0.3 ? LVC[7] : LVC[6];
  return cur > 0.72 ? LVC[1] : cur > 0.6 ? LVC[2] : cur > 0.48 ? LVC[3] : cur > 0.38 ? LVC[4] : LVC[5];
}
function riverTex(s) {
  const b = buf(0, 0, LPX, LPER);
  for (let y = 0; y < LPER; y++) for (let x = 0; x < LPX; x++) b.d[y * LPX + x] = riverPx(x, y, s);
  return bake(b);
}
// the lake: perspective (cells grow toward the viewer), a still dark crust with a hierarchy of cracks (a few wide
// bright ones, many thin dim ones, thinner far away), a few open pools; returns the base and the bright overlay that
// breathes
function lakeTex(l) {
  const w = Math.ceil(l.x1 - l.x0) + 2, h = H + 4 - l.y, b = buf(0, 0, w, h), o = buf(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const near = clamp(y / 28, 0, 1), sc = 0.8 + near * 0.9, X = x + l.x0, u = X / (26 * sc), v = y / (5.5 * sc) + 3;
    worleyP(u, v, 0, 41);
    const edge = WD2 - WD1, id = WID;
    const big = vn(u * 0.33, v * 0.45, 43), cw = (0.012 + big * big * 0.17) * (0.35 + near * 0.9) * (big < 0.42 && near < 0.4 ? 0.3 : 1);
    let c, hot = 0;
    if (y === 0) { c = LVC[1]; hot = 1; }
    else if (y === 1) c = LVC[3];
    else if (y === 2) c = nz(x, 5) > 0.5 ? LVC[5] : LVC[6];
    else if (nz(id, 44) > 0.9 && near > 0.25) {   // an open pool: a whole cell melted
      const t = fbm(X / 9, y / 3, 47, 2);
      c = edge < 0.06 ? LVC[6] : edge < 0.12 ? LVC[4] : t > 0.6 ? LVC[1] : t > 0.45 ? LVC[2] : LVC[3]; hot = edge >= 0.06 ? 1 : 0;
    } else if (edge < cw) {
      const core = edge < cw * 0.4;
      c = big > 0.62 ? (core ? LVC[2] : LVC[3]) : big > 0.42 ? (core ? LVC[3] : LVC[4]) : (core ? LVC[5] : LVC[6]);
      hot = big > 0.42 ? 1 : 0;
    } else if (edge < cw + 0.045) c = big > 0.5 ? CRU[0] : CRU[1];
    else {
      let k = 2 + (nz(id, 49) * 2.6 | 0);
      const tex = vn(X / 2.5, y / 1.4, 51);
      if (tex > 0.76) k--; else if (tex < 0.16) k++;
      c = CRU[clamp(k, 1, 5)];
    }
    b.d[y * w + x] = c;
    if (hot) o.d[y * w + x] = c === LVC[4] ? LVC[2] : c === LVC[3] ? LVC[1] : LVC[0];
  }
  return { base: bake(b), glow: bake(o), w, h };
}
let RIVTEX = null, LAKETEX = null;
function buildLava() {
  if (!RIVTEX) RIVTEX = riverTex(61);
  const lake = LAV.find(l => l.lake);
  LAKETEX = lake ? lakeTex(lake) : null;
}

// ============================================================
// worldLoad: bake once per terrain; reset the effects
// ============================================================
let fx = [], fr = rng(1);
const frr = (a, b) => a + (b - a) * fr();
const platArt = new Map();
L3.worldLoad = function (cp) {
  if (builtFor !== LV.terrain) {
    builtFor = LV.terrain;
    END = LV.end || 6200;
    SI = new Int16Array(END + 2);
    for (let x = 0; x < SI.length; x++) SI[x] = Math.round(groundAt(x + 0.5));
    COLS3 = [];
    for (let x = 3700, i = 0; x < END + 20; i++) {
      const w = 7 + (nz(i, 501) * 5 | 0), off = nz(i, 502) * 20 | 0, per = 11 + (nz(i, 503) * 9 | 0);
      for (let k = 0; k < w; k++) COLS3[x + k - 3700] = [x, w, off, per];
      x += w;
    }
    liquidGeom();
    buildChunks();
    const t1 = Date.now();
    buildLava();
    platArt.clear();
    for (const pl of LV.plats) buildPlat(pl);
    BACKS3 = LAV.filter(l => !l.lake).map((l, i) => { const o = backBasaltBuf(l, i); o.l = l; return o; });
    bakeMs += Date.now() - t1;
    L3.worldBakeMs = bakeMs;
  }
  fx.length = 0;
  fr = rng(0x15ad + Math.round(cp || 0));
  waders.clear();
};
const waders = new Map();

// ============================================================
// Platforms (pier, log, rock, column, catwalk: baked once each from the top at pl.y down to the ground or the lava;
// lily pads are drawn live so they bob)
// ============================================================
const WD = P('#f2cc92', '#cf9e62', '#a87842', '#7e562e', '#5a3a20', '#3c2816');
function platPier(pl) {
  const x0 = pl.x - 6, x1 = pl.x + pl.w + 6, top = pl.y, w = wAt(pl.x + pl.w / 2), wy = w ? w.y : 234;
  const bot = Math.max(gi(pl.x), gi(pl.x + pl.w)) + 2, b = buf(x0, top - 26, x1 - x0, bot - top + 28);
  const piles = [];
  for (let px = pl.x + 3; px <= pl.x + pl.w - 8; px += 21) piles.push(px);
  piles.push(pl.x + pl.w - 7);
  // cross braces under the deck
  for (let i = 0; i + 1 < piles.length; i++) {
    const a = piles[i] + 4, c = piles[i + 1];
    line(b, a, top + 8, c, wy + 6, WD[4], 2); line(b, a, wy + 6, c, top + 8, WD[3], 2);
    line(b, a, top + 7, c, wy + 5, WD[2]);
  }
  // piles: round logs down to the lagoon floor, weed and barnacles at the water line
  for (const px of piles) for (let y = top + 4; y <= gi(px) + 1; y++) for (let k = 0; k < 5; k++) {
    let c = WD[[1, 2, 2, 3, 4][k]];
    if ((y + px) % 7 === 0 && k > 0 && k < 4) c = WD[3];
    if (y >= wy - 4 && y <= wy + 2) c = nz(px + k, y) > 0.5 ? I('#5f8a3a') : I('#3f6a32');
    if (y >= wy - 3 && y < wy && nz(px + k, y + 3) > 0.8) c = I('#e8e2d0');
    put(b, px + k, y, c);
  }
  // a ladder down into the water at the far end
  const lx = pl.x + pl.w - 14;
  for (let y = top + 6; y < wy + 8; y++) { put(b, lx, y, WD[3]); put(b, lx + 5, y, WD[3]); if ((y - top) % 4 === 0) rect(b, lx, y, 6, 1, WD[1]); }
  // the deck: plank tops catching the sun, the side beam with bolts, joist ends
  rect(b, pl.x, top, pl.w, 1, WD[0]);
  rect(b, pl.x, top + 1, pl.w, 1, WD[1]);
  rect(b, pl.x, top + 2, pl.w, 4, WD[2]);
  for (let x = pl.x; x < pl.x + pl.w; x++) { if ((x - pl.x) % 9 === 0) rect(b, x, top + 2, 1, 4, WD[3]); if (nz(x, 71) > 0.8) put(b, x, top + 3, WD[1]); }
  rect(b, pl.x, top + 6, pl.w, 1, WD[4]);
  for (let x = pl.x + 2; x < pl.x + pl.w; x += 7) rect(b, x, top + 7, 3, 2, WD[5]);
  for (let x = pl.x + 5; x < pl.x + pl.w; x += 15) { put(b, x, top + 4, WD[5]); put(b, x - 1, top + 3, WD[0]); }
  // railing posts at the back edge and two sagging ropes
  const posts = [];
  for (let px = pl.x + 2; px < pl.x + pl.w - 2; px += 26) posts.push(px);
  posts.push(pl.x + pl.w - 4);
  for (const px of posts) { rect(b, px, top - 11, 3, 11, WD[2]); rect(b, px, top - 11, 1, 11, WD[1]); rect(b, px + 2, top - 11, 1, 11, WD[3]); rect(b, px - 1, top - 12, 5, 2, WD[0]); }
  for (let i = 0; i + 1 < posts.length; i++) {
    const a = posts[i] + 3, n = posts[i + 1] - a;
    for (let k = 0; k < n; k++) {
      const u = k / n, s1 = Math.round(Math.sin(u * Math.PI) * 3), s2 = Math.round(Math.sin(u * Math.PI) * 2);
      put(b, a + k, top - 9 + s1, I('#e4d4a8')); put(b, a + k, top - 8 + s1, I('#9c8a62')); put(b, a + k, top - 4 + s2, I('#e4d4a8'));
    }
  }
  // a coil of rope, a life ring on the rail, a lantern on the last post
  for (let k = 0; k < 3; k++) oval(b, pl.x + 13, top - 2 - k, 4 - k, 1, k % 2 ? I('#c8b47e') : I('#e4d4a8'));
  const rx = posts[1] != null ? posts[1] - 6 : pl.x + 30, ry = top - 6;
  for (let a = 0; a < 48; a++) { const t = a / 48 * Math.PI * 2; put(b, Math.round(rx + Math.cos(t) * 4), Math.round(ry + Math.sin(t) * 4), ((a >> 3) & 1) ? I('#f4f0ea') : I('#e0392c')); }
  for (let a = 0; a < 32; a++) { const t = a / 32 * Math.PI * 2; put(b, Math.round(rx + Math.cos(t) * 3), Math.round(ry + Math.sin(t) * 3), ((a >> 2) & 1) ? I('#d8d0c4') : I('#b02a22')); }
  const tx = posts[posts.length - 1] + 1;
  rect(b, tx - 2, top - 21, 5, 7, I('#2a2a30')); rect(b, tx - 1, top - 20, 3, 5, I('#ffd36a')); put(b, tx - 1, top - 20, I('#fff4c0')); rect(b, tx - 1, top - 23, 3, 2, I('#2a2a30'));
  rect(b, tx, top - 14, 1, 3, I('#2a2a30'));
  outline(b);
  // the parts under the surface are seen through the water
  for (let y = wy + 1; y < b.y0 + b.h; y++) for (let x = x0; x < x1; x++) { const c = get(b, x, y); if (c !== NONE) put(b, x, y, mixI(c, LAG[4], 0.5 + ss(wy, wy + 14, y) * 0.2)); }
  const s = mk(b);
  s.lamp = [tx, top - 18];
  return s;
}
function platLog(pl) {
  const mid = pl.x + pl.w / 2, gy = Math.max(gi(pl.x + 4), gi(pl.x + pl.w - 4)), r = clamp(Math.floor((gi(mid) - pl.y) / 2), 6, 10), cy = pl.y + r;
  const x0 = pl.x - 6, x1 = pl.x + pl.w + 6, b = buf(x0, pl.y - 8, x1 - x0, Math.max(gy, cy + r) - pl.y + 12);
  // stubby branch supports where the ground falls away under it
  for (const sx of [pl.x + 8, pl.x + pl.w - 12]) { const g = gi(sx); if (g > cy + r - 1) for (let y = cy; y <= g; y++) rect(b, sx - (y - cy) * 0.15, y, 3, 1, BARK[y - cy < 2 ? 2 : 3]); }
  for (let x = pl.x; x < pl.x + pl.w; x++) {
    const rr = r - (x < pl.x + 4 ? (pl.x + 4 - x) * 0.5 : 0) + Math.sin(x * 0.7) * 0.3;
    for (let y = Math.ceil(cy - rr); y <= cy + rr; y++) {
      const t = (y - cy) / rr;
      let c = t < -0.6 ? BARK[0] : t < 0.15 ? BARK[1] : t < 0.6 ? BARK[2] : BARK[3];
      if ((y + Math.round(Math.sin(x / 9) * 1.2)) % 4 === 0 && nz(x >> 2, y) > 0.3 && t > -0.7) c = BARK[Math.min(4, BARK.indexOf(c) + 1)];
      if (nz(x, y) > 0.95) c = BARK[0];
      put(b, x, y, c);
    }
    // moss carpet on top (its top is the platform's surface), dripping down the side
    const md = 2 + Math.round(fbm(x / 6, 0, 33) * 3);
    for (let k = 0; k < md; k++) put(b, x, pl.y + k, k === 0 ? MOSS[0] : k < 2 ? MOSS[1] : MOSS[2]);
    if (nz(x, 34) > 0.82) for (let k = 0; k < 2 + nz(x, 35) * 5; k++) put(b, x, pl.y + md + k, MOSS[2]);
    if (nz(x, 36) > 0.7) put(b, x, pl.y - 1, MOSS[1]);
  }
  // the cut end with its rings
  const ex = pl.x + pl.w;
  oval(b, ex, cy, 2.5, r - 0.5, I('#a8784a')); oval(b, ex, cy, 1.6, r - 2.5, I('#cfa266'));
  for (let y = cy - r + 3; y <= cy + r - 3; y += 3) put(b, ex, y, I('#7a5232'));
  put(b, ex + 1, cy - 3, I('#ecc890'));
  // shelf fungi and a fern
  for (const [fx, fy, s] of [[pl.x + 14, cy + 3, 1], [pl.x + pl.w - 18, cy + 1, 0.8]]) {
    for (const [dy, wd, c] of [[-2, 3, '#ffd890'], [-1, 5, '#ffb050'], [0, 6, '#f08a34'], [1, 4, '#c8601c']]) {
      const ww = Math.round(wd * s);
      for (let k = -ww; k <= ww; k++) put(b, fx + k, fy + dy, I(c));
    }
  }
  for (let k = -3; k <= 3; k++) line(b, pl.x + 30, pl.y, pl.x + 30 + k * 2, pl.y - 5 + Math.abs(k), k % 2 ? LEAF[2] : LEAF[1]);
  outline(b);
  return mk(b);
}
function platRock(pl) {
  const x0 = pl.x - 8, x1 = pl.x + pl.w + 8, gy = Math.max(gi(pl.x - 4), gi(pl.x + pl.w + 4)) + 3, b = buf(x0, pl.y - 10, x1 - x0, gy - pl.y + 14);
  const R = P('#9a948c', '#76706a', '#57524e', '#3e3a38', '#2a2726');
  for (let y = pl.y; y <= gy; y++) {
    const k = (y - pl.y) / Math.max(1, gy - pl.y), bul = Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.8) * 4;
    const xl = Math.round(pl.x - bul + (nz(y, 81) - 0.5) * 1.5), xr = Math.round(pl.x + pl.w + bul - 1 + (nz(y, 82) - 0.5) * 1.5);
    for (let x = xl; x <= xr; x++) {
      const u = (x - xl) / Math.max(1, xr - xl);
      let t = u < 0.12 ? 0 : u < 0.55 ? 1 : u < 0.85 ? 2 : 3;
      if ((x - pl.x + 40) % 9 === 0) t = Math.min(4, t + 1);                    // basalt joints
      if ((y + Math.floor((x - pl.x + 40) / 9) * 5) % 13 === 0) t = Math.min(4, t + 1);
      if (y > gy - 3) t = Math.min(4, t + 1);
      put(b, x, y, R[t]);
    }
  }
  // moss carpet on top, drooping over the edges; blades, a fern, small flowers
  for (let x = pl.x - 1; x <= pl.x + pl.w; x++) {
    const d = 2 + Math.round(fbm(x / 5, 1, 44) * 3);
    for (let k = 0; k < d; k++) put(b, x, pl.y + k, k === 0 ? MOSS[0] : k === 1 ? MOSS[1] : MOSS[2]);
    const h = nz(x, 45) < 0.45 ? 1 + Math.round(nz(x, 46) * 2) : 0;
    for (let k = 1; k <= h; k++) put(b, x, pl.y - k, k === h ? MOSS[0] : MOSS[1]);
    if (nz(x, 47) > 0.8) for (let k = 0; k < 3 + nz(x, 48) * 8; k++) put(b, x, pl.y + d + k, k % 3 ? MOSS[2] : MOSS[1]);
  }
  for (let k = -3; k <= 3; k++) line(b, pl.x + pl.w - 8, pl.y, pl.x + pl.w - 8 + k * 2, pl.y - 6 + Math.abs(k) * 1.2, k % 2 ? LEAF[2] : LEAF[1]);
  for (const fx of [pl.x + 6, pl.x + pl.w * 0.5]) { put(b, fx, pl.y - 2, I('#ffe066')); put(b, fx + 1, pl.y - 2, I('#ff9a3c')); put(b, fx, pl.y - 3, I('#ffe066')); }
  outline(b);
  return mk(b);
}
// a hexagonal basalt column standing in the lava: lit left face, front, dark right face, a hex cap seen a little
// from above, cross joints, chipped corners, lava light from below and glowing low joints
function platColumn(pl) {
  const w = pl.w, x = pl.x, top = pl.y, bot = H + 2, b = buf(x - 2, top - 5, w + 4, bot - top + 8);
  const a = Math.max(2, Math.round(w * 0.22)), cd = 2, seed = x & 255, l = lAt(x + w / 2), ly = l ? l.y : 250;
  // the cap is light ash catching the dusk sky, with a bright top edge: where to land, at a glance (the back basalt
  // has no lit tops at all)
  const K = { cap: I('#a68aa4'), capF: I('#b89cb4'), capL: I('#d8bccc'), capD: I('#6e5a74'), rim: I('#f6e2ea'), rimD: I('#c4a8ba'), f: [I('#5a4868'), I('#3e3150'), I('#261e32')], e01: I('#7a6488'), e12: I('#150f1c'), jn: I('#120d18'), jl: I('#6a5878') };
  const joints = new Set();
  for (let j = 8 + (nz(seed, 1) * 6 | 0); j < bot - top; j += 11 + (nz(seed, j) * 8 | 0)) joints.add(j);
  for (let X = x; X < x + w; X++) {
    const lx = X - x, face = lx < a ? 0 : lx >= w - a ? 2 : 1;
    const yf = face === 0 ? top + Math.round(cd * lx / a) : face === 2 ? top + Math.round(cd * (w - 1 - lx) / a) : top + cd;
    const yb = 2 * top - yf - 1;
    for (let Y = yb; Y <= yf; Y++) {
      let c = Y === yf ? (face === 2 ? K.cap : K.capL) : Y === yb ? (face === 2 ? K.rimD : K.rim) : Y >= yf - 1 ? K.capF : K.cap;
      if (Y > yb && Y < yf - 1 && nz(X, Y + seed) > 0.86) c = K.capD;
      put(b, X, Y, c);
    }
    for (let Y = yf + 1; Y < bot; Y++) {
      const rel = Y - yf;
      let c = K.f[face];
      if (face === 0 && lx === a - 1) c = K.e01;
      if (face === 1 && lx === w - a) c = K.e01;
      if (face === 2 && lx === w - a) c = K.e12;
      if (lx === 0) c = K.e12;
      if ((lx === 0 || lx === w - 1) && (joints.has(rel) || joints.has(rel + 1)) && nz(X, rel + seed) > 0.45) continue;   // chipped corners
      if (joints.has(rel) && Y > ly - 26 && nz(seed, rel) > 0.3 && nz((lx + seed) >> 2, rel + 5) > 0.4) { put(b, X, Y, face === 2 ? LVC[6] : nz(X, Y) > 0.7 ? LVC[2] : LVC[4]); continue; }
      if (joints.has(rel)) c = K.jn;
      else if (joints.has(rel - 1) && face < 2) c = K.jl;
      if (nz(X, Y + seed) > 0.95) c = mixI(c, KR[0], 0.4);
      else if (face < 2 && nz(X, (Y >> 2) + seed) > 0.85) c = mixI(c, I('#8a7898'), 0.16);
      const k = Math.pow(ss(top + 6, ly + 2, Y), 1.6) * 0.92;
      if (k > 0) c = mixI(c, HOT[[2, 3, 4][face]], k);
      put(b, X, Y, c);
    }
  }
  outline(b);
  // a warm rim of lava light down the side facing the lava
  for (let Y = top + 6; Y < bot; Y++) {
    const k = ss(top + 10, ly, Y) * 0.6;
    for (const X of [x, x + w - 1]) { const c = get(b, X, Y); if (c !== NONE && c !== OUTI) put(b, X, Y, mixI(c, HOT[1], 0.25 + k)); }
  }
  return mk(b);
}
function platCatwalk(pl) {
  const x0 = pl.x - 3, x1 = pl.x + pl.w + 3, gy = Math.max(gi(pl.x + 4), gi(pl.x + pl.w - 4)) + 2, top = pl.y, b = buf(x0, top - 14, x1 - x0, gy - top + 16);
  // truss legs with X bracing, bolted feet
  for (const lx of [pl.x + 3, pl.x + pl.w - 7]) {
    const g = gi(lx + 2) + 1;
    rect(b, lx, top + 4, 4, g - top - 4, ST[2]); rect(b, lx, top + 4, 1, g - top - 4, ST[4]); rect(b, lx + 3, top + 4, 1, g - top - 4, ST[1]);
    for (let y = top + 8; y < g - 2; y += 6) put(b, lx + 1, y, ST[5]);
    rect(b, lx - 2, g - 2, 8, 2, ST[3]); put(b, lx - 1, g - 2, ST[5]); put(b, lx + 4, g - 2, ST[5]);
  }
  const la = pl.x + 7, lb = pl.x + pl.w - 7;
  for (let y = top + 6; y < gy - 6; y += 12) { line(b, la, y, lb, y + 10, ST[1]); line(b, la, y + 10, lb, y, ST[2]); }
  // the deck: a bright top edge (the brightest line of the catwalk: where to land), grating, a hazard-striped edge
  rect(b, pl.x, top, pl.w, 1, ST[6]);
  rect(b, pl.x, top + 1, pl.w, 2, ST[3]);
  for (let x = pl.x; x < pl.x + pl.w; x++) { if (x % 3 === 0) put(b, x, top + 1, ST[1]); put(b, x, top + 3, ((x >> 1) % 3) ? I('#e8b830') : I('#2a2620')); put(b, x, top + 4, ST[1]); }
  // rails at the back: posts, a top rail and a middle rail
  for (let x = pl.x; x <= pl.x + pl.w - 1; x += 10) { rect(b, x, top - 10, 2, 10, ST[3]); put(b, x, top - 10, ST[5]); }
  rect(b, pl.x + pl.w - 2, top - 10, 2, 10, ST[3]);
  rect(b, pl.x, top - 11, pl.w, 2, ST[4]); rect(b, pl.x, top - 11, pl.w, 1, ST[5]); rect(b, pl.x, top - 6, pl.w, 1, ST[2]);
  // a warning lamp on the last post
  rect(b, pl.x + pl.w - 3, top - 14, 4, 3, ST[1]);
  outline(b);
  const s = mk(b);
  s.lamp = [pl.x + pl.w - 2, top - 14];
  return s;
}
function buildPlat(pl) {
  let s = null;
  if (pl.t === 'pier') s = platPier(pl);
  else if (pl.t === 'log') s = platLog(pl);
  else if (pl.t === 'rock') s = platRock(pl);
  else if (pl.t === 'column') s = platColumn(pl);
  else if (pl.t === 'catwalk') s = platCatwalk(pl);
  platArt.set(pl, s);
}
// a lily pad floating on the pond (bobbing), a notch, veins, a water lily on some, ripples round it
function drawLily(pl) {
  const w = wAt(pl.x + pl.w / 2), wy = w ? w.y : pl.y + 3, cx = Math.round(pl.x + pl.w / 2), bob = Math.round(Math.sin(G.t * 0.05 + pl.x * 0.13) * 0.6);
  const rx = Math.round(pl.w / 2) + 1, y = pl.y + 2 + bob;
  const ph = (G.t + pl.x) % 90, rr = rx + 2 + (ph >> 3);
  if (ph < 60) { ctx.globalAlpha = 0.7 * (1 - ph / 60); R(cx - rr - 1, wy + 1, 3, 1, '#f4fffa'); R(cx + rr - 1, wy + 1, 3, 1, '#f4fffa'); ctx.globalAlpha = 1; }
  for (let j = -3; j <= 3; j++) { const hw = Math.round((rx + 1) * Math.sqrt(Math.max(0, 1 - (j / 3.4) * (j / 3.4)))); R(cx - hw, y + j, hw * 2 + 1, 1, OUT); }
  for (let j = -2; j <= 2; j++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j / 2.7) * (j / 2.7)))); R(cx - hw, y + j, hw * 2 + 1, 1, css(j < 0 ? LEAF[1] : j === 0 ? LEAF[2] : LEAF[3])); }
  R(cx - rx + 3, y - 2, rx * 2 - 5, 1, css(LEAF[0]));
  // the notch (water showing through) and veins
  R(cx + 1, y - 2, rx - 1, 1, css(PONDW[2])); R(cx + 3, y - 1, rx - 3, 1, css(PONDW[2])); R(cx + 1, y - 1, 2, 1, css(LEAF[3]));
  R(cx - rx + 3, y, rx - 4, 1, css(LEAF[3])); R(cx - 2, y + 1, 1, 1, css(LEAF[3]));
  if ((pl.x >> 2) % 2 === 1) {
    R(cx - 5, y - 4, 5, 2, OUT); R(cx - 4, y - 5, 3, 1, OUT);
    R(cx - 4, y - 4, 3, 1, '#ffffff'); R(cx - 3, y - 5, 1, 1, '#ffd2e6'); R(cx - 5, y - 3, 1, 1, '#ffd2e6'); R(cx - 1, y - 3, 1, 1, '#ffd2e6'); R(cx - 3, y - 3, 1, 1, '#ffd23f');
  }
}
L3.drawPlat = function (pl) {
  if (pl.t === 'lily') { drawLily(pl); return; }
  if (!platArt.has(pl)) buildPlat(pl);
  const s = platArt.get(pl);
  if (!s) { RO(pl.x, pl.y, pl.w, 6, '#8a8f98'); return; }
  blit(s, 0, 0);
  if (pl.t === 'column') {
    const l = lAt(pl.x + pl.w / 2), ly = l ? l.y : 250, k = 0.3 + 0.12 * Math.sin(G.t * 0.09 + pl.x * 0.7);
    ctx.globalAlpha = k; ctx.fillStyle = '#ffb040'; ctx.fillRect(pl.x - 2, ly - 4, pl.w + 4, 4);
    ctx.globalAlpha = k * 0.6; ctx.fillRect(pl.x, ly - 12, pl.w, 8);
    ctx.globalAlpha = 1;
    R(pl.x - 2, ly - 1, 3, 1, '#ffd23f'); R(pl.x + pl.w - 1, ly - 1, 3, 1, '#ffd23f');   // lava lapping round its foot
  }
  if (s.lamp) {
    const on = pl.t === 'pier' ? 0.75 + 0.25 * Math.sin(G.t * 0.11 + pl.x) : ((G.t + pl.x) % 50 < 25 ? 1 : 0);
    const [lx, ly] = s.lamp;
    if (pl.t === 'pier') { ctx.globalAlpha = 0.22 * on; ctx.fillStyle = '#ffd36a'; pdisc(lx, ly, 6); ctx.globalAlpha = 1; }
    else if (on) { R(lx - 1, ly, 3, 2, '#ff3a2a'); R(lx, ly, 1, 1, '#ffd0c0'); ctx.globalAlpha = 0.3; ctx.fillStyle = '#ff4a2a'; pdisc(lx, ly + 1, 5); ctx.globalAlpha = 1; }
    else R(lx - 1, ly, 3, 2, '#6a1a1a');
  }
};

// ============================================================
// Props: palms (black-sand beach, sandbar, far beach) and black lava rocks with a crab
// ============================================================
const PALM_LEAF = P('#c4e47c', '#86c45a', '#559e47', '#357a3b', '#245a2f');
const PALM_TRUNK = P('#d2b088', '#a4845e', '#7a6248', '#5a4836');
function palmFrond(b, x, y, a, L, droop, seed) {
  const steps = Math.ceil(L * 1.6);
  for (let i = 1; i <= steps; i++) {
    const s = i / steps, X = x + Math.cos(a) * L * s, Y = y + Math.sin(a) * L * s + droop * L * s * s;
    let tx = Math.cos(a), ty = Math.sin(a) + 2 * droop * s; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
    put(b, X, Y, s < 0.5 ? I('#8a8a3a') : PALM_LEAF[3]);
    if (i % 2) continue;
    const ll = (1 - s * 0.7) * 8 * Math.min(1.15, L / 18);
    for (const side of [-1, 1]) {
      const r = side * 0.95, dx = tx * Math.cos(r) - ty * Math.sin(r), dy = tx * Math.sin(r) + ty * Math.cos(r) + 0.65, dl = Math.hypot(dx, dy);
      const ux = dx / dl, uy = dy / dl, n = Math.max(1, Math.round(ll * (0.8 + 0.4 * nz(i, side * 7 + seed))));
      const lit = uy < 0.15 || ux < -0.45;
      for (let k = 1; k <= n; k++) put(b, X + ux * k, Y + uy * k, lit ? (k === n && uy < 0 ? PALM_LEAF[0] : PALM_LEAF[1]) : (k > n - 2 ? PALM_LEAF[3] : PALM_LEAF[2]));
    }
  }
}
function palmBuf(hgt, lean, seed) {
  const b = buf(-60, -hgt - 34, 120, hgt + 38);
  const x1 = lean, y1 = -hgt, qx = lean * 0.05 + (nz(seed, 3) - 0.5) * 8, qy = -hgt * 0.55;
  const at = t => [2 * (1 - t) * t * qx + t * t * x1, 2 * (1 - t) * t * qy + t * t * y1];
  const n = Math.ceil(hgt * 2.2);
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = at(t), wd = Math.max(3, Math.round(lerp(6, 3.2, t)));
    const xl = Math.round(x - wd / 2), yy = Math.round(y), ring = ((yy + seed * 7) % 4 + 4) % 4 === 0;
    for (let k = 0; k < wd; k++) put(b, xl + k, yy, ring ? (k === 0 ? PALM_TRUNK[1] : PALM_TRUNK[3]) : k === 0 ? PALM_TRUNK[0] : k === wd - 1 ? PALM_TRUNK[2] : PALM_TRUNK[1]);
  }
  rect(b, -4, -2, 9, 3, PALM_TRUNK[2]); put(b, -5, 0, PALM_TRUNK[2]); put(b, 5, 0, PALM_TRUNK[3]);
  const NF = 10;
  for (let f = 0; f < NF; f++) {
    const a = -Math.PI + 0.1 + (f / (NF - 1)) * (Math.PI - 0.2) + (nz(seed, f + 10) - 0.5) * 0.3;
    const up = Math.abs(a + Math.PI / 2) < 0.5;
    const L = (20 + nz(seed, f + 20) * 10) * (up ? 0.7 : 1);
    palmFrond(b, x1, y1, a, L, 0.5 + nz(seed, f + 30) * 0.4 + (up ? 0.25 : 0), seed * 13 + f);
  }
  for (let k = 0; k < 3; k++) { const cx = x1 + (k - 1) * 2.6, cy = y1 + 3 + (k % 2); oval(b, cx, cy, 1.4, 1.4, I('#6a5628')); put(b, cx - 1, cy - 1, I('#a68e48')); }
  outline(b);
  return b;
}
const PALMS = [[86, 10, 1], [74, -9, 2], [96, 14, 3], [68, 6, 4]].map(([h, l, s]) => mk(palmBuf(h, l, s)));
PROP_TYPES.palm = {
  make(o) { o.v = Math.floor(hsh(o.x * 0.37) * PALMS.length); o.f = hsh(o.x * 0.71) > 0.5 ? 1 : -1; },
  box: () => null,
  hit() {},
  draw(o) {
    const s = PALMS[o.v];
    if (o.f < 0) { ctx.save(); ctx.translate(Math.round(o.x), 0); ctx.scale(-1, 1); swayBlit(s, 0, o.y + 1, sway(o.x * 0.01, 2.4), 3); ctx.restore(); }
    else swayBlit(s, o.x, o.y + 1, sway(o.x * 0.01, 2.4), 3);
  }
};
function beachRockBuf() {
  const b = buf(-20, -18, 40, 20), T = I('#3e3d4c');
  for (const [cx, cy, rx, ry] of [[-4, -6, 12, 7], [7, -4, 9, 5], [-12, -2, 6, 3], [1, -12, 6, 5]]) oval(b, cx, cy, rx, ry, T);
  for (let y = -18; y < 2; y++) for (let x = -20; x < 20; x++) {
    if (get(b, x, y) !== T) continue;
    const up = get(b, x, y - 1) === NONE, up2 = get(b, x, y - 2) === NONE, lf = get(b, x - 1, y) === NONE, dn = get(b, x, y + 2) === NONE, rt = get(b, x + 1, y) === NONE;
    let c = T;
    if (up) c = I('#8a8aa6'); else if (up2 || lf) c = I('#5d6176'); else if (dn || rt) c = I('#2a2a36');
    const n = nz(x + 40, y + 40);
    if (!up && n > 0.9) c = I('#1c1c26'); else if (!up && n > 0.84) c = I('#6a6e84');
    if (y > -3 && nz(x >> 1, y + 7) > 0.5) c = nz(x, y + 9) > 0.5 ? I('#4f7a3a') : I('#3a5e30');
    if (y > -5 && y < -1 && n < 0.07) c = I('#e8e2d0');                      // barnacles
    put(b, x, y, c);
  }
  rect(b, -19, 0, 38, 2, I('#2a2632'));
  outline(b);
  return b;
}
const BEACHROCK = mk(beachRockBuf());
// a little red crab: body, eye stalks, claws (open/closed)
function crab(x, y, open) {
  R(x - 3, y - 3, 7, 3, OUT); R(x - 2, y - 2, 5, 2, '#e0452c'); R(x - 2, y - 2, 5, 1, '#ff7a52');
  R(x - 1, y - 5, 1, 2, OUT); R(x + 1, y - 5, 1, 2, OUT); R(x - 1, y - 5, 1, 1, '#ffffff'); R(x + 1, y - 5, 1, 1, '#ffffff');
  R(x - 3, y, 1, 1, '#a82a1c'); R(x + 3, y, 1, 1, '#a82a1c'); R(x - 2, y, 1, 1, '#a82a1c'); R(x + 2, y, 1, 1, '#a82a1c');
  R(x - 6, y - 4 - open, 2, 2, '#e0452c'); R(x + 5, y - 4 - open, 2, 2, '#e0452c'); R(x - 5, y - 2, 1, 1, '#e0452c'); R(x + 5, y - 2, 1, 1, '#e0452c');
  if (open) { R(x - 6, y - 6, 1, 1, '#ff7a52'); R(x + 6, y - 6, 1, 1, '#ff7a52'); }
}
PROP_TYPES.beachrock = {
  make(o) { o.ph = hsh(o.x) * 400; },
  box: () => null,
  hit() {},
  draw(o) {
    blit(BEACHROCK, o.x, o.y + 1);
    // the crab scuttles along the top, stops, waves its claws
    const t = (G.t + o.ph) % 400, dx = t < 120 ? Math.round(Math.sin(t / 120 * Math.PI) * 6) : t < 200 ? 0 : -Math.round(Math.sin((t - 200) / 120 * Math.PI) * 4);
    crab(Math.round(o.x - 2 + dx), Math.round(o.y - 15), (t > 120 && t < 200 && (t >> 3) % 2) ? 1 : 0);
  }
};

// ============================================================
// drawGround (world space): the baked chunks, then the living parts: water surfaces, caustics, fish, foam, the
// shallows' wash, the lava
// ============================================================
// periodic strips and tiles baked once and scrolled with a few drawImage calls (rather than hundreds of 1 px rects)
function stripTex(w, h, fn) { const b = buf(0, 0, w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); if (c !== NONE) b.d[y * w + x] = c; } return bake(b); }
// a horizontally periodic strip (period P) over world x [x0, x1) with its top at y, scrolled by off px
function tileX(img, P, x0, x1, y, off) {
  off = Math.floor(off);
  for (let x = Math.floor(x0), e = Math.ceil(x1); x < e;) { const tx = ((x + off) % P + P) % P, n = Math.min(P - tx, e - x); ctx.drawImage(img, tx, 0, n, img.height, x, y, n, img.height); x += n; }
}
// a vertically periodic column (tile column i, period P) drawn from y0 to y1 at x, scrolled down by off px
function tileY(img, i, P, x, y0, y1, off) {
  off = ((Math.floor(off) % P) + P) % P;
  for (let y = y0; y < y1;) { const ty = ((y - y0 - off) % P + P) % P, n = Math.min(P - ty, y1 - y); ctx.drawImage(img, i, ty, 1, n, x, y, 1, n); y += n; }
}
const WP = 96, TAU = Math.PI * 2;
const crestF = x => { const a = x / WP * TAU; return Math.sin(a * 2 + 0.8 * Math.sin(a)) + 0.5 * Math.sin(a * 5 + 1); };
const SURF = {};
for (const [k, base, hi] of [['lag', LAG[1], LAG[0]], ['pond', PONDW[1], PONDW[0]], ['crest', NONE, NONE]]) SURF[k] = stripTex(WP, 4, (x, y) => {
  const cr = crestF(x);
  if (y === 0) return cr > 1.05 ? I('#ffffff') : NONE;
  if (y === 1) return cr > 0.6 ? I('#ffffff') : base;
  if (y === 3 && hi !== NONE) return Math.sin(x / WP * TAU * 3 + 2) > 0.8 ? hi : NONE;
  return NONE;
});
// lava: the bright surface edge, the front lip, the far reach of a river behind the walking line
const lavaF = x => { const a = x / WP * TAU; return Math.sin(a * 6) + Math.sin(a * 2 + 1); };
const LSURF = stripTex(WP, 2, (x, y) => { const f = lavaF(x); return y === 0 ? (f > 1.3 ? I('#ffa52a') : NONE) : f > 0.6 ? I('#fff8d0') : I('#ffd23f'); });
const LLIP = stripTex(WP, 3, (x, y) => { const f = lavaF(x); return y === 0 ? (f > 0.6 ? I('#fff8d0') : I('#ffd23f')) : f > -0.3 ? I('#ffa52a') : I('#ff7a1a'); });
const FARL = stripTex(WP, 10, (x, y) => {
  const a = x / WP * TAU, f = Math.sin(a * 5) + Math.sin(a * 2 - 1);
  if (y === 0) return f > 0.5 ? I('#ffe88a') : I('#ffb84a');
  if (((x * 7) % 23) < 3 && y === 4 + (x % 3)) return I('#b8300c');
  return y < 2 && f > 0.9 ? I('#ffd23f') : f > 0 ? I('#ffa52a') : y > 6 ? I('#e8601a') : I('#ff7a1a');
});
// caustics: 6 frames of a periodic net of light (world rows 236..270)
const CAUS = [];
for (let k = 0; k < 6; k++) { const tau = k / 6 * TAU; CAUS.push(stripTex(WP, 34, (x, yy) => { const y = yy + 236, a = x / WP * TAU; return Math.sin(a * 3 + Math.sin(y * 0.41 + tau) * 2.1 + tau) + Math.sin(a * 2 - y * 0.29 - tau * 2) > 1.45 ? I('#f0fff8') : NONE; })); }
// falls: per column streak tiles (period 96 / 48), each column scrolled at its own speed
const LFALL = stripTex(5, 48, (i, y) => { const s = ((y + Math.floor(nz(i, 9) * 48)) % 13 + 13) % 13, e = Math.min(i, 4 - i); return e === 0 ? I('#c8401a') : s < 2 ? I('#fff1a0') : s > 9 ? I('#e8501a') : I('#ffb52e'); });
function waterSurface(w, cx) {
  const t = G.t, img = w.pond ? SURF.pond : SURF.lag;
  for (const [a, b] of w.segs) { const xa = Math.max(a, Math.floor(cx) - 2), xb = Math.min(b + 1, Math.ceil(cx + W) + 2); if (xa < xb) tileX(img, WP, xa, xb, w.y - 1, -t * 0.3); }
  // sun glints twinkling on the water in front
  const xa = Math.max(Math.floor(cx) - 2, w.l), xb = Math.min(cx + W + 2, w.r), n = Math.round((xb - xa) / 9);
  for (let i = 0; i < n; i++) {
    const cyc = 12 + (i % 9), k = Math.floor((t + i * 7) / cyc), life = (t + i * 7) % cyc;
    if (life > cyc - 4) continue;
    const x = Math.round(xa + hsh(i * 3.7 + k * 0.61 + w.x0) * (xb - xa)), y = w.y + 3 + Math.round(Math.pow(hsh(i * 5.3 + k * 0.37), 1.6) * (w.pond ? 24 : 32));
    if (!waterFace(w, x, y) && y >= gi(x)) continue;
    R(x, y, life < 2 ? 2 : 1, 1, life < 2 ? '#ffffff' : '#e8fffa');
    if (life === 1 && i % 5 === 0) { R(x - 1, y, 4, 1, '#ffffff'); R(x, y - 1, 1, 3, '#ffffff'); }
  }
}
function caustics(w, cx) {
  // the light net drawn in 8 px columns down to where the face ends (the shores and the sandbar slant)
  const img = CAUS[Math.floor(G.t / 9) % 6], x0 = Math.max(Math.floor(cx / 8) * 8, w.l), x1 = Math.min(cx + W, w.r);
  ctx.globalAlpha = 0.26;
  for (let x = x0; x < x1; x += 8) {
    const xe = Math.min(x + 8, x1), si = Math.max(gi(x), gi(xe));
    let ymax = Math.min(H, w.y + (x - w.l) / 0.7, w.y + (w.r - xe) / 0.7);
    for (const [b0, b1] of w.bars) { if (xe > b0 - 2 && x < b1 + 2) ymax = 0; else if (xe <= b0) ymax = Math.min(ymax, w.y + (b0 - 2 - xe) / 0.55); else ymax = Math.min(ymax, w.y + (x - b1 - 2) / 0.55); }
    const y0 = si + 2, y1 = Math.floor(ymax);
    if (y1 <= y0) continue;
    const tx = x % WP;
    ctx.drawImage(img, tx, y0 - 236, Math.min(xe - x, WP - tx), y1 - y0, x, y0, Math.min(xe - x, WP - tx), y1 - y0);
  }
  ctx.globalAlpha = 1;
}
function fish(w, cx) {
  for (let s = 0; s < 7; s++) {
    const base = w.l + 60 + hsh(s * 7.1 + 3) * (w.r - w.l - 120), dir = hsh(s * 3.3) > 0.5 ? 1 : -1;
    const span = 70, ph = (G.t * 0.25 * (0.7 + hsh(s) * 0.5) + s * 50) % (span * 2), off = ph < span ? ph : span * 2 - ph, fd = ph < span ? dir : -dir;
    const sx = base + (off - span / 2) * dir;
    if (sx < cx - 30 || sx > cx + W + 30) continue;
    const sy = 252 + Math.round(hsh(s * 9.9) * 12);
    const col = s % 3 === 0 ? ['#ffd830', '#e89a20'] : s % 3 === 1 ? ['#5ae0ff', '#1a8acc'] : ['#ff9a5a', '#e0602a'];
    for (let k = 0; k < 4 + (s % 3); k++) {
      const fx = Math.round(sx + (hsh(s * 13 + k) - 0.5) * 22 + Math.sin(G.t * 0.07 + k) * 1.5), fy = sy + Math.round((hsh(s * 17 + k) - 0.5) * 8 + Math.sin(G.t * 0.05 + k * 2));
      if (!waterFace(w, fx, fy) || fy < gi(fx) + 2) continue;
      ctx.globalAlpha = 0.75;
      R(fx - 1, fy, 3, 1, col[0]); R(fx, fy - 1, 1, 1, col[0]); R(fx - fd * 2, fy, 1, 1, col[1]); R(fx - fd * 2, fy - 1, 1, 1, col[1]); R(fx - fd * 2, fy + 1, 1, 1, col[1]);
      R(fx + fd, fy, 1, 1, '#1a2a30');
      ctx.globalAlpha = 1;
    }
  }
}
// foam where the water laps the shores and the sandbar (the lines move in and out)
function shoreFoam(w, cx) {
  if (w.pond) return;
  const edges = [[w.l, 0.7], [w.r, -0.7]];
  for (const [b0, b1] of w.bars) { edges.push([b0 - 1, -0.55]); edges.push([b1 + 1, 0.55]); }
  for (const [ex, sl] of edges) {
    if (ex < cx - 40 || ex > cx + W + 40) continue;
    for (let y = w.y; y < H; y++) {
      const wob = Math.sin(G.t * 0.05 + y * 0.4) * 1.2 + Math.sin(G.t * 0.021 + y * 0.13) * 1.5, x = Math.round(ex + (y - w.y) * sl + wob * Math.sign(-sl || 1));
      R(x, y, 2, 1, (y + (G.t >> 3)) % 4 ? '#ffffff' : '#c8f4ee');
      if (nz(y, (G.t >> 4) & 63) > 0.6) R(x - Math.sign(sl) * 2, y, 1, 1, '#e8fffa');
    }
  }
}
// the sea washing up the black sand at the far left (the boat comes in from there)
function shallows(cx) {
  // the sea at the far left washes up the black sand: a slanted shoreline coming toward the viewer, foam on its edge
  if (cx > 120) return;
  const front = 56 + Math.round(Math.sin(G.t * 0.028) * 10 + Math.sin(G.t * 0.071) * 3), si = gi(0);
  ctx.fillStyle = '#3fb6c6'; ctx.globalAlpha = 0.5;
  for (let y = si - 1; y < H; y++) { const xr = Math.round(front - (y - si) * 1.15 + Math.sin(y * 0.6 + G.t * 0.05) * 1.5); if (xr > 0) ctx.fillRect(0, y, xr, 1); }
  ctx.globalAlpha = 1;
  for (let y = si - 1; y < H; y++) {
    const xr = Math.round(front - (y - si) * 1.15 + Math.sin(y * 0.6 + G.t * 0.05) * 1.5);
    if (xr <= 0) break;
    R(xr - 2, y, 2, 1, (y + (G.t >> 3)) % 5 ? '#ffffff' : '#c8f4ee');
    if ((y * 7 + (G.t >> 2)) % 13 === 0 && xr > 12) R(xr - 8 - (y % 5) * 3, y, 3, 1, '#e8fffa');
  }
  R(0, si - 1, front, 1, '#e8fffa');
}
function drawLava(cx) {
  for (let i = 0; i < LAV.length; i++) {
    const l = LAV[i];
    if (l.x1 < cx - 10 || l.x0 > cx + W + 10) continue;
    const x0 = Math.round(l.x0), w = Math.ceil(l.x1 - l.x0) + 1, h = H + 2 - l.y;
    if (l.lake && LAKETEX) {
      ctx.drawImage(LAKETEX.base, x0, l.y);
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(G.t * 0.04) * Math.sin(G.t * 0.013 + 1);
      ctx.drawImage(LAKETEX.glow, x0, l.y);
      ctx.globalAlpha = 1;
    } else if (RIVTEX) {
      const s = Math.floor(G.t * 0.14) % LPER, sy = (LPER - s) % LPER, h1 = Math.min(h, LPER - sy), xa = Math.max(x0, Math.floor(cx) - 2), xb = Math.min(x0 + w, Math.ceil(cx + W) + 2);
      for (let x = xa; x < xb;) {
        const tx = ((x - x0 + i * 61) % LPX + LPX) % LPX, n = Math.min(LPX - tx, xb - x);
        ctx.drawImage(RIVTEX, tx, sy, n, h1, x, l.y, n, h1);
        if (h1 < h) ctx.drawImage(RIVTEX, tx, 0, n, h - h1, x, l.y + h1, n, h - h1);
        x += n;
      }
    }
    // the bright surface edge, rippling
    tileX(LSURF, WP, Math.max(x0, Math.floor(cx) - 2), Math.min(x0 + w, Math.ceil(cx + W) + 2), l.y - 1, G.t * 0.4 + i * 31);
    // bubbles swell and pop
    const nb = Math.max(2, Math.round(w / 40));
    for (let k = 0; k < nb; k++) {
      const per = 70 + (k % 4) * 13, ph = (G.t + Math.floor(hsh(k + l.x0) * per)) % per, gen = Math.floor((G.t + hsh(k + l.x0) * per) / per);
      const bx = Math.round(l.x0 + 6 + hsh(k * 3 + l.x0 + gen * 0.37) * (w - 12)), by = l.y + 2 + Math.round(hsh(k * 5 + gen * 0.71) * (l.lake ? 16 : 6));
      if (ph < 46) { const r = 1 + Math.floor(ph / 16); R(bx - r, by - r, r * 2 + 1, r, '#ffd23f'); R(bx - r + 1, by - r, r * 2 - 1, 1, '#fff8d0'); R(bx - r, by, r * 2 + 1, 1, '#b8300c'); }
      else if (ph < 52) { R(bx - 3, by - 2, 1, 1, '#fff1a0'); R(bx + 3, by - 2, 1, 1, '#fff1a0'); R(bx, by - 4, 1, 1, '#ffa52a'); R(bx - 1, by, 3, 1, '#ff7a1a'); }
    }
  }
}
L3.drawGround = function (cx) {
  drawChunks(chunks, cx);
  for (const w of WAT) {
    if (w.r < cx - 10 || w.l > cx + W + 10) continue;
    if (!w.pond) { caustics(w, cx); fish(w, cx); }
    waterSurface(w, cx);
    shoreFoam(w, cx);
  }
  shallows(cx);
  drawLava(cx);
};

// ============================================================
// drawBehind (world space): the shallows behind AREA 1, then the scenery
// ============================================================
function backSparkle(cx) {
  if (cx > ZB) return;
  for (let i = 0; i < 26; i++) {
    const cyc = 14 + (i % 8), k = Math.floor((G.t + i * 5) / cyc), life = (G.t + i * 5) % cyc;
    if (life > cyc - 4) continue;
    const x = Math.round(cx + hsh(i * 3.1 + k * 0.47) * W), top = reefY(x), y = top + 4 + Math.round(hsh(i * 7.7 + k * 0.29) * 22);
    if (x > ZB || y >= gi(x)) continue;
    R(x, y, life < 2 ? 2 : 1, 1, '#ffffff');
  }
  // the surf line on the reef rolls
  for (let x = Math.floor(cx); x < Math.min(cx + W, ZB); x++) if (Math.sin(x * 0.09 - G.t * 0.05) + Math.sin(x * 0.031 + G.t * 0.02) > 1.2) R(x, reefY(x) - 1, 1, 1, '#ffffff');
}
L3.drawBehind = function (cx) {
  drawChunks(backs, cx);
  backSparkle(cx);
  drawDecor(cx);
};
// ============================================================
// Scenery behind the walking line (built at load; the back basalt and the far lava of each river in worldLoad).
// Kept clear of the platforms, props, cages and spawns of level3-spec section 2: nothing tall stands where a robot
// or a rescue needs to read, and everything is darker or hazier than the robots in front of it.
// ============================================================
// --- AREA 1: sea stacks near the shore (parallax 0.5), the fishing hut, its nets, an outrigger canoe, buoys,
// mooring posts with a gull, a signpost to the jungle
function stackBuf(w, h, seed) {
  const b = buf(-(w >> 1) - 3, -h - 4, w + 6, h + 6), HZ = I('#a8c8d8');
  for (let x = -(w >> 1); x <= (w >> 1); x++) {
    const u = (x + (w >> 1) + 0.5) / (w + 1), prof = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1.1), 2.2)), 0.6);
    // a jagged, stepped top: blocks of basalt broken off
    const step = Math.floor((x + (w >> 1)) / 3), top = Math.round(-h * (0.35 + 0.65 * prof) - (nz(step, seed + 3) - 0.5) * 6);
    for (let y = top; y <= 0; y++) {
      const ledge = (y - top + (step % 3) * 2) % 8;
      let c = u < 0.3 ? I('#8a8298') : u > 0.7 ? I('#34303f') : I('#5a5468');
      if (ledge === 0 && y > top) c = I('#2a2634'); else if (ledge === 1 && u < 0.75) c = I('#a49cb0');
      if (vn(x / 2, y / 3, seed + 5) > 0.7) c = mixI(c, I('#2a2634'), 0.4);
      if (y === top) c = u < 0.55 ? I('#c8bccc') : I('#6a6478');
      if (y > -4) c = y > -2 ? I('#24222e') : I('#3e6a46');            // wet base with a band of weed
      put(b, x, y, mixI(c, HZ, 0.12));
    }
    if (prof > 0.45 && nz(x, seed + 9) > 0.35) { put(b, x, top - 1, nz(x, seed + 11) > 0.5 ? I('#7aa060') : I('#557a4e')); if (nz(x, seed + 12) > 0.6) put(b, x, top - 2, I('#8fb470')); }
  }
  outline(b, I('#22202c'));
  return b;
}
const STACKS = [[24, 26, 1], [14, 15, 2], [30, 34, 3], [12, 10, 4]].map(([w, h, s]) => mk(stackBuf(w, h, s)));
const STACK_AT = [[170, 0], [190, 3], [610, 2], [634, 1], [1120, 0], [1500, 2], [1522, 3]];
function hutBuf() {
  // a fisherman's shack on stilts: woven palm walls, a porthole, an open door, a thatched roof of fronds, a net and
  // floats hung under the eave, oars leaning on it, a fish trap
  const b = buf(-34, -58, 70, 62), WW = 36, x = -18, base = 0, fl = base - 10, wt = fl - 16, rt = wt - 18;
  for (const sx of [1, 11, 24, 34]) { rect(b, x + sx, fl, 2, base - fl + 1, I('#5c4431')); put(b, x + sx, fl, I('#8a6a48')); put(b, x + sx, base - 3, I('#3a2a1e')); }
  line(b, x + 2, base - 1, x + 12, fl + 2, I('#4a3626')); line(b, x + 25, fl + 2, x + 35, base - 1, I('#4a3626'));
  for (let i = 0; i < WW; i++) for (let y = wt; y < fl; y++) {
    const weave = ((i >> 1) + (y >> 1)) % 2;
    put(b, x + i, y, weave ? I('#c8aa68') : I('#a8884a'));
    if ((i + y) % 4 === 0) put(b, x + i, y, I('#e2c98c'));
  }
  rect(b, x, wt, 2, fl - wt, I('#f0dca4')); rect(b, x + WW - 2, wt, 2, fl - wt, I('#7a5a2c'));
  rect(b, x, wt + 1, WW, 1, I('#7a5a32')); rect(b, x, fl - 2, WW, 1, I('#7a5a32'));
  oval(b, x + 9, wt + 7, 3, 3, I('#4a3626')); oval(b, x + 9, wt + 7, 2, 2, I('#2a1f1a')); put(b, x + 8, wt + 6, I('#ffe8a0'));   // porthole, lamp inside
  rect(b, x + 21, wt + 3, 9, fl - wt - 3, I('#2a1f1a')); rect(b, x + 21, wt + 3, 9, 1, I('#5a4030'));
  rect(b, x + 22, wt + 6, 3, 5, I('#3a3040')); put(b, x + 23, wt + 7, I('#ffd36a'));                                            // a lantern glow inside
  rect(b, x - 3, fl, WW + 6, 2, I('#6b4e34')); rect(b, x - 3, fl, WW + 6, 1, I('#a07c54'));
  for (let y = fl + 2; y <= base; y++) { put(b, x + 23, y, I('#7a5a3a')); put(b, x + 28, y, I('#7a5a3a')); if ((y - fl) % 3 === 0) rect(b, x + 23, y, 6, 1, I('#a07c54')); }
  // the roof: layers of palm fronds, a ragged fringe, a ridge pole
  const cx = x + WW / 2;
  for (let r = 0; r < 19; r++) {
    const y = rt + r, half = 6 + r * 1.55;
    for (let xx = Math.round(cx - half); xx <= Math.round(cx + half); xx++) {
      const band = (r + (nz(xx, 5) > 0.6 ? 1 : 0)) % 4;
      let c = band === 0 ? I('#e8d88a') : band === 3 ? I('#8a8a3a') : I('#c4b462');
      if (xx < cx - half + 2.5) c = mixI(c, I('#fff4c8'), 0.35);
      else if (xx > cx + half - 2.5) c = mixI(c, I('#5a5a24'), 0.35);
      put(b, xx, y, c);
    }
  }
  for (let xx = Math.round(cx - 34); xx <= Math.round(cx + 34); xx++) { if (nz(xx, 6) > 0.3) put(b, xx, rt + 19, I('#7a7a30')); if (nz(xx, 7) > 0.7) put(b, xx, rt + 20, I('#6a6a28')); }
  rect(b, Math.round(cx - 7), rt - 1, 15, 2, I('#7a5a34')); rect(b, Math.round(cx - 7), rt - 1, 15, 1, I('#b08a4a'));
  // a net hung under the eave with orange floats
  for (let i = 0; i < 16; i++) { const yy = rt + 20 + Math.round(Math.sin(i / 15 * Math.PI) * 5); for (let k = 0; k < 6; k++) if ((i + k) % 2 === 0) put(b, x - 4 + i, yy + k, I('#6a5c4a')); if (i % 5 === 2) oval(b, x - 4 + i, yy, 1, 1, I('#ff8a3a')); }
  // oars leaning on the wall, a fish trap basket
  line(b, x + WW + 2, base, x + WW - 3, wt - 2, I('#b08a5a')); line(b, x + WW + 3, base, x + WW - 2, wt - 2, I('#7a5a3a')); oval(b, x + WW + 2, base - 3, 1, 3, I('#c8a070'));
  for (let y = base - 7; y <= base; y++) { const hw = 3 + ((y - base + 7) >> 2); for (let i = -hw; i <= hw; i++) put(b, x - 10 + i, y, (i + y) % 3 === 0 ? I('#6a4a2a') : I('#b08850')); }
  outline(b);
  return b;
}
function netRackBuf() {
  const b = buf(-22, -34, 46, 36);
  for (const px of [-18, 18]) { rect(b, px, -30, 2, 31, I('#6a5038')); put(b, px, -30, I('#a07c54')); }
  rect(b, -19, -29, 40, 2, I('#8a6a48')); rect(b, -19, -29, 40, 1, I('#b08a5a'));
  for (let x = -16; x < 18; x++) {
    const u = (x + 16) / 34, sag = Math.round(Math.sin(u * Math.PI * 2) * 2 + 3), len = 14 + Math.round(Math.sin(u * Math.PI * 3) * 3 + nz(x, 3) * 2);
    for (let y = -27; y < -27 + sag + len; y++) if ((x + y) % 3 === 0 || (x - y) % 3 === 0) put(b, x, y, I('#5a4c3c'));
    put(b, x, -27 + sag + len, I('#d8c8a0'));
    if ((x + 20) % 6 === 0) { oval(b, x, -27 + sag + len, 1, 1, x % 12 ? I('#ff8a3a') : I('#f4f0e6')); }
  }
  // a little fish hung to dry
  rect(b, 8, -24, 1, 3, I('#5a4c3c')); rect(b, 7, -21, 3, 5, I('#a8b8c8')); put(b, 7, -21, I('#e0e8f0')); put(b, 8, -16, I('#7a8898')); put(b, 7, -15, I('#7a8898')); put(b, 9, -15, I('#7a8898'));
  outline(b);
  return b;
}
function canoeBuf() {
  const b = buf(-26, -12, 54, 14), x = -24, y = 0;
  rect(b, x + 8, y - 8, 30, 2, I('#d8c49a')); rect(b, x + 8, y - 8, 30, 1, I('#efe0b8'));
  for (const bx of [x + 13, x + 31]) line(b, bx, y - 7, bx + 1, y - 2, I('#8a6a48'));
  poly(b, [[x, y - 5], [x + 47, y - 5], [x + 44, y], [x + 4, y]], I('#a8462c'));
  rect(b, x + 1, y - 5, 46, 1, I('#e0804a')); rect(b, x + 4, y - 1, 40, 1, I('#6a2a1c'));
  for (let i = x + 8; i < x + 42; i += 7) rect(b, i, y - 4, 4, 1, I('#f4e0a0'));
  put(b, x, y - 6, I('#a8462c')); put(b, x + 47, y - 6, I('#a8462c'));
  line(b, x + 30, y - 4, x + 44, y - 10, I('#c8a070'));    // a paddle across it
  oval(b, x + 45, y - 10, 2, 1, I('#c8a070'));
  outline(b);
  return b;
}
function buoyBuf() {
  const b = buf(-8, -30, 16, 32);
  rect(b, -4, -16, 9, 14, I('#e0392c'));
  for (const y of [-12, -6]) rect(b, -4, y, 9, 3, I('#f4f0ea'));
  rect(b, -4, -16, 2, 14, I('#ff7a5a')); for (const y of [-12, -6]) rect(b, -4, y, 2, 3, I('#ffffff'));
  rect(b, 3, -16, 2, 14, I('#a8261c')); for (const y of [-12, -6]) rect(b, 3, y, 2, 3, I('#c8c0b8'));
  rect(b, -5, -2, 11, 3, I('#3a3a48')); rect(b, -5, -2, 11, 1, I('#5a5a6a'));
  rect(b, -2, -24, 5, 8, I('#56606e')); rect(b, -1, -23, 3, 5, I('#ffd36a')); put(b, -1, -23, I('#fff4c0'));
  rect(b, -3, -25, 7, 1, I('#3b424d')); rect(b, 0, -28, 1, 3, I('#3b424d'));
  outline(b);
  return b;
}
function postsBuf() {
  const b = buf(-4, -20, 34, 22);
  for (const [px, h] of [[0, 18], [12, 14], [24, 16]]) {
    for (let y = -h; y <= 0; y++) for (let k = 0; k < 4; k++) put(b, px + k, y, [WD[1], WD[2], WD[3], WD[4]][k]);
    rect(b, px, -h, 4, 1, WD[0]);
    for (let y = -3; y <= 0; y++) for (let k = 0; k < 4; k++) put(b, px + k, y, nz(px + k, y) > 0.5 ? I('#5f8a3a') : I('#3f6a32'));
  }
  for (let x = 4; x < 24; x++) put(b, x, -10 + Math.round(Math.sin((x - 4) / 20 * Math.PI) * 3), I('#d8c8a0'));
  outline(b);
  return b;
}
function signBuf() {
  const b = buf(-22, -32, 46, 34);
  rect(b, -2, -20, 4, 21, WD[2]); rect(b, -2, -20, 1, 21, WD[1]);
  rect(b, -20, -31, 42, 12, WD[2]); rect(b, -20, -31, 42, 1, WD[0]); rect(b, -20, -20, 42, 1, WD[4]);
  for (let x = -19; x < 21; x += 8) rect(b, x, -30, 1, 10, WD[3]);
  poly(b, [[21, -31], [26, -25], [21, -19]], WD[2]);
  outline(b);
  return b;
}
const HUT = mk(hutBuf()), NETS = mk(netRackBuf()), CANOE = mk(canoeBuf()), BUOY = mk(buoyBuf()), POSTS = mk(postsBuf()), SIGN = mk(signBuf());
// a seagull standing on a post: bobs its head, sometimes flaps
function gull(x, y) {
  const t = G.t % 300, flap = t > 240 && t < 270 ? ((t >> 2) & 1) : -1, bob = (G.t >> 5) % 3 === 0 ? 1 : 0;
  R(x - 3, y - 4, 7, 4, OUT); R(x - 2, y - 3, 5, 2, '#ffffff'); R(x - 2, y - 2, 4, 1, '#d8dce4');
  R(x + 2, y - 6 + bob, 3, 3, OUT); R(x + 2, y - 5 + bob, 2, 1, '#ffffff'); R(x + 5, y - 5 + bob, 2, 1, '#ffb020'); R(x + 3, y - 5 + bob, 1, 1, '#1a1a22');
  if (flap >= 0) { R(x - 4, y - 7 + flap * 2, 6, 2, OUT); R(x - 3, y - 7 + flap * 2, 4, 1, '#c8ccd8'); }
  else { R(x - 3, y - 3, 4, 1, '#9aa0b0'); R(x - 4, y - 2, 1, 1, '#3a3a48'); }
  R(x, y, 1, 2, '#ffb020'); R(x + 1, y, 1, 2, '#ffb020');
}

// --- AREA 2: buttressed jungle giants with lianas and heliconias, giant leaves, ferns, hibiscus, the cliff and the
// waterfall behind the hot-spring pond
function foliage(b, cx, cy, rx, ry, pal, s, rmin = 2.5, rmax = 5.5) {
  const n = Math.max(3, Math.round(rx * ry / (rmin * rmax) * 1.4)), cl = [];
  for (let i = 0; i < n; i++) {
    const a = nz(i, s) * Math.PI * 2, d = Math.sqrt(nz(i, s + 1)), r = rmin + nz(i, s + 2) * (rmax - rmin);
    cl.push([cx + Math.cos(a) * d * Math.max(0, rx - r), cy + Math.sin(a) * d * Math.max(0, ry - r), r]);
  }
  cl.sort((p, q) => p[1] - q[1]);
  for (const [x, y, r] of cl) {
    oval(b, x, y, r + 1, (r + 1) * 0.8, pal[3]);
    oval(b, x, y, r, r * 0.8, pal[2]);
    oval(b, x + 0.5, y - 1, Math.max(0.5, r - 1.3), Math.max(0.5, (r - 1.3) * 0.75), pal[1]);
    oval(b, x - r * 0.25, y - r * 0.45, Math.max(0.5, r * 0.4), Math.max(0.5, r * 0.26), pal[0]);
  }
  const x0 = Math.floor(cx - rx - 2), x1 = Math.ceil(cx + rx + 2), y0 = Math.floor(cy - ry - 2), y1 = Math.ceil(cy + ry + 2);
  for (let i = 0, n2 = (x1 - x0) * (y1 - y0) / 4; i < n2; i++) {
    const x = x0 + Math.floor(nz(i, s + 5) * (x1 - x0)), y = y0 + Math.floor(nz(i, s + 6) * (y1 - y0)), k = pal.indexOf(get(b, x, y));
    if (k < 0 || k > 3) continue;
    const nc = pal[clamp(k + (nz(i, s + 7) < 0.5 ? -1 : 1), 0, 3)], dx = nz(i, s + 8) < 0.5 ? 1 : -1;
    for (let j = 0; j < 2 + (nz(i, s + 9) * 2 | 0); j++) if (pal.indexOf(get(b, x + dx * j, y + j)) >= 0) put(b, x + dx * j, y + j, nc);
  }
}
function bigLeaf(b, x0, y0, a, len, wid, droop, pal, s, splits) {
  const n = Math.ceil(len * 2.2);
  for (let i = 0; i <= n; i++) {
    const t = i / n, cx = x0 + Math.cos(a) * len * t, cy = y0 + Math.sin(a) * len * t + droop * t * t * len;
    const dx = Math.cos(a), dy = Math.sin(a) + 2 * droop * t, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
    const hw = wid * Math.pow(Math.sin(Math.PI * Math.min(1, 0.14 + t * 0.86)), 0.7), L = t * len;
    for (let o = -hw; o <= hw; o += 0.5) {
      const ao = Math.abs(o);
      if (splits) {
        const k = Math.round(L / 4.2), dl = Math.abs(L - k * 4.2);
        if (dl < 0.55 && ao > hw * 0.38 && t > 0.12 && t < 0.92) continue;
        if (Math.abs(dl - 2.1) < 0.8 && ao > hw * 0.2 && ao < hw * 0.32 && nz(k, s + (o < 0 ? 1 : 0)) > 0.4) continue;
      }
      const up = o * ny < 0, vein = Math.abs(((L + ao * 0.7) % 4.2) - 2.1) < 0.35 && ao > 1;
      let c = ao < 0.6 ? pal[0] : up ? pal[1] : pal[2];
      if (vein) c = up ? pal[0] : pal[1];
      if (ao > hw - 0.7) c = up ? pal[2] : pal[3];
      put(b, cx + nx * o, cy + ny * o, c);
    }
  }
}
function paddle(b, x0, y0, a, len, wid, droop, pal, s) {
  const n = Math.ceil(len * 1.6);
  for (let i = 0; i <= n; i++) {
    const t = i / n, cx = x0 + Math.cos(a) * len * t, cy = y0 + Math.sin(a) * len * t + droop * t * t * len;
    const dx = Math.cos(a), dy = Math.sin(a) + 2 * droop * t, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
    const hw = wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.6), slit = nz(Math.floor(t * len / 2.2), s) > 0.72;
    for (let o = -hw; o <= hw; o += 0.5) {
      if (slit && Math.abs(o) > 1.2 && Math.floor(t * len * 1.6) % 3 === 0) continue;
      const up = (o * ny) < 0;
      put(b, cx + nx * o, cy + ny * o, Math.abs(o) < 0.6 ? pal[0] : up ? (Math.abs(o) > hw - 1 ? pal[0] : pal[1]) : (Math.abs(o) > hw - 1 ? pal[3] : pal[2]));
    }
  }
}
function fern(b, x, base, s, pal) {
  for (let k = -3; k <= 3; k++) {
    const a = -Math.PI / 2 + k * 0.42, len = s * (1 - Math.abs(k) * 0.1);
    for (let t = 1; t <= len; t++) {
      const bend = (t / len) * (t / len) * s * 0.35, px = x + Math.cos(a) * t + Math.sign(k) * bend, py = base + Math.sin(a) * t + bend * 0.9;
      put(b, px, py, pal[1]);
      if (t > 1 && t < len - 1 && t % 2 === 0) { put(b, px - 1, py + 1, pal[(t + k) % 3 ? 2 : 0]); put(b, px + 1, py + 1, pal[2]); }
    }
  }
}
const HELI = P('#ff7a5a', '#e8352a', '#b01e1e', '#7a1414'), GOLD = P('#fff3a0', '#ffd23f', '#e09a14', '#a86a0a');
function heliconia(b, x, y0, n) {
  for (let y = y0; y < y0 + n * 6 + 2; y++) put(b, x + (Math.floor((y - y0) / 6) % 2 ? 1 : 0), y, LEAF[3]);
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? 1 : -1, by = y0 + 3 + k * 6, sz = 1 - k / (n + 2), L = Math.round(8 * sz + 2), Ht = Math.max(2, Math.round(4 * sz + 1));
    for (let i = 0; i < L; i++) {
      const t = i / L, top = by - Math.round(t * 3 * sz) - 1, bot = by + Math.round(Ht * (1 - t * 0.7));
      for (let y = top; y <= bot; y++) {
        let c = y === top ? GOLD[1] : y === top + 1 ? HELI[0] : y >= bot - 1 ? HELI[2] : HELI[1];
        if (i >= L - 2) c = y === top ? GOLD[0] : LEAF[1];
        put(b, x + side * (i + 1), y, c);
      }
    }
  }
}
function hibiscus(b, x, y, r, pal) {
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5 + 0.3; oval(b, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.5, pal[1]); }
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5 + 0.3; put(b, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.7 - 1, pal[0]); put(b, x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.36 + 1, pal[2]); }
  oval(b, x, y, 1, 1, pal[3]);
  line(b, x, y, x + r * 0.6, y - r * 0.75, GOLD[1]); put(b, x + r * 0.7, y - r * 0.85, GOLD[0]);
}
// a jungle giant: buttressed trunk from the ground up past the top of the screen, a strangler fig wrapped round it,
// moss, a side branch high up with a clump of leaves, lianas and heliconias hanging from it
function trunkBuf(seed, side) {
  const tall = 240, b = buf(-70, -tall, 140, tall + 3), w = 22 + (nz(seed, 1) * 6 | 0);
  for (let y = -tall; y <= 0; y++) {
    const fl = ss(-46, 0, y), hw = w / 2 + fl * fl * 16, cx = Math.sin(y / 37 + seed) * 2;
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const u = (x - (cx - hw)) / (2 * hw);
      let k = u < 0.14 ? 0 : u < 0.5 ? 1 : u < 0.82 ? 2 : 3;
      const fur = Math.sin(x * 1.3 + Math.sin(y / 11 + x) * 1.5);
      if (fur > 0.85 && u > 0.1) k = Math.min(4, k + 1);
      if (nz(x + 70, y + 300) > 0.95) k = 0;
      let c = BARK[k];
      if (u < 0.55 && fbm(x / 6, y / 10, 52 + seed) > 0.62) c = fbm(x / 3, y / 4, 53) > 0.5 ? MOSS[1] : MOSS[2];
      put(b, x, y, c);
    }
  }
  // buttress roots: fins spreading out to the sides at the foot
  for (const [dx, h] of [[-1, 34], [1, 30], [-1, 18], [1, 22]]) {
    const x0 = dx * (w / 2 - 2), x1 = dx * (w / 2 + 22 + h * 0.3);
    for (let i = 0; i <= Math.abs(x1 - x0); i++) {
      const x = x0 + dx * i, t = i / Math.abs(x1 - x0), top = Math.round(-h * (1 - t) * (1 - t));
      for (let y = top; y <= 0; y++) put(b, x, y, y === top ? BARK[dx < 0 ? 0 : 1] : (dx < 0 ? BARK[1] : BARK[2]));
    }
  }
  // strangler fig roots: pale ribbons wrapping the trunk
  const FIG = P('#cdbea2', '#a89880', '#857662');
  for (const c of [[[-w / 2, -200], [w / 2 + 4, -180], [-w / 2 - 2, -150], [w / 2, -120]], [[w / 2, -110], [-w / 2 - 4, -90], [w / 2 + 2, -60], [-6, -2]], [[-w / 2, -70], [-2, -50], [w / 2, -30], [w / 2 + 10, 0]]]) {
    const r = bez(c);
    path(b, r, OUTI, 4); path(b, r, FIG[1], 2); path(b, r.map(([x, y]) => [x - 1, y]), FIG[0], 1);
  }
  // the branch reaching out high up, a clump of leaves at its end
  const by = -tall + 34 + (nz(seed, 2) * 16 | 0), bx1 = side * 62;
  for (let i = 0; i <= 62; i++) {
    const x = side * (w / 2 - 2 + i * 0.9), y = by + Math.round(Math.sin(i / 62 * Math.PI) * -5 + i * 0.12), r = 4 - i * 0.03;
    for (let j = -Math.ceil(r); j <= r; j++) put(b, x, y + j, j < -r * 0.4 ? BARK[0] : j < r * 0.3 ? BARK[1] : BARK[2]);
    if (nz(i, seed + 91) > 0.25) put(b, x, y - Math.ceil(r) - 1, MOSS[nz(i, seed + 92) > 0.5 ? 0 : 1]);
  }
  foliage(b, bx1 + side * 2, by - 6, 18, 11, LEAF, 99 + seed, 3, 5.5);
  foliage(b, side * 4, -tall + 10, 24, 12, LEAF, 120 + seed, 3, 6);
  // lianas hanging from the branch, heliconias on two of them
  for (const [f, len, heli] of [[0.35, 70, 0], [0.62, 46, 1], [0.86, 96, 0]]) {
    const x = Math.round(side * (w / 2 + 56 * f)), y0 = by + 3;
    for (let y = y0; y < y0 + len; y++) {
      const vx = x + Math.round(Math.sin((y - y0) / 12 + x) * 1.6);
      put(b, vx, y, LEAF[3]);
      if ((y - y0) % 6 === 2) { put(b, vx + 1, y, LEAF[1]); put(b, vx + 2, y, LEAF[2]); }
      if ((y - y0) % 6 === 5) put(b, vx - 1, y, LEAF[2]);
    }
    if (heli) heliconia(b, x, y0 + len - 4, 6);
  }
  outline(b);
  return b;
}
const TRUNKS = [[1, 1], [2, -1], [3, 1]].map(([s, d]) => mk(trunkBuf(s, d)));
function giantBuf(kind, seed) {
  const b = buf(-34, -44, 70, 46);
  if (kind === 0) {   // elephant ears
    for (const [a, len, wid] of [[-2.3, 26, 9], [-1.75, 32, 10.5], [-1.2, 25, 8.5]]) {
      const ex = Math.cos(a) * 12, ey = Math.sin(a) * 12;
      line(b, 0, 0, ex, ey, LEAFC[2]);
      bigLeaf(b, ex, ey, a + 0.25, len, wid, 0.35, LEAFC, seed, false);
    }
  } else if (kind === 1) {   // a split monstera
    for (const [a, len, wid] of [[-2.1, 26, 9], [-1.45, 30, 10], [-0.85, 25, 9]]) {
      const ex = Math.cos(a) * 10, ey = Math.sin(a) * 10;
      line(b, 0, 0, ex, ey, LEAFC[2]);
      bigLeaf(b, ex, ey, a + 0.3, len, wid, 0.35, LEAFC, seed, true);
    }
  } else {   // a young banana plant with torn paddles
    rect(b, -1, -16, 3, 16, I('#6a9a48')); rect(b, -1, -16, 1, 16, I('#8ac060'));
    for (const [a, len, wid] of [[-2.5, 26, 6], [-1.9, 30, 7], [-1.15, 28, 6.5], [-0.6, 22, 5.5]]) paddle(b, 0, -14, a, len, wid, 0.5, LEAF, seed + a * 10);
  }
  outline(b);
  return b;
}
const GIANTS = [[0, 7], [1, 9], [2, 11]].map(([k, s]) => mk(giantBuf(k, s)));
function fernBuf(s, seed) {
  const b = buf(-s - 4, -s - 2, 2 * s + 9, s + 4);
  fern(b, 0, 0, s, [LEAF[0], LEAF[1], LEAF[2]]);
  fern(b, -3, 1, s * 0.7, [LEAF[1], LEAF[2], LEAF[3]]);
  outline(b);
  return b;
}
const FERNS = [9, 12, 7].map((s, i) => mk(fernBuf(s, i)));
function bushBuf(seed) {
  const b = buf(-30, -30, 60, 32), RED = P('#ff8a80', '#e8303a', '#b01a2a', '#6a1020');
  foliage(b, -4, -14, 24, 14, LEAF, 31 + seed, 3, 5.5);
  foliage(b, 14, -10, 13, 9, LEAF, 37 + seed, 3, 5);
  for (const [x, y, r] of [[-18, -20, 5], [-4, -24, 5], [10, -17, 5], [20, -10, 4], [-12, -8, 4], [2, -9, 4]]) hibiscus(b, x, y, r, RED);
  outline(b);
  return b;
}
const BUSHES = [0, 1].map(s => mk(bushBuf(s * 10)));
// the mossy basalt cliff behind the pond, with a notch at the top where the waterfall rolls over
const CLIFF_X0 = 3172, CLIFF_X1 = 3342, FALL_X = 3276, FALL_W = 12, FALL_W_C = FALL_W + 2, CLIFF_TOP = 150;
const WFALL = stripTex(FALL_W_C, 96, (i, y) => {
  const e = Math.min(i, FALL_W_C - 1 - i) / (FALL_W_C - 1), s = ((y + Math.floor(nz(i, 7) * 96)) % 24 + 24) % 24;
  let c = e < 0.08 ? I('#4aa4b0') : e < 0.2 ? I('#8ad8dc') : e < 0.32 ? I('#a8e6e4') : I('#cdf2ee');
  if (s < 2 && e > 0.12) c = I('#ffffff'); else if (s > 19 && s < 22 && e > 0.12) c = I('#6cc0c8');
  return c;
});
function cliffTop(x) {
  let t = CLIFF_TOP + 6 * fbm(x / 14, 0.5, 61) + ss(CLIFF_X1 - 40, CLIFF_X1, x) * 30 + (1 - ss(CLIFF_X0, CLIFF_X0 + 34, x)) * 26;
  if (x >= FALL_X - 2 && x <= FALL_X + FALL_W + 2) t = CLIFF_TOP + 6;
  return Math.round(t);
}
function cliffBuf() {
  const b = buf(CLIFF_X0 - 8, CLIFF_TOP - 26, CLIFF_X1 - CLIFF_X0 + 16, 232 - CLIFF_TOP + 26), CB = P('#9a928a', '#7a726c', '#5e5853', '#45403c', '#33302d');
  for (let x = CLIFF_X0; x <= CLIFF_X1; x++) {
    const top = cliffTop(x);
    for (let y = top; y < 230; y++) {
      const sh = Math.round(Math.sin(y / 13 + x * 0.05) * 1.2), fx = ((x + sh) % 9 + 9) % 9;
      let k = fx === 0 ? 4 : fx === 1 ? 0 : fx < 5 ? 1 : 2;
      if ((y + Math.floor((x + sh) / 9) * 5) % 17 === 0) k = 3;
      if (y < top + 2) k = 0;
      let c = CB[k];
      const m = fbm(x / 7, y / 9, 46);
      if (m > 0.58 + ss(top, top + 60, y) * 0.08) c = m > 0.66 ? MOSS[1] : MOSS[2];
      // wet and dark round the falls
      const df = Math.abs(x - (FALL_X + FALL_W / 2));
      if (df < 16) c = mixI(c, I('#2a3a40'), (1 - df / 16) * 0.45);
      c = mixI(c, I('#b8d8c8'), 0.12);   // humid haze
      put(b, x, y, c);
    }
    // overhanging plants on the top edge
    const h = nz(x, 45) < 0.6 ? 1 + Math.round(nz(x, 46) * 4) : 0;
    for (let k = 1; k <= h; k++) put(b, x, top - k, k === h ? MOSS[0] : MOSS[1]);
  }
  foliage(b, CLIFF_X0 + 26, CLIFF_TOP + 10, 22, 12, LEAF, 77, 3, 5.5);
  foliage(b, CLIFF_X1 - 18, CLIFF_TOP + 26, 20, 12, LEAF, 79, 3, 5);
  for (const [x, y, s] of [[CLIFF_X0 + 60, 190, 8], [CLIFF_X1 - 40, 200, 7], [FALL_X - 18, 176, 6], [FALL_X + 30, 182, 7]]) fern(b, x, y, s, [LEAF[0], LEAF[1], LEAF[2]]);
  // a ledge lip at the notch, the falls' throat
  rect(b, FALL_X - 2, CLIFF_TOP + 6, FALL_W + 4, 2, I('#3a4a48'));
  outline(b);
  return b;
}
const CLIFF = mk(cliffBuf());
function waterfall(cx) {
  if (cx > CLIFF_X1 + 10 || cx + W < CLIFF_X0 - 10) return;
  const x0 = FALL_X, y0 = CLIFF_TOP + 7, w = WAT.find(v => v.pond), y1 = w ? w.y : 228;
  for (let i = 0; i < FALL_W_C; i++) tileY(WFALL, i, 96, x0 - 1 + i, y0, y1, G.t * (2.4 + hsh(i * 3.3) * 1.4));
  for (let y = y0 + 34; y < y1; y += 2) { R(x0 - 2 - (y > y0 + 60 ? 1 : 0), y, 1, 2, '#8ad8dc'); R(x0 + FALL_W_C - 1, y, 1 + (y > y0 + 60 ? 1 : 0), 2, '#8ad8dc'); }
  // the lip rolling over, foam and mist at the foot
  for (let x = x0 - 1; x <= x0 + FALL_W + 1; x++) R(x, y0 - 1, 1, 1, (x + (G.t >> 2)) % 3 ? '#e8fffa' : '#8ad8dc');
  const fx = x0 + FALL_W / 2;
  for (let i = 0; i < 14; i++) {
    const ph = (G.t * 0.035 + hsh(i * 4.1)) % 1, a = -Math.PI / 2 + (hsh(i * 2.3) - 0.5) * 2.6, v = 0.8 + hsh(i * 6.7);
    const X = Math.round(fx + Math.cos(a) * v * ph * 20), Y = Math.round(y1 - 1 + Math.sin(a) * v * ph * 20 + 0.08 * (ph * 20) * (ph * 20));
    if (Y > y1) continue;
    R(X, Y, 1, 1, ph < 0.5 ? '#ffffff' : '#c8f0ec');
  }
  R(fx - 11, y1 - 1, 23, 2, '#ffffff'); R(fx - 15, y1, 31, 1, '#e8fffa');
  for (let i = 0; i < 6; i++) {
    const ph = (G.t * 0.008 + i / 6) % 1, X = Math.round(fx - 8 + hsh(i * 3.9) * 16 + ph * 10), Y = Math.round(y1 - 3 - ph * 34), r = 2 + ph * 6;
    ctx.globalAlpha = 0.4 * (1 - ph); ctx.fillStyle = '#f4fffc'; pdisc(X, Y, r);
  }
  ctx.globalAlpha = 1;
}

// --- AREA 3: charred stumps, basalt boulders, steam vents; behind each river the far lava, back columns in shadow
// and a little lava fall
function stumpBuf(h, seed) {
  const b = buf(-10, -h - 8, 22, h + 10);
  for (let y = -h; y <= 0; y++) {
    const hw = 3 + ss(-10, 0, y) * 4;
    for (let x = Math.round(-hw); x <= Math.round(hw); x++) {
      const u = (x + hw) / (2 * hw);
      let c = u < 0.25 ? I('#5a4a48') : u < 0.7 ? I('#3a302e') : I('#241e1e');
      if (nz(x + 20, y + seed) > 0.9) c = I('#ff7a2a');                              // embers in the cracks
      else if ((y + x * 3) % 7 === 0) c = I('#1a1414');
      put(b, x, y, c);
    }
  }
  for (const [dx, dy, l] of [[-3, -h + 6, -6], [2, -h + 12, 7]]) line(b, dx, dy, dx + l, dy - 6, I('#3a302e'), 2);
  for (let x = -3; x <= 3; x++) put(b, x, -h - 1 + Math.abs(x) % 2, I('#2a2222'));
  outline(b);
  return b;
}
function boulderBuf(rx, ry, seed) {
  const b = buf(-rx - 3, -ry * 2 - 3, rx * 2 + 7, ry * 2 + 5);
  const T = I('#4a3c52');
  oval(b, 0, -ry, rx, ry, T); oval(b, -rx * 0.4, -ry * 1.3, rx * 0.5, ry * 0.6, T);
  for (let y = -ry * 2 - 2; y <= 1; y++) for (let x = -rx - 2; x <= rx + 2; x++) {
    if (get(b, x, y) !== T) continue;
    const up = get(b, x, y - 1) === NONE, lf = get(b, x - 1, y) === NONE, up2 = get(b, x, y - 2) === NONE, rt = get(b, x + 1, y) === NONE || get(b, x + 2, y) === NONE;
    let c = up ? BAS[1] : (up2 || lf) ? BAS[2] : rt ? BAS[5] : BAS[3];
    if (!up && nz(x + seed, y) > 0.88) c = BAS[6];
    if (y > -3) c = mixI(c, HOT[3], 0.35);                                           // lava light from below
    put(b, x, y, c);
  }
  outline(b);
  return b;
}
function ventBuf() {
  const b = buf(-14, -10, 28, 12);
  for (let y = -8; y <= 0; y++) { const hw = 4 + (y + 8) * 1.2; for (let x = Math.round(-hw); x <= Math.round(hw); x++) { const u = (x + hw) / (2 * hw); put(b, x, y, y < -6 ? I('#e8d84a') : u < 0.3 ? BAS[2] : u < 0.75 ? BAS[3] : BAS[5]); } }
  for (const [x, y] of [[-6, -3], [5, -2], [-2, -6], [3, -5], [-9, -1]]) { put(b, x, y, I('#f4e860')); put(b, x + 1, y, I('#c8b830')); }   // sulphur crust
  rect(b, -2, -8, 5, 2, I('#1a1418')); put(b, 0, -9, I('#ff9a3a'));
  outline(b);
  return b;
}
const STUMPS = [mk(stumpBuf(26, 1)), mk(stumpBuf(16, 2))];
const BOULDERS = [mk(boulderBuf(11, 6, 1)), mk(boulderBuf(7, 4, 2)), mk(boulderBuf(14, 7, 3))];
const VENT = mk(ventBuf());
// back basalt behind a river: columns in deep, cool shadow (about 30% darker than before and bluer than the basalt the
// hero stands on), broken slanted tops with no lit rim (they must not read as platforms), the river's far reach glowing
// under them, a notch with a little lava fall (built per river in worldLoad)
let BACKS3 = [];
const BK = P('#3e3a5e', '#2e2b4a', '#24213a', '#1a1729');   // lit face, front, shadow face, edges and joints
function backBasaltBuf(l, idx) {
  const x0 = Math.floor(l.x0) - 16, x1 = Math.ceil(l.x1) + 16, top0 = 150, b = buf(x0, top0, x1 - x0, 252 - top0);
  const fallX = Math.round(lerp(l.x0, l.x1, 0.35 + 0.3 * nz(idx, 3)));
  for (let x = x0, i = 0; x < x1; i++) {
    const w = 6 + (nz(i + idx * 20, 81) * 6 | 0), cxm = x + w / 2, u = (cxm - x0) / (x1 - x0);
    // two humped clusters with a dip between them; the fall pours from the dip
    const hump = Math.max(Math.sin(u * Math.PI * 2.1 + idx) * 0.5 + 0.5, 0.25 + 0.2 * Math.sin(u * 9 + idx * 2));
    let top = Math.round(206 - hump * 34 + (nz(i + idx * 20, 82) - 0.5) * 10);
    const notch = Math.abs(cxm - fallX) < 9;
    if (notch) top = Math.max(top, 200);
    // a broken top: each column snapped off at a slant (up to 3 px across it), so no flat ledge shows
    const sl = notch ? 0 : (nz(i + idx * 20, 83) < 0.5 ? -1 : 1) * (0.35 + 0.35 * nz(i + idx * 20, 84));
    const a = Math.max(2, Math.round(w * 0.3));
    for (let X = x; X < Math.min(x + w, x1); X++) {
      const lx = X - x, tp = top + Math.round(sl * (lx - (w - 1) / 2));
      for (let Y = tp; Y < 252; Y++) {
        let c = lx < a ? BK[0] : lx >= w - 2 ? BK[2] : BK[1];
        if (lx === 0) c = BK[3];
        if ((Y - top + (i * 7) % 13) % 14 === 0 && Y - tp > 3) c = BK[3];
        const g = Math.pow(ss(206, 248, Y), 1.4) * 0.75;
        if (g > 0) c = mixI(c, lx < a ? HOT[2] : HOT[3], g);
        put(b, X, Y, c);
      }
    }
    x += w;
  }
  outline(b, I('#151220'));
  return { s: mk(b), fallX, x0, x1 };
}
function farLava(l, cx) {
  // the river's far reach between the banks: a glowing band under the back columns
  const xa = Math.max(Math.floor(cx), Math.round(l.x0) - 2), xb = Math.min(Math.ceil(cx + W), Math.round(l.x1) + 2);
  if (xa < xb) tileX(FARL, WP, xa, xb, 241, G.t * 0.25 + l.x0);
}
function smallFall(x, y0, y1, w) {
  for (let i = 0; i < 5; i++) tileY(LFALL, i, 48, x + i, y0, y1, G.t * (1.8 + hsh(x + i) * 0.8));
  R(x - 1, y0 - 1, w + 2, 1, '#ffd23f');
  R(x - 3, y1 - 2, w + 6, 2, '#ffd23f'); R(x - 1, y1 - 3, w + 2, 1, '#fff1a0');
  for (let i = 0; i < 4; i++) {
    const ph = (G.t * 0.01 + i / 4) % 1;
    ctx.globalAlpha = 0.35 * (1 - ph); ctx.fillStyle = '#7a5a66'; pdisc(x + w / 2 + hsh(i) * 6 - 3 + ph * 6, y1 - 4 - ph * 30, 2 + ph * 5);
  }
  ctx.globalAlpha = 1;
}
// the pipe run along the back of the crater floor: steel in shadow (much darker than the catwalks, no bright top, no
// hazard stripes: those mark the catwalks), dull rust clamps instead
function pipeRunBuf(x0, x1, y) {
  const b = buf(x0 - 4, y - 6, x1 - x0 + 8, 232 - y + 6), dk = c => mixI(c, I('#2a1a1c'), 0.35);
  const D = ST.map(dk), CL = P('#5a3024', '#3e2018');
  for (let x = x0; x <= x1; x++) {
    [D[1], D[2], D[3], D[2], D[1], D[0]].forEach((c, i) => put(b, x, y + i, c));
    if ((x - x0) % 40 === 0) { rect(b, x - 1, y - 1, 4, 8, D[2]); put(b, x - 1, y - 1, D[3]); put(b, x + 2, y + 6, D[0]); }
    if ((x - x0) % 80 === 20) { const g = gi(x); rect(b, x, y + 6, 3, g - y - 6, D[1]); rect(b, x, y + 6, 1, g - y - 6, D[2]); rect(b, x - 2, g - 2, 7, 2, D[2]); }
  }
  for (const ex of [x0 - 2, x1 - 1]) { rect(b, ex, y - 2, 3, 10, D[2]); put(b, ex, y - 2, D[3]); put(b, ex + 1, y + 2, D[0]); }   // flanged ends
  // rust clamps
  for (let x = x0 + 60; x < x1 - 8; x += 120) { rect(b, x, y - 1, 4, 8, CL[1]); rect(b, x, y, 4, 2, CL[0]); }
  outline(b);
  return b;
}
function riserBuf() {
  const b = buf(-10, -112, 22, 114);
  for (let y = -110; y <= 0; y++) { [ST[1], ST[3], ST[5], ST[3], ST[1]].forEach((c, i) => put(b, -2 + i, y, c)); if ((y + 110) % 26 === 0) { rect(b, -3, y, 7, 2, ST[4]); put(b, -3, y, ST[6]); } }
  rect(b, -8, -112, 12, 4, ST[3]); rect(b, -8, -112, 12, 1, ST[5]);
  // a red valve wheel
  for (let a = 0; a < 28; a++) { const t = a / 28 * Math.PI * 2; put(b, Math.round(Math.cos(t) * 5) + 0, Math.round(Math.sin(t) * 5) - 56, I('#e0392c')); }
  line(b, -4, -56, 4, -56, I('#a8261c')); line(b, 0, -60, 0, -52, I('#a8261c'));
  outline(b);
  return b;
}
function craneBuf() {
  // a lattice tower from the crater floor, its arm reaching over the lake (to the right), a cab with a lit window
  const top = -166, b = buf(-14, top - 10, 300, -top + 12), A = ST[3], Bc = ST[1];
  for (let y = top; y <= 0; y++) { put(b, -8, y, A); put(b, -7, y, ST[4]); put(b, 8, y, Bc); put(b, 7, y, A); }
  for (let y = top + 4; y < 0; y += 12) { line(b, -7, y, 7, y + 12, A); line(b, 7, y, -7, y + 12, Bc); rect(b, -8, y, 17, 1, ST[2]); }
  rect(b, -12, -3, 25, 4, ST[2]); rect(b, -12, -3, 25, 1, ST[4]);
  // the arm
  for (let x = -10; x <= 280; x++) {
    put(b, x, top - 1, ST[4]); put(b, x, top, ST[3]); put(b, x, top + 7, ST[2]); put(b, x, top + 8, ST[1]);
    const k = (x + 10) % 10, y = k < 5 ? top + 1 + k * 1.2 : top + 7 - (k - 5) * 1.2;
    put(b, x, Math.round(y), ST[2]);
  }
  // counter-jib weight and the cab
  rect(b, -14, top + 9, 12, 8, ST[2]); rect(b, -14, top + 9, 12, 1, ST[4]); for (let x = -13; x < -2; x += 3) rect(b, x, top + 11, 1, 5, ST[1]);
  rect(b, 6, top + 9, 16, 12, ST[3]); rect(b, 6, top + 9, 16, 1, ST[5]); rect(b, 9, top + 12, 10, 5, I('#ffd36a')); rect(b, 9, top + 12, 10, 1, I('#fff2b0'));
  // a trolley on the arm
  rect(b, 214, top + 8, 10, 4, ST[3]); rect(b, 214, top + 8, 10, 1, ST[5]);
  outline(b);
  return b;
}
function boothBuf() {
  const b = buf(-22, -48, 46, 50);
  rect(b, -20, -36, 40, 36, ST[2]); rect(b, -20, -36, 40, 1, ST[4]); rect(b, -20, -36, 2, 36, ST[3]); rect(b, 18, -36, 2, 36, ST[1]);
  for (let y = -30; y < 0; y += 8) rect(b, -18, y, 36, 1, ST[1]);
  rect(b, -14, -30, 28, 9, I('#1e2a3a')); rect(b, -13, -29, 26, 7, I('#2e5a7a')); rect(b, -13, -29, 26, 1, I('#6ab0d8'));
  for (let x = -12; x < 12; x += 5) rect(b, x, -26, 2, 2, I('#ffd36a'));   // screens inside
  rect(b, 4, -18, 10, 18, ST[1]); rect(b, 5, -17, 8, 17, ST[3]); put(b, 11, -9, ST[6]);
  for (let x = -20; x < 20; x++) put(b, x, -37, ((x >> 1) % 2) ? I('#e8b830') : I('#2a2620'));
  rect(b, -16, -46, 1, 10, ST[4]); oval(b, -16, -46, 2, 1, ST[3]);      // an antenna
  outline(b);
  return b;
}
function lampPostBuf() {
  const b = buf(-4, -42, 9, 44);
  rect(b, -1, -36, 3, 37, ST[2]); rect(b, -1, -36, 1, 37, ST[4]);
  rect(b, -3, -40, 7, 4, ST[1]); rect(b, -3, -1, 7, 2, ST[3]);
  outline(b);
  return b;
}
function dangerBuf() {
  const b = buf(-27, -34, 55, 36);
  rect(b, -1, -14, 3, 15, ST[2]);
  rect(b, -25, -32, 51, 18, I('#e8b830')); rect(b, -25, -32, 51, 1, I('#fff0a0')); rect(b, -25, -15, 51, 1, I('#a87a10'));
  for (let x = -25; x < 26; x++) { put(b, x, -31, ((x >> 1) % 2) ? I('#2a2620') : I('#e8b830')); put(b, x, -16, ((x >> 1) % 2) ? I('#2a2620') : I('#e8b830')); }
  outline(b);
  return b;
}
const PIPES = mk(pipeRunBuf(5306, 5456, 200)), PIPES2 = mk(pipeRunBuf(5512, 5700, 200)), RISER = mk(riserBuf()), CRANE = mk(craneBuf()), BOOTH = mk(boothBuf()), LAMPPOST = mk(lampPostBuf()), DANGER = mk(dangerBuf());

// The decor list: [kind, x, variant]; drawn in this order (far first)
const DECOR = [
  ['nets', 178], ['hut', 270], ['canoe', 454], ['posts', 1110], ['buoy', 1312], ['buoy', 1822], ['sign', 2186],
  ['trunk', 2330, 0], ['giant', 2398, 0], ['bush', 2440, 0], ['giant', 2628, 0], ['giant', 2842, 1], ['trunk', 2852, 1],
  ['bush', 3044, 1], ['giant', 3092, 2], ['trunk', 3110, 2], ['cliff', CLIFF_X0], ['giant', 3412, 1], ['trunk', 3470, 0],
  ['bush', 3536, 0], ['giant', 3706, 0], ['trunk', 3812, 1], ['giant', 3868, 1],
  ['stump', 3898, 0], ['stump', 3946, 1], ['boulder', 3976, 0], ['vent', 4372], ['boulder', 4492, 1], ['boulder', 4880, 2],
  ['vent', 4936], ['vent', 5226], ['boulder', 5262, 1],
  ['crane', 5668], ['pipes', 5306], ['riser', 5452], ['booth', 5622], ['lamp', 5326], ['lamp', 5702], ['danger', 5742]
];
const FERN_AT = [];
for (let x = 2262; x < 3870; x += 23 + (nz(x, 601) * 30 | 0)) if (nz(x, 602) > 0.25 && !(x > 3140 && x < 3370)) FERN_AT.push([x, nz(x, 603) * 3 | 0]);
const decorW = { nets: 30, hut: 50, canoe: 40, posts: 30, buoy: 12, sign: 30, trunk: 120, giant: 40, bush: 34, cliff: 200, stump: 14, boulder: 20, vent: 16, crane: 290, pipes: 420, riser: 14, booth: 26, lamp: 6, danger: 28 };
function drawDecor(cx) {
  // sea stacks off the shore, parallax 0.5 (screen x = X - 0.5 cx)
  if (cx < ZB + 200) for (const [X, v] of STACK_AT) {
    const sx = X + cx * 0.5;
    if (sx < cx - 50 || sx > cx + W + 50 || sx > ZB - 24) continue;   // only out in the bay, never in front of the jungle
    blit(STACKS[v], sx, reefY(Math.round(sx)) + 1);
    for (let i = -14; i <= 14; i += 2) if (Math.sin(G.t * 0.06 + i + X) > 0.2) R(sx + i, reefY(Math.round(sx)) + 1, 2, 1, '#ffffff');
  }
  for (const w of WAT) if (w.pond && w.r > cx - 200 && w.l < cx + W + 200) {
    blit(CLIFF, 0, 0);
    waterfall(cx);
  }
  for (const d of DECOR) {
    const [k, x, v] = d, hw = decorW[k] || 40;
    if (x + hw < cx - 20 || x - hw > cx + W + 20 || k === 'cliff') continue;
    const gy = gi(x);
    switch (k) {
      case 'nets': swayBlit(NETS, x, gy - 3, sway(x, 1.2), 3); break;
      case 'hut': blit(HUT, x, gy - 3); break;
      case 'canoe': blit(CANOE, x, gy - 2); break;
      case 'posts': { const wy = (wAt(x) || { y: 234 }).y; blit(POSTS, x, wy - 4); gull(x + 1, wy - 22); break; }
      case 'buoy': { const wy = 228 + Math.round(Math.sin(G.t * 0.06 + x) * 1.2); blit(BUOY, x, wy); if ((G.t + x) % 70 < 40) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffd36a'; pdisc(x, wy - 21, 4); ctx.globalAlpha = 1; } for (let i = -7; i <= 7; i += 2) if (Math.sin(G.t * 0.1 + i) > 0) R(x + i, wy + 1, 2, 1, '#ffffff'); break; }
      case 'sign': blit(SIGN, x, gy - 1); text('JUNGLE', x - 17, gy - 28, '#5a3a20', 1, 'left', null); break;
      case 'trunk': blit(TRUNKS[v], x, gy + 1); break;
      case 'giant': swayBlit(GIANTS[v], x, gy + 1, sway(x * 0.1, 1.5), 3); break;
      case 'bush': swayBlit(BUSHES[v], x, gy + 1, sway(x * 0.1, 1.2), 3); break;
      case 'stump': blit(STUMPS[v], x, gy + 1); break;
      case 'boulder': blit(BOULDERS[v], x, gy + 1); break;
      case 'vent': blit(VENT, x, gy + 1); break;
      case 'crane': ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); blit(CRANE, 0, gy); craneLive(0, gy); ctx.restore(); break;   // the arm reaches back over the base, away from the arena
      case 'pipes': blit(PIPES, 0, 0); blit(PIPES2, 0, 0); break;   // broken round the flamingo's cage
      case 'riser': blit(RISER, x, gy); break;
      case 'booth': blit(BOOTH, x, gy + 1); if ((G.t >> 4) % 4) R(x - 12 + ((G.t >> 3) % 5) * 5, gy - 27, 2, 2, '#9affc8'); break;
      case 'lamp': blit(LAMPPOST, x, gy + 1); { const on = (G.t + x) % 60 < 30; R(x - 2, gy - 39, 5, 3, on ? '#ff3a2a' : '#5a1a1a'); if (on) { ctx.globalAlpha = 0.3; ctx.fillStyle = '#ff4a2a'; pdisc(x, gy - 38, 6); ctx.globalAlpha = 1; } } break;
      case 'danger': blit(DANGER, x, gy + 1); text('DANGER!', x + 1, gy - 27, '#2a2620', 1, 'center', null); break;
    }
  }
  // ferns along the jungle floor
  if (cx > 2100 && cx < 3950) for (const [x, v] of FERN_AT) if (x > cx - 30 && x < cx + W + 30) swayBlit(FERNS[v], x, gi(x) + 1, sway(x * 0.2, 1.2), 2);
  // behind each lava river: far lava, back columns, a little lava fall
  for (const B of BACKS3) {
    if (B.x1 < cx - 10 || B.x0 > cx + W + 10) continue;
    farLava(B.l, cx);
    blit(B.s, 0, 0);
    smallFall(B.fallX - 2, 197, 241, 5);
  }
}
function craneLive(x, gy) {
  // the hook swinging on its cable under the trolley, the beacon at the tip of the arm
  const top = gy - 166, hx = x + 219 + Math.round(Math.sin(G.t * 0.02) * 3), hy = top + 70;
  for (let y = top + 12; y < hy;) { const cxx = x + 219 + Math.round(Math.sin(G.t * 0.02) * 3 * (y - top - 12) / (hy - top - 12)); let y2 = y + 1; while (y2 < hy && x + 219 + Math.round(Math.sin(G.t * 0.02) * 3 * (y2 - top - 12) / (hy - top - 12)) === cxx) y2++; R(cxx, y, 1, y2 - y, '#2c323c'); y = y2; }
  R(hx - 3, hy, 7, 3, OUT); R(hx - 2, hy, 5, 2, css(ST[3])); R(hx, hy + 3, 1, 4, OUT); R(hx - 2, hy + 6, 3, 1, OUT); R(hx - 2, hy + 4, 1, 2, OUT);
  const on = (G.t >> 4) % 2;
  R(x + 276, top - 4, 4, 3, on ? '#ff3a2a' : '#5a1a1a');
  if (on) { ctx.globalAlpha = 0.3; ctx.fillStyle = '#ff4a2a'; pdisc(x + 278, top - 3, 6); ctx.globalAlpha = 1; }
}

// ============================================================
// drawFront (screen space): the water over the waders, the lava's front lip, effects, low foreground plants
// ============================================================
function frontWater(cx) {
  ctx.save(); ctx.translate(-cx, 0);
  for (const w of WAT) {
    if (w.r < cx - 4 || w.l > cx + W + 4) continue;
    const xa = Math.max(Math.floor(cx), w.l), xb = Math.min(Math.ceil(cx + W), w.r);
    ctx.fillStyle = w.pond ? 'rgba(150,215,205,0.45)' : 'rgba(60,190,205,0.42)';
    let run = xa, rs = gi(xa);
    for (let x = xa + 1; x <= xb + 1; x++) {
      const si = x <= xb ? gi(x) : -1;
      if (si !== rs) { if (rs > w.y + 1) ctx.fillRect(run, w.y + 1, x - run, rs - w.y - 1); run = x; rs = si; }
    }
    ctx.globalAlpha = 0.75;
    for (const [a, b] of w.segs) { const x0 = Math.max(a, xa), x1 = Math.min(b + 1, xb + 1); if (x0 < x1) tileX(SURF.crest, WP, x0, x1, w.y - 1, -G.t * 0.3); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function frontLava(cx) {
  ctx.save(); ctx.translate(-cx, 0);
  for (let i = 0; i < LAV.length; i++) {
    const l = LAV[i];
    if (l.x1 < cx - 4 || l.x0 > cx + W + 4) continue;
    const xa = Math.max(Math.floor(cx), Math.round(l.x0)), xb = Math.min(Math.ceil(cx + W), Math.round(l.x1));
    // glow rising off the lava, then the lip in front of anything standing in it
    ctx.globalAlpha = 0.12 + 0.03 * Math.sin(G.t * 0.07 + l.x0);
    ctx.fillStyle = '#ff6a1a'; ctx.fillRect(xa, l.y - 12, xb - xa, 12);
    ctx.globalAlpha = 0.14; ctx.fillRect(xa, l.y - 5, xb - xa, 5);
    ctx.globalAlpha = 1;
    tileX(LLIP, WP, xa, xb, l.y, G.t * 0.4 + i * 31);
  }
  ctx.restore();
}
L3.drawFront = function (cx) {
  frontWater(cx);
  frontLava(cx);
  drawEffects(cx);
  drawForeground(cx);
};


// ============================================================
// Foreground (screen space, parallax 1.3): low rocks and leaves along the bottom edge, never over a liquid and never
// taller than 22 px above the bottom (below every robot's feet), so they never hide a threat
// ============================================================
function frontRockBuf(seed) {
  const b = buf(-22, -16, 46, 18), T = I('#30303c');
  for (const [cx, cy, rx, ry] of [[-6, -4, 13, 8], [9, -2, 10, 6], [-16, 0, 6, 4]]) oval(b, cx, cy, rx, ry, T);
  for (let y = -16; y < 2; y++) for (let x = -22; x < 24; x++) {
    if (get(b, x, y) !== T) continue;
    const up = get(b, x, y - 1) === NONE, up2 = get(b, x, y - 2) === NONE, lf = get(b, x - 1, y) === NONE;
    let c = up ? I('#6a6a86') : (up2 || lf) ? I('#46465a') : I('#26262e');
    if (!up && nz(x + seed, y + 40) > 0.88) c = I('#1a1a22');
    put(b, x, y, c);
  }
  put(b, -2, -10, I('#f4f0e6')); put(b, -1, -10, I('#e0c8b0')); put(b, 8, -6, I('#f2b8b8'));
  outline(b);
  return b;
}
function frontLeafBuf(seed, flip) {
  const b = buf(-30, -24, 62, 26), D = P('#3a6a34', '#24502a', '#183a20', '#0e2814');
  for (const [a, len, wid] of [[-2.6, 26, 7], [-2.05, 30, 8], [-1.3, 24, 7]]) bigLeaf(b, 0, 0, a * (flip ? -1 : 1) + (flip ? -Math.PI : 0), len, wid, 0.42, D, seed, seed % 2 === 1);
  outline(b);
  return b;
}
function frontStubBuf(w, h, seed) {
  const b = buf(-(w >> 1) - 1, -h - 3, w + 3, h + 5), a = Math.max(2, Math.round(w * 0.25));
  for (let x = -(w >> 1); x < (w >> 1); x++) {
    const lx = x + (w >> 1), face = lx < a ? 0 : lx >= w - a ? 2 : 1, yf = -h + (face === 1 ? 2 : Math.round(2 * (face === 0 ? lx / a : (w - 1 - lx) / a)));
    for (let y = 2 * -h - yf - 1; y <= yf; y++) put(b, x, y, y === yf ? I('#5a4c62') : I('#3e3248'));
    for (let y = yf + 1; y <= 1; y++) {
      let c = [I('#2e2536'), I('#1f1928'), I('#141019')][face];
      if ((y + seed * 3) % 11 === 0) c = I('#0c0910');
      put(b, x, y, mixI(c, HOT[3], ss(-h + 4, 2, y) * 0.5));
    }
  }
  outline(b);
  return b;
}
function frontScrapBuf() {
  const b = buf(-24, -14, 50, 16);
  for (const [cx, cy, rx, ry] of [[-8, -3, 12, 5], [10, -2, 9, 4]]) oval(b, cx, cy, rx, ry, KR[3]);
  for (let y = -10; y < 2; y++) for (let x = -22; x < 22; x++) { const c = get(b, x, y); if (c !== NONE && get(b, x, y - 1) === NONE) put(b, x, y, KR[5]); }
  // a bent steel girder sticking out, with a hazard band
  line(b, -2, -2, 14, -12, ST[3], 3); line(b, -2, -1, 14, -11, ST[1]);
  for (let i = 0; i < 3; i++) put(b, 10 + i, -9 - i, i % 2 ? I('#e8b830') : I('#2a2620'));
  outline(b);
  return b;
}
const FRONT = {
  rock: [mk(frontRockBuf(1)), mk(frontRockBuf(7))],
  leaf: [mk(frontLeafBuf(3, false)), mk(frontLeafBuf(4, true))],
  stub: [mk(frontStubBuf(16, 16, 1)), mk(frontStubBuf(22, 12, 2))],
  scrap: [mk(frontScrapBuf())],
  crock: []
};
{ const b = frontRockBuf(5); for (let i = 0; i < b.d.length; i++) if (b.d[i] !== NONE && b.d[i] !== OUTI) { const v = b.d[i]; b.d[i] = mixI(mixI(v, KR[3], 0.55), HOT[3], ((v >> 8 & 255) > 90) ? 0.45 : 0.12); } FRONT.crock.push(mk(b)); }
const onLiquid = (x, m) => { for (const w of WAT) if (x > w.l - m && x < w.r + m) return true; for (const l of LAV) if (x > l.x0 - m && x < l.x1 + m) return true; return false; };
function drawForeground(cx) {
  const off = cx * 1.3, sp = 96;
  for (let i = Math.floor((off - 80) / sp); i * sp - off < W + 80; i++) {
    if (hsh(i * 1.7 + 3) < 0.35) continue;
    const sx = Math.round(i * sp + hsh(i) * 40 - off), wx = cx + sx, z = zoneAt(wx, 0);
    if (onLiquid(wx, 34)) continue;
    const list = z === 0 ? FRONT.rock : z === 1 ? FRONT.leaf : z === 2 ? FRONT.stub : (hsh(i + 5) < 0.5 ? FRONT.scrap : FRONT.crock);
    const s = list[Math.floor(hsh(i * 3.1) * list.length)];
    if (z === 1) swayBlit(s, sx, H + 3, sway(i * 1.3, 2), 3);
    else blit(s, sx, H + 3);
    if (z === 2 && s === FRONT.stub[0]) { ctx.globalAlpha = 0.2 + 0.1 * Math.sin(G.t * 0.08 + i); ctx.fillStyle = '#ff7a2a'; ctx.fillRect(sx - 10, H - 4, 20, 4); ctx.globalAlpha = 1; }
  }
}

// ============================================================
// Effects (world x, screen y; private rng so the level's seeded play is not disturbed)
// ============================================================
const NOWADE = { shark: 1, lavashark: 1, megawhale: 1, bee: 1, queenbee: 1, hive: 1 };
function addFx(o) { if (fx.length < 180) fx.push(o); }
function splash(x, wy, n, big) {
  for (let i = 0; i < n; i++) addFx({ k: 'drop', x: x + frr(-4, 4), y: wy - frr(0, 2), vx: frr(-1, 1) * (big ? 1.6 : 1), vy: -frr(1, big ? 3.4 : 2.4), t: 0, life: 40, wy, c: fr() < 0.5 ? '#ffffff' : '#bff2ee' });
  addFx({ k: 'ring', x, y: wy + 1, t: 0, life: big ? 32 : 24, r: big ? 3 : 1 });
}
function wade(e, w, n) {
  const last = waders.get(e);
  waders.set(e, e.x);
  if (last == null) return;
  const moving = Math.abs(e.x - last) > 0.25;
  if (moving && (G.t + n * 3) % 9 === 0) splash(e.x + (e.x > last ? 5 : -5), w.y, 3, false);
  if ((G.t + n * 11) % (moving ? 16 : 44) === 0) addFx({ k: 'ring', x: e.x, y: w.y + 1, t: 0, life: 30, r: 2 });
}
let lastHeroY = 0;
L3.worldUpdate = function () {
  const p = G.p, cx = G.cam.x;
  // robots wading in the lagoon or the pond: ripples and splashes (the hero's splashes come from level3.js)
  let n = 1;
  for (const e of G.enemies) {
    if (!e.active || e.dead || NOWADE[e.type]) continue;
    const w = wAt(e.x);
    if (w && e.y > w.y + 1 && e.y < w.y + 30) wade(e, w, n++); else waders.delete(e);
  }
  // ripple rings round the wading hero
  if (p && !p.dead && !p.ride) { const w = wAt(p.x); if (w && p.y > w.y + 1 && p.onGround && G.t % (p.vx ? 14 : 40) === 0) addFx({ k: 'ring', x: p.x, y: w.y + 1, t: 0, life: 30, r: 2 }); }
  // steam from the vents and the hot spring, embers over the lava, leaves in the jungle, ash in the crater
  for (const d of DECOR) if (d[0] === 'vent' && d[1] > cx - 20 && d[1] < cx + W + 20 && G.t % 7 === 0) addFx({ k: 'steam', x: d[1] + frr(-1, 1), y: gi(d[1]) - 9, vx: frr(-0.1, 0.25), vy: -frr(0.35, 0.6), t: 0, life: 70 + (fr() * 30 | 0), r: 1.5, g: frr(0.05, 0.08) });
  for (const w of WAT) if (w.pond && w.r > cx && w.l < cx + W && G.t % 5 === 0) addFx({ k: 'steam', x: frr(w.l + 10, w.r - 10), y: w.y - 1, vx: frr(-0.1, 0.15), vy: -frr(0.18, 0.35), t: 0, life: 80 + (fr() * 40 | 0), r: 1.5, g: frr(0.05, 0.08), soft: 1 });
  for (const l of LAV) if (l.x1 > cx && l.x0 < cx + W && G.t % (l.lake ? 4 : 6) === 0) {
    const x = frr(Math.max(l.x0, cx), Math.min(l.x1, cx + W));
    addFx({ k: 'ember', x, y: l.y - 1, vx: frr(-0.3, 0.3), vy: -frr(0.5, 1.3), t: 0, life: 40 + (fr() * 40 | 0) });
    if (fr() < 0.25) addFx({ k: 'steam', x, y: l.y - 2, vx: frr(-0.1, 0.2), vy: -frr(0.3, 0.5), t: 0, life: 60, r: 2, g: 0.06, smoke: 1 });
  }
  const zc = zoneAt(cx + W / 2, 0);
  if (zc === 1 && G.t % 37 === 0) addFx({ k: 'leaf', x: cx + frr(0, W), y: frr(-6, 60), vx: frr(-0.4, 0.4), vy: frr(0.2, 0.5), t: 0, life: 260, ph: frr(0, 6.3), c: fr() * 3 | 0 });
  if (zc === 3 && G.t % 9 === 0) addFx({ k: 'ash', x: cx + frr(0, W), y: frr(-6, 120), vx: frr(-0.2, 0.3), vy: frr(0.15, 0.35), t: 0, life: 200, ph: frr(0, 6.3) });
  for (const f of fx) {
    f.t++;
    if (f.k === 'drop') { f.vy += 0.2; f.x += f.vx; f.y += f.vy; if (f.y > f.wy + 1 && f.vy > 0) f.t = f.life; }
    else if (f.k === 'steam') { f.x += f.vx; f.y += f.vy; f.vy *= 0.995; f.r += f.g; }
    else if (f.k === 'ember') { f.x += f.vx + Math.sin(f.t * 0.2 + f.x) * 0.15; f.y += f.vy; f.vy *= 0.985; }
    else if (f.k === 'leaf' || f.k === 'ash') {
      f.x += f.vx + Math.sin(f.ph + f.t * 0.06) * 0.35; f.y += f.vy;
      if (f.y > gi(f.x) - 1) { f.y = gi(f.x) - 1; f.vx = 0; f.vy = 0; if (!f.land) { f.land = 1; f.t = Math.max(f.t, f.life - 50); } }
    }
  }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t >= fx[i].life || fx[i].x < cx - 60 || fx[i].x > cx + W + 120) fx.splice(i, 1);
};
const LEAFFX = ['#6a9a3a', '#c8a03a', '#b0602a'];
function drawEffects(cx) {
  for (const f of fx) {
    const x = Math.round(f.x - cx), y = Math.round(f.y);
    if (x < -12 || x > W + 12) continue;
    const a = 1 - f.t / f.life;
    if (f.k === 'drop') { ctx.fillStyle = f.c; ctx.fillRect(x, y, 1, f.vy < 0 ? 2 : 1); }
    else if (f.k === 'ring') {
      const r = f.r + Math.floor(f.t / 4);
      ctx.globalAlpha = a; ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - r - 1, y, 2, 1); ctx.fillRect(x + r, y, 2, 1);
      ctx.fillStyle = '#dff8f4'; ctx.fillRect(x - r + 1, y - 1, Math.max(1, r * 2 - 1), 1); ctx.fillRect(x - r + 1, y + 1, Math.max(1, r * 2 - 1), 1);
      ctx.globalAlpha = 1;
    } else if (f.k === 'steam') {
      ctx.globalAlpha = (f.soft ? 0.42 : f.smoke ? 0.3 : 0.5) * a * Math.min(1, f.t / 8);
      ctx.fillStyle = f.smoke ? '#6a5560' : '#f4f6f8'; pdisc(x, y, f.r);
      if (!f.smoke && f.r > 2.5) { ctx.fillStyle = '#ffffff'; pdisc(x - 1, y - 1, f.r * 0.5); }
      ctx.globalAlpha = 1;
    } else if (f.k === 'ember') {
      ctx.fillStyle = a > 0.6 ? '#fff1a0' : a > 0.3 ? '#ffa52a' : '#c8401a'; ctx.fillRect(x, y, 1, 1);
    } else if (f.k === 'leaf') {
      const fr0 = Math.floor(f.ph * 3 + f.t * 0.12) % 4;
      ctx.globalAlpha = Math.min(1, (f.life - f.t) / 30); ctx.fillStyle = LEAFFX[f.c];
      if (fr0 % 2) ctx.fillRect(x - 1, y, 3, 1); else { ctx.fillRect(x, y - 1, 1, 2); ctx.fillRect(x + 1, y, 1, 1); }
      ctx.globalAlpha = 1;
    } else if (f.k === 'ash') {
      ctx.globalAlpha = Math.min(1, (f.life - f.t) / 30) * 0.8; ctx.fillStyle = (f.t >> 3) % 3 ? '#8a7e84' : '#ff8a3a'; ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = 1;
    }
  }
}

}
