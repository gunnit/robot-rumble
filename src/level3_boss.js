'use strict';
// ============================================================
// MEGA WHALE SHARK: Mission 3's final boss (ENEMY_TYPES.megawhale), a gigantic goofy robot whale shark in the
// crater's lava lake (x 5944-6200), and its projectiles (EB_TYPES mwrock, mwdrop, mwfx).
// It is built from parts painted once at load (head, jaw at 8 gapes, two body segments, dorsal fins, pectoral fin,
// tail fin, cheek bulges, the intake fan, lava frames, a breach pose turned at two angles) and posed every frame,
// so it can swim, gape, chew, bulge its cheeks, dive, breach and sink. Dark blue-grey armour, the white spots and stripes as glowing lamps and pale panel seams, amber
// camera-lens eyes that follow the hero, gill louvres, lava pouring off its back.
// Attacks (one at a time, each with a pose, a sound and a warning first):
//   VACUUM (SLUUURP!): the mouth gapes, the throat glows white and the fan spins up (~1 s), then it pulls the hero
//     toward the mouth (~0.8 px/frame, 1.1 in phase 2: walking away beats it). Caught: CHOMP, chew, PTOO! spat back
//     onto the ledge with one hit. The open throat is the weak spot (double damage); a grenade sucked in: BURP!
//   ROCK SPIT (PTOO!): mouth shut, cheeks bulge, a red ring + ! blinks where each of 3 lava rocks will land (~1.3 s).
//   DIVE AND BREACH: it sinks until only the fin shows; bubbles and a growing glow mark where it bursts out near the
//     ledge (~1 s); the splash throws lava drops onto marked spots.
//   Phase 2 (below 50%): armour plates pop off, stronger vacuum, GILL STEAM: the vents redden (~0.9 s), then steam
//     jets fly across at standing height (DUCK!).
//   ROAR: now and then it calls 2 bees or 2 lava sharks.
//   Death: a rock jams its fan, its lights go out one by one, it sinks with a huge burp of bolts, then bossDefeated
//     (onKill returns 'dying' and sets G.winT = 360 like the other final bosses).
// Kid-friendly extras: RUN! over the hero during the pull (from 20 frames into the warning near the ledge's edge), a
// 20-frame teeter at the lip before a catch (stepping back gets out), the PTOO hit lands with the hero on the ledge,
// DUCK! before the steam, and a hero who lands in its lake is gulped and spat back onto the ledge ("NO SWIMMING!", no
// extra hit: the lava already hurt). After a continue it comes back with the health it had, at most 75% (L3.whaleHp).
// Only being caught (PTOO!), the rocks, the drops, the steam band and the breaching body hurt; touching it never does.
// Drawing never calls Math.random()/rand(): hsh(n) and G.t only. Everything is private to this block except the
// registry entries.
// ============================================================
{
// ============================================================
// Palette
// ============================================================
// armour (dark blue-grey), pale steel (lips, jaw, belly), lamps (the spots), amber eyes, the lava's warm light
const S0 = '#0d1220', S1 = '#162036', S2 = '#21304d', S3 = '#2f4568', S4 = '#46628c', S5 = '#6f8db8', S6 = '#a6c0e0';
const V0 = '#3e4656', V1 = '#5c687c', V2 = '#8592a6', V3 = '#b1bdcb', V4 = '#dce4ec';
const LAMP = '#f4fbff', LAMPH = '#bfe6ff', LAMPD = '#3a4a66';
const AMB = '#ffcf3a', AMBL = '#fff2a8', AMBD = '#c98a10', PUP = '#2a1400';
const WARM = '#dc6e2a';
// lava: crust to white-hot; basalt
const L0 = '#3d0b06', L1 = '#701708', L2 = '#b02b0b', L3C = '#e44f10', L4 = '#ff8519', L5 = '#ffb534', L6 = '#ffe063', L7 = '#fff7cc';
const K1 = '#120e13', K2 = '#1c151b', K3 = '#2a1e24', K4 = '#3d2a2b', K5 = '#5e3328', K6 = '#93452a', K7 = '#cf6a31';
// the machinery under the armour plates (phase 2): dark cavities, copper, a hot glow
const M0 = '#140a0c', M1 = '#2c1a1c', CU1 = '#6b3a1e', CU2 = '#a55a2a', CU3 = '#e09048';
const STEAM = '#dfe7ee', STEAMD = '#9fb0c0';

// ============================================================
// Helpers: easing, packed colours, pixel buffers, inside-test shapes (load time only)
// ============================================================
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const sstep = t => t * t * (3 - 2 * t);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y) => (BAYER[((y & 3) << 2) + (x & 3)] + 0.5) / 16;
const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const RGB = {};
const rgbOf = c => RGB[c] || (RGB[c] = hex(c));
const pk = (r, g, b, a = 255) => (LE ? ((a << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | a)) >>> 0;
const unpk = v => LE ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24] : [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
const PC = {};
function P(c) { if (PC[c] === undefined) { const v = rgbOf(c); PC[c] = pk(v[0], v[1], v[2]); } return PC[c]; }
const OUTP = P(OUT);
const flat = (cols, t) => P(cols[clamp(Math.round(t * (cols.length - 1)), 0, cols.length - 1)]);

// a pixel buffer at (x0, y0) in design coordinates
class Pix {
  constructor(x0, y0, w, h) { this.x0 = Math.floor(x0); this.y0 = Math.floor(y0); this.w = Math.ceil(w); this.h = Math.ceil(h); this.d = new Uint32Array(this.w * this.h); }
  i(x, y) { x = Math.floor(x) - this.x0; y = Math.floor(y) - this.y0; return x >= 0 && y >= 0 && x < this.w && y < this.h ? y * this.w + x : -1; }
  dot(x, y, c) { const i = this.i(x, y); if (i >= 0) this.d[i] = c; }
  get(x, y) { const i = this.i(x, y); return i >= 0 ? this.d[i] : 0; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) this.dot(x + k, y + j, c); }
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
  over(f, col) { this.shape((x, y) => this.get(x, y) !== 0 && this.get(x, y) !== OUTP && f(x, y), col); }
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
  // warm light from the lava below: painted pixels between y0 and y1 lean toward col (dithered)
  warm(y0, y1, col, amt, skip) {
    const C = rgbOf(col);
    for (let j = 0; j < this.h; j++) {
      const y = j + this.y0, k = ss(y0, y1, y) * amt;
      if (k <= 0) continue;
      for (let i = 0; i < this.w; i++) {
        const v = this.d[j * this.w + i];
        if (!v || v === OUTP || (skip && skip(i + this.x0 + 0.5, y + 0.5))) continue;
        const [r, g, b, a] = unpk(v), m = k * (0.75 + dith(i, j) * 0.5);
        this.d[j * this.w + i] = pk(Math.round(r + (C[0] - r) * m), Math.round(g + (C[1] - g) * m), Math.round(b + (C[2] - b) * m), a);
      }
    }
  }
  canvas(mode) {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const g = c.getContext('2d'), id = g.createImageData(this.w, this.h);
    let d = this.d;
    if (mode === 'white') { const W1 = P('#ffffff'); d = this.d.map(v => !v ? 0 : v === OUTP ? v : W1); }
    else if (mode === 'dark') d = this.d.map(v => { if (!v || v === OUTP) return v; const [r, g2, b, a] = unpk(v); return pk(r * 0.32 + 8 | 0, g2 * 0.3 + 9 | 0, b * 0.34 + 14 | 0, a); });
    id.data.set(new Uint8ClampedArray(d.buffer.slice(0))); g.putImageData(id, 0, 0);
    return c;
  }
  // a sprite: the image, its hit-flash copy, where it sits, and for every row the painted x extent (the waterline)
  sprite(extra) {
    const rows = [];
    for (let j = 0; j < this.h; j++) {
      let a = -1, b = -1;
      for (let i = 0; i < this.w; i++) if (this.d[j * this.w + i]) { if (a < 0) a = i; b = i; }
      rows.push(a < 0 ? null : [a + this.x0, b + this.x0 + 1]);
    }
    return Object.assign({ img: this.canvas(), white: this.canvas('white'), x0: this.x0, y0: this.y0, w: this.w, h: this.h, rows }, extra || {});
  }
}
const rot = (x, y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [cx + dx * c + dy * s, cy - dx * s + dy * c]; };
const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const both = (a, b) => (x, y) => a(x, y) && b(x, y);
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
// a crisp pixel disc on the live canvas
function disc(x, y, r, col) {
  ctx.fillStyle = col; x = Math.round(x); y = Math.round(y);
  for (let j = -r; j <= r; j++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - j * j))); ctx.fillRect(x - w, y + j, w * 2 + 1, 1); }
}
function glow(x, y, r, col, a) {
  const v = rgbOf(col), g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(' + v + ',' + a + ')'); g.addColorStop(1, 'rgba(' + v + ',0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
const rgba = (c, a) => { const v = rgbOf(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')'; };

// ============================================================
// Geometry (design coordinates = screen coordinates while the camera is locked in the arena at x 5720).
// The anchor (AX, AY) is where e.x, e.y sit. The whale faces left, its head turned a little toward the viewer, so
// its wide mouth (far corner F, near corner N) faces the hero on the ledge (x 0-220, feet at y 222).
// ============================================================
const LY = 238;                            // the lake's lava surface
const AX = 330, AY = 238;                  // anchor
const FX = 237, FY = 194, NX = 296, NY = 205;
const mk = x => clamp((x - FX) / (NX - FX), 0, 1);
// the upper lip (fixed on the head): nearly straight, a hair of an arch; the lower lip sags with the gape k (0..1)
const lipUp = x => FY + (NY - FY) * mk(x) - 2 * Math.sin(Math.PI * mk(x));
const GAPE = 40;
const sag = (x, k) => k * GAPE * Math.pow(Math.sin(Math.PI * Math.pow(mk(x), 0.85)), 0.75);
const lipLo = (x, k) => lipUp(x) + 1 + sag(x, k);
const cheekX = y => NX + 1 + Math.max(0, y - NY) * 0.32;   // behind this the cheek covers the jaw's hinge
const JAWN = 8;                            // jaw frames (gape 0..1)
const THROAT = [272, 214];                 // the throat (fan) at full gape
const EYE = [303, 189];
// the hull outline (head + body seen from the side, a little from the front): the snout, the broad flat head top,
// the back with its hump, down into the lava
const HULL = poly(smooth([
  [237, 197], [233, 190], [232, 182], [235, 173], [242, 165], [253, 159], [269, 154], [290, 150], [316, 147], [342, 143],
  [368, 139], [392, 140], [414, 146], [432, 158], [445, 176], [453, 200], [457, 228], [459, 262],
  [400, 270], [300, 270], [252, 264], [241, 248], [236, 228], [234, 210]
], 6));
const topY = []; for (let x = 220; x < 490; x++) { let y = 120; while (y < 262 && !HULL(x + 0.5, y + 0.5)) y++; topY[x] = y; }
const hullTop = x => topY[clamp(Math.floor(x), 220, 489)];
// segment seams (they lean back a little, like the stripes)
const X1 = y => 352 + (y - 190) * 0.1;     // head | body 1
const X2 = y => 410 + (y - 190) * 0.12;    // body 1 | body 2
// the body's spine for the round shading bands: [x, y, radius]
const SPINE = [[296, 198, 50], [360, 192, 52], [410, 198, 50], [446, 224, 36], [458, 262, 26]];
const SPL = []; for (let i = 1; i < SPINE.length; i++) SPL.push(Math.hypot(SPINE[i][0] - SPINE[i - 1][0], SPINE[i][1] - SPINE[i - 1][1]));
function spineAt(x, y) {
  let best = null, acc = 0;
  for (let i = 1; i < SPINE.length; i++) {
    const [ax, ay, ra] = SPINE[i - 1], [bx, by, rb] = SPINE[i], dx = bx - ax, dy = by - ay, L = SPL[i - 1];
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (L * L), 0, 1), r = ra + (rb - ra) * t;
    const qx = ax + dx * t, qy = ay + dy * t, d = Math.hypot(x - qx, y - qy), k = d - r;
    if (!best || k < best.k) best = { k, u: acc + L * t, v: (dx * (y - ay) - dy * (x - ax) >= 0 ? 1 : -1) * d, r };
    acc += L;
  }
  return best;
}
// the mouth zone (below the upper lip, in front of the cheek): the jaw and the cavity live here
const JAWZONE = (x, y) => y > (x < FX ? FY : x > NX ? NY : lipUp(x)) && x < cheekX(y);
const GILLS = [317, 324, 331, 338, 345];   // gill louvres (x at y 190): curved slots leaning back
const gillY0 = i => 175 + i * 1.5, gillY1 = i => 228 - i * 0.5;
const gillX = (i, y) => GILLS[i] + (y - 190) * 0.16 - 2.6 * Math.sin(Math.PI * clamp((y - gillY0(i)) / (gillY1(i) - gillY0(i)), 0, 1));
const gillD = (x, y, i) => x - gillX(i, y);
const DORSAL = poly(smooth([[372, 141], [380, 124], [390, 106], [400, 92], [408, 84], [412, 88], [411, 104], [414, 120], [420, 134], [428, 146], [400, 150]], 5));
const DORSAL2 = poly(smooth([[428, 156], [433, 146], [439, 137], [443, 136], [444, 144], [448, 158], [440, 162]], 4));
const PEC = poly(smooth([[334, 214], [338, 221], [348, 228], [362, 233], [378, 236], [396, 238], [402, 236], [394, 231], [384, 224], [374, 215], [362, 208], [348, 206]], 5));
const PEC_PIV = [342, 212];
const TAIL = poly(smooth([[446, 254], [450, 238], [455, 218], [461, 200], [467, 186], [473, 176], [477, 172], [478, 178], [473, 192], [469, 210], [468, 228], [469, 244], [466, 256]], 5));
const TAIL_PIV = [457, 250];
const CHEEK = [302, 214];                  // where the cheek bulges (rock spit)
const ARM = [S0, S1, S2, S3, S4, S5, S6];
const armBand = n => n < -0.93 ? 6 : n < -0.8 ? 5 : n < -0.5 ? 4 : n < -0.06 ? 3 : n < 0.36 ? 2 : 1;
const RIDGES = [-0.74, -0.42, -0.02];

// ============================================================
// Painters (load time)
// ============================================================
// the head: flat top in bands, the front face and the upper lip, the near cheek, gill louvres, eye socket
function paintHead() {
  const px = new Pix(226, 136, X1(270) + 6 - 226, 132);
  const inHead = (x, y) => HULL(x, y) && x < X1(y) && !JAWZONE(x, y);
  px.shape(inHead, (x, y) => {
    const dTop = y - hullTop(x);
    if (dTop < 1.5) return P(S6);
    if (dTop < 3.5) return P(S5);
    // the upper lip: thick pale steel above the mouth
    if (x < NX + 2 && y < NY + 2) {
      const dl = lipUp(x) - y;
      if (dl < 1.6) return P(V1);
      if (dl < 3.6) return P(V3);
      if (dl < 4.6) return P(V2);
      if (dl < 7) return P(S1);
    }
    // the front face (left of the snout's turn) a step darker than the top, the near side in bands
    const s = spineAt(x, y), n = s.v / s.r;
    if (x < 250 && dTop > 8) return P(dTop < 16 ? S3 : S2);
    if (dTop < 13) return P(S4);
    let b = armBand(n);
    if (x > 300) for (const rv of RIDGES.slice(0, 1)) { const d = (n - rv) * s.r; if (d >= -0.5 && d < 0.6) b += 2; else if (d >= 0.6 && d < 1.7) b--; }
    if (x < cheekX(y) + 10 && y > NY) b = Math.min(b, 2);
    return P(ARM[clamp(b, 0, 6)]);
  });
  // gill louvres: five curved slots bowing forward, a lit lip in front, shadow behind, glowing red deep inside
  for (let i = 0; i < GILLS.length; i++) px.over((x, y) => y > gillY0(i) && y < gillY1(i), (x, y) => {
    const d = gillD(x, y, i);
    if (d >= 0 && d < 2) return P(y > gillY1(i) - 9 ? (d < 1 ? L2 : L1) : y > gillY1(i) - 18 ? (d < 1 ? L1 : M1) : S0);
    if (d >= 2 && d < 3) return P(S1);
    if (d >= -1 && d < 0) return P(y < 194 ? S6 : S5);
    if (d >= -2 && d < -1) return P(S2);
    return 0;
  });
  for (let i = 0; i < GILLS.length; i++) for (const y of [Math.round(gillY0(i)) - 2, Math.round(gillY1(i)) + 1]) { const x = Math.round(gillX(i, y)); px.dot(x, y, P(S6)); px.dot(x + 1, y + 1, P(S0)); }
  // the cheek plate seam (where the jaw tucks in) and the hinge bolt at the near mouth corner
  for (let y = NY + 2; y < 250; y++) { const x = Math.round(cheekX(y)) + 3; if (inHead(x + 0.5, y + 0.5)) { px.dot(x, y, P(S0)); px.dot(x + 1, y, P(S4)); } }
  px.shape(ell(NX + 4, NY + 4, 3.3, 3.3), (x, y) => P(y < NY + 3 ? V4 : y < NY + 5 ? V2 : V0));
  px.dot(NX + 3, NY + 2, P('#ffffff'));
  // the smile crease curling up from the near corner
  for (const [x, y] of [[NX - 1, NY - 2], [NX, NY - 3], [NX + 1, NY - 4], [NX + 2, NY - 4]]) px.dot(x, y, P(S0));
  // the eye socket: a dark ring, the brow plate above it (the lens is drawn live)
  px.shape(ell(EYE[0], EYE[1], 7, 6.4), (x, y) => P(Math.hypot(x - EYE[0], (y - EYE[1]) * 1.1) > 5.8 ? S1 : S0));
  px.shape(poly([[291, 180], [312, 176], [315, 180], [294, 184]]), (x, y) => P(y < 179 ? S6 : y < 181.5 ? S5 : S4));
  px.dot(296, 182, P(S1)); px.dot(309, 179, P(S1));
  // rivets along the head's rim
  for (let x = 244; x < 344; x += 12) { const y = hullTop(x) + 5; if (inHead(x + 0.5, y + 0.5) && Math.hypot(x - EYE[0], y - EYE[1]) > 9) { px.dot(x, y, P(S6)); px.dot(x + 1, y + 1, P(S1)); } }
  px.outline();
  // no outline along the cut to body 1 at the waterline (handled by the seam drawing)
  px.warm(206, 246, WARM, 0.55, (x, y) => { const v = px.get(x - 0.5, y - 0.5); if (!v) return true; const [r, , b] = unpk(v); return r > 170 && b < 120; });
  return px;
}

// the lower jaw at gape k: pale steel bands following the lower lip, plate seams, rivets; lit warm from the lava
function paintJaw(k) {
  const px = new Pix(226, 186, cheekX(270) + 8 - 226, 84);
  const lo = x => x < FX ? FY + 1 : x > NX ? NY + 1 : lipLo(x, k);
  const inJaw = (x, y) => HULL(x, y) && JAWZONE(x, y) && y > lo(x);
  px.shape(inJaw, (x, y) => {
    const d = y - lo(x);
    if (d < 1.2) return P(V4);                      // the lit lower lip
    if (d < 3) return P(V3);
    if (Math.abs(d - 9) < 0.5 || Math.abs(d - 18) < 0.5) return P(V0);
    if (Math.abs(d - 10) < 0.5 || Math.abs(d - 19) < 0.5) return P(V4);
    if (x < 241 && d > 3) return P(V1);             // the chin's front, in shadow
    return P(d < 9 ? V3 : d < 18 ? V2 : V1);
  });
  // tiny comb teeth along both lips (only seen when it gapes), rivets on the plates
  if (k > 0) for (let x = FX + 4; x < NX - 3; x += 2) {
    const q = mk(x); if (q < 0.06 || q > 0.94) continue;
    const y = Math.round(lo(x)); px.dot(x, y - 1, P(V4)); if (x % 4 === 2) px.dot(x, y - 2, P(V3));
  }
  for (let x = 246; x < 296; x += 10) for (const d of [13, 22]) {
    const y = Math.round(lo(x) + d);
    if (inJaw(x + 0.5, y + 0.5) && inJaw(x + 0.5, y + 3.5)) { px.dot(x, y, P(V4)); px.dot(x + 1, y + 1, P(V0)); }
  }
  px.outline();
  px.warm(212, 250, WARM, 0.6);
  return px;
}

// the mouth's upper teeth (on the head's lip, seen only when it gapes): a separate strip drawn over the cavity
function paintTeeth() {
  const px = new Pix(FX, FY - 4, NX - FX + 1, 16);
  for (let x = FX + 4; x < NX - 3; x += 2) {
    const q = mk(x); if (q < 0.05 || q > 0.95) continue;
    const y = Math.round(lipUp(x)); px.dot(x, y, P(V4)); if (x % 4 === 0) px.dot(x, y + 1, P(V3));
  }
  return px;
}

// the whale shark's checkerboard: pale stripes (panel seams) between the ridges, every band offset by half a panel
const BANDS = [[-1.1, -0.74], [-0.74, -0.42], [-0.42, -0.02], [-0.02, 0.62]];
const bandOf = n => { for (let i = 0; i < BANDS.length; i++) if (n < BANDS[i][1]) return i; return BANDS.length - 1; };
const STR = []; for (let k = 0; k < 18; k++) STR.push(60 + k * 12.5 + (hsh(k * 4.1) - 0.5) * 3);
const strOff = b => (b % 2) * 6.2;
// the point on the body at spine u, height n (v / r)
function bodyPt(u, n) {
  let acc = 0;
  for (let k = 1; k < SPINE.length; k++) {
    if (acc + SPL[k - 1] < u && k < SPINE.length - 1) { acc += SPL[k - 1]; continue; }
    const [ax, ay, ra] = SPINE[k - 1], [bx, by, rb] = SPINE[k], L = SPL[k - 1], t = (u - acc) / L, r = ra + (rb - ra) * t;
    return [ax + (bx - ax) * t - (by - ay) / L * n * r, ay + (by - ay) * t + (bx - ax) / L * n * r];
  }
}
// a body segment: round bands around the spine, the stripes, three ridges; a collar where it slides under the next
function paintBody(seg, ph2) {
  const xa = seg === 1 ? X1(130) - 6 : X2(130) - 6, xb = seg === 1 ? X2(270) + 2 : 476;
  const px = new Pix(xa, 130, xb - xa, 140);
  const inSeg = (x, y) => HULL(x, y) && (seg === 1 ? x >= X1(y) - 5 && x < X2(y) : x >= X2(y) - 5);
  px.shape(inSeg, (x, y) => {
    const s = spineAt(x, y), n = s.v / s.r;
    if (n > 0.62) return flat([V1, V2, V3], 1 - ss(0.62, 1.02, n) * 0.9);
    let b = armBand(n);
    const bow = 4 * (1 - n * n), off = strOff(bandOf(n));
    for (const su of STR) { const d = s.u + bow - su - off; if (d >= 0 && d < 1) b += n < 0.3 ? 2 : 1; }
    for (const rv of RIDGES) { const d = (n - rv) * s.r; if (d >= -0.5 && d < 0.6) b += 2; else if (d >= 0.6 && d < 1.7) b--; }
    return P(ARM[clamp(b, 0, 6)]);
  });
  const X = seg === 1 ? X1 : X2;
  px.over((x, y) => { const d = x - X(y); return d >= -5 && d < -1; }, (x, y) => P(x - X(y) < -3 ? S1 : S0));
  px.outline();
  px.warm(204, 246, WARM, 0.6);
  return px;
}
// phase 2: where armour plates popped off: a torn lit rim, a dark cavity with a copper pipe and a hot glowing core
// (sprites drawn over the lava tongues, so the damage always shows)
const HOLES = [[1, 366, 174, 9, 7], [1, 392, 204, 9, 7], [1, 364, 216, 6, 5], [2, 430, 182, 8, 7], [2, 444, 210, 6, 5]];
function paintHole(i) {
  const [, cx, cy, rx, ry] = HOLES[i];
  const px = new Pix(cx - rx - 2, cy - ry - 2, rx * 2 + 5, ry * 2 + 5);
  const f = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (hsh(Math.floor(x) * 3.1 + Math.floor(y) * 7.7 + i) - 0.5) * 0.45 <= 1;
  px.shape(f, (x, y) => {
    if (!f(x - 1, y - 1)) return P(S6);                              // torn lit edge
    if (!f(x + 1, y + 1)) return P(S1);
    const u = (x - cx) / rx, v = (y - cy) / ry, d = Math.hypot(u, v);
    if (Math.abs(v - u * 0.5 - 0.15) < 0.16) return P(d < 0.5 ? CU3 : CU2);   // a copper pipe across it
    if (Math.abs(v - u * 0.5 - 0.15) < 0.3) return P(CU1);
    if (d < 0.3) return P(L6);
    if (d < 0.48) return P(L4);
    if (d < 0.62) return P(L2);
    return P(v < 0 ? M0 : M1);
  });
  px.outline();
  return px.sprite();
}

function paintDorsal(f, x0, y0, w, h) {
  const px = new Pix(x0, y0, w, h);
  px.shape(f, (x, y) => {
    if (!f(x - 1.5, y + 0.5)) return P(S6);        // lit leading edge
    if (!f(x - 3.5, y + 1)) return P(S5);
    if (!f(x + 2, y)) return P(S1);                // trailing edge in shadow
    return P(y > y0 + h - 12 ? S2 : S3);
  });
  px.shape(f, (x, y) => (f(x - 7, y + 2) && !f(x - 8, y + 2) && y < y0 + h - 8) ? P(S1) : 0);
  for (let i = 0; i < 4; i++) { const x = Math.round(x0 + w * (0.35 + i * 0.12)), y = Math.round(y0 + h * (0.4 + i * 0.12)); if (f(x + 0.5, y + 0.5) && f(x - 2, y)) { px.dot(x, y, P(S6)); px.dot(x + 1, y + 1, P(S0)); } }
  px.outline();
  return px;
}

// pectoral fin turned by a (radians, + = tip down) around its root; tail fin swung by a around its base
function paintFin(f, piv, a, box, isTail) {
  const px = new Pix(box[0], box[1], box[2], box[3]);
  const g = (x, y) => { const q = rot(x, y, piv[0], piv[1], -a); return f(q[0], q[1]); };
  px.shape(g, (x, y) => {
    const q = rot(x, y, piv[0], piv[1], -a), qx = q[0], qy = q[1];
    if (!f(qx - 1.3, qy + (isTail ? 0 : 1.1))) return P(S6);
    if (!f(qx - 3, qy + (isTail ? 0.5 : 2.4))) return P(S5);
    if (!f(qx + 1.6, qy + 0.2)) return P(S0);
    if (!f(qx + 3, qy - 0.4)) return P(S1);
    return P(isTail ? (qx > 466 ? S2 : S3) : (!f(qx - 6, qy + 5) ? S4 : S3));
  });
  // a seam across it and a few spots
  px.over((x, y) => { const q = rot(x, y, piv[0], piv[1], -a); const d = isTail ? q[1] - (212 + (q[0] - 460) * 0.3) : (q[0] - 346) * 0.63 + (q[1] - 214) * 0.77 - 20; return d >= 0 && d < 1; }, P(S1));
  const spots = isTail ? [[462, 206], [467, 192], [459, 226], [464, 214]] : [[352, 216], [362, 222], [374, 227], [384, 231], [358, 212]];
  for (const [sx, sy] of spots) { const q = rot(sx, sy, piv[0], piv[1], a), x = Math.round(q[0]), y = Math.round(q[1]); if (g(x + 0.5, y + 0.5) && g(x - 1.5, y + 2) && g(x + 2, y - 2)) { px.dot(x, y, P(LAMP)); px.dot(x + 1, y, P(LAMPH)); } }
  px.outline();
  px.warm(220, 250, WARM, 0.5);
  return px;
}

// lava on its back: a glowing sheet along the top and tongues pouring down the flank, crust specks flowing in them
// (LAVAF frames per body segment, so it runs without any per-pixel work at play time)
const LAVAF = 6;
const TONGUES = [[372, 10, 1, 0], [395, 6, 2, 26], [418, 9, 3, 0], [439, 5, 4, 18]];
function paintLava(seg, f) {
  const xa = seg === 1 ? X1(130) - 6 : X2(130) - 6, xb = seg === 1 ? X2(270) + 2 : 476;
  const px = new Pix(xa, 130, xb - xa, 140);
  const inSeg = (x, y) => HULL(x, y) && (seg === 1 ? x >= X1(y) + 1 && x < X2(y) - 1 : x >= X2(y) + 1) && !DORSAL(x, y) && !DORSAL2(x, y);
  const speck = (x, y, sd, sp) => hsh(Math.floor(x / 2) * 7.3 + Math.floor((((y - f * sp) % 18) + 18) % 18 / 2) * 1.9 + sd) > 0.88;
  for (let x = Math.max(xa, 358); x < xb; x++) {
    const t = hullTop(x);
    for (let j = 0; j < 3; j++) {
      const y = t + j;
      if (!inSeg(x + 0.5, y + 0.5) || y > LY - 2) continue;
      if (j === 2 && hsh(x * 1.7) > 0.5) continue;
      let c = j === 0 ? L6 : j === 1 ? L5 : L4;
      if (j > 0 && hsh(Math.floor((x + f * 2) / 2) * 3.1 + j) > 0.86) c = L2;
      px.dot(x, y, P(c));
    }
  }
  for (const [sx, w0, sd, len] of TONGUES) {
    const y0 = hullTop(sx) + 2, y1 = len ? y0 + len : LY + 1;
    for (let y = y0 - 1; y <= y1; y++) {
      const g = clamp((y - y0) / Math.max(1, y1 - y0), 0, 1), xc = sx + Math.sin(y * 0.15 + sd) * 1.8 + (y - y0) * 0.12;
      const w = w0 * (1 - g * 0.6) + (hsh(Math.floor(y / 3) * 2.7 + sd) - 0.5) * 2.4 + (len && g > 0.85 ? 2.5 : 0) + (g < 0.08 ? 3 : 0);
      // near the bottom of a long tongue the flow breaks up into blobs (it cools as it runs down)
      if (!len && g > 0.72 && hsh(Math.floor((y - f * 2) / 3) * 5.1 + sd) > 0.62) continue;
      for (let x = Math.floor(xc - w / 2 - 1); x <= Math.ceil(xc + w / 2 + 1); x++) {
        const d = (x + 0.5 - xc) / (w / 2), ad = Math.abs(d);
        if (ad > 1 || !inSeg(x + 0.5, y + 0.5)) continue;
        let c = ad > 0.78 ? (g > 0.5 ? L1 : L2) : ad > 0.52 ? (g > 0.6 ? L3C : L4) : ad > 0.2 ? (g > 0.7 ? L4 : L5) : (g > 0.55 ? L5 : d < 0 ? L7 : L6);
        if (ad <= 0.78 && (speck(x, y, sd, 3) || (g > 0.5 && speck(x + 7, y + 5, sd + 3, 3)))) c = ad > 0.4 ? L1 : L2;
        px.dot(x, y, P(c));
      }
    }
  }
  return px;
}

// the cheek bulging (rock spit, BURP): a puffed armour plate behind the mouth corner, with spots
function paintCheek(lvl) {
  const rx = 9 + lvl * 3.6, ry = 7 + lvl * 2.8, cx = CHEEK[0] - 2 + lvl * 0.5, cy = CHEEK[1] + 1;
  const px = new Pix(cx - rx - 2, cy - ry - 2, rx * 2 + 5, ry * 2 + 5);
  const f = ell(cx, cy, rx, ry);
  px.shape(f, (x, y) => {
    const u = (x - cx) / rx, v = (y - cy) / ry, l = u * -0.45 + v * -0.85;
    if (v > 0.5 + u * 0.15) return P(v > 0.8 ? V1 : V2);           // the pale underside, puffed out
    if (l > 0.62 && u < 0) return P(S6);
    if (l > 0.3) return P(S5);
    if (l > -0.15) return P(S4);
    return P(l > -0.5 ? S3 : S2);
  });
  // spots on the puffed plate, a seam where the pale underside starts
  for (let i = 0; i < 4 + lvl * 2; i++) { const a = -2.6 + i * 0.55, rr = 0.45 + hsh(i * 3.7 + lvl) * 0.3, x = Math.round(cx + Math.cos(a) * rx * rr), y = Math.round(cy + Math.sin(a) * ry * rr); if (f(x + 0.5, y + 0.5)) px.dot(x, y, P(LAMP)); }
  px.over((x, y) => { const u = (x - cx) / rx, v = (y - cy) / ry; const d = v - (0.5 + u * 0.15); return d > -0.06 && d < 0.02; }, P(S1));
  px.outline(P(S0));
  px.warm(214, 234, WARM, 0.5);
  return px;
}

// the intake fan in the throat, backlit: five curved blades and a hub
function paintFan(jam) {
  const R0 = 12, px = new Pix(-R0 - 1, -R0 - 1, R0 * 2 + 3, R0 * 2 + 3);
  px.shape((x, y) => Math.hypot(x, y) <= R0 + 0.5, (x, y) => {
    const r = Math.hypot(x, y);
    if (r > R0 - 1) return P('#2a0808');
    let a = Math.atan2(y, x) - r * 0.11;
    a = ((a % (Math.PI * 2 / 5)) + Math.PI * 2 / 5) % (Math.PI * 2 / 5);
    if (r > 2.8 && a < 0.6) return P(a < 0.14 ? '#7a2010' : '#3a0c0a');
    if (r <= 2.8) return P(r < 1.4 ? V3 : V1);
    return 0;
  });
  if (jam) { const f = poly([[-4, -6], [3, -8], [7, -2], [4, 5], [-3, 4], [-6, -1]]); px.shape(f, (x, y) => P(!f(x - 1.4, y - 1.4) ? K7 : y < -2 ? K6 : K4)); px.line(-3, 0, 2, -3, P(L4)); }
  return px;
}

// a lava rock (spat), angular basalt with a glowing crack; and a lava blob (breach drops)
function paintRock() {
  const px = new Pix(-10, -9, 20, 18), f = poly([[-8, -1], [-4, -7], [3, -8], [8, -3], [8, 3], [4, 7], [-3, 7], [-8, 3]]);
  px.shape(f, (x, y) => {
    if (!f(x + 1.4, y) || !f(x + 1, y + 1.4)) return P(L4);
    if (y < -3.5 + x * 0.1 && x < 4) return P('#b07a60');
    if (x > 3.5 || y > 4.5 - x * 0.2) return P(x > 5.5 ? K7 : '#a8552e');
    return P(x < -3 ? '#4e3532' : '#6e4a3e');
  });
  px.line(-6, 1, -1, 0, P(L4)); px.line(-1, 0, 2, 4, P(L5)); px.dot(-1, 0, P(L6)); px.dot(-4, 1, P(L6)); px.line(2, -4, 4, -2, P(L3C));
  px.outline();
  return px;
}
// debris for the end: a hex nut, a bolt, a small armour plate with a lamp, a gear
function paintBits() {
  const out = [];
  { const px = new Pix(-4, -4, 9, 9), f = poly([[-3, -1.5], [0, -3.5], [3, -1.5], [3, 1.5], [0, 3.5], [-3, 1.5]]); px.shape(f, (x, y) => Math.hypot(x, y) < 1.3 ? 0 : P(y < -1 ? V4 : y < 1 ? V2 : V1)); px.outline(); out.push(px); }
  { const px = new Pix(-2, -5, 5, 11); px.rect(-1, -4, 3, 2, P(V3)); px.rect(-1, -4, 3, 1, P(V4)); px.rect(0, -2, 1, 6, P(V2)); px.dot(0, 0, P(V0)); px.dot(0, 2, P(V0)); px.outline(); out.push(px); }
  { const px = new Pix(-7, -5, 15, 11), f = poly([[-6, -3], [5, -4], [6, 3], [-5, 4]]); px.shape(f, (x, y) => !f(x - 1, y - 1) ? P(S5) : !f(x + 1, y + 1) ? P(S1) : P(S3)); px.dot(0, 0, P(LAMP)); px.dot(-3, -2, P(S6)); px.outline(); out.push(px); }
  { const px = new Pix(-5, -5, 11, 11); px.shape((x, y) => { const r = Math.hypot(x, y), a = Math.atan2(y, x); return r < 3.2 + (Math.cos(a * 6) > 0.2 ? 1.4 : 0) && r > 1.2; }, (x, y) => P(y < 0 ? CU3 : CU2)); px.outline(); out.push(px); }
  return out;
}

// ============================================================
// Build everything once, at load
// ============================================================
const ART = (() => {
  const head = paintHead(), b1 = paintBody(1, false), b2 = paintBody(2, false), d1 = paintDorsal(DORSAL, 368, 80, 64, 72), d2 = paintDorsal(DORSAL2, 424, 132, 30, 34);
  const A = {
    head: head.sprite(), b1: b1.sprite(), b2: b2.sprite(),
    holes: HOLES.map((h, i) => paintHole(i)),
    teeth: paintTeeth().sprite(), dorsal: d1.sprite(), dorsal2: d2.sprite(),
    jaw: [], pec: [], tail: [], cheek: [], lava1: [], lava2: [], breach: [],
    fan: paintFan(false).canvas(), fanJam: paintFan(true).canvas(),
    rock: paintRock().sprite(), bits: paintBits().map(b => ({ img: b.canvas(), w: b.w, h: b.h }))
  };
  const jaws = [], pecs = [], tails = [];
  for (let i = 0; i < JAWN; i++) { const j = paintJaw(i / (JAWN - 1)); jaws.push(j); A.jaw.push(j.sprite()); }
  for (const a of [-0.16, -0.08, 0, 0.08, 0.16]) { const f = paintFin(PEC, PEC_PIV, a, [322, 180, 92, 80], false); pecs.push(f); A.pec.push(f.sprite()); }
  for (const a of [-0.24, -0.12, 0, 0.12, 0.24]) { const f = paintFin(TAIL, TAIL_PIV, a, [426, 150, 64, 112], true); tails.push(f); A.tail.push(f.sprite()); }
  for (let l = 1; l <= 3; l++) A.cheek.push(paintCheek(l).sprite());
  const lav1 = [], lav2 = [];
  for (let f = 0; f < LAVAF; f++) { lav1.push(paintLava(1, f)); lav2.push(paintLava(2, f)); }
  lav1.forEach(l => A.lava1.push(l.sprite())); lav2.forEach(l => A.lava2.push(l.sprite()));
  // the breach pose: everything composited (mouth chomping open), then turned nose-up at two angles
  const KB = 0.57, comp = new Pix(226, 78, 258, 192);
  const put = px => { for (let j = 0; j < px.h; j++) for (let i = 0; i < px.w; i++) { const v = px.d[j * px.w + i]; if (v) comp.dot(px.x0 + i, px.y0 + j, v); } };
  [tails[2], d2, b2, lav2[0], d1, b1, lav1[0]].forEach(put);
  comp.shape((x, y) => x > FX && x < NX && y > lipUp(x) && y < lipLo(x, KB), (x, y) => {
    const d = Math.hypot(x - 276, (y - 210) * 1.3);
    return P(d < 3 ? L7 : d < 6 ? L6 : d < 8 ? L4 : d < 11 ? L2 : y > lipLo(x, KB) - 5 ? '#7a2412' : '#1a0507');
  });
  [jaws[Math.round(KB * (JAWN - 1))], head, pecs[2]].forEach(put);
  comp.shape(ell(EYE[0], EYE[1], 3.5, 3.5), (x, y) => P(y < EYE[1] - 1 ? AMBL : AMB));
  comp.dot(EYE[0] - 1, EYE[1] - 1, P(PUP)); comp.dot(EYE[0] - 1, EYE[1], P(PUP));
  A.comp = comp;
  return A;
})();

// the lamps (white spots), each on a part, painted live so they twinkle and can go out one by one
const LAMPS = [];
(() => {
  const isArm = (s, x, y) => { const i = Math.floor(x) - s.x0, j = Math.floor(y) - s.y0; return i >= 0 && j >= 0 && i < s.w && j < s.h; };
  const head = (x, y) => HULL(x, y) && x < X1(y) - 3 && !JAWZONE(x, y + 4) && y < lipUp(Math.min(x, NX)) - 6;
  // the head: dense small spots on the top and the face
  for (let y = 152; y < 200; y += 6) for (let x = 238; x < 350; x += 7) {
    const jx = x + Math.round((hsh(x * 1.3 + y * 7.1) - 0.5) * 3) + ((y / 6) % 2 ? 3 : 0), jy = y + Math.round((hsh(x * 5.7 + y * 1.1) - 0.5) * 2);
    if (!head(jx + 0.5, jy + 0.5) || !head(jx - 2, jy + 2) || !head(jx + 2, jy - 3)) continue;
    if (Math.hypot(jx - EYE[0], jy - EYE[1] + 2) < 10 || GILLS.some((g, i) => Math.abs(gillD(jx, jy, i)) < 4 && jy > gillY0(i) - 3)) continue;
    LAMPS.push({ p: 0, x: jx, y: jy, s: hsh(jx * 1.7 + jy) > 0.8 ? 2 : 1, k: hsh(jx * 3 + jy) });
  }
  // the body: a spot in every checker cell (jittered, mixed sizes), sometimes a small one beside it
  for (let bi = 0; bi < BANDS.length; bi++) for (let k = 0; k < STR.length - 1; k++) {
    const [n0, n1] = BANDS[bi], h = hsh(k * 9.3 + bi * 4.7);
    const u = (STR[k] + STR[k + 1]) / 2 + strOff(bi) + (h - 0.5) * 3, n = lerp(Math.max(n0, -0.96), Math.min(n1, 0.5), 0.5 + (hsh(k * 2.9 + bi) - 0.5) * 0.4);
    const q = bodyPt(u, n); if (!q) continue;
    const x = Math.round(q[0]), y = Math.round(q[1]);
    if (y > LY - 4 || DORSAL(x, y) || PEC(x, y) || !HULL(x + 0.5, y + 0.5) || x < X1(y) + 1) continue;
    if (Math.abs(x - X2(y)) < 3) continue;
    const sz = bi === 0 ? (h > 0.6 ? 2 : 1) : h > 0.62 ? 3 : 2;
    LAMPS.push({ p: x < X2(y) ? 1 : 2, x, y, s: sz, k: h });
    // one or two small spots around it
    for (let j = 0; j < 2; j++) {
      if (hsh(k * 5.1 + bi * 1.3 + j * 7.7) < 0.3) continue;
      const a = hsh(k * 3.3 + bi * 2.1 + j * 5.9) * Math.PI * 2;
      const q2 = bodyPt(u + Math.cos(a) * 4.5, n + Math.sin(a) * 0.13); if (!q2) continue;
      const x2 = Math.round(q2[0]), y2 = Math.round(q2[1]);
      if (Math.abs(x2 - x) + Math.abs(y2 - y) < 3) continue;
      if (y2 < LY - 4 && HULL(x2 + 0.5, y2 + 0.5) && !DORSAL(x2, y2) && x2 > X1(y2) + 1 && Math.abs(x2 - X2(y2)) > 2) LAMPS.push({ p: x2 < X2(y2) ? 1 : 2, x: x2, y: y2, s: 1, k: hsh(x2 + y2) });
    }
  }
  // the order they go out in when it dies: from the tail to the nose, a little shuffled
  LAMPS.forEach((l, i) => { l.o = (480 - l.x) / 250 * 0.85 + hsh(i * 3.7) * 0.15; });
})();

// the breach pose: the composite gets its spots, then is turned nose-up at two angles (nearest pixel + re-outline)
(() => {
  const comp = ART.comp;
  for (const l of LAMPS) {
    if (comp.get(l.x, l.y) === 0) continue;
    if (l.s === 3) { for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [0, 2], [-1, 1], [2, 1], [1, -1], [1, 2]]) comp.dot(l.x + dx, l.y + dy, P(LAMPH)); }
    comp.dot(l.x, l.y, P(LAMP));
    if (l.s > 1) { comp.dot(l.x + 1, l.y, P(LAMP)); comp.dot(l.x, l.y + 1, P(l.s > 2 ? LAMP : LAMPH)); comp.dot(l.x + 1, l.y + 1, P(l.s > 2 ? LAMP : LAMPH)); }
  }
  const PIV = [340, 196];
  for (const a of [1.18, 1.85]) {
    const r = new Pix(-170, -170, 340, 340), c = Math.cos(a), sn = Math.sin(a);
    for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) {
      const X = r.x0 + i + 0.5, Y = r.y0 + j + 0.5;
      const v = comp.get(PIV[0] + X * c + Y * sn, PIV[1] - X * sn + Y * c);
      if (v) r.d[j * r.w + i] = v;
    }
    r.outline();
    ART.breach.push(r.sprite());
  }
  ART.comp = null;
})();

