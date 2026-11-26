'use strict';
// ============================================================
// Mission 2 enemies (VIGO HILLS): the robot WOLF, EAGLE and BEAR, the AREA 2 mini-boss ROBO BEAR, their
// projectiles (EB_TYPES egg, boulder, log) and their sounds. Everything is private to this block: the game reaches
// it through ENEMY_TYPES wolf / eagle / bear / robobear and EB_TYPES egg / boulder / log.
// Every attack is telegraphed (eyes flash, a wind-up pose, an aim line, a sound) and every robot breaks apart into
// tumbling parts, bolts and sparks when beaten. Drawing is all crisp pixels: rects, pixel lines and sprites.
// ============================================================
{
// ============================================================
// Palettes (Mission 1's robot metal + one accent per species)
// ============================================================
const WC = '#38d0ff', WCL = '#c8f5ff', WCD = '#1678a8';                     // wolf lights (cyan)
const GD = '#ffc533', GDL = '#fff1a6', GDD = '#c47f0f';                     // eagle beak + talons (gold)
const BR = '#8f5c3a', BRL = '#bb8657', BRD = '#5f3b23', BRDD = '#3d2515';  // bear armour (brown)
const RB = '#c98f2e', RBL = '#f4ca68', RBD = '#8b5b17', RBDD = '#583a0d';  // robo bear armour (golden brown)
const BLG = '#6a5a50', BLGL = '#8a7868', BLGD = '#4a3c34';                  // bear limbs (warm steel: apart from the wolves)
const GLOW = '#ffb3a8', TEETH = '#eef3f7', SNOW = '#e8edf1';
const ST = '#9a968c', STL = '#c6c2b6', STD = '#6f6c62', STDD = '#4f4c45';  // granite boulder
const WD = '#7a4f2a', WDL = '#a8744a', WDD = '#4f3018', RING = '#d9b07a';  // chestnut log
const PAL = {
  k: OUT, m: MET, l: METL, d: METD, D: METDD, r: EVIL, g: GLOW, w: TEETH, W: SNOW,
  c: WC, L: WCL, C: WCD, G: GD, H: GDL, J: GDD,
  b: BR, B: BRL, n: BRD, N: BRDD, o: RB, O: RBL, q: RBD, Q: RBDD,
  s: ST, S: STL, t: STD, T: STDD, u: WD, U: WDL, v: WDD, x: RING, y: '#ff8a3d', z: '#6ff0ff', Z: '#e6fdff',
  e: BLG, E: BLGL, f: BLGD
};

// ============================================================
// Sprites built once at load from shape ops (local origin ox, oy):
// ['b', [[x, y, w, h], ...], key] = one outlined blob, ['r', x, y, w, h, key] = plain rect, ['p', x, y, key, ...] = pixels
// ============================================================
function build(w, h, ox, oy, ops) {
  const g = [];
  for (let y = 0; y < h; y++) g.push(new Array(w).fill('.'));
  const put = (x, y, c) => { x += ox; y += oy; if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; };
  const fill = (x, y, ww, hh, c) => { for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) put(x + i, y + j, c); };
  for (const op of ops) {
    if (op[0] === 'b') {
      for (const [x, y, ww, hh] of op[1]) fill(x - 1, y - 1, ww + 2, hh + 2, 'k');
      for (const [x, y, ww, hh] of op[1]) fill(x, y, ww, hh, op[2]);
    } else if (op[0] === 'r') fill(op[1], op[2], op[3], op[4], op[5]);
    else if (op[0] === 'p') for (let i = 1; i + 2 < op.length; i += 3) put(op[i], op[i + 1], op[i + 2]);
  }
  const s = makeSprite(g.map(r => r.join('')), PAL);
  s.ox = ox; s.oy = oy;
  return s;
}
// draw a built sprite with its origin at (x, y)
const sp = (s, x, y) => spr(s, Math.round(x) - s.ox, Math.round(y) - s.oy);

// --- wolf heads (origin = neck joint, facing right) ---
// jaw 0 shut, 1 snarling, 2 wide open (the mouth glows like a furnace)
function wolfHeadOps(jaw) {
  const ops = [
    ['b', [[-1, -15, 1, 1], [-2, -14, 2, 1], [-2, -13, 3, 1], [-3, -12, 4, 2]], 'd'],
    ['b', [[-4, -16, 1, 1], [-5, -15, 2, 1], [-5, -14, 3, 1], [-6, -13, 4, 1], [-6, -12, 5, 1], [-7, -11, 10, 6], [3, -9, 7, 3], [10, -9, 2, 2], [-7, -5, 5, 3]], 'm'],
    ['r', -4, -14, 1, 2, 'c'], ['p', -5, -13, 'C', -1, -13, 'C', -1, -14, 'c'],
    ['r', -6, -11, 8, 1, 'l'], ['r', 3, -9, 7, 1, 'l'], ['p', 2, -10, 'l', -5, -15, 'l'],
    ['r', -1, -9, 4, 2, 'D'], ['r', 0, -9, 2, 1, 'r'], ['p', 2, -9, 'g'],
    ['r', 10, -9, 2, 2, 'D'], ['p', 10, -9, 'd'],
    ['r', -7, -6, 3, 1, 'd'], ['r', -7, -4, 4, 1, 'd'], ['p', -4, -7, 'l']
  ];
  if (jaw === 0) ops.push(['b', [[-2, -6, 10, 2]], 'd'], ['r', -1, -6, 8, 1, 'm'], ['p', 4, -7, 'w', 7, -7, 'w', 8, -7, 'w']);
  else if (jaw === 1) ops.push(['b', [[-2, -6, 5, 2], [2, -5, 4, 2], [5, -4, 3, 2]], 'd'], ['r', 3, -7, 6, 2, 'D'], ['r', 4, -6, 3, 1, 'r'],
    ['p', 4, -7, 'w', 7, -7, 'w', 8, -7, 'w', 6, -5, 'w', 7, -4, 'w']);
  else ops.push(['b', [[-2, -6, 4, 2], [1, -5, 3, 2], [3, -4, 3, 2], [5, -3, 3, 2]], 'd'], ['r', 3, -7, 6, 3, 'D'], ['r', 3, -6, 4, 2, 'r'], ['p', 4, -6, 'y'],
    ['p', 4, -7, 'w', 7, -7, 'w', 8, -7, 'w', 5, -4, 'w', 7, -3, 'w']);
  return ops;
}
const WOLF_HEAD = [0, 1, 2].map(j => build(22, 20, 9, 17, wolfHeadOps(j)));
// howling: the snout points at the sky, the jaw hangs open, the ears lie back
const WOLF_HOWL = build(22, 24, 10, 20, [
  ['b', [[-6, -13, 3, 1], [-4, -12, 3, 2]], 'd'],
  ['b', [[-9, -14, 2, 1], [-8, -13, 4, 1], [-7, -12, 5, 1], [-7, -11, 9, 6], [1, -13, 3, 4], [3, -16, 3, 4], [5, -19, 2, 4], [6, -20, 2, 2], [-7, -5, 5, 3]], 'm'],
  ['r', -7, -11, 8, 1, 'l'], ['p', 1, -13, 'l', 3, -16, 'l', 5, -19, 'l', -8, -13, 'c', -7, -13, 'c'],
  ['r', -2, -9, 4, 2, 'D'], ['r', -1, -9, 2, 1, 'r'], ['p', 1, -9, 'g'], ['r', 6, -20, 2, 2, 'D'],
  ['b', [[-2, -6, 4, 2], [1, -8, 3, 2], [4, -10, 3, 2], [6, -12, 2, 3]], 'd'],
  ['r', 3, -12, 2, 3, 'D'], ['r', 5, -15, 2, 3, 'D'], ['r', 4, -11, 2, 1, 'r'], ['p', 5, -14, 'r', 7, -17, 'w', 5, -16, 'w', 3, -10, 'w', 6, -11, 'w'],
  ['r', -7, -6, 3, 1, 'd'], ['p', -4, -7, 'l']
]);
// parts that fly off
const P_WHEAD = build(22, 20, 9, 17, wolfHeadOps(2));
const P_WLEG = build(5, 11, 2, 1, [['b', [[-1, 0, 3, 7], [-1, 6, 4, 2]], 'm'], ['r', 1, 0, 1, 6, 'l'], ['r', -1, 6, 4, 2, 'D'], ['p', 0, 2, 'l']]);
const P_WPLATE = build(10, 5, 4, 2, [['b', [[-4, -1, 8, 3]], 'D'], ['r', -4, -1, 8, 1, 'd'], ['p', -3, 0, 'l', 2, 0, 'l']]);
const P_WTAIL = build(11, 5, 5, 2, [['b', [[-5, -1, 4, 2], [-1, -1, 4, 2], [3, -1, 2, 2]], 'm'], ['r', -5, -1, 4, 1, 'l'], ['r', 3, -1, 2, 2, 'c']]);
const P_NUT = build(5, 5, 2, 2, [['b', [[-1, -1, 3, 3]], 'm'], ['p', -1, -1, 'l', 0, 0, 'D']]);
const P_GEAR = build(9, 9, 4, 4, [['b', [[-3, -2, 7, 5], [-2, -3, 5, 7]], 'd'], ['p', -3, -2, 'm', 3, 2, 'D', -2, -3, 'm', 2, 3, 'D'],
  ['r', -1, -1, 3, 3, 'm'], ['p', 0, 0, 'k', -1, -1, 'l']]);
const P_SPRING = build(5, 9, 2, 4, [['b', [[-1, -3, 3, 1], [-1, -1, 3, 1], [-1, 1, 3, 1], [-1, 3, 3, 1], [-2, -2, 1, 6], [2, -2, 1, 6]], 'l']]);

// --- eagle heads (origin = neck, facing right) ---
function eagleHeadOps(open) {
  const ops = [
    ['b', [[-2, -3, 3, 4], [0, -7, 6, 6], [1, -8, 4, 1]], 'W'],
    ['r', -2, 0, 3, 1, 'l'], ['r', 0, -2, 2, 1, 'l'], ['r', 2, -6, 4, 1, 'D'], ['r', 3, -5, 2, 1, 'r'], ['p', 5, -5, 'g', 1, -7, 'l']
  ];
  if (!open) ops.push(['b', [[6, -5, 3, 3], [8, -3, 2, 2]], 'G'], ['r', 6, -5, 3, 1, 'H'], ['p', 9, -2, 'J', 6, -3, 'J']);
  else ops.push(['b', [[6, -6, 4, 2], [9, -5, 1, 2]], 'G'], ['b', [[6, -2, 3, 1]], 'J'], ['r', 6, -6, 3, 1, 'H'], ['r', 6, -4, 3, 1, 'k'], ['p', 7, -4, 'r']);
  return ops;
}
const EAGLE_HEAD = [0, 1].map(o => build(14, 12, 3, 10, eagleHeadOps(o)));
const P_EHEAD = EAGLE_HEAD[1];
const P_EWING = build(17, 9, 8, 4, [
  ['b', [[-8, -3, 4, 3], [-4, -3, 12, 2], [-6, 0, 3, 3], [-3, -1, 3, 4], [0, -1, 3, 3], [3, -1, 3, 2]], 'd'],
  ['r', -4, -3, 12, 1, 'm'], ['r', -8, -3, 3, 1, 'l'], ['p', -6, 2, 'D', -3, 2, 'D', 0, 1, 'D']
]);
const P_FEATHER = build(4, 8, 1, 3, [['b', [[0, -3, 2, 6]], 'd'], ['r', 0, -3, 1, 6, 'm']]);
const P_EBODY = build(16, 9, 8, 4, [['b', [[-7, -2, 13, 5], [-5, -3, 9, 1]], 'd'], ['r', -6, -2, 11, 1, 'm'], ['r', -7, 2, 13, 1, 'D'], ['p', -3, 0, 'l', 2, 0, 'l']]);

