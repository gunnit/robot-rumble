'use strict';
// ============================================================
// MEGA OCTOPUS: Mission 4's final boss, redrawn for the m4polish proposal (painter key `boss`).
// A harness fixture loaded with --extra after the game. It replaces only ENEMY_TYPES.megaoctopus.draw and
// EB_TYPES.oceanArm.draw (the tentacle strike), so it composes with the other painters' scene.js files (the lair
// backdrop is the `deep` painter's). The boss's update(), box (86x87 around e.x, e.y) and attacks are untouched.
//
// Look: a big robot octopus in crimson lacquered steel: a riveted mantle under a gunmetal crown with a glass dome
// holding a grumpy pink robot brain (pilot light on its antenna), two big red camera eyes with steel lids and brows,
// a bubble nozzle, a glass ink sac, a yellow-black hazard collar, two exhaust stacks puffing bubbles, and eight jointed
// tentacles (armour rings on gunmetal joints, cream suction cups) that each wave and curl on their own.
// Tells (state 'tell', 58 frames, by e.cycle):
//   TENTACLE (1): the front arm rises to the target row, lies along it and glows hotter and hotter; the row lights up
//     with marching arrows, and an UP!/DOWN! hint shows over a hero still close to it.
//   BUBBLES (0): the eyes flash and bubbles gather in the nozzle.   INK (2): the ink sac swells, throbs and dribbles.
// Low health (below 42.5%, the update's own faster-rest threshold): cracked dome with a leak, torn panel with sparks,
// hazard-tape patch, one arm snapped to a sparking stub, smoky exhaust, a flickering eye, a nervous twitch.
// Defeat (e.dying, e.timer 0..120): spiral eyes, limp arms, bolts and nuts popping off, a burst of bubbles, BLUB!,
// and a little white flag out of the dome.
// Static parts are painted pixel by pixel into buffers once, on first use (the Pix painter of level3_boss.js); per
// frame only small sprites are blitted (about 300 drawImage calls for the arms) plus a few live pixels (lenses, lids,
// sparks). No Math.random/rand: motion comes from G.t / e.t / e.timer and hsh only.
// The STAGE block at the end pins the mock moments; it acts only when the mission is built at --x 6130/6140/6150.
// ============================================================
{
const L = LEVELS[3], OCTO = ENEMY_TYPES.megaoctopus;
if (L && OCTO && EB_TYPES.oceanArm) {
const TAU = Math.PI * 2, DEG = Math.PI / 180;

// ============================================================
// Palette
// ============================================================
// crimson lacquered armour, shadow to highlight; gunmetal; hazard paint
const A0 = '#1c0612', A1 = '#3a0b1d', A2 = '#631426', A3 = '#932036', A4 = '#c3343d', A5 = '#e85c40', A6 = '#ff9466', A7 = '#ffd0b0';
const ARMOR = [A1, A2, A3, A4, A5, A6];
const G0 = '#0e121e', G1 = '#1d2536', G2 = '#313e56', G3 = '#4b5d7a', G4 = '#7189a8', G5 = '#a6bcd2', G6 = '#e0ecf6';
const STEEL = [G1, G2, G3, G4, G5], JOINT = [G0, G1, G2, G3, G4];
const HY = '#ffc727', HYL = '#ffe783', HYD = '#c88a10', HK = '#1b1520', HKL = '#3a3040';
// camera eyes (red lenses), glass, the brain, suction cups, ink
const E0 = '#2a0207', E1 = '#690610', E2 = '#b0101a', E3 = '#ee2a26', E4 = '#ff6e44', E5 = '#ffbe8a';
const GL0 = '#0a2234', GL1 = '#0f4058', GL2 = '#1f7894', GL3 = '#5cc8e0', GL4 = '#c4f6ff';
const BR0 = '#5e1840', BR1 = '#9a2f66', BR2 = '#d65a90', BR3 = '#ff92b8', BR4 = '#ffd4e4';
const C0 = '#4a1626', C1 = '#a85868', C2 = '#eaa69c', C3 = '#ffe0c8';
const I1 = '#2a1650', I2 = '#472a80', I3 = '#7250b0', I4 = '#b394ea';
const RIM = '#7a5ac8';                      // cool violet bounce light from the abyss on the back edges
const NAVY = '#121a36';                     // the far arms fade toward the water
const HOT = ['#7a1a14', '#c8401a', '#ff7a1c', '#ffae38', '#ffe07a', '#fff8d8'];   // the striking arm glowing
const HOTJ = ['#4a2418', '#9a4a1c', '#e2862e', '#ffc25a', '#ffe7a0'];

// ============================================================
// Pixel buffers (load-time painter, as in level3_boss.js)
// ============================================================
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y) => (BAYER[((Math.floor(y) & 3) << 2) + (Math.floor(x) & 3)] + 0.5) / 16;
const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const RGB = {};
const rgbOf = c => RGB[c] || (RGB[c] = hex(c));
const pk = (r, g, b, a = 255) => (LE ? ((a << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | a)) >>> 0;
const unpk = v => LE ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24] : [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
const PC = {};
function P(c) { if (PC[c] === undefined) { const v = rgbOf(c); PC[c] = pk(v[0], v[1], v[2]); } return PC[c]; }
const OUTP = P(OUT);
const rgba = (c, a) => { const v = rgbOf(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')'; };
// colour maps for sprite copies: the hit-flash white, and the far arms sunk in the water
const WHITE = () => P('#ffffff');
const toward = (c, k) => { const C = rgbOf(c); return v => { const [r, g, b, a] = unpk(v); return pk(Math.round(r + (C[0] - r) * k), Math.round(g + (C[1] - g) * k), Math.round(b + (C[2] - b) * k), a); }; };

class Pix {
  constructor(x0, y0, w, h) { this.x0 = Math.floor(x0); this.y0 = Math.floor(y0); this.w = Math.ceil(w); this.h = Math.ceil(h); this.d = new Uint32Array(this.w * this.h); }
  i(x, y) { x = Math.floor(x) - this.x0; y = Math.floor(y) - this.y0; return x >= 0 && y >= 0 && x < this.w && y < this.h ? y * this.w + x : -1; }
  dot(x, y, c) { const i = this.i(x, y); if (i >= 0) this.d[i] = c; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) this.dot(x + k, y + j, c); }
  get(x, y) { const i = this.i(x, y); return i >= 0 ? this.d[i] : 0; }
  // every pixel whose centre passes f gets col (or col(x, y) -> colour, 0 = leave it)
  shape(f, col) {
    const fn = typeof col === 'function';
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const x = this.x0 + i + 0.5, y = this.y0 + j + 0.5;
      if (!f(x, y)) continue;
      const c = fn ? col(x, y) : col;
      if (c) this.d[j * this.w + i] = c;
    }
  }
  // only where something is painted already
  over(f, col) { this.shape((x, y) => { const v = this.get(x, y); return v !== 0 && v !== OUTP && f(x, y); }, col); }
  line(ax, ay, bx, by, c) {
    const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)));
    for (let k = 0; k <= n; k++) this.dot(Math.round(lerp(ax, bx, n ? k / n : 0)), Math.round(lerp(ay, by, n ? k / n : 0)), c);
  }
  outline(c = OUTP) {
    const q = this.d.slice(), w = this.w, h = this.h;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (q[k]) continue;
      if ((i > 0 && q[k - 1]) || (i < w - 1 && q[k + 1]) || (j > 0 && q[k - w]) || (j < h - 1 && q[k + w])) this.d[k] = c;
    }
  }
  canvas(map) {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const g = c.getContext('2d'), id = g.createImageData(this.w, this.h);
    const d = map ? this.d.map(v => (!v || v === OUTP) ? v : map(v)) : this.d;
    id.data.set(new Uint8ClampedArray(d.buffer.slice(0))); g.putImageData(id, 0, 0);
    return c;
  }
  // a sprite: the image (optionally recoloured), its hit-flash copy, and where it sits
  sprite(map) { return { img: this.canvas(map), white: this.canvas(WHITE), x0: this.x0, y0: this.y0, w: this.w, h: this.h }; }
}
const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
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
// a smooth closed curve through points (Catmull-Rom), as polygon points
function smooth(pts, n = 5) {
  const out = [], m = pts.length;
  for (let i = 0; i < m; i++) {
    const p0 = pts[(i - 1 + m) % m], p1 = pts[i], p2 = pts[(i + 1) % m], p3 = pts[(i + 2) % m];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(d => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  return out;
}
// light from the top left, a little in front
const LD = (() => { const v = [-0.5, -0.72, 0.48], l = Math.hypot(v[0], v[1], v[2]); return v.map(a => a / l); })();
const lam = (nx, ny, nz) => Math.max(0, nx * LD[0] + ny * LD[1] + nz * LD[2]);
// a colour ramp with hard bands, dithered only across a narrow seam between two bands
function band(cols, t, x, y) {
  const v = clamp(t, 0, 1) * (cols.length - 1), i = Math.floor(v), f = v - i;
  const k = f < 0.32 ? 0 : f > 0.68 ? 1 : ((f - 0.32) / 0.36 > dith(x, y) ? 1 : 0);
  return cols[Math.min(cols.length - 1, i + k)];
}

// ============================================================
// Geometry, boss-local: origin at (e.x, e.y), it faces left (toward the hero). Box: x -43..43, y -67..20.
// ============================================================
const MC = [3, -43], MR = [49, 41];          // the mantle's sphere fit, for shading and the panel seams
const MANTLE = poly(smooth([[-38, -9], [-45, -22], [-47, -38], [-43, -55], [-32, -69], [-15, -79], [5, -83], [25, -80], [40, -71], [49, -56], [51, -38], [46, -21], [35, -10], [12, -6], [-16, -6]], 5));
const capY = x => -70 + 6 * (1 - ((x - 4) / 45) ** 2);   // the seam under the gunmetal crown (a smile: seen from a little above)
const DOME = [12, -84], DR = 16;             // the glass dome on the crown
const NE = [-11, -39], FE = [-35, -40];      // eye centres: near (round), far (narrower: the head is turned to the left)
const NER = [8, 8, 12, 12], FER = [5.5, 8, 8.5, 11.5];   // lens rx, ry, housing rx, ry
const NOZ = [-60, -19];                      // the bubble nozzle's mouth
const SAC = [-15, -18];                      // the ink sac (the ink shots leave from about e.x-12, e.y-14)
const colU = x => (x - 2) / 46;              // the hazard collar: a band bowed like a smile
const colT = x => -17 + 5 * (1 - colU(x) ** 2), colB = x => -6 + 5 * (1 - colU(x) ** 2);
const COLLAR = (x, y) => Math.abs(colU(x)) < 0.97 && y >= colT(x) && y < colB(x);
const STACKS = [[34, -62, 54, -84, 3.6], [42, -44, 63, -58, 3.2]];   // exhaust pipes: base, tip, radius
const LAMPS = [[-30, -66], [-12, -71], [34, -69]];   // status lamps on the crown
const HOLE = [22, -29];                      // low health: the torn panel
const TAPE = [33, -52];                     // low health: the hazard-tape patch
// the eight arms (root x, y; base angle a in degrees, 0 = right, 90 = down; curl c in degrees reached toward the tip,
// + = clockwise; n rings; base radius r; wave phase ph; f: in front of the body). Arm 0 is the one that strikes.
const ARMS = [
  { x: -33, y: 0, a: 140, c: 150, n: 16, r: 7.4, ph: 0.0, f: 1 },
  { x: -18, y: 3, a: 115, c: 125, n: 16, r: 7.8, ph: 1.7, f: 1 },
  { x: -2, y: 4, a: 96, c: -140, n: 17, r: 8.0, ph: 3.1, f: 1 },
  { x: 15, y: 3, a: 80, c: 130, n: 16, r: 7.8, ph: 4.4, f: 1 },
  { x: 31, y: 1, a: 42, c: -150, n: 16, r: 7.2, ph: 5.6, f: 1 },
  { x: -25, y: -3, a: 168, c: 165, n: 14, r: 6.2, ph: 2.4, f: 0 },
  { x: 22, y: -2, a: 58, c: -120, n: 15, r: 6.6, ph: 0.9, f: 0 },
  { x: 40, y: -5, a: 14, c: -170, n: 14, r: 6.2, ph: 3.8, f: 0 }
];
const STUB = 3;                              // the arm that is snapped off at low health

// ============================================================
// Painters (run once, on first use)
// ============================================================
function sph(x, y) { const nx = (x - MC[0]) / MR[0], ny = (y - MC[1]) / MR[1], nz = Math.sqrt(Math.max(0.04, 1 - nx * nx - ny * ny)), l = Math.hypot(nx, ny, nz); return [nx / l, ny / l, nz / l]; }
// a pipe (capsule) shaded as a cylinder, with a hazard-striped ring and a dark mouth at the tip
function paintPipe(px, ax, ay, bx, by, rr) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, len = Math.sqrt(L2), nx = -dy / len, ny = dx / len;
  px.shape((x, y) => { const t = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1); return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= rr; }, (x, y) => {
    const t = ((x - ax) * dx + (y - ay) * dy) / L2, s = clamp(((x - ax) * nx + (y - ay) * ny) / rr, -1, 1);
    const l = lam(nx * s, ny * s, Math.sqrt(Math.max(0, 1 - s * s)));
    if (t > 0.62 && t < 0.86) return P((Math.floor(t * len / 2.2 + s * 1.2) & 1) ? band([HK, HKL], l, x, y) : band([HYD, HY, HYL], l + 0.2, x, y));
    return P(band(STEEL, 0.1 + l, x, y));
  });
  px.shape(ell(bx, by, rr * 0.72, rr * 0.72), (x, y) => P(Math.hypot(x - bx, y - by) > rr * 0.45 ? G1 : G0));
}
// a chrome ring around a socket (the eye housings); the socket itself stays dark under the live lens
function paintHousing(px, cx, cy, rxi, ryi, rxo, ryo) {
  px.shape(ell(cx, cy, rxo, ryo), (x, y) => {
    const u = (x - cx) / rxo, v = (y - cy) / ryo, din = ((x - cx) / rxi) ** 2 + ((y - cy) / ryi) ** 2;
    if (din <= 1) return P(E0);
    const d = Math.hypot(u, v), rin = Math.sqrt(1 / din) * d;      // radial position between inner and outer edge
    const q = clamp((d - rin) / Math.max(0.01, 1 - rin), 0, 1), w = q * 2 - 1, ux = u / (d || 1), uy = v / (d || 1);
    if (q < 0.18) return P(G0);
    const l = lam(ux * w, uy * w, Math.sqrt(Math.max(0, 1 - w * w)));
    return P(l > 0.9 ? G6 : band(STEEL, 0.05 + l, x, y));
  });
  for (const a of [-2.4, -0.75, 0.75, 2.4]) {
    const x = Math.round(cx + Math.cos(a) * (rxi + rxo) / 2), y = Math.round(cy + Math.sin(a) * (ryi + ryo) / 2);
    px.dot(x, y, P(G6)); px.dot(x + 1, y + 1, P(G0));
  }
}
// the body: mantle (armour under a gunmetal crown), panel seams and rivets, exhaust stacks, the hazard collar, the dark
// skirt the arms come out of, eye housings, the bubble nozzle. dmg: the low-health version (torn panel, tape, dents).
function paintBody(dmg) {
  const px = new Pix(-62, -100, 134, 110);
  for (const [ax, ay, bx, by, rr] of STACKS) paintPipe(px, ax, ay, bx, by, rr);
  px.shape(ell(2, -1, 40, 7), (x, y) => P(y < -2 ? A1 : A0));                     // the skirt (behind the collar)
  px.shape(MANTLE, (x, y) => {
    const n = sph(x, y), l = lam(n[0], n[1], n[2]);
    const rim = x > MC[0] + 12 && !MANTLE(x + 2.2, y) && l < 0.45;
    if (y < capY(x)) {                                                        // the gunmetal crown
      if (rim) return P(G3);
      return P(l > 0.97 ? G5 : band(STEEL, l * 0.7, x, y));
    }
    if (rim) return P(RIM);
    if (l > 0.94) return P(A7);
    return P(band(ARMOR, 0.04 + l * 1.0, x, y));
  });
  // panel seams: meridians down from the crown (a groove: dark line, its far wall lit), a seam under the crown
  const seamX = (phi, y) => MC[0] + MR[0] * Math.sin(phi) * Math.sqrt(Math.max(0, 1 - ((y - MC[1]) / MR[1]) ** 2));
  const PHI = [-62, -26, 14, 50].map(d => d * DEG);
  const bodyZone = (x, y) => MANTLE(x, y) && y > capY(x) + 1 && y < colT(x) - 1;
  for (const phi of PHI) px.over((x, y) => bodyZone(x, y) && Math.abs(x - seamX(phi, y)) < 0.5, P(A1));
  for (const phi of PHI) px.over((x, y) => bodyZone(x, y) && x - seamX(phi, y) >= 0.5 && x - seamX(phi, y) < 1.5 && px.get(x, y) !== P(A1), (x, y) => P(sph(x, y)[0] < 0.2 ? A5 : A4));
  px.over((x, y) => MANTLE(x, y) && y >= capY(x) && y < capY(x) + 1, P(A0));
  px.over((x, y) => MANTLE(x, y) && y >= capY(x) + 1 && y < capY(x) + 2, (x, y) => P(sph(x, y)[0] < 0.1 ? A6 : A4));
  // rivets: along the crown seam and beside the meridians
  for (let x = -40; x <= 46; x += 6) { const y = Math.round(capY(x)) - 2; if (MANTLE(x + 0.5, y + 0.5) && MANTLE(x + 2, y)) { px.dot(x, y, P(G6)); px.dot(x + 1, y + 1, P(G0)); } }
  for (const phi of PHI) for (let y = -60; y < -14; y += 7) {
    const x = Math.round(seamX(phi, y)) + 3;
    if (bodyZone(x + 0.5, y + 0.5) && bodyZone(x + 2, y + 2) && Math.hypot(x - NE[0], y - NE[1]) > 14 && Math.hypot(x - FE[0], y - FE[1]) > 12 && Math.hypot(x - SAC[0], y - SAC[1]) > 10) { px.dot(x, y, P(A7)); px.dot(x + 1, y + 1, P(A1)); }
  }
  // the crown's plates: seams fanning out from the dome, a rivet at the foot of each
  for (const a of [-2.75, -2.25, -1.8, -1.2, -0.7]) {
    for (let r = 20; r < 46; r += 0.5) { const x = DOME[0] + Math.cos(a) * r, y = DOME[1] + 3 + Math.sin(a) * r * 0.55 + r * 0.35; if (!MANTLE(x, y) || y >= capY(x) - 0.5) break; px.dot(Math.floor(x), Math.floor(y), P(G1)); px.dot(Math.floor(x) + 1, Math.floor(y), P(G4)); }
  }
  // sockets for the three status lamps on the crown (the lamps are live)
  for (const [x, y] of LAMPS) { px.shape(ell(x + 0.5, y + 0.5, 2.6, 2.2), (qx, qy) => P(qy < y ? G4 : G1)); px.dot(x, y, P(G0)); px.dot(x + 1, y, P(G0)); }
  // vents on the crown's back: three slots with a lit lower lip
  for (let i = 0; i < 3; i++) { const x0 = 22 + i * 6, y0 = -74 + i * 2; px.line(x0, y0, x0 + 3, y0 + 3, P(G0)); px.line(x0 + 1, y0, x0 + 4, y0 + 3, P(G0)); px.line(x0 + 2, y0 - 1, x0 + 5, y0 + 2, P(G4)); }
  // the hazard collar: a steel lip, slanted yellow-black stripes lit from the left and the top
  px.shape(COLLAR, (x, y) => {
    const t = colT(x), b = colB(x), d = y - t, u = colU(x);
    if (d < 1) return P(u < 0.1 ? G6 : u < 0.6 ? G5 : G4);
    if (d < 2) return P(G2);
    if (b - y <= 1) return P(G1);
    const sh = clamp(0.95 - u * 0.5 - (d / (b - t)) * 0.45, 0, 1);
    return P((Math.floor((x + d * 1.3) / 4.5) & 1) ? band([HK, HKL], sh * 0.8, x, y) : band([HYD, HY, HYL], sh, x, y));
  });
  for (let x = -38; x < 46; x += 9) { const y = Math.ceil(colT(x)); px.dot(x, y, P(G6)); px.dot(x + 1, y, P(G1)); }
  // eye housings, then the nozzle under the far eye
  paintHousing(px, NE[0], NE[1], NER[0] + 0.5, NER[1] + 0.5, NER[2], NER[3]);
  paintHousing(px, FE[0], FE[1], FER[0] + 0.5, FER[1] + 0.5, FER[2], FER[3]);
  // the bubble nozzle: a short steel trumpet with a hazard ring, its mouth toward the hero
  const NOZZLE = poly([[-60, -28], [-55, -25], [-48, -23.5], [-40, -23], [-37, -21], [-37, -16], [-40, -14], [-48, -13.5], [-55, -13], [-60, -10]]);
  px.shape(NOZZLE, (x, y) => {
    const s = clamp((y + 18.5) / 9, -1, 1), l = lam(0, s, Math.sqrt(1 - s * s));
    if (x > -52 && x < -48) return P((Math.floor((y + x * 0.3) / 2.5) & 1) ? band([HK, HKL], l, x, y) : band([HYD, HY, HYL], l + 0.15, x, y));
    return P(l > 0.9 ? G6 : band(STEEL, 0.15 + l, x, y));
  });
  px.shape(ell(NOZ[0] + 0.5, NOZ[1] + 0.5, 2.4, 8.4), (x, y) => P(x < NOZ[0] - 0.6 ? (y < NOZ[1] ? G6 : G4) : y < NOZ[1] - 4 ? G1 : G0));
  if (dmg) {
    // a torn panel: lit torn edge, dark cavity, two wires (the sparks are live)
    const [hx, hy] = HOLE, f = (x, y) => ((x - hx) / 7.5) ** 2 + ((y - hy) / 6.5) ** 2 + (hsh(Math.floor(x) * 3.1 + Math.floor(y) * 7.7) - 0.5) * 0.5 <= 1;
    px.shape(f, (x, y) => !f(x - 1, y - 1) ? P(A6) : !f(x + 1, y + 1) ? P(A2) : P(y < hy - 2 ? '#0a0610' : '#170a14'));
    px.line(hx - 6, hy + 1, hx - 1, hy - 2, P('#3fd0ff')); px.line(hx - 1, hy - 2, hx + 2, hy + 2, P('#3fd0ff'));
    px.line(hx - 5, hy + 3, hx + 1, hy + 1, P(HY)); px.line(hx + 1, hy + 1, hx + 5, hy - 2, P(HY));
    px.dot(hx + 2, hy + 2, P('#ffffff'));
    // a hazard-tape X over a dent on the front of the mantle
    const [tx, ty] = TAPE;
    for (const s of [1, -1]) px.shape((x, y) => { const u = (x - tx) * 0.8 + (y - ty) * 0.6 * s, v = -(x - tx) * 0.6 * s + (y - ty) * 0.8; return Math.abs(u) < 10 && Math.abs(v) < 2.4; }, (x, y) => {
      const u = (x - tx) * 0.8 + (y - ty) * 0.6 * s, v = -(x - tx) * 0.6 * s + (y - ty) * 0.8;
      if (v < -1.2) return P(HYL);
      return P((Math.floor(u / 2.4) & 1) ? HK : HY);
    });
    // dents and scratches
    for (const [x, y, w] of [[-30, -28, 4], [8, -62, 5], [35, -24, 3], [-4, -50, 3]]) { px.line(x, y, x + w, y - 1, P(A1)); px.line(x, y + 1, x + w, y, P(A6)); }
    for (const [x, y] of [[16, -30], [-20, -24]]) { px.dot(x, y, P(A0)); px.dot(x + 1, y, P(A1)); px.dot(x, y + 1, P(A1)); }
  }
  px.outline();
  return px;
}
// the glass dome on the crown: dark liquid, the pink brain (its face is live), wires, bubbles, glass glints, the steel
// base ring and the antenna mast (its pilot light is live). cracked: the low-health version.
function paintDome(cracked) {
  const [dx, dy] = DOME, r = DR;
  const px = new Pix(dx - r - 6, dy - r - 10, r * 2 + 13, r + 19);
  const glass = (x, y) => Math.hypot(x - dx, y - dy) <= r && y < dy + 3;
  px.shape(glass, (x, y) => P(band([GL0, GL1, GL1], 1 - (y - (dy - r)) / (r + 3), x, y)));
  // the brain: two lobes, a centre fissure, folds, lit from the top left
  const bx = dx, by = dy - 1, BRN = (x, y) => ((x - bx) / 11) ** 2 + ((y - by) / 8) ** 2 <= 1 + 0.12 * Math.sin(Math.atan2(y - by, x - bx) * 7);
  px.shape(BRN, (x, y) => {
    const u = (x - bx) / 11, v = (y - by) / 8, n = [u * 0.8, v * 0.8, Math.sqrt(Math.max(0, 1 - 0.64 * (u * u + v * v)))], l = lam(n[0], n[1], n[2]);
    if (Math.abs(x - bx) < 0.6 && y < by + 2) return P(BR0);
    if (Math.abs(Math.sin((x - bx) * 1.15 + Math.sin((y - by) * 0.95) * 1.9)) < 0.2) return P(l > 0.7 ? BR2 : BR1);
    return P(l > 0.9 ? BR4 : band([BR1, BR2, BR3], l, x, y));
  });
  px.rect(bx - 2, by + 6, 4, 3, P(G3)); px.rect(bx - 2, by + 6, 4, 1, P(G5));     // the brain's plug
  px.line(bx - 3, by + 8, bx - 8, by + 10, P(HY)); px.line(bx + 2, by + 8, bx + 7, by + 10, P('#3fd0ff'));
  for (const [x, y] of [[dx - 9, dy - 4], [dx + 9, dy - 7], [dx + 7, dy + 1]]) { px.dot(x, y, P(GL3)); px.dot(x + 1, y - 1, P(GL4)); }
  // the glass wall: a lit rim on the left, a long highlight arc, a glint
  px.over((x, y) => glass(x, y) && Math.hypot(x - dx, y - dy) > r - 1.2, (x, y) => P(x < dx - 2 ? GL3 : GL2));
  px.over((x, y) => { const d = Math.hypot(x - dx, y - dy), a = Math.atan2(y - dy, x - dx); return glass(x, y) && d > r - 4 && d < r - 2.4 && a > -2.75 && a < -1.75; }, P(GL4));
  px.dot(dx - 6, dy - 9, P('#ffffff')); px.dot(dx - 5, dy - 10, P('#ffffff')); px.dot(dx + 7, dy - 9, P(GL3));
  if (cracked) {
    // a star crack from a hit on the right, one chip knocked out
    const ix = dx + 6, iy = dy - 6;
    for (let k = 0; k < 5; k++) {
      let x = ix, y = iy, a = -2.6 + k * 1.25 + (hsh(k * 3.3) - 0.5) * 0.6;
      for (let s = 0; s < 4; s++) {
        const nx = x + Math.cos(a) * (2 + hsh(k * 7 + s) * 2.5), ny = y + Math.sin(a) * (2 + hsh(k * 5 + s) * 2.5);
        px.over((qx, qy) => glass(qx, qy) && Math.abs((qx - x) * (ny - y) - (qy - y) * (nx - x)) / Math.max(0.01, Math.hypot(nx - x, ny - y)) < 0.55 && (qx - x) * (nx - x) + (qy - y) * (ny - y) >= -0.3 && (qx - nx) * (x - nx) + (qy - ny) * (y - ny) >= -0.3, P(GL4));
        x = nx; y = ny; a += (hsh(k * 11 + s) - 0.5) * 0.9;
      }
    }
    px.over((x, y) => Math.hypot(x - ix, y - iy) < 1.6, P(GL0)); px.dot(ix, iy, P('#ffffff'));
  }
  // the base ring (rivets on its front) and the antenna mast on the top
  px.shape(ell(dx, dy + 3, r + 3, 3.4), (x, y) => P(y < dy + 1.6 ? G5 : y < dy + 3.6 ? G3 : G2));
  for (let x = dx - r; x <= dx + r; x += 5) { px.dot(x, dy + 4, P(G6)); px.dot(x + 1, dy + 5, P(G0)); }
  px.shape(ell(dx, dy - r + 0.5, 3, 1.6), (x, y) => P(y < dy - r ? G5 : G3));
  px.line(dx, dy - r - 2, dx, dy - r - 7, P(G4));
  px.outline();
  return px;
}
// the ink sac at swell level s (0..3): a glass bulb of swirling ink, a steel cap, a valve at the lower left
function paintSac(s) {
  const rx = 5.8 + s * 1.9, ry = 5.4 + s * 1.7, cx = SAC[0] - s * 0.6, cy = SAC[1] + s * 0.8;
  const px = new Pix(cx - rx - 7, cy - ry - 4, rx * 2 + 10, ry * 2 + 8);
  px.shape(poly([[cx - rx - 5, cy + 1], [cx - rx + 2, cy - 1], [cx - rx + 3, cy + 3.5], [cx - rx - 5, cy + 4]]), (x, y) => P(x < cx - rx - 3.5 ? G1 : y < cy + 1.6 ? G5 : G3));
  const f = ell(cx, cy, rx, ry);
  px.shape(f, (x, y) => {
    const u = (x - cx) / rx, v = (y - cy) / ry, d = u * u + v * v;
    if (d > 0.74) return P(u + v < -0.4 ? GL3 : GL2);
    const l = lam(u * 0.7, v * 0.7, Math.sqrt(Math.max(0, 1 - 0.49 * d)));
    const sw = Math.sin(Math.atan2(v, u) * 2 + Math.sqrt(d) * 7 + s * 1.3);
    return P(sw > 0.75 && d < 0.55 ? I4 : band([I1, I2, I3], l * 0.95 + (sw > 0.3 ? 0.18 : 0), x, y));
  });
  px.over((x, y) => { const u = (x - cx) / rx, v = (y - cy) / ry, d = Math.hypot(u, v), a = Math.atan2(v, u); return f(x, y) && d > 0.5 && d < 0.68 && a > -2.7 && a < -1.6; }, P(GL4));
  px.dot(Math.round(cx - rx * 0.4), Math.round(cy - ry * 0.55), P('#ffffff'));
  if (s === 3) for (const a of [-0.4, 0.5, 1.4]) { const x = Math.round(cx + Math.cos(a) * rx * 0.86), y = Math.round(cy + Math.sin(a) * ry * 0.86); px.dot(x, y, P(GL4)); }
  px.shape((x, y) => Math.abs(x - cx) < 3.6 && y > cy - ry - 2 && y < cy - ry + 1.4, (x, y) => P(y < cy - ry - 0.6 ? G5 : G3));
  px.outline();
  return px.sprite();
}
// an arm ring / joint: a shaded ball (rings in lacquer with a highlight, joints in gunmetal)
function paintDisc(r, cols, spec) {
  const R0 = Math.ceil(r) + 1, px = new Pix(-R0, -R0, R0 * 2 + 1, R0 * 2 + 1);
  px.shape((x, y) => Math.hypot(x - 0.5, y - 0.5) <= r, (x, y) => {
    const nx = (x - 0.5) / r, ny = (y - 0.5) / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), l = lam(nx, ny, nz);
    if (spec && l > 0.95 && r > 2.6) return P(spec);
    if (r > 3.4 && Math.hypot(x - 0.5, y - 0.5) > r - 1 && nx + ny > 0.3) return P(cols[0]);   // a dark lower rim: the ring's edge
    return P(band(cols, 0.04 + l, x, y));
  });
  px.outline();
  return px;
}
// a suction cup seen from the side: a pale rim around a dark centre
function paintCup(rx, ry) {
  const px = new Pix(-Math.ceil(rx) - 1, -Math.ceil(ry) - 1, Math.ceil(rx) * 2 + 3, Math.ceil(ry) * 2 + 3);
  px.shape(ell(0.5, 0.5, rx, ry), (x, y) => { const d = ((x - 0.5) / rx) ** 2 + ((y - 0.5) / ry) ** 2; return P(rx > 2 && d < 0.2 ? C0 : rx > 2 && d < 0.45 ? C1 : y < 0.6 && x < 1.2 ? C3 : C2); });
  px.outline(P(A1));
  return px;
}
// a bubble: a pale ring, a faint inside, a glint
function paintBubble(r) {
  const R0 = r + 1, px = new Pix(-R0, -R0, R0 * 2 + 1, R0 * 2 + 1);
  px.shape((x, y) => Math.hypot(x - 0.5, y - 0.5) <= r + 0.35, (x, y) => Math.hypot(x - 0.5, y - 0.5) > r - 0.65 ? P('#a8ecf6') : pk(170, 236, 250, 46));
  if (r > 1) px.dot(-Math.round(r * 0.45), -Math.round(r * 0.45), P('#ffffff'));
  return px.sprite();
}
// the striking arm's claw (facing left; origin = where it grips): two hooked jaws, an armour cuff, a hot lens between
function paintClaw(open) {
  const K = 1.35, px = new Pix(-20, -16, 42, 33), sh = (f, col) => px.shape((x, y) => f(x / K, y / K), (x, y) => col(x / K, y / K));
  const jaw = (sgn, a) => { const pts = [[7, -7], [0, -9.5], [-6, -8.5], [-11, -5], [-13, -1], [-9.5, -2], [-6, -4.5], [0, -4], [7, -2]].map(([x, y]) => { const yy = y * sgn, c = Math.cos(a * sgn), s = Math.sin(a * sgn); return [7 + (x - 7) * c - (yy) * s, (x - 7) * s + yy * c]; }); return poly(pts); };
  const a = open ? 0.3 : 0.04;
  for (const sgn of [1, -1]) {
    const f = jaw(sgn, a);
    sh(f, (x, y) => { if (!f(x - 0.8, y - 0.9)) return P(G6); if (!f(x + 0.8, y + 0.9)) return P(G1); return P(Math.abs(x + 6) < 0.45 ? G1 : sgn > 0 ? G4 : G3); });
  }
  sh(ell(1, 0, 3.4, 3.4), (x, y) => { const d = Math.hypot(x - 1, y); return P(d < 1.3 ? '#ffffff' : d < 2.3 ? HOT[4] : HOT[3]); });
  sh(ell(10, 0, 5, 8), (x, y) => { const l = lam((x - 10) / 5 * 0.8, y / 8, 0.6); return P(Math.abs(x - 10) < 0.8 ? HY : Math.abs(x - 10) < 1.5 ? HK : band(ARMOR, 0.1 + l, x, y)); });
  px.outline();
  return px.sprite();
}
// loose bits for the defeat: a hex nut, a bolt, a rivet, a red armour scale, a spring
function paintBits() {
  const out = [], mk = (r, f, col) => { const px = new Pix(-r, -r, r * 2 + 1, r * 2 + 1); px.shape(f, col); px.outline(); out.push(px.sprite()); };
  const hex6 = poly([[-5, -2.6], [0, -5.6], [5, -2.6], [5, 2.6], [0, 5.6], [-5, 2.6]]);
  mk(7, (x, y) => hex6(x, y) && Math.hypot(x, y) > 1.9, (x, y) => P(!hex6(x - 1, y - 1) ? G6 : y < -1 ? G5 : y < 2 ? G4 : G3));
  mk(7, (x, y) => (Math.abs(x) < 4 && y > -6 && y < -2.5) || (Math.abs(x) < 1.6 && y >= -2.5 && y < 6), (x, y) => P(y < -4.8 ? G6 : y < -2.5 ? G4 : (Math.floor(y) & 1) ? G3 : G5));
  mk(5, (x, y) => Math.hypot(x, y) < 3.3, (x, y) => P(x + y < -1 ? A7 : x + y < 2 ? A5 : A3));
  const pl = poly([[-7, -4], [6, -5.5], [7, 4], [-6, 5]]);
  mk(9, pl, (x, y) => P(!pl(x - 1, y - 1) ? A6 : !pl(x + 1, y + 1) ? A2 : Math.hypot(x, y) < 1.2 ? A7 : A4));
  mk(8, (x, y) => Math.abs(y) < 6.5 && Math.abs(x - Math.sin(y * 1.3) * 3) < 1.2, (x, y) => P(Math.cos(y * 1.3) > 0 ? G5 : G3));
  return out;
}

