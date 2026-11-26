'use strict';
// =====================================================================================================
// MISSION 3 "VOLCANO ISLAND" - proposal frame for AREA 1: SHARK BAY (painter key: bay). A mock screenshot, not
// game content: an --extra fixture for the harness, loaded after the base.html snapshot. It pushes a temporary
// mission 3 built around one camera position and registers what the frame shows:
//   ENEMY_TYPES.shark  the robot shark. mode 'fin': cruising, only the dorsal fin cuts the water (its beacon blinks,
//                      a dark shape under the surface); 'warn': it stops, ripple rings flash red and a '!' pops up:
//                      it leaps next; 'leap': the arc out of the water, jaws open on a glowing furnace mouth.
//   POW_KINDS.turtle   a sea turtle in a robot cage on the pier, HELP! bubble
//   RIDES.jetski       the red BATTLE JET-SKI: nose gun on a ball mount (swings up, here at the leaping shark),
//                      V wake, rooster tail, bow spray; its HUD panel shows armour and torpedoes
//   the pier           a one-way platform on stilts (LV.plats + drawPlat)
// Static art is painted pixel by pixel once into offscreen canvases (crisp, outlined, 3-tone shading); the live bits
// use G.t and hsh() only: nothing here calls Math.random or rand().
// =====================================================================================================
{
// ---------------------------------------------------------------------------------------------------- constants
const CAM = 600;                 // camera x of the frame (world)
const HX = 750;                  // hero on the jet-ski (world x): screen x 150
const WL = 224;                  // the lagoon surface the playfield floats on
const HZ = 126;                  // sea horizon
const MG = 40;                   // strip margin (room for parallax)
const SUNX = 84, SUNY = 64;      // the morning sun (screen)
const PIER_X = CAM + 386, PIER_Y = 192, PIER_W = 260;
const CAGE_X = CAM + 438;
const GUN_A = 0.88;              // nose gun angle (up from forward)

// ---------------------------------------------------------------------------------------------------- helpers
const NONE = -1;
const I = s => parseInt(s.slice(1, 7), 16);
const OUTI = I(OUT);
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rgbI = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
function mixI(a, b, k) {
  const A = rgbI(a), B = rgbI(b);
  return (Math.round(lerp(A[0], B[0], k)) << 16) | (Math.round(lerp(A[1], B[1], k)) << 8) | Math.round(lerp(A[2], B[2], k));
}
const mixC = (a, b, k) => mixI(I(a), I(b), k);
const hexI = c => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const rgba = (c, a) => { const v = rgbI(typeof c === 'string' ? I(c) : c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a.toFixed(3) + ')'; };
function vnoise(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hsh(i * 1.37 + s * 61.3), hsh((i + 1) * 1.37 + s * 61.3), u); }
function fbm(x, s, oct = 3) { let v = 0, a = 1, n = 0, f = 1; for (let o = 0; o < oct; o++) { v += a * vnoise(x * f, s + o * 17); n += a; a *= 0.5; f *= 2.07; } return v / n; }
const h2 = (x, y, s) => hsh(x * 12.9898 + y * 78.233 + s * 37.719);
function vn2(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return lerp(lerp(h2(i, j, s), h2(i + 1, j, s), a), lerp(h2(i, j + 1, s), h2(i + 1, j + 1, s), a), b);
}
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Pixel buffers: 0xRRGGBB ints, NONE = empty. A local point (x, y) lands on buffer pixel (x + ox, y + oy).
function buf(w, h, ox = 0, oy = 0) { const d = new Int32Array(w * h); d.fill(NONE); return { w, h, d, ox, oy }; }
function put(b, x, y, c) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; }
function get(b, x, y) { x = Math.floor(x) + b.ox; y = Math.floor(y) + b.oy; return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.d[y * b.w + x] : NONE; }
function rect(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
function disc(b, cx, cy, r, c) {
  const n = Math.ceil(r), R2 = (r + 0.5) * (r + 0.5), X = Math.round(cx), Y = Math.round(cy);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) if (i * i + j * j <= R2) put(b, X + i, Y + j, c);
}
function oval(b, cx, cy, rx, ry, c) {
  const RX = rx + 0.5, RY = ry + 0.5;
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++)
    if (i * i / (RX * RX) + j * j / (RY * RY) <= 1) put(b, Math.round(cx) + i, Math.round(cy) + j, c);
}
function line(b, x0, y0, x1, y1, c, t = 1) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1));
  for (let i = 0; i <= n; i++) rect(b, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), t, t, c);
}
function poly(b, pts, c) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const ax = pts[i][0], ay = pts[i][1], bx = pts[j][0], by = pts[j][1];
      if ((ay <= yc) !== (by <= yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b2) => a - b2);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x + 0.5 <= xs[k + 1]; x++) put(b, x, y, c);
  }
}
function inPoly(P, x, y) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// 1px outline round everything painted (4 neighbours)
function outline(b, c = OUTI) {
  const add = [], W0 = b.w;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < W0; x++) {
    const i = y * W0 + x;
    if (b.d[i] !== NONE) continue;
    if ((x > 0 && b.d[i - 1] !== NONE) || (x < W0 - 1 && b.d[i + 1] !== NONE) || (y > 0 && b.d[i - W0] !== NONE) || (y < b.h - 1 && b.d[i + W0] !== NONE)) add.push(i);
  }
  for (const i of add) b.d[i] = c;
}
function bake(b) {
  const c = canvasOf(b.w, b.h), g = c.getContext('2d'), im = g.createImageData(b.w, b.h), d = im.data;
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i];
    if (v === NONE) continue;
    const j = i * 4;
    d[j] = (v >> 16) & 255; d[j + 1] = (v >> 8) & 255; d[j + 2] = v & 255; d[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
const sprite = b => ({ img: bake(b), w: b.w, h: b.h, ox: b.ox, oy: b.oy });
const blit = (s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ox, Math.round(y) - s.oy);
// colour of a list of [y, '#hex'] stops: banded (step) or smooth
function stepCol(stops, y) { let i = 0; while (i + 1 < stops.length && stops[i + 1][0] <= y) i++; return I(stops[i][1]); }
function gradCol(stops, y) {
  let i = 0;
  while (i + 1 < stops.length && stops[i + 1][0] <= y) i++;
  const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
  return b[0] > a[0] ? mixC(a[1], b[1], clamp((y - a[0]) / (b[0] - a[0]), 0, 1)) : I(a[1]);
}
// water bands with dithered seams
function bands(b, stops, y0, y1, X0, X1) {
  for (let y = y0; y < y1; y++) {
    let i = 0;
    while (i + 1 < stops.length && stops[i + 1][0] <= y) i++;
    const c = I(stops[i][1]), prev = i > 0 ? I(stops[i - 1][1]) : c, seam = y - stops[i][0];
    for (let x = X0; x < X1; x++) put(b, x, y, (seam === 0 && ((x + y) & 1)) || (seam === 1 && x % 4 === 0) ? prev : c);
  }
}

// ---------------------------------------------------------------------------------------------------- static strips
// a strip of scenery: design coordinates are screen coordinates at camera CAM; parallax p for other cameras
function strip(top, bot, p, fn) { const b = buf(W + 2 * MG, bot - top, MG, -top); fn(b); return { b, c: bake(b), top, h: bot - top, p }; }
function drawStrip(L, cx) {
  const off = clamp(Math.round((cx - CAM) * L.p), 12 - MG, MG - 12);
  ctx.drawImage(L.c, MG + off - 10, 0, W + 20, L.h, -10, L.top, W + 20, L.h);
}

// ---------------------------------------------------------------------------------------------------- sky, sun, clouds
const SKY = [[-10, '#3a6fc6'], [22, '#4e86d4'], [50, '#7aa9de'], [74, '#aac9e0'], [92, '#dcd6c8'], [106, '#f8d7ae'], [118, '#ffdca6'], [HZ, '#ffe4b0']];
function skyCanvas() { const b = buf(1, H + 20, 0, 10); for (let y = -10; y < H + 10; y++) put(b, 0, y, gradCol(SKY, y)); return bake(b); }
function sunCanvas() {
  const R0 = 84, c = canvasOf(R0 * 2, R0 * 2), g = c.getContext('2d');
  const gr = g.createRadialGradient(R0, R0, 3, R0, R0, R0);
  gr.addColorStop(0, 'rgba(255,250,228,0.95)'); gr.addColorStop(0.15, 'rgba(255,238,190,0.5)'); gr.addColorStop(0.42, 'rgba(255,224,164,0.16)'); gr.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = gr; g.fillRect(0, 0, R0 * 2, R0 * 2);
  const b = buf(R0 * 2, R0 * 2, R0, R0);
  disc(b, 0, 0, 12, I('#ffe3a2')); disc(b, 0, 0, 11, I('#fff0c4')); disc(b, -1, -1, 9, I('#fffae6')); disc(b, -2, -2, 5, I('#ffffff'));
  g.drawImage(bake(b), 0, 0);
  return c;
}
// soft rays fanning right and down from the sun in the upper left
function rayCanvas(s) {
  const w = 560, h = 320, c = canvasOf(w, h), g = c.getContext('2d'), ox = 100, oy = 80;
  for (let i = 0; i < 12; i++) {
    const a = -0.3 + (i + hsh(i * 3 + s) * 0.7) / 12 * 2.2, len = 230 + hsh(i * 7 + s) * 230, wd = 0.018 + hsh(i * 5 + s) * 0.03;
    const gr = g.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
    gr.addColorStop(0, 'rgba(255,238,198,0.22)'); gr.addColorStop(1, 'rgba(255,238,198,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(ox, oy);
    g.lineTo(ox + Math.cos(a - wd) * len, oy + Math.sin(a - wd) * len); g.lineTo(ox + Math.cos(a + wd) * len, oy + Math.sin(a + wd) * len);
    g.closePath(); g.fill();
  }
  return c;
}
// morning cumulus, lit from the left (lx = -1), golden-pink undersides
function cloudCanvas(w, s, pal, lx) {
  const h = Math.round(w * 0.5) + 6, base = h - 3, b = buf(w + 10, h, 5, 0), puffs = [];
  const n = 3 + Math.floor(w / 20), m = 1 + Math.floor(w / 46);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, r = w * (0.08 + 0.1 * Math.sin(t * Math.PI)) * (0.8 + 0.45 * hsh(s * 7 + i)); puffs.push([t * w, base - r * 0.6, r]); }
  for (let i = 0; i < m; i++) { const t = 0.32 + 0.36 * (m === 1 ? 0.5 : i / (m - 1)) + (hsh(s * 3 + i) - 0.5) * 0.14, r = w * (0.15 + 0.06 * hsh(s * 11 + i)); puffs.push([t * w, base - r * 0.55 - w * 0.12, r]); }
  const [C0, C1, C2] = pal.map(I);
  const lay = (dx, dy, dr, c, cut) => {
    for (const [x, y, r] of puffs) {
      const R2 = r + dr;
      if (R2 <= 0) continue;
      for (let yy = -Math.floor(R2); yy <= R2; yy++) {
        const Y = Math.round(y + dy + yy);
        if (Y > base - cut) break;
        const hw = Math.floor(Math.sqrt((R2 + 0.5) ** 2 - yy * yy));
        for (let X = Math.round(x + dx) - hw; X <= Math.round(x + dx) + hw; X++) put(b, X, Y, c);
      }
    }
  };
  lay(0, 0, 0, C0, 0);
  lay(-0.5 * lx, -2, -0.8, C1, 3);
  for (const [x, y, r] of puffs) {
    const hr = r * 0.55, hx = x + lx * r * 0.28, hy = y - r * 0.38;
    for (let yy = -Math.floor(hr); yy <= hr; yy++) {
      const hw = Math.floor(Math.sqrt((hr + 0.5) ** 2 - yy * yy));
      for (let X = Math.round(hx) - hw; X <= Math.round(hx) + hw; X++) if (get(b, X, Math.round(hy + yy)) === C1) put(b, X, Math.round(hy + yy), C2);
    }
  }
  for (let X = -5; X < w + 5; X++) if (get(b, X, base) === C0 && hsh(X * 1.7 + s) > 0.5) put(b, X, base + 1, C0);
  return bake(b);
}
const CLOUD_PAL = ['#ecbcae', '#fbe3d4', '#fff8ef'];
// [width, x, y, parallax, drift]
const CLOUDS = [[96, 176, 62, 0.05, 0.012], [64, 276, 94, 0.04, 0.009], [46, 446, 82, 0.06, 0.014], [38, 6, 40, 0.07, 0.016], [30, 120, 104, 0.035, 0.008]];

// ---------------------------------------------------------------------------------------------------- the far view
const VX = 372, VTOP = 57, VWL = 128, VWR = 152;
function vprof(x) {
  const d = x - VX, ad = Math.abs(d), rim = 8, VW = d < 0 ? VWL : VWR;
  if (ad > VW) return 999;
  let y;
  if (ad <= rim) y = VTOP;
  else { const t = (ad - rim) / (VW - rim); y = VTOP + (HZ - 1 - VTOP) * (1 - Math.pow(1 - t, 2.3)); }
  const nx = x - (VX + 3);
  if (Math.abs(nx) < 3.5) y = Math.max(y, VTOP + 3.5 - Math.abs(nx));   // the notch in the crater rim
  if (d < -2 && ad < rim + 2) y -= 1;                                    // left rim a touch higher
  y += (fbm(x / 6, 3, 2) - 0.5) * (0.8 + 2.4 * ss(VTOP + 25, HZ, y));
  return y;
}
const HAZE = I('#c7c3d7');
function paintFar(b) {
  // the low far coast left of the volcano, sinking into the sea
  for (let x = 150; x < VX - VWL + 12; x++) {
    const top = HZ - 1 - 6.5 * ss(150, 246, x) - 2.2 * fbm(x / 7, 11, 2) * ss(150, 190, x);
    for (let y = Math.round(top); y < HZ; y++) {
      const k = vn2(x / 2.4, y / 2, 14);
      put(b, x, y, mixI(k > 0.62 ? I('#86a98c') : k < 0.36 ? I('#5d8277') : I('#71967f'), HAZE, 0.42));
    }
  }
  // the volcano: rock above, jungle on the lower third; lit from the left, gullies fanning from the summit, dark
  // old lava flows
  const C = {
    lit: I('#c99a86'), litG: I('#b08a80'), litR: I('#dcb49c'),
    sh: I('#7b7391'), shG: I('#6c6584'), shR: I('#8a829f'),
    flowL: I('#7c656c'), flowS: I('#554f6d'),
    jl: [I('#97ba73'), I('#77a067'), I('#5b8263')], js: [I('#719a7c'), I('#5c8371'), I('#4b6b69')]
  };
  const FLOWS = [[-60, 4, 0.44], [-33, 3, 0.58], [-13, 2.5, 0.34], [16, 3.5, 0.5], [46, 3, 0.38], [80, 4, 0.52], [110, 3, 0.46]];
  for (let x = VX - VWL; x <= VX + VWR; x++) {
    const top = vprof(x);
    if (top >= HZ) continue;
    const ty = Math.ceil(top);
    for (let y = ty; y < HZ; y++) {
      const r = (HZ - y) / (HZ - VTOP);
      const bx = (x - VX) * (HZ - VTOP) / Math.max(2, y - VTOP + 2);
      const g = 0.55 * vnoise(bx / 3.2 + 40, 5) + 0.45 * vnoise(bx / 1.4 + y / 7, 15);
      const lit = (x - VX) + (g - 0.5) * 10 * (1 - r) + (vnoise(y / 5, 8) - 0.5) * 3 < 3;
      const jung = r < 0.32 + (fbm(x / 13, 9, 2) - 0.5) * 0.18;
      let c;
      if (jung) {
        const k = vn2(x / 2.3, y / 2, 4) + (r > 0.26 ? 0.12 : 0);
        const P = lit ? C.jl : C.js;
        c = k > 0.66 ? P[0] : k < 0.36 ? P[2] : P[1];
      } else {
        let flow = false;
        for (const [fx, fw, fe] of FLOWS) if (r > fe && Math.abs(bx - fx - Math.sin(r * 9 + fx) * 2.5) < fw * (0.6 + 0.7 * (1 - r))) flow = true;
        if (flow) c = lit ? C.flowL : C.flowS;
        else c = lit ? (g > 0.68 ? C.litR : g < 0.32 ? C.litG : C.lit) : (g > 0.68 ? C.shR : g < 0.32 ? C.shG : C.sh);
      }
      if (y === ty && x < VX + 2) c = mixI(c, I('#ffe6c8'), 0.55);    // the rim catching the low sun
      put(b, x, y, mixI(c, HAZE, 0.28 + 0.2 * (1 - r)));
    }
  }
  // the crater: a dark inner wall in the notch, warm light on its lip
  for (let x = VX; x <= VX + 6; x++) { const y = Math.ceil(vprof(x)); put(b, x, y, mixC('#5c4a55', '#c7c3d7', 0.2)); put(b, x, y - 1, mixC('#ff9a5a', '#c7c3d7', 0.15)); }
  // a radio mast on the rim: the robots are home
  rect(b, VX - 6, Math.ceil(vprof(VX - 6)) - 5, 1, 5, mixC('#3a3a4a', '#c7c3d7', 0.35));
  // surf where the volcano's coast meets the sea
  for (let x = VX - VWL - 4; x < W + MG; x++) if (get(b, x, HZ - 1) !== NONE && hsh(x * 2.3) > 0.45) put(b, x, HZ - 1, mixC('#f2f6ee', '#c7c3d7', 0.15));
  // sea stacks off the left of the bay: weathered pillars, scrub on top, one pierced by an arch, surf at the feet
  const STACKS = [[7, 10, 18, 0], [21, 5, 9, 1], [32, 14, 13, 2]];
  for (const [sx, w, hgt, k] of STACKS) {
    for (let x = sx; x < sx + w; x++) {
      const u = (x - sx + 0.5) / w, prof = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), 3)), 0.5);
      const top = Math.round(HZ - hgt * (0.5 + 0.5 * prof) - (h2(x, k, 3) - 0.5) * 2.5);
      for (let y = top; y < HZ; y++) {
        const ax = Math.abs(x - (sx + 7));
        if (k === 2 && ax < 2.5 && y > HZ - 6 + ax * 0.9) continue;
        let c = u < 0.22 ? '#b6a8b4' : u > 0.74 ? '#686684' : vn2(x / 1.3, y / 2.5, k + 5) > 0.55 ? '#958aa2' : '#837d99';
        if (y === top && u < 0.6) c = '#cdbcc0';
        if (y > HZ - 3) c = '#5e5c78';
        put(b, x, y, mixC(c, '#c7c3d7', 0.22));
      }
      if (prof > 0.55 && h2(x, k, 9) > 0.25) { put(b, x, top - 1, mixC(h2(x, k, 11) > 0.5 ? '#7f9e6e' : '#5f8262', '#c7c3d7', 0.25)); if (h2(x, k, 12) > 0.6) put(b, x, top - 2, mixC('#7f9e6e', '#c7c3d7', 0.3)); }
    }
    for (let x = sx - 2; x < sx + w + 2; x++) if (hsh(x * 1.9 + k) > 0.3) put(b, x, HZ - 1, I('#f4f6f2'));
  }
}

