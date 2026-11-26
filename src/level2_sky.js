'use strict';
// ============================================================
// Mission 2 sky: everything behind and over VIGO HILLS that isn't the world itself.
//  drawBG: four scenes blended by the camera: HOME (a golden morning over the Ria de Vigo: the Cies Islands, Vigo on
//    its hill with the port, the Rande bridge far up the ria), CHESTNUT WOODS (misty forest layers, light shafts),
//    THE FARM (fields and a bell tower under a darkening sky) and the CHERRY ORCHARD (a washed-clean afternoon, a
//    rainbow, the Rande bridge up close). Static layers are painted once into pixel strips (crisp edges, no
//    anti-aliasing, built the first time the mission loads) and blitted with parallax, each only where the nearer
//    strips don't cover it; the sun, clouds, sparkles, boats, ferries, gulls, the lighthouse, fog, storm clouds, wind
//    turbines and cars on the bridge move live. Scenes crossfade over 180 px; into and out of the woods the forest
//    closes in (nearest trees first) and opens up (misty depths first) instead.
//  weather(): { rain, rainbow, wind } from the camera (drizzle ~3200, downpour 3500-4000, clear by 4200, rainbow after);
//    skyUpdate also plays the rain's hiss.
//  drawOverlay: rain and splashes, petals, leaves, butterflies, light tints (screen space, after the world).
// Exports on the shared L2 object: skyLoad(cp), skyUpdate(), drawBG(cx), drawOverlay(cx), weather().
// Never calls Math.random: the moving bits use G.t and hsh(), the particles a private random stream.
// ============================================================
var L2 = L2 || {};
{
// ============================================================
// Helpers: easing, smooth noise, a private random stream
// ============================================================
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (v, m) => ((v % m) + m) % m;
function vnoise(x, s) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hsh(i * 1.37 + s * 61.3), hsh((i + 1) * 1.37 + s * 61.3), u);
}
function fbm(x, s, oct) {
  let v = 0, a = 1, n = 0, f = 1;
  for (let o = 0; o < (oct || 3); o++) { v += a * vnoise(x * f, s + o * 17); n += a; a *= 0.5; f *= 2.07; }
  return v / n;
}
// 2D value noise from a 64x64 table of hashes (used per pixel while building the strips; repeats every 64 cells)
let NT = null;
function vn2(x, y, s) {
  if (!NT) { NT = new Float32Array(4096); for (let i = 0; i < 4096; i++) NT[i] = hsh(i * 0.731 + 17.3); }
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  const i0 = (i + s * 23) & 63, i1 = (i0 + 1) & 63, j0 = (j & 63) << 6, j1 = ((j + 1) & 63) << 6;
  return lerp(lerp(NT[j0 + i0], NT[j0 + i1], a), lerp(NT[j1 + i0], NT[j1 + i1], a), b);
}
let seed = 1;
const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const rr = (a, b) => a + rnd() * (b - a);

// Colours: '#rrggbb' -> packed RGBA for the pixel buffers
const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const RGBS = {};
const rgbOf = c => RGBS[c] || (RGBS[c] = hex(c));
const pk = (r, g, b, a) => (LE ? (a << 24) | (b << 16) | (g << 8) | r : (r << 24) | (g << 16) | (b << 8) | a) >>> 0;
function P(c, a) { const v = rgbOf(c); return pk(v[0], v[1], v[2], a == null ? 255 : a); }
function PM(c1, c2, k, a) {
  const A = rgbOf(c1), B = rgbOf(c2);
  return pk(Math.round(lerp(A[0], B[0], k)), Math.round(lerp(A[1], B[1], k)), Math.round(lerp(A[2], B[2], k)), a == null ? 255 : a);
}
function hexMix(c1, c2, k) {
  const A = rgbOf(c1), B = rgbOf(c2);
  return '#' + [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], k)).toString(16).padStart(2, '0')).join('');
}
const rgba = (c, a) => { const v = rgbOf(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a.toFixed(3) + ')'; };
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ============================================================
// Pixel buffers: scenery is painted pixel by pixel into a typed array, then turned into a canvas once.
// Coordinates are screen coordinates at the scene's first camera x (buffer x 0 = screen x -10) and screen y.
// ============================================================
class Pix {
  constructor(w, h, top) { this.w = Math.ceil(w); this.h = Math.ceil(h); this.top = top || 0; this.ox = 10; this.d = new Uint32Array(this.w * this.h); }
  rect(x, y, w, h, c) {
    x = Math.round(x) + this.ox; y = Math.round(y) - this.top;
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + Math.round(w)), y1 = Math.min(this.h, y + Math.round(h));
    if (x1 <= x0) return;
    if (x1 - x0 === 1) { for (let r = y0, i = y0 * this.w + x0; r < y1; r++, i += this.w) this.d[i] = c; return; }
    for (let r = y0; r < y1; r++) this.d.fill(c, r * this.w + x0, r * this.w + x1);
  }
  dot(x, y, c) {
    x = Math.round(x) + this.ox; y = Math.round(y) - this.top;
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.d[y * this.w + x] = c;
  }
  get(x, y) {
    x = Math.round(x) + this.ox; y = Math.round(y) - this.top;
    return x >= 0 && x < this.w && y >= 0 && y < this.h ? this.d[y * this.w + x] : 0;
  }
  col(x, y0, y1, c) { this.rect(x, y0, 1, y1 - y0, c); }
  disc(cx, cy, r, c) {
    if (r < 0.5) { this.dot(cx, cy, c); return; }
    const R = r + 0.5, n = Math.floor(r), x = Math.round(cx), y = Math.round(cy);
    for (let dy = -n; dy <= n; dy++) { const hw = Math.floor(Math.sqrt(R * R - dy * dy)); this.rect(x - hw, y + dy, hw * 2 + 1, 1, c); }
  }
  ell(cx, cy, rx, ry, c) {
    const n = Math.floor(ry), x = Math.round(cx), y = Math.round(cy);
    for (let dy = -n; dy <= n; dy++) { const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)) + 0.3); this.rect(x - hw, y + dy, hw * 2 + 1, 1, c); }
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let i = 0; i <= n; i++) this.dot(lerp(x0, x1, n ? i / n : 0), lerp(y0, y1, n ? i / n : 0), c);
  }
  poly(pts, c) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const xs = [];
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const sy = y + 0.5; xs.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[j];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + (sy - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) { const a = Math.round(xs[k]), b = Math.round(xs[k + 1]); if (b > a) this.rect(a, y, b - a, 1, c); }
    }
  }
  // a silhouette: from y = f(x) down to the bottom of the buffer
  fill(x0, x1, f, c) { for (let x = Math.floor(x0); x < x1; x++) { const y = Math.round(f(x)); this.rect(x, y, 1, this.top + this.h - y, c); } }
  // mix every painted pixel toward colour c by k(screen y): haze and mist
  haze(c, k) {
    const C = rgbOf(c), d = this.d;
    for (let r = 0; r < this.h; r++) {
      const m = k(r + this.top);
      if (m <= 0) continue;
      let lv = 0, lr = 0;
      for (let i = r * this.w, e = i + this.w; i < e; i++) {
        const v = d[i];
        if (!v) continue;
        if (v === lv) { d[i] = lr; continue; }
        const R0 = LE ? v & 255 : v >>> 24, G0 = (v >>> (LE ? 8 : 16)) & 255, B0 = (v >>> (LE ? 16 : 8)) & 255, A0 = LE ? v >>> 24 : v & 255;
        lv = v; lr = d[i] = pk(Math.round(R0 + (C[0] - R0) * m), Math.round(G0 + (C[1] - G0) * m), Math.round(B0 + (C[2] - B0) * m), A0);
      }
    }
  }
  canvas() {
    const c = canvasOf(this.w, this.h), g = c.getContext('2d'), id = g.createImageData(this.w, this.h);
    id.data.set(new Uint8ClampedArray(this.d.buffer));
    g.putImageData(id, 0, 0);
    return c;
  }
}

// ============================================================
// Scenes: each one is visible for a camera range (its crossfades included); its layer strips are wide enough for it
// ============================================================
const BOUNDS = [1350, 2850, 4400], FADE = 90;    // area starts (camera centre) and the half-width of each crossfade
const SCN = [{ cam0: 0, cam1: 1280 }, { cam0: 950, cam1: 2780 }, { cam0: 2450, cam1: 4330 }, { cam0: 4000, cam1: 5740 }];
function weights(cx) {
  const c = cx + W / 2, w = [0, 0, 0, 0];
  let i = 0;
  while (i < 3 && c >= BOUNDS[i] + FADE) i++;
  if (i < 3 && c > BOUNDS[i] - FADE) { const k = ss(BOUNDS[i] - FADE, BOUNDS[i] + FADE, c); w[i] = 1 - k; w[i + 1] = k; }
  else w[i] = 1;
  return w;
}
const HOR = 128;   // the sea horizon in the ria scenes

// a strip of scenery with parallax p from screen row `top` to the bottom
function layer(S, p, top, build) {
  const px = new Pix(W + 22 + Math.ceil((S.cam1 - S.cam0) * p), H - top, top);
  build(px);
  // the rows that are opaque all the way across: a band at the top [top, ta) and one at the bottom [tb, H)
  const d = px.d, w = px.w, full = r => { for (let i = r * w, e = i + w; i < e; i++) if ((LE ? d[i] >>> 24 : d[i] & 255) !== 255) return false; return true; };
  let a = 0, b = px.h;
  while (a < px.h && full(a)) a++;
  while (b > a && full(b - 1)) b--;
  return { p, top, h: px.h, c: px.canvas(), ta: top + a, tb: top + b, y0: top, y1: H };
}
// Each strip only needs the rows the nearer strips of its scene don't cover completely (no overdraw)
function cover(list, k, y0) {
  let y1 = H, moved = true;
  for (let j = k; j < list.length; j++) y1 = Math.min(y1, list[j].tb);
  while (moved) { moved = false; for (let j = k; j < list.length; j++) if (list[j].top <= y0 && list[j].ta > y0) { y0 = list[j].ta; moved = true; } }
  return [y0, Math.max(y0, y1)];
}
function cull(list) { list.forEach((L, i) => { [L.y0, L.y1] = cover(list, i + 1, L.top); }); }
// where a strip sits for camera cx (shared by the blit and the live bits drawn on that strip)
const offOf = (L, S, cx) => clamp(Math.round((cx - S.cam0) * L.p), 0, L.c.width - W - 20);
function blit(g, L, S, cx) { if (L.y1 > L.y0) g.drawImage(L.c, offOf(L, S, cx), L.y0 - L.top, W + 20, L.y1 - L.y0, -10, L.y0, W + 20, L.y1 - L.y0); }

// ============================================================
// Little scenery stamps for the pixel buffers (light from the side `lx`: 1 = right, -1 = left)
// ============================================================
// A Galician house: whitewashed or granite walls, red tile roof, a door and windows
function house(px, x, base, w, h, o) {
  o = o || {};
  const lx = o.lx || 1, wall = o.wall || '#f1ece1', wallD = o.wallD || '#cfc8bb', roof = o.roof || '#cf603f', roofL = o.roofL || '#e07a52', roofD = o.roofD || '#9c432c';
  px.rect(x, base - h, w, h, P(wall));
  px.col(lx > 0 ? x : x + w - 1, base - h, base, P(wallD));
  if (o.stone) for (let y = base - h + 2; y < base; y += 3) for (let k = x + ((y >> 1) & 1) * 2; k < x + w - 1; k += 4) px.dot(k, y, P(wallD));
  const rh = o.rh || Math.max(2, Math.round(w / 4));
  for (let i = 0; i < rh; i++) px.rect(x - 1 + i, base - h - 1 - i, w + 2 - i * 2, 1, P(i === 0 ? roofD : i === rh - 1 ? roofL : roof));
  if (w >= 6 && h >= 4) {
    const dx = x + Math.floor(w * (hsh(x * 1.3) > 0.5 ? 0.3 : 0.6));
    px.rect(dx, base - Math.min(4, h - 1), Math.max(1, w >> 3), Math.min(4, h - 1), P(o.door || '#6b4a33'));
    for (let wx = x + 2; wx < x + w - 2; wx += 4) if (Math.abs(wx - dx) > 2) px.rect(wx, base - h + 2, w >= 14 ? 2 : 1, h >= 9 ? 2 : 1, P(o.win || '#55657c'));
  }
  if (o.chimney) px.rect(x + (lx > 0 ? w - 4 : 2), base - h - rh - 2, 2, 3, P(wallD));
}

// Eucalyptus: a tall pale trunk, a narrow crown of drooping blue-green clumps
function eucalyptus(px, x, base, h, pal) {
  const top = Math.round(base - h), lean = hsh(x * 1.9) > 0.5 ? 1 : -1;
  px.col(x, top + 4, base, P(pal[0]));
  px.col(x + 1, top + Math.round(h * 0.45), base, P(pal[4]));
  for (let k = 0; k < 5; k++) {
    const cy = top + 1 + k * h * 0.11, cx = x + lean * (k < 2 ? 1 : 0) + (hsh(x * 3.1 + k) - 0.5) * 3, r = 1.4 + (k > 0 && k < 3 ? 1 : 0) + hsh(x + k * 7) * 0.9;
    px.disc(cx, cy, r, P(pal[1]));
    px.disc(cx + 0.6, cy - 0.8, Math.max(0, r - 1), P(pal[2]));
    if (k < 3 && hsh(x * 5.3 + k) > 0.4) px.dot(cx + 1, cy - r + 0.5, P(pal[3]));
  }
}
// A grove: tallest in the middle, crowns overlapping
function grove(px, x, base, n, h, pal) {
  for (let k = 0; k < n; k++) {
    const t = n > 1 ? k / (n - 1) : 0.5, hh = h * (0.7 + 0.3 * Math.sin(t * Math.PI)) * (0.85 + 0.3 * hsh(x * 2 + k));
    eucalyptus(px, Math.round(x + k * 3.6 + hsh(x + k) * 1.5), base + Math.round(hsh(x * 3 + k) * 2), hh, pal);
  }
}
// Maritime pine: a bare trunk under an irregular flat crown
function pine(px, x, base, h, pal) {
  const top = Math.round(base - h);
  px.col(x, top + 2, base, P(pal[0]));
  px.disc(x, top + 1, 2.4, P(pal[1])); px.disc(x - 3, top + 3, 1.6, P(pal[1])); px.disc(x + 3, top + 2, 1.8, P(pal[1]));
  px.rect(x - 1, top - 1, 3, 1, P(pal[2])); px.dot(x + 2, top, P(pal[2])); px.dot(x - 3, top + 2, P(pal[2]));
}

// A round leafy tree in clumps, three tones
function leafy(px, x, base, r, pal, lx) {
  lx = lx || 1;
  px.rect(x - 1, base - r * 1.1, 2, r * 1.1 + 1, P(pal[3]));
  const cy = base - r * 1.5, cl = [[0, 0, r], [-r * 0.6, r * 0.25, r * 0.7], [r * 0.6, r * 0.3, r * 0.7], [r * 0.15 * lx, -r * 0.45, r * 0.65]];
  for (const [ox, oy, rad] of cl) px.disc(x + ox, cy + oy, rad, P(pal[0]));
  for (const [ox, oy, rad] of cl) px.disc(x + ox + lx * 0.6, cy + oy - 1, rad - 1.2, P(pal[1]));
  px.disc(x + lx * r * 0.35, cy - r * 0.4, r * 0.32, P(pal[2]));
  px.disc(x + lx * r * 0.75, cy + r * 0.05, r * 0.22, P(pal[2]));
}

// A hydrangea bush: green leaves with big round flower heads
function hydrangea(px, x, base, r, flower, flowerL) {
  px.disc(x, base - r, r, P('#2f6f37'));
  px.disc(x + 0.5, base - r - 0.8, r - 1, P('#3f8442'));
  for (let k = 0; k < 4; k++) {
    const fx = x + (hsh(x * 2.3 + k) - 0.5) * r * 1.6, fy = base - r - 1 + (hsh(x * 4.7 + k) - 0.6) * r * 1.2;
    px.disc(fx, fy, 1.4, P(flower)); px.dot(fx + 0.5, fy - 1, P(flowerL));
  }
}

