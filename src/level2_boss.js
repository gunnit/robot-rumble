'use strict';
// ============================================================
// MEGA BEAR: Mission 2's final boss, a giant robot grizzly (ENEMY_TYPES.megabear), and its projectiles
// (EB_TYPES mbrock, mbwave, mbbeam). It is built from part sprites (torso, head, jaw, arms, paws, legs) painted once
// at load and posed every frame, so every part can move.
// Entrance: tremors, it crashes in from the right and roars. Phase 1: boulder toss (marked landing spots), ground
// pound (rears up, slams, a shockwave rolls out: jump it), swipe (only at a hero standing right in front of it).
// Phase 2 (hp < 50%): plates burst off and the core shows (shots on it do double damage), red eyes, shorter rests,
// chest laser (HIGH = duck under it, LOW = jump the pulse), a roar that calls two wolves. One attack at a time, each
// with a pose, a sound and a marker first. A wall in front of its claws; touching it never hurts.
// Death: chained explosions, the head, paws and plates fly off, a big boom and the wreck breaks apart.
// Everything is private to this block except the registry entries.
// ============================================================
{
// ============================================================
// Palette
// ============================================================
const M0 = '#22272e', M1 = METDD, M2 = METD, M3 = MET, M4 = METL, M5 = '#f2f6fa';      // robot metal
const B0 = '#3b1d13', B1 = '#5f2f1c', B2 = '#8a4a2a', B3 = '#b06c3b', B4 = '#d99c60';  // rust-brown fur paint
const T1 = '#8a5d36', T2 = '#bf8f58', T3 = '#e8c48c';                                 // muzzle
const C1 = '#743716', C2 = '#b5622b', C3 = '#eba264';                                 // copper
const K1 = '#0b5577', K2 = '#1cb2e3', K3 = '#86f3ff', K4 = '#eaffff';                 // core (cyan)
const NOSE = '#2b2531', MOUTH = '#2a0b12';
const GR1 = '#5f5b55', GR2 = '#8f8a80', GR3 = '#bdb7aa', GR4 = '#dcd7cb';             // granite

// ============================================================
// Pixel-art builder (load time only). A part is a buffer of colours in bear-local coordinates (x0, y0 = its top-left
// pixel; the bear faces left with its feet at 0,0). Shapes are inside-tests on pixel centres, painted with a top-left
// light (light rim, base, dark rim); then the part gets a 1px OUT outline and becomes a sprite (+ white flash copy).
// ============================================================
const buf = (x0, y0, w, h) => ({ x0, y0, w, h, p: new Array(w * h).fill(null) });
const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const rect = (x0, y0, w, h) => (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
const any = (...fs) => (x, y) => fs.some(f => f(x, y));
const both = (a, b) => (x, y) => a(x, y) && b(x, y);
const minus = (a, b) => (x, y) => a(x, y) && !b(x, y);
function poly(pts) {
  return (x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
}
// capsule from a to b, radius ra at a tapering to rb at b
function cap(ax, ay, bx, by, ra, rb = ra) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  return (x, y) => {
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1), r = ra + (rb - ra) * t;
    return (x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2 <= r * r;
  };
}
function each(b, f, fn) {
  for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) {
    const x = b.x0 + i + 0.5, y = b.y0 + j + 0.5;
    if (f(x, y)) fn(i, j, x, y);
  }
}
// pal = [dark, base, light]: d px of shadow on the bottom-right rim, l px of light on the top-left rim
function paint(b, f, pal, d = 2, l = 1) {
  if (typeof pal === 'string') pal = [pal, pal, pal];
  each(b, f, (i, j, x, y) => {
    let c = pal[1];
    for (let k = 1; k <= d && c === pal[1]; k++) if (!f(x + k * 0.5, y + k)) c = pal[0];
    for (let k = 1; k <= l && c === pal[1]; k++) if (!f(x - k * 0.5, y - k)) c = pal[2];
    b.p[j * b.w + i] = c;
  });
}
// the inner rim of a shape (a panel line or a plate's own outline)
function edge(b, f, c) {
  each(b, f, (i, j, x, y) => { if (!f(x + 1, y) || !f(x - 1, y) || !f(x, y + 1) || !f(x, y - 1)) b.p[j * b.w + i] = c; });
}
function dot(b, x, y, c) {
  const i = Math.floor(x - b.x0), j = Math.floor(y - b.y0);
  if (i >= 0 && j >= 0 && i < b.w && j < b.h) b.p[j * b.w + i] = c;
}
const pick = (b, x, y) => { const i = Math.floor(x - b.x0), j = Math.floor(y - b.y0); return i >= 0 && j >= 0 && i < b.w && j < b.h ? b.p[j * b.w + i] : null; };
function rivet(b, x, y, hi = M4, lo = M1) { dot(b, x, y, hi); dot(b, x + 1, y + 1, lo); }
// a zig-zag crack through points, dark with a light lip below it
function crack(b, pts, dark, lip) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n, on = (u, v) => { const c = pick(b, u, v); return c && c !== OUT; };
      if (lip && on(x + 1, y + 1)) dot(b, x + 1, y + 1, lip);
      if (on(x, y)) dot(b, x, y, dark);
    }
  }
}
// a row of fur tufts (downward triangles, w wide, h tall) hanging from y, clipped to f
function fur(b, f, x0, x1, y, w, h, c) {
  for (let x = Math.floor(x0); x < x1; x++) {
    const k = ((x - x0) % w) / w, t = Math.round(h * (1 - Math.abs(k * 2 - 1)));
    const yy = typeof y === 'function' ? y(x) : y;
    for (let i = 0; i < t; i++) if (f(x + 0.5, yy + i + 0.5)) dot(b, x, yy + i, c);
  }
}
// short fur strokes scattered over the pixels of colour `on` inside f (stable: hsh, never Math.random)
function strokes(b, f, n, c, on, seed) {
  for (let k = 0; k < n; k++) {
    const x = b.x0 + Math.floor(hsh(seed + k * 3.1) * b.w), y = b.y0 + Math.floor(hsh(seed + k * 7.7) * b.h);
    for (let i = 0; i < 3; i++) if (f(x + i * 0.6 + 0.5, y + i + 0.5) && pick(b, x + i * 0.6, y + i) === on) dot(b, x + i * 0.6, y + i, c);
  }
}
function outline(b) {
  const q = b.p.slice(), W1 = b.w;
  for (let j = 0; j < b.h; j++) for (let i = 0; i < W1; i++) {
    if (q[j * W1 + i]) continue;
    if ((i > 0 && q[j * W1 + i - 1]) || (i < W1 - 1 && q[j * W1 + i + 1]) || (j > 0 && q[(j - 1) * W1 + i]) || (j < b.h - 1 && q[(j + 1) * W1 + i])) b.p[j * W1 + i] = OUT;
  }
}
// buffer -> canvas (runs of one colour per fillRect). white: the hit-flash copy (outline stays dark, like makeSprite)
function toCanvas(b, white, dark) {
  const c = document.createElement('canvas'); c.width = b.w; c.height = b.h;
  const g = c.getContext('2d');
  const col = v => !v ? null : v === OUT ? OUT : white ? '#ffffff' : dark ? mix(v, '#121722', dark) : v;
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
function sprite(b, dark = 0) { return { img: toCanvas(b, false, dark), white: toCanvas(b, true), w: b.w, h: b.h, x0: b.x0, y0: b.y0 }; }
// a copy for the engine's 'sprite' particles, which draw around their x, y: the part sits on top of a transparent
// half, so a part lying on the ground (particle y = ground) rests on it instead of sinking in
function debrisSprite(b) {
  const c = document.createElement('canvas'); c.width = b.w; c.height = b.h * 2;
  c.getContext('2d').drawImage(toCanvas(b, false), 0, 0);
  return { img: c, w: b.w, h: b.h * 2 };
}
function rot90(b) {
  const r = buf(0, 0, b.h, b.w);
  for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) r.p[i * r.w + (b.h - 1 - j)] = b.p[j * b.w + i];
  return r;
}

// ============================================================
// Rig: rest joints in bear-local coordinates (front = -x, feet at y 0)
// ============================================================
const HIP = [28, -60], NECK = [-46, -88], JAWH = [-66, -72], CORE = [-57, -56], LIGHT = [-16, -120];
const SH = [[-28, -76], [-16, -76]], EL = [[-36, -46], [-24, -46]], WR = [[-58, -16], [-46, -16]];
const KN = [[34, -44], [20, -46]], AN = [[30, -13], [16, -13]];
const PIPES = [[10, -134], [27, -130]];
const UA = Math.hypot(EL[0][0] - SH[0][0], EL[0][1] - SH[0][1]), FA = Math.hypot(WR[0][0] - EL[0][0], WR[0][1] - EL[0][1]);
const UA0 = Math.atan2(EL[0][1] - SH[0][1], EL[0][0] - SH[0][0]), FA0 = Math.atan2(WR[0][1] - EL[0][1], WR[0][0] - EL[0][0]);
const SHIN0 = Math.atan2(AN[0][1] - KN[0][1], AN[0][0] - KN[0][0]);
const WALL = 92;     // the hero stays this far left of e.x, in front of the claws
const REACH = 120;   // the swipe hurts from e.x - REACH to the wall (as far as its claw trails reach)

// ============================================================
// Part sprites (painted once at load)
// ============================================================
function pipe(b, x0, y0, x1, y1) {
  paint(b, cap(x0, y0, x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * 0.3, 5.2), [M0, M1, M2], 1, 1);
  paint(b, cap(x0, y0, x1, y1, 3.6), [M1, M2, M3], 1, 1);
  const kx = x1 - (x1 - x0) * 0.18, ky = y1 - (y1 - y0) * 0.18;
  paint(b, cap(kx, ky, x1, y1, 4.4), [C1, C2, C3], 1, 1);
  paint(b, ell(x1 + 0.5, y1 + 0.5, 2.7, 1.7), M0);
  dot(b, x0 + (x1 - x0) * 0.5 - 2, y0 + (y1 - y0) * 0.5, M4);
}

