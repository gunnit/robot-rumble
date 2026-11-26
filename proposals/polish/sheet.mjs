// Builds proposals/polish/proposal-sheet.png: TODAY | PROPOSED for the four Mission 1 areas.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/Users/macbookair/game/tools/harness/');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const S = '/Users/macbookair/game/tools/polish/sheet-src/';
const rows = [['jungle', 'AREA 1: THE JUNGLE'], ['camp', 'AREA 2: ENEMY CAMP'], ['bridge', 'AREA 3: THE BIG BRIDGE'], ['base', 'FINAL AREA: ROBOT BASE']];
const PW = 960, PH = 540, G = 12, HEAD = 64, LAB = 34;
const cv = createCanvas(PW * 2 + G * 3, HEAD + rows.length * (PH + LAB + G) + G), g = cv.getContext('2d');
g.fillStyle = '#14141f'; g.fillRect(0, 0, cv.width, cv.height);
g.textBaseline = 'middle'; g.textAlign = 'center';
g.font = 'bold 30px Helvetica, Arial, sans-serif';
g.fillStyle = '#9aa3c0'; g.fillText('MISSION 1 TODAY', G + PW / 2, HEAD / 2);
g.fillStyle = '#ffe066'; g.fillText('MISSION 1 REPAINTED (mock screenshots)', G * 2 + PW + PW / 2, HEAD / 2);
let y = HEAD;
for (const [k, name] of rows) {
  g.font = 'bold 20px Helvetica, Arial, sans-serif'; g.fillStyle = '#ffffff'; g.textAlign = 'left';
  g.fillText(name, G, y + LAB / 2);
  g.textAlign = 'center';
  g.imageSmoothingEnabled = false;
  g.drawImage(await loadImage(S + k + '-before.png'), G, y + LAB, PW, PH);
  g.drawImage(await loadImage(S + k + '-after.png'), G * 2 + PW, y + LAB, PW, PH);
  y += PH + LAB + G;
}
fs.writeFileSync('/Users/macbookair/game/proposals/polish/proposal-sheet.png', cv.toBuffer('image/png'));
console.log('ok', cv.width, cv.height);
