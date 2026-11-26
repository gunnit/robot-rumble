'use strict';
// ============================================================
// MEGA CRAB, repainted (Mission 1's boss). This file replaces ENEMY_TYPES.crab.draw only: behaviour, hitbox and
// where the shots leave from stay in level1.js (updCrab), and this painting keeps that geometry (origin = e.x,
// e.y + e.oy, the crab faces left):
//   hitbox x -102..50, y -98..-26 | orbs leave the big claw's cannon at (-100,-51) | missiles leave the pod at
//   (+24,-92) | e.oy lifts or squashes the body in the stomp (feet stay on the ground while it squashes) |
//   e.claw 0..5 opens the big claw | e.hatch 0..8 raises the pod's lid | e.walk drives the six legs |
//   e.hitT > 0 = white hit flash | phase 2 (hp < max / 2): darker red, cracks, a blast hole, angry brows, red eyes.
// The crab is built from part sprites painted once, when this file loads (pixel buffers shaded from a top-left
// light, 1px OUT outline, a white copy of each for the hit flash). Every frame the parts are only placed: the body
// is one sprite, the legs and claw jaws are sprites moved with shear transforms (rows or columns slide by whole
// pixels, so they stay crisp), the lower legs telescope (a sleeve at the knee over a piston at the foot).
// After painting, still inside the crab's translate, ENEMY_TYPES.crab.tells(e) is called if the tuner wrote it.
// Everything here is private to this block.
// ============================================================
{
// ============================================================
// Palette
// ============================================================
// shell reds: seam, deep, dark, shade, base, light, rim
const RED1 = ['#3a0f0c', '#5a1a14', '#8a2a20', '#b8382c', '#d4473b', '#ff7b6b', '#ffc0ae'];
const RED2 = ['#2b0a08', '#47130f', '#6e2018', '#932b22', '#b8382c', '#e25c4d', '#ff9a86'];   // phase 2: darker
const S0 = '#252d38', S1 = '#3d4a57', S2 = '#5d6d7e', S3 = '#95a5a6', S4 = '#d3dcde';         // steel
const SLOT = '#18202a';
const G0 = '#18202a', G1 = '#2c3e50', G2 = '#4d5866', G3 = '#8492a0';                         // gun metal
const Y0 = '#9c6b12', Y1 = '#f4d03f', Y2 = '#fff3a0';                                         // brass rivets
const WHITE = '#ffffff', SOCKET = '#2c1a1a';
const NIGHT = '#16101e';   // what the far legs are darkened towards

// ============================================================
// Pixel-art builder (load time only). A part is a buffer of colours in crab-local coordinates (x0, y0 = its
// top-left pixel). Shapes are inside-tests on pixel centres, painted with a light rim, a base and a dark rim;
// then the part gets a 1px OUT outline and becomes a sprite (+ white flash copy).
// ============================================================
const buf = (x0, y0, w, h) => ({ x0, y0, w, h, p: new Array(w * h).fill(null) });
function px(b, x, y, c) {
  const i = Math.floor(x) - b.x0, j = Math.floor(y) - b.y0;
  if (i >= 0 && j >= 0 && i < b.w && j < b.h) b.p[j * b.w + i] = c;
}
function at(b, x, y) {
  const i = Math.floor(x) - b.x0, j = Math.floor(y) - b.y0;
  return i >= 0 && j >= 0 && i < b.w && j < b.h ? b.p[j * b.w + i] : null;
}
function box(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(b, x + i, y + j, c); }
// rows of one shape, [y, xa, xb] (inclusive), coloured by col(x, y) or one colour
function rows(b, tbl, col) {
  for (const [y, xa, xb] of tbl) for (let x = xa; x <= xb; x++) px(b, x, y, typeof col === 'function' ? col(x, y) : col);
}
const ell = (cx, cy, rx, ry = rx) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const both = (a, c) => (x, y) => a(x, y) && c(x, y);
// capsule from a to b, radius ra at a tapering to rb at b
function cap(ax, ay, bx, by, ra, rb = ra) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  return (x, y) => {
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1), r = ra + (rb - ra) * t;
    return (x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2 <= r * r;
  };
}
// how far along a -> b a point is (0 at a, 1 at b)
const along = (ax, ay, bx, by) => (x, y) => ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2);
function each(b, f, fn) {
  for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) {
    const x = b.x0 + i + 0.5, y = b.y0 + j + 0.5;
    if (f(x, y)) fn(i, j, x, y);
  }
}
// pal = [dark, base, light]: d px of shadow on the rim away from the light, l px of light on the rim facing it.
// (lx, ly) points away from the light: (0.5, 1) = light from the top-left, (1, 0.3) = from the left (upright limbs)
function paint(b, f, pal, d = 2, l = 1, lx = 0.5, ly = 1) {
  if (typeof pal === 'string') pal = [pal, pal, pal];
  each(b, f, (i, j, x, y) => {
    let c = pal[1];
    for (let k = 1; k <= d && c === pal[1]; k++) if (!f(x + k * lx, y + k * ly)) c = pal[0];
    for (let k = 1; k <= l && c === pal[1]; k++) if (!f(x - k * lx, y - k * ly)) c = pal[2];
    b.p[j * b.w + i] = c;
  });
}
// a zig-zag crack through points: dark, with a light lip below it
function crack(b, pts, dark, lip) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n);
      const on = (u, v) => { const c = at(b, u, v); return c && c !== OUT && c !== dark; };
      if (lip && on(x + 1, y + 1)) px(b, x + 1, y + 1, lip);
      if (at(b, x, y)) px(b, x, y, dark);
    }
  }
}
function outline(b) {
  const q = b.p.slice(), w = b.w;
  for (let j = 0; j < b.h; j++) for (let i = 0; i < w; i++) {
    if (q[j * w + i]) continue;
    if ((i > 0 && q[j * w + i - 1]) || (i < w - 1 && q[j * w + i + 1]) || (j > 0 && q[(j - 1) * w + i]) || (j < b.h - 1 && q[(j + 1) * w + i])) b.p[j * w + i] = OUT;
  }
  return b;
}
// src over dst (both in crab-local coordinates): an outlined part keeps its outline where it covers another part
function blit(dst, src) {
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) { const v = src.p[j * src.w + i]; if (v) px(dst, src.x0 + i, src.y0 + j, v); }
}
// buffer -> canvas (runs of one colour per fillRect). white: the hit-flash copy (outlines stay dark, like makeSprite)
const mixed = {};
function toCanvas(b, white, dark) {
  const c = document.createElement('canvas'); c.width = b.w; c.height = b.h;
  const g = c.getContext('2d');
  const col = v => !v ? null : v === OUT ? OUT : white ? WHITE : dark ? (mixed[v + dark] || (mixed[v + dark] = mix(v, NIGHT, dark))) : v;
  for (let j = 0; j < b.h; j++) {
    let i = 0;
    while (i < b.w) {
      const v = col(b.p[j * b.w + i]);
      if (!v) { i++; continue; }
      let k = i + 1;
      while (k < b.w && col(b.p[j * b.w + k]) === v) k++;
      g.fillStyle = v; g.fillRect(i, j, k - i, 1);
      i = k;
    }
  }
  return c;
}
// dark > 0: a copy mixed towards the night colour (the far legs). glow: no white copy (lights are not flashed)
function sprite(b, dark = 0, glow = false) {
  return { img: toCanvas(b, false, dark), white: glow ? null : toCanvas(b, true), w: b.w, h: b.h, x0: b.x0, y0: b.y0 };
}
const tone = (P, c, d) => { const i = P.indexOf(c); return i < 0 ? c : P[clamp(i + d, 0, P.length - 1)]; };