function buildTorso(ph2) {
  const b = buf(-66, -140, 132, 106);
  const shoulder = ell(-14, -90, 34, 28), back = ell(16, -86, 30, 22), rump = ell(36, -71, 22, 25);
  const belly = ell(0, -59, 42, 18), chest = ell(-35, -66, 21, 22);
  const body = any(shoulder, back, rump, belly, chest);
  for (const [x0, y0, x1, y1] of [[2, -110, 10, -134], [17, -105, 27, -130]]) pipe(b, x0, y0, x1, y1);
  paint(b, ell(-44, -88, 13, 12), [M0, M1, M2]);                                   // neck, behind the head
  paint(b, body, [B1, B2, B3], 3, 2);
  strokes(b, both(body, ell(12, -66, 40, 12)), 70, B1, B2, 37);                  // darker fur low on the flank
  // armour shell over the back: the top 19px of the body, cut into four curved plates with steel trim
  const shell = both(body, (x, y) => !body(x, y - 19));
  const cuts = [-70, -34, -6, 22, 80];
  const plates = [0, 1, 2, 3].map(i => both(shell, (x, y) => { const s = (y + 100) * 0.35; return x >= cuts[i] + s && x < cuts[i + 1] + s; }));
  plates.forEach((pl, i) => {
    if (ph2 && i === 1) return;
    paint(b, pl, [B1, B3, B4], 2, 1);
    strokes(b, pl, 46, B2, B3, 51 + i * 9);
    strokes(b, pl, 14, B4, B3, 57 + i * 9);
    const trim = both(pl, (x, y) => !pl(x, y + 2.5) && body(x, y + 3));
    paint(b, trim, [M1, M3, M4], 1, 0);
    each(b, trim, (ii, jj, x, y) => { if (Math.round(x) % 7 === 0 && !pl(x, y + 1.5)) rivet(b, x - 0.5, y - 1.5, M5, M1); });
    edge(b, pl, B0);
  });
  // fur tufts hanging under the shell
  each(b, both(body, (x, y) => shell(x, y - 1) && !shell(x, y)), (i, j, x) => {
    const t = Math.round(3 * (1 - Math.abs(((x + 400) % 5) / 2.5 - 1)));
    for (let k = 0; k < t; k++) if (body(x, b.y0 + j + k + 0.5) && !shell(x, b.y0 + j + k + 0.5)) b.p[(j + k) * b.w + i] = B1;
  });
  if (ph2) {
    // the second plate is gone: dark frame, ribs, torn edges and glowing cables
    const hole = plates[1];
    paint(b, hole, [M0, M0, M1], 1, 1);
    for (let x = -36; x < 0; x += 6) paint(b, both(hole, rect(x, -140, 2, 60)), [M1, M2, M3], 1, 0);
    paint(b, both(hole, cap(-30, -104, 0, -112, 1.2)), K2, 0, 0);
    paint(b, both(hole, cap(-26, -112, -2, -102, 1)), K1, 0, 0);
    edge(b, hole, M3);
    each(b, hole, (i, j, x, y) => { if (!hole(x, y - 1) && hsh(x * 3.7) > 0.45) dot(b, x, y + 1, M4); });
  }
  // grey armoured belly with segment lines
  const bellyArm = both(body, (x, y) => y > -53 + x * 0.05 && !shell(x, y));
  paint(b, bellyArm, [M1, M2, M3], 2, 1);
  for (let y = -49; y < -38; y += 5) paint(b, both(bellyArm, rect(-60, y, 130, 1)), M1, 0, 0);
  for (let x = -36; x < 44; x += 10) rivet(b, x, -50 + x * 0.05, M4, M1);
  // haunch: a big round thigh plate with a steel rim and the hip bolt
  const haunch = ell(30, -60, 20, 20), hrim = minus(haunch, ell(30, -61, 17.5, 17.5));
  paint(b, haunch, [B1, B3, B4], 3, 2);
  strokes(b, haunch, 40, B2, B3, 71);
  paint(b, hrim, [M1, M2, M3], 1, 1);
  for (let a = 0; a < 8; a++) rivet(b, 30 + Math.cos(a * 0.785 + 0.3) * 18.5, -60 + Math.sin(a * 0.785 + 0.3) * 18.5, M5, M1);
  edge(b, haunch, OUT);
  paint(b, ell(30, -61, 6, 6), [M1, M3, M4], 1, 1); paint(b, ell(30, -61, 2.5, 2.5), [M1, M2, M2], 0, 0); dot(b, 28, -64, M5);
  if (ph2) {
    // battle damage: cracked haunch and rear plate, scorch marks around the torn plate
    crack(b, [[19, -73], [25, -67], [22, -61], [28, -54], [26, -48]], B0, B4);
    crack(b, [[28, -104], [32, -98], [29, -93], [34, -88]], B0, B4);
    crack(b, [[-60, -96], [-55, -101], [-50, -98]], B0, B4);
    each(b, (x, y) => plates[1](x + 4, y) || plates[1](x - 4, y) || plates[1](x, y + 4), (i, j, x, y) => { if (!plates[1](x, y) && b.p[j * b.w + i] && b.p[j * b.w + i] !== OUT && hsh(x * 1.7 + y * 3.1) > 0.55) b.p[j * b.w + i] = hsh(x + y) > 0.5 ? B0 : M0; });
  }
  // chest: grey plate and the core housing (the hatch in phase 1, the open socket in phase 2)
  const chestPlate = both(chest, (x, y) => x < -40 + (y + 66) * 0.3 && !shell(x, y));
  paint(b, chestPlate, [M1, M2, M3], 2, 1);
  edge(b, chestPlate, M1);
  const [cx, cy] = CORE;
  paint(b, ell(cx, cy, 11, 11), [M1, M3, M4], 2, 1);
  for (let a = 0; a < 8; a++) rivet(b, cx + Math.cos(a * 0.785) * 9, cy + Math.sin(a * 0.785) * 9, M5, M1);
  if (!ph2) {
    paint(b, ell(cx, cy, 7.5, 7.5), [B1, B3, B4], 1, 1);
    paint(b, rect(cx - 7, cy - 1, 14, 2), M0, 0, 0);                    // the glowing slit
    rivet(b, cx - 1, cy - 5, M5, B0); rivet(b, cx - 1, cy + 3, M5, B0);
  } else {
    paint(b, ell(cx, cy, 8, 8), M0, 0, 0);
    for (let a = 0; a < 12; a++) dot(b, cx + Math.cos(a * 0.52) * (7.5 + (a % 2)), cy + Math.sin(a * 0.52) * (7.5 + (a % 2)), a % 2 ? M3 : M5);
  }
  paint(b, ell(LIGHT[0], LIGHT[1] + 2, 4, 2.5), [M1, M2, M3], 1, 1);            // warning light housing
  outline(b);
  return b;
}

function buildHead() {
  const b = buf(-116, -130, 82, 74);
  const farEar = ell(-74, -116, 7.5, 7.5);
  paint(b, farEar, [B0, B1, B2]); paint(b, ell(-74, -116, 4, 4), M1); edge(b, farEar, B0);
  // cheek fur behind the face
  const jowl = ell(-56, -80, 17, 14);
  paint(b, jowl, [B1, B2, B3], 2, 1);
  strokes(b, jowl, 34, B1, B2, 81); strokes(b, jowl, 14, B3, B2, 83);
  each(b, jowl, (i, j, x, y) => { if (!jowl(x, y + 1.5) && Math.round(x) % 4 === 0) dot(b, x, y + 1, B1); });
  // the dented steel helmet with a fur crest
  const dome = ell(-66, -97, 26, 20);
  paint(b, dome, [M2, M3, M4], 2, 1);
  const crest = both(dome, (x, y) => y < -104 + Math.abs(((x + 400) % 6) - 3) * 0.9);
  paint(b, crest, [B1, B3, B4], 1, 1);
  strokes(b, crest, 30, B2, B3, 91);
  for (const [x, y] of [[-48, -97], [-56, -88], [-45, -86], [-80, -104]]) { dot(b, x, y, M2); dot(b, x + 1, y, M2); dot(b, x, y - 1, M5); }   // dents
  rivet(b, -60, -90, M5, M1); rivet(b, -50, -92, M5, M1);
  // near ear: round, brown rim, a speaker grille inside
  const ear = ell(-50, -115, 9, 9);
  paint(b, ear, [B1, B3, B4], 2, 1); edge(b, ear, B0);
  paint(b, ell(-50, -115, 5, 5), [M1, M2, M3], 1, 1);
  for (const [x, y] of [[-53, -117], [-50, -117], [-53, -114], [-50, -114], [-47, -116]]) dot(b, x, y, M0);
  // angry brow and the visor band with the eye slots (the glow is drawn live)
  paint(b, poly([[-101, -98], [-60, -108], [-55, -100], [-98, -91]]), [M0, M1, M2], 1, 1);
  paint(b, poly([[-101, -94], [-56, -102], [-56, -88], [-99, -84]]), [M0, M0, M1], 1, 1);
  dot(b, -84, -93, M2); dot(b, -83, -93, M2); dot(b, -66, -98, M2); dot(b, -65, -98, M2);
  paint(b, poly([[-78, -97], [-66, -100], [-65, -94], [-78, -92]]), '#3a0c0c', 0, 0);        // near eye slot
  paint(b, poly([[-95, -93], [-86, -95], [-86, -90], [-95, -89]]), '#3a0c0c', 0, 0);         // far eye slot
  // snout, big nose, seam, bolts, upper bolt teeth
  const snout = any(ell(-90, -80, 18, 10), ell(-78, -84, 10, 8));
  paint(b, snout, [T1, T2, T3], 2, 1);
  paint(b, both(snout, rect(-93, -92, 1, 22)), T1, 0, 0);
  paint(b, ell(-106, -84, 6.5, 5.5), [NOSE, NOSE, '#5d5668'], 1, 1);
  dot(b, -109, -87, '#a59eb1'); dot(b, -108, -87, '#a59eb1'); dot(b, -107, -88, '#a59eb1'); dot(b, -110, -83, M0); dot(b, -109, -82, M0);
  rivet(b, -84, -86, T3, T1); rivet(b, -77, -83, T3, T1);
  for (let x = -104; x <= -80; x += 4) paint(b, rect(x, -73, 3, 3), [M2, M4, M5], 1, 1);
  paint(b, ell(-64, -78, 4.5, 4.5), [M1, M2, M3], 1, 1); dot(b, -65, -79, M4);                // cheek bolt
  outline(b);
  return b;
}

function buildJaw() {
  const b = buf(-110, -80, 54, 24);
  const jaw = poly([[-104, -74], [-64, -77], [-59, -70], [-68, -62], [-98, -62], [-105, -67]]);
  paint(b, jaw, [M1, M2, M3], 2, 1);
  paint(b, both(jaw, rect(-110, -66, 60, 5)), [B0, B1, B2], 1, 0);       // fur chin
  for (let x = -101; x <= -77; x += 4) paint(b, rect(x, -77, 3, 3), [M2, M4, M5], 1, 1);
  rivet(b, -92, -70); rivet(b, -82, -71);
  paint(b, ell(JAWH[0], JAWH[1], 3.5, 3.5), [M1, M3, M4], 1, 1);
  outline(b);
  return b;
}

function buildUpperArm() {
  const b = buf(-56, -96, 44, 64);
  const [sx, sy] = SH[0], [ex, ey] = EL[0];
  const a = any(cap(sx, sy, ex, ey, 14, 11), ell(sx - 2, sy + 4, 14, 14));
  paint(b, a, [B1, B2, B3], 3, 2);
  strokes(b, a, 34, B3, B2, 101);
  strokes(b, a, 18, B1, B2, 103);
  each(b, a, (i, j, x, y) => { if (!a(x, y + 1.5) && Math.round(x) % 4 === 1) dot(b, x, y + 1, B1); });
  outline(b);
  return b;
}

function buildForearm() {
  const b = buf(-74, -62, 50, 52);
  const [ex, ey] = EL[0], [wx, wy] = WR[0];
  const a = cap(ex, ey, wx, wy, 11, 9.5);
  paint(b, a, [B1, B2, B3], 2, 1);
  strokes(b, a, 24, B3, B2, 111);
  // armoured bracer and the elbow cap
  const br = both(a, (x, y) => { const t = ((x - ex) * (wx - ex) + (y - ey) * (wy - ey)) / (FA * FA); return t > 0.4 && t < 0.78; });
  paint(b, br, [M1, M2, M3], 2, 1); edge(b, br, M1);
  each(b, br, (i, j, x, y) => { if (!br(x, y + 1.5) && Math.round(x) % 5 === 0) rivet(b, x - 0.5, y - 2.5, M5, M1); });
  paint(b, ell(ex, ey, 8, 8), [M1, M3, M4], 2, 1);
  paint(b, ell(ex, ey, 3, 3), [M1, M2, M2], 0, 0); dot(b, ex - 2, ey - 3, M5);
  outline(b);
  return b;
}

function buildPaw() {
  const [wx, wy] = WR[0], b = buf(wx - 34, wy - 14, 54, 31);
  const mitt = any(ell(wx - 6, wy + 8, 19, 9), ell(wx, wy + 1, 12, 9));
  paint(b, mitt, [B1, B2, B3], 2, 1);
  strokes(b, mitt, 20, B3, B2, 121);
  paint(b, both(mitt, (x, y) => y > wy + 13), [M1, M2, M2], 1, 0);                              // sole
  for (const [x, y] of [[wx - 18, wy + 1], [wx - 10, wy - 1], [wx - 2, wy - 2]]) paint(b, ell(x, y, 4, 3), [M1, M3, M4], 1, 1);   // knuckle plates
  // steel claws curling down in front
  for (let k = 0; k < 4; k++) {
    const x = wx - 22 + k * 4, top = wy + 3 + k;
    paint(b, poly([[x + 2, top], [x + 6, top + 2], [x - 2, wy + 15], [x - 8, wy + 16], [x - 6, wy + 13]]), [M2, M4, M5], 1, 1);
  }
  outline(b);
  return b;
}

