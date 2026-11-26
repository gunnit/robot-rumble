'use strict';
// =====================================================================================================================
// Mission 5 (ALIEN MOTHERSHIP) opening scene: BEAMED UP (about 3.6 s; Enter skips). Owner: hangar.
// Scene 1 (painted here, the whole screen): midnight in Vigo Hills. The granite house with a lit window, the horreo,
// the ria with the lights of Vigo across the water; the oggles' mothership hangs over the meadow, far saucers lift
// cows all along the shore. Its green tractor beam snaps on over the hero and a cow, and both float up into the ship
// (MOO!). A flash, then
// Scene 2 (the real game frame, camera 0): THE HANGAR. The beam comes up through the arrival pad at x 120: the cow
// rises out of it first and is whisked up into the booth's projector, the hero rises after it, the beam cuts out and
// he drops onto the deck. MISSION 5 START! (said), the area name, the bars slide away, and the hero is the player's:
// standing on the deck at x 120, visible.
// Sets L5.level.intro = { start, update, draw } (level5.js holds a short placeholder until this file loads).
// The night picture and the ship are painted pixel by pixel and baked once (queued in L5ART.bakes; start() makes
// sure). Never Math.random / rand: hsh and the scene's own clock only.
// =====================================================================================================================
var L5 = L5 || {};
var L5ART = L5ART || {};
{
const Math = globalThis.Math;
// the scene's clock (frames)
const IT = { beam: 10, lift: 24, liftLen: 78, flash: 94, cut: 108, cow: 112, cowLen: 44, hero: 128, heroLen: 28, drop: 166, land: 172, go: 176, out: 182, banner: 188, end: 214 };
const BARS = 30, HX = 120;                   // letterbox height; where the hero arrives (the level's heroStart)
const MEADOW = 214, PLATEAU = 176;           // ground lines of the night picture
const BX = 332, SHIP_Y = 40, EMIT = 84;      // the beam's centre x; the ship's centre y; the beam starts under its dish
const lerp = (a, b, k) => a + (b - a) * k;
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dth = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
const groundY = x => x < 236 ? PLATEAU : x < 300 ? PLATEAU + (MEADOW - PLATEAU) * ease((x - 236) / 64) : MEADOW;

// ---- the night picture and the mothership, baked once ----------------------------------------------------------------
let NIGHT = null, SHIP = null, NB = null;    // (NB: the night picture's buffer between its two bake steps)
const CITY = [];                             // the lights of Vigo across the ria: [x, y, colour] (a few twinkle)
const ramp = (cols, v, x, y) => { const f = clamp(v, 0, 1) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(f)); return cols[i + (f - i > dth(x, y) ? 1 : 0)]; };
// step 1: the sky, the far shore with the city, the ria, the near bank
function bakeSky() {
  if (NIGHT || NB) return;
  const { I, buf, put, rect, shape } = M5.px;
  const b = NB = buf(W, H, 0, 0);
  // sky: deep night to a pale band over the sea, stars, a crescent moon
  const SKY = ['#05061a', '#080b26', '#0c1238', '#141d50', '#1f2c6a', '#2c3f84'].map(I);
  for (let y = 0; y < 160; y++) for (let x = 0; x < W; x++) put(b, x, y, ramp(SKY, Math.pow(y / 160, 1.5) + 0.05 * Math.sin(x / 70 + y / 40), x, y));
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(hsh(i * 1.37 + 3) * W), y = Math.floor(hsh(i * 2.91 + 7) * 136), k = hsh(i * 5.3 + 1);
    put(b, x, y, I(k > 0.75 ? '#ffffff' : k > 0.45 ? '#aab4e6' : '#5a64a8'));
    if (k > 0.93) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(b, x + dx, y + dy, I('#8fa2d2'));
  }
  shape(b, 46, 44, 78, 76, (x, y) => (x - 62) ** 2 + (y - 60) ** 2 <= 12 * 12 && (x - 68) ** 2 + (y - 56) ** 2 > 11.5 * 11.5, (x, y) => (x - 62) + (y - 60) < -6 ? I('#fffbe0') : I('#ffe9a0'));
  // the far shore: hills and the city of Vigo (dark blocks, warm windows), then the ria
  for (let x = 0; x < W; x++) {
    const hy = Math.round(140 - 9 * Math.sin(x / 61 + 1) - 6 * Math.sin(x / 23 + 4) - (x > 250 ? 6 * Math.sin((x - 250) / 73) : 0));
    for (let y = hy; y < 156; y++) put(b, x, y, y === hy ? I('#1a2658') : I('#101a44'));
  }
  for (let i = 0; i < 26; i++) {               // buildings stepping up the far hillside
    const x = 262 + Math.floor(hsh(i * 3.3) * 200), w = 5 + Math.floor(hsh(i * 7.1) * 8), h = 4 + Math.floor(hsh(i * 2.2) * 9), y = 153 - Math.floor(hsh(i * 4.7) * 10);
    rect(b, x, y - h, w, h, I('#0c1436')); rect(b, x, y - h, w, 1, I('#1c2a60'));
  }
  for (let i = 0; i < 64; i++) {
    const x = 258 + Math.floor(hsh(i * 1.9 + 11) * 214), y = 134 + Math.floor(hsh(i * 3.7 + 5) * 20), k = hsh(i * 9.1);
    const c = k > 0.7 ? '#ffe9a0' : k > 0.3 ? '#ffc24a' : '#ff9a3a';
    put(b, x, y, I(c)); CITY.push([x, y, c]);
  }
  const SEA = ['#0a1238', '#0e1a4a', '#132458', '#1a3068'].map(I);
  for (let y = 156; y < 200; y++) for (let x = 0; x < W; x++) put(b, x, y, ramp(SEA, 0.9 - (y - 156) / 40 + 0.12 * Math.sin(x / 9 + y * 1.7), x, y));
  for (const [x, y, c] of CITY) if (y > 140) for (let k = 0; k < 5; k++) if (hsh(x * 0.7 + k) > 0.35) put(b, x + (k & 1), 157 + k * 2 + (x & 1), I(c === '#ffe9a0' ? '#8a7a4a' : '#7a5230'));   // their reflections
  for (let k = 0; k < 14; k++) { const y = 158 + k * 2, w = 3 + Math.floor(hsh(k * 3.1) * 12); rect(b, 62 - (w >> 1) + Math.floor(hsh(k * 5.5) * 7) - 3, y, w, 1, I(k < 4 ? '#c8c08a' : '#6a6c7a')); }   // the moon on the water
  // the near bank between the ria and the meadow
  for (let x = 228; x < W; x++) { const hy = Math.round(194 - 5 * Math.sin(x / 37) - 3 * Math.sin(x / 13 + 2)); for (let y = hy; y < MEADOW + 2; y++) put(b, x, y, y === hy ? I('#16304a') : I('#0c1c34')); }
}
// step 2: the ground, the house, the horreo, the tree, the fence; then the mothership
function bakeHome() {
  if (NIGHT) return;
  if (!NB) bakeSky();
  const { I, buf, put, rect, shape, outline, bake } = M5.px, G5 = M5.PAL.G.map(I), b = NB, OL = I('#090c20');
  // ---- the ground: the plateau with its granite wall, the slope, the meadow
  const GRASS = ['#0e2638', '#143246', '#1c4254'].map(I), SOIL = ['#0a1024', '#101832', '#18203e'].map(I);
  for (let x = 0; x < W; x++) {
    const gy = Math.round(groundY(x));
    for (let y = gy; y < H; y++) {
      const d = y - gy;
      put(b, x, y, d === 0 ? GRASS[2] : d < 3 ? GRASS[1] : d < 5 ? GRASS[0] : ramp(SOIL, 0.8 - d / 50 + 0.2 * (hsh(x * 0.31 + y * 7.7) - 0.5), x, y));
    }
    if (hsh(x * 1.7) > 0.72) { put(b, x, gy - 1, GRASS[2]); if (hsh(x * 3.1) > 0.6) put(b, x, gy - 2, GRASS[1]); }
  }
  for (let y = PLATEAU + 5; y < H; y += 9) for (let x = 0; x < 232; x++) {                    // the plateau's granite wall
    const row = Math.floor((y - PLATEAU) / 9), bx = (x + row * 9) % 22;
    for (let k = 0; k < 9 && y + k < H; k++) put(b, x, y + k, k === 0 || bx === 0 ? I('#141a36') : hsh(Math.floor((x + row * 9) / 22) * 3.3 + row * 7.1) > 0.5 ? I('#2a3254') : I('#232a4a'));
  }
  // ---- the house: granite walls, a tile roof, one lit window, a lantern by the door
  const WALLC = ['#262e52', '#303a62', '#3c4674'].map(I), ROOF = ['#3a2030', '#52293a', '#6a3440', '#84464a'].map(I), WARM = I('#ffd98a');
  for (let y = 128; y < PLATEAU; y++) for (let x = 34; x < 150; x++) {
    const row = Math.floor((y - 128) / 6), bx = (x + (row & 1) * 7) % 14;
    put(b, x, y, (y - 128) % 6 === 0 || bx === 0 ? WALLC[0] : hsh(Math.floor((x + (row & 1) * 7) / 14) * 5.1 + row * 3.3) > 0.55 ? WALLC[2] : WALLC[1]);
  }
  for (let y = 100; y < 130; y++) { const k = (y - 100) / 30, x0 = Math.round(48 - k * 24), x1 = Math.round(136 + k * 24); for (let x = x0; x < x1; x++) put(b, x, y, (y - 100) % 5 === 0 ? ROOF[0] : ((x + Math.floor((y - 100) / 5) * 3) % 6 === 0 ? ROOF[1] : (x - x0 < 30 - k * 10 ? ROOF[3] : ROOF[2]))); }
  rect(b, 22, 129, 140, 2, OL);
  rect(b, 106, 86, 13, 18, WALLC[1]); rect(b, 106, 86, 2, 18, WALLC[2]); rect(b, 104, 84, 17, 3, WALLC[0]);            // chimney
  rect(b, 84, 150, 16, 26, OL); rect(b, 86, 152, 12, 24, I('#1c2c3a')); rect(b, 91, 152, 1, 24, OL); put(b, 96, 164, WARM);   // door
  for (const [wx, lit] of [[46, true], [118, false]]) {
    rect(b, wx - 2, 136, 22, 22, OL); rect(b, wx, 138, 18, 18, lit ? WARM : I('#16224a'));
    if (lit) { rect(b, wx, 138, 18, 6, I('#fff2c4')); rect(b, wx + 3, 148, 6, 8, I('#c98a3a')); } else rect(b, wx + 2, 140, 5, 3, I('#2c3f84'));
    rect(b, wx + 8, 138, 2, 18, OL); rect(b, wx, 146, 18, 2, OL);
    rect(b, wx - 3, 158, 24, 2, WALLC[2]);
  }
  rect(b, 76, 146, 4, 5, OL); rect(b, 77, 147, 2, 3, WARM);                                                              // the lantern
  // ---- the horreo: a granary on stone legs, slatted sides, a tile roof with two pinnacles
  for (const lx of [176, 192, 208, 222]) { rect(b, lx, 160, 4, PLATEAU - 160, WALLC[1]); rect(b, lx - 2, 158, 8, 2, WALLC[2]); }
  rect(b, 172, 136, 58, 22, I('#1c1830')); for (let x = 174; x < 228; x += 3) rect(b, x, 138, 2, 18, I('#3a3050')); rect(b, 172, 136, 58, 1, WALLC[2]); rect(b, 172, 157, 58, 1, WALLC[0]);
  for (let y = 124; y < 136; y++) { const k = (y - 124) / 12, x0 = Math.round(182 - k * 14), x1 = Math.round(220 + k * 14); for (let x = x0; x < x1; x++) put(b, x, y, (y - 124) % 4 === 0 ? ROOF[0] : (x - x0 < 16 ? ROOF[3] : ROOF[2])); }
  for (const px of [170, 230]) { rect(b, px, 120, 3, 12, WALLC[1]); put(b, px + 1, 118, WALLC[2]); put(b, px + 1, 119, WALLC[2]); }
  // ---- a cherry tree, a fence along the meadow
  rect(b, 256, 150, 5, 34, I('#1a1430')); rect(b, 256, 150, 1, 34, I('#2c2452'));
  for (const [cx, cy, r] of [[258, 132, 19], [244, 142, 12], [273, 141, 12]]) shape(b, cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r, (x, y) => ((x - cx) + (y - cy) * 1.5 < -r * 0.5) ? (dth(x, y) < 0.5 ? I('#5a4274') : I('#3c2e60')) : dth(x, y) < 0.3 ? I('#3c2e60') : I('#261e48'));
  for (let x = 304; x < W; x += 26) { rect(b, x, MEADOW - 12, 3, 12, I('#1c2646')); put(b, x, MEADOW - 12, I('#34427a')); }
  for (let x = 300; x < W; x++) { put(b, x, MEADOW - 9, I('#243058')); put(b, x, MEADOW - 5, I('#1c2646')); }
  NIGHT = bake(b); NB = null;
  // ---- the mothership's belly: a huge green disc seen from below, rings of plating, the beam dish in the middle
  const s = buf(380, 96, 190, 44), RX = 184, RY = 34;
  shape(s, -RX, -RY, RX, RY, (x, y) => (x / RX) ** 2 + (y / RY) ** 2 <= 1, (x, y) => {
    const u = Math.sqrt((x / RX) ** 2 + (y / RY) ** 2), v = y / RY;
    if (u > 0.94) return v > 0 ? G5[3] : G5[1];
    if (Math.abs(u - 0.72) < 0.02 || Math.abs(u - 0.44) < 0.02) return G5[0];
    return ramp([G5[0], G5[1], G5[2]], 0.25 + 0.5 * v + (u < 0.44 ? 0.25 : 0) + 0.1 * Math.sin(Math.atan2(y / RY, x / RX) * 12), x + 190, y + 44);
  });
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, x = Math.round(Math.cos(a) * RX * 0.58), y = Math.round(Math.sin(a) * RY * 0.58); rect(s, x - 1, y, 3, 2, I('#74d3ee')); put(s, x - 1, y, I('#dff9ff')); }   // portholes
  shape(s, -30, 26, 30, 44, (x, y) => (x / 30) ** 2 + ((y - 34) / 8) ** 2 <= 1, (x, y) => { const u = (x / 30) ** 2 + ((y - 34) / 8) ** 2; return u > 0.72 ? I(METD) : u > 0.5 ? I(MET) : u > 0.3 ? I('#9dff4a') : I('#eaffc8'); });
  outline(s);
  SHIP = bake(s);
}
(L5ART.bakes = L5ART.bakes || []).push(bakeSky, bakeHome);

