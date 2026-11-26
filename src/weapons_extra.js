'use strict';
// ============================================================
// Mission 2 weapons: S shotgun, R rocket launcher, F flame shot, and the pickups S / R / F / cherry / chestnut.
// Everything in this block is private: it is reached through WEAPONS.shotgun / rocket / flame and
// ITEMS.S / R / F / cherry / chestnut (see docs/engine-api.md, WEAPONS and ITEMS).
// ============================================================
{
// ============================================================
// Pixel maps: rects of palette letters painted on a grid, then a 1px OUT outline around them
// ============================================================
const PAL = {
  k: OUT,
  // gun steel, and the darker blued steel of the shotgun
  a: '#1d2129', d: '#343b46', s: '#566170', l: '#8d99a7', w: '#dfe7ee',
  A: '#1b1e28', B: '#2e3443', C: '#4b5570', D: '#7f8cab',
  // wood
  b: '#4a2c15', o: '#7a4b24', O: '#a86d36', y: '#d89c58',
  // olive drab
  g: '#3b4720', G: '#5a6a2e', h: '#7d9140', H: '#a8bd62',
  // reds
  r: '#962318', R: '#d1372a', e: '#ff7560', E: '#ffd0c4',
  // brass / copper
  p: '#8a4f1c', P: '#c98236', q: '#f2c06a',
  // misc: glass, warning yellow, white, stems and leaves (no outline)
  c: '#7fd8ff', Y: '#ecc63a', Z: '#9a7c1c', n: '#ffffff',
  v: '#2f6b2a', V: '#5c9e3a', L: '#3f8a34', M: '#8fcf4a'
};
const NO_OUT = 'kvV'; // dark lines and thin stems: no outline of their own

// rects [x, y, w, h, letter] in local coords -> { img, white, w, h, ox, oy } (ox, oy = local coords of the top-left)
function pixSprite(rects, round) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y, w, h] of rects) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); }
  const ox = x0 - 1, oy = y0 - 1, w = x1 - x0 + 2, h = y1 - y0 + 2;
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  for (const [x, y, rw, rh, c] of rects) for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) g[j - oy][i - ox] = c;
  return { ...makeSprite(outline(g, round), PAL), ox, oy };
}
// 1px OUT outline around every painted pixel (round: no corner pixels)
function outline(g, round) {
  const h = g.length, w = g[0].length, o = g.map(r => r.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x] !== '.') continue;
    let n = false;
    for (let dy = -1; dy <= 1 && !n; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (round && dx && dy) continue;
      const c = g[y + dy] && g[y + dy][x + dx];
      if (c && c !== '.' && !NO_OUT.includes(c)) { n = true; break; }
    }
    if (n) o[y][x] = 'k';
  }
  return o.map(r => r.join(''));
}
// A gun is painted pointing forward (x along the barrel, y down, the hand at 0,0) and turned for the other aims:
// 'up' turned 90 degrees left, 'down' pointing down with its top side to the left (light still comes from the left)
const turn = (rs, aim) => aim === 'fwd' ? rs : rs.map(([x, y, w, h, c]) => aim === 'up' ? [y, -x - w + 1, h, w, c] : [y, x, h, w, c]);
const turnPt = (x, y, aim) => aim === 'fwd' ? [x, y] : aim === 'up' ? [y, -x] : [y, x];
const AIMS = ['fwd', 'up', 'down'];
const spin = aim => aim === 'up' ? -Math.PI / 2 : aim === 'down' ? Math.PI / 2 : 0;

// The hand in front of the gun's grip (hero-local, hand top-left at hx, hy)
function hand(hx, hy) { R(hx, hy, 3, 2, SKIN); R(hx, hy + 1, 3, 1, SKIND); R(hx + 2, hy, 1, 1, '#ffe2c8'); }

// Weapon kit: sprites for each aim (and each variant), the hand anchor and the muzzle (standing, facing right)
// paint(aim, variant) -> rects; anchor[aim] = [x, row below the torso top]; mz = muzzle in painted coords
function kit(paint, variants, anchor, mz) {
  const k = { spr: {}, anchor, muzzle: {} };
  for (const aim of AIMS) {
    k.spr[aim] = [];
    for (let v = 0; v < variants; v++) k.spr[aim].push(pixSprite(turn(paint(aim, v), aim)));
    const [mx, my] = turnPt(mz[0], mz[1], aim);
    k.muzzle[aim] = [anchor[aim][0] + mx, -21 + anchor[aim][1] + my];
  }
  return k;
}
// draw a kit sprite at the aim's hand anchor (r = recoil pixel, pushes the gun back along its barrel)
function drawKit(k, aim, ty, r, v) {
  const [ax, ay] = k.anchor[aim], s = k.spr[aim][v || 0];
  const x = ax - (aim === 'fwd' ? r : 0), y = ty + ay + (aim === 'up' ? r : aim === 'down' ? -r : 0);
  spr(s, x + s.ox, y + s.oy);
  return [x, y];
}

// Drawing-only timers (G.t of the last shot of each weapon): pump, reload and flash animations
let pumpT = -999, rocketT = -999, flameT = -999, hissT = -999;

// ============================================================
// Crisp pixel discs for smoke and fire (no blurry anti-aliased circles): one strip per colour, diameters 1..MAXD
// ============================================================
const MAXD = 28, DOFF = [];
for (let d = 1, o = 0; d <= MAXD; o += d, d++) DOFF[d] = o;
const DSTRIP = {};
for (const col of [
  '#ffffff', '#e6e1d8', '#b8b2a8', '#f4efe6', '#cfc8bc', '#9d968c', '#8c8287', '#6b6267', '#4b4448', // smoke
  '#fff1a0', '#ffd23f', '#ffc23a', '#ff9a2e', '#e8501e', '#a3301a', '#6e2412' // fire
]) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = DOFF[MAXD] + MAXD; c.height = MAXD; g.fillStyle = col;
  for (let d = 1; d <= MAXD; d++) {
    const r = d / 2, lim = r * r - r / 2;
    for (let j = 0; j < d; j++) {
      let n = 0;
      for (let i = 0; i < d; i++) { const dx = i + 0.5 - r, dy = j + 0.5 - r; if (d < 3 || dx * dx + dy * dy <= lim) n++; }
      g.fillRect(DOFF[d] + (d - n) / 2, j, n, 1);
    }
  }
  DSTRIP[col] = c;
}
function disc(x, y, r, col) {
  const s = DSTRIP[col], d = r < 0.5 ? 1 : r * 2 > MAXD ? MAXD : Math.round(r * 2);
  if (s) ctx.drawImage(s, DOFF[d], 0, d, d, Math.round(x - d / 2), Math.round(y - d / 2), d, d);
}