function buildPauldron(ph2) {
  const [sx, sy] = SH[0], b = buf(sx - 20, sy - 18, 42, 34);
  const pd = ell(sx - 1, sy - 3, 16, 13);
  paint(b, pd, [B1, B3, B4], 2, 1);
  strokes(b, pd, 26, B2, B3, 131);
  paint(b, both(pd, (x, y) => y > sy + 4), [M1, M3, M4], 1, 0);
  edge(b, pd, OUT);
  rivet(b, sx - 10, sy + 5, M5, M1); rivet(b, sx - 1, sy + 7, M5, M1); rivet(b, sx + 8, sy + 5, M5, M1);
  if (ph2) {
    for (let i = 0; i < 10; i++) dot(b, sx - 4 + i * 0.5, sy - 14 + i, OUT);        // cracked, a corner broken off
    each(b, poly([[sx - 18, sy - 14], [sx - 6, sy - 17], [sx - 11, sy - 4]]), (i, j) => { b.p[j * b.w + i] = null; });
  }
  outline(b);
  return b;
}

// the lower hind leg: thick fur with a rounded steel greave on the front and a piston behind, from the ankle up
// under the haunch
function buildShin() {
  const [ax, ay] = AN[0], b = buf(ax - 15, ay - 48, 30, 52);
  const leg = cap(KN[0][0] + 1, KN[0][1] - 8, ax, ay + 2, 11.5, 9);
  paint(b, cap(ax + 9, ay - 38, ax + 8, ay - 6, 1.6), [M2, M4, M5], 1, 1);                       // piston rod
  paint(b, ell(ax + 9, ay - 39, 2.6, 2.6), [C1, C2, C3], 1, 1);
  paint(b, leg, [B1, B2, B3], 2, 1);
  strokes(b, leg, 24, B3, B2, 141); strokes(b, leg, 12, B1, B2, 143);
  const pl = both(leg, ell(ax - 7, ay - 22, 6.5, 11.5));
  paint(b, pl, [M1, M3, M4], 2, 1);
  paint(b, both(pl, cap(ax - 10, ay - 29, ax - 10, ay - 16, 0.7)), M5, 0, 0);                       // shine
  edge(b, pl, OUT);
  rivet(b, ax - 6, ay - 30, M5, M1); rivet(b, ax - 6, ay - 15, M5, M1);
  fur(b, both(leg, (x, y) => !pl(x, y)), ax - 10, ax + 9, ay - 5, 3, 3, B1);                       // fringe at the ankle
  outline(b);
  return b;
}

function buildFoot() {
  const [ax, ay] = AN[0], b = buf(ax - 30, ay - 10, 52, 24);
  const ft = any(ell(ax - 3, ay + 7, 21, 7), ell(ax + 2, ay + 2, 11, 7));
  paint(b, ft, [B1, B2, B3], 2, 1);
  strokes(b, ft, 14, B3, B2, 151);
  paint(b, both(ft, (x, y) => y > ay + 10), [M1, M2, M2], 1, 0);
  paint(b, ell(ax + 2, ay, 5, 4), [M1, M3, M4], 1, 1); dot(b, ax + 1, ay - 1, M5);               // ankle bolt
  for (let k = 0; k < 3; k++) {
    const x = ax - 20 + k * 4, top = ay + 4 + k;
    paint(b, poly([[x + 2, top], [x + 5, top + 2], [x - 2, ay + 12], [x - 7, ay + 13], [x - 5, ay + 10]]), [M2, M4, M5], 1, 1);
  }
  outline(b);
  return b;
}

function buildRock(seed) {
  const b = buf(-8, -7, 16, 14);
  const r = any(ell(0, 0, 6.5, 5.5), ell(-1, -1, 5.5, 5.5), ell(1.5, 0.5, 5, 5));
  paint(b, r, [GR1, GR2, GR3], 2, 1);
  for (let k = 0; k < 9; k++) { const x = -6 + Math.floor(hsh(seed + k) * 12), y = -5 + Math.floor(hsh(seed + k * 3.3) * 10); if (r(x + 0.5, y + 0.5)) dot(b, x, y, k % 3 ? GR1 : GR4); }
  dot(b, -3, -3, GR4); dot(b, -2, -4, GR4);
  dot(b, 1, -1, GR1); dot(b, 2, 0, GR1); dot(b, 2, 1, GR1);
  outline(b);
  return b;
}

function buildPlate(w, h, pal, seed) {
  const b = buf(0, 0, w + 2, h + 2);
  const f = poly([[1, 1 + hsh(seed) * 2], [w + 1, 1], [w + 1 - hsh(seed + 1) * 3, h + 1], [1, h + 1]]);
  paint(b, f, pal, 1, 1);
  rivet(b, 2, 3, M4, B0); rivet(b, w - 2, 3, M4, B0);
  outline(b);
  return b;
}

// a piece of a painted part (its pixels inside f), trimmed and outlined again: the wreck breaks into these
function piece(src, f) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const has = (i, j) => { const v = src.p[j * src.w + i]; return v && v !== OUT; };
  each(src, f, (i, j) => { if (has(i, j)) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); } });
  const b = buf(src.x0 + x0 - 1, src.y0 + y0 - 1, x1 - x0 + 3, y1 - y0 + 3);
  each(src, f, (i, j) => { if (has(i, j)) b.p[(j - y0 + 1) * b.w + (i - x0 + 1)] = src.p[j * src.w + i]; });
  outline(b);
  return { s: debrisSprite(b), cx: b.x0 + b.w / 2, by: b.y0 + b.h };
}
const TORSO2 = buildTorso(true);
const SPR = {
  torso: sprite(buildTorso(false)), torso2: sprite(TORSO2),
  head: sprite(buildHead()), jaw: sprite(buildJaw()),
  upper: sprite(buildUpperArm()), fore: sprite(buildForearm()), paw: sprite(buildPaw()),
  upperF: null, foreF: null, pawF: null,
  paul: sprite(buildPauldron(false)), paul2: sprite(buildPauldron(true)),
  shin: sprite(buildShin()), foot: sprite(buildFoot()), shinF: null, footF: null,
  rocks: []
};
SPR.upperF = sprite(buildUpperArm(), 0.38); SPR.foreF = sprite(buildForearm(), 0.38); SPR.pawF = sprite(buildPaw(), 0.38);
SPR.shinF = sprite(buildShin(), 0.38); SPR.footF = sprite(buildFoot(), 0.38);
{ let r = buildRock(3); for (let i = 0; i < 4; i++) { SPR.rocks.push(sprite(r)); r = rot90(r); } }
const BITS = {
  head: debrisSprite(buildHead()), jaw: debrisSprite(buildJaw()), paw: debrisSprite(buildPaw()), paul: debrisSprite(buildPauldron(false)),
  hatch: debrisSprite((() => { const b = buf(-10, -10, 20, 20); paint(b, ell(0, 0, 8.5, 8.5), [B1, B2, B3], 1, 1); paint(b, rect(-7, -1, 14, 2), M0, 0, 0); rivet(b, -1, -5, B4, B0); outline(b); return b; })()),
  plates: [buildPlate(12, 8, [B1, B2, B3], 1), buildPlate(9, 7, [B1, B2, B4], 2), buildPlate(8, 6, [M1, M2, M3], 3), buildPlate(11, 6, [B1, B3, B4], 4)].map(debrisSprite),
  pipe: debrisSprite((() => { const b = buf(-4, -14, 9, 18); pipe(b, 0, 2, 0, -11); outline(b); return b; })()),
  // the wreck at the final boom: haunch, back plates, chest, belly, and the limbs
  chunks: [ell(30, -60, 20.5, 20.5), rect(-42, -130, 36, 30), rect(-6, -126, 44, 30), rect(38, -104, 30, 34), rect(-66, -80, 36, 34), rect(-24, -58, 46, 22)].map(f => piece(TORSO2, f)),
  limbs: [buildShin(), buildFoot(), buildForearm(), buildUpperArm()].map(debrisSprite)
};

// ============================================================
// Pose: where every part is at this moment (pure: draw code calls it too, so no rand() here)
// ============================================================
const sstep = t => t * t * (3 - 2 * t);
// keyframes [[st, value(s)], ...], smooth between keys; a key's third entry 'in' / 'out' changes its easing
function kf(st, keys) {
  if (st <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (st > keys[i][0]) continue;
    const [a, va] = keys[i - 1], [b, vb, ez] = keys[i], t = (st - a) / (b - a);
    const s = ez === 'in' ? t * t * t : ez === 'out' ? 1 - (1 - t) ** 3 : sstep(t);
    return Array.isArray(va) ? va.map((v, k) => v + (vb[k] - v) * s) : va + (vb - va) * s;
  }
  return keys[keys.length - 1][1];
}
const lerp = (a, b, k) => a + (b - a) * k;

// walking: each foot plants for 62% of its cycle and swings forward for the rest (stride e.stride)
function feet(e) {
  const out = [];
  for (const off of [0.5, 0, 0, 0.5]) {        // near paw, far paw, near foot, far foot
    const u = ((e.gait + off) % 1 + 1) % 1, s = e.stride;
    let dx, lift = 0;
    if (u < 0.62) dx = s * (u / 0.62 - 0.5);
    else { const k = (u - 0.62) / 0.38; dx = s * (0.5 - k); lift = Math.sin(k * Math.PI) * (3 + s * 0.12); }
    out.push([dx * e.walk, lift * e.walk]);
  }
  return out;
}

// two-bone arm: shoulder s, target t -> elbow, wrist and the bone angles (the elbow bends back)
function ik(s, t) {
  let dx = t[0] - s[0], dy = t[1] - s[1], d = Math.hypot(dx, dy);
  const mx = UA + FA - 0.5, mn = Math.abs(UA - FA) + 6;
  if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; } else if (d < mn) { dx *= mn / d; dy *= mn / d; d = mn; }
  const base = Math.atan2(dy, dx), A = Math.acos(clamp((UA * UA + d * d - FA * FA) / (2 * UA * d), -1, 1));
  const a1 = base - A, el = [s[0] + Math.cos(a1) * UA, s[1] + Math.sin(a1) * UA], wr = [s[0] + dx, s[1] + dy];
  return { s, el, wr, a1, a2: Math.atan2(wr[1] - el[1], wr[0] - el[0]) };
}

// laser lanes: the hero ducks under HIGH (hurts y-3..y+3: a standing hero's head, never a crouching one's, top -24)
// and jumps over LOW (hurts y-4..y+4); th = how far the front dips, y = the lane (bear-local)
const LANES = { high: { th: -0.2, y: -30 }, low: { th: -0.36, y: -8 } };
const AIM = 54, PULSE = 5, PLEN = 36;    // aim-line frames; LOW pulse speed (px/frame) and length
// the body drop that puts the core on a lane's height for a given dip
const laneDrop = (ln, th) => ln.y - (HIP[1] + (CORE[0] - HIP[0]) * Math.sin(th) + (CORE[1] - HIP[1]) * Math.cos(th));

