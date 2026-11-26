'use strict';
// ============================================================
// Mission 1 scenery, AREA 2: ENEMY CAMP (ground x 1620-3060): the robot army's camp in a clearing hacked out of
// the jungle, hot midday going to afternoon. level1_art.js owns the level's draw hooks and calls this module:
//   L1ART.camp = { x0, x1, steps, bg(g, cx), behind(cx), ground(cx), plat(pl), front(cx) }
// (contract: tools/polish/build-contract.md).
//  bg      screen-space strips with parallax, painted once: sky column, sun and rays, clouds, far mountains with
//          the ROBOT BASE far ahead, two jungle hill layers, the jungle wall, the camp yard (gate, tent lines,
//          motor pool, radar, kitchen, east post; jungle closing in at both ends), the chain-link fence from the
//          camp gate to its corner by the river. Live: clouds, birds, the base's smoke, the radar dish, flags,
//          cookhouse smoke, a supply truck with its dust, lamps, heat shimmer, dust.
//  behind  the area's decor: 'CAMP >' sign, flag, radio mast, tents, palms, drums, sandbags, jeep, and two stumps
//          it adds at the clearing's edge.
//  ground  packed earth over layered soil, x 1620..3060 exactly: the jungle's worn turf dies out over the first
//          64px (its earth over 110px), a revetment of stacked stones closes the last 11px before the river bank.
//  plat    plank scaffolds, the watchtower, the crate stack (baked once each; top edge exactly at pl.y).
//  front   dark sandbags, wire and crates passing in front, dust motes.
// Static art is painted pixel by pixel in `steps` and blitted; only small things move, driven by G.t.
// No Math.random / rand: textures come from a private seeded table (nz).
// ============================================================
var L1ART = L1ART || {};
{
const X0 = 1620, X1 = 3060;          // the camp's ground
const CAM0 = 1200, CAM1 = 2940;      // cameras the backdrop is drawn for (1210..2930: the sky crossfades included)
// Math's functions held locally: painting calls them millions of times, and in the test harness (a node vm) every
// look-up of a property of the global object is slow
const { imul, floor, round, ceil, sqrt, sin, cos, abs, min, max, pow, hypot, PI } = Math;

// ============================================================
// Helpers: noise, colours, pixel buffers baked into canvases (the Mission 2 way)
// ============================================================
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (v, m) => ((v % m) + m) % m;
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = imul(t ^ (t >>> 15), t | 1);
    t ^= t + imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// stable noise 0..1 per integer point; smooth 1D noise and fbm on top of it
const NZ = (() => { const r = rng(20261113), a = new Float32Array(16384); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
const nz = (x, y) => NZ[(imul(x | 0, 374761393) ^ imul(y | 0, 668265263)) >>> 0 & 16383];
function vnoise(x, s) { const i = floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(nz(i, s), nz(i + 1, s), u); }
function fbm(x, s, oct) {
  let v = 0, a = 1, n = 0, f = 1;
  for (let o = 0; o < (oct || 3); o++) { v += a * vnoise(x * f, s + o * 17); n += a; a *= 0.5; f *= 2.07; }
  return v / n;
}

// colours are 0xRRGGBB ints; bits 24-30 hold alpha/2 for the few see-through pixels (0 = opaque)
const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
const PAL = (...s) => s.map(I);
const OUTI = I(OUT);
function mixI(a, b, k) {
  return round(lerp(a >> 16 & 255, b >> 16 & 255, k)) << 16 | round(lerp(a >> 8 & 255, b >> 8 & 255, k)) << 8 | round(lerp(a & 255, b & 255, k));
}
const AL = (c, a) => (c & 0xffffff) | (clamp(round(a * 127), 1, 127) << 24);

// pixel buffers: logical coordinates minus (ox, oy) = buffer pixel
function buf(w, h, ox, oy) { const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox: ox || 0, oy: oy || 0 }; }
function put(b, x, y, c) { x = round(x) - b.ox; y = round(y) - b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = round(x) - b.ox; y = round(y) - b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) {
  x = round(x) - b.ox; y = round(y) - b.oy;
  const x0 = max(0, x), y0 = max(0, y), x1 = min(b.w, x + round(w)), y1 = min(b.h, y + round(h));
  if (x1 <= x0) return;
  for (let r = y0; r < y1; r++) b.d.fill(c, r * b.w + x0, r * b.w + x1);
}
function disc(b, cx, cy, r, c) {
  if (r < 0.5) { put(b, cx, cy, c); return; }
  const R2 = (r + 0.5) * (r + 0.5), n = floor(r + 0.5), x = round(cx), y = round(cy);
  for (let dy = -n; dy <= n; dy++) { const hw = floor(sqrt(max(0, R2 - dy * dy))); rect(b, x - hw, y + dy, hw * 2 + 1, 1, c); }
}
function oval(b, cx, cy, rx, ry, c) {
  const n = floor(ry + 0.5), x = round(cx), y = round(cy);
  for (let dy = -n; dy <= n; dy++) { const hw = floor(rx * sqrt(max(0, 1 - (dy / (ry + 0.5)) ** 2)) + 0.3); rect(b, x - hw, y + dy, hw * 2 + 1, 1, c); }
}
function line(b, x0, y0, x1, y1, c, t) {
  t = t || 1;
  const n = ceil(max(abs(x1 - x0), abs(y1 - y0), 1));
  for (let i = 0; i <= n; i++) rect(b, round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), t, t, c);
}
function poly(b, pts, c) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = min(y0, p[1]); y1 = max(y1, p[1]); }
  const xs = [];
  for (let y = floor(y0); y <= ceil(y1); y++) {
    const sy = y + 0.5; xs.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[j];
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + (sy - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) { const a = round(xs[k]), e = round(xs[k + 1]); if (e > a) rect(b, a, y, e - a, 1, c); }
  }
}
// 1px outline around everything drawn (against empty pixels)
function outline(b, c) {
  if (c == null) c = OUTI;
  const add = [], w = b.w, h = b.h, d = b.d;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i] !== NONE) continue;
    if ((x > 0 && d[i - 1] !== NONE) || (x < w - 1 && d[i + 1] !== NONE) || (y > 0 && d[i - w] !== NONE) || (y < h - 1 && d[i + w] !== NONE)) add.push(i);
  }
  for (const i of add) d[i] = c;
}
function stamp(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.d[y * src.w + x]; if (c !== NONE) put(dst, dx + x + dst.ox, dy + y + dst.oy, c); }
}
// replace colours: fn(c, x, y) -> c for every drawn pixel
function remap(b, fn) { for (let i = 0; i < b.d.length; i++) if (b.d[i] !== NONE) b.d[i] = fn(b.d[i], i % b.w + b.ox, (i / b.w | 0) + b.oy); }
// mix every drawn pixel toward colour c by k(y): haze (runs of one colour and repeated colours are mixed once)
function haze(b, c, k) {
  const memo = new Map();
  let km = -1;
  for (let r = 0; r < b.h; r++) {
    const m = k(r + b.oy);
    if (m <= 0) continue;
    if (m !== km) { memo.clear(); km = m; }
    let lv = NONE, lo = NONE;
    for (let i = r * b.w, e = i + b.w; i < e; i++) {
      const v = b.d[i];
      if (v === NONE) continue;
      if (v !== lv) { lv = v; lo = memo.get(v); if (lo === undefined) { lo = mixI(v & 0xffffff, c, m) | (v & 0x7f000000); memo.set(v, lo); } }
      b.d[i] = lo;
    }
  }
}
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function bake(b) {
  const c = canvasOf(b.w, b.h), g = c.getContext('2d'), im = g.createImageData(b.w, b.h), d = im.data;
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = i * 4, a = v >>> 24;
    d[j] = v >> 16 & 255; d[j + 1] = v >> 8 & 255; d[j + 2] = v & 255; d[j + 3] = a ? a * 2 : 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// sprite drawn with its anchor at (x, y): the buffer's logical origin is the anchor
function mk(b) { return { img: bake(b), w: b.w, h: b.h, ox: b.ox, oy: b.oy }; }
function blit(g, s, x, y) { g.drawImage(s.img, round(x) + s.ox, round(y) + s.oy); }
// hard-edged disc of rects in the current fillStyle (no anti-aliasing)
function pdisc(g, x, y, r) {
  x = round(x); y = round(y);
  if (r < 1) { g.fillRect(x, y, 1, 1); return; }
  for (let j = -floor(r); j <= r; j++) { const hw = floor(sqrt((r + 0.5) * (r + 0.5) - j * j)); g.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
}

// ============================================================
// The backdrop
// ============================================================
// Screen-space strips: a strip with parallax p covers screen rows top..bot and is wide enough for the camera range.
// Strip x 0 = screen x -10 at camera CAM0, so world x `wx` seen at screen x `sx` sits at strip x
// sx + 10 + (wx - sx - CAM0) * p: that is how the ends of the yard and the fence are lined up with the ground's.
function stripBuf(p, top, bot) { return buf(W + 22 + ceil((CAM1 - CAM0) * p), bot - top, 0, top); }
function stripOf(b, p, live) { return { p, top: b.oy, h: b.h, w: b.w, c: bake(b), live: live || null }; }
const offOf = (S, cx) => clamp(round((cx - CAM0) * S.p), 0, S.w - W - 20);
function blitStrip(g, S, cx) { g.drawImage(S.c, offOf(S, cx), 0, W + 20, S.h, -10, S.top, W + 20, S.h); }
// rows y0..y1 of a strip, each shifted sideways by a slow sine: heat shimmer over the hot ground
function shimmerRows(g, S, cx, y0, y1, amp) {
  const off = offOf(S, cx);
  for (let y = max(y0, S.top); y < min(y1, S.top + S.h); y++) {
    const dx = round(sin(G.t * 0.09 + y * 1.3) * amp * (0.6 + 0.4 * sin(G.t * 0.023 + y * 0.31)));
    if (dx) g.drawImage(S.c, off, y - S.top, W + 20, 1, -10 + dx, y, W + 20, 1);
  }
}

// ---------- sky ----------
const SKY = [[-10, '#2f7fd0'], [30, '#4f9bdc'], [70, '#86bfe6'], [105, '#bcdcec'], [132, '#ecead0'], [156, '#f8e2b4'], [190, '#f3d4a0'], [H + 10, '#f3d4a0']];
const HAZE = I('#f1e3bc');           // the colour distance fades to
function skyColumn() {
  const b = buf(1, H + 20, 0, -10);
  for (let y = -10; y < H + 10; y++) {
    let i = 0;
    while (i + 1 < SKY.length && SKY[i + 1][0] <= y) i++;
    const a = SKY[i], e = SKY[min(i + 1, SKY.length - 1)], k = e[0] > a[0] ? clamp((y - a[0]) / (e[0] - a[0]), 0, 1) : 0;
    put(b, 0, y, mixI(I(a[1]), I(e[1]), k));
  }
  return bake(b);
}
function sunSprite() {
  const R = 72, c = canvasOf(R * 2, R * 2), g = c.getContext('2d');
  const gr = g.createRadialGradient(R, R, 4, R, R, R);
  gr.addColorStop(0, 'rgba(255,250,224,0.9)'); gr.addColorStop(0.22, 'rgba(255,240,196,0.45)'); gr.addColorStop(0.6, 'rgba(255,236,190,0.14)'); gr.addColorStop(1, 'rgba(255,232,180,0)');
  g.fillStyle = gr; g.fillRect(0, 0, R * 2, R * 2);
  const b = buf(R * 2, R * 2);
  disc(b, R, R, 14, I('#ffefb4')); disc(b, R, R, 13, I('#fff6d2')); disc(b, R + 1, R - 1, 10, I('#fffdf0'));
  g.drawImage(bake(b), 0, 0);
  return c;
}
function raySprite(s) {
  const w = 440, h = 270, c = canvasOf(w, h), g = c.getContext('2d'), ox = w / 2, oy = 40;
  for (let i = 0; i < 10; i++) {
    const a = PI * (0.16 + 0.8 * (i + nz(i, 3 + s) * 0.6) / 10), len = 150 + nz(i, 7 + s) * 110, wd = 0.022 + nz(i, 5 + s) * 0.034;
    const gr = g.createLinearGradient(ox, oy, ox + cos(a) * len, oy + sin(a) * len);
    gr.addColorStop(0, 'rgba(255,244,206,0.30)'); gr.addColorStop(1, 'rgba(255,244,206,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(ox, oy);
    g.lineTo(ox + cos(a - wd) * len, oy + sin(a - wd) * len); g.lineTo(ox + cos(a + wd) * len, oy + sin(a + wd) * len);
    g.closePath(); g.fill();
  }
  return c;
}
// A cumulus: puffs along a flat base, taller in the middle; shaded underside, lit crowns (light from side lx)
function cloudSprite(w, s, pal, lx, tall) {
  const h = round(w * (0.5 + 0.3 * tall)) + 6, base = h - 3, b = buf(w + 10, h, -5, 0), puffs = [];
  const n = 3 + floor(w / 20), m = 1 + floor(w / 46);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, r = w * (0.08 + 0.1 * sin(t * PI)) * (0.8 + 0.45 * nz(i, s * 7));
    puffs.push([t * w, base - r * 0.6, r]);
  }
  for (let i = 0; i < m; i++) {
    const t = 0.32 + 0.36 * (m === 1 ? 0.5 : i / (m - 1)) + (nz(i, s * 3) - 0.5) * 0.14, r = w * (0.15 + 0.06 * nz(i, s * 11));
    puffs.push([t * w, base - r * 0.55 - w * 0.12, r]);
  }
  if (tall) for (let i = 0; i < 3; i++) {       // a tower building up on the sunny side
    const t = 0.5 + lx * 0.08 + (nz(i, s * 13) - 0.5) * 0.2 - i * 0.03 * lx, r = w * (0.17 - i * 0.035);
    puffs.push([t * w, base - w * (0.26 + i * 0.13 * tall * 2), r]);
  }
  const C0 = pal[0], C1 = pal[1], C2 = pal[2];
  const lay = (dx, dy, dr, c, cut, only) => {
    for (const [x, y, r] of puffs) {
      const R2 = r + dr;
      if (R2 <= 0) continue;
      for (let yy = -floor(R2); yy <= R2; yy++) {
        const Y = round(y + dy + yy);
        if (Y > base - cut) break;
        const hw = floor(sqrt((R2 + 0.5) ** 2 - yy * yy));
        for (let X = round(x + dx) - hw; X <= round(x + dx) + hw; X++) if (only == null || get(b, X, Y) === only) put(b, X, Y, c);
      }
    }
  };
  lay(0, 0, 0, C0, 0);
  lay(0.5 * lx, -2, -0.8, C1, 3);
  for (const [x, y, r] of puffs) {
    const hr = r * 0.55, hx = x + lx * r * 0.28, hy = y - r * 0.38;
    for (let yy = -floor(hr); yy <= hr; yy++) { const hw = floor(sqrt((hr + 0.5) ** 2 - yy * yy)); for (let X = round(hx) - hw; X <= round(hx) + hw; X++) if (get(b, X, round(hy + yy)) === C1) put(b, X, round(hy + yy), C2); }
  }
  for (let X = -5; X < w + 5; X++) if (get(b, X, base) === C0 && nz(X, s) > 0.5) put(b, X, base + 1, C0);
  return bake(b);
}
const CLOUD_HI = PAL('#b9cbe4', '#eef1f2', '#ffffff'), CLOUD_LO = PAL('#cfd6dc', '#f1ecdc', '#fffaee');
// [width, seed, tall, low palette]
const CLOUD_DEF = [[118, 3, 0.5, 0], [78, 5, 0, 0], [56, 8, 0, 1], [92, 11, 0.25, 0], [42, 14, 0, 1], [30, 17, 0, 1], [66, 21, 0, 0]];
// [sprite, y, parallax, drift, phase]: seven clouds spread over a 780px loop
const CLOUD_AT = [[0, 44, 0.05, 0.035, 269], [1, 62, 0.04, 0.03, 532], [2, 96, 0.025, 0.02, 371], [6, 30, 0.06, 0.045, 681], [4, 104, 0.02, 0.016, 616], [5, 88, 0.02, 0.014, 454], [3, 70, 0.045, 0.03, 804]];

// ---------- far mountains ----------
const ridge = x => 122 - 30 * pow(fbm(x / 88, 3, 4), 1.25) - 8 * max(0, sin(x / 57 + 1));
// first half: the ridge with its sunlit facets
function farMountains(b) {
  const C = PAL('#9fb1d2', '#b7c5de', '#d2dae8', '#8ea1c8');
  // the ridge every tenth of a pixel from x -70, and how it slopes over 5px there (toward the sun or away from it)
  const N = (b.w + 80) * 10, FT = new Float32Array(N), SL = new Float32Array(N);
  for (let i = 0; i < N; i++) FT[i] = ridge(i / 10 - 70);
  for (let i = 0; i < N; i++) SL[i] = FT[min(N - 1, i + 25)] - FT[max(0, i - 25)];
  for (let x = 0; x < b.w; x++) {
    const y0 = round(FT[(x + 70) * 10]);
    for (let y = y0; y < b.oy + b.h; y++) {
      const sl = SL[clamp(round((x - (y - y0) * 0.8 + 70) * 10), 0, N - 1)], lit = sl > 0.3;
      put(b, x, y, y === y0 ? (lit ? C[2] : C[1]) : lit ? C[1] : sl < -1.1 && (y - y0) < 14 ? C[3] : C[0]);
    }
  }
}
// second half. Far ahead on a shoulder of the mountains: the ROBOT BASE where the mission ends (walls, towers, a
// dome, smoking stacks). Then the haze.
function farBase(b) {
  const bx = 466;                    // strip x: it stays in the right third of the screen along the whole camp
  let by = 0;
  for (let x = bx - 24; x <= bx + 24; x++) by = max(by, round(ridge(x)));
  by += 1;
  const BS = PAL('#7886b0', '#8e9cc2', '#b4c0da', '#66749e');
  rect(b, bx - 25, by - 6, 51, 6, BS[1]); rect(b, bx - 25, by - 6, 51, 1, BS[2]);
  for (let x = bx - 25; x < bx + 26; x += 4) rect(b, x, by - 8, 2, 2, BS[1]);
  for (const [tx, tw, th] of [[-22, 6, 12], [-5, 11, 16], [16, 7, 13]]) {
    rect(b, bx + tx, by - th, tw, th, BS[0]); rect(b, bx + tx + tw - 2, by - th, 2, th, BS[2]); rect(b, bx + tx - 1, by - th - 1, tw + 2, 1, BS[2]);
    put(b, bx + tx + (tw >> 1), by - th - 2, BS[0]); put(b, bx + tx + (tw >> 1), by - th - 3, BS[0]);
  }
  rect(b, bx - 2, by - 9, 5, 9, BS[3]); rect(b, bx - 2, by - 10, 5, 1, BS[2]);                     // the big door
  disc(b, bx + 9, by - 6, 4, BS[1]); disc(b, bx + 10, by - 7, 2.4, BS[2]); rect(b, bx + 4, by - 5, 12, 5, BS[1]);   // a dome
  for (const [sx2, sh] of [[-14, 19], [-10, 15]]) { rect(b, bx + sx2, by - sh, 2, sh, BS[0]); put(b, bx + sx2 + 1, by - sh, BS[2]); rect(b, bx + sx2 + 1, by - sh + 1, 1, sh - 1, BS[1]); }
  for (const [wx, wy] of [[-20, -7], [-1, -13], [1, -13], [18, -8], [-17, -3], [7, -3], [22, -3]]) put(b, bx + wx, by + wy, I('#ffe2a0'));
  haze(b, HAZE, y => ss(104, 142, y) * 0.8);
  return { stacks: [[bx - 13, by - 20], [bx - 9, by - 16]], lamp: [bx, by - 19] };
}

// ---------- jungle ----------
// one tree crown: a lumpy cluster of lobes, shaded body, lit masses toward the sun (upper right), deep gaps below
function crown(b, x, y, r, pal, tone) {
  if (r < 2.4) {
    disc(b, x, y, r, pal[1]); disc(b, x + r * 0.3, y - r * 0.35, r * 0.6, pal[2]);
    if (tone > 0.55) put(b, x + r * 0.5, y - r * 0.7, pal[3]);
    return;
  }
  const lobes = [[0, 0, r * 0.8], [-r * 0.62, r * 0.28, r * 0.56], [r * 0.6, r * 0.22, r * 0.6], [r * 0.22, -r * 0.48, r * 0.56], [-r * 0.34, -r * 0.3, r * 0.5]];
  for (const [dx, dy, rr] of lobes) disc(b, x + dx, y + dy, rr, pal[1]);
  for (const [dx, dy, rr] of lobes) disc(b, x + dx + rr * 0.28, y + dy - rr * 0.34, rr * 0.6, pal[2]);
  for (const [dx, dy, rr] of lobes) if (rr > 1.8) disc(b, x + dx + rr * 0.46, y + dy - rr * 0.56, rr * 0.3, pal[3]);
  if (tone > 0.3) { put(b, x + r * 0.42, y - r * 0.95, pal[4]); put(b, x + r * 0.8, y - r * 0.1, pal[4]); if (r > 5) put(b, x + r * 0.42 + 1, y - r * 0.95, pal[4]); }
  for (let a = 1.7; a < 3.3; a += 1.1 / r) if (nz(x + a * 9, y) > 0.35) put(b, x + cos(a) * r * 0.86, y + sin(a) * r * 0.8, pal[0]);
}
// three versions of a palette: in shadow, plain, in full sun
function tones(pal, dark, light) {
  return [pal.map((c, i) => i ? mixI(c, dark, 0.3) : c), pal, pal.map((c, i) => mixI(c, light, i < 2 ? 0.12 : 0.26))];
}
// a hillside covered in tree crowns, rows from the skyline down; big soft patches of sun and shade
function jungle(b, f, pal, o, row0, row1) {
  const T = tones(pal, pal[0], o.sun || I('#e6e88a'));
  if (!row0) for (let x = 0; x < b.w; x++) { const y = round(f(x)); rect(b, x, y, 1, b.oy + b.h - y, pal[1]); }
  for (let row = row0; row < row1; row++) {
    for (let x = -o.r1; x < b.w + o.r1; x += o.gap) {
      const k = nz(x, row * 7 + o.s + 1), jx = x + (nz(x, row * 7 + o.s) - 0.5) * o.gap, r = o.r0 + k * k * (o.r1 - o.r0);
      const y = f(jx) + row * o.step + (nz(x, row * 7 + o.s + 2) - 0.3) * o.step * 0.9 + (row === 0 ? r * 0.25 : 0);
      const sun = fbm(jx / o.patch, o.s + 9, 2) + (f(jx + 6) > f(jx - 6) ? 0.1 : -0.1) - row * 0.03;
      crown(b, jx, y, r, T[sun > 0.6 ? 2 : sun < 0.42 ? 0 : 1], nz(x, row * 7 + o.s + 3));
      if (o.bloom && nz(x, row * 7 + o.s + 4) > o.bloom && r > 2.5) for (let i = 0; i < 4; i++) put(b, jx + (nz(x + i, row + 5) - 0.4) * r * 1.4, y - nz(x + i, row + 6) * r, o.bloomC[i & 1]);
    }
  }
}
// a far palm: thin leaning trunk, a star of fronds
function farPalm(b, x, base, h, trunk, pal) {
  const lean = (nz(x, 61) - 0.5) * h * 0.5;
  let tx = x;
  for (let i = 0; i <= h; i++) { tx = x + lean * (i / h) * (i / h); put(b, tx, base - i, trunk); }
  const ty = base - h;
  for (let k = 0; k < 7; k++) {
    const a = -PI * (0.05 + 0.9 * k / 6), len = 3 + h * 0.22 + nz(x, 62 + k) * 2;
    for (let t = 1; t <= len; t++) {
      const u = t / len;
      put(b, tx + cos(a) * t, ty + sin(a) * t * 0.7 + u * u * len * 0.55, k < 3 ? pal[1] : u > 0.5 ? pal[3] : pal[2]);
    }
  }
  put(b, tx, ty, pal[0]);
}
// the two hill layers, each painted in parts (bake steps): rows of crowns from the skyline down, then the trees
// standing above the canopy and the haze
const HILL_A = { pal: PAL('#5a8c8a', '#6c9c94', '#84b0a0', '#a0c6ac', '#bcd8b6'), f: x => 133 - 15 * fbm(x / 120, 21, 3) - 6 * sin(x / 47), o: { step: 4, gap: 4, r0: 1.3, r1: 3.4, s: 100, patch: 30, sun: I('#e8eebc') } };
const HILL_B = { pal: PAL('#2a6450', '#3b7a5a', '#529664', '#78b672', '#a8d688'), f: x => 149 - 20 * pow(fbm(x / 96, 41, 3), 1.2) - 5 * sin(x / 41 + 1), o: { step: 5, gap: 6, r0: 2.2, r1: 6, s: 200, patch: 36, bloom: 0.93, bloomC: PAL('#f0a04a', '#f6c66a') } };
function hillRows(b, Hl, row0, row1) { jungle(b, Hl.f, Hl.pal, Hl.o, row0, row1); }
function hillsAEnd(b) {
  const { pal, f } = HILL_A;
  for (let x = 12; x < b.w; x += 17 + (nz(x, 23) * 30 | 0)) { const r = 3 + nz(x, 24) * 2; rect(b, x, f(x) - r, 1, r + 2, pal[0]); crown(b, x, f(x) - r - 1, r, pal, 1); }
  haze(b, HAZE, y => 0.2 + ss(134, 166, y) * 0.62);
}
function hillsBEnd(b) {
  const { pal, f } = HILL_B;
  for (let x = 20; x < b.w; x += 26 + (nz(x, 43) * 50 | 0)) farPalm(b, x, f(x) + 2, 9 + (nz(x, 44) * 5 | 0), I('#4a6f52'), pal);
  haze(b, HAZE, y => 0.14 + ss(150, 182, y) * 0.5);
}
// the wall of big trees at the edge of the clearing: dark understory, pale trunks, heavy crowns, palms above
const WALL = { pal: PAL('#143a2c', '#21583b', '#317648', '#56a257', '#96d26c'), top: x => 153 - 9 * fbm(x / 64, 51, 3) - 5 * max(0, sin(x / 91)), base: 184 };
function wallCrowns(b, row) {
  const { pal, top } = WALL, T = tones(pal, pal[0], I('#e6e88a'));
  for (let x = -10; x < b.w + 10; x += 8) {
    const k = nz(x, row * 7 + 301), jx = x + (nz(x, row * 7 + 300) - 0.5) * 9, r = 3.5 + k * k * 7.5;
    const sun = fbm(jx / 34, 77, 2) - row * 0.07 + 0.06;
    crown(b, jx, top(jx) + row * 6 + (nz(x, row * 7 + 302) - 0.3) * 6 + (row === 0 ? r * 0.3 : 0), r, T[sun > 0.58 ? 2 : sun < 0.42 ? 0 : 1], nz(x, row * 7 + 303));
  }
}
// first half: the gloom, the trunks, the undergrowth, the back row of crowns
function jungleWall(b) {
  const { pal, top, base: BASE } = WALL, T = tones(pal, pal[0], I('#e6e88a'));
  for (let x = 0; x < b.w; x++) { const y = round(top(x)) + 5; rect(b, x, y, 1, BASE - y, nz(x >> 1, 52) > 0.55 ? pal[0] : I('#1b4633')); }
  // trunks standing in the gloom: lit on the right
  for (let x = 4; x < b.w; x += 5 + (nz(x, 53) * 10 | 0)) {
    const tw = nz(x, 54) > 0.7 ? 2 : 1, y0 = round(top(x)) + 8;
    rect(b, x, y0, tw, BASE - y0, I('#667456'));
    rect(b, x + tw, y0, 1, BASE - y0, I('#a3ab80'));
    if (nz(x, 55) > 0.6) for (let y = y0 + 3; y < BASE; y += 3) put(b, x + tw + 1 + ((y >> 1) & 1), y, pal[2]);   // a vine up the trunk
  }
  // undergrowth at the foot of the trees
  for (let x = -4; x < b.w + 4; x += 4) { const r = 2 + nz(x, 65) * 2.5; crown(b, x + nz(x, 66) * 3, BASE - 1 - r * 0.5, r, T[nz(x, 67) > 0.6 ? 1 : 0], 0); }
  wallCrowns(b, 0);
}
// second half: two more rows of crowns, the lowest hanging over the trunks; vines, palms, emergent giants, haze
function jungleWallEnd(b) {
  const { pal, top, base: BASE } = WALL, T = tones(pal, pal[0], I('#e6e88a'));
  wallCrowns(b, 1); wallCrowns(b, 2);
  for (let x = 0; x < b.w; x++) {
    const y = round(top(x)) + 17 + (nz(x, 56) * 8 | 0);
    if (nz(x, 57) > 0.84) { const len = 3 + (nz(x, 58) * 9 | 0); for (let k = 0; k < len && y + k < BASE - 2; k++) put(b, x + ((k >> 2) & 1), y + k, k % 3 ? pal[2] : pal[3]); }
  }
  for (let x = 18; x < b.w; x += 30 + (nz(x, 59) * 44 | 0)) {
    if (nz(x, 60) > 0.35) farPalm(b, x, top(x) + 6, 15 + (nz(x, 63) * 8 | 0), I('#7d8a62'), pal);
    else { const r = 7 + nz(x, 64) * 3, y = top(x) - r * 0.6; rect(b, x, y, 2, r + 4, I('#55684c')); crown(b, x, y, r, T[2], 1); }
  }
  haze(b, HAZE, y => 0.05 + ss(166, 186, y) * 0.22);
}

// Where the clearing ends: big trees crowding in from x0 to x1, dark underneath, trunks lit on the sunny side,
// undergrowth at the foot (both ends of the yard and of the fence strip). R0..R1 = crown radius.
function thicket(b, x0, x1, base, top, pal, s, R0, R1) {
  const T = tones(pal, pal[0], I('#e6e88a'));
  const edge = x => clamp(min(x - x0, x1 - x) / (R1 * 3), 0, 1);       // 0 at its ragged ends, 1 inside
  const topAt = x => base - (base - top) * (0.5 + 0.5 * edge(x)) + 7 * fbm(x / (R1 * 2.4), s, 2) - 3;
  for (let x = x0; x < x1; x++) {
    if (edge(x) < 0.12) continue;
    const y = round(topAt(x)) + 4;
    rect(b, x, y, 1, base - y, nz(x >> 1, s + 1) > 0.5 ? pal[0] : mixI(pal[0], pal[1], 0.45));
  }
  for (let x = x0 + 6; x < x1 - 5; x += R1 * 0.7 + (nz(x, s + 2) * R1 | 0)) {
    const tw = (R1 > 10 ? 2 : 1) + (nz(x, s + 3) * 2.2 | 0), y0 = round(topAt(x)) + 6;
    rect(b, x, y0, tw, base - y0, I('#5a664a')); rect(b, x + tw, y0, 1, base - y0, I('#a2a87c')); rect(b, x - 1, base - 3, tw + 3, 3, I('#5a664a'));
    if (nz(x, s + 12) > 0.5) for (let y = y0 + 4; y < base - 2; y += 3) put(b, x + tw + 1 + ((y >> 1) & 1), y, pal[2]);
  }
  const rows = max(2, floor((base - top) * 0.6 / (R1 * 0.8)));
  for (let row = 0; row < rows; row++) for (let x = x0 - 4; x < x1 + 4; x += R1 * 0.9) {
    const jx = x + (nz(x, row * 7 + s + 4) - 0.5) * R1, k = nz(x, row * 7 + s + 5), r = R0 + k * k * (R1 - R0);
    if (jx < x0 - 2 || jx > x1 + 2) continue;
    const y = topAt(jx) + row * R1 * 0.8 + (nz(x, row * 7 + s + 6) - 0.3) * R1 * 0.6 + r * 0.3;
    const sun = fbm(jx / 30, s + 7, 2) - row * 0.07 + 0.08;
    crown(b, jx, y, r, T[sun > 0.58 ? 2 : sun < 0.42 ? 0 : 1], nz(x, row * 7 + s + 8));
  }
  for (let x = x0; x < x1; x += R0) { const r = R0 * 0.5 + nz(x, s + 9) * R0 * 0.7; crown(b, x + nz(x, s + 10) * 3, base - r * 0.5, r, T[nz(x, s + 11) > 0.55 ? 1 : 0], 0); }
}

// ---------- the camp yard (middle distance) ----------
// No outlines back here and a little haze: the action in front keeps the dark lines and the strong colours.
const YARD = PAL('#eed8a0', '#e6c98a', '#dcb978', '#d0a968');
const YSH = I('#b48e56');                                 // a cast shadow on the yard
const TENT_A = { hi: I('#c9cb8c'), lit: I('#aab06c'), mid: I('#878f52'), dark: I('#646c3e'), door: I('#363d2a') };
const TENT_B = { hi: I('#98a460'), lit: I('#74824a'), mid: I('#566438'), dark: I('#3e4a2a'), door: I('#222a1a') };   // the big dark mess tents
const MWOOD = PAL('#c89e64', '#a47c4a', '#7c5a36', '#563e28');
const MSTEEL = PAL('#dcdfd2', '#b4b9aa', '#878d80', '#5a6056');
const MOLIVE = PAL('#a6b068', '#838e4e', '#626c3a', '#434b2a');
const HZY = I('#f0c62e'), HZK = I('#33332f');             // hazard stripes
function gshadow(b, x0, x1, y, len) { rect(b, x0 - len, y, x1 - x0 + len, 1, YSH); rect(b, x0 - len + 3, y - 1, x1 - x0 + len - 5, 1, YSH); rect(b, x0 - len + 2, y + 1, x1 - x0 + len - 4, 1, YSH); }
function hazard(b, x, y, w) { for (let k = 0; k < w; k++) put(b, x + k, y, (k >> 1) & 1 ? HZK : HZY); }
// a ridge tent seen three-quarters: the gable with its door on the left, the long sunlit side to the right
function mTent(b, x, base, w, h, TENT) {
  TENT = TENT || TENT_A;
  const gw = round(w * 0.4), ax = x + (gw >> 1), ay = base - h, rx = x + w - round(h * 0.5), big = h > 12;
  gshadow(b, x, x + gw, base, round(h * 0.6));
  poly(b, [[ax, ay], [rx + 1, ay], [x + w + 1, base + 1], [x + gw, base + 1]], TENT.lit);
  for (let k = ax + 6; k < rx; k += big ? 9 : 6) line(b, k, ay + 1, k + (x + w - rx) * 0.94, base, TENT.mid);     // seams
  if (big) for (let y = ay + round(h * 0.62); y <= base; y++) for (let k = x + gw; k <= x + w; k++) if (get(b, k, y) === TENT.lit && ((k + y) & 1) && nz(k >> 1, y) > 0.35) put(b, k, y, TENT.mid);
  line(b, ax, ay, rx, ay, TENT.hi); line(b, ax + 1, ay + 1, rx + 1, ay + 1, TENT.hi);
  if (big) { line(b, ax + 2, ay + 2, rx + 2, ay + 2, TENT.hi); rect(b, ax + round((rx - ax) * 0.55), ay + round(h * 0.4), 4, 3, TENT.mid); rect(b, ax + round((rx - ax) * 0.55), ay + round(h * 0.4), 4, 1, TENT.dark); }
  rect(b, x + gw, base, w - gw + 1, 1, TENT.dark);
  poly(b, [[x, base + 1], [ax, ay - 0.5], [ax + 1, ay - 0.5], [x + gw + 1, base + 1]], TENT.mid);
  line(b, x, base, ax, ay, TENT.dark);
  line(b, x + gw, base, ax + 1, ay, TENT.lit);
  poly(b, [[ax - gw * 0.22, base + 1], [ax, ay + h * 0.34], [ax + 1, ay + h * 0.34], [ax + gw * 0.22 + 1, base + 1]], TENT.door);
  if (big) { line(b, ax - gw * 0.22, base, ax, ay + h * 0.34, TENT.lit); put(b, ax + 1, base - 1, I('#8a6a40')); put(b, ax + 2, base - 1, I('#b08a56')); }
  rect(b, ax, ay - (big ? 4 : 2), 1, big ? 4 : 2, MWOOD[2]);
  line(b, x - (big ? 6 : 3), base, x + 1, base - (big ? 5 : 2), MWOOD[3]); line(b, x + w + (big ? 7 : 4), base, x + w + 1, base - (big ? 6 : 3), MWOOD[3]);   // guy ropes
}
// a watchtower: braced timber legs, a boarded cabin, an olive roof, a ladder
function mTower(b, x, base, h) {
  const s = h > 40 ? 7 : 5, top = base - h, c0 = top + 11;
  gshadow(b, x - s, x + s, base, 12);
  rect(b, x - s, c0, 2, h - 11, MWOOD[2]); rect(b, x + s - 1, c0, 2, h - 11, MWOOD[1]); rect(b, x + s, c0, 1, h - 11, MWOOD[0]);
  const n = h > 40 ? 3 : 2, hh = (h - 11) / n;
  for (let k = 0; k < n; k++) {
    const y0 = c0 + k * hh, y1 = y0 + hh;
    line(b, x - s + 1, y0, x + s - 1, y1, MWOOD[3]); line(b, x + s - 1, y0, x - s + 1, y1, MWOOD[2]);
    rect(b, x - s, y1 - 1, s * 2 + 1, 1, MWOOD[1]);
  }
  for (let y = c0 + 2; y < base; y += 3) rect(b, x - s - 4, y, 3, 1, MWOOD[2]);                    // ladder
  rect(b, x - s - 4, c0, 1, h - 11, MWOOD[3]); rect(b, x - s - 2, c0, 1, h - 11, MWOOD[1]);
  rect(b, x - s - 3, c0 - 1, s * 2 + 7, 2, MWOOD[0]); rect(b, x - s - 3, c0 + 1, s * 2 + 7, 1, MWOOD[3]);   // floor
  rect(b, x - s - 2, c0 - 6, s * 2 + 5, 5, MWOOD[1]); rect(b, x - s - 2, c0 - 6, s * 2 + 5, 1, MWOOD[0]);  // boarded rail
  for (let k = x - s; k < x + s + 2; k += 3) rect(b, k, c0 - 5, 1, 4, MWOOD[2]);
  rect(b, x + s + 2, c0 - 6, 1, 5, MWOOD[0]);
  rect(b, x - s - 2, c0 - 12, 1, 6, MWOOD[2]); rect(b, x + s + 2, c0 - 12, 1, 6, MWOOD[1]); rect(b, x, c0 - 12, 1, 6, MWOOD[3]);
  const rw = s + 6;
  for (let i = 0; i < 5; i++) { const hw = rw - i * 2; rect(b, x - hw, c0 - 13 - i, hw * 2 + 1, 1, i === 0 ? MOLIVE[3] : i === 4 ? MOLIVE[0] : MOLIVE[1]); rect(b, x + 1, c0 - 13 - i, hw, 1, i === 0 ? MOLIVE[3] : MOLIVE[0]); }
  hazard(b, x - rw, c0 - 12, rw * 2 + 1);
  rect(b, x + s - 1, c0 - 10, 3, 3, I('#4a4e46')); put(b, x + s + 2, c0 - 9, I('#fff7cf'));     // a searchlight under the eave
  return [x, c0 - 19];
}
function mTruck(b, x, base, dir) {
  const WD = 47, RW = (k, y, w, h, c) => rect(b, dir > 0 ? x + k : x + WD - k - w, y, w, h, c), X = k => dir > 0 ? x + k : x + WD - 1 - k;
  const CV = PAL('#d6cf9c', '#b3ad7c', '#928e62', '#737048');
  gshadow(b, x, x + WD, base, 9);
  RW(0, base - 20, 28, 14, CV[1]); RW(1, base - 22, 26, 2, CV[0]); RW(3, base - 23, 22, 1, CV[0]); RW(0, base - 20, 28, 1, CV[0]);   // canvas tilt
  for (let k = 5; k < 27; k += 6) RW(k, base - 21, 1, 14, CV[2]);
  RW(0, base - 20, 2, 14, CV[3]); RW(26, base - 20, 2, 14, CV[0]); RW(0, base - 8, 28, 2, CV[2]);
  RW(12, base - 16, 4, 4, I('#3a3a36')); RW(13, base - 15, 2, 2, I('#e04a38'));                 // the army's red eye
  RW(0, base - 6, 28, 2, MOLIVE[2]); RW(0, base - 7, 28, 1, MOLIVE[0]);
  RW(30, base - 17, 9, 12, MOLIVE[1]); RW(30, base - 18, 9, 1, MOLIVE[0]); RW(30, base - 17, 1, 12, MOLIVE[2]);
  RW(32, base - 15, 6, 5, I('#8fb4c4')); RW(32, base - 15, 6, 1, I('#d8eef2')); RW(36, base - 14, 1, 3, I('#d8eef2'));
  RW(39, base - 11, 7, 6, MOLIVE[1]); RW(39, base - 12, 7, 1, MOLIVE[0]); RW(46, base - 10, 1, 5, MOLIVE[3]); RW(46, base - 9, 1, 2, I('#fff7cf'));
  RW(0, base - 5, 47, 2, MOLIVE[3]); RW(44, base - 4, 4, 1, MSTEEL[3]);
  for (const k of [7, 15, 39]) { disc(b, X(k), base - 3, 3.2, I('#2f2c28')); disc(b, X(k), base - 3, 1.2, I('#9a9684')); put(b, X(k) + 1, base - 6, I('#5a564e')); }
}
function mHut(b, x, base, w, h) {       // a Quonset hut: corrugated arch, lit along the top
  gshadow(b, x, x + w, base, 9);
  for (let i = 0; i < w; i++) {
    const e = min(i, w - 1 - i), cut = e < 5 ? [7, 4, 3, 2, 1][e] : 0;
    for (let j = cut; j < h; j++) {
      const t = j / h, rib = (i % 4) === 0;
      put(b, x + i, base - h + j, t < 0.16 ? MSTEEL[0] : t < 0.5 ? (rib ? MSTEEL[2] : MSTEEL[1]) : (rib ? MSTEEL[3] : MSTEEL[2]));
    }
  }
  const dh = round(h * 0.55);
  rect(b, x + 7, base - dh, 6, dh, I('#474d44')); rect(b, x + 7, base - dh - 1, 6, 1, MSTEEL[3]); rect(b, x + 12, base - dh, 1, dh, I('#2f342e'));
  for (let k = x + 20; k < x + w - 8; k += 11) { rect(b, k, base - dh, 5, 3, I('#5f7d86')); rect(b, k, base - dh, 5, 1, I('#cfe4e8')); }
  hazard(b, x + 1, base - 1, w - 2);
  for (let i = 0; i < 9; i++) if (nz(x + i, 5) > 0.5) rect(b, x + 14 + i * 5, base - h + 4 + (nz(i, x) * 6 | 0), 1, 3, I('#a8784a'));   // rust streaks
}
function mCrates(b, x, base, seed) {
  gshadow(b, x, x + 24, base, 7);
  const cr = (cx, cy, s, olive) => {
    const P = olive ? MOLIVE : MWOOD;
    rect(b, cx, cy - s, s, s, P[1]); rect(b, cx, cy - s, s, 1, P[0]); rect(b, cx, cy - s, 1, s, P[2]); rect(b, cx + s - 1, cy - s, 1, s, P[0]);
    rect(b, cx + 1, cy - (s >> 1) - 1, s - 2, 1, P[2]); rect(b, cx, cy - 1, s, 1, P[3]);
    if (olive) { put(b, cx + 2, cy - s + 2, HZY); put(b, cx + 3, cy - s + 2, HZY); }
  };
  cr(x, base, 9, false); cr(x + 9, base, 8, nz(seed, 1) > 0.5); cr(x + 17, base, 7, false);
  cr(x + 3, base - 9, 8, nz(seed, 2) > 0.4); if (nz(seed, 3) > 0.3) cr(x + 12, base - 8, 7, true);
  if (nz(seed, 4) > 0.4) cr(x + 6, base - 17, 7, false);
}
function mTank(b, x, base, w) {         // a fuel tank on a cradle, a hazard band round its middle
  const h = round(w * 0.45);
  gshadow(b, x, x + w, base, 6);
  rect(b, x + 3, base - 3, 2, 3, MSTEEL[3]); rect(b, x + w - 5, base - 3, 2, 3, MSTEEL[3]);
  for (let j = 0; j < h; j++) {
    const e = min(j, h - 1 - j), inset = e === 0 ? 3 : e === 1 ? 1 : 0, t = j / h;
    rect(b, x + inset, base - 3 - h + j, w - inset * 2, 1, t < 0.25 ? MSTEEL[0] : t < 0.6 ? MSTEEL[1] : MSTEEL[2]);
  }
  for (let j = 1; j < h - 1; j++) for (let k = 0; k < 3; k++) put(b, x + (w >> 1) - 1 + k, base - 3 - h + j, ((j + k) >> 1) & 1 ? HZY : HZK);
  rect(b, x + 5, base - 5 - h, 3, 2, MSTEEL[2]);
}
function mLamp(b, x, base, h, dir) {    // a searchlight on a lattice pole
  rect(b, x, base - h, 1, h, I('#5a5e54')); rect(b, x + 2, base - h, 1, h, I('#9a9e90'));
  for (let y = base - h + 2; y < base - 1; y += 4) { put(b, x + 1, y + ((y >> 2) & 1), I('#73776b')); }
  line(b, x - 3, base, x, base - 7, I('#5a5e54')); line(b, x + 5, base, x + 2, base - 7, I('#73776b'));
  const hx = dir > 0 ? x - 1 : x - 3;
  rect(b, hx, base - h - 5, 7, 5, MOLIVE[2]); rect(b, hx, base - h - 5, 7, 1, MOLIVE[0]); rect(b, hx, base - h - 1, 7, 1, MOLIVE[3]);
  rect(b, dir > 0 ? hx + 6 : hx, base - h - 5, 1, 5, I('#fff7cf')); rect(b, dir > 0 ? hx + 7 : hx - 1, base - h - 4, 1, 3, I('#ffffff'));
}
function mStump(b, x, base, w, h) {
  h = h || 4;
  rect(b, x, base - h + 1, w, h, I('#8a6a48')); rect(b, x, base - h + 1, 1, h, I('#6a4e36')); rect(b, x + w - 1, base - h + 1, 1, h, I('#a88458')); rect(b, x, base - h, w, 1, I('#e6ca94')); put(b, x + (w >> 1), base - h, I('#b89460'));
  rect(b, x - 3, base, w + 2, 1, YSH);
}
function mCook(b, x, base) {            // the cookhouse: a plank shed with a tin roof and a stovepipe
  const w = 36, h = 13;
  gshadow(b, x, x + w, base, 9);
  rect(b, x, base - h, w, h, MWOOD[1]); rect(b, x, base - h, 1, h, MWOOD[2]);
  for (let k = x + 4; k < x + w; k += 4) rect(b, k, base - h, 1, h, MWOOD[2]);
  rect(b, x + w - 1, base - h, 1, h, MWOOD[0]); rect(b, x, base - 1, w, 1, MWOOD[3]);
  rect(b, x + 13, base - 9, 7, 9, I('#3f3024')); rect(b, x + 13, base - 10, 7, 1, MWOOD[3]);
  rect(b, x + 24, base - 10, 7, 5, I('#4a3a2a')); rect(b, x + 24, base - 10, 7, 2, I('#f4d67e')); rect(b, x + 23, base - 5, 9, 1, MWOOD[0]);   // the serving hatch, lamp lit
  rect(b, x + 3, base - 9, 5, 4, I('#4a3a2a')); rect(b, x + 3, base - 9, 5, 1, I('#6f8a90'));
  for (let i = 0; i < 6; i++) rect(b, x - 3 + i, base - h - 1 - i, w + 6 - i * 2, 1, i === 5 ? MSTEEL[0] : i === 0 ? MSTEEL[3] : (i & 1 ? MSTEEL[1] : MSTEEL[2]));
  for (let k = x; k < x + w; k += 3) put(b, k, base - h - 3, MSTEEL[3]);
  rect(b, x + 27, base - h - 16, 3, 12, MSTEEL[3]); rect(b, x + 28, base - h - 16, 1, 12, MSTEEL[1]); rect(b, x + 26, base - h - 17, 5, 1, MSTEEL[3]);
  rect(b, x + 38, base - 6, 5, 6, I('#4f7fb0')); rect(b, x + 38, base - 6, 5, 1, I('#8fb4dc')); rect(b, x + 38, base - 3, 5, 1, I('#365a80'));   // a water drum by the door
  return [x + 28, base - h - 19];
}
function mRadar(b, x, base) {           // a concrete bunker with the radar mast on its roof
  const C = PAL('#ded6ba', '#b8b094', '#928a70', '#6c6652');
  gshadow(b, x - 15, x + 15, base, 9);
  rect(b, x - 15, base - 13, 31, 13, C[1]); rect(b, x - 15, base - 13, 2, 13, C[2]); rect(b, x + 14, base - 13, 2, 13, C[0]);
  rect(b, x - 17, base - 15, 35, 2, C[0]); rect(b, x - 17, base - 13, 35, 1, C[3]);
  for (let i = 0; i < 12; i++) put(b, x - 12 + (nz(i, 11) * 24 | 0), base - 11 + (nz(i, 12) * 9 | 0), C[2]);
  rect(b, x - 10, base - 9, 6, 9, I('#444a42')); rect(b, x - 10, base - 10, 6, 1, C[3]); rect(b, x - 5, base - 9, 1, 9, I('#2c312b'));
  rect(b, x + 1, base - 9, 9, 3, I('#34424a')); rect(b, x + 1, base - 9, 9, 1, I('#bfe0e6')); put(b, x + 8, base - 8, I('#5fe08a')); put(b, x + 4, base - 8, I('#ff5a4a'));
  hazard(b, x - 15, base - 1, 31);
  rect(b, x - 1, base - 28, 1, 13, MSTEEL[3]); rect(b, x, base - 28, 1, 13, MSTEEL[2]); rect(b, x + 1, base - 28, 1, 13, MSTEEL[0]);
  line(b, x - 6, base - 15, x - 1, base - 22, MSTEEL[3]); line(b, x + 7, base - 15, x + 1, base - 22, MSTEEL[2]);
  rect(b, x + 10, base - 22, 1, 7, MSTEEL[3]); put(b, x + 10, base - 23, I('#ff5a4a'));       // a whip aerial
  return [x, base - 33];
}
function mPole(b, x, base, h) {
  rect(b, x, base - h, 1, h, I('#5e6258')); rect(b, x + 1, base - h, 1, h, I('#a4a898')); rect(b, x, base - h - 2, 2, 2, HZY); put(b, x + 1, base - h - 2, I('#fff0a0'));
  rect(b, x - 2, base - 2, 6, 2, I('#b8b094')); rect(b, x - 2, base, 6, 1, I('#928a70'));
  return [x + 2, base - h];
}

function mShed(b, x, base) {            // the guard hut at the gate: planks, a tin roof, a dark doorway
  gshadow(b, x, x + 14, base, 6);
  rect(b, x, base - 12, 14, 12, MWOOD[1]); rect(b, x, base - 12, 1, 12, MWOOD[2]); rect(b, x + 13, base - 12, 1, 12, MWOOD[0]);
  for (let k = x + 3; k < x + 13; k += 3) rect(b, k, base - 12, 1, 12, MWOOD[2]);
  rect(b, x + 5, base - 8, 5, 8, I('#3f3024')); rect(b, x + 5, base - 9, 5, 1, MWOOD[3]);
  for (let i = 0; i < 4; i++) rect(b, x - 2 + i, base - 13 - i, 18 - i * 2, 1, i === 3 ? MSTEEL[0] : i === 0 ? MSTEEL[3] : MSTEEL[1]);
}
function mBarrier(b, x, base) {         // the boom at the gate: a red and white pole raised on its post
  rect(b, x, base - 9, 3, 9, MSTEEL[2]); rect(b, x + 2, base - 9, 1, 9, MSTEEL[0]); rect(b, x - 1, base, 5, 1, MSTEEL[3]);
  for (let k = 0; k < 30; k++) {
    const px = x + 1 + k, py = base - 9 - round(k * 0.36), red = (k >> 2) & 1;
    put(b, px, py, red ? I('#d8382c') : I('#f4f0e4')); put(b, px, py + 1, red ? I('#a0241c') : I('#c8c4b4'));
  }
  rect(b, x - 4, base - 9, 4, 3, MSTEEL[3]);
  rect(b, x + 34, base - 8, 2, 8, MSTEEL[2]); put(b, x + 35, base - 8, MSTEEL[0]);
}
function mDrums(b, x, base, n) {        // fuel drums stood in a row
  gshadow(b, x, x + n * 5, base, 4);
  for (let k = 0; k < n; k++) {
    const c = k % 3 === 1 ? PAL('#7fa6d0', '#4f7aa8', '#365a80') : [MOLIVE[0], MOLIVE[1], MOLIVE[3]], dx = x + k * 5, h = k % 4 === 3 ? 6 : 7;
    rect(b, dx, base - h, 4, h, c[1]); rect(b, dx, base - h, 4, 1, c[0]); rect(b, dx + 3, base - h + 1, 1, h - 1, c[0]); rect(b, dx, base - h + 1, 1, h - 1, c[2]); rect(b, dx, base - 4, 4, 1, c[2]);
  }
}
function mAerial(b, x, base, h) {       // a lattice aerial held by guy wires
  for (let y = base - h; y < base; y++) {
    const hw = 1 + round((y - (base - h)) / h * 3);
    put(b, x - hw, y, MSTEEL[3]); put(b, x + hw, y, MSTEEL[1]);
    if ((y & 3) === 0) rect(b, x - hw, y, hw * 2 + 1, 1, MSTEEL[2]); else if ((y & 3) === 2) put(b, x + (((y >> 2) & 1) ? 1 : -1), y, MSTEEL[2]);
  }
  rect(b, x, base - h - 7, 1, 7, MSTEEL[3]); rect(b, x - 2, base - h - 3, 5, 1, MSTEEL[3]);
  for (const sd of [-1, 1]) for (let t = 0; t < 1; t += 0.03) if (((t * 33) | 0) % 3) put(b, x + sd * (2 + t * 20), base - h * 0.7 + t * h * 0.7, I('#7d8376'));
  rect(b, x - 5, base - 1, 11, 2, I('#b8b094'));
  return [x, base - h - 8];
}
function mLogs(b, x, base) {            // sawn logs stacked, pale cut ends toward us
  gshadow(b, x, x + 15, base, 5);
  for (const [dx, dy] of [[0, 0], [5, 0], [10, 0], [2.5, -4], [7.5, -4], [5, -8]]) {
    disc(b, x + dx + 2, base - 2 + dy, 2.4, I('#7a5a3a')); disc(b, x + dx + 2, base - 2 + dy, 1.6, I('#e6ca94')); put(b, x + dx + 2, base - 2 + dy, I('#b89460'));
  }
}
function mBags(b, x, base, n) {         // a sandbag wall, two courses
  gshadow(b, x, x + n * 6, base, 4);
  for (let r = 0; r < 2; r++) for (let k = 0; k < n - r; k++) {
    const bx = x + k * 6 + r * 3, by = base - 3 - r * 3;
    rect(b, bx, by, 6, 3, I('#d8c490')); rect(b, bx, by, 6, 1, I('#f0e2b4')); put(b, bx, by + 2, I('#a88e5c')); put(b, bx + 5, by + 2, I('#a88e5c')); put(b, bx, by, I('#c0aa76'));
  }
}
function mWater(b, x, base) {           // the water tower: a banded tank on a braced stand
  gshadow(b, x - 7, x + 7, base, 10);
  for (const lx of [-6, 6]) rect(b, x + lx, base - 22, 1, 22, lx < 0 ? MWOOD[2] : MWOOD[0]);
  line(b, x - 6, base - 20, x + 6, base - 2, MWOOD[2]); line(b, x + 6, base - 20, x - 6, base - 2, MWOOD[1]); rect(b, x - 6, base - 11, 13, 1, MWOOD[1]);
  rect(b, x - 9, base - 23, 19, 1, MWOOD[0]);
  for (let j = 0; j < 13; j++) for (let i = -8; i <= 8; i++) {
    const u = (i + 8) / 16;
    put(b, x + i, base - 36 + j, j === 0 ? MSTEEL[0] : j === 4 || j === 9 ? MSTEEL[3] : u < 0.18 ? MSTEEL[3] : u < 0.4 ? MSTEEL[2] : u > 0.62 && u < 0.84 ? MSTEEL[0] : MSTEEL[1]);
  }
  for (let i = 0; i < 3; i++) rect(b, x - 9 + i * 3, base - 37 - i, 19 - i * 6, 1, i ? MOLIVE[1] : MOLIVE[3]);
  rect(b, x + 9, base - 30, 1, 14, MSTEEL[3]);
}

// The yard strip (parallax 0.3) is one hand-laid panorama, west to east: jungle, the cut edge and the gate, the
// tent lines, the motor pool, radar and aerial, the kitchen, the east post, jungle again. YW / YE = strip x where the
// clearing begins and ends (the ground's ends at x 1620 and 3060 line up with them at cameras 1510 and 2630).
const YW = 192, YE = 896;
const yFar = x => 177 + round(1.2 * sin(x / 53) + 0.8 * sin(x / 17));
// the bake in four steps: the earth; the cut edge and the far row; the jungle at both ends; the camp itself
function yardGround(b) {
  // the packed earth of the yard, paler toward the jungle; dithered bands
  const bands = [[0, YARD[0]], [6, YARD[1]], [19, YARD[2]], [36, YARD[3]]];
  for (let x = 0; x < b.w; x++) {
    const y0 = yFar(x);
    for (let y = y0; y < b.oy + b.h; y++) {
      const d = y - y0 + (((x + y) & 1) ? 1.5 : -1.5) + (nz(x >> 2, y >> 1) - 0.5) * 3;
      let i = 0;
      while (i + 1 < bands.length && bands[i + 1][0] <= d) i++;
      put(b, x, y, bands[i][1]);
    }
    put(b, x, y0, I('#f6e8ba'));
  }
  // wheel ruts crossing the yard, pale dusty patches, stones, dry tufts
  for (const [ry, a] of [[189, 1.2], [191, 1.2], [207, 2], [211, 2]]) for (let x = YW; x < YE; x++) {
    const y = ry + round(a * sin(x / 71 + ry));
    if (nz(x >> 3, ry) > 0.25) put(b, x, y, I('#bfa068'));
    if (nz(x >> 3, ry + 1) > 0.6) put(b, x, y - 1, I('#f0deaa'));
  }
  for (let i = 0; i < b.w * 0.5; i++) {
    const x = nz(i, 71) * b.w | 0, y = yFar(x) + 2 + (pow(nz(i, 72), 1.3) * 54 | 0), k = nz(i, 73);
    if (k < 0.3) { put(b, x, y, I('#f4e6b8')); put(b, x + 1, y, I('#f4e6b8')); }
    else if (k < 0.5) put(b, x, y, I('#a88c5c'));
    else if (k < 0.78) { put(b, x, y, I('#9aa055')); put(b, x, y - 1, I('#b9b867')); if (k > 0.66) put(b, x + 1, y, I('#7f8748')); }
    else if (k < 0.82) { rect(b, x, y, 2, 1, I('#c9c2ac')); put(b, x, y + 1, YSH); }
  }
}
function yardEdge(b) {
  // grass where the jungle begins again at both ends
  const wildY = x => clamp(max((YW + 38 - x) / 50, (x - (YE - 34)) / 50), 0, 1);
  for (let x = 0; x < b.w; x++) {
    const k = wildY(x);
    if (k > 0) for (let y = yFar(x); y < b.oy + b.h; y++) if (nz(x >> 1, y >> 1) * 0.75 + nz(x, y) * 0.25 < k) put(b, x, y, nz(x >> 2, y) > 0.62 ? I('#8cb45c') : nz(x, y) > 0.5 ? I('#6c9c4c') : I('#5a8a44'));
  }
  // where the jungle was cut: stumps, felled trunks, brush along the far edge
  for (let x = YW - 6; x < YE + 6; x += 9 + (nz(x, 74) * 22 | 0)) {
    const k = nz(x, 75), y = yFar(x) + 1 + (nz(x, 76) * 3 | 0);
    if (k < 0.5) mStump(b, x, y, 3 + (nz(x, 77) * 3 | 0));
    else if (k < 0.62) { rect(b, x, y - 2, 12, 2, I('#8a6a48')); rect(b, x, y - 2, 12, 1, I('#b08c5e')); rect(b, x + 11, y - 2, 1, 2, I('#e6ca94')); rect(b, x - 2, y, 13, 1, YSH); }
    else if (k < 0.8) { disc(b, x, y - 2, 2.4, I('#4f7a46')); disc(b, x + 3, y - 1, 1.8, I('#4f7a46')); put(b, x + 1, y - 4, I('#86ad5c')); put(b, x + 3, y - 3, I('#86ad5c')); }
  }
  // the far row, behind everything: tent lines, fuel tanks, small watchtowers
  const A = x => yFar(x) + 7;
  for (const [x, kind, n] of [[218, 'tents', 4], [322, 'tower'], [350, 'tents', 5], [482, 'tanks', 3], [574, 'tower'], [598, 'tents', 3], [678, 'tanks', 2], [734, 'tents', 4], [840, 'tower']]) {
    if (kind === 'tents') for (let i = 0; i < n; i++) mTent(b, x + i * 23, A(x), 20, 9);
    else if (kind === 'tanks') for (let i = 0; i < n; i++) mTank(b, x + i * 22, A(x), 18);
    else mTower(b, x + 8, A(x) + 1, 30);
  }
  haze(b, HAZE, () => 0.2);
}
function yardWoods(b) {
  const pal = PAL('#123626', '#1f5536', '#2f7546', '#52a254', '#98d66a');
  thicket(b, -8, YW, 204, 144, pal, 31, 4, 9);
  thicket(b, YE, b.w + 8, 204, 144, pal, 47, 4, 9);
  farPalm(b, 60, 150, 20, I('#7d8a62'), pal); farPalm(b, 150, 156, 17, I('#7d8a62'), pal); farPalm(b, YE + 52, 152, 19, I('#7d8a62'), pal);
}
// west to east; returns where the live bits go (strip coordinates)
function yardCamp(b) {
  const live = { dish: [], flag: [], smoke: [], lamp: [] };
  // the cut edge: big stumps, log piles waiting for the trucks, the gate with its guard hut and boom
  for (const [x, w] of [[198, 6], [209, 4], [226, 7], [247, 5], [YE - 12, 6], [YE - 26, 4]]) mStump(b, x, 203 + (x & 1), w, 6);
  mLogs(b, 203, 208); mLogs(b, 252, 210);
  mShed(b, 214, 199); mBarrier(b, 233, 200);
  // the tent lines and the big dark mess tent, the flag on its parade ground
  live.lamp.push(mTower(b, 279, 200, 60));
  mTent(b, 283, 200, 38, 19); mTent(b, 325, 202, 64, 27, TENT_B);
  mDrums(b, 392, 203, 3);
  live.flag.push(mPole(b, 412, 203, 50));
  // the motor pool: a parked truck, crates, the radar bunker, an aerial
  mTruck(b, 437, 201, 1);
  mCrates(b, 499, 203, 7);
  live.dish.push([...mRadar(b, 537, 201), 2.2]);
  live.lamp.push(mAerial(b, 590, 202, 56));
  // the kitchen: searchlight, watchtower, the cookhouse smoking, a tent, the water tower
  mLamp(b, 635, 203, 46, -1);
  live.lamp.push(mTower(b, 659, 200, 62));
  live.smoke.push(mCook(b, 677, 201));
  mTent(b, 729, 201, 46, 22);
  mWater(b, 790, 201);
  // the east post: a hut, sandbags, a searchlight looking toward the river
  mHut(b, 803, 200, 58, 19);
  mBags(b, 860, 204, 5); mLamp(b, 872, 201, 40, 1);
  haze(b, HAZE, () => 0.08);
  return live;
}

// ---------- the fence (parallax 0.6): from the camp gate at the clearing's west edge to its corner by the river ----------
const FW = 308, FE = 1268;             // strip x of the gate post and of the corner post (both on the 48px post grid)
const bank = x => 221 + round(0.9 * sin(x / 37) + 0.7 * sin(x / 13 + 2));     // the top of the bank it stands on
const POST = 48, TOP = 202, FST = PAL('#c9c9ae', '#9a9c84', '#6d705e', '#4a4c40');
const wildF = x => clamp(max((FW + 30 - x) / 64, (x - (FE + 4)) / 64), 0, 1);           // how overgrown the bank is
const BUSH = PAL('#1f5a34', '#2c7440', '#4a9a4c', '#7cc45c', '#b0e070');
// the bake in three steps: what stands behind the mesh, the mesh and the bank; then everything along the fence; then
// the jungle at both ends, the gate and the corner
function fenceStrip(b) {
  // standing behind the mesh: a row of fuel drums, a stack of tyres
  for (let k = 0; k < 6; k++) {
    const dx = 548 + k * 8, y0 = bank(dx) - (k === 4 ? 9 : 11), c = k % 3 === 2 ? PAL('#8fb4dc', '#5f88b8', '#3f6490', '#2c4a70') : [MOLIVE[0], MOLIVE[1], MOLIVE[2], MOLIVE[3]];
    rect(b, dx, y0, 7, bank(dx) - y0, c[1]); rect(b, dx, y0, 7, 1, c[0]); rect(b, dx, y0 + 1, 1, 12, c[3]); rect(b, dx + 1, y0 + 1, 1, 12, c[2]); rect(b, dx + 5, y0 + 1, 1, 12, c[0]); rect(b, dx, y0 + 4, 7, 1, c[2]); rect(b, dx, y0 + 8, 7, 1, c[2]);
    if (k === 1) for (let j = 0; j < 3; j++) put(b, dx + 2 + j, y0 + 6, j & 1 ? HZK : HZY);
  }
  for (let k = 0; k < 4; k++) { const ty = bank(1056) - 2 - k * 4, tx = 1052 + (k & 1); rect(b, tx, ty - 2, 13, 4, I('#2c2c32')); rect(b, tx + 1, ty - 3, 11, 1, I('#44444c')); rect(b, tx + 3, ty - 2, 7, 1, I('#5a5a64')); rect(b, tx + 1, ty + 1, 11, 1, I('#1c1c22')); }
  // the mesh: diamonds of thin wire, see-through; the rails
  for (let x = FW; x <= FE; x++) {
    const yb = bank(x);
    for (let y = TOP + 1; y < yb; y++) if (wrap(x + y, 6) === 0 || wrap(x - y, 6) === 0) put(b, x, y, nz(x, y) > 0.93 ? AL(I('#f2f0dc'), 0.75) : AL(I('#5d5f4c'), 0.5));
    put(b, x, TOP, FST[1]); put(b, x, TOP + 1, AL(FST[3], 0.6)); put(b, x, yb - 2, FST[2]);
  }
  // the bank the fence stands on: dry earth with a pale lip; turf where the jungle begins again
  for (let x = 0; x < b.w; x++) {
    const y0 = bank(x), gk = wildF(x);
    for (let y = y0; y < b.oy + b.h; y++) {
      const d = y - y0, n = nz(x, y);
      let c = d === 0 ? I('#dcc088') : n > 0.95 ? I('#d8ba80') : n < 0.05 ? I('#8c6c44') : d < 3 + (n > 0.5 ? 1 : 0) ? I('#bc965c') : d < 7 + (n > 0.5 ? 1 : 0) ? I('#a8824e') : I('#987444');
      if (gk > 0 && nz(x >> 1, y >> 1) * 0.8 + n * 0.2 < gk) c = d === 0 ? I('#a4d266') : d < 3 ? I('#68a648') : n > 0.5 ? I('#4c8a3c') : I('#3e7634');
      put(b, x, y, c);
    }
  }
}
function fenceLine(b) {
  // clumps of grass along the bank (dry in the camp, green toward the jungle), stones
  for (let x = 0; x < b.w; x++) {
    const g = fbm(x / 9, 71, 2), y0 = bank(x), gr = nz(x >> 2, 70) < wildF(x) * 1.3;
    if (g > 0.52) {
      const h = round((g - 0.5) * 16 * (0.5 + nz(x, 72)));
      for (let k = 0; k <= h; k++) put(b, x, y0 - k, gr ? (k === h ? I('#bce870') : nz(x, k) > 0.5 ? I('#78bc4c') : I('#4e9440')) : (k === h ? I('#e3d27e') : nz(x, k) > 0.5 ? I('#b9b05c') : I('#8f8f48')));
    } else if (nz(x, 73) > 0.93) { rect(b, x, y0 - 1, 2, 1, I('#d8d2c0')); put(b, x, y0, I('#8a7f6a')); }
  }
  // what is left of the jungle that stood here: stumps with pale cut faces (thick by the gate), a stack of logs now and then
  const BK = PAL('#b08a5c', '#8a6844', '#644a30', '#463220');
  for (let x = FW + 14; x < FE - 20; x += (x < FW + 150 ? 22 : 46) + (nz(x, 75) * (x < FW + 150 ? 30 : 80) | 0)) {
    const y0 = bank(x) + 1, k = nz(x, 76);
    if (k < 0.62 || x < FW + 150) {
      const w = 7 + (nz(x, 77) * 5 | 0), h = 5 + (nz(x, 78) * 4 | 0);
      for (let i = -2; i < w + 2; i++) { const fl = i < 0 ? -i : i >= w ? i - w + 1 : 0; for (let j = fl * 2; j < h; j++) put(b, x + i, y0 - h + j, i < 2 ? BK[2] : i > w - 3 ? BK[0] : ((i + (j >> 1)) % 3 ? BK[1] : BK[2])); }
      oval(b, x + (w >> 1), y0 - h, (w >> 1) + 0.5, 1.4, I('#f0d8a4')); rect(b, x + 1, y0 - h, w - 2, 1, I('#dcbc84')); put(b, x + (w >> 1), y0 - h, I('#a88454'));
      rect(b, x - 9, y0, w + 8, 1, I('#8c6c44')); rect(b, x - 6, y0 - 1, 5, 1, I('#8c6c44'));
      if (nz(x, 79) > 0.5) { put(b, x + 1, y0 - h - 2, I('#6cae50')); put(b, x + 1, y0 - h - 3, I('#8cc860')); put(b, x + 2, y0 - h - 3, I('#6cae50')); }   // a shoot growing back
    } else if (k < 0.82) {
      for (const [dx, dy] of [[0, 0], [9, 0], [18, 0], [5, -7], [14, -7]]) {
        disc(b, x + dx + 4, y0 - 4 + dy, 4, BK[2]); disc(b, x + dx + 4, y0 - 4 + dy, 3, I('#e4c890')); disc(b, x + dx + 4, y0 - 4 + dy, 1.6, I('#c8a468')); put(b, x + dx + 4, y0 - 4 + dy, BK[1]); put(b, x + dx + 5, y0 - 6 + dy, I('#f6e4b8'));
      }
      rect(b, x - 8, y0, 34, 1, I('#8c6c44'));
    }
  }
  // a patch of planks nailed over a hole, bushes pushing through
  for (let k = 0; k < 3; k++) { rect(b, 696 + (k & 1) * 2, 207 + k * 4, 13, 3, MWOOD[1]); rect(b, 696 + (k & 1) * 2, 207 + k * 4, 13, 1, MWOOD[0]); put(b, 697 + (k & 1) * 2, 208 + k * 4, MWOOD[3]); put(b, 707 + (k & 1) * 2, 208 + k * 4, MWOOD[3]); }
  for (const bx of [470, 1150, 836]) { crown(b, bx, bank(bx) - 4, 5, BUSH, 1); crown(b, bx + 6, bank(bx) - 2, 3.4, BUSH, 0); }
  // posts with an arm for the barbed wire, concrete feet; a warning plate on some panels
  for (let x = FW; x <= FE; x += POST) {
    const yb = bank(x);
    rect(b, x, TOP - 4, 3, yb - TOP + 5, FST[1]); rect(b, x, TOP - 4, 1, yb - TOP + 5, FST[3]); rect(b, x + 2, TOP - 4, 1, yb - TOP + 5, FST[0]);
    rect(b, x - 1, yb - 1, 5, 2, I('#cfc8b4')); rect(b, x - 1, yb + 1, 5, 1, I('#8a8474'));
    for (let k = 0; k < 4; k++) { put(b, x - 1 - k, TOP - 5 - k, FST[2]); put(b, x - k, TOP - 5 - k, FST[1]); }
    rect(b, x - 1, TOP - 5, 5, 1, FST[2]);
    if (nz(x, 74) > 0.72 && x < FE && x !== 884) {     // yellow diamond, black bang
      const cx = x + 24, cy = 211;
      for (let j = -4; j <= 4; j++) rect(b, cx - (4 - abs(j)), cy + j, (4 - abs(j)) * 2 + 1, 1, abs(j) === 4 ? I('#3a3a36') : I('#f2c832'));
      for (let j = -4; j <= 4; j++) { put(b, cx - (4 - abs(j)), cy + j, I('#3a3a36')); put(b, cx + (4 - abs(j)), cy + j, I('#3a3a36')); }
      rect(b, cx, cy - 2, 1, 3, I('#2a2a28')); put(b, cx, cy + 2, I('#2a2a28'));
    }
  }
  // a locked side gate half way along: a hazard bar across the panel, a no-entry disc
  for (let x = 887; x < 932; x++) { const k = wrap(x, 8) < 4; put(b, x, 206, k ? HZY : HZK); put(b, x, 207, k ? HZY : HZK); put(b, x, 208, k ? I('#c89e1c') : I('#1e1e1c')); }
  disc(b, 909, 215, 4, I('#3a3a36')); disc(b, 909, 215, 3, I('#d8382c')); rect(b, 907, 215, 5, 1, I('#f4f0e4'));
  // coils of barbed wire along the top: overlapping loops, barbs, glints
  for (let x = FW; x <= FE + 2; x += 5) {
    const cy = TOP - 6 - (wrap(x - 20, POST) < 5 ? 1 : 0);
    for (let a = 0; a < 6.28; a += 0.35) {
      const px = x + cos(a) * 4, py = cy + sin(a) * 3.6, front = sin(a + 0.9) > 0;
      if (py < TOP) put(b, px, py, front ? I('#6c6f62') : I('#9a9c8c'));
    }
    put(b, x + 3, cy - 3, I('#f4f2e0')); put(b, x - 1, cy - 4, I('#4a4c44')); put(b, x + 2, cy + 3, I('#4a4c44'));
  }
}
function fenceEnds(b) {
  // the jungle at both ends
  const pal = PAL('#0f3024', '#1b4c32', '#2a6c40', '#4c9c50', '#90d066');
  thicket(b, -8, FW - 52, 225, 136, pal, 61, 6, 13);
  thicket(b, FE + 44, b.w + 8, 225, 136, pal, 67, 6, 13);
  farPalm(b, 96, 150, 40, I('#8a9468'), pal); farPalm(b, 214, 164, 34, I('#8a9468'), pal); farPalm(b, FE + 120, 156, 38, I('#8a9468'), pal);
  // the camp gate at the west end: two timber posts, a beam with the army's board hanging from it, the boom raised
  const GL = FW - 46, gy = bank(GL) + 1, GT = 172, GW = PAL('#d4a868', '#a87c44', '#7c5a30', '#52381e');
  for (const px of [GL, FW - 1]) {
    for (let y = GT; y <= gy; y++) for (let i = 0; i < 5; i++) put(b, px + i, y, i === 0 ? GW[3] : i === 4 ? GW[0] : i === 3 ? GW[1] : nz(px + i, y >> 2) > 0.75 ? GW[3] : GW[2]);
    for (let y = gy - 8; y <= gy; y++) for (let i = 0; i < 5; i++) put(b, px + i, y, wrap(i + y, 4) < 2 ? HZY : HZK);
    rect(b, px + 1, GT - 3, 3, 3, I('#5a1a1a')); rect(b, px + 1, GT - 3, 3, 1, I('#ff5a4a')); put(b, px + 2, GT - 2, I('#ff5a4a'));
  }
  rect(b, GL - 4, GT + 1, FW - GL + 12, 4, GW[1]); rect(b, GL - 4, GT + 1, FW - GL + 12, 1, GW[0]); rect(b, GL - 4, GT + 4, FW - GL + 12, 1, GW[3]);
  const bx0 = GL + 10, by0 = GT + 8;
  rect(b, bx0 + 3, GT + 5, 1, 3, FST[3]); rect(b, bx0 + 26, GT + 5, 1, 3, FST[3]);
  rect(b, bx0, by0, 30, 13, I('#2e2e3e')); rect(b, bx0, by0, 30, 1, I('#5a5a74')); rect(b, bx0, by0 + 12, 30, 1, I('#1c1c28')); rect(b, bx0 + 29, by0, 1, 13, I('#44445a'));
  rect(b, bx0 + 10, by0 + 3, 10, 7, I('#c3cdd8')); rect(b, bx0 + 11, by0 + 2, 8, 1, I('#c3cdd8')); rect(b, bx0 + 10, by0 + 8, 10, 2, I('#8a97a8')); rect(b, bx0 + 12, by0 + 5, 6, 2, I('#ff3b30')); put(b, bx0 + 16, by0 + 5, I('#ffb3a8'));
  for (let k = 0; k < 4; k++) put(b, bx0 + 12 + k * 2, by0 + 9, I('#2e2e3e'));
  for (let k = 0; k < 34; k++) { const px = GL + 5 + k, py = gy - 12 - round(k * 0.42), red = (k >> 2) & 1; put(b, px, py, red ? I('#d8382c') : I('#f4f0e4')); put(b, px, py + 1, red ? I('#a0241c') : I('#c8c4b4')); }
  rect(b, GL + 2, gy - 14, 5, 5, FST[3]); put(b, GL + 4, gy - 12, FST[0]);
  // the corner at the east end: a stay, sandbags, scrub before the trees
  line(b, FE + 3, TOP + 2, FE + 14, bank(FE + 14), FST[2]);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) {
    const sx = FE + 8 + k * 9 + r * 4, sy = bank(sx) - 4 - r * 4;
    rect(b, sx, sy, 9, 4, I('#d8c490')); rect(b, sx, sy, 9, 1, I('#f0e2b4')); rect(b, sx, sy + 3, 9, 1, I('#a88e5c')); put(b, sx, sy, I('#b89e6a')); put(b, sx + 8, sy, I('#b89e6a'));
  }
  for (const bx of [FE + 52, FE + 30]) { crown(b, bx, bank(bx) - 3, 4.4, BUSH, 1); crown(b, bx + 7, bank(bx) - 2, 3, BUSH, 0); }
}

// ============================================================
// The play layer: outlined, three or four tones each, light from the upper right like every Mission 1 sprite
// ============================================================
const WOOD = PAL('#e6b874', '#c8924e', '#a06c34', '#764a24', '#4c2c16');
const ROPE = PAL('#f2dfac', '#cfb072', '#947646');
const CANV = PAL('#bcc47c', '#9ca85e', '#7c8848', '#5e6a36', '#404a28', '#22281a');
const BAG = PAL('#f6e6b6', '#e4cc92', '#c8aa6e', '#a0824c', '#705832');
const JEEP = PAL('#a2b060', '#7e8e48', '#5e6c36', '#424e28', '#2a321a');
const STL = PAL(METL, MET, METD, METDD);
const GRASS = PAL('#ecdc8a', '#c4b860', '#96944a', '#6c7038');
const JG = PAL('#c8f06c', '#90d84c', '#5eba3e', '#3c9438', '#2a7030');   // the jungle's grass, where it still grows at the camp's west edge
const RED = PAL('#ff6a5a', '#e03a2c', '#a0241c');

// a horizontal plank: lit top edge, grain, dark underside; butt joints with nails
function plank(b, x, y, w, h, seed) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const n = nz((x + i) >> 2, y + j + seed * 7);
    let c = j === 0 ? WOOD[0] : j === h - 1 ? WOOD[3] : j === h - 2 && h > 3 ? WOOD[2] : WOOD[1];
    if (j > 0 && j < h - 1 && n > 0.8) c = WOOD[2];
    put(b, x + i, y + j, c);
  }
  for (let k = x + 9 + (nz(seed, 1) * 8 | 0); k < x + w - 6; k += 13 + (nz(k, seed) * 9 | 0)) {
    rect(b, k, y + 1, 1, h - 1, WOOD[4]);
    if (h > 2) { put(b, k - 2, y + (h >> 1), WOOD[4]); put(b, k + 2, y + (h >> 1), WOOD[4]); }
  }
}
// a vertical post: lit on the right, shaded on the left, long grain
function post(b, x, y, w, h, seed) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const n = nz(x + i + seed * 5, (y + j) >> 2);
    let c = i === 0 ? WOOD[3] : i === w - 1 ? WOOD[0] : i === w - 2 && w > 3 ? WOOD[1] : WOOD[2];
    if (i > 0 && i < w - 1 && n > 0.8) c = i === w - 2 ? WOOD[2] : WOOD[3];
    put(b, x + i, y + j, c);
  }
}
function bolt(b, x, y) { rect(b, x, y, 2, 2, STL[3]); put(b, x + 1, y, STL[0]); }
// a diagonal brace two pixels thick: the front one is lit along its upper edge
function brace(b, x0, y0, x1, y1, front) {
  line(b, x0, y0, x1, y1, front ? WOOD[2] : WOOD[3], 2);
  line(b, x0, y0, x1, y1, front ? WOOD[1] : WOOD[4], 1);
}
function lash(b, x, y, w) { rect(b, x, y, w, 3, ROPE[1]); rect(b, x, y, w, 1, ROPE[0]); rect(b, x, y + 2, w, 1, ROPE[2]); put(b, x + w - 2, y + 1, ROPE[0]); }
// dry grass in front of the foot of something (painted after the outline)
function tufts(b, x0, x1, gy, seed, P) {
  P = P || GRASS;
  for (let x = x0; x < x1; x++) {
    const n = nz(x, seed);
    if (n < 0.45) continue;
    const h = 1 + (n * n * 5 | 0);
    for (let k = 0; k < h; k++) put(b, x, gy - k, k === h - 1 ? P[0] : k > 1 ? P[1] : P[2]);
  }
}
// rows y0..y1: everything drawn gets a step darker (the shade under a deck or a roof)
function shadeRows(b, y0, y1, k, x0, x1) {
  for (let y = y0; y < y1; y++) for (let x = (x0 == null ? b.ox : x0); x < (x1 == null ? b.ox + b.w : x1); x++) { const c = get(b, x, y); if (c !== NONE) put(b, x, y, mixI(c, WOOD[4], k)); }
}