// the open bay between the horizon and the spit
const BAYB = [[HZ, '#f7e9c6'], [HZ + 1, '#e2e2cf'], [HZ + 3, '#b8d6d4'], [HZ + 6, '#92c6d0'], [HZ + 10, '#70b2c9'], [HZ + 16, '#589fc0'], [HZ + 24, '#4890b6'], [HZ + 33, '#3e84ad']];
function paintBay(b, far) {
  const X0 = -MG, X1 = W + MG;
  bands(b, BAYB, HZ, 174, X0, X1);
  // the volcano and the stacks mirrored faintly in the water, broken by the swell
  for (let x = X0; x < X1; x++) for (let k = 1; k <= 9; k++) {
    const src = get(far, x, HZ - k);
    if (src === NONE || (x + k * 3) % 5 === 0 || h2(x, k, 3) > 0.75) continue;
    put(b, x, HZ + k, mixI(stepCol(BAYB, HZ + k), src, 0.3 * (1 - k / 11)));
  }
  // wave dashes, longer toward the viewer
  for (let i = 0; i < 300; i++) {
    const y = Math.round(HZ + 3 + Math.pow(hsh(i * 3.7 + 0.5), 1.1) * (172 - HZ - 3)), x = X0 + hsh(i * 5.3 + 1) * (X1 - X0);
    const len = 2 + Math.round((y - HZ) / 5 * (0.5 + hsh(i * 1.9))), base = stepCol(BAYB, y);
    rect(b, x, y, len, 1, hsh(i * 9.1) > 0.4 ? mixI(base, I('#ffffff'), 0.3) : mixI(base, I('#1d5576'), 0.16));
  }
}

// ---------------------------------------------------------------------------------------------------- the lagoon
const LAGB = [[164, '#c3f2e2'], [167, '#a9ecdd'], [171, '#8de3d6'], [177, '#6fd7cf'], [185, '#53c9c8'], [195, '#3db8c1'], [207, '#2fa8b9'], [220, '#2498af'], [235, '#1c88a5'], [251, '#16799a'], [265, '#116c8e']];
// coconut palms on the spit: [base x, base y, height, lean, seed, size]
const PALMS = [[16, 158, 98, 9, 1, 1.15], [47, 157, 72, -7, 2, 0.95], [131, 158, 86, 13, 3, 1.05], [152, 159, 60, 16, 4, 0.85],
  [302, 158, 44, -6, 5, 0.8], [468, 158, 84, -13, 7, 1.0]];
const SWL = 168;   // where the lagoon laps the spit
function paintLagoon(b) {
  const X0 = -MG, X1 = W + MG;
  bands(b, LAGB, 164, H, X0, X1);
  // the golden sky in the far water
  for (let y = 164; y < 180; y++) for (let x = X0; x < X1; x++) { const c = get(b, x, y); put(b, x, y, mixI(c, I('#fff0cc'), 0.32 * (1 - ss(164, 180, y)))); }
  // reflections of the palms and the hut under the spit
  for (const [x0, , hgt, lean, seed] of PALMS) {
    const n = Math.round(hgt * 0.3);
    for (let k = 0; k < n; k++) {
      if (k % 3 === 2) continue;
      const y = SWL + 1 + k, x = Math.round(x0 + lean * (k / hgt) * 1.4 + Math.sin(k * 0.9 + seed) * 1.2);
      for (let i = -1; i <= 1; i++) put(b, x + i, y, mixI(get(b, x + i, y), I('#1d6268'), 0.26));
    }
    const cy = SWL + 1 + n, cx = Math.round(x0 + lean * 0.42);
    for (let k = 0; k < 5; k++) for (let i = -12; i <= 12; i++) if (h2(i, k, seed) > 0.35 && Math.abs(i) < 12 - k * 1.5) put(b, cx + i, cy + k, mixI(get(b, cx + i, cy + k), I('#1d6268'), 0.18));
  }
  for (let x = 76; x < 120; x++) for (let k = 0; k < 9; k++) if ((x + k) % 3 && h2(x, k, 9) > 0.3) put(b, x, SWL + 2 + k, mixI(get(b, x, SWL + 2 + k), k < 4 ? I('#3a6a64') : I('#c8b070'), 0.2));
  // wind patches: broad lighter and darker stretches of water
  for (let y = 172; y < H; y++) for (let x = X0; x < X1; x++) {
    const k = vn2(x / 26, y / 5, 41) - 0.5;
    if (Math.abs(k) < 0.14) continue;
    put(b, x, y, mixI(get(b, x, y), k > 0 ? I('#dafff6') : I('#0d5a72'), Math.min(0.1, (Math.abs(k) - 0.14) * 0.45)));
  }
  // wavelets: little arched crests with a shaded back, bigger toward the viewer; plain trough dashes between
  for (let i = 0; i < 760; i++) {
    const k = Math.pow(hsh(i * 2.9 + 7), 0.8), y = Math.round(170 + k * (H - 170)), x = Math.round(X0 + hsh(i * 6.1 + 3) * (X1 - X0));
    const sc = clamp((y - 166) / 100, 0, 1), len = Math.max(2, Math.round(2 + sc * 8 * (0.6 + hsh(i * 2.3) * 0.8))), base = get(b, x, y);
    if (base === NONE) continue;
    if (hsh(i * 8.3) > 0.4) {
      rect(b, x, y, len, 1, mixI(base, I('#e8fffb'), 0.34 + 0.12 * sc));
      if (len >= 5) rect(b, x + 1, y - 1, len - 2, 1, mixI(base, I('#e8fffb'), 0.2));
      rect(b, x + 1, y + 1, Math.max(1, len - 1), 1, mixI(base, I('#0d5a72'), 0.15));
    } else rect(b, x, y, len, 1, mixI(base, I('#0d5a72'), 0.17));
  }
  // the reef floor showing through in the foreground: dark rock patches, pale sand, light ripples (caustics)
  for (let y = 234; y < H; y++) for (let x = X0; x < X1; x++) {
    const k = vn2(x / 10, y / 3.2, 13), c = get(b, x, y), d = ss(234, 252, y);
    if (k > 0.7) put(b, x, y, mixI(c, I('#0b5268'), 0.3 * d));
    else if (k > 0.66) put(b, x, y, mixI(c, I('#4fc7c4'), 0.25 * d));
    else if (k < 0.24) put(b, x, y, mixI(c, I('#58cfc6'), 0.18 * d));
    const ca = Math.sin(x * 0.21 + Math.sin(y * 0.5) * 2.2) + Math.sin(x * 0.13 - y * 0.31);
    if (ca > 1.55 && k < 0.66) put(b, x, y, mixI(get(b, x, y), I('#bff6ee'), 0.3 * d));
  }
  // corals seen through the water: brain domes, staghorn branches, a purple fan, sea grass; a few yellow fish
  const sub = (x, y, c, k) => { const o = get(b, x, y); if (o !== NONE) put(b, x, y, mixI(o, I(c), k)); };
  const dome = (cx, cy, rx, ry, c) => { for (let j = -ry; j <= 0; j++) for (let i = -rx; i <= rx; i++) if (i * i / (rx * rx) + j * j / (ry * ry) <= 1) sub(cx + i, cy + j, j < -ry * 0.55 ? '#f0b8f0' : (i + j) % 3 === 0 ? '#6a3a7a' : c, 0.4); };
  const stag = (cx, cy, h, c, seed) => { for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.38 + (hsh(seed + k) - 0.5) * 0.3, L = h * (0.6 + hsh(seed * 2 + k) * 0.5); for (let t = 0; t <= L; t += 0.5) { sub(cx + Math.cos(a) * t, cy + Math.sin(a) * t, t > L - 1.5 ? '#ffe0c8' : c, 0.42); } } };
  const fan = (cx, cy, r, c) => { for (let a = -Math.PI; a <= 0; a += 0.05) for (let t = 0; t <= r; t += 0.5) if (((t * 2) | 0) % 3 === 0 || Math.abs(Math.round(a * 20) % 4) === 0) sub(cx + Math.cos(a) * t, cy + Math.sin(a) * t * 0.9, c, 0.36); };
  const grass = (cx, cy, n, seed) => { for (let k = 0; k < n; k++) { const x = cx + k * 2 + (hsh(seed + k) - 0.5) * 2, h = 5 + hsh(seed * 3 + k) * 7; for (let t = 0; t < h; t++) sub(x + Math.sin(t * 0.4 + k) * 0.8, cy - t, '#1d6a4a', 0.4); } };
  dome(30, 262, 9, 6, '#a05aa8'); stag(52, 266, 11, '#ff8a6a', 3); grass(64, 268, 5, 4);
  fan(206, 268, 10, '#c05ac8'); dome(232, 268, 8, 5, '#b06ab0'); stag(248, 266, 9, '#ffa070', 7); grass(262, 270, 6, 8);
  dome(330, 264, 7, 5, '#a05aa8'); stag(352, 268, 12, '#ff7a6a', 11); grass(372, 270, 4, 12); stag(436, 266, 10, '#ffb070', 15); dome(458, 268, 9, 6, '#b06ab0');
  // a little school of yellow tangs swimming left (body, tail fin, an eye)
  for (let k = 0; k < 6; k++) {
    const fx = 156 + k * 9 + Math.round(hsh(k * 3.1) * 5), fy = 249 + Math.round(hsh(k * 5.7) * 8);
    for (const [dx, dy] of [[1, -1], [2, -1], [0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [4, -1], [4, 1], [4, 0]]) sub(fx + dx, fy + dy, dx === 4 ? '#e89a20' : dy < 0 ? '#fff08a' : '#ffd830', 0.6);
    sub(fx + 1, fy, '#1a2a30', 0.6);
  }
}