// ============================================================
// The body: shell, eye stalks, missile pod, belly, face plate and core housing in one sprite
// ============================================================
// the shell's rows: four tiers, like the crab the kids know, with the corners knocked off
const SHELL = y => y < -80 || y > -35 ? null
  : y === -80 ? [-25, 24] : y <= -78 ? [-26, 25]
  : y === -77 ? [-37, 36] : y <= -73 ? [-38, 37]
  : y === -72 ? [-44, 43] : y === -71 ? [-45, 44] : y <= -67 ? [-46, 45]
  : y === -66 ? [-48, 47] : y === -65 ? [-49, 48] : y === -35 ? [-49, 48] : [-50, 49];
const inShell = (x, y) => { const r = SHELL(y); return !!r && x >= r[0] && x <= r[1]; };
const RIVETS = [-46, -34, -22, -10, 14, 26, 38];   // brass rivets along y -62 (the eighth is the core's top bolt)

function buildShell(P, ph2) {
  const [R0, R1, R2, R3, R4, R5, R6] = P;
  const b = buf(-52, -82, 104, 49);
  // a dome lit from the top-left: a soft highlight on top, the base red, a shade that climbs towards both ends
  for (let y = -80; y <= -35; y++) {
    const [xa, xb] = SHELL(y);
    for (let x = xa; x <= xb; x++) {
      const hl = ((x + 18) / 40) ** 2 + ((y + 83) / 10) ** 2, lit = ((x + 10) / 64) ** 2 + ((y + 88) / 34) ** 2;
      px(b, x, y, hl < 1 ? R5 : lit < 1 ? R4 : R3);
    }
    if (y < -66) { px(b, xb, y, tone(P, at(b, xb, y), -1)); px(b, xb - 1, y, tone(P, at(b, xb - 1, y), -1)); }   // the tiers turn away at the back
  }
  // each tier's top edge: a light line across it, and the tier above sits in its own thin shadow
  for (const yb of [-77, -72, -66]) {
    const [ua, ub] = SHELL(yb - 1);
    for (let x = ua; x <= ub; x++) { px(b, x, yb, tone(P, at(b, x, yb), 1)); px(b, x, yb - 1, R2); }
  }
  // cooling slots in the rear panel
  for (const y of [-57, -54, -51]) { box(b, 28, y, 13, 1, R0); for (let x = 28; x <= 40; x++) px(b, x, y + 1, tone(P, at(b, x, y + 1), 1)); }
  // a shine on the front of the dome
  for (const [x, y, w] of [[-44, -63, 7], [-35, -63, 2], [-34, -75, 6], [-26, -75, 2], [-41, -69, 5]]) box(b, x, y, w, 1, tone(P, at(b, x, y), 1));
  // the skirt: a darker band under a seam
  for (let y = -45; y <= -35; y++) {
    const [xa, xb] = SHELL(y);
    for (let x = xa; x <= xb; x++) px(b, x, y, y === -45 ? R1 : y === -44 ? R3 : y <= -39 ? R2 : y <= -36 ? R1 : R0);
  }
  for (let x = -40; x <= 44; x += 12) { px(b, x, -41, R4); px(b, x + 1, -40, R0); }
  // two panel seams that lean outwards like the dome does, each with a lit lip
  for (const [sx, dir] of [[-22, -1], [19, 1]]) for (let y = -79; y <= -46; y++) {
    const x = sx + dir * Math.floor((y + 80) / 10);
    if (!inShell(x, y)) continue;
    px(b, x + 1, y, tone(P, at(b, x + 1, y), 1));
    px(b, x, y, tone(P, at(b, x, y), y < -72 ? -2 : -3));
  }
  // rim light on every top edge (weaker towards the back)
  for (let y = -80; y <= -46; y++) {
    const [xa, xb] = SHELL(y);
    for (let x = xa; x <= xb; x++) if (!inShell(x, y - 1)) px(b, x, y, x < 22 ? R6 : R5);
  }
  // brass rivets, each with a little shadow and a rust streak
  for (const x of RIVETS) {
    px(b, x, -62, Y2); px(b, x + 1, -62, Y1); px(b, x, -61, Y1); px(b, x + 1, -61, Y0);
    px(b, x, -60, tone(P, at(b, x, -60), -1)); px(b, x + 1, -60, tone(P, at(b, x + 1, -60), -1));
    if (hsh(x) > 0.4) px(b, x + 1, -59, tone(P, at(b, x + 1, -59), -1));
  }
  // wear: scratches, chipped paint on the edges
  const scratch = (x, y, n, d, dx = 1) => { for (let k = 0; k < n; k++) if (inShell(x + k * dx, y + k)) px(b, x + k * dx, y + k, tone(P, at(b, x + k * dx, y + k), d)); };
  scratch(-42, -58, 4, 1); scratch(-14, -70, 3, 1); scratch(-4, -69, 2, 1); scratch(30, -56, 4, -1, -1); scratch(40, -52, 3, -1);
  scratch(-30, -53, 3, -1); scratch(6, -76, 3, -1); scratch(-44, -50, 2, 1);
  px(b, -37, -77, S4); px(b, -36, -77, S3); px(b, 44, -70, S3); px(b, -12, -80, S4); px(b, 31, -77, S3); px(b, -49, -65, S3);
  if (ph2) {
    // battle damage: long cracks, a blast hole through the rear plate, soot, a popped rivet
    crack(b, [[-36, -77], [-33, -71], [-36, -66], [-31, -60], [-34, -54], [-30, -48]], OUT, R5);
    crack(b, [[-34, -66], [-28, -63], [-26, -58]], OUT, R5);
    crack(b, [[26, -77], [24, -72], [28, -67], [26, -61], [30, -56]], OUT, R5);
    crack(b, [[-4, -80], [-2, -75], [-6, -71]], OUT, R5);
    crack(b, [[-48, -43], [-43, -41], [-40, -37]], OUT, R3);
    const hole = ell(39, -62.5, 6.2, 5.2), ring = ell(39, -62.5, 8.4, 7.4);
    each(b, both(ring, (x, y) => inShell(Math.floor(x), Math.floor(y))), (i, j, x, y) => {
      if (hole(x, y)) b.p[j * b.w + i] = y < -64 ? '#0e0a10' : '#1c1218';
      else if (hsh(x * 3.3 + y * 7.1) > 0.35) b.p[j * b.w + i] = hsh(x + y * 2.3) > 0.5 ? R1 : R0;   // scorched, torn edge
    });
    box(b, 35, -62, 9, 1, S1); box(b, 36, -60, 7, 1, S0); px(b, 37, -62, S3); px(b, 41, -62, S3);   // ribs inside
    each(b, hole, (i, j, x, y) => { if (!hole(x, y + 1) && hsh(x * 1.9) > 0.4) px(b, x, y + 1, R5); });   // torn lower lip catches light
    px(b, -34, -62, R0); px(b, -33, -62, R0); px(b, -34, -61, R1); px(b, -33, -61, R0);   // the rivet at -34 has popped
    for (let k = 0; k < 46; k++) {   // soot around the cracks and on top
      const x = Math.round(-40 + hsh(k * 3.1) * 80), y = Math.round(-79 + hsh(k * 5.7) * 12);
      if (inShell(x, y) && at(b, x, y) !== OUT) px(b, x, y, tone(P, at(b, x, y), -1));
    }
  }
  // warm light from the base's furnace door on the back edge
  for (let y = -72; y <= -47; y++) { const xb = SHELL(y)[1]; if (at(b, xb, y) !== OUT) px(b, xb, y, ph2 ? '#c96a3c' : '#f08a55'); }
  return outline(b);
}

