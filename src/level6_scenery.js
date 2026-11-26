'use strict';

// Screen-space cavern panoramas, world-space floor and platforms. The fixed paintings
// are rasterized once per chamber. The ceiling, floating dust and scenery move at
// different speeds from the painted landmarks and from the player's walking surface.
const CaveScenery6 = (() => {
  const width = 1008, panoramas = [], floors = [], roofs = [];
  const tau = Math.PI * 2;
  const ink = '#101322';
  const palettes = [
    {deep:'#14182d', wall:'#202a45', lit:'#334862', rim:'#77a1b1', glint:'#91d6d4'},
    {deep:'#1c172a', wall:'#32263b', lit:'#523852', rim:'#a7798b', glint:'#e5b78c'},
    {deep:'#191827', wall:'#39303c', lit:'#665052', rim:'#ba875f', glint:'#e7bf83'},
    {deep:'#102637', wall:'#203c4b', lit:'#366071', rim:'#66aaa8', glint:'#a4e0cd'},
    {deep:'#201a2b', wall:'#372a3a', lit:'#62444e', rim:'#b98672', glint:'#edb477'},
    {deep:'#27192a', wall:'#402837', lit:'#5a3945', rim:'#ad847b', glint:'#edb478'}
  ];

  function panel(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function rng(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function rect(g, x, y, w, h, col) {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  // Scanlines keep diagonal rock faces and glass panes as crisp as the character sprites.
  function shape(g, pts, color) {
    const low = Math.floor(Math.min(...pts.map(p => p[1])));
    const high = Math.ceil(Math.max(...pts.map(p => p[1])));
    g.fillStyle = color;
    for (let y = low; y < high; y++) {
      const scan = y + 0.5, edges = [];
      for (let i = 0, j = pts.length-1; i < pts.length; j = i++) {
        const a = pts[j], b = pts[i];
        if ((a[1] <= scan && scan < b[1]) || (b[1] <= scan && scan < a[1]))
          edges.push(a[0] + (scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      edges.sort((a,b) => a-b);
      for (let i = 0; i + 1 < edges.length; i+=2) {
        const left = Math.round(edges[i]), right = Math.round(edges[i+1]);
        g.fillRect(left, y, right-left, 1);
      }
    }
  }
  function segment(g, ax, ay, bx, by, col, thick=1) {
    const n = Math.ceil(Math.max(Math.abs(bx-ax),Math.abs(by-ay))) || 1;
    g.fillStyle=col;
    for(let i=0;i<=n;i++) g.fillRect(Math.round(ax+(bx-ax)*i/n), Math.round(ay+(by-ay)*i/n), thick, thick);
  }
  function disc(g, x, y, r, col, aspect=1) {
    g.fillStyle = col;
    for(let j=-Math.floor(r*aspect); j<=r*aspect; j++) {
      const span = Math.sqrt(Math.max(0,r*r-(j/aspect)**2));
      g.fillRect(Math.round(x-span),Math.round(y+j),Math.round(span*2)+1,1);
    }
  }
  function glow(g, x, y, r, rgb, amount) {
    const grad = g.createRadialGradient(x,y,0,x,y,r);
    grad.addColorStop(0,'rgba('+rgb+','+amount+')');
    grad.addColorStop(0.45,'rgba('+rgb+','+(amount*0.46)+')');
    grad.addColorStop(1,'rgba('+rgb+',0)');
    g.fillStyle=grad; g.fillRect(x-r,y-r,r*2,r*2);
  }
  function sky(g, stops) {
    const gradient=g.createLinearGradient(0,0,0,H);
    stops.forEach(([at,col])=>gradient.addColorStop(at,col));
    g.fillStyle=gradient; g.fillRect(0,0,width,H);
  }
  function ridge(g, random, y, relief, col, step) {
    const pts=[[-step,H],[-step,y]];
    let last=y;
    for(let x=0;x<width+step;x+=step) {
      last = last*0.36 + (y+(random()-0.5)*relief)*0.64;
      pts.push([x,last]);
    }
    pts.push([width+step,H]);
    shape(g,pts,col);
  }
  function rock(g, x, y, w, h, p, seed, down=false) {
    const rand=rng(seed), side=down?1:-1, tip=x+w*(0.32+rand()*0.42), end=y+side*h;
    const points=[[x,y],[x+w*.12,y+side*h*.41],[x+w*.3,y+side*h*.60],[tip,end],
      [x+w*.69,y+side*h*.66],[x+w*.82,y+side*h*.42],[x+w,y]];
    shape(g,points,p.wall);
    shape(g,[[x,y],[x+w*.12,y+side*h*.41],[x+w*.3,y+side*h*.60],[tip,end],[x+w*.45,y+side*h*.43],[x+w*.28,y]],p.lit);
    shape(g,[[x+w*.71,y],[x+w*.56,y+side*h*.37],[tip,end],[x+w*.7,y+side*h*.59],[x+w*.84,y+side*h*.4],[x+w,y]],p.deep);
  }
  function bat(g, x, y, s, color, up) {
    const wing=up ? -3 : 0;
    const pts=[[-8,wing],[-5,wing+1],[-3,2],[-1,1],[-1,-1],[0,0],[1,-1],[1,1],[3,2],[5,wing+1],[8,wing],[5,4],[3,3],[1,5],[-1,5],[-3,3],[-5,4]];
    shape(g,pts.map(([a,b])=>[x+a*s,y+b*s]),color);
  }
  function tower(g,x,y,w,h,lit,shade) {
    rect(g,x-w/2,y-h,w,h,lit);
    rect(g,x+1,y-h,w/2-1,h,shade);
    shape(g,[[x-w*.75,y-h],[x,y-h-w*1.17],[x+w*.75,y-h]],shade);
    rect(g,x,y-h-w*1.3,1,4,lit);
    rect(g,x-w*.2,y-h+5,2,5,shade);
  }
  function pine(g,x,y,h,col) {
    shape(g,[[x,y-h],[x+h*.13,y-h*.56],[x+h*.08,y-h*.56],[x+h*.21,y-h*.27],[x+h*.14,y-h*.29],[x+h*.28,y],[x-h*.27,y],[x-h*.13,y-h*.29],[x-h*.2,y-h*.26],[x-h*.08,y-h*.55],[x-h*.13,y-h*.54]],col);
  }
  // The moon lights the sides of connected limestone columns. All of the
  // stone is behind the walkable surfaces, actors and aiming cues.
  function grottoColumn(g, x, w, lean, seed) {
    const points = coordinates => coordinates.map(([offset, y]) =>
      [x + offset * w + lean * (y / 220), y]);
    const left = [[-.7,0],[-.69,37],[-.5,61],[-.42,84],[-.38,96],[-.26,107],
      [-.24,130],[-.32,145],[-.31,162],[-.46,184],[-.58,199],[-.86,216]];
    const right = [[.82,216],[.56,205],[.37,186],[.34,168],[.19,153],[.23,142],
      [.14,124],[.25,107],[.22,93],[.39,78],[.47,59],[.71,35],[.85,0]];
    shape(g,points([...left,...right]),'#213049');
    shape(g,points([...left,[.02,216],[-.10,186],[-.06,154],[-.14,134],
      [-.09,114],[-.24,96],[-.25,72],[-.42,47],[-.38,0]]),'#3a495e');
    shape(g,points([[.26,0],[.13,42],[-.04,66],[.05,88],[-.09,114],
      [.06,138],[-.04,162],[.15,193],[.24,216],...right]),'#1b243a');
    const rand = rng(seed);
    for (let j = 0; j < 10; j++) {
      const y = 32 + j * 17 + rand() * 6, spread = .12 + Math.abs(y - 128) * .0014;
      const lip = points([[-spread,y+3],[-spread*.4,y],[.03,y+1],[spread*.70,y-3],[spread,y-2]]);
      for (let n = 1; n < lip.length; n++)
        segment(g,...lip[n-1],...lip[n],n<3?'#506074':'#2e3c52');
      const [mx,my] = points([[-spread*(.4+rand()*.4),y+4+rand()*7]])[0];
      rect(g,mx,my,1+rand()*2,1,'#667887');
    }
    rock(g,x+lean-w*.68,217,w*.34,18,palettes[0],seed+1);
    rock(g,x+lean+w*.34,217,w*.3,12,palettes[0],seed+2);
  }
  function grottoVault(g) {
    const lip = [[0,76],[39,83],[77,66],[98,60],[113,64],[139,48],[164,41],[195,40],
      [205,44],[237,34],[268,32],[286,35],[307,31],[335,39],[348,37],[376,51],[390,49],
      [412,62],[451,84],[486,68],[513,56],[530,62],[554,44],[590,38],[612,43],[632,41],
      [661,56],[691,80],[722,84],[747,73],[776,61],[798,65],[822,51],[850,40],[882,41],
      [908,54],[922,50],[953,76],[979,81],[width,66]];
    const top = [[0,0],[width,0]], backwards = [...lip].reverse();
    shape(g,[...top,...backwards],'#37475c');
    shape(g,[...top,...backwards.map(([x,y])=>[x,y-5-(x%19)*.28])],'#212c43');
    shape(g,[...top,...backwards.map(([x,y])=>[x,y-14-(x%23)*.35])],'#192137');
    for (const [x,w,lean,seed] of [[18,118,-11,516],[433,93,17,887],[703,130,-25,391],[971,102,7,236]])
      grottoColumn(g,x,w,lean,seed);
    for (const [x,y,w,h] of [[82,62,22,22],[156,41,13,15],[339,34,17,19],[372,43,23,29],
      [514,51,16,21],[558,42,21,16],[612,38,19,24],[772,54,26,36],[847,39,14,20]])
      rock(g,x,y,w,h,palettes[0],x,true);
  }
  function opening(g) {
    const rand=rng(661), p=palettes[0];
    sky(g,[[0,'#1b2547'],[.42,'#405b79'],[.68,'#8886a5'],[.76,'#ac9ba9'],[1,'#263d52']]);
    glow(g,274,77,115,'134,187,219',.45);
    for(let i=0;i<155;i++) {
      const x=rand()*width, y=rand()*162;
      rect(g,x,y,1,1,rand()>.82?'#c4c7cf':'#798ba2');
      if(i%29===0) { rect(g,x-1,y,3,1,'#a4bbcb'); rect(g,x,y-1,1,3,'#9db4c9'); }
    }
    const moon=panel(64,64), mg=moon.getContext('2d');
    disc(mg,32,32,27,'#bccdde'); disc(mg,31,31,25,'#e8e4d4');
    disc(mg,18,36,3,'#d0d6d8',.75); disc(mg,25,46,2,'#d4d9dc');
    mg.globalCompositeOperation='destination-out';
    disc(mg,40,23,23,'#ffffff');
    g.drawImage(moon,242,43);
    ridge(g,rand,142,68,'#54617d',32);
    ridge(g,rand,157,55,'#405572',27);
    // A remote abbey above the mist gives the cave mouth a recognizable skyline.
    for(const [x,y] of [[120,157],[549,148],[840,163]]) {
      shape(g,[[x-55,y+17],[x-28,y-1],[x+22,y-6],[x+48,y+12],[x+75,y+44],[x-72,y+45]],'#3a4764');
      rect(g,x-18,y-21,34,29,'#34415c');
      shape(g,[[x-22,y-21],[x-7,y-33],[x+19,y-21]],'#35445f');
      tower(g,x-20,y+2,9,26,'#3b4a65','#303c58');
      tower(g,x+4,y-2,12,36,'#3b4a65','#303c58');
      tower(g,x+19,y+3,8,23,'#3b4a65','#303c58');
      rect(g,x+1,y-30,2,4,'#9e9aaf'); rect(g,x-14,y-15,2,3,'#9e9aaf');
    }
    ridge(g,rand,180,32,'#344b64',15);
    for(let i=0;i<70;i++) pine(g,rand()*width,194+rand()*8,9+rand()*24,'#2e425a');
    rect(g,0,195,width,35,'#3c536b');
    for(let i=0;i<145;i++) {
      const x=rand()*width,y=195+rand()*25;
      rect(g,x,y,3+rand()*26,1,Math.abs(x-274)<78?'#82919f':'#536b7f');
    }
    // Cavern frame with reflected sky on the cut facets.
    for(let i=0;i<19;i++) {
      const x=i*56-20;
      rock(g,x,0,70,15+rand()*28,p,i+12,true);
    }
    for(const [x,w,h] of [[-35,107,127],[66,49,54],[442,110,119],[516,46,65],[643,102,154],[789,54,86],[930,135,115]]) {
      rock(g,x,-3,w,h,p,x+22,true);
    }
    shape(g,[[209,22],[234,19],[133,203],[78,205]],'rgba(164,209,221,0.055)');
    shape(g,[[246,16],[257,17],[166,203],[138,205]],'rgba(164,209,221,0.04)');
    grottoVault(g);
    ridge(g,rand,216,29,'#202a3d',19);
    for(let i=0;i<22;i++) rock(g,rand()*width,225,20+rand()*38,8+rand()*21,p,i+32);
  }
  function shard(g,x,y,w,h,tilt,colors) {
    const tip=x+tilt;
    shape(g,[[x-w/2,y],[x-w*.44+tilt*.5,y-h*.62],[tip,y-h],[x+w*.48+tilt*.6,y-h*.75],[x+w/2,y]],colors[0]);
    shape(g,[[x-w/2,y],[x-w*.44+tilt*.5,y-h*.62],[tip,y-h],[x+tilt*.58,y-h*.57],[x,y]],colors[1]);
    segment(g,tip,y-h,x+tilt*.58,y-h*.57,colors[2]);
    segment(g,x-w*.44+tilt*.5,y-h*.62,tip,y-h,colors[2]);
  }
  function hangingBat(g,x,y,h) {
    segment(g,x-2,y,x-2,y+3,'#9c7e82'); segment(g,x+1,y,x+1,y+3,'#9c7e82');
    shape(g,[[x-2,y+2],[x+2,y+2],[x+5,y+h*.58],[x+3,y+h-1],[x+2,y+h+3],[x,y+h],[x-3,y+h+3],[x-5,y+h-3],[x-5,y+h*.55]],'#231b2d');
    segment(g,x-3,y+4,x+1,y+h-4,'#60435a');
    rect(g,x-2,y+h-3,1,1,'#bd907b');
  }
  function roost(g) {
    const rand=rng(662), purple=palettes[1];
    sky(g,[[0,'#201b37'],[.36,'#473348'],[.68,'#68505b'],[1,'#292a3b']]);
    for(let i=0;i<17;i++) glow(g,rand()*width,80+rand()*90,44+rand()*53,'180,107,113',.12);
    const shadow={deep:'#443349',wall:'#4c3d51',lit:'#5d4757'};
    for(let i=0;i<26;i++){
      rock(g,i*43-15,-6,54+rand()*37,55+rand()*99,shadow,i+9,true);
      rock(g,i*41-10,222,61+rand()*27,17+rand()*60,shadow,i+52);
    }
    // Natural rock span at the colony's centre; hanging bat outlines read against the amber mist.
    for(let i=0;i<4;i++) {
      const x=i*277-30,y=62+i%2*10;
      const top=[[x-12,0],[x+210,0],[x+198,22],[x+168,32],[x+141,y-13],[x+89,y],[x+48,y-4],[x+15,y+25],[x-12,y+82]];
      shape(g,top,'#30283e');
      shape(g,[[x+12,y+18],[x+57,y-14],[x+111,y-7],[x+145,y-19],[x+130,y-9],[x+92,y],[x+48,y-4]],'#735366');
      // Fine mineral seams branch around each sleeping colony.
      const channels=[[[9,9],[29,17],[60,20],[71,28],[105,33],[127,28]],[[41,18],[46,11],[60,8]],
        [[71,28],[68,36],[60,41]],[[110,32],[119,37],[135,35],[148,29]]];
      for(const path of channels) for(let j=1;j<path.length;j++){
        const a=path[j-1],b=path[j]; segment(g,x+a[0],a[1],x+b[0],b[1],'#654664');
      }
      const lampX=x+171,lampY=88+(i%2)*20;
      segment(g,lampX,30,lampX,lampY,'#392d3b'); segment(g,lampX+2,34,lampX+2,lampY,'#795668');
      glow(g,lampX,lampY+5,29,'232,140,75',.30);
      shape(g,[[lampX-6,lampY+2],[lampX,lampY-3],[lampX+6,lampY+2],[lampX+4,lampY+12],[lampX,lampY+15],[lampX-4,lampY+12]],'#493640');
      shape(g,[[lampX-3,lampY+3],[lampX+3,lampY+3],[lampX+2,lampY+10],[lampX,lampY+12],[lampX-2,lampY+10]],'#d8996c');
      rect(g,lampX-1,lampY+4,2,5,'#f7d69a');rect(g,lampX-5,lampY+1,11,1,'#a57a6a');
      for(let n=0;n<8;n++) {
        const xx=x+53+n*10, yy=y-3-Math.max(0,n-3)*2;
        hangingBat(g,xx,yy,8+rand()*10);
      }
    }
    ridge(g,rand,203,26,'#423548',18);
    for(let i=0;i<17;i++) {
      const x=rand()*width,y=204+rand()*15,h=13+rand()*49;
      glow(g,x,y-h*.59,h*.94,'205,113,169',.16);
      for(const sign of [-1,1]) shard(g,x+sign*7,y,10,h*.63,sign*12,['#5c3659','#885674','#a87590']);
      shard(g,x,y,15,h,4,['#623d6a','#996584','#c08b9f']);
    }
    for(let i=0;i<22;i++) rock(g,i*47-30,225,47+rand()*35,8+rand()*19,purple,i+42);
  }
  function arch(g,x,y,w,h,color) {
    const half=w/2;
    shape(g,[[x-half,y],[x-half,y-h*.55],[x-half*.86,y-h*.71],[x-half*.51,y-h*.87],[x,y-h],
      [x+half*.51,y-h*.87],[x+half*.86,y-h*.71],[x+half,y-h*.55],[x+half,y]],color);
  }
  function gear(g,x,y,outer,inner,teeth,color) {
    const pts=[];
    for(let i=0;i<teeth;i++) for(const [phase,r] of [[0,inner],[.2,outer],[.65,outer],[.85,inner]]) {
      const a=(i+phase)*tau/teeth;
      pts.push([x+Math.cos(a)*r,y+Math.sin(a)*r]);
    }
    shape(g,pts,color);
  }
  function lancet(g,x,y,w,h,red) {
    const frame = red?'#73505c':'#525363';
    const dark = red?'#38293b':'#2c3141';
    const glass = red?['#7c4b55','#995c62','#b87973','#594159']:['#425668','#536d79','#718487','#4c4b67'];
    arch(g,x,y,w+18,h+10,dark);
    arch(g,x,y,w+10,h+6,frame);
    arch(g,x,y,w+5,h+2,dark);
    arch(g,x,y,w,h,glass[0]);
    shape(g,[[x,y-h+4],[x-w*.17,y-h*.84],[x,y-h*.67],[x+w*.17,y-h*.84]],glass[2]);
    const top = y-h*.60, bottom = y-3;
    for(let col=-1;col<=1;col++) {
      const cx=x+col*w*.30;
      shape(g,[[cx,top-3],[cx+w*.125,top+5],[cx+w*.125,bottom],[cx-w*.125,bottom],[cx-w*.125,top+5]],glass[col+1]);
      for(let sy=top+10;sy<bottom-4;sy+=16) {
        segment(g,cx-w*.125,sy,cx+w*.125,sy+7,dark);
        segment(g,cx+w*.125,sy+7,cx-w*.125,sy+16,dark);
      }
    }
    segment(g,x,y-h+2,x,y-2,dark,2);
    segment(g,x-w*.48,top,x+w*.48,top,dark,2);
    for(const sign of [-1,1]) {
      segment(g,x,y-h*.66,x+sign*w*.34,y-h*.79,dark,2);
      rect(g,x+sign*w*.15,y-h*.59,2,h*.59,dark);
    }
    rect(g,x-w*.62,y,w*1.24,3,frame);
  }
  function rose(g,x,y,r) {
    const dark='#432e41', gold='#b58170';
    glow(g,x,y,r*2.5,'238,115,109',.30);
    gear(g,x,y,r+13,r+8,24,'#322a3b');
    disc(g,x,y,r+7,'#76515b'); disc(g,x,y,r+4,'#a57267');
    disc(g,x,y,r+2,dark); disc(g,x,y,r,'#84566b');
    const glass=['#ac6b70','#c78a76','#84617a','#b87c79','#d59c7e','#90647c'];
    for(let i=0;i<12;i++){
      const a=(i-.5)*tau/12, b=i*tau/12, c=(i+.5)*tau/12;
      const at=(r,theta)=>[x+Math.cos(theta)*r,y+Math.sin(theta)*r];
      shape(g,[at(r-3,a+.035),at(r-2,b),at(r-3,c-.035),at(r*.55,c-.045),at(r*.47,b),at(r*.55,a+.045)],glass[i%glass.length]);
      shape(g,[at(r*.44,a+.06),at(r*.53,b),at(r*.44,c-.06),at(r*.16,b)],i%2?'#ac7080':'#d09b83');
      const p=at(r*.95,a),q=at(r*.14,a);
      segment(g,p[0],p[1],q[0],q[1],dark,2);
      const bead=at(r+5,b);
      rect(g,bead[0],bead[1],2,2,gold);
    }
    disc(g,x,y,r*.19,'#714957'); disc(g,x,y,r*.13,'#dba384');
    shape(g,[[x,y-r*.09],[x+r*.07,y],[x,y+r*.09],[x-r*.07,y]],'#f1cfa0');
  }
  function organ(g,x,y,size,red) {
    const dark='#322a39', wall=red?'#725258':'#525059', shine=red?'#976a60':'#737077';
    for(let i=0;i<9;i++) {
      const h=size*(.45+.50*Math.abs(4-i)/4), xx=x+i*7;
      rect(g,xx,y-h,6,h,dark); rect(g,xx+1,y-h,3,h,wall); rect(g,xx+2,y-h+2,1,h-3,shine);
      rect(g,xx,y-h+4,6,2,dark); rect(g,xx,y-h*.24,6,2,dark);
    }
    rect(g,x-2,y-4,68,5,wall);
  }
  function cathedral(g, arena) {
    const rand=rng(arena?664:663), p=palettes[arena?5:4];
    sky(g,arena?[[0,'#281f34'],[.42,'#493546'],[.76,'#6e4754'],[1,'#2e2637']]
         :[[0,'#202434'],[.45,'#394151'],[.72,'#545462'],[1,'#2a293b']]);
    // Staggered masonry and traces of copper conduits behind the nave.
    for(let row=0;row<20;row++) for(let col=-1;col<34;col++) {
      const xx=col*32+(row%2)*16, yy=row*13;
      rect(g,xx,yy,30,1,arena?'#503544':'#3d3d4b');
      rect(g,xx,yy+1,1,11,arena?'#493140':'#363541');
      if(rand()>.90) rect(g,xx+5,yy+2,8,1,arena?'#5a3d49':'#484752');
    }
    for(let k=0;k<8;k++) {
      const x=48+k*140;
      for(const sign of [-1,1]) {
        const vault=[[x+sign*48,43],[x+sign*45,32],[x+sign*32,19],[x+sign*13,7],[x,0]];
        for(let j=1;j<vault.length;j++){
          segment(g,...vault[j-1],...vault[j],arena?'#664654':'#53505e',3);
          segment(g,vault[j-1][0]+2,vault[j-1][1]+4,vault[j][0]+2,vault[j][1]+4,arena?'#3b2c3f':'#333543',2);
        }
      }
      lancet(g,x,174,42,110+(k%2)*15,arena);
      for(const sign of [-1,1]) {
        const bx=x+sign*47;
        rect(g,bx-4,30,9,187,'#37303e'); rect(g,bx-3,33,2,178,p.lit);
        for(let y=50;y<211;y+=26) rect(g,bx-5,y,11,3,p.wall);
      }
      if(k%2===0) organ(g,x+48,207,45+k*3,arena);
    }
    if(arena) {
      // One great rose, made from interlocked teeth and twelve panes, above the arena.
      const x=278;
      arch(g,x,215,219,195,'#3d2b3c'); arch(g,x,215,209,190,'#72505d');
      arch(g,x,215,203,186,'#3d2b3c'); arch(g,x,215,195,182,'#593c4a');
      for(let i=-1;i<=1;i++) lancet(g,x+i*44,203,28,47,i!==0);
      rose(g,x,108,50);
      organ(g,x-170,217,63,true); organ(g,x+105,217,63,true);
    } else {
      for(const x of [230,640,919]) {
        gear(g,x,65,31,26,16,'#31323e');
        disc(g,x,65,22,'#65616a'); disc(g,x,65,19,'#343641');
        for(let i=0;i<6;i++){
          const a=i*tau/6;
          segment(g,x,65,x+Math.cos(a)*23,65+Math.sin(a)*23,'#706770',3);
        }
        disc(g,x,65,6,'#a08378'); disc(g,x,65,3,'#49434c');
        segment(g,x-16,96,x-16,131,'#82706e'); segment(g,x-13,96,x-13,139,'#413b45');
        rect(g,x-19,130,7,12,'#5b4d53');
      }
    }
    for(let i=0;i<11;i++) {
      const x=20+i*99;
      rect(g,x+4,204,19,15,p.deep); rect(g,x,181,28,27,'#322b3b'); rect(g,x+2,183,24,7,p.lit);
      for(let j=0;j<4;j++) rect(g,x+4+j*5,185,3,3,j%3?p.wall:p.rim);
    }
    ridge(g,rand,214,14,p.deep,11);
  }

  const boundaries = [0,1700,3400,5300,7000,9200,10280];
  const metal = {dark:'#292635',shadow:'#494151',base:'#74636a',light:'#a28b82',brass:'#b38a5d',gold:'#dbb782'};
  const timber = {dark:'#342835',shadow:'#51404b',base:'#70504e',light:'#9f745a'};
  const zoneAt = x => x<1700?0:x<3400?1:x<5300?2:x<7000?3:x<9200?4:5;

  // Native canvas fixtures don't decode external images. These six paintings
  // also cover the first frame while the browser decodes the embedded artwork.
  function railwaySky(g) {
    const random = rng(306), p=palettes[2];
    sky(g,[[0,'#201a2e'],[.35,'#524150'],[.69,'#aa7965'],[1,'#322a3a']]);
    glow(g,440,118,165,'219,151,96',.35);
    ridge(g,random,145,55,'#67515a',21);
    for(let x=35; x<width; x+=115) {
      const y=110+Math.sin(x*.013)*21;
      rect(g,x-3,y,6,100,'#594551');
      segment(g,x-55,y+18,x+55,y+18,'#69505b',3);
      segment(g,x-48,y+22,x,y+73,'#69505b',2); segment(g,x+48,y+22,x,y+73,'#69505b',2);
      rect(g,x-10,y-8,22,7,'#644c53'); rect(g,x-7,y-8,14,2,'#c99974');
    }
    for(let i=0;i<22;i++) rock(g,i*50,-5,62+random()*24,28+random()*55,p,i+441,true);
    ridge(g,random,196,41,'#4a3b46',14); ridge(g,random,216,28,'#322d3d',16);
  }
  function lakeSky(g) {
    const random=rng(441), cool=palettes[3];
    sky(g,[[0,'#152d43'],[.36,'#386475'],[.65,'#6d9d9c'],[1,'#173444']]);
    for(let i=0;i<15;i++) rock(g,i*73-20,0,100,45+random()*73,cool,i+431,true);
    for (const x of [90,240,422,635,845]) {
      const z=random()*40;
      for(let n=0;n<9;n++) {
        const h=80+random()*20;
        rect(g,x+n*3,75+z,2,h,'#62979e');
        rect(g,x+n*3,77+z,1,h*.70,'#8fb8af');
      }
      glow(g,x+12,157+z,40,'116,225,210',.30);
    }
    ridge(g,random,173,48,'#385d68',20);
    rect(g,0,178,width,83,'#416b78');
    for(let j=0;j<240;j++)rect(g,random()*width,181+random()*41,4+random()*30,1,j%3?'#58838b':'#6f9a97');
    for(let j=0;j<28;j++)shard(g,random()*width,210+random()*8,7+random()*21,10+random()*49,random()*10-5,['#244554','#406e76','#649790']);
  }
  function fallback(i) {
    if (!panoramas[i]) {
      const c=panel(width,H), g=c.getContext('2d');
      if(i===0) opening(g);
      else if(i===1) roost(g);
      else if(i===2) railwaySky(g);
      else if(i===3) lakeSky(g);
      else cathedral(g,i===5);
      panoramas[i]=c;
    }
    return panoramas[i];
  }
  function painting(i) {
    const asset=typeof CavePaintings6!=='undefined' && CavePaintings6.get(i);
    return asset && asset.width && asset.height ? asset : fallback(i);
  }
  function getRoof(i) {
    if(!roofs[i]) {
      const c=panel(512,60),g=c.getContext('2d'),p=palettes[i],random=rng(714+i);
      const edge=[];
      for(let x=0;x<=512;x+=8)edge.push([x,5+9*(.5+.5*Math.cos(x*tau/256))+3*Math.cos(x*tau/64)]);
      shape(g,[[0,0],[512,0],...edge.reverse()],p.deep);
      if(i===2||i===4||i===5) {
        for(let j=0;j<8;j++) {
          const x=j*64+4, y=7+random()*8;
          rect(g,x,y,40,3,p.wall); rect(g,x+4,y+2,2,12,p.deep);
          segment(g,x+5,y+13,x+20,y,p.wall,2);
          for(let k=0;k<3;k++)rect(g,x+9+k*11,y,1,1,p.rim);
        }
      } else for(let j=0;j<21;j++) {
        const x=5+j*24, h=7+random()*29;
        rock(g,x,0,12+random()*15,h,p,j+17,true);
      }
      roofs[i]=c;
    }
    return roofs[i];
  }

  function beam(g,x1,y1,x2,y2,wood=true,n=4) {
    const m=wood?timber:metal;
    segment(g,x1-1,y1-1,x2-1,y2-1,m.dark,n+2);
    segment(g,x1,y1,x2,y2,m.base,n);
    segment(g,x1,y1,x2,y2,m.light,1);
    for(let i=0;i<3;i++) {
      const x=x1+(x2-x1)*i/2, y=y1+(y2-y1)*i/2;
      rect(g,x+1,y+1,2,2,m.dark); rect(g,x+1,y+1,1,1,m.light);
    }
  }
  function light(g,x,y,r,warm=true) {
    if(r)glow(g,x,y,r,warm?'239,161,76':'94,211,203',.35);
    rect(g,x-3,y-5,7,9,metal.dark);rect(g,x-2,y-4,5,6,warm?'#d49a59':'#78b6af');
    rect(g,x-1,y-3,2,5,warm?'#f4cc83':'#a9dacf');
    rect(g,x-4,y-5,9,2,metal.base);rect(g,x-4,y+3,9,2,metal.base);
  }
  function chain(g,x,y,length,tint=metal.base) {
    for(let j=0;j<length;j+=6) {
      rect(g,x-1,y+j,3,4,tint);rect(g,x,y+j+1,1,2,metal.dark);
      rect(g,x,y+j+4,1,2,tint);
    }
  }
  function stoneBlock(g,x,y,w,h,p) {
    rect(g,x-1,y-1,w+2,h+2,p.deep);rect(g,x,y,w,h,p.wall);
    rect(g,x+1,y,w-3,2,p.lit);rect(g,x+1,y+2,2,h-3,p.lit);
    rect(g,x+w-3,y+2,2,h-3,p.deep);
    rect(g,x+Math.floor(w*.48),y+2,4,1,p.lit);
    rect(g,x+Math.floor(w*.25),y+h-3,3,1,p.deep);
  }
  function masonry(g,x,y,w,h,p,seed) {
    const random=rng(seed);
    rect(g,x,y,w,h,p.deep);
    for(let row=0;row<h;row+=8) {
      let col=0;
      while(col<w) {
        const bw=Math.min(w-col,Math.floor(9+random()*17));
        if(bw>3)stoneBlock(g,x+col+1,y+row+1,bw-2,Math.min(6,h-row-1),p);
        col+=bw;
      }
    }
  }
  function pipe(g,x,y,w,h) {
    rect(g,x-1,y-1,w+2,h+2,metal.dark);
    rect(g,x,y,w,h,metal.base);
    if(h>w) {
      rect(g,x+1,y,1,h,metal.light);
      for(let n=10;n<h-2;n+=18) {rect(g,x-1,y+n,w+2,3,metal.shadow);rect(g,x-1,y+n,w+2,1,metal.light);}
    } else {
      rect(g,x,y+1,w,1,metal.light);
      for(let n=10;n<w-2;n+=18) {rect(g,x+n,y-1,3,h+2,metal.shadow);rect(g,x+n,y-1,1,h+2,metal.light);}
    }
  }
  function wheelArt(g,x,y,r,cog,phase,p) {
    const toothCount=cog?14:12;
    if(cog) {
      disc(g,x,y,r+1,p.deep);disc(g,x,y,r-2,p.lit);disc(g,x,y,r-5,p.deep);
    } else {
      disc(g,x,y,r+1,metal.dark);disc(g,x,y,r,metal.base);disc(g,x,y,r-3,metal.dark);
    }
    for(let j=0;j<toothCount;j++) {
      const a=phase+j*tau/toothCount, dx=Math.cos(a),dy=Math.sin(a);
      if(cog) {
        rect(g,x+dx*(r-1)-2,y+dy*(r-1)-2,5,5,p.lit);
        rect(g,x+dx*r-1,y+dy*r-1,2,1,p.rim);
      } else {
        const px=x+dx*(r-1),py=y+dy*(r-1);
        segment(g,px-dy*3,py+dx*3,px+dy*3,py-dx*3,metal.light,2);
      }
      if(j%2===0) {
        segment(g,x,y,x+dx*(r-4),y+dy*(r-4),p.wall,4);
        segment(g,x+1,y,x+dx*(r-4)+1,y+dy*(r-4),p.lit,1);
      }
    }
    disc(g,x,y,6,metal.dark);disc(g,x,y,4,p.rim);disc(g,x,y,2,p.wall);
  }
  // Each of these is a world-space structure. The lanterns, exposed workings
  // and mounting hardware locate what the player is about to pass within the
  // moving panorama. The figures and weapons always render over this layer.
  function survey(g,p) {
    const rand=rng(811);
    for(let x=-65;x<42;x+=11)stoneBlock(g,x,-7,12,7,p);
    beam(g,-48,-6,-43,-55);beam(g,17,-5,11,-55);
    segment(g,-57,-48,-13,-70,timber.dark,4);segment(g,-13,-70,27,-48,timber.dark,4);
    shape(g,[[-57,-48],[-13,-71],[27,-48],[20,-40],[-29,-47],[-54,-39]],'#536878');
    shape(g,[[-13,-68],[25,-48],[18,-44],[-21,-52]],'#789097');
    for(let x=-51;x<22;x+=7)segment(g,x,-47+Math.sin(x)*2,x+2,-43+Math.sin(x)*2,'#809497',1);
    beam(g,-43,-20,14,-20);rect(g,-34,-17,9,8,timber.shadow);
    rect(g,-27,-24,12,3,'#afa48e');rect(g,-19,-22,8,1,metal.shadow);
    for(let i=0;i<4;i++)rect(g,-43+i*10,-30,3,5,i%2?'#798e92':'#b5a188');
    chain(g,8,-45,12);light(g,8,-29,17);
    beam(g,51,-4,62,-30,false,2);beam(g,73,-4,62,-30,false,2);
    beam(g,47,-24,77,-36,false,5);disc(g,77,-36,4,p.rim);
    for(let i=0;i<21;i++)rect(g,-66+rand()*150,-6+rand()*4,2,1,p.lit);
  }
  function ammonite(g,p) {
    const rand=rng(218);
    shape(g,[[-75,0],[-69,-29],[-52,-54],[-23,-68],[9,-66],[44,-47],[56,-18],[67,0]],p.deep);
    shape(g,[[-68,-4],[-62,-30],[-45,-52],[-14,-60],[17,-49],[44,-19],[51,-4]],p.wall);
    for(let i=0;i<95;i++) {
      const ax=rand()*2-1,ay=rand()*2-1;
      if(ax*ax+ay*ay<1)rect(g,-9+ax*47,-30+ay*25,1+rand()*4,1,i%4?p.lit:p.deep);
    }
    // Mineral ribs follow the spiral of the buried ammonite shell.
    for(let j=1;j<175;j++) {
      const a=j*.073, r=2+j*.167;
      const xx=-16+Math.cos(a)*r, yy=-33+Math.sin(a)*r*.78;
      rect(g,xx,yy,3,2,'#9ba7a7');
      if(j%4===0)segment(g,xx,yy,xx+Math.cos(a+.4)*(j/43),yy+Math.sin(a+.4)*(j/43),'#7a9197',1);
    }
    for(let i=0;i<6;i++)shard(g,45+i*3,-1,8+i%3,10+i*3,3-i,['#213f4e','#477989','#8ab4b5']);
  }
  function roostShrine(g,p) {
    masonry(g,-40,-19,80,16,p,142);
    for(let n=0;n<3;n++)stoneBlock(g,-26+n*3,-25-6*n,52-n*6,6,p);
    // A weathered carved bat spreads its pierced wings above the plinth.
    for(const side of [-1,1]) {
      const pts=coordinates=>coordinates.map(([x,y])=>[side*x,y]);
      shape(g,pts([[3,-53],[14,-63],[29,-80],[46,-92],[65,-95],[52,-69],[52,-75],[37,-57],[37,-64],[22,-48],[20,-55],[8,-44]]),p.deep);
      shape(g,pts([[6,-51],[15,-64],[29,-79],[47,-89],[60,-92],[49,-79],[33,-68],[22,-57],[13,-48]]),p.lit);
      for(const [wx,wy] of [[49,-76],[36,-64],[21,-52]])segment(g,side*12,-57,side*wx,wy,p.wall,2);
      segment(g,side*9,-58,side*47,-86,p.rim,1);
      chain(g,side*49,-75,22);light(g,side*49,-49,15);
    }
    shape(g,[[-9,-40],[-10,-58],[-6,-67],[-6,-74],[-2,-68],[4,-69],[9,-75],[8,-63],[11,-56],[7,-41],[0,-35]],p.wall);
    segment(g,-6,-66,-7,-48,p.lit,3);rect(g,-4,-63,2,1,p.glint);rect(g,4,-63,2,1,p.glint);
  }
  function roostChandelier(g,p) {
    beam(g,-69,-1,-64,-134,true,5);beam(g,65,-1,60,-128,true,5);
    beam(g,-71,-135,64,-130);beam(g,-58,-116,-33,-132);beam(g,33,-130,59,-109);
    for(let n=0;n<7;n++) {
      const x=-45+n*15,y=-132+n*.6,h=[25,14,33,20,28,13,23][n];
      chain(g,x,y,h,p.lit);
      if(n%3===1)light(g,x,y+h+5,16);
      else hangingBat(g,x,y+h,12+n%3*3);
    }
    for(const side of [-1,1]) {
      const x=side*62;
      for(let j=0;j<4;j++)rect(g,x-2,-28-j*22,7,2,metal.base);
      stoneBlock(g,x-5,-9,15,8,p);
    }
  }
  function trainBin(g,p) {
    masonry(g,-53,-11,103,10,p,275);
    for(const side of [-1,1]){
      beam(g,side*43,-11,side*41,-71,true,5);
      beam(g,side*37,-12,side*3,-52,true,4);
    }
    shape(g,[[-55,-79],[49,-79],[40,-55],[18,-36],[-23,-36],[-46,-55]],metal.dark);
    shape(g,[[-51,-76],[45,-76],[37,-55],[14,-40],[-20,-40],[-43,-55]],metal.base);
    for(let j=0;j<9;j++)beam(g,-45+j*10,-74,-28+j*7,-44,true,2);
    beam(g,-50,-71,44,-71,false,3);beam(g,-39,-56,34,-56,false,2);
    const rand=rng(315);
    for(let j=0;j<25;j++){
      const x=rand()*87-46,y=-76-Math.max(0,20-Math.abs(x)*.33)*rand();
      shard(g,x,y,7+rand()*5,5+rand()*8,rand()*4-2,['#545468','#8999a0','#b6b0ab']);
    }
    pipe(g,-6,-37,12,24);beam(g,-10,-14,10,-14,false,4);light(g,47,-61,12,true);
  }
  function headframe(g,p) {
    masonry(g,-61,-10,32,9,p,275);masonry(g,33,-10,34,9,p,276);
    for(const sign of [-1,1]) {
      beam(g,sign*50,-9,sign*26,-119);
      beam(g,sign*33,-12,sign*23,-119);
    }
    for(let j=0;j<4;j++){
      const y=-29-j*24, w=44-j*5;
      beam(g,-w,y,w,y,true,3);
      beam(g,-w,y,w-6,y-21,true,2);beam(g,w,y,-w+6,y-21,true,2);
    }
    beam(g,-38,-120,38,-120,false,5);pipe(g,23,-116,4,47);light(g,43,-110,14);
    for(let j=0;j<12;j++)beam(g,-44+j*.9,-15-j*7,-38+j*.9,-15-j*7,false,1);
    rect(g,-61,-23,16,13,metal.shadow);rect(g,-60,-22,14,2,metal.light);
  }
  function cableWorks(g,p) {
    const xs=[-69,65];
    for(const x of xs){
      masonry(g,x-11,-13,23,12,p,x+170);
      beam(g,x,-13,x,-131,false,6);beam(g,x-10,-16,x,-54,false,2);
      beam(g,x,-110,x+(x<0?19:-19),-127,false,3);
    }
    beam(g,-80,-131,76,-131,false,5);
    for(let x=-71;x<65;x+=15){segment(g,x,-120,x+8,-129,metal.base,2);segment(g,x+8,-129,x+15,-120,metal.base,2);}
    beam(g,-78,-120,70,-120,false,2);light(g,-69,-110,13);light(g,65,-110,13);
  }
  function waterworks(g,p) {
    masonry(g,-66,-23,31,22,p,603);masonry(g,39,-27,25,26,p,604);
    beam(g,-53,-23,-46,-82,true,5);beam(g,48,-27,48,-82,true,5);
    beam(g,-65,-86,61,-83,true,5);
    for(let i=0;i<12;i++)rect(g,-59+i*10,-82,3,4,metal.shadow);
    chain(g,38,-81,36);light(g,38,-39,12,false);
    for(let n=0;n<5;n++) {
      const y=-28+n*6;
      segment(g,-69,y,-29,y-1,p.rim,1);segment(g,37,y,73,y-1,p.rim,1);
    }
  }
  function lakeShrine(g,p){
    const random=rng(187);
    masonry(g,-48,-12,94,11,p,190);
    for(let n=0;n<9;n++){
      const x=-37+n*9, h=14+random()*44;
      shard(g,x,-12,8+random()*9,h,random()*12-6,['#295062','#558790','#92b8ac']);
    }
    for(const sign of [-1,1]){
      masonry(g,sign*50-7,-77,15,78,p,230+sign);
      shape(g,[[sign*50-10,-76],[sign*50-6,-86],[sign*50,-93],[sign*50+6,-86],[sign*50+10,-76]],p.lit);
      rect(g,sign*50-2,-67,3,47,p.rim);
      stoneBlock(g,sign*50-10,-20,21,7,p);
    }
  }
  function forge(g,p) {
    masonry(g,-54,-67,105,66,p,445);
    arch(g,-8,-2,69,56,'#241d2b');arch(g,-8,-3,57,49,'#ac6351');arch(g,-8,-3,49,43,'#542d38');
    for(let j=0;j<7;j++) {
      const x=-30+j*7;
      shape(g,[[x,-7],[x+1,-17],[x+4,-23-j%3*3],[x+6,-15],[x+8,-8]],j%2?'#bc744b':'#df9b59');
    }
    for(let j=0;j<5;j++)rect(g,-29+j*10,-36,2,29,'#382936');
    pipe(g,-46,-104,13,39);pipe(g,14,-119,14,53);
    pipe(g,29,-87,31,6);pipe(g,57,-88,7,69);
    for(let j=0;j<7;j++)rect(g,-49+j*14,-63,7,4,metal.base);
    light(g,47,-58,17,true);
  }
  function foundryPress(g,p) {
    masonry(g,-58,-13,116,12,p,772);
    for(const sign of [-1,1]){
      beam(g,sign*48,-13,sign*48,-113,false,7);
      beam(g,sign*44,-88,sign*25,-111,false,3);
      for(let n=0;n<5;n++)rect(g,sign*48-1,-25-n*16,11,3,metal.shadow);
    }
    beam(g,-55,-117,56,-117,false,9);
    pipe(g,-12,-108,23,30);
    stoneBlock(g,-33,-23,66,9,p);
    for(let n=0;n<6;n++)rect(g,-26+n*11,-21,5,3,metal.brass);
    light(g,52,-103,16,true);
  }
  function bellTower(g,p) {
    for(const s of [-1,1]){
      masonry(g,s*51-7,-116,15,117,p,560+s);
      stoneBlock(g,s*51-12,-18,25,8,p);stoneBlock(g,s*51-10,-118,22,13,p);
    }
    arch(g,0,-81,116,57,'#302837');arch(g,0,-82,98,45,'#725660');
    arch(g,0,-82,82,38,'#352939');beam(g,-46,-93,45,-93,false,4);
    for(let j=-3;j<=3;j++)stoneBlock(g,j*13-5,-133+j*j*2,11,7,p);
    light(g,-52,-80,13);light(g,52,-80,13);
  }
  function choir(g,p){
    masonry(g,-57,-15,111,14,p,701);
    organ(g,-46,-14,73,true);organ(g,13,-15,102,true);
    for(let n=0;n<8;n++)rect(g,-48+n*13,-10,5,3,metal.brass);
  }
  const structures = {
    survey, ammonite, roostShrine, roostChandelier, trainBin, headframe, cableWorks,
    waterworks, lakeShrine, forge, foundryPress, bellTower, choir
  };
  const landmarks=[
    [310,'survey'],[706,'ammonite'],[1200,'survey'],[1560,'ammonite'],
    [1840,'roostChandelier'],[2475,'roostShrine'],[2740,'roostChandelier'],[3120,'roostShrine'],
    [3540,'headframe'],[3920,'trainBin'],[4280,'cableWorks'],[4640,'headframe'],[5030,'trainBin'],
    [5360,'waterworks'],[6005,'lakeShrine'],[6180,'waterworks'],[6520,'lakeShrine'],[6810,'waterworks'],
    [7130,'forge'],[7470,'foundryPress'],[7860,'headframe'],[8260,'forge'],[8680,'foundryPress'],[9010,'forge'],
    [9340,'bellTower'],[9620,'choir']
  ];
  const structureCache=new Map();
  function structureSprite(kind,i) {
    const key=kind+'-'+i;
    if(!structureCache.has(key)) {
      const c=panel(186,166),g=c.getContext('2d');
      g.translate(93,161);structures[kind](g,palettes[i]);
      structureCache.set(key,c);
    }
    return structureCache.get(key);
  }
  const wheels=new Map();
  function wheel(g,x,y,r,i,cog,turn) {
    const frame=((Math.floor(turn)%24)+24)%24, key=[r,i,cog?1:0,frame].join('/');
    if(!wheels.has(key)){
      const c=panel(2*r+10,2*r+10), gg=c.getContext('2d');
      wheelArt(gg,r+5,r+5,r,cog,frame*tau/24,palettes[i]);wheels.set(key,c);
    }
    g.drawImage(wheels.get(key),Math.round(x)-r-5,Math.round(y)-r-5);
  }
  function pendulum(g,x,y,length,t,large) {
    const swing=Math.sin(t*.022)*.28,cx=x+Math.sin(swing)*length,cy=y+Math.cos(swing)*length;
    segment(g,x,y,cx,cy,metal.dark,3);segment(g,x,y,cx,cy,metal.brass);
    if(large) {
      const bx=Math.round(cx),by=Math.round(cy);
      shape(g,[[bx-12,by+7],[bx-9,by+2],[bx-7,by-10],[bx-3,by-16],[bx+2,by-16],[bx+6,by-11],[bx+8,by+1],[bx+13,by+7]],metal.dark);
      shape(g,[[bx-10,by+5],[bx-7,by+1],[bx-5,by-9],[bx-1,by-14],[bx+3,by-11],[bx+5,by+1],[bx+9,by+5]],metal.brass);
      rect(g,bx-10,by+5,22,2,metal.light);disc(g,bx+Math.sin(t*.023)*3,by+8,2,metal.shadow);
    } else {
      disc(g,cx,cy,6,metal.dark);disc(g,cx,cy,4,metal.brass);rect(g,cx-2,cy-2,2,1,metal.gold);
    }
  }
  function animateStructure(g,x,y,kind,i,t) {
    if(kind==='headframe'){
      wheel(g,x,y-120,13,i,true,t*.19);wheel(g,x+18,y-121,7,i,true,-t*.34);
      chain(g,x-15,y-118,49+Math.sin(t*.024)*9);
      rect(g,x-22,y-69+Math.sin(t*.024)*9,16,6,metal.base);
    } else if(kind==='waterworks'){
      wheel(g,x-3,y-41,33,i,false,t*.065);
      for(let j=0;j<8;j++){
        const q=((t+j*17)%46)/46;
        rect(g,x+18+j*2+q*5,y-20+q*18,1,2,'#76a2a0');
      }
    } else if(kind==='foundryPress'){
      const cycle=(t%150)/150, reach=cycle<.56?Math.sin(cycle/.56*Math.PI/2)*22:Math.max(0,22-(cycle-.56)*75);
      pipe(g,x-5,y-82,10,15+reach);rect(g,x-14,y-69+reach,29,8,metal.shadow);
      rect(g,x-13,y-68+reach,26,2,metal.light);rect(g,x-10,y-63+reach,20,3,metal.brass);
      wheel(g,x+39,y-98,11,i,true,-t*.17);
    } else if(kind==='bellTower'){
      pendulum(g,x,y-89,42,t,true);pendulum(g,x+36,y-91,34,t+65,false);
    } else if(kind==='forge'){
      const f=.12+.07*(1+Math.sin(t*.11+x));
      glow(g,x-7,y-21,39,'245,111,53',f);
      for(let j=0;j<5;j++){
        const q=((t+11*j)%59)/59;
        rect(g,x-32+8*j+q*6,y-19-26*q,1,1,q>.7?'#9d6558':'#e5a165');
      }
    }
  }
  function surfaceAt(x) {
    if (LV && LV===LEVELS[5]) return groundAt(x);
    const terrain=LEVELS[5] && LEVELS[5].terrain;
    if(!terrain || !terrain.length) return 220;
    if(x<=terrain[0][0])return terrain[0][1];
    for(let j=1;j<terrain.length;j++)if(x<=terrain[j][0]){
      const [lx,ly]=terrain[j-1],[rx,ry]=terrain[j];
      return ly+(ry-ly)*(x-lx)/(rx-lx);
    }
    return terrain[terrain.length-1][1];
  }
  function drawLandmarks(g,cam,t) {
    for(const [wx,kind] of landmarks) {
      if(wx<cam-96 || wx>cam+W+96) continue;
      const i=zoneAt(wx),x=Math.round(wx-cam),y=Math.round(surfaceAt(wx));
      g.drawImage(structureSprite(kind,i),x-93,y-161);
      animateStructure(g,x,y,kind,i,t+wx%154);
    }
  }

  function crackle(g,i,cam,t) {
    const start=boundaries[i], relative=cam-start, p=palettes[i];
    if(i===0||i===1) {
      for(let j=0;j<8;j++){
        const px=((j*71+t*(i?.23:.13)-relative*.24)%550+550)%550-30;
        bat(g,px,60+j%4*9+Math.sin(t*.035+j)*4,j%3===0?.65:.44,i?'#493646':'#46536b',Math.sin(t*.14+j)>0);
      }
      for(let j=0;j<4;j++){
        const x=((j*133+66-relative*.6)%540+540)%540-25;
        const q=((t+j*101)%154)/154, y=35+q*q*164;
        if(q<.86)rect(g,x,y,1,2,p.rim);
        else segment(g,x-5*(q-.86)*7,197,x+5*(q-.86)*7,197,p.lit);
      }
    } else if(i===2) {
      // Ore cars hang from two moving cable runs high above the action.
      for(const y of [54,58])segment(g,-2,y,W+3,y-15,metal.shadow,1);
      for(let j=0;j<4;j++){
        const x=((j*165+t*.27-relative*.35)%660+660)%660-70,y=57-x*15/W;
        rect(g,x-5,y-2,11,3,metal.dark);rect(g,x-4,y-1,9,1,metal.light);
        chain(g,x-3,y+2,9);chain(g,x+3,y+2,9);
        shape(g,[[x-10,y+11],[x+10,y+11],[x+7,y+20],[x-6,y+20]],'#53414b');
        rect(g,x-9,y+11,18,2,'#98735f');rect(g,x-4,y+16,3,1,'#aa8667');
      }
    } else if(i===3) {
      for(let j=0;j<33;j++){
        const x=((j*79+t*.23-relative*.27)%505+505)%505-11;
        const y=179+j%8*4+Math.sin(j*2+t*.021)*2;
        if(Math.sin(j*.89+t*.029)>.05)rect(g,x,y,2+j%7,1,j%4?'#689396':'#92b5ac');
      }
    } else if(i===4){
      for(let j=0;j<18;j++){
        const q=((t*.46+j*41)%138)/138;
        const x=((j*103+q*24-relative*.47)%533+533)%533-21;
        rect(g,x,208-q*116,1,1,j%4?'#9a6253':'#dd985c');
      }
    } else {
      for(let j=0;j<4;j++) {
        const x=((j*179-relative*.37)%630+630)%630-75;
        chain(g,x,0,25+j%2*8,metal.shadow);
        pendulum(g,x,25+j%2*8,30+j%3*9,t+j*53,false);
      }
    }
    for(let j=0;j<9;j++){
      const x=((j*97+t*.09-relative*.41)%511+511)%511-10;
      const y=61+((j*29+t*.042)%115);
      if(Math.sin(j*2.57+t*.022)>.35)rect(g,x,y,1,1,i===3?'#94b5ad':p.rim);
    }
  }
  const lightsInPaintings=[
    [[.694,.154,21,'moon']],
    [[.260,.319,16,'lamp'],[.298,.139,13,'lamp'],[.890,.438,11,'lamp'],[.816,.571,8,'lamp'],[.416,.452,7,'lamp']],
    [[.056,.517,8,'lamp'],[.151,.462,9,'lamp'],[.427,.548,9,'lamp'],[.628,.545,8,'lamp']],
    [[.700,.605,13,'sun'],[.763,.585,9,'sun']],
    [[.244,.708,38,'fire'],[.722,.654,22,'fire'],[.835,.769,19,'fire'],[.626,.838,26,'fire']],
    [[.557,.343,24,'sun']]
  ];
  const bloomColors={moon:'132,205,247', lamp:'255,167,63', sun:'255,217,134', fire:'255,116,31'};
  const blooms={};
  function animatedPainting(g,i,pan,top,w,h,t) {
    g.save();
    for(const [nx,ny,radius,tint] of lightsInPaintings[i]) {
      const x=nx*w-pan,y=ny*h+top;
      if(x < -radius || x > W+radius)continue;
      if(!blooms[tint]) {
        const c=panel(80,80);
        glow(c.getContext('2d'),40,40,40,bloomColors[tint],.8);
        blooms[tint]=c;
      }
      const a=t*.046+nx*62, s=radius*(1+Math.sin(a)*.12);
      g.globalAlpha=.39+.24*Math.sin(a)+.13*Math.sin(a*1.69);
      g.drawImage(blooms[tint],Math.round(x-s),Math.round(y-s),Math.ceil(2*s),Math.ceil(2*s));
    }
    if(i===0 || i===3) {
      // Shimmer only where sky and waterfalls reflect in the water of the
      // plate. These strokes therefore travel with the remote shore.
      const lightX=i===0?.685:.485, lightY=i===0?.705:.66;
      for(let j=0;j<18;j++) {
        const d=j/19, a=t*.045+j*2.39;
        const x=(lightX+Math.sin(j*7.36)*(.013+d*.095))*w-pan;
        const y=(lightY+d*.19)*h+top;
        if(x<-12||x>W+12)continue;
        g.globalAlpha=.25*Math.max(0,Math.cos(a));
        rect(g,x+Math.sin(a)*2,y,2+d*9,1,'#dbffff');
      }
    } else if(i===5) {
      // Light crawls around the brass inlay in the same coordinate system
      // as the stained glass. The rescue constellation uses its centre.
      const x=w*.557-pan,y=h*.343+top,r=h*.258;
      for(let j=0;j<4;j++) {
        const a=t*.003+j*Math.PI/2, px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
        g.globalAlpha=.34+.22*Math.sin(j+t*.057);
        rect(g,px-2,py,5,1,'#ffe6ae');rect(g,px,py-1,1,3,'#fff2c9');
      }
    }
    g.restore();
  }
  function scene(g,i,cam,t) {
    const img=painting(i), center=cam+W*.5, span=boundaries[i+1]-boundaries[i];
    const fraction=clamp((center-boundaries[i])/span,0,1);
    const importedBelfry=i===5 && img!==panoramas[5];
    const scale=Math.max((importedBelfry?315:256)/img.height,(W+60)/img.width);
    const wide=Math.ceil(img.width*scale), high=Math.ceil(img.height*scale);
    let pan=Math.round((wide-W)*fraction), y=Math.round(Math.min(0,(255-high)*.53));
    if(i===5) {
      // In the locked arena the keepers' lanterns converge on this clock face.
      // Align the fixed culmination point with the hub in either painted plate.
      const native=img===panoramas[5], clockX=native?278:img.width*.557, clockY=native?108:img.height*.343;
      pan=Math.round(clamp(clockX*scale-230+(cam-9800)*.095,0,wide-W));
      y=Math.round(clamp(108-clockY*scale,Math.min(0,249-high),32));
    }
    g.fillStyle=palettes[i].deep;g.fillRect(0,0,W,H);
    g.drawImage(img,-pan,y,wide,high);
    const isPainted=img!==panoramas[i];
    if(isPainted)animatedPainting(g,i,pan,y,wide,high,t);
    // Preserve detail in the paintings while separating the moving hero from
    // the background. The dark lower vignette follows the combat lane.
    const shade=g.createLinearGradient(0,68,0,230);
    const dawn=i===5 && G.winT>0 ? clamp((200-G.winT)/126,0,1) : 0;
    shade.addColorStop(0,'rgba(12,12,25,'+(isPainted?.17-dawn*.1:.08)+')');
    shade.addColorStop(.54,'rgba(13,14,26,'+(isPainted?.27-dawn*.16:.14)+')');
    shade.addColorStop(1,'rgba(12,15,28,'+(isPainted?.49-dawn*.17:.33)+')');
    g.fillStyle=shade;g.fillRect(0,0,W,H);
    crackle(g,i,cam,t);
    const roof=getRoof(i), offset=((Math.floor(cam*.75)%roof.width)+roof.width)%roof.width;
    for(let x=-offset;x<W;x+=roof.width)g.drawImage(roof,x,0);
  }
  let dissolve;
  function drawBG(cam) {
    const t=G.t||0,center=cam+W*.50,i=zoneAt(center),edge=boundaries[i+1];
    ctx.save();ctx.imageSmoothingEnabled=false;
    scene(ctx,i,cam,t);
    if(i<5 && center>edge-135) {
      if(!dissolve)dissolve=panel(W,H);
      const buffer=dissolve.getContext('2d');buffer.imageSmoothingEnabled=false;
      scene(buffer,i+1,cam,t);
      const u=clamp((center-edge+135)/135,0,1);
      ctx.save();ctx.globalAlpha*=u*u*(3-2*u);ctx.drawImage(dissolve,0,0);ctx.restore();
    }
    drawLandmarks(ctx,cam,t);
    ctx.restore();
  }
  function floorTexture(i) {
    if(floors[i])return floors[i];
    const c=panel(320,142),g=c.getContext('2d'),p=palettes[i],random=rng(900+i);
    rect(g,0,0,320,142,p.deep);
    if(i===2 || i===4 || i===5){
      if(i===2) {
        rect(g,0,1,320,3,metal.light);rect(g,0,4,320,5,timber.dark);
        for(let x=-6;x<320;x+=16){
          rect(g,x,5,10,8,timber.base);rect(g,x+1,6,8,1,timber.light);
          rect(g,x+5,4,2,3,metal.shadow);rect(g,x+5,4,1,1,metal.gold);
        }
        for(let x=-32;x<320;x+=64){
          beam(g,x,14,x+54,70);beam(g,x+54,14,x,70);beam(g,x+1,12,x+2,103,true,6);
        }
        beam(g,-2,16,321,16);beam(g,-2,77,321,77);
      } else if(i===4) {
        for(let x=0;x<320;x+=40){
          stoneBlock(g,x,4,40,19,p);
          if(x%80===0) {
            rect(g,x+4,9,32,10,metal.dark);
            for(let n=0;n<7;n++){rect(g,x+7+4*n,10,2,7,'#995b45');rect(g,x+7+4*n,10,1,4,'#d5945c');}
          } else {rect(g,x+3,8,5,2,p.lit);rect(g,x+31,18,4,2,p.deep);}
        }
        pipe(g,-2,30,323,8);pipe(g,-2,51,323,6);
        for(let x=22;x<320;x+=80){
          pipe(g,x,37,7,47);disc(g,x+3,45,8,metal.dark);disc(g,x+3,45,6,metal.brass);
          segment(g,x,43,x+6,47,metal.shadow,2);rect(g,x+1,41,3,7,metal.shadow);
        }
      } else {
        masonry(g,0,6,320,75,p,991);
        rect(g,0,10,320,2,metal.brass);rect(g,0,22,320,2,p.rim);
        for(let x=20;x<320;x+=40){
          disc(g,x,17,5,p.deep);disc(g,x,17,3,p.rim);rect(g,x-1,15,2,3,metal.gold);
          rect(g,x+18,15,4,3,p.lit);
        }
      }
    } else {
      // Hand-cut strata break into individual mineral facets, fossils and thin
      // seams, including cool salt crystals at the lake and roots in the roost.
      let y=5;
      for(let row=0;row<8;row++) {
        const rh=row<3?11:15; let x=-9;
        while(x<320){
          const w=14+Math.floor(random()*37), chip=2+random()*5;
          shape(g,[[x+1,y+3],[x+chip,y],[x+w-8,y+1],[x+w-1,y+4],[x+w-4,y+rh-2],[x+8,y+rh],[x+2,y+rh-3]],row%3===1?p.deep:p.wall);
          segment(g,x+chip,y+1,x+w*.44,y+2,row>3?p.wall:p.lit,1);
          if(row<4) {
            rect(g,x+9,y+3,2,1,p.lit);rect(g,x+w*.70,y+6,3,1,p.deep);
            if(random()>.55)rect(g,x+w*.33,y+rh-2,w*.18,1,p.lit);
          }
          x+=w;
        }
        y+=rh;
      }
      for(let j=0;j<6;j++){
        const x=j*56+random()*15,y=17+random()*35;
        segment(g,x-10,y+5,x-2,y+2,p.lit);
        segment(g,x-2,y+2,x+5,y+4,p.rim);
        segment(g,x+5,y+4,x+19,y-4,p.lit);
        rect(g,x+1,y+1,2,2,p.rim);
      }
      if(i===3) {
        for(let j=0;j<31;j++){
          const x=random()*320,y=14+random()*41;
          shape(g,[[x-2,y],[x,y-4],[x+2,y+1],[x,y+3]],j%3?p.lit:p.rim);
        }
      }
    }
    rect(g,0,0,320,2,p.rim);rect(g,0,2,320,2,p.lit);
    for(let x=1;x<320;x+=6+Math.floor(random()*7)) {
      rect(g,x,0,2+random()*7,1,p.glint);
      rect(g,x+2,3,4,1,p.deep);
    }
    floors[i]=c;return c;
  }
  const groundPages=new Map();
  let groundGeometry=null;
  function terrainPage(number) {
    const geometry=LEVELS[5] && LEVELS[5].terrain;
    if(groundGeometry!==geometry){groundPages.clear();groundGeometry=geometry;}
    if(groundPages.has(number))return groundPages.get(number);
    const c=panel(512,H+8),g=c.getContext('2d'),origin=number*512;
    // Blit runs of adjacent columns with the same height; a slope takes one
    // rasterization per page. The playing surface uses the exact collision profile.
    let x=0;
    while(x<c.width){
      const world=origin+x,zone=zoneAt(world),tile=floorTexture(zone);
      const gy=Math.round(surfaceAt(world)),sx=((world%tile.width)+tile.width)%tile.width;
      const end=Math.min(c.width,x+tile.width-sx);
      let nx=x+1;
      while(nx<end && zoneAt(origin+nx)===zone && Math.round(surfaceAt(origin+nx))===gy)nx++;
      g.drawImage(tile,sx,0,nx-x,tile.height,x,gy,nx-x,tile.height);
      x=nx;
    }
    groundPages.set(number,c);return c;
  }
  function drawGround(cam) {
    const first=Math.floor((cam-9)/512),last=Math.floor((cam+W+9)/512);
    for(let n=first;n<=last;n++)ctx.drawImage(terrainPage(n),n*512,0);
  }
  function drawPlat(pl) {
    const i=zoneAt(pl.x),p=palettes[i],x=Math.round(pl.x),y=Math.round(pl.y),w=Math.round(pl.w);
    if(i===2) {
      rect(ctx,x-1,y+2,w+2,7,timber.dark);rect(ctx,x,y+2,w,4,timber.base);
      for(let j=2;j<w-2;j+=12){
        rect(ctx,x+j,y+2,7,7,timber.base);rect(ctx,x+j,y+2,6,2,timber.light);
        rect(ctx,x+j+2,y+4,2,2,metal.dark);
      }
      for(let j=6;j<w-12;j+=41){
        beam(ctx,x+j,y+7,x+j+14,y+22,true,2);beam(ctx,x+j+14,y+22,x+j+26,y+7,true,2);
      }
    } else if(i>=4) {
      rect(ctx,x-1,y+1,w+2,10,ink);
      rect(ctx,x,y+2,w,6,p.lit);rect(ctx,x+2,y+8,w-4,2,p.deep);
      for(let j=4;j<w-5;j+=14) {
        rect(ctx,x+j,y+3,4,3,metal.dark);rect(ctx,x+j+1,y+3,2,2,p.rim);
        if(i===4)segment(ctx,x+j+6,y+2,x+j+3,y+6,metal.brass,1);
      }
    } else {
      shape(ctx,[[x-1,y+1],[x+w+1,y+1],[x+w-3,y+7],[x+w*.70,y+10],
        [x+w*.54,y+16],[x+w*.30,y+10],[x+4,y+7]],p.deep);
      shape(ctx,[[x+1,y+2],[x+w-2,y+2],[x+w-8,y+6],[x+w*.67,y+8],
        [x+w*.53,y+10],[x+w*.30,y+7],[x+5,y+5]],p.lit);
      for(let off=7;off<w-7;off+=15)rect(ctx,x+off,y+4,4,2,p.wall);
      if(i===3) {
        for(let j=12;j<w-7;j+=22){
          shape(ctx,[[x+j,y+6],[x+j+5,y+6],[x+j+1,y+14]],p.rim);
          rect(ctx,x+j+1,y+7,1,4,p.glint);
        }
      }
    }
    rect(ctx,x,y,w,1,p.glint); rect(ctx,x+1,y+1,w-2,1,p.rim);
  }
  function drawFront(cam) {
    // Near silhouettes are confined to the bottom edge; they cannot hide
    // feet, enemy fire, checkpoint captions or the rail signals.
    const first=Math.floor((cam*1.12-80)/151),base=cam*1.12;
    for(let n=first;n<first+5;n++){
      const x=n*151-base,i=zoneAt(cam+x),p=palettes[i];
      if(i===2 || i===4 || i===5) {
        rect(ctx,x,264,42,4,p.deep);
        for(let j=0;j<4;j++)rect(ctx,x+7+j*8,265,3,1,p.lit);
      } else {
        shape(ctx,[[x-15,H],[x-8,263],[x+1,259],[x+10,264],[x+21,262],[x+30,H]],p.deep);
        segment(ctx,x-8,263,x+1,259,p.lit);
      }
    }
  }
  function menuBG(){drawBG(0);drawGround(0);drawFront(0);}
  function arenaBackdrop(){
    const cam=9800;
    drawBG(cam);ctx.save();ctx.translate(-cam,0);drawGround(cam);ctx.restore();
  }
  function preview(x,y,w,h) {
    ctx.save();ctx.imageSmoothingEnabled=false;
    const img=painting(0),ch=img.height,cw=Math.min(img.width,Math.round(ch*w/(h+6)));
    ctx.drawImage(img,Math.round((img.width-cw)*.40),0,cw,ch,x,y,w,h+6);
    rock(ctx,x-8,y+3,32,36,palettes[0],52,true);rock(ctx,x+8,y+3,17,19,palettes[0],53,true);
    const floor=y+h-13;rect(ctx,x,floor,w,22,palettes[0].deep);rect(ctx,x,floor,w,2,palettes[0].rim);
    drawHero(HEROES[G.hero||0],Math.round(x+w*.22),Math.round(floor),1,
      {pose:'idle',aim:'fwd',weapon:'moonbow',t:G.t||0});
    ENEMY_TYPES.caveRobotBat.draw({x:x+w*.67,y:y+h*.56,facing:-1,t:G.t,state:'roam'});
    ctx.restore();
  }
  return {drawBG,drawGround,drawPlat,drawFront,menuBG,preview,arenaBackdrop};
})();
