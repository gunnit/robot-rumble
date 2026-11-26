'use strict';
var L3 = L3 || {};
// ============================================================
// Mission 3 (VOLCANO ISLAND) bees: the robot BEE (a swarm that flies in a loose V; the point bee's stinger glows
// orange, then white with a sparkle, then it dives straight at where the hero stood and climbs back), the robot
// HIVE (hangs from a branch it draws itself, shakes before each bee it lets out, bursts into hexagon plates and drops
// honey), the AREA 2 mini-boss QUEEN BEE (calls bees, a stinger fan after a glowing wind-up, a swooping dive with a
// shadow on the ground first; a crown-pop death that ends with e.dead = true), the stinger dart and the honey bonus.
// Everything is private to this block: the game reaches it through ENEMY_TYPES bee / hive / queenbee,
// EB_TYPES.stinger and ITEMS.honey (and L3.beeBusy() for the other Mission 3 files). Art: the proposal's jungle painters (pixel buffers, shaded parts, 1px OUT
// outlines), every sprite baked once at load. No Math.random/rand at load time or in drawing.
// ============================================================
{
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
const NZT = (() => { const r = rng(770213), a = new Float32Array(16384); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
const nz = (x, y) => NZT[((Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0) & 16383];
function vn(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), o = (s | 0) * 977;
  return lerp(lerp(nz(i + o, j), nz(i + 1 + o, j), a), lerp(nz(i + o, j + 1), nz(i + 1 + o, j + 1), a), b);
}
const I = s => parseInt(s.slice(1, 7), 16);
const P = (...s) => s.map(I);
const NONE = -1, OUTI = I(OUT), EVIL_I = I(EVIL);
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
// a canvas from buffers: `layers` = [[buffer, alpha], ...] painted in order; white = the hit-flash copy (OUT stays)
function bake(layers, white) {
  const b0 = layers[0][0], c = document.createElement('canvas'); c.width = b0.w; c.height = b0.h;
  const g = c.getContext('2d'), im = g.createImageData(b0.w, b0.h), dd = im.data;
  for (const [b, a] of layers) for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = i * 4;
    if (white && v !== OUTI) dd[j] = dd[j + 1] = dd[j + 2] = 255;
    else { dd[j] = v >> 16 & 255; dd[j + 1] = v >> 8 & 255; dd[j + 2] = v & 255; }
    dd[j + 3] = Math.round(255 * a);
  }
  g.putImageData(im, 0, 0);
  return c;
}
// a sprite: anchor (ax, ay) = the buffer origin (ox, oy)
function mk(b, white) { return { img: bake([[b, 1]]), white: white ? bake([[b, 1]], true) : null, w: b.w, h: b.h, ax: b.ox, ay: b.oy }; }
function blit(s, x, y) { ctx.drawImage(FLASH && s.white ? s.white : s.img, Math.round(x) - s.ax, Math.round(y) - s.ay); }
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
// a pixel ellipse outline (rings on the ground)
function pring(x, y, rx, ry, c) {
  ctx.fillStyle = c;
  const n = Math.max(16, Math.round((rx + ry) * 4));
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), 1, 1); }
}
// a twinkling 4-point star
function star(x, y, r, c) {
  x = Math.round(x); y = Math.round(y);
  R(x - r, y, r * 2 + 1, 1, c); R(x, y - r, 1, r * 2 + 1, c);
  if (r > 2) { R(x - 1, y - 1, 3, 3, c); }
}

// ------------------------------------------------------------ robots from shaded parts (the proposal's method)
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

// ------------------------------------------------------------ palettes
const ST4 = P('#e2e9ef', '#a9b5c2', '#6f7b8b', '#48505c');     // steel
const HD4 = P('#9eacbc', '#67727f', '#454d59', '#2c323b');     // dark steel head
const YEL4 = P('#fff3a6', '#ffd23f', '#e2a316', '#a26a0a');    // bee yellow
const BLK4 = P('#5e5e70', '#35353f', '#24242c', '#18181e');    // bee black
const GOLD = P('#fff3a0', '#ffd23f', '#e09a14', '#a86a0a');
const ROY4 = P('#d9a0ff', '#a45ce0', '#7434b0', '#4a1d78');    // the queen's royal violet
const BARK = P('#a39078', '#80705e', '#625549', '#463d35');
const MOSS = P('#b8e06c', '#88c04a', '#5e9838', '#3e6e2a');
const LEAF = P('#92d45e', '#5ea445', '#3f7e36', '#295c29');
const HON = P('#fff1a8', '#ffcf4a', '#f2a325', '#c0700f');
const LEG = I('#2a2f37');
const RUFF = P('#ffffff', '#eef2f6', '#c8d2dc', '#97a3b0');   // the queen's frilled collar

// ============================================================
// The robot BEE: sprites for a fixed set of poses, baked at load
// ============================================================
// ang: body tilt (+ = nose down), abd: abdomen angle (0 = straight back, + = curled under), glow 0 / 1 charging / 2 hot
function beeBuild(ang, abd, glow) {
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
  for (const [u0, v0, u1, v1] of [[0, 4.6, -1.8, 7.6], [2.2, 4.8, 1.8, 8], [4.2, 4.2, 6, 7]]) thin(u0, v0, u1, v1, LEG);
  for (const [pts, bulb] of [[[[6.8, -4.4], [7.8, -7.6], [10.2, -9.8]], [10.8, -10.4]], [[[5.4, -4.6], [5.6, -8], [7.4, -10.6]], [7.9, -11.3]]]) {
    for (let k = 0; k + 1 < pts.length; k++) thin(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], LEG);
    const [x, y] = L(bulb[0], bulb[1]);
    put(b, x, y, I('#ffe066')); put(b, x + 1, y, I('#c89a20')); put(b, x, y - 1, I('#fff6c0'));
  }
  // wings: a far one behind the body and a near one in front; see-through glass in a steel frame; 3 beat frames
  const wings = [];
  for (const WA of [-1.72, -2.42, -2.95]) {
    const pair = [];
    for (const far of [1, 0]) {
      const base = far ? [2.6, -4.2] : [0.4, -4], a = WA + (far ? -0.3 : 0), len = far ? 10.4 : 11.8, wd = far ? 3.8 : 4.6;
      const cL = L(base[0] + Math.cos(a) * len * 0.52, base[1] + Math.sin(a) * len * 0.52), aa = ang + a;
      const fill = buf(56, 50, 28, 25), frame = buf(56, 50, 28, 25), hit = ell(cL[0], cL[1], len * 0.52, wd, aa), rr = len * 0.52 + 2;
      for (let y = Math.max(0, Math.floor(cL[1] + 25 - rr)); y < Math.min(50, cL[1] + 25 + rr); y++) for (let x = Math.max(0, Math.floor(cL[0] + 28 - rr)); x < Math.min(56, cL[0] + 28 + rr); x++) {
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
      pair.push(bake([[fill, far ? 0.42 : 0.5], [frame, 1]]));
    }
    wings.push(pair);
  }
  const st = L(tip[0] + dA[0] * 5, tip[1] + dA[1] * 5);
  return { body: mk(b, true), wings, tip: st };
}
// the poses: cruising, flying fast, climbing back, three steps of the abdomen curling forward while the stinger
// charges (orange), the aim (white-hot), and the dive at 10 angles (stinger first along the dive line)
const BEE_DIVE0 = -0.2, BEE_DIVES = 10;
const BEE = {};
for (const [k, a, d, g] of [['fly', 0, 0.25, 0], ['fast', 0.2, 0.3, 0], ['climb', -0.35, 0.35, 0], ['ch0', -0.05, 0.75, 1], ['ch1', -0.1, 1.25, 1], ['ch2', -0.15, 1.7, 1], ['aim', -0.2, 2.0, 2]])
  BEE[k] = beeBuild(a, d, g);
for (let i = 0; i < BEE_DIVES; i++) BEE['d' + i] = beeBuild(BEE_DIVE0 + i * 0.2 - 0.877, 2.26, 2);

// small burst parts: bolt, striped plate, glass shard, steel and honey hexagons, a broken strap end
function hexBuf(r, c0, c1, c2) {
  const b = buf(r * 2 + 3, r * 2 + 3, r + 1, r + 1), SQ3 = Math.sqrt(3);
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const ax = Math.abs(x + 0.5 - 0.5), ay = Math.abs(y);
    if (ay > r * SQ3 / 2 + 0.2 || ax * SQ3 / 2 + ay / 2 > r * SQ3 / 2 + 0.2) continue;
    put(b, x, y, x + y < -r * 0.6 ? c0 : x + y > r * 0.5 ? c2 : c1);
  }
  outline(b);
  return b;
}
const PIECE = (() => {
  const b1 = buf(5, 5, 2, 2); rect(b1, -1, -1, 3, 3, I('#8a97a8')); put(b1, -1, -1, I('#c3cdd8')); put(b1, 0, 0, I('#3b424d')); outline(b1);
  const b2 = buf(9, 6, 4, 3); rect(b2, -3, -1, 7, 3, YEL4[1]); rect(b2, -3, -1, 7, 1, YEL4[0]); rect(b2, -1, -1, 2, 3, BLK4[1]); outline(b2);
  const b3 = buf(8, 6, 4, 3); rect(b3, -3, -1, 6, 2, I('#e2f7ff')); put(b3, -3, -1, I('#ffffff')); outline(b3, I('#3f5a72'));
  const b4 = buf(8, 5, 4, 2); rect(b4, -3, -1, 7, 2, BLK4[1]); rect(b4, -3, -1, 7, 1, BLK4[0]); put(b4, 2, 0, YEL4[1]); outline(b4);
  return {
    bolt: mk(b1), plate: mk(b2), shard: mk(b3), dark: mk(b4),
    hex: mk(hexBuf(3, ST4[0], ST4[1], ST4[2])), hexD: mk(hexBuf(3, ST4[1], ST4[2], ST4[3])), hexBig: mk(hexBuf(4, ST4[0], ST4[1], ST4[2])),
    hexH: mk(hexBuf(3, HON[0], HON[1], HON[2]))
  };
})();
// tumbling parts: sprite particles that fall, bounce on the ground and spin (the engine draws them)
function bit(x, y, s, vx, vy, life = 60) {
  if (G.parts.length > 620) return;
  G.parts.push({ type: 'sprite', x, y, vx, vy, g: 0.2, rot: rand(0, 6.28), vr: rand(-0.35, 0.35), s, life: life + rand(0, 20), max: life + 20 });
}

