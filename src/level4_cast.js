'use strict';
// ============================================================
// Mission 4 robots and dive gear: the LOOKS (behaviour in level4_enemies.js, the MEGA OCTOPUS in level4_boss.js).
// Sets the draw of ENEMY_TYPES.roboctopus / roboray / robojelly / robocuttle (INK CAPTAIN) / robopuffer / robocrab /
// roboeel, of their shots EB_TYPES.oceanBolt / oceanInk / pufferSpike / crabShell, and L4.drawDiver(p) (the swimmer,
// also drawn by the boat intro). From the approved proposal (proposals/m4polish/cast).
// Art: every robot is built from shaded parts (ellipses, capsules, polygons, front to back, light from above, a deep
// seam where a nearer part covers a farther one), painted pixel by pixel ONCE into a buffer, outlined with OUT and baked
// to a canvas with a white copy for the hit flash (the Mission 3 robot-animal method); only small live bits are drawn
// per frame (glows, lamps, propeller blades, sparks, the warnings).
// Warnings, one language for every robot: a blinking red/yellow '!' (or a word) over it, its own part lighting up, and
// for every aimed attack marching dots along the exact path (from L4.gun / L4.dashPath / L4.crabGun, the same numbers
// the behaviour uses).
// Baking: each sprite is baked the first time it is needed; L4.castBake (about 110 steps) bakes them ahead, one per
// L4.drawDiver call (every play frame and in the boat intro), so no pose is baked in the middle of a fight.
// No Math.random()/rand() here; no canvas per frame (the glow cache makes one small canvas per colour and radius, once).
// ============================================================
var L4 = L4 || {};
{
const Math = globalThis.Math;
const TAU = Math.PI * 2;

// ============================================================
// Pixel buffers (0xRRGGBB ints, NONE = empty), outline, bake (copied from level3_enemies.js, private there)
// ============================================================
const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
const PI4 = (...s) => s.map(I);
const OUTI = I(OUT);
const lerp = (a, b, k) => a + (b - a) * k;
const rgbI = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
function mixI(a, b, k) {
  k = clamp(k, 0, 1);
  const A = rgbI(a), B = rgbI(b);
  return (Math.round(lerp(A[0], B[0], k)) << 16) | (Math.round(lerp(A[1], B[1], k)) << 8) | Math.round(lerp(A[2], B[2], k));
}
const rgba = (c, a) => { const v = rgbI(typeof c === 'string' ? I(c) : c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')'; };
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
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
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), hw = (t - 1) / 2;
  for (let i = 0; i <= n; i++) rect(b, Math.round(x0 + (x1 - x0) * i / n - hw), Math.round(y0 + (y1 - y0) * i / n - hw), t, t, c);
}
function inPoly(P, x, y) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function outline(b, c = OUTI) {
  const add = [], w = b.w, h = b.h, d = b.d;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i] !== NONE) continue;
    if ((x > 0 && d[i - 1] !== NONE) || (x < w - 1 && d[i + 1] !== NONE) || (y > 0 && d[i - w] !== NONE) || (y < h - 1 && d[i + w] !== NONE)) add.push(i);
  }
  for (const i of add) d[i] = c;
}
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
const mk = b => ({ img: bake(b), white: bake(b, true), w: b.w, h: b.h, ox: b.ox, oy: b.oy });
const blit = (s, x, y) => ctx.drawImage(FLASH && s.white ? s.white : s.img, Math.round(x) - s.ox, Math.round(y) - s.oy);
const cache = new Map();
const once = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };
// live drawing: a crisp pixel disc in the current fillStyle; a thick pixel line; a ring of dots
function pdisc(x, y, r) {
  x = Math.round(x); y = Math.round(y);
  const R2 = (r + 0.5) * (r + 0.5);
  for (let j = -Math.floor(r); j <= Math.floor(r); j++) { const hw = Math.floor(Math.sqrt(Math.max(0, R2 - j * j))); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
}
function pl(x0, y0, x1, y1, w, c) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), hw = (w - 1) / 2;
  ctx.fillStyle = c;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n - hw), Math.round(y0 + (y1 - y0) * i / n - hw), w, w);
}
function ringDots(x, y, rx, ry, n, w, gap) {
  for (let s = 0; s < n; s++) {
    if (gap && s % gap === gap - 1) continue;
    const th = s / n * TAU;
    ctx.fillRect(Math.round(x + Math.cos(th) * rx), Math.round(y + Math.sin(th) * ry), w, 1);
  }
}
// a soft round glow: one radial-gradient canvas per colour and radius, made once, then blitted with an alpha
const glows = new Map();
function glow(x, y, r, c, a) {
  r = Math.max(2, Math.round(r));
  const key = c + r;
  let cv = glows.get(key);
  if (!cv) {
    cv = canvasOf(r * 2, r * 2);
    const g2 = cv.getContext('2d'), v = rgbI(I(c)), gr = g2.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, 'rgba(' + v + ',1)'); gr.addColorStop(1, 'rgba(' + v + ',0)');
    g2.fillStyle = gr; g2.fillRect(0, 0, r * 2, r * 2); glows.set(key, cv);
  }
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * clamp(a, 0, 1);
  ctx.drawImage(cv, Math.round(x) - r, Math.round(y) - r);
  ctx.globalAlpha = ga;
}

// ============================================================
// Shaded parts: { hit(x, y), cx, cy, ext, pal | (x, y) => pal, tilt?, noSeam?, and?(x, y), bounding box } listed
// FRONT TO BACK. Tone from the part's own height (light on top, deep at the bottom); a farther part touching a nearer one
// above, left or right gets a deep seam. Sampled at pixel centres, design units = pixels, anchor (ax, ay).
// ============================================================
function E(cx, cy, rx, ry, pal, o = {}) {
  const a = o.a || 0, ca = Math.cos(a), sa = Math.sin(a), R = Math.max(rx, ry);
  return { hit: (x, y) => { const dx = x - cx, dy = y - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca; return u * u / (rx * rx) + v * v / (ry * ry) <= 1; },
    cx, cy, ext: Math.sqrt((rx * sa) ** 2 + (ry * ca) ** 2), pal, x0: cx - R - 1, y0: cy - R - 1, x1: cx + R + 1, y1: cy + R + 1, ...o };
}
function C(x0, y0, x1, y1, r, pal, o = {}) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  return { hit: (x, y) => { const t = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1), px = x0 + dx * t - x, py = y0 + dy * t - y; return px * px + py * py <= r * r; },
    cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, ext: r + Math.abs(dy) / 2, pal,
    x0: Math.min(x0, x1) - r - 1, y0: Math.min(y0, y1) - r - 1, x1: Math.max(x0, x1) + r + 1, y1: Math.max(y0, y1) + r + 1, ...o };
}
function Pg(P, pal, o = {}) {
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  for (const [x, y] of P) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return { hit: (x, y) => inPoly(P, x, y), cx: (a + c) / 2, cy: (b + d) / 2, ext: Math.max(1, (d - b) / 2), pal, x0: a - 1, y0: b - 1, x1: c + 1, y1: d + 1, ...o };
}
const Bx = (x0, y0, x1, y1, pal, o = {}) => ({ hit: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, ext: Math.max(1, (y1 - y0) / 2), pal, x0, y0, x1, y1, ...o });
function parts(w, h, ax, ay, list) {
  const b = buf(w, h, ax, ay), id = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const lx = x - ax + 0.5, ly = y - ay + 0.5;
    for (let k = 0; k < list.length; k++) {
      const q = list[k];
      if (lx < q.x0 || lx > q.x1 || ly < q.y0 || ly > q.y1) continue;
      if (q.hit(lx, ly) && (!q.and || q.and(lx, ly))) { id[y * w + x] = k; break; }
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, k = id[i];
    if (k < 0) continue;
    const q = list[k], lx = x - ax + 0.5, ly = y - ay + 0.5, pal = typeof q.pal === 'function' ? q.pal(lx, ly) : q.pal;
    const t = (ly - q.cy) / q.ext + (q.tilt || 0) * (lx - q.cx) / q.ext;
    let c = t < -0.45 ? pal[0] : t > 0.7 ? pal[3] : t > 0.3 ? pal[2] : pal[1];
    const near = j => j >= 0 && j < k && !list[j].ghost;
    if (!q.noSeam && (near(y > 0 ? id[i - w] : -1) || near(x > 0 ? id[i - 1] : -1) || near(x < w - 1 ? id[i + 1] : -1))) c = pal[3];
    b.d[i] = c;
  }
  b.id = id; b.list = list;
  return b;
}
// is (x, y) on part k of a parts buffer
const onPart = (b, x, y, k) => { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h && b.id[y * b.w + x] === k; };
const painted = (b, x, y) => get(b, x, y) !== NONE;