// ============================================================
// Effects host: one entry in G.pb, under the ground where the engine never collides it (it returns at the ground
// check). It moves and draws the smoke puffs, then the flame jet. A level rebuild (a new G.pb) drops it.
// fire() calls fxHost() before pushing its shots, so the smoke is drawn under them.
// ============================================================
const SMOKE = {
  trail: ['#ffffff', '#e6e1d8', '#b8b2a8'],
  blast: ['#f4efe6', '#cfc8bc', '#9d968c'],
  soot: ['#8c8287', '#6b6267', '#4b4448']
};
const PUFFS = [], FIRES = [];
let host = null;
function fxHost() {
  if (host && host.life > 0 && G.pb.includes(host)) return;
  PUFFS.length = 0; FIRES.length = 0;
  host = { x: G.cam.x + W / 2, y: H - 1, vx: 0, vy: 0, dmg: 0, life: 1e9, idle: 0, update: hostUpd, onGround: () => true, draw: hostDraw };
  G.pb.push(host);
}
function hostUpd(b) {
  b.x = G.cam.x + W / 2;
  for (const q of PUFFS) { q.x += q.vx; q.y += q.vy; q.vx *= 0.92; q.vy = q.vy * 0.92 - 0.025; q.life--; onFloor(q); }
  for (let i = PUFFS.length - 1; i >= 0; i--) if (PUFFS[i].life <= 0) PUFFS.splice(i, 1);
  for (const f of FIRES) {
    f.x += f.vx; f.y += f.vy; f.vx *= 0.82; f.vy = f.vy * 0.82 - 0.04; onFloor(f);
    // swells, then shrinks away over the smoke it leaves behind
    const t = f.age / f.max;
    f.r = (f.r0 + f.grow * Math.min(t, 0.6)) * (t > 0.6 ? 1 - (t - 0.6) * 2 : 1);
    if (f.smoky && f.age === Math.round(f.max * 0.5)) puff(f.x, f.y, f.vx * 0.5, f.vy * 0.5 - 0.2, f.r * 0.85, 3, rand(20, 28) | 0, 'blast');
    f.age++;
  }
  for (let i = FIRES.length - 1; i >= 0; i--) if (FIRES[i].age >= FIRES[i].max) FIRES.splice(i, 1);
  if (PUFFS.length || FIRES.length || G.pb.some(q => q.flame)) b.idle = 0;
  else if (++b.idle > 90) b.life = 0;
}
function hostDraw() {
  // smoke, layer by layer so touching puffs merge into one cloud: shadow, body, highlight; old puffs shrink away
  const L = G.cam.x - 30, Rr = G.cam.x + W + 30;
  for (let pass = 0; pass < 3; pass++) for (const q of PUFFS) {
    if (q.x < L || q.x > Rr) continue;
    const k = q.life / q.max, r = (q.r + (1 - k) * q.grow) * (k < 0.3 ? 0.35 + k * 2.15 : 1);
    ctx.globalAlpha = k < 0.3 ? 0.4 + k * 2 : 1;
    if (pass === 0) disc(q.x + 0.6, q.y + 1, r, q.c[2]);
    else if (pass === 1) disc(q.x - 0.3, q.y - 0.4, r - 0.9, q.c[1]);
    else if (r > 2.2) disc(q.x - r * 0.3, q.y - r * 0.38, r * 0.42, q.c[0]);
  }
  ctx.globalAlpha = 1;
  flamesDraw();
}
// smoke and fire blown into the ground (a back-blast when aiming up) roll out along it instead
function onFloor(q) {
  const gy = groundAt(q.x) - 2;
  if (q.y > gy && q.vy > 0) { q.vx += (q.vx < 0 ? -0.6 : 0.6) * q.vy; q.y = gy; q.vy = 0; }
}
// a smoke puff: grows by `grow` over its life, drifts, slows down and rises
function puff(x, y, vx, vy, r, grow, life, kind) {
  if (PUFFS.length >= 180) return;
  fxHost();
  PUFFS.push({ x, y, vx, vy, r, grow, life, max: life, c: SMOKE[kind] });
}
// a short burst of fire that does no damage (the shotgun's blast, the launcher's back-blast), drawn with the flames;
// a smoky one leaves a smoke puff behind
function burst(x, y, vx, vy, r0, grow, life, smoky) {
  if (FIRES.length >= 60) return;
  fxHost();
  FIRES.push({ x, y, vx, vy, r: r0, r0, grow, age: 0, max: life, smoky, seed: G.t * 7 + FIRES.length });
}
// A ticker of the same kind runs a delayed effect: fn() n - 1 frames after the frame it is made in
function later(n, fn) {
  G.pb.push({ x: G.cam.x + W / 2, y: H - 1, vx: 0, vy: 0, dmg: 0, life: n + 2, n,
    update(b) { b.x = G.cam.x + W / 2; if (--b.n <= 0) { b.life = 0; fn(); } },
    onGround: () => true, draw() {} });
}
// The flame jet and the fire bursts: every flame puff in G.pb and every burst, layer by layer (dark rims, orange bodies,
// yellow insides, white-hot cores), so overlapping puffs read as one shape. k = heat, 0 (white-hot) .. 0.76 (cooled).
function flamesDraw() {
  for (let pass = 0; pass < 4; pass++) {
    for (const f of FIRES) flameLayer(pass, f, f.age / f.max * 0.45);
    for (const b of G.pb) if (b.flame && b.life > 0) flameLayer(pass, b, b.age / b.max);
  }
}
// A fast young puff is also drawn back along its path, so the jet stays unbroken; older ones lick upwards
function flameLayer(pass, b, k) {
  const r = b.r * (0.86 + hsh(b.seed * 3.7 + G.t * 0.61) * 0.28);
  const n = Math.abs(b.vx) + Math.abs(b.vy) > 3 ? 3 : 1;
  for (let i = 0; i <= n; i++) {
    const t = i / 3, x = b.x - b.vx * t * 1.5, y = b.y - b.vy * t * 1.5, rr = r * (1 - t * 0.3);
    if (pass === 0) { if (k > 0.3) disc(x + 0.5, y + 1, rr + 1, k > 0.55 ? '#6e2412' : '#a3301a'); }
    else if (pass === 1) disc(x, y, rr, k < 0.12 ? '#ffd23f' : k < 0.42 ? '#ff9a2e' : '#e8501e');
    else if (pass === 2) { if (k < 0.5) disc(x - rr * 0.15, y + rr * 0.12, rr * 0.62, k < 0.22 ? '#fff1a0' : '#ffc23a'); }
    else if (k < 0.24) disc(x - rr * 0.1, y + rr * 0.1, rr * 0.36, '#ffffff');
  }
  if (pass === 1 && k > 0.18 && hsh(b.seed + G.t * 0.37) > 0.4) disc(b.x + (hsh(b.seed * 9 + G.t) - 0.5) * r, b.y - r * 0.85, r * 0.45, k < 0.42 ? '#ff9a2e' : '#e8501e');
}
const noDraw = () => {};