// A small granite horreo: the granary on legs (with flat stones on top of the legs), slatted body, tile roof
function horreo(px, x, base, w) {
  const leg = 4, body = 6;
  for (let lx2 = x + 1; lx2 < x + w - 1; lx2 += Math.max(4, Math.round((w - 3) / 3))) { px.rect(lx2, base - leg, 2, leg, P('#9d988e')); px.rect(lx2 - 1, base - leg - 1, 4, 1, P('#c2bdb2')); }
  px.rect(x, base - leg - 1 - body, w, body, P('#b8b2a5'));
  for (let k = x + 2; k < x + w - 2; k += 2) px.col(k, base - leg - body, base - leg - 2, P('#8f8a80'));
  px.rect(x - 1, base - leg - body - 2, w + 2, 1, P('#a3442c')); px.rect(x, base - leg - body - 3, w, 1, P('#cf603f')); px.rect(x + 2, base - leg - body - 4, w - 4, 1, P('#e07a52'));
}

// Ferns: fronds fanning out from the base
function fern(px, x, base, s, c1, c2) {
  for (let k = -3; k <= 3; k++) {
    const a = -Math.PI / 2 + k * 0.42, len = s * (1 - Math.abs(k) * 0.12);
    for (let t = 1; t <= len; t++) {
      const bend = (t / len) * (t / len) * 3;
      px.dot(x + Math.cos(a) * t + Math.sign(k) * bend, base + Math.sin(a) * t + bend * 0.8, P((t + k) % 3 ? c1 : c2));
    }
  }
}

// ============================================================
// HOME: a golden morning over the Ria de Vigo
// ============================================================
const AM = { sky: [[0, '#4d8ddb'], [42, '#78ade6'], [80, '#b7cfe6'], [104, '#f2d4b8'], [HOR, '#ffdfae']] };
const SEA_AM = [[126, '#e0e9da'], [129, '#b6d5d6'], [133, '#90c3ce'], [139, '#6cadc3'], [148, '#5299b5'], [160, '#4287a6'], [176, '#387998']];
const SEA_PM = [[126, '#d6eef4'], [129, '#a8d6e6'], [133, '#82c0dc'], [139, '#62aad0'], [148, '#4d96c2'], [160, '#3f84b2'], [176, '#3676a4']];

// The water of the ria: bands with dithered seams and wave dashes, lighter and longer toward the viewer
function water(px, bands) {
  const X0 = -10, X1 = px.w - 10;
  for (let i = 0; i < bands.length; i++) {
    const y0 = bands[i][0], y1 = i + 1 < bands.length ? bands[i + 1][0] : H;
    px.rect(X0, y0, X1 - X0, y1 - y0, P(bands[i][1]));
    if (i) for (let x = X0; x < X1; x += 2) { px.dot(x + (y0 & 1), y0, P(bands[i - 1][1])); if (x % 4 === 0) px.dot(x + 1, y0 + 1, P(bands[i - 1][1])); }
  }
  for (let i = 0, n = Math.round((X1 - X0) * 0.3); i < n; i++) {
    const y = Math.round(bands[2][0] + Math.pow(hsh(i * 3.7 + 0.5), 1.2) * (236 - bands[2][0]));
    let b = 0;
    while (b + 1 < bands.length && bands[b + 1][0] <= y) b++;
    const x = X0 + hsh(i * 5.3 + 1) * (X1 - X0), len = 2 + Math.round((y - HOR) / 6 * (0.5 + hsh(i * 1.9)));
    px.rect(x, y, len, 1, PM(bands[b][1], bands[Math.max(0, b - 1)][1], 0.6));
    if (hsh(i * 9.1) > 0.6) px.rect(x + 1, y + 1, Math.max(1, len - 2), 1, PM(bands[b][1], '#1f4f70', 0.12));
  }
}

function homeFar(px) {
  const X1 = px.w - 10;
  const f = x => HOR - ss(215, 330, x) * (5 + 19 * fbm(x / 58, 3) + 10 * Math.max(0, Math.sin((x - 300) / 70)));
  for (let x = -10; x < X1; x++) {
    const y = Math.round(f(x));
    if (y >= HOR - 1) continue;
    const lit = f(x + 2) > f(x - 2) + 0.35;
    px.rect(x, y, 1, HOR + 2 - y, P('#adb4d7'));
    px.rect(x, y, 1, lit ? 2 : 1, P(lit ? '#c9cbe4' : '#b9bfde'));
    if (!lit && hsh(x * 1.7) > 0.6) px.col(x, y + 3, y + 7, P('#a4acd2'));
  }
}

// The Cies Islands at the mouth of the ria: low and rugged, cliffs to the ocean (left), pine woods on the gentle
// slopes facing the ria, Rodas beach joining two of them, the lighthouse on Monte Faro
const CIES = [[12, 74, [[0, 0], [0.06, 0.7], [0.2, 0.85], [0.34, 1], [0.5, 0.82], [0.66, 0.9], [0.84, 0.45], [1, 0]], 13],
  [88, 150, [[0, 0], [0.08, 0.6], [0.24, 0.92], [0.4, 1], [0.56, 0.9], [0.78, 0.5], [1, 0]], 17],
  [158, 200, [[0, 0], [0.12, 0.65], [0.36, 1], [0.6, 0.85], [0.85, 0.35], [1, 0]], 10]];
function homeCies(px) {
  for (const [a, b, shape, hgt] of CIES) {
    const f = x => {
      const t = (x - a) / (b - a);
      let i = 0;
      while (i + 2 < shape.length && shape[i + 1][0] < t) i++;
      const [t0, v0] = shape[i], [t1, v1] = shape[i + 1], k = ss(t0, t1, t);
      return HOR - hgt * lerp(v0, v1, k) - (fbm(x / 4, a, 2) - 0.5) * 2.2;
    };
    if (a <= 127 && b >= 127) LIVE.lh = [127, Math.round(Math.min(f(126), f(127), f(128)))];
    for (let x = a; x <= b; x++) {
      const y = Math.round(Math.min(HOR - 1, f(x))), lit = f(x + 1.5) > f(x - 1.5) + 0.2;
      px.rect(x, y, 1, HOR + 1 - y, P('#8d9cc2'));
      px.rect(x, y, 1, lit ? 2 : 1, P(lit ? '#aab7d6' : '#98a6ca'));
      if (!lit && f(x + 1) < f(x - 1) - 1.2) px.col(x, y + 1, Math.min(HOR, y + 5), P('#7b8ab2'));
      if (x > a + (b - a) * 0.3 && hsh(x * 7.1) > 0.55) px.dot(x, y + 2 + Math.floor(hsh(x * 2.3) * 3), P('#8293bb'));
    }
    px.rect(a - 1, HOR, b - a + 3, 1, P('#d6e6ea'));
  }
  px.rect(72, HOR - 1, 18, 2, P('#f2ead6')); px.dot(80, HOR - 2, P('#f2ead6'));
  const [lx, ly] = LIVE.lh;
  px.rect(lx - 1, ly - 6, 2, 7, P('#f6f4ee')); px.col(lx, ly - 6, ly + 1, P('#c9cbd6'));
  px.rect(lx - 2, ly - 7, 4, 1, P('#6a7088')); px.rect(lx - 1, ly - 9, 2, 2, P('#ffe9a8')); px.dot(lx - 1, ly - 10, P('#6a7088'));
  px.rect(lx + 1, ly - 2, 3, 3, P('#eeeae0')); px.dot(lx + 3, ly - 3, P('#c8725a'));
}

// The far shore: Vigo climbing its hill, the port with cranes and containers, the Rande bridge far up the ria
function homeShore(px) {
  water(px, SEA_AM);
  for (const [x0, y0, nc, nr] of [[40, 134, 3, 2], [236, 131, 3, 2], [474, 132, 4, 2], [586, 135, 3, 3]]) for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
    const x = x0 + c * (9 + r * 2) + r * 3 + Math.round(hsh(x0 + c * 3 + r) * 2), y = y0 + r * 4, w = 5 + r;
    px.rect(x - 1, y + 2, w + 2, 1, PM('#6cadc3', '#e8f4f6', 0.35));
    px.rect(x, y, w, 1, P('#7a6a5c')); px.rect(x, y + 1, w, 1, P('#4e5a68'));
    for (let k = x; k < x + w; k += 2) px.dot(k, y - 1, P('#8a7a6a'));
    if (hsh(x * 3.3 + y) > 0.55) px.rect(x + 1, y - 2, 2, 1, P('#f0ece2'));
  }
  const shoreY = x => {
    let y;
    if (x < 244 || (x > 512 && x < 618)) return 999;
    if (x < 292) y = HOR - 1 - 7 * ss(244, 290, x);
    else if (x < 458) { const t = (x - 372) / 84; y = 120.5 - 26 * Math.pow(Math.max(0, 1 - t * t), 1.3); }
    else if (x <= 512) y = lerp(120, 113, ss(458, 478, x)) + 15 * ss(484, 512, x);
    else y = lerp(HOR, 109, ss(618, 652, x)) + 3 * Math.sin(x / 13);
    return Math.min(HOR - 1, y - (fbm(x / 8, 22, 2) - 0.5) * 2.5);
  };
  const X1 = px.w - 10;
  for (let x = 240; x < X1; x++) {
    const y = Math.round(shoreY(x));
    if (y >= HOR) continue;
    const lit = shoreY(x + 2) > shoreY(x - 2) + 0.3;
    px.rect(x, y, 1, HOR - y, P('#84a596'));
    px.rect(x, y, 1, lit ? 2 : 1, P(lit ? '#9fbca9' : '#8eae9e'));
    if (hsh(x * 2.9) > 0.55) px.dot(x, y + 3 + Math.floor(hsh(x) * 6), P('#71938a'));
  }
  // the hilltop park with the old fort walls
  for (let x = 352; x < 392; x += 3) px.disc(x + hsh(x) * 2, shoreY(x) + 2, 2 + hsh(x * 3) * 1.5, P(hsh(x * 5) > 0.5 ? '#6c9478' : '#5d8670'));
  px.rect(360, Math.round(shoreY(366)) + 1, 14, 2, P('#b9b4a8'));
  // the city: rows of white and cream houses with terracotta roofs, stacked down the hill to tall blocks at the port
  const WALLS = ['#f1ebdf', '#e6dbc5', '#f6f2ea', '#ddd2bd', '#ebe5d8', '#e2d8c8'];
  for (let row = 0; row < 8; row++) {
    let x = 287 + Math.round(hsh(row * 3.1) * 3);
    while (x < 458) {
      const bw = 3 + Math.floor(hsh(x * 0.37 + row * 13.1) * 5), gx = x + bw / 2;
      const ground = Math.round(shoreY(gx) + 3 + row * 3.5);
      if (ground <= HOR - 3 && !(row < 2 && gx > 352 && gx < 392)) {
        if (fbm(gx / 14, 5 + row) > 0.68 && row < 6) px.disc(gx, ground - 1, 2 + hsh(x) * 1.2, P(hsh(x * 2) > 0.5 ? '#6f9a74' : '#5f8a68'));
        else {
          const tall = row >= 4 && hsh(x * 1.9 + row) > 0.5;
          const bh = 2 + Math.floor(hsh(x * 1.7 + row) * 3) + (tall ? 3 + Math.floor(hsh(x * 4.1) * 7) : 0);
          px.rect(x, ground - bh, bw, bh + 2, P(WALLS[Math.floor(hsh(x * 2.9 + row) * WALLS.length)]));
          px.col(x, ground - bh, ground + 2, P('#c4c3c6'));
          if (tall) px.rect(x, ground - bh, bw, 1, P('#bdb9b2'));
          else { px.rect(x, ground - bh - 1, bw, 1, P('#c8725a')); px.dot(x + bw - 1, ground - bh - 1, P('#a65d4b')); }
          for (let wy = ground - bh + 2; wy < ground; wy += 2) for (let wx = x + 2; wx < x + bw - 1; wx += 2) if (hsh(wx * 3.7 + wy * 1.3) > 0.4) px.dot(wx, wy, P('#9aa8ba'));
        }
      }
      x += bw;
    }
  }
  // a church tower above the roofs
  { const tx = 336, ty = Math.round(shoreY(336)) + 2; px.rect(tx, ty - 10, 3, 12, P('#efe6d2')); px.col(tx, ty - 10, ty + 2, P('#cfc6b4')); px.dot(tx + 1, ty - 7, P('#7d8698')); px.rect(tx, ty - 11, 3, 1, P('#c8725a')); px.dot(tx + 1, ty - 12, P('#c8725a')); }
  // the port: quay, container stacks, gantry cranes, a container ship
  const q = HOR - 2;
  px.rect(296, q, 150, 2, P('#a7a9b3')); px.rect(296, q + 2, 150, 1, P('#80838f'));
  const CONT = ['#c75a4e', '#4f7fb4', '#d9963e', '#5c9a6e', '#e8e4dc', '#b84a6a'];
  for (const [x0, n] of [[300, 7], [346, 5], [430, 3]]) for (let i = 0; i < n; i++) {
    const hgt = 1 + Math.floor(hsh(x0 + i * 1.7) * 3);
    for (let k = 0; k < hgt; k++) px.rect(x0 + i * 5, q - 2 - k * 2, 4, 2, P(CONT[Math.floor(hsh(x0 * 3 + i * 5 + k) * CONT.length)]));
  }
  const crane = (x, c, cl, up) => {
    px.col(x - 4, q - 13, q, P(c)); px.col(x + 3, q - 13, q, P(c));
    px.rect(x - 4, q - 13, 8, 1, P(c)); px.rect(x - 4, q - 7, 8, 1, P(c));
    px.line(x - 3, q - 14, x, q - 19, P(c)); px.line(x + 3, q - 14, x, q - 19, P(c));
    if (up) px.line(x - 2, q - 15, x - 7, q - 31, P(cl)); else { px.rect(x - 15, q - 15, 24, 1, P(cl)); px.line(x - 13, q - 15, x, q - 19, P(c)); }
    px.rect(x - 1, q - 17, 3, 2, P('#ecebe8'));
  };
  crane(372, '#3a78c0', '#6ea3e0', false); crane(390, '#cf4a3a', '#ef7a62', true); crane(414, '#3a78c0', '#6ea3e0', false);
  px.rect(374, HOR - 3, 46, 4, P('#4b5770')); px.rect(374, HOR, 46, 1, P('#b8504a')); px.rect(374, HOR - 3, 46, 1, P('#6a7690'));
  for (let i = 0; i < 6; i++) px.rect(377 + i * 5, HOR - 5, 4, 2, P(CONT[(i * 3 + 1) % CONT.length]));
  px.rect(412, HOR - 9, 6, 6, P('#f2f0ea')); px.col(412, HOR - 9, HOR - 3, P('#cfccc4')); px.rect(413, HOR - 7, 4, 1, P('#5f6f86')); px.rect(414, HOR - 11, 2, 2, P('#d84a3a'));
  // beyond the city: wooded hills with scattered houses
  for (let x = 460; x < X1; x += 4) {
    const y = shoreY(x);
    if (y >= HOR - 2) continue;
    if (hsh(x * 1.3) > 0.55) { const hy = Math.round(y + 3 + hsh(x * 2.1) * (HOR - y - 6)); px.rect(x, hy, 3, 2, P('#eee8dc')); px.rect(x, hy - 1, 3, 1, P('#c8725a')); }
    else px.disc(x, y + 2 + hsh(x * 4.4) * 3, 1.5, P('#6f9282'));
  }
  // the Rande bridge, far up the ria: two towers, fans of cables, the deck
  const D = 113, TT = 94, T1 = 538, T2 = 592;
  for (const t of [T1, T2]) for (let k = 1; k <= 6; k++) for (const s of [-1, 1]) px.line(t + s * 0.5, TT + 2 + k, t + s * k * 4.4, D - 1, P('#dcdcde'));
  px.rect(500, D, 132, 2, P('#e4e2dc')); px.rect(500, D + 2, 132, 1, P('#a8abb6'));
  for (const t of [T1, T2]) { px.rect(t - 1, TT, 2, HOR - TT, P('#eeece6')); px.col(t, TT, HOR, P('#cbc9c6')); px.rect(t - 2, D + 3, 4, 1, P('#cbc9c6')); }
  for (const x of [506, 516, 528, 602, 614, 624]) px.col(x, D + 3, HOR, P('#c5c3c0'));
  // the city and the bridge mirrored faintly in the water
  for (let x = 244; x < X1; x++) for (let k = 1; k <= 7; k++) {
    if ((x + k * 3) % 4 === 0) continue;
    const above = px.get(x, HOR - 1 - k * 2);
    if (above && hsh(x * 0.7 + k * 11) > 0.35) px.dot(x, HOR + k, PM('#b6d5d6', '#e6e2d8', 0.25));
  }
}

