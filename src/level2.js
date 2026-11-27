'use strict';
var L2 = L2 || {};
// ============================================================
// Mission 2: VIGO HILLS (LEVELS[1]). Out of a little granite house on a hill over the Ria de Vigo, down through
// the chestnut woods and the farm (battle tractor, rain) to the cherry orchard and the MEGA BEAR.
// This file: the level data (terrain, platforms, spawns, locks, animals, props), the level hooks, the opening
// cutscene, the mission-card art, the six caged animals (POW_KINDS dog sheep pony cow hen goat) and the music
// (TRACKS.vigo, a muineira jig on the gaita over a D drone, TRACKS.bearboss, and TRACKS.victory for the ALL MISSIONS
// COMPLETE screen).
// The other Mission 2 files hang their hooks on the shared L2 object (level2_sky.js: drawBG, drawOverlay, skyLoad,
// skyUpdate, weather; level2_world.js: drawBehind, drawGround, drawPlat, drawFront, worldLoad, worldUpdate). Each
// level hook calls its L2 hook when it exists and draws a simple stand-in when it doesn't.
// Everything in the block below is private.
// ============================================================
{
// ============================================================
// Level data (world x; y is screen y, there is no vertical camera)
// ============================================================
// Fixed positions the other Mission 2 files rely on:
//   house x 40-170, front door centred at x 120, plateau ground y 176 from x 0 to 250; horreo x 190-245;
//   stream x 2010-2130 (bed y 240); tractor parked at x 2950; boss arena x 5720-6200 (flat, y 232); end 6200.
const SECTIONS = [
  { x: 0, name: 'AREA 1: HOME SWEET HOME' },
  { x: 1350, name: 'AREA 2: CHESTNUT WOODS' },
  { x: 2850, name: 'AREA 3: THE FARM' },
  { x: 4400, name: 'AREA 4: CHERRY ORCHARD' },
  // a checkpoint before the MEGA BEAR: a continue starts by the dog with the H, the boss lock just ahead
  { x: 5450, name: 'FINAL AREA: THE BIG CHERRY TREES' }
];

const VIGO = {
  mission: 'MISSION 2', title: 'VIGO HILLS', end: 6200, heroStart: 120, freedLabel: 'ANIMALS RESCUED',
  music: 'vigo', bossMusic: 'bearboss', clearMusic: 'victory',
  // the start band and voice (the intro's, and the engine's on a continue)
  startText: 'MISSION 2 START!', startSay: 'Mission two, start!',
  sections: SECTIONS,
  terrain: [
    [0, 176], [250, 176], [300, 182], [360, 196], [430, 212], [520, 224], [600, 230], [700, 232], [850, 228],
    [1000, 218], [1150, 214], [1300, 224], [1450, 232], [1650, 226], [1850, 218], [1960, 230], [2010, 240],
    [2130, 240], [2180, 230], [2350, 222], [2550, 228], [2750, 232], [3300, 228], [3500, 232], [3900, 228],
    [4250, 232], [4450, 226], [4650, 218], [4850, 224], [5050, 232], [6200, 232]
  ],
  // One-way platforms, each top 19-32px above the ground under it (the hero jumps about 55px): cover and high
  // ground, never in the way. None in the stream (x 1960-2180) or the boss arena (x >= 5700).
  plats: [
    // AREA 1: granite walls along the path down the hill
    { x: 400, y: 186, w: 40, t: 'wall' }, { x: 640, y: 206, w: 56, t: 'wall' },
    { x: 830, y: 202, w: 60, t: 'wall' }, { x: 1080, y: 186, w: 52, t: 'wall' },
    // AREA 2: stumps and mossy boulders in the woods
    { x: 1420, y: 208, w: 26, t: 'stump' }, { x: 1600, y: 200, w: 48, t: 'boulder' },
    { x: 1770, y: 200, w: 24, t: 'stump' }, { x: 1860, y: 198, w: 44, t: 'boulder' },
    { x: 2190, y: 206, w: 26, t: 'stump' }, { x: 2440, y: 196, w: 50, t: 'boulder' },
    { x: 2620, y: 206, w: 24, t: 'stump' },
    // AREA 3: hay bales and a farm cart
    { x: 3070, y: 206, w: 32, t: 'hay' }, { x: 3270, y: 204, w: 52, t: 'cart' },
    { x: 3430, y: 200, w: 40, t: 'hay' }, { x: 3640, y: 206, w: 34, t: 'hay' },
    { x: 3880, y: 204, w: 32, t: 'hay' }, { x: 4080, y: 206, w: 32, t: 'hay' },
    // AREA 4: low walls and a boulder in the orchard
    { x: 4520, y: 200, w: 44, t: 'wall' }, { x: 4990, y: 206, w: 40, t: 'boulder' },
    { x: 5260, y: 208, w: 56, t: 'wall' }
  ],
  // Enemies placed at load (asleep until they come within 30px of the right screen edge). Eagle alt = cruising y.
  // Pacing: each area opens gently and gets busier; a calm stretch follows every lock (a crate, an animal), and
  // the last 300px before the MEGA BEAR are quiet: the dog with the H and two cherry trees to refill hearts.
  spawns: [
    // AREA 1: a calm start at the house, the first two wolves come up the hill (the dog's shotgun is just
    // behind them), the first eagle, then a breather until the wolf pack's lock
    { t: 'wolf', x: 660 }, { t: 'wolf', x: 720 },
    { t: 'eagle', x: 900, alt: 70 },
    // AREA 2: wolves and eagles in the woods, one eagle over the stream
    { t: 'wolf', x: 1530 }, { t: 'wolf', x: 1580 },
    { t: 'eagle', x: 1760, alt: 80 },
    { t: 'wolf', x: 1880 },
    { t: 'eagle', x: 2090, alt: 72 },
    { t: 'wolf', x: 2200 },
    // AREA 3: the farm after the tractor (time to drive it into the rain): wolves, an eagle, and a bear for the cannon.
    // The tractor makes the farm quick, so it gets more robots than the other areas (here, in its lock and in the rain)
    { t: 'wolf', x: 3140 }, { t: 'wolf', x: 3190 },
    { t: 'eagle', x: 3280, alt: 76 },
    { t: 'wolf', x: 3380 }, { t: 'bear', x: 3440 },
    // after the farm lock, in the heavy rain: wolves, an eagle and a bear guarding the way out of the farm
    { t: 'wolf', x: 3700 }, { t: 'eagle', x: 3880, alt: 74 }, { t: 'wolf', x: 3960 }, { t: 'bear', x: 4020 },
    // as the rain clears: a wolf and an eagle, then quiet under the rainbow
    { t: 'wolf', x: 4100 }, { t: 'eagle', x: 4250, alt: 72 },
    // AREA 4: the orchard (a breather after x 5300: the FINAL AREA checkpoint, the dog with the H, then the boss)
    { t: 'wolf', x: 4560 }, { t: 'wolf', x: 4650 },
    { t: 'eagle', x: 4800, alt: 66 },
    { t: 'bear', x: 5080 },
    { t: 'wolf', x: 5180 }, { t: 'eagle', x: 5300, alt: 80 }
  ],
  // Camera locks: the screen stops at `at` until the waves are beaten (wave enemies enter just off screen)
  locks: [
    { at: 900, waves: [
      { t: 'wolf', side: 1, d: 20 }, { t: 'wolf', side: 1, d: 55 }, { t: 'wolf', side: -1, d: 120 },
      { t: 'eagle', side: 1, d: 170, alt: 64 }, { t: 'wolf', side: 1, d: 250 }
    ] },
    { at: 2250, waves: [
      { t: 'robobear', side: 1, d: 40 }, { t: 'wolf', side: -1, d: 220 }, { t: 'wolf', side: 1, d: 400 }
    ] },
    { at: 3500, waves: [
      { t: 'eagle', side: 1, d: 30, alt: 70 }, { t: 'wolf', side: 1, d: 90 }, { t: 'wolf', side: -1, d: 160 },
      { t: 'bear', side: 1, d: 260 }, { t: 'eagle', side: -1, d: 360, alt: 84 }, { t: 'wolf', side: 1, d: 460 },
      { t: 'wolf', side: -1, d: 560 }, { t: 'eagle', side: 1, d: 660, alt: 66 }, { t: 'bear', side: 1, d: 760 }
    ] },
    { at: 4880, waves: [   // ORCHARD AMBUSH (audit 2026-11): a short beat in the blossoms before the boss
      { t: 'eagle', side: 1, d: 30, alt: 70 }, { t: 'wolf', side: -1, d: 110 }, { t: 'wolf', side: 1, d: 190 }
    ] },
    { at: 5720, boss: true, waves: [{ t: 'megabear', side: 1, d: 60 }] }
  ],
  // The animals in robot cages: free one and it drops its item (the shotgun right before the first wolves, the flame
  // for the woods, rockets for the ROBO BEAR, grenades for the farm, hearts in the rain and the orchard, the heavy
  // machine gun for the MEGA BEAR). S, F and R come on foot, before the tractor: letters taken in it replace each other
  pows: [
    { x: 560, item: 'S', kind: 'dog' }, { x: 1550, item: 'F', kind: 'sheep' }, { x: 2300, item: 'R', kind: 'pony' },
    { x: 3200, item: 'B', kind: 'cow' }, { x: 3800, item: 'heart', kind: 'hen' }, { x: 4600, item: 'heart', kind: 'goat' },
    { x: 5560, item: 'H', kind: 'dog' }
  ],
  // Props, drawn in this order: trees first (behind the crates), the parked tractor last. Hearts in a crate inside the
  // wolf pack's lock, before the stream and the ROBO BEAR, after it, and before the MEGA BEAR
  props: [
    { k: 'cherrytree', x: 300 },
    { k: 'chestnuttree', x: 1480 }, { k: 'chestnuttree', x: 1700 }, { k: 'chestnuttree', x: 1940 },
    { k: 'chestnuttree', x: 2370 }, { k: 'chestnuttree', x: 2560 }, { k: 'chestnuttree', x: 2690 },
    { k: 'cherrytree', x: 4470 }, { k: 'cherrytree', x: 4690 }, { k: 'cherrytree', x: 4880 },
    { k: 'cherrytree', x: 5130 }, { k: 'cherrytree', x: 5400 },
    { k: 'crate', x: 760, item: 'coin' }, { k: 'crate', x: 1250, item: 'heart' }, { k: 'crate', x: 1820, item: 'heart' },
    { k: 'crate', x: 2760, item: 'heart' }, { k: 'crate', x: 4160, item: 'coin' }, { k: 'crate', x: 5200, item: 'heart' },
    { k: 'barrel', x: 3160 }, { k: 'barrel', x: 3370 }, { k: 'barrel', x: 3720 },
    { k: 'tractor', x: 2950 }
  ],
  drawBG(cx) { if (L2.drawBG) L2.drawBG(cx); else fallbackBG(cx); },
  drawBehind(cx) { if (L2.drawBehind) L2.drawBehind(cx); else fallbackBehind(cx); missingProps(cx); },
  drawGround(cx) { if (L2.drawGround) L2.drawGround(cx); else fallbackGround(cx); },
  drawPlat(pl) { if (L2.drawPlat) L2.drawPlat(pl); else fallbackPlat(pl); },
  drawFront(cx) { if (L2.drawFront) L2.drawFront(cx); },
  drawOverlay(cx) {
    if (L2.drawOverlay) L2.drawOverlay(cx);
    ctx.save(); ctx.translate(-cx, 0);
    for (const o of G.pows) if (o.state === 'tied' && KINDS[o.kind]) helpBubble(KINDS[o.kind], o);
    ctx.restore();
  },
  // once per play frame, after all objects (also during the intro)
  update() {
    if (G.treeShake > 0) G.treeShake--;
    if (L2.skyUpdate) L2.skyUpdate();
    if (L2.worldUpdate) L2.worldUpdate();
    // an animal freed as the camera moves on is culled before its drop (salute t 40), or drops its item where it is
    // culled at once (x - 10 off the left edge): drop it on screen now
    for (const o of G.pows) if ((o.state === 'free' || o.state === 'salute') && o.t < 40 && o.x <= G.cam.x - 15) {
      const n = G.items.length;
      dropItem(o.item, G.cam.x + 20, o.y - 14, 1); o.state = 'salute'; o.t = 41;
      if (G.items.length > n) toss(G.items[n]);
    }
    // a freed animal tosses its item to where the hero is heading (the engine drops it behind the animal)
    for (const it of G.items) {
      if (it.t !== 1 || it.tossed) continue;
      if (G.pows.some(o => o.state === 'salute' && o.t === 40 && Math.abs(o.x - 10 - (it.x - it.vx)) < 2)) toss(it);
    }
  },
  // after the level is (re)built for camera x cp (start 0, a checkpoint, or a devStart x), before intro.start()
  load(cp) {
    G.introDoor = 0; G.treeShake = 0;
    if (G.p) G.p.hidden = false;
    if (L2.skyLoad) L2.skyLoad(cp);
    if (L2.worldLoad) L2.worldLoad(cp);
  },
  intro: makeIntro(),
  preview: drawPreview,
  // the hero select behind the cards: the ria and the hills (the sky's own backdrop; builds the sky strips once)
  menuBG() { if (L2.drawBG) L2.drawBG(0); else fallbackBG(0); }
};
LEVELS.push(VIGO);

// ============================================================
// Pixel grid: shapes painted with palette letters, shaded (light top edge, dark underside) and outlined with k,
// then turned into a makeSprite sprite. Used at load for the animals and the flying cage parts.
// ============================================================
function grid(w, h) {
  const g = [];
  for (let y = 0; y < h; y++) g.push(new Array(w).fill('.'));
  const put = (x, y, c) => { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; };
  const o = {
    w, h,
    at: (x, y) => x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : '.',
    p(x, y, c) { put(x, y, c); return o; },
    r(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) put(x + i, y + j, c); return o; },
    e(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx) - 1; x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1.04) put(x, y, c);
      }
      return o;
    },
    // a thick line (wd px wide, centred on the path)
    l(x0, y0, x1, y1, c, wd = 1) {
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) || 1;
      for (let i = 0; i <= n; i++) {
        const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
        o.r(Math.round(x - wd / 2), Math.round(y - wd / 2), wd, wd, c);
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
    // 3-tone shading of colour c: lt where nothing is above, dk where nothing is below (dk2 one row higher)
    shade(c, lt, dk, dk2) {
      const s = g.map(r => r.slice()), at = (x, y) => x >= 0 && y >= 0 && x < w && y < h ? s[y][x] : '.';
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (s[y][x] !== c) continue;
        if (lt && at(x, y - 1) === '.') g[y][x] = lt;
        else if (dk && at(x, y + 1) === '.') g[y][x] = dk;
        else if (dk2 && at(x, y + 2) === '.') g[y][x] = dk2;
      }
      return o;
    },
    // 1px OUT outline around everything painted
    outline() {
      const s = g.map(r => r.slice()), at = (x, y) => x >= 0 && y >= 0 && x < w && y < h ? s[y][x] : '.';
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (s[y][x] === '.' && (at(x - 1, y) !== '.' || at(x + 1, y) !== '.' || at(x, y - 1) !== '.' || at(x, y + 1) !== '.')) g[y][x] = 'k';
      }
      return o;
    },
    sprite(pal) { return makeSprite(g.map(r => r.join('')), pal); }
  };
  return o;
}

