'use strict';
var L3 = L3 || {};
// ============================================================
// Mission 3 enemies (VOLCANO ISLAND): the robot SHARK of the Shark Bay lagoon, the LAVA SHARK of the lava rivers
// (and the crater lake, when the whale shark calls one), the robot FROG of the jungle, and the LAVA BOMB the volcano
// throws over AREA 3. Exports (everything else is private to this block): ENEMY_TYPES.shark, .lavashark, .frog,
// EB_TYPES.lavabomb, EB_TYPES.frogmark (a hopping frog's landing marker, harmless), L3.lavaBomb(tx) and
// L3.lavaSharkBusy() (true while any lava shark is warning or leaping: level3.js holds its lava bombs meanwhile).
// The art is lifted from the approved proposal frames (proposals/level3: bay = shark, lava = lava shark, bomb and its
// landing ring, jungle = frog), painted pixel by pixel ONCE at load into crisp outlined sprites (3-tone shading, 1px
// OUT outline, a white copy for the hit flash), then animated here.
// Every attack warns first (an 8-year-old can learn each one):
//   shark      stops and turns to the hero for 50 frames: ripple rings, a flashing red/yellow ring, a red '!', its
//              beacon blinks fast; then it leaps in a high arc to where the hero was, jaws open. Only the leap hurts.
//   lava shark picks the column (or bank edge) the hero is on and LOCKS it: a red/yellow ring closes in on it while
//              the shark lines up in the gap beside it, its wake white-hot, bubbles swelling, its eye lamp blinking, '!'
//              (50 frames); then it leaps up over that spot. Its jaws bite only on the way up and only a hero still on
//              that spot: hopping to another column (or back from the bank's edge) always escapes. It never leaves its
//              lava; after its leap it swims off to the river's far end and dives.
//   frog       its throat bulges with a croak (30 frames); the sticky tongue lashes out at standing height (crouch or
//              jump!) at a hero at least 48 px away. A tongue that hits STICKS: it holds, then pulls the hero in
//              (0.6 px/frame) until they jump free or shoot the frog; reaching the frog (40+ frames after the stick) =
//              one hit and a push back. Sometimes it hops (never onto the hero or a cage): a red/yellow ring and a
//              shadow mark where it lands.
//   lava bomb  a blinking ring with a '!' closes in on the landing spot for 1.5 s; shootable in the air.
// Robots burst into bolts and plates when beaten (they sink in water and lava). No Math.random()/rand() at load
// time or in drawing (hsh() and G.t only); rand() only in update code.
// ============================================================
{
// ============================================================
// Helpers: colours, pixel buffers (0xRRGGBB ints, NONE = empty), outlines, baking to canvases
// ============================================================
const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
const PI4 = (...s) => s.map(I);
const OUTI = I(OUT);
const lerp = (a, b, k) => a + (b - a) * k;
const h2 = (x, y, s) => hsh(x * 12.9898 + y * 78.233 + s * 37.719);
const rgbI = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
function mixI(a, b, k) {
  k = clamp(k, 0, 1);
  const A = rgbI(a), B = rgbI(b);
  return (Math.round(lerp(A[0], B[0], k)) << 16) | (Math.round(lerp(A[1], B[1], k)) << 8) | Math.round(lerp(A[2], B[2], k));
}
const rgba = (c, a) => { const v = rgbI(typeof c === 'string' ? I(c) : c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')'; };
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function buf(w, h, ox = 0, oy = 0) { const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox, oy }; }
function put(b, x, y, c) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
function oval(b, cx, cy, rx, ry, c) {
  const RX = rx + 0.5, RY = ry + 0.5, X = Math.round(cx), Y = Math.round(cy);
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++)
    if (i * i / (RX * RX) + j * j / (RY * RY) <= 1) put(b, X + i, Y + j, c);
}
function line(b, x0, y0, x1, y1, c, t = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), hw = (t - 1) / 2;
  for (let i = 0; i <= n; i++) rect(b, Math.round(x0 + (x1 - x0) * i / n - hw), Math.round(y0 + (y1 - y0) * i / n - hw), t, t, c);
}
function path(b, pts, c, t = 1) { for (let i = 0; i + 1 < pts.length; i++) line(b, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, t); }
function inPoly(P, x, y) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// 1px outline round everything painted (4 neighbours)
function outline(b, c = OUTI) {
  const add = [], w = b.w, h = b.h, d = b.d;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i] !== NONE) continue;
    if ((x > 0 && d[i - 1] !== NONE) || (x < w - 1 && d[i + 1] !== NONE) || (y > 0 && d[i - w] !== NONE) || (y < h - 1 && d[i + w] !== NONE)) add.push(i);
  }
  for (const i of add) d[i] = c;
}
// white: every painted pixel but the outline turns white (the hit flash copy)
function bake(b, white) {
  const c = canvasOf(b.w, b.h), g = c.getContext('2d'), im = g.createImageData(b.w, b.h), dd = im.data;
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = i * 4;
    if (white && v !== OUTI) dd[j] = dd[j + 1] = dd[j + 2] = 255;
    else { dd[j] = (v >> 16) & 255; dd[j + 1] = (v >> 8) & 255; dd[j + 2] = v & 255; }
    dd[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// a sprite: the buffer origin (ox, oy) is its anchor
const mk = b => ({ img: bake(b), white: bake(b, true), w: b.w, h: b.h, ox: b.ox, oy: b.oy });
const blit = (s, x, y) => ctx.drawImage(FLASH && s.white ? s.white : s.img, Math.round(x) - s.ox, Math.round(y) - s.oy);
// live drawing: a crisp pixel disc in the current fillStyle; a thick pixel line (squares stepped along it)
function pdisc(x, y, r) {
  x = Math.round(x); y = Math.round(y);
  const R2 = (r + 0.5) * (r + 0.5);
  for (let j = -Math.floor(r); j <= Math.floor(r); j++) { const hw = Math.floor(Math.sqrt(Math.max(0, R2 - j * j))); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
}
function pl(x0, y0, x1, y1, w, c) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), hw = (w - 1) / 2;
  ctx.fillStyle = c;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n - hw), Math.round(y0 + (y1 - y0) * i / n - hw), w, w);
}
// an ellipse ring of 1px dots (rx, ry), dashed when gap > 0
function ringDots(x, y, rx, ry, n, w, gap) {
  for (let s = 0; s < n; s++) {
    if (gap && s % gap === gap - 1) continue;
    const th = s / n * Math.PI * 2;
    ctx.fillRect(Math.round(x + Math.cos(th) * rx), Math.round(y + Math.sin(th) * ry), w, 1);
  }
}

// ============================================================
// Liquids and floors (L3.lavaAt / L3.waterAt come from level3.js at call time; LV.lava / LV.water otherwise)
// ============================================================
const inList = (list, x) => { if (list) for (const r of list) if (x >= r.x0 && x <= r.x1) return r; return null; };
const lavaAt = x => (L3.lavaAt ? L3.lavaAt(x) : inList(LV && LV.lava, x));
const waterAt = x => (L3.waterAt ? L3.waterAt(x) : inList(LV && LV.water, x));
// the liquid a falling thing meets at x: { y, lava }
function liquidAt(x) {
  const lv = lavaAt(x);
  if (lv) return { y: lv.y, lava: true };
  const w = waterAt(x);
  if (w && groundAt(x) > w.y + 1) return { y: w.y, lava: false };
  return null;
}
// the platform top under a thing falling from py to y at x (one-way), or null
function platHit(x, py, y) {
  for (const pl of LV.plats) if (x >= pl.x && x <= pl.x + pl.w && py <= pl.y + 0.01 && y >= pl.y) return pl;
  return null;
}
// the first surface a bomb meets at x: the highest platform, the liquid, or the ground
function surfaceAt(x) {
  let y = groundAt(x);
  const lv = lavaAt(x); if (lv) y = Math.min(y, lv.y);
  const w = waterAt(x); if (w) y = Math.min(y, w.y);
  for (const pl of LV.plats) if (x >= pl.x && x <= pl.x + pl.w && pl.y < y && pl.y > 60) y = pl.y;
  return y;
}
const onScreen = (x, m) => x > G.cam.x + m && x < G.cam.x + W - m;

// ============================================================
// Sounds (Snd.tone / Snd.noise)
// ============================================================
let beepAt = -99, splashAt = -99, sizzleAt = -99;
const SFX = {
  beep() { if (G.t - beepAt < 6) return; beepAt = G.t; Snd.tone('square', 1480, 1480, 0.035, 0.03); },
  splash(big) { if (G.t - splashAt < 4) return; splashAt = G.t; Snd.noise(big ? 0.4 : 0.25, big ? 0.14 : 0.08, 2600); Snd.tone('sine', 420, 140, 0.18, 0.06); },
  leap() { Snd.noise(0.25, 0.1, 5200); Snd.tone('sawtooth', 220, 520, 0.22, 0.04); },
  chomp() { Snd.tone('square', 260, 90, 0.09, 0.09); Snd.tone('square', 240, 80, 0.09, 0.08, 0.1); },
  sizzle() { if (G.t - sizzleAt < 6) return; sizzleAt = G.t; Snd.noise(0.4, 0.07, 7000); },
  bloop() { Snd.tone('sine', 260, 720, 0.07, 0.04); },
  croak() { Snd.tone('sawtooth', 170, 120, 0.11, 0.08); Snd.tone('square', 85, 70, 0.11, 0.05); Snd.tone('sawtooth', 190, 110, 0.14, 0.08, 0.16); Snd.tone('square', 95, 60, 0.14, 0.05, 0.16); },
  lash() { Snd.tone('triangle', 380, 1300, 0.09, 0.07); Snd.noise(0.08, 0.05, 6000); },
  stick() { Snd.tone('square', 520, 160, 0.1, 0.07); Snd.noise(0.06, 0.06, 1500); },
  snap() { Snd.tone('triangle', 1400, 260, 0.12, 0.07); },
  hop() { Snd.tone('square', 220, 560, 0.08, 0.04); },
  plop() { Snd.tone('sine', 320, 120, 0.08, 0.06); },
  pop() { Snd.tone('square', 760, 180, 0.14, 0.09); Snd.noise(0.18, 0.14, 3000); },
  rumble() { Snd.noise(0.7, 0.13, 260); Snd.tone('sine', 70, 38, 0.6, 0.12); Snd.tone('sine', 1500, 520, 1.3, 0.018, 0.2); },
  thud() { Snd.noise(0.3, 0.16, 1100); Snd.tone('sine', 140, 45, 0.25, 0.14); }
};

// ============================================================
// Break-apart: robots burst into bolts and plates. The pieces tumble, bounce on floors and platforms, sink slowly
// in water (bubbles) and lava (a hiss, they glow and melt away), then blink out. The enemy stays 'dying' meanwhile.
// ============================================================
const PPAL = {
  k: OUT, a: '#eef3f7', b: '#a8b4c3', c: '#76828f', d: '#535d6b', e: '#363d48',
  r: '#ff3b30', R: '#ffb0a8', y: '#ffe066', Y: '#fff6c4', o: '#ff8a1a', h: '#fff1a0', i: '#ffc23a', l: '#e0501a', m: '#9a2c14',
  g: '#c4f08a', G: '#5ccf52', D: '#2f9a44', E: '#1a6232', s: '#a9b5c2', S: '#6f7b8b'
};
const ps = (rows) => { const s = makeSprite(rows, PPAL); s.ox = s.w >> 1; s.oy = s.h >> 1; return s; };
const P_NUT = ps(['.kkk.', 'kbabk', 'kaekk', 'kcdck', '.kkk.']);
const P_BOLT = ps(['kkkk', 'kabk', 'kcdk', '.kk.', '.kbk', '.kck', '.kbk', '.kk.']);
const P_GEAR = ps(['..kkk..', '.kkakk.', 'kkbacdk', 'kabeadk', 'kcbcddk', '.kkdkk.', '..kkk..']);
const P_SPRING = ps(['kkkk.', 'kbbbk', '.kkbk', 'kbbkk', 'kbkk.', 'kkbbk', '.kkbk', 'kbbbk', 'kkkk.']);
const P_SPLATE = ps(['kkkkkkkkk', 'kaaabaaak', 'kbbabbbbk', 'kccccccck', 'kkkkkkkkk']);
const P_SPLATE2 = ps(['.kkkkkkk.', 'kbabbbabk', 'kccccccck', 'kdddddddk', '.kkkkkkk.']);
const P_SFIN = ps(['....kk', '...kak', '..kabk', '.kabck', 'kabbck', 'kbccdk', 'kkkkkk']);
const P_LAMP = ps(['.kkk.', 'kRrrk', 'krrmk', 'krmmk', '.kkk.']);
const P_HPLATE = ps(['kkkkkkkk', 'khhiiiik', 'kiooooik', 'kllllllk', 'kkkkkkkk']);
const P_HPLATE2 = ps(['.kkkkkk.', 'khiiiihk', 'koooolok', '.kkkkkk.']);
const P_LFIN = ps(['....kk', '...khk', '..khck', '.kicck', 'kiccdk', 'kccddk', 'kkkkkk']);
const P_FPLATE = ps(['.kkkkkkk.', 'kgggGgggk', 'kGGGGGGGk', 'kDDDDDDDk', '.kkkkkkk.']);
const P_FPLATE2 = ps(['kkkkkk', 'kgGGgk', 'kGGDGk', 'kDDDDk', 'kkkkkk']);
const P_FLAMP = ps(['.kkkk.', 'kyYYyk', 'kYyyik', 'kyiiok', 'kioook', '.kkkk.']);
const P_FLEG = ps(['.kkkkkkkk.', 'kgGGGGGGGk', 'kDDsSDDDDk', '.kkkkkkkk.']);
// the big pieces: a hull plate, the tail fin, the jaw with its teeth, a red-hot back plate, the frog's helmet
const P_SHULL = ps(['.kkkkkkkkkkk.', 'kaaaaabaaaaak', 'kbbbbbabbbbbk', 'kbbabbbbbabbk', 'kccccccccccck', '.kkkkkkkkkkk.']);
const P_STAIL = ps(['......kk.', '.....kbk.', '....kbck.', 'kk.kbcck.', 'kbkbccdk.', 'kbbbcdk..', 'kbbcdk...', 'kbccdkk..', 'kkkbcdk..', '...kbcdk.', '....kkkk.']);
const P_SJAW = ps(['kkkkkkkkkkkk', 'kmmmlmmmmmmk', 'kakakakakakk', 'kbbbbbbbbbk.', '.kkkkkkkkk..']);
const P_HHULL = ps(['.kkkkkkkkkkk.', 'khhhiiiihhhik', 'kiiooooooooik', 'koolllloollok', 'kmmmmmmmmmmmk', '.kkkkkkkkkkk.']);
const P_FHELM = ps(['..kkkkkkk..', '.kgggggggk.', 'kgGGGGGGGgk', 'kGGGsGGGsGk', 'kDDDDDDDDDk', '.kkkkkkkkk.']);

function bit(e, s, lx, ly, vx, vy, vr, o) {
  const f = e.facing || 1;
  return Object.assign({ s, x: e.x + lx * f, y: e.y + ly, vx: vx * f, vy, rot: 0, vr: vr * f, f, rest: false, b: 0, wet: null, sink: 0, smoke: false }, o);
}
const nuts = (e, n, lx, ly) => { const a = []; for (let i = 0; i < n; i++) a.push(bit(e, i % 3 === 2 ? P_GEAR : i % 2 ? P_BOLT : P_NUT, lx, ly, rand(-2.2, 2.2), rand(-4.4, -2), rand(-0.45, 0.45))); return a; };
function shatter(e, list, len) { e.pieces = list; e.dt = 0; e.dieLen = len; e.state = 'dead'; }
function updPieces(e) {
  e.dt++;
  for (const q of e.pieces) {
    if (q.smoke && e.dt % 7 === 0 && e.dt < e.dieLen - 20 && !q.wet) G.parts.push({ type: 'smoke', x: q.x, y: q.y - 2, vx: rand(-0.2, 0.2), vy: -0.6, life: 30, max: 30, size: 2.5 });
    if (q.rest) continue;
    const py = q.y, lq = liquidAt(q.x);
    if (lq && q.y > lq.y) {
      if (!q.wet) {
        q.wet = lq;
        if (lq.lava) { for (let i = 0; i < 3; i++) G.parts.push({ type: 'spark', x: q.x, y: lq.y - 1, vx: rand(-1, 1), vy: rand(-2.4, -0.8), g: 0.16, life: 16, max: 16, size: 1, c: i % 2 ? '#ffd23f' : '#ff8a1a' }); SFX.sizzle(); }
        else { for (let i = 0; i < 3; i++) G.parts.push({ type: 'spark', x: q.x, y: lq.y - 1, vx: rand(-1, 1), vy: rand(-2, -0.6), g: 0.16, life: 14, max: 14, size: 1, c: i % 2 ? '#ffffff' : '#bdf0f4' }); }
      }
      q.vx *= 0.86; q.vy = Math.min(q.vy * 0.82 + 0.05, lq.lava ? 0.32 : 0.55); q.rot += q.vr * 0.25;
      q.sink = q.y - lq.y;
      if (!lq.lava && e.dt % 9 === 0 && hsh(q.x + e.dt) > 0.5) G.parts.push({ type: 'spark', x: q.x, y: lq.y - 1, vx: 0, vy: -0.3, life: 8, max: 8, size: 1, c: '#e8fdff' });
    } else { q.vy = Math.min(q.vy + 0.22, 6); q.rot += q.vr; }
    q.x += q.vx; q.y += q.vy;
    const pl = q.vy > 0 ? platHit(q.x, py, q.y) : null, gy = pl ? pl.y : groundAt(q.x);
    const side = Math.abs(Math.sin(q.rot)) > 0.7, hh = (side ? q.s.w : q.s.h) / 2;
    if (q.y + hh >= gy && q.vy > 0) {
      q.b++;
      if (q.b === 1 && !q.wet) { sparks(q.x, gy - 1, 2); if (q.s.w > 8) dust(q.x, gy, 2); }
      if (q.wet || q.vy < 1.3 || q.b > 2) {
        q.rest = true; q.vx = 0;
        q.rot = Math.round(q.rot / (Math.PI / 2)) * (Math.PI / 2);
        q.y = gy - (Math.abs(Math.sin(q.rot)) > 0.5 ? q.s.w : q.s.h) / 2 + 1;
      } else { q.y = gy - hh; q.vy *= -0.42; q.vx *= 0.6; q.vr *= -0.6; }
    }
  }
  if (e.dt >= e.dieLen) e.dead = true;
}
function drawPieces(e) {
  if (e.dt > e.dieLen - 24 && Math.floor(e.dt / 3) % 2) return;
  for (const q of e.pieces) {
    let a = 1;
    if (q.wet) a = q.wet.lava ? clamp(1 - q.sink / 7, 0, 1) : clamp(1 - q.sink / 30, 0.45, 1);
    if (a <= 0.02) continue;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.rotate(q.rot); ctx.scale(q.f, 1);
    ctx.drawImage(q.s.img, -Math.floor(q.s.w / 2), -Math.floor(q.s.h / 2));
    if (q.wet && q.wet.lava) { ctx.globalAlpha = a * 0.6; ctx.drawImage(q.s.white, -Math.floor(q.s.w / 2), -Math.floor(q.s.h / 2)); }
    ctx.restore();
    if (q.wet && q.wet.lava && a > 0.1) { ctx.fillStyle = rgba('#ff8a1a', a * 0.7); ctx.fillRect(Math.round(q.x) - 2, Math.round(q.wet.y) - 1, 5, 1); }
  }
}

