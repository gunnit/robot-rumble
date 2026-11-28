'use strict';
// =====================================================================================================================
// Mission 8 (DINOSAUR VALLEY) cast, part 2: the REAL dinosaurs (warm colours, soft shapes, a kind dark eye: nothing
// like the green one-eyed robots) and the things of the valley. Painted like the robots (level8_cast.js): pose
// numbers -> pixel buffer -> lit, outlined, baked at first use.
//
//   M8.tops(x, y, facing, o)       TOPS, the young triceratops the hero rides. o.pose 'idle' | 'walk' | 'jab' |
//                                  'charge' | 'hop' | 'happy' | 'sad'; o.k 0..1 = how far a jab is out. Returns the
//                                  frame: .seat = [x, y] where a rider's feet go (from the feet point, facing right),
//                                  .horn = the tip of the brow horn. o.rider(frame) is called just before TOPS is drawn
//   M8.hatchling(x, y, facing, o)  a baby dinosaur. o.v 0 three-horn, 1 long-neck, 2 plate-back, 3 duck-bill;
//                                  o.pose 'sit' | 'hop' | 'run'
//   M8.cage(x, y, part, t)         the Oggles' cage, 28 x 26, standing on (x, y): part 'back' | 'front'
//   M8.amber(x, y, t)              an amber block, 16 x 16, its top-left corner at (x, y)
//   M8.bush(x, y)                  a fern bush (a robot raptor's hiding place)
//   M8.nest(x, y, rock, t, hp)     a robot nest: three eggs in a steel cradle; rock > 0 = the middle egg is hatching
//   M8.wall(x, y, hp)              a boulder wall, 44 x 54 (hp 0..1: it cracks)
// Drawing never calls Math.random() / rand().
// =====================================================================================================================
{
const Math = globalThis.Math;
const { NONE, buf, put, get, rect, shape, oval, poly, line, capsule, tube, bez, outline, form, stamp, mk, blit, blitF } = M8.px;
const I = M8.I, P = M8.P, OUTI = M8.OUTI, lerp = M8.lerp;
const { ik, layer, over, frames, K0, K1, K2, K3 } = M8.art;
const STEEL = M8.PAL.STEEL, STEELD = M8.PAL.STEELD, GRN = M8.PAL.GRN, AMB = M8.PAL.AMB;

const ORA = P('#6a2a14', '#9a4218', '#c85e1e', '#e8802a', '#f6a84a', '#ffd08a');     // TOPS's hide
const ORAD = P('#4a1c0e', '#6a2a14', '#8a3a16', '#b0501c');                          // legs on the far side
const CRM = P('#8a6a3a', '#b8935a', '#dcc08a', '#f2e2b8', '#fff6dc');                // belly, beak
const FRL = P('#5a1420', '#8a1c28', '#b82e2e', '#dc4a36', '#f47a50');                // frill
const IVO = P('#8a7a5a', '#c8b890', '#f0e6c8', '#fffbe8');                           // horns
const BLU = P('#16205a', '#2440a0', '#3f6ad8', '#7aa4ff');                           // saddle blanket
const LEA = P('#3a2010', '#5e3618', '#8a5226', '#b87838');                           // leather
const ROCK = P('#2e2620', '#4a3e34', '#6a5a4a', '#8d7a66', '#b09a80', '#d0bc9c');
const LEAF = P('#0c2a14', '#144a1c', '#1e7026', '#34982e', '#62c040', '#a0e060');
const HONEY = P('#7a3a08', '#b8660c', '#e89818', '#ffc83a', '#ffe88a', '#fff8d0');
const GOLD = I('#ffd23f'), GOLDD = I('#c08a12'), INK = I('#1a1420'), WHITE = I('#ffffff'), BLUSH = I('#ff9a7a');
M8.PAL2 = { ORA, CRM, FRL, IVO, BLU, ROCK, LEAF, HONEY };

// ---------------------------------------------------------------------------------------------------------------------
// TOPS. Pose q: dy (body up - / down +), dip (shoulders down), nh nf fh ff = [dx, lift] of the near hind, near front,
// far hind and far front foot, head (angle, + = up), hx (head pushed forward), tail (+ = up), eye 'open' | 'happy' |
// 'sad', mouth 0..1
// ---------------------------------------------------------------------------------------------------------------------
function topsFrame(q) {
  const B = buf(110, 72, 48, 64);
  const dy = q.dy || 0, dip = q.dip || 0, ha = q.head || 0, ca = Math.cos(ha), sa = Math.sin(ha);
  const hip = [-13, -17 + dy], sh = [9, -16 + dy + dip];
  const N = [sh[0] + 6 + (q.hx || 0), sh[1] - 2];                               // where the head turns
  const HD = (px, py) => [N[0] + px * ca - py * sa, N[1] - px * sa - py * ca];   // head space: x forward, y up
  const HI = (x, y) => { const dx = x - N[0], dY = y - N[1]; return [dx * ca - dY * sa, -(dx * sa + dY * ca)]; };   // and back
  const hd = Q => Q.map(p => HD(p[0], p[1]));
  const legOf = (root, f, front) => {
    const foot = [root[0] + f[0] + (front ? 1 : -1), Math.min(0, f[1])], r = [root[0], root[1] + 3];
    return { root: r, knee: ik(r[0], r[1], foot[0], foot[1] - 3, 7.5, 7, front ? 1 : -1), foot };
  };
  const paintLeg = (b, L, m) => {
    capsule(b, L.root[0], L.root[1], L.knee[0], L.knee[1], 4.2, 3.3, m);
    capsule(b, L.knee[0], L.knee[1], L.foot[0], L.foot[1] - 3, 3.3, 2.9, m);
    rect(b, L.foot[0] - 3, L.foot[1] - 3, 7, 3, m);
  };
  const nails = (L, c) => { put(B, L.foot[0] + 1, L.foot[1] - 1, c); put(B, L.foot[0] + 3, L.foot[1] - 1, c); };
  const FH = legOf([hip[0] + 3, hip[1]], q.fh, false), FF = legOf([sh[0] + 3, sh[1]], q.ff, true);
  const NH = legOf([hip[0] - 1, hip[1]], q.nh, false), NF = legOf([sh[0] - 1, sh[1]], q.nf, true);
  layer(B, b => { paintLeg(b, FH, K0); paintLeg(b, FF, K0); }, [[K0, ORAD, { depth: 3 }]]);
  nails(FH, CRM[1]); nails(FF, CRM[1]);
  // the far brow horn
  layer(B, b => { const a = HD(6.5, 5), t = HD(19.5, 12.5); capsule(b, a[0], a[1], t[0], t[1], 1.8, 0.6, K0); }, [[K0, IVO.slice(0, 3), { depth: 2 }]]);
  // tail, body, neck
  const tw = q.tail || 0;
  const tailPts = bez([[hip[0] - 5, hip[1] - 1], [hip[0] - 14, hip[1] - 2 - tw * 3], [hip[0] - 20, hip[1] + 7 - tw * 9]], 8);
  layer(B, b => {
    tube(b, tailPts, 5.2, 1.3, K0);
    capsule(b, hip[0], hip[1], sh[0], sh[1], 9, 9.5, K0);
    capsule(b, sh[0], sh[1] - 1, N[0] - 1, N[1], 7.5, 6, K0);
    over(b, K0, K1, (t, m) => {                                                   // cream belly and under the tail
      capsule(t, hip[0] + 2, hip[1] + 9, sh[0] + 2, sh[1] + 9.5, 6, 6.5, m);
      tube(t, tailPts.map(p => [p[0], p[1] + 4.5]), 3.6, 0.8, m);
    });
  }, [[K0, ORA, { depth: 6 }], [K1, CRM, { depth: 4, amb: 0.5 }]]);
  // darker spots along the back
  for (let i = 0; i < 9; i++) {
    const x = Math.round(lerp(hip[0] - 8, sh[0] + 4, hsh(i * 7.3 + 1))), y = Math.round(lerp(hip[1] - 7, hip[1] - 1, hsh(i * 3.1 + 2)));
    for (const [ax, ay] of [[0, 0], [1, 0], [0, 1]]) { const c = get(B, x + ax, y + ay); if (c === ORA[3] || c === ORA[4] || c === ORA[5]) put(B, x + ax, y + ay, ORA[2]); }
  }
  // saddle: a blue blanket with a gold hem, a leather seat and a girth
  {
    const b = buf(B.w, B.h, B.ox, B.oy), x0 = -11, x1 = 2;
    for (let x = x0; x <= x1; x++) {
      let top = null;
      for (let y = -40; y < -8; y++) if (get(B, x, y) !== NONE && get(B, x, y) !== OUTI) { top = y; break; }
      if (top == null) continue;
      const bot = Math.round(-19.5 + dy + (x === x0 || x === x1 ? -1 : 0));
      for (let y = top - 1; y <= bot; y++) put(b, x, y, K0);
    }
    form(b, K0, BLU, { depth: 3, amb: 0.55 });
    for (let x = x0; x <= x1; x++) for (let y = -8; y > -40; y--) if (get(b, x, y) !== NONE) { put(b, x, y, GOLD); if ((x - x0) % 3 === 1) put(b, x, y - 2, GOLDD); break; }
    capsule(b, -8, -27.5 + dy, -1, -27.5 + dy, 1.8, 1.8, K1); form(b, K1, LEA, { depth: 2 });
    outline(b); stamp(B, b);
    for (let y = Math.round(-19 + dy); y < -6; y++) { const c = get(B, -5, y); if (c !== NONE && c !== OUTI) { put(B, -5, y, LEA[1]); put(B, -4, y, LEA[2]); } }
  }
  // near legs
  layer(B, b => { paintLeg(b, NH, K0); paintLeg(b, NF, K0); }, [[K0, ORA.slice(0, 5), { depth: 3 }]]);
  nails(NH, CRM[3]); nails(NF, CRM[3]);
  // frill: cream rim, red shield, an orange eye-spot
  layer(B, b => {
    const el = (cx, cy, rx, ry, m) => shape(b, N[0] - 16, N[1] - 22, N[0] + 12, N[1] + 8, (x, y) => { const h = HI(x, y); return ((h[0] - cx) / rx) ** 2 + ((h[1] - cy) / ry) ** 2 <= 1; }, m);
    el(-2.5, 6, 7, 10, K0); el(-2.8, 6.2, 5, 7.8, K1); el(-3, 7.5, 2.2, 3, K2);
  }, [[K0, CRM.slice(1), { depth: 2, amb: 0.6 }], [K1, FRL, { depth: 4, amb: 0.5 }], [K2, ORA.slice(2), { depth: 2, amb: 0.6 }]]);
  for (let i = 0; i < 6; i++) { const a = 0.5 + i * 0.52, p = HD(-2.5 - Math.cos(a) * 6.6, 6 + Math.sin(a) * 9.6); const c = get(B, p[0], p[1]); if (c !== NONE && c !== OUTI) put(B, p[0], p[1], CRM[1]); }   // notches in the rim
  // skull, beak, lower jaw
  const open = q.mouth || 0;
  layer(B, b => {
    poly(b, hd([[-3, 4], [4, 5.5], [10, 4.2], [15, 1.8], [18.5, -0.4], [19, -2.6], [16.5, -3.6], [3, -3.8], [-3, -3]]), K0);
    poly(b, hd([[-3, -2.4], [15.5, -3 - open * 1.2], [14, -5.6 - open * 2.4], [11, -7 - open * 2.2], [3, -7.2 - open], [-3, -4.4]]), K2);
    over(b, K0, K1, (t, m) => poly(t, hd([[14.8, 3], [20, 1], [20, -6], [15.8, -6], [14.4, -3]]), m));
  }, [[K0, ORA, { depth: 4 }], [K1, CRM.slice(0, 4), { depth: 2, amb: 0.42 }], [K2, CRM, { depth: 2, amb: 0.55 }]]);
  if (open > 0.3) { const a = HD(7, -3.4), c = HD(14.5, -3.6 - open); line(B, a[0], a[1], c[0], c[1], I('#7a1c28')); const tg = HD(11, -4.4 - open * 0.6); put(B, tg[0], tg[1], I('#ff7a8a')); }
  else { const a = HD(7.5, -3.3), c = HD(17.5, -3.1); line(B, a[0], a[1], c[0], c[1], ORA[0]); const sm = HD(6.8, -2.4); put(B, sm[0], sm[1], ORA[0]); }
  { const n = HD(17, 0.3); put(B, n[0], n[1], ORA[0]); }
  // horns
  layer(B, b => { const a = HD(13.4, 2.4), t = HD(15.4, 7.4); capsule(b, a[0], a[1], t[0], t[1], 1.8, 0.6, K0); }, [[K0, IVO, { depth: 2 }]]);
  let hornTip = null;
  layer(B, b => { const a = HD(5, 4.6), t = HD(18.5, 13.2); hornTip = t; capsule(b, a[0], a[1], t[0], t[1], 2.2, 0.6, K0); }, [[K0, IVO, { depth: 2, amb: 0.6 }]]);
  // the eye and a rosy cheek
  {
    const e = HD(7.6, 1.6), ex = Math.round(e[0]), ey = Math.round(e[1]);
    if (q.eye === 'happy') { put(B, ex - 1, ey + 1, INK); put(B, ex, ey, INK); put(B, ex + 1, ey, INK); put(B, ex + 2, ey + 1, INK); }
    else {
      rect(B, ex - 1, ey - 1, 3, 3, INK); put(B, ex - 1, ey - 1, WHITE);
      if (q.eye === 'sad') { put(B, ex - 1, ey - 2, ORA[1]); put(B, ex, ey - 2, ORA[1]); put(B, ex + 1, ey - 1, ORA[1]); put(B, ex - 1, ey - 1, INK); put(B, ex, ey, WHITE); }
    }
    const c = HD(9.6, -1.4); put(B, c[0], c[1], BLUSH); put(B, c[0] + 1, c[1], BLUSH);
  }
  outline(B);
  const sp = mk(B);
  sp.seat = [-5, Math.round(-18 + dy)]; sp.horn = hornTip.map(Math.round);
  return sp;
}
const gait = (len, lift) => v => { v = ((v % 1) + 1) % 1; return v < 0.55 ? [len * (0.5 - v / 0.55), 0] : [len * (-0.5 + (v - 0.55) / 0.45), -lift * Math.sin((v - 0.55) / 0.45 * Math.PI)]; };
function topsPose(k) {
  const [name, n] = k.split(':'), i = +n || 0;
  if (name === 'walk') { const u = i / 6, g = gait(9, 3); return { nh: g(u), ff: g(u + 0.05), nf: g(u + 0.5), fh: g(u + 0.55), dy: i % 3 === 1 ? -1 : 0, head: 0.05 * Math.sin(u * 2 * Math.PI), tail: 0.3 * Math.sin(u * 2 * Math.PI) }; }
  if (name === 'charge') { const u = i / 4, g = gait(13, 6); return { nf: g(u), ff: g(u + 0.12), nh: g(u + 0.5), fh: g(u + 0.62), dy: [0, -2, -1, 1][i], dip: 2, head: -0.52, hx: 4, tail: 0.9, eye: 'open' }; }
  if (name === 'jab') { const j = [0.3, 1, 1, 0.55][i]; return { nh: [-2, 0], fh: [-1, 0], nf: [2 + 3 * j, 0], ff: [3 + 3 * j, 0], dip: 2 * j, head: -0.1 - 0.42 * j, hx: 9 * j, tail: 0.6 * j }; }
  if (name === 'hop') return { nh: [-3, -4], fh: [-2, -5], nf: [3, -5], ff: [4, -4], head: 0.15, tail: 0.5, eye: 'happy' };
  if (name === 'happy') return { nh: [-1, 0], fh: [1, 0], nf: [1, i ? -3 : 0], ff: [2, i ? -2 : 0], dy: i ? -2 : 0, head: 0.34 - i * 0.1, tail: 0.8, eye: 'happy', mouth: 1 };
  if (name === 'sad') return { nh: [-1, 0], fh: [1, 0], nf: [1, 0], ff: [2, 0], dy: 1, dip: 1, head: -0.3, tail: -0.5, eye: 'sad' };
  return { nh: [-1, 0], fh: [1, 0], nf: [1, 0], ff: [2, 0], dy: i ? 1 : 0, tail: i ? 0.1 : 0 };
}
const topsF = frames(k => topsFrame(topsPose(k)));
M8.tops = (x, y, f = 1, o = {}) => {
  const t = o.t ?? G.t, pose = o.pose || 'idle';
  const key = pose === 'walk' ? 'walk:' + (Math.floor(t / 5) % 6) : pose === 'charge' ? 'charge:' + (Math.floor(t / 3) % 4) : pose === 'jab' ? 'jab:' + Math.min(3, Math.floor((o.k ?? 1) * 3.99))
    : pose === 'happy' ? 'happy:' + (Math.floor(t / 8) % 2) : pose === 'idle' ? 'idle:' + (Math.floor(t / 26) % 2) : pose;
  const fr = topsF(key);
  if (o.rider) o.rider(fr);      // whoever sits on it is drawn first: the frill and the horns go in front
  blitF(fr, x, y, f);
  return fr;
};
M8.topsFrame = k => topsF(k);

// ---------------------------------------------------------------------------------------------------------------------
// HATCHLINGS: four baby dinosaurs. Tiny, round, big-eyed.
// ---------------------------------------------------------------------------------------------------------------------
const BABY = [
  { skin: ORA.slice(1), belly: CRM.slice(1) },
  { skin: P('#123a5a', '#1c5a8a', '#2e86c0', '#5ab4e8', '#a0dcff'), belly: P('#7a9ab0', '#b0d0e0', '#e0f4ff') },
  { skin: P('#1c4a14', '#2e7a1e', '#52a82e', '#86d048', '#c8f080'), belly: P('#9a9a50', '#d8d890', '#fffcc8'), extra: P('#b85a10', '#f08a1c', '#ffc24a') },
  { skin: P('#5a1440', '#8a2060', '#c03a88', '#e870b0', '#ffb0d8'), belly: P('#b08a9a', '#e8c8d4', '#fff0f6'), extra: P('#b87010', '#f0a020', '#ffd060') }
];
// pose: bob (body up -), legs 0 standing | 1 | 2 running | 3 tucked, eye 'open' | 'happy' | 'sad'
function babyFrame(v, q) {
  const B = buf(40, 36, 18, 30), C = BABY[v], bob = q.bob || 0, lg = q.legs || 0;
  const far = C.skin.slice(0, 3);
  const stub = (b, x, len, ph, m) => {
    const dx = lg === 1 ? ph : lg === 2 ? -ph : 0, up = lg === 3 ? 2 : 0;
    capsule(b, x, -len - 1 + bob, x + dx * 2, -1 - up, 1.7, 1.5, m);
  };
  let eye = null;
  if (v === 0) {            // three-horn: a big head, a little frill, horn buds
    layer(B, b => { stub(b, -3, 3, -1, K0); stub(b, 4, 3, 1, K0); }, [[K0, far, { depth: 2 }]]);
    layer(B, b => {
      capsule(b, -6, -7 + bob, -11, -4 + bob, 2.6, 0.8, K0); oval(b, -1, -7 + bob, 6.6, 5, K0);
      over(b, K0, K1, (t, m) => oval(t, -1, -3.6 + bob, 6, 2.6, m));
    }, [[K0, C.skin, { depth: 4 }], [K1, C.belly, { depth: 2 }]]);
    layer(B, b => { stub(b, -5, 3, 1, K0); stub(b, 2, 3, -1, K0); }, [[K0, C.skin, { depth: 2 }]]);
    layer(B, b => { oval(b, 2.4, -12.5 + bob, 3.2, 5, K0); oval(b, 2.4, -12.5 + bob, 2, 3.6, K1); }, [[K0, CRM.slice(1), { depth: 2, amb: 0.6 }], [K1, FRL.slice(1), { depth: 2 }]]);
    layer(B, b => { oval(b, 6.5, -9.5 + bob, 5, 4.6, K0); over(b, K0, K1, (t, m) => rect(t, 10, -10 + bob, 4, 6, m)); }, [[K0, C.skin, { depth: 3 }], [K1, CRM.slice(1), { depth: 2 }]]);
    put(B, 5, -15 + bob, IVO[2]); put(B, 6, -16 + bob, IVO[3]); put(B, 10, -14 + bob, IVO[2]);
    eye = [7, -11 + bob];
  } else if (v === 1) {     // long-neck
    layer(B, b => { stub(b, -4, 3, -1, K0); stub(b, 3, 3, 1, K0); }, [[K0, far, { depth: 2 }]]);
    layer(B, b => {
      capsule(b, -7, -6.5 + bob, -14, -2.5 + bob, 2.6, 0.7, K0); oval(b, -2, -6.5 + bob, 7, 4.6, K0);
      capsule(b, 2.5, -8 + bob, 8, -17 + bob, 2.6, 1.9, K0); oval(b, 9.6, -18 + bob, 3.4, 2.6, K0);
      over(b, K0, K1, (t, m) => { oval(t, -2, -3.6 + bob, 6.4, 2.4, m); capsule(t, 4.5, -8 + bob, 9.6, -16 + bob, 1.3, 1, m); });
    }, [[K0, C.skin, { depth: 4 }], [K1, C.belly, { depth: 2 }]]);
    layer(B, b => { stub(b, -6, 3, 1, K0); stub(b, 1, 3, -1, K0); }, [[K0, C.skin, { depth: 2 }]]);
    for (const [x, y] of [[-5, -9], [-2, -10], [1, -9]]) put(B, x, y + bob, C.skin[1]);
    eye = [10, -19 + bob];
  } else if (v === 2) {     // plate-back
    layer(B, b => { stub(b, -4, 3, -1, K0); stub(b, 3, 3, 1, K0); }, [[K0, far, { depth: 2 }]]);
    layer(B, b => { for (const [x, h] of [[-6, 3], [-2.5, 5], [1.5, 5], [5, 3]]) poly(b, [[x - 2, -10.5 + bob], [x, -11.5 - h + bob], [x + 2, -10.5 + bob]], K0); }, [[K0, C.extra, { depth: 2, amb: 0.6 }]]);
    layer(B, b => {
      capsule(b, -7, -6.5 + bob, -14, -7.5 + bob, 2.6, 0.8, K0); oval(b, -1, -6.8 + bob, 7.6, 5.2, K0); oval(b, 8, -5.6 + bob, 3.8, 3, K0);
      over(b, K0, K1, (t, m) => oval(t, -1, -3.2 + bob, 7, 2.4, m));
    }, [[K0, C.skin, { depth: 4 }], [K1, C.belly, { depth: 2 }]]);
    layer(B, b => { stub(b, -6, 3, 1, K0); stub(b, 2, 3, -1, K0); }, [[K0, C.skin, { depth: 2 }]]);
    put(B, -14, -9 + bob, IVO[3]); put(B, -12, -10 + bob, IVO[3]);
    eye = [8, -7 + bob];
  } else {                  // duck-bill: on two legs, a crest swept back
    layer(B, b => stub(b, 0, 5, -1, K0), [[K0, far, { depth: 2 }]]);
    layer(B, b => { capsule(b, 6, -19.5 + bob, 2.5, -22.5 + bob, 1.6, 1.1, K0); }, [[K0, C.skin.slice(2), { depth: 2 }]]);
    layer(B, b => {
      capsule(b, -5, -9 + bob, -13, -5.5 + bob, 2.8, 0.7, K0); oval(b, -1, -9 + bob, 5.6, 4.6, K0);
      capsule(b, 2.6, -11 + bob, 6, -16 + bob, 2.4, 2, K0); oval(b, 7.4, -17 + bob, 3.6, 2.8, K0);
      over(b, K0, K1, (t, m) => oval(t, 0, -6 + bob, 4.6, 2.4, m));
      capsule(b, 9.4, -16.4 + bob, 13, -16 + bob, 1.6, 1.3, K2);
    }, [[K0, C.skin, { depth: 4 }], [K1, C.belly, { depth: 2 }], [K2, C.extra, { depth: 2, amb: 0.6 }]]);
    layer(B, b => { stub(b, -2, 5, 1, K0); capsule(b, 3, -9 + bob, 5.5, -7 + bob, 1.1, 0.9, K0); }, [[K0, C.skin, { depth: 2 }]]);
    eye = [8, -18 + bob];
  }
  // the eye: dark and shiny; shut in a smile when happy
  const [ex, ey] = eye;
  if (q.eye === 'happy') { put(B, ex - 1, ey + 1, INK); put(B, ex, ey, INK); put(B, ex + 1, ey + 1, INK); }
  else { rect(B, ex - 1, ey, 2, 3, INK); put(B, ex - 1, ey, WHITE); if (q.eye === 'sad') { put(B, ex - 1, ey - 1, C.skin[0]); put(B, ex, ey - 1, C.skin[0]); } }
  put(B, ex + 1, ey + 3, BLUSH);
  outline(B);
  return mk(B);
}
function babyPose(k) {
  const [name, n] = k.split(':'), i = +n || 0;
  if (name === 'hop') return { bob: i ? -1 : 0, legs: 3, eye: 'happy' };
  if (name === 'run') return { bob: i % 2 ? -1 : 0, legs: i % 2 ? 2 : 1, eye: 'happy' };
  return { bob: i ? 1 : 0, legs: 0, eye: 'sad' };
}
const babyF = [0, 1, 2, 3].map(v => frames(k => babyFrame(v, babyPose(k))));
M8.hatchling = (x, y, f = 1, o = {}) => {
  const t = o.t ?? G.t, pose = o.pose || 'sit';
  const key = pose === 'run' ? 'run:' + (Math.floor(t / 4) % 2) : pose === 'hop' ? 'hop:' + (Math.floor(t / 6) % 2) : 'sit:' + (Math.floor(t / 24) % 2);
  blitF(babyF[(o.v || 0) & 3](key), x, y, f);
};

// ---------------------------------------------------------------------------------------------------------------------
// The Oggles' cage: steel bars, a green lamp on the lock. 28 x 26, drawn in two parts round whoever is inside
// ---------------------------------------------------------------------------------------------------------------------
const CAGE = M8.memo(() => {
  const front = buf(36, 40, 18, 34);
  rect(front, -14, -3, 28, 3, STEEL[2]); rect(front, -14, -3, 28, 1, STEEL[4]); rect(front, -14, -1, 28, 1, STEEL[1]);
  rect(front, -14, -26, 28, 3, STEEL[2]); rect(front, -14, -26, 28, 1, STEEL[4]);
  rect(front, -4, -31, 8, 5, GRN[1]); rect(front, -4, -31, 8, 1, GRN[3]); rect(front, -2, -30, 4, 3, I('#0a1410'));   // the lock on the roof
  rect(front, 5, -29, 1, 3, STEEL[3]);
  for (const x of [-13, 12]) { put(front, x, -25, STEEL[5]); put(front, x, -2, STEEL[5]); }
  outline(front);
  for (const x of [-13, -7, -1, 5, 11]) { rect(front, x, -23, 1, 20, STEEL[4]); rect(front, x + 1, -23, 1, 20, STEEL[1]); }   // thin bars: whoever is inside must show
  return { front: mk(front) };
});
M8.cage = (x, y, part, t = G.t) => {
  x = Math.round(x); y = Math.round(y);
  if (part === 'back') { ctx.fillStyle = 'rgba(16,22,34,0.45)'; ctx.fillRect(x - 13, y - 24, 26, 22); return; }
  blit(CAGE().front, x, y);
  if (!FLASH) R(x - 1, y - 30, 2, 2, Math.floor(t / 14) % 2 ? '#9dff4a' : '#2fae44');
};
M8.cageBits = M8.memo(() => {
  const bar = buf(6, 22, 2, 20); rect(bar, 0, -18, 2, 18, STEEL[3]); rect(bar, 0, -18, 1, 18, STEEL[5]); outline(bar);
  const s = mk(bar); return { img: s.img, w: s.w, h: s.h };
});

// ---------------------------------------------------------------------------------------------------------------------
// Amber block, fern bush, robot nest, boulder wall
// ---------------------------------------------------------------------------------------------------------------------
const AMBER = M8.memo(() => {
  const b = buf(20, 20, 2, 2);
  poly(b, [[3, 0], [13, 0], [16, 3], [16, 13], [13, 16], [3, 16], [0, 13], [0, 3]], K0);
  form(b, K0, HONEY, { depth: 6, amb: 0.55, gain: 0.9 });
  for (const [x, y] of [[7, 7], [8, 8], [9, 7], [8, 9], [6, 9], [10, 9]]) put(b, x, y, I('#4a2408'));   // something tiny, caught long ago
  put(b, 7, 6, I('#7a4a18')); put(b, 9, 6, I('#7a4a18'));
  rect(b, 3, 2, 4, 1, HONEY[5]); put(b, 2, 3, HONEY[5]); put(b, 2, 4, HONEY[5]);
  outline(b);
  return mk(b);
});
M8.amber = (x, y, t = G.t) => {
  blit(AMBER(), x, y);
  if (!FLASH && (t + Math.round(x)) % 70 < 8) { R(Math.round(x) + 11, Math.round(y) + 2, 1, 3, '#ffffff'); R(Math.round(x) + 10, Math.round(y) + 3, 3, 1, '#ffffff'); }
};
M8.amberBits = M8.memo(() => {
  const b = buf(8, 8, 4, 4); poly(b, [[-2, -3], [2, -2], [3, 2], [-1, 3], [-3, 0]], K0); form(b, K0, HONEY.slice(1), { depth: 2 }); outline(b);
  const s = mk(b); return { img: s.img, w: s.w, h: s.h };
});

const BUSH = M8.memo(() => {
  const b = buf(64, 48, 32, 44);
  // a cycad: fronds arch up and out from one crown, each with a row of leaflets
  const frond = (a, L, ramp) => {
    const tip = [Math.cos(a) * L, -4 - Math.sin(a) * L * 0.72 + L * 0.2], mid = [Math.cos(a) * L * 0.45, -6 - Math.sin(a) * L * 1.25];
    const pts = bez([[0, -4], mid, tip], 12);
    layer(b, t => {
      tube(t, pts, 1.3, 0.5, K0);
      for (let i = 2; i < pts.length; i++) {
        const p = pts[i], q = pts[i - 1], dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy) || 1, n = 3.2 * (1 - Math.abs(i / pts.length - 0.5) * 1.1) + 1;
        line(t, p[0], p[1], p[0] - dy / d * n - dx / d, p[1] + dx / d * n - dy / d, K0);
        line(t, p[0], p[1], p[0] + dy / d * n - dx / d, p[1] - dx / d * n - dy / d, K0);
      }
    }, [[K0, ramp, { depth: 2, amb: 0.55 }]], false);
  };
  for (let i = 0; i < 6; i++) frond(0.2 + i * 0.54 + hsh(i) * 0.1, 22 + hsh(i * 3.7) * 5, LEAF.slice(0, 3));
  layer(b, t => { oval(t, 0, -6, 9, 6, K0); }, [[K0, LEAF.slice(0, 4), { depth: 5, amb: 0.35 }]], false);
  for (let i = 0; i < 7; i++) frond(0.32 + i * 0.42, 15 + hsh(i * 5.1 + 3) * 7, LEAF.slice(1));
  outline(b);
  return mk(b);
});
M8.bush = (x, y) => blit(BUSH(), x, y);

