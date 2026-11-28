'use strict';
// =====================================================================================================================
// Mission 8 (DINOSAUR VALLEY) pixel kit. Loaded first of the Mission 8 files.
// Everything in the mission is painted by code: shapes go into small integer pixel buffers, get lit and outlined, and
// are baked once into canvases (with a white copy for the hit flash). Nothing here draws per frame except blit / glow.
//
// Exports (global M8; everything else is private to the block):
//   M8.px      buf put get rect shape oval poly line capsule tube bez outline form tint stamp flip trim bake mk blit
//              blitF canvasOf   (buffers hold 0xRRGGBB ints, NONE = empty; (0, 0) of a buffer is its origin ox, oy)
//   M8.I, M8.P        '#rrggbb' -> int; a ramp of ints from hex strings
//   M8.nz vn fbm      stable noise: per integer point, smooth, and layered (never Math.random: scenery must not move
//                     the seeded runs of other missions)
//   M8.rng(seed)      a private random stream for art
//   M8.mixI(a, b, k)  blend two int colours
//   M8.memo(f)        f's result, computed at its first call (sprites are baked when first needed, not at load)
//   M8.glow(x, y, r, col, a), M8.bang(x, y), M8.ring(x, y, r, fast)   soft light, the red '!', a dashed landing ring
//                     (rings are painted last, over everybody: M8.ringsBegin() / M8.rings(), called by the scenery)
// =====================================================================================================================
var M8 = {};
{
const Math = globalThis.Math;
const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
const P = (...s) => s.map(I);
const OUTI = I(OUT);
const lerp = (a, b, k) => a + (b - a) * k;
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };

