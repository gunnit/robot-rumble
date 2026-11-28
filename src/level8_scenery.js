'use strict';
var L8 = L8 || {};
// =====================================================================================================================
// Mission 8 (DINOSAUR VALLEY): the near picture. The far one (skies, mountains) is level8_backdrops.js's.
//   - the ground: painted along the level's terrain in tiles 240 px wide, one material per area (jungle earth, lagoon
//     sand, red rock, basalt with lava in its cracks, the hatchery's steel floor, the launch pad's concrete)
//   - the pools: water the hero wades through (he shows through it), tar that hides his feet
//   - the things standing in the world, behind the play (DECOR): the crashed pod, jungle giants, palms, the bones of
//     Bone Canyon, the hatchery's machines, MEGA OGGLE's rocket; the hatchery's far wall and its door
//   - light: sun shafts, lamp cones, the dawn at the end
// Hooks (LEVELS[7] calls them through level8.js): L8.drawBehind / drawGround / drawPlat / drawFront / drawOverlay /
// menuBG / card. The chase and the boss draw their own pictures: L8.chase.drawGround / drawFront, L8.bossFront.
// Never Math.random() / rand(): hsh(), the stable noise and G.t only.
// =====================================================================================================================
{
const Math = globalThis.Math;
const { NONE, buf, put, get, rect, shape, oval, poly, line, capsule, tube, bez, outline, form, stamp, mk, blit, canvasOf } = M8.px;
const I = M8.I, P = M8.P, OUTI = M8.OUTI, nz = M8.nz, fbm = M8.fbm, mixI = M8.mixI, lerp = M8.lerp, memo = M8.memo, rng = M8.rng;
const K0 = M8.art.K0, K1 = M8.art.K1, K2 = M8.art.K2;
const { LW, bay, md, ease, rampOf, pick, pfbm, wrapX, clumps, crown, roof, hills, bakeL, cloudPuff } = L8.paint;
const STEEL = M8.PAL.STEEL, GRN = M8.PAL.GRN, AMB = M8.PAL.AMB, ROCK = M8.PAL2.ROCK;
const GATE = L8.GATE_X, EXIT = L8.EXIT_X, X4 = GATE + 14, X5 = EXIT + 14;

// the level's ground line, also when another mission is running (menus, the mission card)
function gAt(x) {
  const t = L8.level.terrain;
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const a = t[i - 1], b = t[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
  return t[t.length - 1][1];
}
L8.groundAt = gAt;

// ---------------------------------------------------------------------------------------------------------------------
// The ground's materials: f(x, y, d) -> colour (d = how far below the surface; above it only grass may be painted)
// ---------------------------------------------------------------------------------------------------------------------
const SOIL = P('#2a1816', '#3c221a', '#52301e', '#6c4226', '#8a5830', '#a87440');
const GRASS = P('#1c5424', '#2c7a28', '#52a62e', '#8ed23c', '#c6ee62');
const SAND = P('#7a5a34', '#9a7844', '#bc9a5c', '#dcbc7c', '#f2dca0', '#fff2c8');
const RED = P('#3e1618', '#5a2220', '#7c3224', '#a2482c', '#c86838', '#e89050', '#ffc888');
const BAS = P('#0e0a16', '#17101f', '#21172b', '#2e2038', '#42304a', '#5e4a62', '#8a748a');
const LAVA = P('#7a1810', '#d03a14', '#ff7a1e', '#ffc23a', '#fff2a0');
const CON = P('#22243a', '#30334a', '#44485e', '#5c6078', '#7c8198', '#a0a5b8', '#c8cdda');
const UNDER = P('#0a0c14', '#12151f', '#1c202c', '#2a303a', '#3b424d');
const HAZ = [I('#e2b21c'), I('#16141e')];
// the pod's crater: burnt black, no grass (1 in the middle, 0 outside)
const scorch = x => clamp(Math.min(x - 262, 428 - x) / 16 + (nz(x >> 1, 2) - 0.5) * 0.8, 0, 1);
function soil(x, y, d) {
  const sc = scorch(x);
  if (sc > 0.5) {
    if (d < 0) return NONE;
    if (d < 1) return nz(x, 9) > 0.6 ? I('#8a8084') : I('#5c5458');
    if (d < 3 + nz(x >> 1, 10) * 5) return nz(x, y) > 0.94 ? LAVA[2] : (nz(x >> 1, y >> 1) > 0.5 ? I('#1c161a') : I('#2a2024'));
  } else {
    const bl = nz(x, 3) > 0.5 ? 1 + Math.floor(nz(x, 4) * 3.4) : (nz(x >> 1, 5) > 0.66 ? 1 : 0);
    if (d < 0) return -d <= bl ? (nz(x, 6) > 0.5 ? GRASS[3] : GRASS[2]) : NONE;
    if (d < 2) return nz(x >> 1, 7) > 0.32 ? GRASS[3] : GRASS[4];
    if (d < 4) return GRASS[2];
    const fr = 4 + Math.floor(nz(x >> 1, 8) * 4.6);
    if (d < fr) return GRASS[1];
    if (d < fr + 1) return GRASS[0];
  }
  const n = fbm(x * 0.07, y * 0.14, 12);
  return pick(SOIL, clamp(0.8 - (d - 6) * 0.017 + (n - 0.5) * 0.75, 0, 1), x, y, 0.8);
}
function sand(x, y, d) {
  if (d < 0) return nz(x >> 2, 21) > 0.8 && -d <= 1 + Math.floor(nz(x, 22) * 4) && nz(x, 23) > 0.3 ? (nz(x, 24) > 0.5 ? GRASS[3] : GRASS[2]) : NONE;
  if (d < 1) return SAND[5];
  if (d < 3) return SAND[4];
  const n = fbm(x * 0.05, y * 0.3, 25);
  let i = SAND.indexOf(pick(SAND, clamp(0.74 - (d - 3) * 0.019 + (n - 0.5) * 0.5, 0, 1), x, y, 0.9));
  if (md(Math.round(y + fbm(x * 0.04, 0.5, 26) * 8), 7) === 0 && n > 0.42) i = Math.max(0, i - 1);            // the lines old water left
  return SAND[i];
}
function redrock(x, y, d) {
  if (d < 0) return NONE;
  if (d < 1) return RED[6];
  if (d < 3) return RED[5];
  const wob = (fbm(x * 0.025, y * 0.06, 31) - 0.5) * 9, bed = Math.floor((y + wob) / 7), by = md(y + wob, 7);
  let i = clamp(1 + md(bed * 5 + (bed >> 1), 4) - Math.floor((d - 3) / 20), 0, 4);
  if (by < 1) i = Math.max(0, i - 1);
  if (fbm(x * 0.3, y * 0.03, 33) > 0.72) i = Math.max(0, i - 1);
  return RED[i];
}
function basalt(x, y, d) {
  if (d < 0) return NONE;
  if (d < 1) return BAS[6];
  if (d < 2) return BAS[5];
  const r = Math.abs(fbm(x * 0.04, y * 0.075, 43, 2) - 0.5);
  if (d > 9) { if (r < 0.006) return LAVA[3]; if (r < 0.015) return LAVA[2]; if (r < 0.024) return LAVA[1]; if (r < 0.033) return LAVA[0]; }
  const jx = x + (fbm(x * 0.02, y * 0.05, 41) - 0.5) * 12, cx = md(jx, 13), n = fbm(Math.floor(jx / 13) * 1.7, y * 0.04, 45);
  let i = clamp(Math.round(1 + n * 3.4 - (d - 4) * 0.02), 0, 4);
  if (cx < 1) i = 0; else if (cx < 2.2) i = Math.min(5, i + 1);
  if (md(y + Math.floor(jx / 13) * 5, 17) === 0) i = Math.max(0, i - 1);
  return BAS[i];
}
function steel(x, y, d) {
  if (d < 0) return NONE;
  if (d < 1) return STEEL[5];
  if (d < 2) return STEEL[4];
  const px = md(x, 40);
  if (d < 8) return px === 0 ? STEEL[0] : px === 1 ? STEEL[4] : (px === 5 || px === 35) && d === 4 ? STEEL[5] : (px === 5 || px === 35) && d === 5 ? STEEL[0] : d < 5 ? STEEL[3] : STEEL[2];
  if (d < 9) return STEEL[0];
  if (d < 13) return md(x, 320) < 140 ? HAZ[((x + d) >> 2) % 2] : STEEL[1];
  if (d < 14) return STEEL[0];
  const gx = md(x, 64), gy = d - 14;                                      // the frame underneath: posts, braces, the dark between
  if (gx < 4) return gx === 0 ? UNDER[4] : UNDER[3];
  if (gy < 3) return gy === 0 ? UNDER[4] : UNDER[3];
  if (Math.abs(md(gx - 4 + gy * 1.5, 60) - 30) < 1.6 || Math.abs(md(gx - 4 - gy * 1.5, 60) - 30) < 1.6) return UNDER[2];
  return md(x, 128) > 100 && md(gy, 9) < 3 ? UNDER[2] : (nz(x >> 2, gy >> 2) > 0.8 ? UNDER[1] : UNDER[0]);
}
function concrete(x, y, d) {
  if (d < 0) return NONE;
  if (d < 1) return CON[6];
  if (d < 2) return CON[5];
  const n = fbm(x * 0.06, y * 0.2, 51);
  if (d < 10) {
    if (md(x, 80) === 0) return CON[1];
    if (d >= 3 && d < 5 && md(x, 40) < 24) return HAZ[0];
    return n > 0.6 ? CON[5] : n < 0.35 ? CON[3] : CON[4];
  }
  if (d < 11) return CON[0];
  if (d < 17) return HAZ[((x + d) >> 3) % 2];
  if (d < 18) return CON[0];
  return pick(CON, clamp(0.36 - (d - 18) * 0.008 + (n - 0.5) * 0.3, 0, 0.5), x, y, 0.8);
}
const MATS = [soil, sand, redrock, basalt, steel, concrete], SOFT = [1450, 2900, 4300];
function matAt(x, y) {
  if (x >= X5) return 5;
  if (x >= X4) return 4;
  const m = x < 1450 ? 0 : x < 2900 ? 1 : x < 4300 ? 2 : 3;
  for (let i = 0; i < 3; i++) { const d = x - SOFT[i]; if (d > -40 && d < 40) return d / 80 + 0.5 + (fbm(x * 0.07, y * 0.11, 90 + i) - 0.5) * 0.9 > 0.5 ? i + 1 : i; }
  return m;
}
// things in the ground: stones, old bones, roots, shells
const STONE = P('#4a4048', '#6e6068', '#9a8c90', '#c8bcbc'), BONES = P('#8a7a62', '#b8a888', '#e0d4b4', '#fff6dc');
function stone(b, x, y, r, pal) {
  shape(b, x - r * 1.3 - 1, y - r, x + r * 1.3 + 1, y + r, (px, py) => ((px - x) / (r * 1.3)) ** 2 + ((py - y) / (r * 0.85)) ** 2 <= 1, (px, py) => { const v = (px - x) * 0.6 + (py - y) * 0.95; return v < -r * 0.3 ? pal[2] : v > r * 0.4 ? pal[0] : pal[1]; });
}
function fossil(b, x, y, k) {
  const c = BONES[2], d = BONES[1];
  if (k % 3 === 0) {                                                       // a snail shell of stone
    for (let a = 0; a < 15; a += 0.25) { const r = 0.9 + a * 0.42; put(b, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9, a % 1.5 < 0.4 ? d : c); }
  } else if (k % 3 === 1) {                                                // ribs
    rect(b, x - 9, y - 5, 19, 2, c); rect(b, x - 9, y - 4, 19, 1, d);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 8; j++) put(b, x - 8 + i * 4 + Math.round(Math.sin(j / 7 * 2.4) * 2), y - 3 + j, j > 5 ? d : c);
  } else {                                                                 // a small skull
    oval(b, x, y, 5, 4, c); rect(b, x + 3, y, 6, 3, c); rect(b, x + 3, y + 3, 5, 1, d); put(b, x - 1, y - 1, I('#2a1816')); put(b, x, y - 1, I('#2a1816')); put(b, x - 1, y, I('#2a1816')); put(b, x + 7, y + 1, I('#2a1816'));
    for (let i = 0; i < 3; i++) put(b, x + 4 + i * 2, y + 3, c);
  }
}
function extras(b, x0) {
  for (let c = Math.floor((x0 - 30) / 26); c * 26 < x0 + TW + 30; c++) {
    const h1 = hsh(c * 1.31 + 7), h2 = hsh(c * 2.17 + 3), h3 = hsh(c * 3.91 + 11), x = c * 26 + Math.round(h1 * 20), g = Math.round(gAt(x)), m = matAt(x, g + 20);
    if (m === 0 && scorch(x) < 0.5) {
      if (h2 < 0.48) stone(b, x, g + 13 + Math.round(h3 * 28), 2 + Math.round(h2 * 6), STONE);
      else if (h2 > 0.9) fossil(b, x, g + 20 + Math.round(h3 * 12), c);
      else if (h2 > 0.7) { let rx = x, ry = g + 6; for (let i = 0; i < 16; i++) { put(b, rx, ry, i % 5 ? SOIL[1] : SOIL[4]); ry += 1; rx += nz(c, i) > 0.5 ? 1 : nz(c, i) < 0.25 ? -1 : 0; } }   // a root
    } else if (m === 1) {
      if (h2 < 0.3) stone(b, x, g + 10 + Math.round(h3 * 22), 2 + Math.round(h2 * 8), P('#8a7a5c', '#b8a47c', '#e2d2a8'));
      else if (h2 > 0.82) { const sy = g + 8 + Math.round(h3 * 14); oval(b, x, sy, 3, 2, I('#fff6e8')); rect(b, x - 2, sy + 1, 5, 1, I('#e8b8a8')); put(b, x, sy - 1, I('#e8b8a8')); }             // a shell
    } else if (m === 2) {
      if (h2 > 0.78) fossil(b, x, g + 16 + Math.round(h3 * 16), c);
      else if (h2 < 0.2) stone(b, x, g + 12 + Math.round(h3 * 20), 3 + Math.round(h2 * 10), [RED[1], RED[3], RED[5]]);
    } else if (m === 3) {
      if (h2 < 0.25) stone(b, x, g + 9 + Math.round(h3 * 10), 3 + Math.round(h2 * 12), [BAS[0], BAS[2], BAS[4]]);
    }
  }
}
const TW = 240, GT = 186, GB = H + 12;
const TILES = new Map();
function groundTile(ti) {
  let t = TILES.get(ti);
  if (t) return t;
  const x0 = ti * TW, b = buf(TW, GB - GT, -x0, -GT);
  for (let i = 0; i < TW; i++) {
    const x = x0 + i, g = Math.round(gAt(x));
    for (let y = g - 5; y < GB; y++) { const c = MATS[matAt(x, y)](x, y, y - g); if (c != null && c !== NONE) put(b, x, y, c); }
  }
  extras(b, x0);
  t = bakeL(b);
  TILES.set(ti, t);
  return t;
}

// ---------------------------------------------------------------------------------------------------------------------
// Pools: painted once with their own see-through, drawn behind the actors and once more, thinner, over their legs
// ---------------------------------------------------------------------------------------------------------------------
function bakeA(w, h, f) {                                                  // f(x, y) -> [0xRRGGBB, alpha 0..255] or null
  const c = canvasOf(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), dd = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f(x, y); if (!v) continue; const j = (y * w + x) * 4; dd[j] = v[0] >> 16 & 255; dd[j + 1] = v[0] >> 8 & 255; dd[j + 2] = v[0] & 255; dd[j + 3] = v[1]; }
  g.putImageData(im, 0, 0);
  return c;
}
const POOLART = new Map();
function poolArt(n) {
  let a = POOLART.get(n);
  if (a) return a;
  const w = n.x1 - n.x0, h = 16, tar = n.k === 'tar', WT = P('#2a86c4', '#3fa6d6', '#6cc8e4', '#a8e6f2'), TR = P('#120c1a', '#1c1426', '#2a2036', '#3e3050', '#6a5880');
  const deep = x => Math.round(gAt(n.x0 + x)) - n.y;
  a = {
    back: bakeA(w, h, (x, y) => {
      const dp = deep(x);
      if (y >= dp || dp <= 0) return null;
      if (tar) return [y === 0 ? (fbm(x * 0.12, 0.5, 61) > 0.5 ? TR[4] : TR[3]) : y === 1 && fbm(x * 0.2, 1.5, 62) > 0.62 ? (fbm(x * 0.07, 2.5, 64) > 0.5 ? 0x4a6a8a : 0x7a4a80) : TR[clamp(Math.round(1.6 - y * 0.25 + (fbm(x * 0.09, y * 0.4, 63) - 0.5) * 2.4), 0, 3)], 255];
      return [y === 0 ? 0xeafcff : WT[clamp(Math.round(3 - y * 0.34 + (fbm(x * 0.05, y * 0.5, 65) - 0.5) * 1.4), 0, 3)], y === 0 ? 235 : Math.min(215, 140 + y * 9)];
    }),
    front: bakeA(w, h, (x, y) => {
      const dp = deep(x);
      if (y >= dp || dp <= 0) return null;
      if (tar) return y < 2 ? null : [TR[clamp(Math.round(1.6 - y * 0.25 + (fbm(x * 0.09, y * 0.4, 63) - 0.5) * 2.4), 0, 3)], 255];
      return y < 1 ? null : [WT[clamp(Math.round(2.4 - y * 0.3), 0, 3)], 105];
    })
  };
  POOLART.set(n, a);
  return a;
}
function drawPools(cx, front) {
  for (const n of L8.level.pools) {
    if (n.x1 < cx - 12 || n.x0 > cx + W + 12) continue;
    const a = poolArt(n);
    ctx.drawImage(front ? a.front : a.back, n.x0, n.y);
    if (n.k === 'tar') {
      if (front) continue;
      for (let i = 0; i < 5; i++) {                                         // slow bubbles: they swell and burst
        const x = n.x0 + 10 + Math.floor(hsh(n.x0 + i * 7.3) * (n.x1 - n.x0 - 20)), ph = md(G.t + i * 53 + n.x0, 170);
        if (ph > 70) continue;
        const r = ph < 56 ? 1 + Math.floor(ph / 20) : 4;
        if (ph < 56) { R(x - r, n.y - r + 1, r * 2 + 1, r, '#2a2036'); R(x - r + 1, n.y - r, r * 2 - 1, 1, '#3e3050'); R(x - r + 1, n.y - r + 1, 1, 1, '#8a78a0'); }
        else { R(x - 4, n.y - 2, 1, 1, '#6a5880'); R(x + 4, n.y - 2, 1, 1, '#6a5880'); R(x, n.y - 4, 1, 1, '#6a5880'); }
      }
    } else if (!front) {
      for (let i = 0; i < 9; i++) {                                         // light on the water
        const x = n.x0 + 6 + md(Math.floor(hsh(n.x0 + i * 3.7) * 400 + G.t * (0.1 + (i % 3) * 0.06)), n.x1 - n.x0 - 18), wv = 3 + (i % 3) * 2;
        R(x, n.y + (i % 2 ? 0 : 2 + (i % 3)), wv, 1, i % 2 ? '#ffffff' : 'rgba(234,252,255,0.55)');
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Things standing in the world (DECOR). Each is { x, y, spr (a memo -> sprite), back (true: drawn before the ground) }
// ---------------------------------------------------------------------------------------------------------------------
const DECOR = [];
const add = (x, spr, o = {}) => { DECOR.push(Object.assign({ x, y: Math.round(gAt(x)) + (o.dy || 0), spr, back: false }, o)); };
const TREE = P('#0b2a36', '#0f3c42', '#15534c', '#216e58', '#3c9060', '#7cba68', '#d8e88c');
const BARK = P('#1c1418', '#2c1e20', '#40282a', '#583a30', '#7a5238', '#a07444');
// one arching frond with leaflets, from (x, y)
function frond(b, x, y, a, L, c0, c1, drop = 0.2) {
  const tip = [x + Math.cos(a) * L, y - Math.sin(a) * L * 0.72 + L * drop], mid = [x + Math.cos(a) * L * 0.45, y - Math.sin(a) * L * 1.25], pts = bez([[x, y], mid, tip], 10);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = pts[i - 1], dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy) || 1, n = L * 0.16 * (1 - Math.abs(i / pts.length - 0.5) * 1.1) + 1;
    line(b, q[0], q[1], p[0], p[1], c1);
    line(b, p[0], p[1], p[0] - dy / d * n - dx / d, p[1] + dx / d * n - dy / d, c0);
    line(b, p[0], p[1], p[0] + dy / d * n - dx / d, p[1] - dx / d * n - dy / d, c1);
  }
}
// a jungle giant: the trunk goes up out of the picture, roots spread at its foot, moss and a vine on it
const TRUNK = [0, 1, 2].map(k => memo(() => {
  const b = buf(120, 286, 60, 270), s = 11 + k * 7, hw = y => 12 + k * 2 + Math.max(0, (y + 34) * 0.5) + Math.sin(y * 0.03 + s) * 1.5, mid = y => Math.sin(y * 0.012 + s) * 5;
  shape(b, -44, -270, 44, 12, (x, y) => Math.abs(x - mid(y)) < hw(y) && y < 10, K0);
  for (const [dx, r] of [[-1, 30 + k * 4], [1, 26 + k * 5], [-1, 16], [1, 14]]) tube(b, bez([[dx * 8, -30], [dx * (r * 0.5), -12], [dx * r, 8]], 8), 7, 3.2, K0);
  form(b, K0, BARK, { depth: 13, amb: 0.4, gain: 0.85, dither: 0.6, grain: (x, y) => (fbm(x * 0.55, y * 0.05, s) - 0.5) * 0.55 });
  for (let y = -264; y < 4; y++) for (let x = -44; x < 44; x++) {                      // moss on the side the light comes from
    const c = get(b, x, y);
    if (c === NONE) continue;
    if (fbm(x * 0.09 + s, y * 0.035, 7) > 0.6 && x - mid(y) < hw(y) * 0.3) put(b, x, y, c === BARK[4] || c === BARK[5] ? TREE[4] : c === BARK[3] ? TREE[3] : TREE[2]);
  }
  const vine = bez([[mid(-262) + 6, -268], [mid(-190) - 16 + k * 9, -200], [mid(-120) + 12 - k * 7, -130], [mid(-60) - 6, -56 + k * 10]], 34);
  for (let i = 1; i < vine.length; i++) { line(b, vine[i - 1][0], vine[i - 1][1], vine[i][0], vine[i][1], TREE[1], 2); if (i % 3 === 0) { rect(b, vine[i][0] + (i % 2 ? 2 : -3), vine[i][1], 3, 2, TREE[4]); put(b, vine[i][0] + (i % 2 ? 3 : -3), vine[i][1] - 1, TREE[5]); } }
  outline(b);
  return mk(b, false);
}));
// low plants: ferns, a broad-leaf, flowers, toadstools
const FERN = [0, 1, 2].map(k => memo(() => {
  const b = buf(56, 40, 28, 36), n = 6 + k;
  for (let i = 0; i < n; i++) frond(b, 0, -2, 0.25 + i * (2.64 / (n - 1)) + hsh(i + k * 9) * 0.12, 13 + hsh(i * 3.7 + k) * 8, TREE[1 + (i % 2)], TREE[3 + (i % 2)]);
  for (let i = 0; i < n - 2; i++) frond(b, 0, -2, 0.5 + i * (2.1 / (n - 3)), 8 + hsh(i * 5.1 + k) * 5, TREE[3], TREE[5]);
  outline(b);
  return mk(b, false);
}));
const LEAFY = memo(() => {
  const b = buf(48, 44, 24, 40);
  for (const [a, L, w] of [[2.5, 20, 6], [0.6, 22, 6.5], [1.2, 28, 7], [1.95, 26, 7], [1.56, 18, 5]]) {
    const tip = [Math.cos(a) * L, -Math.sin(a) * L], t = buf(48, 44, 24, 40);
    shape(t, -24, -40, 24, 2, (x, y) => { const u = (x * tip[0] + y * tip[1]) / (L * L), v = (x * -tip[1] + y * tip[0]) / L; return u > 0 && u < 1 && Math.abs(v) < w * Math.sin(Math.min(1, u * 1.15) * Math.PI) * 0.6; }, K0);
    form(t, K0, TREE.slice(1, 6), { depth: 3, amb: 0.5 });
    for (let i = 2; i < L; i += 1) put(t, tip[0] * i / L, tip[1] * i / L, TREE[5]);
    outline(t);
    stamp(b, t);
  }
  return mk(b, false);
});
const SMALL = [0, 1, 2, 3].map(k => memo(() => {
  const b = buf(16, 20, 8, 17), pc = [I('#ff7ab0'), I('#ffd23f'), I('#f6fbff')][k % 3];
  if (k === 3) { rect(b, -1, -5, 2, 5, I('#f2e6d0')); shape(b, -5, -10, 5, -4, (x, y) => (x / 5) ** 2 + ((y + 4.5) / 5) ** 2 <= 1 && y < -4.5, I('#e0302a')); put(b, -2, -8, I('#ffffff')); put(b, 1, -7, I('#ffffff')); put(b, 3, -6, I('#ffffff')); rect(b, -5, -5, 10, 1, I('#a3151a')); }
  else { line(b, 0, 0, k - 1, -9, TREE[3]); rect(b, -2 + k - 1, -5, 2, 1, TREE[4]); for (const [x, y] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) rect(b, k - 1 + x - 1, -11 + y, 2, 2, pc); rect(b, k - 2, -11, 2, 2, I('#ffb347')); }
  outline(b);
  return mk(b, false);
}));
// MEGA OGGLE's escape pod, nose down in its crater: green armour, a steel band, the hatch thrown open
const POD = memo(() => {
  const b = buf(110, 84, 55, 66), ca = Math.cos(-0.5), sa = Math.sin(-0.5), U = (x, y) => [(x * ca + (y + 26) * sa), (-x * sa + (y + 26) * ca)];
  // three fins at its tail (up and to the right), scorched
  for (const [a, L] of [[0.15, 26], [-0.75, 28], [-1.5, 22]]) { const bx = 27 * ca, by = -26 + 27 * -sa * -1; poly(b, [[bx - 4, by - 2], [bx + Math.cos(a) * L, by + Math.sin(a) * L - 4], [bx + Math.cos(a) * L + 5, by + Math.sin(a) * L + 4], [bx + 4, by + 6]], K1); }
  shape(b, -50, -64, 50, 16, (x, y) => { const [u, v] = U(x, y); return (u / 36) ** 2 + (v / 24) ** 2 <= 1; }, K0);
  form(b, K1, STEEL.slice(0, 5), { depth: 3, amb: 0.45 });
  form(b, K0, GRN, { depth: 16, amb: 0.46, gain: 0.9, dither: 0.6 });
  for (let y = -64; y < 16; y++) for (let x = -50; x < 50; x++) {
    const c = get(b, x, y);
    if (c === NONE) continue;
    const [u, v] = U(x, y);
    if (Math.abs(u - 6) < 3.4 && (u / 36) ** 2 + (v / 24) ** 2 <= 1) put(b, x, y, Math.abs(u - 6) > 2.4 ? STEEL[1] : v < -8 ? STEEL[5] : v < 6 ? STEEL[3] : STEEL[2]);        // the band
    if (Math.abs(u - 6) < 1 && md(Math.round(v), 6) === 0) put(b, x, y, STEEL[0]);
    const pd = Math.hypot(u + 14, v + 3);                                                                          // the window: cracked glass
    if (pd < 9) put(b, x, y, pd > 7 ? STEEL[4] : pd > 6 ? STEEL[1] : (x + y) % 7 === 0 || (x - y * 2) % 11 === 0 ? I('#9fd8e8') : I('#16303e'));
    if (u > 24 && fbm(x * 0.3, y * 0.3, 5) > 0.45) put(b, x, y, I('#1c1a20'));                                      // soot at the tail
  }
  // the open hatch: a dark hole, its lid standing
  const [hx, hy] = [14, -44];
  oval(b, hx, hy, 8, 5, I('#0a1410')); oval(b, hx, hy - 1, 6.4, 3.6, I('#06100c'));
  poly(b, [[hx + 5, hy - 2], [hx + 16, hy - 14], [hx + 20, hy - 11], [hx + 9, hy + 1]], GRN[3]); line(b, hx + 5, hy - 2, hx + 16, hy - 14, GRN[5]); line(b, hx + 9, hy + 1, hx + 20, hy - 11, GRN[1]);
  line(b, -30, -42, -40, -62, STEEL[3]); line(b, -40, -62, -34, -66, STEEL[3]); put(b, -34, -67, I('#ff3b30'));     // a bent aerial
  outline(b);
  return mk(b, false);
});
// the leaves overhead, along the jungle (a strip that wraps)
const FRINGE = memo(() => {
  const b = buf(LW, 96, 0, 12), T = new Float32Array(LW), R0 = rng(303);
  const sets = [clumps(8, [TREE[0], TREE[1], TREE[2], TREE[3]], 11.3), clumps(7, [TREE[0], TREE[0], TREE[1], TREE[2]], 12.4)];
  for (let x = 0; x < LW; x++) T[x] = 8 + pfbm(x / LW * 9, 0.5, 9, 141, 3) * 26;
  for (let x = 0; x < LW; x++) for (let y = -12; y < T[x] - 4; y++) put(b, x, y, TREE[0]);
  for (let k = 0; k < 2; k++) for (let x = R0() * 8; x < LW; x += 6 + R0() * 6) { const xi = Math.round(x), y = Math.round(T[md(xi, LW)] - 5 - k * 8 + (R0() - 0.5) * 5), s = sets[1 - k][Math.floor(R0() * 4)]; wrapX(xi, 12, xx => stamp(b, s, xx, y)); }
  for (let i = 0; i < 16; i++) {                                                       // vines hang from it
    const x = Math.round((i + R0() * 0.8) * LW / 16), y0 = Math.round(T[md(x, LW)]), L = 14 + Math.floor(R0() * 46), sw = (R0() - 0.5) * 8;
    for (let j = 0; j < L; j++) { const xx = md(Math.round(x + Math.sin(j / L * 2.6) * sw), LW); put(b, xx, y0 + j, TREE[1]); if (j % 5 === 2) { put(b, md(xx + (j % 2 ? 1 : -1), LW), y0 + j, TREE[3]); put(b, md(xx + (j % 2 ? 2 : -2), LW), y0 + j + 1, TREE[3]); } }
  }
  return bakeL(b);
});
// AREA 2: palms on the banks, reeds at the water
const TAN = P('#4a3226', '#6a4830', '#8c6640', '#b08a54', '#d0ae74'), LEAFP = P('#0f3a2c', '#17583a', '#237a44', '#3fa64e', '#7ccc5c', '#c4ec80');
// a palm's frond: a rib that arches and droops, its leaflets hanging from it like a comb
function blade(b, x, y, a, L, c0, c1, c2) {
  const dx = Math.cos(a), up = Math.sin(a), tip = [x + dx * L, y - up * L * 0.3 + L * 0.5], mid = [x + dx * L * 0.5, y - up * L * 0.62 - L * 0.25], pts = bez([[x, y], mid, tip], Math.max(8, Math.round(L / 1.3)));
  for (let j = 1; j < pts.length; j++) {
    const u = j / (pts.length - 1), q = Math.sin(Math.min(1, u * 1.12) * Math.PI) ** 0.8 * L * 0.27 + 1.5, p = pts[j];
    line(b, p[0], p[1] + 1, p[0] + dx * q * 0.3, p[1] + q, j % 3 ? c1 : c0);
  }
  for (let j = 1; j < pts.length; j++) line(b, pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1], c2, j < pts.length * 0.6 ? 2 : 1);
}
const PALMW = [0, 1, 2].map(k => memo(() => {
  const hgt = 88 + k * 16, lean = [16, -20, 8][k], b = buf(190, hgt + 80, 95, hgt + 58), top = [lean, -hgt], pts = bez([[0, 3], [lean * 0.05, -hgt * 0.6], top], 16);
  tube(b, pts, 5, 3.2, K0);
  form(b, K0, TAN, { depth: 4, amb: 0.5, gain: 0.8 });
  for (let y = -hgt; y < 3; y++) if (md(y, 5) === 0) for (let x = -30; x < 30; x++) { const c = get(b, x, y); if (c !== NONE) put(b, x, y, TAN[Math.max(0, TAN.indexOf(c) - 2)]); }
  outline(b);
  const fr = (a, L, far) => { const t = buf(b.w, b.h, b.ox, b.oy); blade(t, top[0], top[1], a, L, LEAFP[far ? 0 : 1], LEAFP[far ? 1 : 3], LEAFP[far ? 2 : 5]); outline(t); stamp(b, t); };
  for (const a of [1.57, 0.5, 2.64, 1.1, 2.04]) fr(a + (hsh(a * 9 + k) - 0.5) * 0.2, 34 + hsh(a * 5 + k) * 8, true);
  for (const a of [-0.3, 3.44, 0.12, 3.02, 0.76, 2.38]) fr(a + (hsh(a * 7 + k) - 0.5) * 0.16, 40 + hsh(a * 3 + k) * 10, false);
  for (const [x, y] of [[-3, 3], [3, 4], [0, 6]]) { oval(b, top[0] + x, top[1] + y, 2.6, 2.6, TAN[0]); put(b, top[0] + x - 1, top[1] + y - 1, TAN[3]); }
  return mk(b, false);
}));
const REEDS = [0, 1].map(k => memo(() => {
  const b = buf(30, 34, 15, 30);
  for (let i = 0; i < 7; i++) { const x = -10 + i * 3 + Math.round(hsh(i + k * 7) * 2), hh = 10 + Math.round(hsh(i * 3.3 + k) * 16), sw = Math.round((hsh(i * 5.1 + k) - 0.5) * 5); line(b, x, 0, x + sw, -hh, i % 2 ? LEAFP[3] : LEAFP[4]); if (i % 3 === k % 3) { rect(b, x + sw - 1, -hh - 3, 2, 5, I('#6a3c1c')); put(b, x + sw - 1, -hh - 3, I('#9a6030')); } }
  outline(b);
  return mk(b, false);
}));
// AREA 3: the bones of Bone Canyon, rock towers, dead trees
const BONE5 = P('#6e5e52', '#9a8a70', '#c8b894', '#e8dcb8', '#fff8e0');
const RIBS = memo(() => {
  const b = buf(190, 116, 16, 104), rib = (i, far) => { const x = 8 + i * 24, top = 58 + Math.sin((i + 0.5) / 6 * Math.PI) * 30; return far ? bez([[x + 12, -3], [x + 2, -top * 0.95], [x + 30, -top - 2], [x + 50, -top * 0.5]], 16) : bez([[x, -1], [x - 16, -top * 1.12], [x + 20, -top - 16], [x + 46, -top * 0.56]], 16); };
  for (let i = 0; i < 6; i++) { const t = buf(b.w, b.h, b.ox, b.oy); tube(t, rib(i, true), 3, 1.2, K0); form(t, K0, BONE5.slice(0, 3), { depth: 3, amb: 0.45 }); stamp(b, t); }
  const sp = buf(b.w, b.h, b.ox, b.oy);                                                        // the backbone, half in the ground
  for (let i = 0; i < 13; i++) oval(sp, 4 + i * 12.5, -2 - Math.sin(i / 12 * Math.PI) * 5, 5.4, 4.4, K0);
  form(sp, K0, BONE5, { depth: 4, amb: 0.5 }); outline(sp); stamp(b, sp);
  for (let i = 0; i < 6; i++) { const t = buf(b.w, b.h, b.ox, b.oy); tube(t, rib(i, false), 4, 1.6, K0); form(t, K0, BONE5, { depth: 4, amb: 0.52, gain: 0.85 }); outline(t); stamp(b, t); }
  return mk(b, false);
});
const SKULL = memo(() => {
  const b = buf(132, 84, 46, 74), DK = I('#2a1a1c');
  poly(b, [[-40, -6], [-42, -34], [-30, -54], [-8, -62], [18, -58], [44, -46], [70, -40], [78, -30], [76, -18], [60, -14], [20, -12], [-6, -4], [-24, 2]], K0);       // the skull
  poly(b, [[-30, 2], [-18, -4], [30, -4], [66, -8], [72, -2], [60, 6], [-20, 8]], K1);                                                                                // the jaw
  form(b, K0, BONE5, { depth: 9, amb: 0.5, gain: 0.85, dither: 0.5 }); form(b, K1, BONE5.slice(0, 4), { depth: 5, amb: 0.5 });
  oval(b, -12, -38, 10, 9, DK); oval(b, -12, -37, 8, 7, I('#160c10'));                                                                                                  // the eye's hole
  poly(b, [[8, -42], [30, -38], [26, -26], [10, -28]], DK); oval(b, 62, -30, 4, 3, DK); oval(b, -30, -30, 4, 6, DK);
  for (let i = 0; i < 9; i++) { const x = 12 + i * 7; poly(b, [[x, -13], [x + 5, -13], [x + 2.5, -5 + (i % 2)]], BONE5[4]); }                                           // teeth
  for (let i = 0; i < 7; i++) { const x = 16 + i * 7; poly(b, [[x, -4], [x + 4, -4], [x + 2, -10]], BONE5[3]); }
  line(b, -26, -50, -20, -40, BONE5[1]); line(b, 40, -44, 46, -32, BONE5[1]); line(b, 2, -56, 6, -46, BONE5[1]);
  outline(b);
  return mk(b, false);
});
const TARBONE = [0, 1].map(k => memo(() => {                                                    // what the tar keeps: ribs and a horn standing out of it
  const b = buf(44, 30, 22, 26);
  if (k === 0) for (let i = 0; i < 4; i++) tube(b, bez([[-12 + i * 7, 2], [-16 + i * 7, -12 - (i % 2) * 4], [-6 + i * 7, -16 - (i % 2) * 4]], 6), 1.6, 0.8, K0);
  else { tube(b, bez([[-8, 2], [-10, -10], [2, -20]], 7), 3, 0.8, K0); tube(b, [[6, 2], [9, -8]], 1.8, 1.2, K0); oval(b, 9, -9, 2.6, 2, K0); }
  form(b, K0, BONE5, { depth: 2, amb: 0.5 }); outline(b);
  return mk(b, false);
}));
const SPIRE = [0, 1, 2].map(k => memo(() => {
  const w = 44 + k * 16, h = 92 + k * 40, b = buf(w, h + 8), T = new Float32Array(w), R0 = rng(900 + k);
  const st = [0.5 + R0() * 0.2, 0.3 + R0() * 0.15];
  for (let x = 0; x < w; x++) { const d = Math.abs(x - w / 2 + 0.5) / (w / 2); T[x] = d > 0.96 ? h + 2 : d > st[0] ? h * (0.34 + (d - st[0]) * 1.25) + (fbm(x * 0.4, k, 5) - 0.5) * 6 : d > st[1] ? h * 0.13 + (d - st[1]) * 30 : (fbm(x * 0.5, k + 3, 6)) * 4; }
  L8.paint.mesa(b, T, [RED[1], RED[2], RED[3], RED[4], RED[6]], { wrap: false, bed: 8, seed: 20 + k });
  b.ox = w >> 1; b.oy = h;
  outline(b);
  return mk(b, false);
}));
const DEAD = [0, 1].map(k => memo(() => {
  const b = buf(80, 90, 40, 84), c = P('#3a2a2c', '#5a4640', '#7e6a5c', '#a89480'), hgt = 56 + k * 16;
  tube(b, [[0, 2], [2 - k * 3, -hgt * 0.5], [-2 + k * 4, -hgt]], 4.2, 1.4, K0);
  for (const [u, dx, dy] of [[0.4, -20, -16], [0.55, 18, -18], [0.72, -14, -14], [0.86, 12, -12]]) { const y = -hgt * u, x = (2 - k * 3) * Math.min(1, u * 2); tube(b, [[x, y], [x + dx * 0.6, y + dy * 0.5], [x + dx, y + dy]], 2, 0.7, K0); tube(b, [[x + dx * 0.6, y + dy * 0.5], [x + dx * 0.7, y + dy * 1.1]], 1.2, 0.6, K0); }
  form(b, K0, c, { depth: 3, amb: 0.5 }); outline(b);
  return mk(b, false);
}));
// AREA 4: black rocks, burnt trunks, vents that smoke
const BROCK = [0, 1, 2].map(k => memo(() => {
  const b = buf(60, 44, 30, 38);
  for (const [cx, cy, rx, ry] of [[[-8, -7, 12, 9], [9, -6, 10, 8], [0, -17, 9, 7]], [[0, -9, 16, 11], [14, -5, 8, 6]], [[-6, -5, 9, 6], [6, -8, 11, 10], [-2, -20, 6, 6], [16, -3, 6, 4]]][k]) {
    const t = buf(b.w, b.h, b.ox, b.oy);
    shape(t, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => { const a = Math.atan2(y - cy, x - cx), q = 1 + 0.14 * Math.sin(a * 3 + k * 2 + cx) + 0.1 * Math.sin(a * 5 + cy); return ((x - cx) / (rx * q)) ** 2 + ((y - cy) / (ry * q)) ** 2 <= 1; }, K0);
    form(t, K0, BAS.slice(1), { depth: 6, amb: 0.42, grain: (x, y) => (fbm(x * 0.4, y * 0.4, 3 + k) - 0.5) * 0.5 }); outline(t); stamp(b, t);
  }
  return mk(b, false);
}));
const BURNT = [0, 1].map(k => memo(() => {
  const b = buf(70, 110, 35, 104), c = P('#0c0810', '#18101a', '#281a26', '#40283a'), hgt = 70 + k * 22;
  tube(b, [[0, 3], [3 - k * 5, -hgt * 0.5], [-1 + k * 3, -hgt]], 5.4, 1.6, K0);
  for (const [u, dx, dy] of [[0.45, -22, -14], [0.62, 20, -20], [0.8, -12, -16]]) { const y = -hgt * u, x = (3 - k * 5) * Math.min(1, u * 2); tube(b, [[x, y], [x + dx * 0.6, y + dy * 0.4], [x + dx, y + dy]], 2.4, 0.8, K0); }
  form(b, K0, c, { depth: 4, amb: 0.5 });
  for (let i = 0; i < 12; i++) { const y = -Math.round(hsh(i * 3.1 + k) * hgt), x = Math.round((hsh(i * 7.7 + k) - 0.5) * 6); if (get(b, x, y) !== NONE) put(b, x, y, i % 3 ? LAVA[1] : LAVA[2]); }
  outline(b);
  return mk(b, false);
}));
// AREA 5: the hatchery's machines; its girders and lamps overhead
const SBLUE = P('#141a30', '#1c2440', '#283252', '#364468', '#4c5c84', '#6c7ea8', '#9aa8cc');
const CONSOLE = memo(() => {
  const b = buf(52, 44, 26, 40);
  poly(b, [[-20, 0], [-20, -18], [-14, -30], [16, -30], [20, -18], [20, 0]], K0); form(b, K0, SBLUE, { depth: 5, amb: 0.5 });
  rect(b, -12, -27, 26, 11, I('#06140e')); for (let i = 0; i < 4; i++) rect(b, -10, -25 + i * 2, 8 + ((i * 7) % 12), 1, i === 2 ? I('#ffcf3a') : I('#3fd15a'));
  for (let i = 0; i < 6; i++) rect(b, -15 + i * 6, -12, 3, 2, [I('#ff3b30'), I('#ffcf3a'), I('#3fd15a')][i % 3]);
  rect(b, -17, -7, 34, 1, SBLUE[1]); rect(b, -17, -6, 34, 1, SBLUE[5]);
  outline(b);
  return mk(b, false);
});
const CRATES = [0, 1].map(k => memo(() => {
  const b = buf(56, 50, 28, 46), box = (x, y, w, h, c) => { rect(b, x, y - h, w, h, c[2]); rect(b, x, y - h, w, 1, c[4]); rect(b, x, y - h, 1, h, c[3]); rect(b, x + w - 1, y - h, 1, h, c[0]); rect(b, x, y - 1, w, 1, c[0]); rect(b, x + 2, y - h + 3, w - 4, 1, c[1]); rect(b, x + 2, y - 4, w - 4, 1, c[1]); };
  const G5 = [GRN[0], GRN[1], GRN[2], GRN[3], GRN[4]], S5 = [STEEL[0], STEEL[1], STEEL[2], STEEL[3], STEEL[4]];
  if (k === 0) { box(-22, 0, 22, 18, S5); box(2, 0, 20, 14, G5); box(-12, -18, 20, 14, G5); oval(b, -2, -25, 3.4, 3.4, I('#f6fbff')); oval(b, -1.5, -25, 1.4, 1.4, I('#e0302a')); }
  else { box(-16, 0, 30, 20, G5); oval(b, -1, -10, 4.6, 4.6, I('#f6fbff')); oval(b, -0.5, -10, 2, 2, I('#e0302a')); box(-10, -20, 18, 12, S5); }
  outline(b);
  return mk(b, false);
}));
const TANK = memo(() => {
  const b = buf(44, 70, 22, 66);
  shape(b, -13, -58, 13, 0, (x, y) => Math.abs(x) < 12 && (y > -50 || (x / 12) ** 2 + ((y + 50) / 8) ** 2 <= 1), K0); form(b, K0, SBLUE.slice(1), { depth: 8, amb: 0.5, gain: 0.9 });
  for (const y of [-40, -14]) { rect(b, -13, y, 26, 3, SBLUE[1]); rect(b, -13, y, 26, 1, SBLUE[5]); }
  rect(b, -5, -32, 10, 14, I('#06140e')); for (let i = 0; i < 9; i++) rect(b, -4, -20 - i, 8, 1, i % 4 === 3 ? GRN[2] : GRN[4]);                                       // its glass: green
  rect(b, 12, -46, 6, 3, SBLUE[4]); rect(b, 16, -46, 3, 46, SBLUE[3]); rect(b, 16, -46, 1, 46, SBLUE[5]);
  for (let x = -12; x < 12; x++) for (let j = 0; j < 3; j++) put(b, x, -3 + j, HAZ[((x + j + 40) >> 2) % 2]);
  outline(b);
  return mk(b, false);
});
const CEIL = memo(() => {
  const b = buf(LW, 46, 0, 12);
  for (let x = 0; x < LW; x++) for (let y = -12; y < 14; y++) {
    const gx = md(x, 80);
    let c = y < 2 ? SBLUE[0] : y < 4 ? SBLUE[4] : y < 5 ? SBLUE[1] : y > 11 ? (y === 12 ? SBLUE[5] : SBLUE[1]) : Math.abs(md(gx + (y - 5) * 5, 80) - 40) < 3 || Math.abs(md(gx - (y - 5) * 5, 80) - 40) < 3 ? SBLUE[3] : NONE;
    if (gx < 4 && y >= 2) c = gx === 0 ? SBLUE[5] : SBLUE[3];
    if (c !== NONE) put(b, x, y, c);
  }
  for (let x = 80; x < LW; x += 160) { rect(b, x - 1, 14, 2, 8, SBLUE[1]); poly(b, [[x - 9, 30], [x - 5, 22], [x + 5, 22], [x + 9, 30]], SBLUE[3]); rect(b, x - 5, 22, 10, 1, SBLUE[6]); rect(b, x - 8, 30, 16, 2, I('#d8ffd0')); rect(b, x - 6, 32, 12, 1, I('#9dff8a')); }
  return bakeL(b);
});
// AREA 6: MEGA OGGLE's rocket and its tower, the pad's lamps and fence
const NSTEEL = P('#121a36', '#1c2748', '#2a3860', '#3e4e7c', '#5a6a9c', '#8292c0');
const ROCKET = memo(() => {
  const b = buf(96, 204, 48, 196), WH = P('#4a5470', '#7480a0', '#a4b0c8', '#d2dae8', '#f6f8fc'), hw = y => y < -128 ? 15 * Math.sqrt(Math.max(0, 1 - ((-128 - y) / 46) ** 2)) : 15;
  poly(b, [[-14, -58], [-38, -10], [-38, 0], [-14, -16]], K1); poly(b, [[14, -58], [38, -10], [38, 0], [14, -16]], K1);
  poly(b, [[-10, -16], [10, -16], [14, -3], [-14, -3]], K2);
  shape(b, -16, -176, 16, -14, (x, y) => Math.abs(x) < hw(y), K0);
  form(b, K0, WH, { depth: 13, amb: 0.52, gain: 0.95, dither: 0.6 }); form(b, K1, GRN, { depth: 5, amb: 0.45 }); form(b, K2, STEEL, { depth: 4, amb: 0.4 });
  const swap = (y0, y1, to) => { for (let y = y0; y < y1; y++) for (let x = -16; x < 16; x++) { const i = WH.indexOf(get(b, x, y)); if (i >= 0) put(b, x, y, to[Math.min(to.length - 1, i + (to === GRN ? 1 : 0))]); } };
  swap(-176, -130, GRN); swap(-70, -62, GRN); swap(-22, -14, GRN);
  for (let y = -100; y < -92; y++) for (let x = -16; x < 16; x++) if (WH.indexOf(get(b, x, y)) >= 0 && ((x + 16) >> 2) % 2 === (y < -96 ? 0 : 1)) put(b, x, y, I('#16141e'));
  oval(b, 0, -114, 7.5, 7.5, STEEL[1]); oval(b, 0, -114, 6, 6, STEEL[4]); oval(b, 0, -114, 4.6, 4.6, I('#10284a')); rect(b, -3, -117, 2, 2, I('#8fd0ff'));
  oval(b, 0, -82, 6.5, 6.5, I('#16141e')); oval(b, 0, -82, 5.4, 5.4, I('#f6fbff')); oval(b, 1, -82, 2.6, 2.6, I('#e0302a')); oval(b, 1, -82, 1.1, 1.1, I('#1a0a12'));
  for (const y of [-130, -62, -36]) for (let x = -15; x < 15; x += 5) if (get(b, x, y) !== NONE) put(b, x, y, WH[0]);
  rect(b, -1, -58, 2, 44, GRN[1]);
  outline(b);
  return mk(b, false);
});
const GANTRY = memo(() => {
  const b = buf(80, 200, 22, 192);
  for (let y = -180; y < 0; y++) for (const x of [-14, 12]) { put(b, x, y, NSTEEL[4]); put(b, x + 1, y, NSTEEL[2]); put(b, x + 2, y, NSTEEL[1]); }
  for (let y = -180; y < 0; y += 20) { rect(b, -14, y, 29, 2, NSTEEL[3]); rect(b, -14, y, 29, 1, NSTEEL[5]); line(b, -13, y + 2, 12, y + 19, NSTEEL[2]); line(b, 12, y + 2, -13, y + 19, NSTEEL[1]); }
  for (const y of [-150, -96, -44]) { rect(b, 14, y, 30, 4, NSTEEL[3]); rect(b, 14, y, 30, 1, NSTEEL[5]); for (let x = 14; x < 44; x++) put(b, x, y + 3, HAZ[(x >> 2) % 2]); rect(b, 42, y - 3, 3, 10, NSTEEL[4]); }
  rect(b, -8, -190, 16, 10, NSTEEL[2]); rect(b, -8, -190, 16, 1, NSTEEL[5]); rect(b, -1, -196, 2, 6, NSTEEL[4]);
  outline(b);
  return mk(b, false);
});
const LAMP = memo(() => {
  const b = buf(40, 104, 20, 100);
  rect(b, -1, -86, 3, 86, NSTEEL[3]); rect(b, -1, -86, 1, 86, NSTEEL[5]); rect(b, -5, -3, 11, 3, NSTEEL[2]);
  rect(b, -12, -88, 25, 3, NSTEEL[3]);
  for (const x of [-12, 6]) { poly(b, [[x, -95], [x + 7, -95], [x + 9, -88], [x - 2, -88]], NSTEEL[4]); rect(b, x - 1, -88, 9, 2, I('#fff6c8')); }
  outline(b);
  return mk(b, false);
});
const FENCE = memo(() => {
  const b = buf(96, 44, 0, 42);
  for (let x = 0; x < 96; x++) for (let y = -34; y < -2; y++) if (md(x + y, 6) === 0 || md(x - y, 6) === 0) put(b, x, y, NSTEEL[2]);
  rect(b, 0, -36, 96, 2, NSTEEL[3]); rect(b, 0, -36, 96, 1, NSTEEL[5]); rect(b, 0, -3, 96, 2, NSTEEL[2]);
  for (const x of [0, 48]) { rect(b, x, -40, 3, 40, NSTEEL[3]); rect(b, x, -40, 1, 40, NSTEEL[5]); }
  return mk(b, false);
});
const FUEL = memo(() => {
  const b = buf(70, 40, 35, 36);
  shape(b, -28, -26, 28, -4, (x, y) => Math.abs(x) < 20 || ((Math.abs(x) - 20) / 8) ** 2 + ((y + 15) / 11) ** 2 <= 1, K0); form(b, K0, NSTEEL, { depth: 8, amb: 0.5, gain: 0.9 });
  for (const x of [-16, 14]) { rect(b, x, -4, 4, 4, NSTEEL[2]); rect(b, x - 1, -27, 5, 23, NSTEEL[1]); rect(b, x - 1, -27, 1, 23, NSTEEL[4]); }
  for (let x = -8; x < 8; x++) for (let j = 0; j < 4; j++) put(b, x, -17 + j, HAZ[((x + j + 40) >> 2) % 2]);
  outline(b);
  return mk(b, false);
});
// --- where things stand ---
const LAMPS5 = [], LAMPS6 = [7150, 7352, 7600];
{
  // AREA 1: the jungle. Giants behind the turf; ferns, leaves and flowers on it; the pod in its crater
  [[52, 0], [236, 2], [498, 1], [668, 0], [884, 2], [1066, 1], [1196, 0], [1392, 2]].forEach(([x, k]) => add(x, TRUNK[k], { back: true, dy: 2 }));
  add(388, POD, { back: true, dy: 13 });
  for (let x = 14; x < 1440; x += 22) {
    const h = hsh(x * 0.713), h2 = hsh(x * 1.37 + 5);
    if (scorch(x) > 0 || scorch(x + 14) > 0 || scorch(x - 14) > 0) continue;
    if (h < 0.2) add(x + Math.round(h2 * 12), FERN[Math.floor(h2 * 3)], { dy: 2 });
    else if (h < 0.28) add(x, LEAFY, { dy: 2 });
    else if (h < 0.66) add(x + Math.round(h2 * 10), SMALL[Math.floor(h2 * 4)], { dy: 1 });
  }
  // AREA 2: palms on the banks (never in a pool), reeds where the water starts, a few flowers
  [[1476, 0], [1584, 1], [1926, 2], [2010, 0], [2046, 1], [2368, 2], [2520, 0], [2640, 1], [2770, 2], [2866, 0]].forEach(([x, k]) => add(x, PALMW[k], { back: true, dy: 2 }));
  for (const n of L8.level.pools) if (n.k === 'water') for (const x of [n.x0 - 6, n.x0 + 10, n.x1 - 12, n.x1 + 5, n.x0 + 96, n.x1 - 80]) add(x, REEDS[Math.round(hsh(x)) % 2], { back: true, dy: 3 });
  for (let x = 1470; x < 2890; x += 34) { const h = hsh(x * 0.917); if (!L8.level.pools.some(n => x > n.x0 - 16 && x < n.x1 + 16) && h < 0.4) add(x + Math.round(h * 20), SMALL[Math.floor(h * 7.4)], { dy: 1 }); }
  // AREA 3: rock towers behind the ledges, the great ribs, dead trees, the skull over CLUBTAIL's ground
  [[2950, 1], [3104, 0], [3270, 2], [3470, 0], [3690, 1], [3830, 2], [4130, 0], [4268, 1]].forEach(([x, k]) => add(x, SPIRE[k], { back: true, dy: 6 }));
  add(3020, RIBS, { back: true, dy: 4 }); add(3930, SKULL, { back: true, dy: 5 }); add(3600, RIBS, { back: true, dy: 9 });
  [[2936, 0], [3216, 1], [3520, 0], [3762, 1], [4190, 0]].forEach(([x, k]) => add(x, DEAD[k], { back: true, dy: 3 }));
  for (const n of L8.level.pools) if (n.k === 'tar') { add(n.x0 + 34, TARBONE[0], { back: true, y: n.y + 2 }); add(n.x1 - 30, TARBONE[1], { back: true, y: n.y + 2 }); }
  // AREA 4: black rocks, burnt trees
  for (let x = 4340; x < 5480; x += 58) { const h = hsh(x * 0.377), xx = x + Math.round(h * 30); if (h < 0.42) add(xx, BROCK[Math.floor(h * 7.1)], { back: true, dy: 4 }); else if (h < 0.72) add(xx, BURNT[Math.floor(h * 13) % 2], { back: true, dy: 3 }); }
  add(5650, BROCK[1], { back: true, dy: 4 });
  // AREA 5: machines along the wall (clear of the nests and cages), lamps overhead
  [[5760, CRATES[0]], [5850, TANK], [5930, CONSOLE], [6080, CRATES[1]], [6190, TANK], [6330, CONSOLE], [6400, CRATES[0]], [6560, TANK], [6620, CRATES[1]], [6760, CONSOLE], [6880, TANK], [6960, CRATES[0]]].forEach(([x, s]) => add(x, s, { back: true, dy: 1 }));
  for (let x = Math.ceil((X4 - 80) / 160) * 160 + 80; x < X5; x += 160) if (x > X4 + 20 && x < X5 - 20) LAMPS5.push(x);
  // AREA 6: the pad: fence, fuel, lamps, the rocket in its tower
  for (let x = X5 + 34; x < 7900; x += 96) add(x, FENCE, { back: true, dy: 1 });
  add(7300, FUEL, { back: true, dy: 1 }); add(7120, FUEL, { back: true, dy: 1 });
  for (const x of LAMPS6) add(x, LAMP, { back: true, dy: 1 });
  add(7482, GANTRY, { back: true, dy: 1 }); add(7528, ROCKET, { back: true, dy: 1 });
}

// ---------------------------------------------------------------------------------------------------------------------
// The hooks
// ---------------------------------------------------------------------------------------------------------------------
function drawDecor(cx, back) {
  for (const d of DECOR) {
    if (d.back !== back || d.x < cx - 170 || d.x > cx + W + 170) continue;
    const s = d.spr();
    ctx.drawImage(s.img, d.x - s.ox, d.y - s.oy);
  }
}
function smoke(x, y, n, col, rise = 46) {
  for (let i = 0; i < n; i++) { const ph = md(G.t * 0.5 + i * rise / n, rise), r = 2 + Math.floor(ph / 9), a = clamp(1 - ph / rise, 0, 1) * 0.6; ctx.fillStyle = 'rgba(' + col + ',' + a.toFixed(2) + ')'; ctx.fillRect(Math.round(x + Math.sin(ph / 9 + i * 2) * 3 + ph * 0.25) - r, Math.round(y - ph) - r, r * 2, r * 2 - 1); }
}
const dawnK = () => L8.dawnK ? L8.dawnK() : 0;
// a cone of light falling from (x, y) to the floor at gy
function cone(x, y, gy, hw, col, a) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.lineTo(x + hw, gy); ctx.lineTo(x - hw, gy); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.lineTo(x + hw * 0.5, gy); ctx.lineTo(x - hw * 0.5, gy); ctx.fill();
  ctx.restore();
}
L8.drawBehind = function (cx) {
  // the leaves overhead (jungle only)
  if (cx < 1460) { const t = FRINGE(), x0 = Math.floor(cx / LW) * LW; ctx.save(); ctx.beginPath(); ctx.rect(-40, -20, 1440, 140); ctx.clip(); for (let x = x0; x < cx + W + 10; x += LW) ctx.drawImage(t.c, x, t.y); ctx.restore(); }
  // the hatchery's girders and lamps (between its walls)
  if (cx + W + 10 > X4 && cx - 10 < X5) {
    const t = CEIL(), x0 = Math.floor(cx / LW) * LW;
    ctx.save(); ctx.beginPath(); ctx.rect(X4, -20, X5 - X4, H + 40); ctx.clip();
    for (let x = x0; x < cx + W + 10; x += LW) ctx.drawImage(t.c, x, t.y);
    for (const x of LAMPS5) if (x > cx - 80 && x < cx + W + 80) { cone(x, 33, Math.round(gAt(x)), 58, '#8dffa0', 0.06 + 0.01 * Math.sin(G.t / 9 + x)); M8.glow(x, 32, 13, '#b6ff9a', 0.5); }
    ctx.restore();
  }
  drawDecor(cx, true);
  if (cx < 520) smoke(402, 190, 5, '70,64,76');
  // the pad's lamps burn until morning; the rocket's beacon blinks
  if (cx + W > X5) {
    const k = dawnK();
    if (k < 1) for (const x of LAMPS6) if (x > cx - 90 && x < cx + W + 90) { const gy = Math.round(gAt(x)); cone(x - 8, gy - 86, gy, 64, '#fff0b0', 0.07 * (1 - k)); cone(x + 10, gy - 86, gy, 64, '#fff0b0', 0.07 * (1 - k)); M8.glow(x - 8, gy - 86, 10, '#fff0b0', 0.6 * (1 - k)); M8.glow(x + 10, gy - 86, 10, '#fff0b0', 0.6 * (1 - k)); }
    if (Math.floor(G.t / 30) % 2 && k < 1) { const gy = Math.round(gAt(7482)); R(7481, gy - 198, 3, 3, '#ff3b30'); M8.glow(7482, gy - 197, 9, '#ff3b30', 0.6); }
  }
};
L8.drawGround = function (cx) {
  for (let ti = Math.floor((cx - 12) / TW); ti * TW < cx + W + 12; ti++) { const t = groundTile(ti); ctx.drawImage(t.c, t.x, t.y); }
  // lava glows in the basalt's cracks
  if (cx + W > 4300 && cx < X4) for (let x = Math.floor(cx / 90) * 90; x < cx + W + 40; x += 90) if (x > 4330 && x < X4 - 40) M8.glow(x + hsh(x) * 50, gAt(x) + 22 + hsh(x * 3) * 14, 26, '#ff5a1e', 0.2 + 0.1 * Math.sin(G.t / 19 + x));
  drawPools(cx, false);
  drawDecor(cx, false);
  // the hatchery's far door: its dark inside, behind whoever walks through
  if (cx + W + 20 > EXIT && cx - 60 < EXIT && L8.chase) blit(L8.chase.gateArt().jamb, EXIT - 1, Math.round(gAt(EXIT + 14)) - 72);
  if (L8.chase) L8.chase.drawGround(cx);
};
L8.drawPlat = function (pl) { RO(pl.x, pl.y, pl.w, 6, '#8a7a5a'); };
L8.drawFront = function (cx) {
  ctx.save(); ctx.translate(-cx, 0);
  drawPools(cx, true);
  // the wall over the far door, its lamp (green: the way is open)
  if (cx + W + 20 > EXIT && cx - 60 < EXIT && L8.chase) {
    const gy = Math.round(gAt(EXIT + 14));
    blit(L8.chase.gateArt().wall, EXIT - 3, gy - 230);
    R(EXIT + 12, gy - 107, 5, 7, '#3fd15a'); R(EXIT + 11, gy - 106, 7, 5, '#3fd15a'); R(EXIT + 13, gy - 105, 3, 3, '#1a0a12'); R(EXIT + 12, gy - 106, 2, 2, '#ffffff');
    M8.glow(EXIT + 14, gy - 104, 14, '#3fd15a', 0.4);
  }
  M8.rings();            // the landing rings the robots and their shots asked for: over the hero, the robots, the water
  ctx.restore();
  if (L8.chase) L8.chase.drawFront(cx);
  if (L8.bossFront) L8.bossFront(cx);
};
// light over everything: the jungle's morning sun in shafts; a warm wash when the last morning comes
L8.drawOverlay = function (cx) {
  const a1 = clamp((1420 - cx - W / 2) / 240, 0, 1);
  if (a1 > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffe9a0';
    for (let i = 0; i < 5; i++) {
      const x = md(i * 150 + 60 - cx * 0.6, 750) - 140, wd = 22 + (i % 3) * 14;
      ctx.globalAlpha = a1 * (0.05 + 0.025 * Math.sin(G.t / 50 + i * 2));
      ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + wd, -10); ctx.lineTo(x + wd + 150, 236); ctx.lineTo(x + 150 - wd * 0.3, 236); ctx.fill();
    }
    ctx.restore();
  }
  const k = dawnK();
  if (k > 0 && cx + W > X5) { ctx.fillStyle = 'rgba(255,214,150,' + (0.12 * k).toFixed(3) + ')'; ctx.fillRect(-10, -10, W + 20, H + 20); }
};
// Painting ahead of the hero (queued once; the mission, its menus and its briefing pump it). The far pictures of all
// six areas come first: they are the big ones (up to two frames of work each), and so they are painted while the
// menus and the briefing show, where a late frame is not seen. Then what stands in each area, in the order the hero
// meets it: small pictures that the opening scene and the first steps can take.
let warmed = false;
L8.sceneWarm = function () {
  if (warmed) return;
  warmed = true;
  const tiles = (a, b) => { for (let i = Math.floor(a / TW); i * TW < b; i++) M8.warm(() => groundTile(i)); };
  for (let i = 0; i < L8.AREAS.length; i++) L8.warmBackdrop(i);
  M8.warm(FRINGE, ...TRUNK, ...FERN, LEAFY, ...SMALL, POD); tiles(-240, 1700);
  M8.warm(...PALMW, ...REEDS); tiles(1700, 3140); for (const n of L8.level.pools) M8.warm(() => poolArt(n));
  M8.warm(...SPIRE, RIBS, SKULL, ...DEAD, ...TARBONE); tiles(3140, 4540);
  M8.warm(...BROCK, ...BURNT); tiles(4540, 5980);
  M8.warm(CEIL, CONSOLE, ...CRATES, TANK); tiles(5980, 7300);
  M8.warm(FENCE, FUEL, LAMP, GANTRY, ROCKET); tiles(7300, 8160);
};
// Hero select while Mission 8 is chosen: the crash site
L8.menuBG = function () {
  const cx = 170;
  L8.drawBG(cx);
  ctx.save(); ctx.translate(-cx, 0); L8.drawBehind(cx); L8.drawGround(cx); ctx.restore();
  L8.sceneWarm(); L8.bakeSome(5);
};
// A view of the valley without robots, hero or the level's pieces (story.js's cards): the far picture, the ground and
// what stands on it as the camera at cx sees them; actors() draws whoever is there (world space), then the water's
// front and the light come over them
L8.vista = function (cx, actors) {
  L8.drawBG(cx);
  const F = FLASH;
  ctx.save();
  try {
    ctx.translate(-cx, 0);
    L8.drawBehind(cx);
    for (let ti = Math.floor((cx - 12) / TW); ti * TW < cx + W + 12; ti++) { const t = groundTile(ti); ctx.drawImage(t.c, t.x, t.y); }
    drawPools(cx, false);
    drawDecor(cx, false);
    FLASH = false;
    if (actors) actors();
    FLASH = F;
    drawPools(cx, true);
  } finally { FLASH = F; ctx.restore(); }
  L8.drawOverlay(cx);
};
// The mission card (screen space, clipped by the caller; no G.p, LV may be another mission): dawn, the volcano, the
// hero and a baby dinosaur in the grass, and the OGGLE REX looking in
L8.card = function (x, y, w, h) {
  const A = L8.AREAS[0], gy = y + h - 13, far = A.layers[0].get(), near = A.layers[2].get(), s = A.sky(), t = groundTile(0);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h + 13); ctx.clip();
  ctx.drawImage(s.c, 78, 94, w, h + 13, x, y, w, h + 13);
  ctx.drawImage(far.c, 236, 0, 264, far.h, Math.round(x + w * 0.5) - 66, gy - Math.round((196 - far.y) / 2), 132, Math.round(far.h / 2));
  ctx.drawImage(near.c, 300, 0, w, near.h, x, gy - (212 - near.y), w, near.h);
  ctx.drawImage(t.c, 20, 0, w, t.h, x, gy - (226 - t.y), w, t.h);
  const F = FLASH; FLASH = false;
  M8.rex(x + w + 84, gy + 62, -1, { body: 'idle:0', head: [78, -106 + Math.sin(G.t / 34) * 2], ha: 0.3, jaw: Math.floor(G.t / 50) % 3 ? 0.5 : 1, mood: Math.floor(G.t / 70) % 4 === 3 ? 'warn' : 'look', pilot: 'drive', look: [0.8, 0.6], t: G.t });
  M8.hatchling(Math.round(x + w * 0.4), gy, -1, { v: 0, pose: 'hop', t: G.t });
  drawHero(HEROES[G.hero || 0], Math.round(x + w * 0.2), gy, 1, { pose: 'idle', aim: 'fwd', t: G.t || 0 });
  FLASH = F;
  ctx.restore();
  // (every way into the mission passes its briefing, and nothing moves there but the text: twice the time a frame)
  L8.sceneWarm(); L8.bakeSome(typeof STORY !== 'undefined' && STORY.briefing && STORY.briefing() ? 10 : 5);
};
}
