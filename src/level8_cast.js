'use strict';
// =====================================================================================================================
// Mission 8 (DINOSAUR VALLEY) cast, part 1: the looks of the ROBOT dinosaurs the Oggles built. They carry the Oggles'
// mark: riveted green armour on steel, and ONE big eye (steel rim, white lens, red iris) that turns yellow before
// an attack. Every frame is painted from pose numbers into a pixel buffer and baked at its first use.
//
// Exports on M8 (each draws at the feet (x, y), facing 1 = right; o.t = animation clock, o.mood = eye):
//   M8.compy(x, y, facing, o)      o.pose 'run' | 'idle' | 'crouch' | 'leap'
//   M8.raptor(x, y, facing, o)     o.pose 'run' | 'idle' | 'crouch' | 'leap' | 'skid' | 'peek'
//   M8.spitter(x, y, facing, o)    o.pose 'walk' | 'idle' | 'warn' | 'spit'       (o.k 0..1: how far the frill is open)
//   M8.ptero(x, y, facing, o)      o.pose 'fly' | 'dive' | 'perch' (feet 10 px under y)   (o.egg: carrying one)
//   M8.burst(kind, x, y, facing)   a beaten robot's pieces flying (uses rand(): call from update code only)
//   M8.eyeOf(kind, pose, t)        -> [dx, dy] of the eye from the feet, facing right (for marks above the head)
// Eye moods: 'look' (default: red iris following the hero), 'warn' (yellow, blinking), 'hot' (white), 'dizzy', 'off'.
// Drawing never calls Math.random() / rand(): the clock and hsh() only.
// =====================================================================================================================
{
const Math = globalThis.Math;
const { NONE, buf, put, get, rect, shape, oval, poly, line, capsule, tube, bez, outline, form, stamp, mk, blit } = M8.px;
const I = M8.I, P = M8.P, OUTI = M8.OUTI, lerp = M8.lerp;

// ---------------------------------------------------------------------------------------------------------------------
// Palette (ramps dark -> light)
// ---------------------------------------------------------------------------------------------------------------------
const STEEL = P('#2a303a', '#3b424d', '#56606e', '#8a97a8', '#c3cdd8', '#f2f6fa');
const STEELD = P('#1c2028', '#2a303a', '#3b424d', '#56606e', '#76828f');            // limbs on the far side
const GRN = P('#0c2b1c', '#12502a', '#1c7a34', '#2fae44', '#62d64f', '#a8f070');    // Oggle armour (Mission 5's green)
const GRND = P('#08200f', '#0c2b1c', '#12502a', '#1c7a34', '#2fae44');
const TEAL = P('#0a2a30', '#0f4650', '#167080', '#22a0a8', '#5fd0c8', '#b0f0e0');   // pteros
const VIO = P('#2a1040', '#4a1a6a', '#7a2a9a', '#b040c0', '#e070d8', '#ffb3f0');    // the spitter's frill
const AMB = P('#5a3a08', '#9a6a10', '#d8a020', '#ffcf3a', '#fff2a8');               // warning yellow
const BONE = I('#e8e2d2'), BONED = I('#b8ae98'), DARK = I('#1a1a26'), JOINT = I('#20242c');
const EYEW = I('#f6fbff'), EYES = I('#b9d0e4');
M8.PAL = { STEEL, STEELD, GRN, GRND, TEAL, VIO, AMB, BONE, BONED };
// marks: shapes are painted in these never-shown colours, then lit by form()
const K0 = 0x000101, K1 = 0x000202, K2 = 0x000303, K3 = 0x000404;

// two bones l1, l2 from a to b: where the joint is (s = 1 / -1: which way it bends)
function ik(ax, ay, bx, by, l1, l2, s) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 0.001, m = Math.min(d, l1 + l2 - 0.01);
  const a = (l1 * l1 - l2 * l2 + m * m) / (2 * m), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / d, uy = dy / d;
  return [ax + ux * a - uy * hh * s, ay + uy * a + ux * hh * s];
}
// a new layer the size of B, painted, lit, outlined and laid over B
function layer(B, paint, forms, lined = true) {
  const b = buf(B.w, B.h, B.ox, B.oy);
  paint(b);
  for (const f of forms) form(b, f[0], f[1], f[2]);
  if (lined) outline(b);
  stamp(B, b);
  return b;
}
// paint fn's shapes in `mark`, but only on pixels that are `on` now
function over(b, on, mark, fn) {
  const t = buf(b.w, b.h, b.ox, b.oy);
  fn(t, mark);
  for (let i = 0; i < t.d.length; i++) if (t.d[i] === mark && b.d[i] === on) b.d[i] = mark;
}
// the Oggle eye baked into a sprite: steel rim, white lens with a shaded lower edge. r = lens radius
function bakeEye(b, cx, cy, r) {
  oval(b, cx, cy, r + 1.6, r + 1.6, STEEL[1]);
  shape(b, cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= (r + 1.6) ** 2 && (x - cx) * 0.5 + (y - cy) * 0.86 < -r * 0.3, STEEL[4]);
  oval(b, cx, cy, r, r, EYEW);
  shape(b, cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r && (x - cx) * -0.35 + (y - cy) * 0.94 > r * 0.5, EYES);
}
// the live part of the eye, drawn inside the sprite's own transform: (ex, ey) = lens centre, (lx, ly) = where it looks
const SPIRAL = ['####.', '...#.', '.#.#.', '.###.', '.....'];
function liveEye(ex, ey, r, lx, ly, mood, t) {
  ex = Math.round(ex); ey = Math.round(ey);
  if (mood === 'off') { R(ex - 1, ey, 3, 1, '#56606e'); return; }
  if (mood === 'dizzy') {
    const q = Math.floor(t / 4) % 4;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const [u, v] = q === 0 ? [i, j] : q === 1 ? [j, 4 - i] : q === 2 ? [4 - i, 4 - j] : [4 - j, i];
      if (SPIRAL[v][u] === '#' && (i - 2) ** 2 + (j - 2) ** 2 <= r * r) R(ex - 2 + i, ey - 2 + j, 1, 1, '#1a0a12');
    }
    return;
  }
  const k = Math.max(0, r - 1.6), x = Math.round(ex + clamp(lx, -1, 1) * k), y = Math.round(ey + clamp(ly, -1, 1) * k);
  const warn = mood === 'warn', hot = mood === 'hot';
  const col = hot ? '#ffffff' : warn ? (Math.floor(t / 4) % 2 ? '#ffe063' : '#ffffff') : '#ff3b30';
  if (r >= 3.4) { R(x - 1, y - 1, 3, 3, col); if (!warn && !hot) R(x + 1, y + 1, 1, 1, '#a3151a'); R(x, y, 1, 1, '#1a0a12'); if (!warn && !hot) R(x - 1, y - 1, 1, 1, '#ffd6d1'); }
  else if (r >= 2.2) { R(x - 1, y - 1, 2, 2, col); R(x, y, 1, 1, warn || hot ? col : '#1a0a12'); }
  else R(x, y, 1, 1, col);
}
// where a robot at (x, y) facing f looks: toward the hero, in its own (unmirrored) sprite space
function lookAt(x, y, f) {
  const p = G.p;
  if (!p) return [1, 0];
  const dx = (p.x - x) * f, dy = (p.y - 16) - y, d = Math.hypot(dx, dy) || 1;
  return [dx / d, dy / d];
}