// a piece of armour has broken off (the tuner's CRACK! at 2/3 and 1/3 of its health, from about (-40,-70)): a
// ragged hole painted over the shell, dark inside with a rib, scorched around, its lower lip in the light
function buildGap(P, cx, cy, rx, ry, seed) {
  const [R0, R1, , , , R5, R6] = P;
  const b = buf(Math.floor(cx - rx) - 4, Math.floor(cy - ry) - 4, Math.ceil(rx * 2) + 8, Math.ceil(ry * 2) + 8);
  const rag = (x, y) => 1 + (hsh(Math.round(Math.atan2(y - cy, x - cx) * 4) + seed) - 0.5) * 0.36;
  const hole = (x, y) => { const k = rag(x, y); return ((x - cx) / (rx * k)) ** 2 + ((y - cy) / (ry * k)) ** 2 <= 1; };
  const ring = (x, y) => { const k = rag(x, y); return ((x - cx) / (rx * k + 1.6)) ** 2 + ((y - cy) / (ry * k + 1.6)) ** 2 <= 1; };
  each(b, ring, (i, j, x, y) => {
    if (!inShell(Math.floor(x), Math.floor(y))) return;
    if (hole(x, y)) b.p[j * b.w + i] = !hole(x, y - 1) || !hole(x, y - 2) ? '#0e0a10' : '#211620';
    else if (!hole(x, y) && hole(x, y - 1)) b.p[j * b.w + i] = hsh(x * 2.3 + seed) > 0.3 ? R6 : R5;        // torn lower lip
    else if (hsh(x * 3.3 + y * 7.1 + seed) > 0.4) b.p[j * b.w + i] = hsh(x + y * 2.3) > 0.5 ? R1 : R0;      // scorched edge
  });
  each(b, hole, (i, j, x, y) => { if (Math.floor(y) === Math.round(cy) && hole(x, y - 2)) b.p[j * b.w + i] = Math.floor(x) % 4 === 0 ? S3 : S1; });   // a rib
  each(b, hole, (i, j, x, y) => { if (Math.floor(y) === Math.round(cy) + 2 && hole(x, y + 1) && hsh(x * 5.1 + seed) > 0.55) b.p[j * b.w + i] = S0; });
  return b;
}