// ---------------------------------------------------------------------------------------------------- the spit
const LEAF = [I('#c4e47c'), I('#86c45a'), I('#559e47'), I('#357a3b'), I('#245a2f')];
function frond(b, x, y, a, L, droop, seed, pass) {
  const steps = Math.ceil(L * 1.6), sh = pass === 0 ? 1 : 0;
  for (let i = 1; i <= steps; i++) {
    const s = i / steps;
    const X = x + Math.cos(a) * L * s + sh, Y = y + Math.sin(a) * L * s + droop * L * s * s + sh;
    let tx = Math.cos(a), ty = Math.sin(a) + 2 * droop * s; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
    put(b, X, Y, pass === 0 ? LEAF[4] : s < 0.5 ? I('#8a8a3a') : LEAF[3]);
    if (i % 2) continue;
    const ll = (1 - s * 0.7) * 7 * Math.min(1.1, L / 18);
    for (const side of [-1, 1]) {
      const r = side * 0.95, dx = tx * Math.cos(r) - ty * Math.sin(r), dy = tx * Math.sin(r) + ty * Math.cos(r) + 0.6, dl = Math.hypot(dx, dy);
      const ux = dx / dl, uy = dy / dl, n = Math.max(1, Math.round(ll * (0.8 + 0.4 * h2(i, side, seed))));
      const litSide = uy < 0.15 || ux < -0.45;
      for (let k = 1; k <= n; k++) {
        const c = pass === 0 ? LEAF[4] : litSide ? (k === n && uy < 0 ? LEAF[0] : LEAF[1]) : (k > n - 2 ? LEAF[3] : LEAF[2]);
        put(b, X + ux * k, Y + uy * k, c);
      }
    }
  }
}
function palm(b, x0, y0, hgt, lean, seed, s) {
  const x1 = x0 + lean, y1 = y0 - hgt, qx = x0 + lean * 0.05 + (hsh(seed * 3.3) - 0.5) * 6, qy = y0 - hgt * 0.55;
  const at = t => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * qx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * qy + t * t * y1];
  const TR = [I('#c9a87e'), I('#9a7c5c'), I('#6f5944'), I('#584638')];
  const n = Math.ceil(hgt * 2.2);
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = at(t), wd = Math.max(2, Math.round(lerp(4.6, 2.6, t) * s));
    const xl = Math.round(x - wd / 2), yy = Math.round(y), ring = ((yy + seed * 7) % 4) === 0;
    for (let k = 0; k < wd; k++) put(b, xl + k, yy, ring ? (k === 0 ? TR[1] : TR[3]) : k === 0 ? TR[0] : k === wd - 1 ? TR[2] : TR[1]);
  }
  rect(b, Math.round(x0 - 3 * s), y0 - 1, Math.round(6 * s) + 1, 2, TR[2]);
  const NF = 9;
  for (let pass = 0; pass < 2; pass++) for (let f = 0; f < NF; f++) {
    const a = -Math.PI + 0.12 + (f / (NF - 1)) * (Math.PI - 0.24) + (hsh(seed * 9 + f) - 0.5) * 0.3;
    const up = Math.abs(a + Math.PI / 2) < 0.5;
    const L = (17 + hsh(seed * 5 + f) * 9) * s * (up ? 0.72 : 1);
    frond(b, x1, y1, a, L, 0.5 + hsh(seed * 7 + f) * 0.4 + (up ? 0.25 : 0), seed * 13 + f, pass);
  }
  for (let k = 0; k < 3; k++) { const cx = x1 + (k - 1) * 2.4, cy = y1 + 3 + (k % 2); disc(b, cx, cy, 1.3, I('#6a5628')); put(b, Math.round(cx) - 1, Math.round(cy) - 1, I('#a68e48')); }
}
function scrub(b, x, y, r, seed) {
  const C = [I('#a8d466'), I('#66a14a'), I('#43803d'), I('#2c5c33')];
  disc(b, x, y, r, C[3]);
  disc(b, x - 0.6, y - 0.8, r - 0.8, C[2]);
  disc(b, x - 1.2, y - 1.7, Math.max(0, r - 2.2), C[1]);
  for (let k = 0; k < r * 4; k++) {
    const a = hsh(seed * 3 + k) * 6.283, d = hsh(seed * 5 + k) * r;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.9;
    if (get(b, px, py) === NONE) continue;
    put(b, px, py, py < y - r * 0.3 ? C[0] : C[3]);
  }
  if (hsh(seed * 7) > 0.45) for (let k = 0; k < 3; k++) { const px = x + (hsh(seed + k * 3) - 0.5) * r * 1.4, py = y - r * 0.4 + hsh(seed * 2 + k) * r * 0.6; if (get(b, px, py) !== NONE) put(b, px, py, k % 2 ? I('#ff7fae') : I('#ffd2e4')); }
}
function hut(b, x, base) {
  const WW = 34, fl = base - 9, wt = fl - 15, rt = wt - 16;
  for (const sx of [2, 10, 23, 31]) { rect(b, x + sx, fl, 2, base - fl + 1, I('#5c4431')); put(b, x + sx, fl, I('#8a6a48')); }
  // walls: bamboo canes
  for (let i = 0; i < WW; i++) rect(b, x + i, wt, 1, fl - wt, i % 3 === 0 ? I('#a4844c') : i % 3 === 1 ? I('#e2c98c') : I('#c8aa68'));
  rect(b, x, wt + 4, WW, 1, I('#8a6a3a')); rect(b, x, fl - 4, WW, 1, I('#8a6a3a'));
  rect(b, x, wt, 2, fl - wt, I('#f0dca4'));
  // window with a red curtain, open doorway
  rect(b, x + 5, wt + 6, 8, 5, I('#2a1f1a')); rect(b, x + 5, wt + 6, 3, 5, I('#d8573a')); rect(b, x + 10, wt + 6, 3, 5, I('#d8573a')); rect(b, x + 5, wt + 6, 8, 1, I('#a8432c'));
  rect(b, x + 21, wt + 3, 8, fl - wt - 3, I('#2a1f1a')); rect(b, x + 21, wt + 3, 8, 1, I('#4a3626')); rect(b, x + 21, fl - 1, 8, 1, I('#4a3626'));
  // floor beam
  rect(b, x - 2, fl, WW + 4, 2, I('#6b4e34')); rect(b, x - 2, fl, WW + 4, 1, I('#a07c54'));
  // thatched hip roof: layered straw, a ragged fringe, a ridge cap
  const cx = x + WW / 2;
  for (let r = 0; r < 17; r++) {
    const y = rt + r, half = 7 + r * 1.42;
    for (let xx = Math.round(cx - half); xx <= Math.round(cx + half); xx++) {
      const band = (r + (hsh(xx * 0.7) > 0.6 ? 1 : 0)) % 4;
      let c = band === 0 ? I('#f4da98') : band === 3 ? I('#a87e3e') : I('#d6b064');
      if (xx < cx - half + 2.5) c = mixI(c, I('#fff2c8'), 0.35);
      else if (xx > cx + half - 2.5) c = mixI(c, I('#7a5a2c'), 0.3);
      put(b, xx, y, c);
    }
  }
  for (let xx = Math.round(cx - 31); xx <= Math.round(cx + 31); xx++) if (hsh(xx * 3.1) > 0.35) put(b, xx, rt + 17, I('#8a6430'));
  rect(b, Math.round(cx - 7), rt - 1, 15, 2, I('#8a6a34')); rect(b, Math.round(cx - 7), rt - 1, 15, 1, I('#b08a4a'));
  // ladder to the door
  for (let y = fl + 2; y <= base; y++) { put(b, x + 22, y, I('#7a5a3a')); put(b, x + 27, y, I('#7a5a3a')); if ((y - fl) % 3 === 0) rect(b, x + 22, y, 6, 1, I('#a07c54')); }
}
function nets(b, x0, x1, top, base) {
  for (const x of [x0, x1]) { rect(b, x, top, 2, base - top, I('#6a5038')); put(b, x, top, I('#a07c54')); }
  for (let x = x0 + 2; x < x1; x++) {
    const u = (x - x0) / (x1 - x0), sag = Math.round(Math.sin(u * Math.PI) * 6);
    put(b, x, top + 2 + sag, I('#d8c8a0'));
    for (let y = top + 3 + sag; y < top + 14 + sag - Math.round(Math.sin(u * Math.PI * 2) * 2); y++) if ((x + y) % 3 === 0 || (x - y) % 3 === 0) put(b, x, y, I('#5a4c3c'));
    if (x % 5 === 0) put(b, x, top + 3 + sag, x % 10 ? I('#ff8a3a') : I('#f4f0e6'));
  }
}
function canoe(b, x, y) {
  // outrigger float behind, two booms, the dugout hull
  rect(b, x + 6, y - 5, 24, 2, I('#d8c49a')); rect(b, x + 6, y - 5, 24, 1, I('#efe0b8'));
  for (const bx of [x + 11, x + 25]) line(b, bx, y - 4, bx + 1, y - 1, I('#8a6a48'));
  poly(b, [[x, y - 3], [x + 36, y - 3], [x + 33, y], [x + 3, y]], I('#a8462c'));
  rect(b, x + 1, y - 3, 35, 1, I('#e0804a')); rect(b, x + 3, y - 1, 30, 1, I('#6a2a1c'));
  put(b, x, y - 4, I('#a8462c')); put(b, x + 36, y - 4, I('#a8462c'));
}
const spitTop = x => 157 + 1.6 * Math.sin(x / 41 + 1) + (fbm(x / 8, 21, 2) - 0.5) * 2.4;
function paintSpit(b) {
  const X0 = -MG, X1 = W + MG;
  // surf on the bay side of the spit, peeking over the crest
  for (let x = X0; x < X1; x++) { const y = Math.round(spitTop(x)) - 1; if (hsh(x * 1.3) > 0.25) put(b, x, y, I('#f6fbf8')); if (hsh(x * 2.1) > 0.6) put(b, x, y - 1, I('#d6f0ee')); }
  // back scrub along the crest
  for (let x = X0; x < X1; x += 5) { const r = 2.5 + hsh(x * 0.37) * 4 * (0.4 + fbm(x / 40, 33, 2)); if (fbm(x / 30, 31, 2) > 0.4) scrub(b, x, spitTop(x) - r * 0.4, r, x); }
  // palms, the far ones first
  for (const [x0, y0, hgt, lean, seed, s] of [...PALMS].sort((a, c) => a[2] - c[2])) palm(b, x0, y0, hgt, lean, seed, s);
  // the fishing hut and its nets
  nets(b, 56, 72, 137, 160);
  hut(b, 80, 162);
  // front scrub at the palm feet
  for (const [x0] of PALMS) { scrub(b, x0 - 4, 157, 4, x0 * 3); scrub(b, x0 + 4, 158, 3, x0 * 5); }
  for (let x = X0; x < X1; x += 9) if (fbm(x / 22, 35, 2) > 0.52) scrub(b, x, spitTop(x) + 1, 2.5 + hsh(x) * 2, x * 7);
  // the black-sand beach face down to the lagoon
  for (let x = X0; x < X1; x++) {
    const top = Math.round(spitTop(x)) + 1;
    for (let y = top; y < SWL; y++) {
      const k = (y - top) / Math.max(1, SWL - top);
      let c = k < 0.22 ? I('#5c5254') : k < 0.6 ? I('#413a3d') : I('#302b31');
      if (y >= SWL - 3) c = I('#231f27');
      if (y < SWL - 3 && k > 0.2 && (y + Math.round(Math.sin(x / 9 + y) * 1.3)) % 3 === 0) c = mixI(c, I('#1c191d'), 0.3);   // wind ripples
      const n = h2(x, y, 5);
      if (n > 0.982) c = I('#e2dad0'); else if (n > 0.955) c = mixI(c, I('#8a807a'), 0.45);   // black sand glints
      if (y >= SWL - 3 && h2(x >> 2, y, 6) > 0.55) c = mixI(c, I('#8a92ac'), 0.4);           // wet sand mirrors the sky
      put(b, x, y, c);
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = Math.round(X0 + hsh(i * 4.7 + 2) * (X1 - X0)), y = Math.round(spitTop(x) + 3 + hsh(i * 2.3) * 6);
    if (hsh(i * 9.9) > 0.75) { put(b, x, y, I('#f4ece0')); continue; }   // a shell
    rect(b, x, y, 2, 1, I('#6e6870')); put(b, x, y, I('#9a94a0')); put(b, x + 1, y + 1, I('#1c191d'));
  }
  rect(b, 250, 163, 16, 2, I('#b8a890')); rect(b, 250, 163, 16, 1, I('#e0d4bc')); put(b, 249, 164, I('#8a7a62')); put(b, 262, 162, I('#b8a890')); put(b, 263, 161, I('#b8a890'));
  // turtle tracks up the sand
  for (let y = 159; y < SWL - 1; y++) { const x = 232 + Math.round((y - 159) * 0.6); if (y % 2) { put(b, x - 2, y, I('#1e1b20')); put(b, x + 2, y, I('#1e1b20')); } }
  canoe(b, 136, 166);
  // black lava rocks on the beach
  for (const [rx, ry, r] of [[204, 165, 4], [213, 166, 3], [262, 166, 2.5], [362, 165, 5], [373, 166, 3], [430, 166, 3.5]]) {
    disc(b, rx, ry, r, I('#2a2630')); disc(b, rx - 0.7, ry - 0.8, r - 1, I('#3e3944')); put(b, rx - Math.round(r * 0.5), ry - Math.round(r * 0.6), I('#6e6878'));
  }
  // foam where the lagoon laps the sand
  for (let x = X0; x < X1; x++) {
    put(b, x, SWL, hsh(x * 0.9) > 0.15 ? I('#f4fbf6') : I('#c8eee6'));
    if (Math.sin(x / 13) + hsh(x * 1.7) * 0.8 > 0.6) put(b, x, SWL - 1, I('#e2f6f0'));
    if (Math.sin(x / 9 + 2) > 0.3 && hsh(x * 3.3) > 0.3) put(b, x, SWL + 1, I('#d2f4ec'));
  }
}

// the plume over the crater, drifting right (painted once, lit from the upper left, thinning into the sky)
function plumeCanvas() {
  const b = buf(190, 76, 12, 58), puffs = [];
  for (let i = 0; i < 30; i++) {
    const s = i / 29, x = s * 118 + s * s * 40 + (hsh(i * 1.1) - 0.5) * 4, y = -s * 36 + s * s * 16 - 2 + (hsh(i * 1.3) - 0.5) * 3;
    puffs.push([x, y, 2.4 + s * 9 + hsh(i * 3.7) * 2.2]);
  }
  for (const [x, y, r] of puffs) disc(b, x + 1, y + 1.5, r, I('#a8a1b6'));
  for (const [x, y, r] of puffs) disc(b, x, y, r - 0.6, I('#dcd5da'));
  for (const [x, y, r] of puffs) disc(b, x - r * 0.3, y - r * 0.36, r * 0.55, I('#fff4e4'));
  // warm near the vent, fading into the sky toward the tail
  for (let y = -58; y < 18; y++) for (let x = -12; x < 178; x++) {
    const c = get(b, x, y);
    if (c === NONE) continue;
    let d = mixI(c, I('#f2b898'), 0.4 * (1 - ss(0, 16, x)));
    d = mixI(d, gradCol(SKY, VTOP + y), 0.75 * ss(40, 175, x));
    put(b, x, y, d);
  }
  return sprite(b);
}

// ---------------------------------------------------------------------------------------------------- the pier
const WD = { L: I('#efc88e'), l: I('#cc9a60'), m: I('#a6763f'), d: I('#7c542c'), D: I('#58391f'), DD: I('#3a2614') };
const PILES = [6, 36, 66, 96, 126, 156, 186, 216, 246].map(o => PIER_X + o);
const POSTS = [4, 28, 76, 100, 124, 152, 180, 208, 236].map(o => PIER_X + o);
function pierSprite() {
  const x0 = PIER_X - 8, y0 = 170, b = buf(PIER_W + 14, 70, -x0, -y0);
  // piles: round logs down into the water, weed and barnacles at the water line
  for (const px of PILES) for (let y = 199; y <= WL + 1; y++) for (let k = 0; k < 5; k++) {
    let c = [WD.l, WD.m, WD.m, WD.d, WD.D][k];
    if ((y + px) % 7 === 0 && k > 0 && k < 4) c = WD.d;
    if (y >= WL - 5) c = h2(px + k, y, 2) > 0.5 ? I('#5f8a3a') : I('#3f6a32');
    if (y >= WL - 5 && y < WL - 1 && h2(px + k, y, 3) > 0.8) c = I('#e8e2d0');
    put(b, px + k, y, c);
  }
  // cross braces
  for (let i = 0; i + 1 < PILES.length; i++) {
    const a = PILES[i] + 4, c2 = PILES[i + 1];
    line(b, a, 201, c2, 216, WD.D, 2); line(b, a, 216, c2, 201, WD.d, 2);
    line(b, a, 200, c2, 215, WD.m); line(b, a, 215, c2, 200, WD.m);
  }
  // deck: the side beam with bolts, plank tops catching the sun, joists under it
  rect(b, PIER_X, PIER_Y, PIER_W, 1, WD.L);
  rect(b, PIER_X, PIER_Y + 1, PIER_W, 1, WD.l);
  rect(b, PIER_X, PIER_Y + 2, PIER_W, 4, WD.m);
  for (let x = PIER_X; x < PIER_X + PIER_W; x++) { if ((x - PIER_X) % 9 === 0) rect(b, x, PIER_Y + 2, 1, 4, WD.d); if (h2(x, 1, 7) > 0.8) put(b, x, PIER_Y + 3, WD.l); }
  rect(b, PIER_X, PIER_Y + 6, PIER_W, 1, WD.D);
  for (let x = PIER_X + 2; x < PIER_X + PIER_W; x += 7) rect(b, x, PIER_Y + 7, 3, 2, WD.DD);
  for (let x = PIER_X + 5; x < PIER_X + PIER_W; x += 15) { put(b, x, PIER_Y + 4, WD.DD); put(b, x - 1, PIER_Y + 3, WD.L); }
  // railing posts and two sagging ropes
  for (const px of POSTS) { rect(b, px, PIER_Y - 12, 3, 12, WD.m); rect(b, px, PIER_Y - 12, 1, 12, WD.l); rect(b, px + 2, PIER_Y - 12, 1, 12, WD.d); rect(b, px - 1, PIER_Y - 13, 5, 2, WD.L); put(b, px + 3, PIER_Y - 12, WD.d); }
  for (let i = 0; i + 1 < POSTS.length; i++) {
    const a = POSTS[i] + 3, c2 = POSTS[i + 1], n = c2 - a;
    for (let k = 0; k < n; k++) {
      const u = k / n, s1 = Math.round(Math.sin(u * Math.PI) * 3), s2 = Math.round(Math.sin(u * Math.PI) * 2);
      put(b, a + k, PIER_Y - 10 + s1, I('#e4d4a8')); put(b, a + k, PIER_Y - 9 + s1, I('#9c8a62'));
      put(b, a + k, PIER_Y - 5 + s2, I('#e4d4a8'));
    }
  }
  // a coil of rope, a bucket, a life ring on the rail, a lantern on the first post
  for (let k = 0; k < 3; k++) oval(b, PIER_X + 14, PIER_Y - 2 - k, 5 - k, 1, k % 2 ? I('#c8b47e') : I('#e4d4a8'));
  rect(b, PIER_X + 86, PIER_Y - 6, 6, 6, I('#4f7fb4')); rect(b, PIER_X + 86, PIER_Y - 6, 6, 1, I('#8ab4e0')); rect(b, PIER_X + 91, PIER_Y - 5, 1, 5, I('#2f5a8a'));
  const lx = PIER_X + 116, ly = PIER_Y - 8;
  for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2, X = Math.round(lx + Math.cos(t) * 4.5), Y = Math.round(ly + Math.sin(t) * 4.5); put(b, X, Y, ((a >> 3) & 1) ? I('#f4f0ea') : I('#e0392c')); }
  for (let a = 0; a < 48; a++) { const t = a / 48 * Math.PI * 2, X = Math.round(lx + Math.cos(t) * 3.5), Y = Math.round(ly + Math.sin(t) * 3.5); put(b, X, Y, ((a * 4 / 3) >> 3) & 1 ? I('#d8d0c4') : I('#b02a22')); }
  const tx = POSTS[0] + 1;
  rect(b, tx - 2, PIER_Y - 22, 5, 7, I('#2a2a30')); rect(b, tx - 1, PIER_Y - 21, 3, 5, I('#ffd36a')); put(b, tx - 1, PIER_Y - 21, I('#fff4c0')); rect(b, tx - 1, PIER_Y - 24, 3, 2, I('#2a2a30'));
  outline(b);
  // the submerged parts are drawn live (through the water)
  return sprite(b);
}