// ---------------------------------------------------------------------------------------------------------------------
// The two-legged robots (compy, raptor, spitter) share one painter. T = proportions, q = pose:
//   q.dy      hip up (-) / down (+)            q.lean   body angle added, + = nose down (radians)
//   q.fa, q.fb  [x, y] of the near and the far foot (y 0 = the ground, negative = lifted)
//   q.tail    tail angle, + = up               q.neck   neck angle from level (radians)
//   q.head    head angle, + = up               q.jaw    0 shut .. 1 wide open
//   q.arm     arm angle, + = forward and up    q.frill  0..1 (the spitter)
// ---------------------------------------------------------------------------------------------------------------------
function theropod(T, q) {
  const s = T.s, B = buf(T.w, T.h, T.ox, T.oy);
  const rot = (px, py, a, ox, oy) => [ox + px * Math.cos(a) + py * Math.sin(a), oy - px * Math.sin(a) + py * Math.cos(a)];   // a + = counter-clockwise on screen
  const hx = T.hipX * s, hy = (-T.hipH + (q.dy || 0)) * s;
  const ba = T.bodyA - (q.lean || 0);
  const C = rot(T.body * s, 0, ba, hx, hy);                                 // chest
  const na = (q.neck ?? T.neckA), N = rot(T.neck * s, 0, na, C[0], C[1] - 1 * s);   // head joint
  const ha = q.head || 0, jaw = q.jaw || 0;
  const tailA = q.tail ?? 0.15, E = [hx - Math.cos(tailA) * T.tail * s, hy - Math.sin(tailA) * T.tail * s];
  const tailPts = bez([[hx - 1 * s, hy], [(hx + E[0]) / 2, (hy + E[1]) / 2 + T.sag * s + (q.sag || 0) * s], E], 8);
  const HD = (px, py) => rot(px * s * T.headS, -py * s * T.headS, ha, N[0], N[1]);   // head space: x forward, y up
  const legs = [q.fb, q.fa].map((f, i) => {
    const hip = [hx + (i ? 0 : 1.5 * s), hy + 1 * s], foot = [f[0] * s, f[1] * s];
    const ank = [foot[0] - T.ankleB * s, foot[1] - T.ankleH * s];
    return { hip, ank, foot, knee: ik(hip[0], hip[1], ank[0], ank[1], T.l1 * s, T.l2 * s, 1) };
  });
  const paintLeg = (b, L, m) => {
    capsule(b, L.hip[0], L.hip[1], L.knee[0], L.knee[1], T.rThigh * s, T.rThigh * 0.7 * s, m);
    capsule(b, L.knee[0], L.knee[1], L.ank[0], L.ank[1], T.rShin * s, T.rShin * 0.85 * s, m);
    capsule(b, L.ank[0], L.ank[1], L.foot[0], L.foot[1] - 1 * s, T.rShin * 0.8 * s, T.rShin * 0.8 * s, m);
    capsule(b, L.foot[0], L.foot[1] - 1.2 * s, L.foot[0] + T.toe * s, L.foot[1] - 1 * s, 1.1 * s, 0.9 * s, m);
  };
  const claws = (b, L, col) => {
    if (s < 0.8) return;
    put(b, L.foot[0] + T.toe * s + 1, L.foot[1] - 1, col);
    line(b, L.foot[0] + 1, L.foot[1] - 4 * s, L.foot[0] + 3.5 * s, L.foot[1] - 5.5 * s, col);   // the raised sickle claw
    put(b, L.foot[0] + 4 * s, L.foot[1] - 4.5 * s, col);
  };
  const arm = (b, m, dx) => {
    const sh = [C[0] - 1 * s + dx, C[1] + 2.5 * s], a = -0.9 + (q.arm || 0);
    const el = [sh[0] + Math.cos(a) * T.arm * s, sh[1] - Math.sin(a) * T.arm * s], hd = [el[0] + Math.cos(a + 1.1) * T.arm * s, el[1] - Math.sin(a + 1.1) * T.arm * s];
    capsule(b, sh[0], sh[1], el[0], el[1], 1.3 * s, 1.1 * s, m); capsule(b, el[0], el[1], hd[0], hd[1], 1.1 * s, 0.8 * s, m);
    return hd;
  };
  // far side: leg and arm, darker
  layer(B, b => { paintLeg(b, legs[0], K0); if (T.arm) arm(b, K0, 2 * s); }, [[K0, STEELD, { depth: 2 }]]);
  // the frill behind the head (the spitter): a fan that opens
  if (T.frill && q.frill > 0.05) {
    const k = q.frill, fc = HD(1, 1.5), R0 = T.frill * s * (0.45 + 0.55 * k);
    layer(B, b => {
      shape(b, fc[0] - R0 - 1, fc[1] - R0 - 1, fc[0] + R0 + 1, fc[1] + R0 + 1, (x, y) => {
        const dx = x - fc[0], dy = y - fc[1], d = Math.hypot(dx, dy);
        if (d > R0) return false;
        const a = Math.atan2(-dy, dx);                     // open toward the back and up
        return a > 0.5 - k * 0.9 && a < Math.PI + 0.9 * k || a < -Math.PI + 0.9 * k - 0.4;
      }, K0);
    }, [[K0, VIO, { depth: 3, amb: 0.55 }]]);
    for (let i = 0; i < 6; i++) {                           // ribs and yellow spots
      const a = 0.7 - k * 0.6 + i * (2.2 + 0.9 * k) / 5, ex = fc[0] + Math.cos(a) * (R0 - 1.5), ey = fc[1] - Math.sin(a) * (R0 - 1.5);
      line(B, fc[0], fc[1], ex, ey, VIO[1]);
      if (k > 0.5) { const sx = fc[0] + Math.cos(a + 0.2) * R0 * 0.62, sy = fc[1] - Math.sin(a + 0.2) * R0 * 0.62; if (get(B, sx, sy) !== NONE && get(B, sx, sy) !== OUTI) put(B, sx, sy, AMB[3]); }
    }
  }
  // lower jaw (under the skull)
  layer(B, b => {
    const pv = [-1, -0.6], a = -jaw * 0.75;
    const J = (px, py) => { const r = rot((px - pv[0]) * s * T.headS, -(py - pv[1]) * s * T.headS, ha + a, 0, 0), o = HD(pv[0], pv[1]); return [o[0] + r[0], o[1] + r[1]]; };
    poly(b, [J(-1.5, -0.4), J(11.5, -0.6), J(11.2, -2.6), J(3, -3.9), J(-1.5, -3.4)], K0);
  }, [[K0, STEEL, { depth: 2, amb: 0.42 }]]);
  // tail, body, neck, skull: one steel form with green armour over the back
  const main = layer(B, b => {
    tube(b, tailPts, T.rTail * s, 0.7 * s, K0);
    capsule(b, hx, hy, C[0], C[1], T.rHip * s, T.rChest * s, K0);
    capsule(b, C[0], C[1] - 1 * s, N[0], N[1], T.rNeck * s, T.rNeck * 0.9 * s, K0);
    poly(b, [HD(-3.5, 3.6), HD(1.5, 4.8), HD(6.5, 4.3), HD(11.3, 2.8), HD(12.4, 0.8), HD(12.2, -0.6), HD(-2.5, -1.2), HD(-4, 1)], K0);
    // armour: the upper half of tail, back and neck, and the skull's crown
    over(b, K0, K1, (t, m) => {
      tube(t, tailPts.map(p => [p[0], p[1] - 1.6 * s]), T.rTail * s, 0.5 * s, m);
      capsule(t, hx, hy - 2.4 * s, C[0], C[1] - 2.2 * s, T.rHip * s, T.rChest * s, m);
      capsule(t, C[0] - 1.5 * s, C[1] - 2 * s, N[0] - 1.6 * s, N[1], T.rNeck * s, T.rNeck * 0.8 * s, m);
      poly(t, [HD(-4.5, 5), HD(2, 5.2), HD(7.5, 4.4), HD(8, 2.6), HD(-4.5, 1.6)], m);
    });
  }, [[K0, STEEL, { depth: 3 * s + 1 }], [K1, T.armour, { depth: 3 * s + 1, amb: 0.52 }]]);
  // armour details: plate seams along the back, a rivet row
  if (s >= 0.8) {
    for (let i = 1; i <= 3; i++) { const u = i / 4, x = lerp(hx, C[0], u), y = lerp(hy, C[1], u); for (let k = -8; k < 4; k++) if (get(B, x, y + k) === T.armour[3] || get(B, x, y + k) === T.armour[4] || get(B, x, y + k) === T.armour[2]) put(B, x, y + k, T.armour[1]); }
    // the tail is made of rings
    for (let i = 2; i < tailPts.length - 1; i += 2) { const p = tailPts[i]; for (let k = -5; k <= 5; k++) { const c = get(B, p[0], p[1] + k); if (c !== NONE && c !== OUTI) put(B, p[0], p[1] + k, T.armour.includes(c) ? T.armour[1] : STEEL[1]); } }
  }
  // the Oggles' antenna: a rod on the hips with an amber lamp
  if (T.antenna) { const ax = hx - 1, ay = hy - T.rHip * s; line(B, ax, ay, ax - 2 * s, ay - 5 * s, STEEL[4]); rect(B, ax - 2 * s - 1, ay - 5 * s - 2, 2, 2, AMB[3]); }
  if (T.crest) T.crest(B, HD, s, q);
  // teeth: along the upper jaw, and the lower when it is open
  if (s >= 0.8) for (let i = 0; i < 4; i++) { const p = HD(4.5 + i * 2.2, -1.2); if (jaw > 0.25 || i % 2 === 0) put(B, p[0], p[1], BONE); }
  // the eye
  const eye = HD(T.eyeX, T.eyeY), er = T.eyeR * s;
  bakeEye(B, eye[0], eye[1], er);
  // near side: arm, then the leg
  if (T.arm) { const hd = [0, 0]; layer(B, b => { const h = arm(b, K0, 0); hd[0] = h[0]; hd[1] = h[1]; }, [[K0, STEEL, { depth: 2 }]]); if (s >= 0.8) { put(B, hd[0] + 1, hd[1], BONE); put(B, hd[0] + 1, hd[1] + 1, BONE); } }
  layer(B, b => paintLeg(b, legs[1], K0), [[K0, STEEL, { depth: 2 }]]);
  if (s >= 0.8) { const L = legs[1]; put(B, L.knee[0], L.knee[1], JOINT); put(B, L.hip[0], L.hip[1], JOINT); put(B, L.hip[0] + 1, L.hip[1], STEEL[4]); }
  claws(B, legs[1], BONE); claws(B, legs[0], BONED);
  outline(B);
  const sp = mk(B);
  sp.eye = [Math.round(eye[0] - 0.5), Math.round(eye[1] - 0.5)]; sp.er = er;
  sp.mouth = HD(12, -1).map(Math.round);
  return sp;
}
// frames: a cache of sprites by key
function frames(make) { const c = {}; return k => c[k] || (c[k] = make(k)); }
// feet of a two-legged run at phase u (0..1): the near foot, the far one half a cycle later
function stride(u, len, lift) {
  const f = v => { v = ((v % 1) + 1) % 1; return v < 0.5 ? [len * (0.5 - v * 2), 0] : [len * (-0.5 + (v - 0.5) * 2), -lift * Math.sin((v - 0.5) * 2 * Math.PI)]; };
  return [f(u), f(u + 0.5)];
}

