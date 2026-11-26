'use strict';
var L2 = L2 || {};
// ============================================================
// Mission 2 world layer (VIGO HILLS): the ground, the granite house and the horreo, walls, gorse and ferns, the
// chestnut woods and the stream, the farm, the cherry orchard, the platforms, the foreground plants and the two
// interactive tree props (PROP_TYPES cherrytree, chestnuttree).
// L2 hooks: worldLoad, worldUpdate, drawBehind, drawGround, drawPlat, drawFront.
// Static art is built pixel by pixel into offscreen canvases (hard edges, OUT outlines, 3-tone shading) at load;
// the ground and the platforms are baked once the terrain is known (worldLoad). Each frame only the living parts are
// drawn on top: wind sway, water, smoke, the door, flags, puddles and rain sheen, falling petals and burrs.
// ============================================================
{
// ============================================================
// Build helpers: pixel buffers baked into canvases (deterministic: no Math.random anywhere in this file's drawing)
// ============================================================
const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
const P = (...s) => s.map(I);
const OUTI = I(OUT);
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// stable noise 0..1 per integer point
const NZ = (() => { const r = rng(20251101), a = new Float32Array(16384); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
const nz = (x, y) => NZ[(Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0 & 16383];

function buf(w, h) { const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d }; }
function put(b, x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x); y = Math.floor(y); return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
function oval(b, cx, cy, rx, ry, c) {
  const RX = rx + 0.5, RY = ry + 0.5;
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++)
    if (i * i / (RX * RX) + j * j / (RY * RY) <= 1) put(b, cx + i, cy + j, c);
}
function line(b, x0, y0, x1, y1, c, t = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) rect(b, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), t, t, c);
}
// 1px outline around everything drawn (against empty pixels)
function outline(b, c = OUTI) {
  const add = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++)
    if (b.d[y * b.w + x] === NONE && (get(b, x - 1, y) !== NONE || get(b, x + 1, y) !== NONE || get(b, x, y - 1) !== NONE || get(b, x, y + 1) !== NONE)) add.push(y * b.w + x);
  for (const i of add) b.d[i] = c;
}
// copy the drawn pixels of src onto dst at (dx, dy)
function stamp(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.d[y * src.w + x]; if (c !== NONE) put(dst, dx + x, dy + y, c); }
}
// outlined, shaded oval (light from the top right, like every Mission 1 sprite)
function pebble(b, cx, cy, rx, ry, pal) {
  oval(b, cx, cy, rx + 1, ry + 1, OUTI);
  const RX = rx + 0.5, RY = ry + 0.5;
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    if (i * i / (RX * RX) + j * j / (RY * RY) > 1) continue;
    const t = i / RX - j / RY;
    put(b, cx + i, cy + j, t > 0.75 ? pal[0] : t < -0.55 ? pal[2] : pal[1]);
  }
}
// tones by position inside a marked shape: light on top/right edges, dark on bottom/left edges
function shade(b, mark, L, M, D, lr = 1, dr = 1) {
  const m = new Uint8Array(b.w * b.h);
  for (let i = 0; i < m.length; i++) m[i] = b.d[i] === mark ? 1 : 0;
  const inM = (x, y) => x >= 0 && y >= 0 && x < b.w && y < b.h && m[y * b.w + x] === 1;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (!m[y * b.w + x]) continue;
    let c = M;
    for (let k = 1; k <= dr && c === M; k++) if (!inM(x, y + k) || !inM(x - k, y)) c = D;
    for (let k = 1; k <= lr && c === M; k++) if (!inM(x, y - k) || !inM(x + k, y)) c = L;
    b.d[y * b.w + x] = c;
  }
}
function bake(b, white) {
  const c = document.createElement('canvas'); c.width = b.w; c.height = b.h;
  const g = c.getContext('2d'), im = g.createImageData(b.w, b.h), d = im.data;
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = i * 4;
    if (white) d[j] = d[j + 1] = d[j + 2] = 255;
    else { d[j] = v >> 16 & 255; d[j + 1] = v >> 8 & 255; d[j + 2] = v & 255; }
    d[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// sprite: baked image drawn with its anchor at (x, y): top-left = (x + ox, y + oy)
function sprite(b, ox, oy, flash) { return { img: bake(b), white: flash ? bake(b, true) : null, w: b.w, h: b.h, ox, oy }; }

// ============================================================
// Runtime drawing helpers
// ============================================================
function blit(s, x, y) { ctx.drawImage(s.img, Math.round(x + s.ox), Math.round(y + s.oy)); }
// wind sway: horizontal slices, the top moves `amt` px and the bottom stays (rows = slice height). Neighbouring
// slices that land on the same pixel offset are drawn as one piece (same picture, far fewer drawImage calls).
function swayBlit(s, x, y, amt, rows, img) {
  const X = Math.round(x + s.ox), Y = Math.round(y + s.oy), im = img || s.img;
  let y0 = 0, off = null;
  for (let sy = 0; sy < s.h; sy += rows) {
    const sh = Math.min(rows, s.h - sy), k = 1 - (sy + sh / 2) / s.h, o = Math.round(amt * k * k);
    if (off !== null && o !== off) { ctx.drawImage(im, 0, y0, s.w, sy - y0, X + off, Y + y0, s.w, sy - y0); y0 = sy; }
    off = o;
  }
  if (off !== null) ctx.drawImage(im, 0, y0, s.w, s.h - y0, X + off, Y + y0, s.w, s.h - y0);
}
// hard-edged disc of rects in the current fillStyle (no anti-aliasing)
function pdisc(x, y, r) {
  x = Math.round(x); y = Math.round(y);
  for (let j = -r; j <= r; j++) { const hw = Math.round(Math.sqrt(r * r - j * j + r * 0.8)); ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1); }
}
// weather from level2_sky.js (rain 0..1, rainbow 0..1, wind -1..1), read once per frame
let wxT = -1, WX = { rain: 0, rainbow: 0, wind: 0.3 };
function weather() {
  if (wxT !== G.t) {
    wxT = G.t;
    const w = L2.weather ? L2.weather() : null;
    WX = w ? { rain: clamp(+w.rain || 0, 0, 1), rainbow: +w.rainbow || 0, wind: clamp(w.wind == null ? 0.3 : +w.wind, -1, 1) } : { rain: 0, rainbow: 0, wind: 0.3 };
  }
  return WX;
}
// sway offset (px) for something with phase ph: steady lean with the wind plus a gentle wobble
function sway(ph, amp) {
  const w = weather().wind;
  return amp * (0.6 * w + 0.4 * Math.sin(G.t * 0.035 + ph) + 0.15 * Math.sin(G.t * 0.09 + ph * 1.7)) * (0.6 + Math.abs(w) * 0.6);
}

// ============================================================
// Palettes
// ============================================================
const GRAN = P('#e2dac8', '#c9bfab', '#b2a792', '#978c78', '#6f675a');   // granite: light .. mortar
const GRANS = P('#d4cbb8', '#a99f8b', '#7b7366');                      // granite pebbles / speckles
const MOSS = P('#9ccc5a', '#6fa040', '#4a7a30', '#355a24');
const TILE = P('#f39064', '#e2724a', '#c9562f', '#a8411f', '#7c2c16');  // red clay roof tiles
const WOOD = P('#b0814f', '#8a6038', '#664527', '#47301c');
const DOORG = P('#5aa062', '#3f7d47', '#2c5c33', '#1e4024');            // green paint
const LEAF = P('#86c050', '#5a9a3e', '#3c7430', '#285422');
const STR = { gr: GRAN.map(c => '#' + c.toString(16).padStart(6, '0')) };

// ============================================================
// Ground: baked in 256px chunks once the terrain is known (grass, the path, earth with stones and roots, the
// stream); the living parts (swaying grass, flowers, water, rain sheen, puddles, light) are drawn each frame
// ============================================================
const CHW = 256, CHY = 160, CHH = H + 8 - CHY;
const ZX = [0, 250, 1350, 2850, 4400];   // zones: plateau lawn, hill path, chestnut woods, farm track, orchard
const ZW = [32, 128, 128, 128];          // the soil blends over this width at each border (narrow where the flagstones end)
const ZP = [
  { blade: P('#3c7a30', '#5ea443', '#94d45e'), face: P('#9ad864', '#7cc24f', '#62a842', '#4a8c38'), lip: P('#3a742f', '#28541f'), earth: P('#8f6342', '#755034', '#5a3d28', '#402b1d', '#2d1f16') },
  { blade: P('#3c7a30', '#5ea443', '#94d45e'), face: P('#ddba84', '#c7a370', '#ad8a5a', '#8e6f47'), lip: P('#4a8f3a', '#326628'), earth: P('#906240', '#764f33', '#5b3c27', '#412a1c', '#2e1f15'), path: true },
  { blade: P('#2e5e28', '#467e34', '#6ea048'), face: P('#6e5639', '#5c4630', '#4c3a28', '#3c2e20'), lip: P('#4a7a34', '#33582a'), earth: P('#6a4c35', '#563d2a', '#432f21', '#302218', '#221812'), woods: true },
  { blade: P('#5a8a30', '#7eae44', '#b0d468'), face: P('#c9a26c', '#b38e5c', '#9a784c', '#7e623e'), lip: P('#6a9a38', '#4c7428'), earth: P('#956a4a', '#7a5638', '#5e422b', '#43301f', '#2f2217'), path: true, farm: true },
  { blade: P('#3c7f32', '#5fab46', '#9ad866'), face: P('#9edc68', '#82c652', '#67ac44', '#4f9038'), lip: P('#3f7f33', '#2c5a24'), earth: P('#8f6342', '#755034', '#5a3d28', '#402b1d', '#2d1f16'), petals: true }
];
const LITTER = P('#d0843e', '#a85a2a', '#dcb44c', '#8a4a26');
const PETALS = P('#ffd0e2', '#ffffff', '#f7a8c6');
const PEB = P('#e6dccb', '#6e6252');
const ROOT = I('#4a3020'), ROOTW = I('#3a2618');
function zoneAt(x, y) {
  const j = nz(x >> 1, y >> 1) - 0.5;
  let z = 0;
  while (z < 4 && x + j * ZW[z] >= ZX[z + 1]) z++;
  return z;
}
function bladeH(x, z) {
  const a = nz(x, 11);
  if (z === 2) return a < 0.4 ? 1 + (nz(x, 12) * 3 | 0) : 0;
  if (z === 1 || z === 3) return a < 0.75 ? 1 + (nz(x, 12) * 4 | 0) : 0;
  return 1 + (a * 4 | 0);
}
const tuftLen = x => nz(x, 13) < 0.4 ? 1 + (nz(x, 14) * 3 | 0) : 0;

// The stream (x 1960-2180, bed y 240): water surface y 234; in front of the walking line the water keeps flowing
// toward the viewer down to the bottom of the screen, between pebbly banks
const WS = 234, WX0 = 1960, WX1 = 2180;
const chanL = y => 2006 - (y - WS) * 0.45, chanR = y => 2134 + (y - WS) * 0.45;
const inChan = (x, y) => y >= WS && x >= chanL(y) && x <= chanR(y);
const WATER = P('#6cbbe6', '#4f9fd2', '#3a86bd', '#2c6e9f', '#225a84');
const SHALLOW = P('#8ccbe8', '#79bcdc', '#a9b48e');
const BANK = P('#6a5643', '#564536', '#45372b', '#a8a090', '#7a7266');
const MUD = P('#6e5a44', '#5e4a38', '#4e3e30', '#40332a');
function waterPx(x, y, n) {
  const e = Math.min(x - chanL(y), chanR(y) - x);
  if (e < 2) return WATER[4];
  let k = Math.floor((y - WS) / 9 + n * 0.8);
  if (e < 5) k++;
  if ((y - WS) % 6 === 3 && nz(x >> 3, y) > 0.55) k--;
  return WATER[clamp(k, 0, 4)];
}

function groundPx(x, y, si) {
  const d = y - si, n = nz(x, y);
  if (x > WX0 && x < WX1) {                                   // the stream crossing
    if (y >= WS && y < si) return d === -1 ? SHALLOW[2] : SHALLOW[n < 0.5 ? 0 : 1];
    if (inChan(x, y)) return waterPx(x, y, n);
    if (d < 0) return NONE;
    if (d < 4) return si > WS ? (n > 0.9 ? BANK[3] : n < 0.08 ? BANK[4] : BANK[d >> 1]) : MUD[d];
    return n > 0.975 ? BANK[3] : n > 0.95 ? BANK[4] : BANK[clamp(1 + ((d - 4) / 22 + n * 0.6 | 0), 1, 2)];
  }
  if (x >= 104 && x <= 136 && d >= -2 && d <= 3) return stepPx(x, d);   // the doorstep
  const z = zoneAt(x, y), Z = ZP[z];
  if (d < 0) {                                                 // grass at the back edge of the path
    const h = bladeH(x, z);
    return -d > h ? NONE : -d === h ? Z.blade[2] : Z.blade[n < 0.55 ? 1 : 0];
  }
  if (d < 4) return facePx(x, y, d, z, Z, n);
  const tuft = Z.woods ? (nz(x, 13) < 0.25 ? 1 : 0) : tuftLen(x);
  if (d < 6 + tuft) return d === 4 ? Z.lip[0] : Z.lip[1];
  if (d === 6 + tuft) return Z.earth[2];                       // shadow under the grass lip
  let k = Math.floor((d - 6) / 19 + n * 0.85);
  const s1 = 15 + Math.round(2 * Math.sin(x * 0.045)), s2 = 33 + Math.round(3 * Math.sin(x * 0.028 + 2)), s3 = 56 + Math.round(3 * Math.sin(x * 0.02));
  if ((d === s1 || d === s2 || d === s3) && nz(x >> 2, d) > 0.3) k++;
  if (n > 0.972) k--;
  return Z.earth[clamp(k, 0, 4)];
}
// granite flagstones from the door to the garden gate, a big doorstep slab
let FLAGS = null;
function flagEdge(x) {
  if (!FLAGS) { FLAGS = new Set(); for (let x = 98; x < 300; x += 9 + (nz(x, 5) * 7 | 0)) FLAGS.add(x); }
  return FLAGS.has(x);
}
function facePx(x, y, d, z, Z, n) {
  if (z === 0 && x > 98 && x < 296) {
    if (d === 3) return Z.face[3];
    if (flagEdge(x)) return d === 0 && nz(x, 6) > 0.4 ? Z.blade[1] : GRAN[4];
    return d === 0 ? GRAN[0] : d === 1 ? (n > 0.9 ? GRAN[3] : GRAN[1]) : GRAN[3];
  }
  if (Z.woods) {
    if (nz(x >> 2, 77) > 0.62 && d < 2) return d === 0 ? MOSS[1] : MOSS[2];
    const l = nz(x, y + 500);
    if (l > 0.88) return LITTER[(l * 97 | 0) % 4];
    return Z.face[clamp(d + (n < 0.2 ? -1 : n > 0.85 ? 1 : 0), 0, 3)];
  }
  if (Z.path) {
    if (d === 0 && nz(x, 7) > 0.82) return Z.blade[1];
    if (n > 0.94) return PEB[0];
    if (n < 0.04) return PEB[1];
    if (Z.farm && (d === 1 || d === 3) && nz(x >> 3, 9 + d) > 0.3) return Z.face[3];
    return Z.face[clamp(d + (n < 0.2 ? -1 : n > 0.85 ? 1 : 0), 0, 3)];
  }
  if (Z.petals && nz(x, y + 3000) > 0.9) return PETALS[(n * 3) | 0];
  if (nz(x, y + 4000) > 0.985) return n > 0.5 ? I('#ffffff') : I('#ffe066');
  return Z.face[clamp(d + (n < 0.3 ? 0 : n > 0.8 ? 1 : 0), 0, 3)];
}
function stepPx(x, d) {
  if (x === 104 || x === 136 || d === -2 && (x === 105 || x === 135)) return d === -2 && (x === 104 || x === 136) ? NONE : OUTI;
  if (d === -2) return OUTI;
  if (d === -1) return x > 128 ? GRAN[0] : GRAN[1];
  if (d === 3) return GRAN[4];
  return d === 0 ? GRAN[2] : nz(x, d) > 0.85 ? GRAN[4] : GRAN[3];
}

let chunks = null;
function buildChunks() {
  chunks = [];
  for (let x0 = 0; x0 < LV.end + CHW; x0 += CHW) {
    const b = buf(CHW, CHH);
    for (let lx = 0; lx < CHW; lx++) {
      const x = x0 + lx, si = Math.round(groundAt(x + 0.5));
      for (let y = Math.max(CHY, si - 6); y < CHY + CHH; y++) {
        const c = groundPx(x, y, si);
        if (c !== NONE) b.d[(y - CHY) * CHW + lx] = c;
      }
    }
    groundFeatures(b, x0);
    chunks.push(bake(b));
  }
}
// roots, pebbles and granite boulders in the earth (per world cell, so they run on across chunk borders)
function groundFeatures(b, x0) {
  const X = x => x - x0, Y = y => y - CHY, wet = x => x > WX0 - 12 && x < WX1 + 12;
  for (let x = x0 - 24; x < x0 + CHW + 24; x++) {
    const z = zoneAt(x, 0), r = nz(x, 31);
    if (wet(x) || r > (z === 2 ? 0.1 : 0.04)) continue;
    const thick = z === 2 && nz(x, 34) > 0.5, len = 4 + nz(x, 32) * (z === 2 ? 18 : 10);
    let rx = x, ry = Math.round(groundAt(x)) + 6;
    for (let i = 0; i < len; i++) {
      put(b, X(rx), Y(ry), z === 2 ? ROOTW : ROOT);
      if (thick && i < len * 0.6) put(b, X(rx + 1), Y(ry), ROOTW);
      ry++;
      const w = nz(x + i * 7, 33);
      if (w < 0.25) rx--; else if (w > 0.75) rx++;
    }
  }
  // granite boulders (bolos) in the hillside and the fields
  for (let c = Math.floor((x0 - 60) / 150); c * 150 < x0 + CHW + 60; c++) {
    if (nz(c, 800) < 0.55) continue;
    const x = c * 150 + 20 + (nz(c, 801) * 110 | 0), z = zoneAt(x, 0);
    if (wet(x) || z === 2) continue;
    const rx = 6 + (nz(c, 802) * 6 | 0), ry = 3 + (nz(c, 803) * 3 | 0), y = Math.round(groundAt(x)) + 24 + (nz(c, 804) * 34 | 0);
    bolo(b, X(x), Y(y), rx, ry, c);
  }
  for (let c = Math.floor((x0 - 24) / 32); c * 32 < x0 + CHW + 24; c++) {
    const n = nz(c, 900) * 3 | 0;
    for (let k = 0; k < n; k++) {
      const x = c * 32 + (nz(c, 910 + k) * 32 | 0), d = 12 + (Math.pow(nz(c, 920 + k), 1.4) * 72 | 0);
      const rx = 1 + (nz(c, 930 + k) * 3.5 | 0), ry = 1 + (nz(c, 940 + k) * 2.2 | 0), y = Math.round(groundAt(x)) + d;
      if (y + ry > H + 4 || wet(x)) continue;
      pebble(b, X(x), Y(y), rx, ry, d > 50 ? [GRANS[1], GRANS[2], I('#5a544a')] : GRANS);
    }
  }
  // the dry-stone terrace wall holding up the plateau under the house (x 0-256): granite courses, mossy joints, ferns
  if (x0 < 264) {
    const top = 183, bot = 222, R0 = 256;
    granite(b, X(-8), Y(top), 264, bot - top, [7, 8, 7, 8, 9], 77, X(R0));
    // a tone darker than the sunlit house walls: it faces us in the shade of the grass lip
    const dim = new Map([[GRAN[0], GRAN[1]], [GRAN[1], GRAN[2]], [GRAN[2], GRAN[3]], [I('#f0eadc'), GRAN[1]], [I('#f4efe4'), GRAN[1]]]);
    for (let x = Math.max(x0, 0); x < Math.min(x0 + CHW, R0); x++) for (let y = top; y < bot; y++) {
      const c = get(b, X(x), Y(y));
      if (dim.has(c)) put(b, X(x), Y(y), y < top + 3 && c !== GRAN[0] ? GRAN[3] : dim.get(c));
    }
    for (let x = Math.max(x0, 0); x < Math.min(x0 + CHW, R0); x++) {
      put(b, X(x), Y(top), get(b, X(x), Y(top)) === GRAN[4] ? GRAN[3] : GRAN[2]);
      put(b, X(x), Y(bot), OUTI); put(b, X(x), Y(bot + 1), ZP[0].earth[3]);
      for (let y = top + 1; y < bot; y++) if (get(b, X(x), Y(y)) === GRAN[4] && nz(x, y + 700) > 0.82) put(b, X(x), Y(y), nz(x, y) > 0.5 ? MOSS[1] : MOSS[2]);
    }
    for (let y = top; y <= bot; y++) { put(b, X(R0), Y(y), OUTI); put(b, X(R0 - 1), Y(y), GRAN[0]); }
    // ferns growing out of the joints, a weep hole
    for (const [fx, fy] of [[34, 199], [146, 214], [218, 191]]) stamp(b, fernBuf(12, 8, fx, FERNP), X(fx - 6), Y(fy - 7));
    for (const [hx, hy] of [[92, 205], [196, 205]]) { rect(b, X(hx), Y(hy), 4, 3, I('#2a2420')); rect(b, X(hx), Y(hy + 3), 4, 1, GRAN[0]); put(b, X(hx + 1), Y(hy + 4), MOSS[2]); }
  }
  // river stones in the stream, pebbles on its banks
  if (x0 < WX1 && x0 + CHW > WX0) {
    for (const [x, y, rx, ry] of [[2040, 251, 6, 3], [2104, 262, 7, 4], [2072, 246, 3, 1], [1996, 258, 4, 2], [2146, 255, 4, 2], [2012, 266, 3, 2], [2130, 247, 3, 1],
      [1972, 249, 3, 2], [1982, 263, 4, 2], [1968, 258, 2, 1], [2164, 262, 4, 2], [2174, 247, 3, 2], [2182, 256, 2, 1]]) pebble(b, X(x), Y(y), rx, ry, GRANS);
  }
}
function bolo(b, cx, cy, rx, ry, seed) {
  pebble(b, cx, cy, rx, ry, [GRAN[2], GRAN[3], I('#7d7363')]);
  // earth caked on its lower half
  for (let j = 1; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    const c = get(b, cx + i, cy + j);
    if (c !== NONE && c !== OUTI && j > ry * 0.4 + nz(cx + i, seed) * 2) put(b, cx + i, cy + j, I('#6a5040'));
  }
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    if (get(b, cx + i, cy + j) === OUTI) continue;
    if (i * i / ((rx + 0.5) * (rx + 0.5)) + j * j / ((ry + 0.5) * (ry + 0.5)) > 1) continue;
    const n = nz(cx + i + seed * 31, cy + j);
    if (n > 0.93) put(b, cx + i, cy + j, I('#5e584e'));
    else if (n < 0.05) put(b, cx + i, cy + j, GRAN[0]);
  }
  // a crack and a spot of lichen
  let x = cx - (rx >> 1), y = cy - ry + 1;
  for (let k = 0; k < ry * 1.4; k++) { put(b, x, y, GRAN[4]); y++; if (nz(seed, k) > 0.6) x++; }
  oval(b, cx + (rx >> 1), cy - (ry >> 1), 1, 1, I('#c9c46c'));
}