// ============================================================
// Pose: where every part is this frame (pure: the draw code calls it too, so no rand() here)
// ============================================================
// keyframes [[st, value], ...], smooth between keys
function kf(st, keys) {
  if (st <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (st > keys[i][0]) continue;
    const [a, va] = keys[i - 1], [b, vb, ez] = keys[i], t = (st - a) / (b - a);
    const s = ez === 'in' ? t * t * t : ez === 'out' ? 1 - (1 - t) ** 3 : sstep(t);
    return va + (vb - va) * s;
  }
  return keys[keys.length - 1][1];
}

// timings (frames)
const VTELL = 60, VSUCK = 130, VSUCK2 = 170;                  // vacuum: gape + spin-up warning, then suction
const VRAMP = 40, VRUN = 20, TEETER = 20;                     // the pull ramps up over VRAMP; RUN! from VRUN; teeter at the lip
const RUN_NEAR = 150, RUN_FAR = 80;                           // RUN! shows from VRUN past ax + RUN_NEAR, during the pull past RUN_FAR
const SP_MARK = 8, SP_FIRE = 42, SP_T = 46;                   // rock spit: marks, PTOO, flight time
const DV_SINK = 36, DV_GLIDE = 96, DV_BREACH = 156, DV_UP = 200, DV_END = 250;
const ST_FIRE = 56, ST_END = 112;                             // gill steam: vents redden, then jets
const HOME_DX = 0;