let ART = null;
function art() {
  if (ART) return ART;
  const A = { body: [paintBody(false).sprite(), paintBody(true).sprite()], dome: [paintDome(false).sprite(), paintDome(true).sprite()],
    sac: [0, 1, 2, 3].map(paintSac), claw: [paintClaw(false), paintClaw(true)], bits: paintBits(), bub: [1, 2, 3, 4].map(paintBubble),
    ring: [], ringB: [], ringH: [], ringW: [], joint: [], jointB: [], jointH: [], jointW: [], cup: [], cupB: [] };
  const back = toward(NAVY, 0.45);
  for (let i = 0; i <= 14; i++) {
    const r = 1.5 + i * 0.5, ring = paintDisc(r, ARMOR, A7), joint = paintDisc(r, JOINT, G5);
    A.ring.push(ring.sprite()); A.ringB.push(ring.sprite(back)); A.joint.push(joint.sprite()); A.jointB.push(joint.sprite(back));
    A.ringW.push({ img: A.ring[i].white, x0: A.ring[i].x0, y0: A.ring[i].y0 }); A.jointW.push({ img: A.joint[i].white, x0: A.joint[i].x0, y0: A.joint[i].y0 });
    A.ringH.push(paintDisc(r, HOT, '#ffffff').sprite()); A.jointH.push(paintDisc(r, HOTJ, null).sprite());
  }
  for (const [rx, ry] of [[1.6, 1.2], [2.2, 1.6], [2.8, 2.1]]) { const c = paintCup(rx, ry); A.cup.push(c.sprite()); A.cupB.push(c.sprite(back)); }
  A.chev = [paintChevron(1, HYL), paintChevron(1, '#ffd0a0'), paintChevron(-1, HYL), paintChevron(-1, '#ffd0a0')];
  A.strip = [paintStrip(HY), paintStrip('#ff6a3a')];
  A.F = { ring: A.ring, joint: A.joint, cup: A.cup }; A.B = { ring: A.ringB, joint: A.jointB, cup: A.cupB };
  A.H = { ring: A.ringH, joint: A.jointH }; A.W = { ring: A.ringW, joint: A.jointW };
  return (ART = A);
}

