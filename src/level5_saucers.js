'use strict';
var L5 = L5 || {};
var L5ART = L5ART || {};
// =====================================================================================================================
// Mission 5 (ALIEN MOTHERSHIP) saucers. Owner: saucers (docs/level5-spec.md section 3).
//   ENEMY_TYPES.eyedrone    the eye saucer (look: M5.drone, level5_cast.js). It hovers over the hero and
//                           - mode 'dive' (default): slides to one side, warns 40 frames (lamp, yellow eye, '!', a dotted
//                             green U and a ring on the deck), then swoops through where the hero stood (only the swoop
//                             hurts) and climbs back on the far side;
//                           - mode 'beam': stops above the hero, warns 45 frames (a dotted column and a ring), then drops
//                             its green beam for 50 frames (EB_TYPES.odbeam, a 20-px column: walk out);
//                           - asleep: parked on the deck on three legs, its eye shut, Zs; it wakes when the hero comes
//                             within 130 px or shoots it (lamp blinks 45 frames), then takes off;
//                           - carry: crosses the screen with a cow in its beam and never attacks; beaten, the cow floats
//                             down, lands and trots off left (MOO! +500, a bonus);
//                           - grab: true + cargoDraw(x, y, t, rot) for the MINI UFO's beam ((x, y) = its middle).
//                           hp 2, 150 points. Its first warning comes 150 frames after it turns up at the earliest.
//   ENEMY_TYPES.bigsaucer   the BIG SAUCER, mini-boss of the 4400 lock: a 64-px eye saucer with a ring of lamps and a tiny
//                           pilot under its dome; hp 90, 2000 points. Between attacks it comes down to shooting height
//                           and keeps its distance. Every tell lasts 56 frames or more:
//                           LAUNCH (its hatches flip open, it beeps and shakes, eye saucers pop out like toast: never
//                           more than 3 alive), BEAM SWEEP (it flies to the hero's side of the screen, arrows on the deck
//                           show the way and a post where it stops; then it crosses to the middle with its beam down,
//                           slower than the hero walks: run to the other half, or fly over it) and ROLLER DROP (a ring
//                           on a clear stretch of deck away from the hero, then a roly eye falls out of its bay: one
//                           for a hero on foot, two for a MINI UFO to throw). A hit of 6 or more (a thrown robot, a
//                           grenade, a meteor) is a BONK!. Below half it is battered and a little faster.
//                           Defeat: it goes haywire, the dome pops, the pilot bails out on a parachute, the eye boings
//                           out on a spring, it crashes and falls to bits (e.dead = true at the end: a mini-boss). Its
//                           lock is let go at the kill (GO > at once); the robots it launched pop one by one.
//   EB_TYPES.odbeam         a saucer's beam column (it follows its saucer and hurts once per beam)
//   L5.meteor(tx)           AREA 3: a burning rock from the upper right lands at world x tx
//   L5.craneCrate(tx)       AREA 1: the ceiling crane lowers a cargo crate over world x tx and lets go
//                           both: a blinking ring + red '!' on the landing spot and a dotted line (the crate: a striped
//                           shadow) for 60-90 frames first; a hero whose middle is outside the ring is safe; they can be
//                           shot in the air (+50); they hurt robots too (3; the BIG SAUCER 6); the crate stays as an
//                           engine `crate` prop (one in three holds a coin) unless it lands on somebody or something.
//                           Most of those the level aims right at a hero who stays where he is come down beside him
//                           instead (L5.hazardAim, 0..1 = how many are left on him: default 0.35; none in the BIG
//                           SAUCER's fight).
//   private EB kinds (all start with `od`): odmark (a landing marker; it also sees its thing shot down), odrock,
//   odcrate, odpod (a roly eye falling out of the BIG SAUCER), odwait (a hazard held back while another danger is on),
//   odwreck (the eye saucer's burst: dome up, wings apart, the eye pod dropping with an X), odcow, odpilot.
// Fair play, as in Mission 3: ONE telegraphed danger of this file at a time (a saucer's warning, the BIG SAUCER's tells,
// a falling hazard); a held hazard comes as soon as the air is clear.
// Everything else is private to the block. Sprites are baked on first use (M5.px), never per frame; no Math.random /
// rand() at load time or in drawing.
// =====================================================================================================================
{
const Math = globalThis.Math;

// ---------------------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------------------
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const h2 = (x, y, s) => hsh(x * 12.9898 + y * 78.233 + s * 37.719);
function vn2(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return lerp(lerp(h2(i, j, s), h2(i + 1, j, s), a), lerp(h2(i, j + 1, s), h2(i + 1, j + 1, s), a), b);
}
const fbm2 = (x, y, s) => (vn2(x, y, s) + 0.5 * vn2(x * 2.03, y * 2.03, s + 13)) / 1.5;
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
const hx2 = v => (v < 16 ? '0' : '') + v.toString(16);
const mixc = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => hx2(Math.round(v + (B[i] - v) * k))).join(''); };
// crisp discs, rings and lines for the live bits (rows of rects, never arc())
function pdisc(x, y, r, c) { ctx.fillStyle = c; x = Math.round(x); y = Math.round(y); for (let j = -r; j <= r; j++) { const hw = Math.floor(Math.sqrt(r * r - j * j + r * 0.8)); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); } }
function pring(x, y, rx, ry, c, n = 72) { ctx.fillStyle = c; for (let a = 0; a < n; a++) { const t = a / n * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(t) * rx), Math.round(y + Math.sin(t) * ry), 1, 1); } }
function pline(x0, y0, x1, y1, w, c, out) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), o = out ? 1 : 0, h = (w - 1) / 2;
  ctx.fillStyle = out ? OUT : FLASH ? '#ffffff' : c;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n - h) - o, Math.round(y0 + (y1 - y0) * i / n - h) - o, w + 2 * o, w + 2 * o);
}
function star(x, y, r, c) { x = Math.round(x); y = Math.round(y); ctx.fillStyle = c; ctx.fillRect(x - r, y, r * 2 + 1, 1); ctx.fillRect(x, y - r, 1, r * 2 + 1); if (r > 2) ctx.fillRect(x - 1, y - 1, 3, 3); }
const onScreen = (e, m = 8) => e.x > G.cam.x + m && e.x < G.cam.x + W - m;
// the first thing a falling object lands on at world x, coming from above y0: a one-way platform or the deck
function surfaceAt(x, y0 = 0) {
  let f = groundAt(x);
  for (const pl of LV.plats) if (pl.y >= y0 && pl.y < f && x > pl.x - 3 && x < pl.x + pl.w + 3) f = pl.y;
  return f;
}
// the x nearest to tx (within lo..hi, and if possible at least `away` px from ax) where no platform is over the deck
// for `half` px each way
function clearDeck(tx, half, lo, hi, ax, away) {
  const free = x => !LV.plats.some(pl => x + half > pl.x - 3 && x - half < pl.x + pl.w + 3);
  let best = null;
  for (let d = 0; d < 420; d += 6) for (const s of [1, -1]) {
    const x = tx + s * d;
    if (x < lo || x > hi || !free(x)) continue;
    if (Math.abs(x - ax) >= away) return x;
    if (best == null) best = x;
  }
  return best == null ? tx : best;
}
// the floor under the hero (his feet when he stands, the bottom of his ride, the surface below him in a jump)
function heroFloor(p) {
  if (p.ride) { const b = pbox(p); return b.y + b.h; }
  return p.onGround ? p.y : surfaceAt(p.x, p.y - 2);
}

// ---------------------------------------------------------------------------------------------------------------------
// Sounds (Snd.tone / Snd.noise only)
// ---------------------------------------------------------------------------------------------------------------------
const SFX = {
  honk(v = 1) { Snd.tone('square', 233, 233, 0.16, 0.06 * v); Snd.tone('square', 311, 311, 0.16, 0.045 * v); },
  beep(f) { Snd.tone('square', f, f, 0.05, 0.035); },
  warn() { Snd.tone('square', 880, 1320, 0.1, 0.03); },
  swoop() { Snd.tone('sawtooth', 820, 240, 0.4, 0.035); },
  hum() { Snd.tone('sawtooth', 90, 150, 0.5, 0.03); },
  zap() { Snd.tone('sawtooth', 1400, 300, 0.25, 0.05); Snd.noise(0.2, 0.05, 3200); },
  buzz() { Snd.tone('sawtooth', 180, 170, 0.12, 0.02); },
  pop() { Snd.tone('square', 420, 1100, 0.07, 0.06); Snd.noise(0.08, 0.06, 2600); },
  boing() { Snd.tone('sine', 190, 640, 0.22, 0.12); Snd.tone('triangle', 380, 900, 0.16, 0.05, 0.04); },
  clack() { Snd.tone('square', 160, 90, 0.05, 0.07); Snd.noise(0.05, 0.08, 1800); },
  thud() { Snd.tone('triangle', 120, 50, 0.18, 0.14); Snd.noise(0.14, 0.12, 500); },
  whistle() { Snd.tone('sine', 1500, 520, 1.1, 0.03); },
  wake() { Snd.tone('square', 500, 900, 0.08, 0.04); Snd.tone('square', 900, 500, 0.08, 0.04, 0.1); },
  moo(d = 0) { Snd.tone('sawtooth', 185, 139, 0.5, 0.09, d); Snd.tone('sawtooth', 139, 110, 0.35, 0.07, d + 0.3); },
  bonk() { Snd.tone('triangle', 300, 110, 0.18, 0.12); Snd.clank(); },
  eep() { Snd.tone('square', 900, 1500, 0.09, 0.05); Snd.tone('square', 1500, 1900, 0.07, 0.04, 0.09); }
};

