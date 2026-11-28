'use strict';
var L8 = L8 || {};
// =====================================================================================================================
// Mission 8 (DINOSAUR VALLEY): the far picture. The mission is ONE DAY in the valley, area by area:
//   1 CRASH SITE         dawn over the jungle, the volcano far off and asleep
//   2 LONG-NECK LAGOON   a bright morning on the water, real long-necks wading far out
//   3 BONE CANYON        red rock in the afternoon sun
//   4 REX RUN!           dusk, the volcano close and awake
//   5 ROBO HATCHERY      the Oggles' hall of incubator tubes (indoors: cut off by its two walls, never faded)
//   6 OGGLE REX          night on the launch pad; when the Master Switch is thrown, morning comes (L8.dawnK())
// Every backdrop is a sky (500 x 290, drawn at -10, -10 so a shaking screen never shows a gap) and layers that scroll
// slower than the world (tiles 960 px wide that wrap), each painted once into a pixel buffer. The outdoor backdrops
// fade into one another over 300 px of camera travel round 1450, 2900 and 4300.
//
// Readability rule: robots are green. Behind the play band (y 180-230) every backdrop is pale mist, water, warm rock
// or dark steel-blue: never mid green.
//
// Exports: L8.drawBG(cx), L8.paint (the painters, for level8_scenery.js), L8.bakeSome(ms), L8.AREAS, L8.EXIT_X.
// Never Math.random() / rand(): M8.rng, the stable noise and G.t only.
// =====================================================================================================================
{
const Math = globalThis.Math;
const { NONE, buf, put, get, rect, shape, oval, poly, line, capsule, tube, bez, outline, form, stamp, canvasOf } = M8.px;
const I = M8.I, P = M8.P, nz = M8.nz, fbm = M8.fbm, mixI = M8.mixI, lerp = M8.lerp, memo = M8.memo, rng = M8.rng;
const K0 = M8.art.K0, K1 = M8.art.K1;

const LW = 960, LH = 252, SW = W + 20, SH = H + 20;
const GATE = L8.GATE_X, EXIT = 7046;                       // the hatchery's two walls (each 34 px thick, from x - 3)
const X0 = [0, 1450, 2900, 4300, GATE + 14, EXIT + 14];    // where each area's picture starts
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const md = (a, n) => ((a % n) + n) % n;
const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

// ---------------------------------------------------------------------------------------------------------------------
// Painters (all on pixel buffers)
// ---------------------------------------------------------------------------------------------------------------------
// n colours through the stops: '#hex' strings evenly spaced, or [position 0..1, '#hex'] pairs
function rampOf(stops, n) {
  const S = stops.map((s, i) => Array.isArray(s) ? [s[0], I(s[1])] : [i / (stops.length - 1), I(s)]), o = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    let j = 0;
    while (j < S.length - 2 && t > S[j + 1][0]) j++;
    o.push(mixI(S[j][1], S[j + 1][1], (t - S[j][0]) / Math.max(1e-6, S[j + 1][0] - S[j][0])));
  }
  return o;
}
// one tone of a ramp for v = 0..1, neighbouring tones dithered into each other
const pick = (rp, v, x, y, d = 1) => rp[clamp(Math.floor(v * (rp.length - 1) + (bay(x, y) - 0.5) * d + 0.5), 0, rp.length - 1)];
// value noise that repeats every `per` cells along x (so a tile's two ends meet)
function pvn(x, y, per, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = s * 57;
  const i0 = md(i, per), i1 = (i0 + 1) % per;
  return lerp(lerp(nz(i0 + o, j), nz(i1 + o, j), a), lerp(nz(i0 + o, j + 1), nz(i1 + o, j + 1), a), b);
}
function pfbm(x, y, per, s = 0, oct = 3) { let v = 0, a = 1, n = 0, f = 1; for (let o = 0; o < oct; o++) { v += a * pvn(x * f, y * f, per * f, s + o * 7); n += a; a *= 0.5; f *= 2; } return v / n; }
// call f at x, and again one tile to the left / right if something m wide there would cross the tile's edge
function wrapX(x, m, f, w = LW) { f(x); if (x < m) f(x + w); if (x > w - m) f(x - w); }

