'use strict';
var L5 = L5 || {};
var L5ART = L5ART || {};
// =====================================================================================================================
// MEGA OGGLE: Mission 5's final boss (ENEMY_TYPES.megaoggle), the captain of the alien mothership, and its projectiles
// (EB_TYPES mocrate, mopod, mofx). Owner: boss (docs/level5-spec.md section 4). The look is the boss of the proposal
// frame (proposals/level5/bridge/scene.js), turned into a part rig: a saucer skirt with thrusters, a heavy bell of green
// armour plates, ONE enormous eye (the iris follows the hero; armoured lids above and below; a heavy brow plate), a
// grille mouth, three springy antenna lamps, a tiny captain's cap, two cable arms with claws that really move.
//
// The rule of the fight: ONLY THE OPEN EYE is a weak spot. Shots on the lens count (double while the EYE BEAM fires),
// shots on the armour or on a shut lid go "ping" and do nothing. Blasts (grenades) count while the eye is open.
//   EYE BEAM     the antenna lamps light one, two, three, the iris turns yellow, a dotted line shows the way (72 frames);
//                ZAAAP: the beam's hot spot sweeps the deck from the boss to the left wall. Jump it, or stand on a console.
//   TRACTOR DROP the near claw fetches a cargo crate from the ceiling; a red ring + ! follows the hero (60 frames), locks
//                (40), then the crate drops. Every second time (and whenever the hero is on his last heart) it grabs a
//                cow pod by mistake: an amber ring, no danger, the pod cracks open, the cow runs off and leaves a heart
//                or ammunition.
//   EYELIDS SHUT after enough eye hits the lids slam shut (CLANK!) and it either rakes its claw along the deck
//                (clack-clack, it comes down, then jump it) or tosses out two roly eyes (ENEMY_TYPES.roller, in its lock);
//                the lid lifts a crack, then opens.
//   Below half:  the cap is blown off, the lower lid jams (the eye can no longer shut completely), the beam sweeps there
//                and back, crates come in pairs and the SAUCER DASH: the skirt lamps flash, it slides across the deck
//                until it bonks the far console and sits dizzy with the eye wide open.
//   Defeat:      the eye goes spiral, it spins like a top, POP POP POP, the freed cows stampede over it and flatten it,
//                the cap lands on the calf's head. onKill returns 'dying' and sets G.winT = 360; bossDefeated at frame 150
//                (the wreck and the cows are then drawn by the front layer, EB_TYPES.mofx, until the win screen).
// Touching it never hurts (it is a wall); only the beam's hot spot, a falling crate, the raking claw, its roly eyes and
// the dash do. After a continue it comes back with the health it had, at most 75 % (L5.megaKeep).
// Drawing never calls Math.random()/rand(): hsh(n) and the clocks only. The big parts are painted once (three bake
// steps, queued on L5ART.bakes; the claw hands are painted when a direction is first needed and kept); the rest is
// small live drawing: lids, antennae, hoses, lamps, thrusters, beam. Private to this block except the registries and
// L5.megaKeep.
// =====================================================================================================================
{
const Math = globalThis.Math;

// ---------------------------------------------------------------------------------------------------------------------
// Palette (the cast's, M5.PAL in level5_cast.js: copied so that nothing here depends on another file at load time)
// ---------------------------------------------------------------------------------------------------------------------
const GR = ['#0c2b1c', '#12502a', '#1c7a34', '#2fae44', '#62d64f', '#a8f070', '#e6ffc2'];   // alien green, dark -> light
const SH = ['#0e0c1e', '#17152e', '#222244', '#30345f', '#444e82', '#6272ab', '#8fa2d2', '#c3d0ee'];   // ship steel
const AMB = '#ffcf3a', AMBL = '#fff2a8', AMBD = '#c98a16', AM0 = '#8a6a12';
const MAG = '#ff4fa3', MAGL = '#ffb3d9', CYAN = '#4fe3ff', CYANL = '#c8f7ff';
const BEAM = '#9dff4a', BEAML = '#eaffc8';
const EYEW = '#f6fbff', EYES = '#b9d0e4', IRIS = '#ff3b30', IRISD = '#a3151a', PUP = '#1a0a12', WARN = '#ffe063';
const RED = '#ff3b30', REDL = '#ffd6d1', WHITE = '#ffffff';

// ---------------------------------------------------------------------------------------------------------------------
// Layout. Design coordinates = screen coordinates with the camera locked at 5920, as in the proposal frame: the deck is
// y 218 and the boss's anchor (e.x, e.y) is design (BX, BY), the bottom of its skirt, 7 px over the deck.
// ---------------------------------------------------------------------------------------------------------------------
const BX = 362, BY = 211, HOVER = 7;
const B = { cx: 362, eq: 152, rx: 76, ryT: 80, ryB: 62, p: 2.5 };     // the body: a heavy rounded bell
const EX = 346, EY = 146, LR = 24, BR = 30.5;                         // the eye: centre, lens radius, bezel radius
const SKY = 194, SKRX = 94, SKRY = 10;                                // the saucer skirt: its top face (an ellipse)
const RIM = B.cx - SKRX;                                              // the skirt's left edge: the hero's wall
const US = 0.2;                                                       // slope of the upper lid's edge (grumpy)
const SHO = [[B.cx - 74, 128], [B.cx + 74, 128]];                     // shoulders (ball joints)
const ANT = [{ bx: B.cx - 40, by: 80, tx: B.cx - 52, ty: 61, bend: -2 }, { bx: B.cx + 16, by: 74, tx: B.cx + 20, ty: 47, bend: 1 }, { bx: B.cx + 40, by: 80, tx: B.cx + 54, ty: 60, bend: 2 }];
const NOZ = [-46, 0, 46];
const MX = EX - 2, MW = 32;
const CAPX = B.cx - 10, CAPY = 74, CAPA = -0.17;

// ---------------------------------------------------------------------------------------------------------------------
// Helpers: easing, packed colours, pixel buffers, inside-test shapes (painting happens once, in the bake steps)
// ---------------------------------------------------------------------------------------------------------------------
const DEG = Math.PI / 180;
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y) => (BAYER[((y & 3) << 2) + (x & 3)] + 0.5) / 16;
const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const RGB = {};
const rgbOf = c => RGB[c] || (RGB[c] = hex(c));
const pk = (r, g, b, a = 255) => (LE ? ((a << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | a)) >>> 0;
const PC = {};
function P(c) { let v = PC[c]; if (v === undefined) { const q = rgbOf(c); v = PC[c] = pk(q[0], q[1], q[2]); } return v; }
const OUTP = P(OUT), WHITEP = P(WHITE);
const rgba = (c, a) => { const v = rgbOf(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')'; };

class Pix {
  constructor(x0, y0, w, h) { this.x0 = Math.floor(x0); this.y0 = Math.floor(y0); this.w = Math.ceil(w); this.h = Math.ceil(h); this.d = new Uint32Array(this.w * this.h); }
  i(x, y) { x = Math.floor(x) - this.x0; y = Math.floor(y) - this.y0; return x >= 0 && y >= 0 && x < this.w && y < this.h ? y * this.w + x : -1; }
  dot(x, y, c) { const i = this.i(x, y); if (i >= 0) this.d[i] = c; }
  get(x, y) { const i = this.i(x, y); return i >= 0 ? this.d[i] : 0; }
  rect(x, y, w, h, c) { x = Math.round(x); y = Math.round(y); for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) this.dot(x + k, y + j, c); }
  // every pixel whose centre passes f: colour col, or col(x, y, ix, iy) (0 = leave it)
  shape(f, col, x0 = this.x0, y0 = this.y0, x1 = this.x0 + this.w, y1 = this.y0 + this.h) {
    x0 = Math.max(Math.floor(x0), this.x0); y0 = Math.max(Math.floor(y0), this.y0);
    x1 = Math.min(Math.ceil(x1), this.x0 + this.w); y1 = Math.min(Math.ceil(y1), this.y0 + this.h);
    const fn = typeof col === 'function';
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      if (!f(cx, cy)) continue;
      const c = fn ? col(cx, cy, x, y) : col;
      if (c) this.d[(y - this.y0) * this.w + x - this.x0] = c;
    }
  }
  disc(cx, cy, r, col) { this.shape((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r, col, cx - r - 1, cy - r - 1, cx + r + 2, cy + r + 2); }
  line(ax, ay, bx, by, c) {
    const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)));
    for (let k = 0; k <= n; k++) this.dot(Math.round(lerp(ax, bx, n ? k / n : 0)), Math.round(lerp(ay, by, n ? k / n : 0)), c);
  }
  // a 1px outline (4-neighbourhood) around everything painted
  outline(c = OUTP) {
    const q = this.d.slice(), w = this.w, h = this.h;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (q[k]) continue;
      if ((i > 0 && q[k - 1]) || (i < w - 1 && q[k + 1]) || (j > 0 && q[k - w]) || (j < h - 1 && q[k + w])) this.d[k] = c;
    }
    return this;
  }
  canvas(white) {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const g = c.getContext('2d'), id = g.createImageData(this.w, this.h);
    let d = this.d;
    if (white) { d = this.d.slice(); for (let i = 0; i < d.length; i++) if (d[i] && d[i] !== OUTP) d[i] = WHITEP; }
    id.data.set(new Uint8ClampedArray(d.buffer)); g.putImageData(id, 0, 0);
    return c;
  }
  // a sprite: its picture (and a white copy for the hit flash) with its place in design coordinates
  sprite(white) { return { img: this.canvas(false), white: white ? this.canvas(true) : null, x0: this.x0, y0: this.y0, w: this.w, h: this.h }; }
}
const rot = (x, y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [dx * c + dy * s, -dx * s + dy * c]; };
function polyIn(pts) {
  return (x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
}
function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return [Math.hypot(x - ax - dx * t, y - ay - dy * t), t];
}
// light from the upper left on a surface whose screen-space normal is (nx, ny): -1 (away) .. 1 (facing it)
const lit = (nx, ny) => -0.6 * nx - 0.8 * ny;
const STEEL = [METDD, METD, MET, METL, WHITE];
const steel = l => P(STEEL[l > 0.6 ? 4 : l > 0.2 ? 3 : l > -0.3 ? 2 : l > -0.7 ? 1 : 0]);
const green = (l, o = 0) => P(GR[clamp((l > 0.6 ? 5 : l > 0.15 ? 4 : l > -0.35 ? 3 : l > -0.75 ? 2 : 1) + o, 0, 6)]);
// crisp pixel disc on the live canvas
function disc(x, y, r, col) {
  ctx.fillStyle = col; x = Math.round(x); y = Math.round(y);
  for (let j = -r; j <= r; j++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - j * j))); ctx.fillRect(x - w, y + j, w * 2 + 1, 1); }
}
// soft additive light (the cast's M5.glow look, without its save / restore: this file draws many of them a frame)
const GLOWS = {};
function glowSprite(col) {
  const s = GLOWS[col] = document.createElement('canvas'); s.width = s.height = 64;
  const g = s.getContext('2d'), v = hex(col), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(' + v + ',1)'); gr.addColorStop(0.35, 'rgba(' + v + ',0.45)'); gr.addColorStop(1, 'rgba(' + v + ',0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return s;
}
function glow(x, y, r, col, a) {
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(a, 0, 1);
  ctx.drawImage(GLOWS[col] || glowSprite(col), Math.round(x - r), Math.round(y - r), r * 2, r * 2);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// =====================================================================================================================
// The body's shape (design coordinates)
// =====================================================================================================================
const nyOf = y => (y - B.eq) / (y < B.eq ? B.ryT : B.ryB);
const hw = y => { const n = Math.abs(nyOf(y)); return n >= 1 ? 0 : B.rx * Math.pow(1 - Math.pow(n, B.p), 1 / B.p); };
const collarY = x => { const k = (x - B.cx) / 64; return Math.abs(k) >= 1 ? SKY : SKY + 6.5 * Math.sqrt(1 - k * k); };
const BODY = (x, y) => y >= B.eq - B.ryT && y <= collarY(x) && Math.abs(x - B.cx) <= hw(y);
const LGT = (() => { const m = Math.hypot(-0.5, -0.62, 0.6); return [-0.5 / m, -0.62 / m, 0.6 / m]; })();
function bodyLight(x, y) {
  const nx = (x - B.cx) / B.rx, ny = nyOf(y), ax = Math.abs(nx), ay = Math.abs(ny), p = B.p;
  const f = Math.min(1, Math.pow(ax, p) + Math.pow(ay, p));
  const gx = Math.sign(nx) * Math.pow(ax, p - 1), gy = Math.sign(ny) * Math.pow(ay, p - 1), gz = Math.pow(1 - f, (p - 1) / p);
  const m = Math.hypot(gx, gy, gz) || 1;
  return (gx * LGT[0] + gy * LGT[1] + gz * LGT[2]) / m;
}
// armour plates: three bands (dome, face, jaw) split by meridian seams
const angOf = (x, y) => Math.asin(clamp((x - B.cx) / (hw(y) || 1), -1, 1)) / DEG;
const seamA = x => 106 - 8 * (1 - ((x - B.cx) / B.rx) ** 2);
const seamB = x => 172 + 5 * (1 - ((x - B.cx) / B.rx) ** 2);
const MER = [[-40, 6, 46], [-62, 30, 62], [-56, 24, 58]];
function plateAt(x, y) {
  const band = y < seamA(x) ? 0 : y < seamB(x) ? 1 : 2, a = angOf(x, y);
  let sec = 0; for (const m of MER[band]) if (a > m) sec++;
  return band * 4 + sec;
}
const topEdge = x => SKY + SKRY * Math.sqrt(Math.max(0, 1 - ((x - B.cx) / SKRX) ** 2));
const lowEdge = x => { const k = (x - B.cx) / (SKRX - 3); return Math.abs(k) >= 1 ? SKY : SKY + 3 + 14 * Math.sqrt(1 - k * k); };
const mT = x => 181 + 6 * ((x - MX) / MW) ** 2;
const MOUTH = (x, y) => Math.abs(x - MX) <= MW && y >= mT(x) && y <= mT(x) + 8;
const COLLAR_LAMPS = [];
for (let a = -70; a <= 70; a += 20) { const x = Math.round(B.cx + Math.sin(a * DEG) * 60); COLLAR_LAMPS.push([x, Math.round(collarY(x) - 4)]); }

// =====================================================================================================================
// Painters (bake time)
// =====================================================================================================================
// the saucer skirt: a top face (bevel, groove, plates with radial seams), a bowl with a steel rim band, three nozzles
const skq = (x, y) => Math.hypot((x - B.cx) / SKRX, (y - SKY) / SKRY);
function skirtFace(x, y) {
  const q = skq(x, y), left = x < B.cx + 24, a = Math.atan2((y - SKY) / SKRY, (x - B.cx) / SKRX) / DEG;
  if (q > 0.93) return P(left ? GR[5] : GR[4]);
  if (q > 0.87) return P(GR[1]);
  if (q > 0.7) return P(((a + 360) % 18) < 1.2 ? GR[1] : left ? GR[4] : GR[3]);
  if (q > 0.66) return P(GR[1]);
  return P(GR[2]);
}
function paintSkirt() {
  const px = new Pix(B.cx - 97, SKY - 13, 194, 36);
  px.shape((x, y) => skq(x, y) <= 1, skirtFace);
  px.shape((x, y) => Math.abs(x - B.cx) < SKRX && y > topEdge(x) && y <= Math.max(lowEdge(x), topEdge(x) + 2.5), (x, y) => {
    const d = y - topEdge(x), left = x < B.cx - 20;
    if (d < 1) return P(left ? WHITE : METL);
    if (d < 3) return P(left ? METL : MET);
    if (d < 4) return P(METD);
    return P(lowEdge(x) - y < 2 ? GR[0] : d < 7 ? (left ? GR[3] : GR[2]) : GR[1]);
  });
  for (const nx of NOZ) {
    const x0 = B.cx + nx, yb = Math.round(lowEdge(x0)) - 1;
    for (let r = 0; r < 4; r++) { const h2 = 7 - r; px.rect(x0 - h2, yb + r, h2 * 2, 1, P(r === 3 ? METDD : METD)); px.dot(x0 - h2, yb + r, P(METL)); px.dot(x0 - h2 + 1, yb + r, P(MET)); }
  }
  return px.outline().sprite(true);
}

// the bell of armour plates with everything that is bolted to it: the eye's socket, bezel and white lens, the grumpy
// grille mouth, shoulders with a captain's epaulettes, medals, a hatch, louvres. dmg: the battered look of phase 2
function paintBody(dmg) {
  const px = new Pix(274, 66, 176, 138);
  // antenna sockets, behind the dome
  for (const a of ANT) { px.rect(a.bx - 3, a.by - 2, 8, 4, P(METD)); px.rect(a.bx - 3, a.by - 2, 8, 1, P(METL)); }
  // flat bands of green (lit from the upper left), each plate a touch different, seams with a lit lip
  px.shape(BODY, (x, y) => {
    const pl = plateAt(x, y);
    if (pl !== plateAt(x + 1, y) || pl !== plateAt(x, y + 1)) return P(GR[0]);
    const l = bodyLight(x, y) + (hsh(pl * 7.31) - 0.5) * 0.14;
    let tone = l > 0.9 ? 5 : l > 0.7 ? 4 : l > 0.42 ? 3 : l > 0.12 ? 2 : 1;
    if (pl !== plateAt(x - 1, y) || pl !== plateAt(x, y - 1)) tone = Math.min(5, tone + 1);
    if (tone < 2 && x > B.cx && !BODY(x + 2.5, y)) tone = 2;                       // reflected light on the far edge
    if (y > collarY(x) - 9 && tone > 1) tone--;                                      // the body sinks into the skirt
    const de = Math.hypot(x - EX, y - EY);
    if (de < BR + 4 && tone > 1) tone--;                                             // the eye's deep socket
    const nx = (x - B.cx) / B.rx, ny = nyOf(y);
    if (nx < 0 && ny < 0) {                                                          // a glossy streak on the dome
      const f = Math.pow(-nx, B.p) + Math.pow(-ny, B.p), a = Math.atan2(-ny, -nx) / DEG;
      if (f > 0.6 && f < 0.74 && a > 24 && a < 60) tone = f > 0.64 && f < 0.7 && a > 30 && a < 54 ? 6 : 5;
    }
    if (x < B.cx - 30 && y > 150 && !BODY(x - 2.2, y)) tone = 5;                    // rim light on the near flank
    const md = y - mT(x);
    if (Math.abs(x - MX) <= MW + 8 && md >= -7 && md <= 16) {                        // the muzzle: a raised plate
      if (Math.abs(x - MX) > MW + 7 || md < -6) return P(GR[0]);
      tone = md < -4.6 ? 5 : x < MX + 10 ? 4 : 3;
    }
    return P(GR[tone]);
  });
  // rivets along the seams
  const rivet = (x, y) => { x = Math.round(x); y = Math.round(y); if (Math.hypot(x - EX, y - EY) > BR + 5 && BODY(x + 0.5, y + 0.5) && BODY(x + 2.5, y + 2.5) && BODY(x - 1.5, y - 1.5)) { px.dot(x, y, P(GR[5])); px.dot(x + 1, y + 1, P(GR[0])); px.dot(x + 1, y, P(GR[1])); px.dot(x, y + 1, P(GR[1])); } };
  for (let a = -72; a <= 72; a += 16) {
    for (const [sm, off] of [[seamA, -4], [seamA, 4], [seamB, -4], [seamB, 4]]) {
      let x = B.cx; for (let k = 0; k < 4; k++) x = B.cx + Math.sin(a * DEG) * hw(sm(x) + off);
      rivet(x, sm(x) + off);
    }
  }
  MER.forEach((ms, band) => ms.forEach(m => {
    const [y0, y1] = band === 0 ? [80, 96] : band === 1 ? [116, 164] : [180, 190];
    for (let y = y0; y <= y1; y += 16) for (const o of [-4, 4]) rivet(B.cx + Math.sin(m * DEG) * hw(y) + o, y);
  }));
  // a hatch on the dome, louvres on the far flank, dings, a hazard-striped access plate, three status lamps
  const hx = B.cx + 20;
  px.rect(hx, 86, 15, 1, P(GR[1])); px.rect(hx, 95, 15, 1, P(GR[1])); px.rect(hx, 86, 1, 10, P(GR[1])); px.rect(hx + 14, 86, 1, 10, P(GR[1])); px.rect(hx + 1, 87, 13, 1, P(GR[4])); px.rect(hx + 5, 90, 5, 2, P(GR[1])); px.rect(hx + 5, 90, 5, 1, P(GR[5]));
  for (let i = 0; i < 4; i++) { px.rect(B.cx + 44, 118 + i * 5, 14, 2, P(GR[0])); px.rect(B.cx + 44, 120 + i * 5, 14, 1, P(GR[3])); }
  for (const [x, y] of [[B.cx - 60, 112], [B.cx - 64, 156], [B.cx - 36, 94], [B.cx + 30, 176], [B.cx - 58, 174]]) { px.dot(x, y, P(GR[1])); px.dot(x + 1, y, P(GR[1])); px.dot(x, y + 1, P(GR[5])); px.dot(x + 1, y + 1, P(GR[5])); }
  px.line(B.cx - 56, 98, B.cx - 49, 93, P(GR[5])); px.line(B.cx - 55, 99, B.cx - 50, 95, P(GR[2]));
  for (let y = 0; y < 5; y++) for (let x = 0; x < 16; x++) px.dot(B.cx + 41 + x, 164 + y, P(x === 0 || x === 15 || y === 0 || y === 4 ? GR[0] : ((x + y) >> 1) % 2 ? AMB : '#22222c'));
  for (let i = 0; i < 3; i++) { px.rect(B.cx - 68, 140 + i * 5, 3, 3, P(GR[0])); px.dot(B.cx - 67, 141 + i * 5, P(i === 1 ? CYAN : CYANL)); }
  // the captain's medals: three ribbons with gold discs (phase 2: one has been shot off)
  [[MAG, MAGL], [CYAN, CYANL], [RED, '#ffb0a8']].forEach(([c, cl], i) => {
    const x = B.cx + 43 + i * 7, y = 146 + (i === 1 ? 1 : 0);
    px.rect(x - 1, y - 1, 6, 12, P(GR[0]));
    if (dmg && i === 1) { px.rect(x, y, 4, 9, P(GR[1])); px.dot(x + 1, y + 1, P(GR[5])); return; }
    px.rect(x, y, 4, 5, P(c)); px.rect(x, y, 1, 5, P(cl)); px.rect(x, y + 5, 4, 4, P(AMB)); px.rect(x, y + 5, 2, 2, P(AMBL)); px.dot(x + 3, y + 8, P(AMBD));
  });
  if (dmg) {
    // phase 2: soot where the shots landed, cracks with a lit lip, a plate torn open (dark machinery, a copper pipe),
    // a riveted patch
    const soot = (cx, cy, r) => px.shape((x, y) => BODY(x, y) && Math.hypot(x - cx, (y - cy) * 1.2) <= r && Math.hypot(x - EX, y - EY) > BR + 2, (x, y, ix, iy) => {
      const k = 1 - Math.hypot(x - cx, (y - cy) * 1.2) / r;
      return k * 1.5 > dith(ix, iy) ? P(k > 0.55 ? GR[0] : GR[1]) : 0;
    }, cx - r - 1, cy - r - 1, cx + r + 2, cy + r + 2);
    soot(B.cx - 52, 124, 12); soot(B.cx + 4, 92, 10); soot(B.cx + 48, 178, 9); soot(B.cx - 34, 182, 7); soot(B.cx + 62, 136, 8);
    const crack = pts => { for (let i = 0; i < pts.length - 1; i++) { px.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], P(GR[0])); px.line(pts[i][0] + 1, pts[i][1], pts[i + 1][0] + 1, pts[i + 1][1], P(GR[5])); px.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], P(GR[0])); } };
    crack([[B.cx - 20, 76], [B.cx - 16, 84], [B.cx - 22, 90], [B.cx - 15, 99]]);
    crack([[B.cx + 60, 104], [B.cx + 52, 110], [B.cx + 56, 116]]);
    crack([[B.cx - 70, 164], [B.cx - 62, 168], [B.cx - 66, 176]]);
    const hole = polyIn([[B.cx + 6, 108], [B.cx + 26, 104], [B.cx + 30, 118], [B.cx + 18, 126], [B.cx + 4, 120]]);
    px.shape(hole, (x, y) => (!hole(x - 1.2, y) || !hole(x, y - 1.2)) ? P(GR[0]) : (!hole(x + 1.2, y) || !hole(x, y + 1.2)) ? P(GR[5]) : P(y > 117 && x < B.cx + 22 ? '#a55a2a' : (Math.floor(x) + Math.floor(y)) % 5 === 0 ? METD : '#0c1410'), B.cx + 2, 102, B.cx + 32, 128);
    px.rect(B.cx + 10, 112, 9, 2, P('#e09048')); px.rect(B.cx + 10, 114, 9, 1, P('#6b3a1e')); px.dot(B.cx + 22, 110, P(AMBL));
    px.rect(B.cx - 44, 104, 13, 10, P(METD)); px.rect(B.cx - 44, 104, 13, 1, P(METL)); px.rect(B.cx - 44, 104, 1, 10, P(MET)); px.rect(B.cx - 43, 105, 11, 8, P(MET));
    for (const [x, y] of [[B.cx - 43, 105], [B.cx - 34, 105], [B.cx - 43, 112], [B.cx - 34, 112]]) { px.dot(x, y, P(WHITE)); px.dot(x + 1, y, P(METDD)); }
  }
  // the steel collar where the body meets the skirt (its amber lamps are live)
  px.shape((x, y) => BODY(x, y) && y > collarY(x) - 5.5, (x, y) => { const d = collarY(x) - y; return P(d > 4.5 ? METL : d > 2 ? MET : d > 1 ? METD : METDD); });
  for (const [x, y] of COLLAR_LAMPS) px.rect(x, y, 2, 2, P(AM0));
  // the eye: a dark recess, a thick steel bezel with bolts, the big white lens
  px.shape((x, y) => Math.hypot(x - EX, y - EY) <= BR + 1.8, (x, y) => {
    const dx = x - EX, dy = y - EY, d = Math.hypot(dx, dy) || 1, l = lit(dx / d, dy / d);
    if (d > BR) return P(GR[0]);
    if (d > LR) {
      const q = (d - LR) / (BR - LR);
      if (q < 0.16) return P(METDD);
      if (q > 0.9) return P(l > 0.3 ? METL : METD);
      return steel(q > 0.5 ? l * (0.6 + q * 0.6) : 0.1 - l * 0.9);
    }
    const sh = dx * 0.35 + dy * 0.94;
    if (d > LR - 1.4) return P(l > 0 ? EYES : '#dfeaf4');
    return P(sh > LR * 0.84 ? '#93a9c4' : sh > LR * 0.56 ? EYES : EYEW);
  });
  for (let k = 0; k < 8; k++) { const a = (k * 45 + 22.5) * DEG, x = Math.round(EX + Math.cos(a) * 27.6 - 0.5), y = Math.round(EY + Math.sin(a) * 27.6 - 0.5); px.rect(x - 1, y - 1, 3, 3, P(METDD)); px.rect(x - 1, y - 1, 2, 2, P(METL)); px.dot(x - 1, y - 1, P(WHITE)); }
  // the mouth: a grumpy steel grille (corners turned down), a furnace glowing behind the bars
  px.shape((x, y) => Math.abs(x - MX) <= MW + 2 && y >= mT(x) - 2 && y <= mT(x) + 10, (x, y) => {
    if (!MOUTH(x, y)) return P(y < mT(x) ? METL : y > mT(x) + 8 ? METDD : Math.abs(x - MX) > MW ? METD : MET);
    const bx = (Math.floor(x) - MX + 120) % 6, d = y - mT(x);
    if (bx < 2) return P(d < 1.5 ? METL : bx ? METD : MET);
    return P(d > 6 ? '#c97a14' : d > 4 ? '#6a3c10' : '#0c1410');
  });
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { px.dot(MX + s * (MW + 3 + k), mT(MX + MW) + 8 + k, P(GR[0])); px.dot(MX + s * (MW + 3 + k), mT(MX + MW) + 9 + k, P(GR[0])); }
  // shoulders: a steel ball joint in a dark socket, a captain's gold epaulette on top
  for (const [sx, sy] of SHO) {
    px.disc(sx, sy, 9.2, P(GR[0]));
    px.shape((x, y) => Math.hypot(x - sx, y - sy) <= 7.6, (x, y) => { const d = Math.hypot(x - sx, y - sy) || 1; return steel(lit((x - sx) / d, (y - sy) / d) * d / 7.6 + 0.1); });
    px.shape((x, y) => ((x - sx) / 11) ** 2 + ((y - sy + 10) / 3.6) ** 2 <= 1, (x, y) => P(y < sy - 11 ? AMBL : y < sy - 9 ? AMB : AMBD));
    for (let i = -4; i <= 4; i++) { px.rect(sx + i * 2.4 - 0.5, sy - 7, 1, 4, P(i % 2 ? AMB : AMBD)); px.dot(sx + i * 2.4 - 0.5, sy - 3, P(AMBL)); }
  }
  return px.outline().sprite(true);
}

