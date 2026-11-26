'use strict';
// ============================================================
// VOLCANO ISLAND (Mission 3) proposal frame: AREA 2: HONEY JUNGLE. A mock screenshot for the parent and the kids,
// rendered by the real engine: a harness fixture, NOT game content. Loaded with --extra after the snapshot build,
// it pushes a temporary mission 3 that holds only what this one frame shows, painted the Mission 2 way: static art
// painted pixel by pixel into buffers and baked once (1px OUT outlines on the things you can touch or hit, 3-tone
// shading, misty parallax layers behind), robots built from shaded parts, every pose pinned by update() (only the
// small loops driven by G.t move with --frames: wing beats, falling water, steam, butterflies). Deterministic: no
// Math.random/rand anywhere (textures come from a private mulberry32 table, motion from G.t and hsh), so the same
// command always gives the same picture.
//   node $H/harness.mjs render --html /Users/macbookair/game/proposals/level3/base.html --level 3 --x 1201.6 \
//     --frames 150 --hero 1 --scale 3 --extra /Users/macbookair/game/proposals/level3/jungle/scene.js --out jungle.png
// ============================================================
{
// ------------------------------------------------------------ frame layout (screen coordinates; world x = x + CAM)
const CAM = 1000;
const WX = x => CAM + x;
const HERO = { x: 160, y: 166 };            // Mathias mid-jump above the log (feet)
const HIVE = { x: 396, y: 44 };             // the hive's hanging point, under the branch
const BURST = { x: 165, y: 86 };            // the bee the bullets just hit
const LOGP = { x: WX(36), y: 209, w: 156, t: 'log' };
const LEDGEP = { x: WX(418), y: 196, w: 90, t: 'ledge' };
const CAGE_X = 449;
const POND_Y = 229;                         // water line at the back of the pond

// ------------------------------------------------------------ noise and colour helpers
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
const NZT = (() => { const r = rng(330311), a = new Float32Array(65536); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
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
const I = s => parseInt(s.slice(1, 7), 16);
const P = (...s) => s.map(I);
const NONE = -1, OUTI = I(OUT), EVIL_I = I(EVIL);
function mixI(a, b, k) {
  k = clamp(k, 0, 1);
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  return Math.round(ar + ((b >> 16 & 255) - ar) * k) << 16 | Math.round(ag + ((b >> 8 & 255) - ag) * k) << 8 | Math.round(ab + ((b & 255) - ab) * k);
}
const rgba = (v, a) => 'rgba(' + (v >> 16 & 255) + ',' + (v >> 8 & 255) + ',' + (v & 255) + ',' + a.toFixed(3) + ')';

// ------------------------------------------------------------ pixel buffers (Int32 colours, NONE = empty)
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
// a smooth curve through four control points (cubic Bezier), as a point list for path()
function bez([a, b2, c, d], n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * a[0] + 3 * u * u * t * b2[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b2[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  return out;
}
// 1px outline around everything painted (against empty pixels)
function outline(b, c = OUTI) {
  const add = [], w = b.w, h = b.h, d = b.d;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i] !== NONE) continue;
    if ((x > 0 && d[i - 1] !== NONE) || (x < w - 1 && d[i + 1] !== NONE) || (y > 0 && d[i - w] !== NONE) || (y < h - 1 && d[i + w] !== NONE)) add.push(i);
  }
  for (const i of add) d[i] = c;
}
// mix every painted pixel toward colour c by k(x, y) (screen coordinates): haze, mist
function haze(b, c, k) {
  for (let r = 0; r < b.h; r++) for (let q = 0; q < b.w; q++) {
    const i = r * b.w + q;
    if (b.d[i] === NONE) continue;
    const m = k(q - b.ox, r - b.oy);
    if (m > 0) b.d[i] = mixI(b.d[i], c, m);
  }
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
// a sprite: anchor (ax, ay) = the buffer origin (ox, oy)
function mk(b, white) { return { img: bake(b), white: white ? bake(b, true) : null, w: b.w, h: b.h, ax: b.ox, ay: b.oy }; }
function blit(s, x, y) { ctx.drawImage(FLASH && s.white ? s.white : s.img, Math.round(x) - s.ax, Math.round(y) - s.ay); }
// an RGBA canvas from fn(x, y) -> [r, g, b, a] | null (soft light, glows)
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
// live drawing: crisp thick line (squares stepped along it), pixel disc in the current fillStyle
function pl(x0, y0, x1, y1, w, c, out) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), o = out ? 1 : 0, h = (w - 1) / 2;
  ctx.fillStyle = out ? OUT : FLASH ? '#ffffff' : c;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n - h) - o, Math.round(y0 + (y1 - y0) * i / n - h) - o, w + 2 * o, w + 2 * o);
}
function pdisc(x, y, r) {
  x = Math.round(x); y = Math.round(y);
  const R2 = (r + 0.5) * (r + 0.5);
  for (let j = -Math.floor(r); j <= Math.floor(r); j++) { const hw = Math.floor(Math.sqrt(R2 - j * j)); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
}

// ------------------------------------------------------------ plant painters (pal: [light, mid, dark, deep])
// a mass of leaves like Mission 2's canopies: clumps sorted top to bottom, each a deep rim, dark, mid and a lit top
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
    oval(b, x - 0.5, y - 1, Math.max(0.5, r - 1.3), Math.max(0.5, (r - 1.3) * 0.75), pal[1]);
    oval(b, x - r * 0.25, y - r * 0.45, Math.max(0.5, r * 0.4), Math.max(0.5, r * 0.26), pal[0]);
  }
  // leaf texture: short strokes one tone off; leaf tips poking out of the silhouette
  const x0 = Math.floor(cx - rx - 2), x1 = Math.ceil(cx + rx + 2), y0 = Math.floor(cy - ry - 2), y1 = Math.ceil(cy + ry + 2);
  for (let i = 0, n2 = (x1 - x0) * (y1 - y0) / 4; i < n2; i++) {
    const x = x0 + Math.floor(nz(i, s + 5) * (x1 - x0)), y = y0 + Math.floor(nz(i, s + 6) * (y1 - y0)), k = pal.indexOf(get(b, x, y));
    if (k < 0) continue;
    const up = nz(i, s + 7) < (k >= 2 ? 0.35 : 0.6), nc = pal[clamp(k + (up ? -1 : 1), 0, 3)], dx = nz(i, s + 8) < 0.5 ? 1 : -1;
    for (let j = 0; j < 2 + (nz(i, s + 9) * 2 | 0); j++) if (pal.indexOf(get(b, x + dx * j, y + j)) >= 0) put(b, x + dx * j, y + j, nc);
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = get(b, x, y);
    if (pal.indexOf(c) < 0) continue;
    const q = nz(x * 3 + s, y);
    if (q > 0.84 && get(b, x, y + 1) === NONE) { put(b, x, y + 1, pal[2]); if (q > 0.92) put(b, x + (x & 1 ? 1 : -1), y + 2, pal[3]); }
    else if (q < 0.08 && get(b, x - 1, y) === NONE) put(b, x - 1, y, c);
    else if (q > 0.8 && get(b, x + 1, y) === NONE) put(b, x + 1, y, c);
  }
}
// a palm frond: a drooping rachis with leaflets hanging from both sides
function frond(b, x0, y0, a, len, droop, pal, s) {
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
// a big leaf along a drooping midrib: rounded base, pointed tip, the upper half lit, side veins, monstera splits
function bigLeaf(b, x0, y0, a, len, wid, droop, pal, s, splits) {
  const n = Math.ceil(len * 2.2);
  for (let i = 0; i <= n; i++) {
    const t = i / n, cx = x0 + Math.cos(a) * len * t, cy = y0 + Math.sin(a) * len * t + droop * t * t * len;
    const dx = Math.cos(a), dy = Math.sin(a) + 2 * droop * t, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
    const hw = wid * Math.pow(Math.sin(Math.PI * Math.min(1, 0.14 + t * 0.86)), 0.7);
    const L = t * len;
    for (let o = -hw; o <= hw; o += 0.5) {
      const ao = Math.abs(o);
      if (splits) {
        const k = Math.round(L / 4.2), dl = Math.abs(L - k * 4.2);
        if (dl < 0.55 && ao > hw * 0.38 && t > 0.12 && t < 0.92) continue;                  // slits from the edge
        if (Math.abs(dl - 2.1) < 0.8 && ao > hw * 0.2 && ao < hw * 0.32 && nz(k, s + (o < 0 ? 1 : 0)) > 0.4) continue;   // holes
      }
      const up = o * ny < 0, vein = Math.abs(((L + ao * 0.7) % 4.2) - 2.1) < 0.35 && ao > 1;
      let c = ao < 0.6 ? pal[0] : up ? pal[1] : pal[2];
      if (vein) c = up ? pal[0] : pal[1];
      if (ao > hw - 0.7) c = up ? pal[2] : pal[3];
      put(b, cx + nx * o, cy + ny * o, c);
    }
  }
}
function trunkCol(b, x, w, y0, y1, pal, s, flareH = 26) {
  for (let y = y0; y < y1; y++) {
    const fl = flareH > 0 ? ss(y1 - flareH, y1, y) : 0, ww = Math.round(w + fl * w * 1.2), xl = Math.round(x - ww / 2 + Math.sin(y / 19 + s) * 0.8);
    for (let i = 0; i < ww; i++) {
      const t = (i + 0.5) / ww;
      let c = t < 0.22 ? pal[0] : t > 0.7 ? pal[2] : pal[1];
      if (ww > 4 && (i + Math.floor(y / 9 + nz(i, s) * 3)) % 4 === 0 && nz(xl + i, y >> 2) > 0.45 && t > 0.15) c = pal[3];
      put(b, xl + i, y, c);
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
      const c = Math.abs(o) < 0.6 ? pal[0] : up ? (Math.abs(o) > hw - 1 ? pal[0] : pal[1]) : (Math.abs(o) > hw - 1 ? pal[3] : pal[2]);
      put(b, cx + nx * o, cy + ny * o, c);
    }
  }
}
function fern(b, x, base, s, pal) {
  for (let k = -3; k <= 3; k++) {
    const a = -Math.PI / 2 + k * 0.42, len = s * (1 - Math.abs(k) * 0.1);
    for (let t = 1; t <= len; t++) {
      const bend = (t / len) * (t / len) * s * 0.35;
      const px = x + Math.cos(a) * t + Math.sign(k) * bend, py = base + Math.sin(a) * t + bend * 0.9;
      put(b, px, py, pal[1]);
      if (t > 1 && t < len - 1 && t % 2 === 0) { put(b, px - 1, py + 1, pal[(t + k) % 3 ? 2 : 0]); put(b, px + 1, py + 1, pal[2]); }
    }
  }
}
function palm(b, x, base, h, lean, pal, s) {
  for (let i = 0; i <= h; i++) {
    const t = i / h, px = x + lean * t * t, py = base - i;
    put(b, px, py, pal[2]); put(b, px + 1, py, i % 3 ? pal[1] : pal[3]);
  }
  const cx = x + lean, cy = base - h, n = 8;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI * (0.02 + 0.96 * k / (n - 1)) + (nz(k, s) - 0.5) * 0.25, L = h * (0.36 + 0.14 * nz(k, s + 1));
    for (let i = 1; i <= L; i++) {
      const t = i / L, fx = cx + Math.cos(a) * i * (1 - t * 0.15), fy = cy + Math.sin(a) * i * 0.8 + t * t * L * 0.75;
      put(b, fx, fy, t < 0.5 ? pal[1] : pal[2]);
      if (t < 0.4) put(b, fx, fy - 1, pal[0]);
      if (i > 2 && i % 2 === 0) put(b, fx, fy + 1 + (t > 0.5 ? 1 : 0), pal[2]);
    }
  }
  oval(b, cx + 0.5, cy + 1.5, 1.2, 1, pal[3]);
}

// ------------------------------------------------------------ robots from shaded parts
function ell(cx, cy, rx, ry, a = 0) {
  const ca = Math.cos(a), sa = Math.sin(a);
  return (x, y) => { const dx = x - cx, dy = y - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca; return u * u / (rx * rx) + v * v / (ry * ry) <= 1; };
}
function cap(x0, y0, x1, y1, r) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  return (x, y) => { const t = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1), px = x0 + dx * t - x, py = y0 + dy * t - y; return px * px + py * py <= r * r; };
}
const extY = (rx, ry, a) => Math.sqrt((rx * Math.sin(a)) ** 2 + (ry * Math.cos(a)) ** 2);
// parts front to back: { hit(x, y), cx, cy, ext, pal: [light, mid, dark, deep] | (x, y) => pal }, local coordinates
// around the anchor. Tones by height inside the part (light from above), a deep seam where a nearer part covers it.
function parts(w, h, ax, ay, list) {
  const b = buf(w, h, ax, ay), id = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const lx = x - ax + 0.5, ly = y - ay + 0.5;
    for (let k = 0; k < list.length; k++) if (list[k].hit(lx, ly)) { id[y * w + x] = k; break; }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, k = id[i];
    if (k < 0) continue;
    const q = list[k], lx = x - ax + 0.5, ly = y - ay + 0.5, pal = typeof q.pal === 'function' ? q.pal(lx, ly) : q.pal;
    const t = (ly - q.cy) / q.ext + (q.tilt || 0) * (lx - q.cx) / q.ext;
    let c = t < -0.45 ? pal[0] : t > 0.7 ? pal[3] : t > 0.3 ? pal[2] : pal[1];
    const near = j => j >= 0 && j < k;
    if (!q.noSeam && (near(y > 0 ? id[i - w] : -1) || near(x > 0 ? id[i - 1] : -1) || near(x < w - 1 ? id[i + 1] : -1))) c = pal[3];
    b.d[i] = c;
  }
  return b;
}

