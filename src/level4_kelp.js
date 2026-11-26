'use strict';
// ============================================================
// Mission 4 AREA 2: KELP FOREST (world x 1700-3400): green-gold light filtering down through a tall swaying kelp
// forest. L4ART.kelp = { x0, x1, steps, bg, behind, ground, front, overlay } (contract: tools/m4polish/build-contract.md,
// joined by level4_scenery.js).
//  bg (screen):      water column, surface shimmer, far kelp on a hazy ridge (p .12), far rocks and arches (p .3),
//                    sunbeams through the canopy (p .25), a far shoal, mid kelp with bladders (p .45), the floating
//                    canopy at the surface (p .25), near boulders (p .7)
//  behind (world):   kelp clumps with gas bladders and broad fronds, rock arches and boulders with sponges, anemones
//                    and starfish, sea horses curled on the kelp, garibaldi, minnow shoals (the animals hazed: clearly
//                    background, never mistaken for a rescue)
//  ground (world):   the sandy floor with holdfasts, cobbles, shells, urchins and starfish, caustic light (6 baked
//                    frames), a rock ledge closing each end, hermit crabs
//  front (screen):   low dark stones and eelgrass at the very bottom (p 1.2), thin dark near stalks framing the screen
//                    edges (p 1.35, they fade out before the swim space)
//  overlay (screen): soft sunbeams over the play layer, marine snow, bubbles rising off the bladders
// Static art is painted pixel by pixel into Int32 buffers and baked in `steps`. Kelp sways with G.t: each baked stalk
// (or strip) is blitted in runs of rows that share one horizontal offset, a few drawImage calls each.
// Deterministic: no Math.random/rand (a private mulberry32 table, hsh and G.t).
// ============================================================
var L4ART = L4ART || {};
{
const Math = globalThis.Math;
const A0 = 1700, A1 = 3400;
const CAM0 = 1300, CAM1 = 3320;                     // camera range the parallax strips are painted for (bg: 1310..3310)
const TAU = Math.PI * 2;
const gAt = x => L4ART.groundAt(x);

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
const NZ = (() => { const r = rng(1700340), a = new Float32Array(65536); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
const nz = (x, y) => NZ[((Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0) & 65535];
function vn(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = (s | 0) * 977;
  return lerp(lerp(nz(i + o, j), nz(i + 1 + o, j), a), lerp(nz(i + o, j + 1), nz(i + 1 + o, j + 1), a), b);
}
function fbm(x, y, s, oct = 3) {
  let v = 0, a = 1, n = 0, f = 1;
  for (let o = 0; o < oct; o++) { v += a * vn(x * f, y * f, s + o * 13); n += a; a *= 0.5; f *= 2.03; }
  return v / n;
}
const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
function mixI(a, b, k) {
  k = clamp(k, 0, 1);
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  return Math.round(ar + ((b >> 16 & 255) - ar) * k) << 16 | Math.round(ag + ((b >> 8 & 255) - ag) * k) << 8 | Math.round(ab + ((b & 255) - ab) * k);
}
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

// the water colour at screen y: bright gold-green under the surface, deep teal-green at the seabed
const WST = [[-12, '#f6f3c2'], [3, '#eef0b2'], [14, '#cfe5a0'], [38, '#a2d0a0'], [80, '#6fb69a'], [128, '#4d9d8e'],
  [182, '#317d7b'], [236, '#22646b'], [284, '#174d58']].map(([y, c]) => [y, I(c)]);
function waterAt(y) {
  let i = 0;
  while (i + 2 < WST.length && WST[i + 1][0] <= y) i++;
  const a = WST[i], b = WST[i + 1];
  return mixI(a[1], b[1], (y - a[0]) / (b[0] - a[0]));
}

// ------------------------------------------------------------ pixel buffers (Int32 colours, NONE = empty)
// local coords (x, y) land at buffer cell (x + ox, y + oy); sy = screen y of local y 0 (for the water haze)
function buf(w, h, ox = 0, oy = 0, sy = 0) { const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox, oy, sy }; }
function put(b, x, y, c) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) { x = Math.round(x); y = Math.round(y); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
function ell(b, cx, cy, rx, ry, c) {
  const RX = rx + 0.5, RY = ry + 0.5, X = Math.round(cx), Y = Math.round(cy);
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++)
    if (i * i / (RX * RX) + j * j / (RY * RY) <= 1) put(b, X + i, Y + j, c);
}
function line(b, x0, y0, x1, y1, c, t = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), h = (t - 1) / 2;
  for (let i = 0; i <= n; i++) rect(b, Math.round(x0 + (x1 - x0) * i / n - h), Math.round(y0 + (y1 - y0) * i / n - h), t, t, c);
}
// a pixel map stamp: rows of letters, '.' skipped, pal maps letters to colours
function stamp(b, x, y, rows, pal, flip) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i];
    if (ch !== '.') put(b, flip ? x + rows[j].length - 1 - i : x + i, y + j, pal[ch]);
  }
}
// 1px outline around everything painted (against empty cells)
function outline(b, c) {
  const add = [], w = b.w, h = b.h, d = b.d;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i] !== NONE) continue;
    if ((x > 0 && d[i - 1] !== NONE) || (x < w - 1 && d[i + 1] !== NONE) || (y > 0 && d[i - w] !== NONE) || (y < h - 1 && d[i + w] !== NONE)) add.push(i);
  }
  for (const i of add) d[i] = c;
}
// mix every painted cell toward the water colour of its screen row by k(x, y) (local coords): depth haze
function haze(b, k) {
  for (let r = 0; r < b.h; r++) {
    const y = r - b.oy, wc = waterAt(y + b.sy);
    for (let q = 0; q < b.w; q++) {
      const i = r * b.w + q, v = b.d[i];
      if (v === NONE) continue;
      const m = k(q - b.ox, y);
      if (m > 0) b.d[i] = mixI(v, wc, m);
    }
  }
}
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function bake(b) {
  const c = canvasOf(b.w, b.h), g = c.getContext('2d'), im = g.createImageData(b.w, b.h), dd = im.data;
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = i * 4;
    dd[j] = v >> 16 & 255; dd[j + 1] = v >> 8 & 255; dd[j + 2] = v & 255; dd[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
function alphaCanvas(w, h, fn) {
  const c = canvasOf(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fn(x, y);
    if (!v) continue;
    const j = (y * w + x) * 4; d[j] = v[0]; d[j + 1] = v[1]; d[j + 2] = v[2]; d[j + 3] = v[3];
  }
  g.putImageData(im, 0, 0);
  return c;
}
const sprite = (b) => ({ img: bake(b), w: b.w, h: b.h, ax: b.ox, ay: b.oy });

// ============================================================
// KELP: stipe, alternating broad blades streaming upward, a golden gas bladder at the base of each blade
// ============================================================
const KP = { st: I('#45441a'), stL: I('#6a6626'), stD: I('#2e3115'),
  bl: [I('#33401b'), I('#55601f'), I('#7b7e28'), I('#a39d35'), I('#c4b84e')],     // rim, dark, mid, lit, glowing tip
  bd: [I('#5e4914'), I('#ae8a2e'), I('#efd87e')] };                                // gas bladder: rim, body, glint
const KF = { st: I('#0f2017'), stL: I('#203b25'), stD: I('#08130c'),                // the dark near stalks in front
  bl: [I('#08130c'), I('#0e1f15'), I('#14291b'), I('#1d3924'), I('#2a4e31')],
  bd: [I('#08130c'), I('#1a3020'), I('#3b5c3a')] };

// one blade from its base (x, y): a = angle from straight up (+ right) at the base, straightening toward the tip and
// snaking (wig), len, wd = widest; ruffled lower margin, crosswise wrinkles, lit upper margin, a tip glowing in the light
function blade(b, x, y, a, len, wd, wig, ph, pal, tone = 0) {
  const n = Math.max(8, Math.ceil(len * 2.4)), ds = len / n;
  let px = x, py = y;
  for (let i = 0; i <= n; i++) {
    const q = i / n, ang = a * (1 - 0.5 * q) + wig * Math.sin(q * 4.4 + ph) * q, sn = Math.sin(ang), cs = Math.cos(ang);
    if (i) { px += sn * ds; py -= cs * ds; }
    const ux = sn >= 0 ? -cs : cs, uy = sn >= 0 ? -sn : sn;     // unit normal on the upper (lit) edge
    const hw = q < 0.05 ? 0.6 : wd / 2 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + q * 0.96)), 0.5) * (1 - 0.25 * q);
    const lo = hw * (1 + 0.24 * Math.sin(q * len * 0.95 + ph * 3)), tip = q > 0.64 ? 1 : 0, wr = Math.sin(q * len * 1.15 + ph) > 0.8;
    for (let t = -lo; t <= hw + 0.01; t += 0.45) {
      const sd = t >= 0 ? t / Math.max(0.6, hw) : t / Math.max(0.6, lo);
      let k;
      if (hw > 0.9 && sd < -0.76) k = 0;
      else if (hw > 1.2 && sd > 0.78) k = 3 + tip;
      else { k = (sd > 0.15 ? 2 : 1) + tip + tone - (wr && sd > -0.6 && sd < 0.6 ? 1 : 0); k = clamp(k, 1, 4); }
      put(b, px + ux * t, py + uy * t, pal.bl[k]);
    }
  }
}
function bladder(b, x, y, pal) {
  ell(b, x, y, 1, 1.5, pal.bd[0]);
  put(b, x, y, pal.bd[1]); put(b, x, y + 1, pal.bd[1]); put(b, x, y - 1, pal.bd[2]);
}
// a stipe from (x, yb) up to top: thin and wavy, blades on short stems with a gas bladder each, streaming up and a
// little downstream (bias); near the surface (cap) they lie out flat into the canopy.
// o: s seed, w width, lean, wav, gap, bl [min, max] blade length, bw blade width, bias, first, cap, bd
function stalk(b, o, pal = KP) {
  const r = rng(o.s * 7919 + 17), len = o.yb - o.top, bias = o.bias ?? 0.16;
  const X = y => { const f = (o.yb - y) / len; return o.x + o.lean * f * f + Math.sin(f * 5.5 + o.s) * o.wav * Math.min(1, f * 3); };
  for (let y = Math.ceil(o.yb); y >= o.top; y--) {
    const x = Math.round(X(y) - o.w / 2);
    rect(b, x, y, o.w, 1, pal.st);
    if (o.w > 1) { put(b, x, y, pal.stL); if (o.w > 2) put(b, x + o.w - 1, y, pal.stD); }
  }
  let side = r() < 0.5 ? -1 : 1, d = (o.first ?? 6) + r() * 6;
  while (d < len) {
    const y = o.yb - d, x = X(y), f = d / len, cap = f > (o.cap ?? 0.9);
    const a = cap ? side * lerp(1.05, 1.45, r()) + bias : side * lerp(0.28, 0.68, r()) + bias;
    const ln = lerp(o.bl[0], o.bl[1], r()) * (cap ? 1.25 : 1) * (f < 0.12 ? 0.6 : 1);
    const bx = Math.round(x + side * (o.w / 2 + 1)), tone = r() < 0.28 ? 1 : r() < 0.25 ? -1 : 0;
    blade(b, bx + side, y - 2, a, ln, o.bw * lerp(0.8, 1.2, r()), lerp(0.12, 0.32, r()) * (r() < 0.5 ? 1 : -1), r() * 9, pal, tone);
    if (o.bd !== false) bladder(b, bx, Math.round(y), pal);
    side = r() < 0.82 ? -side : side;
    d += o.gap * lerp(0.6, 1.4, r());
  }
}