// a crown splash where something bursts out of (or crashes into) a liquid: a foam ring spreading, a crown of spikes
// leaning outward that rises and falls, drops flying out in arcs. a = age in frames (0..26)
const WATER_C = ['#ffffff', '#bdeff2', '#e8fdff'], LAVA_C = ['#fff1a0', '#ffc23a', '#ff8a1a'];
function splashFx(x, y, a, lava, big) {
  const k = a / 26, rise = a < 6 ? (a + 1) / 7 : Math.max(0, 1 - (a - 6) / 15), C = lava ? LAVA_C : WATER_C, s = big ? 1.25 : 1;
  ctx.fillStyle = lava ? rgba('#ffd23f', 0.85 * (1 - k)) : rgba('#ffffff', 0.85 * (1 - k));
  ringDots(x, y + 1, (9 + k * 15) * s, (9 + k * 15) * s * 0.24, 56, 2, 0);
  ctx.fillStyle = lava ? rgba('#ff8a1a', 0.6 * (1 - k)) : rgba('#bdeff2', 0.6 * (1 - k));
  ringDots(x, y + 1, (5 + k * 9) * s, (5 + k * 9) * s * 0.22, 36, 2, 0);
  if (rise > 0) {
    for (let j = -5; j <= 5; j++) {
      const hgt = (5 + (5 - Math.abs(j)) * 2.3) * (0.75 + hsh(j * 3.7 + x * 0.13) * 0.5) * rise * s, lean = j * (0.1 + k * 0.25);
      for (let i = 0; i < hgt; i++) {
        ctx.fillStyle = i > hgt - 2 ? C[0] : (i + j) % 3 ? C[0] : C[1];
        ctx.fillRect(Math.round(x + j * 2.3 * s + lean * i), Math.round(y - 1 - i), i < hgt * 0.4 ? 2 : 1, 1);
      }
      ctx.fillStyle = C[0];
      ctx.fillRect(Math.round(x + j * 2.3 * s + lean * hgt + j * 0.3), Math.round(y - 3 - hgt), 1, 2);
    }
  }
  for (let i = 0; i < 16; i++) {
    const vx = (hsh(i * 3.1 + x * 0.7) - 0.5) * 3.2 * s, vy = -1.8 - hsh(i * 5.3 + x * 0.3) * 2.6 * s, px = x + vx * a, py = y - 3 + vy * a + 0.17 * a * a;
    if (py > y) continue;
    ctx.fillStyle = C[i % 3];
    ctx.fillRect(Math.round(px), Math.round(py), 1, 2);
  }
  if (a < 12) { ctx.fillStyle = C[1]; for (let i = 0; i < 12; i++) ctx.fillRect(Math.round(x - 12 * s + i * 2 * s), Math.round(y - Math.sin(i / 11 * Math.PI) * 4 * rise), 3, 2); }
}
// bubbles popping and a widening ring where a shark went under
function bubbleFx(x, y, a, lava) {
  const k = a / 30;
  ctx.fillStyle = lava ? rgba('#ffd23f', 0.7 * (1 - k)) : rgba('#ffffff', 0.7 * (1 - k));
  ringDots(x, y + 1, 6 + k * 18, (6 + k * 18) * 0.24, 40, 1, 4);
  for (let i = 0; i < 6; i++) {
    const ph = (a + i * 5) % 12, bx = Math.round(x + (hsh(i * 7.1 + x) - 0.5) * 22);
    if (ph < 8) { ctx.fillStyle = lava ? (ph < 4 ? '#ffd23f' : '#ff8a1a') : (ph < 4 ? '#ffffff' : '#bdeff2'); const r = ph < 4 ? 1 : 2; ctx.fillRect(bx - r + 1, y - r, r * 2 - 1, r); }
    else if (ph < 10) { ctx.fillStyle = lava ? '#fff1a0' : '#ffffff'; ctx.fillRect(bx - 2, y - 2, 1, 1); ctx.fillRect(bx + 2, y - 2, 1, 1); ctx.fillRect(bx, y - 3, 1, 1); }
  }
}
// the effects an enemy leaves on the surface: { k: 'splash' | 'bubbles', x, y, a, lava, big }
function fxTick(e) { for (const f of e.fx) f.a++; e.fx = e.fx.filter(f => f.a < (f.k === 'splash' ? 26 : 32)); }
function fxDraw(e) { for (const f of e.fx) if (f.k === 'splash') splashFx(Math.round(f.x), f.y, f.a, f.lava, f.big); else bubbleFx(Math.round(f.x), f.y, f.a, f.lava); }
// droplets thrown up (engine sparks, capped)
function drops(x, y, n, lava) {
  if (G.parts.length > 560) return;
  for (let i = 0; i < n; i++) G.parts.push({ type: 'spark', x: x + rand(-8, 8), y: y - 1, vx: rand(-1.8, 1.8), vy: rand(-3.6, -1.2), g: 0.18, life: rand(14, 26), max: 26, size: i % 3 ? 1 : 2, c: lava ? (i % 2 ? '#ffd23f' : '#ff8a1a') : (i % 2 ? '#ffffff' : '#9ae6f0') });
}

// sharks share an attack slot: one warning or leaping shark at a time, and a short breather between attacks
let lastAtk = -999;
function attackFree() {
  if (G.t - lastAtk < 40) return false;
  for (const o of G.enemies) if ((o.type === 'shark' || o.type === 'lavashark') && !o.dead && !o.pieces && (o.state === 'warn' || o.state === 'leap')) return false;
  return true;
}
const go = (e, s) => { e.state = s; e.st = 0; };
function hitNow(e) { const h = e.hp < e.lastHp; e.lastHp = e.hp; return h; }
const NOBOX = e => ({ x: e.x, y: -400, w: 0, h: 0 });
// the box of a body of length L and height H centred on (x, y), turned by ang
function turnedBox(x, y, L, Hh, ang) {
  const c = Math.abs(Math.cos(ang)), s = Math.abs(Math.sin(ang)), w = L * c + Hh * s, h = L * s + Hh * c;
  return { x: x - w / 2, y: y - h / 2, w, h };
}
const angIdx = (a, list) => { let bi = 0; for (let i = 1; i < list.length; i++) if (Math.abs(list[i] - a) < Math.abs(list[bi] - a)) bi = i; return bi; };

// ============================================================
// ROBOT SHARK sprites (from the bay proposal). Shapes in local units, facing right, nose at +u, v down; each pose is
// rasterized per pixel at its angle so the outline and the shading stay crisp at any tilt. Scale SSC.
// ============================================================
const SSC = 0.8, FSC = 0.95;   // leaping shark scale, cruising fin scale (a bigger fin reads better at 1x)
const SHK = {
  body: [[38, 0], [36, -4], [31, -8.5], [24, -11.5], [15, -13.5], [5, -14], [-5, -13], [-15, -10.2], [-24, -6.8], [-31, -4], [-35, -3], [-35, 2.4], [-29, 4], [-20, 7], [-10, 9.6], [0, 11], [9, 10.8], [16, 9.4], [22, 7.5], [28, 5.6], [33, 3.8], [37, 2]],
  dorsal: [[9, -13.8], [3, -20], [-2, -26], [-6, -29.5], [-9.5, -28.5], [-9, -21], [-12, -11.5]],
  dors2: [[-22, -7.5], [-25.5, -12], [-28, -12], [-28, -6]],
  anal: [[-19, 7.6], [-23, 12.5], [-26, 12], [-25, 6]],
  pelv: [[-8, 9.5], [-11, 14], [-14, 13.5], [-13, 9]],
  tailU: [[-32, -3.8], [-37, -10], [-42, -17], [-47, -22], [-50, -21.5], [-47.5, -14], [-43, -5], [-40, 0.5]],
  tailL: [[-35, 0.5], [-40, 5], [-45, 10.5], [-43, 12], [-37, 7.5], [-33, 2.4]],
  pect: [[15, 8.5], [10, 14], [4, 20.5], [0, 22.5], [-0.5, 19], [2, 13], [7, 8.8]],
  brow: [[15.5, -9.4], [28, -10.4], [28.5, -8], [16.5, -6.7]],
  eye: [22, -4.6], hinge: [12, 6.5], snout: [36.5, 2.6], beacon: [-7, -29]
};
const SPAL = {
  1: PI4('#a8b4c3', '#76828f', '#535d6b', '#8e9aaa', '#626d7c'), 2: PI4('#ffffff', '#e4eaf0', '#b0bbc7'), 3: PI4('#8995a4', '#5f6a77', '#424b56'),
  4: PI4('#dde5ee', '#afbac7', '#7b8794'), 6: PI4('#a2aebd', '#6e7a88', '#4c5664'), 7: PI4('#ffffff', '#e8eef3', '#a8b4c1'),
  8: PI4('#5c6674', '#404853', '#2c3139'), 10: PI4('#8f9bab', '#64707d', '#454e59'), 11: PI4('#8995a4', '#5f6a77', '#424b56')
};
const rotPts = (P, cx, cy, a) => P.map(([x, y]) => { const dx = x - cx, dy = y - cy; return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]; });
const SUNRIM = I('#ffd8b0');
// ang: nose down (rad); jaw: opening (rad); cut: local v of the water line (a cruising fin: only the dorsal fin stays
// above it, everything below becomes a flat dark shape seen through the water)
function sharkSprite(ang, jaw, cut, sc = SSC) {
  const S = Math.ceil(140 * sc / 2) * 2, C = S / 2, ca = Math.cos(ang), sa = Math.sin(ang), open = jaw > 0.05;
  const bend = u => u < -6 ? -0.0034 * (u + 6) * (u + 6) : 0;
  const H0 = SHK.hinge, T0 = SHK.snout;
  const JAW = rotPts([[12, 6.5], [35.5, 3.2], [35, 5.6], [30, 8.4], [22, 10.4], [13, 11.2]], H0[0], H0[1], jaw), J1 = JAW[1];
  const MOUTH = [H0, T0, J1];
  const teeth = [];
  const row = (A, B, s0, ds, hw, ht, up) => {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), d = [dx / L, dy / L], n = up ? [d[1], -d[0]] : [-d[1], d[0]];
    for (let s = s0; s < 0.97; s += ds) { const c = [A[0] + dx * s, A[1] + dy * s]; teeth.push([[c[0] - d[0] * hw, c[1] - d[1] * hw], [c[0] + d[0] * hw, c[1] + d[1] * hw], [c[0] + n[0] * ht, c[1] + n[1] * ht]]); }
  };
  if (open) { row(H0, T0, 0.27, 0.19, 1.6, 5.2, false); row(H0, J1, 0.34, 0.22, 1.6, 4.6, true); }
  const vUJ = u => lerp(H0[1], T0[1], (u - H0[0]) / (T0[0] - H0[0]));
  const vB = u => 3 - 0.0026 * (u - 4) * (u - 4);
  const bb = P => { let a = 1e9, b2 = 1e9, c = -1e9, d = -1e9; for (const [x, y] of P) { a = Math.min(a, x); b2 = Math.min(b2, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b2, c, d]; };
  const BB = {}; for (const k of ['body', 'dorsal', 'dors2', 'anal', 'pelv', 'tailU', 'tailL', 'pect', 'brow']) BB[k] = bb(SHK[k]);
  const JB = bb(JAW), MB = bb(MOUTH);
  const inB = (B, u, v) => u >= B[0] && u <= B[2] && v >= B[1] && v <= B[3];
  const inP = (k, u, v) => inB(BB[k], u, v) && inPoly(SHK[k], u, v);
  const mat = new Uint8Array(S * S), LU = new Float32Array(S * S), LV2 = new Float32Array(S * S);
  const M = (X, Y) => X < 0 || Y < 0 || X >= S || Y >= S ? 0 : mat[Y * S + X];
  for (let Y = 0; Y < S; Y++) for (let X = 0; X < S; X++) {
    const x0 = (X + 0.5 - C) / sc, y0 = (Y + 0.5 - C) / sc;
    if (x0 * x0 + y0 * y0 > 3000) continue;
    const u = x0 * ca + y0 * sa, v = -x0 * sa + y0 * ca - bend(u);
    let m = 0;
    if (u < -52 || u > 40 || v < -31 || v > 24) continue;
    if (open && u > 9 && u < 40 && v > -2 && v < 22 && teeth.some(t => inPoly(t, u, v))) m = 7;
    else if (open && inB(MB, u, v) && inPoly(MOUTH, u, v)) m = 5;
    else if (inB(JB, u, v) && inPoly(JAW, u, v)) m = open ? 6 : 2;
    else if (inP('pect', u, v)) m = 10;
    else if (inP('brow', u, v)) m = 8;
    else if (inP('body', u, v) && !(open && u > H0[0] && v > vUJ(u))) m = u > 30 && v < vUJ(Math.min(u, 36)) + 0.5 ? 4 : v > vB(u) ? 2 : 1;
    else if (inP('dorsal', u, v) || inP('dors2', u, v) || inP('anal', u, v) || inP('pelv', u, v)) m = 3;
    else if (inP('tailU', u, v) || inP('tailL', u, v)) m = 11;
    mat[Y * S + X] = m; LU[Y * S + X] = u; LV2[Y * S + X] = v;
  }
  const toPix = (u, v) => { const vv = v + bend(u); return [Math.floor(C + sc * (u * ca - vv * sa)), Math.floor(C + sc * (u * sa + vv * ca))]; };
  const b = buf(S, S, 0, 0);
  for (let Y = 0; Y < S; Y++) for (let X = 0; X < S; X++) {
    const m = M(X, Y);
    if (!m) continue;
    if (m === 5) {
      const u = LU[Y * S + X], v = LV2[Y * S + X], d = Math.hypot(u - H0[0], v - H0[1]) / Math.hypot(T0[0] - H0[0], T0[1] - H0[1]);
      put(b, X, Y, d < 0.22 ? I('#fff6c4') : d < 0.36 ? I('#ffc040') : d < 0.5 ? I('#f06a20') : d < 0.66 ? I('#a82418') : I('#5a1012'));
      continue;
    }
    const P = SPAL[m];
    let tone = 1;
    if (M(X, Y - 1) !== m || M(X - 1, Y) !== m) tone = 0;
    else if (M(X, Y + 1) !== m || M(X + 1, Y) !== m) tone = 2;
    if (m === 1 && tone === 1) {
      let k = 0, j = 0;
      while (k < 4 && M(X, Y - k - 1) === 1) k++;
      while (j < 4 && M(X, Y + j + 1) === 1) j++;
      tone = j <= 1 ? 2 : j === 2 ? 4 : k <= 2 ? 3 : 1;
    }
    put(b, X, Y, tone === 0 && (m === 1 || m === 3 || m === 11) && cut == null ? mixI(P[0], SUNRIM, 0.3) : P[tone]);
  }
  // wet-metal shine along the back
  for (let X = 0; X < S; X++) {
    let Y0 = -1;
    for (let Y = 0; Y < S; Y++) if (M(X, Y) === 1) { Y0 = Y; break; }
    if (Y0 < 0) continue;
    const u = LU[Y0 * S + X];
    if (u > -20 && u < 26 && M(X, Y0 + 2) === 1) put(b, X, Y0 + 2, (X & 1) || u > 18 ? I('#c6d0db') : I('#a9b5c3'));
  }
  // panel seams and rivets
  const seam = (u0, v0, u1, v1) => {
    const n = Math.ceil(Math.hypot(u1 - u0, v1 - v0) * 2.5);
    for (let i = 0; i <= n; i++) {
      const [X, Y] = toPix(lerp(u0, u1, i / n), lerp(v0, v1, i / n)), m = M(X, Y);
      if (m === 1) put(b, X, Y, I('#363d48')); else if (m === 2) put(b, X, Y, I('#9aa6b3')); else if (m === 4) put(b, X, Y, I('#6c7886'));
    }
  };
  const rivet = (u, v) => { const [X, Y] = toPix(u, v), m = M(X, Y); if (m === 1 || m === 2 || m === 4 || m === 6) put(b, X, Y, I('#eef3f7')); };
  seam(11, -13.6, 11.6, 6.4); seam(-14, -10.6, -12.5, 9.2); seam(30.5, -8, 30.8, vUJ(30.6));
  for (let u = -30; u <= 11; u += 0.5) { const [X, Y] = toPix(u, vB(u) - 0.6); if (M(X, Y) === 1) put(b, X, Y, I('#363d48')); }
  for (const v of [-10, -5, 0, 5]) rivet(9.6, v);
  for (const v of [-7, -2, 3]) rivet(-15.4, v);
  for (let u = -26; u <= 8; u += 8) rivet(u, vB(u) + 1.8);
  // gill vents
  for (const [ua, va, ub, vb] of [[8.2, -4.5, 6.6, 4.6], [4.2, -4.5, 2.6, 5], [0.2, -4.2, -1.4, 5.2]]) {
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const [X, Y] = toPix(lerp(ua, ub, i / n), lerp(va, vb, i / n)), m = M(X, Y);
      if (m !== 1 && m !== 2) continue;
      put(b, X, Y, I('#1f232a'));
    }
  }
  // the eye: a round red lens in a dark socket, a glint
  const [ex, ey] = toPix(SHK.eye[0], SHK.eye[1]);
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
    const d2 = i * i + j * j;
    if (d2 <= 8.5 && M(ex + i, ey + j)) put(b, ex + i, ey + j, d2 <= 3.5 ? (d2 <= 1 ? I('#ff9a8a') : I('#ff3b30')) : I('#1f232a'));
  }
  put(b, ex - 1, ey - 1, I('#ffffff'));
  // internal outlines round the pectoral fin, the lower jaw and the mouth
  const add = [];
  for (let Y = 0; Y < S; Y++) for (let X = 0; X < S; X++) {
    const m = M(X, Y);
    if (m !== 1 && m !== 2 && m !== 4) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = M(X + dx, Y + dy); if (n === 10 || n === 6 || n === 5) { add.push([X, Y]); break; } }
  }
  for (const [X, Y] of add) put(b, X, Y, OUTI);
  let shadow = null;
  if (cut != null) {
    const sb = buf(S, S, 0, 0), cy = Math.floor(C + cut * sc);
    for (let Y = 0; Y < S; Y++) for (let X = 0; X < S; X++) {
      if (!M(X, Y)) continue;
      if (Y >= cy) { put(sb, X, Y, I('#0b4a5e')); b.d[Y * S + X] = NONE; }
      else if (M(X, Y) === 11) b.d[Y * S + X] = NONE;
    }
    sb.ox = C; sb.oy = C;
    shadow = mk(sb);
  }
  outline(b);
  b.ox = C; b.oy = C;
  const s = mk(b);
  s.shadow = shadow;
  s.eye = [ex - C, ey - C];
  const [bx, by] = toPix(SHK.beacon[0], SHK.beacon[1]); s.beacon = [bx - C, by - C];
  const [mx, my] = toPix(lerp(H0[0], T0[0], 0.45), (H0[1] + J1[1]) / 2 + 2); s.mouth = [mx - C, my - C];
  const [tx, ty] = toPix(-40, -1); s.tail = [tx - C, ty - C];
  return s;
}
const SANG = [-1.2, -0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9, 1.2];
const SHARK = {
  leap: SANG.map(a => sharkSprite(a, a < -0.45 ? 0.3 : 0.62, null)),
  fin: sharkSprite(0, 0, -12, FSC)
};
const FIN_DY = Math.round(12 * FSC);   // the body's centre sits this far under the surface while cruising