function buildStalks() {
  const b = buf(-38, -100, 24, 24);
  for (const [sx, top, base] of [[-34, -94, -78], [-20, -98, -81]]) {
    for (let y = top; y <= base; y++) {
      const ring = (base - y) % 6 === 4;
      px(b, sx, y, ring ? S2 : S4); px(b, sx + 1, y, ring ? S1 : S3); px(b, sx + 2, y, ring ? S1 : S2);
    }
    box(b, sx - 2, base - 1, 7, 2, S2); box(b, sx - 2, base - 1, 7, 1, S4); px(b, sx + 4, base, S1);   // collar
  }
  return outline(b);
}

function buildPod(ph2) {
  const b = buf(8, -90, 32, 13);
  box(b, 10, -88, 28, 10, S2);
  box(b, 10, -88, 28, 2, S4); box(b, 10, -86, 28, 1, S3); box(b, 10, -80, 28, 2, S1);
  box(b, 10, -86, 1, 6, S3);                                                              // lit front edge
  for (const x of [12, 32]) { box(b, x, -87, 5, 5, SLOT); box(b, x, -82, 5, 1, S3); box(b, x + 5, -87, 1, 5, S3); }   // lamp sockets (the lamps are drawn live)
  for (const y of [-86, -84, -82]) { box(b, 19, y, 11, 1, S0); box(b, 19, y + 1, 11, 1, S3); }                       // grille
  box(b, 18, -87, 1, 7, S1); box(b, 30, -87, 1, 7, S1);
  box(b, 37, -87, 1, 9, ph2 ? '#b98a6a' : '#e0a67c');                                     // warm back edge (the furnace door)
  if (ph2) { crack(b, [[26, -88], [28, -84], [25, -80]], OUT, S3); px(b, 24, -80, S0); px(b, 21, -85, S0); px(b, 22, -83, S0); }
  return outline(b);
}

function buildBelly() {
  const b = buf(-46, -36, 92, 12);
  rows(b, [[-28, -40, 39], [-27, -38, 37], [-26, -35, 34]], S0);                       // keel, in the shell's shadow
  for (let x = -34; x <= 32; x += 11) { px(b, x, -27, S2); px(b, x + 1, -27, S1); }
  box(b, -44, -34, 88, 1, S4); box(b, -44, -33, 88, 1, S3); box(b, -44, -32, 88, 3, S2); box(b, -44, -29, 88, 1, S1);
  box(b, -44, -33, 1, 4, S3); box(b, 43, -33, 1, 5, S1);
  for (let i = 0; i < 8; i++) { box(b, -40 + i * 11, -32, 6, 2, SLOT); box(b, -40 + i * 11, -30, 6, 1, S3); }
  return outline(b);
}

function buildFace(ph2) {
  const b = buf(-64, -66, 19, 31);
  for (let y = -64; y <= -37; y++) for (let x = -62; x <= -47; x++) {
    const a = (x + 62) + (y + 64), c = (x + 62) + (-37 - y);   // steps from the two front corners
    if (a < 2 || c < 2) continue;                              // chamfered
    px(b, x, y, y === -64 || a === 2 ? S4 : x === -47 || y === -37 || c === 2 ? S1 : x === -62 || y === -63 ? S3 : S2);
  }
  for (let i = 0; i < 4; i++) { const y = -59 + i * 5; box(b, -60, y, 12, 2, SLOT); box(b, -60, y + 2, 12, 1, S3); px(b, -60, y + 2, S4); }
  px(b, -59, -62, S4); px(b, -50, -62, S4); px(b, -58, -61, S1); px(b, -49, -61, S1);   // bolts
  px(b, -59, -40, S3); px(b, -50, -40, S3);
  if (ph2) { crack(b, [[-62, -53], [-57, -51], [-54, -46], [-49, -44]], OUT, S4); box(b, -56, -59, 4, 2, S1); px(b, -53, -58, S3); }
  return outline(b);
}

function buildHousing() {
  const b = buf(-8, -62, 20, 18);
  for (let y = -60; y <= -47; y++) for (let x = -6; x <= 9; x++) {
    if ((x === -6 || x === 9) && (y === -60 || y === -47)) continue;
    const rim = x === -6 || x === 9 || y === -60 || y === -47;
    px(b, x, y, rim ? (x === -6 || y === -60 ? S3 : S1) : SOCKET);
  }
  for (const [x, y] of [[-5, -59], [8, -59], [-5, -48], [8, -48]]) px(b, x, y, S2);
  box(b, -4, -59, 12, 1, '#1a0d0e');                                         // the frame's shadow inside
  px(b, 1, -60, S4); px(b, 2, -60, S4); px(b, -6, -54, S4); px(b, 9, -53, S0); px(b, 1, -47, S0); px(b, 2, -47, S0);   // bolts
  return outline(b);
}

function buildBody(ph2) {
  const b = buf(-66, -101, 120, 78);
  blit(b, buildShell(ph2 ? RED2 : RED1, ph2));
  blit(b, buildStalks());
  blit(b, buildPod(ph2));
  blit(b, buildBelly());
  blit(b, buildFace(ph2));
  blit(b, buildHousing());
  return b;
}

function buildLid() {
  const b = buf(8, -93, 32, 6);
  box(b, 10, -91, 28, 1, S4); box(b, 10, -90, 28, 1, S3); box(b, 10, -89, 28, 1, S2);
  px(b, 11, -90, S1); px(b, 36, -90, S1); box(b, 22, -90, 4, 1, S1); box(b, 22, -91, 4, 1, S3);   // bolts, handle
  return outline(b);
}