// ============================================================
// BEE behaviour: one swarm on screen, in a loose V pointing at the hero; only the point bee attacks
// ============================================================
let beeSeq = 0;
const SW = { t: -1, n: 0, dir: 1, ax: 0, ay: 100, cd: 0, gone: 999, list: [] };
const FORM = { enter: 1, hover: 1, charge: 1, aim: 1, climb: 1 };
const scrL = () => G.cam.x;
const queenBusy = () => G.enemies.some(o => o.type === 'queenbee' && !o.dead && !o.dying && (o.state === 'fan' || o.state === 'swoop' || o.state === 'rise' || o.state === 'intro'));
// Fair play for kids: ONE beat for every bee attack (and the queen's). A bee may only start its warning (the orange
// stinger) once G.t >= BEAT.next: not while the intro or the MISSION START band shows, nor for CALM_START frames after
// control returns; not within DIVE_GAP frames of the last dive's end (dives never come back to back); not within
// QUEEN_GAP frames of the queen's last fan or swoop. Timestamps on G.t (always running), so a continue / quit / new
// start can't leave a stale wait behind. Numbers for the tuner: see notes-B.md.
const CALM_START = 60, DIVE_GAP = 150, QUEEN_GAP = 45, DIVE_DY = 60;   // DIVE_GAP: retune, was 90
// the white-hot aim (target locked, ring blinking) before the dive: was 20; 28 lets a kid who reacts in ~0.5 s walk
// out of the ring either way (away from the bee, or under it before it comes down)
const AIM_T = 28;
// retune: each bee dives at most DIVE_MAX times, then buzzes off (out of the screen, up and away): a bee is a short
// danger, not a pest that stays until it is shot (the hive sends the next one)
const DIVE_MAX = 1;
// retune: a new bee (placed, from a hive, a lock, the queen or the whale) flies about for FIRST_CD frames before it may
// start its first warning: time to see it coming and shoot it (was 50; hive bees 70, the queen's 90)
const FIRST_CD = 150;
const BEAT = { next: 0 };
const calmTick = () => { if (G.intro || G.big || G.state !== 'play') BEAT.next = Math.max(BEAT.next, G.t + CALM_START); };
const beeAttacking = () => G.enemies.some(o => o.type === 'bee' && !o.dead && !o.dying && (o.state === 'charge' || o.state === 'aim' || o.state === 'dive'));
// for the other Mission 3 files: true while a bee's attack is live (its warning or its dive), so a shark, the whale or
// a lava bomb can wait for it the same way the bees wait for them
L3.beeBusy = beeAttacking;
// nor while another big telegraphed attack is live: a shark's or lava shark's warning or leap (L3.lavaSharkBusy too,
// when the enemies file has it), the whale's vacuum / spit / dive / steam. Only the START of a bee's warning waits.
const WHALE_BUSY = { vac: 1, spit: 1, dive: 1, steam: 1 };
const othersBusy = () => (typeof L3 !== 'undefined' && L3.lavaSharkBusy && L3.lavaSharkBusy()) ||
  G.enemies.some(o => !o.dead && (((o.type === 'shark' || o.type === 'lavashark') && !o.pieces && (o.state === 'warn' || o.state === 'leap')) ||
    (o.type === 'megawhale' && WHALE_BUSY[o.state])));
// the swarm's formation, once per frame (whichever bee updates first)
function swarm() {
  if (SW.t === G.t) return SW;
  calmTick();
  // no bee updated last frame (the swarm died out, or a continue / quit / new start rebuilt the level): a new swarm,
  // so the next bee forms near the hero instead of steering to the old (off-screen) anchor
  if (G.t - SW.t > 1) { SW.n = 0; SW.gone = 999; SW.cd = 0; SW.list = []; }
  SW.t = G.t;
  const p = G.p, L = scrL();
  const bees = G.enemies.filter(o => o.type === 'bee' && o.active && !o.dead && !o.dying);
  const form = bees.filter(o => FORM[o.state]).sort((a, b) => a.order - b.order);
  if (!form.length) { SW.n = 0; SW.list = form; SW.gone++; if (SW.cd > 0) SW.cd--; return SW; }
  let cx = 0, cy = 0;
  for (const o of form) { cx += o.x; cy += o.y; }
  cx /= form.length; cy /= form.length;
  // a new swarm (none on screen for a while): the formation starts where the bees are, at a flying height
  if (!SW.n && SW.gone > 60) { SW.dir = cx >= p.x ? 1 : -1; SW.ax = cx; SW.ay = Math.min(cy, 128); SW.cd = Math.max(SW.cd, 70); }
  else if ((SW.dir > 0 && cx < p.x - 60) || (SW.dir < 0 && cx > p.x + 60)) SW.dir = -SW.dir;   // the hero ran past
  SW.gone = 0;
  const rows = Math.ceil((form.length - 1) / 2), tail = rows * 24;
  let tx = p.x + SW.dir * 74;
  tx = clamp(tx, L + 30 + (SW.dir < 0 ? tail : 0), L + W - 30 - (SW.dir > 0 ? tail : 0));
  SW.ax += clamp(tx - SW.ax, -0.6, 0.6);
  SW.ax = clamp(SW.ax, L - 20, L + W + 20);   // a hero running ahead drags the V along: it never lags off screen (where a
                                              // bee still entering would fly off and be culled)
  const ty = clamp(heroFloor(p) - 104, 64, 128) + Math.sin(G.t * 0.017) * 6;   // ~100 px over the floor he stands on
  SW.ay += clamp(ty - SW.ay, -0.4, 0.4);
  form.forEach((o, k) => {
    const r = Math.ceil(k / 2), s = k % 2 ? -1 : 1;
    o.sx = SW.ax + SW.dir * r * 24 + Math.sin(G.t * 0.03 + o.ph) * 3;
    o.sy = SW.ay + (k ? s * r * 15 : 0) + Math.cos(G.t * 0.025 + o.ph * 1.7) * 3;
    o.slot = k;
  });
  SW.n = form.length; SW.list = form;
  if (SW.cd > 0) SW.cd--;
  return SW;
}
function beeSound(kind) {
  if (kind === 'charge') Snd.tone('sawtooth', 220, 330, 0.35, 0.025);
  else if (kind === 'aim') Snd.tone('square', 900, 1300, 0.12, 0.03);
  else if (kind === 'dive') Snd.tone('sawtooth', 700, 260, 0.3, 0.035);
  else if (kind === 'pop') { Snd.tone('square', 500, 1100, 0.06, 0.05); Snd.noise(0.12, 0.08, 2500); }
}
function beeOnScreen(e, m = 8) { const L = scrL(); return e.x > L + m && e.x < L + W - m; }
// the floor under the hero, for the dive's target ring: his feet when he stands (ground, log, catwalk), the bottom of
// his ride, or (in a jump) the ground or the highest platform below him
function heroFloor(p) {
  if (p.ride) {   // on the water (the jet-ski): just above the water line (its crest is drawn in front); else the ride's bottom
    const w = LV.water && LV.water.find(o => p.x >= o.x0 && p.x <= o.x1), b = pbox(p);
    return w ? Math.min(w.y - 3, b.y + b.h) : b.y + b.h;
  }
  if (p.onGround) return p.y;
  let f = groundAt(p.x);
  for (const pl of LV.plats) if (pl.y >= p.y - 2 && pl.y < f && p.x > pl.x - 3 && p.x < pl.x + pl.w + 3) f = pl.y;
  return f;
}
// retune: no bee warning starts while the hero is over a lava river (on a column, or hopping): bees wait for a bank,
// where stepping out of the ring is a plain walk (the lava sharks and lava bombs already keep the columns busy)
const overLava = p => !!(LV.lava && LV.lava.some(r => p.x > r.x0 - 10 && p.x < r.x1 + 10));
const ringW = p => p.ride ? Math.max(12, Math.round(pbox(p).w / 2) + 14) : 12;   // the ring's half width

function updBee(e) {
  const p = G.p, L = scrL();
  e.st++;
  if (e.popT > 0 && --e.popT === 0) { damageEnemy(e, 99); return; }   // the queen fell: her bees pop one by one
  const sw = swarm();
  const steer = (tx, ty, acc, max) => {
    e.vx += clamp((tx - e.x) * acc, -0.5, 0.5) - e.vx * 0.12;
    e.vy += clamp((ty - e.y) * acc, -0.5, 0.5) - e.vy * 0.12;
    const v = Math.hypot(e.vx, e.vy);
    if (v > max) { e.vx *= max / v; e.vy *= max / v; }
  };
  switch (e.state) {
    case 'emerge':   // drops out of the hive's door, then joins the swarm
      e.vx = e.facing * 0.5; e.vy = e.st < 10 ? 0.9 : 0.2;
      if (e.st >= 18) { e.state = 'enter'; e.st = 0; }
      break;
    case 'enter': case 'hover': case 'climb': {
      const tx = e.sx != null ? e.sx : clamp(p.x + 80, L + 30, L + W - 30), ty = e.sy != null ? e.sy : 100;
      steer(tx, ty, 0.02, e.state === 'hover' ? 1.3 : 2.2);
      if (e.state !== 'hover' && Math.hypot(tx - e.x, ty - e.y) < 12) { e.state = 'hover'; e.st = 0; }
      if (e.cd > 0) e.cd--;
      // the point bee of the V starts the next dive
      if (e.state === 'hover' && e.slot === 0 && sw.cd <= 0 && e.cd <= 0 && G.t >= BEAT.next && !G.intro && !G.big && !p.dead && !p.hidden && G.state === 'play' && beeOnScreen(e, 14)) {
        // only a dive a kid can read: from at least DIVE_DY above the spot he stands on, and steep (no flat skim along
        // the ground: the danger stays near the ring on the floor)
        const dx = Math.abs(p.x - e.x), dy = heroFloor(p) - 15 - e.y;
        if (dx > 20 && dx < 190 && dy >= DIVE_DY && dy >= dx * 0.6 && !beeAttacking() && !queenBusy() && !othersBusy() && !overLava(p)) { e.state = 'charge'; e.st = 0; beeSound('charge'); }
      }
      break;
    }
    case 'charge':   // getting ready: hovers in place, the stinger glows orange, the abdomen curls forward
      // never mind (still orange, nothing locked yet): the hero was swallowed (the whale), or another big attack started
      // its warning meanwhile (a shark, the whale, the queen's entrance): one danger at a time
      if (p.hidden || othersBusy() || queenBusy()) { e.state = 'hover'; e.st = 0; e.cd = Math.max(e.cd, 20); break; }
      e.vx *= 0.8; e.vy *= 0.8;
      e.facing = p.x < e.x ? -1 : 1;
      if (e.st % 5 === 2 && G.parts.length < 600) {   // hot drips off the glowing stinger
        const tp = BEE[beePose(e)].tip;
        G.parts.push({ type: 'spark', x: e.x + e.facing * tp[0], y: e.y + tp[1], vx: rand(-0.3, 0.3), vy: 0.3, g: 0.08, life: 14, max: 14, size: 1, c: e.st > 18 ? '#ffd040' : '#ff8a30' });
      }
      if (e.st >= 30) {
        e.state = 'aim'; e.st = 0; beeSound('aim');
        // where the hero stands now: the dive goes there, with its ring on the floor (drawBee). A hero in a jump is aimed
        // at on the floor under him (where the ring is), not in the air
        e.tx = p.x; e.fy = heroFloor(p); e.fr = ringW(p); e.ty = (p.ride ? p.y : e.fy) - 15;
      }
      break;
    case 'aim':      // now! white-hot stinger with a sparkle; it leans back a little before it goes
      e.facing = e.tx < e.x ? -1 : 1;
      e.vx = -e.facing * 0.25; e.vy = -0.12;
      if (e.st >= AIM_T) {
        const dx = e.tx - e.x, dy = Math.max(e.ty - e.y, 10), d = Math.hypot(dx, dy) || 1;
        e.dvx = dx / d * 3.5; e.dvy = dy / d * 3.5; e.dleft = d / 3.5 + 5;
        e.state = 'dive'; e.st = 0; beeSound('dive');
        sw.cd = sw.n >= 3 ? 90 : sw.n === 2 ? 110 : 130;
      }
      break;
    case 'dive':     // straight at where the hero stood, a little past it
      e.vx = e.dvx; e.vy = e.dvy;
      if (--e.dleft <= 0 || e.y > groundAt(e.x) - 9) {
        e.state = 'pull'; e.st = 0; e.vy = Math.min(e.vy, 2.2); e.dives++;
        BEAT.next = Math.max(BEAT.next, G.t + DIVE_GAP);   // a breather before the next bee's warning
      }
      break;
    case 'pull':     // swoops back up
      e.vy -= 0.24; e.vx *= 0.96;
      if (e.y > groundAt(e.x) - 6) e.y = groundAt(e.x) - 6;
      if (e.vy < -1.4) {
        if (e.dives >= DIVE_MAX) { e.state = 'leave'; e.st = 0; e.lx = e.x < L + W / 2 ? L - 40 : L + W + 40; }
        else { e.state = 'climb'; e.st = 0; e.order = ++beeSeq; e.cd = 40; }
      }
      break;
    case 'leave':    // done: up and away out of the nearer screen side (gone once it is off screen)
      steer(e.lx, 44, 0.02, 2.4);
      e.lx = e.lx < L + W / 2 ? Math.min(e.lx, L - 40) : Math.max(e.lx, L + W + 40);   // the screen may scroll meanwhile
      if (e.x < L - 24 || e.x > L + W + 24) { e.dead = true; return; }
      break;
  }
  e.x += e.vx; e.y += e.vy;
  if (e.state !== 'dive' && e.state !== 'pull' && e.state !== 'emerge' && e.state !== 'leave') {
    // keep a little apart from the other bees and inside the screen
    for (const o of sw.list) {
      if (o === e) continue;
      const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy);
      if (d < 18 && d > 0.01) { e.x += dx / d * 0.5; e.y += dy / d * 0.5; }
    }
    if (e.state !== 'enter') e.x = clamp(e.x, L + 10, L + W - 10);
    e.y = clamp(e.y, 30, groundAt(e.x) - 30);
  }
  if (e.state === 'dive' || e.state === 'pull') e.facing = e.vx < 0 ? -1 : 1;
  else if ((e.state === 'enter' || e.state === 'leave') && Math.abs(e.vx) > 0.6) e.facing = e.vx < 0 ? -1 : 1;
  else if (e.state === 'hover' || e.state === 'climb') e.facing = p.x < e.x ? -1 : 1;
  // a soft buzz now and then while on screen
  if (beeOnScreen(e) && (e.t + e.ph * 11) % 150 === 0) Snd.tone('sawtooth', 170, 190, 0.18, 0.012);
}