// ============================================================
// LAVA SHARK sprites (from the lava proposal): painted straight on a palette grid (gunmetal, a row of red-hot armour
// plates, a furnace throat), then bent along an arc for each leap angle, then outlined
// ============================================================
class Grid {
  constructor(w, h, x0, y0) { this.w = w; this.h = h; this.x0 = x0; this.y0 = y0; this.g = new Array(w * h).fill('.'); }
  set(x, y, c) { x = Math.round(x) - this.x0; y = Math.round(y) - this.y0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y * this.w + x] = c; }
  get(x, y) { x = Math.round(x) - this.x0; y = Math.round(y) - this.y0; return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.g[y * this.w + x] : '.'; }
  poly(pts, c) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const xs = [];
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const sy = y + 0.5; xs.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const ax = pts[i][0], ay = pts[i][1], bx = pts[j][0], by = pts[j][1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + (sy - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c);
    }
  }
  outline(diag) {
    const add = [];
    const on = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && this.g[y * this.w + x] !== '.' && this.g[y * this.w + x] !== 'k';
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.g[y * this.w + x] !== '.') continue;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || (diag && (on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1)))) add.push(y * this.w + x);
    }
    for (const i of add) this.g[i] = 'k';
  }
  // baked through an ImageData (fast), 'k' (OUT) stays dark in the white copy
  sprite(pal) {
    const b = buf(this.w, this.h, -this.x0, -this.y0), M = {};
    for (const k in pal) M[k] = I(pal[k]);
    for (let i = 0; i < this.g.length; i++) { const c = this.g[i]; if (c !== '.') b.d[i] = c === 'k' ? OUTI : M[c]; }
    return mk(b);
  }
}
const LPAL = {
  k: OUT, a: '#a7b0c4', b: '#757e93', c: '#50576b', d: '#373b4d',
  w: '#fff4e6', x: '#e4ccb8', y: '#b9957f', z: '#ffc48a',
  h: '#fff1a0', i: '#ffc23a', j: '#ff8a1a', l: '#e0501a', m: '#9a2c14', n: '#3a1812',
  e: '#ff3b30', g: '#ffd6c8', v: '#1c1e28', t: '#eef3f7', s: '#9aa6b4', o: '#ffd23f', p: '#ff8a1a', q: '#a3301a', r: '#d8e0ea'
};
const LF = 0.98, SL = 58 * LF;
const LDY = 2;   // a cruising lava shark rides this far down the river's visible surface band (y .. y + 12)
const STOP = [[-1, -2.5], [4, -3], [10, -4.5], [18, -7.5], [26, -9.5], [34, -10.5], [42, -10.5], [48, -9.5], [53, -7.5], [57, -5], [60, -2.5], [61, -1]];
const SBOT = [[-1, 2.5], [4, 3], [10, 4.5], [18, 7], [26, 8.5], [34, 9.5], [40, 9.5], [44, 8.5], [50, 7], [55, 5], [59, 2.5], [61, 0.5]];
const SBEL = [[-1, 0.5], [10, 1.5], [24, 2.5], [36, 3], [43, 3.5]];
function curve(pts, u) {
  if (u <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (u <= pts[i][0]) { const a = pts[i - 1], b = pts[i], k = (u - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], k * k * (3 - 2 * k)); }
  return pts[pts.length - 1][1];
}
const LJAW = 0.46, HINGE = [43, 4.5];
const gum = u => lerp(3.4, 0.6, clamp((u - 43) / 17, 0, 1));
function paintLavaShark() {
  const F = LF, G2 = new Grid(110, 76, -24, -38);
  const set = (u, v, c) => G2.set(u * F, v * F, c);
  const poly = (pts, c) => G2.poly(pts.map(([u, v]) => [u * F, v * F]), c);
  const ln = (u0, v0, u1, v1, c0, c1, n) => { for (let k = 0; k <= n; k++) set(lerp(u0, u1, k / n), lerp(v0, v1, k / n), k > n * 0.6 && c1 ? c1 : c0); };
  for (let px = Math.floor(-1 * F); px <= Math.ceil(61 * F); px++) {
    const u = px / F, t = Math.round(curve(STOP, u) * F), bo = Math.round((u > 43 ? gum(u) : curve(SBOT, u)) * F), be = curve(SBEL, Math.min(u, 43)) * F;
    for (let v = t; v <= bo; v++) {
      let c = 'b';
      if (v === t) c = 'a';
      else if (u <= 43 && v >= be) c = v >= bo ? 'z' : v < be + 1.5 ? 'x' : 'w';
      else if (u <= 43 && v >= be - 1.5) c = 'c';
      if (u > 43 && v >= gum(u) * F - 1.4) c = 'x';
      G2.set(px, v, c);
    }
  }
  poly([[3, -2], [-3, -9], [-9, -17], [-11, -17], [-7, -9], [-3, -1]], 'b');
  poly([[3, 2], [-2, 7], [-8, 12], [-10, 11], [-5, 5], [-3, 1]], 'b');
  ln(-3, -3, -10, -16.5, 'l', 'j', 14); ln(-3, 3, -8.5, 11, 'c', null, 10);
  set(-10.5, -17, 'i'); set(-9.5, 11, 'l');
  poly([[13, -4], [9, -9], [7, -9], [9, -4]], 'b'); set(8, -9, 'l'); set(9, -8, 'l');
  poly([[13, 4], [9, 8], [7, 8], [9, 3]], 'c');
  poly([[39, -10], [34, -15], [30, -20], [27, -23], [25, -23], [26, -19], [27, -15], [26, -10]], 'b');
  for (let k = 0; k <= 16; k++) { const u = lerp(39, 26, k / 16), v = lerp(-10, -23, k / 16) + Math.sin(k / 16 * Math.PI) * 0.8; set(u, v, k > 11 ? 'h' : k > 5 ? 'i' : 'j'); set(u - 0.9, v + 0.9, k > 8 ? 'j' : 'l'); }
  for (let k = 0; k <= 12; k++) set(lerp(26, 27, k / 12) + Math.sin(k / 12 * Math.PI) * 1.2, lerp(-22, -11, k / 12), 'c');
  set(31, -13, 'r'); set(29, -16, 'd');
  poly([[46, 5], [41, 6], [34, 12], [29, 17], [27, 17], [30, 12], [35, 6], [38, 3]], 'c');
  ln(45, 5, 29, 16.5, 'b', 'l', 14); set(28, 17, 'j'); set(27, 17, 'l');
  poly([[22, 8], [17, 12], [15, 12], [17, 7]], 'c'); set(15, 12, 'l');
  const PL = [10, 16, 22, 28, 34, 40, 46, 52, 56];
  for (let p = 0; p + 1 < PL.length; p++) {
    for (let px = Math.round(PL[p] * F); px < Math.round(PL[p + 1] * F); px++) {
      const u = px / F, t = Math.round(curve(STOP, u) * F), th = p === PL.length - 2 ? 2 : 3 + (p > 1 && p < 6 ? 1 : 0);
      for (let v = t; v < t + th; v++) {
        let c = v === t ? (px > PL[p + 1] * F - 3 ? 'h' : 'i') : v === t + th - 1 ? 'l' : 'j';
        if (px === Math.round(PL[p] * F)) c = 'n';
        G2.set(px, v, c);
      }
      G2.set(px, t + th, px === Math.round(PL[p] * F) ? 'n' : 'm');
    }
  }
  for (const u of [19, 31]) {
    const px = Math.round(u * F), t = Math.round(curve(STOP, u) * F) + 6, be = Math.round(curve(SBEL, u) * F);
    for (let v = t; v < be - 1; v++) G2.set(px, v, 'c');
    G2.set(px - 1, t, 'a'); G2.set(px + 1, t + 1, 'r'); G2.set(px + 1, be - 3, 'r');
  }
  for (const u of [36.5, 39, 41.5]) for (let k = 0; k < 8; k++) G2.set(Math.round(u * F - k * 0.25), Math.round(-3.5 * F + k), k === 3 || k === 4 ? 'j' : k === 5 ? 'l' : 'd');
  poly([[47, -5.6], [55, -6], [55, -1.9], [47, -1.8]], 'v');
  { const ex = Math.round(51 * F), ey = Math.round(-4.4 * F);
    G2.set(ex, ey, 'g'); G2.set(ex + 1, ey, 'e'); G2.set(ex, ey + 1, 'e'); G2.set(ex + 1, ey + 1, 'e'); G2.set(ex + 2, ey + 1, 'l'); G2.set(ex - 1, ey + 1, 'l');
    G2.set(ex + 3, ey - 1, 'r'); }
  set(59, -2, 'r'); set(60, -1, 'a'); set(58, -3, 'a'); set(57, -4, 'a');
  for (let px = Math.round(43 * F); px <= Math.round(60 * F); px++) for (let v = Math.round(gum(px / F) * F) + 1; v <= 16; v++) G2.set(px, v, 'q');
  const cs = Math.cos(LJAW), sn = Math.sin(LJAW);
  const jaw = (u, v) => [HINGE[0] + (u - HINGE[0]) * cs - (v - HINGE[1]) * sn, HINGE[1] + (u - HINGE[0]) * sn + (v - HINGE[1]) * cs];
  const unjaw = (u, v) => [HINGE[0] + (u - HINGE[0]) * cs + (v - HINGE[1]) * sn, HINGE[1] - (u - HINGE[0]) * sn + (v - HINGE[1]) * cs];
  for (let y = 0; y <= 20; y++) for (let x = Math.round(38 * F); x <= Math.round(62 * F); x++) {
    const [u, v] = unjaw(x / F, y / F), lo = curve(SBOT, u), hi = 3.6;
    const inJaw = u >= 41 && u <= 58.5 && v >= hi && v <= lo;
    if (inJaw) G2.set(x, y, v >= lo - 0.8 ? 'z' : v < hi + 1 ? 'x' : 'w');
    else if (G2.get(x, y) === 'q' && (v > hi || u > 59.5)) G2.set(x, y, '.');
  }
  for (let y = 0; y <= 18; y++) for (let x = Math.round(42 * F); x <= Math.round(62 * F); x++) if (G2.get(x, y) === 'q') {
    const d = Math.hypot(x - 45.5 * F, y - 5.5 * F);
    if (d < 2.2) G2.set(x, y, 'h'); else if (d < 5.5) G2.set(x, y, 'o'); else if (d < 12) G2.set(x, y, 'p');
  }
  for (const u of [45.5, 48.5, 51.5, 54.5, 57.5]) {
    const x = Math.round(u * F), g = Math.round(gum(u) * F) + 1;
    G2.set(x, g, 't'); G2.set(x + 1, g, 's'); G2.set(x, g + 1, 't');
    if (u > 50) G2.set(x, g + 2, 's');
  }
  for (const u of [46, 49, 52, 55]) {
    const [ju, jv] = jaw(u, 3.6), x = Math.round(ju * F), y = Math.round(jv * F);
    G2.set(x, y - 1, 't'); G2.set(x + 1, y - 1, 's'); G2.set(x, y - 2, 't');
  }
  return G2;
}
// bend the straight grid along a circular arc: mid-spine angle ang (negative = nose up), radius Rr (pixels)
function bendGrid(src, ang, Rr) {
  const L2 = SL / 2, Cx = -Rr * Math.sin(ang), Cy = Rr * Math.cos(ang), fm = Math.atan2(-Cy, -Cx);
  const fwd = (u, v) => { const f = fm + (u - L2) / Rr, r = Rr - v; return [Cx + r * Math.cos(f), Cy + r * Math.sin(f)]; };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.g[y * src.w + x] !== '.') {
    const [X, Y] = fwd(x + src.x0, y + src.y0);
    x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
  }
  x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2; x1 = Math.ceil(x1) + 2; y1 = Math.ceil(y1) + 2;
  const out = new Grid(x1 - x0 + 1, y1 - y0 + 1, x0, y0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x - Cx, dy = y - Cy, r = Math.hypot(dx, dy);
    let f = Math.atan2(dy, dx) - fm;
    while (f > Math.PI) f -= Math.PI * 2;
    while (f < -Math.PI) f += Math.PI * 2;
    const c = src.get(f * Rr + L2, Rr - r);
    if (c !== '.') out.set(x, y, c);
  }
  out.fwd = (u, v) => fwd(u * LF, v * LF);
  return out;
}
// a fin cutting the lava: the dorsal fin and the hot plates of the back just breaking the surface
function paintLavaFin() {
  const g = new Grid(48, 36, -23, -31), K = 1.45;
  const set = (u, v, c) => g.set(u * K, v * K, c);
  for (let px = Math.round(-9 * K); px <= Math.round(9 * K); px++) {
    const u = px / K, t = Math.round(-2.6 * K * Math.cos(u / 9 * Math.PI / 2));
    for (let v = t; v <= 0; v++) g.set(px, v, v === t ? (u > 1 ? 'i' : 'j') : v === t + 1 ? 'l' : v === 0 ? 'd' : 'c');
    if (Math.abs(px) % 5 === 2 && t < -1) g.set(px, t, 'n');
  }
  g.poly([[6, -2], [3, -7], [0, -12], [-3, -15], [-5, -15], [-4, -11], [-3, -6], [-4, -2]].map(([u, v]) => [u * K, v * K]), 'b');
  for (let k = 0; k <= 16; k++) { const u = lerp(6, -4, k / 16), v = lerp(-2, -15, k / 16) + Math.sin(k / 16 * Math.PI) * 0.7; set(u, v, k > 11 ? 'h' : k > 5 ? 'i' : 'j'); set(u - 0.8, v + 0.8, k > 8 ? 'j' : 'l'); }
  for (let k = 0; k <= 12; k++) set(lerp(-5, -4, k / 12) + Math.sin(k / 12 * Math.PI) * 1.2, lerp(-14, -3, k / 12), 'c');
  set(0, -6, 'r'); set(-2, -9, 'd'); set(1.5, -4, 'a'); set(-1, -11, 'a');
  g.outline(true);
  for (let x = g.x0; x < g.x0 + g.w; x++) for (let v = 1; v < g.y0 + g.h; v++) g.set(x, v, '.');
  return g;
}
const LANG = [-1.05, -0.7, -0.35, 0, 0.35, 0.7, 1.05];
const LAVA = (() => {
  const src = paintLavaShark();
  const leap = LANG.map(a => { const g = bendGrid(src, a, 96 * LF); g.outline(true); const s = g.sprite(LPAL); s.fwd = g.fwd; return s; });
  return { leap, fin: paintLavaFin().sprite(LPAL) };
})();