// ---- live pieces -----------------------------------------------------------------------------------------------------
// the tractor beam: a green cone from (x, y0), half-width w0, down to y1, half-width w1; a = strength 0..1
function beam(x, y0, y1, w0, w1, a, t) {
  const n = Math.max(1, y1 - y0);
  for (let j = 0; j < n; j += 2) {
    const k = j / n, hw = Math.round(lerp(w0, w1, k));
    ctx.fillStyle = 'rgba(157,255,74,' + clamp(a * (0.36 - k * 0.14 + 0.07 * Math.sin(t / 3 - j / 4)), 0, 1).toFixed(3) + ')';
    ctx.fillRect(x - hw, y0 + j, hw * 2, 2);
  }
  for (let r = 0; r < 5; r++) {                // rings sliding up
    const u = (t / 34 + r / 5) % 1, y = Math.round(y1 - u * n), hw = Math.round(lerp(w1, w0, u));
    ctx.fillStyle = 'rgba(234,255,200,' + (a * (0.55 * (1 - Math.abs(u - 0.5) * 2) + 0.15)).toFixed(3) + ')'; ctx.fillRect(x - hw, y, hw * 2, 1);
  }
  ctx.fillStyle = 'rgba(234,255,200,' + (a * 0.5).toFixed(3) + ')';
  for (let j = 0; j < n; j++) { const hw = Math.round(lerp(w0, w1, j / n)); ctx.fillRect(x - hw, y0 + j, 1, 1); ctx.fillRect(x + hw - 1, y0 + j, 1, 1); }
  for (let k = 0; k < 12; k++) {               // sparkles going up
    const u = (t / 50 + hsh(k * 3.3)) % 1, hw = lerp(w1, w0, u) - 3;
    ctx.fillStyle = k % 2 ? 'rgba(234,255,200,' + a.toFixed(2) + ')' : 'rgba(255,255,255,' + a.toFixed(2) + ')';
    ctx.fillRect(Math.round(x + (hsh(k * 7.7) * 2 - 1) * hw), Math.round(y1 - u * n), 1, 1 + (k & 1));
  }
}
function floater(draw, x, y, rot) { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot); draw(); ctx.restore(); }
// a far saucer lifting a cow off the shore (tiny: clearly far away)
function farSaucer(x, y, ground, t, ph) {
  const P = M5.PAL.G, bob = Math.round(Math.sin((t + ph) / 19) * 1);
  const n = ground - y - 2;
  for (let j = 0; j < n; j += 2) { const hw = 1 + Math.round(j / n * 3); ctx.fillStyle = 'rgba(157,255,74,' + (0.34 - 0.16 * j / n + 0.06 * Math.sin((t + ph) / 4 - j / 3)).toFixed(3) + ')'; ctx.fillRect(x - hw, y + 2 + bob + j, hw * 2 + 1, 2); }
  const u = ((t + ph * 3) % 110) / 110, cy = Math.round(ground - 2 - u * (ground - y - 6));
  R(x - 2, cy, 4, 2, '#d59a46'); R(x + 1, cy - 1, 2, 1, '#fbe3a6'); R(x - 2, cy + 2, 1, 1, '#6b4423'); R(x + 1, cy + 2, 1, 1, '#6b4423');
  R(x - 2, y - 3 + bob, 4, 2, '#74d3ee'); R(x - 5, y - 1 + bob, 11, 1, P[5]); R(x - 7, y + bob, 15, 1, P[3]); R(x - 5, y + 1 + bob, 11, 1, P[1]); R(x - 1, y + 2 + bob, 3, 1, '#eaffc8');
  if (Math.floor((t + ph) / 12) % 2) { R(x - 7, y + bob, 1, 1, M5.PAL.AMBL); R(x + 7, y + bob, 1, 1, M5.PAL.AMBL); }
}

