'use strict';
// =====================================================================================================================
// MISSION 5 proposal KIT: the shared cast and palette of the alien mothership. A screenshot fixture, NOT game content
// (it becomes the starting point of src/level5_cast.js when the mission is built).
// Load it BEFORE every Mission 5 scene:   --extra proposals/level5/kit.js --extra proposals/level5/<key>/scene.js
//
// Exports (global M5; everything else is private to the block):
//   M5.PAL                                 palette: G (alien green ramp), S (ship steel ramp), lights, eye colours
//   M5.px                                  pixel-buffer helpers (buf put get rect oval ball line poly outline bake mk blit)
//   M5.glow(x, y, r, col, a)               soft additive light (cached sprite), world or screen space
//   M5.bang(x, y, t)                       the red '!' warning mark
//   M5.oggle(x, y, facing, o)            the trooper: green egg robot, ONE big eye, antenna, ray gun
//   M5.drone(x, y, facing, o)              the eye saucer: flying disc, glass dome, one eye underneath
//   M5.roller(x, y, facing, o)             the roly eye: a rolling one-eyed ball
//   M5.cow(x, y, facing, o)                the abducted Galician cow (the rescue)
//   M5.pod(x, y, o)                        the glass stasis pod a cow floats in
//   M5.bubble(x, y, s)                     white speech bubble with red text (HELP! / MOO!)
//   ENEMY_TYPES.oggle / eyedrone / roller   posed stand-ins (spec fields: pose, look, t0), POW_KINDS.cow,
//   EB_TYPES.ogring (the oggle's slow green ring shot)
// Poses (o.pose): 'idle' | 'walk' | 'aim' | 'warn' | 'shoot' | 'hit'.   o.look = [dx, dy] where the eye looks
// (-1..1 each; default: at the hero).   o.t = animation clock (default G.t).
// Drawing never calls Math.random()/rand(): hsh(n) and the clock only. Sprites are baked once at load.
// =====================================================================================================================
var M5 = {};
{
// ---------------------------------------------------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------------------------------------------------
const PAL = M5.PAL = {
  // alien robot green, dark -> light. RESERVED for the robots, their beams and their glow: scenery stays blue-violet
  G: ['#0c2b1c', '#12502a', '#1c7a34', '#2fae44', '#62d64f', '#a8f070', '#e6ffc2'],
  // ship hull: blue-violet steel, dark -> light
  S: ['#0e0c1e', '#17152e', '#222244', '#30345f', '#444e82', '#6272ab', '#8fa2d2', '#c3d0ee'],
  // deep space behind the windows
  SP: ['#05040d', '#0b0a1c', '#141230', '#1f1a46'],
  // light strips and lamps
  MAG: '#ff4fa3', MAGL: '#ffb3d9', CYAN: '#4fe3ff', CYANL: '#c8f7ff', AMB: '#ffcf3a', AMBL: '#fff2a8',
  // tractor beams and ray shots
  BEAM: '#9dff4a', BEAML: '#eaffc8',
  // the eye
  EYEW: '#f6fbff', EYES: '#b9d0e4', IRIS: '#ff3b30', IRISD: '#a3151a', PUP: '#1a0a12', WARN: '#ffe063',
  // the cow (rubia galega: golden blond)
  C: ['#6b4423', '#a8702f', '#d59a46', '#eebd6a', '#fbe3a6'], CREAM: '#fff3d6', NOSE: '#f08aa6'
};
const G = PAL.G;

// ---------------------------------------------------------------------------------------------------------------------
// Pixel buffers (0xRRGGBB ints, NONE = empty), baked once into canvases with a white copy for the hit flash
// ---------------------------------------------------------------------------------------------------------------------
const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
const OUTI = I(OUT);
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function buf(w, h, ox = 0, oy = 0) { const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox, oy }; }
function put(b, x, y, c) { if (typeof c === 'string') c = I(c); x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
// every pixel whose centre passes f(x, y): colour c, or c(x, y) (NONE/undefined = leave)
function shape(b, x0, y0, x1, y1, f, c) {
  const fn = typeof c === 'function';
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (!f(x + 0.5, y + 0.5)) continue;
    const v = fn ? c(x + 0.5, y + 0.5) : c;
    if (v != null && v !== NONE) put(b, x, y, v);
  }
}
function oval(b, cx, cy, rx, ry, c) { shape(b, cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, c); }
// a shaded ball: cols dark -> light (5 tones), lit from the upper front (the hero sprite's light)
function ball(b, cx, cy, rx, ry, cols, f, lx = 0.45, ly = -0.85, th = [0.6, 0.18, -0.34, -0.72]) {
  shape(b, cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && (!f || f(x, y)), (x, y) => {
    const l = (x - cx) / rx * lx + (y - cy) / ry * ly;
    return I(cols[l > th[0] ? 4 : l > th[1] ? 3 : l > th[2] ? 2 : l > th[3] ? 1 : 0]);
  });
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
function poly(b, P, c) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  shape(b, x0, y0, x1, y1, (x, y) => inPoly(P, x, y), c);
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
M5.px = { NONE, I, buf, put, get, rect, shape, oval, ball, line, inPoly, poly, outline, bake, mk, blit, canvasOf };

// soft additive light: one cached 64px radial sprite per colour, scaled to r
const glows = {};
M5.glow = (x, y, r, col, a = 0.5) => {
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
// the red '!' every robot shows before it attacks (blinks)
M5.bang = (x, y, t = G_t()) => {
  if (Math.floor(t / 5) % 2) return;
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = OUT; ctx.fillRect(x - 2, y - 10, 5, 8); ctx.fillRect(x - 2, y - 1, 5, 4);
  ctx.fillStyle = '#ff3b30'; ctx.fillRect(x - 1, y - 9, 3, 6); ctx.fillRect(x - 1, y, 3, 2);
  ctx.fillStyle = '#ffd6d1'; ctx.fillRect(x - 1, y - 9, 1, 5);
};
function G_t() { return typeof window !== 'undefined' && window.G ? window.G.t : (typeof globalThis.G !== 'undefined' ? globalThis.G.t : 0); }
// white speech bubble with red text, tail down to (x, y)
M5.bubble = (x, y, s) => {
  x = Math.round(x); y = Math.round(y);
  const w = s.length * 6 + 3, l = -Math.floor(w / 2), by = -14;
  ctx.save(); ctx.translate(x, y);
  const F = FLASH; FLASH = false;
  RO(l, by, w, 11, '#ffffff'); R(l, by + 10, w, 1, '#d8dce6');
  R(-2, by + 11, 5, 1, '#ffffff'); R(-1, by + 12, 3, 1, '#ffffff'); R(0, by + 13, 1, 1, '#ffffff');
  R(-3, by + 11, 1, 1, OUT); R(3, by + 11, 1, 1, OUT); R(-2, by + 12, 1, 1, OUT); R(2, by + 12, 1, 1, OUT); R(-1, by + 13, 1, 1, OUT); R(1, by + 13, 1, 1, OUT); R(0, by + 14, 1, 1, OUT);
  text(s, 1, by + 2, '#e0302a', 1, 'center', null);
  FLASH = F; ctx.restore();
};

// ---------------------------------------------------------------------------------------------------------------------
// The eye (shared by every robot): steel bezel + white lens baked into the body sprite; iris, pupil and lid are live
// ---------------------------------------------------------------------------------------------------------------------
const BEZ = [METDD, METD, MET, METL, '#ffffff'];
function bakeEye(b, cx, cy, r) {            // r = lens radius; the bezel adds 2
  oval(b, cx, cy, r + 2.7, r + 2.7, I(G[0]));
  ball(b, cx, cy, r + 2, r + 2, BEZ);
  oval(b, cx, cy, r, r, I(PAL.EYEW));
  shape(b, cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r && (x - cx) * -0.35 + (y - cy) * 0.94 > r * 0.52, I(PAL.EYES));
}
// live: iris + pupil looking along (lx, ly), in sprite space. mood: 'warn' (yellow, tiny pupil), 'shoot' (white hot)
function liveEye(cx, cy, r, lx, ly, mood, t) {
  const k = r - 2.4, x = Math.round(cx + clamp(lx, -1, 1) * k), y = Math.round(cy + clamp(ly, -1, 1) * k);
  const warn = mood === 'warn', hot = mood === 'shoot';
  const col = hot ? '#ffffff' : warn ? (Math.floor(t / 4) % 2 ? PAL.WARN : '#ffffff') : PAL.IRIS;
  const big = r >= 4.5;
  if (big) { R(x - 2, y - 1, 5, 3, col); R(x - 1, y - 2, 3, 5, col); if (!warn && !hot) { R(x + 1, y + 1, 1, 1, PAL.IRISD); R(x, y + 2, 1, 1, PAL.IRISD); } }
  else { R(x - 1, y - 1, 3, 3, col); }
  if (warn || hot) R(x, y, 1, 1, PAL.PUP);
  else if (big) { R(x, y - 1, 1, 3, PAL.PUP); R(x - 1, y, 3, 1, PAL.PUP); R(x - 1, y - 1, 1, 1, '#ffffff'); }
  else { R(x, y, 1, 1, PAL.PUP); }
}
const lookAt = (x, y) => { const p = G_p(); if (!p) return [1, 0]; const dx = p.x - x, dy = (p.y - 16) - y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
function G_p() { return typeof globalThis.G !== 'undefined' && globalThis.G && globalThis.G.p ? globalThis.G.p : null; }

// ---------------------------------------------------------------------------------------------------------------------
// OGGLE: the trooper. A green egg on two boots, one huge eye, a springy antenna, a tank on its back, a ray gun.
// ---------------------------------------------------------------------------------------------------------------------
const GB = [G[1], G[2], G[3], G[4], G[5]];
const OGG = (() => {
  const b = buf(46, 50, 23, 46);
  // back tank
  rect(b, -14, -22, 5, 11, I(METD)); rect(b, -14, -22, 1, 11, I(METDD)); rect(b, -11, -22, 1, 11, I(METL)); rect(b, -14, -17, 5, 1, I(METDD));
  rect(b, -13, -24, 3, 2, I(MET)); rect(b, -13, -11, 3, 2, I(METDD));
  // body: an egg (wider below the middle)
  ball(b, 0, -15, 10.2, 11, GB, (x, y) => true);
  shape(b, -11, -15, 11, -4, (x, y) => ((x) / 10.6) ** 2 + ((y + 13) / 9) ** 2 <= 1 && y > -13, (x, y) => I(x * 0.45 + (y + 13) / 9 * -0.85 > -0.34 ? G[3] : x > -6 ? G[2] : G[1]));
  // belt: a steel band with an amber buckle lamp
  for (let x = -11; x <= 11; x++) { if (get(b, x, -8) !== NONE) put(b, x, -8, x > 3 ? METL : MET); if (get(b, x, -7) !== NONE) put(b, x, -7, METD); }
  put(b, 4, -8, PAL.AMBL); put(b, 5, -8, PAL.AMB); put(b, 4, -7, PAL.AMB); put(b, 5, -7, '#c98a16');
  // plate seam and rivets on the back half
  for (let y = -22; y <= -10; y++) if (get(b, -6, y) !== NONE) put(b, -6, y, G[1]);
  put(b, -8, -18, G[5]); put(b, -8, -13, G[5]);
  // grumpy zig-zag mouth
  put(b, 3, -10, G[0]); put(b, 4, -11, G[0]); put(b, 5, -10, G[0]); put(b, 6, -11, G[0]); put(b, 7, -10, G[0]);
  // the eye
  bakeEye(b, 2, -18, 4.6);
  outline(b);
  return mk(b);
})();
M5.oggle = (x, y, facing = -1, o = {}) => {
  const t = o.t ?? G_t(), pose = o.pose || 'idle';
  const look = o.look || lookAt(x, y - 18);
  const walk = pose === 'walk', f = Math.floor(t / 7) % 4;
  const bob = walk ? (f % 2 ? -1 : 0) : pose === 'warn' ? (Math.floor(t / 3) % 2 ? -1 : 0) : (Math.floor(t / 24) % 2 ? -1 : 0);
  const squash = pose === 'shoot' ? 1 : 0;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(facing, 1);
  // boots (behind the body)
  const la = walk ? [0, -2, 0, 0][f] : 0, lb = walk ? [0, 0, 0, -2][f] : 0, sa = walk ? [0, 1, 2, 1][f] - 1 : 0, sb = -sa;
  RO(-8 + sb, -4 + lb, 6, 4, METD); R(-8 + sb, -4 + lb, 6, 1, MET); R(-3 + sb, -2 + lb, 1, 1, METL);
  R(-6 + sb, -6 + lb, 3, 2, G[1]);
  RO(2 + sa, -4 + la, 6, 4, METD); R(2 + sa, -4 + la, 6, 1, MET); R(7 + sa, -2 + la, 1, 1, METL);
  R(4 + sa, -6 + la, 3, 2, G[1]);
  ctx.translate(0, bob + squash);
  // antenna: a springy stalk with a lamp (blinks white before an attack)
  const sway = pose === 'warn' ? (Math.floor(t / 3) % 2 ? 1 : -1) : Math.round(Math.sin(t / 14) * 1);
  R(-4, -29, 1, 4, OUT); R(-4 + (sway > 0 ? 1 : sway < 0 ? -1 : 0), -32, 1, 3, OUT);
  const ax = -4 + sway, lamp = pose === 'warn' ? (Math.floor(t / 4) % 2 ? '#ffffff' : PAL.IRIS) : pose === 'shoot' ? '#ffffff' : PAL.AMB;
  RO(ax - 1, -35, 3, 3, lamp); R(ax - 1, -35, 1, 1, '#ffffff');
  blit(OGG, 0, 0);
  // eye
  liveEye(2, -18, 4.6, look[0] * facing, look[1], pose, t);
  if (pose === 'aim' || pose === 'shoot' || pose === 'warn') {      // angry lid, sloping down to the front
    R(-1, -23, 7, 1, G[2]); R(1, -22, 6, 1, G[2]); R(4, -21, 3, 1, G[2]); R(1, -21, 3, 1, G[0]); R(4, -20, 3, 1, G[0]); R(-2, -22, 3, 1, G[0]);
  } else if (pose === 'hit') { R(-2, -22, 9, 4, G[3]); R(-2, -18, 9, 1, G[0]); R(-2, -22, 9, 1, G[4]); }
  else if (Math.floor(t / 6) % 30 === 0) { R(-2, -22, 9, 7, G[3]); R(-2, -16, 9, 1, G[0]); }   // blink
  // arm + ray gun (lowered while walking)
  const gy = (walk || pose === 'idle' ? 2 : 0), rc = pose === 'shoot' ? -2 : 0;
  R(5 + rc, -14 + gy, 5, 3, G[2]); R(5 + rc, -14 + gy, 5, 1, G[3]);
  RO(9 + rc, -16 + gy, 7, 5, '#c9d2e0'); R(9 + rc, -16 + gy, 7, 1, '#ffffff'); R(9 + rc, -12 + gy, 7, 1, '#8794a8');
  RO(10 + rc, -11 + gy, 2, 3, METD);
  R(16 + rc, -15 + gy, 1, 3, PAL.MAG); R(17 + rc, -14 + gy, 2, 1, '#c9d2e0'); R(19 + rc, -15 + gy, 1, 3, PAL.MAG);
  const tip = pose === 'warn' ? (Math.floor(t / 4) % 2 ? '#ffffff' : PAL.BEAM) : pose === 'shoot' ? '#ffffff' : PAL.BEAM;
  RO(21 + rc, -15 + gy, 2, 3, tip);
  ctx.restore();
  if (pose === 'warn') { M5.glow(x + facing * 22, y - 13 + bob, 7, PAL.BEAM, 0.5 + 0.3 * Math.sin(t / 2)); M5.bang(x, y - 40, t); }
  if (pose === 'shoot') M5.glow(x + facing * 23, y - 13, 11, PAL.BEAML, 0.9);
};

// ---------------------------------------------------------------------------------------------------------------------
// EYE DRONE: a little flying saucer with a glass dome and one eye hanging underneath. (x, y) = the disc's centre.
// ---------------------------------------------------------------------------------------------------------------------
const DRONE = (() => {
  const b = buf(40, 34, 20, 15);
  // eye pod under the disc
  oval(b, 0, 5, 7.6, 7.6, I(G[0]));
  ball(b, 0, 5, 7, 7, BEZ);
  // glass dome
  shape(b, -8, -11, 8, -2, (x, y) => (x / 7.6) ** 2 + ((y + 3) / 7.6) ** 2 <= 1 && y < -2, (x, y) => I(x < -3.5 && y > -9 ? '#dff9ff' : x > 3 ? '#3f9fc4' : y < -8.5 ? '#b9f0ff' : '#74d3ee'));
  put(b, -4, -8, '#ffffff'); put(b, -5, -7, '#ffffff'); put(b, -5, -6, '#ffffff');
  // a tiny pilot lamp inside the dome
  rect(b, -1, -6, 3, 3, I(PAL.MAG)); put(b, -1, -6, PAL.MAGL);
  // the disc: light on top, dark underneath, a steel rim line
  shape(b, -15, -5, 15, 5, (x, y) => (x / 14.6) ** 2 + (y / 4.7) ** 2 <= 1, (x, y) => I(y < -2.2 ? G[5] : y < -0.6 ? G[4] : y < 0.6 ? G[3] : y < 2.4 ? G[2] : G[1]));
  for (let x = -14; x <= 14; x++) if (get(b, x, 1) !== NONE) put(b, x, 1, x > 6 ? MET : METD);
  // the eye lens (faces down and forward)
  oval(b, 1, 7, 4.2, 4.2, I(PAL.EYEW));
  shape(b, -4, 3, 6, 12, (x, y) => (x - 1) ** 2 + (y - 7) ** 2 <= 4.2 * 4.2 && (x - 1) * -0.35 + (y - 7) * 0.94 > 2.3, I(PAL.EYES));
  outline(b);
  return mk(b);
})();
M5.drone = (x, y, facing = -1, o = {}) => {
  const t = o.t ?? G_t(), pose = o.pose || 'idle';
  const hov = o.still ? 0 : Math.round(Math.sin(t / 11 + (o.ph || 0)) * 2);
  const look = o.look || lookAt(x, y + 7);
  if (o.beam) {                                            // tractor beam: a green cone down to o.beam (world y)
    const y0 = y + hov + 12, y1 = o.beam, n = Math.max(1, Math.round(y1 - y0));
    ctx.save();
    for (let j = 0; j < n; j += 2) {
      const k = j / n, hw = Math.round(5 + k * 13), a = 0.34 - k * 0.14 + 0.08 * Math.sin(t / 3 - j / 4);
      ctx.fillStyle = 'rgba(157,255,74,' + clamp(a, 0, 1).toFixed(3) + ')'; ctx.fillRect(Math.round(x) - hw, Math.round(y0 + j), hw * 2, 2);
    }
    for (let k = 0; k < 4; k++) {                          // rings sliding up the beam
      const u = ((t / 40 + k / 4) % 1), yy = Math.round(y1 - u * n), hw = Math.round(5 + (1 - u) * 13);
      ctx.fillStyle = 'rgba(234,255,200,' + (0.5 * (1 - Math.abs(u - 0.5) * 2) + 0.15).toFixed(3) + ')'; ctx.fillRect(Math.round(x) - hw, yy, hw * 2, 1);
    }
    ctx.restore();
  }
  ctx.save(); ctx.translate(Math.round(x), Math.round(y) + hov); ctx.scale(facing, 1);
  R(0, -14, 1, 3, OUT); RO(-1, -17, 3, 3, pose === 'warn' ? (Math.floor(t / 4) % 2 ? '#ffffff' : PAL.IRIS) : PAL.AMB);
  blit(DRONE, 0, 0);
  for (let i = 0; i < 5; i++) {                            // rim lamps chasing round
    const on = (Math.floor(t / 6) + i) % 5 === 0 || pose === 'warn';
    R(-11 + i * 5 + (i > 2 ? 1 : 0), -1, 2, 1, on ? PAL.AMBL : '#8a6a12');
  }
  liveEye(1, 7, 4.2, look[0] * facing, Math.max(0, look[1]), pose, t);
  ctx.restore();
  if (pose === 'warn') { M5.glow(x + facing, y + hov + 7, 10, PAL.WARN, 0.55); M5.bang(x, y + hov - 22, t); }
};

// ---------------------------------------------------------------------------------------------------------------------
// ROLY EYE: a rolling one-eyed ball. Low: crouch shots hit it. (x, y) = where it touches the floor.
// ---------------------------------------------------------------------------------------------------------------------
const ROLY = (() => {
  const b = buf(26, 26, 13, 21);
  ball(b, 0, -9, 9.2, 9.2, GB);
  bakeEye(b, 2, -10, 3.4);
  outline(b);
  return mk(b);
})();
M5.roller = (x, y, facing = -1, o = {}) => {
  const t = o.t ?? G_t(), pose = o.pose || 'idle', a = o.rot ?? t / 5;
  const look = o.look || lookAt(x, y - 10);
  const hop = pose === 'warn' ? (Math.floor(t / 3) % 2 ? -1 : 0) : 0;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y) + hop); ctx.scale(facing, 1);
  blit(ROLY, 0, 0);
  for (let k = 0; k < 4; k++) {                            // rivets going round: the roll
    const th = a + k * Math.PI / 2, rx = Math.round(Math.cos(th) * 7), ry = Math.round(-9 + Math.sin(th) * 7);
    if ((rx - 2) ** 2 + (ry + 10) ** 2 < 42) continue;
    R(rx, ry, 2, 2, G[0]); R(rx, ry, 1, 1, G[6]);
  }
  liveEye(2, -10, 3.4, look[0] * facing, look[1], pose, t);
  if (pose === 'warn' || pose === 'aim') { R(0, -14, 5, 1, G[2]); R(3, -13, 3, 1, G[2]); R(0, -13, 3, 1, G[0]); R(3, -12, 3, 1, G[0]); }
  ctx.restore();
  if (pose === 'warn') {
    M5.bang(x, y - 26, t);
    for (let k = 0; k < 3; k++) { const u = (t / 9 + k / 3) % 1; ctx.fillStyle = k % 2 ? PAL.AMBL : '#ffffff'; ctx.fillRect(Math.round(x - facing * (9 + u * 9)), Math.round(y - 2 - u * 7 * (k + 1) / 2), 1, 1); }
  }
};

// ---------------------------------------------------------------------------------------------------------------------
// The rescue: an abducted Galician cow (golden blond, cream muzzle, little horns, a bell) in a glass stasis pod
// ---------------------------------------------------------------------------------------------------------------------
const C = PAL.C;
function bakeCow(float) {
  const b = buf(34, 28, 16, 23);
  // tail
  line(b, -10, -11, -12, -6, I(C[1])); put(b, -12, -5, C[0]); put(b, -13, -4, C[0]); put(b, -12, -4, C[0]);
  // legs (dangling a little apart when floating)
  const L = float ? [[-8, 1], [-4, 0], [3, 0], [7, 1]] : [[-7, 0], [-4, 0], [3, 0], [6, 0]];
  L.forEach(([lx, sp], i) => { const far = i === 1 || i === 2; rect(b, lx, -5, 2, float ? 4 : 5, I(far ? C[1] : C[2])); rect(b, lx + (float ? sp * (i < 2 ? -1 : 1) : 0), float ? -1 : -1, 2, 1, I(C[0])); });
  // body
  ball(b, 0, -9, 9, 5.6, [C[1], C[1], C[2], C[3], C[4]]);
  rect(b, -3, -5, 5, 1, I(PAL.NOSE)); put(b, -1, -4, PAL.NOSE);                                  // udder
  // head
  ball(b, 9, -13, 4.8, 4.4, [C[1], C[2], C[2], C[3], C[4]]);
  rect(b, 5, -18, 1, 2, I(PAL.CREAM)); rect(b, 11, -18, 1, 2, I(PAL.CREAM));                    // horns
  put(b, 4, -15, C[1]); put(b, 3, -15, C[1]); put(b, 3, -14, C[0]);                             // ear
  oval(b, 11.5, -10.5, 2.9, 2.2, I(PAL.CREAM));                                                  // muzzle
  put(b, 11, -11, PAL.NOSE); put(b, 13, -11, PAL.NOSE);
  put(b, 8, -14, '#ffffff'); put(b, 9, -14, OUTI); put(b, 12, -14, OUTI);                        // eyes
  // collar + bell
  rect(b, 5, -10, 1, 4, I('#d0302a')); rect(b, 5, -6, 2, 2, I(PAL.AMB)); put(b, 5, -6, PAL.AMBL);
  outline(b);
  return mk(b);
}
const COW = { stand: bakeCow(false), float: bakeCow(true) };
M5.cow = (x, y, facing = 1, o = {}) => {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(facing, 1);
  blit(o.float ? COW.float : COW.stand, 0, 0);
  ctx.restore();
};
// the pod: steel base with hazard stripes, glass tube, steel cap with a lamp. (x, y) = floor point. 34 wide, 50 tall.
M5.pod = (x, y, o = {}) => {
  const t = o.t ?? G_t();
  x = Math.round(x); y = Math.round(y);
  ctx.save(); ctx.translate(x, y);
  // back of the tube
  ctx.fillStyle = 'rgba(24,70,66,0.50)'; ctx.fillRect(-15, -42, 30, 36);
  ctx.fillStyle = 'rgba(157,255,74,0.20)'; ctx.fillRect(-15, -42, 30, 36);
  ctx.fillStyle = 'rgba(234,255,200,0.16)'; ctx.fillRect(-15, -42, 30, 2); ctx.fillRect(-15, -9, 30, 3);
  for (let k = 0; k < 6; k++) {                            // bubbles rising in the green field
    const u = (t / 90 + hsh(k * 7.3 + (o.id || 0))) % 1;
    ctx.fillStyle = 'rgba(234,255,200,0.75)'; ctx.fillRect(Math.round(-13 + hsh(k * 3.1) * 25 + Math.sin(t / 13 + k) * 1.5), Math.round(-8 - u * 32), 1, 1);
  }
  if (!o.empty) M5.cow(-2 * (o.facing || -1) * -1 - 0, -15 + Math.round(Math.sin(t / 17 + (o.id || 0)) * 1.5), o.facing || -1, { float: true });
  // glass front: highlights
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-13, -40, 2, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-10, -40, 1, 18);
  ctx.fillStyle = 'rgba(10,20,40,0.22)'; ctx.fillRect(13, -42, 2, 36);
  R(-16, -42, 1, 36, OUT); R(15, -42, 1, 36, OUT);
  // cap
  RO(-16, -47, 32, 5, METD); R(-16, -47, 32, 1, METL); R(-16, -43, 32, 1, METDD);
  RO(-3, -50, 6, 3, MET); R(-1, -49, 2, 1, Math.floor(t / 20) % 2 ? PAL.BEAM : PAL.G[2]);
  // base with hazard stripes
  RO(-17, -6, 34, 6, METD); R(-17, -6, 34, 1, METL);
  for (let i = 0; i < 8; i++) { R(-16 + i * 4, -4, 2, 3, PAL.AMB); R(-14 + i * 4, -4, 2, 3, '#22222c'); }
  R(-17, -1, 34, 1, METDD);
  ctx.restore();
};