// ============================================================
// Live drawing helpers
// ============================================================
let GA = 1;                                   // the boss's own alpha (it fades out at the very end of the defeat)
function blit(s, x, y) { ctx.drawImage(s.img, Math.round(x) + s.x0, Math.round(y) + s.y0); }
function part(s, x, y, white) { blit(s, x, y); if (white) { ctx.globalAlpha = 0.55 * GA; ctx.drawImage(s.white, Math.round(x) + s.x0, Math.round(y) + s.y0); ctx.globalAlpha = GA; } }
function dsc(set, x, y, r) { const s = set[clamp(Math.round(r * 2) - 3, 0, set.length - 1)]; ctx.drawImage(s.img, Math.round(x) + s.x0, Math.round(y) + s.y0); }
// crisp pixel ellipse, crisp pixel disc
function pell(cx, cy, rx, ry, col) {
  ctx.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy); const n = Math.max(1, Math.round(ry));
  for (let j = -n; j <= n; j++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j / (ry + 0.5)) ** 2))); ctx.fillRect(cx - w, cy + j, w * 2 + 1, 1); }
}
// a soft round glow: one radial-gradient sprite per colour, baked on first use, then only scaled blits
const GLOWS = {};
function glowImg(col) {
  if (GLOWS[col]) return GLOWS[col];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), v = rgbOf(col), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(' + v + ',1)'); gr.addColorStop(0.45, 'rgba(' + v + ',0.42)'); gr.addColorStop(1, 'rgba(' + v + ',0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (GLOWS[col] = c);
}
function glow(x, y, r, col, a) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * clamp(a, 0, 1); ctx.drawImage(glowImg(col), Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2)); ctx.globalAlpha = ga; }
function lit(fn) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; fn(); ctx.restore(); }
// a pixel bar with an outline (the steel brows)
function bar(x1, y1, x2, y2, col, hi) {
  const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  ctx.fillStyle = OUT; for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(lerp(x1, x2, i / n)) - 1, Math.round(lerp(y1, y2, i / n)) - 2, 3, 5);
  ctx.fillStyle = col; for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(lerp(x1, x2, i / n)), Math.round(lerp(y1, y2, i / n)) - 1, 1, 3);
  ctx.fillStyle = hi; for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(lerp(x1, x2, i / n)), Math.round(lerp(y1, y2, i / n)) - 1, 1, 1);
}
// a spark burst: a white core and yellow arms (sz 1..3)
function spark(x, y, sz) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = HY; ctx.fillRect(x - sz, y, sz * 2 + 1, 1); ctx.fillRect(x, y - sz, 1, sz * 2 + 1);
  if (sz > 1) { ctx.fillStyle = HYL; ctx.fillRect(x - 1, y - 1, 3, 3); }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
}

