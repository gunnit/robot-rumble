'use strict';

// Paint the bosses into native-resolution part sprites. The enamel, chrome,
// fur and silk use separate light ramps. Only moving joints and clock hands
// are composed each frame, like the modular character rigs in Missions 1 and 5.
const CaveBossArt6 = (() => {
  const outline='#211a30', dark='#34263e', gold='#efba66', pearl='#ffedc5';
  const brass=['#624149','#8f554a','#bc8057','#e5aa67','#ffdb91'];
  const steel=['#263349','#354761','#52677b','#839aa2','#b6ced0','#e7f1e6'];
  const ruby=['#351f3b','#552645','#792d4d','#a84058','#d3616b'];
  const wine=['#32243d','#472b49','#67405e','#855574','#ab7690'];
  const fur=['#382d43','#52405a','#7b5364','#a4727b','#d09b9c'];
  const bone=['#897a8f','#b4a6ac','#d3c5c1','#f6dccb','#fff0d6'];
  const hex = new Map();
  function color(s) {
    if (!hex.has(s)) {
      const n=parseInt(s.slice(1),16);
      hex.set(s,((255<<24)|((n&255)<<16)|(n&65280)|(n>>16))>>>0);
    }
    return hex.get(s);
  }
  function part(left,top,width,height,paint) {
    const pixels=new Uint32Array(width*height);
    const put=(x,y,col)=>{
      const i=Math.round(x)-left,j=Math.round(y)-top;
      if(i>=0&&j>=0&&i<width&&j<height) pixels[j*width+i]=typeof col==='number'?col:color(col);
    };
    function line(x1,y1,x2,y2,col,size=1) {
      const n=Math.max(1,Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1))));
      for(let i=0;i<=n;i++)for(let k=0;k<size;k++)for(let h=0;h<size;h++)
        put(x1+(x2-x1)*i/n+k,y1+(y2-y1)*i/n+h,col);
    }
    function wire(points,col,size=1) {
      for(let i=1;i<points.length;i++)line(...points[i-1],...points[i],col,size);
    }
    function surface(ramp,x,y,l,t,w,h) {
      if(typeof ramp==='string')return ramp;
      const u=(x-l)/Math.max(1,w),v=(y-t)/Math.max(1,h);
      const light=.31+.48*(1-Math.abs(u-.32)*1.7)+.20*(1-v)-.14*v;
      return ramp[Math.max(0,Math.min(ramp.length-1,Math.floor(light*ramp.length)))];
    }
    function polygon(points,ramp,rim=outline) {
      const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
      const l=Math.min(...xs),r=Math.max(...xs),t=Math.min(...ys),b=Math.max(...ys);
      for(let y=Math.ceil(t);y<=b;y++){
        const joins=[];
        for(let i=0,j=points.length-1;i<points.length;j=i++) {
          const a=points[j],z=points[i];
          if((a[1]>y+.5)!==(z[1]>y+.5)) joins.push(a[0]+(z[0]-a[0])*(y+.5-a[1])/(z[1]-a[1]));
        }
        joins.sort((a,b)=>a-b);
        for(let k=0;k+1<joins.length;k+=2) for(let x=Math.ceil(joins[k]);x<joins[k+1];x++)put(x,y,surface(ramp,x,y,l,t,r-l,b-t));
      }
      if(rim)wire(points.concat([points[0]]),rim);
    }
    function oval(x,y,rx,ry,ramp,rim=outline) {
      for(let j=-Math.ceil(ry);j<=ry;j++)for(let i=-Math.ceil(rx);i<=rx;i++){
        const nx=i/rx,ny=j/ry,a=nx*nx+ny*ny;
        if(a>1.03)continue;
        let c=ramp;
        if(rim && ((Math.abs(i)+.8)**2/rx**2+(Math.abs(j)+.8)**2/ry**2>1.03))c=rim;
        else if(Array.isArray(ramp)){
          const luminance=.30+.50*Math.sqrt(Math.max(0,1-a))-.29*nx-.28*ny;
          c=ramp[Math.max(0,Math.min(ramp.length-1,Math.floor(luminance*ramp.length)))];
        }
        put(x+i,y+j,c);
      }
    }
    function rivet(x,y) {oval(x,y,2,2,brass);put(x,y-1,pearl);}
    paint({put,line,wire,polygon,oval,rivet});
    const make=flash=>{
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const g=canvas.getContext('2d'),data=g.createImageData(width,height),buffer=new Uint32Array(data.data.buffer);
      for(let i=0;i<pixels.length;i++)buffer[i]=flash&&pixels[i]&&pixels[i]!==color(outline)?color('#fff5d8'):pixels[i];
      g.putImageData(data,0,0);return canvas;
    };
    return {img:make(false),white:make(true),left,top};
  }
  function draw(p,x=0,y=0,flash=false) {ctx.drawImage(flash?p.white:p.img,Math.round(x+p.left),Math.round(y+p.top));}
  function pixelLine(x1,y1,x2,y2,col,width=1){
    ctx.fillStyle=col;
    const n=Math.max(1,Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1))));
    for(let i=0;i<=n;i++)ctx.fillRect(Math.round(x1+(x2-x1)*i/n),Math.round(y1+(y2-y1)*i/n),width,width);
  }
  const cache=new Map();
  function cached(key,fn) {if(!cache.has(key))cache.set(key,fn());return cache.get(key);}

  function mantle(p) {
    p.polygon([[-22,-70],[-30,-72],[-27,-57],[-35,-33],[-47,-7],[-36,-9],[-30,-4],[-20,-11],[-10,-2],[8,-8],[20,-3],[29,-10],[40,-4],[51,-10],[36,-39],[28,-56],[27,-72],[17,-68]],ruby);
    const pleats=[[-25,-34,-44],[-21,-24,-31],[-13,-17,-22],[11,18,22],[19,26,30],[23,33,45]];
    for(const [a,b,c] of pleats){
      p.polygon([[a,-64],[b,-31],[c,-8],[b,-12],[a,-35]],['#382238','#51213f','#803452','#aa4059'],null);
      p.wire([[a,-61],[b,-32],[c,-9]],'#ae5367');
    }
    p.wire([[-45,-8],[-36,-11],[-30,-6],[-20,-13],[-10,-5],[8,-11],[20,-6],[29,-13],[40,-7],[49,-11]],'#c08862');
    for(const s of [-1,1]){
      const x=s*32;
      p.wire([[x-3,-18],[x,-22],[x+3,-18],[x,-14],[x-3,-18]],'#cb9574');
      p.put(x,-18,pearl);p.put(s*27,-15,'#d49d78');p.put(s*37,-15,'#d49d78');
    }
  }
  function countBody(p) {
    // Pointed sabatons, interlocking greaves, hip gears and dished breastplate.
    for(const s of [-1,1]){
      const side=points=>points.map(([x,y])=>[x*s,y]);
      p.polygon(side([[8,-29],[16,-31],[20,-24],[18,-8],[13,-4],[7,-8],[8,-18]]),steel);
      p.oval(s*13,-22,6,5,brass);p.oval(s*13,-22,3,3,steel);
      p.polygon(side([[8,-20],[15,-16],[14,-8],[10,-5],[8,-9]]),steel);
      p.wire(side([[9,-18],[11,-14],[11,-9]]),'#c1c9c9');
      p.polygon(side([[7,-10],[11,-12],[18,-10],[21,-5],[26,-2],[25,0],[8,-1],[5,-4]]),brass);
      p.wire(side([[10,-7],[17,-7],[23,-2]]),'#e3be83');
    }
    p.polygon([[-21,-69],[-15,-75],[-5,-79],[9,-77],[19,-72],[25,-67],[18,-46],[13,-38],[9,-29],[-8,-28],[-15,-37],[-21,-50]],steel);
    for(const s of [-1,1]) {
      const side=points=>points.map(([x,y])=>[x*s,y]);
      p.polygon(side([[3,-74],[14,-74],[22,-67],[19,-59],[10,-63],[3,-69]]),steel);
      p.wire(side([[4,-72],[13,-71],[20,-66]]),'#e8ede4');
      p.wire(side([[4,-67],[12,-63],[18,-62]]),'#5c6c7f');
      for(let k=0;k<3;k++){
        const y=-48+k*4;p.polygon(side([[5,y],[15-k,y-1],[14-k,y+2],[7,y+4]]),brass);
      }
    }
    p.polygon([[-15,-39],[-4,-35],[10,-37],[15,-40],[13,-33],[6,-30],[-7,-30],[-13,-32]],brass);
    p.polygon([[-8,-32],[6,-33],[9,-28],[5,-23],[-4,-24],[-9,-27]],steel);
    p.polygon([[0,-32],[4,-29],[0,-26],[-3,-29]],'#eec37b');
    // Haute collar with ruby lining, two silver lapels, brass chain and studs.
    for(const s of [-1,1]){
      const side=points=>points.map(([x,y])=>[x*s,y]);
      p.polygon(side([[6,-75],[14,-83],[33,-94],[27,-80],[30,-76],[19,-66],[10,-67]]),ruby);
      p.wire(side([[31,-91],[17,-78],[9,-70]]),gold,2);
      p.polygon(side([[17,-75],[28,-70],[32,-63],[26,-57],[20,-58],[16,-64]]),brass);
      p.wire(side([[19,-70],[25,-70],[29,-65]]),pearl);
      p.rivet(s*25,-65);
    }
    p.oval(0,-58,14,14,brass);p.oval(0,-58,11,11,steel);p.oval(0,-58,9,9,['#29384d','#35465c','#465961','#547474']);
    for(let n=0;n<12;n++){
      const a=n*Math.PI/6;p.put(Math.cos(a)*8,-58+Math.sin(a)*8,n%3? '#a5b2a9':pearl);
    }
  }
  function countHead(p) {
    // An angular albino automaton face in a widow's peak helmet. The exposed
    // enamel cheeks frame a split black lower jaw and two ivory canine blades.
    p.polygon([[-14,-91],[-14,-99],[-10,-103],[-2,-106],[7,-104],[14,-99],[15,-90],[12,-82],[7,-76],[1,-74],[-7,-78],[-12,-84]],steel);
    p.polygon([[-14,-94],[-19,-98],[-17,-88],[-12,-84]],brass);
    p.polygon([[13,-94],[19,-99],[17,-89],[11,-84]],brass);
    p.polygon([[-13,-93],[-7,-97],[0,-93],[7,-96],[13,-93],[10,-85],[5,-79],[-2,-79],[-10,-84]],steel);
    p.polygon([[-12,-90],[-6,-91],[-2,-88],[-6,-86],[-11,-87]],'#281c33');
    p.polygon([[1,-88],[7,-92],[13,-91],[10,-87],[5,-86]],'#281c33');
    p.wire([[-10,-89],[-6,-88],[-4,-88]],'#ff5a69');p.put(-6,-89,'#fff2b3');
    p.wire([[3,-88],[8,-90],[10,-90]],'#ff5a69');p.put(8,-90,'#fff2b3');
    p.polygon([[-2,-92],[1,-93],[4,-85],[1,-83],[-3,-85]],brass);
    p.wire([[-7,-83],[-1,-81],[5,-82],[9,-84]],outline,2);
    for(const s of [-1,1]){
      p.polygon([[s*9,-85],[s*5,-82],[s*5,-74],[s*8,-77],[s*10,-82]],bone);
      p.line(s*8,-83,s*6,-77,'#fff5d9');
    }
    p.polygon([[-11,-96],[-11,-100],[-4,-104],[3,-103],[12,-99],[13,-95],[6,-95],[0,-90],[-4,-94]],['#29283d','#414357','#696579','#9b9297']);
    p.wire([[-9,-99],[-3,-101],[4,-100],[9,-97]],'#adabb4');
    // Three fluted brass spires, with a central garnet and a tiny clock key.
    p.polygon([[-15,-98],[-19,-111],[-10,-105],[-5,-107],[-2,-116],[2,-109],[7,-105],[16,-112],[14,-100],[7,-98],[-7,-98]],brass);
    p.wire([[-17,-108],[-12,-103],[-8,-102],[-3,-109],[-2,-112]],pearl);
    p.wire([[4,-107],[8,-102],[14,-108]],'#ffe6ad');
    p.oval(-2,-104,3,3,['#78293d','#ab3547','#e3626b','#ffadb0']);p.put(-3,-105,'#fff1d2');
    p.line(-12,-100,11,-100,'#7e514c');
  }
  function gauntlet(p) {
    p.polygon([[-7,0],[-2,-4],[5,-2],[8,5],[5,12],[-5,13],[-8,7]],steel);
    p.wire([[-5,1],[-2,-2],[3,-1]],'#e1decf');p.rivet(0,7);
    p.polygon([[-5,11],[4,12],[6,17],[3,24],[-4,27],[-8,22],[-7,18]],brass);
    p.wire([[-5,15],[1,14],[4,17]],pearl);
    for(let n=0;n<3;n++){
      const x=-6+n*4;p.polygon([[x,22],[x+2,22],[x+3,27],[x+1,32],[x-1,32],[x,28],[x-1,25]],steel);
      p.put(x,29,'#e3ddcf');
    }
  }
  function fracturedBezel(p) {
    // The last chime shears two enamel plates away and lights the exposed
    // winding train. The gold chain slips loose on the Count's near shoulder.
    p.polygon([[-15,-68],[-10,-68],[-9,-66],[-12,-64],[-9,-62],[-13,-61],[-12,-58],[-15,-58]],'#30283a');
    p.wire([[-14,-67],[-10,-67],[-13,-64],[-10,-62],[-13,-61]],'#f7bf8e');
    p.polygon([[9,-58],[15,-61],[16,-57],[13,-54],[15,-53],[11,-51],[11,-48],[6,-45],[5,-48],[8,-51]],'#382b3e');
    for(const [x,y] of [[11,-55],[8,-51]]){p.oval(x,y,2,2,brass);p.put(x,y,'#dc5470');}
    p.wire([[16,-68],[19,-65],[20,-61],[19,-57],[17,-55]],outline,2);
    p.wire([[16,-68],[19,-65],[20,-61],[19,-57],[17,-55]],gold);
    for(const [x,y] of [[17,-67],[20,-63],[20,-59],[18,-56]])p.put(x,y,pearl);
  }
  // Right wing in local shoulder coordinates. Mirroring puts the same
  // articulated spars on the far shoulder without pre-scaling silhouettes.
  function brassWing(p,f) {
    const u=f/6, elbow=[19,-17-u*5], wrist=[39,-23-u*19], tip=[59+u*6,-39-u*17];
    const scallops=[[53,-9+u*2],[47,-12],[41,-11],[35,3+u*2],[30,-2],[24,-2],[19,13],[15,7],[9,8],[2,21],[0,1]];
    p.polygon([[0,0],elbow,wrist,tip,...scallops],ruby);
    p.polygon([elbow,wrist,[41,-11],[35,3],[32,-6]],['#71324c','#8e3c53','#b34a59'],null);
    p.polygon([wrist,tip,[54,-7],[50,-14]],['#893a51','#b44958','#d06463'],null);
    for(const end of [[53,-8],[35,4],[19,13],[2,21]]){
      const start=end[0]>40?wrist:elbow;
      p.wire([start,[(start[0]+end[0])/2+2,(start[1]+end[1])/2-2],end],'#68374a',2);
      p.line(start[0],start[1],end[0],end[1]-2,'#c87770');
    }
    p.wire([[0,0],elbow,wrist,tip],outline,4);p.wire([[0,-1],elbow,wrist,tip],'#af805e',3);
    p.wire([[0,-1],elbow,wrist,tip],'#ead191');
    p.wire([elbow,[17,-30-u*7],[20,-27-u*7]],gold,2);
    for(const at of [[1,0],elbow,wrist]){p.oval(at[0],at[1],4,4,brass);p.oval(at[0],at[1],2,2,steel);p.put(at[0]-1,at[1]-1,pearl);}
    for(let j=0;j<5;j++)p.put(6+j*2,-3-j*2,'#b1c4bf');
  }
  function count(e) {
    const t=e.t||0, broken=e.state==='dying', chime=e.state==='chimeWind' || e.state==='chimeStrike';
    const flight=e.state==='flight'||e.state==='intro', f=flight?Math.round(3+3*Math.sin(t*.15)):chime?6:Math.round(2+2*Math.sin(t*.07));
    const flash=e.hitT>0;
    ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y));ctx.scale(e.facing||1,1);
    const sink=broken?clamp((120-e.timer)*.13,0,16):0;
    ctx.translate(0,Math.round(sink));
    const wing=cached('cw'+f,()=>part(-5,-60,80,88,p=>brassWing(p,f)));
    draw(cached('mantle',()=>part(-54,-76,111,78,mantle)),0,Math.round(Math.sin(t*.07)*2),flash);
    for(const s of [-1,1]){
      ctx.save();ctx.scale(s,1);ctx.translate(18,-63+Math.round(Math.sin(t*.1)*2)+(broken?10:0));
      if(e.chimeUsed&&s===1&&!chime)ctx.rotate(.19+Math.sin(t*.095)*.035);
      draw(wing,0,0,flash);ctx.restore();
    }
    const body=cached('cbody',()=>part(-36,-99,74,102,countBody));
    const head=cached('chead',()=>part(-23,-119,47,52,countHead));
    const hand=cached('hand',()=>part(-11,-6,23,41,gauntlet));
    const lift=flight?Math.round(Math.sin(t*.12)*2):0;
    draw(body,0,lift,flash);draw(head,0,lift+(broken?4:0),flash);
    if(e.chimeUsed)draw(cached('fracture',()=>part(-18,-71,42,30,fracturedBezel)),0,lift,flash);
    const pulse=Math.sin(t*(e.enraged?.15:.075)), col=chime?'#fff0b2':e.enraged?'#ff8f90':'#9dfaec';
    const a=t*(chime?.15:e.enraged?.064:.034);
    pixelLine(0,-58+lift,Math.cos(a)*7,-58+lift+Math.sin(a)*7,col);
    pixelLine(0,-58+lift,Math.cos(a*.18-1.2)*5,-58+lift+Math.sin(a*.18-1.2)*5,pearl,2);
    ctx.fillStyle=pulse>.1?col:'#c79670';ctx.fillRect(-2,-60+lift,4,4);
    for(const s of [-1,1]){
      ctx.save();ctx.translate(s*25,-58+lift);ctx.scale(s,1);
      ctx.rotate(chime?-.9+(e.state==='chimeStrike'?.45:0):e.state==='warn'&&s===1?-.52:Math.sin(t*.08+s)*.09);
      draw(hand,0,0,flash);ctx.restore();
    }
    ctx.restore();
  }
  function batWing(p,f) {
    const up=f/7, elbow=[19,-6-15*up], wrist=[39,-6-29*up], tip=[61+7*up,3-48*up];
    const h=15-17*up;
    const outer=[tip,[54,h+3],[49,h+1],[44,h+1],[39,h+5],[36,h+12],[30,h+5],[25,h+3],[21,h+5],[16,h+14],[11,h+7],[5,h+6],[-1,h+12]];
    p.polygon([[0,0],elbow,wrist,...outer],wine);
    p.polygon([wrist,tip,[54,h+3],[49,h+1]],['#51334e','#6b425e','#98617a','#c38a96'],null);
    p.polygon([elbow,wrist,[49,h+1],[44,h+1],[39,h+5],[36,h+12],[30,h+5]],['#5a344b','#80465f','#a65f75','#c88794'],null);
    for (const end of [[54,h+3],[36,h+12],[16,h+14],[-1,h+12]]) {
      const start=end[0]>36?wrist:elbow;
      p.wire([start,[(start[0]+end[0])/2+1,(start[1]+end[1])/2-3],end],'#452d48',2);
      p.line(start[0]+1,start[1],end[0]+1,end[1]-2,'#ca8594');
    }
    for(let k=1;k<5;k++){
      const v=k/6;
      const x=elbow[0]+(36-elbow[0])*v,y=elbow[1]+(h+12-elbow[1])*v;
      p.wire([[x,y],[x+4,y+1],[x+8,y+1-k*.5]],'#915d78');
    }
    p.wire([[0,0],elbow,wrist,tip],'#31253e',3);
    p.wire([[0,-1],elbow,wrist,tip],'#a67786',2);
    p.wire([elbow,wrist,tip],'#d9adab');
    p.polygon([elbow,[elbow[0]-1,elbow[1]-9],[elbow[0]+2,elbow[1]-12],[elbow[0]+3,elbow[1]-7],[elbow[0]+3,elbow[1]+1]],bone);
  }
  function matriarchBody(p) {
    p.polygon([[-15,-30],[-18,-27],[-18,-18],[-12,-15],[-14,-12],[-7,-7],[-4,-2],[0,1],[4,-3],[9,-6],[14,-13],[12,-16],[17,-21],[16,-29],[11,-32]],fur);
    for(const s of [-1,1]){
      const side=points=>points.map(([x,y])=>[x*s,y]);
      p.polygon(side([[4,-19],[11,-21],[14,-19],[10,-14],[12,-14],[7,-9],[4,-8]]),['#684455','#916579','#b77e88'],null);
      p.wire(side([[6,-5],[8,-2],[11,-4]]),'#caa9a4');
      p.wire(side([[8,-3],[11,0],[14,-3]]),'#d5b5a9');
    }
    p.polygon([[-16,-28],[-20,-30],[-16,-34],[-15,-44],[-19,-56],[-12,-52],[-7,-42],[-3,-43],[3,-42],[7,-43],[13,-51],[18,-55],[15,-43],[14,-37],[18,-32],[16,-26],[11,-24],[7,-18],[0,-16],[-6,-19],[-11,-23]],fur);
    for(const s of [-1,1]){
      const side=points=>points.map(([x,y])=>[x*s,y]);
      p.polygon(side([[10,-42],[15,-51],[13,-40],[12,-35],[8,-36]]),['#59324b','#94546b','#cf8292']);
      p.polygon(side([[4,-32],[11,-36],[14,-34],[12,-29],[8,-27],[4,-28]]),'#34243c');
      p.oval(s*9,-31,3,3,['#b66447','#e5aa62','#ffe5a2']);p.put(s*9,-31,outline);p.put(s*9-1,-32,'#fff1d5');
      p.wire(side([[4,-33],[9,-37],[14,-36]]),'#e1c7b6');
      p.polygon(side([[7,-25],[10,-26],[9,-19],[7,-18]]),bone);
      p.wire(side([[11,-28],[15,-27],[13,-24]]),'#c69c9d');
    }
    p.oval(0,-27,5,4,['#8f626e','#b16b79','#de98a0']);p.put(-2,-27,outline);p.put(2,-27,outline);
    p.wire([[-5,-24],[-2,-22],[3,-22],[6,-24]],outline);
    p.polygon([[-9,-39],[-11,-48],[-5,-44],[-1,-53],[2,-46],[9,-49],[7,-40]],brass);
    p.wire([[-9,-46],[-6,-43],[-1,-49],[2,-45],[7,-47]],pearl);
    p.oval(-1,-42,2,2,['#367d82','#80d6cd','#d1f6df']);
    p.polygon([[-7,-15],[0,-11],[7,-15],[4,-10],[1,-8],[-3,-9]],brass);
    p.oval(0,-10,3,4,['#3c8887','#80c7b0','#dbf1c3']);
  }
  function matriarch(e){
    const t=e.t||0, down=e.state==='rest', swoop=e.state==='swoop';
    const f=swoop?2:Math.round((1+Math.sin(t*(down?.08:.16)))*3.5);
    ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y));ctx.scale(e.facing||1,1);
    const w=cached('mw'+f,()=>part(-4,-50,78,86,p=>batWing(p,f)));
    for(const s of [-1,1]){ctx.save();ctx.scale(s,1);draw(w,11,-25,!!e.hitT);ctx.restore();}
    draw(cached('mbody',()=>part(-23,-59,47,64,matriarchBody)),0,0,!!e.hitT);
    ctx.restore();
  }
  return {count,matriarch};
})();