function drawChunks(cx) {
  if (!chunks) return;
  for (let i = Math.max(0, Math.floor(cx / CHW)); i * CHW < cx + W && i < chunks.length; i++) ctx.drawImage(chunks[i], i * CHW, CHY);
}

// ============================================================
// Platforms (wall, stump, hay, cart, boulder): baked once each, from the top at pl.y down to the slope under it
// ============================================================
const platArt = new Map();
function buildPlat(pl) {
  const x0 = pl.x - 8, top = pl.y - 7, gl = x => Math.round(groundAt(x + 0.5));
  const bot = Math.max(gl(pl.x), gl(pl.x + pl.w)) + 4;
  const b = buf(pl.w + 16 + (pl.t === 'cart' ? 18 : 0), bot - top + 1);
  const L = pl.x - x0, T = pl.y - top;                 // plat top-left in buffer coordinates
  const gy = lx => gl(lx + x0) - top;                  // ground under buffer column lx
  ({ wall: platWall, stump: platStump, hay: platHay, cart: platCart, boulder: platBoulder }[pl.t] || platWall)(b, L, T, pl.w, gy);
  platArt.set(pl, sprite(b, -L, -T));
}
// granite blocks in courses, moss on the capstones
function platWall(b, L, T, w, gy) {
  const MK = 1;
  for (let x = L; x < L + w; x++) for (let y = T + 4; y <= gy(x) + 1; y++) put(b, x, y, MK);
  // courses of blocks
  let y = T + 4, row = 0;
  while (y < b.h) {
    const ch = 6 + (nz(row, 70) * 3 | 0);
    let x = L - (row % 2 ? 6 : 0) - (nz(row, 71) * 5 | 0);
    while (x < L + w) {
      const bw = 9 + (nz(x, row + 72) * 8 | 0), tone = nz(x, row + 73);
      for (let j = 0; j < ch; j++) for (let i = 0; i < bw; i++) {
        const px = x + i, py = y + j;
        if (get(b, px, py) !== MK && get(b, px, py) < 16) continue;
        if (px < L || px >= L + w) continue;
        let c = tone < 0.3 ? GRAN[2] : tone > 0.8 ? GRAN[0] : GRAN[1];
        if (i === bw - 1 || j === ch - 1) c = GRAN[4];
        else if (j === ch - 2 || i === 0) c = GRAN[3];
        else if (j === 0 || i === bw - 2) c = tone > 0.8 ? I('#f0eadc') : GRAN[0];
        const n = nz(px * 3, py * 5);
        if (c !== GRAN[4] && n > 0.94) c = I('#7d7466');
        put(b, px, py, c);
      }
      if (tone > 0.86) { put(b, x + 3, y + 2, I('#c9c46c')); put(b, x + 4, y + 2, I('#c9c46c')); put(b, x + 4, y + 3, I('#d99a55')); }
      x += bw;
    }
    y += ch; row++;
  }
  // capstones overhanging a pixel, mossy on top with drips down the face
  for (let x = L - 1; x <= L + w; x++) for (let j = 0; j < 4; j++) put(b, x, T + j, j === 0 ? GRAN[0] : j === 3 ? GRAN[3] : (nz(x, 90) > 0.85 ? GRAN[2] : GRAN[1]));
  for (let x = L - 1; x <= L + w; x += 7 + (nz(x, 91) * 6 | 0)) put(b, x, T + 1, GRAN[4]), put(b, x, T + 2, GRAN[4]);
  for (let x = L - 1; x <= L + w; x++) {
    const m = nz(x >> 1, 92);
    if (m < 0.25) continue;
    put(b, x, T - 1, m > 0.6 ? MOSS[0] : MOSS[1]);
    if (m > 0.55) put(b, x, T - 2, MOSS[1]);
    put(b, x, T, MOSS[2]);
    if (nz(x, 93) > 0.8) for (let k = 1; k <= 1 + (nz(x, 94) * 3 | 0); k++) put(b, x, T + k, MOSS[k > 1 ? 3 : 2]);
  }
  outline(b);
  baseTufts(b, L, w, gy);
}
// a cut chestnut stump with rings, roots and a few mushrooms
function platStump(b, L, T, w, gy) {
  const BK = P('#9a7650', '#74543a', '#54392a', '#3a271c');
  for (let x = L - 4; x < L + w + 4; x++) {
    const flare = x < L ? L - x : x >= L + w ? x - (L + w - 1) : 0;
    for (let y = T + 2 + flare * 3; y <= gy(x) + 1; y++) {
      const g = (x - L + Math.round((y - T) * 0.15)) % 6;
      let c = g === 0 ? BK[3] : g === 1 ? BK[2] : g === 4 ? BK[0] : BK[1];
      if (x < L + 2 || flare) c = c === BK[0] ? BK[1] : BK[2];
      if (nz(x, y) > 0.92) c = BK[3];
      put(b, x, y, c);
    }
  }
  // moss on the shady left side
  for (let y = T + 6; y < gy(L) - 2; y++) if (nz(y, 40) > 0.4) { put(b, L, y, MOSS[2]); if (nz(y, 41) > 0.5) put(b, L + 1, y, MOSS[1]); }
  // the cut face: rings
  const cx = L + (w >> 1), ry = 2, rx = (w >> 1) + 1;
  oval(b, cx, T + 2, rx, ry, BK[2]);
  oval(b, cx, T + 2, rx - 1, ry - 1, I('#e4bf86'));
  for (let i = -rx + 2; i < rx - 1; i++) if (Math.abs(i) % 4 === 2) put(b, cx + i, T + 2, I('#b8884e'));
  put(b, cx, T + 2, I('#8a5a30')); put(b, cx + 1, T + 1, I('#f2d6a6')); put(b, cx - 3, T + 1, I('#f2d6a6'));
  line(b, cx, T + 2, cx + rx - 2, T + 3, I('#6a4426'));
  outline(b);
  // mushrooms at the foot
  const mx = L + w - 4, my = gy(L + w - 4);
  for (const [dx, h, c] of [[0, 4, I('#d8402e')], [4, 3, I('#c88a3a')]]) {
    rect(b, mx + dx, my - h, 1, h, I('#efe6d2'));
    oval(b, mx + dx, my - h, 2, 1, c);
    put(b, mx + dx - 1, my - h - 1, I('#ffffff'));
  }
  baseTufts(b, L - 4, w + 8, gy);
}
// golden bales with twine (two stacked when tall)
function platHay(b, L, T, w, gy) {
  const HY = P('#fbe9a0', '#ecce6c', '#d3b04e', '#a8873a', '#7a612a');
  const H0 = gy(L) - T, two = H0 > 27;
  const bales = two ? [[T, Math.round(H0 / 2) + 1, 0], [T + Math.round(H0 / 2), b.h, 3]] : [[T, b.h, 0]];
  bales.forEach(([y0, y1, sh], k) => {
    const x0 = L + (k === 0 && two ? 2 : 0) - (k === 1 ? 1 : 0), ww = w - (k === 0 && two ? 4 : 0) + (k === 1 ? 2 : 0);
    for (let x = x0; x < x0 + ww; x++) {
      const yb = Math.min(y1, gy(x) + 1);
      for (let y = y0; y <= yb; y++) {
        const corner = (x === x0 || x === x0 + ww - 1) && (y === y0 || y === yb);
        if (corner) continue;
        const s = nz(x >> 1, y * 3 + sh);
        let c = y === y0 ? HY[0] : y === yb ? HY[3] : s > 0.7 ? HY[0] : s > 0.3 ? HY[1] : HY[2];
        if (x === x0) c = HY[3];
        if (x === x0 + ww - 1 && y > y0) c = HY[1];
        if (nz(x, y + sh) > 0.93) c = HY[4];
        put(b, x, y, c);
      }
      // twine bands
    }
    for (const tx of [x0 + Math.round(ww / 3), x0 + Math.round(ww * 2 / 3)])
      for (let y = y0; y <= Math.min(y1, gy(tx) + 1); y++) put(b, tx, y, (y - y0) % 3 === 0 ? I('#c0583a') : I('#8a3a26'));
  });
  outline(b);
  // loose straws
  for (let x = L + 1; x < L + w - 1; x += 3 + (nz(x, 60) * 4 | 0)) { put(b, x, T - 1, HY[1]); if (nz(x, 61) > 0.5) put(b, x + 1, T - 2, HY[0]); }
  for (let y = T + 4; y < gy(L) - 2; y += 5) put(b, L - 2, y, HY[2]);
}
// a Galician ox cart: plank bed, one big solid wooden wheel, the long shaft resting on the ground
function platCart(b, L, T, w, gy) {
  const WD = WOOD;
  // shaft down to the ground on the right
  const sx = L + w - 2, ex = L + w + 16;
  line(b, sx, T + 4, ex, gy(ex) - 2, WD[2], 2);
  // axle block under the bed
  rect(b, L + (w >> 1) - 6, T + 6, 12, 3, WD[3]);
  // the bed: a long side board with nails and end posts
  for (let x = L; x < L + w; x++) for (let y = T; y < T + 6; y++) put(b, x, y, y === T ? WD[0] : y === T + 5 ? WD[3] : y === T + 3 ? WD[2] : WD[1]);
  for (let x = L + 3; x < L + w - 2; x += 8) put(b, x, T + 1, I('#3a3a40')), put(b, x, T + 4, I('#3a3a40'));
  rect(b, L, T - 3, 3, 9, WD[1]); rect(b, L + w - 3, T - 3, 3, 9, WD[1]); put(b, L + 2, T - 3, WD[0]); put(b, L + w - 1, T - 3, WD[0]);
  outline(b);
  // the wheel: solid planks, two crescent holes, iron rim
  const cx = L + (w >> 1), r = Math.min(12, gy(cx) - T - 3), cy = gy(cx) - r;
  const wb = buf(b.w, b.h);
  oval(wb, cx, cy, r, r, I('#2c2c34'));
  oval(wb, cx, cy, r - 1, r - 1, WD[1]);
  for (let j = -r + 1; j < r; j++) for (let i = -r + 1; i < r; i++) {
    if (get(wb, cx + i, cy + j) !== WD[1]) continue;
    const k = (i + r) % 7;
    put(wb, cx + i, cy + j, k === 0 ? WD[3] : i - j > r * 0.6 ? WD[0] : i - j < -r * 0.7 ? WD[2] : WD[1]);
  }
  for (const s of [-1, 1]) for (let a = -0.9; a <= 0.9; a += 0.1) {
    const rr = r * 0.55;
    put(wb, cx + Math.round(Math.sin(a) * rr * 0.6) + s * Math.round(r * 0.45), cy + Math.round(Math.cos(a) * rr * s * 0.0 + Math.sin(a * 2) * 0), WD[3]);
  }
  for (const s of [-1, 1]) oval(wb, cx + s * Math.round(r * 0.5), cy, 1, Math.round(r * 0.45), I('#1e1610'));
  oval(wb, cx, cy, 2, 2, I('#3a3a40')); put(wb, cx + 1, cy - 1, I('#8a8a94'));
  outline(wb);
  stamp(b, wb, 0, 0);
}
// a big mossy granite boulder, speckled
function platBoulder(b, L, T, w, gy) {
  const MK = 1, h0 = gy(L + (w >> 1)) - T;
  for (let x = L - 3; x < L + w + 3; x++) for (let y = T; y <= gy(x) + 1; y++) {
    const t = (y - T) / h0, half = w / 2 * (0.82 + 0.22 * Math.sin(Math.min(1, t) * 2.6)) + 0.5;
    if (Math.abs(x + 0.5 - (L + w / 2)) <= half) put(b, x, y, MK);
  }
  shade(b, MK, 3, 2, 1, 2, 2);
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v < 1 || v > 3) continue;
    const x = i % b.w, y = i / b.w | 0, n = nz(x * 7 + L, y * 3);
    b.d[i] = n > 0.95 ? I('#4e4b46') : n > 0.91 ? I('#c6a28e') : n < 0.04 ? I('#f2efe8') : [0, GRAN[3], GRAN[2], GRAN[1]][v];
  }
  // cracks
  let x = L + (w * 0.35 | 0), y = T + 4;
  for (let k = 0; k < h0 * 0.6; k++) { put(b, x, y, GRAN[4]); y++; if (nz(k, L) > 0.55) x--; }
  // moss cap with drips
  for (let x = L - 1; x < L + w + 1; x++) {
    let top = T; while (top < b.h && get(b, x, top) === NONE) top++;
    if (top >= b.h || nz(x >> 1, 95) < 0.15) continue;
    put(b, x, top, MOSS[0]); put(b, x, top + 1, MOSS[1]); put(b, x, top + 2, nz(x, 96) > 0.5 ? MOSS[2] : get(b, x, top + 2));
    if (nz(x, 97) > 0.82) for (let k = 3; k < 3 + (nz(x, 98) * 5 | 0); k++) put(b, x, top + k, MOSS[k > 4 ? 3 : 2]);
  }
  outline(b);
  baseTufts(b, L - 3, w + 6, gy);
}
// grass blades along the foot of a platform (in front of it)
function baseTufts(b, L, w, gy) {
  for (let x = L; x < L + w; x++) {
    const n = nz(x, 99);
    if (n < 0.45) continue;
    const h = 1 + (n * 4 | 0), g = gy(x) + 1;
    for (let k = 0; k < h; k++) put(b, x, g - k, k === h - 1 ? LEAF[1] : LEAF[2]);
  }
}