// ============================================================
// The eyes: a red camera lens (iris, pupil looking at the hero, glints) under a steel lid with a slanted edge,
// optionally a lower lid (squint). mode: 'n' normal, 'f' flash (the bubble tell), 'd' dim (flicker), 's' spiral (KO)
// ============================================================
function lens(cx, cy, rx, ry, lx, ly, mode, rot) {
  if (mode === 's') {
    pell(cx, cy, rx, ry, E1); pell(cx, cy, rx - 1, ry - 1, E0);
    ctx.fillStyle = E5;
    for (let a = 0; a < TAU * 2.2; a += 0.3) { const k = a / (TAU * 2.2); ctx.fillRect(Math.round(cx + Math.cos(a + rot) * rx * k), Math.round(cy + Math.sin(a + rot) * ry * k), 1, 1); }
    return;
  }
  const f = mode === 'f', d = mode === 'd';
  pell(cx, cy, rx, ry, d ? E0 : f ? E3 : E1);
  pell(cx, cy, rx - 1, ry - 1, d ? E1 : f ? E4 : E2);
  pell(cx + lx, cy + ly, rx * 0.62, ry * 0.62, d ? E1 : f ? E5 : E3);
  pell(cx + lx * 1.25, cy + ly * 1.25, Math.max(1, rx * 0.3), Math.max(1, ry * 0.3), f ? '#ffffff' : E0);
  if (!f && !d) { ctx.fillStyle = E4; ctx.fillRect(Math.round(cx + lx * 1.25), Math.round(cy + ly * 1.25), 1, 1); }
  // aperture blades: two dark ticks on the iris ring
  ctx.fillStyle = d ? E0 : E1; ctx.fillRect(Math.round(cx + lx + rx * 0.45), Math.round(cy + ly - 1), 1, 2); ctx.fillRect(Math.round(cx + lx - 1), Math.round(cy + ly + ry * 0.45), 2, 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(cx - rx * 0.5), Math.round(cy - ry * 0.55), 2, 2); ctx.fillRect(Math.round(cx - rx * 0.5) + 2, Math.round(cy - ry * 0.55) - 1, 1, 1);
  ctx.fillStyle = E5; ctx.fillRect(Math.round(cx + rx * 0.4), Math.round(cy + ry * 0.45), 1, 1);
}
// lids: top lid down to `top` (0 open .. 1 shut) with its edge slanted by `sl` px per px, bottom lid up by `bot`
function lids(cx, cy, rx, ry, top, sl, bot) {
  cx = Math.round(cx); cy = Math.round(cy);
  const ix = Math.ceil(rx);
  for (let x = -ix; x <= ix; x++) {
    const h = ry * Math.sqrt(Math.max(0, 1 - (x / (rx + 0.5)) ** 2));
    if (h < 0.5) continue;
    const y0 = Math.round(cy - h), y1 = Math.round(cy + h);
    if (top > 0.02) {
      const e = Math.min(y1 + 1, Math.round(cy - ry + top * (2 * ry + 1) + sl * x));
      if (e > y0) { ctx.fillStyle = G3; ctx.fillRect(cx + x, y0, 1, e - y0); ctx.fillStyle = G5; ctx.fillRect(cx + x, Math.max(y0, e - 2), 1, 1); ctx.fillStyle = OUT; ctx.fillRect(cx + x, e - 1, 1, 1); }
    }
    if (bot > 0.02) {
      const s = Math.max(y0, Math.round(cy + ry - bot * (2 * ry + 1)));
      if (s < y1 + 1) { ctx.fillStyle = G2; ctx.fillRect(cx + x, s, 1, y1 + 1 - s); ctx.fillStyle = OUT; ctx.fillRect(cx + x, s, 1, 1); }
    }
  }
}