// ---------------------------------------------------------------------------------------------------------------------
// Registry stand-ins for the mock frames: every robot HOLDS the pose its spawn spec gives it
//   spawns: [{ t: 'oggle', x: 900, pose: 'warn', face: -1, look: [-1, 0] }]
// ---------------------------------------------------------------------------------------------------------------------
const posed = (hp, draw, box, extra = {}) => Object.assign({
  hp, contact: 'none', activateMargin: 600,
  make(e, s) { e.pose = s.pose || 'idle'; e.look = s.look || null; e.facing = s.face || -1; e.spec = s; if (s.y != null) e.y = s.y; },
  update(e) { e.vx = 0; },
  draw(e) { FLASH = e.hitT > 0; draw(e); FLASH = false; },
  box,
  onKill(e, cx, cy, b) { boom(cx, cy, 0.8); debris(cx, cy, 8, PAL.G[3]); debris(cx, cy, 4, MET); addScore(100, cx, b.y); }
}, extra);
ENEMY_TYPES.oggle = posed(3, e => M5.oggle(e.x, e.y, e.facing, { pose: e.pose, look: e.look }), e => ({ x: e.x - 10, y: e.y - 27, w: 20, h: 27 }));
ENEMY_TYPES.eyedrone = posed(2, e => M5.drone(e.x, e.y, e.facing, { pose: e.pose, look: e.look, beam: e.spec.beam, ph: e.x }), e => ({ x: e.x - 14, y: e.y - 10, w: 28, h: 22 }), { flying: true });
ENEMY_TYPES.roller = posed(2, e => M5.roller(e.x, e.y, e.facing, { pose: e.pose, look: e.look, rot: e.spec.rot }), e => ({ x: e.x - 9, y: e.y - 18, w: 18, h: 18 }));
// the oggle's shot: a slow green ring that grows a little (easy to jump or duck)
EB_TYPES.ogring = {
  r: 5,
  draw(b) {
    const x = Math.round(b.x), y = Math.round(b.y), s = Math.floor((b.t = (b.t || 0) + 1) / 5) % 2;
    M5.glow(x, y, 10, PAL.BEAM, 0.45);
    ctx.fillStyle = OUT; ctx.fillRect(x - 3, y - 5 - s, 6, 10 + s * 2);
    ctx.fillStyle = PAL.BEAM; ctx.fillRect(x - 2, y - 4 - s, 4, 8 + s * 2);
    ctx.fillStyle = PAL.BEAML; ctx.fillRect(x - 1, y - 3 - s, 2, 6 + s * 2);
    ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 2, 2, 4);
    ctx.fillStyle = 'rgba(157,255,74,0.5)'; ctx.fillRect(x + (b.vx < 0 ? 4 : -8), y - 2, 4, 1); ctx.fillRect(x + (b.vx < 0 ? 5 : -11), y + 1, 6, 1);
  }
};
POW_KINDS.cow = {
  thanks: 'MOO! THANK YOU!',
  box: o => ({ x: o.x - 16, y: o.y - 48, w: 32, h: 48 }),
  draw(o) {
    if (o.state === 'tied') {
      M5.pod(o.x, o.y, { id: o.id });
      const t = o.t + o.id * 37;
      if (Math.floor(t / 40) % 2 === 0) M5.bubble(o.x, o.y - 54 + (Math.floor(t / 10) % 2), Math.floor(t / 80) % 2 ? 'MOO!' : 'HELP!');
    } else {
      M5.pod(o.x, o.y, { id: o.id, empty: true });
      M5.cow(o.x + (o.state === 'run' ? -(o.t - 64) * 2.2 * 0 : 0), o.y - (o.state === 'free' ? Math.round(Math.sin(o.t / 24 * Math.PI) * 6) : 0), o.state === 'run' ? -1 : 1);
    }
  }
};
}