// ============================================================
// The animals (art faces right; drawn facing the hero). Each kind: palette, grid size, anchor (ax = body centre,
// feet on the grid's second-to-last row, its outline on the ground), legs [hip x, far] and a painter for the
// body, head and tail; the shared builder adds the legs for each pose, shades, outlines and makes the sprites.
// ============================================================
// leg poses: per leg [foot dx, lift]; legs are ordered back far, back near, front far, front near
const GALLOP = [
  [[-4, 1], [-3, 0], [4, 2], [3, 0]],   // stretched out
  [[-1, 0], [1, 2], [1, 1], [-2, 0]],   // landing on the front legs
  [[2, 2], [3, 3], [-2, 2], [-3, 3]],   // gathered under the belly, off the ground
  [[-2, 0], [0, 1], [2, 1], [0, 0]]     // pushing off with the hind legs
];
function legPose(pose, i, len) {
  if (pose.legs === 'run') { const [dx, lift] = GALLOP[pose.f][i]; return [Math.round(dx * Math.min(1, len / 7)), Math.min(lift, len - 3)]; }
  if (pose.legs === 'jump') return i < 2 ? [-2, 2] : [2, 3];
  if (pose.legs === 'rear') return i < 2 ? [0, 0] : [3, 5];
  return [0, 0];
}
const POSES = {
  stand: { legs: 'stand', face: 'n', tail: 0 }, blink: { legs: 'stand', face: 'b', tail: 0 },
  look: { legs: 'stand', face: 'w', tail: 0 },
  happy: { legs: 'stand', face: 'h', tail: 0 }, wag: { legs: 'stand', face: 'h', tail: 1 },
  jump: { legs: 'jump', face: 'h', tail: 1 }, rear: { legs: 'rear', face: 'h', tail: 1 },
  run0: { legs: 'run', f: 0, face: 'h', tail: 2 }, run1: { legs: 'run', f: 1, face: 'h', tail: 2 },
  run2: { legs: 'run', f: 2, face: 'h', tail: 2 }, run3: { legs: 'run', f: 3, face: 'h', tail: 2 }
};