// ============================================================
// The house (x 40-170 on the plateau, ground y 176, front door centred at x 120) and the horreo (x 190-245)
// ============================================================
const HX = 26, HY = 62;                                 // house sprite origin (world)
function granite(b, x0, y0, w, h, courses, seed, x1 = x0 + w) {
  // ashlar: courses of blocks with mortar, speckles and lichen (light from the top right)
  let y = y0, row = 0;
  for (const ch of courses) {
    let x = x0 - (row % 2 ? 7 : 0) - (nz(row, seed) * 6 | 0);
    while (x < x1) {
      const bw = 10 + (nz(x, row + seed) * 9 | 0), tone = nz(x + 1, row + seed + 1);
      for (let j = 0; j < ch; j++) for (let i = 0; i < bw; i++) {
        const px = x + i, py = y + j;
        if (px < x0 || px >= x1) continue;
        let c = tone < 0.28 ? GRAN[2] : tone > 0.82 ? GRAN[0] : GRAN[1];
        if (i === bw - 1 || j === ch - 1) c = GRAN[4];
        else if (j === ch - 2 || i === 0) c = GRAN[3];
        else if (j === 0 || i === bw - 2) c = tone > 0.82 ? I('#f0eadc') : GRAN[0];
        const n = nz(px * 3 + seed, py * 5);
        if (c !== GRAN[4] && n > 0.95) c = I('#7d7466'); else if (c !== GRAN[4] && n < 0.03) c = I('#f4efe4');
        put(b, px, py, c);
      }
      if (tone > 0.88 && bw > 11) { put(b, x + 3, y + 2, I('#c9c46c')); put(b, x + 4, y + 2, I('#c9c46c')); put(b, x + 4, y + 3, I('#d99a55')); put(b, x + 5, y + 3, I('#c9c46c')); }
      x += bw;
    }
    y += ch; row++;
  }
}
function tileRoof(b, xl, xr, top, bot, cw, crh) {
  // curved clay tiles in columns (caps and channels), courses with scalloped lips, the hips edged with tiles
  for (let y = top; y <= bot; y++) {
    const inset = Math.round((bot - y) * (xl[1] / (bot - top)));
    for (let x = xl[0] + inset; x <= xr - inset; x++) {
      const ph = (x - xl[0]) % cw, r = (bot - y) % crh, tid = nz((x - xl[0]) / cw | 0, (bot - y) / crh | 0);
      let c = ph === 0 ? TILE[4] : ph === cw - 1 ? TILE[3] : ph === 1 ? TILE[2] : ph === 2 ? TILE[1] : TILE[2];
      if (r === 0) c = ph === 0 || ph === cw - 1 ? TILE[4] : ph === 2 ? TILE[2] : TILE[3];
      else if (r === crh - 1 && ph === 2) c = TILE[0];
      if (tid > 0.86 && c !== TILE[4]) c = c === TILE[1] ? I('#c87a54') : I('#b0603e');
      if (tid < 0.06 && r > 1 && ph > 0) c = nz(x, y) > 0.5 ? MOSS[2] : MOSS[1];
      const e = Math.min(x - (xl[0] + inset), xr - inset - x);
      if (e < 2) c = e === 0 ? TILE[3] : ((bot - y) % 3 === 0 ? TILE[4] : TILE[0]);
      put(b, x, y, c);
    }
  }
  // scalloped eave: the rounded ends of the cap tiles
  for (let x = xl[0]; x <= xr; x++) { const ph = (x - xl[0]) % cw; if (ph >= 1 && ph <= cw - 2) put(b, x, bot + 1, ph === 2 ? TILE[2] : TILE[3]); }
}
function buildHouse() {
  const b = buf(160, 116), o = (x, y) => [x - HX, y - HY];
  const at = (f, x, y, ...a) => f(b, x - HX, y - HY, ...a);
  // walls
  granite(b, 42 - HX, 118 - HY, 126, 58, [7, 8, 7, 8, 7, 8, 7, 6], 11);
  // corner quoins
  for (const qx of [42, 160]) {
    let y = 118, k = 0;
    for (const ch of [7, 8, 7, 8, 7, 8, 7, 6]) {
      const qw = k % 2 ? 8 : 12, x0 = qx === 42 ? 42 : 168 - qw;
      for (let j = 0; j < ch; j++) for (let i = 0; i < qw; i++) {
        let c = j === 0 ? GRAN[0] : j === ch - 1 ? GRAN[4] : i === 0 ? GRAN[3] : i === qw - 1 ? GRAN[0] : GRAN[1];
        if (j === ch - 1 || (qx === 42 ? i === qw - 1 : i === 0) && j < ch - 1 && false) c = GRAN[4];
        if (nz(x0 + i, y + j) > 0.95) c = I('#7d7466');
        at(put, x0 + i, y + j, c);
      }
      at(rect, qx === 42 ? 42 + qw : 168 - qw - 1, y, 1, ch, GRAN[4]);
      y += ch; k++;
    }
  }
  // shadow under the eaves
  for (let x = 42; x < 168; x++) for (let y = 119; y < 124; y++) {
    const [lx, ly] = o(x, y), c = get(b, lx, ly);
    if (c === NONE) continue;
    put(b, lx, ly, y < 121 ? GRAN[4] : c === GRAN[0] ? GRAN[2] : c === GRAN[1] ? GRAN[3] : GRAN[4]);
  }
  // door frame: big granite lintel and jambs (the opening is drawn each frame: interior + door)
  const fr = buf(b.w, b.h);
  const fput = (x, y, w, h, c) => rect(fr, x - HX, y - HY, w, h, c);
  fput(105, 134, 30, 6, GRAN[1]); fput(105, 134, 30, 1, GRAN[0]); fput(105, 139, 30, 1, GRAN[3]);
  fput(119, 134, 2, 6, GRAN[2]); // keystone joints
  for (const jx of [105, 130]) { fput(jx, 140, 5, 36, GRAN[1]); fput(jx + 4, 140, 1, 36, GRAN[0]); fput(jx, 140, 1, 36, GRAN[3]); fput(jx, 157, 5, 1, GRAN[4]); }
  outline(fr);
  for (let i = 0; i < fr.d.length; i++) if (fr.d[i] !== NONE) b.d[i] = fr.d[i];
  for (let y = 140; y < 176; y++) for (let x = 110; x < 130; x++) at(put, x, y, NONE);
  // windows with shutters and geranium boxes
  for (const wx of [64, 141]) houseWindow(b, wx - HX, 132 - HY);
  // bench
  const bn = buf(24, 16);
  rect(bn, 1, 1, 21, 3, GRAN[1]); rect(bn, 1, 1, 21, 1, GRAN[0]); rect(bn, 1, 3, 21, 1, GRAN[3]);
  rect(bn, 3, 4, 4, 10, GRAN[2]); rect(bn, 16, 4, 4, 10, GRAN[2]); rect(bn, 6, 4, 1, 10, GRAN[3]); rect(bn, 19, 4, 1, 10, GRAN[3]);
  outline(bn); stamp(b, bn, 85 - HX, 161 - HY);
  // roof
  const rf = buf(b.w, b.h);
  tileRoof(rf, [32 - HX, 30], 178 - HX, 92 - HY, 118 - HY, 5, 5);
  // ridge tiles
  for (let x = 60; x <= 150; x++) {
    const ph = (x - 60) % 6;
    for (let y = 88; y < 93; y++) {
      let c = y === 88 ? TILE[0] : y === 92 ? TILE[4] : y === 91 ? TILE[3] : TILE[1];
      if (ph === 0) c = TILE[4]; else if (ph === 1 && y < 91) c = TILE[0];
      rect(rf, x - HX, y - HY, 1, 1, c);
    }
  }
  outline(rf);
  stamp(b, rf, 0, 0);
  // eave shadow line on the wall
  for (let x = 40; x < 170; x++) if (get(b, x - HX, 120 - HY) !== NONE && get(b, x - HX, 120 - HY) !== OUTI) put(b, x - HX, 120 - HY, GRAN[4]);
  // chimney: granite stack, a slab on two posts
  const ch = buf(b.w, b.h);
  granite(ch, 136 - HX, 72 - HY, 12, 30, [5, 6, 5, 6, 8], 41);
  for (let y = 72; y < 102; y++) { put(ch, 136 - HX, y - HY, GRAN[3]); put(ch, 147 - HX, y - HY, GRAN[0]); }
  rect(ch, 134 - HX, 66 - HY, 16, 3, GRAN[1]); rect(ch, 134 - HX, 66 - HY, 16, 1, GRAN[0]); rect(ch, 134 - HX, 68 - HY, 16, 1, GRAN[3]);
  rect(ch, 137 - HX, 69 - HY, 2, 3, GRAN[2]); rect(ch, 145 - HX, 69 - HY, 2, 3, GRAN[2]); rect(ch, 139 - HX, 69 - HY, 6, 3, I('#2a2420'));
  outline(ch);
  for (let y = 0; y < ch.h; y++) for (let x = 0; x < ch.w; x++) { const c = ch.d[y * ch.w + x]; if (c !== NONE && y + HY < 104) put(b, x, y, c); }
  // hydrangeas at the corners
  stamp(b, hydrangea(1), 40 - HX, 158 - HY);
  stamp(b, hydrangea(2), 152 - HX, 159 - HY);
  outline(b);
  return sprite(b, HX, HY);
}
function houseWindow(b, x, y) {
  const w = buf(32, 30), X = 8, Y = 4;   // window frame top-left at (X, Y) in this little buffer
  // lintel and sill
  rect(w, X - 2, Y - 4, 18, 4, GRAN[1]); rect(w, X - 2, Y - 4, 18, 1, GRAN[0]); rect(w, X - 2, Y - 1, 18, 1, GRAN[3]);
  rect(w, X - 3, Y + 16, 20, 2, GRAN[1]); rect(w, X - 3, Y + 16, 20, 1, GRAN[0]);
  // deep reveal, white frame, four panes with a lace curtain
  rect(w, X, Y, 14, 16, I('#3e3a34'));
  rect(w, X + 2, Y + 1, 12, 15, I('#f4f2ec'));
  for (const [px, py] of [[X + 3, Y + 2], [X + 9, Y + 2], [X + 3, Y + 9], [X + 9, Y + 9]]) {
    rect(w, px, py, 4, 6, I('#5d86a8'));
    rect(w, px, py, 4, 2, I('#8fb8d4'));
    put(w, px + 3, py + 2, I('#d8ecf6')); put(w, px + 2, py + 3, I('#d8ecf6'));
    if (py === Y + 2) { rect(w, px, py, 4, 1, I('#eef0f0')); put(w, px + (px === X + 3 ? 0 : 3), py + 1, I('#e2e6e8')); }
  }
  rect(w, X + 2, Y + 15, 12, 1, I('#c9c5bb'));
  // shutters, open against the wall
  for (const sx of [X - 7, X + 15]) {
    rect(w, sx, Y, 6, 16, DOORG[1]);
    for (let j = 0; j < 16; j++) { put(w, sx + 2, Y + j, DOORG[2]); put(w, sx + 5, Y + j, DOORG[0]); put(w, sx, Y + j, DOORG[2]); }
    for (let k = 0; k < 6; k++) put(w, sx + k, Y + 13 - k * 2, DOORG[3]);
    rect(w, sx, Y + 3, 6, 1, DOORG[3]); rect(w, sx, Y + 12, 6, 1, DOORG[3]);
  }
  outline(w);
  // geranium box
  const fb = buf(32, 30);
  rect(fb, X - 1, Y + 19, 16, 4, WOOD[1]); rect(fb, X - 1, Y + 19, 16, 1, WOOD[0]); rect(fb, X - 1, Y + 22, 16, 1, WOOD[2]);
  for (let k = 0; k < 5; k++) {
    const lx = X - 1 + k * 3 + (k % 2);
    oval(fb, lx + 1, Y + 17, 2, 1, k % 2 ? LEAF[2] : LEAF[1]);
  }
  for (const [fx, fy] of [[X + 1, Y + 14], [X + 6, Y + 13], [X + 11, Y + 14], [X + 3, Y + 16], [X + 9, Y + 16]]) {
    rect(fb, fx, fy, 3, 2, I('#e0303a')); put(fb, fx + 1, fy, I('#ff7a7a')); put(fb, fx, fy + 1, I('#a01e28'));
  }
  put(fb, X - 1, Y + 23, LEAF[2]); put(fb, X + 4, Y + 23, LEAF[2]); put(fb, X + 4, Y + 24, LEAF[1]); put(fb, X + 13, Y + 23, LEAF[2]);
  outline(fb);
  stamp(w, fb, 0, 0);
  stamp(b, w, x - X, y - Y);
}
function hydrangea(seed) {
  const b = buf(24, 20), pals = [P('#b6c8ff', '#7d9ae6', '#5670c0'), P('#d6b6f6', '#a882dc', '#7a58b0'), P('#ffc8e2', '#ec8fbf', '#bc5d8e')];
  oval(b, 11, 14, 9, 4, LEAF[2]);
  for (let k = 0; k < 7; k++) oval(b, 4 + k * 2.5 | 0, 13 + (k % 2), 2, 2, k % 2 ? LEAF[1] : LEAF[2]);
  const balls = [[6, 9, 4], [14, 8, 4], [10, 5, 4], [18, 11, 3]];
  balls.forEach(([bx, by, r], k) => {
    const pal = pals[(k + seed) % 3];
    oval(b, bx, by, r, r, pal[1]);
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (get(b, bx + i, by + j) !== pal[1]) continue;
      const t = i - j;
      if ((i + j) % 2 === 0 && t > -1) put(b, bx + i, by + j, pal[0]);
      else if (t < -r * 0.8) put(b, bx + i, by + j, pal[2]);
    }
  });
  for (let k = 0; k < 6; k++) put(b, 3 + k * 3, 16 + (k % 2), LEAF[0]);
  outline(b);
  return b;
}
const HOUSE = buildHouse();

// the horreo: granite granary on legs with rat-stones, slatted walls (corn showing), tile roof, two pinnacles
const OX = 182, OY = 96;
function buildHorreo() {
  const b = buf(72, 84), at = (x, y) => [x - OX, y - OY];
  const R0 = (x, y, w, h, c) => rect(b, x - OX, y - OY, w, h, c);
  // legs and rat-stones
  for (const lx of [194, 214, 234]) {
    const l = buf(b.w, b.h);
    rect(l, lx - OX, 160 - OY, 6, 17, GRAN[1]); rect(l, lx + 5 - OX, 160 - OY, 1, 17, GRAN[0]); rect(l, lx - OX, 160 - OY, 1, 17, GRAN[3]);
    rect(l, lx - OX, 168 - OY, 6, 1, GRAN[4]);
    rect(l, lx - 4 - OX, 156 - OY, 14, 4, GRAN[1]); rect(l, lx - 3 - OX, 156 - OY, 12, 1, GRAN[0]); rect(l, lx - 4 - OX, 159 - OY, 14, 1, GRAN[3]);
    put(l, lx - 4 - OX, 156 - OY, NONE); put(l, lx + 9 - OX, 156 - OY, NONE);
    outline(l); stamp(b, l, 0, 0);
  }
  // base beam
  const bm = buf(b.w, b.h);
  rect(bm, 187 - OX, 151 - OY, 60, 5, GRAN[1]); rect(bm, 187 - OX, 151 - OY, 60, 1, GRAN[0]); rect(bm, 187 - OX, 155 - OY, 60, 1, GRAN[3]);
  for (let x = 199; x < 247; x += 16) rect(bm, x - OX, 151 - OY, 1, 5, GRAN[4]);
  outline(bm); stamp(b, bm, 0, 0);
  // the chamber: end columns, slats with corn behind, top beam, a little wooden door
  const bd = buf(b.w, b.h);
  for (let x = 196; x < 238; x++) for (let y = 129; y < 151; y++) {
    const ph = (x - 196) % 4;
    let c = ph === 3 ? (nz(x, y >> 2) > 0.55 && y > 133 ? I('#e8b828') : I('#2a2420')) : ph === 2 ? GRAN[0] : ph === 0 ? GRAN[2] : GRAN[1];
    if (c === I('#e8b828') && nz(x, y) > 0.6) c = I('#c08a18');
    put(bd, x - OX, y - OY, c);
  }
  rect(bd, 196 - OX, 139 - OY, 42, 2, GRAN[1]); rect(bd, 196 - OX, 139 - OY, 42, 1, GRAN[0]);
  granite(bd, 188 - OX, 128 - OY, 9, 23, [8, 8, 7], 51); granite(bd, 237 - OX, 128 - OY, 9, 23, [8, 8, 7], 53);
  rect(bd, 187 - OX, 127 - OY, 60, 3, GRAN[1]); rect(bd, 187 - OX, 127 - OY, 60, 1, GRAN[0]); rect(bd, 187 - OX, 129 - OY, 60, 1, GRAN[3]);
  // door
  rect(bd, 211 - OX, 132 - OY, 12, 18, WOOD[1]);
  for (let y = 132; y < 150; y++) { put(bd, 214 - OX, y - OY, WOOD[2]); put(bd, 218 - OX, y - OY, WOOD[2]); put(bd, 222 - OX, y - OY, WOOD[0]); }
  rect(bd, 211 - OX, 135 - OY, 9, 1, I('#3a3a40')); rect(bd, 211 - OX, 146 - OY, 9, 1, I('#3a3a40')); put(bd, 221 - OX, 141 - OY, I('#3a3a40'));
  rect(bd, 210 - OX, 131 - OY, 14, 1, OUTI); rect(bd, 210 - OX, 131 - OY, 1, 19, OUTI); rect(bd, 223 - OX, 131 - OY, 1, 19, OUTI);
  outline(bd); stamp(b, bd, 0, 0);
  // roof
  const rf = buf(b.w, b.h);
  tileRoof(rf, [184 - OX, 4], 249 - OX, 114 - OY, 126 - OY, 4, 4);
  for (let x = 188; x <= 245; x++) for (let y = 111; y < 114; y++) rect(rf, x - OX, y - OY, 1, 1, (x - 188) % 5 === 0 ? TILE[4] : y === 111 ? TILE[0] : y === 113 ? TILE[3] : TILE[1]);
  outline(rf); stamp(b, rf, 0, 0);
  // pinnacles at both gable ends
  for (const px of [190, 243]) {
    const p = buf(b.w, b.h);
    rect(p, px - 2 - OX, 107 - OY, 6, 4, GRAN[1]); rect(p, px - 2 - OX, 107 - OY, 6, 1, GRAN[0]);
    rect(p, px - OX, 101 - OY, 2, 6, GRAN[1]); put(p, px + 1 - OX, 101 - OY, GRAN[0]); rect(p, px - 1 - OX, 104 - OY, 4, 3, GRAN[2]);
    oval(p, px - OX, 99 - OY, 1, 1, GRAN[0]);
    outline(p); stamp(b, p, 0, 0);
  }
  return sprite(b, OX, OY);
}
const HORREO = buildHorreo();


// ============================================================
// Foliage and trunks: leaf clusters shaded one by one (deep rim, dark, mid, light toward the sun), leaf texture,
// leaves poking out of the silhouette, an OUT outline
// ============================================================
const CHESTNUT = P('#b9da70', '#80b04a', '#568c38', '#38662c', '#244620');
const CEIL = P('#8ab45a', '#5c8e3e', '#3e6c30', '#2a5024', '#1a3416');
const BLOSSOM = P('#fff8fb', '#ffd0e3', '#f5a3c3', '#d97aa1', '#a8507a');
const BLOSSOMB = P('#fff4f8', '#fbd8e6', '#f2b8cf', '#e29ab6', '#c47a98');
const CAMEL = P('#8cc260', '#55903f', '#3a7032', '#285426', '#1a3a1c');
const GORSE = P('#94b04c', '#66882f', '#48642a', '#32481e', '#22341a');
const BARKC = P('#a0665c', '#76423e', '#57302e', '#3c1f21');
const BARKN = P('#9a7650', '#74543a', '#54392a', '#3a271c');
function foliage(b, cl, pal, seed, kind) {
  const r = rng(seed);
  cl = cl.slice().sort((a, c) => a[1] - c[1]);
  for (const [cx, cy, rx, ry] of cl) {
    oval(b, cx, cy, rx + 1, ry + 1, pal[4]);
    oval(b, cx, cy, rx, ry, pal[3]);
    oval(b, cx + 1, cy - 1, Math.max(1, rx - 2), Math.max(1, ry - 2), pal[2]);
    oval(b, cx + Math.round(rx * 0.32), cy - Math.round(ry * 0.4), Math.max(1, Math.round(rx * 0.42)), Math.max(1, Math.round(ry * 0.36)), pal[1]);
  }
  const n = b.w * b.h / (kind === 'blossom' ? 4 : 6) | 0;
  for (let i = 0; i < n; i++) {
    const x = r() * b.w | 0, y = r() * b.h | 0, k = pal.indexOf(get(b, x, y));
    if (k < 0) continue;
    if (kind === 'blossom') {
      // little flowers: white and pale pink in the light, deeper pink in the shade
      const fc = k <= 1 ? pal[r() < 0.6 ? 0 : 1] : k === 2 ? pal[r() < 0.5 ? 1 : 0] : pal[2];
      put(b, x, y, fc);
      if (r() < 0.5 && pal.indexOf(get(b, x + 1, y)) >= 0) put(b, x + 1, y, fc);
      if (k <= 2 && r() < 0.3 && pal.indexOf(get(b, x, y + 1)) >= 0) put(b, x, y + 1, pal[3]);
    } else {
      // leaf strokes: short diagonals one tone off
      const up = k >= 3 ? r() < 0.35 : r() < 0.6, nc = pal[clamp(k + (up ? -1 : 1), 0, 4)];
      const dx = r() < 0.5 ? 1 : -1, len = 2 + (r() * 2 | 0);
      for (let j = 0; j < len; j++) if (pal.indexOf(get(b, x + dx * j, y + j)) >= 0) put(b, x + dx * j, y + j, nc);
    }
  }
  const edge = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++)
    if (b.d[y * b.w + x] !== NONE && (get(b, x, y + 1) === NONE || get(b, x - 1, y) === NONE || get(b, x + 1, y) === NONE)) edge.push(x, y);
  for (let i = 0; i < edge.length; i += 2) {
    const x = edge[i], y = edge[i + 1];
    if (r() > (kind === 'chestnut' ? 0.2 : 0.24)) continue;
    const dx = (get(b, x + 1, y) === NONE ? 1 : 0) - (get(b, x - 1, y) === NONE ? 1 : 0), down = get(b, x, y + 1) === NONE;
    if (kind === 'chestnut' && down) {
      // long serrated chestnut leaf hanging from the edge
      const len = 3 + (r() * 4 | 0), s = dx || (r() < 0.5 ? -1 : 1), c = pal[r() < 0.5 ? 2 : 1];
      for (let j = 1; j <= len; j++) {
        const px = x + Math.round(s * j * 0.45);
        put(b, px, y + j, j === len ? pal[3] : c);
        if (j < len - 1) put(b, px + s, y + j, j % 2 ? pal[3] : pal[2]);
      }
    } else {
      const c = get(b, x, y);
      put(b, x + dx, y + (down ? 1 : 0), c);
      if (r() < 0.4) put(b, x + dx * 2, y + (down ? 2 : 0), pal[3]);
    }
  }
  outline(b);
}
// a round canopy of n clusters inside w x h (cluster radius range rmin..rmax)
function canopyBuf(w, h, n, rmin, rmax, pal, seed, kind) {
  const b = buf(w, h), r = rng(seed), cl = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()), rx = rmin + (r() * (rmax - rmin + 1) | 0);
    cl.push([Math.round(w / 2 + Math.cos(a) * d * (w / 2 - rx - 3)), Math.round(h * 0.54 + Math.sin(a) * d * (h / 2 - rx * 0.8 - 3)), rx, Math.round(rx * 0.8)]);
  }
  foliage(b, cl, pal, seed + 7, kind);
  return b;
}
// a trunk from (bx, by) up h px, forking into branches toward the canopy; bark by kind
function trunkBuf(w, h, base, top, forks, kind, seed) {
  const b = buf(w, h), MK = 3, bx = w >> 1, by = h - 1, r = rng(seed);
  for (let y = 0; y < h * 0.6; y++) {
    const t = y / (h * 0.6), hw = base / 2 * (1 - t * 0.35) + (y < 3 ? 2 - y * 0.6 : 0);
    const c = bx + Math.round(Math.sin(y * 0.09 + seed) * 1.2);
    for (let x = Math.round(c - hw); x <= Math.round(c + hw - 0.5); x++) put(b, x, by - y, MK);
  }
  const fy = by - Math.round(h * 0.6);
  for (const s of forks) {
    const ex = bx + Math.round(s * (w / 2 - 4)), ey = 2 + (r() * 6 | 0), n = fy - ey;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = Math.round(bx + (ex - bx) * Math.pow(t, 0.8)), th = Math.max(1, Math.round(top * (1 - t * 0.6)));
      rect(b, x - (th >> 1), fy - k, th, 1, MK);
    }
  }
  const BK = kind === 'cherry' ? BARKC : BARKN;
  shade(b, MK, BK[0], BK[1], BK[2], 1, 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = get(b, x, y);
    if (c !== BK[1] && c !== BK[0]) continue;
    if (kind === 'cherry') { if (y % 4 === 0 && nz(x, y + seed) > 0.45) put(b, x, y, I('#c08a7a')); }
    else if ((x * 2 + y + (nz(y >> 2, seed) * 3 | 0)) % 6 === 0) put(b, x, y, BK[3]);
  }
  outline(b);
  return b;
}