// other faces for the mouth, drawn over the baked grumpy grille: 'o' (ouch: a round grille) and 'wavy' (dizzy)
function paintMouth(kind) {
  const px = new Pix(MX - 42, 172, 84, 30);
  // the muzzle plate again, without the grumpy grille and its turned-down corners
  px.shape((x, y) => { const md = y - mT(x); return BODY(x, y) && Math.abs(x - MX) <= MW + 8 && md >= -7 && md <= 16 && y <= collarY(x) - 5.5; }, (x, y) => {
    const md = y - mT(x);
    return P(Math.abs(x - MX) > MW + 7 || md < -6 ? GR[0] : GR[md < -4.6 ? 5 : x < MX + 10 ? 4 : 3]);
  });
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) for (const dy of [8, 9]) {
    const x = MX + s * (MW + 3 + k), y = mT(MX + MW) + dy + k, cx = x + 0.5, cy = y + 0.5, d = collarY(cx) - cy;
    px.dot(x, y, d < 0 ? skirtFace(cx, cy) : P(d > 4.5 ? METL : d > 2 ? MET : d > 1 ? METD : METDD));
  }
  if (kind === 'o') {
    const q = (x, y) => Math.hypot((x - MX) / 12, (y - 185.5) / 7.5);
    px.shape((x, y) => q(x, y) <= 1, (x, y) => {
      const d = q(x, y);
      if (d > 0.8) return P(y < 184 ? METL : y > 189 ? METDD : MET);
      const bx = (Math.floor(x) - MX + 120) % 5;
      return P(bx === 0 ? MET : y > 188 ? '#c97a14' : y > 186 ? '#6a3c10' : '#0c1410');
    });
    px.shape((x, y) => q(x, y) > 1 && q(x, y) <= 1.16, P(GR[0]));
  } else {
    const yw = x => 185.5 + Math.sin((x - MX) / 4.2) * 3;
    px.shape((x, y) => Math.abs(x - MX) <= MW - 2 && Math.abs(y - yw(x)) <= 2.6, (x, y) => {
      const d = y - yw(x), bx = (Math.floor(x) - MX + 120) % 6;
      if (Math.abs(d) > 1.7) return P(d < 0 ? METL : METDD);
      return P(bx < 2 ? MET : d > 0.4 ? '#c97a14' : '#0c1410');
    });
    px.shape((x, y) => Math.abs(x - MX) <= MW - 1 && Math.abs(y - yw(x)) > 2.6 && Math.abs(y - yw(x)) <= 3.5, P(GR[0]));
  }
  return px.sprite(false);
}

// the tiny captain's cap: white crown, navy band with a gold badge, a black visor toward the hero
function paintCap() {
  const px = new Pix(CAPX - 36, CAPY - 26, 68, 42);
  const cap = (f, col) => px.shape((x, y) => { const [u, v] = rot(x, y, CAPX, CAPY, CAPA); return f(u, -v); }, (x, y) => { const [u, v] = rot(x, y, CAPX, CAPY, CAPA); return col(u, -v); });
  cap((u, w) => ((u - 1) / 21) ** 2 + ((w - 8) / 7) ** 2 <= 1 && w >= 5, (u, w) => P(u > 12 || w < 6.5 ? '#aebbdc' : w > 12 && u < 4 ? WHITE : '#eef2ff'));
  cap((u, w) => Math.abs(u) <= 16 && w >= 0 && w < 5.5, (u, w) => P(w >= 2 && w < 3.4 ? AMB : u > 10 ? '#121a3c' : w > 4.4 ? '#34468c' : '#22306a'));
  cap((u, w) => ((u + 11) / 3.6) ** 2 + ((w - 3.4) / 3.6) ** 2 <= 1, (u, w) => P(u < -11.5 && w > 3.6 ? AMBL : w < 1.6 ? AMBD : AMB));
  cap(polyIn([[-12, 1.2], [-27, -3.4], [-26, -6.6], [-10, -2.2]]), (u, w) => P(w > -2.0 + (u + 19) * 0.3 ? '#6a6a94' : '#15151f'));
  return px.outline().sprite(true);
}

// the iris: a steel camera-shutter ring round a red iris with shutter blades.
// kinds: 'norm'; 'warn' (yellow, the shutter closed down to a small pupil); 'hot' (white-hot while it fires);
// 'tiny' (ouch: a small startled iris); 'spin0..3' (dizzy: a spiral, four frames)
function paintIris(kind) {
  const px = new Pix(-15, -15, 30, 30);
  if (kind === 'tiny') {
    px.shape((x, y) => x * x + y * y <= 7.2 * 7.2, (x, y) => { const d = Math.hypot(x, y); return P(d > 6.2 ? METDD : d > 5 ? METL : d > 2.4 ? IRIS : PUP); });
    px.dot(-2, -2, WHITEP);
    return px.sprite(false);
  }
  const spin = kind.startsWith('spin') ? +kind[4] : -1;
  px.shape((x, y) => x * x + y * y <= 13.6 * 13.6, (x, y) => {
    const d = Math.hypot(x, y), a = ((Math.atan2(y, x) / DEG) + 360) % 360;
    if (d > 12.6) return P(METDD);
    if (d > 10.6) return P(a % 30 < 8 ? METDD : lit(x / d, y / d) > -0.1 ? METL : MET);
    if (d > 9.8) return P(spin >= 0 ? '#5a6a8a' : kind === 'warn' ? AMBD : IRISD);
    if (spin >= 0) return P(((a + d * 34 + spin * 90) % 360) < 180 ? EYEW : PUP);          // a hypno spiral
    const blade = ((a + d * 6) % 60) < 8;
    if (kind === 'warn') return d < 2.6 ? P(PUP) : d < 4 ? P(AMBD) : P(blade ? AMBD : x * 0.4 + y * 0.9 > 4 ? '#f0b030' : d < 7 ? AMBL : WARN);
    if (kind === 'norm') return d < 4.8 ? P(PUP) : P(blade ? IRISD : x * 0.4 + y * 0.9 > 4 ? '#d62a22' : IRIS);
    if (d > 7.4) return P(blade ? IRISD : IRIS);
    if (d > 5.6) return P(blade ? '#c9540f' : '#ff8a2a');
    if (d > 4) return P(blade ? '#f0b030' : WARN);
    return WHITEP;
  });
  if (kind === 'norm') px.rect(-3, -3, 2, 2, WHITEP);
  if (kind === 'warn') px.rect(-5, -6, 2, 2, WHITEP);
  return px.sprite(false);
}

