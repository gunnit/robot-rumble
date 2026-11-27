(function(){const ev=[];let sec=-1,lk=new Set(),kills={},start={};
const _k=killEnemy;killEnemy=function(e){kills[e.type]=(kills[e.type]||0)+1;return _k.apply(this,arguments)};
const _u=update;update=function(){const r=_u.apply(this,arguments);if(G.state==='play'&&G.locks){const t=(G.time/60).toFixed(1);
if(G.section!==sec){sec=G.section;ev.push('S'+sec+'@'+t);}
for(const l of G.locks){if(l.active&&!start[l.at]){start[l.at]=G.time;}if(l.done&&start[l.at]&&!lk.has(l.at)){lk.add(l.at);ev.push('L'+l.at+(l.boss?'B':'')+':'+((G.time-start[l.at])/60).toFixed(1)+'s');}}
if(G.winT&&!ev.win){ev.win=1;const b=G.locks.find(l=>l.boss&&start[l.at]);ev.push('WIN@'+t+(b?' bossfight '+((G.time-start[b.at])/60).toFixed(1)+'s':''));console.warn('PROBE'+JSON.stringify({ev,kills}));}}return r};
})();
