// Run with harness.mjs sim --level 7 --frames 1 --extra tools/harness/fixtures/lighthouse-check.js
{
  let checks = 0;
  function check(ok, message) {
    if (!ok) throw new Error('Lighthouse regression: ' + message);
    checks++;
    console.log('LIGHTHOUSE ok ' + message);
  }
  function tick(frames = 1) {
    for (let i = 0; i < frames; i++) {
      update();
      for (const code in pressed) delete pressed[code];
    }
  }
  function press(...codes) {
    for (const code of codes) keys[code] = pressed[code] = true;
    tick();
    for (const code of codes) keys[code] = false;
  }
  function walkTo(x) {
    const code = G.p.x < x ? 'ArrowRight' : 'ArrowLeft';
    keys[code] = true;
    for (let i = 0; i < 200 && Math.abs(G.p.x - x) > 2; i++) tick();
    keys[code] = false;
  }
  function readyBell() {
    tick(L7Signal.status().cooldown);
  }

  devStart({level:7, x:460, god:true});
  keys.ArrowRight = true; tick(25); keys.ArrowRight = false;
  check(G.p.x < 478 && !L7Signal.status().quay, 'the unlit quay door stops forward movement');
  G.eb.push({k:'l7Spark', x:G.p.x+17, y:G.p.y-19, vx:-1, vy:0, life:60});
  press('KeyV', 'KeyX');
  check(L7Signal.status().quay && G.p.weapon === 'signalgun', 'one bell press lights the quay');
  check(!G.eb.length && G.pb.some(b => b.dmg === 5 && b.vx > 0), 'the incoming spark returns as a friendly projectile');
  check(G.pb.some(b => b.pierce && b.dmg === 4), 'firing on the bell frame uses the newly charged lamp');
  walkTo(497);
  check(G.p.x > 478, 'the powered door permits passage');

  devStart({level:7, x:283, god:true});
  G.p.hearts = 2; press('KeyB');
  check(G.freed.has(0) && G.p.hearts === 3, 'the alternate bell key frees Pip and gives the heart');
  G.checkpoint = 0; continueGame();
  check(!G.pows.some(o => o.id === 0), 'a continued mission keeps the rescued crew');

  devStart({level:7, x:5744, god:true});
  press('KeyV'); press('KeyV');
  check(L7Signal.status().angles[0] === 1, 'a bell in cooldown cannot turn the mirror a second time');
  readyBell(); press('KeyV'); walkTo(5840); readyBell(); press('KeyV');
  check(L7Signal.status().aligned, 'two turns at the first mirror and one at the second complete the beam');
  G.checkpoint = 5350; continueGame();
  check(L7Signal.status().aligned, 'retrying the chapter preserves the alignment');

  devStart({level:7, x:7800, god:true});
  press('KeyV');
  check(L7Signal.status().coils === 1, 'a pulse grounds just the nearest of the paired coils');
  walkTo(7880); readyBell(); press('KeyV'); walkTo(7954);
  check(L7Signal.status().coils === 2 && G.p.x > 7940, 'both grounded coils release the storm door');

  devStart({level:7, x:3706, god:true}); tick();
  check(G.p.ride && G.p.ride.type === 'kitePost7', 'joining in midflight boards the mail skiff');
  const cruisingHeight = G.p.y;
  keys.ArrowUp = true; tick(27); keys.ArrowUp = false;
  check(G.p.y < cruisingHeight - 25 && L7Skiff.count() === 1, 'steering up reaches the first winged letter');
  G.checkpoint = 3350; continueGame(); tick();
  check(L7Skiff.count() === 1 && G.p.ride, 'the flight checkpoint retains mail and returns the skiff');
  for (let i = 0; i < 1400 && G.p.ride; i++) tick();
  check(!G.p.ride && G.p.x >= 5310, 'missed flight obstacles still lead to a safe landing');
  check(G.checkpoint === 5310, 'dismount commits the dock checkpoint before the hero takes a step');
  keys.ArrowLeft = true; tick(150); keys.ArrowLeft = false;
  check(G.p.x >= 5257 && G.p.x < 5310 && G.p.y === groundAt(5310)-2 && G.p.onGround, 'walking back stops at the visible pier railing on the deck');
  G.p.x = 5121; G.p.y = 292; G.p.vy = 0; tick();
  check(G.p.x >= 5257 && G.p.y === groundAt(5310)-2 && G.p.onGround, 'a hero left below the old dock returns to the visible deck');
  press('KeyZ');
  check(!G.p.onGround && G.p.vy < 0, 'the landing deck supports ordinary jumping');

  devStart({level:7, x:3684, god:true}); tick(2);
  keys.ArrowUp = true;
  for(let i=0; i<30 && G.p.y>166; i++) tick();
  keys.ArrowUp = false;
  for(let i=0; i<70 && G.p.x<3737; i++) tick();
  check(G.p.y > 152 && G.p.y < 165 && L7Skiff.count() === 1, 'a letter touching the tilted sail is collected above the cabin');

  devStart({level:7, x:3350, god:true}); tick();
  for(let i=0; i<1400 && G.p.ride; i++) {
    const high = G.p.x > 3910 && G.p.x < 4520;
    keys.ArrowDown = !high; keys.ArrowUp = high; tick();
  }
  keys.ArrowDown = keys.ArrowUp = false;
  check(!G.p.ride && !L7Skiff.count() && G.checkpoint === 5310, 'flying past the envelopes without touching them lands a zero-mail route');
  dbg.god = false; G.p.inv = 0; G.p.hearts = 1; G.lives = 1;
  for(let i=0; i<1000 && G.state === 'play'; i++) tick();
  tick(45); press('Enter');
  check(G.state === 'play' && G.continues === 1 && !G.p.ride && G.p.x >= 5310, 'losing the last life on arrival continues on the landing island');

  // Exercise an older departure checkpoint in the same run. Only newly earned
  // delivery points, the first clean-run award, and the third-letter heal are due.
  function replayDelivery() {
    G.checkpoint = 3350; continueGame(); tick();
    for(const [x,y] of [[3738,115],[4250,177],[4900,105]]) {
      G.cam.x = x-200; G.p.x = x-2; G.p.y = y+5; tick();
    }
    G.cam.x = 5110; G.p.x = 5309; G.p.hearts = 1;
    const before = G.score; tick();
    return G.score-before;
  }
  dbg.god = true;
  check(replayDelivery() === 500 && L7Skiff.count() === 3 && G.p.hearts === 2, 'completed mail after an empty delivery earns three new bonuses, clean flight and a heart');
  const fullDeliveryScore = G.score;
  check(replayDelivery() === 0 && G.score === fullDeliveryScore && G.p.hearts === 1, 'repeating the completed delivery awards neither duplicate points nor healing');

  devStart({level:7, x:4004, god:true}); tick(); press('KeyV');
  check(L7Skiff.count() === 0 && G.score > 0, 'a fresh flight clears collected mail and can fold a snag kite');

  // Follow the first answering buoy with the ordinary movement and bell inputs.
  function approachPractice() {
    devStart({level:7, x:418, god:false});
    press('KeyV');
    walkTo(504);
    for(let i=0; i<65 && !G.eb.some(b=>b.k==='l7BellReply'); i++) tick();
  }
  approachPractice();
  check(G.eb.some(b=>b.k==='l7BellReply') && /COME CLOSE/.test(L7Signal.hint()), 'the lit quay sends a slow practice spark before the first combat gate');
  for(let i=0; i<80 && !/SEND THE SPARK BACK/.test(L7Signal.hint()); i++) tick();
  check(/V NOW/.test(L7Signal.hint()) && L7Signal.ready(), 'the practice prompt switches to ring when the spark enters bell range');
  const practiceScore=G.score,practiceCharge=L7Signal.status().charge;
  press('KeyV');
  check(!G.eb.some(b=>b.k==='l7BellReply') && /RETURN TO SENDER/.test(L7Signal.hint()) && L7Signal.status().charge>practiceCharge && G.score===practiceScore, 'ringing the practice spark returns it to the buoy and charges the lamp');
  approachPractice();
  const practiceHealth=G.p.hearts;
  tick(110);
  check(G.p.hearts===practiceHealth && !G.eb.some(b=>b.k==='l7BellReply'), 'ignoring the lesson lets the spark burn out safely');

  for(const [id,x,shelfY] of [[2,1926,125],[5,6074,179]]) {
    devStart({level:7,x,god:true});
    const keeper=G.pows.find(k=>k.id===id);
    freePow(keeper); tick(68);
    check(keeper.state==='run' && keeper.x<x && keeper.y===shelfY && keeper.onPlat, 'rescued keeper '+id+' starts running on the original shelf');
    let fell=false,landed=false,maxDrop=0;
    for(let i=0;i<120;i++){
      const previousY=keeper.y;tick();maxDrop=Math.max(maxDrop,keeper.y-previousY);
      if(keeper.y>shelfY&&!keeper.onGround)fell=true;
      if(fell&&keeper.onGround&&keeper.y>shelfY){landed=true;break;}
    }
    check(fell && landed && maxDrop<=5.01, 'rescued keeper '+id+' steps off the ledge and lands without a ground snap');
  }

  devStart({level:7,x:5744,god:true});
  press('KeyV');
  check(/MIRROR I TURNED.*RECHARGING/.test(L7Signal.hint()), 'mirror I confirms its turn and cooldown instead of requesting an unavailable ring');
  tick(8);press('KeyV');
  check(!L7Signal.ready() && /RECHARGING/.test(L7Signal.hint()) && L7Signal.status().angles[0]===1, 'a rapid mirror double tap leaves its setting and recharge feedback intact');
  readyBell();
  check(/TAP V/.test(L7Signal.hint()), 'mirror I invites the next input as soon as the bell is ready');

  for(const [first,other] of [[7800,'RIGHT'],[7880,'LEFT']]){
    devStart({level:7,x:first,god:true});
    press('KeyV');
    check(/1 \/ 2 COILS GROUNDED.*RECHARGING/.test(L7Signal.hint()), 'the first coil confirms progress even when approaching from x'+first);
    readyBell();
    check(L7Signal.hint().includes('RING THE '+other+' COIL'), 'the recharged bell directs the player to the remaining '+other.toLowerCase()+' coil');
  }

  devStart({level:7, x:10300, god:true}); tick(155);
  const manta = G.enemies.find(e => e.type === 'stormManta');
  check(manta && !manta.inv && G.checkpoint === G.locks.find(l => l.boss).at, 'the lighthouse encounter saves an arena retry');
  for(let i=0; i<550 && !(manta.state==='tell' && manta.attack==='bank'); i++) tick();
  check(manta.state==='tell' && manta.attack==='bank', 'the Manta marks its landing before taking off');
  G.p.x = manta.startX; G.p.y = groundAt(G.p.x); G.eb.length = 0;
  G.p.inv = 0; dbg.god = false;
  for(let i=0; i<80 && manta.state === 'tell'; i++) tick();
  tick(3);
  check(manta.state === 'bank' && G.p.hearts === 3, 'overlapping the Manta at bank takeoff is harmless');
  G.p.x = manta.aimX; G.p.y = groundAt(G.p.x);
  for(let i=0; i<100 && manta.state === 'bank'; i++) tick();
  check(manta.state === 'landing' && G.p.hearts === 3, 'the overhead crossing leaves the marked floor safe until impact');
  tick();
  check(G.p.hearts === 2, 'standing at the marked landing takes the impact');
  dbg.god = true;
  damageEnemy(manta, manta.hp - manta.max / 2); tick();
  const clasps = G.enemies.filter(e => e.type === 'mantaClasp').sort((a,b) => a.x - b.x);
  check(manta.state === 'tether' && manta.inv && clasps.length === 2, 'the half-health Manta tethers to both ground clasps');
  const tetherHeight = manta.y; tick(20);
  check(manta.y < tetherHeight - 20, 'the tether lifts the Manta above the walking lane');
  walkTo(clasps[1].x - 60); press('KeyV');
  check(clasps[1].dead && !clasps[0].dead && manta.inv, 'the bell breaks the nearby clasp while the other holds');
  walkTo(clasps[0].x + 77); keys.KeyX = true; tick(65); keys.KeyX = false;
  check(clasps[0].dead && !manta.inv && manta.state !== 'tether', 'shooting the other clasp releases the Manta for its final phase');
  for(let i=0; i<350 && !(manta.state==='tell' && manta.attack==='fork'); i++) tick();
  check(manta.state === 'tell' && manta.attack === 'fork' && !L7Foes.counterReady(manta), 'the early fork tell is visible before the bell counter opens');
  G.p.x = manta.x-72; G.p.y = groundAt(G.p.x);
  press('KeyV');
  check(manta.state === 'tell', 'an early bell cannot cancel the impending fork');
  tick(manta.timer-27);
  check(!L7Foes.counterReady(manta), 'the boss counter stays closed at 27 frames');
  tick();
  check(L7Foes.counterReady(manta), 'the boss counter opens at 26 frames');
  readyBell(); press('KeyV'); draw();
  check(manta.state === 'refract' && manta.timer > 0, 'a timely fork counter starts the visible refracted discharge');
  damageEnemy(manta, manta.hp);
  for (let i = 0; i < 240 && G.winT > 204; i++) tick();
  tick(8);
  check(G.winT === 204 && G.state === 'play', 'the defeated Manta waits for the fleet signal');
  press('KeyV'); tick(18);
  check(G.winT > 0 && G.winT < 200, 'ringing completes the lighthouse call');
  tick(210);
  check(G.state === 'win', 'the fleet homecoming reaches the mission clear screen');
  // Isolate each real mission placement while driving its usual bell, lamp,
  // collision and update paths. The campaign runs also exercise mixed groups.
  function meet(type,spawnX,heroX){
    devStart({level:7,x:heroX,god:false});
    const foe=G.enemies.find(e=>e.type===type && e.x===spawnX);
    if(!foe)throw new Error('Missing mission placement: '+type+' at '+spawnX);
    G.enemies=[foe];
    return foe;
  }
  function reach(foe,s,limit=200){
    for(let i=0;i<limit&&foe.state!==s;i++)tick();
    check(foe.state===s,foe.type+' reaches '+s);
  }

  const orchardSpider=meet('spindleSpider',2170,2170);
  reach(orchardSpider,'tell');
  check(orchardSpider.landingY===140,'the orchard thread marks the first platform under its anchor');
  reach(orchardSpider,'rest');
  check(G.p.hearts===3 && orchardSpider.y===140,'taking the route below the marked platform avoids the spider');
  const deckSpider=meet('spindleSpider',9710,9710);
  reach(deckSpider,'rest');
  check(G.p.hearts===2 && deckSpider.y===groundAt(9710),'standing on the final marked floor costs one heart');
  const cutSpider=meet('spindleSpider',9710,9710);
  reach(cutSpider,'tell');
  press('KeyV');reach(cutSpider,'stun');reach(cutSpider,'rest');
  check(G.p.hearts===3 && cutSpider.y===groundAt(9710),'a timely bell lowers the spider into firing range without an impact');

  const snail=meet('prismSnail',6350,6285);
  tick();
  function lampAt(side){
    WEAPONS.signalgun.fire(G.p,snail.x+side*26,snail.y-19,-side,0);
    updateBullets();
  }
  lampAt(-1);
  check(snail.hp===snail.max && snail.catchT>0,'ordinary frontal lamp fire glints on the sealed shell');
  lampAt(1);
  check(snail.hp===snail.max-2,'shooting the unguarded back damages the snail');
  press('KeyV');
  check(snail.state==='open' && L7Signal.status().charge===2,'ringing the shutter opens the shell early and charges the lamp');
  const chargedHP=snail.hp;
  lampAt(-1);
  check(snail.hp===chargedHP-4,'the charged shot reaches the exposed snail from the front');
  const passedSnail=meet('prismSnail',6350,6285);
  passedSnail.active=true;G.cam.x=passedSnail.x+126;G.p.x=G.cam.x+120;
  tick();
  check(!G.enemies.includes(passedSnail),'a bypassed snail stays behind and leaves play before the next arena');
  const secondSnail=meet('prismSnail',9230,9155);
  reach(secondSnail,'open');
  check(G.eb.length===1 && G.eb[0].owner===secondSnail,'waiting out the shell releases one slow spark');
  tick(18);press('KeyV');
  check(!G.eb.length && G.pb.some(b=>b.dmg===5),'the ordinary bell returns the snail spark');

  function faceGust(duck){
    const bird=meet('galePuffin',8650,8542);
    keys.ArrowDown=duck;
    reach(bird,'tell');
    const before=G.p.x;
    reach(bird,'gust');reach(bird,'hover');
    keys.ArrowDown=false;
    return before-G.p.x;
  }
  const pushed=faceGust(false);
  check(pushed>0 && pushed<=18 && G.p.hearts===3,'the warned gust nudges a standing hero up to 18 pixels without damage');
  check(faceGust(true)===0,'ducking keeps the hero in place for the entire gust');
  const quietBird=meet('galePuffin',9060,8960);
  reach(quietBird,'tell');press('KeyV');
  check(quietBird.state==='stun','ringing the anchored puffin interrupts the gust before it blows');

  devStart({level:7,x:7800,god:false});
  check(L7Signal.limitWindStep(7928,7932)===7929,'wind cannot push through a closed signal gate');
  check(L7Signal.limitWindStep(7778,7784)===7781 && L7Signal.limitWindStep(7822,7815)===7819,'wind respects both sides of an ungrounded coil');
  check(L7Signal.limitWindStep(7790,7792)===7790 && L7Signal.limitWindStep(7790,7787)===7787,'a gust cannot push a hero closer to a live coil when already inside the margin');
  press('KeyV');
  check(L7Signal.limitWindStep(7778,7784)===7784,'grounding a coil removes its wind barrier');

  function climbInputs(scene, jumpHeld, bellHeld) {
    const goal=scene.goal, x=scene.feet.x, inputs=[];
    if(goal.action==='ride')return inputs;
    const jump=goal.action==='jump'||goal.action==='board';
    const liningUp=jump && scene.grounded && Math.abs(goal.takeoffX-x)>2.5;
    const target=liningUp?goal.takeoffX:goal.landX;
    if(Math.abs(target-x)>2.5)inputs.push(target<x?'ArrowLeft':'ArrowRight');
    if(jump&&!liningUp&&(!scene.grounded||!jumpHeld))inputs.push('KeyZ');
    if(!jump&&Math.abs(target-x)<=2.5&&!bellHeld)inputs.push('KeyV');
    return inputs;
  }

  function towerStep(){
    const s=L7Belfry.status();
    const inputs=climbInputs(s,keys.KeyZ,keys.KeyV);
    for(const code of ['ArrowLeft','ArrowRight','KeyZ','KeyV']){
      const down=inputs.includes(code);
      if(down&&!keys[code])pressed[code]=true;
      keys[code]=down;
    }
    tick();
  }
  function climbUntil(stop){
    for(let i=0;i<2000&&L7Belfry.status().active&&!stop(L7Belfry.status());i++)towerStep();
    for(const k of ['KeyZ','ArrowLeft','ArrowRight','KeyV'])keys[k]=false;
  }
  devStart({level:7,x:6448,god:false});
  keys.ArrowRight=true;tick(5);keys.ArrowRight=false;
  check(L7Belfry.status().active && G.checkpoint===6450 && !G.locks.find(l=>l.mini).active,'walking through the belfry door starts the climb before the Heron');
  const waiting=L7Belfry.status(),clock=G.time;
  press('KeyP');tick(25);
  check(G.state==='pause' && L7Belfry.status().feet.y===waiting.feet.y && G.time===clock,'pausing freezes the climb and the mission clock');
  press('KeyP');tick();
  check(G.state==='play' && L7Belfry.status().active,'resuming returns to the same belfry landing');
  climbUntil(s=>s.standingId==='refuge');
  const refuge=L7Belfry.status();
  check(refuge.refugeLit && refuge.standingId==='refuge' && refuge.rise>250 && refuge.cameraY<waiting.cameraY-180,'jumping the alternating ledges raises the camera and lights the halfway refuge');
  const heartsBefore=G.p.hearts,pointsBefore=G.score;
  keys.ArrowLeft=true;
  for(let i=0;i<160 && !L7Belfry.status().falls;i++)tick();
  keys.ArrowLeft=false;
  const caught=L7Belfry.status();
  check(caught.falls===1&&caught.standingId==='refuge'&&G.p.hearts===heartsBefore&&G.score===pointsBefore,'a missed ledge returns the hero to the lit refuge');
  continueGame();tick();
  check(L7Belfry.status().standingId==='refuge','a continued climb restores the refuge');
  climbUntil(s=>s.standingId==='hoist');
  check(L7Belfry.status().standingId==='hoist','the player can jump from the wind dock onto the hoist');
  const lowerHoist=L7Belfry.status().hoistY;
  tick(20);check(L7Belfry.status().hoistY===lowerHoist,'the brass hoist waits for a bell input');
  press('KeyB');tick(72);
  check(L7Belfry.status().standingId==='hoist' && L7Belfry.status().hoistY<=lowerHoist-115,'the alternate bell key raises the occupied hoist');
  climbUntil(s=>s.standingId==='summit');
  const crown=L7Belfry.status();
  check(crown.active && crown.standingId==='summit' && crown.rise===crown.totalRise && crown.rise>500,'the top gallery is over 500 pixels above the shaft floor');
  climbUntil(s=>s.goal.action==='signal'&&Math.abs(s.feet.x-s.goal.landX)<4);
  press('KeyB');
  check(!L7Belfry.status().active && L7Belfry.status().completed && G.cam.x===6460 && G.checkpoint===6460,'ringing the crown bell opens the rooftop and commits its retry point');
  tick(92);
  let heron=G.enemies.find(e=>e.type==='bellHeron'&&!e.dead);
  check(heron && !heron.inv && heron.movement===1,'the roof starts the first Heron movement');
  damageEnemy(heron,heron.hp+99);tick();
  heron=G.enemies.find(e=>e.type==='bellHeron'&&!e.dead);
  check(heron && heron.state==='scoreRise' && G.locks.find(l=>l.mini).active,'a lethal opening volley still leads to the carillon performance');

  function waitHeron(state,limit=220){
    for(let i=0;i<limit&&heron.state!==state;i++)tick();
    check(heron.state===state,'Heron reaches '+state);
  }
  waitHeron('scoreTell');
  const firstNote=heron.noteX;
  G.p.x=firstNote;G.p.y=groundAt(firstNote);G.p.inv=0;G.p.hearts=3;
  press('KeyV');
  check(!heron.noteSafe && heron.state==='scoreTell','an early ring leaves the first note sounding');
  waitHeron('scoreStrike');tick();
  check(G.p.hearts===2,'the first carillon note damages a player in its marked lane');
  waitHeron('scoreTell');
  const secondNote=heron.noteX;
  G.p.x=secondNote;G.p.y=groundAt(secondNote);G.p.inv=0;
  for(let i=0;i<80&&!L7Foes.counterReady(heron);i++)tick();
  press('KeyB');
  check(heron.noteSafe && heron.answers===1,'ringing the lit rope returns the second note');
  waitHeron('scoreStrike');tick();
  check(G.p.hearts===2,'the redirected note leaves its own marked lane safe');
  waitHeron('scoreTell');
  const thirdNote=heron.noteX;
  const knot=G.enemies.find(e=>e.type==='heronBellRope'&&!e.dead);
  G.pb.push({x:knot.x-7,y:knot.y,vx:7,vy:0,dmg:2,life:5});tick();
  check(heron.noteSafe && heron.answers===2 && new Set([firstNote,secondNote,thirdNote]).size===3,'shooting the third rope returns its note and all three bells have played');
  waitHeron('scoreFall');waitHeron('recovery');
  check(!heron.inv && heron.hp<heron.max/2 && !G.enemies.some(e=>e.type==='heronBellRope'),'returned notes expose and damage the Heron for the second movement');
  continueGame();tick(92);
  const retry=G.enemies.find(e=>e.type==='bellHeron');
  check(!L7Belfry.status().active&&L7Belfry.status().completed&&retry&&retry.movement===1&&retry.hp===retry.max,'a rooftop continue restarts the duel without repeating the climb');
  devStart({level:7,x:6448,god:false});keys.ArrowRight=true;tick(5);keys.ArrowRight=false;
  check(L7Belfry.status().active&&!L7Belfry.status().refugeLit&&L7Belfry.status().standingId==='floor','a fresh mission begins the belfry at its foot');

  console.log('LIGHTHOUSE ' + checks + ' checks passed');
}