// ============================================================
// Sprites (built once at load). Anchors: the foot of each thing (bottom centre) unless noted.
// ============================================================
function mk(b, ax, ay, flash) { return sprite(b, -ax, -ay, flash); }
// interactive trees: three canopies of each kind (the burrs and cherries sit on all of them), so neighbours differ
const CHERRY_TRUNK = mk(trunkBuf(30, 46, 6, 3, [-0.8, 0.15, 0.9], 'cherry', 3), 15, 45);
const CHERRY_TOP = [31, 24, 33].map(s => mk(canopyBuf(62, 50, 13, 7, 11, BLOSSOM, s, 'blossom'), 31, 25, true));
const CHEST_TRUNK = mk(trunkBuf(40, 62, 10, 4, [-0.9, -0.1, 0.8], 'chestnut', 5), 20, 61);
const CHEST_TOP = [41, 75, 26].map(s => mk(canopyBuf(84, 62, 15, 9, 14, CHESTNUT, s, 'chestnut'), 42, 30, true));
// decorative orchard trees: three canopies, two trunks; a small pale one for the row behind; a big one for the arena
const ORCH_TOP = [51, 52, 53].map(s => mk(canopyBuf(70, 54, 15, 8, 12, BLOSSOM, s, 'blossom'), 35, 27));
const ORCH_TRUNK = [6, 7].map(s => mk(trunkBuf(36, 50, 6, 3, [-0.85, 0.1, 0.85], 'cherry', s), 18, 49));
const BACK_TOP = [61, 62].map(s => { const b = canopyBuf(46, 34, 10, 6, 9, BLOSSOMB, s, 'blossom'); for (let i = 0; i < b.d.length; i++) if (b.d[i] === OUTI) b.d[i] = I('#c78aa6'); return mk(b, 23, 17); });
const BIG_TOP = [71, 72].map(s => mk(canopyBuf(104, 72, 22, 10, 15, BLOSSOM, s, 'blossom'), 52, 36));
const BIG_TRUNK = mk(trunkBuf(56, 70, 9, 4, [-0.9, -0.3, 0.35, 0.95], 'cherry', 9), 28, 69);
// a decorative cherry tree in the garden path
const GARDEN_TOP = mk(canopyBuf(58, 46, 12, 7, 10, BLOSSOM, 81, 'blossom'), 29, 23);
// small plants
function camelliaBuf() {
  const b = buf(42, 50), r = rng(91), cl = [];
  rect(b, 19, 36, 4, 14, BARKN[2]); rect(b, 21, 36, 1, 14, BARKN[1]);
  for (let i = 0; i < 11; i++) cl.push([8 + (r() * 26 | 0), 8 + (r() * 26 | 0), 5 + (r() * 3 | 0), 5 + (r() * 3 | 0)]);
  foliage(b, cl, CAMEL, 93, 'leaf');
  for (let i = 0; i < 14; i++) {
    let x, y, k = 0;
    do { x = 4 + (r() * 34 | 0); y = 4 + (r() * 32 | 0); k++; } while (k < 20 && (get(b, x - 2, y) === NONE || get(b, x + 2, y) === NONE || get(b, x, y - 2) === NONE || get(b, x, y + 2) === NONE));
    oval(b, x, y, 1, 1, I('#d8283a')); put(b, x + 1, y - 1, I('#ff7080')); put(b, x - 1, y + 1, I('#9a1424')); put(b, x, y, I('#ffd94a'));
  }
  return b;
}
function gorseBuf(w, h, seed) {
  const b = buf(w + 6, h + 5), r = rng(seed), n = Math.max(3, Math.round(w / 6)), cl = [];
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; cl.push([3 + Math.round(t * w), h + 1 - Math.round(h * (0.3 + 0.3 * Math.sin(t * Math.PI))), 4 + (r() * 3 | 0), Math.round(h * 0.42) + (r() * 2 | 0)]); }
  foliage(b, cl, GORSE, seed, 'gorse');
  for (let i = 0; i < w * h / 3; i++) {
    const x = r() * b.w | 0, y = r() * b.h | 0, c = get(b, x, y);
    if (c === NONE || c === OUTI || r() > 1.1 - y / b.h * 0.7) continue;
    put(b, x, y, r() < 0.65 ? I('#ffd23f') : I('#fff39a'));
    if (r() < 0.5 && get(b, x + 1, y) !== OUTI && get(b, x + 1, y) !== NONE) put(b, x + 1, y, I('#e0a420'));
  }
  return b;
}
// fern: arching fronds with leaflets, lighter on top
function fernBuf(w, h, seed, pal) {
  const b = buf(w, h), r = rng(seed), bx = w >> 1, by = h - 1, n = 7;
  for (let i = 0; i < n; i++) {
    const side = i - (n - 1) / 2, a = -Math.PI / 2 + side * 0.36 + (r() - 0.5) * 0.12, len = h * (1.0 - Math.abs(side) * 0.12) * (0.85 + r() * 0.2);
    const pts = [], steps = Math.round(len * 1.3);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      pts.push([bx + Math.cos(a) * len * t * (1 + Math.abs(side) * 0.25), by + Math.sin(a) * len * t * (1 - t * 0.5) + Math.abs(side) * t * t * len * 0.45]);
    }
    for (let k = 1; k < pts.length; k++) {
      const [x, y] = pts[k], [px, py] = pts[k - 1], t = k / pts.length;
      put(b, x, y, pal[2]);
      if (k % 2) continue;
      const tx = x - px, ty = y - py, l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l, ll = Math.round((1 - t) * 3.4) + 1;
      for (let j = 1; j <= ll; j++) {
        put(b, x + nx * j + tx / l * j * 0.6, y + ny * j + ty / l * j * 0.6, j === ll ? pal[0] : pal[1]);
        put(b, x - nx * j + tx / l * j * 0.6, y - ny * j + ty / l * j * 0.6, pal[2]);
      }
    }
  }
  return b;
}
const FERNP = P('#a6dc6a', '#6cb44c', '#3e8236', '#2a5e28');
const FERNW = P('#8cc45c', '#549a42', '#357030', '#244e22');
const CAMELLIA = mk(camelliaBuf(), 21, 49);
const GORSES = [[30, 16, 101], [24, 13, 102], [36, 18, 103]].map(([w, h, s]) => mk(gorseBuf(w, h, s), (w + 6) >> 1, h + 4));
const FERNS = [[26, 14, 111, FERNP], [30, 16, 112, FERNP], [30, 17, 113, FERNW], [34, 19, 114, FERNW]].map(([w, h, s, p]) => mk(fernBuf(w, h, s, p), w >> 1, h - 1));

// chestnut burrs (ourizos): two spin frames
function burrBuf(rot) {
  const b = buf(11, 11), c = 5;
  for (let a = 0; a < 10; a++) {
    const ang = a * Math.PI / 5 + rot;
    put(b, c + Math.round(Math.cos(ang) * 4.6), c + Math.round(Math.sin(ang) * 4.6), I('#eef6b0'));
    put(b, c + Math.round(Math.cos(ang) * 3.6), c + Math.round(Math.sin(ang) * 3.6), I('#b4d050'));
  }
  oval(b, c, c, 3, 3, OUTI);
  oval(b, c, c, 2, 2, I('#9cc044'));
  put(b, c + 1, c - 1, I('#d8ec8a')); put(b, c, c - 2, I('#d8ec8a')); put(b, c + 2, c, I('#c6e070'));
  put(b, c - 1, c + 1, I('#6a8c2a')); put(b, c - 2, c, I('#6a8c2a')); put(b, c, c + 2, I('#6a8c2a'));
  return b;
}
// the bigger burrs on the interactive chestnut trees: a round husk bristling with long spines (four spin frames)
function bigBurrBuf(rot) {
  const b = buf(17, 17), c = 8;
  for (let a = 0; a < 14; a++) {
    const ang = a * Math.PI / 7 + rot;
    for (let r = 4; r <= 7; r++) put(b, c + Math.round(Math.cos(ang) * r), c + Math.round(Math.sin(ang) * r), r === 7 ? I('#f4f8c8') : r > 5 ? I('#cde070') : I('#9cbc40'));
  }
  oval(b, c, c, 4, 4, OUTI);
  oval(b, c, c, 3, 3, I('#8cb03a'));
  oval(b, c + 1, c - 1, 1, 1, I('#c8e070')); put(b, c + 1, c - 2, I('#eef6b0'));
  for (const [x, y] of [[-2, 1], [-1, 2], [0, 2], [-2, 0]]) put(b, c + x, c + y, I('#5a7a24'));
  return b;
}
const BURR = [0, 0.11, 0.22, 0.33].map(a => mk(bigBurrBuf(a), 8, 8));
// cherries hanging in pairs (drawn per tree each frame, so they can be shot down)
function cherryPairBuf() {
  // two glossy cherries on green stems (only the fruit gets the dark outline, so they read as fruit, not bugs)
  const b = buf(11, 11);
  for (const x of [2, 8]) { oval(b, x, 8, 1, 1, I('#ee2433')); put(b, x - 1, 7, I('#ffb0b0')); put(b, x + 1, 9, I('#a8101e')); put(b, x, 9, I('#c81826')); }
  outline(b);
  line(b, 5, 1, 2, 6, I('#4a8a2a')); line(b, 5, 1, 8, 6, I('#4a8a2a')); put(b, 5, 0, I('#7ab84a')); put(b, 6, 0, I('#8ac858')); put(b, 4, 1, I('#6aa040'));
  return b;
}
const CHERRIES = mk(cherryPairBuf(), 5, 0);

// ============================================================
// Woods sprites: huge old chestnut trunks, the leafy ceiling, mossy rocks, mushrooms, a fallen log, the cascade
// ============================================================
const TRK = P('#b48e62', '#8e6c48', '#6c4f35', '#4c3626', '#2e2018');
function hugeTrunkBuf(seed) {
  const h = 230, w = 92, b = buf(w, h), MK = 3, c0 = w >> 1;
  const cl = y => c0 + Math.sin(y * 0.022 + seed) * 4 + Math.sin(y * 0.075 + seed * 2) * 1.5;
  const hw = y => { const t = y / h; return 9 + t * t * 7 + (t > 0.88 ? (t - 0.88) * 120 : 0) + (nz(y >> 3, seed) > 0.72 ? 1.5 : 0); };
  for (let y = 0; y < h; y++) { const c = cl(y), half = hw(y); for (let x = Math.round(c - half); x <= Math.round(c + half); x++) put(b, x, y, MK); }
  // two great limbs into the canopy
  for (const [s, len, th] of [[-1, 44, 9], [1, 36, 8]]) for (let k = 0; k < len; k++) {
    const t = k / len, x = cl(46) + s * (k * 0.9 + t * t * 8), y = 46 - k, tt = Math.max(3, Math.round(th * (1 - t * 0.6)));
    rect(b, Math.round(x - tt / 2), Math.round(y), tt, 2, MK);
  }
  const cly = y => y < 46 ? cl(46) : cl(y), hwy = y => y < 46 ? 6 : hw(y);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (get(b, x, y) !== MK) continue;
    const u = (x - cly(y)) / hwy(y), v = (x - cly(y)) * 0.75 + y * 0.45 + Math.sin(y * 0.11 + seed) * 2.5, m = ((v % 7) + 7) % 7;
    let k = m < 1.3 ? 4 : m < 2.3 ? 3 : m > 5.4 ? 1 : 2;
    if (u > 0.55 && k > 1) k--;
    if (u < -0.5 && k < 4) k++;
    if (u > 0.82 && k === 1) k = 0;
    if (u < -0.35 && y > 60 && nz(x >> 1, y >> 2) > 0.62) k = nz(x, y) > 0.5 ? 6 : 5;   // moss on the shady side
    put(b, x, y, k === 5 ? MOSS[1] : k === 6 ? MOSS[2] : TRK[k]);
  }
  // a hollow, home of a red squirrel
  const hy = Math.round(h * 0.7), hx = Math.round(cl(hy)) - 3;
  oval(b, hx, hy, 6, 10, OUTI); oval(b, hx, hy, 5, 9, I('#1c130d')); oval(b, hx + 1, hy + 2, 3, 6, I('#120c08'));
  for (let j = -8; j <= 8; j++) put(b, hx - 5 + Math.round(Math.abs(j) * 0.18), hy + j, TRK[2]);
  outline(b);
  return { b, hx: hx - c0, hy: hy - (h - 1) };
}
const HUGE = [5, 9].map(s => { const t = hugeTrunkBuf(s); const sp = mk(t.b, 46, 226); sp.hole = [t.hx, t.hy + 3]; return sp; });
const CLUMPS = [21, 22, 23].map(s => {
  const b = canopyBuf(70, 44, 10, 8, 13, CEIL, s, 'chestnut'), r = rng(s);
  for (let i = 0; i < 3; i++) {
    const x = 12 + (r() * 46 | 0), y = 24 + (r() * 10 | 0);
    if (get(b, x, y) !== NONE && get(b, x, y) !== OUTI) stamp(b, burrBuf(r()), x - 5, y - 5);
  }
  return mk(b, 35, 0);
});
function rockBuf(w, h, seed) {
  const b = buf(w + 6, h + 4), MK = 1, L = 3, T = 2;
  for (let x = 0; x < b.w; x++) for (let y = T; y < b.h; y++) {
    const t = (y - T) / h, half = w / 2 * (0.6 + 0.4 * Math.sin(Math.min(1, t * 1.25) * 1.9)) + (nz(x >> 2, seed) - 0.5) * 2;
    if (Math.abs(x + 0.5 - (L + w / 2)) <= half && y < T + h) put(b, x, y, MK);
  }
  shade(b, MK, 3, 2, 1, 2, 2);
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v < 1 || v > 3) continue;
    const x = i % b.w, y = i / b.w | 0, n = nz(x * 7 + seed, y * 3);
    b.d[i] = n > 0.95 ? I('#4e4b46') : n < 0.04 ? I('#f2efe8') : [0, GRAN[3], GRAN[2], GRAN[1]][v];
  }
  for (let x = 0; x < b.w; x++) {
    let top = 0; while (top < b.h && get(b, x, top) === NONE) top++;
    if (top >= b.h || nz(x >> 1, seed + 5) < 0.2) continue;
    put(b, x, top, MOSS[0]); put(b, x, top + 1, MOSS[1]); if (nz(x, seed) > 0.4) put(b, x, top + 2, MOSS[2]);
    if (nz(x, seed + 1) > 0.8) for (let k = 3; k < 5 + (nz(x, seed + 2) * 4 | 0); k++) put(b, x, top + k, MOSS[2]);
  }
  outline(b);
  return b;
}
const ROCKS = [[30, 18, 1], [22, 13, 2], [40, 22, 3]].map(([w, h, s]) => mk(rockBuf(w, h, s), (w + 6) >> 1, h + 2));
function mushroomsBuf(red) {
  const b = buf(18, 10);
  const caps = red ? [[4, 6, 3, I('#e03a2a')], [10, 4, 4, I('#e03a2a')], [15, 7, 2, I('#d8502a')]] : [[4, 6, 3, I('#b07a3e')], [10, 5, 3, I('#c48a48')], [14, 7, 2, I('#9a6a36')]];
  for (const [x, top, r, c] of caps) {
    rect(b, x - 1 + (r > 2 ? 0 : 1), top + 1, r > 2 ? 2 : 1, 9 - top, I('#f2ead6'));
    oval(b, x, top, r, Math.max(1, r - 2), c);
    rect(b, x - r, top + 1, r * 2 + 1, 1, red ? I('#a01e18') : I('#7a5428'));
    if (red) { put(b, x - 1, top - 1, I('#ffffff')); put(b, x + 1, top, I('#ffffff')); if (r > 3) put(b, x + 3, top, I('#ffffff')); }
    else put(b, x + 1, top - 1, I('#e8b878'));
  }
  outline(b);
  return b;
}
const MUSH = [true, false].map(r => mk(mushroomsBuf(r), 9, 9));
function logBuf() {
  const b = buf(48, 14), MK = 2;
  for (let x = 4; x < 46; x++) for (let y = 3; y < 13; y++) put(b, x, y, MK);
  shade(b, MK, BARKN[0], BARKN[1], BARKN[2], 1, 2);
  for (let x = 6; x < 46; x += 5) for (let y = 4; y < 12; y++) if (nz(x, y) > 0.3) put(b, x + (y % 3 === 0 ? 1 : 0), y, BARKN[3]);
  for (let x = 4; x < 46; x++) if (nz(x >> 1, 7) > 0.3) { put(b, x, 3, MOSS[1]); put(b, x, 2, nz(x, 8) > 0.5 ? MOSS[0] : NONE); if (nz(x, 9) > 0.7) put(b, x, 4, MOSS[2]); }
  oval(b, 4, 8, 3, 5, I('#d8b07a')); oval(b, 4, 8, 2, 3, I('#b8884e')); put(b, 4, 8, I('#8a5a30'));
  outline(b);
  for (const [x, y] of [[30, 2], [31, 1], [29, 1], [32, 0]]) put(b, x, y, FERNP[1]);
  return b;
}
const LOG = mk(logBuf(), 24, 13);
// the little cascade behind the stream: mossy granite boulders with a notch the water falls through
function cascadeBuf() {
  const b = buf(110, 46);
  for (const [x, y, rx, ry] of [[14, 36, 13, 9], [32, 28, 11, 12], [84, 30, 12, 11], [100, 38, 10, 7], [46, 40, 7, 5], [70, 40, 7, 5], [22, 18, 8, 7], [92, 16, 9, 8]]) {
    const r = buf(b.w, b.h);
    pebble(r, x, y, rx, ry, [GRAN[1], GRAN[2], GRAN[3]]);
    for (let i = -rx; i <= rx; i++) { let t = y - ry; while (t < y + ry && get(r, x + i, t) !== GRAN[1] && get(r, x + i, t) !== GRAN[2]) t++; if (nz(x + i, 3) > 0.25) { put(r, x + i, t, MOSS[0]); put(r, x + i, t + 1, MOSS[1]); } }
    stamp(b, r, 0, 0);
  }
  // the flat ledge the water pours from under
  const lg = buf(b.w, b.h);
  for (let x = 36; x <= 80; x++) for (let y = 10; y <= 14; y++) put(lg, x, y, y === 10 ? GRAN[0] : y === 14 ? GRAN[3] : nz(x, y) > 0.9 ? GRAN[2] : GRAN[1]);
  for (let x = 36; x <= 80; x++) if (nz(x >> 1, 12) > 0.3) { put(lg, x, 9, MOSS[0]); put(lg, x, 10, MOSS[1]); if (nz(x, 13) > 0.8) put(lg, x, 11, MOSS[2]); }
  outline(lg); stamp(b, lg, 0, 0);
  return b;
}
const CASCADE = mk(cascadeBuf(), 55, 45);