// the heavy brow plate over the eye: a tilted slab with a lit top edge and a bolt at each end. (yl, yr) = the height of
// its left and right end over the eye's centre: left end low = grumpy, level = calm, left end high = worried / dizzy
const BROWS = [[-17, -42], [-24.5, -37.5], [-33, -35], [-39, -30], [-41, -25]];
function paintBrow(yl, yr) {
  const xl = EX - 36, xr = EX + 36, px = new Pix(EX - 42, EY - 56, 84, 50);
  const b0 = [xl - 1, EY + yl + 5.5], b1 = [xl + 2, EY + yl - 5.5], b2 = [xr - 3, EY + yr - 5.5], b3 = [xr + 1, EY + yr + 5.5];
  const inB = polyIn([b0, b1, b2, b3]);
  px.shape(inB, (x, y) => {
    const dl = segDist(x, y, b0[0], b0[1], b3[0], b3[1])[0], dt = segDist(x, y, b1[0], b1[1], b2[0], b2[1])[0];
    if (!inB(x - 1.2, y) || !inB(x + 1.2, y)) return P(GR[0]);
    if (dl < 1.1 || dt < 1.1) return P(GR[0]);
    if (dl < 3) return P(GR[2]);
    if (dt < 2.8) return P(GR[5]);
    return P(x < EX + 6 ? GR[4] : GR[3]);
  });
  for (const k of [0.07, 0.93]) { const x = Math.round(lerp(b0[0] + 1, b3[0] - 1, k)), y = Math.round(lerp((b0[1] + b1[1]) / 2, (b3[1] + b2[1]) / 2, k)); px.rect(x - 1, y - 1, 3, 3, P(METD)); px.rect(x - 1, y - 1, 2, 2, P(METL)); }
  const my = Math.round((b1[1] + b2[1]) / 2);
  px.rect(EX - 6, my + 2, 3, 1, P(GR[1])); px.rect(EX - 5, my + 3, 1, 2, P(GR[1]));       // a chip from the fight
  return px.outline().sprite(true);
}

// a claw hand: a green cuff, a steel palm with a magenta emitter, two jointed fingers and a short middle one.
// The wrist is at (0, 0), the hand points along ang; open = how far the fingers spread (radians).
const CLAW_K = 1.3;
function paintClaw(ang, open) {
  const K = CLAW_K, R = 46, px = new Pix(-R, -R, R * 2 + 1, R * 2 + 1), ca = Math.cos(ang), sa = Math.sin(ang);
  const toS = (u, v) => [(u * ca - v * sa) * K, (u * sa + v * ca) * K];
  const capsule = (a, b, r0, r1, dk) => px.shape((x, y) => { const [d, t] = segDist(x, y, a[0], a[1], b[0], b[1]); return d <= lerp(r0, r1, t) * K; }, (x, y) => {
    const [d, t] = segDist(x, y, a[0], a[1], b[0], b[1]), qx = a[0] + (b[0] - a[0]) * t, qy = a[1] + (b[1] - a[1]) * t, r = lerp(r0, r1, t) * K;
    return steel(lit((x - qx) / (d || 1), (y - qy) / (d || 1)) * Math.min(1, d / r * 1.5) + dk);
  }, Math.min(a[0], b[0]) - 5, Math.min(a[1], b[1]) - 5, Math.max(a[0], b[0]) + 6, Math.max(a[1], b[1]) + 6);
  capsule(toS(12, 0), toS(21, 0), 2, 1.1, -0.4);                               // the short middle finger, behind
  for (const sg of [-1, 1]) {
    const a2 = open - 1.4, b = toS(9, sg * 4), k = toS(9 + 10 * Math.cos(open), sg * (4 + 10 * Math.sin(open)));
    const t = toS(9 + 10 * Math.cos(open) + 11 * Math.cos(a2), sg * (4 + 10 * Math.sin(open) + 11 * Math.sin(a2)));
    capsule(b, k, 2.8, 2.5, 0); capsule(k, t, 2.4, 0.8, 0.1);
    px.disc(k[0], k[1], 2.6 * K, P(METD)); px.dot(k[0] - 1, k[1] - 1, P(METL));
    px.dot(t[0], t[1], WHITEP);
  }
  const cu = 5.6 * K;
  px.shape((x, y) => { const [u, v] = rot(x, y, 0, 0, ang); return u >= -3 * K && u <= 5 * K && Math.abs(v) <= cu; }, (x, y) => {
    const [u, v] = rot(x, y, 0, 0, ang), sg = v < 0 ? -1 : 1;
    if (u < -3 * K + 1 || u > 5 * K - 1) return P(GR[1]);
    return green(lit(-sa * sg, ca * sg) * Math.abs(v) / cu);
  }, -14, -14, 15, 15);
  const pc = toS(9, 0), pr = 6.4 * K;
  px.shape((x, y) => Math.hypot(x - pc[0], y - pc[1]) <= pr, (x, y) => { const d = Math.hypot(x - pc[0], y - pc[1]) || 1; return steel(lit((x - pc[0]) / d, (y - pc[1]) / d) * d / pr + 0.1); });
  px.disc(pc[0], pc[1], 2.6 * K, P(MAG)); px.dot(pc[0] - 1, pc[1] - 1, P(MAGL)); px.dot(pc[0] - 2, pc[1] - 1, P(MAGL)); px.dot(pc[0] - 1, pc[1] - 2, P(MAGL));
  px.outline();
  // trim to what was painted
  let x0 = px.w, y0 = px.h, x1 = 0, y1 = 0;
  for (let j = 0; j < px.h; j++) for (let i = 0; i < px.w; i++) if (px.d[j * px.w + i]) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  const q = new Pix(px.x0 + x0, px.y0 + y0, x1 - x0 + 1, y1 - y0 + 1);
  for (let j = 0; j < q.h; j++) for (let i = 0; i < q.w; i++) q.d[j * q.w + i] = px.d[(j + y0) * px.w + i + x0];
  return q.sprite(false);
}
// claws are painted when first needed and kept: 32 directions x 4 openings (a hand turns in steps of 11 degrees)
const CLAWS = new Map(), CLAW_OPEN = [0.3, 0.6, 0.9, 1.25], CLAW_STEP = Math.PI / 16;
function clawSprite(a, open) {
  const ai = ((Math.round(a / CLAW_STEP) % 32) + 32) % 32, oi = open < 0.45 ? 0 : open < 0.75 ? 1 : open < 1.08 ? 2 : 3, key = ai * 4 + oi;
  let s = CLAWS.get(key);
  if (!s) { s = paintClaw(ai * CLAW_STEP, CLAW_OPEN[oi]); s.a = ai * CLAW_STEP; CLAWS.set(key, s); }
  return s;
}
// the hose's links are drawn in two passes (all the dark discs, then all the balls): a light hose with dark ribs
function ball(r, tone, dk = 0) {
  const c = Math.ceil(r), n = c * 2 + 1, px = new Pix(-c, -c, n, n);
  px.shape((x, y) => (x - 0.5) ** 2 + (y - 0.5) ** 2 <= r * r, tone ? (x, y) => { const dx = x - 0.5, dy = y - 0.5, d = Math.hypot(dx, dy) || 1; return tone(lit(dx / d, dy / d) * Math.min(1, d / r * 1.4) + dk); } : OUTP);
  return { img: px.canvas(false), c };
}
// a landing ring for the deck: an ellipse of dots with a cross in the middle (on = the bright blink frame)
function ringSprite(c, cl, on) {
  const px = new Pix(-18, -5, 37, 11);
  for (let a = 0; a < 360; a += 3) { px.dot(Math.round(Math.cos(a * DEG) * 15), Math.round(1 + Math.sin(a * DEG) * 3.4), P(on ? c : cl)); px.dot(Math.round(Math.cos(a * DEG) * 14), Math.round(1 + Math.sin(a * DEG) * 2.6), P(on ? cl : c)); }
  px.rect(-3, 1, 7, 1, P(c)); px.rect(0, 0, 1, 3, P(c));
  return px.outline().sprite(false);
}
// an antenna lamp: [dark, base, light, spark]
function lampSprite(cols) {
  const px = new Pix(-6, -6, 13, 13);
  px.disc(0.5, 0.5, 4.6, P(cols[1])); px.disc(-0.5, -0.5, 3.1, P(cols[2])); px.disc(-1.5, -1.5, 1.2, P(cols[3]));
  px.rect(1, 3, 3, 1, P(cols[0])); px.rect(3, 1, 1, 2, P(cols[0]));
  return px.outline().sprite(false);
}
// the cargo crate it drops: alien steel with green corner irons, a hazard band and the oggles' eye mark
function paintCrate() {
  const px = new Pix(-13, -11, 26, 22);
  px.shape((x, y) => Math.abs(x) <= 12 && Math.abs(y) <= 10, (x, y) => {
    const ax = Math.abs(x), ay = Math.abs(y);
    if (ax > 9 && ay > 7) return P(x < 0 && y < 0 ? GR[4] : GR[2]);
    if (ay > 9) return P(y < 0 ? SH[7] : SH[3]);
    if (ax > 11) return P(x < 0 ? SH[6] : SH[3]);
    if (y > 3 && y < 8) return P(((Math.floor(x) + Math.floor(y) + 40) >> 2) % 2 ? AMB : '#22222c');
    if (Math.hypot(x, y + 2.5) <= 4.4) { const d = Math.hypot(x, y + 2.5); return P(d > 3.3 ? GR[1] : d > 1.7 ? GR[4] : IRIS); }
    return P(Math.floor(x) % 8 === 0 ? SH[3] : y < -7 ? SH[6] : SH[5]);
  });
  return px.outline().sprite(false);
}
// comic letters (the game's 5x7 font, doubled, two-tone, outlined): cached per letter and colour pair
const LET = {};
function letter(ch, top, bot, sc) {
  const key = ch + top + bot + sc;
  if (LET[key]) return LET[key];
  const px = new Pix(-2, -2, 5 * sc + 5, 7 * sc + 5), rows = (GLYPHS[ch] || '').split(' ');
  rows.forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] === '1') px.rect(x * sc, y * sc, sc, sc, P(y >= 4 ? bot : top)); });
  px.outline();
  const q = px.d.slice();      // a second outline ring down-right: a chunky drop shadow
  for (let j = 1; j < px.h; j++) for (let i = 1; i < px.w; i++) if (!q[j * px.w + i] && q[(j - 1) * px.w + i - 1] === OUTP) px.d[j * px.w + i] = OUTP;
  return LET[key] = px.sprite(false);
}

// =====================================================================================================================
// Bake: three steps, run once (queued on L5ART.bakes so the menus' idle time or the level's load pays for them; whoever
// needs the art first runs what is left)
// =====================================================================================================================
const A = { n: 0 };
const BAKE = [
  () => {
    A.skirt = paintSkirt(); A.cap = paintCap(); A.crate = paintCrate();
    A.iris = { norm: paintIris('norm'), warn: paintIris('warn'), hot: paintIris('hot'), tiny: paintIris('tiny'), spin: [0, 1, 2, 3].map(i => paintIris('spin' + i)) };
    A.brow = BROWS.map(([l, r]) => paintBrow(l, r));
    A.mouth = { o: paintMouth('o'), wavy: paintMouth('wavy') };
    A.lamp = { off: lampSprite(['#3a2c08', '#5a4410', AM0, '#b08a20']), amb: lampSprite([AMBD, AMB, AMBL, WHITE]), hot: lampSprite([AMB, AMBL, WHITE, WHITE]),
      red: lampSprite(['#a3151a', RED, '#ff8a80', WHITE]), redoff: lampSprite(['#3a0a0c', '#6a1216', '#a3151a', '#d0453c']) };
    A.link = { rim: ball(4.5, null), lite: ball(3.5, steel, 0.12), dark: ball(3.5, steel, -0.55), cuffRim: ball(6.2, null), cuffB: ball(5.2, green) };
    // the claws of the resting pose, so the first frame of the fight paints nothing
    for (const [a, o] of [[2.0, 0.6], [-1.95, 0.9], [-1.95, 0.3], [1.9, 0.3], [-1.2, 0.3]]) clawSprite(a, o);
    A.ring = { crate: [ringSprite(RED, REDL, false), ringSprite(RED, REDL, true)], pod: [ringSprite(AMB, AMBL, false), ringSprite(AMB, AMBL, true)] };
    for (const c of [BEAM, WHITE, AMB, RED, WARN, '#ffb040']) glowSprite(c);
  },
  () => { A.body = paintBody(false); },
  () => { A.body2 = paintBody(true); }
];
function art() { while (A.n < BAKE.length) BAKE[A.n++](); return A; }
(L5ART.bakes = L5ART.bakes || []).push(...BAKE.map((f, i) => () => { if (A.n === i) { A.n++; f(); } }));

// =====================================================================================================================
// Tuning (frames, px per frame)
// =====================================================================================================================
const HP = 235;                       // tuned at integration (was 280); less than the spec's 420: only the open eye takes damage (tools/m5/build/notes-boss.md)
const REST1 = 124, REST2 = 104;       // the breather between attacks, phase 1 / phase 2
const INTRO_LEN = 176, PH2_LEN = 112;
const BEAM_TELL = 72, BEAM_V = 2.1, BEAM_V2 = 2.5, BEAM_COOL = 26;
const DROP_FETCH = 52, DROP_FOLLOW = 60, DROP_LOCK = 40, DROP_AFTER = 50, CARRY_Y = 60, PAIR = 64;
const SHUT_AT = 45, SHUT_GAP = 300, SHUT_SLAM = 14, SWEEP_TELL = 48, SWEEP_DOWN = 8, SWEEP_V = 3, ROLL_TELL = 40, PEEK_AT = 150, PEEK = 40;
const DASH_TELL = 64, DASH_V = 3.4, DASH_BACK = 1.5, DIZZY = 130;
const LID_SHUT = 4;                   // where the two lids meet (px below the eye's centre)

// design -> world offsets of the boss this frame
const offX = e => Math.round(e.x + e.ox) - BX;
const offY = e => Math.round(e.y + e.oy + e.sink) - BY;
// the surface a falling thing lands on at world x: a console top, else the deck
function surfaceAt(x) {
  let y = groundAt(x);
  for (const pl of LV.plats) if (x > pl.x - 3 && x < pl.x + pl.w + 3 && pl.y < y && pl.y > y - 60) y = pl.y;
  return y;
}

// =====================================================================================================================
// Drawing: the rig
// =====================================================================================================================
const part = (s, dx, dy) => ctx.drawImage(s.img, s.x0 + dx, s.y0 + dy);
const HP_ = new Float32Array(2 * 260);
// the cable arm's centre line from the shoulder to the wrist, a point every 4 px: a curve that leaves the shoulder
// along (ux, uy) and comes into the wrist along the claw's axis turned by ea
function hosePts(sx, sy, m) {
  const wx = m.x, wy = m.y, ea = m.a + m.ea, d = Math.hypot(wx - sx, wy - sy), k = clamp(d * 0.45, 16, 90);
  const c1x = sx + m.ux * k, c1y = sy + m.uy * k, c2x = wx - Math.cos(ea) * k * 0.8, c2y = wy - Math.sin(ea) * k * 0.8;
  const N = d > 150 ? 96 : 48;
  let n = 1, px = sx, py = sy, acc = 0;
  HP_[0] = sx; HP_[1] = sy;
  for (let i = 1; i <= N && n < 258; i++) {
    const t = i / N, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, q = t * t * t;
    const x = a * sx + b * c1x + c * c2x + q * wx, y = a * sy + b * c1y + c * c2y + q * wy;
    acc += Math.hypot(x - px, y - py); px = x; py = y;
    if (acc >= 4) { acc = 0; HP_[n * 2] = x; HP_[n * 2 + 1] = y; n++; }
  }
  HP_[n * 2] = wx; HP_[n * 2 + 1] = wy; n++;
  return n;
}
// a cable arm (ribbed steel hose, green cuffs) ending in a three-fingered claw, from the shoulder (sx, sy)
function drawArm(m, sx, sy) {
  const L = A.link, n = hosePts(sx, sy, m), mid = Math.round(n * 0.5), wx = Math.round(m.x), wy = Math.round(m.y);
  const st = (s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.c, Math.round(y) - s.c);
  const cuffAt = i => i === mid;
  for (let i = 0; i < n; i++) st(cuffAt(i) ? L.cuffRim : L.rim, HP_[i * 2], HP_[i * 2 + 1]);
  for (let i = 0; i < n; i++) st(cuffAt(i) ? L.cuffB : i % 2 ? L.lite : L.dark, HP_[i * 2], HP_[i * 2 + 1]);
  const s = clawSprite(m.a, m.open);
  ctx.drawImage(s.img, wx + s.x0, wy + s.y0);
  if (m.glow > 0) glow(wx + 9 * CLAW_K * Math.cos(s.a), wy + 9 * CLAW_K * Math.sin(s.a), 9, m.gc || BEAM, m.glow);
}

