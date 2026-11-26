'use strict';
// ============================================================
// Mission 1 opening scene (5.5 s), the same kind of arrival as Mission 2's house and Mission 3's boat.
// Letterbox bars slide in over the jungle and a chunky yellow transport plane drones across the sky, the other
// hero at the controls. The jump light turns green, the hero steps into the door and leaps out with a somersault;
// the parachute (in the hero's colour) pops open, the hero swings down under it and lands on the mission's start
// spot with a thump and a puff of dust; the canopy sags, is caught by the wind and blows away to the left.
// "TIME TO RUMBLE!", MISSION 1 START! (said aloud), the area name, bars out. Enter skips to the banner.
//
// How it is built: the real player never moves. It waits hidden (G.p.hidden) on its normal start spot and is shown
// at touchdown, so nothing after the scene differs from a start without it. The plane, the parachute and the
// falling hero are painted by a private prop kind (PROP_TYPES.l1drop: world space, behind the foreground and the
// HUD, like Mission 3's boat); intro.draw() only adds the speech bubble, the bars and the caption.
// Nothing here uses rand(): the scene is the same every time and leaves the game's random numbers alone.
// ============================================================
{
const L = LEVELS[0];
L.startText = 'MISSION 1 START!'; L.startSay = 'Mission one, start!';   // also the band and voice of a continue

// Timeline (frames): the hero shows in the door, jumps, the chute opens, touchdown, speech bubble, banner, bars out
const IT = { peek: 30, green: 44, jump: 60, open: 84, land: 215, say: 230, go: 272, banner: 286, out: 300, end: 330 };
const BARS = 33;
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);

// ============================================================
// Load-time pixel painter (local coordinates, origin at ox, oy): shapes in palette letters, then a 1px outline
// ============================================================
function grid(w, h, ox, oy) {
  const g = [];
  for (let y = 0; y < h; y++) g.push(new Array(w).fill('.'));
  const at = (x, y) => { x += ox; y += oy; return x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : '.'; };
  const put = (x, y, c) => { x = Math.floor(x) + ox; y = Math.floor(y) + oy; if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; };
  const o = {
    w, h, ox, oy, at,
    p(x, y, c) { put(x, y, c); return o; },
    r(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) put(x + i, y + j, c); return o; },
    // ellipse; keep(x, y, cur) may veto a pixel
    e(cx, cy, rx, ry, c, keep) {
      for (let y = Math.floor(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx) - 1; x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1.04 && (!keep || keep(x, y, at(x, y)))) put(x, y, c);
      }
      return o;
    },
    // filled polygon (pixel centres inside)
    t(pts, c) {
      let y0 = Infinity, y1 = -Infinity;
      for (const q of pts) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
        const yc = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        xs.sort((m, n) => m - n);
        for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x + 0.5 <= xs[i + 1]; x++) put(x, y, c);
      }
      return o;
    },
    // every painted pixel: fn(x, y, cur) returns the new letter (or nothing to leave it)
    map(fn) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (g[y][x] === '.') continue;
        const c = fn(x - ox, y - oy, g[y][x]);
        if (c) g[y][x] = c;
      }
      return o;
    },
    // light where nothing is above (n rows deep), dark where nothing is below
    shade(c, lt, dk, n = 1) {
      const s = g.map(r => r.slice()), sat = (x, y) => x >= 0 && y >= 0 && x < w && y < h ? s[y][x] : '.';
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (s[y][x] !== c) continue;
        let top = false, bot = false;
        for (let i = 1; i <= n; i++) { if (sat(x, y - i) === '.') top = true; if (sat(x, y + i) === '.') bot = true; }
        if (lt && top) g[y][x] = lt; else if (dk && bot) g[y][x] = dk;
      }
      return o;
    },
    outline() {
      const s = g.map(r => r.slice()), sat = (x, y) => x >= 0 && y >= 0 && x < w && y < h ? s[y][x] : '.';
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (s[y][x] === '.' && (sat(x - 1, y) !== '.' || sat(x + 1, y) !== '.' || sat(x, y - 1) !== '.' || sat(x, y + 1) !== '.')) g[y][x] = 'k';
      }
      return o;
    },
    // another grid of the same size and origin laid over this one
    stamp(b) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = b.rows[y][x]; if (c !== '.') g[y][x] = c; } return o; },
    rows: g,
    sprite(pal) { return makeSprite(g.map(r => r.join('')), pal); }
  };
  return o;
}