// a sky: a buffer the size of the screen and its margin, painted in the screen's coordinates
function sky(stops, steps = 26) {
  const b = buf(SW, SH, 10, 10), rp = rampOf(stops, steps), top = steps - 1;
  for (let y = 0; y < SH; y++) { const v = y / (SH - 1) * top; for (let x = 0; x < SW; x++) b.d[y * SW + x] = rp[clamp(Math.floor(v + (bay(x, y) - 0.5) + 0.5), 0, top)]; }
  return b;
}
// light round (cx, cy): what is painted there is pulled toward col, in `lv` dithered rings
function halo(b, cx, cy, r, col, str = 0.6, lv = 5, pow = 2) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
    if (d >= 1) continue;
    const c = get(b, x, y);
    if (c === NONE) continue;
    const q = Math.floor((1 - d) ** pow * str * lv + bay(x, y)) / lv;
    if (q > 0) put(b, x, y, mixI(c, col, Math.min(1, q)));
  }
}
// a heap cloud standing on the line y, about w wide and h high. rp: shade -> light
function cloud(b, cx, y, w, h, rp, seed) {
  const r = rng(seed), t = buf(w + 28, h + 16, 14 + (w >> 1), h + 12), n = Math.max(3, Math.round(w / 13));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, k = Math.sin(u * Math.PI), rad = Math.max(4, h * (0.26 + 0.3 * k) * (0.8 + r() * 0.45));
    oval(t, (u - 0.5) * w * 0.84 + (r() - 0.5) * 6, -rad * 0.7 - (h - rad * 1.7) * k * (0.35 + r() * 0.65), rad * 1.3, rad, K0);
  }
  rect(t, -Math.round(w * 0.4), -4, Math.round(w * 0.8), 4, K0);
  for (let yy = 0; yy < 6; yy++) for (let x = -(w >> 1) - 14; x < (w >> 1) + 14; x++) if (get(t, x, yy) !== NONE) put(t, x, yy, NONE);
  form(t, K0, rp, { depth: Math.max(5, h * 0.5), amb: 0.56, gain: 0.95, dither: 0.8 });
  stamp(b, t, cx, y);
}
// a long thin cloud lying along y (dawn, sunset): lit from below by `rp`'s light end
function streak(b, cx, y, w, h, rp, seed) {
  for (let yy = -h; yy <= h; yy++) for (let x = -w; x <= w; x++) {
    const u = x / w, v = yy / h, e = 1 - u * u - v * v + (fbm((x + seed * 31) * 0.07, (yy + seed) * 0.5, seed) - 0.5) * 0.9;
    if (e <= 0 || (e < 0.25 && bay(x + cx, yy + y) > e * 4)) continue;
    put(b, cx + x, y + yy, pick(rp, clamp(0.5 + v * 0.55 + (e - 0.5) * 0.25, 0, 1), x + cx, yy + y, 1));
  }
}
// The y of a mountain line for every x of a tile: peaks [[x, height, half width], ...] on the line `base`, roughened
function peaks(w, list, base, rough, seed, per = 12, pw = 1.25) {
  const t = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let h = 0;
    for (const p of list) for (const o of [0, -w, w]) { const d = Math.abs(x - p[0] - o) / p[2]; if (d < 1) h = Math.max(h, p[1] * (1 - d) ** pw); }
    t[x] = base - h - (pfbm(x / w * per, 0.5, per, seed, 4) - 0.5) * rough * (0.4 + Math.min(1, h / 20));
  }
  return t;
}
// rolling hills: the same, from noise alone
function hills(w, base, amp, seed, per = 6, oct = 3) {
  const t = new Float32Array(w);
  for (let x = 0; x < w; x++) t[x] = base - pfbm(x / w * per, 0.5, per, seed, oct) * amp;
  return t;
}
// Fill a tile below the line top[] with rock in facets: pal = [shadow, face, light, crest]. The light comes from the
// upper left: slopes that rise to the right are lit. o.haze = [colour, y0, y1]: the foot fades into the air
function rock(b, top, pal, o = {}) {
  const w = b.w, f = o.facet ?? 0.6, wrap = o.wrap !== false, sd = o.seed || 0, xa = o.x0 || 0, xb = o.x1 ?? w, hz = o.haze, yEnd = o.y1 ?? b.h, jit = o.jit ?? 14;
  const T = x => { x = Math.round(x); return wrap ? top[md(x, w)] : top[clamp(x, 0, w - 1)]; };
  for (let x = xa; x < xb; x++) {
    const ty = top[x];
    if (!(ty < yEnd)) continue;
    for (let y = Math.max(0, Math.ceil(ty)); y < yEnd; y++) {
      const dep = y - ty, sx = x - dep * f + (fbm(x * 0.05, y * 0.09, sd) - 0.5) * jit, sl = T(sx + 3) - T(sx - 3), n = fbm(x * 0.09, y * 0.16, sd + 5, 2);
      let c = sl < -0.4 ? (n > 0.62 && !o.flat ? pal[1] : pal[2]) : sl > 0.4 ? (n > 0.6 && !o.flat ? pal[1] : pal[0]) : pal[1];
      if (dep < 1.3 && sl < 0.4 && pal[3] != null) c = pal[3];
      if (hz) { const k = clamp((y - hz[1]) / (hz[2] - hz[1]), 0, 1); if (k > 0) c = mixI(c, hz[0], Math.min(1, Math.floor(k * 4 + bay(x, y)) / 4)); }
      b.d[y * w + x] = c;
    }
  }
}
// plain fill below a line (one colour, or f(x, y, depth))
function below(b, top, c, y1 = b.h) {
  const fn = typeof c === 'function';
  for (let x = 0; x < b.w; x++) for (let y = Math.max(0, Math.ceil(top[x])); y < y1; y++) { const v = fn ? c(x, y, y - top[x]) : c; if (v != null && v !== NONE) b.d[y * b.w + x] = v; }
}
// the foot of what is painted fades into the air: between y0 and y1 every painted pixel is pulled toward col
function mist(b, col, y0, y1, max = 1, lv = 5) {
  for (let y = Math.max(0, y0); y < b.h; y++) {
    const k = clamp((y - y0) / (y1 - y0), 0, 1) * max;
    for (let x = 0; x < b.w; x++) { const i = y * b.w + x; if (b.d[i] === NONE) continue; const q = Math.min(1, Math.floor(k * lv + bay(x, y)) / lv); if (q > 0) b.d[i] = mixI(b.d[i], col, q); }
  }
}
// Leaf clumps: little lit balls of leaves, radius r, n of them. A tree's crown, a jungle's roof are many of these
function clumps(r, rp, seed, n = 4) {
  const o = [], top = rp.length - 1;
  for (let i = 0; i < n; i++) {
    const b = buf(r * 2 + 4, r * 2 + 4, r + 2, r + 2), s = seed + i * 1.7, R0 = rng(Math.round(seed * 97) + i);
    shape(b, -r - 2, -r - 2, r + 2, r + 2, (x, y) => { const a = Math.atan2(y, x); return Math.hypot(x, y * 1.14) <= r * (0.9 + 0.12 * Math.sin(a * 3 + s) + 0.08 * Math.sin(a * 5 + s * 2.3)); }, K0);
    form(b, K0, rp, { depth: Math.max(2, r * 0.85), amb: 0.4, gain: 0.95, dither: 0.5 });
    for (let k = 0; k < r * 1.6; k++) {                               // leaves: light flecks toward the light, dark ones away from it
      const a = R0() * 6.283, d = R0() * r * 0.72, x = Math.round(Math.cos(a) * d), y = Math.round(Math.sin(a) * d * 0.88), c = get(b, x, y), j = rp.indexOf(c);
      if (j < 0) continue;
      const nj = clamp(j + ((-x * 0.62 - y * 0.78) > -r * 0.15 ? 1 : -1), 0, top);
      put(b, x, y, rp[nj]); if (get(b, x + 1, y) !== NONE) put(b, x + 1, y, rp[nj]);
    }
    o.push(b);
  }
  return o;
}
// A crown: clumps heaped in an oval, from its top down (each one covers the foot of those above). sets = clump sets
// from light to dark: the top of the crown takes the first, its underside the last
function crown(b, cx, cy, rx, ry, sets, seed, w = 0) {
  const R0 = rng(Math.round(seed * 131) + 7), r = (sets[0][0].w - 4) / 2, n = Math.max(3, Math.round(rx * ry * 3.4 / (r * r))), pts = [];
  for (let i = 0; i < n; i++) { const a = R0() * 6.283, d = Math.sqrt(R0()); pts.push([cx + Math.cos(a) * d * (rx - r * 0.5), cy + Math.sin(a) * d * (ry - r * 0.5)]); }
  pts.sort((p, q) => p[1] - q[1]);
  pts.forEach((p, i) => {
    const v = clamp((p[1] - (cy - ry)) / (ry * 2) + (p[0] - cx) / (rx * 5), 0, 0.999), set = sets[Math.floor(v * sets.length)], s = set[i % set.length];
    if (w) wrapX(Math.round(p[0]), r + 3, x => stamp(b, s, x, Math.round(p[1])), w); else stamp(b, s, Math.round(p[0]), Math.round(p[1]));
  });
}
// A jungle roof along the line top[]: rows of clumps, each row lower and darker. sets as for crown()
function roof(b, top, sets, seed, o = {}) {
  const R0 = rng(Math.round(seed * 53) + 3), w = b.w, r = (sets[0][0].w - 4) / 2, rows = o.rows || sets.length, gap = o.gap ?? r * 0.95;
  for (let k = rows - 1; k >= 0; k--) {
    const set = sets[Math.min(sets.length - 1, k)];
    for (let x = R0() * r; x < w; x += r * (0.75 + R0() * 0.7)) {
      const xi = Math.round(x), y = Math.round(top[md(xi, w)] + r * 0.55 + k * gap + (R0() - 0.5) * r * 0.7), s = set[Math.floor(R0() * set.length)];
      wrapX(xi, r + 3, xx => stamp(b, s, xx, y), w);
    }
  }
}
// A palm as far trees are seen: a bent trunk, a star of drooping fronds. c = [trunk, frond dark, frond light]
function palm(b, x, y, h, lean, c, seed, L = 14) {
  const R0 = rng(Math.round(seed * 71) + 5), tx = x + lean, ty = y - h, pts = bez([[x, y], [x + lean * 0.15, y - h * 0.6], [tx, ty]], 10);
  tube(b, pts, Math.max(1, L * 0.11), Math.max(0.7, L * 0.07), c[0]);
  const n = 7 + Math.floor(R0() * 3);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), a = -0.2 + u * 3.54 + (R0() - 0.5) * 0.25, len = L * (0.8 + R0() * 0.35), dx = Math.cos(a), up = Math.sin(a);
    const tip = [tx + dx * len, ty - up * len * 0.35 + len * 0.42], midp = [tx + dx * len * 0.5, ty - up * len * 0.55 - len * 0.22], fr = bez([[tx, ty], midp, tip], 9), col = i % 2 ? c[1] : c[2];
    for (let j = 1; j < fr.length; j++) {
      line(b, fr[j - 1][0], fr[j - 1][1], fr[j][0], fr[j][1], col);
      const q = Math.sin(j / fr.length * Math.PI) * L * 0.2 + 1;
      line(b, fr[j][0], fr[j][1], fr[j][0] - dx * 0.5, fr[j][1] + q, col);
    }
  }
  oval(b, tx, ty, 1.6, 1.4, c[1]);
}
// the same tile cut to the rows that hold something, as a canvas: { c, y (where its top row goes), w }
function bakeL(b) {
  let y0 = 0;
  outer: for (; y0 < b.h - 1; y0++) for (let x = 0; x < b.w; x++) if (b.d[y0 * b.w + x] !== NONE) break outer;
  const h = b.h - y0, c = canvasOf(b.w, h), g = c.getContext('2d'), im = g.createImageData(b.w, h), dd = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < b.w; x++) {
    const v = b.d[(y + y0) * b.w + x];
    if (v === NONE) continue;
    const j = (y * b.w + x) * 4;
    dd[j] = (v >> 16) & 255; dd[j + 1] = (v >> 8) & 255; dd[j + 2] = v & 255; dd[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return { c, x: -b.ox, y: y0 - b.oy, w: b.w, h };
}
const tile = () => buf(LW, LH);
L8.paint = { LW, LH, bay, md, ease, rampOf, pick, pvn, pfbm, wrapX, sky, halo, cloud, streak, peaks, hills, rock, below, mist, clumps, crown, roof, palm, bakeL, tile };

// one ball of smoke or cloud, lit (o: form's options, e.g. { lx: 0, ly: 1 } = lit from below)
function cloudPuff(b, x, y, r, rp, seed, o = {}) {
  const t = buf(Math.ceil(r) * 2 + 6, Math.ceil(r) * 2 + 6, Math.ceil(r) + 3, Math.ceil(r) + 3);
  shape(t, -r - 2, -r - 2, r + 2, r + 2, (px, py) => { const a = Math.atan2(py, px); return Math.hypot(px, py) <= r * (0.88 + 0.14 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 5 + seed * 1.7)); }, K0);
  form(t, K0, rp, Object.assign({ depth: Math.max(2, r * 0.9), amb: 0.5, gain: 0.9, dither: 0.7 }, o));
  stamp(b, t, Math.round(x), Math.round(y));
}
// Table mountains: stepped ground from noise. hgts = the levels (rising); most of the line lies flat on one of them
function terraces(w, base, hgts, seed, per = 8, steep = 9) {
  const t = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const n = pfbm(x / w * per, 0.5, per, seed, 2) * hgts.length * 0.999, i = Math.floor(n), k = clamp((n - i - 0.5) * steep + 0.5, 0, 1);
    t[x] = base - lerp(hgts[i], hgts[Math.min(hgts.length - 1, i + 1)], k * k * (3 - 2 * k)) - (pfbm(x / w * per * 6, 2.5, per * 6, seed + 9, 2) - 0.5) * 3;
  }
  return t;
}
// Fill below top[] with rock lying in level beds: pal = [shadow, bed line, bed, bed light, sunlit]. Cliffs that face
// left are lit, those that face right are in shadow; gullies run down the faces
function mesa(b, top, pal, o = {}) {
  const w = b.w, bedH = o.bed || 9, sd = o.seed || 0, hz = o.haze, wrap = o.wrap !== false, xa = o.x0 || 0, xb = o.x1 ?? w, L = new Uint8Array(w), RR = new Uint8Array(w);
  const full = (x, y) => (wrap ? top[md(x, w)] : top[clamp(x, 0, w - 1)]) <= y;
  let y0 = b.h;
  for (let x = xa; x < xb; x++) if (top[x] < y0) y0 = top[x];
  for (let y = Math.max(0, Math.ceil(y0)); y < b.h; y++) {
    let n = 0;                                                    // how much rock lies to the left / right of each pixel of this row
    for (let x = xa - 12; x < xb; x++) { n = full(x, y) ? Math.min(12, n + 1) : 0; if (x >= xa) L[x] = n; }
    n = 0;
    for (let x = xb + 11; x >= xa; x--) { n = full(x, y) ? Math.min(12, n + 1) : 0; if (x < xb) RR[x] = n; }
    for (let x = xa; x < xb; x++) {
      if (!L[x]) continue;
      const l = L[x] - 1, r = RR[x] - 1, ty = top[x], wob = (fbm(x * 0.03, y * 0.05, sd) - 0.5) * 7, bed = Math.floor((y + wob) / bedH), by = md(y + wob, bedH);
      let c = pal[1 + md(bed * 7 + (bed >> 1), 3)];
      if (by < 1) c = pal[1];
      if (y - ty < 2.2) c = pal[4]; else if (l < 3) c = pal[4]; else if (l < 6 && c !== pal[1]) c = pal[3];
      if (r < 5) c = pal[0]; else if (r < 10 && c === pal[3]) c = pal[2];
      if (y - ty > 3 && fbm(x * 0.33, y * 0.025, sd + 3) > 0.7) c = l < 4 ? pal[2] : pal[0];
      if (hz) { const k = clamp((y - hz[1]) / (hz[2] - hz[1]), 0, 1); if (k > 0) c = mixI(c, hz[0], Math.min(1, Math.floor(k * 8 + bay(x, y)) / 8)); }
      b.d[y * w + x] = c;
    }
  }
}
// A LONG-NECK seen far off, standing in the water at (x, y = the water line). s = size, c = [dark, body, light]
function longNeckFar(b, x, y, s, c, f = 1, neck = 0) {
  const hx = x + f * (17 + neck) * s, hy = y - 31 * s;
  oval(b, x, y - 5 * s, 14 * s, 7 * s, c[1]);
  tube(b, bez([[x + f * 9 * s, y - 8 * s], [x + f * 13 * s, y - 22 * s], [hx, hy]], 8), 3.2 * s, 1.5 * s, c[1]);
  oval(b, hx + f * 2 * s, hy, 3.4 * s, 2 * s, c[1]);
  tube(b, bez([[x - f * 11 * s, y - 6 * s], [x - f * 24 * s, y - 7 * s], [x - f * 33 * s, y - 1 * s]], 8), 3 * s, 0.8 * s, c[1]);
  for (let yy = Math.floor(y - 12 * s); yy <= y; yy++) for (let xx = Math.floor(x - 36 * s); xx <= x + 24 * s; xx++) {
    const v = get(b, xx, yy);
    if (v === c[1] && get(b, xx, yy - 1) !== c[1] && get(b, xx, yy - 1) !== c[2]) put(b, xx, yy, c[2]);        // the light along its back
    if (v === c[1] && yy > y - 3 * s) put(b, xx, yy, c[0]);
  }
  for (let i = 0; i < 5; i++) rect(b, Math.round(x - 20 * s + i * 9 * s), Math.round(y + 1 + (i % 2)), Math.round(6 * s), 1, c[0]);   // its reflection: a few dark strokes
}
L8.paint.cloudPuff = cloudPuff; L8.paint.terraces = terraces; L8.paint.mesa = mesa;