// the whale's world position helpers
const home = e => e.ax + AX;
function mouthFront(e, P) { return e.x - AX + FX + (P ? P.dx : 0); }

function pose(e) {
  const t = e.t, st = e.st, s = e.state, p = G.p;
  const P = { dx: 0, dy: 0, seg: [0, 0, 0], jaw: 0, cheek: 0, pec: 2, tail: 2, eyeX: -1, eyeY: 0, glow: 0, heat: 0, mode: 'normal', rot: 0, bx: 0, by: 0, shake: 0, under: false };
  // swimming: the segments bob one after another, the tail sways, the pectoral fin paddles
  const sw = t * 0.055, calm = s === 'dying' ? clamp(1 - st / 140, 0, 1) : 1;
  P.dy = Math.sin(sw) * 2 * calm;
  P.seg = [0, Math.round(Math.sin(sw - 0.9) * 1.2 * calm), Math.round(Math.sin(sw - 1.8) * 1.6 * calm)];
  P.tail = clamp(Math.round(2 + Math.sin(t * (s === 'dive' ? 0.16 : 0.07)) * 2.2 * calm), 0, 4);
  P.pec = clamp(Math.round(2 + Math.sin(t * 0.05 + 1) * 1.6 * calm), 0, 4);
  // the eyes follow the hero
  if (p) {
    const ex = e.x - AX + EYE[0], ey = e.y - AY + EYE[1];
    P.eyeX = clamp((p.x - ex) / 70, -1, 1); P.eyeY = clamp((p.y - 16 - ey) / 40, -1, 1);
  }
  switch (s) {
    case 'intro': {
      P.dy += kf(st, [[0, 112], [70, 104], [92, 104], [128, 0, 'out']]);
      P.dx = kf(st, [[0, 150], [84, 0, 'out']]);
      P.jaw = kf(st, [[128, 0], [142, 0.85, 'out'], [172, 0.85], [188, 0]]);
      P.dy -= kf(st, [[128, 0], [142, 5], [172, 5], [188, 0]]);
      P.glow = P.jaw * 0.4;
      P.under = st < 108;
      break;
    }
    case 'idle': {
      // a little gulp now and then, swims a few px back and forth
      const g = t % 300;
      if (g < 24) P.jaw = Math.sin(g / 24 * Math.PI) * 0.16;
      P.dx = Math.round(Math.sin(t * 0.012) * 4);
      break;
    }
    case 'vac': {
      const suck = e.ph2 ? VSUCK2 : VSUCK, end = VTELL + suck;
      if (e.held) {
        const h = e.held.t;
        P.jaw = h < 8 ? 1 : h < 14 ? kf(h, [[8, 1], [14, 0, 'in']]) : h < 58 ? Math.abs(Math.sin(h * 0.35)) * 0.08 : kf(h, [[58, 0], [62, 0.55, 'out'], [78, 0.55], [92, 0]]);
        P.cheek = h >= 14 && h < 60 ? 2 + (h % 12 < 6 ? 1 : 0) : 0;
        P.dy -= h < 14 ? 7 : kf(h, [[14, 7], [30, 2]]);
        P.shake = h >= 14 && h < 58 ? 1 : 0;
        P.glow = h < 14 ? 1 : 0;
        P.eyeX = -1; P.eyeY = -0.5;
      } else {
        P.jaw = kf(st, [[0, 0], [24, 1, 'out'], [end, 1], [end + 20, 0]]);
        if (st > VTELL && st < end) P.jaw = 1 - (Math.sin(st * 0.5) > 0.6 ? 0.04 : 0);
        P.dy -= kf(st, [[0, 0], [24, 7], [end, 7], [end + 22, 0]]);
        P.dx = kf(st, [[0, 0], [24, -3], [end, -3], [end + 22, 0]]);
        P.glow = kf(st, [[0, 0.1], [VTELL, 1], [end, 1], [end + 16, 0]]);
      }
      break;
    }
    case 'burp': {
      P.jaw = kf(st, [[0, 1], [8, 0, 'in'], [40, 0], [44, 0.7, 'out'], [70, 0.7], [86, 0]]);
      P.cheek = st < 40 ? clamp(Math.floor(st / 5), 0, 3) : st < 46 ? 3 : 0;
      P.dy -= kf(st, [[0, 7], [16, 0], [40, -2], [46, 6], [86, 0]]);
      P.shake = st >= 14 && st < 40 ? 2 : 0;
      P.glow = st >= 44 && st < 70 ? 0.6 : 0;
      break;
    }
    case 'spit': {
      P.cheek = kf(st, [[0, 0], [30, 3.4], [SP_FIRE, 3.4], [SP_FIRE + 2, 0]]);
      P.jaw = kf(st, [[SP_FIRE - 1, 0], [SP_FIRE + 3, 0.5, 'out'], [SP_FIRE + 14, 0.5], [SP_FIRE + 30, 0]]);
      P.dy -= kf(st, [[0, 0], [30, -3], [SP_FIRE, -3], [SP_FIRE + 3, 4], [SP_FIRE + 30, 0]]);
      P.dx = kf(st, [[SP_FIRE, 0], [SP_FIRE + 3, 5], [SP_FIRE + 30, 0]]);
      P.shake = st > 20 && st < SP_FIRE ? 1 : 0;
      P.leak = st > 6 && st < SP_FIRE ? (st - 6) / (SP_FIRE - 6) : 0;
      break;
    }
    case 'dive': {
      // sink until only the fin shows, the fin glides to the breach spot, gone under (the tell), BREACH, back home
      const gx = (e.bx || home(e)) - e.x;
      if (st < DV_BREACH) {
        P.dy += kf(st, [[0, 0], [8, -4], [DV_SINK, 104, 'in'], [DV_GLIDE, 104], [DV_GLIDE + 12, 170]]);
        P.dx = kf(st, [[DV_SINK, 0], [DV_GLIDE, gx - 30]]);
        P.jaw = kf(st, [[0, 0], [6, 0.3], [16, 0]]);
        P.under = st > DV_SINK - 10;
      } else if (st < DV_UP) {
        const r = st - DV_BREACH;
        P.mode = 'breach';
        P.bx = e.bx; P.by = kf(r, [[0, 380], [15, 176, 'out'], [22, 168], [44, 400, 'in']]);
        P.rot = r < 18 ? 1 : 2;
      } else {
        const r = st - DV_UP;
        P.dy += kf(r, [[0, 110], [36, 0, 'out']]);
        P.under = r < 18;
      }
      break;
    }
    case 'steam': {
      P.heat = kf(st, [[0, 0], [ST_FIRE, 1], [ST_END, 1], [ST_END + 20, 0]]);
      P.dy += kf(st, [[0, 0], [ST_FIRE, -2], [ST_FIRE + 4, 2], [ST_END, 2], [ST_END + 20, 0]]);
      P.jaw = kf(st, [[ST_FIRE, 0], [ST_FIRE + 6, 0.12], [ST_END, 0.12], [ST_END + 10, 0]]);
      P.shake = st > ST_FIRE - 16 && st < ST_FIRE ? 1 : 0;
      break;
    }
    case 'roar': {
      P.jaw = kf(st, [[0, 0], [18, 0.9, 'out'], [70, 0.9], [88, 0]]);
      P.dy -= kf(st, [[0, 0], [18, 8], [70, 8], [88, 0]]);
      P.shake = st > 18 && st < 64 ? 2 : 0;
      P.glow = P.jaw * 0.5;
      break;
    }
    case 'phase2': {
      P.shake = st < 30 ? 2 : st < 40 ? 3 : 0;
      P.jaw = kf(st, [[30, 0.2], [44, 0.9, 'out'], [90, 0.9], [106, 0]]);
      P.dy -= kf(st, [[30, 0], [44, 8], [90, 8], [106, 0]]);
      P.heat = kf(st, [[30, 1], [70, 0]]);
      P.glow = P.jaw * 0.5;
      break;
    }
    case 'dying': {
      P.jaw = kf(st, [[0, 0.3], [16, 0.95, 'out'], [40, 0.9], [70, 0.5], [110, 0.25], [190, 0.15], [200, 0.8, 'out'], [230, 0.6]]);
      P.cheek = st >= 186 && st < 200 ? clamp(Math.floor((st - 186) / 4) + 1, 1, 3) : 0;
      P.dy += kf(st, [[0, 0], [120, 6], [250, 128, 'in']]);
      P.shake = st >= 24 && st < 60 ? 2 : st > 120 && st < 200 ? 1 : 0;
      P.glow = st < 24 ? 0.6 : st < 60 ? (st % 8 < 4 ? 0.4 : 0) : 0;
      if (st > 60) { P.eyeX = Math.cos(st * 0.3); P.eyeY = Math.sin(st * 0.3); }
      break;
    }
  }
  if (P.shake) { P.dx += Math.round((hsh(t * 1.7) - 0.5) * 2 * P.shake); P.dy += Math.round((hsh(t * 2.3) - 0.5) * 1.4 * P.shake); }
  return P;
}

