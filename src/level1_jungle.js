'use strict';
// ============================================================
// Mission 1 scenery, AREA 1: THE JUNGLE (world x 0..1620). L1ART.jungle = { x0, x1, steps, bg, behind, ground, plat,
// front } for level1_art.js (contract: tools/polish/build-contract.md). A bright morning rainforest round an old
// temple, painted the Mission 2 / Mission 3 way: static art painted pixel by pixel into buffers and baked once (in
// `steps`), parallax strips behind the world, 1px OUT outlines on the things you can stand on (decor gets a softer
// outline), small live touches driven by G.t.
//  bg(g, cx)   morning sky in dithered bands, the sun (it climbs as the hero walks east, toward the camp's midday),
//              clouds, a far flock and two macaws, misty hills with a far step pyramid (p 0.05), a pale far canopy
//              (0.12), a sunlit mid canopy in rows of crowns (0.25), the understory: trees, banana plants, temple
//              ruins in the haze (0.42), light shafts, and the tall trees (0.6): giants with buttress roots, strangler
//              figs, side branches, dark crowns and hanging vines, slender trees between them, toucans.
//              Toward the east every layer thins out into the camp's clearing: lower canopy, the last trees, stumps.
//  behind(cx)  the area's decor: the mossy stone head, two ruined pillars, palms (swaying), bushes, ferns; butterflies.
//  ground(cx)  a grassy lip with flowers over layered earth with stones and roots; the turf wears thin toward 1620.
//  plat(pl)    'rock' = a mossy carved temple block, 'log' = a fallen trunk on two stumps (top edge exactly pl.y).
//  front(cx)   dark foreground plants along the bottom edge, pollen drifting in the light.
// Never calls Math.random / rand: textures come from a private mulberry32 table (nz), motion from G.t and hsh.
// No canvases are made per frame: everything is baked by the steps.
// ============================================================
var L1ART = L1ART || {};
{
const AX0 = 0, AX1 = 1620;            // the jungle's grass ground
const CAM1 = 1510;                    // bg is asked for cameras 0..CAM1 (the sky crossfades into the camp from 1210 on)

// ------------------------------------------------------------ helpers: easing, noise, colours
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
// stable noise 0..1 per integer point, smooth value noise and fbm on top of it
const NZT = (() => { const r = rng(110171), a = new Float32Array(65536); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
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
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
const P = (...s) => s.map(I);
const OUTI = I(OUT);
function mixI(a, b, k) {
  k = clamp(k, 0, 1);
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  return Math.round(ar + ((b >> 16 & 255) - ar) * k) << 16 | Math.round(ag + ((b >> 8 & 255) - ag) * k) << 8 | Math.round(ab + ((b & 255) - ab) * k);
}
// pick from a palette by t in 0..1 with ordered dithering between neighbours
function ramp(pal, t, x, y) { const f = clamp(t, 0, 1) * (pal.length - 1), i = Math.floor(f); return pal[Math.min(pal.length - 1, i + (f - i > bay(x, y) ? 1 : 0))]; }
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ------------------------------------------------------------ pixel buffers: 0xRRGGBB ints, NONE = empty.
// A point (x, y) lands on buffer pixel (x - x0, y - y0).
function buf(x0, y0, w, h) { w = Math.ceil(w); h = Math.ceil(h); const d = new Int32Array(w * h); d.fill(NONE); return { x0, y0, w, h, d }; }
function put(b, x, y, c) { x = Math.floor(x) - b.x0; y = Math.floor(y) - b.y0; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) - b.x0; y = Math.floor(y) - b.y0; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) {
  x = Math.round(x) - b.x0; y = Math.round(y) - b.y0; w = Math.round(w); h = Math.round(h);
  const xa = Math.max(0, x), ya = Math.max(0, y), xb = Math.min(b.w, x + w), yb = Math.min(b.h, y + h);
  if (xb <= xa) return;
  for (let r = ya; r < yb; r++) b.d.fill(c, r * b.w + xa, r * b.w + xb);
}
function oval(b, cx, cy, rx, ry, c) {
  const RX = rx + 0.5, RY = ry + 0.5, X = Math.round(cx), Y = Math.round(cy);
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++)
    if (i * i / (RX * RX) + j * j / (RY * RY) <= 1) put(b, X + i, Y + j, c);
}
const disc = (b, cx, cy, r, c) => oval(b, cx, cy, r, r, c);
function line(b, x0, y0, x1, y1, c, t = 1) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)), h = (t - 1) / 2;
  for (let i = 0; i <= n; i++) rect(b, Math.round(x0 + (x1 - x0) * i / n - h), Math.round(y0 + (y1 - y0) * i / n - h), t, t, c);
}
function path(b, pts, c, t = 1) { for (let i = 0; i + 1 < pts.length; i++) line(b, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, t); }
function bez(p, n = 24) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    o.push([u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0], u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]]);
  }
  return o;
}
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
// mix every painted pixel toward colour c by k(y) (the haze deepens toward the ground): row by row
function hazeRows(b, c, k) {
  const d = b.d, w = b.w;
  for (let r = 0; r < b.h; r++) {
    const m = k(r + b.y0);
    if (!(m > 0)) continue;
    let lv = NONE, lr = NONE;
    for (let i = r * w, e = i + w; i < e; i++) {
      const v = d[i];
      if (v === NONE) continue;
      if (v !== lv) { lv = v; lr = mixI(v, c, m); }
      d[i] = lr;
    }
  }
}
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
// a sprite drawn with its local origin at (x, y)
function mk(b) { return { img: bake(b), x0: b.x0, y0: b.y0, w: b.w, h: b.h }; }
function blitS(s, x, y, g = ctx) { g.drawImage(s.img, Math.round(x) + s.x0, Math.round(y) + s.y0); }
// wind sway: horizontal slices, the top moves `amt` px and the bottom row stays
function swayBlit(s, x, y, amt, rows) {
  const X = Math.round(x) + s.x0, Y = Math.round(y) + s.y0;
  let y0 = 0, off = null;
  for (let sy = 0; sy < s.h; sy += rows) {
    const sh = Math.min(rows, s.h - sy), k = 1 - (sy + sh / 2) / s.h, o = Math.round(amt * k * k);
    if (off !== null && o !== off) { ctx.drawImage(s.img, 0, y0, s.w, sy - y0, X + off, Y + y0, s.w, sy - y0); y0 = sy; }
    off = o;
  }
  if (off !== null) ctx.drawImage(s.img, 0, y0, s.w, s.h - y0, X + off, Y + y0, s.w, s.h - y0);
}
const sway = (ph, amp) => amp * (0.55 * Math.sin(G.t * 0.03 + ph) + 0.25 * Math.sin(G.t * 0.071 + ph * 1.7) + 0.2);

// ------------------------------------------------------------ palettes (light .. dark)
const MIST = I('#dcefc4');                                                    // the warm green morning haze
const HA = P('#bcdde8', '#a9d0de', '#96c2d6');                                // the farthest ridge
const HB = P('#bfe2c8', '#9ccdb8', '#86bca8', '#72ab98');                     // the nearer jungle hills
const FC = P('#c6ead0', '#a6d8c0', '#8cc8b2', '#78b8a6');                     // far canopy band
const MC = P('#c0ea78', '#84cc68', '#56ae6a', '#3e9468');                     // mid canopy band (sunlit)
const NR = P('#b4e65c', '#74c44a', '#479e4a', '#2f7e4c');                     // near understory crowns
const NT = P('#a8ba8e', '#869c74', '#6a8260', '#546a4e');                     // near trunks (hazy olive)
const GC = P('#6eaa46', '#48843a', '#2f6432', '#1e4828');                     // the giants' crowns (dark ceiling)
const LIT = P('#e2f690', '#b8e466', '#86c44c');                               // backlit leaves
const GB = P('#a8a074', '#827e5a', '#636448', '#494e3a', '#32382c');          // the giants' bark
const GM = P('#86b450', '#5f8e40');                                           // moss on bark
const LEAF = P('#b8ec5e', '#76c446', '#449a3e', '#2a7240', '#1a4e34');        // world-plane plants
const FERN = P('#b4f29a', '#62cc78', '#2f9e60', '#1f7652', '#12503e');           // ferns: a cooler emerald than the bushes
const PALM_LEAF = P('#d6f07c', '#9ad458', '#62b046', '#3c863a', '#27602e');
const PALM_TRUNK = P('#e0bc8c', '#b8905e', '#8c6a42', '#62482e');
const MOSS = P('#d6f26c', '#a0da4c', '#6cb23c', '#468830', '#2e6426');
const GRASS = P('#c8f06c', '#90d84c', '#5eba3e', '#3c9438', '#2a7030');
const EARTH = P('#a26c40', '#8a5834', '#72462a', '#5c3822', '#462b1b', '#332015');
const STN = P('#e6dcba', '#c8bd9a', '#a89f80', '#888168', '#686350', '#4a463a');   // warm temple limestone
const BARK = P('#c09a6c', '#9a7650', '#77583c', '#58402c', '#3c2c20');        // fallen logs and stumps
const PLO = I('#1e3a24'), STO = I('#45423a');                                 // soft outlines for decor plants / stone

// ============================================================
// Plant painters (the Mission 3 house style; lx = the sunlit side, the morning sun is on the right)
// ============================================================
// a mass of leaves: clumps sorted top to bottom, each a deep rim, dark, mid and a lit top; leaf strokes; leaf tips
function foliage(b, cx, cy, rx, ry, pal, s, rmin = 2.5, rmax = 5.5, tips = true) {
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
    oval(b, x + r * 0.25, y - r * 0.45, Math.max(0.5, r * 0.4), Math.max(0.5, r * 0.26), pal[0]);
  }
  const x0 = Math.floor(cx - rx - 2), x1 = Math.ceil(cx + rx + 2), y0 = Math.floor(cy - ry - 2), y1 = Math.ceil(cy + ry + 2);
  for (let i = 0, n2 = (x1 - x0) * (y1 - y0) / 4; i < n2; i++) {
    const x = x0 + Math.floor(nz(i, s + 5) * (x1 - x0)), y = y0 + Math.floor(nz(i, s + 6) * (y1 - y0)), k = pal.indexOf(get(b, x, y));
    if (k < 0 || k > 3) continue;
    const up = nz(i, s + 7) < (k >= 2 ? 0.35 : 0.6), nc = pal[clamp(k + (up ? -1 : 1), 0, 3)], dx = nz(i, s + 8) < 0.5 ? 1 : -1;
    for (let j = 0; j < 2 + (nz(i, s + 9) * 2 | 0); j++) { const q = pal.indexOf(get(b, x + dx * j, y + j)); if (q >= 0 && q <= 3) put(b, x + dx * j, y + j, nc); }
  }
  if (!tips) return;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = get(b, x, y), k = pal.indexOf(c);
    if (k < 0 || k > 3) continue;
    const q = nz(x * 3 + s, y);
    if (q > 0.84 && get(b, x, y + 1) === NONE) { put(b, x, y + 1, pal[2]); if (q > 0.92) put(b, x + (x & 1 ? 1 : -1), y + 2, pal[3]); }
    else if (q < 0.08 && get(b, x - 1, y) === NONE) put(b, x - 1, y, c);
    else if (q > 0.8 && get(b, x + 1, y) === NONE) put(b, x + 1, y, c);
  }
}
// a palm frond seen against the light: a drooping rachis with leaflets hanging from both sides
function jfrond(b, x0, y0, a, len, droop, pal) {
  for (let i = 0; i <= len; i++) {
    const t = i / len, x = x0 + Math.cos(a) * i, y = y0 + Math.sin(a) * i + droop * t * t * len;
    const dx = Math.cos(a), dy = Math.sin(a) + 2 * droop * t, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
    if (i > 1 && i % 2 === 0) {
      const ll = (1 - t * 0.55) * len * 0.2 + 2;
      for (const sd of [-1, 1]) {
        const lx = ux * 0.55 - uy * sd * 0.85, ly = uy * 0.55 + ux * sd * 0.85;
        for (let k = 1; k <= ll; k++) put(b, x + lx * k, y + ly * k + k * k * 0.035, k < ll * 0.35 ? pal[2] : k < ll * 0.8 ? pal[1] : pal[0]);
      }
    }
    put(b, x, y, pal[3]); put(b, x, y - 1, pal[2]);
  }
}
// a background trunk: lit on the sun side, bark streaks, a flared foot
function trunkCol(b, x, w, y0, y1, pal, s, flareH = 26) {
  for (let y = y0; y < y1; y++) {
    const fl = flareH > 0 ? ss(y1 - flareH, y1, y) : 0, ww = Math.round(w + fl * fl * w * 1.5), xl = Math.round(x - ww / 2 + Math.sin(y / 19 + s) * 0.8);
    for (let i = 0; i < ww; i++) {
      const u = 1 - (i + 0.5) / ww;      // 0 = the sunlit (right) edge
      let c = u < 0.24 ? pal[0] : u > 0.7 ? pal[2] : pal[1];
      if (ww > 4 && (i + Math.floor(y / 9 + nz(i, s) * 3)) % 4 === 0 && nz(xl + i, y >> 2) > 0.45 && u > 0.15) c = pal[3];
      put(b, xl + i, y, c);
    }
  }
}
// a big leaf along a drooping midrib: rounded base, pointed tip, the upper half lit, side veins, monstera splits
function bigLeaf(b, x0, y0, a, len, wid, droop, pal, s, splits) {
  const n = Math.ceil(len * 2.2);
  for (let i = 0; i <= n; i++) {
    const t = i / n, cx = x0 + Math.cos(a) * len * t, cy = y0 + Math.sin(a) * len * t + droop * t * t * len;
    const dx = Math.cos(a), dy = Math.sin(a) + 2 * droop * t, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
    const hw = wid * Math.pow(Math.sin(Math.PI * Math.min(1, 0.14 + t * 0.86)), 0.7), Lp = t * len;
    for (let o = -hw; o <= hw; o += 0.5) {
      const ao = Math.abs(o);
      if (splits) {
        const k = Math.round(Lp / 4.2), dl = Math.abs(Lp - k * 4.2);
        if (dl < 0.55 && ao > hw * 0.38 && t > 0.12 && t < 0.92) continue;
        if (Math.abs(dl - 2.1) < 0.8 && ao > hw * 0.2 && ao < hw * 0.32 && nz(k, s + (o < 0 ? 1 : 0)) > 0.4) continue;
      }
      const up = o * ny < 0, vein = Math.abs(((Lp + ao * 0.7) % 4.2) - 2.1) < 0.35 && ao > 1;
      let c = ao < 0.6 ? pal[0] : up ? pal[1] : pal[2];
      if (vein) c = up ? pal[0] : pal[1];
      if (ao > hw - 0.7) c = up ? pal[2] : pal[3];
      put(b, cx + nx * o, cy + ny * o, c);
    }
  }
}
// a banana-like paddle leaf with torn slits
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
// a lush fern: feather-shaped fronds (a rib with comb leaflets) fanning out from the base, the outer ones drooping
function frondLeaf(b, x0, y0, a, len, droop, wid, pal) {
  const n = Math.ceil(len * 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n, cx = x0 + Math.cos(a) * len * t, cy = y0 + Math.sin(a) * len * t + droop * t * t * len;
    const dx = Math.cos(a), dy = Math.sin(a) + 2 * droop * t, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
    const hw = wid * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.92)), 0.8), comb = Math.floor(t * len) % 2 === 0;
    for (let o = -hw; o <= hw; o += 0.5) {
      const ao = Math.abs(o);
      if (ao > 0.6 && !comb) continue;
      const up = o * ny < 0;
      put(b, cx + nx * o, cy + ny * o, ao < 0.6 ? pal[1] : up ? (ao > hw - 0.8 ? pal[0] : pal[1]) : (ao > hw - 0.8 ? pal[3] : pal[2]));
    }
  }
}
function bigFern(b, x, base, s, pal, seed = 0) {
  for (const k of [-3, 3, -2, 2, -1, 1, 0]) {
    const a = -Math.PI / 2 + k * 0.31 + (nz(k + 9, seed) - 0.5) * 0.14, len = s * (1 - Math.abs(k) * 0.06) * (0.9 + 0.2 * nz(k + 9, seed + 1));
    frondLeaf(b, x, base, a, len, 0.08 + Math.abs(k) * 0.085, Math.max(1.6, s * 0.15), Math.abs(k) > 1 ? [pal[1], pal[2], pal[3], pal[4] || pal[3]] : pal);
  }
}
// a small far palm silhouette
function jpalm(b, x, base, h, lean, pal, s) {
  for (let i = 0; i <= h; i++) {
    const t = i / h, px = x + lean * t * t, py = base - i;
    put(b, px, py, pal[2]); put(b, px + 1, py, i % 3 ? pal[1] : pal[3]);
  }
  const cx = x + lean, cy = base - h, n = 8;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI * (0.02 + 0.96 * k / (n - 1)) + (nz(k, s) - 0.5) * 0.25, Lf = h * (0.36 + 0.14 * nz(k, s + 1));
    for (let i = 1; i <= Lf; i++) {
      const t = i / Lf, fx = cx + Math.cos(a) * i * (1 - t * 0.15), fy = cy + Math.sin(a) * i * 0.8 + t * t * Lf * 0.75;
      put(b, fx, fy, t < 0.5 ? pal[1] : pal[2]);
      if (t < 0.4) put(b, fx, fy - 1, pal[0]);
      if (i > 2 && i % 2 === 0) put(b, fx, fy + 1 + (t > 0.5 ? 1 : 0), pal[2]);
    }
  }
  oval(b, cx + 0.5, cy + 1.5, 1.2, 1, pal[3]);
}
// a hanging vine with leaves on alternate sides (and little blossoms when fl is a palette)
function vine(b, x, y0, len, s, c, lf, fl) {
  for (let y = y0; y < y0 + len; y++) {
    const k = y - y0, vx = x + Math.round(Math.sin(k / 14 + s) * (1.5 + k * 0.01));
    put(b, vx, y, c);
    if (k % 7 === 3) { put(b, vx + 1, y, lf[0]); put(b, vx + 2, y + 1, lf[1]); }
    if (k % 7 === 0 && k) { put(b, vx - 1, y, lf[0]); put(b, vx - 2, y + 1, lf[1]); }
    if (fl && k % 11 === 6 && k > 8) { const fx = vx + (k % 2 ? 2 : -2); put(b, fx - 1, y, fl[0]); put(b, fx + 1, y, fl[1]); put(b, fx, y - 1, fl[0]); put(b, fx, y + 1, fl[1]); put(b, fx, y, fl[2] || fl[0]); }
  }
  put(b, x + Math.round(Math.sin((len - 1) / 14 + s) * 2), y0 + len, lf[0]);
}