// ---------------------------------------------------------------------------------------------------- the robot shark
// Shapes in local coordinates: facing right, nose at +u, v down; the sprite is rasterized per pixel at any angle, so
// the 1px outline and the 3-tone shading stay crisp (lit from the upper left in screen space)
const SHK = {
  body: [[38, 0], [36, -4], [31, -8.5], [24, -11.5], [15, -13.5], [5, -14], [-5, -13], [-15, -10.2], [-24, -6.8], [-31, -4], [-35, -3], [-35, 2.4], [-29, 4], [-20, 7], [-10, 9.6], [0, 11], [9, 10.8], [16, 9.4], [22, 7.5], [28, 5.6], [33, 3.8], [37, 2]],
  dorsal: [[9, -13.8], [3, -20], [-2, -26], [-6, -29.5], [-9.5, -28.5], [-9, -21], [-12, -11.5]],
  dors2: [[-22, -7.5], [-25.5, -12], [-28, -12], [-28, -6]],
  anal: [[-19, 7.6], [-23, 12.5], [-26, 12], [-25, 6]],
  pelv: [[-8, 9.5], [-11, 14], [-14, 13.5], [-13, 9]],
  tailU: [[-32, -3.8], [-37, -10], [-42, -17], [-47, -22], [-50, -21.5], [-47.5, -14], [-43, -5], [-40, 0.5]],
  tailL: [[-35, 0.5], [-40, 5], [-45, 10.5], [-43, 12], [-37, 7.5], [-33, 2.4]],
  pect: [[15, 8.5], [10, 14], [4, 20.5], [0, 22.5], [-0.5, 19], [2, 13], [7, 8.8]],
  brow: [[15.5, -9.4], [28, -10.4], [28.5, -8], [16.5, -6.7]],
  eye: [22, -4.6], hinge: [12, 6.5], snout: [36.5, 2.6], beacon: [-7, -29]
};
const SPAL = {
  1: [I('#a8b4c3'), I('#76828f'), I('#535d6b'), I('#8e9aaa'), I('#626d7c')], 2: [I('#ffffff'), I('#e4eaf0'), I('#b0bbc7')], 3: [I('#8995a4'), I('#5f6a77'), I('#424b56')],
  4: [I('#dde5ee'), I('#afbac7'), I('#7b8794')], 6: [I('#a2aebd'), I('#6e7a88'), I('#4c5664')], 7: [I('#ffffff'), I('#e8eef3'), I('#a8b4c1')],
  8: [I('#5c6674'), I('#404853'), I('#2c3139')], 10: [I('#8f9bab'), I('#64707d'), I('#454e59')], 11: [I('#8995a4'), I('#5f6a77'), I('#424b56')]
};
const rotPts = (P, cx, cy, a) => P.map(([x, y]) => { const dx = x - cx, dy = y - cy; return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]; });
// ang: nose down (rad), jaw: opening (rad), f: facing, cut: local v of the water line (a fin cruising: only the dorsal fin
// stays above it, everything under it becomes a flat dark shape seen through the water)
function sharkSprite(ang, jaw, f, cut) {
  const S = 136, C = 68, ca = Math.cos(ang), sa = Math.sin(ang), open = jaw > 0.05;
  const bend = u => u < -6 ? -0.0034 * (u + 6) * (u + 6) : 0;
  const H0 = SHK.hinge, T0 = SHK.snout;
  const JAW = rotPts([[12, 6.5], [35.5, 3.2], [35, 5.6], [30, 8.4], [22, 10.4], [13, 11.2]], H0[0], H0[1], jaw), J1 = JAW[1];
  const MOUTH = [H0, T0, J1];
  const teeth = [];
  const row = (A, B, s0, ds, hw, ht, up) => {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), d = [dx / L, dy / L], n = up ? [d[1], -d[0]] : [-d[1], d[0]];
    for (let s = s0; s < 0.97; s += ds) { const c = [A[0] + dx * s, A[1] + dy * s]; teeth.push([[c[0] - d[0] * hw, c[1] - d[1] * hw], [c[0] + d[0] * hw, c[1] + d[1] * hw], [c[0] + n[0] * ht, c[1] + n[1] * ht]]); }
  };
  if (open) { row(H0, T0, 0.27, 0.165, 1.45, 4.8, false); row(H0, J1, 0.34, 0.19, 1.45, 4.3, true); }
  const vUJ = u => lerp(H0[1], T0[1], (u - H0[0]) / (T0[0] - H0[0]));
  const vB = u => 3 - 0.0026 * (u - 4) * (u - 4);
  const mat = new Uint8Array(S * S), LU = new Float32Array(S * S), LV2 = new Float32Array(S * S);
  const M = (X, Y) => X < 0 || Y < 0 || X >= S || Y >= S ? 0 : mat[Y * S + X];
  for (let Y = 0; Y < S; Y++) for (let X = 0; X < S; X++) {
    const x0 = (X + 0.5 - C) * f, y0 = Y + 0.5 - C;
    const u = x0 * ca + y0 * sa, v = -x0 * sa + y0 * ca - bend(u);
    let m = 0;
    if (open && u > 9 && u < 40 && v > -2 && v < 22 && teeth.some(t => inPoly(t, u, v))) m = 7;
    else if (open && inPoly(MOUTH, u, v)) m = 5;
    else if (inPoly(JAW, u, v)) m = open ? 6 : 2;
    else if (inPoly(SHK.pect, u, v)) m = 10;
    else if (inPoly(SHK.brow, u, v)) m = 8;
    else if (inPoly(SHK.body, u, v) && !(open && u > H0[0] && v > vUJ(u))) m = u > 30 && v < vUJ(Math.min(u, 36)) + 0.5 ? 4 : v > vB(u) ? 2 : 1;
    else if (inPoly(SHK.dorsal, u, v) || inPoly(SHK.dors2, u, v) || inPoly(SHK.anal, u, v) || inPoly(SHK.pelv, u, v)) m = 3;
    else if (inPoly(SHK.tailU, u, v) || inPoly(SHK.tailL, u, v)) m = 11;
    mat[Y * S + X] = m; LU[Y * S + X] = u; LV2[Y * S + X] = v;
  }
  const toPix = (u, v) => { const vv = v + bend(u); return [Math.floor(C + f * (u * ca - vv * sa)), Math.floor(C + u * sa + vv * ca)]; };
  const b = buf(S, S, 0, 0);
  // base colours with 3-tone shading per part (light on top and left edges, dark on bottom and right edges)
  for (let Y = 0; Y < S; Y++) for (let X = 0; X < S; X++) {
    const m = M(X, Y);
    if (!m) continue;
    if (m === 5) {
      const u = LU[Y * S + X], v = LV2[Y * S + X], d = Math.hypot(u - H0[0], v - H0[1]) / Math.hypot(T0[0] - H0[0], T0[1] - H0[1]);
      put(b, X, Y, d < 0.2 ? I('#fff6c4') : d < 0.33 ? I('#ffc040') : d < 0.46 ? I('#f06a20') : d < 0.62 ? I('#a82418') : I('#5a1012'));
      continue;
    }
    const P = SPAL[m];
    let tone = 1;
    if (M(X, Y - 1) !== m || M(X - 1, Y) !== m) tone = 0;
    else if (M(X, Y + 1) !== m || M(X + 1, Y) !== m) tone = 2;
    if (m === 1 && tone === 1) {
      // the back is a rounded hull: lighter under the lit edge, darker toward the belly seam
      let k = 0, j = 0;
      while (k < 4 && M(X, Y - k - 1) === 1) k++;
      while (j < 4 && M(X, Y + j + 1) === 1) j++;
      tone = j <= 1 ? 2 : j === 2 ? 4 : k <= 2 ? 3 : 1;
    }
    // the low morning sun warms the top and left edges
    put(b, X, Y, tone === 0 && (m === 1 || m === 3 || m === 11) && cut == null ? mixI(P[0], I('#ffd8b0'), 0.4) : P[tone]);
  }
  // wet-metal shine along the back, two pixels under the lit edge
  for (let X = 0; X < S; X++) {
    let Y0 = -1;
    for (let Y = 0; Y < S; Y++) if (M(X, Y) === 1) { Y0 = Y; break; }
    if (Y0 < 0) continue;
    const u = LU[Y0 * S + X];
    if (u > -20 && u < 26 && M(X, Y0 + 2) === 1) put(b, X, Y0 + 2, (X & 1) || u > 18 ? I('#c6d0db') : I('#a9b5c3'));
  }
  // panel seams and rivets
  const seam = (u0, v0, u1, v1) => {
    const n = Math.ceil(Math.hypot(u1 - u0, v1 - v0) * 2.5);
    for (let i = 0; i <= n; i++) {
      const [X, Y] = toPix(lerp(u0, u1, i / n), lerp(v0, v1, i / n)), m = M(X, Y);
      if (m === 1) put(b, X, Y, I('#363d48')); else if (m === 2) put(b, X, Y, I('#9aa6b3')); else if (m === 4) put(b, X, Y, I('#6c7886'));
    }
  };
  const rivet = (u, v) => { const [X, Y] = toPix(u, v), m = M(X, Y); if (m === 1 || m === 2 || m === 4 || m === 6) { put(b, X, Y, I('#eef3f7')); if (M(X, Y + 1) === m) put(b, X, Y + 1, m === 2 ? I('#8f9bab') : I('#2f3640')); } };
  seam(11, -13.6, 11.6, 6.4); seam(-14, -10.6, -12.5, 9.2); seam(30.5, -8, 30.8, vUJ(30.6));
  for (let u = -30; u <= 11; u += 0.5) { const [X, Y] = toPix(u, vB(u) - 0.6); if (M(X, Y) === 1) put(b, X, Y, I('#363d48')); }
  for (const v of [-11, -7, -3, 1, 5]) rivet(9.8, v);
  for (const v of [-8, -4, 0, 4, 8]) rivet(-15.2, v);
  for (let u = -27; u <= 9; u += 6) rivet(u, vB(u) + 1.6);
  rivet(33, -3.5); rivet(34.5, -0.5);
  // gill vents
  for (const [ua, va, ub, vb] of [[8.2, -4.5, 6.6, 4.6], [4.6, -4.5, 3, 5], [1, -4.2, -0.6, 5.2]]) {
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const [X, Y] = toPix(lerp(ua, ub, i / n), lerp(va, vb, i / n)), m = M(X, Y);
      if (m !== 1 && m !== 2) continue;
      put(b, X, Y, I('#1f232a'));
      if (M(X - 1, Y) === m && get(b, X - 1, Y) !== I('#1f232a')) put(b, X - 1, Y, m === 1 ? I('#a6b2c1') : I('#ffffff'));
    }
  }
  if (open) { const [X, Y] = toPix(H0[0] + 1.5, H0[1] + 1.5); if (M(X, Y)) { put(b, X, Y, I('#2c3139')); put(b, X - 1, Y - 1, I('#eef3f7')); } }
  // the eye: a round red lens in a dark socket, a glint
  const [ex, ey] = toPix(SHK.eye[0], SHK.eye[1]);
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
    const d2 = i * i + j * j;
    if (d2 <= 11.6 && M(ex + i, ey + j)) put(b, ex + i, ey + j, d2 <= 5.5 ? (d2 <= 1.5 ? I('#ff9a8a') : I('#ff3b30')) : I('#1f232a'));
  }
  put(b, ex - 1, ey - 1, I('#ffffff')); put(b, ex, ey - 1, I('#ffd0cc')); put(b, ex - 1, ey, I('#ffd0cc'));
  // internal outlines: round the pectoral fin, the lower jaw and the mouth
  const add = [];
  for (let Y = 0; Y < S; Y++) for (let X = 0; X < S; X++) {
    const m = M(X, Y);
    if (m !== 1 && m !== 2 && m !== 4) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = M(X + dx, Y + dy); if (n === 10 || n === 6 || n === 5) { add.push([X, Y]); break; } }
  }
  for (const [X, Y] of add) put(b, X, Y, OUTI);
  // under the water: everything below the cut becomes a flat shadow sprite, and only the dorsal fin stays up
  let shadow = null;
  if (cut != null) {
    const sb = buf(S, S, 0, 0), cy = Math.floor(C + cut);
    for (let Y = 0; Y < S; Y++) for (let X = 0; X < S; X++) {
      if (!M(X, Y)) continue;
      if (Y >= cy) { put(sb, X, Y, I('#0b4a5e')); b.d[Y * S + X] = NONE; }
      else if (M(X, Y) === 11) b.d[Y * S + X] = NONE;
    }
    shadow = sprite(Object.assign(sb, { ox: C, oy: C }));
  }
  outline(b);
  const s = sprite(Object.assign(b, { ox: C, oy: C }));
  s.shadow = shadow;
  s.eye = [ex - C, ey - C];
  const [bx, by] = toPix(SHK.beacon[0], SHK.beacon[1]); s.beacon = [bx - C, by - C];
  const [mx, my] = toPix(lerp(H0[0], T0[0], 0.45), (H0[1] + J1[1]) / 2 + 2); s.mouth = [mx - C, my - C];
  const [tx, ty] = toPix(-38, -1); s.tail = [tx - C, ty - C];
  return s;
}

