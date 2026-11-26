'use strict';
// =====================================================================================================================
// Mission 5 (ALIEN MOTHERSHIP) cast: the shared palette, pixel helpers and looks of the OGGLES (green one-eyed alien
// robots) and of the abducted cows. Owner: robots (docs/level5-spec.md section 3). Loaded first of the Mission 5 files.
//
// Exports (global M5; everything else is private to the block):
//   M5.PAL                                 palette: G (alien green ramp), S (ship steel ramp), lights, eye colours
//   M5.px                                  pixel-buffer helpers (buf put get rect shape oval ball line poly outline bake
//                                          mk blit canvasOf)
//   M5.glow(x, y, r, col, a)               soft additive light (cached sprite), world or screen space
//   M5.bang(x, y, t)                       the red '!' warning mark every robot shows before it attacks
//   M5.oggle(x, y, facing, o)              the trooper: green egg robot, ONE big eye, antenna, ray gun
//   M5.drone(x, y, facing, o)              the eye saucer: flying disc, glass dome, one eye underneath
//   M5.roller(x, y, facing, o)             the roly eye: a rolling one-eyed ball
//   M5.cow(x, y, facing, o)                the abducted Galician cow (the rescue)
//   M5.pod(x, y, o)                        the glass stasis pod a cow floats in
//   M5.bubble(x, y, s)                     white speech bubble with red text (HELP! / MOO!)
// Poses (o.pose): 'idle' | 'walk' | 'aim' | 'warn' | 'shoot' | 'hit'.   o.look = [dx, dy] where the eye looks
// (-1..1 each; default: at the hero).   o.t = animation clock (default G.t).
// Drawing never calls Math.random()/rand(): hsh(n) and the clock only. Sprites are baked once at load.
//
// Added with the real robots (everything above still works exactly as before; these only add):
//   M5.oggle       more poses 'jump' | 'land' | 'dizzy' | 'scared';  o.helmet (the glass bubble of AREA 3);
//                  o.aim (radians, + = down: the arm and gun point along it; the sniper)
//   M5.oggleMuzzle(aim)                    -> [dx, dy] of the gun tip from the feet, facing right (dx * facing)
//   M5.helmet(x, y, facing)                the oggle's glass bubble alone ((x, y) = its feet)
//   M5.roller      more poses 'dash' | 'skid' | 'dizzy' | 'hit';  o.hop (px off the floor)
//   M5.cow         o.v 0 blond | 1 black-and-white | 2 blond calf;  o.float;  o.run (a clock: gallop);
//                  o.pose 'stand' | 'leap' | 'happy' (leaping with a MOO!);  o.moo (mouth open)
//   M5.pod         o.v (the cow inside);  o.broken (frames since the glass popped: stumps of glass, no cap)
//   M5.flower(x, y, facing, o)             the EYE FLOWER: o.pose 'shut' | 'open' | 'warn' | 'spit' | 'hit';
//                                          o.k 0..1 = how far the bloom is open;  o.shake;  M5.FLOWER_HEAD = { x, y }
//   M5.ring(x, y, o)                       a ray-gun ring shot (o.dir, o.t, o.c1 / o.c2: green by default)
//   M5.seed(x, y, t)                       the eye flower's seed
//   M5.bits                                burst pieces, each { img, white, w, h, ox, oy } (engine 'sprite' particles
//                                          take them as they are): plateA plateB plateC cap low bowl rcap boot gun
//                                          tank lamp bolt nut eye eyeS petal leaf stump glassA glassB glassC podcap
//   M5.burst(kind, x, y, facing, o)        throws a beaten robot's pieces into G.parts: kind 'oggle' | 'roller' |
//                                          'flower' | 'saucer' | 'pod'; (x, y) = its feet. Uses rand(): call it from
//                                          UPDATE code only (onKill, onFree), never from a draw.
//   M5.wreck(x, y, facing, o)              what is left standing: the cracked shell and the eye boinging on its
//                                          spring; o.kind 'oggle' | 'roller' | 'flower', o.a = frames since the burst
//   M5.cargo(kind, x, y, t, rot, o)        a grabbed robot dangling / tumbling ('oggle' | 'roller'); (x, y) = its
//                                          middle; rot in radians (drawn in 8 crisp steps); o.helmet. Its 40 sprites
//                                          are baked at the first grab, not at load.
//   M5.px          also rotBuf (turn a buffer, nearest neighbour), trim, stamp, unline (strip the outline before a turn)
// =====================================================================================================================
var M5 = {};
{
const Math = globalThis.Math;
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
const GR = PAL.G;   // (not "G": that is the game state)

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
// a copy of src turned by ang about its origin (nearest neighbour: crisp), in a square buffer with the origin in the middle
function rotBuf(src, ang) {
  let r = 0;
  for (const [cx, cy] of [[-src.ox, -src.oy], [src.w - src.ox, -src.oy], [-src.ox, src.h - src.oy], [src.w - src.ox, src.h - src.oy]]) r = Math.max(r, Math.hypot(cx, cy));
  const n = Math.ceil(r) + 2, d = buf(n * 2, n * 2, n, n), c = Math.cos(ang), s = Math.sin(ang);
  for (let y = -n; y < n; y++) for (let x = -n; x < n; x++) {
    const v = get(src, Math.round(x * c + y * s), Math.round(-x * s + y * c));
    if (v !== NONE) put(d, x, y, v);
  }
  return d;
}
// the same picture in the smallest buffer that holds it (the origin stays where it was)
function trim(b) {
  let x0 = b.w, y0 = b.h, x1 = -1, y1 = -1;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.d[y * b.w + x] !== NONE) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return b;
  const d = buf(x1 - x0 + 1, y1 - y0 + 1, b.ox - x0, b.oy - y0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) d.d[(y - y0) * d.w + (x - x0)] = b.d[y * b.w + x];
  return d;
}
// src painted into dst with its origin at (dx, dy)
function stamp(dst, src, dx = 0, dy = 0) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const v = src.d[y * src.w + x]; if (v !== NONE) put(dst, x - src.ox + dx, y - src.oy + dy, v); }
}
// a copy of b without its outer outline (the dark pixels that touch nothing): turn it, then outline() it again
function unline(b) {
  const d = buf(b.w, b.h, b.ox, b.oy); d.d.set(b.d);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const i = y * b.w + x;
    if (b.d[i] !== OUTI) continue;
    if (x === 0 || y === 0 || x === b.w - 1 || y === b.h - 1 || b.d[i - 1] === NONE || b.d[i + 1] === NONE || b.d[i - b.w] === NONE || b.d[i + b.w] === NONE) d.d[i] = NONE;
  }
  return d;
}
const lerp = (a, b, k) => a + (b - a) * k;
M5.px = { NONE, I, buf, put, get, rect, shape, oval, ball, line, inPoly, poly, outline, bake, mk, blit, canvasOf, rotBuf, trim, stamp, unline };

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
M5.bang = (x, y, t = G.t) => {
  if (Math.floor(t / 5) % 2) return;
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = OUT; ctx.fillRect(x - 2, y - 10, 5, 8); ctx.fillRect(x - 2, y - 1, 5, 4);
  ctx.fillStyle = '#ff3b30'; ctx.fillRect(x - 1, y - 9, 3, 6); ctx.fillRect(x - 1, y, 3, 2);
  ctx.fillStyle = '#ffd6d1'; ctx.fillRect(x - 1, y - 9, 1, 5);
};
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
  oval(b, cx, cy, r + 2.7, r + 2.7, I(GR[0]));
  ball(b, cx, cy, r + 2, r + 2, BEZ);
  oval(b, cx, cy, r, r, I(PAL.EYEW));
  shape(b, cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r && (x - cx) * -0.35 + (y - cy) * 0.94 > r * 0.52, I(PAL.EYES));
}
const SPIRAL5 = ['####.', '...#.', '.#.#.', '.###.', '.....'].map(r => r.split(''));
const SPIRAL7 = ['.#####.', '.....#.', '.###.#.', '.#.#.#.', '.#...#.', '.#####.', '.......'].map(r => r.split(''));
// live: iris + pupil looking along (lx, ly), in sprite space. mood: 'warn' (yellow, tiny pupil), 'shoot' (white hot)
function liveEye(cx, cy, r, lx, ly, mood, t) {
  if (mood === 'dizzy') {                     // a spiral going round in quarter turns
    const q = Math.floor(t / 4) % 4, big = r >= 4.5, S = big ? SPIRAL7 : SPIRAL5, n = S.length, h = n >> 1;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const [u, v] = q === 0 ? [i, j] : q === 1 ? [j, n - 1 - i] : q === 2 ? [n - 1 - i, n - 1 - j] : [n - 1 - j, i];
      if (S[v][u] === '#') R(cx - h + i, cy - h + j, 1, 1, PAL.PUP);
    }
    R(cx, cy, 1, 1, PAL.IRIS);
    return;
  }
  const k = r - 2.4, x = Math.round(cx + clamp(lx, -1, 1) * k), y = Math.round(cy + clamp(ly, -1, 1) * k);
  if (mood === 'scared') { R(x - 1, y - 1, 3, 3, PAL.IRIS); R(x, y, 1, 1, PAL.PUP); return; }      // a small iris: wide-eyed
  const warn = mood === 'warn', hot = mood === 'shoot';
  const col = hot ? '#ffffff' : warn ? (Math.floor(t / 4) % 2 ? PAL.WARN : '#ffffff') : PAL.IRIS;
  const big = r >= 4.5;
  if (big) { R(x - 2, y - 1, 5, 3, col); R(x - 1, y - 2, 3, 5, col); if (!warn && !hot) { R(x + 1, y + 1, 1, 1, PAL.IRISD); R(x, y + 2, 1, 1, PAL.IRISD); } }
  else { R(x - 1, y - 1, 3, 3, col); }
  if (warn || hot) R(x, y, 1, 1, PAL.PUP);
  else if (big) { R(x, y - 1, 1, 3, PAL.PUP); R(x - 1, y, 3, 1, PAL.PUP); R(x - 1, y - 1, 1, 1, '#ffffff'); }
  else { R(x, y, 1, 1, PAL.PUP); }
}
const lookAt = (x, y) => { const p = G.p; if (!p) return [1, 0]; const dx = p.x - x, dy = (p.y - 16) - y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };

