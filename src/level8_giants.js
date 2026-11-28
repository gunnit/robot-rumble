'use strict';
// =====================================================================================================================
// Mission 8 (DINOSAUR VALLEY): the looks of the giants. How they fight: level8_bosses.js, level8_chase.js.
//
//   M8.rex(x, y, facing, o)   the OGGLE REX, (x, y) = the ground under its hips. It is put together per frame from
//                             a body frame (legs, tail, torso, arms), a telescope neck and a head frame:
//                               o.body   'idle:0..1' | 'walk:0..7' | 'stomp:0' (foot up) | 'stomp:1' (foot down) |
//                                        'roar' | 'bite' | 'down'
//                               o.head   [x, y] of the jaw hinge in the Rex's own space (x forward, from the feet)
//                               o.ha     head angle in radians (+ = nose down), o.jaw 0 shut .. 1 wide open
//                               o.mood   'look' | 'warn' | 'hot' | 'charge' | 'dizzy' | 'off'   o.look [x, y]
//                               o.pilot  MEGA OGGLE in the glass dome: 'drive' | 'panic' | 'cheer' | 'ouch' | null
//                               o.patch  the sticking plaster on its snout (after its fall from the bridge)
//                             returns { eye: [x, y], snout: [x, y], mouth: [x, y], dome: [x, y], pipes } in world space
//   M8.REX                    the Rex's measures: HEAD (the hinge at rest), neck length, eye radius
//   M8.clubtail(x, y, facing, o)   CLUBTAIL the robot ankylosaur, (x, y) = the ground under its middle:
//                               o.pose   'walk' | 'idle' | 'hunker' | 'ball' | 'dizzy' | 'down'   o.t
//                               o.club   [x, y] of the tail's club in its own space (x forward), o.arm 0..1 its glow
//                               o.spin   the ball's turn (radians), o.spikes 0..1 (the back spikes light up)
//   M8.captain(x, y, facing, o)    MEGA OGGLE himself (he is tiny): o.pose 'sit' | 'drive' | 'panic' | 'cheer' |
//                               'ouch' | 'dizzy' | 'walk' | 'wave', o.t; (x, y) = his feet
//   M8.warm(...thunks), M8.pump()  big frames are painted when first needed; the mission paints them ahead of time,
//                               one per call of pump(), so no fight starts with a hitch. M8.queued(): how many wait
// Everything is private to the block. No random numbers: the art is the same on every run.
// =====================================================================================================================
{
const Math = globalThis.Math;
const { NONE, buf, put, get, rect, shape, oval, poly, line, capsule, tube, bez, outline, form, stamp, mk, blit } = M8.px;
const { ik, over, bakeEye, frames, K0, K1, K2, K3 } = M8.art;
const { STEEL, STEELD, GRN, GRND, AMB, BONE, BONED } = M8.PAL;
const I = M8.I, P = M8.P, OUTI = M8.OUTI, lerp = M8.lerp;
const BONES = [BONED, I('#cfc6b2'), BONE, I('#fbf7ea')];
const GUN = P('#14171d', '#1c2028', '#2a303a', '#3b424d', '#56606e');             // dark works: pipes, joints, pistons
const RED = I('#ff3b30'), REDD = I('#a3151a'), MOUTH = I('#4a141c'), MOUTHL = I('#7a2430');
const GLASS = I('#0d1a26');

// a layer like M8.art.layer, but lit in a buffer only as big as what was painted (the giants' canvases are large)
function part(B, paint, forms, lined = true) {
  const m = buf(B.w, B.h, B.ox, B.oy);
  paint(m);
  let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
  for (let y = 0; y < m.h; y++) { const r = y * m.w; for (let x = 0; x < m.w; x++) if (m.d[r + x] !== NONE) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 < 0) return m;
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(m.w - 1, x1 + 1); y1 = Math.min(m.h - 1, y1 + 1);
  const c = buf(x1 - x0 + 1, y1 - y0 + 1, m.ox - x0, m.oy - y0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.d[(y - y0) * c.w + (x - x0)] = m.d[y * m.w + x];
  for (const f of forms) form(c, f[0], f[1], f[2]);
  if (lined) outline(c);
  stamp(B, c);
  return c;
}
// a seam: the pixels of ramp `pal` along a line go two tones darker
function seam(B, x0, y0, x1, y1, pal, by = 2) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n), k = pal.indexOf(get(B, x, y));
    if (k > 0) put(B, x, y, pal[Math.max(0, k - by)]);
  }
}
// rank stripes: three yellow chevrons, 5 x 9, top left at (x - 1, y)
function stripes(B, x, y) {
  for (const k of [0, 3, 6]) { put(B, x - 1, y + k, AMB[3]); put(B, x, y + k + 1, AMB[3]); put(B, x + 1, y + k + 2, AMB[2]); put(B, x + 2, y + k + 1, AMB[3]); put(B, x + 3, y + k, AMB[3]); }
}
// a rivet: a light dot with a dark one under it, only on painted pixels
function rivet(B, x, y, pal) {
  if (pal.indexOf(get(B, x, y)) < 0) return;
  put(B, x, y, pal[pal.length - 1]);
  if (pal.indexOf(get(B, x, y + 1)) >= 0) put(B, x, y + 1, pal[1]);
}
const tri = (b, ax, ay, bx, by, cx, cy, c) => poly(b, [[ax, ay], [bx, by], [cx, cy]], c);
// big frames are painted ahead of time, one per pump()
const queue = [];
M8.warm = (...fs) => { for (const f of fs) queue.push(f); };
M8.pump = () => { const f = queue.shift(); if (f) f(); return queue.length; };
M8.queued = () => queue.length;