// ============================================================
// The arms. A pose is a chain of rings (centre, radius, heading). The rings overlap like armour plates (drawn from the
// tip up to the root, each covers the next one out), every third one a gunmetal collar; suction cups peek out along
// the inside of the curl. The striking arm reuses the same pieces.
// ============================================================
const PTS = Array.from({ length: 40 }, () => ({ x: 0, y: 0, r: 0, a: 0 }));
const rad = (A, i, nt) => lerp(A.r, 1.6, Math.pow(i / (nt - 1), 0.9));
const step = r => Math.max(1.8, r * 1.12);
// the arm's own pose: a base angle, a curl that grows toward the tip, a wave running down it
function armPts(A, bx, by, o) {
  let ang = o.a * DEG, x = bx + A.x, y = by + A.y;
  for (let i = 0; i < o.n; i++) {
    const q = i / (o.nt - 1), r = rad(A, i, o.nt), p = PTS[i];
    p.x = x; p.y = y; p.r = r; p.a = ang;
    ang += (o.c * Math.pow(q, 1.6) * 2.6 / o.nt + o.amp * Math.sin(o.tt * 0.05 - i * 0.55 + A.ph) * (3 + 8 * q)) * DEG;
    const ds = step(r); x += Math.cos(ang) * ds; y += Math.sin(ang) * ds;
  }
  return o.n;
}
// the raised pose (tentacle tell): from the root down or up to the row, along the row toward the hero, the tip coiled
// up like a cocked whip; blended over the arm's own pose by k, trembling once it is up
const BZ = Array.from({ length: 17 }, () => [0, 0, 0]);
function raise(A, bx, by, n, row, dir, k) {
  // a cubic out from under the skirt, clear of the face, up (or down) to the row; then straight along it
  const x0 = bx + A.x, y0 = by + A.y, x1 = x0 + dir * 50, c1x = x0 + dir * 26, c1y = y0 + 10, c2x = x0 + dir * 30, c2y = row;
  let L1 = 0, lx = x0, ly = y0;
  for (let j = 0; j <= 16; j++) {
    const t = j / 16, u = 1 - t, x = u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1, y = u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * row;
    L1 += Math.hypot(x - lx, y - ly); BZ[j][0] = x; BZ[j][1] = y; BZ[j][2] = L1; lx = x; ly = y;
  }
  let total = 0; for (let i = 0; i < n - 1; i++) total += step(PTS[i].r);
  const L2 = Math.max(8, total - L1 - 38), rho = 7, side = -dir, h0 = dir < 0 ? Math.PI : 0, sx = x1 + dir * L2;
  const tr = ss(0.6, 1, k) * 0.9;
  for (let i = 0, s = 0; i < n; i++) {
    let x, y;
    if (s <= L1) { let j = 1; while (j < 16 && BZ[j][2] < s) j++; const a = BZ[j - 1], b = BZ[j], f = clamp((s - a[2]) / Math.max(0.001, b[2] - a[2]), 0, 1); x = lerp(a[0], b[0], f); y = lerp(a[1], b[1], f); }
    else if (s <= L1 + L2) { x = x1 + dir * (s - L1); y = row; }
    else { const th = side * Math.min(5.4, (s - L1 - L2) / rho); x = sx + rho * side * (Math.sin(h0 + th) - Math.sin(h0)); y = row - rho * side * (Math.cos(h0 + th) - Math.cos(h0)); }
    const p = PTS[i];
    p.x = lerp(p.x, x, k); p.y = lerp(p.y, y, k) + Math.sin(G.t * 0.9 + i * 1.3) * tr;
    s += step(p.r);
  }
  for (let i = 0; i < n - 1; i++) PTS[i].a = Math.atan2(PTS[i + 1].y - PTS[i].y, PTS[i + 1].x - PTS[i].x);
  if (n > 1) PTS[n - 1].a = PTS[n - 2].a;
}
function drawChain(pts, n, S, i0 = 0) { for (let i = n - 1; i >= i0; i--) { const p = pts[i], j = i % 3 === 2; dsc(j ? S.joint : S.ring, p.x, p.y, j ? p.r * 0.86 : p.r); } }
function drawCups(pts, n, side, set, i0 = 1) {
  for (let i = i0 + ((i0 + 1) & 1); i < n - 1; i += 2) {
    const p = pts[i];
    if (p.r < 2.4) break;
    const sx = side > 0 ? -Math.sin(p.a) : Math.sin(p.a), sy = side > 0 ? Math.cos(p.a) : -Math.cos(p.a);
    const s = set[p.r > 5.6 ? 2 : p.r > 3.6 ? 1 : 0];
    ctx.drawImage(s.img, Math.round(p.x + sx * p.r * 0.84) + s.x0, Math.round(p.y + sy * p.r * 0.84) + s.y0);
  }
}
// one arm of the boss; st: the frame's state; i0: rings to leave out at the root. Returns the tip point.
function drawArm(e, i, ox, oy, st, i0 = 0) {
  const Ar = art(), A = ARMS[i];
  const pulse = Math.cos(e.t * 0.018);       // + while it sinks: arms spread out; - while it rises: they trail together
  const o = { a: A.a + (A.a - 90) * 0.2 * pulse + Math.sin(G.t * 0.021 + A.ph) * 5, c: A.c, amp: 1, n: A.n, nt: A.n, tt: G.t + A.ph * 40 };
  let hot = 0, rk = 0;
  if (st.dying) {
    // limp: the arms sag straight down and only sway in the water
    const k = ss(0, 40, st.dt);
    o.a = lerp(o.a, 90 + (A.a - 90) * 0.28, k); o.c = lerp(A.c, A.c * 0.1, k); o.amp = lerp(1, 0.3, k); o.tt = G.t * lerp(1, 0.35, k) + A.ph * 40;
  } else if (i === st.armI && st.tell === 'arm') {
    rk = ss(0, 0.5, st.k); o.n = o.nt = A.n + Math.round(12 * rk); o.amp = 1 - rk * 0.8;
    hot = ss(0.15, 0.9, st.k) * (st.k > 0.75 && G.t % 6 < 3 ? 0.62 : 0.42);
  }
  if (st.low && i === STUB) o.n = Math.round(A.n * 0.42);
  const n = armPts(A, ox, oy, o);
  if (rk > 0) raise(A, ox, oy, n, st.row, st.dir, rk);
  const S = A.f ? Ar.F : Ar.B, side = rk > 0.5 ? -st.dir : Math.sign(A.c) || 1;
  drawChain(PTS, n, S, i0);
  drawCups(PTS, n, side, S.cup, Math.max(1, i0));
  if (hot > 0) { ctx.globalAlpha = hot * GA; drawChain(PTS, n, Ar.H, i0); ctx.globalAlpha = GA; lit(() => { for (let j = 3; j < n; j += 4) glow(PTS[j].x, PTS[j].y, 8 + PTS[j].r, '#ff7a20', 0.25 * hot); }); }
  if (st.white) { ctx.globalAlpha = 0.5 * GA; drawChain(PTS, n, Ar.W, i0); ctx.globalAlpha = GA; }
  return PTS[n - 1];
}