// ---------------------------------------------------------------------------------------------------------------------
// Art: every sprite is baked once, on first use (level5_cast.js may still be a stub when this file loads)
// ---------------------------------------------------------------------------------------------------------------------
let ART = null, PAL = null, GR = null, SS = null;
const RX = 32.6, RY = 9.6;                                                 // the BIG SAUCER's disc
const rimY = x => 3.4 * Math.sqrt(Math.max(0, 1 - (x / RX) * (x / RX)));  // its steel rim: the front edge of the disc
const EYE = { x: 1, y: 15, r: 8.2 };                                       // its lens (local, facing right)
function art() {
  if (ART) return ART;
  PAL = M5.PAL; GR = PAL.G; SS = PAL.S;
  const { NONE, I, buf, put, get, rect, shape, oval, ball, line, poly, outline, bake, mk } = M5.px;
  const BEZ = [METDD, METD, MET, METL, '#ffffff'];
  const A = {};

  // ---- tumbling burst parts
  const part = (w, h, f, oc) => { const b = buf(w, h, w >> 1, h >> 1); f(b); outline(b, oc == null ? I(OUT) : oc); return mk(b); };
  A.bolt = part(5, 5, b => { rect(b, -1, -1, 3, 3, MET); put(b, -1, -1, METL); put(b, 0, 0, METDD); });
  A.plate = part(11, 7, b => { rect(b, -4, -2, 9, 4, GR[3]); rect(b, -4, -2, 9, 1, GR[5]); rect(b, -4, 1, 9, 1, GR[2]); put(b, 3, -1, GR[6]); put(b, -3, 0, GR[1]); });
  A.plateS = part(8, 7, b => { rect(b, -2, -2, 5, 4, GR[4]); rect(b, -2, -2, 5, 1, GR[5]); rect(b, -2, 1, 5, 1, GR[2]); });
  A.plateB = part(15, 9, b => { rect(b, -6, -3, 12, 6, GR[3]); rect(b, -6, -3, 12, 2, GR[4]); rect(b, -6, -3, 12, 1, GR[5]); rect(b, -6, 2, 12, 1, GR[1]); put(b, -4, 0, GR[6]); put(b, 3, 0, GR[6]); rect(b, -1, -1, 1, 3, GR[1]); });
  A.rim = part(13, 5, b => { rect(b, -5, -1, 11, 2, MET); rect(b, -5, -1, 11, 1, METL); put(b, -2, -1, PAL.AMBL); put(b, 3, -1, PAL.AMB); });
  A.shard = part(8, 6, b => { rect(b, -3, -1, 6, 2, '#b9f0ff'); put(b, -3, -1, '#ffffff'); put(b, 2, 0, '#74d3ee'); }, I('#2f6f8f'));
  A.lamp = part(5, 5, b => { rect(b, -1, -1, 3, 3, PAL.AMB); put(b, -1, -1, PAL.AMBL); });
  A.chunk = [0, 1, 2].map(v => part(11, 11, b => {
    shape(b, -4, -4, 4, 4, (x, y) => Math.hypot(x, y) <= 2.6 + v * 0.7 + 0.8 * Math.sin(Math.atan2(y, x) * 3 + v), (x, y) => (x * 0.5 - y * 0.6) > 1 ? '#c9a2ae' : (x * 0.5 - y * 0.6) > -0.6 ? '#84596c' : '#5a3c50');
    if (v === 1) put(b, 0, 1, '#ff7a1a');
  }));
  A.plank = part(13, 5, b => { rect(b, -5, -1, 11, 3, '#b7792b'); rect(b, -5, -1, 11, 1, '#d89a4a'); put(b, -4, 0, '#5b3a1e'); put(b, 4, 0, '#5b3a1e'); });
  A.plankS = part(9, 5, b => { rect(b, -3, -1, 7, 3, '#8a5a1e'); rect(b, -3, -1, 7, 1, '#b7792b'); });
  A.scorch = (() => {     // the glowing dent a meteor leaves for a moment
    const b = buf(27, 7, 13, 3);
    shape(b, -13, -3, 13, 3, (x, y) => (x / 12.5) ** 2 + (y / 2.6) ** 2 <= 1, (x, y) => { const d = (x / 12.5) ** 2 + (y / 2.6) ** 2; return d < 0.18 ? '#ffb52e' : d < 0.45 ? (bay(x | 0, y | 0) < 0.6 ? '#e0452c' : '#5a2a3a') : bay(x | 0, y | 0) < 0.7 ? '#2a1a2a' : NONE; });
    return mk(b);
  })();

  // ---- the meteor (proposals/level5/space/scene.js): a flame streaming up and right behind a glowing rock
  const MUX = 0.34, MUY = -0.94, LEN = 74;
  const FL = ['#fff7c8', '#ffe066', '#ffb52e', '#ff7a1a', '#e0452c', '#a8285a'].map(I);
  A.flame = [91, 47, 63].map(seed => {
    const fl = buf(74, 100, 16, 82);
    for (let y = -82; y < 18; y++) for (let x = -16; x < 58; x++) {
      const s = (x + 0.5) * MUX + (y + 0.5) * MUY, r = Math.abs(-(x + 0.5) * MUY + (y + 0.5) * MUX);
      if (s < -13 || s > LEN) continue;
      const wd = s < 0 ? 13 * Math.sqrt(Math.max(0, 1 - (s / 13) ** 2)) : 13 * Math.pow(1 - s / LEN, 0.85) + Math.sin(s * 0.42 + 1 + seed) * 1.1 * (s / LEN) * 2;
      if (wd <= 0) continue;
      const q = r / wd + (fbm2(x * 0.33, y * 0.33, seed) - 0.5) * (0.25 + 0.5 * Math.max(0, s) / LEN) + Math.max(0, s) / LEN * 0.4;
      if (q > 1.12) continue;
      const c = q < 0.2 ? FL[0] : q < 0.4 ? FL[1] : q < 0.6 ? FL[2] : q < 0.8 ? FL[3] : q < 1 ? FL[4] : (bay(x & 255, y & 255) < 0.5 ? FL[5] : NONE);
      if (c !== NONE) put(fl, x, y, c);
    }
    return bake(fl);
  });
  A.rock = (() => {
    const rk = buf(30, 30, 15, 15);
    shape(rk, -13, -13, 13, 13, (x, y) => { const a = Math.atan2(y, x); return Math.hypot(x, y) <= 9.6 + 1.4 * Math.sin(a * 3 + 1) + 0.9 * Math.sin(a * 5 + 2); }, (x, y) => {
      const f = (-x * MUX - y * MUY) / 10, n = h2(Math.floor(x), Math.floor(y), 93), top = (x * 0.5 - y * 0.6) / 10;      // f: toward the glowing front
      if (f > 0.74) return '#fff3b0';
      if (f > 0.54) return n > 0.4 ? '#ffb52e' : '#ff7a1a';
      if (f > 0.36 && n > 0.5) return '#d9512c';
      return top > 0.35 ? (n > 0.75 ? '#c9a2ae' : '#a8808e') : top > -0.2 ? (n > 0.85 ? '#5a3c50' : '#84596c') : '#5a3c50';
    });
    for (const [x, y] of [[3, -4], [-2, 1], [5, 2], [0, -7]]) { put(rk, x, y, '#4a3044'); put(rk, x + 1, y, '#4a3044'); put(rk, x, y + 1, '#4a3044'); put(rk, x + 1, y + 1, '#c9a2ae'); put(rk, x + 2, y + 1, '#c9a2ae'); }
    outline(rk);
    return mk(rk);
  })();

  // ---- the ceiling crane's claw (origin: the middle of the top of the crate it holds)
  A.claw = [0, 1].map(open => {
    const b = buf(40, 32, 20, 10), HZ = '#22222c';
    rect(b, -11, -8, 22, 7, SS[5]); rect(b, -11, -8, 22, 1, SS[7]); rect(b, -11, -2, 22, 1, SS[3]);       // the head
    for (let x = -9; x < 9; x++) for (let y = -5; y < -3; y++) put(b, x, y, ((x - y + 40) >> 1) % 2 ? PAL.AMB : HZ);
    rect(b, -2, -7, 4, 2, SS[1]);                                                                         // the lamp's socket (lit live)
    rect(b, -6, -10, 2, 2, SS[3]); rect(b, 4, -10, 2, 2, SS[3]);                                          // where the cables hook on
    for (const s of [-1, 1]) {
      if (open) {       // let go: the fingers swing out
        line(b, s * 10, -1, s * 15, 12, SS[5], 3); line(b, s * 11, -1, s * 16, 12, SS[3], 1);
        rect(b, s > 0 ? 13 : -16, 13, 4, 2, SS[6]);
      } else {          // closed round the crate: two fingers with hooks under it
        rect(b, s > 0 ? 9 : -11, -1, 3, 18, SS[5]); rect(b, s > 0 ? 11 : -11, -1, 1, 18, SS[3]);
        rect(b, s > 0 ? 6 : -11, 16, 6, 2, SS[6]); rect(b, s > 0 ? 6 : -11, 17, 6, 1, SS[3]);
      }
      put(b, s * 10, 2, PAL.AMB); put(b, s * 10, 3, '#c98a16');
    }
    outline(b);
    return mk(b);
  });

  // ---- the BIG SAUCER. v: 0 as new, 1 battered (below half), 2 battered with the dome gone
  const topOf = (b, x, y) => { const c = get(b, x, y); return c === I(GR[5]) || c === I(GR[4]) || c === I(GR[3]); };
  A.body = [0, 1, 2].map(v => {
    const b = buf(78, 62, 39, 30);
    // the eye pod under the disc: a steel ball in a dark socket
    oval(b, 0, 12, 13.7, 13.7, GR[0]);
    ball(b, 0, 12, 13, 13, BEZ);
    // two stubby thruster pods under the skirt
    for (const sx of [-25, 19]) { rect(b, sx, 6, 7, 5, METD); rect(b, sx, 6, 7, 1, MET); rect(b, sx + 1, 11, 5, 1, METDD); put(b, sx + 5, 8, METL); }
    // the dome: glass (the pilot is drawn over it, the glints over the pilot); gone: the open cockpit and its seat
    if (v < 2) shape(b, -15, -24, 15, -7, (x, y) => (x / 14.6) ** 2 + ((y + 8) / 15.4) ** 2 <= 1 && y < -7, (x, y) => x > 8 ? '#3f9fc4' : (x < -9 && y > -17) || (y < -19 && x < 5) ? '#b9f0ff' : '#74d3ee');
    else { rect(b, -5, -15, 10, 8, '#5a3a7e'); rect(b, -5, -15, 10, 1, '#8a5ab0'); rect(b, -5, -15, 1, 8, '#8a5ab0'); rect(b, 2, -13, 2, 6, '#3a2456'); }
    // the disc: light on top, a steel rim round the front edge, the dark skirt underneath
    shape(b, -34, -11, 34, 11, (x, y) => (x / RX) ** 2 + (y / RY) ** 2 <= 1, (x, y) => {
      const d = y - rimY(x);
      if (d >= 0 && d < 2) return d < 1 ? (x > 6 ? METL : MET) : METD;
      if (d >= 2) return d < 4.4 ? GR[2] : GR[1];
      const t = (y + RY) / (rimY(x) + RY);
      return t < 0.3 ? GR[5] : t < 0.6 ? GR[4] : GR[3];
    });
    // the dome's steel collar
    for (let x = -15; x <= 14; x++) { put(b, x, -8, x > 5 ? '#ffffff' : METL); put(b, x, -7, x > 9 ? METL : MET); put(b, x, -6, METD); }
    // armour plates: seams fanning out from the dome, a rivet at each end
    for (const sx of [-25, -13, 13, 25]) for (let y = -9; y < 4; y++) {
      const x = Math.round(sx * (1 + (y + 3) * 0.022));
      if (topOf(b, x, y) && topOf(b, x + 1, y)) { put(b, x, y, GR[2]); put(b, x + 1, y, GR[6]); }
    }
    for (const [x, y] of [[-29, -1], [-19, 1], [-19, -5], [20, -5], [20, 1], [30, -1], [-7, 1], [8, 1]]) if (topOf(b, x, y)) { put(b, x, y, GR[6]); put(b, x, y + 1, GR[1]); }
    // the two launch hatches, shut: a lid each side of the dome with a steel hinge
    for (const s of [-1, 1]) { rect(b, s > 0 ? 17 : -25, -6, 9, 2, GR[4]); rect(b, s > 0 ? 17 : -25, -6, 9, 1, GR[6]); rect(b, s > 0 ? 17 : -25, -4, 9, 1, GR[1]); put(b, s > 0 ? 26 : -26, -5, METL); }
    // vents in the skirt and the two roller bays, shut
    for (const x of [-20, -17, 17, 20]) { const y = Math.round(rimY(x)) + 3; put(b, x, y, GR[0]); put(b, x, y + 1, GR[0]); }
    // the lens: white glass, shaded low
    oval(b, EYE.x, EYE.y, EYE.r, EYE.r, PAL.EYEW);
    shape(b, -8, 6, 10, 24, (x, y) => (x - EYE.x) ** 2 + (y - EYE.y) ** 2 <= EYE.r * EYE.r && (x - EYE.x) * -0.35 + (y - EYE.y) * 0.94 > 4.6, PAL.EYES);
    if (v >= 1) {     // battered: scorch marks, a plate torn off, a crack in the glass, a dent in the rim
      for (const [cx, cy, r] of [[-17, -3, 3.4], [24, 0, 2.6], [5, -3, 2.2]]) shape(b, cx - 5, cy - 4, cx + 5, cy + 4, (x, y) => ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.6)) ** 2 <= 1 && topOf(b, x, y), (x, y) => bay(x | 0, y | 0) < 0.55 ? GR[1] : '#2a2a36');
      rect(b, 10, -5, 6, 4, METDD); rect(b, 10, -5, 6, 1, METD); put(b, 12, -3, PAL.AMB); put(b, 14, -2, MET); put(b, 11, -2, MET);
      if (v < 2) { line(b, 2, -21, 5, -16, '#ffffff'); line(b, 5, -16, 3, -12, '#ffffff'); line(b, 5, -16, 9, -14, '#dff9ff'); }
      put(b, -22, Math.round(rimY(-22)), METDD); put(b, -21, Math.round(rimY(-21)), METDD);
    }
    outline(b);
    return mk(b);
  });
  // the dome by itself (it pops off like a cork when the saucer is beaten)
  A.dome = (() => {
    const b = buf(34, 22, 17, 19);
    shape(b, -15, -17, 15, 1, (x, y) => (x / 14.6) ** 2 + (y / 15.4) ** 2 <= 1 && y < 1, (x, y) => x > 8 ? '#3f9fc4' : (x < -9 && y > -9) || (y < -11 && x < 5) ? '#b9f0ff' : '#74d3ee');
    line(b, 2, -13, 5, -8, '#ffffff'); line(b, 5, -8, 3, -4, '#ffffff'); rect(b, -11, -9, 2, 5, '#ffffff');
    outline(b);
    return mk(b);
  })();
  // the tiny pilot: a little green one-eyed head (its iris is drawn live). Tinted: seen through the glass
  A.pilot = [0, 1].map(tint => {
    const b = buf(13, 15, 6, 12), c = k => tint ? mixc(GR[k], '#74d3ee', 0.28) : GR[k];
    ball(b, 0, -5, 5, 5, [c(1), c(2), c(3), c(4), c(5)]);
    oval(b, 1, -6, 2.7, 2.7, tint ? mixc(PAL.EYEW, '#74d3ee', 0.2) : PAL.EYEW);
    outline(b);
    put(b, -2, -11, OUT); put(b, -2, -12, OUT); put(b, -3, -13, tint ? '#e8a8c8' : PAL.MAG);
    return mk(b);
  });
  // its parachute: red and white gores
  A.chute = (() => {
    const b = buf(25, 13, 12, 12);
    shape(b, -11, -11, 11, 0, (x, y) => (x / 10.6) ** 2 + ((y + 1) / 9.6) ** 2 <= 1 && y < -1 && !(y > -3 && ((Math.floor(x) + 12) % 5) === 2), (x, y) => (Math.floor((x + 12.5) / 5) % 2 ? '#ffffff' : '#ff5a4a'));
    for (let x = -9; x <= 9; x++) if (get(b, x, -9) !== NONE && get(b, x, -10) === NONE) put(b, x, -9, '#ffd6d1');
    outline(b);
    return mk(b);
  })();
  // the eye, out of its socket (the pupil is drawn live: a spiral, then an X)
  A.eyeball = (() => {
    const b = buf(24, 24, 12, 12);
    oval(b, 0, 0, 10.6, 10.6, GR[0]);
    ball(b, 0, 0, 10, 10, BEZ);
    oval(b, 0, 0, 7.4, 7.4, PAL.EYEW);
    shape(b, -8, -8, 8, 8, (x, y) => x * x + y * y <= 7.4 * 7.4 && x * -0.35 + y * 0.94 > 4, PAL.EYES);
    outline(b);
    return mk(b);
  })();
  // the landing ring (MARK_R), red and yellow
  A.mark = ['#ff3b30', '#ffe066'].map(c => {
    const b = buf(40, 12, 20, 6);
    const ring = (rx, ry, col, n) => { for (let a = 0; a < n; a++) { const t = a / n * Math.PI * 2; put(b, Math.round(Math.cos(t) * rx), Math.round(Math.sin(t) * ry), col); } };
    ring(MARK_R + 2, 4.6, c, 90); ring(MARK_R + 1, 4, c, 90); ring(MARK_R, 3.4, OUT, 80);
    return bake(b);
  });
  ART = A;
  return A;
}
// baked in idle time on the menus / when the mission loads (the joiner's queue), else on first use
(L5ART.bakes = L5ART.bakes || []).push(() => { art(); });

// tumbling parts: sprite particles that fall, bounce on the deck and spin (the engine draws them)
function bit(x, y, s, vx, vy, life = 60) {
  if (G.parts.length > 620) return;
  G.parts.push({ type: 'sprite', x, y, vx, vy, g: 0.2, rot: rand(0, 6.28), vr: rand(-0.35, 0.35), s, life: life + rand(0, 20), max: life + 20 });
}