function rig(e) {
  const st = e.st, s = e.state;
  let bx = 0, by = 0, th = 0, ht = 0, hy = 0, jaw = 0, eye = 0;
  const br = e.state === 'dying' ? 0 : Math.round(Math.sin(e.t * 0.055) * 1.2);   // breathing: torso and head only
  const g = feet(e);
  by -= Math.round(e.walk * Math.abs(Math.sin(e.gait * Math.PI * 2)) * 1.5);
  const plant = [[WR[0][0] + g[0][0], WR[0][1] - g[0][1]], [WR[1][0] + g[1][0], WR[1][1] - g[1][1]]];
  const an = [[AN[0][0] + g[2][0], AN[0][1] - g[2][1]], [AN[1][0] + g[3][0], AN[1][1] - g[3][1]]];
  let act = [null, null], pa = [0, 0], smear = null, glint = 0;
  const roarPose = (r, len) => { th = kf(r, [[0, 0], [14, 0.14], [len, 0.14], [len + 20, 0]]); ht = kf(r, [[0, 0], [14, 0.42], [len, 0.36], [len + 20, 0]]); jaw = kf(r, [[0, 0], [12, 1], [len, 1], [len + 16, 0]]); };
  switch (s) {
    case 'intro':
      if (e.arrived) roarPose(st - e.arrived - 6, 56);
      break;
    case 'idle':
      if (e.t % 260 < 22) jaw = Math.sin((e.t % 260) / 22 * Math.PI) * 0.18;        // a huff now and then
      break;
    case 'toss': {
      th = kf(st, [[0, 0], [14, -0.1], [34, 0.12], [40, 0.16], [48, -0.06, 'in'], [70, 0]]);
      eye = st < 40 ? 1 : 0;
      jaw = kf(st, [[0, 0], [12, 0.3], [20, 0], [38, 0.2], [44, 0.6], [60, 0]]);
      const k = kf(st, [[0, 0], [10, 1], [62, 1], [78, 0]]);
      act[0] = sh => {
        const reach = [-88, -14], over = [sh[0] + 4, sh[1] - 66], back = [sh[0] + 22, sh[1] - 60], fwd = [sh[0] - 66, sh[1] - 18];
        const w = st < 14 ? reach : st < 34 ? kf(st, [[14, reach], [34, over]]) : st < 40 ? kf(st, [[34, over], [40, back]]) : kf(st, [[40, back], [47, fwd, 'out'], [62, fwd]]);
        return [w, k];
      };
      pa[0] = kf(st, [[0, 0], [12, 0.5], [30, -1.6], [40, -2.2], [47, -0.6], [70, 0]]);
      break;
    }
    case 'pound': {
      th = kf(st, [[0, 0], [30, 0.62, 'out'], [46, 0.66], [54, -0.12, 'in'], [80, 0]]);
      by += Math.round(kf(st, [[0, 0], [30, -4], [46, -4], [54, 3], [62, 0]]));
      ht = -th * 0.55;
      eye = th > 0.3 ? 1 : 0;
      jaw = th > 0.3 ? 0.7 : 0;
      // up on its hind legs, both paws out in front of the chest with the claws showing (trembling), then down hard
      const top = th > 0.55, k = th > 0 ? clamp(th / 0.42, 0, 1) : 0;
      for (let i = 0; i < 2; i++) {
        const tr = top ? Math.round(Math.sin(st * 1.3 + i * 2)) : 0;
        act[i] = sh => [[sh[0] - 50 + i * 12 + tr, sh[1] + 14 - i * 12 + (top ? Math.abs(tr) : 0)], k];
        pa[i] = 0.75 * k;
      }
      glint = top ? 2 : 0;
      break;
    }
    case 'swipe': {
      // the paw goes up and back (0-24), holds with the claws glinting (24-44), then sweeps down in front (44-52)
      bx = kf(st, [[0, 0], [34, 6], [44, 6], [49, -26, 'out'], [60, -26], [78, 0]]);
      th = kf(st, [[0, 0], [34, 0.12], [44, 0.12], [50, -0.08], [60, -0.06], [78, 0]]);
      by += Math.round(kf(st, [[0, 0], [34, -2], [50, 2], [78, 0]]));
      eye = st < 46 ? 1 : 0;
      jaw = kf(st, [[0, 0], [20, 0.4], [46, 0.8], [56, 0.5], [72, 0]]);
      const phi = kf(st, [[0, -0.9], [34, -0.6], [44, -0.55], [52, -3.95, 'out'], [62, -4.0]]);
      const k = kf(st, [[0, 0], [12, 1], [62, 1], [76, 0]]);
      act[0] = sh => [[sh[0] + Math.cos(phi) * 64, sh[1] + Math.sin(phi) * 64], k];
      pa[0] = kf(st, [[0, 0], [34, -2.4], [44, -2.4], [52, 0.3], [62, 0.1], [76, 0]]);
      if (st >= 44 && st < 60) smear = { a0: -0.55, a1: phi, r: 78, t: st - 44 };
      glint = st >= 22 && st < 44 ? 1 : 0;
      break;
    }
    case 'laser': {
      const ln = LANES[e.lane], end = e.beamEnd || 999, k = kf(st, [[0, 0], [20, 1], [end, 1], [end + 20, 0]]);
      th = ln.th * k; by += Math.round(laneDrop(ln, ln.th) * k); bx = 8 * k;
      ht = -th * 0.8;
      eye = st < AIM ? 1 : 0;
      jaw = st >= AIM && st < end ? 0.35 : st > AIM - 16 && st < AIM ? 0.15 : 0;
      if (st >= AIM && st < end) bx += 2 + Math.round(Math.sin(st * 1.7));     // recoil shudder
      break;
    }
    case 'roar': roarPose(st, 50); eye = 1; break;
    case 'phase2':
      if (st < 24) { bx = Math.round((hsh(st * 1.3) - 0.5) * 4); th = (hsh(st * 2.1) - 0.5) * 0.06; jaw = 0.3; }
      else roarPose(st - 24, 46);
      eye = 1;
      break;
    case 'dying':
      bx = Math.round((hsh(e.t * 1.7) - 0.5) * 4); by += Math.min(16, Math.floor(st / 9));
      th = -Math.min(0.16, st * 0.002); ht = -Math.min(0.3, st * 0.004); jaw = 0.55 + Math.sin(st * 0.3) * 0.1;
      break;
  }
  // joints
  const hip = [HIP[0] + bx, HIP[1] + by], c = Math.cos(th), sn = Math.sin(th);
  const T = q => [hip[0] + (q[0] - HIP[0]) * c - (q[1] - HIP[1]) * sn, hip[1] + (q[0] - HIP[0]) * sn + (q[1] - HIP[1]) * c];
  const sh = SH.map(T);
  const arms = [0, 1].map(i => {
    let t = plant[i];
    if (act[i]) { const [a, k] = act[i](sh[i]); t = [lerp(t[0], a[0], k), lerp(t[1], a[1], k)]; }
    return ik(sh[i], t);
  });
  const neck = T(NECK); neck[1] += hy;
  const ha = th + ht, hc = Math.cos(ha), hs = Math.sin(ha);
  const H = q => [neck[0] + (q[0] - NECK[0]) * hc - (q[1] - NECK[1]) * hs, neck[1] + (q[0] - NECK[0]) * hs + (q[1] - NECK[1]) * hc];
  const pawAt = i => { const a = arms[i], r = [-8, -2], q = Math.cos(pa[i]), w = Math.sin(pa[i]); return [a.wr[0] + r[0] * q - r[1] * w, a.wr[1] + r[0] * w + r[1] * q]; };
  const clawAt = i => { const a = arms[i], q = Math.cos(pa[i]), w = Math.sin(pa[i]); return [a.wr[0] - 17 * q - 13 * w, a.wr[1] - 17 * w + 13 * q]; };
  return {
    bx, by, br, th, ht, jaw, eye, pa, hip, T, H, neck, ha, sh, arms, an, smear, glint,
    knees: KN.map(T), core: T(CORE), light: T(LIGHT), pipes: PIPES.map(T), mouth: H([-102, -72]), pawN: pawAt(0), claws: [clawAt(0), clawAt(1)]
  };
}

// ============================================================
// Drawing
// ============================================================
// sprite s with its rest point (ax, ay) placed at (x, y), turned by ang (0 = as painted, pixel-exact)
function part(s, x, y, ang, ax, ay) {
  const img = FLASH ? s.white : s.img;
  if (Math.abs(ang) < 0.03) { ctx.drawImage(img, Math.round(x + s.x0 - ax), Math.round(y + s.y0 - ay)); return; }
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(ang);
  ctx.drawImage(img, s.x0 - ax, s.y0 - ay);
  ctx.restore();
}
// a pixel disc (crisp, no anti-aliasing)
function disc(x, y, r, col) {
  for (let j = -r; j <= r; j++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - j * j))); R(Math.round(x) - w, Math.round(y) + j, w * 2 + 1, 1, col); }
}

function drawArm(P, i) {
  const a = P.arms[i], f = i === 1;
  part(f ? SPR.upperF : SPR.upper, a.s[0], a.s[1], a.a1 - UA0, SH[0][0], SH[0][1]);
  part(f ? SPR.foreF : SPR.fore, a.el[0], a.el[1], a.a2 - FA0, EL[0][0], EL[0][1]);
  part(f ? SPR.pawF : SPR.paw, a.wr[0], a.wr[1], P.pa[i], WR[0][0], WR[0][1]);
}
function drawLeg(P, i) {
  // the shin leans toward the knee, but never so far that its top pokes out behind the haunch (crouched poses)
  const k = P.knees[i], a = P.an[i], f = i === 1, ang = clamp(Math.atan2(a[1] - k[1], a[0] - k[0]) - SHIN0, -0.28, 0.28);
  part(f ? SPR.shinF : SPR.shin, a[0], a[1], ang, AN[0][0], AN[0][1]);
  part(f ? SPR.footF : SPR.foot, a[0], a[1], 0, AN[0][0], AN[0][1]);
}

const eyeCol = (e, P) => e.state === 'dying' ? (e.t % 6 < 3 ? '#5a1a1a' : '#ff6a50') : P.eye && e.t % 8 < 5 ? '#ffffff' : e.ph2 ? '#ff2a20' : '#ffd23f';
function drawHead(e, P) {
  if (e.lost.head) return;
  ctx.save(); ctx.translate(Math.round(P.neck[0]), Math.round(P.neck[1]) + P.br);
  if (Math.abs(P.ha) >= 0.03) ctx.rotate(P.ha);
  const ox = -NECK[0], oy = -NECK[1];
  // mouth: dark inside, a glow in the throat, then the jaw swung open around its hinge
  const ja = -P.jaw * 0.55;
  if (P.jaw > 0.05) {
    ctx.fillStyle = FLASH ? '#ffffff' : MOUTH;
    const c = Math.cos(ja), s = Math.sin(ja), jx = JAWH[0] + ox, jy = JAWH[1] + oy;
    const fx = -104 - JAWH[0], fy = -74 - JAWH[1];
    ctx.beginPath(); ctx.moveTo(jx, jy - 3); ctx.lineTo(-104 + ox, -71 + oy); ctx.lineTo(jx + fx * c - fy * s, jy + fx * s + fy * c); ctx.closePath(); ctx.fill();
    if (!FLASH) { ctx.fillStyle = e.ph2 ? 'rgba(255,60,40,0.5)' : 'rgba(255,200,80,0.45)'; circ(jx - 10, jy, 3 + P.jaw * 3); }
  }
  part(SPR.head, ox + NECK[0], oy + NECK[1], 0, NECK[0], NECK[1]);
  part(SPR.jaw, JAWH[0] + ox, JAWH[1] + oy, ja, JAWH[0], JAWH[1]);
  // eyes: glowing slits, a blink now and then (amber, deep red in phase 2, white flashes when it winds up)
  const blink = e.state === 'idle' && e.t % 230 < 5;
  if (!blink) {
    const col = eyeCol(e, P);
    R(-77 + ox, -96 + oy, 11, 2, col); R(-77 + ox, -94 + oy, 9, 1, col); R(-94 + ox, -92 + oy, 7, 2, col);
    if (!FLASH) { R(-71 + ox, -97 + oy, 3, 1, '#ffffff'); R(-90 + ox, -93 + oy, 2, 1, '#ffffff'); }
    if (!FLASH && (e.ph2 || P.eye)) { ctx.fillStyle = e.ph2 ? 'rgba(255,40,30,0.3)' : 'rgba(255,230,120,0.32)'; circ(-72 + ox, -95 + oy, 7); circ(-90 + ox, -91 + oy, 5); }
  } else { R(-78 + ox, -95 + oy, 12, 1, B0); R(-95 + ox, -91 + oy, 8, 1, B0); }
  // a glint sweeping along the visor now and then
  const sw = e.t % 170;
  if (!FLASH && sw < 16 && e.state !== 'dying') {
    const x = -58 - sw * 2.7, sn = (cx, cy, rx, ry) => Math.abs(x - cx) < rx ? cy - ry * Math.sqrt(1 - ((x - cx) / rx) ** 2) : 0;
    const top = Math.round(-94 + (x + 101) * -8 / 45), bot = Math.round(Math.min(-84 + (x + 99) * -4 / 43, sn(-90, -80, 18, 10), sn(-78, -84, 10, 8)));
    if (bot - top > 3) { R(Math.round(x) + ox, top + 1 + oy, 1, bot - top - 1, 'rgba(255,255,255,0.45)'); R(Math.round(x) + 1 + ox, top + 2 + oy, 1, bot - top - 3, 'rgba(255,255,255,0.25)'); }
  }
  ctx.restore();
}