// ---------------------------------------------------------------------------------------------------------------------
// OGGLE: the trooper. A green egg on two boots, one huge eye, a springy antenna, a tank on its back, a ray gun.
// ---------------------------------------------------------------------------------------------------------------------
const GB = [GR[1], GR[2], GR[3], GR[4], GR[5]];
const OGGB = (() => {
  const b = buf(46, 50, 23, 46);
  // back tank
  rect(b, -14, -22, 5, 11, I(METD)); rect(b, -14, -22, 1, 11, I(METDD)); rect(b, -11, -22, 1, 11, I(METL)); rect(b, -14, -17, 5, 1, I(METDD));
  rect(b, -13, -24, 3, 2, I(MET)); rect(b, -13, -11, 3, 2, I(METDD));
  // body: an egg (wider below the middle)
  ball(b, 0, -15, 10.2, 11, GB, (x, y) => true);
  shape(b, -11, -15, 11, -4, (x, y) => ((x) / 10.6) ** 2 + ((y + 13) / 9) ** 2 <= 1 && y > -13, (x, y) => I(x * 0.45 + (y + 13) / 9 * -0.85 > -0.34 ? GR[3] : x > -6 ? GR[2] : GR[1]));
  // belt: a steel band with an amber buckle lamp
  for (let x = -11; x <= 11; x++) { if (get(b, x, -8) !== NONE) put(b, x, -8, x > 3 ? METL : MET); if (get(b, x, -7) !== NONE) put(b, x, -7, METD); }
  put(b, 4, -8, PAL.AMBL); put(b, 5, -8, PAL.AMB); put(b, 4, -7, PAL.AMB); put(b, 5, -7, '#c98a16');
  // plate seam and rivets on the back half
  for (let y = -22; y <= -10; y++) if (get(b, -6, y) !== NONE) put(b, -6, y, GR[1]);
  put(b, -8, -18, GR[5]); put(b, -8, -13, GR[5]);
  // grumpy zig-zag mouth
  put(b, 3, -10, GR[0]); put(b, 4, -11, GR[0]); put(b, 5, -10, GR[0]); put(b, 6, -11, GR[0]); put(b, 7, -10, GR[0]);
  // the eye
  bakeEye(b, 2, -18, 4.6);
  outline(b);
  return b;
})();
const OGG = mk(OGGB);
// the arm and the ray gun, origin = the shoulder (5, -13 from the feet), baked every 15 degrees from 45 up to 75 down
// for the sniper (level, the gun is drawn live as before)
const GUN_STEP = Math.PI / 12, GUN_MIN = -3, GUN_MAX = 5;
const GUNB = (() => {
  const b = buf(26, 14, 3, 6);
  rect(b, 4, -3, 7, 5, '#c9d2e0'); rect(b, 4, -3, 7, 1, '#ffffff'); rect(b, 4, 1, 7, 1, '#8794a8');      // the body
  rect(b, 5, 3, 2, 3, METD);                                                                              // the grip
  rect(b, 16, -2, 2, 3, PAL.BEAM);                                                                        // the tip
  rect(b, 11, -2, 1, 3, PAL.MAG); rect(b, 12, -1, 3, 1, '#c9d2e0'); rect(b, 14, -2, 1, 3, PAL.MAG);       // two pink rings
  return b;
})();
const ARMB = (() => { const b = buf(8, 8, 2, 4); rect(b, 0, -1, 4, 3, GR[2]); rect(b, 0, -1, 4, 1, GR[3]); return b; })();
// the gun turned by a: turned without an outline, outlined afterwards (clean edges), the arm laid over it
function gunAt(a) { const d = rotBuf(GUNB, a); outline(d); stamp(d, rotBuf(ARMB, a)); return d; }
const GUNR = [];
for (let i = GUN_MIN; i <= GUN_MAX; i++) GUNR.push(mk(trim(gunAt(i * GUN_STEP))));
const gunIdx = aim => clamp(Math.round(aim / GUN_STEP), GUN_MIN, GUN_MAX);
// the gun tip from the feet, facing right, for a gun pointing along aim (radians, + = down)
M5.oggleMuzzle = (aim = 0) => { const c = Math.cos(aim), s = Math.sin(aim); return [5 + 18 * c + s, -13 + 18 * s - c]; };
// the glass bubble the oggles wear out on the hull: a thin bright rim, a faint fill, a steel collar on the belt
const HELM = (() => {
  const c = canvasOf(34, 30), g = c.getContext('2d'), cx = 17, cy = 14.5, rx = 14, ry = 13.4, cut = 25;
  const d = (x, y) => Math.sqrt(((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2) * 14;
  for (let y = 0; y < cut; y++) for (let x = 0; x < 34; x++) {
    const v = d(x, y), a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
    if (v > 14) continue;
    if (v > 12.9) g.fillStyle = a < -2.0 ? '#ffffff' : a < -0.9 ? '#c8f7ff' : a < 0.1 ? '#74d3ee' : a > 2.4 ? '#e8fbff' : '#4aa8cc';      // the rim
    else if (v < 10.6 && v > 8.9 && a > -2.75 && a < -2.1) g.fillStyle = '#ffffff';                                                         // a curved glint
    else if (v > 11.6 && a > 0.35 && a < 1.1) g.fillStyle = 'rgba(200,247,255,0.5)';                                                        // bounce light, low on the far side
    else g.fillStyle = 'rgba(160,236,255,0.13)';
    g.fillRect(x, y, 1, 1);
  }
  g.fillStyle = '#ffffff'; g.fillRect(24, 6, 1, 1); g.fillRect(25, 7, 1, 1);
  return c;
})();
// (x, y) = the oggle's feet; call inside the oggle's own transform or with facing
function helmetAt() {
  ctx.drawImage(HELM, -17, -33);
  RO(-11, -9, 23, 2, METL); R(-11, -8, 23, 1, MET);              // the collar
  R(-6, -32, 5, 1, OUT); R(-5, -32, 3, 1, METL);                 // a grommet in the rim where the antenna pokes out
}
M5.helmet = (x, y, facing = -1) => { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(facing, 1); const F = FLASH; FLASH = false; helmetAt(); FLASH = F; ctx.restore(); };
M5.oggle = (x, y, facing = -1, o = {}) => {
  const t = o.t ?? G.t, pose = o.pose || 'idle';
  const look = o.look || lookAt(x, y - 18);
  const walk = pose === 'walk', f = Math.floor(t / 7) % 4;
  const jump = pose === 'jump', land = pose === 'land', dizzy = pose === 'dizzy', scared = pose === 'scared';
  const bob = walk ? (f % 2 ? -1 : 0) : pose === 'warn' ? (Math.floor(t / 3) % 2 ? -1 : 0) : jump || land || scared ? 0 : (Math.floor(t / 24) % 2 ? -1 : 0);
  const squash = pose === 'shoot' || land ? 1 : 0;
  const aim = scared ? 1.3 : o.aim || 0, slant = Math.abs(aim) > 0.13;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(facing, 1);
  // boots (behind the body)
  let la = walk ? [0, -2, 0, 0][f] : 0, lb = walk ? [0, 0, 0, -2][f] : 0, sa = walk ? [0, 1, 2, 1][f] - 1 : 0, sb = -sa;
  if (jump) { la = 2; lb = 1; sa = 1; sb = -1; }                                     // legs hanging, a little apart
  else if (land) { sa = 1; sb = -1; }
  else if (scared) { const k = Math.floor(t / 5) % 2; la = k ? 3 : 1; lb = k ? 1 : 3; }   // kicking
  RO(-8 + sb, -4 + lb, 6, 4, METD); R(-8 + sb, -4 + lb, 6, 1, MET); R(-3 + sb, -2 + lb, 1, 1, METL);
  if (lb > 0) R(-6 + sb, -6, 3, 2 + lb, GR[1]); else R(-6 + sb, -6 + lb, 3, 2, GR[1]);
  RO(2 + sa, -4 + la, 6, 4, METD); R(2 + sa, -4 + la, 6, 1, MET); R(7 + sa, -2 + la, 1, 1, METL);
  if (la > 0) R(4 + sa, -6, 3, 2 + la, GR[1]); else R(4 + sa, -6 + la, 3, 2, GR[1]);
  ctx.translate(0, bob + squash);
  // antenna: a springy stalk with a lamp (blinks white before an attack)
  const sway = pose === 'warn' ? (Math.floor(t / 3) % 2 ? 1 : -1) : dizzy ? Math.round(Math.sin(t / 5) * 2) : jump ? -1 : Math.round(Math.sin(t / 14) * 1);
  R(-4, -29, 1, 4, OUT); R(-4 + (sway > 0 ? 1 : sway < 0 ? -1 : 0), -32, 1, 3, OUT);
  const ax = -4 + sway, lamp = pose === 'warn' ? (Math.floor(t / 4) % 2 ? '#ffffff' : PAL.IRIS) : pose === 'shoot' ? '#ffffff' : (dizzy || scared) && Math.floor(t / 6) % 2 ? '#8a6a12' : PAL.AMB;
  RO(ax - 1, -35, 3, 3, lamp); R(ax - 1, -35, 1, 1, '#ffffff');
  blit(OGG, 0, 0);
  // eye
  liveEye(2, -18, 4.6, look[0] * facing, look[1], dizzy ? 'dizzy' : scared ? 'scared' : pose, t);
  if (pose === 'aim' || pose === 'shoot' || pose === 'warn') {      // angry lid, sloping down to the front
    R(-1, -23, 7, 1, GR[2]); R(1, -22, 6, 1, GR[2]); R(4, -21, 3, 1, GR[2]); R(1, -21, 3, 1, GR[0]); R(4, -20, 3, 1, GR[0]); R(-2, -22, 3, 1, GR[0]);
  } else if (pose === 'hit') { R(-2, -22, 9, 4, GR[3]); R(-2, -18, 9, 1, GR[0]); R(-2, -22, 9, 1, GR[4]); }
  else if (land) { R(-2, -22, 9, 3, GR[3]); R(-2, -19, 9, 1, GR[0]); }                            // screwed up for the bump
  else if (!scared && !jump && Math.floor(t / 6) % 30 === 0) { R(-2, -22, 9, 7, GR[3]); R(-2, -16, 9, 1, GR[0]); }   // blink
  // arm + ray gun (lowered while walking)
  let mx = 22, my = -13;
  if (slant) {                                                    // pointing up or down: the baked gun, turned about the shoulder
    const i = gunIdx(aim), a = i * GUN_STEP, rc = pose === 'shoot' ? 2 : 0, m = M5.oggleMuzzle(a);
    blit(GUNR[i - GUN_MIN], 5 - Math.round(Math.cos(a) * rc), -13 - Math.round(Math.sin(a) * rc));
    mx = Math.round(m[0]); my = Math.round(m[1]);
    if ((pose === 'warn' && Math.floor(t / 4) % 2) || pose === 'shoot') R(mx - 2, my - 1, 3, 3, '#ffffff');
  } else {
    const gy = (walk || pose === 'idle' || jump || land || dizzy ? 2 : 0), rc = pose === 'shoot' ? -2 : 0;
    R(5 + rc, -14 + gy, 5, 3, GR[2]); R(5 + rc, -14 + gy, 5, 1, GR[3]);
    RO(9 + rc, -16 + gy, 7, 5, '#c9d2e0'); R(9 + rc, -16 + gy, 7, 1, '#ffffff'); R(9 + rc, -12 + gy, 7, 1, '#8794a8');
    RO(10 + rc, -11 + gy, 2, 3, METD);
    R(16 + rc, -15 + gy, 1, 3, PAL.MAG); R(17 + rc, -14 + gy, 2, 1, '#c9d2e0'); R(19 + rc, -15 + gy, 1, 3, PAL.MAG);
    const tip = pose === 'warn' ? (Math.floor(t / 4) % 2 ? '#ffffff' : PAL.BEAM) : pose === 'shoot' ? '#ffffff' : PAL.BEAM;
    RO(21 + rc, -15 + gy, 2, 3, tip);
  }
  if (o.helmet) { const F = FLASH; FLASH = false; helmetAt(); FLASH = F; }
  ctx.restore();
  if (pose === 'warn') { M5.glow(x + facing * mx, y + my + bob, 7, PAL.BEAM, 0.5 + 0.3 * Math.sin(t / 2)); M5.bang(x, y - (o.helmet ? 44 : 40), t); }
  if (pose === 'shoot') M5.glow(x + facing * (mx + 1), y + my, 11, PAL.BEAML, 0.9);
};

// ---------------------------------------------------------------------------------------------------------------------
// EYE DRONE: a little flying saucer with a glass dome and one eye hanging underneath. (x, y) = the disc's centre.
// ---------------------------------------------------------------------------------------------------------------------
const DRONE = (() => {
  const b = buf(40, 34, 20, 15);
  // eye pod under the disc
  oval(b, 0, 5, 7.6, 7.6, I(GR[0]));
  ball(b, 0, 5, 7, 7, BEZ);
  // glass dome
  shape(b, -8, -11, 8, -2, (x, y) => (x / 7.6) ** 2 + ((y + 3) / 7.6) ** 2 <= 1 && y < -2, (x, y) => I(x < -3.5 && y > -9 ? '#dff9ff' : x > 3 ? '#3f9fc4' : y < -8.5 ? '#b9f0ff' : '#74d3ee'));
  put(b, -4, -8, '#ffffff'); put(b, -5, -7, '#ffffff'); put(b, -5, -6, '#ffffff');
  // a tiny pilot lamp inside the dome
  rect(b, -1, -6, 3, 3, I(PAL.MAG)); put(b, -1, -6, PAL.MAGL);
  // the disc: light on top, dark underneath, a steel rim line
  shape(b, -15, -5, 15, 5, (x, y) => (x / 14.6) ** 2 + (y / 4.7) ** 2 <= 1, (x, y) => I(y < -2.2 ? GR[5] : y < -0.6 ? GR[4] : y < 0.6 ? GR[3] : y < 2.4 ? GR[2] : GR[1]));
  for (let x = -14; x <= 14; x++) if (get(b, x, 1) !== NONE) put(b, x, 1, x > 6 ? MET : METD);
  // the eye lens (faces down and forward)
  oval(b, 1, 7, 4.2, 4.2, I(PAL.EYEW));
  shape(b, -4, 3, 6, 12, (x, y) => (x - 1) ** 2 + (y - 7) ** 2 <= 4.2 * 4.2 && (x - 1) * -0.35 + (y - 7) * 0.94 > 2.3, I(PAL.EYES));
  outline(b);
  return mk(b);
})();
M5.drone = (x, y, facing = -1, o = {}) => {
  const t = o.t ?? G.t, pose = o.pose || 'idle';
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
// a little four-point star (dizzy robots, sparkles)
function star(x, y, c = PAL.AMBL) { ctx.fillStyle = c; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); }
// three stars circling over a dizzy head
function dizzyStars(x, y, t, r = 8) {
  for (let k = 0; k < 3; k++) { const a = t / 7 + k * 2.094, sx = Math.round(x + Math.cos(a) * r), sy = Math.round(y + Math.sin(a) * 2.4); if (Math.sin(a) > -0.2 || k % 2) star(sx, sy, k === 1 ? '#ffffff' : PAL.AMBL); }
}
M5.roller = (x, y, facing = -1, o = {}) => {
  const t = o.t ?? G.t, pose = o.pose || 'idle', a = o.rot ?? t / 5;
  const look = o.look || lookAt(x, y - 10);
  const hop = o.hop != null ? -Math.round(o.hop) : pose === 'warn' ? (Math.floor(t / 3) % 2 ? -1 : 0) : 0;
  const dash = pose === 'dash', dizzy = pose === 'dizzy';
  if (hop < -2) { ctx.fillStyle = 'rgba(10,8,24,0.32)'; ctx.fillRect(Math.round(x) - 6, Math.round(y) - 1, 12, 2); ctx.fillRect(Math.round(x) - 4, Math.round(y) - 2, 8, 1); }   // its shadow while it is off the floor
  if (dash && !FLASH) {                                    // two ghosts behind it: speed
    ctx.save(); ctx.globalAlpha = 0.22; blit(ROLY, Math.round(x) - facing * 13, Math.round(y)); ctx.globalAlpha = 0.4; blit(ROLY, Math.round(x) - facing * 7, Math.round(y)); ctx.restore();
  }
  ctx.save(); ctx.translate(Math.round(x), Math.round(y) + hop); ctx.scale(facing, 1);
  blit(ROLY, 0, 0);
  for (let k = 0; k < 4; k++) {                            // rivets going round: the roll
    const th = a + k * Math.PI / 2, rx = Math.round(Math.cos(th) * 7), ry = Math.round(-9 + Math.sin(th) * 7);
    if ((rx - 2) ** 2 + (ry + 10) ** 2 < 42) continue;
    R(rx, ry, 2, 2, GR[0]); R(rx, ry, 1, 1, GR[6]);
  }
  liveEye(2, -10, 3.4, look[0] * facing, look[1], dizzy ? 'dizzy' : pose, t);
  if (pose === 'warn' || pose === 'aim' || dash) { R(0, -14, 5, 1, GR[2]); R(3, -13, 3, 1, GR[2]); R(0, -13, 3, 1, GR[0]); R(3, -12, 3, 1, GR[0]); }
  else if (pose === 'hit' || pose === 'skid') { R(-1, -13, 7, 3, GR[3]); R(-1, -10, 7, 1, GR[0]); R(-1, -13, 7, 1, GR[4]); }
  ctx.restore();
  if (pose === 'warn') {
    M5.bang(x, y - 26 + Math.min(0, hop + 1), t);
    for (let k = 0; k < 3; k++) { const u = (t / 9 + k / 3) % 1; ctx.fillStyle = k % 2 ? PAL.AMBL : '#ffffff'; ctx.fillRect(Math.round(x - facing * (9 + u * 9)), Math.round(y - 2 - u * 7 * (k + 1) / 2), 1, 1); }
  }
  if (dash && !FLASH) {                                    // speed lines streaming off its back
    for (let k = 0; k < 4; k++) {
      const u = ((t * 3 + k * 5) % 12) / 12, len = 5 + (k % 2) * 4;
      ctx.fillStyle = 'rgba(234,255,200,' + (0.85 - u * 0.6).toFixed(2) + ')';
      ctx.fillRect(Math.round(x - facing * (10 + u * 14) - (facing > 0 ? len : 0)), Math.round(y) - 3 - k * 4, len, 1);
    }
  }
  if (dizzy) dizzyStars(Math.round(x), Math.round(y) - 24, t);
};

// ---------------------------------------------------------------------------------------------------------------------
// The rescue: an abducted Galician cow (golden blond, cream muzzle, little horns, a bell) in a glass stasis pod
// ---------------------------------------------------------------------------------------------------------------------
// Three kinds (o.v): 0 the blond rubia galega, 1 a black-and-white one, 2 a blond calf.
const COWS = [
  { C: PAL.C, bx: 9, by: 5.6, bcy: -9, legs: [-7, -4, 3, 6], ly: -5, hx: 9, hy: -13, horns: true, bell: true, udder: true, tail: [-10, -11, -12, -6] },
  { C: ['#33364a', '#8c93ab', '#c7cddc', '#eceff6', '#ffffff'], bx: 9, by: 5.6, bcy: -9, legs: [-7, -4, 3, 6], ly: -5, hx: 9, hy: -13, horns: true, bell: true, udder: true, tail: [-10, -11, -12, -6], patch: true },
  { C: ['#7a5230', '#b9843c', '#e2ac58', '#f4cc80', '#fdeab8'], bx: 7, by: 4.8, bcy: -8, legs: [-5, -3, 2, 4], ly: -4, hx: 7, hy: -12, horns: false, bell: false, udder: false, tail: [-8, -10, -10, -6] }
];
const PATCH = ['#16161f', '#2b2b3b'];
// gait: 0 standing, 1 gallop (legs flung out), 2 gallop (legs gathered)
function bakeCow(float, v = 0, gait = 0, moo = false) {
  const V = COWS[v], C = V.C, b = buf(34, 28, 16, 23), hx = V.hx, hy = V.hy;
  // tail (flying when it gallops)
  if (gait === 1 || gait === 2) { line(b, V.tail[0], V.tail[1], V.tail[0] - 3, V.tail[1] - 2, I(C[1])); put(b, V.tail[0] - 4, V.tail[1] - 3, C[0]); put(b, V.tail[0] - 4, V.tail[1] - 2, C[0]); }
  else { line(b, V.tail[0], V.tail[1], V.tail[2], V.tail[3], I(C[1])); put(b, V.tail[2], V.tail[3] + 1, C[0]); put(b, V.tail[2] - 1, V.tail[3] + 2, C[0]); put(b, V.tail[2], V.tail[3] + 2, C[0]); }
  // legs (dangling a little apart when floating)
  const len = -V.ly;
  V.legs.forEach((x0, i) => {
    const far = i === 1 || i === 2, col = I(far ? C[1] : C[2]), out = i === 0 ? -1 : i === 3 ? 1 : 0;
    if (gait === 1 || gait === 2) {
      const dx = gait === 1 ? [-3, -2, 2, 3][i] : [2, 2, -2, -2][i], y1 = gait === 1 ? -2 : -3;
      line(b, x0 + 0.5, V.ly, x0 + dx + 0.5, y1, col, 2); rect(b, x0 + dx, y1 + 1, 2, 1, I(C[0]));
    }
    else if (float) { const lx = x0 + out; rect(b, lx, V.ly, 2, len - 1, col); rect(b, lx + out, -1, 2, 1, I(C[0])); }
    else { rect(b, x0, V.ly, 2, len, col); rect(b, x0, -1, 2, 1, I(C[0])); }
  });
  // body
  const inBody = (x, y) => (x / V.bx) ** 2 + ((y - V.bcy) / V.by) ** 2 <= 1;
  ball(b, 0, V.bcy, V.bx, V.by, [C[1], C[1], C[2], C[3], C[4]]);
  if (V.patch) shape(b, -V.bx, V.bcy - V.by, V.bx, V.bcy + V.by, (x, y) => inBody(x, y) && (((x + 5) / 3.7) ** 2 + ((y + 11) / 3.1) ** 2 <= 1 || ((x - 3) / 3.3) ** 2 + ((y + 7) / 2.8) ** 2 <= 1 || ((x + 0.5) / 2) ** 2 + ((y + 14.2) / 1.4) ** 2 <= 1), (x, y) => y < -11.5 ? PATCH[1] : PATCH[0]);
  if (V.udder) { rect(b, -3, -5, 5, 1, I(PAL.NOSE)); put(b, -1, -4, PAL.NOSE); }
  // head
  ball(b, hx, hy, 4.8, 4.4, [C[1], C[2], C[2], C[3], C[4]]);
  if (V.patch) shape(b, hx - 5, hy - 5, hx + 1, hy + 2, (x, y) => ((x - hx) / 4.8) ** 2 + ((y - hy) / 4.4) ** 2 <= 1 && ((x - hx + 3.6) / 2.3) ** 2 + ((y - hy + 2.4) / 2.6) ** 2 <= 1, (x, y) => y < hy - 3 ? PATCH[1] : PATCH[0]);
  if (V.horns) { rect(b, hx - 4, hy - 5, 1, 2, I(PAL.CREAM)); rect(b, hx + 2, hy - 5, 1, 2, I(PAL.CREAM)); }
  const ear = V.patch ? PATCH : [C[0], C[1]];
  put(b, hx - 5, hy - 2, ear[1]); put(b, hx - 6, hy - 2, ear[1]); put(b, hx - 6, hy - 1, ear[0]);            // ear
  oval(b, hx + 2.5, hy + 2.5, 2.9, 2.2, I(PAL.CREAM));                                                         // muzzle
  put(b, hx + 2, hy + 2, PAL.NOSE); put(b, hx + 4, hy + 2, PAL.NOSE);
  if (moo) { rect(b, hx + 2, hy + 4, 3, 2, I('#7a2038')); put(b, hx + 3, hy + 5, PAL.NOSE); }                  // mouth open: MOO!
  put(b, hx - 1, hy - 1, '#ffffff'); put(b, hx, hy - 1, OUTI); put(b, hx + 3, hy - 1, OUTI);                   // eyes
  // collar + bell
  rect(b, hx - 4, hy + 3, 1, 4, I('#d0302a'));
  if (V.bell) { rect(b, hx - 4, hy + 7, 2, 2, I(PAL.AMB)); put(b, hx - 4, hy + 7, PAL.AMBL); }
  outline(b);
  return mk(b);
}
const COW = COWS.map((V, v) => ({ stand: bakeCow(false, v), float: bakeCow(true, v), run: [bakeCow(false, v, 1), bakeCow(false, v, 2)], happy: bakeCow(false, v, 1, true), moo: bakeCow(false, v, 0, true) }));
M5.cow = (x, y, facing = 1, o = {}) => {
  const S = COW[o.v === 1 || o.v === 2 ? o.v : 0];
  const s = o.float ? S.float : o.pose === 'happy' ? S.happy : o.pose === 'leap' ? S.run[0] : o.run != null ? S.run[Math.floor(o.run / 5) % 2] : o.moo ? S.moo : S.stand;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(facing, 1);
  blit(s, 0, 0);
  ctx.restore();
};
// the pod: steel base with hazard stripes, glass tube, steel cap with a lamp. (x, y) = floor point. 34 wide, 50 tall.
// o.broken (frames since the glass popped): the cap and the tube are gone, stumps of glass stand on the base.
M5.pod = (x, y, o = {}) => {
  const t = o.t ?? G.t;
  x = Math.round(x); y = Math.round(y);
  ctx.save(); ctx.translate(x, y);
  if (o.broken != null && o.broken !== false) {
    const a = o.broken === true ? 999 : o.broken;
    // the back wall's stumps, then the base, then the front stumps
    ctx.fillStyle = 'rgba(120,214,232,0.30)'; ctx.fillRect(-15, -13, 5, 7); ctx.fillRect(-10, -10, 4, 4); ctx.fillRect(6, -9, 4, 3); ctx.fillRect(10, -15, 5, 9);
    ctx.fillStyle = 'rgba(200,247,255,0.55)';
    for (const [sx, top] of [[-15, -17], [-14, -15], [-13, -16], [-12, -12], [-11, -13], [-10, -10], [-9, -11], [-8, -8], [8, -8], [9, -10], [10, -9], [11, -13], [12, -12], [13, -18], [14, -16]]) ctx.fillRect(sx, top, 1, -6 - top);
    ctx.fillStyle = '#ffffff'; for (const [sx, top] of [[-15, -17], [-13, -16], [-11, -13], [9, -10], [11, -13], [13, -18]]) ctx.fillRect(sx, top, 1, 2);
    R(-16, -16, 1, 10, OUT); R(15, -17, 1, 11, OUT);
    if (a < 70) {                                            // the field fizzles out: sparks off the emitter
      for (let k = 0; k < 5; k++) { const u = ((a + k * 9) % 24) / 24; if (a + k * 9 > 70) continue; ctx.fillStyle = k % 2 ? PAL.BEAML : PAL.BEAM; ctx.fillRect(Math.round(-10 + hsh(k * 5.3 + Math.floor((a + k * 9) / 24)) * 20), Math.round(-8 - u * 16), 1, 1 + (k & 1)); }
      if (!FLASH) M5.glow(0, -8, 12, PAL.BEAM, 0.3 * (1 - a / 70));
    }
    RO(-17, -6, 34, 6, METD); R(-17, -6, 34, 1, METL);
    for (let i = 0; i < 8; i++) { R(-16 + i * 4, -4, 2, 3, PAL.AMB); R(-14 + i * 4, -4, 2, 3, '#22222c'); }
    R(-17, -1, 34, 1, METDD);
    R(-4, -7, 8, 1, a < 70 && Math.floor(a / 4) % 2 ? PAL.BEAML : PAL.G[1]);      // the emitter strip, flickering off
    ctx.restore();
    return;
  }
  // back of the tube
  ctx.fillStyle = 'rgba(24,70,66,0.50)'; ctx.fillRect(-15, -42, 30, 36);
  ctx.fillStyle = 'rgba(157,255,74,0.20)'; ctx.fillRect(-15, -42, 30, 36);
  ctx.fillStyle = 'rgba(234,255,200,0.16)'; ctx.fillRect(-15, -42, 30, 2); ctx.fillRect(-15, -9, 30, 3);
  for (let k = 0; k < 6; k++) {                            // bubbles rising in the green field
    const u = (t / 90 + hsh(k * 7.3 + (o.id || 0))) % 1;
    ctx.fillStyle = 'rgba(234,255,200,0.75)'; ctx.fillRect(Math.round(-13 + hsh(k * 3.1) * 25 + Math.sin(t / 13 + k) * 1.5), Math.round(-8 - u * 32), 1, 1);
  }
  if (!o.empty) M5.cow(2 * (o.facing || -1), -15 + Math.round(Math.sin(t / 17 + (o.id || 0)) * 1.5), o.facing || -1, { float: true, v: o.v });
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
// EYE FLOWER (STAR GARDEN): a turret on a steel stalk. Shut it is an armoured bud; the bloom snaps open to show the eye
// before it spits a seed. Sprites face right, origin = the bolt plate on the deck. (The look of the proposal's garden.)
// ---------------------------------------------------------------------------------------------------------------------
function flowerBase(b) {
  rect(b, -8, -4, 16, 4, METD); rect(b, -8, -4, 16, 1, METL); rect(b, -8, -1, 16, 1, METDD);
  for (let i = 0; i < 4; i++) { rect(b, -7 + i * 4, -3, 2, 2, PAL.AMB); rect(b, -5 + i * 4, -3, 2, 2, '#22222c'); }
  rect(b, -3, -7, 6, 3, MET); rect(b, -3, -7, 6, 1, METL); rect(b, -3, -5, 6, 1, METD);
}
function flowerStalk(b, hx, hy, sway, y0 = -7) {
  const n = y0 - hy;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = Math.round(Math.sin(t * Math.PI * 1.5) * sway + hx * t * t), y = y0 - i, j = i % 5 === 4;
    put(b, x - 1, y, j ? METDD : METD); put(b, x, y, j ? METD : MET); put(b, x + 1, y, j ? MET : METL);
  }
}
function leafPlate(b, ax, ay, d, droop = 0) {
  const pts = [[ax, ay], [ax + d * 4, ay - 4 + droop], [ax + d * 10, ay - 5 + droop * 2], [ax + d * 13, ay - 2 + droop * 3], [ax + d * 8, ay + 1 + droop * 2], [ax + d * 3, ay + 2]];
  poly(b, pts, (x, y) => (y - ay) - (x - ax) * d * (-0.2 + droop * 0.2) < -1.5 ? GR[4] : GR[2]);
  line(b, ax + d, ay - 1, ax + d * 12, ay - 3 + droop * 3, GR[1]);
  put(b, ax + d * 6, ay - 4 + droop, GR[5]); put(b, ax + d * 7, ay - 4 + droop, GR[5]);
}
function petal(b, hx, hy, a, dist, rl, rw) {
  const ca = Math.cos(a), sa = Math.sin(a), cx = hx + ca * dist, cy = hy + sa * dist;
  shape(b, cx - rl - 1, cy - rl - 1, cx + rl + 1, cy + rl + 1, (x, y) => { const u = (x - cx) * ca + (y - cy) * sa, v = -(x - cx) * sa + (y - cy) * ca; return (u / rl) ** 2 + (v / rw) ** 2 <= 1; },
    (x, y) => {
      const u = ((x - cx) * ca + (y - cy) * sa) / rl, v = (-(x - cx) * sa + (y - cy) * ca) / rw, l = (x - cx) / rl * 0.45 + (y - cy) / rl * -0.85;
      if (u * u + v * v > 0.62) return l > 0 ? GR[3] : GR[1];
      if (Math.abs(v) < 0.16 && u > -0.3 && u < 0.55) return GR[2];
      return u < -0.5 ? GR[1] : l > 0.3 ? GR[5] : l > -0.2 ? GR[4] : GR[3];
    });
}
const FLOWER_HEAD = M5.FLOWER_HEAD = { x: 3, y: -33 };       // the open bloom's eye, from the base (x * facing)
// k = how far open: 0 the shut bud, 1 the full bloom, between: the petals unfolding round a small eye
function paintFlower(k) {
  const b = buf(46, 64, 22, 60);
  if (k <= 0) {
    flowerBase(b); flowerStalk(b, -1, -24, 1.5);
    leafPlate(b, -1, -12, -1, 0.8); leafPlate(b, 1, -15, 1, 0.8);
    const cx = -1, cy = -30;
    ball(b, cx, cy, 5.8, 7.4, GB);
    for (let y = -37; y <= -23; y++) { const q = (y + 30) / 7.4, w = Math.sqrt(Math.max(0, 1 - q * q)); put(b, cx + Math.round(w * 2.2) - 1, y, GR[1]); put(b, cx - Math.round(w * 3.4), y, GR[1]); }
    rect(b, cx - 1, cy - 9, 2, 2, GR[3]); put(b, cx, cy - 10, GR[2]);
    rect(b, cx - 4, cy + 6, 8, 2, GR[1]); rect(b, cx - 3, cy + 6, 6, 1, GR[2]);
    outline(b);
    return { s: mk(b), hx: cx, hy: cy };
  }
  const hx = Math.round(lerp(-1, FLOWER_HEAD.x, k)), hy = Math.round(lerp(-30, FLOWER_HEAD.y, k));
  flowerBase(b); flowerStalk(b, hx, hy, lerp(1.5, -2.5, k));
  leafPlate(b, -1, Math.round(lerp(-12, -10, k)), -1, lerp(0.8, 0.5, k)); leafPlate(b, k < 1 ? 1 : 0, Math.round(lerp(-15, -13, k)), 1, lerp(0.8, 0.3, k));
  for (const a of [60, 120, 0, 180, 240, 300]) petal(b, hx, hy, a * Math.PI / 180, 9.4 * (0.25 + 0.75 * k), 5.6 * (0.55 + 0.45 * k), 3.9 * (0.7 + 0.3 * k));
  bakeEye(b, hx, hy, k < 0.6 ? 3 : 4.6);
  outline(b);
  return { s: mk(b), hx, hy, r: k < 0.6 ? 3 : 4.6 };
}
const FLOWER = [paintFlower(0), paintFlower(0.4), paintFlower(0.72), paintFlower(1)];
// (x, y) = the base on the deck; o.pose 'shut' | 'open' | 'warn' | 'spit' | 'hit'; o.k 0..1 (how far the bloom is open:
// give it while it opens or shuts); o.look; o.t; o.shake (px: a shot clanked off the bud); o.z false = no Z's
M5.flower = (x, y, facing = -1, o = {}) => {
  const t = o.t ?? G.t, pose = o.pose || 'open';
  const k = o.k != null ? clamp(o.k, 0, 1) : pose === 'shut' ? 0 : 1;
  const F = k < 0.2 ? FLOWER[0] : k < 0.55 ? FLOWER[1] : k < 0.9 ? FLOWER[2] : FLOWER[3];
  const sx = Math.round(x) + (o.shake ? (Math.floor(t / 2) % 2 ? 1 : -1) * Math.sign(o.shake) : 0), sy = Math.round(y);
  ctx.save(); ctx.translate(sx, sy); ctx.scale(facing, 1);
  if (F === FLOWER[0]) {
    R(-1, -44, 1, 4, OUT); RO(-2, -47, 3, 3, '#8a6a12'); R(-2, -47, 1, 1, PAL.AMB);
    blit(F.s, 0, 0);
    ctx.restore();
    if (pose === 'shut' && k <= 0 && o.z !== false && !FLASH) {           // asleep: little z's
      const q = Math.floor(t / 22) % 3;
      text('Z', sx + facing * 6 - (facing < 0 ? 5 : 0), sy - 50 - q * 2, '#c8f7ff', 1, 'left', '#0e0c1e');
      if (q) R(sx + facing * 6 + (facing < 0 ? -9 : 7), sy - 58 - q, 3, 1, '#c8f7ff');
    }
    return;
  }
  const warn = pose === 'warn', full = F === FLOWER[3];
  const jit = warn ? (Math.floor(t / 3) % 2 ? 1 : 0) : 0, rx = pose === 'spit' ? -2 : pose === 'hit' ? -1 : 0, ry = pose === 'spit' ? 1 : 0;
  const hx = F.hx, hy = F.hy;
  // antenna: a springy stalk with the lamp
  const sway = warn ? (Math.floor(t / 3) % 2 ? 1 : -1) : Math.round(Math.sin(t / 14));
  if (full) {
    R(hx + rx, hy - 15 + ry, 1, 4, OUT); R(hx + rx + (sway > 0 ? 1 : sway < 0 ? -1 : 0), hy - 18 + ry, 1, 3, OUT);
    const lamp = warn ? (Math.floor(t / 4) % 2 ? '#ffffff' : PAL.IRIS) : pose === 'spit' ? '#ffffff' : PAL.AMB;
    RO(hx + rx + sway - 1, hy - 21 + ry, 3, 3, lamp); R(hx + rx + sway - 1, hy - 21 + ry, 1, 1, '#ffffff');
  }
  blit(F.s, rx, ry - jit);
  const look = o.look || lookAt(x + facing * hx, y + hy);
  liveEye(hx + rx, hy + ry - jit, F.r, look[0] * facing, look[1], warn ? 'warn' : pose === 'spit' ? 'shoot' : '', t);
  if (full) {
    const ex = hx + rx, ey = hy + ry - jit;
    if (warn || pose === 'spit') { R(ex - 4, ey - 5, 7, 1, GR[2]); R(ex - 2, ey - 4, 6, 1, GR[2]); R(ex + 1, ey - 3, 3, 1, GR[2]); R(ex - 2, ey - 3, 3, 1, GR[0]); R(ex + 1, ey - 2, 3, 1, GR[0]); R(ex - 5, ey - 4, 3, 1, GR[0]); }
    else if (pose === 'hit') { R(ex - 4, ey - 4, 9, 4, GR[3]); R(ex - 4, ey, 9, 1, GR[0]); R(ex - 4, ey - 4, 9, 1, GR[4]); }
    else if (Math.floor(t / 6) % 34 === 3) { R(ex - 4, ey - 4, 9, 7, GR[3]); R(ex - 4, ey + 2, 9, 1, GR[0]); }      // blink
  }
  ctx.restore();
  if (warn && !FLASH) { M5.glow(sx + facing * hx, sy + hy, 9, PAL.WARN, 0.28); M5.bang(sx + facing * hx + 1, sy + hy - 30, t); }
  if (pose === 'spit' && !FLASH) M5.glow(sx + facing * (hx + 4), sy + hy, 10, PAL.BEAML, 0.7);
};

// ---------------------------------------------------------------------------------------------------------------------
// Shots: the ray-gun ring (green; the hero's captured RAY GUN can ask for other colours) and the eye flower's seed
// ---------------------------------------------------------------------------------------------------------------------
const RINGS = {};
function ringSprites(c1, c2) {
  const key = c1 + c2;
  if (RINGS[key]) return RINGS[key];
  return RINGS[key] = [0, 1].map(s => {
    const b = buf(14, 20, 7, 10), rx = 3.6, ry = 5.4 + s;
    shape(b, -5, -8, 5, 8, (x, y) => (x / rx) ** 2 + (y / ry) ** 2 <= 1 && (x / (rx - 2.1)) ** 2 + (y / (ry - 2.2)) ** 2 > 1, (x, y) => x < -0.5 && y < 2 ? c2 : c1);
    outline(b);
    return mk(trim(b));
  });
}
// (x, y) = its middle; o.dir = which way it flies (-1 / 1), o.t the clock, o.c1 / o.c2 its two tones, o.glow false = none
M5.ring = (x, y, o = {}) => {
  const t = o.t ?? G.t, c1 = o.c1 || PAL.BEAM, c2 = o.c2 || PAL.BEAML, S = ringSprites(c1, c2), dir = o.dir || 1;
  x = Math.round(x); y = Math.round(y);
  if (o.glow !== false) M5.glow(x, y, 10, c1, 0.45);
  const v = hex(c1);
  ctx.fillStyle = 'rgba(' + v + ',0.55)'; ctx.fillRect(x - dir * 8 - (dir > 0 ? 3 : 0), y - 3, 4, 1); ctx.fillRect(x - dir * 10 - (dir > 0 ? 5 : 0), y + 2, 6, 1);
  ctx.fillStyle = 'rgba(' + v + ',0.3)'; ctx.fillRect(x - dir * 14 - (dir > 0 ? 3 : 0), y - 1, 4, 1);
  blit(S[Math.floor(t / 5) % 2], x, y);
};
// the seed: a little green pod with an eye of its own and two leaf fins, tumbling as it flies
const SEED = [0, 1, 2, 3].map(k => {
  const b = buf(17, 17, 8, 8), a = k * Math.PI / 2, c = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a));
  for (const s of [-1, 1]) {                                                       // the fins, behind
    const px = -c * 4 - sn * s * 3, py = -sn * 4 + c * s * 3;
    line(b, -c * 3, -sn * 3, px, py, GR[4]); put(b, px - c, py - sn, GR[5]); put(b, px - c * 2, py - sn * 2, GR[6]);
  }
  ball(b, 0, 0, 4.2, 4.2, GB);
  rect(b, c - 1, sn - 1, 3, 3, PAL.EYEW); put(b, c * 2, sn * 2, PAL.IRIS); put(b, c, sn, PAL.IRIS);   // its eye looks where it turns
  outline(b);
  return mk(b);
});
M5.seed = (x, y, t = G.t) => { M5.glow(x, y, 9, PAL.BEAM, 0.45); blit(SEED[Math.floor(t / 5) % 4], x, y); };