// one missile in the pod, like the engine's flying one: 4 wide, red nose
function buildMissile() {
  const b = buf(-1, -1, 6, 11);
  px(b, 1, 0, '#ff8a80'); px(b, 2, 0, '#e74c3c');
  for (let y = 1; y < 9; y++) {
    const red = y < 3, band = y === 5;
    px(b, 0, y, red ? '#ff8a80' : band ? '#9aa3ab' : WHITE); px(b, 1, y, red ? '#e74c3c' : band ? '#7b8794' : '#d5d8dc');
    px(b, 2, y, red ? '#e74c3c' : band ? '#7b8794' : '#d5d8dc'); px(b, 3, y, red ? '#a93226' : band ? '#5d6d7e' : '#9aa3ab');
  }
  return outline(b);
}

// ============================================================
// Eyes (12x10 on the stalks), brows for phase 2, the core's light
// ============================================================
function buildEye(ph2) {
  const b = buf(-1, -1, 14, 12);
  const I = ph2 ? ['#b3261e', '#ff3b30', '#ff8a7a'] : ['#e0a526', '#ffe066', '#fff6b8'];
  for (let y = 0; y < 10; y++) for (let x = 0; x < 12; x++) {
    if ((x === 0 || x === 11) && (y === 0 || y === 9)) continue;
    const rim = x === 0 || y === 0 || x === 11 || y === 9;
    const corner = (x === 1 || x === 10) && (y === 1 || y === 8);
    px(b, x, y, rim || corner ? (x >= 10 || y >= 8 ? S4 : WHITE) : y <= 2 ? I[2] : y >= 7 ? I[0] : I[1]);
  }
  return outline(b);
}
// an angry brow plate: slanted, low on the side given by dir (1 = low on the right)
function buildBrow(dir) {
  const b = buf(-3, -6, 18, 11);
  for (let x = -2; x <= 13; x++) {
    const k = dir > 0 ? x + 2 : 13 - x, y = -3 + Math.floor(k * 5 / 15);
    px(b, x, y, S1); px(b, x, y + 1, S0); px(b, x, y + 2, S0);
  }
  return outline(b);
}
// the core's light: a pixel disc with a hot centre (even diameter, centred on the buffer's origin)
function buildCore(r, C) {
  const b = buf(-7, -7, 14, 14);
  paint(b, ell(0, 0, r), C[0], 0, 0); paint(b, ell(0, 0, r - 1), C[1], 0, 0);
  paint(b, ell(-0.4, -0.4, r * 0.58), C[2], 0, 0); paint(b, ell(-0.6, -0.6, r * 0.3), C[3], 0, 0);
  return b;
}
function buildHalo(rgb) {
  const b = buf(-16, -16, 32, 32);
  paint(b, ell(0, 0, 15), 'rgba(' + rgb + ',0.07)', 0, 0); paint(b, ell(0, 0, 12), 'rgba(' + rgb + ',0.13)', 0, 0);
  paint(b, ell(0, 0, 9), 'rgba(' + rgb + ',0.2)', 0, 0);
  return b;
}

// ============================================================
// Legs: thigh (hip -> knee), sleeve (from the knee down) and shin (piston + spike, from the foot up), painted in
// the rest pose of the old drawCrab: hip, knee and foot of leg i.
// ============================================================
const LEGS = [];
for (let i = 0; i < 3; i++) LEGS.push({ back: true, ph: i * 2.1, H: [18 + i * 12, -38], K: [44 + i * 14, -56], F: [52 + i * 16, 0] });
for (let i = 0; i < 3; i++) LEGS.push({ back: false, ph: i * 2.1 + 1, H: [-14 - i * 12, -38], K: [-46 - i * 12, -56], F: [-52 - i * 16, 0] });
const SLEEVE = 24, ROD0 = 22, ROD1 = 42, SPIKE = 26;   // lengths along the lower leg (sleeve from the knee, the rest from the foot)

function buildLeg(L, P) {
  const LEG = [P[1], P[3], P[4]], SEAM = P[2];   // the legs are a shade darker than the shell, as they always were
  const [hx, hy] = L.H, [kx, ky] = L.K, [fx, fy] = L.F;
  const darker = (q, i, j) => { q.p[j * q.w + i] = tone(P, q.p[j * q.w + i], -1); };
  // thigh: tapered, its hip end sunk into the skirt's shadow, a panel line and a seam before the knee
  const t = buf(Math.min(hx, kx) - 7, ky - 7, Math.abs(kx - hx) + 14, hy - ky + 14);
  const tf = cap(hx, hy, kx, ky, 4.2, 3.1), ta = along(hx, hy, kx, ky);
  paint(t, tf, LEG, 2, 1);
  each(t, tf, (i, j, x, y) => { const u = ta(x, y); if (u < 0.09 || (u > 0.66 && u < 0.7)) darker(t, i, j); else if (u > 0.3 && u < 0.34 && t.p[j * t.w + i] === LEG[1]) t.p[j * t.w + i] = SEAM; });
  outline(t);
  // lower leg, along the unit vector knee -> foot: the sleeve hangs from the knee ...
  const len = Math.hypot(fx - kx, fy - ky), ux = (fx - kx) / len, uy = (fy - ky) / len;
  const ex = kx + ux * SLEEVE, ey = ky + uy * SLEEVE;
  const s = buf(Math.floor(Math.min(kx, ex)) - 7, ky - 6, Math.ceil(Math.abs(ex - kx)) + 14, Math.ceil(ey - ky) + 12);
  const sf = cap(kx, ky, ex, ey, 3.9, 3.4), sa = along(kx, ky, ex, ey);
  paint(s, sf, LEG, 2, 1, 1, 0.3);
  each(s, sf, (i, j, x, y) => { const u = sa(x, y); if (u > 0.8 && u < 0.86) darker(s, i, j); });      // a dark ring near its mouth
  outline(s);
  // ... and the shin stands on the foot: a steel piston that slides into the sleeve, a spike, a steel toe
  const rx = fx - ux * ROD1, ry = fy - uy * ROD1;
  const n = buf(Math.floor(Math.min(fx, rx)) - 6, Math.floor(ry) - 3, Math.ceil(Math.abs(rx - fx)) + 12, Math.ceil(fy - ry) + 5);
  paint(n, cap(rx, ry, fx - ux * ROD0, fy - uy * ROD0, 1.7), [S1, S3, S4], 1, 1, 1, 0);
  const pf = cap(fx - ux * SPIKE, fy - uy * SPIKE, fx - ux * 1.8, fy - uy * 1.8, 3.5, 1.3), pa = along(fx - ux * SPIKE, fy - uy * SPIKE, fx, fy);
  paint(n, pf, LEG, 2, 1, 1, 0.3);
  each(n, pf, (i, j, x, y) => { const u = pa(x, y); if (u > 0.1 && u < 0.16) darker(n, i, j); });
  paint(n, both(pf, (x, y) => pa(x, y) > 0.72), [S1, S3, S4], 1, 1, 1, 0.3);
  outline(n);
  const dark = L.back ? 0.3 : 0;
  return { thigh: sprite(t, dark), sleeve: sprite(s, dark), shin: sprite(n, dark) };
}
// a round steel joint with a bolt, centred on the buffer's origin
function buildJoint(r) {
  const m = Math.ceil(r) + 2, b = buf(-m, -m, m * 2, m * 2);
  paint(b, ell(0, 0, r), [S1, S3, S4], 2, 1);
  paint(b, ell(0, 0, r * 0.45), [S0, S1, S2], 1, 0);
  px(b, -Math.ceil(r * 0.5), -Math.ceil(r * 0.6), WHITE);
  return outline(b);
}