// ============================================================
// Drawing
// ============================================================
function part(s, x, y, white) { ctx.drawImage(s.img, Math.round(x + s.x0), Math.round(y + s.y0)); if (white) { ctx.globalAlpha = 0.5; ctx.drawImage(s.white, Math.round(x + s.x0), Math.round(y + s.y0)); ctx.globalAlpha = 1; } }

// the mouth's cavity at gape k (design coordinates, offset ox, oy): a dark maw with a ribbed roof, the white-hot
// throat and the intake fan silhouetted in it
function mouthPath(k, ox, oy) {
  ctx.beginPath();
  for (let x = FX; x <= NX; x += 2) ctx.lineTo(x + ox, lipUp(x) + oy);
  for (let x = NX; x >= FX; x -= 2) ctx.lineTo(x + ox, lipLo(x, k) + oy);
  ctx.closePath();
}
// crisp pixel ellipse / elliptic arc on the live canvas
function pell(cx, cy, rx, ry, col) {
  ctx.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy); ry = Math.max(1, Math.round(ry));
  for (let j = -ry; j <= ry; j++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j / (ry + 0.5)) ** 2))); ctx.fillRect(cx - w, cy + j, w * 2 + 1, 1); }
}
function parc(cx, cy, rx, ry, a0, a1, col, th = 1) {
  ctx.fillStyle = col;
  const n = Math.ceil((a1 - a0) * Math.max(rx, ry));
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), th, th); }
}
function drawMouth(e, P, ox, oy) {
  const k = P.jaw;
  if (k < 0.02) return;
  const g = P.glow, mid = (FX + NX) / 2;
  // the throat sits at the back of the mouth: right of centre (we look in from the front-left), under the roof
  const tx = Math.round(lerp(284, THROAT[0], Math.min(1, k * 1.2)) + ox), ty = Math.round(lipUp(THROAT[0]) + 3 + 14 * k + oy);
  ctx.save(); mouthPath(k, ox, oy); ctx.clip();
  ctx.fillStyle = '#1a0507'; ctx.fillRect(FX + ox - 2, FY - 8 + oy, NX - FX + 4, 70);
  // the floor of the mouth (a big steel tongue plate), lit orange from the throat and the lava
  const fy = lipLo(mid, k) + oy;
  pell(mid - 6 + ox, fy - 1, 31, 5 + 11 * k, '#4a120c');
  pell(mid - 9 + ox, fy, 25, 3 + 8 * k, '#7a2412');
  pell(mid - 12 + ox, fy + 1, 17, 2 + 5 * k, g > 0.4 ? '#c8561e' : '#a8401a');
  ctx.fillStyle = g > 0.4 ? '#ffb070' : '#e07a3a'; ctx.fillRect(Math.round(mid - 24 + ox), Math.round(fy - 3 - 5 * k), 16, 1); ctx.fillRect(Math.round(mid - 20 + ox), Math.round(fy - 4 - 5 * k), 6, 1);
  // ribs arching over the roof toward the throat
  for (let i = 0; i < 4; i++) {
    const q = i / 4, cx = lerp(mid - 8 + ox, tx, q), cy = lerp(lipUp(mid) + 14 * k + oy, ty, q), rx = lerp(30, 12, q) * (0.5 + k * 0.5), ry = lerp(17, 9, q) * k + 2;
    parc(cx, cy, rx, ry, Math.PI * 1.08, Math.PI * 1.92, i % 2 ? '#2e0909' : '#5e1812', 1);
    parc(cx, cy + 1, rx, ry, Math.PI * 1.12, Math.PI * 1.88, i % 2 ? '#1a0507' : '#3a0c0a', 1);
  }
  // the gullet: a dark hole with the white-hot throat in it (whiter while it sucks), the fan's blades against it
  const r0 = Math.max(2, Math.round(3 + 9 * k));
  pell(tx + 1, ty + 1, r0 + 4, r0 + 3, '#0e0203');
  disc(tx, ty, r0 + 1, g > 0.5 ? L4 : L2);
  disc(tx, ty, r0, g > 0.5 ? L6 : L4);
  disc(tx, ty, Math.max(1, r0 - 3), g > 0.5 ? L7 : L5);
  if (k > 0.35) {
    ctx.save(); ctx.translate(tx, ty);
    ctx.rotate(Math.round((e.fanA || 0) / (Math.PI / 20)) * (Math.PI / 20));
    const f = e.jam ? ART.fanJam : ART.fan, sc = Math.min(1, (r0 + 1) / 13);
    if (sc < 1) ctx.scale(sc, sc);
    ctx.drawImage(f, -13, -13);
    ctx.restore();
  }
  ctx.restore();
  if (k > 0.15) part(ART.teeth, ox, oy);
  if (g > 0.05 || k > 0.5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(tx, ty, 22 + 34 * g, '#ff7a20', 0.18 + 0.3 * g); glow(tx, ty, 10 + 10 * g, '#ffd070', 0.2 + 0.4 * g); ctx.restore(); }
  P.throat = [tx, ty];
}

function drawLamps(e, P, ox, oy, off) {
  const t = G.t;
  for (const l of LAMPS) {
    const o = off[l.p], x = l.x + ox + o[0], y = l.y + oy + o[1];
    const out = e.lightsOut != null && l.o < e.lightsOut;
    if (out) { ctx.fillStyle = LAMPD; ctx.fillRect(x, y, l.s > 1 ? 2 : 1, l.s > 2 ? 2 : 1); continue; }
    const tw = (Math.floor(t / 7) + Math.floor(l.k * 40)) % 37 === 0;
    if (l.s === 1) { ctx.fillStyle = tw ? LAMPH : LAMP; ctx.fillRect(x, y, l.k > 0.6 ? 2 : 1, 1); continue; }
    if (l.s === 2) { ctx.fillStyle = LAMPH; ctx.fillRect(x, y, 2, 2); ctx.fillStyle = LAMP; ctx.fillRect(x, y, 1, 1); continue; }
    ctx.fillStyle = LAMPH; ctx.fillRect(x - 1, y, 4, 2); ctx.fillRect(x, y - 1, 2, 4);
    ctx.fillStyle = tw ? '#ffffff' : LAMP; ctx.fillRect(x, y, 2, 2);
  }
}

// the eye: an amber camera lens; the pupil looks at the hero
function drawEye(e, P, ox, oy) {
  const x = EYE[0] + ox, y = EYE[1] + oy;
  const dead = e.state === 'dying' && e.st > 150;
  disc(x, y, 5, dead ? '#2a1e0c' : AMBD);
  disc(x, y, 4, dead ? '#3a2a10' : AMB);
  if (dead) { ctx.fillStyle = '#1a0e00'; ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x, y - 3, 1, 7); return; }
  ctx.fillStyle = AMBL; ctx.fillRect(x - 2, y - 4, 4, 1); ctx.fillRect(x - 4, y - 2, 1, 2); ctx.fillRect(x - 3, y - 3, 1, 1);
  const px = Math.round(x + P.eyeX * 2), py = Math.round(y + P.eyeY * 1.6);
  ctx.fillStyle = PUP; ctx.fillRect(px - 1, py - 1, 3, 3); ctx.fillRect(px, py - 2, 1, 5); ctx.fillRect(px - 2, py, 5, 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y - 3, 2, 1); ctx.fillRect(x + 2, y - 2, 1, 1);
  // a blink now and then; a cross brow while it winds up an attack (goofy-cross, never scary)
  const s = e.state, blink = s === 'idle' && e.t % 190 < 6;
  if (blink) { disc(x, y, 5, S3); ctx.fillStyle = S1; ctx.fillRect(x - 5, y, 11, 1); }
  const cross = (s === 'vac' && !e.held && e.st < VTELL) || (s === 'spit' && e.st < SP_FIRE) || (s === 'steam' && e.st < ST_FIRE) || s === 'roar' || s === 'phase2';
  if (cross) { ctx.fillStyle = S0; for (let i = 0; i < 12; i++) ctx.fillRect(x - 6 + i, y - 7 + Math.round((11 - i) * 0.3), 1, 3); ctx.fillStyle = S5; for (let i = 0; i < 12; i++) ctx.fillRect(x - 6 + i, y - 8 + Math.round((11 - i) * 0.3), 1, 1); }
}

// where a part cuts the lava surface: a churned bright rim and little splashes (dx, dy: the part's offset)
function rimAt(s, ox, oy, wl, t, k = 1) {
  const j = Math.round(wl - oy) - s.y0, row = s.rows[j] || s.rows[j - 1] || s.rows[j + 1];
  if (!row) return;
  const xa = row[0] + ox, xb = row[1] + ox;
  for (let x = xa - 1; x <= xb; x++) {
    const w = 1 + Math.round(1 + Math.sin(x * 0.31 + t * 0.21));
    ctx.fillStyle = L7; ctx.fillRect(x, wl - 1, 1, 1);
    ctx.fillStyle = L5; ctx.fillRect(x, wl, 1, w);
    if ((x + Math.floor(t / 3)) % 7 === 0) { ctx.fillStyle = L6; ctx.fillRect(x, wl - 2, 1, 1); }
  }
  // drops flung up along the rim
  const n = Math.round((xb - xa) / 9 * k);
  for (let i = 0; i < n; i++) {
    const x0 = xa + hsh(i * 3.1 + xa) * (xb - xa), ph = ((t * 0.9 + hsh(i * 1.7 + xa) * 40) % 40) / 40;
    const h = 3 + hsh(i * 7.3) * 7, y = wl - 1 - Math.sin(ph * Math.PI) * h, x = x0 + ph * (i % 2 ? 3 : -3);
    ctx.fillStyle = ph < 0.5 ? L6 : L4; ctx.fillRect(Math.round(x), Math.round(y), 1, ph < 0.3 ? 2 : 1);
  }
}