// ============================================================
// ROCK: an outcrop, boulder or arch with a lit, algae-covered top, mottled faces, strata, a shadowed arch ceiling,
// pink coralline crust, tube and ball sponges, anemones, strawberry anemones, starfish
// ============================================================
const RT = [I('#1f2229'), I('#2e313a'), I('#41434d'), I('#585a61'), I('#74747a')];
const ALG = [I('#4a6a2a'), I('#6c8a34'), I('#9aac48')];
const SPONGE = [['#e8823a', '#ffb466', '#9a4a1a'], ['#e8c23e', '#fff08a', '#9a7a1a'], ['#9a5cc0', '#cc94ec', '#5a2a7a'], ['#e0604a', '#ff9a7a', '#8a2a1a']].map(p => p.map(I));
const ANEM = [{ w: I('#ffe2f0'), p: I('#f08ab8'), P: I('#b84a78'), c: I('#d0708e') }, { w: I('#ffffff'), p: I('#ece2cc'), P: I('#a89a80'), c: I('#cfc4ac') },
  { w: I('#ffe4b0'), p: I('#f6984a'), P: I('#b0502a'), c: I('#d8784a') }];
const ANEM_ROWS = ['.w.w.w.', 'wpwpwpw', '.ppppp.', '..pPp..', '..ccc..', '..ccc..'];
const STAR_ROWS = ['...o...', '..ooo..', 'ooooooo', '.ooLoo.', '..ooo..', '.oo.oo.', '.o...o.'];
const STARS = [{ o: I('#f07a2a'), L: I('#ffc070') }, { o: I('#d8405a'), L: I('#ff9aa8') }, { o: I('#9a58c0'), L: I('#d8a0f0') }];

