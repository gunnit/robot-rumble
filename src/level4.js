'use strict';
var L4 = L4 || {};
{
const OCEAN={
  mission:'MISSION 4',title:'CORAL KINGDOM',end:6400,heroStart:100,freedLabel:'SEA FRIENDS RESCUED',
  controls:['ARROWS / WASD: SWIM IN ALL DIRECTIONS','X: BUBBLES   C: TORPEDO','ENTER: BOARD / EXIT SUBMARINE'],
  music:'coral',bossMusic:'octoboss',clearMusic:'victory',startText:'MISSION 4 START!',startSay:'Mission four, start!',
  sections:[{x:0,name:'AREA 1: CORAL GARDEN'},{x:1700,name:'AREA 2: KELP FOREST'},{x:3400,name:'AREA 3: SUNKEN RUINS'},{x:5000,name:'FINAL AREA: GLOWING DEEP'}],
  terrain:[[0,245],[600,248],[1000,238],[1600,248],[2000,245],[2600,240],[3200,248],[3600,244],[4100,248],[4700,242],[5000,248],[5600,246],[6400,248]],
  plats:[],
  // Robots per area (polish 2026-11-14): the three new ones (puffer, crab on open sand, eel in its seabed pipe, never
  // in a lock wave or next to a cage) join the first four so every area has its share of the fight.
  spawns:[
    {t:'roboctopus',x:540,y:170},{t:'robojelly',x:800,y:100},{t:'roboeel',x:1120},{t:'robocrab',x:1260},{t:'roboray',x:1450,y:145},
    {t:'robocrab',x:2000},{t:'roboctopus',x:2070,y:195},{t:'robojelly',x:2300,y:100},{t:'roboeel',x:2420},{t:'roboray',x:2550,y:160},
    {t:'robopuffer',x:2850,y:130},{t:'robocrab',x:3000},{t:'roboctopus',x:3150,y:170},{t:'roboeel',x:3260},
    {t:'roboeel',x:3560},{t:'roboray',x:3650,y:100},{t:'robopuffer',x:3720,y:160},{t:'roboctopus',x:3850,y:190},
    {t:'robocrab',x:4250},{t:'robopuffer',x:4400,y:130},{t:'roboeel',x:4560},{t:'robojelly',x:4600,y:120},{t:'roboray',x:4800,y:185},
    {t:'robojelly',x:5180,y:100},{t:'robocrab',x:5280},{t:'roboctopus',x:5360,y:190},{t:'robopuffer',x:5500,y:140},{t:'roboeel',x:5800}
  ],
  locks:[
    {at:950,waves:[{t:'roboctopus',side:1,d:30,y:175},{t:'robojelly',side:1,d:190,y:100},{t:'roboray',side:-1,d:370,y:145},{t:'robopuffer',side:1,d:540,y:150}]},
    {at:2650,waves:[{t:'roboray',side:1,d:30,y:100},{t:'roboctopus',side:1,d:180,y:190},{t:'robocrab',side:-1,d:300},{t:'robojelly',side:-1,d:420,y:140},{t:'robopuffer',side:1,d:560,y:120},{t:'roboray',side:1,d:680,y:190}]},
    {at:4000,waves:[{t:'robocuttle',side:1,d:50,y:150}]},
    {at:5920,boss:true,waves:[{t:'megaoctopus',side:1,d:60}]}
  ],
  pows:[
    {x:370,y:160,kind:'oceanfish',item:'oceanPearl'},{x:1520,y:205,kind:'oceanstar',item:'heart'},
    {x:2190,y:105,kind:'oceanhorse',item:'oceanCharge'},{x:3100,y:195,kind:'oceanoctopus',item:'heart'},
    {x:3820,y:112,kind:'oceandolphin',item:'oceanPearl'},{x:4700,y:180,kind:'oceanray',item:'oceanCharge'},
    {x:5650,y:155,kind:'oceancuttle',item:'heart'}
  ],
  props:[{k:'oceansub',x:1800,y:155}],
  drawBG:cx=>L4.drawBG(cx),drawBehind:cx=>L4.drawBehind(cx),drawGround:cx=>L4.drawGround(cx),drawFront:cx=>L4.drawFront(cx),drawOverlay:cx=>L4.drawOverlay(cx),
  preview:(...a)=>L4ART.card(...a),menuBG:()=>L4.menuBG(),
  load(cp){
    if(typeof L4ART!=='undefined'&&L4ART.bakeAll)L4ART.bakeAll();
    rescueSec=-1;
    if(!G.continues)L4.bossHP=null;
    L4.playerLoad(cp);
    for(const o of G.pows){o.y=OCEAN.pows[o.id].y;o.waterY=o.y;}
    // A continue inside the forest can always find its vehicle again near the checkpoint.
    if(cp===1700&&!G.props.some(o=>o.k==='oceansub'))G.props.push(makeProp({k:'oceansub',x:1800,y:155}));
  },
  update(){
    L4SND.tick();
    L4.playerUpdate();
    for(const o of G.pows){
      o.y=o.state==='run'?o.waterY-Math.min(130,(o.t-64)*.65):o.waterY;
      if(o.state==='run')o.x+=3.2;
    }
    // Rewards float at the rescue depth, drift forward into view, and gently attract a nearby swimmer.
    for(const it of G.items){
      if(it.waterY==null){it.waterY=clamp(it.y,65,225);it.onGround=true;it.vx=0;it.vy=0;it.x=clamp(Math.max(it.x,G.p.x+25),G.cam.x+15,G.cam.x+W-20);}
      it.y=it.waterY+Math.sin(it.t*.05)*2;
      if(!G.p.dead&&Math.hypot(it.x-G.p.x,it.y-(G.p.y-8))<65){it.x+=(G.p.x-it.x)*.06;it.waterY+=(G.p.y-8-it.waterY)*.06;}
    }
  }
};
// Hearts (polish 2026-11-14, as Mission 1): the INK CAPTAIN always leaves a heart, and the first robot beaten in an
// area while the hero is down to the last heart leaves one too (once per area; a continue starts afresh). Items float
// at their depth and drift to a nearby swimmer (update below).
let rescueSec=-1;
for(const t of ['roboctopus','roboray','robojelly','robopuffer','robocrab','roboeel','robocuttle']){
  const T=ENEMY_TYPES[t];if(!T)continue;const kill=T.onKill;
  T.onKill=function(e,cx,cy,b){
    const r=kill?kill.call(this,e,cx,cy,b):undefined,p=G.p;
    if(t==='robocuttle')dropItem('heart',cx,cy,0);
    else if(p&&!p.dead&&p.hearts===1&&rescueSec!==G.section){rescueSec=G.section;dropItem('heart',cx,cy,0);}
    return r;
  };
}
let introT=0;
function finishIntro(){G.p.y=155;G.p.vx=G.p.vy=0;G.introKeys={};G.banner={s:OCEAN.sections[0].name,t:200};G.big={s:OCEAN.startText,t:130};say(OCEAN.startSay);return true;}
OCEAN.intro={
  start(){introT=0;G.p.y=70;G.p.inv=180;G.introKeys={};},
  update(){introT++;if(tap('ok')||introT>=175)return finishIntro();G.p.y=70+Math.min(85,introT*.58);return false;},
  draw(){ctx.fillStyle='rgba(5,23,46,.8)';ctx.fillRect(0,0,W,39);ctx.fillRect(0,H-38,W,38);text('CORAL KINGDOM',W/2,13,'#b8faff',2,'center');text('DIVE IN!  ARROWS TO SWIM',W/2,H-29,'#ffffff',1,'center');text('X: BUBBLES   C: TORPEDO   ENTER: SKIP',W/2,H-15,'#9cdae3',1,'center');}
};
LEVELS.push(OCEAN);
for(const [key,kind,scale] of [['oceanfish','fish',1],['oceanstar','star',1],['oceanhorse','seahorse',.8],['oceanoctopus','octopus',.7],['oceandolphin','dolphin',.7],['oceanray','ray',.58],['oceancuttle','cuttle',.7]]){
  POW_KINDS[key]={thanks:kind==='dolphin'?'CLICK! THANK YOU!':'THANK YOU!',
    box:o=>({x:o.x-22,y:o.y-40,w:44,h:40}),
    onFree(o){L4.bubbles(o.x,o.y-15,12);L4SND.play(kind==='dolphin'?'dolphin':'rescue');},
    draw(o){} // painted by level4_kit.js (cages and the seven friendly animals)
  };
}
TRACKS.coral={bpm:128,lead:'sine',bass:[36,0,48,0,43,0,48,0,41,0,48,0,43,0,50,0],mel:[72,0,79,76,0,74,0,67,72,76,79,0,81,79,76,0,74,0,77,81,0,79,77,74,71,74,79,0,76,74,72,0],drums:{kick:'x.......',hat:'..x...x.'}};
TRACKS.octoboss={bpm:150,lead:'triangle',bass:[36,36,0,43,36,0,46,43,34,34,0,41,34,0,43,41],mel:[72,75,79,75,72,0,67,0,70,74,77,74,70,0,65,0],drums:{kick:'x...x...',snare:'....x...',hat:'.x.x.x.x'}};
}