// flash frame 0..3 after the shot at G.t = t0 (a flash with no shot of ours behind it, e.g. a menu pose: frame 0)
const flashStep = t0 => G.t - t0 >= 0 && G.t - t0 <= 3 ? G.t - t0 : 0;
// muzzle / ejection point in the world for the hero's current aim (local x, y standing, facing right)
const worldPt = (p, x, y) => [p.x + x * p.facing, p.y + y + (p.crouch ? 8 : 0)];

// ============================================================
// S: pump shotgun (dark steel barrel, wooden pump and stock)
// ============================================================
// pump offset by frames since the shot: slides back, holds, comes forward
const PUMP = [0, 0, 0, 0, 1, 2, 3, 3, 3, 2, 1, 1];
function paintShotgun(aim, pp) {
  const rs = [
    // receiver
    [-1, -4, 8, 5, 'B'], [-1, -4, 8, 1, 'D'], [-1, -3, 8, 1, 'C'], [0, -4, 2, 1, 'w'], [-1, 0, 8, 1, 'A'], [2, -2, 3, 1, 'A'],
    // ventilated rib, barrel, bead
    [7, -3, 10, 1, 'B'], [7, -2, 11, 1, 'D'], [7, -1, 11, 1, 'C'], [9, -2, 3, 1, 'w'], [17, -3, 1, 3, 'A'], [16, -4, 1, 1, 'w'],
    // magazine tube
    [7, 0, 9, 1, 'A'], [15, 0, 1, 1, 'D'],
    // trigger guard + trigger
    [3, 1, 1, 1, 'k'], [3, 2, 3, 1, 'k'], [5, 1, 1, 1, 'k'], [4, 1, 1, 1, 'C'],
    // pump (wood), slides back by pp
    [9 - pp, 0, 7, 3, 'O'], [9 - pp, 0, 7, 1, 'y'], [9 - pp, 2, 7, 1, 'o'], [11 - pp, 1, 1, 1, 'b'], [13 - pp, 1, 1, 1, 'b']
  ];
  // grip + stock tucked under the arm (only a short grip when aiming up or down)
  if (aim === 'fwd') rs.push([-3, 1, 3, 2, 'o'], [-3, 1, 3, 1, 'O'], [-8, 2, 6, 2, 'o'], [-8, 2, 6, 1, 'O'], [-7, 3, 5, 1, 'b'], [-9, 1, 1, 4, 'b']);
  else rs.push([-2, 1, 2, 2, 'o'], [-2, 1, 2, 1, 'O']);
  return rs;
}
const SG = kit(paintShotgun, 4, { fwd: [4, 3], up: [7, -4], down: [2, 9] }, [18, -1]);

function pelletUpd(b) {
  b.age++;
  b.vx *= 0.955; b.vy *= 0.955;
}
function pelletDraw(b) {
  const k = b.age / b.max, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
  ctx.globalAlpha = Math.min(1, (1 - k) * 3.5);
  // hot streak behind the pellet, shorter as it slows down
  const tl = Math.round(sp * 1.5 * (1 - k * 0.5));
  for (let i = 1; i <= tl; i++) R(Math.round(b.x - ux * i), Math.round(b.y - uy * i), 1, 1, i <= 2 ? '#fff1a0' : i <= 5 ? '#ffc23a' : '#ff8c2e');
  const big = k < 0.6, x = Math.round(b.x), y = Math.round(b.y);
  if (big) { R(x - 1, y - 1, 2, 2, '#ffd23f'); R(x - 1, y - 1, 1, 1, '#ffffff'); } else R(x, y, 1, 1, '#ffb52e');
  ctx.globalAlpha = 1;
}
// red shell with a brass base, flipping out of the gun when the pump goes back
const SHELL = pixSprite([[0, 0, 3, 2, 'R'], [0, 0, 3, 1, 'e'], [3, 0, 1, 2, 'P']]);
function ejectShell() {
  const p = G.p;
  if (!p || p.dead || p.ride) return;
  // it drops out under the receiver and tumbles away from the hero's face (forward when aiming up)
  const up = p.aim === 'up', [x, y] = up ? worldPt(p, 10, -30) : p.aim === 'down' ? worldPt(p, -1, -8) : worldPt(p, 6, -17);
  G.parts.push({ type: 'sprite', s: SHELL, x, y, vx: p.facing * (up ? rand(0.6, 1.2) : -rand(0.9, 1.5)), vy: -(up ? rand(1.5, 2.2) : rand(0.6, 1.1)), g: 0.2, rot: 0, vr: -p.facing * rand(0.25, 0.4), life: 55, max: 55 });
  Snd.tone('square', 1500, 900, 0.025, 0.05); Snd.noise(0.03, 0.12, 5000);
}