const KINDS = {
  // can de palleiro: a wolfish grey-brown Galician shepherd dog, darker saddle, cream chest, a red collar
  dog: {
    thanks: 'WOOF!', w: 30, h: 22, ax: 14, hip: 13, legLen: 7, cw: 30, ch: 26, head: [20, 1, 29, 12],
    legs: [[8, 1], [10, 0], [18, 1], [20, 0]], leg: 'c', legFar: 'b', foot: 'e', footFar: 'd',
    pal: { k: OUT, a: '#3e3128', b: '#685444', c: '#93775a', C: '#b89a72', D: '#6d5845', d: '#c9a87c', e: '#f0dcb8', n: '#1e1612', w: '#ffffff', p: '#f2848c', r: '#d8383c', y: '#ffd23f' },
    shade: [['c', 'C', 'D'], ['e', null, 'd']],
    paint(g, ps) {
      // tail: bushy, up and curled (wagging) or streaming back (running)
      const tl = [[7, 12, 4, 7, 2.5, 6], [7, 12, 6, 6, 4.5, 4.5], [7, 12, 2, 12, 1.5, 12.5]][ps.tail];
      g.l(tl[0], tl[1], tl[2], tl[3], 'c', 3).e(tl[4], tl[5], 1.6, 1.6, 'e');
      g.e(13.5, 13.3, 7, 3.6, 'c');                         // body
      g.e(12.5, 11.4, 5, 1.6, 'b');                         // dark saddle
      g.e(14, 16.2, 4.5, 0.9, 'e');                         // belly
      g.t([[17, 11], [20, 7.5], [24, 9.5], [22, 15], [17, 15]], 'c'); // neck
      g.e(20.6, 13.4, 1.8, 2.4, 'e');                       // cream chest
      g.e(22.4, 8.6, 3.4, 3, 'c');                          // skull
      g.r(24, 8, 4, 2, 'd').r(24, 10, 3, 1, 'e').p(27, 8, 'n'); // muzzle, jaw, nose
      g.t([[19, 7.5], [20, 2.5], [22, 6.5]], 'b');          // far ear
      g.t([[21, 7], [22.8, 1.8], [24.5, 6.5]], 'c').p(22.5, 4.5, 'p'); // near ear (pink inside)
      g.r(19, 11, 2, 1, 'r').r(20, 12, 2, 1, 'r').p(21, 13, 'y'); // collar and tag
    },
    face(g, f) {
      if (f === 'h') { g.p(22, 7, 'n').p(23, 6, 'n').p(24, 7, 'n'); g.r(25, 10, 2, 1, 'n').p(25, 11, 'p').p(26, 11, 'p'); }
      else if (f === 'b') g.r(22, 7, 3, 1, 'n');
      else if (f === 'w') g.p(23, 6, 'w').p(24, 6, 'n').p(24, 7, 'n');
      else g.p(23, 6, 'w').p(23, 7, 'n').p(24, 6, 'n').p(24, 7, 'n');
    }
  },
  // a fluffy white sheep with a black face and black legs
  sheep: {
    thanks: 'BAA!', w: 28, h: 21, ax: 13, hip: 14, legLen: 6, cw: 30, ch: 26, head: [18, 4, 26, 15],
    legs: [[7, 1], [9, 0], [16, 1], [18, 0]], leg: 'f', legFar: 'F', foot: 'k', footFar: 'k',
    pal: { k: OUT, f: '#3b3438', F: '#262125', g: '#5c5258', v: '#cfc5b4', V: '#b3a894', w: '#f1ece2', W: '#ffffff', n: '#141014', p: '#e8a0a8' },
    shade: [['w', 'W', 'v', 'V']],
    paint(g, ps) {
      const wb = ps.tail === 1 ? 1 : 0;
      g.e(3.5, 10 - wb, 1.8, 1.8, 'w');                    // tail puff
      g.e(12, 12, 8, 4.4, 'w');                            // woolly body: a cloud of puffs
      for (const [x, y, r] of [[5, 10, 3], [8.5, 7.8, 3], [12.5, 7.2, 3.2], [16.5, 8.2, 3], [19, 11, 3], [6.5, 14.5, 2.6], [12, 15.5, 2.6], [17, 14.5, 2.6]]) g.e(x, y, r, r, 'w');
      g.e(21.5, 10, 2.8, 3.5, 'f');                        // black face
      g.t([[19.5, 8], [16.8, 7.4], [17.5, 9.3]], 'f');     // ear sticking out
      g.e(20.6, 6.6, 2.4, 1.6, 'w');                       // wool topknot
    },
    face(g, f) {
      g.p(23, 12, 'g').p(24, 11, 'g');                     // nose
      if (f === 'h') { g.p(21, 9, 'W').p(22, 8, 'W').p(23, 9, 'W'); g.p(22, 12, 'p'); }
      else if (f === 'b') g.r(21, 9, 2, 1, 'g');
      else if (f === 'w') g.p(21, 9, 'W').p(21, 8, 'W').p(22, 9, 'n');
      else g.r(21, 8, 2, 2, 'W').p(22, 9, 'n');
      // curls in the wool
      for (const [x, y] of [[6, 9], [10, 7], [14, 8], [18, 10], [8, 13], [12, 11], [16, 13], [10, 15], [15, 16], [5, 13]]) if (g.at(x, y) === 'w') g.p(x, y, 'v');
    }
  },
  // garrano: a small dark-brown Galician pony with a thick black mane and tail and a pale nose
  pony: {
    thanks: 'NEIGH!', w: 34, h: 28, ax: 16, hip: 17, legLen: 9, cw: 36, ch: 34, head: [25, 0, 34, 12],
    legs: [[9, 1], [11, 0], [21, 1], [23, 0]], leg: 'c', legFar: 'a', foot: 'g', footFar: 'g', low: 'a',
    pal: { k: OUT, a: '#3a2416', c: '#6e4428', C: '#94603a', D: '#4c2e1a', m: '#c09468', M: '#8a6444', h: '#1c1512', H: '#3c302a', g: '#5e5a56', n: '#120c08', w: '#ffffff', p: '#f0a0a0' },
    shade: [['c', 'C', 'D'], ['m', null, 'M']],
    paint(g, ps) {
      // tail: thick black, swishing
      const sw = [0, 2, -3][ps.tail];
      g.l(8, 13, 5 + sw * 0.4, 18, 'h', 3).l(5 + sw * 0.4, 18, 4 + sw, 23, 'h', 2);
      g.e(16, 15.5, 8.6, 4.6, 'c');                        // body
      g.t([[20, 13], [24.5, 5.5], [28.5, 7], [26, 16], [20, 18]], 'c'); // neck
      g.e(27.5, 6.8, 2.8, 2.6, 'c');                       // head
      g.e(30.2, 9, 2.1, 1.8, 'm');                         // pale muzzle
      g.t([[25.5, 5], [26, 1.2], [27.6, 4.5]], 'c');       // ear
      g.l(26.5, 3.2, 20, 12.5, 'h', 3);                    // thick black mane along the neck
      g.l(25, 5.5, 22.5, 11, 'H', 1);
      g.p(28, 3.5, 'h').p(28.6, 4.6, 'h');                 // forelock
    },
    face(g, f) {
      g.p(31, 8, 'n');                                     // nostril
      if (f === 'h') { g.p(27, 6, 'n').p(28, 5, 'n').p(29, 6, 'n'); g.p(30, 10, 'n').p(31, 10, 'n'); }
      else if (f === 'b') g.r(27, 6, 3, 1, 'n');
      else if (f === 'w') g.p(28, 5, 'w').p(29, 5, 'n').p(29, 6, 'n');
      else g.p(28, 5, 'w').p(28, 6, 'n').p(29, 5, 'n').p(29, 6, 'n');
    }
  },
  // Rubia Galega: a golden-blonde cow with short pale horns and a bell on a red collar
  cow: {
    thanks: 'MOO!', w: 38, h: 26, ax: 17, hip: 17, legLen: 7, cw: 38, ch: 30, head: [27, 5, 37, 18],
    legs: [[8, 1], [10, 0], [24, 1], [26, 0]], leg: 'c', legFar: 'D', foot: 'a', footFar: 'a',
    pal: { k: OUT, a: '#4a3420', c: '#d6a256', C: '#f2c97c', D: '#a8742e', E: '#8a5e22', p: '#eba7a0', P: '#c98078', h: '#f4ead2', H: '#9a8a66', n: '#2a1a12', w: '#ffffff', r: '#c8323a', y: '#ffd23f', Y: '#fff2a0', z: '#b8860b' },
    shade: [['c', 'C', 'D', 'E'], ['p', null, 'P']],
    paint(g, ps) {
      const sw = [0, 2, -2][ps.tail];
      g.l(7, 11, 5 + sw * 0.5, 17, 'D', 1).e(5 + sw, 18.5, 1.2, 1.8, 'a'); // tail with its tuft
      g.r(8, 9, 18, 9, 'c').e(9, 13.4, 3, 4.4, 'c').e(25, 13.6, 3.2, 4.4, 'c'); // boxy body
      g.r(11, 9, 12, 1, 'C');
      g.e(30.2, 12.6, 3.3, 3.4, 'c');                      // head, a little lowered
      g.e(32.4, 15, 2.4, 1.9, 'p');                        // pink muzzle
      g.r(25, 10, 3, 1, 'c').p(24, 10, 'D');               // ear
      g.p(28, 9, 'h').p(28, 8, 'H');                       // far horn
      g.p(30, 9, 'h').p(31, 8, 'h').p(32, 8, 'H');         // near horn: short, curving up and forward
      g.l(27, 15, 28.4, 17.5, 'r', 1);                     // collar
      const bs = ps.tail === 1 ? 1 : ps.tail === 2 ? -1 : 0;                // the bell swings
      g.e(28.2 + bs, 19.3, 1.6, 1.8, 'y').p(27.6 + bs, 18.6, 'Y').p(28.6 + bs, 20.6, 'z');
    },
    face(g, f) {
      g.p(33, 14, 'n');                                    // nostril
      if (f === 'h') { g.p(30, 11, 'n').p(31, 10, 'n').p(32, 11, 'n'); g.r(31, 16, 2, 1, 'n'); }
      else if (f === 'b') g.r(30, 11, 3, 1, 'n');
      else if (f === 'w') g.p(31, 10, 'w').p(32, 10, 'n').p(32, 11, 'n');
      else g.p(31, 10, 'w').p(31, 11, 'n').p(32, 10, 'n').p(32, 11, 'n');
    }
  },
  // a plump brown hen: red comb and wattle, yellow beak and legs (a biped: legs painted here)
  hen: {
    thanks: 'CLUCK!', w: 20, h: 20, ax: 9, hip: 13, legLen: 5, cw: 26, ch: 24, head: [10, 0, 18, 10], biped: true,
    pal: { k: OUT, c: '#b8641f', C: '#dc8a44', D: '#80420f', b: '#5a2e12', B: '#7a4420', t: '#3a2614', r: '#e3302a', R: '#ff6a5a', y: '#f2b630', n: '#140c08', w: '#ffffff', e: '#f0c890' },
    shade: [['c', 'C', 'D'], ['b', 'B', null]],
    paint(g, ps) {
      // legs: two thin yellow legs with toes, stepping in turn when running, tucked up when jumping
      const run = ps.legs === 'run', st = run ? [[1, 0], [-1, 1], [-1, 0], [1, 1]][ps.f] : [0, 0], d = ps.legs === 'jump' ? 2 : 0;
      for (const [lx, sx, up] of [[7, st[0], st[1]], [10, -st[0], run ? 1 - st[1] : 0]]) g.r(lx + sx, 14, 1, 4 - up - d, 'y').r(lx + sx - 1, 17 - up - d, 3, 1, 'y');
      g.t([[3.5, 11], [1.2, 4.5], [3.6, 3.4], [6.5, 9]], 't'); // tail feathers
      g.p(2, 5, 'b').p(3, 4, 'b');
      g.e(8.6, 10.8, 5.6, 4.2, 'c');                       // body
      g.e(13, 6.6, 2.7, 2.8, 'c');                         // head
      g.e(11.6, 11.5, 2, 2.3, 'e');                        // pale breast
      g.r(12, 2.6, 3, 2, 'r').p(12, 2, 'r').p(14, 2, 'r'); // comb
      g.p(15, 8, 'r').p(15, 9, 'r');                       // wattle
      g.r(15, 6, 2, 1, 'y').p(16, 7, 'y');                 // beak
      // wing: folded, or flapping up when tail === 1 (the jump and the salute)
      if (ps.tail === 1) g.t([[5, 10], [6.5, 4.5], [10.5, 6], [10, 10.5]], 'b');
      else g.e(7.8, 10.6, 3.2, 2.2, 'b');
    },
    face(g, f) {
      if (f === 'h') { g.p(13, 6, 'n').p(14, 5, 'n'); }
      else if (f === 'b') g.r(13, 6, 2, 1, 'n');
      else g.p(14, 5, 'n').p(13, 5, 'w');
    }
  },
  // a white goat with a brown head, neck and saddle, little swept-back horns and a beard
  goat: {
    thanks: 'MEEEH!', w: 30, h: 25, ax: 14, hip: 15, legLen: 8, cw: 30, ch: 28, head: [20, 0, 29, 14],
    legs: [[8, 1], [10, 0], [18, 1], [20, 0]], leg: 'w', legFar: 'v', foot: 'a', footFar: 'a',
    pal: { k: OUT, a: '#3a3430', w: '#efebe2', W: '#ffffff', v: '#c8c0b0', V: '#aaa292', c: '#8c5a32', C: '#b07a48', D: '#64401f', m: '#d8b88e', h: '#8e8474', H: '#5e564a', n: '#16100c', y: '#e8c84a', p: '#e8a0a0' },
    shade: [['w', 'W', 'v', 'V'], ['c', 'C', 'D']],
    paint(g, ps) {
      const up = ps.tail === 1 ? 1 : 0;
      g.l(7, 12, 4.5, 9.5 - up, 'w', 2);                   // short perky tail
      g.e(13.5, 14, 7.2, 3.9, 'w');                        // body
      g.e(12.5, 12.5, 4.2, 2.2, 'c');                      // brown saddle
      g.t([[17, 13], [20, 6.5], [24, 8.5], [22, 16], [17, 16]], 'c'); // neck
      g.e(23, 6.6, 2.5, 2.4, 'c');                         // head
      g.e(25.6, 8.2, 1.9, 1.5, 'm');                       // muzzle
      g.t([[23.5, 9], [25.6, 9], [24.4, 13]], 'w');        // beard
      g.t([[21, 6], [18.2, 7.4], [20.6, 8]], 'c');         // ear, drooping sideways
      g.l(21.5, 4.6, 19.6, 1.4, 'h', 1).p(19, 1.2, 'H');  // horns, swept back
      g.l(23, 4.4, 21.6, 1.2, 'h', 1).p(21, 1, 'H');
    },
    face(g, f) {
      g.p(27, 8, 'n');                                     // nose
      if (f === 'h') { g.p(23, 6, 'n').p(24, 5, 'n').p(25, 6, 'n'); g.p(26, 10, 'p'); }
      else if (f === 'b') g.r(23, 6, 3, 1, 'n');
      else if (f === 'w') g.r(24, 5, 2, 1, 'y').p(24, 6, 'n');
      else g.r(23, 5, 2, 2, 'y').r(23, 6, 2, 1, 'n');      // goat eyes: yellow with a dark slot
    }
  }
};

// paint one pose of one animal into a sprite
function beastSprite(K, ps) {
  const g = grid(K.w, K.h), feet = K.h - 2;
  if (!K.biped) {
    const leg = (i, near) => {
      const [hx, far] = K.legs[i];
      if (!!far === near) return;
      const [dx, lift] = legPose(ps, i, K.legLen), fy = feet - lift, top = K.hip, n = fy - top;
      for (let y = top; y <= fy; y++) {
        const x = Math.round(hx + dx * (y - top) / Math.max(1, n));
        const c = y === fy ? (far ? K.footFar : K.foot) : K.low && y > fy - 4 ? K.low : far ? K.legFar : K.leg;
        g.r(x, y, 2, 1, c);
      }
    };
    for (let i = 0; i < 4; i++) leg(i, false);
    K.paint(g, ps);
    for (let i = 0; i < 4; i++) leg(i, true);
  } else K.paint(g, ps);
  K.face(g, ps.face);
  for (const s of K.shade) g.shade(...s);
  g.outline();
  return g.sprite(K.pal);
}
for (const k in KINDS) {
  const K = KINDS[k];
  K.fr = {};
  for (const name in POSES) K.fr[name] = beastSprite(K, POSES[name]);
}

// ============================================================
// Cage parts that fly off when it bursts (sprites for G.parts 'sprite' particles)
// ============================================================
const CAGE_PAL = { k: OUT, m: MET, l: METL, d: METD, D: METDD, y: '#f1c40f', r: EVIL, R: '#ffb3a8' };
const BAR_SPR = makeSprite(['klk', 'klk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kmk', 'kdk', 'kdk'], CAGE_PAL);
const PLATE_SPR = makeSprite(['kkkkkkkkkkkkkkkk', 'kllllllllllllllk', 'kmdmmmmdmmmmmdmk', 'kddddddddddddddk', 'kkkkkkkkkkkkkkkk'], CAGE_PAL);
const BASE_SPR = makeSprite(['kkkkkkkkkkkk', 'kyyDDyyDDyyk', 'kyDDyyDDyyDk', 'kkkkkkkkkkkk'], CAGE_PAL);
const EYE_SPR = makeSprite(['..kkkk..', '.kllllk.', 'kmmmmmmk', 'kmkrRkmk', 'kmkrrkmk', 'kddddddk', '.kkkkkk.'], CAGE_PAL);

