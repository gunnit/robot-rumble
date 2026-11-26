# Mission 3 skeleton (KEY = skeleton) - notes

Owner of: src/level3.js. Created the six stubs (jetski, level3_enemies, level3_bees, level3_boss, level3_sky,
level3_world) with noclobber at 11:17 Nov 11 (none existed); their builders replace them.
Scratch: tools/m3/work-skeleton/

## Progress log
- [11:17] Read spec, engine-api, harness README, proposal + notes, level2.js. Stubs created.
- [r1] level3.js written (1170 lines): data, hook wiring + stand-ins, lava/water/item rules, POW toss, bomb
  schedule, boat intro, 7 caged animals, TRACKS.island/whaleboss, card preview. sim seed 1: errors [], parity OK.
- [r2] fixes: letterbox 34 px (covers the HUD), boat raised (was buried in sand), card palm scaled, jungle and
  crater BG stand-ins redone (jagged crater walls + far rim), heads drawn over the cage bars.
- [r3] lagoon water more opaque + front layer, AREA 3 BG = narrow basalt colonnade (was a city skyline), continuous
  volcano lava rivers, card shark painted at 5 angles (crisp). Rule tests (tests.js + t-*.js) all pass.
- [r4/final] sheet.png composed (12 frames). Final sims + parity re-run (below). STATUS: done, handed over.
Scripts: work-skeleton/renders.sh N (all frames), diag.js (event log fixture), zoo.js + zoo-mode*.js (animals),
crop.mjs (zoom).

## Decisions
- Hooks look L3.<hook> up at call time; stand-ins only when missing. drawBehind also draws stand-ins for unregistered
  prop kinds (palm, beachrock, jetski) and the beached boat (after L3.drawBehind).
- Lava bounce: hurtPlayer() + vy -7.5 + p.y = surface; the engine cuts a rising hero to vy -2.6 when jump is not held,
  so liquidRules keeps the hero on the full -7.5 arc (S.bvy) until it would be slower than -2.34 anyway. Peak ~104 px.
- Respawn over lava (y < 0, x in a lava range) -> moved to the nearest bank or column on screen (kid-friendly).
- Items in lava (vy >= 0, y > surface - 1) hop to the nearest bank (on-screen banks preferred) on an aimed arc.
- Animal toss: the engine drops o.item at salute t 40 behind the animal; the same frame level3.js finds that item
  (t 1, x o.x - 10.6) and re-aims it to land at hero x + 40 (clamped on screen, never in lava). Marker: it.l3t.
- Splashes for the wading hero are emitted here (not the world's job); none while riding.
- Bomb schedule: AREA 3 only (G.section 2), first after 150 frames, then 260 +-20% (130 during the 4440 lock), tx =
  hero x + rand(-30, 80) clamped to the screen; L3.lavaBomb wrapped in try/catch + errorOnce.
- Data additions: y on frogs that sit on platforms (2900 -> 186, 3200/3300 -> 225); `lava: 1` on lava-shark waves.
- Animals: grid sprites built at load (5 frames each), M2 cage + lock-eye + HELP!, head drawn over the bars,
  thanks 'THANK YOU!' + own call; salute styles flap/wiggle/flip/pushup; birds fly home, others run.

## Test results
- r1 sim --level 3 --seed 1: errors [], completed false (no boss yet), hits [0,0,4,122]: 4 = one lava hit per river
  (4182, 4568, 4780, 5090); 122 = the bot walking into the crater lava lake after the stand-in boss lock ends.
  Tosses land ~40 px ahead of the hero (S 635, heart 1637, B 3077, R 4516, H 5570).
- parity: L1 true [] [0,0,5,9] 14150; L2 true [] [1,4,1,10] 33000.
- rule tests (render + tests.js): intro ends f186 hero x 138.2 on ground; Enter skip at t30 ends f68 at x 140;
  bounce peak y 145.6 (104 px), lands on column 4170; 1-heart death in river 2 -> respawn x 4632 on column 4618;
  coin dropped in river 2 at 4712 pops to the bank 4840 (y 222); iguana toss aims at bank 4546 (target 4570 was lava);
  bombs: gaps 114/155/141 in the lock, 218 after, first at f150.
- FINAL: L3 seed 1 errors [] completed false hits [0,0,4,122] deaths 42 score 6000 freed 5 x 5494;
  L3 hero 1 seed 2 same; L1 true [] [0,0,5,9] 14150; L2 true [] [1,4,1,10] 33000.