// ============================================================
// SKY and the VOLCANO (seen through the gap in the canopy)
// ============================================================
const SKY_STOPS = [[-10, '#6fb6cf'], [36, '#8bc6d8'], [84, '#b2dadd'], [126, '#d3eadb'], [170, '#e6f1d8'], [280, '#ecf2d9']];
function skyAt(y) {
  let i = 0;
  while (i + 1 < SKY_STOPS.length && SKY_STOPS[i + 1][0] <= y) i++;
  const a = SKY_STOPS[i], c = SKY_STOPS[Math.min(i + 1, SKY_STOPS.length - 1)];
  return mixI(I(a[1]), I(c[1]), c[0] > a[0] ? (y - a[0]) / (c[0] - a[0]) : 0);
}
function paintSky() {
  const b = buf(W + 20, H, 10, 0), SUN = I('#fff8dc');
  for (let y = 0; y < H; y++) {
    const base = skyAt(y);
    for (let x = -10; x < W + 10; x++) {
      // the late-morning sun is high to the left, above the canopy: a warm glow on that side of the gap
      const g = Math.max(0, 1 - Math.hypot((x - 150) * 0.8, y + 40) / 270);
      put(b, x, y, mixI(base, SUN, g * g * 0.7));
    }
  }
  return b;
}

const VX = 262, VY = 64;   // crater rim (screen)
const RIM = [[-15, 4], [-11, 1], [-8, 0], [-5, 0], [-3, 3], [2, 4], [3, 6], [6, 6], [7, 3], [11, 2], [15, 4]];
function vTop(x) {
  const d = x - VX;
  if (d >= -15 && d <= 15) {
    for (let i = 1; i < RIM.length; i++) if (d <= RIM[i][0]) { const [x0, y0] = RIM[i - 1], [x1, y1] = RIM[i]; return VY + lerp(y0, y1, (d - x0) / (x1 - x0)); }
  }
  const ad = Math.abs(d) - 15;
  return VY + 4 + 112 * (1 - Math.exp(-ad / 98)) + (fbm(x / 9, 3.3, 7) - 0.5) * Math.min(4, ad * 0.07)
    - 3 * Math.exp(-(((d + 82) / 10) ** 2)) - 2 * Math.exp(-(((d - 66) / 13) ** 2));
}
function vHalf(y) { const k = clamp((y - VY - 4) / 112, 0, 0.97); return 15 - 98 * Math.log(1 - k); }
const VC = P('#dfc8ac', '#bea58e', '#9b8374', '#7a685e', '#5c4f4b');   // ash: lit .. deep shade
const VLAVA = P('#6c5852', '#4c3e3a');                                  // old lava flows
const VJ = P('#97bb76', '#7aa262', '#618752', '#4b6c45');              // jungle on the lower slopes
const STREAKS = [[-0.66, 76, 0], [-0.36, 50, 1], [-0.12, 92, 2], [0.2, 62, 3], [0.46, 84, 4], [0.74, 44, 5]];
function paintVolcano() {
  const b = buf(W + 20, 196, 10, 0);
  for (let x = -10; x < W + 10; x++) {
    const top = vTop(x);
    for (let y = Math.ceil(top); y < 196; y++) {
      const hw = vHalf(y), u = (x - VX) / hw, dy = y - top;
      const rib = Math.sin(u * 10.5 + (fbm(x / 13, y / 21, 5) - 0.5) * 3.2 + (y - VY) * 0.015);
      let L = -u * 0.9 + (rib > 0.55 ? 0.3 : rib < -0.55 ? -0.32 : 0) + (fbm(x / 5, y / 5, 9) - 0.5) * 0.3;
      if (dy < 1.5 && x - VX < 4) L += 0.5;                 // the rim catches the light
      let c = L > 0.55 ? VC[0] : L > 0.18 ? VC[1] : L > -0.2 ? VC[2] : L > -0.55 ? VC[3] : VC[4];
      // old lava flows: dark ribbons from the rim, wider further down
      for (const [u0, len, k] of STREAKS) {
        const yy = y - VY - 4;
        if (yy < 0 || yy > len) continue;
        const uc = u0 + 0.05 * Math.sin(yy / 9 + k * 2.1), wpx = 1 + yy * 0.045 + (k % 2) * 0.6;
        if (Math.abs(u - uc) * hw < wpx) { c = (u - uc) * hw < -wpx + 1 && L > -0.2 ? VLAVA[0] : VLAVA[1]; break; }
      }
      // green jungle on the lower third, climbing up the gullies
      const jy = VY + 70 + 6 * fbm(x / 13, 1.7, 9) + 3 * Math.sin(x / 9) - (rib < -0.3 ? 8 : 0);
      if (y > jy) {
        const n = nz(x, y);
        c = L > 0.3 ? VJ[0] : L > -0.1 ? VJ[1] : L > -0.5 ? VJ[2] : VJ[3];
        if (y < jy + 2 && n > 0.5) c = VJ[0];
        else if (n > 0.86) c = VJ[Math.max(0, VJ.indexOf(c) - 1)];
        else if (n < 0.1) c = VJ[3];
      }
      // the faint orange glow inside the crater notch
      if (Math.abs(x - VX - 1) < 5 && dy < 2.5 && y > VY + 1) c = dy < 1 ? I('#f6ae78') : I('#d98a62');
      put(b, x, y, c);
    }
  }
  for (let r = 0; r < b.h; r++) for (let q = 0; q < b.w; q++) {
    const i = r * b.w + q;
    if (b.d[i] !== NONE) b.d[i] = mixI(b.d[i], skyAt(r), 0.13 + ss(70, 170, r) * 0.2);
  }
  plume(b);
  return b;
}
// the smoke plume: puffs rising from the crater and drifting right, lit from the upper left, warm near the crater
function plume(b) {
  const PL = P('#ffffff', '#efebe6', '#d2cac4', '#b2aaa5'), WARM = I('#f2b48c');
  for (let i = 18; i >= 0; i--) {
    const t = i / 18, cx = VX + 3 + t * 118 + t * t * 34, cy = VY - 6 - t * 38 - Math.sin(t * 3.4) * 5, r = 3.2 + t * 14 + nz(i, 7) * 2.4;
    for (let j = -Math.ceil(r); j <= r; j++) for (let k = -Math.ceil(r); k <= r; k++) {
      const d = Math.hypot(k, j);
      if (d > r + 0.4) continue;
      if (d > r - 1 && nz(Math.round(cx + k), Math.round(cy + j)) > 0.55) continue;
      const lt = -(k * 0.5 + j * 0.85) / r;
      let c = lt > 0.32 ? PL[0] : lt > -0.22 ? PL[1] : lt > -0.6 ? PL[2] : PL[3];
      if (t < 0.32 && j > 0) c = mixI(c, WARM, (0.32 - t) * 1.6 * ss(0, r, j));
      put(b, cx + k, cy + j, mixI(c, skyAt(Math.round(cy + j)), 0.08 + t * 0.3));
    }
  }
}

// ============================================================
// Misty jungle layers behind the world
// ============================================================
const MIST = I('#e4efe2');
const FJ = P('#b2d1bd', '#9cc1ac', '#89b29f', '#79a491');
const farTop = x => 127 + 8 * fbm(x / 26, 0.5, 21) + 3 * Math.sin(x / 31 + 1);
function paintFar() {
  const b = buf(W + 20, H, 10, 0);
  for (let x = -16; x < W + 16; x += 4) { const r = 3 + nz(x, 3) * 8, y = farTop(x) + r * 0.6; oval(b, x, y, r + 1, r * 0.85, FJ[2]); }
  for (let x = -10; x < W + 10; x++) rect(b, x, Math.round(farTop(x)) + 5, 1, H, FJ[2]);
  for (let x = -16; x < W + 16; x += 4) { const r = 3 + nz(x, 3) * 8, y = farTop(x) + r * 0.6; if (r > 4) oval(b, x - 1, y - 2, r - 2.5, r * 0.85 - 3, FJ[1]); }
  // emergent trees: tall pale trunks with umbrella crowns
  for (const [x, h, w] of [[30, 34, 22], [178, 22, 15], [392, 36, 24], [466, 24, 15]]) {
    const top = farTop(x) - h;
    rect(b, x, top + 3, 2, h, FJ[3]);
    for (let k = -2; k <= 2; k++) oval(b, x + k * w * 0.22, top + Math.abs(k) * 1.5, w * 0.3, 3.2, FJ[2]);
    for (let k = -2; k <= 2; k++) oval(b, x + k * w * 0.22 - 1, top - 1 + Math.abs(k) * 1.5, w * 0.22, 1.6, FJ[1]);
  }
  for (const [x, h, lean] of [[72, 27, 5], [122, 20, -4], [208, 25, 3], [228, 18, -3], [344, 29, -6], [440, 25, 4]]) palm(b, x, farTop(x) + 4, h, lean, [FJ[0], FJ[2], FJ[3], FJ[3]], x);
  haze(b, MIST, (x, y) => 0.1 + ss(118, 200, y) * 0.5);
  return b;
}

// the basalt cliff the waterfall drops from (behind the pond), misty jungle on either side
const CLF = P('#8a948b', '#727e76', '#5f6a63', '#4c5650');
const WF = { x0: 302, x1: 315, top: 103 };
const cliffTop = x => 99 + 4 * fbm(x / 8, 2.2, 31) + (x >= WF.x0 && x <= WF.x1 ? 4 : 0) + ss(326, 346, x) * 12 + (1 - ss(272, 290, x)) * 14;
function paintCliff() {
  const b = buf(W + 20, H, 10, 0);
  const MP = P('#a8d084', '#86b46a', '#699658', '#527a48'), TP = P('#aacbb0', '#90b69a', '#7aa286', '#699077');
  for (const [x, w, top] of [[226, 5, 96], [248, 4, 108], [372, 6, 84], [404, 5, 100], [150, 4, 112]]) trunkCol(b, x, w, top, H, TP, x);
  for (const [x, y, rx, ry] of [[224, 96, 20, 13], [252, 110, 13, 9], [372, 84, 24, 15], [408, 100, 17, 11], [152, 112, 17, 11], [192, 122, 14, 9], [434, 116, 15, 10]]) foliage(b, x, y, rx, ry, TP, x + y, 2.5, 5);
  for (let x = 266; x < 352; x++) {
    const t = Math.round(cliffTop(x));
    for (let y = t; y < H; y++) {
      const sh = Math.round(2 * Math.sin(y / 17 + x * 0.02)), col = Math.floor((x + sh) / 6), fx = ((x + sh) % 6 + 6) % 6;
      let c = fx === 0 ? CLF[3] : fx === 1 ? CLF[0] : fx < 4 ? CLF[1] : CLF[2];
      if ((y + col * 7) % 23 === 0) c = CLF[3];
      const m = fbm(x / 6, y / 9, 44);
      if (m > 0.52 && y > t + 2) c = m > 0.62 ? MP[1] : m > 0.56 ? MP[2] : MP[3];          // moss in patches
      if (x > WF.x0 - 4 && x < WF.x1 + 4) c = mixI(c, I('#34443f'), 0.5);                     // wet rock by the falls
      put(b, x, y, c);
    }
    // plants spilling over the top, trailing down
    if (!(x >= WF.x0 - 1 && x <= WF.x1 + 1)) {
      if (x % 3 === 0) foliage(b, x, t - 1, 3.5, 2.6, MP, x * 3, 1.5, 3);
      if (x % 4 === 1 && nz(x, 62) > 0.45) { const n = 4 + nz(x, 63) * 20; for (let k = 0; k < n; k++) put(b, x + Math.round(Math.sin(k * 0.4 + x)), t + k, k % 4 === 3 ? MP[1] : MP[3]); }
    }
  }
  // ferns sprouting from ledges in the rock
  for (const [x, y, s] of [[276, 132, 6], [338, 120, 7], [288, 168, 5], [330, 160, 6], [322, 104, 5]]) fern(b, x, y, s, MP);
  haze(b, MIST, (x, y) => 0.26 + ss(130, 215, y) * 0.4);
  return b;
}