// ============================================================
// Palettes (4 tones: light, mid, dark, deep)
// ============================================================
const ST4 = PI4('#e2e9ef', '#a9b5c2', '#6f7b8b', '#48505c');      // steel
const HD4 = PI4('#9eacbc', '#67727f', '#454d59', '#2c323b');      // dark steel
const RED4 = PI4('#ff9f84', '#ec5038', '#b52b2c', '#6e1a28');     // octopus paint
const RD2 = PI4('#f47c62', '#cc3c30', '#982228', '#5a1420');      // octopus arm rings
const GOLD4 = PI4('#fff3b0', '#ffd34a', '#d99a22', '#93611a');    // brass
const YEL4 = PI4('#fff3a0', '#ffd23a', '#e0a01c', '#9c6210');     // hazard yellow
const BLK4 = PI4('#5a5f6a', '#2e3139', '#1e2026', '#121317');     // hazard black
const GLS4 = PI4('#dff8ff', '#9ee0f0', '#68bcd8', '#3f8db2');     // glass
const GLW4 = PI4('#fffef0', '#fff3a8', '#ffd760', '#e8a838');     // glass, lit up
const COP4 = PI4('#ffd0a0', '#e88a4a', '#b05a2a', '#6e3418');     // copper coil
const CAB4 = PI4('#6a7896', '#3e4a66', '#2a3248', '#1a1f2e');     // rubber cable
const PUR4 = PI4('#dcaeff', '#a468e2', '#7342b4', '#45247c');     // ink captain hull
const PURH = PI4('#ead0ff', '#bf8cf2', '#8c58cc', '#583294');     // ink captain head
const LIL4 = PI4('#f2dcff', '#c9a2ee', '#9672c4', '#634a8e');     // fin plates
const WHT4 = PI4('#ffffff', '#e8eef4', '#bcc6d2', '#808c9a');     // captain hat
const NAV4 = PI4('#5d6d98', '#323f64', '#222b46', '#141a2c');     // navy brim
const INK4 = PI4('#c690ff', '#7c40d4', '#4f2296', '#2e0f5e');     // ink in the tanks
const ORG4 = PI4('#ffd590', '#ff9a30', '#d8641c', '#8e3a14');     // puffer
const CRM4 = PI4('#fffbe8', '#ffe7b8', '#f0c890', '#c0905e');     // puffer belly
const PNK4 = PI4('#ffc0d0', '#ff7aa0', '#d04a78', '#8a2850');     // lips, lamps
const EEL4 = PI4('#b8f088', '#4cc65e', '#278a48', '#145232');     // eel
const BEL4 = PI4('#fffbc8', '#f2e88a', '#c8c060', '#8a8a3a');     // eel belly
const PIP4 = PI4('#a8d8cc', '#66a49c', '#427478', '#264850');     // sea pipe
const hazard = (k = 3, P1 = YEL4, P2 = BLK4) => (x, y) => (Math.floor((x + y) / k) & 1 ? P2 : P1);
const LENS = PI4('#1f232a', '#ff3b30', '#ff9a8a', '#ffffff');
const WHITE = I('#ffffff');

// a round red robot eye: dark socket, red lens, a pink core, a white glint
function lens(b, x, y, r) {
  oval(b, x, y, r, r, LENS[0]);
  oval(b, x, y, r - 1, r - 1, LENS[1]);
  if (r >= 3) oval(b, x + 0.5, y + 0.5, r - 2.4, r - 2.4, I('#ff6a50'));
  put(b, x - Math.max(1, r * 0.4), y - Math.max(1, r * 0.4), LENS[3]);
  if (r >= 3) put(b, x - r * 0.4 + 1, y - r * 0.4, LENS[2]);
}
function rivet(b, x, y, P) { if (!painted(b, x, y)) return; put(b, x, y, P ? P[0] : I('#f2f6fa')); if (painted(b, x + 1, y + 1)) put(b, x + 1, y + 1, P ? P[3] : I('#3a414c')); }

// ============================================================
// Warnings (live): the blinking '!', a flashing ring, marching dots along a path
// ============================================================
const blink = (t, n = 5) => Math.floor(t / n) % 2 === 0;
function bang(x, y, t, s = '!') { text(s, Math.round(x), Math.round(y), blink(t) ? '#ff3b30' : '#ffe066', 2, 'center'); }
function warnRing(x, y, rx, ry, t) {
  const on = blink(t);
  ctx.fillStyle = on ? '#ff3b30' : '#ffe066'; ringDots(x, y, rx, ry, Math.round(rx * 3), 2, 0);
  ctx.fillStyle = on ? '#ffe066' : '#ff3b30'; ringDots(x, y, rx - 1.5, ry - 1.5, Math.round(rx * 3), 1, 3);
}
// dots from (x0, y0) toward (x1, y1), every 6 px, marching outward; a: 0..1 how far the warning has grown
function aimDots(x0, y0, x1, y1, t, a = 1, from = 0) {
  const L = Math.hypot(x1 - x0, y1 - y0); if (L < 1) return;
  const ux = (x1 - x0) / L, uy = (y1 - y0) / L, end = L * clamp(a, 0, 1);
  for (let d = from + ((t * 0.6) % 6); d < end; d += 6) {
    const x = Math.round(x0 + ux * d), y = Math.round(y0 + uy * d), red = Math.floor((d - t * 0.6) / 6) % 2 === 0;
    ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 1, 4, 4);
    ctx.fillStyle = red ? '#ff3b30' : '#ffe066'; ctx.fillRect(x, y, 2, 2);
  }
}
const gentle = k => k * k * (3 - 2 * k);

// ============================================================
// ROBO OCTOPUS: a red riveted dome (a diving-helmet head), two porthole eyes under angry steel brows, a periscope on
// top, a boat propeller behind, eight red arms with steel joints and brass claws, an O-mouth ink nozzle.
// Faces the diver (e.face). Tell: periscope lamp blinks, the mouth glows purple, arms spread and curl up, a dotted line
// from the mouth to where the ink will fly.
// ============================================================
function octoArms(ph, tell) {
  const list = [];
  // eight ringed arms, four a side (front ones first), reaching out and curling up at the tips like a real octopus
  for (const [x0, rank] of [[-1.5, 0], [3.5, 0], [-4.5, 1], [6.5, 1], [-7.5, 2], [9.5, 2], [-10.5, 3], [12.5, 3]]) {
    const s = x0 < 1 ? -1 : 1, spread = (tell ? 0.4 : 0.24) * (rank + 0.5), c = (tell ? 0.24 : 0.16) * (rank > 0 ? 1 : 0.35);
    let x = x0, y = 8.5, a = Math.PI / 2 - s * spread;
    const n = 5 + rank, len = 3.3;
    for (let j = 0; j < n; j++) {
      a += Math.sin(ph * TAU / 8 + j * 0.8 + x0 * 0.7) * (tell ? 0.1 : 0.2) - s * c * (j > 1 ? 1.2 : 0.2);
      const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len, r = lerp(2.6, 1.4, j / (n - 1));
      list.push(C(x, y, nx, ny, r, j === 1 ? ST4 : j % 2 ? RD2 : RED4));
      x = nx; y = ny;
    }
    list.push(E(x + Math.cos(a) * 1.3, y + Math.sin(a) * 1.3, 1.9, 1.7, GOLD4));
  }
  return list;
}
// 3/4 front view facing right (drawn mirrored: it faces left): eyes and the O-mouth turned a little toward +x
function octoSprite(ph, tell) {
  return once('octo' + ph + tell, () => {
    const dome = E(0, -6, 14, 12.5, RED4);
    const L = [
      Bx(8.5, -31, 13.5, -25, ST4),                                          // periscope head (lamp drawn live)
      C(4, -27.5, 10, -27.5, 1.8, ST4),                                       // elbow
      C(4, -27.5, 4, -16, 2, (x, y) => (y > -23 && y < -20 ? YEL4 : ST4)),    // tube, a hazard band
      Pg([[-7.5, -11.5], [1, -9], [0.5, -7], [-7, -8.5]], HD4),               // angry brows
      Pg([[12, -11.5], [5, -9], [5.5, -7], [12, -8.5]], HD4),
      E(-2, -3.5, 4.4, 4.6, ST4), E(8, -3.5, 3.6, 4.4, ST4),                  // porthole eyes (the far one turned away)
      E(4.5, 4, 3.2, 2.7, ST4),                                               // the O-mouth: the ink nozzle
      C(-12, 6.5, 12, 6.5, 2.6, hazard(3)),                                   // collar
      dome,
      C(-11, -4, -17, -4, 1.6, ST4), E(-18.5, -4, 2.2, 2.8, GOLD4),           // propeller shaft + hub (blades live)
      ...octoArms(ph, tell)
    ];
    const b = parts(60, 72, 30, 35, L);
    lens(b, -2, -3.5, 3.2); lens(b, 8.2, -3.5, 2.6);
    oval(b, 4.5, 4, 1.7, 1.2, I('#2a1030'));
    // dome shine, rivets round the dome and on the collar, the periscope's dark window
    for (let a = -2.75; a < -1.75; a += 0.07) put(b, Math.round(-0.5 + Math.cos(a) * 10.5), Math.round(-6 + Math.sin(a) * 9.2), I('#ffd6c8'));
    for (let a = -2.5; a < -2.05; a += 0.08) put(b, Math.round(-0.5 + Math.cos(a) * 9), Math.round(-6 + Math.sin(a) * 7.6), WHITE);
    for (const [x, y] of [[-12, -3], [-10.5, -10], [-6, -15], [1, -17], [8, -15], [12, -9], [-11, 2], [12, 1]]) rivet(b, x, y, RED4);
    for (let x = -10; x <= 10; x += 5) rivet(b, x, 5, YEL4);
    rect(b, 12, -29.5, 2, 3, I('#1f232a'));
    outline(b);
    return mk(b);
  });
}
// how far a robot is into its warning, 0..1 (the eel's warning is its 'peek')
const tellK = (e, n = 48) => (e.state === 'tell' || e.state === 'peek' ? clamp(1 - e.timer / (e.tellT || n), 0, 1) : 0);
function drawOcto(e) {
  const x = Math.round(e.x), y = Math.round(e.y - 14), tell = e.state === 'tell', k = tellK(e), t = e.t || 0, f = e.face || -1;
  const ph = Math.floor(t / 7 + hsh((e.homeX || 0) * 0.13) * 8) & 7;
  FLASH = e.hitT > 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  // propeller blades (behind the hub), a two-blade screw seen from the side
  const th = t * (tell ? 0.9 : 0.45), b1 = Math.round(Math.cos(th) * 7), b2 = Math.round(Math.sin(th) * 2), hx = -19, hy = -4;
  if (!FLASH) { pl(hx, hy, hx + b2, hy - b1, 3, OUT); pl(hx, hy, hx - b2, hy + b1, 3, OUT); pl(hx, hy, hx + b2, hy - b1, 1, '#ffd34a'); pl(hx, hy, hx - b2, hy + b1, 1, '#ffd34a'); }
  blit(octoSprite(ph, tell), 0, 0);
  if (!FLASH) {
    // periscope lamp: a slow red blink, fast and bright while it gets ready
    const on = tell ? blink(t, 3) : (t % 50) < 6;
    ctx.fillStyle = on ? '#ff3b30' : '#7a1c1c'; ctx.fillRect(12, -30, 2, 3);
    if (on) { ctx.fillStyle = '#ffe0dc'; ctx.fillRect(13, -30, 1, 1); glow(14, -28, tell ? 9 : 5, '#ff4a3a', 0.5); }
    // the O-mouth: ink glowing in it, a drip
    if (tell) {
      glow(4.5, 4, 4 + 8 * k, '#b46cff', 0.35 + 0.4 * k);
      ctx.fillStyle = k > 0.6 ? '#f0e0ff' : '#c88cff'; ctx.fillRect(3, 3, 3, 2);
      if (k > 0.4) { const d = Math.floor(t / 2) % 8; ctx.fillStyle = '#6a32c0'; ctx.fillRect(4, 7 + d, 2, 2); }
    }
  }
  ctx.restore();
  FLASH = false;
  if (tell) {
    bang(x + f * 6, y - 48, t);
    if (k > 0.35 && e.targetX != null) { const g = L4.gun(e); aimDots(g.x, g.y, e.targetX, e.targetY, t, (k - 0.35) / 0.5, 10); }
  }
}