// ============================================================
// Backdrop strips. A strip is painted in design coordinates = screen coordinates at camera 0 (x from -10) and is
// wide enough for its parallax p over the cameras 0..CAM1 (or `wmax`, when its east end is empty anyway). Its
// buffer lives until the strip's last step bakes it.
// ============================================================
function newStrip(p, top, bot, wmax) {
  const w = Math.min(wmax || 1e9, W + 22 + Math.ceil(CAM1 * p));
  return { p, top, h: bot - top, w, X1: w - 10, b: buf(-10, top, w, bot - top), c: null };
}
function bakeStrip(S) { S.c = bake(S.b); S.b = null; }
const offOf = (S, cx) => Math.max(0, Math.round(cx * S.p));
function blitStrip(g, S, cx) {
  const off = offOf(S, cx), sw = Math.min(W + 20, S.w - off);
  if (sw > 0) g.drawImage(S.c, off, 0, sw, S.h, -10, S.top, sw, S.h);
}
// The jungle thins into the camp's clearing toward the east. Per strip (design x): 0 = deep jungle, 1 = open.
// The far layers open up first, as a clearing seen from a distance does.
const thinFar = x => ss(520, 640, x), thinMid = x => ss(610, 790, x), thinNear = x => ss(800, 980, x);

// ------------------------------------------------------------ the morning sky: dithered bands; the sun and its glow move
const SKY = [[-10, '#2f7ed2'], [24, '#4794de'], [54, '#6fb3ea'], [82, '#9bd0f0'], [106, '#c6e7ee'], [128, '#e6f4dc'], [156, '#f6f4cc'], [180, '#f8f2c4']];
function skyAt(y) {
  let i = 0;
  while (i + 1 < SKY.length && SKY[i + 1][0] <= y) i++;
  const a = SKY[i], c = SKY[Math.min(i + 1, SKY.length - 1)];
  return mixI(I(a[1]), I(c[1]), c[0] > a[0] ? (y - a[0]) / (c[0] - a[0]) : 0);
}
function paintSky() {
  const b = buf(-10, -10, W + 20, H + 20), N = 30, pal = [];
  for (let i = 0; i < N; i++) pal.push(skyAt(-10 + i / (N - 1) * 190));
  for (let y = -10; y < H + 10; y++) {
    const c4 = [0, 1, 2, 3].map(x => ramp(pal, (y + 10) / 190, x, y & 3)), row = (y + 10) * b.w;
    for (let i = 0; i < b.w; i++) b.d[row + i] = c4[(i - 10) & 3];
  }
  return bake(b);
}
// the wide warm glow round the sun (baked into the sky by the first step)
const GLOW = { rx: 228, ry: 171, x: 368, y: 62 };
function glowCanvas() {
  const w = GLOW.rx * 2, h = GLOW.ry * 2, c = canvasOf(w, h), g = c.getContext('2d');
  g.translate(GLOW.rx, GLOW.ry); g.scale(1 / 0.75, 1);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 170);
  for (let i = 0; i <= 8; i++) { const q = 1 - i / 8; gr.addColorStop(i / 8, 'rgba(255,246,210,' + (q * q * 0.62).toFixed(3) + ')'); }
  g.fillStyle = gr; g.fillRect(-GLOW.rx, -GLOW.ry, w, h);
  return c;
}
// The morning sun: low in the gap between the trees at the start, climbing toward the camp's midday as the hero
// walks east. From camera 1150 on it is exactly where level1_camp.js draws its sun (x = 404 - 0.015 cx, y = 54 +
// 20 * clamp((cx - 1300) / 1700)), so the two suns are one while the skies crossfade (cameras 1210..1510).
let SX = 352, SY = 70;
function sunAt(cx) {
  const t = ss(0, 1150, cx);
  SX = Math.round(lerp(352, 404 - cx * 0.015, t)); SY = Math.round(lerp(70, 54 + clamp((cx - 1300) / 1700, 0, 1) * 20, t));
}
function sunCanvas() {
  const R0 = 72, c = canvasOf(R0 * 2, R0 * 2), g = c.getContext('2d');
  const gr = g.createRadialGradient(R0, R0, 3, R0, R0, R0);
  gr.addColorStop(0, 'rgba(255,252,232,0.95)'); gr.addColorStop(0.16, 'rgba(255,244,200,0.5)'); gr.addColorStop(0.45, 'rgba(255,236,176,0.16)'); gr.addColorStop(1, 'rgba(255,230,160,0)');
  g.fillStyle = gr; g.fillRect(0, 0, R0 * 2, R0 * 2);
  return c;
}
function sunDisc() {
  const b = buf(-12, -12, 24, 24);
  disc(b, 0, 0, 11, I('#ffe9a0')); disc(b, 0, 0, 10, I('#fff4cc')); disc(b, 1, -1, 8, I('#fffbe8')); disc(b, 2, -2, 4, I('#ffffff'));
  return bake(b);
}
// the sun's bloom over the hills and the far canopy (the near trees stand dark against it)
function bloomCanvas() {
  const R0 = 170, c = canvasOf(R0 * 2, R0 * 2), g = c.getContext('2d'), gr = g.createRadialGradient(R0, R0, 0, R0, R0, R0);
  gr.addColorStop(0, 'rgba(255,246,200,0.5)'); gr.addColorStop(0.28, 'rgba(255,242,190,0.24)'); gr.addColorStop(0.62, 'rgba(255,238,180,0.08)'); gr.addColorStop(1, 'rgba(255,236,176,0)');
  g.fillStyle = gr; g.fillRect(0, 0, R0 * 2, R0 * 2);
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
  for (let j = -12; j <= 12; j++) { const hw = Math.floor(Math.sqrt(12.5 * 12.5 - j * j)); g.fillRect(R0 - hw, R0 + j, hw * 2 + 1, 1); }
  g.globalCompositeOperation = 'source-over';
  return c;
}
// soft rays fanning down and left from the low morning sun (two sets, crossfaded so they shimmer)
function rayCanvas(s) {
  const w = 520, h = 300, c = canvasOf(w, h), g = c.getContext('2d'), ox = 420, oy = 70;
  for (let i = 0; i < 11; i++) {
    const a = 1.5 + (i + hsh(i * 3 + s) * 0.7) / 11 * 2.1, len = 200 + hsh(i * 7 + s) * 220, wd = 0.018 + hsh(i * 5 + s) * 0.03;
    const gr = g.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
    gr.addColorStop(0, 'rgba(255,244,204,0.2)'); gr.addColorStop(1, 'rgba(255,244,204,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(ox, oy);
    g.lineTo(ox + Math.cos(a - wd) * len, oy + Math.sin(a - wd) * len); g.lineTo(ox + Math.cos(a + wd) * len, oy + Math.sin(a + wd) * len);
    g.closePath(); g.fill();
  }
  return c;
}
// cumulus lit from the right, cool undersides (pal: underside, body, light)
function cloudCanvas(w, s, pal, lx) {
  const h = Math.round(w * 0.5) + 6, base = h - 3, b = buf(-5, 0, w + 10, h), puffs = [];
  const n = 3 + Math.floor(w / 20), m = 1 + Math.floor(w / 46);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, r = w * (0.08 + 0.1 * Math.sin(t * Math.PI)) * (0.8 + 0.45 * hsh(s * 7 + i)); puffs.push([t * w, base - r * 0.6, r]); }
  for (let i = 0; i < m; i++) { const t = 0.32 + 0.36 * (m === 1 ? 0.5 : i / (m - 1)) + (hsh(s * 3 + i) - 0.5) * 0.14, r = w * (0.15 + 0.06 * hsh(s * 11 + i)); puffs.push([t * w, base - r * 0.55 - w * 0.12, r]); }
  const [C0, C1, C2] = pal;
  const lay = (dx, dy, dr, c, cut) => {
    for (const [x, y, r] of puffs) {
      const R2 = r + dr;
      if (R2 <= 0) continue;
      for (let yy = -Math.floor(R2); yy <= R2; yy++) {
        const Y = Math.round(y + dy + yy);
        if (Y > base - cut) break;
        const hw = Math.floor(Math.sqrt((R2 + 0.5) ** 2 - yy * yy));
        for (let X = Math.round(x + dx) - hw; X <= Math.round(x + dx) + hw; X++) put(b, X, Y, c);
      }
    }
  };
  lay(0, 0, 0, C0, 0);
  lay(0.5 * lx, -2, -0.8, C1, 3);
  for (const [x, y, r] of puffs) {
    const hr = r * 0.55, hx = x + lx * r * 0.28, hy = y - r * 0.38;
    for (let yy = -Math.floor(hr); yy <= hr; yy++) {
      const hw = Math.floor(Math.sqrt((hr + 0.5) ** 2 - yy * yy));
      for (let X = Math.round(hx) - hw; X <= Math.round(hx) + hw; X++) if (get(b, X, Math.round(hy + yy)) === C1) put(b, X, Math.round(hy + yy), C2);
    }
  }
  for (let X = -5; X < w + 5; X++) if (get(b, X, base) === C0 && hsh(X * 1.7 + s) > 0.5) put(b, X, base + 1, C0);
  return bake(b);
}
// clouds: [width, x, y, parallax, drift]; they wrap round a span wider than the screen
const CLOUDS = [[70, 362, 104, 0.04, 0.012], [46, 196, 98, 0.03, 0.009], [40, 592, 106, 0.05, 0.014], [34, 730, 100, 0.035, 0.008], [62, 60, 100, 0.045, 0.011]];
const CLOUD_PAL = P('#b8d2ec', '#eef5fb', '#ffffff');

// ------------------------------------------------------------ misty jungle hills with a far step pyramid (p 0.05)
const memo = f => { const m = new Map(); return x => { let v = m.get(x); if (v === undefined) m.set(x, v = f(x)); return v; }; };
const ridgeA = memo(x => 104 - 24 * fbm(x / 110, 0, 5) - 9 * Math.max(0, Math.sin(x / 140 + 0.6)));
const ridgeB = memo(x => 119 - 16 * fbm(x / 70, 0, 9) - 5 * Math.sin(x / 95 + 2));
const PYR_X = 330;
function pyramid(b, cx, base) {
  const S0 = I('#f6eecc'), S1 = I('#dcd6b4'), S2 = I('#b2baa6'), S3 = I('#8ea292'), tiers = 5, th = 5, w0 = 58;
  for (let k = 0; k < tiers; k++) {
    const w = w0 - k * 10, y = base - (k + 1) * th, x0 = Math.round(cx - w / 2);
    rect(b, x0, y, w, th, S2);                               // the shaded left of each tier
    rect(b, cx, y, w - (cx - x0), th, S1);                    // the sunlit right
    rect(b, x0, y, w, 1, S0);                                 // the tread catching the light
    rect(b, x0, y + th - 1, w, 1, S3);
    for (let x = x0 + 2; x < x0 + w - 1; x += 4) if (nz(x, k + 300) > 0.45) put(b, x, y + 2, S3);
  }
  const top = base - tiers * th;
  rect(b, cx - 3, top, 7, tiers * th, S0);                    // the stair
  for (let y = top + 1; y < base; y += 2) rect(b, cx - 3, y, 7, 1, S2);
  rect(b, cx - 4, top, 1, tiers * th, S3); rect(b, cx + 4, top, 1, tiers * th, S3);
  rect(b, cx - 7, top - 7, 15, 7, S1); rect(b, cx - 7, top - 7, 5, 7, S2); rect(b, cx - 8, top - 8, 17, 2, S0);   // the shrine
  rect(b, cx - 4, top - 11, 9, 3, S1); rect(b, cx - 2, top - 13, 5, 2, S0);                                       // its roof comb
  rect(b, cx - 1, top - 5, 3, 5, S3);
  // the jungle taking it back: clumps on the tier corners
  for (let k = 0; k < tiers; k++) {
    const w = w0 - k * 10, y = base - k * th;
    for (const sd of [-1, 1]) if (nz(k, sd + 310) > 0.3) { const x = cx + sd * (w / 2 - 1 - nz(k, sd + 311) * 5); oval(b, x, y - 1, 2.5 + nz(k, sd + 312) * 2, 1.8, HB[2]); oval(b, x + 0.5, y - 2, 1.5, 1, HB[0]); }
  }
}
function paintHills(b, X1) {
  for (let x = -10; x < X1; x++) {
    const y = Math.round(ridgeA(x)), lit = ridgeA(x + 2) > ridgeA(x - 2) + 0.3;
    rect(b, x, y, 1, H - y, HA[1]);
    rect(b, x, y, 1, lit ? 2 : 1, lit ? HA[0] : HA[1]);
    if (!lit && nz(x >> 1, 401) > 0.5) put(b, x, y + 2 + (nz(x >> 1, 402) * 5 | 0), HA[2]);
  }
  for (let x = -12; x < X1 + 4; x += 3) { const r = 1.5 + nz(x + 9000, 404) * 2.2, y = ridgeA(x) + 1; oval(b, x, y, r, r * 0.8, HA[1]); put(b, x + 1, Math.round(y - r * 0.8), HA[0]); }
  pyramid(b, PYR_X, Math.round(ridgeB(PYR_X)) + 3);
}
// the nearer hills in front of the pyramid, their crowns, the haze
function paintHillsNear(b, X1) {
  for (let x = -10; x < X1; x++) { const y = Math.round(ridgeB(x)); rect(b, x, y, 1, H - y, HB[1]); }
  for (let x = -12; x < X1 + 4; x += 3) {
    const r = 2 + nz(x + 9000, 405) * 3, y = ridgeB(x) + 1.5;
    if (Math.abs(x - PYR_X) < 34) continue;                    // the pyramid's forecourt stays clear
    oval(b, x, y, r, r * 0.8, HB[1]); oval(b, x + 0.6, y - 1, Math.max(0.5, r - 1.4), Math.max(0.5, r * 0.8 - 1.2), HB[0]);
  }
  // crown texture on the slopes: little lit caps with a shaded foot
  for (let i = 0, n = (X1 + 10) * 0.9; i < n; i++) {
    const x = -10 + Math.floor(nz(i, 406) * (X1 + 10)), y = Math.round(ridgeB(x)) + 4 + Math.floor(Math.pow(nz(i, 407), 1.3) * 34);
    if (Math.abs(x - PYR_X) < 30 && y < ridgeB(PYR_X) + 8) continue;
    put(b, x, y, HB[0]); put(b, x + 1, y, HB[0]); put(b, x - 1, y + 1, HB[2]); put(b, x, y + 1, HB[2]); put(b, x + 1, y + 1, HB[3]);
  }
  hazeRows(b, MIST, y => ss(106, 152, y) * 0.5);
}