// ---------------------------------------------------------------------------------------------------------------------
// Fair play: one telegraphed danger of this file at a time
// ---------------------------------------------------------------------------------------------------------------------
const BEAT = { next: 0 };                 // no eye saucer starts a warning before G.t reaches it (G.t always runs)
const D_ATK = { setup: 1, warn: 1, swoop: 1, bwarn: 1, beam: 1 };
const S_ATK = { sweepgo: 1, sweepwarn: 1, sweep: 1, dropgo: 1, dropwarn: 1 };
const HAZ = { odrock: 1, odcrate: 1, odpod: 1 };
const droneBusy = () => G.enemies.some(o => o.type === 'eyedrone' && !o.dead && D_ATK[o.state]);
// the BIG SAUCER: in a tell or an attack, or about to start one (so the eye saucers leave it room)
const saucerBusy = () => G.enemies.some(o => o.type === 'bigsaucer' && !o.dead && !o.dying && (S_ATK[o.state] || (o.state === 'rest' && o.cd <= 0)));
const hazardBusy = () => G.eb.some(b => HAZ[b.k] && b.life > 0 && !b.done);
const calmTick = () => { if (G.intro || G.big || G.state !== 'play') BEAT.next = Math.max(BEAT.next, G.t + 60); };
const bossOn = () => G.enemies.some(o => o.type === 'bigsaucer' && o.active && !o.dead && !o.dying);

// ---------------------------------------------------------------------------------------------------------------------
// Tells shared by everything here
// ---------------------------------------------------------------------------------------------------------------------
// the kit's red '!' at double size, for the landing spots (proposal: a meteor is a big deal)
function bang2(x, y) {
  ctx.fillStyle = OUT; ctx.fillRect(x - 4, y - 20, 10, 16); ctx.fillRect(x - 4, y - 2, 10, 8);
  ctx.fillStyle = '#ff3b30'; ctx.fillRect(x - 2, y - 18, 6, 12); ctx.fillRect(x - 2, y, 6, 4);
  ctx.fillStyle = '#ffd6d1'; ctx.fillRect(x - 2, y - 18, 2, 10);
}
// The landing marker of every falling thing (meteor, crate, roly eye): a red and yellow ring blinking on the spot (a
// hero whose middle is outside it is safe), a second ring closing in on its centre as the time runs out (both blink
// faster at the end), the big red '!' standing in it, a dotted line down from the thing itself. striped: the cargo
// crate's hazard-striped shadow.
const MARK_R = 15;
function landMark(tx, ty, left, total, fx, fy, striped) {
  const x = Math.round(tx), y = Math.round(ty), k = clamp(left / total, 0, 1), on = Math.floor(G.t / (left < 26 ? 3 : 6)) % 2 === 0;
  const c1 = on ? '#ff3b30' : '#ffe066', c2 = on ? '#ffe066' : '#ff3b30', r = MARK_R;
  M5.glow(x, y, 22, '#ff3b30', 0.3);
  if (striped) {
    const sh = (G.t >> 2) % 8;
    for (let j = -2; j <= 2; j++) {
      const hw = Math.round((r - 2) * Math.sqrt(1 - (j * j) / 7.5));
      ctx.fillStyle = '#1a1826'; ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1);
      ctx.fillStyle = on ? '#ffcf3a' : '#c98a16';
      for (let i = -hw - ((j * 2 + sh + 64 - hw) & 7); i <= hw; i += 8) { const a = Math.max(-hw, i + 4), b2 = Math.min(hw, i + 7); if (b2 >= a) ctx.fillRect(x + a, y + j, b2 - a + 1, 1); }
    }
  } else { ctx.fillStyle = 'rgba(30,8,14,0.45)'; ctx.fillRect(x - 9, y - 1, 19, 3); }
  ctx.drawImage(ART.mark[on ? 0 : 1], x - 20, y - 6);
  const ri = 3 + Math.round(k * (r - 5));
  pring(x, y, ri, Math.max(1, ri * 0.24), c2, 60); ctx.fillStyle = c2; ctx.fillRect(x - 1, y, 3, 1);
  if (fy != null && fy < y - 34) {
    const n = Math.max(2, Math.round((y - fy) / 13));
    for (let i = 0; i < n; i++) { const q = (i + 0.5 + ((G.t >> 2) % 4) / 4) / n; if (q > 0.97) continue; const yy = Math.round(lerp(fy + 12, y - 5, q)); if (yy > y - 34) continue; ctx.fillStyle = c1; ctx.fillRect(Math.round(lerp(fx, x, q)) - 1, yy, 2, 2); }
  }
  bang2(x - 1, y - 12 - (on ? 1 : 0));
}
// A beam about to come down: a dotted column from the eye to the floor, a ring where it will hit, faint green light
function beamTell(x, y0, y1, w, st) {
  x = Math.round(x); y0 = Math.round(y0); y1 = Math.round(y1);
  const hw = w >> 1, on = Math.floor(st / 4) % 2 === 0;
  ctx.fillStyle = 'rgba(157,255,74,' + (0.07 + 0.05 * Math.sin(st * 0.4)).toFixed(3) + ')'; ctx.fillRect(x - hw, y0, w, y1 - y0);
  ctx.fillStyle = on ? PAL.BEAML : PAL.BEAM;
  for (let yy = y0 + ((st >> 1) % 6); yy < y1 - 3; yy += 6) { ctx.fillRect(x - hw, yy, 1, 3); ctx.fillRect(x + hw - 1, yy, 1, 3); }
  M5.glow(x, y1, hw + 12, '#ff3b30', 0.3);
  if (hw <= 10) ctx.drawImage(ART.mark[on ? 0 : 1], x - 20, y1 - 7);
  else { pring(x, y1 - 1, hw + 5, 4.6, on ? '#ff3b30' : '#ffe066', 90); pring(x, y1 - 1, hw + 4, 4, on ? '#ff3b30' : '#ffe066', 90); pring(x, y1 - 1, hw + 3, 3.4, OUT, 80); }
  M5.glow(x, y0 + 1, 7 + (st % 8), PAL.BEAM, 0.5);
}