// ============================================================
// ROBO RAY: a steel jet-ray seen from above, nose first: wide wings with yellow/black hazard leading edges, two jet
// intakes at the nose, a red visor, a long hazard-banded tail with a glowing stinger. Faces where it will dash.
// Tell: intakes glow orange to white-hot, stinger flares, it shivers, dotted line along the exact dash path.
// ============================================================
function segDist(px, py, P) {
  let m = 1e9;
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    m = Math.min(m, Math.hypot(ax + dx * t - px, ay + dy * t - py));
  }
  return m;
}
// a big flat wing seen from above: s = 1 the lower one, -1 the upper one; yellow/black hazard leading edge
function wing(s, f) {
  const lead = [[17, 3.5 * s], [9, 10 * s], [0, (17 + f) * s], [-7, (23 + f) * s]];
  const P = [...lead, [-11, (21 + f) * s], [-11, (14 + f * 0.6) * s], [-14, 5 * s], [-15, 2 * s]];
  const body = s > 0 ? ST4.map(c => mixI(c, I('#30405c'), 0.2)) : ST4;
  return Pg(P, (x, y) => (segDist(x, y, lead) < 2.6 ? (Math.floor((x - y * s * 0.7) / 3) & 1 ? BLK4 : YEL4) : body));
}
function raySprite(fl) {
  return once('ray' + fl, () => {
    const f = Math.round(Math.sin(fl / 6 * TAU) * 3);
    const L = [
      E(11, 0, 2.6, 5.6, BLK4),                                          // visor across the head
      C(15, -5, 23, -7.5, 2.3, ST4), C(15, 5, 23, 7.5, 2.3, ST4),        // jet intakes (the manta's horns)
      E(3, 0, 14, 6, ST4),                                               // hull
      C(-12, 0, -19, 0, 2.2, ST4),                                       // tail root
      wing(-1, f), wing(1, f)
    ];
    let x = -19, y = 0;
    for (let j = 0; j < 6; j++) { const nx = x - 2.7, ny = y + Math.sin(fl / 6 * TAU + j * 0.8) * 0.5; L.push(C(x, y, nx, ny, 1.05, j % 2 ? BLK4 : YEL4, { noSeam: true })); x = nx; y = ny; }
    L.push(Pg([[x + 1, y], [x - 3, y - 3], [x - 8, y], [x - 3, y + 3]], ST4));   // stinger mount
    const b = parts(74, 60, 46, 30, L);
    // eyes in the visor, intake mouths, a lit ridge, seams, rivets, wing panel lines
    lens(b, 11, -3, 1.6); lens(b, 11, 3, 1.6);
    for (const yy of [-7.5, 7.5]) { rect(b, 24, Math.round(yy) - 1, 1, 3, I('#1f232a')); put(b, 25, Math.round(yy), I('#1f232a')); }
    for (let xx = -9; xx < 9; xx++) if (onPart(b, xx, -1, 3)) put(b, xx, -1, (xx & 1) ? WHITE : ST4[0]);
    for (const sx of [0, -6]) for (let yy = -5; yy <= 5; yy++) if (onPart(b, sx, yy, 3) && yy !== -1) put(b, sx, yy, ST4[3]);
    for (const [xx, yy] of [[4, -3.5], [4, 2.5], [-3, -3.5], [-3, 2.5], [20, -7.5], [20, 7], [-9, -1]]) rivet(b, xx, yy);
    for (const s of [-1, 1]) for (let q = 0.15; q < 0.85; q += 0.05) { const xx = lerp(-1, -9, q), yy = lerp(6, 19, q) * s; if (onPart(b, xx, yy, s < 0 ? 5 : 6)) put(b, xx, yy, s < 0 ? ST4[2] : ST4[3]); }
    outline(b);
    const sp = mk(b); sp.sting = [x - 4, y];
    return sp;
  });
}
function drawRay(e) {
  const tell = e.state === 'tell', dash = e.state === 'dash', k = tellK(e), t = e.t || 0, f = e.face || -1;
  const jit = tell && k > 0.7 ? (t & 1) * 2 - 1 : 0;
  const x = Math.round(e.x) + jit, y = Math.round(e.y - 14);
  const fl = dash ? 0 : Math.floor(t / 6) % 6, S = raySprite(fl);
  // the dotted line along the dash it will really make
  if (tell && k > 0.25) {
    const P = L4.dashPath(e), a = (k - 0.25) / 0.6;
    for (let i = 8; i < P.length * clamp(a, 0, 1); i += 5) {
      const [px, py] = P[i], red = Math.floor((i - t * 0.4) / 5) % 2 === 0;
      ctx.fillStyle = OUT; ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 4, 4);
      ctx.fillStyle = red ? '#ff3b30' : '#ffe066'; ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
    }
  }
  FLASH = e.hitT > 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  if (dash && !FLASH) {
    // speed streaks and a jet flame behind
    for (let i = 0; i < 6; i++) { const yy = -12 + i * 5, len = 10 + hsh(i * 3.1 + (t >> 2)) * 14; ctx.fillStyle = 'rgba(220,250,255,0.55)'; ctx.fillRect(Math.round(-30 - len), yy, Math.round(len), 1); }
    glow(-13, 1, 9, '#ffb040', 0.6);
    ctx.fillStyle = '#ffe9a0'; ctx.fillRect(-17, 0, 4, 2);
  }
  blit(S, 0, 0);
  if (!FLASH) {
    const [sx, sy] = S.sting, hot = tell ? 0.5 + 0.5 * k : dash ? 1 : 0.35 + 0.15 * Math.sin(t * 0.15);
    glow(sx, sy, 5 + 5 * hot, '#5cf0ff', 0.35 + 0.45 * hot);
    ctx.fillStyle = hot > 0.7 ? '#ffffff' : '#9ef6ff'; ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 3, 2);
    // intakes: dark normally, glowing while it gets ready to dash
    if (tell || dash) {
      const c = k > 0.7 || dash ? '#fff4c0' : k > 0.35 ? '#ffb040' : '#ff7a2a';
      for (const yy of [-7, 6]) { glow(25, yy, 4 + 6 * (dash ? 1 : k), '#ff9a30', 0.55); ctx.fillStyle = c; ctx.fillRect(24, yy - 1, 1, 3); ctx.fillRect(25, yy, 1, 1); }
    }
  }
  ctx.restore();
  FLASH = false;
  if (tell) bang(x, y - 34, t);
}

