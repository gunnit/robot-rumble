// Mission flow check (title, mission select, hero select, checkpoints, continue, next mission, intro,
// all clear) on the real eight-mission campaign. Runs at load time and prints FLOW lines:
//   node harness.mjs sim --level 1 --frames 1 --extra fixtures/flow-selftest.js 2>&1 | grep FLOW
// (Before Mission 2 existed this ran with engine-selftest.js as a stand-in mission 2; with the real Mission 2 loaded
// that stand-in would be a third mission, so the check now runs without it.)
{
  const out = [], ok = (c, m) => out.push((c ? 'ok   ' : 'FAIL ') + m);
  const step = (n, key) => { for (let i = 0; i < n; i++) { if (key && i === 0) pressed[key] = true; update(); for (const k in pressed) delete pressed[k]; } };
  const last = LEVELS.length - 1;
  if (typeof STORY !== 'undefined') STORY.enabled = false; // this checks the engine flow; tools/audit/story-test.mjs checks the story
  ok(LEVELS.length === 8 && LEVELS[7].title === 'DINOSAUR VALLEY' && LEVELS[6].title === 'THE LAST LIGHTHOUSE' && LEVELS[5].title === 'CLOCKFANG CAVERN' && LEVELS[4].title === 'ALIEN MOTHERSHIP' && LEVELS[1].title === 'VIGO HILLS' && LEVELS[2].title === 'VOLCANO ISLAND' && LEVELS[3].title === 'CORAL KINGDOM', 'missions loaded: ' + LEVELS.map(l => l.title).join(', '));
  // title -> missions -> select -> play
  G.state = 'title'; step(1, 'Enter'); ok(G.state === 'missions', 'title -> missions (' + G.state + ')');
  step(1, 'ArrowRight'); ok(G.level === 1, 'right selects mission 2 (' + G.level + ')');
  for (let i = 0; i < last; i++) step(1, 'ArrowRight');
  ok(G.level === last, 'no card past the last (' + G.level + ')');
  for (let i = 0; i < last; i++) step(1, 'ArrowLeft');
  ok(G.level === 0, 'left back to mission 1 (' + G.level + ')');
  step(1, 'Enter'); ok(G.state === 'select', 'missions -> hero select');
  step(1, 'ArrowRight'); step(1, 'Enter'); ok(G.state === 'play' && G.hero === 1 && LV === LEVELS[0], 'hero select -> play mission 1 as Mathias');
  // reach a checkpoint, die, continue
  G.locks[0].done = true; G.cam.x = 1500; G.p.x = 1700; step(5); ok(G.checkpoint === 1600, 'checkpoint 1600 (' + G.checkpoint + ')');
  G.state = 'over'; G.overT = 500; step(1, 'Enter'); ok(G.state === 'play' && LV === LEVELS[0] && G.cam.x === 1600 && G.continues === 1, 'continue restarts mission 1 at 1600 (cam ' + G.cam.x + ')');
  // win -> next mission with the same hero and score
  G.score = 12345; toWin(); step(130); step(1, 'Enter');
  ok(G.state === 'play' && G.level === 1 && LV === LEVELS[1] && G.score === 12345 && G.hero === 1 && G.lives === 3, 'win -> mission 2, score ' + G.score + ', hero ' + G.hero);
  ok(G.intro === true && G.big === null && G.p.hidden === true, 'mission 2 intro running, hero still inside the house, no MISSION START banner yet');
  step(5, 'KeyX'); ok(G.pb.length === 0, 'fire ignored during the intro');
  let n = 5;
  while (G.intro && n < 600) { step(1); n++; }
  ok(G.intro === false && !G.p.hidden && G.introDoor === 0 && G.big && /MISSION 2 START/.test(G.big.s), 'intro hands over control after ' + n + ' frames: hero outside, door shut, MISSION 2 START! showing');
  // a Mission 2 checkpoint (AREA 2), then game over and continue there
  const cp = LEVELS[1].sections[1].x;
  for (const l of G.locks) if (l.at < cp) l.done = true;
  G.cam.x = cp - 50; G.p.x = cp + 40; step(5);
  ok(G.checkpoint === cp, 'mission 2 checkpoint ' + cp + ' (' + G.checkpoint + ')');
  G.state = 'over'; G.overT = 500; step(1, 'Enter');
  ok(LV === LEVELS[1] && G.cam.x === cp && !G.intro && !G.p.hidden && G.introDoor === 0, 'continue restarts mission 2 at its checkpoint ' + cp + ' (cam ' + G.cam.x + '), no intro');
  // win -> mission 3 (boat intro, MISSION 3 START!), a checkpoint there, game over and continue
  G.score = 23456; toWin(); step(130); step(1, 'Enter');
  ok(G.state === 'play' && G.level === 2 && LV === LEVELS[2] && G.score === 23456 && G.hero === 1, 'win -> mission 3, score ' + G.score + ', hero ' + G.hero);
  ok(G.intro === true && G.p.hidden === true, 'mission 3 intro running, hero still in the boat');
  let n3 = 0, banner3 = false;
  while (G.intro && n3 < 800) { step(1); n3++; if (G.big && /MISSION 3 START/.test(G.big.s)) banner3 = true; }
  ok(G.intro === false && !G.p.hidden && banner3, 'mission 3 intro hands over control after ' + n3 + ' frames, MISSION 3 START! shown');
  const cp3 = LEVELS[2].sections[1].x;
  for (const l of G.locks) if (l.at < cp3) l.done = true;
  if (G.p.ride) G.p.ride = null;
  G.cam.x = cp3 - 50; G.p.x = cp3 + 40; G.p.y = groundAt(G.p.x); step(5);
  ok(G.checkpoint === cp3, 'mission 3 checkpoint ' + cp3 + ' (' + G.checkpoint + ')');
  G.state = 'over'; G.overT = 500; step(1, 'Enter');
  ok(LV === LEVELS[2] && G.cam.x === cp3 && !G.intro && !G.p.hidden, 'continue restarts mission 3 at its checkpoint ' + cp3 + ' (cam ' + G.cam.x + '), no intro');
  // Mission 4: dive intro, four-direction controls and a checkpoint continue.
  toWin(); step(130); step(1, 'Enter');
  ok(G.state === 'play' && G.level === 3 && G.hero === 1, 'mission 3 win -> mission 4 with same hero');
  ok(G.intro && G.p.ride.type === 'scuba', 'mission 4 intro equips the swimmer');
  step(1, 'Enter'); ok(!G.intro, 'mission 4 intro can be skipped');
  G.checkpoint = 3400; G.state = 'over'; G.overT = 500; step(1, 'Enter');
  ok(G.cam.x === 3400 && G.p.ride.type === 'scuba' && G.p.y > 50, 'mission 4 checkpoint restores swimming');
  // Mission 5 (added in this scratch copy): placeholder intro, a checkpoint continue on the hull
  toWin(); step(130); step(1, 'Enter');
  ok(G.state === 'play' && G.level === 4 && LV === LEVELS[4] && G.hero === 1 && !G.p.ride, 'mission 4 win -> mission 5 with same hero, on foot');
  ok(G.intro === true && G.p.hidden === true && G.big === null, 'mission 5 intro running, hero hidden, no banner yet');
  let n5 = 0, banner5 = false;
  while (G.intro && n5 < 800) { step(1); n5++; if (G.big && /MISSION 5 START/.test(G.big.s)) banner5 = true; }
  ok(G.intro === false && !G.p.hidden && banner5 && G.p.x === 120, 'mission 5 intro hands over control after ' + n5 + ' frames, MISSION 5 START! shown');
  G.checkpoint = 3300; G.state = 'over'; G.overT = 500; step(1, 'Enter');
  ok(LV === LEVELS[4] && G.cam.x === 3300 && !G.intro && !G.p.hidden && G.p.y === 212, 'continue restarts mission 5 at its checkpoint 3300 (cam ' + G.cam.x + '), on the hull, no intro');
  // Mission 6 receives the campaign score and grants a Moonbow to either hero.
  const carriedScore = G.score;
  toWin(); step(130); step(1, 'Enter');
  ok(G.state === 'play' && G.level === 5 && G.hero === 1 && G.score === carriedScore && G.p.weapon === 'moonbow', 'mission 5 win -> mission 6 with hero, score and Moonbow');
  step(1, 'Enter');
  ok(!G.intro && !G.p.hidden && G.p.x === LV.heroStart, 'skip Mission 6 intro and start in the grotto');
  G.checkpoint = 3400; G.state = 'over'; G.overT = 500; step(1, 'Enter');
  ok(G.cam.x === 3400 && !G.intro && G.p.weapon === 'moonbow', 'continue at the lantern railway with the Moonbow');
  toWin(); step(130); step(1, 'Enter');
  ok(G.level === 6 && G.hero === 1 && G.score === carriedScore && G.intro && G.p.weapon === 'signalgun', 'mission 6 win -> lighthouse with hero, score, lamp gun and storm bell');
  step(1, 'Enter');
  ok(!G.intro && !G.p.hidden && G.p.x === LV.heroStart, 'lighthouse intro hands over at Saltwind Quay');
  G.checkpoint = 3350; G.state = 'over'; G.overT = 500; step(1, 'Enter'); step(1);
  ok(G.p.ride && G.p.ride.type === 'kitePost7' && G.continues === 1, 'lighthouse continue boards the mail skiff');
  // Mission 8: the opening scene plays itself out (the hero ducks and shoots the little robot), then the two
  // checkpoints of CLUBTAIL's arena: during the fight (her cage shut), after it (TOPS waits for the hero)
  toWin(); step(130); step(1, 'Enter');
  ok(G.state === 'play' && G.level === 7 && LV === LEVELS[7] && G.hero === 1 && G.score === carriedScore && G.lives === 3 && !G.p.ride, 'mission 7 win -> mission 8 with hero and score, on foot');
  ok(G.intro === true && G.big === null, 'mission 8 intro running, no MISSION START banner yet');
  let n8 = 0, banner8 = false, ducked = false, shots = 0;
  while (G.intro && n8 < 800) { step(1); n8++; if (G.p.crouch) ducked = true; shots = Math.max(shots, G.pb.length); if (G.big && /MISSION 8 START/.test(G.big.s)) banner8 = true; }
  ok(G.intro === false && banner8 && ducked && shots === 1 && G.pb.length === 0 && !G.p.crouch && !G.enemies.some(e => e.active), 'mission 8 intro hands over control after ' + n8 + ' frames: one shot from a duck, no robot left, MISSION 8 START! shown');
  G.checkpoint = L8.CLUB_AT; G.state = 'over'; G.overT = 500; step(1, 'Enter');
  ok(LV === LEVELS[7] && G.cam.x === L8.CLUB_AT && !G.intro && G.section === 2 && G.props.some(o => o.k === 'topscage') && !L8.cageOpen(), 'continue in CLUBTAIL\'s arena: area 3, the cage shut (cam ' + G.cam.x + ')');
  G.checkpoint = L8.CLUB_AT + 1; G.state = 'over'; G.overT = 500; step(1, 'Enter');
  ok(G.cam.x === L8.CLUB_AT + 1 && L8.cageOpen() && !G.props.some(o => o.k === 'topscage') && G.props.some(o => o.k === 'tops'), 'continue after CLUBTAIL: no cage, TOPS waits for the hero');
  // last mission -> all clear -> title
  toWin(); step(130); step(1, 'Enter'); ok(G.state === 'allclear', 'last win -> ALL MISSIONS COMPLETE (' + G.state + ')');
  step(10, 'Enter'); ok(G.state === 'allclear', 'all clear waits before Enter works');
  step(130); step(1, 'Enter'); ok(G.state === 'title', 'all clear -> title (' + G.state + ')');
  draw();
  for (const s of out) console.log('FLOW ' + s);
}