const HILL_PAL = { euc: ['#e6dfcd', '#3f6f5e', '#5a8c76', '#88b49a', '#a99d88'], pine: ['#6b4f3a', '#3a6544', '#52835a'] };
// The near shore below the hill: beaches and surf, eucalyptus groves and pines, villages with red roofs, terraced vines
function homeHills(px) {
  const X1 = px.w - 10;
  const edge = x => 162 - 9 * fbm(x / 64, 41, 3) - 6 * Math.sin(x / 113 + 1);
  px.fill(-10, X1, edge, P('#5d9a52'));
  for (let x = -10; x < X1; x++) {
    const e = Math.round(edge(x));
    // woods patches and fields further down the slope, vine terraces with stone walls
    for (let k = 0; k < 8; k++) {
      const y = e + 4 + k * 6 + Math.round(Math.sin(x / 47 + k) * 2), z = fbm(x / 30 + k * 7, 43, 2);
      if (z > 0.6) { px.rect(x, y, 1, 3, P(k % 2 ? '#6aa955' : '#74b25b')); if ((x + k) % 2 === 0) px.dot(x, y, P('#8dc465')); px.dot(x, y + 3, P('#a7a28e')); }
      else if (z < 0.3) { px.rect(x, y, 1, 6, P('#4c8646')); if (hsh(x * 1.3 + k) > 0.6) px.dot(x, y, P('#5f9a55')); }
    }
    const beach = fbm(x / 24, 44, 2) > 0.55;
    px.dot(x, e - 1, P('#e4f0f0'));
    if (beach) { px.rect(x, e, 1, 2, P('#eedfba')); px.dot(x, e + 2, P('#d6c6a0')); }
    else { px.dot(x, e, P('#83b86b')); if (hsh(x * 4.1) > 0.7) px.dot(x, e - 1, P('#a6a39a')); }
  }
  let x = -12;
  while (x < X1) {
    const r = hsh(x * 0.77 + 3), e = Math.round(edge(x + 8));
    if (r < 0.2) { const n = 5 + Math.floor(hsh(x * 9) * 5); grove(px, x, e + 3, n, 17 + hsh(x * 2) * 10, HILL_PAL.euc); x += n * 4 + 14; }
    else if (r < 0.32) { pine(px, x + 2, e + 3, 11 + hsh(x * 3) * 7, HILL_PAL.pine); pine(px, x + 9, e + 4, 9 + hsh(x * 5) * 6, HILL_PAL.pine); x += 24; }
    else if (r < 0.5) { // a village: a few houses on the slope, one with a little church gable
      const n = 2 + Math.floor(hsh(x * 4.3) * 4);
      for (let k = 0; k < n; k++) house(px, x + k * 9 + Math.round(hsh(x + k) * 3), e + 9 + Math.round(hsh(x * 5 + k) * 10), 7 + Math.round(hsh(x * 7 + k) * 4), 4 + Math.round(hsh(x * 9 + k) * 2), { lx: 1, rh: 2 });
      x += n * 9 + 16;
    } else x += 14;
  }
  px.haze('#a6c8d6', y => 0.06 + (1 - ss(150, 200, y)) * 0.16);
}

const MID_TREE = ['#2f6b37', '#3f8a43', '#62ad55', '#5b4030'];
// The hillside closer by: granite walls with hydrangeas, vine pergolas, round trees, a granite house, a horreo
function homeMid(px, chim) {
  const X1 = px.w - 10;
  const edge = x => 189 - 9 * fbm(x / 64, 51, 3) - 4 * Math.sin(x / 47);
  px.fill(-10, X1, edge, P('#4f9446'));
  for (let x = -10; x < X1; x++) {
    const e = Math.round(edge(x));
    px.dot(x, e, P(edge(x + 2) > edge(x - 2) ? '#9ccf62' : '#6aae52'));
    if (hsh(x * 1.1) > 0.7) px.dot(x, e - 1, P('#4a8c44'));
    for (let k = 1; k < 5; k++) if (fbm(x / 40 + k * 5, 52, 2) > 0.55) px.rect(x, e + 4 + k * 8, 1, 4, P(k % 2 ? '#559a4a' : '#5fa552'));
  }
  let x = -14;
  while (x < X1) {
    const r = hsh(x * 0.61 + 7), e = Math.round(edge(x + 8));
    if (r < 0.22) { leafy(px, x + 10, e + 4, 8 + hsh(x * 3) * 5, MID_TREE, 1); x += 26; }
    else if (r < 0.36) {
      const w = 24 + Math.round(hsh(x * 5) * 8), hh = 12 + Math.round(hsh(x * 7) * 3);
      house(px, x, e + 6, w, hh, { stone: true, wall: '#b9b3a6', wallD: '#99938a', chimney: true, win: '#3f4f66', lx: 1, rh: 4 });
      for (let wx = x + 3; wx < x + w - 3; wx += 4) if (hsh(wx) > 0.4) px.rect(wx, e + 6 - hh + 4, 2, 1, P('#e8445a'));
      chim.push([x + w - 3, e + 6 - hh - 6]);
      x += w + 10;
    } else if (r < 0.46) { horreo(px, x, e + 5, 18); x += 26; }
    else if (r < 0.66) {
      const n = 3 + Math.floor(hsh(x * 9) * 3);
      px.rect(x, e + 1, n * 8 + 4, 3, P('#b5afa2')); for (let k = x + 1; k < x + n * 8 + 3; k += 4) px.dot(k, e + 2, P('#8f897d'));
      for (let k = 0; k < n; k++) { const c = [['#7f9fe8', '#b8ccff'], ['#e98ac4', '#ffc4e6'], ['#a98ae0', '#d6c4ff']][Math.floor(hsh(x + k) * 3)]; hydrangea(px, x + 4 + k * 8, e + 4, 4, c[0], c[1]); }
      x += n * 8 + 10;
    } else if (r < 0.8) {
      const n = 4 + Math.floor(hsh(x * 4) * 4);
      for (let k = 0; k <= n; k++) px.col(x + k * 5, e - 6, e + 4, P('#a9a397'));
      px.rect(x - 1, e - 8, n * 5 + 3, 3, P('#4f9440')); for (let k = x; k < x + n * 5 + 2; k += 2) px.dot(k, e - 9 + (k & 1), P('#6fb04f'));
      for (let k = x + 2; k < x + n * 5; k += 3) if (hsh(k * 7) > 0.5) px.rect(k, e - 5, 1, 2, P('#5a2e5a'));
      x += n * 5 + 10;
    } else x += 12;
  }
}

// Hedges right behind the path: camellias, gorse in flower, ferns, granite posts
function homeNear(px) {
  const X1 = px.w - 10;
  const top = x => 212 - 7 * fbm(x / 36, 61, 3) - 3 * Math.sin(x / 19);
  for (let x = -16; x < X1 + 8; x += 5) { const r = 4 + hsh(x * 0.9) * 5; px.disc(x, top(x) + r * 0.6, r, P('#25582c')); }
  px.fill(-10, X1, x => top(x) + 4, P('#25582c'));
  for (let x = -16; x < X1 + 8; x += 5) { const r = 3 + hsh(x * 0.9) * 4; px.disc(x - 1, top(x) + r * 0.5, r - 1, P('#2f6b35')); px.disc(x - 2, top(x) + r * 0.3, Math.max(0, r - 3), P('#3f8040')); }
  for (let i = 0; i < (X1 + 10) * 0.25; i++) {
    const x = -10 + hsh(i * 3.3) * (X1 + 10), y = top(x) + 2 + hsh(i * 7.1) * 12, kind = hsh(i * 1.9);
    if (fbm(x / 60, 62, 2) > 0.55) { px.rect(x, y, 2, 1, P('#ffd84a')); px.dot(x, y - 1, P('#fff2a0')); }
    else if (kind < 0.5) { px.rect(x, y, 2, 2, P(kind < 0.25 ? '#ff6f9f' : '#e8445a')); px.dot(x, y, P('#ffc4d8')); }
    else if (kind < 0.62) px.rect(x, y, 2, 2, P('#fff4f4'));
  }
  for (let x = 4; x < X1; x += 70 + Math.round(hsh(x) * 60)) fern(px, x, top(x) + 8, 9, '#4f9a44', '#6fbf5a');
}

// ============================================================
// CHESTNUT WOODS: misty forest layers, light shafts through the canopy
// ============================================================
// A tree trunk: lit side (the light comes from the upper left), shaded side, long twisted bark grooves (chestnut
// bark spirals), roots spreading where it meets the undergrowth, a branch or two up into the canopy
function trunk(px, x, tw, y0, y1, pal, o) {
  const lean = (hsh(x * 0.37 + o.s) - 0.5) * (o.lean || 0), per = tw > 14 ? 5 : 4;
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / (o.ground - y0), flare = ss(o.ground - 26, o.ground + 8, y);
    const ww = Math.max(2, Math.round(tw * (0.76 + 0.24 * Math.min(1, t)) + flare * tw * 0.8));
    const xl = Math.round(x + lean * (1 - Math.min(1, t)) - ww / 2 + Math.sin(y / 23 + x) * (tw > 12 ? 1.2 : 0.4));
    px.rect(xl, y, ww, 1, P(pal[1]));
    const lw = Math.max(1, Math.round(ww * 0.15)), sw = Math.max(1, Math.round(ww * 0.27));
    px.rect(xl, y, lw, 1, P(pal[0]));
    px.rect(xl + ww - sw, y, sw, 1, P(pal[2]));
    if (ww >= 6) {
      const shift = Math.floor(y * o.twist);
      for (let k = 1; k < ww - 1; k++) {
        const g = ((k + shift) % per + per) % per, id = Math.floor((k + shift) / per), seg = Math.floor((y + id * 7) / (5 + (id & 3) * 3));
        if (g === 0 && hsh(id * 7.3 + seg * 1.9 + x) > 0.22) px.dot(xl + k, y, P(pal[3]));
        else if (g === 1 && k < ww * 0.6 && hsh(id * 3.1 + seg * 2.3 + x) > 0.5) px.dot(xl + k, y, P(pal[0]));
      }
    }
    if (o.moss && ww >= 4 && y > o.ground - 96 && y < o.ground + 8) {
      const dy = ss(o.ground - 96, o.ground + 6, y);
      for (let k = 0; k < ww; k++) {
        const side = 0.3 + 0.7 * k / ww, n = vn2(k / 2.6 + x * 0.37, y / 3.2, o.s), m = dy * side * 0.72;
        if (n < m) px.dot(xl + k, y, P(n < m - 0.16 || vn2(k / 2.6 + x * 0.37, (y - 1) / 3.2, o.s) < m ? o.moss : o.mossL || o.moss));
      }
    }
  }
  if (o.branch && tw >= 7) for (const sd of [-1, 1]) {
    if (hsh(x * 5 + sd) < 0.3) continue;
    const by = o.cy + 4 + hsh(x * 9 + sd) * 26, len = tw * (1.2 + hsh(x * 3 + sd) * 0.8);
    for (let k = 0; k <= len; k++) px.disc(x + lean * 0.3 + sd * k, by - k * (0.7 + 0.3 * hsh(x + sd)), Math.max(0.6, tw * 0.22 * (1 - k / len * 0.65)), P(k < len * 0.3 ? pal[1] : sd < 0 ? pal[0] : pal[2]));
  }
}

// A canopy: leaf clumps darker underneath and sunlit on top, flecks of light, hanging sprigs of long leaves
function canopy(px, X1, o) {
  const clumps = [];
  for (let x = -24; x < X1 + 24; x += o.step * (0.6 + 0.8 * hsh(x * 0.31 + o.s))) {
    const r = lerp(o.r[0], o.r[1], hsh(x * 0.53 + o.s * 3)), y = o.cy + (hsh(x * 0.91 + o.s) - 0.4) * o.amp;
    clumps.push([x, y, r]);
  }
  if (o.solid != null) px.rect(-10, o.solid, X1 + 10, o.cy - o.solid, P(o.leaf[1]));
  if (o.top != null) for (let x = -24; x < X1 + 24; x += o.step * 0.7) {
    const r = lerp(o.r[0], o.r[1], hsh(x * 0.37 + o.s * 5)) * 0.9, y = o.top + (hsh(x * 0.77 + o.s) - 0.5) * o.amp * 0.8;
    px.disc(x, y, r, P(o.leaf[1])); px.rect(x - r, y, r * 2 + 1, o.cy - y, P(o.leaf[1]));
  }
  for (const [x, y, r] of clumps) px.disc(x, y, r, P(o.leaf[0]));
  for (const [x, y, r] of clumps) px.disc(x - 1, y - 2, r - 1.5, P(o.leaf[1]));
  // light on the leaves: small bright clumps, more toward the top
  for (let i = 0; i < (X1 + 40) * o.lit; i++) {
    const x = -20 + hsh(i * 3.7 + o.s) * (X1 + 40), y = (o.top != null ? o.top - 6 : o.cy - 24) + hsh(i * 5.1 + o.s) * (o.cy - (o.top != null ? o.top - 6 : o.cy - 24));
    if (px.get(x, y) !== P(o.leaf[1])) continue;
    const r = 1 + hsh(i * 2.3) * 1.6;
    px.disc(x, y, r, P(o.leaf[2])); px.disc(x + r + 0.5, y + 1, Math.max(0.5, r - 0.6), P(o.leaf[2])); px.dot(x - 1, y + r, P(o.leaf[0]));
    if (hsh(i * 7.9) > 0.55) px.dot(x - 1, y - 1, P(o.leaf[3] || o.leaf[2]));
  }
  if (o.hang) for (let x = -10; x < X1; x += 2) {
    if (hsh(x * 3.9 + o.s) < 0.62) continue;
    let y = o.cy + 2;
    while (y < o.cy + o.amp + o.r[1] && px.get(x, y)) y++;
    const n = 2 + Math.round(hsh(x * 1.7) * 4);
    px.rect(x, y - 1, 1, n, P(o.leaf[hsh(x * 5.1) > 0.4 ? 0 : 1]));
    if (n > 3) px.dot(x + (hsh(x) > 0.5 ? 1 : -1), y + 1, P(o.leaf[0]));
  }
}

