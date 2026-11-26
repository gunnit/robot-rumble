'use strict';

{
  const gold='#ffe0a0',mint='#97ead8',coral='#e78370',ink='#162b38',brass='#b38d62';
  const sections=[
    {x:0,name:'SALTWIND QUAY',short:'QUAY',track:'saltwind',hint:'Ring the quay bell. Ring again near a spark to return it.'},
    {x:1600,name:'BELL ORCHARD',short:'ORCHARD',track:'bellOrchard',hint:'Ring over a wind grate to reach the treetop walkways.'},
    {x:3350,name:'KITE RUN',short:'KITE RUN',track:'kitePost',hint:'Steer up and down. Catch the three winged mail pennants.'},
    {x:5350,name:'THE GLASSWORKS',short:'GLASS',track:'rainGlass',hint:'Align the two mirrors. Climb the belfry to reach its roof.'},
    {x:7100,name:'THUNDERHEAD',short:'COILS',track:'coilworks',hint:'Ring glowing rods. Ground both copper coils at the door.'},
    {x:8800,name:'THE LAST LIGHTHOUSE',short:'BEACON',track:'stormEye',hint:'Ring close when the Manta bell lights. Watch the landing.'}
  ];
  const crew=[
    {x:286,name:'PIP',line:'MY BOAT IS STILL OUT THERE!',item:'heart'},
    {x:1425,name:'ADA',line:'I CAN SEE THE QUAY!',item:'B'},
    {x:1926,y:125,name:'FERN',line:'THE HIGH PATH IS YOURS!',item:'heart'},
    {x:3139,name:'BEAU',line:'MY MAIL KITE STILL FLIES!',item:'heart'},
    {x:5500,name:'IRIS',line:'TURN THE MIRRORS WITH YOUR BELL!',item:'heart'},
    {x:6074,y:179,name:'OLLIE',line:'THE HERON IS ON THE BELFRY ROOF!',item:'B'},
    {x:8128,name:'KIT',line:'THE TOWER HAS POWER!',item:'heart'},
    {x:9634,name:'NEL',line:'BRING OUR SHIPS HOME!',item:'heart'}
  ];
  POW_KINDS.quayKeeper={
    thanks:'FREE!',box:o=>({x:o.x-11,y:o.y-32,w:22,h:32}),
    onFree(o){
      const c=crew[o.id],call=G.texts.find(t=>t.s==='FREE!'&&t.x===o.x);
      if(call){call.s=c.name+' IS FREE';call.c=mint;}
      radio=c.name+'  /  '+c.line;radioT=135;
      if(o.item){ITEMS[o.item].collect({x:o.x,y:o.y-5},G.p);o.item=null;}
    },
    run(o){
      const prevY=o.y;
      o.x-=2.2;
      o.vy=Math.min(5,(o.vy||0)+.26);
      o.y+=o.vy;
      land(o,prevY);
    },
    draw(o){
      if(o.x<G.cam.x-20||o.x>G.cam.x+W+20)return;
      const x=Math.round(o.x),y=Math.round(o.y),trapped=o.state==='tied';
      if(trapped){RO(x-11,y-30,22,29,'#364855');R(x-8,y-27,16,23,'#61777a');}
      L7Art.keeper(x,y-2,o.t,o.state==='run'?-1:1);
      if(trapped){
        RO(x-13,y-31,26,3,brass);RO(x-14,y-3,28,3,brass);
        for(const sign of [-1,1]){RO(x+sign*11-1,y-29,3,26,'#9d845e');R(x+sign*8,y-26,1,21,'#d9b782');}
        RO(x-4,y-7,8,6,'#9f7050');L7Signal.diamond(x,y-5,2,gold);
        R(x-5,y-35,10,2,coral);R(x-3,y-37,6,2,gold);
      }else if(o.t<25){
        ctx.save();ctx.globalAlpha=1-o.t/25;
        for(const sign of [-1,1]){RO(x+sign*(11+o.t*.45),y-29-o.t*.28,2,23,brass);}
        ctx.restore();
      }
    }
  };
  let radio='',radioT=0;
  const P=(x,y,w)=>({x,y,w});
  const spans=[
    P(668,182,69),P(744,149,101),P(933,182,76),P(1188,179,70),P(1386,177,83),
    P(1678,180,84),P(1890,125,112),P(2015,119,93),P(2116,140,76),P(2227,167,61),
    P(2412,130,118),P(2536,144,88),P(2742,132,105),P(2864,157,66),P(3030,175,90),
    P(5435,175,62),P(5975,184,72),P(6055,179,82),P(6170,148,81),P(6350,181,62),
    P(7050,183,70),P(7203,178,68),P(7334,156,87),P(7442,177,58),P(7632,177,72),P(8038,184,70),
    P(8254,175,77),P(8338,146,78),P(8486,180,71),P(8696,175,86),P(8920,171,73),P(9012,144,83),
    P(9236,182,62),P(9390,174,72),P(9553,180,69),P(9760,178,72),P(10036,183,70),P(10376,183,73)
  ];
  const terrain=[[0,221],[450,221],[605,224],[790,206],[927,215],[1090,221],[1430,221],[1610,217],
    [1774,210],[1870,222],[1940,226],[2115,209],[2255,215],[2390,223],[2580,209],[2720,226],[2955,217],[3160,203],
    [3280,217],[3350,218],[3450,240],[3530,292],[5120,292],[5210,254],[5310,218],[5510,218],[5625,222],
    [5904,222],[6060,218],[6260,210],[6430,222],[6990,222],[7170,211],[7330,211],[7470,223],[7660,217],
    [7880,222],[8120,215],[8360,212],[8500,226],[8770,209],[8960,210],[9215,224],[9390,218],[9580,211],
    [9800,221],[10000,220],[10480,220]];
  const spawn=(t,x,y)=>({t,x,y});
  const spawns=[
    {...spawn('quayCrab',690),rushLesson:true},spawn('coilKite',885,153),spawn('quayCrab',1030),
    spawn('coilKite',1558,162),spawn('quayCrab',1728),spawn('coilKite',2030,132),spawn('spindleSpider',2170),
    {...spawn('squallRam',2340),waveLesson:true},spawn('coilKite',2598,142),spawn('quayCrab',2895),spawn('squallRam',3070),
    spawn('coilKite',5560,148),spawn('quayCrab',6085),spawn('squallRam',6215),spawn('prismSnail',6350),
    spawn('quayCrab',7270),spawn('coilKite',7390,141),spawn('squallRam',7550),spawn('coilKite',8050,158),
    spawn('quayCrab',8240),spawn('coilKite',8425,139),spawn('galePuffin',8650),
    spawn('galePuffin',9060),spawn('prismSnail',9230),spawn('squallRam',9430),spawn('spindleSpider',9710)
  ];
  const locks=[
    {at:1120,waves:[{t:'quayCrab',side:1,d:12},{t:'coilKite',side:1,d:72,y:160},{t:'quayCrab',side:-1,d:149}]},
    {at:6460,mini:true,waves:[{t:'bellHeron',side:1,d:18}]},
    {at:10000,boss:true,waves:[{t:'stormManta',side:1,d:50}]}
  ];
  function drawTowerScene(){
    if(!L7Belfry.drawScene())return false;
    const climb=L7Belfry.status();
    panel(8,6,137,23);
    text('GLASSWORKS BELFRY',15,10,gold);
    R(15,21,119,3,'#35545c');
    R(15,21,Math.round(119*clamp(climb.rise/climb.totalRise,0,1)),3,mint);
    const tip=L7Belfry.hint();
    if(tip){
      panel((W-tip.length*6-16)/2,247,tip.length*6+16,15);
      text(tip,W/2,251,mint,1,'center');
    }
    return true;
  }
  function towerPause(){
    const c=L7Belfry.status(), fraction=clamp(c.rise/c.totalRise,0,1);
    panel(40,27,400,214);
    text('GLASSWORKS BELFRY',W/2,46,gold,2,'center');
    text('TOWER ASCENT  /  '+Math.round(fraction*100)+'%',W/2,83,mint,1,'center');
    R(73,98,334,4,'#35545c');R(73,98,Math.round(334*fraction),4,mint);
    text(L7Belfry.hint(),W/2,124,gold,1,'center');
    text('ARROWS MOVE     HOLD Z TO JUMP',W/2,158,'#e4e7dc',1,'center');
    text('V OR B RINGS THE HOIST AND CROWN BELL',W/2,177,'#e4e7dc',1,'center');
    text('P OR ENTER TO RESUME     Q FOR TITLE',W/2,217,mint,1,'center');
  }
  function drawPause(){
    if(L7Belfry.status().active){towerPause();return;}
    const st=L7Signal.status();const px=26,py=19,width=428;
    const heron=G.enemies.find(e=>e.type==='bellHeron'&&e.active&&!e.dead&&!e.dying);
    R(px,py,width,231,'#152d3b');R(px,py,width,2,brass);R(px,py+229,width,2,brass);
    text('THE LAST LIGHTHOUSE',W/2,29,gold,2,'center');
    text('HARBOR CHART  /  '+(heron?'CARILLON ROOF':sections[G.section].name),W/2,52,mint,1,'center');
    ctx.save();ctx.beginPath();ctx.rect(40,67,400,60);ctx.clip();
    for(let x=43;x<441;x+=15)R(x,67,1,59,'#28444e');
    for(let y=70;y<127;y+=12)R(40,y,400,1,'#28444e');
    const mapX=x=>48+384*x/LV.end;
    for(let x=0;x<LV.end;x+=42){
      const sx=mapX(x),gy=105+(groundAt(x)-218)*.19;
      R(sx,gy,2,Math.max(1,125-gy),'#315754');R(sx,gy,2,2,x<=G.p.x?mint:'#718f87');
    }
    for(let i=0;i<crew.length;i++){
      const x=mapX(crew[i].x);L7Signal.diamond(x,91-(i%2)*5,3,G.freed.has(i)?gold:'#67818b');
    }
    for(const [x,on] of [[418,st.quay],[5840,st.aligned],[6450,L7Belfry.status().completed],[7860,st.coils===2]]){R(mapX(x),95,1,10,brass);R(mapX(x)+1,96,4,3,on?mint:coral);}
    const me=mapX(G.p.x);R(me-3,70,7,2,gold);R(me-2,72,5,2,gold);R(me-1,74,3,2,gold);R(me,76,1,7,gold);ctx.restore();
    for(let i=0;i<6;i++)text(sections[i].short,65+i*70,132,i===G.section?gold:'#aec5c7',1,'center');
    text(G.freed.size+' / 8 KEEPERS     '+L7Skiff.count()+' / 3 MAIL PENNANTS',W/2,151,mint,1,'center');
    R(42,166,396,1,'#45636a');
    text(heron?(L7Foes.heronHint(heron)||'Watch the bells above the roof.') : sections[G.section].hint,W/2,175,gold,1,'center');
    text('ARROWS MOVE / AIM   Z JUMP   X FIRE   C GRENADE',W/2,196,'#dce7de',1,'center');
    text('V OR B RING     M MUSIC     Q TITLE',W/2,210,'#c6dad5',1,'center');
    text('P OR ENTER TO RESUME',W/2,232,mint,1,'center');
  }
  const encounterHints={
    spindleSpider:'SPINDLE SPIDER  /  STEP CLEAR OF THE MARK',
    prismSnail:'PRISM SNAIL  /  FIRE WHEN ITS SHUTTER OPENS',
    galePuffin:'GALE PUFFIN  /  HOLD DOWN TO DUCK THE WIND'
  };
  function drawHUD(){
    if(G.intro)return;
    if(G.winT||G.state==='win'){L7Story.victoryDraw();return;}
    panel(234,4,138,28);L7Signal.gauge(238,6);
    R(303,8,1,20,'#6b7e81');text('CREW',310,8,'#bfcfcb');text(G.freed.size+' / 8',310,20,gold);
    if(G.p.ride){L7Skiff.drawHUD();return;}
    const active=G.locks.find(l=>l.active&&!l.done);
    const duel=active&&(active.boss||active.mini);
    let msg=L7Signal.hint();
    if(!msg&&!duel){
      const threat=G.enemies.find(e=>e.active&&!e.dead&&e.state==='tell'&&encounterHints[e.type]&&
        e.x>=G.cam.x+8&&e.x<=G.cam.x+W-8&&Math.abs(e.x-G.p.x)<220);
      if(threat)msg=encounterHints[threat.type];
    }
    if(!msg&&radioT>0)msg=radio;
    if(duel){
      const e=G.enemies.find(o=>o.lock===active&&!o.dead&&!o.dying);
      if(e&&e.type==='bellHeron')msg=L7Foes.heronHint(e)||msg;
      else if(e&&e.state==='tell'&&distToBox(G.p.x,G.p.y-19,ebox(e))<=122){
        if(!L7Foes.counterReady(e))msg='WAIT FOR THE BELL TO LIGHT';
        else msg=L7Signal.ready()?'V NOW  /  INTERRUPT THE ATTACK':'BELL RECHARGING  /  DODGE THE STRIKE';
      }
    }
    const bound=duel&&G.enemies.some(e=>e.type==='stormManta'&&e.state==='tether');
    if(bound){
      const left=G.enemies.filter(e=>e.type==='mantaClasp'&&!e.dead).length;
      msg='RING OR SHOOT THE BRASS CLASPS  /  '+left+' LEFT';
    }
    if(!msg&&active&&!duel)msg='CLEAR THE QUAY  /  '+(G.enemies.filter(e=>e.lock===active&&!e.dead).length+active.queue.length)+' LEFT';
    if(msg){const w=msg.length*6+18;panel((W-w)/2,247,w,15);text(msg,W/2,251,mint,1,'center');}
  }
  // At the crown the storm coast gradually comes into view beyond the roof.
  function rooftopAmount(cam){return cam<6460?0:clamp((7155-cam)/160,0,1);}
  function drawBackdrop(cam){
    const roof=rooftopAmount(cam);
    if(roof<1)L7Art.bg(cam);
    if(roof){
      ctx.save();ctx.globalAlpha=roof;L7TowerArt.roof(cam);ctx.restore();
    }
  }
  function drawTerrain(cam){
    const amount=1-rooftopAmount(cam);
    if(amount){ctx.save();ctx.globalAlpha=amount;L7Art.ground(cam);ctx.restore();}
  }
  function drawScenery(cam){
    const amount=1-rooftopAmount(cam);
    if(amount){ctx.save();ctx.globalAlpha=amount;L7Art.props(cam);ctx.restore();}
    L7Signal.drawWorld(cam);L7Skiff.drawWorld(cam);
    if(cam<6460)L7TowerArt.entry(cam,6450);
  }
  const level={
    mission:'MISSION 7',title:'THE LAST LIGHTHOUSE',end:10480,heroStart:83,
    freedLabel:'KEEPERS RESCUED',startText:'MISSION 7 START!',startSay:'Ring the quay bell!',
    music:'saltwind',bossMusic:'mantaTempest',clearMusic:'beaconHome',
    sections,terrain,plats:spans,spawns,locks,pows:crew.map(c=>({...c,kind:'quayKeeper'})),
    props:[{k:'crate',x:755,y:149,item:'heart'},{k:'crate',x:2065,y:119,item:'B'},{k:'crate',x:2485,y:130,item:'heart'},
      {k:'crate',x:3165,item:'heart'},{k:'crate',x:6425,item:'heart'},{k:'crate',x:7055,y:183,item:'heart'},
      {k:'crate',x:8400,y:146,item:'B'},{k:'crate',x:8955,y:171,item:'heart'},{k:'crate',x:9935,item:'heart'}],
    intro:L7Story.intro,preview:L7Art.preview,menuBG:L7Art.menuBG,
    drawBG:drawBackdrop,drawGround:drawTerrain,drawPlat:L7Art.plat,drawBehind:drawScenery,
    updateScene(){
      if(!L7Belfry.updateScene())return false;
      if(L7Belfry.status().active&&Music.track!==TRACKS.belfryRise)Music.play('belfryRise');
      return true;
    },
    drawScene:drawTowerScene,
    drawFront(cam){L7Signal.drawPulse(cam);},
    drawHUD,drawPause,drawWinExtras:L7Story.winExtra,
    beforePlayerUpdate:L7Signal.beforePlayerUpdate,
    load(cp){
      G.section=sections.reduce((s,c,i)=>cp>=c.x?i:s,0);
      G.banner={s:sections[G.section].name,t:170};
      G.pows=G.pows.filter(o=>!G.freed.has(o.id));
      for(const o of G.pows){if(crew[o.id].y!=null)o.y=crew[o.id].y;}
      L7Signal.load(cp);L7Skiff.load(cp);L7Story.load();L7Belfry.load(cp);radio='';radioT=0;
      if(cp||G.continues){G.big=null;radio='CHECKPOINT  /  '+sections[G.section].name;radioT=95;}
    },
    update(){
      if(G.intro)return;
      if(radioT>0)radioT--;
      L7Signal.update();L7Skiff.update();
      const duel=G.locks.find(l=>(l.mini||l.boss)&&l.active&&!l.done);
      if(duel){G.checkpoint=duel.at;G.banner=null;if(duel.boss&&G.warnT>45)G.warnT=45;}
      else{
        const mini=G.locks.find(l=>l.mini&&l.done);
        if(mini&&G.checkpoint===mini.at)G.checkpoint=mini.at+1;
      }
      // The repair sites make useful retries between chapter starts.
      for(const cp of [5970,8000])if(G.p.x>=cp+36&&G.checkpoint<cp)G.checkpoint=cp;
      if(!G.winT&&G.state==='play'){
        const song=duel?(duel.mini?'bellHeronDance':'mantaTempest'):sections[G.section].track;
        if(Music.track!==TRACKS[song])Music.play(song);
      }
      L7Story.victoryUpdate();
    }
  };
  LEVELS.push(level);
}