// ------------------------------------------------------------ the far canopy (p 0.12): a pale band of crowns, emergent trees, palms
const farBase = x => 124 + 9 * fbm(x / 26, 0.5, 21) + 3 * Math.sin(x / 31 + 1);
const farTop = x => farBase(x) + 13 * thinFar(x);
function paintFar(b, X1) {
  for (let x = -16; x < X1 + 8; x += 4) { const r = 3 + nz(x + 4096, 3) * 8, y = farTop(x) + r * 0.6; oval(b, x, y, r + 1, r * 0.85, FC[2]); }
  for (let x = -10; x < X1; x++) rect(b, x, Math.round(farTop(x)) + 5, 1, H, FC[2]);
  for (let x = -16; x < X1 + 8; x += 4) { const r = 3 + nz(x + 4096, 3) * 8, y = farTop(x) + r * 0.6; if (r > 4) oval(b, x + 1, y - 2, r - 2.5, r * 0.85 - 3, FC[1]); if (r > 7) oval(b, x + 2, y - 3, r - 5, 1.2, FC[0]); }
  // emergent giants with umbrella crowns (none over the clearing)
  for (let x = 44, i = 0; x < X1 + 20; x += 96 + Math.round(nz(i, 77) * 100), i++) {
    if (thinFar(x) > 0.55) continue;
    const h = 20 + nz(i, 78) * 16, w = 16 + nz(i, 79) * 10, top = farTop(x) - h;
    rect(b, x, top + 3, 2, h, FC[3]);
    for (let k = -2; k <= 2; k++) oval(b, x + k * w * 0.22, top + Math.abs(k) * 1.5, w * 0.3, 3.2, FC[2]);
    for (let k = -2; k <= 2; k++) oval(b, x + k * w * 0.22 + 1, top - 1 + Math.abs(k) * 1.5, w * 0.22, 1.6, FC[1]);
    put(b, x + w * 0.3, top - 2, FC[0]); put(b, x + w * 0.3 + 1, top - 2, FC[0]);
  }
  for (let x = 84, i = 0; x < X1 + 10; x += 40 + Math.round(nz(i, 80) * 80), i++) jpalm(b, x, farTop(x) + 4, 17 + nz(i, 81) * 12, (nz(i, 82) - 0.5) * 12, [FC[0], FC[2], FC[3], FC[3]], x);
}
// two more rows of crowns further down the slope, so the band behind the playfield isn't flat; then the haze
function paintFarRows(b, X1) {
  for (const [dy, sd, a, bb] of [[20, 31, 2, 3], [40, 37, 2, 3]]) {
    for (let x = -14; x < X1 + 10; x += 5) {
      const r = 3.5 + nz(x + 4096, sd) * 6, y = farBase(x * 1.3 + sd) + 13 * thinFar(x) + dy + nz(x + 4096, sd + 1) * 8;
      oval(b, x, y + 1, r + 1, r * 0.8, FC[bb]); oval(b, x, y, r, r * 0.75, FC[a]); oval(b, x + 1, y - 1.5, Math.max(0.5, r - 2.2), Math.max(0.5, r * 0.7 - 2), FC[1]);
    }
  }
}

// ------------------------------------------------------------ the mid canopy (p 0.25): a sunlit row of big round crowns, more
// rows of crowns stepping down behind the playfield. Painted in passes (one bake step each).
const midBase = x => 150 + 11 * fbm(x / 40, 0.5, 51) + 4 * Math.sin(x / 53);
const midTop = x => midBase(x) + 27 * thinMid(x);
// the row's back: taller trees standing out of it (some in blossom), palms leaning over it
function midBack(b, X1) {
  for (let x = -10; x < X1; x++) rect(b, x, Math.round(midTop(x)) + 9, 1, H, MC[2]);
  const BLOOM = [['#ffd27a', '#ff9a3c'], ['#ffc4e2', '#f070a8'], ['#fff6c8', '#ffd84a']];
  for (let x = 70, i = 0; x < X1 + 30; x += 110 + Math.round(nz(i, 131) * 90), i++) {
    if (thinMid(x) > 0.3) continue;
    const cy = midTop(x) - 12 - nz(i, 132) * 8, rx = 17 + nz(i, 133) * 8, ry = 10 + nz(i, 134) * 4;
    rect(b, x - 1, cy, 3, 30, MC[3]); rect(b, x + 1, cy, 1, 30, MC[1]);
    foliage(b, x, cy, rx, ry, MC, x * 5 + 1, 3, 6);
    if (nz(i, 135) > 0.4) {
      const [c0, c1] = BLOOM[i % 3];
      for (let j = 0; j < 40; j++) {
        const px = x + (nz(j, i * 31 + 7) - 0.5) * 2 * rx, py = cy + (nz(j, i * 31 + 8) - 0.7) * 2 * ry, q = MC.indexOf(get(b, px, py));
        if (q < 0 || q > 1) continue;
        put(b, px, py, I(c1)); put(b, px + 1, py, I(c1)); put(b, px, py - 1, I(c0)); if (nz(j, i) > 0.5) put(b, px + 1, py - 1, I(c0));
      }
    }
  }
  for (let x = 20, i = 0; x < X1 + 10; x += 70 + Math.round(nz(i, 136) * 120), i++) jpalm(b, x, midTop(x) + 12, 24 + nz(i, 137) * 12, (nz(i, 138) - 0.5) * 16, [MC[0], MC[2], MC[3], MC[3]], x + 5);
}
// the row's crowns from design x a to b (smaller where the forest thins)
function midCrowns(b, a, e) {
  for (let x = -20 + Math.ceil((a + 20) / 13) * 13; x < e; x += 13) {
    const xx = x + nz(x + 4096, 139) * 6, r = (13 + nz(x + 4096, 140) * 6) * (1 - 0.3 * thinMid(xx));
    foliage(b, xx, midTop(xx) + 9, r, r * 0.62, MC, x * 3 + 11, 3, 6);
  }
}
// one more row of crowns below (row 0..4), each crown lit on top with a shaded foot; banana plants and young palms
const MID_ROWS = [[15, 61, 0], [29, 67, 0.15], [43, 71, 0.35], [57, 73, 0.55], [71, 79, 0.7]];
function midRow(b, X1, row) {
  const [dy, sd, soft] = MID_ROWS[row], RIM = mixI(MC[3], MC[2], soft);
  const top = x => midBase(x * 1.2 + sd * 9) + 27 * thinMid(x);
  for (let x = -16, i = 0; x < X1 + 12; x += 5 + Math.round(nz(i, sd + 6) * 10), i++) {
    const r = 6 + nz(i, sd + 1) * 9, y = top(x) + dy + 9 + (nz(i, sd + 2) - 0.5) * 12;
    oval(b, x, y + 1, r + 1, r * 0.7 + 1, RIM);
    oval(b, x, y, r, r * 0.7, MC[2]);
    oval(b, x + r * 0.15, y - r * 0.22, r * 0.72, r * 0.4, MC[1]);
    if (nz(i, sd + 3) > 0.45) oval(b, x + r * 0.3, y - r * 0.42, r * 0.3, Math.max(0.5, r * 0.14), MC[0]);
    for (let k = 0; k < 3; k++) { const lx = x + (nz(i * 3 + k, sd + 4) - 0.5) * r * 1.6, ly = y + (nz(i * 3 + k, sd + 5) - 0.3) * r * 0.8; if (get(b, lx, ly) === MC[2]) { put(b, lx, ly, RIM); put(b, lx + 1, ly + 1, RIM); } }
  }
  if (row > 0 && row < 4) for (let x = 30 + row * 37, i = 0; x < X1 + 20; x += 120 + Math.round(nz(i, sd + 8) * 150), i++) {
    const base = top(x) + dy + 22, q = nz(i, sd + 9);
    if (q < 0.5) { for (const a of [-2.45, -1.85, -1.2, -0.6]) paddle(b, x, base - 8, a, 13 + nz(i, sd + 10) * 5, 3.2, 0.28, MC, x + a * 7); }
    else jpalm(b, x, base, 16 + nz(i, sd + 11) * 8, (nz(i, sd + 12) - 0.5) * 10, [MC[0], MC[1], RIM, RIM], x + 9);
  }
}

