'use strict';

// The court and entrance use their actual world painters. The actors in the
// cutaway are drawings only; the hero and all combat state stay at mission start.
const CaveIntro6 = (() => {
  const cut = 94, landing = 149, finishAt = 226;
  const gold = '#f8d5a1', moon = '#b6dcdf', night = '#101222';
  let frame = 0, canSkip = false;

  function ease(v) {
    v = clamp(v, 0, 1);
    return v*v*(3-2*v);
  }
  function lantern(x, y) {
    x = Math.round(x); y = Math.round(y);
    const light = ctx.createRadialGradient(x, y + 4, 0, x, y + 4, 18);
    light.addColorStop(0, 'rgba(255,197,96,.45)');
    light.addColorStop(1, 'rgba(255,197,96,0)');
    ctx.fillStyle = light; ctx.fillRect(x-18,y-14,36,36);
    RO(x-2,y-4,4,4,'#a5795f'); R(x-1,y-3,2,2,night);
    RO(x-4,y,8,2,'#c4976b'); RO(x-3,y+3,6,6,'#edaf66');
    R(x-2,y+3,3,4,'#ffeeaa'); R(x-4,y+9,8,2,'#8e6856');
  }
  function court() {
    const cam = LV.locks[LV.locks.length-1].at;
    CaveScenery6.drawBG(cam);
    ctx.save(); ctx.translate(-cam,0); CaveScenery6.drawGround(cam); ctx.restore();
    const phase = ease((frame-14)/88), cageX = Math.round(130 + 12*Math.sin(phase*3)), base = Math.round(214-73*phase);
    // A hanging cage swings toward the vault while a robot bat carries its lantern away.
    for (let y=22; y<base-37; y+=7) {
      RO(cageX-1,y,2,4,'#81747b'); R(cageX,y+1,1,2,'#403748');
    }
    RO(cageX-5,base-36,10,2,'#978986');
    POW_KINDS.lanternKeeper.draw({x:cageX,y:base,id:0,state:'tied',t:frame});
    const bx = 133 + ease((frame-20)/69)*310, by = 112 - ease((frame-25)/64)*26 + Math.sin(frame/8)*3;
    ENEMY_TYPES.caveRobotBat.draw({x:bx,y:by,facing:1,t:frame,state:'roam'});
    lantern(bx,by+5);
    ENEMY_TYPES.countClockfang.draw({x:304,y:212+Math.sin(frame/10)*2,facing:-1,t:frame,state:'intro'});
  }
  function entrance() {
    const cam = 0, startX = LV.heroStart;
    CaveScenery6.drawBG(cam); CaveScenery6.drawGround(cam);
    const run = ease((frame-cut)/65), heroX = Math.round(-12 + (startX+12)*run);
    drawHero(HEROES[G.hero],heroX,groundAt(startX),1,{
      pose: run<1?'run':'idle', t:frame, aim:'fwd', weapon:'moonbow'
    });
    const fly = (frame-cut)/67, batX = Math.round(30+W*fly), batY = 93+Math.sin(frame/8)*4;
    if (fly < 1.08) ENEMY_TYPES.caveRobotBat.draw({x:batX,y:batY,facing:1,t:frame,state:'roam'});
    const drop = 122, fall = clamp((frame-drop)/(landing-drop),0,1);
    const lampX = frame < drop ? batX : 231 + Math.round(fall*36);
    const lampY = frame < drop ? batY+4 : Math.round(99+110*fall*fall);
    lantern(lampX,lampY);
    if(frame >= landing && frame < landing+25) {
      const t=frame-landing;
      for(const sign of [-1,1]) for(let i=0;i<3;i++)
        R(lampX+sign*(3+t*(.55+i*.20)),214-Math.sin(t/25*Math.PI)*(5+i*3),2,1,gold);
    }
  }
  function swarm() {
    if (frame < cut-30 || frame > cut+23) return;
    for(let i=0;i<16;i++) {
      const progress = (frame-cut+30-i*1.25)/34;
      if(progress<-.1 || progress>1.1) continue;
      const size = .55 + (i%4)*.28;
      const x = Math.round(-45+(W+90)*progress), y = Math.round(55+(i*39)%146+Math.sin(progress*7+i)*8);
      ctx.save(); ctx.translate(x,y); ctx.scale(size,size);
      ENEMY_TYPES.caveBat.draw({x:0,y:0,facing:1,t:frame+i*7,state:'roam'});
      ctx.restore();
    }
  }
  function bars() {
    R(0,0,W,29,night); R(0,28,W,1,'#514855');
    R(0,H-28,W,28,night); R(0,H-28,W,1,'#524651');
    text('MISSION 6',12,11,gold,1,'left',null);
    text('ENTER TO SKIP',W-12,11,'#a9a5b0',1,'right',null);
    const caption = frame < cut ? 'COUNT CLOCKFANG HAS TAKEN THE LANTERN KEEPERS!' :
      'RESCUE THE KEEPERS AND DEFEAT COUNT CLOCKFANG';
    text(caption,W/2,H-17,moon,1,'center',null);
  }
  function title() {
    const alpha = ease((frame-113)/19);
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha;
    const cx=W/2, y=117;
    R(cx-127,y-8,254,44,'rgba(18,19,36,.86)');
    R(cx-126,y-8,252,1,'#9c8282'); R(cx-126,y+35,252,1,'#705966');
    for(const side of [-1,1]) {
      const x=cx+side*119;
      R(x-2,y+9,5,1,'#bda08d'); R(x,y+7,1,5,gold);
    }
    text('CLOCKFANG CAVERN',cx,y,gold,2,'center','#382c42');
    text('SHOOT THE SUNBELLS TO STUN FOES',cx,y+22,moon,1,'center',null);
    ctx.restore();
  }
  function finish() {
    const p=G.p;
    G.introKeys={}; p.hidden=false; p.x=LV.heroStart; p.y=groundAt(p.x);
    p.vx=0; p.vy=0; p.facing=1; p.onGround=true; p.onPlat=null;
    G.big={s:LV.startText,t:130}; G.banner={s:LV.sections[0].name,t:200};
    say(LV.startSay);
    return true;
  }
  return {
    start() {
      frame=0; canSkip=!keys.Enter; G.introKeys={}; G.p.hidden=true;
      Snd.tone('sine',147,145,.65,.10);
      Snd.tone('triangle',294,290,.45,.055);
    },
    update() {
      frame++;
      if(!keys.Enter) canSkip=true;
      if(canSkip && pressed.Enter) { delete pressed.Enter; return finish(); }
      if(frame===finishAt) return finish();
      if(frame===27 || frame===42) Snd.tone('triangle',220,120,.13,.055);
      if(frame===61) Snd.tone('sine',740,510,.29,.06);
      if(frame===79 || frame===94) Snd.noise(.22,.075,2100);
      if(frame===landing) {
        Snd.tone('triangle',740,700,.38,.10);
        Snd.tone('sine',1110,1070,.46,.065);
      }
      return false;
    },
    draw() {
      ctx.save(); ctx.imageSmoothingEnabled=false;
      if(frame<cut) court(); else entrance();
      swarm(); bars(); title();
      ctx.restore();
    }
  };
})();
