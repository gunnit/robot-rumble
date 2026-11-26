'use strict';

const L7Story = (() => {
  const night='#122738', paper='#ffe6b4', brass='#ba8455', foam='#a6eada';
  let t=0,skip=false,waiting=0,signalled=false;

  // The same five hulls and dark eastern tower appear in both paintings.
  // A slow camera drift and individual answering lamps tie the two shots together.
  function fleetView(panel,age) {
    const picture=L7Fleet.get(panel),inset=Math.round(Math.min(age,180)*.034);
    const width=picture.width-inset*2,height=picture.height-inset;
    ctx.drawImage(picture,inset,inset/2,width,height,0,22,W,224);
    const lamps=[[80,195],[165,205],[259,212],[332,194],[404,206]];
    for(let i=0;i<lamps.length;i++){
      const on=panel===1?age>30+i*17:(age+i*19)%90<15;
      if(!on)continue;
      const [wx,wy]=lamps[i],x=Math.round((wx-inset)*W/width),y=Math.round(22+(wy-inset/2)*224/height);
      R(x-2,y,5,1,paper);R(x,y-2,1,5,foam);R(x,y,1,1,'#fffbed');
    }
  }
  function bars(left='',right='',caption=''){
    R(0,0,W,24,night);R(0,23,W,1,brass);R(0,H-27,W,27,night);R(0,H-27,W,1,brass);
    text(left,11,9,paper,1,'left',null);text(right,W-11,9,foam,1,'right',null);
    text(caption,W/2,H-16,paper,1,'center',null);
  }
  function band(title,subtitle){
    R(0,94,W,59,'rgba(14,34,45,.89)');R(0,94,W,1,brass);R(0,152,W,1,brass);
    text(title,W/2,105,paper,3,'center','#294351');text(subtitle,W/2,137,foam,1,'center',null);
  }
  function finish(){
    G.p.hidden=false;G.introKeys={};G.p.x=LV.heroStart;G.p.y=groundAt(G.p.x);G.p.vy=0;G.p.onGround=true;
    G.big={s:LV.startText,t:93};G.banner={s:LV.sections[0].name,t:175};
    say('Ring the quay bell!');return true;
  }
  const intro={
    start(){t=0;skip=!keys.Enter;G.introKeys={};G.p.hidden=true;
      Snd.tone('sine',174,166,.7,.1);Snd.tone('triangle',262,254,.6,.045,.65);},
    update(){
      t++;if(!keys.Enter)skip=true;
      if(skip&&pressed.Enter){delete pressed.Enter;return finish();}
      if(t===94){Snd.noise(.6,.16,670);Snd.tone('triangle',349,146,.47,.12);}
      if(t===153){Snd.tone('sine',523,523,.35,.09);Snd.tone('sine',784,784,.45,.065,.16);}
      return t>=275?finish():false;
    },
    draw(){
      ctx.save();
      if(t<152){
        fleetView(0,t);
        if(t<94){
          const height=66+Math.sin(t*.023)*28,alpha=t>74?.12+.05*Math.sin(t*.8):.13;
          ctx.fillStyle='rgba(255,230,164,'+alpha+')';
          ctx.beginPath();ctx.moveTo(447,105);ctx.lineTo(0,height-26);ctx.lineTo(0,height+26);ctx.closePath();ctx.fill();
        }
        if(t>=88){ctx.fillStyle='rgba(22,28,47,'+(Math.min(.30,(t-88)*.014))+')';ctx.fillRect(0,23,W,H-48);}
        bars('MISSION 7  /  OFF THE WINDWARD ISLES','ENTER  SKIP',t<91?'FIVE SHIPS OFF THE REEF. ONE LIGHT TO BRING THEM HOME.':'THE STORM MANTA HAS SILENCED THE LIGHTHOUSE.');
      }else{
        L7Art.bg(0);L7Art.props(0);L7Art.ground(0);
        L7Art.keeper(143,groundAt(143),t,1);
        const run=Math.min(1,(t-152)/38),x=Math.round(45+run*58);
        drawHero(HEROES[G.hero],x,groundAt(x),1,{pose:run<1?'run':'idle',t,aim:'fwd',weapon:'signalgun'});
        L7Signal.bell(125,groundAt(125)-33,0);
        band('THE LAST LIGHTHOUSE','A DISTRESS CALL FROM SALTWIND QUAY');
        bars('MISSION 7  /  HARBOR WATCH','ENTER  SKIP','TAKE MY STORM BELL. THE FLEET KNOWS ITS VOICE.');
      }
      ctx.restore();
    }
  };
  function load(){waiting=0;signalled=false;}
  function victoryUpdate(){
    if(!G.winT)return;
    G.banner=null;G.warnT=0;G.goT=0;
    if(!signalled&&G.winT<=204){
      waiting++;
      if(pressed.KeyV||pressed.KeyB||pressed.Enter||waiting>=150){
        signalled=true;Snd.tone('sine',392,392,.7,.13);Snd.tone('sine',587,587,.65,.1,.24);Snd.tone('sine',784,784,.72,.085,.5);
        Music.play('beaconHome');G.winT=202;
      }else G.winT=205;
    }
  }
  function victoryDraw(){
    if(!G.winT&&G.state!=='win')return;
    const complete=G.state==='win',age=complete?218:signalled?203-G.winT:0;
    if(!signalled&&!complete){
      if(waiting>0){
        R(70,75,340,41,'rgba(14,34,45,.9)');R(70,75,340,1,brass);
        text('THE CHANNEL IS CLEAR',W/2,82,paper,2,'center');text('PRESS V TO SIGNAL THE FLEET',W/2,104,foam,1,'center');
      }return;
    }
    ctx.save();ctx.globalAlpha=Math.min(1,(age+1)/33);
    fleetView(1,age);
    const count=L7Skiff.count();
    R(0,240,229,4,'#54494a');R(0,240,229,1,brass);
    for(let i=0;i<4;i++)R(7+i*61,244,5,26,night);
    let seat=0;for(const id of G.freed)L7Art.keeper(14+seat++*21,239,age+id*12,1);
    for(let i=0;i<count;i++) {
      const x=194+i*13;R(x,221,1,19,brass);R(x+1,219,8,4,'#ed816e');R(x+2,220,2,2,paper);
    }
    if(complete)bars();
    else bars('WINDWARD ISLES  /  FIRST LIGHT','FLEET  5 / 5',age<98?'THE LIGHT IS BACK. FIVE SHIPS ANSWER.':count===3?'ALL THREE MAIL PENNANTS FLY. THE FLEET IS HOME.':'THE LAST SHIP CROSSES THE REEF. EVERYONE IS HOME.');
    ctx.restore();
  }
  function winExtra(){
    const n=L7Skiff.count();text(n+' / 3 MAIL PENNANTS DELIVERED',W/2,198,n===3?paper:foam,1,'center');
  }
  return {intro,load,victoryUpdate,victoryDraw,winExtra};
})();