// ---------------------------------------------------------------------------------------------------- sea turtle + cage
// (art director: a green shell with yellow-lit scutes and paler skin, so the turtle separates from the wooden pier
//  and the grey cage bars at a glance)
const TPAL = { k: OUT, g: '#4f8a3c', G: '#86c255', h: '#2f5a2a', H: '#24401e', l: '#b4d96a', m: '#e8d26c', M: '#a88f3a',
  s: '#a9c79a', S: '#d9ecc8', d: '#6f9a66', D: '#46683f', c: '#f2e6b4', w: '#ffffff', e: '#1a1a26', p: '#f4978e' };
function turtleSprite() {
  const g = [], Wd = 32, Ht = 20;
  for (let y = 0; y < Ht; y++) g.push(new Array(Wd).fill('.'));
  const P = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < Wd && y < Ht) g[y][x] = c; };
  const E = (cx, cy, rx, ry, c, yMax = 99) => { for (let y = Math.floor(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx) - 1; x <= cx + rx + 1; x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1.04 && y <= yMax) P(x, y, c); } };
  // flippers, neck and a round head (facing right; drawn mirrored, looking at the hero)
  E(4, 15, 3.4, 1.7, 's');
  for (let i = 0; i < 10; i++) for (let j = -1.2; j <= 1.21; j += 0.6) P(19 + i * 0.9, 13.6 + i * 0.42 + j * (1 - i / 13), i > 7 ? 'd' : 's');
  E(22, 11, 2.6, 2.4, 's'); E(26.2, 8.6, 3.9, 3.4, 's');
  // the shell: a high dome, a yellow rim, a cream belly plate
  E(13, 10.5, 11.5, 8, 'g', 12);
  for (let x = 3; x <= 23; x++) { P(x, 12, 'm'); P(x, 13, 'c'); }
  P(2, 12, 'M'); P(24, 12, 'M');
  // scutes: big plates on top, smaller ones on the side, dark seams between them
  for (const [cx, cy] of [[8.5, 6], [13, 4.5], [17.5, 6]]) E(cx, cy, 2.3, 1.6, 'G');
  for (const [cx, cy] of [[5.5, 9.6], [10.5, 9.2], [15.5, 9.2], [20.5, 10]]) E(cx, cy, 1.8, 1.1, 'l');
  for (const x of [8, 13, 18]) { P(x, 8, 'h'); P(x, 9, 'h'); P(x, 10, 'h'); P(x, 11, 'h'); }
  for (let x = 4; x <= 22; x++) if (g[7][x] === 'g') P(x, 7, 'h');
  // face: a big worried eye with a glint, rosy cheek, a small beak
  P(26, 6, 'w'); P(27, 6, 'w'); P(26, 7, 'w'); P(27, 7, 'e'); P(28, 7, 'e'); P(28, 6, 'w'); P(26, 5, 'e'); P(27, 5, 'e'); P(28, 5, 'e');
  P(25, 9, 'p'); P(29, 10, 'D'); P(28, 10, 'D'); P(30, 9, 'S');
  for (const [x, y] of [[21, 10], [23, 12], [20, 14], [3, 15], [24, 7], [5, 14]]) P(x, y, 'd');
  // shading: light on top, dark below
  const s = g.map(r => r.slice()), at = (x, y) => x >= 0 && y >= 0 && x < Wd && y < Ht ? s[y][x] : '.';
  for (let y = 0; y < Ht; y++) for (let x = 0; x < Wd; x++) {
    if (s[y][x] === 'g' && at(x, y - 1) === '.') g[y][x] = 'G';
    else if (s[y][x] === 's' && at(x, y - 1) === '.') g[y][x] = 'S';
    else if (s[y][x] === 's' && at(x, y + 1) === '.') g[y][x] = 'd';
  }
  const o = g.map(r => r.slice());
  for (let y = 0; y < Ht; y++) for (let x = 0; x < Wd; x++) if (o[y][x] === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = (o[y + dy] || [])[x + dx]; return c && c !== '.'; })) g[y][x] = 'k';
  return makeSprite(g.map(r => r.join('')), TPAL);
}
const CW = 36, CH = 23;
function cageBack() {
  const x0 = -(CW >> 1), top = -CH, n = 4;
  ctx.globalAlpha = 0.55;
  R(x0 + 2, top + 4, CW - 4, 1, METD);
  for (let i = 0; i <= n; i++) R(x0 + Math.round((i + 0.5) * CW / (n + 1)), top + 4, 1, CH - 8, METD);
  ctx.globalAlpha = 1;
}
function cageFront(o) {
  const x0 = -(CW >> 1), x1 = x0 + CW, top = -CH, bh = CH - 6, n = 4;
  for (let i = 1; i <= n; i++) { const x = x0 + Math.round(i * CW / (n + 1)) - 1; R(x, top + 3, 1, bh, OUT); R(x + 1, top + 3, 1, bh, METL); R(x + 1, top + bh, 1, 3, MET); }
  for (const px of [x0, x1 - 2]) { RO(px, top + 2, 2, bh + 1, MET); R(px, top + 2, 1, bh + 1, METL); }
  RO(x0 - 1, top, CW + 2, 3, METD); R(x0 - 1, top, CW + 2, 1, METL);
  for (let x = x0 + 2; x < x1 - 1; x += 5) R(x, top + 1, 1, 1, METDD);
  RO(x0 - 1, -4, CW + 2, 4, METDD);
  for (let r = 0; r < 3; r++) for (let x = x0 - 1 + ((r + 4) & 3); x < x1 + 1; x += 4) R(x, -3 + r, Math.min(2, x1 + 1 - x), 1, '#f1c40f');
  R(x0 - 1, -4, CW + 2, 1, '#6a737e');
  const on = Math.floor((o.t + 6) / 8) % 2 === 0;
  blob([[-4, top - 4, 8, 4], [-3, top - 5, 6, 1]], METD); R(-3, top - 4, 6, 1, METL); R(-4, top - 1, 8, 1, METDD);
  RO(-2, top - 3, 4, 2, '#2a0c0c'); R(-2, top - 3, 2, 2, on ? EVIL : '#7a1f1f'); if (on) R(-2, top - 3, 1, 1, '#ffd0cc');
  R(0, top - 8, 1, 3, METDD); R(0, top - 9, 1, 1, on ? EVIL : '#5a1a1a');
}
function helpBubble(by) {
  RO(-16, by, 33, 11, '#ffffff'); R(-16, by + 10, 33, 1, '#d8dce6');
  R(-2, by + 11, 5, 1, '#ffffff'); R(-1, by + 12, 3, 1, '#ffffff'); R(0, by + 13, 1, 1, '#ffffff');
  R(-3, by + 11, 1, 1, OUT); R(3, by + 11, 1, 1, OUT); R(-2, by + 12, 1, 1, OUT); R(2, by + 12, 1, 1, OUT); R(-1, by + 13, 1, 1, OUT); R(1, by + 13, 1, 1, OUT); R(0, by + 14, 1, 1, OUT);
  text('HELP!', 1, by + 2, '#e0302a', 1, 'center', null);
}