// ============================================================
// Claws
// ============================================================
// big claw jaw: a hooked pincer with teeth on its inner edge (upper = the top one)
function buildJaw(P, upper) {
  const [R0, R1, R2, R3, R4, R5, R6] = P;
  const b = buf(-110, upper ? -64 : -50, 37, 13);
  if (upper) {
    rows(b, [[-61, -102, -77], [-60, -105, -75], [-59, -107, -75], [-58, -108, -75], [-57, -108, -75], [-56, -108, -75], [-55, -108, -76], [-54, -108, -105], [-53, -107, -106]],
      (x, y) => y === -61 ? R6 : y === -60 ? R5 : y <= -57 ? R4 : y === -56 ? R3 : y === -55 ? R2 : R3);
    px(b, -105, -60, R6); px(b, -104, -60, R6); px(b, -107, -59, R6); px(b, -106, -59, R5); px(b, -108, -58, R5); px(b, -108, -57, R5);
    px(b, -107, -53, S4); px(b, -106, -53, S3);                                    // worn steel tip
    for (let x = -98; x <= -80; x += 6) { px(b, x, -62, R5); px(b, x + 1, -62, R4); }   // knobs along the top
    for (let i = 0; i < 4; i++) { px(b, -101 + i * 6, -54, WHITE); px(b, -100 + i * 6, -54, S4); }
    for (let y = -60; y <= -56; y++) px(b, -87, y, tone(P, at(b, -87, y), -2));
    px(b, -92, -58, Y1); px(b, -92, -57, Y0); px(b, -97, -59, R5); px(b, -96, -58, R5);
  } else {
    rows(b, [[-48, -107, -106], [-47, -108, -105], [-46, -108, -76], [-45, -108, -75], [-44, -108, -75], [-43, -108, -75], [-42, -107, -75], [-41, -105, -75], [-40, -102, -77]],
      (x, y) => y <= -47 ? R4 : y === -46 ? R5 : y <= -44 ? R4 : y <= -42 ? R3 : y === -41 ? R2 : R1);
    px(b, -107, -48, S4); px(b, -106, -48, S3); px(b, -108, -47, R5); px(b, -108, -46, R6); px(b, -107, -46, R6);
    for (let i = 0; i < 4; i++) { px(b, -98 + i * 6, -47, WHITE); px(b, -97 + i * 6, -47, S4); }
    for (let y = -45; y <= -42; y++) px(b, -87, y, tone(P, at(b, -87, y), -2));
    px(b, -92, -44, Y1); px(b, -92, -43, Y0);
    for (let x = -100; x <= -80; x += 7) px(b, x, -40, R0);
  }
  return outline(b);
}
function buildArm() {
  const b = buf(-80, -57, 36, 10);
  for (let y = -55; y <= -50; y++) box(b, -78, y, 32, 1, [S4, S3, S2, S2, S1, S0][y + 55]);
  for (const x of [-67, -57]) { box(b, x, -55, 1, 6, S1); box(b, x + 1, -55, 1, 4, S4); }
  return outline(b);
}
function buildCannon() {
  const b = buf(-101, -56, 23, 10);
  for (let y = -53; y <= -49; y++) box(b, -98, y, 18, 1, [G2, G1, G1, G1, G0][y + 53]);
  box(b, -95, -52, 12, 1, G2); box(b, -93, -53, 6, 1, G3);
  box(b, -98, -54, 3, 7, G2); box(b, -98, -54, 3, 1, G3); box(b, -98, -48, 3, 1, G0); box(b, -99, -52, 1, 3, G0);   // flared muzzle
  box(b, -89, -53, 1, 5, G0); box(b, -88, -53, 1, 4, G3);
  return outline(b);
}
function buildSmallJaw(P, upper) {
  const [R0, R1, R2, R3, R4, R5, R6] = P;
  const b = buf(-92, upper ? -37 : -29, 23, 9);
  if (upper) {
    rows(b, [[-35, -87, -72], [-34, -89, -71], [-33, -90, -71], [-32, -90, -71], [-31, -90, -72], [-30, -90, -88]],
      (x, y) => y === -35 ? R6 : y === -34 ? R5 : y === -33 ? R4 : y === -32 ? R3 : y === -31 ? R2 : R3);
    px(b, -89, -34, R6); px(b, -90, -33, R5); px(b, -89, -30, S4);
    for (let i = 0; i < 3; i++) px(b, -85 + i * 5, -30, WHITE);
    px(b, -78, -33, Y1);
  } else {
    rows(b, [[-27, -90, -88], [-26, -90, -72], [-25, -90, -71], [-24, -90, -71], [-23, -89, -71], [-22, -87, -72]],
      (x, y) => y === -27 ? R4 : y === -26 ? R5 : y === -25 ? R4 : y === -24 ? R3 : y === -23 ? R2 : R1);
    px(b, -89, -27, S4); px(b, -90, -26, R6);
    for (let i = 0; i < 3; i++) px(b, -83 + i * 5, -27, WHITE);
    px(b, -78, -24, Y0);
  }
  return outline(b);
}
function buildSmallArm() {
  const b = buf(-72, -33, 24, 8);
  for (let y = -31; y <= -28; y++) box(b, -70, y, 20, 1, [S4, S2, S2, S1][y + 31]);
  box(b, -61, -31, 1, 4, S1); box(b, -60, -31, 1, 3, S4);
  return outline(b);
}