// ============================================================
// ROBO JELLY: a glass bell full of tesla coils on a brass rim with two red eyes and pink lamps; rubber cables with
// plugs for tentacles. Tell (ZAP!): the whole bell lights up yellow-white, arcs crackle inside, six dotted rays show
// the six directions its zaps will fly.
// ============================================================
function jellySprite(ph, lit) {
  return once('jel' + ph + lit, () => {
    const G4 = lit ? GLW4 : GLS4, CO = lit ? PI4('#ffffff', '#fff4c0', '#ffd870', '#e09a3a') : COP4.map(c => mixI(c, GLS4[1], 0.28));
    const ST = lit ? GLW4 : ST4.map(c => mixI(c, GLS4[1], 0.3)), FR = lit ? PI4('#fffef0', '#fff0c0', '#ffd890', '#e0a050') : PI4('#ffe6f6', '#f4b0de', '#cc80bc', '#8e4c8c');
    const bell = E(0, -6, 14.5, 13.5, G4, { noSeam: true, and: (x, y) => y <= 3.5 });
    const L = [
      Bx(-1, -12, 1, 2, ST, { ghost: true, noSeam: true }),
      E(0, -13.5, 2.8, 2.8, ST, { ghost: true })
    ];
    for (let j = 0; j < 5; j++) L.push(E(0, 1 - j * 2.3, 4.8 - j * 0.45, 1.25, CO, { ghost: true }));
    L.push(E(-8.5, -2, 1.8, 3.4, CO, { ghost: true }), E(8.5, -2, 1.8, 3.4, CO, { ghost: true }));
    L.push(bell, C(-13.5, 4.5, 13.5, 4.5, 2.6, GOLD4));
    for (const x of [-11, -5.5, 0, 5.5, 11]) L.push(E(x, 7.6, 2.8, 2.2, GOLD4));          // the scalloped bell margin
    // two frilly glass oral arms in the middle
    for (const [x0, p0] of [[-2.5, 0], [2.5, 3]]) for (let j = 0; j < 7; j++) L.push(E(x0 + Math.sin(ph / 8 * TAU + j * 0.9 + p0) * 1.8, 11 + j * 2.6, 2.3 - j * 0.12, 1.7, FR, { noSeam: j > 0 }));
    // four rubber cables with plugs
    const ends = [];
    for (const [x0, len, p0] of [[-9, 20, 0], [-5.5, 23, 2], [6, 22, 4], [9.5, 19, 1]]) {
      let x = x0, y = 9;
      for (let j = 0; j < 8; j++) { const ny = y + len / 8, nx = x + Math.sin(ph / 8 * TAU + j * 0.8 + p0) * 1.2; L.push(C(x, y, nx, ny, 1, PI4('#a8e2f4', '#5aa6cc', '#3a7aa0', '#24506e'), { noSeam: true })); x = nx; y = ny; }
      L.push(Bx(x - 1.5, y, x + 1.5, y + 2.4, COP4)); ends.push([x, y + 3]);
    }
    const b = parts(44, 60, 22, 22, L);
    // glass: a big highlight crescent and glints; rim: two red eyes, pink lamps, rivets
    for (let a = -2.6; a < -1.55; a += 0.06) put(b, Math.round(Math.cos(a) * 11), Math.round(-6 + Math.sin(a) * 10), WHITE);
    for (let a = -2.45; a < -1.9; a += 0.08) put(b, Math.round(Math.cos(a) * 9.5), Math.round(-6 + Math.sin(a) * 8.4), lit ? WHITE : GLS4[0]);
    put(b, 9, -12, WHITE); put(b, 10, -11, GLS4[0]); put(b, 11, -9, GLS4[0]);
    lens(b, -4.5, 4.5, 2.2); lens(b, 4.5, 4.5, 2.2);
    for (const xx of [-11, 10]) { put(b, xx, 4, PNK4[0]); put(b, xx + 1, 4, PNK4[1]); put(b, xx, 5, PNK4[1]); put(b, xx + 1, 5, PNK4[2]); }
    for (const xx of [-8, 8]) rivet(b, xx, 3, GOLD4);
    outline(b);
    for (const [xx, yy] of ends) { put(b, xx - 1, yy, ST4[1]); put(b, xx + 1, yy, ST4[1]); put(b, xx - 1, yy + 1, ST4[2]); put(b, xx + 1, yy + 1, ST4[2]); }
    // four thin glowing filaments trailing behind (1 px, no outline)
    for (const [x0, len, p0] of [[-12.5, 27, 1], [-1, 30, 3], [1.5, 28, 5], [12.5, 25, 2]]) for (let j = 0; j < len; j++) {
      const xx = x0 + Math.sin(ph / 8 * TAU + j * 0.22 + p0) * 1.6, yy = 9 + j;
      if (!painted(b, xx, yy)) put(b, xx, yy, (j >> 1) & 1 ? I('#8ee4f6') : I('#d8fbff'));
    }
    return mk(b);
  });
}
// a zigzag arc between two points, from hsh (no random), redrawn every few frames
function arc(x0, y0, x1, y1, seed, c, w = 1) {
  const n = 5; let px = x0, py = y0;
  for (let i = 1; i <= n; i++) {
    const q = i / n, j = i === n ? 0 : (hsh(seed * 7.1 + i * 3.3) - 0.5) * 6;
    const nx = lerp(x0, x1, q) + j * (y1 - y0 === 0 ? 0 : 1) * 0.6, ny = lerp(y0, y1, q) + j * 0.6;
    pl(px, py, nx, ny, w, c); px = nx; py = ny;
  }
}
function drawJelly(e) {
  const t = e.t || 0, x = Math.round(e.x), y = Math.round(e.y - 14) + Math.round(Math.sin(t * 0.06)), tell = e.state === 'tell';
  const k = tellK(e), lit = tell && (k > 0.3 || blink(t, 3));
  const ph = Math.floor(t / 7 + hsh((e.homeX || 0) * 0.31) * 8) & 7;
  FLASH = e.hitT > 0;
  if (!FLASH) glow(x, y - 5, lit ? 30 : 18, lit ? '#fff3a0' : '#7ae8ff', lit ? 0.45 : 0.16);
  blit(jellySprite(ph, lit ? 1 : 0), x, y);
  if (!FLASH) {
    // sparks crackling between the coil top and the glass, faster and brighter while it charges
    const rate = tell ? 2 : 9, sd = Math.floor(t / rate);
    if (tell || sd % 3 === 0) {
      for (let i = 0; i < (tell ? 4 : 1); i++) {
        const a = -Math.PI / 2 + (hsh(sd * 1.7 + i * 5.3) - 0.5) * 2.6;
        arc(x, y - 12, x + Math.cos(a) * 11, y - 5 + Math.sin(a) * 9, sd + i * 13, tell ? '#ffffff' : '#bff8ff');
      }
    }
    // rim lamps
    const on = tell ? blink(t, 3) : (t % 40) < 20;
    if (on) { ctx.fillStyle = '#ffe0ea'; ctx.fillRect(x - 11, y + 3, 1, 1); ctx.fillRect(x + 10, y + 3, 1, 1); }
    // plugs sparking during the tell
    if (tell && k > 0.5) for (let i = 0; i < 3; i++) { const sx = x - 8 + ((sd + i * 2) % 4) * 5, sy = y + 26 + (i % 2) * 3; ctx.fillStyle = blink(t + i, 2) ? '#ffffff' : '#fff070'; ctx.fillRect(sx, sy, 1, 3); ctx.fillRect(sx - 1, sy + 1, 3, 1); }
  }
  FLASH = false;
  // ZAP!, then the six zap directions over the bell and the word (the pearls leave from L4.gun at i * 60 degrees)
  if (tell) bang(x, y - 42, t, 'ZAP!');
  if (tell && k > 0.3) { const g = L4.gun(e); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; aimDots(g.x, g.y, g.x + Math.cos(a) * 54, g.y + Math.sin(a) * 54, t, (k - 0.3) / 0.55, 22); } }
}