function makeIntro(LVL) {
  let t = 0;
  // the hero is the player's from here: standing on the deck at the arrival pad, visible, facing right
  function handover() { const p = G.p; p.hidden = false; p.x = HX; p.y = groundAt(HX); p.vx = p.vy = 0; p.onGround = true; p.facing = 1; G.introKeys = {}; }
  const moo = (d = 0) => { Snd.tone('sawtooth', 185, 139, 0.5, 0.09, d); Snd.tone('sawtooth', 139, 110, 0.35, 0.07, d + 0.3); };
  // scene 1: where the hero and the cow are (feet), their tilt, whether they are still on the ground
  function lifted() {
    const u = clamp((t - IT.lift) / IT.liftLen, 0, 1), e = u * u, ec = Math.min(1, u * 1.22) ** 2, top = EMIT - 6;
    return {
      up: t >= IT.lift,
      hero: { x: 314 + Math.sin(t / 13) * 4 * e + (BX - 6 - 314) * e, y: lerp(MEADOW, top + 18, e), rot: Math.sin(t / 9) * 0.5 * Math.min(1, u * 3) },
      cow: { x: 348 + Math.sin(t / 11 + 2) * 4 * ec + (BX + 4 - 348) * ec, y: lerp(MEADOW, top, ec), rot: Math.sin(t / 12 + 1) * 0.4 * Math.min(1, u * 3) }
    };
  }
  // scene 2: the cow and the hero coming up through the arrival pad (feet y; null = not there)
  function arriving() {
    const deck = Math.round(groundAt(HX)), top = L5ART.hangar && L5ART.hangar.pad ? L5ART.hangar.pad.top : 67;
    const uc = (t - IT.cow) / IT.cowLen, uh = clamp((t - IT.hero) / IT.heroLen, 0, 1);
    let hy = null;
    if (t >= IT.hero && t < IT.land) hy = t < IT.drop ? lerp(deck + 34, deck - 6, 1 - (1 - uh) * (1 - uh)) + (uh >= 1 ? Math.sin((t - IT.hero - IT.heroLen) / 5) * 1.5 : 0) : lerp(deck - 6, deck, ((t - IT.drop) / (IT.land - IT.drop)) ** 2);
    return { deck, top, cow: uc >= 0 && uc <= 1 ? lerp(deck + 26, top - 4, uc) : null, hero: hy };
  }
  return {
    start() {
      t = 0;
      bakeHome();
      const p = G.p; p.hidden = true; p.x = HX; p.y = groundAt(HX); p.vx = p.vy = 0; p.facing = 1; G.introKeys = {};
      Snd.tone('sine', 70, 110, 1.6, 0.07);
    },
    update() {
      t++;
      if (t > 8 && t < IT.go && pressed.Enter) t = IT.go;              // Enter: straight to the hand-over and the banner
      if (t === IT.beam) { Snd.tone('sawtooth', 160, 640, 0.35, 0.06); Snd.tone('sine', 300, 900, 1.3, 0.07, 0.2); }
      if (t === IT.lift + 8) moo();
      if (t === IT.flash) Snd.noise(0.5, 0.08, 2400);
      if (t === IT.cow + 6) moo();
      if (t === IT.hero) Snd.tone('sine', 420, 880, 0.4, 0.07);
      if (t === IT.land) { handover(); dust(HX, G.p.y, 6); Snd.tone('sine', 700, 200, 0.2, 0.1); G.shake = Math.max(G.shake, 1.5); }
      if (t === IT.go) { handover(); G.big = { s: LVL.startText, t: 130 }; say(LVL.startSay); }
      if (t === IT.banner) G.banner = { s: LVL.sections[0].name, t: 200 };
      if (t < IT.end) return false;
      handover();
      return true;
    },
    draw() {
      const P = M5.PAL, cx = Math.round(G.cam.x);
      if (t < IT.cut && NIGHT) {
        // ---- scene 1: midnight in Vigo Hills
        ctx.drawImage(NIGHT, 0, 0);
        for (let i = 0; i < CITY.length; i += 5) if (Math.floor((t + i * 7) / 9) % 4 === 0) R(CITY[i][0], CITY[i][1], 1, 1, '#0c1436');   // lights going out and on
        for (let i = 0; i < 6; i++) if (Math.floor((t + i * 17) / 11) % 3 === 0) { const x = Math.floor(hsh(i * 4.4 + 2) * 250), y = 36 + Math.floor(hsh(i * 8.1) * 80); R(x, y, 1, 1, '#ffffff'); R(x - 1, y, 3, 1, 'rgba(200,220,255,0.45)'); R(x, y - 1, 1, 3, 'rgba(200,220,255,0.45)'); }
        M5.glow(55, 147, 22, '#ffd98a', 0.3 + 0.04 * Math.sin(t / 7)); M5.glow(78, 148, 9, '#ffd98a', 0.5);
        farSaucer(424, 104, 142, t, 0); farSaucer(463, 96, 139, t, 40); farSaucer(9, 106, 144, t, 75);
        // the other hero, at the door: what is going on out there?
        drawHero(HEROES[1 - G.hero], 104, PLATEAU, 1, { pose: 'idle', t, aim: 'fwd', knife: 0 });
        if (t > IT.beam + 6 && Math.floor(t / 6) % 2) text('!', 104, PLATEAU - 44, '#ffe066', 1, 'center');
        // the mothership and its beam
        const on = t >= IT.beam, grow = clamp((t - IT.beam) / 7, 0, 1), sb = Math.round(Math.sin(t / 21) * 1.5);
        ctx.drawImage(SHIP, BX - 190, SHIP_Y - 44 + sb);
        for (let k = 0; k < 16; k++) {             // a ring of lamps chasing round the belly
          const a = k / 16 * Math.PI * 2, x = BX + Math.round(Math.cos(a) * 184 * 0.83), y = SHIP_Y + sb + Math.round(Math.sin(a) * 34 * 0.83), lit = (k + Math.floor(t / 4)) % 4 === 0;
          if (y < 32 || (Math.abs(x - BX) < 40 && y > SHIP_Y + sb + 18)) continue;
          R(x - 1, y, 3, 2, lit ? P.AMBL : '#8a6a12'); if (lit) M5.glow(x, y + 1, 6, P.AMB, 0.5);
        }
        const L = lifted(), y1 = Math.round(lerp(EMIT + sb, MEADOW + 2, grow));
        if (on) {
          M5.glow(BX, EMIT - 4 + sb, 34, P.BEAM, 0.55);
          beam(BX, EMIT + sb, y1, 22, Math.round(lerp(22, 48, grow)), 1, t);
          if (grow >= 1) { ctx.fillStyle = 'rgba(234,255,200,0.5)'; ctx.fillRect(BX - 50, MEADOW, 100, 1); ctx.fillStyle = 'rgba(157,255,74,0.3)'; ctx.fillRect(BX - 44, MEADOW + 1, 88, 2); M5.glow(BX, MEADOW, 54, P.BEAM, 0.3); }
        }
        ctx.save(); ctx.beginPath(); ctx.rect(0, EMIT + sb, W, H); ctx.clip();          // they vanish into the dish
        floater(() => M5.cow(0, 9, -1, { float: L.up }), L.cow.x, L.cow.y - 9, L.cow.rot);
        floater(() => drawHero(HEROES[G.hero], 0, 14, 1, { pose: L.up ? 'jump' : 'idle', t, aim: 'fwd', knife: 0 }), L.hero.x, L.hero.y - 14, L.hero.rot);
        ctx.restore();
        if (t > IT.beam + 2 && t < IT.lift + 46 && L.cow.y > EMIT + 34) M5.bubble(L.cow.x + 20, L.cow.y - 24, t < IT.lift + 6 ? 'MOO?' : 'MOO!');
        if (t > IT.beam && t < IT.lift) M5.bang(L.hero.x, L.hero.y - 34, t);
      } else if (t < IT.land + 12) {
        // ---- scene 2: up through the arrival pad of the hangar
        const A = arriving(), sx = HX - cx, a = t < IT.drop ? 1 : Math.max(0, 1 - (t - IT.drop) / (IT.land + 10 - IT.drop));
        if (a > 0) {
          beam(sx, A.top + 1, A.deck, 21, 27, a * 0.9, t);
          M5.glow(sx, A.deck - 2, 34, P.BEAM, 0.35 * a); M5.glow(sx, A.top + 2, 22, P.BEAM, 0.4 * a);
        }
        ctx.save(); ctx.beginPath(); ctx.rect(sx - 44, A.top + 1, 88, A.deck - A.top - 1); ctx.clip();   // out of the pad, into the projector
        if (A.cow !== null) floater(() => M5.cow(0, 9, 1, { float: true }), sx + 2 + Math.sin(t / 6) * 2, A.cow - 9, Math.sin(t / 8) * 0.25);
        if (A.hero !== null) drawHero(HEROES[G.hero], sx, Math.round(A.hero), 1, { pose: t < IT.drop ? 'jump' : 'idle', t, aim: 'fwd', knife: 0 });
        ctx.restore();
        if (A.cow !== null && A.cow > A.top + 40 && A.cow < A.deck - 6) M5.bubble(sx + 30, A.cow - 26, 'MOO!');
        if (t >= IT.cow && t < IT.drop) for (let k = 0; k < 6; k++) { const u = (t / 14 + k / 6) % 1; R(sx + Math.round((hsh(k * 5.1) * 2 - 1) * (10 + u * 22)), A.deck - 1 - Math.round(u * 5), 1, 1, k % 2 ? '#eaffc8' : '#ffffff'); }
      }
      // the flash between the scenes
      const fl = t < IT.cut ? clamp((t - IT.flash) / (IT.cut - IT.flash), 0, 1) ** 2 : t < IT.go ? Math.max(0, 1 - (t - IT.cut) / 12) : 0;
      if (fl > 0) { ctx.fillStyle = 'rgba(234,255,200,' + fl.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      // letterbox bars and the captions
      const k = t < 10 ? ease(t / 10) : t > IT.out ? 1 - ease((t - IT.out) / (IT.end - IT.out)) : 1, bh = Math.round(BARS * k);
      if (bh > 0) {
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
        ctx.fillStyle = '#12301c'; ctx.fillRect(0, bh - 1, W, 1); ctx.fillRect(0, H - bh, W, 1);
        if (t < IT.cut) { const ca = Math.min(1, (t - 6) / 12, (IT.cut - 4 - t) / 10); if (ca > 0) { ctx.globalAlpha = ca; text('MIDNIGHT IN VIGO HILLS...', W / 2, H - bh + 11, '#c8f7ff', 1, 'center', null); ctx.globalAlpha = 1; } }
        else if (t < IT.go + 6) { const ca = Math.min(1, (t - IT.cut - 6) / 10); if (ca > 0) { ctx.globalAlpha = ca; text('ALIEN MOTHERSHIP', W / 2, H - bh + 8, '#9dff4a', 2, 'center', '#0c2b1c'); ctx.globalAlpha = 1; } }
        if (t > 30 && t < IT.go && (t >> 4) % 2) text('ENTER: SKIP', W - 8, 11, '#8a8aa0', 1, 'right', null);
      }
    }
  };
}
if (L5.level) L5.level.intro = makeIntro(L5.level);
}