function rock(b, cx, base, w, h, s, o = {}) {
  const hw = w / 2, x0 = Math.floor(cx - hw - 3), x1 = Math.ceil(cx + hw + 3), y0 = Math.floor(base - h * 1.2 - 3), y1 = Math.ceil(base + (o.bury ?? 5));
  const W2 = x1 - x0 + 1, H2 = y1 - y0 + 1, m = new Uint8Array(W2 * H2);
  for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
    const u = (X - cx) / hw, v = (base - Y) / h, n = (fbm(X / 8, Y / 8, s, 3) - 0.5) * 0.3;
    if (Math.abs(u) > 1 + n * 0.5) continue;
    const top = o.arch ? 1 - 0.3 * u * u - 0.12 * u ** 4 : Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), o.round ?? 2.2)), 0.5);
    if (v > top + n * (o.arch ? 0.5 : 0.8)) continue;
    if (o.arch) { const hu = (u - (o.arch.u || 0)) / o.arch.rx, hv = (v + 0.04) / o.arch.ry; if (hu * hu + hv * hv < 1 + n * 1.2) continue; }
    m[(Y - y0) * W2 + X - x0] = 1;
  }
  const M = (X, Y) => X >= x0 && X <= x1 && Y >= y0 && Y <= y1 && m[(Y - y0) * W2 + X - x0] === 1;
  // distance to the outside (chamfer): its slope gives a rounded surface lit from the upper left
  const D = new Float32Array(W2 * H2);
  for (let i = 0; i < D.length; i++) D[i] = m[i] ? 99 : 0;
  const dd = (i, j) => (i < 0 || j < 0 || i >= W2 || j >= H2) ? 0 : D[j * W2 + i];
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) if (m[j * W2 + i]) D[j * W2 + i] = Math.min(D[j * W2 + i], dd(i - 1, j) + 1, dd(i, j - 1) + 1, dd(i - 1, j - 1) + 1.4, dd(i + 1, j - 1) + 1.4);
  for (let j = H2 - 1; j >= 0; j--) for (let i = W2 - 1; i >= 0; i--) if (m[j * W2 + i]) D[j * W2 + i] = Math.min(D[j * W2 + i], dd(i + 1, j) + 1, dd(i, j + 1) + 1, dd(i + 1, j + 1) + 1.4, dd(i - 1, j + 1) + 1.4);
  const DC = (X, Y) => Math.min(9, dd(X - x0, Y - y0));
  const tops = [], faces = [];
  const pal = o.pal || RT, alg = o.alg || ALG;
  for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
    if (!M(X, Y)) continue;
    let dt = 0; while (dt < 4 && M(X, Y - dt - 1)) dt++;
    let db = 0; while (db < 3 && M(X, Y + db + 1)) db++;
    const ceil = db < 3 && Y + db + 1 < base - 1;
    let gx = DC(X + 1, Y) - DC(X - 1, Y), gy = DC(X, Y + 1) - DC(X, Y - 1);
    const gl = Math.hypot(gx, gy) || 1, e = clamp(1.25 - DC(X, Y) / 7, 0, 1);
    const lam = (gx / gl * 0.6 + gy / gl * 0.8) * e;                     // outward normal (-g) toward the light (-0.6, -0.8)
    let sh = 0.46 + 0.62 * lam + ((base - Y) / h - 0.5) * 0.34 + (Math.floor(fbm(X / 9, Y / 8, s + 5, 2) * 4) / 4 - 0.45) * 0.24;
    if (base - Y < 5) sh -= 0.25;
    if (ceil) sh = db === 0 ? -1 : Math.min(sh, 0.2);
    let k = clamp(Math.floor(sh * 4.6), 0, 4);
    let c = pal[k];
    if (dt === 0) c = o.algae === false ? pal[4] : (sh < 0.4 ? alg[1] : alg[2]);
    else if (dt === 1) c = o.algae === false ? pal[Math.max(k, 3)] : alg[sh < 0.4 ? 0 : 1];
    else if (o.crust !== false && !ceil && k >= 2 && fbm(X / 5, Y / 5, s + 21, 2) > 0.73) c = k >= 3 ? I('#b98a96') : I('#94697a');
    put(b, X, Y, c);
    if (dt === 0) tops.push([X, Y]);
    else if (dt > 3 && !ceil && base - Y > 5 && k >= 2 && nz(X, Y + 7) > 0.6) faces.push([X, Y]);
  }
  // a few cracks with a lit ledge above them
  const rc = rng(s * 977 + 3);
  for (let i = 0; i < (o.cracks ?? Math.round(w / 30)); i++) {
    let X = Math.round(cx + (rc() - 0.5) * w * 0.7), Y = Math.round(base - rc() * h * 0.7), dir = rc() < 0.5 ? -1 : 1;
    for (let j = 0; j < 6 + rc() * 10; j++) {
      if (!M(X, Y) || !M(X, Y - 1) || DC(X, Y) < 2) break;
      put(b, X, Y, pal[0]); put(b, X, Y - 1, pal[3]);
      X += dir; if (rc() < 0.35) Y += rc() < 0.6 ? 1 : -1;
    }
  }
  // algae tufts along the top
  if (o.algae !== false) for (const [X, Y] of tops) if (nz(X, Y + s) > 0.62) { const n = 1 + Math.floor(nz(X + 3, Y) * 3); for (let j = 1; j <= n; j++) put(b, X + (j === n && nz(X, Y + 9) > 0.5 ? 1 : 0), Y - j, alg[j === n ? 2 : 1]); }
  const r = rng(s * 131 + 7), pick = list => list.length ? list[Math.floor(r() * list.length)] : null;
  // sponges on the top ledges: a cluster of tubes or a ball
  for (let i = 0; i < (o.sponges || 0); i++) {
    const p = pick(tops); if (!p) break;
    const ball = r() >= 0.6, [X, Y] = p;
    const pal2 = SPONGE[ball ? [0, 2, 3][Math.floor(r() * 3)] : Math.floor(r() * SPONGE.length)];   // no yellow balls: they'd look like pickups
    if (!ball) {
      const n = 2 + Math.floor(r() * 3);
      for (let t = 0; t < n; t++) {
        const tx = X - n + t * 3, th = 4 + Math.floor(r() * 6), ty = Y + 1 - th;
        rect(b, tx, ty, 3, th + 1, pal2[0]); rect(b, tx, ty, 1, th + 1, pal2[1]); rect(b, tx + 2, ty + 1, 1, th, pal2[2]);
        put(b, tx + 1, ty, pal2[2]); put(b, tx, ty, pal2[1]);
      }
    } else {
      const rr = 2 + Math.floor(r() * 2);
      ell(b, X, Y - rr + 1, rr, rr, pal2[0]); ell(b, X + 1, Y - rr + 2, rr - 1, rr - 1, pal2[0]);
      put(b, X - 1, Y - rr, pal2[1]); put(b, X, Y - rr, pal2[1]); put(b, X + rr - 1, Y, pal2[2]); put(b, X + rr, Y - 1, pal2[2]);
    }
  }
  // anemones on the faces and ledges
  for (let i = 0; i < (o.anem || 0); i++) {
    const p = r() < 0.5 ? pick(tops) : pick(faces); if (!p) break;
    stamp(b, p[0] - 3, p[1] - 5, ANEM_ROWS, ANEM[Math.floor(r() * ANEM.length)]);
  }
  // strawberry anemones: bright dots in clusters on the faces
  for (let i = 0; i < (o.dots || 0); i++) {
    const p = pick(faces); if (!p) break;
    for (let j = 0; j < 7; j++) { const dx = Math.round((r() - 0.5) * 7), dy = Math.round((r() - 0.5) * 5); if (M(p[0] + dx, p[1] + dy)) { put(b, p[0] + dx, p[1] + dy, I('#e0405a')); if (r() < 0.4) put(b, p[0] + dx, p[1] + dy - 1, I('#ff9aa8')); } }
  }
  for (let i = 0; i < (o.stars || 0); i++) {
    const p = pick(faces); if (!p) break;
    stamp(b, p[0] - 3, p[1] - 3, STAR_ROWS, STARS[Math.floor(r() * STARS.length)]);
  }
  return { tops, faces, M };
}

// ============================================================
// Sprites for the living things (pixel maps, OUT outline, two frames where they move)
// ============================================================
const SEAHORSE_ROWS = [
  ['....kk......', '...kYYk.....', '..kYYYYkk...', '..kYweYYYkkk', '..kYYYYYYYYk', '..kDYYYkkkk.', '...kDYYk....', '...kDYYLk...',
   '..kDYYLLk...', '.kFkDYLLLk..', '.kFFkYLLLk..', '.kFkDYYLLk..', '..kkDYYLk...', '...kDYYk....', '...kDYk.....', '..kDYk......',
   '..kDYk.kk...', '..kDYkkYYk..', '..kDYYYDYk..', '...kDDDkk...', '....kkk.....'],
  ['....kk......', '...kYYk.....', '..kYYYYkk...', '..kYweYYYkkk', '..kYYYYYYYYk', '..kDYYYkkkk.', '...kDYYk....', '...kDYYLk...',
   '.kkDYYLLk...', 'kFFkDYLLLk..', 'kFFFkYLLLk..', '.kFkDYYLLk..', '..kkDYYLk...', '...kDYYk....', '...kDYk.....', '..kDYk......',
   '..kDYk.kk...', '..kDYkkYYk..', '..kDYYYDYk..', '...kDDDkk...', '....kkk.....']];
