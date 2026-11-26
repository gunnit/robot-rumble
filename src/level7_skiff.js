'use strict';

// Kite Run carries the lighthouse mail between the two inhabited islands.
const L7Skiff = (() => {
  const launch = 3350, quay = 5310, rideType = 'kitePost7';
  const pierLeft = quay - 53, pierRight = quay + 52, pierStop = pierLeft + 8;
  const ink = '#172839', deep = '#244453', teal = '#32737b', rim = '#a4e3d0';
  const coral = '#e85e51', red = '#9a4149', cream = '#ffebbd', amber = '#f7b756';
  const current = '#72e8ce', purple = '#645273', squall = '#ac8392';
  const course = [
    {kind:'lift', x:3575, y:162}, {kind:'mail', x:3738, y:115, id:0},
    {kind:'gate', x:3880, y:133, gap:37}, {kind:'snag', x:4070, y:149},
    {kind:'mail', x:4250, y:177, id:1}, {kind:'gate', x:4430, y:174, gap:34},
    {kind:'lift', x:4610, y:173}, {kind:'snag', x:4775, y:120},
    {kind:'mail', x:4900, y:105, id:2}, {kind:'gate', x:5065, y:140, gap:33}
  ];
  let owner, mail, rewarded, delivered, cleanPaid, docked, objects;

  function load(cp) {
    // The engine preserves this set across continues and replaces it for a fresh mission.
    if (owner !== G.freed) {
      owner = G.freed; mail = new Set(); rewarded = new Set(); delivered = 0; cleanPaid = false;
    }
    docked = cp >= quay;
    objects = course.map(point => ({...point, done:false, calm:0}));
  }

  function poly(vertices, color) {
    ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(vertices[0][0],vertices[0][1]);
    for (let i=1;i<vertices.length;i++) ctx.lineTo(vertices[i][0],vertices[i][1]);
    ctx.closePath(); ctx.fill();
  }
  function line(x,y,ex,ey,color,thick=1) {
    const dx=ex-x, dy=ey-y, steps=Math.max(Math.abs(dx),Math.abs(dy),1);
    for (let i=0;i<=steps;i++) R(Math.round(x+dx*i/steps),Math.round(y+dy*i/steps),thick,thick,color);
  }
  function envelope(x,y,w=10,h=7) {
    R(x-1,y-1,w+2,h+2,ink); R(x,y,w,h,cream);
    line(x,y,x+w/2,y+h/2,'#ba7158'); line(x+w/2,y+h/2,x+w-1,y,'#ba7158');
    R(x+(w>>1)-1,y+(h>>1),2,2,coral);
  }
  function twinkle(x,y,color,size) {
    R(x,y-size,1,size*2+1,color); R(x-size,y,2*size+1,1,color);
    R(x,y,1,1,'#fff9dd');
  }
  function flag(x,y,t,small=false) {
    const h=small?5:9, w=small?9:17, flutter=Math.round(Math.sin(t*.13)*2);
    R(x-1,y-2,2,h+12,ink); R(x,y-3,1,h+13,cream);
    poly([[x+1,y],[x+w,y+flutter],[x+w-5,y+h/2+flutter],[x+w,y+h+flutter],[x+1,y+h]],red);
    poly([[x+1,y],[x+w-1,y+flutter],[x+w-7,y+h/2+flutter],[x+1,y+h/2]],coral);
    R(x+3,y+2,3,h-3,cream);
  }

  function canopy(tug) {
    return [[-50,-36+tug],[-27,-51+tug],[4,-53],[32,-42-tug],[47,-26-tug],
      [16,-33],[-5,-35],[-29,-31+tug]];
  }
  function wingTilt(r) { return r ? Math.round(clamp(r.vy*.95,-3,3)) : 0; }
  function mailBob(o) { return Math.round(Math.sin((G.t+o.x)*.055)*2); }

  function drawSkiff(x,y,t,p,r) {
    ctx.save(); ctx.translate(Math.round(x),Math.round(y));
    const tug=wingTilt(r);
    const flutter=Math.round(Math.sin(t*.16)*2);
    // Split high-lift wing. The sawtoothed trailing edge flutters above the cabin.
    poly(canopy(tug),ink);
    poly([[-46,-36+tug],[-26,-48+tug],[3,-51],[27,-42-tug],[42,-29-tug],[15,-36],[-5,-37],[-29,-33+tug]],teal);
    poly([[-42,-37+tug],[-26,-46+tug],[-13,-48],[-22,-35+tug],[-30,-34+tug]],cream);
    poly([[-12,-48],[3,-51],[13,-47],[-4,-37],[-21,-35+tug]],coral);
    poly([[3,-51],[28,-42-tug],[40,-30-tug],[17,-35],[11,-43]],red);
    line(-47,-36+tug,3,-52, rim); line(3,-52,41,-30-tug,cream);
    line(-31,-34+tug,-22,-2,ink); line(-6,-37,-20,-1,cream); line(17,-35,23,-4,ink);
    line(40,-29-tug,25,-4,cream); line(-6,-36,22,-4,'#ba935e');
    line(-48,-37+tug,-58,-31+flutter,coral); line(-58,-31+flutter,-63,-34-flutter,cream);
    // Suspended brass propeller and mail locker hang off the stern.
    RO(-34,-13,9,9,'#ae7553'); R(-34,-11,3,3,amber); R(-38,-11,6,2,ink);
    const rotor=Math.round(9*Math.cos(t*.43)); line(-38,-10-rotor,-39,-10+rotor,'#f6d6a1',2);
    poly([[-31,-4],[-24,-8],[24,-8],[37,-15],[33,-1],[17,7],[-19,7],[-30,1]],ink);
    poly([[-28,-3],[-21,-6],[23,-6],[34,-12],[29,0],[14,4],[-20,4]],'#316976');
    if (p && !(p.inv>0 && Math.floor(p.inv/4)%2)) {
      drawHero(HEROES[G.hero],2,-3,1,{pose:'crouch',t:p.t,aim:'fwd',weapon:p.weapon,muzzle:p.muzzle});
    }
    poly([[-31,-4],[-20,-2],[14,-2],[34,-12],[31,-3],[17,6],[-19,7],[-30,1]],ink);
    poly([[-28,-3],[-18,-1],[14,0],[31,-9],[28,-3],[15,4],[-19,5],[-27,1]],teal);
    line(-29,-4,-19,-2,cream); line(-19,-2,14,-2,amber); line(14,-2,33,-11,cream);
    R(-20,0,8,3,red); R(-6,1,3,2,amber); R(9,1,3,2,amber); envelope(-24,-12,10,7);
    RO(-3,6,19,3,deep); R(1,6,8,1,rim); R(28,-7,3,2,amber);
    for (let i=0;i<2;i++) {
      const shift=(t*(r&&r.surge?2:1)+i*7)%16;
      R(-43-shift,-9+i*7,4+i*3,1,r&&r.surge?current:rim);
    }
    ctx.restore();
  }

  function dock(x,arrival) {
    const y=Math.round(groundAt(x));
    // The signal mast, hanging rope loops, lettering and parcel shelf frame the mooring.
    const mast=x+(arrival?40:-42);
    RO(mast-2,y-64,5,65,deep); R(mast-1,y-61,1,54,'#bf9070');
    R(mast-4,y-56,9,3,amber); R(mast+2,y-55,28,2,ink);
    line(mast+4,y-41,mast+21,y-54,'#9e715b',2); flag(mast,y-72,G.t,true);
    RO(mast+6,y-54,24,14,deep); envelope(mast+13,y-51,10,7);
    for (let i=arrival?pierLeft-quay:-40;i<52;i+=13) {
      RO(x+i,y-2,14,6,'#745851'); R(x+i,y-2,13,2,'#c99770'); R(x+i+5,y+3,2,2,ink);
    }
    for (const dx of [-35,38]) {
      RO(x+dx,y+5,5,15,deep); R(x+dx+1,y+6,1,11,'#a08067');
      line(x+dx-7,y+6,x+dx+1,y+12,'#705f60',2);
    }
    R(x-33,y-6,4,4,ink); R(x+31,y-6,4,4,ink);
    if(arrival) {
      // The striped breakwater gate marks the western limit of the walkable pier.
      RO(pierLeft-3,y-62,6,60,deep); R(pierLeft-2,y-60,2,57,teal);
      for(let i=0;i<5;i++) {R(pierLeft-2,y-55+i*10,4,3,cream); R(pierLeft-2,y-52+i*10,4,3,red);}
      RO(pierLeft-4,y-67,8,5,ink); R(pierLeft-2,y-66,4,2,amber);
      line(pierLeft+2,y-13,pierLeft+12,y-3,amber,2);
    }
    const parked=arrival?docked:!docked && G.p && G.p.x<launch;
    if(parked) drawSkiff(x,y-10,G.t,null,null);
  }

  function drawPennant(o) {
    const t=G.t+o.x, bob=mailBob(o);
    ctx.save(); ctx.translate(o.x,o.y+bob);
    // A stamped winged letter trails a red swallowtail. The cream silhouette
    // and geometrically arranged sparks distinguish it from the teal currents.
    if (Math.floor(t/9)%3!==1) {twinkle(-15,-6,amber,3); twinkle(14,2,cream,2);}
    poly([[-5,-1],[-19,-8],[-15,-2],[-10,0],[-16,-1],[-11,4],[-4,5]],ink);
    poly([[-5,0],[-16,-6],[-12,-1],[-6,1],[-12,0],[-8,3],[-4,4]],cream);
    poly([[4,1],[12,6],[8,8],[13,15],[5,12],[1,5]],red);
    poly([[2,2],[10,6],[6,8],[10,12],[4,10]],coral);
    envelope(-6,-5,14,10); R(-4,-9,3,3,amber); R(0,-11,3,5,amber); R(4,-9,3,3,amber);
    ctx.restore();
  }

  function wind(o) {
    const t=G.t+o.x;
    for (let i=0;i<3;i++) {
      const f=((t+i*21)%63)/63, x=Math.round(o.x-36+f*60), y=Math.round(o.y+13-f*f*36);
      line(x-13,y+4,x-4,y+2,'#57b5b2',2); line(x-4,y+2,x+3,y-2,current,2);
      line(x+3,y-2,x-1,y-1,cream); line(x+3,y-2,x+1,y+3,rim);
    }
    for(let i=0;i<4;i++) R(o.x-32+i*16,o.y+19-Math.floor(i*i*2),2,1,teal);
  }
  function vane(x,y,t,flip,quiet) {
    ctx.save(); ctx.translate(x,y); ctx.scale(1,flip);
    const a=quiet?teal:purple, b=quiet?rim:squall, light=quiet?current:coral;
    poly([[-11,-2],[-13,-11],[-6,-17],[0,-14],[5,-23],[12,-24],[7,-9],[8,-4],[3,1],[-5,2]],ink);
    poly([[-9,-3],[-11,-10],[-6,-14],[0,-10],[6,-19],[9,-21],[4,-9],[6,-5],[2,-1],[-4,0]],a);
    line(-8,-10,-6,-13,b); line(4,-13,8,-20,b); R(-3,-6,6,4,ink); R(-2,-5,4,2,light);
    if (!quiet) {
      const k=Math.floor(t/7)%3; line(0,3,4-k,6,amber); line(4-k,6,0,10,coral);
      R(-7-k,-17,2,2,squall);
    }
    ctx.restore();
  }
  function gate(o) {
    const t=G.t+o.x, split=o.calm>0?10:0;
    const high=o.y-o.gap-split, low=o.y+o.gap+split;
    for(let i=0;i<3;i++) {
      const n=Math.round(Math.sin(t*.06+i)*2);
      vane(o.x+(i?i%2?3:-3:0),high-i*26+n,t+i*11,1,o.calm>0);
      vane(o.x+(i?i%2?-2:4:0),low+i*26-n,t+i*9,-1,o.calm>0);
    }
    // Arrows and the doubled lamps show the navigable slot on either side of the posts.
    for(const y of [high+6,low-6]) {
      R(o.x-6,y,12,1,deep); R(o.x-4,y,8,1,current); R(o.x-1,y-1,2,3,cream);
    }
    if(!o.done) for(let i=0;i<3;i++) {
      const x=o.x-40+i*9+Math.floor(t/6)%3;
      line(x,o.y-3,x+3,o.y,'#8ddbd0'); line(x+3,o.y,x,o.y+3,'#8ddbd0');
    }
  }
  function snag(o) {
    const t=G.t+o.x, y=Math.round(o.y+Math.sin(t*.034)*5);
    if(o.calm>0 || o.done) {
      for(let i=0;i<3;i++) R(o.x-10+i*7,y-5+Math.round(Math.sin(t*.08+i)*4),4,1,rim);
      return;
    }
    ctx.save(); ctx.translate(o.x,y);
    const beat=Math.floor(t/6)%3;
    // Snag kite spins about a copper lightning bobbin, with an unambiguous cross insignia.
    for(let i=0;i<4;i++) {
      ctx.save(); ctx.rotate(i*Math.PI/2);
      poly([[-2,-5],[-6,-14],[-2,-18],[6,-14],[7,-9],[3,-5]],ink);
      poly([[-1,-7],[-4,-13],[-2,-16],[4,-13],[5,-10],[2,-7]],purple); R(0,-15,2,4,squall);
      line(6,-15,9+beat,-18,coral); ctx.restore();
    }
    RO(-6,-6,12,12,red); R(-4,-4,8,8,cream);
    line(-2,-2,2,2,ink); line(2,-2,-2,2,ink);
    ctx.restore();
  }
  function drawWorld(cam=G.cam.x) {
    if(!objects || cam+W<launch-95 || cam>quay+95) return;
    if(Math.abs((cam+W/2)-launch)<W/2+95) dock(launch,false);
    if(Math.abs((cam+W/2)-quay)<W/2+95) dock(quay,true);
    for (const o of objects) {
      if(o.x<cam-64 || o.x>cam+W+64) continue;
      if(o.kind==='lift') wind(o);
      if(o.kind==='gate') gate(o);
      if(o.kind==='snag') snag(o);
      if(o.kind==='mail' && !mail.has(o.id)) drawPennant(o);
    }
  }

  function chord(notes) {
    notes.forEach((freq,i)=>Snd.tone('triangle',freq,freq,.13,.05,i*.075));
  }
  function badge(r,s,frames=88) {r.msg=s; r.msgT=frames;}
  function clearBonus(o,p,value) {
    if (!rewarded.has(o.x)) {rewarded.add(o.x); addScore(value,o.x,p.y-28);}
  }
  function bump(r,o,p) {
    r.drag=46; r.speed=.84; r.clean=false;
    r.vy=clamp((o.kind==='gate'?o.y-p.y:p.y-o.y)*.12,-2,2);
    G.shake=Math.max(G.shake,3.2); sparks(p.x+22,p.y,12,amber); Snd.clank();
    badge(r,'WIND SNAG - TRIM THE SAIL',50);
  }
  function wingTouchesMail(p,r,o) {
    // Clip the drawn wing to the envelope's horizontal span. Its top and bottom
    // inside that span give an exact overlap for this continuous, solid sail.
    const center=o.x-Math.round(p.x), left=center-7, right=center+8;
    const y=o.y+mailBob(o)-Math.round(p.y), wing=canopy(wingTilt(r));
    let top=Infinity, bottom=-Infinity;
    for(let i=0;i<wing.length;i++) {
      const a=wing[i], b=wing[(i+1)%wing.length];
      const lo=Math.max(left,Math.min(a[0],b[0])), hi=Math.min(right,Math.max(a[0],b[0]));
      if(lo>hi) continue;
      const slope=(b[1]-a[1])/(b[0]-a[0]);
      const y0=a[1]+(lo-a[0])*slope, y1=a[1]+(hi-a[0])*slope;
      top=Math.min(top,y0,y1); bottom=Math.max(bottom,y0,y1);
    }
    return y-6<=bottom && y+5>=top;
  }
  function flyCourse(p,r) {
    const pilotY=p.y-5;
    for (const o of objects) {
      if(o.calm>0) o.calm--;
      if(o.done || Math.abs(o.x-p.x)>60) continue;
      const dx=Math.abs(o.x-p.x), dy=Math.abs(o.y-pilotY);
      if(o.kind==='mail' && !mail.has(o.id) && ((dx<29 && dy<22) || wingTouchesMail(p,r,o))) {
        o.done=true; mail.add(o.id); clearBonus(o,p,175); sparks(o.x,o.y,13,amber); chord([659,784,988]);
        badge(r,'MAIL PENNANT '+mail.size+' / 3');
      } else if(o.kind==='lift' && dx<29 && dy<26) {
        o.done=true; r.surge=56; sparks(p.x,p.y+3,12,current); clearBonus(o,p,40);
        chord([330,494]); badge(r,'UPDRAFT!',44);
      } else if(o.kind==='snag' && dx<24 && dy<22 && !o.calm) {
        o.done=true; bump(r,o,p);
      } else if(o.kind==='gate' && p.x>=o.x) {
        o.done=true;
        if(dy<=o.gap+3 || o.calm) {
          clearBonus(o,p,80); sparks(p.x+14,p.y,6,current); chord([494,659]);
        } else bump(r,o,p);
      }
    }
  }

  function ring(x,y) {
    const p=G.p;
    if(!p || !p.ride || p.ride.type!==rideType) return false;
    let struck=false;
    for(const o of objects) {
      if(o.done || o.calm || (o.kind!=='gate' && o.kind!=='snag')) continue;
      if(Math.abs(x-o.x)>105 || (o.kind==='snag' && Math.abs(y-o.y)>80)) continue;
      o.calm=95; struck=true; sparks(o.x,o.y,13,current);
      if(o.kind==='snag') {o.done=true; clearBonus(o,p,90);}
    }
    if(struck) {chord([392,587]); badge(p.ride,'STORM KITES FOLDED',64);}
    return struck;
  }
  function finish(p,r) {
    docked=true;
    G.checkpoint=Math.max(G.checkpoint,quay);
    const bonus=(mail.size-delivered)*100 + (r.clean && !cleanPaid ? 200 : 0);
    if(bonus) addScore(bonus,quay,groundAt(quay)-42);
    if(mail.size===3 && delivered<3) {p.hearts=Math.min(3,p.hearts+1); sparks(p.x,p.y-8,18,amber);}
    delivered=mail.size;
    if(r.clean) cleanPaid=true;
    G.texts.push({x:quay+8,y:groundAt(quay)-57,s:'MAIL LANDED '+mail.size+'/3',t:94,c:cream});
    chord([392,523,659,784]); exitRide(p,false); p.x=quay+6; p.y=groundAt(p.x)-5; p.vx=0; p.vy=-1; p.facing=1;
  }
  RIDES[rideType]={
    help:'UP / DOWN  STEER    V  RING THE STORM BELL',
    box(p){return {x:p.x-16,y:p.y-24,w:34,h:30};},
    update(p,r) {
      r.t++; if(r.msgT>0) r.msgT--;
      const up=ctl('up'), down=ctl('down'), steer=(down?1:0)-(up?1:0);
      const landing=p.x>quay-130, takingOff=p.x<launch+100;
      const target=landing?1.5:r.drag>0?1.25:ctl('left')?1.55:ctl('right')?2.62:2.18;
      r.speed+=clamp(target+(r.surge>0?.5:0)-r.speed,-.048,.043);
      if(r.drag>0) r.drag--;
      if(landing) r.vy=clamp((groundAt(quay)-10-p.y)*.07,-1.4,1.8);
      else if(takingOff && !steer) r.vy=clamp((158-p.y)*.042,-1.5,1.5);
      else {
        if(ctlTap('jump') && !down) r.vy=-2.25;
        r.vy=clamp(r.vy*.87+steer*.345+(r.surge>0&&!down?-.125:0),-2.6,2.6);
      }
      if(r.surge>0) r.surge--;
      p.x=Math.min(quay,p.x+r.speed);
      const floor=landing||takingOff?Math.max(204,groundAt(p.x)-8):204;
      p.y=clamp(p.y+r.vy,98,floor); p.vx=r.speed; p.vy=r.vy;
      p.facing=1; p.aim='fwd'; p.onGround=false; p.onPlat=null; p.crouch=false;
      if(p.fireCd>0) p.fireCd--; if(p.muzzle>0) p.muzzle--;
      if((ctlTap('fire') && p.fireCd<=(weaponOf(p.weapon).tapCd??4)) || (ctl('fire') && !p.fireCd)) shoot(p);
      if(ctlTap('bomb') && p.bombs>0 && G.grenades.length<2) {
        p.bombs--; G.grenades.push({x:p.x+8,y:p.y-10,vx:2.4+r.speed*.4,vy:-2,b:0,t:0}); Snd.throw();
      }
      if(r.surge && r.t%6===0) sparks(p.x-31,p.y,2,current);
      flyCourse(p,r); if(p.x>=quay) finish(p,r);
    },
    hurt(p,r) {
      p.hearts--; r.clean=false; r.drag=30; G.shake=Math.max(G.shake,4);
      if(p.hearts>0) {p.inv=100; Snd.hurt(); return;}
      exitRide(p,true); p.dead=1; p.vy=-4; p.vx=-1; p.rot=0; p.knife=0; p.muzzle=0; Snd.die();
    },
    draw(p,r) {drawSkiff(p.x,p.y,r.t,p,r);},
    hud() {
      text('KITE POST',132,8,cream); envelope(209,8,10,6);
      text('MAIL',132,20,rim);
      for(let i=0;i<3;i++) {
        const x=164+i*18;
        RO(x,20,12,6,mail.has(i)?cream:deep); line(x+1,20,x+6,23,mail.has(i)?red:teal); line(x+6,23,x+11,20,mail.has(i)?red:teal);
      }
    }
  };
  function update() {
    const p=G.p;
    if(!p || p.ride || G.intro || G.winT || G.state!=='play') return;
    if(docked) {
      if(p.x>pierRight) return;
      if(p.x<pierStop) {p.x=pierStop; p.vx=Math.max(0,p.vx); p.kb=Math.max(0,p.kb||0);}
      const deck=groundAt(quay)-2;
      if(p.y>=deck) {
        p.y=deck; p.vy=Math.min(0,p.vy);
        if(!p.vy && !p.dead) {p.onGround=true; p.onPlat=null;}
        if(p.dead && !p.vy) p.rot=-Math.PI/2;
      }
      return;
    }
    if(p.dead) return;
    if(p.x>=quay) {docked=true; return;}
    if(p.x<launch) return;
    // Midair life respawns keep their rescued mail, but the clean-flight score requires a launch from the quay.
    const r={type:rideType,t:0,speed:1.3,vy:0,drag:0,surge:0,clean:p.x<launch+75,msg:'',msgT:0};
    boardRide(p,r); p.facing=1; p.onGround=false; p.onPlat=null;
    p.y=p.x<launch+74?clamp(p.y,99,groundAt(p.x)-10):clamp(p.y,108,169);
    chord([330,494,659]);
  }
  function drawHUD() {
    const p=G.p, r=p&&p.ride;
    if(!r || r.type!==rideType) return;
    let label='', color=cream;
    if(p.x>quay-118) label='MAIL QUAY AHEAD';
    else if(r.msgT) {label=r.msg; color=r.surge?current:amber;}
    else if(r.t<155) label='UP / DOWN  STEER     CATCH THE WINGED MAIL';
    else {
      const next=objects.find(o=>!o.done && o.x>p.x-4 && o.x<p.x+225 && (o.kind==='snag' || o.kind==='gate'));
      if(next) label=next.kind==='snag'?'STEER CLEAR OR RING V':'FLY BETWEEN THE GREEN LIGHTS';
      else if(p.x>launch+190 && p.x<launch+430) label='TEAL WIND LIFTS YOUR KITE';
    }
    if(label) {
      const w=label.length*6+16; panel((W-w)/2,H-22,w,15); text(label,W/2,H-18,color,1,'center',null);
    }
  }
  return {load,update,drawWorld,drawHUD,ring,count:()=>mail?mail.size:0};
})();
