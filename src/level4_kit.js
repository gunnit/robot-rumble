'use strict';
// ============================================================
// Mission 4 kit (looks only, no behaviour change; loads after level4.js):
//  - L4.drawSub(x, y, dir, hp, pilot, t): the yellow mini-sub, same size as before. Baked pixel art: shaded hull with a
//    blue stripe and rivets, a glass canopy with the pilot's head inside (an empty seat when parked), conning tower
//    and periscope, tail fins, a spinning propeller in its shroud, the bubble cannon on the nose (shots leave there),
//    a small headlamp with a short soft glow (no big see-through cone). Damage shows on the hull (dents, a cracked
//    canopy, a blinking warning light and sparks at 1 hp).
//  - Rescue cages for the seven friendly animals (POW_KINDS.ocean{fish,star,horse,octopus,dolphin,ray,cuttle}.draw),
//    in the Missions 2/3 cage style: steel bars, a riveted top plate with a robot eye that blinks and watches the hero,
//    a hazard-striped base, the white HELP! bubble; underwater the cage hangs on a chain from an anchor block on the
//    seabed. The animals (clownfish, starfish, sea horse, octopus, dolphin, spotted eagle ray, cuttlefish) are painted
//    pixel sprites with an OUT outline: nervous in the cage, excited when the hero comes close, a happy burst with
//    hearts when freed, then they swim off up and away. Same boxes as level4.js.
//  - Pickups: ITEMS.oceanPearl (a pearl in an open scallop shell) and ITEMS.oceanCharge (a torpedo crate marked C).
// Deterministic (hsh and the frame counters only), sprites baked once at load.
// ============================================================
var L4 = L4 || {};
{
const Math = globalThis.Math;
const TAU = Math.PI * 2;
// ------------------------------------------------------------ pixel buffers (Int32 colours, -1 empty)
const NONE = -1, I = s => parseInt(s.slice(1, 7), 16), OUTI = I(OUT);
function buf(w, h, ox, oy) { const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox, oy }; }
function put(b, x, y, c) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
function ell(b, cx, cy, rx, ry, c) {
  for (let j = Math.floor(cy - ry - 1); j <= Math.ceil(cy + ry + 1); j++) for (let i = Math.floor(cx - rx - 1); i <= Math.ceil(cx + rx + 1); i++) {
    const u = (i + 0.5 - cx) / (rx + 0.35), v = (j + 0.5 - cy) / (ry + 0.35);
    if (u * u + v * v <= 1) put(b, i, j, c);
  }
}
function line(b, x0, y0, x1, y1, c, t = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 1.5)), h = (t - 1) / 2;
  for (let i = 0; i <= n; i++) rect(b, Math.round(x0 + (x1 - x0) * i / n - h), Math.round(y0 + (y1 - y0) * i / n - h), t, t, c);
}
function poly(b, pts, c) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const sy = y + 0.5, xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[j];
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + (sy - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b2) => a - b2);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) put(b, x, y, c);
  }
}
function stamp(b, x, y, rows, pal) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] !== '.') put(b, x + i, y + j, pal[rows[j][i]]); }
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
  const c = document.createElement('canvas'); c.width = b.w; c.height = b.h;
  const g = c.getContext('2d'), im = g.createImageData(b.w, b.h), dd = im.data;
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = i * 4;
    if (white && v !== OUTI) dd[j] = dd[j + 1] = dd[j + 2] = 255;
    else { dd[j] = v >> 16 & 255; dd[j + 1] = v >> 8 & 255; dd[j + 2] = v & 255; }
    dd[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// sprite: image + white flash copy, anchor = buffer origin
const sprite = b => ({ img: bake(b), white: bake(b, true), w: b.w, h: b.h, ax: b.ox, ay: b.oy });
function blit(s, x, y) { ctx.drawImage(FLASH ? s.white : s.img, Math.round(x) - s.ax, Math.round(y) - s.ay); }
// shade every painted cell of colour `c` by its height inside the shape: top rows -> lit, bottom rows -> dark
function shadeV(b, c, lit, dark, kTop = 0.34, kBot = 0.7) {
  for (let x = 0; x < b.w; x++) {
    let top = -1, bot = -1;
    for (let y = 0; y < b.h; y++) if (b.d[y * b.w + x] !== NONE) { if (top < 0) top = y; bot = y; }
    if (top < 0) continue;
    for (let y = top; y <= bot; y++) {
      const i = y * b.w + x;
      if (b.d[i] !== c) continue;
      const q = (y - top) / Math.max(1, bot - top);
      if (q < kTop && (y - top) < 4) b.d[i] = lit; else if (q > kBot) b.d[i] = dark;
    }
  }
}
function eye(b, x, y, happy, big) {
  if (happy) { put(b, x - 1, y + 1, OUTI); put(b, x, y, OUTI); put(b, x + 1, y, OUTI); put(b, x + 2, y + 1, OUTI); return; }
  rect(b, x - 1, y - 1, big ? 4 : 3, big ? 4 : 3, I('#ffffff'));
  rect(b, x + (big ? 1 : 0), y, 2, big ? 3 : 2, I('#1a2030')); put(b, x + (big ? 1 : 0), y, I('#ffffff'));
}

// ============================================================
// THE MINI-SUB (feet at 0,0, facing right; the old drawing's size: hull about 64 x 34, shots leave at (34, -17))
// ============================================================
const SUBP = { y: [I('#7a3e0c'), I('#c2701a'), I('#eaa126'), I('#fbc83a'), I('#ffe57c')], b: [I('#173a66'), I('#245c9c'), I('#3f86c8'), I('#7ab8e8')],
  m: [I('#3b424d'), I('#6b7584'), I('#a3adba'), I('#d8dee6')], gl: I('#8fdbe8'), glL: I('#d8fbff'), cab: I('#16344a'), cabL: I('#24506a') };
const DOME = { x: 11, y: -25, rx: 10, ry: 9 };                  // the canopy window (pilot head inside)
const inDome = (x, y) => { const u = (x + 0.5 - DOME.x) / DOME.rx, v = (y + 0.5 - DOME.y) / DOME.ry; return u * u + v * v <= 1; };
function subBody() {
  const b = buf(96, 60, 48, 50);
  // tail fins and the conning tower first (the hull overlaps their roots)
  poly(b, [[-24, -27], [-34, -40], [-38, -40], [-32, -24]], SUBP.b[1]); poly(b, [[-27, -30], [-34, -39], [-36, -39]], SUBP.b[2]);
  poly(b, [[-24, -8], [-34, 3], [-38, 3], [-32, -10]], SUBP.b[0]); line(b, -33, -38, -26, -28, SUBP.b[3]);
  rect(b, -14, -39, 13, 8, SUBP.b[1]); rect(b, -14, -39, 13, 2, SUBP.b[2]); rect(b, -14, -39, 2, 8, SUBP.b[2]); rect(b, -3, -37, 2, 6, SUBP.b[0]);
  rect(b, -11, -36, 3, 3, SUBP.gl); put(b, -11, -36, SUBP.glL); rect(b, -6, -36, 2, 2, SUBP.m[2]);
  rect(b, -9, -47, 2, 9, SUBP.m[1]); rect(b, -9, -47, 1, 9, SUBP.m[2]); rect(b, -9, -48, 6, 3, SUBP.m[1]); rect(b, -9, -48, 6, 1, SUBP.m[3]); rect(b, -4, -48, 2, 3, SUBP.gl);
  // the hull: lit from the upper left
  const hx = -2, hy = -17, rx = 31, ry = 16;
  for (let y = hy - ry - 1; y <= hy + ry + 1; y++) for (let x = hx - rx - 1; x <= hx + rx + 1; x++) {
    const u = (x + 0.5 - hx) / rx, v = (y + 0.5 - hy) / ry;
    if (u * u + v * v > 1) continue;
    const lam = -0.42 * u - 0.9 * v + 0.12;
    put(b, x, y, SUBP.y[lam > 0.82 ? 4 : lam > 0.35 ? 3 : lam > -0.25 ? 2 : lam > -0.7 ? 1 : 0]);
  }
  // nose shine, keel shadow
  for (let x = 6; x < 20; x++) put(b, x, -31 + Math.round(Math.pow((x - 6) / 14, 2) * 3), SUBP.y[4]);
  // the blue stripe with rivets
  for (let x = hx - rx; x <= hx + rx; x++) for (let y = -16; y <= -13; y++) {
    if (get(b, x, y) === NONE || !SUBP.y.includes(get(b, x, y))) continue;
    const u = (x - hx) / rx;
    put(b, x, y, y === -16 ? SUBP.b[3 - (u > 0.6 ? 1 : 0)] : y === -13 ? SUBP.b[0] : SUBP.b[u > 0.75 ? 1 : 2]);
  }
  for (let x = -28; x <= 24; x += 6) for (const y of [-19, -10]) if (SUBP.y.includes(get(b, x, y))) { put(b, x, y, SUBP.y[0]); put(b, x, y - 1, SUBP.y[4]); }
  // a porthole at the back
  ell(b, -19, -23, 3, 3, SUBP.m[1]); ell(b, -19, -23, 2, 2, SUBP.gl); put(b, -20, -24, SUBP.glL); put(b, -18, -22, SUBP.b[2]);
  // the bubble cannon on the nose (shots leave at 34, -17), a headlamp under it
  rect(b, 26, -20, 9, 5, SUBP.m[1]); rect(b, 26, -20, 9, 1, SUBP.m[3]); rect(b, 26, -16, 9, 1, SUBP.m[0]);
  rect(b, 34, -21, 3, 7, SUBP.m[2]); rect(b, 36, -20, 1, 5, SUBP.m[0]); put(b, 35, -21, SUBP.m[3]);
  ell(b, 25, -8, 2, 2, SUBP.m[1]); ell(b, 25, -8, 1, 1, I('#fff6c0')); put(b, 25, -9, I('#ffffff'));
  // the canopy: brass rim, the cabin behind the glass (seat back and a little steering wheel)
  ell(b, DOME.x, DOME.y, DOME.rx + 1.6, DOME.ry + 1.6, SUBP.y[0]); ell(b, DOME.x, DOME.y, DOME.rx + 0.8, DOME.ry + 0.8, I('#e0a030'));
  for (let y = DOME.y - DOME.ry - 1; y <= DOME.y + DOME.ry + 1; y++) for (let x = DOME.x - DOME.rx - 1; x <= DOME.x + DOME.rx + 1; x++) if (inDome(x, y)) put(b, x, y, y > DOME.y + 4 ? SUBP.cabL : SUBP.cab);
  rect(b, 3, -29, 3, 10, I('#3a2a24')); rect(b, 3, -29, 1, 10, I('#5a4436'));
  line(b, 15, -19, 17, -23, SUBP.m[1]); ell(b, 17, -24, 1.5, 1.5, SUBP.m[2]); put(b, 17, -24, SUBP.cab);
  outline(b);
  return b;
}
// the canopy front: everything round the window inside its box (so a pilot's head clipped to the box never shows
// past the round glass) plus the glints on the glass
function subFrame(body) {
  const b = buf(body.w, body.h, body.ox, body.oy);
  for (let y = DOME.y - DOME.ry - 3; y <= DOME.y + DOME.ry + 3; y++) for (let x = DOME.x - DOME.rx - 3; x <= DOME.x + DOME.rx + 3; x++) if (!inDome(x, y)) put(b, x, y, get(body, x, y));
  for (const [x, y] of [[5, -29], [5, -30], [6, -31], [7, -32], [8, -33], [9, -33], [4, -27], [4, -26]]) put(b, x, y, SUBP.glL);
  for (const [x, y] of [[17, -31], [18, -30], [16, -18]]) put(b, x, y, I('#b8f0f8'));
  return b;
}
function subProp(f) {
  const b = buf(16, 26, 8, 13);
  // three blade positions turning round the hub (seen edge-on: long, mid, short)
  const L = [9, 6, 3][f], lean = [0, 1, 0][f];
  rect(b, -2, -2, 3, 4, SUBP.m[1]); put(b, -2, -2, SUBP.m[3]);
  line(b, -1 - lean, -2, -1 - lean, -2 - L, SUBP.m[2], 2); line(b, -1 + lean, 2, -1 + lean, 2 + L, SUBP.m[1], 2);
  outline(b);
  // the shroud ring (open in the middle so the blades show)
  for (let y = -11; y <= 11; y++) { put(b, -5, y, Math.abs(y) > 9 ? OUTI : SUBP.b[0]); put(b, 3, y, Math.abs(y) > 9 ? OUTI : SUBP.b[2]); }
  rect(b, -5, -12, 9, 2, SUBP.b[1]); rect(b, -5, 10, 9, 2, SUBP.b[0]); rect(b, -6, -13, 11, 1, OUTI); rect(b, -6, 12, 11, 1, OUTI);
  return b;
}
const SUB = (() => { const body = subBody(); return { body: sprite(body), frame: sprite(subFrame(body)), prop: [0, 1, 2].map(f => sprite(subProp(f))) }; })();
L4.drawSub = function (x, y, dir, hp, pilot, t) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(dir, 1);
  // a short soft glow in front of the headlamp (stepped, low alpha: it never hides what is in front of the sub)
  ctx.fillStyle = 'rgba(255,246,190,0.10)'; ctx.fillRect(27, -12, 10, 8); ctx.fillRect(37, -13, 8, 10);
  ctx.fillStyle = 'rgba(255,246,190,0.06)'; ctx.fillRect(45, -14, 10, 12);
  blit(SUB.prop[Math.floor(t / (pilot == null ? 6 : 2)) % 3], -40, -17);
  blit(SUB.body, 0, 0);
  if (pilot != null && HEROES[pilot]) {
    ctx.save(); ctx.beginPath(); ctx.rect(DOME.x - DOME.rx, DOME.y - DOME.ry, DOME.rx * 2 + 1, DOME.ry * 2 + 1); ctx.clip();
    spr(HEROES[pilot].head, 5, -34);
    ctx.restore();
  }
  blit(SUB.frame, 0, 0);
  // damage: dents and scorch, a cracked canopy, the warning light and sparks at the last point
  if (hp < 4) { R(-24, -27, 3, 1, '#7a3e0c'); R(-23, -26, 1, 2, '#7a3e0c'); R(-6, -6, 4, 1, '#7a3e0c'); R(-5, -5, 2, 1, '#c2701a'); }
  if (hp < 3) { R(14, -31, 1, 2, '#ffffff'); R(15, -29, 1, 2, '#ffffff'); R(14, -27, 1, 2, '#ffffff'); R(16, -28, 2, 1, '#ffffff'); R(-15, -20, 5, 2, '#5a3a24'); }
  if (hp < 2) {
    const on = Math.floor(t / 8) % 2 === 0;
    R(-9, -41, 2, 2, on ? '#ff3b30' : '#7a1f1f');
    if (on) R(-10, -42, 4, 1, 'rgba(255,90,80,0.5)');
    if (t % 24 < 6) { R(-21, -12 - (t % 24), 1, 1, '#ffe066'); R(-19, -14 - (t % 24), 1, 1, '#ffffff'); }
  }
  ctx.restore();
};