// =====================================================================================================================
// OGGLE REX
// =====================================================================================================================
const REX = { HEAD: [80, -112], NECK: [54, -96], ER: 7, HIP: 70, BODY: 52 };
M8.REX = REX;
// ---- the body: legs, tail, torso, arms. q: fa / fb = [x, y] of the near / far foot, dy hips down, lean + = nose
// down, tail angle (+ = up), sag, arm
function rexBody(q) {
  const B = buf(280, 176, 140, 164);
  const dy = q.dy || 0, hip = [0, -REX.HIP + dy], ba = 0.32 - (q.lean || 0), cs = Math.cos(ba), sn = Math.sin(ba);
  const C = [hip[0] + REX.BODY * cs, hip[1] - REX.BODY * sn];
  const nrm = [-sn, -cs];                                    // up, across the body
  const ta = q.tail ?? 0.12, E = [hip[0] - 106 * Math.cos(ta), hip[1] - 106 * Math.sin(ta)];
  const tailPts = bez([[hip[0] - 8, hip[1] - 1], [(hip[0] + E[0]) / 2, (hip[1] + E[1]) / 2 + 13 + (q.sag || 0)], E], 10);
  const tr = i => lerp(17, 3, i / 10);                       // the tail's radius at point i
  const leg = (F, far) => {
    const hj = [hip[0] + (far ? 6 : -1), hip[1] + 8], A = [F[0] - 11, F[1] - 18];
    return { hj, A, F, K: ik(hj[0], hj[1], A[0], A[1], 35, 31, -1) };
  };
  const LN = leg(q.fa, false), LF = leg(q.fb, true);
  const paintLeg = (b, L, m, mc) => {
    capsule(b, L.hj[0], L.hj[1], L.K[0], L.K[1], 14, 9.5, m);                       // thigh
    capsule(b, L.K[0], L.K[1], L.A[0], L.A[1], 7.5, 5.2, m);                         // shin
    capsule(b, L.A[0], L.A[1], L.F[0] - 1, L.F[1] - 5, 5.2, 4.6, m);                 // long foot bone
    capsule(b, L.F[0] - 3, L.F[1] - 4, L.F[0] + 15, L.F[1] - 3.5, 4, 3, m);          // toes
    tri(b, L.F[0] + 15, L.F[1] - 7, L.F[0] + 23, L.F[1] - 1, L.F[0] + 15, L.F[1] - 1, mc);   // claws
    tri(b, L.F[0] + 7, L.F[1] - 8, L.F[0] + 13, L.F[1] - 5, L.F[0] + 6, L.F[1] - 4, mc);
    tri(b, L.F[0] - 5, L.F[1] - 7, L.F[0] - 11, L.F[1] - 2, L.F[0] - 4, L.F[1] - 2, mc);
  };
  const arm = (b, m, mc, dx) => {
    const sh = [C[0] + 5 + dx, C[1] + 10], a = -0.95 + (q.arm || 0);
    const el = [sh[0] + Math.cos(a) * 9, sh[1] - Math.sin(a) * 9], hd = [el[0] + Math.cos(a + 1.25) * 8, el[1] - Math.sin(a + 1.25) * 8];
    capsule(b, sh[0], sh[1], el[0], el[1], 3.4, 2.6, m); capsule(b, el[0], el[1], hd[0], hd[1], 2.4, 1.8, m);
    tri(b, hd[0], hd[1] - 2, hd[0] + 5, hd[1] + 1, hd[0], hd[1] + 2, mc); tri(b, hd[0] - 2, hd[1], hd[0] + 2, hd[1] + 5, hd[0] - 2, hd[1] + 3, mc);
  };
  // far side: leg and arm, in shadow
  part(B, b => { paintLeg(b, LF, K0, K2); arm(b, K0, K2, 5); }, [[K0, STEELD, { depth: 5, amb: 0.66 }], [K2, [BONED, BONED], { depth: 1 }]]);
  // exhaust pipes behind the hips
  const pipes = [[hip[0] - 13, hip[1] - 26], [hip[0] - 23, hip[1] - 22]];
  part(B, b => { for (const [x, y] of pipes) { capsule(b, x + 3, y + 10, x, y, 3.6, 3.6, K0); rect(b, x - 5, y - 3, 10, 3, K0); } }, [[K0, GUN.slice(1), { depth: 3 }]]);
  for (const [x, y] of pipes) rect(B, x - 3, y - 2, 6, 1, GUN[0]);
  // the spine: bone-white blades along the back and the tail (they go under the armour's outline)
  part(B, b => {
    for (const u of [0.04, 0.3, 0.56, 0.82]) {
      const cx = lerp(hip[0], C[0], u), cy = lerp(hip[1], C[1], u), r = lerp(23, 18, u) - 2, tx = cx + nrm[0] * r, ty = cy + nrm[1] * r;
      tri(b, tx - cs * 5, ty + sn * 5, tx + nrm[0] * 11 - cs * 4, ty + nrm[1] * 11 + sn * 4, tx + cs * 5, ty - sn * 5, K2);
    }
    for (const i of [1, 3, 5, 7]) { const p = tailPts[i], r = tr(i), h = 4 + r * 0.45; tri(b, p[0] - 4, p[1] - r + 1, p[0] - 3, p[1] - r - h, p[0] + 5, p[1] - r + 1, K2); }
  }, [[K2, BONES, { depth: 2, amb: 0.6 }]]);
  // tail and torso: steel, with the Oggles' green armour over the back
  part(B, b => {
    tube(b, tailPts, 17, 3, K0);
    capsule(b, hip[0], hip[1], C[0], C[1], 23, 18, K0);
    over(b, K0, K1, (t, m) => {
      tube(t, tailPts.map((p, i) => [p[0], p[1] - tr(i) * 1.05]), 17, 2.5, m);
      capsule(t, hip[0] + nrm[0] * 20, hip[1] + nrm[1] * 20, C[0] + nrm[0] * 17, C[1] + nrm[1] * 17, 23, 18, m);
    });
  }, [[K0, STEEL, { depth: 10, amb: 0.46 }], [K1, GRN, { depth: 10, amb: 0.5 }]]);
  // armour plates: seams across the back and the tail, rivets along the armour's lower edge
  for (const u of [0.18, 0.44, 0.7, 0.96]) {
    const cx = lerp(hip[0], C[0], u), cy = lerp(hip[1], C[1], u);
    seam(B, cx, cy, cx + nrm[0] * 30, cy + nrm[1] * 30, GRN);
  }
  // the armour's lower edge is a darker band (it reads as a thick plate lying on the steel)
  for (let u = -0.3; u <= 1.25; u += 0.012) {
    const cx = lerp(hip[0], C[0], u), cy = lerp(hip[1], C[1], u);
    for (let k = 0; k < 30; k++) { const x = Math.round(cx + nrm[0] * k), y = Math.round(cy + nrm[1] * k), g = GRN.indexOf(get(B, x, y)); if (g >= 0) { put(B, x, y, GRN[1]); const g2 = GRN.indexOf(get(B, x + nrm[0] * 1.5, y + nrm[1] * 1.5)); if (g2 > 1) put(B, x + nrm[0] * 1.5, y + nrm[1] * 1.5, GRN[2]); break; } }
  }
  for (let i = 0; i <= 9; i++) for (let v = 0; v < 1; v += 0.2) {
    const p = [lerp(tailPts[i][0], tailPts[i + 1][0], v), lerp(tailPts[i][1], tailPts[i + 1][1], v)];
    for (let k = 20; k > -20; k--) { const g = GRN.indexOf(get(B, p[0], p[1] + k)); if (g >= 0) { put(B, p[0], p[1] + k, GRN[1]); break; } }
  }
  for (let i = 2; i <= 8; i += 2) { const p = tailPts[i]; seam(B, p[0], p[1] - tr(i) - 2, p[0] + 1, p[1] + tr(i) + 2, GRN); seam(B, p[0], p[1] - tr(i) - 2, p[0] + 1, p[1] + tr(i) + 2, STEEL, 1); }
  // the belly: ribs of darker steel
  for (const u of [0.2, 0.42, 0.64, 0.86]) { const cx = lerp(hip[0], C[0], u), cy = lerp(hip[1], C[1], u); seam(B, cx, cy + 2, cx - nrm[0] * 24, cy - nrm[1] * 24, STEEL, 1); }
  // the steel flank: three vent slots behind the shoulder, a row of bolts under the armour, a big shoulder bolt
  for (let k = 0; k < 3; k++) { const u = 0.5 + k * 0.1, cx = lerp(hip[0], C[0], u) - nrm[0] * 6, cy = lerp(hip[1], C[1], u) - nrm[1] * 6; line(B, cx, cy, cx - nrm[0] * 7, cy - nrm[1] * 7, GUN[1]); line(B, cx + 1, cy, cx + 1 - nrm[0] * 7, cy - nrm[1] * 7, STEEL[5]); }
  for (let u = 0.06; u < 0.98; u += 0.115) { const cx = lerp(hip[0], C[0], u) + nrm[0] * 1, cy = lerp(hip[1], C[1], u) + nrm[1] * 1; rivet(B, cx, cy, STEEL); }
  { const x = C[0] - 3, y = C[1] + 1; oval(B, x, y, 4.4, 4.4, GUN[1]); oval(B, x, y, 3, 3, GUN[3]); put(B, x - 0.5, y - 0.5, STEEL[5]); }
  // the Oggles' antenna on the hips
  { const ax = Math.round(hip[0] + nrm[0] * 22 + 8), ay = Math.round(hip[1] + nrm[1] * 22); part(B, b => { rect(b, ax, ay - 13, 1, 13, K0); rect(b, ax - 1, ay - 16, 3, 3, K1); }, [[K0, [STEEL[4], STEEL[4]], {}], [K1, [AMB[3], AMB[3]], {}]]); }
  // near side: the arm, then the leg with its armoured thigh
  part(B, b => arm(b, K0, K2, 0), [[K0, STEEL, { depth: 2 }], [K2, BONES, { depth: 1 }]]);
  part(B, b => {
    paintLeg(b, LN, K0, K2);
    over(b, K0, K1, (t, m) => capsule(t, LN.hj[0] - 1, LN.hj[1] - 2, lerp(LN.hj[0], LN.K[0], 0.66), lerp(LN.hj[1], LN.K[1], 0.66), 12, 8.5, m));
  }, [[K0, STEEL, { depth: 6, amb: 0.48 }], [K1, GRN, { depth: 6, amb: 0.52 }], [K2, BONES, { depth: 2, amb: 0.6 }]]);
  // joints: the knee and the ankle are dark discs with a bolt; a piston runs down the shin
  const joint = (x, y, r) => { oval(B, x, y, r, r, GUN[1]); oval(B, x, y, r - 1.2, r - 1.2, GUN[3]); put(B, x - 0.5, y - 0.5, STEEL[5]); };
  joint(LN.K[0], LN.K[1], 4.6); joint(LN.A[0], LN.A[1], 3.4);
  line(B, lerp(LN.K[0], LN.A[0], 0.18) + 3, lerp(LN.K[1], LN.A[1], 0.18), lerp(LN.K[0], LN.A[0], 0.85) + 2, lerp(LN.K[1], LN.A[1], 0.85), STEEL[5]);
  // three yellow stripes on the thigh plate (not a '!': that sign is kept for warnings)
  { const x = Math.round(lerp(LN.hj[0], LN.K[0], 0.3)) - 1, y = Math.round(lerp(LN.hj[1], LN.K[1], 0.3)) - 5; rect(B, x - 2, y - 1, 7, 11, GRN[1]); stripes(B, x, y); }
  for (const u of [0.1, 0.5]) rivet(B, lerp(LN.hj[0], LN.K[0], u) + 8, lerp(LN.hj[1], LN.K[1], u) - 2, GRN);
  outline(B);
  const sp = mk(B);
  sp.neck = [Math.round(C[0] + 3 + nrm[0] * 8), Math.round(C[1] + nrm[1] * 8)];
  sp.pipes = pipes.map(p => [p[0], p[1] - 4]);
  sp.fa = [LN.F[0] + 6, LN.F[1]]; sp.fb = [LF.F[0] + 6, LF.F[1]]; sp.hip = hip; sp.chest = C;
  return sp;
}
// a heavy two-legged walk at phase u: each foot is planted for most of the cycle (the body rides back over it),
// then swings forward in a high step
function rexStride(u, len, lift) {
  const f = v => { v = ((v % 1) + 1) % 1; return v < 0.62 ? [len * (0.5 - v / 0.62), 0] : [len * (-0.5 + (v - 0.62) / 0.38), -lift * Math.sin((v - 0.62) / 0.38 * Math.PI)]; };
  return [f(u), f(u + 0.5)];
}
function rexPose(k) {
  const [name, n] = k.split(':'), i = +n || 0;
  if (name === 'walk') {
    const u = i / 8, [fa, fb] = rexStride(u, 40, 13), bob = Math.abs(Math.sin(u * 2 * Math.PI));
    return { fa: [fa[0] + 2, fa[1]], fb: [fb[0] + 8, fb[1]], dy: 1 + bob * 3, lean: 0.03 * Math.sin(u * 4 * Math.PI), tail: 0.12 + 0.06 * Math.sin(u * 2 * Math.PI), arm: 0.25 * Math.sin(u * 2 * Math.PI) };
  }
  if (name === 'stomp') return i ? { fa: [26, 0], fb: [-8, 0], dy: 7, lean: 0.14, tail: 0.3, sag: -6, arm: 0.6 } : { fa: [22, -34], fb: [-4, 0], dy: -2, lean: -0.16, tail: -0.02, sag: 4, arm: -0.4 };
  if (name === 'roar') return { fa: [8, 0], fb: [-10, 0], dy: 3, lean: -0.2, tail: 0.34, sag: -8, arm: 0.9 };
  if (name === 'bite') return { fa: [14, 0], fb: [-12, 0], dy: 9, lean: 0.3, tail: 0.42, sag: -10, arm: 0.5 };
  if (name === 'down') return { fa: [30, 0], fb: [22, 0], dy: 36, lean: 0.34, tail: -0.14, sag: 12, arm: -0.2 };
  return { fa: [4, 0], fb: [-6, 0], dy: i ? 1.4 : 0, tail: 0.12 - i * 0.02, arm: i ? 0.08 : 0 };
}
const rexBodyF = frames(k => rexBody(rexPose(k)));

