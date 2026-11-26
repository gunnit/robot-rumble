'use strict';
// ============================================================
// Mission 3: the BATTLE JET-SKI (RIDES.jetski + PROP_TYPES.jetski, parked at the shoreline of SHARK BAY's lagoon at
// x 700) and PROP_TYPES.jetskiwreck (the jet-ski left on the far beach, the sinking wreck, plates knocked off).
// A red jet-ski with a cream pinstripe and a lightning bolt, a saddle, a console with a tinted windscreen, a nose gun
// on a ball mount (X; hold Up to swing it up to 90 degrees at a leaping shark), torpedoes (C, 8 of them) that skim the
// surface and blow up on fins, a whip antenna with a pennant, four riveted armour plates.
// It floats on the water surface of LV.water, bobbing; left/right is the throttle (it glides), Z hops (hold Z for a
// higher hop), Down + Z hops off (onto a pier deck when one is close, else into the shallows; it stays parked there).
// It cannot go onto land: at the near shore it stops; at the far shore it runs up onto the sand and the hero hops off
// onto the beach by themselves (the jet-ski stays beached). Over a sandbar inside the lagoon it skids slowly on its
// keel. Armour 5: each hit knocks off a plate; at 0 the hero is thrown clear and the jet-ski sinks with a gurgle.
// Drawing: each frame the jet-ski is composed facing right and level on two small canvases (behind and in front of
// the seated hero), then drawn turned and pitched in 2 degree steps with nearest-neighbour pixels (like the tractor).
// Sprites are painted once at load (no Math.random or rand() at load time or in drawing: hsh() and G.t only).
// ============================================================
{
// ============================================================
// Pixel painter (load time): 0xRRGGBB ints, NONE = empty; local (x, y) lands on buffer pixel (x + ox, y + oy)
// ============================================================
const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
const OUTI = I(OUT);
const lerp = (a, b, k) => a + (b - a) * k;
const h2 = (x, y, s) => hsh(x * 12.9898 + y * 78.233 + s * 37.719);
function buf(w, h, ox, oy) { const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox, oy }; }
function put(b, x, y, c) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
function disc(b, cx, cy, r, c) {
  const n = Math.ceil(r), R2 = (r + 0.5) * (r + 0.5), X = Math.round(cx), Y = Math.round(cy);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) if (i * i + j * j <= R2) put(b, X + i, Y + j, c);
}
function line(b, x0, y0, x1, y1, c) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1));
  for (let i = 0; i <= n; i++) put(b, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
}
function poly(b, pts, c) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const ax = pts[i][0], ay = pts[i][1], bx = pts[j][0], by = pts[j][1];
      if ((ay <= yc) !== (by <= yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b2) => a - b2);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x + 0.5 <= xs[k + 1]; x++) put(b, x, y, c);
  }
}
// a straight piece at angle a (up from forward) from (px, py): t along it, s across (s < 0 = the lit top side)
function bar(b, px, py, a, t0, t1, s0, s1, c) {
  const ca = Math.cos(a), sa = Math.sin(a);
  for (let t = t0; t <= t1 + 1e-6; t += 0.25) for (let s = s0; s <= s1 + 1e-6; s += 0.25) put(b, px + t * ca + s * sa, py - t * sa + s * ca, c);
}
// recolour every pixel of colour `from` inside a rectangle
function recol(b, x0, y0, w, h, from, to) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (get(b, x, y) === from) put(b, x, y, to); }
// 1px dark outline round everything painted (4 neighbours: crisp on slanted edges, like the proposal frames)
function outline(b) {
  const add = [], W0 = b.w;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < W0; x++) {
    const i = y * W0 + x;
    if (b.d[i] !== NONE) continue;
    if ((x > 0 && b.d[i - 1] !== NONE) || (x < W0 - 1 && b.d[i + 1] !== NONE) || (y > 0 && b.d[i - W0] !== NONE) || (y < b.h - 1 && b.d[i + W0] !== NONE)) add.push(i);
  }
  for (const i of add) b.d[i] = OUTI;
}
function bake(b, white) {
  const c = document.createElement('canvas'); c.width = b.w; c.height = b.h;
  const g = c.getContext('2d'), im = g.createImageData(b.w, b.h), d = im.data;
  for (let i = 0; i < b.d.length; i++) {
    let v = b.d[i];
    if (v === NONE) continue;
    if (white && v !== OUTI) v = 0xffffff;
    const j = i * 4;
    d[j] = (v >> 16) & 255; d[j + 1] = (v >> 8) & 255; d[j + 2] = v & 255; d[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// { img, white (hit flash: all white but the outline), w, h, ox, oy (the local origin inside the image) }
const sprite = b => ({ img: bake(b, false), white: bake(b, true), w: b.w, h: b.h, ox: b.ox, oy: b.oy });

// ============================================================
// Palette (the tractor's red and steel, so the two vehicles are family)
// ============================================================
const C = {
  r: I('#d8392b'), R: I('#ff6d4d'), hl: I('#ff9a7a'), q: I('#a2251e'), Q: I('#6c1714'),
  p: I('#8f9aa7'), P: I('#cbd3dc'), o: I('#5e6773'), v: I('#363d47'), V: I('#f2f6f9'),
  b: I('#24242c'), B: I('#4a4a58'), n: I('#3b2f2b'), N: I('#62504a'), nn: I('#2a201d'),
  g: I('#2f6f98'), G: I('#bfeaff'), gm: I('#5a9ac0'), w: I('#ffffff'),
  s: I('#7c8794'), S: I('#c6ced8'), d: I('#464d58'), m: I('#23252b'),
  j: I('#fff1c9'), y: I('#ffd23f'), Y: I('#fff3b0'), l: I('#fff6c2'), L: I('#ffb52e'), F: I('#ff8c1a'),
  h: I('#2f3640'), H: I('#3d4652'), i: I('#1b1012'), e: I('#66ff88'), E: I('#1f5a33'), z: I('#8a5a2a')
};

// ============================================================
// Sprites (local coordinates: facing right, level; 0,0 = the waterline under the jet-ski's middle)
// ============================================================
// The hull outline: a long low red hull, the bow rising to a point at the front
const HULL = [[-31, -8], [22, -8], [27, -9], [31, -10.5], [35.5, -12.6], [34.6, -10], [31, -6.5], [26, -3], [20, -0.5], [12, 2], [4, 3], [-31, 3]];
// Body: hull, boot stripe, pinstripe, lightning bolt, rub rail, rear deck, saddle, console and windscreen, hood with
// vents and a headlamp, handlebar, the jet nozzle. Plates, gun, antenna are separate sprites.
const BODY = (() => {
  const b = buf(80, 36, 40, 28);
  poly(b, HULL, C.r);
  for (let y = -2; y <= 4; y++) for (let x = -32; x <= 36; x++) if (get(b, x, y) === C.r) put(b, x, y, y === -2 ? C.V : y === -1 ? C.H : C.h);
  for (let x = -31; x <= 35; x++) { if (get(b, x, -7) === C.r) put(b, x, -7, C.R); if (get(b, x, -3) === C.r) put(b, x, -3, C.q); }
  for (let x = -30; x <= 23; x++) put(b, x, -5, C.j);                                          // cream pinstripe
  // the lightning bolt decal
  poly(b, [[-21, -7.6], [-13.5, -7.6], [-16.5, -5.4], [-11.6, -5.4], [-19.6, -1.4], [-17.2, -4.2], [-22, -4.2]], C.y);
  for (let x = -22; x <= -12; x++) if (get(b, x, -7) === C.y) put(b, x, -7, C.Y);
  recol(b, -20, -3, 4, 2, C.y, C.L);
  // a small hull number on the bow quarter, a drain plug near the stern
  put(b, 23, -6, C.j); put(b, 24, -6, C.j); put(b, 24, -5, C.j); put(b, 23, -4, C.j); put(b, 24, -4, C.j);
  put(b, -27, -1, C.S);
  // rub rail: black rubber, rising along the bow
  for (let x = -31; x <= 22; x++) { put(b, x, -9, C.B); put(b, x, -8, C.b); }
  line(b, 22, -9, 35, -13, C.b); line(b, 22, -10, 34, -13.5, C.B);
  // rear deck with a grab handle and a tow eye
  rect(b, -31, -11, 9, 2, C.r); rect(b, -31, -11, 9, 1, C.R);
  rect(b, -29, -14, 5, 1, C.s); put(b, -29, -13, C.d); put(b, -25, -13, C.d); put(b, -29, -14, C.S);
  // the saddle: long and padded, a bolster at the back, stitching
  poly(b, [[-23, -9], [-23.5, -11], [-22.5, -13], [-20.5, -13.6], [-18.5, -12.6], [-8, -12.2], [-4, -12.2], [-2.5, -11], [-2.5, -9]], C.n);
  for (let x = -22; x <= -3; x++) { for (let y = -15; y < -9; y++) if (get(b, x, y) === C.n) { put(b, x, y, C.N); break; } }
  for (let x = -20; x <= -5; x += 3) put(b, x, -10, C.N);
  for (let x = -22; x <= -3; x++) if (get(b, x, -9) === C.n) put(b, x, -9, C.nn);
  // the console pod in front of the rider with two status lights, a tinted windscreen on it
  poly(b, [[-3, -9], [-3, -15], [-1, -18.6], [4, -19.8], [7.5, -17.6], [8, -9]], C.d);
  for (let x = -2; x <= 7; x++) { for (let y = -21; y < -9; y++) if (get(b, x, y) === C.d) { put(b, x, y, C.s); break; } }
  for (let y = -15; y <= -10; y++) put(b, -3, y, C.h);
  rect(b, 1, -14, 4, 2, C.m); put(b, 2, -14, C.e); put(b, 4, -14, C.L);
  poly(b, [[0.5, -19.5], [3, -25], [7.5, -25.5], [8.5, -21], [5.5, -19.6]], C.g);
  line(b, 3.6, -24.4, 7, -24.8, C.G); put(b, 3, -23, C.G); put(b, 6, -21, C.gm); put(b, 7, -22, C.gm);
  // the hood sloping down to the bow: highlight rows, cooling vents, a headlamp
  poly(b, [[6.5, -9], [6.5, -17.4], [12, -17.6], [18, -16.2], [24, -14.4], [30, -12.6], [35, -12.6], [31, -10.6], [27, -9.4], [22, -8.6]], C.r);
  for (let x = 7; x <= 35; x++) { let k = 0; for (let y = -19; y <= -8; y++) if (get(b, x, y) === C.r) { if (k < 2) put(b, x, y, k ? C.R : C.hl); k++; } }
  for (let x = 7; x <= 34; x++) if (get(b, x, -9) === C.r) put(b, x, -9, C.q);
  for (const vx of [20, 25]) { rect(b, vx, -12, 3, 1, C.Q); rect(b, vx, -11, 3, 1, C.q); }
  disc(b, 31, -11.4, 1.2, C.L); put(b, 31, -12, C.l); put(b, 30, -12, C.w);
  // handlebar: from the pod back to the rider's hands, a red grip
  line(b, 1, -19, -2, -18, C.d); rect(b, -9, -18, 8, 1, C.m); rect(b, -9, -18, 2, 1, C.q); put(b, -9, -19, C.m);
  // stern: the jet nozzle under the rear deck
  rect(b, -34, -4, 3, 3, C.s); put(b, -34, -4, C.S); rect(b, -34, -2, 3, 1, C.d); put(b, -35, -3, C.d);
  outline(b);
  return sprite(b);
})();

// Behind the rider: the whip antenna (its base on the rear deck)
const ANT = (() => {
  const b = buf(16, 32, 33, 38);
  line(b, -26, -11, -29, -35, C.d); line(b, -27, -11, -30, -35, C.s);
  rect(b, -28, -12, 3, 2, C.d); put(b, -28, -12, C.s);
  disc(b, -30, -36, 0.8, C.L);
  outline(b);
  return sprite(b);
})();

// The pennant on the antenna tip: 4 frames streaming in the wind (riding), 4 lazy frames (parked)
function pennant(k, lazy) {
  const b = buf(20, 20, 46, 44);
  const L = lazy ? 9 : 12, ph = k * Math.PI / 2;
  for (let u = 0; u <= L; u += 0.25) {
    const hh = 2.6 * (1 - u / L) + 0.4;
    const cy = -33.4 + (lazy ? u * 0.45 : 0) + Math.sin(u * (lazy ? 0.45 : 0.6) - ph) * Math.min(lazy ? 0.9 : 1.6, u * 0.22);
    for (let y = Math.round(cy - hh); y <= Math.round(cy + hh); y++) put(b, -30.5 - u, y, y > cy + hh * 0.2 ? C.L : C.y);
  }
  // a little red bolt on it
  put(b, -33, -35, C.r); put(b, -34, -34, C.r); put(b, -33, -34, C.r); put(b, -34, -33, C.r);
  outline(b);
  return sprite(b);
}
const PENNANT = [0, 1, 2, 3].map(k => pennant(k, false)), PENNANT_LAZY = [0, 1, 2, 3].map(k => pennant(k, true));

// Armour plates: 0 bow plate (the last to go), 1 stern quarter, 2 hood cheek, 3 the gun shield (the first to go).
// Each is its own sprite: bolted on, and flying off when hit. SCARS: what is left when one is gone.
const KEEP = [0, 1, 2, 3];
const PLATE_RECT = [[7, -7, 14, 4], [-31, -7, 7, 4], [9, -13, 9, 3], [27, -20, 3, 6]];
const RIVETS = [[[9, -6], [14, -5], [18, -6]], [[-29, -6], [-26, -6]], [[11, -12], [16, -12]], [[28, -18]]];
function plateSprite(i) {
  const [x, y, w, h] = PLATE_RECT[i], b = buf(w + 4, h + 4, -x + 2, -y + 2);
  if (i === 3) {
    // the gun shield: a small curved plate standing in front of the ball mount
    rect(b, x, y + 1, w, h - 1, C.p); rect(b, x + 1, y, w - 1, 1, C.P); rect(b, x, y + 1, 1, h - 1, C.P); rect(b, x + w - 1, y + 1, 1, h - 1, C.o); put(b, x + 1, y + h - 1, C.o);
  } else { rect(b, x, y, w, h, C.p); rect(b, x, y, w, 1, C.P); rect(b, x, y + h - 1, w, 1, C.o); rect(b, x + w - 1, y, 1, h, C.o); put(b, x, y, C.V); }
  for (const [rx, ry] of RIVETS[i]) { put(b, rx, ry, C.v); put(b, rx - 1, ry - 1, C.V); }
  if (i === 0) { put(b, x + 4, y + 1, C.S); put(b, x + 6, y + 2, C.o); }
  outline(b);
  return sprite(b);
}
const PLATES = [0, 1, 2, 3].map(plateSprite);
function scarSprite(i) {
  const [x, y, w, h] = PLATE_RECT[i], b = buf(w + 2, h + 2, -x + 1, -y + 1);
  if (i === 3) { put(b, x, y + h - 1, C.i); put(b, x + 2, y + h - 1, C.i); return sprite(b); }   // just its two bolt stubs on the hood
  rect(b, x, y, w, h, i === 2 ? C.q : C.Q);
  for (let k = 0; k < w; k++) if (h2(k, i, 5) > 0.7) put(b, x + k, y + (k % h), C.q);
  put(b, x + 1, y + 1, C.s); put(b, x + w - 3, y + h - 2, C.s);
  for (const [rx, ry] of RIVETS[i]) put(b, rx, ry, C.i);
  return sprite(b);
}
const SCARS = [0, 1, 2, 3].map(scarSprite);

// The nose gun on its ball mount (local origin = the mount), 13 angles from forward to straight up (7.5 degree steps)
const GSTEP = Math.PI / 24, GUN_AT = [24, -13], GUN_LEN = 13;
function gunSprite(a) {
  const b = buf(30, 30, 8, 21);
  bar(b, 0, 0, a, -2.25, 2.5, -2, 2, C.o); bar(b, 0, 0, a, -2.25, 2.5, -2, -1.5, C.s);
  bar(b, 0, 0, a, 2, 10, -1.1, 1.1, C.d); bar(b, 0, 0, a, 2, 10, -1.1, -0.6, C.s);
  for (const hh of [4.5, 7]) bar(b, 0, 0, a, hh, hh + 0.5, -0.4, 0.4, C.m);
  bar(b, 0, 0, a, 10, GUN_LEN, -1.5, 1.5, C.m); bar(b, 0, 0, a, 10, GUN_LEN, -1.5, -0.9, C.d);
  outline(b);
  disc(b, 0, 0, 2.2, C.p); put(b, -1, -1, C.P); put(b, 0, -1, C.P); put(b, 1, 1, C.o); put(b, 1, 0, C.o);
  return sprite(b);
}
const GUN = [], MFLASH = [];
function flashSprite(a) {
  const b = buf(30, 30, 15, 15);
  bar(b, 0, 0, a, 0, 9, -1.1, 1.1, C.y); bar(b, 0, 0, a, 0, 6, -0.5, 0.5, C.Y);
  bar(b, 0, 0, a + 0.9, 0, 4.5, -0.5, 0.5, C.y); bar(b, 0, 0, a - 0.9, 0, 4.5, -0.5, 0.5, C.y);
  disc(b, 0, 0, 2.4, C.L); disc(b, 0, 0, 1.5, C.Y); put(b, 0, 0, C.w);
  return sprite(b);
}
for (let i = 0; i <= 12; i++) { GUN.push(gunSprite(i * GSTEP)); MFLASH.push(flashSprite(i * GSTEP)); }

// Torpedo: grey body, red nose, a fin and a propeller (2 frames); flash at the launch tube
function torpSprite(k) {
  const b = buf(16, 9, 2, 4);
  rect(b, 1, -2, 9, 3, C.p); rect(b, 1, -2, 9, 1, C.P); rect(b, 1, 0, 9, 1, C.o);
  rect(b, 10, -2, 2, 3, C.r); put(b, 12, -1, C.r); put(b, 10, -2, C.R); put(b, 11, -2, C.R);
  rect(b, 4, -3, 2, 1, C.o); put(b, 6, -1, C.v);
  rect(b, -1, -2, 2, 3, C.d);
  if (k) { put(b, -2, -3, C.S); put(b, -2, 1, C.S); } else { put(b, -2, -1, C.S); put(b, -2, -2, C.S); put(b, -2, 0, C.S); }
  outline(b);
  return sprite(b);
}
const TORP = [torpSprite(0), torpSprite(1)];

// HUD icons: the jet-ski (as in the proposal panel) and a torpedo
const ICON = (() => {
  const b = buf(29, 16, 1, 1);
  poly(b, [[0, 8], [19, 8], [23, 6], [26, 4.5], [24, 9], [20, 11], [1, 11]], C.r);
  rect(b, 1, 10, 20, 1, C.h); rect(b, 1, 9, 19, 1, C.j);
  rect(b, 4, 6, 7, 2, C.n); rect(b, 4, 6, 7, 1, C.N);
  poly(b, [[11, 8], [12, 6], [15, 5], [20, 5.5], [24, 7], [24, 8]], C.R);
  rect(b, 14, 3, 2, 2, C.g); put(b, 14, 3, C.G); rect(b, 10, 4, 1, 3, C.d); rect(b, 8, 4, 3, 1, C.m);
  line(b, 22, 5, 25, 2, C.d); put(b, 21, 5, C.p);
  rect(b, 2, 1, 1, 6, C.d); put(b, 1, 1, C.y); put(b, 0, 1, C.y); put(b, 1, 2, C.L);
  outline(b);
  return sprite(b);
})();
const TORP_ICON = (() => {
  const b = buf(16, 8, 1, 3);
  rect(b, 2, -1, 8, 3, C.p); rect(b, 2, -1, 8, 1, C.P); rect(b, 2, 1, 8, 1, C.o); rect(b, 10, -1, 2, 3, C.r); put(b, 12, 0, C.r); put(b, 10, -1, C.R);
  rect(b, 0, -2, 2, 5, C.d); put(b, 0, 0, C.s);
  outline(b);
  return sprite(b);
})();

// ============================================================
// Composition: the parts on two small canvases (made once), then drawn turned and pitched
// ============================================================
const CW = 108, CH = 66, OX = 54, OY = 48;
function layer() { const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
const [backC, bc] = layer(), [frontC, fc] = layer();
const putL = (g, s, x, y, wt) => g.drawImage(wt ? s.white : s.img, OX + Math.round(x) - s.ox, OY + Math.round(y) - s.oy);
const plateOn = (n, i) => KEEP.indexOf(i) < n;
const platesFor = a => clamp(a - 1, 0, 4);   // every hit but the last knocks a plate off

// st: { gi, plates, wt, muzzle, flag, lazy, lamp, lights, tflash }
const ST = { gi: 0, plates: 4, wt: false, muzzle: false, flag: 0, lazy: false, lamp: false, lights: true, tflash: 0 };
function compose(st) {
  const wt = st.wt;
  bc.clearRect(0, 0, CW, CH); fc.clearRect(0, 0, CW, CH);
  putL(bc, ANT, 0, 0, wt);
  putL(bc, (st.lazy ? PENNANT_LAZY : PENNANT)[st.flag & 3], 0, 0, wt);
  putL(fc, BODY, 0, 0, wt);
  for (let i = 0; i < 4; i++) putL(fc, plateOn(st.plates, i) ? PLATES[i] : SCARS[i], 0, 0, wt && plateOn(st.plates, i));
  // the console lights (blinking standby while parked) and the headlamp
  if (!wt) {
    fc.fillStyle = st.lights ? '#66ff88' : '#1f5a33'; fc.fillRect(OX + 2, OY - 14, 1, 1);
    fc.fillStyle = st.lights ? (((G.t >> 3) & 1) ? '#ffb52e' : '#7a4a1a') : '#5a3a1a'; fc.fillRect(OX + 4, OY - 14, 1, 1);
    if (st.lamp) { fc.fillStyle = '#ffffff'; fc.fillRect(OX + 31, OY - 12, 1, 1); fc.fillStyle = '#fff6c2'; fc.fillRect(OX + 32, OY - 12, 1, 2); }
  }
  putL(fc, GUN[st.gi], GUN_AT[0], GUN_AT[1], wt);
  if (st.muzzle) { const a = st.gi * GSTEP; putL(fc, MFLASH[st.gi], GUN_AT[0] + Math.cos(a) * (GUN_LEN + 2), GUN_AT[1] - Math.sin(a) * (GUN_LEN + 2), false); }
  if (st.tflash > 0) { fc.fillStyle = st.tflash > 4 ? '#fff3b0' : '#ffb52e'; fc.fillRect(OX + 10, OY - 4, 4, 3); fc.fillStyle = '#ffffff'; fc.fillRect(OX + 11, OY - 3, 2, 1); }
}
function blit(cv, v) {
  ctx.save();
  ctx.translate(v.x, v.y);
  if (v.rot) ctx.rotate(v.rot);
  ctx.scale(v.f, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, -OX, -OY);
  ctx.restore();
}
// world position of a local point (facing right, level) for the view v = { x, y, rot, f }
function world(v, lx, ly) {
  const c = Math.cos(v.rot), s = Math.sin(v.rot), X = lx * v.f;
  return { x: v.x + X * c - ly * s, y: v.y + X * s + ly * c };
}
// a gun at angle a (up from forward) pointing into the world, for the view v
function dirOf(v, a) {
  const lx = Math.cos(a) * v.f, ly = -Math.sin(a), c = Math.cos(v.rot), s = Math.sin(v.rot);
  return { x: lx * c - ly * s, y: lx * s + ly * c };
}
// pitch in 2 degree steps, none when nearly level, so the pixels stay calm
const tilt = rot => Math.abs(rot) < 0.025 ? 0 : Math.round(rot / 0.035) * 0.035;

// ============================================================
// Water: the lagoon under the jet-ski, its shores, floating or resting on a sandbar
// ============================================================
const HALF = 30, KEEL = 24, DRAFT = 1;   // on sand the keel digs in a little (so level shots still hit fins)
function waterAt(x) { const ws = LV && LV.water; if (ws) for (const w of ws) if (x >= w.x0 && x <= w.x1) return w; return null; }
// The stretch of water the jet-ski is on: its surface y and how far it may go (the hull stays off the beaches)
function bindWater(r, x) {
  const w = waterAt(x);
  if (!w) { r.wl = groundAt(x) - DRAFT; r.lo = r.hi = x; r.sl = x - HALF; r.sr = x + HALF; return; }
  r.wl = w.y;
  let sl = w.x0 - 40, sr = w.x1 + 40;
  while (sl < w.x0 + 200 && groundAt(sl + 1) < w.y) sl++;
  while (sr > w.x1 - 200 && groundAt(sr - 1) < w.y) sr--;
  r.sl = Math.max(sl, w.x0); r.sr = Math.min(sr, w.x1);
  r.lo = r.sl + HALF; r.hi = r.sr - HALF - 12;
}
// Where the hull rests at x: on the surface, or on the sand where the ground comes up (a sandbar); its slope
const SUP = { y: 0, rot: 0, sand: false };
function support(x, r) {
  const wl = r.wl, gl = groundAt(x - KEEL) - DRAFT, gm = groundAt(x) - DRAFT, gr = groundAt(x + KEEL) - DRAFT;
  const yl = Math.min(wl, gl), yr = Math.min(wl, gr), ym = Math.min(wl, gm);
  SUP.y = Math.min(ym, (yl + yr) / 2);
  SUP.rot = Math.atan2(yr - yl, KEEL * 2);
  SUP.sand = gm < wl - 0.5 || gl < wl - 0.5 || gr < wl - 0.5;
  return SUP;
}
const deep = (x, wl) => groundAt(x) > wl + 1.5;
// the nearest pier (one-way platform t 'pier') within reach of a hop from x
function pierNear(x, wl) {
  let best = null, bd = 25;
  for (const pl of LV.plats) {
    if (pl.t !== 'pier' || pl.y > wl - 8) continue;
    const d = x < pl.x ? pl.x - x : x > pl.x + pl.w ? x - pl.x - pl.w : 0;
    if (d < bd) { bd = d; best = pl; }
  }
  return best;
}

// ============================================================
// The ride: state and helpers
// ============================================================
const ARMOUR = 5, TORPS = 8, TOP = 2.1, SAND_TOP = 1.0, ACC = 0.075, BRAKE = 0.15, COAST = 0.03;
const HOP = -3.1, HOP_G = 0.22, HOP_G_HELD = 0.13, HOP_HOLD = 8, HOP_CD = 22, BOARD = 18, MGV = 7;
const newRide = () => ({
  type: 'jetski', armour: ARMOUR, torps: TORPS, ga: 0, cd: 0, tcd: 0, vx: 0, rot: 0, sus: 0, susV: 0, wk: 0, lean: 0,
  muzzle: 0, tflash: 0, hitT: 0, board: 0, hopX: 0, hopY: 0, hold: 0, flag: 0, flagT: 0, t: 0, air: false, sand: false,
  hello: false, beach: 0, hum: 0, wl: 234, lo: 0, hi: 0, sl: 0, sr: 0, smokeT: 0, thr: false, hopCd: 0
});
// the timers every jet-ski runs, ridden or parked: the bob spring, pennant, cooldowns, flashes
function tick(r, fast) {
  r.t++;
  r.susV += -r.sus * 0.22 - r.susV * 0.2;
  r.sus = clamp(r.sus + r.susV, -3, 4);
  if (--r.flagT <= 0) { r.flagT = fast ? 4 : 9; r.flag = (r.flag + 1) & 3; }
  if (r.hitT > 0) r.hitT--;
  if (r.cd > 0) r.cd--;
  if (r.tcd > 0) r.tcd--;
  if (r.muzzle > 0) r.muzzle--;
  if (r.tflash > 0) r.tflash--;
  if (r.hopCd > 0 && !r.air) r.hopCd--;
}
// bob: a slow swell while idling, the spring on top (hops, hits, chop)
const bob = r => r.air ? 0 : Math.round(r.sus + Math.sin(r.t * 0.07) * (Math.abs(r.vx) < 0.6 ? 0.9 : 0.4));
const gunIndex = r => clamp(Math.round(r.ga / GSTEP), 0, 12);
const viewOf = (x, y, r, f) => ({ x: Math.round(x), y: Math.round(y) + bob(r), rot: tilt(r.rot), f });
function stateOf(r, wt, parked) {
  ST.gi = gunIndex(r); ST.plates = platesFor(r.armour); ST.wt = wt; ST.muzzle = r.muzzle > 0; ST.flag = r.flag;
  ST.lazy = parked || Math.abs(r.vx) < 0.8; ST.lamp = !parked; ST.lights = !parked || ((G.t >> 5) & 1) === 0;
  ST.tflash = r.tflash;
  return ST;
}
// splash and spray particles (update code: rand is fine here)
function splash(x, y, n, dir, big) {
  if (G.parts.length > 600) return;
  for (let i = 0; i < n; i++) {
    G.parts.push({ type: 'spark', x: x + rand(-5, 5), y: y - 1, vx: dir * rand(0.2, 1.4) + rand(-0.6, 0.6), vy: -rand(1, big ? 3.6 : 2.4), g: 0.16, life: rand(12, 24), max: 24, size: rand(0, 1) < 0.4 ? 2 : 1, c: rand(0, 1) < 0.55 ? '#ffffff' : '#bfeff4' });
  }
}
function sandSpray(x, y, dir, n) {
  if (G.parts.length > 600) return;
  for (let i = 0; i < n; i++) G.parts.push({ type: 'spark', x: x + rand(-3, 3), y: y - 1, vx: dir * rand(0.4, 1.4), vy: -rand(0.6, 1.8), g: 0.18, life: rand(10, 18), max: 18, size: rand(0, 1) < 0.5 ? 2 : 1, c: rand(0, 1) < 0.5 ? '#e8d6a8' : '#bfa676' });
  dust(x, y, 1, dir);
}

// ============================================================
// Driving (RIDES.jetski.update): left/right throttle, Z hop, X nose gun (Up swings it up), C torpedo, Down + Z off
// ============================================================
function rideUpdate(p, r) {
  const moving = Math.abs(r.vx) > 0.8;
  tick(r, moving);
  p.crouch = false; p.onPlat = null; p.aim = 'fwd'; p.kb = 0; p.knife = 0;
  if (r.board > 0) {
    // hopping into the seat: the jet-ski dips, then the engine starts with a roar and a puff
    const s = support(p.x, r);
    p.vx = 0; p.vy = 0; p.y = s.y; p.onGround = true; r.rot += (s.rot - r.rot) * 0.3;
    if (r.board === 6) r.susV += 1.4;
    if (--r.board === 0) engineStart(p, r);
    return;
  }
  if (r.beach > 0) { beachStep(p, r); return; }
  const L = ctl('left'), Rt = ctl('right'), D = ctl('down');
  if (D && ctlTap('jump') && !r.air) { hopOff(p, r); return; }
  const mv = L && !Rt ? -1 : Rt && !L ? 1 : 0;
  r.thr = !!mv;
  if (mv && mv !== p.facing) {
    // a quick spin round: spray off the side
    p.facing = mv;
    if (!r.air && !r.sand) splash(p.x, r.wl, 6, mv, false);
  }
  // throttle: it glides, so speeding up and coasting are gentle, braking against the motion is quicker
  if (mv) r.vx += (r.vx * mv < 0 ? BRAKE : ACC) * mv;
  else r.vx -= Math.sign(r.vx) * Math.min(Math.abs(r.vx), COAST);
  const top = r.sand ? SAND_TOP : TOP;
  if (Math.abs(r.vx) > top) r.vx = Math.sign(r.vx) * Math.max(top, Math.abs(r.vx) - 0.14);
  // the screen edges stop it (a camera lock): no snapping back
  if ((r.vx < 0 && p.x + r.vx < G.cam.x + 30) || (r.vx > 0 && p.x + r.vx > G.cam.x + W - 30)) r.vx = 0;
  // the shores: it never goes onto land
  const was = r.vx;
  let nx = p.x + r.vx, shore = 0;
  if (nx > r.hi) { nx = r.hi; shore = 1; } else if (nx < r.lo) { nx = r.lo; shore = -1; }
  if (shore) {
    if (Math.abs(r.vx) > 0.9) { r.susV += 1; G.shake = Math.max(G.shake, 1.5); sandSpray(nx + shore * (HALF + 4), r.wl, shore, 4); Snd.noise(0.12, 0.1, 700); }
    r.vx = 0;
  }
  p.x = nx; p.vx = r.vx;
  // the far shore: it runs up onto the sand and the hero hops off onto the beach
  if (shore > 0 && !r.air && (mv > 0 || was > 0.05)) { startBeach(p, r); return; }
  const s = support(p.x, r);
  // sand: a slow skid on the keel, sand flying; going onto it with a thump
  if (s.sand && !r.sand && !r.air && Math.abs(r.vx) > 0.6) { r.susV -= 0.8; Snd.noise(0.18, 0.08, 500); }
  r.sand = s.sand;
  // hop (hold Z for a higher one), land with a splash; it needs a moment to bite the water again after landing
  if (!r.air && ctlTap('jump') && !D && r.hopCd <= 0) {
    p.vy = HOP; r.air = true; r.hold = HOP_HOLD; r.susV = 0; r.hopCd = HOP_CD;
    if (r.sand) sandSpray(p.x, s.y + DRAFT, -p.facing, 5); else splash(p.x - p.facing * 10, r.wl, 10, -p.facing, true);
    Snd.tone('square', 140, 330, 0.1, 0.06);
  }
  if (r.air) {
    p.vy = Math.min(p.vy + (ctl('jump') && r.hold-- > 0 && p.vy < 0 ? HOP_G_HELD : HOP_G), 6);
    p.y += p.vy;
    if (p.vy > 0 && p.y >= s.y) {
      const hard = p.vy;
      p.y = s.y; p.vy = 0; r.air = false; r.susV += hard * 0.55;
      if (r.sand) { sandSpray(p.x - 12, s.y + DRAFT, -1, 4); sandSpray(p.x + 12, s.y + DRAFT, 1, 4); Snd.noise(0.14, 0.18, 500); }
      else { splash(p.x - 16, r.wl, 9, -1, true); splash(p.x + 16, r.wl, 9, 1, true); Snd.noise(0.2, 0.16, 1500); }
      Snd.tone('sine', 120, 50, 0.14, 0.14);
      G.shake = Math.max(G.shake, hard * 0.5);
    }
  } else { p.y = s.y; p.vy = 0; }
  p.onGround = !r.air;
  // pitch: the nose lifts when the throttle bites and rising off a hop, dips falling back and braking
  let pitch = 0;
  if (r.air) pitch = clamp(-p.vy * 0.05, -0.12, 0.16);
  else if (mv && mv * r.vx >= 0 && Math.abs(r.vx) < top * 0.85 && !r.sand) pitch = 0.06;
  else if (!mv && Math.abs(r.vx) > 1) pitch = -0.03;
  r.rot += (s.rot - pitch * p.facing - r.rot) * (r.air ? 0.12 : 0.25);
  r.lean = mv && mv * r.vx >= 0 && Math.abs(r.vx) > 0.3 ? 1 : !mv && Math.abs(r.vx) > 1 ? -1 : 0;
  r.wk += ((r.air || r.sand ? 0 : Math.abs(r.vx) / TOP) - r.wk) * 0.08;
  // chop: little bumps at speed; spray off the bow, sand off the keel
  const speed = Math.abs(r.vx);
  if (!r.air && speed > 1.2 && rand(0, 1) < 0.07) r.susV += rand(0.25, 0.6);
  if (!r.air && speed > 0.4) {
    if (r.sand) { if (r.t % 4 === 0) sandSpray(p.x - p.facing * 20, s.y + DRAFT, -Math.sign(r.vx), 2); }
    else if (r.t % 3 === 0 && speed > 1.1) splash(p.x + p.facing * 24, r.wl, 1, Math.sign(r.vx), false);
  }
  // engine hum, louder with the throttle
  if (--r.hum <= 0) { r.hum = mv ? 14 : 24; Snd.tone('sawtooth', 70 + speed * 30, 58 + speed * 22, 0.08, mv ? 0.025 : 0.012); }
  hurtSmoke(p.x, p.y, r, p.facing);
  // nose gun: holding Up swings it up to 90 degrees, letting go swings it back; X fires along it
  r.ga = ctl('up') ? Math.min(Math.PI / 2, r.ga + 0.11) : Math.max(0, r.ga - 0.13);
  const v = viewOf(p.x, p.y, r, p.facing);
  if (ctl('fire') && r.cd <= 0) fireGun(p, r, v);
  if (ctlTap('bomb')) {
    if (r.torps > 0 && r.tcd <= 0) {
      if (deep(p.x + p.facing * 22, r.wl) && !r.sand) fireTorp(p, r, v);
      else { Snd.tone('square', 220, 160, 0.06, 0.06); G.texts.push({ x: p.x, y: p.y - 50, s: 'NEED WATER!', t: 50, c: '#bfeaff' }); r.tcd = 20; }
    } else if (r.torps <= 0) { Snd.tone('square', 220, 160, 0.06, 0.06); G.texts.push({ x: p.x, y: p.y - 50, s: 'NO TORPEDOES!', t: 50, c: '#ff8a5c' }); r.tcd = 30; }
  }
}
function engineStart(p, r) {
  r.susV += 1.2;
  Snd.tone('sawtooth', 50, 170, 0.35, 0.08); Snd.noise(0.3, 0.1, 900);
  const v = viewOf(p.x, p.y, r, p.facing), n = world(v, -34, -3);
  for (let i = 0; i < 3; i++) G.parts.push({ type: 'smoke', x: n.x + rand(-2, 2), y: n.y - i * 2, vx: -p.facing * rand(0.3, 0.7), vy: -rand(0.3, 0.7), life: 36, max: 36, size: 2 + i * 0.4 });
  splash(n.x, r.wl, 8, -p.facing, true);
}
// a badly hurt jet-ski smokes from the hood vents (and sparks at the last armour point)
function hurtSmoke(x, y, r, f) {
  if (r.armour > 2 || G.parts.length > 600) return;
  if (++r.smokeT % (r.armour <= 1 ? 8 : 14)) return;
  G.parts.push({ type: 'smoke', x: x + f * rand(18, 26), y: y - 13, vx: -f * rand(0.2, 0.6), vy: -rand(0.5, 0.9), life: 44, max: 44, size: rand(2, 3.2) });
  if (r.armour <= 1 && r.smokeT % 16 === 0) sparks(x + f * 22, y - 12, 2, '#ffb52e');
}

// Nose gun: 1 damage, quick, a little spread. Level shots fly at the waterline - 13 (y 221 in the lagoon) and start
// back inside the hull (they only show from the muzzle on), so a fin right at the bow or under it is hit too.
function fireGun(p, r, v) {
  r.cd = 5; r.muzzle = 3;
  const a = gunIndex(r) * GSTEP, d = dirOf(v, a), j = rand(-0.25, 0.25), back = 24 * Math.cos(a);
  const m = world(v, GUN_AT[0] + Math.cos(a) * (4 - back), GUN_AT[1] - Math.sin(a) * (4 - back));
  G.pb.push({ x: m.x, y: m.y, vx: d.x * MGV - d.y * j, vy: d.y * MGV + d.x * j, dmg: 1, life: 78, age: 0, hide: Math.ceil((back + 9) / MGV), rideGun: true, update: ageUp, draw: drawShot });
  const c = world(v, GUN_AT[0] - 2, GUN_AT[1] - 2);
  if (G.parts.length < 650) G.parts.push({ type: 'debris', x: c.x, y: c.y, vx: -v.f * rand(0.4, 1.1), vy: -rand(1.4, 2.2), g: 0.2, life: 20, max: 20, size: 1, c: '#e8b43a' });
  Snd.hmg();
}
const ageUp = b => { b.age++; };
function drawShot(b) {
  if (b.age < (b.hide || 2)) return;
  const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, x = Math.round(b.x), y = Math.round(b.y);
  R(Math.round(b.x - ux * 7), Math.round(b.y - uy * 7), 2, 2, '#ff8c1a');
  R(Math.round(b.x - ux * 4) - 1, Math.round(b.y - uy * 4) - 1, 3, 3, '#ffb52e');
  R(x - 1, y - 1, 3, 3, '#ffe066'); R(x, y, 1, 1, '#ffffff');
}

// Torpedo: drops from the hull side into the water, skims the surface speeding up, bursts on a fin (or anything in
// its way) and on the shore. 6 damage in a radius of 24.
function fireTorp(p, r, v) {
  r.torps--; r.tcd = 32; r.tflash = 8; r.susV += 0.7;
  const f = p.facing, s = world(v, 10, -2);
  G.pb.push({ x: s.x, y: s.y, vx: f * (1.4 + Math.max(0, r.vx * f)), vy: r.air ? 0.6 : 0, dmg: 6, life: 190, age: 0, f, wl: r.wl, torp: true,
    update: torpUpdate, draw: drawTorp, onHit: torpBoom, onGround: torpBoom, onProp: torpBoom, onPow: torpBoom });
  splash(s.x, r.wl, 7, f, false);
  r.vx -= f * 0.25;
  Snd.tone('sine', 420, 90, 0.32, 0.09); Snd.noise(0.25, 0.08, 1400);
}
function torpUpdate(b) {
  b.age++;
  const nx = b.x + b.vx, w = waterAt(nx);
  // runs aground: it bursts on the shore
  if (!w || groundAt(nx) < w.y + 2) { torpBoom(b); b.life = 0; return; }
  const sy = w.y - 1;
  if (b.y < sy - 0.5) {
    b.vy = Math.min(b.vy + 0.25, 4);
    if (b.y + b.vy >= sy) { b.vy = sy - b.y; splash(b.x, w.y, 6, b.f, false); }
  } else { b.y = sy; b.vy = b.age % 8 < 4 ? 0 : 0; }
  b.vx = b.f * Math.min(5, Math.abs(b.vx) + 0.11);
  if (b.age % 2 === 0 && G.parts.length < 600) G.parts.push({ type: 'spark', x: b.x - b.f * 5, y: w.y - 1, vx: -b.f * rand(0.1, 0.5), vy: -rand(0.3, 1), g: 0.12, life: 10, max: 10, size: 1, c: '#ffffff' });
  // a shootable enemy projectile in its way bursts with it
  for (const e of G.eb) {
    if (e.life > 0 && (e.shoot || (EB_TYPES[e.k] && EB_TYPES[e.k].shootable)) && Math.hypot(e.x - b.x, e.y - b.y) < 10) { e.life = 0; torpBoom(b); b.life = 0; return; }
  }
}
function torpBoom(b) {
  if (b.done) return;
  b.done = true;
  const x = b.x, y = Math.min(b.y, b.wl - 2);
  blast(x, y - 2, 24, 6, 'player');
  // a water spout
  for (let i = 0; i < 22 && G.parts.length < 680; i++) G.parts.push({ type: 'spark', x: x + rand(-6, 6), y: b.wl - 1, vx: rand(-1.2, 1.2), vy: -rand(2, 5.5), g: 0.18, life: rand(18, 30), max: 30, size: rand(0, 1) < 0.5 ? 2 : 1, c: rand(0, 1) < 0.6 ? '#ffffff' : '#9fe6f0' });
}
function drawTorp(b) {
  const x = Math.round(b.x), y = Math.round(b.y), f = b.f, s = TORP[(b.age >> 1) & 1];
  // foam V behind it and its shadow under the surface
  const wl = b.wl;
  if (y >= wl - 3) {
    ctx.fillStyle = 'rgba(10,60,80,0.25)'; ctx.fillRect(x - 6, wl + 1, 13, 2);
    for (let i = 0; i < 18; i++) {
      const sx = x - f * (6 + i), n = h2(Math.floor(sx), G.t >> 2, 9);
      if (n < 0.3 + i * 0.03) continue;
      ctx.fillStyle = i < 6 || n > 0.85 ? '#ffffff' : '#c8f4f4';
      ctx.fillRect(sx, wl - 1 - (i < 4 && n > 0.7 ? 1 : 0), 1, 1);
      if (i > 3 && n > 0.6) ctx.fillRect(sx, wl + 1 + Math.round(i * 0.12), 1, 1);
    }
  }
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  ctx.drawImage(s.img, -s.ox, -s.oy);
  ctx.restore();
  // the water over its lower half, a little bow wave at its nose
  if (y >= wl - 3) {
    ctx.fillStyle = 'rgba(60,190,205,0.6)'; ctx.fillRect(x - 8, wl, 17, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + f * 12, wl - 1, 1, 1); ctx.fillRect(x + f * 13 - (f < 0 ? 1 : 0), wl - 2 + ((b.age >> 1) & 1), 1, 1); ctx.fillRect(x + (f > 0 ? 9 : -10), wl, 2, 1);
  }
}

// ============================================================
// Damage, getting off, the far beach, the wreck
// ============================================================
function rideHurt(p, r) {
  const v = viewOf(p.x, p.y, r, p.facing), before = platesFor(r.armour);
  r.armour = Math.max(0, r.armour - 1); r.hitT = 8; r.susV += 1.6;
  G.shake = Math.max(G.shake, 3.5);
  const c = world(v, rand(-14, 22), rand(-18, -6));
  sparks(c.x, c.y, 10); sparks(c.x, c.y, 4, '#ffffff');
  Snd.clank(); Snd.tone('square', 320, 110, 0.18, 0.09);
  for (let n = before; n > platesFor(r.armour); n--) plateOff(v, KEEP[n - 1], r.wl);
  if (r.armour <= 0) { wreck(p, r); return; }
  p.inv = 80;
  if (r.armour === 2) G.texts.push({ x: p.x, y: p.y - 52, s: 'ARMOUR LOW!', t: 70, c: '#ff8a5c' });
}
// a jet-ski left where it floats (or a wreck / the beached one: the caller changes k and mode)
function park(x, f, r, armed) {
  r.vx = 0; r.muzzle = 0; r.tflash = 0; r.air = false; r.board = 0; r.beach = 0; r.hitT = 0; r.thr = false;
  const o = { k: 'jetski', x, y: support(x, r).y, hitT: 0, dead: false, facing: f, r, armed, near: false, hop: null, mode: null, t: 0 };
  G.props.push(o);
  return o;
}
// Down + Z: the hero hops off; onto the deck of a pier when one is close, else into the shallows behind the seat
function hopOff(p, r) {
  const v = viewOf(p.x, p.y, r, p.facing), s = world(v, -12, 1), pier = pierNear(p.x, r.wl);
  const o = park(p.x, p.facing, r, false);
  exitRide(p, false);
  p.x = s.x; p.y = s.y;
  if (pier) heroHop(o, p, clamp(p.x, pier.x + 8, pier.x + pier.w - 8), pier.y, 24, 14, pier);
  else p.kb = -p.facing * 1.4;
  Snd.tone('square', 300, 150, 0.1, 0.06);
}
// A scripted hop for the hero (onto a pier, onto the far beach), run by the jet-ski prop left behind, after the
// player update each frame: an arc from where they are to (x1, y1) in n frames, peak pk above the higher end
function heroHop(o, p, x1, y1, n, pk, pl) { o.hop = { p, t: 0, n, x0: p.x, y0: p.y, x1, y1, pk, pl }; p.onGround = false; p.vy = -2; }
function hopStep(o) {
  const h = o.hop, p = G.p;
  if (!h) return;
  if (!p || p !== h.p || p.dead || p.ride) { o.hop = null; return; }
  h.t++;
  const k = h.t / h.n, top = Math.min(h.y0, h.y1) - h.pk;
  // a parabola through the start, the peak and the end
  const y = (1 - k) * (1 - k) * h.y0 + 2 * k * (1 - k) * (2 * top - (h.y0 + h.y1) / 2) + k * k * h.y1;
  p.vy = y - p.y; p.x = lerp(h.x0, h.x1, k); p.y = y; p.onGround = false; p.onPlat = null; p.vx = 0; p.kb = 0;
  if (h.x1 !== h.x0) p.facing = h.x1 > h.x0 ? 1 : -1;
  if (h.t >= h.n) {
    p.x = h.x1; p.y = h.y1; p.vy = 0; p.onGround = true; p.onPlat = h.pl || null;
    dust(p.x, p.y, 4);
    o.hop = null;
  }
}
// The far shore: the jet-ski runs up onto the sand, nose up, and the hero hops off onto the beach
function startBeach(p, r) {
  r.beach = 1; r.vx = 0;
  Snd.noise(0.35, 0.12, 700); Snd.tone('sawtooth', 120, 50, 0.4, 0.05);
}
function beachStep(p, r) {
  r.beach++;
  if (r.beach <= 10) {
    p.x += 0.45 * (1 - r.beach / 11);
    if (r.beach % 2 === 0) sandSpray(p.x + p.facing * 30, r.wl, p.facing, 2);
  }
  const s = support(p.x, r);
  p.y = s.y; p.vy = 0; p.onGround = true; r.air = false;
  r.rot += (s.rot - 0.07 * p.facing - r.rot) * 0.3;
  r.wk *= 0.9;
  if (r.beach === 16) {
    const v = viewOf(p.x, p.y, r, p.facing), seat = world(v, -12, 1);
    const o = park(p.x, p.facing, r, false);
    o.k = 'jetskiwreck'; o.mode = 'beached'; o.rot = r.rot;
    exitRide(p, false);
    p.x = seat.x; p.y = seat.y;
    const tx = r.sr + 22;
    heroHop(o, p, tx, groundAt(tx), 26, 14, null);
    G.texts.push({ x: tx, y: groundAt(tx) - 48, s: 'LAND HO!', t: 80, c: '#ffe066' });
    Snd.tone('square', 300, 520, 0.12, 0.06); say('Land ho!', 1.1, 1);
  }
}
// armour 0: the hero is thrown clear; the jet-ski sinks with a gurgle (or falls apart on a sandbar)
function wreck(p, r) {
  const v = viewOf(p.x, p.y, r, p.facing), s = world(v, -12, 1);
  const o = park(p.x, p.facing, r, false);
  o.k = 'jetskiwreck'; o.mode = r.sand ? 'fizzle' : 'sink'; o.t = 0; o.rot = r.rot; o.depth = 0; o.bubbles = [];
  exitRide(p, true);
  p.x = s.x; p.y = s.y;
  G.texts.push({ x: o.x, y: o.y - 54, s: 'UH-OH!', t: 60, c: '#ff8a5c' });
  Snd.hurt();
}
// A plate knocked off: it tumbles away and plops into the water (or bounces on the sand)
function plateOff(v, i, wl) {
  const [x, y, w, h] = PLATE_RECT[i], c = world(v, x + w / 2, y + h / 2), lx = x + w / 2;
  bits().list.push({ s: PLATES[i], x: c.x, y: c.y, vx: v.f * (lx > 0 ? 1 : -1) * rand(0.6, 1.8), vy: -rand(2.8, 4.2), rot: 0, vr: rand(-0.35, 0.35), f: v.f, life: 120, wet: false, wl });
  sparks(c.x, c.y, 5);
}
function bits() {
  let o = G.props.find(q => q.k === 'jetskiwreck' && q.mode === 'bits' && !q.dead);
  if (!o) { o = { k: 'jetskiwreck', mode: 'bits', x: G.cam.x + W / 2, y: 0, hitT: 0, dead: false, list: [], t: 0 }; G.props.push(o); }
  return o;
}

// ============================================================
// Drawing the jet-ski and its water
// ============================================================
// fill styles prepared once (no string building per particle)
const WHITE_A = [], BLUE_A = [];
for (let i = 0; i <= 10; i++) { WHITE_A.push('rgba(255,255,255,' + (i / 10).toFixed(1) + ')'); BLUE_A.push('rgba(168,232,240,' + (i / 10).toFixed(1) + ')'); }
const aIdx = a => clamp(Math.round(a * 10), 0, 10);

// The V wake behind the stern: a churned line in the middle and two arms spreading (pattern fixed to the water)
function drawWake(x, wl, f, k) {
  if (k < 0.04) return;
  const n = Math.round(120 * Math.min(1, k * 1.2) + 8), T2 = G.t >> 2, T3 = G.t >> 3;
  for (let i = 0; i < n; i++) {
    const d = i + 2, sx = Math.round(x - f * d), kk = (1 - i / n) * Math.min(1, k * 1.5);
    if (!deep(sx, wl)) continue;
    if (h2(sx, T2, 1) < 0.9 * kk + 0.04) { ctx.fillStyle = h2(sx, T2, 2) < 0.55 ? '#ffffff' : '#c8f4f4'; ctx.fillRect(sx, wl + Math.round((h2(sx, T3, 3) - 0.5) * (2 + i * 0.03)), i < 40 ? 2 : 1, 1); }
    const far = wl - 1 - Math.round(i * 0.06), near = wl + 2 + Math.round(i * 0.17);
    if (h2(sx, 1, T3) < 0.8 * kk + 0.08) { ctx.fillStyle = WHITE_A[aIdx(0.5 + 0.5 * kk)]; ctx.fillRect(sx, far, i < 30 ? 2 : 1, 1); }
    if (h2(sx, 2, T3) < 0.85 * kk + 0.08) { ctx.fillStyle = WHITE_A[aIdx(0.45 + 0.55 * kk)]; ctx.fillRect(sx, near, 2, 1); if ((sx & 1) === 0) { ctx.fillStyle = BLUE_A[aIdx(0.6 * kk + 0.2)]; ctx.fillRect(sx, near + 1, 2, 1); } }
  }
}
// The jet: a thick arc of white water fanning out behind the stern and breaking into drops
function drawRooster(nx, ny, f, k, wl) {
  if (k < 0.08) return;
  const n = Math.round(420 * k), TT = G.t >> 1, len = 40 * (0.35 + 0.65 * k), hk = 0.45 + 0.55 * k;
  for (let i = 0; i < n; i++) {
    const tau = Math.pow(i / n, 1.15) * len, jit = 0.35 + tau * 0.2;
    const px = nx - f * 1.75 * tau + (hsh(i * 3.3 + TT) - 0.5) * 2 * jit;
    const py = ny - (2.9 * tau - 0.074 * tau * tau) * hk + (hsh(i * 5.9 + TT) - 0.5) * 2 * jit;
    if (py > wl) continue;
    const core = tau < 18 && hsh(i * 1.7) > 0.2, sz = tau < 7 ? 3 : tau < 17 ? 2 : 1, a = clamp(1.2 - tau / 40, 0.3, 1);
    ctx.fillStyle = (core || hsh(i * 7.1) > 0.45 ? WHITE_A : BLUE_A)[aIdx(a)];
    ctx.fillRect(Math.round(px), Math.round(py), sz, tau < 22 ? sz : 1);
  }
  // the churned water where the jet hits the surface
  for (let i = 0; i < 14; i++) {
    const n = h2(i, G.t >> 1, 6), x = Math.round(nx - f * (2 + i * 1.6));
    if (n < 0.25) continue;
    ctx.fillStyle = n > 0.6 ? '#ffffff' : '#d8f6f6';
    ctx.fillRect(x, wl - 1 - (n > 0.8 ? 1 : 0), 2, 1);
  }
}
// A sheet of water peeling off the bow and falling forward
function drawBowSpray(bx, wl, f, k) {
  if (k < 0.3) return;
  const n = Math.round(60 * k), T = G.t >> 2;
  for (let i = 0; i < n; i++) {
    const vx = 0.3 + hsh(i * 2.7) * 1.5, vy = -0.5 - hsh(i * 4.1) * 1.5 * k, tau = hsh(i * 6.3 + T) * 9;
    const px = bx + f * (hsh(i * 8.8) * 6 + vx * tau - 6), py = wl - 1 + vy * tau + 0.13 * tau * tau;
    if (py > wl + 1) continue;
    ctx.fillStyle = hsh(i * 5.3) > 0.4 ? '#ffffff' : '#c8f6f6';
    ctx.fillRect(Math.round(px), Math.round(py), tau < 3 ? 2 : 1, 1);
  }
}
// foam speckles along the waterline
function foam(x, y, w, seed) {
  for (let i = -w; i <= w; i++) {
    const n = h2(i + seed, G.t >> 2, 4);
    if (n < 0.3) continue;
    ctx.fillStyle = n > 0.7 ? '#ffffff' : '#c6f3f1';
    ctx.fillRect(x + i, y - (n > 0.86 ? 1 : 0), 1, 1);
  }
}
// the water over the bottom of the hull (the bow curves up out of it), foam along it, the red reflection under it
function waterline(v, wl, moving) {
  const x = v.x, f = v.f, y = wl;
  ctx.fillStyle = 'rgba(170,40,40,0.22)';
  ctx.fillRect(Math.min(x - 29 * f, x + 25 * f), y + 4, 54, 2); ctx.fillRect(Math.min(x - 24 * f, x + 20 * f), y + 7, 44, 1);
  for (let k = 0; k < 4; k++) {
    const a = x + f * (-32 + k), b = x + f * (20 - 2 * k);
    ctx.fillStyle = k === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(40,160,180,' + (0.55 + k * 0.1).toFixed(2) + ')';
    ctx.fillRect(Math.min(a, b), y + k, Math.abs(b - a), 1);
  }
  foam(x - 6 * f, y - 1, moving ? 24 : 20, x);
  if (!moving) {
    // little ripples lapping round the parked hull
    const ph = (G.t >> 3) % 6;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(x - 38 - ph, y + 1, 3, 1); ctx.fillRect(x + 37 + ph, y + 1, 3, 1);
  }
}
// The hero in the seat, hands on the handlebar (the hero's own gun is clipped away); 'run' at speed: the ponytail flies
function seatHero(p, v, r) {
  const s = world(v, -12 + r.lean, 1);
  ctx.save();
  ctx.translate(Math.round(s.x), Math.round(s.y)); ctx.scale(v.f, 1);
  ctx.beginPath(); ctx.rect(-30, -60, 60, 39); ctx.rect(-30, -21, 37, 30); ctx.clip();
  drawHero(HEROES[G.hero], 0, 0, 1, { pose: Math.abs(r.vx) > 1.3 && !r.air ? 'run' : 'idle', t: p.t, aim: 'fwd', weapon: 'pistol', muzzle: 0 });
  ctx.restore();
}
// Boarding: the hero hops from where they stood into the seat (k 0 -> 1)
function hopHero(p, r, v, k) {
  const s = world(v, -12, 1), x0 = p.x + r.hopX, y0 = p.y + r.hopY;
  drawHero(HEROES[G.hero], x0 + (s.x - x0) * k, y0 + (s.y - y0) * k - Math.sin(k * Math.PI) * 10, v.f, { pose: 'jump', t: p.t, aim: 'fwd', weapon: p.weapon, muzzle: 0 });
}
// Smoke from the hood vents when badly hurt (armour 2 and less): pixel puffs rising and growing, drawn from G.t
const SMOKE = ['#57525e', '#3f3b45', '#2e2b33'];
function smokeColumn(v, armour) {
  if (armour > 2) return;
  const b = world(v, 22, -13), n = armour <= 1 ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const k = ((G.t * (armour <= 1 ? 0.03 : 0.022) + i / n) % 1), rr = 1.2 + k * 3.2;
    const x = Math.round(b.x - v.f * k * 12 + Math.sin(k * 6 + i) * 2), y = Math.round(b.y - k * 28);
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.fillStyle = SMOKE[armour <= 1 ? 2 : 1]; circ(x, y, rr + 1);
    ctx.fillStyle = SMOKE[armour <= 1 ? 1 : 0]; circ(x - 1, y - 1, rr);
  }
  ctx.globalAlpha = 1;
  if (armour <= 1 && (G.t >> 2) % 5 === 0) { R(Math.round(b.x) - 1, Math.round(b.y) - 2, 2, 2, '#ffb52e'); R(Math.round(b.x), Math.round(b.y) - 3, 1, 1, '#fff3b0'); }
}
// drops falling off the hull while it is in the air
function drips(v, wl) {
  for (let i = 0; i < 7; i++) {
    const lx = -26 + i * 8 + Math.round(hsh(i * 3.1) * 4), ph = (G.t + i * 5) % 14, s = world(v, lx, 3);
    const y = Math.round(s.y + ph * 1.4);
    if (y >= wl) continue;
    ctx.fillStyle = i % 2 ? '#ffffff' : '#bfeff4'; ctx.fillRect(Math.round(s.x), y, 1, 2);
  }
}
// One jet-ski: wake and jet behind it, the back layer, the hero, the front layer, the water round the hull
function drawSki(v, st, r, opt) {
  const wl = r.wl, speed = Math.abs(r.vx), afloat = !r.air && !r.sand && v.y >= wl - 2 && !opt.noWater;
  if (opt.wake) {
    // the wake trails behind the way it moves (for a moment after a spin round that is past the bow)
    const dir = Math.abs(r.vx) > 0.05 ? Math.sign(r.vx) : v.f;
    drawWake(Math.round(v.x - dir * 30), wl, dir, r.wk);
    if (afloat && opt.jet) { const n = world(v, -34, -3); drawRooster(n.x, Math.min(n.y, wl - 1), v.f, clamp(speed / TOP, 0, 1) * (r.thr ? 1 : 0.35), wl); }
  }
  if (r.air) {
    // the shadow on the water while hopping
    const hgt = clamp(wl - v.y, 0, 60), ww = Math.round(44 - hgt * 0.3);
    ctx.fillStyle = 'rgba(8,60,80,0.22)'; ctx.fillRect(v.x - (ww >> 1), wl, ww, 2); ctx.fillRect(v.x - (ww >> 2), wl - 1, ww >> 1, 1);
  }
  compose(st);
  blit(backC, v);
  if (opt.hero && !opt.heroFront) opt.hero();
  blit(frontC, v);
  if (opt.hero && opt.heroFront) opt.hero();
  if (afloat) waterline(v, wl, speed > 0.3);
  if (afloat && opt.wake) drawBowSpray(Math.round(v.x + v.f * 28), wl, v.f, clamp(speed / TOP, 0, 1));
  if (afloat && opt.jet && speed < 0.6) {
    // the engine idling: water bubbling out of the jet nozzle
    const n = world(v, -34, -2);
    for (let i = 0; i < 9; i++) {
      const ph = (G.t + i * 7) % 18, x = Math.round(n.x - v.f * (1 + ph * 0.5 + (i % 3))), y = wl - (ph < 6 ? 1 : 0) - (i % 4 === 0 && ph < 3 ? 1 : 0);
      ctx.fillStyle = ph < 9 ? '#ffffff' : '#c8f4f4'; ctx.fillRect(x, y, ph < 5 ? 2 : 1, 1);
    }
  }
  if (r.air) drips(v, wl);
  if (!opt.noSmoke) smokeColumn(v, r.armour);
}
function rideDraw(p, r) {
  const v = viewOf(p.x, p.y, r, p.facing);
  const wt = r.hitT > 4 || (p.inv > 0 && r.hitT <= 0 && p.inv % 10 < 2);
  const st = stateOf(r, wt, false);
  if (r.board > 0) {
    const k = 1 - r.board / BOARD;
    drawSki(v, st, r, { wake: false, hero: () => hopHero(p, r, v, k), heroFront: k < 0.6 });
  } else drawSki(v, st, r, { wake: true, jet: r.beach === 0, hero: p.hidden ? null : () => seatHero(p, v, r), heroFront: false });
}
// 'GET IN!' over a parked jet-ski, bouncing
function prompt(o) {
  const b = Math.round(Math.abs(Math.sin(G.t * 0.12)) * -4), x = Math.round(o.x - 6 * o.facing), y = Math.round(o.y) - 52 + b;
  text('GET IN!', x, y - 10, '#ffe066', 1, 'center');
  blob([[x - 1, y, 3, 3], [x - 3, y + 3, 7, 1], [x - 2, y + 4, 5, 1], [x - 1, y + 5, 3, 1], [x, y + 6, 1, 1]], '#ffe066');
  R(x - 1, y, 1, 3, '#fff6c2');
}

// HUD panel: the jet-ski, armour pips (green, yellow, red and blinking; the one just lost flashes white), torpedoes
function rideHud(r) {
  spr(ICON, 128, 8);
  text('JET-SKI', 157, 8, '#ffe066');
  const col = r.armour > 3 ? ['#8be0a8', '#d4ffe0'] : r.armour > 1 ? ['#ffd23f', '#fff3b0'] : ['#ff6b6b', '#ffc2c2'];
  const blink = r.armour <= 2 && G.t % 30 < 12;
  for (let i = 0; i < ARMOUR; i++) {
    const x = 157 + i * 7;
    if (i === r.armour && r.hitT > 0) RO(x, 21, 5, 4, '#ffffff');
    else if (i < r.armour) { RO(x, 21, 5, 4, blink ? col[1] : col[0]); R(x, 21, 5, 1, col[1]); R(x + 2, 23, 1, 1, '#2a4a3a'); }
    else { RO(x, 21, 5, 4, '#3a3a4a'); R(x + 2, 22, 1, 1, '#22222e'); }
  }
  spr(TORP_ICON, 196, 19);
  text('X' + r.torps, 227, 20, r.torps ? '#ffffff' : G.t % 30 < 15 ? '#ff6b6b' : '#7a3a3a', 1, 'right');
}

// its own keys (pixel-font glyphs only): two short lines over the jet-ski at the first boarding, one line on the pause
// screen (54 characters, 323 px: under the pause panel, inside the screen)
const HELP = ['Z: HOP  X: SHOOT  UP: AIM', 'C: TORPEDO  DOWN+Z: GET OFF'];
RIDES.jetski = {
  help: HELP.join('  '),
  update: rideUpdate,
  // the hull and the rider, a little smaller than the picture (fair); it also picks up items floating or on the floor
  box: p => ({ x: p.x - (p.facing > 0 ? 27 : 29), y: p.y - 32, w: 56, h: 34 }),
  draw: rideDraw,
  hurt: rideHurt,
  hud: rideHud
};

// ============================================================
// The parked jet-ski (level prop { k: 'jetski', x }): bobbing at the shoreline, 'GET IN!' while the hero is near,
// boarded by walking (or wading) into it. Also the one left behind by Down + Z.
// ============================================================
function parkedUpdate(o) {
  const r = o.r, p = G.p;
  hopStep(o);
  tick(r, false);
  r.ga = Math.max(0, r.ga - 0.13);
  r.wk *= 0.95;
  const s = support(o.x, r);
  o.y = s.y; r.rot += (s.rot - r.rot) * 0.25; r.sand = s.sand;
  hurtSmoke(o.x, o.y, r, o.facing);
  if (!p || p.dead) { o.near = false; return; }
  const dx = Math.abs(p.x - o.x);
  if (!o.armed && dx > 26 && !o.hop) o.armed = true;   // after getting off: move away first, then back in
  o.near = !p.ride && !p.hidden && dx < 110;
  if (o.armed && !o.hop && !p.ride && !p.hidden && dx < 22 && Math.abs(p.y - o.y) < 34) boardIt(p, o);
}
function boardIt(p, o) {
  const r = o.r, hx = p.x - o.x, hy = p.y - o.y;
  if (!boardRide(p, r)) return;
  o.dead = true;
  bindWater(r, o.x);
  r.board = BOARD; r.hopX = hx; r.hopY = hy; r.vx = 0; r.air = false; r.beach = 0; r.hum = 20;
  p.x = o.x; p.y = o.y; p.vy = 0; p.onGround = true; p.facing = o.facing;
  Snd.jump();
  if (!r.hello) {
    // the name, then its keys for a few seconds (like the tractor), kept inside the screen
    r.hello = true;
    const tx = clamp(o.x, G.cam.x + 86, G.cam.x + W - 86);
    G.texts.push({ x: tx, y: o.y - 76, s: 'BATTLE JET-SKI!', t: 90, c: '#ffe066' });
    G.texts.push({ x: tx, y: o.y - 64, s: HELP[0], t: 200, c: '#ffffff' });
    G.texts.push({ x: tx, y: o.y - 54, s: HELP[1], t: 200, c: '#ffffff' });
    say('Battle jet ski!', 1.1, 1);
  }
}
function parkedDraw(o) {
  if (o.x < G.cam.x - 100 || o.x > G.cam.x + W + 100) return;
  const r = o.r, v = viewOf(o.x, o.y, r, o.facing);
  drawSki(v, stateOf(r, false, true), r, { wake: r.wk > 0.05, jet: false, hero: null });
  if (o.near && o.armed) prompt(o);
}
PROP_TYPES.jetski = {
  make(o) {
    o.r = o.r || newRide(); o.facing = o.facing || 1; o.armed = o.armed !== false; o.near = false; o.hop = null;
    bindWater(o.r, o.x); o.y = support(o.x, o.r).y; o.r.rot = SUP.rot;
  },
  box: () => null,   // can't be shot or blown up while parked
  hit() {},
  update: parkedUpdate,
  draw: parkedDraw
};

// ============================================================
// PROP_TYPES.jetskiwreck (never a ride, so the harness bot leaves it alone):
//   'beached': left on the far beach, nose up on the sand, waves lapping at the stern (the hero hops off from it)
//   'sink':    armour 0 on the water: it sputters, tips its nose up and sinks with a gurgle (GLUG! GLUG! BLUB!)
//   'fizzle':  armour 0 on a sandbar: it shakes, smokes and falls apart in a puff of bolts
//   'bits':    plates knocked off, tumbling and plopping into the water
// ============================================================
function wreckUpdate(o) {
  o.t++;
  if (o.mode === 'bits') { bitsUpdate(o); return; }
  const r = o.r;
  hopStep(o);
  tick(r, false);
  r.ga = Math.max(0, r.ga - 0.13);
  r.wk *= 0.92;
  if (o.mode === 'beached') {
    const s = support(o.x, r);
    o.y = s.y; o.rot += (s.rot - 0.07 * o.facing - o.rot) * 0.2; r.rot = o.rot; r.sus = 0; r.susV = 0;
    return;
  }
  if (o.mode === 'fizzle') {
    G.shake = Math.max(G.shake, 1);
    if (o.t % 5 === 0) G.parts.push({ type: 'smoke', x: o.x + rand(-14, 14), y: o.y - rand(6, 16), vx: rand(-0.3, 0.3), vy: -rand(0.5, 1), life: 40, max: 40, size: rand(2, 3.5) });
    if (o.t % 7 === 0) sparks(o.x + rand(-20, 20), o.y - rand(4, 14), 3, '#ffb52e');
    if (o.t % 10 === 0) Snd.tone('square', 180 + (o.t % 20) * 6, 120, 0.06, 0.05);
    if (o.t >= 46) {
      boom(o.x, o.y - 8, 0.8);
      debris(o.x, o.y - 8, 10, '#d8392b'); debris(o.x, o.y - 8, 8, '#8f9aa7'); debris(o.x, o.y - 6, 4, '#3b2f2b');
      G.texts.push({ x: o.x, y: o.y - 40, s: 'CLUNK!', t: 60, c: '#ffe066' });
      o.dead = true;
    }
    return;
  }
  // 'sink': sputter on the surface, then tip up and go down, bubbles rising, gurgling
  const wl = r.wl;
  if (o.t < 28) {
    if (o.t % 6 === 0) { G.parts.push({ type: 'smoke', x: o.x + o.facing * 20, y: o.y - 14, vx: rand(-0.3, 0.3), vy: -rand(0.6, 1), life: 40, max: 40, size: 2.6 }); Snd.tone('square', 110, 70, 0.05, 0.05); }
    if (o.t % 9 === 0) sparks(o.x + rand(-16, 20), o.y - 10, 3, '#ffb52e');
    o.y = wl + (o.t % 4 < 2 ? 0 : 1);
  } else {
    o.depth += o.t < 70 ? 0.16 : 0.28;
    o.rot = -o.facing * Math.min(0.42, (o.t - 28) * 0.008);
    o.y = wl + o.depth;
    if (o.t % 3 === 0) o.bubbles.push({ x: o.x + rand(-26, 26), y: wl + rand(2, 10), vy: -rand(0.2, 0.5), r: rand(0, 1) < 0.3 ? 2 : 1, life: rand(16, 30) });
    for (const [t, s, xo] of [[40, 'GLUG!', -16], [76, 'GLUG!', 14], [112, 'BLUB!', 0]]) {
      if (o.t !== t) continue;
      G.texts.push({ x: o.x + xo, y: wl - 30, s, t: 60, c: '#bfeaff' });
      for (let i = 0; i < 5; i++) Snd.tone('sine', 360 - i * 40 + (i % 2) * 70, 200 - i * 20, 0.09, 0.07, i * 0.08);
      splash(o.x + xo, wl, 6, 0, false);
    }
    if (o.depth > 46) {
      // one last big bubble pops: foam ring
      splash(o.x, wl, 14, 0, true);
      Snd.tone('sine', 300, 900, 0.18, 0.08);
      o.dead = true;
    }
  }
  for (const b of o.bubbles) { b.y += b.vy; b.vy -= 0.02; b.life--; if (b.y < wl) { b.life = 0; if (G.parts.length < 650) G.parts.push({ type: 'spark', x: b.x, y: wl - 1, vx: rand(-0.4, 0.4), vy: -rand(0.4, 1), g: 0.12, life: 8, max: 8, size: 1, c: '#ffffff' }); } }
  o.bubbles = o.bubbles.filter(b => b.life > 0);
}
function bitsUpdate(o) {
  o.x = G.cam.x + W / 2;   // keep it from being culled while its bits fly
  for (const q of o.list) {
    if (q.life <= 0) continue;
    q.life--;
    if (!q.wet) {
      q.vy = Math.min(q.vy + 0.2, 6); q.x += q.vx; q.y += q.vy; q.rot += q.vr;
      const w = waterAt(q.x), gy = groundAt(q.x);
      if (w && gy > w.y + 2 && q.y >= w.y) {
        q.wet = true; q.y = w.y; q.wl = w.y; q.vx *= 0.25; q.vy = 0.25; q.vr *= 0.3; q.life = Math.min(q.life, 40);
        splash(q.x, w.y, 5, 0, false); Snd.tone('sine', 500, 200, 0.06, 0.05);
      } else if (q.y >= gy - 2 && q.vy > 0) {
        q.y = gy - 2; q.vy *= -0.4; q.vx *= 0.6; q.vr *= 0.5;
        if (Math.abs(q.vy) < 0.6) { q.vy = 0; q.vx *= 0.8; }
      }
    } else { q.y += q.vy; q.x += q.vx; q.vx *= 0.95; q.rot += q.vr; }
  }
  o.list = o.list.filter(q => q.life > 0 && q.x > G.cam.x - 40 && q.x < G.cam.x + W + 40);
  if (!o.list.length && o.t > 2) o.dead = true;
}
function wreckDraw(o) {
  if (o.mode === 'bits') {
    for (const q of o.list) {
      ctx.save();
      ctx.translate(Math.round(q.x), Math.round(q.y));
      ctx.rotate(Math.round(q.rot / (Math.PI / 12)) * Math.PI / 12);
      ctx.scale(q.f, 1);
      if (q.wet) ctx.globalAlpha = clamp(q.life / 40, 0, 1) * 0.6;
      ctx.drawImage(q.s.img, -Math.round(q.s.w / 2), -Math.round(q.s.h / 2));
      ctx.restore();
    }
    return;
  }
  if (o.x < G.cam.x - 100 || o.x > G.cam.x + W + 100) return;
  const r = o.r;
  const v = { x: Math.round(o.x), y: Math.round(o.y), rot: tilt(o.rot), f: o.facing };
  if (o.mode === 'beached') {
    const st = stateOf(r, false, true); st.lights = false; st.lazy = true;
    // waves lapping at the stern and along the sand
    drawSki(v, st, r, { wake: false, hero: null });
    const ph = (G.t >> 2) % 16, sx = Math.round(o.x - o.facing * 30);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(sx - 8 + (ph >> 1), r.wl, 6 - (ph >> 2), 1);
    if (ph < 8) ctx.fillRect(sx - 2, r.wl - 1, 4, 1);
    return;
  }
  const st = stateOf(r, false, true);
  st.lights = (o.mode === 'fizzle' ? o.t : 40 - o.t) % 6 < 3 && o.t < 40; st.lazy = true;
  if (o.mode === 'fizzle') {
    v.x += Math.round((hsh(G.t) - 0.5) * 3); v.y += Math.round((hsh(G.t + 7) - 0.5) * 2);
    st.wt = o.t > 30 && ((G.t >> 1) & 1) === 1;
    drawSki(v, st, r, { wake: false, hero: null });
    return;
  }
  // sinking: the part above the surface as it is, the part below seen through the water
  const wl = r.wl;
  if (o.t < 28) v.x += Math.round((hsh(G.t) - 0.5) * 2);
  ctx.save(); ctx.beginPath(); ctx.rect(v.x - 90, wl - 120, 180, 120); ctx.clip();
  drawSki(v, st, r, { wake: false, hero: null, noWater: true });
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(v.x - 90, wl, 180, 70); ctx.clip();
  ctx.globalAlpha = 0.32; compose(st); blit(backC, v); blit(frontC, v); ctx.globalAlpha = 1;
  ctx.restore();
  for (const b of o.bubbles) {
    const x = Math.round(b.x), y = Math.round(b.y);
    ctx.fillStyle = 'rgba(220,250,255,0.85)';
    if (b.r > 1) { ctx.fillRect(x - 1, y - 2, 3, 1); ctx.fillRect(x - 2, y - 1, 1, 3); ctx.fillRect(x + 2, y - 1, 1, 3); ctx.fillRect(x - 1, y + 2, 3, 1); }
    else ctx.fillRect(x, y, 1, 1);
  }
  // a ring of foam where it goes down
  foam(v.x, wl - 1, 26, 31);
}
PROP_TYPES.jetskiwreck = { box: () => null, hit() {}, update: wreckUpdate, draw: wreckDraw };
}