// ============================================================
// The plane (faces right; local 0,0 = the middle of the fuselage). A fat yellow three-engined transport: red
// cheat line, cream belly, a big bubble cockpit, portholes, the jump door on the near side, a roundel on the fin.
// ============================================================
const PW = 150, PH = 66, POX = 78, POY = 35;
const PPAL = {
  k: OUT, y: '#f5c22e', Y: '#ffe27a', o: '#d99a1c', O: '#b27412', w: '#f4efe2', W: '#ffffff', g: '#cfc8b6', G: '#a8a192',
  r: '#d8402e', R: '#f47a5c', q: '#9c2a1e', c: '#8fd8f4', C: '#d8f6ff', b: '#4a9ed0', m: '#5a6474', M: '#8a97a8',
  n: '#1c2233', N: '#3b424d', u: '#3f7fd0'
};
const DOOR = { x: -40, y: -12, w: 14, h: 21 };      // the doorway (local)
const PROPS = [[61, 1, 14, 0], [17, 15, 11, 1.7]];  // spinning propellers in front: [x, axis y, radius, phase]
const FARPROP = [11, -21, 9, 0.9];                  // the far wing's, behind the fuselage
const PLANE = (() => {
  const part = () => grid(PW, PH, POX, POY);
  // far wing and its engine, in shade
  const far = part();
  far.t([[6, -12], [-22, -12], [-31, -24], [-7, -25]], 'o').shade('o', 'y', 'O');
  far.r(-16, -24, 22, 6, 'o').r(-16, -24, 22, 1, 'y').r(3, -25, 4, 8, 'm').r(3, -25, 4, 1, 'M').r(7, -22, 2, 3, 'q');
  far.outline();
  // fuselage and fin
  const f = part();
  f.t([[-67, -8], [-64, -27], [-60, -31], [-52, -31], [-38, -14]], 'y');
  f.t([[-67, -8], [-58, -12], [-40, -15], [-6, -17], [24, -16], [40, -13], [50, -8], [56, -2], [57, 3], [54, 9], [47, 13], [36, 16], [4, 17], [-22, 15], [-44, 8], [-67, -1]], 'y');
  f.shade('y', 'Y', null, 3);
  f.map((x, y, c) => {
    if (x >= 47) return y < -3 ? 'M' : y > 8 ? 'N' : 'm';                 // the nose engine's cowling
    if (x >= 45) return 'N';
    if (y <= -27) return 'r';                                             // fin tip
    if (y >= 7) return y >= 14 ? 'G' : y >= 11 ? 'g' : 'w';               // cream belly
    if (y >= 4) return 'r';                                               // cheat line
    if (y === 3) return 'W';
    if (y >= 0 && c === 'y') return 'o';
  });
  f.r(-61, -26, 1, 17, 'o');                                              // rudder hinge
  f.e(-53, -19, 5, 5, 'u').e(-53, -19, 3.2, 3.2, 'W').e(-53, -19, 1.5, 1.5, 'r');   // roundel
  // bubble cockpit: glass over the nose, its frame where it meets the fuselage
  f.e(31, -17, 13.5, 11, 'k', (x, y, c) => y <= -8 && c !== '.');
  f.e(31, -17, 12.5, 10, 'c', (x, y) => y <= -9);
  f.map((x, y, c) => { if (c === 'c') { if (y >= -11) return 'b'; if (x - y > 62 && x - y < 66) return 'C'; } });
  f.r(41, -22, 1, 13, 'N');
  // portholes
  for (const px of [9, -3, -15]) f.e(px, -6.5, 3.6, 3.6, 'O').e(px, -6.5, 2.6, 2.6, 'c').p(px - 2, -8, 'C').p(px - 1, -9, 'C').p(px + 1, -5, 'b');
  // the jump door: dark inside, a grab rail, the lamp socket
  f.r(DOOR.x - 1, DOOR.y - 1, DOOR.w + 2, DOOR.h + 2, 'k').r(DOOR.x, DOOR.y, DOOR.w, DOOR.h, 'n');
  f.r(DOOR.x, DOOR.y + DOOR.h - 3, DOOR.w, 3, 'N').r(DOOR.x + DOOR.w - 1, DOOR.y + 2, 1, DOOR.h - 5, 'M');
  f.r(-24, -13, 4, 4, 'k');
  // red spinner on the nose
  f.e(59.5, 1.5, 2.6, 3.4, 'r').p(59, -1, 'R').p(60, 0, 'R');
  f.outline();
  // tailplane
  const tp = part();
  tp.t([[-46, -7], [-62, -8], [-73, 0], [-58, 1]], 'y').shade('y', 'Y', 'o');
  tp.map((x, y) => { if (x < -68) return 'r'; });
  tp.outline();
  // near wing, its engine and propeller hub
  const wing = part();
  wing.t([[10, 7], [-22, 9], [-29, 24], [-5, 25]], 'y').shade('y', 'Y', 'o', 2);
  wing.map((x, y) => { if (y >= 22) return y >= 24 ? 'q' : 'r'; });
  wing.outline();
  const eng = part();
  eng.r(-14, 11, 24, 8, 'y').r(-14, 11, 24, 2, 'Y').r(-14, 17, 24, 2, 'o').r(-15, 13, 1, 4, 'o');
  eng.r(8, 10, 5, 10, 'm').r(8, 10, 5, 2, 'M').r(8, 18, 5, 2, 'N').r(13, 13, 2, 4, 'r').p(13, 13, 'R');
  eng.outline();
  return far.stamp(f).stamp(tp).stamp(wing).stamp(eng).sprite(PPAL);
})();