const HORSE_PAL = [{ Y: '#f6c445', D: '#d08a26', L: '#ffe9a0', F: '#fff4c8' }, { Y: '#f39a3c', D: '#c45c22', L: '#ffd09a', F: '#ffe6c8' },
  { Y: '#f28ab0', D: '#c0507e', L: '#ffd2e2', F: '#ffeaf2' }];
const CRAB_ROWS = [
  ['.....kkkk.......', '....kSSSSk......', '...kSsssSSk.....', '..kSsSSSsSSk..k.', '..kSsSkSsSSk.kek', '.kSSsSSsSSSkkkRk', '.kSSSsssSSSkRRRk',
   '.kTSSSSSSSTkRRRk', '..kkkkkkkkkkRRk.', '..kRk.kRk.kRkk..', '.kRk.kRk.kRk....', '.kk..kk..kk.....'],
  ['.....kkkk.......', '....kSSSSk......', '...kSsssSSk.....', '..kSsSSSsSSk..k.', '..kSsSkSsSSk.kek', '.kSSsSSsSSSkkkRk', '.kSSSsssSSSkRRRk',
   '.kTSSSSSSSTkRRRk', '..kkkkkkkkkkRRk.', '...kRk.kRk.kRkk.', '...kRk.kRk.kRk..', '...kk..kk..kk...']];
const GARI_ROWS = [
  ['.........kkk....', 'kk.....kkHHHkk..', 'kOk..kkOOHHHOOk.', 'kOOkkOOOOOOOOwkk', 'kOOOOOOOOOOOOekk', 'kOOkkOOOOOOOOOk.', 'kOk..kkOOOOOkk..', 'kk.....kkDDDk...', '.........kkk....'],
  ['.........kkk....', '.k.....kkHHHkk..', 'kOk..kkOOHHHOOk.', 'kOOkkOOOOOOOOwkk', 'kOOOOOOOOOOOOekk', 'kOOkkOOOOOOOOOk.', 'kOk..kkOOOOOkk..', '.k.....kkDDDk...', '.........kkk....']];
const MINNOW_ROWS = [['t..bbb..', 'ttbbbbbe', '.tsssss.', 't..ss...'], ['...bbb..', 'ttbbbbbe', 'ttsssss.', '...ss...']];
const MINNOW_PAL = { t: '#6f9ea6', b: '#3f6f7c', s: '#cfe6e0', e: '#10202a' };
function pixSprite(rows, pal, flip, hz) {
  const b = buf(rows[0].length + 2, rows.length + 2, 1, 1);
  stamp(b, 0, 0, rows, Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, typeof v === 'string' ? I(v) : v])), flip);
  if (hz) for (let i = 0; i < b.d.length; i++) if (b.d[i] !== NONE) b.d[i] = mixI(b.d[i], I('#4a958a'), hz);
  return sprite(b);
}
function ringSprite(r) {
  const n = r * 2 + 3, b = buf(n, n, r + 1, r + 1);
  for (let a = 0; a < 64; a++) put(b, Math.round(Math.cos(a / 64 * TAU) * r), Math.round(Math.sin(a / 64 * TAU) * r), I('#b8faff'));
  put(b, -Math.ceil(r / 2), -Math.ceil(r / 2), I('#ffffff'));
  return sprite(b);
}

// ============================================================
// The baked art (painted in STEPS below)
// ============================================================
const stripW = p => W + 20 + Math.ceil((CAM1 - CAM0) * p) + 16;   // 8 px of sway room on both sides
function strip(p, top, h) { const b = buf(stripW(p), h, 8, -top, 0); b.p = p; b.top = top; return b; }
const done = (b, base, amp, ph) => ({ c: bake(b), p: b.p, top: b.top, h: b.h, base, amp: amp || 0, ph: ph || 0 });