// The answering horn call is heard in each arrangement and resolves at dawn.
{
  const cadence=[74,0,81,0,78,0,0,0];
  const tunes=[
    ['saltwind',128,'triangle',[50,57,54,57,47,54,50,57],[74,0,78,81,0,78,76,0,71,0,74,78,0,74,73,0], 'x.......','....x...','..x...x.'],
    ['bellOrchard',144,'sine',[55,62,59,62,50,57,54,57],[79,86,0,83,0,79,78,0,74,0,78,81,86,0,83,0],'x.......','','...x..x.'],
    ['kitePost',178,'triangle',[50,62,57,54,47,59,54,57],[74,78,81,86,83,81,78,74,71,74,78,83,81,78,76,73],'x...x...','....x...','x.xx.x.x'],
    ['rainGlass',110,'sine',[47,0,54,0,50,0,57,0],[71,0,78,0,0,81,78,0,74,0,81,0,0,86,81,0],'','','.....x..'],
    ['coilworks',157,'triangle',[47,47,54,59,45,45,52,57],[71,0,74,73,78,0,74,0,69,0,73,76,81,0,76,73],'x..x..x.','....x...','..x.x.xx'],
    ['stormEye',120,'sine',[50,0,57,0,47,0,54,0],[74,0,0,78,81,0,0,76,71,0,0,74,78,0,73,0],'x.......','','......x.'],
    ['belfryRise',132,'sine',[50,57,54,62,55,62,57,64],[74,0,78,0,81,0,0,78,76,0,79,0,83,0,81,0],'x.......','......x.','..x...x.'],
    ['bellHeronDance',164,'triangle',[47,54,59,54,50,57,62,57],[71,78,0,83,81,78,74,0,74,81,0,86,83,81,78,0],'x.....x.','....x...','..xx..x.'],
    ['mantaTempest',172,'sawtooth',[47,54,47,59,43,50,45,52],[71,0,78,74,83,81,78,74,67,74,79,78,69,76,81,73],'x..x..x.','....x...','x.xxxx.x'],
    ['beaconHome',126,'triangle',[50,57,54,57,55,62,57,64],[74,78,81,86,0,83,81,78,79,83,86,90,0,86,81,0],'x.......','','..x...x.']
  ];
  for(const [name,bpm,lead,b,m,kick,snare,hat] of tunes){
    const bass=b.flatMap((n,i)=>[n,i%2?0:n? n+12:0]);
    TRACKS[name]={bpm,lead,bass,mel:[...m,...cadence,...m.slice(8)],drums:{kick,snare,hat}};
  }
}