// A propeller seen from the side: a faint disc and the blades, whose length flickers as they turn
function propeller(x, cy, r, ph, far) {
  ctx.fillStyle = far ? 'rgba(226,236,244,0.3)' : 'rgba(240,248,252,0.45)';
  for (let j = -r; j <= r; j++) { const a = Math.abs(j), w = a > r - 2 ? 1 : a > r * 0.55 ? 2 : 3; ctx.fillRect(x - (w >> 1), cy + j, w, 1); }
  const len = Math.max(2, Math.round(r * Math.abs(Math.cos(ph))));
  R(x, cy - len, 1, len * 2 + 1, far ? '#6a7382' : '#3b424d');
  R(x, cy - len, 1, 2, '#ffd23f'); R(x, cy + len - 1, 1, 2, '#ffd23f');
}

// ============================================================
// The scene. S is rebuilt by intro.start(); everything on screen is a function of S.t
// ============================================================
let S = null;
const SPEED = 2.4;
const planeX = t => S.lx + 3 + SPEED * (t - IT.jump) + (t > IT.jump ? 0.008 * (t - IT.jump) * (t - IT.jump) : 0);
const planeY = t => 68 + Math.sin(t * 0.07) * 1.5;
const HARN = 22, LINE = 28, TAU = 7;

function newScene(p) {
  const s = { t: 0, skipped: false, shown: false, p, prop: null, lx: p.x, ly: p.y };
  S = s;
  // the leap: out of the door (xj, yj), a short arc, falling at v0 when the chute opens at (xo, yo)
  const n = IT.open - IT.jump, d = IT.land - IT.open, k = TAU * (1 - Math.exp(-d / TAU));
  s.xj = planeX(IT.jump) - 33; s.yj = planeY(IT.jump) + 9;
  s.xo = s.xj + 1.3 * n - 0.02 * n * n; s.yo = s.yj - 2 * n + 0.14 * n * n; s.v0 = -2 + 0.28 * n;
  s.vt = (s.ly - s.yo - s.v0 * k) / (d - k);   // the steady sink that touches down exactly at IT.land
  return s;
}