// ============================================================
// INK CAPTAIN (robocuttle mini-boss): a big purple robot cuttlefish with a submarine hull (gold trim, portholes,
// rivets), a white captain's cap with a gold anchor, a white handlebar moustache, a red eye in a gold monocle, two
// glass ink tanks on its back, a scalloped fin skirt, lilac arms, an ink funnel. Faces the diver (e.face). Tell: tanks
// bubble and glow, cap pops up, the funnel glows, three dotted lines from the funnel show the three inks.
// ============================================================
function capSprite(ph, hatUp) {
  return once('cap' + ph + hatUp, () => {
    const hy = hatUp ? -2 : 0;
    const inkT = lvl => (x, y) => (y > lvl + Math.sin(x * 0.9 + ph) * 0.8 ? INK4 : GLS4);
    const L = [
      // captain's cap: crown, band, peak
      Pg([[7, -23 + hy], [9, -31 + hy], [15, -34 + hy], [23, -33 + hy], [27, -29 + hy], [26, -23 + hy]], WHT4),
      Bx(7, -23.5 + hy, 26.5, -20.5 + hy, NAV4),
      Pg([[5, -20.5 + hy], [27, -20.5 + hy], [33, -17.5 + hy], [30, -16 + hy], [7, -17.5 + hy]], NAV4),
      // a white handlebar moustache under the eye
      C(19, 2.5, 26, 2.5, 2, WHT4), C(26, 2.5, 30, 0.5, 1.6, WHT4), C(30, 0.5, 31, -2, 1.2, WHT4), C(31, -2, 29.5, -3.5, 0.9, WHT4),
      C(19, 2.5, 13, 2.5, 2, WHT4), C(13, 2.5, 9.5, 0.5, 1.6, WHT4), C(9.5, 0.5, 8.5, -2, 1.2, WHT4), C(8.5, -2, 10, -3.5, 0.9, WHT4),
      // the eye behind a gold monocle
      E(20, -7.5, 5.4, 5, GOLD4),
      // ink funnel under the head
      C(17, 9.5, 24, 11, 2.4, ST4),
      // head
      E(18, -6, 11.5, 11.5, PURH)
    ];
    // six short arms, forward and down, lilac with steel joints, gold tips
    for (let i = 0; i < 6; i++) {
      let x = 18 + (i % 3) * 3.2, y = 5 + Math.floor(i / 3) * 2.5, a = 0.5 + i * 0.16;
      for (let j = 0; j < 5; j++) {
        a += Math.sin(ph / 6 * TAU + j * 0.9 + i * 1.4) * 0.25 + 0.06;
        const nx = x + Math.cos(a) * 3.3, ny = y + Math.sin(a) * 3.3;
        L.push(C(x, y, nx, ny, lerp(2.5, 1.3, j / 4), j % 2 ? PUR4 : LIL4)); x = nx; y = ny;
      }
      L.push(E(x, y, 1.5, 1.5, GOLD4));
    }
    const MANTLE = L.length;
    L.push(
      E(-10, -1, 23, 11, (x, y) => (Math.abs(y + 1.5 - x * 0.02) < 1.7 ? GOLD4 : PUR4)),
      Bx(-25.5, -31, -16.5, -27.5, ST4), Bx(-13.5, -30, -4.5, -26.5, ST4),
      C(-21, -26, -21, -10, 4.2, inkT(-20)), C(-9, -25, -9, -10, 4.2, inkT(-17)),
      C(-21, -30, -21, -34, 1, HD4), C(-9, -29, -9, -33, 1, HD4),
      C(-31, -1, -37, -1, 3.4, HD4)
    );
    // the fin skirt: scalloped plates rippling along the bottom and the top
    for (let i = 0; i < 9; i++) { const xx = -30 + i * 5.2, w = Math.sin(ph / 6 * TAU - i * 0.9) * 1.6; L.push(E(xx, 10.5 + w, 3.6, 3.1, LIL4)); }
    for (let i = 0; i < 7; i++) { const xx = -30 + i * 5, w = Math.sin(ph / 6 * TAU - i * 0.9 + 2) * 1.3; L.push(E(xx, -11.5 + w, 3.2, 2.8, LIL4)); }
    const b = parts(82, 62, 43, 38, L);
    // the red eye in its monocle, a glint on the glass
    lens(b, 20, -7.5, 3.8); put(b, 23, -11, WHITE);
    // cap: gold anchor badge, braid, a lit peak edge
    const ax = 16, ay = -30 + hy;
    for (const [xx, yy] of [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [-1, 1], [1, 1], [-2, 3], [2, 3], [-2, 4], [-1, 5], [1, 5], [2, 4], [0, -1]]) put(b, ax + xx, ay + yy, GOLD4[1]);
    put(b, ax, ay - 1, GOLD4[0]);
    for (let xx = 8; xx <= 26; xx += 2) put(b, xx, -22 + hy, GOLD4[1]);
    for (let xx = 9; xx <= 29; xx++) if (painted(b, xx, -18 + hy)) put(b, xx, -18 + hy, NAV4[0]);
    // hull: portholes on the gold band, rivet rows, panel seams
    for (const px of [-24, -14, -4]) { oval(b, px, -1.5, 2.6, 2.6, GOLD4[3]); oval(b, px, -1.5, 1.7, 1.7, I('#26405c')); put(b, px - 1, -2.5, I('#bfe8ff')); }
    for (let xx = -28; xx <= 6; xx += 4) { rivet(b, xx, -5.5, PUR4); rivet(b, xx + 2, 2.5, PUR4); }
    for (const sx of [-19, -9]) for (let yy = -10; yy <= 8; yy++) if (onPart(b, sx, yy, MANTLE) && Math.abs(yy + 1.5) > 2.2) put(b, sx, yy, PUR4[3]);
    // tank glass highlights, cap rivets, a shine on the head
    for (const tx of [-23, -11]) for (let yy = -24; yy <= -12; yy++) if (painted(b, tx, yy)) put(b, tx, yy, (yy & 3) ? WHITE : I('#d8f4ff'));
    rivet(b, -21, -29, ST4); rivet(b, -9, -28, ST4);
    for (let a = -3.1; a < -2.3; a += 0.1) put(b, Math.round(18 + Math.cos(a) * 9.5), Math.round(-6 + Math.sin(a) * 9.5), PURH[0]);
    outline(b);
    return mk(b);
  });
}
function drawCaptain(e) {
  const x = Math.round(e.x), y = Math.round(e.y - 14), tell = e.state === 'tell', t = e.t || 0, f = e.face || -1;
  const k = tellK(e), ph = Math.floor(t / 8) % 6, hatUp = tell && k > 0.25 && k < 0.95 ? 1 : 0;
  if (tell && k > 0.3 && e.targetX != null) { const g = L4.gun(e); for (const dy of [-28, 0, 28]) aimDots(g.x, g.y, e.targetX, e.targetY + dy, t, (k - 0.3) / 0.55, 12); }
  FLASH = e.hitT > 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  if (!FLASH) glow(-34, -1, 6 + Math.sin(t * 0.2) * 1.5, '#9ef6ff', 0.4);
  blit(capSprite(ph, hatUp), 0, 0);
  if (!FLASH) {
    // bubbles rising in the ink tanks, fast and glowing while it gets ready
    for (const [tx, top] of [[-21, -20], [-9, -17]]) {
      if (tell) glow(tx, -16, 10, '#b46cff', 0.25 + 0.35 * k);
      for (let i = 0; i < (tell ? 4 : 2); i++) {
        const sp = tell ? 0.5 : 0.18, yy = -11 - ((t * sp + i * 11 + tx + 40) % (-11 - top + 1));
        ctx.fillStyle = '#e8d2ff'; ctx.fillRect(tx - 2 + ((i * 3 + tx) & 3), Math.round(yy), 1, 1);
      }
    }
    // the ink funnel glows purple
    if (tell) { glow(25, 11, 5 + 9 * k, '#b46cff', 0.3 + 0.45 * k); ctx.fillStyle = '#e6ccff'; ctx.fillRect(25, 10, 2, 2); }
    // the eye glows
    glow(20, -7.5, tell ? 10 : 7, '#ff4a3a', tell ? 0.5 : 0.3);
  }
  ctx.restore();
  FLASH = false;
  if (tell) bang(x + f * 14, y - 54, t, 'INK!');
}

// ============================================================
// Enemy shots: the energy pearl (jelly zaps, boss bubbles), the ink blob, the puffer's spikes, the crab's shell.
// ============================================================
const pearl = r => once('pearl' + r, () => {
  const b = buf(r * 2 + 5, r * 2 + 5, r + 2, r + 2);
  oval(b, 0, 0, r - 0.5, r - 0.5, I('#ffb52e')); oval(b, -0.5, -0.5, r - 1.5, r - 1.5, I('#ffe066')); oval(b, -1, -1, Math.max(0.6, r - 3.2), Math.max(0.6, r - 3.2), I('#fffbe0'));
  put(b, -2, -2, WHITE); outline(b); return mk(b);
});
const inkBlob = () => once('ink', () => {
  const b = buf(19, 19, 9, 9);
  oval(b, 0, 0, 5.6, 5.6, I('#6a34c4')); oval(b, 1, 2, 3.6, 3, I('#41208a')); oval(b, -2, -2, 2, 2, I('#9a62ec'));
  put(b, -3, -4, I('#e6d0ff')); put(b, -2, -4, I('#e6d0ff')); put(b, -4, -3, I('#e6d0ff'));
  outline(b); return mk(b);
});
EB_TYPES.oceanBolt.draw = function (b) {
  const x = Math.round(b.x), y = Math.round(b.y), r = b.r || 4, t = G.t + Math.round(b.x * 0.7);
  glow(x, y, r + 6, '#ffe46a', 0.35);
  blit(pearl(r), x, y);
  // a little spark cross turning round it
  const a = (t * 0.25) % TAU, sx = Math.round(x + Math.cos(a) * (r + 3)), sy = Math.round(y + Math.sin(a) * (r + 3));
  ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy - 1, 1, 3); ctx.fillRect(sx - 1, sy, 3, 1);
};
EB_TYPES.oceanInk.draw = function (b) {
  const x = Math.round(b.x), y = Math.round(b.y), sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, t = G.t;
  // a soft ink cloud, three puffs trailing behind, the glossy blob
  glow(x, y, 14 + (t >> 3) % 2, '#3c1670', 0.55);
  for (let i = 1; i <= 3; i++) { const px = x - ux * (4 + i * 5), py = y - uy * (4 + i * 5) + Math.round(Math.sin(t * 0.15 + i)); ctx.fillStyle = i === 1 ? '#5a2aa8' : i === 2 ? '#4a2290' : '#3c1a78'; pdisc(px, py, 3.2 - i * 0.8); }
  blit(inkBlob(), x, y);
};
EB_TYPES.pufferSpike.draw = function (b) {
  const a = Math.atan2(b.vy, b.vx), c = Math.cos(a), s = Math.sin(a), x = b.x, y = b.y;
  pl(x - c * 5, y - s * 5, x + c * 4, y + s * 4, 3, OUT);
  pl(x - c * 4, y - s * 4, x + c * 3, y + s * 3, 1, '#e2e9ef');
  ctx.fillStyle = '#ffe066'; ctx.fillRect(Math.round(x + c * 4), Math.round(y + s * 4), 1, 1);
};
EB_TYPES.crabShell.draw = function (b) {
  const a = Math.atan2(b.vy, b.vx), c = Math.cos(a), s = Math.sin(a), x = b.x, y = b.y;
  glow(Math.round(x), Math.round(y), 9, '#ff8a3a', 0.35);
  pl(x - c * 4, y - s * 4, x + c * 4, y + s * 4, 6, OUT);
  pl(x - c * 3, y - s * 3, x + c * 3, y + s * 3, 4, '#ff6a2e');
  pl(x - c * 1, y - s * 1, x + c * 3, y + s * 3, 2, '#ffd27a');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x + c * 3), Math.round(y + s * 3), 1, 1);
};