// ============================================================
// Tells and words
// ============================================================
// the row's pieces: an arrow head (pointing dir, two colours) and a hazard-striped edge strip (yellow, or red when late)
function paintChevron(dir, col) { const px = new Pix(-7, -7, 15, 15); for (let j = 0; j < 6; j++) { px.rect(dir * j, -j, 2, 1, P(col)); px.rect(dir * j, j, 2, 1, P(col)); } px.outline(); return px.sprite(); }
function paintStrip(col) { const px = new Pix(0, 0, 656, 2); for (let x = 0; x < 656; x++) { const y = (x >> 2) & 1, c = rgbOf(y ? col : HK); px.rect(x, 0, 1, 2, pk(c[0], c[1], c[2], y ? 255 : 180)); } return px.canvas(); }
// the row the arm will sweep: a warm glowing band with hazard-striped edges, arrows running away from the boss
function drawRow(e, k) {
  const dir = e.targetX > e.x ? 1 : -1, y = Math.round(e.targetY), ex = Math.round(e.x);
  const xa = dir < 0 ? Math.round(G.cam.x) - 2 : ex + 44, xb = dir < 0 ? ex - 40 : Math.round(G.cam.x) + W + 2;
  const late = k > 0.72, on = !late || G.t % 6 < 3, w = xb - xa;
  lit(() => {
    ctx.fillStyle = rgba(late && on ? '#7a2810' : '#5a3410', 0.35 + 0.45 * k); ctx.fillRect(xa, y - 10, w, 21);
    ctx.fillStyle = rgba(late && on ? '#a04a20' : '#6a4a18', 0.3 + 0.5 * k); ctx.fillRect(xa, y - 2, w, 5);
  });
  // hazard stripes along both edges, marching away from the boss; arrows running the same way
  const Ar = art(), m = Math.floor(G.t * 0.5) % 8, strip = Ar.strip[late && on ? 1 : 0], sw = Math.min(w, 640), so = dir < 0 ? m : 7 - m;
  ctx.globalAlpha = 0.4 + 0.6 * k;
  ctx.drawImage(strip, so, 0, sw, 2, xa, y - 12, sw, 2); ctx.drawImage(strip, so, 0, sw, 2, xa, y + 11, sw, 2);
  ctx.globalAlpha = 0.45 + 0.55 * k;
  const c = (G.t * 1.5) % 34, ch = Ar.chev[(dir < 0 ? 0 : 2) + (late && on ? 1 : 0)];
  for (let x = dir < 0 ? xb - 18 - c : xa + 18 + c; dir < 0 ? x > xa + 4 : x < xb - 4; x += dir * 34) blit(ch, Math.round(x), y);
  ctx.globalAlpha = 1;
}
// over a hero still near the row: which way out
function drawDodge(e, k) {
  const p = G.p;
  if (!p || p.dead || k < 0.12) return;
  const top = p.y - 26, bot = p.y - 2, row = e.targetY;
  if (bot < row - 26 || top > row + 26) return;
  const up = (top + bot) / 2 < row ? row > 92 : row > 212;
  if (G.t % 16 < 4 && k < 0.7) return;
  const x = Math.round(p.x), c = k > 0.72 && G.t % 6 < 3 ? '#ffffff' : '#ffe066';
  // UP! with its arrow over the hero's head, DOWN! under the hero's fins
  const ty = up ? Math.round(top) - 16 : Math.round(bot) + 6, ay = up ? ty - 6 : ty + 9;
  text(up ? 'UP!' : 'DOWN!', x, ty, c, 1, 'center');
  for (const [o, cc] of [[1, OUT], [0, c]]) for (let j = 0; j < 4; j++) {
    ctx.fillStyle = cc;
    if (up) ctx.fillRect(x - j + o, ay + j + o, j * 2 + 1, 1); else ctx.fillRect(x - 3 + j + o, ay + j + o, 7 - j * 2, 1);
  }
}
const WORDS = { arm: ['TENTACLE!', '#ffd36a'], bub: ['BUBBLES!', '#9ff6ff'], ink: ['INK!', '#d6b8ff'] };
function drawWord(e, tell, k) {
  const w = WORDS[tell];
  const x = clamp(Math.round(e.x) - 62, G.cam.x + 60, G.cam.x + W - 60), y = Math.max(58, Math.round(e.y) - 96);
  const pop = k < 0.12 ? Math.round((0.12 - k) * 40) : 0, j = k > 0.72 ? (G.t % 4 < 2 ? 1 : -1) : 0;
  text(w[0], x + j, y - pop, w[1], 2, 'center', '#1a0820');
}