WEAPONS.shotgun = {
  label: 'SHOTGUN', ammo: 30, maxAmmo: 60, cd: 24, tapCd: 10,
  muzzle: aim => SG.muzzle[aim],
  fire(p, mx, my, dx, dy) {
    fxHost();
    const a0 = Math.atan2(dy, dx);
    for (let i = -2; i <= 2; i++) {
      const a = a0 + i * 0.125 + rand(-0.025, 0.025), sp = rand(7.2, 7.9);
      G.pb.push({ x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: 2, life: 17, max: 17, age: 0, update: pelletUpd, draw: pelletDraw });
    }
    // a cone of fire out of the barrel, sparks and a little kick now; the blast smoke billows out as the flash dies down
    const fx = mx + dx * 6, fy = my;
    for (let i = 0; i < 7; i++) {
      const a = a0 + rand(-0.3, 0.3), sp = rand(2.6, 5.2);
      burst(fx, fy, Math.cos(a) * sp, Math.sin(a) * sp, rand(1.6, 2.4), rand(2.5, 4), rand(8, 12) | 0, i < 3);
    }
    for (let i = 0; i < 6; i++) G.parts.push({ type: 'spark', x: fx, y: fy, vx: (dx || rand(-1, 1)) * rand(1.5, 3.4) + rand(-0.4, 0.4), vy: (dy || rand(-1, 1)) * rand(1.5, 3.4) + rand(-0.9, 0.5), g: 0.12, life: rand(6, 12) | 0, max: 12, size: 1, c: i % 2 ? '#ffe066' : '#ffffff' });
    later(3, () => {
      for (let i = 0; i < 4; i++) {
        const d = rand(4, 14), s = rand(-1, 1);
        puff(fx + dx * d - dy * s * 3, fy + dy * d + dx * s * 3, dx * rand(0.4, 1.1) - dy * s * 0.4, dy * rand(0.4, 1.1) + dx * s * 0.4 - 0.2, rand(1.8, 2.8), rand(2.5, 4), rand(20, 30) | 0, 'blast');
      }
    });
    G.shake = Math.max(G.shake, 1.4);
    pumpT = G.t;
    later(7, ejectShell);
    Snd.noise(0.32, 0.27, 1300); Snd.tone('sine', 160, 45, 0.28, 0.25); Snd.tone('square', 110, 55, 0.1, 0.06);
    Snd.noise(0.04, 0.12, 4500, 0.2); Snd.tone('square', 1100, 700, 0.03, 0.05, 0.2);
  },
  drawGun(aim, ty, r) {
    const s = G.t - pumpT, pp = s >= 0 && s < PUMP.length ? PUMP[s] : 0;
    const [x, y] = drawKit(SG, aim, ty, r, pp);
    if (aim === 'fwd') hand(x, y); else if (aim === 'up') hand(x - 3, y - 1); else hand(x - 2, y - 1);
  },
  flash(x, y, aim) {
    const s = flashStep(pumpT);
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin(aim));
    if (s === 0) {
      for (const [rx, ry, w, h] of [[0, -3, 9, 7], [2, -5, 5, 11], [9, -2, 4, 5], [13, -1, 3, 3]]) R(rx, ry, w, h, '#ff9a2e');
      for (const [rx, ry, w, h] of [[0, -2, 9, 5], [2, -4, 4, 9], [9, -1, 3, 3]]) R(rx, ry, w, h, '#ffd23f');
      R(0, -1, 7, 3, '#ffffff'); R(2, -2, 3, 5, '#ffffff');
      for (const [rx, ry] of [[17, 0], [7, -7], [7, 7], [12, -5], [12, 5]]) R(rx, ry, 1, 1, '#ffe066');
    } else if (s === 1) {
      for (const [rx, ry, w, h] of [[0, -2, 8, 5], [2, -4, 4, 9], [8, -1, 4, 3]]) R(rx, ry, w, h, '#ff8c2e');
      R(0, -1, 7, 3, '#ffd23f'); R(2, -3, 3, 7, '#ffd23f'); R(1, -1, 3, 3, '#fff6c2');
    } else if (s === 2) {
      R(1, -2, 6, 5, '#e2562a'); R(2, -1, 3, 3, '#ff9a2e');
    } else R(1, -1, 3, 3, '#e2562a');
    ctx.restore();
  },
  icon(x, y) { spr(SG_ICON, x, y); }
};
const SG_ICON = pixSprite([
  [0, 2, 4, 3, 'o'], [0, 2, 4, 1, 'O'], [4, 1, 4, 3, 's'], [4, 1, 4, 1, 'l'], [8, 1, 10, 2, 's'], [8, 1, 10, 1, 'l'],
  [10, 3, 5, 2, 'O'], [10, 3, 5, 1, 'y']
]);

