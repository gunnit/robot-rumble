'use strict';

{
  const keepers = [
    { x: 336, item: 'heart' }, { x: 1530, item: 'U' },
    { x: 2455, y:158, item: 'heart' }, { x: 4140, item:'U' },
    { x: 5180, item:'heart' }, { x: 6145, y:172, item:'E' },
    { x: 7830, y:164, item:'heart' }, { x: 9500, item:'U' }
  ].map(keeper => ({ ...keeper, kind: 'lanternKeeper' }));
  const slots = ['moonbow', 'sunflare', 'echogun'];
  const slotColors = ['#cde6ff', '#ffd56d', '#83efdc'];
  const chapterMusic=['caveMoonrise','roostChimes','lanternRail','mirrorRefrain','forgePistons','caveMoonrise'];
  const routeLabels = ['GROTTO', 'ROOST', 'RAILWAY', 'LAKE', 'FOUNDRY', 'BELFRY'];
  const routeHints = [
    'FIRE UP AT SUNBELLS TO STUN THE BATS.',
    'SHOOT THE WINCH TO UNROLL THE HIGH BRIDGE.',
    'JUMP THE BENT RAILS. SHOOT THE FALLING FREIGHT.',
    'RING THE PRISM TO RAISE THE CRYSTAL PATH.',
    'BREAK BOTH BRASS RELAYS TO CUT THE STEAM.',
    'WATCH THE COUNT\'S CLOCK FOR HIS NEXT ATTACK.'
  ];
  let checkpointMessage = '', checkpointTime = 0;

  // The engine stops the camera at a wave lock. Put a portcullis at that actual
  // boundary, and lift its teeth as soon as the last guard has fallen.
  function drawGates(cam) {
    for (const lock of G.locks) {
      const x = lock.at + W - 5;
      if (lock.boss || lock.mini || x < cam - 28 || x > cam + W + 28) continue;
      const y = groundAt(x), lintel = y - 72;
      for (const dx of [-18, 15]) {
        RO(x+dx,lintel-2,5,74,'#454055');
        R(x+dx,lintel,1,70,'#807782');
        for (let j=1;j<6;j++) R(x+dx,lintel+j*12,5,2,'#292534');
      }
      ctx.save(); ctx.beginPath(); ctx.rect(x-17,lintel,34,72); ctx.clip();
      const top = lintel - lock.gateLift;
      for (let dx=-12;dx<=12;dx+=8) {
        RO(x+dx,top,3,67,'#866874'); R(x+dx,top,1,66,'#c39382');
        R(x+dx+1,top+67,1,3,'#dfaa88');
      }
      RO(x-14,top+26,30,3,'#78606c'); RO(x-14,top+54,30,3,'#78606c');
      ctx.restore();
      RO(x-21,lintel-6,42,8,'#504254'); R(x-20,lintel-6,40,2,'#b08977');
      RO(x-5,lintel-10,10,12,'#604957');
      const gem = lock.done ? '#95e8ca' : '#ed9d8b';
      R(x-1,lintel-8,2,7,gem); R(x-3,lintel-6,6,3,gem);
      R(x-1,lintel-7,1,3,'#ffeac1');
    }
  }

  function drawEncounterStatus() {
    const lock = G.locks.find(l => l.active && !l.done && !l.boss && !l.mini);
    let label = checkpointTime > 0 ? checkpointMessage : '';
    if (lock) {
      const guards = G.enemies.filter(e => e.lock === lock && !e.dead);
      const remaining = guards.length + lock.queue.length;
      if (lock.objective==='relays') label = remaining ? 'SHUT DOWN THE FORGE  /  ' + remaining + (remaining===1?' RELAY':' RELAYS') : '';
      else label = remaining ? remaining + (remaining === 1 ? ' GATE GUARD LEFT' : ' GATE GUARDS LEFT') : '';
      // Point to a queued or entering guard until its sprite becomes visible.
      const next = lock.queue.find(w => w.d-lock.t <= 40);
      const entering = guards.find(e => e.x < G.cam.x || e.x > G.cam.x+W);
      if (lock.objective!=='relays' && (next || entering)) {
        const side = next ? next.side : (entering.x < G.cam.x ? -1 : 1);
        const y = next ? (next.y || groundAt(lock.at)) - 18 : entering.y - 18;
        const x = side > 0 ? W-7 : 7;
        RO(x-4,y-4,9,9,'#493649');
        for (let i=-2;i<=2;i++) R(x + side*(Math.abs(i)-1),y+i,2,1,'#ffce84');
      }
    }
    if (!label) return;
    const w = label.length*6 + 16;
    panel((W-w)/2,245,w,15);
    text(label,W/2,249,lock ? '#ffdf9c' : '#b9ebde',1,'center');
  }

  // A rescued keeper's lantern rises into the rose window during the clear sequence.
  function lightTheWindow() {
    if (!G.winT || G.winT > 210) return;
    const elapsed = 210 - G.winT;
    const windowX = 230, windowY = 108;
    const dawn=clamp((elapsed-42)/108,0,1);
    if(dawn>0) {
      ctx.save();
      for(let ray=0;ray<12;ray++) {
        const a=ray*Math.PI/6 + Math.sin(elapsed*.014)*.065;
        ctx.fillStyle='rgba(255,210,125,'+(dawn*.11)+')'; ctx.beginPath();
        ctx.moveTo(windowX,windowY); ctx.lineTo(windowX+Math.cos(a)*440,windowY+Math.sin(a)*440);
        ctx.lineTo(windowX+Math.cos(a+.09)*440,windowY+Math.sin(a+.09)*440);ctx.closePath();ctx.fill();
      }
      ctx.restore();
    }
    let i = 0;
    for (const id of G.freed) {
      const t = clamp((elapsed - i++ * 8) / 112, 0, 1);
      if (!t) continue;
      const startX = 44 + id * (W-88) / (keepers.length-1);
      const arc = Math.PI * 2 * id / keepers.length - Math.PI / 2;
      const x = Math.round(startX + (windowX + 35 * Math.cos(arc) - startX) * t + Math.sin(Math.PI * 2 * t) * 6);
      const y = Math.round(221 + (windowY + 35 * Math.sin(arc) - 221) * (1 - (1-t)*(1-t)));
      ctx.fillStyle = 'rgba(255,209,100,.12)'; ctx.fillRect(x-7,y-7,15,15);
      RO(x-2,y-5,5,2,'#bc885a'); RO(x-3,y-2,7,6,'#ffd16e');
      R(x-1,y-2,2,4,'#fff6c9'); R(x-3,y+4,7,1,'#a97654');
    }
    if(elapsed>125) {
      panel(153,67,174,24); text('DAWN RETURNS',W/2,72,'#ffe6a2',2,'center');
    }
  }

  function drawCaveHUD() {
    if (G.intro) return;
    drawEncounterStatus();
    // Fit the equipment shortcuts and rescue tally between the standard gun and score panels.
    panel(234, 4, 138, 28);
    for (let i = 0; i < slots.length; i++) {
      const x = 240 + 25 * i, name = slots[i], active = G.p.weapon === name;
      const color = CaveGear6.ammo(name) > 0 ? slotColors[i] : '#687081';
      text(String(i+1), x, 8, color);
      if (CaveGear6.ammo(name) !== undefined) WEAPONS[name].icon(x, 18);
      else { R(x+3,20,6,5,'#515564'); R(x+4,18,4,1,'#72788b'); R(x+4,19,1,2,'#72788b'); R(x+7,19,1,2,'#72788b'); }
      if (active) R(x-1,29,19,1,color);
    }
    R(313,8,1,20,'#616377');
    text('KEEPERS',320,8,'#a7b5c7'); text(G.freed.size + ' / ' + keepers.length,320,20,'#ffe4a3');
  }

  function drawRouteMap() {
    const current = G.section, gold = '#ffe1a0', mint = '#a3ebd8';
    panel(23,20,434,231);
    text('CLOCKFANG CAVERN',W/2,32,gold,2,'center');
    text('PAUSED  /  '+LV.sections[current].name,W/2,57,'#c5d6db',1,'center');
    const left=51, right=429, mapX=x=>left+(right-left)*clamp(x/LV.end,0,1);
    const mapY=x=>106+(groundAt(x)-204)*.22;
    // Outline the playable hills and pools. The lit part is the distance already travelled.
    for (let sx=left;sx<right;sx++) {
      const wx=LV.end*(sx-left)/(right-left);
      const y=Math.round(mapY(wx));
      R(sx,y,1,2,wx<G.p.x?mint:'#707184');
      R(sx,y+2,1,116-y,'#323044');
    }
    for(let i=0;i<routeLabels.length;i++) {
      const section=LV.sections[i], next=LV.sections[i+1];
      const middle=(section.x+(next?next.x:LV.end))/2;
      text(routeLabels[i],mapX(middle),123,i===current?gold:'#acb4c6',1,'center',null);
      const x=Math.round(mapX(section.x));
      R(x,104,1,11,'#888994');
    }
    for(let id=0;id<keepers.length;id++) {
      const x=Math.round(mapX(keepers[id].x)), rescued=G.freed.has(id);
      RO(x-2,93,5,7,rescued?'#db9a58':'#6d7082');
      R(x-1,94,3,4,rescued?'#fff0a7':'#272b3d'); R(x-1,91,3,1,rescued?gold:'#808597');
    }
    const dot=Math.round(mapX(G.p.x)), tip=Math.round(mapY(G.p.x))-3;
    R(dot-3,tip-3,7,1,gold); R(dot-2,tip-2,5,1,gold); R(dot-1,tip-1,3,1,gold); R(dot,tip,1,1,gold);
    text(G.freed.size+' OF '+keepers.length+' LANTERN KEEPERS RESCUED',W/2,76,mint,1,'center');
    R(40,139,400,1,'#514958');
    const duel=G.locks.find(l=>l.active&&!l.done&&(l.mini||l.boss));
    const hint=duel&&duel.mini?'DUCK THE LOW SWOOP. JUMP THE ECHO RINGS.':routeHints[current];
    text(hint,W/2,150,gold,1,'center');
    text('ARROWS  MOVE / AIM     Z  JUMP     X  FIRE',W/2,172,'#dce6e8',1,'center');
    text('C  GRENADE     1-3  WEAPONS',W/2,185,'#dce6e8',1,'center');
    text('M  MUSIC '+(Music.on?'ON':'OFF')+'     Q  QUIT TO TITLE',W/2,205,'#aeb3c4',1,'center');
    text('P OR ENTER  RESUME',W/2,230,mint,1,'center');
  }

  const cave = {
    mission: 'MISSION 6', title: 'CLOCKFANG CAVERN', end: 10280, heroStart: 82,
    freedLabel: 'KEEPERS RESCUED', startText: 'MISSION 6 START!', startSay: 'Mission six. Light the way!',
    controls: ['ARROWS: MOVE / AIM   Z: JUMP', 'X: FIRE   C: GRENADE   1-3: WEAPONS'],
    pauseHint: 'SHOOT CAGES TO FREE KEEPERS. FIRE UP UNDER SUNBELLS.',
    music: 'caveMoonrise', bossMusic: 'clockfangWaltz', clearMusic: 'keeperDawn',
    terrain: [
      [0,220],[340,220],[478,219],[705,217],[852,224],[1050,214],[1220,219],[1535,220],
      [1700,222],[1870,209],[2050,218],[2200,229],[2320,240],[2440,238],[2640,217],[2790,206],[2950,212],[3210,226],
      [3400,220],[3510,220],[3740,206],[3980,225],[4170,228],[4370,212],[4540,199],[4750,220],[4900,230],[5030,219],
      [5200,221],[5400,214],[5450,216],[5480,244],[5660,244],[5690,216],[5765,215],[5830,216],[5859,244],[6070,244],[6100,216],
      [6195,216],[6220,216],[6248,244],[6310,244],[6340,216],[6410,220],[6920,220],
      [7000,220],[7130,211],[7320,201],[7490,218],[7670,228],[7790,213],[7980,199],[8110,211],[8240,220],[8720,220],
      [8920,211],[9060,196],[9220,204],[9410,215],[9610,221],[9800,220],[10280,220]
    ],
    sections: [
      { x: 0, name: 'MOONLIT GROTTO' }, { x: 1700, name: 'THE HANGING ROOST' },
      { x: 3400, name: 'THE LANTERN RAILWAY' }, { x: 5300, name: 'MIRROR LAKE' },
      { x: 7000, name: 'THE CLOCKWORK FOUNDRY' }, { x: 9200, name: 'THE MIDNIGHT BELFRY' }
    ],
    // Low approaches lead up to the high perches. Each chamber also has a continuous ground route.
    plats: [
      {x:480,y:186,w:72}, {x:564,y:152,w:100}, {x:990,y:180,w:72},
      {x:1320,y:177,w:90}, {x:1780,y:184,w:70}, {x:1864,y:147,w:108},
      {x:2050,y:185,w:67}, {x:2120,y:158,w:106}, {x:2404,y:158,w:106}, {x:2515,y:186,w:65},
      {x:2890,y:178,w:76}, {x:3230,y:182,w:62},
      {x:5100,y:188,w:72},{x:5210,y:162,w:66},
      {x:5484,y:206,w:46},{x:5551,y:192,w:45},{x:5624,y:204,w:41},
      {x:5752,y:184,w:72},{x:6107,y:172,w:93},{x:6242,y:207,w:44},{x:6305,y:201,w:43},
      {x:6490,y:180,w:68},{x:6790,y:183,w:70},
      {x:7110,y:177,w:70},{x:7200,y:143,w:104},{x:7448,y:176,w:65},
      {x:7685,y:194,w:74},{x:7774,y:164,w:105},{x:7920,y:170,w:64},
      {x:8070,y:169,w:76},{x:8367,y:184,w:69},{x:8530,y:181,w:72},
      {x:8875,y:181,w:66},{x:8990,y:156,w:80},{x:9230,y:172,w:58},{x:9320,y:146,w:86},
      {x:9590,y:183,w:78},{x:9840,y:181,w:56},{x:10185,y:181,w:56}
    ],
    spawns: [
      {t:'caveBat',x:556,y:151}, {t:'caveVampire',x:737},
      {t:'caveBat',x:935,y:172}, {t:'caveVampire',x:1080}, {t:'caveBat',x:1134,y:149},
      {t:'caveVampire',x:1580}, {t:'caveBat',x:1660,y:146},
      {t:'caveRobotBat',x:1910,y:141}, {t:'caveRobotBat',x:2070,y:162},
      {t:'caveVampire',x:2180}, {t:'caveBat',x:2360,y:154},
      {t:'caveRobotBat',x:2490,y:146}, {t:'caveVampire',x:2570},
      {t:'caveRobotBat',x:3080,y:131}, {t:'caveBat',x:3200,y:166},
      {t:'caveVampire',x:3290},
      {t:'caveRobotBat',x:3740,y:155},{t:'caveBat',x:3990,y:168},
      {t:'caveRobotVampire',x:4330},{t:'caveRobotBat',x:4550,y:151},{t:'caveBat',x:4760,y:161},
      {t:'caveVampire',x:5220},
      {t:'caveBat',x:5510,y:155},{t:'caveRobotBat',x:5650,y:151},{t:'caveVampire',x:5790},
      {t:'caveBat',x:6000,y:159},{t:'caveBat',x:6125,y:142},{t:'caveRobotVampire',x:6270},
      {t:'caveRobotVampire',x:7295},{t:'caveRobotBat',x:7420,y:144},{t:'caveVampire',x:7585},
      {t:'caveRobotBat',x:7785,y:144},{t:'caveRobotVampire',x:7930},{t:'caveBat',x:8110,y:166},
      {t:'caveRobotVampire',x:8360},{t:'caveRobotBat',x:8520,y:162},{t:'caveVampire',x:8780},
      {t:'caveBat',x:9020,y:145},{t:'caveRobotVampire',x:9240},{t:'caveRobotBat',x:9416,y:151}
    ],
    locks: [
      {at:1150,waves:[
        {t:'caveBat',side:1,d:16,y:153}, {t:'caveVampire',side:1,d:80},
        {t:'caveBat',side:-1,d:148,y:176}
      ]},
      {at:2580,waves:[
        {t:'caveRobotBat',side:1,d:12,y:154}, {t:'caveVampire',side:-1,d:96},
        {t:'caveBat',side:1,d:146,y:149}, {t:'caveRobotBat',side:1,d:211,y:165}
      ]},
      {at:6420,mini:true,waves:[{t:'roostMatriarch',side:1,d:40}]},
      {at:8200,objective:'relays',waves:[
        {t:'forgeRelay',side:1,d:1,offset:96},{t:'forgeRelay',side:1,d:1,offset:362,raised:39}
      ]},
      {at:9800,boss:true,waves:[{t:'countClockfang',side:1,d:60}]}
    ],
    pows: keepers,
    props: [
      {k:'sunbell',x:510,y:130}, {k:'caveArsenal',x:808,item:'U'},
      {k:'sunbell',x:1370,y:121}, {k:'caveArsenal',x:1818,item:'E'},
      {k:'roostWinch',x:2087}, {k:'sunbell',x:2280,y:110}, {k:'sunbell',x:2800,y:145},
      {k:'crate',x:2570,y:186,item:'B'}, {k:'caveArsenal',x:3455,item:'U'}, {k:'caveArsenal',x:5110,item:'E'},
      {k:'caveLakeMirror',x:5785},{k:'sunbell',x:6117,y:108},{k:'crate',x:6370,item:'heart'},
      {k:'caveArsenal',x:7040,item:'U'},{k:'forgeVent',x:7390},{k:'forgeVent',x:7730},
      {k:'sunbell',x:7820,y:103},{k:'forgeVent',x:8040},{k:'forgeVent',x:8380},
      {k:'forgeVent',x:8525},{k:'forgeVent',x:8835},{k:'forgeVent',x:8960},
      {k:'caveArsenal',x:9070,item:'E'},{k:'crate',x:9368,y:146,item:'heart'},
      {k:'caveArsenal',x:9690,item:'U'},{k:'sunbell',x:10010,y:155}
    ],
    ...CaveScenery6,
    drawBehind(cam) { CaveRail6.drawBehind(cam); CaveLake6.drawBehind(cam); CaveWorks6.drawBehind(cam); drawGates(cam); },
    drawPlat(pl) { if(pl.t!=='roostBridge' && !CaveLake6.drawPlat(pl)) CaveScenery6.drawPlat(pl); },
    drawFront(cam) { if(CaveScenery6.drawFront)CaveScenery6.drawFront(cam); CaveLake6.drawFront(cam); CaveRail6.drawFront(cam); },
    drawOverlay: lightTheWindow, drawHUD: drawCaveHUD, drawPause: drawRouteMap, intro: CaveIntro6,
    beforePlayerUpdate() { CaveGear6.beforePlayerUpdate(); CaveLake6.beforePlayerUpdate(); },
    load(cp) {
      G.section=0;
      for(let i=1;i<this.sections.length;i++)if(cp>=this.sections[i].x)G.section=i;
      G.banner={s:this.sections[G.section].name,t:200};
      const restored = CaveGear6.load(cp);
      G.pows = G.pows.filter(keeper => !G.freed.has(keeper.id));
      for(const o of G.pows) if(keepers[o.id].y!=null) {o.y=keepers[o.id].y; o.perchY=o.y; o.escapeY=o.y;}
      CaveWorks6.load(); CaveLake6.load(cp); CaveRail6.load(cp);
      for (const lock of G.locks) lock.gateLift = lock.done ? 72 : 0;
      if (cp > 0 || G.continues > 0) G.big = null;
      checkpointTime = G.continues > 0 ? 120 : 0;
      const lakeDuel=this.locks.find(lock=>lock.mini).at;
      checkpointMessage = cp === this.locks[this.locks.length-1].at ? 'BELFRY CHECKPOINT' :
        (cp===lakeDuel || cp===lakeDuel+1) ? 'MIRROR LAKE CHECKPOINT' : 'CHECKPOINT';
      if (restored) checkpointMessage += ' / AMMO RESTORED';
    },
    update() {
      CaveGear6.update();
      CaveWorks6.update(); CaveLake6.update(); CaveRail6.update();
      for(const o of G.pows) if(o.perchY!=null && o.state==='run') {
        const ledge=LV.plats.some(pl=>pl.y===o.perchY && o.x>=pl.x && o.x<=pl.x+pl.w);
        o.escapeY=ledge ? o.perchY : Math.min(groundAt(o.x),o.escapeY+Math.min(5,(o.fallSpeed||0)+.3));
        o.fallSpeed=ledge?0:Math.min(5,(o.fallSpeed||0)+.3); o.y=o.escapeY;
      }
      if (checkpointTime > 0) checkpointTime--;
      for (const lock of G.locks) {
        if (lock.boss && lock.active) { G.banner=null; G.checkpoint=lock.at; }
        if (lock.mini && lock.active && !lock.done) {
          G.banner=null;
          G.checkpoint=lock.at;
        } else if (lock.mini && lock.done && G.checkpoint===lock.at) {
          // loadLevel skips locks strictly before the saved camera position.
          G.checkpoint=lock.at+1;
        }
        if (!lock.boss && lock.done && lock.gateLift < 72) lock.gateLift += 4;
      }
      if(!G.winT) {
        const duel=G.locks.find(l=>(l.boss||l.mini)&&l.active&&!l.done);
        const tune=duel ? (duel.boss ? this.bossMusic : 'matriarchEcho') : chapterMusic[G.section];
        if(Music.track!==TRACKS[tune]) Music.play(tune);
      }
    }
  };

  // The three-note bell call from the entrance becomes the Count's insistent waltz,
  // then resolves in a major key when the keepers return to the cavern.
  TRACKS.caveMoonrise = {
    bpm:126, lead:'sine',
    bass:[38,0,0,45,0,0,38,0,0,45,0,0,34,0,0,41,0,0,36,0,0,45,0,0],
    mel:[74,0,0,81,0,0,77,0,0,0,76,0,74,0,0,69,0,0,72,0,76,0,0,0,
         74,0,0,81,0,0,84,0,0,81,0,0,77,0,74,0,72,0,73,0,0,0,0,0],
    drums:{kick:'x.....',hat:'....x.......'}
  };
  TRACKS.clockfangWaltz = {
    bpm:174, lead:'triangle',
    bass:[38,0,45,50,0,45,38,0,45,48,0,45,34,0,41,46,0,41,33,0,40,45,0,49],
    mel:[74,0,81,77,0,74,73,0,76,81,0,79,77,0,74,70,0,74,73,0,69,76,0,73,
         74,77,81,86,0,81,79,76,73,81,0,79,77,74,70,74,0,77,76,73,69,73,0,81],
    drums:{kick:'x.....',snare:'...x..',hat:'.x.x.x'}
  };
  TRACKS.roostChimes={
    bpm:146,lead:'triangle',bass:[46,0,53,0,46,0,41,0,43,0,50,0,45,0,52,0],
    mel:[77,0,82,0,81,77,74,0,79,0,83,86,81,0,77,74,77,82,86,0,84,81,77,0,76,79,83,0,81,0,73,0],
    drums:{kick:'x.......',hat:'..x...x.'}
  };
  TRACKS.lanternRail={
    bpm:188,lead:'triangle',bass:[38,50,45,50,38,50,45,50,34,46,41,46,36,48,43,48],
    mel:[74,0,77,81,0,77,76,74,69,0,72,77,0,74,73,69,74,77,81,86,84,81,77,74,72,0,77,74,73,0,69,0],
    drums:{kick:'x...x...',snare:'....x...',hat:'x.xx.x.x'}
  };
  TRACKS.mirrorRefrain={
    bpm:110,lead:'sine',bass:[43,0,0,50,0,0,46,0,0,53,0,0,41,0,0,48,0,0,38,0,0,45,0,0],
    mel:[79,0,0,86,0,81,82,0,0,77,0,0,77,0,0,84,0,79,81,0,0,74,0,0],
    drums:{hat:'.....x......'}
  };
  TRACKS.matriarchEcho={
    bpm:164,lead:'triangle',bass:[43,0,43,50,43,0,46,53,41,0,41,48,38,0,45,50],
    mel:[79,0,82,86,0,79,77,74,82,0,86,89,86,82,0,77,79,0,74,0,77,0,72,0,74,77,81,84,81,0,77,0],
    drums:{kick:'x...x...',snare:'......x.',hat:'..xx..x.'}
  };
  TRACKS.forgePistons={
    bpm:158,lead:'sawtooth',bass:[38,38,0,45,38,50,0,45,35,35,0,42,36,48,0,43],
    mel:[62,0,69,0,74,0,77,76,65,0,70,0,74,72,0,69,62,0,69,74,77,0,81,77,71,0,74,71,72,0,67,0],
    drums:{kick:'x..x..x.',snare:'....x...',hat:'.x...x..'}
  };
  TRACKS.keeperDawn = {
    bpm:138, lead:'triangle',
    bass:[38,0,45,50,0,45,43,0,50,55,0,50,40,0,47,52,0,47,33,0,40,45,0,40],
    mel:[74,0,0,81,0,0,78,0,0,86,0,0,83,81,79,78,0,74,76,0,73,74,0,0],
    drums:{kick:'x.....',hat:'...x..'}
  };
  LEVELS.push(cave);
}