function drawTorso(e, P) {
  const s = e.ph2 ? SPR.torso2 : SPR.torso;
  ctx.save(); ctx.translate(Math.round(P.hip[0]), Math.round(P.hip[1]) + P.br);
  if (Math.abs(P.th) >= 0.03) ctx.rotate(P.th);
  ctx.drawImage(FLASH ? s.white : s.img, s.x0 - HIP[0], s.y0 - HIP[1]);
  const cx = CORE[0] - HIP[0], cy = CORE[1] - HIP[1];
  if (!FLASH) {
    // warning light on the hump
    R(LIGHT[0] - HIP[0] - 1, LIGHT[1] - HIP[1] - 1, 3, 2, e.t % 40 < 20 ? EVIL : '#5a1a1a');
    if (!e.ph2) {
      // the glow leaking through the hatch slit
      const k = 0.6 + Math.sin(e.t * 0.12) * 0.4;
      R(cx - 6, cy - 1, 13, 1, k > 0.5 ? K3 : K2); R(cx - 4, cy - 1, 9, 1, k > 0.8 ? K4 : K3);
    } else {
      // the exposed core: pulsing rings of light (brighter while the laser charges)
      const ch = e.state === 'laser' ? clamp(e.st / 50, 0, 1) : 0, pul = Math.sin(e.t * 0.2);
      if (e.state !== 'dying') { ctx.fillStyle = 'rgba(80,220,255,' + (0.18 + ch * 0.3).toFixed(2) + ')'; circ(cx, cy, 11 + ch * 6 + pul); }
      disc(cx, cy, 7, K1); disc(cx, cy, 6 + Math.round(pul * 0.6 + ch), K2); disc(cx, cy, 4 + Math.round(ch * 2), K3); disc(cx - 1, cy - 1, 1 + Math.round(ch * 2), K4);
      // a torn cable swinging out of the hole, sparking at its end
      const sw = Math.sin(e.t * 0.09) * 3, cx0 = -8 - HIP[0], cy0 = -99 - HIP[1];
      for (let i = 0; i < 9; i++) R(Math.round(cx0 - 2 + sw * i / 9), cy0 + i, 2, 1, i % 3 ? M0 : '#3b3f46');
      if (e.t % 9 < 4) { R(Math.round(cx0 - 3 + sw), cy0 + 9, 3, 2, K4); R(Math.round(cx0 - 2 + sw), cy0 + 11, 1, 1, '#ffffff'); }
      // electric arcs over the torn plate
      if (e.state !== 'dying' && hsh(Math.floor(e.t / 3) * 0.37) > 0.55) {
        const ax = -36 - HIP[0] + Math.floor(hsh(e.t * 0.11) * 26), ay = -108 - HIP[1];
        for (let i = 0; i < 6; i++) R(ax + i, ay + Math.round((hsh(e.t + i) - 0.5) * 6), 1, 2, i % 2 ? K3 : K4);
      }
    }
  }
  ctx.restore();
}

// a 4-point twinkle (claw glints)
function twinkle(x, y, s) {
  x = Math.round(x); y = Math.round(y);
  R(x - s, y, s * 2 + 1, 1, '#fff6c8'); R(x, y - s, 1, s * 2 + 1, '#fff6c8');
  if (s > 2) R(x - 1, y - 1, 3, 3, '#ffffff');
}

// its shadow on the grass: a flat pixel ellipse just under the ground line
function drawShadow(e) {
  const k = e.state === 'dying' ? clamp(1 - e.st / 160, 0.25, 1) : 1;
  ctx.fillStyle = 'rgba(22,16,28,' + (0.3 * k).toFixed(2) + ')';
  for (let j = 0; j < 4; j++) { const w = Math.round(84 * Math.sqrt(1 - ((j + 0.5) / 4.2) ** 2)); ctx.fillRect(-18 - w, j, w * 2, 1); }
  ctx.fillStyle = 'rgba(22,16,28,' + (0.18 * k).toFixed(2) + ')';
  for (let j = 0; j < 2; j++) { const w = Math.round(60 - j * 14); ctx.fillRect(-18 - w, j, w * 2, 1); }
}

function drawBearFx(e, P) {
  // pound and swipe: the raised claws glint
  for (let i = 0; i < P.glint; i++) { const c = P.claws[i]; twinkle(c[0], c[1], i ? 2 : 2 + ((G.t >> 2) % 3)); }
  // swipe: three claw trails following the paw's arc
  const sm = P.smear;
  if (sm) {
    const al = Math.max(0, 1 - sm.t / 16);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (al * (0.9 - i * 0.22)).toFixed(2) + ')'; ctx.lineWidth = 3 - i;
      ctx.beginPath(); ctx.arc(P.sh[0][0], P.sh[0][1], sm.r - 8 + i * 8, Math.min(sm.a0, sm.a1), Math.max(sm.a0, sm.a1)); ctx.stroke();
    }
  }
  // roar: rings out of the mouth and a big comic ROAR!
  for (const r of e.rings) {
    const k = r.t / 30;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - k)).toFixed(2) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(P.mouth[0] - r.t * 2, P.mouth[1], 6 + r.t * 3, 4 + r.t * 2.2, 0, Math.PI * 0.55, Math.PI * 1.45); ctx.stroke();
  }
  if (e.roarT > 0) {
    const j = Math.round((hsh(e.t * 0.7) - 0.5) * 3);
    text('ROAR!', P.mouth[0] - 34 + j, P.mouth[1] - 40 + j, e.ph2 ? '#ff6a50' : '#ffe066', 2, 'center', '#3a1200');
  }
}

function drawBear(e) {
  const P = e.P || rig(e);
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y));
  drawShadow(e);
  // hits flash it white for 2 frames, at most every 24 (a flash per hit strobes at the H.M.G.'s 15 shots a second)
  if (e.hitT >= 3 && G.t - (e.flashAt ?? -99) >= 24) e.flashAt = G.t;
  FLASH = G.t - (e.flashAt ?? -99) < 2;
  drawLeg(P, 1);
  if (!e.lost.pawF) drawArm(P, 1);
  drawLeg(P, 0);
  drawTorso(e, P);
  drawHead(e, P);
  if (!e.lost.pawN) drawArm(P, 0);
  if (!e.lost.paul) part(e.ph2 ? SPR.paul2 : SPR.paul, P.sh[0][0], P.sh[0][1] + P.br, P.th, SH[0][0], SH[0][1]);
  FLASH = false;
  drawBearFx(e, P);
  ctx.restore();
}

// ============================================================
// Sounds
// ============================================================
const sfx = {
  roar(big) { Snd.noise(big ? 1.6 : 1.1, 0.45, 700); Snd.tone('sawtooth', 160, 52, big ? 1.4 : 1, 0.22); Snd.tone('square', 98, 40, big ? 1.3 : 0.9, 0.1); Snd.tone('sawtooth', 240, 90, 0.6, 0.06, 0.1); },
  thud(v = 1) { Snd.tone('sine', 90, 32, 0.3, 0.35 * v); Snd.noise(0.18, 0.18 * v, 380); Snd.tone('square', 160, 80, 0.14, 0.13 * v); Snd.noise(0.16, 0.3 * v, 1200); },
  grunt() { Snd.tone('sawtooth', 260, 150, 0.3, 0.25); Snd.tone('square', 130, 80, 0.28, 0.08); Snd.noise(0.22, 0.22, 1600); },
  whoosh() { Snd.noise(0.28, 0.28, 3200); Snd.tone('triangle', 520, 160, 0.22, 0.08); },
  growl() { for (let i = 0; i < 4; i++) Snd.tone('sawtooth', 184 + i * 12, 140, 0.16, 0.24, i * 0.12); },
  glint() { Snd.tone('triangle', 2400, 3200, 0.08, 0.06); },
  rise() { Snd.tone('sawtooth', 120, 420, 0.5, 0.2); Snd.noise(0.5, 0.18, 1400); },
  charge() { Snd.tone('square', 180, 1400, 0.85, 0.05); Snd.tone('sine', 90, 520, 0.85, 0.12); },
  beam() { Snd.tone('sawtooth', 120, 104, 0.75, 0.14); Snd.tone('square', 940, 880, 0.7, 0.035); Snd.noise(0.7, 0.18, 6000); },
  hum() { Snd.tone('sawtooth', 112, 108, 0.42, 0.08); Snd.tone('sine', 880, 860, 0.4, 0.03); },
  whine() { Snd.tone('triangle', 600, 2200, 0.24, 0.13); },
  ding() { Snd.tone('square', 1320, 1320, 0.07, 0.07); Snd.tone('square', 1760, 1760, 0.1, 0.07, 0.08); },
  crack() { [1500, 1100, 800].forEach((f, i) => Snd.tone('square', f, f * 0.45, 0.1, 0.09, i * 0.05)); Snd.noise(0.35, 0.4, 3500); },
  ping() { Snd.tone('triangle', 1700, 1250, 0.07, 0.08); },
  rumble() { Snd.noise(0.6, 0.35, 220); Snd.tone('sine', 55, 30, 0.6, 0.3); Snd.noise(0.6, 0.3, 800); Snd.tone('sawtooth', 80, 50, 0.6, 0.08); }
};

// ============================================================
// Behaviour
// ============================================================
const wolvesAlive = () => G.enemies.filter(w => w.type === 'wolf' && !w.dead && !w.dying && w.state !== 'dying').length;
function go(e, s) { e.state = s; e.st = 0; }
function toIdle(e) {
  if (!e.ph2 && e.hp < e.max / 2) { go(e, 'phase2'); e.inv = true; return; }
  go(e, 'idle');
  // a breather between attacks (about 2.4 s, 1.9 s in phase 2: time for a child to read the next telegraph): longer
  // while its wolves run about, and after the hero got hit (a moment to recover)
  e.rest = Math.round(e.ph2 ? rand(106, 120) : rand(136, 150)) + (wolvesAlive() ? 30 : 0) + (G.p.inv > 0 || G.p.dead ? 45 : 0);
  // prowl to a new spot, but never walk up to the hero: the swipe is only for heroes who come close themselves
  const L = e.ax;
  e.tx = Math.min(L + 452, Math.max(L + rand(360, 430), G.p.x + REACH + 8));
}
function nextAttack(e) {
  const p = G.p;
  if (!p.dead && !p.ride && p.x > e.x - REACH + 4 && e.last !== 'swipe') return 'swipe';
  const seq = e.ph2 ? ['laser', 'roar', 'pound', 'toss', 'pound', 'laser', 'toss', 'pound', 'toss', 'pound'] : ['toss', 'pound'];
  let a = seq[e.atk % seq.length];
  // no laser while wolves run about (ducking under it with a wolf at your heels isn't fair): it waits its turn
  if (a === 'laser' && wolvesAlive()) return e.last === 'pound' ? 'toss' : 'pound';
  e.atk++;
  if (a === 'roar' && (wolvesAlive() >= 2 || !ENEMY_TYPES.wolf)) a = 'toss';
  if (a === 'laser') e.lane = e.lasers++ % 2 ? 'low' : 'high';
  return a;
}

function dustAt(x, n, s = 1) {
  const gy = groundAt(x);
  for (let i = 0; i < n; i++) G.parts.push({ type: 'dust', x: x + rand(-6, 6) * s, y: gy - rand(0, 4), vx: rand(-1.4, 1.4) * s, vy: rand(-0.9, -0.2), life: rand(22, 36), max: 36, size: rand(3, 5) * s });
}
function earth(x, n) {
  const gy = groundAt(x);
  for (let i = 0; i < n; i++) G.parts.push({ type: 'debris', x: x + rand(-8, 8), y: gy - 2, vx: rand(-2, 2), vy: rand(-3.6, -1.2), g: 0.22, life: rand(30, 50), max: 50, size: rand(2, 3) | 0, c: i % 3 ? '#6b4a2e' : '#4f8a3a' });
}
function fly(s, x, y, vx, vy, vr, life = 120) {
  G.parts.push({ type: 'sprite', s, x, y, vx, vy, g: 0.22, rot: 0, vr, life, max: life });
}

