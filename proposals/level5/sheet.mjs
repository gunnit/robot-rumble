// Composes proposals/level5/proposal-sheet.png: the four MISSION 5 frames at 2x (960x540) in a 2x2 grid, then the
// robot cast and the new things in a bottom band. Lettered in the game's own 5x7 pixel font (glyph table copied from
// text() in the game; nothing in the game is changed).
//   node /Users/macbookair/game/proposals/level5/sheet.mjs
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/Users/macbookair/game/tools/harness/harness.mjs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const L5 = '/Users/macbookair/game/proposals/level5';
const OUT_PNG = process.argv[2] || L5 + '/proposal-sheet.png';

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
const textW = (s, sc) => s.length * 6 * sc - sc;
// the game's text(): 5x7 glyphs on a 6-px pitch; at scale >= 2 an outline shadow (4 sides + one step down-right)
function text(g, s, x, y, color = '#ffffff', sc = 1, align = 'left', shadow = '#000000') {
  s = String(s).toUpperCase();
  for (const ch of s) if (ch !== ' ' && !GLYPHS[ch]) throw new Error('no glyph for ' + JSON.stringify(ch) + ' in ' + s);
  const w = textW(s, sc);
  if (align === 'center') x -= w / 2; else if (align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  const draw = (col, ox, oy) => {
    g.fillStyle = col;
    for (let i = 0; i < s.length; i++) {
      const src = GLYPHS[s[i]];
      if (!src) continue;
      src.split(' ').forEach((row, r) => { for (let c = 0; c < 5; c++) if (row[c] === '1') g.fillRect(x + i * 6 * sc + ox + c * sc, y + oy + r * sc, sc, sc); });
    }
  };
  if (shadow) {
    if (sc >= 2) { const o = Math.max(1, sc >> 1); draw(shadow, -o, 0); draw(shadow, o, 0); draw(shadow, 0, -o); draw(shadow, 0, o); draw(shadow, o, o + 1); }
    else draw(shadow, 1, 1);
  }
  draw(color, 0, 0);
}

const FRAMES = [
  { png: L5 + '/hangar/hangar.png', title: 'AREA 1: THE HANGAR',
    lines: ['BEAMED UP TO THE ALIEN MOTHERSHIP! THE EARTH IS FAR BELOW.', 'OGGLES AIM THEIR RAY GUNS. A BLINKING ANTENNA MEANS A ZAP!'] },
  { png: L5 + '/garden/garden.png', title: 'AREA 2: STAR GARDEN',
    lines: ['A GLASS DOME FULL OF ALIEN PLANTS. THE COWS ARE KEPT HERE!', 'ROLY EYES ROLL AT YOU. JUMP ON THE MUSHROOMS. FREE THE COWS!'] },
  { png: L5 + '/space/space.png', title: 'AREA 3: SPACE WALK',
    lines: ['OUTSIDE ON THE HULL. STEAL A MINI UFO AND FLY IT!', 'ITS BEAM GRABS ROBOTS AND THROWS THEM. WATCH FOR METEORS!'] },
  { png: L5 + '/bridge/bridge.png', title: 'FINAL AREA: THE BRIDGE',
    lines: ['BOSS: THE MEGA OGGLE, CAPTAIN OF THE MOTHERSHIP.', 'JUMP ITS EYE BEAM (ZAAAP!) AND SHOOT ITS BIG OPEN EYE!'] }
];
const CAST = L5 + '/cast/cast.png';
const NOTES = [
  ['THE ROBOTS', '#9dff4a', ['THE OGGLES: GREEN, ONE BIG EYE EACH.', 'EVERY ONE WARNS YOU BEFORE IT ATTACKS:', 'ITS LAMP BLINKS, ITS EYE TURNS YELLOW,', 'A RED ! POPS UP.']],
  ['THE RESCUE', '#ffcf3a', ['THE COWS OF VIGO HILLS, BEAMED UP', 'INTO GLASS PODS. MOO!']],
  ['THE NEW TOY', '#4fe3ff', ['A STOLEN MINI UFO: IT FLIES, SHOOTS', 'AND GRABS ROBOTS WITH ITS BEAM.']]
];

// layout
const FW = 960, FH = 540, B = 4, M = 22, GAP = 20;
const TITLE_H = 124, CAP_H = 84, ROW_GAP = 18;
const CAST_SRC_Y = 34 * 3, CAST_SRC_H = (270 - 34) * 3, CAST_H = (270 - 34) * 2;   // the cast frame without its HUD strip
const SW = M * 2 + (FW + B * 2) * 2 + GAP;
const GRID_BOTTOM = TITLE_H + 14 + 2 * (FH + B * 2 + CAP_H) + ROW_GAP;
const SH = GRID_BOTTOM + 10 + CAST_H + B * 2 + M;
const c = createCanvas(SW, SH), g = c.getContext('2d');
g.imageSmoothingEnabled = false;

g.fillStyle = '#10131d'; g.fillRect(0, 0, SW, SH);
g.fillStyle = '#0d0f18'; for (let y = 0; y < SH; y += 4) g.fillRect(0, y, SW, 2);

g.fillStyle = '#1b1f2c'; g.fillRect(0, 0, SW, TITLE_H);
g.fillStyle = '#f1c40f'; g.fillRect(0, 10, SW, 4); g.fillRect(0, TITLE_H - 14, SW, 4);
g.fillStyle = '#7a5e08'; g.fillRect(0, 14, SW, 2); g.fillRect(0, TITLE_H - 10, SW, 2);
text(g, 'MISSION 5: ALIEN MOTHERSHIP', SW / 2, 26, '#ffd23f', 7, 'center', '#2a1a00');
text(g, 'A PROPOSAL: SCREENS PAINTED IN THE REAL GAME ENGINE. NOTHING IS PLAYABLE YET', SW / 2, 85, '#c3cdd8', 2, 'center', '#000000');

function frame(x, y, w, h) {
  g.fillStyle = '#05060a'; g.fillRect(x, y, w + B * 2, h + B * 2);
  g.fillStyle = '#3b424d'; g.fillRect(x + 2, y + 2, w + B * 2 - 4, 1); g.fillRect(x + 2, y + h + B * 2 - 3, w + B * 2 - 4, 1);
  g.fillRect(x + 2, y + 2, 1, h + B * 2 - 4); g.fillRect(x + w + B * 2 - 3, y + 2, 1, h + B * 2 - 4);
}
for (let i = 0; i < FRAMES.length; i++) {
  const f = FRAMES[i], col = i % 2, row = i >> 1;
  const x = M + col * (FW + B * 2 + GAP), y = TITLE_H + 14 + row * (FH + B * 2 + CAP_H + ROW_GAP);
  frame(x, y, FW, FH);
  if (fs.existsSync(f.png)) {
    const im = await loadImage(f.png);
    if (im.width !== 1440 || im.height !== 810) throw new Error(f.png + ' is ' + im.width + 'x' + im.height);
    g.drawImage(im, 0, 0, 1440, 810, x + B, y + B, FW, FH);   // 3x render -> 2x, nearest neighbour
  } else { g.fillStyle = '#17152e'; g.fillRect(x + B, y + B, FW, FH); text(g, 'NOT PAINTED YET', x + B + FW / 2, y + B + FH / 2, '#6272ab', 3, 'center'); }
  const cy = y + FH + B * 2 + 12;
  text(g, f.title, x + 2, cy, '#ffd23f', 3, 'left', '#2a1a00');
  f.lines.forEach((s, k) => {
    if (textW(s, 2) > FW) throw new Error('caption too long: ' + s);
    text(g, s, x + 2, cy + 31 + k * 20, '#ffffff', 2, 'left', '#000000');
  });
}
// bottom band: the cast (left) and the new things (right)
{
  const x = M, y = GRID_BOTTOM + 10;
  frame(x, y, FW, CAST_H);
  if (fs.existsSync(CAST)) { const im = await loadImage(CAST); g.drawImage(im, 0, CAST_SRC_Y, 1440, CAST_SRC_H, x + B, y + B, FW, CAST_H); }
  let ty = y + 18; const tx = M + FW + B * 2 + GAP + 6;
  for (const [head, col, lines] of NOTES) {
    text(g, head, tx, ty, col, 4, 'left', '#000000'); ty += 42;
    for (const s of lines) { if (textW(s, 3) > FW - 6) throw new Error('note too long: ' + s); text(g, s, tx, ty, '#ffffff', 3, 'left', '#000000'); ty += 28; }
    ty += 22;
  }
}
fs.writeFileSync(OUT_PNG, c.toBuffer('image/png'));
console.log(OUT_PNG, SW + 'x' + SH);