function drawThrusters(e, t, dk) {
  const pw = e.thr;
  if (pw <= 0.05) return;
  for (let i = 0; i < NOZ.length; i++) {
    const x = B.cx + NOZ[i], y = Math.round(lowEdge(x)) + 3, f = Math.floor(t / 3 + i) % 3;
    const len = Math.round(clamp((dk - y) * 0.9, 5, 26) * Math.min(1.2, 0.55 + pw * 0.45)), wide = pw > 1.4 ? 1 : 0;
    glow(x, y + 2, 13 + wide * 4, BEAM, 0.55);
    for (let j = 0; j < len; j++) {
      const k = j / len, w = Math.max(1, Math.round((5 + wide) * (1 - k * k)) - (j > len - 3 && f === 0 ? 1 : 0));
      ctx.fillStyle = BEAM; ctx.fillRect(x - w, y + j, w * 2, 1);
      if (k < 0.72) { const w2 = Math.max(1, w - 1 - (k > 0.4 ? 1 : 0)); ctx.fillStyle = BEAML; ctx.fillRect(x - w2, y + j, w2 * 2, 1); }
      if (k < 0.42 - f * 0.06) { const w3 = Math.max(1, w - 2 - (k > 0.2 ? 1 : 0)); ctx.fillStyle = WHITE; ctx.fillRect(x - w3, y + j, w3 * 2, 1); }
    }
  }
  if (dk - BY > 24) return;                       // high above the deck: no splash, no light pool
  for (let i = 0; i < 18; i++) {
    const nx = NOZ[i % 3], ph = ((t * 1.1 + hsh(i * 4.3) * 24) % 24) / 24, dir = i % 2 ? 1 : -1;
    ctx.fillStyle = ph < 0.4 ? BEAML : BEAM; ctx.fillRect(Math.round(B.cx + nx + dir * (3 + ph * 16)), dk - 1 - Math.round(ph * ph * 4 * hsh(i)), ph < 0.5 ? 2 : 1, 1);
  }
  ctx.save(); ctx.translate(B.cx, dk + 1); ctx.scale(1, 0.22); glow(0, 0, 80, BEAM, 0.5 * Math.min(1, pw)); ctx.restore();
}

// an antenna: a springy stalk from its socket to its lamp. i = which one; (dx, dy) = how far the tip has swung
function drawAntenna(i, dx, dy, kind, t) {
  const a = ANT[i], tx = a.tx + dx, ty = a.ty + dy, n = Math.ceil(Math.max(Math.abs(tx - a.bx), Math.abs(ty - a.by)));
  const bend = a.bend + dx * 0.4, X = k => Math.round(lerp(a.bx, tx, k / n) + Math.sin(k / n * Math.PI) * bend), Y = k => Math.round(lerp(a.by, ty, k / n));
  ctx.fillStyle = OUT; for (let k = 0; k <= n; k++) ctx.fillRect(X(k) - 1, Y(k), 4, 1);
  ctx.fillStyle = METD; for (let k = 0; k <= n; k++) ctx.fillRect(X(k), Y(k), 1, 1);
  ctx.fillStyle = METL; for (let k = 0; k <= n; k++) ctx.fillRect(X(k) + 1, Y(k), 1, 1);
  ctx.fillStyle = MET; for (let k = 1; k <= n; k += 4) ctx.fillRect(X(k) - 1, Y(k), 1, 1);
  const s = A.lamp[kind], lx = tx + 1, ly = ty - 2;
  if (kind !== 'off' && kind !== 'redoff') glow(lx, ly, kind === 'hot' ? 14 : 10, kind === 'red' ? RED : AMB, kind === 'hot' ? 0.75 : 0.45);
  ctx.drawImage(s.img, lx + s.x0, ly + s.y0);
  if (kind === 'hot' && (Math.floor(t / 4) + i) % 2) { ctx.fillStyle = AMBL; ctx.fillRect(lx - 8, ly, 2, 1); ctx.fillRect(lx + 7, ly, 2, 1); ctx.fillRect(lx, ly - 8, 1, 2); }
}

// the two armoured lids, live: lu / ll = where the upper lid's lower edge and the lower lid's upper edge sit at the
// eye's centre column (px below the centre); the upper edge slopes down toward the hero (grumpy)
function drawLids(e, flash) {
  const R2 = (LR + 0.4) * (LR + 0.4), lu = e.lu, ll = e.ll, x0 = EX - LR, cols = LR * 2;
  const U = new Int16Array(cols), Lo = new Int16Array(cols), T = new Int16Array(cols), Bt = new Int16Array(cols);
  for (let i = 0; i < cols; i++) {
    const xc = x0 + i + 0.5, half = Math.sqrt(Math.max(0, R2 - (xc - EX) * (xc - EX)));
    T[i] = Math.ceil(EY - half - 0.5); Bt[i] = Math.floor(EY + half + 0.5);
    const eu = EY + lu - (xc - EX) * US;
    U[i] = Math.round(eu); Lo[i] = Math.round(Math.max(EY + ll + (xc - EX) * 0.04, eu));
  }
  const band = (c, f) => { ctx.fillStyle = flash ? WHITE : c; for (let i = 0; i < cols; i++) f(x0 + i, i); };
  const row = (x, i, y, h) => { const a = Math.max(y, T[i]), b = Math.min(y + h, Bt[i]); if (b > a) ctx.fillRect(x, a, 1, b - a); };
  // the upper lid's shadow on the lens
  if (!flash) { ctx.fillStyle = 'rgba(95,120,150,0.5)'; for (let i = 0; i < cols; i++) { const a = Math.max(U[i], T[i]), b = Math.min(U[i] + 2, Lo[i], Bt[i] - 3); if (b > a) ctx.fillRect(x0 + i, a, 1, b - a); } }
  // lower lid: base, a lit lip, a slat seam
  band(GR[4], (x, i) => { if (x < EX + 4) row(x, i, Lo[i], 99); });
  band(GR[3], (x, i) => { if (x >= EX + 4) row(x, i, Lo[i], 99); });
  band(GR[1], (x, i) => row(x, i, Lo[i] + 5, 1));
  band(GR[5], (x, i) => row(x, i, Lo[i] + 1, 2));
  band(GR[0], (x, i) => row(x, i, Lo[i], 1));
  // upper lid: base, two slat seams, a thick lip
  band(GR[4], (x, i) => { if (x < EX - 4 && U[i] > T[i]) ctx.fillRect(x, T[i], 1, U[i] - T[i]); });
  band(GR[3], (x, i) => { if (x >= EX - 4 && U[i] > T[i]) ctx.fillRect(x, T[i], 1, U[i] - T[i]); });
  band(GR[1], (x, i) => { if (U[i] - 10 >= T[i]) ctx.fillRect(x, U[i] - 10, 1, 1); if (U[i] - 19 >= T[i]) ctx.fillRect(x, U[i] - 19, 1, 1); });
  band(GR[5], (x, i) => { if (U[i] - 9 >= T[i]) ctx.fillRect(x, U[i] - 9, 1, 1); if (U[i] - 18 >= T[i]) ctx.fillRect(x, U[i] - 18, 1, 1); const a = Math.max(U[i] - 4, T[i]); if (U[i] - 2 > a) ctx.fillRect(x, a, 1, U[i] - 2 - a); });
  band(GR[2], (x, i) => { if (U[i] - 2 >= T[i]) ctx.fillRect(x, U[i] - 2, 1, 1); });
  band(GR[0], (x, i) => { if (U[i] - 1 >= T[i]) ctx.fillRect(x, U[i] - 1, 1, 1); });
  if (!flash) for (const dx of [-12, 0, 12]) { const i = dx + LR, y = U[i] - 6; if (y > T[i] + 1) { ctx.fillStyle = GR[6]; ctx.fillRect(EX + dx, y, 1, 1); ctx.fillStyle = GR[0]; ctx.fillRect(EX + dx + 1, y + 1, 1, 1); } }
  // the jammed lower lid of phase 2: a bent corner and a loose bolt
  if (e.ph2 && !flash) { const i = 9, x = x0 + i; ctx.fillStyle = GR[0]; ctx.fillRect(x, Lo[i] - 2, 5, 1); ctx.fillRect(x + 4, Lo[i] - 1, 1, 2); ctx.fillStyle = GR[5]; ctx.fillRect(x, Lo[i] - 1, 4, 1); ctx.fillStyle = METL; ctx.fillRect(x + 7, Lo[i] + 3, 2, 2); }
}

// a comic anger mark throbbing on its temple
function drawAnger(t) {
  const ax = B.cx + 41, ay = 99 - (Math.floor(t / 8) % 2), M = ['..#...#..', '..#...#..', '###...###', '.........', '.........', '###...###', '..#...#..', '..#...#..'];
  for (const [c, ox, oy] of [[OUT, -1, 0], [OUT, 1, 0], [OUT, 0, -1], [OUT, 0, 1], [RED, 0, 0]]) { ctx.fillStyle = c; M.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') ctx.fillRect(ax + i + ox, ay + j + oy, 1, 1); }); }
  ctx.fillStyle = '#ffb0a8'; ctx.fillRect(ax, ay + 2, 2, 1); ctx.fillRect(ax + 6, ay + 2, 2, 1);
}
// little stars going round its head while it is dizzy
function drawStars(t, cy) {
  for (let k = 0; k < 4; k++) {
    const a = t / 9 + k * Math.PI / 2, x = Math.round(B.cx - 6 + Math.cos(a) * 46), y = Math.round(cy + Math.sin(a) * 7), front = Math.sin(a) > 0;
    const c = k % 2 ? AMBL : WHITE;
    ctx.fillStyle = OUT; ctx.fillRect(x - 3, y - 1, 7, 3); ctx.fillRect(x - 1, y - 3, 3, 7);
    ctx.fillStyle = front ? c : AMB; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 1, y - 1, 3, 3);
  }
}

// the tractor cone under a claw that carries something: from (x, y0) down to y1
function drawCone(x, y0, y1, t, col = BEAM) {
  const n = y1 - y0;
  ctx.fillStyle = col;
  for (let j = 0; j < n; j += 2) { const k = j / n, w = Math.round(7 + k * 15); ctx.globalAlpha = clamp(0.4 - k * 0.12 + 0.07 * Math.sin(t / 3 - j / 4), 0, 1); ctx.fillRect(x - w, y0 + j, w * 2, 2); }
  ctx.fillStyle = BEAML; ctx.globalAlpha = 0.5;
  for (let j = 0; j < n; j += 2) { const w = Math.round(7 + j / n * 15); ctx.fillRect(x - w, y0 + j, 1, 2); ctx.fillRect(x + w - 1, y0 + j, 1, 2); }
  for (let k = 0; k < 4; k++) {
    const u = ((t / 36 + k / 4) % 1), yy = Math.round(y1 - u * n), w = Math.round(7 + (1 - u) * 15);
    ctx.globalAlpha = 0.55 * (1 - Math.abs(u - 0.5) * 2) + 0.2; ctx.fillRect(x - w, yy, w * 2, 1);
  }
  ctx.globalAlpha = 1;
  glow(x, y0 + 2, 14, col, 0.7);
}

const BMY = new Float32Array(256), BMH = new Float32Array(256), BANDS = [[2, GR[2]], [1, BEAM], [-1, BEAML], [-3, WHITE]];
// the eye beam (design coordinates): a thick green-and-white ray from the iris to the hot spot on the deck
function drawBeam(e, t, hx, dk) {
  const ix = EX + Math.round(e.lx), iy = EY + Math.round(e.ly) + Math.round(e.by), run = Math.max(8, ix - hx), slope = (dk - 1 - iy) / run, fat = Math.hypot(1, slope);
  const YB = x => iy + (ix - x) * slope;
  for (let x = hx + 16; x < ix - 30; x += 44) glow(x, YB(x), 18, BEAM, 0.2);
  // four nested bands, one colour at a time (a column every 2 px)
  let n = 0;
  for (let x = hx - 2; x <= ix && n < 256; x += 2, n++) {
    const near = Math.min(1, (ix - x) / 58 + 0.16), ring = ((x + t * 3) % 40 + 40) % 40;
    BMY[n] = YB(x); BMH[n] = (4.4 + Math.sin(x * 0.2 + t * 0.7) * 0.6 + (ring < 4 ? 1.8 : 0)) * near * fat;
  }
  for (const [d, c] of BANDS) {
    ctx.fillStyle = c;
    for (let i = 0; i < n; i++) { const hh = BMH[i] + d; if (hh <= 0) continue; const a = Math.round(BMY[i] - hh), b = Math.min(Math.round(BMY[i] + hh), dk); if (b >= a) ctx.fillRect(hx - 2 + i * 2, a, 2, b - a + 1); }
  }
  for (let i = 0; i < 22; i++) {                  // ionised motes drifting off it
    const x = hx + 14 + hsh(i * 3.9) * Math.max(1, run - 40), ph = ((t * 0.6 + hsh(i * 7.7) * 40) % 40) / 40, up = i % 2 ? -1 : 1;
    ctx.fillStyle = rgba(i % 3 ? BEAML : WHITE, 0.9 * (1 - ph)); ctx.fillRect(Math.round(x + ph * 4), Math.round(YB(x) + up * (8 + ph * 9) * fat), 1, 1);
  }
  disc(ix, iy, 4, WHITE);
  ctx.fillStyle = WHITE; ctx.fillRect(ix - 8, iy, 17, 1); ctx.fillRect(ix, iy - 8, 1, 17);
}

const CHEV = [[0, 2], [1, 1], [1, 3], [2, 0], [2, 4]];
function chevron(x, y, c, s = 1) {
  ctx.fillStyle = OUT; for (const [i, j] of CHEV) ctx.fillRect(x + i * s - 1, y + j * s - 1, s + 2, s + 2);
  ctx.fillStyle = c; for (const [i, j] of CHEV) ctx.fillRect(x + i * s, y + j * s, s, s);
}
// (the landing rings are baked: ringSprite)
// a '!' (the cast's M5.bang look); big = the fat one of a locked target
function bang(x, y, on, big) {
  if (!on) return;
  x = Math.round(x); y = Math.round(y);
  const s = big ? 2 : 1;
  ctx.fillStyle = OUT; ctx.fillRect(x - 2 * s, y - 10 * s, 5 * s, 8 * s); ctx.fillRect(x - 2 * s, y - s, 5 * s, 4 * s);
  ctx.fillStyle = RED; ctx.fillRect(x - s, y - 9 * s, 3 * s, 6 * s); ctx.fillRect(x - s, y, 3 * s, 2 * s);
  ctx.fillStyle = REDL; ctx.fillRect(x - s, y - 9 * s, s, 5 * s);
}