// ---------- platforms: baked once each; the top edge is exactly pl.y from pl.x to pl.x + pl.w ----------
// planks on timber legs: joists, cross braces with bolts, rope lashings, a knotted rope hanging off one end
function platScaffold(pl) {
  const L0 = pl.x, T = pl.y, w = pl.w, b = buf(w + 20, GROUND + 5 - (T - 3), L0 - 10, T - 3);
  const legs = w > 76 ? [L0 + 4, L0 + (w >> 1) - 2, L0 + w - 9] : [L0 + 4, L0 + w - 9];
  for (let k = 0; k + 1 < legs.length; k++) {
    const a = legs[k] + 3, e = legs[k + 1] + 1;
    rect(b, a, GROUND - 13, e - a, 3, WOOD[3]); rect(b, a, GROUND - 13, e - a, 1, WOOD[2]);         // tie beam
    brace(b, a, T + 9, e, GROUND - 5, false);
    brace(b, e, T + 9, a, GROUND - 5, true);
    bolt(b, (a + e) >> 1, (T + 9 + GROUND - 5) >> 1);
  }
  for (const lx of legs) {
    post(b, lx, T + 5, 5, GROUND + 1 - (T + 5), lx);
    rect(b, lx - 1, GROUND - 2, 7, 3, WOOD[3]); rect(b, lx - 1, GROUND - 2, 7, 1, WOOD[2]);        // footing block
    lash(b, lx, T + 10, 5); lash(b, lx, GROUND - 9, 5);
    bolt(b, lx + 2, T + 16);
  }
  rect(b, L0 + 2, T + 5, w - 4, 3, WOOD[3]); rect(b, L0 + 2, T + 5, w - 4, 1, WOOD[4]);            // joist in the deck's shade
  for (let k = L0 + 8; k < L0 + w - 6; k += 12) rect(b, k, T + 5, 2, 3, WOOD[4]);
  shadeRows(b, T + 8, T + 13, 0.3);
  plank(b, L0, T, w, 5, L0);
  rect(b, L0, T + 1, 2, 3, I('#f0cc92')); rect(b, L0 + w - 2, T + 1, 2, 3, I('#f0cc92'));          // end grain
  // the climbing rope
  const rx = L0 + w + 2;
  for (let y = T + 2; y < GROUND - 6; y++) put(b, rx + (((y - T) >> 3) & 1 ? 0 : 0), y, (y - T) % 7 === 3 ? ROPE[0] : ROPE[1]);
  for (let y = T + 5; y < GROUND - 6; y += 7) rect(b, rx - 1, y, 3, 2, ROPE[1]);
  rect(b, L0 + w - 1, T + 1, 4, 1, ROPE[1]);
  outline(b);
  for (const lx of legs) tufts(b, lx - 4, lx + 9, GROUND, lx);
  return mk(b);
}
// the watchtower: braced legs, a ladder, a boarded rail, a tin roof with a hazard fascia, a searchlight
function platTower(pl) {
  const L0 = pl.x, T = pl.y, w = pl.w, b = buf(w + 40, GROUND + 5 - (T - 64), L0 - 20, T - 64);
  const l1 = L0 + 2, l2 = L0 + w - 7, mid = T + 24;
  // ladder up the left side
  for (let y = GROUND - 3; y > T + 4; y -= 5) { const k = (GROUND - y) / (GROUND - T), lx = L0 - 12 + round(k * 8); rect(b, lx, y, 7, 1, WOOD[2]); }
  line(b, L0 - 12, GROUND, L0 - 4, T + 2, WOOD[1]); line(b, L0 - 6, GROUND, L0 + 2, T + 2, WOOD[3]);
  // braces in two storeys
  for (const [y0, y1] of [[T + 8, mid - 1], [mid + 4, GROUND - 4]]) {
    brace(b, l1 + 4, y0, l2, y1, false); brace(b, l2, y0, l1 + 4, y1, true);
    bolt(b, (l1 + l2 + 4) >> 1, (y0 + y1) >> 1);
  }
  rect(b, l1 + 4, mid, l2 - l1 - 4, 4, WOOD[2]); rect(b, l1 + 4, mid, l2 - l1 - 4, 1, WOOD[1]); rect(b, l1 + 4, mid + 3, l2 - l1 - 4, 1, WOOD[4]);
  for (const lx of [l1, l2]) {
    post(b, lx, T + 5, 5, GROUND + 1 - (T + 5), lx);
    rect(b, lx - 1, GROUND - 2, 7, 3, I('#b8b094')); rect(b, lx - 1, GROUND - 2, 7, 1, I('#ded6ba'));   // concrete feet
    bolt(b, lx + 2, mid + 1); lash(b, lx, T + 11, 5);
  }
  rect(b, L0, T + 5, w, 3, WOOD[3]); rect(b, L0, T + 5, w, 1, WOOD[4]);
  shadeRows(b, T + 8, T + 14, 0.3, L0 - 2, L0 + w + 2);
  // the cabin behind whoever stands guard: boarded rail, corner posts, the roof on top
  for (let k = L0 - 2; k < L0 + w + 2; k += 4) { const tone = nz(k, 5) > 0.5; rect(b, k, T - 9, 4, 9, tone ? WOOD[2] : WOOD[1]); rect(b, k, T - 9, 1, 9, WOOD[3]); put(b, k + 2, T - 7, WOOD[4]); put(b, k + 2, T - 2, WOOD[4]); }
  rect(b, L0 - 3, T - 12, w + 6, 3, WOOD[1]); rect(b, L0 - 3, T - 12, w + 6, 1, WOOD[0]); rect(b, L0 - 3, T - 10, w + 6, 1, WOOD[3]);
  for (const px of [L0 - 2, L0 + w - 1]) { post(b, px, T - 42, 3, 30, px); }
  rect(b, L0 + (w >> 1) - 1, T - 42, 2, 30, WOOD[3]);
  // the roof: corrugated tin, olive paint going rusty, lit toward the sun
  const TIN = PAL('#b4bc74', '#939e58', '#727e44', '#535e32', '#3a4426');
  const px0 = L0 - 12, px1 = L0 + w + 12, peak = L0 + (w >> 1), rh = 15;
  for (let i = 0; i <= rh; i++) {
    const k = i / rh, xa = round(lerp(peak - 3, px0, k)), xb = round(lerp(peak + 3, px1, k)), y = T - 57 + i;
    for (let x = xa; x <= xb; x++) {
      const right = x > peak, rib = wrap(x - peak, 4) === 0;
      let c = right ? (rib ? TIN[2] : i < 2 ? TIN[0] : TIN[1]) : (rib ? TIN[4] : i < 2 ? TIN[1] : TIN[3]);
      if (nz(x, 7) > 0.78 && i > 2 + (nz(x, 8) * 5 | 0) && i < 6 + (nz(x, 9) * 9 | 0)) c = right ? I('#b0884e') : I('#7a5c34');
      put(b, x, y, c);
    }
  }
  rect(b, peak - 4, T - 58, 9, 2, TIN[0]); rect(b, peak - 4, T - 57, 9, 1, TIN[2]);
  for (let x = px0; x <= px1; x++) { const k = wrap(x - px0, 8) < 4; put(b, x, T - 41, k ? HZY : HZK); put(b, x, T - 40, k ? I('#c89e1c') : I('#1e1e1c')); }
  shadeRows(b, T - 39, T - 34, 0.35, L0 - 3, L0 + w + 3);
  // searchlight on the sunny corner post
  const sx = L0 + w + 2, sy = T - 36;
  rect(b, sx - 2, sy + 2, 3, 2, STL[3]);
  rect(b, sx, sy - 2, 7, 7, STL[2]); rect(b, sx, sy - 2, 7, 1, STL[0]); rect(b, sx, sy + 4, 7, 1, STL[3]);
  rect(b, sx + 6, sy - 1, 2, 5, I('#fff3b8')); rect(b, sx + 7, sy, 1, 3, I('#ffffff')); rect(b, sx + 2, sy, 2, 1, STL[0]);
  plank(b, L0 - 3, T, w + 6, 5, L0 + 3);
  rect(b, L0 - 3, T + 1, 2, 3, I('#f0cc92')); rect(b, L0 + w + 1, T + 1, 2, 3, I('#f0cc92'));
  outline(b);
  tufts(b, l1 - 5, l1 + 9, GROUND, 31); tufts(b, l2 - 3, l2 + 10, GROUND, 32);
  return mk(b);
}
// supply crates stacked two high: framed boards, a brace, nails, stencils
function platCrates(pl) {
  const L0 = pl.x, T = pl.y, w = pl.w, b = buf(w + 12, GROUND + 5 - (T - 3), L0 - 6, T - 3);
  for (let y = T, r = 0; y < GROUND; y += 16, r++) for (let x = L0, c = 0; x < L0 + w; x += 16, c++) {
    const s = nz(x, y), olive = s > 0.72, P = olive ? [JEEP[0], JEEP[1], JEEP[2], JEEP[3], JEEP[4]] : WOOD;
    const cw = min(16, L0 + w - x), ch = min(16, GROUND - y);
    rect(b, x, y, cw, ch, P[2]);
    for (let k = x + 3; k < x + cw - 2; k += 3) rect(b, k, y + 2, 1, ch - 4, P[3]);
    rect(b, x, y, cw, 2, P[0]); rect(b, x, y + ch - 2, cw, 2, P[3]); rect(b, x, y + 2, 2, ch - 4, P[1]); rect(b, x + cw - 2, y + 2, 2, ch - 4, P[0]);
    rect(b, x, y + 1, cw, 1, P[1]);
    if (!olive && s > 0.3) { line(b, x + 2, y + ch - 3, x + cw - 4, y + 2, P[1], 2); line(b, x + 2, y + ch - 3, x + cw - 4, y + 2, P[0], 1); }
    else if (olive) { rect(b, x + 3, y + 6, cw - 6, 4, HZY); for (let k = x + 3; k < x + cw - 3; k++) if (wrap(k, 4) < 2) rect(b, k, y + 6, 1, 4, HZK); }
    else { rect(b, x + 6, y + 5, 4, 1, P[4]); rect(b, x + 5, y + 6, 6, 3, P[4]); rect(b, x + 7, y + 7, 2, 1, RED[1]); rect(b, x + 6, y + 9, 4, 1, P[4]); }
    for (const [nx, ny] of [[1, 1], [cw - 2, 1], [1, ch - 2], [cw - 2, ch - 2]]) put(b, x + nx, y + ny, P[4]);
    rect(b, x + cw - 1, y, 1, ch, P[4]); rect(b, x, y + ch - 1, cw, 1, P[4]);
  }
  outline(b);
  tufts(b, L0 - 3, L0 + 5, GROUND, 41); tufts(b, L0 + w - 4, L0 + w + 4, GROUND, 42);
  return mk(b);
}
const PLATS = new Map();
function platArt(pl) {
  let s = PLATS.get(pl);
  if (!s) { s = (pl.t === 'tower' ? platTower : pl.t === 'crates' ? platCrates : platScaffold)(pl); PLATS.set(pl, s); }
  return s;
}