function forest(px, o) {
  const X1 = px.w - 10;
  let x = -14 + hsh(o.s) * o.gap;
  while (x < X1 + 14) {
    const tw = Math.round(lerp(o.tw[0], o.tw[1], hsh(x * 0.71 + o.s)));
    trunk(px, Math.round(x), tw, o.cy - 10, H, o.bark, o);
    x += o.gap * (0.5 + hsh(x * 1.37 + o.s));
  }
  canopy(px, X1, o);
  // undergrowth: a mossy floor, fern clumps and bushes, boulders near the front
  const U = o.under, G0 = o.ground;
  for (let x = -14; x < X1 + 14; x += 4) {
    const r = 3 + hsh(x * 0.7 + o.s) * 5 * (fbm(x / 40, o.s, 2) + 0.4);
    px.disc(x, G0 + 5 - r * 0.5, r, P(U[0]));
  }
  px.rect(-10, G0 + 4, X1 + 10, H - G0, P(U[0]));
  for (let x = -14; x < X1 + 14; x += 4) {
    const r = 2 + hsh(x * 0.7 + o.s) * 4 * (fbm(x / 40, o.s, 2) + 0.3);
    if (hsh(x * 2.2 + o.s) > 0.35) px.disc(x - 1, G0 + 4 - r * 0.6, r - 1, P(U[1]));
    if (hsh(x * 4.4 + o.s) > 0.7) px.dot(x - 2, G0 + 2 - r, P(U[2]));
  }
  if (o.ferns) for (let x = 6; x < X1; x += 14 + Math.round(hsh(x + o.s) * 26)) fern(px, x, G0 + 6, o.ferns * (0.7 + hsh(x * 3) * 0.6), U[1], U[2]);
  if (o.flecks) for (let x = 0; x < X1; x += 9 + Math.round(hsh(x * 1.9 + o.s) * 30)) {
    const y = G0 + 3 + Math.round(hsh(x * 2.7 + o.s) * 6), r = 2 + hsh(x * 4.3) * 4;
    px.ell(x, y, r, 1, P(o.flecks[0])); px.rect(x - r * 0.4, y, Math.max(1, r * 0.8), 1, P(o.flecks[1]));
  }
  if (o.rocks) for (let x = 30; x < X1; x += 80 + Math.round(hsh(x * 3 + o.s) * 110)) {
    const rw = 9 + hsh(x) * 12, ry = G0 + 7;
    px.ell(x, ry, rw, rw * 0.55, P('#5f6e62')); px.ell(x - 2, ry - 2, rw - 3, rw * 0.42, P('#7f8f82'));
    px.ell(x - 4, ry - rw * 0.38, rw * 0.55, 2, P(o.moss)); px.rect(x - rw * 0.45, ry - rw * 0.42 - 1, rw * 0.45, 1, P('#a0c060'));
  }
}

const WOODS_SKY = [[0, '#c4e6e4'], [90, '#e4f3ea'], [200, '#f0f6ea']];
const FOG = '#e2eee4';
function woods0(px) {
  const X1 = px.w - 10;
  const f = x => 60 - 12 * fbm(x / 26, 71, 3) - 6 * Math.sin(x / 61);
  for (let x = -14; x < X1 + 14; x += 6) px.disc(x, f(x) + 6, 6 + hsh(x * 1.1) * 7, P('#aac7c2'));
  px.fill(-10, X1, x => f(x) + 8, P('#aac7c2'));
  for (let x = -14; x < X1 + 14; x += 6) if (hsh(x * 1.7) > 0.4) px.disc(x - 2, f(x) + 4, 2 + hsh(x * 1.1) * 3, P('#bad4cd'));
  for (let x = -6; x < X1; x += 9 + Math.round(hsh(x) * 12)) px.rect(x, f(x) + 18, 1 + Math.round(hsh(x * 3) * 2), H, P('#9fbdb8'));
  px.haze(FOG, y => ss(70, 210, y) * 0.75);
}
function woods1(px) {
  forest(px, { s: 1, gap: 30, tw: [3, 6], cy: 58, amp: 14, r: [7, 13], step: 9, top: 26, ground: 202, twist: 0.08, lean: 6, lit: 0.08,
    bark: ['#a0bcb2', '#91aea4', '#84a196', '#7a968c'], leaf: ['#90b0a2', '#9ebdae', '#b0ccba'], under: ['#97b6a7', '#a4c2b1', '#b3cfbb'] });
  px.haze(FOG, y => ss(90, 222, y) * 0.62);
}
function woods2(px) {
  forest(px, { s: 2, gap: 44, tw: [6, 11], cy: 40, amp: 16, r: [9, 15], step: 10, top: 8, ground: 206, twist: 0.09, lean: 10, branch: true, ferns: 7, lit: 0.12,
    bark: ['#9aa898', '#7f9282', '#6f8273', '#607466'], leaf: ['#6a8f72', '#79a07e', '#9ebf8c', '#bcd8a0'], under: ['#6a9672', '#7aa77c', '#9ac48c'] });
  px.haze(FOG, y => ss(110, 232, y) * 0.42);
}
function woods3(px) {
  forest(px, { s: 3, gap: 62, tw: [10, 17], cy: 30, amp: 14, r: [10, 16], step: 11, solid: 0, ground: 210, twist: 0.1, lean: 14, branch: true, ferns: 9, rocks: true, hang: true, lit: 0.22, moss: '#6f9440', flecks: ['#8fbe5e', '#c6e47e'],
    bark: ['#8c8068', '#6d624e', '#5a503f', '#463e31'], leaf: ['#3c6a3c', '#4c7c46', '#79ac56', '#b6d870'], under: ['#3f7842', '#4f8e48', '#76ae58'], mossL: '#9cc25a' });
  px.haze(FOG, y => ss(150, 240, y) * 0.16);
}
function woods4(px) {
  forest(px, { s: 4, gap: 118, tw: [20, 32], cy: 20, amp: 12, r: [11, 18], step: 12, solid: 0, ground: 214, twist: 0.11, lean: 16, branch: true, ferns: 12, hang: true, lit: 0.3, moss: '#4f7a30', flecks: ['#6aa64a', '#b4dc6e'],
    bark: ['#76684f', '#4f4436', '#3d3429', '#2b241c'], leaf: ['#1e3d22', '#2a532e', '#4f8a3e', '#9ccc5c'], under: ['#2a5a2e', '#3a7a3a', '#5a9a48'], mossL: '#7aa246' });
}

// Light shafts falling from the upper left through the canopy (soft, drawn over the middle layers)
function shaftStrip(S, p) {
  const w = W + 22 + Math.ceil((S.cam1 - S.cam0) * p), px = new Pix(w, H, 0), C = rgbOf('#fff3c6');
  const beams = [];
  for (let x = -40; x < w; x += 70 + hsh(x) * 90) beams.push([x, 8 + hsh(x * 3) * 22, 0.18 + hsh(x * 7) * 0.22]);
  for (let y = 0; y < H; y++) {
    const fy = ss(0, 30, y) * (1 - ss(150, 245, y));
    if (fy <= 0) continue;
    for (const [bx, bw, a] of beams) {
      const c = bx + y * 0.42;
      for (let x = Math.floor(c - bw / 2); x <= c + bw / 2; x++) {
        if (x < 0 || x >= w) continue;
        const e = 1 - Math.abs(x - c) / (bw / 2), al = Math.round(255 * a * fy * Math.min(1, e * 2.2));
        const i = y * w + x, old = LE ? px.d[i] >>> 24 : px.d[i] & 255;
        if (al > old) px.d[i] = pk(C[0], C[1], C[2], al);
      }
    }
  }
  return { p, top: 0, h: H, c: px.canvas() };
}

// A band of drifting mist (alpha) that wraps seamlessly at its width (the noise comes from two lookup tables)
function fogStrip(w, h, s) {
  const px = new Pix(w, h, 0), C = rgbOf('#f2f7f2');
  const A = new Float32Array(w * 2), Q = 16, u0 = -w / 13, B = new Float32Array(Math.ceil((2 * w / 13 + h / 9) * Q) + 2);
  for (let x = -w; x < w; x++) A[x + w] = fbm(x / 45, s, 3);
  for (let i = 0; i < B.length; i++) B[i] = fbm(u0 + i / Q, s + 3, 2);
  const n = (x, y) => { const u = (x / 13 + y / 9 - u0) * Q, i = Math.floor(u); return 0.55 * A[x + w] + 0.45 * lerp(B[i], B[i + 1], u - i); };
  for (let y = 0; y < h; y++) {
    const fy = Math.sin(Math.PI * y / h);
    for (let x = 0; x < w; x++) {
      const v = lerp(n(x, y), n(x - w, y), x / w), a = Math.round(255 * clamp(fy * fy * (v * 1.4 - 0.3), 0, 1) * 0.8);
      if (a > 0) px.d[y * w + x] = pk(C[0], C[1], C[2], a);
    }
  }
  return px.canvas();
}
// Draw a horizontally wrapping band (fog, cloud decks) scrolled by `off`
function band(g, img, off, y) {
  const w = img.width;
  for (let x = -10 - Math.round(wrap(off, w)); x < W + 10; x += w) g.drawImage(img, x, y);
}

// ============================================================
// THE FARM: fields, farmhouses, a bell tower, the ria glimpsed far away; drizzle and a downpour
// ============================================================
const FARM_FAIR = [[0, '#5aa2e6'], [70, '#93c7ee'], [125, '#d3eaf5']];
const FARM_STORM = [[0, '#4a5462'], [70, '#677382'], [125, '#8e99a5']];
function farm0(px, tur) {
  const X1 = px.w - 10;
  const f = x => 112 - 8 * fbm(x / 50, 81, 3) - 9 * ss(150, 260, x) - 4 * Math.sin(x / 33);
  for (let x = -10; x < X1; x++) {
    const y = Math.round(f(x));
    px.rect(x, y, 1, H - y, P('#a6bad3'));
    px.dot(x, y, P(f(x + 2) > f(x - 2) ? '#bccbe0' : '#b0c2da'));
  }
  for (let i = 0; i < 4; i++) { const x = 250 + i * 46 + Math.round(hsh(i) * 14); tur.push([x, Math.round(f(x)) - 12]); }
}
const FIELDS = ['#93c46c', '#7fb35c', '#a9cf73', '#d9c96f', '#e3bf58', '#ac7d52', '#88be62', '#c5d27a'];
// Patchwork hills: field bands following the slope, hedgerows with trees, farmhouses
function fields(px, edge, o) {
  const X1 = px.w - 10;
  for (let x = -10; x < X1; x++) {
    const e = Math.round(edge(x));
    let y = e;
    for (let row = 0; row < o.rows.length; row++) {
      const y2 = row + 1 < o.rows.length ? e + o.rows[row + 1] + Math.round(Math.sin(x / 41 + row) * 2) : H;
      const seg = Math.floor((x + hsh(row * 7 + o.s) * 200 + row * 37) / (o.seg * (0.7 + 0.6 * hsh(row + o.s)))), id = hsh(seg * 3.7 + row * 11 + o.s);
      const c = FIELDS[Math.floor(id * FIELDS.length)];
      px.rect(x, y, 1, y2 - y, o.haze ? PM(c, o.haze, o.hk) : P(c));
      if (c === '#ac7d52') for (let k = y + 1; k < y2; k += 2) px.dot(x, k, o.haze ? PM('#8f6440', o.haze, o.hk) : P('#8f6440'));
      else if (hsh(x * 1.7 + y * 3.1) > 0.8) px.dot(x, y + 1 + Math.floor(hsh(x) * (y2 - y - 1)), o.haze ? PM(c, '#ffffff', 0.25) : PM(c, '#ffffff', 0.25));
      if (row) px.dot(x, y, P(o.hedge));
      y = y2;
    }
    px.dot(x, e, P(o.crest));
  }
  for (let row = 1; row < o.rows.length; row++) for (let x = -10; x < X1; x += 3) if (hsh(x * 0.9 + row * 5 + o.s) > 0.62) px.disc(x, edge(x) + o.rows[row] + Math.round(Math.sin(x / 41 + row - 1) * 2) - 1, 1 + hsh(x * 1.3) * o.tree, P(o.hedge));
}
function farm1(px) {
  const base = x => 121 - 11 * fbm(x / 80, 91, 3) - 5 * Math.sin(x / 120), vk = x => ss(-10, 60, x) * (1 - ss(150, 240, x));
  const edge = x => lerp(base(x), 132 + 2 * Math.sin(x / 19), vk(x));
  // the ria glimpsed far away down the valley: the far shore in the haze, the water catching the light
  for (let x = -10; x < 250; x++) {
    const k = vk(x);
    if (k <= 0) continue;
    const wy = Math.round(Math.max(119, lerp(base(x) + 1, 119, ss(0, 0.35, k)))), sy = Math.round(wy - ss(0.25, 0.8, k) * (4 + 4 * fbm(x / 16, 92, 2)));
    if (sy < wy) { px.rect(x, sy, 1, wy - sy, P('#a3b8cf')); px.dot(x, sy, P('#b8c8dc')); if (hsh(x * 3.1) > 0.8) px.dot(x, wy - 2, P('#e6e8ee')); }
    px.rect(x, wy, 1, 140 - wy, P('#b2d0e4')); px.dot(x, wy, P('#dceaf2'));
    if (hsh(x * 2.3) > 0.62) px.rect(x, wy + 2 + Math.floor(hsh(x) * 9), 2, 1, P('#eaf4f8'));
  }
  fields(px, edge, { s: 1, rows: [0, 5, 11, 19, 29, 42, 58], seg: 34, hedge: '#5d8f58', crest: '#a8c99a', tree: 1.2, haze: '#c4d6e4', hk: 0.32 });
  // a church with its espadana (a granite bell gable) and two cypresses
  const cx0 = 312, e = Math.round(edge(cx0));
  px.rect(cx0 - 8, e - 6, 16, 7, P('#c9c4b9')); px.col(cx0 - 8, e - 6, e + 1, P('#aaa598'));
  px.rect(cx0 - 9, e - 7, 18, 1, P('#b8604a')); px.rect(cx0 - 7, e - 8, 14, 1, P('#cf7a5e'));
  px.rect(cx0 + 5, e - 15, 5, 9, P('#d3cec3')); px.col(cx0 + 5, e - 15, e - 6, P('#aaa598'));
  px.dot(cx0 + 6, e - 13, P('#5a5048')); px.dot(cx0 + 8, e - 13, P('#5a5048')); px.dot(cx0 + 6, e - 12, P('#c8a040')); px.dot(cx0 + 8, e - 12, P('#c8a040'));
  px.rect(cx0 + 6, e - 16, 3, 1, P('#d3cec3')); px.dot(cx0 + 7, e - 17, P('#d3cec3'));
  for (const tx of [cx0 - 12, cx0 + 13]) { px.rect(tx, e - 11, 2, 11, P('#3f6a46')); px.dot(tx, e - 12, P('#3f6a46')); px.col(tx + 1, e - 10, e - 2, P('#527f55')); }
  for (let x = 40; x < px.w - 20; x += 50 + Math.round(hsh(x) * 60)) if (Math.abs(x - cx0) > 30) house(px, x, Math.round(edge(x)) + 6 + Math.round(hsh(x * 3) * 10), 7 + Math.round(hsh(x * 5) * 4), 4, { wall: '#e8e4da', roof: '#c8684a', roofD: '#9c4d38', rh: 2 });
}
const COW = ['#c98a45', '#a86c32', '#f2e6d0'];
function farm2(px, chim) {
  const X1 = px.w - 10;
  const edge = x => 158 - 8 * fbm(x / 70, 101, 3) - 4 * Math.sin(x / 61);
  fields(px, edge, { s: 2, rows: [0, 9, 22, 40, 64], seg: 70, hedge: '#4a7f45', crest: '#9cc77a', tree: 2.2 });
  let x = 0;
  while (x < X1) {
    const r = hsh(x * 0.43 + 2), e = Math.round(edge(x + 6));
    if (r < 0.22) { // palleiros: conical haystacks around a pole
      for (let k = 0; k < 2 + Math.floor(hsh(x) * 2); k++) {
        const hx = x + k * 11, hy = e + 8 + k * 2;
        for (let i = 0; i < 9; i++) px.rect(hx - Math.round(i * 0.55), hy - 9 + i, Math.round(i * 1.1) + 1, 1, P(i < 3 ? '#e8c868' : '#d8b050'));
        px.col(hx + Math.round(4 * 0.55), hy - 6, hy, P('#b8923c')); px.col(hx, hy - 12, hy - 8, P('#6a4a30'));
      }
      x += 40;
    } else if (r < 0.36) { // a farmhouse with a smoking chimney
      const w = 18 + Math.round(hsh(x * 3) * 6);
      house(px, x, e + 9, w, 9, { stone: true, wall: '#bfb9ac', wallD: '#9c968a', chimney: true, rh: 3, win: '#3f4f66' });
      chim.push([x + w - 3, e + 9 - 9 - 3 - 3]);
      x += w + 16;
    } else if (r < 0.48) { horreo(px, x, e + 10, 16); x += 26; }
    else if (r < 0.62) { // Rubia Galega cows in a meadow
      for (let k = 0; k < 3; k++) {
        const cx2 = x + k * 9 + Math.round(hsh(x + k) * 4), cy = e + 12 + Math.round(hsh(x * 2 + k) * 6), dir = hsh(x * 3 + k) > 0.5 ? 1 : -1;
        px.rect(cx2 - 3, cy - 4, 7, 3, P(COW[0])); px.rect(cx2 - 3, cy - 2, 7, 1, P(COW[1]));
        px.col(cx2 - 2, cy - 1, cy + 1, P(COW[1])); px.col(cx2 + 2, cy - 1, cy + 1, P(COW[1]));
        px.rect(cx2 + dir * 4 - (dir < 0 ? 1 : 0), cy - 4, 2, 2, P(COW[0])); px.dot(cx2 + dir * 4, cy - 5, P(COW[2]));
      }
      x += 34;
    } else if (r < 0.74) { // a vine pergola on granite posts
      const n = 4 + Math.floor(hsh(x * 4) * 3);
      for (let k = 0; k <= n; k++) px.col(x + k * 5, e + 2, e + 10, P('#b0aa9e'));
      px.rect(x - 1, e, n * 5 + 3, 3, P('#5b9a46')); for (let k = x; k < x + n * 5 + 2; k += 2) px.dot(k, e - 1 + (k & 1), P('#79b45a'));
      x += n * 5 + 12;
    } else x += 16;
  }
}
function farm3(px) {
  const X1 = px.w - 10;
  const edge = x => 190 - 5 * fbm(x / 60, 111, 3);
  px.fill(-10, X1, edge, P('#68a84a'));
  for (let x = -10; x < X1; x++) { const e = Math.round(edge(x)); px.dot(x, e, P('#86c060')); if (hsh(x * 3.1) > 0.85) px.dot(x, e + 3 + Math.floor(hsh(x) * 20), P('#f2f0d8')); }
  // corn: rows of tall stalks with leaves and tassels
  for (let x = -10; x < X1; x += 2) {
    if (fbm(x / 70, 112, 2) < 0.45) continue;
    const e = Math.round(edge(x)) + 4, h = 18 + Math.round(hsh(x * 1.3) * 8);
    px.col(x, e - h, e, P(hsh(x) > 0.5 ? '#6f9e34' : '#5d8a2c'));
    for (let k = e - h + 5; k < e - 2; k += 4) { const s = ((k >> 2) + x) & 1 ? 1 : -1; px.dot(x + s, k, P('#86b444')); px.dot(x + s * 2, k + 1, P('#86b444')); }
    px.dot(x, e - h - 1, P('#e8d060')); px.dot(x, e - h - 2, P('#f0e090'));
    if (hsh(x * 2.9) > 0.7) px.rect(x + 1, e - h + 9, 1, 3, P('#e8c860'));
  }
  // granite walls along the edge of the fields
  for (let x = -10; x < X1; x += 1) if (fbm(x / 50, 113, 2) < 0.38) { const e = Math.round(edge(x)); px.rect(x, e - 4, 1, 5, P((x >> 2) & 1 ? '#b8b2a6' : '#a8a296')); if (x % 4 === 0) px.col(x, e - 4, e + 1, P('#87827a')); px.dot(x, e - 5, P('#c8c2b6')); }
}
// Right behind the path: a hedgerow, a meadow of tall grass and wildflowers, fence posts with wire, gorse in flower
function farm4(px) {
  const X1 = px.w - 10;
  const top = x => 214 - 4 * fbm(x / 40, 121, 3);
  for (let x = -16; x < X1 + 8; x += 5) if (fbm(x / 70, 123, 2) > 0.5) { const r = 5 + hsh(x * 0.9) * 6; px.disc(x, top(x) - r * 0.4, r, P('#3d7038')); px.disc(x - 1, top(x) - r * 0.6, r - 2, P('#4f8a44')); if (hsh(x * 3) > 0.6) px.dot(x - 2, top(x) - r, P('#6fae55')); }
  for (let x = 20; x < X1; x += 58 + Math.round(hsh(x) * 30)) {
    const t = Math.round(top(x)), nx = x + 58 + Math.round(hsh(x) * 30);
    if (nx < X1 + 60) { px.line(x + 2, t - 15, nx, Math.round(top(nx)) - 15, P('#9a9488')); px.line(x + 2, t - 9, nx, Math.round(top(nx)) - 9, P('#9a9488')); }
    px.rect(x, t - 18, 2, 20, P('#7a5a3c')); px.col(x, t - 18, t + 2, P('#9a7650')); px.dot(x, t - 19, P('#6a4a30'));
  }
  for (let x = 60; x < X1; x += 150 + Math.round(hsh(x * 7) * 120)) {
    const t = Math.round(top(x));
    px.disc(x, t - 5, 6, P('#3f6a32')); px.disc(x + 5, t - 3, 5, P('#3f6a32')); px.disc(x - 1, t - 7, 3.5, P('#4f7f3a'));
    for (let k = 0; k < 12; k++) px.dot(x - 5 + hsh(x + k) * 14, t - 10 + hsh(x * 3 + k) * 9, P(k % 3 ? '#ffd23f' : '#fff09a'));
  }
  px.fill(-10, X1, x => top(x) + 1, P('#5a9a40'));
  for (let x = -10; x < X1; x++) {
    const t = Math.round(top(x)), g = 2 + Math.round(hsh(x * 2.3) * 7 * (0.4 + fbm(x / 20, 122, 2)));
    px.col(x, t - g, t + 2, P(hsh(x * 1.1) > 0.5 ? '#6aa84a' : '#5a983f'));
    if (hsh(x * 3.7) > 0.62) px.dot(x, t - g, P('#8cc45e'));
    if (hsh(x * 9.1) > 0.86) px.rect(x, t - g - 1, 2, 2, P(['#ffffff', '#ffd84a', '#c86ae0', '#ff7a5a', '#7aa8ff'][Math.floor(hsh(x * 7) * 5)]));
    for (let k = 1; k < 4; k++) if (hsh(x * 1.3 + k * 17) > 0.8) px.dot(x, t + 2 + k * 5 + Math.floor(hsh(x + k) * 4), P('#4a8a36'));
  }
}

