# Mission 3 enemies (KEY = enemies) - notes

Owner of: src/level3_enemies.js (ENEMY_TYPES shark, lavashark, frog; EB_TYPES lavabomb; L3.lavaBomb(tx)).
Scratch: tools/m3/work-enemies/ (zoo.js pose fixture + rz.sh, t-tongue.js, diag.js, crop.mjs, r1.. renders)

## Progress log
- [start] No earlier work (file was the 154-byte stub). Read spec, proposal (bay/lava/jungle scene.js + notes),
  engine-api, harness README, level3.js wiring, level2_enemies.js idioms.
- [r1] Full file written (~1600 lines): sprites lifted from the proposal (shark rasterizer per angle, lava shark grid +
  bend per angle, frog parts builder with variants, bomb voronoi rock), behaviours, pieces, bomb + marker.
  sandbox sim (shark,frog,lavashark --god 3000): errors []. L3 sim seed 1: errors [].
- [r2] Fins bigger (fin sprite scale 0.95), shark shadow alpha 0.5 (world front water covers it), lava fin sits
  2 px into the lava band (the world's lava lip is drawn in front at y 250..252), lava wake on the band.
- [tongue] t-tongue.js drives real keys: 6/6 PASS (stick+pull 12.00 px/20 f while holding LEFT, jump free, reach =
  1 hit + push back, shoot free, crouch dodge, jump dodge). Fix needed on the way: the tip now reaches standing
  height (feet - 28) within the first quarter of the lash (the mouth is lower than a hero's chest).

## Decisions
- Shark: zone = the stretch of deep water (ground >= surface + 8) round its x: lagoon A [~674,1468], B [~1612,2050];
  the sandbar is a wall. Leap only when the hero is over its zone (or the pier above it), 18-150 px away, on screen.
  Warn 50 f -> leap (T 44-60 f, apex 52-74 px) landing 10 px past the hero's x at leap start -> under 30 f -> swim
  with cd 110-170. Only the leap hurts. Fin box 16x18 at the surface (wading standing shot feet-19 hits it).
- One attack slot for sharks + lava sharks: one warning/leaping at a time, 40 f breather (kid-friendly).
- Lava shark: lives in LV.lava[spec.lava] (waves) / the lava at x / the nearest lava (boss summons). Waves and
  `lava:` entries surface ('rise' 46 f, not hittable) at the river end nearest their edge. Leap arc passes the
  hero's chest (feet-16) when the hero is over the river; a bank hero is only reachable near the edge.
- Frog: 'block' contact while sitting (harmless push), 'hurt' only when coming down from a hop. Croak 30 f ->
  lash 9 f out + 5 hold + 12 back. Tongue tip box at feet-31..feet-25 (standing box hit, crouch box not).
  Stuck: p.x overridden each frame (after the player update) = hold +/- 0.6; jump tap / drop / any other hit / lava
  ahead releases; |dx| < 25 -> hurtPlayer + kb 3.4 away. Only one frog may croak/lash/stick at a time.
  Hops: squat 14 f (landing shadow shows), arc to a platform or ground spot 30-84 px away inside home +-110, on
  screen, never over/into lava or deep water, never past 5690.
- Lava bomb: 90 f flight from the upper right (x tx+70, y -24, g 0.05), lands on the first surface at tx (platform,
  liquid or ground); ring closes 18->10 px and blinks faster in the last 30 f; impact hurts only within 9 px.
- Pieces: own physics (sink slowly in water, melt in lava, bounce on ground and platforms), enemy stays 'dying'.

- [r3/r4] croak: sac balloons forward under the chin + RIBBIT! text + croak rings; hop shadow darker (the world's
  front grass covers its lower rows); lava warning: the head (steel dome, hot plates) breaks the crust ahead of the fin
  with a fast-blinking eye, bubbles above the lava lip; shark warning: shadow drawn before the rings (it was hiding
  them) and only the fin rises; bigger death pieces (hull plates, tail fin, toothed jaw, frog helmet); bomb leaves a
  short burning patch. Contact-sheet scenes in zoo.js (sh-warn, sh-leap, sh-burst, fr-tongue, fr-hop, pond, lv-warn,
  lv-over, bomb2), rendered into work-enemies/sheet/.
- Parity after r2: L1 true [] [0,0,5,9] 14150; L2 true [] [1,4,1,10] 33000.
- [edge] boss-style summons (makeEnemy lavashark at 6100 / 5900 / 6300) land in the lake 5944..6200 and stay in
  5952..6186 over 1800 f; `rise: true` (or side / lava) gives the surfacing entry. Queen-bee lock wave frog hops on
  screen from x 3878 and plays normally. 4440 lava lock completes (god): 3 lava sharks shot mid-leap.
- [sheet] work-enemies/sheet.png (12 labelled frames), scenes in zoo.js, compose with sheet.mjs. STATUS: done.

## Test results (final)
- run.sh sim --level 3 --seed 1: errors [] completed false hits [3,3,103,0] deaths 35 score 28900 x 4158 (the bot can't
  cross the lava rivers yet: integration; AREA 3 hits are the stuck bot in river 1: lava + lava sharks + bombs)
- run.sh sim --sandbox shark,frog,lavashark --god --frames 3000 --seed 1: errors [] (no water/lava there: the sharks use
  a stand-in pool at the ground so every state runs) score 4200
- parity: L1 true [] [0,0,5,9] 14150; L2 true [] [1,4,1,10] 33000
- in-level: --x 760 errors [] hits [4,2,..] (bees + jet-ski hits); --x 2560 errors [] (frog stuck 3x, bot jumps free);
  --x 4180 errors []; --x 1401.6 --god: shark pack lock completes; --x 4641.6 --god: lava lock completes
- t-tongue.js: 6/6 PASS (see work-enemies/t-tongue.out)