// ---------------------------------------------------------------------------------------------------- the jet-ski
const JP = {
  r: I('#d8392b'), R: I('#ff6d4d'), q: I('#a2251e'), Q: I('#6c1714'),
  p: I('#8f9aa7'), P: I('#cbd3dc'), o: I('#5e6773'), v: I('#363d47'), V: I('#f2f6f9'),
  b: I('#24242c'), B: I('#4a4a58'), n: I('#3b2f2b'), N: I('#62504a'),
  g: I('#2f6f98'), G: I('#bfeaff'), w: I('#ffffff'),
  s: I('#7c8794'), S: I('#c6ced8'), d: I('#464d58'), m: I('#23252b'),
  j: I('#fff1c9'), y: I('#ffd23f'), Y: I('#fff3b0'), l: I('#fff6c2'), L: I('#ffb52e'), h: I('#2f3640')
};
function jetskiSprite() {
  const b = buf(88, 56, 44, 46), P = JP;
  // hull: red sides, a white boot stripe, a dark bottom, a pointed bow
  const HULL = [[-30, -8], [22, -8], [27, -9], [31, -10.5], [35.5, -12.6], [34.6, -10], [31, -6.5], [26, -3], [20, -0.5], [12, 2], [4, 3], [-30, 3]];
  poly(b, HULL, P.r);
  for (let y = -2; y <= 4; y++) for (let x = -31; x <= 36; x++) if (get(b, x, y) === P.r) put(b, x, y, y === -2 ? P.V : P.h);
  for (let x = -30; x <= 35; x++) { if (get(b, x, -7) === P.r) put(b, x, -7, P.R); if (get(b, x, -3) === P.r) put(b, x, -3, P.q); }
  for (let x = -29; x <= 23; x++) put(b, x, -5, P.j);
  // lightning bolt decal on the side
  poly(b, [[-21, -7.6], [-13.5, -7.6], [-16.5, -5.4], [-11.6, -5.4], [-19.6, -1.4], [-17.2, -4.2], [-22, -4.2]], P.y);
  for (let x = -22; x <= -12; x++) if (get(b, x, -7) === P.y) put(b, x, -7, P.Y);
  // riveted armour plate on the bow
  rect(b, 7, -7, 14, 4, P.p); rect(b, 7, -7, 14, 1, P.P); rect(b, 7, -4, 14, 1, P.o); rect(b, 20, -7, 1, 4, P.o);
  for (const [x, y] of [[9, -6], [18, -6], [9, -5], [18, -5]]) put(b, x, y, P.v);
  put(b, 8, -7, P.V); put(b, 17, -7, P.V);
  // rub rail: black rubber, rising along the bow
  for (let x = -30; x <= 22; x++) { put(b, x, -9, P.B); put(b, x, -8, P.b); }
  line(b, 22, -9, 35, -13, P.b);
  // rear deck, grab handle
  rect(b, -30, -11, 8, 2, P.r); rect(b, -30, -11, 8, 1, P.R);
  rect(b, -28, -14, 5, 1, P.s); put(b, -28, -13, P.d); put(b, -24, -13, P.d); put(b, -28, -14, P.S);
  // the saddle: long and padded, a bolster at the back, stitching
  poly(b, [[-23, -9], [-23.5, -11], [-22.5, -13], [-20.5, -13.6], [-18.5, -12.6], [-8, -12.2], [-4, -12.2], [-2.5, -11], [-2.5, -9]], P.n);
  for (let x = -22; x <= -3; x++) { for (let y = -15; y < -9; y++) if (get(b, x, y) === P.n) { put(b, x, y, P.N); break; } }
  for (let x = -20; x <= -5; x += 3) put(b, x, -10, P.N);
  // the console pod in front of the rider, a tinted windscreen on it
  poly(b, [[-3, -9], [-3, -15], [-1, -18.6], [4, -19.8], [7.5, -17.6], [8, -9]], P.d);
  for (let x = -2; x <= 7; x++) { for (let y = -21; y < -9; y++) if (get(b, x, y) === P.d) { put(b, x, y, P.s); break; } }
  put(b, 2, -15, I('#66ff88')); put(b, 4, -15, P.L);
  poly(b, [[0.5, -19.5], [3, -25], [7.5, -25.5], [8.5, -21], [5.5, -19.6]], P.g);
  line(b, 3.6, -24.4, 7, -24.8, P.G); put(b, 3, -23, P.G); put(b, 6, -21, I('#5a9ac0'));
  // the hood sloping down to the bow: highlights, cooling vents, a headlamp
  poly(b, [[6.5, -9], [6.5, -17.4], [12, -17.6], [18, -16.2], [24, -14.4], [30, -12.6], [35, -12.6], [31, -10.6], [27, -9.4], [22, -8.6]], P.r);
  for (let x = 7; x <= 35; x++) { let k = 0; for (let y = -19; y <= -8; y++) if (get(b, x, y) === P.r) { if (k < 2) put(b, x, y, k ? P.R : I('#ff9a7a')); k++; } }
  for (let x = 7; x <= 34; x++) if (get(b, x, -9) === P.r) put(b, x, -9, P.q);
  for (const vx of [12, 16]) { rect(b, vx, -14, 3, 1, P.Q); rect(b, vx, -13, 3, 1, P.q); }
  disc(b, 31, -11.4, 1.2, P.L); put(b, 31, -12, P.l); put(b, 30, -12, P.w);
  // handlebar: from the pod back to the rider's hands
  line(b, 1, -19, -2, -18, P.d); rect(b, -9, -18, 8, 1, P.m); rect(b, -9, -18, 2, 1, P.S); put(b, -9, -19, P.m);
  // stern: the jet nozzle
  rect(b, -33, -4, 3, 3, P.s); put(b, -33, -4, P.S); rect(b, -33, -2, 3, 1, P.d);
  // whip antenna with a pennant streaming back
  line(b, -27, -11, -30, -36, P.d);
  poly(b, [[-30, -36], [-41, -33.6], [-30, -31.2]], P.y); line(b, -30, -33.6, -38, -33.6, P.L);
  outline(b);
  return sprite(b);
}
// the nose gun on its ball mount (local origin = the mount), aimed GUN_A up from forward
function bar(b, a, t0, t1, s0, s1, c) {
  const ca = Math.cos(a), sa = Math.sin(a);
  for (let t = t0; t <= t1 + 1e-6; t += 0.25) for (let s = s0; s <= s1 + 1e-6; s += 0.25) put(b, t * ca + s * sa, -t * sa + s * ca, c);
}
function gunSprite(a) {
  const b = buf(26, 26, 6, 19), P = JP;
  bar(b, a, -2, 3, -2, 2, P.o);
  bar(b, a, 2, 10, -1.4, 1.4, P.d); bar(b, a, 2, 10, -1.4, -0.9, P.s);
  for (const h of [4, 6, 8]) bar(b, a, h, h + 0.5, -0.6, 0.4, P.m);
  bar(b, a, 10, 13, -1.2, 1.2, P.m); bar(b, a, 10, 13, -1.2, -0.8, P.d);
  outline(b);
  disc(b, 0, 0, 2, P.p); put(b, -1, -1, P.P); put(b, 1, 1, P.o);
  return sprite(b);
}
function flashSprite(a) {
  const b = buf(30, 30, 15, 15);
  bar(b, a, 0, 9, -1.1, 1.1, I('#ffd23f')); bar(b, a, 0, 6, -0.5, 0.5, I('#fff3b0'));
  bar(b, a + 0.9, 0, 4.5, -0.5, 0.5, I('#ffd23f')); bar(b, a - 0.9, 0, 4.5, -0.5, 0.5, I('#ffd23f'));
  disc(b, 0, 0, 2.4, I('#ffb52e')); disc(b, 0, 0, 1.5, I('#fff3b0')); put(b, 0, 0, I('#ffffff'));
  return sprite(b);
}
function iconSprite() {
  const b = buf(28, 16, 1, 1), P = JP;
  poly(b, [[0, 8], [19, 8], [23, 6], [26, 4.5], [24, 9], [20, 11], [1, 11]], P.r);
  rect(b, 1, 10, 20, 1, P.h); rect(b, 1, 9, 19, 1, P.j);
  rect(b, 4, 6, 7, 2, P.n); rect(b, 4, 6, 7, 1, P.N);
  poly(b, [[11, 8], [12, 6], [15, 5], [20, 5.5], [24, 7], [24, 8]], P.R);
  rect(b, 14, 3, 2, 2, P.g); rect(b, 10, 3, 1, 4, P.d); rect(b, 8, 3, 3, 1, P.m);
  line(b, 23, 5, 26, 2, P.d);
  outline(b);
  return sprite(Object.assign(b, { ox: 0, oy: 0 }));
}
function torpSprite() {
  const b = buf(14, 8, 1, 1), P = JP;
  rect(b, 2, 2, 8, 3, P.p); rect(b, 2, 2, 8, 1, P.P); rect(b, 2, 4, 8, 1, P.o); rect(b, 10, 2, 2, 3, P.r); put(b, 12, 3, P.r); put(b, 10, 2, P.R);
  rect(b, 0, 1, 2, 5, P.d); put(b, 0, 3, P.s);
  outline(b);
  return sprite(Object.assign(b, { ox: 0, oy: 0 }));
}

// ---------------------------------------------------------------------------------------------------- foreground
// a black lava rock in the bottom-left corner with a crab on it, a striped marker buoy on the right (screen space)
function rockSprite() {
  const b = buf(70, 40, 6, -232);
  const lumps = [[4, 260, 15, 13], [22, 254, 11, 10], [36, 262, 10, 8], [-4, 250, 9, 11], [48, 266, 8, 5]];
  for (const [cx, cy, rx, ry] of lumps) oval(b, cx, cy, rx, ry, I('#3e3d4c'));
  // light from the upper left: lit tops, dark undersides, wet sheen, holes in the lava, weed and barnacles low down
  const T = I('#3e3d4c');
  for (let y = 232; y < 272; y++) for (let x = -6; x < 64; x++) {
    if (get(b, x, y) !== T) continue;
    const up = get(b, x, y - 1) === NONE, up2 = get(b, x, y - 2) === NONE, lf = get(b, x - 1, y) === NONE, dn = get(b, x, y + 2) === NONE, rt = get(b, x + 1, y) === NONE;
    let c = T;
    if (up) c = I('#8a9ab8'); else if (up2 || lf) c = I('#5d6176'); else if (dn || rt) c = I('#2a2a36');
    const n = h2(x, y, 21);
    if (!up && n > 0.9) c = I('#1c1c26'); else if (!up && n > 0.84) c = I('#6a6e84');
    if (y > 262 && h2(x >> 1, y, 22) > 0.45) c = h2(x, y, 23) > 0.5 ? I('#4f7a3a') : I('#3a5e30');
    if (y > 258 && y < 263 && n < 0.06) c = I('#e8e2d0');
    put(b, x, y, c);
  }
  // a little red crab on the top, claws up
  const cx = 22, cy = 243;
  rect(b, cx - 3, cy, 7, 3, I('#e0452c')); rect(b, cx - 3, cy, 7, 1, I('#ff7a52')); rect(b, cx - 2, cy + 3, 1, 1, I('#a82a1c')); rect(b, cx + 2, cy + 3, 1, 1, I('#a82a1c'));
  rect(b, cx - 6, cy - 2, 2, 2, I('#e0452c')); rect(b, cx + 5, cy - 2, 2, 2, I('#e0452c')); put(b, cx - 5, cy, I('#e0452c')); put(b, cx + 5, cy, I('#e0452c'));
  put(b, cx - 1, cy - 2, I('#ffffff')); put(b, cx + 1, cy - 2, I('#ffffff')); put(b, cx - 1, cy - 1, I('#e0452c')); put(b, cx + 1, cy - 1, I('#e0452c'));
  outline(b);
  put(b, cx - 1, cy - 2, I('#ffffff')); put(b, cx + 1, cy - 2, I('#ffffff'));
  return sprite(b);
}
function buoySprite() {
  const b = buf(16, 34, 8, 30);
  // a striped steel marker buoy: a lamp cage on top, red and white bands, a heavy dark base
  rect(b, -4, -16, 9, 14, I('#e0392c'));
  for (const y of [-12, -6]) rect(b, -4, y, 9, 3, I('#f4f0ea'));
  rect(b, -4, -16, 2, 14, I('#ff7a5a')); for (const y of [-12, -6]) rect(b, -4, y, 2, 3, I('#ffffff'));
  rect(b, 3, -16, 2, 14, I('#a8261c')); for (const y of [-12, -6]) rect(b, 3, y, 2, 3, I('#c8c0b8'));
  rect(b, -5, -2, 11, 3, I('#3a3a48')); rect(b, -5, -2, 11, 1, I('#5a5a6a'));
  rect(b, -2, -24, 5, 8, I('#56606e')); rect(b, -1, -23, 3, 5, I('#ffd36a')); put(b, -1, -23, I('#fff4c0'));
  rect(b, -3, -25, 7, 1, I('#3b424d')); rect(b, 0, -28, 1, 3, I('#3b424d'));
  outline(b);
  return sprite(b);
}
function drawFront() {
  const A = art(), t = G.t;
  blit(A.rock, 0, 0);
  for (let i = 0; i < 46; i++) { const x = -4 + i * 1.2, n = h2(i, t >> 3, 31); if (n < 0.3) continue; ctx.fillStyle = n > 0.7 ? '#ffffff' : '#c6f3f1'; ctx.fillRect(Math.round(x), 266 + Math.round(Math.sin(i * 0.7 + t * 0.08)), 1, 1); }
  const by = 258 + Math.round(Math.sin(t * 0.06) * 1.2), bx = 452;
  ctx.globalAlpha = 0.3; R(bx - 6, by + 1, 13, 8, '#0b4a5e'); ctx.globalAlpha = 1;
  blit(A.buoy, bx, by);
  foam(bx, by, 9, 77);
  if (t % 70 < 40) { ctx.fillStyle = 'rgba(255,214,110,0.35)'; ctx.fillRect(bx - 4, by - 27, 9, 9); }
}

// ---------------------------------------------------------------------------------------------------- building (once)
let ART = null;
function art() {
  if (ART) return ART;
  const far = strip(36, HZ + 2, 0.02, paintFar);
  ART = {
    sky: skyCanvas(), sun: sunCanvas(), rays: rayCanvas(1),
    clouds: CLOUDS.map(([w], i) => cloudCanvas(w, i + 1, CLOUD_PAL, -1)),
    far, bay: strip(HZ, 174, 0.06, b => paintBay(b, far.b)),
    lagoon: strip(164, H, 0.3, paintLagoon), spit: strip(34, 172, 0.18, paintSpit),
    plume: plumeCanvas(), pier: pierSprite(),
    leap: sharkSprite(0.36, 0.62, -1, null),
    finL: sharkSprite(0, 0, -1, -13), finR: sharkSprite(0, 0, 1, -13),
    turtle: turtleSprite(), jet: jetskiSprite(), gun: gunSprite(GUN_A), flash: flashSprite(GUN_A),
    icon: iconSprite(), torp: torpSprite(), rock: rockSprite(), buoy: buoySprite()
  };
  return ART;
}