// ---------------------------------------------------------------------------------------------------------------------
// RAPTOR
// ---------------------------------------------------------------------------------------------------------------------
const RAPT = {
  s: 1, w: 84, h: 60, ox: 40, oy: 54, hipX: -3, hipH: 14, bodyA: 0.22, body: 11, neck: 7, neckA: 1.0, headS: 1.22, tail: 19, sag: 2,
  rHip: 6, rChest: 5, rNeck: 3.3, rTail: 3.9, l1: 8, l2: 7.5, ankleH: 5, ankleB: 2, rThigh: 3.3, rShin: 1.9, toe: 4, arm: 3.2,
  eyeX: 2.4, eyeY: 2.2, eyeR: 2.5, armour: GRN, antenna: true,
  crest(B, HD, s) { for (let i = 0; i < 4; i++) { const p = HD(-4 + i * 1.5, 5.8 + (i % 2)); put(B, p[0], p[1], AMB[3]); put(B, p[0], p[1] + 1, AMB[2]); } }   // a row of yellow quills
};
function raptorPose(k) {
  const [name, n] = k.split(':'), i = +n || 0;
  if (name === 'run') { const u = i / 6, [fa, fb] = stride(u, 13, 6); return { fa, fb, dy: Math.abs(Math.sin(u * 2 * Math.PI)) < 0.5 ? 0 : -1, lean: 0.12, tail: 0.22 + 0.1 * Math.sin(u * 4 * Math.PI), neck: 0.72, head: -0.12, arm: 0.3 * Math.sin(u * 2 * Math.PI) }; }
  if (name === 'idle') return { fa: [3, 0], fb: [-4, 0], dy: i ? 1 : 0, tail: 0.18 - i * 0.05, neck: 1.05, head: -0.05 };
  if (name === 'crouch') return { fa: [5, 0], fb: [-5, 0], dy: 5 + i, lean: 0.3, tail: 0.75, sag: -3, neck: 0.3, head: 0.25, jaw: 0.7, arm: 0.9 };
  if (name === 'leap') return { fa: [9, -11], fb: [4, -8], dy: -4, lean: -0.3, tail: 0.05, sag: 0, neck: 0.5, head: -0.25, jaw: 1, arm: 1.5 };
  if (name === 'skid') return { fa: [9, 0], fb: [4, 0], dy: 3, lean: -0.25, tail: 0.55, neck: 1.2, head: 0.1, jaw: 0.3, arm: -0.3 };
  if (name === 'peek') return { fa: [3, 0], fb: [-3, 0], dy: 6, lean: 0.25, tail: 0.1, neck: 0.5, head: 0.15 };
  return { fa: [3, 0], fb: [-4, 0] };
}
const raptorF = frames(k => theropod(RAPT, raptorPose(k)));
function poseKey(pose, t) {
  if (pose === 'run') return 'run:' + (Math.floor(t / 4) % 6);
  if (pose === 'idle') return 'idle:' + (Math.floor(t / 20) % 2);
  if (pose === 'crouch') return 'crouch:' + (Math.floor(t / 3) % 2);
  return pose;
}
function drawBiped(F, x, y, f, o) {
  const t = o.t ?? G.t, fr = F(o.key || poseKey(o.pose || 'idle', t));
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(f, 1);
  blit(fr, 0, 0);
  const lk = o.look || lookAt(x, y + fr.eye[1], f);
  liveEye(fr.eye[0], fr.eye[1], fr.er, lk[0], lk[1], o.mood, t);
  ctx.restore();
  return fr;
}
M8.raptor = (x, y, f = -1, o = {}) => drawBiped(raptorF, x, y, f, o);

