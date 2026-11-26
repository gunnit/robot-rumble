// node crop.mjs in.png out.png x y w h [scale]: crop a region and enlarge it (nearest neighbour)
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('/Users/macbookair/game/tools/harness/');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const [i, o, x, y, w, h, s = 3] = process.argv.slice(2);
const im = await loadImage(i), c = createCanvas(w * s, h * s), g = c.getContext('2d');
g.imageSmoothingEnabled = false; g.drawImage(im, +x, +y, +w, +h, 0, 0, w * s, h * s);
fs.writeFileSync(o, c.toBuffer('image/png'));