// phase 2 / steam: the gill louvres heat up (red, orange, white-hot) and steam puffs out of them
function drawGills(e, P, ox, oy) {
  const h = P.heat;
  if (h <= 0.02) return;
  const hot = h > 0.85 && G.t % 6 < 3;
  const outer = h > 0.6 ? L3C : h > 0.3 ? L2 : L1, inner = h > 0.85 ? (hot ? L6 : L5) : h > 0.6 ? L4 : h > 0.3 ? L3C : L2;
  for (let i = 0; i < GILLS.length; i++) {
    const y0 = Math.ceil(gillY0(i) + (1 - h) * 22), y1 = Math.floor(gillY1(i)) - 1;
    for (let y = y0; y < y1; y++) { const x = Math.round(gillX(i, y) + ox); ctx.fillStyle = outer; ctx.fillRect(x + 1, y + oy, 1, 1); ctx.fillStyle = y > y0 + 2 ? inner : outer; ctx.fillRect(x, y + oy, 1, 1); }
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(332 + ox, 204 + oy, 18 + h * 14, '#ff3a08', 0.12 + h * 0.28);
  ctx.restore();
}

// rock spit: glow leaking out between the shut lips
function drawLeak(P, ox, oy) {
  if (!P.leak) return;
  const on = P.leak > 0.6 && G.t % 4 < 2;
  for (let x = FX + 3; x < NX - 2; x++) {
    const q = mk(x), w = Math.sin(Math.PI * q) * P.leak;
    if (w < 0.25) continue;
    ctx.fillStyle = w > 0.7 ? (on ? L7 : L6) : w > 0.45 ? L5 : L3C;
    ctx.fillRect(x + ox, Math.round(lipUp(x)) + oy, 1, 1);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(268 + ox, 201 + oy, 14 + P.leak * 16, '#ff7a20', 0.12 + P.leak * 0.2);
  ctx.restore();
}

// the landing marks of rocks and lava drops: a red ring on the ground blinking, a ! above head height
function drawMarks(e) {
  for (const m of e.marks) {
    const x = Math.round(m.x), gy = Math.round(groundAt(m.x)), late = m.left != null && m.left < 26;
    const on = Math.floor(m.t / (late ? 3 : 6)) % 2 === 0, c = on ? '#ff3b30' : '#ffe066';
    // a glowing red pool on the ground, a bold ring around it
    ctx.fillStyle = on ? 'rgba(255,59,48,0.35)' : 'rgba(255,200,60,0.25)'; ctx.beginPath(); ctx.ellipse(x, gy, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
    R(x - 10, gy - 1, 2, 3, c); R(x + 9, gy - 1, 2, 3, c); R(x - 8, gy - 3, 17, 2, c); R(x - 8, gy + 2, 17, 2, c);
    R(x - 1, gy - 1, 3, 2, on ? '#ffffff' : c);
    // the ! sign above head height, always there (it blinks red and yellow)
    RO(x - 3, gy - 52, 7, 12, on ? '#ff3b30' : '#e8a020'); R(x - 1, gy - 50, 3, 5, '#ffffff'); R(x - 1, gy - 44, 3, 2, '#ffffff');
    for (let y = gy - 38; y < gy - 6; y += 5) R(x, y, 1, 2, on ? 'rgba(255,90,70,0.8)' : 'rgba(255,224,102,0.5)');
    // the shadow of what is coming grows as it falls
    const k = m.k || 0;
    if (k > 0) { ctx.fillStyle = 'rgba(20,10,10,' + (0.25 + k * 0.4).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(x, gy, 3 + k * 6, 1 + k * 1.5, 0, 0, Math.PI * 2); ctx.fill(); }
  }
}

// bubbles and a growing glow where it will breach (the tell), and the wake of the fin
function drawLakeFx(e, P, wl) {
  if (e.state === 'dive' && e.st >= DV_GLIDE && e.st < DV_BREACH) {
    const r = e.st - DV_GLIDE, k = r / (DV_BREACH - DV_GLIDE), x = Math.round(e.bx);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(x, wl, 14 + k * 40, '#ff8a20', 0.2 + k * 0.5);
    glow(x, wl - 2, 6 + k * 16, '#fff0a0', 0.15 + k * 0.5);
    ctx.restore();
    pell(x, wl + 1, 8 + k * 26, 1 + k * 2, k > 0.7 && G.t % 6 < 3 ? L7 : L5);
    for (let i = 0; i < 6 + k * 10; i++) {
      const ph = ((G.t * 0.7 + hsh(i * 3.3) * 30) % 30) / 30, bx = x + (hsh(i * 7.1) - 0.5) * (16 + k * 44), by = wl - ph * (4 + k * 8);
      const rr = Math.round(1 + hsh(i * 1.9) * 2 * (0.5 + k));
      disc(bx, by, rr, ph > 0.8 ? L7 : L5); if (rr > 1) disc(bx - 0.5, by - 0.5, rr - 1, L4);
    }
  }
  if (P.under && P.mode === 'normal') {
    // the fin's glowing wake
    const fx = Math.round(e.x - AX + P.dx + 412);
    for (let i = 0; i < 18; i++) { const x = fx + 4 + i * 3, w = Math.max(1, 3 - (i >> 2)); ctx.fillStyle = i < 4 ? L7 : i < 10 ? L6 : L4; ctx.fillRect(x, wl - (i % 2), w, 1); }
  }
}

function drawWhale(e) {
  const P = e.P || pose(e), wh = e.hitT > 2 && e.state !== 'dying', t = G.t;
  const wl = e.y - AY + LY;                       // the lava surface (world y)
  drawMarks(e);
  drawLakeFx(e, P, wl);
  ctx.save();
  ctx.beginPath(); ctx.rect(G.cam.x - 20, -60, W + 40, wl + 60.5); ctx.clip();
  if (P.mode === 'breach') {
    const sp = ART.breach[P.rot - 1];
    part(sp, P.bx, P.by, wh);
    ctx.restore();
    rimAt(sp, P.bx, P.by, wl, t, 1.4);
    return;
  }
  const ox = Math.round(e.x - AX + P.dx), oy = Math.round(e.y - AY + P.dy);
  const off = [[0, P.seg[0]], [0, P.seg[1]], [0, P.seg[2]]];
  const lf = Math.floor(t / 5) % LAVAF, lavaOn = !e.cool;
  part(ART.tail[P.tail], ox, oy + off[2][1] + 2, wh);
  part(ART.dorsal2, ox, oy + off[2][1], wh);
  part(ART.b2, ox, oy + off[2][1], wh);
  if (lavaOn) part(ART.lava2[lf], ox, oy + off[2][1]);
  part(ART.dorsal, ox, oy + off[1][1], wh);
  part(ART.b1, ox, oy + off[1][1], wh);
  if (lavaOn) part(ART.lava1[lf], ox, oy + off[1][1]);
  if (e.ph2) drawHoles(e, ox, oy, off);
  drawMouth(e, P, ox, oy);
  part(ART.jaw[clamp(Math.round(P.jaw * (JAWN - 1)), 0, JAWN - 1)], ox, oy, wh);
  part(ART.head, ox, oy, wh);
  drawLeak(P, ox, oy);
  // chewing on the hero: their legs kick out between the lips (it is all a big joke)
  if (e.held && e.held.t >= 12 && e.held.t < 58) {
    const hc = HEROES[G.hero] || {}, pa = hc.pants || '#33467d', pd = hc.pantsD || '#243258';
    const k = Math.floor(e.held.t / 5) % 2, bx = FX + ox + 2, by = Math.round(lipUp(FX + 4)) + oy;
    const leg = (y, up) => {
      // trouser leg out of the mouth, then a boot with its sole facing out
      R(bx - 9, y - 1, 11, 5, OUT); R(bx - 8, y, 10, 3, pa); R(bx - 8, y + 2, 10, 1, pd);
      R(bx - 15, y - 3 - up, 7, 8, OUT); R(bx - 14, y - 2 - up, 5, 6, BOOT); R(bx - 14, y - 2 - up, 5, 1, BOOTL); R(bx - 15, y - 2 - up, 1, 6, SOLE); R(bx - 14, y + 3 - up, 5, 1, BOOTD);
    };
    leg(by - 4, k); leg(by + 1, 1 - k);
  }
  if (P.cheek > 0.5) part(ART.cheek[clamp(Math.round(P.cheek) - 1, 0, 2)], ox, oy, wh);
  drawGills(e, P, ox, oy);
  part(ART.pec[P.pec], ox, oy + off[1][1], wh);
  drawLamps(e, P, ox, oy, off);
  drawEye(e, P, ox, oy);
  // glints running along the armour's top edge
  if (!e.cool) for (const [x, y, k] of [[262, 158, 0], [330, 148, 9], [404, 92, 17]]) {
    const s = [1, 2, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0][((t >> 2) + k) % 12];
    if (s) { const gx = x + ox, gy = y + oy + (x > 380 ? off[1][1] : 0); ctx.fillStyle = '#fff6dc'; ctx.fillRect(gx - s, gy, s * 2 + 1, 1); ctx.fillRect(gx, gy - s, 1, s * 2 + 1); }
  }
  ctx.restore();
  // the rims where it cuts the lava
  const jw = ART.jaw[clamp(Math.round(P.jaw * (JAWN - 1)), 0, JAWN - 1)];
  rimAt(jw, ox, oy, wl, t, 0.6);
  rimAt(ART.head, ox, oy, wl, t);
  rimAt(ART.b1, ox, oy + off[1][1], wl, t);
  rimAt(ART.b2, ox, oy + off[2][1], wl, t);
  rimAt(ART.pec[P.pec], ox, oy + off[1][1], wl, t, 0.5);
  rimAt(ART.tail[P.tail], ox, oy + off[2][1] + 2, wl, t, 0.5);
  if (P.under) { rimAt(ART.dorsal, ox, oy + off[1][1], wl, t, 1); rimAt(ART.dorsal2, ox, oy + off[2][1], wl, t, 0.6); }
}

// phase 2: the holes where plates popped off glow and spark
function drawHoles(e, ox, oy, off) {
  HOLES.forEach(([sg], i) => part(ART.holes[i], ox, oy + off[sg][1]));
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [sg, cx, cy] of HOLES) glow(cx + ox, cy + oy + off[sg][1], 10 + Math.sin(G.t * 0.1 + cx) * 2, '#ff5010', 0.3);
  ctx.restore();
  for (const [sg, cx, cy, rx] of HOLES) {
    const x = cx + ox, y = cy + oy + off[sg][1];
    if ((G.t + cx * 3) % 46 < 4) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - rx + 2 + (G.t % 3), y - 3, 2, 1); ctx.fillStyle = L6; ctx.fillRect(x - rx + 1, y - 4 - (G.t % 2), 1, 1); }
  }
}

