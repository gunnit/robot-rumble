'use strict';

// The high roost passage, the forge steam circuit, and its two physical relays.
const CaveWorks6 = (() => {
  const iron='#444257', dark='#282136', brass='#b68855', gold='#ffe3a1', aqua='#8eeedc';
  const bridgeStart=2224, bridgeEnd=2408, bridgeY=158;
  let run, bridgeOpen=false, bridgeWidth=0, bridgePlatform, furnaceOff=false, relayLock;
  const inView = (x, extra=35) => x+extra>=G.cam.x && x-extra<=G.cam.x+W;

  function gear(x,y,r,angle,color) {
    ctx.fillStyle=color; circ(x,y,r-2);
    for(let i=0;i<8;i++) {
      const a=angle+i*Math.PI/4;
      R(Math.round(x+Math.cos(a)*(r-2))-2,Math.round(y+Math.sin(a)*(r-2))-2,4,4,color);
    }
    R(x-2,y-2,5,5,dark); R(x,y-1,2,2,'#d8af82');
  }
  PROP_TYPES.roostWinch = {
    box: o => bridgeOpen ? null : {x:o.x-15,y:o.y-29,w:30,h:28},
    hit(o,d,source) {
      if(bridgeOpen || source==='enemy') return;
      bridgeOpen=true;
      G.texts.push({x:o.x+18,y:o.y-51,s:'SKYWAY OPEN!',t:100,c:gold});
      sparks(o.x,o.y-18,12,gold); Snd.tone('triangle',160,410,.32,.12);
      Snd.tone('sine',620,790,.20,.08,.18);
    },
    draw(o) {
      if(!inView(o.x,75))return;
      const x=Math.round(o.x),y=Math.round(o.y), col=bridgeOpen ? aqua : gold;
      RO(x-15,y-5,31,6,iron); RO(x-10,y-24,20,19,dark);
      gear(x,y-19,12,bridgeWidth*.085,brass);
      R(x-3,y-23,6,8,col); R(x-1,y-25,2,11,'#fffae0');
      if(!bridgeOpen && Math.abs(G.p.x-x)<164) text('SHOOT WINCH',x,y-44,gold,1,'center');
    }
  };

  function drawBridge(cam) {
    if(cam+W<bridgeStart-65 || cam>bridgeEnd+40)return;
    for(const x of [bridgeStart,bridgeEnd]) {
      RO(x-3,bridgeY-22,6,29,'#655065'); R(x-2,bridgeY-21,2,26,brass);
      gear(x,bridgeY-18,6,bridgeWidth*.13,brass);
    }
    if(bridgeWidth<1)return;
    const stop=bridgeStart+bridgeWidth;
    ctx.beginPath(); ctx.moveTo(bridgeStart,bridgeY-17);
    ctx.quadraticCurveTo(bridgeStart+bridgeWidth/2,bridgeY-8,stop,bridgeY-17);
    ctx.strokeStyle='#ae968c'; ctx.lineWidth=1; ctx.stroke();
    for(let x=bridgeStart+3;x<stop;x+=16) {
      const sag=Math.sin((x-bridgeStart)/bridgeWidth*Math.PI)*4;
      R(x,bridgeY-16+sag,1,16-sag,'#928681');
      R(x,bridgeY,Math.min(13,stop-x),3,'#bd946b'); R(x+1,bridgeY+3,Math.min(11,stop-x),3,'#5b4b57');
    }
  }

  ENEMY_TYPES.forgeRelay = {
    hp:5, contact:'none', armored:true, flying:false,
    make(e,s) { e.x=G.cam.x+s.offset; e.raised=s.raised||0; e.y=groundAt(e.x)-e.raised; },
    // The raised relay and the live conduit feeding it can both be shot.
    box:e=>({x:e.x-14,y:e.y-31,w:28,h:31+e.raised}),
    update() {},
    draw(e) {
      const x=Math.round(e.x), y=Math.round(e.y), floor=Math.round(groundAt(x));
      RO(x-13,y,26,floor-y+4,iron); R(x-11,y+1,3,floor-y+2,'#80696b');
      for (let j=y+8;j<floor;j+=8) R(x-12,j,24,2,dark);
      if(e.raised) {
        R(x-2,y+1,5,floor-y-2,'#a76250');
        R(x,y+1,2,floor-y-2,'#f3ba70');
        for(let j=y+4;j<floor-2;j+=9)R(x-3,j,7,2,gold);
      }
      RO(x-17,y-3,34,5,'#755c58');
      ctx.save(); ctx.translate(x,y-18);
      FLASH=e.hitT>0;
      RO(-13,-14,26,28,dark); R(-12,-14,24,2,brass); R(-12,11,24,2,brass);
      for(const sign of [-1,1]) { R(sign*10,-10,2,21,brass); R(sign*6,-7,2,14,'#e59763'); }
      const pulse=Math.sin(e.t*.09)>0?'#fff3ab':'#ffba72';
      R(-4,-6,8,12,pulse); R(-2,-10,4,20,pulse); R(-1,-5,2,10,'#fff9cf');
      FLASH=false; ctx.restore();
      text('RELAY',x,y-44,gold,1,'center');
    },
    onKill(e,x,y,b) {
      sparks(x,y,18,aqua); debris(x,y,7,brass); Snd.tone('sawtooth',225,58,.24,.08);
      addScore(250,x,b.y); G.shake=Math.max(2,G.shake);
    }
  };

  PROP_TYPES.forgeVent = {
    make(o) { o.clock=0; o.firing=false; },
    box:()=>null, hit(){},
    update(o) {
      o.firing=false;
      if(furnaceOff || !inView(o.x,70) || G.p.dead || G.intro || G.winT) return;
      o.clock=(o.clock+1)%216;
      if(o.clock===128) { Snd.noise(.10,.07,1360); }
      if(o.clock>=167 && o.clock<=197) {
        o.firing=true;
        if(o.clock===167) Snd.noise(.35,.12,1650);
        if(overlap(pbox(G.p),{x:o.x-11,y:o.y-35,w:22,h:34})) hurtPlayer();
      }
    },
    draw(o) {
      if(!inView(o.x))return;
      const x=Math.round(o.x),y=Math.round(o.y), warn=!furnaceOff && o.clock>=128 && o.clock<167;
      RO(x-16,y-4,32,4,iron); R(x-15,y-4,30,1,brass);
      for(let i=-12;i<=12;i+=5) R(x+i,y-3,2,2,furnaceOff?dark:warn?'#ffe7a5':'#a45d50');
      if(warn) {
        for(let i=0;i<3;i++) { const d=(o.clock+i*7)%16; R(x-6+i*6,y-8-d,2,3,'#d7b09b'); }
        if(Math.abs(G.p.x-x)<98)text('STEAM!',x,y-42,gold,1,'center');
      }
      if(o.firing) {
        ctx.save();
        for(let i=0;i<13;i++) {
          const h=(i*13+o.clock*2)%38, drift=Math.round(Math.sin(i+h*.16)*h*.11);
          ctx.globalAlpha=(1-h/49)*.87;
          R(x+(i%3-1)*5+drift-3,y-5-h,7+h*.11,4+h*.11,i%2?'#ffe3a2':'#d2e4dc');
        }
        ctx.restore();
      }
    }
  };

  function load() {
    if(run!==G.freed){run=G.freed; bridgeOpen=false; furnaceOff=false;}
    relayLock=G.locks.find(l=>l.objective==='relays');
    if(relayLock && furnaceOff) relayLock.done=true;
    if(relayLock && relayLock.done) furnaceOff=true;
    LV.plats=LV.plats.filter(p=>p.t!=='roostBridge');
    bridgeWidth=bridgeOpen ? bridgeEnd-bridgeStart : 0;
    bridgePlatform={x:bridgeStart,y:bridgeY,w:bridgeWidth,t:'roostBridge'};
    if(bridgeOpen)LV.plats.push(bridgePlatform);
  }
  function update() {
    if(bridgeOpen && bridgeWidth<bridgeEnd-bridgeStart) {
      if(bridgeWidth===0)LV.plats.push(bridgePlatform);
      bridgeWidth=Math.min(bridgeEnd-bridgeStart,bridgeWidth+3);
      bridgePlatform.w=bridgeWidth;
      if(bridgeWidth%21===0) Snd.tone('triangle',106,69,.055,.045);
    }
    if(relayLock && relayLock.done && !furnaceOff) {
      furnaceOff=true;
      G.texts.push({x:G.p.x,y:G.p.y-48,s:'FORGE COOLED!',t:110,c:aqua});
      Snd.tone('sine',510,680,.36,.13);
      for(const e of G.enemies) if(e.active && e.type.startsWith('caveRobot') && !e.dead)e.sunStun=90;
    }
  }
  return {load,update,drawBehind:drawBridge};
})();