{
  const pale='#ffe9c3', amber='#efb662', jade='#90edc9', rose='#ee9eb9', ink='#292336';
  const queenName='ROOST MATRIARCH';
  function note(type,frequency,seconds,volume,delay=0) { Snd.tone(type,frequency,frequency*.985,seconds,volume,delay); }
  function dotted(x,y,tx,ty,color) {
    const d=Math.hypot(tx-x,ty-y);
    for(let i=7;i<d;i+=9) R(Math.round(x+(tx-x)*i/d),Math.round(y+(ty-y)*i/d),2,2,color);
  }
  function actionLabel(s,x,y,col) {
    const half=s.length*3+4;
    x=clamp(x,G.cam.x+half+3,G.cam.x+W-half-3);
    y=clamp(y,58,200);
    RO(Math.round(x-half),Math.round(y-2),2*half,11,ink);
    text(s,Math.round(x),Math.round(y),col,1,'center',null);
  }
  function sparkleLine(x,y,radius,t,color) {
    for(let n=0;n<12;n++){
      const a=n*Math.PI/6+t*.025;
      const px=Math.round(x+Math.cos(a)*radius),py=Math.round(y+Math.sin(a)*radius);
      R(px,py,n%3===0?3:2,1,color);
      if(n%3===0)R(px+1,py-1,1,3,color);
    }
  }
  function queenPerch(e) {
    e.state='rest'; e.timer=e.turn===0?90:118; e.y=groundAt(e.x)-3;
  }
  function echoShot(e,offset) {
    const x=e.x+e.facing*10,y=e.y-26;
    const angle=Math.atan2(e.aimY-y,e.aimX-x)+offset;
    G.eb.push({k:'matriarchEcho',owner:e,x,y,vx:Math.cos(angle)*1.72,vy:Math.sin(angle)*1.72,age:0,life:210,r:5});
    note('sine',660,.16,.09);note('sine',990,.22,.04,.07);
  }
  EB_TYPES.matriarchEcho={
    r:5,shootable:true,
    update(b){b.age++;},
    draw(b){
      const x=Math.round(b.x),y=Math.round(b.y),r=6+Math.round(Math.sin(b.age*.22));
      for(const [radius,col] of [[r+2,'#833d64'],[r,rose],[r-3,'#ffe0d4']]){
        for(let j=0;j<16;j++){
          const a=Math.PI*j/8;R(x+Math.round(Math.cos(a)*radius),y+Math.round(Math.sin(a)*radius),2,1,col);
        }
      }
    },onHit(b){sparks(b.x,b.y,5,rose);}
  };
  function makeAccompanist(e) {
    if(G.enemies.some(b=>!b.dead && b.matriarch===e))return;
    const x=G.cam.x+(e.side===1?34:W-34),bat=makeEnemy({t:'caveBat',x,y:135},e.lock);
    bat.active=true;bat.matriarch=e;bat.side=-e.side;bat.timer=82;
    G.enemies.push(bat); sparks(x,133,6,rose);
  }
  const queen={
    hp:64,boss:true,bossName:queenName,flying:true,edge:26,
    contact:e=>e.state==='swoop'?'hurt':'none',
    box:e=>({x:e.x-18,y:e.y-46,w:36,h:46}),
    make(e){
      e.side=1;e.x=G.cam.x+W-79;e.y=105;e.state='intro';e.timer=64;e.turn=0;e.inv=true;
    },
    update(e){
      if(e.state==='dying'){
        const age=58-e.timer;
        e.y-=.8; e.x+=e.facing*.26;
        if(age%9===0)sparks(e.x,e.y-16,5,rose);
        if(--e.timer<=0){
          e.dead=true;
          dropItem('heart',clamp(G.p.x+G.p.facing*12,G.cam.x+15,G.cam.x+W-15),groundAt(G.p.x)-19,0);
        }
        return;
      }
      if(e.state==='intro'){
        const f=(64- --e.timer)/64;
        e.y=105+(groundAt(e.x)-108)*(1-(1-f)*(1-f));
        if(!e.timer){e.inv=false;queenPerch(e);note('triangle',392,.18,.1);note('sine',587,.26,.08,.1);}
        return;
      }
      if(e.state==='rest'){
        e.facing=G.p.x<e.x?-1:1;
        e.y=groundAt(e.x)-3+Math.sin(e.t*.055)*1.4;
        if(G.p.dead || --e.timer>0)return;
        e.startX=e.x;e.startY=e.y;
        if(e.turn++%2===0){
          e.state='swoopWind';e.timer=65;
          e.endX=G.cam.x+(e.side===1?76:W-76);e.facing=Math.sign(e.endX-e.x);
          Snd.noise(.24,.07,1750);
        } else {
          e.state='echoWind';e.timer=67;
          e.aimX=G.p.x;e.aimY=G.p.y-(G.p.crouch?14:18);
          note('sine',349,.26,.095);note('sine',523,.23,.06,.12);
        }
        return;
      }
      if(e.state==='swoopWind'){
        const f=(65- --e.timer)/65;e.y=e.startY+(groundAt(e.x)-27-e.startY)*f;
        if(!e.timer){e.state='swoop';e.timer=87;Snd.noise(.32,.09,1900);}
      }else if(e.state==='swoop'){
        const f=(87- --e.timer)/87;
        e.x=e.startX+(e.endX-e.startX)*(f*f*(3-2*f));
        e.y=groundAt(e.x)-27-Math.sin(f*Math.PI)*2;
        if(e.timer%7===0)sparks(e.x-e.facing*12,e.y-3,2,'#9b7894');
        if(!e.timer){e.side=-e.side;queenPerch(e);}
      }else if(e.state==='echoWind'){
        const f=(67- --e.timer)/67;e.y=e.startY-44*f;
        if(!e.timer){
          e.state='echo';e.timer=63;
          // The reticle locks at the start of the wind-up. When her crown
          // starts to fail, one attendant answers the call from the far bank.
          echoShot(e,0);if(e.hp<=e.max*.65||e.turn>=4)makeAccompanist(e);
        }
      }else if(e.state==='echo'){
        if(--e.timer===43)echoShot(e,-.15);
        if(e.timer===24)echoShot(e,.15);
        if(e.timer<18)e.y+=(groundAt(e.x)-3-e.y)*.19;
        if(!e.timer)queenPerch(e);
      }
    },
    draw(e){
      if(e.state==='swoopWind'){
        const y=Math.round(groundAt(e.x)-27);
        // The lowest tooth is above a crouched hero's head. This line names
        // the safe posture before the actual cross-screen movement begins.
        dotted(e.x,y,e.endX,y,rose);
        actionLabel('DUCK LOW',G.p.x,groundAt(G.p.x)-52,rose);
      }
      if(e.state==='echoWind'){
        sparkleLine(e.x,e.y-26,15+Math.sin(e.t*.13)*3,e.t,rose);
        dotted(e.x,e.y-26,e.aimX,e.aimY,'#bd879d');
        sparkleLine(e.aimX,e.aimY,8,e.t,rose);
        actionLabel('ECHO CALL',e.x,e.y-65,rose);
      }
      CaveBossArt6.matriarch(e);
    },
    onKill(e,cx,cy){
      e.state='dying';e.timer=58;e.inv=true;
      G.eb=G.eb.filter(b=>b.owner!==e);
      for(const bat of G.enemies)if(bat.matriarch===e){sparks(bat.x,bat.y-10,4,rose);bat.dead=true;}
      addScore(1850,cx,cy);sparks(cx,cy,16,rose);note('sine',523,.26,.1);note('sine',784,.30,.08,.14);
      return 'dying';
    }
  };
  ENEMY_TYPES.roostMatriarch=queen;

  const count=ENEMY_TYPES.countClockfang, normalUpdate=count.update;
  const opening=95, blastLength=17, recovery=96, gapHalf=37;
  function beginChime(e){
    e.state='chimeWind';e.timer=opening;e.inv=true;e.chimeUsed=true;
    e.y=groundAt(e.x);e.facing=G.p.x<e.x?-1:1;
    const center=G.cam.x+W/2, step=G.p.x<center?1:-1;
    e.gap=clamp(G.p.x+step*94,G.cam.x+gapHalf+18,G.cam.x+W-gapHalf-18);
    // Retire the previous attack when the belfry's lights change. The
    // warning gives 95 frames to move at most 57px to a safe edge.
    G.eb=G.eb.filter(b=>b.k!=='clockfangGear'&&b.k!=='clockfangSpark');
    note('sine',196,.62,.12);note('triangle',392,.30,.07,.05);
  }
  count.hp=118;
  count.box=e=>({x:e.x-24,y:e.y-101,w:48,h:101});
  count.update=function(e){
    if(!e.chimeUsed && !e.dying && !e.inv && e.enraged && e.hp<=e.max/3 && !G.p.dead &&
       (e.state==='rest'||e.state==='warn'||e.state==='secondGear')){
      beginChime(e);
      return;
    }
    if(e.state==='chimeWind'){
      if(--e.timer===52){note('sine',294,.32,.12);note('triangle',587,.2,.06);}
      if(e.timer===22){note('sine',392,.30,.11);note('triangle',784,.16,.07);}
      if(!e.timer){e.state='chimeStrike';e.timer=blastLength;note('sine',523,.60,.14);note('triangle',1047,.30,.055);}
      return;
    }
    if(e.state==='chimeStrike'){
      if(--e.timer===6){
        const p=G.p,box=pbox(p);
        if(!p.dead&&(box.x+box.w<=e.gap-gapHalf||box.x>=e.gap+gapHalf))hurtPlayer();
        G.shake=Math.max(G.shake,3);
        for(const edge of [-1,1])sparks(e.gap+edge*gapHalf,groundAt(e.gap)-1,9,amber);
      }
      if(!e.timer){e.state='chimeOpen';e.timer=recovery;e.inv=false;}
      return;
    }
    if(e.state==='chimeOpen'){
      if(--e.timer<=0){e.state='rest';e.timer=30;}
      return;
    }
    normalUpdate(e);
  };
  function drawChime(e) {
    const x=G.cam.x,gapLeft=e.gap-gapHalf,gapRight=e.gap+gapHalf;
    const gy=groundAt(e.gap),strike=e.state==='chimeStrike',q=strike?(blastLength-e.timer)/blastLength:(opening-e.timer)/opening;
    ctx.save();
    for(const [from,to] of [[x-4,gapLeft],[gapRight,x+W+4]]){
      const w=to-from;
      ctx.fillStyle=strike?'rgba(255,181,94,.28)':'rgba(156,71,78,.10)';
      ctx.fillRect(from,56,w,gy-55);
      R(from,gy-2,w,2,strike?'#ffde97':'#ba8277');
      for(let j=from+4;j<to-3;j+=13){R(j,gy-6,2,3,'#c18e78');R(j+2,gy-7,2,2,'#c18e78');}
      if(strike){
        const y=59+Math.min(1,q*1.65)*(gy-59);
        R(from,y-4,w,4,'#f0af72');R(from,y-1,w,1,'#fff0bd');
        for(let j=from+7;j<to-5;j+=19)R(j,Math.max(57,y-20),1,Math.min(y-56,20),'#f0c493');
      } else {
        for(let j=from+4;j<to-3;j+=15)R(j,65+Math.round((1-q)*12),5,2,'#bbac96');
      }
    }
    // Safe passage remains visible during both telegraph and strike. The
    // floor brackets remain readable for players who cannot use colour.
    R(gapLeft,gy-3,gapHalf*2,3,jade);R(gapLeft,gy-11,2,9,jade);R(gapRight-2,gy-11,2,9,jade);
    for(const side of [-1,1])for(let i=0;i<4;i++){
      const bx=e.gap+side*(20-i);
      R(bx,gy-12+i,2,1,pale);R(bx,gy-4-i,2,1,pale);
    }
    actionLabel('SAFE GAP',e.gap,gy-63,jade);
    if(!strike)actionLabel('LAST CHIME',e.x,Math.max(62,e.y-125),pale);
    ctx.restore();
  }
  count.draw=function(e){
    if(e.state==='chimeWind'||e.state==='chimeStrike')drawChime(e);
    else if(e.state==='chimeOpen')actionLabel('CORE OPEN',e.x,e.y-124,jade);
    else if(this.tells)this.tells(e);
    CaveBossArt6.count(e);
    if(e.state==='chimeWind'){
      sparkleLine(e.x,e.y-58,19+Math.sin(e.t*.07)*3,e.t,amber);
    } else if(e.state==='chimeOpen'){
      sparkleLine(e.x,e.y-58,17,e.t,jade);
    }
  };
}