// marks on the deck, behind everything else (world coordinates): the aim lines of the tells, the beam's glowing
// track, the landing rings
function drawMarks(e) {
  const t = e.t, dk = e.deck, ox = offX(e), wall = e.ax + 2;
  const aim = e.aim;
  if (aim && aim.kind === 'beam') {
    // a dotted green line along the deck from the skirt's foot to the wall, arrows running along it
    const x0 = ox + RIM - 2, n = Math.floor(aim.k * 40);
    for (let x = x0, i = 0; x > wall && i < n - 10; x -= 9, i++) {
      const on = (i + Math.floor(t / 4)) % 4 === 0;
      ctx.fillStyle = OUT; ctx.fillRect(x - 3, dk - 3, 6, 3); ctx.fillStyle = on ? BEAML : BEAM; ctx.fillRect(x - 2, dk - 2, 4, 1);
    }
    for (let x = x0 - 30 - (Math.floor(t / 3) % 30), i = 0; x > wall + 4 && i < 9; x -= 30, i++) if (x0 - x < (n - 10) * 9) chevron(x, dk - 11, BEAML);
  }
  if (aim && aim.kind === 'sweep') {
    const x0 = ox + RIM - 8;
    for (let x = x0 - 12 - (Math.floor(t / 3) % 24), i = 0; x > wall + 4 && i < 12; x -= 24, i++) chevron(x, dk - 9, i % 2 ? WHITE : METL);
    for (let x = x0; x > wall; x -= 8) { ctx.fillStyle = OUT; ctx.fillRect(x - 2, dk - 3, 5, 3); ctx.fillStyle = (Math.floor(x / 8) + Math.floor(t / 5)) % 3 ? MET : WHITE; ctx.fillRect(x - 1, dk - 2, 3, 1); }
  }
  if (aim && aim.kind === 'dash') {
    const x0 = ox + RIM - 6, x1 = e.stopX - SKRX;
    for (let x = x0 - (Math.floor(t / 2) % 22), i = 0; x > x1 + 6 && i < 14; x -= 22, i++) chevron(x, dk - 15, i % 2 ? AMBL : AMB, 2);
    // where it will stop: a striped bumper line
    for (let j = 0; j < 30; j += 3) { ctx.fillStyle = OUT; ctx.fillRect(x1 - 2, dk - 2 - j - 2, 5, 3); ctx.fillStyle = (j / 3 + Math.floor(t / 6)) % 2 ? AMB : RED; ctx.fillRect(x1 - 1, dk - 2 - j - 1, 3, 1); }
  }
  // the beam's track: it glows where the hot spot has been
  const bm = e.beam;
  if (bm) {
    const a = Math.min(bm.x, bm.x0), b = Math.max(bm.x, bm.x0), len = Math.max(1, b - a);
    // (one colour at a time: bands by the distance from the hot spot, fading out in dashes)
    const x0 = Math.ceil(a / 3) * 3, strip = (row, k0, k1, c) => {
      ctx.fillStyle = c;
      for (let x = x0; x < b; x += 3) { const k = Math.abs(x - bm.x) / 150; if (k >= k0 && k < k1 && !(k > 0.45 && hsh(x * 3.7) > 0.8 - (1 - k) * 0.2)) ctx.fillRect(x, dk + row, 3, 1); }
    };
    strip(0, 0, 0.1, WHITE); strip(0, 0.1, 0.3, BEAML); strip(0, 0.3, 0.55, BEAM); strip(0, 0.55, 0.8, GR[3]); strip(0, 0.8, 1, GR[2]);
    strip(1, 0, 0.16, BEAML); strip(1, 0.16, 0.4, BEAM); strip(1, 0.4, 0.65, GR[3]); strip(1, 0.65, 1, GR[1]);
    for (let i = 0; i < 7; i++) {               // wisps of steam rising off the track
      const x0 = bm.x + (bm.dir < 0 ? 1 : -1) * (20 + i * 19);
      if (x0 < a || x0 > b) continue;
      const ph = ((t * 0.9 + hsh(i * 3.3) * 50) % 50) / 50;
      ctx.fillStyle = rgba('#d8ffc0', 0.5 * (1 - ph)); ctx.fillRect(Math.round(x0 + Math.sin(ph * 5 + i) * 2), Math.round(dk - 2 - ph * 13), ph > 0.5 ? 2 : 1, 2);
    }
  }
  // landing rings (TRACTOR DROP): red = a crate, amber = a cow pod (harmless)
  for (const r of e.rings) {
    const pod = r.kind === 'pod', fast = r.lock, on = Math.floor(t / (fast ? 3 : 7)) % 2 === 0;
    const s = A.ring[pod ? 'pod' : 'crate'][on ? 1 : 0];
    ctx.drawImage(s.img, Math.round(r.x) + s.x0, r.y + s.y0);
    glow(Math.round(r.x), r.y + 1, 20, pod ? AMB : RED, on ? 0.5 : 0.25);
    if (fast && r.top != null) for (let y = r.top; y < r.y - 12; y += 5) { ctx.fillStyle = OUT; ctx.fillRect(Math.round(r.x) - 1, y - 1, 3, 4); ctx.fillStyle = pod ? AMBL : '#ff6a5a'; ctx.fillRect(Math.round(r.x), y, 1, 2); }
  }
}

function drawBoss(e) {
  art();
  const t = e.t, ox = offX(e), oy = offY(e), by = Math.round(e.by), dk = e.deck - oy, flash = e.hitT > 0;
  drawMarks(e);
  ctx.save(); ctx.translate(ox, oy);
  const squash = e.sx !== 1 || e.sy !== 1;
  // the arms are cables: they are not squashed or spun with the body
  const shR = [BX + (SHO[1][0] - BX) * e.sx, BY + (SHO[1][1] + by - BY) * e.sy], shL = [BX + (SHO[0][0] - BX) * e.sx, BY + (SHO[0][1] + by - BY) * e.sy];
  drawArm(e.R, shR[0], shR[1]);                   // the far arm, behind the body
  if (squash) { ctx.save(); ctx.translate(BX, BY); ctx.scale(e.sx, e.sy); ctx.translate(-BX, -BY); }
  drawThrusters(e, t, dk);
  part(A.skirt, 0, 0);
  // the skirt's rim lamps: chasing amber; all flashing before a dash or when the roly eyes come out
  for (let k = -6; k <= 6; k++) {
    const x = B.cx + k * 14, y = Math.round(topEdge(x)) + 1;
    const on = e.skirt === 2 ? Math.floor(t / 3) % 2 === 0 : e.skirt === 0 ? false : (Math.floor(t / 5) + k + 60) % 4 === 0;
    ctx.fillStyle = on ? (e.skirt === 2 ? '#ff8a80' : AMBL) : e.skirt === 2 ? '#a3151a' : AM0; ctx.fillRect(x - 1, y, 3, 2);
    if (on) { ctx.fillStyle = WHITE; ctx.fillRect(x - 1, y, 1, 1); }
  }
  if (e.skirt === 2 && Math.floor(t / 3) % 2 === 0) { glow(B.cx - 60, SKY + 8, 18, RED, 0.35); glow(B.cx + 60, SKY + 8, 18, RED, 0.35); }
  ctx.translate(0, by);
  // antennae (behind the dome's top edge they would hide: drawn first, the dome covers their sockets)
  if (e.sy > 0.6) for (let i = 0; i < 3; i++) {
    const w = Math.sin(t / 11 + i * 2.1) * 1.2 + e.wob * Math.sin(t * 0.8 + i * 1.7) * 5, dr = e.droop;
    drawAntenna(i, Math.round(w + dr * [-13, 9, 15][i]), Math.round(dr * [17, 22, 18][i] + Math.abs(w) * 0.3), e.lamp[i], t);
  }
  part(e.ph2 ? A.body2 : A.body, 0, 0);
  if (e.hitT >= 3) { ctx.globalAlpha = 0.22; ctx.drawImage((e.ph2 ? A.body2 : A.body).white, A.body.x0, A.body.y0); ctx.globalAlpha = 1; }
  // collar lamps
  COLLAR_LAMPS.forEach(([x, y], i) => { if ((Math.floor(t / 5) + i) % 3 === 0 && e.skirt) { ctx.fillStyle = AMBL; ctx.fillRect(x, y, 2, 2); } });
  // the furnace flickering behind the grille; another mouth for ouch / dizzy
  if (e.mouth) part(A.mouth[e.mouth], 0, 0);
  glow(MX, mT(MX) + 6, 16, '#ffb040', (e.ph2 ? 0.3 : 0.18) + 0.06 * Math.sin(t / 4));
  if (e.capOn) { const s = A.cap; ctx.drawImage(s.img, s.x0, s.y0 - Math.round(e.capBob)); }
  if (e.anger > 0) drawAnger(t);
  // the eye: iris, lids, brow
  const ix = EX + Math.round(e.lx), iy = EY + Math.round(e.ly);
  if (flash) { disc(EX, EY, LR - 1, '#ffd6d1'); }
  const ir = e.iris === 'spin' ? A.iris.spin[Math.floor(t / 4) % 4] : A.iris[e.iris];
  ctx.drawImage(ir.img, ix - 15, iy - 15);
  if (e.iris === 'warn' && Math.floor(t / 4) % 2) { ctx.fillStyle = WHITE; ctx.fillRect(ix - 1, iy - 1, 3, 3); }
  drawLids(e, false);
  if (e.iris === 'hot') { glow(ix, iy, 24, BEAM, 0.4); glow(ix, iy, 9, WHITE, 0.6); }
  else if (e.iris === 'warn') glow(ix, iy, 16, WARN, 0.35);
  { const s = A.brow[e.brow]; ctx.drawImage(s.img, s.x0, s.y0 + Math.round(e.browDy)); }
  if (e.state === 'dizzy' || (e.dying && e.sy > 0.6 && e.st > 20)) drawStars(t, 70);
  ctx.translate(0, -by);
  if (squash) ctx.restore();
  // a flattened wreck: the antennae stick up out of it like springs
  if (e.sy <= 0.6) for (let i = 0; i < 3; i++) {
    const bx = BX + (ANT[i].bx - BX) * e.sx, top = BY - (BY - 74) * e.sy, h = 16 + i * 3, w = Math.round(Math.sin(t / 5 + i * 2) * (2 + e.wob * 5));
    ctx.fillStyle = OUT; for (let k = 0; k <= h; k++) ctx.fillRect(Math.round(bx + w * k / h + Math.sin(k * 1.6) * 2) - 1, Math.round(top - k), 4, 1);
    for (let k = 0; k <= h; k++) { const x = Math.round(bx + w * k / h + Math.sin(k * 1.6) * 2); ctx.fillStyle = METD; ctx.fillRect(x, Math.round(top - k), 1, 1); ctx.fillStyle = METL; ctx.fillRect(x + 1, Math.round(top - k), 1, 1); }
    const s = A.lamp[e.lamp[i]]; ctx.drawImage(s.img, Math.round(bx + w) + 1 + s.x0, Math.round(top - h) - 3 + s.y0);
  }
  // the beam goes behind the near arm; before it fires, a dotted line from the eye down to the skirt's foot
  if (e.beam) drawBeam(e, t, e.beam.x - ox, dk);
  else if (e.aim && e.aim.kind === 'beam') {
    const n = Math.floor(e.aim.k * 40), ax = EX + e.lx, ay = EY + e.ly + by;
    for (let i = 2; i <= 12 && i < n; i++) { const k = i / 12, x = Math.round(lerp(ax, RIM - 2, k)), y = Math.round(lerp(ay, dk - 2, k)); ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 1, 4, 4); ctx.fillStyle = (i + Math.floor(t / 4)) % 3 ? BEAM : BEAML; ctx.fillRect(x, y, 2, 2); }
  }
  // roly eyes being tossed out from under the skirt (not robots yet: they can't touch anyone in the air)
  for (const q of e.toss) { const k = q.t / TOSS; M5.roller(lerp(q.x0, q.x1, k) - ox, dk - Math.sin(k * Math.PI) * 30, -1, { rot: -q.t * 0.4, look: [-1, 0], t }); }
  // what the claws carry, in their tractor cones
  for (const c of e.cargo) {
    if (!c.held) continue;
    const m = e[c.arm], x = Math.round(m.x), y0 = Math.round(m.y) + 12;
    if (c.kind === 'pod') { drawCone(x, y0, Math.round(m.y) + 72, t); ctx.save(); ctx.translate(x, Math.round(m.y) + 70); M5.pod(0, 0, { id: 2, t, facing: -1 }); ctx.restore(); }
    else { drawCone(x, y0, Math.round(m.y) + 56, t); part(A.crate, x, Math.round(m.y) + 44 + Math.round(Math.sin(t / 9) * 1.5)); }
  }
  drawArm(e.L, shL[0], shL[1]);                   // the near arm, in front
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------
// In front of the hero (drawn by the mofx layer): the beam's splash, the '!' marks, comic words, cues, the cows
// ---------------------------------------------------------------------------------------------------------------------
function drawSplash(x, dk, t) {
  glow(x, dk - 2, 30, BEAM, 0.75); glow(x, dk - 2, 15, WHITE, 0.9);
  ctx.fillStyle = BEAM; ctx.fillRect(x - 13, dk - 1, 27, 2); ctx.fillRect(x - 9, dk - 3, 19, 2);
  ctx.fillStyle = BEAML; ctx.fillRect(x - 10, dk - 1, 21, 2); ctx.fillRect(x - 6, dk - 4, 13, 3);
  ctx.fillStyle = WHITE; ctx.fillRect(x - 7, dk - 1, 15, 2); ctx.fillRect(x - 4, dk - 5, 9, 4);
  for (let i = 0; i < 9; i++) {
    const a = (-168 + i * 19.5) * DEG, r0 = 7, r1 = 12 + hsh(i * 2.9 + Math.floor(t / 4)) * 9;
    for (let r = r0; r < r1; r++) { ctx.fillStyle = r < r0 + 4 ? WHITE : BEAML; ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(dk - 3 + Math.sin(a) * r * 0.9), 1, 1); }
  }
  for (let i = 0; i < 16; i++) {
    const ph = ((t * 1.3 + hsh(i * 5.1) * 30) % 30) / 30, vx = (hsh(i * 2.3) - 0.5) * 2.6, vy = -1.6 - hsh(i * 4.7) * 2, f = ph * 26;
    const sx = x + vx * f, sy = dk - 3 + vy * f + 0.11 * f * f;
    if (sy > dk - 1) continue;
    ctx.fillStyle = i % 3 ? BEAML : WHITE; ctx.fillRect(Math.round(sx), Math.round(sy), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
  }
}
function drawWord(w, t) {
  const k = 1 - w.t / w.max, rise = Math.round(k * (w.rise || 0)), j = w.shake ? Math.round((hsh(Math.floor(t / 3) * 0.7 + w.x) - 0.5) * 2) : 0;
  if (w.t < 8 && Math.floor(w.t / 2) % 2) return;
  const sc = w.sc || 2, n = w.s.length, x0 = Math.round(w.x - (w.center ? n * 6 * sc / 2 : 0));
  for (let i = 0; i < n; i++) {
    if (w.s[i] === ' ') continue;
    const s = letter(w.s[i], w.top, w.bot, sc);
    ctx.drawImage(s.img, x0 + i * 6 * sc + j + s.x0, Math.round(w.y) - Math.round(i * (w.step || 0)) - rise + j + s.y0);
  }
}
function drawCue(s, c) {
  const p = G.p;
  if (!p || p.dead || p.hidden) return;
  const y = p.y - 50 - (Math.floor(G.t / 6) % 2);
  text(s, p.x, y, c, 1, 'center');
}
function drawFront(e) {
  const t = e.t, dk = e.deck, ox = offX(e), oy = offY(e), p = G.p;
  if (e.beam) drawSplash(Math.round(e.beam.x), dk, t);
  for (const b of e.bangs) bang(b.x, b.y, Math.floor(t / (b.fast ? 3 : 5)) % 2 === 0, b.big);
  // a red ! over each crate's ring: over the hero's head while he stands in it
  for (const r of e.rings) if (r.kind !== 'pod') bang(r.x, p && !p.dead && Math.abs(p.x - r.x) < 15 && p.y > r.y - 60 ? Math.min(r.y, p.y) - 46 : r.y - 7, Math.floor(t / (r.lock ? 3 : 5)) % 2 === 0, false);
  // cues for the kids: JUMP! as the hot spot or the claw comes close, RUN! in the path of the dash
  if (p && !p.dead && e.cue) drawCue(e.cue, e.cue === 'RUN!' ? AMBL : WHITE);
  // the stampede of the defeat: cows galloping over the wreck, the cap coming down on the calf
  for (const c of e.cows) {
    const y = Math.round(c.y) - ((c.run + (c.i * 3) >> 2) & 1);
    M5.cow(c.x, y, c.dir, { v: c.v, run: c.stop ? undefined : c.run, float: c.air });
    if (c.cap) { const s = A.cap; ctx.save(); ctx.translate(Math.round(c.x) + c.dir * 7, y - 16); ctx.scale(0.5, 0.5); ctx.drawImage(s.img, -(CAPX - s.x0) + 6, -(CAPY - s.y0) + 2); ctx.restore(); }
    if (c.moo > 0) M5.bubble(c.x + c.dir * 4, y - 30, 'MOO!');
  }
  const cp = e.cap;
  if (cp) { const s = A.cap, k = cp.script ? 0.5 : 1; ctx.save(); ctx.translate(Math.round(cp.x), Math.round(cp.y)); ctx.rotate(cp.rot); ctx.scale(k, k); ctx.drawImage(s.img, -(CAPX - s.x0), -(CAPY - s.y0) + 4); ctx.restore(); }
  for (const w of e.words) drawWord(w, t);
}
// =====================================================================================================================
// Sounds
// =====================================================================================================================
const sfx = {
  bip(i) { Snd.tone('square', 520 + i * 180, 520 + i * 180, 0.09, 0.09); if (i === 2) Snd.tone('square', 1040, 1040, 0.16, 0.08, 0.02); },
  charge() { Snd.tone('sawtooth', 90, 420, 1.1, 0.05); },
  zap() { Snd.noise(0.5, 0.3, 5000); Snd.tone('sawtooth', 1400, 180, 0.45, 0.12); Snd.tone('square', 220, 110, 0.5, 0.08); },
  hum() { Snd.tone('sawtooth', 150, 140, 0.4, 0.05); Snd.noise(0.3, 0.05, 3000); },
  whirr() { Snd.tone('square', 180, 520, 0.5, 0.03); Snd.tone('sine', 90, 260, 0.5, 0.06); },
  clunk() { Snd.tone('square', 230, 80, 0.12, 0.2); Snd.noise(0.2, 0.2, 1200); },
  slam() { Snd.tone('square', 300, 60, 0.18, 0.25); Snd.noise(0.3, 0.35, 1600); Snd.tone('square', 1500, 600, 0.08, 0.08, 0.02); },
  eye() { Snd.tone('square', 320, 140, 0.05, 0.08); Snd.tone('triangle', 1200, 700, 0.05, 0.04); },
  clack() { Snd.tone('square', 900, 300, 0.05, 0.14); Snd.noise(0.05, 0.2, 5000); },
  scrape() { Snd.noise(0.25, 0.1, 2400); },
  drop() { Snd.tone('sine', 700, 180, 0.4, 0.1); },
  glass() { [2100, 1700, 2500].forEach((f, i) => Snd.tone('triangle', f, f * 0.6, 0.1, 0.07, i * 0.04)); Snd.noise(0.25, 0.15, 6000); },
  moo(d = 0) { Snd.tone('sawtooth', 185, 139, 0.5, 0.1, d); Snd.tone('sawtooth', 139, 110, 0.35, 0.08, d + 0.3); },
  pop() { Snd.tone('sine', 300, 900, 0.07, 0.2); Snd.noise(0.08, 0.2, 3000); },
  rev() { Snd.tone('sawtooth', 70, 260, 1.0, 0.1); Snd.noise(1.0, 0.12, 500); },
  whoosh() { Snd.noise(0.6, 0.3, 2600); Snd.tone('sawtooth', 300, 90, 0.6, 0.08); },
  bonk() { Snd.tone('sine', 220, 60, 0.3, 0.4); Snd.tone('square', 660, 330, 0.12, 0.12); Snd.noise(0.3, 0.3, 900); },
  thud() { Snd.tone('sine', 110, 40, 0.3, 0.35); Snd.noise(0.25, 0.25, 500); },
  steam() { Snd.noise(0.7, 0.14, 7000); Snd.tone('sine', 1500, 2200, 0.5, 0.03); },
  grr() { Snd.noise(0.7, 0.25, 500); Snd.tone('sawtooth', 130, 70, 0.7, 0.14); },
  bzzt() { for (let i = 0; i < 5; i++) Snd.tone('sawtooth', 900 - i * 120, 200, 0.07, 0.1, i * 0.07); Snd.noise(0.5, 0.2, 4000); },
  spin() { Snd.tone('triangle', 300, 1200, 1.2, 0.06); },
  squish() { Snd.tone('sine', 400, 80, 0.16, 0.25); Snd.noise(0.12, 0.2, 900); },
  voice() { Snd.tone('sawtooth', 180, 90, 0.5, 0.12); Snd.tone('square', 90, 60, 0.6, 0.08, 0.05); Snd.noise(0.5, 0.15, 700); }
};