// ---- the head. Head space: x forward from the jaw hinge, y up. a = its angle (+ = nose down), jw = 0..1
const HA = [-0.6, -0.3, 0, 0.3, 0.6, 0.9, 1.2], HJ = [0, 0.5, 1];
function rexHead(a, jw, patch, open) {
  const B = buf(150, 150, 60, 70), ca = Math.cos(a), sa = Math.sin(a);
  const HD = (x, y) => [x * ca + y * sa, x * sa - y * ca];
  const ja = a + jw * 0.62, cj = Math.cos(ja), sj = Math.sin(ja), hg = HD(3, 0);
  const J = (x, y) => [hg[0] + (x - 3) * cj + y * sj, hg[1] + (x - 3) * sj - y * cj];
  const pl = (b, f, pts, c) => poly(b, pts.map(p => f(p[0], p[1])), c);
  // the inside of the mouth (seen when it opens)
  if (jw > 0.1) part(B, b => poly(b, [HD(2, -1), HD(46, -1), J(46, -3), J(2, -3)], K0), [[K0, [MOUTH, MOUTH, MOUTHL], { depth: 6, amb: 0.3 }]], false);
  // the lower jaw, its teeth pointing up
  part(B, b => {
    pl(b, J, [[-5, -1], [54, -2], [58, -5.5], [53, -11.5], [16, -14.5], [-5, -11]], K0);
    for (let x = 21; x <= 51; x += 6) pl(b, J, [[x, -2.5], [x + 4, -2.5], [x + 2, 3.2]], K2);
  }, [[K0, STEEL, { depth: 5, amb: 0.4 }], [K2, BONES, { depth: 1, amb: 0.7 }]]);
  for (let x = 6; x <= 46; x += 10) { const p = J(x, -8.5); rivet(B, p[0], p[1], STEEL); }
  { const p0 = J(0, -6), p1 = J(50, -7.5); seam(B, p0[0], p0[1], p1[0], p1[1], STEEL, 1); }
  // the skull: steel, green armour over the crown, big teeth along the upper jaw
  part(B, b => {
    pl(b, HD, [[-11, 5], [-9, 20], [3, 26.5], [21, 27], [34, 23], [48, 17.5], [58, 13.5], [62.5, 7], [61, 0], [30, -1.5], [0, -2.5], [-10, -1]], K0);
    for (let x = 15; x <= 55; x += 5.7) pl(b, HD, [[x, -0.5], [x + 4.6, -0.5], [x + 2.3, -7 + (x > 50 ? 1.5 : 0)]], K2);
    over(b, K0, K1, (t, m) => pl(t, HD, [[-12, 11.5], [-10, 21], [3, 28], [21, 28], [35, 24], [50, 18], [44, 14.5], [30, 16.5], [29, 11], [9, 10]], m));
  }, [[K0, STEEL, { depth: 7, amb: 0.48 }], [K1, GRN, { depth: 7, amb: 0.52 }], [K2, BONES, { depth: 2, amb: 0.7 }]]);
  // details: lip line and rivets, nostril, the jaw's hinge with its hazard plate, seams on the armour
  { const p0 = HD(12, 3), p1 = HD(59, 3.5); seam(B, p0[0], p0[1], p1[0], p1[1], STEEL, 1); }
  for (let x = 16; x <= 56; x += 8) { const p = HD(x, 6.5); rivet(B, p[0], p[1], STEEL); }
  { const p = HD(56.5, 9.5); rect(B, Math.round(p[0]) - 1, Math.round(p[1]) - 1, 2, 2, GUN[0]); }
  for (const x of [7, 33]) { const p0 = HD(x, 12), p1 = HD(x + 2, 28); seam(B, p0[0], p0[1], p1[0], p1[1], GRN); }
  for (let k = 0; k < 3; k++) { const p = HD(-7 + k * 3.2, 4.5 - k * 0.2), c = k % 2 ? GUN[1] : AMB[3]; rect(B, Math.round(p[0]) - 1, Math.round(p[1]) - 2, 3, 5, c); }
  { const p = HD(3, 0); oval(B, p[0], p[1], 5, 5, GUN[1]); oval(B, p[0], p[1], 3.4, 3.4, GUN[3]); put(B, p[0] - 0.5, p[1] - 0.5, STEEL[5]); }
  // the one eye
  const eye = HD(21, 13.5);
  bakeEye(B, eye[0], eye[1], REX.ER);
  // the plaster on its snout
  if (patch) {
    const pc = I('#f2d9c2'), pd = I('#c9a58a'), c = HD(43, 11);
    for (const [u, v, w, h] of [[-5, -1.5, 10, 3.4], [-1.7, -5, 3.4, 10]]) pl(B, (x, y) => [c[0] + x * ca + y * sa, c[1] + x * sa - y * ca], [[u, v], [u + w, v], [u + w, v + h], [u, v + h]], pc);
    for (const [u, v] of [[-3.5, 0], [3.5, 0], [0, 3.4], [0, -3.4]]) put(B, c[0] + u * ca + v * sa, c[1] + u * sa - v * ca, pd);
  }
  // the pilot's dome sits on the skull: here only its dark inside and its steel collar (the pilot and the glass
  // are drawn over the head, every frame)
  const dome = HD(1, 29);
  if (open) {
    // the dome has popped: the dark rim of the cockpit, the empty seat, a few teeth of glass left standing
    const G1 = I('#bfe9ff'), G2 = I('#78bed6');
    for (let k = -7; k <= 9; k++) for (const v of [25.6, 26.6]) { const q = HD(k, v); put(B, q[0], q[1], GLASS); }
    for (let u = -1; u <= 3; u++) for (let v = 27; v <= 32; v++) { const q = HD(u, v); put(B, q[0], q[1], v >= 32 ? STEEL[4] : u === 3 ? STEEL[1] : STEEL[2]); }
    for (const [u, v0, v1] of [[-7, 26, 31], [-8, 26, 28], [-6, 26, 28], [10, 26, 32], [9, 26, 29], [6, 26, 28]]) for (let v = v0; v <= v1; v++) { const q = HD(u, v); put(B, q[0], q[1], v === v1 ? G1 : G2); }
  } else oval(B, dome[0], dome[1], 10, 10, GLASS);
  for (let k = -9; k <= 9; k++) { const p = HD(1 + k, 24.5 - Math.abs(k) * 0.12); rect(B, Math.round(p[0]), Math.round(p[1]), 1, 2, k % 3 ? STEEL[3] : STEEL[4]); }
  outline(B);
  const sp = mk(B);
  const R2 = p => [Math.round(p[0]), Math.round(p[1])];
  sp.eye = R2([eye[0] - 0.5, eye[1] - 0.5]); sp.dome = R2(dome); sp.snout = R2(HD(60, 4)); sp.mouth = R2(HD(44, -7)); sp.bite = R2(J(44, -12));
  sp.a = a;
  return sp;
}
const rexHeadF = frames(k => { const [ai, ji, p] = k.split(':').map(Number); return rexHead(HA[ai], HJ[ji], !!(p & 1), !!(p & 2)); });
const headKey = (a, jw, patch, open) => clamp(Math.round((a - HA[0]) / 0.3), 0, HA.length - 1) + ':' + clamp(Math.round(jw * 2), 0, 2) + ':' + ((patch ? 1 : 0) + (open ? 2 : 0));
// neck rings (telescope segments) and the glass of the dome
const RING = M8.memo(() => [11, 10, 9].map(r => {
  const b = buf(r * 2 + 4, r * 2 + 4, r + 2, r + 2);
  oval(b, 0, 0, r, r, K0);
  over(b, K0, K1, (t, m) => oval(t, -1, -r * 1.05, r, r * 0.7, m));
  form(b, K0, STEEL, { depth: r * 0.8, amb: 0.44 }); form(b, K1, GRN, { depth: r * 0.8, amb: 0.5 });
  outline(b);
  return mk(b);
}));
const DOME = M8.memo(() => {
  const c = M8.px.canvasOf(24, 24), g = c.getContext('2d');
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  for (let y = -11; y <= 11; y++) for (let x = -11; x <= 11; x++) {
    const d = Math.hypot(x + 0.5, y + 0.5);
    if (d <= 10.6 && d > 9.4) px(x + 12, y + 12, 1, 1, y < -2 ? 'rgba(214,246,255,0.95)' : 'rgba(120,190,214,0.9)');
    else if (d <= 9.4) px(x + 12, y + 12, 1, 1, 'rgba(150,220,240,0.16)');
  }
  px(6, 5, 4, 1, 'rgba(255,255,255,0.9)'); px(5, 6, 2, 3, 'rgba(255,255,255,0.9)'); px(15, 16, 2, 1, 'rgba(255,255,255,0.45)');
  return c;
});
// the big eye's live part, in the head's own transform. (lx, ly) = where it looks, -1..1
function rexEye(ex, ey, lx, ly, mood, t) {
  if (mood === 'off') { R(ex - 4, ey, 9, 2, '#56606e'); R(ex - 2, ey - 1, 5, 1, '#3b424d'); return; }
  if (mood === 'dizzy') {
    const q = Math.floor(t / 4) % 4, S = ['.#####.', '.....#.', '.###.#.', '.#.#.#.', '.#...#.', '.#####.', '.......'];
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) {
      const [u, v] = q === 0 ? [i, j] : q === 1 ? [j, 6 - i] : q === 2 ? [6 - i, 6 - j] : [6 - j, i];
      if (S[v][u] === '#') R(ex - 3 + i, ey - 3 + j, 1, 1, '#1a0a12');
    }
    return;
  }
  const x = Math.round(ex + clamp(lx, -1, 1) * 3), y = Math.round(ey + clamp(ly, -1, 1) * 3);
  const blink = Math.floor(t / 4) % 2;
  const col = mood === 'hot' ? '#ff3b30' : mood === 'warn' ? (blink ? '#ffe063' : '#ffffff') : mood === 'charge' ? '#ffffff' : '#3fd15a';
  const dk = mood === 'hot' ? '#a3151a' : mood === 'warn' || mood === 'charge' ? col : '#1c7a34';
  R(x - 2, y - 3, 5, 7, col); R(x - 3, y - 2, 7, 5, col);
  R(x + 1, y + 2, 2, 1, dk); R(x + 2, y + 1, 1, 2, dk);
  if (mood !== 'charge') { R(x - 1, y - 1, 3, 3, '#1a0a12'); R(x - 2, y - 2, 2, 2, '#ffffff'); }
}
// MEGA OGGLE at the controls, behind the glass (drawn small: a green bell, one eye, the captain's cap)
function pilot(x, y, pose, t) {
  const bob = pose === 'panic' ? (Math.floor(t / 3) % 2) : pose === 'cheer' ? -(Math.floor(t / 6) % 2) * 2 : Math.floor(t / 14) % 2;
  y += bob;
  R(x - 4, y - 2, 9, 7, '#1c7a34'); R(x - 3, y - 4, 7, 2, '#2fae44'); R(x - 4, y - 2, 9, 1, '#2fae44'); R(x - 5, y + 3, 11, 2, '#12502a');
  R(x - 2, y - 2, 5, 5, '#f6fbff'); R(x - 1, y + 2, 3, 1, '#b9d0e4');
  if (pose === 'ouch') { R(x - 2, y, 5, 1, '#1a0a12'); }
  else { const ex = pose === 'panic' ? (Math.floor(t / 5) % 2 ? -1 : 1) : 1; R(x - 1 + ex, y - 1, 2, 2, '#ff3b30'); R(x + ex, y, 1, 1, '#1a0a12'); }
  // the cap
  R(x - 4, y - 6, 9, 2, '#1d2c5a'); R(x - 3, y - 8, 7, 2, '#f2f6fa'); R(x - 5, y - 4, 6, 1, '#101830'); R(x, y - 7, 2, 1, '#ffcf3a');
  // arms: on the levers, or up in the air
  if (pose === 'panic' || pose === 'cheer') { R(x - 6, y - 5, 2, 4, '#2fae44'); R(x + 5, y - 5, 2, 4, '#2fae44'); }
  else { R(x + 5, y + 1, 3, 2, '#2fae44'); R(x + 7, y - 1 + (Math.floor(t / 10) % 2), 1, 3, '#c3cdd8'); }
  if (pose === 'panic' && Math.floor(t / 4) % 3 === 0) { R(x - 7, y - 8, 1, 2, '#bfe9ff'); R(x + 8, y - 7, 1, 2, '#bfe9ff'); }
}
M8.rex = (x, y, f = -1, o = {}) => {
  const t = o.t ?? G.t, bd = rexBodyF(o.body || 'idle:0'), hp = o.head || REX.HEAD;
  const hd = rexHeadF(headKey(o.ha || 0, o.jaw || 0, o.patch, o.pilot === false));
  x = Math.round(x); y = Math.round(y);
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  // the neck: a piston rod with rings sliding on it, from the chest to the back of the skull
  const n0 = bd.neck, n1 = [hp[0] - 4 * Math.cos(o.ha || 0), hp[1] + 9 - 4 * Math.sin(o.ha || 0)];
  const mid = [(n0[0] + n1[0]) / 2 - 6, (n0[1] + n1[1]) / 2 - 10], len = Math.hypot(n1[0] - n0[0], n1[1] - n0[1]);
  const q = u => { const v = 1 - u; return [v * v * n0[0] + 2 * v * u * mid[0] + u * u * n1[0], v * v * n0[1] + 2 * v * u * mid[1] + u * u * n1[1]]; };
  if (!FLASH) { ctx.strokeStyle = '#1c2028'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(n0[0], n0[1]); ctx.quadraticCurveTo(mid[0], mid[1], n1[0], n1[1]); ctx.stroke(); ctx.strokeStyle = '#8a97a8'; ctx.lineWidth = 3; ctx.stroke(); }
  const rings = RING(), nr = clamp(Math.round(len / 13), 3, 6);
  for (let i = 0; i < nr; i++) { const p = q(nr === 1 ? 0.5 : i / (nr - 1) * 0.92 + 0.02); blit(rings[Math.min(2, Math.floor(i * 3 / nr))], p[0], p[1]); }
  blit(bd, 0, 0);
  blit(hd, hp[0], hp[1]);
  const lk = o.look || (() => { const p = G.p; if (!p) return [1, 0]; const dx = (p.x - (x + f * (hp[0] + hd.eye[0]))) * f, dy = (p.y - 16) - (y + hp[1] + hd.eye[1]), d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; })();
  if (!FLASH) rexEye(hp[0] + hd.eye[0], hp[1] + hd.eye[1], lk[0], lk[1], o.mood, t);
  if (o.pilot && !FLASH) pilot(hp[0] + hd.dome[0], hp[1] + hd.dome[1] + 1, o.pilot, t);
  if (o.pilot !== false) ctx.drawImage(DOME(), hp[0] + hd.dome[0] - 12, hp[1] + hd.dome[1] - 12);
  ctx.restore();
  const W2 = p => [x + f * (hp[0] + p[0]), y + hp[1] + p[1]];
  return { eye: W2(hd.eye), snout: W2(hd.snout), mouth: W2(hd.mouth), bite: W2(hd.bite), dome: W2(hd.dome), pipes: bd.pipes.map(p => [x + f * p[0], y + p[1]]), feet: [[x + f * bd.fa[0], y + bd.fa[1]], [x + f * bd.fb[0], y + bd.fb[1]]] };
};
// the measures of a pose without drawing it (hit boxes, where a bite lands)
M8.rexAt = (x, y, f, o) => {
  const hd = rexHeadF(headKey(o.ha || 0, o.jaw || 0, o.patch)), hp = o.head || REX.HEAD;
  const W2 = p => [x + f * (hp[0] + p[0]), y + hp[1] + p[1]];
  return { eye: W2(hd.eye), snout: W2(hd.snout), mouth: W2(hd.mouth), bite: W2(hd.bite), dome: W2(hd.dome) };
};
M8.rexWarm = patch => {
  for (const k of ['idle:0', 'idle:1', 'roar', 'stomp:0', 'stomp:1', 'bite', 'down']) M8.warm(() => rexBodyF(k));
  for (let i = 0; i < 8; i++) M8.warm(() => rexBodyF('walk:' + i));
  for (let a = 0; a < HA.length; a++) for (let j = 0; j < 3; j++) M8.warm(() => rexHeadF(a + ':' + j + ':' + (patch ? 1 : 0)));
  if (patch) M8.warm(() => rexHeadF(headKey(0, 0.5, true, true)));          // the head it ends with: its dome popped
};

