'use strict';
// ============================================================
// Core: canvas, helpers, input, pixel font, pixel-art drawing, terrain
// All src/*.js files are classic scripts sharing one global scope (see docs/engine-api.md).
// ============================================================
const W = 480, H = 270, GROUND = 232;
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  cvs.style.width = Math.floor(W * s) + 'px';
  cvs.style.height = Math.floor(H * s) + 'px';
  // Below one physical display pixel per game pixel, nearest-neighbor scaling
  // drops entire rows and columns of the 5 × 7 font.
  cvs.style.imageRendering = s * (window.devicePixelRatio || 1) < 1 ? 'auto' : '';
}
addEventListener('resize', resize);
resize();

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inBox = (px, py, b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
function distToBox(px, py, b) {
  const dx = Math.max(b.x - px, 0, px - (b.x + b.w));
  const dy = Math.max(b.y - py, 0, py - (b.y + b.h));
  return Math.hypot(dx, dy);
}
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function mix(a, b, k) {
  const A = hex(a), B = hex(b);
  return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',') + ')';
}
function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

// Content may name things whose owners haven't finished yet: skip them with one warning per name
const warned = new Set();
function warnOnce(kind, name) {
  const k = kind + ':' + name;
  if (warned.has(k)) return;
  warned.add(k);
  console.warn('Robot Rumble: unknown ' + kind + ' "' + name + '" skipped');
}
// An exception in the game loop doesn't stop the game: it is logged once per message and the game carries on
// (main.js; the engine drops a broken enemy, prop or bullet). errorAt = when the last one happened, for the note
// main.js shows on the screen.
const errorsLogged = new Set();
let errorAt = -Infinity;
function errorOnce(err) {
  errorAt = performance.now();
  const msg = String(err && err.stack || err);
  if (errorsLogged.has(msg)) return;
  errorsLogged.add(msg);
  console.error('Robot Rumble: error in the game loop (it keeps running):', err);
}

// Ground surface y at world x for the current level: linear between LV.terrain points
// (clamped at the ends), flat GROUND when the level has no terrain.
function groundAt(x) {
  const t = LV && LV.terrain;
  if (!t) return GROUND;
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    const [x1, y1] = t[i];
    if (x <= x1) { const [x0, y0] = t[i - 1]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  }
  return t[t.length - 1][1];
}

// ============================================================
// Input
// ============================================================
const keys = {}, pressed = {};
const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space', 'KeyK'], fire: ['KeyX', 'KeyJ'], bomb: ['KeyC', 'KeyL'],
  ok: ['Enter', 'Space', 'KeyZ', 'KeyX'], pause: ['KeyP', 'Escape'], mute: ['KeyM'], quit: ['KeyQ']
};
addEventListener('keydown', e => {
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  Snd.init();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  if (G.state === 'play') G.state = 'pause';
});
const held = a => KEYMAP[a].some(c => keys[c]);
const tap = a => KEYMAP[a].some(c => pressed[c]);