// --- bear heads (origin = neck point, facing right): a round metal skull under an armour helmet, round ears, a visor
// with one red eye, a muzzle with a black nose; roaring, the jaw drops on a glowing furnace mouth. Robo: a gold crest.
function bearHeadOps(roar, robo) {
  const A = robo ? 'o' : 'b', AL = robo ? 'O' : 'B', AD = robo ? 'q' : 'n', ADD = robo ? 'Q' : 'N', g = robo ? 2 : 0; // robo: a size bigger
  const ops = [
    ['b', [[0, -18 - g, 4, 3], [1, -19 - g, 2, 1]], AD], ['r', 1, -17 - g, 2, 2, ADD],
    ['b', [[-3, -14 - g, 14 + g, 10 + g], [-1, -15 - g, 10 + g, 1], [1, -16 - g, 6 + g, 1]], 'm'],
    ['r', -3, -14 - g, 14 + g, 3, A], ['r', -1, -15 - g, 10 + g, 1, AL], ['r', 1, -16 - g, 6 + g, 1, AL], ['r', -3, -14 - g, 3, 1, AL],
    ['r', -3, -11 - g, 14 + g, 1, AD], ['p', 1, -13 - g, ADD, 6 + g, -13 - g, ADD],
    ['r', -3, -10 - g, 2, 6 + g, 'd'], ['r', -1, -5, 12 + g, 1, 'd'],
    ['b', [[4 + g, -19 - g, 5, 4], [5 + g, -20 - g, 3, 1]], A], ['r', 5 + g, -18 - g, 3, 2, ADD], ['r', 5 + g, -20 - g, 3, 1, AL],
    ['b', [[3, -10 - g, 7 + g, 3 + g / 2]], 'D'], ['r', 5, -9 - g, 4 + g, 1 + g / 2, 'r'], ['p', 8 + g, -10 - g, 'g'],
    ['p', 0, -8, 'l', 0, -7, 'D']
  ];
  if (!roar) ops.push(
    ['b', [[10 + g, -10, 7, 5], [17 + g, -9, 1, 4]], 'm'], ['r', 10 + g, -10, 7, 1, 'l'], ['r', 10 + g, -6, 8, 1, 'd'],
    ['b', [[16 + g, -11, 3, 3]], 'D'], ['p', 16 + g, -11, 'd'],
    ['b', [[4, -5, 12 + g, 2]], 'd'], ['r', 4, -5, 12 + g, 1, 'm'], ['p', 11 + g, -6, 'w', 13 + g, -6, 'w', 15 + g, -6, 'w']
  );
  else ops.push(
    ['b', [[10 + g, -12, 7, 4], [17 + g, -11, 1, 3]], 'm'], ['r', 10 + g, -12, 7, 1, 'l'],
    ['b', [[16 + g, -13, 3, 3]], 'D'],
    ['r', 10 + g, -8, 7, 4, 'D'], ['r', 11 + g, -7, 5, 2, 'r'], ['r', 12 + g, -7, 3, 1, 'y'],
    ['b', [[3, -4, 10 + g, 3], [12 + g, -3, 5, 2]], 'd'], ['r', 3, -4, 10 + g, 1, 'm'],
    ['p', 11 + g, -8, 'w', 13 + g, -8, 'w', 15 + g, -8, 'w', 12 + g, -5, 'w', 14 + g, -5, 'w', 16 + g, -4, 'w']
  );
  if (robo) ops.push(['b', [[-2, -19 - g, 3, 4], [-1, -21 - g, 1, 2]], 'O'], ['r', -2, -17 - g, 3, 2, 'o'], ['p', -1, -21 - g, 'r']);
  return ops;
}
const BEAR_HEAD = [build(26, 26, 5, 23, bearHeadOps(false, false)), build(26, 26, 5, 23, bearHeadOps(true, false))];
const ROBO_HEAD = [build(28, 28, 5, 25, bearHeadOps(false, true)), build(28, 28, 5, 25, bearHeadOps(true, true))];
const P_BPAW = build(13, 8, 6, 5, [['b', [[-5, -3, 10, 4], [-3, -4, 6, 1]], 'D'], ['r', -5, -3, 10, 1, 'd'], ['p', 5, -1, 'l', 5, 0, 'l', 3, 0, 'l']]);
const P_BLEG = build(12, 17, 5, 1, [['b', [[-4, 0, 8, 10], [-3, 10, 6, 2]], 'e'], ['r', -4, 0, 2, 10, 'E'], ['r', 3, 0, 1, 10, 'f'], ['b', [[-5, 12, 11, 3]], 'D'], ['r', -4, 12, 9, 1, 'd'], ['p', 0, 4, 'l', 6, 13, 'w']]);
const P_BPLATE = [build(16, 8, 7, 3, [['b', [[-6, -2, 13, 4], [-5, -3, 11, 1]], 'b'], ['r', -6, -2, 13, 1, 'B'], ['r', -6, 1, 13, 1, 'n'], ['p', -4, 0, 'l', 4, 0, 'l']]),
  build(16, 8, 7, 3, [['b', [[-6, -2, 13, 4], [-5, -3, 11, 1]], 'o'], ['r', -6, -2, 13, 1, 'O'], ['r', -6, 1, 13, 1, 'q'], ['p', -4, 0, 'l', 4, 0, 'l']])];
const P_CORE = build(9, 9, 4, 4, [['b', [[-3, -2, 7, 5], [-2, -3, 5, 7]], 'D'], ['r', -2, -2, 5, 5, 'z'], ['r', -1, -1, 2, 2, 'Z']]);
const P_HELMET = build(18, 11, 8, 8, [['b', [[-7, -4, 14, 4], [-5, -6, 10, 2], [-1, -8, 3, 2]], 'o'], ['r', -7, -4, 14, 1, 'O'], ['r', -5, -6, 10, 1, 'O'], ['r', -7, -1, 14, 1, 'q'], ['p', 0, -8, 'r', -4, -3, 'l', 4, -3, 'l']]);

// --- projectiles ---
const EGG = [0, 1].map(on => build(8, 12, 3, 7, [['b', [[-2, -4, 4, 8], [-3, -2, 6, 5]], 'l'], ['r', -3, -2, 6, 1, 'W'], ['r', -2, -4, 2, 1, 'W'],
  ['r', -3, 1, 6, 1, 'd'], ['r', 1, -3, 1, 6, 'm'], ['b', [[-1, -1, 2, 2]], on ? 'r' : 'D'], ['p', -1, -1, on ? 'g' : 'd'], ['p', -2, 2, 'm', 2, 2, 'D'],
  ['b', [[-1, -6, 2, 1]], 'D']]));
const BOULDER = [0, 1, 2, 3].map(f => {
  const cr = [[-2, -3, 't', -1, -2, 't', 0, -1, 't'], [2, -2, 't', 1, -1, 't', 1, 0, 't'], [1, 2, 't', 0, 1, 't', -1, 1, 't'], [-3, 1, 't', -2, 0, 't', -2, -1, 't']][f];
  return build(16, 15, 7, 7, [['b', [[-5, -4, 11, 9], [-4, -6, 9, 13], [-6, -2, 13, 5]], 's'],
    ['r', -4, -6, 6, 2, 'S'], ['r', -5, -4, 2, 3, 'S'], ['r', 2, 4, 4, 2, 't'], ['r', 5, -1, 1, 4, 't'], ['p', ...cr], ['p', [-3, 3, 4, -3][f], [2, -4, -2, 3][f], 'S']]);
});
const P_ROCK = [build(7, 6, 3, 3, [['b', [[-2, -2, 5, 4]], 's'], ['r', -2, -2, 3, 1, 'S'], ['r', 1, 1, 2, 1, 't']]),
  build(5, 5, 2, 2, [['b', [[-1, -1, 3, 3]], 's'], ['p', -1, -1, 'S', 1, 1, 't']])];
const P_SPLINTER = build(9, 4, 4, 1, [['b', [[-3, -1, 7, 2]], 'u'], ['r', -3, -1, 7, 1, 'U']]);

// ============================================================
// Pixel drawing helpers (crisp at any angle: no canvas paths on characters)
// ============================================================
const lerp = (a, b, k) => a + (b - a) * k;
// Crisp thick line: w x w squares stepped along it; out = the 1px OUT outline pass
function pl(x0, y0, x1, y1, w, c, out) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), o = out ? 1 : 0, h = (w - 1) / 2;
  ctx.fillStyle = out ? OUT : FLASH ? '#ffffff' : c;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n - h) - o, Math.round(y0 + (y1 - y0) * i / n - h) - o, w + 2 * o, w + 2 * o);
}
// A limb through [x0, y0, x1, y1, ...]: outline, fill, then a 1px light edge on its upper-front side
function limb(pts, w, c, hi) {
  const n = pts.length;
  for (let i = 0; i + 3 < n; i += 2) pl(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], w, c, true);
  for (let i = 0; i + 3 < n; i += 2) pl(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], w, c, false);
  if (!hi || w < 3) return;
  const o = (w - 1) / 2;
  for (let i = 0; i + 3 < n; i += 2) {
    const dx = pts[i + 2] - pts[i], dy = pts[i + 3] - pts[i + 1], d = Math.hypot(dx, dy) || 1;
    let px = dy / d, py = -dx / d;
    if (px - py < 0) { px = -px; py = -py; }
    pl(pts[i] + px * o, pts[i + 1] + py * o, pts[i + 2] + px * o, pts[i + 3] + py * o, 1, hi, false);
  }
}
// 2-bone leg: knee for joint (ax, ay), foot (bx, by), bone lengths l1, l2 (bend 1 = knee to the back)
const KN = [0, 0, 0, 0];
function knee(ax, ay, bx, by, l1, l2, bend) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 0.01;
  const mx = l1 + l2 - 0.05;
  if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / d, uy = dy / d;
  KN[0] = ax + ux * a - uy * h * bend; KN[1] = ay + uy * a + ux * h * bend; KN[2] = ax + dx; KN[3] = ay + dy;
  return KN;
}
// A body as 1px columns from a profile [[x, top, bot], ...] (dy(x) = per-column offset, e.g. a tilt):
// 8-way OUT outline, light top rows, mid, shaded bottom rows. TT/BB keep the columns for details (topAt/botAt).
const TT = new Int16Array(400), BB = new Int16Array(400);
let colX0 = 0, colN = 0;
function colBody(pts, dy, cL, cM, cD, hiN, shN) {
  const x0 = Math.round(pts[0][0]), x1 = Math.round(pts[pts.length - 1][0]), n = x1 - x0 + 1;
  let j = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + i;
    while (j < pts.length - 2 && x > pts[j + 1][0]) j++;
    const a = pts[j], b = pts[j + 1], k = b[0] === a[0] ? 0 : clamp((x - a[0]) / (b[0] - a[0]), 0, 1), o = dy ? dy(x) : 0;
    TT[i] = Math.round(lerp(a[1], b[1], k) + o); BB[i] = Math.round(lerp(a[2], b[2], k) + o);
  }
  colX0 = x0; colN = n;
  ctx.fillStyle = OUT;
  for (let i = -1; i <= n; i++) {
    let t = 9999, b = -9999;
    for (let k = i - 1; k <= i + 1; k++) if (k >= 0 && k < n) { if (TT[k] < t) t = TT[k]; if (BB[k] > b) b = BB[k]; }
    ctx.fillRect(x0 + i, t - 1, 1, b - t + 2);
  }
  for (let i = 0; i < n; i++) {
    const t = TT[i], b = BB[i];
    R(x0 + i, t, 1, b - t, cM); R(x0 + i, t, 1, hiN, cL); R(x0 + i, b - shN, 1, shN, cD);
  }
}
const topAt = x => TT[clamp(Math.round(x) - colX0, 0, colN - 1)];
const botAt = x => BB[clamp(Math.round(x) - colX0, 0, colN - 1)];
function joint(x, y, c, cl) { x = Math.round(x); y = Math.round(y); RO(x - 1, y - 1, 3, 3, c); R(x - 1, y - 1, 1, 1, cl); }
// a row of pixel dots along an arc (sound waves, slash trails)
function arcDots(cx, cy, r, a0, a1, n, c) { for (let i = 0; i < n; i++) { const a = lerp(a0, a1, i / (n - 1)); R(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1, c); } }

// ============================================================
// Sounds (Snd.tone / Snd.noise). Footsteps share one slot so a pack doesn't clatter.
// ============================================================
let howlAt = -9999, stepAt = -9999, flapAt = -9999, screechAt = -9999;
const SFX = {
  howl() {
    Snd.tone('triangle', 290, 600, 0.4, 0.11); Snd.tone('triangle', 600, 450, 0.95, 0.11, 0.38);
    Snd.tone('sawtooth', 145, 300, 0.4, 0.025); Snd.tone('sawtooth', 300, 225, 0.95, 0.025, 0.38);
    Snd.tone('sine', 1200, 900, 0.9, 0.025, 0.42);
  },
  growl() {
    Snd.tone('sawtooth', 92, 66, 0.5, 0.08); Snd.tone('square', 46, 40, 0.5, 0.04); Snd.noise(0.45, 0.07, 420);
    for (let i = 0; i < 5; i++) { Snd.tone('sawtooth', 380 - i * 12, 250, 0.08, 0.2, i * 0.09); Snd.noise(0.07, 0.15, 1900, i * 0.09); }
  },
  step(v = 0.02) { if (G.t - stepAt < 5) return; stepAt = G.t; Snd.tone('square', 1500, 1100, 0.025, v); Snd.noise(0.03, v, 3000); },
  thud() { Snd.tone('sine', 140, 60, 0.15, 0.12); Snd.noise(0.1, 0.06, 900); },
  screech() { Snd.tone('sawtooth', 2300, 1150, 0.32, 0.05); Snd.tone('square', 1600, 2500, 0.14, 0.03); Snd.noise(0.25, 0.04, 6000); },
  flap() { if (G.t - flapAt < 8) return; flapAt = G.t; Snd.noise(0.07, 0.03, 1300); },
  beep() { Snd.tone('square', 1760, 1760, 0.04, 0.03); },
  roar(big) { Snd.noise(big ? 1.2 : 0.9, 0.24, 650); Snd.tone('sawtooth', big ? 100 : 125, 55, big ? 1.1 : 0.85, 0.12); Snd.tone('square', 230, 125, 0.7, 0.045); },
  snort() { Snd.noise(0.18, 0.12, 1500); },
  heavy() { Snd.tone('sine', 85, 40, 0.18, 0.18); Snd.noise(0.08, 0.05, 600); Snd.tone('square', 150, 75, 0.1, 0.08); Snd.noise(0.1, 0.22, 1200); },
  throw() { Snd.throw(); Snd.noise(0.18, 0.09, 1800); },
  crash() { Snd.noise(0.35, 0.3, 1100); Snd.tone('sine', 130, 45, 0.35, 0.25); },
  swipe() { Snd.noise(0.12, 0.2, 7000); Snd.tone('sawtooth', 900, 250, 0.12, 0.05); },
  pop() { Snd.tone('square', 760, 180, 0.14, 0.09); Snd.noise(0.18, 0.16, 3000); }
};

