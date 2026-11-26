'use strict';
// ============================================================
// Mission 2: the BATTLE TRACTOR (RIDES.tractor + PROP_TYPES.tractor, parked at x 2950).
// A cheerful red Galician farm tractor turned tank: big rear wheel, small front wheel, bolted grey armour plates,
// an exhaust stack, a nose machine gun on a ball mount that swings up to 90 degrees (X, hold Up: forward shots fly
// at feet - 14 or lower, so they hit wolves), a sun canopy over the seat carrying a dome turret with a stubby cannon
// (C, 15 shells), an amber beacon and a Galician flag. Walk into it to get in; Down + Z gets out (it stays parked,
// armour and shells kept). Armour 6: at 0 the hero is thrown clear and the tractor blows up 0.7 s later.
// Drawing: every frame the tractor is composed facing right and level on two small offscreen canvases (behind and
// in front of the seated hero), then drawn turned and tilted to the slope with nearest-neighbour pixels.
// ============================================================
{
// ============================================================
// Palette and the load-time pixel painter
// ============================================================
const PAL = {
  k: OUT,
  r: '#d8392b', R: '#ff6d4d', q: '#a2251e', Q: '#6c1714',                // red paint
  p: '#8f9aa7', P: '#cbd3dc', o: '#5e6773', v: '#363d47', V: '#f2f6f9',   // armour plates, rivets
  t: '#33333d', T: '#56566b', u: '#1c1c23',                               // tyres
  y: '#f6c431', Y: '#fff08a', z: '#c08612',                               // wheel hubs
  s: '#7c8794', S: '#c6ced8', d: '#464d58', m: '#23252b',                 // steel
  g: '#2a2224', l: '#fff6c2', L: '#ffb52e',                               // grille, lamps
  e: '#3f444c', E: '#80878f',                                             // exhaust
  n: '#4b3a33', N: '#735a4e',                                             // seat, mud
  w: '#ffffff', W: '#d3dbe4', b: '#72bdf0', B: '#4e98cf',                 // the Galician flag
  c: '#e8b43a', C: '#ffe08a', j: '#fff1c9',                               // brass, cream
  A: '#ffd23f', f: '#ff8c1a', F: '#fff3b0', i: '#1b1012'                // beacon, flame, bolt holes
};

// Paints a sprite on a char grid in local coordinates (local 0,0 = grid cell ox, oy), adds a 1px OUT outline
// around the silhouette and returns makeSprite(...) plus its origin. Load time only.
function paint(w, h, ox, oy, fn, outline = true) {
  const g = [];
  for (let y = 0; y < h; y++) g.push(new Array(w).fill('.'));
  const P = (x, y, c) => { x = Math.round(x) + ox; y = Math.round(y) + oy; if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; };
  const box = (x, y, bw, bh, c) => { for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) P(x + i, y + j, c); };
  const disc = (cx, cy, rr, c) => {
    for (let y = Math.floor(cy - rr); y <= Math.ceil(cy + rr); y++) for (let x = Math.floor(cx - rr); x <= Math.ceil(cx + rr); x++) if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= rr * rr) P(x, y, c);
  };
  // a straight piece at angle a (up from forward) from (px, py): t along it, s across (s < 0 = the lit top side)
  const bar = (px, py, a, t0, t1, s0, s1, c) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let t = t0; t <= t1 + 1e-6; t += 0.25) for (let s = s0; s <= s1 + 1e-6; s += 0.25) P(px + t * ca + s * sa, py - t * sa + s * ca, c);
  };
  // rows of palette letters from local (x0, y0), '.' = skip
  const pix = (x0, y0, list) => list.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') P(x0 + i, y0 + j, row[i]); });
  fn({ P, box, disc, bar, pix });
  let rows = g;
  if (outline) {
    rows = g.map(r => r.slice());
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (g[y][x] !== '.') continue;
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) {
        const c = (g[y + dy] || [])[x + dx];
        if (c && c !== '.' && c !== 'k') { edge = true; break; }
      }
      if (edge) rows[y][x] = 'k';
    }
  }
  const s = makeSprite(rows.map(r => r.join('')), PAL);
  s.ox = ox; s.oy = oy;
  return s;
}

// ============================================================
// Sprites (local coordinates: facing right, 0,0 = the ground under the tractor's middle)
// ============================================================
// Wheel with chunky tractor lugs and a yellow hub; ang turns the lugs and the hub bolts
function wheel(R0, lugs, hubR, bolts, ang) {
  const n = R0 + 3;
  return paint(n * 2 + 1, n * 2 + 1, n, n, ({ P }) => {
    for (let y = -R0 - 1; y <= R0 + 1; y++) for (let x = -R0 - 1; x <= R0 + 1; x++) {
      const d = Math.hypot(x, y), a = Math.atan2(y, x), lit = x + y < -R0 * 0.3;
      if (d > R0 + 0.45) continue;
      const lugPh = (((a - ang) / (Math.PI * 2 / lugs)) % 1 + 1) % 1;
      if (d > R0 - 1.6) { if (lugPh < 0.5) P(x, y, lit ? 'T' : 't'); }       // lugs stick out of the tyre
      else if (d > hubR + 1.3) P(x, y, d > R0 - 2.6 ? 'u' : (lit && d > R0 - 3.6 ? 'T' : 't'));
      else if (d > hubR + 0.4) P(x, y, 'z');                                   // hub rim
      else P(x, y, lit && d > hubR * 0.45 ? 'Y' : 'y');
    }
    for (let k = 0; k < bolts; k++) {
      const a = ang + k * Math.PI * 2 / bolts, br = hubR * 0.62;
      P(Math.cos(a) * br, Math.sin(a) * br, 'z');
    }
    P(0, 0, 'z'); if (hubR > 3) { P(-1, 0, 'Y'); P(0, -1, 'Y'); }
  });
}
const REAR = [], FRONT = [];
for (let i = 0; i < 12; i++) REAR.push(wheel(11, 12, 4.6, 6, i * Math.PI / 36));   // 5 degree steps over 60 degrees
for (let i = 0; i < 6; i++) FRONT.push(wheel(7, 8, 2.6, 0, i * Math.PI / 24));     // 7.5 degree steps over 45 degrees
const REAR_AT = [-16, -11], FRONT_AT = [19, -7];

// Main body: hitch, chassis, the housing under the seat, dashboard, bonnet with a rounded nose, cream pinstripe,
// louvres, grille, a round headlamp, radiator cap, exhaust pipe
const BODY = paint(84, 52, 42, 46, ({ P, box, disc }) => {
  box(-36, -15, 8, 2, 'd'); box(-36, -15, 8, 1, 's'); box(-37, -19, 2, 8, 'o'); box(-37, -19, 1, 8, 'p');
  box(-15, -12, 40, 4, 'd'); box(-15, -12, 40, 1, 's'); box(-15, -9, 40, 1, 'm');
  box(15, -10, 7, 3, 'o'); box(15, -10, 7, 1, 'p');
  // housing under the seat
  box(-15, -27, 13, 15, 'r'); box(-15, -27, 13, 1, 'R'); box(-15, -14, 13, 2, 'q'); box(-3, -27, 1, 15, 'q');
  box(-13, -13, 8, 1, 'm');
  // dashboard with a gauge
  box(-4, -29, 5, 3, 'q'); box(-4, -29, 5, 1, 'r'); P(-2, -28, 'l'); P(-1, -28, 'L');
  // bonnet: two lit rows on top, the nose rounding down to the grille
  box(-1, -27, 20, 1, 'R'); box(-3, -26, 24, 1, 'R'); P(21, -26, 'r');
  box(-3, -25, 26, 10, 'r'); P(21, -25, 'R'); P(22, -25, 'R'); P(22, -24, 'R');
  box(-3, -15, 26, 2, 'q'); box(-3, -13, 26, 1, 'Q');
  box(-1, -23, 17, 1, 'j');                                                  // cream pinstripe
  for (const y of [-22, -19, -16]) { box(17, y, 5, 1, 'Q'); box(17, y + 1, 5, 1, 'R'); }   // louvres
  // grille: chrome frame, dark slats
  for (let y = -24; y <= -14; y++) { P(23, y, 's'); P(24, y, y % 2 ? 'S' : 'g'); P(25, y, y % 2 ? 's' : 'g'); }
  P(23, -25, 's'); P(24, -25, 'S');
  // round headlamp on the nose, radiator cap
  disc(24, -21.5, 2.7, 's'); disc(24.4, -21.6, 1.9, 'S'); disc(24.9, -21.5, 1.3, 'l'); P(25, -22, 'w'); P(25, -20, 'L');
  P(13, -28, 'S'); P(14, -28, 's');
  // mud from the farm tracks
  for (const [x, y] of [[-1, -14], [0, -13], [4, -14], [9, -13], [10, -14], [15, -13], [19, -14], [-12, -13], [-8, -14], [-34, -14]]) P(x, y, (x + y) & 1 ? 'n' : 'N');
  // exhaust pipe with its flanges
  box(9, -37, 3, 11, 'e'); box(9, -37, 1, 11, 'E'); box(8, -27, 5, 1, 'd'); box(8, -32, 5, 1, 'd');
});

