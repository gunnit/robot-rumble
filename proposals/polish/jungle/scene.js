'use strict';
// ============================================================
// Mission 1 repaint mock: AREA 1: THE JUNGLE (world x 0..1620). A harness fixture, NOT game content yet: loaded with
// --extra after the game, it replaces the draw hooks of LEVELS[0] for the jungle and falls back to the original
// drawing for the rest of the mission. Painted the Mission 2 / Mission 3 way: static art is painted pixel by pixel
// into buffers and baked once on first use (crisp edges, no anti-aliasing), parallax strips behind the world, 1px
// OUT outlines on the things you can stand on (decor gets a softer outline), small live touches driven by G.t.
// No Math.random / rand in the drawing: textures come from a private mulberry32 table (nz), motion from G.t and
// hsh, so the same camera and frame count give the same picture. No canvases are made per frame.
//   H=/Users/macbookair/game/tools/harness
//   node $H/harness.mjs render --level 1 --x 1000 --frames 180 --god --scale 3 \
//     --extra /Users/macbookair/game/proposals/polish/jungle/scene.js --out /Users/macbookair/game/proposals/polish/jungle/jungle.png
// Reusable area scenery (any camera in the jungle, also the menus that scroll Mission 1's scenery):
//   jungleBG(g, cx)   sky, sun, clouds, hills + far pyramid, far / mid / near canopy strips, light shafts, the giants
//   jungleDecor(cx)   statue, ruins, palms (swaying), bushes, ferns, butterflies       (world space, L.decor entries)
//   jungleGround(cx)  grass lip, flowers, layered earth, stones, roots                 (world space, 256 px chunks)
//   junglePlat(pl)    'rock' -> carved temple block, 'log' -> fallen log on stumps      (world space, cached per plat)
//   jungleFront(cx)   dark foreground plants, pollen                                    (screen space)
// The staged moment at the end (hero, robots, shots, HELP!) is only pinned when the level is built at the mock camera.
// ============================================================
{
const L = LEVELS[0];
const A_END = 1620;                   // the jungle's grass ground ends here (the camp's sand begins)
const FADE0 = 1450, FADE1 = 1750;     // camera centre: all jungle before FADE0, all camp after FADE1 (as level1.js)
const CAM1 = FADE1 - W / 2;           // the last camera x that still shows any jungle backdrop
const MOCK_CAM = 798.4;               // devStart x 1000 builds the level at this camera x

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
// mix every painted pixel toward colour c by k(x, y): haze and mist
function hazeB(b, c, k) {
  for (let r = 0; r < b.h; r++) for (let q = 0; q < b.w; q++) {
    const i = r * b.w + q, v = b.d[i];
    if (v === NONE) continue;
    const m = k(q + b.x0, r + b.y0);
    if (m > 0) b.d[i] = mixI(v, c, m);
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
// Backdrop strips. A strip is painted in screen coordinates at camera x 0 (x from -10) and is wide enough for its
// parallax p over the jungle's camera range 0..CAM1.
// ============================================================
function strip(p, top, bot, fn) {
  const w = W + 22 + Math.ceil(CAM1 * p), b = buf(-10, top, w, bot - top);
  fn(b, w - 10);
  return { p, top, h: bot - top, w, c: bake(b) };
}
const offOf = (S, cx) => clamp(Math.round(cx * S.p), 0, S.w - W - 20);
function blitStrip(g, S, cx) { g.drawImage(S.c, offOf(S, cx), 0, W + 20, S.h, -10, S.top, W + 20, S.h); }

// ------------------------------------------------------------ the morning sky: dithered bands, a warm glow round the sun
const SUN = { x: 356, y: 66 };
const SKY = [[-10, '#2f7ed2'], [24, '#4794de'], [54, '#6fb3ea'], [82, '#9bd0f0'], [106, '#c6e7ee'], [128, '#e6f4dc'], [156, '#f6f4cc'], [180, '#f8f2c4']];
function skyAt(y) {
  let i = 0;
  while (i + 1 < SKY.length && SKY[i + 1][0] <= y) i++;
  const a = SKY[i], c = SKY[Math.min(i + 1, SKY.length - 1)];
  return mixI(I(a[1]), I(c[1]), c[0] > a[0] ? (y - a[0]) / (c[0] - a[0]) : 0);
}
function paintSky() {
  const b = buf(-10, -10, W + 20, H + 20), N = 30, pal = [], WARM = I('#fff6d2');
  for (let i = 0; i < N; i++) pal.push(skyAt(-10 + i / (N - 1) * 190));
  for (let y = -10; y < H + 10; y++) for (let x = -10; x < W + 10; x++) {
    const g = Math.max(0, 1 - Math.hypot((x - SUN.x) * 0.75, y - SUN.y) / 170);
    put(b, x, y, mixI(ramp(pal, (y + 10) / 190, x, y), WARM, g * g * 0.62));
  }
  return bake(b);
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
const ridgeA = x => 104 - 24 * fbm(x / 110, 0, 5) - 9 * Math.max(0, Math.sin(x / 140 + 0.6));
const ridgeB = x => 119 - 16 * fbm(x / 70, 0, 9) - 5 * Math.sin(x / 95 + 2);
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
  hazeB(b, MIST, (x, y) => ss(106, 152, y) * 0.5);
}

// ------------------------------------------------------------ the far canopy (p 0.12): a pale band of crowns, emergent trees, palms
const farTop = x => 124 + 9 * fbm(x / 26, 0.5, 21) + 3 * Math.sin(x / 31 + 1);
function paintFar(b, X1) {
  for (let x = -16; x < X1 + 8; x += 4) { const r = 3 + nz(x + 4096, 3) * 8, y = farTop(x) + r * 0.6; oval(b, x, y, r + 1, r * 0.85, FC[2]); }
  for (let x = -10; x < X1; x++) rect(b, x, Math.round(farTop(x)) + 5, 1, H, FC[2]);
  for (let x = -16; x < X1 + 8; x += 4) { const r = 3 + nz(x + 4096, 3) * 8, y = farTop(x) + r * 0.6; if (r > 4) oval(b, x + 1, y - 2, r - 2.5, r * 0.85 - 3, FC[1]); if (r > 7) oval(b, x + 2, y - 3, r - 5, 1.2, FC[0]); }
  // emergent giants with umbrella crowns
  for (let x = 44, i = 0; x < X1 + 20; x += 96 + Math.round(nz(i, 77) * 100), i++) {
    const h = 20 + nz(i, 78) * 16, w = 16 + nz(i, 79) * 10, top = farTop(x) - h;
    rect(b, x, top + 3, 2, h, FC[3]);
    for (let k = -2; k <= 2; k++) oval(b, x + k * w * 0.22, top + Math.abs(k) * 1.5, w * 0.3, 3.2, FC[2]);
    for (let k = -2; k <= 2; k++) oval(b, x + k * w * 0.22 + 1, top - 1 + Math.abs(k) * 1.5, w * 0.22, 1.6, FC[1]);
    put(b, x + w * 0.3, top - 2, FC[0]); put(b, x + w * 0.3 + 1, top - 2, FC[0]);
  }
  for (let x = 84, i = 0; x < X1 + 10; x += 40 + Math.round(nz(i, 80) * 80), i++) jpalm(b, x, farTop(x) + 4, 17 + nz(i, 81) * 12, (nz(i, 82) - 0.5) * 12, [FC[0], FC[2], FC[3], FC[3]], x);
  // two more rows of crowns further down the slope, so the band behind the playfield isn't flat
  for (const [dy, sd, a, bb] of [[20, 31, 2, 3], [40, 37, 2, 3]]) {
    for (let x = -14; x < X1 + 10; x += 5) {
      const r = 3.5 + nz(x + 4096, sd) * 6, y = farTop(x * 1.3 + sd) + dy + nz(x + 4096, sd + 1) * 8;
      oval(b, x, y + 1, r + 1, r * 0.8, FC[bb]); oval(b, x, y, r, r * 0.75, FC[a]); oval(b, x + 1, y - 1.5, Math.max(0.5, r - 2.2), Math.max(0.5, r * 0.7 - 2), FC[1]);
    }
  }
  hazeB(b, MIST, (x, y) => 0.1 + ss(130, 205, y) * 0.5);
}

// ------------------------------------------------------------ the mid canopy (p 0.25): a sunlit row of big round crowns
const midTop = x => 150 + 11 * fbm(x / 40, 0.5, 51) + 4 * Math.sin(x / 53);
function paintMid(b, X1) {
  for (let x = -10; x < X1; x++) rect(b, x, Math.round(midTop(x)) + 9, 1, H, MC[2]);
  // a few taller trees standing out of the row, some in blossom, and palms leaning over it
  const BLOOM = [['#ffd27a', '#ff9a3c'], ['#ffc4e2', '#f070a8'], ['#fff6c8', '#ffd84a']];
  for (let x = 70, i = 0; x < X1 + 30; x += 110 + Math.round(nz(i, 131) * 90), i++) {
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
  for (let x = -20; x < X1 + 20; x += 13) {
    const xx = x + nz(x + 4096, 139) * 6, r = 13 + nz(x + 4096, 140) * 6;
    foliage(b, xx, midTop(xx) + 9, r, r * 0.62, MC, x * 3 + 11, 3, 6);
  }
  // the body of the row: more crowns stepping down behind the playfield, each one lit on top with a shaded foot
  [[15, 61, 0], [29, 67, 0.15], [43, 71, 0.35], [57, 73, 0.55], [71, 79, 0.7]].forEach(([dy, sd, soft], row) => {
    const RIM = mixI(MC[3], MC[2], soft);
    for (let x = -16, i = 0; x < X1 + 12; x += 5 + Math.round(nz(i, sd + 6) * 10), i++) {
      const r = 6 + nz(i, sd + 1) * 9, y = midTop(x * 1.2 + sd * 9) + dy + 9 + (nz(i, sd + 2) - 0.5) * 12;
      oval(b, x, y + 1, r + 1, r * 0.7 + 1, RIM);
      oval(b, x, y, r, r * 0.7, MC[2]);
      oval(b, x + r * 0.15, y - r * 0.22, r * 0.72, r * 0.4, MC[1]);
      if (nz(i, sd + 3) > 0.45) oval(b, x + r * 0.3, y - r * 0.42, r * 0.3, Math.max(0.5, r * 0.14), MC[0]);
      for (let k = 0; k < 3; k++) { const lx = x + (nz(i * 3 + k, sd + 4) - 0.5) * r * 1.6, ly = y + (nz(i * 3 + k, sd + 5) - 0.3) * r * 0.8; if (get(b, lx, ly) === MC[2]) { put(b, lx, ly, RIM); put(b, lx + 1, ly + 1, RIM); } }
    }
    // banana plants and young palms break the row up
    if (row > 0 && row < 4) for (let x = 30 + row * 37, i = 0; x < X1 + 20; x += 120 + Math.round(nz(i, sd + 8) * 150), i++) {
      const base = midTop(x * 1.2 + sd * 9) + dy + 22, q = nz(i, sd + 9);
      if (q < 0.5) { for (const a of [-2.45, -1.85, -1.2, -0.6]) paddle(b, x, base - 8, a, 13 + nz(i, sd + 10) * 5, 3.2, 0.28, MC, x + a * 7); }
      else jpalm(b, x, base, 16 + nz(i, sd + 11) * 8, (nz(i, sd + 12) - 0.5) * 10, [MC[0], MC[1], RIM, RIM], x + 9);
    }
  });
  hazeB(b, MIST, (x, y) => 0.03 + ss(168, 234, y) * 0.55);
}

// ------------------------------------------------------------ the near understory (p 0.42): trees with lianas, banana plants,
// tree ferns, undergrowth along the back of the world
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
const BG_RUINS = [[150, 1], [395, 0], [905, 1], [1090, 0]];
function paintNear(b, X1) {
  for (const [x, k] of BG_RUINS) (k ? bgSteps : bgGate)(b, x, 226);
  const trees = [];
  for (let x = 40, i = 0; x < X1 + 40; x += 104 + Math.round(nz(i, 91) * 84), i++) trees.push([x, 6 + Math.round(nz(i, 92) * 3), i]);
  for (const [x, w, i] of trees) {
    const fy = Math.round(112 + nz(i, 93) * 22);
    trunkCol(b, x, w, fy, 230, NT, x, 30);
    for (let k = 0; k < 2; k++) { const lx = x + (k ? w + 3 : -w - 2), len = 50 + nz(x, k) * 70; for (let y = fy + 6; y < fy + 6 + len; y++) put(b, lx + Math.round(Math.sin(y / 13 + k + x) * 2), y, k ? NR[3] : NT[3]); }
  }
  const BLOOM = [['#ffb060', '#f2742a'], ['#ffb8d8', '#e8609a']];
  for (const [x, , i] of trees) {
    const fy = 112 + nz(i, 93) * 22, rx = 26 + nz(i, 94) * 12, ry = 14 + nz(i, 95) * 6;
    for (const sd of [-1, 1]) {
      const ex = x + sd * (20 + nz(i, 98 + sd) * 14), ey = fy + 16 + nz(i, 99 + sd) * 12, y0 = ey + 16 + nz(i, 104 + sd) * 10;
      const br = bez([[x, y0], [x + sd * 5, y0 - 8], [ex - sd * 6, ey + 8], [ex, ey]], 16);
      path(b, br, NT[2], 2); path(b, br.map(([px, py]) => [px + 1, py]), NT[1], 1);
      foliage(b, ex, ey - 2, 12 + nz(i, 100 + sd) * 7, 7 + nz(i, 101 + sd) * 3, NR, x * 13 + 5 + sd, 3, 6);
    }
    foliage(b, x + (nz(i, 96) - 0.5) * 12, fy, rx, ry, NR, x * 11 + 7, 3, 6.5);
    if (nz(i, 97) > 0.45) { const by = fy + 44 + nz(i, 105) * 30; for (let k = -3; k <= 3; k++) line(b, x, by, x + k * 2.4, by - 7 + Math.abs(k) * 1.6, k % 2 ? NR[2] : NR[1]); put(b, x, by - 8, I('#ff8a5a')); put(b, x, by - 9, I('#ffc08a')); }
    if (nz(i, 102) > 0.6) {
      const [c0, c1] = BLOOM[nz(i, 103) > 0.5 ? 1 : 0];
      for (let j = 0; j < 46; j++) {
        const px = x + (nz(j, i * 31) - 0.5) * 2 * rx, py = fy + (nz(j, i * 31 + 1) - 0.65) * 2 * ry, q = NR.indexOf(get(b, px, py));
        if (q < 0 || q > 1) continue;
        put(b, px, py, I(c1)); put(b, px + 1, py, I(c1)); put(b, px, py - 1, I(c0)); if (nz(j, i) > 0.5) put(b, px + 1, py - 1, I(c0));
      }
    }
  }
  for (let x = 84, i = 0; x < X1 + 20; x += 90 + Math.round(nz(i, 111) * 90), i++) {   // banana plants
    const base = 218 + Math.round(nz(i, 112) * 4), s = 16 + nz(i, 113) * 6;
    rect(b, x - 1, base - s, 3, s, NR[3]);
    paddle(b, x, base - s, -2.5, s * 1.15, 3.6, 0.25, NR, x);
    paddle(b, x, base - s, -1.9, s * 1.3, 4, 0.18, NR, x + 1);
    paddle(b, x, base - s, -0.95, s * 1.25, 3.8, 0.2, NR, x + 2);
    paddle(b, x, base - s, -0.3, s * 1.05, 3.4, 0.32, NR, x + 3);
  }
  for (let x = 150, i = 0; x < X1 + 20; x += 130 + Math.round(nz(i, 121) * 110), i++) {   // tree ferns
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
  for (let x = -14; x < X1 + 14; x += 3) {   // undergrowth along the back of the world
    const r = 3 + nz(x + 4096, 71) * 5 * (fbm(x / 30, 0, 72) + 0.4), y = 219 - r * 0.4 + nz(x + 4096, 73) * 4;
    oval(b, x, y, r, r * 0.8, NR[2]); oval(b, x + 0.6, y - 1.2, r - 1.3, r * 0.8 - 1.3, NR[1]);
    if (nz(x + 4096, 74) > 0.75) put(b, x + 1, y - r + 1, NR[0]);
  }
  rect(b, -10, 221, X1 + 10, H - 221, NR[2]);
  for (let x = 6; x < X1; x += 16 + Math.round(nz(x, 75) * 22)) fern(b, x, 222, 6 + nz(x, 76) * 5, NR);
  hazeB(b, MIST, (x, y) => 0.05 + ss(160, 232, y) * 0.4);
}

// ------------------------------------------------------------ the giants (p 0.6): tall buttressed trunks wrapped in lianas, their
// dark crowns closing over the top of the screen, sky between them, vines and backlit fronds hanging into the gaps
const GIANT_X = [10, 296, 597, 927, 1214, 1486];
const PERCH = [];                      // where a toucan sits: [strip x, y] on a giant's side branch
function paintGiants(b, X1) {
  const FIG = P('#cfc696', '#a8a078', '#84805e'), ORCH = P('#ffb0dc', '#e052a0', '#fff0a0');
  GIANT_X.forEach((gx, gi) => {
    const s = gi * 17 + 3, w = 13 + (nz(gi, 201) * 4 | 0), side = gi % 2 ? -1 : 1;
    // the trunk
    for (let y = -2; y <= GROUND; y++) {
      const fl = ss(186, GROUND, y), hw = w / 2 + fl * fl * 12, cx = gx + Math.sin(y / 41 + s) * 2;
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const u = (x - (cx - hw)) / (2 * hw);     // 0 = left (shade) .. 1 = right (sun)
        let k = u > 0.86 ? 0 : u > 0.55 ? 1 : u > 0.2 ? 2 : 3;
        const fur = Math.sin(x * 1.3 + Math.sin(y / 11 + x) * 1.5);
        if (fur > 0.8 && u < 0.9) k = Math.min(4, k + 1);
        if (nz(x + 70, y + 300) > 0.95) k = Math.max(0, k - 1);
        let c = GB[k];
        if (u < 0.55 && fbm(x / 6, y / 10, 52 + s) > 0.6) c = fbm(x / 3, y / 4, 53) > 0.5 ? GM[0] : GM[1];
        put(b, x, y, c);
      }
    }
    // buttress roots fanning out at the foot
    for (const [dx, h] of [[-1, 36], [1, 32], [-1, 18], [1, 22]]) {
      const x0 = gx + dx * (w / 2 - 2), x1 = gx + dx * (w / 2 + 16 + h * 0.3), n = Math.abs(x1 - x0);
      for (let i = 0; i <= n; i++) {
        const x = x0 + dx * i, t = i / n, top = Math.round(GROUND - h * (1 - t) * (1 - t));
        for (let y = top; y <= GROUND; y++) put(b, x, y, y === top ? GB[dx > 0 ? 0 : 1] : (dx > 0 ? GB[1] : GB[3]));
      }
    }
    // a strangler fig: pale ribbons wrapping the trunk
    for (const c of [[[gx - w / 2, 60], [gx + w / 2 + 4, 80], [gx - w / 2 - 2, 110], [gx + w / 2, 140]], [[gx + w / 2, 150], [gx - w / 2 - 4, 170], [gx + w / 2 + 2, 196], [gx - 6, 228]]]) {
      const r = bez(c);
      path(b, r, GB[4], 3); path(b, r, FIG[1], 1); path(b, r.map(([x, y]) => [x + 1, y]), FIG[0], 1);
    }
    // a side branch with a clump of leaves, two vines hanging from it
    const by = 84 + (nz(gi, 202) * 18 | 0);
    for (let i = 0; i <= 44; i++) {
      const x = gx + side * (w / 2 - 2 + i), y = by - Math.round(Math.sin(i / 44 * Math.PI) * 4 + i * 0.16), r = 3 - i * 0.04;
      for (let j = -Math.ceil(r); j <= r; j++) put(b, x, y + j, j < -r * 0.4 ? GB[1] : j < r * 0.3 ? GB[2] : GB[3]);
      if (nz(i, s + 91) > 0.3) put(b, x, y - Math.ceil(r) - 1, GM[nz(i, s + 92) > 0.5 ? 0 : 1]);
    }
    foliage(b, gx + side * (w / 2 + 44), by - 12, 17, 9, GC, 99 + s, 3, 5.5);
    if (gi % 3 === 0) PERCH.push([Math.round(gx + side * (w / 2 + 16)), by - Math.round(Math.sin(18 / 44 * Math.PI) * 4 + 18 * 0.16) - 4]);
    vine(b, gx + side * (w / 2 + 20), by + 2, 34 + (nz(gi, 203) * 30 | 0), s, GC[3], [GC[1], GC[2]]);
    vine(b, gx + side * (w / 2 + 38), by - 2, 22 + (nz(gi, 204) * 24 | 0), s + 1, GC[3], [GC[1], GC[2]], ORCH);
    // the crown: a dark ceiling of leaves, lowest round the trunk
    rect(b, gx - 46, -2, 92, 12, GC[3]);
    foliage(b, gx, 12, 64, 22, GC, s + 1, 3.5, 7);
    foliage(b, gx - 46, 28, 26, 13, GC, s + 2, 3, 6);
    foliage(b, gx + 44, 26, 28, 13, GC, s + 3, 3, 6);
    foliage(b, gx + side * 6, 40, 30, 11, GC, s + 4, 3, 6);
    // the leaves along its lower edge and its sunny side are lit from behind
    for (let y = 6; y < 66; y++) for (let x = gx - 84; x <= gx + 84; x++) {
      const k = GC.indexOf(get(b, x, y));
      if (k < 0) continue;
      const open = get(b, x, y + 1) === NONE || get(b, x, y + 2) === NONE, sun = get(b, x + 1, y) === NONE || get(b, x + 2, y) === NONE;
      if (open && nz(x, y + 700) > 0.3) put(b, x, y, k < 2 ? LIT[1] : LIT[2]);
      else if (sun && nz(x, y + 701) > 0.4) put(b, x, y, LIT[1]);
    }
    // backlit fronds reaching into the gaps on both sides
    const FR = [LIT[0], LIT[1], LIT[2], GC[2]];
    jfrond(b, gx + 60, 30, 0.35, 38, 0.5, FR); jfrond(b, gx + 54, 16, 0.1, 44, 0.42, FR);
    jfrond(b, gx - 60, 32, Math.PI - 0.35, 36, 0.5, FR); jfrond(b, gx - 52, 18, Math.PI - 0.1, 42, 0.42, FR);
    // vines hanging from the crown
    for (let k = 0; k < 6; k++) {
      const vx = Math.round(gx + (k - 2.5) * 24 + (nz(gi, 210 + k) - 0.5) * 14);
      if (Math.abs(vx - gx) < w) continue;
      let y0 = 20;
      while (y0 < 70 && get(b, vx, y0 + 1) !== NONE) y0++;
      vine(b, vx, y0 - 2, 22 + Math.round(nz(gi, 220 + k) * 80), s + k, GC[3], [GC[1], GC[2]], nz(gi, 230 + k) > 0.6 ? ORCH : null);
    }
  });
  hazeB(b, MIST, (x, y) => 0.03 + ss(150, 236, y) * 0.34);
}
// warm light shafts slanting down and left through the gaps between the crowns (on the giants' parallax)
function shaftCanvas(w) {
  const beams = [], c = canvasOf(w, H), g = c.getContext('2d'), im = g.createImageData(w, H), d = im.data, A = new Float32Array(w);
  for (let i = 0; i + 1 < GIANT_X.length; i++) {
    const gx = (GIANT_X[i] + GIANT_X[i + 1]) / 2 + 10;
    for (const [dx, bw, ba] of [[-40, 14, 0.26], [0, 26, 0.34], [44, 12, 0.24], [84, 18, 0.27]]) beams.push([gx + dx + 60, bw, ba]);
  }
  for (let y = 0; y < H; y++) {
    const fy = ss(8, 50, y) * (1 - ss(196, 244, y));
    if (fy <= 0) continue;
    A.fill(0);
    for (const [bx, bw, ba] of beams) {
      const cc = bx - y * 0.62;
      for (let x = Math.max(0, Math.floor(cc - bw / 2)); x <= Math.min(w - 1, Math.ceil(cc + bw / 2)); x++) {
        const e = 1 - Math.abs(x - cc) / (bw / 2);
        if (e > 0) A[x] = Math.max(A[x], ba * fy * Math.min(1, e * 2.2));
      }
    }
    for (let x = 0; x < w; x++) if (A[x] > 0.01) { const j = (y * w + x) * 4; d[j] = 255; d[j + 1] = 248; d[j + 2] = 206; d[j + 3] = Math.round(A[x] * 255); }
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
// a few long vines that sway (top fixed, the free end swings): baked once, drawn in slices
let VINES = null;
function vineSprites() {
  VINES = [96, 70, 118].map((len, i) => {
    const b = buf(-6, 0, 13, len + 3);
    vine(b, 0, 0, len, i * 5 + 2, GC[3], [GC[1], GC[2]], i === 1 ? P('#ffb0dc', '#e052a0', '#fff0a0') : null);
    return mk(b);
  });
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
  if (!VINES) vineSprites();
  GIANT_X.forEach((gx, gi) => {
    for (let k = 0; k < 2; k++) {
      const x = gx + (k ? 34 : -30) + Math.round((nz(gi, 240 + k) - 0.5) * 12) - off;
      if (x < -20 || x > W + 20) continue;
      hangBlit(g, VINES[(gi + k * 2) % 3], x, 30 + (nz(gi, 242 + k) * 10 | 0), sway(gx * 0.013 + k * 2, 3.2) - 0.6, 4);
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
// The backdrop, baked once
// ============================================================
let ART = null;
function art() {
  if (ART) return ART;
  const A = {};
  A.sky = paintSky(); A.sun = sunCanvas(); A.disc = sunDisc(); A.bloom = bloomCanvas(); A.rays = [rayCanvas(1), rayCanvas(2)];
  A.clouds = CLOUDS.map((c, i) => cloudCanvas(c[0], i + 3, CLOUD_PAL, 1));
  A.hills = strip(0.05, 64, 170, paintHills);
  A.far = strip(0.12, 90, H, paintFar);
  A.mid = strip(0.25, 110, H, paintMid);
  A.near = strip(0.42, 70, H, paintNear);
  A.giants = strip(0.6, -2, H, paintGiants);
  A.shaft = shaftCanvas(A.giants.w);
  return (ART = A);
}
// everything behind the world for camera cx, on any 2D context g (so it can also be faded over the next area)
function jungleBG(g, cx) {
  const A = art();
  g.drawImage(A.sky, -10, -10);
  const k = 0.5 + 0.5 * Math.sin(G.t * 0.02);
  g.globalAlpha = 0.5 + 0.5 * k; g.drawImage(A.rays[0], SUN.x - 420, SUN.y - 70);
  g.globalAlpha = 1 - 0.5 * k; g.drawImage(A.rays[1], SUN.x - 420, SUN.y - 70);
  g.globalAlpha = 1;
  g.drawImage(A.sun, SUN.x - 72, SUN.y - 72);
  g.drawImage(A.disc, SUN.x - 12, SUN.y - 12);
  CLOUDS.forEach((c, i) => {
    const span = W + 300, x = wrap(c[1] - cx * c[3] - G.t * c[4], span) - 150;
    if (x < W + 10 && x + c[0] > -10) g.drawImage(A.clouds[i], Math.round(x), c[2] - A.clouds[i].height);
  });
  blitStrip(g, A.hills, cx);
  birds(g, cx);
  blitStrip(g, A.far, cx);
  blitStrip(g, A.mid, cx);
  g.drawImage(A.bloom, SUN.x - 170, SUN.y - 170);
  blitStrip(g, A.near, cx);
  g.globalAlpha = 0.7 + 0.14 * Math.sin(G.t * 0.017);
  g.drawImage(A.shaft, offOf(A.giants, cx), 0, W + 20, H, -10, 0, W + 20, H);
  g.globalAlpha = 1;
  blitStrip(g, A.giants, cx);
  const off = offOf(A.giants, cx);
  liveVines(g, cx, off);
  toucans(g, cx, off);
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
function junglePlat(pl) {
  let s = PLATS.get(pl);
  if (!s) PLATS.set(pl, s = pl.t === 'log' ? platLog(pl) : platTemple(pl));
  ctx.drawImage(s.img, s.x0, s.y0);
}

// ------------------------------------------------------------ the ground: a grassy lip with flowers over layered earth
function bladeH(x) { const a = nz(x, 11); return a < 0.62 ? 1 + (nz(x, 12) * 3.4 | 0) : 0; }
function groundPx(x, y) {
  const d = y - GROUND;
  if (d < 0) { const h = bladeH(x); return -d > h ? NONE : -d === h ? GRASS[0] : GRASS[1]; }
  if (d < 2) return nz(x, y + 500) > 0.88 ? GRASS[0] : GRASS[d === 0 ? 1 : 2];
  if (d < 4) return nz(x, y + 600) > 0.84 ? GRASS[2] : GRASS[3];
  const lip = 5 + (nz(x >> 1, 77) * 2.4 | 0) + (nz(x, 78) > 0.84 ? 2 : 0);          // the ragged underside of the turf
  if (d < lip) return GRASS[4];
  if (d === lip) return EARTH[5];
  // warm earth in wavy strata, a pale clay streak here and there, darker toward the bottom
  const wav = Math.sin(x * 0.045 + Math.sin(x * 0.013) * 2) * 2.5 + Math.sin(x * 0.17) * 0.8, sd = d - 4 + wav, band = Math.floor(sd / 9), n = nz(x, y);
  let k = Math.floor(ss(3, 42, d) * 3.3 + (n - 0.5) * 0.9) + (((band % 3) + 3) % 3 === 1 ? 1 : 0);
  if (n > 0.975) k--;
  let c = EARTH[clamp(k, 0, 5)];
  const st = ((Math.round(sd) % 9) + 9) % 9;
  if (st === 0 && nz(x >> 3, band + 40) > 0.35) c = mixI(c, I('#d09a60'), 0.4);
  else if (st === 1 && nz(x >> 3, band + 40) > 0.35) c = mixI(c, EARTH[5], 0.3);
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
  for (const d of L.decor) {
    if (d.t !== 'palm' || d.x < x0 - 40 || d.x > x1 + 40 || d.x >= A_END) continue;
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
    const x = c * 17 + (nz(c, 970) * 17 | 0), q = nz(c, 971);
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
let CHUNKS = null;
function buildChunks() {
  CHUNKS = [];
  for (let x0 = 0; x0 < A_END; x0 += CHW) {
    const b = buf(x0, CHY, CHW, CHH);
    for (let lx = 0; lx < CHW; lx++) {
      const x = x0 + lx;
      if (x >= A_END) break;
      for (let y = GROUND - 5; y < CHY + CHH; y++) { const c = groundPx(x, y); if (c !== NONE) b.d[(y - CHY) * CHW + lx] = c; }
    }
    groundFeatures(b, x0);
    for (let lx = 0; lx < CHW; lx++) if (x0 + lx >= A_END) for (let y = 0; y < CHH; y++) b.d[y * CHW + lx] = NONE;
    CHUNKS.push(bake(b));
  }
}
function jungleGround(cx) {
  if (!CHUNKS) buildChunks();
  for (let i = Math.max(0, Math.floor((cx - 12) / CHW)); i * CHW < cx + W + 12 && i < CHUNKS.length; i++) ctx.drawImage(CHUNKS[i], i * CHW, CHY);
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
  const b = buf(-30, -30, 60, 33), f = [[I('#ff9ad8'), I('#d83a9a'), I('#fff0a0')], [I('#fff08a'), I('#ffb82e'), I('#e8641e')], [I('#ffffff'), I('#ffc2dc'), I('#ffd23f')]][fi];
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
  hazeB(b, I('#cfe2cc'), () => 0.3);
  // a fern growing out of the break, a vine winding round the drums
  bigFern(b, m * -2, -hgt + 6, 8, [LEAF[1], LEAF[2], LEAF[3], LEAF[4]], 3);
  const wind = bez([[-8, -8], [12, -18], [-12, -30], [8, -42]], 34);
  path(b, wind, MOSS[4], 1);
  wind.forEach(([x, y], i) => { if (i % 4 === 1 && get(b, x, y - 1) !== NONE) { put(b, x, y - 1, MOSS[2]); put(b, x + 1, y - 1, MOSS[3]); } });
  tuft(b, m * 15, 1, 4, 6, 44); tuft(b, m * -14, 1, 3, 5, 45); tuft(b, m * 29, 1, 3, 4, 46);
  outline(b, I('#5a6052'));
  return mk(b);
}
let DECOR = null;
function decorArt() {
  if (DECOR) return DECOR;
  DECOR = {
    palms: [[92, 10, 1], [84, -9, 2], [100, 14, 3], [88, 6, 4]].map(([h, l, s]) => palmBuf(h, l, s)),
    bushes: [0, 1, 2].map(s => bushBuf(s * 11, s)),
    ferns: [22, 25, 20].map((s, i) => fernBuf(s, i)),
    statue: statueBuf(), ruins: [ruinBuf(0), ruinBuf(1)]
  };
  return DECOR;
}
const MINE = { palm: 1, bush: 1, fern: 1, statue: 1, ruin: 1 };
const mine = d => MINE[d.t] && d.x < A_END;
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
    if (bx > A_END - 40) continue;
    const t = G.t + i * 53, x = bx + Math.sin(t * 0.031) * 16 + Math.sin(t * 0.083 + i) * 5, y = GROUND - 26 - hsh(i * 2.9) * 22 + Math.sin(t * 0.057 + i * 2) * 7;
    const f = FLY[i % 3][[0, 1, 2, 1][Math.floor(t / 4) % 4]];
    ctx.drawImage(f.img, Math.round(x) - 3, Math.round(y) - 2);
  }
}
function jungleDecor(cx) {
  const D = decorArt();
  for (const d of L.decor) {
    if (!mine(d) || d.x < cx - 90 || d.x > cx + W + 90) continue;
    if (d.t === 'palm') { const v = Math.floor(hsh(d.x * 0.47) * D.palms.length); swayBlit(D.palms[v], d.x, GROUND + 1, sway(d.x * 0.01, 2.2), 3); }
    else if (d.t === 'bush') blitS(D.bushes[Math.floor(hsh(d.x * 0.84) * D.bushes.length)], d.x, GROUND);
    else if (d.t === 'fern') blitS(D.ferns[Math.floor(hsh(d.x * 0.71) * D.ferns.length)], d.x, GROUND + 1);
    else if (d.t === 'statue') blitS(D.statue, d.x, GROUND);
    else if (d.t === 'ruin') blitS(D.ruins[d.x > 1200 ? 1 : 0], d.x, GROUND);
  }
  const A = art();
  ctx.globalAlpha = 0.32; ctx.drawImage(A.shaft, offOf(A.giants, cx), 0, W + 20, H, cx - 10, 0, W + 20, H); ctx.globalAlpha = 1;
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
let FRONT = null;
function jungleFront(cx) {
  if (!FRONT) FRONT = [0, 1, 2].map(frontBuf);
  const off = cx * 1.3, sp = 90;
  for (let i = Math.floor((off - 80) / sp); i * sp - off < W + 80; i++) {
    if (hsh(i + 3) < 0.35) continue;
    const x = Math.round(i * sp + hsh(i) * 40 - off);
    if (cx + x >= 1600) continue;
    blitS(FRONT[Math.floor(hsh(i * 1.7 + 7) * 3)], x, H);
  }
  // pollen drifting in the light
  for (let i = 0; i < 26; i++) {
    const t = G.t + i * 211, x = Math.round(wrap(hsh(i * 3.7) * 700 + Math.sin(t * 0.007 + i) * 30 - t * 0.05 - cx * 0.5, W + 40) - 20);
    const y = Math.round(44 + hsh(i * 9.1) * 170 + Math.sin(t * 0.011 + i * 2) * 12);
    if (cx + x >= 1600) continue;
    const tw = Math.sin(t * 0.09 + i) > 0.2;
    ctx.fillStyle = tw ? 'rgba(255,250,214,0.95)' : 'rgba(255,246,196,0.45)'; ctx.fillRect(x, y, 1, 1);
    if (tw && i % 5 === 0) { ctx.fillStyle = 'rgba(255,250,214,0.35)'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  }
}

// ============================================================
// Hooks: the jungle is repainted, the rest of the mission falls back to the original drawing
// ============================================================
const old = { bg: L.drawBG, behind: L.drawBehind, ground: L.drawGround, plat: L.drawPlat, front: L.drawFront, load: L.load, update: L.update };
let SCR = null;   // one scratch canvas for the crossfade into the camp's backdrop (made once)
L.drawBG = function (cx) {
  const k = clamp((cx + W / 2 - FADE0) / (FADE1 - FADE0), 0, 1);
  if (k >= 1) return old.bg(cx);
  if (k <= 0) return jungleBG(ctx, cx);
  old.bg(cx);
  if (!SCR) { const c = canvasOf(W + 20, H + 20), g = c.getContext('2d'); g.translate(10, 10); SCR = { c, g }; }
  jungleBG(SCR.g, cx);
  ctx.globalAlpha = 1 - k; ctx.drawImage(SCR.c, -10, -10); ctx.globalAlpha = 1;
};
// the original decor / ground painters read L.decor / L.grounds: hand them the lists without the jungle's entries
const REST_DECOR = L.decor.filter(d => !mine(d)), REST_GROUNDS = L.grounds.filter(g => g[2] !== 'grass');
L.drawBehind = function (cx) {
  const all = L.decor;
  L.decor = REST_DECOR;
  try { old.behind(cx); } finally { L.decor = all; }
  if (cx < A_END + 100) jungleDecor(cx);
};
L.drawGround = function (cx) {
  const all = L.grounds;
  L.grounds = REST_GROUNDS;
  try { old.ground(cx); } finally { L.grounds = all; }
  if (cx < A_END + 12) jungleGround(cx);
};
L.drawPlat = function (pl) { if ((pl.t === 'rock' || pl.t === 'log') && pl.x < A_END) junglePlat(pl); else old.plat(pl); };
L.drawFront = function (cx) {
  if (cx + W + 80 > 1600) { ctx.save(); ctx.beginPath(); ctx.rect(1600 - cx, 0, W + 20, H + 10); ctx.clip(); old.front(cx); ctx.restore(); }
  if (cx < 1600) jungleFront(cx);
};

// ============================================================
// The mock's moment, pinned every update while the level is built at the mock camera (so the picture is the same
// whatever --frames is): Ines running and gunning with the H.M.G. she got from the first prisoner, a robot soldier
// behind a crate about to fire, another on the temple block whose laser is already on its way, the next prisoner
// shouting HELP!
// ============================================================
let staged = false, E0 = null, E1 = null;
L.load = function (cp) {
  if (old.load) old.load.call(L, cp);
  staged = Math.abs(cp - MOCK_CAM) < 1;
  if (staged) { E0 = G.enemies.find(e => e.x === 960) || null; E1 = G.enemies.find(e => e.x === 1080) || null; G.big = null; }
};
L.update = function () {
  if (old.update) old.update.call(L);
  if (!staged) return;
  const p = G.p;
  G.cam.x = MOCK_CAM;
  Object.assign(p, { x: 1052, y: GROUND, vx: 1.7, vy: 0, onGround: true, onPlat: null, facing: 1, aim: 'fwd', crouch: false, knife: 0, muzzle: 3,
    weapon: 'hmg', ammo: 168, bombs: 10, hearts: 3, inv: 0, dead: 0, kb: 0, t: 13 });
  G.lives = 3; G.score = 1350;
  G.big = null; G.banner = { s: L.sections[0].name, t: 100 };
  if (E0) Object.assign(E0, { x: 962, y: 188, vy: 0, facing: 1, state: 'walk', cd: 90, st: 0, moving: false, active: true, dead: false, hp: 2, hitT: 0, t: 50 });
  if (E1) Object.assign(E1, { x: 1153, y: GROUND, vy: 0, facing: -1, state: 'aim', st: 10, moving: false, active: true, dead: false, hp: 2, hitT: 0, t: 64 });
  G.pb = [{ x: 1099, y: GROUND - 19, vx: 7, vy: 0, dmg: 1, life: 60, draw: hmgShot }, { x: 1127, y: GROUND - 19, vx: 7, vy: 0, dmg: 1, life: 60, draw: hmgShot }];
  G.eb = [{ k: 'laser', x: 1024, y: 194, vx: 1.9, vy: 0.9, r: 3, life: 200 }];
  G.parts = [
    { type: 'debris', x: 1044, y: GROUND - 31, vx: 0, vy: 0, life: 30, max: 40, size: 2, c: '#e8b43a' },
    { type: 'debris', x: 1037, y: GROUND - 25, vx: 0, vy: 0, life: 30, max: 40, size: 2, c: '#e8b43a' },
    { type: 'dust', x: 1043, y: GROUND - 1, vx: 0, vy: 0, life: 14, max: 26, size: 2.5 }
  ];
  G.texts = []; G.items = []; G.grenades = [];
  for (const o of G.pows) if (o.state === 'tied') o.t = 20;
};
}
