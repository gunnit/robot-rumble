// Builds a TODAY | PROPOSED sheet from pairs of 1440x810 renders.
// node tools/m4polish/sheet.mjs <out.png> <title-left> <title-right> <label>=<before.png>,<after.png> ...
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/Users/macbookair/game/tools/harness/');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const [out, tl, tr, ...rows] = process.argv.slice(2);
const PW = 960, PH = 540, G = 12, HEAD = 64, LAB = 34;
const cv = createCanvas(PW * 2 + G * 3, HEAD + rows.length * (PH + LAB + G) + G), g = cv.getContext('2d');
g.fillStyle = '#14141f'; g.fillRect(0, 0, cv.width, cv.height);
g.textBaseline = 'middle'; g.textAlign = 'center';
g.font = 'bold 30px Helvetica, Arial, sans-serif';
g.fillStyle = '#9aa3c0'; g.fillText(tl, G + PW / 2, HEAD / 2);
g.fillStyle = '#ffe066'; g.fillText(tr, G * 2 + PW + PW / 2, HEAD / 2);
let y = HEAD;
for (const row of rows) {
  const [name, pics] = row.split('='); const [a, b] = pics.split(',');
  g.font = 'bold 20px Helvetica, Arial, sans-serif'; g.fillStyle = '#ffffff'; g.textAlign = 'left';
  g.fillText(name, G, y + LAB / 2); g.textAlign = 'center';
  g.imageSmoothingEnabled = true;
  if (a !== '-') g.drawImage(await loadImage(a), G, y + LAB, PW, PH);
  else { g.fillStyle = '#20202e'; g.fillRect(G, y + LAB, PW, PH); g.fillStyle = '#9aa3c0'; g.fillText('(not in the game today)', G + PW / 2, y + LAB + PH / 2); }
  g.drawImage(await loadImage(b), G * 2 + PW, y + LAB, PW, PH);
  y += PH + LAB + G;
}
fs.writeFileSync(out, cv.toBuffer('image/png'));
console.log('ok', out, cv.width, cv.height);