// ============================================================
// Shared enemy bits
// ============================================================
const go = (e, s, st = 0) => { e.state = s; e.st = st; };
const scrL = () => G.cam.x, scrR = () => G.cam.x + W;
// damage taken since the last update (for a flinch): hitT is set by damageEnemy
function hitNow(e) { const h = e.hp < e.lastHp; e.lastHp = e.hp; return h; }

// Break-apart: parts fly, bounce, settle flat and blink out; drawn instead of the robot while it is dying
function bit(e, s, lx, ly, vx, vy, vr, o) {
  return Object.assign({ s, x: e.x + lx * e.facing, y: e.y + ly, vx: vx * e.facing, vy, rot: 0, vr: vr * e.facing, f: e.facing, rest: false, b: 0, smoke: false, flut: false }, o);
}
function shatter(e, list, len) { e.pieces = list; e.st = 0; e.dieLen = len; e.state = 'dead'; }
function updPieces(e) {
  e.st++;
  for (const q of e.pieces) {
    if (q.smoke && e.st % 6 === 0 && e.st < e.dieLen - 20) G.parts.push({ type: 'smoke', x: q.x, y: q.y - 2, vx: rand(-0.2, 0.2), vy: -0.6, life: 30, max: 30, size: 2.5 });
    if (q.rest) continue;
    if (q.flut) { q.vy = Math.min(q.vy + 0.05, 0.7); q.vx = Math.sin(e.st * 0.15 + q.b) * 0.8; q.rot = Math.sin(e.st * 0.2 + q.b) * 0.7; }
    else { q.vy = Math.min(q.vy + 0.22, 6); q.rot += q.vr; }
    q.x += q.vx; q.y += q.vy;
    const side = Math.abs(Math.sin(q.rot)) > 0.7, hh = (side ? q.s.w : q.s.h) / 2, gy = groundAt(q.x);
    if (q.y + hh >= gy && q.vy > 0) {
      q.b++;
      if (q.b === 1 && !q.flut) { sparks(q.x, gy - 1, 2); if (q.s.w > 8) dust(q.x, gy, 2); }
      if (q.flut || q.vy < 1.3 || q.b > 2) {
        q.rest = true; q.vx = 0;
        q.rot = Math.round(q.rot / (Math.PI / 2)) * (Math.PI / 2);
        q.y = gy - (Math.abs(Math.sin(q.rot)) > 0.5 ? q.s.w : q.s.h) / 2 + 1;
      } else { q.y = gy - hh; q.vy *= -0.42; q.vx *= 0.6; q.vr *= -0.6; }
    }
  }
  if (e.st >= e.dieLen) e.dead = true;
}
function drawPieces(e) {
  if (e.st > e.dieLen - 24 && Math.floor(e.st / 3) % 2) return;
  for (const q of e.pieces) {
    ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(q.rot); ctx.scale(q.f, 1);
    ctx.drawImage(q.s.img, -Math.floor(q.s.w / 2), -Math.floor(q.s.h / 2));
    ctx.restore();
  }
}
const nuts = (e, n, lx, ly) => { const a = []; for (let i = 0; i < n; i++) a.push(bit(e, i % 3 ? P_NUT : P_GEAR, lx, ly, rand(-2, 2), rand(-4, -2), rand(-0.4, 0.4))); return a; };

// ============================================================
// WOLF: howls in, prowls, runs, crouches (telegraph: eyes flare + growl), pounces in a low arc at where the hero
// was (jump it!), skids, backs off and comes again. Only an attacking wolf hurts to touch.
// ============================================================
// gaits: [phase offset per leg: hind far, hind near, front far, front near], stride, lift
const GAITS = {
  walk: [[0.5, 0, 0.75, 0.25], 7, 2], trot: [[0.5, 0, 0, 0.5], 10, 3], run: [[0, 0.12, 0.5, 0.62], 16, 5]
};
const WHIP = -9, WSHO = 6; // hip and shoulder x

function wolfLegs(gait, ph, ry, fy, back) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const hind = i < 2, near = i % 2 === 1, jx = (hind ? WHIP : WSHO) + (near ? 1 : 0), jy = -12 + (hind ? ry : fy);
    let fx = jx + (hind ? -1 : 1), fyy = 0;
    if (gait) {
      const [off, stride, lift] = GAITS[gait];
      let q = ((ph + off[i]) % 1 + 1) % 1;
      if (back) q = 1 - q;
      if (q < 0.6) fx += stride / 2 - stride * q / 0.6;
      else { const u = (q - 0.6) / 0.4; fx += -stride / 2 + stride * u; fyy = -Math.sin(Math.PI * u) * lift; }
    }
    out.push([jx, jy, fx, fyy, hind, near]);
  }
  return out;
}

// slim robot legs: an armoured thigh, a thin piston shin, a bolt at the knee, a flat paw with a claw
function drawWolfLeg(L) {
  const [jx, jy, fx, fy, hind, near] = L;
  const k = knee(jx, jy, fx, fy, hind ? 6 : 5, hind ? 7 : 7.5, hind ? 1 : 0.5), kx = k[0], ky = k[1], px = k[2], py = k[3];
  const c = near ? MET : METD, tw = near ? 3 : 2;
  pl(kx, ky, px, py, near ? 2 : 1, c, true); pl(jx, jy, kx, ky, tw, c, true);
  pl(kx, ky, px, py, near ? 2 : 1, near ? METD : METDD); pl(jx, jy, kx, ky, tw, c);
  if (near) { pl(jx, jy - 1, kx, ky - 1, 1, METL); R(Math.round(kx) - 1, Math.round(ky) - 1, 2, 2, METDD); R(Math.round(kx), Math.round(ky) - 1, 1, 1, METL); }
  RO(Math.round(px) - 2, Math.round(py) - 2, near ? 4 : 3, 2, near ? METDD : '#2c323b');
  if (near) R(Math.round(px) + 2, Math.round(py) - 1, 1, 1, METL);
}

const WOLF_PROF = [[-13, -16, -11], [-11, -18, -10], [-7, -17, -11], [-2, -16, -11], [2, -17, -10], [6, -18, -8], [9, -17, -8], [11, -15, -10]];

function drawWolf(e) {
  if (e.pieces) { drawPieces(e); return; }
  const s = e.state, t = e.t;
  let ry = 0, fy = 0, head = WOLF_HEAD[0], hdx = 0, hdy = 0, tail = Math.PI + 0.45 + Math.sin(t * 0.22) * 0.18, gait = null, back = false, legs = null;
  let flare = 0;
  if (s === 'run' || s === 'enter') {
    gait = s === 'run' ? 'run' : 'trot';
    const a = e.ph * Math.PI * 2;
    if (gait === 'run') { ry = Math.round(Math.sin(a) * 1.5); fy = Math.round(Math.sin(a + Math.PI) * 1.5); tail = Math.PI + 0.12 + Math.sin(a) * 0.12; head = WOLF_HEAD[e.spd > 1.6 ? 1 : 0]; hdx = 1; }
    else ry = fy = Math.round(Math.abs(Math.sin(a * 2)) * -1);
  } else if (s === 'prowl' || s === 'back') {
    gait = 'walk'; back = s === 'back'; hdy = 3; hdx = 1; fy = 1;
    tail = Math.PI + 0.1 + Math.sin(t * 0.15) * 0.1;
    if (s === 'back') head = WOLF_HEAD[1];
  } else if (s === 'crouch') {
    const k = Math.min(1, e.st / 5), wig = e.st > 5 && e.st % 6 < 3 ? -1 : 0;
    fy = Math.round(6 * k); ry = Math.round(-1 * k) + wig; hdy = 1; hdx = 2;
    head = WOLF_HEAD[1]; flare = 1;
    tail = Math.PI + 0.8 + Math.sin(e.st * 0.9) * 0.4;
    legs = [[WHIP, -12 + ry, WHIP - 2, 0, true, false], [WHIP + 1, -12 + ry, WHIP - 1, 0, true, true],
      [WSHO, -12 + fy, WSHO + 3, 0, false, false], [WSHO + 1, -12 + fy, WSHO + 4, 0, false, true]];
  } else if (s === 'pounce' || s === 'hop') {
    const up = e.vy < 0, hop = s === 'hop';
    fy = up ? -3 : 1; ry = up ? 1 : -1; head = WOLF_HEAD[hop ? 1 : 2]; tail = Math.PI + 0.15; hdx = 1;
    legs = up && !hop ? [[WHIP, -12 + ry, WHIP - 10, -5 + ry, true, false], [WHIP + 1, -12 + ry, WHIP - 9, -3 + ry, true, true],
      [WSHO, -12 + fy, WSHO + 10, -9 + fy, false, false], [WSHO + 1, -12 + fy, WSHO + 11, -7 + fy, false, true]]
      : [[WHIP, -12 + ry, WHIP - 6, -2, true, false], [WHIP + 1, -12 + ry, WHIP - 4, -1, true, true],
      [WSHO, -12 + fy, WSHO + 7, -1, false, false], [WSHO + 1, -12 + fy, WSHO + 8, 0, false, true]];
  } else if (s === 'skid') {
    fy = -2; ry = 1; head = WOLF_HEAD[1]; hdy = -1; tail = Math.PI + 0.55;
    legs = [[WHIP, -12 + ry, WHIP + 1, 0, true, false], [WHIP + 1, -12 + ry, WHIP + 3, 0, true, true],
      [WSHO, -12 + fy, WSHO + 8, 0, false, false], [WSHO + 1, -12 + fy, WSHO + 10, 0, false, true]];
  } else if (s === 'howl') {
    const k = Math.min(1, e.st / 8);
    ry = Math.round(5 * k); fy = Math.round(-3 * k); tail = Math.PI - 0.55; head = null;
    legs = [[WHIP, -12 + ry, WHIP + 3, 0, true, false], [WHIP + 1, -12 + ry, WHIP + 5, 0, true, true],
      [WSHO, -12 + fy, WSHO + 1, 0, false, false], [WSHO + 1, -12 + fy, WSHO + 3, 0, false, true]];
  }
  if (!legs) legs = wolfLegs(gait, e.ph, ry, fy, back);
  const sq = e.sq > 0 ? Math.ceil(e.sq / 3) : 0; // landing squash
  if (sq) for (const L of legs) { L[1] += sq; }
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.facing, 1);
  FLASH = e.hitT > 0;
  // far legs, tail
  drawWolfLeg(legs[0]); drawWolfLeg(legs[2]);
  const tx = -13, tyy = -15 + ry + sq;
  const t1x = tx + Math.cos(tail) * 4, t1y = tyy + Math.sin(tail) * 4, t2x = t1x + Math.cos(tail + 0.2) * 4, t2y = t1y + Math.sin(tail + 0.2) * 4;
  const t3x = t2x + Math.cos(tail + 0.4) * 3, t3y = t2y + Math.sin(tail + 0.4) * 3;
  pl(tx, tyy, t1x, t1y, 3, METD, true); pl(t1x, t1y, t2x, t2y, 2, METD, true); pl(t2x, t2y, t3x, t3y, 2, WC, true);
  pl(tx, tyy, t1x, t1y, 3, METD); pl(t1x, t1y, t2x, t2y, 2, METD); pl(t2x, t2y, t3x, t3y, 2, (t >> 3) % 3 ? WC : WCL);
  R(Math.round(t1x), Math.round(t1y) - 1, 1, 1, METL);
  // body: deep chest, tucked waist, a dark armoured saddle along the back
  const tilt = x => sq + lerp(ry, fy, clamp((x + 13) / 24, 0, 1));
  colBody(WOLF_PROF, tilt, METL, MET, METD, 1, 2);
  for (let x = -12; x <= 5; x++) { const ty = topAt(x), d = x < -10 || x > 3 ? 2 : 3; R(x, ty, 1, d, METD); R(x, ty, 1, 1, x % 5 ? MET : METL); }
  // plate seams with rivets, a cyan light strip along the flank, the shoulder plate
  for (const px of [-8, -2]) { const ty = topAt(px); R(px, ty + 1, 1, botAt(px) - ty - 3, METD); R(px + 1, ty + 2, 1, 1, METL); }
  const my = Math.round(lerp(topAt(-4), botAt(-4), 0.5));
  R(-11, my, 10, 1, (t >> 3) % 4 === 0 ? WCL : WC); R(-11, my + 1, 10, 1, WCD); R(-12, my, 1, 2, METDD);
  R(-13, botAt(-13) - 3, 1, 2, METDD); RO(3, topAt(4) + 2, 6, 3, METL); R(3, topAt(4) + 4, 6, 1, MET);
  // hackles: two swept-back spikes over the shoulders
  for (let i = 0; i < 2; i++) {
    const bx = 2 - i * 4, by = topAt(bx + 2);
    blob([[bx, by - 2, 4, 2], [bx - 2, by - 3, 4, 1], [bx - 3, by - 4, 2, 1]], i ? METDD : METD);
    R(bx - 1, by - 3, 3, 1, i ? METD : MET);
  }
  joint(WHIP + 1, -12 + ry + sq, METD, METL); joint(WSHO + 1, -12 + fy + sq, METD, METL);
  // head
  const nx = 9 + hdx, ny = -8 + fy + hdy + sq;
  if (head) {
    sp(head, nx, ny);
    if (flare && !FLASH) {
      // eye flares: a blinking star on the visor (the pounce telegraph)
      const on = Math.floor(e.st / 3) % 2, ex = nx + 1, ey = ny - 9, c = on ? '#ffffff' : '#ffd23f', r = on ? 3 : 2;
      R(ex - r, ey, r * 2 + 2, 1, c); R(ex + 1, ey - r, 1, r * 2 + 1, c); R(ex, ey, 2, 1, on ? EVIL : '#ffffff');
    }
  } else {
    sp(WOLF_HOWL, nx - 1, ny + 2);
    if (!FLASH) for (let i = 0; i < 3; i++) {
      const r = 4 + ((e.st * 0.45 + i * 5) % 15);
      arcDots(nx + 7, ny - 18, r, -1.9, -0.3, 7, i % 2 ? WCL : '#ffffff');
    }
  }
  // near legs
  drawWolfLeg(legs[1]); drawWolfLeg(legs[3]);
  FLASH = false; ctx.restore();
}