// ============================================================
// Animals in robot cages (POW kinds): 'tied' = in the cage (nervous: looks around, shivers, hops when the hero
// comes close); freed = the cage bursts (bars fly, a pop), the animal hops out with hearts; 'salute' = its own
// happy move and call; 'run' = off to the left, back home (the engine moves it)
// ============================================================
const SOUNDS = {
  dog(d) { Snd.tone('square', 420, 230, 0.09, 0.14, d); Snd.noise(0.06, 0.1, 1400, d); Snd.tone('square', 460, 250, 0.1, 0.14, d + 0.14); Snd.noise(0.06, 0.1, 1400, d + 0.14); },
  sheep(d) { for (let i = 0; i < 7; i++) Snd.tone('sawtooth', i % 2 ? 470 : 430, i % 2 ? 450 : 410, 0.07, 0.13, d + i * 0.06); },
  pony(d) { for (let i = 0; i < 9; i++) Snd.tone('sawtooth', 1050 - i * 55 + (i % 2) * 70, 1000 - i * 55, 0.07, 0.12, d + i * 0.06); },
  cow(d) { Snd.tone('sawtooth', 165, 120, 0.8, 0.15, d); Snd.tone('square', 82, 60, 0.8, 0.09, d); Snd.tone('triangle', 1480, 1480, 0.25, 0.11, d + 0.05); Snd.tone('triangle', 1980, 1980, 0.2, 0.07, d + 0.3); },
  hen(d) { for (let i = 0; i < 3; i++) Snd.tone('square', 760, 560, 0.05, 0.08, d + i * 0.09); Snd.tone('square', 900, 1250, 0.14, 0.08, d + 0.3); },
  goat(d) { for (let i = 0; i < 9; i++) Snd.tone('sawtooth', i % 2 ? 660 : 610, i % 2 ? 640 : 590, 0.055, 0.13, d + i * 0.05); }
};
function popSound() { Snd.noise(0.14, 0.2, 3200); Snd.tone('square', 900, 180, 0.16, 0.07); Snd.tone('triangle', 1200, 1800, 0.12, 0.05, 0.05); }

// the cage: the back bars before the animal, the posts, bars, top plate, hazard base and lock-eye after it
function cageBack(K) {
  const x0 = -(K.cw >> 1), top = -K.ch, n = Math.max(2, Math.round(K.cw / 8) - 1);
  ctx.globalAlpha = 0.55;
  R(x0 + 2, top + 4, K.cw - 4, 1, METD);
  for (let i = 0; i <= n; i++) R(x0 + Math.round((i + 0.5) * K.cw / (n + 1)), top + 4, 1, K.ch - 8, METD);
  ctx.globalAlpha = 1;
}
function cageFront(K, o, near, rattle) {
  const x0 = -(K.cw >> 1), x1 = x0 + K.cw, top = -K.ch + rattle, bh = K.ch - 6 - rattle, n = Math.max(2, Math.round(K.cw / 8) - 1);
  // bars: a dark edge and a lit edge, so the animal shows between them
  for (let i = 1; i <= n; i++) { const x = x0 + Math.round(i * K.cw / (n + 1)) - 1; R(x, top + 3, 1, bh, OUT); R(x + 1, top + 3, 1, bh, METL); R(x + 1, top + bh, 1, 3, MET); }
  // corner posts
  for (const px of [x0, x1 - 2]) { RO(px, top + 2, 2, bh + 1, MET); R(px, top + 2, 1, bh + 1, METL); }
  // top plate with rivets
  RO(x0 - 1, top, K.cw + 2, 3, METD); R(x0 - 1, top, K.cw + 2, 1, METL);
  for (let x = x0 + 2; x < x1 - 1; x += 5) R(x, top + 1, 1, 1, METDD);
  // base: hazard stripes
  RO(x0 - 1, -4, K.cw + 2, 4, METDD);
  for (let r = 0; r < 3; r++) for (let x = x0 - 1 + ((r + 4) & 3); x < x1 + 1; x += 4) R(x, -3 + r, Math.min(2, x1 + 1 - x), 1, '#f1c40f');
  R(x0 - 1, -4, K.cw + 2, 1, '#6a737e');
  // the robot lock-eye on top: blinks, faster with the hero close, and watches him
  const look = G.p ? clamp(Math.round((G.p.x - o.x) / 40), -1, 1) : 0, rate = near ? 8 : 24, on = Math.floor((o.t + o.id * 7) / rate) % 2 === 0;
  blob([[-4, top - 4, 8, 4], [-3, top - 5, 6, 1]], METD); R(-3, top - 4, 6, 1, METL); R(-4, top - 1, 8, 1, METDD);
  RO(-2, top - 3, 4, 2, '#2a0c0c'); R(-1 + look, top - 3, 2, 2, on ? EVIL : '#7a1f1f'); if (on) R(-1 + look, top - 3, 1, 1, '#ffd0cc');
  R(0, top - 8, 1, 3, METDD); R(0, top - 9, 1, 1, on ? EVIL : '#5a1a1a');
}

// a little heart (5x4 + outline) for the happy animals
const HEART5 = ['.x.x.', 'xxxxx', '.xxx.', '..x..'];
function heart(x, y, c) {
  for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) if (HEART5[r][i] === 'x') R(x + i - 1, y + r - 1, 3, 3, OUT);
  for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) if (HEART5[r][i] === 'x') R(x + i, y + r, 1, 1, r === 0 && i < 2 ? '#ffc2cc' : c);
}
function sparkle(x, y, s, c) { R(x - s, y, s * 2 + 1, 1, c); R(x, y - s, 1, s * 2 + 1, c); }

// draw one animal sprite with the feet at (dx, dy), facing f, optionally rotated round its hind feet; headOnly draws
// just the head (over the cage bars: the face pressed between them)
function beast(K, fr, f, dx, dy, rot, headOnly) {
  const s = K.fr[fr], oy = -(s.h - 1);
  ctx.save(); ctx.translate(Math.round(dx), Math.round(dy)); ctx.scale(f, 1);
  if (rot) { const px = -K.ax + 6; ctx.translate(px, 0); ctx.rotate(rot); ctx.translate(-px, 0); }
  if (headOnly) { const [x0, y0, x1, y1] = K.head; ctx.beginPath(); ctx.rect(x0 - K.ax, y0 + oy, x1 - x0, y1 - y0); ctx.clip(); }
  spr(s, -K.ax, oy);
  ctx.restore();
}

function drawTied(K, o) {
  const p = G.p, t = o.t + o.id * 37, near = !!p && !p.dead && Math.abs(p.x - o.x) < 150;
  let face = -1, fr = 'stand', dx = 0, dy = 0, rattle = 0, peek = near;
  if (near) {
    // excited: watches the hero and hops, the cage rattles when it lands
    face = p.x < o.x ? -1 : 1;
    const h = t % 34;
    if (h < 12) { dy = -Math.round(Math.sin(h / 12 * Math.PI) * 4); fr = 'jump'; }
    else fr = (t >> 3) % 2 ? 'wag' : 'happy';
    if (h >= 12 && h < 15) rattle = 1;
  } else {
    // nervous: peeks out between the bars, looks back over its shoulder, shivers, blinks
    const ph = t % 240;
    if (ph >= 40 && ph < 96) { dx = -Math.round(Math.sin((ph - 40) / 56 * Math.PI) * 3.4); fr = 'look'; peek = dx < -1; }
    else if (ph >= 140 && ph < 180) face = 1;
    else if (ph >= 200 && ph < 218) dx = (t >> 1) % 2 ? -1 : 0;
    if (t % 150 < 6) fr = 'blink';
  }
  cageBack(K);
  beast(K, fr, face, dx, -4 + dy, 0);
  cageFront(K, o, near, rattle);
  if (peek && face < 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(-(K.cw >> 1) - 8, -K.ch + 3 + rattle, K.cw + 16, K.ch); ctx.clip();
    beast(K, fr, face, dx, -4 + dy, 0, true);
    ctx.restore();
  }
}
// HELP! in a speech bubble over a tied animal's cage, on and off (world space; VIGO.drawOverlay draws it over the
// weather, so rain, petals and butterflies never cover it)
function helpBubble(K, o) {
  const t = o.t + o.id * 37;
  if (Math.floor(t / 40) % 2) return;
  const by = -K.ch - 23 + (Math.floor(t / 10) % 2);
  ctx.save(); ctx.translate(Math.round(o.x), Math.round(o.y));
  RO(-16, by, 33, 11, '#ffffff'); R(-16, by + 10, 33, 1, '#d8dce6');
  R(-2, by + 11, 5, 1, '#ffffff'); R(-1, by + 12, 3, 1, '#ffffff'); R(0, by + 13, 1, 1, '#ffffff');
  R(-3, by + 11, 1, 1, OUT); R(3, by + 11, 1, 1, OUT); R(-2, by + 12, 1, 1, OUT); R(2, by + 12, 1, 1, OUT); R(-1, by + 13, 1, 1, OUT); R(1, by + 13, 1, 1, OUT); R(0, by + 14, 1, 1, OUT);
  text('HELP!', 1, by + 2, '#e0302a', 1, 'center', null);
  ctx.restore();
}

// freed: hop out, then each animal's own happy move (the salute), then run home
function drawFreed(k, K, o) {
  const t = o.t;
  let face = -1, fr = 'happy', dx = 0, dy = 0, rot = 0;
  if (o.state === 'free') {
    const u = t / 24;
    dy = -Math.round(Math.sin(u * Math.PI) * 10 + 4 * (1 - u));
    fr = u > 0.08 && u < 0.92 ? 'jump' : 'wag';
    // the burst: a white flash where the cage was, fading
    if (t < 6) { ctx.globalAlpha = 0.9 - t * 0.15; pdisc(0, -(K.ch >> 1), 14 - t * 2, '#fffbe8'); ctx.globalAlpha = 1; }
  } else if (o.state === 'salute') {
    const s = t - 24;
    switch (k) {
      case 'dog': { // a spinning jump, tongue out, tail going
        const u = Math.min(1, s / 26);
        dy = -Math.round(Math.sin(u * Math.PI) * 12);
        if (s < 26) { face = Math.floor(s / 4) % 2 ? 1 : -1; fr = 'jump'; } else fr = (s >> 2) % 2 ? 'wag' : 'happy';
        break;
      }
      case 'sheep': // boing boing boing
        dy = -Math.round(Math.abs(Math.sin(s * 0.24)) * 7);
        fr = dy < -1 ? 'jump' : 'happy';
        break;
      case 'pony': { // rears up on its hind legs
        const u = clamp(s / 30, 0, 1);
        rot = -Math.sin(u * Math.PI) * 0.55;
        fr = s < 30 ? 'rear' : 'happy';
        break;
      }
      case 'cow': // a happy hop, the bell swinging
        dy = -Math.round(Math.abs(Math.sin(s * 0.16)) * 5);
        fr = dy < -1 ? 'jump' : (s >> 2) % 2 ? 'wag' : 'happy';
        break;
      case 'hen': // flaps and hops
        dy = -Math.round(Math.abs(Math.sin(s * 0.3)) * 6);
        fr = (s >> 1) % 2 ? 'jump' : 'happy';
        break;
      case 'goat': { // a big twisting leap
        const u = Math.min(1, s / 28);
        dy = -Math.round(Math.sin(u * Math.PI) * 13);
        rot = s < 28 ? Math.sin(u * Math.PI * 2) * 0.3 : 0;
        fr = s < 28 ? 'jump' : 'happy';
        break;
      }
    }
  } else {
    // run home: legs going, a little bounce
    const sp = k === 'hen' ? 2 : k === 'dog' ? 3 : 4, f = Math.floor(t / sp) % 4;
    fr = 'run' + f;
    dy = k === 'sheep' || k === 'goat' ? -Math.round(Math.abs(Math.sin(t * 0.35)) * 3) : -(f % 2);
    // dust kicked up behind: each puff stays where it was made while the animal runs on (2.2 px a frame)
    for (let i = 0; i < 3; i++) {
      const age = (t % 7) + i * 7, r = 1 + (age >> 3);
      if (age > 18) continue;
      ctx.globalAlpha = 0.55 * (1 - age / 19);
      pdisc(Math.round(K.ax * 0.6 + age * 2.2), -1 - (age >> 2), r, '#e2d2b0');
    }
    ctx.globalAlpha = 1;
  }
  beast(K, fr, face, dx, dy, rot);
  // hearts floating up, sparkles round it
  if (t < 90) for (let i = 0; i < 4; i++) {
    const a = t - i * 12;
    if (a < 0 || a > 46) continue;
    const hx = Math.round((hsh(o.id * 7 + i) - 0.5) * 22 + Math.sin(a * 0.15 + i) * 3), hy = Math.round(-K.ch * 0.6 - 6 - a * 0.55);
    if (a < 40 || a % 4 < 2) heart(hx - 2, hy, i % 2 ? '#ff5a7a' : '#ff3b5c');
  }
  if (t < 30) for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + t * 0.05, r = 6 + t * 0.7;
    if ((t + i) % 4 < 3) sparkle(Math.round(Math.cos(a) * r), Math.round(-K.ch / 2 + Math.sin(a) * r * 0.7), t < 15 ? 1 : 0, i % 2 ? '#ffe066' : '#ffffff');
  }
}

