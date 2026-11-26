import fs from 'node:fs';
import {createRequire} from 'node:module';
import {boot} from './runtime.mjs';
const require=createRequire(import.meta.url),{createCanvas}=require('../harness/node_modules/@napi-rs/canvas');
const out=process.argv[2];fs.mkdirSync(out,{recursive:true});
const e=boot(1),g=e.get,G=g('G');
function save(name){g('draw')();const c=createCanvas(960,540),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(e.canvas,0,0,960,540);fs.writeFileSync(out+'/'+name+'.png',c.toBuffer('image/png'));}
e.start(4,550,0,true);e.step(35,['up']);e.step(450);save('coralli');
e.start(4,1800,1,true);e.step(40,['up']);e.step(1,['enter']);e.step(90,['right','fire']);e.step(440);save('sottomarino');
e.start(4,3920,0,true);e.step(35,['up']);e.step(450);save('rovine');
e.start(4,6140,0,true);e.step(40,['up']);e.step(450);save('boss');
G.state='missions';G.level=3;G.fade=0;e.step(60);save('missioni');
console.log(JSON.stringify({errors:e.errors,warnings:e.warnings}));