function updWolf(e) {
  if (e.pieces) { updPieces(e); return; }
  const p = G.p, L = scrL(), dx = p.x - e.x, adx = Math.abs(dx), dir = dx < 0 ? -1 : 1;
  const minX = L + 14, maxX = L + W - 14, inside = e.x > minX && e.x < maxX;
  if (e.sq > 0) e.sq--;
  e.st++;
  if (hitNow(e) && e.onGround) e.x -= e.facing; // flinch
  let mv = 0;
  switch (e.state) {
    case 'enter': {
      const into = e.x < L + W / 2 ? 1 : -1;
      e.facing = into; mv = into * 1.3;
      if (e.x > L + 30 && e.x < L + W - 30) {
        // the pack howls once together: the sound plays for the first wolf, the others join in silently
        if (G.t - howlAt > 220) { howlAt = G.t; SFX.howl(); go(e, 'howl'); }
        else if (G.t - howlAt < 24) go(e, 'howl', G.t - howlAt);
        else go(e, 'prowl');
        e.len = rand(30, 70);
      }
      break;
    }
    case 'howl': if (e.st >= 58) { go(e, 'prowl'); e.len = rand(20, 50); } break;
    case 'prowl':
      e.facing = dir; mv = dir * 0.55;
      if ((adx < 140 && e.st > 20) || e.st > e.len) { go(e, 'run'); e.spd = 0.6; }
      break;
    case 'run':
      e.facing = dir; e.spd = Math.min(2.1, e.spd + 0.1); mv = dir * e.spd;
      if (adx < 72 && e.onGround && inside && !p.dead) { go(e, 'crouch'); e.tx = p.x; SFX.growl(); }
      else if (p.dead && adx < 100) { go(e, 'back'); e.len = 60; }
      break;
    case 'crouch': // the telegraph: low, rear wiggling, eyes flaring, growling; the target is where the hero was
      e.facing = e.tx < e.x ? -1 : 1;
      if (e.st === 9 || e.st === 18) dust(e.x - e.facing * 9, e.y, 1, -e.facing);
      if (e.st >= 26) {
        e.onGround = false; e.onPlat = null;
        if (adx < 26 || p.dead) { e.vx = -dir * 1.7; e.vy = -2.4; e.facing = dir; go(e, 'hop'); break; } // too close: leap back
        const tx = clamp(e.tx, minX + 4, maxX - 4);
        let vx = clamp((tx - e.x) / 21, -3.4, 3.4);
        if (Math.abs(vx) < 1.4) vx = (tx < e.x ? -1 : 1) * 1.4;
        e.vx = vx; e.vy = -2.75; e.facing = vx < 0 ? -1 : 1;
        go(e, 'pounce'); Snd.tone('sawtooth', 300, 700, 0.12, 0.05);
        dust(e.x, e.y, 3);
      }
      break;
    case 'pounce':
    case 'hop':
      mv = e.vx;
      if (e.onGround && e.st > 2) {
        e.sq = 9; dust(e.x, e.y, 5, Math.sign(e.vx)); SFX.thud();
        if (e.state === 'pounce') go(e, 'skid'); else { go(e, 'back'); e.len = rand(30, 50); }
      }
      break;
    case 'skid':
      mv = e.vx; e.vx *= 0.86;
      if (e.st % 3 === 0) dust(e.x + e.facing * 10, e.y, 1, Math.sign(e.vx));
      if (e.st >= 18) { go(e, 'back'); e.len = rand(50, 80); }
      break;
    case 'back':
      e.facing = dir; mv = -dir * 0.8;
      if (e.st > e.len) { go(e, 'prowl'); e.len = rand(30, 60); }
      break;
  }
  // keep to the screen: outside it the wolf only ever walks in; inside it never backs off the edge
  if (e.state === 'prowl' || e.state === 'back' || e.state === 'run') {
    if (e.x < minX) mv = Math.max(mv, 0.9);
    else if (e.x > maxX) mv = Math.min(mv, -0.9);
    else if (e.x + mv < minX || e.x + mv > maxX) mv = 0;
  }
  if (e.state === 'prowl' || e.state === 'run' || e.state === 'back' || e.state === 'howl') {
    for (const o of G.enemies) {
      if (o === e || o.type !== 'wolf' || o.pieces || !o.active || Math.abs(o.x - e.x) > 22 || o.state === 'pounce') continue;
      e.x += (e.x < o.x || (e.x === o.x && e.t % 2) ? -0.5 : 0.5); // spread out so a pack never stacks into one blob
    }
  }
  e.x += mv;
  e.ph = (e.ph + Math.abs(mv) / (e.state === 'run' ? 20 : e.state === 'enter' ? 15 : 11)) % 1;
  if (e.onGround && Math.abs(mv) > 0.4 && e.x > L - 10 && e.x < L + W + 10 && Math.floor(e.ph * 2) !== Math.floor((e.lastPh || 0) * 2)) SFX.step(e.state === 'run' ? 0.022 : 0.012);
  e.lastPh = e.ph;
  // a little exhaust puff when running
  if (e.state === 'run' && e.t % 14 === 0) G.parts.push({ type: 'smoke', x: e.x - e.facing * 12, y: e.y - 17, vx: -e.facing * 0.3, vy: -0.4, life: 22, max: 22, size: 2 });
  const py = e.y;
  e.vy = Math.min(e.vy + 0.26, 6); e.y += e.vy;
  land(e, py);
}

ENEMY_TYPES.wolf = {
  hp: 3, melee: true, edge: 20,
  contact: e => e.state === 'pounce' || e.state === 'run' ? 'hurt' : 'none',
  make(e) { Object.assign(e, { state: 'enter', st: 0, ph: rand(0, 1), sq: 0, spd: 0, len: 40, tx: e.x, onGround: true, onPlat: null, dropT: 0, lastHp: e.hp }); },
  update: updWolf, draw: drawWolf,
  box(e) {
    if (e.pieces) return { x: e.x, y: -100, w: 0, h: 0 };
    if (e.state === 'pounce' || e.state === 'hop') return { x: e.x - 14, y: e.y - 20, w: 28, h: 17 };
    return { x: e.x - 13, y: e.y - 22, w: 26, h: 22 };
  },
  onKill(e, cx, cy, b) {
    boom(cx, cy, 0.6); sparks(cx, cy, 8); SFX.pop();
    shatter(e, [
      bit(e, P_WHEAD, 11, -16, 1.4, -4.2, 0.25, { smoke: true }),
      bit(e, P_WLEG, -8, -6, -1.6, -3.4, -0.35), bit(e, P_WLEG, 7, -6, 1.8, -3.0, 0.4),
      bit(e, P_WPLATE, -4, -16, -0.6, -4.6, 0.3), bit(e, P_WPLATE, 3, -15, 0.8, -3.8, -0.3),
      bit(e, P_WTAIL, -14, -14, -2.2, -3.2, -0.3), bit(e, P_SPRING, 0, -12, 0.3, -3.8, 0.5),
      ...nuts(e, 3, 0, -12)
    ], 66);
    addScore(100, cx, b.y);
    return 'dying';
  }
};

// ============================================================
// EAGLE: glides in high, circles, then screeches + red aim line (telegraph) and dives at where the hero was,
// pulls up and climbs away; sometimes carries an egg-bomb over the hero (blinking) and drops it
// ============================================================
// the rain from level2_sky.js (0..1), read once per frame (none on the mission card): in the downpour (WET) the wings
// are drawn a shade lighter, both with a light top edge, so they read against the storm clouds
let rainT = -1, rainV = 0, WET = false;
function rainNow() {
  if (rainT !== G.t) {
    rainT = G.t;
    const w = G.state !== 'missions' && typeof L2 !== 'undefined' && L2.weather ? L2.weather() : null;
    rainV = w ? clamp(+w.rain || 0, 0, 1) : 0;
  }
  return rainV;
}
// wing pose for elevation k (1 up .. -1 down): [wrist x, y, tip x, y] relative to the shoulder
function wingPose(k) {
  if (k >= 0) return [lerp(-8, -4, k), lerp(-3, -11, k), lerp(-19, -8, k), lerp(-5, -19, k)];
  const m = -k;
  return [lerp(-8, -4, m), lerp(-3, 5, m), lerp(-19, -9, m), lerp(-5, 11, m)];
}
function drawWing(sx, sy, k, far) {
  const [wx, wy, tx, ty] = wingPose(k);
  const ax = sx + wx, ay = sy + wy, bx = sx + tx, by = sy + ty;
  const dx = bx - sx, dy = by - sy, d = Math.hypot(dx, dy) || 1;
  let px = dy / d, py = -dx / d;
  if (px > 0.2 || (Math.abs(px) <= 0.2 && py < 0)) { px = -px; py = -py; }
  const fc = far ? METDD : WET ? MET : METD, fl = far ? (WET ? MET : METD) : WET ? METL : MET, ac = far ? METD : MET;
  // feathers: outline pass then fill, longer toward the tip (the last two are the fingered primaries)
  const F = [];
  for (let i = 0; i < 6; i++) {
    const u = i / 5, ux = u < 0.45 ? lerp(sx, ax, u / 0.45) : lerp(ax, bx, (u - 0.45) / 0.55), uy = u < 0.45 ? lerp(sy, ay, u / 0.45) : lerp(ay, by, (u - 0.45) / 0.55);
    const len = 4 + u * 5 - (i === 5 ? 2 : 0), ex = ux + px * len + (dx / d) * u * 3, ey = uy + py * len + (dy / d) * u * 3;
    F.push([ux, uy, ex, ey]);
  }
  for (const f of F) pl(f[0], f[1], f[2], f[3], 2, fc, true);
  for (const f of F) pl(f[0], f[1], f[2], f[3], 2, fc);
  for (const f of F) pl(f[0], f[1], lerp(f[0], f[2], 0.6), lerp(f[1], f[3], 0.6), 1, fl);
  limb([sx, sy, ax, ay, bx, by], 3, ac, far && !WET ? null : METL);
  if (!far) { R(Math.round(ax), Math.round(ay), 1, 1, METDD); R(Math.round(lerp(sx, ax, 0.5)), Math.round(lerp(sy, ay, 0.5)) - 1, 1, 1, '#ffffff'); }
}