// the water column (screen, p 0)
function waterCanvas() {
  const b = buf(W + 20, H + 20, 10, 10, 0);
  for (let y = -10; y < H + 10; y++) for (let x = -10; x < W + 10; x++) {
    // a faint brighter glow where the light comes down, banded with a 4x4 dither like old console water
    put(b, x, y, waterAt(y));
  }
  return bake(b);
}
// the shimmering underside of the surface: a period-96 tile scrolled live
function surfaceTile() {
  const b = buf(96, 7, 0, 0, 0);
  for (let x = 0; x < 96; x++) {
    const a = x / 96 * TAU, f = Math.sin(a * 2 + 0.8 * Math.sin(a)) + 0.5 * Math.sin(a * 5 + 1);
    put(b, x, 0, I('#fbf8d8')); put(b, x, 1, f > -0.4 ? I('#fbf8d8') : I('#e6efb6'));
    const yb = 3 + Math.round(f);
    for (let y = 2; y <= yb; y++) put(b, x, y, y === yb ? I('#ffffff') : I('#eef3c0'));
    if (f > 0.9) put(b, x, yb + 1, I('#e2efb0'));
  }
  return bake(b);
}
// far kelp (p .12) rising from a hazy ridge
function farLayer() {
  const b = strip(0.12, 0, 244), X1 = b.w - 8;
  const ridge = x => 204 + Math.round((fbm(x / 70, 0.5, 101, 3) - 0.5) * 22 + Math.sin(x / 97) * 4);
  for (let x = -14, i = 0; x < X1 + 14; i++) {
    const n = 1 + Math.floor(hsh(i * 1.7 + 3) * 3);
    for (let k = 0; k < n; k++) stalk(b, { x: x + k * 5 - n * 2, yb: ridge(x) + 6, top: 4 + hsh(i * 3.1 + k) * 34, s: 300 + i * 5 + k, w: 1, lean: (hsh(i + k * 9) - 0.5) * 18, wav: 4, gap: 11, bl: [10, 16], bw: 3, bd: false });
    x += lerp(30, 64, hsh(i * 0.37 + 1));
  }
  for (let x = -8; x < X1 + 8; x++) {
    const y0 = ridge(x);
    for (let y = y0; y < 244; y++) {
      const n = fbm(x / 9, y / 6, 141, 2);
      put(b, x, y, y === y0 ? RT[4] : y === y0 + 1 ? RT[3] : n > 0.6 ? RT[3] : RT[2]);
    }
  }
  haze(b, (x, y) => 0.66 + 0.24 * (1 - y / 244));
  return done(b, 214, 2, 0.4);
}
// far rocks, outcrops and arches (p .3)
function midRockLayer() {
  const b = strip(0.3, 140, 108), X1 = b.w - 8;
  for (let x = 20, i = 0; x < X1 + 60; i++) {
    const w = 60 + hsh(i * 3.3) * 110, h = 28 + hsh(i * 5.7) * 50, arch = hsh(i * 7.1) > 0.6 && w > 100;
    rock(b, x, 238 + Math.round(hsh(i) * 6), w, h, 500 + i, { arch: arch ? { u: (hsh(i * 2) - 0.5) * 0.3, rx: 0.42, ry: 0.62 } : null, sponges: 3, anem: 1, crust: true });
    x += w * 0.7 + 50 + hsh(i * 9.1) * 160;
  }
  haze(b, (x, y) => 0.5 + 0.1 * ss(200, 140, y));
  return done(b, 248);
}
// mid kelp (p .45): clumps with bladders and broad fronds
function midLayer() {
  const b = strip(0.45, 0, 246), X1 = b.w - 8;
  for (let x = -10, i = 0; x < X1 + 10; i++) {
    const n = 1 + Math.floor(hsh(i * 2.9 + 5) * 2), yb = 232 + Math.round(hsh(i * 1.3) * 8);
    for (let k = 0; k < n; k++) stalk(b, { x: x + k * 7 - n * 3, yb, top: 2 + hsh(i * 4.3 + k) * 24, s: 700 + i * 7 + k, w: 2, lean: (hsh(i * 3 + k * 5) - 0.5) * 24, wav: 5, gap: 12, bl: [16, 25], bw: 4.4 });
    x += lerp(64, 130, hsh(i * 0.61 + 2));
  }
  haze(b, (x, y) => 0.42 + 0.22 * (1 - y / 246));
  return done(b, 236, 3, 1.7);
}
// the floating canopy at the surface (p .25): blades lying flat, dark against the light, lit along their tops
function canopyLayer() {
  const b = strip(0.25, 0, 60), X1 = b.w - 8, gaps = [];
  for (let x = -10, i = 0; x < X1 + 30; i++) {
    const w = 40 + hsh(i * 3.7) * 80, n = Math.round(w / 6);
    for (let k = 0; k < n; k++) {
      const bx = x + hsh(i * 11 + k * 1.3) * w, by = 5 + hsh(i * 7 + k * 2.1) * 13, side = hsh(i + k * 3.3) > 0.5 ? 1 : -1;
      blade(b, bx, by, side * lerp(1.35, 1.85, hsh(i * 5 + k)), lerp(14, 28, hsh(i * 9 + k * 7)), 4.5, side * lerp(-0.2, 0.5, hsh(k * 3 + i)), k, KP);
      if (hsh(k * 5 + i) > 0.5) bladder(b, Math.round(bx), Math.round(by), KP);
    }
    // a few blades and bladder strings drifting down from the mat
    for (let k = 0; k < 3; k++) {
      const bx = x + hsh(i * 13 + k) * w, side = hsh(i * 3 + k) > 0.5 ? 1 : -1;
      blade(b, bx, 12, side * lerp(2.5, 2.9, hsh(i + k * 7)), lerp(16, 34, hsh(i * 2 + k)), 3.5, side * 0.3, k + i, KP);
    }
    gaps.push(x + w + 6);
    x += w + 14 + hsh(i * 2.3) * 40;
  }
  haze(b, (x, y) => 0.32 + 0.1 * (1 - y / 60));
  return Object.assign(done(b, 60, 0, 0), { gaps });
}
// sunbeams (p .25, matching the canopy gaps): soft gold light slanting down to the right
function raysLayer(gaps) {
  const w = stripW(0.25), beams = gaps.map((x, i) => [x, 10 + hsh(i * 3.1) * 14, 0.2 + hsh(i * 7.7) * 0.18]);
  return { p: 0.25, top: 0, h: 250, c: alphaCanvas(w, 250, (x, y) => {
    const fy = ss(2, 26, y) * (1 - 0.85 * ss(110, 250, y));
    if (fy <= 0) return null;
    let a = 0;
    for (const [bx, bw, al] of beams) {
      const c = bx + y * 0.36, half = bw / 2 + y * 0.11, e = 1 - Math.abs(x - c) / half;
      if (e > 0) a = Math.max(a, al * (e > 0.5 ? 1 : e > 0.22 ? 0.62 : 0.3));       // stepped edges, crisp like the art
    }
    a *= fy;
    return a > 0.004 ? [255, 246, 196, Math.round(a * 255)] : null;
  }) };
}
// near boulders (p .7): darker, a little haze, the seabed beyond the play layer
function nearLayer() {
  const b = strip(0.7, 186, 70), X1 = b.w - 8;
  for (let x = 10, i = 0; x < X1 + 40; i++) {
    const w = 30 + hsh(i * 4.1) * 70, h = 14 + hsh(i * 6.3) * 30;
    rock(b, x, 252, w, h, 900 + i, { sponges: 2, anem: 1, round: 1.8 });
    x += w * 0.6 + 26 + hsh(i * 8.3) * 90;
  }
  haze(b, (x, y) => 0.2);
  return done(b, 252);
}

// ---- the play layer (world space): kelp clumps, rocks, the floor
// kelp clumps: x, n stipes, optional base y (on a rock), seed; heights reach the canopy
const CLUMPS = [
  { x: 1742, n: 2 }, { x: 1834, n: 2 }, { x: 1922, n: 1 }, { x: 2030, n: 2, yb: 176, on: true }, { x: 2128, n: 3 }, { x: 2246, n: 2 },
  { x: 2352, n: 2 }, { x: 2468, n: 3 }, { x: 2590, n: 1 }, { x: 2700, n: 2 }, { x: 2858, n: 2, yb: 160, on: true }, { x: 2985, n: 3 },
  { x: 3088, n: 2 }, { x: 3196, n: 2 }, { x: 3300, n: 1 }, { x: 3372, n: 2 }];
// rocks: arch / boulder at world x, size, seed, decorations
const ROCKS = [
  { x: 1702, w: 70, h: 44, s: 17, sponges: 2, anem: 1 },
  { x: 1880, w: 52, h: 26, s: 5, sponges: 1, anem: 1, stars: 1 },
  { x: 2045, w: 128, h: 76, s: 3, arch: { u: 0.04, rx: 0.5, ry: 0.66 }, sponges: 4, anem: 3, stars: 1 },
  { x: 2206, w: 70, h: 40, s: 7, sponges: 2, anem: 2 },
  { x: 2534, w: 60, h: 34, s: 9, sponges: 2, anem: 1, stars: 1 },
  { x: 2862, w: 156, h: 92, s: 11, arch: { u: -0.06, rx: 0.5, ry: 0.68 }, sponges: 5, anem: 3, stars: 1 },
  { x: 3124, w: 72, h: 44, s: 13, sponges: 2, anem: 2 },
  { x: 3398, w: 64, h: 40, s: 15, sponges: 2, anem: 1 }];
// sea horses: clump index, height, facing (1 = body to the right of the stalk), colour
const HORSES = [{ c: 1, y: 196, f: 1, p: 0 }, { c: 2, y: 206, f: 1, p: 2 }, { c: 5, y: 190, f: -1, p: 1 }, { c: 7, y: 140, f: 1, p: 2 }, { c: 11, y: 120, f: -1, p: 0 }, { c: 13, y: 176, f: 1, p: 1 }];