function beePose(e) {
  switch (e.state) {
    case 'charge': return e.st < 10 ? 'ch0' : e.st < 20 ? 'ch1' : 'ch2';
    case 'aim': return 'aim';
    case 'dive': {
      const th = Math.atan2(e.vy, Math.abs(e.vx) + 0.001);
      return 'd' + clamp(Math.round((th - BEE_DIVE0) / 0.2), 0, BEE_DIVES - 1);
    }
    case 'pull': case 'climb': return 'climb';
    default: return Math.abs(e.vx) > 1 ? 'fast' : 'fly';
  }
}
function drawBee(e) {
  const pose = beePose(e), s = BEE[pose], dive = e.state === 'dive';
  const wf = (G.t + e.ph) % 3, bob = dive || e.state === 'pull' ? 0 : Math.round(Math.sin(G.t * 0.19 + e.ph) * 1.5);
  // the target on the floor (the kid's tell, drawn under the hero): while the stinger glows orange a soft orange ring
  // follows the hero ("this bee wants you"); when it turns white the ring stops where the dive will go and blinks
  // red / white like the game's other landing rings (step out of it!) until the bee has gone by
  const p = G.p, lock = e.state === 'aim' || dive;
  if (lock ? e.fy != null : e.state === 'charge' && e.st >= 6 && p && !p.dead) {
    const k = lock ? 1 : Math.min(1, (e.st - 6) / 16), x = lock ? e.tx : p.x, y = (lock ? e.fy : heroFloor(p)) - 1, on = (G.t >> 2) % 2 === 0;
    const rw = lock ? e.fr : ringW(p);   // wider round a ride, so it shows past the hull
    if (lock) {
      pring(x, y, rw + 1, 4, on ? 'rgba(255,59,48,0.55)' : 'rgba(255,255,255,0.45)');
      pring(x, y, rw, 3, on ? '#ff3b30' : '#ffffff');
    } else pring(x, y, rw - 4 + 4 * k, 2 + k, rgba(I('#ff9a40'), 0.4 + 0.5 * k));
  }
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y) + bob); ctx.scale(e.facing, 1);
  FLASH = e.hitT > 0;
  if (dive && !FLASH) {
    // speed lines streaming back from the dive (local space: the bee faces its motion)
    const v = Math.hypot(e.vx, e.vy) || 1, mx = Math.abs(e.vx) / v, my = e.vy / v;
    for (const [o, l] of [[-6, 11], [0, 18], [6, 10]]) {
      const sx = -mx * 10 - my * o, sy = -my * 10 + mx * o;
      pl(sx, sy, sx - mx * l, sy - my * l, 1, 'rgba(255,255,255,0.75)');
    }
  }
  // wing blur: the last beat frame as a ghost under the current one
  ctx.globalAlpha = 0.3; ctx.drawImage(s.wings[(wf + 2) % 3][0], -28, -25); ctx.globalAlpha = 1;
  ctx.drawImage(s.wings[wf][0], -28, -25);
  blit(s.body, 0, 0);
  ctx.globalAlpha = 0.3; ctx.drawImage(s.wings[(wf + 2) % 3][1], -28, -25); ctx.globalAlpha = 1;
  ctx.drawImage(s.wings[wf][1], -28, -25);
  if (!FLASH && (e.state === 'charge' || e.state === 'aim' || dive)) {
    // the stinger glow: orange while charging (growing), white-hot with a sparkle when it goes
    const [tx, ty] = s.tip, hot = e.state !== 'charge', pulse = 0.75 + 0.25 * Math.sin(G.t * 0.6);
    const grow = hot ? 1 : 0.5 + e.st / 60;
    ctx.fillStyle = rgba(I(hot ? '#ffd040' : '#ff8a30'), (hot ? 0.38 : 0.34) * pulse); pdisc(tx, ty, Math.round((hot ? 7 : 5) * grow));
    ctx.fillStyle = rgba(I(hot ? '#fff0a0' : '#ffb050'), (hot ? 0.65 : 0.62) * pulse); pdisc(tx, ty, Math.max(1, Math.round((hot ? 3 : 2.5) * grow)));
    if (!hot) R(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2, '#ffd080');
    if (e.state === 'aim') {
      const r = 3 + ((e.st >> 1) % 3) * 2;
      star(tx, ty, r, '#fffbe0'); R(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3, '#ffffff');
      if ((e.st >> 2) % 2 === 0) { R(Math.round(tx) - 5, Math.round(ty) - 5, 1, 1, '#ffffff'); R(Math.round(tx) + 5, Math.round(ty) + 4, 1, 1, '#ffffff'); }
    } else if (dive) R(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3, '#ffffff');
  }
  FLASH = false;
  ctx.restore();
}

function beeKill(e, cx, cy, b) {
  if (e.state === 'charge' || e.state === 'aim' || e.state === 'dive') BEAT.next = Math.max(BEAT.next, G.t + DIVE_GAP);   // shot down mid-attack: same breather
  boom(cx, cy, 0.45); sparks(cx, cy, 6, '#ffe066'); beeSound('pop');
  bit(cx, cy, PIECE.plate, rand(-1.8, -0.4), rand(-3.2, -1.6)); bit(cx, cy, PIECE.dark, rand(0.4, 1.8), rand(-3.4, -1.8));
  bit(cx, cy, PIECE.shard, rand(-1.2, 1.2), rand(-3.6, -2.2)); bit(cx, cy, PIECE.shard, rand(-2, 2), rand(-2.4, -1));
  bit(cx, cy, PIECE.bolt, rand(-2, 2), rand(-3, -1.5));
  addScore(100, cx, b.y);
}

ENEMY_TYPES.bee = {
  hp: 1, flying: true, edge: 16,   // retune: hp 1 (was 2), one shot pops it
  contact: e => e.state === 'dive' ? 'hurt' : 'none',
  make(e, s) {
    e.id = ++beeSeq; e.order = e.id; e.ph = (e.id * 7) % 13;
    e.state = s.emerge ? 'emerge' : 'enter'; e.st = 0; e.vx = 0; e.vy = 0;
    e.hive = s.hive || null; e.cd = s.cd != null ? s.cd : FIRST_CD; e.popT = 0; e.dives = 0;
    if (!s.y) e.y = groundAt(e.x) - rand(96, 116);   // flyers pick their height
    e.sx = null; e.sy = null; e.slot = 9; e.tx = e.x; e.ty = e.y; e.fy = null; e.fr = 12;
  },
  update: updBee, draw: drawBee,
  box: e => ({ x: e.x - 10, y: e.y - 9, w: 20, h: 16 }),
  onKill: beeKill
};

// ============================================================
// The robot HIVE: hexagon steel plates with glowing honey windows, a bee-striped collar, a round door; it hangs by a
// steel strap from a mossy branch it draws itself (a steel girder in the lava areas and the crater)
// ============================================================
const HIVE_H = 64;   // collar (y 4) to the tip, below the hang point
function hiveBuild(dmg) {
  const b = buf(52, 86, 26, 16), S = 4.2, SQ3 = Math.sqrt(3);
  const hw = y => y < 0 ? 0 : y < 6 ? 8 : 20 * Math.pow(Math.max(0, Math.sin(Math.PI * (0.08 + 0.92 * clamp((y - 5) / (HIVE_H - 5), 0, 1)))), 0.7);
  const PLT = P('#e3eaf0', '#b7c2cd', '#8b97a6', '#66717f', '#4b5461'), SEAM = I('#353b45');
  const hexAt = (x, y) => {
    const q = (2 / 3 * x) / S, r = (-1 / 3 * x + SQ3 / 3 * y) / S;
    let cx = q, cz = r, cy = -cx - cz, rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    return [rx, rz, S * 1.5 * rx, S * SQ3 * (rz + rx / 2)];
  };
  const shadeAt = (x, y) => -(x / 20) * 0.6 - ((y - 26) / 32) * 0.5 - ss(0.55, 1, Math.abs(x) / Math.max(1, hw(y))) * 0.7;
  for (let y = 9; y < HIVE_H; y++) {
    const w = hw(y);
    for (let x = -Math.floor(w); x <= w; x++) {
      const [q, r, hx, hy] = hexAt(x + 0.5, y + 1.5), dx = Math.abs(x + 0.5 - hx), dy = Math.abs(y + 1.5 - hy);
      const d = Math.max(dy, dx * SQ3 / 2 + dy / 2), ap = S * SQ3 / 2;
      if (d > ap - 0.85) { put(b, x, y, SEAM); continue; }
      const L = shadeAt(hx, hy - 1.5), inner = Math.abs(hx) < hw(hy) - 5 && hy > 13 && hy < HIVE_H - 10;
      const honey = nz(q + 40, r + 40) > 0.68 && inner;
      const bev = ((x + 0.5 - hx) + (y + 1.5 - hy)) / ap;
      // damage: knocked-out plates show the dark inside with honey glowing deep in it; cracked plates
      const hole = dmg >= 2 && inner && nz(q + 71, r + 13) > 0.72, crack = dmg >= 1 && nz(q + 33, r + 91) > 0.66;
      if (hole) { put(b, x, y, bev > 0.35 ? I('#c0700f') : bev > -0.2 ? I('#5a3410') : I('#24160c')); continue; }
      if (honey) { put(b, x, y, bev < -0.7 ? HON[0] : bev > 0.6 ? HON[3] : bev > 0 ? HON[2] : HON[1]); continue; }
      let k = L > 0.45 ? 0 : L > 0.05 ? 1 : L > -0.4 ? 2 : L > -0.85 ? 3 : 4;
      if (bev < -0.75) k = Math.max(0, k - 1); else if (bev > 0.7) k = Math.min(4, k + 1);
      if (crack && Math.abs((x + 0.5 - hx) - (y + 1.5 - hy) * 0.6) < 0.6) k = 4;
      put(b, x, y, PLT[k]);
    }
  }
  // the collar: a band in bee colours under the clamp
  for (let y = 4; y < 10; y++) { const w = hw(y) + (y > 6 ? 1 : 0); for (let x = -Math.floor(w); x <= w; x++) put(b, x, y, y === 4 || y === 9 ? SEAM : ((x + y * 2 + 40) % 6 < 3 ? GOLD[1] : BLK4[1])); }
  // the door: a dark round entrance with honey light inside and a landing lip
  oval(b, -7, 43, 5, 4, OUTI); oval(b, -7, 43, 4, 3, I('#3a2410')); oval(b, -7, 45, 2.6, 1.2, I('#a8560e')); rect(b, -9, 45, 4, 1, I('#ffb52e')); put(b, -7, 46, I('#ffd86a'));
  rect(b, -13, 48, 12, 2, I('#c3cdd8')); rect(b, -13, 50, 12, 1, I('#6e7a8a'));
  // the clamp: a steel strap over the branch, with bolts
  for (let y = -13; y < 4; y++) for (let x = -2; x <= 2; x++) put(b, x, y, x === -2 ? PLT[0] : x === 2 ? PLT[3] : PLT[1]);
  rect(b, -3, -13, 7, 2, PLT[1]); rect(b, -3, -13, 7, 1, PLT[0]);
  for (let x = -5; x <= 5; x++) { put(b, x, 2, PLT[2]); put(b, x, 3, PLT[3]); }
  put(b, 0, -1, I('#ffffff')); put(b, 1, 0, PLT[4]);
  // the status lamp socket on the shoulder, honey oozing from a seam
  oval(b, 13, 16, 2.2, 2.2, PLT[4]); put(b, 13, 16, I('#5a1010'));
  for (let y = 54; y < 60; y++) put(b, 3, y, y < 57 ? HON[1] : HON[2]);
  if (dmg >= 1) for (let y = 30; y < 38; y++) put(b, -12, y, y < 34 ? HON[1] : HON[2]);
  if (dmg >= 2) { rect(b, 9, 24, 3, 2, PLT[4]); put(b, 10, 24, I('#ffcf4a')); }
  outline(b);
  return mk(b, true);
}
const HIVE_S = [hiveBuild(0), hiveBuild(1), hiveBuild(2)];

