'use strict';

// Mirror Lake uses the level's real bank and bed contours. The submerged path
// is always open; ringing the sun prism brings the old crystal crossing up.
const CaveLake6 = (() => {
  const waterY=218;
  const pools=[
    {left:5450,right:5690,current:.16},
    {left:5830,right:6100,current:-.19},
    {left:6220,right:6340,current:.11}
  ];
  const steps=[
    {x:5840,w:34,top:208}, {x:5883,w:35,top:198}, {x:5927,w:35,top:190},
    {x:5971,w:35,top:190}, {x:6015,w:35,top:198}, {x:6059,w:34,top:208}
  ];
  const dark='#243849', deep='#174452', teal='#438a96', mint='#8ce0d8', silver='#c9e8e8';
  const bronze='#a97759', gold='#ffdb91', cut='#425663', stone='#738489';
  let identity=null, powered=false, rise=0, bridge=[], previousPool=null, kick=0, ripples=[];
  let reflected=null;

  function poolAt(x) {return pools.find(pool=>x>=pool.left && x<=pool.right);}
  function immersed(p) {
    return p && !p.ride && !p.dead && !G.intro && p.y>waterY-1 && groundAt(p.x)>waterY+2 && poolAt(p.x);
  }
  function wave(x,size=1) {
    ripples.push({x,t:0,size});
    if(ripples.length>18)ripples.shift();
  }
  function poly(points,col) {
    ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
    ctx.closePath();ctx.fill();
  }
  function spoke(x,y,angle,from,to,color,width) {
    for(let r=from;r<=to;r++) R(x+Math.round(Math.cos(angle)*r),y+Math.round(Math.sin(angle)*r),width,width,color);
  }
  function waterwheel(x,cam) {
    if(x<cam-48 || x>cam+W+48)return;
    const y=waterY-28,r=30, angle=G.t*(powered?.033:.004);
    RO(x-18,y-31,4,75,dark); R(x-17,y-28,1,68,stone);
    RO(x+16,y-31,4,75,dark); R(x+17,y-30,1,72,stone);
    RO(x-20,y-33,42,6,cut); R(x-20,y-32,42,2,'#a9987a');
    for(let spokeIndex=0;spokeIndex<10;spokeIndex++) {
      const a=angle+spokeIndex*Math.PI/5;
      spoke(x,y,a,4,r,bronze,2);
      const c=Math.cos(a), s=Math.sin(a), px=x+c*r,py=y+s*r;
      poly([[px-6*s,py+6*c],[px+6*s,py-6*c],[px+6*s+4*c,py-6*c+4*s],[px-6*s+4*c,py+6*c+4*s]],cut);
      R(Math.round(px),Math.round(py),3,2,powered?mint:'#84999a');
    }
    for(let i=0;i<112;i++){
      const a=i*Math.PI*2/112;R(x+Math.round(Math.cos(a)*23),y+Math.round(Math.sin(a)*23),2,2,'#625657');
    }
    RO(x-6,y-6,12,12,bronze); RO(x-3,y-3,6,6,powered?mint:stone);
    R(x-1,y-2,2,2,silver);
  }
  function marker(x,cam) {
    if(x<cam-18 || x>cam+W+18)return;
    const gy=Math.round(groundAt(x));
    RO(x-3,gy-13,6,13,cut); R(x-2,gy-12,1,10,teal);
    poly([[x-5,gy-15],[x,gy-24],[x+5,gy-15],[x,gy-9]],powered?mint:teal);
    R(x-1,gy-20,2,6,powered?silver:mint);
  }
  function drawBehind(cam) {
    if(cam+W<5420 || cam>6370)return;
    for(const pool of pools){
      const l=Math.max(cam-5,pool.left),r=Math.min(cam+W+5,pool.right);
      if(l>=r)continue;
      R(l,waterY,r-l,41,deep); R(l,waterY+1,r-l,4,'#3e7e89');
      for(let band=0;band<4;band++)R(l,waterY+5+band*7,r-l,2,band%2?'#285965':'#306977');
      for(let x=Math.floor(l/27)*27;x<r;x+=27){
        const yy=waterY+9+Math.round(hsh(x)*16);
        const off=Math.round(Math.sin(G.t*.023+x)*3);
        R(x+off,yy,5+Math.round(hsh(x+1)*8),1,'#659c9b');
      }
    }
    waterwheel(5742,cam);
    for(const x of [5452,5687,5831,6098,6222,6338])marker(x,cam);
    if(powered && rise<158){
      const head=5785+Math.min(308,rise*3.6);
      for(let x=Math.max(5787,Math.floor(cam/8)*8);x<Math.min(head,cam+W);x+=8) {
        const y=180+Math.round(11*Math.sin((x-5785)*.01)+2*Math.sin(x*.3-G.t*.17));
        R(x,y,4,1,mint); if((x&8)===0)R(x+1,y+1,3,1,teal);
      }
    }
  }
  function waterClip(pool,cam,l,r) {
    ctx.beginPath();ctx.moveTo(l-cam,waterY);ctx.lineTo(r-cam,waterY);
    for(let x=r;x>l;x-=5)ctx.lineTo(x-cam,Math.max(waterY,Math.round(groundAt(x))));
    ctx.lineTo(l-cam,Math.max(waterY,Math.round(groundAt(l))));ctx.closePath();ctx.clip();
  }
  function drawFront(cam) {
    if(cam+W<5450 || cam>6340)return;
    // A reusable strip mirrors the actual cave, sprites and bright spell effects.
    if(!reflected) {reflected=document.createElement('canvas');reflected.width=W;reflected.height=32;}
    const mirror=reflected.getContext('2d');
    mirror.clearRect(0,0,W,32); mirror.drawImage(cvs,0,waterY-32,W,32,0,0,W,32);
    for(const pool of pools){
      const l=Math.max(cam,pool.left),r=Math.min(cam+W,pool.right);
      if(r-l<2)continue;
      ctx.save();waterClip(pool,cam,l,r);
      ctx.fillStyle='rgba(28,103,126,.20)';ctx.fillRect(l-cam,waterY,r-l,36);
      ctx.globalAlpha=.30;ctx.imageSmoothingEnabled=false;
      for(let y=0;y<32;y+=2){
        const d=Math.round(Math.sin(G.t*.06+y*.45)*Math.min(2,.4+y/12));
        ctx.drawImage(reflected,0,30-y,W,2,d,waterY+y,W,2);
      }
      ctx.globalAlpha=1;
      R(l-cam,waterY,r-l,1,'#89c9c7');
      for(let x=Math.floor(l/24)*24;x<r;x+=24){
        const shift=Math.round(Math.sin(G.t*.018+x*.013)*3);
        R(x-cam+shift,waterY+2,5,1,powered?mint:'#579ba5');
      }
      for(const rip of ripples){
        if(rip.x<pool.left || rip.x>pool.right)continue;
        const spread=Math.round(rip.t*.62*rip.size),cx=Math.round(rip.x-cam);
        ctx.globalAlpha=1-rip.t/32;
        R(cx-spread,waterY+2,5,1,silver);R(cx+spread-4,waterY+2,5,1,silver);
      }
      ctx.restore();
    }
  }
  function drawPlat(pl) {
    if(!pl.caveMirrorStep)return false;
    const x=pl.x,y=Math.round(pl.y),w=pl.w;
    if(y>241 || x<G.cam.x-50 || x>G.cam.x+W+10)return true;
    const mid=x+w/2;
    poly([[x,y],[x+w,y],[x+w-3,y+8],[mid+4,y+17],[mid-2,y+25],[x+4,y+11]],'#254f63');
    poly([[x+2,y+2],[mid-3,y+2],[mid+2,y+21],[x+4,y+10]],teal);
    poly([[mid-3,y+2],[x+w-2,y+2],[mid+5,y+11],[mid+2,y+21]],'#639eac');
    R(x,y,w,2,silver);R(x+3,y+2,w-6,2,mint);R(mid-2,y+6,3,2,'#b7efe0');
    return true;
  }
  PROP_TYPES.caveLakeMirror={
    make(o){o.y=groundAt(o.x);},
    box:o=>powered?null:{x:o.x-14,y:o.y-64,w:29,h:57},
    hit(o,d,source){
      if(powered || (source!=='player' && source!=='bullet' && source!=='barrel'))return;
      powered=true;rise=0;
      sparks(o.x,o.y-44,16,mint);addScore(250,o.x,o.y-65);G.shake=Math.max(2,G.shake);
      G.texts.push({x:o.x+38,y:o.y-48,s:'CRYSTAL CROSSING!',c:mint,t:85});
      for(const [i,hz] of [392,494,587,784].entries())Snd.tone('sine',hz,hz,.29,.08,i*.095);
    },
    draw(o){
      if(o.x<G.cam.x-55 || o.x>G.cam.x+W+55)return;
      const x=Math.round(o.x),y=Math.round(o.y);
      RO(x-15,y-6,30,6,cut);R(x-14,y-6,28,2,stone);
      poly([[x-9,y-7],[x-5,y-22],[x+5,y-22],[x+9,y-7]],bronze);
      R(x-3,y-19,6,10,'#5c5558');
      poly([[x,y-65],[x+14,y-45],[x+10,y-24],[x,y-17],[x-11,y-25],[x-14,y-45]], dark);
      poly([[x,y-61],[x+11,y-44],[x+8,y-28],[x,y-21],[x-8,y-28],[x-11,y-44]], powered?mint:'#7e91aa');
      poly([[x,y-61],[x,y-22],[x-8,y-28],[x-10,y-45]],powered?'#4b9fa5':'#53697e');
      poly([[x,y-59],[x+8,y-46],[x+2,y-43]],powered?'#f4ffe3':'#dde0f3');
      for(const side of [-1,1]){
        RO(x+side*13-2,y-44,4,18,bronze);
        R(x+side*15-1,y-45,3,4,gold);R(x+side*8-1,y-24,3,5,gold);
      }
      if(!powered && !G.intro && Math.abs(G.p.x-x)<155)
        text('SHOOT THE PRISM',x,y-76,gold,1,'center');
    }
  };

  function load(cp) {
    if(identity!==G.freed){identity=G.freed;powered=false;}
    for(let i=LV.plats.length-1;i>=0;i--)if(LV.plats[i].caveMirrorStep)LV.plats.splice(i,1);
    rise=powered?160:0;previousPool=null;kick=0;ripples=[];bridge=[];
    if(cp>6120)return;
    bridge=steps.map(s=>({...s,y:powered?s.top:252,caveMirrorStep:true,t:'mirrorCrystal'}));
    LV.plats.push(...bridge);
  }
  function beforePlayerUpdate() {
    const p=G.p, pool=immersed(p);
    if(!pool || G.winT)return;
    const depth=clamp((p.y-waterY)/13,.15,1);
    const walk=(ctl('right')?1:0)-(ctl('left')?1:0);
    p.x=clamp(p.x+(pool.current-walk*(ctl('down')?.18:.43))*depth,G.cam.x+8,G.cam.x+W-8);
    if(ctlTap('jump') && kick<=0){
      // The lake gives a single strong kick from the bed or the descending shallows.
      p.onGround=false;p.onPlat=null;p.vy=-5.95;kick=26;wave(p.x,1.6);
      Snd.jump();Snd.tone('sine',355,680,.11,.035);
    } else if(!p.onGround && p.vy>0) p.vy=Math.min(1.7,p.vy*.86);
  }
  function update() {
    if(kick>0)kick--;
    const pool=immersed(G.p);
    if(pool && (!previousPool || (G.t%18===0 && Math.abs(G.p.vx)>.35)))wave(G.p.x,previousPool?.75:1.4);
    previousPool=pool;
    for(const rip of ripples)rip.t++;
    ripples=ripples.filter(rip=>rip.t<32);
    if(!powered || rise>=160)return;
    rise++;
    bridge.forEach((pl,i)=>{
      const old=pl.y, t=clamp((rise-i*12)/55,0,1), easing=t*t*(3-2*t);
      pl.y=Math.round(252+(pl.top-252)*easing);
      if(G.p.onPlat===pl && G.p.onGround)G.p.y+=pl.y-old;
      else if(!G.p.dead && G.p.onGround && !G.p.ride && pl.y<old && old>=G.p.y && pl.y<=G.p.y &&
          G.p.x>pl.x && G.p.x<pl.x+pl.w) {
        G.p.onPlat=pl; G.p.y=pl.y; G.p.vy=0;
      }
      if(old>waterY && pl.y<=waterY){
        wave(pl.x+pl.w/2,1.5);
        if(visibleStep(pl)){sparks(pl.x+pl.w/2,waterY,4,mint);Snd.tone('triangle',[392,440,494,587,659,784][i],784,.12,.025);}
      }
    });
  }
  function visibleStep(pl){return pl.x+pl.w>G.cam.x && pl.x<G.cam.x+W;}
  return {load,beforePlayerUpdate,update,drawBehind,drawFront,drawPlat};
})();