// ------------------------------------------------------------ the understory (p 0.42): trees with forked branches and lianas,
// banana plants, tree ferns, undergrowth along the back of the world, and overgrown temple ruins, pale with
// distance: a gateway, a flight of steps, a row of broken columns. Toward the camp the robots have cleared it: the
// last trees are young ones, then stumps and felled trunks.
// overgrown temple ruins standing in the understory, pale with distance: a gateway and a flight of steps
const RS = STN.map(c => mixI(c, I('#c4dcc0'), 0.4));
function bgGate(b, x, base) {
  for (const px of [x - 20, x + 12]) for (let y = base - 40; y < base; y++) for (let i = 0; i < 9; i++)
    put(b, px + i, y, i === 8 ? RS[1] : i === 0 ? RS[4] : (base - y) % 10 === 0 ? RS[4] : (base - y) % 10 === 9 ? RS[1] : nz(px + i, y) > 0.82 ? RS[3] : RS[2]);
  rect(b, x - 24, base - 49, 49, 9, RS[2]); rect(b, x - 24, base - 49, 49, 1, RS[0]); rect(b, x - 24, base - 41, 49, 1, RS[4]); rect(b, x + 24, base - 49, 1, 9, RS[1]); rect(b, x - 24, base - 48, 1, 8, RS[4]);
  for (let i = -20; i <= 18; i += 6) { rect(b, x + i, base - 46, 3, 3, RS[4]); put(b, x + i + 1, base - 45, RS[1]); }
  rect(b, x - 9, base - 58, 19, 9, RS[2]); rect(b, x - 9, base - 58, 19, 1, RS[0]); rect(b, x - 9, base - 57, 1, 8, RS[4]);
  rect(b, x - 6, base - 55, 4, 3, RS[4]); rect(b, x + 3, base - 55, 4, 3, RS[4]); rect(b, x - 4, base - 51, 9, 1, RS[4]); rect(b, x - 5, base - 61, 11, 3, RS[1]); rect(b, x - 5, base - 61, 11, 1, RS[0]);
  foliage(b, x - 19, base - 52, 8, 4, NR, x + 1, 2, 3.5); foliage(b, x + 18, base - 51, 7, 3.5, NR, x + 2, 2, 3.5);
  for (const [dx, len] of [[-8, 18], [3, 10], [9, 24], [-15, 8]]) vine(b, x + dx, base - 40, len, x + dx, NR[3], [NR[1], NR[2]]);
}
function bgSteps(b, x, base) {
  for (let k = 0; k < 4; k++) {
    const x0 = x - 30 + k * 11, y0 = base - (k + 1) * 9, w = 60 - k * 11;
    rect(b, x0, y0, w, 9, RS[2]); rect(b, x0, y0, w, 1, RS[0]); rect(b, x0, y0 + 1, 1, 8, RS[4]); rect(b, x0 + w - 1, y0, 1, 9, RS[1]);
    for (let i = x0 + 7 + (k % 2) * 4; i < x0 + w - 2; i += 9) rect(b, i, y0 + 2, 1, 7, RS[3]);
    for (let i = x0 + 2; i < x0 + w - 2; i++) if (nz(i, y0 + 900) > 0.9) put(b, i, y0 + 3 + (nz(i, y0 + 901) * 4 | 0), RS[4]);
  }
  for (let y = base - 54; y < base - 36; y++) for (let i = 0; i < 7; i++) put(b, x + 16 + i, y, i === 6 ? RS[1] : i === 0 ? RS[4] : (y % 6 === 0 ? RS[4] : RS[2]));
  rect(b, x + 15, base - 56, 9, 2, RS[1]);
  foliage(b, x - 24, base - 11, 7, 3.5, NR, x + 3, 2, 3.5); foliage(b, x + 2, base - 29, 8, 4, NR, x + 4, 2, 3.5); foliage(b, x + 26, base - 38, 6, 3, NR, x + 5, 2, 3.5);
  vine(b, x + 29, base - 34, 20, x, NR[3], [NR[1], NR[2]]);
}
function bgColumns(b, x, base) {
  [[-27, 34, 1], [-9, 20, 0], [9, 42, 1], [27, 12, 0]].forEach(([dx, h, cap], k) => {
    const px = x + dx - 3;
    for (let y = base - h; y < base; y++) for (let i = 0; i < 7; i++)
      put(b, px + i, y, i === 6 ? RS[1] : i === 0 ? RS[4] : (base - y) % 9 === 0 ? RS[4] : (base - y) % 9 === 8 ? RS[1] : nz(px + i, y) > 0.84 ? RS[3] : RS[2]);
    if (cap) { rect(b, px - 2, base - h - 3, 11, 3, RS[2]); rect(b, px - 2, base - h - 3, 11, 1, RS[0]); rect(b, px - 2, base - h - 1, 11, 1, RS[4]); }
    else for (let i = 0; i < 7; i++) if (nz(px + i, k + 77) > 0.5) put(b, px + i, base - h - 1, RS[2]);
  });
  rect(b, x - 32, base - 40, 19, 6, RS[2]); rect(b, x - 32, base - 40, 19, 1, RS[0]); rect(b, x - 32, base - 35, 19, 1, RS[4]); rect(b, x - 14, base - 40, 1, 6, RS[1]);   // what is left of the lintel
  rect(b, x - 6, base - 5, 13, 5, RS[3]); rect(b, x - 6, base - 5, 13, 1, RS[1]);                                                                                     // a fallen drum
  foliage(b, x + 9, base - 46, 7, 3.5, NR, x + 6, 2, 3.5); foliage(b, x - 22, base - 43, 6, 3, NR, x + 7, 2, 3.5);
  vine(b, x + 12, base - 42, 22, x, NR[3], [NR[1], NR[2]]); vine(b, x - 30, base - 34, 12, x + 1, NR[3], [NR[1], NR[2]]);
}
// a stump where a tree was cut (the fresh cut catches the light), and a felled trunk lying beside it
function bgStump(b, x, base, w, h) {
  for (let y = base - h; y < base; y++) {
    const fl = ss(base - 5, base, y), hw = w / 2 + fl * fl * 3;
    for (let i = Math.round(x - hw); i <= Math.round(x + hw); i++) { const u = (i - (x - hw)) / (2 * hw); put(b, i, y, u > 0.8 ? NT[0] : u > 0.4 ? NT[1] : u > 0.15 ? NT[2] : NT[3]); }
  }
  oval(b, x, base - h, w / 2, 1.5, I('#efe2b8')); oval(b, x - 0.5, base - h, Math.max(0.5, w / 2 - 2), 0.6, I('#d6c494'));
  put(b, x + w / 2 - 1, base - h - 2, NT[1]); put(b, x + w / 2 - 1, base - h - 3, NT[0]);                 // a splinter left standing
}
function bgFelled(b, x, base, len, r) {
  for (let i = 0; i < len; i++) for (let j = -r; j <= r; j++) {
    if (Math.abs(j) === r && (i < 1 || i > len - 2)) continue;
    put(b, x + i, base - r + j, j < -r * 0.4 ? NT[0] : j < r * 0.4 ? NT[1] : NT[3]);
    if (j > -r && (i * 3 + j * 5) % 11 === 0) put(b, x + i, base - r + j, NT[2]);
  }
  oval(b, x + len, base - r, 1.6, r, I('#efe2b8')); oval(b, x + len, base - r, 0.8, Math.max(0.5, r - 1.6), I('#d6c494'));
  for (const k of [0.3, 0.62]) { const sx = x + Math.round(len * k); put(b, sx, base - 2 * r - 1, NT[1]); put(b, sx + 1, base - 2 * r - 2, NT[1]); }   // lopped branch stubs
}
const BG_RUINS = [[96, 1], [330, 0], [652, 2], [888, 0]];
// the understory's trees: [design x, trunk width, index, how far the forest has thinned there]
function nearTrees(X1) {
  const out = [];
  for (let x = 40, i = 0; x < X1 + 40; x += 104 + Math.round(nz(i, 91) * 84), i++) out.push([x, 6 + Math.round(nz(i, 92) * 3), i, thinNear(x)]);
  return out;
}
const young = th => th > 0.22 ? 0.72 : 1;       // the trees at the edge of the clearing are young ones
// ruins, then every trunk with its lianas (or the stump that is left of it)
function nearBack(b, X1) {
  for (const [x, k] of BG_RUINS) [bgGate, bgSteps, bgColumns][k](b, x, 226);
  for (const [x, w, i, th] of nearTrees(X1)) {
    if (th >= 0.6) continue;                    // cut down: nearFront() paints the stump
    const sc = young(th), fy = Math.round(lerp(190, 112 + nz(i, 93) * 22, sc));
    trunkCol(b, x, Math.round(w * sc), fy, 230, NT, x, 30 * sc);
    for (let k = 0; k < 2; k++) { const lx = x + (k ? w + 3 : -w - 2), len = (50 + nz(x, k) * 70) * sc; for (let y = fy + 6; y < fy + 6 + len; y++) put(b, lx + Math.round(Math.sin(y / 13 + k + x) * 2), y, k ? NR[3] : NT[3]); }
  }
}
// the crowns of the trees whose index is in [i0, i1): forked branches carrying side crowns, the main crown, an epiphyte
function nearCrowns(b, X1, i0, i1) {
  const BLOOM = [['#ffb060', '#f2742a'], ['#ffb8d8', '#e8609a'], ['#fff0a0', '#ffc83c']];
  for (const [x, , i, th] of nearTrees(X1)) {
    if (i < i0 || i >= i1 || th >= 0.6) continue;
    const sc = young(th), fy = lerp(190, 112 + nz(i, 93) * 22, sc), rx = (26 + nz(i, 94) * 12) * sc, ry = (14 + nz(i, 95) * 6) * sc;
    for (const sd of [-1, 1]) {
      const ex = x + sd * (20 + nz(i, 98 + sd) * 14) * sc, ey = fy + (16 + nz(i, 99 + sd) * 12) * sc, y0 = ey + (16 + nz(i, 104 + sd) * 10) * sc;
      const br = bez([[x, y0], [x + sd * 5, y0 - 8 * sc], [ex - sd * 6, ey + 8 * sc], [ex, ey]], 16);
      path(b, br, NT[2], 2); path(b, br.map(([px, py]) => [px + 1, py]), NT[1], 1);
      foliage(b, ex, ey - 2, (12 + nz(i, 100 + sd) * 7) * sc, (7 + nz(i, 101 + sd) * 3) * sc, NR, x * 13 + 5 + sd, 3, 6);
    }
    foliage(b, x + (nz(i, 96) - 0.5) * 12, fy, rx, ry, NR, x * 11 + 7, 3, 6.5);
    if (sc === 1 && nz(i, 97) > 0.45) { const by = fy + 44 + nz(i, 105) * 30; for (let k = -3; k <= 3; k++) line(b, x, by, x + k * 2.4, by - 7 + Math.abs(k) * 1.6, k % 2 ? NR[2] : NR[1]); put(b, x, by - 8, I('#ff8a5a')); put(b, x, by - 9, I('#ffc08a')); }
    if (nz(i, 102) > 0.55) {
      const [c0, c1] = BLOOM[Math.floor(nz(i, 103) * 3)];
      for (let j = 0; j < 46; j++) {
        const px = x + (nz(j, i * 31) - 0.5) * 2 * rx, py = fy + (nz(j, i * 31 + 1) - 0.65) * 2 * ry, q = NR.indexOf(get(b, px, py));
        if (q < 0 || q > 1) continue;
        put(b, px, py, I(c1)); put(b, px + 1, py, I(c1)); put(b, px, py - 1, I(c0)); if (nz(j, i) > 0.5) put(b, px + 1, py - 1, I(c0));
      }
    }
  }
}
// banana plants and tree ferns
function nearFront(b, X1) {
  for (let x = 84, i = 0; x < X1 + 20; x += 90 + Math.round(nz(i, 111) * 90), i++) {   // banana plants
    if (thinNear(x) > 0.75) continue;
    const base = 218 + Math.round(nz(i, 112) * 4), s = 16 + nz(i, 113) * 6;
    rect(b, x - 1, base - s, 3, s, NR[3]);
    paddle(b, x, base - s, -2.5, s * 1.15, 3.6, 0.25, NR, x);
    paddle(b, x, base - s, -1.9, s * 1.3, 4, 0.18, NR, x + 1);
    paddle(b, x, base - s, -0.95, s * 1.25, 3.8, 0.2, NR, x + 2);
    paddle(b, x, base - s, -0.3, s * 1.05, 3.4, 0.32, NR, x + 3);
  }
  for (let x = 150, i = 0; x < X1 + 20; x += 130 + Math.round(nz(i, 121) * 110), i++) {   // tree ferns
    if (thinNear(x) > 0.5) continue;
    const base = 220, h = 30 + nz(i, 122) * 16;
    for (let y = base - h; y < base; y++) { put(b, x, y, NT[2]); put(b, x + 1, y, NT[3]); }
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI * (0.05 + 0.9 * k / 8), Lf = 13 + nz(k, x) * 8;
      for (let j = 1; j <= Lf; j++) {
        const t = j / Lf, fx = x + Math.cos(a) * j, fy = base - h + Math.sin(a) * j * 0.7 + t * t * Lf * 0.65;
        put(b, fx, fy, NR[1]);
        if (j % 2 === 0 && j < Lf - 1) { put(b, fx, fy + 1, NR[2]); put(b, fx, fy - 1, NR[0]); }
      }
    }
  }
}
// the undergrowth and the floor along the back of the world; in the clearing: trodden earth, stumps, felled trunks
function nearFloor(b, X1) {
  const TAN = [mixI(NR[2], I('#e0cf96'), 0.8), mixI(NR[2], I('#c8b47c'), 0.8)];
  for (let x = -14; x < X1 + 14; x += 3) {   // undergrowth along the back of the world: lower and patchy in the clearing
    const th = thinNear(x);
    if (th > 0.5 && nz(x + 4096, 77) < (th - 0.5) * 1.5) continue;
    const r = (3 + nz(x + 4096, 71) * 5 * (fbm(x / 30, 0, 72) + 0.4)) * (1 - 0.45 * th), y = 219 + 3 * th - r * 0.4 + nz(x + 4096, 73) * 4;
    oval(b, x, y, r, r * 0.8, NR[2]); oval(b, x + 0.6, y - 1.2, r - 1.3, r * 0.8 - 1.3, NR[1]);
    if (nz(x + 4096, 74) > 0.75) put(b, x + 1, y - r + 1, NR[0]);
  }
  for (let x = -10; x < X1; x++) {           // the floor at the back of the world: leaves, or trodden earth in the clearing
    const th = thinNear(x), bare = th > 0.4 && fbm(x / 9, 2, 78) < (th - 0.35) * 1.1;
    for (let y = 222; y < H; y++) { if (!bare) put(b, x, y, NR[2]); else if (get(b, x, y) === NONE || y > 223) put(b, x, y, TAN[nz(x >> 1, y) > 0.7 ? 1 : 0]); }
  }
  for (let x = 6; x < X1; x += 16 + Math.round(nz(x, 75) * 22)) if (thinNear(x) < 0.7) fern(b, x, 222, 6 + nz(x, 76) * 5, NR);
  for (const [x, w, i, th] of nearTrees(X1)) if (th >= 0.6) { bgStump(b, x, 230, w + 6, 12 + Math.round(nz(i, 106) * 7)); if (nz(i, 107) > 0.35) bgFelled(b, x + 14, 230, 28 + Math.round(nz(i, 108) * 16), 4); }
  for (let x = 842, i = 0; x < X1 + 10; x += 30 + Math.round(nz(i, 181) * 40), i++) {     // what the robots left of the trees
    if (thinNear(x) < 0.5 || BG_RUINS.some(([rx]) => Math.abs(x - rx) < 40)) continue;
    const q = nz(i, 182);
    if (q < 0.55) bgStump(b, x, 230, 9 + Math.round(nz(i, 183) * 5), 9 + Math.round(nz(i, 184) * 8));
    else if (q < 0.78) bgFelled(b, x, 230, 24 + Math.round(nz(i, 185) * 16), 3 + (i & 1));
    else { for (let y = 204; y < 228; y++) put(b, x + Math.round(Math.sin(y / 6 + i)), y, NT[2]); foliage(b, x, 202, 6, 4, NR, x + 31, 2, 3.5); }   // a sapling they left
  }
}

