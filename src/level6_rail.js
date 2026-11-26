'use strict';

// Lantern Railway. The freight track carries the hero between two stations;
// the jump, aim, weapon, ammunition and grenade controls work while aboard.
const CaveRail6 = (() => {
  const start = 3510, end = 5030, seat = 12, rideType = 'lanternCart';
  const ink = '#191928', slate = '#343348', metal = '#748197', edge = '#b3c6cc';
  const copper = '#aa6658', brass = '#d79e65', gold = '#ffe294', cyan = '#81eee1', rose = '#ff887c';
  const layout = [
    {x:3820, kind:'switch'}, {x:4150, kind:'freight'},
    {x:4440, kind:'freight'}, {x:4756, kind:'switch'}
  ];
  let arrived = false;

  const railY = x => groundAt(x) - 4;
  const visible = (x, cam, margin) => x > cam-margin && x < cam+W+margin;

  function polygon(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i=1; i<points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath(); ctx.fill();
  }
  function beam(x0,y0,x1,y1,color,width=2) {
    const dx=x1-x0, dy=y1-y0, steps=Math.max(Math.abs(dx),Math.abs(dy));
    if (!steps) return;
    for (let i=0;i<=steps;i++) R(Math.round(x0+i*dx/steps),Math.round(y0+i*dy/steps),width,width,color);
  }
  function lantern(x,y,lit) {
    RO(x-4,y-5,8,11,'#805c50');
    R(x-3,y-3,6,6,lit ? gold : '#584958');
    R(x-2,y-2,2,4,lit ? '#fff8d9' : '#80666a');
    R(x-5,y-6,10,2,brass); R(x-5,y+4,10,2,copper); R(x-1,y-8,2,2,brass);
  }
  function wheel(x,y,phase) {
    RO(x-4,y-3,8,6,'#292b40'); R(x-3,y-4,6,8,'#3b4459');
    R(x-2,y-3,4,1,edge); R(x-3,y-2,1,3,metal); R(x-2,y+3,4,1,'#1f2231');
    const dx=Math.round(Math.cos(phase)*2), dy=Math.round(Math.sin(phase)*2);
    R(x+dx-1,y+dy-1,2,2,brass); R(x-1,y-1,2,2,metal);
  }
  function cart(x,bottom,phase,p) {
    ctx.save(); ctx.translate(Math.round(x),Math.round(bottom));
    const bump = p && p.onGround && Math.floor(phase)%12===0 ? 1 : 0;
    wheel(-14,-4,phase); wheel(12,-4,phase); R(-14,-5,27,2,slate);
    ctx.translate(0,-bump);
    polygon([[-26,-22],[20,-22],[25,-18],[19,-8],[-18,-8]],'#18212e');
    RO(-24,-24,44,3,'#68778a'); R(-23,-24,42,1,edge);
    RO(-22,-26,4,9,copper); R(-21,-26,2,7,brass);
    if (p && !(p.inv>0 && Math.floor(p.inv/4)%2)) {
      drawHero(HEROES[G.hero],0,-seat,p.facing,{pose:'idle',t:p.t,aim:p.aim,weapon:p.weapon,muzzle:p.muzzle});
    }
    // Brass-bound blue ore hopper. The front lip masks the hero's boots.
    polygon([[-26,-21],[24,-21],[19,-8],[13,-6],[-19,-7]],ink);
    polygon([[-24,-19],[22,-19],[18,-10],[12,-8],[-17,-9]],'#526579');
    polygon([[-22,-17],[-10,-17],[-8,-11],[-17,-11]],'#718898');
    R(-23,-20,45,2,brass); R(-20,-18,40,1,'#a9715b'); R(-16,-10,30,2,'#273e50');
    for (const dx of [-18,-8,7,17]) {R(dx,-17,2,6,'#526071'); R(dx,-17,2,2,edge);}
    RO(-5,-18,10,7,'#354453'); R(-3,-16,5,3,brass); R(-1,-17,1,5,gold);
    RO(20,-21,5,8,copper); R(22,-20,4,6,gold); R(24,-19,2,3,'#fff7d0');
    RO(-27,-13,5,3,metal); RO(21,-13,5,3,metal);
    ctx.restore();
  }

  function sign(x,y,label) {
    const w=label.length*6+10;
    RO(x-w/2,y,w,13,slate); R(x-w/2+1,y+1,w-2,1,'#8f7063');
    text(label,x,y+4,'#e8cb9b',1,'center',null);
  }
  function station(x,cam,departure) {
    if (!visible(x,cam,100)) return;
    const y=Math.round(railY(x)), left=x-58, right=x+53;
    for (const dx of [left,right]) {
      RO(dx,y-74,6,73,'#554652'); R(dx+1,y-74,2,72,'#9a7066');
      for (let n=0;n<4;n++) {R(dx-1,y-9-n*16,8,2,slate); R(dx+2,y-9-n*16,2,1,brass);}
    }
    beam(left+4,y-61,left+19,y-77,'#95685d',3);
    beam(right-2,y-61,right-19,y-77,'#95685d',3);
    polygon([[left-7,y-81],[x-38,y-91],[x+40,y-91],[right+10,y-81],[right+6,y-78],[left-7,y-78]],ink);
    polygon([[left-5,y-82],[x-37,y-89],[x+39,y-89],[right+7,y-82]],'#50516a');
    R(left-7,y-80,128,3,copper); R(left-5,y-81,124,1,brass);
    sign(x,y-75,departure ? 'LANTERN LINE' : 'LAST STOP');
    lantern(left+12,y-63,true); lantern(right-8,y-63,true);
    RO(left+11,y-21,17,18,'#4c4858'); R(left+13,y-18,13,2,metal);
    RO(left+15,y-15,9,7,ink); R(left+17,y-13,5,3,departure ? cyan : gold);
  }
  function chute(x,cam) {
    if (!visible(x,cam,94)) return;
    const y=Math.round(railY(x)), top=y-119;
    RO(x-39,top+5,5,114,'#3c3e53'); R(x-38,top+5,1,111,metal);
    beam(x-35,top+49,x+4,top+11,'#69535b',3);
    RO(x-36,top,63,7,'#5b5261'); R(x-36,top+1,60,2,'#9d7a6e');
    polygon([[x-27,top+5],[x+25,top+5],[x+19,top+25],[x+4,top+38],[x-6,top+38],[x-23,top+24]],ink);
    polygon([[x-23,top+7],[x+20,top+7],[x+17,top+22],[x+3,top+32],[x-4,top+32],[x-19,top+22]],'#555367');
    for (let i=0;i<5;i++) R(x-18+i*8,top+9,2,12,'#83757a');
    RO(x-7,top+32,15,8,'#795560'); R(x-7,top+33,15,2,brass);
    for (let i=0;i<3;i++) R(x-5+i*5,top+36,2,3,ink);
    R(x-36,top+19,4,4,Math.floor(G.t/14)%2 ? gold : copper);
  }
  function signalPost(x,cam) {
    if (!visible(x,cam,30)) return;
    const y=Math.round(railY(x));
    RO(x-2,y-48,5,45,slate); R(x-1,y-44,1,41,metal);
    RO(x-8,y-58,16,18,'#514355'); RO(x-5,y-55,10,9,'#242634'); R(x-3,y-53,6,5,cyan);
    R(x-2,y-53,3,1,'#e6fff5'); RO(x-5,y-42,10,3,copper);
  }
  function drawBehind(cam) {
    if (cam+W < start-110 || cam > end+110) return;
    station(start,cam,true); station(end,cam,false);
    chute(4150,cam); chute(4440,cam);
    for (const x of [3660,3935,4590,4880]) signalPost(x,cam);
    const from=Math.max(start-72, Math.floor((cam-12)/8)*8), to=Math.min(end+58,cam+W+12);
    for (let x=from;x<to;x+=8) {
      const y=Math.round(railY(x));
      if (x%16<8) {R(x,y-1,5,5,'#79594e'); R(x,y+1,2,3,'#b77c56');}
      R(x,y,8,2,'#343c4f'); R(x,y-1,8,1,edge);
    }
    if ((!G.p || !G.p.ride) && !arrived && visible(start,cam,45) && G.p.x < start)
      cart(start,railY(start),0,null);
    if (arrived && visible(end-12,cam,45)) cart(end-12,railY(end-12),0,null);
  }

  function freight(o) {
    const x=Math.round(o.x), y=Math.round(o.y), flash=o.hitT>0;
    RO(x-14,y-36,28,35,flash ? '#ead8b3' : '#674853');
    R(x-12,y-34,24,8,'#a76b57'); R(x-12,y-24,24,10,'#885246'); R(x-12,y-12,24,9,'#a2654b');
    for (const dx of [-13,9]) {R(x+dx,y-34,4,31,brass); R(x+dx+1,y-31,2,2,ink); R(x+dx+1,y-8,2,2,ink);}
    RO(x-8,y-23,16,11,'#343447');
    for (let i=0;i<4;i++) {R(x-6+i*3,y-17-i,3,3,gold);}
    RO(x-15,y-3,30,3,metal);
  }
  function bentTrack(o) {
    const x=o.x,y=Math.round(railY(x));
    for (const shift of [-4,3]) {
      beam(x-18,y-1+shift,x-5,y-10+shift,'#344153',3);
      beam(x-18,y-2+shift,x-5,y-11+shift,edge,1);
      beam(x+3,y-11+shift,x+14,y-1+shift,'#5c6677',3);
      R(x-5,y-13+shift,4,3,brass); R(x+1,y-13+shift,3,3,brass);
    }
    RO(x+9,y-22,2,19,slate);
    RO(x+4,y-25,12,8,'#b79058'); R(x+6,y-23,2,4,ink); R(x+9,y-23,2,4,ink);
    if (!o.passed) {
      // A hanging railway token traces the useful arc over the switch.
      const ty=y-50+Math.round(Math.sin((G.t+o.x)*.08)*2);
      R(x-1,ty-5,3,10,brass); R(x-4,ty-2,9,4,brass);
      R(x-2,ty-3,5,6,gold); R(x-1,ty-2,2,4,'#fff9d3');
    }
  }
  PROP_TYPES.lanternRail6 = {
    make(o) {
      o.hp=3; o.restY=railY(o.x); o.passed=false; o.falling=false; o.dropV=0;
      o.y=o.kind==='freight' ? o.restY-79 : o.restY;
    },
    box:o => o.kind==='freight' && !o.passed ? {x:o.x-15,y:o.y-36,w:30,h:37} : null,
    hit(o,dmg) {
      if (o.kind!=='freight' || o.passed) return;
      o.hp-=dmg; o.hitT=4;
      if (o.hp>0) {Snd.clank(); return;}
      o.dead=true; sparks(o.x,o.y-15,12,brass); debris(o.x,o.y-14,8,copper);
      addScore(150,o.x,o.y-29); Snd.clank();
    },
    update(o) {
      if (o.kind==='freight' && !o.passed && !o.falling && G.p.x>o.x-254) o.falling=true;
      if (o.falling && o.y<o.restY) {
        o.dropV=Math.min(4.8,o.dropV+.19);
        o.y=Math.min(o.restY,o.y+o.dropV);
        if (o.y===o.restY) {dust(o.x,o.y,7); Snd.tone('triangle',130,58,.09,.035);}
      }
      const p=G.p, r=p.ride;
      if (o.passed || !r || r.type!==rideType || p.x<o.x-7 || p.x>o.x+35) return;
      o.passed=true;
      const highEnough = r.height >= (o.kind==='switch' ? 13 : 37);
      if (highEnough) {
        sparks(o.x,o.restY-(o.kind==='switch' ? 50 : 37),8,gold);
        addScore(100,o.x,o.restY-49);
        Snd.tone('triangle',660,850,.10,.06);
      } else {
        // A missed jump knocks speed off. The cowcatcher clears the line so the next beat remains playable.
        r.brake=38; r.speed=.65; r.lift=2.6;
        G.shake=Math.max(G.shake,3); sparks(o.x,o.y-5,11,brass); Snd.clank();
      }
      if (o.kind==='freight') {o.dead=true; debris(o.x,o.y-12,7,copper);}
    },
    draw(o) {
      if (!visible(o.x,G.cam.x,38)) return;
      if (o.kind==='freight') freight(o); else bentTrack(o);
    }
  };

  function drawFront(cam) {
    const p=G.p,r=p && p.ride;
    if (!r || r.type!==rideType) return;
    const next=G.props.find(o=>o.k==='lanternRail6' && !o.dead && !o.passed && o.x>p.x-8);
    // Put the instruction on the sleepers, leaving aiming lines and the regular HUD clear.
    let hint='';
    if (next) {
      const distance=next.x-p.x;
      if (next.kind==='switch' && distance <= Math.max(2,r.speed)*26 && r.height<1) hint='Z  JUMP THE SWITCH';
      else if (next.kind==='freight' && distance<173) hint='X  BREAK THE FREIGHT';
    }
    if (!hint && r.t<112) hint='Z  JUMP     X  FIRE     LEFT / RIGHT  AIM';
    if (!hint && p.x>end-130) hint='ARRIVING AT LAST STOP';
    if (hint) {
      const w=hint.length*6+12;
      panel((W-w)/2,H-23,w,13); text(hint,W/2,H-20,gold,1,'center',null);
    }
  }

  RIDES[rideType] = {
    help:'Z: CART JUMP   X: FIRE   LEFT / RIGHT: FACE',
    box:p=>({x:p.x-9,y:p.y-32,w:18,h:35}),
    update(p,r) {
      r.t++;
      p.facing=ctl('left') ? -1 : ctl('right') ? 1 : p.facing;
      p.aim=ctl('up') ? 'up' : ctl('down') && r.height>0 ? 'down' : 'fwd';
      const cruise=p.x<3920 ? 1.9 : p.x<4590 ? 2.35 : 2.8;
      const target=r.brake>0 ? 1 : p.x>end-62 ? 1.5 : cruise;
      r.speed += clamp(target-r.speed,-.055,.055);
      if (r.brake>0) r.brake--;
      if (ctlTap('jump') && r.height<=0) {r.lift=5.05; Snd.jump();}
      r.height=Math.max(0,r.height+r.lift); r.lift-=.27;
      if (!r.height) {
        if (r.lift<-3) {sparks(p.x,railY(p.x),4,brass); Snd.tone('triangle',118,63,.065,.04);}
        r.lift=0;
      }
      p.vx=r.speed; p.vy=-r.lift; p.x=Math.min(end,p.x+p.vx);
      p.y=railY(p.x)-seat-r.height; p.onGround=!r.height; p.onPlat=null; p.crouch=false;
      r.rotation+=r.speed*.24;
      if (p.muzzle>0) p.muzzle--;
      if (p.fireCd>0) p.fireCd--;
      if ((ctlTap('fire') && p.fireCd <= (weaponOf(p.weapon).tapCd ?? 4)) || (ctl('fire') && !p.fireCd)) shoot(p);
      if (ctlTap('bomb') && p.bombs>0 && G.grenades.length<2) {
        p.bombs--;
        G.grenades.push({x:p.x+p.facing*4,y:p.y-18,vx:p.facing*2.4+p.vx*.4,vy:-3.4,b:0,t:0}); Snd.throw();
      }
      if (!r.height && r.t%24===0) Snd.tone('triangle',95,65,.045,.025);
      if (r.t%17===0) sparks(p.x-14,railY(p.x)-r.height-3,1,brass);
      if (p.x>=end) {
        arrived=true; exitRide(p,false);
        p.x=end; p.y=groundAt(p.x)-6; p.vx=0; p.vy=-2; p.facing=1;
        Snd.tone('triangle',660,660,.12,.075); Snd.tone('triangle',880,880,.18,.06,.10);
      }
    },
    hurt(p,r) {
      p.hearts--; r.brake=20; G.shake=Math.max(G.shake,4);
      if (p.hearts>0) {p.inv=100; Snd.hurt(); return;}
      exitRide(p,true); p.dead=1; p.vy=-4.5; p.vx=-1; p.rot=0; p.knife=0; p.muzzle=0; Snd.die();
    },
    draw(p,r) {cart(p.x,railY(p.x)-r.height,r.rotation,p);},
    hud() {
      const p=G.p, w=weaponOf(p.weapon);
      w.icon(131,9); text(w.label,154,8,'#ffe066');
      if (w.ammo!==Infinity) text(String(p.ammo),226,8,'#fff6d3',1,'right');
      text('RAIL',131,21,brass);
      R(162,22,62,3,slate); R(162,22,Math.max(1,Math.round(62*clamp((p.x-start)/(end-start),0,1))),3,cyan);
    }
  };

  function load(cp) {
    arrived=cp>=end;
    for (const entry of layout) {
      if (entry.x>=cp-20) G.props.push(makeProp({k:'lanternRail6',...entry}));
    }
  }
  function update() {
    const p=G.p;
    if (!p || p.dead || G.intro || G.winT || arrived || p.ride) return;
    if (p.x>=end) {arrived=true; return;}
    if (p.x<start || p.y<groundAt(p.x)-60) return;
    const r={type:rideType,t:0,height:0,lift:0,speed:1.6,brake:0,rotation:0};
    boardRide(p,r); p.y=railY(p.x)-seat; p.onGround=true;
    Snd.tone('triangle',392,392,.11,.06); Snd.tone('triangle',587,587,.14,.06,.10);
  }
  return {load, update, drawBehind, drawFront};
})();