// Rear mudguard over the big wheel (drawn over the wheel), with a tail lamp
const FENDER = paint(40, 24, 34, 28, ({ P, box }) => {
  const [cx, cy] = REAR_AT;
  for (let y = cy - 16; y <= cy + 1; y++) for (let x = cx - 16; x <= -3; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d < 12.6 || d > 15.4 || y > cy + 1) continue;
    P(x, y, d > 14.5 && y < cy - 5 ? 'R' : d < 13.5 ? 'q' : 'r');
  }
  box(-33, -15, 2, 3, 'L'); P(-33, -15, 'F');
});

// The steering wheel the hero holds
const STEER = paint(16, 14, 8, 36, ({ bar, P }) => {
  bar(1, -27, Math.PI * 0.62, 0, 4.5, -0.4, 0.4, 'd');
  bar(-2.5, -31, Math.PI * 0.12, -3.6, 3.6, -0.6, 0.5, 'm');
  P(-5, -31, 'S'); P(-4, -31, 'S');
});

// Exhaust cap: closed / flipped open by a puff
const CAP = [
  paint(10, 8, -6, 41, ({ box }) => { box(8, -39, 5, 2, 'e'); box(8, -39, 5, 1, 'E'); }),
  paint(10, 10, -6, 44, ({ bar }) => { bar(8, -38, Math.PI * 0.36, 0, 5, -0.5, 0.6, 'e'); })
];

// Armour plates (0 bonnet side, 1 rear, 2 chin under the grille, 3 mudguard). Each its own sprite: bolted
// on, and flying off at low armour
const rivet = (P, x, y) => { P(x, y, 'v'); P(x - 1, y - 1, 'V'); };
const PLATES = [
  paint(18, 11, 0, 23, ({ P, box, pix }) => {
    box(1, -21, 15, 8, 'p'); box(1, -21, 15, 1, 'P'); box(1, -21, 1, 8, 'P'); box(1, -14, 15, 1, 'o'); box(15, -20, 1, 7, 'o');
    rivet(P, 3, -19); rivet(P, 13, -19); rivet(P, 3, -16); rivet(P, 13, -16);
    // a scallop shell, the pilgrims' badge of Galicia
    pix(5, -20, ['.CCCCC.', 'CcCcCcC', 'CcCcCcC', '.cCcCc.', '..cCc..', '.cc.cc.']);
  }),
  paint(10, 15, 38, 27, ({ P, box }) => {
    box(-36, -25, 7, 11, 'p'); box(-36, -25, 7, 1, 'P'); box(-36, -25, 1, 11, 'P'); box(-30, -24, 1, 10, 'o'); box(-36, -15, 7, 1, 'o');
    box(-35, -20, 5, 1, 'o');
    rivet(P, -34, -23); rivet(P, -31, -23); rivet(P, -34, -17); rivet(P, -31, -17);
  }),
  paint(10, 13, -23, 16, ({ P, pix }) => {
    pix(25, -14, ['PPPPPP', 'Ppppppo', 'Ppppppo', 'Ppppppo', 'Ppppppo', 'Ppppppo', 'Ppppppo', 'Ppppppo', 'Pppppo', 'ooooo']);
    rivet(P, 28, -11); rivet(P, 28, -7);
  }),
  paint(17, 13, 32, 27, ({ P }) => {
    const [cx, cy] = REAR_AT;
    for (let y = cy - 16; y <= cy; y++) for (let x = cx - 16; x <= cx; x++) {
      const d = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx);
      if (d < 12.6 || d > 15.6 || a < -2.65 || a > -1.72) continue;
      P(x, y, d > 14.7 ? 'P' : d < 13.4 ? 'o' : 'p');
    }
    for (const a of [-2.45, -1.95]) rivet(P, Math.round(cx + Math.cos(a) * 14), Math.round(cy + Math.sin(a) * 14));
  })
];
// where each plate's bolt holes show once it has flown off
const HOLES = [[[3, -19], [13, -19], [3, -16], [13, -16]], [[-34, -23], [-31, -23], [-34, -17], [-31, -17]], [[28, -11], [28, -7]], [[-27, -20], [-21, -24]]];
const KEEP = [0, 1, 2, 3]; // plates kept longest first: with n plates left, KEEP[0..n-1] are on

// Behind the hero: the canopy (a post behind the seat holding a little sun roof), the seat back, the antenna
const AX = -29, AY = -74;
const BACK = paint(46, 56, 42, 77, ({ P, box }) => {
  box(-25, -49, 3, 23, 's'); box(-25, -49, 1, 23, 'S'); box(-23, -49, 1, 23, 'd');
  box(-26, -27, 5, 2, 'd'); box(-26, -27, 5, 1, 's');
  box(-22, -48, 3, 1, 's'); box(-22, -47, 2, 1, 'd'); P(-22, -46, 'd');
  box(-19, -38, 4, 12, 'n'); box(-19, -38, 1, 12, 'N'); box(-19, -38, 4, 1, 'N');
  box(-30, -51, 31, 3, 'r'); box(-30, -51, 31, 1, 'R'); box(-30, -49, 31, 1, 'q'); box(-30, -50, 1, 1, 'R');
  for (let y = AY + 1; y <= -52; y++) P(AX, y, 'd');
  P(AX, AY, 'S');
});