// ---------------------------------------------------------------------------------------------------------------------
// AREA 1: dawn over the jungle
// ---------------------------------------------------------------------------------------------------------------------
const TREE = P('#0b2a36', '#0f3c42', '#15534c', '#216e58', '#3c9060', '#7cba68', '#d8e88c');
const A1 = {
  sky: memo(() => {
    const b = sky([[0, '#2c2f6e'], [0.18, '#55478f'], [0.34, '#a45f98'], [0.47, '#e8876c'], [0.58, '#ffbe72'], [0.68, '#ffe6a4'], [1, '#fff6d0']]);
    halo(b, 118, 128, 130, I('#fff6c8'), 0.8, 7, 1.7);
    oval(b, 118, 128, 16, 16, I('#fff9dc')); oval(b, 118, 128, 13.5, 13.5, I('#ffffff'));
    const PK = rampOf(['#8a4f92', '#d56f86', '#ff9a78', '#ffd08a', '#fff0b8'], 6);
    streak(b, 300, 58, 96, 5, PK, 1); streak(b, 398, 84, 70, 4, PK, 2); streak(b, 44, 42, 60, 4, PK, 3); streak(b, 214, 98, 54, 3, PK, 4); streak(b, 452, 118, 44, 3, PK, 5);
    return bakeL(b);
  }),
  layers: [
    { k: 0.05, get: memo(() => {                          // violet mountains; the volcano, asleep, a thread of smoke
      const b = tile();
      rock(b, peaks(LW, [[30, 58, 130], [205, 40, 96], [560, 70, 150], [700, 46, 96], [860, 56, 120]], 192, 10, 11), P('#9a82b8', '#b497c4', '#d6b2cc', '#f0cdd4'), { haze: [I('#ffd9a4'), 160, 200], seed: 3 });
      const VT = new Float32Array(LW).fill(999);
      for (let x = 236; x < 500; x++) { const d = Math.abs(x - 368) / 128, y = 196 - 104 * (1 - d) ** 1.5 - (fbm(x * 0.2, 1.5, 9) - 0.5) * 3; VT[x] = Math.max(y, 100 + Math.abs(x - 368) * 0.12 + (Math.abs(x - 368) < 9 ? 3 : 0)); }
      rock(b, VT, P('#6c5c9c', '#8873ac', '#b08fbc', '#e2b4c4'), { haze: [I('#ffd9a4'), 162, 202], seed: 8, wrap: false, x0: 236, x1: 500, facet: 0.45 });
      const SM = rampOf(['#a888b8', '#d4a8c0', '#f6cdc0', '#fff0d8'], 5);
      for (let i = 0; i < 9; i++) { const u = i / 8; cloudPuff(b, 370 + u * u * 74 + Math.sin(i * 1.9) * 3, 96 - u * 50, 5 + u * 9, SM, 40 + i); }
      halo(b, 368, 101, 9, I('#ffb060'), 0.9, 3);
      return bakeL(b);
    }) },
    { k: 0.13, get: memo(() => {                          // misty jungle hills, a few giants standing over the roof
      const b = tile(), T = hills(LW, 184, 30, 21, 5), MIST = rampOf(['#4a7890', '#62939c', '#86b0a4', '#b4d0ac'], 5);
      const sets = [clumps(4, MIST.slice(1), 3.1), clumps(4, MIST.slice(0, 4), 4.2)], R0 = rng(77);
      below(b, T, MIST[0]);
      for (let i = 0; i < 9; i++) { const x = Math.round((i + R0() * 0.7) * LW / 9), y = T[md(x, LW)], hgt = 16 + R0() * 14, rx = 12 + R0() * 6; wrapX(x, 26, xx => { rect(b, xx - 1, y - hgt, 2, hgt + 4, MIST[0]); crown(b, xx, y - hgt - 3, rx, 6, sets, 200 + i); }); }
      roof(b, T, sets, 31, { rows: 2 });
      mist(b, I('#ffe6b0'), 172, 214, 0.96, 10);
      return bakeL(b);
    }) },
    { k: 0.3, get: memo(() => {                           // the tree line: dark crowns, palms over them; its foot is lost in the morning mist
      const b = tile(), T = hills(LW, 204, 22, 55, 7), R0 = rng(91);
      const big = [clumps(8, TREE.slice(1, 6), 1.3), clumps(8, TREE.slice(0, 5), 2.4), clumps(8, TREE.slice(0, 3), 3.5)], small = [clumps(5, TREE.slice(1, 6), 5.3), clumps(5, TREE.slice(0, 4), 6.4)];
      for (let i = 0; i < 9; i++) { const x = Math.round((i + R0() * 0.6) * LW / 9), y = T[md(x, LW)], hgt = 44 + R0() * 26, lean = (R0() - 0.5) * 18; wrapX(x, 34, xx => palm(b, xx, y + 8, hgt, lean, [TREE[0], TREE[1], TREE[2]], 300 + i, 19)); }
      below(b, T, (x, y, d) => d > 2 ? TREE[0] : NONE);
      for (let i = 0; i < 13; i++) { const x = Math.round((i + R0() * 0.8) * LW / 13), y = T[md(x, LW)]; crown(b, x, y - 4 - R0() * 16, 22 + R0() * 16, 12 + R0() * 7, i % 3 ? big : small, 400 + i, LW); }
      roof(b, T, [small[1]], 61, { rows: 1 });
      mist(b, I('#ffecb8'), 192, 226, 1, 12);
      return bakeL(b);
    }) }
  ],
  live(cx, a) { flock(a, 'rgba(70,40,90,', 66); }
};
// far flyers (real ones, not robots): two small flocks crossing the sky
function flock(a, col, y0) {
  ctx.fillStyle = col + (0.75 * a).toFixed(2) + ')';
  for (let i = 0; i < 5; i++) {
    const x = Math.round(md(G.t * 0.22 + i * 9 + (i > 2 ? 250 : 0), W + 60) - 30), y = Math.round(y0 + (i > 2 ? 26 : 0) + (i % 3) * 5 + Math.sin(G.t / 40 + i) * 2), f = Math.floor(G.t / 12 + i) % 2 ? 1 : -1;
    ctx.fillRect(x, y, 2, 1); ctx.fillRect(x - 2, y - f, 2, 1); ctx.fillRect(x + 2, y - f, 2, 1);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// AREA 2: a bright morning on the lagoon
// ---------------------------------------------------------------------------------------------------------------------
const WATER = rampOf(['#e2f8ee', '#a8e8e0', '#66cfdc', '#3fb0d4', '#2c92c6', '#2478b0'], 9);
const LN = M8.memo(() => [0, 1].map(k => {                          // the long-neck of the middle distance, its neck two ways
  const b = buf(190, 150, 80, 132), c = P('#8a5a62', '#c47e62', '#e8a878', '#ffd2a0'), K = K0;
  const hx = 62 + k * 5, hy = -104 + k * 7;
  tube(b, bez([[-34, -20], [-66, -24], [-78, -4]], 10), 7, 1.5, K);                               // tail
  oval(b, 0, -18, 40, 21, K);                                                                     // body
  tube(b, bez([[26, -26], [44, -62 + k * 4], [hx, hy]], 12), 10, 4.2, K);                          // neck
  oval(b, hx + 6, hy + 1, 9, 5.2, K);                                                             // head
  form(b, K, c, { depth: 13, amb: 0.5, gain: 0.85, dither: 0.6 });
  for (let x = -70; x < 78; x++) for (let y = -112; y < 2; y++) if (get(b, x, y) !== NONE && y > -6) put(b, x, y, NONE);   // it stands belly deep
  for (let i = 0; i < 7; i++) { const x = -16 + i * 6 + (i % 2) * 2, y = -34 + Math.abs(i - 3) * 2; if (get(b, x, y) !== NONE) { rect(b, x, y, 3, 2, c[0]); } }   // spots along its back
  put(b, hx + 8, hy, I('#2a1a26')); put(b, hx + 9, hy, I('#2a1a26')); put(b, hx + 8, hy - 1, I('#ffffff'));
  rect(b, hx + 9, hy + 3, 5, 1, c[0]);
  return M8.px.mk(b, false);
}));
const A2 = {
  sky: memo(() => {
    const b = sky([[0, '#2a7fd0'], [0.3, '#4fa8e6'], [0.52, '#9fdcf2'], [0.66, '#e2f6ea'], [1, '#f4fbe8']]);
    halo(b, 70, 20, 150, I('#ffffff'), 0.55, 6, 1.5);
    const CL = rampOf(['#8fb8de', '#c4def2', '#eef6fc', '#ffffff'], 5);
    cloud(b, 330, 92, 120, 46, CL, 11); cloud(b, 96, 120, 84, 30, CL, 12); cloud(b, 452, 138, 70, 22, CL, 13); cloud(b, 214, 150, 56, 16, CL, 14); cloud(b, 20, 66, 60, 20, CL, 15);
    return bakeL(b);
  }),
  layers: [
    { k: 0.05, get: memo(() => {                          // pale mountains, a table mountain with a waterfall
      const b = tile();
      rock(b, peaks(LW, [[90, 50, 150], [600, 62, 170], [820, 40, 110]], 186, 9, 31), P('#8fb6d6', '#a8cbe2', '#c8e2ee', '#e6f4f6'), { haze: [I('#e8f8f0'), 150, 190], seed: 13 });
      const TT = new Float32Array(LW).fill(999);
      for (let x = 250; x < 470; x++) { const e = Math.min(x - 250, 470 - x); TT[x] = 188 - Math.min(74, e * 2.6) - (fbm(x * 0.16, 4.5, 3) - 0.5) * 4; }
      mesa(b, TT, P('#6f9cc0', '#7eaacb', '#93bcd6', '#b0d2e2', '#d8eef2'), { wrap: false, x0: 250, x1: 470, bed: 11, seed: 6, haze: [I('#e8f8f0'), 156, 192] });
      for (let y = 116; y < 190; y++) { const wv = 4 + (y - 116) * 0.05; for (let x = -wv; x <= wv; x++) put(b, 352 + x + Math.sin(y * 0.4) * 0.6, y, (Math.abs(x) > wv - 1.5 || nz(x + 40, y) > 0.72) ? I('#d4eef6') : I('#ffffff')); }
      for (let i = 0; i < 6; i++) cloudPuff(b, 340 + i * 5, 190 - (i % 2) * 3, 5 + (i % 3), rampOf(['#c8e6f0', '#eaf8fa', '#ffffff'], 4), 60 + i);
      return bakeL(b);
    }) },
    { k: 0.12, get: memo(() => {                          // the far shore, the lagoon itself, long-necks wading far out
      const b = tile(), SH0 = rampOf(['#4d8fa8', '#6aa9b4', '#90c6bc', '#bfe0c4'], 5), T = hills(LW, 181, 9, 43, 6, 2);
      below(b, T, SH0[0], 186);
      roof(b, T, [clumps(4, SH0.slice(1), 7.1), clumps(4, SH0.slice(0, 4), 8.2)], 47, { rows: 2 });
      const R0 = rng(5);
      for (let i = 0; i < 7; i++) { const x = Math.round((i + R0() * 0.8) * LW / 7), y = T[md(x, LW)], hgt = 12 + R0() * 9, lean = (R0() - 0.5) * 8; wrapX(x, 16, xx => palm(b, xx, y + 3, hgt, lean, [SH0[0], SH0[0], SH0[1]], 500 + i, 8)); }
      for (let y = 184; y < LH; y++) for (let x = 0; x < LW; x++) {
        const v = clamp((y - 184) / 54, 0, 1), c = pick(WATER, v * 0.9 + (pfbm(x / LW * 40, y * 0.5, 40, 3, 2) - 0.5) * 0.16, x, y, 1);
        b.d[y * LW + x] = c;
      }
      rect(b, 0, 184, LW, 1, I('#f4fff8'));
      for (let i = 0; i < 260; i++) { const y = 186 + Math.floor(R0() * R0() * 60), x = Math.floor(R0() * LW), n = 2 + Math.floor(R0() * (2 + (y - 186) * 0.16)); for (let j = 0; j < n; j++) put(b, md(x + j, LW), y, i % 4 ? WATER[0] : I('#ffffff')); }
      longNeckFar(b, 250, 190, 0.8, P('#4d8fa8', '#77adc0', '#a4d0d4')); longNeckFar(b, 300, 189, 0.55, P('#4d8fa8', '#7fb4c4', '#a9d4d6'), -1); longNeckFar(b, 700, 191, 0.9, P('#4d8fa8', '#77adc0', '#a4d0d4'), -1, 2);
      return bakeL(b);
    }) },
    { k: 0.3, long: true, draw(g, x0) {                   // one long-neck nearer by, chewing
      const s = LN()[Math.floor(G.t / 70) % 4 === 3 ? 1 : 0];
      for (const x of [x0 + 560, x0 + 560 + LW, x0 + 560 - LW]) if (x > -120 && x < W + 120) {
        g.drawImage(s.img, x - s.ox, 206 - s.oy);
        g.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 0; i < 6; i++) g.fillRect(x - 44 + i * 14 + Math.round(Math.sin(G.t / 20 + i) * 2), 200 + (i % 2), 7, 1);    // the water round it
      }
    } },
    { k: 0.3, get: memo(() => {                           // sand spits with palms and reeds, lying in the water
      const b = tile(), R0 = rng(23), SAND = P('#b89868', '#dcc088', '#f4e2ac', '#fff6d4'), PG = P('#5a3c2c', '#1d6a52', '#3ea060', '#8fd070');
      for (let i = 0; i < 6; i++) {
        const cx0 = Math.round((i + 0.2 + R0() * 0.5) * LW / 6), hw = 44 + R0() * 40, y0 = 208 + (i % 2) * 6, n = 1 + Math.floor(R0() * 2.6), ps = [];
        if (i === 3) continue;                                                           // the gap the long-neck stands in
        for (let j = 0; j < n; j++) ps.push([(R0() - 0.5) * hw * 1.1, 34 + R0() * 30, (R0() - 0.5) * 26]);
        wrapX(cx0, hw + 40, xc => {
          for (const q of ps) palm(b, xc + q[0], y0 + 1, q[1], q[2], [PG[0], PG[1], PG[2]], 600 + i * 7 + q[1], 20);
          shape(b, xc - hw, y0 - 7, xc + hw, y0 + 3, (x, y) => ((x - xc) / hw) ** 2 + ((y - y0 - 3) / 9) ** 2 <= 1 && y < y0 + 3, (x, y) => y < y0 - 3.5 + Math.abs(x - xc) / hw * 4 ? SAND[3] : y < y0 ? SAND[2] : SAND[1]);
          rect(b, xc - hw + 3, y0 + 3, hw * 2 - 6, 1, I('#ffffff'));
          for (let j = 0; j < 9; j++) { const rx = xc + (hsh(i * 9 + j) - 0.5) * hw * 1.7, rh = 5 + hsh(i * 5 + j * 3) * 8; line(b, rx, y0 + 2, rx + (hsh(j) - 0.5) * 3, y0 + 2 - rh, PG[j % 2 ? 1 : 2]); if (j % 3 === 0) rect(b, Math.round(rx) - 1, Math.round(y0 - rh), 2, 3, PG[0]); }
        });
      }
      return bakeL(b);
    }) }
  ],
  live(cx, a) {
    flock(a, 'rgba(40,70,110,', 52);
    // sun on the water
    ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * a).toFixed(2) + ')';
    for (let i = 0; i < 26; i++) { const ph = (G.t + i * 37) % 120; if (ph > 22) continue; const x = Math.round(md(hsh(i * 3.3) * 700 - cx * 0.12, W + 20)) - 10, y = 188 + Math.floor(hsh(i * 7.7) * hsh(i) * 40); ctx.fillRect(x, y, ph < 6 || ph > 16 ? 1 : 3, 1); if (ph > 8 && ph < 14) ctx.fillRect(x + 1, y - 1, 1, 3); }
  }
};