// ============================================================
// THE FRIENDLY ANIMALS (centre at 0,0, facing right). Frames: 0, 1 = swimming, 2 = happy / calling
// ============================================================
function paintFish(b, f) {
  const O = I('#ff8a1c'), OL = I('#ffb44a'), OD = I('#d8580c'), Wh = I('#ffffff');
  poly(b, [[-7, 0], [-14, -6 + f], [-12, 0], [-14, 6 - f]], O);
  poly(b, [[-3, -5], [1, -9], [5, -5]], O);
  ell(b, 0, 0, 9, 6, O);
  shadeV(b, O, OL, OD);
  for (const [bx, w] of [[-4, 2], [3, 2]]) for (let y = -7; y <= 7; y++) for (let x = bx; x < bx + w; x++) if (get(b, x, y) !== NONE) put(b, x, y, Wh);
  for (let y = -7; y <= 7; y++) for (const x of [-5, -2, 2, 5]) if (get(b, x, y) !== NONE && (get(b, x + 1, y) === Wh || get(b, x - 1, y) === Wh)) put(b, x, y, OUTI);
  for (let y = -7; y <= 7; y++) if (get(b, -11, y) !== NONE) put(b, -12, y, Wh);
  ell(b, 1, 3 + (f === 1 ? 1 : 0), 2, 1, OL);
  eye(b, 6, -2, f === 2, true);
  put(b, 9, 2, OUTI); if (f === 2) put(b, 8, 2, I('#a8302a'));
}
function paintStar(b, f) {
  const C = I('#ff7a3a'), CL = I('#ffb070'), CD = I('#c84a1e'), pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5 + (f === 1 ? 0.08 : 0), r = i % 2 ? 4.6 : 10.5 - (f === 1 && i % 4 === 0 ? 1 : 0); pts.push([Math.cos(a) * r, Math.sin(a) * r + 1]); }
  poly(b, pts, C);
  shadeV(b, C, CL, CD, 0.3, 0.75);
  ell(b, 0, 1, 3, 2.5, CL);
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; for (const r of [5, 7.5]) put(b, Math.cos(a) * r, Math.sin(a) * r + 1, I('#fff0d0')); }
  eye(b, -3, -1, f === 2); eye(b, 2, -1, f === 2);
  put(b, -1, 3, OUTI); put(b, 0, 4, OUTI); put(b, 1, 3, OUTI);
}
// the sea horse: a hand-drawn map (crown, snout, big eye, ringed belly, fluttering back fin, curled tail)
const HORSE_MAP = [
  '......kk........', '.....kYYk.......', '....kYkYYk......', '...kYYYYYYkk....', '..kYYYYYYYYYkkkk', '..kYYweYYYYYYYYk',
  '..kYYeeYYYkkkkk.', '..kDYYYYYk......', '...kDYYYk.......', '...kDYYLk.......', '..kFDYYlLk......', '.kFFDYYLLLk.....',
  '.kFFkDYlLLk.....', '.kFFkDYYLLk.....', '..kFkDYYlLk.....', '...kkDYYLk......', '....kDYYk.......', '....kDYk........',
  '...kDYk.........', '...kDYk...kk....', '...kDYk..kYYk...', '...kDYYkkYDYk...', '....kDYYYDYk....', '.....kDDDDk.....', '......kkkk......'];