// ------------------------------------------------------------ the tall trees (p 0.6), laid out along the whole area in design x.
// Giants: buttressed trunks wrapped in strangler figs, side branches, a dark crown closing over the top of the
// screen, vines and backlit fronds hanging into the gaps. Slender trees between them: a thin leaning trunk, a small
// high crown, epiphytes. No two are alike: width, lean, branches [side, y, length], the way the fig winds, the
// crown [rx, ry], the number of vines, which sides carry fronds (fr: 1 right, 2 left), a toucan (bird).
// The last giant stands where the camp's clearing begins (it has left the screen before the sky has crossfaded
// halfway into the camp's); east of it the sky is open.
const TREES = [
  { x: 18, w: 16, lean: -5, br: [[1, 94, 48]], fig: 0, cr: [64, 23], vines: 5, fr: 3 },
  { x: 240, slim: 1, w: 7, lean: 9, br: [[-1, 108, 24]], cr: [32, 13], vines: 2, epi: [150] },
  { x: 400, w: 13, lean: 4, br: [[1, 80, 42], [-1, 142, 26]], fig: 1, cr: [56, 20], vines: 6, fr: 1, bird: 1 },
  { x: 528, slim: 1, w: 8, lean: -8, br: [[1, 84, 28]], cr: [36, 14], vines: 3, epi: [132, 178] },
  { x: 656, w: 17, lean: -3, br: [[-1, 102, 44]], fig: 2, cr: [68, 25], vines: 5, fr: 3 },
  { x: 716, slim: 1, w: 6, lean: 7, br: [[1, 74, 20]], cr: [30, 12], vines: 2, epi: [160] },
  { x: 830, w: 15, lean: 5, br: [[1, 86, 44], [-1, 150, 24]], fig: 0, cr: [62, 22], vines: 6, fr: 3, bird: 1 }
];
const TALL_W = 1010;                   // the tall-tree strip (and the shafts) end here: open sky beyond
const PERCH = [];                      // where a toucan sits: [design x, y] on a giant's branch
const FIGP = P('#cfc696', '#a8a078', '#84805e'), ORCH = P('#ffb0dc', '#e052a0', '#fff0a0');
// three ways a strangler fig winds round a trunk: curves of [dx in half trunk widths, y]
const FIGS = [
  [[[-1, 60], [1.6, 80], [-1.3, 110], [1, 140]], [[1, 150], [-1.6, 170], [1.3, 196], [-0.9, 228]]],
  [[[1, 46], [-1.8, 70], [1.4, 96], [-1, 122]], [[-1, 122], [1.5, 150], [-1.6, 178], [0.6, 214]], [[1.2, 100], [3.4, 130], [2.8, 170], [1.1, 190]]],
  [[[-1, 84], [-2.8, 120], [-2.3, 170], [-1.3, 212]], [[1, 70], [-1.3, 92], [1.3, 118], [-1, 150]], [[-1, 164], [1.5, 186], [-1.3, 206], [0.8, 230]]]
];
// the leaves along a crown's lower edge and its sunny side are lit from behind
function backlit(b, x0, x1, y1) {
  for (let y = 4; y < y1; y++) for (let x = x0; x <= x1; x++) {
    const k = GC.indexOf(get(b, x, y));
    if (k < 0) continue;
    const open = get(b, x, y + 1) === NONE || get(b, x, y + 2) === NONE, sun = get(b, x + 1, y) === NONE || get(b, x + 2, y) === NONE;
    if (open && nz(x, y + 700) > 0.3) put(b, x, y, k < 2 ? LIT[1] : LIT[2]);
    else if (sun && nz(x, y + 701) > 0.4) put(b, x, y, LIT[1]);
  }
}
function crownVines(b, T, gi, top, span, s) {
  for (let k = 0; k < T.vines; k++) {
    const vx = Math.round(top + (T.vines > 1 ? (k / (T.vines - 1) - 0.5) : 0.3) * span + (nz(gi, 210 + k) - 0.5) * 14);
    if (Math.abs(vx - top) < T.w) continue;
    let y0 = 12;
    while (y0 < 70 && get(b, vx, y0 + 1) !== NONE) y0++;
    vine(b, vx, y0 - 2, 22 + Math.round(nz(gi, 220 + k) * 80), s + k, GC[3], [GC[1], GC[2]], nz(gi, 230 + k) > 0.6 ? ORCH : null);
  }
}
// a giant in two passes (two bake steps): the trunk with its roots, fig and branches, then the crown
const giantX = (T, s, y) => T.x + T.lean * (1 - y / GROUND) + Math.sin(y / 41 + s) * 2;
function giantTrunk(b, T, gi) {
  const s = gi * 17 + 3, w = T.w, cxAt = y => giantX(T, s, y);
  // the trunk: sunlit on the right, furrowed bark, moss on the shaded side
  for (let y = -2; y <= GROUND; y++) {
    const fl = ss(186, GROUND, y), hw = w / 2 + fl * fl * w * 0.8, cx = cxAt(y);
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const u = (x - (cx - hw)) / (2 * hw);
      let k = u > 0.86 ? 0 : u > 0.55 ? 1 : u > 0.2 ? 2 : 3;
      const fur = Math.sin(x * 1.3 + Math.sin(y / 11 + x) * 1.5);
      if (fur > 0.8 && u < 0.9) k = Math.min(4, k + 1);
      if (nz(x + 70, y + 300) > 0.95) k = Math.max(0, k - 1);
      let c = GB[k];
      if (u < 0.55 && fbm(x / 6, y / 10, 52 + s) > 0.6) c = nz(x >> 1, (y >> 1) + s) > 0.45 ? GM[0] : GM[1];
      put(b, x, y, c);
    }
  }
  // buttress roots fanning out at the foot
  for (const [dx, h] of [[-1, 30 + nz(gi, 250) * 12], [1, 26 + nz(gi, 251) * 12], [-1, 13 + nz(gi, 252) * 9], [1, 15 + nz(gi, 253) * 10]]) {
    const x0 = T.x + dx * (w / 2 - 2), x1 = T.x + dx * (w / 2 + 16 + h * 0.3), n = Math.abs(x1 - x0);
    for (let i = 0; i <= n; i++) {
      const x = x0 + dx * i, t = i / n, ty = Math.round(GROUND - h * (1 - t) * (1 - t));
      for (let y = ty; y <= GROUND; y++) put(b, x, y, y === ty ? GB[dx > 0 ? 0 : 1] : (dx > 0 ? GB[1] : GB[3]));
    }
  }
  // the strangler fig: pale ribbons wrapping the trunk (and a liana looping off it)
  for (const c of FIGS[T.fig]) {
    const r = bez(c.map(([dx, y]) => [cxAt(y) + dx * w / 2, y]));
    path(b, r, GB[4], 3); path(b, r, FIGP[1], 1); path(b, r.map(([x, y]) => [x + 1, y]), FIGP[0], 1);
  }
  // side branches, each with a clump of leaves at its end and vines hanging from it
  T.br.forEach(([side, by, len], bi) => {
    const bx0 = cxAt(by) + side * (w / 2 - 2);
    for (let i = 0; i <= len; i++) {
      const x = bx0 + side * i, y = by - Math.round(Math.sin(i / len * Math.PI) * 4 + i * 0.16), r = 3 - i * 0.04;
      for (let j = -Math.ceil(r); j <= r; j++) put(b, x, y + j, j < -r * 0.4 ? GB[1] : j < r * 0.3 ? GB[2] : GB[3]);
      if (nz(i, s + 91 + bi) > 0.3) put(b, x, y - Math.ceil(r) - 1, GM[nz(i, s + 92) > 0.5 ? 0 : 1]);
    }
    foliage(b, bx0 + side * len, by - 12, 11 + len * 0.14, 6 + len * 0.07, GC, 99 + s + bi, 3, 5.5);
    backlit(b, Math.round(bx0 + side * len - 26), Math.round(bx0 + side * len + 26), by + 4);
    if (T.bird && bi === 0) PERCH.push([Math.round(bx0 + side * len * 0.42), by - Math.round(Math.sin(0.42 * Math.PI) * 4 + len * 0.42 * 0.16) - 4]);
    vine(b, bx0 + side * len * 0.45, by + 2, 30 + (nz(gi, 203 + bi) * 34 | 0), s + bi, GC[3], [GC[1], GC[2]], bi ? ORCH : null);
    vine(b, bx0 + side * len * 0.86, by - 2, 20 + (nz(gi, 204 + bi) * 26 | 0), s + 1 + bi, GC[3], [GC[1], GC[2]], bi ? null : ORCH);
  });
}
function giantCrown(b, T, gi) {
  const s = gi * 17 + 3, top = T.x + T.lean, [rx, ry] = T.cr;
  // a dark ceiling of leaves, lowest round the trunk
  rect(b, top - rx * 0.72, -2, rx * 1.44, 12, GC[3]);
  foliage(b, top, 12, rx, ry, GC, s + 1, 3.5, 7);
}
function giantLobes(b, T, gi) {
  const s = gi * 17 + 3, top = T.x + T.lean, [rx, ry] = T.cr;
  foliage(b, top - rx * 0.72 + (nz(gi, 260) - 0.5) * 10, 26 + nz(gi, 261) * 6, rx * 0.42, ry * 0.58, GC, s + 2, 3, 6);
  foliage(b, top + rx * 0.7 + (nz(gi, 262) - 0.5) * 10, 24 + nz(gi, 263) * 6, rx * 0.45, ry * 0.58, GC, s + 3, 3, 6);
  foliage(b, top + (nz(gi, 264) - 0.5) * 26, 38 + nz(gi, 265) * 6, rx * 0.48, ry * 0.5, GC, s + 4, 3, 6);
  backlit(b, Math.round(top - rx - 26), Math.round(top + rx + 26), 70);
  // backlit fronds reaching into the gaps
  const FR = [LIT[0], LIT[1], LIT[2], GC[2]], q = k => nz(gi, 270 + k);
  if (T.fr & 1) { jfrond(b, top + rx - 4, 28 + q(0) * 6, 0.25 + q(1) * 0.2, 34 + q(2) * 8, 0.5, FR); jfrond(b, top + rx - 10, 14 + q(3) * 5, 0.05 + q(4) * 0.15, 40 + q(5) * 8, 0.42, FR); }
  if (T.fr & 2) { jfrond(b, top - rx + 4, 30 + q(6) * 6, Math.PI - 0.25 - q(7) * 0.2, 32 + q(8) * 8, 0.5, FR); jfrond(b, top - rx + 12, 16 + q(9) * 5, Math.PI - 0.05 - q(10) * 0.15, 38 + q(11) * 8, 0.42, FR); }
  crownVines(b, T, gi, top, rx * 1.9, s);
}
function paintSlender(b, T, gi) {
  const s = gi * 23 + 7, w = T.w, [rx, ry] = T.cr;
  const cxAt = y => { const t = 1 - y / GROUND; return T.x + T.lean * t * t + Math.sin(y / 58 + s) * 3; };
  const top = cxAt(20);
  for (let y = -2; y <= GROUND; y++) {
    const fl = ss(204, GROUND, y), hw = w / 2 + (y / GROUND) * 1.2 + fl * fl * 5, cx = cxAt(y);
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const u = (x - (cx - hw)) / (2 * hw);
      let k = u > 0.78 ? 0 : u > 0.45 ? 1 : u > 0.15 ? 2 : 3;
      if ((y + s * 5) % 14 === 0 && u < 0.9) k = Math.min(4, k + 1);                     // rings on the smooth bark
      if (nz(x + 31, y + 500) > 0.94) k = Math.min(4, k + 1);
      put(b, x, y, GB[k]);
    }
  }
  // a thin liana winding up it
  const r = bez([[cxAt(214) - w / 2 - 1, 214], [cxAt(170) + w + 2, 170], [cxAt(120) - w - 3, 120], [cxAt(70) + w / 2, 70]], 40);
  path(b, r, GB[4], 1); r.forEach(([x, y], i) => { if (i % 5 === 2) { put(b, x + 1, y, GM[0]); put(b, x + 2, y + 1, GM[1]); } });
  // a side branch or two with a small clump of leaves
  T.br.forEach(([side, by, len], bi) => {
    const bx0 = cxAt(by) + side * (w / 2 - 1);
    for (let i = 0; i <= len; i++) {
      const x = bx0 + side * i, y = by - Math.round(i * 0.5 + Math.sin(i / len * Math.PI) * 2);
      put(b, x, y, GB[2]); put(b, x, y - 1, GB[1]); if (i < len * 0.5) put(b, x, y + 1, GB[3]);
    }
    foliage(b, bx0 + side * (len + 2), by - len * 0.5 - 5, 9 + len * 0.12, 5 + len * 0.06, GC, 131 + s + bi, 2.5, 4.5);
    backlit(b, Math.round(bx0 + side * len - 18), Math.round(bx0 + side * len + 18), Math.round(by - len * 0.5 + 6));
    if (bi === 0) vine(b, bx0 + side * len * 0.6, by - Math.round(len * 0.3) + 2, 14 + (nz(gi, 205) * 18 | 0), s + 3, GC[3], [GC[1], GC[2]]);
  });
  // epiphytes sitting on the trunk: a tuft of leaves with a red flower spike
  T.epi.forEach((ey, k) => {
    const sd = (k + gi) % 2 ? -1 : 1, ex = cxAt(ey) + sd * (w / 2 + 1);
    for (let j = -3; j <= 3; j++) line(b, ex, ey, ex + sd * (4 + Math.abs(j)) * 0.9 + j * 0.8, ey - 6 + Math.abs(j) * 1.7, j % 2 ? GC[1] : LIT[2]);
    put(b, ex + sd, ey - 7, I('#ff6a4a')); put(b, ex + sd, ey - 8, I('#ffb08a'));
  });
  // the crown: smaller and higher than a giant's, its foot showing under the top of the screen
  rect(b, top - rx * 0.6, -2, rx * 1.2, 16, GC[3]);
  foliage(b, top, 20, rx, ry + 2, GC, s + 1, 3, 6);
  foliage(b, top + (T.lean > 0 ? 1 : -1) * rx * 0.6, 32 + nz(gi, 266) * 5, rx * 0.5, ry * 0.6, GC, s + 2, 3, 5.5);
  backlit(b, Math.round(top - rx - 20), Math.round(top + rx + 20), 60);
  crownVines(b, T, gi, top, rx * 1.6, s);
}
// warm light shafts slanting down and left through the gaps between the giants' crowns (on their parallax)
function shaftCanvas(w) {
  const beams = [], c = canvasOf(w, H), g = c.getContext('2d'), im = g.createImageData(w, H), d = im.data;
  const G2 = TREES.filter(T => !T.slim);
  for (let i = 0; i + 1 < G2.length; i++) {
    const gx = (G2[i].x + G2[i + 1].x) / 2 + 20, sp = (G2[i + 1].x - G2[i].x) / 300;
    [[-40, 14, 0.26], [0, 26, 0.34], [44, 12, 0.24], [84, 18, 0.27]].forEach(([dx, bw, ba], k) => {
      if (nz(i, 290 + k) < 0.18) return;
      beams.push([gx + (dx + (nz(i, 280 + k) - 0.5) * 26) * sp + 60, bw * (0.75 + 0.6 * nz(i, 284 + k)), ba * (0.8 + 0.3 * nz(i, 288 + k))]);
    });
  }
  for (let y = 0; y < H; y++) {
    const fy = ss(8, 50, y) * (1 - ss(196, 244, y));
    if (fy <= 0) continue;
    for (const [bx, bw, ba] of beams) {
      const cc = bx - y * 0.62;
      for (let x = Math.max(0, Math.floor(cc - bw / 2)); x <= Math.min(w - 1, Math.ceil(cc + bw / 2)); x++) {
        const e = 1 - Math.abs(x - cc) / (bw / 2), al = e > 0 ? Math.round(ba * fy * Math.min(1, e * 2.2) * 255) : 0, j = (y * w + x) * 4;
        if (al > 2 && al > d[j + 3]) { d[j] = 255; d[j + 1] = 248; d[j + 2] = 206; d[j + 3] = al; }
      }
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

// ------------------------------------------------------------ live bits of the backdrop
const MACAW = (() => {
  const pal = { r: '#e8352a', b: '#2f7fe0', t: '#1d58b0', w: '#fff4e0', k: '#3a3030', y: '#ffd23f' };
  return [
    makeSprite(['.....bb...', '....bby...', 'ttrrrrrw..', '..trrrrrk.'], pal),
    makeSprite(['..........', 'ttrrbbrw..', '..trrrrrk.', '..........'], pal),
    makeSprite(['ttrrrrrw..', '..trrrrrk.', '....yby...', '.....bb...'], pal)
  ];
})();
const TOUCAN = makeSprite([
  '....kkkk....',
  '...kkkkkk...',
  'yyokkekkk...',
  'yooowwkkkk..',
  '.oo.wwwkkkk.',
  '....wwwkkkk.',
  '.....wkkkkkk',
  '......kkkkkk',
  '......fk.rkk',
  '.....ff...kk'
], { k: '#1c1c28', y: '#ffd23f', o: '#ff8a1e', w: '#fff6d8', e: '#58c8f0', r: '#e8352a', f: '#6a7480' });
// a toucan on a giant's branch: it blinks and now and then dips its head
function toucans(g, cx, off) {
  for (const [px, py] of PERCH) {
    const x = px - off - 6, dip = (G.t + px) % 260 < 14 ? 1 : 0;
    if (x < -20 || x > W + 10) continue;
    g.drawImage(TOUCAN.img, x, py - 10 + dip);
    if ((G.t + px * 3) % 190 < 6) { g.fillStyle = '#1c1c28'; g.fillRect(x + 5, py - 8 + dip, 1, 1); }
  }
}
function hangBlit(g, s, x, y, amt, rows) {
  const X = Math.round(x) + s.x0, Y = Math.round(y) + s.y0;
  let y0 = 0, off = null;
  for (let sy = 0; sy < s.h; sy += rows) {
    const sh = Math.min(rows, s.h - sy), k = (sy + sh / 2) / s.h, o = Math.round(amt * k * k);
    if (off !== null && o !== off) { g.drawImage(s.img, 0, y0, s.w, sy - y0, X + off, Y + y0, s.w, sy - y0); y0 = sy; }
    off = o;
  }
  if (off !== null) g.drawImage(s.img, 0, y0, s.w, s.h - y0, X + off, Y + y0, s.w, s.h - y0);
}
function liveVines(g, cx, off) {
  TREES.forEach((T, gi) => {
    if (T.slim) return;
    for (let k = 0; k < 2; k++) {
      const x = T.x + T.lean + (k ? T.cr[0] * 0.55 : -T.cr[0] * 0.48) + Math.round((nz(gi, 240 + k) - 0.5) * 12) - off;
      if (x < -20 || x > W + 20) continue;
      hangBlit(g, A.vines[(gi + k * 2) % 3], x, 30 + (nz(gi, 242 + k) * 10 | 0), sway(T.x * 0.013 + k * 2, 3.2) - 0.6, 4);
    }
  });
}
function birds(g, cx) {
  // a far flock crossing the sky, then two scarlet macaws nearer by
  g.fillStyle = '#6a8fb4';
  for (let i = 0; i < 6; i++) {
    const t = G.t + i * 11, x = Math.round(wrap(96 + i * 13 + (i % 2) * 7 + G.t * 0.16 - cx * 0.06, W + 120)) - 60, y = Math.round(70 + (i * 7) % 17 + Math.sin(G.t * 0.02 + i) * 2), f = Math.floor(t / 9) % 2;
    g.fillRect(x - 2, y - 1 + f, 1, 1); g.fillRect(x - 1, y - f, 1, 1); g.fillRect(x, y, 1, 1); g.fillRect(x + 1, y - f, 1, 1); g.fillRect(x + 2, y - 1 + f, 1, 1);
  }
  for (let i = 0; i < 2; i++) {
    const t = G.t + i * 37, span = W + 220;
    const x = Math.round(wrap(220 + i * 26 + t * 0.55 - cx * 0.1, span)) - 60, y = Math.round(78 + i * 9 + Math.sin(t * 0.045 + i) * 5);
    const s = MACAW[[0, 1, 2, 1][Math.floor(t / 6) % 4]];
    g.drawImage(s.img, x, y);
  }
}

// ============================================================
// The backdrop for camera cx on the context g (the screen, or level1_art.js's scratch canvas for the crossfade)
// ============================================================
const A = { ready: false };            // everything the steps bake
function bg(g, cx) {
  if (!A.ready) return;
  const ga = g.globalAlpha, k = 0.5 + 0.5 * Math.sin(G.t * 0.02);
  sunAt(cx);
  g.drawImage(A.sky, -10, -10);
  g.globalAlpha = ga * (0.5 + 0.5 * k); g.drawImage(A.rays[0], SX - 420, SY - 70);
  g.globalAlpha = ga * (1 - 0.5 * k); g.drawImage(A.rays[1], SX - 420, SY - 70);
  g.globalAlpha = ga;
  g.drawImage(A.sun, SX - 72, SY - 72);
  g.drawImage(A.disc, SX - 12, SY - 12);
  for (let i = 0; i < CLOUDS.length; i++) {
    const c = CLOUDS[i], span = W + 300, x = wrap(c[1] - cx * c[3] - G.t * c[4], span) - 150;
    if (x < W + 10 && x + c[0] > -10) g.drawImage(A.clouds[i], Math.round(x), c[2] - A.clouds[i].height);
  }
  blitStrip(g, A.hills, cx);
  birds(g, cx);
  blitStrip(g, A.far, cx);
  blitStrip(g, A.mid, cx);
  g.drawImage(A.bloom, SX - 170, SY - 170);
  blitStrip(g, A.near, cx);
  const off = offOf(A.tall, cx);
  if (off < A.tall.w) {
    const sw = Math.min(W + 20, A.tall.w - off);
    g.globalAlpha = ga * (0.7 + 0.14 * Math.sin(G.t * 0.017));
    g.drawImage(A.shaft, off, 0, sw, H, -10, 0, sw, H);
    g.globalAlpha = ga;
    blitStrip(g, A.tall, cx);
    liveVines(g, cx, off);
    toucans(g, cx, off);
  }
}

// ============================================================
// The world plane: ground, temple-block and fallen-log platforms, the statue, ruins, palms, bushes, ferns
// ============================================================
// ------------------------------------------------------------ carved stone
// one dressed block: lit top bevel and sun side, shaded left and foot, mottled face, pits
function stoneFace(b, x0, y0, w, h, s) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    let k = 2;
    if (y === y0) k = 0; else if (y === y0 + 1) k = 1;
    if (x === x0 + w - 1) k = Math.min(k, 1);
    if (x === x0) k = 4; else if (x === x0 + 1 && k > 1) k = 3;
    if (y === y0 + h - 1) k = 4; else if (y === y0 + h - 2 && k > 1) k = 3;
    if (k === 2) { const m = fbm(x / 7, y / 5, s); if (m > 0.6) k = 1; else if (m < 0.38) k = 3; }
    if (k < 4 && k > 0 && nz(x, y + s * 13) > 0.965) k++;
    put(b, x, y, STN[k]);
  }
}
// engrave a pattern ('#' = groove): a dark cut with the light catching its lower edge
function carve(b, x, y, rows) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    if (rows[j][i] !== '#') continue;
    put(b, x + i, y + j, STN[4]);
    if (!(rows[j + 1] && rows[j + 1][i] === '#') && get(b, x + i, y + j + 1) !== NONE) put(b, x + i, y + j + 1, STN[0]);
  }
}
const GLYPHS_T = [
  ['#########', '........#', '#######.#', '#.....#.#', '#.###.#.#', '#.#...#.#', '#.#####.#', '#.......#', '#########'],   // the square spiral
  ['....#....', '.#..#..#.', '..#...#..', '...###...', '##.###.##', '...###...', '..#...#..', '.#..#..#.', '....#....'],   // the sun
  ['....#....', '...###...', '...#.#...', '..#####..', '..#...#..', '.#######.', '.#.....#.', '#########', '.........'],   // the step pyramid
  ['#.#.#.#.#', '#.#.#.#.#', '.........', '.#######.', '.#.....#.', '.#.###.#.', '.#.....#.', '.#######.', '.........']    // the eye
];
function frame(b, x, y, w, h) { carve(b, x, y, Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => (j === 0 || j === h - 1 || i === 0 || i === w - 1 ? '#' : '.')).join(''))); }
// a carved guardian mask, about 27 x 23, centred at cx
function mask(b, cx, top) {
  cx = Math.round(cx);
  carve(b, cx - 13, top, ['###########################']);
  for (const ex of [cx - 12, cx + 4]) { frame(b, ex, top + 3, 9, 7); rect(b, ex + 2, top + 5, 5, 3, STN[3]); rect(b, ex + 3, top + 5, 3, 3, STN[5]); put(b, ex + 5, top + 5, STN[1]); }
  rect(b, cx - 2, top + 3, 5, 10, STN[1]); rect(b, cx + 2, top + 3, 1, 10, STN[0]); rect(b, cx - 2, top + 3, 1, 10, STN[3]);
  rect(b, cx - 4, top + 12, 9, 2, STN[1]); rect(b, cx - 4, top + 14, 9, 1, STN[4]); put(b, cx - 3, top + 13, STN[5]); put(b, cx + 3, top + 13, STN[5]);
  frame(b, cx - 10, top + 17, 21, 6);
  for (let x = cx - 7; x <= cx + 7; x += 3) rect(b, x, top + 18, 1, 4, STN[4]);
  rect(b, cx - 9, top + 20, 19, 1, STN[5]);
}
function crack(b, x, y, n, s) {
  for (let i = 0; i < n; i++) {
    if (get(b, x, y) !== NONE) put(b, x, y, STN[5]);
    y++; const q = nz(x + i * 7, s); if (q < 0.34) x--; else if (q > 0.66) x++;
  }
}
// moss carpet whose top row is exactly `top`, from x0 to x1 - 1; blades above, drips down the face
function mossTop(b, x0, x1, top, s, drip = 9) {
  for (let x = x0; x < x1; x++) {
    const d = 2 + Math.round(fbm(x / 5, 1, 44 + s) * 3);
    for (let k = 0; k < d; k++) put(b, x, top + k, k === 0 ? (nz(x, s + 40) > 0.5 ? MOSS[0] : MOSS[1]) : k === 1 ? MOSS[1] : k === d - 1 ? MOSS[3] : MOSS[2]);
    const h = nz(x, 45 + s) < 0.4 ? 1 + Math.round(nz(x, 46 + s) * 1.4) : 0;
    for (let k = 1; k <= h; k++) put(b, x, top - k, k === h ? MOSS[0] : MOSS[1]);
    if (nz(x, 47 + s) > 0.78) for (let k = 0, n = 2 + nz(x, 48 + s) * drip; k < n; k++) put(b, x, top + d + k, k % 3 ? MOSS[3] : MOSS[2]);
  }
}
// dull moss for decor stone: the bright carpet is kept for the tops you can stand on
function mossDull(b, x0, x1, top, s) {
  for (let x = x0; x < x1; x++) {
    if (nz(x, s + 80) < 0.18) continue;
    const d = 1 + Math.round(fbm(x / 4, 2, 60 + s) * 2.4);
    for (let k = 0; k < d; k++) put(b, x, top + k, k === 0 && nz(x, s + 81) > 0.7 ? MOSS[2] : k === d - 1 ? MOSS[4] : MOSS[3]);
    if (nz(x, s + 82) > 0.85) for (let k = 0, n = 2 + nz(x, s + 83) * 5; k < n; k++) put(b, x, top + d + k, MOSS[4]);
  }
}
function tuft(b, x, base, n, hgt, s, pal = GRASS) {
  for (let k = 0; k < n; k++) {
    const dx = (k - (n - 1) / 2) * 1.6, h = hgt * (0.6 + 0.4 * nz(k, s)), lean = dx * 0.5;
    for (let j = 0; j <= h; j++) put(b, x + dx + lean * (j / h) * (j / h), base - j, j > h - 1.5 ? pal[0] : j > h * 0.4 ? pal[1] : pal[2]);
  }
}
function bigBlossom(b, x, y, c0, c1, cc) { oval(b, x, y, 2, 2, c1); oval(b, x - 0.5, y - 0.5, 1.2, 1.2, c0); put(b, x, y, cc); }
function blossom(b, x, y, c0, c1, cc) { put(b, x - 1, y, c0); put(b, x + 1, y, c1); put(b, x, y - 1, c0); put(b, x, y + 1, c1); put(b, x, y, cc); }
const FLOWERS = [[I('#fff08a'), I('#ffc93c'), I('#f08a2a')], [I('#ffc2dc'), I('#ff7aa8'), I('#ffe066')], [I('#ffffff'), I('#dfe8f4'), I('#ffd23f')], [I('#ff9a8a'), I('#e8403a'), I('#ffe066')]];

