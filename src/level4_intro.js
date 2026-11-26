'use strict';
// ============================================================
// Mission 4 opening scene: THE DIVE (about 3.6 s; Enter skips). Letterbox bars, the caption CORAL KINGDOM.
// Split view: sky and the heroes' dive boat above the waterline (y 100), moored by a rope to the old diving bell on the
// reef below; the other hero waves from the boat; the hero sits on the stern in full dive gear, back-rolls into the sea
// (a big splash, a cloud of bubbles), rights himself under water and swims down to the start (100, 155) while the
// waterline rises to the top of the screen (the camera follows the dive; the boat stays moored at the surface, as it
// is in play); then MISSION 4 START! (said), the area name, bars out, and the swimmer is the player's.
// While the waterline is below its play height (40) this draw paints the whole picture itself with the reef's own
// painters (L4ART.reef.paint, with the waterline as an argument; L4ART.reef.hide makes the joiner's calls skip the
// hidden frame meanwhile). The diver is L4.drawDiver (the cast's gear): painted once on the canvas just before the
// split view repaints it, read back, and turned into 32 rotated frames (nearest neighbour: crisp at every angle).
// Never Math.random / rand: the splash uses a private seeded stream.
// ============================================================
var L4ART = L4ART || {};
var L4 = L4 || {};
{
const Math = globalThis.Math;
const L = LEVELS.find(l => l.title === 'CORAL KINGDOM');
const TAU = Math.PI * 2;
const lerp = (a, b, k) => a + (b - a) * k;
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
const IT = { roll: 66, rollLen: 24, splash: 82, flip: 34, swim: 122, swimLen: 56, down: 112, downLen: 64, home: 176, go: 182, banner: 192, out: 198, end: 218 };
const WL0 = 100, BARS = 30, HERO_END = [100, 155];
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
// two gulls over the sea (as in Mission 3's arrival)
const GULL = [['.k.....k.', 'kwk...kwk', '..kwkwk..', '...kgk...'], ['.........', '.kk...kk.', 'kwwkwkwwk', '...kgk...'], ['.........', '.........', 'kkwwkwwkk', '..kwgwk..']].map(r => makeSprite(r, { k: '#3a4250', w: '#ffffff', g: '#ffb020' }));

// ---- the diver's rotated frames -------------------------------------------------------------------------------
const DN = 32, DR = 50, HIP = [-6, -3];          // frames per turn, frame radius, the hip (pivot) in drawDiver coordinates
const CAP_W = 112, CAP_H = 64, CAP_X = 56, CAP_Y = 34;   // the capture box and where the hip lands in it
let FR = null;
function diverFrames() {
  if (FR && FR.hero === G.hero && FR.fn === L4.drawDiver) return FR;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, CAP_W, CAP_H);
  const fl = FLASH; FLASH = false;
  L4.drawDiver({ x: CAP_X - HIP[0], y: CAP_Y - HIP[1] + 13, facing: 1, t: 0, muzzle: 0, hearts: 3, ride: { type: 'scuba' } });
  FLASH = fl;
  const cd = ctx.getImageData(0, 0, CAP_W, CAP_H).data, src = new Uint32Array(cd.buffer.slice(cd.byteOffset, cd.byteOffset + CAP_W * CAP_H * 4));
  ctx.restore();
  const frames = [], S = DR * 2;
  for (let k = 0; k < DN; k++) {
    const a = -k / DN * TAU, ca = Math.cos(a), sa = Math.sin(a), c = document.createElement('canvas');
    c.width = S; c.height = S;
    const g = c.getContext('2d'), id = g.createImageData(S, S), dst = new Uint32Array(id.data.buffer, id.data.byteOffset, S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const X = x - DR + 0.5, Y = y - DR + 0.5;
      const sx = CAP_X + Math.floor(ca * X + sa * Y), sy = CAP_Y + Math.floor(-sa * X + ca * Y);
      if (sx >= 0 && sy >= 0 && sx < CAP_W && sy < CAP_H) dst[y * S + x] = src[sy * CAP_W + sx];
    }
    g.putImageData(id, 0, 0);
    frames.push(c);
  }
  return (FR = { hero: G.hero, fn: L4.drawDiver, frames });
}