// the cage bursting: bars, plate, base halves and the lock-eye fly off (engine particles), sparks, smoke, a ring
function burst(K, o) {
  const x0 = o.x - (K.cw >> 1), cy = o.y - K.ch / 2, life = 64;
  const part = (s, x, y, vx, vy, vr) => G.parts.push({ type: 'sprite', s, x, y, vx, vy, g: 0.22, rot: rand(-0.3, 0.3), vr, life, max: life });
  for (let x = 7; x <= K.cw - 8; x += 6) { const side = x < K.cw / 2 ? -1 : 1; part(BAR_SPR, x0 + x, cy, side * rand(1.2, 2.6), rand(-3.8, -2.2), rand(-0.35, 0.35)); }
  part(BAR_SPR, x0 + 1, cy, -rand(1.6, 2.4), rand(-3, -2), -0.3); part(BAR_SPR, x0 + K.cw - 2, cy, rand(1.6, 2.4), rand(-3, -2), 0.3);
  part(PLATE_SPR, o.x, o.y - K.ch, rand(-0.6, 0.6), -4.4, rand(-0.25, 0.25));
  part(EYE_SPR, o.x, o.y - K.ch - 5, rand(-1.2, 1.2), -5.6, rand(0.3, 0.5) * (rand(0, 1) < 0.5 ? -1 : 1));
  part(BASE_SPR, o.x - K.cw / 4, o.y - 2, -rand(0.8, 1.4), -1.8, -0.15); part(BASE_SPR, o.x + K.cw / 4, o.y - 2, rand(0.8, 1.4), -1.8, 0.15);
  sparks(o.x, o.y - K.ch, 10, '#ffe066'); sparks(o.x, cy, 6, '#ffffff');
  for (let i = 0; i < 5; i++) G.parts.push({ type: 'smoke', x: o.x + rand(-K.cw / 2, K.cw / 2), y: o.y - rand(2, K.ch), vx: rand(-0.6, 0.6), vy: rand(-0.8, -0.2), life: rand(26, 40), max: 40, size: rand(3, 5) });
  G.rings.push({ x: o.x, y: cy, r: K.cw * 0.8, t: 0, max: 12 });
  G.shake = Math.max(G.shake, 1.5);
}

for (const k of Object.keys(KINDS)) {
  const K = KINDS[k];
  POW_KINDS[k] = {
    thanks: K.thanks,
    // the cage and its lock-eye: tall enough for standing shots on the slopes
    box: o => ({ x: o.x - (K.cw >> 1), y: o.y - K.ch - 5, w: K.cw, h: K.ch + 5 }),
    draw(o) {
      ctx.save(); ctx.translate(Math.round(o.x), Math.round(o.y));
      if (o.state === 'tied') drawTied(K, o); else drawFreed(k, K, o);
      ctx.restore();
    },
    // the pop now, the animal's call as it hops out to salute
    onFree(o) { burst(K, o); popSound(); SOUNDS[k](0.36); }
  };
}
// an animal's item thrown to where the hero will be when it lands (38 frames on), never off screen; a hero further
// away than that throw reaches (across a locked screen, up on a boulder) gets a higher, longer lob, up to 80 frames
function toss(it) {
  const p = G.p, v = p.ride ? p.ride.vx : p.vx, at = T => clamp(p.x + v * T, G.cam.x + 24, G.cam.x + W - 24);
  const T = clamp(Math.ceil(Math.abs(at(38) - it.x) / 4), 38, 80);
  it.tossed = true; it.vy = -3.4 * T / 38; it.vx = clamp((at(T) - it.x) / T, -4, 4);
}

// ============================================================
// Intro (about 5.6 s): the camera at the house, morning calm (smoke, sparrows on the horreo roof, a caption with
// the Galician flag). The door creaks open (G.introDoor), the hero steps out of the doorway (G.p.hidden) onto the
// plateau (G.introKeys), the door shuts behind with a thud, the hero glances back, then looks out over the ria:
// "WHAT A VIEW!". Two robot eagles scream across the sky (the sparrows flee, the hero aims up at them), a wolf
// howls far down the hill, then MISSION 2 START! Letterbox bars slide in and out. Enter skips to the banner (the
// bottom bar says so once the caption has gone; only Enter, so shooting or jumping never skips by accident).
// ============================================================
const IT = { door: 46, doorLen: 30, show: 70, walk: 84, walkLen: 46, close: 116, closeLen: 24, back: 141, front: 156,
  say0: 158, eagles: 200, up0: 238, up1: 276, go: 280, banner: 294, out: 308, end: 338 };
const BARS = 33;
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
function creak() { Snd.tone('sawtooth', 210, 330, 0.16, 0.12); Snd.tone('sawtooth', 330, 240, 0.14, 0.12, 0.16); Snd.tone('sawtooth', 250, 360, 0.2, 0.1, 0.3); Snd.noise(0.5, 0.12, 900); }
function thud() { Snd.tone('sine', 130, 48, 0.2, 0.32); Snd.noise(0.1, 0.12, 700); }
function chirp(d) { Snd.tone('sine', 2900, 3700, 0.05, 0.04, d); Snd.tone('sine', 3100, 4000, 0.05, 0.04, d + 0.08); }
function howl(d) { Snd.tone('triangle', 330, 560, 0.45, 0.06, d); Snd.tone('triangle', 560, 420, 0.8, 0.06, d + 0.45); Snd.tone('sawtooth', 165, 280, 0.45, 0.015, d); Snd.tone('sawtooth', 280, 210, 0.8, 0.015, d + 0.45); }
function screech(d) { Snd.tone('sawtooth', 1900, 1250, 0.38, 0.045, d); Snd.tone('square', 2500, 1600, 0.3, 0.02, d + 0.02); Snd.noise(0.25, 0.04, 6000, d); }

// two sparrows on the horreo ridge (world x, y), fleeing up and away when the eagles come
const SPARROWS = [[205, 109, 0], [228, 110, 1]];
const SPARROW = (() => {
  const pal = { k: OUT, b: '#8a5a34', B: '#b07e50', t: '#5a3a20', c: '#efe0c4', n: '#120c08', y: '#f2b134' };
  const make = f => {
    const g = grid(12, 9), hy = f === 1 ? 4.6 : 3.2;
    g.l(3.2, 4.4, 1, 3, 't', 2);                                  // tail
    g.e(5.4, 5, 2.9, 2.1, 'b');                                   // body
    g.e(8, hy, 1.8, 1.8, 'b');                                    // head
    g.e(6, 6.2, 2, 0.9, 'c');                                     // pale belly
    if (f === 2) g.t([[4, 4.5], [5.2, 0.4], [7.2, 4.5]], 't');    // wings up
    else if (f === 3) g.t([[4, 5], [5.2, 8.6], [7.2, 5]], 't');   // wings down
    else g.e(5, 4.6, 1.9, 1.1, 't');                              // folded wing
    if (f < 2) g.p(5, 7, 'y').p(7, 7, 'y');                       // feet
    g.shade('b', 'B', null);
    g.p(8.6, hy - 0.6, 'n').p(10, hy + 0.3, 'y');                 // eye, beak
    g.outline();
    return g.sprite(pal);
  };
  return [make(0), make(1), make(2), make(3)];
})();
function sparrow(x, y, f, face) {
  // f: 0 sitting, 1 pecking, 2 wings up, 3 wings down; (x, y) = the feet
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(face, 1);
  spr(SPARROW[f], -6, -8);
  ctx.restore();
}
// the tiny Galician flag (white, one light-blue diagonal band) for the location caption
function gFlag(x, y) {
  RO(x, y, 11, 7, '#ffffff');
  for (let i = 0; i < 11; i++) R(x + i, y + Math.floor(i * 6 / 11), 1, 2, '#5aaee8');
  R(x - 2, y - 1, 1, 10, '#d8d8d8');
}

function makeIntro() {
  let t = 0, skipped = false, eagleOK = true;
  const at = n => t === n;
  // where the two eagles are at frame t: in from the right, swooping low over the hero, up and away left
  const eaglePos = i => {
    const s = t - IT.eagles - i * 16, x = 520 + i * 26 - s * 6.2;
    const u = clamp((520 - x) / 560, 0, 1);
    return { x, y: 46 + i * 12 + Math.sin(u * Math.PI) * 30 - u * u * 18, s };
  };
  return {
    start() {
      t = 0; skipped = false;
      G.introDoor = 0; G.introKeys = {}; G.p.hidden = true; G.p.facing = 1;
    },
    update() {
      t++;
      const p = G.p;
      // Enter skips to the start banner: hero outside, door shut
      if (!skipped && t > 10 && t < IT.go && pressed.Enter) {
        skipped = true; t = IT.go;
        p.hidden = false; G.introDoor = 0;
        if (p.x < 180) { p.x = 190; p.y = groundAt(p.x); }
      }
      // sound and story beats
      if (at(14)) chirp(0);
      if (at(32)) chirp(0.05);
      if (at(IT.door)) creak();
      if (at(IT.show)) p.hidden = false;
      if (at(IT.close + IT.closeLen)) { thud(); dust(120, 176, 3); }
      if (at(IT.eagles + 4)) screech(0);
      if (at(IT.eagles + 22)) screech(0.02);
      if (at(IT.go - 16)) howl(0);                       // far away down the hill: the wolves are coming
      if (at(IT.go)) { G.big = { s: VIGO.startText, t: 130 }; say(VIGO.startSay); }
      if (at(IT.banner)) G.banner = { s: SECTIONS[0].name, t: 200 };
      // the door: eased open, held, eased shut
      if (!skipped) {
        G.introDoor = t < IT.door ? 0 : t < IT.door + IT.doorLen ? ease((t - IT.door) / IT.doorLen)
          : t < IT.close ? 1 : Math.max(0, 1 - ease((t - IT.close) / IT.closeLen));
      }
      // the hero: out of the door, a glance back at the thud, then aiming up at the eagles going over
      G.introKeys = {
        right: (!skipped && t > IT.walk && t <= IT.walk + IT.walkLen) || at(IT.front),
        left: at(IT.back),
        up: t >= IT.up0 && t < IT.up1
      };
      if (t < IT.end) return false;
      p.hidden = false; G.introDoor = 0; G.introKeys = {};
      return true;
    },
    draw() {
      const cx = Math.round(G.cam.x);
      ctx.save(); ctx.translate(-cx, 0);
      // sparrows: pecking on the ridge, then away when the eagles scream
      const flee = t - IT.eagles - 6;
      for (const [sx, sy, i] of SPARROWS) {
        if (flee < 0) {
          const pk = (t + i * 23) % 70;
          sparrow(sx + (pk > 50 && pk < 56 ? 1 : 0), sy, pk > 30 && pk < 44 && (pk >> 2) % 2 ? 1 : 0, (t + i * 40) % 160 < 90 ? 1 : -1);
        } else if (flee < 120) {
          const fx = sx - flee * (1.6 + i * 0.4), fy = sy - flee * (1.1 + i * 0.3) - Math.sin(flee * 0.3) * 2;
          sparrow(fx, fy, (flee >> 2) % 2 ? 2 : 3, -1);
        }
      }
      // the hero takes in the view, then "!" when the eagles scream
      if (t >= IT.say0 && t < IT.eagles + 6 && !G.p.hidden) {
        const bx = Math.round(G.p.x) + 2, by = Math.round(G.p.y) - 58 + (t < IT.say0 + 4 ? IT.say0 + 4 - t : 0);
        RO(bx - 38, by, 77, 13, '#ffffff'); R(bx - 38, by + 12, 77, 1, '#d8dce6');
        R(bx - 6, by + 13, 4, 1, '#ffffff'); R(bx - 5, by + 14, 2, 1, '#ffffff');
        R(bx - 7, by + 13, 1, 1, OUT); R(bx - 2, by + 13, 1, 1, OUT); R(bx - 6, by + 14, 1, 1, OUT); R(bx - 3, by + 14, 1, 1, OUT); R(bx - 5, by + 15, 2, 1, OUT);
        text('WHAT A VIEW!', bx + 1, by + 3, '#2a3a6a', 1, 'center', null);
      }
      const ex = t - IT.eagles - 6;
      if (ex >= 0 && ex < 34 && !G.p.hidden) text('!', Math.round(G.p.x) + 1, Math.round(G.p.y) - 50 - (ex < 6 ? 6 - ex : 0), '#ffe066', 2, 'center');
      // the robot eagles
      for (let i = 0; i < 2; i++) {
        const q = eaglePos(i);
        if (q.s < 0 || q.x < -40 || q.x > 540) continue;
        const e = { type: 'eagle', x: q.x + cx, y: q.y, facing: -1, t: t + i * 9, st: q.s, hitT: 0, state: 'glide', glide: false, flap: (q.s * 0.055 + i * 0.4) % 1, cry: q.s < 18 || (q.s > 30 && q.s < 44) ? 6 : 0, alt: q.y };
        if (eagleOK && ENEMY_TYPES.eagle) {
          try { ENEMY_TYPES.eagle.draw(e); } catch (err) { eagleOK = false; FLASH = false; ctx.setTransform(1, 0, 0, 1, -cx, 0); errorOnce(err); }
        } else {
          // stand-in silhouette: a steel V with a red eye
          const wy = Math.round(Math.sin(q.s * 0.35) * 4), x = Math.round(e.x), y = Math.round(e.y);
          ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x - 20, y - 8 - wy); ctx.lineTo(x, y - 4); ctx.lineTo(x + 20, y - 8 - wy); ctx.lineTo(x, y); ctx.fill();
          RO(x - 6, y - 6, 12, 5, MET); R(x - 7, y - 5, 2, 2, EVIL);
        }
      }
      ctx.restore();
      // letterbox bars: slide in at the start, out at the end
      const k = t < 10 ? ease(t / 10) : t > IT.out ? 1 - ease((t - IT.out) / (IT.end - IT.out)) : 1;
      const bh = Math.round(BARS * k);
      if (bh > 0) {
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
        ctx.fillStyle = '#1c1c2a'; ctx.fillRect(0, bh - 1, W, 1); ctx.fillRect(0, H - bh, W, 1);
        // where we are: a caption in the bottom bar, fading in and out
        const ca = Math.min(1, (t - 20) / 16, (130 - t) / 16);
        if (ca > 0) {
          ctx.globalAlpha = ca;
          gFlag(W / 2 - 52, H - bh + 13);
          text('VIGO, GALICIA', W / 2 + 8, H - bh + 13, '#f4e2b8', 1, 'center', null);
          ctx.globalAlpha = 1;
        }
        // then, while Enter can still skip the intro, say so
        const sa = skipped ? 0 : Math.min(1, (t - 134) / 12, (IT.go - t) / 8);
        if (sa > 0) {
          ctx.globalAlpha = sa;
          text('ENTER: SKIP', W - 8, H - bh + 13, '#9aa3c0', 1, 'right', null);
          ctx.globalAlpha = 1;
        }
      }
    }
  };
}