// ============================================================
// All the sprites (painted here, once)
// ============================================================
const artFor = ph2 => {
  const P = ph2 ? RED2 : RED1;
  return {
    body: sprite(buildBody(ph2)), eye: sprite(buildEye(ph2)), legs: LEGS.map(L => buildLeg(L, P)),
    gaps: [sprite(buildGap(P, -40.5, -67.5, 5, 4.2, 3)), sprite(buildGap(P, -31.5, -62, 4.4, 3.6, 11))],
    jawU: sprite(buildJaw(P, true)), jawL: sprite(buildJaw(P, false)), sjawU: sprite(buildSmallJaw(P, true)), sjawL: sprite(buildSmallJaw(P, false)),
    core: [3.6, 4.6, 5.6].map(r => sprite(buildCore(r, ph2 ? ['#a81f18', '#ff3b30', '#ff8a7a', '#ffe7e2'] : ['#d9781a', '#ffb52e', '#ffe27a', '#fffbe0']), 0, true)),
    halo: sprite(buildHalo(ph2 ? '255,70,50' : '255,190,70'), 0, true),
    red: P
  };
};
const ART = [artFor(false), artFor(true)];
const LID = sprite(buildLid()), MISSILE = sprite(buildMissile()), ARM = sprite(buildArm()), CANNON = sprite(buildCannon()), SARM = sprite(buildSmallArm());
const KNEE = sprite(buildJoint(3.6)), KNEE_D = sprite(buildJoint(3.6), 0.3), WRIST = sprite(buildJoint(6)), KNUCKLE = sprite(buildJoint(3.3));
const BROWS = [sprite(buildBrow(1)), sprite(buildBrow(-1))];

// ============================================================
// Drawing
// ============================================================
function put(s, dx = 0, dy = 0) { ctx.drawImage(FLASH && s.white ? s.white : s.img, s.x0 + dx, s.y0 + dy); }
// sprite s with its rest point (ax, ay) at (x, y); its columns slide by ky px per px of x (a hinge at the rest point)
function shearY(s, x, y, ax, ay, ky) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.transform(1, ky, 0, 1, 0, 0);
  ctx.drawImage(FLASH ? s.white : s.img, s.x0 - ax, s.y0 - ay);
  ctx.restore();
}
// the same with rows sliding by kx px per px of y (an upright limb leaning)
function shearX(s, x, y, ax, ay, kx) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.transform(1, 0, kx, 1, 0, 0);
  ctx.drawImage(FLASH ? s.white : s.img, s.x0 - ax, s.y0 - ay);
  ctx.restore();
}
function dark(x, y, w, h) { ctx.fillStyle = OUT; ctx.fillRect(x, y, w, h); }

function drawLeg(L, S, wk, fy, hang) {
  const s = Math.sin(wk + L.ph);
  const kx = L.K[0], ky = L.K[1] + s * 3;
  const fx = L.F[0] + s * 5, fyy = fy - Math.max(0, s) * 6 + hang;
  shearY(S.thigh, L.H[0], L.H[1], L.H[0], L.H[1], (ky - L.K[1]) / (kx - L.H[0]));
  const k = (fx - kx) / (fyy - ky) - (L.F[0] - L.K[0]) / (L.F[1] - L.K[1]);
  shearX(S.shin, fx, fyy, L.F[0], L.F[1], k);
  shearX(S.sleeve, kx, ky, L.K[0], L.K[1], k);
  put(L.back ? KNEE_D : KNEE, Math.round(kx), Math.round(ky));
}

function drawEye(e, A, ex, ey, i, ph2, look, up, lid) {
  put(A.eye, ex, ey);
  if (e.state === 'dying') {   // knocked out: X eyes
    for (let k = 0; k < 6; k++) { R(ex + 3 + k, ey + 2 + k, 1, 1, OUT); R(ex + 8 - k, ey + 2 + k, 1, 1, OUT); }
  } else if (lid < 8) {
    const x = ex + 4 + look, y = ey + 2 + up;
    R(x + 1, y, 2, 6, OUT); R(x, y + 1, 4, 4, OUT);
    R(x + 1, y + 1, 1, 2, WHITE); R(x + 2, y + 4, 1, 1, ph2 ? '#ff8a7a' : '#8a6a1a');
  }
  if (lid > 0) {   // the lid comes down from the top
    R(ex + 1, ey + 1, 10, lid, A.red[4]); R(ex + 1, ey + 1, 10, 1, A.red[5]); R(ex + 1, ey + lid, 10, 1, A.red[2]);
  }
  if (ph2) put(BROWS[i], ex, ey);
}