// "rock" platforms: mossy carved temple blocks. The standing surface is the top row of the moss, exactly pl.y from
// pl.x to pl.x + pl.w; the block's sides are plumb so it reads as a step.
function platTemple(pl) {
  const x = pl.x, y = pl.y, w = pl.w, bot = GROUND + 2, h = bot - y, s = pl.x % 97;
  const b = buf(x - 10, y - 8, w + 20, h + 12);
  if (h >= 36) {
    const h1 = Math.round(h * 0.6), wl = Math.round(w * (0.4 + nz(s, 3) * 0.2));
    stoneFace(b, x, y, w, h1, s);
    stoneFace(b, x, y + h1, wl, h - h1, s + 1); stoneFace(b, x + wl, y + h1, w - wl, h - h1, s + 2);
    mask(b, x + w / 2, y + 5);
    if (wl >= 15) carve(b, x + Math.round((wl - 9) / 2), y + h1 + Math.round((h - h1 - 9) / 2), GLYPHS_T[s % 4]);
    if (w - wl >= 15) carve(b, x + wl + Math.round((w - wl - 9) / 2), y + h1 + Math.round((h - h1 - 9) / 2), GLYPHS_T[(s + 2) % 4]);
    crack(b, x + w - 9, y + 3, 14, s + 5); crack(b, x + 5, y + h1 + 2, 9, s + 6);
  } else {
    stoneFace(b, x, y, w, h, s);
    const n = Math.max(1, Math.floor((w - 8) / 13)), gx0 = x + Math.round((w - (n * 13 - 4)) / 2), gy = y + Math.max(5, Math.round((h - 9) / 2) + 1);
    for (let k = 0; k < n; k++) carve(b, gx0 + k * 13, gy, GLYPHS_T[(s + k) % 4]);
    crack(b, x + Math.round(w * 0.62), y + 3, 10, s + 5);
  }
  // chipped lower corners, rubble at the foot
  put(b, x, bot - 1, NONE); put(b, x + w - 1, bot - 1, NONE); put(b, x + w - 1, bot - 2, NONE);
  for (const [dx, r] of [[-5, 2], [w + 3, 2.5], [w + 7, 1.5]]) { oval(b, x + dx, GROUND - r + 1, r, r * 0.8, STN[2]); put(b, x + dx, Math.round(GROUND - r * 1.6 + 1), STN[0]); }
  mossTop(b, x, x + w, y, s);
  // a root creeping over one top corner and down the face, a vine down the other side
  const rs = nz(s, 7) > 0.5 ? 1 : -1, rx0 = rs > 0 ? x + w - 6 : x + 5;
  const r = bez([[rx0, y - 2], [rx0 + rs * 6, y + 4], [rx0 - rs * 2, y + h * 0.4], [rx0 + rs * 5, Math.min(bot - 3, y + h * 0.75)]], 20);
  path(b, r, I('#5a4630'), 2); path(b, r, I('#8a7050'), 1);
  vine(b, rs > 0 ? x + 3 : x + w - 4, y + 3, Math.min(h - 10, 12 + (nz(s, 8) * 12 | 0)), s, MOSS[4], [MOSS[1], MOSS[2]]);
  // flowers on the moss, grass against the foot
  for (let k = 0; k < 2; k++) { const fx = x + 6 + Math.round(nz(s, 60 + k) * (w - 12)), f = FLOWERS[(s + k) % 3]; put(b, fx, y - 1, MOSS[2]); blossom(b, fx, y - 3, f[0], f[1], f[2]); }
  tuft(b, x + 4, bot, 3, 5, s + 70); tuft(b, x + w - 5, bot, 4, 6, s + 71); tuft(b, x + Math.round(w * 0.45), bot, 3, 4, s + 72);
  outline(b);
  return mk(b);
}
// "log" platforms: a real fallen trunk lying across two stumps. Moss on top (its top row is pl.y), a cut end with
// rings, a broken end, shelf fungi, a fern.
function platLog(pl) {
  const x = pl.x, y = pl.y, w = pl.w, s = pl.x % 89, r = 7, cy = y + r;
  const b = buf(x - 12, y - 10, w + 24, GROUND + 4 - (y - 10));
  // the two stumps it rests on, with flared roots
  for (const [sx, sw] of [[x + 10, 11], [x + w - 21, 12]]) {
    for (let yy = cy + 2; yy <= GROUND + 1; yy++) {
      const fl = ss(GROUND - 9, GROUND + 1, yy), hw = sw / 2 + fl * fl * 4;
      for (let xx = Math.round(sx + sw / 2 - hw); xx <= Math.round(sx + sw / 2 + hw); xx++) {
        const u = (xx - (sx + sw / 2 - hw)) / (2 * hw);
        let k = u > 0.82 ? 0 : u > 0.5 ? 1 : u > 0.18 ? 2 : 3;
        if ((xx + Math.floor(yy / 5)) % 3 === 0 && nz(xx, yy >> 1) > 0.4) k = Math.min(4, k + 1);
        put(b, xx, yy, BARK[k]);
      }
    }
    for (let k = 0; k < 4; k++) put(b, sx + 2 + k * 2 + (k & 1), GROUND - 6 - (nz(sx, k) * 6 | 0), MOSS[2]);
  }
  // the trunk
  for (let xx = x; xx < x + w; xx++) {
    const rr = r - (xx < x + 3 ? (x + 3 - xx) * 0.8 : 0) + Math.sin(xx * 0.7) * 0.25, jag = xx < x + 4 ? (nz(xx, s) * 3 | 0) : 0;
    for (let yy = Math.ceil(cy - rr) + jag; yy <= cy + rr; yy++) {
      const t = (yy - cy) / rr;
      let c = t < -0.55 ? BARK[0] : t < 0.1 ? BARK[1] : t < 0.6 ? BARK[2] : BARK[3];
      if ((yy + Math.round(Math.sin(xx / 9) * 1.2)) % 4 === 0 && nz(xx >> 2, yy) > 0.3 && t > -0.7) c = BARK[Math.min(4, BARK.indexOf(c) + 1)];
      if (nz(xx, yy) > 0.95) c = BARK[0];
      put(b, xx, yy, c);
    }
  }
  // a knot and a broken branch stub
  oval(b, x + Math.round(w * 0.36), cy + 1, 2.5, 2, BARK[3]); oval(b, x + Math.round(w * 0.36), cy + 1, 1.2, 1, BARK[4]);
  for (let k = 0; k < 6; k++) rect(b, x + Math.round(w * 0.7) + k, y - 1 - k, 3, 2, k < 4 ? BARK[2] : BARK[1]);
  mossTop(b, x + 2, x + w - 1, y, s + 3, 6);
  // the cut end with its rings
  const ex = x + w - 1;
  oval(b, ex, cy, 2.5, r - 0.5, I('#b98a56')); oval(b, ex, cy, 1.6, r - 2.5, I('#deb47a'));
  for (let yy = cy - r + 3; yy <= cy + r - 3; yy += 3) put(b, ex, yy, I('#8a6038'));
  put(b, ex + 1, cy - 3, I('#f4d8a0'));
  // shelf fungi under the trunk, a fern on top, a vine hanging off it
  for (const [fx, fy, sc] of [[x + 30, cy + 4, 1], [x + w - 34, cy + 2, 0.8]]) {
    for (const [dy, wd, c] of [[-2, 3, '#ffe0a0'], [-1, 5, '#ffb858'], [0, 6, '#f08e38'], [1, 4, '#c8641e']]) { const ww = Math.round(wd * sc); for (let k = -ww; k <= ww; k++) put(b, fx + k, fy + dy, I(c)); }
  }
  for (let k = -3; k <= 3; k++) line(b, x + 24, y, x + 24 + k * 2, y - 6 + Math.abs(k), k % 2 ? LEAF[2] : LEAF[1]);
  vine(b, x + Math.round(w * 0.55), cy + r - 1, 10 + (nz(s, 9) * 8 | 0), s, MOSS[4], [MOSS[1], MOSS[2]]);
  tuft(b, x + 8, GROUND + 2, 3, 5, s + 70); tuft(b, x + w - 8, GROUND + 2, 3, 5, s + 71);
  outline(b);
  return mk(b);
}
const PLATS = new Map();
function plat(pl) {
  let s = PLATS.get(pl);
  if (!s) PLATS.set(pl, s = pl.t === 'log' ? platLog(pl) : platTemple(pl));
  ctx.drawImage(s.img, s.x0, s.y0);
}