// ---------------------------------------------------------------------------------------------------- live scenery
function glitter(x0, y0, y1, n, sp0, sp1, seed) {
  for (let i = 0; i < n; i++) {
    const cyc = 9 + (i % 7), ph = Math.floor((G.t + i * 5) / cyc), life = (G.t + i * 5) % cyc;
    if (life > cyc - 3) continue;
    const k = Math.pow(hsh(i * 13.1 + ph * 0.37 + seed), 1.4), y = Math.round(y0 + k * (y1 - y0)), sp = lerp(sp0, sp1, k);
    const x = Math.round(x0 + (hsh(i * 7.7 + ph * 1.3 + seed) - 0.5) * 2 * sp);
    ctx.fillStyle = life < 2 ? '#ffffff' : '#fff2c4';
    ctx.fillRect(x, y, k > 0.5 ? 2 : 1, 1);
    if (life === 1 && i % 4 === 0) { ctx.fillRect(x - 1, y, 4, 1); ctx.fillRect(x, y - 1, 1, 3); }
  }
}
function boat(x, y) {
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x - 12, y + 1, 7, 1); ctx.fillRect(x - 16, y + 1, 3, 1);
  R(x - 6, y - 2, 12, 2, '#f4f0e6'); R(x - 5, y, 10, 1, '#2f5f9f'); R(x - 4, y + 1, 8, 1, '#26324a');
  R(x - 2, y - 5, 5, 3, '#f8f6f0'); R(x - 1, y - 4, 3, 1, '#4a5a72'); R(x + 3, y - 9, 1, 7, '#6a5a4a'); R(x + 3, y - 9, 3, 1, '#e0392c');
}
function sailboat(x, y) {
  ctx.fillStyle = '#ffffff';
  for (let r = 0; r < 7; r++) ctx.fillRect(x, y - 8 + r, 1 + Math.floor(r * 0.6), 1);
  ctx.fillStyle = '#ffe8d0'; for (let r = 0; r < 5; r++) ctx.fillRect(x - 1 - Math.floor(r * 0.5), y - 6 + r, 1 + Math.floor(r * 0.5), 1);
  R(x - 3, y, 8, 1, '#4a4458'); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 3, y + 1, 8, 1);
}
function gull(x, y, i) {
  const t = G.t + i * 377, fl = (t % 300) < 80 ? Math.floor(t / 6) % 4 : 1, s = i % 2;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y, 3, 1);
  if (fl === 0) { ctx.fillRect(x - 2 - s, y - 1, 1 + s, 1); ctx.fillRect(x + 2, y - 1, 1 + s, 1); ctx.fillRect(x - 3 - s, y - 2, 1, 1); ctx.fillRect(x + 3 + s, y - 2, 1, 1); }
  else if (fl === 2) { ctx.fillRect(x - 2 - s, y + 1, 1 + s, 1); ctx.fillRect(x + 2, y + 1, 1 + s, 1); }
  else { ctx.fillRect(x - 3 - s, y - 1, 2 + s, 1); ctx.fillRect(x + 2, y - 1, 2 + s, 1); }
  ctx.fillStyle = '#ffb030'; ctx.fillRect(x + 2, y, 1, 1);
}
function drawBG(cx) {
  const A = art();
  ctx.drawImage(A.sky, 0, 0, 1, H + 20, -10, -10, W + 20, H + 20);
  // the sun with its slow shimmer of rays
  const k = 0.5 + 0.5 * Math.sin(G.t * 0.013);
  ctx.globalAlpha = 0.6 + 0.4 * k; ctx.drawImage(A.rays, SUNX - 100, SUNY - 80); ctx.globalAlpha = 1;
  ctx.drawImage(A.sun, SUNX - 84, SUNY - 84);
  CLOUDS.forEach(([w, x, y, p, v], i) => ctx.drawImage(A.clouds[i], Math.round(x - (cx - CAM) * p - G.t * v), y));
  drawStrip(A.far, cx);
  const fo = clamp(Math.round((cx - CAM) * A.far.p), 12 - MG, MG - 12);
  // the crater's faint glow, the plume, the mast light
  const gx = VX + 3 - fo, gy = VTOP + 1, gl = ctx.createRadialGradient(gx, gy, 1, gx, gy, 16);
  gl.addColorStop(0, 'rgba(255,150,80,0.42)'); gl.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = gl; ctx.fillRect(gx - 16, gy - 16, 32, 32);
  ctx.globalAlpha = 0.93; blit(A.plume, VX + 3 - fo, VTOP - 1); ctx.globalAlpha = 1;
  if (G.t % 50 < 25) { ctx.fillStyle = '#ff5a4a'; ctx.fillRect(VX - 6 - fo, Math.ceil(vprof(VX - 6)) - 6, 1, 1); }
  // two far-off robot drones patrolling the volcano: the robot army's base is up there
  for (let i = 0; i < 2; i++) {
    const a = G.t * 0.012 + (i ? 1.5 : -1.5), dx = Math.round(VX - fo + Math.cos(a) * (34 + i * 16)), dy = Math.round(VTOP + 18 + i * 9 + Math.sin(a) * 5);
    ctx.fillStyle = '#5a5c70'; ctx.fillRect(dx - 2, dy, 5, 2); ctx.fillRect(dx - 1, dy - 1, 3, 1);
    ctx.fillStyle = '#8a8ca0'; ctx.fillRect(dx - 3 + ((G.t >> 1) & 1), dy - 2, 2, 1); ctx.fillRect(dx + 2 - ((G.t >> 1) & 1), dy - 2, 2, 1);
    if ((G.t + i * 13) % 30 < 15) { ctx.fillStyle = '#ff4a3a'; ctx.fillRect(dx, dy + 2, 1, 1); }
  }
  drawStrip(A.bay, cx);
  const bo = clamp(Math.round((cx - CAM) * A.bay.p), 12 - MG, MG - 12);
  glitter(SUNX - bo, HZ + 1, 152, 40, 3, 26, 1);
  sailboat(58 - bo, HZ + 5); sailboat(248 - bo, HZ + 3); boat(296 - bo, HZ + 11);
  drawStrip(A.lagoon, cx);
  const lo = clamp(Math.round((cx - CAM) * A.lagoon.p), 12 - MG, MG - 12);
  glitter(SUNX + 20 - lo, 169, 232, 44, 8, 48, 2);
  for (let i = 0; i < 12; i++) {
    const u = (G.t * 0.004 + hsh(i * 2.7)) % 1, y = Math.round(172 + hsh(i * 9.3) * 90), len = 4 + Math.round((y - 166) / 7);
    const x = Math.round(((hsh(i * 4.1) * 700 - lo + u * 40) % (W + 60) + W + 60) % (W + 60) - 30), a = Math.sin(u * Math.PI);
    ctx.fillStyle = 'rgba(236,255,250,' + (0.5 * a).toFixed(2) + ')'; ctx.fillRect(x, y, len, 1);
  }
  drawStrip(A.spit, cx);
  for (let i = 0; i < 3; i++) gull(Math.round(((i * 157 + G.t * (0.2 + i * 0.05)) % (W + 120)) - 60 + 120), Math.round(76 + i * 13 + Math.sin((G.t + i * 377) * 0.017) * 5), i);
}

// ---------------------------------------------------------------------------------------------------- the robot shark (enemy)
function foam(x, y, w, seed) {
  for (let i = -w; i <= w; i++) {
    const n = h2(i, G.t >> 2, seed);
    if (n < 0.25) continue;
    ctx.fillStyle = n > 0.7 ? '#ffffff' : '#c6f3f1';
    ctx.fillRect(x + i, y - (n > 0.85 ? 1 : 0), 1, 1);
  }
}
function ripples(x, y, t) {
  // rings spreading over the surface, the outer one flashing red/yellow: a shark is about to leap here
  for (let k = 0; k < 3; k++) {
    const ph = ((t * 0.5 + k * 9) % 27) / 27, rx = 6 + ph * 22, ry = rx * 0.24, a = 1 - ph * 0.8;
    ctx.fillStyle = rgba('#ffffff', a);
    for (let s = 0; s < 96; s++) { const th = s / 96 * Math.PI * 2; if ((s + k) % 6 === 5) continue; ctx.fillRect(Math.round(x + Math.cos(th) * rx), Math.round(y + Math.sin(th) * ry), Math.abs(Math.sin(th)) < 0.5 ? 2 : 1, 1); }
  }
  const on = Math.floor(t / 5) % 2 === 0;
  ctx.fillStyle = on ? '#ff3b30' : '#ffe066';
  for (let s = 0; s < 96; s++) { const th = s / 96 * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(th) * 25), Math.round(y + 1 + Math.sin(th) * 6), 2, 1); }
}
function splash(x, y, t) {
  // where the shark burst out: a foam ring, a crown of water spikes leaning outward, a collapsing column, drops
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let s = 0; s < 64; s++) { const th = s / 64 * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(th) * 19), Math.round(y + 1 + Math.sin(th) * 4.4), 2, 1); }
  ctx.fillStyle = 'rgba(214,250,246,0.6)';
  for (let s = 0; s < 40; s++) { const th = s / 40 * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(th) * 12), Math.round(y + 1 + Math.sin(th) * 2.6), 2, 1); }
  for (let k = -6; k <= 6; k++) {
    const hgt = (6 + (6 - Math.abs(k)) * 2.4) * (0.75 + hsh(k * 3.7 + 1) * 0.5), lean = k * 0.12;
    for (let j = 0; j < hgt; j++) {
      const px = Math.round(x + k * 2.4 + lean * j), wdt = j < hgt * 0.4 ? 2 : 1;
      ctx.fillStyle = j > hgt - 2 ? '#ffffff' : (j + k) % 3 ? '#ffffff' : '#bdeff2';
      ctx.fillRect(px, y - 1 - j, wdt, 1);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x + k * 2.4 + lean * hgt + k * 0.3), Math.round(y - 3 - hgt), 1, 2);
  }
  for (let i = 0; i < 60; i++) {
    const u = hsh(i * 3.1), hgt = 8 + u * 30, dx = (hsh(i * 5.7) - 0.5) * 2 * (4 + u * 16);
    ctx.fillStyle = hsh(i * 9.1) > 0.4 ? '#ffffff' : '#b9eef2';
    ctx.fillRect(Math.round(x + dx), Math.round(y - hgt * (0.35 + 0.65 * hsh(i * 7.3 + (t >> 3)))), 1, hsh(i * 4.4) > 0.5 ? 2 : 1);
  }
  for (let i = 0; i < 16; i++) { const w = 3 + (i % 3); R(x - 15 + i * 2 - (i % 2), y - 1 - Math.round(Math.sin(i / 15 * Math.PI) * 4), w, 3, i % 2 ? '#ffffff' : '#dff8f6'); }
}
function drawShark(e) {
  const A = art(), x = Math.round(e.x), t = e.t;
  if (e.mode === 'leap') {
    const S = A.leap;
    // its shadow on the water below
    ctx.fillStyle = 'rgba(8,60,80,0.16)'; ctx.fillRect(x - 22, WL - 1, 44, 2); ctx.fillRect(x - 15, WL - 2, 30, 4);
    splash(Math.round(e.sx), WL, t);
    // the arc it leapt along: water streaming off its tail back down to the splash, drops falling out of it
    // (art director: a quadratic arc that rises from the splash, bows right and curls over into the tail, so the
    //  leap reads as a high arc instead of a straight column)
    const tx = x + S.tail[0], ty = Math.round(e.y) + S.tail[1], p1x = e.sx + 14, p1y = ty - 34;
    for (let i = 0; i < 150; i++) {
      const u = i / 149, qa = (1 - u) * (1 - u), qb = 2 * u * (1 - u), qc = u * u;
      const px = qa * e.sx + qb * p1x + qc * tx, py = qa * (WL - 8) + qb * p1y + qc * ty, sp = 0.6 + (1 - u) * 1.6;
      const n = hsh(i * 7.7 + (t >> 2));
      if (n < 0.22 + u * 0.18) continue;
      ctx.fillStyle = hsh(i * 2.9) > 0.45 ? '#ffffff' : '#bdf0f4';
      ctx.fillRect(Math.round(px + (hsh(i * 3.3) - 0.5) * 2 * sp), Math.round(py + (hsh(i * 4.9) - 0.5) * 2 * sp), u > 0.7 ? 2 : 1, 1);
      if (i % 9 === 0) { ctx.fillStyle = '#d8f8fa'; ctx.fillRect(Math.round(px + 2), Math.round(py + 4 + ((t + i) % 12)), 1, 2); }
    }
    blit(S, x, e.y);
    // drops falling off the belly and fins
    for (let i = 0; i < 10; i++) { const dx = (hsh(i * 4.3) - 0.5) * 40, dy = 6 + hsh(i * 6.1) * 16; ctx.fillStyle = '#d8f8fa'; ctx.fillRect(Math.round(x + dx), Math.round(e.y + dy + ((t + i * 5) % 9)), 1, 2); }
    // the eye's glow, the furnace in its mouth
    const ex = x + S.eye[0], ey = Math.round(e.y) + S.eye[1];
    const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 7); g.addColorStop(0, 'rgba(255,90,70,0.55)'); g.addColorStop(1, 'rgba(255,90,70,0)');
    ctx.fillStyle = g; ctx.fillRect(ex - 7, ey - 7, 14, 14);
    const mx = x + S.mouth[0], my = Math.round(e.y) + S.mouth[1];
    const m = ctx.createRadialGradient(mx, my, 0, mx, my, 12); m.addColorStop(0, 'rgba(255,190,90,0.4)'); m.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = m; ctx.fillRect(mx - 12, my - 12, 24, 24);
    beacon(x + S.beacon[0], Math.round(e.y) + S.beacon[1], t, 6);
    return;
  }
  const S = e.facing > 0 ? A.finR : A.finL, cy = WL + 13;
  if (e.warn) ripples(x, WL + 1, t);
  // the dark body under the surface, the V wake behind the fin
  ctx.globalAlpha = 0.34; ctx.drawImage(S.shadow.img, x - S.shadow.ox, cy - S.shadow.oy); ctx.globalAlpha = 1;
  if (!e.warn) {
    for (let i = 0; i < 44; i++) {
      const d = i + 8, sx = x - e.facing * d, k = 1 - i / 44;
      if (hsh(i * 3.7 + (G.t >> 2)) < 0.25) continue;
      ctx.fillStyle = rgba(i < 14 ? '#ffffff' : '#bfeff0', 0.4 + 0.6 * k);
      ctx.fillRect(sx, WL - 1 - Math.round(d * 0.05), 1, 1); ctx.fillRect(sx, WL + 1 + Math.round(d * 0.15), i < 12 ? 2 : 1, 1);
      if (i < 16 && hsh(i * 5.1 + (G.t >> 2)) > 0.4) ctx.fillRect(sx, WL + (i & 1), 1, 1);
    }
    for (let i = 0; i < 7; i++) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + e.facing * (6 + i), WL - 1 - Math.round(Math.sin(i / 6 * Math.PI) * 2), 1, 1); }
  }
  blit(S, x, cy);
  foam(x, WL - 1, 8, e.x);
  beacon(x + S.beacon[0], cy + S.beacon[1], t, e.warn ? 4 : 14);
  if (e.warn && Math.floor(t / 5) % 2 === 0) text('!', x, WL - 40, '#ff3b30', 2, 'center');
}
function beacon(x, y, t, rate) {
  const on = Math.floor(t / rate) % 2 === 0;
  if (on) { ctx.fillStyle = 'rgba(255,90,70,0.45)'; ctx.fillRect(x - 3, y - 3, 7, 3); ctx.fillRect(x - 1, y - 5, 3, 7); }
  RO(x - 1, y - 3, 3, 3, on ? '#ff3b30' : '#8a2420'); R(x - 1, y - 1, 3, 1, '#3b424d');
  if (on) R(x - 1, y - 3, 1, 1, '#ffe0dc');
}
ENEMY_TYPES.shark = {
  hp: 6, armored: true, activateMargin: 80,
  contact: e => e.mode === 'leap' ? 'hurt' : 'none',
  make(e, s) {
    e.mode = s.mode || 'fin'; e.warn = e.mode === 'warn'; e.facing = s.facing || -1; e.sx = s.sx || e.x;
    if (e.mode === 'leap') { e.hp = e.max = 400; e.y = s.y; }
  },
  // the frame holds every pose (in the real level: cruise -> warn 50 frames -> leap at the hero -> splash down)
  update(e) { e.active = true; },
  draw: drawShark,
  box: e => e.mode === 'leap' ? { x: e.x - 34, y: e.y - 20, w: 68, h: 38 } : { x: e.x - 9, y: WL - 18, w: 18, h: 18 },
  onKill(e, cx, cy, b) { boom(cx, cy, 0.8); debris(cx, cy, 8, MET); debris(cx, cy, 4, '#e4eaf0'); addScore(300, cx, b.y); }
};