// ============================================================
// Stand-in drawing, used only while level2_sky.js / level2_world.js don't provide their L2 hooks
// ============================================================
// Sky, the far shore of the ria and the sea (screen space; paints the whole canvas)
function fallbackBG(cx) {
  const g = ctx.createLinearGradient(0, 0, 0, 150);
  g.addColorStop(0, '#4f9fe0'); g.addColorStop(1, '#d6f0ff');
  ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = 'rgba(255,240,190,0.4)'; circ(380, 44, 26);
  ctx.fillStyle = '#fff4c8'; circ(380, 44, 14);
  const sea = 140, off = cx * 0.05;
  ctx.fillStyle = '#88a8cc';
  ctx.beginPath(); ctx.moveTo(-10, sea);
  for (let x = -10; x <= W + 10; x += 6) ctx.lineTo(x, sea - 10 - Math.sin((x + off) * 0.013) * 7 - Math.sin((x + off) * 0.041) * 3);
  ctx.lineTo(W + 10, sea); ctx.fill();
  R(-10, sea, W + 20, H - sea + 10, '#3d8cc8');
  for (let i = 0; i < 16; i++) {
    const span = W + 20, sx = ((i * 67 - cx * 0.1 + G.t * 0.2) % span + span) % span - 10;
    R(Math.round(sx), sea + 4 + (i * 7) % 30, 6, 1, '#bfe6ff');
  }
}

// The house (granite walls, red tile roof, the door opening with G.introDoor) and the horreo (world space)
function fallbackBehind(cx) {
  if (cx > 260) return;
  const gy = 176;
  RO(40, gy - 54, 130, 54, '#a9a59b');
  for (let r = 1; r < 6; r++) R(40, gy - 54 + r * 9, 130, 1, '#8f8b82');
  for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) R(46 + c * 15 + (r % 2) * 7, gy - 53 + r * 9, 1, 8, '#8f8b82');
  RO(140, gy - 84, 10, 22, '#9a968c');
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(29, gy - 52); ctx.lineTo(105, gy - 84); ctx.lineTo(181, gy - 52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c4502e'; ctx.beginPath(); ctx.moveTo(33, gy - 53); ctx.lineTo(105, gy - 82); ctx.lineTo(177, gy - 53); ctx.closePath(); ctx.fill();
  RO(56, gy - 42, 16, 14, '#2c4a66'); RO(146, gy - 42, 14, 14, '#2c4a66');
  R(113, gy - 26, 14, 26, '#1d140e');
  const leaf = Math.round(14 * (1 - clamp(G.introDoor || 0, 0, 1)));
  if (leaf > 0) { RO(113, gy - 26, leaf, 26, '#7a4a24'); R(113, gy - 26, leaf, 1, '#9a6a3a'); }
  for (const lx of [194, 215, 236]) { RO(lx, gy - 14, 6, 14, '#9a968c'); RO(lx - 2, gy - 17, 10, 2, '#b5b1a6'); }
  RO(190, gy - 40, 55, 22, '#b9a27e');
  for (let x = 193; x < 244; x += 4) R(x, gy - 38, 2, 18, '#8f7a58');
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(185, gy - 40); ctx.lineTo(217.5, gy - 56); ctx.lineTo(250, gy - 40); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c4502e'; ctx.beginPath(); ctx.moveTo(188, gy - 41); ctx.lineTo(217.5, gy - 54); ctx.lineTo(247, gy - 41); ctx.closePath(); ctx.fill();
}

// Stand-ins for props whose type isn't written yet (trees, the tractor), so their places show (world space)
function missingProps(cx) {
  for (const s of VIGO.props) {
    if (PROP_TYPES[s.k] || s.x < cx - 90 || s.x > cx + W + 90) continue;
    const x = s.x, gy = Math.round(groundAt(x));
    if (s.k === 'cherrytree' || s.k === 'chestnuttree') {
      const cherry = s.k === 'cherrytree', top = gy - (cherry ? 62 : 74), r = cherry ? 22 : 28;
      RO(x - 3, top + 8, 7, gy - top - 8, cherry ? '#4a2c24' : '#5a4030');
      ctx.fillStyle = OUT; circ(x - r * 0.6, top + 4, r * 0.7 + 1); circ(x + r * 0.6, top + 4, r * 0.7 + 1); circ(x, top - 4, r + 1);
      ctx.fillStyle = cherry ? '#f4b6cc' : '#3f7d32'; circ(x - r * 0.6, top + 4, r * 0.7); circ(x + r * 0.6, top + 4, r * 0.7); circ(x, top - 4, r);
      ctx.fillStyle = cherry ? '#ffd9e6' : '#5a9a3e'; circ(x - r * 0.3, top - 10, r * 0.4);
    } else if (s.k === 'tractor') {
      RO(x - 24, gy - 24, 40, 14, '#c0392b'); RO(x - 6, gy - 38, 18, 14, '#2c3e50'); R(x - 4, gy - 36, 14, 6, '#8fc8f0');
      ctx.fillStyle = OUT; circ(x - 14, gy - 11, 11); circ(x + 14, gy - 6, 6);
      ctx.fillStyle = '#4a4a4a'; circ(x - 14, gy - 11, 8); circ(x + 14, gy - 6, 4);
    } else RO(x - 8, gy - 16, 16, 16, '#ff00ff');
  }
}

// Ground following groundAt: earth, a grass edge, water over the stream dip (world space)
function fallbackGround(cx) {
  const x0 = Math.floor((cx - 12) / 2) * 2, x1 = cx + W + 12;
  ctx.fillStyle = '#7a5232';
  ctx.beginPath(); ctx.moveTo(x0, H + 2);
  for (let x = x0; x <= x1 + 4; x += 4) ctx.lineTo(x, groundAt(x));
  ctx.lineTo(x1 + 4, H + 2); ctx.closePath(); ctx.fill();
  for (let x = x0; x < x1; x += 2) {
    const gy = Math.round(groundAt(x + 1));
    if (gy > 234) { R(x, 234, 2, gy - 234, '#4aa0d8'); R(x, 234, 2, 1, '#bfe6ff'); continue; } // the stream
    R(x, gy, 2, 3, '#5fb84a'); R(x, gy + 3, 2, 2, '#3f8f3a');
    if (hsh(x) > 0.8) R(x, gy - 2, 1, 2, '#3f8f3a');
  }
}

// Platforms: an outlined block from the flat top down to the slope under it, coloured by type (world space)
const PLAT_COLS = {
  wall: ['#a9a59b', '#cfcbc0', '#7f7c74'], boulder: ['#8a948a', '#aab4a6', '#636c64'], stump: ['#7a5230', '#a0744a', '#5a3a1e'],
  hay: ['#e2c35a', '#f6e08e', '#b8973a'], cart: ['#8b5a2b', '#b07a45', '#5e3a1a']
};
function fallbackPlat(pl) {
  const [c, cl, cd] = PLAT_COLS[pl.t] || PLAT_COLS.wall;
  const x = pl.x, y = pl.y, x2 = pl.x + pl.w, gl = Math.round(groundAt(x)), gr = Math.round(groundAt(x2));
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.moveTo(x - 1, y - 1); ctx.lineTo(x2 + 1, y - 1); ctx.lineTo(x2 + 1, gr + 1); ctx.lineTo(x - 1, gl + 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y); ctx.lineTo(x2, gr); ctx.lineTo(x, gl); ctx.closePath(); ctx.fill();
  R(x, y, pl.w, 2, cl); R(x2 - 3, y + 2, 3, Math.max(0, gr - y - 2), cd);
}