function drawEagle(e) {
  if (e.pieces) { drawPieces(e); return; }
  const s = e.state, t = e.t;
  // aim line (telegraph): red dashes marching toward the target, a reticle on it
  if ((s === 'aim') && !e.hitT) {
    const sx = e.x, sy = e.y - 6, d = Math.hypot(e.tx - sx, e.ty - sy), n = Math.floor(d / 4), lock = e.st >= 12;
    for (let i = 1; i < n; i++) {
      if ((i + Math.floor(e.st / 2)) % 3 === 0) continue;
      const k = i / n;
      R(Math.round(lerp(sx, e.tx, k)) - 1, Math.round(lerp(sy, e.ty, k)) - 1, 2, 2, lock && (e.st >> 2) % 2 ? '#ffffff' : EVIL);
    }
    const r = lock ? 5 : 8 - e.st / 4, c = (e.st >> 2) % 2 ? EVIL : '#ffffff';
    R(Math.round(e.tx - r), Math.round(e.ty), 3, 1, c); R(Math.round(e.tx + r - 2), Math.round(e.ty), 3, 1, c);
    R(Math.round(e.tx), Math.round(e.ty - r), 1, 3, c); R(Math.round(e.tx), Math.round(e.ty + r - 2), 1, 3, c);
  }
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.facing, 1);
  FLASH = e.hitT > 0; WET = rainNow() > 0.3;
  if (s === 'dive' || s === 'pullup') drawEagleDive(e);
  else {
    // wing beat: flapping, gliding (wings held up in a shallow V) or the fast beat of the telegraph
    let k;
    if (s === 'aim') k = Math.sin(e.st * 0.7) * 0.8 + 0.2;
    else if (e.glide) k = 0.25 + Math.sin(t * 0.05) * 0.08;
    else k = Math.sin(e.flap * Math.PI * 2);
    const bob = Math.round(-k * 1.2);
    drawWing(1, -10 + bob, k, true);
    // tail fan
    for (const [ex, ey] of [[-17, -11], [-18, -8], [-16, -5]]) pl(-8, -8 + bob, ex, ey + bob, 2, SNOW, true);
    for (const [ex, ey] of [[-17, -11], [-18, -8], [-16, -5]]) pl(-8, -8 + bob, ex, ey + bob, 2, SNOW);
    R(-17, -11 + bob, 2, 1, METL); R(-16, -6 + bob, 2, 1, METL);
    // talons (holding the egg-bomb while carrying)
    const carry = s === 'carry';
    limb([-1, -4 + bob, carry ? -1 : -3, carry ? 1 + bob : -1 + bob], 2, GDD);
    limb([2, -4 + bob, carry ? 3 : 0, carry ? 1 + bob : -1 + bob], 2, GD);
    if (carry) {
      sp(EGG[(e.st >> 2) % 2], 1, 6 + bob);
      R(-2, 1 + bob, 2, 1, GD); R(3, 1 + bob, 2, 1, GD);
    }
    // body
    colBody([[-9, -9, -5], [-6, -11, -3], [0, -12, -2], [5, -12, -3], [8, -10, -5]], x => bob, MET, METD, METDD, 2, 2);
    R(-5, topAt(-5) + 2, 9, 1, METDD); R(-3, topAt(-3) + 3, 6, 1, METDD);
    R(-6, botAt(-6) - 1, 3, 1, GD); R(-1, botAt(-1) - 2, 1, 1, METL); R(3, botAt(3) - 2, 1, 1, METL);
    // head
    const open = s === 'aim' || (e.cry > 0);
    sp(EAGLE_HEAD[open ? 1 : 0], 6, -9 + bob);
    R(6, -19 + bob, 1, 2, METDD); R(6, -20 + bob, 1, 1, (t >> 4) % 2 ? EVIL : '#ffd0cc'); // antenna light
    if (s === 'aim' && !FLASH) {
      const on = (e.st >> 2) % 2;
      ctx.fillStyle = 'rgba(255,70,50,0.5)'; ctx.fillRect(8, -16 + bob, 6, 4);
      R(9, -15 + bob, 2, 1, on ? '#ffffff' : EVIL);
    }
    drawWing(-1, -9 + bob, k, false);
    R(-3, -9 + bob, 2, 2, METL);
  }
  FLASH = false; ctx.restore();
}

// diving: wings swept up and back into a V, talons out in front, head and beak leading (crisp strokes along the dive line)
function drawEagleDive(e) {
  const a = Math.atan2(e.dvy, Math.abs(e.dvx) + 0.01), ca = Math.cos(a), sa = Math.sin(a);
  const P = (u, v) => [u * ca + v * sa, -7 + u * sa - v * ca]; // u along the dive, v to its upper side
  const D = (u, v) => [u * ca + v * sa, u * sa - v * ca];
  const o = e.state === 'pullup' ? 3 : 0;                       // pulling up: the wings spread wider
  const wing = (du, dv, far) => {
    const s0 = P(1 + du, 2 + dv), w1 = P(-4 + du, 9 + dv + o), w2 = P(-12 + du - o, 13 + dv + o);
    const F = [];
    for (let i = 0; i < 6; i++) {
      const k = 0.2 + i * 0.16, b = k < 0.5 ? [lerp(s0[0], w1[0], k * 2), lerp(s0[1], w1[1], k * 2)] : [lerp(w1[0], w2[0], k * 2 - 1), lerp(w1[1], w2[1], k * 2 - 1)];
      const d = D(-4 - i * 0.7, -1.2 - i * 0.2);
      F.push([b[0], b[1], b[0] + d[0], b[1] + d[1]]);
    }
    for (const f of F) pl(f[0], f[1], f[2], f[3], 2, OUT, true);
    for (const f of F) pl(f[0], f[1], f[2], f[3], 2, far ? METDD : WET ? MET : METD);
    const q = WET ? 0.9 : 0.5; // in the rain the light lines run almost to the feather tips
    if (!far || WET) for (const f of F) pl(f[0], f[1], lerp(f[0], f[2], q), lerp(f[1], f[3], q), 1, WET && !far ? METL : MET);
    limb([s0[0], s0[1], w1[0], w1[1], w2[0], w2[1]], 3, far ? METD : MET, far && !WET ? null : METL);
    if (!far) { R(Math.round(w1[0]), Math.round(w1[1]), 1, 1, METDD); R(Math.round(lerp(s0[0], w1[0], 0.5)), Math.round(lerp(s0[1], w1[1], 0.5)), 1, 1, '#ffffff'); }
  };
  wing(-2, -1, true);
  // tail fan
  for (const v of [-2, 0, 2]) { const t0 = P(-7, 0), t1 = P(-14, v); pl(t0[0], t0[1], t1[0], t1[1], 2, SNOW, true); }
  for (const v of [-2, 0, 2]) { const t0 = P(-7, 0), t1 = P(-14, v); pl(t0[0], t0[1], t1[0], t1[1], 2, SNOW); }
  // body: a dark steel torpedo with a lighter back stripe and a rivet
  const b0 = P(-7, 0), b1 = P(5, 0);
  pl(b0[0], b0[1], b1[0], b1[1], 6, METD, true); pl(b0[0], b0[1], b1[0], b1[1], 6, METD);
  const h0 = P(-5, 2), h1 = P(4, 2), rv = P(-1, 0);
  pl(h0[0], h0[1], h1[0], h1[1], 1, MET); R(Math.round(rv[0]), Math.round(rv[1]), 1, 1, METL);
  // talons thrust forward, claws open
  const k0 = P(2, -3), k1 = P(8, -5);
  limb([k0[0], k0[1], k1[0], k1[1]], 2, GD, GDL);
  const c1 = P(9, -4), c2 = P(9, -7);
  R(Math.round(c1[0]), Math.round(c1[1]), 2, 1, GDD); R(Math.round(c2[0]), Math.round(c2[1]), 1, 2, GDD);
  // head: white dome, gold hooked beak, red visor-eye
  const hd = P(8, 1), hx = Math.round(hd[0]), hy = Math.round(hd[1]), bk = P(13, 0.5);
  pl(hd[0], hd[1], bk[0], bk[1], 2, GD, true);
  blob([[hx - 3, hy - 2, 6, 5], [hx - 2, hy - 3, 4, 7]], SNOW);
  pl(hd[0] + ca * 2, hd[1] + sa * 2, bk[0], bk[1], 2, GD); R(Math.round(bk[0]), Math.round(bk[1]), 1, 1, GDD);
  const ey = P(9, 2);
  R(Math.round(ey[0]) - 1, Math.round(ey[1]) - 1, 3, 2, METDD); R(Math.round(ey[0]), Math.round(ey[1]) - 1, 2, 1, EVIL);
  wing(0, 0, false);
  // speed lines
  if (!FLASH && e.state === 'dive') for (let i = 0; i < 3; i++) { const q = P(-18 - i * 5, -3 + i * 3); R(Math.round(q[0]), Math.round(q[1]), 3, 1, 'rgba(255,255,255,0.7)'); }
}

function updEagle(e) {
  if (e.pieces) { updPieces(e); return; }
  const p = G.p, L = scrL(), minX = L + 34, maxX = L + W - 34;
  e.st++;
  if (e.cry > 0) e.cry--;
  if (hitNow(e)) { e.vy -= 0.6; e.cry = 10; }
  const glide = (tx, ty, sp) => {
    e.vx += clamp(tx - e.x, -sp, sp) * 0.03 - e.vx * 0.04;
    e.vy += (ty - e.y) * 0.02 - e.vy * 0.12;
  };
  switch (e.state) {
    case 'enter': {
      const tx = clamp(p.x + e.offX, minX + 30, maxX - 30);
      glide(tx, e.alt, 2.2);
      if (e.x > minX && e.x < maxX) { go(e, 'glide'); if (G.t - screechAt > 90) { screechAt = G.t; e.cry = 16; SFX.screech(); } }
      break;
    }
    case 'glide': {
      if (e.st % 130 === 0) e.offX = -Math.sign(e.offX || 1) * rand(40, 100);
      const tx = clamp(p.x + e.offX, minX, maxX);
      glide(tx, e.alt + Math.sin(e.t * 0.04) * 6, 1.5);
      if (--e.cd <= 0 && e.x > minX && e.x < maxX && !p.dead) {
        const egg = e.atk % 3 === 1 || (e.atk % 3 === 2 && rand(0, 1) < 0.3);
        e.atk++;
        if (egg) go(e, 'carry'); else { go(e, 'aim'); SFX.screech(); e.cry = 30; }
      }
      break;
    }
    case 'aim': {
      // hover, drift away if right above the hero (for a slanting dive), track the hero, then lock the target
      e.vx *= 0.85; e.vy *= 0.85;
      if (Math.abs(p.x - e.x) < 50) e.x += (e.x < p.x ? -1 : 1) * 0.7;
      e.x = clamp(e.x, minX, maxX);
      if (e.st <= 12) { e.tx = clamp(p.x, L + 16, L + W - 16); e.ty = p.y - 14; }
      e.facing = e.tx < e.x ? -1 : 1;
      if (e.st >= 38) {
        const dx = e.tx - e.x, dy = e.ty - (e.y - 6), d = Math.hypot(dx, dy) || 1;
        e.dvx = dx / d * 3.8; e.dvy = dy / d * 3.8; e.dleft = d / 3.8 + 4;
        go(e, 'dive'); Snd.tone('sawtooth', 1500, 500, 0.3, 0.04);
      }
      break;
    }
    case 'dive':
      e.vx = e.dvx; e.vy = e.dvy;
      if (--e.dleft <= 0 || e.y > groundAt(e.x) - 10) { go(e, 'pullup'); e.vy = Math.min(e.vy, 2.5); }
      break;
    case 'pullup':
      e.vy -= 0.24; e.vx *= 0.985; e.dvy = e.vy; e.dvx = e.vx;
      if (e.vy < -1.6) { go(e, 'climb'); }
      break;
    case 'climb':
      e.vy = lerp(e.vy, -1.5, 0.1); e.vx = lerp(e.vx, e.facing * 0.9, 0.05);
      if (e.x < minX) e.vx = Math.max(e.vx, 0.8); else if (e.x > maxX) e.vx = Math.min(e.vx, -0.8);
      if (e.y <= e.alt + 2) { go(e, 'glide'); e.vy = 0; e.cd = rand(150, 220) | 0; }
      break;
    case 'carry': {
      // fly over the hero holding the blinking egg-bomb (telegraph), then let go
      glide(clamp(p.x, minX, maxX), e.alt, 2);
      if (e.st % 12 === 0) SFX.beep();
      if ((e.st >= 40 && Math.abs(p.x - e.x) < 22) || e.st >= 100) {
        G.eb.push({ k: 'egg', x: e.x + e.facing, y: e.y + 6, vx: e.vx * 0.5, vy: 0.4, g: 0.11, life: 400, fuse: 0 });
        Snd.throw(); go(e, 'glide'); e.cd = rand(150, 210) | 0;
      }
      break;
    }
  }
  // keep clear of the other eagles: two never fly as one blob
  if (e.state === 'glide' || e.state === 'enter' || e.state === 'carry' || e.state === 'climb') {
    for (const o of G.enemies) {
      if (o === e || o.type !== 'eagle' || o.pieces || !o.active) continue;
      const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy);
      if (d < 34) { e.vx += (d > 0.5 ? dx / d : e.facing) * 0.09; e.vy += (d > 0.5 ? dy / d : -1) * 0.05; }
    }
  }
  e.x += e.vx; e.y += e.vy;
  if (e.state === 'glide' || e.state === 'enter' || e.state === 'carry' || e.state === 'climb') {
    if (e.vx > 0.25) e.facing = 1; else if (e.vx < -0.25) e.facing = -1;
  } else if (e.state === 'dive' || e.state === 'pullup') e.facing = e.vx < 0 ? -1 : 1;
  // wing beats: flap while climbing or slow, glide otherwise
  e.glide = e.state === 'glide' && e.vy > -0.3 && Math.abs(e.vx) > 0.6 && (e.t % 200) < 120;
  if (!e.glide) {
    const was = e.flap;
    e.flap = (e.flap + (e.state === 'climb' ? 0.07 : 0.045)) % 1;
    if (was < 0.25 && e.flap >= 0.25 && e.x > L && e.x < L + W) SFX.flap();
  }
}