// the understory: trunks with buttresses and lianas, leaf masses, banana plants, tree ferns, bushes; pond steam
const MJ = P('#8ccb78', '#64a862', '#4b8a54', '#3a6e46');
const MB = P('#71907a', '#57745f', '#44604e', '#344c3e');
function paintMid() {
  const b = buf(W + 20, H, 10, 0);
  for (const [x, w] of [[22, 9], [104, 7], [378, 8], [452, 10]]) {
    trunkCol(b, x, w, 0, 222, MB, x, 34);
    for (let k = 0; k < 3; k++) {   // lianas beside the trunk
      const lx = x + (k - 1) * (w + 4), len = 80 + nz(x, k) * 90;
      for (let y = 0; y < len; y++) put(b, lx + Math.round(Math.sin(y / 13 + k + x) * 2), y, k % 2 ? MJ[3] : MB[3]);
    }
  }
  // leaf masses on the sides (the understory under the near canopy), none in the gap
  for (const [x, y, rx, ry] of [[38, 88, 34, 18], [116, 106, 24, 14], [70, 136, 22, 11], [374, 92, 28, 17], [444, 108, 34, 19], [404, 138, 20, 11], [174, 146, 12, 8], [342, 150, 12, 8]]) foliage(b, x, y, rx, ry, MJ, x * 11 + y, 3, 6.5);
  // a flame tree and a pink-flowering tree among them: clusters of blossom on the lit tops
  for (const [x, y, rx, ry, c0, c1, s] of [[444, 104, 30, 15, '#ffb060', '#f2742a', 3], [40, 84, 28, 14, '#ffb8d8', '#e8609a', 4], [374, 88, 22, 12, '#ffb060', '#f2742a', 5]]) {
    for (let i = 0; i < 46; i++) {
      const px = x + (nz(i, s * 31) - 0.5) * 2 * rx, py = y + (nz(i, s * 31 + 1) - 0.65) * 2 * ry;
      if (MJ.indexOf(get(b, px, py)) < 0 || MJ.indexOf(get(b, px, py)) > 1) continue;
      put(b, px, py, I(c1)); put(b, px + 1, py, I(c1)); put(b, px, py - 1, I(c0)); if (nz(i, s) > 0.5) put(b, px + 1, py - 1, I(c0));
    }
  }
  // banana plants and heliconias
  for (const [x, base, s] of [[150, 214, 22], [224, 210, 18], [342, 212, 20], [418, 216, 24]]) {
    rect(b, x - 1, base - s, 3, s, MJ[3]);
    paddle(b, x, base - s, -2.5, s * 1.15, 3.6, 0.25, MJ, x);
    paddle(b, x, base - s, -1.9, s * 1.3, 4, 0.18, MJ, x + 1);
    paddle(b, x, base - s, -0.95, s * 1.25, 3.8, 0.2, MJ, x + 2);
    paddle(b, x, base - s, -0.3, s * 1.05, 3.4, 0.32, MJ, x + 3);
  }
  // tree ferns
  for (const [x, base, h] of [[258, 214, 54], [292, 212, 38], [186, 214, 44]]) {
    for (let y = base - h; y < base; y++) { put(b, x, y, MB[2]); put(b, x + 1, y, MB[3]); }
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI * (0.05 + 0.9 * k / 8), L = 14 + nz(k, x) * 8;
      for (let i = 1; i <= L; i++) {
        const t = i / L, fx = x + Math.cos(a) * i, fy = base - h + Math.sin(a) * i * 0.7 + t * t * L * 0.65;
        put(b, fx, fy, MJ[1]);
        if (i % 2 === 0 && i < L - 1) { put(b, fx, fy + 1, MJ[2]); put(b, fx, fy - 1, MJ[0]); }
      }
    }
  }
  // undergrowth along the back of the world
  for (let x = -14; x < W + 14; x += 3) {
    const r = 3 + nz(x, 71) * 5 * (fbm(x / 30, 0, 72) + 0.4), y = 214 - r * 0.4 + nz(x, 73) * 4;
    oval(b, x, y, r, r * 0.8, MJ[2]); oval(b, x - 0.6, y - 1.2, r - 1.3, r * 0.8 - 1.3, MJ[1]);
    if (nz(x, 74) > 0.75) put(b, x - 1, y - r + 1, MJ[0]);
  }
  rect(b, -10, 216, W + 20, H - 216, MJ[2]);
  for (let x = 6; x < W; x += 16 + Math.round(nz(x, 75) * 22)) fern(b, x, 218, 7 + nz(x, 76) * 5, MJ);
  // red flowers in the bushes
  for (let i = 0; i < 26; i++) {
    const x = Math.round(nz(i, 81) * W), y = 196 + Math.round(nz(i, 82) * 18);
    if (get(b, x, y) === NONE || (x > WF.x0 - 8 && x < WF.x1 + 8)) continue;
    put(b, x, y, I('#e85a5a')); put(b, x + 1, y, I('#c83a40')); put(b, x, y - 1, I('#ff8a7a'));
  }
  // steam and humid air: more mist over the pond, less at the sides
  haze(b, MIST, (x, y) => ss(150, 226, y) * (0.16 + 0.34 * Math.max(0, 1 - Math.abs(x - 300) / 170)) + 0.06);
  return b;
}

// the canopy ceiling (near, dark, seen from below) with the gap over the volcano; fronds and vines hanging down
const NC = P('#5c9a42', '#3f7838', '#2b5a31', '#1c4025');
function canopyBottom(x) {
  const gap = ss(136, 188, x) * (1 - ss(318, 368, x));
  return lerp(56 + 10 * fbm(x / 16, 0, 41) - 16 * ss(330, 430, x), 9 + 5 * fbm(x / 13, 1, 42), gap);
}
function paintNear() {
  const b = buf(W + 20, H, 10, 0), LIT = P('#d2f08a', '#a6d860', '#76b448');
  // a big buttressed jungle trunk framing the left: dark bark, fissures, moss on the lit side, a strangler fig's
  // roots, and a rim of light on the edge that faces the gap
  const NB = P('#6a6450', '#4e4a38', '#3a3729', '#28261d'), NM = P('#7aa84a', '#5a8a3a', '#43702e');
  for (let y = 0; y < 226; y++) {
    const fl = ss(120, 226, y), w = Math.round(28 + fl * 34), xl = Math.round(80 - w / 2 + Math.sin(y / 21) * 1.5 - fl * 8);
    for (let i = 0; i < w; i++) {
      const x = xl + i, t = (i + 0.5) / w;
      let c = t < 0.14 ? NB[0] : t < 0.55 ? NB[1] : t < 0.86 ? NB[2] : NB[3];
      if ((i * 3 + Math.floor(y / 9 + nz(i, 5) * 2) * 7) % 7 === 0 && nz(x, y >> 2) > 0.3) c = NB[Math.min(3, NB.indexOf(c) + 1)];
      if (nz(x >> 1, y >> 1) > 0.95) c = NB[0];
      const m = fbm(x / 5, y / 8, 61);
      if (t < 0.62 && m > 0.6) c = m > 0.68 ? NM[0] : m > 0.64 ? NM[1] : NM[2];
      if (t > 0.94) c = I('#a8c878');                                   // backlit edge facing the gap
      put(b, x, y, c);
    }
  }
  for (const c of [[[64, 16], [70, 52], [96, 70], [96, 118]], [[97, 26], [96, 64], [64, 92], [66, 150]], [[95, 130], [94, 160], [70, 176], [62, 216]], [[66, 100], [80, 120], [90, 130], [95, 150]]]) {
    const r = bez(c);
    path(b, r, NB[3], 5); path(b, r, I('#8a8266'), 3); path(b, r.map(([x, y]) => [x - 1, y]), I('#aaa286'), 1);
  }
  for (let x = -10; x < W + 10; x++) rect(b, x, 0, 1, Math.round(canopyBottom(x)) - 5, NC[3]);
  for (let x = -16; x < W + 16; x += 11) foliage(b, x + 3, canopyBottom(x) - 15, 10, 7, NC, x + 777, 2.5, 5);
  for (let x = -16; x < W + 16; x += 7) foliage(b, x, canopyBottom(x) - 5, 8, 5, NC, x + 501, 2.5, 4.5);
  // backlit palm fronds reaching into the gap from both sides
  const FR = [LIT[0], LIT[1], LIT[2], NC[2]];
  frond(b, 128, 40, 0.15, 52, 0.55, FR, 1);
  frond(b, 140, 24, 0.5, 40, 0.4, FR, 2);
  frond(b, 160, 8, 0.75, 30, 0.3, FR, 3);
  frond(b, 372, 30, Math.PI - 0.1, 50, 0.55, FR, 4);
  frond(b, 356, 14, Math.PI - 0.45, 38, 0.45, FR, 5);
  // vines hanging down
  for (const [x, len] of [[12, 120], [116, 80], [148, 44], [376, 54], [470, 110]]) {
    const y0 = Math.round(canopyBottom(x)) - 4;
    for (let y = y0; y < y0 + len; y++) {
      const vx = x + Math.round(Math.sin((y - y0) / 15 + x) * 2);
      put(b, vx, y, NC[3]);
      if ((y - y0) % 7 === 3) { put(b, vx + 1, y, NC[1]); put(b, vx + 2, y + 1, NC[2]); }
      if ((y - y0) % 7 === 0) { put(b, vx - 1, y, NC[1]); put(b, vx - 2, y + 1, NC[2]); }
    }
  }
  trunkCol(b, 2, 18, 0, 150, P('#3a4a34', '#2c3a29', '#212c20', '#161e16'), 7, 0);
  return b;
}

// light shafts falling through the gap (soft, warm), drawn behind the world and faintly in front of it
function shaftCanvas() {
  const beams = [[150, 16, 0.26], [178, 8, 0.18], [298, 20, 0.24], [328, 10, 0.17]];   // kept off the volcano's summit
  return alphaCanvas(W + 20, H, (x, y) => {
    x -= 10;
    const fy = ss(10, 44, y) * (1 - ss(190, 250, y));
    if (fy <= 0) return null;
    let a = 0;
    for (const [bx, bw, ba] of beams) {
      const c = bx + y * 0.5, e = 1 - Math.abs(x - c) / (bw / 2);
      if (e > 0) a = Math.max(a, ba * fy * Math.min(1, e * 2.2));
    }
    return a > 0.01 ? [255, 246, 204, Math.round(a * 255)] : null;
  });
}

// ============================================================
// The WORLD: the big tree with the hive's branch, heliconias, giant leaves, the log, the ledge, ground and pond
// ============================================================
const BARK = P('#a39078', '#80705e', '#625549', '#463d35');
const MOSS = P('#b8e06c', '#88c04a', '#5e9838', '#3e6e2a');
const LEAF = P('#92d45e', '#5ea445', '#3f7e36', '#295c29');
const HELI = P('#ff7a5a', '#e8352a', '#b01e1e', '#7a1414');
const GOLD = P('#fff3a0', '#ffd23f', '#e09a14', '#a86a0a');
const BAS = P('#8e857e', '#6d6660', '#524c47', '#393532');

// a heliconia rostrata: pendant zigzag of red bracts with yellow lips and green tips
function heliconia(b, x, y0, n) {
  for (let y = y0; y < y0 + n * 6 + 2; y++) put(b, x + (Math.floor((y - y0) / 6) % 2 ? 1 : 0), y, LEAF[3]);
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? 1 : -1, by = y0 + 3 + k * 6, sz = 1 - k / (n + 2);
    const L = Math.round(8 * sz + 2), Ht = Math.max(2, Math.round(4 * sz + 1));
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
// a hibiscus flower facing us: five red petals, a dark heart, the yellow stamen column
function hibiscus(b, x, y, r, pal) {
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + k * Math.PI * 2 / 5 + 0.3;
    oval(b, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.5, pal[1]);
  }
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + k * Math.PI * 2 / 5 + 0.3;
    put(b, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.7 - 1, pal[0]);
    put(b, x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.36 + 1, pal[2]);
  }
  oval(b, x, y, 1, 1, pal[3]);
  line(b, x, y, x + r * 0.6, y - r * 0.75, GOLD[1]); put(b, x + r * 0.7, y - r * 0.85, GOLD[0]);
}