function slam(e) {
  const x = e.x - 84;
  G.shake = Math.max(G.shake, 9);
  Snd.boom(true); sfx.thud(1.4);
  dustAt(x, 14, 1.4); dustAt(e.x - 64, 8, 1.2); earth(x, 12);
  G.treeShake = Math.max(G.treeShake || 0, 26);
  G.eb.push({ k: 'mbwave', x: x - 6, y: groundAt(x) - 3, vx: e.ph2 ? -2.9 : -2.5, vy: 0, life: 230, t: 0 });   // faster in phase 2
}

function callWolves(e) {
  const n = Math.min(2, 3 - wolvesAlive());
  for (let i = 0; i < n; i++) {
    const side = i === 0 ? -1 : 1, w = makeEnemy({ t: 'wolf', x: side < 0 ? G.cam.x - 18 : G.cam.x + W + 18, side });
    if (w.dead) continue;
    w.active = true; w.facing = -side;
    G.enemies.push(w); e.pups.push(w);
  }
}

function burst(e, P) {
  // phase 2: plates and the chest hatch blow off, the core shows
  const T = P.T;
  const c = T(CORE), hm = T([-20, -108]);
  boom(e.x + c[0], e.y + c[1], 0.9);
  sparks(e.x + c[0], e.y + c[1], 14, K3); sparks(e.x + hm[0], e.y + hm[1], 12);
  fly(BITS.hatch, e.x + c[0], e.y + c[1], -2.2, -4.2, -0.3, 140);
  BITS.plates.forEach((s, i) => fly(s, e.x + hm[0] + i * 6 - 8, e.y + hm[1], rand(-2.4, 2.2), rand(-5, -3), rand(-0.4, 0.4), 130));
  G.sflash = Math.max(G.sflash, 0.35); G.shake = Math.max(G.shake, 10);
  sfx.crack();
}

function stepIntro(e) {
  const st = e.st, L = e.ax;
  if (st === 1) { G.treeShake = Math.max(G.treeShake || 0, 90); sfx.rumble(); }
  if (st < 64) {
    // tremors before it shows up: the ground shakes harder and harder
    if (st % 16 === 1) {
      G.shake = Math.max(G.shake, 1.5 + st / 20); sfx.thud(0.4 + st / 80);
      for (let i = 0; i < 4; i++) dustAt(L + rand(20, W - 20), 2, 0.8);
    }
    return;
  }
  if (st === 64) {
    G.treeShake = Math.max(G.treeShake || 0, 70);
    for (let i = 0; i < 26; i++) G.parts.push({ type: 'debris', x: L + W + rand(-6, 10), y: e.y - rand(20, 120), vx: rand(-3.2, -0.6), vy: rand(-2.4, 0.6), g: 0.12, life: rand(50, 90), max: 90, size: rand(2, 3) | 0, c: ['#ffc7da', '#ffffff', '#f48fb1', '#6b4a2e', '#4f8a3a'][i % 5] });
    sfx.crack(); sfx.thud(1.2);
  }
  if (!e.arrived) {
    e.x = Math.max(L + 396, e.x - 3.2);
    if (e.x <= L + 396) { e.arrived = st; dustAt(e.x - 70, 10, 1.3); dustAt(e.x + 30, 8, 1.2); sfx.thud(1.2); G.shake = Math.max(G.shake, 6); }
    return;
  }
  const r = st - e.arrived;
  if (r === 8) { sfx.roar(true); say('Mega Bear!', 0.7, 0.9); G.shake = Math.max(G.shake, 10); e.roarT = 56; G.treeShake = Math.max(G.treeShake || 0, 40); }
  if (r >= 8 && r < 60 && r % 9 === 0) e.rings.push({ t: 0 });
  if (r >= 88) { e.inv = false; toIdle(e); e.rest = 100; }    // time to step back from a hero it pushed against the wall
}

function stepIdle(e) {
  if (!e.ph2 && e.hp < e.max / 2) { go(e, 'phase2'); e.inv = true; return; }
  if (Math.abs(e.tx - e.x) > 1) e.x += Math.sign(e.tx - e.x) * (e.ph2 ? 0.8 : 0.55);
  if (e.st >= e.rest) { const a = nextAttack(e); e.last = a; go(e, a); }
}

function stepToss(e) {
  const st = e.st, p = G.p;
  if (st === 1) { e.n = e.ph2 ? 3 : e.tosses++ < 1 ? 1 : 2; sfx.grunt(); }   // rocks this time
  if (st === 14) {
    // the paw digs a cluster of granite out of the ground; rings mark where each one will land
    const px = e.x - 86;
    dustAt(px, 10, 1.1); earth(px, 10); sfx.thud(0.9); G.shake = Math.max(G.shake, 3);
    const L = e.ax, hi = e.x - WALL - 10, base = clamp(p.x, L + 16, hi);
    let xs = e.n === 1 ? [base] : e.n === 2 ? [base, base + (base - 70 < L + 16 ? 70 : -70)] : [base, base - 64, base + 64];
    xs = xs.map(x => clamp(x, L + 16, hi));
    if (e.n === 3 && xs[2] - xs[0] < 24) xs[2] = xs[0] - 46;
    e.rocks = xs.map(tx => { const b = { k: 'mbrock', x: e.x - 90, y: e.y - 20, vx: 0, vy: 0, g: 0, r: 0, life: 600, held: true, tx, t: 0, spin: 0 }; G.eb.push(b); return b; });
  }
  if (st === 41) {
    sfx.whoosh();
    e.rocks.forEach((b, i) => {
      if (b.life <= 0) return;
      const T = 48 + i * 7, gy = groundAt(b.tx);
      b.held = false; b.r = 7; b.g = 0.24;
      b.vx = (b.tx - b.x) / T; b.vy = (gy + 0.5 - b.y - b.g * T * (T - 1) / 2) / T;
      b.spin = i % 2 ? 1 : -1;
    });
  }
  if (st >= 82) toIdle(e);
}

function stepPound(e) {
  const st = e.st;
  if (st === 1) sfx.rise();
  if (st === 30) sfx.growl();
  if (st === 54) slam(e);
  if (st >= 84) toIdle(e);
}

function stepSwipe(e, P) {
  const st = e.st, p = G.p;
  if (st === 1) sfx.growl();
  if (st === 24) sfx.glint();
  if (st === 45) sfx.whoosh();
  if (st >= 45 && st <= 52 && !p.dead) {
    const gy = groundAt(e.x - 120), zone = { x: e.x - REACH, y: gy - 70, w: REACH - WALL + 6, h: 70 };
    if (overlap(zone, pbox(p))) {
      const inv = p.inv;
      hurtPlayer();
      if (p.inv > inv && !p.ride) { p.kb = -5.5; p.vy = -3; }
    }
  }
  if (st === 49) { const pw = P.pawN; sparks(e.x + pw[0], e.y + pw[1], 6, '#ffffff'); }
  if (st >= 80) toIdle(e);
}

// The chest laser. HIGH: after the aim line a long beam shoots across the screen and stays ~45 frames (duck!).
// LOW: a short pulse of light rolls along the ground (jump it!); "JUMP!" lights up ~22 frames before it reaches the
// hero, also before it fires when the hero stands close.
function stepLaser(e, P) {
  const st = e.st, ln = LANES[e.lane], low = e.lane === 'low', p = G.p;
  if (st === 1) {
    sfx.charge();
    e.beam = { ph: 'aim', y: Math.round(e.y + ln.y), tip: 0, tail: 0, src: 0, cue: 0, t: 0 };
    G.eb.push({ k: 'mbbeam', x: e.x - 60, y: e.y - 40, vx: 0, vy: 0, life: 9999, owner: e });
  }
  const bm = e.beam;
  if (!bm) { if (e.beamEnd && st >= e.beamEnd + 22) { e.beamEnd = 0; toIdle(e); } return; }
  const src = e.x + P.core[0] - 4, L = e.ax;
  bm.src = src; bm.t = st;
  if (st < AIM) {
    bm.tip = bm.tail = src;
    // energy flows into the core
    if (st % 2 === 0) { const a = rand(0, Math.PI * 2), d = rand(18, 32); G.parts.push({ type: 'spark', x: e.x + P.core[0] + Math.cos(a) * d, y: e.y + P.core[1] + Math.sin(a) * d, vx: -Math.cos(a) * d / 12, vy: -Math.sin(a) * d / 12, life: 12, max: 12, size: 1, c: st % 4 ? K3 : K4 }); }
    if (st === AIM - 14) sfx.whine();
  } else {
    if (st === AIM) { bm.ph = 'fire'; sfx.beam(); G.sflash = Math.max(G.sflash, 0.2); G.shake = Math.max(G.shake, 4); }
    if (!low) {
      bm.tail = src; bm.tip = Math.max(L - 20, src - (st - AIM) * 14);
      if (st === AIM + 44) bm.ph = 'fade';
      if (st >= AIM + 50) { e.beamEnd = st; e.beam = null; return; }
    } else {
      bm.tip = src - (st - AIM) * PULSE; bm.tail = Math.min(src, bm.tip + PLEN);
      if (bm.tail < L - 10) { e.beamEnd = st; e.beam = null; return; }
    }
    if (bm.ph === 'fire') {
      if ((st - AIM) % 24 === 12) sfx.hum();
      G.shake = Math.max(G.shake, 1.2);
      const r = low ? { x: bm.tip, y: bm.y - 4, w: bm.tail - bm.tip, h: 8 } : { x: bm.tip, y: bm.y - 3, w: bm.tail - bm.tip, h: 6 };
      if (!p.dead && overlap(r, pbox(p))) hurtPlayer();
      // sparks: LOW scorches the ground under the pulse, HIGH showers a few onto the grass below it
      if (low) for (let i = 0; i < 2; i++) { const x = bm.tip + rand(0, 10); G.parts.push({ type: 'spark', x, y: groundAt(x) - 1, vx: rand(-0.8, 1.6), vy: rand(-2.6, -0.8), g: 0.15, life: rand(10, 18), max: 18, size: 1, c: i ? K3 : '#ffffff' }); }
      else if (st % 2 === 0) { const x = rand(Math.max(bm.tip, G.cam.x), bm.tail - 10); G.parts.push({ type: 'spark', x, y: bm.y + 3, vx: rand(-0.6, 0.6), vy: rand(0.2, 1.2), g: 0.15, life: rand(14, 24), max: 24, size: 1, c: st % 6 < 3 ? K3 : K4 }); }
    }
  }
  // the LOW cue: frames until the pulse's front reaches the hero
  if (low && !bm.cue && !p.dead) {
    const arrive = AIM + (src - (p.x + 6)) / PULSE - st;
    if (arrive <= 22) { bm.cue = st; sfx.ding(); }
  }
}

function stepRoar(e) {
  const st = e.st;
  if (st === 16) { sfx.roar(false); e.roarT = 48; G.shake = Math.max(G.shake, 6); G.treeShake = Math.max(G.treeShake || 0, 40); dustAt(e.x - 80, 6, 1.2); }
  if (st >= 16 && st < 60 && st % 9 === 7) e.rings.push({ t: 0 });
  if (st === 26) callWolves(e);
  if (st >= 84) toIdle(e);
}

function stepPhase2(e, P) {
  const st = e.st;
  if (st === 1) sfx.crack();
  if (st < 24 && st % 4 === 0) { const q = P.T([rand(-50, 40), rand(-110, -60)]); sparks(e.x + q[0], e.y + q[1], 5); }
  if (st === 24) { e.ph2 = true; e.atk = 0; burst(e, P); }
  if (st === 30) { sfx.roar(true); e.roarT = 46; G.treeShake = Math.max(G.treeShake || 0, 40); }
  if (st >= 30 && st < 70 && st % 9 === 3) e.rings.push({ t: 0 });
  if (st >= 96) { e.inv = false; toIdle(e); }
}

