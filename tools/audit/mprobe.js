(function(){let last='';const log=[];const _u=update;update=function(){const r=_u.apply(this,arguments);
const m=G.enemies&&G.enemies.find(e=>(e.type===(globalThis.BOSS||'stormManta'))&&!e.dead);
if(m){const s=m.state+'/'+(m.attack||'')+' hp'+m.hp;const k=m.state+(m.attack||'');if(k!==last){last=k;log.push(((G.time/60).toFixed(1))+' '+s);}}
if(G.winT&&!log.done){log.done=1;console.warn('MP'+JSON.stringify(log));}return r};
const _d=damageEnemy;damageEnemy=function(e,d){if(e.type===(globalThis.BOSS||'stormManta')){globalThis.DMG=(globalThis.DMG||{});globalThis.DMG[d]=(globalThis.DMG[d]||0)+1;}return _d.apply(this,arguments)};
const _w=toWin;toWin=function(){console.warn('DMG'+JSON.stringify(globalThis.DMG));return _w.apply(this,arguments)};})();