// the big tree at the right edge: buttressed trunk, a long mossy branch reaching left (the hive hangs from it),
// a strangler fig's roots wrapped round it, lianas and a bromeliad
const branchY = x => 41 - 4 * Math.sin(Math.PI * clamp((x - 326) / 136, 0, 1));
const branchR = x => 2.6 + 3.6 * ss(330, 460, x);
function paintTree() {
  const b = buf(186, 236, -306, 0);
  for (let y = 0; y < 236; y++) {
    const fl = ss(150, 236, y), xl = Math.round(452 - fl * 30 + Math.sin(y / 23) * 1.5);
    for (let x = xl; x < 500; x++) {
      const t = (x - xl) / (500 - xl);
      let c = t < 0.1 ? BARK[0] : t < 0.5 ? BARK[1] : t < 0.82 ? BARK[2] : BARK[3];
      if ((x * 3 + Math.floor(y / 13) * 5) % 11 === 0 && nz(x, y >> 2) > 0.3) c = BARK[Math.min(3, BARK.indexOf(c) + 1)];
      if (nz(x >> 1, y >> 1) > 0.94) c = BARK[0];
      if (t < 0.55 && fbm(x / 6, y / 10, 52) > 0.64) c = fbm(x / 3, y / 4, 53) > 0.5 ? MOSS[1] : MOSS[2];   // moss
      put(b, x, y, c);
    }
  }
  // strangler fig roots: outlined pale ribbons wrapping the trunk
  const FIG = P('#cdbea2', '#a89880', '#857662');
  for (const c of [[[456, 0], [462, 30], [492, 34], [500, 60]], [[500, 70], [470, 84], [456, 120], [458, 152]], [[500, 118], [478, 138], [462, 168], [462, 200]], [[472, 36], [458, 54], [462, 80], [457, 104]]]) {
    const r = bez(c);
    path(b, r, OUTI, 5); path(b, r, FIG[1], 3); path(b, r.map(([x, y]) => [x - 1, y]), FIG[0], 1);
  }
  // the branch
  for (let x = 326; x < 470; x++) {
    const cy = branchY(x), r = branchR(x);
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      const t = (y - cy) / r;
      put(b, x, y, t < -0.5 ? BARK[0] : t < 0.3 ? BARK[1] : t < 0.75 ? BARK[2] : BARK[3]);
    }
    const mt = Math.floor(cy - r);
    if (nz(x, 91) > 0.15) { put(b, x, mt, MOSS[1]); put(b, x, mt - 1, nz(x, 92) > 0.5 ? MOSS[0] : MOSS[1]); if (nz(x, 93) > 0.6) put(b, x, mt - 2, MOSS[0]); }
    if (nz(x, 94) > 0.82) for (let k = 1; k < 3 + nz(x, 95) * 5; k++) put(b, x, Math.ceil(cy + r) + k, MOSS[2]);
  }
  // honey oozing round the hive's clamp and dripping off the branch
  for (const [x, len] of [[381, 5], [409, 3], [414, 7]]) {
    const y0 = Math.round(branchY(x) + branchR(x));
    rect(b, x - 1, y0 - 1, 4, 1, GOLD[1]);                                // a smear along the bark
    for (let k = 0; k < len; k++) put(b, x, y0 + k, GOLD[1]);
    rect(b, x - 1, y0 + len, 3, 2, GOLD[1]); put(b, x - 1, y0 + len, GOLD[0]); put(b, x + 1, y0 + len + 1, GOLD[2]); put(b, x, y0 + len + 2, GOLD[2]);
  }
  foliage(b, 328, 34, 12, 8, LEAF, 99, 2.5, 4.5);
  // a bromeliad on the branch: a rosette of stiff leaves with a red heart
  for (let k = -3; k <= 3; k++) line(b, 432, 32, 432 + k * 2.2, 32 - 6 + Math.abs(k) * 1.4, k % 2 ? LEAF[2] : LEAF[1]);
  oval(b, 432, 30, 1.5, 1, HELI[1]); put(b, 432, 29, HELI[0]);
  // lianas hanging from the branch
  for (const [x, len] of [[340, 66], [350, 40], [446, 120]]) {
    const y0 = Math.round(branchY(x) + branchR(x));
    for (let y = y0; y < y0 + len; y++) {
      const vx = x + Math.round(Math.sin((y - y0) / 12 + x) * 1.5);
      put(b, vx, y, LEAF[3]);
      if ((y - y0) % 6 === 2) { put(b, vx + 1, y, LEAF[1]); put(b, vx + 2, y, LEAF[2]); }
    }
  }
  outline(b);
  return b;
}
// hanging heliconias and lianas at the top left
function paintHang() {
  const b = buf(160, 120, 0, -10);
  for (const [x, y0, len] of [[22, 24, 74], [70, 30, 52], [120, 32, 40]]) {
    for (let y = y0; y < y0 + len; y++) {
      const vx = x + Math.round(Math.sin((y - y0) / 11 + x) * 2);
      put(b, vx, y, LEAF[3]);
      if ((y - y0) % 5 === 1) { oval(b, vx + 2, y + 1, 2, 1, LEAF[1]); put(b, vx + 3, y, LEAF[0]); }
      if ((y - y0) % 5 === 3) oval(b, vx - 2, y + 1, 2, 1, LEAF[2]);
    }
  }
  heliconia(b, 44, 34, 8);
  heliconia(b, 96, 36, 5);
  outline(b);
  return b;
}
// a hibiscus bush standing behind the log
function paintBush() {
  const b = buf(150, 70, -30, -160), RED = P('#ff8a80', '#e8303a', '#b01a2a', '#6a1020');
  foliage(b, 76, 200, 28, 20, LEAF, 31, 3, 6);
  foliage(b, 124, 204, 18, 14, LEAF, 37, 3, 5.5);
  for (const [x, y, r] of [[60, 186, 5], [82, 181, 6], [104, 189, 5], [126, 196, 5], [70, 198, 4], [94, 200, 4]]) hibiscus(b, x, y, r, RED);
  outline(b);
  return b;
}
// giant leaves at the back of the pond: an elephant ear on the left, a split monstera on the right
function paintGiants() {
  // a cooler, darker green than the robot frogs, so they stand out in front of it
  const b = buf(250, 74, -186, -168), G1 = P('#86c47c', '#4f9460', '#38764e', '#255a3a');
  for (const [a, len, wid] of [[-2.4, 28, 9], [-1.8, 33, 10.5], [-1.25, 26, 8.5]]) {
    const ex = 205 + Math.cos(a) * 12, ey = 226 + Math.sin(a) * 12;
    line(b, 205, 226, ex, ey, G1[2]);
    bigLeaf(b, ex, ey, a + 0.25, len, wid, 0.35, G1, 7, false);
  }
  for (const [a, len, wid] of [[-2.1, 28, 9], [-1.45, 32, 10], [-0.8, 27, 9]]) {
    const ex = 384 + Math.cos(a) * 10, ey = 226 + Math.sin(a) * 10;
    line(b, 384, 226, ex, ey, G1[2]);
    bigLeaf(b, ex, ey, a + 0.3, len, wid, 0.35, G1, 9, true);
  }
  outline(b);
  return b;
}

// the fallen mossy log the hero jumped from (a platform: top at y 209)
function paintLog() {
  const b = buf(170, 40, -30, -198), cy = 220.5, R = 11.5;
  const WOOD = P('#ecc890', '#cfa266', '#a8784a', '#7a5232');
  for (let x = 34; x <= 189; x++) {
    const r = R - (x < 46 ? (46 - x) * 0.32 : 0) + Math.sin(x * 0.7) * 0.3;
    for (let y = Math.ceil(cy - r); y <= cy + r; y++) {
      const t = (y - cy) / r;
      let c = t < -0.6 ? BARK[0] : t < 0.15 ? BARK[1] : t < 0.6 ? BARK[2] : BARK[3];
      if ((y + Math.round(Math.sin(x / 9) * 1.2)) % 4 === 0 && nz(x >> 2, y) > 0.3 && t > -0.7) c = BARK[Math.min(3, BARK.indexOf(c) + 1)];
      if (nz(x, y) > 0.94) c = BARK[0];
      put(b, x, y, c);
    }
    const mt = Math.ceil(cy - r), md = 3 + Math.round(fbm(x / 6, 0, 33) * 4);
    for (let k = 0; k < md; k++) put(b, x, mt + k, k === 0 ? MOSS[0] : k < 2 ? MOSS[1] : k < md - 1 ? MOSS[2] : MOSS[3]);
    if (nz(x, 34) > 0.8) for (let k = 0; k < 3 + nz(x, 35) * 6; k++) put(b, x, mt + md + k, MOSS[2]);
    if (nz(x, 36) > 0.7) put(b, x, mt - 1, MOSS[1]);
  }
  for (const [x, y, h] of [[33, 213, 5], [31, 218, 3], [32, 224, 4]]) rect(b, x, y, 2, h, BARK[2]);
  oval(b, 190, cy, 2.5, R - 0.5, WOOD[2]);
  oval(b, 190, cy, 1.8, R - 2.5, WOOD[1]);
  for (let y = Math.round(cy - 7); y <= cy + 7; y += 3) put(b, 190, y, WOOD[3]);
  put(b, 190, Math.round(cy), WOOD[3]); put(b, 191, Math.round(cy) - 4, WOOD[0]);
  // shelf fungi: stacked orange brackets with a pale rim
  for (const [x, y, s] of [[72, 225, 1], [80, 220, 0.8], [126, 226, 1], [152, 222, 0.7]]) {
    for (const [dy, w, c] of [[-2, 3, '#ffd890'], [-1, 5, '#ffb050'], [0, 6, '#f08a34'], [1, 5, '#c8601c'], [2, 3, '#8a3c12']]) {
      const ww = Math.round(w * s);
      for (let k = -ww; k <= ww; k++) put(b, x + k, y + dy, I(c));
    }
    put(b, x - Math.round(5 * s), y, OUTI); put(b, x + Math.round(6 * s), y, OUTI);
  }
  fern(b, 104, 210, 7, P('#9ad45e', '#5f9c3c', '#3f7a2e'));
  fern(b, 168, 210, 5, P('#9ad45e', '#5f9c3c', '#3f7a2e'));
  outline(b);
  return b;
}

// the mossy basalt ledge on the right (a platform: top at y 196), rising out of the pond
const shoreR = y => 421 + (y - 196) * 0.12;
function paintLedge() {
  const b = buf(84, 90, -410, -184), FL = P('#ffe066', '#ff9a3c');
  const face = y => shoreR(y) + Math.sin(y / 6.5) * 1.2 + (y < 201 ? (201 - y) * 0.7 : 0);
  for (let y = 196; y < 272; y++) for (let x = Math.round(face(y)); x < 494; x++) {
    const sh = Math.round(Math.sin(y / 13 + x * 0.05) * 1.5), fx = ((x + sh) % 8 + 8) % 8;
    let c = fx === 0 ? BAS[3] : fx === 1 ? BAS[0] : fx < 5 ? BAS[1] : BAS[2];
    if ((y + Math.floor((x + sh) / 8) * 5) % 19 === 0) c = BAS[3];
    if (x < face(y) + 1.5) c = BAS[0];
    const m = fbm(x / 6, y / 8, 46);
    if (m > 0.6 + ss(198, 240, y) * 0.1) c = m > 0.68 ? MOSS[1] : MOSS[2];
    if (y > 224) c = mixI(c, I('#28363a'), 0.18 + ss(224, 236, y) * 0.22);                  // wet toward the water
    put(b, x, y, c);
  }
  // moss carpet on top, drooping over the edge, blades, ferns and a few small flowers
  for (let x = 419; x < 494; x++) {
    const top = 196, d = 2 + Math.round(fbm(x / 5, 1, 44) * 3);
    for (let k = 0; k < d; k++) put(b, x, top + k, k === 0 ? MOSS[0] : k === 1 ? MOSS[1] : MOSS[2]);
    const h = nz(x, 45) < 0.5 ? 1 + Math.round(nz(x, 46) * 3) : 0;
    for (let k = 1; k <= h; k++) put(b, x, top - k, k === h ? MOSS[0] : MOSS[1]);
    if (nz(x, 47) > 0.84) for (let k = 0; k < 4 + nz(x, 48) * 10; k++) put(b, x, top + d + k, k % 3 ? MOSS[2] : MOSS[1]);
  }
  fern(b, 480, 197, 9, P('#9ad45e', '#5f9c3c', '#3f7a2e'));
  fern(b, 425, 197, 6, P('#9ad45e', '#5f9c3c', '#3f7a2e'));
  for (const [x, y] of [[431, 193], [470, 192], [486, 194]]) { put(b, x, y, FL[0]); put(b, x + 1, y, FL[1]); put(b, x, y - 1, FL[0]); }
  outline(b);
  return b;
}

// the ground at the left, the hot-spring pond (milky jade, ochre mineral rims), lily pads, the cascade rocks
const EARTH = P('#5e4535', '#4c382b', '#3d2d23', '#30241c', '#251c16');
const WATER = P('#d4f2e8', '#ade3d6', '#88cfc6', '#6ab8b8', '#55a0a8', '#468697');
const SINTER = P('#f8eed6', '#efd39c', '#dca858', '#bb7d36', '#8c5626');
const shoreL = y => 199 - (y - POND_Y) * 0.5 - (y - POND_Y) * (y - POND_Y) * 0.006;
const PADS = [[262, 232, 15, 3.5], [304, 240, 9, 2.5], [350, 235, 8, 2], [233, 252, 10, 3], [302, 262, 13, 3.5], [384, 252, 10, 3], [406, 241, 7, 2]];
function paintGround() {
  const b = buf(W + 24, 84, 12, -192), REFL = I('#2f6c72'), PAD = P('#7ab84e', '#4a8a38', '#2e6428');
  for (let x = -12; x < W + 12; x++) {
    for (let y = 192; y < 276; y++) {
      const sl = shoreL(y), sr = shoreR(y);
      if (x >= sr - 1) continue;                                         // the ledge covers this
      if (y >= POND_Y && x > sl && x < sr) {                             // water
        const e = Math.min(x - sl, sr - x), dep = clamp(Math.min(e, (y - POND_Y) * 2.6) / 30 + (fbm(x / 11, y / 4, 3) - 0.5) * 0.3, 0, 1);
        let k = Math.min(5, Math.floor(dep * 6));
        if (e < 3) k = 0;
        if ((y - POND_Y) % 5 === 2 && nz(x >> 2, y) > 0.72) k = Math.max(0, k - 2);
        let c = y === POND_Y ? WATER[0] : WATER[k];
        // the dark canopy mirrored toward the front, the bright gap mirrored in the middle
        c = mixI(c, REFL, ss(244, 274, y) * 0.34 * (0.55 + 0.45 * fbm(x / 7, 3, 5)));
        c = mixI(c, I('#ffffff'), Math.max(0, 1 - Math.hypot((x - 300) / 60, (y - 246) / 12)) * 0.3);
        put(b, x, y, c);
        continue;
      }
      if (x <= sl + 1 && x > sl - 5 && y >= POND_Y - 1) {               // sinter terraces on the left shore
        const d = sl - x;
        put(b, x, y, d < 1 ? SINTER[0] : d < 2.2 ? SINTER[1] : (Math.round(d + y * 0.3) % 3 === 0 ? SINTER[3] : SINTER[2]));
        continue;
      }
      if (x > 196 && y < POND_Y) {                                       // the back rim of the pond
        const rt = 224 - 3 * fbm(x / 9, 0, 17);
        if (y < rt) continue;
        const d = y - rt;
        put(b, x, y, d < 1 ? SINTER[0] : d < 2 ? SINTER[1] : (d + Math.round(Math.sin(x / 5))) % 3 === 0 ? SINTER[3] : SINTER[2]);
        continue;
      }
      const d = y - 232;                                                 // the forest floor and the earth
      if (d < 0) {
        const hgt = nz(x, 11) < 0.55 ? 1 + Math.floor(nz(x, 12) * 4) : 0;
        if (-d <= hgt) put(b, x, y, -d === hgt ? MOSS[0] : MOSS[1]);
        continue;
      }
      let c;
      if (d < 2) c = nz(x, y + 500) > 0.86 ? I('#d08a3e') : MOSS[d === 0 ? 1 : 2];
      else if (d < 4) c = nz(x, y + 600) > 0.8 ? I('#a8602a') : MOSS[3];
      else if (d === 4) c = EARTH[3];
      else { let k = Math.floor((d - 4) / 9 + nz(x, y) * 0.8); if (nz(x, y) > 0.97) k = 0; c = EARTH[clamp(k, 0, 4)]; }
      put(b, x, y, c);
    }
  }
  for (let x = -10; x < 190; x += 7) {
    if (nz(x, 31) > 0.45) continue;
    let rx = x, ry = 237;
    for (let i = 0; i < 6 + nz(x, 32) * 14; i++) { put(b, rx, ry, I('#3a2618')); ry++; const w = nz(x + i * 7, 33); if (w < 0.3) rx--; else if (w > 0.7) rx++; }
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.round(nz(i, 37) * 180) - 6, y = 240 + Math.round(nz(i, 38) * 26), rx = 1 + Math.round(nz(i, 39) * 2);
    if (x > shoreL(y) - 7) continue;
    oval(b, x, y, rx + 1, rx * 0.6 + 1, EARTH[4]); oval(b, x, y, rx, rx * 0.6, I('#8a7a6a')); put(b, x - 1, y - 1, I('#b0a090'));
  }
  // the cascade's rocks at the back of the pond (the falls behind feed the pond here)
  for (const [x, y, rx, ry] of [[292, 220, 9, 7], [325, 221, 9, 6], [308, 226, 6, 3], [278, 225, 6, 4], [340, 225, 6, 4]]) {
    oval(b, x, y, rx + 1, ry + 1, OUTI);
    oval(b, x, y, rx, ry, BAS[1]); oval(b, x - 1, y - 1, rx - 2, ry - 2, BAS[0]);
    for (let i = -rx; i <= rx; i++) if (nz(x + i, 8) > 0.3) put(b, x + i, Math.round(y - ry + Math.abs(i) * ry / rx * 0.5), MOSS[1]);
  }
  // lily pads
  for (const [x, y, rx, ry] of PADS) {
    oval(b, x, y, rx + 1, ry + 1, OUTI);
    oval(b, x, y, rx, ry, PAD[1]);
    for (let i = -rx; i <= rx; i++) put(b, x + i, Math.round(y - ry * Math.sqrt(Math.max(0, 1 - (i / (rx + 0.5)) ** 2))), PAD[0]);
    for (let i = -rx + 2; i <= rx - 2; i++) put(b, x + i, Math.round(y + ry * 0.7), PAD[2]);
    put(b, x + 1, y, PAD[2]); put(b, x + 2, y - 1, WATER[2]); put(b, x + 3, y - 1, WATER[2]);
    line(b, x - rx * 0.6, y - 0.4, x, y, PAD[2]);
  }
  for (const [x, y, c1, c2] of [[302, 260, '#ffd2e6', '#ff8fc0'], [385, 250, '#ffffff', '#ffd2e6']]) {
    for (const [dx, dy] of [[-2, 0], [2, 0], [-1, -1], [1, -1], [0, -2]]) put(b, x + dx, y + dy, I(c2));
    rect(b, x - 1, y - 1, 3, 1, I(c1)); put(b, x, y - 2, I(c1)); put(b, x, y - 1, I('#ffd23f'));
  }
  return b;
}