// ---------------------------------------------------------------------------------------------------------------------
// AREA 3: red rock in the afternoon sun
// ---------------------------------------------------------------------------------------------------------------------
const A3 = {
  sky: memo(() => {
    const b = sky([[0, '#2f6cc4'], [0.26, '#5a9ad8'], [0.46, '#a6d0e4'], [0.6, '#f4e0b0'], [0.72, '#ffc888'], [1, '#ffb878']]);
    halo(b, 410, 44, 140, I('#fff4c0'), 0.7, 7, 1.6);
    oval(b, 410, 44, 17, 17, I('#fff7d0')); oval(b, 410, 44, 14, 14, I('#ffffff'));
    const WS = rampOf(['#c8dcec', '#f2f6f4', '#ffffff', '#fff0d0'], 5);
    streak(b, 120, 52, 110, 4, WS, 21); streak(b, 250, 86, 80, 3, WS, 22); streak(b, 40, 104, 50, 3, WS, 23); streak(b, 330, 118, 64, 3, WS, 24);
    return bakeL(b);
  }),
  layers: [
    { k: 0.05, get: memo(() => {                          // table mountains far off, pale in the haze
      const b = tile();
      mesa(b, terraces(LW, 190, [4, 10, 46, 52, 78], 61, 7, 12), P('#b88aa0', '#c798a6', '#d9a8ac', '#eabcb4', '#fcd8c4'), { bed: 8, seed: 2, haze: [I('#ffd8a8'), 150, 196] });
      return bakeL(b);
    }) },
    { k: 0.13, get: memo(() => {                          // buttes and mesas in bands of red and orange
      const b = tile(), T = terraces(LW, 204, [0, 6, 34, 40, 84, 90], 67, 9, 14);
      mesa(b, T, P('#8a3a2c', '#b4502e', '#d06c38', '#ea9050', '#ffc888'), { bed: 9, seed: 5, haze: [I('#ffd49c'), 176, 222] });
      return bakeL(b);
    }) },
    { k: 0.3, get: memo(() => {                           // the canyon's near wall: dark red towers, dust at their feet
      const b = tile(), T = terraces(LW, 216, [0, 0, 12, 60, 66, 112], 83, 6, 16);
      mesa(b, T, P('#4a1c1e', '#6c2a22', '#8e3c26', '#b4562e', '#e08a4a'), { bed: 10, seed: 9, haze: [I('#f8c890'), 186, 232] });
      return bakeL(b);
    }) }
  ],
  live(cx, a) { flock(a, 'rgba(60,30,40,', 74); }
};