// =====================================================================================================================
// EYE SAUCER (ENEMY_TYPES.eyedrone)
// =====================================================================================================================
const D_FIRST = 150;      // a new saucer flies about this long before its first warning (time to see it and shoot it)
const D_GAP = 120;        // a breather after any saucer's attack before the next one's warning
const D_OFF = 52;         // it slides this far to the side of the hero before it dives
const D_WARN = 40, D_SWOOP = 54, D_BWARN = 45, D_BEAM = 50, D_WAKE = 45;
const PARK = 18;          // a parked saucer: its disc this far over the deck
let droneSeq = 0;
const swoopAt = (e, k) => [lerp(e.sx0, e.sx1, k), e.ty + (e.sy0 - e.ty) * (2 * k - 1) * (2 * k - 1)];
function droneCan(e) {
  const p = G.p;
  return !G.intro && !G.big && G.state === 'play' && !p.dead && !p.hidden && G.t >= BEAT.next && onScreen(e, 16) && !droneBusy() && !saucerBusy() && !hazardBusy();
}
function updDrone(e) {
  const p = G.p, L = G.cam.x, gy = groundAt(e.x);
  e.st++;
  calmTick();
  const go = s => { e.state = s; e.st = 0; };
  const steer = (tx, ty, max) => {
    e.vx += clamp((tx - e.x) * 0.02, -0.25, 0.25) - e.vx * 0.12;
    e.vy += clamp((ty - e.y) * 0.02, -0.25, 0.25) - e.vy * 0.12;
    const v = Math.hypot(e.vx, e.vy);
    if (v > max) { e.vx *= max / v; e.vy *= max / v; }
    e.x += e.vx; e.y += e.vy;
  };
  switch (e.state) {
    case 'sleep':      // parked: wakes when the hero comes close, or when a shot hits it
      e.y = gy - PARK;
      if (e.hitT > 0 || (!p.dead && !p.hidden && Math.abs(p.x - e.x) < 130 && onScreen(e, -20))) { go('wake'); SFX.wake(); }
      break;
    case 'wake':       // its lamp blinks, its eye is wide open: then it takes off
      if (e.st >= D_WAKE) { go('rise'); dust(e.x, gy, 5); Snd.tone('sawtooth', 160, 420, 0.4, 0.03); }
      break;
    case 'rise':
      e.y -= Math.min(1.8, 0.3 + e.st * 0.08);
      e.facing = p.x < e.x ? -1 : 1;
      if (e.y <= e.hy) { e.y = e.hy; e.vx = e.vy = 0; go('hover'); e.cd = 90; }
      break;
    case 'carry':      // a cow in its beam, slowly across the screen; it never attacks
      e.x -= 0.4; e.facing = -1;
      if (e.st % 200 === 120 && onScreen(e)) SFX.moo();
      break;
    case 'pop':        // shot out of the BIG SAUCER's hatch: up in an arc, then it hovers where it tops out
      e.x += e.vx; e.y += e.vy; e.vy += 0.11; e.vx *= 0.97;
      e.x = clamp(e.x, L + 16, L + W - 16);
      if (e.vy >= -0.2 || e.st > 46) { e.hy = clamp(e.y, gy - 140, gy - 84); e.vx *= 0.5; e.vy = 0; go('hover'); }
      break;
    case 'enter':      // flies on screen by itself (spawned ahead, or a lock wave from the edge)
      steer(clamp(p.x + (e.x < p.x ? -64 : 64), L + 30, L + W - 30), e.hy, 1.8);
      if (Math.abs(e.vx) > 0.5) e.facing = e.vx < 0 ? -1 : 1;
      if (onScreen(e, 24) && Math.abs(e.y - e.hy) < 12 && e.st > 20) go('hover');
      break;
    case 'hover': {    // drifts to right over the hero
      steer(p.dead ? e.x : clamp(p.x, L + 20, L + W - 20), e.hy, e.mode === 'beam' ? 1 : 0.7);
      for (const o of G.enemies) {     // two saucers at one height keep a little apart
        if (o === e || o.type !== 'eyedrone' || o.dead || Math.abs(o.y - e.y) > 16 || Math.abs(o.x - e.x) > 24) continue;
        e.x += (e.x > o.x || (e.x === o.x && e.id > o.id) ? 0.4 : -0.4);
      }
      e.facing = p.x < e.x ? -1 : 1;
      if (e.cd > 0) e.cd--;
      if (e.cd > 0 || !droneCan(e)) break;
      const b = pbox(p);
      if (b.y < e.y + 34) break;                   // only at a hero well below it (a MINI UFO up here just shoots it)
      if (e.mode === 'beam') {
        if (Math.abs(e.x - (b.x + b.w / 2)) < 8) { go('bwarn'); e.fy = heroFloor(p); e.vx = e.vy = 0; SFX.warn(); }
      } else {
        let sd = e.x >= p.x ? 1 : -1;
        if (p.x + sd * D_OFF < L + 20 || p.x + sd * D_OFF > L + W - 20) sd = -sd;
        e.sd = sd; go('setup');
      }
      break;
    }
    case 'setup': {    // slides to one side of the hero: from there it will dive
      const tx = p.x + e.sd * D_OFF;
      steer(tx, e.hy, 2.3);
      e.facing = p.x < e.x ? -1 : 1;
      if (Math.abs(e.x - tx) < 5 || e.st >= 44) {
        const b = pbox(p), cx = b.x + b.w / 2;
        if (p.dead || p.hidden || Math.abs(e.x - cx) < 30 || b.y < e.y + 30) { go('hover'); e.cd = 40; break; }
        // locked: the dive goes through where the hero stands NOW (the ring and the dotted U show it)
        e.tx = cx; e.fy = heroFloor(p); e.ty = p.ride ? b.y + b.h / 2 : e.fy - 15;
        e.sx0 = e.x; e.sy0 = e.y; e.sx1 = 2 * cx - e.x; e.vx = e.vy = 0;
        go('warn'); SFX.warn();
      }
      break;
    }
    case 'warn':
      e.facing = e.tx < e.x ? -1 : 1;
      if (e.st >= D_WARN) { go('swoop'); SFX.swoop(); }
      break;
    case 'swoop': {    // down through the spot and up the far side: the only time it hurts
      const k = Math.min(1, e.st / D_SWOOP), q = swoopAt(e, k);
      e.x = q[0]; e.y = q[1];
      e.facing = e.sx1 < e.sx0 ? -1 : 1;
      if (Math.abs(k - 0.5) < 0.1 && e.st % 3 === 0 && !p.ride) dust(e.x, e.fy, 1, -e.facing);
      if (k >= 1) { go('hover'); e.cd = 230 + (e.id % 3) * 25; e.vx = e.vy = 0; BEAT.next = Math.max(BEAT.next, G.t + D_GAP); }
      break;
    }
    case 'bwarn':      // stopped above the hero: the dotted column shows where the beam will come down
      if (e.st >= D_BWARN) {
        go('beam'); SFX.zap();
        G.eb.push({ k: 'odbeam', x: e.x, y: e.y + 12, vx: 0, vy: 0, life: D_BEAM, t: 0, e, st: 'beam', oy: 12, w: 20 });
      }
      break;
    case 'beam':
      if (e.st % 12 === 0) SFX.buzz();
      if (e.st >= D_BEAM) { go('hover'); e.cd = 230; BEAT.next = Math.max(BEAT.next, G.t + D_GAP); }
      break;
  }
  // the BIG SAUCER fell: the saucers it launched pop one by one
  if (e.popT > 0 && --e.popT === 0) damageEnemy(e, 99);
}
// the dotted green U the dive will follow, and a ring where it passes lowest
function diveTell(e) {
  const k0 = e.state === 'swoop' ? e.st / D_SWOOP : 0, on = Math.floor(G.t / 4) % 2 === 0;
  for (let i = 1; i <= 26; i++) {
    const k = i / 26;
    if (k <= k0 + 0.04) continue;
    const q = swoopAt(e, k);
    ctx.fillStyle = OUT; ctx.fillRect(Math.round(q[0]) - 2, Math.round(q[1]) + 5, 4, 4);
    ctx.fillStyle = (i + (G.t >> 2)) % 3 === 0 ? '#ffffff' : PAL.BEAM; ctx.fillRect(Math.round(q[0]) - 1, Math.round(q[1]) + 6, 2, 2);
  }
  const x = Math.round(e.tx), y = Math.round(G.p && G.p.ride ? e.ty + 12 : e.fy) - 1;
  M5.glow(x, y, 18, '#ff3b30', 0.28);
  ctx.drawImage(ART.mark[on ? 0 : 1], x - 20, y - 6);
  pring(x, y, 7, 1.8, on ? '#ffe066' : '#ff3b30', 40);
}
function drawDrone(e) {
  art();
  const s = e.state, f = e.facing, x = e.x, y = e.y;
  if (s === 'warn' || s === 'swoop') diveTell(e);
  if (s === 'bwarn') beamTell(x, y + 12, groundAt(x), 20, e.st);
  FLASH = e.hitT > 0;
  if (s === 'sleep' || s === 'wake') {
    // parked on three little legs; asleep: lamps out, the eye shut, Zs
    const gy = Math.round(groundAt(x)), X = Math.round(x), Y = Math.round(y);
    for (const dx of [-11, 10]) { pline(X + dx * 0.7, Y + 3, X + dx, gy - 1, 1, METL, true); pline(X + dx * 0.7, Y + 3, X + dx, gy - 1, 1, METL); RO(X + dx - 2, gy - 1, 4, 1, MET); }
    M5.drone(x, y, f, { t: e.t, still: true, pose: s === 'wake' ? 'warn' : 'idle', look: s === 'wake' ? [f * 0.4, 0.3] : [0, 1] });
    if (s === 'sleep') {
      ctx.save(); ctx.translate(X, Y); ctx.scale(f, 1);
      for (let j = -4; j < 4; j++) { const hw = Math.floor(Math.sqrt(17.6 - (j + 0.5) * (j + 0.5))); R(1 - hw, 7 + j, hw * 2, 1, j < -1 ? GR[4] : j < 1 ? GR[3] : j === 1 ? GR[0] : GR[2]); }      // the lid, shut
      for (let i = 0; i < 5; i++) R(-11 + i * 5 + (i > 2 ? 1 : 0), -1, 2, 1, '#5a4a12');                                         // rim lamps out
      RO(-1, -17, 3, 3, '#5a4a12');
      ctx.restore();
      FLASH = false;
      for (const o of [0, 45]) {       // Zs drifting up from it
        const u = ((e.t + o + e.id * 23) % 90) / 90;
        if (u < 0.92) text('Z', X + 8 + Math.round(u * 9), Y - 18 - Math.round(u * 16), u < 0.6 ? '#c8f7ff' : '#7a9ab0', 1, 'left');
      }
    }
  } else if (s === 'carry') {
    const by = y + 58;
    M5.drone(x, y, -1, { t: e.t, ph: e.ph, beam: by });
    FLASH = false;
    M5.cow(x, y + 50 + Math.round(Math.sin(e.t / 17) * 2), -1, { float: true, v: e.cow });
  } else {
    const tell = s === 'warn' || s === 'bwarn', hot = s === 'swoop' || s === 'beam';
    if (s === 'swoop' && !FLASH) {       // speed lines streaming back from the dive
      const k = Math.min(1, e.st / D_SWOOP), a = swoopAt(e, Math.max(0, k - 0.03)), b = swoopAt(e, Math.min(1, k + 0.03));
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, mx = (b[0] - a[0]) / d, my = (b[1] - a[1]) / d;
      for (const [o, l] of [[-7, 12], [0, 20], [7, 11]]) { const sx = x - mx * 14 - my * o, sy = y - my * 14 + mx * o; pline(sx, sy, sx - mx * l, sy - my * l, 1, 'rgba(255,255,255,0.7)'); }
    }
    M5.drone(x + (tell ? ((G.t >> 1) & 1) : 0), y, f, {
      t: e.t, ph: e.ph, pose: tell ? 'warn' : hot ? 'shoot' : 'idle', still: s !== 'hover' && s !== 'enter' && s !== 'setup',
      look: s === 'beam' || s === 'bwarn' ? [0, 1] : s === 'swoop' ? [f * 0.6, 0.8] : undefined
    });
  }
  FLASH = false;
}
function droneKill(e, cx, cy, b) {
  art();
  if (D_ATK[e.state]) BEAT.next = Math.max(BEAT.next, G.t + D_GAP);      // shot down mid-attack: the same breather
  boom(cx, cy, 0.6); sparks(cx, cy, 8, '#ffe066'); SFX.pop();
  // the burst (proposal, space frame): the dome blown up, a wing each way, the eye pod dropping with an X on its lens
  const f = e.facing;
  G.eb.push({ k: 'odwreck', x: e.x, y: Math.min(e.y, groundAt(e.x) - 16), vx: 0, vy: 0, life: 80, t: 0, f, wx: e.x, wy: e.y, ps: [
    { c: [-17, -6, 10, 12], x: 0, y: 0, vx: -2.1, vy: -1.6, r: 0, vr: -0.16 },      // left wing
    { c: [7, -6, 10, 12], x: 0, y: 0, vx: 2.2, vy: -2.2, r: 0, vr: 0.19 },          // right wing
    { c: [-10, -19, 20, 14], x: 0, y: 0, vx: 0.3 * f, vy: -3.6, r: 0, vr: 0.07 * f },   // the dome and the antenna
    { c: [-8, -5, 16, 19], x: 0, y: 0, vx: 0.5 * f, vy: -0.6, r: 0, vr: 0.05 * f, eye: true }   // the eye pod
  ] });
  // the small bits: the cast's (plates, glass, bolts; they fly slower out on the hull), else this file's
  if (typeof M5.burst === 'function') M5.burst('saucer', e.x, e.y, f);
  else { bit(cx, cy, ART.bolt, rand(-2, 2), rand(-3.2, -1.6)); bit(cx, cy, ART.plateS, rand(-1.8, 1.8), rand(-3.4, -1.8)); bit(cx, cy - 6, ART.shard, rand(-1.4, 1.4), rand(-3.6, -2.2)); bit(cx, cy, ART.lamp, rand(-2.2, 2.2), rand(-3, -1.5)); }
  addScore(150, cx, b.y);
  if (e.state === 'carry') {     // the cow floats down, lands and trots off (a bonus, not a counted rescue)
    G.eb.push({ k: 'odcow', x: e.x, y: e.y + 50, vx: 0, vy: 0, life: 2000, t: 0, v: e.cow, state: 'float', wx: e.x, hop: null });
    G.texts.push({ x: e.x, y: e.y + 30, s: 'MOO!', t: 70, c: '#ffe066' });
    addScore(500, e.x, e.y + 44);
    SFX.moo();
  }
}
ENEMY_TYPES.eyedrone = {
  hp: 2, flying: true, grab: true, edge: 18,
  contact: e => e.state === 'swoop' ? 'hurt' : 'none',
  make(e, s) {
    art();
    e.id = ++droneSeq; e.ph = (e.id * 2.4) % 6.28;
    e.mode = s.mode === 'beam' ? 'beam' : 'dive';
    e.hy = clamp(s.y || 100, 56, groundAt(e.x) - 64);
    e.st = 0; e.cd = s.cd != null ? s.cd : D_FIRST; e.sd = 1; e.popT = 0;
    e.tx = e.x; e.ty = e.y; e.fy = groundAt(e.x); e.sx0 = e.x; e.sy0 = e.hy; e.sx1 = e.x;
    e.cow = Math.floor(e.x / 97) % 3;
    if (s.asleep) { e.state = 'sleep'; e.y = groundAt(e.x) - PARK; }
    else if (s.carry) { e.state = 'carry'; e.y = e.hy; }
    else if (s.pop) { e.state = 'pop'; e.vx = s.vx || 0; e.vy = s.vy || -3; }
    else { e.state = 'enter'; e.y = e.hy; }
  },
  update: updDrone, draw: drawDrone,
  box: e => ({ x: e.x - 14, y: e.y - 10, w: 28, h: 22 }),
  onKill: droneKill,
  // in the MINI UFO's beam and thrown (level5_gear.js): (x, y) = its middle, t = frames since it was grabbed, rot = radians
  cargoDraw(x, y, t, rot) {
    art();
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate((rot || 0) + Math.sin(t / 5) * 0.14);
    M5.drone(0, -1, -1, { t, still: true, pose: 'idle', look: [Math.sin(t / 4), Math.cos(t / 4)] });     // dizzy: its eye rolls
    ctx.restore();
  }
};

// the eye saucer's wreck: four pieces of the cast's saucer flying apart (harmless)
EB_TYPES.odwreck = {
  r: -99, onGround: () => true,
  update(b) {
    b.t++;
    b.x = clamp(b.wx, G.cam.x - 26, G.cam.x + W + 26);
    for (const q of b.ps) {
      q.vy += 0.2; q.x += q.vx; q.y += q.vy; q.r += q.vr;
      const gy = groundAt(b.wx + q.x) - 6;
      if (b.wy + q.y > gy && q.vy > 0) { q.y = gy - b.wy; q.vy *= -0.4; q.vx *= 0.6; q.vr *= 0.5; }
    }
  },
  draw(b) {
    if (b.life < 16 && b.life % 2) return;                                   // blinks out
    const o = { pose: 'idle', look: [0, 0.2], t: 3, still: true };
    if (b.t < 6) { M5.glow(b.wx, b.wy, 30 - b.t * 3, '#ffd23f', 0.6); star(b.wx, b.wy, 16 - b.t * 2, '#fff3b0'); star(b.wx, b.wy, 9 - b.t, '#ffffff'); }
    for (const q of b.ps) {
      const c = q.c, cx = c[0] + c[2] / 2, cy = c[1] + c[3] / 2;
      ctx.save(); ctx.translate(Math.round(b.wx + q.x + cx), Math.round(b.wy + q.y + cy)); ctx.rotate(q.r);
      ctx.beginPath(); ctx.rect(-c[2] / 2, -c[3] / 2, c[2], c[3]); ctx.clip();
      M5.drone(-cx, -cy, b.f, o);
      if (q.eye) {       // the lens: knocked out, a black X
        const ex = Math.round(-cx + b.f), ey = Math.round(-cy + 7);
        pdisc(ex, ey, 4, PAL.EYEW);
        ctx.fillStyle = PAL.PUP; for (let i = -2; i <= 2; i++) { ctx.fillRect(ex + i, ey + i, 1, 1); ctx.fillRect(ex + i, ey - i, 1, 1); }
      }
      ctx.restore();
    }
  }
};
// the cow a carrier saucer drops: it floats down in a last shimmer of the beam, lands with a hop and trots off left
EB_TYPES.odcow = {
  r: -99, onGround: () => true,
  update(b) {
    const L = G.cam.x;
    b.t++;
    if (b.state === 'float') {
      const gy = groundAt(b.wx);
      b.y += 0.9; b.wx += Math.sin(b.t / 9) * 0.3;
      if (b.y >= gy) { b.y = gy; b.state = 'land'; b.t = 0; dust(b.wx, gy, 5); SFX.thud(); }
    } else if (b.state === 'land') {
      b.y = groundAt(b.wx);
      if (b.t === 14) SFX.moo();
      if (b.t >= 46) b.state = 'run';
    } else {
      b.wx -= 2.2;
      if (!b.hop) {       // it hops the nectar gaps of the garden
        const n = typeof L5.nectarAt === 'function' ? L5.nectarAt(b.wx - 10) : null;
        if (n) { const x1 = n.x0 - 12; b.hop = { x0: b.wx, x1, y0: groundAt(b.wx), y1: groundAt(x1), h: 16 + (b.wx - x1) * 0.2 }; }
      }
      if (b.hop) {
        const u = (b.hop.x0 - b.wx) / (b.hop.x0 - b.hop.x1);
        if (u >= 1) { b.hop = null; b.y = groundAt(b.wx); dust(b.wx, b.y, 3); } else b.y = b.hop.y0 + (b.hop.y1 - b.hop.y0) * u - b.hop.h * 4 * u * (1 - u);
      } else { b.y = groundAt(b.wx); if (b.t % 6 === 0) dust(b.wx + 10, b.y, 1, 1); }
      if (b.wx < L - 22) { b.life = 0; return; }
    }
    b.x = clamp(b.wx, L - 26, L + W + 26);
  },
  draw(b) {
    const x = b.wx;
    if (b.state === 'float') {
      const X = Math.round(x), Y = Math.round(b.y);
      for (let i = 0; i < 3; i++) { const u = ((b.t / 26) + i / 3) % 1; pring(X, Y - 10 - Math.round(u * 16), 15 - u * 6, 3.2 - u, 'rgba(157,255,74,' + (0.7 * (1 - u)).toFixed(3) + ')', 44); }
      M5.cow(x, b.y, -1, { float: true, v: b.v });
    } else if (b.state === 'land') {
      const hop = b.t > 10 && b.t < 34 ? Math.round(Math.sin((b.t - 10) / 24 * Math.PI) * 9) : 0;       // a happy jump
      M5.cow(x, b.y - hop, b.t < 34 ? 1 : -1, hop > 1 ? { v: b.v, pose: 'happy' } : { v: b.v, moo: b.t > 8 && b.t < 44 });
      if (b.t > 10 && b.t < 44) M5.bubble(x, b.y - 30 - hop, 'MOO!');
    } else M5.cow(x, b.y, -1, b.hop ? { v: b.v, pose: 'leap' } : { v: b.v, run: b.t });
  }
};