// ============================================================
// NEW: ROBO PUFFER. Drifts in the right part of the screen. Tell: it puffs up into a spiky ball over 60 frames (its
// antenna lamp blinks, '!' and eight dotted rays show where the spikes will fly), then shoots 8 steel spikes outward
// (slow, shootable), stays big a moment and slowly deflates. Contact never hurts.
// ============================================================
function puffSprite(s, fin) {
  return once('puf' + s + fin, () => {
    const q = s / 4, rx = 11 + q * 6, ry = 9 + q * 8, sl = 1.2 + q * 5.5;
    const body = E(0, 0, rx, ry, (x, y) => (y > ry * 0.32 + Math.sin(x * 0.4) * 0.6 ? CRM4 : ORG4));
    const L = [
      E(rx * 0.42, -ry * 0.28, 3.6, 3.6, ST4),                                           // eye socket
      Pg([[rx * 0.42 - 4.5, -ry * 0.28 - 3.5], [rx * 0.42 + 4.5, -ry * 0.28 - 5.5], [rx * 0.42 + 4.5, -ry * 0.28 - 2.5], [rx * 0.42 - 4, -ry * 0.28 - 1.5]], HD4),   // grumpy lid
      E(rx - 0.5, ry * 0.12, 2.6, 2.4, PNK4),                                               // lips
      E(-2, ry * 0.45, 3.6, 2.2, ST4, { a: 0.5 }),                                          // pectoral fin
      body,
      C(-3, -ry, -3, -ry - 4.5, 0.9, ST4),                                                  // antenna
      Pg([[-rx + 1, 0], [-rx - 8, -6 + fin * 2], [-rx - 6, 0], [-rx - 8, 6 - fin * 2]], ST4) // tail fan
    ];
    // spikes all round (behind the body: only the part outside shows)
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU + 0.2, c = Math.cos(a), sn = Math.sin(a);
      if (c < -0.85) continue;   // the tail is there
      const bx = c * rx * 0.92, by = sn * ry * 0.92, tx = c * (rx + sl), ty = sn * (ry + sl), px = -sn * 2.2, py = c * 2.2;
      L.push(Pg([[bx + px, by + py], [tx, ty], [bx - px, by - py]], ST4, { noSeam: true }));
    }
    const b = parts(64, 64, 32, 32, L);
    lens(b, rx * 0.42, -ry * 0.28 + 0.5, 2.6);
    // spots on the back, a seam with rivets, mouth hole, spike tips
    for (const [u, v] of [[-0.5, -0.55], [-0.15, -0.7], [0.1, -0.45], [-0.6, -0.2], [-0.3, -0.25]]) { const xx = u * rx, yy = v * ry; if (painted(b, xx, yy)) { put(b, xx, yy, ORG4[2]); put(b, xx + 1, yy, ORG4[2]); put(b, xx, yy + 1, ORG4[3]); } }
    for (let yy = -ry + 2; yy < ry - 1; yy++) { const xx = Math.round(-rx * 0.45 + Math.sin(yy * 0.2)); if (onPart(b, xx, yy, 4)) put(b, xx, yy, (yy & 3) === 0 ? I('#fff1d0') : ORG4[3]); }
    put(b, rx + 1, ry * 0.12, PNK4[3]); put(b, rx + 1, ry * 0.12 + 1, PNK4[3]);
    if (s >= 2) for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + 0.2; if (Math.cos(a) < -0.85) continue; put(b, Math.cos(a) * (rx + sl - 0.8), Math.sin(a) * (ry + sl - 0.8), YEL4[1]); }
    outline(b);
    const sp = mk(b); sp.ant = [-3, -ry - 5.5];
    return sp;
  });
}
function drawPuffer(e) {
  const x = Math.round(e.x), y = Math.round(e.y - 14), t = e.t || 0, tell = e.state === 'tell', k = tellK(e, 60);
  const s = Math.round(clamp(e.puff || 0, 0, 1) * 4), fin = Math.floor(t / 6) % 2, S = puffSprite(s, fin), f = e.face || -1;
  // a shiver when full
  const jx = tell && k > 0.8 ? (t & 1) : 0;
  FLASH = e.hitT > 0;
  ctx.save(); ctx.translate(x + jx, y); ctx.scale(f, 1);
  blit(S, 0, 0);
  if (!FLASH) {
    const on = tell ? blink(t, 3) : (t % 46) < 8, [ax, ay] = S.ant;
    ctx.fillStyle = OUT; ctx.fillRect(ax - 1, Math.round(ay) - 1, 4, 4);
    ctx.fillStyle = on ? '#ff3b30' : '#8a2420'; ctx.fillRect(ax, Math.round(ay), 2, 2);
    if (on) glow(ax + 1, ay + 1, tell ? 8 : 5, '#ff4a3a', 0.5);
  }
  ctx.restore();
  FLASH = false;
  // '!', then the eight spike directions over it (the spikes leave 18 px out at i * 45 degrees)
  if (tell) bang(x, y - 26 - k * 8, t);
  if (tell && k > 0.35) for (let i = 0; i < 8; i++) { const a = i * TAU / 8; aimDots(e.x, e.y - 14, e.x + Math.cos(a) * 54, e.y - 14 + Math.sin(a) * 54, t, (k - 0.35) / 0.5, 24); }
}

// ============================================================
// NEW: ROBO CRAB. Walks sideways on the seabed, front view, a hazard-yellow shell, eyes on stalks, one small pincer and
// one big CANNON CLAW. Tell (54 frames): it stops and plants its legs, the claw swings up toward the swimmer, the muzzle
// glows, a dotted line and a flashing ring mark the spot it locked on (where the hero was). Then one slow shell flies
// to that spot: swim off the line. Contact never hurts.
// ============================================================
const CRAB_ANG = [0, -0.2, -0.4, -0.6, -0.8, -1.0, -1.2, -1.4, -1.6, -1.8, -2.0];
function crabBody(leg, plant) {
  return once('crab' + leg + plant, () => {
    const lift = i => (plant ? 0 : ((i + leg) % 2 ? Math.max(0, Math.sin(leg / 4 * TAU)) * 2.5 : 0));
    const dy = plant ? 2 : 0;
    const L = [
      E(-5, -30 + dy, 2.6, 2.6, ST4), E(5, -30 + dy, 2.6, 2.6, ST4),     // eye balls
      C(-4.5, -27 + dy, -4, -22 + dy, 1.2, HD4), C(4.5, -27 + dy, 4, -22 + dy, 1.2, HD4),
      Bx(-5, -13 + dy, 5, -10 + dy, HD4),                                 // mouth grille
      E(0, -16 + dy, 16, 8, (x, y) => (y > -13.5 + dy && y < -10 + dy ? ((Math.floor((x - y) / 3) & 1) ? BLK4 : YEL4) : YEL4)),
      E(0, -9 + dy, 12, 3.6, HD4),                                       // belly plate
      // small pincer (left side), on a short arm
      C(-13, -12 + dy, -19, -14 + dy, 2, ST4),
      Pg([[-18, -17 + dy], [-25, -20 + dy], [-24, -16 + dy], [-19, -13 + dy]], YEL4), Pg([[-19, -13 + dy], [-25, -12 + dy], [-23, -10 + dy], [-18, -11 + dy]], YEL4)
    ];
    // legs: three a side, steel, knees up
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const rx = s * (8 + i * 2.5), ry = -9 + dy, kx = s * (14 + i * 3.5), ky = -15 + i * 1.5 + dy - lift(i + (s > 0 ? 1 : 0)), fx = s * (15 + i * 4.5), fy = -lift(i + (s > 0 ? 1 : 0));
      L.push(C(kx, ky, fx, fy, 1.4, i === 1 ? ST4 : HD4), C(rx, ry, kx, ky, 1.8, i === 1 ? ST4 : HD4));
    }
    const b = parts(60, 40, 30, 36, L);
    lens(b, -5, -30 + dy, 1.9); lens(b, 5, -30 + dy, 1.9);
    for (let x = -4; x <= 4; x += 2) for (let y = -12; y <= -11; y++) put(b, x, y + dy, I('#1f232a'));
    for (let x = -12; x <= 12; x++) { const yy = -17.5 + dy + (x * x) * 0.012; if (painted(b, x, yy) && Math.abs(x) > 1) put(b, x, yy, YEL4[2]); }
    for (const [x, y] of [[-10, -19], [10, -19], [-5, -21.5], [5, -21.5], [-13, -15], [13, -15]]) rivet(b, x, y + dy, YEL4);
    for (let a = -2.8; a < -2.0; a += 0.08) put(b, Math.round(Math.cos(a) * 13), Math.round(-16 + dy + Math.sin(a) * 5.6), I('#fffbe0'));
    outline(b);
    return mk(b);
  });
}
// the cannon claw at angle index i, anchored at its shoulder (0, 0), pointing along the angle (0 = forward)
function crabClaw(i) {
  return once('claw' + i, () => {
    const a = CRAB_ANG[i], c = Math.cos(a), s = Math.sin(a), px = -s, py = c;
    const P = (u, v) => [u * c + v * px, u * s + v * py], U = (x, y) => x * c + y * s;
    const finger = (x, y) => (U(x, y) > 20.5 ? RED4 : YEL4);
    const L = [
      C(...P(21, 0), ...P(26, 0), 2.2, HD4),                                                 // muzzle
      Pg([P(10, -3), P(16, -8.5), P(23, -7.5), P(25.5, -4.5), P(15, -2.2)], finger),          // upper finger
      Pg([P(10, 3), P(16, 8), P(22.5, 6.5), P(24.5, 4), P(15, 2.2)], finger),                 // lower finger
      C(...P(9, 0), ...P(22, 0), 2.3, BLK4),                                                  // the cannon barrel in its grip
      E(...P(8, 0), 7, 6.2, YEL4, { a }),                                                     // palm
      C(0, 0, ...P(4, 0), 2.8, ST4)                                                           // arm
    ];
    const b = parts(64, 64, 32, 32, L);
    const [mx, my] = P(26.5, 0);
    put(b, mx, my, I('#1f232a')); put(b, mx - c, my - s, I('#1f232a'));
    for (const v of [-3, 3]) { const [rx, ry] = P(6, v); rivet(b, rx, ry, YEL4); }
    for (let u = 3; u <= 12; u++) { const [hx, hy] = P(u, -4.5 + (u - 3) * 0.1); if (onPart(b, hx, hy, 4)) put(b, hx, hy, YEL4[0]); }
    outline(b);
    const sp = mk(b); sp.muzzle = P(27, 0);
    return sp;
  });
}
function drawCrab(e) {
  const x = Math.round(e.x), y = Math.round(e.y), t = e.t || 0, tell = e.state === 'tell', plant = tell || e.state === 'recoil';
  const k = tellK(e, 54), f = e.face || -1;
  // the dotted line from the muzzle to the spot it locked, a flashing ring on that spot
  if (tell && e.tx != null && k > 0.2) { const g = L4.crabGun(e); aimDots(g.mx, g.my, e.tx, e.ty, t, (k - 0.2) / 0.5); warnRing(e.tx, e.ty, 9, 9, t); }
  FLASH = e.hitT > 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  const leg = e.state === 'walk' ? Math.floor((e.walk || 0) / 5) & 3 : 0;
  const ai = clamp(Math.round(-(e.aim || 0) / 0.2), 0, CRAB_ANG.length - 1), cl = crabClaw(ai);
  blit(crabBody(leg, plant ? 1 : 0), 0, 0);
  const sy0 = -15 + (plant ? 2 : 0) + (e.state === 'recoil' ? 1 : 0);
  blit(cl, 13, sy0);
  if (!FLASH && tell) { const [mx, my] = cl.muzzle; glow(13 + mx, sy0 + my, 4 + 7 * k, '#ff8a3a', 0.4 + 0.4 * k); ctx.fillStyle = k > 0.6 ? '#fff4c0' : '#ffb040'; ctx.fillRect(Math.round(13 + mx) - 1, Math.round(sy0 + my) - 1, 2, 2); }
  if (!FLASH && tell && blink(t, 3)) { glow(-5, -30, 6, '#ff4a3a', 0.5); glow(5, -30, 6, '#ff4a3a', 0.5); }
  ctx.restore();
  FLASH = false;
  if (tell) bang(x, y - 52, t);
}