function paintHorse(b, f) {
  const rows = HORSE_MAP.map((r, j) => f === 1 && j >= 10 && j <= 14 ? r.replace('kFF', 'kFk').replace('.kFk', 'kFFk') : r);
  stamp(b, -8, -13, rows, { k: OUTI, Y: I('#ffc83c'), D: I('#e08a20'), L: I('#fff0a0'), l: I('#f0c860'), F: I('#fff6d8'), w: I('#ffffff'), e: I('#1a2030') });
  if (f === 2) { rect(b, -4, -8, 3, 2, I('#ffc83c')); put(b, -4, -7, OUTI); put(b, -3, -8, OUTI); put(b, -2, -7, OUTI); put(b, 7, -7, I('#a8302a')); }
}
function paintOcto(b, f) {
  const P = I('#e86aa8'), PL = I('#ffa8d0'), PD = I('#b04480');
  for (let i = 0; i < 6; i++) {
    const sx = -7 + i * 2.8, dir = i < 3 ? -1 : 1, ph = f * 0.7 + i;
    let x = sx, y = 3;
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 2 + dir * (0.25 + k * 0.17) + Math.sin(ph + k * 0.6) * 0.25;
      x += Math.cos(a) * 1.5; y += Math.sin(a) * 1.5;
      ell(b, x, y, k < 4 ? 1.4 : 0.8, k < 4 ? 1.4 : 0.8, P);
    }
  }
  ell(b, 0, -4, 9, 8, P);
  shadeV(b, P, PL, PD, 0.3, 0.8);
  ell(b, -3, -9, 3, 2, PL);
  for (const [x, y] of [[4, -9], [6, -6], [-6, -5]]) { put(b, x, y, PD); put(b, x + 1, y, PD); }
  eye(b, -3, -3, f === 2, true); eye(b, 3, -3, f === 2, true);
  if (f === 2) { rect(b, -1, 2, 3, 2, I('#7a1f4a')); put(b, 0, 3, I('#ff7aa8')); } else { put(b, -1, 2, OUTI); put(b, 0, 3, OUTI); put(b, 1, 2, OUTI); }
}
function paintDolphin(b, f) {
  const G2 = I('#7ab0cc'), GL = I('#d8f2f4'), GD = I('#4a7c9c');
  const fl = f === 1 ? -3 : f === 2 ? -2 : 2;
  poly(b, [[-12, -1], [-19, -5 + fl], [-17, 0 + fl * 0.3], [-19, 5 + fl], [-12, 2]], GD);
  poly(b, [[-2, -4], [1, -11], [4, -10], [5, -4]], GD);
  ell(b, -1, 0, 13, 5, G2); ell(b, 13, 1, 4, 2, G2); ell(b, 10, -1, 3, 3, G2);
  shadeV(b, G2, I('#a8d4e4'), GL, 0.25, 0.55);
  poly(b, [[1, 3], [-3, 8], [4, 4]], GD);
  eye(b, 9, -2, f === 2);
  line(b, 12, 2, 16, 2, OUTI);
  if (f === 2) put(b, 14, 3, I('#e86a7a'));
  put(b, 6, -4, I('#3a6a8a'));
}
function paintRay(b, f) {
  const B1 = I('#2c4a7c'), BL = I('#4a6ea8'), BD = I('#1a2c50'), SP = I('#e8f0ff');
  const tip = f === 1 ? 6 : f === 2 ? 8 : 10;
  line(b, -9, 0, -22, 1 + (f === 1 ? 1 : 0), BD);
  poly(b, [[13, 0], [3, -3], [-3, -tip], [-6, -tip + 1], [-10, 0], [-6, tip - 1], [-3, tip], [3, 3]], B1);
  ell(b, 12, 0, 3, 2.4, B1);
  shadeV(b, B1, BL, BD, 0.35, 0.72);
  for (const [x, y] of [[-4, -4], [-1, -2], [-6, 2], [-2, 4], [2, -1], [-7, -1], [5, 1]]) if (get(b, x, y) !== NONE) put(b, x, y, SP);
  ell(b, 7, 2, 4, 1.5, I('#e8f0f8'));
  eye(b, 11, -1, f === 2);
  if (f === 2) put(b, 14, 1, I('#e86a7a'));
}
function paintCuttle(b, f) {
  const C = I('#e88aa0'), CL = I('#ffc0d0'), CD = I('#b85a7a'), SK = I('#ffd8e4');
  // the rippling fin skirt round the body, the arms in front
  for (let x = -12; x <= 9; x++) { const w = Math.sin(x * 0.9 + f * 2.1) > 0 ? 1 : 0; put(b, x, -7 - w, SK); put(b, x, 7 + w, SK); }
  for (let i = 0; i < 5; i++) { const y0 = -2 + i, ph = f * 1.3 + i; line(b, 10, y0, 15, y0 + Math.round(Math.sin(ph) * 1.5) + (i - 2) * 0.6, i % 2 ? C : CD); }
  ell(b, -1, 0, 11, 6, C);
  shadeV(b, C, CL, CD, 0.3, 0.78);
  // zebra stripes that flash colour every other frame
  for (let x = -10; x <= 4; x += 3) for (let y = -6; y <= -1; y++) if (get(b, x + (y & 1), y) !== NONE && get(b, x + (y & 1), y) !== SK) put(b, x + (y & 1), y, f === 1 ? I('#f0a8c0') : CD);
  // the big W-pupil eye
  rect(b, 4, -3, 5, 4, I('#ffffff')); put(b, 5, -2, I('#1a2030')); put(b, 6, -1, I('#1a2030')); put(b, 7, -2, I('#1a2030')); put(b, 8, -1, I('#1a2030'));
  if (f === 2) { rect(b, 4, -3, 5, 4, C); put(b, 4, -1, OUTI); put(b, 5, -2, OUTI); put(b, 6, -2, OUTI); put(b, 7, -2, OUTI); put(b, 8, -1, OUTI); }
}
const PAINT = { fish: paintFish, star: paintStar, horse: paintHorse, octopus: paintOcto, dolphin: paintDolphin, ray: paintRay, cuttle: paintCuttle };
const ANIMALS = {};
for (const k in PAINT) ANIMALS[k] = [0, 1, 2].map(f => { const b = buf(48, 36, 24, 18); PAINT[k](b, f); outline(b); return sprite(b); });