// ============================================================
// CHERRY ORCHARD: a washed-clean afternoon, a rainbow, the Rande bridge up close
// ============================================================
const PM_CLEAN = [[0, '#3c95ea'], [62, '#74b8f0'], [HOR, '#c8ecfc']];
const PM_WARM = [[0, '#4a86d6'], [62, '#98b5df'], [HOR, '#ffd4a0']];
function orch0(px) {
  const X1 = px.w - 10;
  const f = x => 114 - 18 * fbm(x / 64, 131, 3) - 8 * Math.max(0, Math.sin((x - 60) / 90));
  for (let x = -10; x < X1; x++) {
    const y = Math.round(f(x)), lit = f(x + 2) < f(x - 2) - 0.3;
    px.rect(x, y, 1, HOR + 2 - y, P('#a2b8dc'));
    px.rect(x, y, 1, lit ? 2 : 1, P(lit ? '#c2d2ec' : '#b0c4e4'));
  }
}
const BR = { L: 200, R: 642, T1: 311, T2: 531, D: 100, TOP: 48 };
function orch1(px, cars) {
  water(px, SEA_PM);
  const X1 = px.w - 10;
  // the inner ria behind the bridge, low hills and the white houses of Redondela
  for (let x = 150; x < 680; x++) {
    const y = Math.round(115 - 6 * fbm(x / 40, 141, 3));
    px.rect(x, y, 1, HOR - y, P('#98b3a8')); px.dot(x, y, P('#aec4b6'));
    if (hsh(x * 3.3) > 0.75) { px.rect(x, HOR - 3 - Math.floor(hsh(x) * 3), 2, 2, P('#eef0ec')); }
  }
  // the wooded headlands the bridge lands on: a treeline along the crest, white houses, a beach at the water
  const shore = x => x < BR.L + 10 ? 97 + 8 * fbm(x / 30, 142, 2) + 30 * ss(150, BR.L + 14, x) : 97 + 8 * fbm(x / 30, 143, 2) + 30 * (1 - ss(BR.R - 16, BR.R + 40, x));
  const land = x => !(x > BR.L + 14 && x < BR.R - 16) && shore(x) < HOR - 1;
  for (let x = -10; x < X1; x++) {
    if (!land(x)) continue;
    const y = Math.round(shore(x)), d = HOR - y;
    px.rect(x, y, 1, d, P('#6f9a78')); px.rect(x, y, 1, 2, P(shore(x + 2) > shore(x - 2) + 0.4 ? '#7aa684' : '#88b28a'));
    if (d > 9 && hsh(x * 2.1) > 0.6) px.disc(x, y + 4 + hsh(x) * Math.min(8, d - 9), 1.4, P('#5d8a66'));
    if (d > 14 && hsh(x * 4.7) > 0.84) { const hy = Math.round(y + 6 + hsh(x * 3) * (d - 12)); px.rect(x, hy, 3, 2, P('#f2eee4')); px.rect(x, hy - 1, 3, 1, P('#cf6a4c')); }
    px.dot(x, HOR - 1, P('#e8dcb6'));
  }
  for (let x = -10; x < X1; x += 2) if (land(x) && HOR - shore(x) > 6 && hsh(x * 1.3) > 0.4) {
    const y = shore(x), r = 1.2 + hsh(x * 2.2) * 1.4;
    px.disc(x, y + r * 0.6, r, P('#5d8a66')); px.dot(x - 1, Math.round(y + r * 0.6 - r + 1), P('#86b08c'));
  }
  // cables first, then the deck and the towers over them
  for (const [t, dir] of [[BR.T1, -1], [BR.T1, 1], [BR.T2, -1], [BR.T2, 1]]) for (let k = 1; k <= 10; k++) px.line(t + dir, BR.TOP + 3 + k * 1.6, t + dir * k * 10.6, BR.D - 1, P('#dfe3e8'));
  px.rect(BR.L - 6, BR.D, BR.R - BR.L + 12, 3, P('#d8d6d0')); px.rect(BR.L - 6, BR.D, BR.R - BR.L + 12, 1, P('#f2f1ec')); px.rect(BR.L - 6, BR.D + 3, BR.R - BR.L + 12, 1, P('#8d909c'));
  for (let x = BR.L - 4; x < BR.R + 6; x += 6) px.dot(x, BR.D - 1, P('#f6f6f2'));
  for (const t of [BR.T1, BR.T2]) {
    px.rect(t - 2, BR.TOP, 4, HOR - BR.TOP, P('#e6e4de')); px.col(t - 2, BR.TOP, HOR, P('#fbfaf6')); px.col(t + 1, BR.TOP, HOR, P('#b9b8b6'));
    px.rect(t - 1, BR.TOP - 4, 2, 4, P('#e6e4de')); px.rect(t - 4, BR.D + 4, 8, 2, P('#cfcdc8'));
    px.rect(t - 4, HOR - 4, 8, 4, P('#b0aea8')); px.rect(t - 5, HOR - 1, 10, 1, P('#e8f4f8'));
    for (let k = 1; k <= 10; k++) if ((k & 1) === 0) { px.dot(t, HOR + k * 2, P('#d6e8ee')); px.dot(t - 1, HOR + k * 2 + 1, P('#c0dcea')); }
  }
  for (const x of [BR.L + 14, BR.L + 40, BR.L + 66, BR.R - 18, BR.R - 44]) { px.rect(x - 1, BR.D + 4, 2, HOR - BR.D - 4, P('#c8c6c0')); px.dot(x - 1, HOR, P('#e8f4f8')); }
  for (let i = 0; i < 12; i++) cars.push([hsh(i * 3.3), hsh(i * 7.7) > 0.5 ? 1 : -1, ['#e8443a', '#3a78d8', '#f4f4f4', '#f0c030', '#2f2f38'][i % 5], 0.12 + hsh(i * 5.1) * 0.08]);
}
const BLOSSOM = [['#d66f9c', '#f5a3c6', '#ffd4e5'], ['#cfa9bb', '#f2dde7', '#ffffff'], ['#c25a88', '#ea80ae', '#ffbcd7']];
// A cherry tree in bloom: dark trunk, branches spreading, clumps of blossom at their tips
function cherry(px, x, base, r, k) {
  const b = BLOSSOM[k], th = Math.max(2, Math.round(r * 0.9)), fork = base - th, tips = [], nb = r > 6 ? 5 : r > 3.5 ? 4 : 3;
  px.rect(x - (r > 6 ? 1 : 0), fork, r > 6 ? 3 : 2, th + 1, P('#4a302a')); px.col(x - (r > 6 ? 1 : 0), fork, base, P('#6e4a40'));
  for (let i = 0; i < nb; i++) {
    const a = -Math.PI / 2 + (i - (nb - 1) / 2) * (1.5 / nb) * 1.6 + (hsh(x * 3 + i) - 0.5) * 0.35, len = r * (0.75 + 0.45 * hsh(x * 5 + i));
    const ex = x + Math.cos(a) * len * 1.25, ey = fork + Math.sin(a) * len * 0.85;
    if (r > 3.5) px.line(x, fork, ex, ey, P('#4a302a'));
    tips.push([ex, ey]);
  }
  tips.push([x, fork - r * 0.8]);
  const cr = Math.max(1.4, r * 0.45);
  for (const [tx, ty] of tips) px.disc(tx, ty + 0.6, cr + 0.4, P(b[0]));
  for (const [tx, ty] of tips) px.disc(tx - 0.5, ty - 0.4, cr - 0.5, P(b[1]));
  for (const [tx, ty] of tips) if (cr > 2) px.disc(tx - cr * 0.35, ty - cr * 0.45, cr * 0.38, P(b[2])); else px.dot(tx - 1, ty - 1, P(b[2]));
  if (r > 5) for (let i = 0; i < r * 1.5; i++) { const [tx, ty] = tips[i % tips.length]; px.dot(tx + (hsh(x * 3 + i) - 0.5) * cr * 2.4, ty + (hsh(x * 5 + i) - 0.5) * cr * 2, P(i % 3 ? b[2] : b[0])); }
  if (r > 5) for (let i = 0; i < 6; i++) px.dot(x + (hsh(x * 7 + i) - 0.5) * r * 3, base + 1 + hsh(x + i) * 2, P(b[1]));
}
function orch2(px) {
  const X1 = px.w - 10;
  const edge = x => 154 - 9 * fbm(x / 70, 151, 3) - 4 * Math.sin(x / 50);
  px.fill(-10, X1, edge, P('#74b656'));
  for (let x = -10; x < X1; x++) {
    const e = Math.round(edge(x));
    px.dot(x, e, P('#96cc6e'));
    for (let k = 0; k < 6; k++) px.rect(x, e + 6 + k * 9, 1, 2, P(k % 2 ? '#68a84c' : '#7cbc5c'));
  }
  for (let row = 0; row < 5; row++) for (let x = -10 + row * 5; x < X1 + 10; x += 11 + row * 2 + Math.round(hsh(x * 1.7 + row) * 4)) {
    if (fbm(x / 60 + row * 3, 153, 2) < 0.3) continue;
    cherry(px, x, Math.round(edge(x)) + 4 + row * 9, 2.2 + row * 0.75, hsh(x * 2.3 + row) > 0.72 ? 1 : hsh(x * 4.1 + row) > 0.5 ? 2 : 0);
  }
  for (let x = 60; x < X1; x += 150 + Math.round(hsh(x) * 120)) house(px, x, Math.round(edge(x)) + 14, 16, 8, { stone: true, wall: '#c2bcae', wallD: '#a09a8e', rh: 3, lx: -1 });
  px.haze('#cfe4f0', y => (1 - ss(150, 190, y)) * 0.22);
}
function orch3(px) {
  const X1 = px.w - 10;
  const edge = x => 186 - 7 * fbm(x / 60, 161, 3);
  px.fill(-10, X1, edge, P('#5ea548'));
  for (let x = -10; x < X1; x++) { const e = Math.round(edge(x)); px.dot(x, e, P('#7fc05e')); if (hsh(x * 3.9) > 0.86) px.dot(x, e + 2 + Math.floor(hsh(x) * 16), P('#ffffff')); }
  for (let x = -10; x < X1 + 20; x += 9) if (fbm(x / 50, 162, 2) > 0.55) { const e = Math.round(edge(x)); px.rect(x, e - 4, 9, 5, P('#b5afa2')); px.rect(x, e - 4, 9, 1, P('#cac4b8')); px.dot(x + 4, e - 2, P('#8f897d')); }
  for (let x = 0; x < X1 + 20; x += 38 + Math.round(hsh(x) * 26)) cherry(px, x, Math.round(edge(x)) + 6, 8 + hsh(x * 3) * 5, hsh(x * 7) > 0.7 ? 1 : hsh(x * 9) > 0.5 ? 2 : 0);
}
function orch4(px) {
  const X1 = px.w - 10;
  const top = x => 212 - 6 * fbm(x / 34, 171, 3) - 2 * Math.sin(x / 17);
  for (let x = -16; x < X1 + 8; x += 6) { const r = 4 + hsh(x * 0.8) * 5; px.disc(x, top(x) + r * 0.6, r, P('#2f6f34')); }
  px.fill(-10, X1, x => top(x) + 4, P('#2f6f34'));
  for (let x = -16; x < X1 + 8; x += 6) { const r = 3 + hsh(x * 0.8) * 4; px.disc(x - 1, top(x) + r * 0.5, r - 1, P('#3f8640')); }
  for (let i = 0; i < (X1 + 10) * 0.3; i++) {
    const x = -10 + hsh(i * 3.7) * (X1 + 10), y = top(x) + 1 + hsh(i * 5.1) * 12, k = hsh(i * 2.3);
    if (k < 0.55) { px.rect(x, y, 2, 2, P(k < 0.3 ? '#ffc8dc' : '#f39ec4')); px.dot(x, y, P('#fff0f6')); }
    else if (k < 0.7) { px.rect(x, y, 2, 1, P('#ff4a3a')); px.dot(x, y + 1, P('#2a1a1a')); }
    else if (k < 0.85) { px.rect(x, y, 2, 2, P('#ffffff')); px.dot(x, y, P('#ffe066')); }
  }
}