// ============================================================
// NEW: ROBO EEL. Lives in a T-shaped sea pipe standing on the seabed (both ends open). While the swimmer is level with
// the pipe and near it, two red eyes light up in the dark opening on the swimmer's side, blink, the head pokes out and a
// red/yellow band with '!' marks the lunge lane (54 frames); then the eel lunges out 120 px, snaps, stays out (now it
// can be shot) and slides back. Hidden in the pipe it can't be hurt (the pipe clanks). Only the lunge itself hurts.
// ============================================================
// the T-pipe, mouth centre at (0, 0): both ends seen a little from the front (a flange round a dark hole)
function pipeHead() {
  return once('pipeT', () => {
    const L = [
      E(-18, 0, 3.6, 8.6, PIP4), E(18, 0, 3.6, 8.6, PIP4),                // flanges
      E(0, -11, 4.6, 1.8, RED4), C(0, -9, 0, -6, 1, HD4),                  // valve wheel
      Bx(-17, -6, 17, 6, (x, y) => (Math.abs(x) < 6 && Math.abs(x) > 3 ? hazard(2)(x, y) : PIP4)),
      Bx(-6, 5, 6, 14, PIP4)
    ];
    const b = parts(46, 32, 23, 14, L);
    for (const s of [-1, 1]) { oval(b, s * 18.4, 0, 1.8, 5.6, I('#0b1014')); put(b, s * 18.4 - s, -5, I('#22323e')); }
    for (const [x, y] of [[-17, -7], [-17, 6], [17, -7], [17, 6], [-10, -4], [10, -4], [-4, 8], [4, 8]]) rivet(b, x, y, PIP4);
    for (const [x, y] of [[-12, 2], [9, 3], [-2, 11], [12, -3]]) { put(b, x, y, I('#c8783a')); put(b, x + 1, y, I('#8a4a24')); }
    outline(b);
    return mk(b);
  });
}
// the right-hand flange ring alone (drawn again over an eel coming out of that end; mirrored for the left)
function pipeRim() {
  return once('pipeR', () => {
    const b = parts(12, 22, 0, 11, [E(4, 0, 3.6, 8.6, PIP4)]);
    for (let y = -11; y < 11; y++) for (let x = 0; x < 12; x++) { const dx = (x + 0.5 - 4.4) / 2.3, dy = (y + 0.5) / 6.1; if (dx * dx + dy * dy <= 1) b.d[(y + 11) * 12 + x] = NONE; }
    rivet(b, 3, -7, PIP4); rivet(b, 3, 6, PIP4);
    outline(b);
    return mk(b);
  });
}
function pipeSeg() {
  return once('pipeS', () => {
    const b = parts(16, 10, 8, 0, [Bx(-6, 0, 6, 10, PIP4, { cy: 0, ext: 1e9 })]);
    for (let y = 0; y < 10; y++) { put(b, -6, y, PIP4[0]); put(b, -5, y, PIP4[0]); put(b, 4, y, PIP4[2]); put(b, 5, y, PIP4[3]); }
    put(b, -3, 4, I('#c8783a'));
    for (let y = 0; y < 10; y++) { rect(b, -7, y, 1, 1, OUTI); rect(b, 6, y, 1, 1, OUTI); }
    return mk(b);
  });
}
function eelHead(open) {
  return once('eelH' + open, () => {
    const L = [
      ...(open ? [Pg([[4, 2], [21, 8], [20, 11], [4, 6]], EEL4)] : []),              // lower jaw (dropped)
      E(12, -3.5, 2.4, 2.4, ST4),                                                       // eye socket
      Pg(open ? [[2, -6], [10, -8], [22, -4], [23, -1], [6, 1], [1, 2]] : [[2, -6], [10, -8], [22, -3], [22, 2], [8, 5], [1, 4]], (x, y) => (y > 1.5 ? BEL4 : EEL4)),
      ...(open ? [Pg([[5, 0], [22, -1], [21, 8], [5, 4]], PI4('#ff6a8a', '#c02850', '#801838', '#4a0c20'), { noSeam: true })] : []),
      // dorsal crest, hazard banded
      Pg([[-6, -5], [-2, -11], [2, -8], [6, -12], [9, -7]], hazard(2)),
      E(0, 0, 6.5, 6, (x, y) => (y > 2.5 ? BEL4 : EEL4))
    ];
    const b = parts(36, 30, 10, 15, L);
    lens(b, 12, -3.5, 1.9);
    if (open) { for (let x = 8; x <= 20; x += 3) { put(b, x, 1, WHITE); put(b, x + 1, 5 + (x - 8) * 0.2, WHITE); } }
    else for (let x = 9; x <= 21; x += 3) put(b, x, 1, WHITE);
    for (const [x, y] of [[-2, -1], [2, -3], [-3, 2]]) { put(b, x, y, EEL4[3]); put(b, x + 1, y, EEL4[3]); }
    rivet(b, 4, -1, EEL4);
    outline(b);
    return mk(b);
  });
}
function eelSeg(v) {
  return once('eelS' + v, () => {
    const L = [Pg([[-3, -5], [0, -9 - v], [3, -5]], hazard(2)), E(0, 0, 5, 5.5 - v * 0.6, (x, y) => (y > 2 ? BEL4 : EEL4))];
    const b = parts(16, 18, 8, 11, L);
    put(b, -1, -2, EEL4[3]); put(b, 1, 0, EEL4[3]); put(b, 2, -3, EEL4[0]);
    outline(b);
    return mk(b);
  });
}
function drawEel(e) {
  const x = Math.round(e.x), y = Math.round(e.y), t = e.t || 0, d = e.dir || -1, gy = e.gy ?? groundAt(e.x), ext = e.ext || 0;
  const peek = e.state === 'peek', k = tellK(e, 54);
  // the lunge lane, like the Mega Octopus's TENTACLE warning
  if (peek && k > 0.15) {
    const a = Math.min(1, (k - 0.15) / 0.4), x0 = x + d * 20, len = 140 * a;
    ctx.fillStyle = rgba('#ff7a50', 0.12 + (blink(t, 4) ? 0.06 : 0)); ctx.fillRect(Math.round(Math.min(x0, x0 + d * len)), y - 9, Math.round(len), 18);
    ctx.fillStyle = blink(t) ? '#ff3b30' : '#ffe066';
    for (let i = 0; i * 6 < len; i++) { ctx.fillRect(Math.round(x0 + d * i * 6), y - 10, 3, 1); ctx.fillRect(Math.round(x0 + d * i * 6), y + 9, 3, 1); }
  }
  FLASH = e.hitT > 0;
  // the pipe down to the seabed, the T on top
  const P = pipeSeg();
  for (let yy = y + 14; yy < gy + 4; yy += 10) blit(P, x, yy);
  blit(pipeHead(), x, y);
  ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
  if (ext > 0.5) {
    // the eel, only where it is outside the pipe (or in the end's hole): segments from the hole out to the head
    ctx.save(); ctx.beginPath(); ctx.rect(17, -20, 200, 40); ctx.clip();
    const hx = Math.round(-4 + ext), wav = e.state === 'hold' ? 1.5 : 0.6, wy = i => Math.round(Math.sin(i * 0.9 - t * 0.2) * wav);
    const us = []; for (let u = hx - 7, i = 1; u > 8; u -= 7, i++) us.push([u, i]);
    for (let j = us.length - 1; j >= 0; j--) blit(eelSeg(us[j][1] & 1), us[j][0], wy(us[j][1]));
    const open = e.state === 'lunge' || (e.state === 'hold' && (t >> 3) % 3 === 0) || (peek && blink(t, 4));
    blit(eelHead(open ? 1 : 0), hx, wy(0));
    ctx.restore();
    if (!FLASH) glow(hx + 12, -4 + wy(0), 6, '#ff4a3a', 0.45);
  }
  // eyes in the dark hole: a slow blink while it waits, lit and blinking while it gets ready
  if (!FLASH) for (const s of [-1, 1]) {
    const lit = peek ? s === d && (k > 0.1 && (k > 0.6 || blink(t, 4))) : (t + (s > 0 ? 60 : 0)) % 150 < 10 && e.state === 'hide';
    if (!lit || ext > 0.5) continue;
    const ex = 18 * s * d;   // local x of that end (the ctx is mirrored by d)
    glow(ex, 0, peek ? 10 : 6, '#ff3b30', peek ? 0.6 : 0.35);
    ctx.fillStyle = '#ff3b30'; ctx.fillRect(ex - 1, -4, 2, 2); ctx.fillRect(ex - 1, 1, 2, 2);
    ctx.fillStyle = '#ffd0c8'; ctx.fillRect(ex - 1, -4, 1, 1); ctx.fillRect(ex - 1, 1, 1, 1);
  }
  if (ext > 0.5) blit(pipeRim(), 14, 0);
  ctx.restore();
  FLASH = false;
  if (peek) bang(x + d * 26, y - 34, t);
}