function stepDying(e, P) {
  const st = e.st, T = P.T;
  G.shake = Math.max(G.shake, 3);
  if (st % 7 === 0 && st < 140) { const q = T([rand(-60, 50), rand(-110, -40)]); boom(e.x + q[0], e.y + q[1], rand(0.6, 1.15)); }
  if (st % 3 === 0) sparks(e.x + rand(-80, 50), e.y - rand(30, 100), 3);
  if (st % 5 === 0) G.parts.push({ type: 'smoke', x: e.x + rand(-40, 40), y: e.y - rand(60, 110), vx: rand(-0.3, 0.3), vy: -0.9, life: 60, max: 60, size: 6 });
  const lose = (k, s, q, vx, vy, vr) => { if (e.lost[k]) return; e.lost[k] = true; fly(s, e.x + q[0], e.y + q[1], vx, vy, vr, 380); };
  if (st === 30) lose('paul', BITS.paul, P.sh[0], -1.6, -4.6, -0.25);
  if (st === 52) { BITS.plates.forEach((s, i) => fly(s, e.x + rand(-30, 30), e.y - rand(70, 100), rand(-2.6, 2.6), rand(-5.5, -3), rand(-0.5, 0.5), 200)); sfx.crack(); }
  if (st === 72) { lose('head', BITS.head, P.neck, -2.4, -6.2, -0.16); sfx.crack(); boom(e.x + P.neck[0], e.y + P.neck[1], 1.2); }
  if (st === 92) { lose('pawN', BITS.paw, P.arms[0].wr, -1.8, -3.8, 0.3); lose('pawF', BITS.paw, P.arms[1].wr, 1.2, -4.4, -0.3); }
  if (st === 104) { const q = P.pipes[0]; fly(BITS.pipe, e.x + q[0], e.y + q[1], 1.6, -5, 0.4, 200); fly(BITS.pipe, e.x + q[0] + 14, e.y + q[1], 2.4, -4.4, -0.5, 200); }
  if (st > 118 && st % 4 === 0) G.sflash = Math.max(G.sflash, 0.12);
  if (st === 150) {
    const c = T([0, -70]);
    boom(e.x + c[0], e.y + c[1], 2.8);
    for (let i = 0; i < 7; i++) G.later.push({ t: 4 + i * 6, x: e.x + rand(-80, 50), y: e.y - rand(10, 90), s: rand(1.2, 1.9) });
    debris(e.x, e.y - 60, 26, B2); debris(e.x, e.y - 60, 16, M3); debris(e.x, e.y - 40, 10, M1);
    // the wreck flies apart: torso chunks, legs and arms tumble out of the blast
    for (const c of BITS.chunks) { const q = T([c.cx, c.by]); fly(c.s, e.x + q[0], e.y + q[1], clamp(c.cx * 0.05, -2.6, 2.6) + rand(-0.5, 0.5), rand(-6.2, -3.6), rand(-0.3, 0.3), 420); }
    BITS.limbs.forEach((s, i) => fly(s, e.x + (i % 2 ? -50 : 24), e.y - 6 - i * 10, (i % 2 ? -1 : 1) * rand(1, 2.4), rand(-5.4, -3.4), rand(-0.4, 0.4), 420));
    G.sflash = 0.6; G.shake = 14; G.treeShake = Math.max(G.treeShake || 0, 60);
    G.big = { s: 'MEGA BEAR DOWN!', t: 130 };
    bossDefeated(e);
  }
}

function updBear(e) {
  const p = G.p, x0 = e.x;
  e.y = groundAt(e.x);
  e.st++;
  if (e.roarT > 0) e.roarT--;
  for (const r of e.rings) r.t++;
  e.rings = e.rings.filter(r => r.t < 30);
  e.rocks = e.rocks.filter(b => b.life > 0);
  let P = rig(e);
  switch (e.state) {
    case 'intro': stepIntro(e); break;
    case 'idle': stepIdle(e); break;
    case 'toss': stepToss(e); break;
    case 'pound': stepPound(e); break;
    case 'swipe': stepSwipe(e, P); break;
    case 'laser': stepLaser(e, P); break;
    case 'roar': stepRoar(e); break;
    case 'phase2': stepPhase2(e, P); break;
    case 'dying': stepDying(e, P); break;
  }
  if (e.dead) return;
  if (e.state !== 'intro') e.x = clamp(e.x, e.ax + 340, e.ax + 452);       // stays in its arena
  // walking gait from how far it moved
  e.mv = e.x - x0;
  const sp = Math.abs(e.mv);
  if (sp > 0.05) e.stride = sp > 2 ? 26 : 14;
  e.walk = clamp(e.walk + (sp > 0.05 ? 0.1 : -0.05), 0, 1);
  const g0 = e.gait;
  e.gait += -e.mv * 0.62 / e.stride;
  if (sp > 2 && Math.floor(g0 * 2) !== Math.floor(e.gait * 2)) { sfx.thud(0.7); G.shake = Math.max(G.shake, 3); dustAt(e.x - 70, 3); dustAt(e.x + 30, 3); }
  P = e.P = rig(e);
  // the hero can't walk into it: a wall in front of the claws (a ride is pushed back by its box)
  if (e.state !== 'dying' && !p.dead) {
    const pb = pbox(p), lim = e.x - WALL + 6;
    if (pb.x + pb.w > lim) p.x -= pb.x + pb.w - lim;
  }
  // boulders ride in the paw until they are thrown
  e.rocks.forEach((b, i) => { if (b.held) { b.x = e.x + P.pawN[0] + (i - (e.rocks.length - 1) / 2) * 7; b.y = e.y + P.pawN[1] - 9 - (i % 2) * 4; } });
  // its thick plating takes half the punch out of the battle tractor's machine-gun bullets (b.rideGun, vehicle.js), so
  // the tractor shortens the fight without ending it in seconds; its cannon shells still hit hard
  if (e.state !== 'dying') {
    const bx = ebox(e);
    for (const b of G.pb) if (b.rideGun && !b.mbr && inBox(b.x + b.vx, b.y + b.vy, bx)) { b.mbr = 1; b.dmg *= 0.5; }
  }
  // the exposed core takes double damage: shots about to enter the body at its height hit it
  if (e.ph2 && !e.inv && e.state !== 'dying') {
    const bx = ebox(e), cy = e.y + P.core[1];
    for (const b of G.pb) {
      if (b.mbc || b.onHit || b.life <= 1) continue;
      const nx = b.x + b.vx, ny = b.y + b.vy;
      if (!inBox(b.x, b.y, bx) && inBox(nx, ny, bx) && Math.abs(ny - cy) <= 8) {
        b.mbc = 1; b.dmg *= 2;
        sparks(nx, ny, 5, K3); sfx.ping();
        G.texts.push({ x: nx, y: ny - 10, s: 'x2', t: 24, c: K3 });
      }
    }
  }
  // armour feedback: bits of plate fly off when it gets hit
  if (e.hp < e.lastHp && e.state !== 'dying' && e.t % 3 === 0) debris(e.x - 70, e.y - rand(20, 90), 1, rand(0, 1) < 0.5 ? M3 : B2);
  e.lastHp = e.hp;
  // exhaust smoke (thick and dark once it's damaged), sparks from the torn plates
  const smokeEvery = e.state === 'dying' ? 3 : e.ph2 ? 6 : 12;
  if (e.t % smokeEvery === 0) for (const q of P.pipes) G.parts.push({ type: 'smoke', x: e.x + q[0], y: e.y + q[1] - 2, vx: rand(0.2, 0.7), vy: rand(-1.3, -0.7), life: e.ph2 ? 70 : 46, max: 70, size: e.ph2 ? 4 : 3 });
  if (e.ph2 && e.state !== 'dying' && e.t % 26 === 0) { const q = P.T([rand(-32, -8), -110]); sparks(e.x + q[0], e.y + q[1], 3, K3); }
  if (e.ph2 && e.state !== 'dying' && e.t % 11 === 0) { const q = P.T([rand(-28, -12), -112]); G.parts.push({ type: 'smoke', x: e.x + q[0], y: e.y + q[1], vx: rand(0.1, 0.5), vy: rand(-0.8, -0.5), life: 50, max: 50, size: 2 }); }
}

// ============================================================
// Projectiles
// ============================================================
// where a boulder will land: blinking brackets on the ground, the falling rock's growing shadow, a dotted drop line
// and a "!" sign above head height (drawn with the boulder, over the hero)
function drawMark(b) {
  const x = Math.round(b.tx), gy = Math.round(groundAt(b.tx)), on = Math.floor(b.t / 5) % 2 === 0, c = on ? '#ff3b30' : '#ffe066';
  const k = b.held ? 0 : clamp(1 - (gy - b.y) / 150, 0, 1);
  ctx.fillStyle = 'rgba(20,16,30,' + (0.18 + k * 0.4).toFixed(2) + ')';
  ctx.beginPath(); ctx.ellipse(x, gy, 4 + k * 7, 1.5 + k * 1.5, 0, 0, Math.PI * 2); ctx.fill();
  R(x - 10, gy - 1, 4, 2, c); R(x + 7, gy - 1, 4, 2, c); R(x - 7, gy - 3, 14, 1, c); R(x - 7, gy + 1, 14, 1, c);
  for (let y = gy - 8; y > gy - 40; y -= 4) R(x, y, 1, 2, on ? c : 'rgba(255,224,102,0.55)');
  RO(x - 3, gy - 53, 7, 12, on ? '#ff3b30' : '#c0392b'); R(x - 1, gy - 51, 3, 5, '#ffffff'); R(x - 1, gy - 45, 3, 2, '#ffffff');
}

// granite boulders: carried in the paw, thrown at a marked spot, shootable, crumble on the ground
EB_TYPES.mbrock = {
  r: 7, shootable: true,
  update(b) {
    b.t++;
    if (!b.held && b.t % 3 === 0) G.parts.push({ type: 'dust', x: b.x, y: b.y, vx: -b.vx * 0.2, vy: 0, life: 14, max: 14, size: 2 });
  },
  draw(b) {
    drawMark(b);
    const f = b.held ? 0 : ((Math.floor(b.t / 5) * b.spin) % 4 + 4) % 4;
    spr(SPR.rocks[f], b.x - 8, b.y - 7);
  },
  onGround(b) {
    const gy = groundAt(b.x);
    debris(b.x, gy - 4, 8, GR2); debris(b.x, gy - 4, 4, GR1); dustAt(b.x, 6);
    G.shake = Math.max(G.shake, 3); sfx.thud(0.8);
  },
  onHit(b) { debris(b.x, b.y, 8, GR2); }
};