// ---------------------------------------------------------------------------------------------------------------------
// COMPY: a raptor's little cousin, half the size, all eye
// ---------------------------------------------------------------------------------------------------------------------
const COMP = Object.assign({}, RAPT, { s: 0.56, w: 48, h: 34, ox: 24, oy: 30, headS: 1.25, eyeR: 3.6, eyeX: 2.6, eyeY: 2.2, neck: 6, tail: 20, arm: 0, crest: null, rShin: 2.1, toe: 4.5, armour: GRN });
function compyPose(k) {
  const [name, n] = k.split(':'), i = +n || 0;
  if (name === 'run') { const u = i / 4, [fa, fb] = stride(u, 12, 6); return { fa, fb, dy: i % 2 ? -1.5 : 0, lean: 0.1, tail: 0.3 + 0.12 * (i % 2), neck: 0.8 }; }
  if (name === 'crouch') return { fa: [5, 0], fb: [-5, 0], dy: 5, lean: 0.25, tail: 0.8, sag: -3, neck: 0.4, head: 0.2, jaw: 0.8 };
  if (name === 'leap') return { fa: [-9, -8], fb: [-12, -5], dy: -2, lean: -0.2, tail: 0, neck: 0.4, head: -0.2, jaw: 1 };
  return { fa: [3, 0], fb: [-4, 0], dy: i ? 1.5 : 0, tail: 0.25, neck: 1.0 };
}
const compyF = frames(k => theropod(COMP, compyPose(k)));
M8.compy = (x, y, f = -1, o = {}) => {
  const t = o.t ?? G.t, pose = o.pose || 'idle';
  return drawBiped(compyF, x, y, f, Object.assign({ key: pose === 'run' ? 'run:' + (Math.floor(t / 3) % 4) : pose === 'idle' ? 'idle:' + (Math.floor(t / 14) % 2) : pose }, o));
};