// ---------- decor sprites (anchor: the foot, x centre on the ground line) ----------
// a canvas ridge tent: the gable with its door flaps on the left, the long sunlit side, guy ropes and pegs
function tentBuf(v) {
  const b = buf(104, 52, -52, -48);
  const A = [-10, -38], Rg = [22, -36];
  // sunlit side panel
  poly(b, [[A[0], A[1]], [Rg[0] + 1, Rg[1]], [37, 1], [16, 1]], CANV[1]);
  for (let y = -38; y <= 0; y++) for (let x = -12; x <= 37; x++) {
    if (get(b, x, y) !== CANV[1]) continue;
    const n = nz(x, y + 900), dTop = y + 38 - (x - A[0]) * (Rg[1] - A[1]) / (Rg[0] - A[0]);
    put(b, x, y, dTop < 3 ? CANV[0] : dTop < 5 && ((x + y) & 1) ? CANV[0] : y > -4 ? CANV[3] : y > -8 ? CANV[2] : y > -12 && ((x + y) & 1) ? CANV[2] : n > 0.975 ? CANV[0] : CANV[1]);
  }
  for (const k of [0.3, 0.62]) line(b, lerp(A[0], Rg[0], k), lerp(A[1], Rg[1], k) + 1, lerp(16, 36, k), 0, CANV[2]);                 // seams
  line(b, Rg[0] + 1, Rg[1], 37, 0, CANV[0]);
  if (v !== 1) { rect(b, 0, -24, 6, 5, CANV[2]); rect(b, 0, -24, 6, 1, CANV[3]); put(b, 1, -22, CANV[0]); put(b, 4, -21, CANV[0]); }   // a patch
  if (v === 1) { rect(b, 18, -12, 5, 4, CANV[2]); rect(b, 18, -12, 5, 1, CANV[3]); rect(b, 2, -29, 9, 6, CANV[4]); rect(b, 3, -28, 7, 4, I('#3a4a52')); rect(b, 3, -28, 7, 1, I('#9fc0cc')); }   // a mesh window instead
  if (v === 2) for (let k = 0; k < 3; k++) rect(b, -4 + k * 9, -9 - k, 5, 1, I('#d8c890'));   // washing laid out to dry
  if (v !== 1) { rect(b, 12, -18, 9, 7, CANV[3]); rect(b, 13, -19, 7, 1, CANV[3]); }
  if (v !== 1) rect(b, 13, -17, 7, 5, I('#c8d0da')); rect(b, 14, -16, 5, 2, RED[1]); put(b, 17, -16, RED[0]); for (let k = 14; k < 19; k += 2) put(b, k, -13, CANV[5]);   // the army's robot head, stencilled
  // gable in half shade
  poly(b, [[-36, 1], [A[0], A[1] - 0.5], [A[0] + 1, A[1] - 0.5], [17, 1]], CANV[2]);
  for (let y = -38; y <= 0; y++) for (let x = -36; x <= 16; x++) {
    if (get(b, x, y) !== CANV[2]) continue;
    const n = nz(x, y + 800), edge = get(b, x - 1, y) === NONE || get(b, x - 2, y) === NONE;
    if (edge) put(b, x, y, CANV[3]); else if (y > -5) put(b, x, y, CANV[4]); else if (y > -9 && ((x + y) & 1)) put(b, x, y, CANV[3]); else if (n > 0.975) put(b, x, y, CANV[1]);
  }
  line(b, A[0] + 1, A[1], 16, 0, CANV[1]);
  // the door: dark inside, flaps tied back
  poly(b, [[-19, 1], [A[0], -27], [A[0] + 1, -27], [-1, 1]], CANV[5]);
  line(b, -19, 0, A[0], -27, CANV[1]); line(b, -20, 0, A[0] - 1, -27, CANV[1]); line(b, -1, 0, A[0] + 1, -27, CANV[4]);
  rect(b, -15, -5, 6, 5, I('#5a4326')); rect(b, -15, -5, 6, 1, I('#8a6a3c')); rect(b, -8, -3, 4, 3, I('#39422a'));                    // a crate and a bedroll inside
  put(b, -16, -12, ROPE[1]); put(b, -5, -12, ROPE[1]);
  // ridge pole
  rect(b, A[0], -43, 2, 6, WOOD[2]); put(b, A[0] + 1, -43, WOOD[0]); rect(b, Rg[0], Rg[1] - 4, 2, 4, WOOD[2]); put(b, Rg[0] + 1, Rg[1] - 4, WOOD[0]);
  outline(b);
  // guy ropes and pegs
  for (const [x0, y0, x1] of [[A[0] - 1, -41, -47], [Rg[0] + 2, -38, 47], [-30, -8, -42], [30, -17, 43]]) {
    line(b, x0, y0, x1, -1, ROPE[1]);
    rect(b, x1 - 1, -3, 2, 4, WOOD[3]); put(b, x1, -3, WOOD[1]);
  }
  tufts(b, -40, -30, 0, 51); tufts(b, 30, 44, 0, 52);
  return b;
}
// one sandbag: sagging, lit top, stitched end
function bag(b, x, y, w, h, seed) {
  for (let j = 0; j < h; j++) {
    const inset = j === 0 ? 2 : j === 1 || j === h - 1 ? 1 : 0;
    for (let i = inset; i < w - inset; i++) {
      const n = nz(x + i, y + j + seed);
      let c = j < 2 ? BAG[0] : j >= h - 2 ? BAG[2] : BAG[1];
      if (i >= w - inset - 2 && j > 0 && j < h - 1) c = BAG[0];
      if (i <= inset) c = BAG[3];
      if (j === h - 1) c = BAG[3];
      if (n > 0.9 && j > 1) c = BAG[2];
      put(b, x + i, y + j, c);
    }
  }
  const sx = x + 2 + (nz(seed, 3) > 0.5 ? 0 : w - 6);
  for (let j = 1; j < h - 1; j += 2) put(b, sx + 1, y + j, BAG[4]);
  put(b, x + (w >> 1), y + h - 2, BAG[3]);
  // the seam between this bag and whatever it touches
  for (let i = 1; i < w - 1; i++) if (get(b, x + i, y + h) !== NONE) put(b, x + i, y + h, BAG[4]);
}
function sandbagsBuf(rows, seed) {
  const n0 = rows[0], b = buf(n0 * 12 + 12, rows.length * 6 + 8, -(n0 * 6 + 6), -(rows.length * 6 + 6));
  for (let r = 0; r < rows.length; r++) {
    const n = rows[r], x0 = -round(n * 6) + (r & 1 ? 1 : 0);
    for (let i = 0; i < n; i++) bag(b, x0 + i * 12 + (nz(i, r + seed) > 0.6 ? 1 : 0), -6 - r * 6, 12, 7, seed + r * 5 + i);
  }
  // dark gaps between neighbours
  for (let y = b.oy; y < 1; y++) for (let x = b.ox; x < b.ox + b.w; x++) if (get(b, x, y) === BAG[3] && get(b, x - 1, y) !== NONE && get(b, x + 1, y) !== NONE && get(b, x - 1, y) !== BAG[3]) put(b, x, y, BAG[4]);
  outline(b);
  tufts(b, b.ox + 2, b.ox + 10, 0, seed + 61); tufts(b, -b.ox - 12, -b.ox - 4, 0, seed + 62);
  return b;
}
// an oil drum: ribs, a lit stripe, a rim; `band` paints a hazard band round it
function drum(b, x, y, w, h, P, band) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const t = i / (w - 1);
    let c = t < 0.12 ? P[3] : t < 0.3 ? P[2] : t > 0.9 ? P[2] : t > 0.62 && t < 0.8 ? P[0] : P[1];
    if (j === 0) c = (i === 0 || i === w - 1) ? NONE : P[0];
    else if (j === 1) c = t > 0.5 ? P[1] : P[2];
    else if (j === h - 1) c = (i === 0 || i === w - 1) ? NONE : P[3];
    else if (j === round(h * 0.36) || j === round(h * 0.68)) c = t > 0.62 && t < 0.8 ? P[1] : P[3];
    else if (band && j > h * 0.42 && j < h * 0.64) c = wrap(i + j, 4) < 2 ? (t < 0.3 ? I('#b8961c') : HZY) : HZK;
    else if (nz(x + i, y + j) > 0.94) c = P[2];
    if (c !== NONE) put(b, x + i, y + j, c);
  }
}
const DRUM_BLUE = PAL('#7fb0e0', '#4f80b8', '#365e90', '#244468'), DRUM_OLIVE = [JEEP[0], JEEP[1], JEEP[2], JEEP[4]], DRUM_YEL = PAL('#ffe27a', '#e8b830', '#b88a1c', '#7c5a14');
function drumsBuf() {
  const b = buf(46, 36, -23, -34);
  drum(b, -6, -30, 11, 15, DRUM_YEL, true);
  drum(b, -18, -15, 11, 15, DRUM_BLUE, false); drum(b, -6, -15, 11, 15, DRUM_OLIVE, false); drum(b, 6, -15, 11, 15, DRUM_BLUE, false);
  rect(b, -16, -10, 3, 3, I('#eef2f4')); put(b, -15, -9, DRUM_BLUE[2]);
  rect(b, 9, -9, 4, 2, I('#eef2f4'));
  for (let k = 0; k < 4; k++) put(b, -2, -13 + k * 2, I('#2a2a22'));                   // an oil dribble
  outline(b);
  rect(b, -20, 0, 9, 1, I('#3a3226')); rect(b, -18, 1, 5, 1, I('#3a3226'));            // a dark puddle
  tufts(b, 14, 22, 0, 71);
  return b;
}
// the jeep, parked nose to the right: open tub, spare wheel and jerry can at the back, a whip aerial
function jeepBuf() {
  const b = buf(80, 50, -42, -46), J = JEEP;
  // chassis and exhaust
  rect(b, -24, -10, 46, 3, J[4]); rect(b, -35, -8, 6, 2, STL[2]); put(b, -35, -8, STL[0]);
  // tub: rear body with the dip of the door opening
  for (let x = -31; x <= 7; x++) {
    const dip = x >= -9 && x <= 3 ? round(4 * sin((x + 9) / 12 * PI)) : 0, top = -20 + dip;
    for (let y = top; y <= -9; y++) put(b, x, y, y === top ? J[0] : y < -15 ? J[1] : y < -11 ? J[2] : J[3]);
  }
  // hood and front
  for (let x = 8; x <= 30; x++) {
    const top = -21 + (x > 27 ? x - 27 : 0);
    for (let y = top; y <= -9; y++) put(b, x, y, y === top ? J[0] : y === top + 1 ? J[1] : y < -14 ? J[1] : y < -11 ? J[2] : J[3]);
  }
  rect(b, 8, -21, 1, 12, J[3]); rect(b, -10, -15, 1, 6, J[3]); rect(b, 4, -15, 1, 6, J[3]);                  // panel lines
  for (let y = -18; y <= -11; y += 2) rect(b, 29, y, 2, 1, J[4]);                                          // grille
  rect(b, 30, -11, 4, 3, STL[2]); rect(b, 30, -11, 4, 1, STL[0]);                                          // bumper
  rect(b, 25, -19, 4, 4, STL[3]); rect(b, 26, -18, 3, 3, I('#fff3b8')); put(b, 28, -18, I('#ffffff'));      // headlight
  rect(b, 10, -15, 17, 1, J[0]); rect(b, 10, -14, 17, 1, J[3]);                                            // front wing
  for (let k = 12; k < 26; k += 4) put(b, k, -18, J[3]);
  rect(b, 14, -20, 7, 1, J[2]);
  // rear wing, stowed shovel, the army's eye on the side
  rect(b, -29, -15, 20, 1, J[0]); rect(b, -29, -14, 20, 1, J[3]);
  rect(b, -27, -12, 13, 1, WOOD[1]); rect(b, -14, -13, 4, 3, STL[1]); put(b, -11, -13, STL[0]);
  rect(b, -4, -13, 5, 4, I('#d8dccb')); rect(b, -3, -12, 3, 2, J[4]); put(b, -2, -12, RED[1]);
  // wheel arches
  for (const cx of [-18, 17]) for (let a = PI; a <= PI * 2 + 0.01; a += 0.06) { const ax = cx + cos(a) * 8, ay = -6 + sin(a) * 8; rect(b, ax, ay, 1, max(0, -8 - ay), J[4]); }
  // windscreen frame, glass edge, steering wheel, seats
  line(b, 7, -21, 4, -32, STL[3], 2); line(b, 7, -22, 4, -32, STL[1], 1); rect(b, 3, -33, 4, 2, STL[2]); put(b, 6, -33, STL[0]);
  line(b, 6, -23, 4, -30, I('#bfe6f0'));
  rect(b, 0, -24, 1, 4, STL[3]); rect(b, -2, -26, 4, 1, STL[3]); put(b, -3, -25, STL[3]); put(b, 2, -25, STL[3]); rect(b, -2, -24, 4, 1, STL[3]);
  rect(b, -9, -28, 4, 9, I('#8a744a')); rect(b, -9, -28, 4, 1, I('#c0a66c')); rect(b, -6, -27, 1, 8, I('#c0a66c')); rect(b, -9, -28, 1, 9, I('#5e4e30'));
  rect(b, -24, -24, 5, 5, I('#8a744a')); rect(b, -24, -24, 5, 1, I('#c0a66c')); rect(b, -24, -24, 1, 5, I('#5e4e30'));
  rect(b, 11, -31, 2, 10, STL[2]); rect(b, 12, -31, 1, 10, STL[0]); rect(b, 10, -32, 4, 1, STL[3]); rect(b, 10, -24, 4, 1, STL[3]);   // exhaust stack
  // rolled canvas top, jerry can, spare wheel at the back
  rect(b, -32, -23, 8, 3, CANV[2]); rect(b, -32, -23, 8, 1, CANV[0]); put(b, -29, -22, CANV[4]); put(b, -26, -22, CANV[4]);
  rect(b, -37, -22, 4, 13, I('#23232b')); rect(b, -36, -22, 1, 13, I('#4a4a55')); for (let y = -21; y < -9; y += 2) put(b, -34, y, I('#3a3a44'));
  rect(b, -33, -19, 2, 9, J[3]);
  // whip aerial with a little red pennant
  line(b, -29, -20, -32, -45, STL[3]); rect(b, -32, -44, 4, 3, RED[1]); put(b, -29, -43, RED[0]); put(b, -28, -43, RED[2]);
  // wheels
  for (const cx of [-18, 17]) {
    disc(b, cx, -6, 6, I('#23232b'));
    for (let a = 0; a < 6.28; a += 0.52) put(b, cx + cos(a) * 6, -6 + sin(a) * 6, I('#3a3a44'));
    for (let a = -1.3; a < 0.2; a += 0.2) put(b, cx + cos(a) * 5, -6 + sin(a) * 5, I('#55555f'));
    disc(b, cx, -6, 3, J[2]); disc(b, cx, -6, 2, J[1]); put(b, cx + 1, -8, J[0]); rect(b, cx - 1, -7, 2, 2, STL[3]); put(b, cx, -7, STL[0]);
  }
  outline(b);
  return b;
}
// the radio mast: a steel lattice on a concrete foot, dishes and aerials, a control box with hazard paint
function radioBuf() {
  const b = buf(96, 134, -48, -130), TOPY = -110;
  const lx = y => round(lerp(-9, -2, y / TOPY)), rx = y => round(lerp(9, 2, y / TOPY));
  for (let y = -4; y > TOPY; y -= 10) {
    const y1 = max(TOPY, y - 10);
    line(b, lx(y) + 1, y, rx(y1), y1, STL[3]); line(b, rx(y), y, lx(y1) + 1, y1, STL[2]);
    rect(b, lx(y1), y1, rx(y1) - lx(y1) + 1, 1, STL[2]);
  }
  for (let y = -4; y >= TOPY; y--) { rect(b, lx(y) - 1, y, 2, 1, STL[2]); put(b, lx(y) - 1, y, STL[3]); rect(b, rx(y), y, 2, 1, STL[1]); put(b, rx(y) + 1, y, STL[0]); }
  rect(b, -5, TOPY - 2, 11, 2, STL[2]); rect(b, -5, TOPY - 2, 11, 1, STL[0]);
  rect(b, 0, TOPY - 14, 1, 12, STL[2]); rect(b, -4, TOPY - 7, 9, 1, STL[2]); rect(b, -3, TOPY - 11, 7, 1, STL[2]);
  // a dish and a drum aerial
  disc(b, -9, -78, 5, STL[1]); disc(b, -8, -79, 3.4, STL[0]); put(b, -9, -78, STL[3]); rect(b, -4, -78, 3, 1, STL[3]);
  rect(b, 6, -62, 5, 8, I('#e6e8dc')); rect(b, 6, -62, 5, 1, I('#ffffff')); rect(b, 6, -55, 5, 1, STL[1]); rect(b, 4, -59, 2, 1, STL[3]);
  // foot and control box
  rect(b, -13, -5, 27, 5, I('#b8b094')); rect(b, -13, -5, 27, 1, I('#ded6ba')); rect(b, -13, -1, 27, 1, I('#8f8870'));
  for (let x = -13; x < 14; x++) put(b, x, -3, wrap(x, 6) < 3 ? HZY : HZK);
  rect(b, 16, -15, 14, 15, JEEP[2]); rect(b, 16, -15, 14, 2, JEEP[0]); rect(b, 28, -13, 2, 13, JEEP[1]); rect(b, 16, -13, 1, 13, JEEP[4]);
  for (let y = -11; y < -6; y += 2) rect(b, 18, y, 6, 1, JEEP[4]);
  put(b, 26, -11, I('#5fe08a')); rect(b, 18, -4, 9, 2, HZY); for (let x = 18; x < 27; x += 4) rect(b, x, -4, 2, 2, HZK);
  outline(b);
  // guy wires
  for (const s of [-1, 1]) for (let t = 0; t < 1; t += 0.012) { const x = lerp(s * 3, s * 44, t), y = lerp(-92, -1, t); if (((t * 80) | 0) % 5 !== 4) put(b, x, y, I('#4a505a')); }
  rect(b, -46, -2, 3, 3, STL[2]); rect(b, 43, -2, 3, 3, STL[2]);
  return b;
}
function flagpoleBuf() {
  const b = buf(24, 92, -12, -88);
  rect(b, 0, -80, 2, 80, STL[1]); rect(b, 0, -80, 1, 80, STL[2]); rect(b, 1, -80, 1, 30, STL[0]);
  disc(b, 0.5, -82, 1.6, I('#f0c62e')); put(b, 1, -83, I('#fff0a0'));
  for (const [x, y, w] of [[-8, -6, 9], [0, -6, 9], [-4, -11, 9]]) bag(b, x, y, w, 6, x + 7);
  outline(b);
  for (let y = -76; y < -12; y++) if (y % 3) put(b, 3, y, ROPE[2]);
  return b;
}
function signBuf(arrow, green) {
  const b = buf(56, 44, -28, -40);
  post(b, -2, -24, 4, 25, 3);
  rect(b, -4, -2, 8, 3, I('#b8b094')); rect(b, -4, -2, 8, 1, I('#ded6ba'));
  for (let r = 0; r < 2; r++) {
    const y = -36 + r * 7, x0 = -23 - (r ? 1 : 0), w = 46 + (r ? 1 : -1);
    plank(b, x0, y, w, 7, r + 9);
    put(b, x0 + 2, y + 3, WOOD[4]); put(b, x0 + w - 3, y + 3, WOOD[4]);
  }
  rect(b, -24, -30, 48, 1, WOOD[3]);
  if (arrow) { poly(b, [[23, -37], [29, -29.5], [23, -22]], WOOD[1]); line(b, 23, -37, 29, -30, WOOD[0]); line(b, 23, -22, 29, -29, WOOD[3]); }
  outline(b);
  tufts(b, -9, -3, 0, 81, green ? JG : GRASS); tufts(b, 4, 9, 0, 82, green ? JG : GRASS);
  return b;
}
const STUMPS = [[1631, 0], [1648, 1]];   // [world x, sprite]: what the area adds to its decor, at the clearing's edge
// a cut stump at the clearing's edge: bark, a pale face with rings, flared roots; one still has the axe in it
function stumpBuf(w, h, axe) {
  const b = buf(w + 28, h + 24, -(w >> 1) - 12, -h - 20), BK = PAL('#b88e5e', '#8e6a44', '#664a30', '#463220'), x0 = -(w >> 1);
  for (let i = -3; i < w + 3; i++) {
    const fl = i < 0 ? -i : i >= w ? i - w + 1 : 0;
    for (let j = fl * 2; j <= h; j++) put(b, x0 + i, -h + j, i < 2 ? BK[2] : i > w - 3 ? BK[0] : ((i + (j >> 1)) % 3 ? BK[1] : BK[2]));
  }
  oval(b, x0 + (w - 1) / 2, -h, (w >> 1) + 0.5, 1.6, I('#f2dca8')); rect(b, x0 + 1, -h, w - 2, 1, I('#dfc088')); put(b, x0 + (w >> 1), -h, I('#a88454')); put(b, x0 + (w >> 1) - 2, -h - 1, I('#fff0c8'));
  if (axe) {
    line(b, x0 + w - 4, -h - 2, x0 + w + 4, -h - 13, WOOD[2], 2); line(b, x0 + w - 4, -h - 2, x0 + w + 4, -h - 13, WOOD[0], 1);
    rect(b, x0 + w - 8, -h - 5, 6, 4, STL[1]); rect(b, x0 + w - 8, -h - 5, 6, 1, STL[0]); rect(b, x0 + w - 9, -h - 4, 1, 3, STL[0]);
  }
  outline(b);
  if (!axe) { put(b, x0 + 1, -h - 2, JG[2]); put(b, x0 + 1, -h - 3, JG[1]); put(b, x0 + 2, -h - 4, JG[1]); put(b, x0, -h - 4, JG[2]); }   // a shoot growing back
  tufts(b, x0 - 7, x0 - 1, 0, 95, JG); tufts(b, x0 + w + 1, x0 + w + 7, 0, 96, JG);
  return b;
}

