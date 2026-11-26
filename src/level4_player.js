'use strict';
var L4 = L4 || {};
{
// Both water modes use the existing ride contract. No land-physics globals are replaced.
const bubbleColor = '#b8faff';
function puff(x, y, n = 6) {
  for (let i = 0; i < n; i++) G.parts.push({x, y, vx: rand(-1,1), vy: rand(-1.7,-.3), life: 28, max: 28, size: 1.5, c: bubbleColor});
}
L4.bubbles = puff;
L4.pulse = function(x, y, radius, damage) {
  G.rings.push({x,y,r:radius,t:0,max:22}); puff(x,y,14); L4SND.play('boom',{fb:()=>Snd.tone('sine',180,60,.18,.13)});
  for(const e of G.enemies) if(e.active&&!e.dead&&!offStage(e)&&distToBox(x,y,ebox(e))<radius) damageEnemy(e,damage);
  for(const o of G.pows) if(o.state==='tied'&&distToBox(x,y,powBox(o))<radius) freePow(o);
  for(const b of G.eb) if(Math.hypot(b.x-x,b.y-y)<radius) b.life=0;
};
function shot(p, sub) {
  const x = p.x + p.facing * (sub ? 34 : 23), y = p.y - (sub ? 17 : 14);
  const power = p.oceanPower > 0;
  for(const spread of power ? [-.13,0,.13] : [0]) G.pb.push({x,y,vx:p.facing*5.2,vy:spread*5.2,dmg:sub?2:1,life:95,
    draw(b){ctx.strokeStyle=bubbleColor;ctx.lineWidth=1;ctx.beginPath();ctx.arc(Math.round(b.x),Math.round(b.y),sub?4:3,0,Math.PI*2);ctx.stroke();R(b.x-1,b.y-2,2,1,'#ffffff');},
    onHit(b,e){damageEnemy(e,b.dmg);puff(b.x,b.y,3);}
  });
  p.muzzle=5;p.fireCd=sub?12:14;
  L4SND.play('bubble',{rate:sub?.8:1.1,vol:sub?1:.8,fb:()=>Snd.tone('sine',sub?390:640,130,.07,.065)});
}
function torpedo(p,sub) {
  p.bombs--;
  G.pb.push({x:p.x+p.facing*(sub?35:22),y:p.y-(sub?17:14),vx:p.facing*3.8,vy:0,dmg:8,life:100,oceanTorpedo:true,
    draw(b){const x=Math.round(b.x),y=Math.round(b.y);RO(x-6,y-3,12,6,'#ffcf57');R(x-4,y-2,7,1,'#fff5c3');puffDraw(x-Math.sign(b.vx)*9,y);},
    onHit(b){L4.pulse(b.x,b.y,42,8);},onGround(b){L4.pulse(b.x,b.y,42,8);},
    update(b){if(b.life===1)L4.pulse(b.x,b.y,42,8);}
  });
  L4SND.play('torpedo',{fb:()=>Snd.tone('triangle',260,80,.2,.12)});
}
function puffDraw(x,y){R(x-2,y,3,2,'#defcff');R(x-5,y+1,2,1,'#6edfe7');}
function enterPressed(p){return !G.intro && pressed.Enter && !(p.oceanEnterCd>0);}
function park(p){
  const ride=p.ride;
  const o=makeProp({k:'oceansub',x:p.x,y:p.y,hp:ride.hp});
  G.props.push(o); L4SND.play('hatch',{rate:1.15,vol:.8}); L4.attach(p); p.x+=p.facing*43;p.oceanEnterCd=22; p.inv=Math.max(p.inv,45);
  G.texts.push({x:p.x,y:p.y-40,s:'SWIMMING!',t:65,c:'#b8faff'});
}
function waterMove(p, sub){
  let dx=(ctl('right')?1:0)-(ctl('left')?1:0),dy=(ctl('down')?1:0)-(ctl('up')?1:0);
  const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}
  if(dx)p.facing=dx<0?-1:1;
  const speed=sub?2.5:1.9;
  p.vx+=(dx*speed-p.vx)*.24;p.vy+=(dy*speed-p.vy)*.24;
  if(!dx&&Math.abs(p.vx)<.015)p.vx=0;
  if(!dy&&Math.abs(p.vy)<.015)p.vy=0;
  if(p.kb){p.vx+=p.kb*.15;p.kb*=.82;if(Math.abs(p.kb)<.1)p.kb=0;}
  p.x+=p.vx;p.y+=p.vy;
  const min=sub?72:62,max=groundAt(p.x)-(sub?5:3);
  const ny=clamp(p.y,min,max);if(ny!==p.y)p.vy=0;p.y=ny;
  p.onGround=false;p.onPlat=null;p.crouch=false;p.aim='fwd';
  p.oceanEnterCd=Math.max(0,(p.oceanEnterCd||0)-1);
  if(p.oceanPower>0)p.oceanPower--;
  p.fireCd=Math.max(0,p.fireCd-1);p.muzzle=Math.max(0,p.muzzle-1);
  if(ctl('fire')&&p.fireCd===0)shot(p,sub);
  if(ctlTap('bomb')&&p.bombs>0&&G.pb.filter(b=>b.oceanTorpedo).length<2)torpedo(p,sub);
  if(p.t%12===0)puff(p.x-p.facing*(sub?34:5),p.y-(sub?15:25),1);
}
L4.attach=function(p){boardRide(p,{type:'scuba'});p.oceanEnterCd=0;p.y=clamp(p.y,72,groundAt(p.x)-6);};
L4.playerLoad=function(){L4.attach(G.p);G.p.y=155;};
L4.playerUpdate=function(){
  const p=G.p;if(!p.dead&&!p.ride){L4.attach(p);p.y=clamp(p.y,82,210);}
};
function hud(p,sub,r){
  text(sub?'MINI SUB':'BUBBLE GUN',132,8,'#b8faff');
  if(sub){for(let i=0;i<4;i++)R(133+i*9,20,6,4,i<r.hp?'#ffe066':'#34485d');}
  else {text(p.oceanPower>0?'3-WAY':'AIR',132,20,p.oceanPower>0?'#ffe066':'#8cdadf');}
  text('C:'+p.bombs,225,20,'#ffffff',1,'right');
}
RIDES.scuba={
  help:'ENTER: BOARD NEAR A SUBMARINE',
  box:p=>({x:p.x-15,y:p.y-26,w:32,h:24}),
  update(p){waterMove(p,false);if(enterPressed(p)){
    const o=G.props.find(o=>o.k==='oceansub'&&!o.dead&&Math.hypot(o.x-p.x,o.y-p.y)<62);
    if(o){o.dead=true;boardRide(p,{type:'minisub',hp:o.hp});p.x=o.x;p.y=o.y;p.oceanEnterCd=22;p.inv=Math.max(p.inv,45);puff(p.x,p.y-12,8);L4SND.play('hatch',{fb:()=>Snd.select()});}
  }},
  hurt(p,r){p.ride=null;hurtPlayer();if(!p.dead)p.ride=r;},
  draw(p){if(p.hidden||p.inv>0&&Math.floor(p.inv/3)%2)return;L4.drawDiver(p);},
  hud(){hud(G.p,false);}
};
RIDES.minisub={
  help:'ENTER: LEAVE THE SUBMARINE',
  box:p=>({x:p.x-29,y:p.y-33,w:58,h:32}),
  update(p){waterMove(p,true);if(enterPressed(p))park(p);},
  hurt(p,r){r.hp--;p.inv=100;G.shake=Math.max(G.shake,4);puff(p.x,p.y-15,12);Snd.clank();if(r.hp<=0){L4SND.play('boom',{vol:.7,rate:1.2});L4.attach(p);p.inv=180;p.oceanEnterCd=30;G.texts.push({x:p.x,y:p.y-42,s:'SWIM ON!',t:100,c:'#ffe066'});}},
  draw(p,r){if(p.hidden||p.inv>0&&Math.floor(p.inv/3)%2)return;L4.drawSub(p.x,p.y,p.facing,r.hp,G.hero,p.t);},
  hud(r){hud(G.p,true,r);}
};
PROP_TYPES.oceansub={
  make(o,s){o.hp=s.hp??4;o.facing=1;},box(){return null;},hit(){},
  draw(o){L4.drawSub(o.x,o.y+Math.sin(G.t*.035)*1.2,1,o.hp,null,G.t);if(!G.intro&&G.p?.ride?.type==='scuba'&&Math.hypot(G.p.x-o.x,G.p.y-o.y)<84){text('ENTER: PILOT',o.x,o.y-48,'#ffe066',1,'center');}}
};
ITEMS.oceanPearl={
  draw(it){ctx.fillStyle='#e6faff';circ(Math.round(it.x),Math.round(it.y)-7,5);R(it.x-2,it.y-10,3,2,'#ffffff');ctx.strokeStyle='#60cbdc';ctx.stroke();},
  collect(it,p){p.oceanPower=1200;addScore(250,it.x,it.y-20);G.texts.push({x:it.x,y:it.y-32,s:'TRIPLE BUBBLES!',t:85,c:'#b8faff'});}
};
ITEMS.oceanCharge={draw:it=>{letterBox({...it,k:'C'},'#297b9f','#8be7ed','#ffffff');},collect(it,p){p.bombs=Math.min(30,p.bombs+8);G.texts.push({x:it.x,y:it.y-24,s:'+8 TORPEDOES',t:75,c:'#ffe066'});}};
}