// the jungle branch: a mossy bough across the hang point, rising to the right into a clump of leaves; a leafy tip
// on the left, hanging moss and two lianas. Origin = the hang point.
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
function branchBuild(seed) {
  const b = buf(212, 150, 116, 128);
  // the bough: a centre line and a radius along it (thin at the left tip, thick where it rises to the right)
  const spine = [];
  for (let x = -96; x <= 46; x++) spine.push([x, -5 + 2.2 * Math.sin(Math.PI * clamp((x + 96) / 142, 0, 1)) - 0.8 * Math.sin(x / 9), 1.6 + 3.6 * ss(-96, 46, x)]);
  for (const [x, y] of bez([[46, -5.6], [64, -6], [74, -22], [80, -60]], 40)) spine.push([x, y, 5.4 + 0.8 * ss(-10, -60, y)]);
  for (const [cx, cy, r] of spine) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const t = (dy - dx * 0.25) / r;
      let c = t < -0.45 ? BARK[0] : t < 0.25 ? BARK[1] : t < 0.7 ? BARK[2] : BARK[3];
      if (nz(x >> 1, (y >> 1) + seed) > 0.9) c = BARK[Math.min(3, BARK.indexOf(c) + 1)];
      put(b, x, y, c);
    }
  }
  // bark grain: dark dashes along the bough
  for (let i = 0; i < spine.length; i += 3) {
    const [x, y, r] = spine[i];
    if (nz(i, seed + 3) > 0.55 && r > 2.5) put(b, x, y + (nz(i, seed + 4) > 0.5 ? 1 : -1), BARK[3]);
  }
  // moss along the top of the bough, tufts of fern and hanging moss strands
  for (const [x, y, r] of spine) {
    if (y < -20) continue;
    const mt = Math.floor(y - r);
    if (nz(x, seed + 91) > 0.18) { put(b, x, mt, MOSS[1]); put(b, x, mt - 1, nz(x, seed + 92) > 0.5 ? MOSS[0] : MOSS[1]); if (nz(x, seed + 93) > 0.62) put(b, x, mt - 2, MOSS[0]); }
    if (nz(x, seed + 94) > 0.86 && Math.abs(x) > 8) for (let k = 1; k < 3 + nz(x, seed + 95) * 6; k++) put(b, x + (k > 4 ? 1 : 0), Math.ceil(y + r) + k, k % 3 ? MOSS[2] : MOSS[3]);
  }
  // little fern fronds standing on the bough
  for (const fx of [-58, -30, 22]) {
    const [, y, r] = spine[fx + 96];
    for (let k = -2; k <= 2; k++) line(b, fx, y - r - 1, fx + k * 2.4, y - r - 6 + Math.abs(k) * 1.6, k % 2 ? LEAF[2] : LEAF[1]);
  }
  // a bromeliad with a red heart where the bough bends up
  for (let k = -3; k <= 3; k++) line(b, 50, -11, 50 + k * 2.2, -17 + Math.abs(k) * 1.4, k % 2 ? LEAF[2] : LEAF[1]);
  oval(b, 50, -12, 1.5, 1, I('#e8352a')); put(b, 50, -13, I('#ff7a5a'));
  // leaves: a big clump where the bough rises out of the screen top, a leafy tip on the left
  foliage(b, 78, -64, 30, 18, LEAF, seed + 20, 3, 6.5);
  foliage(b, 62, -46, 14, 9, LEAF, seed + 40, 2.5, 5);
  foliage(b, -98, -8, 13, 8, LEAF, seed + 60, 2.5, 4.5);
  foliage(b, -80, -12, 7, 5, LEAF, seed + 70, 2, 3.5);
  // lianas hanging from the bough (away from the hive)
  for (const [x, len] of [[-64, 46], [-40, 22], [34, 30]]) {
    const y0 = Math.round(spine[x + 96][1] + spine[x + 96][2]);
    for (let y = y0; y < y0 + len; y++) {
      const vx = x + Math.round(Math.sin((y - y0) / 10 + x) * 1.5);
      put(b, vx, y, LEAF[3]);
      if ((y - y0) % 6 === 2) { put(b, vx + 1, y, LEAF[1]); put(b, vx + 2, y, LEAF[2]); }
      if ((y - y0) % 6 === 5) put(b, vx - 1, y, LEAF[2]);
    }
  }
  outline(b);
  return mk(b, false);
}
// the crater mount: a riveted steel I-beam on a diagonal truss, with a hazard band and a chain to the strap
function girderBuild() {
  const b = buf(232, 150, 116, 128);
  const GS = P('#9aa6b4', '#6e7a8a', '#4f5966', '#363e48'), HZ = [I('#ffd23f'), I('#2a2a30')];
  // the beam (y -16 .. -6)
  for (let x = -92; x <= 92; x++) for (let y = -16; y <= -6; y++) {
    const flange = y <= -14 || y >= -8, t = flange ? (y === -16 || y === -8 ? 0 : y === -14 || y === -6 ? 2 : 1) : 2;
    put(b, x, y, flange ? GS[t] : (x % 22 === 0 ? GS[3] : GS[2]));
  }
  for (let x = -88; x <= 88; x += 11) { put(b, x, -15, GS[0]); put(b, x + 1, -14, GS[3]); put(b, x, -7, GS[0]); put(b, x + 1, -6, GS[3]); }
  // a hazard band where the hook hangs
  for (let x = -10; x <= 10; x++) for (let y = -13; y <= -10; y++) put(b, x, y, HZ[((x + y + 40) >> 1) % 2]);
  // the truss rising to the top right: two rails and zigzag braces
  const A = [[50, -16], [112, -128]], B2 = [[80, -16], [140, -128]];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    for (const [[x0, y0], [x1, y1]] of [A, B2]) { const x = lerp(x0, x1, t), y = lerp(y0, y1, t); rect(b, x - 1, y, 3, 1, GS[1]); put(b, x - 1, y, GS[0]); put(b, x + 1, y, GS[3]); }
  }
  for (let k = 0; k < 5; k++) {
    const t0 = k / 5, t1 = (k + 0.5) / 5, t2 = (k + 1) / 5, at = (P2, t) => [lerp(P2[0][0], P2[1][0], t), lerp(P2[0][1], P2[1][1], t)];
    const a0 = at(A, t0), b1 = at(B2, t1), a2 = at(A, t2);
    line(b, a0[0], a0[1], b1[0], b1[1], GS[2], 2); line(b, b1[0], b1[1], a2[0], a2[1], GS[2], 2);
  }
  // the chain from the beam down to the strap's ring
  for (let y = -6; y < -1; y += 3) { rect(b, -1, y, 3, 2, GS[1]); put(b, 0, y, GS[3]); }
  outline(b);
  // a warning lamp under the beam (lit live)
  rect(b, 30, -5, 3, 2, GS[3]);
  return mk(b, false);
}
const MOUNT = { branch: branchBuild(0), girder: girderBuild() };
// the strap's snapped end, after the hive has fallen
const STRAP_END = (() => {
  const b = buf(9, 16, 4, 13); const PL = P('#e3eaf0', '#b7c2cd', '#8b97a6', '#66717f');
  for (let y = -12; y <= -2; y++) for (let x = -2; x <= 2; x++) put(b, x, y, x === -2 ? PL[0] : x === 2 ? PL[3] : PL[1]);
  rect(b, -3, -12, 7, 2, PL[1]); rect(b, -3, -12, 7, 1, PL[0]);
  put(b, -2, -1, PL[2]); put(b, 1, -1, PL[2]); put(b, 0, 0, PL[3]); put(b, 2, 0, PL[2]);
  outline(b);
  return mk(b, false);
})();