// Where the falling hero's feet are at frame t (IT.jump..IT.land), the flip and the swing under the canopy
function heroAt(t) {
  if (t < IT.open) {
    const u = t - IT.jump;
    return { x: S.xj + 1.3 * u - 0.02 * u * u, y: S.yj - 2 * u + 0.14 * u * u, rot: Math.PI * 2 * ease(u / 20), dx: 0 };
  }
  const u = Math.min(t, IT.land) - IT.open, d = IT.land - IT.open, s = u / d;
  const dx = 11 * Math.min(1, u / 10) * Math.exp(-u / 110) * Math.min(1, (d - u) / 26) * Math.sin(u * Math.PI * 2 / 66);
  const xm = S.xo + (S.lx - S.xo) * (1 - (1 - s) * (1 - s) * (1 - s));
  const y = S.yo + S.vt * u + (S.v0 - S.vt) * TAU * (1 - Math.exp(-u / TAU));
  return { x: xm + dx, y: t >= IT.land ? S.ly : y, rot: 0, dx, xm };
}

// 1px line
function pline(x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  ctx.fillStyle = col;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1);
}

// The parachute: a round canopy of five gores seen from the side (hero colour, cream, hero colour...) that meet at
// the crown, with a scalloped hem. dome() lists it as rows of runs put(x, y, w, h, letter), x / y from the middle of
// the hem (y < 0 = up): rx / ry = half width and height, tilt = lean in px per row.
const GORE = [-1, -0.809, -0.309, 0.309, 0.809, 1];
const RX = 24, RY = 18;
const CHUTE = HEROES.map(h => ({ k: OUT, a: h.outD, b: h.out, c: h.outL, d: '#d8c8a8', e: '#fff4dc', f: '#ffffff' }));
const CORD = '#2a2a3a';
function dome(rx, ry, tilt, put) {
  const n = Math.max(1, Math.round(ry));
  const half = j => rx * Math.sqrt(Math.max(0, 1 - (j / (n + 0.5)) * (j / (n + 0.5))));
  const edge = (j, k) => Math.round(tilt * j + half(j) * GORE[k]);
  for (let j = 0; j <= n; j++) { const a = edge(j, 0), b = edge(j, 5); put(a - 1, -j - 1, b - a + 2, 3, 'k'); }
  for (let j = 0; j <= n; j++) {
    const lit = j > n * 0.6, low = j < 2;
    for (let k = 0; k < 5; k++) {
      const a = edge(j, k), b = edge(j, k + 1);
      if (b <= a) continue;
      const c = k % 2 ? (low ? 'd' : lit ? 'f' : 'e') : (low || k === 0 ? 'a' : lit || k === 4 ? 'c' : 'b');
      // the hem dips between the lines: only the ends of each gore reach the bottom row
      if (j === 0 && b - a > 5) { put(a, 0, 2, 1, c); put(b - 2, 0, 2, 1, c); } else put(a, -j, b - a, 1, c);
    }
  }
  if (n > 8 && rx > 12) { const j = Math.round(n * 0.78); put(edge(j, 2) + 2, -j, 3, 1, 'f'); put(edge(j - 1, 2) + 1, -j + 1, 1, 1, 'f'); }
}
// where line k (0..5) is tied to the hem
const tie = (rx, k) => Math.round(rx * GORE[k]);
// the open canopy, drawn live (it changes shape as it fills and leans as the hero swings); to = the two shoulders
function chute(cx, sy, rx, ry, tilt, to) {
  const pal = CHUTE[G.hero];
  cx = Math.round(cx); sy = Math.round(sy);
  for (let k = 0; k <= 5; k++) { const b = to[k < 3 ? 0 : 1]; pline(cx + tie(rx, k), sy + 1, b[0], b[1], CORD); }
  dome(rx, ry, tilt, (x, y, w, h, c) => R(cx + x, sy + y, w, h, pal[c]));
}
// the full canopy as a sprite per hero, for when it falls over: turned by a, squeezed to kx / ky
const DOX = RX + 2, DOY = RY + 3;
const DOME = CHUTE.map(pal => {
  const g = grid(DOX * 2 + 1, DOY + 3, DOX, DOY);
  dome(RX, RY, 0, (x, y, w, h, c) => g.r(x, y, w, h, c));
  return g.sprite(pal);
});
function fallen(cx, sy, a, kx, ky, to) {
  const co = Math.cos(a), si = Math.sin(a);
  for (let k = 0; k <= 5; k++) {
    const x = tie(RX, k) * kx, y = ky, b = to[k < 3 ? 0 : 1];
    pline(cx + x * co - y * si, sy + x * si + y * co, b[0], b[1], CORD);
  }
  ctx.save(); ctx.translate(Math.round(cx), Math.round(sy)); ctx.rotate(a); ctx.scale(kx, ky);
  ctx.drawImage(DOME[G.hero].img, -DOX, -DOY);
  ctx.restore();
}

