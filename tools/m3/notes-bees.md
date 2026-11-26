# Mission 3 bees (KEY = bees) - notes

Owner of: src/level3_bees.js (ENEMY_TYPES bee / hive / queenbee, EB_TYPES.stinger, ITEMS.honey).
Scratch: tools/m3/work-bees/

## Progress log
- [start] No earlier work (file was the 154-byte stub). Read spec, engine-api, harness README, proposal + jungle
  scene.js/notes (bee + hive painters), level2_enemies (eagle, robobear), engine.js (fx, locks, bullets).

## Plan / decisions
- Helpers lifted from proposals/level3/jungle/scene.js (pixel buffers, parts() shading, outline, bake).
- Bee sprites pre-baked at load for a fixed set of poses (no per-frame canvases, no rotation).
- Swarm: all bees on screen share one formation anchor (a loose V pointing at the hero); only the point bee
  attacks, one dive at a time, then it climbs back to the tail of the V.
- Bee telegraph: orange stinger 30 f (curling the abdomen forward), white + sparkle 20 f (target locked: where the
  hero stands now), then a straight dive; contact hurts only while diving.
- Hive = an enemy (spawn y = hang point), flying: true so the bot aims up. Draws its own mount: a mossy branch in
  the jungle, a steel girder in the lava areas / crater (x >= 3900). On death it stays as a harmless wreck (empty
  branch, broken strap) until culled.
- Queen bee: intro (inv) -> hover figure-8; attacks call / fan / swoop; dying: shudder, crown pop, burst,
  e.dead = true (never bossDefeated).

## Progress log (cont.)
- [r1] level3_bees.js written (~1150 lines): helpers, bee (16 baked poses: fly/fast/climb/ch0-2/aim/10 dive angles,
  3 wing frames + ghost blur), swarm V logic, hive (3 damage sprites, branch x2 / girder mounts, strap stub wreck),
  queen (10 baked poses, crown, ruff, violet thorax, gold/black armoured abdomen, 2 pairs of glass wings), stinger
  EB (sticks in the ground 40 f, shootable), honey item (jar sprite, +1000).
- Sandbox sims bee / hive / queenbee: errors []. Swarm fix: formation re-inits only after 60 f with no bees (a bee
  in its dive used to reset the anchor to its own low position).
- Queen hover lowered to y ~100 (was hiding under the boss bar). Call only when < 2 bees on screen (was counting
  asleep spawns far ahead, so she never called). Rise height 72.
- Tools: work-bees/log.js (state-change + hurt log as warnings), zoo.js + zoo-<mode>.js (pinned poses, --level 4),
  crop.mjs.
- [r2] Visual rounds: queen face redone (bigger head, round red lens with glint, frilled white ruff collar, gold sash
  + brooch on the violet thorax, five-point jewelled crown), lighter tucked legs; swoop tell made bold (darker
  shadow, solid blinking red/white double ring, "!" above the hero's head; the old "!" hid behind the hero);
  stinger darts with glow + streak; crown-pop star; phase 2 (<= 30 hp): two plates pop off + BZZZ!!; charge drips.
- Renders checked: lock 3581.6 (intro, call, fan orange/white, darts, rise shadow, swoop), queen death (kill.js:
  crown pop 282, burst 342, honey + crown on the ground 380), hive kill at 2620 (burst, wreck), pond hive 3250,
  crater girder hive 5500 (fits the world's crane), first bee at 300.
- [r3] Load time: work-bees/loadtime.mjs (vm + napi canvas, CPU time) showed ~620 ms CPU, the queen ~425 ms of it.
  Fixed: queen wings cached per angle + bounding-box scans (bee wings too), leg capsules built once with a box
  reject, abdomen seams on the raw buffer, one branch variant, smaller queen buffer (106x100). Now ~300-400 ms CPU
  in total on this (very loaded) machine; Math.random calls at load: 0.
- Swoop "!" now 2x size, 56 px above the ground (above the hero's head).
- Final renders for the sheet: f-*.png, zoo-*.png; sheet list in work-bees/sheet.json, script sheet.mjs.

## Test results (r2, before the final pass)
- sim L3 seed 1 (+log.js): errors [], hits [3,5,100,0] (AREA 2 = 5; AREA 3 hits are lava, the bot can't jump
  gaps); queen fight 23 s (bot), lock done. sim --x 3581.6: errors [], queen 22 s.
- parity: L1 true [] [0,0,5,9] 14150; L2 true [] [1,4,1,10] 33000.

## FINAL test results (final file)
- sim L3 seed 1: completed false (no boss / bot can't cross lava), errors [], hits [3,3,103,0], score 28900, x 4158
  (the 3380 QUEEN BEE lock completes; AREA 3 hits are lava bounces, not this file).
- sim L3 --x 3581.6 seed 1: errors [], hits [0,7,116,0] (queen fight ~22 s for the bot, then lava).
- parity: L1 hero 0 seed 1: true [] [0,0,5,9] 14150. L2 seed 1: true [] [1,4,1,10] 33000.
- sandbox sims: bee,bee,bee 3000 f errors [] (4 hits); hive 3000 f errors [] (7 hits, 4900 pts); queenbee 4000 f
  errors [] (15 hits: no lock, the camera scrolls away from her); bee,hive,queenbee --god seed 2 errors [].
- Contact sheet: work-bees/sheet.png (12 frames). STATUS: done.