// ============================================================
// THE CAGE (Missions 2/3 style), hanging on a chain from an anchor on the seabed; box 44 x 40 above o.y
// ============================================================
const CW = 44, CH = 40;
function cageBack() {
  ctx.fillStyle = 'rgba(8,28,40,0.28)'; ctx.fillRect(-CW / 2 + 2, -CH + 4, CW - 4, CH - 9);
  ctx.globalAlpha = 0.55;
  const n = 4;
  R(-CW / 2 + 2, -CH + 4, CW - 4, 1, METD);
  for (let i = 0; i <= n; i++) R(-CW / 2 + Math.round((i + 0.5) * CW / (n + 1)), -CH + 4, 1, CH - 8, METD);
  ctx.globalAlpha = 1;
}
function cageFront(o, near, rattle) {
  const x0 = -CW / 2, x1 = x0 + CW, top = -CH + rattle, bh = CH - 6 - rattle, n = 4;
  for (let i = 1; i <= n; i++) { const x = x0 + Math.round(i * CW / (n + 1)) - 1; R(x, top + 3, 1, bh, OUT); R(x + 1, top + 3, 1, bh, METL); R(x + 1, top + bh, 1, 3, MET); }
  for (const px of [x0, x1 - 2]) { RO(px, top + 2, 2, bh + 1, MET); R(px, top + 2, 1, bh + 1, METL); }
  RO(x0 - 1, top, CW + 2, 3, METD); R(x0 - 1, top, CW + 2, 1, METL);
  for (let x = x0 + 2; x < x1 - 1; x += 5) R(x, top + 1, 1, 1, METDD);
  RO(x0 - 1, -4, CW + 2, 4, METDD);
  for (let r = 0; r < 3; r++) for (let x = x0 - 1 + ((r + 4) & 3); x < x1 + 1; x += 4) R(x, -3 + r, Math.min(2, x1 + 1 - x), 1, '#f1c40f');
  R(x0 - 1, -4, CW + 2, 1, '#6a737e');
  // two little floats on the top corners keep it up; the robot eye watches the hero
  for (const fx of [x0 + 1, x1 - 6]) { RO(fx, top - 4, 5, 4, '#f07a2a'); R(fx, top - 4, 5, 1, '#ffb070'); R(fx + 2, top - 4, 1, 4, '#ffffff'); }
  const look = G.p ? clamp(Math.round((G.p.x - o.x) / 40), -1, 1) : 0, rate = near ? 8 : 24, on = Math.floor((o.t + o.id * 7) / rate) % 2 === 0;
  blob([[-4, top - 4, 8, 4], [-3, top - 5, 6, 1]], METD); R(-3, top - 4, 6, 1, METL); R(-4, top - 1, 8, 1, METDD);
  RO(-2, top - 3, 4, 2, '#2a0c0c'); R(-1 + look, top - 3, 2, 2, on ? EVIL : '#7a1f1f'); if (on) R(-1 + look, top - 3, 1, 1, '#ffd0cc');
  R(0, top - 8, 1, 3, METDD); R(0, top - 9, 1, 1, on ? EVIL : '#5a1a1a');
}
// the chain down to an anchor block half sunk in the sand
function chain(o) {
  const gy = Math.round((L4ART && L4ART.groundAt ? L4ART.groundAt(o.x) : groundAt(o.x)) - o.y);
  for (let y = 1; y < gy - 3; y += 4) { RO(-1, y, 3, 3, METD); R(0, y + 1, 1, 1, '#1c2630'); R(-1, y, 1, 1, METL); }
  RO(-6, gy - 4, 13, 6, '#6d737c'); R(-6, gy - 4, 13, 1, '#9aa1aa'); R(-5, gy - 1, 11, 1, '#4d535c');
  for (const x of [-4, 3]) R(x, gy - 3, 1, 1, '#4d535c');
  R(-1, gy - 6, 3, 2, METD);
}
function helpBubble(by) {
  RO(-16, by, 33, 11, '#ffffff'); R(-16, by + 10, 33, 1, '#d8dce6');
  R(-2, by + 11, 5, 1, '#ffffff'); R(-1, by + 12, 3, 1, '#ffffff'); R(0, by + 13, 1, 1, '#ffffff');
  R(-3, by + 11, 1, 1, OUT); R(3, by + 11, 1, 1, OUT); R(-2, by + 12, 1, 1, OUT); R(2, by + 12, 1, 1, OUT); R(-1, by + 13, 1, 1, OUT); R(1, by + 13, 1, 1, OUT); R(0, by + 14, 1, 1, OUT);
  text('HELP!', 1, by + 2, '#e0302a', 1, 'center', null);
}
const HEART5 = ['.x.x.', 'xxxxx', '.xxx.', '..x..'];
function heart(x, y, c) {
  for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) if (HEART5[r][i] === 'x') R(x + i - 1, y + r - 1, 3, 3, OUT);
  for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) if (HEART5[r][i] === 'x') R(x + i, y + r, 1, 1, r === 0 && i < 2 ? '#ffc2cc' : c);
}
function ring(x, y, r, a) {
  ctx.globalAlpha = a;
  for (let k = 0; k < 16; k++) { const an = k / 16 * TAU; R(Math.round(x + Math.cos(an) * r), Math.round(y + Math.sin(an) * r), 1, 1, '#b8faff'); }
  R(Math.round(x - r / 2), Math.round(y - r / 2), 1, 1, '#ffffff');
  ctx.globalAlpha = 1;
}
function animal(kind, fr, face, dx, dy, rot) {
  const s = ANIMALS[kind][fr];
  ctx.save(); ctx.translate(Math.round(dx), Math.round(dy)); ctx.scale(face, 1); if (rot) ctx.rotate(rot);
  blit(s, 0, 0);
  ctx.restore();
}
function drawPowAnimal(kind, o) {
  const p = G.p, t = o.t + o.id * 37;
  ctx.save(); ctx.translate(Math.round(o.x), Math.round(o.y));
  if (o.state === 'tied') {
    const near = !!p && !p.dead && Math.abs(p.x - o.x) < 150, bubble = Math.floor(t / 40) % 2 === 0;
    let face = -1, fr = Math.floor(t / 12) % 2, dx = 0, dy = Math.round(Math.sin(t * 0.07)), rattle = 0;
    if (near) {
      face = p.x < o.x ? -1 : 1;
      const h = t % 32;
      if (h < 12) { dy = -Math.round(Math.sin(h / 12 * Math.PI) * 4); fr = 2; } else fr = Math.floor(t / 5) % 2;
      if (h >= 12 && h < 15) rattle = 1;
    } else {
      if (bubble && (t >> 4) % 2 === 0) fr = 2;
      const ph = t % 220;
      if (ph >= 60 && ph < 100) { face = 1; dx = Math.round(Math.sin((ph - 60) / 40 * Math.PI) * 3); }
      if (ph >= 160 && ph < 176) dx = (t >> 1) % 2 ? -1 : 0;
    }
    chain(o);
    cageBack();
    animal(kind, fr, face, dx, -21 + dy, 0);
    cageFront(o, near, rattle);
    if (bubble) helpBubble(-CH - 23 + (Math.floor(t / 10) % 2));
  } else if (o.state === 'free' || o.state === 'salute') {
    // freed: a bright pop of bubbles, a happy leap, a little dance with hearts, facing the hero
    const s = o.t, face = p && p.x < o.x ? -1 : 1;
    let dy = -21, fr = 2, rot = 0;
    if (o.state === 'free') {
      const u = s / 24;
      dy -= Math.round(Math.sin(u * Math.PI) * 12);
      if (s < 6) { ctx.globalAlpha = 0.85 - s * 0.13; ctx.fillStyle = '#fffbe8'; circ(0, -20, 16 - s * 2); ctx.globalAlpha = 1; }
      for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, r = 6 + s * 1.2; ring(Math.cos(an) * r, -20 + Math.sin(an) * r, 1 + (i % 3), Math.max(0, 1 - s / 24)); }
      if (kind === 'star' || kind === 'octopus') rot = face * u * TAU;
    } else {
      const d = s - 24;
      fr = (d >> 3) % 2 ? 2 : (d >> 2) % 2;
      dy -= Math.round(Math.abs(Math.sin(d * 0.2)) * 4);
    }
    animal(kind, fr, face, 0, dy, rot);
    for (let i = 0; i < 3; i++) { const a = s - i * 14; if (a < 0 || a > 40) continue; heart(-8 + i * 8 + Math.round(Math.sin(a * 0.2 + i) * 2), -34 - a * 0.6, '#ff5a7a'); }
  } else {
    // home: swimming off up and away (level4.js moves it), a trail of bubbles behind
    const s = o.t - 64, fr = Math.floor(s / 4) % 2;
    animal(kind, fr, 1, 0, -20, kind === 'star' ? s * 0.15 : -0.12);
    for (let i = 0; i < 4; i++) { const a = (s + i * 6) % 24; ring(-16 - a * 0.8, -18 + a * 0.4 - i, 1 + (i % 2), 1 - a / 24); }
  }
  ctx.restore();
}
for (const [key, kind] of [['oceanfish', 'fish'], ['oceanstar', 'star'], ['oceanhorse', 'horse'], ['oceanoctopus', 'octopus'], ['oceandolphin', 'dolphin'], ['oceanray', 'ray'], ['oceancuttle', 'cuttle']])
  if (POW_KINDS[key]) POW_KINDS[key].draw = o => drawPowAnimal(kind, o);