// ---------------------------------------------------------------------------------------------------------------------
// SPITTER: a stocky raptor with a frill that fans out before it spits
// ---------------------------------------------------------------------------------------------------------------------
const SPIT = Object.assign({}, RAPT, {
  s: 1.08, w: 92, h: 66, ox: 44, oy: 58, body: 12, rHip: 5.8, rChest: 4.9, neck: 9, tail: 20, frill: 11, armour: GRN, arm: 2.8,
  crest(B, HD, s) { for (const dx of [0, 3.2]) { for (let i = 0; i < 5; i++) { const p = HD(3 + dx + i * 0.9, 4.8 + Math.sin(i / 4 * Math.PI) * 2.2); put(B, p[0], p[1], VIO[3]); put(B, p[0], p[1] + 1, VIO[2]); } } }   // twin crests
});
function spitterPose(k) {
  const [name, n] = k.split(':'), i = +n || 0;
  if (name === 'walk') { const u = i / 6, [fa, fb] = stride(u, 9, 4); return { fa, fb, dy: i % 3 === 1 ? -1 : 0, lean: 0.05, tail: 0.2 + 0.06 * Math.sin(u * 4 * Math.PI), neck: 1.0, frill: 0 }; }
  if (name === 'warn') return { fa: [4, 0], fb: [-5, 0], dy: 1 + (i % 2), lean: -0.18, tail: 0.5, neck: 1.25, head: 0.15, jaw: 0.25 + 0.1 * (i % 2), frill: [0.35, 0.7, 1, 1][Math.min(3, i)], arm: 0.6 };
  if (name === 'spit') return { fa: [5, 0], fb: [-5, 0], dy: 2, lean: 0.22, tail: 0.6, neck: 0.75, head: 0.3, jaw: 1, frill: 1, arm: 1 };
  return { fa: [3, 0], fb: [-4, 0], dy: i ? 1 : 0, tail: 0.2, neck: 1.05, frill: 0 };
}
const spitterF = frames(k => theropod(SPIT, spitterPose(k)));
M8.spitter = (x, y, f = -1, o = {}) => {
  const t = o.t ?? G.t, pose = o.pose || 'idle';
  const key = pose === 'walk' ? 'walk:' + (Math.floor(t / 6) % 6) : pose === 'warn' ? 'warn:' + Math.min(3, Math.floor((o.k ?? 1) * 3.99)) : pose === 'idle' ? 'idle:' + (Math.floor(t / 22) % 2) : pose;
  return drawBiped(spitterF, x, y, f, Object.assign({ key }, o));
};