// a coconut palm: ringed trunk leaning into the light, arching fronds whose leaflets hang like combs, a cluster of nuts
function palmBuf(seed) {
  const b = buf(100, 126, -50, -122), TR = PAL('#dcb988', '#b48f5e', '#8a6a40', '#5e462a');
  const PL = PAL('#c4f07c', '#7ed45a', '#44aa48', '#237a38', '#14522a'), DEEP = I('#0e3a22');
  const cxAt = i => sin(i / 78 * 1.9 + 0.1 + seed) * 6 - 2;
  for (let i = 0; i <= 80; i++) {
    const cx = cxAt(i), w = 7.5 - i / 78 * 3 + (i < 5 ? (5 - i) * 0.8 : 0), x0 = round(cx - w / 2), x1 = round(cx + w / 2);
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / max(1, x1 - x0), ring = (i + (x - x0 > 2 ? 1 : 0)) % 5 === 0;
      put(b, x, -i, ring ? TR[3] : t < 0.2 ? TR[2] : t > 0.75 ? TR[0] : (i % 5 === 1 ? TR[0] : TR[1]));
    }
  }
  outline(b);
  const C = [cxAt(80), -81];
  // a frond in its own buffer: the rib arcs out and droops, the blade hangs from it with a saw-toothed edge
  const frond = (ang, len, droop, P) => {
    const f = buf(b.w, b.h, b.ox, b.oy);
    for (let s = 0; s <= len; s += 0.5) {
      const t = s / len, x = C[0] + cos(ang) * s, y = C[1] + sin(ang) * s + droop * len * 0.55 * t * t;
      let dx = cos(ang), dy = sin(ang) + droop * 1.1 * t;
      const tl = hypot(dx, dy); dx /= tl; dy /= tl;
      let nx = -dy, ny = dx; if (ny < 0) { nx = -nx; ny = -ny; }             // the normal that points down
      let vx = nx * 0.5 + dx * 0.3, vy = ny * 0.5 + 0.8;
      const vl = hypot(vx, vy); vx /= vl; vy /= vl;
      const ll = (1 + 8.5 * sin(PI * min(1, t * 0.88 + 0.12))) * ((round(s) % 3) ? 1 : 0.6);
      for (let k = 1; k <= ll; k++) put(f, x + vx * k, y + vy * k, k > ll - 2.2 ? P[3] : k < 2.5 ? P[1] : P[2]);
      const ul = min(2.2, ll * 0.3);
      for (let k = 1; k <= ul; k++) put(f, x - nx * k + dx * k * 0.6, y - ny * k, P[1]);
      put(f, x, y, P[0]); if (t < 0.7) put(f, x, y - 1, P[0]);
    }
    outline(f, DEEP);
    stamp(b, f, 0, 0);
  };
  const BACK = [PL[2], PL[3], PL[3], PL[4]], SIDE = [PL[1], PL[2], PL[3], PL[4]], FRONT = [PL[0], PL[1], PL[2], PL[3]];
  frond(-2.45, 27, 0.7, BACK); frond(-0.62, 28, 0.7, BACK); frond(-1.75, 22, 0.2, BACK);
  frond(2.75, 19, 1.2, SIDE); frond(0.42, 19, 1.2, SIDE);
  const n = buf(12, 10, C[0] - 5, C[1] + 1);
  disc(n, C[0] - 2, C[1] + 4, 2, I('#6a4a2a')); disc(n, C[0] + 2, C[1] + 5, 2, I('#7a5632')); disc(n, C[0], C[1] + 7, 2, I('#5a3d22')); put(n, C[0] + 3, C[1] + 4, I('#b08a56')); put(n, C[0] - 1, C[1] + 3, I('#a07a48'));
  outline(n); stamp(b, n, C[0] - 5 - b.ox, C[1] + 1 - b.oy);
  frond(-3.05, 32, 1.1, SIDE); frond(-0.1, 33, 1.1, FRONT);
  frond(-2.2, 31, 0.62, SIDE); frond(-0.9, 31, 0.6, FRONT); frond(-1.45, 26, 0.3, FRONT);
  disc(b, C[0], C[1], 2.2, PL[3]); put(b, C[0] + 1, C[1] - 1, PL[1]);
  tufts(b, -9, -3, 0, 91 + seed * 7); tufts(b, 4, 10, 0, 92 + seed * 7);
  return b;
}