// tuning (retune, was every 180 frames, 3 of its own, no screen cap): a bee every HIVE_GAP frames while it has room
const HIVE_GAP = 300, HIVE_OWN = 2, HIVE_SCREEN = 3, HIVE_TOTAL = 2;   // HIVE_TOTAL: bees in all, then it is empty
const ownBees = e => G.enemies.filter(o => o.type === 'bee' && o.hive === e && !o.dead && !o.dying).length;
function updHive(e) {
  const L = scrL(), p = G.p;
  calmTick();
  if (e.dying) {   // the wreck: the empty branch and the snapped strap, swinging to rest
    e.sw *= 0.985; e.swa = Math.sin(e.t * 0.12) * e.sw;
    if (e.t % 9 === 0 && e.drips < 8 && e.x > L && e.x < L + W) { e.drips++; G.parts.push({ type: 'spark', x: e.x + e.swa, y: e.y + 2, vx: 0, vy: 0.5, g: 0.2, life: 50, max: 50, size: 2, c: '#ffcf4a' }); }
    return;
  }
  const vis = e.x > L + 14 && e.x < L + W - 14;
  if (e.shake > 0) e.shake--;
  if (vis && !G.intro && !p.dead && G.state === 'play') {
    // a new bee only while there is room (HIVE_OWN of its own, HIVE_SCREEN bees on screen in all); it waits
    // before its shake (rel 37), so a full hive stays still
    const room = ownBees(e) < HIVE_OWN && beesAlive() < HIVE_SCREEN && e.sent < HIVE_TOTAL;
    if (e.rel !== 37 || room) e.rel--;
    if (e.rel === 36) { e.shake = 36; Snd.tone('sawtooth', 140, 260, 0.5, 0.03); }
    if (e.rel <= 0) {
      const b = makeEnemy({ t: 'bee', x: e.x - 7, y: e.y + 46, emerge: true, hive: e, cd: FIRST_CD }, null);
      if (!b.dead) { b.active = true; b.facing = p.x < e.x ? -1 : 1; G.enemies.push(b); e.sent++; }
      e.rel = HIVE_GAP; Snd.tone('square', 300, 520, 0.08, 0.04);
      dust(e.x - 7, e.y + 48, 2);
    }
  }
  if (e.hitT === 3) e.jig = 3;
  if (e.jig > 0) e.jig--;
}
function drawHive(e) {
  const m = e.mount === 'girder' ? MOUNT.girder : MOUNT.branch;
  blit(m, e.x, e.y);
  if (e.mount === 'girder') {   // the beam's warning lamp
    const on = (G.t >> 4) % 2;
    R(Math.round(e.x) + 30, Math.round(e.y) - 3, 3, 2, on ? '#ff5040' : '#6a1a14');
    if (on) { ctx.fillStyle = 'rgba(255,80,60,0.25)'; pdisc(e.x + 31, e.y - 2, 4); }
  }
  if (e.dying) {   // the snapped strap
    blit(STRAP_END, e.x + Math.round(e.swa * 0.5), e.y + 4);
    return;
  }
  const amp = e.shake > 0 ? (e.shake > 18 ? 1 : 2) : e.jig > 0 ? 1 : 0;
  const dx = amp ? ((G.t >> 1) & 1 ? amp : -amp) : 0, x = Math.round(e.x) + dx, y = Math.round(e.y);
  FLASH = e.hitT > 0;
  blit(HIVE_S[e.hp > 9 ? 0 : e.hp > 4 ? 1 : 2], x, y);
  FLASH = false;
  // the honey drip: a strand stretching from the tip, the drop falling and forming again
  const t = (G.t + e.var * 37) % 90, len = Math.round(Math.min(8, 2 + t / 9)), hx = x + 3, hy = y + 60;
  R(hx, hy, 1, len, '#f2a325');
  R(hx - 1, hy + len - 1, 3, 1, OUT); R(hx - 2, hy + len, 5, 3, OUT); R(hx - 1, hy + len + 3, 3, 1, OUT);
  R(hx - 1, hy + len, 3, 3, '#ffcf4a'); R(hx - 1, hy + len, 1, 1, '#fff1a8'); R(hx + 1, hy + len + 2, 1, 1, '#c0700f');
  // the door glows, brighter while a bee gets ready to come out; the status lamp blinks (fast and yellow then)
  const ready = e.shake > 0;
  ctx.fillStyle = ready ? 'rgba(255,210,90,0.32)' : 'rgba(255,200,80,0.14)'; pdisc(x - 7, y + 44, ready ? 9 : 7);
  const blink = ready ? (G.t >> 2) % 2 : (G.t >> 4) % 2;
  R(x + 12, y + 15, 3, 3, blink ? (ready ? '#ffe066' : '#ff3b30') : '#5a1010');
  if (blink) { ctx.fillStyle = ready ? 'rgba(255,230,100,0.35)' : 'rgba(255,60,40,0.3)'; pdisc(x + 13, y + 16, 3); }
  if (ready) {   // shaking: motion marks at both sides, a buzz rising out of the door
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
      const mx = x + sd * (24 + k * 3), my = y + 22 + k * 7;
      if ((G.t + k * 3) % 8 < 5) R(mx, my, 1, 4, 'rgba(255,255,255,0.8)');
    }
    if (e.shake < 26 && (G.t >> 1) % 3) text('BZZ', x - 7, y + 30 - Math.round((36 - e.shake) * 0.4), '#ffe066', 1, 'center');
  }
}
function hiveKill(e, cx, cy, b) {
  const x = e.x, y = e.y;
  boom(x, y + 34, 1.3);
  G.later.push({ t: 8, x: x - 10, y: y + 24, s: 0.6 }, { t: 15, x: x + 9, y: y + 44, s: 0.7 });
  sparks(x, y + 30, 10, '#ffe066');
  // bolts and hexagon plates rain down, honey cells splash out
  for (let i = 0; i < 12; i++) bit(x + rand(-16, 16), y + rand(12, 56), i % 4 === 0 ? PIECE.hexBig : i % 2 ? PIECE.hex : PIECE.hexD, rand(-2.4, 2.4), rand(-3.8, -0.8), 80);
  for (let i = 0; i < 4; i++) bit(x + rand(-12, 12), y + rand(16, 50), PIECE.hexH, rand(-2, 2), rand(-3.4, -1), 70);
  for (let i = 0; i < 5; i++) bit(x + rand(-10, 10), y + rand(16, 50), PIECE.bolt, rand(-2.6, 2.6), rand(-4, -1.5), 70);
  dropItem('honey', x - 4, y + 40, G.p.x < x ? -1 : 1);
  addScore(1000, x, y + 20);
  G.texts.push({ x, y: y + 6, s: 'HIVE DOWN!', t: 90, c: '#ffe066' });
  e.sw = 6; e.swa = 0; e.drips = 0;
  Snd.boom(true);
  return 'dying';
}
ENEMY_TYPES.hive = {
  hp: 14, flying: true, armored: true, contact: 'none', activateMargin: 110,
  make(e, s) {
    if (!s.y) e.y = groundAt(e.x) - 108;   // the level gives the hang point; elsewhere it hangs well above the ground
    e.mount = s.mount || (e.x >= 3900 ? 'girder' : 'branch');
    e.var = Math.round(e.x / 10) % 2;
    e.rel = 100; e.sent = 0; e.shake = 0; e.jig = 0; e.sw = 0; e.swa = 0; e.drips = 0;
  },
  update: updHive, draw: drawHive,
  box: e => e.dying ? { x: e.x, y: -200, w: 0, h: 0 } : { x: e.x - 21, y: e.y + 7, w: 42, h: 55 },   // retune: 42 wide (was 38) = the drawn hive with its outline
  onKill: hiveKill
};