ENEMY_TYPES.eagle = {
  hp: 3, flying: true, edge: 24,
  contact: e => e.state === 'dive' ? 'hurt' : 'none',
  make(e, s) {
    const alt = s.alt || (e.lock ? rand(64, 84) : rand(66, 96));
    if (!s.y) e.y = alt;
    Object.assign(e, { alt, state: 'enter', st: 0, vx: 0, vy: 0, flap: rand(0, 1), cd: rand(70, 110) | 0, offX: (rand(0, 1) < 0.5 ? -1 : 1) * rand(50, 100),
      tx: 0, ty: 0, dvx: 0, dvy: 1, dleft: 0, atk: 0, cry: 0, glide: false, lastHp: e.hp });
  },
  update: updEagle, draw: drawEagle,
  box(e) {
    if (e.pieces) return { x: e.x, y: -100, w: 0, h: 0 };
    return { x: e.x - 14, y: e.y - 15, w: 28, h: 15 };
  },
  onKill(e, cx, cy, b) {
    boom(cx, cy, 0.6); sparks(cx, cy, 8); SFX.pop();
    const f = [];
    for (let i = 0; i < 5; i++) f.push(bit(e, P_FEATHER, rand(-8, 8), -8, rand(-1, 1), rand(-2.5, -1), 0, { flut: true, b: i * 1.7 }));
    shatter(e, [
      bit(e, P_EHEAD, 9, -10, 1.6, -3.6, 0.3, { smoke: true }), bit(e, P_EWING, -6, -14, -1.8, -3.2, -0.25), bit(e, P_EWING, 2, -16, 1.2, -3.8, 0.3),
      bit(e, P_EBODY, 0, -7, 0.2, -2.6, 0.15, { smoke: true }), ...f, ...nuts(e, 2, 0, -7)
    ], 90);
    addScore(150, cx, b.y);
    return 'dying';
  }
};

// ============================================================
// BEAR (and the ROBO BEAR mini-boss): heavy walk that shakes the ground; picks an attack by distance, each with a
// wind-up: rear up + swipe (close), lift + throw a boulder or log (far), paw the ground + short charge (middle)
// ============================================================
// key poses at scale 1 (facing right, feet at 0,0): body profile [x, top, bottom], hip, shoulder, neck
const BPOSE = {
  four: { prof: [[-27, -27, -15], [-25, -32, -13], [-19, -36, -12], [-8, -39, -12], [0, -42, -13], [6, -43, -14], [11, -40, -17], [15, -33, -21]], hip: [-17, -19], sh: [7, -21], neck: [15, -22] },
  half: { prof: [[-21, -29, -14], [-18, -36, -12], [-10, -43, -11], [-2, -47, -12], [4, -47, -14], [9, -43, -17], [12, -36, -22]], hip: [-12, -17], sh: [5, -32], neck: [11, -36] },
  up: { prof: [[-14, -28, -13], [-13, -39, -11], [-10, -47, -10], [-4, -52, -10], [3, -53, -11], [9, -50, -13], [12, -44, -16], [14, -36, -21]], hip: [-4, -16], sh: [5, -43], neck: [9, -46] }
};
// attack order away from the bear's paws: throw, charge, throw (close up it always rears and swipes)
const BEAR_ATK = ['lift', 'paw', 'lift'];
const bearPal = robo => robo ? [RBL, RB, RBD, RBDD] : [BRL, BR, BRD, BRDD];
// the swiping arm sweeps a circle round the shoulder: k 0 = cocked back over the head, 1 = down in front
const swipeAng = k => lerp(-1.75, 0.65, k);

function drawBear(e) {
  if (e.pieces) { drawPieces(e); return; }
  const S = e.S, robo = e.robo, s = e.state, t = e.t, ph2 = e.hp < e.max / 2;
  const [AL, A, AD, ADD] = bearPal(robo);
  const sx = v => Math.round(v * S);
  let pose = BPOSE.four, gait = 0, bob = 0, headI = 0, hdy = 0, arms = null, hold = null, lean = 0, jit = 0;
  const ph = e.ph;
  if (s === 'walk' || s === 'enter' || s === 'intro') {
    gait = 1; bob = Math.round(Math.abs(Math.sin(ph * Math.PI * 2)) * -1);
    if (s === 'walk' && !e.moving) { gait = 0; bob = (t >> 5) % 2 ? -1 : 0; } // standing: slow breathing
  } else if (s === 'charge') { gait = 2; bob = Math.round(Math.abs(Math.sin(ph * Math.PI * 2)) * -2) + 1; hdy = 5; lean = 2; }
  else if (s === 'paw') { hdy = 3; lean = -1; }
  else if (s === 'skid') { hdy = 2; lean = -2; }
  else if (s === 'rear' || s === 'roar' || s === 'lift') {
    pose = e.st < 6 ? BPOSE.half : BPOSE.up;
    headI = s === 'lift' ? 0 : 1;
    if (pose === BPOSE.up) arms = s === 'lift' ? 'hold' : s === 'roar' ? 'roar' : 'raise';
    else arms = 'down';
    if (s === 'lift' && e.st > 8) hold = e.held;
  } else if (s === 'swipe') { pose = BPOSE.up; arms = 'swipe'; headI = 1; lean = Math.min(3, e.st >> 1); }
  else if (s === 'throw') { pose = e.st < 8 ? BPOSE.up : BPOSE.half; arms = 'throw'; headI = 1; }
  else if (s === 'recover') { pose = e.st < 10 ? BPOSE.half : BPOSE.four; arms = 'down'; }
  else if (s === 'dying') { jit = e.st % 4 < 2 ? 1 : -1; headI = (e.st >> 3) % 2; hdy = 2; }
  ctx.save(); ctx.translate(Math.round(e.x) + jit, Math.round(e.y)); ctx.scale(e.facing, 1);
  FLASH = e.hitT > 0 || (s === 'dying' && e.st % 12 < 2);
  const four = pose === BPOSE.four, up = pose === BPOSE.up;
  const hipX = pose.hip[0], hipY = pose.hip[1] + bob, shX = pose.sh[0] + lean, shY = pose.sh[1] + bob;
  // legs: [joint x, joint y, hind?, near?, phase offset]
  const LEGS = [[hipX + 4, hipY, true, false, 0.5], [shX + 3, shY, false, false, 0], [hipX, hipY, true, true, 0], [shX, shY, false, true, 0.5]];
  const legPos = L => {
    const [jx, , hind, near, off] = L;
    let fx = jx + (hind ? -1 : 1), fy = 0;
    if (!four && hind) fx = jx + (near ? 3 : 8);
    if (gait && four) {
      const stride = gait === 2 ? 20 : 12, lift = gait === 2 ? 6 : 3;
      const q = ((ph + off + (gait === 2 && !hind ? 0.25 : 0)) % 1 + 1) % 1;
      if (q < 0.55) fx += stride / 2 - stride * q / 0.55;
      else { const u = (q - 0.55) / 0.45; fx += -stride / 2 + stride * u; fy = -Math.sin(Math.PI * u) * lift; }
    }
    if (s === 'paw' && !hind && near) { const q = (e.st % 16) / 16; fx = jx + 9 - q * 15; fy = -Math.max(0, Math.sin(q * Math.PI)) * 7; }
    if (s === 'skid' && !hind) fx = jx + 10;
    if (s === 'skid' && hind) fx = jx - 3;
    return [fx, fy];
  };
  // plantigrade legs: thick thigh under an armour cap, a narrower shin, a big flat paw with three steel claws
  const drawLeg = L => {
    const [jx, jy, hind, near] = L, [fx, fy] = legPos(L);
    const ax = sx(jx), ay = sx(jy), ank = sx(4);
    const k = knee(ax, ay, sx(fx), sx(fy) - ank, sx(hind ? 9.5 : 9), sx(9), hind ? -0.6 : 0.6), kx = k[0], ky = k[1], px = k[2], py = k[3];
    const c = near ? BLG : BLGD, hi = near ? BLGL : null;
    limb([kx, ky, px, py + ank - 2], sx(near ? 6 : 5), c, hi);
    limb([ax, ay, kx, ky], sx(near ? 8 : 7), c, hi);
    const tw = sx(10), th = sx(7), tx = Math.round(lerp(ax, kx, 0.3)) - (tw >> 1), ty = Math.round(lerp(ay, ky, 0.3)) - (th >> 1);
    blob([[tx, ty + 1, tw, th - 1], [tx + 1, ty, tw - 2, 1]], near ? A : AD);
    R(tx + 1, ty, tw - 2, 1, near ? AL : A); R(tx, ty + th - 1, tw, 1, near ? AD : ADD); if (near) R(tx + 2, ty + 2, 1, 1, METL);
    joint(kx, ky, METDD, near ? METL : METD);
    const pw = sx(11), phh = sx(4), pxx = Math.round(px) - (pw >> 1) + 1, pyy = Math.round(py) + ank - phh;
    blob([[pxx, pyy, pw, phh], [pxx + 1, pyy - 1, pw - 4, 1]], near ? METDD : '#262b33');
    R(pxx + 1, pyy - 1, pw - 4, 1, near ? METD : METDD); R(pxx + 1, pyy, pw - 2, 1, near ? METD : METDD);
    for (let i = 0; i < 3; i++) R(pxx + pw, pyy + i * (phh > 4 ? 2 : 1) + 1, 2, 1, near ? TEETH : METL);
  };
  // standing up, the front legs are arms: [elbow, paw] per pose
  const trail = s === 'swipe' && e.st < 12;
  const armPts = (near) => {
    let ex, ey, px, py;
    const m = arms;
    if (m === 'raise') [ex, ey, px, py] = near ? [-3, -55, 0, -67] : [12, -56, 16, -70];
    else if (m === 'swipe' && near) {
      const k = clamp(e.st / 6, 0, 1), a = swipeAng(k);
      px = shX + Math.cos(a) * 27; py = shY + Math.sin(a) * 27; ex = shX + Math.cos(a - 0.35) * 14; ey = shY + Math.sin(a - 0.35) * 14;
      return [ex, ey, px, py];
    } else if (m === 'swipe') [ex, ey, px, py] = [12, -56, 16, -70];
    else if (m === 'roar') [ex, ey, px, py] = near ? [14, -53, 21, -63 + (t % 6 < 3 ? 0 : 1)] : [-4, -54, -3, -66 + (t % 6 < 3 ? 1 : 0)];
    else if (m === 'hold') [ex, ey, px, py] = near ? [12, -55, 8, -68] : [5, -56, 1, -68];
    else if (m === 'throw') [ex, ey, px, py] = near ? [15, -48, 26, -45] : [13, -50, 24, -48];
    else [ex, ey, px, py] = near ? [10, -34, 14, -22] : [12, -35, 17, -23];
    return [ex + lean, ey + bob, px + lean, py + bob];
  };
  const drawArm = near => {
    const [ex, ey, px, py] = armPts(near), jx = shX + (near ? 0 : 3), jy = shY - (near ? 0 : 2);
    const c = near ? BLG : BLGD, hi = near ? BLGL : null;
    limb([sx(ex), sx(ey), sx(px), sx(py)], sx(near ? 6 : 5), c, hi);
    limb([sx(jx), sx(jy), sx(ex), sx(ey)], sx(near ? 7 : 6), c, hi);
    const cw = sx(9), ch = sx(6), cx = sx(lerp(jx, ex, 0.3)) - (cw >> 1), cy = sx(lerp(jy, ey, 0.3)) - (ch >> 1);
    blob([[cx, cy, cw, ch]], near ? A : AD); R(cx, cy, cw, 1, near ? AL : A);
    joint(sx(ex), sx(ey), METDD, near ? METL : METD);
    // paw + claws pointing along the forearm
    const d = Math.hypot(px - ex, py - ey) || 1, ux = (px - ex) / d, uy = (py - ey) / d, pw = sx(8);
    const qx = sx(px) - (pw >> 1), qy = sx(py) - (pw >> 1);
    blob([[qx, qy + 1, pw, pw - 2], [qx + 1, qy, pw - 2, pw]], near ? MET : METD); R(qx + 1, qy, pw - 2, 1, near ? METL : MET);
    R(qx + 1, qy + pw - 2, pw - 2, 1, near ? METD : METDD); R(qx + (pw >> 1) - 1, qy + (pw >> 1) - 1, 2, 2, METDD);
    const cl = near ? TEETH : METL;
    for (let i = -1; i <= 1; i++) {
      const bx = sx(px) + ux * (pw / 2) - uy * i * 2.5, by = sx(py) + uy * (pw / 2) + ux * i * 2.5;
      pl(bx, by, bx + ux * 3, by + uy * 3, 1, cl);
    }
    // claw trails while swiping
    if (trail && near && !FLASH) {
      const k = clamp(e.st / 6, 0, 1);
      for (let i = 0; i < 3; i++) arcDots(sx(shX), sx(shY), sx(22 + i * 4), swipeAng(Math.max(0, k - 0.7)), swipeAng(k), 10, i === 1 ? '#ffffff' : '#ffe9a0');
    }
  };
  // far side: hind leg, front leg or arm
  drawLeg(LEGS[0]);
  if (four) drawLeg(LEGS[1]); else drawArm(false);
  // stubby tail and two exhaust pipes on the back
  const pr = pose.prof;
  blob([[sx(pr[0][0]) - 3, sx(pr[0][1]) + 2 + bob, 4, 4]], AD);
  const pipeX = sx(up ? -9 : -16), pipeY = up ? sx(-44) + bob : sx(-36) + bob;
  for (let i = 0; i < 2; i++) { const px = pipeX + i * 4 - (up ? 4 : 0), py = pipeY - i * 2; RO(px, py - sx(5), 3, sx(6), METDD); R(px, py - sx(5), 3, 1, METL); }
  // body: metal frame below, scalloped armour plates on top (on the back when upright), rivets along the edge
  const prof = pr.map(q => [sx(q[0]), sx(q[1]), sx(q[2])]);
  colBody(prof, () => bob, METL, MET, METD, 1, 2);
  const x0 = prof[0][0], x1 = prof[prof.length - 1][0], pw = sx(9), frac = four ? 0.55 : up ? 0.3 : 0.5;
  for (let x = x0; x <= x1; x++) {
    const tp = topAt(x), bt = botAt(x), u = ((x - x0) % pw) / pw;
    let dep = Math.round((bt - tp) * frac) + Math.round(Math.sin(u * Math.PI) * 2);
    if (up && x < sx(-7)) dep = bt - tp - 3;
    R(x, tp, 1, dep, A); R(x, tp, 1, 1, AL); R(x, tp + 1, 1, 1, u < 0.5 ? AL : A); R(x, tp + dep - 1, 1, 1, AD);
    if (u * pw < 1 && x > x0 + 1 && x < x1 - 1) { R(x, tp + 1, 1, dep - 1, ADD); R(x + 1, tp + 2, 1, dep - 4, AL); }
    if (Math.round(u * pw) === (pw >> 1) && x > x0 + 2 && x < x1 - 2) R(x, tp + dep - 3, 1, 1, METL);
    // standing up, the belly shows: rounded steel plates (a seam, a lit edge) with a lighter middle
    if (!four) {
      if (x > x0 + 2 && x < x1 - 2) R(x, tp + dep + 1, 1, Math.max(0, bt - tp - dep - 4), x > sx(-2) && x < sx(8) ? METL : MET);
      for (const k of [10, 17, 24]) { const yy = sx(-k) + bob; if (yy > tp + dep + 1 && yy < bt - 2) { R(x, yy, 1, 1, METD); R(x, yy + 1, 1, 1, METL); } }
    }
  }
  if (robo) for (let i = 0; i < 3; i++) { // gold spikes along the hump
    const kx = sx(four ? -10 + i * 7 : -10 + i * 5), ky = topAt(kx);
    blob([[kx - 1, ky - 3, 3, 3], [kx, ky - 5, 1, 2]], A); R(kx, ky - 5, 1, 2, AL);
  }
  // belly vents
  const vx = sx(four ? -8 : -2), vy = botAt(vx) - sx(5);
  for (let i = 0; i < 3; i++) R(vx + i * 3, vy, 2, sx(3), METDD);
  // the chest light: a blinking red lamp; robo bear: a big glowing core (cyan, red when hurt)
  if (robo) {
    const cxp = sx(four ? 9 : 5), cyp = Math.round(lerp(topAt(cxp), botAt(cxp), 0.62)), pulse = (Math.sin(t * 0.15) + 1) / 2;
    RO(cxp - 3, cyp - 3, 7, 7, METDD);
    if (!FLASH) { ctx.fillStyle = ph2 ? 'rgba(255,80,60,' + (0.25 + pulse * 0.25).toFixed(2) + ')' : 'rgba(110,240,255,' + (0.25 + pulse * 0.25).toFixed(2) + ')'; ctx.fillRect(cxp - 5, cyp - 5, 11, 11); }
    R(cxp - 2, cyp - 2, 5, 5, ph2 ? EVIL : '#6ff0ff'); R(cxp - 1, cyp - 1, 2, 2, '#ffffff');
  } else {
    const cxp = sx(four ? 9 : 5), cyp = Math.round(lerp(topAt(cxp), botAt(cxp), 0.66));
    RO(cxp - 2, cyp - 2, 5, 4, METDD); R(cxp - 1, cyp - 1, 3, 2, (t >> 4) % 2 ? EVIL : '#ff8a80');
  }
  // head
  const hd = (robo ? ROBO_HEAD : BEAR_HEAD)[headI];
  const nx = sx(pose.neck[0] + lean), ny = sx(pose.neck[1]) + bob + hdy;
  sp(hd, nx, ny);
  const flash = s === 'rear' || s === 'paw' || s === 'lift' || (s === 'roar' && e.st > 10) || (s === 'dying' && e.st % 16 < 8);
  if (flash && !FLASH) {
    const on = (e.st >> 2) % 2, ex2 = nx + 5, ey2 = ny - 9 - (robo ? 2 : 0);
    ctx.fillStyle = 'rgba(255,70,50,0.45)'; ctx.fillRect(ex2 - 2, ey2 - 3, 9, 6);
    R(ex2, ey2 - 1, 5, 2, on ? '#ffffff' : EVIL); R(ex2 + 1, ey2 - 2, 3, 4, on ? '#ffffff' : EVIL);
  }
  if (s === 'paw' && e.st % 16 < 9 && !FLASH) { ctx.fillStyle = 'rgba(235,240,245,0.75)'; const q = e.st % 16; circ(nx + 21 + (robo ? 2 : 0) + q, ny - 8 - q * 0.3, 1.5 + q * 0.3); }
  // near side
  if (four) drawLeg(LEGS[3]); else drawArm(true);
  drawLeg(LEGS[2]);
  if (hold) drawHeld(sx(4) + lean, sx(-75) + bob, hold);
  FLASH = false; ctx.restore();
}