// ---------- the ground, x 1620..3060 exactly: baked in 256px chunks ----------
// Packed earth we walk on (sun-bleached, tread marks), a dark crust, layered soil with stones. West end: the
// jungle's turf and darker earth hold on in patches and thin out over WEST px (a clearing edge). East end: the last
// REV px are a revetment of stacked stones holding the earth back before the river bank.
const GCH = 256, GY0 = GROUND - 8, GH = H + 8 - GY0;
const EARTH = PAL('#f0d9a0', '#dfc288', '#cba86e', '#b28c56', '#8c6a40');
const SOIL = [PAL('#c99a5e', '#ba8c52'), PAL('#ac743e', '#9c6634'), PAL('#885430', '#7a482a'), PAL('#603a26', '#50301f')];
const STONE = PAL('#e8e0cc', '#bcb29c', '#8c8270'), STONED = PAL('#a89e8a', '#80766a', '#5a524a'), STONER = PAL('#d8a878', '#b07e52', '#80583a');
const JE = PAL('#a26c40', '#8a5834', '#72462a', '#5c3822', '#462b1b', '#332015');      // the jungle's earth
const WEST = 64, REV = 11;
const wild = x => clamp(1 - (x - X0) / WEST, 0, 1);                                    // 1 at the jungle's edge, 0 from WEST px in
// The jungle's turf arrives worn thin (level1_jungle.js: short blades, a 3px lip, mostly bare trodden earth); the
// last patches of it die out over the first WEST px
const turfAt = x => { const w = wild(x); return w > 0 && nz(x >> 2, 301) * 0.5 + nz(x >> 3, 302) * 0.5 < w * 0.44; };
function turfPx(x, d) {
  if (d < 0) return d === -1 && nz(x, 11) < 0.3 ? JG[1] : NONE;
  return d === 0 ? (nz(x, 500) > 0.88 ? JG[0] : JG[1]) : d === 1 ? JG[3] : d === 2 ? JG[4] : JE[5];
}
function wildEarth(x, d, n) {
  const wav = sin(x * 0.045 + sin(x * 0.013) * 2) * 2.5 + sin(x * 0.17) * 0.8, band = floor((d - 4 + wav) / 9);
  let k = floor(ss(3, 42, d) * 3.3 + (n - 0.5) * 0.9) + (((band % 3) + 3) % 3 === 1 ? 1 : 0);
  if (n > 0.975) k--;
  return mixI(JE[clamp(k, 0, 5)], I('#c2925a'), 0.3 * (1 - ss(3, 24, d)));     // dried out near the top, as the jungle paints it at its edge
}
function groundPx(x, y) {
  const d = y - GROUND, n = nz(x, y), w = wild(x);
  if (d <= 3 && w > 0 && turfAt(x)) return turfPx(x, d);   // a last patch of the jungle's turf
  if (d < 0) {                                              // dry grass along the back edge, in clumps (still green near the jungle)
    const g = fbm(x / 7, 5, 2);
    if (g < 0.56) return n > 0.985 && d === -1 ? STONE[1] : NONE;
    const h = round((g - 0.53) * 26 * (0.35 + nz(x, 12))), c = -d > h ? NONE : -d === h ? GRASS[0] : nz(x, d + 40) > 0.5 ? GRASS[1] : GRASS[2];
    return c === NONE || w <= 0 ? c : mixI(c, JG[2], w * 0.7);
  }
  if (x < X0 + 24 && d >= 2 + ((x - X0) >> 3) && d < 7) return wildEarth(x, d, n);   // the jungle's bare patches are 2px deep: the packed crust thickens from there
  if (d < 5) {                                              // packed earth, sun-bleached on top
    if (x >= X1 - 2) return d < 2 ? EARTH[3] : EARTH[4];    // the worn edge above the revetment
    if (n > 0.975 && d > 0 && d < 4) return I('#fbf2d6');   // a pebble catching the light
    if (d > 1 && nz(x, y - 1) > 0.975) return EARTH[4];     // and its shadow
    let c;
    const tread = fbm(x / 60, 9, 2) > 0.4 && w <= 0;        // where the trucks drive: tread marks pressed in
    if (d === 0) c = nz(x >> 2, 3) > 0.85 ? EARTH[1] : EARTH[0];
    else if (tread && d < 3) c = wrap(x + d, 4) < 3 ? (d === 1 ? EARTH[3] : EARTH[4]) : EARTH[1];
    else if (tread && d === 3) c = EARTH[1];
    else if (d === 4) c = EARTH[3];
    else { const k = nz(x >> 2, d + 20); c = d === 3 ? (k > 0.45 ? EARTH[3] : EARTH[2]) : d === 2 ? (k > 0.7 ? EARTH[3] : k < 0.2 ? EARTH[1] : EARTH[2]) : (k > 0.6 ? EARTH[2] : EARTH[1]); }
    return c;
  }
  if (d === 5) return I('#7c5c36');                         // the crust's dark edge
  if (d === 6) return n > 0.3 ? I('#96703f') : SOIL[0][1];
  // the earth underneath: the jungle's dark loam gives way to the camp's dry layers
  if (x < X0 + 110) { const ws = 1 - (x - X0) / 110; if (nz(x >> 1, y >> 1) * 0.7 + n * 0.3 < pow(ws, 0.8) * 1.05) return wildEarth(x, d, n); }
  if (x >= X1 - REV) return SOIL[3][1];                     // behind the stones
  const dd = d - 6;
  const b1 = 6 + 2 * sin(x * 0.045) + 1.3 * sin(x * 0.11 + 1), b2 = 15 + 2.6 * sin(x * 0.028 + 2) + 1.4 * sin(x * 0.09), b3 = 24 + 2.6 * sin(x * 0.02 + 4) + 1.2 * sin(x * 0.13);
  let k = dd < b1 ? 0 : dd < b2 ? 1 : dd < b3 ? 2 : 3;
  const e = k < 3 ? [b1, b2, b3][k] - dd : 9;
  if (e < 1) return SOIL[k + 1][1];                         // strata line
  if (e < 3 && ((x + y) & 1)) k++;
  if (k === 1 && n > 0.93) return I('#d8b070');             // gravel in the ochre band
  if (n > 0.975) return SOIL[max(0, k - 1)][0];
  return SOIL[k][n > 0.6 ? 1 : 0];
}
function pebble(b, cx, cy, rx, ry, P) {
  oval(b, cx, cy, rx + 1, ry + 1, OUTI);
  const RX = rx + 0.5, RY = ry + 0.5;
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    if (i * i / (RX * RX) + j * j / (RY * RY) > 1) continue;
    const t = i / RX - j / RY;
    put(b, cx + i, cy + j, t > 0.7 ? P[0] : t < -0.5 ? P[2] : P[1]);
  }
}
// things in the earth, per world cell so they run on across chunk borders
function groundFeatures(b, xa, xb) {
  const EA = X0 + 30, EB = X1 - REV - 2;                    // features keep clear of the two ends
  // drying cracks down from the crust
  for (let x = xa - 8; x < xb + 8; x++) {
    if (nz(x, 31) > 0.045 || x < X0 + 90 || x >= EB) continue;
    let cx = x, cy = GROUND + 6;
    for (let i = 0, len = 4 + nz(x, 32) * 12; i < len; i++) { put(b, cx, cy, I('#7c5c36')); cy++; const w = nz(x + i * 7, 33); if (w < 0.28) cx--; else if (w > 0.72) cx++; }
  }
  // roots of the felled trees still in the loam at the west end
  for (let x = max(xa - 8, X0 + 3); x < min(xb + 8, X0 + 90); x++) {
    if (nz(x, 34) > 0.08) continue;
    let cx = x, cy = GROUND + 7;
    for (let i = 0, len = 6 + nz(x, 35) * 16; i < len; i++) { put(b, cx, cy, I('#3a2618')); if (i < len * 0.5) put(b, cx + 1, cy, I('#4a3020')); cy++; const w = nz(x + i * 5, 36); if (w < 0.3) cx--; else if (w > 0.7) cx++; }
  }
  for (let c = floor((xa - 24) / 32); c * 32 < xb + 24; c++) {
    const n = nz(c, 900) * 2.4 | 0;
    for (let k = 0; k < n; k++) {
      const x = c * 32 + (nz(c, 910 + k) * 32 | 0), d = 10 + (pow(nz(c, 920 + k), 1.1) * 28 | 0);
      const big = nz(c, 930 + k), rx = big > 0.86 ? 5 + (nz(c, 931 + k) * 3 | 0) : 1 + (big * 2.6 | 0), ry = big > 0.86 ? 3 : 1 + (nz(c, 940 + k) * 1.6 | 0);
      if (x - rx - 2 < EA - 24 || x + rx + 2 >= EB) continue;
      pebble(b, x, GROUND + d, rx, min(ry, rx), nz(c, 960 + k) > 0.6 ? STONER : d > 18 ? STONED : STONE);
    }
  }
  // buried odds and ends: an old cog, a bone, a bolt
  for (let c = floor((xa - 40) / 230); c * 230 < xb + 40; c++) {
    const x = c * 230 + 30 + (nz(c, 950) * 170 | 0), y = GROUND + 17 + (nz(c, 951) * 12 | 0), k = nz(c, 952);
    if (x - 12 < X0 + 110 || x + 12 >= EB) continue;
    if (k < 0.36) {                                         // an old cog wheel
      const g = buf(15, 15, -7, -7);
      disc(g, 0, 0, 5, STL[2]); for (let a = 0; a < 6.28; a += 0.785) rect(g, round(cos(a) * 6) - 1, round(sin(a) * 6) - 1, 2, 2, STL[2]);
      disc(g, 0, 0, 2, I('#8c5632')); disc(g, 1, -1, 3.2, STL[1]); disc(g, 0, 0, 1.6, I('#7a4a2c')); put(g, 2, -3, STL[0]); put(g, 3, -2, STL[0]);
      for (let i = 0; i < g.d.length; i++) if (g.d[i] !== NONE && nz(i, c) > 0.8) g.d[i] = I('#a8683a');
      outline(g); stamp(b, g, x - 7 - b.ox, y - 7 - b.oy);
    } else if (k < 0.62) {                                  // a bone
      const g = buf(16, 8, 0, 0);
      rect(g, 3, 3, 10, 2, I('#f0ead8')); rect(g, 3, 4, 10, 1, I('#cfc6ae'));
      for (const [bx, by] of [[2, 2], [2, 5], [13, 2], [13, 5]]) { rect(g, bx, by, 2, 2, I('#f0ead8')); }
      outline(g); stamp(b, g, x - 8 - b.ox, y - 4 - b.oy);
    } else {                                                // a bolt
      const g = buf(12, 8, 0, 0);
      rect(g, 2, 2, 3, 4, STL[1]); rect(g, 2, 2, 3, 1, STL[0]); rect(g, 5, 3, 5, 2, STL[2]); for (let i = 6; i < 10; i += 2) put(g, i, 3, STL[0]);
      outline(g); stamp(b, g, x - 6 - b.ox, y - 4 - b.oy);
    }
  }
  // the east end: stones stacked against the earth, the biggest at the top
  if (xb > X1 - REV - 2 && xa < X1) for (let k = 0, y = GROUND + 9; y < GY0 + GH + 4; k++, y += 6) pebble(b, X1 - 6 - (k & 1), y, 4 - (k & 1), 2, k % 3 === 2 ? STONER : k & 1 ? STONED : STONE);
}
// where things stand, the earth is in their shade (light from the upper right, so shadows fall to the left)
function shadows() {
  const out = [];
  for (const pl of L1ART.plats('camp')) {
    if (pl.t === 'crates') out.push([pl.x - 12, pl.x + pl.w]);
    else { out.push([pl.x - 8, pl.x + 10]); out.push([pl.x + pl.w - 18, pl.x + pl.w - 2]); if (pl.t === 'scaffold' && pl.w > 76) out.push([pl.x + (pl.w >> 1) - 12, pl.x + (pl.w >> 1) + 4]); }
  }
  for (const d of L1ART.decor('camp')) {
    if (d.t === 'tent') out.push([d.x - 50, d.x + 30]);
    else if (d.t === 'sandbags') out.push([d.x - 36, d.x + 22]);
    else if (d.t === 'drums') out.push([d.x - 30, d.x + 16]);
    else if (d.t === 'jeep') out.push([d.x - 44, d.x + 26]);
    else if (d.t === 'palm') out.push([d.x - 10, d.x + 3]);
  }
  for (const [sx, k] of STUMPS) out.push([sx - 12, sx + (k ? 2 : 4)]);
  return out;
}
const CHUNKS = new Map(), CHUNK_X = [];
for (let x0 = floor(X0 / GCH) * GCH; x0 < X1; x0 += GCH) CHUNK_X.push(x0);
let SHADE = null;
function bakeChunk(x0) {
  const b = buf(GCH, GH, x0, GY0), sh = SHADE || (SHADE = shadows());
  for (let x = max(x0, X0); x < min(x0 + GCH, X1); x++) for (let y = GY0; y < GY0 + GH; y++) {
    let c = groundPx(x, y);
    if (c === NONE) continue;
    const d = y - GROUND;
    if (d >= 0 && d < 5) for (const [a, e] of sh) if (x >= a + (d >> 1) && x < e + (d >> 1) && !(((x + d) & 1) && (x < a + 3 || x >= e - 3))) { c = mixI(c, I('#6a4c2c'), d === 0 ? 0.26 : 0.2); break; }
    b.d[(y - GY0) * GCH + (x - x0)] = c;
  }
  groundFeatures(b, x0, x0 + GCH);
  // exactly the camp's ground: nothing west of x0 or east of x1
  for (let x = x0; x < x0 + GCH; x++) if (x < X0 || x >= X1) for (let y = 0; y < GH; y++) b.d[y * GCH + (x - x0)] = NONE;
  CHUNKS.set(x0, bake(b));
}