// ============================================================
// The QUEEN BEE (AREA 2 mini-boss): a big robot queen with a crown and antennae, a violet thorax, an armoured gold
// and black abdomen with a royal stinger, and two pairs of glass wings
// ============================================================
const QW = 106, QH = 100, QAX = 58, QAY = 50;
function crownPaint(b, cx, cy) {
  // a gold band with five points, the middle one tallest, each tipped with a gem (red in the middle, blue, then pearls)
  for (let x = -8; x <= 8; x++) for (let y = 0; y <= 4; y++) put(b, cx + x, cy + y, y === 0 ? GOLD[0] : y === 4 ? GOLD[3] : x > 4 ? GOLD[2] : GOLD[1]);
  for (const [px, h] of [[-7, 4], [-3.5, 6], [0, 8], [3.5, 6], [7, 4]]) for (let k = 1; k <= h; k++) {
    const w = Math.max(0, (h - k) / 3);
    for (let x = Math.round(px - w); x <= Math.round(px + w); x++) put(b, cx + x, cy - k, x < px ? GOLD[0] : x > px ? GOLD[2] : GOLD[1]);
  }
  for (const [px, h, c] of [[-7, 4, '#fff6dc'], [-3.5, 6, '#2f7fe0'], [0, 8, '#e8352a'], [3.5, 6, '#2f7fe0'], [7, 4, '#fff6dc']]) {
    const x = cx + Math.round(px), y = cy - h - 1;
    put(b, x, y, I(c)); put(b, x, y - 1, I(c)); put(b, x + 1, y, I(c)); put(b, x + 1, y - 1, I(c)); put(b, x, y - 1, I('#ffffff'));
  }
  // jewels on the band
  for (const x of [-5, 0, 5]) { put(b, cx + x, cy + 2, I(x ? '#2f7fe0' : '#e8352a')); put(b, cx + x + 1, cy + 2, I(x ? '#1d58b0' : '#b01e1e')); put(b, cx + x, cy + 1, I('#ffffff')); }
  for (const x of [-7, -3, 3, 7]) put(b, cx + x, cy + 2, GOLD[0]);
}
function queenBuild(ang, abd, crown = true) {
  const ca = Math.cos(ang), sa = Math.sin(ang), L = (u, v) => [u * ca - v * sa, u * sa + v * ca];
  const head = L(18, -5.5), thor = L(0, -2), neck = L(10.2, -3.5);
  const dA = [-Math.cos(abd), Math.sin(abd)], att = [-8, 1.5], ac = [att[0] + dA[0] * 15, att[1] + dA[1] * 15];
  const abC = L(ac[0], ac[1]), abA = ang + Math.atan2(dA[1], dA[0]), ARX = 17, ARY = 12;
  const along = (x, y) => ((x - abC[0]) * Math.cos(abA) + (y - abC[1]) * Math.sin(abA)) / ARX;
  // the abdomen: armour bands, gold and black, with a dark seam between them
  const band = (x, y) => { const s = along(x, y); return s < -0.72 ? GOLD : s < -0.42 ? BLK4 : s < -0.1 ? GOLD : s < 0.2 ? BLK4 : s < 0.48 ? GOLD : s < 0.74 ? BLK4 : GOLD; };
  const legs = [];
  for (const [u0, v0, u1, v1, u2, v2] of [[-3, 7, -6, 11, -8, 14], [1.5, 8, 1.5, 12, 0, 15], [6, 7, 8.5, 10, 11, 12]]) legs.push([L(u0, v0), L(u1, v1), L(u2, v2)]);
  const legCaps = [];
  for (const [a, b2, c] of legs) legCaps.push(cap(a[0], a[1], b2[0], b2[1], 1.1), cap(b2[0], b2[1], c[0], c[1], 0.8));
  let lx0 = 99, lx1 = -99, ly0 = 99, ly1 = -99;
  for (const l of legs) for (const [x, y] of l) { lx0 = Math.min(lx0, x - 2); lx1 = Math.max(lx1, x + 2); ly0 = Math.min(ly0, y - 2); ly1 = Math.max(ly1, y + 2); }
  const legHit = (x, y) => x >= lx0 && x <= lx1 && y >= ly0 && y <= ly1 && legCaps.some(f => f(x, y));
  const b = parts(QW, QH, QAX, QAY, [
    { hit: ell(head[0], head[1], 8.8, 8.2, ang), cx: head[0], cy: head[1], ext: 8.2, pal: HD4 },
    { hit: ell(neck[0], neck[1], 3.6, 8.4, ang), cx: neck[0], cy: neck[1], ext: 8, pal: RUFF, noSeam: true },
    { hit: ell(thor[0], thor[1], 11, 10, ang), cx: thor[0], cy: thor[1], ext: 10, pal: ROY4 },
    { hit: legHit, cx: 0, cy: 10, ext: 5, pal: [I('#c3cdd8'), I('#8a94a2'), I('#5a6270'), I('#3a404a')], noSeam: true },
    { hit: ell(abC[0], abC[1], ARX, ARY, abA), cx: abC[0], cy: abC[1], ext: extY(ARX, ARY, abA), pal: band }
  ]);
  const px = (u, v, c) => { const [x, y] = L(u, v); put(b, x, y, c); };
  // band seams and rivets on the gold plates of the abdomen
  const SEAMS = [-0.72, -0.42, -0.1, 0.2, 0.48, 0.74], SEAMC = I('#5a3a08'), ABC = new Set([...GOLD, ...BLK4]);
  for (let i = 0; i < b.d.length; i++) {
    if (!ABC.has(b.d[i])) continue;
    const s = along(i % QW - QAX + 0.5, ((i / QW) | 0) - QAY + 0.5);
    for (const e2 of SEAMS) if (Math.abs(s - e2) < 0.035) b.d[i] = SEAMC;
  }
  for (const s0 of [-0.86, -0.27, 0.34]) for (const k of [-0.5, 0, 0.5]) {
    const u = ac[0] + dA[0] * s0 * ARX + (-dA[1]) * k * ARY * 0.9, v = ac[1] + dA[1] * s0 * ARX + dA[0] * k * ARY * 0.9;
    const [x, y] = L(u, v);
    if (GOLD.indexOf(get(b, x, y)) >= 0) { put(b, x, y, GOLD[0]); put(b, x + 1, y + 1, GOLD[3]); }
  }
  // the royal stinger: a gold spike (its tip is lit live while it charges)
  const tip0 = [att[0] + dA[0] * 31.5, att[1] + dA[1] * 31.5], nrm = [-dA[1], dA[0]];
  for (let i = 0; i <= 8; i++) {
    const u = tip0[0] + dA[0] * i, v = tip0[1] + dA[1] * i, wdt = i < 3 ? 1.2 : i < 6 ? 0.6 : 0;
    px(u, v, i < 3 ? GOLD[2] : i < 6 ? GOLD[1] : GOLD[0]);
    if (wdt > 1) { px(u + nrm[0], v + nrm[1], GOLD[3]); px(u - nrm[0], v - nrm[1], GOLD[1]); }
    else if (wdt > 0) px(u + nrm[0] * 0.8, v + nrm[1] * 0.8, GOLD[3]);
  }
  // the frilled collar: pleats radiating from the neck
  for (let k = -7; k <= 7; k += 2) { const [x0, y0] = L(9.2, -3.5 + k * 0.55), [x1, y1] = L(12.4, -3.5 + k * 1.05); line(b, x0, y0, x1, y1, RUFF[2]); }
  // the thorax: a gold sash across it, a red jewel brooch, rivets
  for (let i = 0; i <= 24; i++) {
    const k = i / 24, u = lerp(-7, 6, k), v = lerp(-10, 7, k) - Math.sin(Math.PI * k) * 2.5;
    for (const o of [0, 1]) { const [x, y] = L(u + o * 0.7, v - o * 0.5); if (ROY4.indexOf(get(b, x, y)) >= 0) put(b, x, y, o ? GOLD[2] : GOLD[1]); }
  }
  for (const [u, v, c] of [[2, -2, I('#ff5a4a')], [3, -2, I('#c81e1e')], [2, -1, I('#c81e1e')], [3, -1, I('#7a1414')], [2, -3, I('#ffd0cc')], [1, -2, GOLD[1]], [4, -2, GOLD[2]], [2, 0, GOLD[2]]]) px(u, v, c);
  for (const [u, v] of [[-6, -6], [-8, 2], [5, -9], [-2, 6]]) { px(u, v, ROY4[0]); px(u + 0.8, v + 0.8, ROY4[3]); }
  // the face: one big round visor lens (a red eye with a white glint), three eyelashes, a little gold smile
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
    const d = (i * i) / 18 + (j * j) / 15;
    if (d > 1) continue;
    px(21.6 + i, -6 + j, d > 0.62 ? I('#2a0c0c') : d < 0.16 ? I('#ffc8b8') : j >= 2 ? I('#a81414') : j <= -2 ? I('#ff6a58') : EVIL_I);
  }
  for (const [u, v, c] of [[19.6, -8, I('#ffffff')], [20.6, -8, I('#ffffff')], [19.6, -7, I('#ffffff')], [20.6, -7, I('#ffe8e0')], [24.6, -4, I('#ff8a78')]]) px(u, v, c);
  for (const [u, v, c] of [[22, 1.8, GOLD[2]], [23, 2.2, GOLD[1]], [24, 2, GOLD[1]], [25, 1.4, GOLD[2]], [25.6, 0.6, GOLD[3]]]) px(u, v, c);
  px(13.6, -2, HD4[0]); px(14.6, -1, HD4[0]); px(15.2, -10, HD4[0]); px(16.2, -11, HD4[0]);
  // the crown, worn a little back on the head
  if (crown) { const [x, y] = L(16.5, -16); crownPaint(b, Math.round(x), Math.round(y)); }
  outline(b);
  // antennae: thin curls with glowing bulbs, poking out in front of the crown
  const thin = (u0, v0, u1, v1, c) => { for (let i = 0; i <= 8; i++) { const [x, y] = L(lerp(u0, u1, i / 8), lerp(v0, v1, i / 8)); if (get(b, x, y) === NONE || get(b, x, y) === OUTI) put(b, x, y, c); } };
  for (const [pts, bulb] of [[[[23, -11], [26, -17], [31, -20]], [32, -21]], [[[21, -13], [22, -19], [26, -24]], [27, -25]]]) {
    for (let k = 0; k + 1 < pts.length; k++) thin(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], LEG);
    const [x, y] = L(bulb[0], bulb[1]);
    put(b, x, y, I('#ffe066')); put(b, x + 1, y, I('#ffb52e')); put(b, x, y - 1, I('#fff6c0')); put(b, x + 1, y - 1, I('#ffe066'));
    put(b, x - 1, y, OUTI); put(b, x + 2, y, OUTI); put(b, x, y - 2, OUTI); put(b, x + 1, y - 2, OUTI); put(b, x, y + 1, OUTI); put(b, x + 1, y + 1, OUTI);
  }
  return { body: mk(b, true), wings: queenWings(ang), tip: L(tip0[0] + dA[0] * 9, tip0[1] + dA[1] * 9), eye: L(21.6, -6), crown: L(16.5, -19) };
}
// wings: two pairs of glass wings in gold frames, far pair behind the body, near pair in front; 3 beat frames
// (cached per body angle: poses that share an angle share their wings)
const QWINGS = new Map();
function queenWings(ang) {
  const key = ang.toFixed(3);
  if (QWINGS.has(key)) return QWINGS.get(key);
  const ca = Math.cos(ang), sa = Math.sin(ang), L = (u, v) => [u * ca - v * sa, u * sa + v * ca];
  const wings = [];
  const SHEEN = P('#f2fbff', '#f6eeff', '#eafff6', '#fffbe8');
  for (const WA of [-1.62, -2.3, -2.85]) {
    const pair = [];
    for (const far of [1, 0]) {
      const fill = buf(QW, QH, QAX, QAY), frame = buf(QW, QH, QAX, QAY);
      for (const [bu, bv, da, len, wd] of [[-2, -9, 0, 27, 8.4], [-6, -7, -0.42, 20, 6.2]]) {
        const base = far ? [bu + 3, bv - 0.6] : [bu, bv], a = WA + da + (far ? -0.28 : 0), ln = far ? len * 0.9 : len, w2 = far ? wd * 0.85 : wd;
        const cL = L(base[0] + Math.cos(a) * ln * 0.52, base[1] + Math.sin(a) * ln * 0.52), aa = ang + a, hit = ell(cL[0], cL[1], ln * 0.52, w2, aa), rr = ln * 0.52 + 2;
        for (let y = Math.max(0, Math.floor(cL[1] + QAY - rr)); y < Math.min(QH, cL[1] + QAY + rr); y++) for (let x = Math.max(0, Math.floor(cL[0] + QAX - rr)); x < Math.min(QW, cL[0] + QAX + rr); x++) {
          const lx = x - QAX + 0.5, ly = y - QAY + 0.5;
          if (!hit(lx, ly)) continue;
          const edge = !hit(lx - 1, ly) || !hit(lx + 1, ly) || !hit(lx, ly - 1) || !hit(lx, ly + 1);
          if (edge) frame.d[y * QW + x] = far ? I('#9a7a3a') : I('#b8862a');
          else fill.d[y * QW + x] = far ? I('#c8dcea') : SHEEN[((x >> 2) + (y >> 2)) & 3];
        }
        // veins: a gold midrib and two side veins
        for (let i = 2; i < ln * 0.9; i++) { const q = L(base[0] + Math.cos(a) * i, base[1] + Math.sin(a) * i); put(frame, q[0], q[1], far ? I('#b09858') : I('#d8b050')); }
        for (const sd of [-1, 1]) for (let i = 5; i < ln * 0.72; i++) {
          const o = sd * w2 * 0.45 * Math.sin(Math.PI * (i - 5) / (ln * 0.72 - 5)), u = base[0] + Math.cos(a) * i + Math.cos(a + Math.PI / 2) * o, v = base[1] + Math.sin(a) * i + Math.sin(a + Math.PI / 2) * o, q = L(u, v);
          if (get(fill, q[0], q[1]) !== NONE) put(frame, q[0], q[1], far ? I('#a8b8c4') : I('#e8d49a'));
        }
        if (!far) for (let i = 4; i < ln * 0.6; i++) {
          const u = base[0] + Math.cos(a) * i + Math.cos(a - Math.PI / 2) * w2 * 0.6, v = base[1] + Math.sin(a) * i + Math.sin(a - Math.PI / 2) * w2 * 0.6, q = L(u, v);
          if (get(fill, q[0], q[1]) !== NONE) put(frame, q[0], q[1], I('#ffffff'));
        }
      }
      pair.push(bake([[fill, far ? 0.4 : 0.46], [frame, 1]]));
    }
    wings.push(pair);
  }
  QWINGS.set(key, wings);
  return wings;
}
const QUEEN = {};
for (const [k, a, d, c] of [['hover', 0, 0.3, 1], ['fast', 0.22, 0.38, 1], ['up', -0.28, 0.25, 1], ['call', -0.2, 0.05, 1],
  ['f0', -0.08, 0.85, 1], ['f1', -0.08, 1.4, 1], ['f2', -0.08, 1.95, 1], ['swoop', 0.42, 0.55, 1], ['die', 0.28, 0.6, 1], ['dieN', 0.28, 0.6, 0]])
  QUEEN[k] = queenBuild(a, d, !!c);
const CROWN = (() => { const b = buf(21, 18, 10, 12); crownPaint(b, 0, 0); outline(b); return mk(b, false); })();