// ============================================================
// Farm sprites: the granite farmhouse with its outside stair and balcony, vines, corn, a scarecrow, haystacks
// ============================================================
function farmhouseBuf() {
  const b = buf(180, 126), G0 = 122;                    // local ground row
  granite(b, 8, 42, 160, 81, [9, 10, 9, 10, 9, 11, 10, 13], 61);
  rect(b, 8, 77, 160, 2, GRAN[1]); rect(b, 8, 77, 160, 1, GRAN[0]); rect(b, 8, 79, 160, 1, GRAN[4]);
  for (let x = 8; x < 168; x++) for (let y = 43; y < 47; y++) { const c = get(b, x, y); put(b, x, y, y < 45 ? GRAN[4] : c === GRAN[0] ? GRAN[2] : c === GRAN[1] ? GRAN[3] : GRAN[4]); }
  // barn doors under a granite arch
  const ad = buf(b.w, b.h), acx = 87, acy = 98, ar = 17;
  for (let y = acy - ar - 4; y < G0; y++) for (let x = acx - ar - 4; x <= acx + ar + 4; x++) {
    const dx = x - acx, dy = Math.min(0, y - acy), d = Math.hypot(dx, dy);
    if (d <= ar) {
      const left = x < acx, plank = (x - (acx - ar)) % 5;
      put(ad, x, y, x === acx ? I('#1e140c') : plank === 0 ? WOOD[3] : plank === 4 ? WOOD[0] : left ? WOOD[2] : WOOD[1]);
    } else if (d <= ar + 4) {
      const seg = Math.floor((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 7));
      put(ad, x, y, (y >= acy && (y - acy) % 9 === 8) || (y < acy && d > ar + 3.4) ? GRAN[3] : seg % 2 ? GRAN[1] : GRAN[0]);
    }
  }
  for (const sy of [acy - 6, acy + 12]) { rect(ad, acx - ar + 2, sy, ar - 4, 2, I('#2a2a30')); rect(ad, acx + 3, sy, ar - 4, 2, I('#2a2a30')); }
  outline(ad); stamp(b, ad, 0, 0);
  // small barred window below
  rect(b, 26, 92, 12, 12, I('#2a2420')); rect(b, 25, 90, 14, 2, GRAN[0]); rect(b, 25, 104, 14, 2, GRAN[1]);
  for (const x of [29, 32, 35]) rect(b, x, 92, 1, 12, I('#4a4a54'));
  // outside granite stair (patin) up to the landing and the upper door
  const st = buf(b.w, b.h);
  for (let x = 8; x <= 56; x++) {
    const top = x <= 30 ? 80 : 80 + Math.ceil((x - 30) / 3) * 5 - 2;
    for (let y = top; y < G0; y++) put(st, x, y, (y - top) < 1 ? GRAN[0] : (x - 31) % 3 === 0 && x > 30 && y < top + 5 ? GRAN[3] : nz(x, y) > 0.93 ? GRAN[3] : GRAN[1]);
    for (let y = top - 4; y < top - 1; y++) put(st, x, y, y === top - 4 ? GRAN[0] : GRAN[2]);
  }
  outline(st); stamp(b, st, 0, 0);
  rect(b, 12, 54, 13, 22, I('#2f5f7a')); for (let y = 54; y < 76; y++) { put(b, 15, y, I('#244a60')); put(b, 19, y, I('#244a60')); put(b, 24, y, I('#4a86a8')); }
  rect(b, 10, 51, 17, 3, GRAN[0]); put(b, 22, 66, I('#c9a227'));
  // windows upstairs
  for (const wx of [40, 148]) { rect(b, wx, 52, 14, 15, I('#3e3a34')); rect(b, wx + 1, 53, 12, 13, I('#f4f2ec')); rect(b, wx + 2, 54, 4, 5, I('#6a92b2')); rect(b, wx + 8, 54, 4, 5, I('#6a92b2')); rect(b, wx + 2, 60, 4, 5, I('#5d86a8')); rect(b, wx + 8, 60, 4, 5, I('#5d86a8')); put(b, wx + 3, 55, I('#d8ecf6')); put(b, wx + 9, 55, I('#d8ecf6')); rect(b, wx - 1, 67, 16, 2, GRAN[0]); rect(b, wx - 1, 49, 16, 3, GRAN[1]); }
  // the wooden balcony (solaina) with a door behind, corn ears drying under it
  rect(b, 94, 52, 12, 26, WOOD[2]); for (let y = 52; y < 78; y++) put(b, 99, y, WOOD[3]); rect(b, 92, 50, 16, 2, GRAN[0]);
  const bl = buf(b.w, b.h);
  rect(bl, 64, 78, 76, 4, WOOD[1]); rect(bl, 64, 78, 76, 1, WOOD[0]); rect(bl, 64, 81, 76, 1, WOOD[3]);
  rect(bl, 64, 63, 76, 2, WOOD[1]); rect(bl, 64, 63, 76, 1, WOOD[0]);
  for (let x = 65; x < 140; x += 3) rect(bl, x, 65, 1, 13, x % 2 ? WOOD[1] : WOOD[2]);
  for (const px of [64, 139]) rect(bl, px, 63, 2, 19, WOOD[2]);
  outline(bl); stamp(b, bl, 0, 0);
  for (let x = 68; x < 138; x += 5) { rect(b, x, 83, 3, 6, I('#f0a828')); put(b, x + 1, 83, I('#ffd25a')); put(b, x, 88, I('#c47818')); put(b, x + 1, 82, I('#c8a868')); }
  for (const fx of [70, 122]) { rect(b, fx, 59, 8, 4, I('#b8582e')); oval(b, fx + 4, 57, 4, 2, LEAF[2]); for (const k of [1, 4, 6]) { put(b, fx + k, 56, I('#e0303a')); put(b, fx + k, 55, I('#ff7a7a')); } }
  // roof and chimney
  const rf = buf(b.w, b.h);
  tileRoof(rf, [2, 32], 173, 14, 41, 5, 5);
  for (let x = 34; x <= 141; x++) for (let y = 10; y < 15; y++) put(rf, x, y, (x - 34) % 6 === 0 ? TILE[4] : y === 10 ? TILE[0] : y === 14 ? TILE[4] : y === 13 ? TILE[3] : TILE[1]);
  outline(rf); stamp(b, rf, 0, 0);
  const ch = buf(b.w, b.h);
  granite(ch, 120, 2, 12, 26, [6, 6, 7, 7], 63);
  rect(ch, 118, 0, 16, 3, GRAN[1]); rect(ch, 118, 0, 16, 1, GRAN[0]);
  outline(ch);
  for (let y = 0; y < 30; y++) for (let x = 110; x < 140; x++) { const c = get(ch, x, y); if (c !== NONE) put(b, x, y, c); }
  // an old vine climbing the right corner: a twisting trunk, then leaves spreading under the eaves, green grapes
  const vn = buf(b.w, b.h), r = rng(66), cl = [];
  for (let y = 121; y > 50; y--) { const x = 164 + Math.round(Math.sin(y * 0.16) * 1.6); put(vn, x, y, WOOD[2]); put(vn, x + 1, y, WOOD[1]); }
  for (let x = 164; x > 132; x--) { const y = 50 + Math.round(Math.sin(x * 0.3) * 1.2); put(vn, x, y, WOOD[2]); put(vn, x, y + 1, WOOD[3]); }
  for (let i = 0; i < 8; i++) cl.push([136 + i * 5 + (r() * 3 | 0), 48 + (r() * 5 | 0), 4 + (r() * 3 | 0), 3 + (r() * 2 | 0)]);
  for (const [x, y] of [[167, 70], [161, 88], [168, 103]]) cl.push([x, y, 3, 3]);
  foliage(vn, cl, P('#b0d468', '#7eb048', '#5a8c38', '#3c6a2c', '#284a20'), 67, 'leaf');
  for (const [gx, gy] of [[141, 54], [153, 55], [162, 57]]) for (let k = 0; k < 4; k++) for (let i = 0; i <= 3 - k; i++) put(vn, gx + i + (k >> 1), gy + k * 2, k % 2 ? I('#b8cc60') : I('#e8f0a0'));
  stamp(b, vn, 0, 0);
  outline(b);
  return b;
}
const FARMHOUSE = mk(farmhouseBuf(), 86, 122);
const VINEP = P('#b6da6c', '#80b24a', '#5a8c38', '#3c6a2c', '#284a20');
const VINES = [131, 132, 133].map(s => mk(canopyBuf(30, 16, 5, 4, 6, VINEP, s, 'leaf'), 15, 8));
function grapesBuf(pal) {
  const b = buf(8, 11);
  put(b, 3, 0, I('#5a7a2a')); put(b, 4, 1, I('#5a7a2a'));
  for (const [x, y] of [[1, 2], [3, 2], [5, 2], [2, 4], [4, 4], [6, 3], [1, 5], [3, 6], [5, 6], [2, 8], [4, 8], [3, 9]]) { put(b, x, y, pal[1]); put(b, x + 1, y, pal[2]); put(b, x, y + 1, pal[2]); put(b, x, y - (y > 2 ? 0 : 0), pal[1]); }
  for (const [x, y] of [[1, 2], [3, 4], [3, 6], [2, 8]]) put(b, x, y, pal[0]);
  outline(b);
  return b;
}
const GRAPES = [P('#f2f8b8', '#cfe07a', '#97a84a'), P('#c8b0ee', '#7a5ab0', '#4a3478')].map(p => mk(grapesBuf(p), 3, 0));
function cornBuf(seed) {
  const b = buf(18, 50), r = rng(seed), sx = 8;
  for (let y = 7; y < 50; y++) { put(b, sx, y, I('#5a9a3a')); put(b, sx + 1, y, I('#3e7a2e')); }
  for (let k = 0; k < 6; k++) {
    const y0 = 14 + k * 6, s = k % 2 ? 1 : -1, len = 6 + (r() * 3 | 0);
    for (let j = 0; j < len; j++) { const x = sx + (s > 0 ? 2 : -1) + s * j, y = y0 - Math.round(Math.sin(j / len * 2.4) * 4) + (j > len * 0.7 ? 1 : 0); put(b, x, y, j < len * 0.5 ? I('#7ab84a') : I('#5a9a3a')); put(b, x, y + 1, I('#3e7a2e')); }
  }
  for (let j = 0; j < 7; j++) { put(b, sx - 2 + (j % 5), 6 - (j % 3) * 2, I('#e0c878')); put(b, sx + (j % 3) - 1, j, I('#c8a858')); }
  rect(b, sx + 2, 26, 3, 8, I('#8ac458')); rect(b, sx + 3, 24, 2, 3, I('#f0d070')); put(b, sx + 4, 23, I('#c88a3a')); put(b, sx + 3, 33, I('#5a9a3a'));
  outline(b);
  return b;
}
const CORN = [141, 142].map(s => mk(cornBuf(s), 8, 49));
function scarecrowBuf() {
  const b = buf(34, 52), cx = 17;
  rect(b, cx - 1, 18, 3, 34, WOOD[1]); put(b, cx + 1, 30, WOOD[0]);
  rect(b, 3, 21, 28, 2, WOOD[2]);
  // checked shirt with sleeves along the bar
  for (let y = 19; y < 36; y++) for (let x = 7; x < 28; x++) {
    if (y < 25 ? false : (x < 11 || x > 23)) continue;
    const ck = ((x >> 1) + (y >> 1)) % 2;
    put(b, x, y, ck ? I('#d83a30') : I('#f0e6d8'));
    if (x % 4 === 0 || y % 4 === 0) put(b, x, y, I('#a82a24'));
  }
  rect(b, 4, 19, 3, 5, I('#e0c878')); rect(b, 28, 19, 3, 5, I('#e0c878')); put(b, 3, 23, I('#c8a858')); put(b, 31, 22, I('#c8a858'));
  rect(b, 11, 36, 4, 8, I('#4a6aa8')); rect(b, 19, 36, 4, 8, I('#4a6aa8')); put(b, 12, 44, I('#e0c878')); put(b, 21, 44, I('#e0c878')); put(b, 20, 40, I('#e8b84a'));
  // sack head with a stitched smile and a straw hat
  oval(b, cx, 13, 5, 5, I('#d8c8a0')); put(b, cx - 2, 12, OUTI); put(b, cx + 2, 12, OUTI);
  for (const x of [-2, -1, 0, 1, 2]) put(b, cx + x, 15 + (Math.abs(x) === 2 ? -1 : 0), I('#7a4a2a'));
  rect(b, cx - 9, 7, 19, 2, I('#e8c860')); rect(b, cx - 5, 2, 11, 5, I('#d8b048')); rect(b, cx - 5, 5, 11, 1, I('#c03a2a')); put(b, cx + 9, 7, I('#c8a040'));
  outline(b);
  return b;
}
const SCARECROW = mk(scarecrowBuf(), 17, 51);
function palleiroBuf() {
  const b = buf(34, 46), cx = 17, by = 45;
  for (let y = 8; y <= by; y++) {
    const t = (y - 8) / (by - 8), hw = 3 + t * 13 + Math.sin(t * Math.PI) * 2;
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const s = (x - cx) / hw, ln = (Math.round(y + s * 3) % 3 === 0);
      put(b, x, y, s > 0.45 ? (ln ? I('#e2c35a') : I('#f4dc88')) : s < -0.5 ? (ln ? I('#9a7a32') : I('#b8973a')) : ln ? I('#c8a648') : I('#e2c35a'));
    }
  }
  rect(b, cx, 0, 2, 9, WOOD[1]); rect(b, cx - 3, 3, 8, 3, TILE[2]); rect(b, cx - 3, 3, 8, 1, TILE[0]);
  outline(b);
  for (let x = 4; x < 30; x += 3) put(b, x, by - 1 - (x % 2), I('#f4dc88'));
  return b;
}
const PALLEIRO = mk(palleiroBuf(), 17, 45);

// ============================================================
// Orchard and garden sprites: beehives, a ladder and a basket of cherries, the garden gate, the stone fountain, signs
// ============================================================
function hiveBuf() {
  const b = buf(16, 20);
  rect(b, 2, 16, 2, 4, WOOD[2]); rect(b, 12, 16, 2, 4, WOOD[2]);
  rect(b, 1, 6, 14, 10, I('#f2ead2')); rect(b, 1, 10, 14, 1, I('#c9bf9e')); rect(b, 14, 6, 1, 10, I('#fffaea')); rect(b, 1, 6, 1, 10, I('#c9bf9e'));
  rect(b, 0, 3, 16, 3, I('#4a7ab0')); rect(b, 0, 3, 16, 1, I('#7aa8d8')); rect(b, 2, 1, 12, 2, I('#4a7ab0'));
  rect(b, 4, 14, 8, 1, OUTI); rect(b, 3, 15, 10, 1, WOOD[0]);
  outline(b);
  return b;
}
const HIVE = mk(hiveBuf(), 8, 19);
function ladderBuf() {
  const b = buf(20, 46);
  line(b, 2, 45, 10, 0, WOOD[1], 2); line(b, 9, 45, 17, 0, WOOD[2], 2);
  for (let k = 1; k < 7; k++) { const t = k / 7, y = Math.round(45 - t * 45); line(b, Math.round(3 + t * 8), y, Math.round(10 + t * 8), y, WOOD[0]); }
  outline(b);
  return b;
}
const LADDER = mk(ladderBuf(), 6, 45);
function basketBuf() {
  const b = buf(18, 12);
  for (let y = 5; y < 12; y++) for (let x = 2 + (y > 9 ? 1 : 0); x < 16 - (y > 9 ? 1 : 0); x++) put(b, x, y, (x + y) % 3 === 0 ? I('#8a5a28') : y === 5 ? I('#d8a860') : I('#b8803e'));
  for (const [x, y] of [[4, 4], [7, 3], [10, 4], [13, 4], [6, 5], [9, 5], [12, 5]]) { put(b, x, y, I('#d4202e')); put(b, x + 1, y, I('#a8141e')); put(b, x, y - 1, I('#ff6a6a')); }
  outline(b);
  return b;
}
const BASKET = mk(basketBuf(), 9, 11);
function gateBuf() {
  // granite gate posts with ball finials and the green wooden gate, open; world x 244..290, base y 176
  const b = buf(48, 40), by = 39, X = x => x - 244;
  for (const px of [250, 276]) {
    const p = buf(b.w, b.h);
    granite(p, X(px), 12, 7, 28, [7, 7, 7, 7], px);
    rect(p, X(px) - 1, 10, 9, 3, GRAN[1]); rect(p, X(px) - 1, 10, 9, 1, GRAN[0]);
    oval(p, X(px) + 3, 6, 3, 3, GRAN[1]); put(p, X(px) + 4, 5, GRAN[0]); put(p, X(px) + 5, 6, GRAN[0]); put(p, X(px) + 2, 8, GRAN[3]);
    outline(p); stamp(b, p, 0, 0);
  }
  // the gate swung back against the right post
  const g = buf(b.w, b.h);
  for (let k = 0; k < 4; k++) rect(g, X(266) + k * 3, 17 - k, 2, 21 + k, DOORG[k % 2 ? 1 : 2]);
  for (const y of [19, 28, 36]) line(g, X(266), y, X(276), y - 3, DOORG[0]);
  outline(g); stamp(b, g, 0, 0);
  return b;
}
const GATE = mk(gateBuf(), -244, 39);
function fountainBuf() {
  // a village wall fountain (fonte): a wide granite back slab under a cornice and a low pediment, a carved scallop
  // shell (the pilgrims' vieira), a bronze spout, a long trough of water
  const b = buf(56, 44), cx = 28, by = 43;
  const bk = buf(b.w, b.h);
  for (let y = 8; y <= 35; y++) for (let x = cx - 15; x <= cx + 15; x++) {
    let c = x >= cx + 14 ? GRAN[0] : x <= cx - 14 ? GRAN[3] : nz(x, y) > 0.94 ? GRAN[3] : nz(x, y) < 0.04 ? GRAN[0] : GRAN[1];
    if (y === 17 || y === 27) c = GRAN[3];
    if ((y < 17 ? x === cx - 4 : y < 27 ? x === cx + 6 : x === cx - 7) && x > cx - 14 && x < cx + 14) c = GRAN[3];
    put(bk, x, y, c);
  }
  rect(bk, cx - 18, 5, 37, 3, GRAN[1]); rect(bk, cx - 18, 5, 37, 1, GRAN[0]); rect(bk, cx - 18, 7, 37, 1, GRAN[3]);
  for (let k = 0; k < 4; k++) rect(bk, cx - 14 + k * 4, 4 - k, 29 - k * 8, 1, k === 3 ? GRAN[0] : GRAN[1]);
  oval(bk, cx, 0, 1, 1, GRAN[0]);
  outline(bk); stamp(b, bk, 0, 0);
  // the scallop shell: ribs fanning up from its hinge
  const sh = buf(b.w, b.h), sy = 19;
  for (let j = -6; j <= 0; j++) for (let i = -6; i <= 6; i++) {
    if (i * i / 42 + j * j / 40 > 1) continue;
    put(sh, cx + i, sy + j, (Math.round(Math.atan2(j, i) * 3.2) & 1) ? I('#efe6d2') : I('#c9bea6'));
  }
  rect(sh, cx - 2, sy + 1, 5, 2, I('#d8ceb8')); put(sh, cx + 2, sy - 5, I('#ffffff')); put(sh, cx + 1, sy - 6, I('#ffffff'));
  outline(sh); stamp(b, sh, 0, 0);
  // bronze spout
  rect(b, cx - 1, 24, 4, 2, I('#a8742e')); put(b, cx + 2, 24, I('#e0aa58')); rect(b, cx - 1, 26, 2, 1, I('#6a4418'));
  // the trough: a long granite basin, the water level showing between its rims
  const tr = buf(b.w, b.h);
  rect(tr, 1, 34, 54, 10, GRAN[1]); rect(tr, 1, 34, 54, 1, GRAN[0]); rect(tr, 1, 43, 54, 1, GRAN[3]); rect(tr, 54, 35, 1, 8, GRAN[0]); rect(tr, 1, 35, 1, 8, GRAN[2]);
  rect(tr, 3, 35, 50, 2, I('#4f9fd2')); rect(tr, 3, 35, 50, 1, I('#8fd0f0'));
  for (let x = 5; x < 52; x += 7) put(tr, x, 35, I('#d8f0fa'));
  for (const jx of [19, 37]) rect(tr, jx, 37, 1, 6, GRAN[3]);
  outline(tr); stamp(b, tr, 0, 0);
  for (let x = 2; x < 55; x++) if (nz(x >> 1, 9) > 0.55) put(b, x, 33, nz(x, 10) > 0.5 ? MOSS[0] : MOSS[1]);
  for (let x = cx - 17; x < cx + 18; x++) if (nz(x >> 1, 11) > 0.6) put(b, x, 4, MOSS[1]);
  return b;
}
const FOUNTAIN = mk(fountainBuf(), 28, 43);
function signBuf(s) {
  const tw = s.length * 6 - 1, w = tw + 8, b = buf(w + 2, 30), cx = (w + 2) >> 1;
  rect(b, cx - 1, 10, 3, 20, WOOD[1]); put(b, cx + 1, 14, WOOD[0]);
  rect(b, 1, 1, w, 11, WOOD[0]); rect(b, 1, 10, w, 2, WOOD[2]); rect(b, 1, 5, w, 1, WOOD[1]);
  for (let i = 0; i < s.length; i++) {
    const g = GLYPHS[s[i]];
    if (!g) continue;
    g.split(' ').forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] === '1') put(b, 5 + i * 6 + x, 3 + y, I('#5a2e14')); });
  }
  outline(b);
  return b;
}
const SIGNS = { souto: mk(signBuf('SOUTO >'), 23, 29), cereixas: mk(signBuf('CEREIXAS >'), 32, 29) };