function drawHeld(x, y, k) {
  if (k === 'boulder') sp(BOULDER[0], x, y);
  else { RO(x - 12, y - 3, 24, 7, WD); R(x - 12, y - 3, 24, 2, WDL); R(x - 12, y + 2, 24, 2, WDD); RO(x + 10, y - 3, 3, 7, RING); R(x + 11, y - 1, 1, 2, WDD); R(x - 6, y - 1, 5, 1, WDD); }
}

function updBear(e) {
  if (e.pieces) { updPieces(e); return; }
  const p = G.p, L = scrL(), dx = p.x - e.x, adx = Math.abs(dx), dir = dx < 0 ? -1 : 1;
  const S = e.S, half = 26 * S, minX = L + half + 8, maxX = L + W - half - 8, ph2 = e.hp < e.max / 2;
  const vis = e.x > L - 40 && e.x < L + W + 40;
  e.st++;
  hitNow(e);
  if (e.calm > 0) e.calm--;
  let mv = 0;
  e.moving = false;
  const footfall = () => {
    if (vis) { G.shake = Math.max(G.shake, 1.2 * S); SFX.heavy(); }
    dust(e.x + e.facing * 6 * S, e.y, 2); dust(e.x - e.facing * 16 * S, e.y, 2);
  };
  switch (e.state) {
    case 'intro':
    case 'enter': {
      const into = e.x < L + W / 2 ? 1 : -1;
      e.facing = into; mv = into * (e.robo ? 0.9 : 0.7);
      if (e.x > minX + 10 && e.x < maxX - 10) { go(e, 'roar'); SFX.roar(e.robo); G.shake = Math.max(G.shake, e.robo ? 5 : 3); }
      break;
    }
    case 'roar':
      if (e.st % 8 === 0) G.shake = Math.max(G.shake, e.robo ? 3 : 1.5);
      if (e.st >= 56) { e.inv = false; go(e, 'walk'); e.cd = 50; e.calm = 100; } // gives the hero room first
      break;
    case 'walk': {
      if (e.turn > 0) { if (--e.turn === 0) e.facing = dir; break; }
      if (dir !== e.facing && adx > 12) { e.turn = 12; break; }
      // keeps its distance: close enough to scare, far enough to throw; backs off when the hero gets too close
      // (after a charge it backs off before it rears up again)
      if (adx > 84 * S) mv = dir * (ph2 ? 0.6 : 0.45);
      else if (adx < (e.calm > 0 ? 64 : 40) * S) mv = -dir * 0.5;
      if (--e.cd <= 0 && e.x > minX - 10 && e.x < maxX + 10 && !p.dead) {
        const close = adx < 54 * S;
        const k = close && !e.calm ? (p.onGround ? 'rear' : 'wait') : BEAR_ATK[e.atk++ % BEAR_ATK.length];
        if (k === 'wait') e.cd = 6; // the hero is jumping right over it: rear up once they land
        else if (k === 'rear') { go(e, 'rear'); SFX.roar(false); }
        else if (k === 'paw' && adx < 200) { go(e, 'paw'); e.goal = p.x; SFX.snort(); } // charges at where the hero is now
        else { go(e, 'lift'); e.held = rand(0, 1) < 0.5 ? 'boulder' : 'log'; }
      }
      break;
    }
    case 'rear': // wind-up: up on the hind legs, a paw cocked high, roaring, eyes flashing (it doesn't turn: jump over it!)
      if (e.st >= 36) { go(e, 'swipe'); SFX.swipe(); }
      break;
    case 'swipe': {
      // only the space right in front of the bear: step back while it rears up!
      if (e.st >= 3 && e.st <= 8 && !p.dead) {
        const bx = e.facing > 0 ? e.x + 4 * S : e.x - 40 * S;
        if (overlap(pbox(p), { x: bx, y: e.y - 64 * S, w: 36 * S, h: 64 * S })) hurtPlayer();
      }
      if (e.st === 6) { G.shake = Math.max(G.shake, 3); dust(e.x + e.facing * 30 * S, e.y, 6); }
      if (e.st >= 16) go(e, 'recover');
      break;
    }
    case 'paw': // wind-up: scrape the ground, snort steam, eyes flashing
      e.facing = e.goal < e.x ? -1 : 1;
      if (e.st % 16 === 8) { dust(e.x + e.facing * 4 * S, e.y, 3, -e.facing); SFX.snort(); }
      if (e.st >= 44) {
        // a short charge: to where the hero stood when the pawing began (a bit past it), at most 140px
        e.goal = clamp(e.goal + e.facing * 16, e.x - 140, e.x + 140);
        e.goal = clamp(e.goal, minX + 4, maxX - 4); e.vx = 0;
        go(e, 'charge'); SFX.roar(false);
      }
      break;
    case 'charge': {
      e.vx = clamp(e.vx + e.facing * 0.3, -3.2, 3.2); mv = e.vx;
      if (e.st % 4 === 0) dust(e.x - e.facing * 20 * S, e.y, 2, -e.facing);
      if (e.st % 10 === 0) footfall();
      const past = e.facing > 0 ? e.x >= e.goal : e.x <= e.goal;
      if (past || e.st > 70 || e.x < minX || e.x > maxX) go(e, 'skid');
      break;
    }
    case 'skid':
      e.vx *= 0.85; mv = e.vx;
      if (e.st % 2 === 0) { dust(e.x + e.facing * 16 * S, e.y, 2, e.facing); sparks(e.x + e.facing * 14 * S, e.y - 1, 1); }
      if (e.st >= 22) { go(e, 'walk'); e.cd = (ph2 ? 90 : 120) | 0; e.calm = 150; }
      break;
    case 'lift': // wind-up: reach down, lift the boulder / log high over the head
      e.facing = dir;
      if (e.st === 10) Snd.tone('square', 200, 140, 0.2, 0.05);
      if (e.st >= 38) {
        const x0 = e.x + e.facing * 6 * S, y0 = e.y - 72 * S, vy = -3.2, g = 0.15;
        const gy = groundAt(p.x), tAir = (-vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, gy - y0))) / g;
        const vx = clamp((p.x - x0) / tAir, -3.2, 3.2);
        G.eb.push({ k: e.held, x: x0, y: y0, vx, vy, g, life: 400, rot: 0 });
        SFX.throw(); go(e, 'throw');
      }
      break;
    case 'throw':
      if (e.st >= 16) go(e, 'recover');
      break;
    case 'recover':
      if (e.st >= 22) { go(e, 'walk'); e.cd = (ph2 ? rand(50, 80) : rand(80, 120)) | 0; }
      break;
    case 'dying': {
      // robo bear: shudders, sparks and pops, smoke pours out, then it flies apart
      G.shake = Math.max(G.shake, 2.5);
      if (e.st % 9 === 0) boom(e.x + rand(-26, 26) * S, e.y - rand(10, 44) * S, rand(0.5, 0.9));
      if (e.st % 3 === 0) sparks(e.x + rand(-20, 20) * S, e.y - rand(10, 40) * S, 3);
      if (e.st % 5 === 0) G.parts.push({ type: 'smoke', x: e.x + rand(-16, 16) * S, y: e.y - rand(30, 46) * S, vx: rand(-0.3, 0.3), vy: -0.9, life: 50, max: 50, size: 4 });
      if (e.st >= 84) bearBurst(e, true);
      return;
    }
  }
  if (e.state === 'walk' || e.state === 'enter' || e.state === 'intro') {
    if (mv) {
      e.moving = true;
      const was = e.ph;
      e.ph = (e.ph + Math.abs(mv) / (16 * S)) % 1;
      if (Math.floor(was * 2) !== Math.floor(e.ph * 2)) footfall();
    }
  } else if (e.state === 'charge') e.ph = (e.ph + Math.abs(mv) / (24 * S)) % 1;
  if (e.state !== 'enter' && e.state !== 'intro') {
    if ((e.x + mv < minX && mv < 0) || (e.x + mv > maxX && mv > 0)) mv = 0;
  }
  e.x += mv;
  // exhaust puffs from the pipes on its back (more when it charges or is badly hurt)
  if (vis && e.t % (e.state === 'charge' || ph2 ? 9 : 26) === 0) {
    const up = e.state === 'rear' || e.state === 'swipe' || e.state === 'lift' || e.state === 'roar' || e.state === 'throw';
    G.parts.push({ type: 'smoke', x: e.x - e.facing * (up ? 11 : 15) * S, y: e.y - (up ? 50 : 42) * S, vx: -e.facing * 0.4, vy: -0.7, life: 34, max: 34, size: 2.5 });
  }
  const py = e.y;
  e.vy = Math.min((e.vy || 0) + 0.3, 6); e.y += e.vy;
  land(e, py);
}