// ---------------------------------------------------------------------------------------------------- the turtle (POW)
POW_KINDS.turtle = {
  thanks: 'THANK YOU!',
  box: o => ({ x: o.x - (CW >> 1), y: o.y - CH - 5, w: CW, h: CH + 5 }),
  draw(o) {
    const A = art(), t = o.t;
    ctx.save(); ctx.translate(Math.round(o.x), Math.round(o.y));
    if (o.state === 'tied') {
      cageBack();
      const jig = Math.floor(t / 40) % 3 === 1 ? 1 : 0, top = -A.turtle.h - 3;
      ctx.save(); ctx.scale(-1, 1); spr(A.turtle, -16 + jig, top); ctx.restore();
      cageFront(o);
      // the head pushed between the bars, looking at the hero
      ctx.save(); ctx.beginPath(); ctx.rect(-18, top + 3, 11, 11); ctx.clip(); ctx.scale(-1, 1); spr(A.turtle, -16 + jig, top); ctx.restore();
      if (Math.floor((t + 20) / 40) % 2 === 0) helpBubble(-CH - 23 + (Math.floor(t / 10) % 2));
    } else { ctx.save(); ctx.scale(-1, 1); spr(A.turtle, -15, -A.turtle.h - 1); ctx.restore(); }
    ctx.restore();
  },
  onFree() { Snd.tone('triangle', 520, 880, 0.18, 0.08); }
};

// ---------------------------------------------------------------------------------------------------- the jet-ski (ride)
function wake(x, y) {
  for (let i = 0; i < 130; i++) {
    const d = i + 31, sx = x - d, k = 1 - i / 130;
    if (h2(i, G.t >> 2, 1) < 0.9 * k + 0.05) { ctx.fillStyle = h2(i, G.t >> 2, 2) < 0.55 ? '#ffffff' : '#c8f4f4'; ctx.fillRect(sx, y + Math.round((h2(i, G.t >> 3, 3) - 0.5) * (2 + i * 0.03)), i < 40 ? 2 : 1, 1); }
    const far = y - 1 - Math.round(i * 0.06), near = y + 2 + Math.round(i * 0.17);
    if (h2(i, 1, G.t >> 3) < 0.75 * k + 0.1) { ctx.fillStyle = rgba('#ffffff', 0.5 + 0.5 * k); ctx.fillRect(sx, far, 1, 1); }
    if (h2(i, 2, G.t >> 3) < 0.8 * k + 0.1) { ctx.fillStyle = rgba('#ffffff', 0.45 + 0.55 * k); ctx.fillRect(sx, near, 2, 1); if (i % 3 === 0) ctx.fillRect(sx, near + 1, 1, 1); }
  }
}
function roosterTail(x, y) {
  // the jet: a thick arc of white water fanning out behind and breaking into drops
  const nx = x - 34, ny = y - 3;
  for (let i = 0; i < 380; i++) {
    const tau = Math.pow(i / 380, 1.1) * 36, jit = 0.3 + tau * 0.16;
    const px = nx - 2.1 * tau + (hsh(i * 3.3 + (G.t >> 1)) - 0.5) * 2 * jit, py = ny - 2.4 * tau + 0.072 * tau * tau + (hsh(i * 5.9 + (G.t >> 1)) - 0.5) * 2 * jit;
    if (py > y) continue;
    const core = tau < 16 && hsh(i * 1.7) > 0.25, sz = tau < 6 ? 3 : tau < 14 ? 2 : 1;
    ctx.fillStyle = rgba(core || hsh(i * 7.1) > 0.5 ? '#ffffff' : '#a8e8f0', clamp(1.15 - tau / 36, 0.3, 1));
    ctx.fillRect(Math.round(px), Math.round(py), sz, tau < 20 ? sz : 1);
  }
}
function bowSpray(x, y) {
  // a sheet of water peeling off the bow and falling forward, foam along the waterline
  for (let i = 0; i < 70; i++) {
    const vx = 0.3 + hsh(i * 2.7) * 1.5, vy = -0.5 - hsh(i * 4.1) * 1.5, tau = hsh(i * 6.3 + (G.t >> 2)) * 9;
    const px = x + 18 + hsh(i * 8.8) * 6 + vx * tau, py = y - 1 + vy * tau + 0.13 * tau * tau;
    if (py > y + 1) continue;
    ctx.fillStyle = hsh(i * 5.3) > 0.4 ? '#ffffff' : '#c8f6f6';
    ctx.fillRect(Math.round(px), Math.round(py), tau < 3 ? 2 : 1, 1);
  }
  for (let i = 0; i < 22; i++) { ctx.fillStyle = i % 3 ? '#ffffff' : '#d8faf6'; ctx.fillRect(x + 21 + i, y - 1 + Math.round(i * 0.12 + Math.sin(i * 1.3 + G.t * 0.2) * 0.6), 1, 1); }
}
function drawJetski(p, r) {
  const A = art(), x = Math.round(p.x), y = Math.round(p.y);
  wake(x, y);
  roosterTail(x, y);
  // the reflection of the red hull under it
  ctx.fillStyle = 'rgba(160,40,40,0.25)'; ctx.fillRect(x - 29, y + 3, 54, 2); ctx.fillRect(x - 24, y + 6, 44, 1);
  // the rider in the seat (the pistol clipped away), then the jet-ski over the legs
  ctx.save(); ctx.translate(x - 12, y + 1);
  ctx.beginPath(); ctx.rect(-30, -60, 60, 39); ctx.rect(-30, -21, 37, 30); ctx.clip();
  drawHero(HEROES[G.hero], 0, 0, 1, { pose: 'idle', t: p.t, aim: 'fwd', weapon: 'pistol', muzzle: 0 });
  ctx.restore();
  blit(A.jet, x, y);
  blit(A.gun, x + 23, y - 16);
  if (r.muzzle > 0) blit(A.flash, x + 23 + Math.cos(GUN_A) * 14, y - 16 - Math.sin(GUN_A) * 14);
  // the water over the hull's bottom, foam along it
  for (let k = 0; k < 5; k++) { ctx.fillStyle = k === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(36,152,175,' + (0.72 + k * 0.07).toFixed(2) + ')'; ctx.fillRect(x - 31 + k, y + k, 51 - k * 3, 1); }
  foam(x - 6, y - 1, 22, 3);
  bowSpray(x, y);
}
function drawShot(b) {
  if (b.age < 1) return;
  const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, x = Math.round(b.x), y = Math.round(b.y);
  for (let k = 9; k >= 2; k--) R(Math.round(b.x - ux * k), Math.round(b.y - uy * k), k > 6 ? 1 : 2, k > 6 ? 1 : 2, k > 6 ? '#ff7a1a' : '#ffb52e');
  R(x - 1, y - 1, 3, 3, '#ffe066'); R(x, y, 1, 1, '#ffffff');
}
RIDES.jetski = {
  update(p, r) {
    r.t = (r.t || 0) + 1;
    p.x = HX; p.y = WL; p.facing = 1; p.onGround = true; p.vx = 0; p.vy = 0;
    if (r.cd > 0) r.cd--;
    if (r.muzzle > 0) r.muzzle--;
    // the nose gun: a burst at the leaping shark
    if (r.t > 100 && r.cd <= 0) {
      r.cd = 3; r.muzzle = 2;
      const mx = p.x + 23 + Math.cos(GUN_A) * 12, my = p.y - 16 - Math.sin(GUN_A) * 12;
      G.pb.push({ x: mx, y: my, vx: Math.cos(GUN_A) * 6.5, vy: -Math.sin(GUN_A) * 6.5, dmg: 1, life: 70, age: 0, update: b => { b.age++; }, draw: drawShot });
      G.parts.push({ type: 'debris', x: p.x + 21, y: p.y - 18, vx: -0.6 - (r.t % 3) * 0.2, vy: -1.6 - (r.t % 2) * 0.4, g: 0.2, life: 16, max: 16, size: 1, c: '#e8b43a' });
    }
  },
  box: p => ({ x: p.x - 30, y: p.y - 36, w: 64, h: 38 }),
  draw: drawJetski,
  hurt(p, r) { r.armour = Math.max(0, r.armour - 1); p.inv = 60; },
  hud(r) {
    const A = art();
    ctx.drawImage(A.icon.img, 128, 9);
    text('JET-SKI', 157, 8, '#ffe066');
    for (let i = 0; i < 5; i++) {
      const x = 157 + i * 7;
      if (i < r.armour) { RO(x, 21, 5, 4, '#8be0a8'); R(x, 21, 5, 1, '#d4ffe0'); } else { RO(x, 21, 5, 4, '#3a3a4a'); R(x + 2, 22, 1, 1, '#22222e'); }
    }
    ctx.drawImage(A.torp.img, 196, 18);
    text('X' + r.torps, 227, 20, '#ffffff', 1, 'right');
  }
};
PROP_TYPES.jetski = {
  box: () => null, hit() {},
  update(o) { const p = G.p; if (p && !p.dead && !p.ride && Math.abs(p.x - o.x) < 16 && boardRide(p, { type: 'jetski', armour: 5, torps: 8, cd: 0, muzzle: 0, t: 0 })) o.dead = true; },
  draw(o) { blit(art().jet, o.x, o.y); }
};

// ---------------------------------------------------------------------------------------------------- the mission
LEVELS.push({
  mission: 'MISSION 3', title: 'VOLCANO ISLAND', end: 4200, heroStart: 120, freedLabel: 'ANIMALS RESCUED',
  sections: [{ x: 0, name: 'AREA 1: SHARK BAY' }],
  terrain: [[0, WL], [4200, WL]],
  plats: [{ x: PIER_X, y: PIER_Y, w: PIER_W, t: 'pier' }],
  spawns: [], pows: [{ x: CAGE_X, item: 'H', kind: 'turtle' }], props: [], locks: [],
  music: 'main', bossMusic: 'boss',
  load(cp) {
    G.cam.x = CAM;
    dbg.god = true;                       // a staged frame: nothing may hurt the hero
    G.score = 46850;                      // carried over from Missions 1 and 2
    const p = G.p;
    boardRide(p, { type: 'jetski', armour: 5, torps: 8, cd: 0, muzzle: 0, t: 0 });
    const add = s => { const e = makeEnemy(s); e.active = true; G.enemies.push(e); };
    add({ t: 'shark', x: CAM + 248, y: 106, mode: 'leap', facing: -1, sx: CAM + 304 });
    add({ t: 'shark', x: CAM + 354, mode: 'warn', facing: -1 });
    add({ t: 'shark', x: CAM + 58, mode: 'fin', facing: 1 });
    for (const o of G.pows) if (o.kind === 'turtle') o.y = PIER_Y;
  },
  update() { G.cam.x = CAM; },
  drawBG, drawFront,
  drawPlat() {
    const A = art();
    // the piles' feet seen through the water, then the pier
    ctx.globalAlpha = 0.3; for (const px of PILES) R(px, WL + 1, 5, 12, '#0b4a5e'); ctx.globalAlpha = 1;
    blit(A.pier, 0, 0);
    for (const px of PILES) foam(px + 2, WL, 5, px);
    if (G.t % 40 < 30) { ctx.fillStyle = 'rgba(255,214,110,0.25)'; ctx.fillRect(POSTS[0] - 4, PIER_Y - 26, 11, 12); }
  },
  drawOverlay() {
    const g = ctx.createRadialGradient(SUNX, SUNY, 10, SUNX, SUNY, 300);
    g.addColorStop(0, 'rgba(255,226,170,0.16)'); g.addColorStop(1, 'rgba(255,226,170,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  },
  preview(x, y, w, h) {
    const A = art();
    ctx.drawImage(A.sky, 0, 0, 1, H + 20, x, y, w, h);
    ctx.drawImage(A.far.c, MG + 200, 30, 220, 100, x, y, w, h * 0.7);
    ctx.fillStyle = '#3db8c1'; ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
  }
});
}