// ============================================================
// The boss
// ============================================================
const BITS = Array.from({ length: 12 }, (_, i) => ({ x: -36 + hsh(i * 3.7) * 80, y: -74 + hsh(i * 5.3) * 70, vx: (hsh(i * 9.1) - 0.5) * 3.2, vy: -1.2 - hsh(i * 2.9) * 1.8, t0: 2 + i * 3, s: i % 5, f: hsh(i * 1.3) > 0.5 }));
function drawOcto(e) {
  const Ar = art();
  const dying = !!(e.dying || e.state === 'dying'), dt = dying ? e.timer : 0;
  const low = !dying && e.hp < e.max * 0.425;
  const tell = !dying && e.state === 'tell' ? (e.cycle === 1 ? 'arm' : e.cycle === 2 ? 'ink' : 'bub') : null;
  const k = tell ? clamp(1 - e.timer / 58, 0, 1) : 0;
  const strikeOut = !dying && G.eb.some(b => b.k === 'oceanArm');
  const jit = low && G.t % 47 < 3 ? (G.t & 1 ? 1 : -1) : dying && dt < 30 ? (dt & 2 ? 1 : -1) : 0;
  const ox = Math.round(e.x) + jit, oy = Math.round(e.y);
  const dir = e.targetX > e.x ? 1 : -1, armI = dir < 0 ? 0 : 4;
  const st = { dying, dt, low, tell, k, row: e.targetY, dir, armI, white: e.hitT > 0 && !dying };
  if (tell === 'arm') drawRow(e, k);
  GA = dying && dt > 84 ? clamp(1 - (dt - 84) / 36, 0, 1) : 1;
  ctx.save(); ctx.globalAlpha = GA;
  // the arms come out from under the skirt: far ones, then near ones (the striking arm is drawn by the strike while
  // it is out, and over the face while it is raised)
  const raised = tell === 'arm';
  let stubTip = null;
  for (const i of [5, 6, 7, 4, 0, 1, 2, 3]) {
    if ((strikeOut || raised) && i === (strikeOut ? strikeArm() : armI)) continue;
    const tip = drawArm(e, i, ox, oy, st);
    if (i === STUB && low) stubTip = { x: tip.x, y: tip.y };
  }
  part(Ar.body[low ? 1 : 0], ox, oy, st.white);
  part(Ar.dome[low ? 1 : 0], ox, oy, st.white);
  // exhaust: bubbles out of both stacks (smoky puffs when damaged)
  for (let s = 0; s < 2; s++) {
    const tx = ox + STACKS[s][2], ty = oy + STACKS[s][3];
    for (let i = 0; i < 5; i++) {
      const ph = (G.t * (0.0105 + s * 0.002) + hsh(i * 3.7 + s * 11)) % 1, x = tx + 2 + ph * 9 + Math.sin(G.t * 0.07 + i * 2) * 1.5, y = ty - 3 - ph * 44;
      if (low && i % 2 === 0) { const r = 2 + Math.floor(ph * 4); pell(x, y, r, r, rgba('#2a2436', 0.75 * (1 - ph))); pell(x - 1, y - 1, Math.max(1, r - 2), Math.max(1, r - 2), rgba('#4a4258', 0.7 * (1 - ph))); }
      else blit(Ar.bub[Math.min(3, Math.floor(ph * 4))], x, y);
    }
  }
  // the ink sac: swells and throbs before the ink, ink dribbles out of the valve
  const sl = tell === 'ink' ? Math.min(3, Math.floor(k * 3.6)) - (k > 0.83 && G.t % 8 < 4 ? 1 : 0) : 0;
  part(Ar.sac[Math.max(0, sl)], ox, oy, st.white);
  if (tell === 'ink') for (let i = 0; i < 4; i++) {
    const ph = (G.t * 0.03 + i * 0.25) % 1, x = ox + SAC[0] - 13 - sl - ph * 10, y = oy + SAC[1] + 3 - ph * 8 + Math.sin(G.t * 0.1 + i) * 1.5;
    pell(x, y, 1 + ph * 2.5 * k, 1 + ph * 2.5 * k, rgba(I2, 0.85 * (1 - ph))); pell(x - 1, y - 1, Math.max(1, ph * 1.5), Math.max(1, ph * 1.5), rgba(I3, 0.8 * (1 - ph)));
  }
  // eyes: look at the hero; lids by mood
  const p = G.p, lx = p ? clamp((p.x - (e.x + NE[0])) / 90, -1, 1) : -1, ly = p ? clamp((p.y - 14 - (e.y + NE[1])) / 70, -1, 1) : 0;
  let top = 0.2, slope = 0.3, bot = 0, brow = 1, raise = 0, mode = 'n';
  const bt = e.t % 173;
  if ((e.state === 'idle' || e.state === 'intro') && bt < 7) top = bt >= 2 && bt <= 4 ? 1 : 0.6;   // a blink now and then
  if (tell === 'bub') { top = 0; slope = 0; brow = 0.2; raise = 2 + Math.round(k * 2); mode = k > 0.2 && (G.t % 8 < 4 || k > 0.8) ? 'f' : 'n'; }
  if (tell === 'arm') { top = 0.3; bot = 0.22; slope = 0.42; brow = 1.4; }
  if (tell === 'ink') { top = 0.28; bot = 0.12 + k * 0.18; slope = 0.35; brow = 1.1; }
  if (dying) { top = 0.32; slope = -0.25; bot = 0; brow = -1; raise = 1; mode = 's'; }
  const farMode = mode === 'n' && low && G.t % 70 < 9 && G.t % 3 ? 'd' : mode;
  const rot = G.t * 0.25;
  lens(ox + FE[0], oy + FE[1], FER[0], FER[1], lx * 1.4, ly * 1.6, farMode, -rot);
  lens(ox + NE[0], oy + NE[1], NER[0], NER[1], lx * 2.2, ly * 2, mode, rot);
  lids(ox + FE[0], oy + FE[1], FER[0], FER[1], low && !dying ? Math.max(top, 0.42) : top, -slope, bot);
  lids(ox + NE[0], oy + NE[1], NER[0], NER[1], top, slope, bot);
  if (mode === 'f') lit(() => { const a = k > 0.8 ? 0.55 : 0.35; glow(ox + NE[0], oy + NE[1], 16 + k * 8, '#ff5030', a); glow(ox + FE[0], oy + FE[1], 12 + k * 6, '#ff5030', a); });
  // brows: steel bars, angry (brow > 0) sloping down toward the middle of the face, worried (< 0) the other way
  bar(ox + NE[0] - 11, oy + NE[1] - 14 + Math.round(brow * 3) - raise, ox + NE[0] + 10, oy + NE[1] - 15 - Math.round(brow * 2) - raise, G3, G5);
  bar(ox + FE[0] - 8, oy + FE[1] - 14 - Math.round(brow * 2) - raise, ox + FE[0] + 6, oy + FE[1] - 13 + Math.round(brow * 3) - raise, G3, G5);
  // the brain's face in the dome: angry little eyes (dizzy when beaten), zaps while it plans an attack
  const bx = ox + DOME[0], by = oy + DOME[1];
  if (dying) { ctx.fillStyle = BR0; for (const dx of [-4, 3]) { ctx.fillRect(bx + dx, by - 2, 1, 1); ctx.fillRect(bx + dx + 2, by - 2, 1, 1); ctx.fillRect(bx + dx + 1, by - 1, 1, 1); ctx.fillRect(bx + dx, by, 1, 1); ctx.fillRect(bx + dx + 2, by, 1, 1); } }
  else {
    for (const dx of [-4, 3]) { ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + dx, by - 1, 2, 2); ctx.fillStyle = E0; ctx.fillRect(bx + dx + (lx < 0 ? 0 : 1), by, 1, 1); }
    ctx.fillStyle = BR0; ctx.fillRect(bx - 5, by - 3, 2, 1); ctx.fillRect(bx - 3, by - 2, 1, 1); ctx.fillRect(bx + 4, by - 3, 2, 1); ctx.fillRect(bx + 3, by - 2, 1, 1);
    if (tell && G.t % 10 < 5) { ctx.fillStyle = HYL; const zx = bx + (G.t % 20 < 10 ? -9 : 7); ctx.fillRect(zx, by - 7, 1, 2); ctx.fillRect(zx + 1, by - 5, 1, 2); ctx.fillRect(zx, by - 3, 1, 2); }
  }
  // status lamps on the crown: amber, chasing; red and stuttering when damaged; out when beaten
  if (!dying) for (let i = 0; i < LAMPS.length; i++) {
    const on = low ? (G.t + i * 7) % 19 < 6 : tell ? G.t % 8 < 4 : Math.floor(G.t / 16) % 3 === i;
    const x = ox + LAMPS[i][0], y = oy + LAMPS[i][1], c = low ? '#ff3b30' : '#ffb030';
    ctx.fillStyle = on ? c : '#4a2a10'; ctx.fillRect(x, y, 2, 1);
    if (on) { ctx.fillStyle = '#fff0c0'; ctx.fillRect(x, y, 1, 1); lit(() => glow(x + 1, y, 6, c, 0.5)); }
  }
  // the pilot light on the antenna
  const pl = dying ? false : tell ? G.t % 8 < 4 : G.t % 50 < 25;
  if (!dying || dt <= 14) { ctx.fillStyle = OUT; ctx.fillRect(bx - 2, by - DR - 10, 5, 4); ctx.fillStyle = pl ? '#ff3b30' : '#5a1010'; ctx.fillRect(bx - 1, by - DR - 9, 3, 2); }
  if (pl) { ctx.fillStyle = '#ffd0c0'; ctx.fillRect(bx - 1, by - DR - 9, 1, 1); lit(() => glow(bx, by - DR - 8, 9, '#ff3020', 0.4)); }
  // the bubble tell: bubbles gather in the nozzle and its mouth glows
  if (tell === 'bub') {
    const nx = ox + NOZ[0], ny = oy + NOZ[1];
    lit(() => glow(nx - 2, ny, 8 + k * 10, '#7ff0ff', 0.25 + k * 0.35));
    for (let i = 0; i < 6; i++) { const a = G.t * 0.15 + i * TAU / 6, rr = 2 + (1 - k) * 6; blit(Ar.bub[i % 2], nx - 4 + Math.cos(a) * rr, ny + Math.sin(a) * rr * 0.8); }
    blit(Ar.bub[Math.min(3, Math.floor(k * 4))], nx - 4, ny);
  }
  // low health: sparks from the torn panel and the snapped arm, a leak out of the cracked dome
  if (low) {
    const hx = ox + HOLE[0], hy = oy + HOLE[1];
    lit(() => glow(hx, hy, 9, '#3fd0ff', 0.25 + 0.1 * Math.sin(G.t * 0.3)));
    const f1 = (G.t + 5) % 23, f2 = (G.t + 13) % 31;
    if (f1 < 6) { spark(hx - 2 + (f1 >> 1), hy - 2, 3 - (f1 >> 1)); ctx.fillStyle = HYL; ctx.fillRect(hx + 2 + f1 * 2, hy - 4 - f1, 1, 1); ctx.fillRect(hx - 3 - f1, hy - 3 - f1 * 1.5, 1, 1); }
    if (stubTip) {
      // the snapped arm: a torn socket at its end, two wires dangling and swaying, sparks
      const sx = Math.round(stubTip.x), sy = Math.round(stubTip.y) + 3;
      pell(sx, sy, 4, 2, OUT); pell(sx, sy, 3, 1, '#170a14'); ctx.fillStyle = A6; ctx.fillRect(sx - 3, sy - 2, 2, 1); ctx.fillRect(sx + 1, sy - 2, 1, 1); ctx.fillRect(sx + 3, sy - 1, 1, 1);
      for (const [dx, col, ln, ph] of [[-1, '#3fd0ff', 8, 0], [1, HY, 6, 2]]) for (let j = 0; j < ln; j++) { ctx.fillStyle = col; ctx.fillRect(sx + dx + Math.round(Math.sin(G.t * 0.08 + ph + j * 0.35) * j * 0.3), sy + 1 + j, 1, 1); }
      if (f2 < 9) { spark(sx + (f2 & 1) - 1, sy + 4, f2 < 3 ? 3 : f2 < 6 ? 2 : 1); lit(() => glow(sx, sy + 4, 10, '#7fe8ff', 0.4)); ctx.fillStyle = HYL; ctx.fillRect(sx - 2 - f2, sy + 3 + f2, 1, 1); ctx.fillRect(sx + 2 + f2, sy + 2 + (f2 >> 1), 1, 1); }
    }
    for (let i = 0; i < 3; i++) { const ph = (G.t * 0.016 + i / 3) % 1; blit(Ar.bub[ph > 0.6 ? 1 : 0], bx + 7 + Math.sin(G.t * 0.09 + i) * 1.5, by - 7 - ph * 30); }
  }
  // the raised arm, over the face
  if (raised) drawArm(e, armI, ox, oy, st, 2);
  // defeat: bubbles bursting out, bolts popping off, the white flag
  if (dying) {
    for (let i = 0; i < 16; i++) {
      const t0 = i * 4, t = dt - t0; if (t < 0) continue;
      const x = ox - 40 + hsh(i * 2.3) * 90 + Math.sin(t * 0.12 + i) * 3, y = oy - 20 - hsh(i * 4.1) * 50 - t * (0.6 + hsh(i) * 0.5);
      if (y > oy - 140) blit(Ar.bub[i % 4], x, y);
    }
    for (const b of BITS) {
      const t = dt - b.t0; if (t < 0) continue;
      const tau = 22 * (1 - Math.exp(-t / 22)), x = ox + b.x + b.vx * tau, y = oy + b.y + b.vy * tau + 0.008 * t * t;
      const s = Ar.bits[b.s];
      ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if ((Math.floor(t / 6) + (b.f ? 1 : 0)) % 2) ctx.scale(-1, 1); ctx.drawImage(s.img, s.x0, s.y0); ctx.restore();
      if (t < 8) spark(ox + b.x, oy + b.y, t < 4 ? 2 : 1);
    }
    if (dt > 14) drawFlag(bx, by - DR - 5, ss(14, 40, dt));
  }
  ctx.restore();
  GA = 1;
  if (tell) { drawWord(e, tell, k); if (tell === 'arm') drawDodge(e, k); }
  if (dying && dt > 6 && dt < 70) text('BLUB BLUB!', Math.round(e.x) - 50, Math.round(e.y) - 70 - Math.round(dt * 0.3), '#c8f8ff', 1, 'center', '#0a1a30');
}
// the white flag: a pole rising out of the dome's mast, a little cloth waving
function drawFlag(x, y, k) {
  const h = Math.round(3 + 13 * k), top = y - h;
  ctx.fillStyle = OUT; ctx.fillRect(x - 1, top - 3, 3, h + 3);
  ctx.fillStyle = G5; ctx.fillRect(x, top - 2, 1, h + 2);
  ctx.fillStyle = HY; ctx.fillRect(x - 1, top - 4, 3, 2);
  if (k < 0.3) return;
  for (let c = 0; c < 14; c++) {
    const dy = Math.round(Math.sin(G.t * 0.22 - c * 0.55) * 1.6 * (c / 13)), cx = x + 1 + c;
    ctx.fillStyle = OUT; ctx.fillRect(cx, top - 1 + dy, 1, 11);
    ctx.fillStyle = c % 5 === 4 ? '#c8d4de' : '#ffffff'; ctx.fillRect(cx, top + dy, 1, 9);
  }
  ctx.fillStyle = OUT; ctx.fillRect(x + 15, top - 1 + Math.round(Math.sin(G.t * 0.22 - 14 * 0.55) * 1.6), 1, 11);
}