// ---------- the foreground: dark shapes passing in front (sandbags, wire on trestles, crates) ----------
function darken(b) { remap(b, c => c === OUTI ? I('#14101c') : mixI(mixI(c, I('#503a44'), 0.4), I('#1c1626'), 0.14)); return b; }
function wireBuf() {
  const b = buf(70, 30, -35, -28);
  for (const sx of [-24, 24]) { line(b, sx - 6, 0, sx + 6, -22, WOOD[3], 2); line(b, sx + 6, 0, sx - 6, -22, WOOD[2], 2); line(b, sx + 6, 0, sx - 6, -22, WOOD[1], 1); lash(b, sx - 2, -13, 4); }
  outline(b);
  for (let x = -24; x <= 24; x += 8) for (let a = 0; a < 6.28; a += 0.12) {
    const px = x + cos(a) * 5 + sin(a) * 2, py = -14 + sin(a) * 8, front = cos(a - 0.5) > 0;
    put(b, px, py, front ? STL[0] : STL[2]);
    if (front && (round(a * 8) % 13) === 0) { put(b, px + 1, py - 1, I('#ffffff')); put(b, px - 1, py + 1, STL[0]); put(b, px + 1, py + 1, STL[1]); }
  }
  return b;
}
function frontCrateBuf() {
  const b = buf(44, 30, -22, -28);
  const pl = { x: -18, y: -16, w: 16 };
  const one = (x, y, s) => {
    rect(b, x, y, s, s, WOOD[2]); for (let k = x + 3; k < x + s - 2; k += 3) rect(b, k, y + 2, 1, s - 4, WOOD[3]);
    rect(b, x, y, s, 2, WOOD[0]); rect(b, x, y + s - 2, s, 2, WOOD[3]); rect(b, x, y + 2, 2, s - 4, WOOD[1]); rect(b, x + s - 2, y + 2, 2, s - 4, WOOD[0]);
    line(b, x + 2, y + s - 3, x + s - 4, y + 2, WOOD[1], 2); rect(b, x + s - 1, y, 1, s, WOOD[4]); rect(b, x, y + s - 1, s, 1, WOOD[4]);
  };
  one(pl.x, pl.y, 16); one(pl.x + 17, -14, 14); one(pl.x + 6, -27, 12);
  outline(b);
  return b;
}