function drawCrab(e) {
  const ph2 = e.hp < e.max / 2, A = ART[ph2 ? 1 : 0], dying = e.state === 'dying';
  // beaten: it shakes and sinks onto its legs while the engine's explosions go off
  const sink = dying ? Math.min(6, e.st / 18) : 0, shake = dying ? Math.round((hsh(e.st * 1.3) - 0.5) * 3) : 0;
  const oy = e.oy || 0, fy = (oy > 0 ? -oy : 0) - sink, wk = e.walk * 0.18;
  ctx.save(); ctx.translate(Math.round(e.x) + shake, Math.round(e.y + oy + sink));
  // its shadow on the floor (in the air the stomp's own shadow, one of the tells, takes over)
  const air = oy < 0 ? -oy : 0;
  if (!air) {
    ctx.fillStyle = 'rgba(12,10,22,0.3)';
    for (let j = 0; j < 4; j++) { const w = Math.round(96 * Math.sqrt(1 - ((j + 0.5) / 4.3) ** 2)); ctx.fillRect(-6 - w, Math.round(fy) - 1 + j, w * 2, 1); }
  }
  // hit flash: a 2-frame blink at most every 24 frames, like the Mega Bear (under the H.M.G. the crab stayed white)
  if (e.hitT >= 3 && G.t - (e.flashAt ?? -99) >= 24) e.flashAt = G.t;
  FLASH = G.t - (e.flashAt ?? -99) < 2;
  const hang = Math.min(5, air / 5);                // in the air the legs stretch a little
  for (let i = 0; i < 3; i++) drawLeg(LEGS[i], A.legs[i], wk, fy, hang);
  // missile pod: the missiles and the lid's struts rise behind the pod's front
  const hatch = e.hatch || 0, hh = Math.round(hatch);
  if (hatch > 0) {
    const my = -87 - Math.round(hatch * 0.875);
    const away = e.state === 'missile' && e.st >= 20 && e.st <= 54 && e.st % 10 < 5;   // the middle tube has just fired
    for (let i = 0; i < 3; i++) if (i !== 1 || !away) put(MISSILE, 14 + i * 8, my);
    for (const x of [12, 35]) { dark(x - 1, -90 - hh, 3, hh + 2); R(x, -90 - hh, 1, hh + 2, S3); }
  }
  put(A.body);
  const lost = e.gift | 0;                          // armour pieces broken off so far (0..2)
  if (lost > 0) put(A.gaps[0]);
  if (lost > 1) put(A.gaps[1]);
  put(LID, 0, -hh);
  for (const x of [13, 33]) { R(x, -86, 3, 3, hatch > 0 ? '#c22a20' : '#6e1c1c'); R(x, -86, 1, 1, hatch > 0 ? '#ff8a80' : '#a23a36'); }   // launch lamps (the tells blink them)
  // glowing core
  const pulse = Math.sin(e.t * 0.2);
  if (FLASH) { R(-3, -57, 10, 8, WHITE); R(-1, -58, 6, 10, WHITE); }
  else {
    ctx.globalAlpha = 0.6 + pulse * 0.4; put(A.halo, 2, -53); ctx.globalAlpha = 1;
    put(A.core[pulse < -0.4 ? 0 : pulse < 0.5 ? 1 : 2], 2, -53);
  }
  if (ph2 && !FLASH && (e.t >> 3) % 3) { R(38, -64, 2, 1, (e.t >> 3) % 2 ? '#ffb52e' : '#ff5e3a'); R(41, -61, 1, 1, '#ff9f1c'); }   // embers in the blast hole
  // mandibles
  const mb = Math.floor(e.t / 8) % 2;
  RO(-66, -40 + mb, 6, 3, S1); R(-66, -40 + mb, 6, 1, S3); R(-67, -39 + mb, 1, 1, S4);
  RO(-66, -35 - mb, 6, 3, S1); R(-66, -35 - mb, 6, 1, S2); R(-67, -34 - mb, 1, 1, S3);
  // eyes on stalks: they look at the hero, blink now and then, and bob a little as it walks
  // (it squints along the cannon while it aims, glances up after its missiles and down at the floor in the stomp)
  const bt = e.t % 180, squint = e.state === 'spread' && !ph2 ? 2 : 0;
  const lid = dying ? 0 : bt < 2 ? 4 : bt < 5 ? 8 : bt < 7 ? 4 : squint;
  const look = clamp(Math.round((G.p.x - e.x) / 60), -3, 0);
  const up = e.state === 'missile' && e.st > 15 && e.st < 75 ? -1 : e.state === 'stomp' && oy < -8 ? 1 : 0;
  drawEye(e, A, -39, -103 + Math.round(Math.sin(wk * 2) * 0.7), 0, ph2, look, up, lid);
  drawEye(e, A, -25, -107 + Math.round(Math.sin(wk * 2 + 2.2) * 0.7), 1, ph2, look, up, lid);
  for (let i = 3; i < 6; i++) drawLeg(LEGS[i], A.legs[i], wk, fy, hang);
  // big claw with the cannon: the jaws hinge at the wrist
  // (while it walks about the claw snaps a little now and then)
  const op = dying ? 4 : Math.max(e.claw || 0, e.state === 'idle' && e.t % 96 < 7 ? 1.5 : 0);
  put(ARM); put(CANNON);
  shearY(A.jawU, -76, 0, -76, 0, op / 30);
  shearY(A.jawL, -76, 0, -76, 0, -op / 30);
  put(WRIST, -76, -52);
  // small claw: it clacks twice every couple of seconds
  const ct = e.t % 150, so = dying ? 2 : ct < 6 || (ct >= 12 && ct < 18) ? 2 : ct < 24 ? -1 : 0;
  put(SARM);
  shearY(A.sjawU, -71, 0, -71, 0, so / 19);
  shearY(A.sjawL, -71, 0, -71, 0, -so / 19);
  put(KNUCKLE, -71, -29);
  FLASH = false;
  if (ENEMY_TYPES.crab.tells) ENEMY_TYPES.crab.tells(e);
  ctx.restore();
}

if (ENEMY_TYPES.crab) ENEMY_TYPES.crab.draw = drawCrab;
}