// ---------------------------------------------------------------------------------------------------------------------
// AREA 4: dusk, the volcano awake
// ---------------------------------------------------------------------------------------------------------------------
const A4 = {
  sky: memo(() => {
    const b = sky([[0, '#120f2a'], [0.26, '#2a1846'], [0.44, '#5a2250'], [0.58, '#a0323e'], [0.7, '#e2622e'], [0.82, '#ffa53a'], [1, '#ffc860']]);
    const AS = rampOf(['#1c1230', '#3a1c42', '#6e2a48', '#c04c34', '#ff8c3a'], 6);
    streak(b, 90, 70, 100, 6, AS, 31); streak(b, 400, 56, 90, 5, AS, 32); streak(b, 200, 128, 70, 4, AS, 33); streak(b, 460, 140, 60, 4, AS, 34); streak(b, 20, 150, 50, 3, AS, 35);
    return bakeL(b);
  }),
  layers: [
    { k: 0.04, get: memo(() => {                          // the volcano: fire in its crater, lava down its sides, ash over everything
      const b = tile(), VX = 330, VT = new Float32Array(LW).fill(999), PL = rampOf(['#140c22', '#2a1638', '#4a1e44', '#8a2c40', '#e0562c'], 6);
      for (let i = 0; i < 22; i++) { const u = i / 21, a = u * 2.6; cloudPuff(b, VX + 4 + Math.sin(a) * 16 * u + u * u * 150, 62 - u * 74 + Math.sin(i * 2.3) * 5, 10 + u * 30, PL, 70 + i, { lx: -0.2, ly: 0.95, amb: 0.34 }); }
      for (let x = 60; x < 620; x++) { const d = Math.abs(x - VX) / 270, y = 214 - 168 * (1 - d) ** 1.7 - (fbm(x * 0.12, 1.5, 19) - 0.5) * 5; VT[x] = Math.max(y, 62 + (Math.abs(x - VX) < 13 ? 4 - Math.abs(x - VX) * 0.1 : Math.abs(x - VX) * 0.1)); }
      rock(b, VT, P('#1e1430', '#2e1a3e', '#472450', '#7a3050'), { wrap: false, x0: 60, x1: 620, seed: 17, facet: 0.4, haze: [I('#7a2a3a'), 170, 232] });
      const R0 = rng(41), LAVA = P('#b02818', '#ff6a1e', '#ffb43a', '#fff0a0');
      for (let s = 0; s < 5; s++) {                                              // lava: bright threads running down from the rim
        let x = VX + (s - 2) * 5 + (R0() - 0.5) * 3, dir = (s - 2) * 0.34 + (R0() - 0.5) * 0.2, wdt = 2.6;
        for (let y = 64; y < 206 - s * 9; y++) {
          x += dir + (fbm(y * 0.09, s * 3.1, 23) - 0.5) * 1.6; dir *= 1.004; wdt = Math.max(1, wdt - 0.008);
          for (let k = -Math.ceil(wdt) - 1; k <= Math.ceil(wdt) + 1; k++) { const a = Math.abs(k); if (a <= wdt + 1 && get(b, x + k, y) !== NONE) put(b, x + k, y, a > wdt ? LAVA[0] : a > wdt * 0.5 ? LAVA[1] : y < 110 ? LAVA[3] : LAVA[2]); }
          if (y > 90 && R0() < 0.012) dir += (R0() - 0.5) * 0.5;
        }
      }
      halo(b, VX, 64, 46, I('#ffb040'), 0.95, 6, 1.4);
      rect(b, VX - 12, 63, 25, 3, LAVA[3]); rect(b, VX - 9, 61, 19, 2, LAVA[2]);
      return bakeL(b);
    }) },
    { k: 0.12, get: memo(() => {                          // a broken ridge, the glow behind it
      const b = tile(), T = peaks(LW, [[80, 40, 60], [230, 62, 90], [420, 30, 70], [610, 70, 80], [790, 46, 70], [900, 30, 50]], 214, 22, 71, 20, 1.1);
      rock(b, T, P('#180f24', '#22142e', '#32183a', '#e0562c'), { seed: 27, facet: 0.5, haze: [I('#6a2434'), 190, 236] });
      return bakeL(b);
    }) },
    { k: 0.3, get: memo(() => {                           // black rocks and burnt trees
      const b = tile(), T = peaks(LW, [[40, 30, 40], [150, 54, 46], [300, 22, 60], [470, 60, 40], [520, 34, 50], [700, 48, 54], [860, 26, 44]], 222, 16, 91, 26, 0.9), R0 = rng(61), DK = P('#0e0a18', '#150e20', '#20142a', '#a8402c');
      for (let i = 0; i < 9; i++) {                                              // dead trees
        const x = Math.round((i + R0() * 0.7) * LW / 9), y = T[md(x, LW)] + 4, hgt = 34 + R0() * 26, br = [];
        for (let j = 0; j < 4; j++) br.push([0.35 + R0() * 0.5, (j % 2 ? 1 : -1) * (8 + R0() * 12), 8 + R0() * 10]);
        wrapX(x, 30, xx => { tube(b, [[xx, y], [xx + 1, y - hgt * 0.6], [xx - 1, y - hgt]], 2.6, 0.8, DK[1]); for (const q of br) { const by = y - hgt * q[0]; line(b, xx, by, xx + q[1], by - q[2], DK[1], 2); line(b, xx + q[1], by - q[2], xx + q[1] * 1.5, by - q[2] - 5, DK[1]); } });
      }
      rock(b, T, DK, { seed: 37, facet: 0.5, haze: [I('#74283a'), 204, 238] });
      return bakeL(b);
    }) }
  ],
  live(cx, a) {
    // the crater breathes; sparks drift up
    const vx = 330 - Math.floor((cx - X0[3] + 240) * 0.04), pul = 0.5 + 0.5 * Math.sin(G.t / 23);
    M8.glow(vx, 60, 50 + pul * 14, '#ff7a20', (0.34 + pul * 0.2) * a);
    for (let i = 0; i < 14; i++) { const ph = (G.t * 0.6 + i * 53) % 150, x = vx + (hsh(i * 3.1) - 0.5) * 40 + Math.sin(ph / 13 + i) * 9 + ph * 0.25, y = 60 - ph * 0.5; ctx.fillStyle = 'rgba(255,' + (150 + Math.round(hsh(i) * 90)) + ',60,' + (clamp(1 - ph / 150, 0, 1) * a).toFixed(2) + ')'; ctx.fillRect(Math.round(x), Math.round(y), 1 + (i % 3 === 0 ? 1 : 0), 1); }
    for (let i = 0; i < 18; i++) { const x = md(hsh(i * 9.7) * 620 + G.t * (0.25 + hsh(i) * 0.3), W + 20) - 10, y = 250 - md(G.t * (0.3 + hsh(i * 2.3) * 0.4) + hsh(i * 4.1) * 260, 260); ctx.fillStyle = 'rgba(255,' + (120 + (i % 3) * 50) + ',40,' + (0.7 * a).toFixed(2) + ')'; ctx.fillRect(Math.round(x + Math.sin(G.t / 17 + i) * 4), Math.round(y), 1, 1); }
  }
};