// =====================================================================================================================
// CLUBTAIL (the robot ankylosaur)
// =====================================================================================================================
const CLUB = { TAIL: [-45, -22], REST: [-84, -37] };
M8.CLUB = CLUB;
// q: sw = leg swing (-1..1), dy = body down, head = head down (px), flat = lying on its belly (dizzy / beaten)
function clubBody(q) {
  const B = buf(160, 96, 78, 86), dy = q.dy || 0, sw = q.sw || 0, flat = !!q.flat;
  const by = -19 + dy;                                         // the middle of the body
  const legAt = (b, x, ph, m, mc) => {
    const s = flat ? (x < 0 ? -1 : 1) * 1.6 : Math.sin(ph) * sw, lift = flat ? 0 : Math.max(0, Math.cos(ph)) * Math.abs(sw) * 2.4;
    const fx = x + s * 6, fy = -3 - lift + (flat ? 1 : 0);
    capsule(b, x, by + 7, fx, fy, 5.8, 5, m);
    capsule(b, fx - 3, fy + 0.5, fx + 5, fy + 0.5, 3, 2.6, m);
    tri(b, fx + 5, fy - 2, fx + 9, fy + 2, fx + 5, fy + 2.5, mc); tri(b, fx + 1, fy - 1, fx + 4, fy + 2.5, fx, fy + 2.5, mc);
  };
  // far legs
  part(B, b => { legAt(b, -12, Math.PI, K0, K2); legAt(b, 30, 0, K0, K2); }, [[K0, STEELD, { depth: 3, amb: 0.62 }], [K2, [BONED, BONED], {}]]);
  // the tail's stub
  part(B, b => { capsule(b, -32, by - 1, CLUB.TAIL[0], CLUB.TAIL[1] + dy, 8, 6, K0); over(b, K0, K1, (t, m) => capsule(t, -32, by - 6, CLUB.TAIL[0], CLUB.TAIL[1] + dy - 5, 8, 6, m)); }, [[K0, STEEL, { depth: 4 }], [K1, GRN, { depth: 4, amb: 0.5 }]]);
  // the head: a low steel box with a beak, a green cap and two horns
  const hy = by + 2 + (q.head || 0), hx = 33 - (q.tuck || 0);
  part(B, b => {
    capsule(b, 24, by, hx + 4, hy - 4, 8, 7, K0);                                             // neck
    poly(b, [[hx - 1, hy - 9], [hx + 13, hy - 10], [hx + 21, hy - 5], [hx + 23, hy + 2], [hx + 20, hy + 7], [hx + 16, hy + 8], [hx + 1, hy + 8], [hx - 2, hy + 2]], K0);
    over(b, K0, K1, (t, m) => poly(t, [[hx - 3, hy - 11], [hx + 13, hy - 11], [hx + 20, hy - 6], [hx + 12, hy - 4], [hx - 3, hy - 3]], m));
    tri(b, hx - 1, hy - 8, hx - 6, hy - 15, hx + 4, hy - 9, K2); tri(b, hx + 20, hy + 6, hx + 25, hy + 9, hx + 18, hy + 9, K2);   // horn, beak tip
  }, [[K0, STEEL, { depth: 4, amb: 0.46 }], [K1, GRN, { depth: 3, amb: 0.52 }], [K2, BONES, { depth: 1, amb: 0.7 }]]);
  seam(B, hx + 6, hy + 3, hx + 21, hy + 3, STEEL, 1);                                          // the mouth
  put(B, hx + 19, hy - 2, GUN[0]);
  // the body: a steel belly under a great green shell of six plates
  const shTop = x => -Math.sqrt(Math.max(0, 1 - ((x + 2) / 41) ** 2)) * 23 + by - 1;
  part(B, b => {
    for (let x = -34; x <= 26; x += 12) { const y = shTop(x); tri(b, x - 4, y + 3, x - 3, y - 8, x + 5, y + 2, K2); }             // back spikes
    capsule(b, -30, by + 2, 26, by + 2, 13, 12, K0);
    shape(b, -46, by - 26, 42, by + 6, (x, y) => ((x + 2) / 41) ** 2 + ((y - by + 1) / 23) ** 2 <= 1 && y <= by + 5, K1);
    for (let x = -34; x <= 30; x += 12.8) tri(b, x - 3.5, by + 4, x + 3.5, by + 4, x, by + 11, K2);                                // rim spikes
  }, [[K0, STEEL, { depth: 6, amb: 0.44 }], [K1, GRN, { depth: 9, amb: 0.5 }], [K2, BONES, { depth: 2, amb: 0.65 }]]);
  for (let x = -40; x <= 36; x += 12) seam(B, x, by - 26, x + (x < -2 ? -2 : 2), by + 5, GRN);
  for (let x = -43; x <= 39; x++) { const g = GRN.indexOf(get(B, x, by + 5)); if (g >= 0) put(B, x, by + 5, GRN[1]); const h = GRN.indexOf(get(B, x, by + 4)); if (h > 1) put(B, x, by + 4, GRN[2]); }
  for (let x = -34; x <= 30; x += 12) rivet(B, x + 6, by + 1, GRN);
  { const x = -9, y = by - 13; rect(B, x - 2, y - 1, 7, 11, GRN[1]); stripes(B, x, y); }   // its stripes
  // antenna
  { const ax = 9, ay = Math.round(shTop(9)); part(B, b => { rect(b, ax, ay - 11, 1, 12, K0); rect(b, ax - 1, ay - 14, 3, 3, K1); }, [[K0, [STEEL[4], STEEL[4]], {}], [K1, [AMB[3], AMB[3]], {}]]); }
  // the eye
  const eye = [hx + 11, hy - 1];
  bakeEye(B, eye[0], eye[1], 4.4);
  // near legs
  part(B, b => { legAt(b, -21, 0, K0, K2); legAt(b, 21, Math.PI, K0, K2); }, [[K0, STEEL, { depth: 3, amb: 0.5 }], [K2, BONES, { depth: 1, amb: 0.7 }]]);
  outline(B);
  const sp = mk(B);
  sp.eye = [Math.round(eye[0] - 0.5), Math.round(eye[1] - 0.5)]; sp.er = 4.4; sp.tail = [CLUB.TAIL[0], CLUB.TAIL[1] + dy];
  sp.spikes = []; for (let x = -34; x <= 26; x += 12) sp.spikes.push([x - 3, Math.round(shTop(x)) - 8]);
  return sp;
}
function clubPose(k) {
  const [name, n] = k.split(':'), i = +n || 0;
  if (name === 'walk') { const a = i / 4 * Math.PI * 2; return { sw: Math.sin(a), dy: Math.abs(Math.cos(a)) < 0.5 ? 1 : 0 }; }
  if (name === 'hunker') return { dy: 5, head: 3, tuck: 3 };
  if (name === 'dizzy') return { dy: 8, flat: true, head: 6 };
  if (name === 'down') return { dy: 9, flat: true, head: 8, tuck: 2 };
  return { dy: i ? 1 : 0 };
}
const clubF = frames(k => clubBody(clubPose(k)));
// rolled up: a spiky green ball, its plates turning
function clubBall(i) {
  const B = buf(56, 56, 28, 28), a0 = i / 8 * Math.PI / 3, r = 18;
  part(B, b => {
    for (let k = 0; k < 6; k++) { const a = a0 + Math.PI / 6 + k * Math.PI / 3, c = Math.cos(a), s2 = Math.sin(a); tri(b, c * (r - 2) - s2 * 4, s2 * (r - 2) + c * 4, c * (r + 7), s2 * (r + 7), c * (r - 2) + s2 * 4, s2 * (r - 2) - c * 4, K2); }
    oval(b, 0, 0, r, r, K1);
  }, [[K1, GRN, { depth: 12, amb: 0.5 }], [K2, BONES, { depth: 2, amb: 0.65 }]]);
  for (let k = 0; k < 6; k++) { const a = a0 + k * Math.PI / 3; seam(B, Math.cos(a) * 5, Math.sin(a) * 5, Math.cos(a) * (r + 1), Math.sin(a) * (r + 1), GRN); }
  oval(B, 0, 0, 5.4, 5.4, GUN[1]); oval(B, 0, 0, 3.8, 3.8, STEEL[3]); put(B, -1, -1, STEEL[5]);
  for (let k = 0; k < 6; k++) { const a = a0 + Math.PI / 6 + k * Math.PI / 3; rivet(B, Math.cos(a) * 12, Math.sin(a) * 12, GRN); }
  outline(B);
  return mk(B);
}
const clubBallF = frames(k => clubBall(+k));
// the tail's links, and the club: a dark ball with bone spikes and a core that lights up before a slam
const LINK = M8.memo(() => [7, 6, 5].map(r => {
  const b = buf(r * 2 + 4, r * 2 + 4, r + 2, r + 2);
  oval(b, 0, 0, r, r, K0);
  over(b, K0, K1, (t, m) => oval(t, 0, -r * 0.9, r, r * 0.75, m));
  form(b, K0, STEEL, { depth: r * 0.8, amb: 0.44 }); form(b, K1, GRN, { depth: r * 0.8, amb: 0.5 });
  outline(b);
  return mk(b);
}));
const MACE = M8.memo(() => {
  const B = buf(40, 40, 20, 20), r = 9;
  part(B, b => {
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.2, c = Math.cos(a), s2 = Math.sin(a); tri(b, c * (r - 2) - s2 * 3, s2 * (r - 2) + c * 3, c * (r + 6), s2 * (r + 6), c * (r - 2) + s2 * 3, s2 * (r - 2) - c * 3, K2); }
    oval(b, 0, 0, r, r, K0);
  }, [[K0, GUN, { depth: 6, amb: 0.5 }], [K2, BONES, { depth: 2, amb: 0.65 }]]);
  oval(B, 0, 0, 3.4, 3.4, AMB[1]); oval(B, 0, 0, 2.2, 2.2, AMB[3]);
  outline(B);
  return mk(B);
});
M8.clubtail = (x, y, f = -1, o = {}) => {
  const t = o.t ?? G.t;
  x = Math.round(x); y = Math.round(y);
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  let out = { club: [x, y], eye: [x, y - 20], spikes: [] };
  if (o.pose === 'ball') {
    const i = ((Math.floor((o.spin || 0) / (Math.PI / 3) * 8) % 8) + 8) % 8;
    blit(clubBallF(i), 0, -20);
  } else {
    const key = o.pose === 'walk' ? 'walk:' + (Math.floor(t / 7) % 4) : o.pose === 'hunker' ? 'hunker' : o.pose === 'dizzy' ? 'dizzy' : o.pose === 'down' ? 'down' : 'idle:' + (Math.floor(t / 22) % 2);
    const fr = clubF(key), c = o.club || [CLUB.REST[0], CLUB.REST[1] + (Math.floor(t / 22) % 2)], a = fr.tail;
    // the tail: links along an arc from the stub to the club
    const dist = Math.hypot(c[0] - a[0], c[1] - a[1]), arc = o.arc ?? 0.3;
    const m = [(a[0] + c[0]) / 2 - (c[0] > a[0] ? 10 : 0), Math.min(a[1], c[1]) - dist * arc];
    const q = u => { const v = 1 - u; return [v * v * a[0] + 2 * v * u * m[0] + u * u * c[0], v * v * a[1] + 2 * v * u * m[1] + u * u * c[1]]; };
    let len = 0, prev = a; for (let i = 1; i <= 12; i++) { const p = q(i / 12); len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; }
    const links = LINK(), n = clamp(Math.round(len / 9), 3, 16);
    for (let i = 1; i < n; i++) { const p = q(i / n); blit(links[Math.min(2, Math.floor(i * 3 / n))], p[0], p[1]); }
    blit(MACE(), c[0], c[1]);
    if (o.arm > 0 && !FLASH) { M8.glow(c[0], c[1], 8 + o.arm * 10, '#ffcf3a', 0.35 + 0.45 * o.arm); R(Math.round(c[0]) - 1, Math.round(c[1]) - 1, 3, 3, Math.floor(t / 3) % 2 ? '#ffffff' : '#ffe063'); }
    blit(fr, 0, 0);
    if (!FLASH) {
      const lk = o.look || (() => { const p = G.p; if (!p) return [1, 0]; const dx = (p.x - x) * f, dy2 = (p.y - 16) - (y + fr.eye[1]), d = Math.hypot(dx, dy2) || 1; return [dx / d, dy2 / d]; })();
      M8.art.liveEye(fr.eye[0], fr.eye[1], fr.er, lk[0], lk[1], o.mood, t);
      // the back spikes light up one after the other before a volley
      if (o.spikes > 0) fr.spikes.forEach((p, i) => { if (o.spikes * fr.spikes.length > i) { R(p[0], p[1], 2, 3, Math.floor(t / 3) % 2 ? '#ffffff' : '#ffe063'); M8.glow(p[0] + 1, p[1] + 1, 7, '#ffcf3a', 0.5); } });
    }
    out = { club: [x + f * c[0], y + c[1]], eye: [x + f * fr.eye[0], y + fr.eye[1]], spikes: fr.spikes.map(p => [x + f * p[0], y + p[1]]) };
  }
  ctx.restore();
  return out;
};
M8.clubWarm = () => { for (const k of ['idle:0', 'idle:1', 'walk:0', 'walk:1', 'walk:2', 'walk:3', 'hunker', 'dizzy', 'down']) M8.warm(() => clubF(k)); for (let i = 0; i < 8; i++) M8.warm(() => clubBallF(i)); };