// little lives: a seagull on the roof, a cat asleep on the bench, a red squirrel in the old chestnut
const GULL = [false, true].map(open => makeSprite([
  '...kkk.....',
  '..kwwwk....',
  '.kwwwwyy' + (open ? 'k' : '.') + '..',
  '..kwwwk' + (open ? 'yk' : 'k.') + '..',
  'kkkwwwwk...',
  'kgggwwwwk..',
  '.kgGgwwwk..',
  '..kkkwwk...',
  '....oko....'
], { k: OUT, w: '#ffffff', y: '#ffc83a', g: '#9aa4b0', G: '#6a7480', o: '#f08a3a' }));
const CAT = [0, 1].map(f => makeSprite([
  '.k.k.........',
  'kokok........',
  'koooookkkkk..',
  'kOeoOoooooook' + (f ? '' : ''),
  'koooooooooook',
  '.kkoooooooOok',
  f ? '...kkkkkkkko.' : '...kkkkkkkkkk',
  f ? '...........ok' : '.............'
], { k: OUT, o: '#e8963a', O: '#ffc070', e: '#5a3018' }));
const SQUIRREL = makeSprite([
  '.k..k.',
  'krkkrk',
  'krrrrk',
  'kwrkrk',
  'kwrrrk',
  '.kkkk.'
], { k: OUT, r: '#c8602a', w: '#ffe8c8' });

// ============================================================
// More sprites: the front door and the room behind it, the stepping stones, front plants
// ============================================================
// the front door leaf (20 x 36): green planks, a little barred window, iron strap hinges with studs, a brass ring
function doorBuf() {
  const b = buf(20, 36), IRON = I('#2c2c34');
  for (let y = 0; y < 36; y++) for (let x = 0; x < 20; x++) {
    const ph = x % 5;
    let c = ph === 0 ? DOORG[3] : ph === 1 ? DOORG[2] : ph === 4 ? DOORG[0] : DOORG[1];
    if (y >= 33) c = ph === 0 ? DOORG[3] : DOORG[2];
    else if (nz(x, y + 40) > 0.95) c = DOORG[2];
    put(b, x, y, c);
  }
  rect(b, 5, 3, 10, 9, IRON); rect(b, 6, 4, 8, 7, I('#e8a050')); rect(b, 6, 4, 8, 2, I('#ffd27a'));
  for (const gx of [8, 11]) rect(b, gx, 4, 1, 7, IRON);
  for (const sy of [15, 28]) {
    rect(b, 0, sy, 15, 2, IRON); put(b, 15, sy, IRON); rect(b, 0, sy, 15, 1, I('#5a5a66'));
    for (let x = 2; x < 15; x += 4) put(b, x, sy, I('#b0b0bc'));
  }
  for (const [x, y] of [[15, 20], [14, 21], [16, 21], [14, 22], [16, 22], [15, 23]]) put(b, x, y, I('#c9a227'));
  put(b, 15, 19, I('#ffe28a')); put(b, 16, 21, I('#ffe28a'));
  return b;
}
// the kitchen behind the door: dark warm walls, floor boards, daylight spilling in, the glow of the hearth
function roomBuf() {
  const b = buf(20, 36);
  for (let y = 0; y < 36; y++) for (let x = 0; x < 20; x++) {
    let c = y < 27 ? (x > 12 && y > 10 ? I('#3a2618') : I('#2a1c14')) : ((x + (y - 27) * 3) % 7 === 0 ? I('#4a2e1c') : I('#6a4428'));
    if (y >= 27 && x < 15 - (y - 27)) c = c === I('#4a2e1c') ? I('#7a5434') : I('#9a7048');   // daylight on the floor
    put(b, x, y, c);
  }
  rect(b, 2, 12, 7, 2, I('#5a3a22')); rect(b, 3, 10, 2, 2, I('#c8b8a0')); rect(b, 6, 9, 2, 3, I('#8a5a3a'));   // a shelf, a jug
  rect(b, 3, 19, 6, 1, I('#5a3a22')); rect(b, 3, 20, 1, 7, I('#4a2e1c')); rect(b, 8, 20, 1, 7, I('#4a2e1c'));  // a stool
  return b;
}
const DOOR = mk(doorBuf(), 0, 0), ROOM = mk(roomBuf(), 0, 0);
SIGNS.granxa = mk(signBuf('GRANXA >'), 26, 29);
// stepping stones across the stream, wet and dark where the water laps them (x 2026-2116, tops at y 229)
function stonesBuf() {
  const b = buf(92, 10);
  for (const [x, rx, ry] of [[8, 7, 3], [45, 8, 4], [82, 7, 3]]) pebble(b, x, 5, rx, ry, [GRAN[0], GRAN[1], GRAN[3]]);
  for (let i = 0; i < b.d.length; i++) {
    const y = i / b.w | 0, x = i % b.w;
    if (b.d[i] === NONE || b.d[i] === OUTI) continue;
    if (y >= 6) b.d[i] = nz(x, y) > 0.5 ? I('#6e6a62') : I('#5a564e');
    else if (y <= 2 && nz(x >> 1, 7) > 0.55) b.d[i] = y === 1 ? MOSS[0] : MOSS[1];
  }
  return b;
}
const STONES = mk(stonesBuf(), 0, 0);
// darker, bluer copies for the plants passing in front
function tint(b, mul, add, keepYellow) {
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE || keepYellow && (v >> 16 & 255) > 200 && (v >> 8 & 255) > 140 && (v & 255) < 140) continue;
    const r = Math.min(255, (v >> 16 & 255) * mul + add[0]) | 0, g = Math.min(255, (v >> 8 & 255) * mul + add[1]) | 0, bl = Math.min(255, (v & 255) * mul + add[2]) | 0;
    b.d[i] = r << 16 | g << 8 | bl;
  }
  return b;
}
function grassBuf(w, h, seed, pal, flowers) {
  const b = buf(w, h), r = rng(seed), n = Math.round(w / 1.8);
  for (let i = 0; i < n; i++) {
    const x0 = 2 + r() * (w - 4), len = (h - 2) * (0.4 + r() * 0.6), lean = (x0 - w / 2) / (w / 2) * (0.4 + r() * 0.7);
    for (let k = 0; k < len; k++) { const t = k / len; put(b, x0 + lean * t * t * len * 0.8, h - 1 - k, t > 0.72 ? pal[0] : t > 0.3 ? pal[1] : pal[2]); }
  }
  for (let i = 0; i < (flowers ? flowers.n : 0); i++) {
    const x = 3 + (r() * (w - 6) | 0);
    let y = 1; while (y < h - 2 && get(b, x, y) === NONE) y++;
    if (y >= h - 3) continue;
    const c = flowers.c[i % flowers.c.length];
    put(b, x, y - 1, c); put(b, x - 1, y, c); put(b, x + 1, y, c); put(b, x, y, flowers.mid || c);
  }
  outline(b);
  return b;
}
const FRONTP = P('#3a6a3a', '#24502c', '#173a22');
const FRONT = [
  mk(tint(fernBuf(46, 24, 211, FERNP), 0.42, [6, 16, 22]), 23, 23),
  mk(tint(gorseBuf(40, 18, 212), 0.5, [4, 10, 16], true), 23, 22),
  mk(grassBuf(30, 20, 213, FRONTP), 15, 19),
  mk(grassBuf(36, 22, 214, FRONTP, { n: 5, c: [I('#ffe066'), I('#ffffff')], mid: I('#e0a020') }), 18, 21),
  mk(grassBuf(34, 20, 215, P('#4a7a3a', '#2e5a2c', '#1e4222'), { n: 7, c: [I('#ffc0d8'), I('#fff2f8')], mid: I('#f590b8') }), 17, 19),
  mk(tint(fernBuf(40, 22, 216, FERNW), 0.38, [4, 14, 22]), 20, 21)
];

// ============================================================
// Terrain-following pieces baked at worldLoad: dry-stone granite walls behind the path, wooden fences, pergola posts
// ============================================================
const gl = x => Math.round(groundAt(x + 0.5));
// a strip buffer covering x0..x1 from `up` px above the highest ground to `down` px below the lowest
function stripBuf(x0, x1, up, down) {
  let t = Infinity, bt = -Infinity;
  for (let x = x0 - 2; x <= x1 + 2; x++) { t = Math.min(t, gl(x) - up); bt = Math.max(bt, gl(x) + down); }
  const b = buf(x1 - x0 + 5, bt - t + 1);
  b.x0 = x0 - 2; b.y0 = t;
  return b;
}
function stripSprite(b) { return { img: bake(b), w: b.w, h: b.h, x: b.x0, y: b.y0 }; }
// courses of granite stones that follow the slope, rounded capstones, moss and lichen
function backWall(x0, x1, h, seed) {
  const b = stripBuf(x0, x1, h + 3, 3), X = x => x - b.x0, Y = y => y - b.y0;
  for (let x = x0; x <= x1; x++) {
    const g = gl(x);
    for (let y = g - h; y <= g + 3; y++) {
      const hy = g + 3 - y, row = Math.floor(hy / 6), j = hy % 6, off = row * 7 + (nz(row, seed) * 9 | 0);
      const bw = 9 + (nz(Math.floor((x + off) / 13), row + seed) * 5 | 0), i = (x + off) % 13;
      const tone = nz(Math.floor((x + off) / 13), row * 3 + seed + 1);
      let c = tone < 0.3 ? GRAN[2] : tone > 0.8 ? GRAN[0] : GRAN[1];
      if (i >= bw || j === 0) c = GRAN[4];
      else if (j === 1 || i === 0) c = GRAN[3];
      else if (j === 5 || i === bw - 1) c = tone > 0.8 ? I('#f0eadc') : GRAN[0];
      if (c !== GRAN[4] && nz(x * 3 + seed, y * 5) > 0.95) c = I('#7d7466');
      put(b, X(x), Y(y), c);
    }
    // capstones: a rounded row on top
    const cap = (x + seed) % 9, ch = cap === 0 || cap === 8 ? 1 : 2;
    for (let k = 1; k <= ch; k++) put(b, X(x), Y(g - h - k), k === ch ? GRAN[0] : GRAN[1]);
    if (cap === 0) put(b, X(x), Y(g - h), GRAN[4]);
    const m = nz(x >> 1, seed + 3);
    if (m > 0.5) { put(b, X(x), Y(g - h - ch - 1), m > 0.75 ? MOSS[0] : MOSS[1]); if (m > 0.8) put(b, X(x), Y(g - h - ch), MOSS[2]); }
    if (nz(x, seed + 9) > 0.93) for (let k = 0; k < 3; k++) put(b, X(x), Y(g - h + k), MOSS[k ? 2 : 1]);
    if (nz(x >> 2, seed + 11) > 0.9) put(b, X(x), Y(g - h + 4), I('#c9c46c'));
  }
  outline(b);
  return stripSprite(b);
}
// post-and-rail fence of weathered chestnut wood
function fence(x0, x1, seed) {
  const b = stripBuf(x0, x1, 19, 3), X = x => x - b.x0, Y = y => y - b.y0, posts = [];
  for (let x = x0; x <= x1; x += 18 + (nz(x, seed) * 5 | 0)) posts.push(x);
  for (const [dy, c0, c1] of [[-14, WOOD[0], WOOD[2]], [-8, WOOD[1], WOOD[3]]])
    for (let x = x0; x <= x1; x++) { const y = gl(x) + dy; put(b, X(x), Y(y), c0); put(b, X(x), Y(y + 1), c1); }
  for (const px of posts) {
    const g = gl(px), top = g - 17 - (nz(px, seed + 1) * 3 | 0);
    for (let y = top; y <= g + 3; y++) { put(b, X(px), Y(y), WOOD[2]); put(b, X(px + 1), Y(y), WOOD[1]); put(b, X(px + 2), Y(y), y === top ? WOOD[1] : WOOD[0]); }
    put(b, X(px + 1), Y(top), WOOD[0]);
    if (nz(px, seed + 2) > 0.5) put(b, X(px), Y(top + 5), MOSS[1]);
  }
  outline(b);
  return stripSprite(b);
}
// granite pergola posts with the wires between them (the vines and grapes are drawn live)
function pergola(x0, x1, seed) {
  const b = stripBuf(x0, x1, 46, 3), X = x => x - b.x0, Y = y => y - b.y0, posts = [];
  for (let x = x0; x <= x1; x += 38) posts.push(x);
  for (let k = 0; k + 1 < posts.length; k++) {
    const a = posts[k], c = posts[k + 1], ya = gl(a) - 40, yc = gl(c) - 40;
    for (let x = a + 2; x < c; x++) { const t = (x - a) / (c - a), y = Math.round(ya + (yc - ya) * t + Math.sin(t * Math.PI) * 3); put(b, X(x), Y(y), I('#3a3a40')); }
  }
  for (const px of posts) {
    const g = gl(px);
    for (let y = g - 41; y <= g + 3; y++) for (let i = 0; i < 4; i++) {
      let c = i === 0 ? GRAN[3] : i === 3 ? GRAN[0] : GRAN[1];
      if ((y + px) % 9 === 0) c = GRAN[4];
      else if (nz(px + i, y) > 0.92) c = GRAN[2];
      put(b, X(px - 1 + i), Y(y), c);
    }
  }
  outline(b);
  return { s: stripSprite(b), posts };
}

// ============================================================
// The scenery list (world x). Layers: 0 far (orchard back row, giant trunks), 1 walls, fences and buildings,
// 2 trees and farm things, 3 low plants and rocks. Spans [x0, x1] for the long pieces.
// ============================================================
const DECOR = [
  // AREA 1: HOME SWEET HOME
  [0, 12, 'camellia'], [1, 0, 'house'], [1, 182, 'horreo'], [1, 244, 'gate'], [1, 292, 'wall', 548], [1, 862, 'wall', 1096],
  [2, 456, 'ctree', 0], [3, 336, 'gorse', 0], [3, 372, 'fern', 1], [3, 476, 'gorse', 2], [3, 520, 'fern', 0],
  [2, 602, 'fountain'], [3, 706, 'gorse', 1], [3, 742, 'fern', 2], [3, 800, 'gorse', 0], [3, 880, 'fern', 3],
  [3, 925, 'rock', 2], [2, 995, 'ctree', 1], [3, 1046, 'gorse', 2], [3, 1100, 'fern', 0], [3, 1150, 'gorse', 1],
  [3, 1212, 'rock', 0], [3, 1270, 'fern', 1], [2, 1318, 'sign', 'souto'],
  // AREA 2: CHESTNUT WOODS (the six big chestnuts are props)
  [0, 1398, 'huge', 0], [0, 1612, 'huge', 1], [0, 1848, 'huge', 0], [0, 2244, 'huge', 1], [0, 2468, 'huge', 0], [0, 2798, 'huge', 1],
  [1, 1330, 'ceiling', 2880],
  [3, 1372, 'fern', 2], [3, 1418, 'mush', 0], [3, 1444, 'rock', 1], [3, 1520, 'fern', 3], [3, 1590, 'fern', 1],
  [3, 1636, 'mush', 1], [3, 1676, 'fern', 0], [3, 1742, 'log'], [3, 1800, 'fern', 2], [3, 1872, 'mush', 0],
  [3, 1915, 'fern', 3], [3, 1968, 'rock', 0], [1, 2015, 'cascade'], [3, 1988, 'reeds', 1975],
  [3, 2150, 'reeds', 2150], [3, 2170, 'rock', 1], [3, 2222, 'fern', 0], [3, 2268, 'mush', 1], [3, 2318, 'fern', 3],
  [3, 2410, 'fern', 1], [3, 2492, 'mush', 0], [3, 2520, 'rock', 2], [3, 2600, 'log'], [3, 2650, 'fern', 2],
  [3, 2735, 'fern', 0], [3, 2770, 'rock', 1], [3, 2822, 'mush', 1],
  // AREA 3: THE FARM
  [1, 2846, 'fence', 2932], [2, 2864, 'sign', 'granxa'], [2, 2986, 'flag'], [1, 3062, 'farmhouse'], [2, 3168, 'palleiro'],
  [1, 3292, 'pergola', 3482], [3, 3240, 'fern', 0], [2, 3522, 'corn', 3712], [2, 3618, 'scarecrow'],
  [1, 3712, 'fence', 3790], [1, 3850, 'pergola', 3998], [2, 4030, 'palleiro'], [2, 4196, 'palleiro'],
  [1, 4226, 'fence', 4372], [3, 3100, 'gorse', 1], [3, 3530, 'fern', 3], [3, 4140, 'gorse', 0],
  // FINAL AREA: CHERRY ORCHARD
  [0, 4300, 'backrow', 6300], [1, 4404, 'wall', 4760], [1, 5150, 'wall', 5706], [2, 4392, 'sign', 'cereixas'],
  [2, 4578, 'otree', 0], [2, 4786, 'otree', 1], [2, 5006, 'otree', 2], [2, 5258, 'otree', 0], [2, 5482, 'otree', 1],
  [2, 5646, 'otree', 2], [2, 4736, 'hive', 0], [2, 4754, 'hive', 1], [2, 5582, 'hive', 0], [2, 5600, 'hive', 1],
  [2, 5618, 'hive', 0], [2, 4984, 'ladder'], [3, 4966, 'basket'], [2, 5792, 'btree', 0], [2, 5966, 'btree', 1],
  [2, 6136, 'btree', 0], [3, 4640, 'fern', 1], [3, 4930, 'gorse', 2], [3, 5340, 'fern', 3], [3, 5700, 'fern', 0],
  [3, 5880, 'fern', 2], [3, 6060, 'gorse', 0]
];
// how far each kind reaches left and right of its x (for culling)
const REACH = {
  camellia: [24, 24], house: [0, 190], horreo: [0, 72], gate: [0, 50], ctree: [32, 32], gorse: [24, 24], fern: [20, 20],
  fountain: [28, 28], rock: [26, 26], sign: [36, 36], huge: [52, 52], ceiling: [40, 40], mush: [10, 10], log: [26, 26],
  cascade: [0, 110], stones: [0, 92], reeds: [14, 30], fence: [4, 4], flag: [26, 30], farmhouse: [88, 96], palleiro: [20, 20],
  pergola: [20, 20], corn: [10, 10], scarecrow: [18, 18], backrow: [0, 0], wall: [4, 4], otree: [38, 38], hive: [10, 10],
  ladder: [8, 16], basket: [10, 10], btree: [60, 60]
};
const SPAN = { ceiling: 1, fence: 1, pergola: 1, corn: 1, backrow: 1, wall: 1 };

// ============================================================
// Level state (worldLoad resets it): baked strips, effects (splashes, ripples, petals, leaves) on a private random
// stream, so the scenery never shifts the game's own random numbers
// ============================================================
let builtFor = null, strips = new Map(), fr = rng(1);
const fx = [];
let lastPVY = 0, lastGround = true;
const waders = new WeakMap();
const frr = (a, b) => a + fr() * (b - a);

function stripFor(d) {
  let s = strips.get(d);
  if (!s) {
    s = d[2] === 'fence' ? fence(d[1], d[3], d[1] & 255) : d[2] === 'pergola' ? pergola(d[1], d[3], d[1] & 255) : backWall(d[1], d[3], d[1] < 2000 ? 12 : 9, d[1] & 255);
    strips.set(d, s);
  }
  return s;
}