// ============================================================
// ROBOT BEES (yellow and black armour, glass wings, one red visor eye, a stinger that glows before a dive)
// ============================================================
const ST4 = P('#e2e9ef', '#a9b5c2', '#6f7b8b', '#48505c');
const HD4 = P('#9eacbc', '#67727f', '#454d59', '#2c323b');
const YEL4 = P('#fff3a6', '#ffd23f', '#e2a316', '#a26a0a');
const BLK4 = P('#5e5e70', '#35353f', '#24242c', '#18181e');
// ang: body tilt (+ = nose down), abd: abdomen angle (0 = straight back, + = curled under), glow 0 / 1 charging / 2 hot
function beeBuild(ang, abd, glow, wing) {
  const ca = Math.cos(ang), sa = Math.sin(ang), L = (u, v) => [u * ca - v * sa, u * sa + v * ca];
  const head = L(7.6, -0.8), thor = L(1.4, -0.8);
  const dA = [-Math.cos(abd), Math.sin(abd)], att = [-2.2, 0.5], ac = [att[0] + dA[0] * 6.6, att[1] + dA[1] * 6.6];
  const abC = L(ac[0], ac[1]), abA = ang + Math.atan2(dA[1], dA[0]), ARX = 7.6, ARY = 5.4;
  const stripe = (x, y) => {
    const s = ((x - abC[0]) * Math.cos(abA) + (y - abC[1]) * Math.sin(abA)) / ARX;
    return s < -0.62 ? YEL4 : s < -0.26 ? BLK4 : s < 0.1 ? YEL4 : s < 0.44 ? BLK4 : s < 0.72 ? YEL4 : BLK4;
  };
  const b = parts(56, 50, 28, 25, [
    { hit: ell(head[0], head[1], 4, 3.7, ang), cx: head[0], cy: head[1], ext: 3.8, pal: HD4 },
    { hit: ell(thor[0], thor[1], 4.7, 4.3, ang), cx: thor[0], cy: thor[1], ext: 4.4, pal: ST4 },
    { hit: ell(abC[0], abC[1], ARX, ARY, abA), cx: abC[0], cy: abC[1], ext: extY(ARX, ARY, abA), pal: stripe }
  ]);
  const px = (u, v, c) => { const [x, y] = L(u, v); put(b, x, y, c); };
  const SG = glow === 2 ? P('#ffffff', '#fff3a0', '#ffb030') : glow === 1 ? P('#ffe6b0', '#ffa040', '#d0602a') : P('#eef2f6', '#b4c0cc', '#6e7a8a');
  const tip = [att[0] + dA[0] * 13.8, att[1] + dA[1] * 13.8], nrm = [-dA[1], dA[0]];
  for (let i = 0; i <= 5; i++) {
    const u = tip[0] + dA[0] * i, v = tip[1] + dA[1] * i;
    px(u, v, i < 1 ? SG[2] : i < 3 ? SG[1] : SG[0]);
    if (i < 2) px(u + nrm[0] * 0.8, v + nrm[1] * 0.8, SG[2]);
  }
  // the visor eye: a red lens with a glint
  for (const [u, v, c] of [[8.4, -2.6, I('#2a0c0c')], [8.4, -1.4, I('#2a0c0c')], [8.4, -0.4, I('#2a0c0c')], [9.4, -2.4, EVIL_I], [10.4, -2.4, EVIL_I], [9.4, -1.4, EVIL_I], [10.4, -1.4, EVIL_I],
    [9.4, -0.4, I('#b01818')], [10.4, -0.4, I('#b01818')], [11.3, -1.8, I('#b01818')], [9.4, -2.4, I('#ffe0d8')]]) px(u, v, c);
  px(0.4, -3.8, I('#f4f8fb')); px(3.4, -0.6, I('#f4f8fb'));
  outline(b);
  // thin legs and antennae (after the outline, so they stay 1px), the antennae ending in little light bulbs
  const thin = (u0, v0, u1, v1, c) => { for (let i = 0; i <= 6; i++) { const [x, y] = L(lerp(u0, u1, i / 6), lerp(v0, v1, i / 6)); if (get(b, x, y) === NONE || get(b, x, y) === OUTI) put(b, x, y, c); } };
  for (const [u0, v0, u1, v1] of [[0, 4.6, -1.8, 7.6], [2.2, 4.8, 1.8, 8], [4.2, 4.2, 6, 7]]) thin(u0, v0, u1, v1, I('#2a2f37'));
  for (const [pts, bulb] of [[[[6.8, -4.4], [7.8, -7.6], [10.2, -9.8]], [10.8, -10.4]], [[[5.4, -4.6], [5.6, -8], [7.4, -10.6]], [7.9, -11.3]]]) {
    for (let k = 0; k + 1 < pts.length; k++) thin(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], I('#2a2f37'));
    const [x, y] = L(bulb[0], bulb[1]);
    put(b, x, y, I('#ffe066')); put(b, x + 1, y, I('#c89a20')); put(b, x, y - 1, I('#fff6c0'));
  }
  // wings: a far one behind the body and a near one in front; see-through glass in a steel frame
  const wings = [];
  const WA = [-1.72, -2.42, -2.95][wing];
  for (const far of [1, 0]) {
    const base = far ? [2.6, -4.2] : [0.4, -4], a = WA + (far ? -0.3 : 0), len = far ? 10.4 : 11.8, wd = far ? 3.8 : 4.6;
    const cL = L(base[0] + Math.cos(a) * len * 0.52, base[1] + Math.sin(a) * len * 0.52), aa = ang + a;
    const fill = buf(56, 50, 28, 25), frame = buf(56, 50, 28, 25), hit = ell(cL[0], cL[1], len * 0.52, wd, aa);
    for (let y = 0; y < 50; y++) for (let x = 0; x < 56; x++) {
      const lx = x - 28 + 0.5, ly = y - 25 + 0.5;
      if (!hit(lx, ly)) continue;
      const edge = !hit(lx - 1, ly) || !hit(lx + 1, ly) || !hit(lx, ly - 1) || !hit(lx, ly + 1);
      if (edge) frame.d[y * 56 + x] = far ? I('#5f7a90') : I('#4a6a86');
      else fill.d[y * 56 + x] = far ? I('#c4e4f2') : I('#eafaff');
    }
    for (let i = 2; i < len * 0.85; i++) { const q = L(base[0] + Math.cos(a) * i, base[1] + Math.sin(a) * i); put(frame, q[0], q[1], far ? I('#86a4b8') : I('#96bcd4')); }
    if (!far) for (let i = 3; i < len * 0.75; i += 1) {
      const u = base[0] + Math.cos(a) * i + Math.cos(a - Math.PI / 2) * wd * 0.55, v = base[1] + Math.sin(a) * i + Math.sin(a - Math.PI / 2) * wd * 0.55, q = L(u, v);
      if (get(fill, q[0], q[1]) !== NONE) put(frame, q[0], q[1], I('#ffffff'));
    }
    wings.push({ fill: bake(fill), frame: bake(frame) });
  }
  const st = L(tip[0] + dA[0] * 5, tip[1] + dA[1] * 5);
  return { body: mk(b, true), wings, tip: st };
}
const BEES = new Map();
function beeGet(ang, abd, glow, wing) {
  const k = ang.toFixed(2) + '|' + abd.toFixed(2) + '|' + glow + '|' + wing;
  let s = BEES.get(k);
  if (!s) { s = beeBuild(ang, abd, glow, wing); BEES.set(k, s); }
  return s;
}
function drawBee(e) {
  const wing = (Math.floor(G.t / 2) + e.ph) % 3, s = beeGet(e.ang, e.abd, e.glow, wing);
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.facing, 1);
  FLASH = e.hitT > 0;
  if (e.dive) {
    // speed lines streaming back from the dive (local space: the bee faces its motion)
    const mx = e.dive[0] * e.facing, my = e.dive[1];
    for (const [o, l] of [[-6, 11], [0, 18], [6, 10]]) {
      const sx = -mx * 10 - my * o, sy = -my * 10 + mx * o;
      pl(sx, sy, sx - mx * l, sy - my * l, 1, 'rgba(255,255,255,0.8)');
    }
  }
  ctx.globalAlpha = 0.42; ctx.drawImage(s.wings[0].fill, -28, -25); ctx.globalAlpha = 1; ctx.drawImage(s.wings[0].frame, -28, -25);
  blit(s.body, 0, 0);
  ctx.globalAlpha = 0.48; ctx.drawImage(s.wings[1].fill, -28, -25); ctx.globalAlpha = 1; ctx.drawImage(s.wings[1].frame, -28, -25);
  if (e.glow && !FLASH) {
    // the stinger glow: the dive telegraph (orange while charging, white-hot when it goes)
    const [tx, ty] = s.tip, hot = e.glow === 2, pulse = 0.75 + 0.25 * Math.sin(G.t * 0.6);
    ctx.fillStyle = rgba(I(hot ? '#ffd040' : '#ff8a30'), (hot ? 0.35 : 0.25) * pulse); pdisc(tx, ty, hot ? 7 : 4);
    ctx.fillStyle = rgba(I(hot ? '#fff0a0' : '#ffb050'), (hot ? 0.6 : 0.45) * pulse); pdisc(tx, ty, hot ? 3 : 2);
    if (hot) { R(Math.round(tx) - 6, Math.round(ty), 13, 1, '#fffbe0'); R(Math.round(tx), Math.round(ty) - 6, 1, 13, '#fffbe0'); R(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3, '#ffffff'); }
  }
  FLASH = false;
  ctx.restore();
}
ENEMY_TYPES.robobee = {
  hp: 2, flying: true, contact: 'none', activateMargin: 600,
  make(e, s) { e.ang = s.ang || 0; e.abd = s.abd == null ? 0.25 : s.abd; e.glow = s.glow || 0; e.ph = s.ph || 0; e.y0 = s.y; e.facing = -1; e.dive = s.dive || null; },
  update(e) { e.y = e.y0 + (e.dive ? 0 : Math.round(Math.sin(G.t * 0.17 + e.ph * 2.1))); },
  draw: drawBee,
  box: e => ({ x: e.x - 11, y: e.y - 10, w: 22, h: 18 })
};

