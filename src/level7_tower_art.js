'use strict';

// The belfry is a cutaway, drawn at the same pixel scale as the heroes.
// Openings in the cached stone shell reveal a more slowly scrolling skyline.
const L7TowerArt = (() => {
  const ink='#162a39', deep='#243b48', slate='#39535f', steel='#587480', silver='#8aa4a3';
  const wood='#654e49', oak='#947457', copper='#b78256', gold='#dfb479', lit='#f7dba0';
  const glass='#79a7a8', aqua='#a4e3cd', rust='#8d5556', red='#c77764';
  const worldH=752;
  let shell,roofFrame,portal;
  const ledges=new Map();
  const rnd=Math.round;

  function canvas(w,h){
    const c=document.createElement('canvas');c.width=w;c.height=h;
    c.getContext('2d').imageSmoothingEnabled=false;return c;
  }
  function px(g,x,y,w,h,col){
    g.fillStyle=col;g.fillRect(rnd(x),rnd(y),rnd(w),rnd(h));
  }
  function line(g,x,y,xx,yy,col,w=1){
    const n=Math.max(1,Math.ceil(Math.max(Math.abs(xx-x),Math.abs(yy-y))));
    g.fillStyle=col;
    for(let i=0;i<=n;i++)g.fillRect(rnd(x+(xx-x)*i/n),rnd(y+(yy-y)*i/n),w,w);
  }
  function poly(g,pts,col){
    const ys=pts.map(p=>p[1]);g.fillStyle=col;
    for(let y=Math.ceil(Math.min(...ys)-.5);y<Math.max(...ys)-.5;y++){
      const cuts=[],scan=y+.5;
      for(let i=0,j=pts.length-1;i<pts.length;j=i++){
        const a=pts[j],b=pts[i];
        if((a[1]<=scan&&scan<b[1])||(b[1]<=scan&&scan<a[1]))
          cuts.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      cuts.sort((a,b)=>a-b);
      for(let i=0;i+1<cuts.length;i+=2){const x=rnd(cuts[i]);g.fillRect(x,y,rnd(cuts[i+1])-x,1);}
    }
  }
  function oval(g,x,y,rx,ry,col){
    g.fillStyle=col;
    for(let j=-Math.floor(ry);j<=ry;j++){
      const half=rnd(rx*Math.sqrt(Math.max(0,1-(j/ry)**2)));
      g.fillRect(rnd(x)-half,rnd(y)+j,half*2+1,1);
    }
  }
  function pin(g,x,y,bright=false){
    px(g,x-1,y-1,4,4,ink);px(g,x-1,y-1,3,2,bright?gold:'#879491');px(g,x-1,y-1,1,1,bright?lit:'#bfd0bd');
  }
  function seed(s){return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}

  function beam(g,x,y,xx,yy,w,face,edge){
    line(g,x,y,xx,yy,ink,w+2);line(g,x+1,y+1,xx+1,yy+1,face,w);
    line(g,x+1,y+1,xx+1,yy+1,edge);
  }
  function crown(g,x,y,s=1){
    const pts=[[-10,3],[-12,-5],[-6,-1],[-3,-8],[1,-2],[6,-8],[6,-2],[13,-6],[10,3]];
    poly(g,pts.map(([a,b])=>[x+a*s,y+b*s]),gold);
    px(g,x-9*s,y+3*s,18*s,2*s,copper);px(g,x-6*s,y+3*s,10*s,s,lit);
    px(g,x-2*s,y-s,3*s,3*s,glass);
  }

  function archPoints(x,y,w,h){
    return [[x,y+h],[x,y+h*.37],[x+w*.08,y+h*.23],[x+w*.25,y+h*.10],
      [x+w*.50,y],[x+w*.75,y+h*.10],[x+w*.92,y+h*.23],[x+w,y+h*.37],[x+w,y+h]];
  }
  function lancet(g,x,y,w,h,mullions=1){
    // Carved springers and a metal sill frame an actual transparent opening.
    poly(g,archPoints(x-7,y-6,w+14,h+10),'#283e4a');
    poly(g,archPoints(x-4,y-3,w+8,h+7),'#71868a');
    poly(g,archPoints(x-2,y-1,w+4,h+5),deep);
    g.save();g.globalCompositeOperation='destination-out';poly(g,archPoints(x,y,w,h),'#fff');g.restore();
    for(let k=1;k<=mullions;k++){
      const f=k/(mullions+1),xx=x+w*f;
      const crest=y+h*.19*Math.abs(f-.5)*2;
      px(g,xx,crest,3,y+h-crest,'#415d67');px(g,xx,crest,1,y+h-crest,'#859993');
    }
    const by=y+h*.70;
    px(g,x,by,w,2,'#4f6870');px(g,x+1,by+1,w-2,1,'#809b96');
    px(g,x-8,y+h,w+16,5,'#263e49');px(g,x-5,y+h,w+10,2,'#8b9487');
    px(g,x-3,y+h+5,w+6,2,'#48616a');
    for(const xx of [x-6,x+w+3]){
      px(g,xx,y+h*.42,3,h*.58,'#435b65');
      px(g,xx-1,y+h*.43,5,3,'#809391');
    }
  }
  function roseWindow(g,x,y,r){
    oval(g,x,y,r+7,r+7,deep);oval(g,x,y,r+5,r+5,'#758789');
    oval(g,x,y,r+3,r+3,'#314b58');oval(g,x,y,r+1,r+1,copper);
    g.save();g.globalCompositeOperation='destination-out';oval(g,x,y,r-1,r-1,'#fff');g.restore();
    const tones=['rgba(151,185,174,.44)','rgba(222,174,125,.48)','rgba(159,152,174,.46)','rgba(113,169,174,.39)'];
    for(let k=0;k<12;k++){
      const a=k*Math.PI/6,b=a+Math.PI/6;
      const point=(s,t)=>[x+s*Math.cos(t),y+s*Math.sin(t)];
      poly(g,[point(r*.23,a+.05),point(r*.68,a+.035),point(r*.91,(a+b)/2),point(r*.68,b-.035),point(r*.23,b-.05)],tones[k%4]);
      line(g,...point(r*.20,a),...point(r*.99,a),'#466471',2);
      line(g,...point(r*.63,a),...point(r*.86,(a+b)/2),'#a6ada1');
      line(g,...point(r*.86,(a+b)/2),...point(r*.63,b),'#637e81');
    }
    oval(g,x,y,r*.24,r*.24,'#455b64');oval(g,x,y,r*.17,r*.17,'#99a9a0');
    oval(g,x,y,r*.10,r*.10,'#d5be91');
    for(let k=0;k<8;k++){const a=k*Math.PI/4;pin(g,x+(r+4)*Math.cos(a),y+(r+4)*Math.sin(a));}
  }
  function gear(g,x,y,r,phase){
    const teeth=r>15?12:8;
    for(let k=0;k<teeth;k++){
      const a=phase+k*Math.PI*2/teeth,h=.13;
      const point=(rad,t)=>[x+rad*Math.cos(t),y+rad*Math.sin(t)];
      poly(g,[point(r-2,a-h),point(r+2,a-h),point(r+2,a+h),point(r-2,a+h)],'#a27a56');
    }
    oval(g,x,y,r-1,r-1,deep);oval(g,x,y,r-3,r-3,'#a57f60');oval(g,x,y,r-5,r-5,'#3a505b');
    for(let k=0;k<5;k++){
      const a=phase+k*Math.PI*2/5,xx=x+Math.cos(a)*(r-5),yy=y+Math.sin(a)*(r-5);
      line(g,x,y,xx,yy,'#b18d69',2);
    }
    oval(g,x,y,4,4,ink);oval(g,x,y,2,2,'#cab69a');
  }
  function bell(g,x,lip,w,h,awake=false){
    // In profile the flared mouth and the clapper read even without motion.
    const a=(verts,colour)=>poly(g,verts.map(([u,v])=>[x+u*w,lip+v*h]),colour);
    a([[-.52,-.08],[-.38,-.22],[-.29,-.63],[-.22,-.81],[-.12,-.91],[.12,-.91],[.23,-.81],[.31,-.56],[.37,-.23],[.52,-.08],[.50,.04],[-.5,.04]],ink);
    a([[-.46,-.08],[-.31,-.25],[-.24,-.63],[-.17,-.79],[-.11,-.84],[.11,-.84],[.19,-.75],[.25,-.57],[.32,-.24],[.46,-.08]],awake?'#d8ae69':'#b68b61');
    a([[.06,-.82],[.18,-.72],[.25,-.56],[.32,-.24],[.46,-.08],[.14,-.07],[.1,-.28]],'#86634e');
    a([[-.31,-.24],[-.23,-.64],[-.14,-.75],[-.17,-.49],[-.21,-.27]],awake?lit:'#d5aa77');
    px(g,x-w*.34,lip-h*.18,w*.68,2,copper);px(g,x-w*.41,lip-h*.10,w*.82,2,awake?lit:gold);
    oval(g,x,lip+1,w*.48,2,ink);oval(g,x,lip+2,w*.40,1,'#725844');
    px(g,x-1,lip,2,5,wood);oval(g,x,lip+5,3,2,awake?lit:gold);
    const top=lip-h*.87;px(g,x-3,top-4,6,4,ink);px(g,x-2,top-4,4,2,gold);
  }

  function masonry(g) {
    const grad=g.createLinearGradient(0,0,0,worldH);
    grad.addColorStop(0,'#354f60');grad.addColorStop(.32,'#526b73');
    grad.addColorStop(.60,'#49636a');grad.addColorStop(1,'#4f5356');
    g.fillStyle=grad;g.fillRect(0,0,480,worldH);
    const r=seed(713);
    for(let row=0,y=-8;y<worldH;y+=16,row++){
      let x=-20-(row%2)*30;
      while(x<480){
        const w=31+Math.floor(r()*31),value=Math.floor(r()*5)+2;
        px(g,x,y,w-2,14,'rgba(197,200,179,.'+String(value).padStart(2,'0')+')');
        px(g,x,y+14,w,2,'rgba(22,40,49,.23)');px(g,x+w-2,y+1,2,14,'rgba(22,40,49,.19)');
        px(g,x+3,y,w*.56,1,'rgba(181,192,181,.13)');
        if(r()>.47){px(g,x+5+w*r()*.5,y+4+r()*6,3+r()*7,1,'rgba(26,44,52,.22)');}
        x+=w;
      }
    }
    // The curved interior recedes into the side walls.
    const falloff=g.createLinearGradient(0,0,480,0);
    falloff.addColorStop(0,'rgba(15,27,40,.68)');falloff.addColorStop(.20,'rgba(15,29,38,.17)');
    falloff.addColorStop(.52,'rgba(15,29,38,.03)');falloff.addColorStop(.83,'rgba(15,29,38,.26)');
    falloff.addColorStop(1,'rgba(15,27,40,.75)');g.fillStyle=falloff;g.fillRect(0,0,480,worldH);
  }
  function exteriorRibs(g){
    for(const side of [-1,1]){
      const sx=n=>side<0?n:480-n;
      poly(g,[[sx(0),0],[sx(47),0],[sx(64),85],[sx(53),172],[sx(65),246],[sx(54),345],[sx(69),424],[sx(57),497],[sx(69),582],[sx(60),648],[sx(79),752],[sx(0),752]],'#223947');
      poly(g,[[sx(36),0],[sx(49),0],[sx(66),88],[sx(54),172],[sx(65),246],[sx(55),345],[sx(70),424],[sx(58),497],[sx(70),582],[sx(60),648],[sx(79),752],[sx(65),752],[sx(48),650],[sx(57),582],[sx(47),498],[sx(57),424],[sx(44),345],[sx(53),246],[sx(42),172],[sx(51),91]],'#607782');
      for(let y=28;y<worldH;y+=67){
        const lip=54+((y%130)>60?7:0),x=side<0?5:480-lip;
        px(g,x,y,lip-5,3,'#2b4450');px(g,x+4,y,lip-13,1,'#647980');
        px(g,sx(28),y+12,4,11,ink);px(g,sx(31),y+13,1,6,'#667880');
      }
    }
  }
  function castingHouse(g){
    // A ribbed copper casting furnace anchors the lowest room. Behind its
    // grille the flame is animated independently from the stationary casing.
    const x=328,y=663;
    rectFurnace(g,x,y);
    beam(g,x-35,y-38,x-35,y-92,6,'#655b55','#9c8775');
    beam(g,x-35,y-92,x+12,y-92,7,'#655b55','#958674');
    beam(g,x+12,y-92,x+12,y-66,7,'#655b55','#998674');
    for(let i=0;i<4;i++)px(g,x-38,y-82+i*10,12,3,'#8b7765');
    // A flywheel drives the furnace bellows, protected by an iron hood.
    poly(g,[[81,694],[80,655],[98,637],[131,637],[144,653],[145,695]],'#304956');
    oval(g,112,665,21,21,'#735e53');oval(g,112,665,19,19,deep);
    px(g,81,690,65,4,steel);px(g,84,695,56,8,'#374d55');
  }
  function rectFurnace(g,x,y){
    poly(g,[[x-33,y+25],[x-33,y-31],[x-22,y-52],[x-10,y-61],[x+18,y-61],[x+32,y-46],[x+40,y-29],[x+40,y+25]],'#313f46');
    poly(g,[[x-28,y+23],[x-28,y-29],[x-18,y-49],[x-6,y-55],[x+17,y-55],[x+28,y-44],[x+34,y-28],[x+34,y+23]],'#7a6760');
    for(let j=0;j<6;j++){
      const yy=y-43+j*9;px(g,x-19,yy,42,2,'#927867');px(g,x+21,yy+1,10,2,'#514f51');
    }
    poly(g,archPoints(x-19,y-32,38,40),ink);poly(g,archPoints(x-15,y-28,30,35),'#624e4a');
    px(g,x-35,y+12,72,5,'#b18b64');px(g,x-33,y+17,69,7,'#53616a');
    px(g,x-25,y+23,7,10,deep);px(g,x+22,y+23,7,10,deep);
    px(g,x+22,y-24,10,2,'#b28d70');px(g,x+26,y-31,2,15,oak);
  }
  function pulleyRecess(g){
    poly(g,[[315,247],[326,227],[350,227],[361,246],[361,399],[315,399]],'#344b57');
    px(g,322,247,33,147,'#263e49');px(g,319,247,2,148,'#71828a');
    px(g,327,252,2,135,'#566e74');px(g,349,252,2,135,'#455e68');
    px(g,318,395,41,4,'#87908a');px(g,320,399,35,4,deep);
    beam(g,174,227,303,227,6,'#56585b','#9c8875');
    beam(g,177,228,162,248,4,'#5d5959','#85857b');beam(g,285,228,300,245,4,'#5d5959','#85857b');
    for(const x of [182,219,275,297])pin(g,x,230);
  }
  function crownRoof(g){
    poly(g,[[58,0],[422,0],[422,28],[348,57],[283,81],[239,87],[169,69],[94,41],[58,40]],'#263e4d');
    for(const [x,y] of [[58,24],[90,8],[130,-6],[182,-12],[295,-7],[345,1],[408,18]]){
      beam(g,x,y,232,81,4,'#455b64','#72827f');
    }
    px(g,144,79,182,7,'#655950');px(g,144,79,182,2,'#ac9478');
    for(const x of [151,192,223,273,318])pin(g,x,82);
    px(g,204,86,15,5,ink);px(g,206,86,11,2,copper);
  }
  function interior(){
    if(shell)return shell;
    shell=canvas(480,worldH);const g=shell.getContext('2d');
    masonry(g);
    lancet(g,95,525,94,99,2);lancet(g,253,499,62,86,1);
    lancet(g,96,294,77,118,1);lancet(g,181,248,92,129,2);
    roseWindow(g,324,437,37);
    lancet(g,91,84,70,105,1);lancet(g,301,83,79,107,2);
    // Stone arcs and diagonal sunbeams leave the centre of each jump quiet.
    for(const [x,y,w,h] of [[95,526,95,98],[181,249,91,128],[301,84,77,104]]){
      poly(g,[[x+w-3,y+h*.33],[x+w,y+h*.65],[x+w+64,y+h+60],[x+w+35,y+h+59]],'rgba(211,205,167,.065)');
    }
    exteriorRibs(g);castingHouse(g);pulleyRecess(g);crownRoof(g);
    // Vertical glazed conductor pipes carry the eye from the entry to the carillon.
    for(const x of [77,398]){
      px(g,x,73,5,618,'#314651');px(g,x+1,73,2,618,'#a18b74');px(g,x+3,73,1,618,'#5f686b');
      for(let y=94;y<692;y+=38){px(g,x-2,y,8,3,deep);px(g,x-1,y,6,1,'#ad967a');}
    }
    // At the middle landing, a small tiled arch shelters the refuge lamp.
    poly(g,archPoints(165,404,71,43),'#465f68');poly(g,archPoints(170,410,61,36),'#334e5a');
    px(g,164,444,73,4,'#668087');
    return shell;
  }
  function ledgeTile(w,kind){
    const id=kind+'/'+w;if(ledges.has(id))return ledges.get(id);
    const c=canvas(w+6,54),g=c.getContext('2d');
    const isFloor=kind==='floor',special=kind==='refuge'||kind==='summit'||kind==='dock';
    const edge=special?'#f2d29a':'#e4c79b', facing=kind==='dock'?'#725d56':'#536674';
    px(g,2,1,w+2,9,ink);px(g,3,1,w,2,edge);px(g,3,3,w,2,'#ac9272');px(g,3,5,w,4,facing);
    for(let n=7;n<w-3;n+=16){
      px(g,n+2,4,2,4,deep);px(g,n+4,5,2,1,silver);
      px(g,n+6,2,5,1,'#bea789');
    }
    if(isFloor){
      px(g,4,10,w-2,37,'#374c59');px(g,4,10,w-2,4,'#778184');
      for(let x=4;x<w-3;x+=34){
        px(g,x+2,16,30,12,'#465c68');px(g,x+4,17,22,1,'#667780');
        px(g,x+14,31,27,12,'#465c68');px(g,x+16,32,18,1,'#637780');
      }
    }else{
      const a=10,b=w-11;
      for(const [x,dir] of [[a,1],[b,-1]]){
        poly(g,[[x,10],[x+dir*22,10],[x+dir*7,23],[x,23]],ink);
        poly(g,[[x+dir*3,10],[x+dir*17,10],[x+dir*5,19]],'#61737c');
        line(g,x+dir*18,10,x+dir*5,21,'#9a9583');
        px(g,x-1,10,3,13,'#8b8273');pin(g,x,13);
      }
      if(special){
        const m=rnd(w/2);
        poly(g,[[m-6,9],[m+7,9],[m+4,13],[m,15],[m-5,13]],'#745f55');
        px(g,m-3,10,8,1,gold);
      }
    }
    ledges.set(id,c);return c;
  }
  function drawPlatform(g,pl){
    const w=rnd(pl.w);
    g.drawImage(ledgeTile(w,pl.kind),rnd(pl.x)-3,rnd(pl.y)-1);
  }
  function signalBell(g,x,y,litUp,t){
    px(g,x-3,y-30,4,29,ink);px(g,x-2,y-29,2,27,oak);
    px(g,x-6,y-31,15,3,ink);px(g,x-5,y-31,12,1,gold);
    bell(g,x+4,y-19,13,10,litUp);
    line(g,x+4,y-14,x+4+Math.sin(t*.07),y-8,'#d1ac79');px(g,x+3,y-8,3,3,litUp?aqua:gold);
  }
  function hoistRig(g,h,t){
    const mid=rnd(h.x+h.w/2), axle=h.topY-48;
    // Moving ropes run to a counterweight that rises when the cabin descends.
    for(const x of [h.x+1,h.x+h.w-4]){
      px(g,x,axle+3,4,h.baseY-axle+12,'#304952');px(g,x+1,axle+3,1,h.baseY-axle+12,'#7c8b86');
      for(let y=axle+14;y<h.baseY+8;y+=18)px(g,x+2,y,3,2,'#708281');
    }
    for(const x of [mid-8,mid+7]){
      px(g,x,axle+3,2,h.y-axle-12,'#395058');px(g,x,axle+4,1,h.y-axle-13,'#ae9980');
      const k=rnd(h.y)%9;for(let y=axle+6+k;y<h.y-10;y+=9)px(g,x,y,1,2,'#d0b99b');
    }
    const weightY=rnd(252+(h.baseY-h.y)*.60);
    px(g,336,237,2,weightY-236,'#9b8a75');
    px(g,329,weightY,17,26,ink);px(g,330,weightY+2,14,22,'#6a7072');px(g,330,weightY+2,3,20,'#90928a');
    for(let j=0;j<3;j++){px(g,328,weightY+5+j*7,18,3,'#867b6b');px(g,329,weightY+5+j*7,15,1,'#ab9680');}
    const rot=(h.baseY-h.y)*.052+.02*Math.sin(t*.06);
    gear(g,mid,axle,12,rot);gear(g,mid+20,axle+3,8,-rot*1.5);
    for(const y of [h.topY,h.baseY]){
      px(g,h.x-7,y-3,8,4,ink);px(g,h.x-6,y-2,5,2,copper);
      px(g,h.x+h.w-1,y-3,8,4,ink);px(g,h.x+h.w,y-2,5,2,copper);
    }
    const y=rnd(h.y);
    // The player lands on the bright, uninterrupted horizontal lip.
    poly(g,[[h.x+1,y+4],[h.x+h.w-1,y+4],[h.x+h.w-8,y+19],[h.x+8,y+19]],deep);
    poly(g,[[h.x+4,y+7],[h.x+h.w-4,y+7],[h.x+h.w-10,y+15],[h.x+10,y+15]],'#396670');
    for(let xx=h.x+10;xx<h.x+h.w-8;xx+=9){line(g,xx,y+8,xx+5,y+13,'#78948d');line(g,xx+5,y+13,xx+9,y+8,'#263f50');}
    for(const xx of [h.x+4,h.x+h.w-7]){
      oval(g,xx,y+6,4,4,ink);oval(g,xx,y+6,2,2,copper);
      line(g,xx,y-1,xx+(xx===h.x+4?15:-14),y-13,'#647b7b',2);
    }
    px(g,h.x-1,y,h.w+2,6,ink);px(g,h.x,y,h.w,2,lit);px(g,h.x,y+2,h.w,2,'#b4895c');
    for(let xx=h.x+5;xx<h.x+h.w-4;xx+=8)px(g,xx,y+2,3,2,'#795c50');
    px(g,mid-8,y+4,16,6,deep);px(g,mid-6,y+5,12,2,h.enabled?aqua:'#a99a79');
  }
  function refugeLamp(g,refuge,t){
    const x=refuge.x+37,y=refuge.y,on=refuge.lit;
    // An oil lamp under the shelter turns sea-green as soon as the keeper
    // reaches this landing. Both glass and wick are visible when unlit.
    px(g,x-2,y-7,5,6,ink);px(g,x-5,y-8,11,3,'#a18c73');
    px(g,x-5,y-22,11,15,ink);px(g,x-4,y-21,9,12,on?'#75b8a6':'#687d7e');
    px(g,x-1,y-19,4,7,on?aqua:'#ad9b75');px(g,x,y-18,2,3,on?'#f5eed0':'#d3b588');
    px(g,x-7,y-23,15,3,'#6c6157');px(g,x-5,y-24,11,2,copper);
    px(g,x-1,y-27,3,4,'#8f8874');
    if(on){px(g,x-11,y-19,2,1,aqua);px(g,x+9,y-17,2,1,aqua);if(Math.floor(t/22)%2)px(g,x+11,y-21,1,1,lit);}
  }
  function summitBell(g,s,t){
    const x=s.x,lip=s.y-43;
    // The roof signal has the same crown stamp and red pull as the street door.
    px(g,x-19,91,40,4,'#534b4b');px(g,x-18,91,36,1,'#b69a78');
    for(const d of [-1,1]){line(g,x+d*17,94,x+d*4,101,ink,3);line(g,x+d*17,94,x+d*4,101,'#967755');}
    bell(g,x,lip,47,32,s.lit);crown(g,x,lip-13,.42);
    const endX=x+1+rnd(Math.sin(t*.049)*2),base=lip+5;
    line(g,x,base,endX,s.y-13,'#574b47',2);line(g,x+1,base,endX+1,s.y-13,gold);
    px(g,endX-2,s.y-13,6,3,ink);px(g,endX-1,s.y-12,4,5,red);px(g,endX,s.y-11,1,4,lit);
    if(s.lit){px(g,x-29,lip-12,4,1,lit);px(g,x+27,lip-10,4,1,lit);}
  }
  function furnaceFire(g,t){
    const x=328,y=663;
    poly(g,archPoints(x-13,y-26,26,32),'#674944');
    for(let j=0;j<5;j++){
      const xx=x-12+j*5, flame=5+rnd((1+Math.sin(t*.11+j*2))*4);
      poly(g,[[xx,y+5],[xx+1,y+1-flame],[xx+3,y-3],[xx+5,y-2-flame*.4],[xx+6,y+5]],j%2?'#d49c65':'#b96e53');
    }
    for(let j=0;j<4;j++)px(g,x-10+j*6,y-13,2,20,'#3d494c');
    px(g,x-14,y-4,28,2,'#596164');gear(g,112,665,14,t*.024);
  }
  function render(v){
    const camera=rnd(v.cameraY),t=v.frame;
    ctx.save();ctx.imageSmoothingEnabled=false;
    const sx=53+Math.floor((worldH-camera)*.05),sy=clamp(rnd(4+camera*.075),0,43);
    ctx.drawImage(L7Skies.get(3),sx,sy,403,227,0,0,W,H);
    const skyMix=clamp(.9-camera*.0021,.13,.93);
    ctx.save();ctx.globalAlpha=skyMix;ctx.drawImage(L7Skies.get(2),sx,sy,403,227,0,0,W,H);ctx.restore();
    px(ctx,0,0,W,H,'rgba(46,69,78,.25)');
    ctx.translate(0,-camera);ctx.drawImage(interior(),0,0);
    if(camera+H>619)furnaceFire(ctx,t);
    if(camera<445&&camera+H>208)hoistRig(ctx,v.hoist,t);
    for(const pl of v.platforms){
      if(pl.y>=camera-47&&pl.y<camera+H+1)drawPlatform(ctx,pl);
    }
    if(v.refuge.y>camera-4&&v.refuge.y<camera+H+34)refugeLamp(ctx,v.refuge,t);
    const dock=v.platforms.find(pl=>pl.kind==='dock');
    if(dock&&dock.y>camera-4&&dock.y<camera+H+34)signalBell(ctx,dock.x+dock.w-18,dock.y,v.hoist.enabled,t);
    if(v.summit.y<camera+H+78&&camera<169)summitBell(ctx,v.summit,t);
    ctx.restore();
  }

  function buildRoofFrame(){
    if(roofFrame)return roofFrame;
    roofFrame=canvas(520,229);const g=roofFrame.getContext('2d');
    // Iron fan trusses and wind-shorn corner posts form an open Gothic crown.
    // The three playable carillon ropes are drawn by the Bell Heron encounter.
    for(const side of [-1,1]){
      const s=x=>side<0?x:520-x;
      poly(g,[[s(0),210],[s(28),210],[s(24),157],[s(30),97],[s(34),74],[s(19),74],[s(17),62],[s(7),64]],'#354b58');
      poly(g,[[s(11),208],[s(18),208],[s(18),160],[s(24),101],[s(27),77],[s(22),77],[s(18),104],[s(12),159]],'#778485');
      for(let j=0;j<5;j++){const y=95+j*21;line(g,s(12),y,s(21),y,'#8a887a',2);}
      poly(g,[[s(0),76],[s(17),57],[s(24),20],[s(30),55],[s(45),72],[s(58),77]],'#29414f');
      line(g,s(18),57,s(24),26,'#a2a092');line(g,s(24),26,s(28),51,'#8c8176');
      px(g,s(23),15,2,12,'#677b7e');px(g,s(22),15,4,2,'#c0a582');
      beam(g,s(23),76,s(71),45,5,'#54616b','#929089');
      beam(g,s(23),77,s(92),73,4,'#6f6358','#b09879');
      beam(g,s(73),45,s(93),73,3,'#5c6061','#918a79');
      px(g,s(67),39,3,11,deep);
    }
    px(g,39,72,442,8,'#344a53');px(g,40,72,440,2,'#b29676');px(g,40,75,439,2,'#716457');
    for(let x=50;x<472;x+=22){px(g,x,74,3,3,'#4c5051');px(g,x,74,2,1,'#cab297');}
    for(const x of [120,260,400]){px(g,x-6,77,13,4,deep);px(g,x-4,79,9,2,'#998772');}
    return roofFrame;
  }
  function roof(cam){
    const t=G.t,offset=clamp(rnd((cam-6460)*.065),-24,31);
    ctx.save();ctx.imageSmoothingEnabled=false;
    // The high gallery opens onto the same windward sky as the upper lancets.
    ctx.drawImage(L7Skies.get(2),clamp(28+offset,0,60),0,W,H,0,0,W,H);
    px(ctx,0,0,W,H,'rgba(72,94,106,.21)');
    const fade=ctx.createLinearGradient(0,65,0,225);
    fade.addColorStop(0,'rgba(51,68,80,.10)');fade.addColorStop(.66,'rgba(59,77,84,.22)');fade.addColorStop(1,'rgba(44,60,64,.41)');
    ctx.fillStyle=fade;ctx.fillRect(0,65,W,161);
    const frameX=Math.round(6460-cam)-20;
    ctx.drawImage(buildRoofFrame(),frameX,0);
    for(const side of [-1,1]){
      const x=side<0?frameX+46:frameX+474, wave=rnd(Math.sin(t*.09+side)*2);
      line(ctx,x,55,x,34,'#4b5b63',2);
      poly(ctx,[[x+1,35],[x+15,36+wave],[x+10,40+wave],[x+14,42+wave],[x+1,41]],'#865860');
      px(ctx,x+2,36,4,2,'#c9a087');
    }
    const first=Math.floor((cam-10)/23);
    for(let i=first;i<first+24;i++){
      const wx=i*23,sx=wx-cam,yy=rnd(groundAt(wx));
      // Balustrade pillars stay below the duel and count as scenery.
      px(ctx,sx,yy-13,2,13,'#697d80');line(ctx,sx,yy-14,sx+23,groundAt(wx+23)-14,'#93a09b');
      if(i%4===0){px(ctx,sx-2,yy-15,6,3,'#596d73');px(ctx,sx-1,yy-16,4,1,'#a49c89');}
    }
    // Sample the real playable terrain: the lip and the character's feet
    // coincide throughout the arena and along the eastward exit.
    for(let sx=-10;sx<=W+10;sx+=2){
      const wx=cam+sx,yy=rnd(groundAt(wx));
      px(ctx,sx,yy,2,H+12-yy,'#324754');px(ctx,sx,yy,2,2,'#ddbf92');px(ctx,sx,yy+2,2,3,'#a28c73');
      px(ctx,sx,yy+5,2,5,'#607681');px(ctx,sx,yy+10,2,2,'#263e49');
    }
    for(let i=Math.floor((cam-54)/42);i<Math.ceil((cam+W+45)/42);i++){
      const wx=i*42,sx=wx-cam,yy=rnd(groundAt(wx));
      for(let j=0;j<3;j++){
        const x=sx+(j%2)*20,y=yy+14+j*12;
        poly(ctx,[[x,y],[x+37,y-1],[x+40,y+2],[x+37,y+9],[x+2,y+10]],j===0?'#4d626e':'#435864');
        px(ctx,x+3,y,21,1,'#77888b');px(ctx,x+4,y+3,4,1,'#566973');
      }
      px(ctx,sx+1,yy+3,1,6,'#52626b');pin(ctx,sx+4,yy+5);
    }
    ctx.restore();
  }
  function entrySprite(){
    if(portal)return portal;
    portal=canvas(120,147);const g=portal.getContext('2d');
    // A weathered ashlar porch projects from the rain-glass workshops. Its
    // crown fanlight and suspended red pull repeat at the shaft's summit.
    poly(g,[[8,146],[8,82],[14,73],[14,67],[46,44],[73,46],[104,65],[105,83],[111,92],[111,146]],'#304653');
    poly(g,[[15,143],[15,82],[29,68],[48,56],[69,55],[91,69],[101,83],[101,143]],'#708084');
    poly(g,[[81,65],[102,68],[107,87],[107,144],[95,144],[94,84]],'#49616d');
    poly(g,archPoints(28,68,54,77),deep);
    poly(g,archPoints(32,74,46,70),ink);
    px(g,36,102,37,42,'#344b58');px(g,39,103,11,41,'#48616a');px(g,51,100,3,44,'#263b49');
    for(let y=108;y<140;y+=9){px(g,39,y,11,1,'#647981');px(g,55,y,15,2,'#2b414e');}
    px(g,59,121,7,2,copper);px(g,64,120,2,4,lit);
    poly(g,archPoints(34,76,42,24),'#709396');
    for(const [xx,yy] of [[36,91],[41,83],[53,77],[66,84],[73,92]])line(g,54,99,xx,yy,'#465e67',2);
    px(g,34,99,42,3,deep);
    for(const x of [20,82]){
      px(g,x,86,9,57,'#526974');px(g,x,86,3,55,'#a4a395');
      for(const y of [82,95,116,138]){px(g,x-2,y,13,3,'#424f56');px(g,x-1,y,11,1,'#aaa58e');}
    }
    for(const [x,y,w] of [[16,76,11],[25,67,10],[35,60,9],[70,61,9],[81,68,10],[91,76,9]])
      px(g,x,y,w,2,'#a1a49b');
    poly(g,[[7,69],[43,42],[57,37],[73,42],[108,64],[108,68],[72,49],[54,46],[13,73]],'#6c625b');
    line(g,9,68,53,40,'#b59c7f');line(g,55,40,105,64,'#97836f');
    poly(g,[[42,50],[48,44],[62,44],[68,49],[66,59],[54,64],[43,59]],deep);
    crown(g,55,54,.75);
    px(g,10,143,100,4,deep);px(g,13,143,86,2,'#a7957b');
    // Overhead transfer pulley on a short cantilever. The live cable continues
    // up past the sprite and guides the eye to the climbing route.
    beam(g,83,80,83,37,4,'#6d645d','#ae9980');
    beam(g,82,40,102,34,3,'#4d5b60','#a8977e');
    beam(g,84,56,102,36,3,'#5c6263','#8f8575');
    gear(g,103,35,7,.25);px(g,103,41,2,88,'#b09976');
    px(g,99,115,9,15,deep);px(g,100,116,6,11,'#82918c');px(g,99,117,9,2,copper);
    return portal;
  }
  function entry(cam,x=6450){
    if(x<cam-72||x>cam+W+72)return;
    const y=rnd(groundAt(x)),left=x-55,roller=left+103,hubY=y-112,t=G.t;
    // Coordinates are already translated by the world renderer.
    px(ctx,roller,0,3,Math.max(0,hubY+1),'#4c5e65');px(ctx,roller+1,0,1,Math.max(0,hubY+1),'#b79f80');
    for(let yy=(41-Math.floor(t*.5)%41);yy<hubY;yy+=41){px(ctx,roller,yy,2,3,'#d3b691');}
    ctx.drawImage(entrySprite(),rnd(left),y-146);
    const pull=x+22;
    line(ctx,pull,y-64,pull+1,y-28,'#66594d',2);line(ctx,pull+1,y-63,pull+2,y-29,gold);
    px(ctx,pull-1,y-29,6,7,ink);px(ctx,pull,y-28,4,5,red);px(ctx,pull+1,y-27,1,3,lit);
  }
  return {render,roof,entry};
})();