// ------------------------------------------------------------ the ground: a grassy lip with flowers over layered earth. Toward
// the camp (x 1620) the turf wears thin: shorter blades, a thinner lip, bare trodden patches of dry earth.
const DRY = P('#e4cc92', '#cfb078', '#aa8a5c');
const wear = x => x < 1490 ? 0 : ss(1490, 1616, x);
// how many rows of turf are left at x (9 = the full lip, 0 = trodden bare): ragged patches that grow toward the camp
const turf = memo(x => { const w = wear(x); return w <= 0 ? 9 : clamp(Math.round((fbm(x / 8, 3, 88) - (w * 0.86 - 0.1)) * 26), 0, 9); });
function bladeH(x) { const a = nz(x, 11); return a < 0.62 ? 1 + (nz(x, 12) * 3.4 | 0) : 0; }
function groundPx(x, y) {
  const d = y - GROUND, w = wear(x), tf = turf(x);
  if (d < 0) { if (tf < 2) return NONE; const h = Math.min(tf < 4 ? 1 : 9, Math.round(bladeH(x) * (1 - w * 0.75))); return -d > h ? NONE : -d === h ? GRASS[0] : GRASS[1]; }
  if (tf === 0) {
    if (d === 0) return nz(x, 91) > 0.7 ? DRY[0] : DRY[1];
    if (d === 1) return nz(x >> 1, 92) > 0.6 ? DRY[1] : DRY[2];
  } else {
    const lip = Math.min(5 + (nz(x >> 1, 77) * 2.4 | 0) + (nz(x, 78) > 0.84 ? 2 : 0), 1 + tf);     // the ragged underside of the turf
    const g1 = lip >= 5 ? 2 : 1, g2 = lip >= 5 ? 4 : lip >= 3 ? 2 : 1;
    if (d < g1) return nz(x, y + 500) > 0.88 ? GRASS[0] : GRASS[d === 0 ? 1 : 2];
    if (d < g2) return nz(x, y + 600) > 0.84 ? GRASS[2] : GRASS[3];
    if (d < lip) return GRASS[4];
    if (d === lip) return EARTH[5];
  }
  // warm earth in wavy strata, a pale clay streak here and there, darker toward the bottom; drier toward the camp
  const wav = Math.sin(x * 0.045 + Math.sin(x * 0.013) * 2) * 2.5 + Math.sin(x * 0.17) * 0.8, sd = d - 4 + wav, band = Math.floor(sd / 9), n = nz(x, y);
  let k = Math.floor(ss(3, 42, d) * 3.3 + (n - 0.5) * 0.9) + (((band % 3) + 3) % 3 === 1 ? 1 : 0);
  if (n > 0.975) k--;
  let c = EARTH[clamp(k, 0, 5)];
  const st = ((Math.round(sd) % 9) + 9) % 9;
  if (st === 0 && nz(x >> 3, band + 40) > 0.35) c = mixI(c, I('#d09a60'), 0.4);
  else if (st === 1 && nz(x >> 3, band + 40) > 0.35) c = mixI(c, EARTH[5], 0.3);
  if (w > 0) c = mixI(c, I('#c2925a'), w * 0.3 * (1 - ss(3, 24, d)));
  return c;
}
function pebble(b, cx, cy, rx, ry, pal) {
  oval(b, cx, cy, rx + 1, ry + 1, I('#2a1a12'));
  const RX = rx + 0.5, RY = ry + 0.5;
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    if (i * i / (RX * RX) + j * j / (RY * RY) > 1) continue;
    const t = i / RX - j / RY;
    put(b, cx + i, cy + j, t > 0.7 ? pal[0] : t < -0.6 ? pal[2] : pal[1]);
  }
}
const CHW = 256, CHY = 220, CHH = H + 8 - CHY;
function groundFeatures(b, x0) {
  const x1 = x0 + CHW;
  // roots reaching down from the turf
  for (let x = x0 - 30; x < x1 + 30; x += 5) {
    if (nz(x, 31) > 0.3) continue;
    let rx = x, ry = GROUND + 7;
    const thick = nz(x, 34) > 0.6;
    for (let i = 0, n = 6 + nz(x, 32) * 16; i < n; i++) {
      put(b, rx, ry, I('#3a2416')); if (thick && i < 8) put(b, rx + 1, ry, I('#a07a50'));
      ry++; const q = nz(x + i * 7, 33); if (q < 0.28) rx--; else if (q > 0.72) rx++;
    }
  }
  // the palms' thick roots
  for (const d of LEVELS[0].decor) {
    if (d.t !== 'palm' || d.x < x0 - 40 || d.x > x1 + 40 || d.x >= AX1) continue;
    for (let k = -1; k <= 1; k++) {
      const sx = d.x + k * 3, ex = d.x + k * (7 + nz(d.x, k + 5) * 6), ey = GROUND + 13 + nz(d.x, k + 8) * 9;
      const r = bez([[sx, GROUND + 4], [sx + k * 2, GROUND + 9], [ex - k * 2, ey - 6], [ex, ey]], 14);
      path(b, r, I('#3a2416'), 2); path(b, r, I('#b08a5c'), 1);
    }
  }
  // stones, and now and then a piece of carved temple stone lost in the earth
  for (let c = Math.floor((x0 - 30) / 26); c * 26 < x1 + 30; c++) {
    const x = c * 26 + (nz(c, 960) * 26 | 0), y = GROUND + 12 + (nz(c, 961) * 24 | 0), rx = 1 + (nz(c, 962) * 3 | 0);
    if (nz(c, 963) > 0.93) {
      rect(b, x - 5, y - 4, 11, 9, I('#2a1a12')); rect(b, x - 4, y - 3, 9, 7, STN[3]); rect(b, x - 4, y - 3, 9, 1, STN[1]); rect(b, x - 4, y + 3, 9, 1, STN[5]);
      rect(b, x - 2, y - 1, 5, 1, STN[5]); rect(b, x - 2, y - 1, 1, 3, STN[5]); rect(b, x - 2, y + 1, 4, 1, STN[5]); put(b, x + 2, y, STN[5]);
    } else pebble(b, x, y, rx, Math.max(1, rx - 1), [I('#c4bcac'), I('#8d8478'), I('#5a5248')]);
  }
  // on the turf: flowers on stems, taller tufts, the odd red mushroom
  for (let c = Math.floor((x0 - 20) / 17); c * 17 < x1 + 20; c++) {
    const x = c * 17 + (nz(c, 970) * 17 | 0), q = nz(c, 971), w = wear(x);
    if (w > 0 && (turf(x) < 5 || nz(c, 977) < w)) { if (turf(x) === 0 && nz(c, 978) > 0.4) { put(b, x, GROUND - 1, I('#b9a888')); put(b, x + 1, GROUND - 1, I('#8d8068')); } continue; }
    if (q < 0.42) {
      const f = FLOWERS[(nz(c, 972) * 4) | 0], h = 3 + (nz(c, 973) * 3 | 0);
      for (let k = 0; k < h; k++) put(b, x, GROUND - 1 - k, GRASS[3]);
      blossom(b, x, GROUND - 1 - h, f[0], f[1], f[2]);
      if (nz(c, 974) > 0.5) put(b, x + 1, GROUND - 2, GRASS[1]);
    } else if (q < 0.7) tuft(b, x, GROUND, 3 + (nz(c, 975) * 3 | 0), 5 + nz(c, 976) * 4, c);
    else if (q > 0.95) {
      rect(b, x, GROUND - 3, 2, 3, I('#f4ead0')); rect(b, x - 2, GROUND - 5, 6, 2, I('#e8403a')); rect(b, x - 1, GROUND - 6, 4, 1, I('#ff7a6a'));
      put(b, x - 1, GROUND - 5, I('#ffffff')); put(b, x + 2, GROUND - 4, I('#ffffff'));
    }
  }
}
function buildChunk(i) {
  const x0 = i * CHW, b = buf(x0, CHY, CHW, CHH);
  for (let lx = 0; lx < CHW; lx++) {
    const x = x0 + lx;
    if (x >= AX1) break;
    for (let y = GROUND - 5; y < CHY + CHH; y++) { const c = groundPx(x, y); if (c !== NONE) b.d[(y - CHY) * CHW + lx] = c; }
  }
  groundFeatures(b, x0);
  for (let lx = 0; lx < CHW; lx++) if (x0 + lx >= AX1) for (let y = 0; y < CHH; y++) b.d[y * CHW + lx] = NONE;     // the ground ends exactly at AX1
  A.chunks[i] = bake(b);
}
function ground(cx) {
  if (!A.ready) return;
  for (let i = Math.max(0, Math.floor((cx - 12) / CHW)); i * CHW < cx + W + 12 && i < A.chunks.length; i++) ctx.drawImage(A.chunks[i], i * CHW, CHY);
}

// ------------------------------------------------------------ decor sprites (local origin: x = the decor's x, y = the ground)
function palmFrond(b, x, y, a, Lf, droop, seed, PL = PALM_LEAF) {
  const steps = Math.ceil(Lf * 1.6);
  for (let i = 1; i <= steps; i++) {
    const s = i / steps, X = x + Math.cos(a) * Lf * s, Y = y + Math.sin(a) * Lf * s + droop * Lf * s * s;
    let tx = Math.cos(a), ty = Math.sin(a) + 2 * droop * s; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
    put(b, X, Y, s < 0.5 ? I('#9a9a44') : PL[3]);
    if (i % 2) continue;
    const ll = (1 - s * 0.7) * 8 * Math.min(1.15, Lf / 18);
    for (const side of [-1, 1]) {
      const r = side * 0.95, dx = tx * Math.cos(r) - ty * Math.sin(r), dy = tx * Math.sin(r) + ty * Math.cos(r) + 0.65, dl = Math.hypot(dx, dy);
      const ux = dx / dl, uy = dy / dl, n = Math.max(1, Math.round(ll * (0.8 + 0.4 * nz(i, side * 7 + seed))));
      const lit = uy < 0.15 || ux > 0.45;
      for (let k = 1; k <= n; k++) put(b, X + ux * k, Y + uy * k, lit ? (k === n && uy < 0 ? PL[0] : PL[1]) : (k > n - 2 ? PL[3] : PL[2]));
    }
  }
}
function palmBuf(hgt, lean, seed) {
  const b = buf(-64, -hgt - 36, 128, hgt + 40);
  const x1 = lean, y1 = -hgt, qx = lean * 0.05 + (nz(seed, 3) - 0.5) * 8, qy = -hgt * 0.55;
  const at = t => [2 * (1 - t) * t * qx + t * t * x1, 2 * (1 - t) * t * qy + t * t * y1];
  const n = Math.ceil(hgt * 2.2);
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = at(t), wd = Math.max(4, Math.round(lerp(7, 4.2, t)));
    const xl = Math.round(x - wd / 2), yy = Math.round(y), ring = ((yy + seed * 7) % 5 + 5) % 5 === 0;
    for (let k = 0; k < wd; k++) put(b, xl + k, yy, ring ? (k === wd - 1 ? PALM_TRUNK[1] : PALM_TRUNK[3]) : k === wd - 1 ? PALM_TRUNK[0] : k === 0 ? PALM_TRUNK[2] : k === 1 ? PALM_TRUNK[2] : PALM_TRUNK[1]);
  }
  rect(b, -5, -2, 11, 3, PALM_TRUNK[2]); put(b, -6, 0, PALM_TRUNK[3]); put(b, 6, 0, PALM_TRUNK[2]);
  const NF = 11, BACK = [PALM_LEAF[1], PALM_LEAF[2], PALM_LEAF[3], PALM_LEAF[4]];
  for (const pass of [0, 1]) for (let f = 0; f < NF; f++) {
    if ((f % 2 === 0) !== (pass === 0)) continue;      // the fronds behind first, in shade
    const a = -Math.PI + 0.1 + (f / (NF - 1)) * (Math.PI - 0.2) + (nz(seed, f + 10) - 0.5) * 0.3;
    const up = Math.abs(a + Math.PI / 2) < 0.5;
    const Lf = (23 + nz(seed, f + 20) * 11) * (up ? 0.7 : 1) * (pass ? 1 : 0.92);
    palmFrond(b, x1, y1 + (pass ? 0 : 1), a, Lf, 0.5 + nz(seed, f + 30) * 0.4 + (up ? 0.25 : 0) - (pass ? 0 : 0.08), seed * 13 + f, pass ? PALM_LEAF : BACK);
  }
  for (let k = 0; k < 3; k++) { const cx = x1 + (k - 1) * 2.8, cy = y1 + 3 + (k % 2); oval(b, cx, cy, 1.6, 1.6, I('#7a5c2a')); put(b, cx + 1, cy - 1, I('#c0a050')); }
  outline(b, PLO);
  return mk(b);
}
function bushBuf(seed, fi) {
  const b = buf(-30, -30, 60, 33), f = [[I('#ff9ad8'), I('#d83a9a'), I('#fff0a0')], [I('#fff08a'), I('#ffb82e'), I('#e8641e')], [I('#ffffff'), I('#ffc2dc'), I('#ffd23f')], [I('#cdb8ff'), I('#8a62e0'), I('#fff0a0')]][fi];
  foliage(b, -3, -11, 22, 11, LEAF, 31 + seed, 3, 5.5);
  foliage(b, 13, -8, 12, 8, LEAF, 37 + seed, 3, 5);
  for (let k = 0; k < 9; k++) {
    const x = Math.round(-20 + nz(seed, 40 + k) * 44), y = Math.round(-20 + nz(seed, 50 + k) * 12), q = LEAF.indexOf(get(b, x, y));
    if (q < 0 || q > 2) continue;
    bigBlossom(b, x, y, f[0], f[1], f[2]);
  }
  tuft(b, -20, 1, 3, 5, seed + 3); tuft(b, 22, 1, 3, 4, seed + 4);
  outline(b, PLO);
  return mk(b);
}
function fernBuf(s, seed) {
  const b = buf(-s - 10, -s - 8, 2 * s + 21, s + 12);
  bigFern(b, -8 + (seed % 3) * 7, 1, s * 0.62, [FERN[1], FERN[2], FERN[3], FERN[4]], seed + 5);
  bigFern(b, 0, 1, s, FERN, seed);
  outline(b, PLO);
  return mk(b);
}
// the mossy stone head of an ancient ruin (the original's statue: 34 wide, 58 tall)
function statueBuf() {
  const b = buf(-26, -70, 52, 74);
  stoneFace(b, -9, -7, 19, 9, 1);                                                      // the neck, sunk in the ground
  stoneFace(b, -14, -50, 29, 44, 2);                                                   // the face
  for (let k = 0; k < 5; k++) { rect(b, -14, -11 + k, k + 1, 1, NONE); rect(b, 14 - k, -11 + k, k + 1, 1, NONE); }   // the jaw tapers
  for (let y = -12; y <= -6; y++) for (let x = -14; x <= 14; x++) {
    if (get(b, x, y) === NONE) continue;
    if (get(b, x - 1, y) === NONE) put(b, x, y, STN[4]); else if (get(b, x + 1, y) === NONE) put(b, x, y, STN[1]);
    if (y === -7 && Math.abs(x) > 9) put(b, x, y, STN[4]);
  }
  rect(b, -9, -6, 19, 1, STN[5]);                                                      // the chin's shadow on the neck
  stoneFace(b, -17, -58, 35, 9, 3); stoneFace(b, -11, -63, 23, 6, 4);                  // the headdress slab and crest
  for (let x = -14; x <= 14; x += 4) rect(b, x, -55, 1, 4, STN[4]);
  frame(b, -3, -62, 7, 5); put(b, 0, -60, I('#58c0a8'));
  // ears with round plugs
  stoneFace(b, -18, -42, 4, 20, 5); stoneFace(b, 15, -42, 4, 20, 6);
  disc(b, -16, -22, 2.4, STN[2]); put(b, -16, -22, STN[5]); disc(b, 17, -22, 2.4, STN[1]); put(b, 17, -22, STN[5]);
  // brow ridge, deep-set eyes, a long nose, a stern mouth
  rect(b, -12, -45, 25, 2, STN[0]); rect(b, -12, -43, 25, 1, STN[5]);
  for (const ex of [-10, 3]) { rect(b, ex, -42, 8, 5, STN[5]); rect(b, ex + 1, -40, 6, 2, STN[3]); rect(b, ex + 2, -40, 3, 2, STN[4]); rect(b, ex, -37, 8, 1, STN[1]); }
  rect(b, -2, -43, 5, 16, STN[1]); rect(b, 2, -43, 1, 16, STN[0]); rect(b, -2, -41, 1, 14, STN[3]);
  rect(b, -4, -28, 9, 3, STN[1]); rect(b, -4, -25, 9, 1, STN[5]); put(b, -3, -26, STN[5]); put(b, 3, -26, STN[5]);
  rect(b, -8, -20, 17, 1, STN[1]); rect(b, -8, -19, 17, 2, STN[5]); rect(b, -7, -17, 15, 1, STN[0]); put(b, -9, -18, STN[5]); put(b, 9, -18, STN[5]);
  for (let x = -6; x <= 6; x += 3) put(b, x, -19, STN[2]);
  rect(b, -3, -13, 7, 1, STN[4]);
  crack(b, 9, -49, 16, 3); crack(b, -8, -34, 12, 4);
  // moss: a cap on the headdress, a patch over one cheek, creeping up from the ground
  mossTop(b, -17, 18, -58, 7, 12); mossTop(b, -11, 12, -63, 8, 3);
  for (let y = -34; y < -12; y++) for (let x = -14; x < -3; x++) if (get(b, x, y) !== NONE && fbm(x / 4, y / 5, 61) > 0.52) put(b, x, y, fbm(x / 2, y / 3, 62) > 0.5 ? MOSS[2] : MOSS[3]);
  for (let y = -12; y <= 1; y++) for (let x = -13; x <= 13; x++) if (get(b, x, y) !== NONE && fbm(x / 4, y / 3, 63) > 0.42 + (0 - y) * 0.02) put(b, x, y, fbm(x / 2, y / 3, 64) > 0.5 ? MOSS[2] : MOSS[3]);
  vine(b, 15, -56, 30, 3, MOSS[4], [MOSS[1], MOSS[2]], [I('#ffc2dc'), I('#ff7aa8')]);
  tuft(b, -15, 1, 4, 7, 21); tuft(b, 14, 1, 3, 6, 22); tuft(b, 2, 1, 3, 4, 23);
  outline(b, STO);
  return mk(b);
}
// a broken temple pillar of carved drums with a stretch of fallen wall beside it (v: 0 or 1, mirrored layout). It is
// scenery, not a step: paler and cooler than the platforms, a soft outline, dull moss.
function ruinBuf(v) {
  const b = buf(-34, -70, 76, 74), m = v ? -1 : 1;
  // the wall remnant stepping down away from the pillar
  const WALL = [[9, 11, 17, 11], [20, 9, 10, 12]];
  for (const [dx, wd, hh, sd] of WALL) {
    const x0 = m > 0 ? dx : -dx - wd + 1;
    for (let yb = 0, k = 0; yb < hh; yb += 6, k++) stoneFace(b, x0, -Math.min(hh, yb + 6), wd, Math.min(6, hh - yb), sd + k);
    mossDull(b, x0, x0 + wd, -hh, 50 + dx);
  }
  // the pillar: stacked carved drums on a plinth, the top one broken off at a slant, a capital ring under the break
  const hgt = v ? 44 : 54;
  for (let yb = 3, k = 0; yb < hgt; yb += 13, k++) {
    const hh = Math.min(13, hgt - yb);
    stoneFace(b, -7, -yb - hh, 15, hh, 20 + k + v * 5);
    if (hh >= 12) carve(b, -4, -yb - hh + 2, GLYPHS_T[(k + v) % 4]);
  }
  stoneFace(b, -9, -4, 19, 4, 27);                                                      // the plinth
  for (let x = -7; x <= 7; x++) { const cut = Math.round((m > 0 ? 7 - x : x + 7) * 0.55 + nz(x, 88 + v) * 2.4); for (let k = 0; k < cut; k++) put(b, x, -hgt + k, NONE); }
  for (let x = -7; x <= 7; x++) { let y = -hgt; while (y < 0 && get(b, x, y) === NONE) y++; put(b, x, y, STN[0]); if (nz(x, 90 + v) > 0.35) { put(b, x, y, MOSS[3]); put(b, x, y + 1, MOSS[4]); } }
  crack(b, 3, -hgt + 12, 18, 31 + v);
  // a fallen drum on the other side, rubble
  const fx = m > 0 ? -21 : 12;
  stoneFace(b, fx, -8, 10, 8, 41 + v); put(b, fx, -8, NONE); put(b, fx + 9, -8, NONE);
  mossDull(b, fx + 1, fx + 9, -8, 43);
  for (const [dx, r] of [[m * 31, 2], [m * 35, 1.5], [m * -26, 1.5]]) { oval(b, dx, -r + 1, r, r * 0.8, STN[2]); put(b, dx, Math.round(-r * 1.6 + 1), STN[0]); }
  hazeRows(b, I('#cfe2cc'), () => 0.3);
  // a fern growing out of the break, a vine winding round the drums
  bigFern(b, m * -2, -hgt + 6, 8, [LEAF[1], LEAF[2], LEAF[3], LEAF[4]], 3);
  const wind = bez([[-8, -8], [12, -18], [-12, -30], [8, -42]], 34);
  path(b, wind, MOSS[4], 1);
  wind.forEach(([x, y], i) => { if (i % 4 === 1 && get(b, x, y - 1) !== NONE) { put(b, x, y - 1, MOSS[2]); put(b, x + 1, y - 1, MOSS[3]); } });
  tuft(b, m * 15, 1, 4, 6, 44); tuft(b, m * -14, 1, 3, 5, 45); tuft(b, m * 29, 1, 3, 4, 46);
  outline(b, I('#5a6052'));
  return mk(b);
}
// which sprite each decor entry gets: neighbours never share one (set up by the decor step, in level order)
const PICK = new Map();
const PALM_SEQ = [0, 3, 1, 4, 5, 1, 2, 3, 0, 5], BUSH_SEQ = [0, 1, 2, 3, 1, 0, 2, 1, 3, 0], FERN_SEQ = [0, 1, 2, 1, 0, 2, 1, 0];
let DEC = [];
function pickDecor() {
  DEC = L1ART.decor ? L1ART.decor('jungle') : LEVELS[0].decor.filter(d => d.x < AX1 && (d.t === 'palm' || d.t === 'bush' || d.t === 'fern' || d.t === 'statue' || d.t === 'ruin'));
  const n = { palm: 0, bush: 0, fern: 0, ruin: 0 };
  for (const d of DEC) {
    if (d.t === 'palm') PICK.set(d, A.palms[PALM_SEQ[n.palm++ % PALM_SEQ.length]]);
    else if (d.t === 'bush') PICK.set(d, A.bushes[BUSH_SEQ[n.bush++ % BUSH_SEQ.length]]);
    else if (d.t === 'fern') PICK.set(d, A.ferns[FERN_SEQ[n.fern++ % FERN_SEQ.length]]);
    else if (d.t === 'ruin') PICK.set(d, A.ruins[n.ruin++ % 2]);
    else if (d.t === 'statue') PICK.set(d, A.statue);
  }
}
// butterflies fluttering round the flowers (world space, behind the action)
const FLY = (() => {
  const mkf = pal => [
    makeSprite(['aa...aa', 'aaa.aaa', '.aakaa.', '.bbkbb.', '.bb.bb.'], pal),
    makeSprite(['.a...a.', '.aa.aa.', '..aka..', '..bkb..', '..b.b..'], pal),
    makeSprite(['...a...', '...aa..', '...ka..', '...kb..', '...b...'], pal)];
  return [mkf({ a: '#ffb02e', b: '#e8641e', k: '#3a2010' }), mkf({ a: '#ffa8dc', b: '#e052a0', k: '#4a1838' }), mkf({ a: '#7ad0ff', b: '#2f8fe8', k: '#16305a' })];
})();
function butterflies(cx) {
  for (let i = Math.floor((cx - 40) / 150); i * 150 < cx + W + 40; i++) {
    if (i < 0 || hsh(i * 3.3 + 1) < 0.25) continue;
    const bx = i * 150 + hsh(i * 7.1) * 110;
    if (bx > AX1 - 60) continue;
    const t = G.t + i * 53, x = bx + Math.sin(t * 0.031) * 16 + Math.sin(t * 0.083 + i) * 5, y = GROUND - 26 - hsh(i * 2.9) * 22 + Math.sin(t * 0.057 + i * 2) * 7;
    const f = FLY[i % 3][[0, 1, 2, 1][Math.floor(t / 4) % 4]];
    ctx.drawImage(f.img, Math.round(x) - 3, Math.round(y) - 2);
  }
}
// how much of the sky is still the jungle's for camera cx (it crossfades into the camp's, as level1_art.js does it)
const skyK = cx => 1 - clamp((cx + W / 2 - 1450) / 300, 0, 1);
function behind(cx) {
  if (!A.ready) return;
  for (const d of DEC) {
    if (d.x < cx - 90 || d.x > cx + W + 90) continue;
    const s = PICK.get(d);
    if (!s) continue;
    if (d.t === 'palm') swayBlit(s, d.x, GROUND + 1, sway(d.x * 0.01, 2.2), 3);
    else blitS(s, d.x, d.t === 'fern' ? GROUND + 1 : GROUND);
  }
  // the light shafts fall across the decor too (not the ground, the platforms or the characters)
  const off = offOf(A.tall, cx), k = skyK(cx);
  if (off < A.tall.w && k > 0) {
    const ga = ctx.globalAlpha, sw = Math.min(W + 20, A.tall.w - off);
    ctx.globalAlpha = ga * 0.32 * k; ctx.drawImage(A.shaft, off, 0, sw, H, cx - 10, 0, sw, H); ctx.globalAlpha = ga;
  }
  butterflies(cx);
}