// ============================================================
// Pixel font (5x7)
// ============================================================
const GLYPHS = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00010 00100 01000 11111', 3: '11111 00010 00100 00010 00001 10001 01110',
  4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
  '!': '00100 00100 00100 00100 00100 00000 00100', '?': '01110 10001 00001 00010 00100 00000 00100',
  '.': '00000 00000 00000 00000 00000 01100 01100', ',': '00000 00000 00000 00000 01100 00100 01000',
  ':': '00000 01100 01100 00000 01100 01100 00000', '-': '00000 00000 00000 11111 00000 00000 00000',
  "'": '00100 00100 01000 00000 00000 00000 00000', '/': '00001 00001 00010 00100 01000 10000 10000',
  '+': '00000 00100 00100 11111 00100 00100 00000', '>': '01000 00100 00010 00001 00010 00100 01000',
  '<': '00010 00100 01000 10000 01000 00100 00010', '&': '01100 10010 10100 01000 10101 10010 01101',
  '%': '11001 11010 00010 00100 01000 01011 10011',
  '(': '00010 00100 01000 01000 01000 00100 00010', ')': '01000 00100 00010 00010 00010 00100 01000'
};
const glyphCache = {};
function glyph(ch, color) {
  const k = ch + color;
  let c = glyphCache[k];
  if (c) return c;
  c = document.createElement('canvas'); c.width = 5; c.height = 7;
  const src = GLYPHS[ch];
  if (src) {
    const g = c.getContext('2d'); g.fillStyle = color;
    src.split(' ').forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] === '1') g.fillRect(x, y, 1, 1); });
  }
  glyphCache[k] = c;
  return c;
}
function text(s, x, y, color = '#ffffff', sc = 1, align = 'left', shadow = '#000000') {
  s = String(s).toUpperCase();
  // the font has plain A-Z only: accented letters fall back to their base letter (RÍA -> RIA, Ñ -> N)
  if (/[^\x00-\x7f]/.test(s)) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const w = s.length * 6 * sc - sc;
  if (align === 'center') x -= w / 2; else if (align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  const draw = (col, ox, oy) => {
    for (let i = 0; i < s.length; i++) {
      if (s[i] === ' ') continue;
      ctx.drawImage(glyph(s[i], col), x + i * 6 * sc + ox, y + oy, 5 * sc, 7 * sc);
    }
  };
  if (shadow) {
    if (sc >= 2) {
      const o = Math.max(1, sc >> 1);
      draw(shadow, -o, 0); draw(shadow, o, 0); draw(shadow, 0, -o); draw(shadow, 0, o); draw(shadow, o, o + 1);
    } else draw(shadow, 1, 1);
  }
  draw(color, 0, 0);
}

// ============================================================
// Pixel-art drawing helpers
// ============================================================
const OUT = '#1a1a26';
// Robot metal palette shared by every robot enemy
const MET = '#8a97a8', METD = '#56606e', METL = '#c3cdd8', METDD = '#3b424d', EVIL = '#ff3b30';
let FLASH = false; // when true, sprites draw white (hit flash)
function R(x, y, w, h, c) { ctx.fillStyle = FLASH ? '#ffffff' : c; ctx.fillRect(x, y, w, h); }
function RO(x, y, w, h, c) {
  ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = FLASH ? '#ffffff' : c; ctx.fillRect(x, y, w, h);
}
// Draw several rects as one outlined shape (no outline lines between them)
function blob(rects, col) {
  ctx.fillStyle = OUT;
  for (const [x, y, w, h] of rects) ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  for (const [x, y, w, h] of rects) R(x, y, w, h, col);
}
const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
function drawHeart(x, y, s, full) {
  ctx.fillStyle = OUT;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (HEART[r][c] === '1') ctx.fillRect(x + c * s - 1, y + r * s - 1, s + 2, s + 2);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (HEART[r][c] === '1') {
    ctx.fillStyle = full ? (r < 2 && c === 1 ? '#ffc2c2' : '#ff4757') : '#4b4b5e';
    ctx.fillRect(x + c * s, y + r * s, s, s);
  }
}
function drawCrate(x, y) {
  RO(x, y, 16, 16, '#b7792b'); R(x, y, 16, 2, '#d89a4a');
  R(x + 1, y + 7, 14, 2, '#8a5a1e'); R(x + 7, y + 1, 2, 14, '#8a5a1e');
  R(x + 1, y + 1, 2, 2, '#5b3a1e'); R(x + 13, y + 1, 2, 2, '#5b3a1e');
  R(x + 1, y + 13, 2, 2, '#5b3a1e'); R(x + 13, y + 13, 2, 2, '#5b3a1e');
}

// ============================================================
// Pixel-map sprites: rows of palette letters, '.' = transparent.
// A white copy of each sprite is kept for hit flashes.
// ============================================================
function makeSprite(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const make = white => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = pal[row[x]];
        if (!col) continue;
        g.fillStyle = white && row[x] !== 'k' ? '#ffffff' : col;
        g.fillRect(x, y, 1, 1);
      }
    });
    return c;
  };
  return { img: make(false), white: make(true), w, h };
}
function spr(s, x, y) { ctx.drawImage(FLASH ? s.white : s.img, Math.round(x), Math.round(y)); }