// ============================================================
// Music: one entry per eighth note, MIDI notes, 0 = rest (audio.js)
// ============================================================
// VIGO: a muineira, a Galician jig in 6/8 (bars of 6 eighths), in D mixolydian (C natural) on a square-wave gaita
// lead over a D drone (D, its fifth A and the octave, from D3 up so laptop speakers carry it). 8 bars A + 8 bars B,
// the last bar a pickup back to the top.
TRACKS.vigo = {
  bpm: 180, lead: 'square',
  bass: [50, 0, 57, 62, 0, 57],
  mel: [
    74, 0, 69, 66, 0, 69, 74, 0, 76, 78, 76, 74, 72, 0, 67, 64, 0, 67, 72, 0, 74, 76, 74, 72,
    74, 0, 69, 66, 0, 69, 71, 72, 74, 76, 0, 78, 79, 78, 76, 74, 72, 69, 74, 0, 0, 74, 0, 0,
    78, 0, 78, 78, 76, 74, 76, 0, 76, 76, 74, 72, 74, 76, 78, 79, 0, 76, 78, 0, 74, 69, 0, 0,
    79, 0, 79, 78, 76, 74, 72, 0, 72, 69, 71, 72, 74, 0, 69, 71, 72, 76, 74, 0, 0, 62, 66, 69
  ],
  drums: { kick: 'x..x..', hat: '..x..x' }
};
// MEGA BEAR: driving D minor in 4/4 (Dm Bb C A | Dm Bb Gm A), pumping octave bass, a heroic lead
TRACKS.bearboss = {
  bpm: 176,
  bass: [
    38, 50, 38, 50, 38, 50, 38, 50, 46, 58, 46, 58, 46, 58, 46, 58, 48, 60, 48, 60, 48, 60, 48, 60, 45, 57, 45, 57, 45, 57, 45, 57,
    38, 50, 38, 50, 38, 50, 38, 50, 46, 58, 46, 58, 46, 58, 46, 58, 43, 55, 43, 55, 43, 55, 43, 55, 45, 57, 45, 57, 45, 57, 45, 57
  ],
  mel: [
    69, 0, 74, 0, 77, 0, 81, 0, 79, 0, 77, 0, 74, 0, 77, 0, 76, 0, 79, 0, 72, 0, 76, 0, 76, 0, 73, 0, 69, 0, 73, 76,
    74, 74, 77, 81, 0, 0, 79, 77, 77, 0, 74, 0, 70, 0, 74, 0, 67, 0, 70, 0, 74, 0, 79, 0, 81, 0, 0, 79, 77, 76, 73, 0,
    74, 77, 81, 77, 74, 77, 81, 77, 74, 77, 82, 77, 74, 77, 82, 77, 76, 79, 84, 79, 76, 79, 84, 79, 76, 81, 85, 81, 76, 81, 85, 81,
    81, 0, 0, 77, 0, 0, 74, 0, 82, 0, 0, 77, 0, 0, 74, 0, 79, 0, 0, 74, 0, 79, 82, 0, 81, 0, 79, 0, 77, 0, 76, 73
  ],
  drums: { kick: 'x...x...', snare: '..x...x.', hat: '.x.x.x.x' }
};
// VICTORY (ALL MISSIONS COMPLETE, looped): the jig's drone under a bright D major tune in 6/8: the win jingle's
// fanfare in D, a dance down to A, a run up to the top A and a pickup back to the fanfare
TRACKS.victory = {
  bpm: 150, lead: 'square',
  bass: [50, 0, 57, 62, 0, 57],
  mel: [
    74, 74, 74, 78, 0, 81, 78, 0, 81, 74, 0, 0, 71, 0, 74, 79, 0, 78, 76, 0, 73, 69, 0, 0,
    74, 0, 76, 78, 76, 78, 79, 0, 78, 76, 0, 73, 74, 76, 78, 81, 0, 76, 74, 0, 0, 69, 0, 73
  ],
  drums: { kick: 'x..x..', hat: '..x..x' }
};

