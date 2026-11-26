'use strict';
var L5ART = L5ART || {};
// =====================================================================================================================
// Mission 5 (ALIEN MOTHERSHIP) gear. Owner: gear. docs/level5-spec.md section 5.
//
// THE MINI UFO: RIDES.miniufo + PROP_TYPES.miniufo (parked on its hazard pad at x 3520 and 4520, a blinking GET IN!).
//   A stolen toy saucer: silver-white disc, red stripe with running lights, a yellow star sticker on the bowl, a red
//   tail fin, a glass bubble with the hero inside (hand on the stick), a nose blaster, a beam emitter underneath.
//   Arrows   fly in eight directions (2 px a frame, a little glide); the disc's centre stays between y 60 and 22 px
//            above the deck, inside the screen and (in Mission 5) inside x 3310-4950. It leans into its flight.
//   X        the nose blaster: yellow bolts, 1 damage, every 8 frames, level, 1 px under the disc's centre (23 px
//            over the deck straight after boarding, 21 at the lowest hover: they hit an oggle, not an 18-px roly eye).
//   hold C   the CYAN grab beam straight down (up to 110 px, a 24-px column). The first robot in it whose type has
//            grab: true is taken out of G.enemies and hangs under the UFO, drawn by its type's
//            cargoDraw(x, y, t, rot, e): x, y = its middle, t = frames since it was grabbed, rot = radians (about 0
//            while it dangles, spinning once thrown), e = the robot itself; without a cargoDraw it is a plain green
//            ball. Let go: it is thrown forward in an arc and bursts where it lands or hits: its own onKill (its
//            burst, its points), a blast (radius 30, 6 damage, 8 to a boss; crates break, cow pods open), its points
//            once more and STRIKE! X2. The beam also pulls pick-ups up into the UFO and frees a cow pod it touches.
//            The charge bar holds 180 frames, drains while the beam is on and refills at half speed; run empty, the
//            cargo is thrown and C has to be let go first.
//   Down+Z   get out: the hero drops out of the floor hatch. The UFO stays there (same armour and charge), keeps
//            clear of the hero's head, and once the hero has stepped 30 px away it sinks to boarding height: walk
//            into it to get in again. (A safety net: after 10.5 s it takes a hero still standing under it back in.
//            That is longer than the test bot leaves a vehicle alone, so the bot can never be stuck beside one.)
//   5 armour pips, 70 mercy frames a hit; every hit leaves its mark (scratches, a rim panel gone, the fin snapped,
//   cracked glass, smoke, a little fire). At 0 the hero is thrown clear, the UFO blinks, wobbles and pops (a blast
//   that also hurts robots close by). At x 4950 it says TOO BIG FOR THE AIRLOCK!, and when the hero keeps pushing it
//   parks itself there and lets the hero out.
//   Private prop kinds: miniufopad (the empty pad), miniufodock (the UFO parked at the airlock: can be boarded, but
//   is not a RIDES key, so the test bot does not walk back into it) and miniufowreck (blinking, then the pop).
//
// THE RAY GUN: WEAPONS.raygun + ITEMS.Z. A captured oggle gun: CYAN rings (never green: green is the robots'),
//   2 damage, each ring goes through up to 3 robots, 40 ammo (max 80), every 14 frames.
//
// Everything in the block is private. Sprites are painted once with the cast's pixel helpers (M5.px), on first use
// or from the level's bake queue (L5ART.bakes). No Math.random()/rand() at load time or in drawing code.
// =====================================================================================================================
{
const Math = globalThis.Math;

// ---------------------------------------------------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------------------------------------------------
const RANGE = [3310, 4950];        // Mission 5: the UFO stays on the hull (AREA 3); at RANGE[1] the airlock is too small
const TOP = 60, LOW = 22;          // the disc's centre hovers between y TOP and LOW px above the deck
const CY = 19;                     // p.y of a riding hero = the bottom of the beam emitter, CY below the disc's centre
const SPEED = 2, GLIDE = 0.17, EDGE = 26;
const ARMOUR = 5, MERCY = 70;
const CHARGE = 180, CHARGE_MIN = 15, BEAM_LEN = 110, BEAM_HW = 12;
const BOLT_CD = 8, BOLT_V = 7, BOLT_LIFE = 70;
const THROW_VX = 3.2, THROW_VY = -2.8, THROW_G = 0.16, STRIKE_R = 30, STRIKE_DMG = 6, STRIKE_BOSS = 8;
const BOARD = 18, DOCK_T = 30, REARM = 30, REARM_T = 630, SINK = 1.5, DOOM = 34, PAD_H = 2;
const HELP = 'X: LASER  C: GRAB BEAM  DOWN+Z: GET OUT';

const CYAN = '#4fe3ff', CYANL = '#c8f7ff', CYAND = '#2a8fb8', MAG = '#ff4fa3', AMB = '#ffcf3a', AMBL = '#fff2a8';
const UF = { w: '#ffffff', l: '#e6ecf7', m: '#bcc8de', d: '#8d9dbd', D: '#5f6f96', k: '#39425f', K: '#1d2236',
  r: '#e0302a', R: '#ff6b5a', q: '#a3151a', y: '#ffd23f', Y: '#fff3b0', o: '#c98a16' };
const rgba = (c, a) => { const v = hex(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')'; };
const inM5 = () => typeof L5 !== 'undefined' && !!L5.level && LV === L5.level;
const glow = (x, y, r, c, a) => { if (typeof M5 !== 'undefined' && M5.glow) M5.glow(x, y, r, c, a); };

// ---------------------------------------------------------------------------------------------------------------------
// Art, painted once. Local coordinates: facing right, (0, 0) = the centre of the disc.
// ---------------------------------------------------------------------------------------------------------------------
const CW = 108, CH = 58, OX = 52, OY = 33;       // the two canvases the UFO is put together on each frame
const MUZ = [44, 1];                             // the blaster's mouth
const STAR = ['.....y.....', '.....y.....', '....yyy....', '....yyy....', 'yyyyyyyyyyy', '.yyyyyyyyy.', '..yyyyyyy..', '...yyyyy...', '..yyyyyyy..', '..yyy.yyy..', '.yy.....yy.'];
let ART = null;
const art = () => ART || (ART = buildArt());
(L5ART.bakes = L5ART.bakes || []).push(art);

function buildArt() {
  const { NONE, I, buf, put, get, rect, shape, ball, line, poly, outline, bake, mk, canvasOf } = M5.px;
  const S = M5.PAL.S;
  const only = b => ({ img: bake(b), w: b.w, h: b.h, ox: b.ox, oy: b.oy });
  const A = {};

  // ---- the saucer: bowl with the star sticker, beam emitter, disc with the red stripe, cockpit collar, console, stick
  const starAt = (b, x0, y0) => STAR.forEach((row, j) => { for (let i = 0; i < 11; i++) if (row[i] === 'y') put(b, x0 + i, y0 + j, j < 4 || (j === 4 && i < 6) ? UF.Y : j > 8 ? UF.o : UF.y); });
  const sb = buf(72, 30, 36, 9);
  ball(sb, 0, 2, 18, 14.5, [UF.D, UF.d, UF.m, UF.l, UF.w], (x, y) => y > 2, 0.45, -0.85, [0.3, -0.1, -0.56, -0.86]);
  for (let x = -17; x <= 17; x++) if (get(sb, x, 7) !== NONE && (x < -5 || x > 7)) put(sb, x, 7, x > 7 ? UF.m : UF.D);   // a plate seam round the bowl
  put(sb, -12, 5, UF.k); put(sb, -9, 10, UF.k); put(sb, 12, 5, UF.d);                                 // rivets
  starAt(sb, -4, 4);
  rect(sb, -7, 15, 15, 2, UF.k); rect(sb, -5, 17, 11, 2, UF.D); rect(sb, -5, 17, 11, 1, UF.d); rect(sb, -3, 18, 7, 1, CYAND);
  shape(sb, -31, -7, 31, 7, (x, y) => (x / 30.4) ** 2 + (y / 6.5) ** 2 <= 1, (x, y) => I(y < -4 ? UF.w : y < -2 ? (x > -14 ? UF.w : UF.l) : y < -1 ? UF.R : y < 1 ? UF.r : y < 2 ? UF.q : y < 4 ? UF.m : y < 5 ? UF.d : UF.D));
  for (let x = -26; x <= 26; x += 8) put(sb, x, -1, '#b3261f');                                      // lamp sockets in the stripe (lit live)
  for (const x of [-23, 21]) rect(sb, x, 5, 3, 1, UF.k);                                             // hover lamps (lit live)
  rect(sb, 16, -5, 9, 1, UF.l); put(sb, -24, -3, UF.m); put(sb, -21, -4, UF.m);                      // panel lines on the white top
  rect(sb, -15, -7, 31, 1, UF.m); rect(sb, -16, -6, 33, 1, UF.d); rect(sb, -15, -7, 12, 1, UF.l);    // the cockpit's collar
  rect(sb, 9, -9, 7, 2, UF.D); rect(sb, 9, -9, 7, 1, UF.d); put(sb, 14, -9, AMB); put(sb, 12, -9, CYAN);
  rect(sb, 10, -11, 1, 2, UF.k); rect(sb, 9, -13, 3, 2, UF.r); put(sb, 9, -13, UF.R);                // the stick with its red knob
  outline(sb);
  A.saucer = mk(sb);

  // ---- the red toy-rocket tail fin: whole, snapped, and the piece that flies off
  const fin = whole => {
    const b = buf(24, 17, 37, 16);
    if (whole) {
      poly(b, [[-25, -3], [-34, -14], [-28, -14], [-17, -4]], I(UF.r));
      line(b, -33, -13, -25, -4, I(UF.R)); line(b, -28, -13, -19, -5, I(UF.q)); rect(b, -33, -14, 5, 1, UF.w);
    } else {
      poly(b, [[-25, -3], [-31, -10], [-28, -9], [-26, -11], [-23, -8], [-17, -4]], I(UF.r));
      line(b, -30, -9, -25, -4, I(UF.R)); line(b, -22, -7, -19, -5, I(UF.q)); put(b, -28, -8, UF.K); put(b, -25, -9, UF.K);
    }
    outline(b);
    return mk(b);
  };
  A.fin = fin(true); A.finBroken = fin(false);
  const ft = buf(12, 9, 36, 16);
  poly(ft, [[-31, -10], [-34, -14], [-28, -14], [-24, -9], [-26, -11], [-28, -9]], I(UF.r)); rect(ft, -33, -14, 5, 1, UF.w); line(ft, -33, -13, -30, -10, I(UF.R));
  outline(ft);
  A.finTip = only(ft);

  // ---- the nose blaster (its own sprite: it kicks back)
  const gb = buf(22, 11, -25, 5);
  rect(gb, 28, -2, 2, 5, UF.k); rect(gb, 28, -2, 2, 1, UF.D);
  rect(gb, 30, 0, 10, 3, UF.d); rect(gb, 30, 0, 10, 1, UF.w); rect(gb, 30, 2, 10, 1, UF.D);
  rect(gb, 33, 0, 1, 3, UF.k); rect(gb, 36, 0, 1, 3, UF.k);
  rect(gb, 40, -1, 3, 5, UF.y); rect(gb, 40, -1, 3, 1, UF.Y); rect(gb, 40, 3, 3, 1, UF.o);
  outline(gb);
  A.gun = mk(gb);

  // ---- the glass bubble: a faint tint behind the pilot, the bright rim and the glints in front
  const D = { x: 0, y: -12, r: 17, cut: -6 };
  const dist = (x, y) => Math.hypot(x - D.x, y - D.y), ang = (x, y) => Math.atan2(y - D.y, x - D.x);
  const back = buf(40, 26, 20, 31), front = buf(40, 26, 20, 31);
  shape(back, -18, -30, 18, D.cut, (x, y) => dist(x, y) <= D.r - 1 && y < D.cut, (x, y) => { const s = x + y * 0.9; return I(s > -19 && s < -16 ? '#ffffff' : x > 6 ? '#3f9fc4' : '#9fe6ff'); });
  const rim = b => {
    shape(b, -19, -31, 19, D.cut, (x, y) => { const d = dist(x, y); return y < D.cut && d <= D.r + 0.5 && d > D.r - 1.6; }, (x, y) => {
      const d = dist(x, y), a = ang(x, y);
      if (d > D.r - 0.55) return I(OUT);
      return I(a < -2.0 ? '#ffffff' : a < -1.0 ? '#c8f7ff' : a < -0.2 ? '#74d3ee' : a > 2.6 ? '#e8fbff' : '#4aa8cc');
    });
    shape(b, -19, -31, 19, D.cut, (x, y) => { const d = dist(x, y), a = ang(x, y); return d < 13.3 && d > 12 && a > -2.7 && a < -2.05; }, I('#ffffff'));
    shape(b, -19, -31, 19, D.cut, (x, y) => { const d = dist(x, y), a = ang(x, y); return d < 13.3 && d > 12.2 && a > -1.92 && a < -1.75; }, I('#e8fbff'));
    put(b, 10, -20, '#ffffff'); put(b, 11, -19, '#ffffff');
  };
  rim(front);
  A.domeBack = only(back); A.dome = mk(front);

  // ---- the seat (behind the pilot; it shows when the UFO is empty)
  const seat = buf(12, 16, 13, 22);
  rect(seat, -11, -17, 4, 11, '#7a2a35'); rect(seat, -11, -17, 1, 11, '#a8414c'); rect(seat, -8, -17, 1, 11, '#561a24');
  rect(seat, -12, -21, 5, 4, '#7a2a35'); rect(seat, -12, -21, 5, 1, '#a8414c'); rect(seat, -11, -12, 4, 1, '#561a24');
  outline(seat);
  A.seat = only(seat);

  // ---- damage, one layer per armour pip lost (index = pips left: 4, 3, 2, 1), drawn over the saucer and the glass
  const crack = (b, pts, c = '#ffffff') => {
    for (let i = 0; i + 1 < pts.length; i++) line(b, pts[i][0] + 1, pts[i][1], pts[i + 1][0] + 1, pts[i + 1][1], I('#1f6f8f'));
    for (let i = 0; i + 1 < pts.length; i++) line(b, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], I(c));
  };
  const hole = (b, x, w) => {       // a rim panel gone: dark inside, a bare rib, two bolt holes, a loose wire
    rect(b, x, -2, w, 4, UF.K); rect(b, x, -2, w, 1, UF.k); rect(b, x + (w >> 1), -2, 1, 4, UF.k);
    put(b, x, -1, UF.d); put(b, x + w - 1, 1, UF.d); put(b, x + 1, 2, AMB); put(b, x + 2, 3, AMB);
  };
  const dmg = n => {
    const b = buf(72, 46, 36, 32);
    if (n === 4) {                  // scratches and a dent
      line(b, -22, -5, -15, -3, I(UF.D)); put(b, -18, -5, UF.d); put(b, -14, -3, UF.d); line(b, 15, -4, 19, -3, I(UF.d));
      rect(b, 9, 10, 2, 2, UF.k); put(b, 11, 10, UF.D); put(b, 9, 12, UF.D); put(b, 10, 12, UF.D); put(b, 8, 10, UF.d); put(b, 11, 9, UF.w);
      put(b, 22, 3, UF.D); put(b, 23, 3, UF.d); put(b, -13, 3, UF.D);
    } else if (n === 3) {           // a rim panel gone, the first crack in the glass
      hole(b, 6, 8);
      crack(b, [[8, -27], [11, -23], [9, -20], [13, -16], [12, -12]]); crack(b, [[11, -23], [14, -24]]);
    } else if (n === 2) {           // soot on the bowl, more scratches (the fin snaps too)
      for (let i = 0; i < 26; i++) { const x = 4 + Math.floor(hsh(i * 3.3) * 13), y = 4 + Math.floor(hsh(i * 7.7 + 2) * 11); if ((x / 18) ** 2 + ((y - 2) / 14.5) ** 2 < 0.86) put(b, x, y, i % 3 ? UF.D : UF.k); }
      line(b, -9, -5, -5, -4, I(UF.d)); put(b, -27, 0, UF.q); put(b, -28, 1, UF.K);
    } else {                        // a second panel gone, a star crack on the left of the glass
      hole(b, -21, 7);
      crack(b, [[-10, -21], [-6, -25]]); crack(b, [[-10, -21], [-14, -24]]); crack(b, [[-10, -21], [-13, -16], [-11, -11]]); crack(b, [[-10, -21], [-5, -18], [-3, -13]]);
      put(b, -10, -21, '#ffffff'); put(b, -9, -21, '#ffffff'); put(b, -10, -22, '#ffffff');
    }
    return only(b);
  };
  A.dmg = [null, dmg(1), dmg(2), dmg(3), dmg(4)];
  const pan = buf(10, 6, 1, 1);
  rect(pan, 0, 0, 8, 4, UF.r); rect(pan, 0, 0, 8, 1, UF.w); rect(pan, 0, 1, 8, 1, UF.R); rect(pan, 0, 3, 8, 1, UF.q); put(pan, 2, 2, '#ffd6d1');
  outline(pan);
  A.panel = only(pan);
  A.flame = [0, 1].map(k => {
    const b = buf(9, 12, 4, 10);
    rect(b, -2, -4, 5, 4, '#ff8c1a'); rect(b, -1, -6 - k, 3, 2, '#ff8c1a'); put(b, 0, -8 + k, '#ff8c1a'); rect(b, -1, -3, 3, 3, '#ffd23f'); put(b, 0, -4 - k, '#ffd23f'); put(b, 0, -2, '#fff3b0');
    return only(b);
  });

  // ---- what flies when it pops: the two halves of the bubble and of the saucer, the star sticker
  const half = (src, x0, x1, cut) => {
    const b = buf(x1 - x0, src.h, -x0, src.oy);
    for (let y = -src.oy; y < src.h - src.oy; y++) for (let x = x0; x < x1; x++) {
      const v = get(src, x, y);
      if (v === NONE || (Math.abs(x - cut) < 2 + hsh(y * 3.7) * 3)) continue;
      put(b, x, y, v);
    }
    return only(b);
  };
  const whole = buf(40, 26, 20, 31);
  shape(whole, -18, -30, 18, D.cut, (x, y) => dist(x, y) <= D.r - 1 && y < D.cut, (x, y) => I(x + y * 0.6 < -16 ? '#dff9ff' : x > 8 ? '#5fb9dc' : '#9fe6ff'));
  rim(whole);
  A.parts = { domeL: half(whole, -20, 1, 0), domeR: half(whole, -1, 20, 0), discL: half(sb, -36, 1, 0), discR: half(sb, -1, 36, 0) };
  const st = buf(13, 13, 1, 1); starAt(st, 0, 0); outline(st);
  A.parts.star = only(st);

  // ---- HUD icon
  const ic = buf(26, 20, 13, 12);
  shape(ic, -7, -10, 7, -2, (x, y) => (x * x + (y + 3) ** 2 <= 49) && y < -2, (x, y) => I(x < -2 && y > -8 ? '#dff9ff' : '#74d3ee'));
  rect(ic, -1, -7, 3, 4, I('#e8762c')); rect(ic, -1, -4, 3, 2, I('#9b59b6'));
  shape(ic, -11, -2, 11, 3, (x, y) => (x / 10.6) ** 2 + (y / 2.9) ** 2 <= 1, (x, y) => I(y < -1 ? UF.w : y < 0 ? UF.r : y < 1 ? UF.q : UF.d));
  shape(ic, -6, 2, 6, 6, (x, y) => (x / 5.6) ** 2 + ((y - 1) / 4.6) ** 2 <= 1 && y > 2, (x, y) => I(y < 4 ? UF.m : UF.d));
  put(ic, 0, 3, UF.y); put(ic, -1, 3, UF.y); put(ic, 1, 3, UF.y); put(ic, 0, 2, UF.Y); put(ic, 0, 4, UF.y);
  outline(ic);
  A.icon = only(ic);

  // ---- the hazard pad a parked UFO hovers over. Local (0, 0) = the deck under its middle
  const pad = buf(68, 12, 34, 11);
  rect(pad, -29, -7, 58, 1, S[7]); rect(pad, -29, -6, 58, 1, S[5]);                                   // the top plate
  rect(pad, -28, -5, 56, 4, '#1a1826');
  for (let x = -28; x < 28; x++) for (let y = -5; y <= -2; y++) if (((x - y + 60) >> 2) % 2) put(pad, x, y, y === -5 ? AMBL : AMB);   // hazard stripes on its face
  rect(pad, -29, -1, 58, 1, S[2]);
  rect(pad, -32, -3, 3, 3, S[4]); rect(pad, -32, -3, 3, 1, S[6]); rect(pad, 29, -3, 3, 3, S[3]); rect(pad, 29, -3, 3, 1, S[5]);   // little ramps
  rect(pad, -28, -10, 3, 3, S[4]); rect(pad, 25, -10, 3, 3, S[4]);                                    // lamp housings (lit live)
  for (const x of [-17, -1, 15]) rect(pad, x, -7, 3, 1, CYAND);                                       // landing lights (lit live)
  outline(pad);
  A.pad = only(pad);

  // ---- the two canvases the UFO is composed on (behind and in front of the pilot)
  A.back = canvasOf(CW, CH); A.bg = A.back.getContext('2d');
  A.front = canvasOf(CW, CH); A.fg = A.front.getContext('2d');
  A.bg.imageSmoothingEnabled = false; A.fg.imageSmoothingEnabled = false;
  return A;
}

// ---------------------------------------------------------------------------------------------------------------------
// Drawing the UFO. It leans by shearing: every column slides down by round(x * n / 30) px (n = how many px the nose
// dips), so the pixels stay crisp and the pilot stays upright.
// ---------------------------------------------------------------------------------------------------------------------
const shearY = (lx, n) => n ? Math.round((lx + 0.5) * n / 30) : 0;
function shearBlit(cv, x, y, f, n) {
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  if (!n) ctx.drawImage(cv, -OX, -OY);
  else {
    const k = n / 30;
    for (let a = -OX; a < CW - OX;) {
      const off = Math.round((a + 0.5) * k);
      let e = a + 1;
      while (e < CW - OX && Math.round((e + 0.5) * k) === off) e++;
      ctx.drawImage(cv, a + OX, 0, e - a, CH, a, off - OY, e - a, CH);
      a = e;
    }
  }
  ctx.restore();
}
// the pilot in the bubble: the hero's idle pose, a hand on the stick (the pistol is clipped away)
function seatHero(x, y, f, n, t, jolt) {
  ctx.save();
  ctx.translate(x + f * 2, y + 8 + shearY(2, n) - (jolt ? 1 : 0)); ctx.scale(f, 1);
  ctx.beginPath(); ctx.rect(-30, -60, 60, 39); ctx.rect(-30, -21, 37, 9); ctx.clip();
  drawHero(HEROES[G.hero], 0, 0, 1, { pose: 'idle', t, aim: 'fwd', weapon: 'pistol', muzzle: 0 });
  ctx.restore();
}
// v = { x, y (the disc's centre on the screen), f, n, armour, wt (white: hit flash), on (engine running), hero (a
// function drawing the pilot, or null), heroFront, recoil, muzzle, fwd, up (thrust 0..1), beam }
const V = { x: 0, y: 0, f: 1, n: 0, armour: ARMOUR, wt: false, on: true, hero: null, heroFront: false, recoil: 0, muzzle: 0, fwd: 0, up: 0, beam: false };
function drawUfo(v) {
  const A = art(), bg = A.bg, fg = A.fg, a = v.armour, wt = v.wt, t = G.t;
  const P = (g, s, dx = 0, dy = 0) => g.drawImage(wt && s.white ? s.white : s.img, OX - s.ox + dx, OY - s.oy + dy);
  bg.clearRect(0, 0, CW, CH); fg.clearRect(0, 0, CW, CH);
  if (!wt) { bg.globalAlpha = 0.17; P(bg, A.domeBack); bg.globalAlpha = 1; }
  P(bg, A.seat);
  P(fg, a <= 2 ? A.finBroken : A.fin);
  P(fg, A.saucer);
  P(fg, A.dome);
  if (!wt) {
    for (let k = 4; k >= Math.max(1, a); k--) P(fg, A.dmg[k]);
    // the lamps in the stripe: one light runs round the rim (they glimmer faintly while it is parked)
    const run = (t >> 2) % 7;
    for (let i = 0; i < 7; i++) {
      const lx = -26 + i * 8;
      if ((a <= 3 && lx >= 6 && lx < 14) || (a <= 1 && lx >= -21 && lx < -14)) continue;          // that panel is gone
      fg.fillStyle = !v.on ? ((t >> 5) + i) % 7 === 0 ? '#ffd6d1' : '#c9544a' : i === run ? '#ffffff' : '#ffd6d1';
      fg.fillRect(OX + lx, OY - 1, 1, 1);
    }
    // hover lamps under the rim, the console, the emitter
    const dead = a <= 1 && hsh(t >> 2) < 0.55;
    fg.fillStyle = v.on ? CYANL : CYAND; fg.fillRect(OX - 23, OY + 5, 3, 1);
    fg.fillStyle = v.on && !dead ? CYANL : CYAND; fg.fillRect(OX + 21, OY + 5, 3, 1);
    fg.fillStyle = v.beam ? '#ffffff' : v.on ? CYAN : CYAND; fg.fillRect(OX - 3, OY + 18, 7, 1);
    if (v.beam || (v.on && (t >> 3) % 4 === 0)) { fg.fillStyle = '#ffffff'; fg.fillRect(OX - 1, OY + 18, 3, 1); }
    if (v.on && (t >> 4) % 2) { fg.fillStyle = AMBL; fg.fillRect(OX + 14, OY - 9, 1, 1); }
    if (a <= 1) P(fg, A.flame[(t >> 2) & 1], 10, -3);
    if ((t + 40) % 150 < 6) { fg.fillStyle = '#ffffff'; fg.fillRect(OX - 13, OY - 21, 1, 3); fg.fillRect(OX - 14, OY - 20, 3, 1); }   // a glint on the glass
  }
  P(fg, A.gun, -Math.round(v.recoil), 0);
  shearBlit(A.back, v.x, v.y, v.f, v.n);
  if (v.hero && !v.heroFront) v.hero();
  shearBlit(A.front, v.x, v.y, v.f, v.n);
  if (v.hero && v.heroFront) v.hero();
  if (wt) return;
  // light straight on the screen: hover lamps, their jets when it climbs, the tail jet when it flies forward
  const W2 = (lx, ly) => [v.x + v.f * lx, v.y + ly + shearY(lx, v.n)];
  const pulse = 0.5 + 0.12 * Math.sin(t / 7);
  if (v.on) {
    for (const lx of [-22, 22]) {
      if (lx > 0 && a <= 1 && hsh(t >> 2) < 0.55) continue;
      const [gx, gy] = W2(lx, 6);
      glow(gx, gy, 6 + v.up * 3, CYAN, pulse + v.up * 0.3);
      if (v.up > 0.25) { const l = 2 + (((t >> 1) + (lx > 0 ? 1 : 0)) & 1) + Math.round(v.up * 2); ctx.fillStyle = CYANL; ctx.fillRect(gx - (v.f > 0 ? 1 : 0), gy, 2, l); ctx.fillStyle = '#ffffff'; ctx.fillRect(gx - (v.f > 0 ? 1 : 0), gy, 1, 1); }
    }
    if (v.fwd > 0.25) {
      const [tx, ty] = W2(-31, 0), l = 3 + ((t >> 1) % 3) + Math.round(v.fwd * 3), x0 = v.f > 0 ? tx - l : tx + 1;
      glow(tx - v.f * 3, ty, 7, CYAN, 0.55);
      ctx.fillStyle = CYAN; ctx.fillRect(x0, ty - 1, l, 3);
      ctx.fillStyle = CYANL; ctx.fillRect(v.f > 0 ? tx - l + 2 : tx + 1, ty, l - 2, 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(v.f > 0 ? tx - 2 : tx + 1, ty, 2, 1);
    }
  }
  if (v.muzzle > 0) {
    const [mx, my] = W2(MUZ[0] - Math.round(v.recoil) + 2, MUZ[1]);
    glow(mx, my, 11, '#ffd23f', 0.7); flashAt(mx, my, v.muzzle > 1);
  }
}

// its shadow on the deck when it flies low (so it is easy to see what it hovers over)
function deckShadow(x, cy) {
  const gy = Math.round(groundAt(x)), h = gy - (cy + CY);
  if (h > 64 || h < -2) return;
  const w = Math.round(21 - h * 0.2);
  ctx.fillStyle = rgba('#05040d', 0.36 - h * 0.004);
  ctx.fillRect(x - w, gy, w * 2 + 1, 1); ctx.fillRect(x - w + 4, gy + 1, w * 2 - 7, 1);
}
// the grab beam: a cyan cone from the emitter (x, y0) down len px; hits = it reaches the deck. Drawn in two goes:
// the light (behind what it holds), then its crisp edges, the rings sliding up and the sparkles (in front)
const beamHW = j => Math.round(4 + j / BEAM_LEN * 10);
function drawBeamBack(x, y0, len, hits, pw) {
  const t = G.t;
  glow(x, y0 + 2, 15, CYAN, 0.55 * pw);
  for (let j = 0; j < len; j++) {
    const k = j / BEAM_LEN, hw = beamHW(j), band = ((j + 600 - (t >> 1)) % 6) < 3, fade = (hits ? 1 : Math.min(1, (len - j) / 20)) * pw;
    ctx.fillStyle = rgba(CYAN, (band ? 0.46 : 0.3) * (1 - k * 0.3) * fade); ctx.fillRect(x - hw, y0 + j, hw * 2 + 1, 1);
    const iw = Math.round(hw * 0.4);
    ctx.fillStyle = rgba(CYANL, 0.24 * (1 - k * 0.5) * fade); ctx.fillRect(x - iw, y0 + j, iw * 2 + 1, 1);
  }
  if (hits) {                                                  // the pool of light on the deck
    const hw = beamHW(len), y1 = y0 + len;
    glow(x, y1, 24, CYAN, 0.4 * pw);
    ctx.fillStyle = rgba(CYANL, 0.85 * pw); ctx.fillRect(x - hw - 2, y1, hw * 2 + 5, 1);
    ctx.fillStyle = rgba(CYAN, 0.5 * pw); ctx.fillRect(x - hw - 5, y1 + 1, hw * 2 + 11, 2);
  }
}
function drawBeamFront(x, y0, len, hits, pw) {
  const t = G.t;
  for (let j = 0; j < len; j++) {
    const hw = beamHW(j), fade = (hits ? 1 : Math.min(1, (len - j) / 20)) * pw;
    ctx.fillStyle = rgba(CYANL, (0.9 - j / BEAM_LEN * 0.45) * fade); ctx.fillRect(x - hw, y0 + j, 1, 1); ctx.fillRect(x + hw, y0 + j, 1, 1);
  }
  for (let i = 0; i < 4; i++) {
    const u = (t / 46 + i / 4) % 1, j = Math.round((1 - u) * len), hw = beamHW(j);
    ctx.fillStyle = rgba('#ffffff', (0.3 + 0.5 * Math.sin(u * Math.PI)) * pw); ctx.fillRect(x - hw, y0 + j, hw * 2 + 1, 1);
  }
  for (let i = 0; i < 10; i++) {
    const u = (t / (50 + i * 7) + hsh(i * 3.7)) % 1, j = Math.round((1 - u) * (len - 4)), hw = beamHW(j) - 1;
    ctx.fillStyle = i % 3 ? '#ffffff' : CYANL; ctx.fillRect(Math.round(x + (hsh(i * 9.1) - 0.5) * 2 * hw), y0 + j, 1, i % 4 === 0 ? 2 : 1);
  }
}

// what hangs in the beam (or flies after the throw): the robot type's own cargoDraw, else a plain green ball
function greenBall(x, y, rot) {
  const GR = M5.PAL.G;
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = OUT;
  for (let j = -10; j <= 10; j++) { const hw = Math.floor(Math.sqrt(100.5 - j * j)); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
  for (let j = -9; j <= 9; j++) { const hw = Math.floor(Math.sqrt(81.5 - j * j)); ctx.fillStyle = j < -5 ? GR[5] : j < -1 ? GR[4] : j < 5 ? GR[3] : GR[2]; ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
  ctx.fillStyle = GR[6]; ctx.fillRect(x - 5, y - 6, 3, 2); ctx.fillRect(x - 6, y - 4, 1, 2);
  for (let k = 0; k < 3; k++) { const a = rot + k * 2.094, rx = Math.round(Math.cos(a) * 6), ry = Math.round(Math.sin(a) * 6); ctx.fillStyle = GR[1]; ctx.fillRect(x + rx - 1, y + ry - 1, 2, 2); ctx.fillStyle = GR[6]; ctx.fillRect(x + rx - 1, y + ry - 1, 1, 1); }
}
function drawCargo(c, x, y, rot) {
  const T = ENEMY_TYPES[c.e.type], F = FLASH;
  FLASH = false;
  if (T && typeof T.cargoDraw === 'function' && !c.plain) {
    ctx.save();
    try { T.cargoDraw(x, y, c.t, rot, c.e); } catch (err) { c.plain = true; errorOnce(err); }
    ctx.restore();
  }
  if (!T || typeof T.cargoDraw !== 'function' || c.plain) greenBall(x, y, rot);
  FLASH = F;
}

// ---------------------------------------------------------------------------------------------------------------------
// The ride: state and helpers
// ---------------------------------------------------------------------------------------------------------------------
const newRide = () => ({
  type: 'miniufo', armour: ARMOUR, charge: CHARGE, cd: 0, muzzle: 0, recoil: 0, hitT: 0, board: 0, hopX: 0, hopY: 0,
  vx: 0, vy: 0, tilt: 0, tiltV: 0, t: 0, beam: false, beamT: 0, lock: false, cargo: null, dockT: 0, sayT: 0, hello: false
});
const tiltN = r => clamp(Math.round(r.tilt), -4, 4);
const bobOf = r => Math.round(Math.sin(r.t * 0.085) * (1.7 - Math.min(1, Math.hypot(r.vx, r.vy) / SPEED) * 1.1));
// timers every UFO runs, flown or parked; a beam that is off recharges at half speed
function tick(r) {
  r.t++;
  if (r.cd > 0) r.cd--;
  if (r.muzzle > 0) r.muzzle--;
  if (r.hitT > 0) r.hitT--;
  if (r.sayT > 0) r.sayT--;
  if (r.recoil > 0) r.recoil = Math.max(0, r.recoil - 0.4);
  if (!r.beam) r.charge = Math.min(CHARGE, r.charge + 0.5);
}
// world position of a local point of the UFO whose disc centre is at (x, cy)
const worldPt = (x, cy, f, n, lx, ly) => [x + f * lx, cy + ly + shearY(lx, n)];
// a badly hurt UFO smokes from the hole in its rim
function hurtSmoke(x, cy, f, r) {
  if (r.armour > 2 || r.t % (r.armour <= 1 ? 3 : 6)) return;
  const [sx, sy] = worldPt(x, cy, f, tiltN(r), 10 + rand(-2, 2), -4);
  G.parts.push({ type: 'smoke', x: sx, y: sy, vx: -f * rand(0.1, 0.4), vy: -rand(0.5, 0.9), life: 40, max: 40, size: rand(1.8, 3) });
  if (r.armour <= 1 && r.t % 15 === 0) sparks(sx, sy + 2, 2, '#ffb52e');
}

// ---------------------------------------------------------------------------------------------------------------------
// Flying (RIDES.miniufo.update)
// ---------------------------------------------------------------------------------------------------------------------
function rideUpdate(p, r) {
  tick(r);
  p.crouch = false; p.onGround = false; p.onPlat = null; p.aim = 'fwd'; p.kb = 0; p.vy = 0;
  if (r.board > 0) {                                   // the hero is hopping into the bubble: it waits
    p.vx = 0;
    if (--r.board === 0) { Snd.tone('sine', 220, 660, 0.25, 0.08); Snd.tone('triangle', 440, 990, 0.2, 0.05, 0.08); }
    return;
  }
  const L = ctl('left'), Rt = ctl('right'), U = ctl('up'), D = ctl('down');
  if (D && ctlTap('jump')) { getOut(p, r); return; }
  let dx = (Rt ? 1 : 0) - (L ? 1 : 0), dy = (D ? 1 : 0) - (U ? 1 : 0);
  if (dx && dx !== p.facing) { p.facing = dx; r.tilt = -r.tilt; r.tiltV = -r.tiltV; }
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
  r.vx += (dx * SPEED - r.vx) * GLIDE; r.vy += (dy * SPEED - r.vy) * GLIDE;
  if (!dx && Math.abs(r.vx) < 0.03) r.vx = 0;
  if (!dy && Math.abs(r.vy) < 0.03) r.vy = 0;
  let x = p.x + r.vx, cy = p.y - CY + r.vy;
  // inside the screen, and in Mission 5 inside AREA 3
  const cam = G.cam.x, lim = inM5() ? RANGE : null;
  let lo = cam + EDGE, hi = cam + W - EDGE;
  if (lim) { lo = Math.max(lo, lim[0]); hi = Math.max(lo, Math.min(hi, lim[1])); }
  if (x < lo) { x = lo; if (r.vx < 0) r.vx = 0; }
  if (x > hi) { x = hi; if (r.vx > 0) r.vx = 0; }
  // the airlock at the end of the hull: a bump and a word; keep pushing and it parks itself and lets the hero out
  if (lim && x >= lim[1] - 0.5 && Rt && !L) {
    if (r.dockT === 0 && r.sayT <= 0) {
      r.sayT = 150;
      G.texts.push({ x: Math.max(cam + 76, x - 56), y: cy - 44, s: 'TOO BIG FOR THE AIRLOCK!', t: 110, c: '#ffe066' });
      Snd.tone('square', 180, 90, 0.12, 0.08); Snd.noise(0.08, 0.12, 700);
      G.shake = Math.max(G.shake, 1.5);
    }
    if (++r.dockT >= DOCK_T) { p.x = x; p.y = cy + CY; dock(p, r); return; }
  } else r.dockT = 0;
  const low = groundAt(x) - LOW;
  if (cy > low) { cy = low; if (r.vy > 0) r.vy = 0; }
  if (cy < TOP) { cy = TOP; if (r.vy < 0) r.vy = 0; }
  p.x = x; p.y = cy + CY; p.vx = r.vx;
  // it leans into its flight (a soft spring, so it rocks back when it stops)
  r.tiltV = r.tiltV * 0.78 + (clamp(r.vx * p.facing / SPEED, -1, 1) * 3 - r.tilt) * 0.14;
  r.tilt += r.tiltV;
  if ((dx || dy) && r.t % 4 === 0) {
    const [sx, sy] = worldPt(x, cy, p.facing, tiltN(r), r.t % 8 ? -22 : 22, 8);
    G.parts.push({ type: 'spark', x: sx, y: sy, vx: -r.vx * 0.3 + rand(-0.2, 0.2), vy: rand(0.5, 1.1), life: 9, max: 9, size: 1, c: r.t % 8 ? CYANL : '#ffffff' });
  }
  hurtSmoke(x, cy, p.facing, r);
  if (ctl('fire') && r.cd <= 0) fireBolt(p, r);
  beamStep(p, r, ctl('bomb'));
}

// X: the nose blaster. The bolt starts inside the hull, so a robot touching the nose is hit too; it shows from the
// muzzle on. It flies level, from wherever the leaning nose is.
function fireBolt(p, r) {
  r.cd = BOLT_CD; r.muzzle = 3; r.recoil = 2;
  const f = p.facing, y = Math.round(p.y - CY) + MUZ[1] + shearY(MUZ[0], tiltN(r));
  G.pb.push({ x: p.x + f * 2, y, vx: f * BOLT_V, vy: 0, dmg: 1, life: BOLT_LIFE, sx: p.x + f * (MUZ[0] + 2), f, out: false, draw: drawBolt });
  Snd.tone('square', 1500, 520, 0.07, 0.05); Snd.tone('sine', 900, 300, 0.09, 0.05);
}
function drawBolt(b) {
  // hidden until it is past the muzzle (where the muzzle is now, while the UFO still flies the same way)
  const p = G.p, f = b.f;
  if (!b.out) {
    if (p && p.ride && p.ride.type === 'miniufo' && p.facing === f) b.sx = p.x + f * (MUZ[0] + 2);
    if ((b.x - b.sx) * f < 0) return;
    b.out = true;
  }
  const x = Math.round(b.x), y = Math.round(b.y), shown = Math.min(14, Math.round((b.x - b.sx) * f) + 4);
  glow(x - f * 4, y, 8, '#ffd23f', 0.5);
  const seg = (a, l, yy, h, c) => { const l2 = Math.min(l, shown - a); if (l2 > 0) R(f > 0 ? x - a - l2 + 1 : x + a, y + yy, l2, h, c); };
  seg(8, 6, 0, 1, '#ff7a1a'); seg(5, 5, -1, 3, '#ffb52e'); seg(0, 7, -1, 3, '#ffd23f'); seg(0, 6, 0, 1, '#fffbe0'); seg(-1, 1, 0, 1, '#fff3b0');
}

// hold C: the grab beam
function beamStep(p, r, want) {
  if (!want) r.lock = false;
  if (r.beam && !want) beamOff(p, r);
  else if (!r.beam && want && !r.lock) {
    if (r.charge >= CHARGE_MIN) { r.beam = true; r.beamT = 0; Snd.tone('sine', 300, 760, 0.18, 0.07); }
    else if (ctlTap('bomb')) Snd.tone('square', 200, 150, 0.05, 0.05);
  }
  if (!r.beam) return;
  r.charge--; r.beamT++;
  if (r.beamT % 9 === 1) Snd.tone('sine', 520 + (r.cargo ? 120 : 0), 560 + (r.cargo ? 120 : 0), 0.14, 0.025);
  const bx = p.x, y0 = p.y, gy = groundAt(bx), len = Math.max(1, Math.min(BEAM_LEN, gy - y0));
  const col = { x: bx - BEAM_HW, y: y0, w: BEAM_HW * 2, h: len };
  if (!r.cargo) {
    // the first robot in the column that can be grabbed (the nearest to the emitter)
    let best = null, bd = 1e9;
    for (const e of G.enemies) {
      if (!e.active || e.dead || e.inv || e.dying || e.state === 'dying' || e.state === 'intro') continue;
      const T = ENEMY_TYPES[e.type];
      if (!T || T.grab !== true) continue;
      const b = T.box(e);
      if (!overlap(col, b)) continue;
      const d = Math.max(0, b.y - y0);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) grab(p, r, best);
  } else {
    // it dangles under the emitter, trailing a little behind the flight
    const c = r.cargo;
    c.t++;
    const hx = p.x - r.vx * 3, hy = Math.min(p.y + 6 + c.hh, groundAt(c.x) - c.hh);
    c.x += (hx - c.x) * 0.28; c.y += (hy - c.y) * 0.28;
    c.rot = clamp((c.x - p.x) * 0.05, -0.5, 0.5) + Math.sin(c.t * 0.45) * 0.12;
  }
  // pick-ups float up into the UFO; a cow pod the beam touches opens
  for (const it of G.items) {
    if (it.gone || Math.abs(it.x - bx) > BEAM_HW + 6 || it.y < y0 - 24 || it.y - 14 > y0 + len + 2) continue;
    it.onGround = false; it.vx = 0; it.vy = -2.4; it.x += (bx - it.x) * 0.2;
  }
  for (const o of G.pows) if (o.state === 'tied' && overlap(col, powBox(o))) freePow(o);
  if (r.charge <= 0) {
    r.charge = 0; r.lock = true;
    beamOff(p, r);
    G.texts.push({ x: p.x, y: p.y - 60, s: 'BEAM EMPTY!', t: 60, c: '#ff8a5c' });
    Snd.tone('square', 240, 120, 0.12, 0.06);
  }
}
function beamOff(p, r) {
  r.beam = false;
  if (r.cargo) throwCargo(p, r, false);
  else Snd.tone('sine', 620, 260, 0.1, 0.04);
}
function grab(p, r, e) {
  const b = ebox(e), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  G.enemies = G.enemies.filter(q => q !== e);
  e.hitT = 0;
  r.cargo = { e, x: cx, y: cy, t: 0, rot: 0, plain: false, bx: e.x - cx, by: e.y - cy, hh: Math.max(6, b.h / 2) };
  G.texts.push({ x: p.x, y: p.y - CY - 36, s: 'GOTCHA!', t: 50, c: CYANL });
  for (let i = 0; i < 6; i++) G.parts.push({ type: 'spark', x: cx + rand(-8, 8), y: cy + rand(-8, 8), vx: rand(-0.4, 0.4), vy: rand(-1.8, -0.6), life: rand(10, 18), max: 18, size: 1, c: i % 2 ? CYANL : '#ffffff' });
  Snd.tone('sine', 260, 1040, 0.22, 0.09); Snd.tone('triangle', 520, 1560, 0.16, 0.05, 0.05);
}

// let go: the robot flies forward in an arc (a player bullet: the engine moves it and tells us when it lands)
const keep = () => true, noop = () => {};
function throwCargo(p, r, weak) {
  const c = r.cargo, f = p.facing;
  if (!c) return;
  r.cargo = null;
  G.pb.push({ x: c.x, y: c.y, vx: weak ? f * 0.8 : f * THROW_VX + r.vx * 0.5, vy: weak ? -1 : THROW_VY + Math.min(0, r.vy) * 0.5, dmg: 0, life: 900, pierce: true,
    cargo: c, rot: c.rot, vr: f * 0.3, update: thrownUpdate, draw: thrownDraw, onHit: noop, onGround: thrownGround, onProp: keep, onPow: keep });
  Snd.throw(); Snd.tone('sine', 900, 420, 0.3, 0.05);
}
function thrownUpdate(b) {
  const c = b.cargo, cam = G.cam.x;
  c.t++;
  b.vy = Math.min(b.vy + THROW_G, 7); b.rot += b.vr;
  const nx = b.x + b.vx, ny = b.y + b.vy;
  if (nx < cam - 6 || nx > cam + W + 6) { strike(b, clamp(nx, cam + 2, cam + W - 2), b.y); return; }      // it bursts on the screen's edge
  for (const e of G.enemies) {
    if (!e.active || e.dead || e.dying || e.state === 'dying' || e.state === 'intro') continue;
    if (distToBox(nx, ny, ebox(e)) < 8) { strike(b, nx, ny); return; }
  }
  for (const s of G.eb) {
    if (s.life > 0 && (s.shoot || (EB_TYPES[s.k] && EB_TYPES[s.k].shootable)) && Math.hypot(s.x - nx, s.y - ny) < 12) { s.life = 0; strike(b, nx, ny); return; }
  }
  for (const o of G.props) { const pb = !o.dead && propBox(o); if (pb && distToBox(nx, ny, pb) < 4) { strike(b, nx, ny); return; } }
  if (c.t % 3 === 0) G.parts.push({ type: 'spark', x: b.x, y: b.y, vx: 0, vy: 0, life: 10, max: 10, size: 1, c: CYANL });
}
function thrownGround(b) { strike(b, b.x, groundAt(b.x) - 4); }
function thrownDraw(b) {
  const x = Math.round(b.x), y = Math.round(b.y), d = b.vx < 0 ? 1 : -1;
  for (let i = 0; i < 3; i++) R(x + d * (13 + i * 4), y - 5 + i * 5, 5 - i, 1, i === 1 ? '#ffffff' : CYANL);   // speed lines
  drawCargo(b.cargo, b.x, b.y, b.rot);
}
// where it lands or hits: the robot's own end (its burst and its points), a blast, its points once more, STRIKE!
function strike(b, x, y) {
  b.life = 0;
  const c = b.cargo, e = c.e, T = ENEMY_TYPES[e.type], gy = groundAt(x);
  if (y > gy - 4) y = gy - 4;
  let pts = 0;
  if (T && !e.dead) {
    e.x = x + c.bx; e.y = y + c.by; e.vx = 0; e.vy = 0; e.active = true; e.inv = 0; e.hp = 0;
    const s0 = G.score;
    try { killEnemy(e); } catch (err) { e.dead = true; errorOnce(err); }
    pts = G.score - s0;
    if (!e.dead) G.enemies.push(e);                            // its type plays a death animation of its own
  }
  boom(x, y, STRIKE_R / 24);
  for (const q of G.enemies) if (q !== e && q.active && !q.dead && distToBox(x, y, ebox(q)) < STRIKE_R) damageEnemy(q, ENEMY_TYPES[q.type].boss ? STRIKE_BOSS : STRIKE_DMG);
  for (const o of G.props) { const pb = !o.dead && propBox(o); if (pb && distToBox(x, y, pb) < STRIKE_R) hitProp(o, 99, 'player'); }
  for (const o of G.pows) if (o.state === 'tied' && Math.abs(o.x - x) < STRIKE_R) freePow(o);
  if (pts > 0) G.score += pts;
  G.texts.push({ x, y: y - 34, s: pts > 0 ? 'STRIKE! X2' : 'STRIKE!', t: 80, c: '#ffe066' });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; G.parts.push({ type: 'spark', x, y, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6, life: 14, max: 14, size: 2, c: i % 2 ? '#ffe066' : '#ffffff' }); }
  G.shake = Math.max(G.shake, 4);
  Snd.tone('square', 660, 1320, 0.1, 0.07); Snd.tone('square', 990, 1980, 0.12, 0.06, 0.08);
}

// ---------------------------------------------------------------------------------------------------------------------
// Damage, getting out, the airlock, the pop
// ---------------------------------------------------------------------------------------------------------------------
function rideHurt(p, r) {
  const f = p.facing, cy = p.y - CY, n = tiltN(r);
  r.armour = Math.max(0, r.armour - 1); r.hitT = 8;
  r.tiltV += (r.t & 1 ? 1.4 : -1.4);                   // it rocks (its height is left alone: the bolts keep their line)
  G.shake = Math.max(G.shake, 3.5);
  const [hx, hy] = worldPt(p.x, cy, f, n, rand(-16, 18), rand(-14, 6));
  sparks(hx, hy, 9); sparks(hx, hy, 4, '#ffffff');
  Snd.clank(); Snd.tone('square', 340, 110, 0.18, 0.09);
  // every hit knocks something off
  const fly = (s, lx, ly, vx) => { const [x, y] = worldPt(p.x, cy, f, n, lx, ly); G.parts.push({ type: 'sprite', s, x, y, vx: f * vx + rand(-0.4, 0.4), vy: -rand(2.6, 3.8), g: 0.18, rot: 0, vr: rand(-0.35, 0.35), life: 70, max: 70 }); };
  const A = art();
  if (r.armour === 4) debris(hx, hy, 4, UF.m);
  else if (r.armour === 3) { fly(A.panel, 10, 0, 1.4); debris(p.x + f * 10, cy - 18, 3, CYANL); }
  else if (r.armour === 2) fly(A.finTip, -30, -11, -1.3);
  else if (r.armour === 1) { fly(A.panel, -18, 0, -1.2); debris(p.x - f * 10, cy - 20, 5, CYANL); }
  if (r.armour <= 0) { pop(p, r); return; }
  p.inv = MERCY;
  if (r.armour === 2) G.texts.push({ x: p.x, y: cy - 44, s: 'ARMOUR LOW!', t: 70, c: '#ff8a5c' });
}
// a UFO left where it is: a parked one (k 'miniufo'), the one at the airlock ('miniufodock') or the doomed one
function park(p, r, k) {
  if (r.cargo) throwCargo(p, r, true);
  r.beam = false; r.vx = 0; r.vy = 0; r.board = 0; r.dockT = 0; r.muzzle = 0; r.recoil = 0;
  const o = makeProp({ k, x: p.x, y: p.y, cy: p.y - CY, f: p.facing, r, armed: false, pad: false });
  if (o) G.props.push(o);
  return o;
}
// Down + Z: the hero drops out of the bubble; the UFO stays (armour and charge kept) and sinks to boarding height
function getOut(p, r) {
  const cy = p.y - CY;
  park(p, r, 'miniufo');
  exitRide(p, false);
  p.y = cy + 8; p.vy = 0;                                      // straight down through the floor hatch
  Snd.tone('square', 300, 150, 0.1, 0.06);
}
function dock(p, r) {
  const cy = p.y - CY;
  park(p, r, 'miniufodock');
  exitRide(p, false);
  p.facing = 1; p.x += 10; p.y = cy + 8; p.vy = -1.5;
  Snd.tone('sine', 660, 220, 0.3, 0.07);
}
// armour 0: the hero is thrown clear, the UFO blinks and wobbles for half a second and pops
function pop(p, r) {
  const cy = p.y - CY, o = park(p, r, 'miniufowreck');
  if (o) { o.doom = DOOM; o.after = 0; }
  exitRide(p, true);
  p.y = cy + 8; p.vy = -3.6;
  G.texts.push({ x: p.x, y: cy - 44, s: 'BAIL OUT!', t: 50, c: '#ff8a5c' });
  Snd.hurt();
}
function wreckUpdate(o) {
  const r = o.r;
  r.t++;
  if (r.hitT > 0) r.hitT--;
  if (o.doom > 0) {
    o.doom--;
    o.cy = Math.min(groundAt(o.x) - LOW, o.cy + 0.7);
    G.shake = Math.max(G.shake, 1.2);
    if (o.doom % 4 === 0) sparks(o.x + rand(-22, 22), o.cy + rand(-12, 10), 3, '#ffb52e');
    if (o.doom % (o.doom > 16 ? 8 : 4) === 0) Snd.tone('square', 990, 990, 0.04, 0.06);
    hurtSmoke(o.x, o.cy, o.f, r);
    if (o.doom === 0) explode(o);
  } else if (++o.after > 2) o.dead = true;
}
function explode(o) {
  const A = art(), x = o.x, y = o.cy, f = o.f;
  blast(x, y, 34, 6, 'player');                                // the pop hurts robots close by too
  G.later.push({ t: 6, x: x - 14 * f, y: y - 12, s: 0.8 }, { t: 12, x: x + 16 * f, y: y + 6, s: 0.7 });
  G.sflash = Math.max(G.sflash, 0.4); G.shake = Math.max(G.shake, 6);
  debris(x, y, 8, UF.m); debris(x, y - 14, 8, CYANL); debris(x, y, 5, UF.r);
  const fly = (s, lx, ly, vx, vy, vr, g) => G.parts.push({ type: 'sprite', s, x: x + f * lx, y: y + ly, vx: f * vx + rand(-0.3, 0.3), vy: vy - rand(0, 0.8), g, rot: 0, vr: f * vr, life: 100, max: 100 });
  fly(A.parts.domeL, -9, -18, -1.6, -4.2, -0.2, 0.16); fly(A.parts.domeR, 9, -18, 1.5, -4.6, 0.22, 0.16);
  fly(A.parts.discL, -16, 4, -2.2, -3.2, -0.12, 0.18); fly(A.parts.discR, 16, 4, 2.4, -3.4, 0.14, 0.18);
  fly(o.r.armour <= 2 && A.finBroken ? A.finBroken : A.fin, -26, -8, -2.8, -4.4, -0.4, 0.18);
  fly(A.gun, 36, -1, 3.2, -3.6, 0.5, 0.18);
  fly(A.parts.star, 2, 9, 0.5, -5.2, 0.16, 0.07);              // the sticker flutters down last
  G.texts.push({ x, y: y - 30, s: 'POP!', t: 60, c: '#ffe066' });
  Snd.tone('square', 880, 110, 0.25, 0.1); Snd.noise(0.2, 0.2, 2400);
}

// ---------------------------------------------------------------------------------------------------------------------
// Drawing the ride, the HUD panel
// ---------------------------------------------------------------------------------------------------------------------
function view(x, cy, f, r) {
  V.x = Math.round(x); V.y = Math.round(cy) + bobOf(r); V.f = f; V.n = tiltN(r); V.armour = r.armour;
  V.wt = false; V.on = true; V.hero = null; V.heroFront = false; V.recoil = r.recoil; V.muzzle = r.muzzle;
  V.fwd = clamp(r.vx * f / SPEED, 0, 1); V.up = clamp(-r.vy / SPEED, 0, 1); V.beam = r.beam;
  return V;
}
function rideDraw(p, r) {
  const v = view(p.x, p.y - CY, p.facing, r), x = v.x, y = v.y, f = v.f, n = v.n;
  v.wt = r.hitT > 4 || (p.inv > 0 && r.hitT <= 0 && p.inv % 10 < 2);
  const c = r.cargo;
  let bl = 0, hits = false, pw = 1;
  if (!r.beam) deckShadow(x, y);
  if (r.beam) {
    const y0 = y + CY, gy = Math.round(groundAt(p.x));
    bl = Math.max(1, Math.min(BEAM_LEN, gy - y0)); hits = gy - y0 <= BEAM_LEN;
    pw = (r.charge < 40 && (G.t >> 1) % 2 ? 0.55 : 1) * Math.min(1, r.beamT / 5);
    drawBeamBack(x, y0, bl, hits, pw);
  }
  if (c) {
    const cx = Math.round(c.x), cyy = Math.round(c.y);
    drawCargo(c, c.x, c.y, c.rot);
    for (let i = 0; i < 3; i++) { const u = ((G.t + i * 5) % 15) / 15; ctx.fillStyle = rgba('#ffffff', 0.8 * (1 - u)); ctx.fillRect(cx - 7 + i * 7, cyy + Math.round(c.hh) + 2 - Math.round(u * 6) + (i & 1) * 2, 1, 3); }   // lift lines
  }
  if (r.beam) drawBeamFront(x, y + CY, bl, hits, pw);
  if (r.board > 0) {
    // the hero hops from where they stood into the bubble (in front of the UFO at first, then behind the glass)
    const k = 1 - r.board / BOARD, sx = x + f * 2, sy = y + 8;
    v.on = k > 0.6;
    v.heroFront = k < 0.6;
    v.hero = () => {
      if (k < 0.6) drawHero(HEROES[G.hero], sx + r.hopX * (1 - k), sy + r.hopY * (1 - k) - Math.sin(k * Math.PI) * 9, f, { pose: 'jump', t: p.t, aim: 'fwd', weapon: p.weapon, muzzle: 0 });
      else seatHero(x, y - Math.round((1 - k) * 10), f, n, p.t, false);
    };
  } else if (!p.hidden) v.hero = () => seatHero(x, y, f, n, p.t, r.hitT > 2);
  drawUfo(v);
}
function rideHud(r) {
  const A = art();
  ctx.drawImage(A.icon.img, 129, 8);
  text('MINI UFO', 157, 8, '#ffe066');
  // armour: five pips, red and blinking at two and less; the one just lost flashes white
  const low = r.armour <= 2, blink = low && G.t % 30 < 12;
  for (let i = 0; i < ARMOUR; i++) {
    const x = 157 + i * 7;
    if (i === r.armour && r.hitT > 0) RO(x, 21, 5, 4, '#ffffff');
    else if (i < r.armour) { RO(x, 21, 5, 4, low ? (blink ? '#ffc2c2' : '#ff6b6b') : UF.l); R(x, 21, 5, 1, low ? '#ffc2c2' : '#ffffff'); if (!low) R(x, 24, 5, 1, UF.d); }
    else { RO(x, 21, 5, 4, '#3a3a4a'); R(x + 2, 22, 1, 1, '#22222e'); }
  }
  // beam charge: a little cone, then the bar (red and blinking when it has run empty)
  const k = clamp(r.charge / CHARGE, 0, 1), w = Math.round(25 * k), empty = r.lock || (!r.beam && r.charge < CHARGE_MIN);
  R(195, 21, 3, 1, CYANL); R(194, 22, 5, 1, CYAN); R(193, 23, 7, 1, CYAN); R(193, 24, 7, 1, CYAND);
  RO(202, 21, 25, 4, empty && G.t % 16 < 8 ? '#5a2330' : '#2a2a3a');
  if (w > 0) { R(202, 21, w, 4, empty ? '#ff6b6b' : CYAN); R(202, 21, w, 1, empty ? '#ffc2c2' : CYANL); }
  if (r.beam && w > 2) R(202 + ((G.t >> 1) % w), 21, 1, 4, '#ffffff');
  if (r.cargo) { blob([[222, 9, 3, 5], [221, 10, 5, 3]], '#62d64f'); R(222, 10, 1, 1, '#e6ffc2'); R(223, 11, 2, 2, '#f6fbff'); R(224, 12, 1, 1, '#ff3b30'); }      // something green is on the hook
}

RIDES.miniufo = {
  update: rideUpdate,
  box: p => ({ x: p.x - 24, y: p.y - 43, w: 48, h: 40 }),
  draw: rideDraw,
  hurt: rideHurt,
  hud: rideHud,
  help: HELP
};

// ---------------------------------------------------------------------------------------------------------------------
// The parked UFO (level prop { k: 'miniufo', x }: it hovers over a hazard pad, GET IN! blinks over it), the UFO left by
// Down + Z and the one at the airlock. Walk into it to get in.
// ---------------------------------------------------------------------------------------------------------------------
function parkedMake(o) {
  o.r = o.r || newRide(); o.f = o.f || 1;
  if (o.pad == null) o.pad = true;
  if (o.cy == null) o.cy = o.y - LOW - (o.pad ? PAD_H : 0);
  if (o.armed == null) o.armed = true;
  o.wait = 0; o.near = false;
}
function parkedUpdate(o) {
  const r = o.r, p = G.p;
  tick(r);
  // it sinks to where the hero can step in
  const low = groundAt(o.x) - LOW - (o.pad ? PAD_H : 0);
  const dx = p ? Math.abs(p.x - o.x) : 999;
  // it sinks to where the hero can step in; but it keeps clear of the head of a hero who has only just got out
  const want = !o.armed && p && !p.dead && dx < REARM + 4 ? clamp(p.y - 60, TOP, low) : low;
  o.cy += clamp(want - o.cy, -SINK, SINK);
  hurtSmoke(o.x, o.cy, o.f, r);
  if (!p || p.dead) { o.near = false; return; }
  // after getting out: step away first, then back in (or wait 10.5 s). The one at the airlock: only by stepping away
  if (!o.armed && (dx > REARM || (o.k === 'miniufo' && ++o.wait > REARM_T))) o.armed = true;
  o.near = !p.ride && dx < 120;
  if (o.armed && !p.ride && !p.hidden && dx < 18 && p.y > o.cy - 64 && p.y - 32 < o.cy + 24) boardIt(p, o);
}
function boardIt(p, o) {
  const r = o.r, hx = p.x - (o.x + p.facing * 2), hy = p.y - (o.cy + 8);
  if (!boardRide(p, r)) return;
  if (o.pad) o.k = 'miniufopad'; else o.dead = true;         // the pad stays behind
  r.board = BOARD; r.hopX = hx; r.hopY = hy; r.vx = 0; r.vy = 0; r.tilt = 0; r.tiltV = 0; r.dockT = 0; r.lock = false; r.beam = false;
  p.x = o.x; p.y = o.cy + CY; p.vy = 0;
  Snd.jump();
  if (!r.hello) {
    r.hello = true;
    G.texts.push({ x: o.x, y: o.cy - 62, s: 'MINI UFO!', t: 90, c: '#ffe066' });
    G.texts.push({ x: clamp(o.x, G.cam.x + 122, G.cam.x + W - 122), y: o.cy - 50, s: HELP, t: 170, c: '#ffffff' });
    say('Mini U F O!', 1.2, 1);
  }
}
function padDraw(o) {
  if (o.x < G.cam.x - 40 || o.x > G.cam.x + W + 40) return;
  const A = art(), x = Math.round(o.x), y = Math.round(groundAt(o.x)), on = (G.t >> 4) % 2;
  ctx.drawImage(A.pad.img, x - A.pad.ox, y - A.pad.oy);
  R(x - 28, y - 10, 3, 2, on ? AMBL : '#8a6a12'); R(x + 25, y - 10, 3, 2, on ? '#8a6a12' : AMBL);
  glow(x + (on ? -27 : 26), y - 9, 7, AMB, 0.5);
  const run = (G.t >> 3) % 4;                                  // the landing lights run inwards
  for (let i = 0; i < 3; i++) if (run === 3 || i === run || 2 - i === run) R(x + [-17, -1, 15][i], y - 7, 3, 1, CYANL);
}
// GET IN! and an arrow, bouncing and blinking
function prompt(x, y) {
  if (G.t % 40 >= 30) return;
  const b = Math.round(Math.abs(Math.sin(G.t * 0.12)) * -4);
  y += b;
  text('GET IN!', x, y - 10, '#ffe066', 1, 'center');
  blob([[x - 1, y, 3, 3], [x - 3, y + 3, 7, 1], [x - 2, y + 4, 5, 1], [x - 1, y + 5, 3, 1], [x, y + 6, 1, 1]], '#ffe066');
  R(x - 1, y, 1, 3, '#fff6c2');
}
function parkedDraw(o) {
  if (o.x < G.cam.x - 60 || o.x > G.cam.x + W + 60) return;
  if (o.pad) padDraw(o);
  const r = o.r, v = view(o.x, o.cy, o.f, r);
  v.on = false; v.fwd = 0; v.up = 0; v.beam = false; v.muzzle = 0;
  if (!o.pad) deckShadow(v.x, v.y);
  drawUfo(v);
  glow(v.x, v.y + 12, 16, CYAN, 0.12 + 0.05 * Math.sin(G.t / 9));       // it still hums a little
  const p = G.p;
  if (p && !p.ride && !p.dead && !G.intro && o.k === 'miniufo' && o.armed && (o.pad || o.near)) prompt(v.x, v.y - 44);
}
function wreckDraw(o) {
  if (!(o.doom > 0) || o.x < G.cam.x - 60 || o.x > G.cam.x + W + 60) return;
  const r = o.r, v = view(o.x, o.cy, o.f, r);
  v.on = (G.t >> 1) % 2 === 0; v.fwd = 0; v.up = 0; v.beam = false; v.muzzle = 0;
  v.wt = o.doom < 14 ? ((G.t >> 1) & 1) === 1 : (G.t >> 2) % 3 === 0;
  v.n = (G.t >> 2) % 2 ? 3 : -3;                                       // it wobbles
  v.x += Math.round((hsh(G.t) - 0.5) * 3); v.y += Math.round((hsh(G.t + 7) - 0.5) * 2);
  drawUfo(v);
}
const PARKED = { make: parkedMake, box: () => null, hit() {}, update: parkedUpdate, draw: parkedDraw };   // can't be shot while parked
PROP_TYPES.miniufo = PARKED;
PROP_TYPES.miniufodock = { make: parkedMake, box: () => null, hit() {}, update: parkedUpdate, draw: parkedDraw };
PROP_TYPES.miniufopad = { box: () => null, hit() {}, draw: padDraw };
PROP_TYPES.miniufowreck = { make: parkedMake, box: () => null, hit() {}, update: wreckUpdate, draw: wreckDraw };

// =====================================================================================================================
// THE RAY GUN (WEAPONS.raygun, pickup ITEMS.Z): a captured oggle gun. Its rings are CYAN: 2 damage, through up to 3
// robots, 40 ammo (max 80), every 14 frames.
// =====================================================================================================================
// the gun, painted pointing forward (x along the barrel, y down, the hand at 0, 0) and turned for the other aims
const RG_BODY = '#c9d2e0', RG_DARK = '#8794a8', RG_GRIP = '#5f6f96';
const RG_OUT = [[0, -3, 9, 5], [1, 2, 3, 3], [-2, -4, 3, 2], [9, -1, 6, 1], [10, -2, 1, 3], [13, -2, 1, 3], [15, -2, 3, 3], [3, -5, 1, 2]];
const RG_COL = [
  [0, -3, 9, 5, RG_BODY], [0, -3, 9, 1, '#ffffff'], [0, 1, 9, 1, RG_DARK], [8, -2, 1, 3, RG_DARK],        // body
  [-2, -4, 3, 2, RG_DARK], [-2, -4, 3, 1, RG_BODY],                                                       // the back fin
  [1, 2, 3, 3, RG_GRIP], [1, 2, 1, 3, '#8d9dbd'],                                                         // grip
  [9, -1, 6, 1, RG_BODY], [10, -2, 1, 3, MAG], [13, -2, 1, 3, MAG],                                       // barrel and its two discs
  [3, -5, 1, 2, AMB]                                                                                      // a little aerial
];
const RG_AN = { fwd: [4, 3], up: [7, -4], down: [2, 9] };
const rgTurn = (q, aim) => aim === 'fwd' ? q : aim === 'up' ? [q[1], -q[0] - q[2] + 1, q[3], q[2]] : [q[1], q[0], q[3], q[2]];
let zapT = -99;                                    // G.t of the last shot (drawing only: the cell and the tip flare)
function rayGunDraw(aim, ty, r) {
  const an = RG_AN[aim] || RG_AN.fwd;
  const ox = an[0] - (aim === 'fwd' ? r : 0), oy = ty + an[1] + (aim === 'up' ? r : aim === 'down' ? -r : 0);
  ctx.fillStyle = OUT;
  for (const q of RG_OUT) { const t = rgTurn(q, aim); ctx.fillRect(ox + t[0] - 1, oy + t[1] - 1, t[2] + 2, t[3] + 2); }
  for (const q of RG_COL) { const t = rgTurn(q, aim); R(ox + t[0], oy + t[1], t[2], t[3], q[4]); }
  const hot = G.t - zapT >= 0 && G.t - zapT < 5, sh = (G.t >> 3) % 3;
  let t = rgTurn([2, -1, 4, 1], aim); R(ox + t[0], oy + t[1], t[2], t[3], hot ? '#ffffff' : CYAND);        // the power cell: a light runs along it
  t = rgTurn([2 + sh, -1, 2, 1], aim); R(ox + t[0], oy + t[1], t[2], t[3], hot ? '#ffffff' : CYAN);
  t = rgTurn([15, -2, 3, 3], aim); R(ox + t[0], oy + t[1], t[2], t[3], hot ? '#ffffff' : CYAN);            // the glowing tip
  t = rgTurn([15, -2, 1, 1], aim); R(ox + t[0], oy + t[1], t[2], t[3], '#ffffff');
  // the hand on the grip
  const h = aim === 'fwd' ? [ox, oy] : aim === 'up' ? [ox - 3, oy - 1] : [ox - 2, oy - 1];
  R(h[0], h[1], 3, 2, SKIN); R(h[0], h[1] + 1, 3, 1, SKIND);
}
function ringHit(b, e) {
  if (b.n >= 3) return;
  b.n++;
  damageEnemy(e, b.dmg);
  for (let i = 0; i < 5; i++) G.parts.push({ type: 'spark', x: b.x, y: b.y, vx: rand(-1.8, 1.8), vy: rand(-2, 1.4), g: 0.1, life: rand(8, 15), max: 15, size: 1, c: i % 2 ? CYANL : CYAN });
  if (b.n >= 3) b.life = 0;                         // the third robot stops it
}
function ringUpd(b) { b.age++; }
// a ring seen edge-on: the outline of a narrow oval (half-width rx along the flight, half-height ry across it)
function hoop(x, y, rx, ry, up, c) {
  ctx.fillStyle = c;
  const q = (a, b2, w, h) => { if (up) ctx.fillRect(x + b2, y + a, h, w); else ctx.fillRect(x + a, y + b2, w, h); };
  q(-(rx - 2), -ry, rx * 2 - 3, 1); q(-(rx - 2), ry, rx * 2 - 3, 1);
  q(-(rx - 1), -ry + 1, 1, 1); q(rx - 1, -ry + 1, 1, 1); q(-(rx - 1), ry - 1, 1, 1); q(rx - 1, ry - 1, 1, 1);
  q(-rx, -ry + 2, 1, ry * 2 - 3); q(rx, -ry + 2, 1, ry * 2 - 3);
}
// the shot: a cyan hoop that grows a little as it flies (bright on its leading side), two fainter ones behind it
function ringDraw(b) {
  const x = Math.round(b.x), y = Math.round(b.y), up = Math.abs(b.vy) > Math.abs(b.vx), g = Math.min(2, b.age >> 2), ry = 5 + g;
  const d = up ? Math.sign(b.vy) : Math.sign(b.vx), tx = up ? 0 : -d, ty = up ? -d : 0;
  glow(x, y, 11, CYAN, 0.45);
  if (b.age > 3) hoop(x + tx * 14, y + ty * 14, 2, ry - 3, up, rgba(CYAN, 0.3));
  if (b.age > 1) hoop(x + tx * 8, y + ty * 8, 2, ry - 2, up, rgba(CYAN, 0.6));
  hoop(x, y, 4, ry + 1, up, OUT); hoop(x, y, 2, ry - 1, up, OUT);
  hoop(x, y, 3, ry, up, (G.t >> 1) & 1 ? CYAN : CYANL);
  ctx.fillStyle = '#ffffff';                                   // the leading side shines
  if (up) ctx.fillRect(x - ry + 3, y + d * 3, ry * 2 - 5, 1); else ctx.fillRect(x + d * 3, y - ry + 3, 1, ry * 2 - 5);
  ctx.fillStyle = rgba(CYANL, 0.22);
  if (up) ctx.fillRect(x - ry + 2, y - 1, ry * 2 - 3, 3); else ctx.fillRect(x - 1, y - ry + 2, 3, ry * 2 - 3);
}
WEAPONS.raygun = {
  label: 'RAY GUN', ammo: 40, maxAmmo: 80, cd: 14, tapCd: 2,
  muzzle: aim => aim === 'up' ? [6, -44] : aim === 'down' ? [1, 7] : [23, -19],
  fire(p, mx, my, dx, dy) {
    G.pb.push({ x: mx, y: my, vx: dx * 6.5, vy: dy * 6.5, dmg: 2, life: 62, pierce: true, n: 0, age: 0, update: ringUpd, draw: ringDraw, onHit: ringHit });
    zapT = G.t;
    Snd.tone('sawtooth', 1700, 240, 0.13, 0.06); Snd.tone('sine', 880, 1900, 0.07, 0.05); Snd.tone('square', 1300, 650, 0.05, 0.03, 0.06);
  },
  drawGun: rayGunDraw,
  flash(x, y, aim) {
    const s = G.t - zapT, up = aim !== 'fwd';
    R(x - 1, y - 1, 3, 3, '#ffffff');
    if (s > 2 && s >= 0) return;
    hoop(x + (up ? 0 : 1), y + (aim === 'up' ? -1 : aim === 'down' ? 1 : 0), 3, 6, up, CYAN);
    R(up ? x - 6 : x, up ? y : y - 6, up ? 13 : 1, up ? 1 : 13, CYANL);
    R(x - 2, y - 2, 5, 5, CYANL); R(x - 1, y - 1, 3, 3, '#ffffff');
  },
  icon(x, y) {
    RO(x, y, 8, 5, RG_BODY); R(x, y, 8, 1, '#ffffff'); R(x, y + 4, 8, 1, RG_DARK); R(x + 2, y + 2, 4, 1, (G.t >> 3) % 2 ? CYAN : CYAND);
    RO(x + 1, y + 5, 3, 3, RG_GRIP);
    RO(x + 8, y + 2, 6, 1, RG_BODY); RO(x + 9, y + 1, 1, 3, MAG); RO(x + 12, y + 1, 1, 3, MAG);
    RO(x + 15, y + 1, 3, 3, CYAN); R(x + 15, y + 1, 1, 1, '#ffffff');
  }
};
ITEMS.Z = {
  draw: it => letterBox(it, '#1791c2', '#9fefff', '#ffffff'),
  collect(it, p) {
    giveWeapon(p, 'raygun');
    G.texts.push({ x: it.x, y: it.y - 24, s: 'RAY GUN!', t: 80, c: CYANL });
    say('Ray gun!', 0.7, 1);
  }
};
}