// ============================================================
// ROBOT FROG sprites (from the jungle proposal): built from shaded parts (ellipses and capsules, front to back, light
// from above, a deep seam where a nearer part covers a farther one), outlined. Facing right, feet at (0, 0).
// Variants: throat sac size (breathing, the croak), mouth shut/open (the tongue), eyes open/blinking, squashed (about
// to hop, landing) and the leap (rising, falling).
// ============================================================
const FR4 = PI4('#b6f080', '#5ccf52', '#2f9a44', '#1a6232');
const FRB4 = PI4('#f6f8d2', '#dfeaa8', '#bccf80', '#86995a');
const SAC4 = PI4('#fff6e2', '#ffd9bc', '#f5ae94', '#c97c66');
const HL = PI4('#fff8d8', '#ffe066', '#ffb52e', '#e07a14');
const ST4 = PI4('#e2e9ef', '#a9b5c2', '#6f7b8b', '#48505c');
const HD4 = PI4('#9eacbc', '#67727f', '#454d59', '#2c323b');
const MOUTHP = PI4('#a02c56', '#6a1838', '#460c24', '#2e0618');
const FS = 1.08;   // frog scale (the proposal's frog read small next to the hero)
function ell(cx, cy, rx, ry, a = 0) {
  const ca = Math.cos(a), sa = Math.sin(a);
  return (x, y) => { const dx = x - cx, dy = y - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca; return u * u / (rx * rx) + v * v / (ry * ry) <= 1; };
}
function cap(x0, y0, x1, y1, r) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  return (x, y) => { const t = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1), px = x0 + dx * t - x, py = y0 + dy * t - y; return px * px + py * py <= r * r; };
}
const extY = (rx, ry, a) => Math.sqrt((rx * Math.sin(a)) ** 2 + (ry * Math.cos(a)) ** 2);
// parts front to back: { hit(x, y), cx, cy, ext, pal | (x, y) => pal, tilt?, noSeam? } in design units; sampled at
// scale FS (and sy vertically, the squash), anchored at (ax, ay)
function parts(w, h, ax, ay, list, sy = 1) {
  const b = buf(w, h, ax, ay), id = new Int16Array(w * h).fill(-1), S = FS;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const lx = (x - ax + 0.5) / S, ly = (y - ay + 0.5) / (S * sy);
    for (let k = 0; k < list.length; k++) if (list[k].hit(lx, ly)) { id[y * w + x] = k; break; }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, k = id[i];
    if (k < 0) continue;
    const q = list[k], lx = (x - ax + 0.5) / S, ly = (y - ay + 0.5) / (S * sy), pal = typeof q.pal === 'function' ? q.pal(lx, ly) : q.pal;
    const t = (ly - q.cy) / q.ext + (q.tilt || 0) * (lx - q.cx) / q.ext;
    let c = t < -0.45 ? pal[0] : t > 0.7 ? pal[3] : t > 0.3 ? pal[2] : pal[1];
    const near = j => j >= 0 && j < k;
    if (!q.noSeam && (near(y > 0 ? id[i - w] : -1) || near(x > 0 ? id[i - 1] : -1) || near(x < w - 1 ? id[i + 1] : -1))) c = pal[3];
    b.d[i] = c;
  }
  return b;
}
// design-unit painters for the details (scaled like the parts)
function dput(b, x, y, c, sy = 1) { put(b, x * FS, y * FS * sy, c); }
function dline(b, x0, y0, x1, y1, c, t, sy = 1) { line(b, x0 * FS, y0 * FS * sy, x1 * FS, y1 * FS * sy, c, t); }
function lamp(b, x, y, r, dim) {
  const P = dim ? HD4 : HL;
  oval(b, x, y, r, r * 0.95, P[3]); oval(b, x + 0.3, y - 0.2, r - 0.8, r * 0.95 - 0.8, P[2]);
  oval(b, x + 0.5, y - 0.4, Math.max(0.5, r - 1.6), Math.max(0.5, r - 1.7), P[1]); put(b, x + 0.6, y - 0.5, P[0]);
  if (!dim) put(b, x - r * 0.45, y - r * 0.5, I('#ffffff'));
}
// the eye shut: a steel lid with a dark lash line
function lid(b, x, y, r) { oval(b, x, y, r, r * 0.95, HD4[2]); oval(b, x, y - 0.6, r - 0.6, r * 0.6, HD4[1]); line(b, x - r + 1, y + 0.5, x + r - 1, y + 0.5, HD4[3]); }
// sitting, side view: the front raised, a wide wedge of a head, the two headlight eyes on top, the throat sac under the
// jaw, a straight front leg, the hind leg folded in a Z. o = { sac 0..1, open, blink, sy }
function frogSit(o) {
  const sac = o.sac || 0, open = !!o.open, sy = o.sy || 1;
  const L = [
    { hit: ell(8.5, -28, 4.8, 4.5), cx: 8.5, cy: -28, ext: 4.5, pal: ST4 },
    { hit: ell(1.8, -28.8, 4.2, 4), cx: 1.8, cy: -28.8, ext: 4, pal: HD4 },
    { hit: cap(7, -11, 10, -2, 2.5), cx: 8.5, cy: -6.5, ext: 5, pal: FR4, tilt: -0.4 }
  ];
  if (sac > 0.04) {
    const rx = lerp(4.2, 9.4, sac), ry = lerp(2.8, 6.3, sac), cx = lerp(10.6, 15.4, sac), cy = lerp(-11.6, -9.8, sac);
    L.push({ hit: ell(cx, cy, rx, ry), cx, cy, ext: ry, pal: SAC4 });
  }
  if (open) L.push({ hit: ell(10, -13.6, 10.6, 3, 0.16), cx: 10, cy: -13.6, ext: 3.2, pal: FR4 });
  else L.push({ hit: ell(10.4, -15.2, 10.2, 2.8, 0.04), cx: 10.4, cy: -15.2, ext: 2.9, pal: FR4 });
  L.push({ hit: ell(9, -21.6, 12, 5.8, -0.1), cx: 9, cy: -21.6, ext: 5.9, pal: FR4 });
  if (open) L.push({ hit: cap(3, -17.4, 19, -18.6, 3.2), cx: 11, cy: -18, ext: 3, pal: MOUTHP, noSeam: true });
  L.push(
    { hit: ell(-9.5, -8.5, 7.8, 4.9, 0.12), cx: -9.5, cy: -8.5, ext: 5, pal: FR4 },
    { hit: cap(-3.5, -5.5, -15, -2.6, 2.5), cx: -9, cy: -4, ext: 3, pal: FR4 },
    { hit: ell(-3.5, -13.6, 13, 9.8, -0.34), cx: -3.5, cy: -13.6, ext: 10, pal: (x, y) => (x > 0 && y > -11.5 ? FRB4 : FR4) },
    { hit: cap(-16.5, -1.6, 2, -1.2, 1.9), cx: -7, cy: -1.4, ext: 2, pal: FR4 }
  );
  const b = parts(Math.ceil(70 * FS), Math.ceil(50 * FS), Math.ceil(35 * FS), Math.ceil(45 * FS), L, sy);
  const S = FS, Y = y => y * S * sy;
  if (o.blink) { lid(b, 9.6 * S, Y(-28.2), 3.3 * S); lid(b, 2.7 * S, Y(-29), 2.5 * S); }
  else { lamp(b, 9.6 * S, Y(-28.2), 3.3 * S); lamp(b, 2.7 * S, Y(-29), 2.5 * S); }
  if (open) {
    rect(b, Math.round(12 * S), Math.round(Y(-18)), Math.round(8 * S), 1, I('#ff6fa8')); rect(b, Math.round(14 * S), Math.round(Y(-17)), Math.round(6 * S), 1, I('#e04a86'));
    for (let x = 4; x <= 20; x++) { const v = get(b, x * S, Y(-16)); if (v === FR4[1] || v === FR4[0]) put(b, x * S, Y(-16), I('#d8e4ec')); }
  } else {
    // the long smiling mouth line, a steel lip
    dline(b, 3, -17.4, 20, -18.2, FR4[3], 1, sy); dput(b, 2, -18.4, FR4[3], sy); dput(b, 1.4, -19.2, FR4[3], sy);
    for (let x = 5; x <= 18; x += 3) dput(b, x, -16.6, I('#d8e4ec'), sy);
  }
  rect(b, Math.round(-3 * S), Math.round(Y(-20)), 3, 3, ST4[1]); dput(b, -3, -20, ST4[0], sy); dput(b, -1, -18, ST4[3], sy);
  dput(b, 19, -24, I('#123d1e'), sy);
  for (let x = 1; x <= 15; x++) dput(b, x, lerp(-23.5, -23, (x - 1) / 14) - (x > 4 && x < 12 ? 1 : 0), FR4[2], sy);
  for (const [x, y] of [[4, -21], [13, -21], [-7, -20], [-13, -15], [-1, -12]]) dput(b, x, y, I('#e0f8b0'), sy);
  for (const [x, y] of [[-10, -19], [-3, -21], [-15, -12], [-6, -15]]) { dput(b, x, y, I('#2a7a3a'), sy); dput(b, x + 1, y, I('#2a7a3a'), sy); dput(b, x, y + 1, I('#2a7a3a'), sy); }
  if (sac > 0.5) {   // the sac stretched tight: a glossy highlight and stretch lines
    const k = (sac - 0.5) * 2;
    for (const [x, y] of [[13, -13], [14, -13.8], [15, -14], [16, -14], [13, -12.2], [17, -13.6]]) dput(b, x + k * 1.2, y + k * 0.4, I('#ffffff'), sy);
    for (const [x, y] of [[21, -8], [22, -9.5], [16, -5.2], [19, -5.6], [12, -6]]) dput(b, x + k * 1.4, y, SAC4[2], sy);
  }
  dline(b, -15, -11, -5, -9, ST4[2], 2, sy); dline(b, -15, -12, -5, -10, ST4[0], 1, sy);
  oval(b, -3.5 * S, Y(-6), 1.5, 1.5, ST4[2]); dput(b, -4, -7, ST4[0], sy);
  for (const [x, y] of [[9, 0], [11, 0], [13, -1]]) { dput(b, x, y - 0.4, FR4[1], sy); dput(b, x + 1, y - 0.4, FR4[2], sy); }
  outline(b);
  return mk(b);
}
// mid-air: the body stretched along angle a (negative = nose up), legs trailing
function frogLeap(a) {
  const f = [Math.cos(a), Math.sin(a)], n = [Math.sin(a), -Math.cos(a)];
  const at = (u, v) => [f[0] * u + n[0] * v, f[1] * u + n[1] * v];
  const hd = at(11, 2), e1 = at(12, 8.4), e2 = at(6.4, 8.2), ch = at(6, -5), hp = at(-10, -2);
  const b = parts(Math.ceil(88 * FS), Math.ceil(64 * FS), Math.ceil(44 * FS), Math.ceil(32 * FS), [
    { hit: ell(e1[0], e1[1], 4.5, 4.4), cx: e1[0], cy: e1[1], ext: 4.4, pal: ST4 },
    { hit: ell(e2[0], e2[1], 4, 3.9), cx: e2[0], cy: e2[1], ext: 3.9, pal: HD4 },
    { hit: cap(ch[0], ch[1], ch[0] + 9, ch[1] + 8, 2.6), cx: ch[0] + 4, cy: ch[1] + 4, ext: 5, pal: FR4 },
    { hit: ell(hd[0], hd[1], 10.5, 6.8, a), cx: hd[0], cy: hd[1], ext: extY(10.5, 6.8, a), pal: FR4 },
    { hit: ell(0, 0, 14, 9.4, a), cx: 0, cy: 0, ext: extY(14, 9.4, a), pal: (x, y) => ((x - 2) * n[0] + y * n[1] < -3.5 ? FRB4 : FR4) },
    { hit: cap(hp[0], hp[1], hp[0] - 11, hp[1] + 7, 4.2), cx: hp[0] - 5, cy: hp[1] + 3, ext: 5.5, pal: FR4 },
    { hit: cap(hp[0] - 11, hp[1] + 7, hp[0] - 22, hp[1] + 11, 2.5), cx: hp[0] - 16, cy: hp[1] + 9, ext: 3.5, pal: FR4 },
    { hit: cap(hp[0] - 22, hp[1] + 11, hp[0] - 32, hp[1] + 12, 2), cx: hp[0] - 27, cy: hp[1] + 11.5, ext: 2.5, pal: FR4 },
    { hit: cap(ch[0] - 3, ch[1] + 1, ch[0] + 5, ch[1] + 11, 2.2), cx: ch[0] + 1, cy: ch[1] + 6, ext: 5, pal: [FR4[1], FR4[2], FR4[3], FR4[3]] }
  ]);
  const S = FS;
  lamp(b, (e1[0] + 1.2) * S, (e1[1] - 0.3) * S, 3.2 * S);
  lamp(b, (e2[0] + 1) * S, (e2[1] - 0.4) * S, 2.4 * S);
  const m0 = at(20.5, 0), m1 = at(7, -1);
  dline(b, m0[0], m0[1], m1[0], m1[1], I('#1a4a26'), 1);
  for (const [u, v] of [[-4, 6], [-11, 4], [3, 6]]) { const q = at(u, v); dput(b, q[0], q[1], I('#e0f8b0')); }
  for (const [u, v] of [[-6, 3], [-1, 7], [-12, 1]]) { const q = at(u, v); dput(b, q[0], q[1], I('#2a7a3a')); dput(b, q[0] + 1, q[1], I('#2a7a3a')); }
  const k0 = [hp[0] - 2, hp[1] - 2], k1 = [hp[0] - 12, hp[1] + 4];
  dline(b, k0[0], k0[1], k1[0], k1[1], ST4[2], 2); dline(b, k0[0], k0[1] - 1, k1[0], k1[1] - 1, ST4[0], 1);
  const ft = [hp[0] - 32, hp[1] + 12];
  for (const [dx, dy] of [[-2, -3], [-4, 0], [-2, 3]]) dline(b, ft[0], ft[1], ft[0] + dx, ft[1] + dy, FR4[1], 1);
  outline(b);
  return mk(b);
}
const FROG = {
  sit: [frogSit({ sac: 0.22 }), frogSit({ sac: 0.38 })],
  blink: frogSit({ sac: 0.3, blink: true }),
  croak: [frogSit({ sac: 0.7 }), frogSit({ sac: 1 })],
  open: frogSit({ sac: 0.1, open: true }),
  squat: frogSit({ sac: 0.25, sy: 0.84 }),
  up: frogLeap(-0.55), down: frogLeap(0.4)
};
// where the tongue leaves the open mouth (facing right, feet at 0, 0)
const MOUTH_X = Math.round(16 * FS), MOUTH_Y = Math.round(-17.6 * FS);