// =====================================================================================================================
// Behaviour
// =====================================================================================================================
const word = (e, s, x, y, top, bot, o) => e.words.push(Object.assign({ s, x, y, top, bot, t: 46, max: 46, sc: 2, rise: 8, shake: true }, o));
const go = (e, s) => { e.state = s; e.st = 0; };
const pupsAlive = e => e.pups.filter(m => !m.dead && !m.dying && m.state !== 'dying').length;
const mkArm = (x, y, a, ux, uy) => ({ x, y, a, open: 0.6, tx: x, ty: y, ta: a, to: 0.6, k: 0.14, ux, uy, ea: 0, glow: 0, gc: null });

// every frame: the resting pose and face. The state's step then changes what it needs.
function defaults(e) {
  const t = e.t, p = G.p, ph2 = e.ph2, L = e.L, R = e.R;
  e.tlu = -13; e.tll = ph2 ? 23 : 21; e.lidV = 4; e.browT = ph2 ? 0 : 1; e.browDyT = e.eyeT > 0 ? -3 : 0; e.iris = e.eyeT > 3 ? 'tiny' : 'norm'; e.mouth = e.eyeT > 0 ? 'o' : 0;
  e.sinkT = 0; e.thrT = 1; e.oyT = Math.sin(t / 26) * 2; e.byT = Math.sin(t / 26 + 1.3) * 1.3; e.skirt = 1; e.droopT = 0;
  e.x2 = false; e.aim = null; e.cue = null; e.bangs.length = 0; e.rings.length = 0; e.anger = ph2 ? 1 : 0;
  for (let i = 0; i < 3; i++) e.lamp[i] = ph2 ? ((Math.floor(t / 9) + i) % 3 ? 'redoff' : 'red') : ((Math.floor(t / 16) + i) % 6 ? 'amb' : 'hot');
  // the eye follows the hero
  if (p) { const dx = p.x - (offX(e) + EX), dy = p.y - 18 - (offY(e) + EY), d = Math.hypot(dx, dy) || 1; e.tlx = dx / d * 9; e.tly = dy / d * 8; }
  // it got him: a smug moment (the brow lifts, HEH HEH)
  if (p) {
    if ((p.hearts < e.seenH || (p.dead && e.seenH > 0)) && !e.inv && e.state !== 'dizzy') { e.gloat = 56; word(e, 'HEH HEH!', offX(e) + EX - 96, offY(e) + EY + 44, WHITE, BEAML, { sc: 1, t: 50, max: 50, rise: 5 }); }
    e.seenH = p.dead ? 0 : p.hearts;
  }
  if (e.gloat > 0) { e.gloat--; e.browT = 2; e.browDyT = -2 + Math.round(Math.sin(e.gloat * 0.8)); e.byT += Math.sin(e.gloat * 0.8) * 1.5; }
  // the near claw sways half open; the far claw is up and snaps now and then (clack-clack)
  const q = t % 76;
  L.tx = 250 + Math.sin(t / 23) * 4; L.ty = 162 + Math.sin(t / 17) * 3; L.ta = 2.0; L.to = 0.6 + Math.sin(t / 31) * 0.15; L.k = 0.14; L.ea = 0; L.glow = 0;
  R.tx = 466 + Math.sin(t / 29) * 2; R.ty = 72 + Math.sin(t / 19) * 3; R.ta = -1.95; R.to = q < 5 || (q > 10 && q < 15) ? 0.3 : 0.9; R.k = 0.14; R.ea = 0; R.glow = 0;
}
// ease everything toward its target
function animate(e) {
  e.lu += clamp(e.tlu - e.lu, -e.lidV, e.lidV); e.ll += clamp(e.tll - e.ll, -e.lidV, e.lidV);
  e.lx += (e.tlx - e.lx) * 0.25; e.ly += (e.tly - e.ly) * 0.25;
  e.brow = e.browT; e.browDy += (e.browDyT - e.browDy) * 0.4;
  e.sink += (e.sinkT - e.sink) * 0.15; e.oy += (e.oyT - e.oy) * 0.2; e.by += (e.byT - e.by) * 0.3;
  e.thr += (e.thrT - e.thr) * 0.2; e.droop += (e.droopT - e.droop) * 0.12;
  for (const m of [e.L, e.R]) { m.x += (m.tx - m.x) * m.k; m.y += (m.ty - m.y) * m.k; m.a += (m.ta - m.a) * 0.22; m.open += (m.to - m.open) * 0.5; }
  e.wob = e.wob > 0.02 ? e.wob * 0.94 : 0;
  e.capBob *= 0.75;
  if (e.eyeT > 0) e.eyeT--;
  for (const w of e.words) w.t--;
  if (e.words.length) e.words = e.words.filter(w => w.t > 0);
  const cp = e.cap;
  if (cp && !cp.script) { cp.x += cp.vx; cp.y += cp.vy; cp.vy += 0.1; cp.rot += cp.vr; if (cp.y < -80 || cp.y > H + 40) e.cap = null; }
}

function toIdle(e, rest) {
  if (!e.ph2 && e.hp <= e.max / 2) { go(e, 'phase2'); e.inv = true; return; }
  const p = G.p;
  go(e, 'idle');
  // a breather between attacks (time for a child to read the next tell): longer after the hero got hit, while he
  // is on his last heart and while its roly eyes are about
  e.rest = rest != null ? rest : (e.ph2 ? REST2 : REST1) + (p && (p.inv > 0 || p.dead) ? 40 : 0) + (p && p.hearts <= 1 ? 30 : 0) + (pupsAlive(e) ? 30 : 0);
}
function stepIdle(e) {
  if (!e.ph2 && e.hp <= e.max / 2) { go(e, 'phase2'); e.inv = true; return; }
  if (e.shutDmg >= SHUT_AT && e.t - e.openT >= SHUT_GAP && e.st >= 16) { startShut(e); return; }
  if (e.st < e.rest) return;
  const seq = e.ph2 ? ['dash', 'beam', 'drop', 'beam', 'dash', 'drop'] : ['beam', 'drop'], a = seq[e.atk++ % seq.length];
  go(e, a);
  if (a === 'drop') startDrop(e); else if (a === 'dash') startDash(e);
}

// ENTRANCE: it comes down from above on its thrusters, lands with a bump, straightens its cap, its lamps come on one
// by one, the eye opens, looks about and finds the hero
function stepIntro(e) {
  const st = e.st, L = e.L, R = e.R, ox = offX(e);
  e.thrT = st < 96 ? 2 : 1;
  for (let i = 0; i < 3; i++) e.lamp[i] = st >= 100 + i * 12 ? 'amb' : 'off';
  if (st < 84) { const k = st / 84; e.oy = e.oyT = -215 * (1 - k) * (1 - k); }
  if (st === 1) sfx.rev();
  if (st === 84) { e.sink = 6; e.wob = 1; G.shake = Math.max(G.shake, 5); sfx.thud(); dust(ox + RIM + 4, e.deck, 8, -1); dust(ox + B.cx + SKRX - 4, e.deck, 8, 1); }
  L.tx = 262; L.ty = 152; L.ta = 1.9; L.to = 0.3;
  R.tx = 458; R.ty = 110; R.ta = -1.2; R.to = 0.3;
  if (st >= 90 && st < 130) { R.tx = CAPX + 36; R.ty = CAPY - 18; R.ta = 2.6; R.to = st >= 106 && st < 114 ? 0.3 : 0.9; R.k = 0.25; if (st === 110) { e.capBob = 4; sfx.clack(); } }
  if (st === 100 || st === 112 || st === 124) sfx.bip((st - 100) / 12);
  if (st < 134) { e.tlu = e.tll = e.lu = e.ll = LID_SHUT; e.browT = 0; e.browDyT = 3; }
  else if (st < 152) { e.tlu = -22; e.tll = 23; e.browT = 3; e.tlx = Math.sin((st - 134) / 3.5) * 8; e.tly = 2; }
  if (st === 152) { sfx.voice(); e.browDy = 6; G.shake = Math.max(G.shake, 3); word(e, 'HALT!', ox + 218, offY(e) + 108, WHITE, AMBL, { step: 2 }); say('Mega Oggle!', 0.5, 0.9); }
  if (st >= INTRO_LEN) { e.inv = false; e.openT = e.t; toIdle(e, 50); }
}

// EYE BEAM. Tell (BEAM_TELL): it sinks a little, the antenna lamps go dark and light one, two, three (bip, bip, BIP),
// the iris turns yellow, a dotted line shows where the beam will hit the deck and which way it will go, a red !.
// Then ZAAAP: the hot spot burns in at the foot of the skirt and sweeps to the left wall (phase 2: and back).
function stepBeam(e) {
  const st = e.st, p = G.p, ox = offX(e), start = ox + RIM - 2;
  e.sinkT = 4; e.browT = 0;
  // the near claw gets out of the beam's way: up, pointing at the hero
  e.L.tx = 262; e.L.ty = 110; e.L.ta = -2.5; e.L.to = st < BEAM_TELL && st % 24 < 5 ? 0.3 : 0.75;
  if (st < BEAM_TELL) {
    for (let i = 0; i < 3; i++) e.lamp[i] = st >= 8 + i * 20 ? 'hot' : 'off';
    if (st === 1) sfx.charge();
    if (st === 8 || st === 28 || st === 48) sfx.bip((st - 8) / 20);
    if (st >= 20) e.iris = 'warn';
    if (st >= 50) { e.tlu = -22; e.tll = 23; }
    e.tlx = -7; e.tly = 7;
    e.aim = { kind: 'beam', k: st / BEAM_TELL };
    if (st >= 10) e.bangs.push({ x: ox + EX - 52, y: offY(e) + EY - 30, fast: st > 48 });
    if (st >= 30) e.bangs.push({ x: start, y: e.deck - 22, fast: st > 48 });
    return;
  }
  for (let i = 0; i < 3; i++) e.lamp[i] = 'hot';
  if (st === BEAM_TELL) {
    e.beam = { x: start, x0: start, dir: -1, t: 0, back: false };
    sfx.zap(); G.sflash = Math.max(G.sflash, 0.18); G.shake = Math.max(G.shake, 4);
    word(e, 'ZAAAP!', ox + 196, e.deck - 20, BEAML, BEAM, { step: 2.6, t: 70, max: 70, rise: 0 });
  }
  const bm = e.beam;
  if (!bm) { e.sinkT = 0; if (st >= e.beamEnd + BEAM_COOL) toIdle(e); return; }
  bm.t++;
  e.tlu = -22; e.tll = 23; e.iris = 'hot'; e.x2 = true;
  if (bm.t > 6) bm.x += bm.dir * (e.ph2 ? BEAM_V2 : BEAM_V);       // it burns in at the skirt's foot for a moment first
  const dx = bm.x - (ox + EX), dy = e.deck - (offY(e) + EY), d = Math.hypot(dx, dy) || 1;
  e.tlx = dx / d * 9; e.tly = dy / d * 8;
  // (the first frames it only burns in: a hero who jumps at the ZAAAP is still in time)
  if (bm.t > 6 && p && !p.dead && overlap({ x: bm.x - 8, y: e.deck - 13, w: 16, h: 14 }, pbox(p))) hurtPlayer();
  if (p && p.onGround && (bm.x - p.x) * -bm.dir > 0 && Math.abs(bm.x - p.x) < 56) e.cue = 'JUMP!';
  if (bm.t % 2 === 0) G.parts.push({ type: 'spark', x: bm.x + rand(-6, 6), y: e.deck - 2, vx: rand(-1.6, 1.6), vy: rand(-3, -1), g: 0.16, life: rand(10, 20), max: 20, size: 1, c: bm.t % 4 ? BEAML : WHITE });
  if (bm.t % 24 === 12) sfx.hum();
  G.shake = Math.max(G.shake, 1);
  let end = false;
  if (bm.dir < 0 && bm.x <= e.ax + 2) { if (e.ph2 && !bm.back) { bm.back = true; bm.dir = 1; } else end = true; }
  else if (bm.dir > 0 && bm.x >= bm.x0) end = true;
  if (end) { e.beam = null; e.beamEnd = st; for (let i = 0; i < 5; i++) G.parts.push({ type: 'smoke', x: ox + EX + rand(-8, 8), y: offY(e) + EY + rand(-6, 6), vx: rand(-0.6, 0.2), vy: rand(-1, -0.4), life: 40, max: 40, size: 3 }); }
}

// TRACTOR DROP. The near claw goes up into the ceiling and comes back with a cargo crate (now and then, by mistake,
// with a cow pod). A ring on the deck follows the hero (DROP_FOLLOW), locks and blinks fast (DROP_LOCK), then the claw
// lets go. Phase 2: the far claw brings a second crate, PAIR px to one side.
function startDrop(e) {
  const p = G.p;
  e.drops++;
  // every second fetch is a cow pod; and whenever the hero is on his last heart, or on his last life and hurt
  // (the captain gets nervous and grabs the wrong thing)
  const mercy = !p.dead && (p.hearts <= 1 || (G.lives <= 1 && p.hearts <= 2));
  e.cargo = [{ kind: e.drops % 2 === 0 || mercy ? 'pod' : 'crate', arm: 'L', x: p.x, sy: e.deck, pl: null, held: false, b: null }];
  if (e.ph2) e.cargo.push({ kind: 'crate', arm: 'R', x: p.x, sy: e.deck, pl: null, held: false, b: null });
  e.pairSide = p.x - e.ax < 135 ? 1 : -1;
}
function release(e, c, oy) {
  const x = c.x, land = c.sy;
  c.held = false;
  if (c.kind === 'crate') c.b = { k: 'mocrate', x, y: oy + CARRY_Y + 44, vx: 0, vy: 0.8, g: 0.3, life: 400, land, t: 0, landed: false };
  else {
    const p = G.p, item = p && p.hearts < 3 ? 'heart' : e.gifts++ % 2 ? 'B' : 'H';
    c.b = { k: 'mopod', x, y: oy + CARRY_Y + 70, vx: 0, vy: 0.8, g: 0.26, life: 900, land, t: 0, ph: 'fall', landed: false, item };
  }
  G.eb.push(c.b); sfx.drop();
}
function stepDrop(e) {
  const st = e.st, p = G.p, ox = offX(e), oy = offY(e), n = e.cargo.length;
  const F = DROP_FETCH, FO = F + DROP_FOLLOW, LK = FO + DROP_LOCK, lo = e.ax + 14, hi = ox + RIM - 12;
  if (st === 1) sfx.whirr();
  let busy = false;
  e.cargo.forEach((c, i) => {
    const m = e[c.arm], sh = SHO[c.arm === 'L' ? 0 : 1], rel = LK + i * 16;
    if (st < 22 + i * 5) {                        // up into the ceiling hatch
      m.tx = sh[0] + (c.arm === 'L' ? -30 : -64); m.ty = 2; m.ta = -Math.PI / 2; m.to = 1.2; m.k = 0.2; busy = true;
      return;
    }
    if (st < rel) {
      if (!c.held) { c.held = true; sfx.clunk(); }
      let tx = clamp(p ? p.x : c.x, lo, hi);
      if (i > 0) { const a = e.cargo[0].x; tx = clamp(a + e.pairSide * PAIR, lo, hi); if (Math.abs(tx - a) < PAIR - 14) tx = clamp(a - e.pairSide * PAIR, lo, hi); }
      if (st < F) c.x = tx; else if (st < FO) c.x += clamp(tx - c.x, -3.2, 3.2);
      // it lands on what the hero stands on: the deck, or his console
      if (st < FO) { if (p && p.onGround) c.pl = i === 0 ? p.onPlat : e.cargo[0].pl; const pl = c.pl; c.sy = pl && c.x > pl.x - 3 && c.x < pl.x + pl.w + 3 ? pl.y : groundAt(c.x); }
      busy = true;
    } else if (st === rel && c.held) release(e, c, oy);
    if (c.held) { m.tx = c.x - ox; m.ty = CARRY_Y; m.ta = Math.PI / 2; m.to = c.kind === 'pod' ? 1.25 : 1.0; m.k = 0.25; m.ea = 1.25; m.glow = 0.6; }
    else if (st < rel + 14) { m.tx = c.x - ox; m.ty = CARRY_Y - 6; m.ta = Math.PI / 2; m.to = 1.5; m.ea = 1.25; }      // lets go: the claw springs open
    const falling = c.b && c.b.life > 0 && !c.b.landed;
    if (falling) busy = true;
    if ((c.held && st >= F) || falling) e.rings.push({ x: c.x, y: c.sy, kind: c.kind, lock: st >= FO, top: c.held && st >= FO ? oy + CARRY_Y + (c.kind === 'pod' ? 74 : 58) : null });
  });
  // it watches what it is carrying. A cow pod? Oops.
  const c0 = e.cargo[0];
  if (c0 && st > 20 && st < LK) { e.tlx = clamp((c0.x - ox - EX) / 12, -9, 6); e.tly = -7; }
  if (c0 && c0.kind === 'pod' && st > 26 && st < LK + 30) { e.browT = 3; if (st === 34) word(e, '?', ox + B.cx + 26, oy + 62, WHITE, AMBL, { sc: 3, shake: false, t: 60, max: 60 }); }
  if (!busy && st >= LK + (n - 1) * 16 + DROP_AFTER) toIdle(e);
}