// ============================================================
// Sprites made once: clouds in four lights, the sun, sun rays, rain tiles, the rainbow, the storm decks
// ============================================================
const CLOUD_PAL = {
  am: ['#e9b8b0', '#fbe0d4', '#fff7ec'], noon: ['#bcd2ea', '#e8f2fb', '#ffffff'],
  pm: ['#c3d4ee', '#eef4fc', '#ffffff'], grey: ['#454d5b', '#596170', '#6f7886']
};
const CLOUD_W = [46, 62, 76, 92, 112, 36];
function cloudSprite(w, s, pal, lx) {
  const h = Math.round(w * 0.5) + 6, base = h - 3, px = new Pix(w + 10, h, 0), puffs = [];
  px.ox = 5;
  const n = 3 + Math.floor(w / 20), m = 1 + Math.floor(w / 46);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, r = w * (0.08 + 0.1 * Math.sin(t * Math.PI)) * (0.8 + 0.45 * hsh(s * 7 + i));
    puffs.push([t * w, base - r * 0.6, r]);
  }
  for (let i = 0; i < m; i++) {
    const t = 0.32 + 0.36 * (m === 1 ? 0.5 : i / (m - 1)) + (hsh(s * 3 + i) - 0.5) * 0.14, r = w * (0.15 + 0.06 * hsh(s * 11 + i));
    puffs.push([t * w, base - r * 0.55 - w * 0.12, r]);
  }
  const C0 = P(pal[0]), C1 = P(pal[1]), C2 = P(pal[2]);
  const put = (dx, dy, dr, c, cut, only) => {
    for (const [x, y, r] of puffs) {
      const R2 = r + dr;
      if (R2 <= 0) continue;
      for (let yy = -Math.floor(R2); yy <= R2; yy++) {
        const Y = Math.round(y + dy + yy);
        if (Y > base - cut) break;
        const hw = Math.floor(Math.sqrt((R2 + 0.5) ** 2 - yy * yy));
        for (let X = Math.round(x + dx) - hw; X <= Math.round(x + dx) + hw; X++) if (!only || px.get(X, Y) === only) px.dot(X, Y, c);
      }
    }
  };
  put(0, 0, 0, C0, 0);
  put(-0.5 * lx, -2, -0.8, C1, 3);
  for (const [x, y, r] of puffs) {
    const hr = r * 0.55, hx = x + lx * r * 0.28, hy = y - r * 0.38;
    for (let yy = -Math.floor(hr); yy <= hr; yy++) { const hw = Math.floor(Math.sqrt((hr + 0.5) ** 2 - yy * yy)); for (let X = Math.round(hx) - hw; X <= Math.round(hx) + hw; X++) if (px.get(X, Math.round(hy + yy)) === C1) px.dot(X, Math.round(hy + yy), C2); }
  }
  for (let X = -5; X < w + 5; X++) if (px.get(X, base) === C0 && hsh(X * 1.7 + s) > 0.5) px.dot(X, base + 1, C0);
  return px.canvas();
}
let CLOUDS = null;

function sunSprite() {
  const R = 64, c = canvasOf(R * 2, R * 2), g = c.getContext('2d');
  const gr = g.createRadialGradient(R, R, 4, R, R, R);
  gr.addColorStop(0, 'rgba(255,246,214,0.85)'); gr.addColorStop(0.25, 'rgba(255,232,180,0.4)'); gr.addColorStop(1, 'rgba(255,224,170,0)');
  g.fillStyle = gr; g.fillRect(0, 0, R * 2, R * 2);
  const px = new Pix(R * 2, R * 2, 0); px.ox = 0;
  px.disc(R, R, 13, P('#ffe7a6')); px.disc(R, R, 12, P('#fff3c8')); px.disc(R - 1, R - 1, 10, P('#fffbea'));
  const d = px.canvas(); g.drawImage(d, 0, 0);
  return c;
}
// Soft rays fanning down from the sun (two sets, crossfaded so they shimmer)
function raySprite(s) {
  const w = 420, h = 260, c = canvasOf(w, h), g = c.getContext('2d'), ox = w / 2, oy = 40;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.12 + 0.76 * (i + hsh(i * 3 + s) * 0.6) / 9), len = 150 + hsh(i * 7 + s) * 110, wd = 0.025 + hsh(i * 5 + s) * 0.035;
    const gr = g.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
    gr.addColorStop(0, 'rgba(255,240,200,0.32)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(ox, oy);
    g.lineTo(ox + Math.cos(a - wd) * len, oy + Math.sin(a - wd) * len); g.lineTo(ox + Math.cos(a + wd) * len, oy + Math.sin(a + wd) * len);
    g.closePath(); g.fill();
  }
  return c;
}
let SUN = null, RAYS = null;

// Rain: tiles of slanted streaks that wrap seamlessly, three depths
const SLANT = -0.32, TILE = 256;
function rainTile(n, l0, l1, a0, a1, s) {
  const px = new Pix(TILE, TILE, 0), C = rgbOf('#dbe8f6');
  px.ox = 0;
  for (let i = 0; i < n; i++) {
    const x0 = hsh(i * 3.1 + s) * TILE, y0 = hsh(i * 7.3 + s) * TILE, len = Math.round(lerp(l0, l1, hsh(i * 1.9 + s))), a = Math.round(lerp(a0, a1, hsh(i * 5.7 + s)));
    for (let j = 0; j < len; j++) {
      const x = wrap(Math.round(x0 + j * SLANT), TILE), y = wrap(Math.round(y0 + j), TILE);
      px.d[y * TILE + x] = pk(C[0], C[1], C[2], Math.round(a * (0.45 + 0.55 * j / len)));
    }
  }
  return px.canvas();
}
let RAIN = null;

// The rainbow: seven soft bands with a faint second bow, fading into the hills at its feet
const RB = { cx: 262, cy: 262, r: 186 };
function rainbowSprite() {
  const w = W + 60, h = 200, px = new Pix(w, h, 0), COL = ['#b07ad8', '#7a72dc', '#5aa8f0', '#6cd070', '#ffe066', '#ffa448', '#ff5e5e'].map(rgbOf);
  px.ox = 0;
  for (let y = 0; y < h; y++) {
    const foot = 1 - ss(96, 150, y);
    if (foot <= 0) continue;
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - RB.cx, y - RB.cy);
      let a = 0, c = null;
      if (d >= RB.r && d < RB.r + 21) { const b = Math.floor((d - RB.r) / 3); c = COL[b]; a = 0.42 * (b === 0 || b === 6 ? 0.75 : 1); }
      else if (d >= RB.r - 18 && d < RB.r) { c = [255, 255, 255]; a = 0.09 * (d - RB.r + 18) / 18; }
      else if (d >= RB.r + 34 && d < RB.r + 48) { const b = 6 - Math.floor((d - RB.r - 34) / 2); c = COL[clamp(b, 0, 6)]; a = 0.13; }
      if (c) px.d[y * w + x] = pk(c[0], c[1], c[2], Math.round(255 * a * foot));
    }
  }
  return px.canvas();
}
let RAINBOW = null;

// The storm cloud deck: rows of heavy billows (lit crowns, dark bellies), a ragged underside, torn wisps (wraps horizontally)
function stormDeck(w, h, s, pal) {
  const px = new Pix(w, h, 0), C = pal.map(c => P(c));
  px.ox = 0;
  const bot = x => h * 0.6 + Math.sin(x / w * Math.PI * 4) * 5 + (fbm(x / 34, s, 3) - 0.5) * 20;
  const near = (x, r) => [-w, 0, w].filter(sh => x + sh + r >= 0 && x + sh - r < w);
  const disc3 = (x, y, r, c) => { for (const sh of near(x, r)) px.disc(x + sh, y, r, c); };
  // the cap of a billow that catches the light from the upper left (painted only over the colour `over`)
  const cap = (x, y, r, k, c, over) => {
    const n = Math.floor(r), R = r + 0.5;
    for (const sh of near(x, r)) for (let dy = -n; dy <= n; dy++) {
      const hw = Math.floor(Math.sqrt(R * R - dy * dy)), Y = Math.round(y + dy);
      for (let dx = -hw; dx <= hw; dx++) { const X = Math.round(x + sh) + dx; if (dy + 0.35 * dx < -k * r && px.get(X, Y) === over) px.dot(X, Y, c); }
    }
  };
  px.rect(0, 0, w, Math.round(h * 0.34), C[1]);
  for (let x = 0; x < w; x += 17) { const r = 11 + hsh(x * 0.31 + s) * 10, y = bot(x) - 15 - r * 0.7; disc3(x, y, r, C[1]); cap(x, y, r, 0.45, C[2], C[1]); }
  for (let x = 0; x < w; x += 14) {
    const r = 10 + hsh(x * 0.73 + s * 3) * 14, y = bot(x) - r * 0.55;
    disc3(x, y, r, C[0]);
    disc3(x - 1, y - 2.5, r - 2, C[1]);
    cap(x - 1, y - 2.5, r - 2, 0.42, C[2], C[1]);
    cap(x - 1, y - 2.5, r - 2, 0.78, C[3], C[2]);
  }
  for (let x = 0; x < w; x += 2) if (hsh(x * 1.37 + s) > 0.6) disc3(x, bot(x) + 1 + hsh(x * 0.7) * 2, 1 + hsh(x * 2.9 + s) * 1.6, C[0]);
  for (let i = 0; i < w / 36; i++) {
    const x = hsh(i * 7.7 + s) * w, y = bot(x) + 6 + hsh(i * 3.1 + s) * 9, len = 8 + hsh(i * 5.3) * 20;
    for (let k = 0; k < len; k++) {
      const X = Math.round(wrap(x + k, w)), Y = Math.round(y + Math.sin(k / 5) * 0.8);
      if (!px.get(X, Y)) px.dot(X, Y, P(pal[0], Math.round(170 * Math.sin(Math.PI * k / len))));
    }
  }
  return px.canvas();
}
let DECK = null;

// ============================================================
// Building everything (once, the first time the mission loads)
// ============================================================
const LAY = [[], [], [], []], LIVE = { chim0: [], chim2: [], tur: [], cars: [], lh: [127, 112] };
let built = 0, SHAFT = null, FOGS = null, BUF = null;
const SKYB = [H, H, H, H], RAINB = [H, H];   // per scene: the sky is hidden below this row; the far rain sheets of the farm
function build() {
  const [A, B, C, D] = SCN;
  LAY[0] = [layer(A, 0.03, 70, homeFar), layer(A, 0.05, 92, homeCies), layer(A, 0.12, 84, homeShore),
    layer(A, 0.25, 136, homeHills), layer(A, 0.45, 160, px => homeMid(px, LIVE.chim0)), layer(A, 0.7, 186, homeNear)];
  LAY[1] = [layer(B, 0.05, 20, woods0), layer(B, 0.12, 10, woods1), layer(B, 0.24, 0, woods2), layer(B, 0.4, 0, woods3), layer(B, 0.62, 0, woods4)];
  SHAFT = shaftStrip(B, 0.3);
  [SHAFT.y0, SHAFT.y1] = cover(LAY[1], 3, 0);
  FOGS = [fogStrip(900, 60, 7), fogStrip(900, 46, 9)];
  LAY[2] = [layer(C, 0.04, 80, px => farm0(px, LIVE.tur)), layer(C, 0.1, 96, farm1), layer(C, 0.22, 128, px => farm2(px, LIVE.chim2)),
    layer(C, 0.4, 160, farm3), layer(C, 0.65, 190, farm4)];
  LAY[3] = [layer(D, 0.03, 70, orch0), layer(D, 0.1, 30, px => orch1(px, LIVE.cars)), layer(D, 0.25, 128, orch2), layer(D, 0.45, 150, orch3), layer(D, 0.7, 186, orch4)];
  LAY.forEach((list, i) => { cull(list); SKYB[i] = cover(list, 0, -10)[1]; });
  RAINB[0] = cover(LAY[2], 1, 0)[1]; RAINB[1] = cover(LAY[2], 3, 0)[1];
  CLOUDS = {};
  for (const k in CLOUD_PAL) CLOUDS[k] = CLOUD_W.map((w, i) => cloudSprite(w, i + 1, CLOUD_PAL[k], k === 'am' ? 1 : -1));
  SUN = sunSprite(); RAYS = [raySprite(1), raySprite(2)];
  RAIN = [rainTile(40, 4, 8, 70, 120, 1), rainTile(34, 7, 12, 110, 170, 2), rainTile(22, 11, 17, 140, 210, 3)];
  RAINBOW = rainbowSprite();
  DECK = [stormDeck(760, 110, 5, ['#5a6372', '#6c7684', '#828c99', '#a0a9b5']), stormDeck(700, 120, 6, ['#3c4553', '#4c5563', '#5e6876', '#7a8593'])];
  BUF = canvasOf(W + 20, H + 20);
  const bg = BUF.getContext('2d'); bg.imageSmoothingEnabled = false; bg.translate(10, 10);
}
function ready() {
  if (!built) {
    built = -1;
    try { build(); built = 1; } catch (err) { errorOnce(err); }
  }
  return built === 1;
}