function clumpSprite(k, i) {
  const yb = k.yb ?? Math.round(gAt(k.x)) + 2, bw = 120, b = buf(bw, yb + 4, bw / 2, 0, 0);
  for (let j = 0; j < k.n; j++) {
    const s = 1100 + i * 13 + j;
    stalk(b, { x: (j - (k.n - 1) / 2) * 7 + (hsh(s) - 0.5) * 4, yb, top: 2 + hsh(s * 1.7) * 22, s, w: 2, lean: (hsh(s * 2.3) - 0.5) * 34, wav: 6, gap: 14, bl: [24, 36], bw: 5.6 });
  }
  haze(b, (x, y) => 0.14 + 0.14 * (1 - y / 250));
  return { img: bake(b), ax: bw / 2, x: k.x, yb, len: yb - 4, ph: k.x * 0.013, amp: 5 };
}
function rockSprite(o) {
  const gy = Math.round(gAt(o.x)), w = o.w + 28, h = Math.round(o.h * 1.3) + 22, b = buf(w, h, w >> 1, h - 8, gy);
  rock(b, 0, 0, o.w, o.h, o.s, o);
  outline(b, I('#10241f'));
  haze(b, () => 0.06);
  return { img: bake(b), x: o.x - (w >> 1), y: gy - (h - 8), w };
}
// the floor: sand with a lit lip, mottling and ripples, cobbles, shells, kelp holdfasts, urchins and starfish;
// six copies with the caustic net of light baked in
const SAND = [I('#465034'), I('#5a6440'), I('#6f784a'), I('#868b56'), I('#a5a46a'), I('#c2bc82')];
const FLOOR_TOP = 222, SANDSET = new Set(SAND);
function floorBase(clumps) {
  const top = FLOOR_TOP, b = buf(A1 - A0, H + 2 - top, -A0, -top, 0), sand = new Uint8Array(b.w * b.h);
  for (let x = A0; x < A1; x++) {
    const gy = Math.round(gAt(x));
    for (let y = gy; y < H + 2; y++) {
      // bands by depth with a ragged edge, low ripples (a lit crest over a shadowed trough)
      const dy = y - gy, j = Math.round((fbm(x / 16, y / 6, 31, 2) - 0.5) * 6);
      let k = dy === 0 ? 5 : dy === 1 ? 4 : dy + j < 5 ? 3 : dy + j < 10 ? 2 : dy + j < 16 ? 1 : 0;
      if (dy > 2) {
        const rp = (x + Math.round(fbm(x / 30, y / 9, 37, 2) * 24) + (y >> 2) * 7) % 19;
        if (y % 4 === 0 && rp < 6) k = Math.min(4, k + 1);
        else if (y % 4 === 1 && rp > 0 && rp < 7) k = Math.max(0, k - 1);
      }
      put(b, x, y, SAND[k]);
      sand[(y - top) * b.w + x - A0] = dy > 1 ? 1 : 0;
    }
  }
  const r = rng(4242);
  // cobbles and shells
  for (let x = A0 + 6; x < A1 - 6; x += 9 + Math.floor(r() * 30)) {
    const gy = Math.round(gAt(x)), y = gy + 2 + Math.floor(r() * 18), rx = 1.5 + r() * 3, ry = Math.max(1, rx * 0.6);
    if (r() < 0.6) { ell(b, x, y, rx, ry, I('#3f4c3c')); ell(b, x, y - 0.5, rx - 0.6, ry - 0.5, I('#66786a')); put(b, x - 1, y - Math.ceil(ry), I('#90a28a')); }
    else { put(b, x, y, I('#f2e6d4')); put(b, x + 1, y, I('#e8b8a8')); if (r() < 0.5) put(b, x, y - 1, I('#fff4e8')); }
  }
  // kelp holdfasts: root claws gripping the sand at each clump
  for (const k of clumps) if (!k.on) {
    const gy = Math.round(gAt(k.x));
    for (let j = 0; j < 9; j++) {
      const a = -1.25 + j * 0.31, len = 6 + r() * 7, ex = k.x + Math.sin(a) * len * 1.3, ey = gy + 1 + Math.cos(a) * 2;
      line(b, k.x + Math.sin(a) * 2, gy - 6, ex, ey, I('#3e3416'), 2);
      line(b, k.x + Math.sin(a) * 2, gy - 7, ex, ey - 1, j % 2 ? I('#6e5a26') : I('#8a7432'));
    }
    ell(b, k.x, gy - 6, 3, 2, I('#6e5a26')); put(b, k.x - 1, gy - 8, I('#9a8440'));
  }
  // purple sea urchins, starfish on the sand
  for (const [x, kind] of [[1790, 0], [2108, 0], [2118, 1], [2290, 0], [2420, 2], [2640, 0], [2650, 0], [2780, 1], [3010, 0], [3240, 2], [3330, 0]]) {
    const gy = Math.round(gAt(x));
    if (kind === 0) {
      for (let a = 0; a < 12; a++) { const an = Math.PI + a / 11 * Math.PI; line(b, x, gy - 2, x + Math.cos(an) * 5, gy - 2 + Math.sin(an) * 4.5, a % 2 ? I('#7a3e8e') : I('#5a2a6a')); put(b, x + Math.round(Math.cos(an) * 5), gy - 2 + Math.round(Math.sin(an) * 4.5), I('#b070c8')); }
      ell(b, x, gy - 1, 3, 2, I('#3e1a4a')); put(b, x - 1, gy - 3, I('#9a5ab0'));
    } else stamp(b, x - 3, gy - 4, STAR_ROWS, Object.fromEntries(Object.entries(STARS[kind]).map(([k, v]) => [k, v])));
  }
  // both ends close on a low slate ledge sitting on the sand, its rounded foot reaching the area border (the
  // neighbour meets rock, not a sand seam), with cobbles drifting up against its inner side
  for (const [ex, s0] of [[A0, 61], [A1, 67]]) {
    const gy = Math.round(gAt(ex));
    rock(b, ex + (ex === A0 ? 22 : -22), gy + 2, 50, 14, s0, { sponges: 1, cracks: 1, bury: 0 });
    for (let k = 0; k < 7; k++) {
      const x = ex + (ex === A0 ? 1 : -1) * (46 + k * 5 + r() * 4), y = gy + 1 + Math.floor(r() * 5), rx = 1.5 + r() * 2.5;
      ell(b, x, y, rx, rx * 0.6, I('#3f4c3c')); ell(b, x, y - 0.5, rx - 0.6, rx * 0.6 - 0.5, I('#66786a')); put(b, x - 1, y - Math.ceil(rx * 0.6), I('#90a28a'));
    }
  }
  return { b, sand, top };
}
// one caustic frame: the net of light baked onto the sand (6 frames, cycled live)
function floorFrame(F, f) {
  const { b, sand, top } = F, c = buf(b.w, b.h, b.ox, b.oy, 0), tau = f / 6 * TAU;
  c.d.set(b.d);
  for (let x = A0; x < A1; x++) {
    const gy = gAt(x), a = x / 96 * TAU;
    for (let y = top; y < H + 2; y++) {
      const i = (y - top) * b.w + x - A0;
      if (!sand[i] || !SANDSET.has(c.d[i])) continue;           // sand only: not the ledge, cobbles, holdfasts
      const v = Math.sin(a * 3 + Math.sin(y * 0.41 + tau) * 2.1 + tau) + Math.sin(a * 2 - y * 0.29 - tau * 2);
      const fade = 1 - clamp((y - gy) / 26, 0, 0.8);
      if (v > 1.38) c.d[i] = mixI(c.d[i], I('#eef2b8'), 0.48 * fade);
      else if (v > 1.1) c.d[i] = mixI(c.d[i], I('#eef2b8'), 0.2 * fade);
    }
  }
  return bake(c);
}
// the low foreground at the very bottom (screen, p 1.2): dark rocks, young kelp tufts, eelgrass
function frontLayer() {
  const b = strip(1.2, 228, 44), X1 = b.w - 8;
  const FP = [I('#0a1612'), I('#10211a'), I('#162c22'), I('#1f3a2c'), I('#2f5038')];
  for (let x = 0, i = 0; x < X1; i++) {
    const w = 30 + hsh(i * 3.9) * 50, h = 12 + hsh(i * 2.2) * 10;
    // eelgrass and young kelp behind the stone, then the stone with a mossy lip
    for (let t = 0; t < 2; t++) {
      const tx = x + (t ? w * 0.75 : -w * 0.15) + (hsh(i * 3 + t) - 0.5) * 10;
      for (let k = 0; k < 5; k++) {
        const gh = 9 + hsh(i * 5 + k * 3 + t) * 15, lean = (k - 2) * 2.2 + (hsh(i + k * 9 + t) - 0.5) * 3, gx = tx + (k - 2) * 1.5;
        for (let j = 0; j <= gh; j++) {
          const q = j / gh, xx = gx + lean * q * q;
          put(b, xx, 272 - j, q > 0.8 ? I('#40622e') : I('#1a3520'));
          put(b, xx + 1, 272 - j, q > 0.8 ? I('#2c4a24') : I('#10241a'));
        }
      }
    }
    if (hsh(i * 4.4) > 0.45) stalk(b, { x: x + w * 0.3, yb: 270 - h * 0.5, top: 232 + hsh(i) * 10, s: 1600 + i, w: 2, lean: 4, wav: 2, gap: 8, bl: [9, 14], bw: 5, bd: false }, KF);
    rock(b, x, 278, w, h, 1500 + i, { crust: false, cracks: 0, pal: FP, alg: [I('#1e3a1e'), I('#2c4c26'), I('#3e6430')] });
    x += w + 30 + hsh(i * 1.7) * 110;
  }
  return done(b, 272, 2, 0.9);
}
// the dark near stalks (screen, p 1.35, sparse: they frame the edges)
const NEAR = [{ x: 139, s: 2001, lean: 10 }, { x: 611, s: 2002, lean: -14 }, { x: 1190, s: 2003, lean: 8 }, { x: 1760, s: 2004, lean: -10 }, { x: 2330, s: 2005, lean: 12 }, { x: 2860, s: 2006, lean: -6 }];
function nearStalk(o) {
  const bw = 120, b = buf(bw, H + 6, bw / 2, 0, 0);
  stalk(b, { x: 0, yb: H + 4, top: -10, s: o.s, w: 3, lean: o.lean, wav: 8, gap: 18, bl: [30, 42], bw: 6.5, first: 30 }, KF);
  return { img: bake(b), ax: bw / 2, x: o.x, amp: 7, ph: o.x * 0.01 };
}

