'use strict';

// The indoor shaft has its own coordinates. G.p stays at the outdoor door
// until the player rings the roof bell, so campaign locks see only world x.
const L7Belfry = (() => {
  const entrance = 6450, roofLock = 6460, roofX = 6665;
  const shaftWidth = 480, shaftHeight = 752, baseY = 704, crownY = 169;
  function platform(id,kind,x,y,w) { return {id,kind,x,y,w}; }
  const platforms = [
    platform('floor','floor',72,baseY,333),
    platform('stair1','ledge',218,654,112),
    platform('stair2','ledge',115,605,105),
    platform('stair3','ledge',190,554,113),
    platform('stair4','ledge',276,502,101),
    platform('refuge','refuge',164,449,116),
    platform('windDock','dock',88,399,87),
    platform('upper','ledge',274,225,103),
    platform('summit','summit',164,crownY,117)
  ];
  const fixed = Object.fromEntries(platforms.map(p=>[p.id,p]));
  const route = ['floor','stair1','stair2','stair3','stair4','refuge','windDock','hoist','upper','summit'];
  const bellX = 211, dockBellX = 161, refugeX = 202;
  let run, room = null, completed = false, refugeLit = false, falls = 0;

  function load(cp) {
    if(run !== G.freed) {
      run=G.freed; completed=false; refugeLit=false; falls=0;
    }
    if(cp>=roofLock) { completed=true; refugeLit=true; }
    room=null;
  }
  function clearOutdoorHazards() {
    G.enemies=G.enemies.filter(e=>e.lock || (!e.active && e.x>=roofLock));
    G.eb=[]; G.pb=[]; G.grenades=[]; G.markers=[]; G.later=[];
    G.parts=[]; G.rings=[]; G.texts=[]; G.shake=0; G.sflash=0;
    G.banner=null; G.big=null; G.goT=0; G.warnT=0;
  }
  function resetFooting(home) {
    const p=room.player;
    p.x=home.id==='refuge'?refugeX:138; p.y=home.y; p.vx=0; p.vy=0;
    p.onGround=true; p.standingId=home.id; p.fromId=home.id;
    p.coyote=5; p.jumpBuffer=0;
    room.cameraY=clamp(home.y-(H-56),0,shaftHeight-H);
    room.hoist.y=room.hoist.baseY; room.hoist.motion='idle'; room.hoist.atTop=false;
    room.wave=null; room.dust=null;
  }
  function enter() {
    clearOutdoorHazards();
    G.checkpoint=Math.max(G.checkpoint,entrance);
    room={
      frame:0,cameraY:0,notice:0,bellCooldown:0,wave:null,dust:null,
      player:{facing:1},
      hoist:{...platform('hoist','hoist',198,399,66),baseY:399,topY:281,
        enabled:false,atTop:false,motion:'idle'}
    };
    resetFooting(refugeLit?fixed.refuge:fixed.floor);
    Snd.tone('triangle',294,392,.17,.06);Snd.tone('sine',440,440,.20,.035,.17);
  }
  function exitAtRoof() {
    completed=true; room=null;
    clearOutdoorHazards();
    const p=G.p;
    p.x=roofX; p.y=groundAt(roofX); p.vx=0; p.vy=0; p.kb=0;
    p.facing=1; p.crouch=false; p.aim='fwd'; p.onGround=true; p.onPlat=null;
    p.dropT=0; p.knife=0; p.muzzle=0; p.bellLift=0; p.inv=Math.max(p.inv,45);
    G.cam.x=roofLock; G.checkpoint=roofLock;
    Snd.tone('sine',587,587,.5,.09);Snd.tone('sine',880,880,.55,.065,.16);
  }
  function windStep() {
    const h=room.hoist;
    if(h.motion==='idle')return;
    const old=h.y, target=h.motion==='up'?h.topY:h.baseY;
    h.y+=clamp(target-h.y,-1.7,2.25);
    if(room.player.standingId==='hoist')room.player.y+=h.y-old;
    if(h.y===target) {
      h.atTop=h.y===h.topY; h.motion='idle';
      Snd.tone('triangle',h.atTop?659:392,h.atTop?784:494,.14,.055);
    }
  }
  function ringBell() {
    const p=room.player, h=room.hoist;
    if(room.bellCooldown || !(pressed.KeyV || pressed.KeyB))return false;
    room.bellCooldown=18; room.wave={x:p.x,y:p.y-19,age:0};
    Snd.tone('sine',659,650,.3,.08);Snd.tone('triangle',988,974,.18,.045);
    if(p.standingId==='summit' && Math.abs(p.x-bellX)<=36) {
      exitAtRoof(); return true;
    }
    if(p.standingId==='hoist' && h.y>h.topY) {
      h.enabled=true; h.atTop=false; h.motion='up';
      Snd.tone('triangle',196,330,.28,.053);
    } else if(p.standingId==='windDock' && Math.abs(p.x-dockBellX)<=44 && h.y<h.baseY) {
      h.enabled=true; h.atTop=false; h.motion='down';
      Snd.tone('triangle',392,220,.25,.05);
    }
    return false;
  }
  function landed(surface,fallSpeed) {
    const p=room.player;
    p.y=surface.y; p.vy=0; p.onGround=true; p.standingId=surface.id; p.fromId=surface.id; p.coyote=5;
    if(fallSpeed>1.5) {
      room.dust={x:p.x,y:p.y,age:0};
      Snd.tone('triangle',surface.id==='hoist'?190:120,72,.055,.026);
    }
    if(surface.id==='refuge' && !refugeLit) {
      refugeLit=true; room.notice=120;
      Snd.tone('sine',392,392,.22,.055);Snd.tone('sine',587,587,.32,.05,.16);
    }
  }
  function movePlayer() {
    const p=room.player, h=room.hoist;
    const jumpPressed=ctlTap('jump'), west=ctl('left'), east=ctl('right');
    if(jumpPressed)p.jumpBuffer=7;
    else if(p.jumpBuffer)p.jumpBuffer--;
    // Holding jump chains the stairs. The two bell decks let the player
    // stay planted while ringing or riding, and still accept a fresh jump.
    const bellDeck=p.standingId==='hoist' || p.standingId==='summit';
    if((p.jumpBuffer || (ctl('jump')&&!bellDeck)) && (p.onGround || p.coyote>0)) {
      p.vy=-6.45; p.onGround=false; p.standingId=null; p.coyote=0; p.jumpBuffer=0; Snd.jump();
    }
    p.vx=((east?1:0)-(west?1:0))*2.45;
    if(p.vx)p.facing=Math.sign(p.vx);
    p.x=clamp(p.x+p.vx,50,432);
    if(p.onGround) {
      const deck=p.standingId==='hoist'?h:fixed[p.standingId];
      if(p.x>=deck.x-2 && p.x<=deck.x+deck.w+2) {
        p.y=deck.y; p.vy=0; p.coyote=5; return;
      }
      p.onGround=false; p.standingId=null;
    }
    if(p.coyote>0)p.coyote--;
    const oldY=p.y;
    p.vy=Math.min(8,p.vy+.27); p.y+=p.vy;
    if(p.vy<0)return;
    let first=null;
    for(const deck of [...platforms,h]) {
      if(oldY<=deck.y && p.y>=deck.y && p.x>=deck.x-2 && p.x<=deck.x+deck.w+2 &&
          (!first || deck.y<first.y))first=deck;
    }
    if(first)landed(first,p.vy);
  }
  function updateScene() {
    if(G.state!=='play' || G.intro || G.winT || !G.p || G.p.dead)return false;
    if(!room) {
      if(completed || G.p.ride || G.p.x<entrance)return false;
      // A direct start at the arena is a valid late entry. Real outdoor walks
      // always meet the door an entire camera-follow distance earlier.
      if(G.cam.x>=roofLock || G.p.x>=roofX-6) {completed=true;refugeLit=true;return false;}
      enter(); return true;
    }
    room.frame++;
    if(room.notice>0)room.notice--;
    if(room.bellCooldown>0)room.bellCooldown--;
    if(room.wave && ++room.wave.age>=24)room.wave=null;
    if(room.dust && ++room.dust.age>=13)room.dust=null;
    if(ringBell())return true;
    windStep(); movePlayer();
    const p=room.player;
    const target=clamp(p.y-148,0,shaftHeight-H);
    if(target<room.cameraY)room.cameraY+=Math.max(target-room.cameraY,-4.4);
    if(p.y>room.cameraY+H+16 || (refugeLit && p.y>fixed.refuge.y+40)) {
      falls++; resetFooting(refugeLit?fixed.refuge:fixed.floor);room.notice=108;
      Snd.tone('sine',294,392,.2,.05);
    }
    return true;
  }

  function nextGoal() {
    const p=room.player, h=room.hoist, id=p.standingId || p.fromId;
    if(id==='summit')return {id:'summit',action:'signal',x:bellX,y:crownY,w:0,landX:bellX,takeoffX:bellX};
    if(id==='windDock' && h.y<h.baseY)
      return {id:'windDock',action:h.motion==='down'?'ride':'call',x:dockBellX,y:fixed.windDock.y,w:0,
        landX:dockBellX,takeoffX:dockBellX};
    if(id==='hoist' && !h.atTop)
      return {id:'hoist',action:h.motion==='up'?'ride':'ring',x:h.x,y:h.y,w:h.w,landX:h.x+h.w/2,takeoffX:h.x+h.w/2};
    const source=id==='hoist'?h:fixed[id], nextId=route[route.indexOf(id)+1];
    const dest=nextId==='hoist'?h:fixed[nextId];
    const dir=dest.x+dest.w/2>=source.x+source.w/2?1:-1;
    const landX=dir>0?dest.x+16:dest.x+dest.w-16;
    return {id:dest.id,action:nextId==='hoist'?'board':'jump',x:dest.x,y:dest.y,w:dest.w,landX,
      takeoffX:clamp(landX-dir*54,source.x+8,source.x+source.w-8)};
  }
  function hint() {
    if(!room)return '';
    const p=room.player,h=room.hoist;
    if(p.standingId==='summit')return Math.abs(p.x-bellX)<=36?'V / B  RING THE ROOF BELL':'WALK UNDER THE ROOF BELL';
    if(p.standingId==='hoist')return h.atTop?'JUMP RIGHT TO THE BELL GALLERY':h.motion==='up'?'RIDE THE HOIST TO THE UPPER GALLERY':'V / B  RING TO RAISE THE HOIST';
    if(p.standingId==='windDock')return h.y<h.baseY?'V / B  CALL THE HOIST BACK':'JUMP RIGHT ONTO THE BRASS HOIST';
    if(room.notice>0)return refugeLit?'REFUGE LIT  /  FALLS RETURN YOU HERE':'BACK AT THE FOOT OF THE TOWER';
    if(room.frame<160)return 'ARROWS MOVE   Z JUMP   CLIMB TO THE ROOF BELL';
    return 'JUMP FROM STAIR TO STAIR';
  }
  function status() {
    const p=room&&room.player;
    return {active:!!room,completed,refugeLit,falls,totalRise:baseY-crownY,
      rise:p?clamp(baseY-p.y,0,baseY-crownY):completed?baseY-crownY:0,
      grounded:!!(p&&p.onGround),standingId:p?p.standingId:null,
      feet:p?{x:p.x,y:p.y,vx:p.vx,vy:p.vy}:null,
      cameraY:room?room.cameraY:null,hoistY:room?room.hoist.y:null,goal:room?nextGoal():null};
  }
  function drawScene() {
    if(!room)return false;
    const p=room.player, cam=Math.round(room.cameraY);
    L7TowerArt.render({cameraY:cam,width:shaftWidth,height:shaftHeight,frame:room.frame,platforms,
      hoist:room.hoist,refuge:{...fixed.refuge,lit:refugeLit},summit:{x:bellX,y:crownY,lit:completed},
      player:p,bellWave:room.wave});
    ctx.save();ctx.translate(0,-cam);
    if(room.wave) {
      const w=room.wave,age=w.age/24,r=8+64*age;
      ctx.globalAlpha=.82*(1-age);ctx.lineWidth=1;ctx.strokeStyle='#a5f4df';
      ctx.beginPath();ctx.arc(Math.round(w.x),Math.round(w.y),r,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#ffe1a3';ctx.beginPath();ctx.arc(Math.round(w.x),Math.round(w.y),r*.77,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;
    }
    if(room.dust) {
      const d=room.dust;ctx.globalAlpha=1-d.age/13;
      for(const side of [-1,1])R(Math.round(d.x+side*(3+d.age*.6)),Math.round(d.y-2-d.age*.17),3,1,'#ffe2aa');
      ctx.globalAlpha=1;
    }
    drawHero(HEROES[G.hero],Math.round(p.x),Math.round(p.y),p.facing,
      {pose:p.onGround?(p.vx?'run':'idle'):'jump',t:room.frame,aim:'fwd',weapon:G.p.weapon,muzzle:0});
    ctx.restore();return true;
  }
  return {load,updateScene,drawScene,status,hint};
})();