// =====================================================================================================================
// EB_TYPES.odbeam: a saucer's beam, a column from its eye down to the deck. It follows its saucer (b.e, b.oy below its
// centre) and goes out when the saucer is beaten or its attack state (b.st) ends. It hurts once: a hero who has been
// hit by this beam is safe from the rest of it (the BIG SAUCER's sweep lasts longer than the hero's blinking).
// =====================================================================================================================
EB_TYPES.odbeam = {
  r: -99, onGround: () => true,
  update(b) {
    const e = b.e, p = G.p;
    if (!e || e.dead || e.dying || e.state !== b.st || !G.enemies.includes(e)) { b.life = 0; return; }      // (not in G.enemies: the MINI UFO grabbed it)
    b.t++;
    b.x = clamp(e.x, G.cam.x - 26, G.cam.x + W + 26); b.y = e.y + b.oy;
    const gy = groundAt(b.x);
    if (!b.hit && b.t > 2 && !p.dead && !(p.inv > 0) && overlap({ x: b.x - b.w / 2, y: b.y, w: b.w, h: gy - b.y }, pbox(p))) { b.hit = true; hurtPlayer(); }
    if (b.t % 2 === 0 && G.parts.length < 600) G.parts.push({ type: 'spark', x: b.x + rand(-b.w / 2, b.w / 2), y: gy - 1, vx: rand(-1.6, 1.6), vy: rand(-2.6, -0.8), g: 0.15, life: 12, max: 12, size: 1, c: b.t % 4 ? '#eaffc8' : '#9dff4a' });
  },
  draw(b) {
    const x = Math.round(b.x), y0 = Math.round(b.y), y1 = Math.round(groundAt(b.x)), n = y1 - y0;
    if (n <= 0) return;
    const k = Math.min(1, b.t / 4, b.life / 5), w = Math.max(1, Math.round(b.w / 2 * k)), c = Math.max(1, Math.round(w * 0.45));
    M5.glow(x, y0 + 2, 14, PAL.BEAM, 0.6);
    ctx.fillStyle = 'rgba(157,255,74,0.16)'; ctx.fillRect(x - w - 2, y0, w * 2 + 4, n);
    ctx.fillStyle = 'rgba(157,255,74,0.46)'; ctx.fillRect(x - w, y0, w * 2, n);
    ctx.fillStyle = 'rgba(234,255,200,0.32)';
    for (let j = (b.t * 4) % 12 - 12; j < n; j += 12) { const a = Math.max(0, j), h = Math.min(n, j + 2) - a; if (h > 0) ctx.fillRect(x - w, y0 + a, w * 2, h); }     // thin bands sliding down
    ctx.fillStyle = 'rgba(234,255,200,0.9)'; ctx.fillRect(x - c, y0, c * 2, n);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - Math.max(1, c >> 1), y0, Math.max(1, c >> 1) * 2, n);
    ctx.fillStyle = PAL.BEAM; ctx.fillRect(x - w, y0, 1, n); ctx.fillRect(x + w - 1, y0, 1, n);
    // the splash on the deck
    M5.glow(x, y1, w + 16, PAL.BEAM, 0.6);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - w - 3, y1 - 2, w * 2 + 6, 2);
    ctx.fillStyle = PAL.BEAM; ctx.fillRect(x - w - 7, y1, w * 2 + 14, 1);
    for (let i = 0; i < 4; i++) { const u = ((b.t + i * 5) % 12) / 12; ctx.fillStyle = PAL.BEAML; ctx.fillRect(x + Math.round((hsh(i * 3.1 + (b.t >> 2)) - 0.5) * (w * 2 + 16)), y1 - 2 - Math.round(u * 9), 1, 2); }
  }
};