// ---------------------------------------------------------------------------------------------------------------------
// AREA 5: the hatchery (indoors)
// ---------------------------------------------------------------------------------------------------------------------
const WALLC = P('#141a30', '#1c2440', '#283252', '#364468', '#4c5c84', '#6c7ea8');
const TUBES = [];                                                   // where the back wall's tubes stand in its tile
const A5 = {
  sky: memo(() => { const b = buf(SW, SH, 10, 10); b.d.fill(WALLC[1]); return bakeL(b); }),
  layers: [
    { k: 0.5, get: memo(() => {                           // the back wall: plates, pipes, a row of incubator tubes
      const b = buf(LW, H + 20, 0, 10), GL = P('#0a2a1c', '#145a30', '#2c9a44', '#62d64f', '#b6ff9a');
      for (let y = -10; y < H + 10; y++) for (let x = 0; x < LW; x++) {
        const px = md(x, 96), py = md(y + 10, 64), seam = px === 0 || py === 0, hi = px === 1 || py === 1;
        let c = seam ? WALLC[0] : hi ? WALLC[3] : WALLC[2];
        if (!seam && !hi) { const n = pfbm(x / LW * 30, y * 0.02, 30, 7, 2); c = n > 0.7 ? WALLC[3] : n < 0.3 && bay(x, y) < 0.5 ? WALLC[1] : WALLC[2]; }
        if ((px === 6 || px === 90) && (py === 6 || py === 58)) c = WALLC[5];
        if ((px === 6 || px === 90) && (py === 7 || py === 59)) c = WALLC[0];
        put(b, x, y, c);
      }
      // pipes under the ceiling, a dark dado with a hazard line where the floor's things stand against the wall
      for (const [y, hh, k] of [[14, 7, 3], [24, 4, 2], [44, 5, 2]]) { for (let x = 0; x < LW; x++) for (let j = 0; j < hh; j++) put(b, x, y + j, j === 0 ? WALLC[5] : j === hh - 1 ? WALLC[0] : j < hh / 2 ? WALLC[k + 1] : WALLC[k]); for (let x = 30; x < LW; x += 120) { rect(b, x, y - 1, 5, hh + 2, WALLC[1]); rect(b, x + 1, y - 1, 1, hh + 2, WALLC[4]); } }
      rect(b, 0, 172, LW, 90, WALLC[0]); rect(b, 0, 172, LW, 1, WALLC[4]); rect(b, 0, 173, LW, 1, WALLC[1]);
      for (let x = 0; x < LW; x++) for (let j = 0; j < 4; j++) put(b, x, 176 + j, ((x + j) >> 2) % 2 ? I('#c89a1c') : I('#16141e'));
      for (let x = 12; x < LW; x += 48) { rect(b, x, 186, 22, 30, WALLC[1]); rect(b, x, 186, 22, 1, WALLC[3]); for (let j = 0; j < 4; j++) rect(b, x + 3, 191 + j * 6, 16, 2, WALLC[0]); }
      // the tubes: glass, green light, something curled up inside
      for (let x = 60; x < LW; x += 120) {
        TUBES.push(x);
        rect(b, x - 19, 56, 38, 10, WALLC[0]); rect(b, x - 18, 57, 36, 3, WALLC[4]); rect(b, x - 18, 60, 36, 5, WALLC[2]);
        rect(b, x - 21, 160, 42, 14, WALLC[0]); rect(b, x - 20, 161, 40, 3, WALLC[4]); rect(b, x - 20, 164, 40, 9, WALLC[2]);
        for (let i = 0; i < 3; i++) rect(b, x - 14 + i * 12, 167, 4, 3, i === (x / 120 | 0) % 3 ? I('#ff3b30') : I('#62d64f'));
        for (let y = 66; y < 160; y++) for (let k = -15; k <= 15; k++) {
          const e = Math.abs(k) / 15, v = (1 - e * e) * 0.75 + (fbm(k * 0.2, y * 0.07, x) - 0.5) * 0.3 - (y - 66) / 94 * 0.25;
          put(b, x + k, y, Math.abs(k) === 15 ? WALLC[5] : pick(GL, clamp(v, 0, 1), x + k, y, 1));
        }
        rect(b, x - 11, 68, 2, 88, GL[4]); rect(b, x + 9, 72, 1, 60, GL[3]);
        // the sleeper: a robot curled like a chick in its egg, one eye
        const yy = 118 + ((x / 120 | 0) % 2) * 6, D = GL[0];
        oval(b, x, yy, 7, 9, D); oval(b, x + 3, yy - 10, 5, 4, D); tube(b, bez([[x - 4, yy + 6], [x - 10, yy + 12], [x - 3, yy + 16]], 6), 2, 0.7, D);
        rect(b, x + 5, yy - 10, 5, 2, D); rect(b, x - 2, yy + 7, 2, 6, D); rect(b, x + 2, yy + 7, 2, 5, D);
        put(b, x + 4, yy - 11, GL[4]); put(b, x + 5, yy - 11, GL[4]);
        for (let y = 162; y < 172; y++) put(b, x - 22, y, WALLC[0]);
      }
      // the Oggles' sign between the tubes: one eye in a ring
      for (let x = 120; x < LW; x += 240) { oval(b, x, 102, 13, 13, WALLC[0]); oval(b, x, 102, 11, 11, I('#1c7a34')); oval(b, x, 102, 7.5, 7.5, I('#f6fbff')); oval(b, x + 1, 102, 3.6, 3.6, I('#e0302a')); oval(b, x + 1, 102, 1.6, 1.6, I('#1a0a12')); put(b, x - 3, 98, I('#ffffff')); rect(b, x - 9, 120, 18, 3, WALLC[0]); rect(b, x - 9, 120, 18, 1, WALLC[4]); }
      return bakeL(b);
    }) }
  ],
  live(cx) {
    // bubbles rise in the tubes; their light swells and fades
    const sh = Math.floor((cx - X0[4] + 240) * 0.5);
    for (let x = 60; x < LW; x += 120) for (const o of [0, LW, -LW]) {
      const sx = x + o - md(sh, LW);
      if (sx < -30 || sx > W + 30) continue;
      for (let i = 0; i < 4; i++) { const ph = md(G.t * (0.5 + hsh(x + i) * 0.4) + hsh(x * 3 + i) * 90, 90); ctx.fillStyle = i % 2 ? '#e6ffd8' : '#b6ff9a'; ctx.fillRect(sx - 10 + Math.round(hsh(x + i * 7) * 20 + Math.sin(ph / 6 + i) * 1.5), 156 - Math.round(ph), 1 + (i === 0 ? 1 : 0), 1 + (i === 0 ? 1 : 0)); }
      M8.glow(sx, 112, 44, '#62d64f', 0.16 + 0.07 * Math.sin(G.t / 31 + x));
    }
  }
};