// ============================================================
// ROBOT FROGS (green armour, big headlight eyes on top; the throat bulges before the sticky tongue lashes out)
// ============================================================
const FR4 = P('#b6f080', '#5ccf52', '#2f9a44', '#1a6232');
const FRB4 = P('#f6f8d2', '#dfeaa8', '#bccf80', '#86995a');
const SAC4 = P('#fff6e2', '#ffd9bc', '#f5ae94', '#c97c66');
const HL = P('#fff8d8', '#ffe066', '#ffb52e', '#e07a14');
function lamp(b, x, y, r) {
  oval(b, x, y, r, r * 0.95, HL[3]); oval(b, x + 0.3, y - 0.2, r - 0.8, r * 0.95 - 0.8, HL[2]);
  oval(b, x + 0.5, y - 0.4, Math.max(0.5, r - 1.6), Math.max(0.5, r - 1.7), HL[1]); put(b, x + 0.6, y - 0.5, HL[0]); put(b, x - r * 0.45, y - r * 0.5, I('#ffffff'));
}
// sitting, side view (facing right): the front raised, a wide wedge of a head with a long smiling mouth, the two
// headlight eyes on top, the throat sac ballooning under the jaw, a straight front leg, the hind leg folded in a Z
// (thigh forward to the knee, shin back, the long webbed foot forward along the pad)
function frogSitBuild() {
  const MOUTHP = P('#a02c56', '#6a1838', '#460c24', '#2e0618');
  const b = parts(66, 48, 33, 44, [
    { hit: ell(8.5, -28, 4.8, 4.5), cx: 8.5, cy: -28, ext: 4.5, pal: ST4 },
    { hit: ell(1.8, -28.8, 4.2, 4), cx: 1.8, cy: -28.8, ext: 4, pal: HD4 },
    { hit: cap(7, -11, 10, -2, 2.5), cx: 8.5, cy: -6.5, ext: 5, pal: FR4, tilt: -0.4 },
    { hit: ell(12.5, -8.6, 7.4, 5), cx: 12.5, cy: -8.6, ext: 5, pal: SAC4 },
    { hit: ell(10, -13.6, 10.6, 3, 0.16), cx: 10, cy: -13.6, ext: 3.2, pal: FR4 },                  // lower jaw, dropped open
    { hit: ell(9, -21.6, 12, 5.8, -0.1), cx: 9, cy: -21.6, ext: 5.9, pal: FR4 },                     // upper head
    { hit: cap(3, -17.4, 19, -18.6, 3.2), cx: 11, cy: -18, ext: 3, pal: MOUTHP, noSeam: true },      // the open mouth
    { hit: ell(-9.5, -8.5, 7.8, 4.9, 0.12), cx: -9.5, cy: -8.5, ext: 5, pal: FR4 },
    { hit: cap(-3.5, -5.5, -15, -2.6, 2.5), cx: -9, cy: -4, ext: 3, pal: FR4 },
    { hit: ell(-3.5, -13.6, 13, 9.8, -0.34), cx: -3.5, cy: -13.6, ext: 10, pal: (x, y) => (x > 0 && y > -11.5 ? FRB4 : FR4) },
    { hit: cap(-16.5, -1.6, 2, -1.2, 1.9), cx: -7, cy: -1.4, ext: 2, pal: FR4 }
  ]);
  lamp(b, 9.6, -28.2, 3.3);
  lamp(b, 2.7, -29, 2.5);
  // inside the mouth: the tongue's root; a steel lip along both jaws; the jaw bolt; a nostril
  rect(b, 12, -18, 8, 1, I('#ff6fa8')); rect(b, 14, -17, 6, 1, I('#e04a86'));
  for (let x = 4; x <= 20; x++) { if (get(b, x, -16) === FR4[1] || get(b, x, -16) === FR4[0]) put(b, x, -16, I('#d8e4ec')); }
  rect(b, -3, -20, 3, 3, ST4[1]); put(b, -3, -20, ST4[0]); put(b, -1, -18, ST4[3]); put(b, -2, -19, ST4[3]);
  put(b, 19, -24, I('#123d1e'));
  // a seam across the head (the helmet line), rivets, dark spots on the back
  path(b, [[1, -23.5], [8, -24.5], [15, -23]], FR4[2]);
  for (const [x, y] of [[4, -21], [13, -21], [-7, -20], [-13, -15], [-1, -12]]) put(b, x, y, I('#e0f8b0'));
  for (const [x, y] of [[-10, -19], [-3, -21], [-15, -12], [-6, -15]]) rect(b, x, y, 2, 2, I('#2a7a3a'));
  // the throat sac stretched tight: a glossy highlight and stretch lines
  for (const [x, y] of [[8, -11], [9, -12], [10, -12], [11, -12], [12, -12]]) put(b, x, y, I('#ffffff'));
  for (const [x, y] of [[16, -6], [17, -7], [11, -5], [18, -9]]) put(b, x, y, SAC4[2]);
  // a steel piston along the thigh, the knee joint
  line(b, -15, -11, -5, -9, ST4[2], 2); line(b, -15, -12, -5, -10, ST4[0]);
  oval(b, -3.5, -6, 1.5, 1.5, ST4[2]); put(b, -4, -7, ST4[0]);
  // webbed toes on the pad
  for (const [x, y] of [[9, 0], [11, 0], [13, -1]]) { put(b, x, y, FR4[1]); put(b, x + 1, y, FR4[2]); }
  for (const [x, y] of [[2, -1], [3, 0], [1, 0]]) put(b, x, y, FR4[1]);
  outline(b);
  return mk(b, true);
}
function frogLeapBuild() {
  const a = -0.48, f = [Math.cos(a), Math.sin(a)], n = [Math.sin(a), -Math.cos(a)];
  const at = (u, v) => [f[0] * u + n[0] * v, f[1] * u + n[1] * v];
  const hd = at(11, 2), e1 = at(12, 8.4), e2 = at(6.4, 8.2), ch = at(6, -5), hp = at(-10, -2);
  const b = parts(84, 60, 42, 30, [
    { hit: ell(e1[0], e1[1], 4.5, 4.4), cx: e1[0], cy: e1[1], ext: 4.4, pal: ST4 },
    { hit: ell(e2[0], e2[1], 4, 3.9), cx: e2[0], cy: e2[1], ext: 3.9, pal: HD4 },
    { hit: cap(ch[0], ch[1], ch[0] + 9, ch[1] + 8, 2.6), cx: ch[0] + 4, cy: ch[1] + 4, ext: 5, pal: FR4 },
    { hit: ell(hd[0], hd[1], 10.5, 6.8, a), cx: hd[0], cy: hd[1], ext: extY(10.5, 6.8, a), pal: FR4 },
    { hit: ell(0, 0, 14, 9.4, a), cx: 0, cy: 0, ext: extY(14, 9.4, a), pal: (x, y) => ((x - 2) * n[0] + y * n[1] < -3.5 ? FRB4 : FR4) },
    { hit: cap(hp[0], hp[1], hp[0] - 11, hp[1] + 7, 4.2), cx: hp[0] - 5, cy: hp[1] + 3, ext: 5.5, pal: FR4 },
    { hit: cap(hp[0] - 11, hp[1] + 7, hp[0] - 22, hp[1] + 11, 2.5), cx: hp[0] - 16, cy: hp[1] + 9, ext: 3.5, pal: FR4 },
    { hit: cap(hp[0] - 22, hp[1] + 11, hp[0] - 32, hp[1] + 12, 2), cx: hp[0] - 27, cy: hp[1] + 11.5, ext: 2.5, pal: FR4 },
    { hit: cap(ch[0] - 3, ch[1] + 1, ch[0] + 5, ch[1] + 11, 2.2), cx: ch[0] + 1, cy: ch[1] + 6, ext: 5, pal: [FR4[1], FR4[2], FR4[3], FR4[3]] }
  ]);
  lamp(b, e1[0] + 1.2, e1[1] - 0.3, 3.2);
  lamp(b, e2[0] + 1, e2[1] - 0.4, 2.4);
  const m0 = at(20.5, 0), m1 = at(7, -1);
  line(b, m0[0], m0[1], m1[0], m1[1], I('#1a4a26'));
  for (const [u, v] of [[-4, 6], [-11, 4], [3, 6]]) { const q = at(u, v); put(b, q[0], q[1], I('#e0f8b0')); }
  for (const [u, v] of [[-6, 3], [-1, 7], [-12, 1]]) { const q = at(u, v); rect(b, q[0], q[1], 2, 2, I('#2a7a3a')); }
  const k0 = [hp[0] - 2, hp[1] - 2], k1 = [hp[0] - 12, hp[1] + 4];
  line(b, k0[0], k0[1], k1[0], k1[1], ST4[2], 2); line(b, k0[0], k0[1] - 1, k1[0], k1[1] - 1, ST4[0]);
  const ft = [hp[0] - 32, hp[1] + 12];
  for (const [dx, dy] of [[-2, -3], [-4, 0], [-2, 3]]) line(b, ft[0], ft[1], ft[0] + dx, ft[1] + dy, FR4[1]);
  outline(b);
  return mk(b, true);
}
let FROG_SIT = null, FROG_LEAP = null;
function drawFrog(e) {
  if (!FROG_SIT) { FROG_SIT = frogSitBuild(); FROG_LEAP = frogLeapBuild(); }
  FLASH = e.hitT > 0;
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.facing, 1);
  if (e.pose === 'leap') {
    blit(FROG_LEAP, 0, 0);
    if (!FLASH) { ctx.fillStyle = 'rgba(255,200,90,0.22)'; pdisc(16, -9, 5); }
  } else {
    blit(FROG_SIT, 0, 0);
    if (!FLASH) { ctx.fillStyle = 'rgba(255,200,90,0.22)'; pdisc(10, -28, 6); ctx.fillStyle = 'rgba(255,232,140,0.35)'; pdisc(10, -28, 3); }
  }
  ctx.restore();
  if (e.tongue && !FLASH) drawTongue(e);
  FLASH = false;
}
// the long pink sticky tongue: from the mouth in a whipping arc to a sticky blob, speed lines along it
function drawTongue(e) {
  const mx = e.x + e.facing * 18, my = e.y - 18, [tx, ty] = e.tongue, pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    pts.push([lerp(mx, tx, t), lerp(my, ty, t) - Math.sin(Math.PI * t) * 7 + Math.sin(t * 9) * 0.6 * t]);
  }
  for (let i = 0; i + 1 < pts.length; i++) pl(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 3, '#000', true);
  for (let i = 0; i + 1 < pts.length; i++) pl(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 3, '#f0609a');
  for (let i = 0; i + 1 < pts.length; i++) pl(pts[i][0], pts[i][1] - 1, pts[i + 1][0], pts[i + 1][1] - 1, 1, '#ff9ac4');
  for (let i = 2; i + 1 < pts.length; i += 3) pl(pts[i][0], pts[i][1] + 1, pts[i + 1][0], pts[i + 1][1] + 1, 1, '#b83a72');
  const X = Math.round(tx), Y = Math.round(ty);
  RO(X - 4, Y - 3, 7, 6, '#f0609a'); R(X - 5, Y - 2, 1, 4, OUT); R(X - 4, Y - 3, 5, 1, '#ffb6d6'); R(X - 3, Y - 2, 2, 1, '#ffffff');
  R(X - 4, Y + 2, 7, 1, '#b83a72');
  R(X - 2, Y + 4, 1, 2, '#f0609a'); R(X + 1, Y + 4, 1, 3, '#f0609a'); R(X + 1, Y + 7, 1, 1, '#ffb6d6');
  for (const [o, k0, k1] of [[-5, 0.25, 0.55], [5, 0.35, 0.7], [-8, 0.55, 0.8]]) {
    const a = pts[Math.round(k0 * 24)], c = pts[Math.round(k1 * 24)];
    pl(a[0], a[1] + o, c[0], c[1] + o, 1, 'rgba(255,255,255,0.8)');
  }
}
ENEMY_TYPES.robofrog = {
  hp: 4, contact: 'none', activateMargin: 600,
  make(e, s) { e.pose = s.pose || 'sit'; e.tongue = s.tongue || null; e.y0 = s.y; e.facing = -1; },
  update(e) { e.y = e.y0; },
  draw: drawFrog,
  box: e => e.pose === 'leap' ? { x: e.x - 16, y: e.y - 16, w: 32, h: 26 } : { x: e.x - 17, y: e.y - 30, w: 34, h: 30 }
};