// =====================================================================================================================
// The BIG SAUCER (ENEMY_TYPES.bigsaucer): mini-boss of the 4400 lock
// =====================================================================================================================
const BS_LOW = 30;         // resting: its disc this far over the deck (the eye is at the hero's gun height)
const BS_HIGH = 108;       // sweeping and dropping from up here
const BS_REST = 150, BS_REST2 = 120;       // frames at shooting height between attacks (angry: below half)
const BS_TELL = 56;        // every tell: at least this many frames
const BS_SEQ = ['launch', 'sweep', 'drop'];
const BS_MAXD = 3, BS_MAXR = 2;            // never more eye saucers / roly eyes alive than this (on foot: one roly eye)
// (a robot hanging in the MINI UFO's beam is out of G.enemies but still counts: ride.cargo.e, level5_gear.js)
const inBeam = t => { const c = G.p && G.p.ride && G.p.ride.cargo; return c && c.e && c.e.type === t ? 1 : 0; };
const dronesAlive = () => G.enemies.filter(o => o.type === 'eyedrone' && o.active && !o.dead && o.state !== 'carry' && o.x > G.cam.x - 60 && o.x < G.cam.x + W + 60).length + inBeam('eyedrone');
const rollersAlive = () => G.enemies.filter(o => o.type === 'roller' && o.active && !o.dead && !o.dying && o.x > G.cam.x - 30 && o.x < G.cam.x + W + 30).length + G.eb.filter(b => b.k === 'odpod' && b.life > 0).length + inBeam('roller');
const shout = (e, s, c, t) => { e.shout = { s, c, t }; };
function updSaucer(e) {
  const p = G.p, L = G.cam.x, gy = groundAt(clamp(e.x, L, L + W)), minX = L + 50, maxX = L + W - 50;
  e.st++;
  calmTick();
  if (e.shout && --e.shout.t <= 0) e.shout = null;
  if (e.bonk > 0) e.bonk--;
  if (e.state === 'dying') { updSaucerDying(e, gy); return; }
  const angry = e.hp <= e.max / 2;
  const go = s => { e.state = s; e.st = 0; };
  const fly = (tx, ty, acc, max) => {
    e.vx += clamp((tx - e.x) * acc, -0.3, 0.3) - e.vx * 0.1;
    e.vy += clamp((ty - e.y) * acc, -0.3, 0.3) - e.vy * 0.1;
    const v = Math.hypot(e.vx, e.vy);
    if (v > max) { e.vx *= max / v; e.vy *= max / v; }
  };
  const face = () => { if (Math.abs(p.x - e.x) > 8) e.facing = p.x < e.x ? -1 : 1; };
  const rest = () => { go('rest'); e.cd = angry ? BS_REST2 : BS_REST; };
  // a big knock (a robot thrown by the MINI UFO, a grenade, a meteor): BONK! it sees stars for a moment
  if (e.hp0 - e.hp >= 6 && e.state !== 'intro' && e.bonk <= 0) {
    e.bonk = 50; SFX.bonk();
    G.texts.push({ x: e.x, y: e.y - 34, s: 'BONK!', t: 50, c: '#ffe066' });
    if (e.state === 'rest') e.cd += 30;
  }
  e.hp0 = e.hp;
  if (angry && !e.angry) {       // below half: a plate flies off, it honks and its lamps turn red
    e.angry = true;
    bit(e.x + 13 * e.facing, e.y - 4, ART.plateB, e.facing * rand(0.8, 2), rand(-3.8, -2.6), 80);
    bit(e.x + 10 * e.facing, e.y - 2, ART.bolt, rand(-1.5, 1.5), -3.2, 70); bit(e.x - 8, e.y, ART.bolt, rand(-1.5, 1.5), -2.6, 70);
    sparks(e.x + 12 * e.facing, e.y - 3, 10, '#ffe066');
    shout(e, 'HONK!!', '#ff8a5a', 70); SFX.honk(1.3); Snd.clank();
  }
  switch (e.state) {
    case 'intro':     // in from the edge with two honks (it cannot be hurt while it is still off screen)
      fly(clamp(L + W - 130, minX, maxX), gy - 56, 0.03, 2.4);      // (under the WARNING band)
      face();
      e.inv = e.x > L + W - 8;
      if (e.st === 34 || e.st === 52) { SFX.honk(); if (e.st === 34) shout(e, 'HONK! HONK!', '#ffe066', 60); }
      if (e.st >= 96 && onScreen(e, 40)) { e.inv = false; rest(); e.cd = 110; }
      break;
    case 'rest': {    // down at shooting height, keeping its distance; its eye follows the hero
      let tx = e.x;
      const d = e.x - p.x, sd = d >= 0 ? 1 : -1;
      if (Math.abs(d) < 100) { tx = p.x + sd * 124; if (tx < minX || tx > maxX) tx = p.x - sd * 124; }
      fly(clamp(tx, minX, maxX), gy - BS_LOW, 0.03, 0.9);
      face();
      if (e.cd > 0) e.cd--;
      // one danger at a time: it waits for the eye saucers' dives and for falling things to be over (saucerBusy()
      // already keeps new ones from starting)
      if (e.cd > 0 || p.dead || p.hidden || G.intro || droneBusy() || hazardBusy()) break;
      for (let i = 0, a = null; i < BS_SEQ.length && !a; i++) {
        const k = BS_SEQ[e.atk++ % BS_SEQ.length];
        if (k === 'launch' && dronesAlive() >= BS_MAXD) continue;
        if (k === 'drop' && rollersAlive() >= (p.ride ? BS_MAXR : 1)) continue;
        a = k;
        if (k === 'launch') { go('launch'); e.ln = Math.min(2, BS_MAXD - dronesAlive()); shout(e, 'BEEP BEEP!', '#ffe066', 60); SFX.honk(); }
        else if (k === 'sweep') { go('sweepgo'); e.side = p.x < L + W / 2 ? -1 : 1; SFX.warn(); }
        else {
          // over a clear stretch of deck (a roly eye on a platform would be out of reach), well away from the hero
          go('dropgo'); e.dn = p.ride ? BS_MAXR - rollersAlive() : 1; SFX.warn();      // two for a MINI UFO to throw, one for a hero on foot
          e.dx = clearDeck(clamp(p.x + (p.x < L + W / 2 ? 110 : -110), minX + 6, maxX - 6), 40, minX + 6, maxX - 6, p.x, 84) - L;
        }
      }
      break;
    }
    case 'launch': {  // LAUNCH: the hatches flip open, it beeps and shakes, then eye saucers pop out like toast
      fly(e.x, gy - BS_LOW, 0.03, 0.5);
      face();
      const T0 = BS_TELL, last = T0 + (e.ln - 1) * 20;
      e.hatch = e.st < last + 16 ? Math.min(1, e.st / 16) : Math.max(0, 1 - (e.st - last - 16) / 12);
      if (e.st < T0 && e.st % 10 === 0) SFX.beep(500 + e.st * 9);
      for (let i = 0; i < e.ln; i++) if (e.st === T0 + i * 20) {
        const sd = (i === 0) === (p.x < e.x) ? -1 : 1;       // the first one pops out on the hero's side
        const d = makeEnemy({ t: 'eyedrone', x: e.x + sd * 21, y: e.y - 12, pop: true, vx: sd * 1.5, vy: -3.3 - i * 0.5, cd: 150 + i * 60 }, e.lock);
        if (!d.dead) { d.active = true; d.facing = -sd; d.from = e; G.enemies.push(d); }
        e.kick = 6; SFX.pop(); sparks(e.x + sd * 21, e.y - 8, 6, '#eaffc8');
        G.texts.push({ x: e.x + sd * 21, y: e.y - 30, s: 'POP!', t: 36, c: '#ffffff' });
      }
      if (e.st >= last + 30) rest();
      break;
    }
    case 'sweepgo':   // BEAM SWEEP: up and over to the hero's side of the screen (the arrows already show the way)
      fly(e.side < 0 ? minX - 4 : maxX + 4, gy - BS_HIGH, 0.06, 3.4);
      e.facing = -e.side;
      if ((Math.abs(e.x - (e.side < 0 ? minX - 4 : maxX + 4)) < 4 && Math.abs(e.y - (gy - BS_HIGH)) < 4) || e.st > 170) { go('sweepwarn'); e.vx = e.vy = 0; SFX.hum(); }
      break;
    case 'sweepwarn': // parked: the dotted column under its eye, the hum rising
      e.vx = e.vy = 0;
      if (e.st % 14 === 0) SFX.beep(300 + e.st * 8);
      if (e.st >= BS_TELL) {
        go('sweep'); SFX.zap();
        G.eb.push({ k: 'odbeam', x: e.x, y: e.y + 22, vx: 0, vy: 0, life: 400, t: 0, e, st: 'sweep', oy: 22, w: 26 });
      }
      break;
    case 'sweep':     // across to the middle of the screen with the beam down, slower than the hero walks
      e.vx = -e.side * (angry ? 1.55 : 1.3); e.vy = 0;
      if (e.st % 12 === 0) SFX.buzz();
      if ((e.x - (L + W / 2)) * -e.side >= 0) { go('sweepend'); e.vx = 0; }
      break;
    case 'sweepend':
      e.vx *= 0.8;
      if (e.st >= 20) rest();
      break;
    case 'dropgo': {  // ROLLER DROP: up and over a spot well away from the hero
      const tx = L + e.dx;
      fly(tx, gy - BS_HIGH, 0.06, 3.2);
      face();
      if ((Math.abs(e.x - tx) < 5 && Math.abs(e.y - (gy - BS_HIGH)) < 4) || e.st > 150) {
        go('dropwarn'); e.vx = e.vy = 0; SFX.hum();
        // the roly eyes hang in the bays; their landing rings are on the deck from now on
        for (let i = 0; i < e.dn; i++) {
          const sd = e.dn === 1 ? (p.x < e.x ? 1 : -1) : (i ? 1 : -1), wx = e.x + sd * 23, ty = surfaceAt(wx, e.y + 30), rel = BS_TELL + i * 22;
          const n = Math.max(10, Math.round(Math.sqrt(2 * (ty - 9 - (e.y + 19)) / 0.3)));
          const pod = { k: 'odpod', x: wx, y: e.y + 19, vx: 0, vy: 0, life: 600, t: 0, e, ox: sd * 23, wx, ty, rel, n, y0: e.y + 19, lock: e.lock, rot: 0 };
          G.eb.push({ k: 'odmark', x: wx, y: ty - 1, vx: 0, vy: 0, life: 600, t: 0, wx, o: pod, kind: 'pod', T: rel + n }, pod);
        }
        e.dT = BS_TELL + (e.dn - 1) * 22;
      }
      break;
    }
    case 'dropwarn':  // the bays are open, the rings blink; then the roly eyes fall
      e.vx = e.vy = 0;
      face();
      if (e.st < BS_TELL && e.st % 12 === 0) SFX.beep(700 - e.st * 5);
      if (e.st >= e.dT + 26) rest();
      break;
  }
  if (e.kick > 0) e.kick--;
  e.x += e.vx; e.y += e.vy;
  if (e.state !== 'intro') e.x = clamp(e.x, L + 36, L + W - 36);
  e.y = clamp(e.y, 48, gy - 26);
  // battered: smoke and sparks from the torn plate
  if (angry && e.t % 12 === 0 && G.parts.length < 600) G.parts.push({ type: 'smoke', x: e.x + 13 * e.facing, y: e.y - 6, vx: rand(-0.3, 0.3), vy: -0.7, life: 36, max: 36, size: 2.5 });
  if (angry && e.t % 26 === 0) sparks(e.x + 13 * e.facing, e.y - 3, 2, '#ffe066');
}
// Beaten: it goes haywire (lamps in every colour, the eye a spiral, hiccups), the dome pops off like a cork and the
// pilot bails out, the eye boings out on a spring, it thumps down on the deck and falls to bits.
const BS_POP = 62, BS_FALL = 126;
function updSaucerDying(e, gy) {
  const st = e.st;
  for (const q of e.pops) if (q.t > 0 && --q.t === 0 && !q.o.dead && G.enemies.includes(q.o)) damageEnemy(q.o, 99);     // its robots pop one by one
  if (st < BS_POP) {
    // haywire: it wobbles and hiccups its way down
    e.rot = Math.sin(st * 0.5) * 0.12 * Math.min(1, st / 20);
    e.x += Math.sin(st * 0.9) * 0.8; e.y += clamp((gy - 46) - e.y, -0.8, 0.8);
    if (st % 14 === 4) { e.y -= 5; SFX.honk(0.6 + (st % 3) * 0.2); boom(e.x + rand(-22, 22), e.y + rand(-10, 8), rand(0.3, 0.5)); }
    if (st % 4 === 0) sparks(e.x + rand(-26, 26), e.y + rand(-8, 8), 2, '#ffe066');
    if (st % 7 === 0 && G.parts.length < 600) G.parts.push({ type: 'smoke', x: e.x + rand(-16, 16), y: e.y - 10, vx: rand(-0.3, 0.3), vy: -0.8, life: 44, max: 44, size: 3.5 });
  } else if (st === BS_POP) {
    // POP! the dome flies off, the pilot is shot out, the eye jumps out on its spring
    e.popped = true; e.rot = 0; e.spring = 0;
    G.parts.push({ type: 'sprite', x: e.x, y: e.y - 16, vx: -e.facing * 1.3, vy: -5.2, g: 0.16, rot: 0, vr: -0.22 * e.facing, s: ART.dome, life: 200, max: 200 });
    G.eb.push({ k: 'odpilot', x: e.x, y: e.y - 14, vx: 0, vy: 0, life: 900, t: 0, wx: e.x, vy0: -4.6, state: 'up' });
    for (let i = 0; i < 5; i++) bit(e.x + rand(-10, 10), e.y - 16, ART.shard, rand(-2.4, 2.4), rand(-4.2, -2), 60);
    G.texts.push({ x: e.x, y: e.y - 40, s: 'POP!', t: 60, c: '#ffffff' });
    sparks(e.x, e.y - 14, 12, '#eaffc8'); SFX.pop(); SFX.boing();
    G.shake = Math.max(G.shake, 3);
  } else {
    e.spring++;
    let crash = false;
    if (st < BS_FALL) {
      // it sputters on, hiccuping, the eye boinging on its spring under it
      e.rot = Math.sin(st * 0.4) * 0.06;
      e.y += clamp((gy - 52) - e.y, -0.7, 0.7) + (st % 16 < 3 ? -1.4 : 0);
      if (st % 16 === 0) { SFX.boing(); if (G.parts.length < 600) G.parts.push({ type: 'smoke', x: e.x + rand(-20, 20), y: e.y - 6, vx: rand(-0.3, 0.3), vy: -0.8, life: 40, max: 40, size: 3 }); }
      if (st % 9 === 0) sparks(e.x + rand(-26, 26), e.y + rand(-8, 6), 2, '#ffe066');
    } else {
      // the engines cut out: down it comes
      if (st === BS_FALL) Snd.tone('sawtooth', 500, 80, 0.4, 0.05);
      e.vy = Math.min(e.vy + 0.45, 6); e.y += e.vy; e.rot += 0.03 * e.facing;
      crash = e.y >= gy - 20;
    }
    if (crash) {
      e.y = gy - 20;
      boom(e.x, e.y - 4, 1.6); dust(e.x - 24, gy, 5); dust(e.x + 24, gy, 5);
      G.later.push({ t: 6, x: e.x - 22, y: e.y, s: 0.8 }, { t: 12, x: e.x + 20, y: e.y - 8, s: 0.8 }, { t: 19, x: e.x - 4, y: e.y + 6, s: 1 });
      const B = M5.bits || {};
      for (let i = 0; i < 8; i++) bit(e.x + rand(-26, 26), e.y + rand(-10, 4), i % 4 === 0 ? ART.plateB : i % 4 === 1 ? (B.plateA || ART.plate) : i % 4 === 2 ? (B.plateC || ART.plateS) : ART.plate, rand(-2.8, 2.8), rand(-4.8, -1.8), 90);
      for (let i = 0; i < 4; i++) bit(e.x + rand(-28, 28), e.y + 2, ART.rim, rand(-2.6, 2.6), rand(-4, -2), 90);
      for (let i = 0; i < 7; i++) bit(e.x + rand(-20, 20), e.y + rand(-8, 8), i % 3 === 0 ? (B.nut || ART.bolt) : i % 3 === 1 ? ART.bolt : ART.lamp, rand(-3, 3), rand(-4.8, -2), 80);
      // the eye bounces away
      G.parts.push({ type: 'sprite', x: e.x + e.facing, y: e.y + 10, vx: e.facing * 1.6, vy: -4.6, g: 0.2, rot: 0, vr: 0.2 * e.facing, s: ART.eyeball, life: 150, max: 150 });
      sparks(e.x, e.y, 14, '#ffe066');
      G.texts.push({ x: e.x, y: e.y - 36, s: 'BIG SAUCER DOWN!', t: 110, c: '#ffe066' });
      G.sflash = Math.max(G.sflash, 0.35); G.shake = Math.max(G.shake, 5);
      e.dead = true;
    }
  }
}
// green arrows running along the stretch of deck the beam will cross, a red strip under them, a post where it stops
function chev(x, y, dir, c) {
  for (let i = -3; i <= 3; i++) { ctx.fillStyle = OUT; ctx.fillRect(x + (3 - Math.abs(i)) * dir - 2, y + i, 5, 1); }
  ctx.fillRect(x - 1, y - 4, 3, 1); ctx.fillRect(x - 1, y + 4, 3, 1);
  ctx.fillStyle = c;
  for (let i = -3; i <= 3; i++) ctx.fillRect(x + (3 - Math.abs(i)) * dir - 1, y + i, 3, 1);
}
function sweepTell(e, gy) {
  const L = G.cam.x, dir = -e.side, x1 = Math.round(L + W / 2), on = Math.floor(G.t / 5) % 2 === 0;
  const x0 = Math.round(e.state === 'sweep' ? e.x + dir * 16 : e.side < 0 ? L + 30 : L + W - 30);
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  if (b - a < 6) return;
  ctx.fillStyle = on ? 'rgba(255,59,48,0.75)' : 'rgba(255,224,102,0.7)'; ctx.fillRect(a, gy - 1, b - a, 2);
  ctx.fillStyle = 'rgba(255,59,48,0.14)'; ctx.fillRect(a, gy - 16, b - a, 15);
  const ph = (G.t * 0.7) % 20;
  for (let u = ph; u < b - a - 6; u += 20) chev(Math.round(x0 + dir * (u + 4)), gy - 9, dir, Math.floor(u / 20 + G.t / 6) % 3 === 0 ? '#ffffff' : PAL.BEAM);
  // the stop post: the beam goes no further
  RO(x1 - 1, gy - 20, 2, 20, METL);
  for (let j = 0; j < 4; j++) R(x1 - 1, gy - 20 + j * 5, 2, 3, j % 2 ? '#1a1826' : PAL.AMB);
  RO(x1 - 3, gy - 25, 6, 5, on ? '#ff3b30' : '#a3151a'); R(x1 - 3, gy - 25, 2, 2, on ? '#ffd6d1' : '#d0453c');
}
function bigEye(lx, ly, mood, t) {
  const x = Math.round(EYE.x + clamp(lx, -1, 1) * 3), y = Math.round(EYE.y + clamp(ly, -1, 1) * 2.6);
  if (mood === 'dizzy') {       // a spiral going round
    for (let i = 6; i < 84; i++) { const a = i * 0.17 - t * 0.28, r = i * 0.085; R(Math.round(EYE.x - 0.5 + Math.cos(a) * r), Math.round(EYE.y - 0.5 + Math.sin(a) * r), 1, 1, PAL.PUP); }
    R(EYE.x - 1, EYE.y - 1, 2, 2, PAL.IRIS);
    return;
  }
  const warn = mood === 'warn', hot = mood === 'hot';
  const col = hot ? '#ffffff' : warn ? (Math.floor(t / 4) % 2 ? PAL.WARN : '#ffffff') : PAL.IRIS;
  R(x - 4, y - 2, 9, 5, col); R(x - 3, y - 3, 7, 7, col); R(x - 2, y - 4, 5, 9, col);
  if (!warn && !hot) { R(x + 2, y + 1, 3, 2, PAL.IRISD); R(x, y + 3, 3, 2, PAL.IRISD); R(x + 2, y + 3, 1, 1, PAL.IRISD); R(x - 3, y + 2, 1, 1, PAL.IRISD); }
  if (hot) { R(x - 2, y - 1, 5, 3, PAL.BEAM); R(x - 1, y - 2, 3, 5, PAL.BEAM); R(x - 1, y - 1, 3, 3, '#ffffff'); }
  else if (warn) { R(x - 1, y, 3, 1, PAL.PUP); R(x, y - 1, 1, 3, PAL.PUP); }
  else { R(x - 2, y - 1, 5, 3, PAL.PUP); R(x - 1, y - 2, 3, 5, PAL.PUP); R(x - 2, y - 2, 2, 2, '#ffffff'); R(x + 1, y + 1, 1, 1, '#5a2a3a'); }
}
function drawSaucer(e) {
  const A = art(), s = e.state, st = e.st, dying = s === 'dying';
  const L = G.cam.x, gy = Math.round(groundAt(clamp(e.x, L, L + W)));
  const tell = s === 'sweepwarn' || (s === 'dropwarn' && st < e.dT) || (s === 'launch' && st < BS_TELL) || s === 'sweepgo' || s === 'dropgo';
  const shake = (s === 'launch' && st > 8 && st < BS_TELL + 24) || s === 'sweepwarn' ? ((G.t >> 1) & 1 ? 1 : -1) : 0;
  const bob = dying || s === 'sweep' || s === 'sweepwarn' || s === 'dropwarn' ? 0 : Math.round(Math.sin(e.t * 0.07) * 2);
  const x = Math.round(e.x) + shake, y = Math.round(e.y) + bob + (e.kick > 3 ? 2 : e.kick > 0 ? 1 : 0), f = e.facing;      // (a little kick down as a saucer pops out)
  const angry = e.angry, t = e.t;
  // ---- the tells on the deck (under everything)
  if (s === 'sweepgo' || s === 'sweepwarn' || s === 'sweep') sweepTell(e, gy);
  if (s === 'sweepwarn') beamTell(x + f * EYE.x, y + 22, gy, 26, st);
  // ---- the hover light under the thruster pods
  if (!(dying && st >= BS_FALL)) {
    const fl = dying && e.popped ? (st % 16 < 8 ? 1 : 3) : 2 + ((t >> 1) % 3);
    for (const dx of [-22, 22]) { M5.glow(x + dx, y + 13, 7, PAL.BEAM, 0.55); if (!e.hitT) { ctx.fillStyle = PAL.BEAML; ctx.fillRect(x + dx - 2, y + 12, 4, fl); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + dx - 1, y + 12, 2, fl - 1); } }
  }
  ctx.save(); ctx.translate(x, y);
  if (e.rot) ctx.rotate(e.rot);
  ctx.scale(f, 1);
  FLASH = e.hitT > 0;
  // the antenna on the dome: a springy stalk with a lamp (bent when battered)
  if (!e.popped) {
    const sw = tell ? ((t >> 1) & 1 ? 1 : -1) : Math.round(Math.sin(t / 13)), ax = angry ? 3 : 0;
    R(0, -27, 1, 4, OUT); R((sw > 0 ? 1 : sw < 0 ? -1 : 0) + (ax ? 1 : 0), -30, 1, 3, OUT);
    RO(sw + ax - 1, -33, 3, 3, tell || dying ? (Math.floor(t / 4) % 2 ? '#ffffff' : PAL.IRIS) : angry ? PAL.MAG : PAL.AMB); R(sw + ax - 1, -33, 1, 1, '#ffffff');
  }
  M5.px.blit(A.body[e.popped ? 2 : angry ? 1 : 0], 0, 0);
  // the pilot under the glass: it ducks when the saucer is hit, bounces when it attacks
  if (!e.popped) {
    const py = -8 + (e.hitT > 0 || e.bonk > 0 ? 2 : tell ? -((t >> 2) & 1) : 0), lk = lookAt(e, 0, -14);
    M5.px.blit(A.pilot[1], -1, py);
    if (!FLASH) { const ix = Math.round(clamp(lk[0] * f, -1, 1)), iy = lk[1] > 0.5 ? 1 : 0; R(-1 + ix, py - 7 + iy, 2, 2, dying ? PAL.WARN : PAL.IRIS); R(-1 + ix + (ix > 0 ? 1 : 0), py - 7 + iy, 1, 1, PAL.PUP); }
    R(-11, -17, 2, 6, '#dff9ff'); R(-9, -20, 3, 1, '#ffffff'); R(-10, -19, 1, 2, '#ffffff'); R(9, -12, 1, 3, '#b9f0ff');      // the glass's glints
  }
  // the launch hatches: lids up, a green glow inside
  if (e.hatch > 0) for (const sd of [-1, 1]) {
    const hx = sd * 21, a = e.hatch * 1.9, tx = hx + sd * 5 - sd * Math.cos(a) * 9, ty = -5 - Math.sin(a) * 9;
    R(hx - 4, -6, 9, 2, GR[0]); R(hx - 3, -6, 7, 1, e.hatch > 0.6 ? PAL.BEAM : GR[2]);
    pline(hx + sd * 5, -5, tx, ty, 3, GR[3], true); pline(hx + sd * 5, -5, tx, ty, 3, GR[3]); pline(hx + sd * 5 - sd, -6, tx - sd, ty, 1, GR[5]); R(hx + sd * 5 - 1, -6, 2, 2, METL);
    if (!FLASH && e.hatch > 0.6) M5.glow(hx, -7, 9, PAL.BEAM, 0.65);
  }
  // the roller bays: open during the drop
  if (s === 'dropwarn') for (const sd of [-1, 1]) { const bx = sd * 23; R(bx - 5, Math.round(rimY(bx)) + 3, 10, 3, GR[0]); R(bx - 5 + (sd > 0 ? 9 : 0), Math.round(rimY(bx)) + 3, 1, 6, GR[3]); }
  // the ring of lamps on the rim
  for (let i = 0; i < 9; i++) {
    const lx = -28 + i * 7, ly = Math.round(rimY(lx));
    let c;
    if (dying) c = e.popped ? ((i * 17 + (st >> 3)) % 9 < Math.max(0, 8 - (st - BS_POP) / 8) ? ['#ff4fa3', '#4fe3ff', '#ffcf3a'][(i + (st >> 2)) % 3] : '#3a3020') : ['#ff4fa3', '#4fe3ff', '#ffcf3a', '#ffffff', '#9dff4a'][Math.floor(hsh(i * 7.7 + (st >> 2)) * 5)];
    else if (s === 'sweep') c = (i * -e.side * f + (t >> 1) + 90) % 3 === 0 ? PAL.BEAML : GR[2];
    else if (tell) c = Math.floor(t / 4) % 2 ? '#ffffff' : (angry ? '#ff3b30' : PAL.AMBL);
    else c = (Math.floor(t / (angry ? 3 : 5)) + i) % 9 === 0 || (Math.floor(t / (angry ? 3 : 5)) + i) % 9 === 4 ? (angry ? '#ff8ab8' : PAL.AMBL) : (angry ? '#8a1a4a' : '#8a6a12');
    R(lx - 1, ly, 3, 2, c);
    R(lx - 1, ly + 2, 3, 1, METDD);
  }
  // the eye: always open. Yellow in a tell, white-hot while the beam is on, a spiral when it is knocked silly
  if (e.popped) {
    pdisc(EYE.x, EYE.y, 7, FLASH ? '#ffffff' : '#1a0a12');
    R(EYE.x - 2, EYE.y - 3, 3, 2, '#3a2a3a');
  } else {
    const lk = lookAt(e, EYE.x * f, EYE.y), mood = dying || e.bonk > 0 ? 'dizzy' : s === 'sweep' ? 'hot' : tell ? 'warn' : '';
    if (!FLASH) bigEye(s === 'sweep' || s === 'sweepwarn' || s === 'dropwarn' ? 0 : lk[0] * f, s === 'sweep' || s === 'sweepwarn' || s === 'dropwarn' ? 1 : lk[1], mood, t);
    // the brow: an armour lid over the lens, sloping down to the front when it means business
    if (tell || s === 'sweep' || angry) { R(-7, 6, 6, 2, GR[3]); R(-2, 7, 6, 2, GR[3]); R(3, 8, 6, 2, GR[3]); R(-7, 8, 5, 1, GR[0]); R(-2, 9, 5, 1, GR[0]); R(3, 10, 6, 1, GR[0]); R(-7, 6, 16, 1, GR[5]); }
    else if (e.bonk > 0 || dying) { R(-6, 6, 15, 2, GR[3]); R(-6, 6, 15, 1, GR[5]); }
  }
  FLASH = false;
  ctx.restore();
  // ---- the eye out on its spring (after the pop)
  if (e.popped) {
    const sp = e.spring, ext = 13 + 11 * Math.cos(sp * 0.33) * Math.exp(-sp / 55), sway = Math.sin(sp * 0.21) * 4 * Math.exp(-sp / 70);
    const sx = x + f * EYE.x, sy = y + EYE.y, ex = sx + sway + f * 3, ey = Math.min(sy + ext, gy - 9);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 6; i++) {       // the spring: a zig-zag coil, outlined
      const a = [lerp(sx, ex, i / 6) + (i % 2 ? 4 : -4), lerp(sy, ey - 8, i / 6)], b = [lerp(sx, ex, (i + 1) / 6) + (i % 2 ? -4 : 4), lerp(sy, ey - 8, (i + 1) / 6)];
      pline(a[0], a[1], b[0], b[1], 2, i % 2 ? METL : MET, pass === 0);
    }
    M5.px.blit(A.eyeball, ex, ey);
    const X = Math.round(ex), Y = Math.round(ey);
    if (sp < 40) for (let i = 0; i < 22; i++) { const a = i * 0.6 + sp * 0.3, r = i * 0.27; R(Math.round(X + Math.cos(a) * r), Math.round(Y + Math.sin(a) * r), 1, 1, i % 5 === 4 ? PAL.IRIS : PAL.PUP); }
    else for (let i = -3; i <= 3; i++) { R(X + i, Y + i, 2, 1, PAL.PUP); R(X + i, Y - i, 2, 1, PAL.PUP); }
  }
  // ---- stars round its dome after a big knock
  if (e.bonk > 0 && !dying) for (let i = 0; i < 3; i++) { const a = t * 0.2 + i * 2.1; star(x + Math.cos(a) * 16, y - 26 + Math.sin(a) * 4, Math.sin(a) > 0 ? 2 : 1, '#ffe066'); }
  // ---- the '!' and its shouts
  if (tell && !(s === 'launch' && st > BS_TELL)) M5.bang(x, y - 38, t);
  if (e.shout) {
    const tw = e.shout.s.length * 6;
    text(e.shout.s, clamp(x, L + tw / 2 + 2, L + W - tw / 2 - 2) + ((G.t >> 1) & 1), s === 'intro' ? y + 32 : y - 50, e.shout.c, 1, 'center');      // (the WARNING band is over it as it comes in)
  }
}
// where an eye at (ox, oy) from the saucer's centre looks: at the hero
function lookAt(e, ox, oy) {
  const p = G.p;
  if (!p || p.dead) return [0, 0.4];
  const dx = p.x - (e.x + ox), dy = (p.y - 16) - (e.y + oy), d = Math.hypot(dx, dy) || 1;
  return [dx / d, dy / d];
}
ENEMY_TYPES.bigsaucer = {
  hp: 72, boss: true, bossName: 'BIG SAUCER', flying: true, armored: true, grab: false, contact: 'none', edge: 44, activateMargin: 60,
  make(e, s) {
    art();
    e.y = groundAt(clamp(e.x, G.cam.x, G.cam.x + W)) - 84;
    Object.assign(e, { state: 'intro', st: 0, vx: 0, vy: 0, cd: 110, atk: 0, inv: e.x > G.cam.x + W - 8, angry: false, hp0: e.hp, bonk: 0, kick: 0, hatch: 0,
      side: 1, dx: 0, ln: 0, dn: 0, dT: 0, rot: 0, popped: false, spring: 0, shout: null, pops: [], facing: -1 });
  },
  update: updSaucer, draw: drawSaucer,
  box: e => e.popped ? { x: e.x - 30, y: e.y - 10, w: 60, h: 22 } : { x: e.x - 34, y: e.y - 22, w: 68, h: 46 },
  onKill(e, cx, cy, b) {
    e.state = 'dying'; e.st = 0; e.hitT = 0; e.inv = true; e.shout = null; e.vx = 0; e.vy = 0; e.hatch = 0; e.bonk = 0;
    // the robots it launched pop one by one (its own lock's, or in the test arena the saucers it made). The lock is
    // over at once (GO > and the area's tune, level5.js): nobody has to wait for the death scene
    let i = 0;
    for (const o of G.enemies) if (o !== e && !o.dead && !o.dying && ((e.lock && o.lock === e.lock) || o.from === e)) { e.pops.push({ o, t: 36 + 14 * i++ }); o.lock = null; }
    e.lock = null;
    for (const q of G.eb) if (q.k === 'odwait') q.life = 0;
    addScore(2000, cx, b.y - 6);
    SFX.honk(1.4); Snd.tone('sawtooth', 400, 90, 0.8, 0.05);
    return 'dying';
  }
};
// the pilot, bailed out: up, then down on a red and white parachute, then off to the left as fast as it can roll
EB_TYPES.odpilot = {
  r: -99, onGround: () => true,
  update(b) {
    const L = G.cam.x;
    b.t++;
    if (b.state === 'up') { b.y += b.vy0; b.vy0 += 0.15; b.wx += 0.5; if (b.vy0 >= 0.4) { b.state = 'chute'; b.t = 0; SFX.eep(); } }
    else if (b.state === 'chute') {
      const gy = groundAt(b.wx);
      b.y += 0.75; b.wx += Math.sin(b.t / 11) * 0.5;
      if (b.y >= gy) { b.y = gy; b.state = 'run'; b.t = 0; dust(b.wx, gy, 3); }
    } else { b.wx -= b.t < 14 ? 0 : 2.4; b.y = groundAt(b.wx) - (b.t >= 14 ? Math.abs(Math.sin(b.t * 0.4)) * 3 : 0); if (b.wx < L - 20) { b.life = 0; return; } }
    b.x = clamp(b.wx, L - 26, L + W + 26);
    b.y = Math.max(b.y, 20);
  },
  draw(b) {
    const A = art(), x = Math.round(b.wx), y = Math.round(b.y);
    if (b.state === 'chute') {
      const sw = Math.round(Math.sin(b.t / 11) * 2);
      pline(x - 9 + sw, y - 23, x - 3, y - 8, 1, '#c3cdd8'); pline(x + 9 + sw, y - 23, x + 3, y - 8, 1, '#c3cdd8'); pline(x + sw, y - 23, x, y - 9, 1, '#8a97a8');
      M5.px.blit(A.chute, x + sw, y - 22);
    }
    M5.px.blit(A.pilot[0], x, y);
    const ix = b.state === 'run' ? -1 : 0;
    ctx.fillStyle = PAL.IRIS; ctx.fillRect(x + ix, y - 7, 2, 2); ctx.fillStyle = PAL.PUP; ctx.fillRect(x + ix, y - 7, 1, 1);
    if ((b.state === 'chute' && b.t > 8 && b.t < 70) || (b.state === 'run' && b.t < 14)) M5.bubble(x, y - (b.state === 'chute' ? 36 : 16), b.state === 'run' ? 'EEP!' : 'OOPS!');
  }
};

