// Run with harness.mjs sim --level 6 --frames 1 --extra tools/harness/fixtures/clockfang-check.js
{
  function check(ok, message) {
    if (!ok) throw new Error('Clockfang regression: ' + message);
    console.log('CAVE ok ' + message);
  }
  function tick() {
    update();
    for (const code in pressed) delete pressed[code];
  }
  // Collect both guns, choose the bow and then switch and fire on the same tick.
  devStart({level:6, x:280, god:true});
  ITEMS.U.collect(G.p, G.p);
  ITEMS.E.collect(G.p, G.p);
  pressed.Digit1 = true; tick();
  pressed.Digit2 = true; keys.KeyX = pressed.KeyX = true; tick();
  keys.KeyX = false;
  check(G.p.weapon === 'sunflare' && G.p.ammo === 59 && !G.pb.at(-1).pierce, 'switch and fire uses the selected gun on the same frame');

  pressed.Digit1 = true; tick();
  ITEMS.E.collect(G.p, G.p);
  check(G.p.weapon === 'moonbow' && CaveGear6.ammo('echogun') === 64, 'a reserve refill keeps the selected bow');

  const keeper = G.pows[0];
  G.p.hearts = 2;
  freePow(keeper);
  check(G.p.hearts === 3 && G.freed.has(keeper.id), 'the keeper rewards the rescue immediately');
  for (let i=0; i<49; i++) tick();
  check(!G.items.some(it => it.k === 'heart'), 'the salute does not duplicate the reward');

  // A continue at the first checkpoint preserves a rescued keeper even before the camera has moved.
  G.checkpoint=0; continueGame();
  check(!G.pows.some(o => o.id===keeper.id) && G.freed.size===1, 'a rescued keeper stays rescued after a continue');

  // Reserve ammo is above the retry floors. Spend it during play, then take a final-arena continue.
  for (const code of ['Digit2','Digit3']) {
    pressed[code]=true; tick();
    G.p.ammo=1; G.p.fireCd=0; pressed.KeyX=keys.KeyX=true; tick(); keys.KeyX=false;
  }
  check(G.p.weapon==='moonbow' && !CaveGear6.ammo('sunflare') && !CaveGear6.ammo('echogun'), 'empty guns return the hero to the bow');
  G.checkpoint=LV.locks[LV.locks.length-1].at; continueGame(); tick();
  check(G.cam.x===G.checkpoint && G.warnT>0 && !G.big && !G.banner, 'the belfry retry has one boss warning and a clear health-bar area');
  check(CaveGear6.ammo('sunflare')===20 && CaveGear6.ammo('echogun')===8 && G.p.weapon==='moonbow', 'a belfry continue restores the discovered guns and preserves the selection');

  devStart({level:6, x:1351, god:true});
  keys.ArrowRight=true; tick(); keys.ArrowRight=false;
  const gate=G.locks[0];
  check(gate.active && gate.gateLift===0, 'the portcullis is down while its guards remain');
  gate.queue.length=0;
  tick();
  for (let i=0; i<18; i++) tick();
  check(gate.done && gate.gateLift===72, 'the portcullis opens after the final guard');

  // A real bow shot opens a solid bridge. Continuing must restore exactly one.
  devStart({level:6, x:2035, god:true});
  keys.KeyX=true;
  for (let i=0;i<115;i++) tick();
  keys.KeyX=false;
  const skyway=()=>LV.plats.filter(p=>p.t==='roostBridge');
  check(skyway().length===1 && skyway()[0].w===184, 'the winch unrolls a collidable skyway');
  G.checkpoint=1700; continueGame(); continueGame();
  check(skyway().length===1 && skyway()[0].w===184, 'the skyway survives repeated continues without stacking platforms');

  // Mid-rail entry uses the regular jump input. The cart carries the equipped gun.
  devStart({level:6, x:3750, god:true}); tick();
  check(G.p.ride && G.p.ride.type==='lanternCart', 'a mid-rail entry boards the lantern cart');
  ITEMS.U.collect(G.p,G.p);
  keys.KeyZ=pressed.KeyZ=true; tick(); keys.KeyZ=false;
  check(G.p.ride.height>0, 'jump lifts the cart and rider over the rail');
  for(let i=0;i<1000 && G.p.ride;i++)tick();
  check(!G.p.ride && G.p.x>=5030 && G.p.weapon==='sunflare', 'the arriving rider dismounts with the equipped gun');

  devStart({level:6, x:5705, god:true});
  keys.KeyX=true;
  for(let i=0;i<195;i++)tick();
  keys.KeyX=false;
  const stones=()=>LV.plats.filter(p=>p.caveMirrorStep);
  check(stones().length===6 && stones().every(p=>p.y===p.top), 'shooting the prism raises all six crystal platforms');
  G.checkpoint=5300; continueGame();
  check(stones().length===6 && stones().every(p=>p.y===p.top), 'the raised crystal crossing survives the lake checkpoint');
  devStart({level:6, x:5705, god:true});
  check(stones().every(p=>p.y>240) && !skyway().length, 'a new mission resets both optional crossings');

  devStart({level:6, x:6619, god:true}); keys.ArrowRight=true;
  for(let i=0;i<12;i++)tick();
  keys.ArrowRight=false;
  const duel=G.locks.find(l=>l.mini);
  check(duel.active && G.checkpoint===duel.at, 'the lake duel saves a retry at the arena');
  duel.queue.length=0; tick();
  check(duel.done && G.checkpoint>duel.at, 'the defeated Matriarch stays defeated at the lake checkpoint');
  continueGame(); tick();
  check(G.locks.find(l=>l.mini).done && !G.winT, 'continuing after the lake duel leaves the path to the forge open');
}