// ============================================================
// The ROBOT HIVE (a prop hanging from the branch): hexagon steel plates, glowing honey windows, a dark entrance
// ============================================================
function hiveBuild() {
  const b = buf(62, 104, 31, 18), S = 4.8, SQ3 = Math.sqrt(3);
  const hw = y => y < 0 ? 0 : y < 6 ? 9 : 25 * Math.pow(Math.max(0, Math.sin(Math.PI * (0.08 + 0.92 * clamp((y - 5) / 69, 0, 1)))), 0.7);
  const PLT = P('#e3eaf0', '#b7c2cd', '#8b97a6', '#66717f', '#4b5461'), SEAM = I('#353b45'), HON = P('#fff1a8', '#ffcf4a', '#f2a325', '#c0700f');
  const hexAt = (x, y) => {
    const q = (2 / 3 * x) / S, r = (-1 / 3 * x + SQ3 / 3 * y) / S;
    let cx = q, cz = r, cy = -cx - cz, rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    return [rx, rz, S * 1.5 * rx, S * SQ3 * (rz + rx / 2)];
  };
  const shadeAt = (x, y) => -(x / 25) * 0.6 - ((y - 30) / 38) * 0.5 - ss(0.55, 1, Math.abs(x) / Math.max(1, hw(y))) * 0.7;
  for (let y = 9; y < 76; y++) {
    const w = hw(y);
    for (let x = -Math.floor(w); x <= w; x++) {
      const [q, r, hx, hy] = hexAt(x + 0.5, y + 1.5), dx = Math.abs(x + 0.5 - hx), dy = Math.abs(y + 1.5 - hy);
      const d = Math.max(dy, dx * SQ3 / 2 + dy / 2), ap = S * SQ3 / 2;
      if (d > ap - 0.85) { put(b, x, y, SEAM); continue; }
      const L = shadeAt(hx, hy - 1.5), honey = nz(q + 40, r + 40) > 0.7 && Math.abs(hx) < hw(hy) - 6 && hy > 14 && hy < 62;
      const bev = ((x + 0.5 - hx) + (y + 1.5 - hy)) / ap;
      if (honey) { put(b, x, y, bev < -0.7 ? HON[0] : bev > 0.6 ? HON[3] : bev > 0 ? HON[2] : HON[1]); continue; }
      let k = L > 0.45 ? 0 : L > 0.05 ? 1 : L > -0.4 ? 2 : L > -0.85 ? 3 : 4;
      if (bev < -0.75) k = Math.max(0, k - 1); else if (bev > 0.7) k = Math.min(4, k + 1);
      put(b, x, y, PLT[k]);
    }
  }
  // the collar: a band in bee colours under the clamp
  for (let y = 4; y < 10; y++) { const w = hw(y) + (y > 6 ? 1 : 0); for (let x = -Math.floor(w); x <= w; x++) put(b, x, y, y === 4 || y === 9 ? SEAM : ((x + y * 2 + 40) % 6 < 3 ? GOLD[1] : BLK4[1])); }
  // the entrance: a dark round door with honey light inside and a landing lip
  oval(b, -9, 52, 6, 5, OUTI); oval(b, -9, 52, 5, 4, I('#3a2410')); oval(b, -9, 54, 3.4, 1.6, I('#a8560e')); rect(b, -11, 55, 5, 1, I('#ffb52e')); put(b, -9, 56, I('#ffd86a'));
  rect(b, -16, 58, 15, 2, I('#c3cdd8')); rect(b, -16, 60, 15, 1, I('#6e7a8a'));
  // the clamp: a steel strap over the branch with bolts
  for (let y = -14; y < 4; y++) for (let x = -3; x <= 3; x++) put(b, x, y, x === -3 ? PLT[0] : x === 3 ? PLT[3] : PLT[1]);
  for (let x = -5; x <= 5; x++) { put(b, x, 2, PLT[2]); put(b, x, 3, PLT[3]); }
  for (const y of [-12, -2]) { put(b, 0, y, I('#ffffff')); put(b, 1, y + 1, PLT[4]); }
  // a red status lamp on the shoulder, honey oozing from a seam
  oval(b, 16, 18, 2.2, 2.2, PLT[4]); put(b, 16, 18, EVIL_I); put(b, 15, 17, I('#ffd0cc'));
  for (let y = 64; y < 72; y++) put(b, 4, y, y < 68 ? HON[1] : HON[2]);
  outline(b);
  return mk(b, true);
}
let HIVE_S = null;
PROP_TYPES.robohive = {
  make(o) { o.hp = 40; },
  box: o => ({ x: o.x - 22, y: o.y + 6, w: 44, h: 68 }),
  hit(o, d) { if (propHurt(o, d)) { o.dead = true; boom(o.x, o.y + 38, 1.4); debris(o.x, o.y + 38, 12, '#ffd23f'); addScore(1000, o.x, o.y + 20); } },
  draw(o) {
    if (!HIVE_S) HIVE_S = hiveBuild();
    blit(HIVE_S, o.x, o.y);
    // honey drip: a strand stretching from the bottom, the drop falling and forming again
    const t = (G.t + 20) % 90, len = Math.round(Math.min(9, 2 + t / 8)), x = Math.round(o.x) + 4, y = o.y + 72;
    R(x, y, 1, len, '#f2a325');
    R(x - 1, y + len - 1, 3, 1, OUT); R(x - 2, y + len, 5, 3, OUT); R(x - 1, y + len + 3, 3, 1, OUT);
    R(x - 1, y + len, 3, 3, '#ffcf4a'); R(x - 1, y + len, 1, 1, '#fff1a8'); R(x + 1, y + len + 2, 1, 1, '#c0700f');
    ctx.fillStyle = 'rgba(255,200,80,0.14)'; pdisc(o.x - 9, o.y + 52, 9);
    if (Math.floor(G.t / 20) % 2) { ctx.fillStyle = 'rgba(255,60,40,0.35)'; pdisc(o.x + 16, o.y + 18, 3); }
  }
};

// ============================================================
// The PARROT in a robot cage (POW kind), a HELP! bubble over it
// ============================================================
const RED4 = P('#ff7a5a', '#e8352a', '#b01e1e', '#7a1414');
const BLU4 = P('#8ac4ff', '#2f7fe0', '#1d58b0', '#123a7a');
const FACE4 = P('#ffffff', '#f2eee6', '#d8d2c6', '#b8b0a2');
function parrotBuild() {
  // facing left (toward the hero), anchor at the feet on the perch
  const b = parts(36, 44, 18, 40, [
    { hit: ell(-4.5, -23.5, 5.4, 5.2), cx: -4.5, cy: -23.5, ext: 5.2, pal: (x, y) => (x < -5.5 && y > -25 ? FACE4 : RED4) },
    { hit: ell(2.2, -13.5, 4.4, 7, 0.35), cx: 2.2, cy: -13.5, ext: 7, pal: (x, y) => (y < -15.5 ? GOLD : BLU4) },
    { hit: ell(-1.5, -12.5, 6, 7.8, 0.15), cx: -1.5, cy: -12.5, ext: 7.8, pal: RED4 },
    { hit: cap(2.5, -7, 9, 5, 2.4), cx: 5, cy: -1, ext: 5, pal: (x, y) => (y > 0 ? BLU4 : RED4) }
  ]);
  // the big hooked beak (open: it is shouting HELP!) and the eye
  for (const [x, y, c] of [[-10, -26, '#f4ecdc'], [-11, -26, '#f4ecdc'], [-12, -25, '#f4ecdc'], [-11, -25, '#e6dac4'], [-10, -25, '#e6dac4'], [-13, -24, '#d8ccb4'], [-12, -24, '#e6dac4'], [-13, -23, '#3a3030'],
    [-11, -21, '#3a3030'], [-12, -21, '#3a3030'], [-10, -21, '#3a3030'], [-11, -22, '#e8302a'], [-10, -22, '#e8302a'], [-10, -23, '#5a1414'], [-11, -23, '#5a1414']]) put(b, x, y, I(c));
  put(b, -6, -25, I('#1a1a26')); put(b, -7, -25, I('#1a1a26')); put(b, -6, -26, I('#ffffff'));
  for (let x = -9; x < -5; x++) put(b, x, -23, I('#e8dcd0'));
  rect(b, -4, -1, 2, 1, I('#5a5a62')); rect(b, 0, -1, 2, 1, I('#5a5a62'));
  outline(b);
  return mk(b);
}
let PARROT = null;
function cageDraw(o, cw, ch) {
  const x0 = -(cw >> 1), x1 = x0 + cw, top = -ch, bh = ch - 6, n = Math.max(2, Math.round(cw / 8) - 1);
  ctx.globalAlpha = 0.55; R(x0 + 2, top + 4, cw - 4, 1, METD);
  for (let i = 0; i <= n; i++) R(x0 + Math.round((i + 0.5) * cw / (n + 1)), top + 4, 1, ch - 8, METD);
  ctx.globalAlpha = 1;
  R(x0 + 2, -7, cw - 4, 2, '#8a6038'); R(x0 + 2, -7, cw - 4, 1, '#b0814f');
  const hop = Math.floor((o.t + 7) / 9) % 4 === 0 ? -1 : 0;
  blit(PARROT, 1, -7 + hop);
  for (let i = 1; i <= n; i++) { const x = x0 + Math.round(i * cw / (n + 1)) - 1; R(x, top + 3, 1, bh, OUT); R(x + 1, top + 3, 1, bh, METL); R(x + 1, top + bh, 1, 3, MET); }
  for (const px of [x0, x1 - 2]) { RO(px, top + 2, 2, bh + 1, MET); R(px, top + 2, 1, bh + 1, METL); }
  RO(x0 - 1, top, cw + 2, 3, METD); R(x0 - 1, top, cw + 2, 1, METL);
  for (let x = x0 + 2; x < x1 - 1; x += 5) R(x, top + 1, 1, 1, METDD);
  RO(x0 - 1, -4, cw + 2, 4, METDD);
  for (let r = 0; r < 3; r++) for (let x = x0 - 1 + ((r + 4) & 3); x < x1 + 1; x += 4) R(x, -3 + r, Math.min(2, x1 + 1 - x), 1, '#f1c40f');
  R(x0 - 1, -4, cw + 2, 1, '#6a737e');
  const on = Math.floor(o.t / 12) % 2 === 0;
  blob([[-4, top - 4, 8, 4], [-3, top - 5, 6, 1]], METD); R(-3, top - 4, 6, 1, METL); R(-4, top - 1, 8, 1, METDD);
  RO(-2, top - 3, 4, 2, '#2a0c0c'); R(-2, top - 3, 2, 2, on ? EVIL : '#7a1f1f'); if (on) R(-2, top - 3, 1, 1, '#ffd0cc');
  R(0, top - 8, 1, 3, METDD); R(0, top - 9, 1, 1, on ? EVIL : '#5a1a1a');
}
POW_KINDS.parrot = {
  thanks: 'THANK YOU!',
  draw(o) {
    if (!PARROT) PARROT = parrotBuild();
    const cw = 30, ch = 38;
    ctx.save(); ctx.translate(Math.round(o.x), Math.round(o.y));
    if (o.state === 'tied') {
      cageDraw(o, cw, ch);
      const by = -ch - 24 + (Math.floor(o.t / 10) % 2);
      RO(-16, by, 33, 11, '#ffffff'); R(-16, by + 10, 33, 1, '#d8dce6');
      R(-2, by + 11, 5, 1, '#ffffff'); R(-1, by + 12, 3, 1, '#ffffff'); R(0, by + 13, 1, 1, '#ffffff');
      R(-3, by + 11, 1, 1, OUT); R(3, by + 11, 1, 1, OUT); R(-2, by + 12, 1, 1, OUT); R(2, by + 12, 1, 1, OUT); R(-1, by + 13, 1, 1, OUT); R(1, by + 13, 1, 1, OUT); R(0, by + 14, 1, 1, OUT);
      text('HELP!', 1, by + 2, '#e0302a', 1, 'center', null);
    } else blit(PARROT, 0, 0);
    ctx.restore();
  },
  box: o => ({ x: o.x - 15, y: o.y - 38, w: 30, h: 38 })
};

// ============================================================
// Foreground plants (screen space, in front of everything, kept to the bottom corners)
// ============================================================
const DARKL = P('#4a8650', '#346a3c', '#24502c', '#16361d');
function paintFrontL() {
  const b = buf(130, 84, 12, -192);
  bigLeaf(b, 30, 276, -1.75, 44, 15, 0.35, DARKL, 22, false);
  bigLeaf(b, -14, 276, -0.92, 66, 20, 0.28, DARKL, 21, true);
  bigLeaf(b, 60, 278, -1.3, 34, 11, 0.42, DARKL, 23, false);
  outline(b, I('#0b160c'));
  return b;
}
function paintFrontR() {
  const b = buf(116, 50, -378, -228);
  fern(b, 462, 272, 26, [DARKL[0], DARKL[1], DARKL[2]]);
  fern(b, 428, 274, 18, [DARKL[0], DARKL[1], DARKL[2]]);
  bigLeaf(b, 494, 274, -2.2, 30, 9, 0.35, DARKL, 24, false);
  outline(b, I('#0b160c'));
  return b;
}

// ============================================================
// Building (once, on the first draw) and the frame's live bits
// ============================================================
let LAY = null;
function build() {
  if (LAY) return LAY;
  LAY = {
    sky: mk(paintSky()), volc: mk(paintVolcano()), far: mk(paintFar()), cliff: mk(paintCliff()), mid: mk(paintMid()), near: mk(paintNear()),
    shaft: shaftCanvas(), tree: mk(paintTree()), hang: mk(paintHang()), bush: mk(paintBush()), giants: mk(paintGiants()), log: mk(paintLog()),
    ledge: mk(paintLedge()), ground: mk(paintGround()), frontL: mk(paintFrontL()), frontR: mk(paintFrontR())
  };
  return LAY;
}
function strip(s, cx, p) { ctx.drawImage(s.img, Math.round(-s.ax - (cx - CAM) * p), -s.ay); }
function world(s) { ctx.drawImage(s.img, CAM - s.ax, -s.ay); }
// the waterfall ribbon behind the pond (live: the water streams down)
function waterfall(cx) {
  // art director pass: real water colours (teal edges, a darker band inside them, a pale core, white and blue
  // streaks) so the falls read as water against the misty cliff instead of a pale beam of light
  const ox = Math.round(-(cx - CAM) * 0.2), y0 = WF.top, y1 = 206;
  const WFC = ['#4f8f9f', '#79b9c4', '#a9dbe1', '#d9f2f3'];
  for (let x = WF.x0; x <= WF.x1; x++) {
    const e = Math.min(x - WF.x0, WF.x1 - x), sp = 2.2 + (x % 3) * 0.4;
    ctx.fillStyle = WFC[Math.min(3, e)]; ctx.fillRect(x + ox, y0, 1, y1 - y0);
    for (let y = y0; y < y1; y++) {
      const q = ((y - G.t * sp + hsh(x) * 50) % 11 + 11) % 11;
      if (q < 3 && e > 0) { ctx.fillStyle = e > 1 ? '#ffffff' : '#c8eef0'; ctx.fillRect(x + ox, y, 1, 1); }
      else if (q > 7.5 && e > 0 && e < 4) { ctx.fillStyle = e === 1 ? '#5d9fae' : '#86c3cc'; ctx.fillRect(x + ox, y, 1, 1); }
    }
  }
  // the lip where the water rolls over the cliff edge: a bright curl with a dark shadow under it
  ctx.fillStyle = '#ffffff'; ctx.fillRect(WF.x0 + ox - 1, y0, WF.x1 - WF.x0 + 3, 1);
  ctx.fillStyle = '#e6f8f8'; ctx.fillRect(WF.x0 + ox, y0 + 1, WF.x1 - WF.x0 + 1, 1);
  ctx.fillStyle = '#4f8f9f'; ctx.fillRect(WF.x0 + ox - 1, y0 + 1, 1, 3); ctx.fillRect(WF.x1 + ox + 1, y0 + 1, 1, 3);
  for (let i = 0; i < 9; i++) { const t = (G.t * 0.4 + i * 9) % 40; ctx.fillStyle = 'rgba(240,250,250,' + (0.34 * (1 - t / 40)).toFixed(3) + ')'; pdisc(WF.x0 + ox + 7 + (i - 4) * 4, y1 - 8 - t * 0.3, 4 + t * 0.15); }
}
// the cascade into the pond, shimmer, ripples round the frog's pad and the leaping frog's take-off
function pondLive() {
  for (let x = 302; x <= 314; x++) {
    ctx.fillStyle = x === 302 || x === 314 ? '#5d9fae' : x === 303 || x === 313 ? '#a9dbe1' : '#e6f8f8'; ctx.fillRect(WX(x), 214, 1, 16);
    ctx.fillStyle = '#ffffff';
    for (let y = 214; y < 230; y++) if (((y - G.t * 2.4 + hsh(x) * 30) % 7 + 7) % 7 < 2) ctx.fillRect(WX(x), y, 1, 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 6; i++) pdisc(WX(300 + i * 3), 229 + (i % 2), 2 + (i % 3 === 0 ? 1 : 0));
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 26; i++) {
    const y = 233 + Math.floor(hsh(i * 3.1) * 36), x = 205 + hsh(i * 7.7) * 210 + Math.sin(G.t * 0.03 + i) * 3, w = 2 + Math.floor(hsh(i * 1.3) * 4);
    if (x > shoreL(y) + 3 && x + w < shoreR(y) - 2) ctx.fillRect(WX(Math.round(x)), y, w, 1);
  }
  ctx.fillStyle = 'rgba(235,255,250,0.85)';
  for (const [x, y, r] of [[262, 233, 19], [262, 233, 25], [364, 238, 6], [364, 238, 11]]) {
    for (let a = 0; a < Math.PI * 2; a += 0.1) if (Math.sin(a) > -0.2) ctx.fillRect(Math.round(WX(x) + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.22), 1, 1);
  }
  ctx.fillStyle = '#e8fbff';
  for (const [x, y] of [[352, 192], [358, 206], [349, 214], [362, 224], [355, 230]]) ctx.fillRect(WX(x), y, 1, 2);
  // where the leaping frog will come down: its shadow on the pad grows as it falls (the landing telegraph)
  ctx.fillStyle = 'rgba(16,44,36,0.45)';
  for (let j = -2; j <= 2; j++) { const hw = Math.round(11 * Math.sqrt(1 - (j / 2.6) ** 2)); ctx.fillRect(WX(304) - hw, 240 + j, hw * 2 + 1, 1); }
  ctx.fillStyle = 'rgba(16,44,36,0.3)';
  for (let j = -1; j <= 1; j++) { const hw = Math.round(6 * Math.sqrt(1 - (j / 1.6) ** 2)); ctx.fillRect(WX(304) - hw, 240 + j, hw * 2 + 1, 1); }
}