// ============================================================
// In front of the hero (an enemy projectile that draws after him, like the bear's beam): comic words, the vacuum's
// air streams, the steam jets, the DUCK! hint
// ============================================================
function arrow(x, y, col) {
  for (const [o, c] of [[1, OUT], [0, col]]) { for (let j = 0; j < 4; j++) R(x - j + o, y + 6 - j + o, j * 2 + 1, 1, c); R(x - 1 + o, y + o, 3, 3, c); }
}
function drawWords(e) {
  for (const w of e.words) {
    const k = w.t / w.max, j = w.shake ? Math.round((hsh(Math.floor(G.t / 3) * 0.7 + w.x) - 0.5) * 2) : 0;
    const pop = w.max - w.t < 6 ? 1 + (6 - (w.max - w.t)) * 0.0 : 1;
    if (k < 0.15 && G.t % 4 < 2) continue;
    text(w.s, Math.round(w.x) + j, Math.round(w.y - (1 - k) * w.rise) + j, w.c, w.sc * pop, 'center', w.sh || '#3a1200');
  }
}
// air (and sparks, pebbles, a lava ribbon) streaming into the open mouth while it sucks
function drawVacuum(e, P) {
  const st = e.st, suck = e.ph2 ? VSUCK2 : VSUCK, end = VTELL + suck;
  if (e.state !== 'vac' || e.held || st < VTELL - 6 || st > end + 6) return;
  const k = clamp(Math.min(st - VTELL + 6, end + 6 - st) / 14, 0, 1);
  const tx = (P.throat ? P.throat[0] : e.x - AX + THROAT[0]), ty = (P.throat ? P.throat[1] : e.y - AY + THROAT[1]);
  const mx = mouthFront(e, P), L = G.cam.x;
  for (let i = 0; i < 34; i++) {
    const y0 = 120 + hsh(i * 3.3) * 112, x0 = L + 4 + hsh(i * 7.1) * 150, bend = (hsh(i * 1.9) - 0.5) * 50, ph = hsh(i * 5.5), len = 0.12 + hsh(i * 2.2) * 0.12;
    const head = (G.t * 0.017 + ph) % 1, tail = Math.max(0, head - len);
    for (let q = tail; q < head; q += 0.012) {
      const a = (1 - q) * (1 - q), b = 2 * (1 - q) * q, c = q * q, x = a * x0 + b * ((x0 + tx) / 2) + c * tx, y = a * y0 + b * ((y0 + ty) / 2 + bend) + c * ty;
      if (x > mx + 4) break;
      const f = (q - tail) / (head - tail);
      ctx.fillStyle = 'rgba(255,238,210,' + ((0.2 + f * 0.7) * k).toFixed(2) + ')';
      ctx.fillRect(Math.round(x), Math.round(y), f > 0.7 ? 2 : 1, 1);
    }
  }
  // embers and grit riding the stream
  for (let i = 0; i < 16; i++) {
    const ph = ((G.t * 0.022 + hsh(i * 9.7)) % 1), x0 = L + 30 + hsh(i * 4.1) * 180, y0 = 200 + hsh(i * 6.3) * 30;
    const x = lerp(x0, tx, ph * ph), y = lerp(y0, ty, ph) - Math.sin(ph * Math.PI) * 14;
    if (x > mx + 2) continue;
    ctx.fillStyle = i % 3 === 0 ? K5 : [L5, L7, L4][i % 3]; ctx.fillRect(Math.round(x), Math.round(y), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
  }
  // a ribbon of lava drawn up off the lake over the lower lip
  const lx = e.x - AX + 250 + P.dx, ly = e.y - AY + LY;
  for (let q = 0; q <= 1; q += 0.04) {
    const x = lx + 8 * q + 2 * Math.sin(q * 6 + G.t * 0.2), y = ly + 1 - 28 * q * k;
    const r = Math.round(2.5 - 1.8 * q);
    disc(x, y, r, L4); if (r > 0) disc(x - 0.5, y, r - 1 < 0 ? 0 : r - 1, L6);
  }
  pell(lx, ly + 1, 9 * k + 2, 2, L5);
}
// the gill steam jets: a billowing burst out of the gills that rolls forward along the cheek, then a jet of
// boiling steam puffs straight across the ledge at standing height (the danger band is the bright core)
// a pixel-art steam puff: shadow, body and a lit top-left, fading out (k = 1 new .. 0 gone)
function steamPuff(x, y, r, k) {
  if (r < 1 || k <= 0) return;
  disc(x + 1, y + 1, r, rgba(STEAMD, 0.55 * k));
  disc(x, y, r, rgba(STEAM, 0.7 * k));
  if (r > 1) disc(x - Math.ceil(r / 3), y - Math.ceil(r / 3), Math.max(1, Math.round(r * 0.5)), rgba('#ffffff', 0.75 * k));
}
function drawJet(e, P) {
  const j = e.jet;
  if (!j) return;
  const y = j.y, x1 = j.x1, x0 = j.x0, a = 1 - (j.fade || 0), t = G.t;
  const gx = e.x - AX + 334 + P.dx, gy = e.y - AY + 204 + P.dy;
  // the burst out of the gills, rolling forward along the cheek into the jet
  for (let i = 0; i < 16; i++) {
    const q = ((i / 16) + t * 0.035) % 1, x = lerp(gx, x1 - 4, q), yy = lerp(gy + (hsh(i * 3.1) - 0.5) * 18, y, q * q);
    const r = Math.round(5 + hsh(i * 7.7) * 4 - q * 2);
    steamPuff(x, yy, r, 0.6 * a);
  }
  // the jet: a soft band (the danger height), then puffs racing left with the boil and streaks
  const L = Math.round(x1 - x0);
  if (L > 0) {
    ctx.fillStyle = rgba(STEAMD, 0.28 * a); ctx.fillRect(Math.round(x0), y - 6, L, 12);
    ctx.fillStyle = rgba(STEAM, 0.5 * a); ctx.fillRect(Math.round(x0), y - 3, L, 6);
    ctx.fillStyle = rgba('#ffffff', 0.65 * a); ctx.fillRect(Math.round(x0), y - 1, L, 2);
    for (let i = 0; i < 40; i++) {
      const u = ((hsh(i * 3.7) * 400 - t * (5 + hsh(i) * 3)) % 400 + 400) % 400, x = x1 - u;
      if (x < x0) continue;
      const r = Math.round(3 + hsh(i * 5.3) * 4), dy = Math.round((hsh(i * 9.1) - 0.5) * 7 + Math.sin(t * 0.3 + i) * 1.5);
      steamPuff(x, y + dy, r, 0.75 * a);
    }
    for (let x = x1 - ((t * 11) % 22); x > x0; x -= 22) { ctx.fillStyle = rgba('#ffffff', 0.9 * a); ctx.fillRect(Math.round(x) - 9, y - 2, 9, 1); ctx.fillRect(Math.round(x) - 15, y + 2, 7, 1); }
    // the tip as it shoots out
    if (x0 > G.cam.x - 4 && !j.fade) { disc(x0, y, 7, rgba(STEAM, 0.75)); disc(x0 - 1, y - 1, 5, rgba('#ffffff', 0.85)); }
  }
}
// a left arrow (pixel) for the vacuum hint
function larrow(x, y, col) {
  for (const [o, c] of [[1, OUT], [0, col]]) { for (let j = 0; j < 4; j++) R(x + j + o, y - j + o, 1, j * 2 + 1, c); R(x + 4 + o, y - 1 + o, 4, 3, c); }
}
function drawHint(e) {
  const p = G.p;
  // vacuum: RUN! and an arrow pointing away from the mouth (stepVac counts e.runK): steady at first, then
  // blinking; fast red-yellow while the hero teeters at the lip
  const k = e.runK || 0;
  if (p && !p.dead && e.state === 'vac' && !e.held && k > 0) {
    const tt = e.teeter > 0, on = tt ? G.t % 6 < 4 : k < 24 || (k >> 3) % 2 === 0;
    if (on) {
      const x = Math.round(p.x), top = Math.round(p.y) - 34, c = tt && G.t % 12 < 6 ? '#ff6a50' : '#ffe066';
      text('RUN!', x + 2, top - 18, c, 1, 'center');
      larrow(x - 5, top - 6, c);
    }
    return;
  }
  if (!p || p.dead || !(e.state === 'steam' && e.st >= 6 && e.st < ST_END - 6)) return;
  if (Math.floor(G.t / 6) % 3 === 0 && e.st < ST_FIRE) return;
  const x = Math.round(p.x), top = Math.round(p.y) - (p.crouch ? 26 : 34);
  const c = e.st >= ST_FIRE - 16 ? (G.t % 6 < 3 ? '#ffffff' : '#86f3ff') : '#86f3ff';
  text('DUCK!', x, top - 18, c, 1, 'center');
  arrow(x, top - 9, c);
}
function drawFront(e) {
  const P = e.P || pose(e);
  drawVacuum(e, P);
  drawJet(e, P);
  drawHint(e);
  // steam puffs and smoke the whale breathes out (its own little particles)
  for (const f of e.fx) {
    const k = f.t / f.max;
    if (f.kind === 'steam') steamPuff(f.x, f.y, Math.round(f.r * (1.6 - k * 0.7)), k * 0.85);
    else if (f.kind === 'smoke') { disc(f.x, f.y, Math.round(f.r * (1.5 - k * 0.6)), rgba('#2a2228', 0.6 * k)); disc(f.x - 1, f.y - 1, Math.max(1, Math.round(f.r * (0.8 - k * 0.3))), rgba('#4a3e44', 0.5 * k)); }
    else if (f.kind === 'ring') { ctx.strokeStyle = rgba(f.c || '#ffffff', 0.8 * k); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x - (1 - k) * f.vx * 20, f.y, 6 + (1 - k) * 26, 4 + (1 - k) * 16, 0, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); }
    else if (f.kind === 'bubble') { disc(f.x, f.y, f.r, L5); if (f.r > 1) disc(f.x - 0.5, f.y - 0.5, f.r - 1, L6); }
  }
  // the rock that jams the fan (death)
  if (e.jamRock) { const r = e.jamRock; ctx.save(); ctx.translate(Math.round(r.x), Math.round(r.y)); ctx.rotate(Math.round(r.a / (Math.PI / 2)) * (Math.PI / 2)); ctx.drawImage(ART.rock.img, ART.rock.x0, ART.rock.y0); ctx.restore(); }
  drawWords(e);
}

// ============================================================
// Sounds
// ============================================================
const sfx = {
  whir() { Snd.tone('square', 110, 880, 1.0, 0.035); Snd.tone('sine', 60, 260, 1.0, 0.1); },
  slurp() { Snd.noise(2.6, 0.16, 1100); Snd.tone('sawtooth', 80, 240, 2.4, 0.05); Snd.tone('triangle', 400, 1300, 2.2, 0.03); },
  chomp() { Snd.tone('square', 200, 60, 0.12, 0.2); Snd.noise(0.12, 0.28, 900); },
  gulp() { Snd.tone('sine', 320, 90, 0.2, 0.25); Snd.tone('sine', 260, 70, 0.2, 0.2, 0.22); },
  ptoo() { Snd.tone('square', 900, 180, 0.12, 0.12); Snd.noise(0.14, 0.22, 2600); },
  burp(big) { const n = big ? 8 : 5; for (let i = 0; i < n; i++) Snd.tone('sawtooth', 120 - i * 7, 78 - i * 4, 0.14, 0.22, i * 0.1); Snd.noise(big ? 1.1 : 0.6, 0.2, 380); },
  thump() { Snd.tone('sine', 110, 40, 0.35, 0.35); Snd.noise(0.3, 0.25, 500); },
  splash(v = 1) { Snd.noise(0.5, 0.25 * v, 1800); Snd.tone('sine', 140, 50, 0.4, 0.2 * v); },
  roar() { Snd.noise(1.3, 0.38, 600); Snd.tone('sawtooth', 150, 52, 1.2, 0.2); Snd.tone('square', 95, 40, 1.1, 0.08); Snd.tone('sawtooth', 220, 90, 0.6, 0.05, 0.1); },
  hiss() { Snd.noise(0.9, 0.12, 7000); Snd.tone('sine', 1200, 1500, 0.8, 0.02); },
  jet() { Snd.noise(0.9, 0.3, 5200); Snd.tone('sawtooth', 210, 180, 0.8, 0.04); },
  rumble() { Snd.noise(0.6, 0.3, 220); Snd.tone('sine', 55, 30, 0.6, 0.25); },
  clunk() { Snd.tone('square', 230, 80, 0.15, 0.25); Snd.tone('square', 160, 60, 0.22, 0.2, 0.09); Snd.noise(0.35, 0.3, 1200); },
  tink(i) { Snd.tone('triangle', 1500 - i * 25, 600, 0.06, 0.05); },
  crack() { [1500, 1100, 800].forEach((f, i) => Snd.tone('square', f, f * 0.45, 0.1, 0.09, i * 0.05)); Snd.noise(0.35, 0.4, 3500); },
  bubble() { Snd.tone('sine', 220, 520, 0.08, 0.05); },
  rise() { Snd.tone('sawtooth', 60, 180, 0.6, 0.1); Snd.noise(0.6, 0.15, 700); }
};

// ============================================================
// Behaviour
// ============================================================
function word(e, s, x, y, c, sc = 2, t = 50, o = {}) { e.words.push(Object.assign({ s, x, y, c, sc, t, max: t, rise: 10, shake: true }, o)); }
function puff(e, kind, x, y, vx, vy, r, t) { if (e.fx.length < 90) e.fx.push({ kind, x, y, vx, vy, r, t, max: t }); }
const alive = m => !m.dead && !m.dying && m.state !== 'dying';
const minions = e => e.pups.filter(alive).length;
function go(e, s) { e.state = s; e.st = 0; e.runK = 0; e.teeter = 0; }
function toIdle(e) {
  if (!e.ph2 && e.hp < e.max / 2) { go(e, 'phase2'); e.inv = true; return; }
  go(e, 'idle');
  // a breather between attacks (about 2.5 s, 2 s in phase 2; tuning, was 2 / 1.5 s): longer while its helpers buzz
  // about, and after a hit
  // (retune: about 3.5 / 3 s, was 112-128 / 140-160 frames)
  e.rest = Math.round(e.ph2 ? rand(170, 186) : rand(200, 220)) + (minions(e) ? 30 : 0) + (G.p.inv > 0 || G.p.dead ? 40 : 0);
}
function nextAttack(e) {
  // (retune: the 2nd vacuum of each cycle comes later, so a phase usually has one; was
  //  ph2 steam,vac,spit,dive,roar,vac,spit,steam,dive / ph1 vac,spit,dive,vac,roar,spit,dive)
  const seq = e.ph2 ? ['steam', 'vac', 'spit', 'dive', 'roar', 'spit', 'steam', 'vac', 'dive'] : ['vac', 'spit', 'dive', 'roar', 'spit', 'vac', 'dive'];
  let a = seq[e.atk % seq.length];
  e.atk++;
  if (a === 'roar' && (minions(e) > 0 || e.roars >= (e.ph2 ? 2 : 1) || (e.ph2 && e.roarPh2))) a = e.ph2 ? 'spit' : 'vac';
  if (a === 'roar' && e.ph2) e.roarPh2 = true;
  if (a === 'steam' && minions(e) > 1) a = 'spit';
  return a;
}

// the hero's world position helpers
const throatAt = (e, P) => P && P.throat ? P.throat : [e.x - AX + THROAT[0] + (P ? P.dx : 0), e.y - AY + THROAT[1] + (P ? P.dy : 0)];
const catchX = e => e.ax + 214;

function stepIntro(e) {
  const st = e.st;
  if (st === 1) { sfx.rumble(); G.shake = Math.max(G.shake, 3); }
  if (st % 20 === 10 && st < 90) { sfx.bubble(); for (let i = 0; i < 3; i++) puff(e, 'bubble', e.x + 80 - st + rand(-10, 10), LY - 1, 0, -0.2, 1 + (rand(0, 1) < 0.4 ? 1 : 0), 20); }
  if (st === 92) { sfx.rise(); sfx.splash(1.4); splash(e, e.x - 60, 26); splash(e, e.x + 40, 20); G.shake = Math.max(G.shake, 7); }
  if (st === 140) { sfx.roar(); G.shake = Math.max(G.shake, 8); word(e, 'ROOOAR!', mouthFront(e) + 20, 150, '#ffe066', 2, 60); say('Mega whale shark!', 0.6, 0.9); for (let i = 0; i < 4; i++) e.later.push({ t: i * 9, f: () => ring(e) }); }
  if (st >= 196) { e.inv = false; toIdle(e); e.rest = 50; }
}
function ring(e) { const P = e.P; puff(e, 'ring', mouthFront(e, P) - 2, e.y - AY + 212 + (P ? P.dy : 0), 1, 0, 0, 30); }
function splash(e, x, n) {
  for (let i = 0; i < n; i++) G.parts.push({ type: 'spark', x: x + rand(-14, 14), y: LY - 1, vx: rand(-2.2, 2.2), vy: rand(-5.5, -1.5), g: 0.2, life: rand(22, 40), max: 40, size: rand(1, 3) | 0, c: i % 3 ? L5 : L7 });
  for (let i = 0; i < n / 3; i++) G.parts.push({ type: 'fire', x: x + rand(-12, 12), y: LY - 3, vx: rand(-0.6, 0.6), vy: rand(-1.6, -0.4), life: rand(14, 26), max: 26, size: rand(2, 4) });
}

function stepIdle(e) {
  if (!e.ph2 && e.hp < e.max / 2) { go(e, 'phase2'); e.inv = true; return; }
  // one danger at a time (retune): the next attack waits while a bee's warning or dive is on (L3.beeBusy, level3_bees.js)
  if (e.st >= e.rest && !(typeof L3 !== 'undefined' && typeof L3.beeBusy === 'function' && L3.beeBusy())) { const a = nextAttack(e); go(e, a); }
}