// ------------------------------------------------------------ the queen's behaviour
const beesAlive = () => G.enemies.filter(o => o.type === 'bee' && o.active && !o.dead && !o.dying && o.x > G.cam.x - 40 && o.x < G.cam.x + W + 40).length;
// her call is capped (fair play): at most QUEEN_BEES bees on screen counting the lock's bees still to come, at most
// 2 per call and QUEEN_CALL_MAX in the whole fight. How many she may call now:
const QUEEN_BEES = 2, QUEEN_CALL_MAX = 2;   // retune, was 3 / 6
// retune: a longer breather after each of her attacks (frames added to her hover wait: 70-80 -> 120-130, 50-55 -> 100-105)
const QUEEN_REST = 50;
function queenCallN(e) {
  const due = e.lock && e.lock.queue ? e.lock.queue.filter(w => w.t === 'bee').length : 0;
  return Math.max(0, Math.min(2, QUEEN_BEES - beesAlive() - due, QUEEN_CALL_MAX - e.called));
}
// her shout ("BZZZZ!"): drawn with her, in front of her mouth (clear of the crown and the antennae, below the boss bar)
const shout = (e, s, c, t) => { e.shout = { s, c, t }; };
function queenSound(k) {
  if (k === 'roar') { Snd.tone('sawtooth', 130, 95, 0.7, 0.05); Snd.tone('square', 260, 180, 0.6, 0.025); Snd.noise(0.5, 0.05, 900); }
  else if (k === 'charge') Snd.tone('sawtooth', 200, 520, 0.8, 0.03);
  else if (k === 'fire') { Snd.tone('square', 1200, 500, 0.12, 0.05); Snd.noise(0.08, 0.06, 4000); }
  else if (k === 'swoop') Snd.tone('sawtooth', 900, 200, 0.6, 0.04);
  else if (k === 'fanfare') { for (const [f, d] of [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.42]]) Snd.tone('square', f, f, 0.13, 0.04, d); }
  else if (k === 'pop') { Snd.tone('square', 600, 1600, 0.12, 0.06); Snd.tone('triangle', 1600, 2200, 0.1, 0.05, 0.1); }
}
function updQueen(e) {
  const p = G.p, L = scrL(), minX = L + 60, maxX = L + W - 60, ph2 = e.hp <= e.max / 2;
  e.st++;
  calmTick();
  if (e.shout && --e.shout.t <= 0) e.shout = null;
  const fly = (tx, ty, acc, max) => {
    e.vx += clamp((tx - e.x) * acc, -0.4, 0.4) - e.vx * 0.08;
    e.vy += clamp((ty - e.y) * acc, -0.4, 0.4) - e.vy * 0.08;
    const v = Math.hypot(e.vx, e.vy);
    if (v > max) { e.vx *= max / v; e.vy *= max / v; }
  };
  const go = (s) => { e.state = s; e.st = 0; };
  const face = () => { if (Math.abs(p.x - e.x) > 6) e.facing = p.x < e.x ? -1 : 1; };
  if (e.state === 'dying') { updQueenDying(e); return; }
  switch (e.state) {
    case 'intro':   // a royal entrance: in from the edge with a fanfare, immune until she reaches her spot
      if (e.st === 1) { queenSound('fanfare'); e.hx = clamp(L + W - 150, minX, maxX); e.hy = 98; }
      if (e.st === 30) shout(e, 'BZZZZ!', '#ffe066', 70);
      fly(e.hx, e.hy, 0.03, 2.4);
      face();
      if (e.st >= 90 && Math.abs(e.x - e.hx) < 30) { go('hover'); e.inv = false; e.cd = 40; e.cx0 = e.x; }
      break;
    case 'hover': {
      const hx = clamp(L + W / 2 + Math.sin(e.t * 0.011) * 120, minX, maxX), hy = 100 + Math.sin(e.t * 0.023) * 10;
      fly(hx, hy, 0.02, ph2 ? 1.6 : 1.2);
      face();
      if (--e.cd <= 0 && !p.dead) {
        const seq = ph2 ? ['fan', 'swoop', 'call', 'fan', 'swoop'] : ['call', 'fan', 'swoop', 'fan'];
        let a = seq[e.atk % seq.length];
        if (a === 'call' && (beesAlive() >= 2 || !queenCallN(e))) a = 'fan';
        // one danger at a time: her fan and her swoop wait while a bee charges or dives (she keeps hovering)
        if (a !== 'call' && beeAttacking()) { e.cd = 0; break; }
        e.atk++;
        if (a === 'call') { go('call'); queenSound('roar'); shout(e, 'BZZZZ!', '#ffe066', 60); }
        else if (a === 'fan') { go('fan'); queenSound('charge'); }
        else {
          go('rise');
          e.tx = clamp(p.x, L + 40, L + W - 40);
          let sd = e.x >= e.tx ? 1 : -1, x0 = e.tx + sd * 118;
          if (x0 < L + 34 || x0 > L + W - 34) { sd = -sd; x0 = e.tx + sd * 118; }
          e.x0 = clamp(x0, L + 34, L + W - 34);
          Snd.tone('triangle', 300, 600, 0.5, 0.03);
        }
      }
      break;
    }
    case 'call':    // the buzz-roar: she rears up, wings blurring, and two bees answer from the screen edges
      e.vx *= 0.9; fly(e.x, 88, 0.03, 0.8);
      face();
      if (e.st === 36) {
        // two bees answer from the screen edges (one, from the far side, when the cap leaves room for one only)
        const n = queenCallN(e), sides = n >= 2 ? [-1, 1] : n === 1 ? [p.x < L + W / 2 ? 1 : -1] : [];
        for (const sd of sides) {
          const b = makeEnemy({ t: 'bee', x: sd < 0 ? L - 14 : L + W + 14, y: 76 + (sd < 0 ? 0 : 14), cd: FIRST_CD }, e.lock);
          if (!b.dead) { b.active = true; b.facing = -sd; b.queen = e; G.enemies.push(b); e.called++; }
        }
      }
      if (e.st >= 60) { go('hover'); e.cd = (ph2 ? 50 : 75) + QUEEN_REST; }
      break;
    case 'fan': {   // the stinger glows orange, then white; then a fan of 3 darts (twice when she is angry)
      e.vx *= 0.9; e.vy *= 0.9;
      face();
      const shots = ph2 ? [54, 86] : [54];
      if (shots.indexOf(e.st) >= 0) {
        const s = QUEEN.f2, ox = e.x + e.facing * s.tip[0], oy = e.y + s.tip[1];
        const a0 = Math.atan2(p.y - 16 - oy, p.x - ox);
        for (const da of [-0.3, 0, 0.3]) G.eb.push({ k: 'stinger', x: ox, y: oy, vx: Math.cos(a0 + da) * 2.4, vy: Math.sin(a0 + da) * 2.4, life: 260 });
        queenSound('fire'); sparks(ox, oy, 5, '#fff3a0');
        e.vx -= e.facing * 1.2; e.kick = 6;
        if (e.st === 54 && ph2) queenSound('charge');
      }
      if (e.kick > 0) e.kick--;
      if (e.st >= (ph2 ? 104 : 72)) { go('hover'); e.cd = (ph2 ? 55 : 80) + QUEEN_REST; BEAT.next = Math.max(BEAT.next, G.t + QUEEN_GAP); }
      break;
    }
    case 'rise':    // the swoop's wind-up: up to the start point; her shadow grows on the ground where she will pass
      fly(e.x0, 72, 0.05, 3);
      e.facing = e.tx < e.x ? -1 : 1;
      if ((e.st >= 58 && Math.hypot(e.x - e.x0, e.y - 72) < 16) || e.st >= 90) {
        go('swoop'); e.sx0 = e.x; e.sy0 = e.y; e.sx1 = clamp(2 * e.tx - e.x, L + 24, L + W - 24); e.sT = ph2 ? 56 : 64;
        queenSound('swoop');
      }
      break;
    case 'swoop': { // down through the shadow and up the other side
      const k = Math.min(1, e.st / e.sT), yb = groundAt(e.tx) - 15, ox = e.x, oy = e.y;
      e.x = lerp(e.sx0, e.sx1, k); e.y = yb + (e.sy0 - yb) * (2 * k - 1) * (2 * k - 1);
      e.vx = e.x - ox; e.vy = e.y - oy;
      e.facing = e.sx1 < e.sx0 ? -1 : 1;
      if (Math.abs(k - 0.5) < 0.12 && e.st % 3 === 0) dust(e.x, groundAt(e.x), 2, -e.facing);
      if (k >= 1) { go('hover'); e.cd = (ph2 ? 50 : 70) + QUEEN_REST; e.vx *= 0.5; e.vy = -0.5; BEAT.next = Math.max(BEAT.next, G.t + QUEEN_GAP); }
      return;
    }
  }
  // below half: two armour plates pop off her abdomen, and she gets faster
  if (ph2 && !e.angry) {
    e.angry = true;
    for (const sd of [-1, 1]) bit(e.x - e.facing * 18, e.y + 2, PIECE.plate, -e.facing * rand(0.8, 2) + sd * 0.6, rand(-3.6, -2.4), 80);
    bit(e.x - e.facing * 12, e.y, PIECE.bolt, rand(-1.5, 1.5), -3.2, 70);
    sparks(e.x - e.facing * 16, e.y + 2, 8, '#ffe066');
    shout(e, 'BZZZ!!', '#ff8a5a', 70);
    Snd.clank(); queenSound('roar');
  }
  e.x += e.vx; e.y += e.vy;
  if (e.state !== 'intro') e.x = clamp(e.x, L + 24, L + W - 24);
  e.y = clamp(e.y, 60, groundAt(e.x) - 40);
  // hurt: smoke from the seams when she is below half
  if (ph2 && e.t % 14 === 0) G.parts.push({ type: 'smoke', x: e.x - e.facing * 10, y: e.y - 6, vx: -e.facing * 0.3, vy: -0.6, life: 34, max: 34, size: 2.5 });
  if (ph2 && e.t % 23 === 0) sparks(e.x - e.facing * 16, e.y + 2, 2, '#ffe066');
}
function updQueenDying(e) {
  // shudders and sinks, little pops; the crown pops off; then she bursts into plates, glass and bolts
  e.vx *= 0.9; e.vy = Math.min(e.vy + 0.02, 0.45);
  e.x += e.vx + Math.sin(e.st * 1.1) * 0.7; e.y = Math.min(e.y + e.vy, groundAt(e.x) - 30);
  G.shake = Math.max(G.shake, 1.5);
  if (e.st % 8 === 0) boom(e.x + rand(-20, 20), e.y + rand(-14, 10), rand(0.35, 0.6));
  if (e.st % 3 === 0) sparks(e.x + rand(-16, 16), e.y + rand(-10, 10), 2, '#ffe066');
  if (e.st % 6 === 0) G.parts.push({ type: 'smoke', x: e.x + rand(-10, 10), y: e.y - 10, vx: rand(-0.3, 0.3), vy: -0.8, life: 46, max: 46, size: 3.5 });
  if (e.st === 36) {
    const s = QUEEN.die, cx = e.x + e.facing * s.crown[0], cy = e.y + s.crown[1];
    e.crown = false;
    G.parts.push({ type: 'sprite', x: cx, y: cy, vx: -e.facing * 1.1, vy: -4.8, g: 0.16, rot: 0, vr: 0.2 * -e.facing, s: CROWN, life: 260, max: 260 });
    G.texts.push({ x: cx, y: cy - 12, s: 'POP!', t: 60, c: '#ffffff' });
    sparks(cx, cy, 10, '#fff3a0'); queenSound('pop');
    e.popX = cx; e.popY = cy; e.popT = 14;
  }
  if (e.popT > 0) e.popT--;
  if (e.st >= 100) {
    boom(e.x, e.y, 1.6);
    G.later.push({ t: 6, x: e.x - 18, y: e.y + 4, s: 0.8 }, { t: 12, x: e.x + 16, y: e.y - 6, s: 0.8 }, { t: 20, x: e.x - 4, y: e.y + 8, s: 1 });
    for (let i = 0; i < 6; i++) bit(e.x + rand(-14, 14), e.y + rand(-14, 4), PIECE.shard, rand(-2.6, 2.6), rand(-4.4, -1.6), 80);
    for (let i = 0; i < 5; i++) bit(e.x - e.facing * rand(0, 22), e.y + rand(-4, 10), i % 2 ? PIECE.plate : PIECE.dark, rand(-2.4, 2.4), rand(-4.2, -1.8), 80);
    for (let i = 0; i < 6; i++) bit(e.x + rand(-12, 12), e.y + rand(-8, 8), i % 3 ? PIECE.bolt : PIECE.hexBig, rand(-2.8, 2.8), rand(-4.6, -2), 80);
    sparks(e.x, e.y, 14, '#ffe066');
    dropItem('honey', e.x - 10, e.y, -1); dropItem('honey', e.x + 10, e.y, 1);
    G.texts.push({ x: e.x, y: e.y - 30, s: 'QUEEN BEE DOWN!', t: 110, c: '#ffe066' });
    G.sflash = Math.max(G.sflash, 0.35);
    e.dead = true;
  }
}
function queenPose(e) {
  switch (e.state) {
    case 'dying': return e.crown ? 'die' : 'dieN';
    case 'call': return 'call';
    case 'fan': return e.st < 18 ? 'f0' : e.st < 34 ? 'f1' : 'f2';
    case 'rise': return 'up';
    case 'swoop': return e.st / e.sT < 0.5 ? 'swoop' : 'up';
    default: return Math.abs(e.vx) > 1.3 ? 'fast' : e.vy < -0.9 ? 'up' : 'hover';
  }
}
function drawQueen(e) {
  const pose = queenPose(e), s = QUEEN[pose], st = e.st;
  // the swoop's tell: a shadow on the ground that grows where she will come down, a blinking ring and a "!"
  if (e.state === 'rise' || e.state === 'swoop') {
    const sx = e.state === 'rise' ? e.tx : e.x, gy = groundAt(sx), k = e.state === 'rise' ? Math.min(1, st / 58) : clamp(1 - (gy - 15 - e.y) / 160, 0.3, 1);
    ctx.fillStyle = 'rgba(20,16,30,' + (0.22 + 0.3 * k).toFixed(3) + ')';
    for (let j = -2; j <= 2; j++) { const hw = Math.round((5 + 15 * k) * Math.sqrt(1 - (j * j) / 9)); ctx.fillRect(Math.round(sx) - hw, Math.round(gy) + j - 1, hw * 2 + 1, 1); }
    if (e.state === 'rise') {
      const on = (st >> 2) % 2 === 0;
      pring(sx, gy - 1, 9 + 16 * k, 3 + 3 * k, on ? '#ff3b30' : '#ffffff');
      pring(sx, gy - 1, 10 + 16 * k, 4 + 3 * k, on ? 'rgba(255,59,48,0.5)' : 'rgba(255,255,255,0.4)');
      if (k > 0.25) text('!', Math.round(sx) + 1, Math.round(gy) - 56 - (on ? 1 : 0), on ? '#ff3b30' : '#ffffff', 2, 'center');
    }
  }
  const call = e.state === 'call', bob = e.state === 'swoop' || e.state === 'dying' ? 0 : Math.round(Math.sin(G.t * 0.11) * 2);
  const wf = call || e.state === 'rise' ? G.t % 3 : (G.t >> 1) % 3;
  const kick = e.kick > 0 ? -Math.round(e.kick / 2) : 0;
  // the call: sound rings spreading from her head
  if (call && st > 4 && st < 56) for (let r = 0; r < 2; r++) {
    const rr = ((st + r * 9) % 18) * 2.2 + 6, hx = e.x + e.facing * 22, hy = e.y - 10;
    pring(hx, hy, rr, rr * 0.8, rgba(I('#ffe066'), 0.7 * (1 - rr / 46)));
  }
  ctx.save(); ctx.translate(Math.round(e.x) + kick * e.facing, Math.round(e.y) + bob); ctx.scale(e.facing, 1);
  FLASH = e.hitT > 0;
  if (e.state === 'swoop' && !FLASH) for (const [o, l] of [[-10, 16], [0, 26], [10, 14]]) {
    const v = Math.hypot(e.vx, e.vy) || 1, mx = Math.abs(e.vx) / v, my = e.vy / v, x0 = -mx * 26 - my * o, y0 = -my * 26 + mx * o;
    pl(x0, y0, x0 - mx * l, y0 - my * l, 1, 'rgba(255,255,255,0.7)');
  }
  const ghost = e.state === 'dying' ? (st >> 2) % 3 === 0 : true;
  if (ghost) { ctx.globalAlpha = 0.28; ctx.drawImage(s.wings[(wf + 2) % 3][0], -QAX, -QAY); ctx.globalAlpha = 1; }
  if (e.state !== 'dying' || st % 5 < 3) ctx.drawImage(s.wings[wf][0], -QAX, -QAY);
  blit(s.body, 0, 0);
  if (ghost) { ctx.globalAlpha = 0.28; ctx.drawImage(s.wings[(wf + 2) % 3][1], -QAX, -QAY); ctx.globalAlpha = 1; }
  if (e.state !== 'dying' || st % 5 < 3) ctx.drawImage(s.wings[wf][1], -QAX, -QAY);
  if (!FLASH) {
    const [tx, ty] = s.tip;
    if (e.state === 'fan') {
      // the wind-up glow at the royal stinger: orange and growing, then white-hot with a sparkle
      const hot = st >= 34 && !(st > 60 && st < 70), k = hot ? 1 : Math.min(1, (st % 60) / 34), pulse = 0.75 + 0.25 * Math.sin(G.t * 0.7);
      ctx.fillStyle = rgba(I(hot ? '#ffd040' : '#ff8a30'), 0.35 * pulse); pdisc(tx, ty, Math.round(4 + (hot ? 6 : 5 * k)));
      ctx.fillStyle = rgba(I(hot ? '#fff0a0' : '#ffb050'), 0.6 * pulse); pdisc(tx, ty, Math.round(2 + (hot ? 2 : 2 * k)));
      if (hot) { star(tx, ty, 4 + ((st >> 1) % 3) * 2, '#fffbe0'); R(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3, '#ffffff'); }
    }
    // the visor eye glows; the antenna bulbs twinkle
    if (e.state === 'fan' || e.state === 'rise' || e.state === 'call') { ctx.fillStyle = 'rgba(255,90,70,0.3)'; pdisc(s.eye[0], s.eye[1], 6); }
    if (e.crown !== false && (G.t >> 3) % 4 === 0) { const [cx, cy] = s.crown; star(cx, cy - 6, 2, '#ffffff'); }
  }
  FLASH = false;
  ctx.restore();
  // the crown pop: a bright star where it flew off
  if (e.popT > 0) { const r = 16 - e.popT; star(e.popX, e.popY, r, e.popT > 7 ? '#ffffff' : '#fff3a0'); pring(e.popX, e.popY, r + 2, r + 2, 'rgba(255,240,170,0.6)'); }
  // her shout, in front of her mouth (the crown and antennae are above it), buzzing a little
  if (e.shout) {
    const L = scrL(), tw = e.shout.s.length * 6, buzz = (G.t >> 1) & 1;
    const x = clamp(e.x + e.facing * (31 + tw / 2) + kick * e.facing, L + tw / 2 + 2, L + W - tw / 2 - 2);
    text(e.shout.s, Math.round(x) + buzz, Math.round(e.y) + bob - 8, e.shout.c, 1, 'center');
  }
}
ENEMY_TYPES.queenbee = {
  hp: 30, boss: true, bossName: 'QUEEN BEE', flying: true, armored: true, edge: 70, activateMargin: 80,   // retune: hp 30 (was 38)
  contact: e => e.state === 'swoop' ? 'hurt' : 'none',
  make(e, s) {
    if (!s.y) e.y = 70;
    Object.assign(e, { state: 'intro', st: 0, vx: -1.5, vy: 0.4, cd: 60, atk: 0, inv: true, crown: true, hx: 0, hy: 84, cx0: e.x,
      tx: e.x, x0: e.x, sx0: e.x, sy0: e.y, sx1: e.x, sT: 64, kick: 0, popT: 0, popX: 0, popY: 0, angry: false, facing: -1,
      called: 0, shout: null });
  },
  update: updQueen, draw: drawQueen,
  box: e => e.dying ? { x: e.x - 20, y: e.y - 16, w: 40, h: 28 } : { x: e.x - 24, y: e.y - 18, w: 48, h: 32 },
  onKill(e, cx, cy, b) {
    e.state = 'dying'; e.st = 0; e.hitT = 0; e.inv = true; e.shout = null;
    G.eb = G.eb.filter(q => q.k !== 'stinger');
    // without their queen the bees of her swarm pop one by one
    let i = 0;
    for (const o of G.enemies) if (o.type === 'bee' && !o.dead && !o.dying && (o.queen === e || (e.lock && o.lock === e.lock))) o.popT = 30 + 12 * i++;
    addScore(3000, cx, b.y);
    queenSound('roar');
    return 'dying';
  }
};