// a blue morpho butterfly (screen space): frames open, half, closed
const MORPHO = (() => {
  const pal = { k: '#14203a', B: '#3aa0ff', L: '#a8e4ff', b: '#1c5ec8' };
  return [
    makeSprite(['.kk...kk.', 'kBBk.kBBk', 'kLBBkBBLk', '.kBBkBBk.', '..kbkbk..', '...kkk...'], pal),
    makeSprite(['..k...k..', '.kBk.kBk.', '.kLBkBLk.', '..kbkbk..', '...kkk...'], pal),
    makeSprite(['...kk..', '..kBBk.', '..kLBk.', '..kBk..', '...k...'], pal)
  ];
})();
function morpho(x, y, f) { const s = MORPHO[f]; spr(s, x - (s.w >> 1), y - (s.h >> 1)); }

// ============================================================
// The frame's action: pinned every update, so the picture is the same whatever --frames is
// ============================================================
let BOLT = null, PLATE = null, SHARD = null;
function burstSprites() {
  const b1 = buf(5, 5, 2, 2); rect(b1, -1, -1, 3, 3, I('#8a97a8')); put(b1, -1, -1, I('#c3cdd8')); put(b1, 0, 0, I('#3b424d')); outline(b1);
  const b2 = buf(9, 6, 4, 3); rect(b2, -3, -1, 7, 3, YEL4[1]); rect(b2, -3, -1, 7, 1, YEL4[0]); rect(b2, -1, -1, 2, 3, BLK4[1]); outline(b2);
  const b3 = buf(8, 6, 4, 3); rect(b3, -3, -1, 6, 2, I('#e2f7ff')); put(b3, -3, -1, I('#ffffff')); outline(b3, I('#3f5a72'));
  BOLT = mk(b1); PLATE = mk(b2); SHARD = mk(b3);
}
function frameFx() {
  if (!BOLT) burstSprites();
  const bx = WX(BURST.x), by = BURST.y, out = [];
  out.push({ type: 'flash', x: bx, y: by, life: 3, max: 5, size: 12 });
  for (const [dx, dy, s, life] of [[0, 0, 6, 30], [-4, 2, 4.5, 26], [4, -2, 5, 22], [-1, -5, 4, 18], [5, 4, 3.5, 14], [-6, -3, 3, 12]]) out.push({ type: 'fire', x: bx + dx, y: by + dy, vx: 0, vy: 0, life, max: 34, size: s });
  for (const [dx, dy, rot, s] of [[-15, -6, 0.6, PLATE], [13, -11, -0.9, BOLT], [-10, 10, 1.4, BOLT], [16, 5, 0.3, SHARD], [3, -16, 2.2, BOLT], [-18, 3, -0.5, SHARD], [9, 12, 1.1, PLATE]]) out.push({ type: 'sprite', x: bx + dx, y: by + dy, vx: 0, vy: 0, rot, s, life: 40, max: 40 });
  for (const [dx, dy] of [[-8, -12], [9, -3], [6, 11], [-11, 6], [2, 13], [13, -8]]) out.push({ type: 'spark', x: bx + dx, y: by + dy, vx: 0, vy: 0, life: 10, max: 16, size: 1, c: '#ffe066' });
  // the puff of moss dust he kicked off the log, where the frog's tongue now lands
  for (const [dx, dy, s, life] of [[-4, -2, 3, 22], [3, -3, 3.5, 20], [9, -1, 2.5, 17], [-9, -1, 2, 15]]) out.push({ type: 'dust', x: WX(HERO.x) + dx, y: LOGP.y + dy, vx: 0, vy: 0, life, max: 26, size: s });
  out.push({ type: 'debris', x: WX(HERO.x) - 6, y: HERO.y - 30, vx: 0, vy: 0, life: 30, max: 40, size: 2, c: '#e8b43a' });
  out.push({ type: 'debris', x: WX(HERO.x) - 11, y: HERO.y - 38, vx: 0, vy: 0, life: 30, max: 40, size: 2, c: '#e8b43a' });
  return out;
}

const BEE_SPAWNS = [
  { t: 'robobee', x: WX(210), y: 126, ang: -0.5, abd: 2.26, glow: 2, ph: 1, dive: [-0.93, 0.37] },   // diving at the hero
  { t: 'robobee', x: WX(247), y: 101, ang: -0.06, abd: 0.32, glow: 1, ph: 0 },                       // the point of the V, charging
  { t: 'robobee', x: WX(273), y: 87, ang: 0.05, abd: 0.25, ph: 1 },
  { t: 'robobee', x: WX(300), y: 74, ang: -0.08, abd: 0.3, ph: 2 },
  { t: 'robobee', x: WX(275), y: 116, ang: 0.1, abd: 0.2, ph: 2 },
  { t: 'robobee', x: WX(303), y: 129, ang: 0, abd: 0.3, ph: 0 },
  { t: 'robobee', x: WX(362), y: 106, ang: 0.15, abd: 0.2, ph: 1 }                                   // just out of the hive
];
const FROG_SPAWNS = [
  { t: 'robofrog', x: WX(264), y: 232, pose: 'sit', tongue: [WX(181), 197] },
  { t: 'robofrog', x: WX(338), y: 166, pose: 'leap' }
];

LEVELS.push({
  mission: 'MISSION 3', title: 'VOLCANO ISLAND', end: 4800, heroStart: 120, freedLabel: 'ANIMALS RESCUED',
  sections: [{ x: 0, name: 'AREA 1: SHARK BAY' }, { x: CAM, name: 'AREA 2: HONEY JUNGLE' }, { x: 2400, name: 'AREA 3: LAVA RIVERS' }, { x: 3900, name: 'FINAL AREA: THE CRATER' }],
  terrain: null,
  plats: [LOGP, LEDGEP],
  spawns: [...BEE_SPAWNS, ...FROG_SPAWNS],
  pows: [{ x: WX(CAGE_X), item: 'B', kind: 'parrot' }],
  props: [{ k: 'robohive', x: WX(HIVE.x), y: HIVE.y }],
  locks: [],
  music: 'main', bossMusic: 'boss',
  load() {
    for (const o of G.pows) if (o.kind === 'parrot') o.y = LEDGEP.y;
    G.big = null;
  },
  update() {
    const p = G.p;
    Object.assign(p, { x: WX(HERO.x), y: HERO.y, vx: 0, vy: -0.9, onGround: false, onPlat: null, facing: 1, aim: 'up', crouch: false,
      knife: 0, muzzle: 3, weapon: 'hmg', ammo: 146, bombs: 8, hearts: 3, inv: 0, dead: 0, kb: 0, ride: null, hidden: false });
    G.lives = 3; G.score = 61200;                 // art director: after Shark Bay (46850), before Lava Rivers (87350)
    G.big = null; G.banner = { s: 'AREA 2: HONEY JUNGLE', t: 100 };
    // two HMG rounds on their way up (the one before them just burst a bee)
    G.pb = [{ x: WX(HERO.x) + 5, y: 112, vx: 0.2, vy: -7, dmg: 1, life: 60, draw: hmgShot }, { x: WX(HERO.x) + 6, y: 99, vx: -0.3, vy: -7, dmg: 1, life: 60, draw: hmgShot }];
    G.parts = frameFx();
    G.texts = [{ x: WX(BURST.x), y: BURST.y - 20, s: '100', t: 40, c: '#ffffff' }];
    G.eb = []; G.items = []; G.grenades = [];
  },
  drawBG(cx) {
    const l = build();
    strip(l.sky, cx, 0);
    strip(l.volc, cx, 0.02);
    // the faint orange glow at the crater
    const vx = VX - Math.round((cx - CAM) * 0.02), k = 0.8 + 0.2 * Math.sin(G.t * 0.05);
    ctx.fillStyle = 'rgba(255,150,90,' + (0.16 * k).toFixed(3) + ')'; pdisc(vx + 1, VY + 1, 7);
    ctx.fillStyle = 'rgba(255,190,120,' + (0.22 * k).toFixed(3) + ')'; pdisc(vx + 1, VY + 2, 3);
    strip(l.far, cx, 0.08);
    strip(l.cliff, cx, 0.2);
    waterfall(cx);
    strip(l.mid, cx, 0.35);
    ctx.globalAlpha = 0.66 + 0.16 * Math.sin(G.t * 0.017); ctx.drawImage(l.shaft, -10, 0); ctx.globalAlpha = 1;
    strip(l.near, cx, 0.6);
  },
  drawBehind() {
    const l = build();
    world(l.tree); world(l.hang); world(l.giants); world(l.bush);
  },
  drawGround() {
    const l = build();
    world(l.ground);
    pondLive();
  },
  drawPlat(pl2) { const l = build(); world(pl2.t === 'log' ? l.log : l.ledge); },
  drawFront() {
    const l = build();
    ctx.drawImage(l.frontL.img, -l.frontL.ax, -l.frontL.ay);
    ctx.drawImage(l.frontR.img, -l.frontR.ax, -l.frontR.ay);
  },
  drawOverlay() {
    const l = build();
    ctx.globalAlpha = 0.2; ctx.drawImage(l.shaft, -10, 0); ctx.globalAlpha = 1;
    // steam rising off the hot spring
    for (let i = 0; i < 22; i++) {
      const ph = ((G.t * 0.45 + i * 41) % 170) / 170, x = (i % 5 === 0 ? 206 + hsh(i * 5.3) * 26 : 284 + hsh(i * 5.3) * 132) + ph * 22, y = 234 - ph * 96, r = 3 + ph * 11;
      ctx.fillStyle = 'rgba(246,252,250,' + (Math.sin(Math.PI * ph) * 0.24).toFixed(3) + ')'; pdisc(x, y, r);
      ctx.fillStyle = 'rgba(255,255,255,' + (Math.sin(Math.PI * ph) * 0.16).toFixed(3) + ')'; pdisc(x - r * 0.3, y - r * 0.3, r * 0.5);
    }
    // curling wisps of steam off the hot water
    for (const [x0, y0, h, ph] of [[232, 262, 36, 0], [284, 252, 40, 1.3], [330, 266, 50, 2.1], [370, 248, 40, 0.7], [404, 260, 34, 2.8], [214, 248, 22, 1.9]]) {
      for (let k = 0; k < h; k++) {
        const a = 0.55 * (1 - k / h) * Math.min(1, k / 5), x = x0 + Math.sin(k * 0.2 + G.t * 0.05 + ph) * (2 + k * 0.1);
        ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; ctx.fillRect(Math.round(x), y0 - k, 2, 1);
        if (k % 9 === 4) ctx.fillRect(Math.round(x) + 2, y0 - k, 1, 1);
      }
    }
    // two blue morpho butterflies flitting by the flowers
    for (const [x, y, ph] of [[118, 168, 0], [232, 178, 3]]) morpho(x + Math.round(Math.sin(G.t * 0.05 + ph) * 3), y + Math.round(Math.sin(G.t * 0.08 + ph) * 2), Math.floor(G.t / 5 + ph) % 3);
    // pollen drifting in the light
    for (let i = 0; i < 30; i++) {
      const t = G.t + i * 211, x = Math.round(((hsh(i * 3.7) * 700 + Math.sin(t * 0.007 + i) * 30 + t * 0.05) % (W + 40)) - 20);
      const y = Math.round(50 + hsh(i * 9.1) * 170 + Math.sin(t * 0.011 + i * 2) * 12);
      ctx.fillStyle = Math.sin(t * 0.09 + i) > 0.2 ? 'rgba(255,240,170,0.95)' : 'rgba(255,236,160,0.45)'; ctx.fillRect(x, y, 1, 1);
    }
  }
});
}