// ============================================================
// R: rocket launcher (olive tube on the shoulder, a sight, the red tip of the loaded rocket)
// ============================================================
const RL_BACK = { fwd: -13, up: -5, down: -5 };
function paintLauncher(aim, loaded) {
  const back = RL_BACK[aim], rs = [
    // tube with a seam and the yellow band
    [back, -3, 24 - back, 5, 'G'], [back, -3, 24 - back, 1, 'H'], [back, -2, 24 - back, 1, 'h'], [back, 1, 24 - back, 1, 'g'],
    [-6, -3, 1, 5, 'g'], [7, -3, 2, 5, 'Y'], [7, 1, 2, 1, 'Z'],
    // flared rear end and the front ring
    [back - 3, -4, 3, 7, 'd'], [back - 3, -3, 1, 5, 'a'], [back - 2, -4, 2, 1, 's'], [11, -4, 2, 7, 'd'], [11, -4, 2, 1, 's'],
    // grips
    [-1, 2, 2, 3, 'a'], [5, 2, 2, 2, 'd']
  ];
  // the sight sits on top (beside the face when aiming up: left out there)
  if (aim !== 'up') rs.push([-1, -7, 5, 3, 'd'], [-1, -7, 5, 1, 's'], [3, -6, 1, 1, 'c'], [-1, -6, 1, 1, 'a'], [1, -4, 1, 1, 'a']);
  if (loaded) rs.push([13, -2, 3, 3, 'R'], [16, -1, 1, 1, 'R'], [13, -2, 3, 1, 'e'], [14, -2, 1, 1, 'E'], [13, 0, 3, 1, 'r']);
  return rs;
}
const RL = kit(paintLauncher, 2, { fwd: [4, 3], up: [7, -8], down: [2, 12] }, [17, -1]);
// muzzle to the rear end of the tube, per aim (the back-blast)
const RL_LEN = { fwd: 17 - (RL_BACK.fwd - 3), up: 17 - (RL_BACK.up - 3), down: 17 - (RL_BACK.down - 3) };
// rear end of the tube (the back-blast), hero-local standing, per aim
const RL_REAR = {};
for (const aim of AIMS) { const [x, y] = turnPt(RL_BACK[aim] - 4, -1, aim); RL_REAR[aim] = [RL.anchor[aim][0] + x, -21 + RL.anchor[aim][1] + y]; }

// the rocket in flight: painted pointing right around its centre, turned to 32 directions (nearest pixel), outlined
const ROCKET_RECTS = [
  [-5, -1, 8, 3, 'G'], [-5, -1, 8, 1, 'H'], [-5, 1, 8, 1, 'g'], [0, -1, 1, 3, 'Y'],
  [3, -1, 3, 3, 'R'], [3, -1, 3, 1, 'e'], [3, 1, 3, 1, 'r'], [6, 0, 1, 1, 'R'],
  [-6, -3, 2, 2, 'g'], [-6, 2, 2, 2, 'g'], [-7, -1, 1, 3, 'd']
];
const ROCKET_ROT = [];
{
  const N = 32, D = 19, c = (D - 1) / 2, src = {};
  for (const [x, y, w, h, l] of ROCKET_RECTS) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) src[i + ',' + j] = l;
  for (let n = 0; n < N; n++) {
    const a = n / N * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const g = Array.from({ length: D }, () => Array(D).fill('.'));
    for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
      const dx = i - c, dy = j - c, sx = Math.round(dx * ca + dy * sa), sy = Math.round(-dx * sa + dy * ca);
      const l = src[sx + ',' + sy];
      if (l) g[j][i] = l;
    }
    ROCKET_ROT.push({ ...makeSprite(outline(g), PAL), c });
  }
}

function rocketTarget(b) {
  let best = null, bd = 220;
  for (const e of G.enemies) {
    if (!e.active || e.dead || e.dying || e.inv || e.state === 'dying' || e.state === 'intro') continue;
    const bx = ebox(e), cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2, dx = cx - b.x, dy = cy - b.y;
    if (dx * b.dx + dy * b.dy < 6) continue; // only what is ahead of the launch direction
    const d = Math.hypot(dx, dy);
    if (d < bd) { bd = d; best = [cx, cy]; }
  }
  return best;
}
function rocketBlast(b, x, y) { b.life = 0; blast(x, y, 26, 6, 'player'); }
function rocketUpd(b) {
  b.age++;
  b.sp = Math.min(7, b.sp + 0.24);
  // gentle homing: limited turn rate, never more than ~65 degrees off the launch direction (no U-turns)
  if (b.age > 3) {
    const t = rocketTarget(b);
    if (t) {
      let da = Math.atan2(t[1] - b.y, t[0] - b.x) - b.a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      b.a += clamp(da, -0.05, 0.05);
      let off = b.a - b.a0;
      while (off > Math.PI) off -= Math.PI * 2;
      while (off < -Math.PI) off += Math.PI * 2;
      b.a = b.a0 + clamp(off, -1.15, 1.15);
    }
  }
  b.vx = Math.cos(b.a) * b.sp; b.vy = Math.sin(b.a) * b.sp;
  // a shootable enemy projectile close by sets it off
  for (const s of G.eb) {
    if ((s.shoot || (EB_TYPES[s.k] && EB_TYPES[s.k].shootable)) && Math.hypot(s.x - b.x, s.y - b.y) < 9) { s.life = 0; rocketBlast(b, b.x, b.y); return; }
  }
  // puffy smoke trail (two puffs per frame so it stays unbroken at full speed) and exhaust sparks
  const ca = Math.cos(b.a), sa = Math.sin(b.a), tx = b.x - ca * 9, ty = b.y - sa * 9;
  for (let i = 0; i < 2 && b.age > 3; i++) {
    const d = i * b.sp * 0.5;
    puff(tx - ca * d + rand(-0.6, 0.6), ty - sa * d + rand(-0.6, 0.6), -ca * 0.3 + rand(-0.12, 0.12), -sa * 0.3 + rand(-0.2, 0.05), rand(1.4, 2.1), rand(2.4, 3.4), rand(18, 26) | 0, 'trail');
  }
  if (b.age % 3 === 0) G.parts.push({ type: 'spark', x: tx, y: ty, vx: -ca * rand(0.5, 1.2) + rand(-0.4, 0.4), vy: -sa * rand(0.5, 1.2) + rand(-0.4, 0.4), g: 0.05, life: rand(5, 9) | 0, max: 9, size: 1, c: '#ffb52e' });
}
function rocketDraw(b) {
  const ca = Math.cos(b.a), sa = Math.sin(b.a), f = (G.t + b.seed) % 4;
  // flickering exhaust flame behind the fins
  const L = [3, 5, 4, 6][f];
  for (let i = 0; i < L; i++) {
    const d = 8 + i, w = i < 2 ? 3 : i < 4 ? 2 : 1;
    R(Math.round(b.x - ca * d - w / 2), Math.round(b.y - sa * d - w / 2), w, w, i < 1 ? '#ffffff' : i < 3 ? '#ffe066' : '#ff8c2e');
  }
  const s = ROCKET_ROT[((Math.round(b.a / (Math.PI * 2) * 32) % 32) + 32) % 32];
  ctx.drawImage(s.img, Math.round(b.x - s.c), Math.round(b.y - s.c));
}