// =====================================================================================================================
// MEGA OGGLE himself: a tiny green bell with one eye and a captain's cap (his machines were built in his image)
// =====================================================================================================================
function captainFrame(k) {
  const [name, n] = k.split(':'), i = +n || 0;
  const B = buf(40, 40, 20, 34), sit = name === 'sit' || name === 'dizzy', up = name === 'panic' || name === 'cheer' || (name === 'wave' && i);
  const by = sit ? 2 : name === 'walk' && i ? -1 : 0, tilt = name === 'dizzy' ? 2 : 0;
  // feet
  part(B, b => {
    if (sit) { capsule(b, 3, -1.5, 8, -1.5, 2, 2, K0); capsule(b, 0, -1.5, 5, -1.5, 2, 2, K0); }
    else { const s = name === 'walk' ? (i ? 2 : -2) : 0; capsule(b, -4 + s, -1.5, -2 + s, -1.5, 2, 2, K0); capsule(b, 2 - s, -1.5, 4 - s, -1.5, 2, 2, K0); }
  }, [[K0, STEEL, { depth: 2 }]]);
  // arms behind the bell
  part(B, b => {
    const ay = -8 + by;
    if (up) { capsule(b, -6, ay, -9, ay - 6, 1.6, 1.4, K0); capsule(b, 6, ay, 9, ay - 6, 1.6, 1.4, K0); }
    else if (name === 'wave') { capsule(b, -6, ay, -8, ay + 3, 1.6, 1.4, K0); capsule(b, 6, ay, 10, ay - 4, 1.6, 1.4, K0); }
    else { capsule(b, -6, ay, -8, ay + 3, 1.6, 1.4, K0); capsule(b, 6, ay, 8, ay + 3, 1.6, 1.4, K0); }
  }, [[K0, GRND.slice(1), { depth: 2 }]]);
  // the bell
  part(B, b => shape(b, -9, -17 + by, 9, -2 + by, (x, y) => { const v = (y - (-15 + by)) / 12; return v >= 0 && v <= 1 && Math.abs(x) <= 4.6 + 3.4 * v * v + (v < 0.25 ? -(0.25 - v) * 8 : 0); }, K0), [[K0, GRN, { depth: 5, amb: 0.52 }]]);
  for (let x = -8; x <= 8; x++) { const g = GRN.indexOf(get(B, x, -4 + by)); if (g >= 0) put(B, x, -4 + by, GRN[1]); }
  for (const x of [-5, 0, 5]) rivet(B, x, -6 + by, GRN);
  // the eye
  const eye = [1, -10.5 + by];
  bakeEye(B, eye[0], eye[1], 2.6);
  // the captain's cap: white crown, dark band, a peak, a gold badge
  part(B, b => {
    const cy = -16 + by, cx = tilt;
    poly(b, [[cx - 5, cy - 4], [cx + 5, cy - 4], [cx + 6, cy - 1], [cx - 6, cy - 1]], K0);
    rect(b, cx - 6, cy - 1, 12, 2, K1); rect(b, cx + 1, cy + 1, 8, 1, K1);
  }, [[K0, [I('#c3cdd8'), I('#f2f6fa'), I('#ffffff')], { depth: 2, amb: 0.6 }], [K1, [I('#101830'), I('#1d2c5a')], { depth: 1, amb: 0.8 }]]);
  rect(B, tilt, -19 + by, 2, 2, AMB[3]);
  outline(B);
  const sp = mk(B);
  sp.eye = [Math.round(eye[0] - 0.5), Math.round(eye[1] - 0.5)]; sp.er = 2.6;
  return sp;
}
const captainF = frames(captainFrame);
M8.captain = (x, y, f = 1, o = {}) => {
  const t = o.t ?? G.t, pose = o.pose || 'idle';
  const key = pose === 'walk' ? 'walk:' + (Math.floor(t / 6) % 2) : pose === 'wave' ? 'wave:' + (Math.floor(t / 10) % 2) : pose === 'panic' ? 'panic:0' : pose;
  const fr = captainF(key);
  ctx.save(); ctx.translate(Math.round(x), Math.round(y) + (pose === 'panic' ? Math.floor(t / 3) % 2 : 0)); ctx.scale(f, 1);
  blit(fr, 0, 0);
  if (!FLASH) M8.art.liveEye(fr.eye[0], fr.eye[1], fr.er, o.look ? o.look[0] : 1, o.look ? o.look[1] : 0, pose === 'dizzy' ? 'dizzy' : pose === 'ouch' ? 'off' : 'look', t);
  ctx.restore();
  return fr;
};
}