// ============================================================
// THE DIVER (L4.drawDiver): about the same size as before but clear at a glance: a wetsuit in the hero's colours with a
// light stripe, a weight belt, a yellow tank with a valve and a hose to the mouth, a round glass mask you can see the
// eye through (the hero's real head: Ines' ponytail, Mathias' cap), long kicking fins in the hero's accent colour
// (Ines orange like her hair, Mathias red like his cap), a chunky bubble blaster with a glass bubble chamber.
// Body baked per hero and kick frame (8); head, mask, hose and muzzle live.
// ============================================================
const shade4 = c => { const v = I(c); return [mixI(v, WHITE, 0.35), v, mixI(v, 0, 0.28), mixI(v, 0, 0.55)]; };
const FINS = [PI4('#ffd0a0', '#ff8a3a', '#d0601e', '#8a3a12'), PI4('#ffb0a8', '#ee4038', '#b02828', '#6a1414')];
const TANK4 = PI4('#fff3b0', '#ffd23a', '#d89a1c', '#8a5a10');
const GUN4 = PI4('#a8ecf4', '#4fb0c6', '#2f7a94', '#1c4a60');
function diverBody(hero, fr) {
  return once('dv' + hero + fr, () => {
    const h = HEROES[hero], k = Math.round(Math.sin(fr / 8 * TAU) * 3), F = FINS[hero] || FINS[0];
    const suit = [I(h.outL), I(h.out), I(h.outD), mixI(I(h.outD), 0, 0.4)], pants = shade4(h.pants), dark = P => P.map(c => mixI(c, 0, 0.22));
    const fin = (y0, kk, P) => Pg([[-15, y0 + kk - 2.5], [-31, y0 + kk * 1.5 - 4.5], [-30, y0 + kk * 1.5 + 3], [-15, y0 + kk + 2.5]], P);
    const L = [
      E(12, 0.5, 2, 1.8, shade4(SKIN)),                                                   // hand on the grip
      Bx(23, -3.5, 26, 0.5, YEL4),                                                        // nozzle
      E(17, -6, 2.8, 2.6, GLS4),                                                          // bubble chamber
      Pg([[11, -4], [23, -4.5], [23, 1.5], [15, 1.5], [14, 4.5], [11, 4.5]], GUN4),       // blaster
      C(1, -1.5, 10.5, 0, 2.1, suit),                                                     // forearm
      fin(1.5, k, F), C(-6, 1, -15.5, 1.5 + k, 2.4, pants),                               // near leg and fin
      Bx(-9, -8.5, -7, 1.8, BLK4),                                                        // weight belt
      C(-11, -3, 2, -3, 4.8, (x, y) => (y < -5.8 ? suit.map(c => mixI(c, WHITE, 0.3)) : suit)),   // torso, a light stripe on top
      Bx(1, -13, 3.5, -8.5, ST4),                                                         // tank valve
      C(-15, -10, 0, -10, 3.4, (x, y) => (x > -6 && x < -3.5 ? BLK4 : TANK4)),            // tank
      C(-6, -1.5, -15.5, -1.5 - k, 2.2, dark(pants)), fin(-1.5, -k, dark(F))              // far leg and fin
    ];
    const b = parts(64, 36, 34, 21, L);
    // fin ribs, the belt buckle, tank shine, gun details
    for (const [y0, kk] of [[1.5, k], [-1.5, -k]]) for (let x = -28; x <= -18; x += 3) { const yy = y0 + kk * (1 + (-15 - x) / 32) + 0.5; if (painted(b, x, yy)) put(b, x, yy, F[0]); }
    rect(b, -9, -3, 2, 2, YEL4[1]);
    for (let x = -13; x <= -1; x++) if (x < -6 || x > -3) put(b, x, -12, TANK4[0]);
    put(b, 16, -7, WHITE); put(b, 17, -7, GLS4[0]);
    for (let x = 12; x <= 21; x += 3) put(b, x, -3, GUN4[0]);
    outline(b);
    return mk(b);
  });
}
L4.drawDiver = function (p) {
  castPump();
  const hero = G.hero || 0, h = HEROES[hero], fr = Math.floor((p.t || 0) * 0.19 / (TAU / 8)) & 7;
  ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y - 13)); ctx.scale(p.facing || 1, 1);
  blit(diverBody(hero, fr), 0, 0);
  if (h.tail) spr(h.tail, -4, -15 + (fr >> 2));
  spr(h.head, 1, -18);
  // the hose from the valve to the mouthpiece
  R(3, -13, 3, 1, '#263b50'); R(6, -12, 2, 1, '#263b50'); R(8, -11, 1, 2, '#263b50'); R(9, -9, 1, 2, '#263b50'); R(10, -7, 4, 1, '#263b50');
  RO(13, -7, 3, 3, '#33465a'); R(14, -6, 1, 1, '#ffd23a');
  // the mask: a strap round the head, a rubber frame, glass you can see the eye through, a glint
  R(3, -12, 5, 1, '#1b2a3a');
  ctx.fillStyle = OUT; ctx.fillRect(9, -14, 8, 1); ctx.fillRect(9, -6, 8, 1); ctx.fillRect(7, -12, 1, 5); ctx.fillRect(18, -12, 1, 5);
  ctx.fillRect(8, -13, 1, 1); ctx.fillRect(17, -13, 1, 1); ctx.fillRect(8, -7, 1, 1); ctx.fillRect(17, -7, 1, 1);
  ctx.fillStyle = '#3d5f7c'; ctx.fillRect(9, -13, 8, 1); ctx.fillRect(9, -7, 8, 1); ctx.fillRect(8, -12, 1, 5); ctx.fillRect(17, -12, 1, 5);
  ctx.fillStyle = 'rgba(190,246,255,0.38)'; ctx.fillRect(9, -12, 8, 5);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(10, -12, 2, 1); ctx.fillRect(9, -11, 1, 1); ctx.fillRect(16, -8, 1, 1);
  if (p.muzzle > 0) { ctx.fillStyle = '#e6ffff'; ringDots(30, -2, 4, 4, 18, 1, 0); ringDots(30, -2, 2, 2, 10, 1, 0); ctx.fillStyle = '#ffffff'; ctx.fillRect(29, -4, 2, 1); }
  ctx.restore();
};


// ============================================================
// Hook up the looks
// ============================================================
ENEMY_TYPES.roboctopus.draw = drawOcto;
ENEMY_TYPES.roboray.draw = drawRay;
ENEMY_TYPES.robojelly.draw = drawJelly;
ENEMY_TYPES.robocuttle.draw = drawCaptain;
ENEMY_TYPES.robopuffer.draw = drawPuffer;
ENEMY_TYPES.robocrab.draw = drawCrab;
ENEMY_TYPES.roboeel.draw = drawEel;

// ============================================================
// Baking ahead: every sprite as a step (the hero's diver first, then the robots in the order they appear). Anyone may
// call L4.castPump(n) in idle time; L4.drawDiver runs one step per call until all are done.
// ============================================================
let STEPS = null, stepI = 0;
function castSteps() {
  if (STEPS) return STEPS;
  const q = [], N = n => [...Array(n).keys()], h0 = G.hero || 0;
  for (const h of [h0, 1 - h0]) for (const fr of N(8)) q.push(() => diverBody(h, fr));
  for (const ph of N(8)) q.push(() => octoSprite(ph, false), () => jellySprite(ph, 0));
  for (const fl of N(6)) q.push(() => raySprite(fl));
  q.push(() => pearl(4), () => pearl(5), inkBlob);
  for (const ph of N(8)) q.push(() => octoSprite(ph, true), () => jellySprite(ph, 1));
  for (const sz of N(5)) for (const fin of [0, 1]) q.push(() => puffSprite(sz, fin));
  for (const leg of N(4)) q.push(() => crabBody(leg, 0));
  q.push(() => crabBody(0, 1));
  for (const i of N(CRAB_ANG.length)) q.push(() => crabClaw(i));
  q.push(pipeHead, pipeRim, pipeSeg, () => eelHead(0), () => eelHead(1), () => eelSeg(0), () => eelSeg(1));
  for (const ph of N(6)) for (const up of [0, 1]) q.push(() => capSprite(ph, up));
  return (STEPS = q);
}
function castPump(n = 1) { const q = castSteps(); while (n-- > 0 && stepI < q.length) { try { q[stepI++](); } catch (err) { errorOnce(err); } } return q.length - stepI; }
L4.castPump = castPump;
L4.castLeft = () => castSteps().length - stepI;
}