// ============================================================
// ROBOT SHARK (lagoon): cruises as a fin (its dark shape under the water, a V wake), stops and turns to the hero to warn
// (ripple rings, a flashing red/yellow ring, '!', the beacon blinking fast), then leaps in a high arc to where the hero
// was, jaws open; it splashes down, dives (bubbles) and cruises again. Only the leap hurts. It keeps to its stretch of
// deep water (never on the beach or the sandbar): waves enter along the water.
// ============================================================
// the stretch of swimmable water round x (ground at least 8 px under the surface); a stand-in pool in a level without
// water (the sandbox), so the code still runs
function waterZone(x) {
  const w = waterAt(x);
  if (!w) {
    const L = LV && LV.water;
    let best = null, bd = 1e9;
    if (L) for (const r of L) { const d = x < r.x0 ? r.x0 - x : x - r.x1; if (d < bd) { bd = d; best = r; } }
    if (!best || bd > 300) return { x0: x - 220, x1: x + 220, y: groundAt(x) - 1, virt: true };
    return waterZone(clamp(x, best.x0, best.x1));
  }
  const deep = X => groundAt(X) >= w.y + 8;
  let c = clamp(x, w.x0, w.x1);
  if (!deep(c)) {
    let found = null;
    for (let d = 2; d < 400 && found == null; d += 2) { if (c - d >= w.x0 && deep(c - d)) found = c - d; else if (c + d <= w.x1 && deep(c + d)) found = c + d; }
    if (found == null) return { x0: w.x0, x1: w.x1, y: w.y, virt: true };
    c = found;
  }
  let a = c, b = c;
  while (a - 2 >= w.x0 && deep(a - 2)) a -= 2;
  while (b + 2 <= w.x1 && deep(b + 2)) b += 2;
  return { x0: a, x1: b, y: w.y };
}
// cruise near the hero: aim at a point beside them, inside the zone and on screen; turn with a little splash
function patrol(e, spd) {
  const p = G.p, z = e.z;
  if (--e.patT <= 0) { e.side = rand(0, 1) < 0.5 ? -1 : 1; e.off = rand(46, 96); e.patT = Math.round(rand(80, 150)); }
  let tx = p.x + e.side * e.off;
  tx = clamp(tx, G.cam.x + 30, G.cam.x + W - 30);
  tx = clamp(tx, z.x0 + 12, z.x1 - 12);
  const d = tx - e.x;
  if (Math.abs(d) > 5) {
    const f = Math.sign(d);
    if (f !== e.facing) { e.facing = f; e.turn = 8; }
    e.x += f * spd * (e.turn > 0 ? 0.4 : 1);
  } else if (e.st % 90 === 0) e.side = -e.side;
  if (e.turn > 0) e.turn--;
  e.x = clamp(e.x, z.x0 + 6, z.x1 - 6);
}
// the shark can see the hero over its own water, close enough, and nobody else is attacking
function sharkCanLeap(e) {
  const p = G.p;
  if (e.cd > 0 || p.dead || p.hidden || G.intro || G.winT > 0 || !onScreen(e.x, 24) || !attackFree()) return false;
  const dx = p.x - e.x;
  if (Math.abs(dx) < 18 || Math.abs(dx) > 150 || p.y < 120) return false;
  return p.x >= e.z.x0 - 4 && p.x <= e.z.x1 + 4;
}
function startLeap(e, x1, A, T) {
  e.x0 = e.x; e.x1 = x1; e.A = A; e.T = T; e.ang = -1;
  if (Math.abs(x1 - e.x) > 2) e.facing = Math.sign(x1 - e.x);
  lastAtk = G.t;
  go(e, 'leap');
}
function updShark(e) {
  fxTick(e);
  if (e.pieces) { updPieces(e); return; }
  e.st++;
  const p = G.p, z = e.z, wy = z.y;
  hitNow(e);
  switch (e.state) {
    case 'enter':   // a wave enemy swims in along the water from the screen edge
      e.x += e.facing * 1.3;
      e.x = clamp(e.x, z.x0 + 6, z.x1 - 6);
      if (onScreen(e.x, 40) || e.st > 150) { go(e, 'swim'); e.cd = Math.max(e.cd, 40); }
      break;
    case 'swim':
      if (e.cd > 0) e.cd--;
      patrol(e, 0.85);
      if (sharkCanLeap(e)) { go(e, 'warn'); lastAtk = G.t; }
      break;
    case 'warn': {
      if (!p.dead) { const f = Math.sign(p.x - e.x); if (f && f !== e.facing && e.st < 40) { e.facing = f; e.turn = 6; } }
      if (e.turn > 0) e.turn--;
      if (e.st % 8 === 1) SFX.beep();
      if (e.st >= 50) {
        // the leap: a high arc landing just past where the hero is now, inside the shark's own water
        const hx = p.dead ? e.x + e.facing * 60 : p.x, dir = Math.sign(hx - e.x) || e.facing;
        const x1 = clamp(hx + dir * 10, z.x0 + 10, z.x1 - 10), span = Math.abs(x1 - e.x);
        startLeap(e, x1, clamp(50 + span * 0.14, 52, 74), Math.round(clamp(40 + span * 0.14, 44, 60)));
        e.fx.push({ k: 'splash', x: e.x, y: wy, a: 0, big: true });
        drops(e.x, wy, 8, false);
        SFX.leap(); SFX.splash(true);
      }
      break;
    }
    case 'leap': {
      const u = Math.min(1, e.st / e.T);
      e.x = lerp(e.x0, e.x1, u);
      e.y = wy + 6 - 4 * e.A * u * (1 - u);
      const vx = Math.abs(e.x1 - e.x0) / e.T, vy = -4 * e.A * (1 - 2 * u) / e.T;
      e.ang = Math.atan2(vy, Math.max(0.6, vx));
      if (e.st % 4 === 0 && u < 0.5) drops(e.x - e.facing * 18, e.y + 6, 1, false);
      if (e.st >= e.T) {
        e.y = wy; e.fx.push({ k: 'splash', x: e.x1, y: wy, a: 0, big: true }); e.fx.push({ k: 'bubbles', x: e.x1, y: wy, a: 0 });
        drops(e.x1, wy, 10, false); SFX.splash(true);
        G.shake = Math.max(G.shake, 1.5);
        lastAtk = G.t;
        go(e, 'under');
      }
      break;
    }
    case 'under':   // under the water for a moment (bubbles), then the fin comes up again
      if (e.st >= 30) { go(e, 'swim'); e.cd = Math.round(rand(110, 170)); e.patT = 0; SFX.bloop(); }
      break;
    case 'dead': break;
  }
  if (e.state !== 'leap') e.y = wy;
}
function sharkBox(e) {
  if (e.pieces || e.state === 'under') return NOBOX(e);
  if (e.state === 'leap') return turnedBox(e.x, e.y, 46 * SSC / 0.8, 19 * SSC / 0.8, e.ang);
  return { x: e.x - 8, y: e.z.y - 17, w: 16, h: 18 };
}
// rings spreading over the surface, the outer one flashing red/yellow: the shark leaps from here
function ripples(x, y, t) {
  for (let k = 0; k < 3; k++) {
    const ph = ((t * 0.5 + k * 9) % 27) / 27, rx = 6 + ph * 22;
    ctx.fillStyle = rgba('#ffffff', 1 - ph * 0.85);
    ringDots(x, y, rx, rx * 0.24, 72, 2, 6);
  }
  const on = Math.floor(t / 5) % 2 === 0;
  ctx.fillStyle = on ? '#ff3b30' : '#ffe066';
  ringDots(x, y + 1, 25, 6, 96, 2, 0);
  ctx.fillStyle = on ? '#ffe066' : '#ff3b30';
  ringDots(x, y + 1, 24, 5.4, 96, 1, 3);
}
function beacon(x, y, t, rate) {
  const on = Math.floor(t / rate) % 2 === 0;
  if (on) { ctx.fillStyle = 'rgba(255,90,70,0.45)'; ctx.fillRect(x - 3, y - 2, 7, 3); ctx.fillRect(x - 1, y - 4, 3, 7); }
  RO(x - 1, y - 2, 3, 3, on ? '#ff3b30' : '#8a2420');
  if (on) R(x - 1, y - 2, 1, 1, '#ffe0dc');
}
function foamAt(x, y, w, seed) {
  for (let i = -w; i <= w; i++) {
    const n = h2(i, G.t >> 2, seed);
    if (n < 0.25) continue;
    ctx.fillStyle = n > 0.7 ? '#ffffff' : '#c6f3f1';
    ctx.fillRect(x + i, y - (n > 0.85 ? 1 : 0), 1, 1);
  }
}
function drawShark(e) {
  if (e.x < G.cam.x - 110 || e.x > G.cam.x + W + 110) return;
  const x = Math.round(e.x), wy = e.z.y, t = e.t;
  fxDraw(e);
  if (e.pieces) { drawPieces(e); return; }
  FLASH = e.hitT > 0;
  if (e.state === 'leap') {
    const S = SHARK.leap[angIdx(e.ang, SANG)], y = Math.round(e.y), f = e.facing;
    // its shadow on the water where it is coming down
    const k = clamp(1 - (wy - e.y) / 80, 0.3, 1);
    ctx.fillStyle = rgba('#083c50', 0.22 * k); ctx.fillRect(x - Math.round(20 * k), wy, Math.round(40 * k), 2); ctx.fillRect(x - Math.round(13 * k), wy - 1, Math.round(26 * k), 4);
    // water streaming off its tail on the way up, drops falling off the belly
    const u = e.st / e.T;
    if (u < 0.6 && !FLASH) {
      const tx = x + f * S.tail[0], ty = y + S.tail[1];
      for (let i = 0; i < 40; i++) {
        const q = i / 39, px = lerp(e.x0, tx, q) + Math.sin(q * 3 + e.st * 0.3) * 1.5, py = lerp(wy - 2, ty, q * q);
        if (hsh(i * 7.7 + (G.t >> 2)) < 0.3 + q * 0.3) continue;
        ctx.fillStyle = hsh(i * 2.9) > 0.45 ? '#ffffff' : '#bdf0f4';
        ctx.fillRect(Math.round(px + (hsh(i * 3.3) - 0.5) * 3), Math.round(py), q > 0.6 ? 2 : 1, 1);
      }
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1); blit(S, 0, 0); ctx.restore();
    if (!FLASH) {
      for (let i = 0; i < 8; i++) { const dx = (hsh(i * 4.3) - 0.5) * 36, dy = 5 + hsh(i * 6.1) * 12; ctx.fillStyle = '#d8f8fa'; ctx.fillRect(Math.round(x + dx), Math.round(y + dy + ((t + i * 5) % 9)), 1, 2); }
      const ex = x + f * S.eye[0], ey = y + S.eye[1];
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 6); g.addColorStop(0, 'rgba(255,90,70,0.55)'); g.addColorStop(1, 'rgba(255,90,70,0)');
      ctx.fillStyle = g; ctx.fillRect(ex - 6, ey - 6, 12, 12);
      const mx = x + f * S.mouth[0], my = y + S.mouth[1];
      const m = ctx.createRadialGradient(mx, my, 0, mx, my, 10); m.addColorStop(0, 'rgba(255,190,90,0.45)'); m.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = m; ctx.fillRect(mx - 10, my - 10, 20, 20);
      beacon(x + f * S.beacon[0], y + S.beacon[1], t, 4);
    }
    FLASH = false;
    return;
  }
  if (e.state === 'under') { FLASH = false; return; }
  const S = SHARK.fin, f = e.facing, warn = e.state === 'warn';
  const rise = warn ? Math.min(2, Math.floor(e.st / 12)) : 0, jig = warn && e.st > 30 ? (e.st >> 1) % 2 : 0;
  const cy0 = wy + FIN_DY, cy = cy0 - rise, fx = x + jig * f;
  // the dark body under the surface (it stays down: only the fin rises when it gets ready), then the rings
  ctx.save(); ctx.globalAlpha = warn ? 0.62 : 0.5; ctx.translate(fx, cy0); ctx.scale(f, 1); ctx.drawImage(S.shadow.img, -S.shadow.ox, -S.shadow.oy); ctx.restore();
  if (warn && !FLASH) ripples(x, wy + 1, e.st);
  // the V wake behind a cruising fin
  if (!warn && !FLASH) {
    for (let i = 0; i < 40; i++) {
      const d = i + 7, sx = x - f * d, k = 1 - i / 40;
      if (hsh(i * 3.7 + (G.t >> 2)) < 0.25) continue;
      ctx.fillStyle = rgba(i < 14 ? '#ffffff' : '#bfeff0', 0.35 + 0.6 * k);
      ctx.fillRect(sx, wy - 1 - Math.round(d * 0.04), 1, 1); ctx.fillRect(sx, wy + 1 + Math.round(d * 0.13), i < 12 ? 2 : 1, 1);
      if (i < 16 && hsh(i * 5.1 + (G.t >> 2)) > 0.4) ctx.fillRect(sx, wy + (i & 1), 1, 1);
    }
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + f * (5 + i), wy - 1 - Math.round(Math.sin(i / 5 * Math.PI) * 2), 1, 1); }
  }
  ctx.save(); ctx.translate(fx, cy); ctx.scale(f, 1); blit(S, 0, 0); ctx.restore();
  FLASH = false;
  foamAt(x, wy - 1, 7, e.x0 || 3);
  beacon(fx + f * S.beacon[0], cy + S.beacon[1], t, warn ? 3 : 14);
  if (warn && Math.floor(e.st / 5) % 2 === 0) text('!', x, wy - 44, '#ff3b30', 2, 'center');
}
ENEMY_TYPES.shark = {
  hp: 6, armored: true, activateMargin: 60, edge: 16,
  contact: e => (e.state === 'leap' && !e.pieces ? 'hurt' : 'none'),
  make(e, s) {
    e.z = waterZone(e.x);
    e.x = clamp(e.x, e.z.x0 + 6, e.z.x1 - 6); e.y = e.z.y;
    Object.assign(e, { state: s.side ? 'enter' : 'swim', st: 0, cd: 60 + Math.round(hsh(e.x * 0.37) * 60), patT: 0, side: 1, off: 70, turn: 0, fx: [], lastHp: e.hp, x0: e.x, ang: 0 });
  },
  update: updShark, draw: drawShark, box: sharkBox,
  onKill(e, cx, cy, b) {
    const air = e.state === 'leap', y0 = air ? e.y : e.z.y - 6;
    e.y = y0;
    boom(cx, cy, 0.55); sparks(cx, cy, 8); SFX.pop();
    if (!air) { e.fx.push({ k: 'splash', x: e.x, y: e.z.y, a: 4 }); drops(e.x, e.z.y, 8, false); }
    shatter(e, [
      bit(e, P_SFIN, -2, -10, -0.4, -4.6, 0.3, { smoke: true }), bit(e, P_SJAW, 20, 2, 2.4, -3.4, 0.35),
      bit(e, P_SHULL, -8, -4, -1.6, -4.2, -0.3), bit(e, P_SPLATE2, 8, -6, 1.4, -4.6, 0.3), bit(e, P_SHULL, 6, 2, 1.0, -3.4, 0.25),
      bit(e, P_STAIL, -26, 0, -2.4, -3.2, -0.4), bit(e, P_LAMP, 16, -4, 1.6, -5, 0.5), bit(e, P_SPRING, 0, 0, 0.4, -4.2, 0.5),
      ...nuts(e, 5, 0, -4)
    ], 70);
    addScore(air ? 500 : 200, cx, b.y);
    if (air) G.texts.push({ x: cx, y: b.y - 12, s: 'AIR BONUS!', t: 60, c: '#ffe066' });
    return 'dying';
  }
};