// ---------------------------------------------------------------------------------------------------------------------
// AREA 6: night on the launch pad; morning when the Master Switch is thrown
// ---------------------------------------------------------------------------------------------------------------------
const STARS = [];
const A6 = {
  sky: memo(() => {
    const b = sky([[0, '#050818'], [0.3, '#0b1336'], [0.52, '#152258'], [0.7, '#22387c'], [1, '#35549a']]), R0 = rng(606);
    for (let i = 0; i < 150; i++) { const x = Math.floor(R0() * SW) - 10, y = Math.floor(R0() * R0() * 200) - 10, k = R0(); put(b, x, y, k > 0.86 ? I('#ffffff') : k > 0.5 ? I('#b8c8f0') : I('#6a7ab8')); if (k > 0.93) { STARS.push([x, y]); put(b, x - 1, y, I('#8a9ad0')); put(b, x + 1, y, I('#8a9ad0')); put(b, x, y - 1, I('#8a9ad0')); put(b, x, y + 1, I('#8a9ad0')); } }
    halo(b, 92, 62, 74, I('#b8c8ff'), 0.5, 6, 1.6);
    oval(b, 92, 62, 23, 23, I('#e9eeff'));
    shape(b, 68, 38, 116, 86, (x, y) => Math.hypot(x - 92, y - 62) <= 23 && Math.hypot(x - 100, y - 68) > 21, I('#ffffff'));
    for (const [x, y, r] of [[84, 54, 4], [99, 66, 5.5], [88, 72, 3], [103, 52, 2.5], [79, 66, 2]]) { oval(b, x, y, r, r * 0.9, I('#c9d2f0')); oval(b, x + 0.6, y + 0.6, r * 0.7, r * 0.6, I('#dbe2fa')); }
    const NC = rampOf(['#0e1840', '#1a2a62', '#2e448a', '#5a74b8'], 5);
    streak(b, 300, 96, 110, 4, NC, 51); streak(b, 430, 60, 60, 3, NC, 52); streak(b, 190, 132, 70, 3, NC, 53);
    return bakeL(b);
  }),
  dawn: memo(() => {
    const b = sky([[0, '#3d74cc'], [0.3, '#79b0e6'], [0.5, '#c4e2f0'], [0.62, '#ffe2a8'], [0.74, '#ffc47c'], [1, '#ffdca0']]);
    halo(b, 380, 150, 150, I('#fff6c8'), 0.85, 7, 1.6);
    oval(b, 380, 150, 18, 18, I('#fff9dc')); oval(b, 380, 150, 15, 15, I('#ffffff'));
    const PK = rampOf(['#c88ab0', '#f0a898', '#ffd0a0', '#fff0c8', '#ffffff'], 6);
    streak(b, 150, 60, 110, 5, PK, 61); streak(b, 300, 96, 70, 4, PK, 62); streak(b, 440, 70, 60, 4, PK, 63); streak(b, 60, 118, 60, 3, PK, 64);
    return bakeL(b);
  }),
  layers: [
    { k: 0.04, get: memo(() => mounts6(P('#0d1634', '#131f48', '#20306a', '#4a62a8'), I('#22387c'))), dawn: memo(() => mounts6(P('#7d6fa8', '#9a86b8', '#c4a4c4', '#f0cdd0'), I('#ffd8a4'))) },
    { k: 0.13, get: memo(() => woods6(P('#070d22', '#0b1430', '#111e44'), I('#1c2e68'))), dawn: memo(() => woods6(P('#2c5a66', '#3f7a74', '#6aa482'), I('#ffe2ac'))) }
  ],
  live(cx, a) {
    const k = L8.dawnK ? L8.dawnK() : 0;
    if (k >= 1) { flock(a, 'rgba(70,40,90,', 66); return; }
    for (let i = 0; i < STARS.length; i++) if ((G.t + i * 29) % 90 < 9) { ctx.fillStyle = 'rgba(255,255,255,' + ((1 - k) * a).toFixed(2) + ')'; ctx.fillRect(STARS[i][0] - 2, STARS[i][1], 5, 1); ctx.fillRect(STARS[i][0], STARS[i][1] - 2, 1, 5); }
  }
};
function mounts6(pal, hz) {
  const b = tile();
  rock(b, peaks(LW, [[60, 70, 150], [300, 96, 190], [540, 60, 130], [760, 84, 170]], 206, 12, 111), pal, { seed: 43, haze: [hz, 168, 222], flat: true, jit: 30 });
  return bakeL(b);
}
function woods6(pal, hz) {
  const b = tile(), T = hills(LW, 206, 16, 121, 8), R0 = rng(131);
  for (let i = 0; i < 12; i++) { const x = Math.round((i + R0() * 0.6) * LW / 12), y = T[md(x, LW)], hgt = 22 + R0() * 18, lean = (R0() - 0.5) * 12; wrapX(x, 24, xx => palm(b, xx, y + 4, hgt, lean, [pal[0], pal[0], pal[1]], 700 + i, 12)); }
  below(b, T, pal[0]);
  roof(b, T, [clumps(5, [pal[0], pal[1], pal[2]], 9.1), clumps(5, [pal[0], pal[0], pal[1]], 9.9)], 71, { rows: 2 });
  mist(b, hz, 204, 236, 0.9, 10);
  return bakeL(b);
}

