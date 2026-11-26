'use strict';

// Hand-painted at game resolution. Sky panels are cached per chapter, while the
// beam, mail boats, wind, gantry wheels and surface decorations move separately.
const L7Art = (() => {
  const panorama = 1080, tops = [0,1600,3350,5350,7100,8800];
  const terrainChunks = new Map(), tileWidth = 320;
  const round = Math.round;
  const ink = '#172738';
  const skies = [
    ['#414066','#ba7481','#f3b491','#f7ce98','#5a4c71','#9c6f80','#e2a796','#c88b87'],
    ['#334f68','#65968e','#b2c5a4','#e2d4a5','#3c6774','#558889','#9eb6a0','#7faaa5'],
    ['#292e53','#5b6384','#a6a3b0','#d3b9b4','#434768','#6c718d','#9c9aab','#777e99'],
    ['#233c58','#528593','#86b7b7','#c9d4bc','#34596f','#417785','#76a0a4','#5e8f99'],
    ['#22263d','#444867','#79768a','#c19995','#30344d','#464b69','#737189','#5b5a75'],
    ['#203247','#506777','#a9a39d','#d8c09e','#354759','#4d6371','#8a9292','#667787'],
    ['#577d9d','#abb5b4','#efd1a7','#ffe2ab','#758394','#a8aaa6','#e9ceb0','#c5b6ac']
  ];
  const ledges = [
    ['#3e354b','#664958','#a26863','#ca8e76','#e6b982'],
    ['#263e44','#3d5955','#5c7d65','#84a878','#c2cc8e'],
    ['#354056','#50627a','#718498','#abb0ad','#d9c5a5'],
    ['#253c49','#3f5966','#628387','#8bb1ae','#b4cbb9'],
    ['#282c3b','#454450','#635c64','#9a7c74','#d3a180'],
    ['#303844','#4a5562','#77838a','#a6a8a1','#d7c8ac'],
    ['#314654','#556675','#86908b','#bab39b','#eee0b8']
  ];
  function rect(g,x,y,w,h,c) {
    g.fillStyle = c; g.fillRect(round(x),round(y),round(w),round(h));
  }
  function poly(g,pts,c) {
    const first = Math.ceil(Math.min(...pts.map(p => p[1]))-.5);
    const last = Math.ceil(Math.max(...pts.map(p => p[1]))-.5);
    g.fillStyle = c;
    for(let y=first;y<last;y++) {
      const scan = y+.5, cuts=[];
      for(let i=0,j=pts.length-1;i<pts.length;j=i++) {
        const a=pts[j], b=pts[i];
        if((a[1]<=scan && scan<b[1]) || (b[1]<=scan && scan<a[1]))
          cuts.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      cuts.sort((a,b)=>a-b);
      for(let k=0;k+1<cuts.length;k+=2) {
        const x=round(cuts[k]); g.fillRect(x,y,round(cuts[k+1])-x,1);
      }
    }
  }
  function line(g,x0,y0,x1,y1,c,w=1) {
    const n=Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0))) || 1;
    g.fillStyle=c;
    for(let i=0;i<=n;i++) g.fillRect(round(x0+(x1-x0)*i/n),round(y0+(y1-y0)*i/n),w,w);
  }
  function oval(g,x,y,rx,ry,c) {
    g.fillStyle=c;
    for(let j=-Math.floor(ry);j<=ry;j++) {
      const w=round(rx*Math.sqrt(Math.max(0,1-j*j/(ry*ry))));
      g.fillRect(round(x)-w,round(y)+j,2*w+1,1);
    }
  }
  function make(w,h) {
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    c.getContext('2d').imageSmoothingEnabled=false; return c;
  }
  function random(seed) {
    return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  }
  function chapter(x) {
    for(let i=tops.length-1;i>0;i--) if(x>=tops[i]) return i;
    return 0;
  }
  function stamped(g,x,y,s,fn) {
    g.save(); g.translate(round(x),round(y)); g.scale(s,s); fn(); g.restore();
  }

  // Each bank has separate light-facing shoulders, a flat underside and
  // small broken filaments on the lee side. The sunlight changes at each stop.
  function cloud(g,x,y,w,h,p,seed) {
    const r=random(seed), lobes=[], count=5+Math.floor(r()*4);
    const crest=.24+r()*.48;
    for(let i=0;i<count;i++) {
      const k=i/(count-1);
      const profile=Math.sin(k*Math.PI)*(.25+.55*(1-Math.abs(k-crest)));
      const rx=w*(.08+r()*.095), ry=h*(.18+r()*.20);
      lobes.push([x+w*k,y-h*(.09+profile+r()*.13),rx,ry]);
    }
    for(const [cx,cy,rx,ry] of lobes) oval(g,cx,cy-1,rx,ry,p[2]);
    for(const [cx,cy,rx,ry] of lobes) oval(g,cx+1,cy+1,rx,ry,p[1]);
    // Broad masses link the cloud shoulders. A handful of small highlights turn
    // the edge into turbulent vapor instead of a row of outlined discs.
    const base=[[x-w*.07,y-h*.13],...lobes.map(([a,b])=>[a,b+h*.05]),
      [x+w*1.13,y-h*.065],[x+w*.97,y+h*.015],[x+w*.27,y+h*.035]];
    poly(g,base,p[0]);
    for(let j=0;j<count;j++) {
      const [cx,cy,rx,ry]=lobes[j], dx=(r()-.3)*rx*.30;
      oval(g,cx+dx,cy+ry*.40,rx*.87,ry*.65,p[0]);
      if(j%3===1) {
        rect(g,cx-rx*.46,cy-ry*.69,rx*.40,1,p[2]);
        rect(g,cx-rx*.23,cy-ry*.77,rx*.34,1,p[2]);
      }
    }
    for(let j=0;j<10;j++) {
      const k=r(), xx=x+w*k, yy=y-h*(.09+.12*r());
      rect(g,xx,yy,w*(.018+r()*.115),1,p[j%4===0?1:0]);
    }
    for(let i=0;i<18;i++) {
      const k=r(), xx=x+w*k, yy=y+h*(r()*.20-.02);
      rect(g,xx,yy,w*(.02+r()*.19),1+(i%4===0),i%4===0?p[1]:p[0]);
    }
  }
  function sky(g,i) {
    const p=skies[i], r=random(171+i*17);
    const gradient=g.createLinearGradient(0,0,0,270);
    gradient.addColorStop(0,p[0]); gradient.addColorStop(.49,p[1]); gradient.addColorStop(.77,p[2]); gradient.addColorStop(1,p[3]);
    g.fillStyle=gradient; g.fillRect(0,0,panorama,270);
    const cx=i===0?193:i===6?228:422, cy=i===6?90:88;
    if(i===0 || i===1 || i===6) {
      const glow=g.createRadialGradient(cx,cy,10,cx,cy,109);
      glow.addColorStop(0,'rgba(255,227,158,.52)'); glow.addColorStop(1,'rgba(255,227,158,0)');
      g.fillStyle=glow; g.fillRect(cx-110,cy-110,220,220);
      const rad=i===1?21:31;
      oval(g,cx,cy,rad,rad,i===1?'#d8d6ae':'#ffdb99');
      oval(g,cx-1,cy-2,rad-2,rad-2,i===1?'#dbddbc':'#ffe5aa');
      for(let j=0;j<4;j++) rect(g,cx-rad-3,cy+7+j*5,rad*2+6,1+j*.32,p[2]);
    }
    for(let n=0;n<90;n++) {
      const x=r()*panorama, y=33+r()*143;
      rect(g,x,y,4+r()*57,1,i<2?'rgba(245,205,167,.12)':'rgba(204,205,208,.11)');
    }
    const cloudP=[p[4],p[5],p[6]], farP=[p[7],p[7],p[2]];
    for(let j=0;j<7;j++) cloud(g,j*173-65,151+r()*26,100+r()*122,18+r()*29,farP,1200+j*29+i*600);
    for(let j=0;j<5;j++) {
      const x=[-104,264,467,745,948][j];
      const height=i===4?66+r()*31:20+r()*37;
      cloud(g,x,30+r()*24+(j%2)*12,167+r()*91,height,cloudP,300+j*41+i*100);
    }
    for(let k=0;k<260;k++){
      const x=Math.floor(r()*panorama), y=round(r()*210);
      rect(g,x,y,3+r()*7,1,'rgba(226,227,215,.065)');
    }
    for(let j=0;j<7;j++) cloud(g,j*161-52,199+r()*21,92+r()*86,22+r()*34,farP,900+j*37+i*170);
  }

  // Airborne basalt islands: a terraced cap breaks into splinters below.
  function crag(g,x,y,w,d,p,seed) {
    const r=random(seed), n=Math.max(7,round(w/13)), top=[], low=[];
    for(let k=0;k<=n;k++) {
      const s=k/n, a=x+w*s, b=y-5*Math.sin(s*Math.PI)+(r()-.5)*7;
      top.push([a,b]);
      low.push([a,y+4+Math.pow(Math.sin(s*Math.PI),.7)*d*(.44+r()*.52)]);
    }
    poly(g,top.concat([...low].reverse()),p[0]);
    for(let k=0;k<n;k++) {
      const a=top[k], b=top[k+1], e=low[k], f=low[k+1];
      poly(g,[a,b,[f[0]-3,f[1]-2],[e[0]+2,e[1]-6]],p[k%4===2?0:1]);
      poly(g,[[a[0]+1,a[1]+3],[b[0]-3,b[1]+1],[f[0]-6,f[1]-10],[a[0]+3,e[1]-9]],p[2]);
      if(k%2===0) line(g,b[0]-6,b[1]+2,f[0]-7,f[1]-9,p[3],1);
      const lip=[a,b,[b[0]-2,b[1]+4],[a[0]+3,a[1]+7]];
      poly(g,lip,p[3]); line(g,...a,...b,p[4]);
    }
    for(let j=0;j<n;j++) {
      const [lx,ly]=top[j], [rx,ry]=top[j+1];
      const spread=rx-lx, faceDepth=Math.min(low[j][1]-ly,low[j+1][1]-ry);
      for(let v=0;v<4;v++) {
        const f=r(), yy=ly+7+f*Math.max(0,faceDepth-15), xx=lx+spread*(.10+r()*.60);
        const length=2+r()*Math.min(spread*.43,8);
        line(g,xx,yy,xx+length,yy-1-r()*2,p[v%3?1:3]);
        if(v===1) line(g,xx+length,yy-3,xx+length-2,yy+2,p[1]);
      }
      if(j%3===1) {
        const notch=Math.min(12,faceDepth*.42);
        poly(g,[[lx+1,ly+4],[rx+2,ry+4],[rx-2,ry+notch],[lx+2,ly+notch+1]],p[2]);
        line(g,lx+3,ly+notch+1,rx-2,ry+notch,p[1],1);
      }
    }
    for(let k=0;k<Math.floor(w/12);k++) {
      const xx=x+w*r(), yy=y-3+r()*7;
      rect(g,xx,yy,2+r()*7,1,p[k%3+1]);
    }
    for(let k=0;k<3;k++) {
      const xx=x+w*(.14+.70*r()), yy=y+d+4+7*r();
      poly(g,[[xx-3,yy],[xx+3,yy-2],[xx+4,yy+1],[xx,yy+7]],p[1]);
    }
  }
  function rope(g,x1,y1,x2,y2,sag,c) {
    let xx=x1, yy=y1;
    for(let i=1;i<=14;i++){
      const a=i/14, x=x1+(x2-x1)*a, y=y1+(y2-y1)*a+Math.sin(a*Math.PI)*sag;
      line(g,xx,yy,x,y,c); xx=x; yy=y;
    }
  }
  function tower(g,x,y,s,bright=false,dark=false) {
    const stone=bright?'#eee0b4':'#c3baa6', shade=bright?'#969998':'#80858a', deep='#414d5a';
    stamped(g,x,y,s,()=>{
      poly(g,[[-16,1],[-11,-53],[-8,-69],[10,-69],[13,-53],[18,1]],deep);
      poly(g,[[-13,0],[-9,-54],[-6,-68],[8,-68],[11,-54],[14,0]],stone);
      poly(g,[[3,0],[2,-68],[8,-68],[11,-54],[15,0]],shade);
      for(const [base,w] of [[-56,9],[-30,12]]) {
        poly(g,[[-w,base], [w,base+3],[w+1,base+12],[-w-1,base+8]],'#aa655b');
        poly(g,[[3,base+2],[w,base+3],[w+1,base+12],[3,base+10]],'#77545b');
      }
      for(let j=0;j<5;j++) { rect(g,-8+j%3*2,-57+j*10,2,3,deep); rect(g,-8+j%3*2,-57+j*10,1,1,'#f9d49d'); }
      rect(g,-17,-70,34,4,deep); rect(g,-16,-71,30,1,'#c8b8a2');
      rect(g,-14,-77,1,7,deep); rect(g,13,-77,1,7,deep); rect(g,-14,-76,28,1,deep);
      rect(g,-9,-86,19,15,deep); rect(g,-7,-84,15,11,dark?'#49565c':bright?'#fff2ae':'#edcd8d');
      rect(g,-7,-82,3,8,dark?'#59676f':bright?'#ffd577':'#bf9b77'); rect(g,4,-83,3,10,dark?'#374954':'#b78764');
      rect(g,-4,-79,8,2,dark?'#748286':'#ffeeab'); rect(g,-2,-81,3,6,dark?'#68777b':'#fff1c6');
      rect(g,-7,-85,2,13,deep); rect(g,5,-85,2,13,deep);
      poly(g,[[-14,-86],[-10,-90],[-4,-94],[1,-97],[9,-91],[14,-86]],deep);
      line(g,-11,-88,1,-96,'#c0a995'); rect(g,0,-100,1,6,deep);
      // Dressed-stone joints curve up toward the cylindrical edges.
      for(let row=0;row<7;row++) {
        const yy=-63+row*8, ww=8+row*.7;
        if(row===1||row===4)continue;
        rect(g,-ww+2,yy,4,1,shade); rect(g,-ww+3+(row%2)*3,yy+1,1,2,shade);
        rect(g,6,yy+3,3,1,'#777c81');
      }
      poly(g,[[-5,0],[-5,-8],[-2,-11],[1,-11],[4,-8],[4,0]],deep);
      poly(g,[[-3,0],[-3,-7],[-1,-9],[1,-9],[2,-6],[2,0]],'#785e5c');
      rect(g,2,-5,1,1,'#d7a66f'); rect(g,-6,0,11,2,shade);
      rect(g,-15,-1,32,3,deep); rect(g,-12,-2,23,1,stone);
    });
  }
  function hut(g,x,y,w,h,c,roof) {
    rect(g,x,y-h,w,h,c[1]); rect(g,x+w*.63,y-h,w*.37,h,c[0]);
    poly(g,[[x-3,y-h],[x+w*.36,y-h-w*.27],[x+w*.74,y-h-w*.23],[x+w+3,y-h]],roof);
    line(g,x-3,y-h,x+w*.36,y-h-w*.27,c[3]); rect(g,x+w*.70,y-h-w*.30,3,5,c[0]);
    for(let j=0;j<3;j++){
      const left=x+w*(.11+j*.17), top=y-h+w*.17-j%2;
      rect(g,left,top,Math.max(2,w*.12),Math.max(2,h*.21),'#d4af89');
      rect(g,left+w*.04,top+1,1,Math.max(1,h*.15),c[1]);
    }
    for(let j=0;j<4;j++) {
      const vx=x+w*.20+j*w*.10, vy=y-h-w*.06-(j%2)*2;
      rect(g,vx,vy,2,1,c[2]); rect(g,vx+6,vy-1,3,1,c[1]);
    }
    rect(g,x+w*.50,y-6,4,6,c[0]); rect(g,x+w*.7,y-6,2,3,'#b39d8c');
    rect(g,x+w*.62,y-h*.85,1,h*.73,c[2]);
  }
  function sailboat(g,x,y,s,cols) {
    const [hull,sail,seam,warm]=cols;
    stamped(g,x,y,s,()=>{
      line(g,-21,-2,0,-32,seam); line(g,0,-32,24,-2,seam);
      line(g,-3,0,-3,-34,hull,1); line(g,12,0,12,-21,hull,1);
      poly(g,[[-5,-31],[-8,-12],[-22,-5],[-10,-6],[-4,-9]],sail);
      poly(g,[[0,-29],[13,-12],[0,-11]],sail); poly(g,[[0,-25],[8,-14],[2,-14]],warm);
      poly(g,[[14,-20],[23,-7],[13,-8]],sail); rect(g,-10,-4,17,3,hull);
      poly(g,[[-24,-3],[-14,-1],[16,-1],[27,-6],[23,0],[12,5],[-12,5],[-19,2]],hull);
      line(g,-18,0,13,1,seam); rect(g,12,0,8,1,warm); rect(g,-4,-35,8,2,warm);
    });
  }
  function tree(g,x,y,h,p,seed) {
    const r=random(seed), foliage=[];
    // The prevailing offshore wind pushes every crown to the right.
    const thick=Math.max(2,round(h*.08));
    poly(g,[[x-thick,y],[x+thick,y],[x+1,y-h*.48],[x+8,y-h*.79],[x+3,y-h*.81],[x-3,y-h*.5]],p[0]);
    line(g,x-1,y-h*.45,x-10,y-h*.68,p[1],thick-1);
    for(let j=0;j<9;j++){
      const k=j/8;
      foliage.push([x+h*(k-.40)*.84,y-h*(.67+.25*Math.sin(k*Math.PI))+(r()-.5)*5,h*(.14+r()*.12),h*(.09+r()*.06)]);
    }
    for(const [cx,cy,rx,ry] of foliage) oval(g,cx,cy,rx,ry,p[0]);
    for(const [cx,cy,rx,ry] of foliage) {
      oval(g,cx-1,cy-2,rx-1,ry-1,p[1]); oval(g,cx-rx*.1,cy-ry*.55,rx*.7,ry*.40,p[2]);
      rect(g,cx-rx*.5,cy-ry*.86,rx*.45,1,p[3]);
      for(let j=0;j<6;j++) {
        const lx=cx+(r()-.5)*rx*1.45, ly=cy+(r()-.50)*ry*1.05;
        rect(g,lx,ly,j%3===0?3:2,1,j%2?p[2]:p[1]);
        if(j%3===0) rect(g,lx+1,ly-1,1,1,p[3]);
      }
    }
  }
  function bell(g,x,y,s,muted=false) {
    stamped(g,x,y,s,()=>{
      const c=muted?['#455653','#927d55','#b9a978']:['#67513c','#c19454','#e7c47a'];
      rect(g,-1,-5,3,3,c[0]);
      poly(g,[[-2,-3],[2,-3],[4,0],[5,7],[8,10],[-7,10],[-4,7],[-4,0]],c[0]);
      poly(g,[[-2,-2],[1,-2],[3,0],[3,7],[6,8],[-4,8],[-3,6],[-3,0]],c[1]);
      rect(g,-2,0,2,6,c[2]); rect(g,-6,9,13,1,c[2]); rect(g,-1,11,3,2,c[0]);
    });
  }
  function turbine(g,x,y,r,angle,p) {
    for(let j=0;j<5;j++) {
      const a=angle+2*Math.PI*j/5;
      const pt=(forward,side)=>[x+forward*Math.cos(a)-side*Math.sin(a), y+forward*Math.sin(a)+side*Math.cos(a)];
      poly(g,[pt(5,0),pt(r*.62,-r*.11),pt(r,-r*.35),pt(r*.87,-r*.12),pt(r*.58,r*.035),pt(7,3)],p[1]);
      line(g,...pt(r*.62,-r*.11),...pt(r,-r*.35),p[3]);
    }
    oval(g,x,y,r*.13,r*.13,p[0]); oval(g,x-1,y-1,r*.08,r*.08,p[2]);
  }
  function pylon(g,x,y,h,p) {
    const w=h*.19;
    poly(g,[[x-w,y],[x+w,y],[x+w*.36,y-h*.88],[x-w*.38,y-h*.88]],p[0]);
    poly(g,[[x-w+.8,y],[x-w*.27,y-h*.88],[x-w*.10,y-h*.88],[x-w*.45,y]],p[2]);
    for(let j=0;j<5;j++) {
      const yy=y-h*.14*j, ww=w*(1-.13*j);
      line(g,x-ww,yy,x+ww*.83,yy-h*.14,p[2],2); line(g,x+ww,yy,x-ww*.83,yy-h*.14,p[1],2);
      rect(g,x-ww,yy,ww*2,2,p[3]);
    }
    rect(g,x-5,y-h*.89,10,h*.16,p[1]); line(g,x-3,y-h,x-3,y-h*.81,p[2],2);
  }
  function beaconCoast(g,i) {
    const p=ledges[i], isDawn=i===6;
    const back=['#596b72','#79898a','#97a29a','#acb0a1','#c9c2a7'];
    for(const [x,y,w] of [[-55,184,154],[101,191,93],[413,171,153],[932,180,155]]) {
      crag(g,x,y,w,55,back,715+x);
      hut(g,x+w*.3,y-3,21,13,back,'#887a76'); hut(g,x+w*.51,y-2,16,9,back,'#827e78');
    }
    for(const [x,y,s] of [[286,190,1.08],[656,197,1.15]]) {
      crag(g,x-92,y+5,186,95,p,x); tower(g,x,y-2,s,isDawn,!isDawn);
      hut(g,x-47,y-1,24,19,p,isDawn?'#aa6e62':'#835f64');
      hut(g,x+25,y+1,31,15,p,'#946e65');
      rect(g,x-81,y-2,162,3,p[1]);
      for(let xx=x-78;xx<x+75;xx+=7) rect(g,xx,y-8,1,6,p[1]);
      rect(g,x-79,y-8,156,1,p[2]);
    }
    rope(g,347,191,431,165,13,back[0]); rope(g,750,200,954,178,21,back[1]);
  }
  let dawnPanel;
  function getDawnPanel() {
    if(!dawnPanel) {
      dawnPanel=make(panorama,H);const g=dawnPanel.getContext('2d');
      sky(g,6);beaconCoast(g,6);
    }
    return dawnPanel;
  }
  function beam(x,y,t,bright) {
    // Lens rotation is visible in the foreshortening of both halves.
    const direction=Math.cos(t*.017), reach=direction*(bright?320:227);
    const span=Math.abs(reach)*.13, tilt=Math.sin(t*.017)*.025*reach;
    poly(ctx,[[x,y-1],[x+reach,y+tilt-span],[x+reach,y+tilt+span],[x,y+1]],bright?'rgba(255,236,153,.23)':'rgba(255,222,144,.17)');
    poly(ctx,[[x,y-1],[x+reach,y+tilt-span*.27],[x+reach,y+tilt+span*.27],[x,y+1]],'rgba(255,240,180,.19)');
    rect(ctx,x-2,y-1,4,2,'#fff2b5');
  }
  function atmosphere(i,offset,t,lit=false) {
    if(i===0 && lit) beam(349-offset,round(135-80*.62),t,false);
    if(i===6 || (i===5 && lit)) {
      beam(286-offset,round(188-80*1.08),t,i===6);
      beam(656-offset,round(195-80*1.15),t+58,i===6);
    }
    if(i===4) {
      const p=['#303543','#595665','#77717b','#a29186'];
      for(const [x,y,r,rate] of [[60,111,31,.019],[257,99,43,-.014],[477,100,27,.022],[668,95,39,-.017],[895,127,24,.020],[1050,116,32,-.016]]) {
        if(x-offset>-r && x-offset<W+r) turbine(ctx,x-offset,y,r,t*rate+x,p);
      }
    }
    if(i===0 || i===6) {
      const base=i===6?159:206;
      sailboat(ctx,base+round(Math.sin(t*.005)*13)-round(offset*.65),109+Math.sin(t*.036)*1.5,.52,
        i===6?['#5d6269','#e7cdb0','#a98d82','#d79074']:['#806473','#dab09b','#b7807e','#bc8175']);
    }
    if(i===0 || i===1 || i===6) {
      for(let j=0;j<8;j++) {
        const xx=((423+j*21+t*.12-offset*.8)%(W+120)+W+120)%(W+120)-55;
        const yy=68+j%4*5+Math.sin(t*.022+j)*2, flap=(Math.floor(t/9+j)%2)*2;
        line(ctx,xx-2,yy-flap,xx,yy+1,'#6a7379'); line(ctx,xx,yy+1,xx+3,yy-flap,'#6a7379');
      }
    } else {
      // Rain lies behind the actors and never implies a damaging bolt.
      const amount=i===3?17:i===4?43:27;
      for(let j=0;j<amount;j++) {
        const xx=((j*143-t*(i===4?1.8:1.1)-offset*.8)%(W+40)+W+40)%(W+40)-12;
        const yy=(j*73+t*(i===4?3:2))%246-6;
        line(ctx,xx,yy,xx-2,yy+4+j%4,'rgba(216,226,224,.17)');
      }
    }
  }
  // Nearer shoreline landmarks have their own parallax speed. Their painted
  // edges use the chapter's middle values, leaving the outline colours for play.
  const shoreTiles=[];
  function shoreTile(kind) {
    if(shoreTiles[kind])return shoreTiles[kind];
    const c=make(148,147),g=c.getContext('2d');
    if(kind===0) {
      const p=['#4a4654','#6e5660','#a37770','#bc927c'];
      // A reeved block and tackle, winch drum, reefed canvas and signal pennants.
      rect(g,31,35,6,107,p[0]); rect(g,32,36,2,103,p[2]);
      rect(g,19,52,64,3,p[1]); rect(g,20,52,60,1,p[3]); line(g,34,34,81,54,p[2]);
      line(g,33,42,4,133,p[1]); line(g,35,36,103,130,p[1]); line(g,37,45,94,132,p[2]);
      poly(g,[[20,55],[80,55],[72,61],[64,59],[56,63],[43,60],[32,62],[22,60]],'#b29483');
      for(let j=0;j<5;j++)line(g,26+j*11,55,29+j*11,60,p[1]);
      rope(g,34,40,120,90,8,p[1]);
      for(let j=0;j<6;j++) {
        const f=.12+j*.14, xx=34+86*f, yy=40+50*f+Math.sin(f*Math.PI)*8;
        poly(g,[[xx,yy],[xx+6,yy+3],[xx+1,yy+8]],j%2?'#c09982':'#ad7872');
      }
      line(g,75,56,75,90,p[1]);line(g,80,56,80,89,p[2]);
      oval(g,77,91,5,6,p[1]);oval(g,76,90,3,4,p[3]);oval(g,76,90,1,2,p[0]);
      rope(g,77,97,52,123,5,p[1]);
      rect(g,51,130,40,7,p[0]);rect(g,56,122,29,9,p[1]);rect(g,58,120,28,3,p[2]);
      for(let j=0;j<6;j++)rect(g,60+j*4,122,2,8,p[3]);
      oval(g,85,126,5,6,p[0]);oval(g,85,126,3,4,p[2]);rect(g,84,125,3,2,p[1]);
      rect(g,6,136,108,5,p[1]);rect(g,5,135,113,2,p[2]);rect(g,15,141,6,6,p[0]);rect(g,99,140,6,7,p[1]);
    } else if(kind===1) {
      const p=['#395451','#4c7160','#77906c','#a5a77e'];
      // An old orchard tree has a crooked trunk, lichen shelves and copper tags.
      tree(g,59,142,97,p,3781);tree(g,96,144,58,p,1887);
      poly(g,[[42,143],[51,135],[59,132],[59,142]],p[0]);
      line(g,55,128,60,111,p[2]);line(g,58,105,58,98,p[1]);
      for(let j=0;j<5;j++){ rect(g,54+(j%3),105+j*6,4,1,p[2]); }
      rope(g,37,84,105,95,13,p[1]);
      for(const [x,y] of [[48,93],[67,102],[84,104],[99,100]]) {
        rect(g,x,y,1,6,p[1]);poly(g,[[x-2,y+5],[x+3,y+5],[x+2,y+12],[x,y+14],[x-2,y+12]],'#99886b');
        rect(g,x-1,y+6,2,5,'#b2a37d');
      }
      for(let j=0;j<7;j++){
        const x=19+j*15;line(g,x,146,x+4,133+(j%3)*3,p[2]);rect(g,x+3,132+(j%3)*3,3,2,p[3]);
      }
    } else if(kind===3) {
      const p=['#375262','#507580','#7a9b9d','#a8b5a6'];
      // A copper canopy encloses an annealing furnace in the glassmakers' yard.
      rect(g,24,105,75,37,p[1]);rect(g,86,105,14,36,p[0]);
      poly(g,[[20,104],[41,88],[78,88],[103,105]],p[0]);
      line(g,23,103,42,89,p[3]);rect(g,42,88,36,2,p[2]);
      for(let j=0;j<6;j++)line(g,42+j*6,90,33+j*9,101,p[2]);
      rect(g,20,103,83,4,p[2]);rect(g,21,104,79,1,p[3]);
      for(let j=0;j<4;j++) {
        const xx=30+j*14;
        rect(g,xx,111,9,17,p[0]);rect(g,xx+1,112,7,15,j%2?'#a3a698':'#8eb0a9');
        rect(g,xx+4,112,1,16,p[1]);rect(g,xx+1,119,7,1,p[2]);
      }
      rect(g,92,112,3,22,p[1]);rect(g,35,130,49,2,p[2]);
      rect(g,68,62,6,27,p[1]);rect(g,66,64,11,2,p[2]);rect(g,67,59,9,4,p[0]);rect(g,68,59,7,1,p[3]);
      rect(g,17,143,90,4,p[0]);rect(g,22,140,83,3,p[2]);
    } else if(kind===4) {
      const p=['#3a4050','#525563','#747582','#a39b91'];
      // Insulated busbars enter a large pressure vessel below the storms.
      rect(g,20,136,92,9,p[0]);rect(g,19,135,94,3,p[2]);
      poly(g,[[30,134],[30,98],[35,88],[59,88],[63,98],[63,134]],p[1]);
      oval(g,47,96,16,7,p[2]);oval(g,47,98,15,5,p[1]);
      rect(g,32,98,3,35,p[2]);rect(g,55,98,5,34,p[0]);
      for(let j=0;j<4;j++){rect(g,29,101+j*8,36,2,p[2]);rect(g,31,101+j*8,6,1,p[3]);}
      line(g,40,90,40,76,p[1],4);line(g,40,76,78,76,p[2],4);line(g,77,76,77,132,p[1],5);
      for(let j=0;j<7;j++){rect(g,73,83+j*6,13,3,p[1]);rect(g,73,83+j*6,12,1,p[3]);}
      rect(g,77,120,25,5,p[1]);rect(g,96,116,5,17,p[2]);
      rect(g,35,65,9,14,p[2]);
      for(let k=0;k<4;k++){rect(g,32,63+k*4,15,2,p[2]);rect(g,32,63+k*4,7,1,'#ad8b78');}
    } else {
      const p=['#46515d','#63737b','#859195','#a7a99e'];
      // The keeper's oil store overlooks the last stair to the lens room.
      hut(g,24,137,62,31,p,'#806767');
      rect(g,67,94,6,13,p[1]);rect(g,65,94,10,2,p[3]);
      rect(g,28,110,50,2,p[2]);rect(g,20,138,79,4,p[0]);
      for(let j=0;j<4;j++){rect(g,88+j*4,132+j*3,16,3,p[2]);rect(g,89+j*4,132+j*3,14,1,p[3]);}
      rect(g,42,126,10,11,p[1]);rect(g,44,127,6,9,p[0]);
      rect(g,56,119,12,8,'#aaa594');rect(g,61,119,1,8,p[1]);rect(g,56,122,12,1,p[1]);
      line(g,19,129,19,107,p[2],2);rect(g,14,106,12,2,p[1]);rect(g,17,99,6,7,p[2]);
    }
    shoreTiles[kind]=c;return c;
  }
  const wharves=[[32,694,994],[53,660,1092],[],[-63,795,1097],[19,658,1042],[44,810]];
  function shores(i,local) {
    if(i>5 || !wharves[i].length)return;
    const offset=round(local*.67);
    for(const wx of wharves[i]) {
      const x=wx-offset;
      if(x>-149 && x<W+1)ctx.drawImage(shoreTile(i),x,86);
    }
  }
  const landscapeDetails=[];
  function detailPanel(i) {
    if(landscapeDetails[i])return landscapeDetails[i];
    const c=make(panorama,H),g=c.getContext('2d'),p=ledges[i];
    if(i===0) {
      const far=['#756179','#957783','#b48688','#c9988c','#dcac96'];
      crag(g,309,161,77,30,far,92); tower(g,349,157,.45,false,true);
      hut(g,322,158,13,8,far,'#9b746e');
      sailboat(g,607,175,.48,['#77616e','#caa295','#967779','#c09378']);
    } else if(i===1) {
      const far=['#476c6c','#5f857b','#7a9d83','#a2b392','#bec6a0'];
      for(const x of [310,813]) {
        crag(g,x-49,191,89,36,far,x);tree(g,x-26,188,30,far,x+17);
        rect(g,x-3,158,2,30,far[0]);rect(g,x+18,158,2,30,far[0]);
        poly(g,[[x-8,158],[x+8,145],[x+25,158]],far[0]);line(g,x-8,158,x+8,145,far[3]);
        rect(g,x+8,158,1,5,far[1]);bell(g,x+8,165,.53,true);
      }
    } else if(i===2) {
      const far=['#727e9d','#9ca7bd','#8993aa','#b5a9b2'];
      sailboat(g,264,167,.31,far);sailboat(g,298,159,.40,far);sailboat(g,818,145,.38,far);
    } else if(i===3) {
      const far=['#455f70','#607f87','#779997','#a0b5aa','#b6c6b1'];
      for(const x of [119,552,876]){
        crag(g,x,201,62,24,far,31+x);
        rect(g,x+8,193,43,5,far[1]);rect(g,x+9,192,40,1,far[3]);
        for(let j=0;j<5;j++)rect(g,x+11+j*8,184,1,8,far[2]);
        rect(g,x+12,183,34,1,far[2]);rect(g,x+38,176,2,16,far[1]);
        poly(g,[[x+35,176],[x+39,169],[x+43,176]],far[2]);
      }
    } else if(i===4) {
      // These generators power the animated turbines in the foreground.
      const frame=['#414355','#585769','#75717d','#98908a','#b2a294'];
      for(const [x,y,h] of [[60,201,84],[257,213,108],[477,178,72],[668,202,101],[895,196,63],[1050,211,89]]) {
        crag(g,x-28,y,58,38,frame,246+x);pylon(g,x,y-6,h,frame);
      }
      rope(g,60,147,257,158,23,frame[1]);rope(g,668,154,895,162,21,frame[1]);
    }
    landscapeDetails[i]=c;return c;
  }
  let beaconTile;
  function frameBeacon(local,t,lit) {
    if(!beaconTile){
      beaconTile=make(206,211);const g=beaconTile.getContext('2d'),p=ledges[5];
      crag(g,10,141,187,69,p,111);tower(g,103,137,1.1,false,true);
      hut(g,51,138,24,19,p,'#795f65');hut(g,126,139,31,15,p,'#866d6c');
      rect(g,20,138,166,3,p[1]);rect(g,22,132,161,1,p[2]);
      for(let x=22;x<184;x+=7)rect(g,x,132,1,7,p[1]);
    }
    const travel=clamp(local/1570,0,1), scale=.68+.32*travel;
    const x=round(397-65*travel-103*scale), y=round(192+21*travel-137*scale);
    ctx.drawImage(beaconTile,x,y,round(206*scale),round(211*scale));
    if(lit)beam(x+103*scale,y+(137-80*1.1)*scale,t,true);
  }
  const veils=[];
  function veil(i) {
    if(veils[i])return veils[i];
    const c=make(1,H), g=c.getContext('2d'), fade=g.createLinearGradient(0,26,0,246);
    const amount=[.34,.32,.20,.38,.27,.25][i];
    fade.addColorStop(0,'rgba(26,34,48,.06)');
    fade.addColorStop(.45,'rgba(32,43,56,'+(amount*.49)+')');
    fade.addColorStop(1,'rgba(26,39,49,'+amount+')');
    g.fillStyle=fade;g.fillRect(0,0,1,H);veils[i]=c;return c;
  }
  function paintScene(i,cam,t,lit=false) {
    const local=Math.max(0,cam-tops[Math.min(i,5)]);
    const offset=clamp(round(local*.265),0,panorama-W);
    if(i===6){
      ctx.drawImage(getDawnPanel(),offset,0,W,H,0,0,W,H);
      atmosphere(6,offset,t,true);return;
    }
    const plate=L7Skies.get(i), length=(tops[i+1]||10480)-tops[i];
    const pan=round((plate.width-W)*clamp((local+100)/length,0,1));
    ctx.drawImage(plate,pan,0,W,H,0,0,W,H);
    ctx.drawImage(veil(i),0,0,W,H);
    if(i===5)frameBeacon(local,t,lit);
    else ctx.drawImage(detailPanel(i),offset,0,W,H,0,0,W,H);
    atmosphere(i,offset,t,false);
    if(i===0&&lit)beam(349-offset,121,t,false);
    shores(i,local);
  }
  function bg(cam,lit=false) {
    const pos=cam+145, i=chapter(pos), t=G.t;
    rect(ctx,-10,-10,W+20,H+20,skies[i][0]);
    const victorious=i===5 && G.state==='win';
    paintScene(victorious?6:i,cam,t,lit);
    // Parallax blends one bank into the next before the new shoreline arrives.
    if(i>0 && pos<tops[i]+78 && !victorious) {
      ctx.save(); ctx.globalAlpha=1-(pos-tops[i])/78;
      paintScene(i-1,cam,t); ctx.restore();
    }
  }
  function dawn(t=G.t) {
    rect(ctx,-10,-10,W+20,H+20,skies[6][0]);
    ctx.drawImage(getDawnPanel(),103,0,W,H,0,0,W,H); atmosphere(6,103,t);
    const boats=[[46,202,.78],[344,178,.56],[440,195,.72]];
    boats.forEach(([x,y,s],j)=>sailboat(ctx,x+Math.sin(t*.013+j)*3,y+Math.sin(t*.026+j)*2,s,
      ['#485464','#efd0a3','#a98b83','#df8d70']));
  }

  const decks=[
    ['#272c3c','#48424d','#735554','#a47764','#d3a37c'],
    ['#283839','#435449','#686e52','#919558','#bdbe77'],
    ['#4f6175','#65768b','#8797a4','#aeb8be','#c7c9bf'],
    ['#243542','#384e5a','#536d76','#729299','#a3bdbc'],
    ['#242d3a','#384350','#55606a','#788384','#b19579'],
    ['#293540','#404b56','#616e76','#899596','#bbb7a6']
  ];
  function terrainTile(idx) {
    if(terrainChunks.has(idx)) return terrainChunks.get(idx);
    const c=make(tileWidth,H),g=c.getContext('2d'),start=idx*tileWidth;
    // Paint in world coordinates, including overscan for braces crossing a tile seam.
    g.save(); g.translate(-start,0);
    for(let x=start-2;x<start+tileWidth+2;x+=2) {
      const i=chapter(x),p=decks[i],y=round(groundAt(x));
      if(i===2) {
        const grad=g.createLinearGradient(0,y,0,H);
        grad.addColorStop(0,'rgba(170,183,190,.43)'); grad.addColorStop(1,'#6b7d93');
        g.fillStyle=grad;g.fillRect(x,y,2,H-y);
        if((x%20)<14) rect(g,x,y,2,1,p[3]);
      } else {
        rect(g,x,y,2,H-y,p[0]); rect(g,x,y+1,2,10,p[1]); rect(g,x,y+2,2,4,p[3]); rect(g,x,y,2,2,p[4]);
        if(i===1) {
          rect(g,x,y+6,2,8+3*Math.sin(x*.11),p[2]);
          if((x>>1)%5===0) rect(g,x,y-2,1,3,p[4]);
        }
      }
      if(i===0 || i===4 || i===5) rect(g,x,y+10,2,1,p[2]);
    }
    for(let k=Math.floor((start-84)/28);k<=Math.ceil((start+tileWidth+56)/28);k++) {
      const x=k*28, i=chapter(x), y=round(groundAt(x)), p=decks[i];
      if(i===0) {
        rect(g,x,y+2,2,5,p[1]); rect(g,x+3,y+3,3,1,p[4]); rect(g,x+8,y+5,13,1,p[2]);
        if(k%3===0) {
          rect(g,x-2,y+10,9,62,p[1]); rect(g,x-1,y+11,3,62,p[2]); line(g,x+5,y+44,x+46,groundAt(x+46)+12,p[2],3);
          rect(g,x-4,y+17,13,3,p[0]); rect(g,x+2,y+17,2,1,p[3]);
        }
      } else if(i===1) {
        const drop=18+(k%5+5)%5*4;
        poly(g,[[x-7,y+15],[x+21,y+15],[x+15,y+32],[x+4,y+drop+17],[x-4,y+28]],p[1]);
        line(g,x+5,y+18,x-2,y+30,p[2]); rect(g,x+8,y+9,10,2,p[3]);
        if(k%4===0) {
          line(g,x,y+9,x+2,y+30,'#526c5b');
          for(let j=0;j<4;j++) rect(g,x+(j%2?1:-2),y+14+j*4,3,2,'#77906c');
        }
      } else if(i===2) {
        rect(g,x+4,y+7+(k%3)*3,13,1,'rgba(213,218,218,.42)');
        rect(g,x+11,y+24+(k%6)*2,18,1,'rgba(189,201,207,.36)');
      } else if(i===3 || i===5) {
        for(let j=0;j<4;j++) {
          const xx=x+(j%2)*14, yy=y+12+j*11;
          poly(g,[[xx,yy],[xx+25,yy-1],[xx+27,yy+1],[xx+25,yy+9],[xx+1,yy+9]],p[j%3===0?2:1]);
          rect(g,xx+2,yy,17-(k%4),1,p[j%3===0?3:2]);
        }
        if(i===3 && k%3===0) {
          poly(g,[[x+5,y+17],[x+10,y+13],[x+16,y+17],[x+10,y+24]],'#647d88');
          line(g,x+5,y+17,x+10,y+13,'#89a2a1');
        }
      } else {
        rect(g,x,y+1,2,9,p[1]); rect(g,x+4,y+3,2,2,p[4]); rect(g,x+23,y+3,2,2,p[4]);
        if(k%3===0) {
          rect(g,x,y+15,70,6,p[2]); rect(g,x,y+16,70,1,p[3]); rect(g,x+8,y+14,3,9,p[1]);
          line(g,x+3,y+46,x+30,y+22,p[1],4); rect(g,x+40,y+23,6,37,p[1]);
        }
      }
    }
    g.restore(); terrainChunks.set(idx,c); return c;
  }
  function ground(cam) {
    for(let i=Math.floor((cam-10)/tileWidth); i<=Math.floor((cam+W+10)/tileWidth); i++)
      ctx.drawImage(terrainTile(i),i*tileWidth,0);
  }
  function plat(pl) {
    const i=chapter(pl.x), p=decks[i], x=pl.x, y=pl.y, w=pl.w;
    rect(ctx,x-1,y, w+2,7,ink); rect(ctx,x,y,w,2,p[4]); rect(ctx,x,y+2,w,3,p[2]); rect(ctx,x+1,y+5,w-2,1,p[1]);
    for(let xx=x+7;xx<x+w-4;xx+=13) {rect(ctx,xx,y+2,1,3,p[1]); rect(ctx,xx+2,y+3,1,1,p[3]);}
    if(i===1 || i===3) {
      for(const xx of [x+9,x+w-8]) {
        poly(ctx,[[xx-4,y+7],[xx+6,y+7],[xx+2,y+13],[xx-1,y+16]],p[1]);
        line(ctx,xx-2,y+7,xx+1,y+12,p[3]);
      }
    } else {
      line(ctx,x+3,y+7,x+14,y+13,p[2],2); line(ctx,x+14,y+13,x+20,y+7,p[1],2);
      line(ctx,x+w-21,y+7,x+w-12,y+14,p[2],2); line(ctx,x+w-13,y+14,x+w-4,y+7,p[1],2);
    }
  }
  function flag(g,x,y,t) {
    const wave=round(Math.sin(t*.11+x)*2);
    rect(g,x,y-37,2,37,'#52505c'); rect(g,x,y-37,1,37,'#a79b83');
    poly(g,[[x+2,y-36],[x+21,y-34+wave],[x+16,y-31+wave],[x+20,y-28+wave],[x+2,y-29]],'#a85355');
    poly(g,[[x+2,y-36],[x+18,y-34+wave],[x+14,y-32+wave],[x+2,y-33]],'#d9856e');
    rect(g,x+5,y-34,2,4,'#e0b88e'); rect(g,x-1,y-39,4,3,'#bc9975');
  }
  function props(cam) {
    const from=Math.floor((cam-60)/140), to=Math.ceil((cam+W+60)/140);
    for(let n=from;n<=to;n++){
      if(n<0)continue;
      const x=n*140+23+(n%3)*11, y=round(groundAt(x)), i=chapter(x);
      if(i===0) {
        if(n%3===0) flag(ctx,x,y,G.t);
        else {
          rect(ctx,x-3,y-17,6,17,'#564650'); rect(ctx,x-4,y-19,8,3,'#8c756a');
          rect(ctx,x-2,y-15,2,13,'#997d6a'); rect(ctx,x-4,y-6,9,2,'#c4a482');
        }
      } else if(i===1) {
        for(let j=0;j<7;j++) {
          const xx=x-11+j*3, yy=round(groundAt(xx));
          const top=yy-4-(n+j)%6;
          line(ctx,xx,yy,xx+2,top,'#617e64'); rect(ctx,xx+2,top,2,2,j%3?'#a99b71':'#deb58a');
        }
      } else if(i===3 && n%3===0) {
        rect(ctx,x-7,y-5,15,4,'#4c626c'); rect(ctx,x-3,y-15,7,11,'#4b6e79');
        poly(ctx,[[x-3,y-15],[x+1,y-22],[x+4,y-15]],'#86a7aa'); rect(ctx,x-2,y-14,2,6,'#a1bcb7');
      } else if(i===4 && n%3===0) {
        rect(ctx,x-10,y-10,22,10,'#39434d'); rect(ctx,x-10,y-11,22,2,'#677079');
        for(let j=0;j<4;j++) line(ctx,x-7+j*5,y-8,x-8+j*5,y-4,'#777877');
      } else if(i===5 && n%4===0) flag(ctx,x,y,G.t);
    }
  }
  function keeper(x,y,t=0,facing=1) {
    const bob=round(Math.sin(t*.11)*.7), flap=round(Math.sin(t*.17)*2);
    ctx.save(); ctx.translate(round(x),round(y)); ctx.scale(facing<0?-1:1,1);
    rect(ctx,-5,-4,4,4,ink); rect(ctx,2,-4,4,4,ink);
    ctx.translate(0,bob);
    poly(ctx,[[-4,-14],[4,-14],[6,-11],[7,-4],[-6,-4],[-5,-11]],ink);
    rect(ctx,-4,-12,8,7,'#43737a'); rect(ctx,-3,-11,2,6,'#79a398'); rect(ctx,0,-7,4,2,'#2d5863');
    rect(ctx,-5,-15,9,4,'#b4514d'); rect(ctx,-4,-15,8,2,'#e98268');
    poly(ctx,[[-3,-15],[-9,-14+flap],[-14,-16+flap],[-12,-13+flap],[-14,-11+flap],[-7,-11+flap],[-3,-12]],'#be5851');
    rect(ctx,-4,-23,9,8,ink); rect(ctx,-3,-21,7,6,'#d8a582'); rect(ctx,-2,-21,6,3,'#f1ca9e'); rect(ctx,3,-20,1,2,ink);
    rect(ctx,-5,-24,10,3,'#314b59'); rect(ctx,-3,-26,7,3,'#638491'); rect(ctx,-5,-23,12,2,'#9ba798');
    rect(ctx,-1,-25,4,2,'#efcd8d'); rect(ctx,3,-17,3,3,'#d7c4a6');
    rect(ctx,5,-11,3,4,'#deb792'); rect(ctx,7,-13,2,8,ink);
    rect(ctx,5,-6,7,2,'#af8557'); rect(ctx,6,-4,5,5,'#e6ab64'); rect(ctx,7,-4,2,4,'#ffefad'); rect(ctx,5,0,7,1,ink);
    ctx.restore();
  }
  function preview(x,y,w,h) {
    ctx.save(); ctx.translate(x,y);
    rect(ctx,0,0,w,h+12,'#37465d');
    ctx.drawImage(L7Skies.get(5),143,0,307,263,0,0,w,h+5);
    const tx=w*.69, ty=h*.87;
    tower(ctx,tx,ty,.66,true); beam(tx,ty-53,G.t,true);
    poly(ctx,[[0,h*.86],[w*.20,h*.77],[w*.35,h*.81],[w*.47,h*.93],[w,h*.93],[w,h+12],[0,h+12]],'#283746');
    sailboat(ctx,w*.24,h*.58,.64,['#293b4c','#e4bc94','#b68377','#d27c66']);
    drawHero(HEROES[G.hero],round(w*.22),round(h*.85),1,{pose:'idle',t:G.t,aim:'fwd'});
    ctx.restore();
  }
  function menuBG() { paintScene(0,80,G.t,true); }
  function drawMenu(cx,y) { tower(ctx,cx,y,.55,true); }
  return {bg,ground,props,plat,preview,menuBG,drawMenu,dawn,keeper};
})();