L2.worldLoad = function (cp) {
  if (builtFor !== LV.terrain) {
    builtFor = LV.terrain;
    buildChunks();
    platArt.clear(); strips.clear();
    for (const d of DECOR) if (d[2] === 'fence' || d[2] === 'pergola' || d[2] === 'wall') stripFor(d);
    for (const pl of LV.plats) buildPlat(pl);
  }
  fx.length = 0;
  fr = rng(0x5eed + Math.round(cp || 0));
  lastPVY = 0; lastGround = true;
};

// ============================================================
// Effects: splashes and ripples in the stream, petals and leaves (world x, screen y)
// ============================================================
function addFx(o) { if (fx.length < 220) fx.push(o); }
function splash(x, n, big) {
  for (let i = 0; i < n; i++) addFx({ k: 'drop', x: x + frr(-5, 5), y: WS - frr(0, 2), vx: frr(-1, 1) * (big ? 1.8 : 1), vy: -frr(1.2, big ? 3.8 : 2.6), t: 0, life: 40, c: fr() < 0.5 ? '#ffffff' : '#bfe6ff', s: fr() < 0.6 ? 2 : 1 });
  addFx({ k: 'foam', x, y: WS, t: 0, life: big ? 20 : 12, r: big ? 7 : 4 });
  addFx({ k: 'ring', x, y: WS + 1, t: 0, life: big ? 34 : 26, r: big ? 3 : 1 });
}
function petalPuff(x, y, n, spread) {
  for (let i = 0; i < n; i++) {
    const a = frr(0, Math.PI * 2), s = frr(0.3, 1) * (spread || 1.6);
    addFx({ k: 'petal', x: x + Math.cos(a) * frr(0, 22), y: y + Math.sin(a) * frr(0, 16), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, t: 0, life: 90 + (fr() * 80 | 0), ph: frr(0, 6.3), c: (fr() * 4) | 0, big: fr() < 0.45 });
  }
}
function leafPuff(x, y, n) {
  for (let i = 0; i < n; i++) addFx({ k: 'leaf', x: x + frr(-26, 26), y: y + frr(-14, 12), vx: frr(-0.8, 0.8), vy: frr(-1.2, 0.2), t: 0, life: 110 + (fr() * 60 | 0), ph: frr(0, 6.3), c: (fr() * 3) | 0 });
}
function wade(o, key, n) {
  // splashes and rings around something walking in the stream
  const inW = o.x > 1982 && o.x < 2158 && o.y >= WS + 1;
  const last = waders.get(key);
  waders.set(key, o.x);
  if (!inW || last == null) return;
  const moving = Math.abs(o.x - last) > 0.25;
  if (moving && (G.t + n * 3) % 8 === 0) splash(o.x + (o.x > last ? 5 : -5), 3, false);
  if ((G.t + n * 11) % (moving ? 16 : 40) === 0) addFx({ k: 'ring', x: o.x, y: WS + 1, t: 0, life: 30, r: 2 });
}

L2.worldUpdate = function () {
  const p = G.p, w = weather();
  if (p && !p.dead) {
    const inW = p.x > 1982 && p.x < 2158;
    if (inW && p.onGround && !lastGround && lastPVY > 1.5) { splash(p.x, 10, true); Snd.noise(0.18, 0.08, 1800); }
    wade(p, p, 0);
    lastGround = p.onGround; lastPVY = p.vy;
  }
  let n = 1;
  for (const e of G.enemies) if (e.active && !e.dead && e.x > 1960 && e.x < 2180) wade(e, e, n++);
  // the arena's cherry trees shed blossom while the boss shakes them
  if (G.treeShake > 0 && G.cam.x > 5500) {
    for (const d of DECOR) if (d[2] === 'btree' && d[1] > G.cam.x - 60 && d[1] < G.cam.x + W + 60 && fr() < 0.5) petalPuff(d[1] + frr(-30, 30), gl(d[1]) - 92, 1, 0.8);
  }
  for (const f of fx) {
    f.t++;
    if (f.k === 'drop') { f.vy += 0.2; f.x += f.vx; f.y += f.vy; if (f.y > WS + 2 && f.vy > 0) f.t = f.life; }
    else if (f.k === 'petal' || f.k === 'leaf') {
      const lf = f.k === 'leaf';
      f.vx += ((lf ? 0.5 : 0.9) * w.wind - f.vx) * 0.03 + Math.sin(f.ph + f.t * 0.11) * 0.03;
      f.vy = Math.min(f.vy + 0.03, lf ? 0.7 : 0.5);
      f.x += f.vx + Math.sin(f.ph + f.t * 0.07) * 0.25; f.y += f.vy;
      const g = groundAt(f.x) - 1;
      if (f.y >= g) { f.y = g; f.vx = 0; f.vy = 0; if (!f.land) { f.land = 1; f.t = Math.max(f.t, f.life - 70); } }
    }
  }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t >= fx[i].life || fx[i].x < G.cam.x - 80) fx.splice(i, 1);
};

// ============================================================
// Live details: chimney smoke, the door, the lantern, the cat, the gull, bees, the squirrel, the flag, water
// ============================================================
function smoke(x, y, n, seed) {
  // a soft plume: overlapping puffs that swell, drift with the wind and fade (light from the top right)
  const w = weather().wind;
  for (let i = 0; i < n; i++) {
    const per = 230, t = (G.t + i * per / n + seed * 37) % per, k = t / per, j = hsh(i * 7.3 + seed) * 4 - 2;
    const px = x + j * k + w * 36 * k * k + k * 7 + Math.sin(t * 0.045 + i * 1.3) * 1.6, py = y - t * 0.3, r = Math.round(2 + k * 7);
    const a = 0.62 * Math.pow(1 - k, 1.3) * Math.min(1, t / 12);
    ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#b8b2a8'; pdisc(px - 1, py + 1, r);
    ctx.globalAlpha = a; ctx.fillStyle = '#e6e2da'; pdisc(px, py, r - 1);
    ctx.fillStyle = '#ffffff'; pdisc(px + 1, py - 1, Math.max(1, r - 3));
  }
  ctx.globalAlpha = 1;
}
function drawHouse() {
  blit(HOUSE, 0, 0);
  // the doorway: the kitchen shows as the door swings in (G.introDoor 0 = shut .. 1 = open)
  const k = clamp(G.introDoor || 0, 0, 1);
  if (k > 0) {
    blit(ROOM, 110, 140);
    ctx.globalAlpha = 0.18 + 0.12 * hsh(G.t >> 2); ctx.fillStyle = '#ff9a3a'; ctx.fillRect(123, 150, 7, 22);
    ctx.globalAlpha = 1;
  }
  const dw = Math.max(2, Math.round(20 * Math.cos(k * Math.PI * 0.47)));
  ctx.drawImage(DOOR.img, 0, 0, 20, 36, 110, 140, dw, 36);
  if (k > 0) {
    ctx.globalAlpha = 0.5 * k; ctx.fillStyle = '#0e1a10'; ctx.fillRect(110, 140, dw, 36); ctx.globalAlpha = 1;
    R(110 + dw, 140, 1, 36, '#16241a');
  }
  // a wrought-iron lantern hanging under the eaves above the door
  R(119, 121, 3, 1, OUT); R(120, 122, 1, 3, OUT);
  RO(117, 125, 7, 2, '#3a3a44'); R(118, 125, 5, 1, '#5a5a66');
  RO(118, 127, 5, 6, '#ffd36a'); R(118, 127, 5, 2, '#fff2b8'); R(120, 127, 1, 6, '#3a3a44'); R(118, 133, 5, 1, '#3a3a44');
  ctx.globalAlpha = 0.12 + 0.05 * Math.sin(G.t * 0.17) + 0.04 * hsh(G.t >> 3); ctx.fillStyle = '#ffd36a'; pdisc(120, 130, 8); ctx.globalAlpha = 1;
  // the cat asleep on the bench, breathing; the gull on the ridge, calling now and then
  spr(CAT[Math.floor(G.t / 50) % 2], 89, 154);
  const zt = G.t % 240;
  if (zt < 90) for (let j = 0; j < 2; j++) {
    const u = (zt + j * 45) % 90, zx = 100 + Math.round(u / 18), zy = 151 - Math.round(u / 7);
    ctx.globalAlpha = Math.min(1, (90 - u) / 30); R(zx, zy, 3, 1, '#ffffff'); R(zx + 1, zy + 1, 1, 1, '#ffffff'); R(zx, zy + 2, 3, 1, '#ffffff'); ctx.globalAlpha = 1;
  }
  const call = G.t % 330 < 40 && Math.floor(G.t / 6) % 2;
  spr(GULL[call ? 1 : 0], 68, 80);
  smoke(141, 64, 9, 0);
}
function drawHorreo() {
  blit(HORREO, 0, 0);
  // a few loose corn leaves stirring at the slats
  const s = Math.round(sway(1.3, 1.2));
  R(197 + s, 147, 1, 3, '#e8c860'); R(236 + s, 146, 1, 3, '#d8b048');
}
function drawFlag(x, g) {
  // the Galician flag: white with one light-blue band from the top left to the bottom right
  const top = g - 72, w = weather().wind, dir = w < -0.05 ? -1 : 1, fw = 22, fh = 14;
  R(x - 1, top - 3, 3, 3, '#e8c040'); RO(x, top, 1, g - top + 2, '#d8d8d8');
  for (let i = 0; i < fw; i++) {
    const k = i / fw, wave = Math.round(Math.sin(G.t * 0.16 - i * 0.45) * 1.6 * k + k * k * 2), cx = x + dir * (i + 1) + (dir < 0 ? 0 : 0);
    const y0 = top + 1 + wave;
    R(cx, y0 - 1, 1, fh + 2, OUT);
    const band = Math.round(1 + k * (fh - 4));
    R(cx, y0, 1, fh, Math.sin(G.t * 0.16 - i * 0.45) > 0.3 ? '#e8ecf0' : '#ffffff');
    R(cx, y0 + band, 1, 3, Math.sin(G.t * 0.16 - i * 0.45) > 0.3 ? '#4a9ad0' : '#6ab8ea');
  }
}
function drawBees(x, g, seed) {
  for (let i = 0; i < 3; i++) {
    const a = G.t * (0.07 + i * 0.013) + seed * 2 + i * 2.1, bx = Math.round(x + Math.cos(a) * (8 + i * 3)), by = Math.round(g - 22 + Math.sin(a * 1.7) * 5);
    R(bx, by, 2, 1, '#ffd23f'); R(bx + (Math.cos(a) > 0 ? 0 : 1), by, 1, 1, OUT);
    if (G.t % 4 < 2) R(bx, by - 1, 1, 1, '#ffffff');
  }
}
function drawCascade(x, g) {
  // a sheet of water pouring from under the ledge between the boulders: streaks running down, a bright lip on
  // top, foam and mist where it hits the pool
  const x0 = x + 40, x1 = x + 73, top = g - 33;
  for (let cx = x0; cx < x1; cx++) {
    const lane = nz(cx, 51), e = Math.min(cx - x0, x1 - 1 - cx);
    R(cx, top, 1, g - top, e < 2 ? '#3a86bd' : lane > 0.6 ? '#8fd0f0' : lane > 0.25 ? '#6cbbe6' : '#4f9fd2');
    R(cx, top, 1, 2, e < 2 ? '#8fd0f0' : '#e8f8ff');
    const sp = 1.4 + lane * 1.2, per = 9 + (lane * 7 | 0), ph = Math.floor((G.t * sp + lane * 50) % per);
    for (let y = top + 2 + ph; y < g - 4; y += per) R(cx, y, 1, 2 + (lane * 3 | 0), lane > 0.45 ? '#ffffff' : '#bfe6ff');
  }
  for (let i = 0; i < 11; i++) {
    const fx0 = x0 + 1 + i * 3 + ((G.t >> 3) + i) % 2, r = 1 + (((G.t >> 3) + i * 3) % 3 === 0 ? 1 : 0), fy = g - 3 - (((G.t >> 2) + i) % 3);
    ctx.fillStyle = i % 3 ? '#ffffff' : '#d8f0fa'; pdisc(fx0, fy, r);
  }
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) { const t = (G.t * 0.4 + i * 20) % 80; pdisc(x0 + 6 + i * 7 + Math.sin(t * 0.1 + i) * 2, g - 6 - t * 0.18, 2 + Math.round(t / 30)); }
  ctx.globalAlpha = 1;
}
function drawReeds(x0, n) {
  for (let i = 0; i < n; i++) {
    const x = x0 + i * 3 + (nz(i, x0) * 2 | 0), h = 12 + (nz(i, x0 + 1) * 11 | 0), s = sway(x * 0.07, 2.2), base = WS + 2;
    for (let k = 0; k < h; k++) { const t = k / h; R(x + Math.round(s * t * t), base - k, 1, 1, t > 0.6 ? '#7ab84a' : '#4a8a3a'); }
    if (i % 3 === 1) { const tx = x + Math.round(s); R(tx - 1, base - h - 4, 3, 6, OUT); R(tx, base - h - 3, 1, 4, '#7a4a2a'); R(tx, base - h - 6, 1, 2, '#4a8a3a'); }
  }
}
function drawSquirrel(x, base, hole, k) {
  const c = (G.t + k * 260) % 520;
  if (c > 180) return;
  const up = c < 20 ? c / 20 : c > 160 ? (180 - c) / 20 : 1, hx = Math.round(x + hole[0]), hy = Math.round(base + hole[1]);
  ctx.save(); ctx.beginPath(); ctx.rect(hx - 4, hy - 12, 9, 15); ctx.clip();
  spr(SQUIRREL, hx - 3, hy - 1 - Math.round(up * 6));
  ctx.restore();
}

// ============================================================
// drawBehind (world space): the scenery list, back to front
// ============================================================
function vis(d, cx) {
  const r = REACH[d[2]] || [40, 40], x1 = SPAN[d[2]] ? d[3] : d[1];
  return x1 + r[1] > cx && d[1] - r[0] < cx + W;
}
function hangBlit(s, x, y, amt, rows) {
  // hanging foliage: the top stays put, the bottom swings
  const X = Math.round(x + s.ox), Y = Math.round(y + s.oy);
  let y0 = 0, off = null;   // slices on the same pixel offset are drawn as one piece, as in swayBlit
  for (let sy = 0; sy < s.h; sy += rows) {
    const sh = Math.min(rows, s.h - sy), k = (sy + sh / 2) / s.h, o = Math.round(amt * k * k);
    if (off !== null && o !== off) { ctx.drawImage(s.img, 0, y0, s.w, sy - y0, X + off, Y + y0, s.w, sy - y0); y0 = sy; }
    off = o;
  }
  if (off !== null) ctx.drawImage(s.img, 0, y0, s.w, s.h - y0, X + off, Y + y0, s.w, s.h - y0);
}
function drawDecor(d, cx) {
  const [, x, t, a] = d;
  const g = gl(x);
  switch (t) {
    case 'house': drawHouse(); break;
    case 'horreo': drawHorreo(); break;
    case 'gate': blit(GATE, 0, 180); break;
    case 'camellia': swayBlit(CAMELLIA, x, g + 2, sway(0.7, 1.5), 5); break;
    case 'gorse': swayBlit(GORSES[a], x, g + 3, sway(x * 0.01, 1.2), 4); break;
    case 'fern': swayBlit(FERNS[a], x, g + 2, sway(x * 0.013, 1.6), 3); break;
    case 'rock': blit(ROCKS[a], x, g + 3); break;
    case 'mush': blit(MUSH[a], x, g + 1); break;
    case 'log': blit(LOG, x, g + 3); break;
    case 'sign': blit(SIGNS[a], x, g + 4); break;
    case 'fountain': {
      blit(FOUNTAIN, x, g + 3);
      // the spout running into the trough, rings spreading on the water
      for (let y = g - 13; y < g - 5; y++) { R(x, y, 1, 1, (y + (G.t >> 1)) % 4 ? '#8fd0f0' : '#ffffff'); R(x + 1, y, 1, 1, (y + (G.t >> 1)) % 4 === 1 ? '#ffffff' : '#bfe6ff'); }
      const rr = (G.t >> 3) % 4;
      R(x - 1 - rr, g - 5, 1, 1, '#ffffff'); R(x + 2 + rr, g - 5, 1, 1, '#ffffff'); R(x - 1, g - 6, 4, 1, '#d8f0fa');
      break;
    }
    case 'ctree': {
      blit(CHERRY_TRUNK, x, g + 2);
      swayBlit(GARDEN_TOP, x, g - 58, sway(x * 0.01, 2), 4);
      break;
    }
    case 'otree': {
      blit(ORCH_TRUNK[a % 2], x, g + 2);
      swayBlit(ORCH_TOP[a % 3], x, g - 64, sway(x * 0.01, 2.2), 4);
      break;
    }
    case 'btree': {
      const sk = Math.min(1, (G.treeShake || 0) / 20), dx = Math.round(Math.sin(G.t * 1.9 + x) * 3 * sk), dy = Math.round(Math.cos(G.t * 2.7 + x) * 1.5 * sk);
      blit(BIG_TRUNK, x + (sk > 0.5 ? Math.round(dx / 3) : 0), g + 2);
      swayBlit(BIG_TOP[a % 2], x + dx, g - 88 + dy, sway(x * 0.01, 2.5) + dx, 4);
      break;
    }
    case 'huge': {
      const s = HUGE[a % 2];
      blit(s, x, g + 6);
      drawSquirrel(x, g + 6, s.hole, a);
      break;
    }
    case 'ceiling': {
      const x0 = Math.max(x, Math.floor((cx - 60 - x) / 46) * 46 + x);
      for (let cxp = x0, i = Math.round((x0 - x) / 46); cxp < Math.min(a, cx + W + 60); cxp += 46, i++) {
        const v = i % 3, y = -8 - (i % 2) * 6 + (nz(i, 5) * 4 | 0);
        hangBlit(CLUMPS[v], cxp + (nz(i, 6) * 10 | 0), y, sway(i * 0.9, 2), 4);
      }
      break;
    }
    case 'cascade': drawCascade(x, 236); blit(CASCADE, x + 55, 236); break;
    case 'reeds': drawReeds(a, 7); break;
    case 'fence': case 'pergola': case 'wall': {
      const s = stripFor(d), img = s.s || s;
      ctx.drawImage(img.img, img.x, img.y);
      if (t === 'pergola') drawVines(s.posts, x);
      break;
    }
    case 'flag': drawFlag(x, g); break;
    case 'farmhouse': blit(FARMHOUSE, x, g + 3); smoke(x + 40, g - 121, 8, 3); break;
    case 'palleiro': blit(PALLEIRO, x, g + 2); break;
    case 'corn': {
      for (let cxp = x, i = 0; cxp <= a; cxp += 8, i++) {
        if (cxp < cx - 12 || cxp > cx + W + 12) continue;
        swayBlit(CORN[i % 2], cxp + (nz(i, 3) * 3 | 0), gl(cxp) + 3 - (i % 2) * 2, sway(cxp * 0.05, 2.4), 5);
      }
      break;
    }
    case 'scarecrow': swayBlit(SCARECROW, x, g + 2, sway(2.1, 0.8), 6); break;
    case 'backrow': {
      const pf = 0.86, x0 = Math.floor((cx * pf - 50 - x) / 62);
      for (let i = Math.max(0, x0); ; i++) {
        const bx = x + i * 62 + (nz(i, 8) * 20 | 0), dx = bx + cx * (1 - pf);
        if (bx > a || dx > cx + W + 30) break;
        if (dx < cx - 30) continue;
        const gy = gl(dx);
        R(Math.round(dx) - 1, gy - 26, 3, 28, '#8a5a5c'); R(Math.round(dx), gy - 26, 1, 28, '#a87a78');
        swayBlit(BACK_TOP[i % 2], dx, gy - 34, sway(i, 1.4), 4);
      }
      break;
    }
    case 'hive': blit(HIVE, x, g + 2); drawBees(x, g, x); break;
    case 'ladder': blit(LADDER, x, g + 2); break;
    case 'basket': blit(BASKET, x, g + 1); break;
  }
}
// vines along the pergola wires: old stems twisting up the posts, leafy clumps, leaves dangling, grape bunches
function drawVines(posts, seed) {
  for (const px of posts) {
    const g = gl(px);
    for (let y = g; y > g - 40; y--) { const x = px + 2 + Math.round(Math.sin(y * 0.28 + px) * 1.6); R(x, y, 1, 1, y % 3 ? '#6a4a2a' : '#4a3020'); }
    for (let k = 0; k < 3; k++) { const y = g - 12 - k * 9, x = px + 2 + Math.round(Math.sin(y * 0.28 + px) * 1.6) + (k % 2 ? 1 : -2); R(x, y, 2, 2, '#5a8c38'); R(x + (k % 2), y, 1, 1, '#80b24a'); }
  }
  for (let k = 0; k + 1 < posts.length; k++) {
    const a = posts[k];
    for (let j = 0; j < 2; j++) {
      const vx = a + 10 + j * 18, gy = gl(vx) - 42, s = sway(vx * 0.03, 1.6);
      swayBlit(VINES[(k + j) % 3], vx, gy, s, 4);
      for (let i = 0; i < 3; i++) {
        const lx = vx - 9 + i * 8 + Math.round(s * 0.4), ly = gy + 6 + ((i + j) % 2) * 2, flip = Math.sin(G.t * 0.06 + vx + i) > 0.6 ? 1 : 0;
        R(lx, ly, 1, 2, '#3c6a2c'); R(lx - 1 + flip, ly + 2, 3, 2, '#5a8c38'); R(lx + flip, ly + 2, 1, 1, '#80b24a');
      }
      if ((k + j + seed) % 2 === 0) blit(GRAPES[(k * 2 + j) % 2], vx - 4 + Math.round(s * 0.5), gy + 4);
    }
  }
}
L2.drawBehind = function (cx) {
  for (let layer = 0; layer < 4; layer++) for (const d of DECOR) if (d[0] === layer && vis(d, cx)) drawDecor(d, cx);
};