// the big break-apart (bear: on kill; robo bear: at the end of its dying shake)
function bearBurst(e, robo) {
  const S = e.S;
  boom(e.x, e.y - 26 * S, robo ? 2 : 1.4);
  for (let i = 0; i < (robo ? 5 : 3); i++) G.later.push({ t: 5 + i * 7, x: e.x + rand(-24, 24) * S, y: e.y - rand(8, 40) * S, s: rand(0.7, 1.2) });
  sparks(e.x, e.y - 30, 12);
  const pl2 = robo ? P_BPLATE[1] : P_BPLATE[0];
  const list = [
    bit(e, robo ? ROBO_HEAD[1] : BEAR_HEAD[1], 18 * S, -30 * S, 1.8, -4.8, 0.2, { smoke: true }),
    bit(e, P_BPAW, 14, -4, 2.4, -3.4, 0.4), bit(e, P_BPAW, -16, -4, -2.2, -3.6, -0.35),
    bit(e, P_BLEG, 8, -12, 1.2, -4.2, 0.3), bit(e, P_BLEG, -18, -12, -1.6, -4.4, -0.3),
    bit(e, pl2, -6, -38 * S, -0.8, -5.2, -0.2), bit(e, pl2, 6, -40 * S, 1.0, -5.6, 0.25), bit(e, pl2, -18, -30 * S, -2.0, -4.2, -0.3),
    bit(e, P_SPRING, 0, -20, 0.5, -4.4, 0.6), ...nuts(e, robo ? 6 : 4, 0, -24)
  ];
  if (robo) list.push(bit(e, P_HELMET, 18 * S, -40 * S, -0.6, -6.2, 0.35), bit(e, P_CORE, 8, -24 * S, 0.4, -5.4, 0.3, { smoke: true }));
  shatter(e, list, robo ? 110 : 90);
  if (robo) { dropItem('heart', e.x, e.y - 30, 0); G.texts.push({ x: e.x, y: e.y - 70, s: 'ROBO BEAR DOWN!', t: 100, c: '#ffe066' }); }
}

function bearMake(robo) {
  return (e) => {
    Object.assign(e, { S: robo ? 1.25 : 1, robo, state: robo ? 'intro' : 'enter', st: 0, ph: 0, cd: 60, atk: 0, turn: 0, vx: 0, vy: 0,
      held: 'boulder', goal: 0, moving: false, calm: 0, onGround: true, onPlat: null, dropT: 0, lastHp: e.hp });
    if (robo) e.inv = true;
  };
}
// touching a bear only pushes you, except its swipe and its charge
const bearContact = e => e.state === 'charge' || (e.state === 'swipe' && e.st <= 8) ? 'hurt' : e.pieces ? 'none' : 'block';
function bearBox(e) {
  const S = e.S;
  if (e.pieces) return { x: e.x, y: -100, w: 0, h: 0 };
  const up = e.state === 'rear' || e.state === 'swipe' || e.state === 'lift' || e.state === 'throw' || e.state === 'roar';
  if (up) return { x: e.x - 16 * S, y: e.y - 54 * S, w: 32 * S, h: 54 * S };
  if (e.state === 'charge') return { x: e.x - 20 * S, y: e.y - 24 * S, w: 40 * S, h: 24 * S }; // head down: jump over it!
  return { x: e.x - 26 * S, y: e.y - 44 * S, w: 52 * S, h: 44 * S };
}

ENEMY_TYPES.bear = {
  hp: 30, armored: true, edge: 40, contact: bearContact,
  make: bearMake(false), update: updBear, draw: drawBear, box: bearBox,
  onKill(e, cx, cy, b) {
    addScore(1000, cx, b.y);
    G.texts.push({ x: cx, y: b.y - 14, s: 'GREAT!', t: 90, c: '#ffe066' });
    bearBurst(e, false);
    return 'dying';
  }
};

ENEMY_TYPES.robobear = {
  hp: 45, boss: true, bossName: 'ROBO BEAR', armored: true, edge: 60, contact: bearContact,
  make: bearMake(true), update: updBear, draw: drawBear, box: bearBox,
  onKill(e, cx, cy, b) {
    e.state = 'dying'; e.st = 0; e.hitT = 0;
    G.eb = G.eb.filter(q => q.k !== 'boulder' && q.k !== 'log');
    addScore(3000, cx, b.y);
    SFX.roar(true);
    return 'dying';
  }
};

// ============================================================
// Projectiles
// ============================================================
// egg-bomb: falls, then sits blinking on the ground for a moment and pops (hurts only up close)
EB_TYPES.egg = {
  r: 4, shootable: true,
  update(b) {
    if (!b.fuse) return;
    b.vx = 0; b.vy = 0; b.g = 0;
    if (++b.fuse % 6 === 0) SFX.beep();
    if (b.fuse >= 26) { b.life = 0; blast(b.x, b.y - 2, 15, 0, 'enemy'); debris(b.x, b.y - 2, 4, METL); }
  },
  onGround(b) {
    if (!b.fuse) { b.fuse = 1; b.r = 0; b.y = groundAt(b.x) - 3.5; Snd.tone('square', 600, 300, 0.06, 0.05); }
    return true;
  },
  onHit(b) { boom(b.x, b.y, 0.5); },
  draw(b) {
    const on = b.fuse ? (b.fuse >> 1) % 2 : (G.t >> 3) % 2;
    sp(EGG[on], b.x, b.y);
    if (b.fuse && on) { ctx.fillStyle = 'rgba(255,60,40,0.35)'; circ(Math.round(b.x), Math.round(b.y), 6 + (b.fuse >> 3)); }
  }
};

EB_TYPES.boulder = {
  r: 7, shootable: true,
  update(b) { b.rot = (b.rot || 0) + 0.2; },
  onGround(b) {
    const gy = groundAt(b.x);
    SFX.crash(); G.shake = Math.max(G.shake, 2.5); dust(b.x, gy, 6);
    rockBits(b.x, gy - 6, 6);
  },
  onHit(b) { rockBits(b.x, b.y, 4); },
  draw(b) { sp(BOULDER[Math.floor(b.rot || 0) % 4], b.x, b.y); }
};
function rockBits(x, y, n) {
  for (let i = 0; i < n; i++) {
    const vx = rand(-2.4, 2.4), vy = rand(-3.6, -1.2), life = rand(40, 70);
    if (i % 2) G.parts.push({ type: 'sprite', s: P_ROCK[i % 4 === 1 ? 0 : 1], x: x + rand(-5, 5), y: y + rand(-4, 2), vx, vy, g: 0.22, rot: 0, vr: rand(-0.3, 0.3), life, max: life });
    else G.parts.push({ type: 'debris', x: x + rand(-5, 5), y: y + rand(-4, 2), vx, vy, g: 0.22, life, max: 70, size: rand(2, 4) | 0, c: i % 3 ? ST : STD });
  }
}

// log: spins through the air, lands with a crash, rolls a little way (jump it or shoot it), then splinters
EB_TYPES.log = {
  r: 6, shootable: true,
  update(b) {
    if (!b.roll) { b.rot = (b.rot || 0) + 0.18; return; }
    b.roll++; b.vy = 0; b.g = 0; b.vx *= 0.992; b.rot += b.vx * 0.25;
    b.y = groundAt(b.x + b.vx) - 4.5;
    if (b.roll % 8 === 0) dust(b.x, b.y + 4, 1, -Math.sign(b.vx));
    if (b.roll > 80 || Math.abs(b.vx) < 0.3) { b.life = 0; splinters(b.x, b.y); Snd.hit(); }
  },
  onGround(b) {
    if (b.roll) return true;
    b.roll = 1; b.vx = Math.sign(b.vx || 1) * 1.5; b.y = groundAt(b.x) - 4.5;
    SFX.crash(); G.shake = Math.max(G.shake, 2); dust(b.x, b.y + 4, 5);
    return true;
  },
  onHit(b) { splinters(b.x, b.y); },
  draw(b) {
    const x = Math.round(b.x), y = Math.round(b.y), f = b.roll ? 0 : ((Math.floor((b.rot || 0) * 2 / Math.PI * 2) % 4) + 4) % 4;
    if (f === 0) {
      RO(x - 11, y - 3, 22, 7, WD); R(x - 11, y - 3, 22, 2, WDL); R(x - 11, y + 2, 22, 2, WDD);
      const k = Math.floor((b.rot || 0) * 2) % 3;
      for (let i = 0; i < 3; i++) R(x - 8 + i * 6 + k, y - 1, 3, 1, WDD);
      RO(x + 9, y - 3, 3, 7, RING); R(x + 10, y - 1, 1, 2, WDD); R(x - 12, y - 2, 1, 5, WDD);
    } else if (f === 2) {
      RO(x - 3, y - 11, 7, 22, WD); R(x - 3, y - 11, 2, 22, WDL); R(x + 2, y - 11, 2, 22, WDD); RO(x - 3, y - 13, 7, 3, RING);
    } else {
      const s = f === 1 ? 1 : -1;
      pl(x - 8, y - 8 * s, x + 8, y + 8 * s, 6, WD, true); pl(x - 8, y - 8 * s, x + 8, y + 8 * s, 6, WD);
      pl(x - 9, y - 8 * s - 1, x + 7, y + 8 * s - 1, 2, WDL);
      pl(x + 8, y + 8 * s, x + 8, y + 8 * s, 5, RING, true); pl(x + 8, y + 8 * s, x + 8, y + 8 * s, 5, RING);
    }
  }
};
function splinters(x, y) {
  for (let i = 0; i < 7; i++) {
    const vx = rand(-2.2, 2.2), vy = rand(-3.4, -1), life = rand(40, 70);
    if (i < 3) G.parts.push({ type: 'sprite', s: P_SPLINTER, x: x + rand(-8, 8), y: y + rand(-3, 3), vx, vy, g: 0.22, rot: rand(0, 3), vr: rand(-0.35, 0.35), life, max: life });
    else G.parts.push({ type: 'debris', x: x + rand(-8, 8), y: y + rand(-3, 3), vx, vy, g: 0.22, life, max: 70, size: rand(2, 4) | 0, c: i % 2 ? WD : WDL });
  }
}
}