// Dome turret on the roof (its cannon is a separate sprite, so it can recoil): cupola, vision slit, a riveted armour
// band, the turret ring
const TURRET = paint(21, 17, 24, 66, ({ pix }) => {
  pix(-22, -64, [
    '........PP.......',
    '.......oooo......',
    '.....RRRRRRR.....',
    '...RRRrrrrrrrr...',
    '..RRrrrrrrrrmmr..',
    '.RRrrrrrrrrrrrrq.',
    '.Rrrrrrrrrrrrrrq.',
    'PPPPPPPPPPPPPPPPP',
    'ppvppppvpppppvppo',
    'qqqqqqqqqqqqqqqqq',
    '.ppppppppppppppp.',
    '.ooooooooooooooo.',
    '.vvvvvvvvvvvvvvv.'
  ]);
});
const CANNON_AT = [-8, -59], CANNON_A = Math.PI / 12;
const CANNON = paint(22, 16, 13, 66, ({ bar }) => {
  const [x, y] = CANNON_AT, a = CANNON_A;
  bar(x, y, a, -3, 10, -1.25, 1.25, 's'); bar(x, y, a, -3, 10, -1.25, -0.75, 'S'); bar(x, y, a, -3, 10, 0.75, 1.25, 'd');
  bar(x, y, a, 1, 2, -1.75, 1.75, 'o');
  bar(x, y, a, 10, 13, -2, 2, 'd'); bar(x, y, a, 10, 13, -2, -1.5, 's'); bar(x, y, a, 11.25, 11.75, -2, 2, 'm');
});
const MUZ = [CANNON_AT[0] + Math.cos(CANNON_A) * 13.5, CANNON_AT[1] - Math.sin(CANNON_A) * 13.5];
// amber beacon on the roof, by the antenna
const BEACON = [
  paint(8, 7, 30, 57, ({ box, P }) => { box(-27, -54, 3, 2, 'f'); P(-27, -54, 'L'); box(-28, -52, 5, 1, 'd'); }),
  paint(8, 7, 30, 57, ({ box, P }) => { box(-27, -54, 3, 2, 'A'); P(-27, -54, 'F'); P(-26, -54, 'F'); box(-28, -52, 5, 1, 'd'); })
];
const GLOW = paint(11, 5, 31, 56, ({ P }) => { for (const [x, y] of [[-30, -54], [-29, -55], [-22, -54], [-23, -55], [-26, -56]]) P(x, y, 'A'); }, false);

// The Galician flag on the antenna, streaming back: white with one light-blue diagonal band. mirror: for facing
// left (the drawing is flipped then), so the band still runs from top-left to bottom-right on the screen
function flag(k, mirror) {
  return paint(16, 15, 43, 76, ({ P }) => {
    for (let i = 0; i < 11; i++) {
      const ph = k * Math.PI / 2 + i * 0.8, wv = Math.round(Math.sin(ph) * (10 - i) / 10 * 1.6), dark = Math.cos(ph) < -0.45;
      const u = mirror ? 10 - i : i;
      for (let j = 0; j < 7; j++) {
        const band = Math.abs(j - u * 0.6) < 1.15;
        P(AX - 11 + i, AY + 1 + j + wv, band ? (dark ? 'B' : 'b') : (dark ? 'W' : 'w'));
      }
    }
  });
}
const FLAG = [[], []];
for (let k = 0; k < 4; k++) { FLAG[0].push(flag(k, false)); FLAG[1].push(flag(k, true)); }

// Nose machine gun on a ball mount: 13 frames from 0 to 90 degrees (7.5 degree steps). Dark gunmetal, so it reads
// against the light chin plate
const MG_AT = [26, -14], MG_LEN = 15, GSTEP = Math.PI / 24;
const MG = [], MFLASH = [];
for (let i = 0; i <= 12; i++) {
  const a = i * GSTEP;
  MG.push(paint(24, 24, 5, 19, ({ bar }) => {
    bar(0, 0, a, -2, 3, -2, 2, 'o');
    bar(0, 0, a, 2, 9, -1.5, 1.5, 'd'); bar(0, 0, a, 2, 9, -1.5, -1, 's');
    for (const h of [3.5, 5.5, 7.5]) bar(0, 0, a, h, h + 0.5, -0.75, 0.25, 'm');
    bar(0, 0, a, 9, 13, -0.75, 0.75, 'v'); bar(0, 0, a, 9, 13, -0.75, -0.5, 's');
    bar(0, 0, a, 12.5, 14.5, -1.25, 1.25, 'm');
  }));
  MFLASH.push(paint(25, 25, 12, 12, ({ bar, disc }) => {
    bar(0, 0, a, 0, 8, -1, 1, 'A'); bar(0, 0, a, 0, 5, -0.5, 0.5, 'F');
    bar(0, 0, a + 0.9, 0, 4, -0.5, 0.5, 'A'); bar(0, 0, a - 0.9, 0, 4, -0.5, 0.5, 'A');
    disc(0, 0, 2.3, 'A'); disc(0, 0, 1.4, 'F'); disc(0, 0, 0.6, 'w');
  }, false));
}
const BALL = paint(11, 11, 5, 5, ({ disc, P }) => {
  disc(0, 0, 3.1, 'd'); disc(-0.5, -0.5, 2.4, 'o'); disc(-1.1, -1.1, 1.1, 's'); P(1, 1, 'v');
});
const CFLASH = paint(27, 27, 13, 13, ({ bar, disc }) => {
  const a = CANNON_A;
  bar(0, 0, a, 0, 11, -2, 2, 'f'); bar(0, 0, a, 0, 9, -1.25, 1.25, 'A'); bar(0, 0, a, 0, 6, -0.5, 0.5, 'F');
  bar(0, 0, a + 1.1, 0, 5, -0.75, 0.75, 'A'); bar(0, 0, a - 1.1, 0, 5, -0.75, 0.75, 'A');
  disc(0, 0, 3.4, 'f'); disc(0, 0, 2.4, 'A'); disc(0, 0, 1.3, 'F');
}, false);

// Little fire on a badly hurt bonnet (two frames)
const FLAME = [0, 1].map(k => paint(9, 11, 4, 9, ({ box, P }) => {
  box(-2, -4, 5, 4, 'f'); box(-1, -6 - k, 3, 2, 'f'); P(0, -8 + k, 'f'); box(-1, -3, 3, 3, 'A'); P(0, -4 - k, 'A'); P(0, -2, 'F');
}));

// Cannon shell in 8 directions (index = direction / 45 degrees): steel body, brass band, red nose
const SHELL = [];
for (let i = 0; i < 8; i++) {
  const a = -i * Math.PI / 4;
  SHELL.push(paint(15, 15, 7, 7, ({ bar }) => {
    bar(0, 0, a, -3.5, 1.5, -1.25, 1.25, 'd'); bar(0, 0, a, -3.5, 1.5, -1.25, -0.75, 'S');
    bar(0, 0, a, -3.5, -2.5, -1.25, 1.25, 'c');
    bar(0, 0, a, 1.5, 3.5, -1, 1, 'r'); bar(0, 0, a, 1.5, 3.5, -1, -0.5, 'R');
  }));
}

// HUD: a little tractor and a cannon shell
const ICON = paint(24, 19, 0, 0, ({ box, disc, P }) => {
  box(6, 1, 5, 2, 'r'); box(7, 1, 3, 1, 'R'); box(11, 1, 3, 1, 's');      // turret and cannon
  box(3, 3, 11, 1, 'r'); box(4, 4, 1, 5, 's');                            // canopy roof and post
  box(3, 8, 8, 4, 'r'); box(3, 8, 8, 1, 'R');                             // mudguard
  box(10, 9, 10, 4, 'r'); box(10, 9, 10, 1, 'R'); box(10, 12, 10, 1, 'q'); box(20, 9, 1, 4, 'S');   // bonnet, grille
  box(14, 6, 1, 3, 'e'); P(19, 10, 'l');                                  // exhaust, lamp
  disc(7, 13, 4.6, 't'); disc(7, 13, 1.9, 'y'); disc(18, 15, 2.7, 't'); P(18, 15, 'y');
});
// Scraps for the explosion (the plates are gone by then): a piece of red bonnet with its cream stripe, armour scrap
const BITS = [
  paint(14, 8, 1, 1, ({ box }) => { box(0, 0, 11, 5, 'r'); box(0, 0, 11, 1, 'R'); box(1, 2, 8, 1, 'j'); box(0, 4, 11, 1, 'q'); }),
  paint(10, 8, 1, 1, ({ box, P }) => { box(0, 0, 7, 5, 'p'); box(0, 0, 7, 1, 'P'); box(6, 1, 1, 4, 'o'); rivet(P, 2, 2); rivet(P, 5, 3); })
];
const SHELL_ICON = paint(6, 10, 1, 9, ({ box }) => {
  box(1, -8, 2, 1, 'S'); box(0, -7, 4, 2, 's'); box(0, -5, 4, 4, 'c'); box(0, -5, 1, 4, 'C'); box(0, -1, 4, 1, 'z');
});