// ============================================================
// drawGround (world space): the baked chunks, then the living parts
// ============================================================
const LIGHTS = [];
for (let x = 1380; x < 2840; x += 70 + (nz(x, 61) * 70 | 0)) if (x < 1950 || x > 2190) LIGHTS.push([x, 12 + (nz(x, 62) * 16 | 0)]);
const PUDDLES = [];
for (let x = 3150; x < 4360; x += 80 + (nz(x, 63) * 70 | 0)) PUDDLES.push([x, 9 + (nz(x, 64) * 10 | 0)]);
const css = v => '#' + v.toString(16).padStart(6, '0');
const BLADES = ZP.map(Z => Z.blade.map(css));   // the zones' grass colours as CSS strings for R()
function liveGrass(cx) {
  const x0 = Math.floor((cx - 4) / 3) * 3;
  for (let x = x0; x < cx + W + 4; x += 3) {
    const r = nz(x, 301);
    if (r < 0.62 || (x > WX0 && x < WX1)) continue;
    const z = zoneAt(x, 0), Bl = BLADES[z], si = gl(x), h = 3 + (nz(x, 302) * 4 | 0), s = sway(x * 0.05, 1.4);
    if (z === 2 && r < 0.86) continue;
    for (let k = 1; k <= h; k++) R(x + Math.round(s * (k / h) * (k / h)), si - k, 1, 1, k === h ? Bl[2] : k > h / 2 ? Bl[1] : Bl[0]);
    if (r > 0.95 && z !== 2 && z !== 3) {
      // a little flower on a stem: daisy, buttercup or clover
      const fxp = x + Math.round(s), fy = si - h - 1, kind = (nz(x, 303) * 3) | 0;
      const c = kind === 0 ? '#ffffff' : kind === 1 ? '#ffe066' : '#f0a0d0';
      R(fxp - 1, fy, 3, 1, c); R(fxp, fy - 1, 1, 3, c); R(fxp, fy, 1, 1, kind === 0 ? '#ffd23f' : kind === 1 ? '#e0a020' : '#c86aa8');
    }
  }
}
function drawWater(cx) {
  if (cx > WX1 + 10 || cx + W < WX0 - 10) return;
  // glints flowing toward the viewer down the channel, foam along the banks
  for (let i = 0; i < 26; i++) {
    const u = nz(i, 401), per = 34 + (u * 20 | 0), t = (G.t * (0.5 + u * 0.4) + i * 13) % per, y = Math.round(WS + 2 + t);
    if (y >= H) continue;
    const l = chanL(y), r = chanR(y), x = Math.round(l + 4 + nz(i, 402) * (r - l - 10));
    R(x, y, 3 + (u * 3 | 0), 1, u > 0.5 ? '#d8f0fa' : '#a8dcf4');
  }
  for (let y = WS + 4; y < H; y += 3) {
    const f = ((y + (G.t >> 2)) % 6) < 3;
    if (f) { R(Math.round(chanL(y)) + 1, y, 2, 1, '#e8f6fc'); R(Math.round(chanR(y)) - 2, y, 2, 1, '#e8f6fc'); }
  }
  // stepping stones poking out of the water at the walking line, glints and foam around them
  blit(STONES, 2026, 229);
  for (let i = 0; i < 10; i++) {
    const x = 1986 + ((i * 19 + (G.t >> 2)) % 170), on = (G.t + i * 7) % 20 < 12;
    if (on) R(x, WS + 1 + (i % 3), 2 + (i % 2), 1, '#e8f6fc');
  }
  for (const sx of [2034, 2071, 2108]) { const f = (G.t >> 3) % 2; R(sx - 7 - f, WS, 3, 1, '#ffffff'); R(sx + 6 + f, WS, 3, 1, '#ffffff'); }
}
function drawLights(cx) {
  // dappled sun flecks through the canopy: a few small bright ovals per patch on the path and the grass, breathing
  if (cx > 2850 || cx + W < 1350) return;
  ctx.fillStyle = '#fff4c0';
  for (const [x, hw] of LIGHTS) {
    if (x + hw + 10 < cx || x - hw - 10 > cx + W) continue;
    for (let j = 0; j < 4; j++) {
      const fx0 = x + Math.round((nz(x, 70 + j) - 0.5) * hw * 2), r = 3 + (nz(x, 80 + j) * 6 | 0), ph = Math.sin(G.t * 0.018 + x + j * 1.7);
      ctx.globalAlpha = 0.22 + 0.12 * ph;
      for (let i = -r; i <= r; i++) {
        const k = 1 - (i / r) * (i / r), h = Math.round(3 * Math.sqrt(k));
        if (h > 0) ctx.fillRect(fx0 + i, gl(fx0 + i) - 1, 1, h + 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}
function drawWet(cx, rain) {
  // a dark wet sheen on the path with light catching its edge, puddles mirroring the grey sky, rings where drops fall
  const x0 = Math.floor(cx / 4) * 4;
  ctx.globalAlpha = 0.38 * rain; ctx.fillStyle = '#26303e';
  for (let x = x0; x < cx + W; x += 4) ctx.fillRect(x, gl(x + 2), 4, 5);
  ctx.globalAlpha = 0.7 * rain; ctx.fillStyle = '#dce8f4';
  for (let x = x0; x < cx + W; x += 4) if (nz(x, 501) > 0.62 && (G.t + x) % 90 < 64) ctx.fillRect(x, gl(x + 2), 2 + (nz(x, 502) * 4 | 0), 1);
  const a = clamp(rain * 2.2, 0, 1);
  for (const [x, hw] of PUDDLES) {
    if (x + hw < cx || x - hw > cx + W) continue;
    const g = gl(x);
    ctx.globalAlpha = a;
    for (let i = -hw; i <= hw; i++) {
      const k = 1 - (i / hw) * (i / hw), h = Math.max(1, Math.round(3.4 * Math.sqrt(k)));
      R(x + i, g, 1, h, '#8a9cb4');
      R(x + i, g + h, 1, 1, '#3a4658');
      if (Math.abs(i + hw * 0.3) < hw * 0.35) R(x + i, g + 1, 1, 1, '#c8d6e6');
    }
    R(x - hw - 1, g, 1, 1, '#3a4658'); R(x + hw + 1, g, 1, 1, '#3a4658');
    for (let j = 0; j < 3; j++) {
      const cyc = 24, u = G.t + j * 9 + x, tt = u % cyc, gen = Math.floor(u / cyc);
      if (tt > 15 || rain < 0.15) continue;
      const rx = Math.round(x + (hsh(gen * 3.1 + x + j) - 0.5) * hw * 1.3), r = 1 + (tt >> 2);
      R(rx - r, g + 1, 1, 1, '#f0f6fc'); R(rx + r, g + 1, 1, 1, '#f0f6fc');
      if (r > 1) R(rx - r + 1, g, r * 2 - 1, 1, '#dce8f4');
    }
  }
  ctx.globalAlpha = 1;
}
L2.drawGround = function (cx) {
  drawChunks(cx);
  liveGrass(cx);
  drawWater(cx);
  drawLights(cx);
  const w = weather();
  if (w.rain > 0.02) drawWet(cx, w.rain);
};

// ============================================================
// drawPlat (world space): baked once per platform
// ============================================================
L2.drawPlat = function (pl) {
  let s = platArt.get(pl);
  if (!s) { buildPlat(pl); s = platArt.get(pl); }
  blit(s, pl.x, pl.y);
};

// ============================================================
// drawFront (screen space): the water over the waders' feet, splashes, petals and leaves, then a few low plants
// passing in front at parallax 1.3 along the bottom edge
// ============================================================
const PETALC = ['#ffd2e4', '#ffb0d0', '#fff2f8', '#f592bc'], LEAFC = ['#6a9a3a', '#86ac40', '#b07a3a'];
function frontWater(cx) {
  if (cx > 2160 || cx + W < 1980) return;
  ctx.globalAlpha = 0.5;
  for (let x = Math.max(1980, cx); x < Math.min(2160, cx + W); x++) {
    const b = gl(x);
    if (b <= WS) continue;
    ctx.fillStyle = '#6cbbe6'; ctx.fillRect(x - cx, WS + 1, 1, b - WS);
  }
  ctx.globalAlpha = 0.85; ctx.fillStyle = '#d8f0fa';
  for (let x = Math.max(1980, cx); x < Math.min(2160, cx + W); x++) if (gl(x) > WS && (x + (G.t >> 3)) % 9 < 5) ctx.fillRect(x - cx, WS, 1, 1);
  ctx.globalAlpha = 1;
}
function drawEffects(cx) {
  for (const f of fx) {
    const x = Math.round(f.x - cx), y = Math.round(f.y);
    if (x < -10 || x > W + 10) continue;
    if (f.k === 'drop') { ctx.fillStyle = f.c; ctx.fillRect(x, y, f.s || 1, f.vy < 0 ? 2 : f.s || 1); }
    else if (f.k === 'foam') {
      // a little crown of foam at the feet
      const r = f.r + (f.t >> 2), a = 1 - f.t / f.life;
      ctx.globalAlpha = a; ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - r, y, r * 2 + 1, 1); ctx.fillRect(x - r + 1, y - 1, 2, 1); ctx.fillRect(x + r - 2, y - 1, 2, 1); ctx.fillRect(x - 1, y - 1 - (f.t < 6 ? 1 : 0), 2, 1);
      ctx.globalAlpha = 1;
    }
    else if (f.k === 'ring') {
      const r = f.r + Math.floor(f.t / 4), a = 1 - f.t / f.life;
      ctx.globalAlpha = a; ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - r - 1, y, 2, 1); ctx.fillRect(x + r, y, 2, 1); ctx.fillStyle = '#dff2fb'; ctx.fillRect(x - r + 1, y - 1, r * 2 - 1, 1); ctx.fillRect(x - r + 1, y + 1, r * 2 - 1, 1);
      ctx.globalAlpha = 1;
    } else {
      const lf = f.k === 'leaf', fr0 = Math.floor(f.ph * 3 + f.t * (lf ? 0.12 : 0.2)) % 4;
      ctx.globalAlpha = Math.min(1, (f.life - f.t) / 30);
      ctx.fillStyle = lf ? LEAFC[f.c % 3] : PETALC[f.c % 4];
      if (lf) { if (fr0 % 2) ctx.fillRect(x - 1, y, 3, 1); else ctx.fillRect(x, y - 1, 1, 2), ctx.fillRect(x + 1, y, 1, 1); }
      else if (f.big) { ctx.fillRect(x, y, fr0 === 1 ? 2 : 3, fr0 === 3 ? 3 : 2); ctx.fillStyle = '#ffffff'; if (fr0 === 0) ctx.fillRect(x + 1, y, 1, 1); }
      else ctx.fillRect(x, y, fr0 === 1 ? 1 : 2, fr0 === 3 ? 2 : 1);
      ctx.globalAlpha = 1;
    }
  }
}
L2.drawFront = function (cx) {
  frontWater(cx);
  drawEffects(cx);
  // low plants in front, parallax 1.3, kept below the walking line (y > 245) so they never hide the action
  const off = cx * 1.3, sp = 74;
  for (let i = Math.floor((off - 60) / sp); i * sp - off < W + 60; i++) {
    if (hsh(i * 1.7 + 3) < 0.42) continue;
    const sx = Math.round(i * sp + hsh(i) * 34 - off), wx = cx + sx, z = zoneAt(wx, 0);
    if (wx > 1950 && wx < 2190) continue;
    const pick = z === 0 || z === 1 ? (hsh(i + 9) < 0.5 ? 1 : hsh(i + 11) < 0.5 ? 0 : 3) : z === 2 ? (hsh(i + 9) < 0.6 ? 0 : 5) : z === 3 ? (hsh(i + 9) < 0.6 ? 2 : 3) : (hsh(i + 9) < 0.6 ? 4 : 2);
    const s = FRONT[pick], amt = sway(i * 1.3, 2.4);
    swayBlit(s, sx, H + 5, amt, 3);
  }
};

// ============================================================
// Interactive trees (props). Only the canopy can be hit: level shots fly under it, shots aimed up and blasts hit it.
// ============================================================
const CH_PAIRS = [[-17, 8], [-3, 15], [11, 11], [21, 1]];   // cherries hanging from the lower half of the canopy
function canopyShake(o) { return o.shake > 0 ? Math.round(Math.sin(o.shake * 1.7) * Math.min(3, o.shake / 4)) : 0; }
// which canopy: the tree's place among the level's trees of its kind, so the next one along always looks different
const treeLook = o => LV.props.filter(s => s.k === o.k && s.x < o.x).length % 3;
PROP_TYPES.cherrytree = {
  make(o) { o.hp = 3; o.done = false; o.shake = 0; o.cy = o.y - 62; o.n = hsh(o.x * 0.37) > 0.5 ? 3 : 2; o.look = treeLook(o); },
  box: o => o.done ? null : { x: o.x - 26, y: o.y - 86, w: 52, h: 38 },
  hit(o, d) {
    if (o.done) return;
    o.shake = 16;
    petalPuff(o.x, o.cy, 6, 1.2);
    if (!propHurt(o, d)) return;
    // the blossom bursts and the cherries drop
    o.done = true; o.hitT = 5; o.shake = 22;
    petalPuff(o.x, o.cy, 70, 2.6); o.burst = 16;
    for (let i = 0; i < o.n; i++) dropItem('cherry', o.x - 10 * (o.n - 1) / 2 + i * 10, o.cy + 16, i - (o.n - 1) / 2);
    addScore(100, o.x, o.cy - 26);
    G.texts.push({ x: o.x, y: o.cy - 36, s: 'CHERRIES!', t: 60, c: '#ff8ab0' });
    Snd.noise(0.35, 0.1, 2600); Snd.tone('triangle', 880, 1320, 0.12, 0.07); Snd.tone('triangle', 1320, 1760, 0.12, 0.06, 0.1);
  },
  update(o) { if (o.shake > 0) o.shake--; if (o.burst > 0) o.burst--; },
  draw(o) {
    const sh = canopyShake(o), s = sway(o.x * 0.01, 2);
    blit(CHERRY_TRUNK, o.x, o.y + 2);
    const top = CHERRY_TOP[o.look || 0];
    swayBlit(top, o.x + sh, o.cy, s + sh, 4, FLASH ? top.white : null);
    if (!o.done && !FLASH) for (let i = 0; i < CH_PAIRS.length; i++) {
      const [dx, dy] = CH_PAIRS[i], k = (dy + 25) / 50;
      blit(CHERRIES, o.x + dx + sh + Math.round(s * (1 - k) * (1 - k)) + Math.round(Math.sin(G.t * 0.05 + i) * 0.6), o.cy + dy);
    }
    if (o.burst > 0) {
      // the blossom bursting: a soft white flash and a ring of petals over the canopy
      ctx.globalAlpha = o.burst / 16 * 0.55; ctx.fillStyle = '#fff4f8'; pdisc(o.x, o.cy, 30 - o.burst); ctx.globalAlpha = 1;
    }
  }
};

const BURR_AT = [[-20, 6], [4, 12], [22, 0]];   // burrs on the chestnut canopy (from its centre)
PROP_TYPES.chestnuttree = {
  make(o) { o.hp = 1; o.done = false; o.shake = 0; o.cy = o.y - 74; o.burrs = []; o.left = 3; o.dropT = 0; o.look = treeLook(o); },
  box: o => o.done ? null : { x: o.x - 34, y: o.y - 102, w: 68, h: 46 },
  hit(o) {
    if (o.done) return;
    o.done = true; o.shake = 20; o.hitT = 4; o.dropT = 1;
    leafPuff(o.x, o.cy, 10);
    Snd.hit(); Snd.noise(0.25, 0.08, 1400);
  },
  update(o) {
    if (o.shake > 0) o.shake--;
    // the burrs let go one after another
    if (o.dropT && o.left > 0 && --o.dropT <= 0) {
      const [dx, dy] = BURR_AT[3 - o.left];
      o.burrs.push({ x: o.x + dx, y: o.cy + dy, vx: 0, vy: 0.3, t: 0, hit: false });
      o.left--; o.dropT = 16;
      Snd.tone('square', 900, 600, 0.04, 0.04);
    }
    for (const b of o.burrs) {
      b.t++; b.vy = Math.min(b.vy + 0.2, 5); b.x += b.vx; b.y += b.vy;
      // a bonk on any robot it lands on
      if (!b.hit && b.vy > 0) for (const e of G.enemies) {
        if (!e.active || e.dead || offStage(e) || !inBox(b.x, b.y + 5, ebox(e))) continue;
        if (damageEnemy(e, 4)) {
          b.hit = true; b.vy = -2.4; b.vx = b.x < e.x ? -1.1 : 1.1;
          sparks(b.x, b.y + 4, 5, '#d8ec8a');
          G.texts.push({ x: b.x, y: b.y - 10, s: 'BONK!', t: 40, c: '#ffe066' });
          Snd.tone('square', 760, 240, 0.09, 0.1);
          break;
        }
      }
      // it splits open where it lands: a chestnut to pick up
      let floor = groundAt(b.x);
      for (const pl of LV.plats) if (b.x > pl.x && b.x < pl.x + pl.w && b.y - b.vy <= pl.y - 6 && b.y >= pl.y - 6) floor = Math.min(floor, pl.y);
      if (b.y >= floor - 6 && b.vy > 0) {
        b.gone = true;
        debris(b.x, floor - 4, 5, '#9cc044'); dust(b.x, floor, 3);
        dropItem('chestnut', b.x, floor - 6, 0);
        Snd.tone('square', 300, 180, 0.05, 0.06);
      }
      if (b.t > 300) b.gone = true;
    }
    o.burrs = o.burrs.filter(b => !b.gone);
  },
  draw(o) {
    const sh = canopyShake(o), s = sway(o.x * 0.01 + 3, 1.6);
    blit(CHEST_TRUNK, o.x, o.y + 2);
    const top = CHEST_TOP[o.look || 0];
    swayBlit(top, o.x + sh, o.cy, s + sh, 4, FLASH ? top.white : null);
    for (let i = 3 - o.left; i < 3; i++) {
      const [dx, dy] = BURR_AT[i], k = (dy + 30) / 62, wob = o.dropT > 0 && i === 3 - o.left ? Math.round(Math.sin(G.t * 1.3)) : 0;
      blit(BURR[(G.t >> 5) % 2 * 2], o.x + dx + sh + wob + Math.round(s * (1 - k) * (1 - k)), o.cy + dy);
    }
    for (const b of o.burrs) blit(BURR[(b.t >> 1) % 4], b.x, b.y);
  }
};
}
