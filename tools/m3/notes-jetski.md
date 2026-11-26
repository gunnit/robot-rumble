# Mission 3 jet-ski (KEY = jetski) - notes

Owner of: src/jetski.js (RIDES.jetski, PROP_TYPES.jetski, PROP_TYPES.jetskiwreck).
Scratch: tools/m3/work-jetski/

## Progress log
- [start] Read spec. jetski.js was the skeleton stub (empty block). Starting fresh.
- [read] spec, engine-api, harness README, proposal + bay scene.js/notes, vehicle.js (tractor), level3.js skeleton.
  Other M3 files are still stubs (no shark yet): test fights with a stand-in shark fixture (work-jetski/fx-shark.js,
  only used if ENEMY_TYPES.shark is missing).

## Decisions (plan)
- Ride floats at LV.water y (234), own lookup of LV.water (no L3 export, so no `var L3` line).
- Shores: per water range, shorelines found by scanning groundAt at both ends (left 640, right 2090); p.x kept in
  [shoreL + 30, shoreR - 30] = [670, 2060]. Left shore: stop with a bump. Right (far) shore: beach sequence, the hero
  hops off forward onto the sand (scripted hop), the ski stays as PROP_TYPES.jetskiwreck mode 'beached' (not a RIDES
  key, so the bot doesn't re-board and loop).
- Sandbar 1490-1590 (dry, inside the lagoon range): the hull rides up on the sand (support from groundAt at keel
  points), skids slowly (top 1.0 instead of 2.1) with sand spray, tilts with the slope. So the bot can cross it in the
  1200 lock.
- Controls: L/R throttle (glide), Z hop (hold = higher), X nose gun (Up swings it to 90 deg), C torpedo (8), Down+Z
  hop off (scripted hop onto a pier deck when one is within 24 px, else into the shallows).
- Armour 5; plates knocked off at 4,3,2,1 (hood, stern, mid, bow); at 0 the hero is thrown clear and the ski sinks
  (wreck mode 'sink', GLUG/BLUB gurgle) or, on the sandbar, falls apart ('fizzle').
- [r1] jetski.js written (~1000 lines): painter, sprites (body, antenna, pennant x8, 4 plates + scars, gun x13 angles,
  flash x13, torpedo x2, HUD icons), compose on 2 canvases + pitch in 2-degree steps, ride update/hurt/hud, parked
  prop, wreck prop (beached / sink / fizzle / bits). Other M3 files appeared meanwhile (real sharks in level3_enemies).
- [r2] plates redesigned (4 grey slabs hid the red hull): bow, stern, hood cheek, gun shield. Gun barrel thinner.
- [r3] real shark fin box = {x-8, y wl-17, 16x18}: level shots were too high on the sandbar and the bot's ski spent
  ~40/42 frames airborne (bot jumps every 42 f) so it couldn't hit fins. Fixes: GUN_AT y -13 (level shots y 221),
  keel digs 1px into sand (DRAFT 1), hop -3.1 (tap 22 px, hold 30 px) + 22-frame landing cooldown, shots start
  back inside the hull (hidden until past the muzzle) so a fin at/under the bow is hit.
  sim seed 1 (2600 f): boards f562->580 at 700, LOCK1200 t29..t660 from the ski, beach f1937 at 2060, hops off
  onto the beach f1952 at 2052->2113, beached wreck at 2062. Armour 3 left.
- [r4] bigger rooster tail + churn, stronger V wake, drawn smoke column (armour<=2), drips when airborne; far-shore
  stop 12 px earlier (bow clear of the beach rock at 2100).
Scripts: work-jetski/renders.sh TAG [names] (scenarios in sc/*.js + fx-keys.js), fx-log.js / fx-log2.js (sim log),
crop.mjs (zoom), fx-shark.js (stand-in shark, inert now that the real one exists).
- [r5/r6] torpedo starts at ski speed + 1.4 and rides 1 px lower with a bow wave; HUD icon cleaned (tiny antenna
  flag), GET IN! lower (y-52), idle churn at the nozzle, no beach start while airborne.
## Test results (after r6)
- sim --level 3 --seed 1 (full 30000 f): errors [], hits [3,4,106,0], completed false (bot stuck in AREA 3 lava:
  integration task), score 27550. Lagoon: boards f580 at 700, LOCK1200 fought from the ski, beached ~f1937.
- sim --level 3 --seed 1 --x 700: errors [], boards at f1, LOCK1200 t28..~t710 from the ski with armour 5 left, beach
  f1381 -> hero on the beach at 2113 f1396, beached wreck at 2050. hits [1,6,108,0].
- seed 2 and seed 3 hero 1 (2700 f): same story, armour 3 / 4 left at the beach.
- parity: L1 true [] [0,0,5,9] 14150; L2 true [] [1,4,1,10] 33000.
- [r7/r8] final renders out/r7-*.png (+ r6-torphit, r8-fizzle). Contact sheet work-jetski/sheet.png (12 frames,
  sheet.mjs). Sandbar fizzle (armour 0 on sand) checked: no errors, plates bounce on the sand.
- Final re-runs after the last code change (no beach start while airborne):
  sim --level 3 --seed 1 --x 700: errors [], hits [1,6,108,0], board f1, LOCK1200 from the ski with armour 5,
  beach f1381, on foot at 2041 -> 2113 f1396, beached wreck at 2050.
STATUS: done unless the full-seed sim below shows otherwise.
- FINAL: sim --level 3 --seed 1: errors [], hits [3,3,103,0], completed false (AREA 3 lava: bot), score 28900.
  parity L1 true [] [0,0,5,9] 14150; L2 true [] [1,4,1,10] 33000. STATUS: done, handed over.