// VACUUM. Warning: the mouth gapes, the throat glows white and the fan spins up (VTELL). Then it pulls.
function stepVac(e, P) {
  const st = e.st, p = G.p, suck = e.ph2 ? VSUCK2 : VSUCK, end = VTELL + suck;
  if (e.held) { stepHeld(e, P); return; }
  if (st === 1) { sfx.whir(); e.runK = 0; e.teeter = 0; }
  e.fanV = kf(st, [[0, 0.05], [VTELL, 0.55], [end, 0.55], [end + 20, 0.05]]);
  if (st === VTELL) { sfx.slurp(); word(e, 'SLUUURP!', mouthFront(e, P) - 30, 132, '#ffe066', 2, suck, { rise: 0 }); }
  // RUN! (drawHint): from VRUN frames into the warning for a hero near the ledge's edge (the last ~70 px), and all
  // through the pull for one who isn't far away yet. e.runK = frames it has been showing.
  const free = p && !p.dead && !p.ride;
  const run = free && st < end && ((st >= VRUN && p.x > e.ax + RUN_NEAR) || (st >= VTELL && p.x > e.ax + RUN_FAR));
  e.runK = run ? (e.runK || 0) + 1 : 0;
  if (st >= VTELL && st < end) {
    const th = throatAt(e, P), mx = mouthFront(e, P), ramp = clamp((st - VTELL) / VRAMP, 0, 1);
    // the hero: a gentle pull toward the mouth, a little stronger close to it (walking away beats it)
    if (free && p.x < mx + 40) {
      const near = clamp(1 - (catchX(e) - p.x) / 214, 0, 1), cx = catchX(e);
      p.x += (e.ph2 ? 1.1 : 0.8) * (0.72 + 0.5 * near) * ramp * (e.teeter ? 0.5 : 1);
      if (p.onGround && st % 6 === 0) G.parts.push({ type: 'dust', x: p.x - 4, y: p.y, vx: 0.6, vy: -0.2, life: 14, max: 14, size: 2 });
      // at the lip the hero teeters on the edge for TEETER frames (a weaker pull), then it is caught. Stepping
      // back stops the count, so walking away gets out even on the last teeter frame.
      if (p.x >= cx - 2.5 && p.y > e.y - AY + 150 && p.vx > -0.5) {
        if (!e.teeter) word(e, 'WHOA!', p.x + 28, p.y - 40, '#ffffff', 1, 34, { sh: '#000000', rise: 4 });
        e.teeter++;
        p.x = cx - [0, 1, 2, 1][(e.teeter >> 1) & 3];
        if (e.teeter % 4 === 1) G.parts.push({ type: 'spark', x: e.ax + 219 + rand(-2, 1), y: groundAt(e.ax + 218) - 1, vx: rand(0.2, 0.9), vy: rand(-1.2, -0.2), g: 0.2, life: 22, max: 22, size: 2, c: rand(0, 1) < 0.5 ? K5 : K4 });
        if (e.teeter >= TEETER) catchHero(e, P);
      } else if (e.teeter) e.teeter = Math.max(0, e.teeter - 1);
    }
    // grenades are sucked in too
    for (const g of G.grenades) {
      if (g.x < G.cam.x || g.x > mx + 30) continue;
      const dx = th[0] - g.x, dy = th[1] - g.y, d = Math.hypot(dx, dy) || 1;
      g.vx += dx / d * 0.16 * ramp; g.vy += dy / d * 0.16 * ramp - 0.06;
    }
    if (st % 3 === 0) { const y = rand(150, 232); G.parts.push({ type: 'spark', x: G.cam.x + rand(10, 200), y, vx: rand(2.5, 4), vy: (th[1] - y) / 60, life: 30, max: 30, size: 1, c: rand(0, 1) < 0.5 ? L5 : '#fff1c9' }); }
  }
  // a grenade that flies into the wide-open mouth goes down the throat: BURP! (a big hit)
  if (P.jaw > 0.6) {
    // while it sucks, anything near the mouth is pulled in (a generous window); otherwise it must fly into the maw
    const sucking = st >= VTELL && st < end, mx = mouthFront(e, P), top = sucking ? e.y - AY + 160 : e.y - AY + P.dy + lipUp(250) - 4;
    for (const g of G.grenades) if (g.x > mx - 8 && g.x < mx + 40 && g.y > top && g.y < LY) { swallow(e, g); return; }
  }
  if (st >= end + 26) toIdle(e);
}
function catchHero(e, P) {
  const p = G.p;
  e.held = { t: 0, x0: p.x, y0: p.y, hurt: p.inv <= 0, inv: p.inv };
  p.fireCd = Math.max(p.fireCd, 12);   // no shot on the way in either
  e.words = e.words.filter(w => w.s !== 'SLUUURP!');
  sfx.chomp();
}
// caught: sucked in, CHOMP, chewed, PTOO! spat back onto the ledge with one hit
function stepHeld(e, P) {
  const h = e.held, p = G.p;
  h.t++;
  e.fanV = 0.3;
  if (!p || p.dead) { e.held = null; toIdle(e); return; }
  const th = throatAt(e, P);
  if (h.t < 10) {
    // whisked across the gap into the mouth, gone once past the lips
    const k = sstep(h.t / 10);
    p.x = lerp(h.x0, th[0] - 2, k); p.y = lerp(h.y0, th[1] + 12, k) - Math.sin(k * Math.PI) * 10;
    if (p.x > mouthFront(e, P) + 2) p.hidden = true;
    if (h.t % 2 === 0) G.parts.push({ type: 'spark', x: p.x - 6, y: p.y - 16, vx: -1, vy: 0, life: 8, max: 8, size: 1, c: '#ffffff' });
  } else if (h.t < 60) {
    if (h.t === 10) { p.hidden = true; word(e, 'CHOMP!', mouthFront(e, P) - 6, 168, '#ffffff', 2, 40); sfx.gulp(); G.shake = Math.max(G.shake, 4); }
    p.x = th[0]; p.y = th[1] + 12;
    if (h.t % 12 === 6) Snd.tone('square', 160, 90, 0.07, 0.08);
  }
  if (h.t < 60) {
    // no shooting from inside (fireCd above every weapon's tap cooldown: the shotgun's is 10)
    p.vy = 0; p.vx = 0; p.onGround = false; p.inv = Math.max(p.inv, 2); p.fireCd = Math.max(p.fireCd, 12); p.kb = 0;
    // no throwing grenades from inside: give them back
    G.grenades = G.grenades.filter(g => { if (g.t === 0 && Math.abs(g.x - p.x) < 12) { p.bombs++; return false; } return true; });
  }
  if (h.t === 60) {
    // PTOO! out in a high arc back onto the ledge. The hit comes when the hero lands (so a last heart is lost on
    // the ledge, never inside the snout) and he stays in sight all the way (no blinking in the air)
    p.hidden = false;
    p.kb = 0;
    sfx.ptoo(); word(e, 'PTOO!', mouthFront(e, P) - 10, 160, '#ffe066', 2, 46);
    const x0 = th[0] - 6, y0 = th[1] + 8, tx = clamp(e.ax + 70 + rand(0, 40), e.ax + 30, e.ax + 150), T = 44, g = 0.26;
    h.arc = { x0, y0, vx: (tx - x0) / T, vy: (groundAt(tx) - y0 - g * T * (T - 1) / 2) / T, g, T, n: 0 };
    p.facing = 1;
    for (let i = 0; i < 8; i++) G.parts.push({ type: 'spark', x: x0, y: y0, vx: rand(-3, -0.5), vy: rand(-2, 1), g: 0.15, life: 20, max: 20, size: 2, c: i % 2 ? '#ffffff' : L6 });
  }
  if (h.arc && !p.dead) {
    const a = h.arc;
    a.n++;
    const n = Math.min(a.n, a.T);
    p.x = a.x0 + a.vx * n; p.y = a.y0 + a.vy * n + a.g * n * (n - 1) / 2; p.vy = a.vy + a.g * n; p.onGround = false; p.kb = 0;
    // safe and visible in flight (inv 2 never blinks), no shots until clear of the mouth
    p.inv = 2;
    if (p.x > mouthFront(e, P) - 8) p.fireCd = Math.max(p.fireCd, 12);
    if (a.n >= a.T) {
      p.y = groundAt(p.x); p.vy = 0; p.onGround = true;
      G.parts.push({ type: 'dust', x: p.x, y: p.y, vx: -0.5, vy: -0.3, life: 20, max: 20, size: 3 });
      e.held = null; go(e, 'vac'); e.st = (e.ph2 ? VSUCK2 : VSUCK) + VTELL + 20;   // the mouth is shut: a rest
      // THUD: the hit (a last heart: the hero falls here, on the ledge), or back to the mercy time it had
      p.inv = 0;
      if (h.hurt) hurtPlayer(); else p.inv = h.inv;
    }
  }
}
function swallow(e, g) {
  G.grenades = G.grenades.filter(x => x !== g);
  e.words = e.words.filter(w => w.s !== 'SLUUURP!');
  sfx.chomp();
  go(e, 'burp');
  e.burpDmg = 30;
}
// a grenade went down the throat: cheeks puff, a muffled boom inside, then BURP! (a big hit)
function stepBurp(e, P) {
  const st = e.st;
  e.fanV = st < 14 ? 0.4 : 0.02;
  if (st === 14) {
    sfx.thump(); G.shake = Math.max(G.shake, 6);
    if (e.burpDmg) { damageEnemy(e, e.burpDmg); e.burpDmg = 0; }
    if (e.dead || e.dying || e.state === 'dying') return;
  }
  if (st === 44) {
    sfx.burp(false);
    const mx = mouthFront(e, P);
    word(e, 'BURP!', mx - 18, 150, '#8be0a8', 2, 56, { sh: '#103a1a' });
    for (let i = 0; i < 6; i++) puff(e, 'smoke', mx + rand(0, 8), e.y - AY + 206 + rand(-4, 4), rand(-1.6, -0.6), rand(-0.6, 0.1), rand(3, 5), rand(30, 46));
    puff(e, 'ring', mx - 2, e.y - AY + 206, 1, 0, 0, 30);
    for (let i = 0; i < 4; i++) G.parts.push({ type: 'sprite', s: ART.bits[i % 4], x: mx, y: e.y - AY + 206, vx: rand(-3, -1), vy: rand(-4, -2), g: 0.2, rot: 0, vr: rand(-0.3, 0.3), life: 90, max: 90 });
    addScore(1000, mx - 10, e.y - AY + 170);
  }
  if (st >= 90) toIdle(e);
}

// ROCK SPIT. Warning: mouth shut, cheeks bulge, glow leaks out; a red ring + ! where each rock will land.
function stepSpit(e, P) {
  const st = e.st, p = G.p, L = e.ax;
  if (st === 1) sfx.rumble();
  if (st === SP_MARK) {
    const lo = L + 14, hi = L + 210, base = clamp(p && !p.dead ? p.x : L + 120, lo, hi), gap = 58;
    let xs = [base, base - gap, base + gap];
    if (xs[2] > hi) xs = [base, base - gap, base - gap * 2];
    if (xs[1] < lo) xs = [base, base + gap, base + gap * 2];
    xs = xs.map(x => clamp(x, lo, hi));
    e.marks = e.marks.concat(xs.map((x, i) => ({ x, t: 0, kind: 'rock', i, due: SP_FIRE + SP_T + i * 6 - SP_MARK })));
  }
  if (st === SP_FIRE) {
    sfx.ptoo(); G.shake = Math.max(G.shake, 3);
    const mx = mouthFront(e, P) + 6, my = e.y - AY + 200 + P.dy;
    word(e, 'PTOO!', mx - 16, 150, '#ffe066', 2, 40);
    for (const m of e.marks) {
      if (m.kind !== 'rock' || m.b) continue;
      const T = SP_T + m.i * 6, g = 0.2, gy = groundAt(m.x);
      m.b = { k: 'mwrock', x: mx, y: my, vx: (m.x - mx) / T, vy: (gy - 0.5 - my - g * T * (T - 1) / 2) / T, g, life: 300, t: 0, spin: m.i % 2 ? 1 : -1, mark: m };
      G.eb.push(m.b);
    }
    for (let i = 0; i < 8; i++) G.parts.push({ type: 'spark', x: mx, y: my, vx: rand(-3, -0.5), vy: rand(-2, 1), g: 0.12, life: 18, max: 18, size: 1, c: i % 2 ? L7 : L5 });
  }
  if (st >= 112) toIdle(e);
}

// DIVE AND BREACH
function stepDive(e, P) {
  const st = e.st, p = G.p, L = e.ax;
  if (st === 1) { sfx.splash(0.6); e.bx = clamp((p && !p.dead ? p.x : L + 150) + 80, L + 290, L + 310); }
  if (st === 14) { sfx.splash(1.2); splash(e, e.x - 80, 18); splash(e, e.x - 10, 14); G.shake = Math.max(G.shake, 3); }
  if (st === 24) e.inv = true;
  if (st > DV_SINK && st < DV_GLIDE && st % 16 === 0) sfx.bubble();
  if (st === DV_GLIDE) {
    // the tell: bubbles and a glow where it comes up; the lava drops' landing spots are marked now
    sfx.rumble();
    const lo = L + 14, hi = L + 212, n = e.ph2 ? 4 : 3, base = clamp(p && !p.dead ? p.x : L + 140, lo + 20, hi);
    const xs = [];
    for (let i = 0; i < n; i++) xs.push(clamp(base - 30 + i * (n === 4 ? 46 : 56) - (n === 4 ? 40 : 30), lo, hi));
    if (Math.abs(xs[0] - base) > 8 && !xs.some(x => Math.abs(x - base) < 10)) xs[1] = base;
    e.marks = e.marks.concat(xs.map((x, i) => ({ x, t: 0, kind: 'drop', i, due: DV_BREACH - DV_GLIDE + 36 + i * 4 })));
  }
  if (st > DV_GLIDE && st < DV_BREACH && st % 10 === 0) sfx.bubble();
  if (st === DV_BREACH) {
    e.inv = false;
    sfx.splash(1.6); sfx.roar(); G.shake = Math.max(G.shake, 8);
    splash(e, e.bx, 34);
    word(e, 'SPLOOSH!', e.bx - 70, 92, '#ffb534', 2, 40);
    for (const m of e.marks) {
      if (m.kind !== 'drop' || m.b) continue;
      const T = 36 + m.i * 4, g = 0.22, x0 = e.bx - 10 + m.i * 4, y0 = LY - 6, gy = groundAt(m.x);
      m.b = { k: 'mwdrop', x: x0, y: y0, vx: (m.x - x0) / T, vy: (gy - 0.5 - y0 - g * T * (T - 1) / 2) / T, g, life: 300, t: 0, mark: m };
      G.eb.push(m.b);
    }
  }
  if (st > DV_BREACH && st < DV_UP && p && !p.dead) {
    // touching the breaching whale hurts (only a hero who jumps out over the lava can)
    const r = st - DV_BREACH, top = (P.by || 400) - 120;
    if (r < 30 && overlap(pbox(p), { x: e.bx - 56, y: top, w: 100, h: LY - top })) hurtPlayer();
  }
  if (st === DV_BREACH + 32) e.inv = true;
  if (st === DV_BREACH + 40) { sfx.splash(1.2); splash(e, e.bx + 10, 24); G.shake = Math.max(G.shake, 5); }
  if (st === DV_UP + 4) { sfx.rise(); splash(e, e.x - 50, 16); }
  if (st === DV_UP + 18) e.inv = false;
  if (st >= DV_END) toIdle(e);
}

// GILL STEAM (phase 2). Warning: the gill vents redden (ST_FIRE frames) and DUCK! shows over the hero.
function stepSteam(e, P) {
  const st = e.st, p = G.p;
  if (st === 1 || st === 30) sfx.hiss();
  if (st > 10 && st < ST_FIRE && st % 5 === 0) puff(e, 'steam', e.x - AX + 330 + rand(-12, 12), e.y - AY + 180, rand(-0.2, 0.4), rand(-0.8, -0.4), 2, 26);
  if (st === ST_FIRE) { sfx.jet(); G.shake = Math.max(G.shake, 3); e.jet = { y: e.y - AY + 191, x0: e.x - AX + 236, x1: e.x - AX + 236, t: 0 }; }
  const j = e.jet;
  if (j) {
    j.t++;
    j.x1 = e.x - AX + 236 + P.dx;
    j.x0 = Math.max(G.cam.x - 10, j.x1 - j.t * 26);
    if (st >= ST_END) j.fade = clamp((st - ST_END) / 14, 0, 1);
    // it hurts a standing (or jumping) hero; crouching ducks under it (the band is y-5..y+5, a crouch's top is 198)
    if (!j.fade && p && !p.dead && overlap(pbox(p), { x: j.x0, y: j.y - 5, w: j.x1 - j.x0, h: 10 })) hurtPlayer();
    if (st % 3 === 0) puff(e, 'steam', rand(j.x0, j.x1), j.y + rand(-6, 6), rand(-1.5, -0.5), rand(-0.6, 0.6), 2, 22);
    if (j.fade >= 1) e.jet = null;
  }
  if (st >= ST_END + 30) toIdle(e);
}

// ROAR: calls two helpers (bees, or lava sharks into the lake)
function stepRoar(e, P) {
  const st = e.st;
  if (st === 18) { sfx.roar(); G.shake = Math.max(G.shake, 7); word(e, 'ROOOAR!', mouthFront(e, P) + 14, 140, '#ff9a5a', 2, 54); for (let i = 0; i < 5; i++) e.later.push({ t: i * 9, f: () => ring(e) }); }
  if (st === 32) callHelpers(e);
  if (st >= 100) toIdle(e);
}
function callHelpers(e) {
  e.roars++;
  const sharks = e.ph2 && ENEMY_TYPES.lavashark && e.helpN % 2 === 1;
  e.helpN++;
  for (const i of sharks ? [0, 1] : [1]) {   // (retune: one bee per roar, from the right where the hero looks; was 2)
    const spec = sharks ? { t: 'lavashark', x: e.ax + 300 + i * 110, lava: LV.lava ? LV.lava.length - 1 : 3, side: 1 }
      : { t: 'bee', x: i ? G.cam.x + W + 16 : G.cam.x - 16, side: i ? 1 : -1 };
    const m = makeEnemy(spec);
    if (m.dead) continue;
    m.active = true; m.facing = i ? -1 : 1;
    G.enemies.push(m); e.pups.push(m);
  }
}

// PHASE 2: plates pop off, the gills blow steam, a roar
function stepPhase2(e, P) {
  const st = e.st;
  if (st === 1) sfx.crack();
  if (st < 30 && st % 4 === 0) { const h = HOLES[(st >> 2) % HOLES.length]; sparks(e.x - AX + h[1], e.y - AY + h[2], 4, '#ffffff'); }
  if (st === 30) {
    e.ph2 = true; e.atk = 0;
    sfx.crack(); sfx.thump(); G.shake = Math.max(G.shake, 10); G.sflash = Math.max(G.sflash, 0.3);
    for (const [, cx, cy] of HOLES) {
      const x = e.x - AX + cx, y = e.y - AY + cy;
      boom(x, y, 0.5);
      G.parts.push({ type: 'sprite', s: ART.bits[2], x, y, vx: rand(-1.5, 2.5), vy: rand(-5.5, -3.5), g: 0.2, rot: 0, vr: rand(-0.4, 0.4), life: 120, max: 120 });
    }
    for (let i = 0; i < 10; i++) puff(e, 'steam', e.x - AX + 330 + rand(-14, 14), e.y - AY + 190 + rand(-10, 20), rand(-0.6, 0.6), rand(-1.4, -0.6), 3, 40);
  }
  if (st === 46) { sfx.roar(); word(e, 'GRRRAWR!', mouthFront(e, P) + 14, 136, '#ff6a50', 2, 50); for (let i = 0; i < 4; i++) e.later.push({ t: i * 9, f: () => ring(e) }); }
  if (st >= 110) { e.inv = false; toIdle(e); }
}

