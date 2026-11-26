'use strict';

// The signal travels from a handbell to the quay, a pair of optical mirrors,
// and the grounding coils. Each machine remembers its setting for this run.
const L7Signal = (() => {
  const ink='#152939', brass='#c79055', gold='#ffe3a0', white='#f5fff2';
  const mint='#88f0d6', sea='#397e80', coral='#ef896d', violet='#b1b4f9';
  const gateXs=[478,5904,7940];
  const trainingBuoy=617;
  const fanXs=[1870,2390,2720];
  const mirrors=[{x:5744,y:171},{x:5840,y:123}];
  const rods=[7800,7880];
  const squalls=[7235,7470,7666,7800,7880,8260,8500];
  let run, quay, aligned, mirrorsAt, grounded, cooldown, waves, opened, fans, response, responseTime;
  let player, charge, sentPractice, learnedReturn;

  function stroke(x,y,x2,y2,color,width=1) {
    ctx.beginPath();ctx.moveTo(Math.round(x)+.5,Math.round(y)+.5);
    ctx.lineTo(Math.round(x2)+.5,Math.round(y2)+.5);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  function diamond(x,y,r,color) {
    x=Math.round(x);y=Math.round(y);
    for(let row=-r;row<=r;row++) R(x-r+Math.abs(row),y+row,r*2+1-Math.abs(row)*2,1,color);
  }
  function bell(x,y,t,color=gold) {
    x=Math.round(x);y=Math.round(y);
    RO(x-2,y-7,4,3,brass);RO(x-4,y-4,8,5,color);R(x-3,y-3,2,3,white);
    RO(x-6,y+1,12,2,brass);R(x-5,y+1,10,1,color);
    R(x+(t%24<12?0:1)-1,y+4,3,2,gold);
  }
  function load(cp) {
    if(run!==G.freed) {
      run=G.freed;quay=cp>gateXs[0];aligned=cp>gateXs[1];mirrorsAt=aligned?[2,1]:[0,0];
      grounded=new Set(cp>gateXs[2]?rods:[]);charge=0;
      sentPractice=cp>trainingBuoy;learnedReturn=false;
    }
    waves=[];cooldown=0;fans=new Map();opened=gateXs.map((_,i)=>isOpen(i)?1:0);
    response='';responseTime=0;player=G.p;equip();
  }
  function equip(){G.p.weapon='signalgun';G.p.ammo=Infinity;}
  function note(s){response=s;responseTime=110;}
  function notifyCharge(){charge=Math.min(3,charge+2);}
  function isOpen(i){return i===0?quay:i===1?aligned:rods.every(x=>grounded.has(x));}
  // A gust can take a few steps along a walkway, but cannot carry a hero into
  // a closed gate or an ungrounded lightning column. Voluntary movement is free.
  function limitWindStep(from,to){
    if(to>from){
      for(let i=0;i<gateXs.length;i++){
        const edge=gateXs[i]-11;
        if(!isOpen(i)&&from<=edge)to=Math.min(to,edge);
      }
    }
    for(const x of squalls){
      if(grounded.has(x))continue;
      if(from<x&&to>from)to=Math.min(to,Math.max(from,x-19));
      if(from>x&&to<from)to=Math.max(to,Math.min(from,x+19));
    }
    return to;
  }
  // Progress is physically bounded at each unpowered gate. All controls needed
  // to open it are inside the camera's remaining walkable area at that limit.
  function update(){
    if(G.intro||G.winT||G.state!=='play')return;
    const p=G.p;
    if(p!==player){player=p;equip();}
    if(responseTime>0)responseTime--;
    if(cooldown>0)cooldown--;
    waves=waves.filter(w=>++w.age<26);
    for(const [x,t] of fans) if(t>0)fans.set(x,t-1);
    for(let i=0;i<gateXs.length;i++){
      if(isOpen(i)){opened[i]=Math.min(1,opened[i]+.048);continue;}
      if(!p.dead&&p.x>=gateXs[i]-11&&G.cam.x<gateXs[i]){p.x=gateXs[i]-11;p.kb=0;}
    }
    if(quay && !sentPractice && !learnedReturn && !p.dead && !cooldown && p.x>=461 && p.x<trainingBuoy+60){
      sentPractice=true;
      G.eb.push({k:'l7BellReply',x:trainingBuoy,y:groundAt(trainingBuoy)-47,vx:0,vy:0,life:240});
      Snd.tone('sine',494,494,.3,.075);
    }
    if(!p.dead&&!p.ride){
      for(const x of squalls){
        if(grounded.has(x))continue;
        const phase=stormPhase(x);
        if(phase>=130&&phase<142&&Math.abs(p.x-x)<13&&p.y>99)hurtPlayer();
      }
    }
  }
  function stormPhase(x){return (G.time+Math.round(x*.27))%184;}
  function nearestMirror(x){return Math.abs(mirrors[0].x-x)<Math.abs(mirrors[1].x-x)?0:1;}
  function operate(x,y) {
    if(!quay&&Math.abs(x-418)<92){
      quay=true;note('QUAY LIT  /  THE FLEET HEARS YOU');notifyCharge();
      sparks(418,groundAt(418)-49,12,gold);Snd.tone('sine',523,523,.35,.09,.13);
    }
    for(const fx of fanXs) if(Math.abs(x-fx)<55 && Math.abs(y-groundAt(fx)+22)<90){
      fans.set(fx,60);G.p.vy=-7.8;G.p.onGround=false;G.p.onPlat=null;
      // The regular jump-release limiter would cut a bell updraft at its first frame.
      G.p.bellLift=23;note('UPDRAFT  /  STEER ONTO THE HIGH PATH');
      Snd.tone('sine',280,750,.3,.08);
    }
    if(!aligned){
      const i=nearestMirror(x),m=mirrors[i];
      if(Math.abs(x-m.x)<=54 && Math.abs(y-m.y)<=118){
        mirrorsAt[i]=(mirrorsAt[i]+1)%3;
        const hit=mirrorsAt[0]===2;
        aligned=hit&&mirrorsAt[1]===1;
        Snd.tone('sine',440*(1+i*.4),660*(1+i*.4),.3,.08);sparks(m.x,m.y,8,mint);
        if(aligned){note('LENS ALIGNED  /  THE LIGHT REACHES THE TOWER');notifyCharge();}
        else if(i===0)note(hit?'MIRROR I ALIGNED  /  GO RIGHT TO II':'MIRROR I TURNED');
        else note('MIRROR II TURNED');
      }
    }
    const rod=squalls.filter(rx=>!grounded.has(rx)&&Math.abs(rx-x)<=83).sort((a,b)=>Math.abs(a-x)-Math.abs(b-x))[0];
    if(rod!=null){
      const phase=stormPhase(rod);
      // The paired door coils retain their charge. Field coils must be caught whilst humming.
      if(rods.includes(rod)||phase>=82&&phase<153){
        grounded.add(rod);notifyCharge();sparks(rod,groundAt(rod)-40,12,mint);
        note(isOpen(2)&&rods.includes(rod)?'STORM ENGINE GROUNDED':rods.includes(rod)?'ONE COIL GROUNDED  /  RING THE OTHER':'LIGHTNING CAUGHT  /  LAMP CHARGED');
      } else note('RING WHEN THE COIL STARTS TO GLOW');
    }
    // The bell also loosens the matching brass clasps on the keepers' rescue pods.
    for(const o of G.pows)if(o.state==='tied'&&Math.hypot(o.x-x,o.y-15-y)<86)freePow(o);
  }
  function beforePlayerUpdate(){
    const p=G.p;
    if(G.intro||G.winT||p.dead||G.state!=='play')return;
    if(p.bellLift>0){
      // Add lift even when Z is released; horizontal steering stays with the player.
      p.bellLift--;p.y-=Math.min(3.25,p.bellLift*.38);
      if(p.bellLift>7){p.vy=-2.6;p.onGround=false;p.onPlat=null;}
    }
    if(cooldown||!(pressed.KeyV||pressed.KeyB))return;
    const x=p.x,y=p.y-(p.crouch?12:19);
    cooldown=50;waves.push({x,y,age:0});Snd.tone('sine',659,650,.46,.12);
    Snd.tone('triangle',988,974,.32,.055);Snd.tone('sine',1320,1270,.44,.035);
    const hit=L7Foes.ring(x,y);
    if(hit.reflected)learnedReturn=true;
    if(hit.reflected||hit.stunned){notifyCharge();note(hit.reflected?'RETURN TO SENDER  /  LAMP CHARGED':'STORM INTERRUPTED  /  LAMP CHARGED');}
    if(p.ride)L7Skiff.ring(x,y);else operate(x,y);
  }
  // An answering buoy introduces the same range, timing and lamp charge used
  // in battle. A missed practice spark burns out just before it touches the hero.
  EB_TYPES.l7BellReply={
    r:3,
    update(b){
      const p=G.p, target=pbox(p);
      const dx=p.x-b.x,dy=target.y+target.h/2-b.y;
      const distance=Math.hypot(dx,dy)||1;
      b.vx=dx/distance*1.9;b.vy=dy/distance*1.9;
      if(p.dead||distToBox(b.x+b.vx,b.y+b.vy,target)<12){
        b.life=0;sparks(b.x,b.y,5,gold);
      }
    },
    draw(b){EB_TYPES.l7Spark.draw(b);},
    returnToSender(b){
      const tx=trainingBuoy,ty=groundAt(tx)-47;
      const a=Math.atan2(ty-b.y,tx-b.x);
      // The return is a visual signal. It cannot hit foes, free prisoners or award score.
      G.parts.push({type:'debris',x:b.x,y:b.y,vx:Math.cos(a)*4,vy:Math.sin(a)*4,g:0,
        life:Math.max(1,Math.ceil(Math.hypot(tx-b.x,ty-b.y)/4)),max:60,size:3,c:mint});
      sparks(b.x,b.y,7,mint);
      Snd.tone('triangle',784,988,.22,.08);
    }
  };
  function ghostBeam(x,y,x2,y2,live){
    stroke(x,y,x2,y2,live?'rgba(102,250,210,.15)':'rgba(111,194,190,.16)',live?7:1);
    if(live){
      stroke(x,y,x2,y2,mint,2);
      const t=(G.t%44)/44;diamond(x+(x2-x)*t,y+(y2-y)*t,2,white);
    }
  }
  function optics(){
    const a=mirrors[0],b=mirrors[1],end={x:5892,y:161};
    ghostBeam(5635,a.y,a.x,a.y,true);
    ghostBeam(a.x,a.y,b.x,b.y,false);ghostBeam(b.x,b.y,end.x,end.y,false);
    const targetA=[{x:a.x+56,y:216},{x:b.x,y:a.y},b][mirrorsAt[0]];
    ghostBeam(a.x,a.y,targetA.x,targetA.y,true);
    if(mirrorsAt[0]===2){const targetB=[{x:end.x,y:90},end,{x:end.x,y:b.y}][mirrorsAt[1]];ghostBeam(b.x,b.y,targetB.x,targetB.y,true);}
    for(let i=0;i<2;i++){
      const m=mirrors[i],gy=Math.round(groundAt(m.x));
      RO(m.x-5,m.y+10,10,gy-m.y-10,'#334552');R(m.x-4,m.y+11,2,gy-m.y-14,'#8d8f8b');
      for(let k=m.y+17;k<gy-3;k+=12)R(m.x-5,k,11,2,brass);
      diamond(m.x,m.y,12,ink);diamond(m.x,m.y,10,brass);diamond(m.x,m.y,8,'#254653');
      const tilt=[-5,0,5][mirrorsAt[i]];
      stroke(m.x-6,m.y+tilt,m.x+6,m.y-tilt,white,3);
      RO(m.x-11,gy-8,22,7,sea);text(i?'II':'I',m.x,gy-8,gold,1,'center');
    }
    for(const [x,y] of [[5635,a.y],[end.x,end.y]]){
      const gy=groundAt(x);RO(x-3,y+6,6,gy-y-6,'#405562');diamond(x,y,9,brass);
      diamond(x,y,6,(aligned||x===5635)?mint:'#576778');diamond(x,y,2,white);
    }
  }
  function fan(x) {
    const gy=Math.round(groundAt(x)),on=fans.get(x)>0,t=G.t;
    RO(x-18,gy-5,36,5,ink);R(x-14,gy-5,28,2,sea);
    for(let k=0;k<5;k++)R(x-12+k*6,gy-4,3,3,mint);
    for(let k=0;k<(on?13:5);k++){
      const h=(t*(on?1.9:.54)+k*10)%(on?83:32);
      const dx=Math.sin(k*1.8+h*.065)*13;R(Math.round(x+dx),Math.round(gy-6-h),on?3:2,2,on?white:mint);
    }
    R(x-1,gy-11,3,5,gold);R(x-3,gy-9,7,2,gold);R(x,gy-13,1,2,white);
  }
  function coil(x) {
    const gy=Math.round(groundAt(x)),cy=gy-42,phase=stormPhase(x);
    const off=grounded.has(x),ready=rods.includes(x),hot=!off&&phase>=82&&phase<143;
    const lit=off?mint:hot?gold:ready?coral:violet;
    RO(x-5,cy+6,10,36,'#344752');R(x-3,cy+7,2,34,'#779797');
    for(let j=0;j<4;j++){RO(x-8,cy+9+7*j,16,3,brass);R(x-7,cy+9+7*j,12,1,'#e5bc78');}
    diamond(x,cy,8,ink);diamond(x,cy,6,off?sea:'#66658b');diamond(x,cy,3,lit);
    if(off){R(x-3,cy,2,2,white);R(x-1,cy+2,2,2,white);R(x+1,cy-1,2,3,white);return;}
    if(hot&&phase<130){
      for(let yy=62;yy<cy;yy+=12)R(x,yy+(phase%7),1,4,'#f8aa85');
      const n=Math.floor((phase-82)/12);for(let i=0;i<=n;i++)R(x-8+i*5,gy-3,4,2,gold);
    }else if(hot){
      let xx=x;
      for(let yy=48;yy<gy;yy+=12){const nx=x+Math.sin(yy*2+G.t*.8)*6;stroke(xx,yy,nx,yy+12,violet,5);stroke(xx,yy,nx,yy+12,white,2);xx=nx;}
    }
  }
  function barrier(x,i){
    const gy=Math.round(groundAt(x)),lift=opened[i],col=isOpen(i)?mint:coral;
    RO(x-3,gy-76,8,76,'#394d58');R(x-2,gy-75,2,71,brass);RO(x-13,gy-79,25,5,brass);
    ctx.save();ctx.beginPath();ctx.rect(x-13,gy-74,24,74);ctx.clip();
    const top=gy-74-lift*75;
    for(let j=0;j<7;j++){RO(x-11,top+j*11,17,7,'#547077');R(x-9,top+j*11,11,2,'#9db0a2');R(x+1,top+j*11+1,3,4,brass);}
    ctx.restore();diamond(x,gy-82,5,ink);diamond(x,gy-82,3,col);
  }
  function label(x,y,s){
    const w=s.length*6+10;R(x-w/2,y-3,w,13,'#162c39');R(x-w/2,y-3,w,1,brass);text(s,x,y,gold,1,'center',null);
  }
  function drawWorld(cam){
    const vis=(x,m=42)=>x>cam-m&&x<cam+W+m;
    if(vis(418)){
      const gy=groundAt(418);RO(414,gy-52,8,52,'#334957');R(415,gy-49,2,46,brass);
      RO(407,gy-53,22,4,brass);bell(418,gy-61,G.t,quay?mint:gold);
      if(!quay&&Math.abs(G.p.x-418)<94)label(418,gy-85,'V  RING');
    }
    if(vis(trainingBuoy)){
      const x=trainingBuoy,y=Math.round(groundAt(x)),light=learnedReturn?mint:gold;
      RO(x-4,y-43,8,43,sea);R(x-3,y-40,2,37,brass);
      RO(x-8,y-5,16,4,brass);RO(x-9,y-44,18,4,brass);
      diamond(x,y-47,8,ink);diamond(x,y-47,6,brass);diamond(x,y-47,3,light);
      R(x-1,y-48,2,2,white);
    }
    for(const x of fanXs)if(vis(x))fan(x);
    if(cam+W>5618&&cam<5930)optics();
    for(const x of squalls)if(vis(x))coil(x);
    for(let i=0;i<gateXs.length;i++)if(vis(gateXs[i]))barrier(gateXs[i],i);
  }
  function drawPulse(cam){
    for(const w of waves){
      const p=w.age/26,rad=7+94*(1-(1-p)*(1-p));
      ctx.save();ctx.globalAlpha=(1-p)*.85;
      for(let i=0;i<14;i++){const a=i*Math.PI/7;ctx.beginPath();ctx.arc(Math.round(w.x-cam),Math.round(w.y),rad,a,a+.27);ctx.strokeStyle=i%2?gold:mint;ctx.lineWidth=i%2?1:2;ctx.stroke();}
      ctx.restore();
    }
  }
  function hint(){
    const x=G.p.x;
    if(!quay&&x>266&&x<490)return 'AT THE BRASS BELL, PRESS V TO OPEN THE QUAY';
    if(!aligned&&x>5540&&x<5920){
      const nearest=nearestMirror(x);
      if(Math.abs(x-mirrors[nearest].x)<=54){
        const firstAligned=mirrorsAt[0]===2;
        if(nearest===0&&firstAligned)return 'MIRROR I ALIGNED  /  GO RIGHT TO II';
        if(cooldown){
          if(responseTime&&response==='MIRROR I TURNED')return 'MIRROR I TURNED  /  BELL RECHARGING';
          if(responseTime&&response==='MIRROR II TURNED')return 'MIRROR II TURNED  /  BELL RECHARGING';
          return 'BELL RECHARGING';
        }
        if(nearest===0)return 'TAP V TO AIM THIS BEAM AT MIRROR II';
        return firstAligned?'TAP V TO AIM THIS BEAM AT THE DIAMOND':'GO LEFT AND ALIGN MIRROR I FIRST';
      }
      return 'STAND AT EACH MIRROR AND RING TO TURN IT';
    }
    if(!isOpen(2)&&x>7720&&x<7945){
      if(rods.some(rx=>grounded.has(rx))){
        if(cooldown)return '1 / 2 COILS GROUNDED  /  BELL RECHARGING';
        return grounded.has(rods[0])?'1 / 2 GROUNDED  /  RING THE RIGHT COIL':'1 / 2 GROUNDED  /  RING THE LEFT COIL';
      }
      return cooldown?'BELL RECHARGING':'RING V BESIDE EACH COPPER COIL';
    }
    if(!learnedReturn&&G.section===0&&!G.p.dead){
      const py=G.p.y-(G.p.crouch?12:19);
      const shot=G.eb.find(b=>b.life>0 && (b.k==='l7BellReply'||b.k==='l7Spark') && Math.hypot(x-b.x,py-b.y)<190);
      if(shot){
        if(cooldown)return 'BELL RECHARGING';
        return Math.hypot(x-shot.x,py-shot.y)<=94?'V NOW  /  SEND THE SPARK BACK':'LET THE SPARK COME CLOSE. THEN RING V.';
      }
    }
    if(responseTime>0)return response;
    if(fanXs.some(f=>Math.abs(x-f)<58))return 'V  CATCH THE UPDRAFT';
    if(x>7080&&x<7420)return 'WATCH FOR THE DOTTED LINE BEFORE LIGHTNING STRIKES';
    return '';
  }
  function gauge(x,y){
    bell(x+8,y+8,G.t,cooldown?brass:gold);
    text('V BELL',x+21,y+1,cooldown?'#adbdc1':mint);
    R(x+21,y+13,39,3,'#45565e');R(x+21,y+13,Math.round(39*(1-cooldown/50)),3,cooldown?brass:mint);
    for(let k=0;k<3;k++)diamond(x+25+k*14,y+20,2,k<charge?white:'#536575');
  }

  function gun(x,y){
    RO(x,y,15,5,'#516e75');R(x+1,y,11,1,'#c8cbac');R(x+2,y+2,7,2,sea);
    RO(x+14,y-1,5,7,brass);R(x+17,y,2,5,charge?white:mint);
    R(x+2,y+5,4,3,'#80614b');R(x+8,y-2,3,2,gold);
  }
  WEAPONS.signalgun={
    label:'LAMP GUN',ammo:Infinity,maxAmmo:Infinity,cd:12,tapCd:3,
    muzzle:a=>a==='up'?[5,-40]:a==='down'?[1,2]:[24,-19],
    icon(x,y){gun(x,y+1);},
    drawGun(aim,ty,r){ctx.save();ctx.translate(aim==='up'?4:aim==='down'?1:4-r,ty+(aim==='up'?-2:aim==='down'?8:1));
      if(aim!=='fwd')ctx.rotate(aim==='up'?-Math.PI/2:Math.PI/2);gun(0,-2);ctx.restore();},
    fire(p,x,y,dx,dy){
      const bright=charge>0;if(bright)charge--;
      G.pb.push({x,y,vx:dx*7.2,vy:dy*7.2,dmg:bright?4:2,pierce:bright,life:75,
        onHit(b,e){
          if(e.type==='prismSnail'&&ENEMY_TYPES.prismSnail.catchLight(e,b))return;
          damageEnemy(e,b.dmg);sparks(b.x,b.y);
        },
        draw(b){const ax=Math.round(b.x),ay=Math.round(b.y);stroke(ax-dx*8,ay-dy*8,ax,ay,bright?gold:mint,bright?3:2);
          diamond(ax,ay,bright?3:2,white);}});
      Snd.tone('triangle',bright?920:710,bright?440:310,.12,.075);
    }
  };
  return {load,beforePlayerUpdate,update,drawWorld,drawPulse,gauge,hint,bell,diamond,
    limitWindStep,ready(){return cooldown===0;},
    status(){return {quay,aligned,coils:rods.filter(x=>grounded.has(x)).length,charge,cooldown,angles:mirrorsAt.slice()};}};
})();
