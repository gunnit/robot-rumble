(function(){const out=[];const _h=hurtPlayer;hurtPlayer=function(){const p=G.p;if(p&&!p.inv&&!p.dead&&!dbg.god){
const near=G.enemies.filter(e=>!e.dead&&e.active).map(e=>({t:e.type,s:e.state,d:Math.round(Math.hypot(e.x-p.x,e.y-p.y))})).sort((a,b)=>a.d-b.d).slice(0,2);
const shots=G.eb.filter(b=>Math.hypot(b.x-p.x,b.y-(p.y-15))<30).map(b=>b.k||(b.owner&&b.owner.type)||'?');
out.push(Math.round(p.x)+' '+(G.time/60).toFixed(1)+' near:'+near.map(n=>n.t+'/'+n.s+'@'+n.d).join(',')+' shots:'+shots.join(','));}
return _h.apply(this,arguments)};
const _w=toWin;toWin=function(){console.warn('HURT'+JSON.stringify(out));return _w.apply(this,arguments)};})();