// ---- the splash of the back-roll: a crown of white jets rising and collapsing (s 0..1), foam spreading ---------
function crown(x, y, s) {
  const env = Math.sin(Math.PI * Math.min(1, s * 1.25)), mh = Math.round(7 * env);
  for (let k = 0; k < mh; k++) { const hw = Math.round((16 - k * 1.6) * (0.6 + 0.4 * env)); R(x - hw, y - k, hw * 2 + 1, 1, k === mh - 1 ? '#e6fffc' : '#ffffff'); }
  for (let j = -8; j <= 8; j++) {
    const hj = Math.round(38 * env * (1 - Math.abs(j) / 9.5) * (0.65 + 0.55 * hsh(j * 3.3 + 1))), lean = j * (0.22 + s * 0.5), th = Math.abs(j) < 4 ? 3 : 2;
    for (let k = 0; k < hj; k++) { const xx = Math.round(x + j * 2.2 + lean * k * 0.16); R(xx, y - k, th, 1, '#ffffff'); if (k < hj - 3 && k > mh) R(xx + (j < 0 ? 0 : th - 1), y - k, 1, 1, '#b4ecec'); }
    if (hj > 5) {
      const tx = Math.round(x + j * 2.2 + lean * hj * 0.16 + j * 0.5), ty = y - hj - 3 - Math.round(s * 7);
      R(tx, ty, 2, 2, '#ffffff'); if (j % 2) R(tx + Math.sign(j) * 3, ty + 4, 1, 1, '#ffffff'); if (j % 3 === 0) R(tx - Math.sign(j) * 2, ty - 4, 1, 1, '#ffffff');
    }
  }
  const fw = Math.round(12 + s * 26);
  for (let i = -fw; i <= fw; i++) { const a = (1 - Math.abs(i) / (fw + 1)) * (1 - s * 0.6); if (a > bay(i + 40, 1) * 0.8) R(x + i, y - 1, 1, 2, '#ffffff'); if (a > 0.5 && (i & 3) === 0) R(x + i, y + 2, 2, 1, '#e8fffc'); }
  ctx.fillStyle = 'rgba(255,255,255,' + (0.45 * (1 - s)).toFixed(2) + ')';
  for (let i = 0; i < 6; i++) circ(Math.round(x + Math.sin(i * 2.1) * 7), Math.round(y + 6 + i * 3 + s * 8), Math.round(6 - i * 0.6));
}

// ---- the other hero, left in the boat, waving (faces left, towards the stern) ----------------------------------
function buddy(x, y, t, wave) {
  const h = HEROES[1 - G.hero];
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(-1, 1);
  RO(-5, -11, 10, 12, h.out); R(-5, -11, 2, 12, h.outD); R(-3, -11, 7, 1, h.outL);
  if (h.tail) spr(h.tail, -13, -26);
  spr(h.head, -7, -24);
  const up = wave && ((t >> 3) & 1);
  if (wave) { RO(3, -18, 3, 8, h.out); RO(up ? 5 : 2, -21, 3, 3, SKIN); }
  else { RO(2, -9, 6, 3, h.out); RO(7, -9, 3, 3, SKIN); }
  ctx.restore();
}