// EYELIDS SHUT. The lids slam (CLANK!), shots ping off. Then either the CLAW SWEEP (the near claw goes down to the
// deck, snaps twice, clack-clack, and rakes along the deck to the left wall: jump it) or two roly eyes roll out from
// under the skirt. From PEEK_AT the upper lid lifts a crack and the eye peeks; then it opens.
// Phase 2: the lower lid is jammed, so "shut" leaves the lower half of the eye open.
function startShut(e) {
  const ox = offX(e), oy = offY(e);
  e.shuts++; e.shutDmg = 0;
  e.shutMode = e.shuts % 2 === 0 && ENEMY_TYPES.roller && !pupsAlive(e) ? 'roll' : 'sweep';
  go(e, 'shut');
  if (!e.ph2) e.inv = true;
  e.lu = e.ph2 ? 0 : LID_SHUT; e.ll = e.ph2 ? 23 : LID_SHUT; e.browDy = 8;
  sfx.slam(); G.shake = Math.max(G.shake, 3);
  word(e, e.ph2 ? 'CLUNK!' : 'CLANK!', ox + EX - 86, oy + EY - 52, WHITE, METL, { t: 40, max: 40 });
  sparks(ox + EX - 18, oy + EY + 4, 8, WHITE);
}
// a roly eye pops out from under the skirt and is tossed in an arc onto the deck, never onto the hero: it becomes a
// real robot (with its own warning before it dashes) only where it lands, at least 44 px from him
const TOSS = 26;
function rollOut(e, ox) {
  if (!ENEMY_TYPES.roller) return;
  const p = G.p, x0 = ox + RIM + 4;
  let x1 = x0 - 60;
  while (p && Math.abs(x1 - p.x) < 44 && x1 - 56 > e.ax + 20) x1 -= 56;
  e.toss.push({ x0, x1, t: 0 });
  sfx.pop(); dust(x0 - 6, e.deck, 6, -1);
  for (let i = 0; i < 4; i++) G.parts.push({ type: 'smoke', x: x0 + rand(-6, 6), y: e.deck - rand(2, 10), vx: rand(-0.8, 0), vy: rand(-0.7, -0.2), life: 30, max: 30, size: 3 });
}
function tossStep(e) {
  for (const q of e.toss) {
    if (++q.t < TOSS) continue;
    const w = makeEnemy({ t: 'roller', x: q.x1, y: e.deck }, e.lock);
    if (!w.dead && !e.dying) { w.active = true; w.facing = -1; G.enemies.push(w); e.pups.push(w); dust(q.x1, e.deck, 4); Snd.tone('sine', 200, 90, 0.08, 0.15); }
  }
  e.toss = e.toss.filter(q => q.t < TOSS);
}
function stepShut(e) {
  const st = e.st, ox = offX(e), p = G.p, L = e.L, ph2 = e.ph2, peek = st >= PEEK_AT;
  e.tlu = ph2 ? 0 : peek ? LID_SHUT - 7 : LID_SHUT; e.tll = ph2 ? 23 : LID_SHUT; e.browT = 0; e.browDyT = peek ? 1 : 4; e.lidV = 1.5;
  if (peek) { e.tlx = Math.sin((st - PEEK_AT) / 5) * 8; e.tly = 3; }
  if (e.shutMode === 'sweep') {
    const t0 = SHUT_SLAM, t1 = t0 + SWEEP_TELL, t2 = t1 + SWEEP_DOWN, x0 = RIM - 6;
    if (st >= t0 && st < t1) {
      // the claw hangs over the deck in front of the skirt and snaps twice
      const q = st - t0;
      L.tx = x0 - 4; L.ty = BY - 40; L.ta = 2.4; L.ea = 0; L.k = 0.25; L.to = (q >= 16 && q < 21) || (q >= 32 && q < 37) ? 0.3 : 0.95;
      if (q === 16 || q === 32) { sfx.clack(); sparks(ox + x0 - 22, e.deck - 46, 5, WHITE); word(e, 'CLACK!', ox + x0 - 70, e.deck - 66 - (q === 32 ? 11 : 0), WHITE, METL, { sc: 1, t: 28, max: 28, rise: 4 }); }
      e.aim = { kind: 'sweep' };
      e.bangs.push({ x: ox + x0 - 14, y: e.deck - 66, fast: q > 24 });
    } else if (st >= t1 && st < t2) {
      // it comes down on the deck (the moment to jump)
      L.tx = x0; L.ty = BY - 3; L.ta = Math.PI; L.ea = -0.6; L.k = 0.45; L.to = 0.6;
      e.aim = { kind: 'sweep' };
      if (st === t1) sfx.whoosh();
      if (st === t2 - 1) { sfx.thud(); dust(ox + x0 - 16, e.deck, 6, -1); G.shake = Math.max(G.shake, 2); }
    } else if (st >= t2) {
      const cx = x0 - (st - t2) * SWEEP_V, wx = ox + cx;            // the wrist (design x, world x)
      if (wx > e.ax - 26) {
        L.x = L.tx = cx; L.y = L.ty = BY - 3; L.a = L.ta = Math.PI; L.ea = -0.6; L.to = Math.floor(st / 5) % 2 ? 0.6 : 0.35;
        if (p && !p.dead && overlap({ x: wx - 34, y: e.deck - 20, w: 36, h: 21 }, pbox(p))) hurtPlayer();
        if (p && p.onGround && p.x < wx && wx - p.x < 76) e.cue = 'JUMP!';
        if (st % 3 === 0) G.parts.push({ type: 'spark', x: wx - 20, y: e.deck - 1, vx: rand(0.5, 2), vy: rand(-2, -0.6), g: 0.16, life: 14, max: 14, size: 1, c: st % 2 ? AMBL : WHITE });
        if (st % 12 === 0) sfx.scrape();
      }
    }
  } else {
    const t0 = SHUT_SLAM, t1 = t0 + ROLL_TELL;
    if (st >= t0 && st < t1 + 62) { e.skirt = 2; e.oyT = -5; }
    if (st === t0) sfx.rev();
    if (st >= t0 && st < t1) e.bangs.push({ x: ox + RIM - 2, y: e.deck - 26, fast: st > t0 + 20 });
    if (st === t1 || st === t1 + 50) rollOut(e, ox);
  }
  if (st >= PEEK_AT + PEEK) { e.inv = false; e.openT = e.t; toIdle(e, 70); }
}

// BELOW HALF: ouch! The cap is blown off, steam whistles from the louvres, the lower lid jams, the lamps turn red
function stepPhase2(e) {
  const st = e.st, ox = offX(e), oy = offY(e), L = e.L, R = e.R;
  e.inv = true;
  if (st < 56) { e.tlu = -22; e.tll = 23; e.iris = 'tiny'; e.browT = 3; e.browDyT = -4; e.mouth = 'o'; e.tlx = Math.sin(st * 0.9) * 2; e.tly = 0; }
  else { e.browT = 0; e.anger = 1; L.to = R.to = Math.floor(st / 4) % 2 ? 0.3 : 1.1; L.tx = 246; L.ty = 120; L.ta = 2.6; R.ty = 60; e.oyT = Math.sin(st * 1.3) * 2; }
  if (st === 1) { sfx.bzzt(); e.wob = 1; G.shake = Math.max(G.shake, 6); word(e, 'OUCH!', ox + EX - 96, oy + EY - 58, WHITE, REDL, { t: 50, max: 50 }); }
  if (st < 24 && st % 3 === 0) sparks(ox + B.cx + rand(-60, 60), oy + rand(86, 190), 4, st % 2 ? BEAML : WHITE);
  if (st === 24) {
    e.ph2 = true; e.atk = 0; e.drops = 1; G.sflash = Math.max(G.sflash, 0.2); sfx.pop(); sfx.steam();      // (drops 1: its next fetch is a cow pod)
    if (e.capOn) { e.capOn = false; e.cap = { x: ox + CAPX, y: oy + CAPY, vx: 1.1, vy: -6.4, rot: 0, vr: 0.3 }; }
    word(e, 'POP!', ox + CAPX - 20, oy + CAPY - 26, WHITE, CYANL, { t: 34, max: 34 });
    debris(ox + B.cx + 16, oy + 112, 8, GR[3]); debris(ox + B.cx + 16, oy + 112, 4, MET);
  }
  if (st >= 24 && st < 90 && st % 3 === 0) for (const sg of [-1, 1]) G.parts.push({ type: 'smoke', x: ox + B.cx + sg * 58 + rand(-3, 3), y: oy + 124 + rand(-4, 12), vx: sg * rand(0.8, 1.8), vy: rand(-1.2, -0.5), life: 34, max: 34, size: 3 });
  if (st === 44) { sfx.clunk(); e.ll = 26; sparks(ox + EX - 12, oy + EY + 20, 8, AMBL); word(e, 'CLUNK!', ox + EX - 92, oy + EY + 22, WHITE, METL, { sc: 1, t: 30, max: 30 }); }
  if (st === 60) { sfx.grr(); G.shake = Math.max(G.shake, 4); word(e, 'GRRR!', ox + EX - 110, oy + EY - 60, REDL, RED, { t: 44, max: 44 }); }
  if (st >= PH2_LEN) { e.inv = false; e.openT = e.t; toIdle(e, 60); }
}

// SAUCER DASH (phase 2). Tell (DASH_TELL): every skirt lamp flashes, it backs up, big arrows on the deck show its
// path up to a striped line where it will stop. Then it slides across the deck until its rim bonks the far console
// and sits there dizzy with the eye wide open (DIZZY), shakes itself and floats home.
function startDash(e) {
  let pl0 = null;
  for (const pl of LV.plats) if (pl.x >= e.ax && pl.x + pl.w < e.ax + 170 && pl.y > e.deck - 44 && pl.y < e.deck && (!pl0 || pl.x < pl0.x)) pl0 = pl;
  e.stopX = (pl0 ? pl0.x + pl0.w : e.ax + 96) + SKRX;
}
function stepDash(e) {
  const st = e.st, p = G.p, L = e.L, R = e.R;
  e.browT = 0; e.skirt = 2; e.thrT = 2; e.tlx = -9; e.tly = 3;
  L.tx = 266; L.ty = 98; L.ta = -1.9; L.to = 0.35; R.tx = 468; R.ty = 108; R.ta = -0.4; R.to = 0.4;
  if (st < DASH_TELL) {
    if (st === 1) sfx.rev();
    e.x = e.home + 14 * ss(0, 40, st);
    e.aim = { kind: 'dash' };
    e.bangs.push({ x: offX(e) + EX - 6, y: offY(e) + EY - 46, big: true, fast: st > 36 });
    if (p && !p.dead && p.x > e.stopX - SKRX - 4) e.cue = 'RUN!';
    return;
  }
  if (st === DASH_TELL) sfx.whoosh();
  e.x -= DASH_V;
  const rim = offX(e) + RIM;
  if (p && !p.dead) { const pb = pbox(p); if (pb.x + pb.w >= rim) hurtPlayer(); if (p.x > e.stopX - SKRX - 4) e.cue = 'RUN!'; }
  if (st % 2 === 0) dust(rim + 190, e.deck, 1, 1);
  if (st % 3 === 0) G.parts.push({ type: 'spark', x: rim + 6, y: e.deck - 1, vx: rand(-2.5, -0.5), vy: rand(-2, -0.4), g: 0.16, life: 14, max: 14, size: 1, c: st % 2 ? BEAML : WHITE });
  if (e.x <= e.stopX) {
    const bx = e.stopX - SKRX;
    e.x = e.stopX + 5; e.wob = 1; e.sink = -5;
    go(e, 'dizzy');
    G.shake = Math.max(G.shake, 9); sfx.bonk();
    word(e, 'BONK!', bx - 14, e.deck - 78, WHITE, AMBL, { sc: 3, t: 50, max: 50 });
    sparks(bx, e.deck - 14, 12, WHITE); debris(bx, e.deck - 12, 6, MET);
  }
}
function stepDizzy(e) {
  const st = e.st, L = e.L, R = e.R;
  e.iris = 'spin'; e.tlu = -22; e.tll = 23; e.browT = 4; e.mouth = 'wavy'; e.droopT = 0.7; e.sinkT = HOVER; e.thrT = 0; e.skirt = 0; e.oyT = 0; e.byT = 0; e.anger = 0;
  e.tlx = Math.sin(st / 7) * 4; e.tly = Math.cos(st / 7) * 3;
  for (let i = 0; i < 3; i++) e.lamp[i] = (st + i * 7) % 22 < 4 ? 'red' : 'redoff';
  L.tx = RIM - 14; L.ty = 206; L.ta = 2.7; L.to = 0.9; L.k = 0.1; R.tx = 454; R.ty = 204; R.ta = 0.7; R.to = 0.9; R.k = 0.1;
  if (st >= DIZZY) { e.wob = 1; go(e, 'back'); sfx.whirr(); }
}
function stepBack(e) {
  const st = e.st;
  if (st < 24) { e.browT = 3; e.tlx = Math.sin(st * 1.1) * 8; e.tly = 0; }        // shakes itself awake
  else e.x = Math.min(e.home, e.x + DASH_BACK);
  if (e.x >= e.home) toIdle(e, 50);
}