WEAPONS.rocket = {
  label: 'ROCKETS', ammo: 30, maxAmmo: 60, cd: 30, tapCd: 6,
  muzzle: aim => RL.muzzle[aim],
  fire(p, mx, my, dx, dy) {
    fxHost();
    const a = Math.atan2(dy, dx);
    G.pb.push({ x: mx, y: my, vx: dx * 2.5, vy: dy * 2.5, dmg: 6, life: 150, age: 0, sp: 2.5, a, a0: a, dx, dy, seed: G.t,
      update: rocketUpd, draw: rocketDraw,
      onHit: b => rocketBlast(b, b.x, b.y),
      onGround: b => rocketBlast(b, b.x, Math.min(b.y, groundAt(b.x)) - 3),
      onProp: b => rocketBlast(b, b.x, b.y),
      onPow: (b, o) => { freePow(o); rocketBlast(b, b.x, b.y); } });
    // back-blast: a cone of fire out of the rear of the tube (the flash), then a cloud of smoke rolling out of it.
    // Shooting down in a jump the rear end is at the hero's shoulder: only a little smoke, vented back, away from the face.
    if (dy > 0) {
      const [sx, sy] = worldPt(p, -7, -19);
      for (let i = 0; i < 4; i++) puff(sx, sy + rand(-2, 2), -p.facing * rand(0.8, 1.8), rand(-0.8, 0), rand(1.8, 2.6), rand(3, 4.5), rand(22, 32) | 0, 'blast');
    }
    // (aiming up it blows down and a little forward, clear of the hero's legs)
    const [rx, ry] = worldPt(p, RL_REAR[p.aim][0], RL_REAR[p.aim][1]), bx = dx ? -p.facing : dy < 0 ? p.facing * 0.45 : 0, by = dy < 0 ? 0.9 : -dy;
    for (let i = 0; i < 5 && dy <= 0; i++) {
      const sd = rand(-1, 1);
      burst(rx, ry, bx * rand(1.8, 3.8) - by * sd * 0.8, by * rand(1.8, 3.8) + bx * sd * 0.8, rand(1.8, 2.6), rand(2, 3.5), rand(7, 11) | 0, i < 2);
    }
    if (dy <= 0) later(2, () => {
      for (let i = 0; i < 6; i++) {
        const sd = rand(-1, 1);
        puff(rx + bx * rand(2, 12) - by * sd * 2, ry + by * rand(2, 12) + bx * sd * 2, bx * rand(1, 2.6) - by * sd * 0.6, by * rand(1, 2.6) + bx * sd * 0.6 - 0.15, rand(2.2, 3.4), rand(4, 6), rand(26, 40) | 0, 'blast');
      }
    });
    rocketT = G.t;
    Snd.noise(0.55, 0.3, 2600); Snd.tone('sawtooth', 150, 480, 0.32, 0.05); Snd.tone('sine', 130, 55, 0.18, 0.28);
  },
  drawGun(aim, ty, r) {
    const [x, y] = drawKit(RL, aim, ty, r, G.t - rocketT > 16 ? 1 : 0);
    if (aim === 'fwd') hand(x - 1, y + 2); else if (aim === 'up') hand(x + 2, y + 1); else hand(x + 2, y - 2);
  },
  flash(x, y, aim) {
    const s = flashStep(rocketT), L = RL_LEN[aim];
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin(aim));
    // small flash at the mouth of the tube
    if (s < 2) { R(0, -2, 3, 5, '#ffb52e'); R(0, -1, 4, 3, '#ffe066'); R(0, 0, 2, 1, '#ffffff'); }
    // back-blast: a cone of fire flaring out of the rear end, shorter every frame (none when shooting down)
    const n = aim === 'down' ? 0 : [15, 11, 7, 4][s];
    for (let d = 0; d < n; d++) {
      const h = Math.min(5, 1 + (d * 0.42 | 0)) - (d > n - 3 ? 1 : 0), cx = -L - 1 - d;
      R(cx, -h, 1, h * 2 + 1, '#ff8c2e');
      if (d < n - 3 && h > 1) R(cx, -h + 1, 1, h * 2 - 1, '#ffd23f');
      if (d < n * 0.4) R(cx, -1, 1, 3, '#fffbe6');
    }
    ctx.restore();
  },
  icon(x, y) { spr(RL_ICON, x, y); }
};
const RL_ICON = pixSprite([
  [0, 1, 2, 5, 'd'], [2, 2, 12, 3, 'G'], [2, 2, 12, 1, 'H'], [2, 4, 12, 1, 'g'], [10, 2, 1, 3, 'Y'], [14, 1, 2, 5, 'd'],
  [16, 2, 2, 3, 'R'], [16, 2, 2, 1, 'e'], [5, 0, 3, 1, 'd']
]);