// a tile of ground dust (dithered, wraps sideways), built once
function dustTile() {
  const w = 256, h = 34, b = buf(w, h), C = I('#f6e6ba');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w * PI * 2, n = 0.5 + 0.28 * sin(u * 2 + y * 0.21) + 0.2 * sin(u * 5 - y * 0.33 + 1) + 0.16 * sin(u * 9 + y * 0.5 + 2);
    const k = n * sin(PI * y / (h - 1));
    if (k > 0.5 && ((x + y) & 1)) put(b, x, y, AL(C, 0.5)); else if (k > 0.62) put(b, x, y, AL(C, 0.34));
  }
  return bake(b);
}

// ============================================================
// Live bits of the backdrop (everything here draws on g: the screen, or a scratch canvas during a sky crossfade)
// ============================================================
const ART = {};                                             // every baked picture; filled by the steps at the bottom
const dayOf = cx => clamp((cx - 1300) / 1700, 0, 1);        // 0 = midday at the camp sign, 1 = afternoon at the bridge
function drawSun(g, cx) {
  const a = ART, x = round(404 - cx * 0.015), y = round(54 + dayOf(cx) * 20), k = 0.5 + 0.5 * sin(G.t * 0.013);
  g.globalAlpha = 0.55 + 0.45 * k; g.drawImage(a.rays[0], x - 220, y - 40);
  g.globalAlpha = 1 - 0.45 * k; g.drawImage(a.rays[1], x - 220, y - 40);
  g.globalAlpha = 1; g.drawImage(a.sun, x - 72, y - 72);
}
function drawClouds(g, cx) {
  const span = W + 300;
  for (const [i, y, p, v, ph] of CLOUD_AT) g.drawImage(ART.clouds[i], round(wrap(ph - cx * p - G.t * v, span) - 150), y);
}
// a vulture wheeling high over the camp
function drawBirds(g, cx) {
  const t = G.t, vx = round(272 + cos(t * 0.006) * 70 - cx * 0.02), vy = round(78 + sin(t * 0.006) * 9);
  const fl = sin(t * 0.05) > 0.6 ? 1 : 0;
  g.fillStyle = '#3b3442';
  g.fillRect(vx - 1, vy, 3, 2); g.fillRect(vx - 5, vy - fl, 4, 1); g.fillRect(vx + 2, vy - fl, 4, 1); g.fillRect(vx - 7, vy - 1 - fl, 2, 1); g.fillRect(vx + 6, vy - 1 - fl, 2, 1);
  g.fillStyle = '#e8dcc8'; g.fillRect(vx + (sin(t * 0.006) > 0 ? -2 : 2), vy, 1, 1);
}
// three egrets crossing low over the jungle, now and then
function drawEgrets(g, cx) {
  const t = G.t;
  for (let i = 0; i < 3; i++) {
    const tt = t + i * 19, x = round(wrap(473 + i * 12 + tt * 0.3 - cx * 0.1, W + 360) - 40), y = round(119 + i * 4 - (i === 1 ? 6 : 0) + sin(tt * 0.03) * 3), f = floor(tt / 8) % 3;
    if (x > W + 12) continue;
    g.fillStyle = '#ffffff'; g.fillRect(x, y, 3, 1); g.fillRect(x + 3, y - 1, 1, 1);
    if (f === 0) { g.fillRect(x, y - 2, 1, 2); g.fillRect(x - 1, y - 3, 1, 1); } else if (f === 1) g.fillRect(x - 1, y - 1, 2, 1); else { g.fillRect(x, y + 1, 1, 2); }
    g.fillStyle = '#d8dce6'; g.fillRect(x - 1, y, 1, 1);
    g.fillStyle = '#f0a030'; g.fillRect(x + 4, y - 1, 1, 1);
  }
}
// the far base: smoke from its stacks, a red light on the keep
function baseLive(g, cx) {
  const S = ART.mtn, off = offOf(S, cx) + 10, t = G.t;
  for (const [sx, sy] of S.live.stacks) for (let i = 0; i < 5; i++) {
    const u = ((t * 0.12 + i * 9 + sx * 3) % 45) / 45, r = 1 + u * 2.6;
    g.fillStyle = 'rgba(226,230,240,' + (0.75 * (1 - u)).toFixed(2) + ')';
    pdisc(g, sx - off - u * 13 + sin(u * 5 + i) * 1.2, sy - u * 13, r);
  }
  const [lx, ly] = S.live.lamp;
  g.fillStyle = floor(t / 28) % 2 ? '#ff5a4a' : '#8a3a3a'; g.fillRect(lx - off, ly, 1, 1);
}
const TRUCK_V = 0.12, TRUCK_A = YW + 8, TRUCK_B = YE - 4;   // the supply truck's speed and the two ends of its run (strip x)
function yardLive(g, cx) {
  const S = ART.yard, off = offOf(S, cx) + 10, lv = S.live, t = G.t;
  // radar dishes turning: the ellipse narrows to a line and opens again, bright face then dark back
  for (const [sx, sy, ph] of lv.dish) {
    const x = sx - off, a = t * 0.045 + ph, c = cos(a), hw = round(abs(c) * 9);
    if (x < -20 || x > W + 20) continue;
    for (let j = -6; j <= 6; j++) {
      const w = round(hw * sqrt(1 - (j / 6.6) * (j / 6.6)));
      g.fillStyle = c > 0 ? (j < -2 ? '#f4f4e6' : j > 3 ? '#a9ad9e' : '#d2d5c6') : (j < -2 ? '#949a8c' : '#6c7266');
      g.fillRect(x - w, sy + j, w * 2 + 1, 1);
    }
    if (hw > 2) { g.fillStyle = c > 0 ? '#a9ad9e' : '#565c52'; for (let j = -4; j <= 4; j += 4) g.fillRect(x - round(hw * 0.8), sy + j, round(hw * 1.6) + 1, 1); }
    g.fillStyle = '#565c52'; g.fillRect(x, sy - 6, 1, 13);
    if (c > 0) { g.fillStyle = '#3f443c'; g.fillRect(x + round(sin(a) * 4), sy - 1, 2, 2); g.fillRect(x + round(sin(a) * 2), sy, 1, 1); }
    g.fillStyle = floor(t / 24) % 2 ? '#ff5a4a' : '#7a2a24'; g.fillRect(x, sy - 8, 1, 2);
  }
  // the robot army's flag: dark cloth, a grey robot head with a red visor, rippling in the hot wind
  for (const [sx, sy] of lv.flag) {
    const x = sx - off;
    if (x < -30 || x > W + 20) continue;
    for (let i = 0; i < 19; i++) {
      const wv = sin(i * 0.5 - t * 0.16), dy = round(wv * (i / 18) * 1.5);
      g.fillStyle = wv > 0.3 ? '#4c4c62' : '#2c2c3c'; g.fillRect(x + i, sy + dy, 1, 12);
      g.fillStyle = '#6c6c84'; g.fillRect(x + i, sy + dy, 1, 1);
      g.fillStyle = '#1c1c28'; g.fillRect(x + i, sy + dy + 11, 1, 1);
      if (i >= 6 && i <= 12) {
        const edge = i === 6 || i === 12;
        g.fillStyle = '#c3cdd8'; g.fillRect(x + i, sy + dy + (edge ? 3 : 2), 1, edge ? 5 : 7);
        g.fillStyle = '#8a97a8'; g.fillRect(x + i, sy + dy + 8, 1, 1);
        if (!edge) { g.fillStyle = i === 10 ? '#ffb3a8' : '#ff3b30'; g.fillRect(x + i, sy + dy + 4, 1, 2); }
      }
    }
  }
  // cookhouse smoke drifting away from the sun
  for (const [sx, sy] of lv.smoke) {
    const x = sx - off;
    if (x < -40 || x > W + 60) continue;
    for (let i = 0; i < 7; i++) {
      const u = ((t * 0.3 + i * 10) % 70) / 70, r = 1 + u * 4;
      g.fillStyle = 'rgba(120,112,104,' + (0.6 * (1 - u)).toFixed(2) + ')';
      pdisc(g, x - u * 20 + sin(u * 7 + i) * 1.5, sy - u * 34, r);
      g.fillStyle = 'rgba(214,204,188,' + (0.5 * (1 - u)).toFixed(2) + ')';
      pdisc(g, x - u * 20 + sin(u * 7 + i) * 1.5 + 1, sy - u * 34 - 1, r * 0.5);
    }
  }
  // a supply truck trundling west along the yard's road, dust boiling up behind it; it comes out of the trees at the
  // east end and is gone into them at the gate, then the next one sets off
  {
    const run = TRUCK_B - TRUCK_A + 60, lap = ceil(run / TRUCK_V) + 240, u0 = (t + 2400) % lap;
    const x = round(TRUCK_B - u0 * TRUCK_V) - off, base = 205 + (floor(t / 9) % 2);
    if (u0 * TRUCK_V < run && x > -110 && x < W + 30) {
      g.save(); g.beginPath(); g.rect(TRUCK_A - off, 150, TRUCK_B - TRUCK_A, 70); g.clip();
      for (let k = 0; k < 7; k++) {
        const u = ((t * 0.3 + k * 11) % 77) / 77, r = 2 + u * 5.5;
        const px = x + 46 + u * 40 + sin(k * 2.1) * 2, py = 203 - u * 19 - abs(sin(k * 1.7)) * 3;
        g.fillStyle = 'rgba(198,166,112,' + (0.85 * (1 - u * u)).toFixed(2) + ')'; pdisc(g, px, py, r);
        g.fillStyle = 'rgba(232,208,160,' + (0.9 * (1 - u * u)).toFixed(2) + ')'; pdisc(g, px + 1, py - 1, r * 0.7);
        g.fillStyle = 'rgba(252,240,206,' + (0.9 * (1 - u)).toFixed(2) + ')'; pdisc(g, px + 1.5, py - r * 0.45, r * 0.3);
      }
      blit(g, ART.truck, x, base);
      g.restore();
    }
  }
  // lamps blinking on the watchtowers and the aerial
  for (const [sx, sy] of lv.lamp) {
    const x = sx - off;
    g.fillStyle = floor((t + sx * 7) / 30) % 2 ? '#ff5a4a' : '#7a2a24'; g.fillRect(x, sy, 1, 1);
  }
}