// ------------------------------------------------------------ the foreground: dark leafy plants along the bottom edge (p 1.3)
const DARKL = P('#4a8a4c', '#31693a', '#214f2c', '#15381f');
function frontBuf(v) {
  const b = buf(-46, -44, 92, 48);
  if (v === 0) {
    bigLeaf(b, -2, 2, -1.75, 34, 11, 0.3, DARKL, 22, true);
    bigLeaf(b, -8, 4, -2.5, 30, 9, 0.34, DARKL, 21, false);
    bigLeaf(b, 6, 4, -0.8, 30, 9, 0.36, DARKL, 23, true);
  } else if (v === 1) {
    bigFern(b, -15, 6, 19, [DARKL[1], DARKL[2], DARKL[3], DARKL[3]], 41);
    bigFern(b, 16, 6, 17, [DARKL[1], DARKL[2], DARKL[3], DARKL[3]], 42);
    bigFern(b, 0, 5, 30, DARKL, 40);
  } else {
    paddle(b, 4, 4, -1.2, 34, 7, 0.22, DARKL, 31); paddle(b, -2, 4, -2.2, 28, 6, 0.3, DARKL, 33);
    bigFern(b, -22, 6, 15, DARKL, 43); bigFern(b, 25, 6, 14, [DARKL[1], DARKL[2], DARKL[3], DARKL[3]], 44);
    for (let k = 0; k < 16; k++) put(b, -9 - (k > 8 ? 1 : 0), 3 - k, DARKL[2]);                     // a flower spike
    for (let k = 0; k < 4; k++) { const y = -13 + k * 3, sd = k % 2 ? 1 : -1; for (let j = 0; j < 4 - (k < 1 ? 1 : 0); j++) { put(b, -10 + sd * (j + 1), y - (j >> 1), I('#ff8a2a')); put(b, -10 + sd * (j + 1), y + 1 - (j >> 1), I('#d8501a')); } put(b, -10 + sd * 4, y - 2, I('#ffd23f')); }
  }
  outline(b, I('#0c1a10'));
  return mk(b);
}
// the plants stand in the same slots as the original's (one every 90 px at parallax 1.3, about two in three taken);
// none in front of the last stretch before the camp, where the ground is worn bare
function front(cx) {
  if (!A.ready) return;
  const off = cx * 1.3, sp = 90;
  for (let i = Math.floor((off - 80) / sp); i * sp - off < W + 80; i++) {
    if (hsh(i + 3) < 0.35) continue;
    const x = Math.round(i * sp + hsh(i) * 40 - off);
    if (cx + x >= AX1 - 70) continue;
    blitS(A.front[Math.floor(hsh(i * 1.7 + 7) * 3)], x, H);
  }
  // pollen drifting in the light
  for (let i = 0; i < 26; i++) {
    const t = G.t + i * 211, x = Math.round(wrap(hsh(i * 3.7) * 700 + Math.sin(t * 0.007 + i) * 30 - t * 0.05 - cx * 0.5, W + 40) - 20);
    const y = Math.round(44 + hsh(i * 9.1) * 170 + Math.sin(t * 0.011 + i * 2) * 12);
    if (cx + x >= AX1 - 30) continue;
    const tw = Math.sin(t * 0.09 + i) > 0.2;
    ctx.fillStyle = tw ? 'rgba(255,250,214,0.95)' : 'rgba(255,246,196,0.45)'; ctx.fillRect(x, y, 1, 1);
    if (tw && i % 5 === 0) { ctx.fillStyle = 'rgba(255,250,214,0.35)'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  }
}

// ============================================================
// Bake steps (run once, in order, by level1_art.js before anything above is drawn). Each paints one piece.
// ============================================================
const STEPS = [];
const S = {};                          // the strips being painted
STEPS.push(function sky() {
  A.sky = paintSky(); A.sun = sunCanvas(); A.disc = sunDisc(); A.bloom = bloomCanvas();
  // the wide warm glow is painted into the sky once, round the middle of the sun's short path (the halo, the disc,
  // the rays and the bloom follow the sun itself)
  A.sky.getContext('2d').drawImage(glowCanvas(), GLOW.x + 10 - GLOW.rx, GLOW.y + 10 - GLOW.ry);
});
STEPS.push(function raysClouds() {
  A.rays = [rayCanvas(1), rayCanvas(2)];
  A.clouds = CLOUDS.map((c, i) => cloudCanvas(c[0], i + 3, CLOUD_PAL, 1));
  A.vines = [96, 70, 118].map((len, i) => { const b = buf(-6, 0, 13, len + 3); vine(b, 0, 0, len, i * 5 + 2, GC[3], [GC[1], GC[2]], i === 1 ? ORCH : null); return mk(b); });
});
STEPS.push(function hillsFar() { S.hills = newStrip(0.05, 64, 170); paintHills(S.hills.b, S.hills.X1); });
STEPS.push(function hillsNear() { paintHillsNear(S.hills.b, S.hills.X1); bakeStrip(S.hills); A.hills = S.hills; S.hills = null; });
STEPS.push(function farBand() { S.far = newStrip(0.12, 90, H); paintFar(S.far.b, S.far.X1); });
STEPS.push(function farRows() { paintFarRows(S.far.b, S.far.X1); });
STEPS.push(function farBake() { hazeRows(S.far.b, MIST, y => 0.1 + ss(130, 205, y) * 0.5); bakeStrip(S.far); A.far = S.far; S.far = null; });
STEPS.push(function midBackRow() { S.mid = newStrip(0.25, 110, H); midBack(S.mid.b, S.mid.X1); });
for (let k = 0; k < 6; k++) STEPS.push(function midTopRow() { const X1 = S.mid.X1 + 20; midCrowns(S.mid.b, -20 + (X1 + 20) * k / 6, -20 + (X1 + 20) * (k + 1) / 6); });
for (let row = 0; row < 5; row++) STEPS.push(function midRows() { midRow(S.mid.b, S.mid.X1, row); });
STEPS.push(function midBake() { hazeRows(S.mid.b, MIST, y => 0.03 + ss(168, 234, y) * 0.55); bakeStrip(S.mid); A.mid = S.mid; S.mid = null; });
STEPS.push(function nearTrunks() { S.near = newStrip(0.42, 70, H); nearBack(S.near.b, S.near.X1); });
for (let k = 0; k < 7; k++) STEPS.push(function nearCrown() { nearCrowns(S.near.b, S.near.X1, k, k === 6 ? 99 : k + 1); });
STEPS.push(function nearPlants() { nearFront(S.near.b, S.near.X1); });
STEPS.push(function nearGround() { nearFloor(S.near.b, S.near.X1); });
STEPS.push(function nearBake() { hazeRows(S.near.b, MIST, y => 0.05 + ss(160, 232, y) * 0.4); bakeStrip(S.near); A.near = S.near; S.near = null; });
TREES.forEach((T, gi) => {
  STEPS.push(function tallTrunk() {
    if (!S.tall) S.tall = newStrip(0.6, -2, H, TALL_W);
    (T.slim ? paintSlender : giantTrunk)(S.tall.b, T, gi);
  });
  if (!T.slim) { STEPS.push(function tallCrown() { giantCrown(S.tall.b, T, gi); }); STEPS.push(function tallLobes() { giantLobes(S.tall.b, T, gi); }); }
});
STEPS.push(function tallBake() { hazeRows(S.tall.b, MIST, y => 0.03 + ss(150, 236, y) * 0.34); bakeStrip(S.tall); A.tall = S.tall; S.tall = null; });
STEPS.push(function shafts() { A.shaft = shaftCanvas(A.tall.w); });
for (const pl of LEVELS[0].plats) if (pl.x >= AX0 && pl.x < AX1) STEPS.push(function platform() { PLATS.set(pl, pl.t === 'log' ? platLog(pl) : platTemple(pl)); });
const PALMS = [[92, 10, 1], [84, -9, 2], [100, 14, 3], [88, 6, 4], [96, -12, 5], [80, 4, 6]];
A.palms = [];
for (let k = 0; k < 2; k++) STEPS.push(function palms() { for (let i = k * 3; i < k * 3 + 3; i++) A.palms[i] = palmBuf(PALMS[i][0], PALMS[i][1], PALMS[i][2]); });
STEPS.push(function bushes() { A.bushes = [0, 1, 2, 3].map(s => bushBuf(s * 11, s)); });
STEPS.push(function ferns() { A.ferns = [22, 25, 20].map((s, i) => fernBuf(s, i)); });
STEPS.push(function frontPlants() { A.front = [0, 1, 2].map(frontBuf); });
STEPS.push(function stones() { A.statue = statueBuf(); A.ruins = [ruinBuf(0), ruinBuf(1)]; pickDecor(); });
A.chunks = [];
for (let i = 0; i * CHW < AX1; i++) STEPS.push(function groundChunk() { buildChunk(i); });
STEPS.push(function done() { A.ready = true; });

L1ART.jungle = { x0: AX0, x1: AX1, steps: STEPS, bg, behind, ground, plat, front };
}