// ============================================================
// Weather: computed from the camera, eased (smoothstep ramps), plus gusts over time
// ============================================================
const WX = { rain: 0, rainbow: 0, wind: 0, storm: 0 };
const rainAt = x => clamp(0.35 * ss(3150, 3330, x) + 0.65 * ss(3360, 3520, x) - ss(3980, 4200, x), 0, 1);
const stormAt = x => clamp(ss(3080, 3470, x) - ss(3950, 4240, x), 0, 1);
const rainbowAt = x => ss(4120, 4430, x);
const warmAt = x => ss(4800, 5720, x);
function weatherNow() {
  if (typeof LEVELS === 'undefined' || LV !== LEVELS[1] || !LV) { WX.rain = WX.rainbow = WX.wind = WX.storm = 0; return WX; }
  const x = G.cam.x;
  WX.rain = rainAt(x); WX.storm = stormAt(x); WX.rainbow = rainbowAt(x);
  const base = -0.14 - 0.48 * WX.storm - 0.22 * ss(4300, 4700, x) + 0.06 * ss(1300, 1500, x) * (1 - ss(2700, 2900, x));
  WX.wind = clamp(base + 0.12 * Math.sin(G.t * 0.011) + 0.06 * Math.sin(G.t * 0.037 + 1), -1, 1);
  return WX;
}
L2.weather = function () { const w = weatherNow(); return { rain: w.rain, rainbow: w.rainbow, wind: w.wind }; };

// ============================================================
// Live bits drawn every frame
// ============================================================
const SKY = new Map();
// The sky: a column of colours stretched across the screen (cached per set of stops)
function skyFill(g, stops, key, yb) {
  let c = SKY.get(key);
  if (!c) {
    const px = new Pix(1, H + 20, -10);
    px.ox = 0;
    for (let y = -10; y < H + 10; y++) {
      let i = 0;
      while (i + 1 < stops.length && stops[i + 1][0] <= y) i++;
      const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)], k = b[0] > a[0] ? clamp((y - a[0]) / (b[0] - a[0]), 0, 1) : 0;
      px.dot(0, y, PM(a[1], b[1], k));
    }
    c = px.canvas();
    if (SKY.size > 200) SKY.clear();
    SKY.set(key, c);
  }
  g.drawImage(c, 0, 0, 1, yb + 10, -10, -10, W + 20, yb + 10);
  g.drawImage(c, 0, H + 10, 1, 10, -10, H, W + 20, 10);   // the margin a screen shake can show
}
const mixStops = (A, B, k) => A.map((s, i) => [s[0], hexMix(s[1], B[i][1], k)]);

function sun(g, x, y, a) {
  if (a <= 0) return;
  g.globalAlpha = a;
  const k = 0.5 + 0.5 * Math.sin(G.t * 0.013);
  g.globalAlpha = a * (0.55 + 0.45 * k); g.drawImage(RAYS[0], Math.round(x - 210), Math.round(y - 40));
  g.globalAlpha = a * (1 - 0.45 * k); g.drawImage(RAYS[1], Math.round(x - 210), Math.round(y - 40));
  g.globalAlpha = a; g.drawImage(SUN, Math.round(x - 64), Math.round(y - 64));
  g.globalAlpha = 1;
}

// clouds: [sprite index, y, parallax, drift speed, phase]
const CL_HOME = [[3, 30, 0.06, 0.05, 40], [1, 52, 0.04, 0.035, 190], [4, 18, 0.08, 0.06, 330], [0, 72, 0.035, 0.03, 460], [2, 40, 0.05, 0.045, 600], [5, 86, 0.03, 0.025, 690]];
const CL_WOODS = [[1, 12, 0.05, 0.04, 60], [5, 26, 0.04, 0.03, 300], [0, 8, 0.06, 0.05, 520]];
const CL_SCUD = [[0, 62, 0.08, 0.32, 40], [5, 80, 0.1, 0.44, 260], [1, 70, 0.09, 0.38, 520]];
const CL_FARM = [[4, 26, 0.06, 0.07, 30], [2, 50, 0.05, 0.06, 240], [0, 70, 0.04, 0.05, 420], [3, 14, 0.07, 0.08, 560], [5, 84, 0.035, 0.045, 700]];
const CL_ORCH = [[2, 34, 0.06, 0.09, 80], [5, 60, 0.045, 0.07, 300], [0, 18, 0.07, 0.1, 470], [1, 80, 0.04, 0.06, 650]];
function clouds(g, cx, list, pal, a) {
  if (a <= 0.01) return;
  const set = CLOUDS[pal], span = W + 260;
  if (a < 1) g.globalAlpha = a;
  for (const [i, y, p, v, ph] of list) {
    const x = wrap(ph - cx * p - G.t * v, span) - 130;
    g.drawImage(set[i], Math.round(x), y);
  }
  g.globalAlpha = 1;
}

function gulls(g, cx, n, y0, p) {
  for (let i = 0; i < n; i++) {
    const t = G.t + i * 377, x = Math.round(wrap(i * 157 + t * (0.18 + i * 0.05) - cx * p, W + 120) - 60), y = Math.round(y0 + i * 11 + Math.sin(t * 0.017) * 6);
    const fl = (t % 300) < 80 ? Math.floor(t / 6) % 4 : 1, s = i % 2 ? 1 : 0;
    g.fillStyle = '#ffffff';
    g.fillRect(x - 1, y, 3, 1);
    if (fl === 0) { g.fillRect(x - 2 - s, y - 1, 1 + s, 1); g.fillRect(x + 2, y - 1, 1 + s, 1); g.fillRect(x - 3 - s, y - 2, 1, 1); g.fillRect(x + 3 + s, y - 2, 1, 1); }
    else if (fl === 2) { g.fillRect(x - 2 - s, y + 1, 1 + s, 1); g.fillRect(x + 2, y + 1, 1 + s, 1); }
    else { g.fillRect(x - 3 - s, y - 1, 2 + s, 1); g.fillRect(x + 2, y - 1, 2 + s, 1); }
    g.fillStyle = '#3e4454';
    const ty = fl === 0 ? y - 2 : fl === 2 ? y + 1 : y - 1;
    g.fillRect(x - 3 - s - (fl === 0 ? 0 : 1) + (fl === 2 ? 1 : 0), ty, 1, 1); g.fillRect(x + 3 + s + (fl === 0 ? 0 : 1) - (fl === 2 ? 1 : 0), ty, 1, 1);
    g.fillStyle = '#ffb030'; g.fillRect(x + 2, y, 1, 1);
  }
}

// sparkles on the water: a glitter path under the sun, scattered glints, slow wave lines
function sparkles(g, cx, L, S, sunX, y0, y1, dense) {
  const off = offOf(L, S, cx);
  for (let i = 0; i < dense; i++) {
    const cyc = 9 + (i % 7), ph = Math.floor((G.t + i * 5) / cyc), life = (G.t + i * 5) % cyc;
    if (life > cyc - 3) continue;
    const y = Math.round(y0 + Math.pow(hsh(i * 13.1 + ph * 0.37), 1.5) * (y1 - y0)), spread = 3 + (y - y0) * 0.75;
    const x = Math.round(sunX + (hsh(i * 7.7 + ph * 1.3) - 0.5) * 2 * spread);
    g.fillStyle = life < 2 ? '#ffffff' : '#fff0c0';
    g.fillRect(x, y, y > y0 + 10 ? 2 : 1, 1);
    if (life === 1 && y > y0 + 4 && i % 3 === 0) { g.fillRect(x - 1, y, 4, 1); g.fillRect(x, y - 1, 1, 3); }
  }
  g.fillStyle = '#f2fbfc';
  for (let i = 0; i < 14; i++) {
    const cyc = 14 + (i % 5), ph = Math.floor((G.t + i * 11) / cyc), life = (G.t + i * 11) % cyc;
    if (life > 4) continue;
    g.fillRect(Math.round(wrap(hsh(i * 5.3 + ph * 0.71) * 900 - off, W + 20) - 10), Math.round(y0 + 2 + hsh(i * 3.1 + ph) * (y1 - y0 - 2)), life === 2 ? 2 : 1, 1);
  }
  for (let i = 0; i < 10; i++) {
    const u = (G.t * 0.004 + hsh(i * 2.7)) % 1, y = Math.round(y0 + 5 + hsh(i * 9.3) * (y1 - y0 - 5)), len = 4 + Math.round((y - y0) / 5);
    const x = Math.round(wrap(hsh(i * 4.1) * 900 - off + u * 40, W + 60) - 30), a = Math.sin(u * Math.PI);
    g.fillStyle = 'rgba(232,246,250,' + (0.55 * a).toFixed(2) + ')';
    g.fillRect(x, y, len, 1);
  }
}

// a sailboat (tiny) and the ferry with its wake, on a strip with parallax
function boat(g, x, y, s, sail) {
  g.fillStyle = sail;
  for (let r = 0; r < 5 + s; r++) g.fillRect(x, y - 6 - s + r, 1 + Math.floor(r * 0.55), 1);
  g.fillRect(x - 2, y - 3, 1, 2);
  g.fillStyle = '#4a4458'; g.fillRect(x - 3, y, 7 + s, 1);
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 3, y + 1, 7 + s, 1);
}
function ferry(g, x, y, dir) {
  for (let k = 2; k < 40; k += 2) {
    const sp = Math.round(k * 0.16), a = 0.8 * (1 - k / 40);
    g.fillStyle = 'rgba(244,252,255,' + a.toFixed(2) + ')';
    g.fillRect(x - dir * (9 + k), y, 2, 1); g.fillRect(x - dir * (9 + k), y + 1 + sp, 1, 1);
    if (k < 18) g.fillRect(x - dir * (9 + k), y - Math.round(sp * 0.5), 1, 1);
  }
  g.fillStyle = '#f4f4f2'; g.fillRect(x - 8, y - 3, 17, 3);
  g.fillStyle = '#2f5f9f'; g.fillRect(x - 8, y - 1, 17, 1);
  g.fillStyle = '#26324a'; g.fillRect(x - 7, y, 15, 1);
  g.fillStyle = '#e8e6e2'; g.fillRect(x - 5, y - 5, 10, 2);
  g.fillStyle = '#4a5a72'; for (let k = -4; k < 5; k += 2) g.fillRect(x + k, y - 5, 1, 1);
  g.fillStyle = '#e8b030'; g.fillRect(x - dir * 2, y - 7, 2, 2);
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + dir * 9, y - 1, 1, 2);
}

function smoke(g, x, y, k, t) {
  for (let i = 0; i < 5; i++) {
    const u = ((t * 0.35 + i * 9 + k * 13) % 45) / 45;
    g.fillStyle = 'rgba(236,236,240,' + (0.55 * (1 - u)).toFixed(2) + ')';
    const s = 1 + Math.round(u * 3);
    g.fillRect(Math.round(x + u * 10 * (1 + WX.wind) + Math.sin(u * 6 + k) * 1.5), Math.round(y - u * 26), s, s);
  }
}

function turbine(g, x, y, i) {
  g.fillStyle = '#eef2f6'; g.fillRect(x, y, 1, 13);
  const a = G.t * 0.045 + i * 1.7;
  for (let b = 0; b < 3; b++) {
    const ang = a + b * 2.094;
    for (let r = 1; r <= 5; r++) g.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(y + Math.sin(ang) * r), 1, 1);
  }
  g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1);
}

// ============================================================
// The four scenes (screen space, painting the whole screen)
// ============================================================
function drawHome(g, cx) {
  const S = SCN[0], L = LAY[0], sunX = 330 - Math.round(cx * 0.02);
  skyFill(g, AM.sky, 'am', SKYB[0]);
  sun(g, sunX, 62, 1);
  clouds(g, cx, CL_HOME, 'am', 1);
  blit(g, L[0], S, cx);
  blit(g, L[1], S, cx);
  // the lighthouse on Monte Faro
  const lh = LIVE.lh[0] - 1 - offOf(L[1], S, cx), ly = LIVE.lh[1] - 9, on = G.t % 110 < 16;
  if (on) {
    g.fillStyle = '#ffffff'; g.fillRect(lh, ly, 2, 2);
    g.fillStyle = 'rgba(255,246,176,0.55)'; g.fillRect(lh - 1, ly - 1, 4, 4); g.fillRect(lh - 5, ly, 12, 1); g.fillRect(lh, ly - 4, 2, 10);
  }
  blit(g, L[2], S, cx);
  const o2 = offOf(L[2], S, cx);
  sparkles(g, cx, L[2], S, sunX, 130, 170, 34);
  // sailboats and the ferry crossing the ria
  for (let i = 0; i < 5; i++) {
    const bx = Math.round(wrap(i * 173 + G.t * (0.025 + i * 0.006) * (i % 2 ? 1 : -1), 760) - 60 - o2), by = 133 + i * 6 + Math.round(Math.sin(G.t * 0.03 + i) * 0.6);
    if (bx > -12 && bx < W + 12) boat(g, bx, by, i % 3, i === 2 ? '#ffe8d0' : '#ffffff');
  }
  const f1 = Math.round(wrap(G.t * 0.09 + 380, 900) - 100 - o2), f2 = Math.round(800 - wrap(G.t * 0.075 + 610, 900) - o2);
  if (f2 > -50 && f2 < W + 50) ferry(g, f2, 138, -1);
  if (f1 > -50 && f1 < W + 50) ferry(g, f1, 145, 1);
  // red lights on the cranes
  if (G.t % 60 < 30) { g.fillStyle = '#ff4a3a'; for (const x of [372, 383, 414]) g.fillRect(x - o2, x === 383 ? 95 : 107, 1, 1); }
  gulls(g, cx, 5, 64, 0.16);
  blit(g, L[3], S, cx);
  blit(g, L[4], S, cx);
  const o4 = offOf(L[4], S, cx);
  LIVE.chim0.forEach(([x, y], k) => { if (x - o4 > -20 && x - o4 < W + 20) smoke(g, x - o4, y, k, G.t); });
  blit(g, L[5], S, cx);
}

// part: 0 = everything, 1 = only the misty depths (sky to the light shafts), 2 = only the two nearest rows of trees
function drawWoods(g, cx, part) {
  const S = SCN[1], L = LAY[1];
  if (part !== 2) {
  skyFill(g, WOODS_SKY, 'woods', SKYB[1]);
  clouds(g, cx, CL_WOODS, 'noon', 1);
  blit(g, L[0], S, cx);
  g.globalAlpha = 0.8; band(g, FOGS[0], cx * 0.08 + G.t * 0.05, 132); g.globalAlpha = 1;
  blit(g, L[1], S, cx);
  g.globalAlpha = 0.7; band(g, FOGS[1], cx * 0.18 + G.t * 0.09, 176); g.globalAlpha = 1;
  blit(g, L[2], S, cx);
  g.globalAlpha = 0.75 + 0.25 * Math.sin(G.t * 0.017);
  blit(g, SHAFT, S, cx);
  g.globalAlpha = 1;
  motes(g, cx, 28, 0.35);
  }
  if (part === 1) return;
  blit(g, L[3], S, cx);
  blit(g, L[4], S, cx);
}

