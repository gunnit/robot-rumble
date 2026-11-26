'use strict';

// Enamel harbour machines. Bake the articulated poses once at the native
// pixel resolution so their outlines stay crisp against the moving weather.
const L7Foes = (() => {
  const ink = '#122031', navy = '#263649', teal = '#326a77', tide = '#53909b', sea = '#90c8bc';
  const pale = '#dce9cf', cream = '#fff2ba', brass = '#bb8150', gold = '#edbe66';
  const red = '#b74e47', coral = '#f28366', cyan = '#70f2df', violet = '#626695';
  const enamel = '#ecdec0', shadow = '#9da79e';
  const sprites = new Map();

  function picture(id, width, height, ox, oy, painter) {
    if (sprites.has(id)) return sprites.get(id);
    const img = document.createElement('canvas');
    img.width = width; img.height = height;
    const g = img.getContext('2d');
    g.translate(ox, oy);
    function rect(x, y, w, h, color) {
      g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), w, h);
    }
    function line(ax, ay, bx, by, color, thickness = 1) {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      for (let i = 0; i <= steps; i++)
        rect(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps, thickness, thickness, color);
    }
    function path(points, color, thickness = 1) {
      for (let i = 1; i < points.length; i++) line(...points[i-1], ...points[i], color, thickness);
    }
    function poly(points, color, rim = ink) {
      const minY = Math.floor(Math.min(...points.map(q => q[1]))), maxY = Math.ceil(Math.max(...points.map(q => q[1])));
      for (let y = minY; y <= maxY; y++) {
        const stops = [];
        for (let i = 0; i < points.length; i++) {
          const a = points[i], b = points[(i + 1) % points.length];
          if ((a[1] > y + .5) !== (b[1] > y + .5))
            stops.push(a[0] + (y + .5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        stops.sort((a,b) => a-b);
        for (let i = 1; i < stops.length; i += 2) {
          const start = Math.ceil(stops[i-1]); rect(start, y, Math.ceil(stops[i]) - start, 1, color);
        }
      }
      if (rim) path([...points, points[0]], rim);
    }
    function disc(x, y, rx, ry, color, rim = ink) {
      for (let j = -ry; j <= ry; j++) {
        const d = Math.round(rx*Math.sqrt(Math.max(0, 1-(j/ry)**2)));
        rect(x-d, y+j, 2*d+1, 1, rim || color);
        if (!rim || Math.abs(j) < ry) rect(x-d+1, y+j, Math.max(1,2*d-1), 1, color);
      }
    }
    function pin(x, y) { disc(x, y, 2, 2, brass); rect(x-1,y-1,1,1,cream); }
    painter({ rect, line, path, poly, disc, pin });
    const white = document.createElement('canvas'); white.width=width; white.height=height;
    const light = white.getContext('2d');
    light.drawImage(img,0,0);
    light.globalCompositeOperation='source-atop';
    light.fillStyle='rgba(255,253,219,.8)'; light.fillRect(0,0,width,height);
    const result = {img,white,ox,oy};
    sprites.set(id,result);
    return result;
  }

  function drawPose(e, sprite, mirror = true) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y));
    if (mirror) ctx.scale(e.facing || 1,1);
    ctx.drawImage(e.hitT > 0 ? sprite.white : sprite.img,-sprite.ox,-sprite.oy);
    ctx.restore();
  }

  // A walking buoy. Its striped shell, outriggers and hinged pincers make
  // the spring-lunge readable while the player is learning the bell.
  function crabPose(step, raised) {
    return picture('crab'+step+raised, 59, 45, 28, 42, p => {
      for (let i=0;i<3;i++) {
        const j=step%2 ? 2-i : i-1, x=-12+i*9;
        p.path([[x,-12],[x-6+j,-7],[x-9+j,-2],[x-12+j,-2]],ink,3);
        p.path([[x,-12],[x-5+j,-7],[x-9+j,-3]],brass,2); p.rect(x-7+j,-7,2,2,gold);
      }
      p.poly([[-17,-12],[-17,-19],[-12,-28],[-7,-32],[2,-31],[10,-27],[14,-18],[15,-12],[10,-9],[-12,-8]],red);
      p.poly([[-13,-26],[-6,-31],[0,-30],[6,-27],[1,-24],[-6,-24]],enamel,null);
      p.poly([[-17,-19],[-13,-21],[14,-20],[14,-15],[8,-13],[-16,-14]],enamel);
      p.line(-14,-21,-5,-21,cream); p.line(-11,-12,6,-12,brass);
      p.path([[-6,-30],[-5,-37],[0,-37],[2,-32]],ink,2); p.rect(-4,-36,4,1,gold);
      p.disc(4,-19,5,4,navy); p.rect(2,-20,5,2,cyan);
      p.pin(-12,-16);p.pin(-3,-14);
      const lift=raised?5:0;
      p.path([[9,-12],[16,-15-lift],[19,-18-lift]],ink,4);
      p.path([[9,-12],[15,-15-lift],[20,-18-lift]],brass,2);
      p.poly([[16,-18-lift],[19,-24-lift],[25,-26-lift],[21,-21-lift],[23,-19-lift],[29,-20-lift],[24,-15-lift],[19,-15-lift]],coral);
      p.line(19,-23-lift,23,-24-lift,cream);
      p.poly([[-16,-16],[-22,-21],[-24,-21],[-22,-15],[-27,-16],[-24,-11],[-18,-12]],red);
    });
  }

  function kitePose(step, charged) {
    return picture('kite'+step+charged,52,57,26,43,p=>{
      const wind=[0,2,1,-2][step];
      p.path([[-2,-4],[-5,1],[-10,3+wind],[-13,8],[-17,10+wind]],ink,2);
      p.path([[-2,-4],[-5,1],[-10,3+wind],[-13,8],[-17,10+wind]],gold);
      for(const [x,y] of [[-8,3+wind],[-15,8+wind]])p.poly([[x-2,y-3],[x+3,y+2],[x-4,y+1]],coral);
      p.poly([[-2,-35],[22,-22],[7,-10],[0,-1],[-8,-8],[-23,-15]],tide);
      p.poly([[-2,-35],[-1,-16],[-23,-15]],enamel);
      p.poly([[-2,-35],[22,-22],[-1,-16]],teal);
      p.poly([[-1,-16],[22,-22],[7,-10],[0,-1]],coral);
      p.path([[-18,-17],[-4,-29]],cream);
      p.path([[-2,-35],[-1,-16],[0,-1]],gold,2); p.line(-22,-15,22,-22,ink);
      p.disc(-1,-18,7,6,brass);p.disc(-1,-18,5,4,navy);
      p.rect(-3,-19,5,2,charged?cream:cyan);p.rect(-1,-21,2,2,pale);
      p.rect(-21,-14,3,2,coral);p.rect(18,-22,3,2,cream);
    });
  }

  function ramPose(step, charged) {
    return picture('ram'+step+charged,68,49,33,46,p=>{
      for(const [x,o] of [[-16,0],[-5,2],[7,0],[15,2]]){
        const d=(step+o)%4<2?2:-2;
        p.poly([[x-2,-14],[x+4,-14],[x+3,-7],[x+d,-5],[x+d+1,-2],[x+d+4,-1],[x-3+d,-1],[x-3,-7]],navy);
        p.rect(x-2+d,-4,3,2,brass);
      }
      p.poly([[-23,-15],[-23,-23],[-18,-30],[-9,-34],[5,-32],[15,-27],[22,-22],[16,-13],[8,-10],[-12,-11]],teal);
      p.poly([[-23,-23],[-18,-30],[-8,-33],[5,-31],[7,-26],[-17,-22]],tide,null);
      for(let j=0;j<4;j++){
        const x=-18+j*6; p.path([[x,-26],[x+4,-28],[x+7,-25]],pale);p.line(x+1,-19,x+4,-20,navy,2);
      }
      p.path([[-20,-17],[-13,-13],[-1,-14]],brass,2);
      p.poly([[7,-26],[16,-32],[22,-29],[24,-24],[30,-21],[31,-17],[24,-13],[15,-16]],enamel);
      p.poly([[21,-18],[29,-20],[31,-17],[25,-14]],shadow,null);
      p.disc(14,-28,11,11,brass); p.disc(14,-28,8,8,gold);
      p.path([[16,-36],[10,-33],[7,-28],[9,-24],[12,-22],[17,-23],[20,-27],[18,-30],[14,-30],[12,-27],[14,-26]],navy,2);
      p.line(8,-30,10,-34,cream);p.line(18,-35,21,-32,cream);
      p.rect(22,-25,5,2,charged?cream:coral);p.rect(28,-18,2,1,ink);
      p.path([[-23,-22],[-28,-24],[-30,-28]],ink,2);p.rect(-30,-29,2,2,coral);
    });
  }

  // The heron's neck is an articulated sounding arm. A bronze clapper
  // swings in the scalloped bell under its breast.
  function heronPose(step, striking) {
    return picture('heron'+step+striking,111,117,47,112,p=>{
      const lift=[0,2,0,-2][step], tuck=striking?10:0;
      for(const [x,shift,color] of [[-8,-3,teal],[5,3,brass]]){
        const knee=x+9+shift+lift, foot=x-4+shift;
        p.path([[x,-48],[knee,-28],[foot,-3],[foot+10,-2]],ink,4);
        p.path([[x,-47],[knee,-28],[foot,-4]],color,2);
        p.path([[foot-3,-1],[foot,-3],[foot+10,-2],[foot+13,-3]],ink,2);
        p.pin(knee+1,-27);p.line(foot+2,-2,foot+9,-2,gold);
      }
      // Long, separate vanes fan from the turbine toward the tail.
      for(let i=0;i<4;i++) {
        const y=-62+i*4, tip=-43+i*5;
        p.poly([[-2,y-5],[-15,y-5],[tip,y+7+lift],[-27+i*3,y+9],[-7,y+2]],i%2?shadow:enamel);
        p.line(-16,y-2,tip+3,y+6+lift,i%2?sea:pale);
      }
      p.poly([[-26,-65],[-18,-73],[-6,-77],[6,-73],[16,-64],[14,-55],[9,-48],[0,-45],[-14,-51],[-26,-55]],teal);
      p.poly([[-25,-64],[-17,-72],[-5,-76],[7,-72],[8,-66],[-9,-60],[-21,-56]],enamel);
      for(let i=0;i<4;i++){
        const x=-22+i*4;p.path([[x,-62-i], [x+7,-65-i],[x+13,-65-i]],i%2?shadow:pale);
      }
      p.disc(2,-64,7,7,brass);p.disc(2,-64,4,4,navy);p.pin(2,-64);
      p.path([[6,-71],[15,-77],[19+tuck,-87],[13+tuck,-94],[17+tuck,-99]],ink,7);
      p.path([[7,-71],[15,-78],[19+tuck,-87],[13+tuck,-94],[17+tuck,-99]],shadow,5);
      p.path([[8,-73],[15,-79],[19+tuck,-88],[15+tuck,-93]],enamel,2);
      p.poly([[12+tuck,-100],[17+tuck,-105],[26+tuck,-106],[31+tuck,-103],[32+tuck,-99],[24+tuck,-96],[17+tuck,-95]],enamel);
      p.poly([[26+tuck,-100],[32+tuck,-102],[51+tuck,-99+lift],[31+tuck,-96]],gold);
      p.line(31+tuck,-99,49+tuck,-99+lift,brass);
      p.poly([[19+tuck,-104],[11+tuck,-108],[5+tuck,-109],[13+tuck,-102]],teal);
      p.path([[18+tuck,-101],[24+tuck,-103],[29+tuck,-102]],navy,2);
      p.rect(25+tuck,-102,3,2,coral);p.rect(26+tuck,-102,1,1,cream);
      const bell=12+lift;
      p.path([[6,-59],[bell,-53],[bell,-48]],brass,2);
      p.poly([[bell-3,-48],[bell+3,-48],[bell+6,-45],[bell+7,-38],[bell+10,-35],[bell+10,-32],[bell-10,-32],[bell-9,-35],[bell-6,-38],[bell-5,-45]],brass);
      p.path([[bell-8,-35],[bell+8,-35]],gold,2);p.line(bell-3,-44,bell-4,-39,cream,2);
      p.rect(bell-2,-31,5,3,navy);p.rect(bell-1,-31,3,2,gold);
    });
  }

  // The manta faces the viewer. Each membrane is made of individually
  // riveted sail panels; the crescent headlights flank a Fresnel lens.
  function mantaPose(step, phase, free) {
    return picture('manta'+step+phase+free,174,110,86,95,p=>{
      const wing=[-7,-2,4,1][step], tail=[-6,-2,3,1][step];
      const stripe=free?cream:phase?coral:sea, lens=free?gold:phase?coral:cyan;
      p.path([[0,-57],[-2,-68],[-12,-76],[-25,-74],[-36,-80],[-39+tail,-90]],ink,4);
      p.path([[0,-57],[-2,-68],[-12,-76],[-25,-74],[-36,-80],[-39+tail,-90]],teal,2);
      p.poly([[-26,-74],[-37,-76],[-44+tail,-85],[-36,-82],[-33,-82]],gold);
      for(const s of [-1,1]) {
        const points = list => list.map(([x,y])=>[s*x,y]);
        p.poly(points([[5,-50],[18,-57],[34,-59],[56,-59+wing],[79,-70+wing],[83,-69+wing],[77,-52+wing],[69,-41+wing],[54,-37],[48,-29],[32,-26],[25,-15],[13,-12],[6,-22]]),teal);
        p.poly(points([[17,-53],[32,-57],[52,-56+wing],[75,-65+wing],[69,-54+wing],[50,-47],[34,-41],[23,-38]]),tide,null);
        p.poly(points([[32,-41],[50,-46],[68,-52+wing],[65,-44+wing],[52,-39],[46,-33],[34,-30],[26,-22]]),navy,null);
        p.poly(points([[68,-55+wing],[80,-67+wing],[77,-58+wing],[70,-48+wing]]),stripe,null);
        p.path(points([[11,-48],[33,-55],[54,-55+wing],[77,-64+wing]]),pale);
        p.path(points([[12,-44],[25,-46],[32,-43],[40,-48],[50,-49+wing],[59,-53+wing]]),stripe,2);
        p.path(points([[16,-31],[21,-31],[24,-35],[31,-36]]),stripe);
        p.path(points([[18,-51],[26,-44],[32,-32]]),brass);
        p.path(points([[42,-53],[46,-47],[51,-40]]),brass);
        for(const [x,y] of [[25,-46],[46,-48],[60,-53+wing]]){p.rect(s*x,y,2,2,ink);p.rect(s*x,y,1,1,gold);}
        p.poly(points([[11,-34],[18,-38],[25,-35],[25,-30],[21,-25],[15,-25]]),enamel);
        p.line(s*17,-32,s*23,-33,ink,3);p.line(s*17,-31,s*22,-32,lens);
        p.poly(points([[15,-23],[23,-23],[23,-17],[18,-11],[17,-5],[12,-7],[11,-13]]),teal);
        p.line(s*19,-18,s*16,-11,pale);
      }
      p.poly([[-15,-45],[-13,-55],[-8,-61],[0,-64],[7,-61],[14,-55],[16,-43],[18,-33],[14,-19],[8,-12],[0,-8],[-10,-13],[-16,-24],[-18,-33]],navy);
      p.poly([[-12,-48],[-11,-56],[-4,-62],[0,-62],[4,-59],[3,-47],[-2,-39],[-8,-39]],tide);
      p.poly([[0,-61],[7,-59],[12,-55],[13,-47],[8,-38],[2,-41]],teal);
      p.path([[-11,-53],[-7,-57],[-2,-58]],cream);
      p.disc(0,-34,14,14,brass);p.disc(0,-34,11,11,navy);p.disc(0,-34,8,9,teal);p.disc(0,-34,5,7,lens);
      for(let y=-39;y<=-29;y+=3)p.line(-4,y,4,y,pale);
      p.rect(-2,-39,2,7,cream);
      for(const [x,y] of [[0,-46],[-11,-36],[10,-34],[0,-21]])p.pin(x,y);
      p.poly([[-10,-19],[-4,-17],[4,-17],[10,-19],[8,-13],[2,-9],[-4,-10],[-8,-14]],brass);
      for(let x=-5;x<=5;x+=3)p.line(x,-15,x+1,-12,navy);
      if(!free){
        // The lightning yoke visibly breaks away when the storm releases her.
        p.path([[-13,-54],[-17,-62],[-14,-67],[-13,-61],[-10,-62]],phase?coral:gold,2);
        p.path([[11,-55],[16,-62],[14,-67],[13,-61],[10,-63]],phase?coral:gold,2);
      }
    });
  }

  function pixelLine(ax,ay,bx,by,color,size=1) {
    const n=Math.max(1,Math.ceil(Math.max(Math.abs(bx-ax), Math.abs(by-ay))));
    for(let i=0;i<=n;i++) R(Math.round(ax+(bx-ax)*i/n),Math.round(ay+(by-ay)*i/n),size,size,color);
  }
  function diamond(x,y,size,color) {
    x=Math.round(x); y=Math.round(y);
    for(let k=-size;k<=size;k++) R(x-size+Math.abs(k),y+k,(size-Math.abs(k))*2+1,1,color);
  }
  // The closed brass bell announces the preparation. A flare and high note
  // open the boss counter window; regular foes are counterable throughout.
  const bossCounterFrames = 26;
  function counterReady(e) {
    if(e.type==='bellHeron'&&e.state==='scoreTell')return !e.noteSafe&&e.timer<=bossCounterFrames;
    return e.state === 'tell' && (!ENEMY_TYPES[e.type].boss || e.timer <= bossCounterFrames);
  }
  function bossTell(e) {
    if (--e.timer === bossCounterFrames) {
      sparks(e.x,e.y-(e.type==='bellHeron'?48:34),6,cream);
      Snd.tone('sine',784,988,.13,.065);
    }
    return e.timer <= 0;
  }
  function tellBell(e, height) {
    const x=Math.round(e.x), y=Math.round(e.y-height);
    // A sounding bell means the wind-up can be interrupted. Its two
    // outward ticks remain visible even when the target is too far to ring.
    const ready=counterReady(e),light=ready?(e.timer%16<8?cream:gold):brass;
    R(x-4,y-4,9,7,ink);R(x-2,y-5,5,2,ink);R(x-6,y+1,13,3,ink);
    R(x-2,y-4,5,4,light);R(x-3,y-1,7,3,ready?gold:navy);R(x-5,y+2,11,1,light);R(x-1,y+4,3,1,light);
    if(ready){
      R(x-8,y-3,1,5,light);R(x+8,y-3,1,5,light);
      if(e.timer%12<7){R(x-11,y-1,2,1,cream);R(x+10,y-1,2,1,cream);}
    }
  }
  function stunHalo(e,height) {
    if(e.state!=='stun') return;
    for(let i=0;i<3;i++) {
      const a=e.t*.065 + i*2*Math.PI/3;
      diamond(e.x+Math.sin(a)*11,e.y-height+Math.cos(a)*3,2,i===1?cream:cyan);
    }
  }
  function mark(x, y, half, col) {
    x=Math.round(x);y=Math.round(y);
    for(const s of [-1,1]){
      R(x+s*half,y-7,2,6,ink);R(x+s*half,y-6,1,5,col);
      R(x+s*(half-3),y-3,3,1,col);
    }
    for(let j=-half+3;j<half;j+=5) R(x+j,y-1,2,1,col);
  }
  function dots(x0,y0,x1,y1,col) {
    const n=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)/7));
    for(let i=0;i<n;i++) R(Math.round(x0+(x1-x0)*i/n),Math.round(y0+(y1-y0)*i/n),2,1,col);
  }
  function state(e,name,timer) { e.state=name; e.timer=timer; }
  function face(e) { e.facing=G.p.x>=e.x?1:-1; }
  function approach(n,goal,step) { return n+clamp(goal-n,-step,step); }
  function onScreen(e) { return e.x>=G.cam.x+10 && e.x<=G.cam.x+W-10 && !G.p.dead && !G.intro && !G.winT; }
  function floorWalk(e,distance,speed) {
    face(e);
    const x=clamp(G.p.x-e.facing*distance,G.cam.x+24,G.cam.x+W-24);
    e.x=approach(e.x,x,speed); e.y=groundAt(e.x);
  }
  function target(e) {
    e.aimX=G.p.x; e.aimY=G.p.y-(G.p.crouch?8:16);face(e);
  }
  function defeated(e,x,y) {
    sparks(x,y,8,cyan);debris(x,y,6,brass);boom(x,y,.42);
    addScore({quayCrab:130,coilKite:170,squallRam:205,spindleSpider:185,prismSnail:200,galePuffin:195}[e.type],x,y-8);
  }
  function waitStun(e,next,delay) {
    if(e.state!=='stun') return false;
    if(--e.timer<=0) state(e,next,delay);
    return true;
  }
  function signal(freq) { Snd.tone('sine',freq,freq*1.3,.14,.065); }
  function shoot(e,x,y,targetX,targetY,speed,offset=0) {
    const angle=Math.atan2(targetY-y,targetX-x)+offset;
    G.eb.push({k:'l7Spark',owner:e,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:3,life:230});
  }
  function rolling(e,dir,speed) {
    const x=e.x+dir*18;
    G.eb.push({k:'l7Surge',owner:e,x,y:groundAt(x)-7,vx:dir*speed,vy:0,r:6.5,life:225});
  }
  EB_TYPES.l7Spark = {
    r:3,
    draw(b) {
      pixelLine(b.x-b.vx*4,b.y-b.vy*4,b.x,b.y,red,2);
      diamond(b.x,b.y,4,ink);diamond(b.x,b.y,3,coral);diamond(b.x,b.y,1,cream);
    },
    onGround(b){sparks(b.x,b.y,3,coral);}
  };
  EB_TYPES.l7Surge = {
    r:6.5,
    update(b){b.y=groundAt(b.x+b.vx)-7;},
    draw(b) {
      const x=Math.round(b.x), y=Math.round(b.y), s=Math.sign(b.vx);
      pixelLine(x-s*9,y+3,x-s*5,y-5,red,3);
      pixelLine(x-s*5,y-5,x-s*2,y-2,gold,2);
      pixelLine(x-s*2,y-2,x+s,y-8,cream,2);
      diamond(x,y,4,coral);R(x-2,y-1,4,3,cream);
    }
  };

  ENEMY_TYPES.quayCrab = {
    hp:4, melee:true, contact:e=>e.state==='rush'?'hurt':'none',
    box:e=>({x:e.x-16,y:e.y-29,w:32,h:29}),
    make(e,spec){e.primed=!!spec.rushLesson;e.inv=e.primed;state(e,'walk',e.primed?1:35);},
    update(e){
      if(waitStun(e,'walk',48))return;
      if(e.state==='walk'){
        floorWalk(e,49,e.primed?.95:.7);
        if(onScreen(e)&&Math.abs(e.x-G.p.x)<(e.primed?145:112) && --e.timer<=0){
          target(e);state(e,'tell',e.primed?38:30);signal(400);
        }
      }else if(e.state==='tell'){
        if(--e.timer<=0)state(e,'rush',27);
      }else{
        e.x=clamp(e.x+e.facing*2.65,G.cam.x+12,G.cam.x+W-12);e.y=groundAt(e.x);
        if(e.primed && e.timer<=15){e.primed=false;e.inv=false;}
        if(e.t%7===0)dust(e.x,e.y,2,-e.facing);
        if(--e.timer<=0)state(e,'walk',75);
      }
    },
    draw(e){
      drawPose(e,crabPose(Math.floor(e.t/7)%2,e.primed||e.state==='tell'||e.state==='rush'));
      if(e.primed){
        const x=e.x+e.facing*21,y=e.y-16,spread=e.state==='rush'?9:3+(e.t>>2)%5;
        for(let i=0;i<3;i++)R(Math.round(x-e.facing*(i*4+spread)),Math.round(y+i*2),3,1,i===0?cream:gold);
        if(e.state==='tell')text('JUMP OR RING',e.x,e.y-57,cream,1,'center',ink);
      }
      if(e.state==='tell')tellBell(e,43);
      stunHalo(e,39);
    },onKill:defeated
  };

  ENEMY_TYPES.coilKite = {
    hp:4, flying:true, contact:'none',
    box:e=>({x:e.x-15,y:e.y-32,w:31,h:29}),
    make(e,spec){e.y=spec.y||groundAt(e.x)-40;e.height=clamp(groundAt(e.x)-e.y,26,88);state(e,'drift',65);},
    update(e){
      if(waitStun(e,'drift',65))return;
      if(e.state==='drift'){
        face(e);
        e.x=approach(e.x,clamp(G.p.x-e.facing*124,G.cam.x+22,G.cam.x+W-22),.65);
        e.y=approach(e.y,groundAt(e.x)-e.height+Math.sin(e.t*.035)*9,.8);
        if(onScreen(e)&&Math.abs(e.x-G.p.x)<255 && --e.timer<=0){
          target(e);state(e,'tell',40);signal(585);
        }
      }else if(--e.timer<=0){
        shoot(e,e.x+e.facing*3,e.y-18,e.aimX,e.aimY,1.75);Snd.tone('triangle',580,240,.12,.055);
        state(e,'drift',90);
      }
    },
    draw(e){
      if(e.state==='tell') {
        dots(e.x,e.y-18,e.aimX,e.aimY,coral);tellBell(e,47);
      }
      drawPose(e,kitePose(Math.floor(e.t/8)%4,e.state==='tell'),false);
      stunHalo(e,43);
    },onKill:defeated
  };

  ENEMY_TYPES.squallRam = {
    hp:7, melee:true, armored:true, contact:'none',
    box:e=>({x:e.x-19,y:e.y-34,w:40,h:34}),
    make(e,spec){
      e.primed=!!spec.waveLesson;e.inv=e.primed;state(e,'walk',8);
    },
    update(e){
      if(waitStun(e,'walk',60))return;
      if(e.state==='walk'){
        floorWalk(e,120,.75);
        if(onScreen(e)&&Math.abs(e.x-G.p.x)<265&&--e.timer<=0){
          target(e);state(e,'tell',e.primed?40:32);signal(245);
        }
      }else if(--e.timer<=0){
        rolling(e,e.facing,e.primed?1.55:2.05);dust(e.x,e.y,8,e.facing);
        e.primed=false;e.inv=false;
        Snd.tone('triangle',200,85,.19,.09);state(e,'walk',95);
      }
    },
    draw(e){
      drawPose(e,ramPose(Math.floor(e.t/8)%4,e.primed||e.state==='tell'));
      if(e.primed){
        const x=Math.round(e.x+e.facing*14),y=Math.round(e.y-28),oscillate=Math.round(Math.sin(e.t*.22)*2);
        for(const s of [-1,1]){diamond(x+s*(14+oscillate),y,2,gold);diamond(x,y+s*(13+oscillate),1,cream);}
        if(e.state==='tell')text('JUMP THE WAVE',e.x,e.y-66,cream,1,'center',ink);
      }
      if(e.state==='tell'){
        tellBell(e,51);
        for(let i=1;i<=3;i++){
          const x=e.x+e.facing*(25+i*9), y=groundAt(x)-2;
          pixelLine(x-e.facing*3,y-4,x,y,gold);
        }
      }
      stunHalo(e,47);
    },onKill:defeated
  };

  // Silk is paid out from the abdomen between two brass cheeks. Four pairs of
  // hinged legs tuck in for the fall, then spread to brace the exposed reel.
  function spindlePose(pose, frame) {
    return picture('spindle-' + pose + frame, 73, 49, 36, 45, p => {
      const plum = '#52395b', wine = '#864e69', rose = '#c97884', silk = '#c6dfda';
      const open = pose === 'open', dive = pose === 'drop', coiled = pose === 'tell';
      const shift = open ? 4 : dive ? -2 : 0;
      const steps = [-1,0,1,0];
      for (const side of [-1,1]) {
        // The back legs arch up over the spool. The front tarsi touch the
        // surface in recovery and point straight down during the descent.
        const legs = [[7,-26,16,-34,25,-25],[9,-22,24,-29,31,-16],
          [10,-18,23,-18,29,-4],[8,-15,19,-12,16,-1]];
        for (let k=0;k<legs.length;k++) {
          const [ax,ay,kx,ky,tx,ty] = legs[k], flex = steps[(frame+k)%4];
          const spread = dive ? .64 : coiled ? .81 : 1;
          const kneeX = side * Math.round(kx*spread+(open?2:0));
          const toeX = side * Math.round(tx*spread+(open?3:0));
          const kneeY = ky+shift+(coiled?-2:0)+flex;
          const toeY = open && k>=2 ? 0 : ty+(dive?4:0)+flex;
          const leg = [[side*ax,ay+shift],[kneeX,kneeY],[toeX,toeY]];
          p.path(leg,ink,3); p.path(leg,k<2?brass:tide,1);
          p.rect(kneeX,kneeY,3,2,k<2?gold:sea); p.rect(kneeX,kneeY,1,1,cream);
          p.line(toeX,toeY,toeX+side*(k<2?3:2),toeY+(k<2?1:0),ink,2);
        }
      }
      const y=shift;
      p.poly([[-11,-29+y],[-8,-34+y],[6,-34+y],[11,-29+y],[11,-17+y],
        [7,-12+y],[-6,-12+y],[-11,-18+y]],plum);
      p.rect(-7,-33+y,11,2,rose);p.rect(-5,-35+y,7,2,brass);
      p.rect(-1,-37+y,2,3,silk);
      // Pale diagonal strands wind around a horizontal bobbin. The staggered
      // seam advances a quarter turn on every animation frame.
      p.rect(-7,-28+y,15,11,open?enamel:wine);
      for (let j=0;j<4;j++){
        const row=-27+y+j*2;
        p.line(-6,row,6,row+1,open?silk:rose);
        p.rect(-5+(frame*3+j*2)%11,row,2,1,open?cream:enamel);
      }
      for (const side of [-1,1]){
        const x=side*(open?13:9);
        p.poly([[x-2,-30+y],[x+2,-30+y],[x+3,-27+y],[x+3,-17+y],
          [x,-14+y],[x-3,-16+y],[x-3,-26+y]],brass);
        p.line(x-1,-28+y,x-1,-19+y,gold);p.rect(x-1,-28+y,2,2,cream);
      }
      p.poly([[-10,-17+y],[-5,-21+y],[4,-20+y],[10,-16+y],[8,-9+y],
        [4,-6+y],[-4,-6+y],[-9,-10+y]],teal);
      p.path([[-7,-16+y],[-3,-18+y],[4,-17+y]],sea);
      p.rect(-6,-14+y,12,4,navy);
      const eye=coiled?gold:open?cream:cyan;
      for(const x of [-5,-2,2,5])p.rect(x,-13+y,2,2,eye);
      p.path([[-5,-9+y],[-6,-5+y],[-3,-3+y]],ink,2);
      p.path([[4,-9+y],[6,-5+y],[3,-3+y]],ink,2);
      p.rect(-6,-5+y,2,1,brass);p.rect(5,-5+y,2,1,brass);
    });
  }

  ENEMY_TYPES.spindleSpider = {
    hp:7, flying:true, melee:true,
    contact:e=>e.state==='drop'||e.state==='impact'?'hurt':'none',
    box(e) {
      const open=e.state==='rest'||e.state==='stun',half=open?16:12;
      return {x:e.x-half,y:e.y-(open?26:33),w:half*2,h:open?26:31};
    },
    make(e,spec) {
      // Match the engine's one-way platform edges. The first surface below
      // the anchor remains the destination even when the hero changes lanes.
      let floor=groundAt(e.x);
      for(const pl of LV.plats)if(e.x>pl.x-3&&e.x<pl.x+pl.w+3)floor=Math.min(floor,pl.y);
      e.landingY=floor;
      e.roostY=clamp(spec.y ?? Math.max(83,Math.min(99,floor-73)),78,floor-23);
      e.y=e.roostY;e.vy=0;state(e,'hang',0);
    },
    update(e) {
      if(e.state==='hang'){
        e.y=e.roostY+Math.sin(e.t*.073)*1.4;
        if(e.timer>0){e.timer--;return;}
        if(onScreen(e)&&Math.abs(G.p.x-e.x)<=105){
          e.y=e.roostY;state(e,'tell',46);signal(485);
        }
      }else if(e.state==='tell'){
        if(--e.timer<=0){e.vy=1.6;state(e,'drop',0);Snd.tone('triangle',490,194,.16,.055);}
      }else if(e.state==='drop'){
        e.vy=Math.min(6.3,e.vy+.49);e.y=Math.min(e.landingY,e.y+e.vy);
        if(e.y===e.landingY){
          state(e,'impact',6);dust(e.x,e.landingY,4);Snd.clank();
        }
      }else if(e.state==='impact'){
        if(--e.timer<=0)state(e,'rest',57);
      }else if(e.state==='stun'){
        // The bell releases the clutch. The harmless spider slides down
        // the line into the player's normal horizontal firing lane.
        e.y=approach(e.y,e.landingY,4.4);
        if(--e.timer<=0)state(e,'rest',32);
      }else if(e.state==='rest'){
        if(--e.timer<=0){state(e,'reel',0);Snd.tone('triangle',225,390,.14,.038);}
      }else if(e.state==='reel'){
        e.y=approach(e.y,e.roostY,1.55);
        if(e.y===e.roostY)state(e,'hang',52);
      }
    },
    draw(e) {
      const x=Math.round(e.x), anchor=Math.round(e.roostY-46), tip=Math.round(e.y-34);
      const moving=e.state==='drop'||e.state==='reel'||e.state==='stun';
      // A doubled strand remains readable over pale blossoms and dark rock.
      R(x-1,20,2,Math.max(1,anchor-19),navy);R(x,20,1,Math.max(1,anchor-19),brass);
      RO(x-5,anchor-3,11,5,brass);R(x-3,anchor-2,6,1,gold);
      R(x-1,anchor+1,3,Math.max(1,tip-anchor),ink);
      R(x,anchor+2,1,Math.max(1,tip-anchor-1),sea);
      const advance=moving?(e.state==='reel'?-1:1)*Math.floor(e.t/3):0;
      for(let y=anchor+4+((advance%8)+8)%8;y<tip;y+=8)R(x,y,1,2,cream);

      if(e.state==='tell'||e.state==='drop'){
        dots(x,e.y+3,x,e.landingY-7,coral);
        mark(x,e.landingY,18,e.state==='drop'||e.timer<15?cream:gold);
        if(e.state==='tell')tellBell(e,43);
      }else if(e.state==='impact'){
        const spread=10+(6-e.timer)*2;
        for(const side of [-1,1])pixelLine(x+side*(spread-4),e.landingY-2,x+side*spread,e.landingY-6,gold,2);
      }
      const pose=e.state==='rest'||e.state==='stun'?'open':e.state==='impact'?'drop':e.state;
      drawPose(e,spindlePose(pose,Math.floor(e.t/(moving?4:8))%4),false);
      stunHalo(e,32);
    },
    onKill:defeated
  };

  // A glassworks kiln cart whose nautilus shell is held together with lead came.
  // Four baked shutter angles expose the ruby lamp in its brass frame.
  function prismSnailPose(gait, shutter, cracked) {
    return picture('prismSnail'+gait+shutter+cracked,70,53,33,50,p=>{
      const rose='#ae5571', pink='#f6a5a0', blue='#435b90', ice='#91cde0';
      const belly='#466569', foot='#759a8e', lead='#29434b';
      const wave=[0,1,1,0][gait], stretch=[1,1,0,-1][gait];
      // The soft mechanical foot travels in three ripples under a heavy shell.
      p.poly([[-31,-3],[-24,-7],[-17,-10],[-6,-11],[7,-10],[19,-11],
        [25+stretch,-13],[28+stretch,-10],[26,-6],[16,-2],[5,-1],[-14,-1],[-24,0]],belly);
      p.path([[-29,-3],[-21,-4],[-13,-6-wave],[-5,-5],[3,-6+wave],[12,-5-wave],[18,-7]],foot,2);
      p.line(-21,-2,-13,-3,sea);p.line(1,-3,7,-3,pale);
      p.poly([[8,-9],[12,-16],[17,-20],[23+stretch,-20],[28+stretch,-17],[28+stretch,-13],[24,-10],[17,-9]],tide);
      for(const [ax,ay,bx,by] of [[18,-20,18+stretch,-28-wave],[22,-20,29+stretch,-27+wave]]){
        p.line(ax,ay,bx,by,ink,2);p.line(ax,ay,bx,by,sea);p.disc(bx,by,2,2,brass);
        p.rect(bx,by,1,1,cream);
      }
      p.line(24+stretch,-16,27+stretch,-16,ink);p.rect(24+stretch,-16,2,1,gold);
      // Each pane has its own beveled leading edge. The dark spiral identifies
      // a shell even when the head and eyestalks fold into the shutters.
      p.poly([[-21,-9],[-26,-14],[-27,-25],[-24,-34],[-17,-40],[-7,-43],
        [3,-42],[11,-36],[15,-27],[13,-19],[7,-12],[-5,-9]],lead);
      p.poly([[-25,-25],[-22,-33],[-15,-38],[-11,-30],[-17,-26],[-19,-19],[-24,-17]],teal);
      p.path([[-23,-26],[-20,-33],[-16,-35]],ice);
      p.poly([[-14,-39],[-7,-41],[2,-40],[4,-34],[-5,-32],[-10,-30]],rose);
      p.path([[-12,-38],[-7,-39],[-3,-39]],pink);
      p.poly([[3,-40],[9,-35],[12,-29],[5,-25],[1,-29],[4,-34]],blue);
      p.path([[4,-37],[8,-34],[9,-32]],ice);
      p.poly([[-24,-16],[-18,-19],[-15,-13],[-9,-10],[-21,-11]],violet);
      p.poly([[-18,-24],[-13,-29],[-5,-31],[2,-28],[4,-23],[-1,-17],[-8,-15],[-15,-18]],tide);
      p.path([[-19,-21],[-17,-26],[-12,-30],[-5,-31],[1,-29],[4,-24],[1,-19],[-5,-17],[-11,-18],[-13,-22],[-10,-25],[-5,-26],[-3,-24],[-4,-22]],lead,2);
      p.path([[-16,-26],[-12,-29],[-7,-30]],pale);p.line(-10,-22,-8,-24,ice);
      // Hairline fractures split into smaller rays inside the coloured glass.
      p.path([[-8,-40],[-7,-36],[-10,-34],[-9,-32]],pink);p.line(-7,-36,-4,-35,lead);
      p.path([[-23,-25],[-20,-24],[-20,-20]],sea);
      if(cracked){
        p.path([[-16,-37],[-14,-32],[-11,-31],[-14,-28],[-11,-26]],cream);
        p.path([[-14,-32],[-17,-31],[-18,-28]],ice);p.path([[7,-35],[5,-33],[7,-31],[4,-29]],pink);
      }
      for(const [x,y] of [[-23,-16],[-20,-32],[-5,-40],[9,-33],[-7,-12]])p.pin(x,y);
      // In profile the shutters read as a small lighthouse lantern. Their
      // horizontal slats turn edge-on and reveal the red Fresnel glass.
      p.poly([[5,-30],[10,-31],[15,-27],[16,-16],[11,-12],[5,-14],[3,-22]],brass);
      p.poly([[7,-27],[12,-27],[14,-24],[13,-16],[8,-15],[5,-19]],navy);
      p.disc(10,-21,4,5,red);p.rect(9,-23,2,4,pink);p.rect(9,-24,1,2,cream);
      const slatHeight=[4,3,2,1][shutter], slatShift=[0,0,1,2][shutter];
      for(let j=0;j<3;j++){
        const y=-27+j*5;
        p.line(6,y,13+slatShift,y+1,ink,slatHeight+1);
        p.line(6,y,13+slatShift,y+1,shutter===3?brass:shadow,slatHeight);
        p.line(7,y,12+slatShift,y+1,shutter===3?gold:sea);
      }
      p.pin(5,-29);p.pin(13,-13);
    });
  }

  function snailShutter(e) {
    if(e.state==='open')return 3;
    if(e.state==='tell')return clamp(Math.floor((42-e.timer)/10),0,3);
    return 0;
  }

  ENEMY_TYPES.prismSnail = {
    hp:7, armored:true, contact:'none',
    box:e=>({x:e.x-22,y:e.y-40,w:44,h:39}),
    make(e){e.catchT=0;e.turnT=0;e.catchHint=false;state(e,'sealed',46);},
    // Owned by the lamp gun's onHit hook. A returning spark, grenade, charged
    // lamp shot, or shot into the unguarded back can damage the body normally.
    catchLight(e,b){
      if(b.pierce || b.vx*e.facing>=0 || snailShutter(e)===3)return false;
      e.catchT=14;
      const sx=e.x+e.facing*10,sy=e.y-21;
      sparks(sx,sy,4,cyan);
      Snd.tone('sine',910,640,.09,.04);
      if(!e.catchHint){
        e.catchHint=true;
        G.texts.push({x:e.x,y:e.y-55,s:'RING THE SHUTTER',c:cream,t:74});
      }
      return true;
    },
    ringOpen(e){
      if(e.dead||e.dying||e.state==='open')return false;
      state(e,'open',92);e.catchT=0;
      sparks(e.x+e.facing*9,e.y-21,9,cyan);signal(735);
      return true;
    },
    update(e){
      if(e.catchT>0)e.catchT--;
      if(e.state==='sealed'){
        // The little motor needs time to turn the heavy kiln. The hero can
        // cross the shell and fire from behind before it turns around.
        const side=Math.sign(G.p.x-e.x);
        if(side && side!==e.facing){
          if(++e.turnT>=48){e.facing=side;e.turnT=0;}
        }else e.turnT=0;
        const ahead=(G.p.x-e.x)*e.facing;
        if(ahead>88 || ahead<0){
          e.x=clamp(e.x+e.facing*.38,0,LV.end);
          e.y=groundAt(e.x);
        }
        if(onScreen(e) && --e.timer<=0){
          e.aimX=ahead>=0?G.p.x:e.x+e.facing*125;
          e.aimY=ahead>=0?G.p.y-(G.p.crouch?9:17):e.y-18;
          state(e,'tell',42);signal(416);
        }
      }else if(e.state==='tell'){
        if(--e.timer<=0){
          shoot(e,e.x+e.facing*18,e.y-20,e.aimX,e.aimY,1.4);
          Snd.tone('triangle',620,350,.18,.065);state(e,'open',74);
        }
      }else if(--e.timer<=0){
        state(e,'sealed',56);e.turnT=0;Snd.tone('triangle',330,215,.1,.03);
      }
    },
    draw(e){
      const gait=e.state==='sealed'?Math.floor(e.t/10)%4:1;
      drawPose(e,prismSnailPose(gait,snailShutter(e),e.hp<=e.max/2));
      const sx=e.x+e.facing*10,sy=e.y-21;
      if(e.state==='tell'){
        dots(sx,sy,e.aimX,e.aimY,coral);tellBell(e,54);
      }
      if(e.catchT){
        const spread=3+(14-e.catchT)*.5,dir=e.facing;
        diamond(sx,sy,3,cream);
        pixelLine(sx+dir*3,sy-2,sx+dir*spread,sy-spread,cyan);
        pixelLine(sx+dir*4,sy+1,sx+dir*(spread+2),sy+2,cream);
      }
    },onKill:defeated
  };

  // A clockwork puffin lowers its grapnel and winds up a set of bellows.
  // The dashed band shows the full reach. Wind travels along that same band.
  const puffinReach = 193, puffinBeak = 26, puffinHalfLane = 2;
  const puffinTellTime = 49, puffinAnchorTime = 26, puffinGustTime = 32;
  function puffinPose(frame, pose) {
    return picture('galePuffin'+pose+frame,69,53,35,47,p=>{
      const anchored=pose!==0, open=pose===2?3:0;
      const bob=anchored?0:[0,-1,0,1][frame];
      // The figure-eight winding key turns edge-on once per beat.
      const keyHeight=[5,3,1,3][frame];
      p.line(-17,-16,-25,-21,ink,3);p.line(-18,-16,-25,-20,brass,1);
      p.disc(-27,-20-keyHeight,3,Math.max(1,keyHeight-1),gold);
      p.disc(-27,-20+keyHeight,3,Math.max(1,keyHeight-1),brass);
      if(keyHeight>2){p.rect(-28,-21-keyHeight,2,2,navy);p.rect(-28,-20+keyHeight,2,2,navy);}
      p.poly([[-13,-18],[-23,-17],[-25,-12],[-15,-13],[-23,-9],[-10,-8]],navy);
      // Enamel breast surrounds the pressure gauge and folding copper bellows.
      p.poly([[-17,-19],[-13,-28],[-3,-31],[8,-27],[13,-18],[11,-10],[4,-4],[-6,-4],[-14,-9]],navy);
      p.poly([[-3,-22],[7,-25],[12,-20],[11,-11],[4,-5],[-3,-5],[-7,-11]],enamel);
      p.path([[-3,-7],[4,-7],[9,-12]],shadow);
      p.disc(4,-15,5,5,brass);p.disc(4,-15,3,3,navy);
      p.line(4,-15,5+(pose===2?1:0),-17+(pose===2?2:0),pose===2?coral:cyan);
      for(const dx of [-8,4]){
        const foot=anchored?3:1+bob;
        p.line(dx,-7,dx+1,-4+foot,brass,2);
        p.poly([[dx,-4+foot],[dx+5,-3+foot],[dx+8,-1+foot],[dx+3,-1+foot],[dx+1,foot],[dx-3,-1+foot]],coral);
      }
      // Hinged primary feathers sweep up, fold at anchor, then flare under pressure.
      const tipX=pose===0?[-24,-25,-23,-19][frame]:pose===1?-16:-25;
      const tipY=pose===0?[-39,-30,-17,-9][frame]:pose===1?-8:-25;
      p.poly([[-10,-23],[-14,-25],[tipX,tipY],[tipX-2,tipY+4],[tipX+1,tipY+9],[tipX+4,tipY+11],[-10,-12],[-5,-18]],navy);
      p.path([[-12,-22],[tipX,tipY+3],[tipX+1,tipY+6]],tide);
      p.path([[-11,-19],[tipX+4,tipY+8]],teal); p.pin(-9,-20);
      const neck=bob+(pose===1?1:0);
      p.poly([[-10,-28+neck],[-9,-36+neck],[-4,-41+neck],[4,-43+neck],
        [12,-39+neck],[15,-34+neck],[13,-28+neck],[9,-24+neck],[0,-22+neck],[-7,-24+neck]],navy);
      p.poly([[-6,-32+neck],[-2,-37+neck],[6,-37+neck],[12,-34+neck],[13,-30+neck],
        [9,-26+neck],[2,-24+neck],[-5,-26+neck]],pale);
      p.path([[-7,-36+neck],[-3,-39+neck],[4,-40+neck]],tide);
      p.poly([[3,-36+neck],[8,-37+neck],[10,-34+neck],[8,-30+neck],[5,-29+neck]],coral);
      p.disc(7,-34+neck,2,2,ink);p.rect(7,-35+neck,1,1,cream);
      // Three beak plates form the nozzle: slate-blue root, gold binding, vermilion tip.
      p.poly([[11,-37+neck],[19,-35+neck],[27,-30+neck],[30,-26+neck],
        [27,-24+neck],[17,-24+neck],[11,-27+neck]],coral);
      p.poly([[11,-36+neck],[17,-35+neck],[16,-25+neck],[11,-28+neck]],teal);
      p.path([[17,-35+neck],[19,-32+neck],[17,-25+neck]],gold,2);
      p.line(21,-32+neck,26,-29+neck,cream);
      p.poly([[12,-26+neck],[27,-26+neck],[25,-23+neck+open],[16,-22+neck+open],[11,-24+neck]],red);
      p.line(15,-25+neck,26,-25+neck,ink);p.rect(12,-33+neck,2,2,navy);
    });
  }

  function puffinWindSpan(e) {
    if(e.state==='tell')return [puffinBeak,puffinReach];
    const elapsed=puffinGustTime-e.timer;
    const front=Math.min(puffinReach,puffinBeak+elapsed*10);
    const rear=Math.min(puffinReach,puffinBeak+Math.max(0,elapsed-12)*10);
    return [rear,front];
  }
  function drawPuffinWind(e) {
    const [near,far]=puffinWindSpan(e),dir=e.facing,y=e.windY;
    const px=d=>Math.round(e.x+dir*d);
    if(e.state==='tell'){
      for(let d=near+5;d<far;d+=8){
        R(px(d),y-puffinHalfLane,3,1,sea);R(px(d),y+puffinHalfLane,3,1,sea);
      }
      for(let i=0;i<4;i++){
        const d=near+((e.t*1.1+i*39)%(far-near));
        pixelLine(px(d-4),y-2,px(d),y,gold);pixelLine(px(d),y,px(d-4),y+2,gold);
      }
      // A loose vane feather falls with the descending beak, then streams
      // outward along the sight line when the wind-up is complete.
      const d=near+9+(e.t%19), featherY=Math.round((e.y-26+y)/2)-1;
      pixelLine(px(d-6),featherY+2,px(d+2),featherY-2,tide,2);
      pixelLine(px(d-3),featherY,px(d+2),featherY-2,pale);
      R(px(d-2),featherY-2,2,2,cream);
      R(px(far),y-3,1,7,cream);
    }else if(far>near){
      pixelLine(px(near),y,px(far),y,tide);
      for(let d=near;d<far;d+=14){
        const end=Math.min(d+7,far);
        pixelLine(px(d),y-1,px(end),y-puffinHalfLane,cyan);
        pixelLine(px(Math.min(far,d+2)),y+puffinHalfLane,px(end),y+1,pale);
      }
      pixelLine(px(Math.max(near,far-4)),y-2,px(far),y,cream);
      pixelLine(px(far),y,px(Math.max(near,far-4)),y+2,cream);
    }
  }
  function pushPuffinWind(e) {
    const p=G.p;
    if(p.dead || p.ride || p.crouch || G.intro || G.winT || e.windLeft<=0)return;
    const [near,far]=puffinWindSpan(e);
    if(far<=near)return;
    const laneX=e.x+e.facing*near, tipX=e.x+e.facing*far;
    if(!overlap(pbox(p),{x:Math.min(laneX,tipX),y:e.windY-puffinHalfLane,w:far-near,h:puffinHalfLane*2+1}))return;
    let next=clamp(p.x+e.facing*Math.min(1.5,e.windLeft),G.cam.x+8,G.cam.x+W-8);
    if(p.onPlat){
      // Stop at the current platform's edge, preserving the hero's foothold.
      const pl=p.onPlat;
      next=clamp(next,Math.min(p.x,pl.x+2),Math.max(p.x,pl.x+pl.w-2));
    }
    next=L7Signal.limitWindStep(p.x,next);
    e.windLeft-=Math.abs(next-p.x);p.x=next;
  }
  ENEMY_TYPES.galePuffin={
    hp:8,flying:true,contact:'none',
    box:e=>({x:e.x-17,y:e.y-39,w:34,h:36}),
    make(e){e.y=groundAt(e.x)-38;state(e,'hover',24);},
    update(e){
      if(e.dead)return;
      if(waitStun(e,'hover',73))return;
      if(e.state==='hover'){
        face(e);
        const perch=clamp(G.p.x-e.facing*108,G.cam.x+26,G.cam.x+W-26);
        e.x=approach(e.x,perch,.83);
        e.y=approach(e.y,groundAt(e.x)-38+Math.sin(e.t*.065)*6,.85);
        if(!onScreen(e)||Math.abs(G.p.x-e.x)>puffinReach||--e.timer>0)return;
        e.windY=Math.round(groundAt(G.p.x)-29);
        state(e,'tell',puffinTellTime);signal(348);
      }else if(e.state==='tell'){
        // Unwind the grapnel above the low firing lane, then settle the beak into it.
        if(e.timer<=puffinTellTime-puffinAnchorTime)e.y=approach(e.y,e.windY+26,2.4);
        if(--e.timer<=0){
          e.windLeft=18;state(e,'gust',puffinGustTime);
          Snd.noise(.20,.045,1150);Snd.tone('triangle',630,270,.18,.035);
        }
      }else if(e.state==='gust'){
        e.timer--;pushPuffinWind(e);
        if(e.timer<=0)state(e,'hover',89);
      }
    },
    draw(e){
      if(e.dead)return;
      const firing=e.state==='tell'||e.state==='gust';
      if(firing){
        const x=Math.round(e.x-e.facing*6),floor=Math.round(groundAt(x))-1;
        const anchor=e.state==='tell'?Math.round(approach(e.y+1,floor,(puffinTellTime-e.timer)*2)):floor;
        pixelLine(x,e.y-2,x,anchor,brass);R(x-3,anchor-1,7,2,ink);R(x-2,anchor-2,5,1,gold);
        drawPuffinWind(e);
      }
      const pose=e.state==='gust'?2:e.state==='tell'||e.state==='stun'?1:0;
      drawPose(e,puffinPose(Math.floor(e.t/6)%4,pose));
      if(e.state==='tell')tellBell(e,50);
      stunHalo(e,46);
    },
    onKill:defeated
  };

  function bossIntro(e,duration,sideInset,drop) {
    e.x=G.cam.x+W-sideInset;e.y=groundAt(e.x)-drop;e.originY=e.y;
    e.turn=0;e.phase=0;e.inv=true;e.facing=-1;state(e,'intro',duration);
  }
  function enterBoss(e,duration,altitude){
    const q=1-(--e.timer)/duration, ground=groundAt(e.x)-altitude;
    e.y=ground-(ground-e.originY)*(1-q)*(1-q);
    if(e.timer<=0){e.inv=false;state(e,'rest',e.type==='bellHeron'?24:48);dust(e.x,groundAt(e.x),5);}
  }
  function clearShots(e){G.eb=G.eb.filter(b=>b.owner!==e);}
  function bossCountered(e) {
    if(e.state!=='stun')return false;
    if(e.type==='stormManta')e.y=approach(e.y,groundAt(e.x)-5,1.6);
    else if(e.attack==='spear'){
      const q=1-e.timer/42;
      e.x=e.counterX-e.facing*18*q;e.y=groundAt(e.x)-Math.sin(Math.PI*q)*21;
    }
    if(--e.timer<=0){
      if(e.type==='bellHeron')e.y=groundAt(e.x);
      // A parried chime leaves the long-necked Heron off balance. A Manta
      // folds its fins and recovers faster after a fan than after a dive.
      state(e,'rest',e.type==='bellHeron'?22:e.attack==='fan'?17:37);
    }
    return true;
  }
  function targetLabel(e,s) {
    const x=clamp(e.x,G.cam.x+45,G.cam.x+W-45);
    const y=Math.max(63,Math.min(e.y-(e.type==='bellHeron'?119:98),130));
    text(s,x,y,cream,1,'center',ink);
  }

  // Three bells divide the roof into sounding lanes. The first and last
  // movements are free combat; the roof plays a short left-right-middle
  // carillon phrase between them. A bright rope can be rung or shot.
  const heronBellOffsets=[100,240,380], heronPhrase=[0,2,1], heronNotes=[523.25,659.25,783.99];
  const heronLane=40,heronKnotY=157,heronBeats=['I','II','III'];
  function heronTone(index){
    const freq=heronNotes[index];
    Snd.tone('sine',freq,freq,.61,.115);Snd.tone('triangle',freq*2,freq*1.995,.39,.045);
  }
  function heronHint(e){
    if(!e || e.type!=='bellHeron' || e.dying)return '';
    if(e.state==='scoreRise')return 'ROOFTOP CARILLON  /  THREE BELLS WILL ANSWER';
    if(e.state==='scoreTell'||e.state==='scoreStrike'||e.state==='scoreGap'){
      const beat='BEAT '+(e.beat+1)+'/3';
      if(e.noteSafe)return beat+'  /  NOTE RETURNED';
      if(e.state==='scoreGap')return beat+'  /  LISTEN FOR THE NEXT BELL';
      if(e.state==='scoreStrike')return beat+'  /  STAY OUT OF THE GOLD LANE';
      if(e.timer<=bossCounterFrames && Math.abs(G.p.x-e.noteX)<=68){
        return L7Signal.ready()?beat+'  /  V NOW  -  ANSWER THE LIT ROPE':beat+'  /  BELL RECHARGING - LEAVE THE GOLD LANE';
      }
      return beat+'  /  LEAVE THE MARK OR SHOOT THE ROPE KNOT';
    }
    if(e.state==='scoreFall')return 'SECOND MOVEMENT  /  WATCH FOR PAIRED ATTACKS';
    if(e.state==='tell'){
      if(counterReady(e)&&distToBox(G.p.x,G.p.y-19,ebox(e))<=122){
        return L7Signal.ready()?'V NOW  /  RETURN THE HERON CALL':'BELL RECHARGING  /  DODGE THE STRIKE';
      }
      if(e.attack==='spear')return e.spearMarks.length>1?'TWIN SPEARS  /  CLEAR BOTH NUMBERED MARKS':'SPEAR DROP  /  STEP OFF THE MARK';
      if(e.attack==='pair')return 'TWO LOW CHIMES  /  JUMP EACH WAVE';
      if(e.attack==='chime')return 'LOW CHIME  /  JUMP OVER THE WAVE';
      return 'GLASS FEATHERS  /  MOVE OR RETURN A SHOT';
    }
    if(e.state==='betweenWaves')return 'SECOND CHIME  /  JUMP AGAIN';
    if(e.state==='recovery')return 'THE BREAST BELL IS OPEN  /  FIRE';
    return '';
  }
  function clearHeronRope(e){
    if(e.rope){e.rope.dead=true;e.rope=null;}
  }
  function returnedNote(e){
    if(e.state!=='scoreTell'||e.noteSafe)return false;
    e.noteSafe=true;e.answers++;clearHeronRope(e);
    sparks(e.noteX,heronKnotY,12,cyan);heronTone(e.noteIndex);
    return true;
  }
  ENEMY_TYPES.heronBellRope={
    hp:1,contact:'none',
    make(o,spec){o.owner=spec.owner;o.y=heronKnotY;o.active=true;},
    box:o=>({x:o.x-9,y:heronKnotY-10,w:18,h:20}),
    update(o){if(!o.owner||o.owner.dead||o.owner.dying||o.owner.rope!==o)o.dead=true;},
    draw(){}, // The conductor draws the matching knot and both ends of this rope.
    onKill(o){if(o.owner) returnedNote(o.owner);}
  };
  function startHeronBeat(e){
    clearHeronRope(e);
    e.noteIndex=heronPhrase[e.beat];e.noteX=e.courtX+heronBellOffsets[e.noteIndex];e.noteSafe=false;
    e.rope=makeEnemy({t:'heronBellRope',x:e.noteX,owner:e},null);
    G.enemies.push(e.rope);state(e,'scoreTell',68);
    Snd.tone('sine',heronNotes[e.noteIndex]*.5,heronNotes[e.noteIndex]*.5,.16,.065);
  }
  function startHeronScore(e){
    clearShots(e);clearHeronRope(e);
    e.hp=Math.max(e.hp,e.max/2);e.inv=true;e.movement=2;e.turn=0;
    e.beat=0;e.answers=0;e.noteSafe=false;e.noteX=null;
    e.startX=e.x;e.startY=e.y;
    state(e,'scoreRise',52);
    for(const [i,f] of [262,330,392].entries())Snd.tone('triangle',f,f,.27,.065,i*.16);
  }
  function updateHeronScore(e){
    if(e.state==='scoreRise'){
      const q=(52- --e.timer)/52;
      e.x=e.startX+(e.courtX+310-e.startX)*q;e.y=e.startY+(groundAt(e.x)-47-e.startY)*q-Math.sin(Math.PI*q)*17;
      if(e.timer===0)startHeronBeat(e);
    }else if(e.state==='scoreTell'){
      e.y=groundAt(e.x)-47+Math.sin(e.t*.085)*2;
      if(--e.timer===bossCounterFrames && !e.noteSafe){sparks(e.noteX,heronKnotY,7,cream);signal(740);}
      if(e.timer===0){
        clearHeronRope(e);heronTone(e.noteIndex);state(e,'scoreStrike',14);
        if(e.noteSafe)sparks(e.x,e.y-47,10,cyan);else dust(e.noteX,groundAt(e.noteX),11);
      }
    }else if(e.state==='scoreStrike'){
      if(!e.noteSafe && !G.p.dead){
        const box=pbox(G.p);
        if(box.x+box.w>e.noteX-heronLane && box.x<e.noteX+heronLane &&
          box.y+box.h>97 && box.y<groundAt(e.noteX))hurtPlayer();
      }
      if(--e.timer<=0)state(e,'scoreGap',18);
    }else if(e.state==='scoreGap'){
      if(--e.timer<=0){
        if(e.beat<2){e.beat++;startHeronBeat(e);}
        else {e.startY=e.y;e.startX=e.x;state(e,'scoreFall',38);}
      }
    }else if(e.state==='scoreFall'){
      const q=(38- --e.timer)/38;
      e.x=e.startX+(e.courtX+354-e.startX)*q;e.y=e.startY+(groundAt(e.x)-e.startY)*q*q;
      if(e.timer===0){
        e.inv=false;heronRecovery(e,43);dust(e.x,e.y,8);
        if(e.answers){damageEnemy(e,e.answers*5);e.exposedHp=e.hp;sparks(e.x,e.y-42,12,cyan);}
      }
    }else return false;
    return true;
  }
  function roofBellArt(index){
    return picture('roofScoreBell'+index,36,35,18,3,p=>{
      const skirt=7+index*2,darkBronze='#805b48';
      p.poly([[-5,0],[5,0],[6,3],[2,5],[-3,5],[-6,3]],navy);
      p.disc(0,3,3,3,brass);p.rect(-1,2,2,2,cream);
      p.poly([[-3,6],[3,6],[5,8],[6,14],[skirt,19],[skirt+2,20],[skirt+2,23],[-skirt-2,23],[-skirt-2,20],[-skirt,19],[-5,14],[-5,9]],brass);
      p.poly([[0,7],[3,7],[5,10],[5,15],[skirt,20],[3,21],[1,16]],darkBronze,null);
      p.path([[-4,14],[-3,10],[0,8]],cream);p.line(-skirt,20,skirt,20,gold,2);
      p.path([[-4,16],[-1,14],[2,16],[4,14]],gold);
      p.disc(0,24,3,3,navy);p.rect(-1,23,3,2,brass);
      p.rect(-2,11,2,2,[cyan,coral,pale][index]);
    });
  }
  function drawHeronCarillon(e){
    const active=e.state==='scoreTell'||e.state==='scoreStrike'||e.state==='scoreGap';
    const bright=e.state==='scoreStrike';
    const stand=e.courtX+310,foot=groundAt(stand);
    const height=e.state==='scoreRise'?47*(52-e.timer)/52:e.state==='scoreFall'?47*e.timer/38:47;
    const top=Math.round(foot-height);
    if(height>2){
      RO(stand-11,foot-5,23,5,navy);
      RO(stand-3,top+2,7,Math.max(1,Math.round(height)-6),brass);R(stand-2,top+4,2,Math.max(1,Math.round(height)-9),gold);
      for(let y=top+10;y<foot-8;y+=8)R(stand-3,y,6,2,teal);
      pixelLine(stand-10,top+2,stand-2,top+12,navy,2);pixelLine(stand+10,top+2,stand+2,top+12,navy,2);
      RO(stand-13,top-1,27,4,teal);R(stand-11,top-1,23,1,gold);
    }
    for(let i=0;i<heronBellOffsets.length;i++){
      const x=Math.round(e.courtX+heronBellOffsets[i]),selected=active&&i===e.noteIndex;
      const hue=selected?(e.noteSafe?cyan:gold):brass;
      const wobble=selected&&bright?Math.round(Math.sin(e.timer*.72)*3):0;
      // The rope with the glowing working knot is the shootable one.
      const bellSprite=roofBellArt(i);
      ctx.drawImage(bellSprite.img,x+wobble-bellSprite.ox,75-bellSprite.oy);
      if(selected){
        R(x+wobble-3,87,6,2,hue);R(x+wobble-7-i,95,15+2*i,1,hue);
        if(bright)for(const side of [-1,1])diamond(x+side*(13+e.timer%4),88,2,hue);
      }
      if(selected){
        const col=e.noteSafe?cyan:gold,gy=groundAt(x),qy=heronKnotY;
        if(e.state!=='scoreGap'){
          pixelLine(x+wobble,98,x,qy-9,ink,3);pixelLine(x+wobble+1,98,x+1,qy-9,col);
          diamond(x,qy,9,ink);diamond(x,qy,7,col);diamond(x,qy,4,navy);diamond(x,qy,2,cream);
          if(!e.noteSafe){
            const top=97;
            R(x-heronLane,top,heronLane*2,gy-top,bright?'rgba(248,181,88,.27)':'rgba(245,186,102,.07)');
            for(const s of [-1,1]){
              const edge=x+s*heronLane;
              for(let y=top;y<gy-3;y+=10)R(edge,Math.round(y+(e.t%5)),2,4,bright?cream:brass);
            }
            if(bright){
              const travel=(14-e.timer)/14;
              for(let n=0;n<3;n++){
                const v=(travel+n*.30)%1, width=4+v*35,y=top+(gy-top)*v;
                pixelLine(x-width,y,x,y+5,cream,2);pixelLine(x,y+5,x+width,y,gold,2);
              }
            }
          }else{
            dots(x,qy,e.x,e.y-44,cyan);
            const q=(e.t%24)/24;diamond(x+(e.x-x)*q,qy+(e.y-44-qy)*q,3,cream);
          }
          mark(x,gy,heronLane,col);
        }
      }
      text(heronBeats[i],x,67,selected?cream:sea,1,'center',ink);
    }
    // A three-note strip marks the performed and upcoming bells, ordered
    // left, right, middle so safe spaces are obvious even without audio.
    const cx=e.courtX+W/2;
    for(let i=0;i<3;i++){
      const x=cx+(i-1)*16, done=e.state==='scoreFall'||active&&i<e.beat;
      R(x-6,182,13,11,ink);
      text(heronBeats[heronPhrase[i]],x,184,done?cyan:active&&i===e.beat?cream:brass,1,'center',null);
    }
  }
  function heronAttack(e){
    face(e);target(e);
    e.attack=(e.movement===1?['chime','spear','feathers']:['pair','spear','feathers'])[e.turn++%3];
    if(e.attack==='spear'){
      const x=clamp(G.p.x,e.courtX+39,e.courtX+W-39);
      e.spearMarks=[x];
      if(e.movement===2)e.spearMarks.push(x+(x<e.courtX+W/2?75:-75));
      e.spearIndex=0;e.aimX=x;e.startX=e.x;
    }
    state(e,'tell',e.attack==='spear'?52:e.attack==='feathers'?48:45);
    signal(e.attack==='spear'?528:328);
  }
  function heronRing(e,x,y){
    if(e.state==='scoreTell'){
      return counterReady(e) && Math.abs(x-e.noteX)<=68 && returnedNote(e);
    }
    if(!counterReady(e)||distToBox(x,y,ebox(e))>122)return false;
    clearShots(e);e.echo=42;e.echoKind=e.attack;
    if(e.attack==='spear'){e.counterX=e.x;state(e,'stun',42);}
    else heronRecovery(e,54);
    sparks(e.x,e.y-38,11,cyan);damageEnemy(e,7);e.exposedHp=e.hp;
    return true;
  }
  function heronRecovery(e,time){
    e.y=groundAt(e.x);e.exposedHp=e.hp;state(e,'recovery',time);
  }
  ENEMY_TYPES.bellHeron = {
    hp:136,boss:true,bossName:'THE BELL HERON',armored:true,contact:'none',
    box:e=>({x:e.x-19,y:e.y-74,w:38,h:71}),
    make(e){
      bossIntro(e,65,90,70);e.courtX=e.lock?e.lock.at:G.cam.x;
      e.movement=1;e.beat=-1;e.echo=0;e.rope=null;e.turn=0;
    },
    update(e){
      if(e.state==='dying'){
        if(e.timer===45){debris(e.x,e.y-46,9,brass);heronTone(1);}
        if(e.timer<40){e.x-=.8;e.y-=2;if(e.timer%8===0)sparks(e.x,e.y-27,4,pale);}
        if(--e.timer<=0)e.dead=true;
        return;
      }
      if(e.state==='intro'){enterBoss(e,65,0);return;}
      if(e.movement===1&&e.hp<=e.max/2)startHeronScore(e);
      if(updateHeronScore(e))return;
      if(e.echo>0)e.echo--;
      if(e.state==='stun'){
        const q=1-e.timer/42;e.x=e.counterX-e.facing*20*q;e.y=groundAt(e.x)-Math.sin(q*Math.PI)*23;
        if(--e.timer<=0)heronRecovery(e,29);
      }else if(e.state==='recovery'){
        // The open breast bell resonates with every distinct incoming volley.
        if(e.hp<e.exposedHp){
          damageEnemy(e,1);e.exposedHp=e.hp;sparks(e.x+e.facing*11,e.y-39,3,cyan);
          if(e.dead||e.dying)return;
        }
        if(--e.timer<=0)state(e,'rest',18);
      }else if(e.state==='rest'){
        floorWalk(e,125,.78);
        if(onScreen(e)&&--e.timer<=0)heronAttack(e);
      }else if(e.state==='tell' && bossTell(e)){
        if(e.attack==='spear'){e.startX=e.x;state(e,'spear',43);}
        else if(e.attack==='chime'||e.attack==='pair'){
          rolling(e,e.facing,2.10);heronTone(e.movement===1?0:1);
          if(e.attack==='pair')state(e,'betweenWaves',49);else heronRecovery(e,45);
        }else{
          for(const angle of (e.movement===1?[-.19,0,.19]:[-.26,-.09,.09,.26])){
            shoot(e,e.x+e.facing*19,e.y-62,e.aimX,e.aimY,1.65,angle);
          }
          Snd.tone('triangle',660,330,.20,.085);heronRecovery(e,58);
        }
      }else if(e.state==='betweenWaves'){
        if(--e.timer<=0){rolling(e,e.facing,2.12);heronTone(2);heronRecovery(e,50);}
      }else if(e.state==='spear'){
        const q=(43- --e.timer)/43;e.x=e.startX+(e.aimX-e.startX)*q;
        e.y=groundAt(e.x)-Math.sin(q*Math.PI)*43;
        if(e.timer===0){dust(e.aimX,groundAt(e.aimX),10);state(e,'spearHit',8);}
      }else if(e.state==='spearHit'){
        const b=pbox(G.p);
        if(!G.p.dead&&b.x+b.w>e.aimX-20&&b.x<e.aimX+20&&b.y+b.h>groundAt(e.aimX)-15)hurtPlayer();
        if(--e.timer<=0){
          if(++e.spearIndex<e.spearMarks.length){
            e.aimX=e.spearMarks[e.spearIndex];e.startX=e.x;state(e,'tell',41);signal(528);
          }else heronRecovery(e,58);
        }
      }
    },
    draw(e){
      const score=e.state.startsWith('score');
      if(score)drawHeronCarillon(e);
      if(e.attack==='spear'&&['tell','spear','spearHit'].includes(e.state)){
        for(let i=e.spearIndex;i<e.spearMarks.length;i++){
          const x=e.spearMarks[i],y=groundAt(x);
          mark(x,y,20,i===e.spearIndex?coral:brass);
          if(e.spearMarks.length>1)text(String(i+1),x,y-15,cream,1,'center',ink);
        }
      }
      if(e.state==='tell'){
        if(e.attack==='feathers')dots(e.x+e.facing*19,e.y-62,e.aimX,e.aimY,coral);
        else if(e.attack==='chime'||e.attack==='pair'){
          for(let i=0;i<3;i++){
            const x=e.x+e.facing*(32+13*i),y=groundAt(x)-5;
            pixelLine(x-e.facing*4,y-3,x,y,gold);
          }
        }
      }
      const f=Math.floor(e.t/(score?6:9))%4;
      const striking=e.state==='spear'||e.state==='spearHit'||e.state==='scoreStrike'||e.state==='stun';
      drawPose(e,heronPose(f,striking));
      if(e.state==='tell')tellBell(e,84);
      if(e.movement===2){
        const sx=e.x-e.facing*11,sy=e.y-66;
        pixelLine(sx-e.facing*8,sy-2,sx,sy,gold,2);pixelLine(sx,sy,sx+e.facing*6,sy-3,cyan,2);
        diamond(sx,sy+3,2,coral);
      }
      if(e.state==='recovery'||e.echo>0){
        const x=e.x+e.facing*12,y=e.y-39,w=5+((e.t>>3)&1);
        pixelLine(x-w,y-4,x-w-2,y+3,brass,2);pixelLine(x+w,y-4,x+w+2,y+3,brass,2);
        diamond(x,y,4,navy);diamond(x,y,3,cyan);diamond(x-1,y-1,1,cream);
        if(e.echo>0)for(const side of [-1,1])for(let j=0;j<3;j++){
          const d=(42-e.echo+j*12)%30;diamond(e.x+side*(5+d),e.y-35-d*.8,2,j%2?gold:cyan);
        }
      }
      if(e.state==='scoreTell'||e.state==='scoreStrike'){
        const lift=Math.sin(e.t*.17)*2;
        pixelLine(e.x+e.facing*18,e.y-65,e.x+e.facing*39,e.y-70+lift,brass,2);
        diamond(e.x+e.facing*40,e.y-71+lift,3,cream);
      }
      stunHalo(e,113);
    },
    onKill(e){
      clearShots(e);clearHeronRope(e);
      if(e.movement===1){
        // Several piercing hits or grenades can arrive in one engine update.
        // Keep the roof lock and its halftime cue, even for that lethal volley.
        const next=makeEnemy({t:'bellHeron',x:e.x},e.lock);next.active=true;
        next.x=e.x;next.y=e.y;next.facing=e.facing;next.hp=next.max/2;
        startHeronScore(next);G.enemies.push(next);return;
      }
      state(e,'dying',67);addScore(1500,e.x,e.y-60);
      sparks(e.x,e.y-40,13,cyan);G.texts.push({x:e.x,y:e.y-89,s:'HERON FREED!',c:cream,t:75});
      return 'dying';
    }
  };

  // The harness opens in the middle of the duel. Its ground-mounted clasps
  // are real targets for the lamp gun, a grenade, or a nearby bell pulse.
  ENEMY_TYPES.mantaClasp = {
    hp:6, armored:true, contact:'none',
    box:e=>({x:e.x-12,y:e.y-34,w:24,h:32}),
    make(e,spec){e.owner=spec.owner;e.side=spec.side;e.y=groundAt(e.x);},
    update(e){
      if(e.owner.dead||e.owner.dying){e.dead=true;return;}
      const beat=(e.t+(e.side===1?74:0))%174;
      if(beat===148)signal(420);
      if(beat===0&&e.t>75)shoot(e,e.x,e.y-25,G.p.x,G.p.y-17,1.25);
    },
    draw(e){
      const x=Math.round(e.x),y=Math.round(e.y),beat=(e.t+(e.side===1?74:0))%174;
      RO(x-14,y-5,28,5,navy);R(x-13,y-5,26,1,brass);
      for(const sign of [-1,1]){
        RO(x+sign*8-2,y-24,4,19,teal);R(x+sign*8-1,y-21,2,11,brass);
      }
      diamond(x,y-22,13,ink);diamond(x,y-22,10,brass);diamond(x,y-22,7,navy);
      diamond(x,y-22,4,e.hitT||beat>=148?cream:gold);
      for(let i=0;i<3;i++)R(x-7+i*6,y-7,3,2,e.hp>i*2?cyan:navy);
    },
    onKill(e){
      clearShots(e);sparks(e.x,e.y-23,12,cyan);debris(e.x,e.y-23,8,brass);
      addScore(150,e.x,e.y-27);Snd.tone('sine',740,294,.32,.09);
    }
  };
  function bindManta(e){
    e.phase=1;e.inv=true;e.turn=0;state(e,'tether',0);clearShots(e);
    e.clasps=[-1,1].map(side=>{
      const x=e.lock.at+(side<0?112:362);
      const clasp=makeEnemy({t:'mantaClasp',x,side,owner:e},e.lock);clasp.active=true;
      G.enemies.push(clasp);return clasp;
    });
    Snd.tone('sine',155,300,.5,.13);
    G.texts.push({x:e.x,y:e.y-87,s:'LIGHTNING HARNESS',c:gold,t:76});
  }
  function drawTethers(e){
    for(const clasp of e.clasps){
      if(clasp.dead)continue;
      const x0=e.x+clasp.side*30,y0=e.y-36,x1=clasp.x,y1=clasp.y-27;
      const pieces=Math.ceil(Math.hypot(x1-x0,y1-y0)/10);
      for(let i=0;i<pieces;i++){
        const f=i/pieces,end=(i+.76)/pieces;
        const sag=f=>Math.sin(f*Math.PI)*(8+Math.sin(e.t*.08)*2);
        const ax=x0+(x1-x0)*f,ay=y0+(y1-y0)*f+sag(f);
        const bx=x0+(x1-x0)*end,by=y0+(y1-y0)*end+sag(end);
        pixelLine(ax,ay,bx,by,ink,4);
        pixelLine(ax,ay,bx,by,(i+Math.floor(e.t/6))%7===0?cream:brass,2);
      }
    }
  }
  // After a successful fork counter, the lightning converges on the lens
  // instead of the hero. Breaking the two clasps releases the same safe surge.
  function refract(e,anchors) {
    e.inv=false;e.anchors=anchors;
    state(e,'refract',30);sparks(e.x,e.y-34,14,cyan);
    Snd.tone('triangle',245,730,.33,.095);Snd.tone('sine',784,988,.28,.06,.12);
  }
  function drawRefract(e){
    const ey=Math.round(e.y-34);
    for(const anchor of e.anchors){
      const top=56,start=Math.min(ey-16,top+34);
      pixelLine(anchor,top,anchor-3,start,teal,4);pixelLine(anchor+1,top,anchor-2,start,cream);
      let lx=anchor-3,ly=start;
      for(let k=1;k<=8;k++){
        const q=k/8;
        const nx=anchor+(e.x-anchor)*q,ny=start+(ey-start)*q+Math.sin(k*1.91+e.t*.51)*5*(1-q);
        pixelLine(lx,ly,nx,ny,teal,4);pixelLine(lx+1,ly+1,nx+1,ny+1,k%3?cyan:cream,2);
        lx=nx;ly=ny;
      }
      diamond(anchor,top,4,cyan);
    }
    diamond(e.x,ey,6+(e.timer%4),cream);diamond(e.x,ey,3,cyan);
  }
  // A grounded lens is easy to reach with the starting sidearm. The
  // marked bank crosses overhead before diving, leaving an opening afterwards.
  // Half health adds two fixed lightning lanes with a gap between them.
  ENEMY_TYPES.stormManta = {
    hp:76,boss:true,bossName:'THE STORM MANTA',armored:true,
    contact:'none',
    box:e=>({x:e.x-25,y:e.y-55,w:50,h:49}),
    make(e){bossIntro(e,80,107,106);},
    update(e){
      if(e.state==='dying'){
        if(e.timer>95){e.y=approach(e.y,groundAt(e.x)-2,1.2);}
        else {e.y-=1.85;e.x+=.56; if(e.timer%6===0)sparks(e.x,e.y-20,4,cream);}
        if(e.timer===112){debris(e.x,e.y-48,15,brass);boom(e.x,e.y-41,.7);}
        if(e.timer===90){
          G.texts.push({x:clamp(e.x,G.cam.x+60,G.cam.x+W-60),y:e.y-86,s:'THE STORM LIFTS',t:86,c:cream});
          for(const [i,f] of [392,494,587,784].entries())Snd.tone('sine',f,f,.5,.09,i*.13);
        }
        if(--e.timer<=0)bossDefeated(e);
        return;
      }
      if(e.state==='intro'){enterBoss(e,80,6);return;}
      if(!e.phase && e.hp<=e.max/2 && e.lock)bindManta(e);
      if(e.state==='tether'){
        e.x=approach(e.x,e.lock.at+W/2,2.1);
        e.y=approach(e.y,groundAt(e.x)-76+Math.sin(e.t*.06)*3,1.8);
        if(e.clasps.every(c=>c.dead)){
          refract(e,e.clasps.map(c=>c.x));
          G.texts.push({x:e.x,y:e.y-66,s:'HARNESS BROKEN!',c:cyan,t:84});
        }
        return;
      }
      if(e.state==='refract'){
        e.y=approach(e.y,groundAt(e.x)-7,1.55);
        if(e.timer%7===0)sparks(e.x,e.y-34,4,cyan);
        if(--e.timer<=0)state(e,'rest',31);
        return;
      }
      if(bossCountered(e))return;
      if(e.state==='rest'){
        face(e);
        const side=e.x>=G.cam.x+W/2?1:-1;
        e.x=approach(e.x,G.cam.x+W/2+side*124,.43);
        e.y=approach(e.y,groundAt(e.x)-7+Math.sin(e.t*.048)*4,1.55);
        if(!onScreen(e)||--e.timer>0)return;
        target(e);
        e.attack=(e.phase?['fork','fan','bank']:['fan','bank'])[e.turn++%(e.phase?3:2)];
        state(e,'tell',e.attack==='fork'?69:54);signal(e.attack==='fork'?196:360);
        if(e.attack==='bank'){
          e.safeBank=false;e.startX=e.x;e.aimX=G.cam.x+W/2-side*126;e.aimY=groundAt(e.aimX)-8;
        }else if(e.attack==='fork'){
          const x=clamp(G.p.x,G.cam.x+22,G.cam.x+W-22);
          e.lanes=[x,x+(x>G.cam.x+W/2?-80:80)];
        }
      }else if(e.state==='tell'){
        if(!bossTell(e))return;
        if(e.attack==='fan'){
          for(const offset of e.phase?[-.36,-.18,0,.18,.36]:[-.22,0,.22])
            shoot(e,e.x,e.y-34,e.aimX,e.aimY,1.65,offset);
          Snd.tone('triangle',520,155,.2,.08);state(e,'rest',70);
        }else if(e.attack==='bank'){state(e,'bank',84);}
        else{state(e,'fork',14);Snd.noise(.28,.12,1200);}
      }else if(e.state==='fork'){
        if(!G.p.dead){
          const b=pbox(G.p);
          if(e.lanes.some(x=>b.x+b.w>x-6 && b.x<x+6))hurtPlayer();
        }
        if(--e.timer<=0)state(e,'rest',82);
      }else if(e.state==='bank'){
        const q=1-(--e.timer)/84;
        e.x=e.startX+(e.aimX-e.startX)*(q*q*(3-2*q));
        e.y=groundAt(e.x)-7-Math.sin(Math.PI*q)*66;
        if(e.timer<=0){
          dust(e.x,groundAt(e.x),9);
          if(e.safeBank){sparks(e.x,e.y-12,10,cyan);state(e,'rest',42);}
          else state(e,'landing',10);
        }
      }else if(e.state==='landing'){
        const box=pbox(G.p),floor=groundAt(e.aimX);
        if(!G.p.dead && box.x+box.w>e.aimX-25 && box.x<e.aimX+25 && box.y+box.h>floor-15)hurtPlayer();
        if(--e.timer<=0)state(e,'rest',76);
      }
    },
    draw(e){
      if(e.state==='tether')drawTethers(e);
      if(e.state==='refract')drawRefract(e);
      if(e.attack==='bank' && ['tell','bank','landing'].includes(e.state)){
        const gy=groundAt(e.aimX);
        mark(e.aimX,gy,25,e.safeBank?cyan:e.state==='landing'?coral:gold);
        if(e.state==='bank'&&e.safeBank){
          for(let j=0;j<3;j++){
            const trail=(e.t+j*7)%25;
            diamond(e.x+(e.startX<e.aimX?-1:1)*trail,e.y-25+Math.sin(trail*.24)*5,2,cyan);
          }
        }
        if(e.state==='landing'){
          const spread=(11-e.timer)*2.4;
          for(const side of [-1,1]){diamond(e.aimX+side*spread,gy-5,4,gold);diamond(e.aimX+side*spread,gy-6,2,cream);}
        }
      }
      if(e.attack==='fork' && (e.state==='tell'||e.state==='fork')){
        for(const x of e.lanes){
          const floor=groundAt(x)-1;
          mark(x,floor,10,coral);
          if(e.state==='tell'){
            for(let y=60+(G.t%9);y<floor-9;y+=10)R(Math.round(x)-1,y,2,3,coral);
            diamond(x,64,4,ink);diamond(x,64,3,cream);
          }else{
            let lastX=x,lastY=48;
            for(let y=65;y<floor;y+=14){
              const xx=x+((y+e.timer)%3-1)*4;
              pixelLine(lastX,lastY,xx,y,violet,5);pixelLine(lastX+1,lastY,xx+1,y,cream,2);
              lastX=xx;lastY=y;
            }
            pixelLine(lastX,lastY,x,floor,cream,3);
          }
        }
      }
      if(e.state==='tell'){
        if(e.attack==='bank'){
          targetLabel(e,'CLEAR THE LANDING');
        }else if(e.attack==='fan')dots(e.x,e.y-34,e.aimX,e.aimY,coral);
        else targetLabel(e,'LEAVE THE MARKS');
      }
      const wing=e.state==='stun'?2:Math.floor(e.t/(e.state==='bank'?6:10))%4;
      drawPose(e,mantaPose(wing,!!e.phase,e.state==='dying'&&e.timer<111),false);
      if(e.state==='tell')tellBell(e,81);
      stunHalo(e,80);
    },
    onKill(e){
      clearShots(e);state(e,'dying',145);G.winT=355;
      if(G.p.dead&&G.lives<=1)G.lives=2;
      addScore(3600,e.x,e.y-65);sparks(e.x,e.y-42,20,cyan);
      return 'dying';
    }
  };

  function shotTarget(shot) {
    const alive=e=>e && e.active && !e.dead && !offStage(e);
    if(alive(shot.owner))return shot.owner;
    let best=null,distance=Infinity;
    for(const e of G.enemies){
      if(!alive(e))continue;
      const d=distToBox(shot.x,shot.y,ebox(e));
      if(d<distance){best=e;distance=d;}
    }
    return best;
  }
  function aimReturn(b,e) {
    const box=ebox(e), tx=box.x+box.w/2, ty=box.y+box.h/2;
    const angle=Math.atan2(ty-b.y,tx-b.x);
    b.vx=Math.cos(angle)*4.1;b.vy=Math.sin(angle)*4.1;
  }
  function reflect(shot) {
    const kind=EB_TYPES[shot.k];
    if(kind && kind.returnToSender){
      kind.returnToSender(shot);shot.life=0;return;
    }
    const enemy=shotTarget(shot), angle=Math.atan2(-shot.vy,-shot.vx);
    const bolt={
      x:shot.x,y:Math.min(shot.y,groundAt(shot.x)-9),vx:Math.cos(angle)*4.1,vy:Math.sin(angle)*4.1,
      dmg:shot.k==='l7Surge'?6:5,life:110,
      update(b){if(enemy&&!enemy.dead&&!offStage(enemy))aimReturn(b,enemy);},
      draw(b){
        pixelLine(b.x-b.vx*2,b.y-b.vy*2,b.x,b.y,teal,3);
        diamond(b.x,b.y,4,ink);diamond(b.x,b.y,3,cyan);diamond(b.x,b.y,1,cream);
      },
      // The bell sends the shot back to its maker through background targets.
      onProp(){return true;},onPow(){return true;}
    };
    if(enemy)aimReturn(bolt,enemy);
    shot.life=0;G.pb.push(bolt);sparks(shot.x,shot.y,4,cyan);
  }
  const bellFoes=new Set(['quayCrab','coilKite','squallRam','spindleSpider','galePuffin','bellHeron','stormManta']);
  function ring(x,y) {
    let reflected=0,stunned=0;
    for(const shot of G.eb){
      if(shot.life<=0 || Math.hypot(x-shot.x,y-shot.y)>94)continue;
      reflect(shot);reflected++;
    }
    for(const e of G.enemies){
      if(e.type==='bellHeron'&&e.active&&!e.dead&&!e.dying){
        if(heronRing(e,x,y))stunned++;
        continue;
      }
      if(e.type==='mantaClasp'&&e.active&&!e.dead&&distToBox(x,y,ebox(e))<=94){
        damageEnemy(e,e.hp);stunned++;continue;
      }
      if(e.type==='prismSnail'&&e.active&&!e.dead&&distToBox(x,y,ebox(e))<=94){
        if(ENEMY_TYPES.prismSnail.ringOpen(e))stunned++;
        continue;
      }
      if(!bellFoes.has(e.type)||!e.active||e.dead||e.dying||!counterReady(e))continue;
      if(distToBox(x,y,ebox(e))>122)continue;
      const boss=ENEMY_TYPES[e.type].boss;
      e.counterX=e.x;
      if(e.primed){e.primed=false;e.inv=false;}
      if(e.type==='stormManta'&&e.attack==='fork')refract(e,e.lanes);
      else if(e.type==='stormManta'&&e.attack==='bank'){
        // The ring detunes the impact; the marked glide still plays out.
        e.safeBank=true;state(e,'bank',84);
      }else state(e,'stun',boss?42:48);
      stunned++;
      sparks(e.x,e.y-(boss?36:15),10,cyan);
      if(boss){damageEnemy(e,3);G.texts.push({x:e.x,y:e.y-70,s:'RESONANCE!',c:cyan,t:45});}
    }
    if(reflected)Snd.tone('triangle',568,928,.22,.07);
    return {reflected,stunned};
  }
  return {ring,counterReady,heronHint};
})();