// White puffs left behind by an engine at local (ex, ey)
function trail(t, ex, ey, a0) {
  for (let i = 0; i < 7; i++) {
    const age = t % 6 + i * 6, te = t - age;
    if (te < 0 || age < 3) continue;
    const a = a0 * (1 - age / 44);
    if (a <= 0.02) continue;
    ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
    circ(Math.round(planeX(te) + ex), Math.round(planeY(te) + ey + age * 0.06 + Math.sin(te * 0.7) * 1.2), 1.6 + age * 0.07);
  }
}

function drawPlane(t) {
  const px = Math.round(planeX(t)), py = Math.round(planeY(t));
  if (px - 80 > G.cam.x + W || px + 70 < G.cam.x) return;
  const h = HEROES[G.hero], pilot = HEROES[1 - G.hero];
  trail(t, -18, -21, 0.3); trail(t, -18, 15, 0.5);
  propeller(px + FARPROP[0], py + FARPROP[1], FARPROP[2], t * 1.37 + FARPROP[3], true);
  spr(PLANE, px - POX, py - POY);
  // the other hero flies the plane
  ctx.save(); ctx.beginPath(); ctx.rect(px + 19, py - 27, 22, 18); ctx.clip();
  spr(pilot.head, px + 24, py - 9 - pilot.head.h + (t % 50 < 6 ? 1 : 0));
  ctx.restore();
  R(px + 35, py - 25, 3, 1, '#ffffff'); R(px + 38, py - 24, 2, 1, '#ffffff'); R(px + 22, py - 20, 1, 3, '#d8f6ff');
  // the jump lamp: red, then green
  const green = t >= IT.green;
  R(px - 23, py - 12, 2, 2, green ? (t % 8 < 5 ? '#6dff7a' : '#2e9a3e') : '#ff3b30');
  // the hero waiting in the doorway
  if (t >= IT.peek && t < IT.jump) {
    const u = t - IT.peek, sx = Math.min(0, -8 + u), ready = t >= IT.jump - 8;
    ctx.save(); ctx.beginPath(); ctx.rect(px + DOOR.x, py + DOOR.y, DOOR.w, DOOR.h - 3); ctx.clip();
    drawHero(h, px - 34 + sx + (ready ? 2 : 0), py + 19, 1, { pose: 'idle', t: 0, aim: 'fwd', weapon: S.p.weapon });
    ctx.restore();
  }
  for (const [x, y, r, ph] of PROPS) propeller(px + x, py + y, r, t * 1.37 + ph, false);
}