// The whole backdrop of the camp for camera cx
function campBG(g, cx) {
  const a = ART;
  g.drawImage(a.sky, 0, 0, 1, H + 20, -10, -10, W + 20, H + 20);
  const warm = dayOf(cx) * 0.4;                             // afternoon coming on: the low sky warms toward the bridge
  if (warm > 0.01) { g.globalAlpha = warm; g.drawImage(a.warm, 0, 0, 1, 200, -10, 0, W + 20, 200); g.globalAlpha = 1; }
  drawSun(g, cx);
  drawClouds(g, cx);
  drawBirds(g, cx);
  blitStrip(g, a.mtn, cx);
  baseLive(g, cx);
  blitStrip(g, a.hillA, cx);
  blitStrip(g, a.hillB, cx);
  drawEgrets(g, cx);
  blitStrip(g, a.wall, cx);
  shimmerRows(g, a.wall, cx, 170, 186, 1);
  blitStrip(g, a.yard, cx);
  shimmerRows(g, a.yard, cx, 178, 188, 1);
  yardLive(g, cx);
  blitStrip(g, a.fence, cx);
  // dust hanging over the track, behind the action
  const o = round(wrap(cx * 0.8 + G.t * 0.2, 256));
  g.globalAlpha = 0.5;
  for (let x = -o - 10; x < W + 10; x += 256) g.drawImage(a.dust, x, 202);
  g.globalAlpha = 1;
}

// ============================================================
// The world: decor behind the action, the ground, the platforms, the foreground
// ============================================================
// the robot army's flag: two bakes of the same cloth (lit, in a fold), drawn column by column along a travelling wave
function flagBuf(dark) {
  const b = buf(30, 18), C = dark ? PAL('#26263a', '#1c1c2c', '#3a3a50') : PAL('#3c3c56', '#2a2a40', '#5c5c7a');
  rect(b, 0, 0, 30, 18, C[0]); rect(b, 0, 0, 30, 1, C[2]); rect(b, 0, 16, 30, 2, C[1]);
  for (let x = 0; x < 30; x += 3) put(b, x, 14, RED[2]);
  const HD = dark ? PAL('#98a2b0', '#6c7684', '#c0281e', '#e04a38') : PAL('#c8d0da', '#8a97a8', '#e8382a', '#ff8a7a');
  rect(b, 10, 4, 10, 8, HD[0]); rect(b, 11, 3, 8, 1, HD[0]); rect(b, 11, 12, 8, 1, HD[1]); rect(b, 10, 9, 10, 3, HD[1]);
  rect(b, 12, 6, 6, 2, HD[2]); put(b, 16, 6, HD[3]); rect(b, 12, 10, 1, 2, OUTI); rect(b, 14, 10, 1, 2, OUTI); rect(b, 16, 10, 1, 2, OUTI); rect(b, 18, 10, 1, 1, OUTI);
  rect(b, 14, 1, 1, 2, HD[1]); put(b, 14, 0, HD[2]);
  return bake(b);
}
function drawFlag(x, y) {
  const t = G.t;
  ctx.fillStyle = OUT;
  for (let i = 0; i <= 30; i++) { const k = min(i, 29), dy = round(sin(k * 0.4 - t * 0.14) * (k / 29) * 3); ctx.fillRect(x + i, y + dy - 1, 1, 20); }
  for (let i = 0; i < 30; i++) {
    const wv = sin(i * 0.4 - t * 0.14), dy = round(wv * (i / 29) * 3);
    ctx.drawImage(ART.flags[cos(i * 0.4 - t * 0.14) < -0.25 ? 1 : 0], i, 0, 1, 18, x + i, y + dy, 1, 18);
  }
}
// a palm sways from the crown down: the sprite is drawn in three bands
function drawPalmAt(s, x) {
  const sw = sin(G.t * 0.03 + x) * 1.3, X = round(x) + s.ox, Y = GROUND + s.oy, cut1 = 54, cut2 = 80;   // rows from the top
  ctx.drawImage(s.img, 0, 0, s.w, cut1, X + round(sw), Y, s.w, cut1);
  ctx.drawImage(s.img, 0, cut1, s.w, cut2 - cut1, X + round(sw * 0.4), Y + cut1, s.w, cut2 - cut1);
  ctx.drawImage(s.img, 0, cut2, s.w, s.h - cut2, X, Y + cut2, s.w, s.h - cut2);
}
// hot air wobbling up off a surface: short pale squiggles that rise and fade
function heatWisps(x, y, n) {
  for (let k = 0; k < n; k++) {
    const u = ((G.t * 0.22 + k * 9) % 18) / 18, a = 0.5 * sin(PI * u);
    ctx.fillStyle = 'rgba(255,250,226,' + a.toFixed(2) + ')';
    for (let j = 0; j < 5; j++) ctx.fillRect(round(x + k * 7 - 7 + sin(j * 1.2 + G.t * 0.12 + k) * 1.2), round(y - u * 14 - j), 1, 1);
  }
}

// behind the action (world space): the camp's decor in a fixed order, back to front
const ORDER = { radio: 0, flag: 1, tent: 2, palm: 3, drums: 4, sandbags: 5, jeep: 6, sign: 7 };
let DEC = null;
function campBehind(cx) {
  const a = ART, t = G.t, seen = x => x > cx - 120 && x < cx + W + 120;
  if (!DEC) DEC = L1ART.decor('camp').slice().sort((p, q) => (ORDER[p.t] || 0) - (ORDER[q.t] || 0));
  for (const [sx, k] of STUMPS) if (seen(sx)) blit(ctx, a.stump[k], sx, GROUND);
  let nb = 0, np = 0, nt = 0;
  for (const d of DEC) {
    const i = d.t === 'sandbags' ? nb++ : d.t === 'palm' ? np++ : d.t === 'tent' ? nt++ : 0;
    if (!seen(d.x)) continue;
    switch (d.t) {
      case 'radio':
        blit(ctx, a.radio, d.x, GROUND);
        RO(d.x - 1, GROUND - 127, 3, 3, floor(t / 20) % 2 ? EVIL : '#5a1a1a');
        if (floor(t / 20) % 2) R(d.x, GROUND - 129, 1, 1, '#ffb3a8');
        break;
      case 'flag': blit(ctx, a.pole, d.x, GROUND); drawFlag(d.x + 3, GROUND - 79); break;
      case 'tent': blit(ctx, a.tent[i % 3], d.x, GROUND); break;
      case 'palm': drawPalmAt(a.palm[i % 2], d.x); break;
      case 'drums': blit(ctx, a.drums, d.x, GROUND); break;
      case 'sandbags': blit(ctx, a.bags[i % 3], d.x, GROUND); break;
      case 'jeep': {
        blit(ctx, a.jeep, d.x, GROUND);
        for (let k = 0; k < 4; k++) {                       // exhaust puffing out of the stack
          const u = ((t * 0.5 + k * 19) % 76) / 76, r = 1.4 + u * 3.6;
          ctx.fillStyle = 'rgba(84,80,80,' + (0.6 * (1 - u)).toFixed(2) + ')';
          pdisc(ctx, d.x + 12 - u * 13 + sin(u * 6 + k) * 1.5, GROUND - 34 - u * 17, r);
          ctx.fillStyle = 'rgba(190,184,176,' + (0.5 * (1 - u)).toFixed(2) + ')';
          pdisc(ctx, d.x + 13 - u * 13 + sin(u * 6 + k) * 1.5, GROUND - 35 - u * 17, r * 0.5);
        }
        heatWisps(d.x + 22, GROUND - 23, 2);
        break;
      }
      case 'sign': {                                        // 'CAMP >': the board is cut to a point, the text loses its arrow
        const arrow = /\s*>$/.test(d.s || ''), s = String(d.s || '').replace(/\s*>$/, '');
        blit(ctx, a.sign[arrow ? 0 : 1], d.x, GROUND);
        text(s, d.x - (arrow ? 1 : 0), GROUND - 33, '#5a1a14', 1, 'center', null);
        break;
      }
    }
  }
}
// the ground strip (world space), x0..x1 only
function campGround(cx) {
  for (const [x0, c] of CHUNKS) if (x0 < cx + W + 12 && x0 + GCH > cx - 12) ctx.drawImage(c, x0, GY0);
}
// one platform (world space)
function campPlat(pl) {
  const s = platArt(pl);
  ctx.drawImage(s.img, s.ox, s.oy);
  if (pl.t === 'tower') {                                   // the warning lamp on the roof, heat off the tin
    const on = floor(G.t / 16) % 2, px = pl.x + (pl.w >> 1);
    RO(px - 1, pl.y - 62, 3, 3, on ? EVIL : '#5a1a1a'); if (on) R(px, pl.y - 62, 1, 1, '#ffd0cc');
    heatWisps(px + 14, pl.y - 52, 3);
  }
}
// in front of the action (screen space, parallax 1.3): each piece belongs to the stretch of ground it passes at
// mid-screen, and only the camp's own are drawn, so nothing of ours ever hangs over a neighbour's ground
function campFront(cx) {
  const a = ART, off = cx * 1.3, sp = 110, t = G.t;
  for (let i = floor((off - 80) / sp); i * sp - off < W + 80; i++) {
    const k = nz(i, 2) * 5 | 0, sx = i * sp + nz(i, 1) * 50, home = (sx - W / 2) / 1.3 + W / 2;
    if (k > 3 || home < X0 + 70 || home > X1 - 70) continue;
    blit(ctx, a.front[k], round(sx - off), k === 1 ? H + 7 : k === 2 ? H + 9 : H + 4);
  }
  // dust motes drifting in the light, over the camp's stretch of the screen
  for (let i = 0; i < 26; i++) {
    const tt = t + i * 173, x = round(wrap(nz(i, 5) * 700 - tt * (0.12 + nz(i, 6) * 0.2) - cx * 1.1, W + 40) - 20);
    if (cx + x < X0 || cx + x >= X1) continue;
    const y = round(150 + nz(i, 7) * 96 + sin(tt * 0.013 + i * 2) * 7);
    ctx.fillStyle = sin(tt * 0.07 + i) > 0.3 ? 'rgba(255,246,210,0.9)' : 'rgba(255,240,196,0.45)'; ctx.fillRect(x, y, 1, 1);
  }
}

// ============================================================
// Baking, in steps (run once, in order, by level1_art.js: each paints some of the pictures above into ART)
// ============================================================
// Measured with tools/polish/build/camp/steps-cpu.mjs. The big strips are painted over several steps: SB holds a strip's
// pixel buffer until its last step bakes it.
const SB = {};
const steps = [
  function sky() {
    ART.sky = skyColumn();
    const b = buf(1, 200);
    for (let y = 0; y < 200; y++) { const k = ss(10, 150, y); if (k > 0.01) put(b, 0, y, AL(I('#ffb870'), k)); }
    ART.warm = bake(b);
    ART.sun = sunSprite(); ART.rays = [raySprite(0), raySprite(1)];
    ART.dust = dustTile();
  },
  function clouds1() { ART.clouds = []; for (let i = 0; i < 3; i++) { const [w, s, tall, low] = CLOUD_DEF[i]; ART.clouds[i] = cloudSprite(w, s, low ? CLOUD_LO : CLOUD_HI, 1, tall); } },
  function clouds2() { for (let i = 3; i < CLOUD_DEF.length; i++) { const [w, s, tall, low] = CLOUD_DEF[i]; ART.clouds[i] = cloudSprite(w, s, low ? CLOUD_LO : CLOUD_HI, 1, tall); } },
  function mountains1() { SB.mtn = stripBuf(0.03, 86, 150); farMountains(SB.mtn); },
  function mountains2() { ART.mtn = stripOf(SB.mtn, 0.03, farBase(SB.mtn)); SB.mtn = null; },
  function hillsA1() { SB.hA = stripBuf(0.07, 104, 172); hillRows(SB.hA, HILL_A, 0, 4); },
  function hillsA2() { hillRows(SB.hA, HILL_A, 4, 8); hillsAEnd(SB.hA); ART.hillA = stripOf(SB.hA, 0.07); SB.hA = null; },
  function hillsB1() { SB.hB = stripBuf(0.12, 116, 186); hillRows(SB.hB, HILL_B, 0, 2); },
  function hillsB2() { hillRows(SB.hB, HILL_B, 2, 5); },
  function hillsB3() { hillRows(SB.hB, HILL_B, 5, 7); hillsBEnd(SB.hB); ART.hillB = stripOf(SB.hB, 0.12); SB.hB = null; },
  function wall1() { SB.wall = stripBuf(0.2, 116, 186); jungleWall(SB.wall); },
  function wall2() { jungleWallEnd(SB.wall); ART.wall = stripOf(SB.wall, 0.2); SB.wall = null; },
  function yard1() { SB.yard = stripBuf(0.3, 132, 236); yardGround(SB.yard); },
  function yard2() { yardEdge(SB.yard); },
  function yard3() { yardWoods(SB.yard); },
  function yard4() { ART.yard = stripOf(SB.yard, 0.3, yardCamp(SB.yard)); SB.yard = null; },
  function fence1() { SB.fence = stripBuf(0.6, 128, 240); fenceStrip(SB.fence); },
  function fence2() { fenceLine(SB.fence); },
  function fence3() { fenceEnds(SB.fence); ART.fence = stripOf(SB.fence, 0.6); SB.fence = null; },
  function platforms() { for (const pl of L1ART.plats('camp')) platArt(pl); },
  function tents() {
    ART.tent = [mk(tentBuf(0)), mk(tentBuf(1)), mk(tentBuf(2))];
    ART.bags = [mk(sandbagsBuf([4, 3, 2], 1)), mk(sandbagsBuf([4, 3, 2], 2)), mk(sandbagsBuf([4, 3, 2], 3))];
    ART.drums = mk(drumsBuf());
  },
  function machines() {
    ART.jeep = mk(jeepBuf()); ART.radio = mk(radioBuf()); ART.pole = mk(flagpoleBuf());
    ART.sign = [mk(signBuf(true, true)), mk(signBuf(false, false))];
    ART.flags = [flagBuf(false), flagBuf(true)];
    ART.stump = [mk(stumpBuf(11, 8, true)), mk(stumpBuf(7, 5, false))];
    const b = buf(66, 30, -12, -26);
    mTruck(b, 0, 0, -1); haze(b, HAZE, () => 0.08);
    ART.truck = mk(b);
  },
  function palm1() { ART.palm = [mk(palmBuf(0))]; },
  function palm2() { ART.palm[1] = mk(palmBuf(1)); },
  function foreground() { ART.front = [mk(darken(sandbagsBuf([4, 3], 7))), mk(darken(wireBuf())), mk(darken(frontCrateBuf())), mk(darken(sandbagsBuf([3, 2], 9)))]; },
  ...CHUNK_X.map(x0 => function earth() { bakeChunk(x0); })
];

L1ART.camp = { x0: X0, x1: X1, steps, bg: campBG, behind: campBehind, ground: campGround, plat: campPlat, front: campFront };
}