// ---------------------------------------------------------------------------------------------------------------------
// The six backdrops, and how they meet
// ---------------------------------------------------------------------------------------------------------------------
const AREAS = [A1, A2, A3, A4, A5, A6];
L8.AREAS = AREAS; L8.EXIT_X = EXIT;
AREAS.forEach((A, i) => { if (A.cam0 == null) A.cam0 = X0[i] - 240; });

function drawArea(g, i, cx, alt) {
  const A = AREAS[i], s = (alt ? A.dawn : A.sky)();
  g.drawImage(s.c, -10, -10);
  for (const L of A.layers) {
    const sh = Math.floor((cx - X0[i] + 240) * L.k);
    if (L.draw) { L.draw(g, -md(sh, LW)); continue; }
    const t = (alt ? L.dawn : L.get)(), x0 = -md(sh, t.w);
    for (let x = x0 - t.w; x < W + 10; x += t.w) if (x + t.w > -10) g.drawImage(t.c, x, t.y);
  }
}
let SCR = null, SG = null;
function scratch() {
  if (!SCR) { SCR = canvasOf(SW, SH); SG = SCR.getContext('2d'); SG.imageSmoothingEnabled = false; }
  SG.setTransform(1, 0, 0, 1, 10, 10); SG.globalAlpha = 1; SG.globalCompositeOperation = 'source-over';
  return SG;
}
// the open air (areas 1 to 4): one backdrop, or two fading into each other
const FADE = [1450, 2900, 4300];
function outdoors(cx) {
  const c = cx + W / 2;
  let i = 0;
  while (i < 3 && c >= FADE[i] + 150) i++;
  const k = i < 3 ? ease((c - FADE[i] + 150) / 300) : 0;
  drawArea(ctx, i, cx);
  if (k > 0) { drawArea(scratch(), i + 1, cx); const ga = ctx.globalAlpha; ctx.globalAlpha = ga * k; ctx.drawImage(SCR, -10, -10); ctx.globalAlpha = ga; }
  if (AREAS[i].live && k < 1) AREAS[i].live(cx, 1 - k);
  if (k > 0 && AREAS[i + 1].live) AREAS[i + 1].live(cx, k);
}
function clipX(x0, x1, f) {
  ctx.save(); ctx.beginPath(); ctx.rect(x0, -10, x1 - x0, SH); ctx.clip();
  f();
  ctx.restore();
}
L8.drawBG = function (cx) {
  M8.ringsBegin();                                       // a new frame: no landing ring is left over from the last one
  const xa = X0[4] - cx, xb = X0[5] - cx;                // where the hatchery's two walls cut the picture
  if (xa >= W + 10) { outdoors(cx); return; }
  if (xa > -10) clipX(-10, xa, () => outdoors(cx));
  if (xb > -10) clipX(Math.max(-10, xa), Math.min(W + 10, xb), () => { drawArea(ctx, 4, cx); if (AREAS[4].live) AREAS[4].live(cx, 1); });
  if (xb < W + 10) clipX(Math.max(-10, xb), W + 10, () => {
    const k = L8.dawnK ? L8.dawnK() : 0;
    if (k < 1) drawArea(ctx, 5, cx);
    if (k > 0) { drawArea(k < 1 ? scratch() : ctx, 5, cx, true); if (k < 1) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * k; ctx.drawImage(SCR, -10, -10); ctx.globalAlpha = ga; } }
    AREAS[5].live(cx, 1);
  });
};

// ---------------------------------------------------------------------------------------------------------------------
// Baking ahead: every picture is painted when first needed; the mission and its menus paint them ahead, a few
// milliseconds a frame, in the order the hero will meet them
// ---------------------------------------------------------------------------------------------------------------------
L8.bakeSome = function (ms = 3) {
  const t0 = performance.now();
  let left;
  do left = M8.pump(); while (left > 0 && performance.now() - t0 < ms);
  return left;
};
L8.warmBackdrop = i => { const A = AREAS[i]; M8.warm(A.sky); if (i === 1) M8.warm(LN); for (const L of A.layers) if (L.get) M8.warm(L.get); if (A.dawn) { M8.warm(A.dawn); for (const L of A.layers) if (L.dawn) M8.warm(L.dawn); } };
}