// ============================================================
// F: flame shot (fuel tank, perforated barrel jacket, copper nozzle with a pilot light)
// ============================================================
function paintFlamer() {
  return [
    // body with a red valve
    [-2, -3, 11, 4, 's'], [-2, -3, 11, 1, 'l'], [-1, -3, 2, 1, 'w'], [-2, 0, 11, 1, 'd'], [4, -4, 1, 1, 'd'], [3, -6, 3, 2, 'R'], [3, -6, 3, 1, 'e'],
    // perforated jacket and the flared copper nozzle
    [9, -3, 7, 4, 'd'], [9, -3, 7, 1, 's'], [10, -2, 1, 1, 'a'], [12, -2, 1, 1, 'a'], [14, -2, 1, 1, 'a'], [11, -1, 1, 1, 'a'], [13, -1, 1, 1, 'a'],
    [16, -4, 3, 6, 'P'], [16, -4, 3, 1, 'q'], [16, 1, 3, 1, 'p'], [18, -2, 1, 2, 'p'],
    // fuel tank with two straps and a little flame sign
    [3, 1, 10, 4, 'R'], [3, 1, 10, 1, 'e'], [4, 1, 3, 1, 'E'], [3, 4, 10, 1, 'r'], [2, 2, 1, 2, 'r'], [13, 2, 1, 2, 'r'],
    [5, 1, 1, 4, 'd'], [11, 1, 1, 4, 'd'], [8, 2, 1, 2, 'Y'], [7, 3, 1, 1, 'Y'], [9, 3, 1, 1, 'q'],
    // grip
    [-1, 1, 2, 3, 'a']
  ];
}
const FL = kit(paintFlamer, 1, { fwd: [4, 3], up: [7, -4], down: [2, 9] }, [20, -1]);

// a puff of flame: grows, slows down, rises and cools from white-yellow to orange to red to grey smoke (drawn by
// flamesDraw with all the others). It burns each enemy for 1 damage at most every BURN_CD frames.
const BURN_CD = 5;
function burn(e) {
  if (G.t - (e.flameHitT == null ? -99 : e.flameHitT) < BURN_CD) return;
  e.flameHitT = G.t;
  if (damageEnemy(e, 1)) { const b = ebox(e); sparks(b.x + b.w / 2 + rand(-4, 4), b.y + rand(2, b.h * 0.6), 3, '#ffb52e'); }
}
function flameUpd(b) {
  b.age++;
  const k = b.age / b.max;
  b.vx *= 0.93; b.vy = b.vy * 0.93 - 0.05;
  b.r = 2.2 + k * 7;
  // cooled down: it drifts on as a puff of soot (no longer a bullet)
  if (k >= 0.76) { puff(b.x, b.y, b.vx, b.vy - 0.2, b.r * 0.75, 3, 28, 'soot'); b.life = 0; return; }
  for (const e of G.enemies) {
    if (!e.active || e.dead || e.dying || e.state === 'dying') continue;
    if (distToBox(b.x, b.y, ebox(e)) < b.r * 0.55) burn(e);
  }
  // embers
  if (b.age % 5 === 2 && G.parts.length < 600) G.parts.push({ type: 'spark', x: b.x + rand(-b.r, b.r) * 0.7, y: b.y + rand(-b.r, b.r * 0.4) * 0.7, vx: b.vx * 0.4 + rand(-0.3, 0.3), vy: rand(-1.2, -0.4), g: 0.02, life: rand(8, 16) | 0, max: 16, size: 1, c: k < 0.4 ? '#ffe066' : '#ff8c2e' });
}
// flames pass through enemies, props (burning them a little) and cages (freeing them); the ground puts them out
function flameHit(b, e) { burn(e); }
function flameProp(b, o) {
  if (G.t - (o.flameHitT == null ? -99 : o.flameHitT) >= 8) { o.flameHitT = G.t; hitProp(o, 1, 'bullet'); }
  return true;
}
function flamePow(b, o) { freePow(o); return true; }
function flameGround(b) { if (G.parts.length < 600) G.parts.push({ type: 'fire', x: b.x, y: groundAt(b.x) - 2, vx: b.vx * 0.3, vy: -0.4, life: 12, max: 16, size: Math.min(4, b.r) }); }

WEAPONS.flame = {
  label: 'FLAME', ammo: 240, maxAmmo: 300, cd: 3, tapCd: 3,
  muzzle: aim => FL.muzzle[aim],
  fire(p, mx, my, dx, dy) {
    // two puffs per shot (the second one a frame and a half further on), so the stream stays unbroken
    fxHost();
    for (let i = 0; i < 2; i++) {
      const a = Math.atan2(dy, dx) + rand(-0.07, 0.07), sp = rand(6.0, 6.8), vx = Math.cos(a) * sp + p.vx * 0.5, vy = Math.sin(a) * sp;
      G.pb.push({ x: mx + dx * 5 + vx * i * 1.5, y: my + vy * i * 1.5, vx, vy, dmg: 1, life: 30, max: 30, age: i, r: 2.2, flame: true, pierce: true, seed: G.t * 2 + i,
        update: flameUpd, draw: noDraw, onHit: flameHit, onProp: flameProp, onPow: flamePow, onGround: flameGround });
    }
    if (G.t - flameT > 12) { Snd.noise(0.35, 0.2, 700); Snd.tone('sine', 95, 60, 0.25, 0.16); Snd.noise(0.3, 0.15, 2000); }
    if (G.t - hissT >= 6) { hissT = G.t; Snd.noise(0.3, 0.25, 1500); }
    flameT = G.t;
  },
  drawGun(aim, ty, r) {
    const [x, y] = drawKit(FL, aim, ty, r);
    if (aim === 'fwd') hand(x, y + 1); else if (aim === 'up') hand(x + 1, y + 1); else hand(x + 1, y - 2);
    // pilot light under the nozzle tip
    const f = G.t % 6 < 3, [px, py] = turnPt(19, 2, aim), X = x + px, Y = y + py;
    R(X, Y, 1, 2, '#5ab8ff'); R(X, Y - (f ? 1 : 0), 1, 1, f ? '#ffe066' : '#bfe6ff');
  },
  flash(x, y, aim) {
    // the jet: a flickering cone of fire out of the nozzle, white-hot at its root
    const f = G.t % 3, g = (G.t >> 1) % 2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin(aim));
    R(0, -2, 4, 5, '#ff8c2e'); R(4, -3, 8 + f, 7, '#ff8c2e'); R(11 + f, -2, 4, 5, '#ff8c2e');
    R(6 + g * 3, -4, 3, 1, '#ff8c2e'); R(9 - g * 2, 4, 3, 1, '#ff8c2e');
    R(0, -1, 5, 3, '#ffd23f'); R(5, -2, 7 + f, 5, '#ffd23f');
    R(0, -1, 4, 2, '#ffffff'); R(4, -1, 5, 2, '#fff6d0'); R(9, 0, 3, 1, '#fff6d0');
    ctx.restore();
  },
  icon(x, y) {
    spr(FL_ICON, x, y);
    const f = G.t % 8 < 4;
    R(x + 18, y + 1, 2, 3, '#ff8c2e'); R(x + 18, y + 2, f ? 2 : 1, 1, '#ffe066');
  }
};
const FL_ICON = pixSprite([
  [0, 1, 8, 3, 's'], [0, 1, 8, 1, 'l'], [8, 1, 6, 3, 'd'], [9, 2, 1, 1, 'a'], [11, 2, 1, 1, 'a'], [14, 1, 3, 3, 'P'], [14, 1, 3, 1, 'q'],
  [3, 4, 8, 3, 'R'], [3, 4, 8, 1, 'e'], [3, 6, 8, 1, 'r']
]);

