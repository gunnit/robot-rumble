import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('/Users/macbookair/game/tools/harness/');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs2 = fs.readdirSync('spec').filter(f => f.endsWith('.png')).sort();
const cols = 2, cw = 520, ch = 136, cv = createCanvas(cols * cw, Math.ceil(fs2.length / cols) * ch), g = cv.getContext('2d');
g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height); g.font = 'bold 16px Helvetica'; g.fillStyle = '#fff';
let i = 0; for (const f of fs2) { const x = (i % cols) * cw, y = Math.floor(i / cols) * ch; g.fillText(f.replace('.png', ''), x + 6, y + 16); g.drawImage(await loadImage('spec/' + f), x + 6, y + 22); i++; }
fs.writeFileSync('specsheet.png', cv.toBuffer('image/png'));