// ---------------------------------------------------------------------------------------------------------------------
// Noise (stable: the same numbers on every run)
// ---------------------------------------------------------------------------------------------------------------------
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
const NZ = (() => { const r = rng(80808), a = new Float32Array(65536); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
const nz = (x, y = 0) => NZ[((Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0) & 65535];
function vn(x, y, s = 0) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = s * 57;
  return lerp(lerp(nz(i + o, j), nz(i + 1 + o, j), a), lerp(nz(i + o, j + 1), nz(i + 1 + o, j + 1), a), b);
}
function fbm(x, y, s = 0, oct = 3) { let v = 0, a = 1, n = 0, f = 1; for (let o = 0; o < oct; o++) { v += a * vn(x * f, y * f, s + o * 7); n += a; a *= 0.5; f *= 2.03; } return v / n; }
function mixI(a, b, k) {
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  return (Math.round(lerp(a >> 16 & 255, b >> 16 & 255, k)) << 16) | (Math.round(lerp(a >> 8 & 255, b >> 8 & 255, k)) << 8) | Math.round(lerp(a & 255, b & 255, k));
}

// ---------------------------------------------------------------------------------------------------------------------
// Pixel buffers
// ---------------------------------------------------------------------------------------------------------------------
function buf(w, h, ox = 0, oy = 0) { const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox, oy }; }
function put(b, x, y, c) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) {
  x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy;
  const x1 = Math.min(b.w, x + w), y1 = Math.min(b.h, y + h);
  for (let j = Math.max(0, y); j < y1; j++) for (let i = Math.max(0, x); i < x1; i++) b.d[j * b.w + i] = c;
}
// every pixel whose centre passes f(x, y) gets colour c, or c(x, y) (NONE / undefined = leave it)
function shape(b, x0, y0, x1, y1, f, c) {
  const fn = typeof c === 'function';
  const ya = Math.max(Math.floor(y0), -b.oy), yb = Math.min(Math.ceil(y1), b.h - 1 - b.oy);
  const xa = Math.max(Math.floor(x0), -b.ox), xb = Math.min(Math.ceil(x1), b.w - 1 - b.ox);
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    if (!f(x + 0.5, y + 0.5)) continue;
    const v = fn ? c(x + 0.5, y + 0.5) : c;
    if (v != null && v !== NONE) b.d[(y + b.oy) * b.w + x + b.ox] = v;
  }
}
function oval(b, cx, cy, rx, ry, c) { shape(b, cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, c); }
function inPoly(Q, x, y) {
  let c = false;
  for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) {
    const xi = Q[i][0], yi = Q[i][1], xj = Q[j][0], yj = Q[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function poly(b, Q, c) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of Q) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  shape(b, x0, y0, x1, y1, (x, y) => inPoly(Q, x, y), c);
}
function line(b, x0, y0, x1, y1, c, t = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), hw = (t - 1) / 2;
  for (let i = 0; i <= n; i++) rect(b, Math.round(x0 + (x1 - x0) * i / n - hw), Math.round(y0 + (y1 - y0) * i / n - hw), t, t, c);
}
// a round-ended segment whose radius goes from r0 to r1: limbs, tails, necks, trunks
function capsule(b, x0, y0, x1, y1, r0, r1, c) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, R = Math.max(r0, r1);
  shape(b, Math.min(x0, x1) - R - 1, Math.min(y0, y1) - R - 1, Math.max(x0, x1) + R + 1, Math.max(y0, y1) + R + 1, (x, y) => {
    const t = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1), r = r0 + (r1 - r0) * t;
    const ex = x - x0 - dx * t, ey = y - y0 - dy * t;
    return ex * ex + ey * ey <= r * r;
  }, c);
}
// capsules along a list of points, the radius going from r0 to r1
function tube(b, pts, r0, r1, c) {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) capsule(b, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], lerp(r0, r1, i / n), lerp(r0, r1, (i + 1) / n), c);
}
// points along a bezier: three control points (quadratic) or four (cubic)
function bez(p, n = 12) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    if (p.length === 3) o.push([u * u * p[0][0] + 2 * u * t * p[1][0] + t * t * p[2][0], u * u * p[0][1] + 2 * u * t * p[1][1] + t * t * p[2][1]]);
    else o.push([u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0], u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]]);
  }
  return o;
}
// a 1 px line round everything painted (4 neighbours)
function outline(b, c = OUTI) {
  const add = [], w = b.w, h = b.h, d = b.d;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i] !== NONE) continue;
    if ((x > 0 && d[i - 1] !== NONE) || (x < w - 1 && d[i + 1] !== NONE) || (y > 0 && d[i - w] !== NONE) || (y < h - 1 && d[i + w] !== NONE)) add.push(i);
  }
  for (const i of add) d[i] = c;
}
// Light a flat shape. Every pixel of colour `mark` becomes one tone of ramp (dark -> light): the shape is treated as a
// rounded form, curving for `depth` px in from its edge, lit from the upper left.
//   o.depth (4)   o.lx, o.ly (-0.62, -0.78: where the light comes from)   o.amb (0.5: the tone of flat parts, 0..1)
//   o.gain (0.75) o.dither (0: ordered dither between neighbouring tones, 0..1)   o.grain(x, y) -> about -0.5..0.5
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function form(b, mark, ramp, o = {}) {
  const w = b.w, h = b.h, d = b.d, n = w * h, depth = o.depth || 4;
  const lx = o.lx ?? -0.62, ly = o.ly ?? -0.78, amb = o.amb ?? 0.5, gain = o.gain ?? 0.75, dith = o.dither || 0, grain = o.grain;
  const D = new Float32Array(n);
  let any = false;
  for (let i = 0; i < n; i++) if (d[i] === mark) { D[i] = 1e3; any = true; }
  if (!any) return;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!D[i]) continue;
    let v = D[i];
    const l = x > 0 ? D[i - 1] : 0, u = y > 0 ? D[i - w] : 0, ul = x > 0 && y > 0 ? D[i - w - 1] : 0, ur = x < w - 1 && y > 0 ? D[i - w + 1] : 0;
    v = Math.min(v, l + 1, u + 1, ul + 1.4, ur + 1.4);
    D[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!D[i]) continue;
    let v = D[i];
    const r = x < w - 1 ? D[i + 1] : 0, dn = y < h - 1 ? D[i + w] : 0, dr = x < w - 1 && y < h - 1 ? D[i + w + 1] : 0, dl = x > 0 && y < h - 1 ? D[i + w - 1] : 0;
    v = Math.min(v, r + 1, dn + 1, dr + 1.4, dl + 1.4);
    D[i] = v;
  }
  const Hh = new Float32Array(n);
  for (let i = 0; i < n; i++) if (D[i]) { const k = Math.min(D[i], depth) / depth; Hh[i] = Math.sqrt(k * (2 - k)); }
  const top = ramp.length - 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!D[i]) continue;
    const gx = (x < w - 1 ? Hh[i + 1] : 0) - (x > 0 ? Hh[i - 1] : 0), gy = (y < h - 1 ? Hh[i + w] : 0) - (y > 0 ? Hh[i - w] : 0);
    let l = amb + gain * (gx * lx + gy * ly) * -1;
    if (grain) l += grain(x - b.ox, y - b.oy);
    let t = l * top;
    if (dith) t += ((BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5) * dith;
    d[i] = ramp[t <= 0 ? 0 : t >= top ? top : Math.round(t)];
  }
}
// recolour: f(colour, x, y) -> colour for every painted pixel
function tint(b, f) {
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const i = y * b.w + x; if (b.d[i] !== NONE) b.d[i] = f(b.d[i], x - b.ox, y - b.oy); }
}
// src painted into dst with its origin at (dx, dy)
function stamp(dst, src, dx = 0, dy = 0) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const v = src.d[y * src.w + x]; if (v !== NONE) put(dst, x - src.ox + dx, y - src.oy + dy, v); }
}
// mirror image about the origin's column
function flip(b) {
  const d = buf(b.w, b.h, b.w - 1 - b.ox, b.oy);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) d.d[y * b.w + (b.w - 1 - x)] = b.d[y * b.w + x];
  return d;
}
// the same picture in the smallest buffer that holds it (the origin stays where it was)
function trim(b) {
  let x0 = b.w, y0 = b.h, x1 = -1, y1 = -1;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.d[y * b.w + x] !== NONE) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return buf(1, 1, 0, 0);
  const d = buf(x1 - x0 + 1, y1 - y0 + 1, b.ox - x0, b.oy - y0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) d.d[(y - y0) * d.w + (x - x0)] = b.d[y * b.w + x];
  return d;
}
// white = the hit-flash copy (the outline stays dark)
function bake(b, white) {
  const c = canvasOf(b.w, b.h), g = c.getContext('2d'), im = g.createImageData(b.w, b.h), dd = im.data;
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = i * 4;
    if (white && v !== OUTI) dd[j] = dd[j + 1] = dd[j + 2] = 255;
    else { dd[j] = (v >> 16) & 255; dd[j + 1] = (v >> 8) & 255; dd[j + 2] = v & 255; }
    dd[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// a sprite: trimmed, baked, drawn with the buffer's origin at (x, y). flash: false = no white copy (scenery)
function mk(b, flash = true) { b = trim(b); return { img: bake(b), white: flash ? bake(b, true) : null, w: b.w, h: b.h, ox: b.ox, oy: b.oy }; }
const blit = (s, x, y) => ctx.drawImage(FLASH && s.white ? s.white : s.img, Math.round(x) - s.ox, Math.round(y) - s.oy);
// the same, facing f (1 = as painted, -1 = mirrored about the origin)
function blitF(s, x, y, f) {
  if (f >= 0) { blit(s, x, y); return; }
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(-1, 1);
  ctx.drawImage(FLASH && s.white ? s.white : s.img, -s.ox, -s.oy);
  ctx.restore();
}
const memo = f => { let v, done = false; return () => { if (!done) { v = f(); done = true; } return v; }; };

M8.px = { NONE, buf, put, get, rect, shape, oval, inPoly, poly, line, capsule, tube, bez, outline, form, tint, stamp, flip, trim, bake, mk, blit, blitF, canvasOf };
M8.I = I; M8.P = P; M8.OUTI = OUTI; M8.rng = rng; M8.nz = nz; M8.vn = vn; M8.fbm = fbm; M8.mixI = mixI; M8.memo = memo; M8.lerp = lerp;

// ---------------------------------------------------------------------------------------------------------------------
// Light and warnings (per frame)
// ---------------------------------------------------------------------------------------------------------------------
// soft additive light: one cached radial sprite per colour, scaled to r
const glows = {};
M8.glow = (x, y, r, col, a = 0.5) => {
  let s = glows[col];
  if (!s) {
    s = glows[col] = canvasOf(64, 64);
    const g = s.getContext('2d'), v = hex(col), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + v + ',1)'); gr.addColorStop(0.35, 'rgba(' + v + ',0.45)'); gr.addColorStop(1, 'rgba(' + v + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(a, 0, 1);
  ctx.drawImage(s, Math.round(x - r), Math.round(y - r), r * 2, r * 2);
  ctx.restore();
};
// the red '!' every robot shows before it attacks (the same mark as the Oggles of Mission 5)
M8.bang = (x, y, t = G.t) => {
  if (Math.floor(t / 5) % 2) return;
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = OUT; ctx.fillRect(x - 2, y - 10, 5, 8); ctx.fillRect(x - 2, y - 1, 5, 4);
  ctx.fillStyle = '#ff3b30'; ctx.fillRect(x - 1, y - 9, 3, 6); ctx.fillRect(x - 1, y, 3, 2);
  ctx.fillStyle = '#ffd6d1'; ctx.fillRect(x - 1, y - 9, 1, 5);
};
// A dashed ring lying on the ground at (x, y): where something is about to land. It is painted over everybody: a
// warning must not hide behind the one it is for, least of all under the hero's own boots (a raptor aims at where he
// stands). So in Mission 8 M8.ring only notes the ring, and the level's front layer paints the noted ones
// (M8.rings(), in world space; M8.ringsBegin() empties the list when a frame starts). In any other level (the
// sandbox) the ring is painted at once.
const RINGS = [];
function paintRing(x, y, r, fast) {
  const on = Math.floor(G.t / (fast ? 3 : 5)) % 2 === 0, n = Math.max(12, Math.round(r * 1.6));
  ctx.fillStyle = 'rgba(20,8,14,0.4)'; ctx.fillRect(x - Math.round(r * 0.6), y - 1, Math.round(r * 0.6) * 2 + 1, 2);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, px = Math.round(x + Math.cos(a) * r), py = Math.round(y - 1 + Math.sin(a) * r * 0.3);
    ctx.fillStyle = (i % 2 === 0) === on ? '#ff3b30' : '#ffe066';
    ctx.fillRect(px, py - 1, 2, 2);
  }
}
M8.ring = (x, y, r, fast) => {
  x = Math.round(x); y = Math.round(y);
  if (typeof L8 !== 'undefined' && L8.inM8 && L8.inM8() && RINGS.length < 64) RINGS.push([x, y, r, !!fast]);
  else paintRing(x, y, r, fast);
};
M8.ringsBegin = () => { RINGS.length = 0; };
M8.rings = () => { for (const q of RINGS) paintRing(q[0], q[1], q[2], q[3]); RINGS.length = 0; };
// white speech bubble with red text, its tail pointing down at (x, y); side = true: the bubble sits to the LEFT of
// (x, y), its tail pointing right at it (for a speaker near the top of the screen)
M8.bubble = (x, y, s, col = '#e0302a', side = false) => {
  x = Math.round(x); y = Math.round(y);
  const w = s.length * 6 + 3, F = FLASH;
  ctx.save(); ctx.translate(x, y); FLASH = false;
  if (side) {
    const l = -w - 5, by = -6;
    RO(l, by, w, 11, '#ffffff'); R(l, by + 10, w, 1, '#d8dce6');
    R(l + w, -2, 1, 5, '#ffffff'); R(l + w + 1, -1, 1, 3, '#ffffff'); R(l + w + 2, 0, 1, 1, '#ffffff');
    R(l + w, -3, 1, 1, OUT); R(l + w, 3, 1, 1, OUT); R(l + w + 1, -2, 1, 1, OUT); R(l + w + 1, 2, 1, 1, OUT); R(l + w + 2, -1, 1, 1, OUT); R(l + w + 2, 1, 1, 1, OUT); R(l + w + 3, 0, 1, 1, OUT);
    text(s, l + Math.floor(w / 2) + 1, by + 2, col, 1, 'center', null);
  } else {
    const l = -Math.floor(w / 2), by = -14;
    RO(l, by, w, 11, '#ffffff'); R(l, by + 10, w, 1, '#d8dce6');
    R(-2, by + 11, 5, 1, '#ffffff'); R(-1, by + 12, 3, 1, '#ffffff'); R(0, by + 13, 1, 1, '#ffffff');
    R(-3, by + 11, 1, 1, OUT); R(3, by + 11, 1, 1, OUT); R(-2, by + 12, 1, 1, OUT); R(2, by + 12, 1, 1, OUT); R(-1, by + 13, 1, 1, OUT); R(1, by + 13, 1, 1, OUT); R(0, by + 14, 1, 1, OUT);
    text(s, 1, by + 2, col, 1, 'center', null);
  }
  FLASH = F; ctx.restore();
};
}