const NEST = M8.memo(() => {
  const b = buf(40, 30, 20, 26);
  poly(b, [[-15, -9], [15, -9], [12, 0], [-12, 0]], K0);
  form(b, K0, STEEL, { depth: 4, amb: 0.45 });
  for (let x = -14; x <= 14; x++) { const c = ((x + 20) >> 2) % 2 ? AMB[3] : I('#1a1826'); if (get(b, x, -6) !== NONE) { put(b, x, -6, c); put(b, x, -5, c); } }
  rect(b, -16, -11, 32, 2, STEEL[3]); rect(b, -16, -11, 32, 1, STEEL[5]);
  for (const x of [-10, 0, 10]) put(b, x, -2, STEEL[5]);
  outline(b);
  return mk(b);
});
M8.nest = (x, y, rock = 0, t = G.t, hp = 1) => {
  x = Math.round(x); y = Math.round(y);
  M8.egg(x - 8, y - 15, t + 9); M8.egg(x + 8, y - 15, t + 17);
  M8.egg(x + (rock > 0 ? (Math.floor(t / 2) % 2 ? 1 : -1) : 0), y - 17 - (rock > 0 && Math.floor(t / 4) % 2 ? 1 : 0), t);
  blit(NEST(), x, y);
  if (!FLASH) {
    R(x - 1, y - 4, 2, 2, rock > 0 ? (Math.floor(t / 3) % 2 ? '#ffffff' : '#ff3b30') : Math.floor(t / 20) % 2 ? '#9dff4a' : '#2fae44');
    if (hp < 0.67) { R(x - 9, y - 8, 1, 4, '#1a1826'); R(x - 8, y - 5, 2, 1, '#1a1826'); }
    if (hp < 0.34) { R(x + 6, y - 9, 1, 5, '#1a1826'); R(x + 4, y - 6, 2, 1, '#1a1826'); R(x + 7, y - 4, 2, 1, '#1a1826'); }
  }
};

