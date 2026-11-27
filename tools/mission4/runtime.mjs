import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas}=require('../harness/node_modules/@napi-rs/canvas');
export function boot(seed=1, html=null){
  const errors=[],warnings=[],canvas=createCanvas(480,270); canvas.style={};
  let a=seed>>>0; const random=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
  const storage={};const sandbox={document:{getElementById:()=>canvas,createElement:()=>{const c=createCanvas(1,1);c.style={};return c;}},console:{log(){},warn:(...x)=>warnings.push(x.join(' ')),error:(...x)=>errors.push(x.map(v=>v?.stack||v).join(' '))},innerWidth:960,innerHeight:540,addEventListener(){},removeEventListener(){},requestAnimationFrame(){},performance:{now:()=>0},location:{search:''},localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>{storage[k]=v;}},__random:random};
  const context=vm.createContext(sandbox);const run=code=>vm.runInContext(code,context);run('window=this;Math.random=__random;');
  if(html){for(const m of fs.readFileSync(html,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1],{filename:html}).runInContext(context);}
  else for(const f of JSON.parse(fs.readFileSync((process.env.RR_GAME||'/Users/macbookair/game')+'/src/manifest.json')))new vm.Script(fs.readFileSync((process.env.RR_GAME||'/Users/macbookair/game')+'/src/'+f,'utf8'),{filename:f}).runInContext(context);
  const get=name=>run(name), keys=get('keys'),pressed=get('pressed');
  const keymap={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',fire:'KeyX',bomb:'KeyC',enter:'Enter',pause:'KeyP',quit:'KeyQ'};
  function input(actions=[]){for(const [name,key] of Object.entries(keymap)){const on=actions.includes(name);if(on&&!keys[key])pressed[key]=true;keys[key]=on;}}
  function step(n=1,actions=[],render=false){input(actions);for(let i=0;i<n;i++){get('update')();for(const k in pressed)delete pressed[k];if(render&&i%12===0)get('draw')();}}
  function start(level=4,x=100,hero=0,god=false){get('devStart')({level,x,hero,god});step(2);}
  function shot(file){get('draw')();fs.mkdirSync(file.replace(/[/][^/]*$/,'')||'.',{recursive:true});fs.writeFileSync(file,canvas.toBuffer('image/png'));}
  return {get,run,step,start,input,canvas,errors,warnings,shot,storage};
}