// ============================================================
// Mission-select card art: a sunny morning over the Ria de Vigo and the Cies Islands, the granite house with its
// red roof and the horreo on the hill, a cherry tree in blossom, the hero and a robot wolf coming up the slope.
// Screen space, clipped by the caller (180x96 with two cards); G.p may be null and LV another level, so nothing
// here uses them or groundAt. Animated with G.t only.
// ============================================================
// the middle-distance hill (house plateau, then down to the sea) and the foreground bank, in card pixels
const hillM = px => px < 62 ? 47 : px < 128 ? 47 + 24 * ease((px - 62) / 66) : 71 + (px - 128) * 0.3;
const bank = px => 84 + Math.round(Math.sin(px * 0.06) * 1.5 + Math.sin(px * 0.023 + 1) * 1.5);
// filled pixel ellipse on the main canvas (crisp edges, unlike circ)
function pdisc(x, y, r, col, ry = r) {
  for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)))); R(x - w, y + dy, w * 2 + 1, 1, col); }
}
// the same drawing helpers on any 2D context: the card's still scenery is painted once into offscreen layers
function painter(g) {
  const P = {
    R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); },
    RO(x, y, w, h, c) { P.R(x - 1, y - 1, w + 2, h + 2, OUT); P.R(x, y, w, h, c); },
    disc(x, y, r, c, ry = r) { for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)))); P.R(x - hw, y + dy, hw * 2 + 1, 1, c); } },
    crown(parts, c) { for (const [x, y, rx, ry] of parts) P.disc(x, y, rx + 1, OUT, ry + 1); for (const [x, y, rx, ry] of parts) P.disc(x, y, rx, c, ry); },
    poly(pts, c) { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.fill(); }
  };
  return P;
}
const cardCache = {};
function cardLayer(name, w, h, paint) {
  const key = name + w + 'x' + h;
  let c = cardCache[key];
  if (!c) {
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    paint(painter(g), g, w, h);
    cardCache[key] = c;
  }
  return c;
}
// layer 1: the sky (deep blue to a golden haze at the horizon) and the sun
function cardBase(P, g, w) {
  const sky = g.createLinearGradient(0, 0, 0, 52);
  sky.addColorStop(0, '#2f7fd2'); sky.addColorStop(0.55, '#7cc0ee'); sky.addColorStop(1, '#f6e6c4');
  g.fillStyle = sky; g.fillRect(0, 0, w, 52);
  const sx = w - 30, sy = 14;
  g.globalAlpha = 0.18; P.disc(sx, sy, 15, '#fff6c8'); g.globalAlpha = 0.3; P.disc(sx, sy, 10, '#fff6c8'); g.globalAlpha = 1;
  P.disc(sx, sy, 6, '#ffe58a'); P.disc(sx - 1, sy - 1, 4, '#fffbe6');
}
// layer 2: the far shore of the ria (the Morrazo hills with white villages), the sea and the Cies Islands
function cardSea(P, g, w, h) {
  for (let px = 0; px < w; px += 2) {
    const ty = Math.round(45 - Math.sin(px * 0.035) * 3 - Math.sin(px * 0.11 + 1) * 1.2);
    P.R(px, ty, 2, 52 - ty, '#8eaac6'); P.R(px, ty, 2, 1, '#aac2da');
  }
  for (let i = 0; i < 8; i++) P.R(70 + i * 5 + (i % 2) * 2, 47 - (i % 3), 2, 1, '#f4f2ea');
  P.R(0, 50, w, h - 50, '#2f86c8');
  P.R(0, 50, w, 1, '#d8eefa'); P.R(0, 51, w, 2, '#6cb4e4'); P.R(0, 53, w, 3, '#4a9ed8');
  const isl = [[100, 51], [112, 45], [120, 40], [128, 39], [136, 43], [142, 48], [146, 51]];
  P.poly([[98, 51], ...isl.map(([ix, iy]) => [ix, iy - 1]), [148, 51]], OUT);
  P.poly([[100, 51], ...isl, [146, 51]], '#5f8a7a');
  P.poly([[112, 46], [120, 41], [128, 40], [122, 45]], '#7fa892');
  for (let i = 0; i < 6; i++) P.R(134 + i, 44 + i, 1, 51 - (44 + i), '#4a6e62');               // cliffs
  P.RO(127, 33, 2, 6, '#f4f4f0'); P.R(127, 35, 2, 1, '#d84a3a');                                // lighthouse
  P.poly([[152, 51], [158, 46], [165, 45], [171, 51]], OUT);
  P.poly([[154, 51], [158, 47], [165, 46], [169, 51]], '#5f8a7a');
  P.R(100, 50, 72, 1, '#e8f6ff');
}
// layer 3: the hill (terraced fields, hedges, cows, the path), the house, the horreo, the cherry tree and the
// foreground bank with its granite wall and gorse
function cardLand(P, g, w, h) {
  const FIELD = ['#6cbe50', '#86cc5c', '#5aa848', '#9fd46c', '#c4c25a', '#78c254'];
  for (let px = 0; px < 150; px += 2) {
    const gy = Math.round(hillM(px));
    P.R(px, gy, 2, h - gy, '#5aa848'); P.R(px, gy, 2, 1, '#9ce070');
    for (let b = 0; b < 5; b++) {
      const y0 = gy + 2 + b * 7 + (b > 1 ? b - 1 : 0), blk = Math.floor((px + b * 23 + 7) / 30);
      if (y0 >= h) break;
      P.R(px, y0, 2, 8, FIELD[(blk * 3 + b) % FIELD.length]);
      P.R(px, y0, 2, 1, (px >> 1) % 5 ? '#3f7d34' : '#2f6a2c');
      if (((px + b * 23 + 7) % 30) < 2) P.R(px, y0, 1, 8, '#3f7d34');
    }
  }
  for (let px = 122; px < 150; px += 2) P.R(px, Math.round(hillM(px)) + 1, 2, 1, '#e8dcb0');       // a strip of beach
  for (let i = 0; i < 7; i++) {                                                                      // trees along the hedges
    const tx2 = 70 + i * 11 + Math.floor(hsh(i + 30) * 5), ty2 = Math.round(hillM(tx2)) + 2 + (i % 3) * 7;
    P.disc(tx2, ty2 - 2, 3, OUT, 3); P.disc(tx2, ty2 - 2, 2, i % 2 ? '#2f6e2e' : '#3a7d34', 2); P.R(tx2 - 1, ty2 - 4, 1, 1, '#5aa04a');
  }
  for (const [cx3, cy3] of [[108, 69], [116, 71]]) {                                                 // Rubia Galega cows
    P.R(cx3, cy3, 4, 2, '#e0aa58'); P.R(cx3 + 3, cy3 - 1, 2, 2, '#e0aa58'); P.R(cx3, cy3 + 2, 1, 1, '#6a4a2a'); P.R(cx3 + 3, cy3 + 2, 1, 1, '#6a4a2a');
  }
  for (let i = 0; i <= 12; i++) {                                                                    // the path down from the house
    const u = i / 12, px2 = Math.round(30 + 40 * u - 22 * u * (1 - u)), py2 = Math.round(48 + u * 34);
    P.R(px2, py2, 3, 3, '#dcc89a'); P.R(px2, py2 + 2, 3, 1, '#b8a072');
  }
  // a chestnut tree behind the house
  P.crown([[4, 36, 6, 6], [11, 31, 5, 5], [-2, 31, 5, 5]], '#3f7d3a');
  P.R(2, 30, 3, 2, '#5aa04a'); P.R(9, 27, 3, 2, '#5aa04a');
  // the house: granite blocks, a red curved-tile roof, the chimney, green shutters, geraniums, hydrangeas
  const hx = 12, gy0 = 47;
  P.RO(hx, gy0 - 15, 36, 15, '#b9b3a6');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const bx2 = hx + 1 + c * 6 + (r % 2) * 3, by2 = gy0 - 14 + r * 4;
    if (bx2 + 4 <= hx + 36) { P.R(bx2, by2, 4, 3, hsh(r * 7 + c) > 0.5 ? '#c6c0b2' : '#aaa496'); P.R(bx2, by2, 4, 1, '#d8d2c4'); }
  }
  P.RO(hx + 27, gy0 - 28, 4, 8, '#a8a296'); P.R(hx + 27, gy0 - 28, 4, 1, '#d0cabc');
  for (let r = 0; r < 5; r++) { const rx = hx - 3 + r * 4, rw = 42 - r * 8, ry = gy0 - 17 - r * 2; P.R(rx - 1, ry - 1, rw + 2, 3, OUT); }
  for (let r = 0; r < 5; r++) {
    const rx = hx - 3 + r * 4, rw = 42 - r * 8, ry = gy0 - 17 - r * 2;
    P.R(rx, ry, rw, 2, '#c8502e'); P.R(rx, ry, rw, 1, '#ec7a4a');
    for (let tx = rx + 1 + (r % 2) * 2; tx < rx + rw - 1; tx += 4) P.R(tx, ry + 1, 1, 1, '#8a2e1a');
  }
  P.R(hx - 3, gy0 - 15, 42, 1, '#5a2414');
  P.RO(hx + 16, gy0 - 9, 4, 9, '#6a3e1e'); P.R(hx + 16, gy0 - 9, 4, 1, '#8a5a30'); P.R(hx + 18, gy0 - 5, 1, 1, '#ffd23f');
  for (const wx of [hx + 5, hx + 26]) {
    P.RO(wx, gy0 - 12, 4, 4, '#3c5a78'); P.R(wx + 1, gy0 - 11, 2, 1, '#a8d0f0');
    P.R(wx - 2, gy0 - 12, 1, 4, '#2e7a3a'); P.R(wx + 5, gy0 - 12, 1, 4, '#2e7a3a');
    P.R(wx - 1, gy0 - 7, 6, 1, '#7a4a24'); P.R(wx, gy0 - 8, 1, 1, '#e8303a'); P.R(wx + 2, gy0 - 8, 1, 1, '#ff6a7a'); P.R(wx + 3, gy0 - 8, 1, 1, '#e8303a');
  }
  for (const [fx, c1, c2] of [[hx + 2, '#6a8ae8', '#a8c0ff'], [hx + 33, '#d878c8', '#f8b0e8']]) {
    P.disc(fx, gy0 - 2, 2, OUT, 2); P.disc(fx, gy0 - 2, 1, c1, 1); P.R(fx - 1, gy0 - 3, 1, 1, c2);
  }
  // the horreo on its granite legs, a pinnacle at each end of the roof
  const ox = 52;
  for (const lx of [ox + 1, ox + 6, ox + 11]) { P.RO(lx, gy0 - 5, 2, 5, '#a8a296'); P.R(lx - 1, gy0 - 6, 4, 1, '#c8c2b4'); }
  P.RO(ox - 1, gy0 - 15, 16, 8, '#c4bca8'); P.R(ox - 1, gy0 - 15, 16, 1, '#ddd6c4');
  for (let sx2 = ox + 1; sx2 < ox + 14; sx2 += 2) P.R(sx2, gy0 - 13, 1, 5, '#9a7a52');
  P.poly([[ox - 4, gy0 - 15], [ox + 7, gy0 - 22], [ox + 18, gy0 - 15]], OUT);
  P.poly([[ox - 2, gy0 - 16], [ox + 7, gy0 - 21], [ox + 16, gy0 - 16]], '#c8502e');
  P.R(ox + 1, gy0 - 18, 12, 1, '#ec7a4a');
  P.RO(ox - 2, gy0 - 20, 1, 3, '#c8c2b4'); P.RO(ox + 15, gy0 - 20, 1, 3, '#c8c2b4');
  // the cherry tree in blossom on the slope
  const tx = 88, tg = Math.round(hillM(tx));
  P.RO(tx - 1, tg - 12, 2, 12, '#5a3424'); P.R(tx - 3, tg - 10, 2, 1, '#5a3424'); P.R(tx + 2, tg - 9, 3, 1, '#5a3424');
  P.crown([[tx - 5, tg - 15, 5, 4], [tx + 4, tg - 16, 5, 4], [tx, tg - 21, 5, 4]], '#f2a6c6');
  for (let i = 0; i < 16; i++) P.R(tx - 10 + Math.floor(hsh(i * 3.1) * 20), tg - 25 + Math.floor(hsh(i * 5.7) * 13), 1, 1, i % 3 ? '#ffd8e8' : '#ffffff');
  // the foreground bank: grass, gorse and daisies, a granite wall at the left
  for (let px = 0; px < w; px += 2) {
    const gy = bank(px);
    P.R(px, gy, 2, h - gy, '#6a4428'); P.R(px, gy, 2, 3, '#4fae3e'); P.R(px, gy, 2, 1, '#8ee060'); P.R(px, gy + 3, 2, 1, '#2f7a2e');
    if (hsh(px + 3) > 0.5) P.R(px + (hsh(px) > 0.5 ? 1 : 0), gy - 1, 1, 1, '#8ee060');
    if (hsh(px + 7) > 0.8) P.R(px, gy - 2, 1, 2, '#3f9a3a');
    if (hsh(px + 21) > 0.75) P.R(px, gy + 6 + Math.round(hsh(px + 4) * 4), 2, 1, '#4e301c');
  }
  for (let i = 0; i < 5; i++) { const sx3 = i * 7 - 2, sy3 = bank(sx3 + 3) - 5 - (i % 2); P.RO(sx3, sy3, 6, 4, '#bdb6a6'); P.R(sx3, sy3, 6, 1, '#dcd6c8'); P.R(sx3 + 4, sy3 + 1, 2, 3, '#9a9488'); }
  for (let i = 0; i < 4; i++) { const sx3 = 3 + i * 7, sy3 = bank(sx3 + 3) - 9 - (i % 2); P.RO(sx3, sy3, 6, 4, '#c6c0b2'); P.R(sx3, sy3, 6, 1, '#e2dccc'); P.R(sx3 + 4, sy3 + 1, 2, 3, '#a09a8c'); }
  const gx = 104, gby = bank(gx);                                                                    // a gorse bush in flower
  P.crown([[gx - 4, gby - 3, 4, 3], [gx + 4, gby - 3, 4, 3], [gx, gby - 6, 5, 4]], '#3f7a2e');
  P.R(gx - 3, gby - 9, 4, 1, '#5a9a3a'); P.R(gx + 2, gby - 7, 3, 1, '#5a9a3a');
  for (let i = 0; i < 16; i++) P.R(gx - 7 + Math.floor(hsh(i + 50) * 15), gby - 10 + Math.floor(hsh(i + 60) * 8), 1, 1, i % 4 ? '#ffd23f' : '#fff3a0');
  for (let i = 0; i < 7; i++) { const dx2 = 40 + i * 19 + Math.floor(hsh(i + 80) * 8); P.R(dx2, bank(dx2) - 1, 1, 1, i % 2 ? '#ffffff' : '#ffe066'); }
}
function cardCloud(x, y, s) {
  const parts = [[x, y, 7 * s, 3 * s], [x + 6 * s, y - 3 * s, 5 * s, 4 * s], [x + 12 * s, y, 6 * s, 3 * s]];
  for (const [cx, cy, rx, ry] of parts) pdisc(Math.round(cx), Math.round(cy), Math.round(rx), '#f3dcd2', Math.round(ry));
  for (const [cx, cy, rx, ry] of parts) pdisc(Math.round(cx), Math.round(cy - 1), Math.round(rx - 1), '#ffffff', Math.round(ry - 1));
}
function drawPreview(x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const T = G.t, sx = w - 30, sy = 14;
  ctx.drawImage(cardLayer('base', w, h, cardBase), 0, 0);
  // the sun's slowly turning rays, clouds drifting
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + T * 0.004, r1 = 12 + (i % 2) * 3;
    for (let r = 9; r < r1; r++) R(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r), 1, 1, '#fff2b0');
  }
  for (let i = 0; i < 3; i++) {
    const span = w + 70, cx2 = ((i * 83 + T * 0.04) % span) - 40;
    cardCloud(Math.round(cx2), 9 + i * 8 + (i === 1 ? 3 : 0), i === 1 ? 0.8 : 1);
  }
  ctx.drawImage(cardLayer('sea', w, h, cardSea), 0, 0);
  // the lighthouse light, sea sparkles (brighter in the sun's path), a sailboat bobbing on the ria
  R(127, 32, 2, 1, (T >> 4) % 3 ? '#ffe066' : '#ffffff');
  for (let i = 0; i < 16; i++) {
    const sx2 = Math.round((i * 47 + T * (0.15 + (i % 3) * 0.05)) % (w + 10)) - 5, sy2 = 55 + (i * 7) % 30;
    if ((T + i * 13) % 50 < 38) R(sx2, sy2, 2 + (i % 3), 1, i % 4 ? '#a8d8f6' : '#ffffff');
  }
  for (let i = 0; i < 6; i++) if ((T + i * 9) % 24 < 14) R(sx - 6 + ((i * 5 + (T >> 3)) % 12), 54 + i * 3, 3, 1, '#fff6c8');
  const bx = Math.round(150 + Math.sin(T * 0.004) * 10), by = 60 + ((T >> 5) % 2);
  R(bx - 3, by, 7, 1, OUT); R(bx - 2, by + 1, 5, 1, '#c84a3a'); R(bx, by - 7, 1, 7, OUT);
  for (let r = 0; r < 6; r++) R(bx + 1, by - 6 + r, Math.max(1, r - 1), 1, '#ffffff');
  ctx.drawImage(cardLayer('land', w, h, cardLand), 0, 0);
  // chimney smoke, petals drifting off the cherry tree on the breeze
  for (let i = 0; i < 4; i++) {
    const k2 = ((T * 0.3 + i * 9) % 36), a = 1 - k2 / 36;
    ctx.globalAlpha = 0.75 * a; pdisc(Math.round(41 + k2 * 0.35 + Math.sin(k2 * 0.2) * 1.5), Math.round(17 - k2 * 0.7), 1 + Math.round(k2 / 14), '#f4f2ec'); ctx.globalAlpha = 1;
  }
  const tg = Math.round(hillM(88));
  for (let i = 0; i < 7; i++) {
    const k2 = (T * 0.5 + i * 40) % 160;
    R(Math.round(84 + k2 * 0.6 + Math.sin(k2 * 0.1 + i) * 3), Math.round(tg - 18 + k2 * 0.3 + Math.sin(k2 * 0.07 + i) * 4), 1, 1, i % 2 ? '#ffc0d8' : '#ffffff');
  }
  // a robot eagle gliding high over the ria
  const ew = Math.round(T * 0.35) % (w + 120);
  if (ENEMY_TYPES.eagle && cardOK.eagle) cardDraw('eagle', { type: 'eagle', x: ew - 40, y: 27 + Math.round(Math.sin(T * 0.03) * 3), facing: 1, t: T, st: 0, hitT: 0, state: 'glide', glide: (T % 240) < 140, flap: (T * 0.045) % 1, cry: 0 });
  // the hero on the bank and a robot wolf coming for him: eyes flaring, then a howl
  const hxp = 66, hy = bank(hxp) + 1, fire = T % 80 < 36;
  drawHero(HEROES[G.hero], hxp, hy, 1, { pose: 'idle', t: T, aim: 'fwd', muzzle: fire && T % 6 < 3 ? 3 : 0 });
  if (fire) for (let i = 0; i < 3; i++) {
    const bx3 = hxp + 22 + ((T * 4 + i * 18) % 54);
    R(bx3 - 2, hy - 20, 5, 2, '#ffe066'); R(bx3 - 1, hy - 20, 3, 1, '#ffffff');
  }
  const wx = 150, wy = bank(wx) + 1, wph = T % 200;
  if (ENEMY_TYPES.wolf && cardOK.wolf) {
    const st = wph < 120 ? 'crouch' : 'howl';
    cardDraw('wolf', { type: 'wolf', x: wx, y: wy, facing: -1, t: T, st: wph < 120 ? 6 + (wph % 24) : wph - 120, hitT: fire && T % 40 < 2 ? 1 : 0, state: st, ph: 0, sq: 0, spd: 0 });
  } else cardWolf(wx, wy);
  ctx.restore();
}
// enemy art from level2_enemies.js on fake enemy objects; a stand-in if it fails
const cardOK = { wolf: true, eagle: true };
function cardDraw(k, e) {
  try { ENEMY_TYPES[k].draw(e); } catch (err) { cardOK[k] = false; FLASH = false; errorOnce(err); }
  FLASH = false;
}
function cardWolf(wx, wy) {
  const leg = Math.floor(G.t / 5) % 2;
  R(wx - 8, wy - 5 + leg, 2, 5 - leg, METD); R(wx + 6, wy - 5 + leg, 2, 5 - leg, METD); R(wx - 5, wy - 5, 2, 5, MET); R(wx + 3, wy - 5, 2, 5, MET);
  RO(wx - 9, wy - 12, 18, 7, MET); R(wx - 9, wy - 12, 18, 2, METL);
  RO(wx - 15, wy - 16, 8, 7, MET); R(wx - 15, wy - 9, 5, 2, METD); R(wx - 13, wy - 14, 2, 2, EVIL);
  RO(wx - 11, wy - 19, 2, 3, METD); RO(wx + 9, wy - 13, 6, 2, METD);
}
}