function drawScene() {
  const s = S, t = s.t, h = HEROES[G.hero];
  if (s.skipped) return;
  drawPlane(t);
  if (t < IT.jump) return;
  if (t < IT.land) {
    const q = heroAt(t), u = t - IT.open;
    if (u >= 0) {
      // the chute streams out of the pack, then fills with a pop (a little too wide at first)
      const up = ease(u / 6), g = clamp((u - 4) / 9, 0, 1), over = Math.sin(clamp((u - 4) / 16, 0, 1) * Math.PI) * 3;
      const rx = 3 + (RX - 3) * ease(g) + over, ry = RY - 8 + 8 * up + (1 - g) * 3;
      const sy = q.y - HARN - LINE * up, cx = q.xm - q.dx * 0.25;
      chute(cx, sy, rx, ry, -q.dx / 34, [[q.x - 3, q.y - HARN], [q.x + 3, q.y - HARN]]);
    }
    drawHero(h, q.x, q.y, 1, { pose: 'jump', t, aim: 'fwd', weapon: s.p.weapon, rot: q.rot });
    return;
  }
  // after touchdown: the empty canopy topples over behind the hero, the lines are let go and the wind drags it
  // away to the left along the ground
  const v = t - IT.land;
  const cx = s.lx - 14 * ease(v / 22) - (v > 16 ? 0.05 * (v - 16) * (v - 16) : 0);
  if (cx + 40 < G.cam.x) return;
  const sy = s.ly - HARN - LINE + (HARN + LINE - 8) * ease(v / 22) - (v > 22 ? Math.abs(Math.sin((v - 22) * 0.22)) * 3 : 0);
  const a = -1.5 * ease(v / 22) + (v > 22 ? Math.sin(v * 0.45) * 0.12 : 0);
  const sh = s.ly - (v < 12 ? 15 : HARN), loose = [cx + 27, s.ly - 1];
  fallen(cx, sy, a, 1 - 0.68 * ease((v - 4) / 20), 1 + 0.7 * ease((v - 6) / 20) + Math.sin(v * 0.8) * 0.07,
    v < 12 ? [[s.lx - 3, sh], [s.lx + 3, sh]] : [loose, loose]);
}

PROP_TYPES.l1drop = {
  box: () => null, hit() {},
  // if the scene is cut short from outside (G.intro switched off), put the hero back and go
  update(o) {
    if (G.intro && S && S.prop === o) return;
    if (S && S.prop === o && S.p === G.p) G.p.hidden = false;
    o.dead = true;
  },
  draw(o) {
    if (!G.intro || !S || S.prop !== o) return;
    ctx.save();
    try { drawScene(); } finally { ctx.restore(); ctx.globalAlpha = 1; }
  }
};

// The landing's puff of dust (the engine's dust(), without its random numbers)
function puff(x, y) {
  for (let i = 0; i < 9; i++) {
    const r = n => hsh(i * 13 + n + 400);
    G.parts.push({ type: 'dust', x: x + r(1) * 8 - 4, y: y - r(2) * 3, vx: (i % 2 ? 1 : -1) * (0.25 + r(3) * 0.8), vy: -0.1 - r(4) * 0.45, life: 16 + r(5) * 10, max: 26, size: 2 + r(6) * 2 });
  }
}

// Sounds
function drone(v, hi) { Snd.tone('sawtooth', hi ? 116 : 110, hi ? 110 : 104, 0.15, 0.04 * v); Snd.tone('triangle', 58, 54, 0.15, 0.06 * v); }
function beep() { Snd.tone('square', 990, 990, 0.07, 0.04); Snd.tone('square', 1320, 1320, 0.09, 0.04, 0.1); }
function whistle() { Snd.tone('sine', 1300, 620, 0.38, 0.035, 0.04); }
function pop() { Snd.noise(0.22, 0.16, 1800); Snd.tone('triangle', 160, 380, 0.14, 0.1); }
function thump() { Snd.tone('sine', 130, 48, 0.2, 0.3); Snd.noise(0.1, 0.12, 700); }
function swish() { Snd.noise(0.5, 0.05, 520, 0.12); }

// The caption's icon: a little robot head peeking out of the leaves
function robotIcon(x, y) {
  RO(x + 2, y, 8, 7, MET); R(x + 2, y, 8, 1, METL); R(x + 2, y + 6, 8, 1, METD);
  R(x + 3, y + 2, 6, 2, '#2a2f3a'); R(x + 4, y + 2, 2, 2, EVIL); R(x + 7, y + 2, 1, 2, '#ff8a80');
  R(x + 6, y - 3, 1, 2, METD); R(x + 6, y - 4, 1, 1, EVIL);
  R(x - 1, y + 5, 4, 2, '#3e9a46'); R(x, y + 3, 2, 2, '#6fd36f'); R(x + 9, y + 6, 4, 2, '#3e9a46'); R(x + 11, y + 4, 2, 2, '#6fd36f');
}