// the ground pound's shockwave: a rolling ridge of earth with rocks popping out of it (jump over it!)
EB_TYPES.mbwave = {
  r: 5,               // hurts feet lower than 8px over the ground (the crest is drawn 20px tall: clearing it is easy)
  update(b) {
    b.t++; b.y = groundAt(b.x) - 3;
    if (b.t % 4 === 0) G.parts.push({ type: 'dust', x: b.x + 6, y: b.y + 3, vx: rand(0.2, 0.9), vy: rand(-0.7, -0.2), life: 22, max: 22, size: 3 });
    if (b.t % 7 === 0) G.parts.push({ type: 'debris', x: b.x, y: b.y - 4, vx: rand(-0.6, 1.4), vy: rand(-3.2, -1.8), g: 0.2, life: 30, max: 30, size: 2, c: b.t % 14 ? '#6b4a2e' : '#4f8a3a' });
  },
  draw(b) {
    const x = Math.round(b.x), gy = Math.round(groundAt(b.x)), w = b.t % 6 < 3 ? 1 : 0, f = b.t % 4 < 2;
    // a glow so it reads on any ground, and the crack it leaves behind
    ctx.fillStyle = 'rgba(255,214,90,0.32)'; ctx.beginPath(); ctx.ellipse(x - 3, gy, 21, 19, 0, Math.PI, 0); ctx.fill();
    for (let i = 0; i < 48; i += 2) R(x + 12 + i, gy - 1 + (i % 6 ? 0 : 1), 2, 1, 'rgba(46,28,18,' + (0.7 - i * 0.014).toFixed(2) + ')');
    // a curling wave of earth, leaning forward, with its torn grass cap
    blob([[x - 10, gy - 4, 24, 4], [x - 10, gy - 7 - w, 21, 3], [x - 11, gy - 10 - w, 17, 3], [x - 12, gy - 13 - w, 12, 3], [x - 13, gy - 15 - w, 7, 2]], '#7a5232');
    R(x + 2, gy - 9 - w, 9, 5, '#5f3f26'); R(x + 7, gy - 5, 6, 4, '#5f3f26');
    R(x - 12, gy - 15 - w, 6, 1, '#7fcf5a'); R(x - 11, gy - 13 - w, 2, 1, '#4f8a3a'); R(x - 6, gy - 13 - w, 5, 1, '#4f8a3a'); R(x - 9, gy - 10 - w, 3, 1, '#a87a50');
    // chunks of rock flipping out of it
    for (let i = 0; i < 3; i++) { const h = Math.round(Math.abs(Math.sin(b.t * 0.21 + i * 2.1)) * (13 - i * 3)); RO(x - 5 + i * 6, gy - 19 - h + i * 3, 3 - (i > 1 ? 1 : 0), 3 - (i > 1 ? 1 : 0), i === 1 ? GR3 : GR2); }
    // the bright shock front, curved
    R(x - 15, gy - 8, 2, 8, f ? '#ffd23f' : '#ffb02e'); R(x - 14, gy - 15, 2, 7, f ? '#ffd23f' : '#ffb02e'); R(x - 13, gy - 19, 2, 5, '#fff6c8');
    R(x - 16, gy - 6, 1, 6, '#ffffff'); R(x - 15, gy - 13, 1, 6, '#ffffff'); R(x - 14, gy - 18, 1, 4, '#ffffff');
  }
};

// pixel arrows for the laser hints (dark edge, then colour)
function arrow(x, y, up, col) {
  for (const [o, c] of [[1, OUT], [0, col]]) {
    for (let j = 0; j < 4; j++) R(x - j + o, (up ? y + j : y + 6 - j) + o, j * 2 + 1, 1, c);
    R(x - 1 + o, (up ? y + 4 : y) + o, 3, 3, c);
  }
}
// what to do, over the hero's head: DUCK! for HIGH; for LOW an arrow, then JUMP! when the pulse is close
function drawHint(e, bm) {
  const p = G.p;
  if (!p || p.dead || p.ride) return; // a rider can't duck or jump the beam: no instruction to follow
  const x = Math.round(p.x), top = Math.round(p.y) - (p.crouch ? 26 : 34);
  if (e.lane === 'high') {
    if (Math.floor(G.t / 6) % 3 === 0) return;
    text('DUCK!', x, top - 18, '#86f3ff', 1, 'center');
    arrow(x, top - 9, false, '#86f3ff');
    return;
  }
  const cue = bm.cue && (bm.ph === 'aim' || bm.tail > p.x - 6);
  if (cue) {
    const c = G.t % 6 < 3 ? '#ffe066' : '#ffffff';
    text('JUMP!', x, top - 18, c, 1, 'center'); arrow(x, top - 9, true, c);
  } else if (bm.ph === 'aim' && Math.floor(G.t / 8) % 2) arrow(x, top - 9, true, '#ffe066');
}

// HIGH beam: soft glow, cyan body, white-hot core, ripples and streaks rushing out, a flare at the chest
function drawBeam(e, bm) {
  const x0 = Math.round(Math.max(bm.tip, G.cam.x - 4)), x1 = Math.round(bm.tail), len = x1 - x0, y = bm.y;
  if (len <= 0) return;
  const fade = bm.ph === 'fade', fl = G.t % 4 < 2 ? 1 : 0, hw = fade ? 1 : 3 + fl;
  const gy = Math.round(groundAt(x0 + len / 2));
  ctx.fillStyle = 'rgba(134,243,255,0.18)'; ctx.fillRect(x0, gy - 2, len, 4);                          // light on the grass
  ctx.fillStyle = 'rgba(28,178,227,0.2)'; ctx.fillRect(x0, y - hw - 6, len, hw * 2 + 13);
  ctx.fillStyle = 'rgba(134,243,255,0.3)'; ctx.fillRect(x0, y - hw - 2, len, hw * 2 + 5);
  R(x0, y - hw, len, hw * 2 + 1, K2); R(x0, y - hw + 1, len, Math.max(1, hw * 2 - 1), K3); R(x0, y - 1, len, 3, K4); R(x0, y, len, 1, '#ffffff');
  if (!fade) {
    for (let i = 0; i < len; i += 26) { const sx = x0 + ((i - G.t * 7) % len + len) % len; R(sx, y - hw - 1, 9, 1, K3); R(sx + 3, y + hw + 1, 9, 1, K3); R(sx + 1, y - hw - 2, 5, 1, K4); }
    for (let i = 0; i < len; i += 15) { const sx = x0 + ((i - G.t * 12) % len + len) % len; R(sx, y - 1, 7, 1, '#ffffff'); R(sx + 2, y + 1, 4, 1, '#ffffff'); }
    // the tip while it shoots out
    if (bm.tip > G.cam.x) { ctx.fillStyle = 'rgba(234,255,255,0.75)'; circ(x0, y + 0.5, 5 + fl); ctx.fillStyle = 'rgba(134,243,255,0.45)'; circ(x0, y + 0.5, 9 + fl); }
  }
  flare(x1, y, fade ? 0.4 : 1, fl);
}
// the flare where the beam leaves the core: a white disc with a cross of rays
function flare(x, y, k, fl) {
  ctx.fillStyle = 'rgba(80,220,255,' + (0.35 * k).toFixed(2) + ')'; circ(x, y + 0.5, 11 + fl * 2);
  ctx.fillStyle = 'rgba(234,255,255,' + (0.85 * k).toFixed(2) + ')'; circ(x, y + 0.5, 5 + fl);
  if (k < 1) return;
  const r = 9 + fl * 3;
  R(x - r, y, r * 2 + 1, 1, '#ffffff'); R(x, y - r + 3, 1, (r - 3) * 2 + 1, '#ffffff');
  R(x - 3, y - 3, 1, 1, K4); R(x + 3, y - 3, 1, 1, K4); R(x - 3, y + 3, 1, 1, K4); R(x + 3, y + 3, 1, 1, K4);
}

// LOW pulse: a ball of light rolling along the ground with a tapering tail and a glowing scorch mark behind it
function drawPulse(e, bm) {
  const x0 = Math.round(bm.tip), x1 = Math.round(bm.tail), n = x1 - x0, y = bm.y, gy = Math.round(groundAt(x0)), fl = G.t % 4 < 2 ? 1 : 0;
  if (n <= 0) return;
  for (let x = x1; x < Math.min(bm.src, x1 + 130); x += 2) {
    const k = 1 - (x - x1) / 130;
    R(x, gy - 1, 2, 1, 'rgba(255,150,60,' + (0.75 * k).toFixed(2) + ')'); R(x, gy, 2, 1, 'rgba(40,20,10,' + (0.5 * k).toFixed(2) + ')');
  }
  ctx.fillStyle = 'rgba(28,178,227,0.25)'; ctx.fillRect(x0 - 2, y - 9, n + 2, 17);
  ctx.fillStyle = 'rgba(134,243,255,0.3)'; ctx.fillRect(x0, gy - 2, n, 3);
  for (let i = 0; i < n; i++) {
    const k = 1 - i / n, hw = Math.round(1 + k * (3 + fl));
    R(x0 + i, y - hw, 1, hw * 2 + 1, K2); R(x0 + i, y - hw + 1, 1, Math.max(1, hw * 2 - 1), K3);
  }
  R(x0, y - 1, n, 3, K4); R(x0, y, n, 1, '#ffffff');
  for (let i = 0; i < n; i += 9) { const sx = x0 + ((i + G.t * 3) % n); R(sx, y - 1, 4, 1, '#ffffff'); }
  ctx.fillStyle = 'rgba(134,243,255,0.45)'; circ(x0, y + 0.5, 9 + fl);
  disc(x0, y, 5 + fl, K3); disc(x0, y, 3, K4); R(x0 - 1, y - 1, 3, 3, '#ffffff');
  R(x0 - 9 - fl * 2, y, 6, 1, '#ffffff'); R(x0, y - 8 - fl, 1, 4, K4);
  flare(Math.round(bm.src), y, 0.5, fl);
}

// the aim line: thin dashes marching out of the chest on the lane, solid and blinking fast just before it fires
function drawAim(e, bm) {
  const y = bm.y, late = bm.t > AIM - 14, L = G.cam.x - 8, x1 = Math.round(bm.src) - 4;
  const on = Math.floor(G.t / (late ? 2 : 4)) % 2 === 0, c = on ? '#ff3b30' : '#ffffff';
  if (late) { R(L, y, x1 - L, 1, c); ctx.fillStyle = 'rgba(255,59,48,0.25)'; ctx.fillRect(L, y - 1, x1 - L, 3); }
  else for (let x = x1 - ((G.t * 2) % 8); x > L; x -= 8) R(Math.round(x) - 5, y, 5, 1, c);
  const k = clamp(bm.t / AIM, 0, 1);
  ctx.fillStyle = 'rgba(134,243,255,' + (0.25 + k * 0.35).toFixed(2) + ')'; circ(x1 + 2, y + 0.5, 3 + k * 6);
}

// the chest laser as an enemy projectile, so it draws over the hero (the bear moves it and does the damage)
EB_TYPES.mbbeam = {
  r: 0,
  update(b) {
    const e = b.owner;
    if (!e || e.dead || e.state !== 'laser' || !e.beam) { b.life = 0; return; }
    b.x = clamp(e.beam.tail, G.cam.x, G.cam.x + W); b.y = Math.min(e.beam.y, groundAt(b.x) - 2);
  },
  draw(b) {
    const e = b.owner, bm = e && e.beam;
    if (!bm) return;
    if (bm.ph === 'aim') drawAim(e, bm);
    else if (e.lane === 'low') drawPulse(e, bm);
    else drawBeam(e, bm);
    drawHint(e, bm);
  }
};

// ============================================================
// Registry
// ============================================================
ENEMY_TYPES.megabear = {
  hp: 480, boss: true, bossName: 'MEGA BEAR', armored: true, edge: 110, activateMargin: 130, contact: 'none',
  make(e, s) {
    e.x = Math.max(s.x, G.cam.x + W + 110);   // always crashes in from off screen right
    Object.assign(e, {
      state: 'intro', st: 0, inv: true, ax: G.cam.x, tx: null, rest: 60, atk: 0, tosses: 0, lasers: 0, last: '', lane: 'high',
      gait: 0, walk: 0, stride: 14, mv: 0, arrived: 0, roarT: 0, rings: [], rocks: [], pups: [], beam: null, beamEnd: 0,
      ph2: false, lost: {}, lastHp: e.hp, n: 1
    });
  },
  update: updBear,
  draw: drawBear,
  // the front edge follows the pose: reared up (ground pound) shots fly under the chest to the legs
  box(e) {
    const P = e.P || rig(e);
    if (P.th > 0.25) return { x: e.x - 22, y: e.y - 150, w: 80, h: 146 };
    const fr = Math.min(-80 + Math.min(0, P.bx), P.mouth[1] > -84 ? P.mouth[0] + 6 : 0);
    return { x: e.x + fr, y: e.y - 110, w: 58 - fr, h: 106 };
  },
  onKill(e, cx, cy, b) {
    e.state = 'dying'; e.st = 0; e.hitT = 0; e.inv = true;
    G.eb = []; e.rocks = []; e.beam = null; e.rings = []; e.roarT = 0;
    // the fight is over: its wolves and any robot left die with it, nothing hurts the hero from here on (bossDefeated
    // at st 150 sets winT 210: the same win time) and a hero already going down on the last life comes back and wins
    for (const w of G.enemies) if (w !== e && w.active && !w.dead && !w.dying && w.state !== 'dying') damageEnemy(w, 99);
    G.winT = 360;
    if (G.p.dead && G.lives <= 1) G.lives = 2;
    addScore(10000, cx, b.y);
    say('Mega Bear is going down!', 1.1, 1.05);
    return 'dying';
  }
};
}