const WALL = M8.memo(() => {
  const b = buf(52, 60, 26, 56);
  const rocks = [[-11, -10, 11, 10], [10, -9, 12, 9], [-13, -27, 9, 9], [3, -26, 12, 10], [15, -29, 7, 8], [-5, -43, 12, 9], [9, -44, 8, 8], [1, -52, 7, 4]];
  rocks.forEach(([cx, cy, rx, ry], i) => {
    layer(b, t => {
      shape(t, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => { const a = Math.atan2(y - cy, x - cx), k = 1 + 0.12 * Math.sin(a * 3 + i * 2.1) + 0.08 * Math.sin(a * 5 + i); return ((x - cx) / (rx * k)) ** 2 + ((y - cy) / (ry * k)) ** 2 <= 1; }, K0);
    }, [[K0, ROCK, { depth: 6, amb: 0.48, grain: (x, y) => (M8.fbm(x * 0.4, y * 0.4, 3) - 0.5) * 0.5 }]]);
  });
  for (let x = -22; x <= 22; x++) for (let y = -4; y <= 0; y++) if (get(b, x, y) !== NONE && get(b, x, y) !== OUTI && M8.nz(x, y) > 0.62) put(b, x, y, ROCK[1]);
  return mk(b);
});
M8.wall = (x, y, hp = 1) => {
  x = Math.round(x); y = Math.round(y);
  blit(WALL(), x, y);
  if (FLASH) return;
  const crack = (pts) => { for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let k = 0; k <= n; k++) R(x + Math.round(x0 + (x1 - x0) * k / n), y + Math.round(y0 + (y1 - y0) * k / n), 1, 1, '#1a1410'); } };
  if (hp < 0.75) crack([[-4, -50], [-1, -40], [-6, -32], [-2, -24]]);
  if (hp < 0.5) crack([[8, -40], [4, -30], [9, -20], [5, -10], [8, -2]]);
  if (hp < 0.25) { crack([[-14, -22], [-8, -16], [-13, -8], [-9, -1]]); crack([[-2, -24], [3, -16], [-1, -8]]); }
};
M8.rockBits = M8.memo(() => [0, 1, 2].map(i => {
  const b = buf(14, 14, 7, 7), r = 3 + i;
  shape(b, -r - 1, -r - 1, r + 1, r + 1, (x, y) => { const a = Math.atan2(y, x); return Math.hypot(x, y) <= r * (1 + 0.16 * Math.sin(a * 3 + i)); }, K0);
  form(b, K0, ROCK, { depth: 3, amb: 0.48 }); outline(b);
  const s = mk(b); return { img: s.img, w: s.w, h: s.h };
}));
}