// ---------------------------------------------------------------------------------------------------------------------
// PTERO: steel wings with teal skin panels, a long green head crest, the eye in the middle of its head
// ---------------------------------------------------------------------------------------------------------------------
function pteroFrame(k) {
  const [name, n] = k.split(':'), i = +n || 0, dive = name === 'dive', perch = name === 'perch';
  const B = buf(72, 84, 40, 44), flap = dive ? -0.45 : perch ? 1.2 : [-1.0, -0.5, 0.15, 0.7, 0.35, -0.45][i % 6];   // wing angle: - = up
  const span = perch ? 16 : 34;                                                                       // perched: wings folded
  // a wing seen from the side: the arm bone goes out from the shoulder, the skin hangs between it and the hips
  const wing = (b, far) => {
    const a = flap + (far ? 0.18 : 0), sn = Math.sin(a), cs = Math.cos(a), ox = far ? 3 : 0, oy = far ? -1 : 0;
    const s1 = [3 + ox, -3 + oy], s2 = [-11 + ox, oy], tip = [-9 - 6 * cs + ox, -2 + span * sn + oy];
    const el = [lerp(s1[0], tip[0], 0.45) + 3 * Math.abs(sn), lerp(s1[1], tip[1], 0.45)];           // the elbow juts forward
    const tr = [lerp(tip[0], s2[0], 0.5) + 3 * Math.abs(sn), lerp(tip[1], s2[1], 0.5)];             // the trailing edge curves in
    poly(b, [s1, el, tip, tr, s2], K0);                                                                // the skin
    capsule(b, s1[0], s1[1], el[0], el[1], 1.3, 1, K1); capsule(b, el[0], el[1], tip[0], tip[1], 1, 0.6, K1);   // the arm
    return [el, tip, tr, s2];
  };
  layer(B, b => wing(b, true), [[K0, TEAL.slice(0, 4), { depth: 3, amb: 0.4 }], [K1, STEELD, { depth: 2 }]]);
  // body: a small steel barrel with a green back, a tail fin, legs tucked
  const lean = dive ? 0.6 : perch ? -0.5 : 0;
  const rot = (px, py) => [px * Math.cos(lean) - py * Math.sin(lean), px * Math.sin(lean) + py * Math.cos(lean)];
  const hd = rot(9, -3), nk = rot(5, -1), tl = rot(-11, 1);
  const H = (px, py) => { const r = rot(px, py); return [hd[0] + r[0], hd[1] + r[1]]; };
  layer(B, b => {
    capsule(b, -4, 0, 4, -1, 4.4, 3.8, K0);
    capsule(b, tl[0], tl[1], -4, 0, 1, 2.6, K0);
    capsule(b, nk[0], nk[1], hd[0], hd[1], 2.6, 2.6, K0);
    poly(b, [H(-2, -3.8), H(4, -3.4), H(13, 0.2), H(13, 1.4), H(3, 3), H(-2, 2.8)], K0);                   // skull and long beak
    poly(b, [H(-1, -2.8), H(-13, -9.5), H(-10, -4.6), H(-2, 0)], K1);                                      // the head crest, swept back
    over(b, K0, K1, (t, m) => { capsule(t, -4, -2.8, 4, -3.6, 4.4, 3.8, m); });
    if (perch) { capsule(b, -3, 3, -3, 8.4, 1.1, 0.9, K2); capsule(b, 1, 3.4, 1, 8.4, 1.1, 0.9, K2); rect(b, -4, 9, 4, 1, K2); rect(b, 0, 9, 4, 1, K2); }   // standing
    else { capsule(b, -3, 3, -7, 5.5, 1.1, 0.8, K2); capsule(b, 0, 3.4, -4, 6, 1.1, 0.8, K2); }             // legs tucked back
  }, [[K0, STEEL, { depth: 3 }], [K1, GRN, { depth: 3, amb: 0.52 }], [K2, STEELD, { depth: 1 }]]);
  const eye = H(2.4, -0.4);
  bakeEye(B, eye[0], eye[1], 2.4);
  for (let j = 0; j < 3; j++) { const p = H(6 + j * 2.2, 2); put(B, p[0], p[1], BONE); }
  // near wing over the body, with two folds in the skin
  let w = null;
  layer(B, b => { w = wing(b, false); }, [[K0, TEAL, { depth: 3, amb: 0.5 }], [K1, STEEL, { depth: 2 }]]);
  for (const u of [0.35, 0.7]) { const ax = lerp(w[0][0], w[1][0], u), ay = lerp(w[0][1], w[1][1], u), bx = lerp(w[3][0], w[2][0], u), by = lerp(w[3][1], w[2][1], u); for (let q = 0.25; q < 0.95; q += 0.06) { const x = lerp(ax, bx, q), y = lerp(ay, by, q), c = get(B, x, y); if (TEAL.includes(c)) put(B, x, y, TEAL[1]); } }
  outline(B);
  const sp = mk(B);
  sp.eye = [Math.round(eye[0] - 0.5), Math.round(eye[1] - 0.5)]; sp.er = 2.4; sp.claw = [-3, 7];
  return sp;
}
const pteroF = frames(pteroFrame);
const EGG = M8.memo(() => {
  const b = buf(12, 14, 6, 7);
  oval(b, 0, 0.5, 4.2, 5.4, K0);
  form(b, K0, GRN.slice(1), { depth: 4, amb: 0.6 });
  rect(b, -4, 0, 9, 1, STEEL[2]); put(b, -1, 0, AMB[3]); put(b, 1, 0, AMB[3]);
  outline(b);
  return mk(b);
});
M8.egg = (x, y, t = G.t) => { blit(EGG(), x, y); if (Math.floor(t / 6) % 2) R(Math.round(x) - 1, Math.round(y) - 3, 2, 2, '#ff3b30'); };
M8.ptero = (x, y, f = -1, o = {}) => {
  const t = o.t ?? G.t, fr = pteroF(o.pose === 'dive' ? 'dive' : o.pose === 'perch' ? 'perch' : 'fly:' + (Math.floor(t / 5) % 6));
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(f, 1);
  if (o.egg) M8.egg(fr.claw[0], fr.claw[1] + 4, t);
  blit(fr, 0, 0);
  const lk = o.look || lookAt(x, y, f);
  liveEye(fr.eye[0], fr.eye[1], fr.er, lk[0], lk[1], o.mood, t);
  ctx.restore();
  return fr;
};
M8.eyeOf = (kind, pose, t = 0) => {
  const fr = kind === 'compy' ? compyF(pose === 'run' ? 'run:0' : pose) : kind === 'spitter' ? spitterF(pose === 'walk' ? 'walk:0' : pose === 'warn' ? 'warn:3' : pose) : kind === 'ptero' ? pteroF(pose === 'dive' ? 'dive' : 'fly:0') : raptorF(poseKey(pose, t));
  return fr.eye;
};