// a baked sprite set for a living thing; hz > 0 mixes it toward the water (background animals stay clearly background)
function pixSet(rows, pal, hz) { return rows.map(r => [pixSprite(r, pal, false, hz), pixSprite(r, pal, true, hz)]); }
const BG_ANIMAL = { k: '#24382e', w: '#e8f4ea', e: '#1a2a2a' };
// the bake, in steps (each well under ~100 ms in the harness); the draw hooks run only after all of them
const STEPS = [
  () => { B.water = waterCanvas(); B.surf = surfaceTile(); B.rings = [1, 2, 3, 4].map(ringSprite); },
  () => { B.far = farLayer(); },
  () => { B.midRock = midRockLayer(); },
  () => { B.mid = midLayer(); },
  () => { B.canopy = canopyLayer(); B.rays = raysLayer(B.canopy.gaps); },
  () => { B.near = nearLayer(); },
  ...[0, 1, 2, 3].map(q => () => { for (let i = q * 4; i < Math.min(CLUMPS.length, q * 4 + 4); i++) { const c = clumpSprite(CLUMPS[i], i); c.on = !!CLUMPS[i].on; B.clumps[i] = c; } }),
  () => { B.rocks = ROCKS.slice(0, 4).map(rockSprite); },
  () => { B.rocks.push(...ROCKS.slice(4).map(rockSprite)); },
  () => { B.floorBase = floorBase(CLUMPS); },
  () => { for (let f = 0; f < 3; f++) B.floor.push(floorFrame(B.floorBase, f)); },
  () => { for (let f = 3; f < 6; f++) B.floor.push(floorFrame(B.floorBase, f)); B.floorBase = null; },
  () => { B.front = frontLayer(); },
  () => {
    B.nears = NEAR.map(nearStalk);
    B.horse = HORSE_PAL.map(p => pixSet(SEAHORSE_ROWS, { ...BG_ANIMAL, ...p }, 0.22));
    B.crab = pixSet(CRAB_ROWS, { ...BG_ANIMAL, S: '#f0d4a4', s: '#b0703c', T: '#c89a6a', R: '#e8503a', e: '#ffffff' }, 0.2).map(f => f[0]);
    B.gari = pixSet(GARI_ROWS, { ...BG_ANIMAL, O: '#ff7a14', H: '#ffb24a', D: '#d0500e', w: '#ffffff', e: '#1a1a1a' }, 0.26);
    B.minnow = pixSet(MINNOW_ROWS, MINNOW_PAL, 0.1);
  }
];
const B = { clumps: [], rocks: [], floor: [] };

// ============================================================
// Drawing (every frame: blits and a few small live bits)
// ============================================================
// where a strip sits for camera cx, and the strip blitted in runs of rows that share one sway offset
const offOf = (S, cx) => clamp(Math.round((cx - CAM0) * S.p), 0, S.c.width - W - 36) + 8;
function swayOff(y, base, len, ph, amp, sp = 1) {
  const f = clamp((base - y) / len, 0, 1);
  return Math.round(amp * Math.pow(f, 1.4) * Math.sin(G.t * 0.02 * sp + ph + f * 1.2) + amp * 0.3 * f * Math.sin(G.t * 0.043 * sp + ph * 1.7 - f * 5));
}
function blitStrip(g, S, cx, dx = 0) {
  const sx = offOf(S, cx);
  if (!S.amp) { g.drawImage(S.c, sx - dx, 0, W + 20, S.h, -10, S.top, W + 20, S.h); return; }
  let y0 = 0, o0 = swayOff(S.top, S.base, S.base, S.ph, S.amp);
  for (let y = 1; y <= S.h; y++) {
    const o = y < S.h ? swayOff(S.top + y, S.base, S.base, S.ph, S.amp) : 1e9;
    if (o !== o0) { g.drawImage(S.c, sx - o0 - dx, y0, W + 20, y - y0, -10, S.top + y0, W + 20, y - y0); y0 = y; o0 = o; }
  }
}
// a baked stalk (top-left at x - ax, y top 0) blitted with the sway (world or screen space, current ctx)
function swayDraw(g, k, x, base, len) {
  const img = k.img, h = img.height;
  let y0 = 0, o0 = swayOff(0, base, len, k.ph, k.amp);
  for (let y = 1; y <= h; y++) {
    const o = y < h ? swayOff(y, base, len, k.ph, k.amp) : 1e9;
    if (o !== o0) { g.drawImage(img, 0, y0, img.width, y - y0, Math.round(x) - k.ax + o0, y0, img.width, y - y0); y0 = y; o0 = o; }
  }
}
// tiles a horizontally periodic strip across the screen
function tileX(g, img, y, off) {
  const w = img.width;
  for (let x = -10 - (((Math.round(off) % w) + w) % w); x < W + 10; x += w) g.drawImage(img, x, y);
}

function myBG(g, cx) {
  const b = B;
  g.drawImage(b.water, -10, -10);
  tileX(g, b.surf, 0, (cx - CAM0) * 0.25 + G.t * 0.25);
  blitStrip(g, b.far, cx);
  blitStrip(g, b.midRock, cx);
  g.globalAlpha = 0.85 + 0.15 * Math.sin(G.t * 0.017); blitStrip(g, b.rays, cx); g.globalAlpha = 1;
  // a far shoal of small silver fish wheeling slowly in the haze
  for (let k = 0; k < 4; k++) {
    const sx = 330 + k * 280 - (cx - CAM0) * 0.5 + Math.sin(G.t * 0.006 + k) * 60, sy = 104 + (k % 2) * 34 + Math.sin(G.t * 0.011 + k) * 14, dir = Math.cos(G.t * 0.006 + k) > 0 ? 1 : -1;
    if (sx < -60 || sx > W + 60) continue;
    for (let i = 0; i < 14; i++) {
      const fx = Math.round(sx + (hsh(i * 3.1 + k) - 0.5) * 70 + Math.sin(G.t * 0.03 + i) * 3), fy = Math.round(sy + (hsh(i * 5.3 + k) - 0.5) * 26 + Math.sin(G.t * 0.05 + i * 2) * 2);
      g.fillStyle = '#5f9a8e'; g.fillRect(fx - 2, fy, 4, 1); g.fillStyle = '#a9d2c4'; g.fillRect(fx - 1, fy + 1, 3, 1); g.fillRect(fx - 2 * dir - (dir > 0 ? 1 : 0), fy, 1, 1);
    }
  }
  blitStrip(g, b.mid, cx);
  blitStrip(g, b.canopy, cx, Math.round(Math.sin(G.t * 0.012) * 2));
  blitStrip(g, b.near, cx);
}