// pollen and dust drifting in the light
function motes(g, cx, n, p) {
  for (let i = 0; i < n; i++) {
    const t = G.t + i * 211, x = Math.round(wrap(hsh(i * 3.7) * 700 + Math.sin(t * 0.007 + i) * 30 + t * 0.06 - cx * p, W + 40) - 20);
    const y = Math.round(40 + hsh(i * 9.1) * 170 + Math.sin(t * 0.011 + i * 2) * 12 + Math.sin(t * 0.004) * 6);
    const tw = Math.sin(t * 0.09 + i) > 0.2;
    g.fillStyle = tw ? 'rgba(255,250,220,0.95)' : 'rgba(255,246,200,0.45)';
    g.fillRect(x, y, 1, 1);
    if (tw && i % 5 === 0) { g.fillStyle = 'rgba(255,250,220,0.35)'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
  }
}

function drawFarm(g, cx) {
  const S = SCN[2], L = LAY[2], st = stormAt(cx), rain = rainAt(cx), q = Math.round(st * 40);
  skyFill(g, mixStops(FARM_FAIR, FARM_STORM, q / 40), 'farm' + q, SKYB[2]);
  sun(g, 300 - Math.round((cx - S.cam0) * 0.02), 40, 0.75 * (1 - ss(0, 0.5, st)));
  clouds(g, cx, CL_FARM, 'noon', 1 - ss(0.1, 0.6, st));
  if (st > 0.01) {
    g.globalAlpha = st;
    band(g, DECK[0], cx * 0.05 + G.t * 0.12, -14 - Math.round((1 - st) * 40));
    band(g, DECK[1], cx * 0.09 + G.t * 0.22, -26 - Math.round((1 - st) * 50));
    g.globalAlpha = 1;
    clouds(g, cx, CL_SCUD, 'grey', ss(0.25, 0.85, st));
  }
  const tint = (Ly, a) => { if (a > 0.005) { g.fillStyle = rgba('#7d8794', a); g.fillRect(-10, Ly.top, W + 20, Ly.y1 + (Ly.y1 >= H ? 10 : 0) - Ly.top); } };
  blit(g, L[0], S, cx);
  const o0 = offOf(L[0], S, cx);
  LIVE.tur.forEach(([x, y], i) => turbine(g, x - o0, y, i));
  tint(L[0], 0.55 * st);
  if (rain > 0.02) rainSheets(g, cx, 0.45 * rain, 0, 0.3, RAINB[0]);
  blit(g, L[1], S, cx);
  tint(L[1], 0.4 * st);
  blit(g, L[2], S, cx);
  const o2 = offOf(L[2], S, cx);
  LIVE.chim2.forEach(([x, y], k) => { if (x - o2 > -20 && x - o2 < W + 20) smoke(g, x - o2, y, k, G.t); });
  tint(L[2], 0.26 * st);
  if (rain > 0.02) rainSheets(g, cx, 0.35 * rain, 1, 0.5, RAINB[1]);
  blit(g, L[3], S, cx);
  tint(L[3], 0.14 * st);
  blit(g, L[4], S, cx);
  tint(L[4], 0.06 * st);
}

function drawOrchard(g, cx) {
  const S = SCN[3], L = LAY[3], k = warmAt(cx), q = Math.round(k * 40), rb = rainbowAt(cx);
  skyFill(g, mixStops(PM_CLEAN, PM_WARM, q / 40), 'orch' + q, SKYB[3]);
  clouds(g, cx, CL_ORCH, 'pm', 1);
  blit(g, L[0], S, cx);
  if (rb > 0.01) { g.globalAlpha = rb; g.drawImage(RAINBOW, -30 - Math.round((cx - S.cam0) * 0.02) + 20, 0); g.globalAlpha = 1; }
  blit(g, L[1], S, cx);
  const o1 = offOf(L[1], S, cx);
  sparkles(g, cx, L[1], S, -999, 130, 172, 0);
  for (let i = 0; i < 4; i++) {
    const bx = Math.round(wrap(i * 211 + G.t * (0.03 + i * 0.008) * (i % 2 ? -1 : 1), 760) - 40 - o1), by = 133 + i * 4;
    if (bx > -12 && bx < W + 12) boat(g, bx, by, 1 + (i % 2), '#ffffff');
  }
  // cars crossing the Rande bridge
  for (const [ph, dir, c, v] of LIVE.cars) {
    const u = wrap(ph + dir * G.t * v / (BR.R - BR.L + 40), 1), x = Math.round(BR.L - 20 + u * (BR.R - BR.L + 40)) - o1;
    if (x > -4 && x < W + 4) { g.fillStyle = c; g.fillRect(x, BR.D - 2 + (dir > 0 ? 0 : 1), 2, 1); }
  }
  gulls(g, cx, 4, 70, 0.16);
  blit(g, L[2], S, cx);
  blit(g, L[3], S, cx);
  blit(g, L[4], S, cx);
}

const SCENES = [drawHome, drawWoods, drawFarm, drawOrchard];

// Rain streak tiles, tiled across the screen (integer blits keep them crisp)
const RV = [3.6, 5.4, 7.6], RX = [0, 0, 0];   // fall speed of each sheet; how far the gusts have blown it sideways
function rainSheets(g, cx, a, i, par, yb) {
  if (a <= 0.005) return;
  const ox = wrap(Math.round(RX[i] - cx * par), TILE), oy = wrap(Math.round(G.t * RV[i]), TILE), y1 = yb || H + 10;
  g.globalAlpha = Math.min(1, a);
  for (let y = oy - TILE; y < y1; y += TILE) for (let x = ox - TILE; x < W + 10; x += TILE) {
    if (y + TILE <= y1) g.drawImage(RAIN[i], x, y); else g.drawImage(RAIN[i], 0, 0, TILE, y1 - y, x, y, TILE, y1 - y);
  }
  g.globalAlpha = 1;
}

// draw a scene (or part of one) over what is there at alpha a: straight onto the screen when opaque, else via BUF
function over(fn, cx, part, a) {
  if (a <= 0.004) return;
  if (a >= 0.996) { fn(ctx, cx, part); return; }
  const bg = BUF.getContext('2d');
  bg.clearRect(-10, -10, W + 20, H + 20);
  fn(bg, cx, part);
  ctx.globalAlpha = a;
  ctx.drawImage(BUF, -10, -10);
  ctx.globalAlpha = 1;
}
L2.drawBG = function (cx) {
  if (!ready()) { ctx.fillStyle = '#8fd0ff'; ctx.fillRect(-10, -10, W + 20, H + 20); return; }
  const w = weights(cx);
  let i = 0;
  while (i < 3 && w[i] <= 0) i++;
  if (i > 2 || w[i + 1] <= 0) { SCENES[i](ctx, cx, 0); return; }
  const k = w[i + 1];
  if (i === 2) { SCENES[2](ctx, cx, 0); over(SCENES[3], cx, 0, k); return; }
  // into and out of the woods: the open scene stays underneath while the misty forest closes in, and the nearest
  // trunks only fade in once the mist is mostly there (they step out of the fog instead of hanging as see-through
  // columns over the open sky); leaving, the near trunks melt back into the mist first, then the mist lifts
  const enter = i === 0;
  SCENES[enter ? 0 : 2](ctx, cx, 0);
  over(drawWoods, cx, 1, enter ? ss(0, 0.65, k) : 1 - ss(0.35, 1, k));
  over(drawWoods, cx, 2, enter ? ss(0.45, 0.9, k) : 1 - ss(0.1, 0.55, k));
};

// ============================================================
// Particles: petals, leaves and butterflies (world x, screen y), on a private random stream
// ============================================================
const parts = [], flies = [];
const PETAL = ['#ffd2e4', '#ffb0d0', '#fff2f8', '#f592bc'];
const LEAF = ['#6a9a3a', '#86ac40', '#a8b840', '#b07a3a'];
const FLY = [['#ffffff', '#d8dce8'], ['#ffe066', '#e8b830'], ['#ffa040', '#c86020']];
let T = 0;
function stepParticles() {
  const cx = G.cam.x, w = weights(cx), wind = WX.wind, onL2 = typeof LEVELS !== 'undefined' && LV === LEVELS[1];
  const garden = w[0] * (1 - ss(520, 900, cx)), orchard = w[3] * WX.rainbow * (1 - WX.rain);
  if (parts.length < 80) {
    if (garden > 0 && rnd() < 0.16 * garden) {
      if (rnd() < 0.7) parts.push({ x: 300 + rr(-20, 22), y: rr(104, 136), vx: wind, vy: rr(0.25, 0.45), ph: rr(0, 6.3), c: Math.floor(rr(0, 4)), land: 0 });
      else parts.push({ x: rr(250, 560), y: rr(-4, 60), vx: wind, vy: rr(0.3, 0.5), ph: rr(0, 6.3), c: Math.floor(rr(0, 4)), land: 0 });
    }
    if (orchard > 0 && rnd() < 0.4 * orchard) {
      if (rnd() < 0.55) parts.push({ x: cx + W + rr(4, 30), y: rr(30, 210), vx: wind * 1.2, vy: rr(0.15, 0.4), ph: rr(0, 6.3), c: Math.floor(rr(0, 4)), land: 0 });
      else parts.push({ x: cx + rr(0, W + 60), y: -4, vx: wind, vy: rr(0.3, 0.5), ph: rr(0, 6.3), c: Math.floor(rr(0, 4)), land: 0 });
    }
    if (w[1] > 0 && rnd() < 0.07 * w[1]) parts.push({ x: cx + rr(-20, W + 40), y: rr(-6, 24), vx: wind * 0.5, vy: rr(0.35, 0.6), ph: rr(0, 6.3), c: Math.floor(rr(0, 4)), land: 0, leaf: true });
  }
  for (const p of parts) {
    if (p.land) { if (--p.land <= 0) p.dead = true; continue; }
    p.vx += ((p.leaf ? 0.6 : 1.2) * wind - p.vx) * 0.03;
    p.x += p.vx + Math.sin(p.ph + T * 0.05) * (p.leaf ? 0.45 : 0.3);
    p.y += p.vy + Math.sin(p.ph * 1.7 + T * 0.09) * 0.22;
    const gy = onL2 ? groundAt(p.x) : H;
    if (p.y >= gy - 1) { p.y = gy - 1; p.land = 80 + Math.floor(rnd() * 90); }
    if (p.x < cx - 40 || p.x > cx + W + 90 || p.y > H) p.dead = true;
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].dead) parts.splice(i, 1);
  // butterflies in the sunny parts
  const sunny = garden + w[0] * 0.5 + w[2] * (1 - ss(2900, 3150, cx)) + w[3] * WX.rainbow;
  if (flies.length < Math.round(3 * Math.min(1, sunny)) && rnd() < 0.02) {
    const x = cx + rr(60, W + 40);
    flies.push({ x, y: (onL2 ? groundAt(x) : 200) - rr(24, 60), tx: x, ty: 0, t: 0, c: Math.floor(rr(0, 3)), ph: rr(0, 6) });
  }
  for (const f of flies) {
    if (--f.t <= 0) { f.tx = f.x + rr(-60, 60); f.ty = (onL2 ? groundAt(f.tx) : 200) - rr(14, 60); f.t = 60 + Math.floor(rnd() * 90); }
    const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy) || 1;
    f.x += dx / d * 0.55 + Math.sin(T * 0.13 + f.ph) * 0.3;
    f.y += dy / d * 0.4 + Math.sin(T * 0.21 + f.ph) * 0.45;
    if (f.x < cx - 40 || f.x > cx + W + 100) f.dead = true;
  }
  for (let i = flies.length - 1; i >= 0; i--) if (flies[i].dead) flies.splice(i, 1);
}

L2.skyLoad = function (cp) {
  ready();
  seed = 0x2f6b37 + Math.round(cp || 0);
  parts.length = 0; flies.length = 0; T = 0;
  weatherNow();
  for (let i = 0; i < 240; i++) { T++; stepParticles(); }
};
L2.skyUpdate = function () {
  T++;
  weatherNow();
  if (WX.rain > 0.05 && T % 6 === 0) Snd.noise(0.3, 0.04 + 0.03 * WX.rain, 6000); // the rain's hiss
  stepParticles();
  // the rain is blown sideways harder in the gusts (the streaks lean with the storm wind)
  const gust = clamp(-WX.wind / 0.62, 0.35, 1.7);
  for (let i = 0; i < 3; i++) RX[i] = wrap(RX[i] + RV[i] * SLANT * gust, TILE * 64);
};

// ============================================================
// Overlay (screen space, after the world): light tints, petals, leaves, butterflies, rain
// ============================================================
let warmGrad = null, goldGrad = null;
L2.drawOverlay = function (cx) {
  if (!ready()) return;
  const w = weights(cx), wx = weatherNow();
  // a warm morning light from the sun's side, a golden afternoon toward the boss
  if (!warmGrad) {
    warmGrad = ctx.createRadialGradient(330, 60, 10, 330, 60, 430);
    warmGrad.addColorStop(0, 'rgba(255,214,150,0.22)'); warmGrad.addColorStop(1, 'rgba(255,214,150,0)');
    goldGrad = ctx.createLinearGradient(0, 0, 0, H);
    goldGrad.addColorStop(0, 'rgba(255,190,110,0.16)'); goldGrad.addColorStop(1, 'rgba(255,160,90,0.04)');
  }
  if (w[0] > 0) { ctx.globalAlpha = w[0]; ctx.fillStyle = warmGrad; ctx.fillRect(-10, -10, W + 20, H + 20); }
  const gold = w[3] * warmAt(cx);
  if (gold > 0.01) { ctx.globalAlpha = gold; ctx.fillStyle = goldGrad; ctx.fillRect(-10, -10, W + 20, H + 20); }
  ctx.globalAlpha = 1;
  // a few big soft shafts in front, in the woods
  if (w[1] > 0) { ctx.globalAlpha = 0.2 * w[1]; ctx.drawImage(SHAFT.c, offOf(SHAFT, SCN[1], cx), 0, W + 20, H, -10, 0, W + 20, H); ctx.globalAlpha = 1; }
  // petals and leaves
  for (const p of parts) {
    const x = Math.round(p.x - cx), y = Math.round(p.y);
    if (x < -4 || x > W + 4) continue;
    if (p.land) ctx.globalAlpha = Math.min(1, p.land / 40);
    const f = Math.floor(p.ph * 3 + T * (p.leaf ? 0.12 : 0.2)) % 4;
    if (p.leaf) {
      ctx.fillStyle = LEAF[p.c];
      if (f === 0) ctx.fillRect(x - 1, y, 3, 1); else if (f === 1) { ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x, y, 2, 1); } else if (f === 2) ctx.fillRect(x, y - 1, 1, 3); else { ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x - 1, y, 2, 1); }
    } else {
      ctx.fillStyle = PETAL[p.c];
      ctx.fillRect(x, y, f === 1 ? 1 : 2, f === 3 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }
  // butterflies
  for (const f of flies) {
    const x = Math.round(f.x - cx), y = Math.round(f.y), up = Math.floor(T / 4 + f.ph) % 2, c = FLY[f.c];
    ctx.fillStyle = '#3a3030'; ctx.fillRect(x, y, 1, 2);
    ctx.fillStyle = c[0];
    if (up) { ctx.fillRect(x - 2, y - 2, 2, 2); ctx.fillRect(x + 1, y - 2, 2, 2); }
    else { ctx.fillRect(x - 2, y, 2, 2); ctx.fillRect(x + 1, y, 2, 2); }
    ctx.fillStyle = c[1]; ctx.fillRect(x - 1, y + (up ? -1 : 1), 1, 1); ctx.fillRect(x + 1, y + (up ? -1 : 1), 1, 1);
  }
  // rain: a darker sky, three sheets of streaks, splashes on the ground
  const r = wx.rain;
  if (r > 0.01) {
    ctx.fillStyle = 'rgba(28,38,58,' + (0.16 * r).toFixed(3) + ')'; ctx.fillRect(-10, -10, W + 20, H + 20);
    rainSheets(ctx, cx, 0.5 * r, 0, 0.6);
    rainSheets(ctx, cx, 0.6 * ss(0.15, 0.6, r), 1, 0.9);
    rainSheets(ctx, cx, 0.55 * ss(0.5, 1, r), 2, 1.1);
    ctx.fillStyle = 'rgba(220,234,246,0.85)';
    for (let i = 0, n = Math.round(40 * r); i < n; i++) {
      const cyc = 14 + (i % 5) * 3, t = G.t + i * 13, life = t % cyc, gen = Math.floor(t / cyc);
      if (life > 6) continue;
      const sx = Math.round(hsh(i * 7.31 + gen * 1.37) * (W + 20)) - 10, y = Math.round(groundAt(cx + sx)) - 1;
      if (life < 2) ctx.fillRect(sx, y - 1, 1, 2);
      else if (life < 4) { ctx.fillRect(sx - 1, y - 2, 1, 1); ctx.fillRect(sx + 1, y - 2, 1, 1); ctx.fillRect(sx, y, 1, 1); }
      else { ctx.fillRect(sx - 2, y - 1, 1, 1); ctx.fillRect(sx + 2, y - 1, 1, 1); }
    }
  }
};
}