// ============================================================
// PICKUPS
// ============================================================
const PEARL = (() => {
  const b = buf(18, 18, 9, 16), S = I('#f49ab0'), SL = I('#ffd0dc'), SD = I('#c0607e');
  // the open scallop: the back half tipped up behind, the front half under the pearl
  for (let i = -3; i <= 3; i++) line(b, 0, -9, i * 2, -15 + Math.abs(i) * 0.6, i % 2 ? SL : S, 2);
  for (let i = -3; i <= 3; i++) line(b, 0, -1, i * 2.2, -5 + Math.abs(i) * 0.7, i % 2 ? S : SL, 2);
  for (let i = -3; i <= 3; i += 2) line(b, 0, -1, i * 2.2, -5 + Math.abs(i) * 0.7, SD);
  rect(b, -2, -1, 5, 1, SD);
  outline(b);
  ell(b, 0, -8, 3.3, 3.3, I('#c8d6e6')); ell(b, -0.5, -8.5, 2.6, 2.6, I('#f2f6ff')); put(b, -2, -10, I('#ffffff')); put(b, -1, -10, I('#ffffff')); put(b, 1, -6, I('#ffd8f0'));
  for (const [x, y] of [[-3, -11], [-4, -10], [-4, -7], [-3, -5], [3, -11], [4, -9], [4, -7], [3, -5], [-2, -12], [2, -12], [-2, -4], [2, -4], [-1, -12], [0, -12], [1, -12], [-1, -4], [0, -4], [1, -4]]) if (get(b, x, y) === NONE) put(b, x, y, OUTI);
  return sprite(b);
})();
const CRATE = (() => {
  const b = buf(18, 18, 8, 16), T = I('#2a8aa8'), TL = I('#7ad8e8'), TD = I('#1a5a70');
  rect(b, -6, -13, 13, 13, T); rect(b, -6, -13, 13, 2, TL); rect(b, 5, -11, 2, 11, TD);
  for (let x = -6; x < 7; x++) put(b, x, -2, (x + 20) % 4 < 2 ? I('#f1c40f') : I('#1a1a1a'));
  for (const [x, y] of [[-5, -10], [5, -10], [-5, -4], [5, -4]]) put(b, x, y, TD);
  // a little torpedo strapped on top
  rect(b, -4, -16, 8, 3, I('#ffcf57')); rect(b, -4, -16, 8, 1, I('#fff5c3')); put(b, -5, -15, I('#ffcf57')); rect(b, 4, -16, 1, 3, I('#d08a20')); put(b, -6, -17, I('#6b7584')); put(b, -6, -13, I('#6b7584'));
  outline(b);
  return sprite(b);
})();
if (ITEMS.oceanPearl) ITEMS.oceanPearl.draw = it => {
  const x = Math.round(it.x), y = Math.round(it.y);
  blit(PEARL, x, y);
  const k = it.t % 50;
  if (k < 8) { const s = k < 4 ? 2 : 1; R(x - 2 - s, y - 10, s * 2 + 1, 1, '#ffffff'); R(x - 2, y - 10 - s, 1, s * 2 + 1, '#ffffff'); }
};
if (ITEMS.oceanCharge) ITEMS.oceanCharge.draw = it => {
  const x = Math.round(it.x), y = Math.round(it.y);
  blit(CRATE, x, y);
  text('C', x - 2, y - 11, '#ffffff', 1, 'left', null);
  if (it.t % 40 < 6) R(x + 5, y - 19, 2, 2, '#ffffff');
};
}