// the play layer, world space (ctx already translated by -cx)
function myBehind(cx) {
  const b = B, vis = (x, w) => x + w > cx - 10 && x - w < cx + W + 10;
  for (const k of b.clumps) if (!k.on && vis(k.x, 60)) swayDraw(ctx, k, k.x, k.yb, k.len);
  for (const r of b.rocks) if (r.x + r.w > cx - 4 && r.x < cx + W + 4) ctx.drawImage(r.img, r.x, r.y);
  for (const k of b.clumps) if (k.on && vis(k.x, 60)) swayDraw(ctx, k, k.x, k.yb, k.len);
  // sea horses curled round the stalks, bobbing, fins fluttering
  for (const h of HORSES) {
    const k = b.clumps[h.c];
    if (!vis(k.x, 40)) continue;
    const bob = Math.round(Math.sin(G.t * 0.04 + h.c) * 1.2), x = k.x + swayOff(h.y, k.yb, k.len, k.ph, k.amp) + (CLUMPS[h.c].n > 1 ? -3 : 0);
    const s = b.horse[h.p][Math.floor(G.t / 9 + h.c) % 2][h.f > 0 ? 0 : 1];
    ctx.drawImage(s.img, h.f > 0 ? x - 6 : x - s.w + 6, h.y - 20 + bob);
  }
  // garibaldi patrolling the rocks
  for (const [x0, y0, span, ph] of [[2048, 222, 34, 0], [2196, 196, 26, 2], [2866, 214, 40, 1], [3120, 196, 24, 3]]) {
    if (!vis(x0, 60)) continue;
    const t = G.t * 0.012 + ph, x = x0 + Math.sin(t) * span, dir = Math.cos(t) > 0 ? 0 : 1, s = b.gari[Math.floor(G.t / 7 + ph) % 2][dir];
    ctx.drawImage(s.img, Math.round(x) - (s.w >> 1), Math.round(y0 + Math.sin(t * 2.3) * 2) - (s.h >> 1));
  }
  // shoals of small silver fish turning together
  for (const [x0, y0, ph] of [[1915, 200, 0], [2420, 122, 2], [2990, 172, 4], [3262, 112, 1]]) {
    if (!vis(x0, 90)) continue;
    const t = G.t * 0.008 + ph, sx = x0 + Math.sin(t) * 40, sy = y0 + Math.sin(t * 2) * 8, dir = Math.cos(t) >= 0 ? 1 : -1;
    for (let i = 0; i < 12; i++) {
      const fx = Math.round(sx + (hsh(i * 3.1 + ph) - 0.5) * 54 + Math.sin(G.t * 0.05 + i) * 2), fy = Math.round(sy + (hsh(i * 5.3 + ph) - 0.5) * 22 + Math.sin(G.t * 0.07 + i * 2));
      const s = b.minnow[Math.floor(G.t / 6 + i) % 2][dir > 0 ? 0 : 1];
      ctx.drawImage(s.img, fx - (s.w >> 1), fy - (s.h >> 1));
    }
  }
}
function myGround(cx) {
  const b = B, img = B.floor[Math.floor(G.t / 10) % 6];
  const x0 = Math.max(A0, Math.floor(cx) - 2), x1 = Math.min(A1, Math.ceil(cx) + W + 2);
  if (x1 > x0) ctx.drawImage(img, x0 - A0, 0, x1 - x0, img.height, x0, FLOOR_TOP, x1 - x0, img.height);
  // a hermit crab trundling along, stopping now and then
  for (const [xc, span, ph] of [[2162, 30, 0], [2760, 24, 2], [3240, 30, 1]]) {
    if (xc < cx - 30 || xc > cx + W + 30) continue;
    const t = (G.t * 0.5 + ph * 200) % 400, walk = t < 300, x = xc + Math.sin((walk ? t : 300) / 300 * Math.PI * 2) * span * 0.5;
    const dirR = Math.cos((walk ? t : 300) / 300 * Math.PI * 2) > 0, s = b.crab[walk ? Math.floor(G.t / 6) % 2 : 0];
    ctx.save(); ctx.translate(Math.round(x), Math.round(gAt(x)) + 1); if (!dirR) ctx.scale(-1, 1);
    ctx.drawImage(s.img, -(s.w >> 1), -s.h + 1); ctx.restore();
  }
}
function myFront(cx) {
  const b = B, a = ctx.globalAlpha;
  blitStrip(ctx, b.front, cx);
  // the near stalks only frame the screen edges: they fade out on their way toward the middle (the swim space stays clear)
  for (const k of b.nears) {
    const x = k.x - (cx - A0) * 1.35, edge = 1 - ss(34, 92, Math.min(x, W - x));
    if (x < -70 || x > W + 70 || edge <= 0 || x < A0 - cx + 40 || x > A1 - cx - 40) continue;
    ctx.globalAlpha = a * 0.9 * edge;
    swayDraw(ctx, k, x, H + 4, H + 14);
  }
  ctx.globalAlpha = a;
}
function myOverlay(cx) {
  const b = B, a = ctx.globalAlpha;
  ctx.globalAlpha = a * (0.55 + 0.12 * Math.sin(G.t * 0.021)); blitStrip(ctx, b.rays, cx, -6); ctx.globalAlpha = a;
  // marine snow drifting through the light
  for (let i = 0; i < 40; i++) {
    const t = G.t + i * 173, x = Math.round(((hsh(i * 3.7) * 900 - cx * 0.9 + t * 0.06 + Math.sin(t * 0.01 + i) * 8) % (W + 20) + W + 20) % (W + 20) - 10);
    const y = Math.round(40 + ((hsh(i * 9.1) * 220 + t * 0.05) % 210));
    ctx.fillStyle = i % 3 ? 'rgba(236,240,200,0.55)' : 'rgba(255,255,230,0.9)'; ctx.fillRect(x, y, 1, 1);
  }
  // bubbles rising off the kelp bladders
  for (let i = 0; i < 9; i++) {
    const per = 300 + (i % 4) * 47, ph = (G.t + i * 97) % per, gen = Math.floor((G.t + i * 97) / per);
    const k = b.clumps[Math.floor(hsh(i * 2.7 + gen * 0.31) * b.clumps.length)], x0 = k.x + (hsh(i + gen) - 0.5) * 20 - cx;
    if (x0 < -20 || x0 > W + 20) continue;
    const y = 220 - hsh(i * 5 + gen) * 80 - ph * 0.7, x = x0 + Math.sin(ph * 0.08 + i) * 2;
    if (y < 30) continue;
    const s = b.rings[i % 2];
    ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
  }
  ctx.globalAlpha = a;
}

L4ART.kelp = {
  x0: A0, x1: A1,
  steps: STEPS,
  bg: (g, cx) => myBG(g, cx),
  behind: cx => myBehind(cx),
  ground: cx => myGround(cx),
  front: cx => myFront(cx),
  overlay: cx => myOverlay(cx)
};
}