// ---------------------------------------------------------------------------------------------------------------------
// Pieces of a beaten robot: plates, a leg, a bolt, and the eye, which bounces away
// ---------------------------------------------------------------------------------------------------------------------
const BITS = M8.memo(() => {
  const bit = paint => { const b = buf(16, 16, 8, 8); paint(b); outline(b); const s = mk(b); return { img: s.img, white: s.white, w: s.w, h: s.h }; };
  return {
    plate: bit(b => { poly(b, [[-4, -2], [3, -3], [4, 2], [-3, 3]], K0); form(b, K0, GRN, { depth: 2 }); put(b, -2, -1, GRN[5]); }),
    plateT: bit(b => { poly(b, [[-4, -2], [3, -3], [4, 2], [-3, 3]], K0); form(b, K0, TEAL, { depth: 2 }); }),
    shard: bit(b => { poly(b, [[-3, -3], [2, -1], [3, 3], [-1, 1]], K0); form(b, K0, STEEL, { depth: 2 }); }),
    leg: bit(b => { capsule(b, -3, -3, 0, 0, 1.6, 1.2, K0); capsule(b, 0, 0, 3, 3, 1.2, 1, K0); form(b, K0, STEEL, { depth: 2 }); }),
    bolt: bit(b => { rect(b, -1, -1, 3, 3, STEEL[3]); put(b, -1, -1, STEEL[5]); put(b, 1, 1, STEEL[1]); }),
    eye: bit(b => { bakeEye(b, 0, 0, 2.6); rect(b, -1, -1, 2, 2, I('#ff3b30')); put(b, 0, 0, I('#1a0a12')); }),
    frill: bit(b => { poly(b, [[-4, 3], [0, -4], [4, 3]], K0); form(b, K0, VIO, { depth: 2 }); put(b, 0, 0, AMB[3]); })
  };
});
M8.bits = () => BITS();
// shared with the other Mission 8 art files
M8.art = { ik, layer, over, bakeEye, liveEye, lookAt, frames, stride, theropod, RAPT, drawBiped, K0, K1, K2, K3 };
M8.burst = (kind, x, y, f = 1) => {
  const S = BITS(), list = kind === 'compy' ? ['plate', 'bolt', 'eye'] : kind === 'ptero' ? ['plateT', 'plateT', 'shard', 'bolt', 'eye'] : kind === 'spitter' ? ['plate', 'frill', 'frill', 'leg', 'bolt', 'eye'] : ['plate', 'plate', 'shard', 'leg', 'leg', 'bolt', 'eye'];
  const h = kind === 'compy' ? 8 : 18;
  for (const k of list) {
    const eye = k === 'eye';
    G.parts.push({ type: 'sprite', s: S[k], x: x + rand(-8, 8), y: y - h + rand(-6, 6), vx: rand(-2.4, 2.4) + (eye ? f * 0.8 : 0), vy: rand(-4.6, -2) - (eye ? 1 : 0), g: 0.2, rot: rand(0, 6.28), vr: eye ? 0 : rand(-0.4, 0.4), life: eye ? 110 : rand(50, 80) | 0, max: eye ? 110 : 80 });
  }
};
}