// ---------------------------------------------------------------------------------------------------------------------
// Burst pieces: when a robot is beaten it flies apart into plates and bolts, and its eye pops out on a spring
// ---------------------------------------------------------------------------------------------------------------------
const jag = x => [0, -1, -2, -1, 0, 1, 2, 1][((Math.floor(x) + 40) % 8)];
const BITS = M5.bits = (() => {
  const fin = (b, a) => { const d = a ? rotBuf(b, a) : b; outline(d); return mk(trim(d)); };
  // curved shell plates and a flat one
  const pa = buf(16, 12, 8, 6);
  shape(pa, -7, -5, 7, 5, (x, y) => (x / 6.5) ** 2 + ((y - 3) / 7) ** 2 <= 1 && y < 1.5 && x < 3 + y, (x, y) => { const q = (x / 6.5) ** 2 + ((y - 3) / 7) ** 2; return q > 0.74 ? GR[5] : y > 0 ? GR[1] : x > -1 ? GR[4] : GR[3]; });
  put(pa, -2, -1, GR[6]); put(pa, -2, 0, GR[1]);
  const pb = buf(12, 8, 6, 4); rect(pb, -4, -2, 8, 4, GR[3]); rect(pb, -4, -2, 8, 1, GR[5]); rect(pb, -4, 1, 8, 1, GR[1]); put(pb, -2, 0, GR[6]); put(pb, 2, -1, GR[2]);
  const pc = buf(12, 10, 6, 5); poly(pc, [[-4, -3], [3, -4], [5, 0], [2, 4], [-3, 3], [-5, 0]], (x, y) => y < -1.5 ? GR[5] : y < 1.5 ? GR[3] : GR[2]); put(pc, 0, 0, GR[6]); put(pc, 1, 1, GR[1]);
  // the top of an oggle's shell: the empty eye socket, antenna and lamp still on it (it was facing right)
  const cap = buf(30, 28, 14, 23);
  ball(cap, 0, 0, 10.2, 11, GB, (x, y) => y < -0.5 + jag(x + 3) * 0.5);
  shape(cap, -5, -10, 9, 2, (x, y) => (x - 2) ** 2 + (y + 3) ** 2 <= 6.4 ** 2 && get(cap, x, y) !== NONE, (x, y) => (x - 2) ** 2 + (y + 3) ** 2 > 4.9 ** 2 ? METD : GR[0]);
  put(cap, -6, -6, GR[5]); put(cap, -7, -3, GR[5]);
  rect(cap, -4, -14, 1, 4, OUTI); rect(cap, -5, -16, 1, 3, OUTI); rect(cap, -6, -19, 3, 3, PAL.AMB); put(cap, -6, -19, PAL.AMBL);
  // the lower half of the shell, cracked open along a zig-zag, belt and buckle still on: it sits on the deck
  const low = buf(28, 20, 14, 19);
  ball(low, 0, -11, 10.2, 11, GB, (x, y) => y > -13.5 + jag(x));
  shape(low, -10, -16, 10, -9, (x, y) => get(low, x, y) !== NONE && y < -11.5 + jag(x) && Math.abs(x) < 8.6, GR[0]);          // the dark inside, behind the rim
  for (let x = -11; x <= 11; x++) { if (get(low, x, -4) !== NONE) put(low, x, -4, x > 3 ? METL : MET); if (get(low, x, -3) !== NONE) put(low, x, -3, METD); }
  put(low, 4, -4, PAL.AMBL); put(low, 5, -4, PAL.AMB); put(low, 4, -3, PAL.AMB); put(low, 5, -3, '#c98a16');
  outline(low);
  // a roly eye's lower half (a bowl) and the cap that flew off it
  const bowl = buf(24, 14, 12, 13);
  ball(bowl, 0, -9, 9.2, 9.2, GB, (x, y) => y > -8.5 + jag(x + 2));
  shape(bowl, -8, -10, 8, -6, (x, y) => get(bowl, x, y) !== NONE && y < -6.5 + jag(x + 2) + 2 && Math.abs(x) < 7.4, GR[0]);
  outline(bowl);
  const rcap = buf(24, 14, 12, 12);
  ball(rcap, 0, 0, 9.2, 9.2, GB, (x, y) => y < -1.5 + jag(x + 2) * 0.6);
  put(rcap, -4, -6, GR[6]); put(rcap, 3, -7, GR[0]); put(rcap, 4, -7, GR[0]);
  // a boot, the ray gun, the back tank, the antenna lamp, a bolt, a nut
  const boot = buf(10, 10, 5, 5); rect(boot, -3, -1, 6, 4, METD); rect(boot, -3, -1, 6, 1, MET); put(boot, 2, 1, METL); rect(boot, -1, -3, 3, 2, GR[1]);
  const gun = buf(20, 10, 10, 5);
  rect(gun, -7, -2, 7, 5, '#c9d2e0'); rect(gun, -7, -2, 7, 1, '#ffffff'); rect(gun, -7, 2, 7, 1, '#8794a8'); rect(gun, -6, 3, 2, 2, METD);
  rect(gun, 0, -1, 1, 3, PAL.MAG); rect(gun, 1, 0, 2, 1, '#c9d2e0'); rect(gun, 3, -1, 1, 3, PAL.MAG); rect(gun, 5, -1, 2, 3, PAL.BEAM);
  const tank = buf(16, 10, 8, 5);
  rect(tank, -5, -2, 11, 5, METD); rect(tank, -5, -2, 11, 1, METL); rect(tank, -5, 2, 11, 1, METDD); rect(tank, 0, -2, 1, 5, METDD); rect(tank, -7, -1, 2, 3, MET); rect(tank, 6, -1, 1, 3, METDD);
  const lamp = buf(10, 12, 5, 6); rect(lamp, -1, -4, 3, 3, PAL.AMB); put(lamp, -1, -4, '#ffffff'); rect(lamp, 0, -1, 1, 5, OUTI);
  const bolt = buf(6, 6, 3, 3); rect(bolt, -1, -1, 3, 3, MET); put(bolt, -1, -1, METL); put(bolt, 1, 1, METDD);
  const nut = buf(8, 8, 4, 4); rect(nut, -2, -1, 4, 3, METD); rect(nut, -1, -2, 2, 5, METD); put(nut, -1, -1, METL); put(nut, 0, 0, OUTI);
  // the eye that pops out (an oggle's, and a roly eye's smaller one): the iris is drawn live on top
  const eye = buf(20, 20, 10, 10);
  ball(eye, 0, 0, 7.4, 7.4, BEZ); oval(eye, 0, 0, 5.2, 5.2, PAL.EYEW);
  shape(eye, -6, -6, 6, 6, (x, y) => x * x + y * y <= 5.2 * 5.2 && x * -0.35 + y * 0.94 > 2.8, PAL.EYES);
  const eyeS = buf(16, 16, 8, 8);
  ball(eyeS, 0, 0, 5.4, 5.4, BEZ); oval(eyeS, 0, 0, 3.4, 3.4, PAL.EYEW);
  shape(eyeS, -4, -4, 4, 4, (x, y) => x * x + y * y <= 3.4 * 3.4 && x * -0.35 + y * 0.94 > 1.8, PAL.EYES);
  // the eye flower: a petal, a leaf plate, and the stump of the stalk on its bolt plate
  const pet = buf(20, 14, 10, 7); petal(pet, -5, 0, 0, 5, 5.6, 3.9);
  const leaf = buf(18, 12, 2, 8); leafPlate(leaf, 0, 0, 1, 0.3);
  const stump = buf(24, 20, 12, 18); flowerBase(stump); flowerStalk(stump, 0, -15, 1.2); outline(stump);
  // broken glass (a helmet, a pod, a saucer's dome) and a pod's steel cap
  const glass = pts => { const g = buf(12, 12, 6, 6); poly(g, pts, (x, y) => x + y < -1 ? '#ffffff' : x + y < 2 ? '#c8f7ff' : '#74d3ee'); return g; };
  const podcap = buf(36, 12, 18, 8);
  rect(podcap, -16, -3, 32, 5, METD); rect(podcap, -16, -3, 32, 1, METL); rect(podcap, -16, 1, 32, 1, METDD); rect(podcap, -3, -6, 6, 3, MET); rect(podcap, -1, -5, 2, 1, PAL.G[2]);
  return {
    plateA: fin(pa, 0.5), plateB: fin(pb, -0.6), plateC: fin(pc, 0), cap: fin(cap, 0), low: mk(trim(low)), bowl: mk(trim(bowl)), rcap: fin(rcap, 0),
    boot: fin(boot, 0.9), gun: fin(gun, -0.7), tank: fin(tank, 0.3), lamp: fin(lamp, 0.8), bolt: fin(bolt, 0), nut: fin(nut, 0),
    eye: fin(eye, 0), eyeS: fin(eyeS, 0), petal: fin(pet, 0), leaf: fin(leaf, 0), stump: mk(trim(stump)),
    glassA: fin(glass([[-4, -3], [3, -4], [1, 4]]), 0), glassB: fin(glass([[-3, -4], [4, 0], [-2, 3]]), 0), glassC: fin(glass([[-2, -2], [2, -1], [0, 3]]), 0), podcap: fin(podcap, 0)
  };
})();
// Throw a beaten robot's pieces into G.parts (the engine's 'sprite' particles: they tumble, bounce on the deck and fade).
// (x, y) = its feet, facing = the way it looked. kind 'oggle' | 'roller' | 'flower' | 'saucer' | 'pod'. o.helmet: an
// oggle's glass bubble breaks too. Out on the hull (L5.lowG) the pieces fly higher and fall slowly.
// It calls rand(): UPDATE code only (onKill, onFree, a thrown robot landing), never a draw.
M5.burst = (kind, x, y, facing = 1, o = {}) => {
  const low = typeof L5 !== 'undefined' && L5.lowG && L5.lowG(x), g = low ? 0.12 : 0.22, f = facing || 1;
  if (G.parts.length > 620) return;
  const fly = (s, lx, ly, vx, vy, vr, life = 72) => G.parts.push({ type: 'sprite', s, x: x + lx * f, y: y + ly, vx: (vx + rand(-0.35, 0.35)) * f, vy: (vy + rand(-0.5, 0.3)) * (low ? 0.85 : 1), g, rot: rand(0, 6.28), vr: (vr + rand(-0.08, 0.08)) * f, life: life + (low ? 30 : 0), max: life + (low ? 30 : 0) });
  const bolts = (n, ly) => { for (let i = 0; i < n; i++) fly(i % 2 ? BITS.nut : BITS.bolt, rand(-6, 6), ly, rand(-2.4, 2.4), rand(-4.2, -2), rand(-0.4, 0.4), 60); };
  const shards = (n, ly) => { for (let i = 0; i < n; i++) fly([BITS.glassA, BITS.glassB, BITS.glassC][i % 3], rand(-10, 10), ly + rand(-8, 6), rand(-2.6, 2.6), rand(-3.6, -1), rand(-0.5, 0.5), 54); };
  if (kind === 'oggle') {
    fly(BITS.cap, 0, -26, -0.9, -4.6, -0.22, 84); fly(BITS.plateA, -7, -18, -2.1, -3.4, -0.3); fly(BITS.plateC, 8, -16, 1.9, -3.8, 0.34);
    fly(BITS.boot, -5, -3, -1.5, -2.6, -0.4); fly(BITS.boot, 5, -3, 1.3, -3, 0.4); fly(BITS.gun, 15, -13, 2.7, -3.2, 0.3, 80); fly(BITS.tank, -12, -16, -2.6, -2.4, -0.25);
    bolts(3, -14);
    if (o.helmet) shards(6, -22);
  } else if (kind === 'roller') {
    fly(BITS.rcap, 0, -14, -0.6, -4.4, -0.3, 80); fly(BITS.plateB, -5, -10, -2.2, -3, -0.35); fly(BITS.plateC, 6, -9, 2, -3.4, 0.3);
    bolts(3, -9);
  } else if (kind === 'flower') {
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.5; fly(BITS.petal, FLOWER_HEAD.x + Math.cos(a) * 8, FLOWER_HEAD.y + Math.sin(a) * 8, Math.cos(a) * 2.4, Math.sin(a) * 2.2 - 2.2, i % 2 ? 0.3 : -0.3, 76); }
    fly(BITS.leaf, -8, -13, -1.8, -2.4, -0.2); fly(BITS.leaf, 8, -15, 1.8, -2.8, 0.2); fly(BITS.lamp, 3, -52, 0.4, -4, 0.3);
    bolts(2, -20);
  } else if (kind === 'saucer') {
    fly(BITS.plateA, -9, 0, -2.2, -3.2, -0.3); fly(BITS.plateA, 9, -1, 2.2, -3.4, 0.3); fly(BITS.plateB, 0, 3, 0.3, -2.4, 0.4); fly(BITS.lamp, 0, -14, 0.2, -4.2, 0.3);
    shards(4, -6); bolts(3, 0);
  } else if (kind === 'pod') {
    fly(BITS.podcap, 0, -45, 0.5, -4.4, 0.13, 90);
    shards(10, -24);
    for (let i = 0; i < 8; i++) G.parts.push({ type: 'spark', x: x + rand(-14, 14), y: y - rand(8, 40), vx: rand(-1.6, 1.6), vy: rand(-2.4, 0.4), g: 0.1, life: rand(14, 30), max: 30, size: i % 3 ? 1 : 2, c: i % 2 ? PAL.BEAML : PAL.BEAM });
  }
};
// What is left standing where a robot burst: the cracked lower shell and its eye boinging on a spring (looking dizzy).
// (x, y) = where its feet were; o.kind 'oggle' | 'roller' | 'flower'; o.a = frames since the burst (drives everything).
M5.wreck = (x, y, facing = 1, o = {}) => {
  const a = o.a || 0, kind = o.kind || 'oggle', t = o.t ?? G.t;
  const base = kind === 'roller' ? BITS.bowl : kind === 'flower' ? BITS.stump : BITS.low, small = kind === 'roller';
  const ay = kind === 'roller' ? -5 : kind === 'flower' ? -15 : -7, L = kind === 'flower' ? 11 : small ? 12 : 15;
  // the pop: the spring shoots out past its length, then rings down; the eye sways from side to side on it
  const ext = a < 4 ? a / 4 * 1.45 : 1 + 0.45 * Math.exp(-(a - 4) / 13) * Math.cos((a - 4) * 0.5);
  const len = Math.max(2, L * ext), wob = Math.sin(a * 0.3) * 5 * Math.exp(-a / 40);
  x = Math.round(x); y = Math.round(y);
  ctx.save(); ctx.translate(x, y); ctx.scale(facing, 1);
  if (kind === 'flower') blit(base, 0, 0);
  const n = Math.max(3, Math.round(len));
  for (let i = 0; i <= n; i++) {                           // the spring: six coils that open out as it stretches
    const u = i / n, z = Math.floor(u * 11.99) % 2, sx = Math.round(wob * u * u) + (z ? -2 : 0), sy = Math.round(ay - len * u);
    R(sx - 1, sy, 5, 1, OUT);
  }
  for (let i = 0; i <= n; i++) {
    const u = i / n, z = Math.floor(u * 11.99) % 2, sx = Math.round(wob * u * u) + (z ? -2 : 0), sy = Math.round(ay - len * u);
    R(sx, sy, 3, 1, z ? MET : METL); R(sx + (z ? 0 : 2), sy, 1, 1, z ? METD : '#ffffff');
  }
  if (kind !== 'flower') blit(base, 0, 0);
  const ex = Math.round(wob), ey = Math.round(ay - len) - (small ? 4 : 6), S = small ? BITS.eyeS : BITS.eye;
  blit(S, ex, ey);
  liveEye(ex, ey, small ? 3.4 : 5.2, 0, 0, 'dizzy', t);
  ctx.restore();
  if (a > 14 && !FLASH) dizzyStars(x + facing * ex, y + ey - (small ? 9 : 11), t, small ? 7 : 9);
};
// A robot the MINI UFO's beam has grabbed: dangling (rot 0: it kicks and looks about) or tumbling (rot in radians, drawn
// in 8 crisp steps). (x, y) = its middle. kind 'oggle' | 'roller'; o.helmet.
let CARGO = null;
const bakeCargo = () => {
  const turn = b => { const out = []; for (let i = 0; i < 8; i++) { const d = rotBuf(b, i * Math.PI / 4); outline(d); out.push(mk(trim(d))); } return out; };
  const og = k => {
    const b = buf(60, 60, 30, 30), oy = 15;                // origin = the middle of the egg
    for (const [bx, drop] of [[-8, k ? 1 : 3], [2, k ? 3 : 1]]) { rect(b, bx, oy - 4 + drop, 6, 4, METD); rect(b, bx, oy - 4 + drop, 6, 1, MET); rect(b, bx + 2, oy - 6, 3, 2 + drop, GR[1]); }
    rect(b, -4, oy - 29, 1, 4, OUTI); rect(b, -5, oy - 32, 1, 3, OUTI); rect(b, -6, oy - 35, 3, 3, PAL.AMB); put(b, -6, oy - 35, '#ffffff');
    stamp(b, unline(OGGB), 0, oy);
    rect(b, 1, oy - 19, 3, 3, PAL.IRIS); put(b, 2, oy - 18, PAL.PUP);                 // a small iris looking up: wide-eyed
    stamp(b, rotBuf(GUNB, 1.25), 5, oy - 13); stamp(b, rotBuf(ARMB, 1.25), 5, oy - 13);   // the gun hanging from its hand
    return turn(b);
  };
  const ro = () => {
    const b = buf(30, 30, 15, 15);
    ball(b, 0, 0, 9.2, 9.2, GB); bakeEye(b, 2, -1, 3.4);
    rect(b, 1, -3, 3, 3, PAL.IRIS); put(b, 2, -2, PAL.PUP);
    for (let k = 0; k < 4; k++) { const th = 0.6 + k * Math.PI / 2, rx = Math.round(Math.cos(th) * 7), ry = Math.round(Math.sin(th) * 7); if ((rx - 2) ** 2 + (ry + 1) ** 2 < 42) continue; rect(b, rx, ry, 2, 2, GR[0]); put(b, rx, ry, GR[6]); }
    return turn(b);
  };
  return { oggle: [og(0), og(1)], roller: [ro()] };
};
M5.cargo = (kind, x, y, t = G.t, rot = 0, o = {}) => {
  if (!CARGO) CARGO = bakeCargo();                         // baked at the first grab (40 sprites)
  const set = CARGO[kind] || CARGO.roller, i = ((Math.round(rot / (Math.PI / 4)) % 8) + 8) % 8;
  x = Math.round(x); y = Math.round(y);
  blit(set[i ? 0 : Math.floor(t / 6) % set.length][i], x, y + (i ? 0 : Math.round(Math.sin(t / 5) * 1)));
  if (kind === 'oggle' && o.helmet && !i) M5.helmet(x, y + 15 + Math.round(Math.sin(t / 5) * 1), 1);
  if (!i && !FLASH) {                                      // it wriggles
    const k = Math.floor(t / 4) % 2, w = kind === 'oggle' ? 14 : 12;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - w - k, y - 4 + k * 2, 1, 3); ctx.fillRect(x + w + k, y - 6 + k * 3, 1, 4); ctx.fillRect(x - w + 2, y + 5 - k, 1, 2);
  }
};
}