// =====================================================================================================================
// Falling things: the meteor, the cargo crate, the BIG SAUCER's roly eyes. Each one is two projectiles: the thing
// itself and, under it, its landing marker (odmark), which also notices when the thing is shot down (the engine just
// removes a `shootable` projectile) and gives the burst.
// =====================================================================================================================
const M_T = 78;                    // a meteor: frames from the ring's first blink to the impact
const M_SLOPE = 0.362;             // it comes down this many px to the left per px down (the painted flame's angle)
const C_LOWER = 22, C_REL = 50, C_Y = 66;       // the crate: lowered into view, let go at C_REL; its centre hangs at C_Y
const hold = (b, wx) => { b.x = clamp(wx, G.cam.x - 26, G.cam.x + W + 26); };      // (the engine drops projectiles 30 px off screen)
const robotsAt = f => { const out = []; for (const e of G.enemies) if (e.active && !e.dead && !e.dying && e.state !== 'dying' && e.state !== 'intro' && f(ebox(e), e)) out.push(e); return out; };
function rockBurst(x, y, ground) {
  boom(x, y - (ground ? 4 : 0), 0.7);
  for (let i = 0; i < 5; i++) bit(x + rand(-4, 4), y - 4, ART.chunk[i % 3], rand(-2.4, 2.4), rand(-3.8, -1.4), 50);
  if (G.parts.length < 600) for (let i = 0; i < 10; i++) G.parts.push({ type: 'spark', x, y: y - 2, vx: rand(-2.6, 2.6), vy: rand(-3.6, -0.8), g: 0.18, life: rand(16, 30), max: 30, size: i % 3 ? 1 : 2, c: i % 2 ? '#ffd23f' : '#ff7a1a' });
  if (ground && G.parts.length < 640) G.parts.push({ type: 'sprite', x, y: y - 1, vx: 0, vy: 0, rot: 0, s: ART.scorch, life: 110, max: 110 });
}
function crateBurst(x, y) {
  for (let i = 0; i < 6; i++) bit(x + rand(-5, 5), y + rand(-5, 5), i % 2 ? ART.plank : ART.plankS, rand(-2.4, 2.4), rand(-3.6, -1.2), 55);
  bit(x, y, ART.bolt, rand(-2, 2), -3, 50);
  dust(x, y + 6, 6); sparks(x, y, 5, '#ffe7a0'); SFX.clack(); Snd.hit();
}
// a hit on a robot from above: the BIG SAUCER takes 6 (BONK!), the others 3
const bonkRobot = e => damageEnemy(e, e.type === 'bigsaucer' ? 6 : 3);
EB_TYPES.odmark = {
  r: -99, onGround: () => true,
  update(b) {
    const o = b.o;
    b.t++;
    hold(b, b.wx);
    const live = o.life > 0 && !o.done;
    if (b.kind === 'crate') {      // the crane's claw: it follows the crate down, lets go, and goes back up
      if (live && o.t < C_REL) { b.cy = o.y - 8; b.cx = o.x; }
      else { b.open = true; b.cy -= 3.2; }
    }
    if (!live && !b.fin) {
      b.fin = true;
      if (!o.done && onScreen(o, -24)) {     // shot down in the air
        o.done = true;
        if (b.kind === 'rock') { rockBurst(o.x, o.y, false); addScore(50, o.x, o.y - 10); }
        else if (b.kind === 'crate') { crateBurst(o.x, o.y); addScore(50, o.x, o.y - 10); }
      }
    }
    if (b.fin && (b.kind !== 'crate' || b.cy < -40)) b.life = 0;
  },
  draw(b) {
    const o = b.o;
    if (o.life > 0 && !o.done && !(b.kind === 'pod' && o.e && (o.e.dead || o.e.dying))) landMark(b.wx, b.y + 1, b.T - b.t, b.T, o.rx != null ? o.rx : o.x, o.y, b.kind === 'crate');
    if (b.kind === 'crate' && b.cy > -40) {
      const A = art(), x = Math.round(b.cx), y = Math.round(b.cy);
      for (const dx of [-5, 5]) { R(x + dx - 1, -4, 2, y - 6, SS[6]); R(x + dx, -4, 1, y - 6, SS[2]); for (let yy = (y & 3); yy < y - 8; yy += 4) R(x + dx - 1, yy, 1, 1, SS[4]); }
      M5.px.blit(A.claw[b.open ? 1 : 0], x, y);
      const on = Math.floor(G.t / (b.open ? 3 : 8)) % 2 === 0;
      R(x - 2, y - 7, 4, 2, on ? PAL.AMBL : '#8a6a12'); if (on) M5.glow(x, y - 6, 8, PAL.AMB, 0.6);
    }
  }
};
// ---- the meteor
EB_TYPES.odrock = {
  r: -99, shootable: true, onGround: () => true,
  update(b) {
    const p = G.p, k = ++b.t / b.T;
    b.rx = lerp(b.x0, b.tx, k); b.y = lerp(b.y0, b.ty - 7, k);
    hold(b, b.rx);
    if (b.t % 3 === 0 && b.y > 0 && G.parts.length < 560) G.parts.push({ type: 'spark', x: b.rx + rand(-4, 8), y: b.y - rand(4, 16), vx: rand(0, 0.6), vy: rand(-0.8, -0.1), g: 0.03, life: 18, max: 18, size: 1, c: b.t % 2 ? '#ffb52e' : '#fff3b0' });
    if (b.x !== b.rx) return;                                                 // still off screen
    // in the air: it bursts on whoever it touches up there (a saucer, the hero's MINI UFO, a hero in a jump). A hero
    // on his feet is hit by the landing only: the ring on the deck is exactly the danger
    const rb = robotsAt(q => inBox(b.x, b.y, { x: q.x - 5, y: q.y - 5, w: q.w + 10, h: q.h + 10 }));
    const hero = !p.dead && (p.ride || !p.onGround) && distToBox(b.x, b.y, pbox(p)) < (p.ride ? 2 : 5);
    if (k < 1 && !rb.length && !hero) return;
    b.done = true; b.life = 0;
    if (k >= 1) {
      rockBurst(b.tx, b.ty, true); SFX.thud(); G.shake = Math.max(G.shake, 2.5);
      if (!p.dead && distToBox(b.tx, b.ty - 5, pbox(p)) < 9) hurtPlayer();
      for (const e of robotsAt(q => distToBox(b.tx, b.ty - 4, q) < 13)) bonkRobot(e);
    } else {
      rockBurst(b.x, b.y, false);
      if (hero) hurtPlayer();
      for (const e of rb) bonkRobot(e);
    }
  },
  draw(b) {
    const A = art(), x = Math.round(b.rx != null ? b.rx : b.x), y = Math.round(b.y);
    if (y < -90) return;
    M5.glow(x, y, 26, '#ff8c2e', 0.5); M5.glow(x - 3, y + 6, 12, '#fff3b0', 0.6);
    ctx.drawImage(A.flame[(G.t >> 2) % 3], x - 16, y - 82);
    M5.px.blit(A.rock, x, y);
    for (let i = 0; i < 14; i++) {       // embers shed along the tail
      const u = (hsh(i * 2.9) + G.t / (40 + i * 3)) % 1, s = 14 + u * 66, w = (hsh(i * 7.3 + Math.floor(G.t / 5)) - 0.5) * 16;
      ctx.fillStyle = u < 0.4 ? '#fff3b0' : u < 0.75 ? '#ffb52e' : '#e0452c';
      ctx.fillRect(Math.round(x + 0.34 * s + 0.94 * w), Math.round(y - 0.94 * s + 0.34 * w), 1, 1);
    }
  }
};
// Where a hazard asked for at world x tx really comes down. One that would land ON a hero who stays where he is (or,
// for a meteor, whose path would cross his MINI UFO) is usually moved beside him: he still has to keep out of the
// ring, and the robots keep him moving. HAZARD_AIM of them are left on him (L5.hazardAim, 0..1, overrides it: the
// coordinator's knob); in the BIG SAUCER's fight none is, and they land further off (its attacks make him run already).
const HAZARD_AIM = 0.35;
function fairSpot(tx, slope) {
  const p = G.p, L = G.cam.x, b = pbox(p), cx = b.x + b.w / 2, boss = bossOn(), zone = (boss ? 38 : 17) + b.w / 2;
  // a meteor passes this far right of its landing spot at the hero's height
  const off = slope ? (surfaceAt(clamp(tx, L + 12, L + W - 12), 60) - 7 - (b.y + b.h / 2)) * slope : 0;
  const d = tx + off - cx, sd = d >= 0 ? 1 : -1;
  if (Math.abs(d) >= zone) return tx;
  // (decided by a hash of the frame and the spot, not by rand(): where a hazard lands never shifts the game's random
  // numbers for everything else)
  if (!boss && hsh(G.t * 1.37 + tx * 0.113) < (typeof L5.hazardAim === 'number' ? L5.hazardAim : HAZARD_AIM)) return tx;
  const far = zone + 2 + hsh(G.t * 2.11 + tx * 0.071) * 26;
  // in the fight: on the side away from the saucer, behind a hero who is busy with it
  const bs = boss && G.enemies.find(o => o.type === 'bigsaucer' && o.active && !o.dead), side = bs ? (cx < bs.x ? -1 : 1) : sd;
  let x = cx - off + side * far;
  if (x < L + 14 || x > L + W - 14) x = cx - off - side * far;
  return x;
}
function rockAt(tx) {
  const L = G.cam.x;
  tx = clamp(fairSpot(tx, M_SLOPE), L + 12, L + W - 12);
  const ty = surfaceAt(tx, 60), y0 = -40, x0 = tx + (ty - 7 - y0) * M_SLOPE;
  const rk = { k: 'odrock', x: Math.min(x0, L + W + 26), y: y0, vx: 0, vy: 0, life: M_T + 400, t: 0, T: M_T, x0, y0, tx, ty, rx: x0 };
  G.eb.push({ k: 'odmark', x: tx, y: ty - 1, vx: 0, vy: 0, life: M_T + 400, t: 0, wx: tx, o: rk, kind: 'rock', T: M_T }, rk);
  SFX.whistle();
}
// ---- the cargo crate
EB_TYPES.odcrate = {
  r: -99, shootable: true, onGround: () => true,
  update(b) {
    const p = G.p;
    b.t++;
    if (b.t < C_REL) { b.y = b.t < C_LOWER ? lerp(-26, C_Y, ss(0, 1, b.t / C_LOWER)) : C_Y; hold(b, b.wx + Math.round(Math.sin(b.t * 0.13) * 2)); return; }
    if (b.t === C_REL) SFX.clack();
    const u = Math.min(1, (b.t - C_REL) / b.n), cb = { x: b.wx - 8, y: 0, w: 16, h: 16 };
    b.y = lerp(C_Y, b.ty - 8, u * u); hold(b, b.wx); cb.y = b.y - 8;
    const rb = robotsAt(q => overlap(cb, q)), hero = !p.dead && overlap(cb, pbox(p));
    if (u < 1 && !rb.length && !hero) return;
    b.done = true; b.life = 0;
    if (u >= 1) { SFX.thud(); dust(b.wx - 6, b.ty, 4); dust(b.wx + 6, b.ty, 4); G.shake = Math.max(G.shake, 2.5); }
    if (hero) hurtPlayer();
    for (const e of rb) bonkRobot(e);
    // it lands on somebody, or on something that stands there already: it bursts. Else it stays, as a crate to shoot
    const taken = G.props.some(o => !o.dead && Math.abs(o.x - b.wx) < 18 && Math.abs(o.y - b.ty) < 20) || G.pows.some(o => Math.abs(o.x - b.wx) < 26 && Math.abs(o.y - b.ty) < 20);
    if (hero || rb.length || taken || u < 1) { crateBurst(b.wx, b.y); return; }
    const o = makeProp({ k: PROP_TYPES.cargo ? 'cargo' : 'crate', x: b.wx, y: b.ty, item: b.coin ? 'coin' : undefined });
    if (o) G.props.push(o);
  },
  draw(b) { (L5.drawCargo || drawCrate)(Math.round(b.x) - 8, Math.round(b.y) - 8); }
};
function crateAt(tx) {
  const L = G.cam.x;
  tx = clamp(fairSpot(tx, 0), L + 18, L + W - 18);
  // not onto a cow's pod: it lands beside it
  for (const o of G.pows) if (o.state === 'tied' && Math.abs(o.x - tx) < 28) tx = o.x + (tx >= o.x ? 28 : -28);
  const ty = surfaceAt(tx, C_Y + 24), n = Math.max(12, Math.round(Math.sqrt(2 * (ty - 8 - C_Y) / 0.3)));
  const c = { k: 'odcrate', x: tx, y: -26, vx: 0, vy: 0, life: 600, t: 0, wx: tx, ty, n, coin: rand(0, 1) < 0.34 };
  G.eb.push({ k: 'odmark', x: tx, y: ty - 1, vx: 0, vy: 0, life: 600, t: 0, wx: tx, o: c, kind: 'crate', T: C_REL + n, cx: tx, cy: -34, open: false }, c);
  Snd.tone('square', 660, 660, 0.07, 0.04); Snd.tone('square', 660, 660, 0.07, 0.04, 0.14);
}
// ---- a roly eye falling out of the BIG SAUCER's bay: where it lands, a roller starts rolling
EB_TYPES.odpod = {
  r: -99, onGround: () => true,
  update(b) {
    const e = b.e, p = G.p;
    b.t++;
    if (!e || e.dead || e.dying) { b.done = true; b.life = 0; boom(b.x, b.y, 0.4); return; }      // the saucer fell: it pops, in the bay or in the air
    if (b.t < b.rel) {       // still in the bay
      b.wx = e.x + b.ox; b.y0 = e.y + 19; b.y = b.y0; hold(b, b.wx);
      return;
    }
    if (b.t === b.rel) { SFX.clack(); Snd.tone('sine', 900, 300, 0.35, 0.04); }
    const u = Math.min(1, (b.t - b.rel) / b.n);
    b.y = lerp(b.y0, b.ty - 9, u * u); b.rot += 0.3; hold(b, b.wx);
    if (u < 1) return;
    b.done = true; b.life = 0;
    SFX.thud(); dust(b.wx - 5, b.ty, 3); dust(b.wx + 5, b.ty, 3);
    if (!p.dead && overlap({ x: b.wx - 8, y: b.ty - 18, w: 16, h: 18 }, pbox(p))) hurtPlayer();
    const r = makeEnemy({ t: 'roller', x: b.wx, y: b.ty }, b.lock);
    if (!r.dead) { r.active = true; r.facing = p.x < b.wx ? -1 : 1; if (e && !e.dead) r.from = e; G.enemies.push(r); }
  },
  draw(b) {
    const x = Math.round(b.wx != null ? b.wx : b.x), y = Math.round(b.y);
    if (b.t < b.rel) { R(x - 1, y - 12, 2, 4, METL); RO(x - 3, y - 10, 6, 2, MET); }      // the clamp that holds it
    M5.roller(x, y + 9, G.p && G.p.x < x ? -1 : 1, { rot: b.rot, t: b.t, pose: 'idle', look: [0, 1] });
  }
};
// ---- a hazard held back while another danger of this file is on: it comes as soon as the air is clear
EB_TYPES.odwait = {
  r: -99, onGround: () => true,
  update(b) {
    const p = G.p;
    b.x = G.cam.x + W / 2; b.y = 8;
    if (droneBusy() || saucerBusy() || hazardBusy()) return;
    b.life = 0;
    if (!p.dead && !G.intro && G.state === 'play') (b.kind === 'rock' ? rockAt : crateAt)(clamp(p.x + b.off, G.cam.x + 24, G.cam.x + W - 24));
  },
  draw() {}
};
function hazard(kind, tx) {
  const p = G.p;
  art();
  if (!p || p.dead) return;
  // level5.js clamps tx to the screen (camera + 24 .. camera + W - 24): next to a screen edge most of its throws
  // would pile up on that one spot, three times out of four on a hero who stands there. Spread them inward again
  const lo = G.cam.x + 24, hi = G.cam.x + W - 24;
  if (tx >= hi - 0.5) tx = hi - hsh(G.t * 0.731 + 5) * 90; else if (tx <= lo + 0.5) tx = lo + hsh(G.t * 0.731 + 9) * 90;
  if (droneBusy() || saucerBusy() || hazardBusy()) {
    if (!G.eb.some(b => b.k === 'odwait')) G.eb.push({ k: 'odwait', kind, off: tx - p.x, x: G.cam.x + W / 2, y: 8, vx: 0, vy: 0, life: 360 });
    return;
  }
  (kind === 'rock' ? rockAt : crateAt)(tx);
}
// the level's hazards (level5.js calls them with a world x on screen, near the hero)
L5.meteor = function (tx) { hazard('rock', tx); };
L5.craneCrate = function (tx) { hazard('crate', tx); };
}