// ============================================================
// The tentacle strike (EB oceanArm: tip at b.x on row b.y, sliding 2.2 px/frame): a long jointed arm from the boss's
// front root down to the row and along it, a travelling wave in it, cups underneath, a snapping claw with a hot lens,
// speed streaks and a wake of bubbles behind the claw.
// ============================================================
const CURVE = Array.from({ length: 41 }, () => [0, 0, 0]);
const SPTS = Array.from({ length: 200 }, () => ({ x: 0, y: 0, r: 0, a: 0 }));
function along(s) {
  let i = 1; while (i < 40 && CURVE[i][2] < s) i++;
  const a = CURVE[i - 1], b = CURVE[i], f = clamp((s - a[2]) / Math.max(0.001, b[2] - a[2]), 0, 1);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0])];
}
function strikeArm() { const b = G.eb.find(q => q.k === 'oceanArm'); return b && b.vx > 0 ? 4 : 0; }
function drawStrike(b) {
  const Ar = art(), e = G.enemies.find(m => m.type === 'megaoctopus' && !m.dead && !m.dying);
  const dir = b.vx < 0 ? -1 : 1, A = dir < 0 ? ARMS[0] : ARMS[4];
  const x0 = e ? Math.round(e.x) + A.x : b.anchor, y0 = e ? Math.round(e.y) + A.y : b.y + 5;
  const x2 = b.x - dir * 9, y2 = b.y, cx = x0 + dir * 26, cy = y2;
  let Lc = 0, lx = x0, ly = y0;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, u = 1 - t, x = u * u * x0 + 2 * u * t * cx + t * t * x2, y = u * u * y0 + 2 * u * t * cy + t * t * y2;
    Lc += Math.hypot(x - lx, y - ly); CURVE[i][0] = x; CURVE[i][1] = y; CURVE[i][2] = Lc; lx = x; ly = y;
  }
  let n = 0;
  for (let s = 0; s < Lc && n < SPTS.length; n++) {
    const r = lerp(7.4, 4.6, ss(0, 1, s / Lc)), [x, y, a] = along(s), w = Math.sin(s * 0.09 - G.t * 0.32) * 2.4 * ss(0, 30, s) * ss(0, 24, Lc - s);
    const p = SPTS[n]; p.x = x - Math.sin(a) * w; p.y = y + Math.cos(a) * w; p.r = r; p.a = a;
    s += step(r);
  }
  for (let i = 0; i < n - 1; i++) SPTS[i].a = Math.atan2(SPTS[i + 1].y - SPTS[i].y, SPTS[i + 1].x - SPTS[i].x);
  // cups along the underside (the side facing down), then the plated arm from the claw back to the root (the first
  // rings stay hidden under the boss's skirt)
  drawChain(SPTS, n, Ar.F, 2);
  drawCups(SPTS, n, dir < 0 ? -1 : 1, Ar.cup, 2);
  // the last rings glow hot toward the claw
  for (let i = n - 1, m = 0; i >= 2 && m < 3; i--, m++) { ctx.globalAlpha = 0.8 - m * 0.25; dsc(Ar.ringH, SPTS[i].x, SPTS[i].y, SPTS[i].r); }
  ctx.globalAlpha = 1;
  // speed streaks and a wake of bubbles behind the claw
  ctx.fillStyle = 'rgba(220,250,255,0.55)';
  for (const [dy, l, o] of [[-13, 16, 4], [-9, 10, 18], [10, 12, 8], [14, 18, 0]]) ctx.fillRect(Math.round(b.x - dir * (o + 10 + ((G.t * 3) % 6))) - (dir > 0 ? l : 0), Math.round(b.y + dy), l, 1);
  for (let i = 0; i < 6; i++) { const ph = (G.t * 0.025 + i / 6) % 1; blit(Ar.bub[i % 3 === 0 ? 1 : 0], b.x - dir * (16 + i * 13), b.y + (hsh(i * 3.1) - 0.5) * 16 - ph * 12); }
  lit(() => { glow(b.x, b.y, 22, '#ff8a20', 0.35); glow(b.x, b.y, 9, '#ffe07a', 0.4); });
  const cl = Ar.claw[Math.floor(G.t / 7) % 2];
  ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); if (dir > 0) ctx.scale(-1, 1); ctx.drawImage(cl.img, cl.x0, cl.y0); ctx.restore();
}

OCTO.draw = drawOcto;
EB_TYPES.oceanArm.draw = drawStrike;

// ============================================================
// STAGE: the mock screenshots only. Built at --x 6130 (the tentacle tell), 6140 (low health, the strike sweeping and
// the ink sac swelling) or 6150 (the defeat); any other start leaves the fight alone.
//   6130: the boss raises its arm along the row y 112 while the diver ducks under it (DOWN!), firing bubbles.
//   6140: 20% health; the strike sweeps along y 204 under the diver; the ink sac is swelling for the next attack.
//   6150: beaten 50 frames ago: limp arms, bolts flying, the white flag.
//   6160: (a check frame) the bubble tell: flashing eyes, bubbles gathering in the nozzle.
// ============================================================
const STAGES = { 6130: 'tell', 6140: 'low', 6150: 'ko', 6160: 'bub' };
let stage, koAt = 0;
const prevLoad = L.load, prevUpdate = L.update;
L.load = function (cp) { stage = undefined; return prevLoad.apply(this, arguments); };
L.update = function () {
  // read the build x before any other painter's staging moves the hero
  if (stage === undefined) stage = G.cam.x >= 5919 && G.p ? STAGES[Math.round(G.p.x)] || null : null;
  prevUpdate.apply(this, arguments);
  if (!stage) return;
  const cam = G.cam.x, p = G.p, e = G.enemies.find(m => m.type === 'megaoctopus');
  G.big = null; G.banner = null; G.warnT = 0; G.time = Math.max(G.time, 600); G.score = Math.max(G.score, stage === 'ko' ? 98750 : 88750);
  p.facing = 1; p.vx = 0; p.vy = 0;
  keys.KeyX = stage !== 'ko';
  if (stage === 'tell' || stage === 'bub') { p.x = cam + 168; p.y = 160; }
  if (stage === 'low') { p.x = cam + 196; p.y = 170; }
  if (stage === 'ko') { p.x = cam + 200; p.y = 176; }
  if (!e) return;
  if (stage === 'ko') {
    if (!e.dying) { e.x = cam + W - 85; e.y = 172; e.state = 'idle'; e.timer = 80; if (e.t >= 130) { damageEnemy(e, e.hp); koAt = G.t; } else { e.hp = 30; e.hitT = 0; } }
    else { e.state = 'dying'; e.timer = G.t - koAt; e.x = cam + W - 85; e.y = 172 - e.timer * 0.14; }   // hold the death clock even if another fixture pins the boss
    return;
  }
  e.x = cam + W - 85; e.hitT = 0; e.max = 200; e.state = 'tell'; e.targetX = p.x;
  if (stage === 'tell') { e.y = 158; e.cycle = 1; e.timer = 14; e.targetY = 112; e.hp = 150; }
  if (stage === 'bub') { e.y = 158; e.cycle = 0; e.timer = 10; e.targetY = 140; e.hp = 110; }
  if (stage === 'low') {
    e.y = 150; e.cycle = 2; e.timer = 17; e.targetY = 150; e.hp = 40;
    let b = G.eb.find(q => q.k === 'oceanArm');
    if (!b) { b = { k: 'oceanArm', x: 0, y: 0, vx: -2.2, vy: 0, anchor: e.x - 20, life: 170, r: 10, shoot: false }; G.eb.push(b); }
    b.x = cam + 104; b.y = 204; b.vx = -2.2; b.life = 100;
  }
};
}
}