// DEFEAT. BZZZT: the eye goes spiral, the lamps droop, it spins like a top and sits down flat on its pad; POP! POP!
// POP! the pods in the hold burst open and the freed cows stampede in from the right, over the top of it (each one
// squashes it flatter); its cap comes down on the calf, which stops, MOO!, and trots off with it.
const COWS = [[100, 0, 3.2], [112, 1, 3.3], [124, 0, 3.4], [136, 1, 3.1], [152, 2, 2.4]];     // [frame, variant, speed]
const SQUASH = [0.46, 0.36, 0.28, 0.23, 0.2];
function stepDying(e) {
  const st = e.st, ox = offX(e), oy = offY(e), L = e.L, R = e.R, dk = e.deck, bx = e.x + e.ox;
  e.iris = 'spin'; e.tlu = -22; e.tll = 23; e.browT = 4; e.browDyT = 0; e.mouth = st < 24 ? 'o' : 'wavy'; e.droopT = 1; e.skirt = 0; e.anger = 0;
  e.thrT = st < 30 ? 1 : 0; e.sinkT = st < 30 ? 0 : HOVER; e.oyT = 0; e.byT = 0;
  e.tlx = Math.sin(st / 6) * 3; e.tly = Math.cos(st / 6) * 2;
  for (let i = 0; i < 3; i++) e.lamp[i] = st < 60 && (st + i * 5) % 12 < 4 ? (e.ph2 ? 'red' : 'amb') : (e.ph2 ? 'redoff' : 'off');
  L.tx = RIM - 14; L.ty = 206; L.ta = 2.7; L.to = 1.0; L.k = 0.1; R.tx = 456; R.ty = 204; R.ta = 0.6; R.to = 1.0; R.k = 0.1;
  if (st === 1) { sfx.bzzt(); e.wob = 1; word(e, 'BZZZT!', ox + EX - 110, oy + EY - 62, WHITE, BEAML, { t: 44, max: 44 }); }
  if (st < 50 && st % 4 === 0) sparks(ox + rand(300, 420), oy + rand(90, 190), 3, st % 8 ? BEAML : WHITE);
  // it spins like a top, slower and slower
  if (st === 16) sfx.spin();
  const u = clamp((st - 16) / 80, 0, 1), c = Math.cos(Math.PI * 2 * 3 * (1 - (1 - u) * (1 - u)));
  const spin = st < 16 || u >= 1 ? 1 : Math.abs(c) < 0.14 ? (c < 0 ? -0.14 : 0.14) : c;
  // POP! POP! POP! the pods in the hold burst open (off the right edge): glass flies in
  for (const [f, y] of [[62, 150], [72, 108], [82, 182]]) if (st === f) {
    sfx.pop(); sfx.glass(); word(e, 'POP!', e.ax + W - 64, y, WHITE, CYANL, { t: 30, max: 30 });
    for (let i = 0; i < 7; i++) G.parts.push({ type: 'debris', x: e.ax + W + 4, y: y + rand(-10, 20), vx: rand(-4, -1), vy: rand(-3, -0.5), g: 0.2, life: 50, max: 50, size: 2, c: i % 2 ? CYANL : WHITE });
  }
  if (st === 88) { sfx.moo(); sfx.moo(0.3); }
  // it sits down flat on its pad
  if (st === 96) { e.sqT = 0.62; sfx.thud(); G.shake = Math.max(G.shake, 4); e.wob = 1; }
  e.sy += (e.sqT - e.sy) * 0.3;
  e.sx = spin * (1 + (1 - e.sy) * 0.3);
  // the stampede
  COWS.forEach(([f, v, sp], i) => { if (st === f) e.cows.push({ i, x: e.ax + W + 24, y: dk, v, sp, dir: -1, run: 0, air: false, hit: false, cap: false, moo: 0, stop: false }); });
  for (const cw of e.cows) {
    if (cw.stop) { if (--cw.moo <= 0 && cw.cap) { cw.stop = false; cw.sp = 1.7; } continue; }
    cw.x -= cw.sp; cw.run++;
    const d = Math.abs(cw.x - bx), top = (BY - 72) * e.sy - 2 - 7 * clamp((0.62 - e.sy) / 0.4, 0, 1);
    cw.y = dk - (d < 112 ? top * 0.5 * (1 + Math.cos(Math.PI * d / 112)) : 0);
    cw.air = d < 112 && d > 40;
    if (!cw.hit && cw.x <= bx + 4) {
      cw.hit = true; e.sqT = SQUASH[Math.min(e.bonks++, SQUASH.length - 1)]; e.sy = Math.max(0.12, e.sy - 0.09); e.wob = 1;
      sfx.squish(); G.shake = Math.max(G.shake, 3);
      word(e, 'BONK!', cw.x - 20, cw.y - 30, WHITE, AMBL, { sc: 1, t: 24, max: 24, rise: 6 });
      debris(cw.x, cw.y - 4, 3, GR[3]); debris(cw.x, cw.y - 4, 2, MET);
      if (e.capOn) { e.capOn = false; e.cap = { x: ox + CAPX, y: oy + CAPY, vx: 0.5, vy: -6.6, rot: 0, vr: 0.3 }; sfx.pop(); }
      // the calf stops on top of the wreck and waits for the cap
      if (cw.v === 2) { cw.stop = true; cw.moo = 999; e.cap = { script: true, t: 0, x: cw.x + 46, y: -24, rot: 0, to: cw }; }
    }
  }
  if (e.cows.length) e.cows = e.cows.filter(cw => cw.x > e.ax - 40);
  // the cap comes down, turning over, onto the calf's head
  const cp = e.cap;
  if (cp && cp.script) {
    const k = Math.min(1, ++cp.t / 34), cw = cp.to, hy = cw.y - 20;
    cp.x = lerp(cw.x + 46, cw.x - 8, k); cp.y = lerp(-24, hy, k * k); cp.rot = (1 - k) * 5;
    if (k >= 1) { e.cap = null; cw.cap = true; cw.moo = 70; sfx.pop(); sfx.moo(0.1); sparks(cw.x - 8, hy, 6, AMBL); }
  }
  if (st === 150 && !e.dead) {
    G.big = { s: 'MEGA OGGLE DOWN!', t: 130 };
    if (G.p && G.p.dead && G.lives <= 1) G.lives = 2;
    bossDefeated(e);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The weak spot. The engine never tests its own bullet box against the boss (each bullet gets the boss put on its
// "already hit" list): the test here knows the real silhouette. A shot at the eye's height flies on to the lens; on the
// open lens it hurts (twice as much while the beam fires); on a lid, the bezel or the armour it pings off.
// ---------------------------------------------------------------------------------------------------------------------
function solid(x, y, vx) {
  if (y > SKY - SKRY && Math.abs(x - B.cx) < SKRX && (y <= SKY ? Math.hypot((x - B.cx) / SKRX, (y - SKY) / SKRY) <= 1 : y <= Math.max(lowEdge(x), topEdge(x) + 2.5))) return true;
  if (!BODY(x, y)) return false;
  const dy = y - EY;
  if (vx > 0 && Math.abs(dy) < BR) return x >= EX - Math.sqrt(BR * BR - dy * dy);
  return true;
}
function eyeDamage(e, d, x, y) {
  e.hp -= d; e.hitT = 4; e.eyeT = 6; e.shutDmg += d; e.hpSeen = e.hp;
  sparks(x, y, 3, '#ffe066'); sparks(x, y, 2, WHITE);
  if (e.hp <= 0) { killEnemy(e); return; }
  if (G.t - e.sndT > 3) { e.sndT = G.t; sfx.eye(); }
}
function ping(e, x, y) {
  sparks(x, y, 2, METL);
  if (G.t - e.sndT > 5) { e.sndT = G.t; Snd.clank(); }
  if (G.t - e.pingT > 44) { e.pingT = G.t; G.texts.push({ x: x - 8, y: y - 8, s: 'PING!', t: 24, c: METL }); }
}
function shots(e) {
  const ox = offX(e), oy = offY(e) + Math.round(e.by), gone = e.dying || e.state === 'dying' || e.sy < 0.9;
  for (const b of G.pb) {
    if (b.life <= 0) continue;
    if (b.moT !== e) { b.moT = e; (b.hits || (b.hits = [])).push(e); }
    if (gone) continue;
    const x = b.x + b.vx - ox, y = b.y + b.vy - oy;       // where it is about to be (design coordinates)
    if (!solid(x, y, b.vx)) continue;
    const dy = y - EY;
    let eye = false, sx = b.x + b.vx, sy = b.y + b.vy;
    if (b.vx > 0 && Math.abs(dy) < BR) {
      if (Math.abs(dy) < LR) {
        const xl = EX - Math.sqrt(LR * LR - dy * dy), eu = EY + e.lu - (xl - EX) * US, el = Math.max(EY + e.ll + (xl - EX) * 0.04, eu);
        eye = y > eu - 1 && y < el + 1; sx = ox + xl;
      } else sx = ox + EX - Math.sqrt(BR * BR - dy * dy);
    }
    if (eye && !e.inv) {
      if (b.onHit) { const h0 = e.hp; b.x = sx; b.y = sy; b.onHit(b, e); const got = h0 - e.hp; if (got > 0 && !e.dying) { e.shutDmg += got; eyeDamage(e, e.x2 ? got : 0, sx, sy); } }
      else eyeDamage(e, b.dmg * (e.x2 ? 2 : 1), sx, sy);
      if (e.x2 && G.t - e.x2T > 16) { e.x2T = G.t; G.texts.push({ x: sx - 8, y: sy - 14, s: 'X2', t: 26, c: BEAML }); }
    } else {
      if (b.onHit) { const inv = e.inv; e.inv = true; b.x = sx; b.y = sy; try { b.onHit(b, e); } finally { e.inv = inv; } }
      ping(e, sx, sy);
    }
    b.life = 0;
    if (e.dying) return;
  }
}
// the hero can't walk into it: a wall at the skirt's rim (touching it never hurts)
function wall(e) {
  const p = G.p;
  if (!p || p.dead || e.sy < 0.5) return;
  const pb = pbox(p), over = pb.x + pb.w - (offX(e) + RIM + 2);
  if (over > 0) p.x -= e.state === 'dash' ? over : Math.min(over, 5);
}

function tick(e) {
  e.st++;
  defaults(e);
  switch (e.state) {
    case 'intro': stepIntro(e); break;
    case 'idle': stepIdle(e); break;
    case 'beam': stepBeam(e); break;
    case 'drop': stepDrop(e); break;
    case 'shut': stepShut(e); break;
    case 'phase2': stepPhase2(e); break;
    case 'dash': stepDash(e); break;
    case 'dizzy': stepDizzy(e); break;
    case 'back': stepBack(e); break;
    case 'dying': stepDying(e); break;
  }
}
function updBoss(e) {
  // a blast (a grenade, a robot thrown by the MINI UFO) that got through: the eye was open, it counts
  if (e.hp < e.hpSeen) { e.shutDmg += e.hpSeen - e.hp; e.eyeT = 10; e.wob = Math.max(e.wob, 0.5); }
  tick(e);
  if (e.dead) return;
  animate(e);
  shots(e);
  wall(e);
  e.hpSeen = e.hp;
  if (!e.dying && e.state !== 'dying') L5.megaKeep = { hp: e.hp, run: G.freed };       // for a continue (make)
  if (e.toss.length) tossStep(e);
  // phase 2: the torn plate spits sparks, the louvres leak steam
  if (e.ph2 && !e.dying && e.state !== 'intro') {
    const ox = offX(e), oy = offY(e);
    if (e.t % 34 === 0) sparks(ox + B.cx + rand(8, 26), oy + rand(108, 122), 3, e.t % 68 ? AMBL : WHITE);
    if (e.t % 16 === 0) G.parts.push({ type: 'smoke', x: ox + B.cx + 60 + rand(-2, 2), y: oy + rand(118, 134), vx: rand(0.3, 0.9), vy: rand(-0.9, -0.4), life: 36, max: 36, size: 2 });
  }
  // the front layer (it also carries on the show once the boss is gone)
  if (!e.fxb || e.fxb.life <= 0 || !G.eb.includes(e.fxb)) { e.fxb = { k: 'mofx', x: G.cam.x + W / 2, y: 20, vx: 0, vy: 0, life: 99999, owner: e }; G.eb.push(e.fxb); }
}

// =====================================================================================================================
// Projectiles
// =====================================================================================================================
function crateBurst(b, y) {
  b.landed = true;
  boom(b.x, y, 0.55); debris(b.x, y, 7, SH[5]); debris(b.x, y, 4, GR[3]); debris(b.x, y, 3, AMB);
}
// a cargo crate let go by the claw: falls on its ring, bursts (a hit if you are under it); can be shot in the air
EB_TYPES.mocrate = {
  r: 12, shootable: true,
  update(b) {
    b.t++;
    if (b.y + 10 + b.vy < b.land) return;
    const p = G.p;
    if (p && !p.dead && overlap({ x: b.x - 13, y: b.land - 24, w: 26, h: 26 }, pbox(p))) hurtPlayer();
    crateBurst(b, b.land - 8); b.life = 0;
  },
  draw(b) {
    const s = art().crate, x = Math.round(b.x), y = Math.round(b.y);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (const dx of [-8, 0, 7]) ctx.fillRect(x + dx, y - 16 - Math.min(14, Math.round(b.vy * 3)) - (dx ? 0 : 3), 1, Math.min(14, Math.round(b.vy * 3)));
    ctx.drawImage(s.img, x + s.x0, y + s.y0);
  },
  onHit(b) { crateBurst(b, b.y); },
  onGround(b) { crateBurst(b, groundAt(b.x) - 8); }
};
// a cow pod it grabbed by mistake: harmless. It cracks open where it lands, the cow hops out, leaves a heart or
// ammunition and runs off left.
EB_TYPES.mopod = {
  r: 0,
  update(b) {
    b.t++;
    if (b.ph === 'fall') {
      if (b.y + b.vy < b.land) return;
      b.y = b.land; b.vy = 0; b.g = 0; b.ph = 'open'; b.t = 0; b.landed = true;
      sfx.glass(); sfx.moo(0.1); G.shake = Math.max(G.shake, 2);
      for (let i = 0; i < 12; i++) G.parts.push({ type: 'debris', x: b.x + rand(-14, 14), y: b.y - rand(8, 44), vx: rand(-2.4, 2.4), vy: rand(-3, -0.5), g: 0.2, life: 46, max: 46, size: i % 3 ? 1 : 2, c: i % 2 ? CYANL : WHITE });
      G.texts.push({ x: b.x, y: b.y - 62, s: 'MOO! THANK YOU!', t: 80, c: '#ffe066' });
      addScore(500, b.x, b.y - 46);
      dropItem(b.item, b.x, b.y - 20, 0);
    } else if (b.ph === 'open') {
      if (b.t === 34) { b.ph = 'run'; b.vx = -2.2; debris(b.x, b.y - 6, 6, MET); debris(b.x, b.y - 4, 4, AMB); }
    } else b.y += clamp(surfaceAt(b.x) - b.y, -4, 4);
  },
  draw(b) {
    const t = G.t;
    if (b.ph === 'fall') { M5.pod(b.x, b.y, { id: 2, t, facing: -1 }); if (Math.floor(t / 8) % 2) M5.bubble(b.x, b.y - 54, 'MOO!'); }
    else if (b.ph === 'open') { M5.pod(b.x, b.y, { id: 2, t, empty: true }); M5.cow(b.x, b.y - Math.round(Math.sin(Math.min(1, b.t / 24) * Math.PI) * 9), -1, { v: 0 }); }
    else M5.cow(b.x, b.y - ((b.t >> 2) & 1), -1, { v: 0, run: b.t });
  },
  onGround: () => true
};
// the front layer: never hurts. It draws what must be in front of the hero and, once the boss is gone
// (bossDefeated at frame 150 of the defeat), carries on the show: the wreck, the cows, the cap.
EB_TYPES.mofx = {
  r: 0,
  update(b) {
    const e = b.owner;
    if (!e || (e.dead && (!e.dying || e.st > 520))) { b.life = 0; return; }
    b.x = G.cam.x + W / 2; b.y = 20; b.vx = 0; b.vy = 0; b.g = 0; b.life = 99999;
    if (e.dead) { e.t++; tick(e); animate(e); }
  },
  draw(b) {
    const e = b.owner;
    if (!e) return;
    if (e.dead) drawBoss(e);
    drawFront(e);
  }
};

// =====================================================================================================================
// Registry
// =====================================================================================================================
ENEMY_TYPES.megaoggle = {
  hp: HP, boss: true, bossName: 'MEGA OGGLE', armored: true, grab: false, contact: 'none',
  make(e, s) {
    art();
    // it arrives as a wave at the screen's right edge: its place is the pad, BX px into the locked screen
    const lk = e.lock, hx = lk && lk.at != null ? lk.at + BX : s.x, dk = groundAt(hx - 100);
    Object.assign(e, {
      x: hx, y: dk - HOVER, home: hx, ax: hx - BX, deck: dk, state: 'intro', st: 0, inv: true, ph2: false, atk: 0, rest: 60,
      ox: 0, oy: -215, oyT: -215, by: 0, byT: 0, sink: 0, sinkT: 0, sx: 1, sy: 1, sqT: 1, thr: 2, thrT: 2, droop: 0, droopT: 0, wob: 0,
      lu: LID_SHUT, ll: LID_SHUT, tlu: LID_SHUT, tll: LID_SHUT, lidV: 4, lx: -4, ly: 4, tlx: -4, tly: 4, brow: 0, browT: 0, browDy: 3, browDyT: 0,
      iris: 'norm', mouth: 0, lamp: ['off', 'off', 'off'], skirt: 1, anger: 0, capOn: true, capBob: 0, cap: null,
      L: mkArm(262, 152, 1.9, -0.35, -0.94), R: mkArm(458, 110, -1.2, 0.93, -0.37),
      beam: null, beamEnd: 0, aim: null, cue: null, x2: false, bangs: [], rings: [], words: [], cargo: [], pups: [], cows: [], toss: [],
      drops: 0, gifts: 0, shuts: 0, shutMode: 'sweep', shutDmg: 0, openT: 0, pairSide: 1, stopX: hx, bonks: 0,
      eyeT: 0, sndT: 0, pingT: 0, x2T: 0, hpSeen: e.hp, fxb: null, gloat: 0, seenH: 3
    });
    // after a continue (a game over during this fight) it comes back worn down: the health it had, at most 75 %.
    // The bar still counts from full.
    e.max = e.hp;
    const k = L5.megaKeep;
    if (k && k.run === G.freed && G.continues > 0) e.hp = clamp(Math.min(k.hp, Math.round(e.max * 0.75)), 1, e.max);
    e.hpSeen = e.hp;
  },
  update: updBoss,
  draw: drawBoss,
  // what blasts and the test bot see: the body. (Bullets are tested against the real silhouette, see shots.)
  box(e) { return { x: offX(e) + B.cx - 50, y: offY(e) + 96, w: 106, h: 110 }; },
  onKill(e, cx, cy, b) {
    const p = G.p;
    e.state = 'dying'; e.st = 0; e.hitT = 0; e.inv = true;
    e.beam = null; e.cargo = []; e.toss = []; e.aim = null; e.cue = null; e.rings.length = 0; e.bangs.length = 0; e.sqT = 1; e.bonks = 0;
    G.eb = G.eb.filter(x => x.k !== 'mocrate');
    // the fight is over: its roly eyes and any robot left go with it, nothing hurts the hero from here on
    // (bossDefeated at frame 150 sets winT 210: the same win time), a hero falling on the last life comes back
    for (const w of G.enemies) if (w !== e && w.active && !w.dead && !w.dying && w.state !== 'dying') damageEnemy(w, 99);
    G.winT = 360;
    if (p && p.dead && G.lives <= 1) G.lives = 2;
    addScore(10000, cx, b.y);
    say('Mega Oggle is going down!', 1.1, 1.05);
    return 'dying';
  }
};
}