// ============================================================
// Pickups: weapon crates, cherries, chestnuts
// ============================================================
ITEMS.S = {
  draw: it => letterBox(it, '#d63a2f', '#ff9282', '#ffffff'),
  collect(it, p) { giveWeapon(p, 'shotgun'); G.texts.push({ x: it.x, y: it.y - 24, s: 'SHOTGUN!', t: 80, c: '#ffe066' }); say('Shotgun!', 0.7, 1); }
};
ITEMS.R = {
  draw: it => letterBox(it, '#2f7d32', '#7ccf72', '#ffe066'),
  collect(it, p) { giveWeapon(p, 'rocket'); G.texts.push({ x: it.x, y: it.y - 24, s: 'ROCKET LAUNCHER!', t: 80, c: '#ffe066' }); say('Rocket launcher!', 0.7, 1); }
};
ITEMS.F = {
  draw: it => letterBox(it, '#e8781e', '#ffc078', '#ffffff'),
  collect(it, p) { giveWeapon(p, 'flame'); G.texts.push({ x: it.x, y: it.y - 24, s: 'FLAME SHOT!', t: 80, c: '#ffe066' }); say('Flame shot!', 0.7, 1); }
};

// soft shadow on the ground under a pickup (narrower while it bobs up)
function shadow(x, y, w) {
  ctx.fillStyle = 'rgba(20,16,30,0.25)';
  ctx.fillRect(x - (w >> 1) + 1, y - 1, w - 2, 1); ctx.fillRect(x - (w >> 1), y, w, 1);
}
// two shiny cherries on green stems with a leaf
const CHERRY = (() => {
  const rs = [];
  const ball = (cx, cy) => {
    for (const [x, y, w] of [[cx - 1, cy - 2, 3], [cx - 2, cy - 1, 5], [cx - 2, cy, 5], [cx - 2, cy + 1, 5], [cx - 1, cy + 2, 3]]) rs.push([x, y, w, 1, 'R']);
    rs.push([cx + 1, cy, 1, 2, 'r'], [cx - 1, cy + 2, 3, 1, 'r'], [cx, cy + 1, 1, 1, 'r'], [cx - 1, cy - 1, 1, 1, 'e'], [cx - 1, cy - 2, 2, 1, 'e'], [cx - 2, cy - 1, 1, 1, 'e'], [cx - 1, cy - 1, 1, 1, 'n']);
  };
  ball(-3, -3); ball(3, -4);
  // stems (thin, no outline) and the leaf
  for (const [x, y] of [[-3, -6], [-2, -7], [-2, -8], [-1, -9], [0, -10], [3, -7], [2, -8], [2, -9], [1, -10], [0, -11]]) rs.push([x, y, 1, 1, 'v']);
  rs.push([1, -13, 3, 1, 'L'], [0, -12, 5, 1, 'L'], [1, -12, 3, 1, 'M'], [2, -11, 3, 1, 'L'], [4, -12, 1, 1, 'L']);
  return pixSprite(rs, true);
})();
ITEMS.cherry = {
  draw(it) {
    const x = Math.round(it.x), y = Math.round(it.y), bob = it.onGround ? Math.round(Math.sin(it.t * 0.1) * 1.5 - 1.5) : 0;
    if (it.onGround) shadow(x, y, 9 + bob);
    spr(CHERRY, x + CHERRY.ox, y - 1 + bob + CHERRY.oy);
    if (it.t % 50 < 5) R(x - 5, y - 6 + bob, 1, 1, '#ffffff');
  },
  collect(it, p) {
    if (p.hearts < 3) { p.hearts++; G.texts.push({ x: it.x, y: it.y - 24, s: '+1 HEART', t: 70, c: '#ff8a9a' }); }
    else addScore(300, it.x, it.y - 20);
  }
};

// a glossy chestnut: pointed tip with a pale tuft, round shoulders, the wide cream scar at its base
const CHESTNUT = makeSprite([
  '......k......',
  '.....kyk.....',
  '....kuyuk....',
  '...kuUTuuk...',
  '..kuUTnTuuk..',
  '.kuUTTUuuutk.',
  '.kuUUuuuuutk.',
  'kuuuuuuuuuttk',
  'kuuuuuuuuuttk',
  'kxxxxxxxxxxxk',
  '.kXxxxxxxxXk.',
  '..kkkkkkkkk..'
], { k: OUT, t: '#4a1f0e', u: '#7e3a17', U: '#a5532a', T: '#d48a52', n: '#fff1dc', x: '#efe0b6', X: '#c9ad78', y: '#e9d39a' });
ITEMS.chestnut = {
  draw(it) {
    const x = Math.round(it.x), y = Math.round(it.y);
    if (it.onGround) shadow(x, y, 11);
    spr(CHESTNUT, x - 6, y - 12);
    if (it.t % 60 < 4) R(x - 3, y - 9, 1, 1, '#ffffff');
  },
  collect: it => addScore(300, it.x, it.y - 20)
};
}