// DEATH: a rock jams the fan, the lights go out one by one, it sinks with a huge burp of bolts
function stepDying(e, P) {
  const st = e.st;
  e.fanV = st < 24 ? 0.6 : 0;
  if (st === 1) { e.jamRock = { x: G.cam.x + 170, y: 40, a: 0, x0: G.cam.x + 170, y0: 40 }; sfx.whir(); }
  if (e.jamRock) {
    const r = e.jamRock, th = throatAt(e, P), k = clamp(st / 24, 0, 1);
    r.x = lerp(r.x0, th[0], k); r.y = lerp(r.y0, th[1], k) - Math.sin(k * Math.PI) * 30; r.a += 0.4;
    if (st >= 24) e.jamRock = null;
  }
  if (st === 24) {
    e.jam = true; sfx.clunk(); G.shake = Math.max(G.shake, 7);
    const th = throatAt(e, P);
    sparks(th[0], th[1], 16, '#ffffff'); sparks(th[0], th[1], 10, L6);
    word(e, 'CLUNK!', mouthFront(e, P) - 10, 150, '#ffffff', 2, 32);
  }
  if (st > 24 && st < 70 && st % 5 === 0) { const th = throatAt(e, P); sparks(th[0], th[1], 2, '#ffffff'); puff(e, 'smoke', mouthFront(e, P) + 6, th[1] - 4, rand(-1.4, -0.4), rand(-0.9, -0.3), rand(3, 5), 40); }
  if (st === 58) { word(e, 'KOFF! KOFF!', mouthFront(e, P) - 16, 146, '#d7d0d8', 1, 44, { sh: '#000000' }); Snd.noise(0.2, 0.2, 800); Snd.noise(0.2, 0.2, 800, 0.25); }
  // the lights go out one by one (tail to nose)
  if (st >= 50) {
    const lo = clamp((st - 50) / 120, 0, 1.01), before = e.lightsOut || 0;
    e.lightsOut = lo;
    const n = LAMPS.filter(l => l.o >= before && l.o < lo).length;
    if (n && st % 3 === 0) sfx.tink(Math.round(lo * 30));
  }
  if (st === 150) e.cool = true;
  if (st > 120 && st < 250 && st % 7 === 0) puff(e, 'bubble', e.x - AX + rand(240, 450), LY - 1, 0, -0.3, rand(0, 1) < 0.4 ? 2 : 1, 18);
  if (st === 140) sfx.rumble();
  // the huge burp of bolts as it goes under
  if (st === 200) {
    sfx.burp(true); G.shake = Math.max(G.shake, 10); G.sflash = Math.max(G.sflash, 0.25);
    const mx = mouthFront(e, P) + 14;
    word(e, 'BUUURP!', mx + 10, 136, '#8be0a8', 3, 80, { sh: '#103a1a' });   // below the DOWN! line (st 214)
    for (let i = 0; i < 26; i++) G.parts.push({ type: 'sprite', s: ART.bits[i % 4], x: mx + rand(-6, 10), y: LY - 6, vx: rand(-3.4, 1.4), vy: rand(-7.5, -3.5), g: 0.2, rot: 0, vr: rand(-0.4, 0.4), life: 150, max: 150 });
    for (let i = 0; i < 8; i++) puff(e, 'smoke', mx + rand(-6, 10), LY - 10 - rand(0, 20), rand(-1, 1), rand(-1.2, -0.4), rand(4, 7), rand(40, 60));
    puff(e, 'ring', mx, LY - 16, 1, 0, 0, 34);
    splash(e, mx, 30);
  }
  if (st === 214) G.texts.push({ x: e.ax + 240, y: 90, s: 'MEGA WHALE SHARK DOWN!', t: 160, c: '#ffe066' });
  if (st >= 262) bossDefeated(e);
}

// a hero who lands in its lake (and keeps bouncing in the lava) is gulped and spat back onto the ledge: no extra
// hit, the lava already hurt. Kids get a way out; the harness bot too.
function lakeRescue(e, P) {
  const p = G.p;
  if (!p || p.dead || p.ride || e.held || P.mode !== 'normal' || P.under) { e.lakeT = 0; return; }
  if (p.x > e.ax + 226) e.lakeT = (e.lakeT || 0) + 1; else e.lakeT = 0;
  const ok = e.state === 'idle' || e.state === 'roar' || (e.state === 'spit' && e.st > SP_FIRE + 6) || e.state === 'steam' || (e.state === 'intro' && e.st > 150);
  if (!ok || e.lakeT < 10) return;
  if (e.state === 'intro') e.inv = false;
  e.jet = null;
  go(e, 'vac'); e.st = VTELL + 30;
  catchHero(e, P);
  e.held.hurt = false;
  word(e, 'NO SWIMMING!', mouthFront(e, P) + 10, 140, '#ffffff', 1, 60, { sh: '#000000' });
}

function updWhale(e) {
  e.st++;
  if (typeof L3 !== 'undefined' && e.state !== 'dying') L3.whaleHp = e.hp;   // for a continue (make)
  for (const l of e.later) if (--l.t <= 0) { l.f(); l.done = true; }
  e.later = e.later.filter(l => !l.done);
  let P = e.P = pose(e);
  lakeRescue(e, P);
  P = e.P = pose(e);
  switch (e.state) {
    case 'intro': stepIntro(e); break;
    case 'idle': stepIdle(e); break;
    case 'vac': stepVac(e, P); break;
    case 'burp': stepBurp(e, P); break;
    case 'spit': stepSpit(e, P); break;
    case 'dive': stepDive(e, P); break;
    case 'steam': stepSteam(e, P); break;
    case 'roar': stepRoar(e, P); break;
    case 'phase2': stepPhase2(e, P); break;
    case 'dying': stepDying(e, P); break;
  }
  if (e.dead) return;
  if (e.state !== 'vac' && e.state !== 'burp') e.fanV = lerp(e.fanV || 0, e.state === 'dying' ? 0 : 0.05, 0.1);
  e.fanA = (e.fanA || 0) + (e.fanV || 0);
  P = e.P = pose(e);
  // the open throat is its weak spot: shots about to fly into the open mouth do double damage
  if (P.jaw > 0.45 && !e.inv && e.state !== 'dying' && P.mode === 'normal') {
    const bx = ENEMY_TYPES.megawhale.box(e), top = e.y - AY + P.dy + lipUp(250) - 2, bot = e.y - AY + P.dy + lipLo(266, P.jaw);
    for (const b of G.pb) {
      if (b.mwx || b.onHit || b.life <= 1) continue;
      const nx = b.x + b.vx, ny = b.y + b.vy;
      if (!inBox(b.x, b.y, bx) && inBox(nx, ny, bx) && ny > top && ny < bot) {
        b.mwx = 1; b.dmg *= 2;
        sparks(nx, ny, 3, L7);
        if (G.t - (e.x2T || 0) > 10) { e.x2T = G.t; G.texts.push({ x: nx - 4, y: ny - 12, s: 'x2', t: 24, c: L6 }); }
      }
    }
  }
  // marks: count down, follow their projectile's fall
  for (const m of e.marks) {
    m.t++;
    if (m.due != null) m.left = m.due - m.t;
    if (m.b) { const gy = groundAt(m.x); m.k = clamp(1 - (gy - m.b.y) / 140, 0, 1); if (m.b.life <= 0) m.done = true; }
    else if (m.t > 400) m.done = true;
  }
  e.marks = e.marks.filter(m => !m.done);
  // its own little particles
  for (const f of e.fx) { f.x += f.vx; f.y += f.vy; f.t--; if (f.kind === 'bubble' && f.t < 6) f.r = Math.max(0, f.r - 1); }
  e.fx = e.fx.filter(f => f.t > 0);
  for (const w of e.words) w.t--;
  e.words = e.words.filter(w => w.t > 0);
  // a little steam from the gills now and then, more in phase 2; lava gobs flung off its back
  if (e.state !== 'dying' && P.mode === 'normal' && !P.under && e.t % (e.ph2 ? 9 : 22) === 0) puff(e, 'steam', e.x - AX + rand(320, 346) + P.dx, e.y - AY + 176 + P.dy, rand(0.2, 0.7), rand(-0.9, -0.5), 2, 30);
  if (e.state !== 'dying' && P.mode === 'normal' && !P.under && e.t % 26 === 0) { const x = e.x - AX + rand(380, 440); G.parts.push({ type: 'spark', x, y: e.y - AY + hullTop(x - e.x + AX) + P.dy, vx: rand(0.4, 1.4), vy: rand(-2.6, -1.4), g: 0.12, life: 40, max: 40, size: 2, c: L5 }); }
  // the front-effects layer
  if (!e.fxb || e.fxb.life <= 0 || !G.eb.includes(e.fxb)) { e.fxb = { k: 'mwfx', x: G.cam.x + W / 2, y: 20, vx: 0, vy: 0, life: 99999, owner: e }; G.eb.push(e.fxb); }
}

// ============================================================
// Projectiles
// ============================================================
// lava rocks (ROCK SPIT): tumble in an arc onto their mark, can be shot, crumble with a splash of embers
EB_TYPES.mwrock = {
  r: 7, shootable: true,
  update(b) { b.t++; if (b.t % 3 === 0) G.parts.push({ type: 'fire', x: b.x, y: b.y, vx: -b.vx * 0.2, vy: -0.3, life: 12, max: 12, size: 2 }); },
  draw(b) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(b.x, b.y, 11, '#ff6a1a', 0.35); ctx.restore();
    ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate((((Math.floor(b.t / 5) * b.spin) % 4 + 4) % 4) * Math.PI / 2);
    ctx.drawImage(ART.rock.img, ART.rock.x0, ART.rock.y0); ctx.restore();
  },
  onGround(b) {
    const gy = groundAt(b.x);
    debris(b.x, gy - 3, 6, K5); debris(b.x, gy - 3, 3, K3);
    for (let i = 0; i < 6; i++) G.parts.push({ type: 'spark', x: b.x, y: gy - 2, vx: rand(-1.6, 1.6), vy: rand(-2.6, -0.8), g: 0.16, life: 18, max: 18, size: 1, c: i % 2 ? L5 : L7 });
    G.parts.push({ type: 'fire', x: b.x, y: gy - 4, vx: 0, vy: -0.6, life: 18, max: 18, size: 4 });
    G.shake = Math.max(G.shake, 2); Snd.noise(0.2, 0.2, 700); Snd.tone('sine', 120, 50, 0.2, 0.15);
    if (b.mark) b.mark.done = true;
  },
  onHit(b) { debris(b.x, b.y, 5, K5); if (b.mark) b.mark.done = true; }
};
// lava drops (BREACH splash): smaller glowing blobs, also shootable
EB_TYPES.mwdrop = {
  r: 5, shootable: true,
  update(b) { b.t++; if (b.t % 2 === 0) G.parts.push({ type: 'spark', x: b.x, y: b.y, vx: 0, vy: 0, life: 10, max: 10, size: 1, c: L4 }); },
  draw(b) {
    const x = Math.round(b.x), y = Math.round(b.y), s = clamp(Math.round(b.vy * 0.6), -1, 2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(x, y, 9, '#ff7a20', 0.35); ctx.restore();
    disc(x, y, 3, L3C); disc(x, y - 1, 2, L5); R(x - 1, y - 2, 2, 1, L7);
    if (s > 0) { R(x, y - 3 - s, 1, s, L4); R(x - 1, y - 4 - s, 1, 1, L3C); }
  },
  onGround(b) {
    const gy = groundAt(b.x);
    for (let i = 0; i < 7; i++) G.parts.push({ type: 'spark', x: b.x, y: gy - 1, vx: rand(-1.8, 1.8), vy: rand(-2.4, -0.6), g: 0.16, life: 18, max: 18, size: 1, c: i % 2 ? L5 : L7 });
    G.parts.push({ type: 'fire', x: b.x, y: gy - 3, vx: 0, vy: -0.5, life: 16, max: 16, size: 3 });
    Snd.noise(0.15, 0.12, 2400);
    if (b.mark) b.mark.done = true;
  },
  onHit(b) { if (b.mark) b.mark.done = true; }
};
// the front-effects layer: never hurts (r 0), stays on screen while the boss lives
EB_TYPES.mwfx = {
  r: 0,
  update(b) {
    const e = b.owner;
    if (!e || e.dead) { b.life = 0; return; }
    b.x = G.cam.x + W / 2; b.y = 20; b.vx = 0; b.vy = 0; b.g = 0; b.life = 99999;
  },
  draw(b) { if (b.owner && !b.owner.dead) drawFront(b.owner); }
};

// ============================================================
// Registry
// ============================================================
ENEMY_TYPES.megawhale = {
  hp: 380, boss: true, bossName: 'MEGA WHALE SHARK', armored: true, edge: 16, activateMargin: 400, contact: 'none',   // retune: hp 380 (was 350)
  make(e, s) {
    // it arrives as a wave at the screen's right edge (x 6216): put it in the crater's lava lake
    const ax = e.lock && e.lock.at != null ? e.lock.at : G.cam.x;
    Object.assign(e, {
      ax, x: ax + AX, y: AY, state: 'intro', st: 0, inv: true, ph2: false, atk: 0, roars: 0, helpN: 0, rest: 60,
      fanA: 0, fanV: 0.05, held: null, marks: [], words: [], fx: [], later: [], pups: [], jet: null, bx: ax + 280,
      jam: false, cool: false, lightsOut: null, jamRock: null, burpDmg: 0, fxb: null, x2T: 0, runK: 0, teeter: 0
    });
    // after a continue (a game over during this fight) it comes back worn down: the health it had, at most 75%
    // (updWhale keeps L3.whaleHp; level3.js clears it on a fresh start). The bar still counts from full.
    e.max = e.hp;
    const kept = typeof L3 !== 'undefined' && G.continues > 0 ? L3.whaleHp : null;
    if (kept != null) e.hp = clamp(Math.min(kept, Math.round(e.max * 0.75)), 1, e.max);
    e.P = pose(e);
  },
  update: updWhale,
  draw: drawWhale,
  box(e) {
    const P = e.P || pose(e), x0 = e.x - AX, y0 = e.y - AY;
    if (P.mode === 'breach') { const top = clamp(P.by - 130, 60, 150); return { x: e.bx - 52, y: top, w: 96, h: LY - top }; }
    if (P.under) {
      // under the lava: the fin (armoured, shots just spark off it) or the bubbling spot
      const fx = e.state === 'dive' && e.st >= DV_GLIDE && e.st < DV_BREACH ? e.bx - 12 : x0 + P.dx + 396;
      return { x: fx, y: y0 + 140, w: 30, h: 98 };
    }
    const open = P.jaw > 0.45, left = x0 + P.dx + (open ? 262 : 234);
    return { x: left, y: y0 + P.dy + 142, w: x0 + 446 - left, h: LY - (y0 + P.dy + 142) + y0 };
  },
  onKill(e, cx, cy, b) {
    const p = G.p;
    // let go of a hero it is chewing (no hit), clear its rocks, drops and helpers
    if (e.held) { if (p) { p.hidden = false; p.inv = Math.max(p.inv, 60); p.y = groundAt(e.ax + 100); p.x = e.ax + 100; p.vy = 0; } e.held = null; }
    G.eb = G.eb.filter(x => x.k !== 'mwrock' && x.k !== 'mwdrop');
    e.marks = []; e.jet = null; e.words = [];
    for (const m of e.pups) if (alive(m)) damageEnemy(m, 99);
    e.state = 'dying'; e.st = 0; e.hitT = 0; e.inv = true;
    addScore(10000, cx, b.y);
    say('Mega whale shark is going down!', 0.9, 1.05);
    // like the other final bosses: nothing hurts the hero any more, a falling last life is given back
    G.winT = 360;
    if (p && p.dead && G.lives <= 1) G.lives = 2;
    return 'dying';
  }
};
}