L.intro = {
  start() {
    const p = G.p, s = newScene(p);
    p.hidden = true; p.facing = 1; G.introKeys = {};
    s.prop = { k: 'l1drop', x: s.lx, y: s.ly, hitT: 0, dead: false };
    G.props.push(s.prop);
  },
  update() {
    const s = S, p = G.p;
    let t = ++s.t;
    // the hero on its start spot, for good; its idle clock is set so that it reads 0 again when the scene ends
    const show = () => { if (!s.shown) { s.shown = true; p.hidden = false; p.t = (64 - (IT.end - t) % 64) % 64; } };
    // Enter skips to the start banner: hero landed, plane and parachute gone
    if (!s.skipped && t > 10 && t < IT.go && pressed.Enter) { s.skipped = true; t = s.t = IT.go; show(); }
    if (!s.skipped) {
      if (t < IT.land - 8 && t % 6 === 0) drone(Math.min(1, t / 40, (IT.land - 8 - t) / 80), t % 12 === 0);
      if (t === IT.green) beep();
      if (t === IT.jump) { Snd.jump(); whistle(); }
      if (t === IT.open + 5) pop();
      if (t === IT.land) { show(); thump(); puff(s.lx, s.ly); swish(); }
    }
    if (t === IT.go) { G.big = { s: L.startText, t: 130 }; say(L.startSay); }
    if (t === IT.banner) G.banner = { s: L.sections[0].name, t: 200 };
    // knees bent on touchdown, then up
    G.introKeys = { down: !s.skipped && t >= IT.land && t < IT.land + 12 };
    if (t < IT.end) return false;
    show(); p.t = 0; G.introKeys = {};
    return true;
  },
  draw() {
    const s = S, t = s.t, p = G.p;
    // the hero: "TIME TO RUMBLE!"
    if (!s.skipped && t >= IT.say && t < IT.go + 2 && !p.hidden) {
      const bx = Math.round(p.x - G.cam.x) + 6, by = Math.round(p.y) - 58 + (t < IT.say + 4 ? IT.say + 4 - t : 0);
      RO(bx - 48, by, 97, 13, '#ffffff'); R(bx - 48, by + 12, 97, 1, '#d8dce6');
      R(bx - 10, by + 13, 4, 1, '#ffffff'); R(bx - 9, by + 14, 2, 1, '#ffffff');
      R(bx - 11, by + 13, 1, 1, OUT); R(bx - 6, by + 13, 1, 1, OUT); R(bx - 10, by + 14, 1, 1, OUT); R(bx - 7, by + 14, 1, 1, OUT); R(bx - 9, by + 15, 2, 1, OUT);
      text('TIME TO RUMBLE!', bx + 1, by + 3, '#2a3a6a', 1, 'center', null);
    }
    // letterbox bars: in at the start, out at the end; the place in the bottom bar, then the skip hint
    const k = t < 10 ? ease(t / 10) : t > IT.out ? 1 - ease((t - IT.out) / (IT.end - IT.out)) : 1;
    const bh = Math.round(BARS * k);
    if (bh <= 0) return;
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
    ctx.fillStyle = '#1c1c2a'; ctx.fillRect(0, bh - 1, W, 1); ctx.fillRect(0, H - bh, W, 1);
    const ca = Math.min(1, (t - 16) / 14, (150 - t) / 14);
    if (ca > 0) {
      ctx.globalAlpha = ca;
      const tx = W / 2 - 80, ty = H - bh + 13;
      robotIcon(tx, ty);
      text('DEEP IN THE ROBOT JUNGLE', tx + 18, ty, '#f4e2b8', 1, 'left', null);
      ctx.globalAlpha = 1;
    }
    const sa = s.skipped ? 0 : Math.min(1, (t - 156) / 12, (IT.go - t) / 8);
    if (sa > 0) {
      ctx.globalAlpha = sa;
      text('ENTER: SKIP', W - 8, H - bh + 13, '#9aa3c0', 1, 'right', null);
      ctx.globalAlpha = 1;
    }
  }
};
}