function makeIntro() {
  const R4 = L4ART.reef;
  let t = 0, wl = WL0, parts = [], pseed = 1;
  const prnd = () => (pseed = (Math.imul(pseed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const pr = (a, b) => a + prnd() * (b - a);
  // where the diver is: pose 'roll' (hip x, y and angle a: -PI/2 = sitting upright, -2PI = swimming), or 'swim' (feet)
  function diverAt() {
    const sx = R4.BOAT_X - 41, sy = WL0 - 12;
    if (t < IT.roll) return { pose: 'roll', a: -Math.PI / 2, x: sx, y: sy, bob: true };
    if (t < IT.roll + IT.rollLen) { const u = (t - IT.roll) / IT.rollLen, e = u * u; return { pose: 'roll', a: -Math.PI / 2 - Math.PI * e, x: sx - 14 * u, y: sy + 20 * e }; }
    const ex = R4.BOAT_X - 55, ey = WL0 + 8;
    if (t < IT.swim) { const u = Math.min(1, (t - IT.roll - IT.rollLen) / IT.flip), e = 1 - (1 - u) * (1 - u); return { pose: 'roll', a: -Math.PI * 1.5 - Math.PI / 2 * e, x: ex + 6 * e, y: ey + 22 * e }; }
    const u = ease((t - IT.swim) / IT.swimLen), x0 = ex + 6 - HIP[0], y0 = ey + 22 - HIP[1] + 13;
    return { pose: 'swim', x: lerp(x0, HERO_END[0], u), y: lerp(y0, HERO_END[1], u) };
  }
  function splash(x) {
    for (let i = 0; i < 34; i++) { const a = pr(-Math.PI * 0.92, -Math.PI * 0.08), sp = pr(1.2, 3.6); parts.push({ k: 'drop', x: x + pr(-5, 5), y: WL0 - 1, vx: Math.cos(a) * sp * 0.7, vy: Math.sin(a) * sp, life: 60 }); }
    for (let i = 0; i < 16; i++) parts.push({ k: 'foam', x: x + pr(-8, 8), y: WL0 + pr(2, 14), vx: pr(-0.4, 0.4), vy: pr(-0.2, 0.3), r: pr(2, 5), life: pr(16, 30) });
    for (let i = 0; i < 40; i++) parts.push({ k: 'bub', x: x + pr(-10, 10), y: WL0 + pr(4, 30), vx: pr(-0.3, 0.3), vy: pr(-1.4, -0.4), r: prnd() < 0.3 ? 2 : 1, life: 200, ph: pr(0, 6) });
    parts.push({ k: 'ring', x, y: WL0, life: 40 });
  }
  // the hero is the player's from here: in the water at the start, visible, facing right
  function handover() {
    const p = G.p;
    wl = R4.WL; R4.hide = false; parts = [];
    p.hidden = false; p.x = HERO_END[0]; p.y = HERO_END[1]; p.vx = p.vy = 0; p.facing = 1; G.introKeys = {};
  }
  return {
    start() {
      t = 0; wl = WL0; parts = []; pseed = 9001;
      R4.build(); R4.hide = true;
      const p = G.p; p.hidden = true; p.x = HERO_END[0]; p.y = HERO_END[1]; p.facing = 1; p.vx = p.vy = 0; G.introKeys = {};
    },
    update() {
      t++;
      const p = G.p;
      // Enter skips: the swimmer is the player's at once (like the old intro)
      if (pressed.Enter && t < IT.end) {
        if (t < IT.home) handover();
        if (t < IT.go) { G.big = { s: L.startText, t: 130 }; say(L.startSay); }
        if (t < IT.banner) G.banner = { s: L.sections[0].name, t: 200 };
        R4.hide = false; G.introKeys = {};
        return true;
      }
      if (t < IT.home) {
        if (t === 1) Snd.noise(0.8, 0.02, 600);
        if (t === 30) { Snd.tone('triangle', 1500, 1100, 0.12, 0.03); Snd.tone('triangle', 1700, 1200, 0.16, 0.03, 0.16); }
        if (t === IT.splash) { splash(R4.BOAT_X - 58); L4SND.play('splash', { fb: () => { Snd.noise(0.5, 0.14, 1400); Snd.tone('sine', 300, 90, 0.35, 0.12); } }); G.shake = Math.max(G.shake, 1.5); }
        if (t > IT.splash && t < IT.swim && t % 3 === 0) { const d = diverAt(); parts.push({ k: 'bub', x: d.x + pr(-6, 6), y: d.y + pr(-10, 6), vx: pr(-0.2, 0.2), vy: pr(-1.2, -0.5), r: prnd() < 0.3 ? 2 : 1, life: 200, ph: pr(0, 6) }); }
        if (t >= IT.swim && t % 9 === 0) { const d = diverAt(); parts.push({ k: 'bub', x: d.x + 10, y: d.y - 26, vx: 0, vy: -0.8, r: 1, life: 200, ph: pr(0, 6) }); }
        if (t >= IT.down) wl = lerp(WL0, R4.WL, ease((t - IT.down) / IT.downLen));
        for (const q of parts) {
          q.life--; q.x += q.vx; q.y += q.vy;
          if (q.k === 'drop') { q.vy += 0.16; if (q.y > WL0 && q.vy > 0) q.life = 0; }
          else if (q.k === 'bub') { q.x += Math.sin(t * 0.2 + q.ph) * 0.25; if (q.y < wl + 2) q.life = 0; }
          else if (q.k === 'foam') { q.vx *= 0.95; q.vy *= 0.95; }
        }
        parts = parts.filter(q => q.life > 0);
      }
      if (t === IT.home) handover();
      if (t === IT.go) { G.big = { s: L.startText, t: 130 }; say(L.startSay); }
      if (t === IT.banner) G.banner = { s: L.sections[0].name, t: 200 };
      if (t < IT.end) return false;
      if (p.hidden) handover();
      R4.hide = false; G.introKeys = {};
      return true;
    },
    draw() {
      const cx = Math.round(G.cam.x), split = t < IT.home && wl > R4.WL + 0.5;
      if (split) {
        const fr = diverFrames().frames;   // first: it paints on the canvas, and everything below repaints it
        const w = Math.round(wl), P = R4.paint, d = diverAt();
        ctx.save();
        P.bg(ctx, cx, w);
        ctx.save(); ctx.translate(-cx, 0);
        P.behind(cx, false); P.ground(cx);
        for (const o of G.pows) drawPow(o);
        if (d.pose === 'swim') L4.drawDiver({ x: d.x, y: d.y, facing: 1, t: G.t, muzzle: 0, hearts: 3, ride: { type: 'scuba' } });
        if (t >= IT.splash && t < IT.splash + 40) crown(R4.BOAT_X - 57, w, (t - IT.splash) / 40);
        // the boat; the buddy and the sitting / rolling diver go between its deck and its hull
        R4.boat(cx, w, {
          onDeck: by => {
            buddy(R4.BOAT_X - 20, by - 13, t, t < IT.roll + 40);
            if (d.pose !== 'roll') return;
            const k = ((Math.round(-d.a / TAU * DN) % DN) + DN) % DN;
            const fx = Math.round(d.x) - DR, fy = Math.round(d.y + (d.bob ? by - w : 0)) - DR;
            if (d.bob) { ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, DR * 2, by + 1 - fy); ctx.clip(); }   // seated: the legs hang behind the hull, in the water
            ctx.drawImage(fr[k], fx, fy);
            if (d.bob) ctx.restore();
          }
        });
        for (const q of parts) {
          if (q.k === 'drop') { ctx.fillStyle = q.life % 4 < 2 ? '#ffffff' : '#c8f8f4'; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.life > 40 ? 2 : 1, 2); }
          else if (q.k === 'foam') { ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * q.life / 30).toFixed(2) + ')'; circ(Math.round(q.x), Math.round(q.y), q.r); }
          else if (q.k === 'bub') R4.bubble(ctx, q.x, q.y, q.r);
          else if (q.k === 'ring') { const k = 1 - q.life / 40, rw = Math.round(6 + k * 30); ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * (1 - k)).toFixed(2) + ')'; ctx.fillRect(Math.round(q.x - rw), w - 1, rw * 2, 2); }
        }
        ctx.restore();
        P.front(cx);
        P.overlay(cx, w);
        for (const [x0, y0, sp, ph] of [[-30, w - 46, 0.7, 0], [-70, w - 58, 0.6, 9]]) {
          const x = Math.round(x0 + t * sp), y = Math.round(y0 + Math.sin((t + ph) * 0.05) * 5);
          if (x > -12 && x < W + 12 && y < w - 6) spr(GULL[(t + ph) % 70 < 24 ? [0, 1, 2, 1][((t + ph) >> 2) & 3] : 1], x, y);
        }
        ctx.restore();
      }
      // letterbox bars and the caption
      const k = t < 10 ? ease(t / 10) : t > IT.out ? 1 - ease((t - IT.out) / (IT.end - IT.out)) : 1, bh = Math.round(BARS * k);
      if (bh > 0) {
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
        ctx.fillStyle = '#0c1c2a'; ctx.fillRect(0, bh - 1, W, 1); ctx.fillRect(0, H - bh, W, 1);
        const ca = Math.min(1, (t - 12) / 14, (IT.home - t) / 14);
        if (ca > 0) {
          ctx.globalAlpha = ca;
          const ty = H - bh + 8;
          text('CORAL KINGDOM', W / 2, ty, '#9ef4ee', 2, 'center', '#0a3a4a');
          for (const [fx, dir] of [[W / 2 - 104, 1], [W / 2 + 104, -1]]) { ctx.save(); ctx.translate(fx, ty + 7); ctx.scale(dir, 1); R(-5, -2, 8, 5, OUT); R(-4, -1, 6, 3, '#ff8a1c'); R(-1, -1, 1, 3, '#ffffff'); R(-7, -3, 3, 7, OUT); R(-6, -2, 2, 5, '#ff8a1c'); R(2, -1, 1, 1, OUT); ctx.restore(); }
          ctx.globalAlpha = 1;
        }
        if (t > 120 && t < IT.go && (t >> 4) % 2) text('ENTER: SKIP', W - 8, H - bh + 11, '#8a8aa0', 1, 'right', null);
      }
    }
  };
}
if (L && L4ART.reef) L.intro = makeIntro();
}