// ============================================================
// LAVA SHARK (lava rivers, the crater lake): the same pattern in red-hot armour. A fin with a glowing wake; warning:
// it locks the column (or bank edge) the hero is on (a ring closes in on it), lines up in the gap beside it, the wake
// turns white-hot, bubbles swell, its eye lamp blinks under the crust, '!'; then it leaps up over that spot (biting
// only on the way up, only a hero still there) and dives back in; then it swims off to its river's far end and dives
// for good. It never leaves its lava range. Its fin's box reaches up to the shots from the columns and the banks.
// ============================================================
function lavaRange(x, s) {
  const L = LV && LV.lava;
  if (!L || !L.length) return { x0: x - 140, x1: x + 140, y: groundAt(x) - 1, virt: true };
  if (s && s.lava != null && L[s.lava]) return L[s.lava];
  const r = lavaAt(x);
  if (r) return r;
  let best = L[0], bd = 1e9;
  for (const q of L) { const d = x < q.x0 ? q.x0 - x : x - q.x1; if (d < bd) { bd = d; best = q; } }
  return best;
}
const LAVA_LEAPS = 1;   // leaps before it swims off (tuning: the never-dodging bot can't shoot it mid-jump)
function lavaCanLeap(e) {
  const p = G.p;
  if (e.cd > 0 || p.dead || p.hidden || G.intro || G.winT > 0 || !onScreen(e.x, 16) || !attackFree()) return false;
  const dx = p.x - e.x;
  if (Math.abs(dx) < 14 || Math.abs(dx) > 140 || p.y < 120) return false;
  return p.x >= e.z.x0 - 40 && p.x <= e.z.x1 + 40;
}
// the basalt columns standing in this lava range
const colsOf = z => (LV && LV.plats ? LV.plats.filter(pl => pl.x + pl.w > z.x0 && pl.x < z.x1) : []);
// The spot a lava shark goes for, LOCKED when its warning starts (it never re-aims): the column the hero stands on
// (or, in the air, the one they are about to land on), else the bank they are on, else (the open crater lake) their
// own spot. x, y: the middle of its top (the target ring); x0..x1: where the hero has to be for the bite to count, so
// hopping to another column (or back off the bank's edge) during the warning is always a clean escape.
function lavaSpot(e) {
  const p = G.p, z = e.z, cols = colsOf(z);
  const px = p.onGround ? p.x : p.x + clamp(p.vx || 0, -1.7, 1.7) * 12;
  let col = p.onGround && p.onPlat && cols.includes(p.onPlat) ? p.onPlat : null;
  if (!col) for (const pl of cols) if (px >= pl.x - 4 && px <= pl.x + pl.w + 4 && pl.y >= p.y - 2 && (!col || pl.y < col.y)) col = pl;
  if (!col && px > z.x0 && px < z.x1) {
    let bd = 30;
    for (const pl of cols) { const d = Math.abs(pl.x + pl.w / 2 - px); if (d < bd) { bd = d; col = pl; } }
  }
  if (col) return { x: col.x + col.w / 2, y: col.y, w: col.w, x0: col.x - 5, x1: col.x + col.w + 5, col };
  if (px <= z.x0 + 2) return { x: z.x0 - 7, y: Math.min(groundAt(z.x0 - 7), z.y), w: 14, x0: z.x0 - 18, x1: z.x0 + 6, bank: -1 };
  if (px >= z.x1 - 2) return { x: z.x1 + 7, y: Math.min(groundAt(z.x1 + 7), z.y), w: 14, x0: z.x1 - 6, x1: z.x1 + 18, bank: 1 };
  return { x: px, y: Math.min(p.y, z.y), w: 20, x0: px - 15, x1: px + 15 };
}
// where it leaps from: the lava gap right beside its target, on its own side (the other side when that gap is a
// sliver), so the leap is short and steep and never sweeps over the columns around
function lavaLaunch(e, T) {
  const z = e.z, lo = z.x0 + 6, hi = z.x1 - 6;
  if (T.bank) return clamp(T.bank < 0 ? z.x0 + 26 : z.x1 - 26, lo, hi);   // its head (19 px ahead) stays over the lava
  const cols = colsOf(z);
  const gap = s => {   // [the target's edge, the next column's edge or the river's end] on side s
    const a = T.x + s * T.w / 2;
    let b = s > 0 ? z.x1 : z.x0;
    for (const pl of cols) {
      if (pl === T.col) continue;
      if (s > 0 && pl.x >= a - 1 && pl.x < b) b = pl.x;
      if (s < 0 && pl.x + pl.w <= a + 1 && pl.x + pl.w > b) b = pl.x + pl.w;
    }
    return [a, b];
  };
  let s = Math.sign(e.x - T.x) || -e.facing || 1, g = gap(s);
  if (Math.abs(g[1] - g[0]) < 12) { const g2 = gap(-s); if (Math.abs(g2[1] - g2[0]) > Math.abs(g[1] - g[0])) { s = -s; g = g2; } }
  return clamp(g[0] + s * Math.min(Math.abs(g[1] - g[0]) / 2, 15), lo, hi);
}
// the leap: up from the gap to an apex over the target (the jaws sweep its top on the way up), then down on the far
// side. u 0..1 along the leap; the x path has a rising half (x0 -> ax) and a falling half (ax -> x1)
function lavaPath(e, u) {
  const r = u <= 0.5, k = r ? u * 2 : u * 2 - 1;
  e.x = r ? lerp(e.x0, e.ax, k) : lerp(e.ax, e.x1, k);
  e.y = e.z.y + LDY + 2 - 4 * e.A * u * (1 - u);
  const vx = (r ? e.ax - e.x0 : e.x1 - e.ax) * 2 / e.T * e.facing, vy = -4 * e.A * (1 - 2 * u) / e.T;
  e.ang = Math.atan2(vy, Math.max(0.6, vx));
}
// the jaws bite only while it is still rising, and only a hero who stayed on the targeted spot
const lavaBites = e => e.state === 'leap' && !e.pieces && e.tgt && e.st <= e.T / 2 && G.p && G.p.x >= e.tgt.x0 && G.p.x <= e.tgt.x1;
// for level3.js (the lava-bomb schedule holds its bombs meanwhile): is any lava shark warning or leaping?
L3.lavaSharkBusy = () => !!(G.enemies && G.enemies.some(o => o.type === 'lavashark' && !o.dead && !o.pieces && (o.state === 'warn' || o.state === 'leap')));
function updLava(e) {
  fxTick(e);
  if (e.pieces) { updPieces(e); return; }
  e.st++;
  const p = G.p, z = e.z, ly = z.y + LDY;
  hitNow(e);
  switch (e.state) {
    case 'rise':   // surfacing: the crust bulges and bubbles, then the fin comes up
      if (e.st === 1) SFX.bloop();
      if (e.st % 10 === 0) drops(e.x, ly, 2, true);
      if (e.st >= 46) { go(e, 'swim'); e.cd = Math.max(e.cd, 50); }
      break;
    case 'swim':
      if (e.cd > 0) e.cd--;
      patrol(e, 0.75);
      if (lavaCanLeap(e)) { go(e, 'warn'); lastAtk = G.t; e.tgt = lavaSpot(e); e.lx = lavaLaunch(e, e.tgt); }
      break;
    case 'warn': {
      // the target was locked when the warning started (its ring shows on that column or bank edge); the shark lines
      // up in the gap beside it, then holds still, white-hot, until the leap
      if (!e.tgt) { e.tgt = lavaSpot(e); e.lx = lavaLaunch(e, e.tgt); }
      const T = e.tgt, d = e.lx - e.x;
      if (e.st < 38 && Math.abs(d) > 0.5) e.x += clamp(d * 0.16, -1.8, 1.8);
      const f = Math.abs(d) > 3 && e.st < 38 ? Math.sign(d) : Math.sign(T.x - e.x);
      if (f && f !== e.facing) { e.facing = f; e.turn = 6; }
      if (e.turn > 0) e.turn--;
      if (e.st % 8 === 1) SFX.beep();
      if (e.st % 12 === 0) SFX.sizzle();
      if (e.st >= 50) {
        // up over the target, the jaws sweeping its top on the way up (the apex is just past its middle, at the hero's
        // chest), then down into the lava on the far side; at a bank it rears up over the edge and drops back
        const s = Math.sign(T.x - e.x) || e.facing, lo = z.x0 + 6, hi = z.x1 - 6;
        e.facing = s;
        const ax = T.bank ? clamp(T.bank < 0 ? z.x0 + 2 : z.x1 - 2, lo - 4, hi + 4) : T.x + s * 4;
        const x1 = T.bank ? clamp(ax - s * 12, lo, hi) : clamp(T.x + s * (T.w / 2 + 12), lo, hi);
        startLeap(e, x1, clamp(ly + 2 - (T.y - 20), 30, 92), Math.round(clamp(46 + Math.abs(x1 - e.x) * 0.05, 44, 56)));
        e.ax = ax;
        e.fx.push({ k: 'splash', x: e.x, y: ly, a: 0, lava: true, big: true });
        drops(e.x, ly, 8, true);
        SFX.leap(); SFX.sizzle();
      }
      break;
    }
    case 'leap': {
      lavaPath(e, Math.min(1, e.st / e.T));
      if (e.st % 3 === 0 && G.parts.length < 560) G.parts.push({ type: 'spark', x: e.x + rand(-14, 14), y: e.y + rand(0, 6), vx: rand(-0.4, 0.4), vy: rand(0, 0.8), g: 0.16, life: rand(14, 26), max: 26, size: 1 + (e.st % 2), c: e.st % 2 ? '#ffd23f' : '#ff8a1a' });
      if (e.st >= e.T) {
        e.x = e.x1; e.y = ly; e.fx.push({ k: 'splash', x: e.x1, y: ly, a: 0, lava: true, big: true }); e.fx.push({ k: 'bubbles', x: e.x1, y: ly, a: 0, lava: true });
        drops(e.x1, ly, 10, true); SFX.splash(true); SFX.sizzle();
        G.shake = Math.max(G.shake, 1.5);
        lastAtk = G.t;
        e.tgt = null;
        go(e, 'under');
      }
      break;
    }
    case 'under':   // under the crust for a moment after the splash
      if (e.st >= 16) {
        e.leaps = (e.leaps || 0) + 1;
        if (e.leaps >= LAVA_LEAPS) {
          // its leaps done, it swims away for good: off to the far end of its river, away from the hero
          const mid = (z.x0 + z.x1) / 2;
          e.away = p && !p.dead ? (p.x < e.x ? 1 : p.x > e.x ? -1 : (e.x < mid ? -1 : 1)) : (e.x < mid ? -1 : 1);
          e.facing = e.away;
          go(e, 'leave'); SFX.bloop();
          break;
        }
        go(e, 'swim'); e.cd = Math.round(rand(100, 160)); e.patT = 0; SFX.bloop();
      }
      break;
    case 'leave': {   // the fin speeds off toward the river's far end (or off the screen), then it dives
      e.x += e.away * Math.min(2.2, 0.5 + e.st * 0.12);
      const end = e.away > 0 ? z.x1 - 10 : z.x0 + 10;
      if (e.x < G.cam.x - 40 || e.x > G.cam.x + W + 40) { e.dead = true; break; }
      if ((e.away > 0 ? e.x >= end : e.x <= end) || e.st > 110) {
        e.x = e.away > 0 ? Math.min(e.x, end) : Math.max(e.x, end);
        e.fx.push({ k: 'bubbles', x: e.x, y: ly, a: 0, lava: true }); drops(e.x, ly, 4, true); SFX.bloop();
        go(e, 'sink');
      }
      break;
    }
    case 'sink':   // down under the crust (bubbles), gone
      if (e.st % 8 === 0) drops(e.x, ly, 1, true);
      if (e.st >= 24) e.dead = true;
      break;
    case 'dead': break;
  }
  if (e.state !== 'leap') e.y = ly;
}
// the open jaws of a leaping lava shark (its nose is ~24 px ahead of the body's middle, at the angle it is drawn)
function lavaJaws(e) {
  const a = LANG[angIdx(e.ang, LANG)], x = e.x + e.facing * Math.cos(a) * 19, y = e.y + Math.sin(a) * 19;
  return { x: x - 11, y: y - 9, w: 22, h: 18 };
}
// a swimming fin is a target for level shots from the banks and the columns: its box reaches up to a crouching
// hero's shot over the highest column (feet - 11 at y 196: the box top is 68 px over the lava)
const FIN_BOX_H = 68;
function lavaBox(e) {
  if (e.pieces || e.state === 'under' || e.state === 'rise' || e.state === 'sink') return NOBOX(e);
  if (e.state === 'leap') return turnedBox(e.x, e.y, 50 * LF, 20 * LF, e.ang);
  return { x: e.x - 10, y: e.z.y + LDY - FIN_BOX_H, w: 20, h: FIN_BOX_H };
}
// the glowing wake behind a fin: two arms of bright crests spreading back, a hot trail in the middle, spray at the bow.
// hot (0..1): the warning turns it white-hot
function lavaWake(x, y, dir, hot, t) {
  ctx.fillStyle = 'rgba(60,10,6,0.4)'; ctx.fillRect(x - 14, y - 1, 29, 4);
  const C1 = hot ? '#ffffff' : '#fff6d0', C2 = hot ? '#fffbe6' : '#ffd23f', C3 = hot ? '#fff1a0' : '#ffa02a';
  const len = hot ? 40 : 60;
  for (let d = 4; d < len; d++) {
    const fade = 1 - d / len, X = Math.round(x - dir * d);
    if (hsh(d * 1.9 + (t >> 3)) < fade * 1.4) { const w = d < 20 ? 3 : d < 40 ? 2 : 1; ctx.fillStyle = d < 18 ? C1 : C2; ctx.fillRect(X, Math.round(y + 1) - (w >> 1), 1, w); }
  }
  for (const side of [-1, 1]) {
    for (let d = 5; d < len + 4; d++) {
      const fade = 1 - d / (len + 4);
      if (hsh(d * 2.3 + side * 5 + (t >> 3) * 0.7) > fade * 1.6) continue;
      const X = Math.round(x - dir * d), Y = Math.round(y + 1 + side * (side < 0 ? 1 + d * 0.06 : 1.2 + d * 0.12)), th = d < 28 ? 2 : 1;
      ctx.fillStyle = '#4a1009'; ctx.fillRect(X, side > 0 ? Y + th : Y - th, 1, 1);
      ctx.fillStyle = d < 16 ? C1 : d < 38 ? C2 : C3; ctx.fillRect(X, side > 0 ? Y : Y - th + 1, 1, th);
    }
  }
  for (let k = 0; k < 4; k++) {
    const d0 = 9 + k * 12 + ((t >> 2) % 12), hh = 2.5 + k * 1.6, a = 1 - k * 0.2;
    for (let s = -1; s <= 1.001; s += 1 / (hh * 1.6)) {
      if (Math.abs(s) < 0.22 || hsh(k * 31 + s * 17) > a + 0.1) continue;
      const X = Math.round(x - dir * (d0 + s * s * (4 + k))), Y = Math.round(y + 1 + s * hh);
      ctx.fillStyle = '#4a1009'; ctx.fillRect(X - dir, Y, 1, 1);
      ctx.fillStyle = k < 2 ? C1 : C2; ctx.fillRect(X, Y, 1, 1);
    }
  }
  for (let i = 0; i < 8; i++) {
    const ph = (t * 0.05 + hsh(i * 2.7)) % 1, sx = Math.round(x + dir * (6 + ph * 8 + i)), sy = Math.round(y - 2 - Math.sin(ph * Math.PI) * (4 + i % 3));
    ctx.fillStyle = ph < 0.5 ? '#ffd23f' : '#ff8a1a'; ctx.fillRect(sx, sy, 1, ph < 0.3 ? 2 : 1);
  }
}
// lava welling round the fin's base: a bright collar over the surface
function lavaCollar(x, y, dir) {
  for (let X = x - 13; X <= x + 13; X++) {
    const k = hsh(X * 1.9 + (G.t >> 2)), e = Math.abs(X - x) > 9;
    ctx.fillStyle = k > 0.55 ? '#fff1a0' : '#ffd23f'; ctx.fillRect(X, y - (e || k < 0.3 ? 0 : 1), 1, e ? 1 : 2);
    ctx.fillStyle = '#ff8a1a'; ctx.fillRect(X, y + 1, 1, 1);
  }
}
// bubbles swelling and popping round a lava shark about to leap
function swellBubbles(x, y, st) {
  for (let i = 0; i < 6; i++) {
    const ph = (st + i * 9) % 24, bx = Math.round(x + (hsh(i * 3.3) - 0.5) * 40), r = ph < 18 ? 1.5 + ph / 5 : 0;
    if (r) { ctx.fillStyle = '#7a240c'; pdisc(bx, y, r + 1); ctx.fillStyle = ph % 4 < 2 ? '#fff1a0' : '#ffd23f'; pdisc(bx, y - 1, r); ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 1, y - Math.round(r), 1, 1); }
    else { ctx.fillStyle = '#fff1a0'; ctx.fillRect(bx - 3, y - 3, 1, 1); ctx.fillRect(bx + 3, y - 3, 1, 1); ctx.fillRect(bx, y - 5, 1, 1); }
  }
}
// the target ring on the locked spot (a column top or a bank edge): red and yellow, closing in over the warning and
// blinking faster at the end; it stays up while the jaws can still bite
function lavaTarget(e) {
  const T = e.tgt;
  if (!T) return;
  const warn = e.state === 'warn', k = warn ? clamp(1 - e.st / 50, 0, 1) : 0;
  const x = Math.round(T.x), y = Math.round(T.y), rx = Math.round(T.w / 2 + 3 + k * 9), ry = Math.max(2, Math.round(rx * 0.2));
  const on = Math.floor(G.t / (warn && e.st < 32 ? 5 : 3)) % 2 === 0;
  ctx.fillStyle = 'rgba(40,8,6,0.35)'; ctx.fillRect(x - rx + 2, y - 1, rx * 2 - 3, 3);
  ctx.fillStyle = on ? '#ff3b30' : '#ffe066'; ringDots(x, y, rx, ry, 72, 2, 0);
  ctx.fillStyle = on ? '#ffe066' : '#ff3b30'; ringDots(x, y, rx - 3, Math.max(1, ry - 1), 48, 1, 4);
}
// a fin going under (sink 0 = up, 16 = gone) or coming up, clipped at the lava's surface
function finUnder(x, ly, f, sink) {
  ctx.save(); ctx.beginPath(); ctx.rect(x - 30, ly - 40, 60, 40 + 1); ctx.clip();
  ctx.translate(x, ly + sink); ctx.scale(f, 1); spr(LAVA.fin, -LAVA.fin.ox, -LAVA.fin.oy); ctx.restore();
}
function drawLava(e) {
  if (e.x < G.cam.x - 110 || e.x > G.cam.x + W + 110) return;
  const x = Math.round(e.x), ly = e.z.y + LDY, f = e.facing;
  if (!e.pieces && (e.state === 'warn' || (e.state === 'leap' && lavaBites(e)))) lavaTarget(e);
  fxDraw(e);
  if (e.pieces) { drawPieces(e); return; }
  FLASH = e.hitT > 0;
  if (e.state === 'sink' || (e.state === 'leave' && e.st < 10)) {
    // diving away for good (or the fin popping back up to swim off)
    const sink = e.state === 'sink' ? Math.round(e.st / 24 * 18) : Math.round((1 - e.st / 10) * 12);
    if (!FLASH) { swellBubbles(x, ly, e.st + 12); if (e.state === 'leave') lavaWake(x, ly, f, 0, G.t); }
    finUnder(x, ly, f, sink);
    if (sink < 14) lavaCollar(x, ly, f);
    FLASH = false;
    return;
  }
  if (e.state === 'leap') {
    const i = angIdx(e.ang, LANG), S = LAVA.leap[i], y = Math.round(e.y);
    if (!FLASH) {
      const gl = ctx.createRadialGradient(x, y - 2, 4, x, y - 2, 40);
      gl.addColorStop(0, 'rgba(255,130,40,0.28)'); gl.addColorStop(1, 'rgba(255,110,40,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - 40, y - 42, 80, 80);
      // a lava streamer from its tail down to the splash on the way up
      const u = e.st / e.T;
      if (u < 0.55) {
        const [tx, ty] = S.fwd(-6, 0), sx = Math.round(x + f * tx), sy = Math.round(y + ty);
        for (let yy = sy + 2; yy < ly - 1; yy++) {
          const k = (yy - sy) / Math.max(1, ly - sy), px = Math.round(lerp(sx, e.x0, k * k) + Math.sin(yy * 0.5 + G.t * 0.2) * 0.7), w = 1 + Math.round(k * 2);
          ctx.fillStyle = '#ff8a1a'; ctx.fillRect(px - w, yy, w * 2 + 1, 1);
          ctx.fillStyle = k < 0.5 ? '#fff1a0' : '#ffd23f'; ctx.fillRect(px, yy, 1, 1);
        }
      }
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1); spr(S, -S.ox, -S.oy); ctx.restore();
    if (!FLASH) {
      // lava dripping off its belly and fins
      const SRC = [[12, 6], [20, 9], [28, 17], [33, 10], [-9, 11], [40, 10]];
      SRC.forEach(([uu, vv], j) => {
        const [px, py] = S.fwd(uu, vv), X = Math.round(x + f * px), Y = Math.round(y + py);
        const ph = (G.t * 0.05 + hsh(j * 5.7)) % 1, dy = Math.round(2 + ph * ph * 22);
        ctx.fillStyle = '#e0501a'; ctx.fillRect(X, Y + dy - 2, 1, 2);
        ctx.fillStyle = '#ff8a1a'; ctx.fillRect(X, Y + dy, ph < 0.5 ? 2 : 1, 2);
        ctx.fillStyle = '#fff1a0'; ctx.fillRect(X, Y + dy, 1, 1);
      });
    }
    FLASH = false;
    return;
  }
  if (e.state === 'under') { FLASH = false; return; }
  const warn = e.state === 'warn';
  if (e.state === 'rise') {
    const k = e.st / 46;
    if (!FLASH) {
      ctx.fillStyle = rgba('#ffd23f', 0.25 + k * 0.4); pdisc(x, ly, 3 + k * 9);
      swellBubbles(x, ly, e.st);
    }
    if (k > 0.55) {
      finUnder(x, ly, f, Math.round((1 - (k - 0.55) / 0.45) * 16));
      lavaCollar(x, ly, f);
    }
    FLASH = false;
    return;
  }
  if (!FLASH) lavaWake(x, ly, f, warn ? 1 : 0, G.t);
  if (warn && !FLASH) swellBubbles(x, ly - 4, e.st);
  const jig = warn && e.st > 30 ? (e.st >> 1) % 2 : 0;
  ctx.save(); ctx.translate(x + jig * f, ly - (warn ? 1 : 0)); ctx.scale(f, 1); spr(LAVA.fin, -LAVA.fin.ox, -LAVA.fin.oy); ctx.restore();
  FLASH = false;
  lavaCollar(x, ly, f);
  if (warn) {
    // the head breaks the crust ahead of the fin (a steel dome with hot plates), its eye lamp blinking fast
    const hx = x + f * 19, on = Math.floor(e.st / 4) % 2 === 0, hy = ly - 6 - (e.st > 20 ? 1 : 0);
    ctx.save(); ctx.translate(hx, hy); ctx.scale(f, 1);
    R(-9, -1, 19, 6, OUT); R(-8, -2, 17, 1, OUT); R(-6, -3, 12, 1, OUT);
    R(-8, -1, 17, 6, '#50576b'); R(-7, -2, 15, 1, '#757e93'); R(-5, -2, 9, 1, '#a7b0c4'); R(-8, 3, 17, 2, '#373b4d');
    for (let i = -7; i <= 1; i += 4) { R(i, -1, 3, 1, '#ffc23a'); R(i, 0, 3, 1, '#e0501a'); }
    R(3, 0, 5, 3, '#1c1e28');
    ctx.restore();
    const ex = hx + f * 5;
    if (on) { ctx.fillStyle = 'rgba(255,60,40,0.45)'; pdisc(ex, hy + 1, 5); }
    R(ex - 1, hy, 3, 2, on ? '#ff3b30' : '#7a1a14'); if (on) R(ex - 1, hy, 1, 1, '#ffd6c8');
    ctx.fillStyle = '#ffd23f'; for (let i = -9; i <= 9; i += 2) if (hsh(i + (G.t >> 2)) > 0.4) ctx.fillRect(hx + i, hy + 4, 1, 1);
    if (Math.floor(e.st / 5) % 2 === 0) text('!', x, ly - 40, '#ff3b30', 2, 'center');
  }
}
ENEMY_TYPES.lavashark = {
  hp: 2, armored: true, activateMargin: 40, edge: 16,
  // only the open jaws bite, on the way up, at the hero still on the targeted spot: the whole leaping body is a target
  // for shots, but touching its back or tail (or its jaws coming down) is harmless
  contact: e => (lavaBites(e) && overlap(lavaJaws(e), pbox(G.p)) ? 'hurt' : 'none'),
  make(e, s) {
    e.z = lavaRange(e.x, s);
    const entering = s.side != null || s.lava != null || !!s.rise;   // waves and summons surface first
    e.x = clamp(e.x, e.z.x0 + 14, e.z.x1 - 14); e.y = e.z.y;
    Object.assign(e, { state: entering ? 'rise' : 'swim', st: 0, cd: 70 + Math.round(hsh(e.x * 0.29) * 50), patT: 0, side: 1, off: 70, turn: 0, fx: [], lastHp: e.hp, x0: e.x, ang: 0 });
  },
  update: updLava, draw: drawLava, box: lavaBox,
  onKill(e, cx, cy, b) {
    const air = e.state === 'leap';
    if (!air) e.y = e.z.y + LDY - 6;
    boom(cx, cy, 0.6); sparks(cx, cy, 8, '#ffd23f'); SFX.pop(); SFX.sizzle();
    if (!air) { e.fx.push({ k: 'splash', x: e.x, y: e.z.y + LDY, a: 4, lava: true }); drops(e.x, e.z.y, 8, true); }
    shatter(e, [
      bit(e, P_LFIN, -2, -10, -0.4, -4.6, 0.3, { smoke: true }), bit(e, P_SJAW, 20, 2, 2.4, -3.4, 0.35),
      bit(e, P_HHULL, -10, -6, -1.8, -4.2, -0.3), bit(e, P_HPLATE2, 8, -8, 1.4, -4.6, 0.3), bit(e, P_HPLATE, 20, -6, 2.4, -3.2, 0.4),
      bit(e, P_SHULL, -4, 0, -0.8, -3.6, 0.3), bit(e, P_STAIL, -24, 0, -2.2, -3, -0.4), bit(e, P_LAMP, 16, -4, 1.6, -5, 0.5),
      ...nuts(e, 5, 0, -4)
    ], 70);
    addScore(air ? 600 : 300, cx, b.y);
    if (air) G.texts.push({ x: cx, y: b.y - 12, s: 'AIR BONUS!', t: 60, c: '#ffe066' });
    return 'dying';
  }
};

// ============================================================
// ROBOT FROG: sits (breathing, blinking, facing the hero). Warning: the throat bulges with a croak (30 frames). Then the
// sticky tongue lashes out at standing height (crouch or jump!), only at a hero 48+ px away. A tongue that touches the
// hero STICKS: it holds them, then pulls them in 0.6 px/frame and they can't walk; jump (or shoot the frog) to break
// free; reaching the frog (never sooner than 40 frames after the stick) = one hit and a push back. Sometimes it squats
// and hops to a new spot (never onto the hero or a rescue cage), a ring and a shadow marking where it will land (drawn
// over everything by EB_TYPES.frogmark). Lava and deep water are walls; a frog placed on a cage moves off it.
// ============================================================
// a frog can stand at x: not in or over lava, not in water deeper than its ankles (lily pads are platforms)
function frogGround(x) {
  if (lavaAt(x) || lavaAt(x - 10) || lavaAt(x + 10)) return false;
  const w = waterAt(x);
  return !(w && groundAt(x) > w.y + 2);
}
function lavaBetween(a, b) {
  const s = Math.sign(b - a) || 1;
  for (let x = a; s > 0 ? x <= b : x >= b; x += s * 6) if (lavaAt(x)) return true;
  return !!lavaAt(b);
}
// a frog never sits or lands on a rescue cage: its body (x +-17) keeps 8 px clear of every cage still locked
function onCage(x) {
  if (!G.pows) return null;
  for (const o of G.pows) {
    if (o.state !== 'tied') continue;
    const b = powBox(o);
    if (b && x + 17 > b.x - 8 && x - 17 < b.x + b.w + 8) return o;
  }
  return null;
}
// ... and never lands on the hero: a hop spot keeps 32 px from them (a frog's body is 17 px either side, the hero's 6),
// and from where they are walking to by the time it lands (~40 frames on)
const HOP_CLEAR = 32;
const nearHero = x => G.p && !G.p.dead && (Math.abs(x - G.p.x) < HOP_CLEAR || Math.abs(x - G.p.x - (G.p.vx || 0) * 40) < HOP_CLEAR);
// floating words (RIBBIT!, JUMP!, GULP!) go up above any other text already there (a pickup's FLAME SHOT!, a score)
function say(x, y, s, t, c) {
  const w = s.length * 6;
  for (let n = 0; n < 6; n++) {
    const o = G.texts.find(q => Math.abs(q.x - x) < (w + String(q.s).length * 6) / 2 + 3 && Math.abs(q.y - y) < 10);
    if (!o) break;
    y = o.y - 10;
  }
  G.texts.push({ x, y, s, t, c });
}
// a new spot: a platform top or the ground 30-70 px away, in its home range and on screen, with no lava on the way,
// not on a cage and not on the hero; toward: the one nearest to the hero (but not on them)
function pickHop(e, toward) {
  const p = G.p, out = [], lo = Math.max(e.home0, G.cam.x + 22), hi = Math.min(e.home1, G.cam.x + W - 22, 5690);
  for (const pl of LV.plats) {
    if (pl.t === 'column') continue;
    const m = Math.min(7, pl.w / 2), cx = clamp(e.x, pl.x + m, pl.x + pl.w - m) + (pl.w > 30 ? (hsh(pl.x + G.t) - 0.5) * (pl.w - 2 * m) * 0.6 : 0), d = Math.abs(cx - e.x);
    if (pl === e.plat || d < 16 || d > 84 || pl.y < e.y - 58 || pl.y > e.y + 70) continue;
    out.push({ x: cx, y: pl.y, pl });
  }
  for (const d of [-72, -56, -40, -30, 30, 40, 56, 72]) {
    const x = e.x + d;
    if (frogGround(x)) out.push({ x, y: groundAt(x), pl: null });
  }
  const ok = out.filter(c => c.x >= lo && c.x <= hi && !lavaBetween(e.x, c.x) && c.y > 60 && !nearHero(c.x) && !onCage(c.x));
  if (!ok.length) return null;
  if (toward) {
    ok.sort((a, b) => Math.abs(Math.abs(a.x - p.x) - 50) - Math.abs(Math.abs(b.x - p.x) - 50));
    return Math.abs(ok[0].x - p.x) < Math.abs(e.x - p.x) ? ok[0] : null;
  }
  return ok[Math.floor(rand(0, ok.length)) % ok.length];
}
// a ground spot for a frog near x that is clear of the cages and the hero (x itself when it is), not under a catwalk
// (a frog there can't be shot from it), or null
const underPlat = c => LV.plats.some(pl => pl.t !== 'column' && c > pl.x - 10 && c < pl.x + pl.w + 10 && pl.y < groundAt(c) - 12);
function clearSpot(x, prefer, screen) {
  for (const d of [0, 12, -12, 24, -24, 36, -36, 48, -48, 60, -60, 72, -72].map(v => v * (prefer || 1))) {
    const c = x + d;
    if (frogGround(c) && !onCage(c) && !nearHero(c) && !underPlat(c) && !lavaBetween(x, c) && (!screen || (c > G.cam.x + 22 && c < G.cam.x + W - 22))) return c;
  }
  return null;
}
// the tongue lashes only at a hero at least FROG_MIN px away (closer, a kid could not jump free in time)
const FROG_MIN = 48;
function frogCanLash(e) {
  const p = G.p;
  if (e.cd > 0 || p.dead || p.ride || p.hidden || G.intro || G.winT > 0 || !onScreen(e.x, 8)) return false;
  const dx = p.x - e.x, dy = p.y - e.y;
  if (Math.abs(dx) < FROG_MIN || Math.abs(dx) > 118 || dy < -40 || dy > 34 || lavaAt(p.x)) return false;
  for (const o of G.enemies) if (o !== e && o.type === 'frog' && !o.pieces && (o.state === 'croak' || o.state === 'lash' || o.state === 'stuck')) return false;
  return true;
}
const mouthOf = e => [e.x + e.facing * MOUTH_X, e.y + MOUTH_Y];
// the tongue flies at standing height: its tip box spans feet - 31 .. feet - 25, over a crouching hero (top at
// feet - 24) and under a jumping one
const TONGUE_H = 28;
const GULP_T = 40;   // frames from the stick to the soonest GULP (a kid has that long to jump free)
function tongueTipBox(tx, ty) { return { x: tx - 4, y: ty - 3, w: 8, h: 6 }; }
// let the hero go: the tongue snaps back to the mouth
function release(e, why) {
  if (e.state !== 'stuck' && e.state !== 'lash') return;
  e.tg.why = why;
  go(e, 'snap'); e.cd = Math.round(rand(90, 130)); e.hopCd = Math.min(e.hopCd, 40);
  SFX.snap();
}
function startHop(e, c) {
  e.hop = { x0: e.x, y0: e.y, x1: c.x, y1: c.y, pl: c.pl };
  const dx = Math.abs(c.x - e.x);
  e.hop.T = Math.round(30 + dx * 0.22);
  e.hop.A = Math.abs(e.y - c.y) / 2 + 20;
  if (Math.abs(c.x - e.x) > 2) e.facing = Math.sign(c.x - e.x);
  go(e, 'squat');
}
function updFrog(e) {
  if (e.pieces) { updPieces(e); return; }
  e.st++;
  const p = G.p;
  if (!e.seen) {
    // its first frame awake (not drawn yet): a frog placed on a rescue cage moves off it, away from the cage
    e.seen = true;
    const o = !e.plat && e.state === 'sit' ? onCage(e.x) : null;
    if (o) { const c = clearSpot(e.x, e.x < o.x ? -1 : 1, false); if (c != null) { e.x = c; e.y = groundAt(c); e.home0 = c - 110; e.home1 = c + 110; } }
  }
  if (hitNow(e) && e.state === 'stuck') release(e, 'shot');
  if (e.cd > 0) e.cd--;
  if (e.hopCd > 0) e.hopCd--;
  switch (e.state) {
    case 'enter': {   // a wave frog hops in from the screen edge
      if (e.home0 == null) { e.home0 = G.cam.x + 30; e.home1 = G.cam.x + W - 30; }
      let tx = clamp(e.x + e.facing * 64, G.cam.x + 40, G.cam.x + W - 40);
      if (onCage(tx) || nearHero(tx)) { const c = clearSpot(tx, -e.facing, true); if (c != null) tx = c; }
      startHop(e, { x: tx, y: groundAt(tx), pl: null });
      e.st = 6;
      break;
    }
    case 'sit':
      if (!p.dead && e.st % 20 === 0) { const f = Math.sign(p.x - e.x); if (f) e.facing = f; }
      if (frogCanLash(e)) {
        go(e, 'croak'); SFX.croak(); const f = Math.sign(p.x - e.x); if (f) e.facing = f;
        say(e.x + e.facing * 6, e.y - 42, 'RIBBIT!', 34, '#c4f08a');
        break;
      }
      if (e.hopCd <= 0 && onScreen(e.x, 4)) {
        const far = Math.abs(p.x - e.x) > 110, c = pickHop(e, far);
        e.hopCd = Math.round(rand(150, 260));
        if (c && (far || rand(0, 1) < 0.55)) startHop(e, c);
      }
      break;
    case 'croak':   // the warning: the throat bulges, croak, croak
      if (e.st === 16) SFX.croak();
      if (e.st >= 30) {
        const [mx, my] = mouthOf(e), dir = e.facing;
        const reach = clamp(Math.abs(p.x - mx) + 10, 30, 124);
        e.tg = { k: 0, tx: mx + dir * reach, gy: p.onGround ? p.y : e.y, hx: 0, hy: 0, why: null, len: reach };
        go(e, 'lash'); SFX.lash();
      }
      break;
    case 'lash': {   // out in 9 frames, a wiggle at full reach, back in 12
      const T = e.tg;
      if (p.onGround) T.gy = p.y;
      T.k = e.st <= 9 ? e.st / 9 : e.st <= 14 ? 1 : Math.max(0, 1 - (e.st - 14) / 12);
      // the tip is at standing height from the first frame on (it rises out of the mouth at once), so it always flies
      // over a crouching hero, however close
      const [mx, my] = mouthOf(e), tx = lerp(mx, T.tx, T.k), ty = lerp(my, T.gy - TONGUE_H, Math.min(1, T.k * 9));
      T.x = tx; T.y = ty;
      if (e.st <= 14 && !p.dead && !p.ride && overlap(tongueTipBox(tx, ty), pbox(p))) {
        go(e, 'stuck'); e.hold = p.x; e.lastInv = p.inv;
        // it holds on for a moment before it pulls: the GULP comes no sooner than ~40 frames after the stick
        e.grip = Math.round(clamp(GULP_T - (Math.abs(p.x - e.x) - 25) / 0.6, 10, GULP_T));
        T.dx = clamp(tx - p.x, -5, 5);
        SFX.stick();
        if (G.parts.length < 560) for (let i = 0; i < 6; i++) G.parts.push({ type: 'spark', x: tx, y: ty, vx: rand(-1.4, 1.4), vy: rand(-1.8, 0.4), g: 0.15, life: 14, max: 14, size: i % 2 ? 1 : 2, c: i % 2 ? '#ff9ac4' : '#f0609a' });
        say(p.x, p.y - 44, 'JUMP!', 50, '#ff9ac4');
        break;
      }
      if (e.st >= 26) { go(e, 'sit'); e.cd = Math.round(rand(80, 120)); }
      break;
    }
    case 'stuck': {   // the tongue holds the hero: pulled in, can't walk; jump (or a shot) breaks free
      const T = e.tg, dir = Math.sign(e.x - e.hold) || e.facing * -1;
      if (p.dead || p.ride || ctlTap('jump') || p.dropT > 0 || p.inv > e.lastInv) { release(e, 'jump'); break; }
      e.lastInv = p.inv;
      const nx = e.st > e.grip ? e.hold + dir * 0.6 : e.hold;
      if (lavaAt(nx)) { release(e, 'lava'); break; }
      e.hold = nx; p.x = nx; p.kb = 0;
      T.x = p.x + T.dx; T.y = p.y - (p.crouch ? 18 : 25);
      if (e.st > e.grip && Math.abs(p.x - e.x) < 25) {
        // reached the frog: one hit and a push back
        hurtPlayer();
        if (!p.dead) { p.kb = -dir * 3.4; p.vy = Math.min(p.vy, -2.6); p.onGround = false; p.onPlat = null; }
        SFX.chomp();
        say(e.x, e.y - 40, 'GULP!', 50, '#ffffff');
        release(e, 'reach');
      }
      break;
    }
    case 'snap': {   // the tongue flies back to the mouth
      const T = e.tg, [mx, my] = mouthOf(e), k = Math.min(1, e.st / 8);
      T.x = lerp(T.x, mx, k); T.y = lerp(T.y, my, k);
      if (e.st >= 8) go(e, 'sit');
      break;
    }
    case 'squat':   // about to hop: crouched, the landing shadow already showing
      if (e.st >= 14) { go(e, 'hop'); SFX.hop(); dust(e.x, e.y, 3); }
      break;
    case 'hop': {
      const H = e.hop, u = Math.min(1, e.st / H.T);
      e.x = lerp(H.x0, H.x1, u);
      e.y = lerp(H.y0, H.y1, u) - 4 * H.A * u * (1 - u);
      if (e.st >= H.T) {
        e.x = H.x1; e.y = H.y1; e.plat = H.pl;
        dust(e.x, e.y, 5); SFX.plop();
        const w = waterAt(e.x);
        if (w && Math.abs(e.y - w.y) < 4) drops(e.x, w.y, 6, false);
        go(e, 'land');
      }
      break;
    }
    case 'land':
      if (e.st >= 8) { go(e, 'sit'); e.cd = Math.max(e.cd, 30); }
      break;
    case 'dead': break;
  }
  // the landing marker lives with the enemy projectiles (drawn over every robot and the hero): one while it hops
  if ((e.state === 'squat' || e.state === 'hop') && e.hop && (!e.mark || e.mark.life <= 0 || !G.eb.includes(e.mark))) {
    e.mark = { k: 'frogmark', x: e.hop.x1, y: e.hop.y1 - 12, vx: 0, vy: 0, life: 99, e };
    G.eb.push(e.mark);
  }
}
function frogBox(e) {
  if (e.pieces) return NOBOX(e);
  if (e.state === 'hop') return { x: e.x - 15, y: e.y - 24, w: 30, h: 22 };
  const sq = e.state === 'squat' || e.state === 'land';
  return { x: e.x - (e.facing > 0 ? 15 : 17), y: e.y - (sq ? 25 : 30), w: 32, h: sq ? 25 : 30 };
}
// the long pink sticky tongue: from the mouth in a whipping arc to a sticky blob, speed lines while it lashes
function drawTongue(e) {
  const T = e.tg;
  if (!T || T.x == null) return;
  const [mx, my] = mouthOf(e), tx = T.x, ty = T.y, n = 20, pts = [];
  const len = Math.hypot(tx - mx, ty - my);
  if (len < 3) return;
  const stuck = e.state === 'stuck', lashing = e.state === 'lash' && e.st <= 9;
  const bow = stuck ? 2 + Math.sin(G.t * 0.4) * 1 : lashing ? 7 * (1 - T.k * 0.5) : e.state === 'snap' ? -3 : 4;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([lerp(mx, tx, t), lerp(my, ty, t) - Math.sin(Math.PI * t) * bow + (stuck ? Math.sin(t * 12 + G.t * 0.5) * 0.4 * t : 0)]);
  }
  ctx.fillStyle = OUT;
  for (let i = 0; i + 1 < pts.length; i++) pl(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 5, OUT);
  for (let i = 0; i + 1 < pts.length; i++) pl(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 3, '#f0609a');
  for (let i = 0; i + 1 < pts.length; i++) pl(pts[i][0], pts[i][1] - 1, pts[i + 1][0], pts[i + 1][1] - 1, 1, '#ff9ac4');
  for (let i = 2; i + 1 < pts.length; i += 3) pl(pts[i][0], pts[i][1] + 1, pts[i + 1][0], pts[i + 1][1] + 1, 1, '#b83a72');
  const X = Math.round(tx), Y = Math.round(ty);
  RO(X - 4, Y - 3, 8, 6, '#f0609a'); R(X - 3, Y - 3, 6, 1, '#ffb6d6'); R(X - 2, Y - 2, 2, 1, '#ffffff'); R(X - 4, Y + 2, 8, 1, '#b83a72');
  // goo dripping off the sticky blob
  const dl = (G.t >> 2) % 6;
  R(X - 2, Y + 3, 1, 2 + (dl >> 1), '#f0609a'); R(X + 2, Y + 3, 1, 3, '#f0609a'); R(X + 2, Y + 6, 1, 1, '#ffb6d6');
  if (lashing) {
    for (const [o, k0, k1] of [[-5, 0.25, 0.55], [5, 0.35, 0.7], [-8, 0.55, 0.8]]) {
      const a = pts[Math.round(k0 * n)], c = pts[Math.round(k1 * n)];
      pl(a[0], a[1] + o, c[0], c[1] + o, 1, 'rgba(255,255,255,0.8)');
    }
  }
  if (stuck) {   // strings of goo where it holds the hero, and a straining wobble
    ctx.fillStyle = 'rgba(255,182,214,0.9)';
    ctx.fillRect(X - 6, Y - 1 + ((G.t >> 3) % 2), 2, 1); ctx.fillRect(X + 5, Y + 1 - ((G.t >> 3) % 2), 2, 1);
  }
}
// the landing marker (drawn by EB_TYPES.frogmark): from the squat on, a dark shadow sitting on the ground line where it
// will come down, growing as it falls, and a dashed red and yellow ring closing in on it, blinking faster at the end
function frogMark(e) {
  const H = e.hop, st = e.state, u = st === 'hop' ? Math.min(1, e.st / H.T) : 0, k = st === 'squat' ? 0.2 : 0.2 + 0.8 * u * u;
  const x = Math.round(H.x1), y = Math.round(H.y1), hw = Math.round(6 + 10 * k);
  ctx.fillStyle = rgba('#050d08', 0.4 + 0.35 * k);
  for (let j = -2; j <= 1; j++) { const w = Math.round(hw * Math.sqrt(1 - ((j + 0.5) / 2.6) ** 2)); ctx.fillRect(x - w, y + j, w * 2 + 1, 1); }
  ctx.fillStyle = rgba('#050d08', 0.3 * k);
  ctx.fillRect(x - Math.round(hw * 0.5), y - 1, Math.round(hw * 0.5) * 2 + 1, 1);
  const on = Math.floor(G.t / (u > 0.5 ? 3 : 6)) % 2 === 0, rx = Math.round(hw + 8 - 6 * k), ry = Math.max(2, Math.round(rx * 0.25));
  ctx.fillStyle = on ? '#ff3b30' : '#ffe066'; ringDots(x, y, rx, ry, 60, 2, 5);
  ctx.fillStyle = on ? '#ffe066' : '#ff3b30'; ringDots(x, y, rx + 1, ry + 1, 60, 1, 5);
}
EB_TYPES.frogmark = {
  r: -1,   // never touches the hero, never shot
  update(b) {
    const e = b.e;
    if (!e || e.dead || e.pieces || e.mark !== b || !e.hop || (e.state !== 'squat' && e.state !== 'hop')) { b.life = 0; return; }
    b.life = 99; b.vx = 0; b.vy = 0; b.x = e.hop.x1; b.y = e.hop.y1 - 12;
  },
  draw(b) { const e = b.e; if (e && e.hop && e.mark === b && !e.pieces && (e.state === 'squat' || e.state === 'hop')) frogMark(e); }
};
function drawFrog(e) {
  if (e.x < G.cam.x - 60 || e.x > G.cam.x + W + 60) return;
  if (e.pieces) { drawPieces(e); return; }
  const x = Math.round(e.x), y = Math.round(e.y), f = e.facing, st = e.state;
  let S, dy = 0;
  if (st === 'hop') S = e.st < e.hop.T * 0.5 ? FROG.up : FROG.down;
  else if (st === 'squat' || st === 'land') S = FROG.squat;
  else if (st === 'croak') S = FROG.croak[e.st < 6 ? 0 : (e.st >> 2) % 2];
  else if (st === 'lash' || st === 'stuck' || (st === 'snap' && e.st < 5)) S = FROG.open;
  else if ((e.t + Math.round(e.x)) % 150 < 6) S = FROG.blink;
  else S = FROG.sit[Math.floor((e.t + e.x) / 22) % 2];
  if (st === 'hop') dy = -6;
  FLASH = e.hitT > 0;
  ctx.save(); ctx.translate(x, y + dy); ctx.scale(f, 1);
  blit(S, 0, 0);
  if (!FLASH && st !== 'hop' && S !== FROG.blink) {
    const hot = st === 'croak', ex = Math.round(9.6 * FS), ey = Math.round((st === 'squat' || st === 'land' ? -28.2 * 0.84 : -28.2) * FS);
    ctx.fillStyle = hot ? 'rgba(255,214,90,0.32)' : 'rgba(255,200,90,0.2)'; pdisc(ex, ey, hot ? 8 : 6);
    ctx.fillStyle = hot ? 'rgba(255,240,170,0.45)' : 'rgba(255,232,140,0.3)'; pdisc(ex, ey, 3);
  }
  ctx.restore();
  FLASH = false;
  if (st === 'croak') {
    // croak rings rolling off the throat
    for (let k = 0; k < 3; k++) {
      const ph = ((e.st + k * 5) % 15) / 15, r = 5 + ph * 11, cx = x + f * Math.round(18 * FS), cy = y - Math.round(10 * FS);
      ctx.fillStyle = rgba(k % 2 ? '#fff6c4' : '#ffffff', 0.95 * (1 - ph));
      for (let a = -0.8; a <= 0.8; a += 0.12) ctx.fillRect(Math.round(cx + f * Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, ph < 0.5 ? 2 : 1);
    }
  }
  if (st === 'lash' || st === 'stuck' || st === 'snap') drawTongue(e);
}
ENEMY_TYPES.frog = {
  hp: 5, activateMargin: 30, edge: 18,
  contact: e => (e.pieces ? 'none' : e.state === 'hop' && e.st > e.hop.T * 0.5 ? 'hurt' : 'block'),
  make(e, s) {
    e.plat = null;
    if (s.y != null) for (const pl of LV.plats) if (Math.abs(pl.y - s.y) < 1.5 && s.x >= pl.x - 4 && s.x <= pl.x + pl.w + 4) {
      const m = Math.min(8, pl.w / 2);
      e.plat = pl; e.x = clamp(s.x, pl.x + m, pl.x + pl.w - m); e.y = pl.y; break;
    }
    const wave = s.side != null;
    Object.assign(e, {
      state: wave ? 'enter' : 'sit', st: 0, cd: 40 + Math.round(hsh(e.x * 0.41) * 40), hopCd: 120 + Math.round(hsh(e.x * 0.73) * 100),
      home0: wave ? null : e.x - 110, home1: wave ? null : e.x + 110, lastHp: e.hp, tg: null, hop: null, hold: e.x, lastInv: 0,
      grip: 0, mark: null, seen: false
    });
  },
  update: updFrog, draw: drawFrog, box: frogBox,
  onKill(e, cx, cy, b) {
    if (e.state === 'stuck' || e.state === 'lash') release(e, 'shot');
    boom(cx, cy, 0.5); sparks(cx, cy, 6); SFX.pop();
    shatter(e, [
      bit(e, P_FLAMP, 10, -30, 1.2, -5, 0.4, { smoke: true }), bit(e, P_FLAMP, 3, -31, -0.8, -5.4, -0.4),
      bit(e, P_FHELM, 6, -24, 0.6, -5.2, 0.3), bit(e, P_FPLATE, -6, -16, -1.4, -4.4, -0.3), bit(e, P_FPLATE2, 8, -14, 1.8, -4, 0.35), bit(e, P_FPLATE, -12, -10, -2.2, -3.4, -0.4),
      bit(e, P_FLEG, -10, -4, -2.4, -2.8, -0.35), bit(e, P_FLEG, 8, -4, 2.2, -3, 0.35), bit(e, P_SPRING, 0, -12, 0.3, -3.8, 0.5),
      ...nuts(e, 4, 0, -14)
    ], 66);
    addScore(200, cx, b.y);
    return 'dying';
  }
};

// ============================================================
// LAVA BOMB (AREA 3): the volcano throws a molten rock; a blinking ring with a '!' closes in on its landing spot for
// 1.5 s; it can be shot in the air; it bursts into embers that hurt only right at the impact.
// L3.lavaBomb(tx) launches one so it lands at world x tx (and tells the sky to flash the eruption).
// ============================================================
const VOR = [0, 0];
function vor(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const ci = i + di, cj = j + dj, d = Math.hypot(ci + h2(ci, cj, s) - x, cj + h2(ci, cj, s + 5) - y);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  VOR[0] = f1; VOR[1] = f2;
  return VOR;
}
// a molten rock: dark crust broken into plates by glowing cracks, the leading (lower) side still molten
function bombSprite(rot) {
  const g = new Grid(17, 17, -8, -8), ca = Math.cos(rot), sa = Math.sin(rot);
  for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
    const d = Math.hypot(x, y * 1.08);
    if (d > 6.5) continue;
    const rx = x * ca - y * sa, ry = x * sa + y * ca;
    const V = vor(rx / 2.6 + 11.3, ry / 2.6 + 4.7, 97), e = V[1] - V[0], molten = (y - x * 0.35) > 3.2;
    let c;
    if (molten) c = d > 5.6 ? 'l' : y > 4 ? 'i' : 'j';
    else if (e < 0.13) c = d < 4 ? 'h' : 'i';
    else if (e < 0.22) c = 'l';
    else c = (x + y) < -4 ? 'c' : (x + y) < 3 ? 'd' : 'n';
    if (c === 'd' && h2(x, y, 98) > 0.8) c = 'c';
    g.set(x, y, c);
  }
  g.outline(false);
  return g.sprite(LPAL);
}
const BOMB = [0, 1.57, 3.14, 4.71].map(bombSprite);
const BOMB_T = 90;   // frames from launch to impact (the ring blinks all that time: 1.5 s)
function bombImpact(b) {
  const x = b.tx, y = b.ty, p = G.p, lv = lavaAt(x), inLava = lv && y >= lv.y - 1;
  if (!p.dead && distToBox(x, y - 4, pbox(p)) < 9) hurtPlayer();
  G.rings.push({ x, y: y - 3, r: 18, t: 0, max: 10 });
  G.parts.push({ type: 'flash', x, y: y - 4, life: 5, max: 5, size: 12 });
  if (G.parts.length < 600) {
    for (let i = 0; i < 6; i++) G.parts.push({ type: 'fire', x: x + rand(-6, 6), y: y - rand(2, 8), vx: rand(-0.8, 0.8), vy: rand(-1.4, -0.3), life: rand(16, 26), max: 26, size: rand(3, 6) });
    for (let i = 0; i < 12; i++) G.parts.push({ type: 'spark', x, y: y - 2, vx: rand(-2.6, 2.6), vy: rand(-3.8, -1), g: 0.18, life: rand(18, 34), max: 34, size: i % 3 ? 1 : 2, c: i % 2 ? '#ffd23f' : '#ff8a1a' });
    for (let i = 0; i < 3; i++) G.parts.push({ type: 'smoke', x: x + rand(-5, 5), y: y - 6, vx: rand(-0.3, 0.3), vy: rand(-0.8, -0.4), life: rand(30, 50), max: 50, size: rand(3, 5) });
  }
  if (inLava) drops(x, lv.y, 8, true);
  else if (G.parts.length < 600) for (let i = 0; i < 4; i++) G.parts.push({ type: 'fire', x: x - 6 + i * 4, y: y - 1, vx: 0, vy: 0.2, life: rand(34, 50), max: 50, size: 2.2 });
  G.shake = Math.max(G.shake, 2.5);
  SFX.thud();
}
// the landing marker: a red and yellow ring closing in on the spot, blinking faster at the end, a big '!', a dotted
// line up to the bomb
function bombMarker(b) {
  const x = Math.round(b.tx), y = Math.round(b.ty), left = BOMB_T - b.t, k = clamp(left / BOMB_T, 0, 1);
  const on = Math.floor(G.t / (left < 30 ? 3 : 5)) % 2 === 0, c1 = on ? '#ff3b30' : '#ffe066', c2 = on ? '#ffe066' : '#ff3b30';
  ctx.fillStyle = 'rgba(40,10,10,0.45)'; ctx.fillRect(x - 7, y - 1, 15, 3);
  const r = 10 + k * 8;
  ctx.fillStyle = c1; ringDots(x, y, r, r * 0.32, 72, 1, 0); ringDots(x, y, r - 1, r * 0.32 - 0.5, 72, 1, 0);
  ctx.fillStyle = c2; ringDots(x, y, 5, 1.6, 36, 1, 0);
  if (b.y > -4) for (let yy = y - 34; yy > b.y + 12; yy -= 5) { ctx.fillStyle = c1; ctx.fillRect(Math.round(lerp(x, b.x, (y - yy) / Math.max(1, y - b.y))), yy, 1, 2); }
  text('!', x + 1, y - 28, c1, 2, 'center');
}
EB_TYPES.lavabomb = {
  r: 7, shootable: true,
  update(b) {
    b.t++;
    if (b.t % 4 === 0 && b.y > 0 && G.parts.length < 560) G.parts.push({ type: 'spark', x: b.x + rand(-3, 3), y: b.y - 4, vx: rand(-0.3, 0.3), vy: rand(-0.6, 0.2), g: 0.05, life: 16, max: 16, size: 1, c: '#ffb52e' });
    if (b.y + b.vy >= b.ty) { b.life = 0; bombImpact(b); }
  },
  draw(b) {
    bombMarker(b);
    const x = Math.round(b.x), y = Math.round(b.y);
    if (y < -20) return;
    // the fire and smoke trail, back along its flight
    const sp = Math.hypot(b.vx, b.vy) || 1, dx = -b.vx / sp, dy = -b.vy / sp;
    for (let i = 14; i >= 1; i--) {
      const k = i / 14, px = x + Math.round(dx * i * 2.4 + Math.sin(i * 1.7 + G.t * 0.2) * k * 1.4), py = y + Math.round(dy * i * 2.4), r = 1.5 + k * 4.5;
      if (k > 0.5) { ctx.fillStyle = k > 0.75 ? '#2e2228' : '#4a3034'; pdisc(px, py, r); ctx.fillStyle = '#5e4048'; pdisc(px - 1, py - 1, r * 0.5); }
      else { ctx.fillStyle = k > 0.3 ? '#c8401a' : '#ff8a1a'; pdisc(px, py, r); ctx.fillStyle = k > 0.3 ? '#ff8a1a' : '#ffd23f'; pdisc(px, py + 1, r * 0.6); }
    }
    ctx.fillStyle = '#ffd23f'; pdisc(x + Math.round(dx * 3), y + Math.round(dy * 3), 3.5);
    ctx.fillStyle = '#fff1a0'; pdisc(x + Math.round(dx * 2), y + Math.round(dy * 2), 2);
    const gl = ctx.createRadialGradient(x, y, 2, x, y, 16);
    gl.addColorStop(0, 'rgba(255,170,70,0.5)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = gl; ctx.fillRect(x - 16, y - 16, 32, 32);
    const S = BOMB[(b.t >> 3) % 4];
    spr(S, x - 8, y - 8);
    for (let i = 0; i < 6; i++) { const a = hsh(i * 3.3) * 6.28 + G.t * 0.05, r = 9 + hsh(i * 1.7) * 5; ctx.fillStyle = i % 2 ? '#ffd23f' : '#ff8a1a'; ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.8), 1, 1); }
  },
  onHit(b) { b.tx = b.x; b.ty = b.y; bombImpact(b); }
};
// launch one from the volcano's side (upper right) so it lands at world x tx in BOMB_T frames
L3.lavaBomb = function (tx) {
  tx = clamp(tx, G.cam.x + 8, G.cam.x + W - 8);
  const ty = surfaceAt(tx), T = BOMB_T, g = 0.05, y0 = -24, x0 = Math.min(tx + 70, G.cam.x + W + 22);
  const vy = (ty - y0 - g * T * (T - 1) / 2) / T;
  G.eb.push({ k: 'lavabomb', x: x0, y: y0, vx: (tx - x0) / T, vy, g, life: T + 40, tx, ty, t: 0 });
  L3.eruptT = 30;
  SFX.rumble();
};
}
