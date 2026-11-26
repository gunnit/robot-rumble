import fs from 'node:fs';
import {boot} from '../mission4/runtime.mjs';
const hero=+(process.argv[2]||0),seed=+(process.argv[3]||1),useSub=process.argv[4]==='sub';
const e=boot(seed,process.env.RR_HTML||null),g=e.get,G=g('G');
g('devStart')({level:4,hero});const hits=[0,0,0,0];g('dbg').onHurt=i=>{if(G.p.ride?.type!=='scuba')hits[i]++;};
let frames=0,boarded=false,seenModes=new Set(),lastDead=0,deaths=0,sections=new Set(),shots=0;
const start=Date.now();
for(;frames<45000&&G.state!=='win';frames++){
  const p=G.p;seenModes.add(p.ride?.type||'dead');sections.add(G.section);
  if(p.dead&&!lastDead)deaths++;lastDead=p.dead;
  if(G.state==='over'){e.step(1,frames%2?['enter']:[]);continue;}
  if(G.intro){e.step(1,frames%2?['enter']:[]);continue;}
  const actions=['fire'];
  const parked=useSub&&!boarded&&G.props.find(o=>o.k==='oceansub'&&!o.dead&&o.x>=G.cam.x&&o.x<G.cam.x+480);
  if(parked){
    if(Math.abs(parked.x-p.x)>18)actions.push(parked.x>p.x?'right':'left');
    if(Math.abs(parked.y-p.y)>6)actions.push(parked.y>p.y?'down':'up');
    if(Math.hypot(p.x-parked.x,p.y-parked.y)<40)actions.push('enter');
  }else{
    const enemies=G.enemies.filter(a=>a.active&&!a.dead&&!g('offStage')(a)&&a.x>G.cam.x-5&&a.x<G.cam.x+480).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x));
    const rescue=G.pows.find(o=>o.state==='tied'&&o.x>G.cam.x+20&&o.x<p.x+160);
    let target=enemies[0];
    if(rescue&&(!target||Math.abs(target.x-p.x)>120))target=rescue;
    let ty=155;
    if(target){
      const b=target.kind?g('powBox')(target):g('ebox')(target);
      ty=b.y+b.h/2+14;
      const dx=target.x-p.x;
      if(Math.abs(dx)>140)actions.push(dx>0?'right':'left');
      else if(Math.sign(dx)!==p.facing)actions.push(dx>0?'right':'left');
      if(process.env.DODGE&&target.type==='megaoctopus'&&target.state==='tell'&&target.cycle===1)ty=target.targetY>140?80:214;
      if(target.type&&frames%170===0)actions.push('bomb');
    }else actions.push('right');
    // Dodge only an imminent projectile crossing; navigation and shooting use normal controls.
    const threat=process.env.DODGE?G.eb.find(b=>Math.abs(b.x-p.x)<45&&Math.abs(b.y-(p.y-14))<16&&b.vx*(p.x-b.x)>0):null;
    if(threat)ty=p.y>150?p.y-36:p.y+36;
    if(Math.abs(ty-p.y)>5)actions.push(ty>p.y?'down':'up');
  }
  e.step(1,actions,frames%8===0);
  if(p.ride?.type==='minisub')boarded=true;
  if(e.errors.length)break;
}
const result={hits,lives:3-G.lives,completed:G.state==='win',hero,seed,useSub,boarded,frames,seconds:+(G.time/60).toFixed(1),deaths,continues:G.continues,freed:G.freed.size,sections:[...sections],modes:[...seenModes],score:G.score,x:G.p.x,errors:e.errors,warnings:e.warnings,wallSeconds:(Date.now()-start)/1000};
console.log(JSON.stringify(result,null,2));
if(!result.completed||result.errors.length||result.warnings.length)process.exitCode=1;