// ============================================================
// The STINGER dart (the queen's fan): a gold dart with a white-hot tip; it can be shot; it sticks in the ground
// ============================================================
EB_TYPES.stinger = {
  r: 3, shootable: true,
  update(b) {
    if (b.stuck > 0) { b.vx = 0; b.vy = 0; b.g = 0; if (--b.stuck <= 0) b.life = 0; return; }
    b.a = Math.atan2(b.vy, b.vx);
    if (G.t % 3 === 0 && G.parts.length < 600) G.parts.push({ type: 'spark', x: b.x - b.vx * 2, y: b.y - b.vy * 2, vx: 0, vy: 0, life: 8, max: 8, size: 1, c: '#ffe7a0' });
  },
  draw(b) {
    const a = b.a != null ? b.a : Math.atan2(b.vy, b.vx), ux = Math.cos(a), uy = Math.sin(a);
    const x = b.x, y = b.y, stuck = b.stuck > 0;
    if (stuck && b.stuck < 12 && b.stuck % 2) return;   // blinks out
    if (!stuck) {
      // a hot glow round the tip and a fading streak behind it
      ctx.fillStyle = 'rgba(255,170,60,' + (0.28 + 0.1 * Math.sin(G.t * 0.8)).toFixed(2) + ')'; pdisc(x, y, 4);
      pl(x - ux * 9, y - uy * 9, x - ux * 15, y - uy * 15, 1, 'rgba(255,240,180,0.55)');
    }
    pl(x - ux * 8, y - uy * 8, x, y, 2, '#000', true);
    pl(x - ux * 8, y - uy * 8, x - ux * 5, y - uy * 5, 2, '#35353f');
    pl(x - ux * 5, y - uy * 5, x - ux * 1, y - uy * 1, 2, '#ffd23f');
    pl(x - ux * 7, y - uy * 7, x - ux * 2, y - uy * 2, 1, '#fff3a0');
    R(Math.round(x) - 1, Math.round(y) - 1, 2, 2, stuck ? '#e09a14' : '#ffffff');
    // fins at the tail
    const fx = x - ux * 8, fy = y - uy * 8;
    R(Math.round(fx - uy * 2), Math.round(fy + ux * 2), 1, 1, '#ffd23f'); R(Math.round(fx + uy * 2), Math.round(fy - ux * 2), 1, 1, '#ffd23f');
  },
  onGround(b) {
    if (!b.stuck) { b.stuck = 40; b.r = -99; b.y = groundAt(b.x) - 1; sparks(b.x, b.y, 3, '#ffd23f'); dust(b.x, b.y + 1, 1); }
    return true;
  }
};

// ============================================================
// HONEY: a jar of robot honey, bonus points
// ============================================================
const HONEY_S = (() => {
  const b = buf(17, 19, 8, 16);
  // the jar: amber honey in glass, lit from the upper left
  for (let y = -9; y <= -1; y++) for (let x = -5; x <= 5; x++) {
    const d = (x * x) / 30 + ((y + 5) * (y + 5)) / 22;
    if (d > 1) continue;
    put(b, x, y, d > 0.75 && x > 0 ? HON[3] : x + (y + 5) < -4 ? HON[0] : x + (y + 5) > 3 ? HON[2] : HON[1]);
  }
  rect(b, -4, -1, 9, 1, HON[3]);
  rect(b, -3, -11, 7, 2, I('#f2a325')); rect(b, -3, -11, 7, 1, HON[1]);   // the neck
  // a red checked cloth lid tied with string
  rect(b, -5, -14, 11, 3, I('#e8352a')); rect(b, -5, -14, 11, 1, I('#ff7a5a'));
  for (const x of [-4, -2, 0, 2, 4]) put(b, x, -13, I('#ffffff'));
  put(b, -6, -12, I('#e8352a')); put(b, 6, -12, I('#c81e1e'));
  rect(b, -4, -11, 9, 1, I('#8a5a2a'));
  // a cream hexagon label with a tiny bee stripe, a glass glint
  rect(b, -2, -7, 5, 4, I('#fff6dc')); put(b, -2, -7, HON[1]); put(b, 2, -7, HON[1]); put(b, -2, -4, HON[1]); put(b, 2, -4, HON[1]);
  rect(b, -1, -6, 3, 1, I('#35353f')); rect(b, -1, -5, 3, 1, I('#ffd23f'));
  put(b, -4, -8, I('#ffffff')); put(b, -4, -7, I('#ffffff')); put(b, -3, -9, I('#ffffff'));
  outline(b);
  return mk(b, false);
})();
ITEMS.honey = {
  draw(it) {
    const x = Math.round(it.x), y = Math.round(it.y);
    blit(HONEY_S, x, y);
    if (it.t % 50 < 8) star(x + 4, y - 15, it.t % 50 < 4 ? 1 : 2, '#ffffff');
  },
  collect(it, p) {
    addScore(1000, it.x, it.y - 20);
    G.texts.push({ x: it.x, y: it.y - 32, s: 'YUM! HONEY', t: 70, c: '#ffcf4a' });
    // retune: honey heals (a hive or the queen shot down pays back a heart): +1 heart when hurt, as a heart does
    if (p.hearts < 3) { p.hearts++; G.texts.push({ x: it.x, y: it.y - 44, s: '+1 HEART', t: 70, c: '#ff8a9a' }); }
    Snd.tone('triangle', 660, 990, 0.1, 0.06); Snd.tone('triangle', 880, 1320, 0.12, 0.06, 0.1);
  }
};
}