// ============================================================
// Composition: the parts on two small canvases (made once), then drawn turned and tilted
// ============================================================
const CW = 116, CH = 88, OX = 50, OY = 76;
function layer() { const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
const [backC, bc] = layer(), [frontC, fc] = layer();
const put = (g, s, x, y, wt) => g.drawImage(wt ? s.white : s.img, OX + Math.round(x) - s.ox, OY + Math.round(y) - s.oy);
const mod = (a, m) => ((a % m) + m) % m;
const plateOn = (n, i) => KEEP.indexOf(i) < n;

// st: { f, sus, wa, fa, gi, recoil, plates, wt, muzzle, cflash, puff, beacon, flagK, fire }
function compose(st) {
  const wt = st.wt, y = Math.round(st.sus);
  bc.clearRect(0, 0, CW, CH); fc.clearRect(0, 0, CW, CH);
  // behind the hero: canopy post and roof, seat back, antenna and flag, the turret with its cannon, the beacon
  put(bc, BACK, 0, y, wt);
  put(bc, FLAG[st.f > 0 ? 0 : 1][st.flagK & 3], 0, y, wt);
  put(bc, CANNON, -st.recoil, y, wt);
  put(bc, TURRET, 0, y, wt);
  put(bc, BEACON[st.beacon ? 1 : 0], 0, y, wt);
  if (st.beacon && !wt) put(bc, GLOW, 0, y, false);
  if (st.cflash) put(bc, CFLASH, MUZ[0] - st.recoil + 1, MUZ[1] + y, false);
  // in front of the hero: body and plates, wheels, mudguard, steering wheel, exhaust cap, the nose gun
  put(fc, BODY, 0, y, wt);
  for (let i = 0; i < 3; i++) { if (plateOn(st.plates, i)) put(fc, PLATES[i], 0, y, wt); else holes(i, y); }
  put(fc, REAR[Math.floor(mod(st.wa, Math.PI / 3) / (Math.PI / 36)) % 12], REAR_AT[0], REAR_AT[1] + st.wy, wt);
  put(fc, FRONT[Math.floor(mod(st.fa, Math.PI / 4) / (Math.PI / 24)) % 6], FRONT_AT[0], FRONT_AT[1] + st.wy, wt);
  put(fc, FENDER, 0, y, wt);
  if (plateOn(st.plates, 3)) put(fc, PLATES[3], 0, y, wt); else holes(3, y);
  put(fc, STEER, 0, y, wt);
  put(fc, CAP[st.puff ? 1 : 0], 0, y, wt);
  put(fc, MG[st.gi], MG_AT[0], MG_AT[1] + y, wt);
  put(fc, BALL, MG_AT[0], MG_AT[1] + y, wt);
  if (st.muzzle) { const a = st.gi * GSTEP; put(fc, MFLASH[st.gi], MG_AT[0] + Math.cos(a) * (MG_LEN + 1), MG_AT[1] + y - Math.sin(a) * (MG_LEN + 1), false); }
  if (st.fire) put(fc, FLAME[(G.t >> 2) & 1], 6, -27 + y, false);
}
function holes(i, y) {
  fc.fillStyle = PAL.i;
  for (const [hx, hy] of HOLES[i]) fc.fillRect(OX + hx, OY + hy + y, 1, 1);
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
// the ground line through both wheels' contact points (facing f): its height under x and its slope angle
function line(x, f) {
  const xa = x + REAR_AT[0] * f, xb = x + FRONT_AT[0] * f, ya = groundAt(xa), yb = groundAt(xb), k = (yb - ya) / (xb - xa);
  return { y: ya + k * (x - xa), rot: Math.atan(k) };
}
// tilt in 2 degree steps, none on gentle ground, so the pixels stay calm
const tilt = rot => Math.abs(rot) < 0.045 ? 0 : Math.round(rot / 0.035) * 0.035;

// The hero in the seat, hands on the steering wheel (the hero's own gun is clipped away)
function seatHero(p, v, sus) {
  const s = world(v, -7, -13 + sus);
  ctx.save();
  ctx.translate(Math.round(s.x), Math.round(s.y)); ctx.scale(v.f, 1);
  ctx.beginPath(); ctx.rect(-30, -60, 60, 39); ctx.rect(-30, -21, 37, 30); ctx.clip();
  drawHero(HEROES[G.hero], 0, 0, 1, { pose: 'idle', t: p.t, aim: 'fwd', weapon: 'pistol', muzzle: 0 });
  ctx.restore();
}
// Boarding: the hero hops from where they stood into the seat (k 0 -> 1)
function hopHero(p, r, v, k) {
  const s = world(v, -7, -13 + r.sus), x0 = p.x + r.hopX, y0 = p.y + r.hopY;
  drawHero(HEROES[G.hero], x0 + (s.x - x0) * k, y0 + (s.y - y0) * k - Math.sin(k * Math.PI) * 7, p.facing, { pose: 'jump', t: p.t, aim: 'fwd', weapon: p.weapon, muzzle: 0 });
}

// Wading through the stream: water over the wheels, ripples
const WATER = 234;
function wet(x) { return groundAt(x) > WATER + 0.5; }
function water(x0, x1) {
  for (let x = Math.floor(x0); x < x1; x += 2) {
    const gy = Math.round(groundAt(x));
    if (gy <= WATER) continue;
    const top = WATER + (Math.sin(G.t * 0.2 + x * 0.35) > 0.55 ? -1 : 0);
    ctx.fillStyle = 'rgba(79,159,210,0.6)'; ctx.fillRect(x, top, 2, gy - top + 1);
    ctx.fillStyle = (x + (G.t >> 2)) % 6 < 2 ? '#ffffff' : '#bfe6ff'; ctx.fillRect(x, top, 2, 1);
  }
}

// 'GET IN!' over a parked tractor, bouncing
function prompt(o) {
  const b = Math.round(Math.abs(Math.sin(G.t * 0.12)) * -4), x = Math.round(o.x - 6 * o.facing), y = Math.round(o.y) - 80 + b;
  text('GET IN!', x, y - 10, '#ffe066', 1, 'center');
  blob([[x - 1, y, 3, 3], [x - 3, y + 3, 7, 1], [x - 2, y + 4, 5, 1], [x - 1, y + 5, 3, 1], [x, y + 6, 1, 1]], '#ffe066');
  R(x - 1, y, 1, 3, '#fff6c2');
}

// One tractor on screen: the back layer, the hero (behind the cab, or in front of it while hopping in), the front
// layer, then the stream's water over the wheels
function drawTractor(v, st, hero, heroFront, armour) {
  compose(st);
  blit(backC, v);
  if (hero && !heroFront) hero();
  blit(frontC, v);
  if (hero && heroFront) hero();
  wade(v);
  smokeColumn(v, st.sus, armour);
}
// Smoke column over a badly hurt bonnet (armour 2 and less): pixel puffs rising and growing, drawn from G.t
const SMOKE = ['#57525e', '#3f3b45', '#2e2b33'];
function smokeColumn(v, sus, armour) {
  if (armour > 2) return;
  const b = world(v, 7, -29 + sus), n = armour <= 1 ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const k = ((G.t * (armour <= 1 ? 0.03 : 0.022) + i / n) % 1), rr = 1.5 + k * 3.5;
    const x = Math.round(b.x - v.f * k * 9 + Math.sin(k * 6 + i) * 2), y = Math.round(b.y - k * 30);
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.fillStyle = SMOKE[armour <= 1 ? 2 : 1]; circ(x, y, rr + 1);
    ctx.fillStyle = SMOKE[armour <= 1 ? 1 : 0]; circ(x - 1, y - 1, rr);
  }
  ctx.globalAlpha = 1;
}
function wade(v) {
  if (!wet(v.x - 30) && !wet(v.x) && !wet(v.x + 30)) return;
  water(v.x - 34, v.x + 34);
  for (const [lx, rr] of [[REAR_AT[0], 11], [FRONT_AT[0], 7]]) {
    const wx = Math.round(v.x + lx * v.f), k = (G.t >> 2) & 3;
    if (!wet(wx)) continue;
    R(wx - rr - 3 - k, WATER - 1, 4, 1, '#ffffff'); R(wx + rr + k, WATER - 1, 4, 1, '#ffffff');
    R(wx - rr + 1, WATER, rr * 2 - 1, 1, '#e8f6ff');
  }
}
// a sprite's centre in local coordinates, and its mirror image (plates flying off a tractor facing left)
const mid = s => [s.w / 2 - s.ox, s.h / 2 - s.oy];
function flipped(s) {
  const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
  const g = c.getContext('2d'); g.scale(-1, 1); g.drawImage(s.img, -s.w, 0);
  return { img: c, w: s.w, h: s.h };
}
const PLATES_FLIP = PLATES.map(flipped);

// ============================================================
// The ride: state and helpers
// ============================================================
const ARMOUR = 6, SHELLS = 15, TOP = 1.6, BOARD = 18, HOP = -3.4, GRAV = 0.24, MGV = 7, SHELL_V = 3.9, SHELL_G = 0.2;
const newRide = () => ({
  type: 'tractor', armour: ARMOUR, shells: SHELLS, ga: 0, cd: 0, ccd: 0, vx: 0, rot: 0, sus: 1, susV: 0, wa: 0, fa: 0,
  recoil: 0, muzzle: 0, cflash: 0, puff: 0, puffT: 0, hitT: 0, board: 0, hopX: 0, hopY: 0, flagK: 0, flagT: 0, t: 0,
  air: false, wet: false, hello: false
});
const platesFor = a => clamp(a - 2, 0, 4);   // every hit but the last knocks a plate off
const viewAt = (x, y, rot, f) => ({ x: Math.round(x), y: Math.round(y), rot: tilt(rot), f });
// a gun at angle a (up from forward) pointing into the world, for the view v
function dirOf(v, a) {
  const lx = Math.cos(a) * v.f, ly = -Math.sin(a), c = Math.cos(v.rot), s = Math.sin(v.rot);
  return { x: lx * c - ly * s, y: lx * s + ly * c };
}
// the compose state: one object, refilled for each tractor drawn
const ST = { f: 1, sus: 0, wy: 0, wa: 0, fa: 0, gi: 0, recoil: 0, plates: 4, wt: false, muzzle: false, cflash: false, puff: false, beacon: false, flagK: 0, fire: false };
function stateOf(r, f, sus, wt) {
  ST.f = f; ST.sus = sus; ST.wy = r.air ? 2 : 0; ST.wa = r.wa; ST.fa = r.fa;
  ST.gi = clamp(Math.round(r.ga / GSTEP), 0, 12); ST.recoil = Math.round(r.recoil); ST.plates = platesFor(r.armour);
  ST.wt = wt; ST.muzzle = r.muzzle > 0; ST.cflash = r.cflash > 2; ST.puff = r.puff > 0;
  ST.beacon = ((G.t >> 4) & 1) === 1; ST.flagK = r.flagK; ST.fire = r.armour <= 1;
  return ST;
}
// the timers every tractor runs, parked or driven: suspension spring (rest 1px down, so the nose gun never fires
// higher than feet - 14), flag, cooldowns, flashes
function tick(r, fast) {
  r.t++;
  r.susV += (1 - r.sus) * 0.3 - r.susV * 0.28;
  r.sus = clamp(r.sus + r.susV, 0, 2.6);
  if (--r.flagT <= 0) { r.flagT = fast ? 4 : 7; r.flagK = (r.flagK + 1) & 3; }
  if (r.hitT > 0) r.hitT--;
  if (r.cd > 0) r.cd--;
  if (r.ccd > 0) r.ccd--;
  if (r.muzzle > 0) r.muzzle--;
  if (r.cflash > 0) r.cflash--;
  if (r.puff > 0) r.puff--;
  if (r.recoil > 0) r.recoil = Math.max(0, r.recoil - 0.35);
}
// exhaust: the cap flips open with each puff; quicker, bigger puffs with the throttle open
function exhaust(v, r, hard, quiet) {
  r.puffT -= hard ? 3 : 1;
  if (r.puffT > 0) return;
  r.puffT = 26; r.puff = 4;
  const s = world(v, 10, -41 + Math.round(r.sus));
  G.parts.push({ type: 'smoke', x: s.x, y: s.y, vx: -v.f * rand(0.2, 0.5), vy: -rand(0.5, 0.8), life: hard ? 40 : 30, max: 40, size: hard ? 2.4 : 1.7 });
  if (!quiet) { Snd.tone('sawtooth', hard ? 110 : 95, 70, 0.1, hard ? 0.15 : 0.12); Snd.noise(0.09, hard ? 0.14 : 0.11, 1000); }
}
// a badly hurt tractor smokes from the bonnet (and sparks at the last armour point)
function hurtSmoke(v, r) {
  if (r.armour > 2 || r.t % (r.armour <= 1 ? 3 : 5)) return;
  const s = world(v, 7 + rand(-3, 3), -28 + Math.round(r.sus));
  G.parts.push({ type: 'smoke', x: s.x, y: s.y, vx: -v.f * rand(0.1, 0.4), vy: -rand(0.6, 0.9), life: 48, max: 48, size: rand(2.4, 3.6) });
  if (r.armour <= 1 && r.t % 12 === 0) sparks(s.x, s.y + 2, 2, '#ffb52e');
}
function splash(x, n, dir) {
  for (let i = 0; i < n; i++) {
    G.parts.push({ type: 'spark', x: x + rand(-4, 4), y: WATER - 1, vx: dir * rand(0.2, 1.3) + rand(-0.4, 0.4), vy: -rand(1.2, 2.6), g: 0.16, life: rand(14, 24), max: 24, size: rand(0, 1) < 0.4 ? 2 : 1, c: rand(0, 1) < 0.5 ? '#ffffff' : '#bfe6ff' });
  }
}

// ============================================================
// Driving (RIDES.tractor.update): ←/→ throttle and brake, Z hop, X nose gun (↑ swings it up), C cannon, ↓+Z out
// ============================================================
function rideUpdate(p, r) {
  const moving = Math.abs(r.vx) > 0.6;
  tick(r, moving);
  p.crouch = false; p.onPlat = null; p.aim = 'fwd'; p.kb = 0;
  if (r.board > 0) {
    // hopping into the seat: the tractor waits, then the engine roars
    const gl = line(p.x, p.facing);
    p.vx = 0; p.vy = 0; p.y = gl.y; p.onGround = true; r.rot = gl.rot;
    if (--r.board === 0) {
      r.susV += 1.2; r.puffT = 0;
      Snd.tone('sawtooth', 45, 130, 0.4, 0.09); Snd.noise(0.35, 0.12, 600);
      const v = viewAt(p.x, p.y, r.rot, p.facing), s = world(v, 10, -41);
      for (let i = 0; i < 3; i++) G.parts.push({ type: 'smoke', x: s.x + rand(-2, 2), y: s.y - i * 3, vx: -p.facing * rand(0.2, 0.6), vy: -rand(0.6, 1.1), life: 46, max: 46, size: 2.4 + i * 0.4 });
    }
    return;
  }
  const L = ctl('left'), Rt = ctl('right'), D = ctl('down');
  if (D && ctlTap('jump')) { getOut(p, r); return; }
  const mv = L && !Rt ? -1 : Rt && !L ? 1 : 0;
  if (mv && mv !== p.facing) { p.facing = mv; dust(p.x, p.y, 3); }
  // throttle: speed up gently, brake hard against the motion, roll to a stop; a little faster downhill
  if (mv) r.vx += (r.vx * mv < 0 ? 0.16 : 0.07) * mv;
  else r.vx -= Math.sign(r.vx) * Math.min(Math.abs(r.vx), 0.05);
  let gl = line(p.x, p.facing);
  const top = TOP * clamp(1 + Math.sin(gl.rot) * Math.sign(r.vx) * 2, 0.75, 1.25);
  r.vx = clamp(r.vx, -top, top);
  // the screen edges stop the throttle (no snapping back: a bear pushing the tractor must not fight with this)
  if ((r.vx < 0 && p.x + r.vx < G.cam.x + 30) || (r.vx > 0 && p.x + r.vx > G.cam.x + W - 30)) r.vx = 0;
  p.x += r.vx;
  p.vx = r.vx;
  gl = line(p.x, p.facing);
  // hop (a thump and dust on landing), else stick to the ground
  if (p.onGround) {
    if (ctlTap('jump')) {
      p.vy = HOP; p.onGround = false; r.susV -= 0.8;
      Snd.tone('square', 110, 280, 0.1, 0.06);
      dust(p.x + REAR_AT[0] * p.facing, gl.y, 3); dust(p.x + FRONT_AT[0] * p.facing, gl.y, 2);
    } else p.y = gl.y;
  }
  if (!p.onGround) {
    p.vy = Math.min(p.vy + GRAV, 6); p.y += p.vy;
    if (p.y >= gl.y) {
      const hard = p.vy;
      p.y = gl.y; p.vy = 0; p.onGround = true;
      if (hard > 1.5) {
        r.susV += hard * 0.6; G.shake = Math.max(G.shake, hard * 0.8);
        if (wet(p.x)) splash(p.x, 10, 0);
        else { dust(p.x + REAR_AT[0] * p.facing, gl.y, 5); dust(p.x + FRONT_AT[0] * p.facing, gl.y, 4); }
        Snd.noise(0.14, 0.22, 420); Snd.tone('sine', 120, 45, 0.14, 0.2); Snd.tone('square', 150, 75, 0.1, 0.08); Snd.noise(0.1, 0.18, 1200);
      }
    }
  }
  r.air = !p.onGround;
  r.rot += (gl.rot - r.rot) * (p.onGround ? 0.3 : 0.08);
  // wheels roll with the speed; bumps on the track
  const fwd = r.vx * p.facing;
  r.wa += fwd / 11; r.fa += fwd / 7;
  if (p.onGround && Math.abs(r.vx) > 0.4 && rand(0, 1) < 0.06) r.susV += rand(0.2, 0.6);
  const v = viewAt(p.x, p.y, r.rot, p.facing);
  // dust from the big wheel, or splashes in the stream
  const inWater = wet(p.x + REAR_AT[0] * p.facing) || wet(p.x + FRONT_AT[0] * p.facing);
  if (inWater && !r.wet && Math.abs(r.vx) > 0.3) splash(p.x, 8, Math.sign(r.vx));
  r.wet = inWater;
  if (p.onGround && Math.abs(r.vx) > 0.3) {
    if (inWater) { if (r.t % 3 === 0) { splash(p.x + REAR_AT[0] * p.facing, 2, -Math.sign(r.vx)); splash(p.x + FRONT_AT[0] * p.facing, 1, Math.sign(r.vx)); } }
    else if (Math.abs(r.vx) > 0.5 && r.t % 7 === 0) dust(p.x + (REAR_AT[0] - 6) * p.facing, groundAt(p.x + (REAR_AT[0] - 6) * p.facing), 1, -Math.sign(r.vx));
  }
  exhaust(v, r, !!mv, false);
  hurtSmoke(v, r);
  // nose gun: holding ↑ swings it up to 90 degrees, letting go swings it back; X fires along it
  r.ga = ctl('up') ? Math.min(Math.PI / 2, r.ga + 0.11) : Math.max(0, r.ga - 0.13);
  if (ctl('fire') && r.cd <= 0) fireGun(p, r, v);
  if (ctlTap('bomb')) {
    if (r.shells > 0 && r.ccd <= 0) fireCannon(p, r, v);
    else if (r.shells <= 0) { Snd.tone('square', 220, 160, 0.06, 0.06); G.texts.push({ x: p.x, y: p.y - 70, s: 'NO SHELLS!', t: 50, c: '#ff8a5c' }); }
  }
}

// Nose machine gun: 1 damage, quick, a little spread; shots start inside the barrel so a wolf touching the bumper is
// hit too (they show from the tip on). rideGun marks them for the MEGA BEAR, whose plating halves them.
function fireGun(p, r, v) {
  r.cd = 5; r.muzzle = 3;
  const a = clamp(Math.round(r.ga / GSTEP), 0, 12) * GSTEP, d = dirOf(v, a), sy = Math.round(r.sus), j = rand(-0.3, 0.3);
  const m = world(v, MG_AT[0] + Math.cos(a) * 4, MG_AT[1] + sy - Math.sin(a) * 4);
  G.pb.push({ x: m.x, y: m.y, vx: d.x * MGV - d.y * j, vy: d.y * MGV + d.x * j, dmg: 1, life: 75, age: 0, rideGun: true, update: ageUp, draw: drawShot });
  const c = world(v, MG_AT[0] - 3, MG_AT[1] + sy - 3);
  G.parts.push({ type: 'debris', x: c.x, y: c.y, vx: -v.f * rand(0.4, 1.1), vy: -rand(1.4, 2.2), g: 0.2, life: 28, max: 28, size: 1, c: '#e8b43a' });
  Snd.hmg();
}
const ageUp = b => { b.age++; };
function drawShot(b) {
  if (b.age < 2) return;
  const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, x = Math.round(b.x), y = Math.round(b.y);
  R(Math.round(b.x - ux * 7), Math.round(b.y - uy * 7), 2, 2, '#ff8c1a');
  R(Math.round(b.x - ux * 4) - 1, Math.round(b.y - uy * 4) - 1, 3, 3, '#ffb52e');
  R(x - 1, y - 1, 3, 3, '#ffe066'); R(x, y, 1, 1, '#ffffff');
}

// Cannon: a shell in an arc that bursts on a robot, the ground, or a boulder, egg or log in its way (radius 30, 8)
function fireCannon(p, r, v) {
  r.shells--; r.ccd = 34; r.recoil = 4; r.cflash = 7; r.susV += 0.9;
  const d = dirOf(v, CANNON_A), m = world(v, MUZ[0], MUZ[1] + Math.round(r.sus));
  G.pb.push({ x: m.x - d.x * 3, y: m.y - d.y * 3, vx: d.x * SHELL_V, vy: d.y * SHELL_V, dmg: 8, life: 240, age: 0,
    update: shellUpdate, draw: drawShell, onHit: shellBurst, onGround: shellGround, onProp: () => true, onPow: () => true });
  for (let i = 0; i < 4; i++) G.parts.push({ type: 'smoke', x: m.x + d.x * 4 + rand(-2, 2), y: m.y + d.y * 4 + rand(-2, 2), vx: d.x * rand(0.3, 0.9), vy: d.y * 0.5 - rand(0.1, 0.4), life: rand(22, 34), max: 34, size: rand(2, 3.5) });
  r.vx -= d.x * 0.5;
  G.shake = Math.max(G.shake, 2);
  Snd.cannon();
}
function shellUpdate(b) {
  b.age++; b.vy += SHELL_G;
  if (b.age % 2 === 0) G.parts.push({ type: 'smoke', x: b.x - b.vx * 1.5, y: b.y - b.vy * 1.5, vx: 0, vy: -0.2, life: 22, max: 22, size: 1.8 });
  for (const s of G.eb) {
    if (s.life > 0 && (s.shoot || (EB_TYPES[s.k] && EB_TYPES[s.k].shootable)) && Math.hypot(s.x - b.x, s.y - b.y) < 10) {
      s.life = 0; b.life = 0; blast(b.x, b.y, 30, 8, 'player'); return;
    }
  }
}
function shellBurst(b) { blast(b.x, b.y, 30, 8, 'player'); }
function shellGround(b) { const gy = groundAt(b.x); blast(b.x, gy - 5, 30, 8, 'player'); dust(b.x, gy, 6); }
function drawShell(b) {
  const s = SHELL[mod(Math.round(Math.atan2(b.vy, b.vx) / (Math.PI / 4)), 8)], sp = Math.hypot(b.vx, b.vy) || 1;
  const tx = b.x - b.vx / sp * 5, ty = b.y - b.vy / sp * 5;
  R(Math.round(tx - b.vx / sp * 3) - 1, Math.round(ty - b.vy / sp * 3) - 1, 2, 2, '#ff8c1a');
  R(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3, (G.t >> 1) & 1 ? '#ffd23f' : '#fff3b0');
  ctx.drawImage(s.img, Math.round(b.x) - s.ox, Math.round(b.y) - s.oy);
}

// ============================================================
// Damage, getting out, the wreck
// ============================================================
function rideHurt(p, r) {
  const v = viewAt(p.x, p.y, r.rot, p.facing), before = platesFor(r.armour);
  r.armour = Math.max(0, r.armour - 1); r.hitT = 8; r.susV += 1.2;
  G.shake = Math.max(G.shake, 3.5);
  const c = world(v, rand(-12, 16), rand(-30, -14));
  sparks(c.x, c.y, 10); sparks(c.x, c.y, 4, '#ffffff');
  Snd.clank(); Snd.tone('square', 320, 110, 0.18, 0.09);
  for (let n = before; n > platesFor(r.armour); n--) plateOff(v, KEEP[n - 1], r.sus);
  if (r.armour <= 0) { wreck(p, r); return; }
  p.inv = 60;
  if (r.armour === 2) G.texts.push({ x: p.x, y: p.y - 66, s: 'ARMOUR LOW!', t: 70, c: '#ff8a5c' });
}
function plateOff(v, i, sus) {
  const [lx, ly] = mid(PLATES[i]), w = world(v, lx, ly + Math.round(sus));
  G.parts.push({ type: 'sprite', s: v.f > 0 ? PLATES[i] : PLATES_FLIP[i], x: w.x, y: w.y, vx: v.f * (lx > 0 ? 1 : -1) * rand(0.6, 1.8), vy: -rand(3, 4.5), g: 0.2, rot: 0, vr: rand(-0.35, 0.35), life: 70, max: 70 });
  sparks(w.x, w.y, 5);
}
// a parked tractor where the ride stands (armed: the hero may get in again at once)
function park(x, f, r, armed) {
  r.vx = 0; r.muzzle = 0; r.cflash = 0; r.air = false; r.board = 0; r.hitT = 0;
  const o = { k: 'tractor', x, y: line(x, f).y, hitT: 0, dead: false, facing: f, r, armed, doomed: 0, parts: null, near: false };
  G.props.push(o);
  return o;
}
// ↓ + Z: the hero hops out of the seat and the tractor stays where it stands, armour and shells kept
function getOut(p, r) {
  const v = viewAt(p.x, p.y, r.rot, p.facing), s = world(v, -7, -13 + Math.round(r.sus));
  park(p.x, p.facing, r, false);
  exitRide(p, false);
  p.x = s.x; p.y = Math.min(s.y, groundAt(s.x));
  Snd.tone('square', 300, 150, 0.1, 0.06);
}
// armour 0: the hero is thrown clear, the tractor blinks and blows up 0.7 s later where it stands
function wreck(p, r) {
  const v = viewAt(p.x, p.y, r.rot, p.facing), s = world(v, -7, -13 + Math.round(r.sus));
  const o = park(p.x, p.facing, r, false);
  o.k = 'tractorwreck'; o.doomed = 42;   // not a ride any more (the harness bot walks into rides)
  exitRide(p, true);
  p.x = s.x; p.y = Math.min(s.y, groundAt(s.x));
  G.texts.push({ x: o.x, y: o.y - 78, s: 'BAIL OUT!', t: 50, c: '#ff8a5c' });
  Snd.hurt();
}
function doomUpdate(o, v) {
  const r = o.r;
  o.doomed--;
  G.shake = Math.max(G.shake, 1.2);
  if (o.doomed % 5 === 0) { const s = world(v, rand(-20, 22), rand(-30, -8)); sparks(s.x, s.y, 3, '#ffb52e'); }
  if (o.doomed % (o.doomed > 20 ? 10 : 5) === 0) Snd.tone('square', 880, 880, 0.05, 0.06);
  hurtSmoke(v, r);
  if (o.doomed <= 0) explode(o, v);
}
function explode(o, v) {
  blast(o.x, o.y - 18, 44, 10, 'player');   // a big boom that also hits robots close by
  G.later.push({ t: 8, x: o.x - 16 * o.facing, y: o.y - 34, s: 1.1 }, { t: 15, x: o.x + 14 * o.facing, y: o.y - 16, s: 0.9 });
  G.sflash = Math.max(G.sflash, 0.45); G.shake = Math.max(G.shake, 7);
  debris(o.x, o.y - 20, 10, PAL.r); debris(o.x, o.y - 20, 8, PAL.p); debris(o.x, o.y - 10, 6, PAL.t);
  // the big wheel bounces and rolls away; the small wheel, the turret, the plates and the exhaust cap tumble
  const parts = o.parts = [];
  const add = (s, lx, ly, vx, vy, vr, rad, roll) => {
    const w = world(v, lx, ly);
    parts.push({ s, x: w.x, y: w.y, vx: vx * o.facing, vy, rot: 0, vr: vr * o.facing, rad, roll, life: rand(120, 160) | 0, smoke: !roll && rad > 5 });
  };
  add(REAR[0], REAR_AT[0], REAR_AT[1], -rand(1.4, 2.2), -rand(4.6, 5.4), -0.2, 11.5, true);
  add(FRONT[0], FRONT_AT[0], FRONT_AT[1], rand(1.6, 2.4), -rand(3.6, 4.4), 0.3, 7.5, true);
  add(TURRET, -13, -57, rand(-0.8, 0.8), -rand(4.4, 5.2), rand(-0.25, 0.25), 6, false);
  add(CANNON, -2, -59, rand(0.6, 1.4), -rand(4.2, 5), rand(0.2, 0.4), 3, false);
  add(BITS[0], 8, -20, rand(0.8, 2), -rand(3.5, 5), rand(0.2, 0.45), 3, false);
  add(BITS[0], -10, -22, -rand(0.8, 2), -rand(3.5, 5), -rand(0.2, 0.45), 3, false);
  add(BITS[1], 22, -12, rand(1.2, 2.4), -rand(3, 4.4), rand(0.3, 0.5), 3, false);
  add(BITS[1], -32, -18, -rand(1.2, 2.4), -rand(3, 4.4), -rand(0.3, 0.5), 3, false);
  const [fx, fy] = mid(FLAG[0][0]);
  add(FLAG[0][0], fx, fy, -rand(0.4, 1), -rand(2.5, 3.5), rand(-0.1, 0.1), 4, false);
  add(CAP[0], 11, -37, rand(-1, 1), -rand(4.5, 6), 0.5, 2, false);
  o.boomT = 0;
}
function wreckUpdate(o) {
  let alive = false;
  o.boomT++;
  for (const q of o.parts) {
    if (q.life <= 0) continue;
    if (--q.life <= 0 || q.x < G.cam.x - 40 || q.x > G.cam.x + W + 40) { q.life = 0; continue; }
    alive = true;
    q.vy = Math.min(q.vy + 0.22, 7); q.x += q.vx; q.y += q.vy; q.rot += q.vr;
    const gy = groundAt(q.x) - q.rad;
    if (q.y >= gy) {
      q.y = gy;
      if (q.vy > 1.2) { q.vy *= -0.42; q.vx *= 0.8; dust(q.x, gy + q.rad, 2); if (!q.roll) q.vr *= 0.5; }
      else { q.vy = 0; q.vx *= q.roll ? 0.985 : 0.85; if (!q.roll) q.vr *= 0.7; }
      if (q.roll) q.vr = q.vx / q.rad;
    }
    if (q.smoke && q.life % 6 === 0) G.parts.push({ type: 'smoke', x: q.x, y: q.y, vx: 0, vy: -0.4, life: 26, max: 26, size: 1.6 });
  }
  if (!alive && o.boomT > 60) o.dead = true;
}
// the flying parts (rotation in 15 degree steps, so they stay pixel-crisp) and a scorch mark that fades
function drawWreck(o) {
  const a = clamp(1 - o.boomT / 170, 0, 1);
  if (a > 0) {
    const x = Math.round(o.x), y = Math.round(groundAt(o.x));
    ctx.fillStyle = 'rgba(38,26,22,' + (0.55 * a).toFixed(2) + ')';
    ctx.fillRect(x - 20, y - 1, 40, 2); ctx.fillRect(x - 14, y - 2, 28, 1); ctx.fillRect(x - 26, y, 52, 1);
  }
  for (const q of o.parts) {
    if (q.life <= 0) continue;
    ctx.save();
    ctx.translate(Math.round(q.x), Math.round(q.y));
    ctx.rotate(Math.round(q.rot / (Math.PI / 12)) * Math.PI / 12);
    ctx.scale(o.facing, 1);
    if (q.life < 20) ctx.globalAlpha = q.life / 20;
    ctx.drawImage(q.s.img, -Math.round(q.s.w / 2), -Math.round(q.s.h / 2));
    ctx.restore();
  }
}

// ============================================================
// Drawing the ride, and the HUD panel
// ============================================================
function rideDraw(p, r) {
  const v = viewAt(p.x, p.y, r.rot, p.facing);
  const idle = Math.abs(r.vx) < 0.2 && !r.air, sus = Math.round(r.sus) + (idle ? (G.t >> 3) & 1 : 0);
  const wt = r.hitT > 4 || (p.inv > 0 && r.hitT <= 0 && p.inv % 10 < 2);
  const st = stateOf(r, p.facing, sus, wt);
  if (r.board > 0) {
    const k = 1 - r.board / BOARD;
    drawTractor(v, st, () => hopHero(p, r, v, k), k < 0.55, r.armour);
  } else drawTractor(v, st, p.hidden ? null : () => seatHero(p, v, sus), false, r.armour);
}
function rideHud(r) {
  spr(ICON, 128, 7);
  text('TRACTOR', 155, 8, '#ffe066');
  // armour: six bolted segments, green, then yellow, then red and blinking; the one just lost flashes white
  const col = r.armour > 3 ? ['#8be0a8', '#d4ffe0'] : r.armour > 1 ? ['#ffd23f', '#fff3b0'] : ['#ff6b6b', '#ffc2c2'];
  const blink = r.armour <= 2 && G.t % 30 < 12;
  for (let i = 0; i < ARMOUR; i++) {
    const x = 156 + i * 7;
    if (i === r.armour && r.hitT > 0) RO(x, 21, 5, 4, '#ffffff');
    else if (i < r.armour) { RO(x, 21, 5, 4, blink ? col[1] : col[0]); R(x, 21, 5, 1, col[1]); }
    else { RO(x, 21, 5, 4, '#3a3a4a'); R(x + 2, 22, 1, 1, '#22222e'); }
  }
  spr(SHELL_ICON, 204, 18);
  text('X' + r.shells, 228, 20, r.shells ? '#ffffff' : G.t % 30 < 15 ? '#ff6b6b' : '#7a3a3a', 1, 'right');
}

RIDES.tractor = {
  update: rideUpdate,
  box: p => ({ x: p.x - 24, y: p.y - 40, w: 48, h: 40 }),
  draw: rideDraw,
  hurt: rideHurt,
  hud: rideHud,
  help: 'C: CANNON   DOWN+Z: GET OUT'   // its own keys: shown at the first boarding and on the pause screen
};

// ============================================================
// The parked tractor (level prop { k: 'tractor', x }): idling, 'GET IN!' while the hero is near, boarded by walking
// into it. Also the tractor left behind by ↓ + Z, and the doomed one about to blow up.
// ============================================================
function propUpdate(o) {
  const r = o.r, p = G.p;
  if (o.parts) { wreckUpdate(o); return; }
  const gl = line(o.x, o.facing);
  o.y = gl.y; r.rot = gl.rot;
  tick(r, false);
  r.ga = Math.max(0, r.ga - 0.13);
  const v = viewAt(o.x, o.y, r.rot, o.facing);
  if (o.doomed > 0) { doomUpdate(o, v); return; }
  exhaust(v, r, false, true);
  hurtSmoke(v, r);
  if (!p || p.dead) { o.near = false; return; }
  const dx = Math.abs(p.x - o.x);
  if (!o.armed && dx > 26) o.armed = true;   // after getting out: walk away first, then back in
  o.near = !p.ride && dx < 110;
  if (o.armed && !p.ride && !p.hidden && dx < 22 && Math.abs(p.y - o.y) < 34) boardIt(p, o);
}
function boardIt(p, o) {
  const r = o.r, gl = line(o.x, o.facing), hx = p.x - o.x, hy = p.y - gl.y;
  if (!boardRide(p, r)) return;
  o.dead = true;
  r.board = BOARD; r.hopX = hx; r.hopY = hy; r.vx = 0; r.rot = gl.rot; r.air = false;
  p.x = o.x; p.y = gl.y; p.vy = 0; p.onGround = true; p.facing = o.facing;
  Snd.jump();
  if (!r.hello) {
    r.hello = true;
    G.texts.push({ x: o.x, y: gl.y - 84, s: 'BATTLE TRACTOR!', t: 90, c: '#ffe066' });
    G.texts.push({ x: o.x, y: gl.y - 70, s: RIDES.tractor.help, t: 160, c: '#ffffff' });
    say('Battle tractor!', 1.1, 1);
  }
}
function propDraw(o) {
  if (o.x < G.cam.x - 100 || o.x > G.cam.x + W + 100) return;
  if (o.parts) { drawWreck(o); return; }
  const r = o.r, v = viewAt(o.x, o.y, r.rot, o.facing);
  let wt = false;
  if (o.doomed > 0) {
    // blinking white faster and faster, shaking
    wt = o.doomed < 16 ? ((G.t >> 1) & 1) === 1 : (G.t >> 2) % 3 === 0;
    v.x += Math.round((hsh(G.t) - 0.5) * 3); v.y += Math.round((hsh(G.t + 7) - 0.5) * 2);
  }
  drawTractor(v, stateOf(r, o.facing, Math.round(r.sus) + ((G.t >> 3) & 1), wt), null, false, r.armour);
  if (o.near && !o.doomed) prompt(o);
}

// the doomed tractor blinking before it blows up, then its flying parts
PROP_TYPES.tractorwreck = { box: () => null, hit() {}, update: propUpdate, draw: propDraw };

PROP_TYPES.tractor = {
  make(o) {
    o.r = o.r || newRide(); o.facing = o.facing || 1; o.armed = o.armed !== false;
    o.doomed = o.doomed || 0; o.parts = null; o.near = false; o.y = line(o.x, o.facing).y;
  },
  box: () => null,   // can't be shot or blown up while parked
  hit() {},
  update: propUpdate,
  draw: propDraw
};
}
