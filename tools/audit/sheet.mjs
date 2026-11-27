import {createRequire} from 'module';const require=createRequire(process.cwd()+'/tools/harness/');
const {createCanvas,loadImage}=require('@napi-rs/canvas');import fs from 'fs';
const [out,...files]=process.argv.slice(2);const cols=2,w=480,h=270,rows=Math.ceil(files.length/cols);
const c=createCanvas(cols*w,rows*(h+14)),x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,c.width,c.height);
for(let i=0;i<files.length;i++){try{const im=await loadImage(files[i]);x.drawImage(im,(i%cols)*w,Math.floor(i/cols)*(h+14)+14);}catch(e){}
x.fillStyle='#ff0';x.font='12px sans-serif';x.fillText(files[i].split('/').pop(),(i%cols)*w+4,Math.floor(i/cols)*(h+14)+11);}
fs.writeFileSync(out,c.toBuffer('image/png'));
